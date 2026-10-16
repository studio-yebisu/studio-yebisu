#!/usr/bin/env node
// 架空の書店メモを索引にして探す CLI。Node.js 20 以上の組み込みモジュールだけを使う。
//   node src/notes.mjs build  --input input/notes --out outputs/index.json
//   node src/notes.mjs search --index outputs/index.json --query "読書会 土曜" --tag ""
// 成功時は結果の JSON を標準出力へ、失敗時は理由を標準エラーへ書き、終了コード 1 で止まる。
import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, unlinkSync, writeSync } from 'node:fs';
import path from 'node:path';

const INDEX_FORMAT = 'studio-yebisu-note-index-v1';
const SEARCH_FORMAT = 'studio-yebisu-note-search-v1';
const META_KEYS = ['id', 'tags', 'title'];
const NOTE_KEYS = ['body', 'id', 'source', 'source_sha256', 'tags', 'title'];
const ID_PATTERN = /^N\d{2}$/;
const SHA_PATTERN = /^[0-9a-f]{64}$/;
const SOURCE_PATTERN = /^input\/notes\/[^/\\]+\.md$/;

const COMMANDS = {
  build: { options: ['--input', '--out'], required: ['--input', '--out'] },
  search: { options: ['--index', '--query', '--tag'], required: ['--index'] },
};

class CliError extends Error {}

function fail(message) {
  throw new CliError(message);
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sameKeys = (obj, keys) => Object.keys(obj).sort().join('\n') === keys.join('\n');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decoder = new TextDecoder('utf-8', { fatal: true });

// ---------- 引数 ----------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command === undefined) fail('コマンドがありません。build か search を指定してください');
  if (!Object.hasOwn(COMMANDS, command)) fail(`知らないコマンドです: ${command}（build か search）`);
  const spec = COMMANDS[command];
  const values = {};
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i];
    if (!spec.options.includes(name)) fail(`${command} では使えない引数です: ${name}`);
    if (Object.hasOwn(values, name)) fail(`${name} が2回あります`);
    if (i + 1 >= rest.length) fail(`${name} の値がありません`);
    values[name] = rest[i + 1];
  }
  for (const name of spec.required) {
    if (!Object.hasOwn(values, name)) fail(`${command} には ${name} が必要です`);
    if (values[name] === '') fail(`${name} の値が空です`);
  }
  return { command, values };
}

// ---------- メモの読み取り ----------

function checkTags(tags, where) {
  if (!Array.isArray(tags)) fail(`${where}: tags は文字列の配列にしてください`);
  const seen = new Set();
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.trim() === '') fail(`${where}: tags に空の値か文字列でない値があります`);
    if (seen.has(tag)) fail(`${where}: tags に重複があります: ${tag}`);
    seen.add(tag);
  }
}

function parseNote(name, bytes) {
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    fail(`${name}: UTF-8 として読めません`);
  }
  const firstEnd = text.indexOf('\n');
  if (firstEnd === -1) fail(`${name}: 1行目のメタデータのあとに空行と本文がありません`);
  const secondEnd = text.indexOf('\n', firstEnd + 1);
  if (secondEnd === -1) fail(`${name}: 1行目のメタデータのあとに空行と本文がありません`);
  const metaLine = text.slice(0, firstEnd).replace(/\r$/, '');
  const blankLine = text.slice(firstEnd + 1, secondEnd).replace(/\r$/, '');
  if (blankLine !== '') fail(`${name}: 2行目は空行にしてください`);

  let meta;
  try {
    meta = JSON.parse(metaLine);
  } catch {
    fail(`${name}: 1行目が JSON として読めません`);
  }
  if (!isObj(meta) || !sameKeys(meta, META_KEYS)) fail(`${name}: 1行目は id・title・tags だけを持つ JSON オブジェクトにしてください`);
  if (typeof meta.id !== 'string' || !ID_PATTERN.test(meta.id)) fail(`${name}: id は N と2桁の数字にしてください（例 N01）`);
  if (typeof meta.title !== 'string' || meta.title.trim() === '') fail(`${name}: title が空です`);
  checkTags(meta.tags, name);

  const body = text.slice(secondEnd + 1).trim();
  if (body === '') fail(`${name}: 本文が空です`);
  return { id: meta.id, title: meta.title, tags: [...meta.tags], body };
}

function readNotes(inputDir) {
  let info;
  try {
    info = statSync(inputDir);
  } catch {
    fail(`入力のフォルダが見つかりません: ${inputDir}`);
  }
  if (!info.isDirectory()) fail(`--input はフォルダにしてください: ${inputDir}`);

  const names = readdirSync(inputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) fail(`入力のフォルダに .md のメモがありません: ${inputDir}`);

  const notes = [];
  const inputs = {};
  const ids = new Map();
  for (const name of names) {
    const bytes = readFileSync(path.join(inputDir, name));
    const note = parseNote(name, bytes);
    if (ids.has(note.id)) fail(`id が重複しています: ${note.id}（${ids.get(note.id)} と ${name}）`);
    ids.set(note.id, name);
    // 公開する記録には手元のパスを書かず、ファイル名だけから決めた相対パスを使う
    const source = `input/notes/${name}`;
    const digest = sha256(bytes);
    notes.push({ ...note, source, source_sha256: digest });
    inputs[source] = digest;
  }
  return { format: INDEX_FORMAT, notes, inputs_sha256: inputs };
}

// ---------- 書き出し ----------

function writeNew(outPath, text) {
  let existing = true;
  try {
    lstatSync(outPath);
  } catch {
    existing = false;
  }
  if (existing) fail(`出力先が既にあります。上書きはしません: ${outPath}`);
  mkdirSync(path.dirname(outPath), { recursive: true });
  let fd;
  try {
    fd = openSync(outPath, 'wx');
  } catch (err) {
    if (err && err.code === 'EEXIST') fail(`出力先が既にあります。上書きはしません: ${outPath}`);
    throw err;
  }
  try {
    writeSync(fd, text);
    fsyncSync(fd);
    closeSync(fd);
  } catch (err) {
    // 'wx' で自分が作ったファイルだけを消す
    try { closeSync(fd); } catch { /* 閉じ済み */ }
    try { unlinkSync(outPath); } catch { /* 残った場合は標準エラーで分かる */ }
    throw err;
  }
}

function build(values) {
  const index = readNotes(path.resolve(values['--input']));
  const text = `${JSON.stringify(index, null, 2)}\n`;
  writeNew(path.resolve(values['--out']), text);
  process.stdout.write(text);
}

// ---------- 検索 ----------

function loadIndex(indexPath) {
  let bytes;
  try {
    if (!statSync(indexPath).isFile()) fail(`--index はファイルにしてください: ${indexPath}`);
    bytes = readFileSync(indexPath);
  } catch (err) {
    if (err instanceof CliError) throw err;
    fail(`索引を読めません: ${indexPath}`);
  }
  let index;
  try {
    index = JSON.parse(decoder.decode(bytes));
  } catch {
    fail('索引が UTF-8 の JSON として読めません');
  }
  if (!isObj(index) || !sameKeys(index, ['format', 'inputs_sha256', 'notes'])) fail('索引の形が想定と違います');
  if (index.format !== INDEX_FORMAT) fail(`索引の形式名が ${INDEX_FORMAT} ではありません`);
  if (!Array.isArray(index.notes) || index.notes.length === 0) fail('索引にメモがありません');
  if (!isObj(index.inputs_sha256)) fail('索引に inputs_sha256 がありません');

  const ids = new Set();
  const sources = new Set();
  for (const [i, note] of index.notes.entries()) {
    const where = `索引の notes[${i}]`;
    if (!isObj(note) || !sameKeys(note, NOTE_KEYS)) fail(`${where} の項目が想定と違います`);
    if (typeof note.id !== 'string' || !ID_PATTERN.test(note.id)) fail(`${where} の id が不正です`);
    if (ids.has(note.id)) fail(`索引の id が重複しています: ${note.id}`);
    ids.add(note.id);
    if (typeof note.title !== 'string' || note.title.trim() === '') fail(`${where} の title が空です`);
    if (typeof note.body !== 'string' || note.body.trim() === '') fail(`${where} の body が空です`);
    checkTags(note.tags, where);
    if (typeof note.source !== 'string' || !SOURCE_PATTERN.test(note.source)) fail(`${where} の source が input/notes/<名前>.md の形ではありません`);
    if (sources.has(note.source)) fail(`索引の source が重複しています: ${note.source}`);
    sources.add(note.source);
    if (typeof note.source_sha256 !== 'string' || !SHA_PATTERN.test(note.source_sha256)) fail(`${where} の source_sha256 が不正です`);
    if (index.inputs_sha256[note.source] !== note.source_sha256) fail(`${where} の source_sha256 が inputs_sha256 と一致しません`);
  }
  if (!sameKeys(index.inputs_sha256, [...sources].sort())) fail('inputs_sha256 のキーがメモの source と一致しません');
  return index;
}

const normalize = (s) => s.normalize('NFKC').toLowerCase();

function search(values) {
  const query = values['--query'] ?? '';
  const tag = values['--tag'] ?? '';
  const index = loadIndex(path.resolve(values['--index']));

  // NFKC・小文字にそろえ、前後の空白を除いて Unicode の空白で区切った語をすべて含むものを残す
  const tokens = normalize(query).trim().split(/\s+/u).filter(Boolean);
  const tagKey = normalize(tag).trim();
  const results = index.notes.filter((note) => {
    if (tagKey !== '' && !note.tags.some((t) => normalize(t).trim() === tagKey)) return false;
    const haystack = normalize([note.id, note.title, ...note.tags, note.body].join('\n'));
    return tokens.every((token) => haystack.includes(token));
  });

  const out = {
    format: SEARCH_FORMAT,
    query,
    tag,
    tokens,
    result_ids: results.map((note) => note.id),
    results,
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

// ---------- 入口 ----------

try {
  const { command, values } = parseArgs(process.argv.slice(2));
  if (command === 'build') build(values);
  else search(values);
} catch (err) {
  const message = err instanceof CliError ? err.message : `想定外のエラー: ${err && err.message ? err.message : String(err)}`;
  process.stderr.write(`notes: ${message}\n`);
  process.exitCode = 1;
}
