/* まちの作業席（Browser Use 作例）— 28秒・無音の解説映像（編集できる元ページ）
 * Canvas 2D で、時刻 t の完成した画面を毎回最初から描く。前のフレーム・壁時計・乱数には依存しない。
 * 使う素材は、入力2件・実行記録・操作と照合の方法・保存したJSON・実操作の記録・実画面7枚とその記録の
 * 14ファイルだけ。照合表（assets/data-hashes.json）自体を制作記録のSHA-256で確かめ、14件の生のバイト列を照合してから描く。
 * 件数・名前・料金・条件・操作は読み込んだファイルから取り出す。映像は保存済みの結果を編集したもので、操作の連続録画ではない。
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

// ---- 見た目（検索画面・閲覧ページと同じ、温かい白・紺・黄） ----------------------
const C = {
  paper: '#faf6ee', card: '#fffdf8', ink: '#1d2433', muted: '#535a6a', line: '#d9d2c3',
  navy: '#1b2f5e', navy2: '#2b4a8b', navySoft: '#e6ebf5', amber: '#f0b429', amberSoft: '#fbecc4'
};
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Noto Sans JP", Meiryo, system-ui, sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, "BIZ UDGothic", monospace';

// ---- 素材 ------------------------------------------------------------------
// 照合表 assets/data-hashes.json 自体の SHA-256（runtime/frozen-reviewed-source.json の files_sha256 の値）。
// 照合表の14ファイルのパスは作例フォルダーからの相対で、このモジュールの1つ上を基準に解決する。
// 書き出し時に <base href="video/"> が入っても import.meta.url 基準なので同じ場所を指す。
const HASH_MANIFEST = {path: 'assets/data-hashes.json', sha256: '48950d5de1fee5032f1c465efa96199a36f0de2a0425389fe636d6a24b7dc336'};
const FILES = {
  'input/workspaces.json': {key: 'workspaces', kind: 'json'},
  'input/scenarios.json': {key: 'scenarios', kind: 'json'},
  'outputs/browser-run.json': {key: 'run', kind: 'json'},
  'outputs/method.md': {key: 'method', kind: 'text'},
  'outputs/browser-selection.json': {key: 'selection', kind: 'json'},
  'outputs/browser-record.json': {key: 'record', kind: 'json'},
  'video/assets/screen-manifest.json': {key: 'screens', kind: 'json'},
  'video/assets/api-S02.png': {key: 'aS02', kind: 'png', scenario: 'S02'},
  'video/assets/api-S03.png': {key: 'aS03', kind: 'png', scenario: 'S03'},
  'video/assets/api-S04.png': {key: 'aS04', kind: 'png', scenario: 'S04'},
  'video/assets/api-S05.png': {key: 'aS05', kind: 'png', scenario: 'S05'},
  'video/assets/phone-fixture-top.png': {key: 'pTop', kind: 'png'},
  'video/assets/phone-fixture-full.png': {key: 'pFull', kind: 'png'},
  'video/assets/phone-record-S04.png': {key: 'pRec', kind: 'png'}
};
const SOURCE = {
  repository: 'browser-use/browser-use',
  commit: 'c75e8476e26d18b7617643bc2ae082fae8eae431',
  distribution_version: '0.13.11',
  license: 'MIT',
  copyright: 'Copyright (c) 2024 Gregor Zunic'
};
const RUNTIME = {python: '3.12.9', browser_use: '0.13.11', browser_product: 'Chrome/155.0.8059.41'};
const ITEM_IDS = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12'];
const SCENARIO_IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
const ITEM_FIELDS = ['id', 'name', 'area', 'hourly_yen', 'saturday', 'power', 'description'];
const EXPECT_COUNTS = [12, 12, 4, 2, 0, 12];
const EXPECT_ACTIONS = {fill: 2, select_option: 2, check: 2, click: 5};
const SELECTED_ID = 'S04';
const SELECTED_ITEMS = ['W01', 'W11'];
const SELECTION_BYTES = 3012; // 制作時の実操作で保存した選択JSONの大きさ
const CHECK_LABELS = {'#saturday': '土曜に使える', '#power': '電源あり'}; // 検索画面のチェックボックスの表示名
const BLANK = {keyword: '', area: '', budget: '', saturday: false, power: false};

// 実画面の切り抜き（画像の画素座標）と置き場所。倍率は縦横同じで、画素を伸ばさず、上に文字を重ねない
const CROPS = {
  phoneTop: {img: 'pTop', x: 0, y: 62, w: 360, h: 432, at: {x: 840, y: 214, s: 1}},          // キーワード〜ボタン（S04の状態）
  s02W04: {img: 'aS02', x: 37, y: 612, w: 401, h: 176, at: {x: 600, y: 422, s: 0.9}},        // S02のW04カード（電源：なし）
  s03Cards: {img: 'aS03', x: 44, y: 442, w: 1192, h: 347, at: {x: 330, y: 316, s: 0.755}},   // S03の結果4件
  s04Cards: {img: 'aS04', x: 44, y: 442, w: 797, h: 176, at: {x: 462, y: 476, s: 0.966}},    // S04の結果2件
  s05Empty: {img: 'aS05', x: 44, y: 448, w: 570, h: 76, at: {x: 48, y: 524, s: 0.98}},       // S05の該当なしの案内
  recResults: {img: 'pRec', x: 0, y: 144, w: 360, h: 240, at: {x: 48, y: 222, s: 1.15}},     // 記録ページ S04の結果2件
  recSave: {img: 'pRec', x: 0, y: 760, w: 220, h: 52, at: {x: 48, y: 512, s: 1.15}}          // 「この状態をJSONで保存」
};
const CONTENT_TOP = 164, CONTENT_BOTTOM = 652;

const FOOTER_SCOPE = '架空データ・決めた手順を実行／実結果を編集・無音';
const FOOTER_NOTE = '操作APIの作例・LLM判断なし';
const CTA = '検索画面を試す → 記録を保存';
const SCENES = [
  {id: 'setup', start: 0, end: 4, headline: () => '探す条件を、画面で伝える。'},
  {id: 'keyword', start: 4, end: 8, headline: f => `文字検索だけなら、${f.st.S02.count}件。`},
  {id: 'area', start: 8, end: 12, headline: f => `エリアと予算で、${f.st.S03.count}件。`},
  {id: 'and', start: 12, end: 18, headline: f => `土曜・電源ありなら、${f.st.S04.count}件。`},
  {id: 'zero', start: 18, end: 22, headline: f => `${f.st.S05.count}件も、リセットも残す。`},
  {id: 'save', start: 22, end: 28, headline: () => '操作の結果を、JSONで持ち帰る。'}
];

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const enter = (t, at, dur = 0.45) => easeOut(prog(t, at, at + dur));
const rise = (t, at, dur = 0.45, px = 14) => px * (1 - enter(t, at, dur));
// 場面の切り替えは0.5秒の重ね合わせ。上の帯と足元の注記はいつも残す
const XF = 0.25;
function sceneAlpha(t, i) {
  const s = SCENES[i];
  const a = i === 0 ? 1 : easeInOut(prog(t, s.start - XF, s.start + XF));
  const b = i === SCENES.length - 1 ? 1 : 1 - easeInOut(prog(t, s.end - XF, s.end + XF));
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
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));

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
  const manifest = await fetchVerified(new URL(HASH_MANIFEST.path, import.meta.url), 'video/' + HASH_MANIFEST.path, HASH_MANIFEST.sha256);
  const table = JSON.parse(decodeText(manifest.bytes));
  const hashes = table && table.files;
  check(hashes && typeof hashes === 'object' && !Array.isArray(hashes), '照合表の形');
  const listed = Object.keys(hashes).sort();
  check(sameList(listed, Object.keys(FILES).sort()), `照合表のファイル（${listed.length}件）`);
  const data = {}, sizes = {}, verified = [];
  await Promise.all(listed.map(async path => {
    check(/^[A-Za-z0-9_\-/.]+$/.test(path) && !path.split('/').includes('..') && !path.startsWith('/'), `${path} のパス`);
    const expected = String(hashes[path]);
    check(/^[0-9a-f]{64}$/.test(expected), `${path} の照合値`);
    const {bytes, digest} = await fetchVerified(new URL('../' + path, import.meta.url), path, expected);
    const spec = FILES[path];
    sizes[path] = bytes.byteLength;
    if (spec.kind === 'png') data[spec.key] = await decodePng(bytes, path);
    else if (spec.kind === 'json') data[spec.key] = JSON.parse(decodeText(bytes));
    else data[spec.key] = decodeText(bytes);
    verified.push({path, digest});
  }));
  verified.sort((a, b) => a.path.localeCompare(b.path));
  check(verified.length === Object.keys(FILES).length, '照合したファイルの数');
  return {data, sizes, verified, hashes};
}

// 検索画面と同じ規則（outputs/method.md の2.）で、記録された条件から結果のIDを求め直す
const norm = s => String(s).normalize('NFKC').toLowerCase();
function replaySearch(items, cond) {
  const terms = norm(cond.keyword).split(/\s+/).filter(Boolean);
  return items.filter(it => {
    const hay = norm([it.name, it.area, it.description].join(' '));
    if (!terms.every(w => hay.includes(w))) return false;
    if (cond.area && it.area !== cond.area) return false;
    if (cond.budget && it.hourly_yen > Number(cond.budget)) return false;
    if (cond.saturday && !it.saturday) return false;
    if (cond.power && !it.power) return false;
    return true;
  }).map(it => it.id);
}
// 手順の操作を順に当てはめた後の条件（前の状態から引き継ぐ）
function applyActions(cond, actions) {
  let next = {...cond};
  actions.forEach(x => {
    const key = x.api + ' ' + x.selector;
    if (key === 'fill #search') next.keyword = x.value;
    else if (key === 'select_option #area') next.area = x.value;
    else if (key === 'select_option #budget') next.budget = x.value;
    else if (key === 'check #saturday') next.saturday = true;
    else if (key === 'check #power') next.power = true;
    else if (key === 'click #reset') next = {...BLANK};
    else if (key !== 'click #apply') throw new Error('記録の確認に失敗：許可していない操作 ' + key);
  });
  return next;
}
// 同じAPIが続く操作をまとめた1行（例：check #saturday・#power → click #apply）
function actionsLine(actions) {
  const groups = [];
  actions.forEach(x => {
    const last = groups[groups.length - 1];
    if (last && last.api === x.api) last.selectors.push(x.selector);
    else groups.push({api: x.api, selectors: [x.selector]});
  });
  return groups.map(g => `${g.api} ${g.selectors.join('・')}`).join(' → ');
}
const priceText = yen => `${yen.toLocaleString('ja-JP')}円`;

function buildFacts(d, hashes, sizes) {
  const {workspaces: ws, scenarios: sc, run, method, selection: sel, record: rec, screens} = d;

  // 入力：作例のために書いた架空の作業席12件と、6状態の手順
  check(ws.format === 'studio-yebisu-workspace-fixture-v1' && ws.fictional === true, '入力の形式と架空の印');
  check(sameList((ws.items || []).map(x => x.id), ITEM_IDS), '作業席12件のID');
  ws.items.forEach(it => {
    check(typeof it.name === 'string' && typeof it.area === 'string' && Number.isInteger(it.hourly_yen) &&
      typeof it.saturday === 'boolean' && typeof it.power === 'boolean' && typeof it.description === 'string', `${it.id} の項目`);
  });
  const items = new Map(ws.items.map(it => [it.id, it]));
  check(sc.format === 'studio-yebisu-browser-scenarios-v1', '手順の形式');
  check(sameList((sc.scenarios || []).map(x => x.id), SCENARIO_IDS), '6状態のID');
  const counted = {};
  sc.scenarios.forEach(s => s.actions.forEach(x => (counted[x.api] = (counted[x.api] || 0) + 1)));
  check(deepEqual(counted, EXPECT_ACTIONS), '手順の操作の数');

  // 実行記録：固定版Browser UseのActor APIで実際に操作した6状態
  check(run.format === 'studio-yebisu-browser-run-v1' && run.fictional === true && run.title === ws.title, '実行記録の形式と架空の印');
  check(deepEqual(run.source, SOURCE), '原典のリポジトリ・コミット・版・ライセンス');
  check(deepEqual(run.inputs_sha256, {'input/workspaces.json': hashes['input/workspaces.json'], 'input/scenarios.json': hashes['input/scenarios.json']}), '実行記録の入力SHA-256');
  check(run.scope && run.scope.agent_run === false && run.scope.llm_calls === 0, '範囲（Agent.runなし・LLM呼び出し0）');
  const rt = run.runtime || {};
  check(rt.python === RUNTIME.python && rt.browser_use === RUNTIME.browser_use && rt.browser_product === RUNTIME.browser_product, '実行環境の版');
  check(rt.agent_run === false && rt.llm_constructed === false && rt.llm_calls === 0, '実行環境のLLMなし');
  check(deepEqual(rt.action_success_counts, EXPECT_ACTIONS) && deepEqual(rt.action_success_counts, counted), '成功した直接操作の数');
  Object.keys(EXPECT_ACTIONS).forEach(api => check(rt.api_calls && rt.api_calls['Element.' + api] === EXPECT_ACTIONS[api], `Element.${api} の呼び出し回数`));
  const actionTotal = Object.values(rt.action_success_counts).reduce((s, n) => s + n, 0);
  check(actionTotal === 11, '直接操作の合計');

  check(sameList((run.scenarios || []).map(s => s.id), SCENARIO_IDS), '実行記録の6状態');
  const st = {};
  let cond = {...BLANK};
  run.scenarios.forEach((s, i) => {
    const input = sc.scenarios[i];
    check(s.status === 'passed' && s.label === input.label, `${s.id} の状態と名前`);
    check(deepEqual(s.actions.map(x => pick(x, Object.keys(x).filter(k => k !== 'call'))), input.actions), `${s.id} の操作が手順と同じ`);
    check(s.actions.every(x => x.call === 'Element.' + x.api), `${s.id} の呼び出し名`);
    cond = applyActions(cond, input.actions);
    check(deepEqual(s.conditions, cond), `${s.id} の条件が手順から求めた値と同じ`);
    const ids = s.results.map(r => r.id);
    check(s.result_count === s.results.length && s.result_count === EXPECT_COUNTS[i], `${s.id} の件数`);
    check(sameList(ids, s.expected_ids) && sameList(ids, input.expected_ids), `${s.id} の結果IDが期待と同じ`);
    check(sameList(ids, replaySearch(ws.items, s.conditions)), `${s.id} の結果が検索の規則と同じ`);
    check(s.count_text === `該当 ${s.result_count}件` && s.empty_visible === (s.result_count === 0), `${s.id} の件数表示と該当なし`);
    s.results.forEach(r => {
      const it = items.get(r.id);
      check(it && deepEqual(pick(r, ITEM_FIELDS), pick(it, ITEM_FIELDS)), `${s.id} ${r.id} の全項目が入力と同じ`);
      check(r.text && r.text.price === priceText(it.hourly_yen) &&
        r.text.saturday === (it.saturday ? '土曜：利用可' : '土曜：休み') && r.text.power === (it.power ? '電源：あり' : '電源：なし'), `${s.id} ${r.id} の表示`);
    });
    check(s.screenshot && s.screenshot.width === 1280 && s.screenshot.height === 900 && /^[0-9a-f]{64}$/.test(s.screenshot.sha256), `${s.id} の画面の記録`);
    st[s.id] = {id: s.id, label: s.label, count: s.result_count, conditions: s.conditions, results: s.results,
      actions: s.actions, line: actionsLine(s.actions), screenshot: s.screenshot, empty: s.empty_text};
  });
  const counts = SCENARIO_IDS.map(id => st[id].count);

  // S02：キーワードは文字の一致。説明文に「電源なし」がある席も残る
  const kw = st.S02.conditions.keyword;
  const lexical = st.S02.results.filter(r => r.power === false);
  check(lexical.length > 0 && lexical.every(r => r.description.includes(kw)), 'S02 の電源なしの席が文字で一致');
  const quote = lexical.find(r => r.id === 'W04');
  check(quote && quote.description.includes(kw + 'なし'), 'S02 の W04 の説明文');
  // S03：キーワードを残したまま、エリアと予算。W04（電源なし）はまだ残る
  check(st.S03.conditions.keyword === kw && st.S03.conditions.saturday === false && st.S03.conditions.power === false, 'S03 の条件');
  const s03NoPower = st.S03.results.filter(r => r.power === false).map(r => r.id);
  check(sameList(s03NoPower, ['W04']), 'S03 に残る電源なしの席');
  // S04：S03の条件に、土曜・電源ありのチェックを足す（すべて満たす席だけ）
  const c4 = st.S04.conditions;
  check(c4.keyword === kw && c4.area === st.S03.conditions.area && c4.budget === st.S03.conditions.budget && c4.saturday === true && c4.power === true, 'S04 の条件');
  check(sameList(st.S04.results.map(r => r.id), SELECTED_ITEMS) && st.S04.results.every(r => r.saturday && r.power), 'S04 の2件');
  check(sameList(st.S04.actions.filter(x => x.api === 'check').map(x => x.selector), Object.keys(CHECK_LABELS)), 'S04 のチェック');
  // S05：該当なし（正しい0件）。S06：リセットで全条件が空に
  check(st.S05.count === 0 && typeof st.S05.empty === 'string' && st.S05.empty.length > 0, 'S05 の該当なしの表示');
  check(deepEqual(st.S06.conditions, BLANK) && st.S06.count === ws.items.length, 'S06 のリセット');

  // 操作と照合の方法：原典のコミット、操作の回数、件数の並び
  check(method.includes(SOURCE.commit) && method.includes(`${actionTotal}回`) && method.includes(counts.join('→')), '操作と照合の方法の記録');

  // 実際に保存したJSON：実行記録のS04の行と、原典・入力SHA-256・範囲をそのまま含む
  check(sizes['outputs/browser-selection.json'] === SELECTION_BYTES, '保存JSONの大きさ');
  check(sel.format === 'studio-yebisu-browser-selection-v1', '保存JSONの形式');
  check(deepEqual(sel.source, run.source) && deepEqual(sel.inputs_sha256, run.inputs_sha256) && deepEqual(sel.scope, run.scope), '保存JSONの原典・入力SHA-256・範囲');
  const runS04 = run.scenarios.find(s => s.id === SELECTED_ID);
  check(sel.selected && sel.selected.id === SELECTED_ID && deepEqual(sel.selected, runS04), '保存JSONの行が実行記録のS04と同じ');

  // 実操作の記録：保存JSONのSHA-256、初期表示のS04、検索画面のS04の結果
  check(rec.selected_json_sha256 === hashes['outputs/browser-selection.json'] && rec.all_six_records_and_original_item_fields_match === true, '実操作の記録と保存JSON');
  const initial = (rec.record_states || []).find(s => s.label === 'initial');
  check(initial && initial.selected === SELECTED_ID && initial.count === `${st.S04.count}件` && sameList(initial.results.map(r => r.id), SELECTED_ITEMS), '記録 initial');
  const fixtureS04 = (rec.fixture_states || []).find(s => s.label === SELECTED_ID);
  check(fixtureS04 && deepEqual(fixtureS04.results, runS04.results) && deepEqual(fixtureS04.conditions, runS04.conditions), '検索画面のS04が実行記録と同じ');

  // 実画面：記録のSHA-256・大きさ、元のスクリーンショットとの対応、切り抜きが画像の内側で枠に収まること
  check(Array.isArray(screens.screens) && screens.screens.length === 7, '実画面の記録');
  const pngs = Object.entries(FILES).filter(([, v]) => v.kind === 'png');
  check(sameList(screens.screens.map(s => 'video/assets/' + s.file).sort(), pngs.map(([p]) => p).sort()), '実画面7枚の名前');
  screens.screens.forEach(s => {
    const path = 'video/assets/' + s.file, spec = FILES[path], img = d[spec.key];
    check(img && img.width === s.width && img.height === s.height, `${s.file} の大きさ`);
    check(s.sha256 === hashes[path], `${s.file} のSHA-256`);
    if (spec.scenario) check(s.original_sha256 === st[spec.scenario].screenshot.sha256 && s.width === 1280 && s.height === 900, `${s.file} が実行記録の ${spec.scenario} の画面`);
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
    title: ws.title,
    itemCount: ws.items.length,
    source: run.source,
    actionTotal,
    counts,
    st,
    kw,
    quote: {id: quote.id, name: quote.name, description: quote.description, power: quote.text.power},
    lexicalIds: lexical.map(r => r.id),
    s03NoPower,
    checks: st.S04.actions.filter(x => x.api === 'check').map(x => CHECK_LABELS[x.selector]),
    saved: {
      path: 'outputs/browser-selection.json',
      bytes: sizes['outputs/browser-selection.json'],
      rows: [
        ['selected.id', JSON.stringify(sel.selected.id), 88],
        ['result_count', JSON.stringify(sel.selected.result_count), 56],
        ['results[].id', JSON.stringify(sel.selected.results.map(r => r.id)), 40],
        ['scope.llm_calls', JSON.stringify(sel.scope.llm_calls), 40]
      ]
    }
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
// 折り返して描き、指定した語に黄色の下地を敷く（画像の外の、編集した引用）
function quoteBlock(c, s, mark, x, y, maxWidth, lineHeight, o) {
  const chars = [...s], marks = [...mark];
  const on = chars.map(() => false);
  for (let i = 0; i + marks.length <= chars.length; i++) {
    if (marks.every((m, j) => chars[i + j] === m)) marks.forEach((_, j) => (on[i + j] = true));
  }
  wrapRanges(c, chars, maxWidth, o).forEach(([a, b], li) => {
    const by = y + li * lineHeight;
    let cx = x;
    for (let i = a; i < b;) {
      let j = i + 1;
      while (j < b && on[j] === on[i]) j++;
      const seg = chars.slice(i, j).join('');
      const so = on[i] ? {...o, weight: 700} : o;
      const w = measure(c, seg, so);
      if (on[i]) {
        roundRect(c, cx - 3, by - o.size * 0.92, w + 6, o.size * 1.18, 4);
        c.fillStyle = C.amberSoft;
        c.fill();
        c.fillStyle = C.amber;
        c.fillRect(cx - 3, by + o.size * 0.2, w + 6, 3);
      }
      text(c, seg, cx, by, {...so, color: on[i] ? C.ink : o.color});
      cx += w;
      i = j;
    }
  });
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
// 条件の札。塗り＝この状態で足した条件、線だけ＝引き継いだ条件
function chip(c, s, x, y, o = {}) {
  const size = o.size || 32, h = o.h || 48, pad = o.pad || 14, weight = o.weight || 700;
  const w = measure(c, s, {size, weight}) + pad * 2;
  roundRect(c, x, y, w, h, 8);
  if (o.fill) {
    c.fillStyle = o.fill;
    c.fill();
  }
  if (o.stroke) {
    c.strokeStyle = o.stroke;
    c.lineWidth = 2;
    roundRect(c, x + 1, y + 1, w - 2, h - 2, 7);
    c.stroke();
  }
  text(c, s, x + pad, y + h / 2 + size * 0.36, {size, weight, color: o.color || C.ink});
  return w;
}
const label = (c, s, x, y, o = {}) => fitText(c, s, x, y, o.max || 1184, {size: 32, weight: 600, color: C.muted, ...o});
// 大きな件数と「件」
function bigCount(c, n, x, y, size, color = C.navy) {
  const o = {size, weight: 700};
  text(c, String(n), x, y, {...o, color});
  const w = measure(c, String(n), o);
  text(c, '件', x + w + 10, y, {size: Math.round(size * 0.34), weight: 700, color});
  return w + 10 + measure(c, '件', {size: Math.round(size * 0.34), weight: 700});
}
// 実行した直接操作（記録の actions から）。手順のIDと、API・セレクター
function actionLine(c, s, x, y, maxWidth) {
  runs(c, [
    {s: s.id + '  ', o: {size: 32, weight: 700, color: C.navy}},
    {s: s.line, o: {size: 32, weight: 600, family: 'mono', color: C.navy2}}
  ], x, y, maxWidth, 1);
}

// 実画面の切り抜きを、等倍率でそのまま置く（画素は変えず、文字も重ねない）
function shot(c, f, key, alpha, dy = 0) {
  if (alpha <= 0.001) return;
  const crop = CROPS[key], img = f.img[crop.img];
  const x = crop.at.x, y = crop.at.y + dy, w = crop.w * crop.at.s, h = crop.h * crop.at.s;
  c.save();
  c.globalAlpha *= alpha;
  c.save();
  c.shadowColor = 'rgba(27, 47, 94, 0.14)';
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

// ---- いつも出ている枠：題名と原典、足元の範囲の注記 ---------------------------
function drawChrome(c, f) {
  text(c, 'Browser Use 作例｜' + (f ? f.title : 'まちの作業席'), 48, 38, {size: 26, weight: 700, color: C.navy});
  if (f) {
    const pin = `${f.source.repository.split('/')[1]} ${f.source.commit.slice(0, 7)} ・ ${f.source.distribution_version} ・ ${f.source.license}`;
    text(c, pin, 1232, 38, {size: 26, weight: 500, color: C.muted, align: 'right'});
  }
  c.save();
  c.fillStyle = C.line;
  c.fillRect(48, 54, 1184, 1);
  c.fillRect(48, 668, 1184, 1);
  c.restore();
  text(c, FOOTER_SCOPE, 48, 704, {size: 26, weight: 700, color: C.ink});
  text(c, FOOTER_NOTE, 1232, 704, {size: 26, weight: 700, color: C.navy, align: 'right'});
}

function drawHeadlines(c, t, f) {
  SCENES.forEach((s, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    const dy = i === 0 ? 0 : 10 * (1 - easeOut(prog(t, s.start - XF, s.start + 0.35)));
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
// 0〜4秒：架空の作業席12件と、画面で選べる条件。右はスマホ幅の検索画面（実画面）
function drawSetup(c, t, f, a) {
  c.globalAlpha = a * enter(t, 0.1);
  label(c, `${f.title}・input/workspaces.json`, 48, 196, {max: 760});
  c.globalAlpha = a * enter(t, 0.3);
  bigCount(c, f.itemCount, 48, 384 + rise(t, 0.3), 220);
  c.globalAlpha = a * enter(t, 0.6);
  fitText(c, '架空の作業席', 48, 456 + rise(t, 0.6), 760, {size: 56, weight: 700}, 52);
  c.globalAlpha = a * enter(t, 0.95);
  label(c, '画面で選べる条件', 48, 506, {max: 760});
  const rowsOfChips = [['キーワード', 'エリア', '1時間の予算'], Object.values(CHECK_LABELS)];
  rowsOfChips.forEach((row, r) => {
    let x = 48;
    row.forEach((s, i) => {
      c.globalAlpha = a * enter(t, 1.05 + (r * 3 + i) * 0.08, 0.35);
      x += chip(c, s, x, 522 + r * 58, {stroke: C.navy, color: C.navy, fill: C.card}) + 12;
    });
  });

  c.globalAlpha = a * enter(t, 0.25);
  label(c, '実画面：架空の検索画面', 840, 196, {max: 392});
  c.globalAlpha = a;
  shot(c, f, 'phoneTop', enter(t, 0.35), rise(t, 0.35));
}

// 4〜8秒：S02。キーワード「電源」は文字の一致なので、説明文に「電源なし」がある席も残る
function drawKeyword(c, t, f, a) {
  const s = f.st.S02, q = f.quote;
  c.globalAlpha = a * enter(t, 4.1);
  actionLine(c, s, 48, 196, 1184);
  c.globalAlpha = a * enter(t, 4.2);
  label(c, 'キーワード', 48, 252, {max: 500});
  const kwo = {size: 56, weight: 700};
  const bw = Math.max(220, measure(c, f.kw, kwo) + 56);
  roundRect(c, 49, 269 + rise(t, 4.2), bw - 2, 78, 10);
  c.fillStyle = C.card;
  c.fill();
  c.strokeStyle = C.navy;
  c.lineWidth = 2;
  c.stroke();
  text(c, f.kw, 76, 328 + rise(t, 4.2), {...kwo, color: C.ink});
  c.globalAlpha = a * enter(t, 4.5);
  bigCount(c, s.count, 48, 540 + rise(t, 4.5), 200);

  c.globalAlpha = a * enter(t, 4.4);
  label(c, `${q.id} ${q.name}の説明文`, 600, 252, {max: 632});
  c.globalAlpha = a * enter(t, 4.6);
  quoteBlock(c, q.description, f.kw, 600, 304 + rise(t, 4.6), 632, 52, {size: 44, weight: 500, color: C.ink});
  c.globalAlpha = a * enter(t, 5.0);
  runs(c, [
    {s: `「${q.power}」でも一致：`, o: {size: 32, weight: 700, color: C.ink}},
    {s: f.lexicalIds.join('・'), o: {size: 32, weight: 700, color: C.navy2}}
  ], 600, 404, 632, 1);
  c.globalAlpha = a;
  shot(c, f, 's02W04', enter(t, 5.15), rise(t, 5.15));
  c.globalAlpha = a * enter(t, 5.25);
  label(c, '実画面', 980, 466, {max: 252});
  label(c, `${s.id}の${q.id}`, 980, 506, {max: 252});

  c.globalAlpha = a * enter(t, 5.5);
  fitText(c, '文字が一致。設備の条件とは別。', 48, 636 + rise(t, 5.5), 1184, {size: 52, weight: 700}, 52);
}

// 8〜12秒：S03。キーワードはそのまま、エリアと予算を足すと4件（W04はまだ残る）
function drawArea(c, t, f, a) {
  const s = f.st.S03, cond = s.conditions;
  c.globalAlpha = a * enter(t, 8.1);
  actionLine(c, s, 48, 196, 1184);
  const chips = [
    {s: `キーワード：${cond.keyword}`, o: {stroke: C.line, color: C.muted, fill: C.card}},
    {s: `エリア：${cond.area}`, o: {fill: C.navy, color: '#ffffff'}},
    {s: `予算：${cond.budget}円以内`, o: {fill: C.navy, color: '#ffffff'}}
  ];
  let x = 48;
  chips.forEach((g, i) => {
    c.globalAlpha = a * enter(t, 8.2 + i * 0.12, 0.35);
    x += chip(c, g.s, x, 218, g.o) + 12;
  });
  c.globalAlpha = a * enter(t, 8.5);
  bigCount(c, s.count, 48, 500 + rise(t, 8.5), 220);
  c.globalAlpha = a * enter(t, 8.8);
  label(c, `${f.st.S02.count}件 → ${s.count}件`, 48, 552, {max: 270, color: C.ink, weight: 700});

  c.globalAlpha = a * enter(t, 8.6);
  label(c, `実画面 ${s.id}：結果の部分`, 330, 302, {max: 900});
  c.globalAlpha = a;
  shot(c, f, 's03Cards', enter(t, 8.65), rise(t, 8.65));

  c.globalAlpha = a * enter(t, 9.2);
  runs(c, [
    {s: f.s03NoPower.join('・'), o: {size: 44, weight: 700, color: C.navy2}},
    {s: `（${f.quote.power}）も、文字の一致で残る。`, o: {size: 44, weight: 700, color: C.ink}}
  ], 48, 636, 1184, 1);
}

// 12〜18秒：S04。土曜・電源ありのチェックを足し、すべて満たす2件。ポスターは13.5秒（全要素が着地済み）
function drawAnd(c, t, f, a) {
  const s = f.st.S04, cond = s.conditions;
  c.globalAlpha = a * enter(t, 12.1);
  actionLine(c, s, 48, 196, 1184);
  const kept = [`「${cond.keyword}」`, cond.area, `${cond.budget}円以内`];
  let x = 48;
  kept.forEach((str, i) => {
    c.globalAlpha = a * enter(t, 12.2 + i * 0.06, 0.35);
    x += chip(c, str, x, 218, {stroke: C.line, color: C.muted, fill: C.card}) + 12;
  });
  c.globalAlpha = a * enter(t, 12.4, 0.35);
  text(c, '＋', x, 254, {size: 32, weight: 700, color: C.navy});
  x += measure(c, '＋', {size: 32, weight: 700}) + 12;
  f.checks.forEach((str, i) => {
    c.globalAlpha = a * enter(t, 12.45 + i * 0.1, 0.35);
    x += chip(c, str, x, 218, {fill: C.navy, color: '#ffffff'}) + 12;
  });
  c.globalAlpha = a * enter(t, 12.7);
  fitText(c, 'すべての条件を満たす席だけ（AND）。AIの意味判断ではありません。', 48, 304, 1184, {size: 32, weight: 700, color: C.navy2}, 32);

  c.globalAlpha = a * enter(t, 12.5);
  bigCount(c, s.count, 48, 520 + rise(t, 12.5), 220);
  c.globalAlpha = a * enter(t, 12.8);
  label(c, `${f.st.S03.count}件 → ${s.count}件`, 48, 568, {max: 270, color: C.ink, weight: 700});

  s.results.forEach((r, i) => {
    const y = 380 + i * 72;
    c.globalAlpha = a * enter(t, 12.6 + i * 0.15);
    const dy = rise(t, 12.6 + i * 0.15);
    text(c, r.id, 330, y + dy, {size: 32, weight: 600, color: C.muted});
    fitText(c, r.name, 410, y + dy, 520, {size: 56, weight: 700}, 52);
    const po = {size: 56, weight: 700, color: C.navy, align: 'right'};
    text(c, r.text.price, 1232, y + dy, po);
    text(c, '1時間', 1232 - measure(c, r.text.price, po) - 12, y + dy, {size: 32, weight: 600, color: C.muted, align: 'right'});
    if (i === 0) {
      c.fillStyle = C.line;
      c.fillRect(330, y + 20, 902, 1);
    }
  });

  c.globalAlpha = a;
  shot(c, f, 's04Cards', enter(t, 12.9), rise(t, 12.9));
  c.globalAlpha = a * enter(t, 13.0);
  label(c, '実画面', 330, 520, {max: 120});
  label(c, s.id, 330, 560, {max: 120});
}

// 18〜22秒：S05の0件（正しい該当なし）と、S06のリセットで12件
function drawZero(c, t, f, a) {
  const s5 = f.st.S05, s6 = f.st.S06;
  c.globalAlpha = a * enter(t, 18.1);
  actionLine(c, s5, 48, 196, 580);
  c.globalAlpha = a * enter(t, 18.2);
  label(c, `キーワード「${s5.conditions.keyword}」`, 48, 248, {max: 568});
  c.globalAlpha = a * enter(t, 18.35);
  bigCount(c, s5.count, 48, 440 + rise(t, 18.35), 200);
  c.globalAlpha = a * enter(t, 18.6);
  fitText(c, '該当なしも、正しい結果。', 48, 500, 568, {size: 44, weight: 700}, 40);
  c.globalAlpha = a;
  shot(c, f, 's05Empty', enter(t, 18.75), rise(t, 18.75));
  c.globalAlpha = a * enter(t, 18.85);
  label(c, `実画面 ${s5.id}：該当なしの案内`, 48, 638, {max: 568});

  c.globalAlpha = a * enter(t, 18.5);
  c.fillStyle = C.line;
  c.fillRect(640, 172, 1, 470);

  c.globalAlpha = a * enter(t, 18.9);
  actionLine(c, s6, 664, 196, 568);
  c.globalAlpha = a * enter(t, 19.0);
  label(c, '「条件をリセット」を押す', 664, 248, {max: 568});
  c.globalAlpha = a * enter(t, 19.15);
  bigCount(c, s6.count, 664, 440 + rise(t, 19.15), 200);
  c.globalAlpha = a * enter(t, 19.4);
  fitText(c, '条件はすべて空に戻る。', 664, 500, 568, {size: 44, weight: 700}, 40);
  const cleared = [['キーワード：なし', 'エリア：すべて'], ['予算：指定なし', 'チェック：なし']];
  cleared.forEach((row, r) => {
    let x = 664;
    row.forEach((str, i) => {
      c.globalAlpha = a * enter(t, 19.55 + (r * 2 + i) * 0.08, 0.35);
      x += chip(c, str, x, 524 + r * 58, {stroke: C.line, color: C.muted, fill: C.card}) + 12;
    });
  });
}

// 22〜28秒：制作時の実操作で保存したJSONの値と、スマホの記録ページ（実画面）。25秒以降は案内を止めて読む
function drawSave(c, t, f, a) {
  const sv = f.saved;
  c.globalAlpha = a * enter(t, 22.1);
  fitText(c, `記録ページで${f.st.S04.id}を選び、JSONで保存（制作時の実操作）`, 48, 196, 1184, {size: 32, weight: 700, color: C.navy2}, 32);
  c.globalAlpha = a;
  shot(c, f, 'recResults', enter(t, 22.2), rise(t, 22.2));
  shot(c, f, 'recSave', enter(t, 22.45), rise(t, 22.45));

  const X = 500, Y = 222, W = 732, H = 352, ix = X + 24;
  const kp = enter(t, 22.3), dp = rise(t, 22.3);
  c.globalAlpha = a * kp;
  c.save();
  c.shadowColor = 'rgba(27, 47, 94, 0.10)';
  c.shadowBlur = 14;
  c.shadowOffsetY = 4;
  roundRect(c, X, Y + dp, W, H, 10);
  c.fillStyle = C.card;
  c.fill();
  c.restore();
  roundRect(c, X + 1, Y + 1 + dp, W - 2, H - 2, 10);
  c.strokeStyle = C.navy;
  c.lineWidth = 2;
  c.stroke();
  text(c, '保存したJSON', ix, Y + 42 + dp, {size: 32, weight: 700, color: C.navy});
  text(c, `${sv.bytes.toLocaleString('ja-JP')} bytes`, X + W - 24, Y + 42 + dp, {size: 32, weight: 600, color: C.muted, align: 'right'});
  fitText(c, sv.path, ix, Y + 84 + dp, W - 48, {size: 32, family: 'mono', color: C.muted}, 32);
  c.fillStyle = C.line;
  c.fillRect(ix, Y + 100 + dp, W - 48, 1);
  const rowY = [Y + 172, Y + 232, Y + 284, Y + 330];
  sv.rows.forEach(([k, v, size], i) => {
    c.globalAlpha = a * enter(t, 22.55 + i * 0.12, 0.35);
    text(c, k, ix, rowY[i] + dp, {size: 32, family: 'mono', color: C.muted});
    text(c, v, X + 320, rowY[i] + dp + (size > 60 ? 8 : 0), {size, family: 'mono', weight: 700, color: i === 0 ? C.navy : C.ink});
  });

  // 最後の3秒：検索画面と記録ページへの案内を止めて読む
  const kc = enter(t, 24.5);
  if (kc > 0.001) {
    c.globalAlpha = a * kc;
    roundRect(c, 32, 588, 1216, 64, 10);
    c.fillStyle = C.amberSoft;
    c.fill();
    c.fillStyle = C.amber;
    c.fillRect(32, 588, 6, 64);
    const right = measure(c, FOOTER_NOTE, {size: 32, weight: 700});
    fitText(c, CTA, 52, 637, 1232 - right - 52 - 16, {size: 52, weight: 700, color: C.navy}, 44);
    text(c, FOOTER_NOTE, 1232, 634, {size: 32, weight: 700, color: C.ink, align: 'right'});
  }
}

const DRAW = [drawSetup, drawKeyword, drawArea, drawAnd, drawZero, drawSave];

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
    text(ctx, message, 48, 300, {size: 36, weight: 700, color: failure ? '#9b3f1d' : C.muted});
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
  const fontSpecs = [`700 72px ${SERIF}`, `700 220px ${SANS}`, `700 56px ${SANS}`, `600 32px ${SANS}`, `600 32px ${MONO}`];
  if (document.fonts && document.fonts.load) {
    await Promise.all(fontSpecs.map(spec => document.fonts.load(spec, '探す条件を画面で伝える電源恵比寿土曜12件S04W01')));
    await document.fonts.ready;
  }
  const {data, sizes, verified, hashes} = await loadAll();
  const built = buildFacts(data, hashes, sizes);
  facts = built;
  render(currentT);
  setStatus('ready', `照合した${verified.length}ファイルから描いています`,
    `入力の作業席${built.itemCount}件と6状態の手順、実行記録の件数（${built.counts.join('→')}）・条件・結果の全項目・直接操作${built.actionTotal}回、` +
    `保存したJSONの${built.st.S04.id}の行、実画面7枚を確かめました。ページでも映像でも Browser Use・Python・AI は動きません。`);
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
