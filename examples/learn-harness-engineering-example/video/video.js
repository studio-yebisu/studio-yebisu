/* 架空の書店メモ（Learn Harness Engineering 作例）— 28秒・無音の解説映像（編集できる元ページ）
 * Canvas 2D で、時刻 t の完成した画面を毎回最初から描く。前のフレーム・壁時計・乱数には依存しない。
 * 使う素材は照合表 assets/data-hashes.json に書かれた12ファイルだけ。照合表自体を制作記録の SHA-256 で確かめ、
 * 12件の生のバイト列を照合してから描く。件数・ID・題名・本文・状態・コマンドは読み込んだファイルから取り出す。
 * 映像は保存済みの実出力と状態ファイルを編集したもので、操作の連続録画でも、講座 Project 01・02 の比較実験でもない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 28;
const POSTER_TIME = 13.5;
const LW = 1280, LH = 720; // 論理座標。実際の大きさへは等倍率で収め、余りは紙の色で埋める（別の縦横比は未確認）
const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
const evenSize = (v, fallback) => (Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0 ? v : fallback);
const WIDTH = evenSize(given.width, 1280);
const HEIGHT = evenSize(given.height, 720);
const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
window.motionConfig = {duration: DURATION, fps: FPS, width: WIDTH, height: HEIGHT, posterTime: POSTER_TIME, audioEvents: []};

const root = document.documentElement;
if (RENDER) root.classList.add('is-render');
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d', {willReadFrequently: true});
const density = RENDER ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
canvas.width = Math.round(WIDTH * density);
canvas.height = Math.round(HEIGHT * density);
canvas.style.aspectRatio = WIDTH + ' / ' + HEIGHT;
if (RENDER) {
  canvas.style.width = WIDTH + 'px';
  canvas.style.height = HEIGHT + 'px';
}

// ---- 見た目（閲覧ページ style.css と同じ、温かい白・紺・朱・緑） ------------------
const C = {
  paper: '#f6f0e4', card: '#fffcf5', ink: '#1f2433', muted: '#565c69', line: '#dcd2bf',
  navy: '#1c2d52', navy2: '#2d4579', navySoft: '#e3e8f2',
  red: '#b83d26', redSoft: '#f6ddd4', green: '#2c6449', greenSoft: '#dcebe1'
};
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Noto Sans JP", Meiryo, system-ui, sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, "BIZ UDGothic", monospace';

// ---- 素材 ------------------------------------------------------------------
// 照合表 video/assets/data-hashes.json 自体の SHA-256（runtime/frozen-reviewed-source.json の files_sha256 の値）。
// 照合表のパスは作例フォルダーからの相対。このモジュール（video/video.js）の1つ上を基準に解決するので、
// 書き出し時に <base href="video/"> が入っても同じ場所を指す。
const HASH_MANIFEST = {path: 'video/assets/data-hashes.json', sha256: '3796bdd73b59b7fca32c39355f3b8af4104e3443c5abf2cd7a2a17f1e5076134'};
const FILES = {
  'outputs/exercise-run.json': {key: 'run', kind: 'json'},
  'project/outputs/index.json': {key: 'index', kind: 'json'},
  'project/outputs/verification.json': {key: 'verification', kind: 'json'},
  'outputs/harness-created.json': {key: 'created', kind: 'json'},
  'outputs/harness-assessment.json': {key: 'assessment', kind: 'json'},
  'outputs/sessions/implementation/feature_list.json': {key: 'implFeatures', kind: 'json'},
  'outputs/sessions/resume/feature_list.json': {key: 'resumeFeatures', kind: 'json'},
  'project/session-handoff.md': {key: 'handoff', kind: 'text'},
  'project/input/queries.json': {key: 'queries', kind: 'json'},
  'video/assets/screen-manifest.json': {key: 'screens', kind: 'json'},
  'video/assets/workbench-phone.png': {key: 'phone', kind: 'png'},
  'video/assets/workbench-desktop.png': {key: 'desktop', kind: 'png'}
};
const SOURCE = {repository: 'walkinglabs/learn-harness-engineering', commit: '38ddcd2bf8d65271f668b94e7c875ca1d629d622'};
const CREATED = ['AGENTS.md', 'feature_list.json', 'progress.md', 'session-handoff.md', 'init.sh'];
const ROLES = {'AGENTS.md': '作業の決まり', 'feature_list.json': '機能と状態', 'progress.md': '進み具合', 'session-handoff.md': '引き継ぎ', 'init.sh': '標準の検証'};
const NOTE_IDS = ['N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08'];
const NOTE_FIELDS = ['body', 'id', 'source', 'source_sha256', 'tags', 'title'];
const QUERY_IDS = ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08'];
const EXPECT_IDS = {
  Q01: NOTE_IDS, Q02: ['N02', 'N07'], Q03: ['N02'], Q04: ['N01', 'N04'],
  Q05: ['N03'], Q06: [], Q07: ['N01'], Q08: ['N01', 'N04']
};
const NEGATIVE_CONTROLS = 11;
const FEATURE_IDS = ['feat-001', 'feat-002'];
const STATES_FIRST = ['in-progress', 'not-started'];
const STATES_RESUMED = ['done', 'not-started'];
const STATE_FILES = ['feature_list.json', 'progress.md', 'session-handoff.md']; // 再開セッションが更新した3つ
const SCREENS = ['workbench-phone.png', 'workbench-desktop.png'];

// 実画面の切り抜き（画像の画素座標）と置き場所。倍率は縦横同じで、画素を伸ばさず、消さず、上に文字を重ねない
const CROPS = {
  phoneResult: {img: 'phone', x: 6, y: 572, w: 352, h: 232, at: {x: 852, y: 226, s: 1.07}},    // スマホ幅：ブラウザー検索1件と N02 のカード
  queryGrid: {img: 'desktop', x: 754, y: 288, w: 438, h: 282, at: {x: 880, y: 180, s: 0.8}},  // 保存したCLIの検索記録 Q01〜Q08 の8つ
  q06Card: {img: 'desktop', x: 972, y: 428, w: 220, h: 68, at: {x: 672, y: 228, s: 1.5}}      // Q06「該当なしを確かめる」0件
};
const CONTENT_TOP = 164, CONTENT_BOTTOM = 652;

const MAIN_MESSAGE = '検証してから、続きを渡す。';
const FOOTER_SCOPE = '架空メモの実作例・実出力を編集・無音';
const FOOTER_END = '独自の小課題／比較実験ではありません';
const CTA = 'メモを試す → 実行記録を見る';
const SCENES = [
  {id: 'harness', start: 0, end: 4, headline: () => '次の作業、どこから？'},
  {id: 'notes', start: 4, end: 8, headline: f => `${f.notes.length}件のメモを、検索課題に。`},
  {id: 'and', start: 8, end: 12, headline: f => `${f.q03.tokens.join(' ＋ ')} → ${f.q03.ids.length}件`},
  {id: 'verify', start: 12, end: 18, headline: () => MAIN_MESSAGE},
  {id: 'zero', start: 18, end: 22, headline: f => `${f.q06.ids.length}件も、正しい結果。`},
  {id: 'handoff', start: 22, end: 28, headline: () => '続きを、ファイルで渡す。'}
];

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const enter = (t, at, dur = 0.45) => easeOut(prog(t, at, at + dur));
const rise = (t, at, dur = 0.45, px = 14) => px * (1 - enter(t, at, dur));
// 場面は重ねない。終わりの0.3秒で消え、次の場面は始まりの0.3秒で現れる。上の帯と足元の注記はいつも残す
const FADE = 0.3;
function sceneAlpha(t, i) {
  const s = SCENES[i];
  const a = i === 0 ? (t >= s.start ? 1 : 0) : easeInOut(prog(t, s.start, s.start + FADE));
  const b = i === SCENES.length - 1 ? 1 : 1 - easeInOut(prog(t, s.end - FADE, s.end));
  return Math.min(a, b);
}

// ---- 読み込みと確認 --------------------------------------------------------
const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
const check = (ok, message) => {
  if (!ok) throw new Error('記録の確認に失敗：' + message);
};
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return sameList(ka, kb) && ka.every(k => deepEqual(a[k], b[k]));
}

async function fetchVerified(url, label, expected) {
  let response;
  try {
    response = await fetch(url, {cache: 'no-store'});
  } catch {
    throw new Error(`${label} を読み込めません。file:// ではなくローカルサーバーで開いてください`);
  }
  if (!response.ok) throw new Error(`${label} が HTTP ${response.status} でした`);
  const bytes = await response.arrayBuffer();
  const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (digest !== expected) throw new Error(`${label} のSHA-256が制作記録と違います（${digest}）`);
  return {bytes, digest};
}
function decodeText(bytes) {
  let body = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  return body;
}
// 照合済みのバイト列だけから画像を作る（元の縦横比のまま）
async function decodePng(bytes, label) {
  try {
    return await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
  } catch {
    throw new Error(`${label} を画像として読み込めません`);
  }
}

async function loadAll() {
  const manifest = await fetchVerified(new URL('../' + HASH_MANIFEST.path, import.meta.url), HASH_MANIFEST.path, HASH_MANIFEST.sha256);
  const table = JSON.parse(decodeText(manifest.bytes));
  const hashes = table && table.files;
  check(hashes && typeof hashes === 'object' && !Array.isArray(hashes), '照合表の形');
  const listed = Object.keys(hashes).sort();
  check(sameList(listed, Object.keys(FILES).sort()), `照合表のファイル（${listed.length}件）`);
  const data = {}, verified = [];
  await Promise.all(listed.map(async path => {
    check(/^[A-Za-z0-9_\-/.]+$/.test(path) && !path.split('/').includes('..') && !path.startsWith('/'), `${path} のパス`);
    const expected = String(hashes[path]);
    check(/^[0-9a-f]{64}$/.test(expected), `${path} の照合値`);
    const {bytes, digest} = await fetchVerified(new URL('../' + path, import.meta.url), path, expected);
    const spec = FILES[path];
    if (spec.kind === 'png') data[spec.key] = await decodePng(bytes, path);
    else if (spec.kind === 'json') data[spec.key] = JSON.parse(decodeText(bytes));
    else data[spec.key] = decodeText(bytes);
    verified.push({path, digest});
  }));
  verified.sort((a, b) => a.path.localeCompare(b.path));
  check(verified.length === Object.keys(FILES).length, '照合したファイルの数');
  return {data, verified, hashes};
}

// CLI（project/src/notes.mjs の search）と同じ規則：NFKC・小文字・前後の空白を除き、Unicode の空白で区切った語を
// id・title・tags・body のどこかにすべて含むメモ。タグは同じ正規化での完全一致。点数・あいまい検索・LLM はない
const normalize = s => String(s).normalize('NFKC').toLowerCase();
const tokensOf = q => normalize(q).trim().split(/\s+/u).filter(Boolean);
function replaySearch(notes, query, tag) {
  const tokens = tokensOf(query), tagKey = normalize(tag).trim();
  return notes.filter(n => {
    if (tagKey !== '' && !n.tags.some(x => normalize(x).trim() === tagKey)) return false;
    const hay = normalize([n.id, n.title, ...n.tags, n.body].join('\n'));
    return tokens.every(k => hay.includes(k));
  }).map(n => n.id);
}

function buildFacts(d, hashes) {
  const {run, index, verification: ver, created, assessment, implFeatures, resumeFeatures, handoff, queries, screens} = d;

  // 実行の記録：固定版の原典・架空の印
  check(run.format === 'studio-yebisu-harness-exercise-v1' && run.fictional === true, '実行記録の形式と架空の印');
  check(deepEqual(run.source, SOURCE), '原典のリポジトリと固定コミット');

  // 上流の create-harness.mjs（改変なし）が実際に作った5ファイル
  check(created.format === 'studio-yebisu-harness-created-v1' && deepEqual(created.source, SOURCE), '生成記録の形式と原典');
  check(created.exit_code === 0 && /create-harness\.mjs/.test(created.command), '生成コマンドと終了コード');
  const createdNames = Object.keys(created.created_files_sha256 || {});
  check(sameList(createdNames, CREATED) && sameList(run.harness && run.harness.created_files, CREATED), '生成された5ファイルの名前');
  createdNames.forEach(name => {
    check(String(created.stdout).includes('WRITTEN ' + name) && /^[0-9a-f]{64}$/.test(created.created_files_sha256[name]), `${name} の生成記録`);
  });

  // 入力：架空の書店メモ8件（CLI の build が作った索引）と、実装前に固定した8問
  check(index.format === 'studio-yebisu-note-index-v1', '索引の形式');
  check(sameList((index.notes || []).map(n => n.id), NOTE_IDS), 'メモ8件のID');
  index.notes.forEach(n => {
    check(sameList(Object.keys(n).sort(), NOTE_FIELDS) && typeof n.title === 'string' && typeof n.body === 'string' && Array.isArray(n.tags), `${n.id} の項目`);
    check(n.source === `input/notes/${n.id}.md` && index.inputs_sha256[n.source] === n.source_sha256, `${n.id} の source と SHA-256`);
    check(run.inputs_sha256['project/' + n.source] === n.source_sha256, `${n.id} の入力SHA-256が実行記録と同じ`);
  });
  const notes = new Map(index.notes.map(n => [n.id, n]));
  check(queries.format === 'studio-yebisu-note-queries-v1' && queries.fictional === true, '問いの形式と架空の印');
  check(sameList((queries.queries || []).map(q => q.id), QUERY_IDS), '8問のID');
  queries.queries.forEach(q => check(sameList(q.expected_ids, EXPECT_IDS[q.id]), `${q.id} の期待ID`));
  check(run.inputs_sha256['project/input/queries.json'] === hashes['project/input/queries.json'], '問いのSHA-256が実行記録と同じ');

  // 保存した CLI の search の実出力：8問の結果IDと全項目
  check(sameList((run.queries || []).map(q => q.id), QUERY_IDS), '実出力の8問');
  const q = {};
  run.queries.forEach((r, i) => {
    const input = queries.queries[i], out = r.output;
    check(r.status === 'passed' && r.label === input.label, `${r.id} の状態と名前`);
    check(deepEqual(r.input, {query: input.query, tag: input.tag}), `${r.id} の入力が固定の問いと同じ`);
    check(out.format === 'studio-yebisu-note-search-v1' && out.query === input.query && out.tag === input.tag, `${r.id} の出力の形`);
    check(sameList(out.tokens, tokensOf(input.query)), `${r.id} の区切った語`);
    check(sameList(out.result_ids, input.expected_ids), `${r.id} の結果IDが期待と同じ`);
    check(sameList(out.results.map(x => x.id), out.result_ids), `${r.id} の結果の並び`);
    out.results.forEach(x => check(deepEqual(x, notes.get(x.id)), `${r.id} ${x.id} の全項目が索引と同じ`));
    check(sameList(out.result_ids, replaySearch(index.notes, input.query, input.tag)), `${r.id} の結果が検索の規則と同じ`);
    q[r.id] = {id: r.id, label: r.label, query: out.query, tag: out.tag, tokens: out.tokens, ids: out.result_ids, results: out.results, expected: input.expected_ids};
  });
  check(q.Q03.query.includes('　') && q.Q03.tokens.length === 2 && q.Q03.tag === '', 'Q03 の全角空白と2語');
  check(q.Q06.ids.length === 0 && q.Q06.expected.length === 0, 'Q06 の0件');

  // 制作担当が実行した ./init.sh の検証記録
  const rv = run.verification || {};
  check(rv.command === './init.sh' && rv.exit_code === 0 && rv.report === 'project/outputs/verification.json', '検証のコマンドと終了コード');
  check(ver.format === 'studio-yebisu-note-verification-v1' && ver.status === 'passed' && ver.source_integrity === true, '検証の記録の状態');
  check(ver.note_count === index.notes.length && rv.note_count === ver.note_count && ver.query_count === QUERY_IDS.length && rv.query_count === ver.query_count, '検証のメモ数と問い数');
  check(sameList((ver.queries || []).map(x => x.id), QUERY_IDS), '検証の8問');
  ver.queries.forEach(x => {
    check(x.status === 'passed' && sameList(x.actual_ids, x.expected_ids) && sameList(x.actual_ids, q[x.id].ids), `${x.id} の検証`);
    check(x.query === q[x.id].query && x.tag === q[x.id].tag, `${x.id} の検証の条件`);
  });
  const passed = ver.queries.filter(x => x.status === 'passed').length;
  const nc = ver.negative_controls || [];
  check(nc.length === NEGATIVE_CONTROLS && rv.negative_control_count === nc.length, '意図的な不正入力の件数');
  nc.forEach((x, i) => {
    check(x.id === 'NC' + String(i + 1).padStart(2, '0') && x.status === 'passed' && x.exit_code === 1 && x.success_artifact_created === false, `${x.id} の拒否`);
    check(typeof x.label === 'string' && x.label.startsWith('意図的な失敗'), `${x.id} の意図的な印`);
  });
  check(nc.some(x => x.label.includes('同じid')) && nc.some(x => x.label.includes('索引')), '不正入力の例（IDの重複・壊れた索引）');

  // 状態ファイル：1回目のセッションの後と、検証の後の新しい再開セッションの後
  const sessions = run.sessions || [];
  check(sessions.length === 2 && sessions[0].id === 'implementation' && sessions[1].id === 'resume', '2つのセッション');
  const first = implFeatures.features, resumed = resumeFeatures.features;
  check(deepEqual(sessions[0].features, first) && deepEqual(sessions[1].features, resumed), '状態ファイルが実行記録と同じ');
  check(sameList(first.map(x => x.id), FEATURE_IDS) && sameList(resumed.map(x => x.id), FEATURE_IDS), '機能のID');
  check(sameList(first.map(x => x.status), STATES_FIRST), '1回目の後：feat-001 in-progress・feat-002 not-started');
  check(sameList(resumed.map(x => x.status), STATES_RESUMED), '再開の後：feat-001 done・feat-002 not-started');
  first.forEach((x, i) => check(x.name === resumed[i].name && x.description === resumed[i].description, `${x.id} の名前と内容が同じ`));
  check(first[0].evidence.includes('未検証'), 'feat-001 は1回目の後に未検証');
  check(resumed[0].evidence.includes('./init.sh') && resumed[0].evidence.includes('verification.json'), 'feat-001 の完了の根拠');
  check(resumed[1].dependencies.includes('feat-001') && resumed[1].evidence === '', 'feat-002 は未着手');
  ['feat-001', '`done`', 'feat-002', '`not-started`', './init.sh', ...STATE_FILES.slice(0, 2)].forEach(s => check(handoff.includes(s), `引き継ぎに「${s}」`));

  // 構造の点検の記録は照合だけ。点数は映像に出さない（テストや効果の証拠ではない）
  check(assessment && typeof assessment.subsystems === 'object' && assessment.subsystems !== null, '構造の点検の記録の形');

  // 実画面：記録の SHA-256・大きさ、切り抜きが画像の内側で本文の範囲に収まること
  check(Array.isArray(screens.screens) && sameList(screens.screens.map(s => s.file), SCREENS), '実画面2枚の記録');
  screens.screens.forEach(s => {
    const path = 'video/assets/' + s.file, img = d[FILES[path].key];
    check(img && img.width === s.width && img.height === s.height, `${s.file} の大きさ`);
    check(s.sha256 === hashes[path], `${s.file} のSHA-256`);
  });
  for (const [name, crop] of Object.entries(CROPS)) {
    const img = d[crop.img];
    check(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= img.width && crop.y + crop.h <= img.height, `${name} の切り抜き範囲`);
    const right = crop.at.x + crop.w * crop.at.s, bottom = crop.at.y + crop.h * crop.at.s;
    check(crop.at.x >= 40 && right <= 1240.5 && crop.at.y >= CONTENT_TOP && bottom <= CONTENT_BOTTOM, `${name} の置き場所`);
  }

  // 映像に出す値（すべて読み込んだファイルから取り出す）
  return {
    img: d,
    pin: `${SOURCE.repository.split('/')[1]} ${run.source.commit.slice(0, 7)} ・ MIT`,
    created: {files: createdNames, exit: created.exit_code},
    notes: index.notes,
    queryCount: queries.queries.length,
    q03: q.Q03,
    q06: q.Q06,
    verify: {command: rv.command, exit: rv.exit_code, passed, total: ver.query_count, nc: nc.length, ncExit: nc[0].exit_code},
    first, resumed
  };
}

// ---- 描画の部品 ------------------------------------------------------------
function font(o) {
  const family = o.family === 'serif' ? SERIF : o.family === 'mono' ? MONO : SANS;
  return `${o.weight || 400} ${o.size || 32}px ${family}`;
}
function text(c, s, x, y, o = {}) {
  c.save();
  c.font = font(o);
  c.fillStyle = o.color || C.ink;
  c.textAlign = o.align || 'left';
  c.textBaseline = 'alphabetic';
  c.fillText(s, x, y);
  c.restore();
}
function measure(c, s, o) {
  c.save();
  c.font = font(o);
  const w = c.measureText(s).width;
  c.restore();
  return w;
}
// 測った幅に収まるまで1pxずつ小さくする（下限あり）
function fitSize(c, lines, maxWidth, o, min) {
  let size = o.size;
  while (size > min && lines.some(s => measure(c, s, {...o, size}) > maxWidth)) size -= 1;
  return size;
}
function fitText(c, s, x, y, maxWidth, o, min = 32) {
  const size = fitSize(c, [s], maxWidth, o, min);
  text(c, s, x, y, {...o, size});
  return measure(c, s, {...o, size});
}
const label = (c, s, x, y, o = {}) => fitText(c, s, x, y, o.max || 1184, {size: 32, weight: 600, color: C.muted, ...o});
// 日本語の折り返し：測った幅で文字ごとに折り、行頭・行末の禁則を守る
const NO_START = '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ…‥';
const NO_END = '（「『【〔〈《';
function wrapRanges(c, chars, maxWidth, o) {
  c.save();
  c.font = font(o);
  const lines = [];
  let start = 0;
  while (start < chars.length) {
    let end = start + 1;
    while (end < chars.length && c.measureText(chars.slice(start, end + 1).join('')).width <= maxWidth) end++;
    if (end < chars.length) {
      while (end - start > 1 && NO_START.includes(chars[end])) end--;
      while (end - start > 1 && NO_END.includes(chars[end - 1])) end--;
    }
    lines.push([start, end]);
    start = end;
  }
  c.restore();
  return lines;
}
// 折り返して描き、検索の語に朱の下地を敷く（閲覧ページの強調と同じ考え方。画像の外の、編集した引用）
function markedBlock(c, s, marks, x, y, maxWidth, lineHeight, o) {
  const chars = [...s];
  const on = chars.map(() => false);
  marks.forEach(m => {
    const mk = [...m];
    for (let i = 0; i + mk.length <= chars.length; i++) {
      if (mk.every((ch, j) => chars[i + j] === ch)) mk.forEach((_, j) => (on[i + j] = true));
    }
  });
  const ranges = wrapRanges(c, chars, maxWidth, o);
  ranges.forEach(([a, b], li) => {
    const by = y + li * lineHeight;
    let cx = x;
    for (let i = a; i < b;) {
      let j = i + 1;
      while (j < b && on[j] === on[i]) j++;
      const seg = chars.slice(i, j).join('');
      const w = measure(c, seg, o);
      if (on[i]) {
        roundRect(c, cx - 2, by - o.size * 0.92, w + 4, o.size * 1.18, 4);
        c.fillStyle = C.redSoft;
        c.fill();
      }
      text(c, seg, cx, by, o);
      cx += w;
      i = j;
    }
  });
  return ranges.length;
}
// 1行の中で書体や色を変えて描く。幅に収まらなければ全体を等しく小さくする（各部の下限あり）
function runs(c, segs, x, y, maxWidth, minScale = 0.8) {
  const total = segs.reduce((s, g) => s + measure(c, g.s, g.o), 0);
  const k = total > maxWidth ? Math.max(minScale, maxWidth / total) : 1;
  let cx = x;
  segs.forEach(g => {
    const o = {...g.o, size: Math.max(g.min || 32, Math.round(g.o.size * k))};
    text(c, g.s, cx, y, o);
    cx += measure(c, g.s, o);
  });
  return cx - x;
}
function roundRect(c, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}
// 紙の上の記録カード（実画面ではない。保存した記録を編集で読みやすく置いたもの）
function card(c, x, y, w, h, o = {}) {
  roundRect(c, x, y, w, h, 10);
  c.fillStyle = o.fill || C.card;
  c.fill();
  c.strokeStyle = o.stroke || C.line;
  c.lineWidth = o.lineWidth || 1.5;
  roundRect(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 10);
  c.stroke();
  if (o.bar) {
    c.fillStyle = o.bar;
    c.fillRect(x, y + 8, 5, h - 16);
  }
}
// 状態や語の札
function chip(c, s, x, y, o = {}) {
  const size = o.size || 32, h = o.h || 48, pad = o.pad || 14, weight = o.weight || 700;
  const fo = {size, weight, family: o.family};
  const w = measure(c, s, fo) + pad * 2;
  const left = o.align === 'right' ? x - w : x;
  roundRect(c, left, y, w, h, 8);
  if (o.fill) {
    c.fillStyle = o.fill;
    c.fill();
  }
  if (o.stroke) {
    c.strokeStyle = o.stroke;
    c.lineWidth = 2;
    roundRect(c, left + 1, y + 1, w - 2, h - 2, 7);
    c.stroke();
  }
  text(c, s, left + pad, y + h / 2 + size * 0.36, {...fo, color: o.color || C.ink});
  return w;
}
// 大きな数と単位
function bigCount(c, n, x, y, size, color = C.navy, unit = '件') {
  const o = {size, weight: 700};
  text(c, String(n), x, y, {...o, color});
  const w = measure(c, String(n), o);
  const uo = {size: Math.round(size * 0.3), weight: 700};
  text(c, unit, x + w + 10, y, {...uo, color});
  return w + 10 + measure(c, unit, uo);
}
// 実画面の切り抜きを、等倍率でそのまま置く（画素は変えず、文字も重ねない）
function shot(c, f, key, alpha, dy = 0) {
  if (alpha <= 0.001) return;
  const crop = CROPS[key], img = f.img[crop.img];
  const x = crop.at.x, y = crop.at.y + dy, w = crop.w * crop.at.s, h = crop.h * crop.at.s;
  c.save();
  c.globalAlpha *= alpha;
  c.save();
  c.shadowColor = 'rgba(28, 45, 82, 0.14)';
  c.shadowBlur = 16;
  c.shadowOffsetY = 5;
  roundRect(c, x, y, w, h, 8);
  c.fillStyle = C.card;
  c.fill();
  c.restore();
  c.save();
  roundRect(c, x, y, w, h, 8);
  c.clip();
  c.drawImage(img, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
  c.restore();
  roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  c.strokeStyle = C.line;
  c.lineWidth = 1;
  c.stroke();
  c.restore();
}
// 問いの文字列を枠に入れ、全角空白（U+3000）の位置に朱の下地を敷く。文字そのものは変えない
function queryBox(c, query, x, y, o) {
  const chars = ['「', ...query, '」'];
  const widths = chars.map(ch => measure(c, ch, o));
  const pad = 22, h = 80;
  const w = widths.reduce((s, v) => s + v, 0) + pad * 2;
  card(c, x, y, w, h, {stroke: C.navy, lineWidth: 2});
  let cx = x + pad;
  const base = y + h / 2 + o.size * 0.36;
  chars.forEach((ch, i) => {
    if (ch === '　') {
      roundRect(c, cx + 4, y + 16, widths[i] - 8, h - 32, 6);
      c.fillStyle = C.redSoft;
      c.fill();
      c.strokeStyle = C.red;
      c.lineWidth = 1.5;
      c.stroke();
    } else {
      text(c, ch, cx, base, {...o, color: i === 0 || i === chars.length - 1 ? C.muted : C.ink});
    }
    cx += widths[i];
  });
  return w;
}
function arrow(c, x1, x2, y, color = C.navy) {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x1, y);
  c.lineTo(x2 - 14, y);
  c.stroke();
  c.beginPath();
  c.moveTo(x2, y);
  c.lineTo(x2 - 16, y - 10);
  c.lineTo(x2 - 16, y + 10);
  c.closePath();
  c.fill();
}
const STATUS_CHIP = {
  'in-progress': {fill: C.redSoft, stroke: C.red, color: C.red},
  'done': {fill: C.green, color: '#ffffff'},
  'not-started': {fill: C.card, stroke: C.muted, color: C.muted}
};

// ---- いつも出ている枠：題名と原典、足元の範囲の注記 ---------------------------
function drawChrome(c, f) {
  text(c, 'Learn Harness Engineering 作例', 48, 38, {size: 26, weight: 700, color: C.navy});
  if (f) text(c, f.pin, 1232, 38, {size: 26, weight: 500, color: C.muted, align: 'right'});
  c.save();
  c.fillStyle = C.line;
  c.fillRect(48, 54, 1184, 1);
  c.fillRect(48, 666, 1184, 1);
  c.restore();
  text(c, FOOTER_SCOPE, 48, 706, {size: 30, weight: 700, color: C.ink});
  text(c, FOOTER_END, 1232, 706, {size: 30, weight: 700, color: C.navy, align: 'right'});
}

function drawHeadlines(c, t, f) {
  SCENES.forEach((s, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    const dy = i === 0 ? 0 : 10 * (1 - easeOut(prog(t, s.start, s.start + 0.4)));
    const line = s.headline(f);
    const o = {size: 72, weight: 700, family: 'serif', color: C.navy};
    const size = fitSize(c, [line], 1184, o, 64);
    c.save();
    c.globalAlpha = a;
    text(c, line, 48, 134 + dy, {...o, size});
    c.restore();
  });
}

// ---- 場面 ------------------------------------------------------------------
// 0〜4秒：上流の create-harness.mjs が作った5ファイル（生成記録の名前）が、ばらばらの位置から1つの束にそろう
const SCATTER = [
  {dx: -150, dy: 22, r: -0.05}, {dx: 130, dy: -16, r: 0.04}, {dx: -110, dy: 26, r: -0.03},
  {dx: 150, dy: -20, r: 0.05}, {dx: -130, dy: 14, r: -0.04}
];
function drawHarness(c, t, f, a) {
  c.globalAlpha = a * enter(t, 0.15);
  fitText(c, '始め方と、続き方をファイルに。', 48, 226 + rise(t, 0.15), 1184, {size: 52, weight: 700}, 52);

  const X = 48, W = 700, Y0 = 262, H = 68, GAP = 8;
  f.created.files.forEach((name, i) => {
    const at = 0.35 + i * 0.16;
    const e = easeOut(prog(t, at, at + 0.7)), k = 1 - e, s = SCATTER[i];
    if (e <= 0.001) return;
    c.save();
    c.globalAlpha = a * clamp01(e * 1.6);
    c.translate(X + W / 2 + s.dx * k, Y0 + i * (H + GAP) + H / 2 + s.dy * k);
    c.rotate(s.r * k);
    c.translate(-W / 2, -H / 2);
    card(c, 0, 0, W, H, {bar: C.navy});
    fitText(c, name, 28, 46, 420, {size: 40, weight: 700, family: 'mono', color: C.navy}, 32);
    text(c, ROLES[name], W - 24, 45, {size: 32, weight: 600, color: C.muted, align: 'right'});
    c.restore();
  });

  c.globalAlpha = a * enter(t, 1.3);
  fitText(c, 'create-harness.mjs', 800, 296, 432, {size: 32, weight: 700, family: 'mono', color: C.navy2}, 32);
  c.globalAlpha = a * enter(t, 1.4);
  label(c, '改変なしで実行', 800, 340, {max: 432});
  c.globalAlpha = a * enter(t, 1.5);
  bigCount(c, f.created.files.length, 800, 524 + rise(t, 1.5), 200, C.navy, 'ファイル');
  c.globalAlpha = a * enter(t, 1.7);
  label(c, `終了コード ${f.created.exit}`, 800, 590, {max: 432, color: C.green, weight: 700});
}

// 4〜8秒：CLI の build が作った索引にある架空の書店メモ8件
function drawNotes(c, t, f, a) {
  c.globalAlpha = a * enter(t, 4.1);
  label(c, 'CLIで作った索引', 48, 204, {max: 392});
  c.globalAlpha = a * enter(t, 4.2);
  bigCount(c, f.notes.length, 48, 410 + rise(t, 4.2), 200);
  c.globalAlpha = a * enter(t, 4.4);
  fitText(c, '架空の書店メモ', 48, 478 + rise(t, 4.4), 392, {size: 52, weight: 700}, 44);
  c.globalAlpha = a * enter(t, 4.55);
  label(c, '実在のお店ではありません', 48, 530, {max: 392});
  c.globalAlpha = a * enter(t, 4.7);
  label(c, `問い${f.queryCount}つは実装前に固定`, 48, 596, {max: 392, color: C.navy2, weight: 700});

  const X0 = 470, CW = 375, GX = 12, RH = 96, GY = 12, Y0 = 196;
  f.notes.forEach((n, i) => {
    const x = X0 + (i % 2) * (CW + GX), y = Y0 + Math.floor(i / 2) * (RH + GY);
    const at = 4.25 + i * 0.08;
    c.globalAlpha = a * enter(t, at, 0.4);
    const dy = rise(t, at, 0.4, 12);
    card(c, x, y + dy, CW, RH, {bar: C.navy});
    text(c, n.id, x + 22, y + 40 + dy, {size: 32, weight: 700, color: C.red});
    fitText(c, n.title, x + 22, y + 84 + dy, CW - 40, {size: 40, weight: 700}, 32);
  });
}

// 8〜12秒：Q03。全角空白で区切った2語を、両方含む N02 だけ（CLI の保存出力）
function drawAnd(c, t, f, a) {
  const q = f.q03, n = q.results[0];
  c.globalAlpha = a * enter(t, 8.1);
  label(c, `${q.id}・CLIの保存出力（AIの回答ではない）`, 48, 204, {max: 772});
  c.globalAlpha = a * enter(t, 8.2);
  queryBox(c, q.query, 48, 224 + rise(t, 8.2), {size: 52, weight: 700});

  c.globalAlpha = a * enter(t, 8.45);
  let x = 48 + label(c, '区切った語', 48, 366, {max: 200}) + 16;
  q.tokens.forEach((s, i) => {
    c.globalAlpha = a * enter(t, 8.55 + i * 0.12, 0.35);
    if (i > 0) {
      text(c, '＋', x, 368, {size: 36, weight: 700, color: C.navy});
      x += measure(c, '＋', {size: 36, weight: 700}) + 10;
    }
    x += chip(c, s, x, 326, {size: 44, h: 60, fill: C.navy, color: '#ffffff'}) + 10;
  });
  c.globalAlpha = a * enter(t, 8.75, 0.35);
  roundRect(c, x + 24, 340, 30, 30, 5);
  c.fillStyle = C.redSoft;
  c.fill();
  c.strokeStyle = C.red;
  c.lineWidth = 1.5;
  c.stroke();
  label(c, '＝全角空白', x + 64, 366, {max: 820 - x - 64, color: C.red, weight: 700});

  c.globalAlpha = a * enter(t, 8.9);
  label(c, 'NFKCで空白をそろえ、2語とも含むメモだけ', 48, 430, {max: 772, color: C.navy2, weight: 700});

  c.globalAlpha = a * enter(t, 9.1);
  const dy = rise(t, 9.1);
  card(c, 48, 452 + dy, 772, 184, {bar: C.navy});
  const idw = measure(c, n.id, {size: 32, weight: 700});
  text(c, n.id, 72, 504 + dy, {size: 32, weight: 700, color: C.red});
  fitText(c, n.title, 72 + idw + 16, 506 + dy, 772 - idw - 64, {size: 52, weight: 700}, 44);
  markedBlock(c, n.body, q.tokens, 72, 556 + dy, 724, 44, {size: 32, weight: 500, color: C.ink});

  c.globalAlpha = a * enter(t, 8.5);
  label(c, '実画面（スマホ表示）', 852, 204, {max: 380});
  c.globalAlpha = a;
  shot(c, f, 'phoneResult', enter(t, 8.6), rise(t, 8.6));
  c.globalAlpha = a * enter(t, 8.8);
  label(c, `閲覧ページの検索も ${q.ids.join('・')}`, 852, 520, {max: 380, color: C.ink, weight: 700});
}

// 12〜18秒：制作担当の ./init.sh で8問が期待どおり → その後に新しいセッションが feat-001 を done に。
// ポスターは13.5秒（13.4秒までに全要素が着地）
function drawVerify(c, t, f, a) {
  const v = f.verify;
  c.globalAlpha = a * enter(t, 12.35);
  const big = `${v.passed}/${v.total}`;
  const bo = {size: 150, weight: 700};
  text(c, big, 48, 340 + rise(t, 12.35), {...bo, color: C.green});
  const tx = Math.max(320, 48 + measure(c, big, bo) + 36), tw = 860 - tx;
  c.globalAlpha = a * enter(t, 12.45);
  fitText(c, `${v.total}問とも期待どおり`, tx, 252 + rise(t, 12.45), tw, {size: 52, weight: 700}, 44);
  c.globalAlpha = a * enter(t, 12.55);
  runs(c, [
    {s: v.command, o: {size: 40, weight: 700, family: 'mono', color: C.navy}},
    {s: `  終了コード ${v.exit}`, o: {size: 36, weight: 700, color: C.muted}}
  ], tx, 316, tw, 0.9);
  c.globalAlpha = a * enter(t, 12.65);
  label(c, '制作担当が実行・passed', tx, 370, {max: tw, color: C.green, weight: 700});

  c.globalAlpha = a;
  shot(c, f, 'queryGrid', enter(t, 12.4), rise(t, 12.4));
  c.globalAlpha = a * enter(t, 12.7);
  label(c, '実画面：保存した8問', 1232, 436, {max: 352, align: 'right'});

  const f1 = f.first[0], f2 = f.resumed[0];
  c.globalAlpha = a * enter(t, 12.25);
  runs(c, [
    {s: f1.id + ' ', o: {size: 32, weight: 700, family: 'mono', color: C.navy2}},
    {s: f1.name, o: {size: 32, weight: 700, color: C.ink}}
  ], 48, 446, 760, 1);

  const Y = 466, H = 178, W = 340, XS = [48, 470, 892];
  const nodes = [
    {at: 12.3, label: '1回目のセッション後', chip: f1.status, jp: '作業中・未検証', jpColor: C.red},
    {at: 12.6, label: '制作担当が実行', chip: v.command, chipStyle: {fill: C.navy, color: '#ffffff'}, jp: `検証 ${v.passed}/${v.total}`, jpColor: C.navy},
    {at: 12.95, label: '新しい再開セッション', chip: f2.status, jp: '完了・根拠つき', jpColor: C.green}
  ];
  nodes.forEach((nd, i) => {
    const e = enter(t, nd.at), dy = rise(t, nd.at);
    if (i > 0) {
      c.globalAlpha = a * e;
      arrow(c, XS[i - 1] + W + 12, XS[i] - 12, Y + H / 2);
    }
    c.globalAlpha = a * e;
    const x = XS[i], y = Y + dy;
    card(c, x, y, W, H, {stroke: i === 2 ? C.green : C.line, lineWidth: i === 2 ? 2 : 1.5});
    fitText(c, nd.label, x + 20, y + 40, W - 40, {size: 32, weight: 600, color: C.muted}, 32);
    chip(c, nd.chip, x + 20, y + 56, {size: 34, h: 50, family: 'mono', ...(nd.chipStyle || STATUS_CHIP[nd.chip])});
    fitText(c, nd.jp, x + 20, y + 150, W - 40, {size: 40, weight: 700, color: nd.jpColor}, 32);
  });
}

// 18〜22秒：Q06 は正しい0件。わざと壊した入力を CLI が断る確認は、別に記録した
function drawZero(c, t, f, a) {
  const q = f.q06, v = f.verify;
  c.globalAlpha = a * enter(t, 18.1);
  label(c, `${q.id}・CLIの保存出力`, 48, 204, {max: 572});
  c.globalAlpha = a * enter(t, 18.2);
  queryBox(c, q.query, 48, 224 + rise(t, 18.2), {size: 52, weight: 700});
  c.globalAlpha = a * enter(t, 18.35);
  bigCount(c, q.ids.length, 48, 480 + rise(t, 18.35), 200);
  c.globalAlpha = a * enter(t, 18.55);
  fitText(c, '入力に一致するメモなし', 48, 548, 572, {size: 40, weight: 700}, 36);
  c.globalAlpha = a * enter(t, 18.7);
  label(c, `期待も${q.expected.length}件・passed`, 48, 600, {max: 572, color: C.green, weight: 700});

  c.globalAlpha = a * enter(t, 18.6);
  c.fillStyle = C.line;
  c.fillRect(648, 180, 1, 460);

  c.globalAlpha = a * enter(t, 18.75);
  label(c, `実画面：閲覧ページの${q.id}`, 672, 204, {max: 560});
  c.globalAlpha = a;
  shot(c, f, 'q06Card', enter(t, 18.8), rise(t, 18.8));
  c.globalAlpha = a * enter(t, 19.0);
  fitText(c, 'わざと壊した入力', 672, 400, 560, {size: 40, weight: 700}, 36);
  c.globalAlpha = a * enter(t, 19.1);
  fitText(c, `${v.nc}件とも拒否`, 672, 466 + rise(t, 19.1), 560, {size: 52, weight: 700, color: C.navy}, 44);
  c.globalAlpha = a * enter(t, 19.25);
  label(c, `終了コード${v.ncExit}・成功の出力なし`, 672, 516, {max: 560});
  c.globalAlpha = a * enter(t, 19.35);
  label(c, '例：IDの重複・壊れた索引', 672, 562, {max: 560});
}

// 22〜28秒：新しい再開セッションが保存記録を読み、状態ファイル3つだけを更新。25秒以降は案内を止めて読む
function drawHandoff(c, t, f, a) {
  c.globalAlpha = a * enter(t, 22.1);
  label(c, '新しい Opus 5.5 セッション', 48, 204, {max: 640});
  c.globalAlpha = a * enter(t, 22.2);
  fitText(c, `記録を読み、${STATE_FILES.length}ファイルだけ更新`, 48, 258 + rise(t, 22.2), 640, {size: 40, weight: 700}, 36);
  STATE_FILES.forEach((name, i) => {
    const at = 22.3 + i * 0.1, y = 316 + i * 56;
    c.globalAlpha = a * enter(t, at, 0.4);
    const dy = rise(t, at, 0.4, 10);
    c.fillStyle = C.navy;
    c.fillRect(48, y - 24 + dy, 10, 10);
    fitText(c, name, 72, y + dy, 616, {size: 44, weight: 700, family: 'mono', color: C.navy}, 32);
  });
  c.globalAlpha = a * enter(t, 22.65);
  label(c, 'コードと入力は変更なし', 48, 490, {max: 640, size: 36, color: C.green, weight: 700});

  f.resumed.forEach((x, i) => {
    const at = 22.45 + i * 0.15, y = 222 + i * 126 + rise(t, at);
    c.globalAlpha = a * enter(t, at);
    card(c, 724, y, 508, 112, {bar: x.status === 'done' ? C.green : C.line});
    text(c, x.id, 748, y + 42, {size: 32, weight: 700, family: 'mono', color: C.muted});
    chip(c, x.status, 1212, y + 14, {size: 28, h: 42, family: 'mono', align: 'right', ...STATUS_CHIP[x.status]});
    fitText(c, x.name, 748, y + 94, 460, {size: 40, weight: 700}, 32);
  });

  const next = f.resumed[1];
  c.globalAlpha = a * enter(t, 22.95);
  fitText(c, `次の ${next.id} は未着手。ここまでを引き継ぐ。`, 48, 556 + rise(t, 22.95), 1184, {size: 52, weight: 700, color: C.navy}, 44);

  // 最後の3秒：閲覧ページへの案内を止めて読む
  const kc = enter(t, 24.55);
  if (kc > 0.001) {
    c.globalAlpha = a * kc;
    roundRect(c, 32, 588, 1216, 64, 10);
    c.fillStyle = C.navySoft;
    c.fill();
    c.fillStyle = C.navy;
    c.fillRect(32, 588, 6, 64);
    fitText(c, CTA, 56, 638, 1160, {size: 52, weight: 700, color: C.navy}, 44);
  }
}

const DRAW = [drawHarness, drawNotes, drawAnd, drawVerify, drawZero, drawHandoff];

// ---- 1フレームを描く --------------------------------------------------------
let facts = null;
let failure = null;
let currentT = 0;

function render(t) {
  canvas.width = canvas.width; // 前のフレームの変換・クリップ・状態をすべて捨てる
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / LW, canvas.height / LH);
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - LW * scale) / 2, (canvas.height - LH * scale) / 2);
  ctx.beginPath();
  ctx.rect(0, 0, LW, LH);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawChrome(ctx, facts);
  if (!facts) {
    const message = failure ? '読み込みに失敗しました。代わりの映像は出しません。' : '保存済みのファイルと実画面を確かめています…';
    text(ctx, message, 48, 300, {size: 36, weight: 700, color: failure ? '#8c1d18' : C.muted});
    if (failure) {
      const o = {size: 32, color: C.ink};
      wrapRanges(ctx, [...failure.message], 1184, o).slice(0, 6).forEach(([a, b], i) => {
        text(ctx, [...failure.message].slice(a, b).join(''), 48, 356 + i * 44, o);
      });
    }
    return;
  }
  drawHeadlines(ctx, t, facts);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, CONTENT_TOP, LW, CONTENT_BOTTOM + 8 - CONTENT_TOP);
  ctx.clip();
  DRAW.forEach((draw, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    ctx.save();
    draw(ctx, t, facts, a);
    ctx.restore();
  });
  ctx.restore();
}

const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');
const verifiedEl = document.getElementById('verified');
function setStatus(state, message, detail = '') {
  root.dataset.motionStatus = state;
  if (statusEl) {
    statusEl.dataset.state = state;
    statusEl.textContent = message;
  }
  if (detailEl) detailEl.textContent = detail;
}
const clampTime = v => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(DURATION, Math.max(0, n)) : 0;
};

render(0);
setStatus('loading', '保存済みのファイルと実画面を確かめています…');

window.motionReady = (async () => {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('この環境ではSHA-256を確かめられません。http://127.0.0.1 などのローカルサーバーで開いてください');
  }
  const fontSpecs = [`700 72px ${SERIF}`, `700 200px ${SANS}`, `700 52px ${SANS}`, `600 32px ${SANS}`, `700 40px ${MONO}`];
  if (document.fonts && document.fonts.load) {
    await Promise.all(fontSpecs.map(spec => document.fonts.load(spec, '次の作業検証してから続きを渡す架空書店メモ読書会土曜全角空白完了8/8 feature_list.json')));
    await document.fonts.ready;
  }
  const {data, verified, hashes} = await loadAll();
  const built = buildFacts(data, hashes);
  facts = built;
  render(currentT);
  setStatus('ready', `照合した${verified.length}ファイルから描いています`,
    `架空メモ${built.notes.length}件と問い${built.queryCount}つ、CLIの保存出力${built.verify.total}問の結果IDと全項目、` +
    `検証の記録（${built.verify.passed}/${built.verify.total}・意図的な不正入力${built.verify.nc}件）、2つの時点の状態ファイル、引き継ぎ、実画面2枚を確かめました。` +
    'ページでも映像でも Node・CLI・AI は動きません。');
  if (verifiedEl) {
    verifiedEl.replaceChildren(...verified.map(v => {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = v.path;
      li.append(code, ` — SHA-256 ${v.digest.slice(0, 12)}…`);
      return li;
    }));
    verifiedEl.hidden = false;
  }
  return true;
})().catch(error => {
  failure = error;
  render(currentT);
  setStatus('error', '読み込みに失敗しました：' + error.message, '代わりの映像は出しません。ファイルを確かめてから再読み込みしてください。');
  throw error;
});
window.motionReady.catch(() => {});

// 任意の時刻の完成した画面を描く。呼んだ順番や壁時計には依存しない
window.seek = seconds => {
  const t = clampTime(seconds);
  currentT = t;
  return window.motionReady.then(() => {
    render(t);
    return t;
  });
};

// ---- 編集用のプレビュー（書き出し時は何も動かさない） --------------------------
// 自動では再生しない（動きを減らす設定でも同じく停止から始まる）。再生は「再生」を押したときだけ
function setupPreview() {
  const play = document.getElementById('play');
  const range = document.getElementById('time');
  const clock = document.getElementById('clock');
  const reload = document.getElementById('reload');
  let playing = false, raf = 0, from = 0, startedAt = 0;
  const sec = v => v.toFixed(1) + '秒';

  function sync() {
    range.value = (Math.round(currentT * 10) / 10).toFixed(1);
    range.setAttribute('aria-valuetext', `${sec(currentT)}（全${DURATION}秒）`);
    clock.textContent = `${sec(currentT)} / ${sec(DURATION)}`;
    play.textContent = playing ? '一時停止' : '再生';
    play.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
  function tick(now) {
    if (!playing) return;
    const t = Math.min(DURATION, from + (now - startedAt) / 1000);
    currentT = t;
    render(t);
    if (t >= DURATION) {
      playing = false;
      raf = 0;
    } else {
      raf = requestAnimationFrame(tick);
    }
    sync();
  }
  function start() {
    if (!facts || playing) return;
    if (currentT >= DURATION - 0.05) currentT = 0;
    from = currentT;
    startedAt = performance.now();
    playing = true;
    raf = requestAnimationFrame(tick);
    sync();
  }
  function stop() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    sync();
  }
  function jump(t) {
    stop();
    currentT = clampTime(t);
    if (facts) render(currentT);
    sync();
  }

  play.addEventListener('click', () => (playing ? stop() : start()));
  // 矢印キーはスライダー標準（0.1秒）。Home・End は先頭・末尾、PageUp・PageDown は2秒ずつ（Home から7回で14秒）
  range.addEventListener('input', () => jump(Number(range.value)));
  range.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const moves = {Home: () => 0, End: () => DURATION, PageUp: () => currentT + 2, PageDown: () => currentT - 2};
    if (Object.hasOwn(moves, event.key)) {
      event.preventDefault();
      jump(Math.round(moves[event.key]() * 10) / 10);
    }
  });
  reload.addEventListener('click', () => location.reload());
  window.motionReady.then(() => {
    play.disabled = false;
    range.disabled = false;
    sync();
  }, () => {
    reload.hidden = false;
  });
}
if (!RENDER) setupPreview();
