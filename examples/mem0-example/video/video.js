/* 好みを覚えて、次に引き出す（Mem0 OSS 作例）— 28秒・無音の解説映像（編集できる元ページ）
 * Canvas 2D で、時刻 t の完成した画面を毎回最初から描く。前のフレーム・壁時計・乱数には依存しない。
 * 使う素材は照合表 assets/data-hashes.json に書かれた8ファイルだけ。照合表自体を制作記録の SHA-256 で確かめ、
 * 8件の生のバイト列を照合してから描く。件数・問い・絞り込み・本文の抜粋・秒数・ID は、読み込んだファイルから取り出す。
 * 映像は保存済みの実結果と実画面の静止画を編集したもので、APIの実行や操作の録画ではない。ブラウザーで Mem0・Python・AI は動かない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 28;
const POSTER_TIME = 13.5;
const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
const evenSize = (v, fallback) => (Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0 ? v : fallback);
const WIDTH = evenSize(given.width, 1280);
const HEIGHT = evenSize(given.height, 720);
const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
window.motionConfig = {duration: DURATION, fps: FPS, width: WIDTH, height: HEIGHT, posterTime: POSTER_TIME, audioEvents: []};

// 論理座標：1280×720 の構図を基準に、渡された縦横比へ短い辺を合わせて広げる。
// 上の帯と足元の帯は実際の端に置き、本文はその間の中央に置く（1280×720 以外は未確認）
const LW = Math.max(1280, Math.round(720 * WIDTH / HEIGHT));
const LH = Math.max(720, Math.round(1280 * HEIGHT / WIDTH));
const OX = (LW - 1280) / 2, OY = (LH - 720) / 2;

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

// ---- 見た目（閲覧ページ style.css と同じ、アイボリー・紺・コバルト・ティール） --------
const C = {
  ivory: '#f7f3ea', paper: '#fffdf8', navy: '#14213d', soft: '#3d4a66', line: '#d8d0bf',
  cobalt: '#2747c4', cobaltSoft: '#e7ebfa', teal: '#0d6e66', tealSoft: '#e2f1ee', rose: '#9d2b3c'
};
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, system-ui, sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", serif';
const MONO = 'ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, "Liberation Mono", monospace';

// ---- 素材 ------------------------------------------------------------------
// 照合表 video/assets/data-hashes.json 自体の SHA-256（runtime/frozen-reviewed-source.json の files_sha256 の値）。
// パスは作例フォルダーからの相対。このモジュール（video/video.js）の1つ上を基準に解決するので、
// 書き出し時に <base href="video/"> が入っても同じ場所を指す。
const HASH_MANIFEST = {path: 'video/assets/data-hashes.json', sha256: 'eea89cbc9568b1df3754abf816e3d840157f3d4463298e9c1df0dbe09c213122'};
const FILES = {
  'outputs/memory-run.json': {key: 'run', kind: 'json'},
  'outputs/independent-checks.json': {key: 'independent', kind: 'json'},
  'input/memories.json': {key: 'memories', kind: 'json'},
  'input/scenarios.json': {key: 'scenarios', kind: 'json'},
  'input/model-source.json': {key: 'modelSource', kind: 'json'},
  'video/assets/screen-manifest.json': {key: 'screens', kind: 'json'},
  'video/assets/workbench-phone.png': {key: 'phone', kind: 'png'},
  'video/assets/workbench-desktop.png': {key: 'desktop', kind: 'png'}
};
const INPUTS = ['input/memories.json', 'input/model-source.json', 'input/scenarios.json'];
const SOURCE = {repository: 'mem0ai/mem0', commit: '0724291bd864cf807e88ee8981c8226644e8fb42', version: '2.2.1', license: 'Apache-2.0'};
const MODEL = {repository: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', commit: 'e8f8c211226b894fcb81acc59f3b34ba3efd5f42', license: 'Apache-2.0'};
// 照合にだけ使う期待値。映像に出す数・文は、読み込んだファイルの値
const EXPECT = {
  sourceFiles: 156, modelFiles: 11, dims: 384, rows: 7, users: ['aya', 'ken'],
  history: {ADD: 7, UPDATE: 1, DELETE: 1}, activePoints: 6, rankings: ['M02', 'M03', 'M04', 'M05', 'M07']
};
const IDS = ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08'];
const SCREENS = [{file: 'workbench-phone.png', scenario: 'M05'}, {file: 'workbench-desktop.png', scenario: 'M02'}];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// 実画面の切り抜き（画像の画素座標）と置き場所。倍率1で置き、画素を伸ばさず、消さず、上に文字を重ねない
const CROPS = {
  // スマホ幅・M05：「出力」の見出し、更新前（20秒）と更新後（30秒）のカード
  phoneUpdate: {img: 'phone', x: 22, y: 237, w: 322, h: 435, at: {x: 910, y: 172, s: 1}},
  // 広い幅・M02：「8場面・照合済み」と M01〜M08 の8つのボタン
  desktopScenes: {img: 'desktop', x: 80, y: 306, w: 1092, h: 168, at: {x: 94, y: 330, s: 1}}
};
const CONTENT_TOP = 152, CONTENT_BOTTOM = 664;

const MAIN_MESSAGE = '好みを覚えて、次に引き出す。';
const FOOTER_LEFT = '実行記録と実画面を編集・無音';
const SCOPE_NOTE = 'user_id は検索範囲の指定です。認証ではありません。';
const REOPEN_NOTE = '更新した本文が、同じIDのまま保存先に残っている。';
const AUTHORSHIP = '映像・コード・文章：Claude Opus 5.5 ／ ベクトル：埋め込みモデル（CPU）';
const CREDIT = `${DURATION}秒・無音／実行記録を編集`;
const SCENES = [
  {id: 'opening', start: 0, end: 4, headline: () => MAIN_MESSAGE},
  {id: 'save', start: 4, end: 8, headline: f => `${f.users.length}人の好みを、別々に保存。`},
  {id: 'search', start: 8, end: 12, headline: () => '同じ問いでも、返る記録は別。'},
  {id: 'update', start: 12, end: 18, headline: () => '好みが変わったら、書き換える。'},
  {id: 'reopen', start: 18, end: 22, headline: f => `開き直しても、${f.update.after}秒のまま。`},
  {id: 'ending', start: 22, end: 28, headline: f => `${f.samples}つの実結果を、サイトで読む。`}
];

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const enter = (t, at, dur = 0.45) => easeOut(prog(t, at, at + dur));
const rise = (t, at, dur = 0.45, px = 14) => px * (1 - enter(t, at, dur));
// 場面は重ねない。終わりの0.25秒で紙の色へ消え、次の場面は始まりの0.25秒で現れる（境目に約0.5秒の静かな間）
const FADE = 0.25;
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
function decodeText(bytes, label) {
  let body;
  try {
    body = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    throw new Error(`${label} がUTF-8として読めません`);
  }
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  return body;
}
function parseJson(bytes, label) {
  try {
    return JSON.parse(decodeText(bytes, label));
  } catch (error) {
    throw new Error(`${label} をJSONとして読めません（${error.message}）`);
  }
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
  // 照合表は、生のバイト列の SHA-256 を確かめてから JSON として読む
  const manifest = await fetchVerified(new URL('../' + HASH_MANIFEST.path, import.meta.url), HASH_MANIFEST.path, HASH_MANIFEST.sha256);
  const table = parseJson(manifest.bytes, HASH_MANIFEST.path);
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
    else data[spec.key] = parseJson(bytes, path);
    verified.push({path, digest});
  }));
  verified.sort((a, b) => a.path.localeCompare(b.path));
  check(verified.length === Object.keys(FILES).length, '照合したファイルの数');
  return {data, verified, hashes, manifestDigest: manifest.digest};
}

// 本文から取り出す句。規則は固定し、文字そのものは記録から取る
// 動画の好みの句：「、」「。」を含まない、「N秒程度の動画」で終わる部分（例：音声なし・20秒程度の動画）
const VIDEO_PHRASE = /[^、。]*\d+秒程度の動画/;
function phraseOf(text, label) {
  const m = typeof text === 'string' ? text.match(VIDEO_PHRASE) : null;
  check(m && m[0].length > 0 && text.includes(m[0]), `${label} の動画の好みの句`);
  return m[0];
}
function secondsOf(text, label) {
  const all = [...String(text).matchAll(/(\d+)秒/g)];
  check(all.length === 1, `${label} の秒数がひとつ`);
  return Number(all[0][1]);
}
// 検索結果の抜粋：最後の「、」の後（なければ「〇〇さんは」の後）から文末まで。先頭を省いたら「…」を付けて描く
function clauseExcerpt(text, label) {
  const i = text.lastIndexOf('、');
  const body = i >= 0 ? text.slice(i + 1) : text.replace(/^[^、。]*?さんは/, '');
  check(body.length > 0 && text.endsWith(body), `${label} の抜粋`);
  return {body, cut: body !== text, display: (body !== text ? '…' : '') + body};
}
const shortId = id => `${id.slice(0, 8)}…${id.slice(-6)}`;
const searchCall = s => ({query: s.query, filters: s.filters, top_k: s.top_k, threshold: s.threshold, explain: s.explain});

function buildFacts(d, hashes) {
  const {run, independent: ind, memories: mem, scenarios: sc, modelSource: ms, screens} = d;

  // 原典：固定コミット・2.2.1・Apache-2.0、156ファイルを照合し実行後も無改変
  check(run && run.format === 'studio-yebisu-mem0-run-v1', '実行記録の形式');
  const src = run.source || {}, rc = run.checks || {};
  check(src.repository === SOURCE.repository && src.commit === SOURCE.commit && src.version === SOURCE.version && src.license === SOURCE.license, '原典の固定版（mem0ai/mem0 0724291・2.2.1・Apache-2.0）');
  check(src.files_verified === EXPECT.sourceFiles && rc.source_files_verified === EXPECT.sourceFiles && rc.vendor_unchanged_after_run === true, `原典${EXPECT.sourceFiles}ファイルの照合と無改変`);

  // 埋め込みモデル：固定コミット e8f8c21・384次元・CPU・11ファイル（LLMではない）
  const model = run.model || {};
  check(model.repository === MODEL.repository && model.commit === MODEL.commit && model.license === MODEL.license &&
    ms.repository === MODEL.repository && ms.commit === MODEL.commit, '埋め込みモデルの固定版');
  check(model.dimensions === EXPECT.dims && ms.dimensions === EXPECT.dims && rc.vector_dimensions === EXPECT.dims && model.device === 'cpu', `${EXPECT.dims}次元・CPU`);
  check(model.files_verified === EXPECT.modelFiles && rc.model_files_verified === EXPECT.modelFiles && Array.isArray(ms.files) && ms.files.length === EXPECT.modelFiles, `モデル${EXPECT.modelFiles}ファイル`);

  // infer=False・LLM 0回・実行中の通信0件・確認すべて通過・別プロセス
  const cfg = run.config || {}, net = run.network || {};
  check(cfg.infer === false && cfg.telemetry === false && cfg.network_blocked === true, 'infer=False・送信停止・通信拒否');
  check(cfg.memory_facts && cfg.memory_facts.llm_called === false && rc.llm_calls === 0, 'LLMを呼んでいない');
  check(net.total_attempts === 0 && sameList(net.parent_attempts, []) && sameList(net.worker_attempts, []) && rc.network_attempts === 0, '実行中の通信の試み0件');
  check(rc.passed === true, '実行記録の確認がすべて通過');
  check(run.worker && run.worker.exit_code === 0 && run.worker.fresh_process === true, '別プロセスでの読み直し');

  // 実行の前に固定した入力3つ：実行記録の SHA-256 と、照合表の値が同じ
  check(sameList(Object.keys(run.input_sha256 || {}).sort(), INPUTS), '実行記録の入力の一覧');
  INPUTS.forEach(p => check(run.input_sha256[p] === hashes[p], `${p} のSHA-256が実行記録と同じ`));

  // 架空の好み7件と2人
  const rows = mem.memories;
  check(mem.fictional === true && Array.isArray(rows) && rows.length === EXPECT.rows, `架空の好み${EXPECT.rows}件`);
  const users = [...new Set(rows.map(r => r.user_id))];
  check(sameList(users, EXPECT.users), '架空の2人（aya・ken）');
  const rowByKey = Object.fromEntries(rows.map(r => [r.key, r]));
  check(Object.keys(rowByKey).length === rows.length, '好みのキーが重複しない');

  // 8場面：実結果が M01〜M08 の順で、ラベルと操作が固定の場面と同じ
  const scen = sc.scenarios;
  check(Array.isArray(scen) && sameList(scen.map(s => s.id), IDS), '場面 M01〜M08');
  check(Array.isArray(run.samples) && sameList(run.samples.map(s => s && s.id), IDS), '実結果8件');
  const S = {}, P = {};
  run.samples.forEach((s, i) => {
    const p = scen[i];
    check(s.label === p.label && s.operation === p.operation && s.input && s.output, `${s.id} のラベルと操作が固定の場面と同じ`);
    S[s.id] = s;
    P[p.id] = p;
  });

  // M01：7回の add（infer=False）がすべて入力の本文どおり1件の ADD。get_all は利用者ごとに保存した本文
  const m01 = S.M01, o1 = m01.output;
  check(P.M01.infer === false && Array.isArray(m01.input.calls) && m01.input.calls.length === rows.length, 'M01 の呼び出し7件');
  check(Array.isArray(o1.responses) && o1.responses.length === rows.length && o1.memory_ids, 'M01 の応答7件');
  rows.forEach((r, i) => {
    const call = m01.input.calls[i], res = o1.responses[i];
    check(call.key === r.key && call.messages === r.text && call.user_id === r.user_id && deepEqual(call.metadata, r.metadata) && call.infer === false, `M01 ${r.key} の入力が固定の好みと同じ`);
    const out = res && res.key === r.key && res.response && Array.isArray(res.response.results) && res.response.results.length === 1 ? res.response.results[0] : null;
    check(out && out.event === 'ADD' && out.memory === r.text && UUID.test(out.id) && o1.memory_ids[r.key] === out.id, `M01 ${r.key} が本文どおり1件の ADD`);
  });
  check(rc.adds === rows.length && rc.add_events_all_add === true, 'M01 の ADD 7件');
  const ids = o1.memory_ids;
  const listing = {};
  users.forEach(u => {
    const listed = o1.get_all && o1.get_all[u] && o1.get_all[u].response && o1.get_all[u].response.results;
    const mine = rows.filter(r => r.user_id === u);
    check(Array.isArray(listed) && listed.length === mine.length, `M01 ${u} の一覧の件数`);
    check(listed.every(x => x.user_id === u && mine.some(r => ids[r.key] === x.id && r.text === x.memory && deepEqual(r.metadata, x.metadata))), `M01 ${u} の一覧が保存した本文と同じ`);
    check(rc.scope_counts && rc.scope_counts[u] === listed.length, `M01 ${u} の件数が実行記録と同じ`);
    listing[u] = listed;
  });

  // M02・M03：同じ問いを user_id だけ変えて検索。返った記録はすべてその利用者の保存した本文
  const searches = ['M02', 'M03'].map(id => {
    const s = S[id], p = P[id], u = p.filters && p.filters.user_id;
    check(deepEqual(s.input.call, searchCall(p)), `${id} の検索条件が固定の場面と同じ`);
    const results = s.output.response && s.output.response.results;
    check(Array.isArray(results) && results.length > 0 && results.length <= p.top_k, `${id} の結果の件数`);
    results.forEach(x => {
      const key = x.metadata && x.metadata.source_key, r = rowByKey[key];
      check(x.user_id === u && r && r.user_id === u && ids[key] === x.id && r.text === x.memory, `${id} の結果が ${u} の保存した記録`);
    });
    check(sameList(s.output.result_keys, results.map(x => x.metadata.source_key)), `${id} の結果のキー`);
    check(s.output.checks && s.output.checks.overlap_with_other_user === 0, `${id} がもう1人の記録と重ならない`);
    const first = results[0];
    return {id, filters: p.filters, user: u, key: first.metadata.source_key, excerpt: clauseExcerpt(first.memory, `${id} の1件目`), count: results.length};
  });
  check(S.M02.input.call.query === S.M03.input.call.query, 'M02 と M03 は同じ問い');

  // M05：実行スクリプトが Memory.update を明示的に呼び、同じIDのまま秒数だけ変わる
  const m05 = S.M05, p5 = P.M05, o5 = m05.output, target = rowByKey[p5.key];
  check(target && m05.input.key === p5.key && m05.input.memory_id === ids[p5.key] && m05.input.update_call &&
    m05.input.update_call.memory_id === ids[p5.key] && m05.input.update_call.text === p5.text, 'M05 の対象と新しい本文が固定の場面と同じ');
  check(o5.before && o5.after && o5.before.id === ids[p5.key] && o5.after.id === ids[p5.key], 'M05 の更新前後で同じID');
  check(o5.before.memory === target.text && o5.after.memory === p5.text && o5.after.created_at === o5.before.created_at, 'M05 の更新前後の本文');
  check(Array.isArray(o5.history) && sameList(o5.history.map(h => h.event), ['ADD', 'UPDATE']) &&
    o5.history[1].old_memory === target.text && o5.history[1].new_memory === p5.text, 'M05 の履歴 ADD・UPDATE');
  check(o5.checks && o5.checks.explicit_update_by_wrapper === true, 'M05 は明示的な update');
  const r5 = o5.search_response && o5.search_response.results;
  check(Array.isArray(r5) && r5.length > 0 && r5[0].id === ids[p5.key] && r5[0].memory === p5.text, 'M05 の更新後の検索');
  const before = secondsOf(target.text, `${p5.key} 更新前`), after = secondsOf(p5.text, `${p5.key} 更新後`);
  check(before !== after && target.text.replace(`${before}秒`, `${after}秒`) === p5.text, 'M05 で変わったのは秒数だけ');

  // M06：削除は有効な取得・一覧から外す操作。履歴には ADD・DELETE と削除前の本文が残る（物理消去は未確認）
  const m06 = S.M06, p6 = P.M06, o6 = m06.output;
  check(m06.input.memory_id === ids[p6.key] && o6.after === null && Array.isArray(o6.history) &&
    sameList(o6.history.map(h => h.event), ['ADD', 'DELETE']) && o6.checks && o6.checks.history_retains_deleted_text === true &&
    o6.checks.physical_erasure_verified === false, 'M06 の削除と残る履歴');

  // M07：保存先を閉じ、新しいプロセスで同じ検索。1件目が更新後の本文・同じID
  const m07 = S.M07, p7 = P.M07, o7 = m07.output;
  check(deepEqual(m07.input.search_call, searchCall(p7)) && m07.input.process === 'fresh', 'M07 の検索条件が固定の場面と同じ');
  check(o7.worker && o7.worker.exit_code === 0 && o7.worker.process_is_new === true && rc.m07_fresh_process === true, 'M07 は新しいプロセス（終了コード0）');
  const r7 = o7.search_response && o7.search_response.results;
  check(Array.isArray(r7) && r7.length > 0 && r7[0].id === ids[p5.key] && r7[0].memory === p5.text &&
    r7[0].user_id === p7.filters.user_id && target.user_id === p7.filters.user_id, 'M07 の1件目が更新後の本文・同じID');
  check(o7.get_updated && o7.get_updated.memory === p5.text && o7.get_deleted === null && o7.checks && o7.checks.same_ids_after_reopen === true, 'M07 の更新と削除が残る');

  // M08：未登録の利用者は0件、誤った呼び出し3件は ValueError
  const o8 = S.M08.output;
  check(o8.unknown_user_response && sameList(o8.unknown_user_response.results, []) && Array.isArray(o8.validation_errors) &&
    o8.validation_errors.length === P.M08.validation_cases.length && o8.validation_errors.every(e => e.type === 'ValueError'), 'M08 の0件と誤った呼び出し');

  // 別の検証：保存ベクトル6件・検索5件の順位とスコア・SQLite の履歴 ADD7/UPDATE1/DELETE1
  check(ind.status === 'passed' && ind.sample_count === IDS.length && ind.source_files_verified === EXPECT.sourceFiles, '別の検証の状態');
  check(ind.active_points === EXPECT.activePoints && deepEqual(ind.active_users, rc.m07_active_counts), '別の検証：有効な記録6件');
  check(deepEqual(ind.history_events, EXPECT.history) && rc.history_db && deepEqual(rc.history_db.history_rows_by_event, EXPECT.history), 'SQLite の履歴 ADD 7・UPDATE 1・DELETE 1');
  check(Array.isArray(ind.vectors) && ind.vectors.length === EXPECT.activePoints &&
    ind.vectors.every(v => v.dimensions === EXPECT.dims && v.max_abs_difference === 0 && ids[v.key] === v.id), '別の検証：保存ベクトル6件が一致');
  const recordKeys = {
    M02: S.M02.output.result_keys, M03: S.M03.output.result_keys, M04: S.M04.output.result_keys,
    M05: r5.map(x => x.metadata.source_key), M07: r7.map(x => x.metadata.source_key)
  };
  check(Array.isArray(ind.searches) && sameList(ind.searches.map(s => s.id), EXPECT.rankings), '別の検証：検索5件');
  ind.searches.forEach(s => check(s.ranking_matches === true && sameList(s.result_keys, recordKeys[s.id]), `別の検証：${s.id} の順位が実行記録と同じ`));
  check(ind.updated_same_id === true && ind.deleted_note_retained_in_history === true && sameList(ind.network_attempts, []), '別の検証：同じIDの更新・履歴に残る削除・通信0件');

  // 実画面：記録の SHA-256・大きさ（画像の実寸と記録の値）・場面、切り抜きが画像の内側で本文の範囲に収まること
  check(screens && Array.isArray(screens.screens) && sameList(screens.screens.map(s => s.file), SCREENS.map(s => s.file)), '実画面2枚の記録');
  screens.screens.forEach((s, i) => {
    const path = 'video/assets/' + s.file, img = d[FILES[path].key];
    check(img && img.width === s.width && img.height === s.height, `${s.file} の大きさ（${s.width}×${s.height}）`);
    check(s.sha256 === hashes[path] && s.scenario_id === SCREENS[i].scenario, `${s.file} のSHA-256と場面`);
  });
  for (const [name, crop] of Object.entries(CROPS)) {
    const img = d[crop.img];
    check(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= img.width && crop.y + crop.h <= img.height, `${name} の切り抜き範囲`);
    const right = crop.at.x + crop.w * crop.at.s, bottom = crop.at.y + crop.h * crop.at.s;
    check(crop.at.x >= 48 && right <= 1232.5 && crop.at.y >= CONTENT_TOP + 16 && bottom <= 620, `${name} の置き場所`);
  }

  // 映像に出す値（すべて読み込んだファイルから取り出す）
  return {
    img: d,
    pin: `mem0 ${src.version} ・ ${src.commit.slice(0, 7)} ・ ${src.license}`,
    version: src.version,
    rows: rows.length,
    adds: o1.responses.length,
    llmCalls: rc.llm_calls,
    users: users.map(u => {
      const video = rows.filter(r => r.user_id === u && r.metadata && r.metadata.topic === 'video');
      check(video.length === 1, `${u} の動画の好みが1件`);
      const saved = listing[u].find(x => x.id === ids[video[0].key]);
      check(saved, `${u} の動画の好みが一覧にある`);
      return {id: u, count: listing[u].length, key: video[0].key, phrase: phraseOf(saved.memory, video[0].key)};
    }),
    query: S.M02.input.call.query,
    searches,
    update: {
      id: m05.id, key: p5.key, before, after, shortId: shortId(o5.after.id),
      phrase: phraseOf(o5.after.memory, `${m05.id} 更新後`), history: o5.history.map(h => h.event)
    },
    reopen: {
      id: m07.id, key: r7[0].metadata.source_key, query: p7.query, filters: p7.filters,
      shortId: shortId(r7[0].id), excerpt: clauseExcerpt(r7[0].memory, `${m07.id} の1件目`), mark: `${after}秒`
    },
    spine: {save: m01.id, search: searches.map(s => s.id).join('・'), update: m05.id},
    samples: run.samples.length,
    check: {vectors: ind.vectors.length, rankings: ind.searches.length, history: rc.history_db.history_rows_by_event}
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
  c.fillStyle = o.color || C.navy;
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
// 測った幅に収まるまで1pxずつ小さくする（下限あり。下限でも収まらないかは checkLayout で確かめる）
function fitSize(c, s, maxWidth, o, min) {
  let size = o.size;
  while (size > min && measure(c, s, {...o, size}) > maxWidth) size -= 1;
  return size;
}
// 一部の文字（秒数など）だけ色を変えて1行に描く
function richLine(c, s, mark, x, y, o, markColor) {
  const i = mark ? s.indexOf(mark) : -1;
  if (i < 0) return text(c, s, x, y, o);
  let cx = x;
  for (const [seg, color] of [[s.slice(0, i), o.color], [mark, markColor], [s.slice(i + mark.length), o.color]]) {
    if (!seg) continue;
    text(c, seg, cx, y, {...o, color});
    cx += measure(c, seg, o);
  }
}
// 日本語の折り返し：測った幅で文字ごとに折り、行頭・行末の禁則を守る。英数字の語の途中では折らない
const NO_START = '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ…‥';
const NO_END = '（「『【〔〈《';
const ASCII_WORD = /[A-Za-z0-9._]/;
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
      let k = end;
      while (k - start > 1 && ASCII_WORD.test(chars[k]) && ASCII_WORD.test(chars[k - 1])) k--;
      if (k - start > 1) end = k;
    }
    lines.push([start, end]);
    start = end;
    while (start < chars.length && chars[start] === ' ') start++;
  }
  c.restore();
  return lines;
}
const lineCount = (c, s, maxWidth, o) => wrapRanges(c, [...s], maxWidth, o).length;
function jaBlock(c, s, x, y, maxWidth, lineHeight, o) {
  const chars = [...s];
  const ranges = wrapRanges(c, chars, maxWidth, o);
  ranges.forEach(([a, b], i) => text(c, chars.slice(a, b).join('').trimEnd(), x, y + i * lineHeight, o));
  return ranges.length;
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
  c.fillStyle = o.fill || C.paper;
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
function chip(c, s, x, y, o = {}) {
  const size = o.size || 30, h = o.h || 48, pad = o.pad || 14, weight = o.weight || 700;
  const fo = {size, weight, family: o.family};
  const w = measure(c, s, fo) + pad * 2;
  roundRect(c, x, y, w, h, 8);
  c.fillStyle = o.fill || C.paper;
  c.fill();
  if (o.stroke) {
    c.strokeStyle = o.stroke;
    c.lineWidth = 1.5;
    roundRect(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 8);
    c.stroke();
  }
  text(c, s, x + pad, y + h / 2 + size * 0.36, {...fo, color: o.color || C.navy});
  return w;
}
const chipWidth = (c, s, o = {}) => measure(c, s, {size: o.size || 30, weight: o.weight || 700, family: o.family}) + (o.pad || 14) * 2;
function bigCount(c, n, x, y, size, color, unit) {
  const o = {size, weight: 700};
  text(c, String(n), x, y, {...o, color});
  const w = measure(c, String(n), o);
  const uo = {size: Math.round(size * 0.3), weight: 700};
  text(c, unit, x + w + 12, y, {...uo, color});
  return w + 12 + measure(c, unit, uo);
}
function arrow(c, x1, x2, y, color = C.navy, width = 3) {
  const head = 8 + width * 2;
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x1, y);
  c.lineTo(x2 - head, y);
  c.stroke();
  c.beginPath();
  c.moveTo(x2, y);
  c.lineTo(x2 - head - 2, y - head * 0.7);
  c.lineTo(x2 - head - 2, y + head * 0.7);
  c.closePath();
  c.fill();
}
function arrowDown(c, x, y1, y2, color = C.navy) {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, y1);
  c.lineTo(x, y2 - 12);
  c.stroke();
  c.beginPath();
  c.moveTo(x, y2);
  c.lineTo(x - 10, y2 - 16);
  c.lineTo(x + 10, y2 - 16);
  c.closePath();
  c.fill();
}
// 実画面の切り抜きを、等倍率でそのまま置く（画素は変えず、文字も重ねない）
function shot(c, f, key, alpha, dy = 0) {
  if (alpha <= 0.001) return;
  const crop = CROPS[key], img = f.img[crop.img];
  const x = crop.at.x, y = crop.at.y + dy, w = crop.w * crop.at.s, h = crop.h * crop.at.s;
  c.save();
  c.globalAlpha *= alpha;
  c.save();
  c.shadowColor = 'rgba(20, 33, 61, 0.14)';
  c.shadowBlur = 16;
  c.shadowOffsetY = 5;
  roundRect(c, x, y, w, h, 8);
  c.fillStyle = C.paper;
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

// ---- いつも出ている枠：題名と原典、足元の注記（実際の端に置く） -------------------
function drawChrome(c, f) {
  text(c, 'Mem0 OSS 作例', 48, 38, {size: 26, weight: 700, color: C.navy});
  if (f) text(c, f.pin, LW - 48, 38, {size: 26, weight: 500, color: C.soft, align: 'right'});
  c.save();
  c.fillStyle = C.line;
  c.fillRect(48, 54, LW - 96, 1);
  c.fillRect(48, LH - 54, LW - 96, 1);
  c.restore();
  text(c, FOOTER_LEFT, 48, LH - 16, {size: 26, weight: 700, color: C.navy});
  if (f) text(c, `${f.users.map(u => u.id).join('・')} と好み${f.rows}件は架空`, LW - 48, LH - 16, {size: 26, weight: 700, color: C.teal, align: 'right'});
}

function drawHeadlines(c, t, f) {
  SCENES.forEach((s, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    const dy = i === 0 ? 0 : 10 * (1 - easeOut(prog(t, s.start, s.start + 0.4)));
    c.save();
    c.globalAlpha = a;
    text(c, s.headline(f), 48, 134 + dy, {size: 72, weight: 700, family: 'serif', color: C.navy});
    c.restore();
  });
}

// ---- 場面 ------------------------------------------------------------------
// 0〜4秒：架空の2人・実際の Mem0 OSS の Memory API・infer=False でそのまま保存
function drawOpening(c, t, f, a, L) {
  const W = 376, G = 28, Y = 188, H = 244;
  const cards = [
    {label: '誰の好み', big: `架空の${f.users.length}人`, sub: `${f.users.map(u => u.id).join(' と ')}。実在しない人物`, bar: C.teal},
    {label: '使ったもの', big: 'Mem0 OSS', sub: `Memory API ${f.version} を改変せずに実行`, bar: C.navy},
    {label: '保存のしかた', big: 'infer=False', family: 'mono', sub: '渡した文を、1件ずつそのまま保存', bar: C.cobalt}
  ];
  cards.forEach((k, i) => {
    const at = 0.2 + i * 0.15, x = 48 + i * (W + G), y = Y + rise(t, at);
    c.globalAlpha = a * enter(t, at);
    card(c, x, y, W, H, {bar: k.bar});
    text(c, k.label, x + 28, y + 50, {size: 30, weight: 700, color: k.bar});
    text(c, k.big, x + 28, y + 128, {size: L.openingBig[i], weight: 700, family: k.family, color: C.navy});
    jaBlock(c, k.sub, x + 28, y + 180, W - 56, 40, {size: 30, weight: 600, color: C.soft});
  });
  c.globalAlpha = a * enter(t, 0.85);
  text(c, L.openingNote, 48, 540 + rise(t, 0.85), {size: 36, weight: 700, color: C.navy});
}

// 4〜8秒：M01 の get_all の件数（aya 4件・ken 3件）と、各自の動画の好みの句（本文の一部そのまま）
function drawSave(c, t, f, a) {
  f.users.forEach((u, i) => {
    const at = 4.25 + i * 0.2, x = 48 + i * 612, y = 180 + rise(t, at);
    c.globalAlpha = a * enter(t, at);
    card(c, x, y, 572, 400, {bar: i ? C.teal : C.cobalt});
    const cw = chip(c, u.id, x + 32, y + 28, {size: 36, h: 56, pad: 18, family: 'mono', fill: C.navy, color: '#ffffff'});
    text(c, '架空の人物', x + 32 + cw + 16, y + 68, {size: 30, weight: 600, color: C.soft});
    c.globalAlpha = a * enter(t, at + 0.15);
    bigCount(c, u.count, x + 32, y + 212, 140, C.navy, '件を保存');
    c.globalAlpha = a * enter(t, at + 0.3);
    text(c, `${u.key} の本文から`, x + 32, y + 268, {size: 30, weight: 600, color: C.soft});
    jaBlock(c, `…${u.phrase}…`, x + 32, y + 324, 508, 56, {size: 44, weight: 700, color: C.navy});
  });
  c.globalAlpha = a * enter(t, 5.15);
  text(c, `${f.adds}件とも、渡した文のまま保存（ADD）`, 48, 640 + rise(t, 5.15), {size: 36, weight: 700, color: C.navy});
}

// 8〜12秒：M02・M03 の同じ問いと filters。各応答の1件目の本文（どれが1件目かは記録のまま）
function drawSearch(c, t, f, a) {
  c.globalAlpha = a * enter(t, 8.2);
  const dy = rise(t, 8.2);
  card(c, 48, 172 + dy, 1184, 92, {stroke: C.navy, lineWidth: 2});
  const cw = chip(c, '問い', 72, 194 + dy, {size: 30, h: 48, fill: C.navy, color: '#ffffff'});
  text(c, f.query, 72 + cw + 20, 236 + dy, {size: 44, weight: 700, color: C.navy});
  f.searches.forEach((s, i) => {
    const at = 8.45 + i * 0.2, x = 48 + i * 612, y = 292 + rise(t, at);
    c.globalAlpha = a * enter(t, at);
    card(c, x, y, 572, 318, {bar: i ? C.teal : C.cobalt});
    text(c, s.id, x + 32, y + 56, {size: 30, weight: 700, family: 'mono', color: C.soft});
    const iw = measure(c, s.id, {size: 30, weight: 700, family: 'mono'});
    chip(c, JSON.stringify(s.filters), x + 32 + iw + 16, y + 22, {size: 30, h: 46, family: 'mono', weight: 600, fill: i ? C.tealSoft : C.cobaltSoft, color: i ? C.teal : C.cobalt});
    c.globalAlpha = a * enter(t, at + 0.2);
    text(c, `1件目に返った記録（${s.key}）`, x + 32, y + 116, {size: 30, weight: 600, color: C.soft});
    jaBlock(c, s.excerpt.display, x + 32, y + 176, 508, 52, {size: 40, weight: 700, color: C.navy});
  });
  c.globalAlpha = a * enter(t, 9.1);
  text(c, SCOPE_NOTE, 48, 652, {size: 30, weight: 600, color: C.soft});
}

// 12〜18秒：M05。20秒→30秒、更新後の本文の句、同じID、履歴 ADD→UPDATE、スマホ幅の実画面。
// ポスター13.5秒（13.4秒までに全要素が着地）
function drawUpdate(c, t, f, a, L) {
  const u = f.update, size = L.bigSize, by = 352;
  c.globalAlpha = a * enter(t, 12.25);
  text(c, L.updateLabel, 48, 204, {size: 30, weight: 700, color: C.teal});
  const bTxt = `${u.before}秒`, aTxt = `${u.after}秒`;
  const bw = measure(c, bTxt, {size, weight: 700}), gap = 28, aw = 112;
  const ax = 48 + bw + gap * 2 + aw;
  c.globalAlpha = a * enter(t, 12.35);
  text(c, bTxt, 48, by + rise(t, 12.35), {size, weight: 700, color: C.soft});
  text(c, '更新前', 48, by + 52, {size: 30, weight: 600, color: C.soft});
  c.globalAlpha = a * enter(t, 12.6);
  arrow(c, 48 + bw + gap, 48 + bw + gap + aw, by - size * 0.34, C.cobalt, 6);
  text(c, aTxt, ax, by + rise(t, 12.6), {size, weight: 700, color: C.cobalt});
  text(c, '更新後', ax, by + 52, {size: 30, weight: 700, color: C.cobalt});
  c.globalAlpha = a * enter(t, 12.8);
  const dy = rise(t, 12.8);
  card(c, 48, 436 + dy, 832, 96, {stroke: C.cobalt, lineWidth: 2, bar: C.cobalt});
  richLine(c, `…${u.phrase}…`, aTxt, 80, 500 + dy, {size: 44, weight: 700, color: C.navy}, C.cobalt);
  c.globalAlpha = a * enter(t, 12.95);
  let x = 48;
  x += chip(c, '同じID', x, 560, {size: 30, h: 48, fill: C.tealSoft, color: C.teal}) + 14;
  text(c, u.shortId, x, 595, {size: 30, weight: 600, family: 'mono', color: C.navy});
  x += measure(c, u.shortId, {size: 30, weight: 600, family: 'mono'}) + 32;
  text(c, '履歴', x, 595, {size: 30, weight: 600, color: C.soft});
  x += measure(c, '履歴', {size: 30, weight: 600}) + 12;
  u.history.forEach((ev, i) => {
    if (i) {
      arrow(c, x + 4, x + 36, 584, C.soft, 3);
      x += 46;
    }
    x += chip(c, ev, x, 562, {size: 26, h: 44, pad: 12, family: 'mono', stroke: C.line, color: C.navy});
  });
  c.globalAlpha = a;
  shot(c, f, 'phoneUpdate', enter(t, 12.5), rise(t, 12.5));
  c.globalAlpha = a * enter(t, 12.7);
  text(c, `実画面・スマホ幅（${u.id}）`, 910, 642, {size: 26, weight: 600, color: C.soft});
}

// 18〜22秒：M07。保存先を閉じ、新しい Python プロセスで同じ問い。1件目は更新後の本文・同じID
function drawReopen(c, t, f, a) {
  const r = f.reopen;
  c.globalAlpha = a * enter(t, 18.2);
  text(c, `${r.id}・保存先を閉じ、新しい Python プロセスで検索`, 48, 204, {size: 30, weight: 700, color: C.teal});
  c.globalAlpha = a * enter(t, 18.3);
  const dy = rise(t, 18.3);
  card(c, 48, 226 + dy, 1184, 88, {stroke: C.navy, lineWidth: 2});
  const cw = chip(c, '問い', 72, 246 + dy, {size: 30, h: 48, fill: C.navy, color: '#ffffff'});
  text(c, r.query, 72 + cw + 20, 286 + dy, {size: 44, weight: 700, color: C.navy});
  c.globalAlpha = a * enter(t, 18.45);
  text(c, `filters ${JSON.stringify(r.filters)}`, 48, 354, {size: 30, weight: 500, family: 'mono', color: C.soft});
  c.globalAlpha = a * enter(t, 18.6);
  arrowDown(c, 96, 370, 416, C.cobalt);
  text(c, '1件目に返った記録', 128, 404, {size: 30, weight: 700, color: C.cobalt});
  c.globalAlpha = a * enter(t, 18.75);
  const dy2 = rise(t, 18.75);
  card(c, 48, 428 + dy2, 1184, 168, {stroke: C.cobalt, lineWidth: 2.5});
  let x = 76;
  x += chip(c, r.key, x, 448 + dy2, {size: 28, h: 44, pad: 12, family: 'mono', stroke: C.line, color: C.navy}) + 14;
  x += chip(c, '同じID', x, 448 + dy2, {size: 28, h: 44, pad: 12, fill: C.tealSoft, color: C.teal}) + 12;
  text(c, r.shortId, x, 480 + dy2, {size: 28, weight: 600, family: 'mono', color: C.navy});
  richLine(c, r.excerpt.display, r.mark, 76, 560 + dy2, {size: 48, weight: 700, color: C.navy}, C.cobalt);
  c.globalAlpha = a * enter(t, 19.1);
  text(c, REOPEN_NOTE, 48, 648, {size: 30, weight: 600, color: C.soft});
}

// 22〜28秒：保存→検索→更新の3段、閲覧ページの実画面（8つの場面）、Studio Yebisu と制作の区別。24秒以降は静止
function drawEnding(c, t, f, a) {
  const u = f.update;
  const steps = [
    {k: '保存', id: f.spine.save, v: `${f.adds}件をそのまま`},
    {k: '検索', id: f.spine.search, v: 'user_id ごとに'},
    {k: '更新', id: f.spine.update, v: `${u.before}秒 → ${u.after}秒`}
  ];
  const W = 376, G = 28, Y = 172, H = 100;
  steps.forEach((s, i) => {
    const at = 22.2 + i * 0.15, x = 48 + i * (W + G), y = Y + rise(t, at, 0.45, 10);
    c.globalAlpha = a * enter(t, at);
    card(c, x, y, W, H, {bar: C.cobalt});
    text(c, s.k, x + 26, y + 40, {size: 30, weight: 700, color: C.teal});
    text(c, s.id, x + W - 22, y + 40, {size: 26, weight: 600, family: 'mono', color: C.soft, align: 'right'});
    text(c, s.v, x + 26, y + 84, {size: 36, weight: 700, color: C.navy});
    if (i > 0) {
      c.fillStyle = C.cobalt;
      c.beginPath();
      c.moveTo(x - 6, Y + H / 2);
      c.lineTo(x - 20, Y + H / 2 - 10);
      c.lineTo(x - 20, Y + H / 2 + 10);
      c.closePath();
      c.fill();
    }
  });
  const crop = CROPS.desktopScenes;
  c.globalAlpha = a * enter(t, 22.75);
  text(c, '閲覧ページの実画面・8つの場面', crop.at.x, 316, {size: 30, weight: 600, color: C.soft});
  text(c, 'outputs/memory-run.json', crop.at.x + crop.w * crop.at.s, 316, {size: 26, weight: 500, family: 'mono', color: C.soft, align: 'right'});
  c.globalAlpha = a;
  shot(c, f, 'desktopScenes', enter(t, 22.85), rise(t, 22.85));
  c.globalAlpha = a * enter(t, 23.3);
  text(c, 'Studio Yebisu', 48, 572, {size: 52, weight: 700, family: 'serif', color: C.navy});
  text(c, CREDIT, 1232, 572, {size: 36, weight: 700, color: C.navy, align: 'right'});
  c.globalAlpha = a * enter(t, 23.5);
  text(c, AUTHORSHIP, 48, 628, {size: 30, weight: 600, color: C.soft});
}

const DRAW = [drawOpening, drawSave, drawSearch, drawUpdate, drawReopen, drawEnding];

// 文字の大きさは下限より小さくしない。収まらない場合は描かずに理由を出す
function checkLayout(c, f) {
  const fits = (s, o, max, label) => check(measure(c, s, o) <= max, `「${label || s}」が幅に収まる`);
  SCENES.forEach(s => fits(s.headline(f), {size: 72, weight: 700, family: 'serif'}, 1184));
  // 0〜4秒
  const bigs = [`架空の${f.users.length}人`, 'Mem0 OSS', 'infer=False'];
  const openingBig = bigs.map((s, i) => fitSize(c, s, 320, {size: 56, weight: 700, family: i === 2 ? 'mono' : undefined}, 40));
  bigs.forEach((s, i) => fits(s, {size: openingBig[i], weight: 700, family: i === 2 ? 'mono' : undefined}, 320));
  [`${f.users.map(u => u.id).join(' と ')}。実在しない人物`, `Memory API ${f.version} を改変せずに実行`, '渡した文を、1件ずつそのまま保存']
    .forEach(s => check(lineCount(c, s, 320, {size: 30, weight: 600}) <= 2, `「${s}」が2行に収まる`));
  const openingNote = `LLMの呼び出し ${f.llmCalls}回。抽出・要約はしていません。`;
  fits(openingNote, {size: 36, weight: 700}, 1184);
  // 4〜8秒
  f.users.forEach(u => check(lineCount(c, `…${u.phrase}…`, 508, {size: 44, weight: 700}) <= 2, `${u.key} の句が2行に収まる`));
  fits(`${f.adds}件とも、渡した文のまま保存（ADD）`, {size: 36, weight: 700}, 1184);
  // 8〜12秒
  check(chipWidth(c, '問い') + 20 + measure(c, f.query, {size: 44, weight: 700}) <= 1136, '問いが枠に収まる');
  f.searches.forEach(s => {
    check(measure(c, s.id, {size: 30, weight: 700, family: 'mono'}) + 16 + chipWidth(c, JSON.stringify(s.filters), {family: 'mono', weight: 600}) <= 508, `${s.id} の filters が枠に収まる`);
    check(lineCount(c, s.excerpt.display, 508, {size: 40, weight: 700}) <= 2, `${s.id} の1件目の抜粋が2行に収まる`);
  });
  fits(SCOPE_NOTE, {size: 30, weight: 600}, 1184);
  // 12〜18秒
  const u = f.update;
  const updateLabel = `${u.id}・${u.key} を Memory.update で明示的に更新`;
  fits(updateLabel, {size: 30, weight: 700}, 832);
  const pair = size => measure(c, `${u.before}秒`, {size, weight: 700}) + 28 * 2 + 112 + measure(c, `${u.after}秒`, {size, weight: 700});
  let bigSize = 140;
  while (bigSize > 112 && pair(bigSize) > 832) bigSize -= 1;
  check(pair(bigSize) <= 832, '「秒 → 秒」が幅に収まる');
  fits(`…${u.phrase}…`, {size: 44, weight: 700}, 768);
  const idLine = chipWidth(c, '同じID') + 14 + measure(c, u.shortId, {size: 30, weight: 600, family: 'mono'}) + 32 + measure(c, '履歴', {size: 30, weight: 600}) + 12 +
    u.history.reduce((w, ev, i) => w + (i ? 46 : 0) + chipWidth(c, ev, {size: 26, pad: 12, family: 'mono'}), 0);
  check(idLine <= 832, 'IDと履歴の行が幅に収まる');
  fits(`実画面・スマホ幅（${u.id}）`, {size: 26, weight: 600}, 322);
  // 18〜22秒
  const r = f.reopen;
  fits(`${r.id}・保存先を閉じ、新しい Python プロセスで検索`, {size: 30, weight: 700}, 1184);
  check(chipWidth(c, '問い') + 20 + measure(c, r.query, {size: 44, weight: 700}) <= 1136, 'M07 の問いが枠に収まる');
  fits(`filters ${JSON.stringify(r.filters)}`, {size: 30, weight: 500, family: 'mono'}, 1184);
  fits(r.excerpt.display, {size: 48, weight: 700}, 1128, `${r.id} の1件目の抜粋`);
  fits(REOPEN_NOTE, {size: 30, weight: 600}, 1184);
  // 22〜28秒
  [`${f.adds}件をそのまま`, 'user_id ごとに', `${u.before}秒 → ${u.after}秒`].forEach(s => fits(s, {size: 36, weight: 700}, 328));
  [f.spine.save, f.spine.search, f.spine.update].forEach((s, i) =>
    check(measure(c, ['保存', '検索', '更新'][i], {size: 30, weight: 700}) + 24 + measure(c, s, {size: 26, weight: 600, family: 'mono'}) <= 328, `${s} が段に収まる`));
  check(measure(c, 'Studio Yebisu', {size: 52, weight: 700, family: 'serif'}) + 40 + measure(c, CREDIT, {size: 36, weight: 700}) <= 1184, 'Studio Yebisu と尺の表示が重ならない');
  fits(AUTHORSHIP, {size: 30, weight: 600}, 1184);
  check(measure(c, '閲覧ページの実画面・8つの場面', {size: 30, weight: 600}) + 32 + measure(c, 'outputs/memory-run.json', {size: 26, weight: 500, family: 'mono'}) <= CROPS.desktopScenes.w, '実画面の見出しが重ならない');
  return {openingBig, openingNote, bigSize, updateLabel};
}

// ---- 1フレームを描く --------------------------------------------------------
let facts = null;
let layout = null;
let failure = null;
let currentT = 0;

function render(t) {
  canvas.width = canvas.width; // 前のフレームの変換・クリップ・状態をすべて捨てる
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = C.ivory;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / LW, canvas.height / LH);
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - LW * scale) / 2, (canvas.height - LH * scale) / 2);
  ctx.beginPath();
  ctx.rect(0, 0, LW, LH);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawChrome(ctx, facts);
  ctx.save();
  ctx.translate(OX, OY);
  if (!facts) {
    const message = failure ? '読み込みに失敗しました。代わりの映像は出しません。' : '保存済みの記録と実画面を確かめています…';
    text(ctx, message, 48, 300, {size: 36, weight: 700, color: failure ? C.rose : C.soft});
    if (failure) jaBlock(ctx, failure.message, 48, 356, 1184, 44, {size: 30, color: C.navy});
    ctx.restore();
    return;
  }
  drawHeadlines(ctx, t, facts);
  ctx.beginPath();
  ctx.rect(0, CONTENT_TOP, 1280, CONTENT_BOTTOM - CONTENT_TOP);
  ctx.clip();
  DRAW.forEach((draw, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    ctx.save();
    draw(ctx, t, facts, a, layout);
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
setStatus('loading', '保存済みの記録と実画面を確かめています…');

window.motionReady = (async () => {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('この環境ではSHA-256を確かめられません。http://127.0.0.1 などのローカルサーバーか https で開いてください');
  }
  const fontSpecs = [`700 72px ${SERIF}`, `700 52px ${SERIF}`, `700 140px ${SANS}`, `700 44px ${SANS}`, `600 30px ${SANS}`, `700 30px ${MONO}`, `600 30px ${MONO}`];
  if (document.fonts && document.fonts.load) {
    await Promise.all(fontSpecs.map(spec => document.fonts.load(spec, '好みを覚えて次に引き出す架空保存検索更新秒 Mem0 infer=False aya ken 0123456789')));
    await document.fonts.ready;
  }
  const {data, verified, hashes, manifestDigest} = await loadAll();
  const built = buildFacts(data, hashes);
  const lay = checkLayout(ctx, built);
  facts = built;
  layout = lay;
  render(currentT);
  const u = built.update;
  canvas.setAttribute('aria-label',
    `解説映像（${DURATION}秒・無音）。架空の${built.users.length}人（${built.users.map(x => x.id).join('・')}）の好み${built.rows}件を、Mem0 OSS の Memory API に infer=False でそのまま保存した実行記録から描きます。` +
    built.users.map(x => `${x.id} は${x.count}件（例：${x.phrase}）`).join('、') + '。' +
    `同じ問い「${built.query}」を user_id だけ変えて検索し、` + built.searches.map(s => `${s.user} の1件目は「${s.excerpt.display}」`).join('、') + '。user_id は検索範囲の指定で、認証ではありません。' +
    `${u.id} で実行スクリプトが Memory.update を明示的に呼び、${u.key} を同じIDのまま${u.before}秒から${u.after}秒へ書き換え、スマホ幅の閲覧ページの実画面を添えます。` +
    `${built.reopen.id} では保存先を閉じて新しい Python プロセスで同じ問いを検索し、1件目は同じIDの「${built.reopen.excerpt.display}」。` +
    `最後に保存・検索・更新の3段と、${built.samples}つの場面を選ぶ閲覧ページの実画面、Studio Yebisu と制作の区別を示します。`);
  setStatus('ready', `照合した${verified.length}ファイルから描いています`,
    `照合表のSHA-256 ${manifestDigest} を確かめ、実行記録の${built.samples}場面、架空の好み${built.rows}件、別の検証（保存ベクトル${built.check.vectors}件・検索${built.check.rankings}件の順位・` +
    `履歴 ADD ${built.check.history.ADD}・UPDATE ${built.check.history.UPDATE}・DELETE ${built.check.history.DELETE}）、実画面2枚を照合しました。ページでも映像でも Mem0・Python・AI は動きません。`);
  if (verifiedEl) {
    verifiedEl.replaceChildren(...verified.map(v => {
      const li = document.createElement('li');
      const path = document.createElement('code');
      path.textContent = v.path;
      const digest = document.createElement('code');
      digest.className = 'digest';
      digest.textContent = v.digest;
      li.append(path, ' — SHA-256 ', digest);
      return li;
    }));
    verifiedEl.hidden = false;
  }
  return true;
})().catch(error => {
  failure = error;
  render(currentT);
  setStatus('error', '読み込みに失敗しました：' + error.message, '代わりの映像は出しません。ファイルを確かめてから、もう一度読み込んでください。');
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
      // 最後まで進んだら停止の状態へ戻す
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
    currentT = clampTime(Math.round(t * 10) / 10);
    if (facts) render(currentT);
    sync();
  }

  play.addEventListener('click', () => (playing ? stop() : start()));
  range.addEventListener('input', () => jump(Number(range.value)));
  // 左右（上下）の矢印は0.1秒、PageUp・PageDown は2秒、Home・End は先頭・末尾（Home から PageUp 7回で14秒）
  const moves = {ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1, PageUp: 2, PageDown: -2};
  range.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    let next = null;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = DURATION;
    else if (Object.hasOwn(moves, event.key)) next = currentT + moves[event.key];
    if (next === null) return;
    event.preventDefault();
    jump(next);
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
