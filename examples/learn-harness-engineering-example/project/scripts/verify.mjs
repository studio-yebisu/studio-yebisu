#!/usr/bin/env node
// src/notes.mjs を子プロセスとして実際に実行して確かめる。結果は JSON 1つだけを標準出力へ書く。
//   1. 固定入力から OS の一時フォルダへ索引を作り、入力ファイルを別に読んだ値・SHA-256 と照合する
//   2. input/queries.json の8問を search で実行し、結果のIDと全項目を期待と照合する
//   3. 意図的な失敗（NEGATIVE CONTROLS）で、終了コード1・成功の出力なし・既存ファイルの保持を確かめる
// 一時フォルダは mkdtemp で自分が作ったものだけを、最後に場所を確かめてから消す。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'src', 'notes.mjs');
const NOTES_DIR = path.join(ROOT, 'input', 'notes');
const QUERIES_PATH = path.join(ROOT, 'input', 'queries.json');
const TEMP_PREFIX = 'studio-yebisu-notes-verify-';
const NOTE_IDS = ['N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08'];
const NOTE_KEYS = ['body', 'id', 'source', 'source_sha256', 'tags', 'title'];
const SEARCH_KEYS = ['format', 'query', 'result_ids', 'results', 'tag', 'tokens'];

const failures = [];
const decoder = new TextDecoder('utf-8', { fatal: true });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sameKeys = (obj, keys) => isObj(obj) && Object.keys(obj).sort().join('\n') === keys.join('\n');

function expect(ok, message) {
  if (!ok) failures.push(message);
  return Boolean(ok);
}

// シェルを通さず、同じ Node で CLI を起動する。失敗の終了コードも結果として返す。
function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    if (!err || !('status' in err)) throw err;
    return { status: err.status, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? '') };
  }
}

// ---------- 固定入力の写し ----------

function snapshotInputs() {
  const names = readdirSync(NOTES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
  const notes = new Map(names.map((name) => [name, readFileSync(path.join(NOTES_DIR, name))]));
  return { names, notes, queries: readFileSync(QUERIES_PATH) };
}

function hashesOf(snapshot) {
  const out = { 'input/queries.json': sha256(snapshot.queries) };
  for (const name of snapshot.names) out[`input/notes/${name}`] = sha256(snapshot.notes.get(name));
  return out;
}

// CLI とは別に、入力ファイルを正規表現で読んで期待する索引の1件を作る
function readExpectedNote(name, bytes) {
  const text = decoder.decode(bytes);
  const match = /^([^\r\n]*)\r?\n\r?\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${name} を「1行目のJSON・空行・本文」として読めません`);
  const meta = JSON.parse(match[1]);
  return {
    id: meta.id,
    title: meta.title,
    tags: meta.tags,
    body: match[2].trim(),
    source: `input/notes/${name}`,
    source_sha256: sha256(bytes),
  };
}

function writeCopies(dir, snapshot, replace = {}) {
  mkdirSync(dir, { recursive: true });
  for (const name of snapshot.names) writeFileSync(path.join(dir, name), snapshot.notes.get(name), { flag: 'wx' });
  for (const [name, bytes] of Object.entries(replace)) writeFileSync(path.join(dir, name), bytes);
  return dir;
}

function tokensOf(query) {
  return query.normalize('NFKC').toLowerCase().trim().split(/\s+/u).filter(Boolean);
}

// ---------- 確認 ----------

function checkIndex(built, indexPath, expectedNotes) {
  if (!expect(built.status === 0, `build が終了コード ${built.status} で止まりました`)) return null;
  if (!expect(existsSync(indexPath), 'build のあとに索引ファイルがありません')) return null;
  const fileText = readFileSync(indexPath, 'utf8');
  expect(built.stdout === fileText, 'build の標準出力と索引ファイルの中身が一致しません');
  let index;
  try {
    index = JSON.parse(fileText);
  } catch {
    expect(false, '索引ファイルが JSON として読めません');
    return null;
  }
  expect(sameKeys(index, ['format', 'inputs_sha256', 'notes']), '索引の最上位の項目が想定と違います');
  expect(index.format === 'studio-yebisu-note-index-v1', '索引の形式名が違います');
  if (!expect(Array.isArray(index.notes), '索引に notes の配列がありません')) return null;
  expect(index.notes.length === expectedNotes.length, `索引のメモが ${index.notes.length} 件で、入力の ${expectedNotes.length} 件と違います`);
  expectedNotes.forEach((want, i) => {
    const got = index.notes[i];
    expect(sameKeys(got, NOTE_KEYS), `索引の ${want.id} の項目名が想定と違います`);
    expect(isDeepStrictEqual(got, want), `索引の ${want.id} が、入力ファイルを別に読んだ値（メタデータ・本文・source・SHA-256）と一致しません`);
  });
  const wantHashes = Object.fromEntries(expectedNotes.map((n) => [n.source, n.source_sha256]));
  expect(isDeepStrictEqual(index.inputs_sha256, wantHashes), '索引の inputs_sha256 が入力ファイルの実際の SHA-256 と一致しません');
  for (const note of index.notes) {
    expect(isObj(note) && typeof note.source === 'string' && !path.isAbsolute(note.source) && !note.source.includes('\\'),
      '索引の source に手元の絶対パスか区切り文字 \\ が入っています');
  }
  return index;
}

function checkQuery(q, indexPath, index, expectedById) {
  const entry = { id: q.id, query: q.query, tag: q.tag, actual_ids: null, expected_ids: q.expected_ids, status: 'failed' };
  if (!index) {
    failures.push(`${q.id}: 索引を作れなかったため検索を実行していません`);
    return entry;
  }
  const r = run(['search', '--index', indexPath, '--query', q.query, '--tag', q.tag]);
  if (!expect(r.status === 0, `${q.id}: search が終了コード ${r.status} で止まりました`)) return entry;
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    expect(false, `${q.id}: search の標準出力が JSON として読めません`);
    return entry;
  }
  entry.actual_ids = Array.isArray(out.result_ids) ? out.result_ids : null;
  const before = failures.length;
  expect(sameKeys(out, SEARCH_KEYS), `${q.id}: 検索結果の項目名が想定と違います`);
  expect(out.format === 'studio-yebisu-note-search-v1', `${q.id}: 検索結果の形式名が違います`);
  expect(out.query === q.query && out.tag === q.tag, `${q.id}: 検索結果の query・tag が入力のままではありません`);
  expect(isDeepStrictEqual(out.tokens, tokensOf(q.query)), `${q.id}: 区切った語（tokens）が NFKC・小文字・空白区切りの結果と違います`);
  expect(isDeepStrictEqual(out.result_ids, q.expected_ids), `${q.id}: 結果のID ${JSON.stringify(out.result_ids)} が期待 ${JSON.stringify(q.expected_ids)} と違います`);
  expect(Array.isArray(out.results) && isDeepStrictEqual(out.results.map((n) => n && n.id), out.result_ids), `${q.id}: results と result_ids の並びが一致しません`);
  const wanted = q.expected_ids.map((id) => expectedById.get(id));
  expect(isDeepStrictEqual(out.results, wanted), `${q.id}: 結果のメモの全項目が、入力ファイルから読んだ値と一致しません`);
  if (failures.length === before) entry.status = 'passed';
  return entry;
}

// 意図的に失敗させる確認。ここでの終了コード1は CLI が正しく断ったことを示し、作業の失敗ではない。
function control(id, label, result, artifactCreated) {
  const ok = result.status === 1 && result.stdout === '' && result.stderr.trim() !== '' && artifactCreated === false;
  expect(ok, `${id}（${label}）: 終了コード1・標準出力なし・理由の表示・成功の出力なし、のどれかが満たされません`);
  return { id, label, exit_code: result.status, success_artifact_created: artifactCreated, status: ok ? 'passed' : 'failed' };
}

function runControls(tmp, snapshot, builtText) {
  const controls = [];
  const caseDir = (id) => {
    const dir = path.join(tmp, id);
    mkdirSync(dir);
    return dir;
  };
  const buildCase = (id, label, args, outPath) => {
    const r = run(args);
    controls.push(control(id, label, r, existsSync(outPath)));
  };
  const searchCase = (id, label, args) => {
    const r = run(args);
    controls.push(control(id, label, r, r.stdout !== ''));
  };

  {
    const dir = caseDir('NC01');
    const name = 'N05.md';
    const text = decoder.decode(snapshot.notes.get(name));
    const nl = text.indexOf('\n');
    const broken = text.slice(0, nl).replace(/\}(\r?)$/, '$1') + text.slice(nl);
    if (broken === text) throw new Error('NC01 の壊れた入力を作れませんでした');
    const input = writeCopies(path.join(dir, 'notes'), snapshot, { [name]: Buffer.from(broken, 'utf8') });
    const out = path.join(dir, 'out', 'index.json');
    buildCase('NC01', '意図的な失敗：1行目のメタデータが閉じていないメモ（N05の写し）', ['build', '--input', input, '--out', out], out);
  }
  {
    const dir = caseDir('NC02');
    const input = writeCopies(path.join(dir, 'notes'), snapshot, { 'N09.md': snapshot.notes.get('N02.md') });
    const out = path.join(dir, 'out', 'index.json');
    buildCase('NC02', '意図的な失敗：同じid（N02）のメモが2つ', ['build', '--input', input, '--out', out], out);
  }
  {
    const out = path.join(caseDir('NC03'), 'out', 'index.json');
    buildCase('NC03', '意図的な失敗：知らない引数 --force', ['build', '--input', NOTES_DIR, '--out', out, '--force'], out);
  }
  {
    const out = path.join(caseDir('NC04'), 'out', 'index.json');
    buildCase('NC04', '意図的な失敗：必須の --input がない', ['build', '--out', out], out);
  }
  {
    const out = path.join(caseDir('NC05'), 'index.json');
    const sentinel = Buffer.from('既にあるファイル。上書きされてはいけない。\n', 'utf8');
    writeFileSync(out, sentinel, { flag: 'wx' });
    const r = run(['build', '--input', NOTES_DIR, '--out', out]);
    const kept = existsSync(out) && readFileSync(out).equals(sentinel);
    controls.push(control('NC05', '意図的な失敗：出力先が既にある（元の中身を保つ）', r, !kept));
  }
  {
    const index = path.join(caseDir('NC06'), 'index.json');
    writeFileSync(index, builtText.slice(0, Math.floor(builtText.length / 2)), { flag: 'wx' });
    searchCase('NC06', '意図的な失敗：途中で切れた索引JSON', ['search', '--index', index, '--query', '', '--tag', '']);
  }
  {
    const index = path.join(caseDir('NC07'), 'index.json');
    const parsed = JSON.parse(builtText);
    parsed.inputs_sha256['input/notes/N01.md'] = '0'.repeat(64);
    writeFileSync(index, `${JSON.stringify(parsed, null, 2)}\n`, { flag: 'wx' });
    searchCase('NC07', '意図的な失敗：inputs_sha256 とメモの source_sha256 が合わない索引', ['search', '--index', index, '--query', '', '--tag', '']);
  }
  {
    const out = path.join(caseDir('NC08'), 'out', 'index.json');
    buildCase('NC08', '意図的な失敗：知らないコマンド publish', ['publish', '--input', NOTES_DIR, '--out', out], out);
  }
  {
    const out = path.join(caseDir('NC09'), 'out', 'index.json');
    buildCase('NC09', '意図的な失敗：--input がフォルダではなくファイル', ['build', '--input', path.join(NOTES_DIR, 'N01.md'), '--out', out], out);
  }
  {
    const dir = caseDir('NC10');
    const empty = path.join(dir, 'notes');
    mkdirSync(empty);
    const out = path.join(dir, 'out', 'index.json');
    buildCase('NC10', '意図的な失敗：.md のメモが1件もないフォルダ', ['build', '--input', empty, '--out', out], out);
  }
  searchCase('NC11', '意図的な失敗：--index の値がない', ['search', '--index']);
  return controls;
}

// ---------- 後片付け ----------

function cleanup(dir) {
  if (!dir) return;
  const resolved = path.resolve(dir);
  const name = path.basename(resolved);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !name.startsWith(TEMP_PREFIX) || name.length <= TEMP_PREFIX.length) {
    failures.push('一時フォルダの場所が想定と違うため削除しませんでした');
    return;
  }
  try {
    rmSync(resolved, { recursive: true, force: false, maxRetries: 3 });
  } catch {
    failures.push('検証用の一時フォルダを削除できませんでした');
  }
}

// ---------- 本体 ----------

let tmp = null;
let noteCount = 0;
let queries = [];
let controls = [];
let integrity = false;

try {
  const snapshot = snapshotInputs();
  const before = hashesOf(snapshot);
  const expectedNotes = snapshot.names.map((name) => readExpectedNote(name, snapshot.notes.get(name)));
  expect(isDeepStrictEqual(expectedNotes.map((n) => n.id), NOTE_IDS), '入力のメモが N01〜N08 の8件ではありません');
  const expectedById = new Map(expectedNotes.map((n) => [n.id, n]));

  const queriesDoc = JSON.parse(decoder.decode(snapshot.queries));
  expect(queriesDoc.format === 'studio-yebisu-note-queries-v1' && Array.isArray(queriesDoc.queries), 'input/queries.json の形が想定と違います');
  const queryList = Array.isArray(queriesDoc.queries) ? queriesDoc.queries : [];
  expect(queryList.length === 8, `検索の入力が ${queryList.length} 問で、8問ではありません`);
  for (const q of queryList) {
    expect(q.expected_ids.every((id) => expectedById.has(id)), `${q.id} の期待IDに入力にないメモがあります`);
  }

  tmp = mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  const indexPath = path.join(tmp, 'build', 'index.json');
  const built = run(['build', '--input', NOTES_DIR, '--out', indexPath]);
  const index = checkIndex(built, indexPath, expectedNotes);
  noteCount = index && Array.isArray(index.notes) ? index.notes.length : 0;

  // 別の場所へ写した入力でも、source はファイル名から決まる同じ相対パスになる
  const copyDir = writeCopies(path.join(tmp, 'standalone', 'notes-copy'), snapshot);
  const copied = run(['build', '--input', copyDir, '--out', path.join(tmp, 'standalone', 'index.json')]);
  expect(copied.status === 0 && copied.stdout === built.stdout, '別のフォルダへ写した入力から、同じ索引を作れませんでした');

  queries = queryList.map((q) => checkQuery(q, indexPath, index, expectedById));
  controls = runControls(tmp, snapshot, built.stdout);

  const after = hashesOf(snapshotInputs());
  integrity = expect(isDeepStrictEqual(before, after), '検証の前後で固定入力（input/）の SHA-256 が変わりました') &&
    index !== null && isDeepStrictEqual(index.inputs_sha256, Object.fromEntries(Object.entries(before).filter(([k]) => k.startsWith('input/notes/'))));
} catch (err) {
  failures.push(`検証が途中で止まりました: ${err && err.message ? err.message : String(err)}`);
} finally {
  cleanup(tmp);
}

const scrub = (text) => {
  let out = text;
  if (tmp) out = out.split(tmp).join('<temp>');
  return out.split(ROOT).join('<project>');
};

const passed = failures.length === 0 && integrity && noteCount === 8 && queries.length === 8 &&
  queries.every((q) => q.status === 'passed') && controls.length > 0 && controls.every((c) => c.status === 'passed');

const report = {
  format: 'studio-yebisu-note-verification-v1',
  status: passed ? 'passed' : 'failed',
  note_count: noteCount,
  query_count: queries.length,
  queries,
  negative_controls: controls,
  source_integrity: integrity,
};
if (failures.length > 0) report.failures = failures.map(scrub);

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = passed ? 0 : 1;
