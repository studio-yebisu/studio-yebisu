/* Browser Use作例 — 32秒・無音の概念図の映像（編集できる元ページ）
 * 一つの図が動き続ける：手引き（参照スキル）→ Python ＋ 事前の手順 → Browser・Page・Element →
 * 実DOMと画面PNG → 実行記録 → 保存したJSON。文字のスライドや結果画像の並びではない。
 * 使う素材は ../concept/manifest.json（固定したSHA-256）に載った18ファイルだけで、バイト数とSHA-256と
 * 中身の照合が通ってから描く。件数・ID・名前・料金・条件・操作は読み込んだ実行記録から取り出す。
 * この映像は保存済みの記録を図にしたもので、Browser Use・Python・AIはここでは動かない。音はない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 32;
const POSTER_TIME = 31;
const SCENES = [0, 4, 9, 14, 20, 25, 29];
const SIZES = { portrait: [720, 1280], wide: [1280, 720] };
const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
const evenSize = (v) => (Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0 ? v : null);
const query = new URLSearchParams(location.search);
let layoutName = evenSize(given.width) && evenSize(given.height)
  ? (given.width >= given.height ? 'wide' : 'portrait')
  : (query.get('layout') === 'wide' ? 'wide' : 'portrait');
let WIDTH = evenSize(given.width) || SIZES[layoutName][0];
let HEIGHT = evenSize(given.height) || SIZES[layoutName][1];
const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
window.motionConfig = { duration: DURATION, fps: FPS, width: WIDTH, height: HEIGHT, posterTime: POSTER_TIME, audioEvents: [] };

const root = document.documentElement;
if (RENDER) root.classList.add('is-render');
const canvas = document.getElementById('film');
// CPUで描かせ、同じ時刻のPNGを別順・新しいページでも同じにする
const ctx = canvas.getContext('2d', { willReadFrequently: true });

function sizeCanvas() {
  const density = RENDER ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.round(WIDTH * density);
  canvas.height = Math.round(HEIGHT * density);
  canvas.style.aspectRatio = `${WIDTH} / ${HEIGHT}`;
  if (RENDER) {
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;
  }
  canvas.dataset.layout = layoutName;
}
sizeCanvas();

// ---- 見た目（墨・紙・ペトロール・琥珀。端末の書体だけ） --------------------
const C = {
  paper: '#f6f1e7', card: '#fffdf8', ink: '#1d2422', muted: '#56615d', line: '#c8bfae',
  petrol: '#1f5c60', petrolSoft: '#d6e5e2', amber: '#d98a1e', amberText: '#9e5608', amberSoft: '#f5dfb8',
};
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans JP", system-ui, sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", serif';
const MONO = 'ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, Menlo, monospace';

// ---- 素材の照合（閲覧ページと同じ18ファイル） -------------------------------
const PIN = '98fa56dccf5aec3d1c24ad24d05145b799fd42e72a148700b389360b4272c3c3';
const BASE = '../';
const MANIFEST = 'concept/manifest.json';
const CASE_ID = 'browser-use-example';
const COMMIT = 'c75e8476e26d18b7617643bc2ae082fae8eae431';
const VERSION = '0.13.11';
const ASSET_PATHS = [
  'concept/structure.json', 'brief.json', 'request.txt', 'run_browser.py',
  'input/workspaces.json', 'input/scenarios.json',
  'outputs/browser-run.json', 'outputs/browser-selection.json', 'outputs/method.md',
  'samples.json', 'fixture.html', 'fixture.js',
  'vendor/browser-use/README.md', 'vendor/browser-use/LICENSE',
  'vendor/browser-use/skills/open-source/SKILL.md',
  'vendor/browser-use/skills/open-source/references/actor.md',
  'vendor/browser-use/skills/open-source/references/browser.md',
  'verification.json',
];
const SKILL_PATH = 'vendor/browser-use/skills/open-source/SKILL.md';
const SELECTION_PATH = 'outputs/browser-selection.json';
const IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
const COUNTS = [12, 12, 4, 2, 0, 12];
const PART_IDS = ['skill', 'browser', 'page', 'actions', 'output'];
const APIS = ['fill', 'select_option', 'check', 'click'];
const ACTION_TOTALS = { fill: 2, select_option: 2, check: 2, click: 5 };
const CALLS = { fill: 'Element.fill', select_option: 'Element.select_option', check: 'Element.check', click: 'Element.click' };
const DEFAULTS = { keyword: '', area: '', budget: '', saturday: false, power: false };

class Fail extends Error {}
const fail = (m) => { throw new Fail(m); };

async function fetchBytes(path) {
  let res;
  try { res = await fetch(BASE + path, { cache: 'no-store' }); } catch { fail(`${path} を取得できません（通信エラー）`); }
  if (!res.ok) fail(`${path} を取得できません（HTTP ${res.status}）`);
  return new Uint8Array(await res.arrayBuffer());
}
async function sha256(bytes) {
  if (!(window.crypto && crypto.subtle)) fail('この環境ではSHA-256を計算できないため、素材を照合できません');
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
const decoder = new TextDecoder('utf-8', { fatal: true });
const asText = (b, p) => { try { return decoder.decode(b); } catch { return fail(`${p} がUTF-8として読めません`); } };
const asJson = (b, p) => { const s = asText(b, p); try { return JSON.parse(s); } catch { return fail(`${p} がJSONとして読めません`); } };
function same(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
}
const normalize = (s) => s.normalize('NFKC').toLowerCase();
function matches(item, c) {
  const hay = normalize([item.name, item.area, item.description].join(' '));
  if (!normalize(c.keyword).split(/\s+/u).filter(Boolean).every((t) => hay.includes(t))) return false;
  if (c.area && item.area !== c.area) return false;
  if (c.budget && item.hourly_yen > Number(c.budget)) return false;
  if (c.saturday && !item.saturday) return false;
  if (c.power && !item.power) return false;
  return true;
}
function advance(form, applied, a) {
  const f = { ...form };
  let ap = { ...applied };
  if (a.api === 'fill') f.keyword = a.value;
  else if (a.api === 'select_option') f[a.selector === '#area' ? 'area' : 'budget'] = a.value;
  else if (a.api === 'check') f[a.selector === '#saturday' ? 'saturday' : 'power'] = true;
  else if (a.selector === '#apply') ap = { ...f };
  else return { form: { ...DEFAULTS }, applied: { ...DEFAULTS } };
  return { form: f, applied: ap };
}

async function loadAndValidate() {
  const mb = await fetchBytes(MANIFEST);
  if ((await sha256(mb)) !== PIN) fail('concept/manifest.json が固定したSHA-256と一致しません');
  const manifest = asJson(mb, MANIFEST);
  if (manifest.format !== 'studio-yebisu-assets/v1' || manifest.case_id !== CASE_ID || manifest.source_commit !== COMMIT) fail('concept/manifest.json の形式・作例ID・固定コミットが想定と違います');
  if (!Array.isArray(manifest.files) || manifest.files.map((f) => f && f.path).join('\n') !== ASSET_PATHS.join('\n')) fail('素材の一覧が、想定した18ファイルと違います');
  const files = {};
  await Promise.all(manifest.files.map(async (f) => {
    if (!Number.isInteger(f.bytes) || f.bytes <= 0 || !/^[0-9a-f]{64}$/.test(f.sha256 || '')) fail(`${f.path} の記録の形が違います`);
    const b = await fetchBytes(f.path);
    if (b.byteLength !== f.bytes) fail(`${f.path} の大きさが記録と違います（${b.byteLength} / ${f.bytes} bytes）`);
    if ((await sha256(b)) !== f.sha256) fail(`${f.path} のSHA-256が記録と違います`);
    files[f.path] = b;
  }));
  const sha = Object.fromEntries(manifest.files.map((f) => [f.path, f.sha256]));
  const st = asJson(files['concept/structure.json'], 'concept/structure.json');
  const ws = asJson(files['input/workspaces.json'], 'input/workspaces.json');
  const sc = asJson(files['input/scenarios.json'], 'input/scenarios.json');
  const run = asJson(files['outputs/browser-run.json'], 'outputs/browser-run.json');
  const sel = asJson(files[SELECTION_PATH], SELECTION_PATH);
  for (const p of ['brief.json', 'samples.json', 'verification.json']) asJson(files[p], p);
  for (const p of ASSET_PATHS) asText(files[p], p);
  const py = asText(files['run_browser.py'], 'run_browser.py');
  const skill = asText(files[SKILL_PATH], SKILL_PATH);
  const license = asText(files['vendor/browser-use/LICENSE'], 'vendor/browser-use/LICENSE');

  if (st.format !== 'browser-use-structure/v1' || st.case_id !== CASE_ID || st.source_commit !== COMMIT || st.version !== VERSION) fail('concept/structure.json の形式・版が想定と違います');
  if (!Array.isArray(st.parts) || st.parts.map((p) => p && p.id).join() !== PART_IDS.join()) fail('5つの部品のIDが想定と違います');
  if (!Array.isArray(st.scenarios) || st.scenarios.map((s) => s && s.id).join() !== IDS.join()) fail('6状態のIDが想定と違います');
  if (st.default_id !== 'S04' || st.selection_path !== SELECTION_PATH || st.selection_bytes !== 3012 || st.selection_sha256 !== sha[SELECTION_PATH]) fail('保存した原本（S04）の記録が固定値と違います');
  const ex = st.actual_execution || {};
  if (ex.agent_run !== false || ex.llm_calls !== 0 || ex.actions !== 11 || ex.states !== 6) fail('構成の説明の実行範囲が想定と違います');
  const sources = { 'run_browser.py': py, [SKILL_PATH]: skill };
  for (const p of st.parts) {
    const src = sources[p.source_path];
    const line = src === undefined ? undefined : src.split(/\r?\n/)[p.line_start - 1];
    if (typeof p.quote !== 'string' || !p.quote || typeof line !== 'string' || !line.includes(p.quote)) fail(`${p.id} の引用が原文の${p.line_start}行目にありません`);
  }
  const routes = [];
  for (const line of skill.split(/\r?\n/)) {
    const m = /^\|\s*(.+?)\s*\|\s*`references\/([a-z-]+)\.md`\s*\|\s*$/.exec(line);
    if (m) routes.push({ topic: m[1], file: m[2] });
  }
  if (routes.length < 3 || !routes.some((r) => r.file === 'actor') || !routes.some((r) => r.file === 'browser')) fail('SKILL.md の話題の表から、ActorとBrowserの行を読めません');

  if (ws.format !== 'studio-yebisu-workspace-fixture-v1' || ws.fictional !== true || !Array.isArray(ws.items) || ws.items.length !== 12) fail('input/workspaces.json が架空の作業席12件の形ではありません');
  const items = new Map(ws.items.map((i) => [i && i.id, i]));
  if (items.size !== 12) fail('input/workspaces.json のIDが重複しています');
  if (sc.format !== 'studio-yebisu-browser-scenarios-v1' || !Array.isArray(sc.scenarios) || sc.scenarios.map((s) => s && s.id).join() !== IDS.join()) fail('input/scenarios.json がS01〜S06の手順の形ではありません');
  if (run.format !== 'studio-yebisu-browser-run-v1' || run.fictional !== true) fail('outputs/browser-run.json の形式が想定と違います');
  const src = run.source || {};
  if (src.repository !== 'browser-use/browser-use' || src.commit !== COMMIT || src.distribution_version !== VERSION || src.license !== 'MIT') fail('実行記録の原典が想定と違います');
  const ih = run.inputs_sha256 || {};
  if (ih['input/workspaces.json'] !== sha['input/workspaces.json'] || ih['input/scenarios.json'] !== sha['input/scenarios.json']) fail('実行記録の入力SHA-256が、照合した入力と一致しません');
  if (!run.scope || run.scope.agent_run !== false || run.scope.llm_calls !== 0) fail('実行記録の範囲が「Agent.runなし・LLM呼び出し0」ではありません');
  const rt = run.runtime || {};
  if (rt.agent_run !== false || rt.llm_calls !== 0 || rt.browser_use !== VERSION || !same(rt.action_success_counts, ACTION_TOTALS)) fail('実行時の記録（版・LLMなし・操作の内訳）が想定と違います');
  if (!Array.isArray(run.scenarios) || run.scenarios.map((s) => s && s.id).join() !== IDS.join()) fail('実行記録の状態がS01〜S06ではありません');
  let form = { ...DEFAULTS }, applied = { ...DEFAULTS }, total = 0;
  run.scenarios.forEach((s, i) => {
    const input = sc.scenarios[i];
    const card = st.scenarios[i];
    if (!Array.isArray(s.actions) || !Array.isArray(input.actions) || s.actions.length !== input.actions.length) fail(`${s.id} の操作の数が手順の入力と違います`);
    s.actions.forEach((a, j) => {
      const w = input.actions[j];
      if (!APIS.includes(a.api) || a.api !== w.api || a.selector !== w.selector || a.call !== CALLS[w.api] || (a.value ?? null) !== (w.value ?? null)) fail(`${s.id} の操作${j + 1}が手順の入力と違います`);
      ({ form, applied } = advance(form, applied, a));
      total += 1;
    });
    if (!same(s.conditions, form)) fail(`${s.id} の読み取った条件が、手順から求めた条件と違います`);
    if (!Array.isArray(s.results) || s.result_count !== s.results.length || s.result_count !== COUNTS[i]) fail(`${s.id} の件数が想定（${COUNTS[i]}件）と違います`);
    for (const r of s.results) {
      const it = r && items.get(r.id);
      if (!it || r.name !== it.name || r.area !== it.area || r.hourly_yen !== it.hourly_yen || r.saturday !== it.saturday || r.power !== it.power || r.description !== it.description) fail(`${s.id} の結果 ${r && r.id} が入力の作業席と一致しません`);
    }
    const ids = s.results.map((r) => r.id);
    if (ids.join() !== ws.items.filter((it) => matches(it, applied)).map((it) => it.id).join()) fail(`${s.id} の結果が、検索の決まりで入力から求めた並びと違います`);
    if (!same(s.expected_ids, input.expected_ids) || s.expected_ids.join() !== ids.join()) fail(`${s.id} の照合用の期待IDが結果と一致しません`);
    if (s.empty_visible !== (ids.length === 0) || s.count_text !== `該当 ${ids.length}件` || s.status !== 'passed') fail(`${s.id} の件数表示が結果と合いません`);
    if (!card || card.result_count !== s.result_count || !same(card.result_ids, ids) || !card.screenshot || !s.screenshot || card.screenshot.sha256 !== s.screenshot.sha256) fail(`${s.id} の構成の説明が実行記録と一致しません`);
  });
  if (total !== 11) fail('操作の合計が11回ではありません');
  const s04 = run.scenarios[3];
  if (!same(sel, { format: 'studio-yebisu-browser-selection-v1', source: run.source, inputs_sha256: run.inputs_sha256, scope: run.scope, selected: s04 })) fail('保存した原本（S04）が、実行記録のS04と一致しません');
  if (!license.includes('MIT License') || !license.includes('Copyright (c) 2024 Gregor Zunic')) fail('Browser UseのLICENSEがMIT（Gregor Zunic）ではありません');
  return { manifest, st, ws, run, sel, routes };
}

// ---- 映像に使う値（照合済みの記録から） --------------------------------------
let F = null;

const WINDOWS = { S02: [9.2, 11.3], S03: [11.8, 13.5], S04: [14.1, 15.8], S05: [17.7, 18.4], S06: [19.3, 19.6] };

function prepareFilm(v) {
  const by = Object.fromEntries(v.run.scenarios.map((s) => [s.id, s]));
  const schedule = [];
  const pool = [];
  for (const id of ['S02', 'S03', 'S04', 'S05', 'S06']) {
    const s = by[id];
    const [w0, w1] = WINDOWS[id];
    const slot = (w1 - w0) / s.actions.length;
    const md = Math.min(0.45, slot * 0.5);
    s.actions.forEach((a, k) => {
      const move = w0 + k * slot;
      schedule.push({ sid: id, a, move, md, act: move + md });
    });
    const last = schedule[schedule.length - 1].act;
    pool.push({ sid: id, t: last + 0.08, ids: new Set(s.results.map((r) => r.id)), count: s.result_count });
  }
  const s02 = by.S02;
  const sel = v.sel.selected;
  return {
    by,
    routes: v.routes,
    items: v.ws.items.map((i) => ({ id: i.id, power: i.power })),
    schedule,
    pool,
    initialCount: by.S01.result_count,
    noPowerS02: s02.results.filter((r) => !r.power).map((r) => r.id),
    s04: by.S04.results.map((r) => ({ id: r.id, name: r.name, price: r.text.price })),
    sel: { id: sel.id, count: sel.result_count, ids: sel.results.map((r) => r.id) },
    counts: v.run.scenarios.map((s) => ({ id: s.id, count: s.result_count })),
    totals: v.run.runtime.action_success_counts,
    version: v.run.source.distribution_version,
    commit: v.run.source.commit.slice(0, 7),
    files: v.manifest.files,
  };
}

// ---- 配置（縦720×1280・横1280×720をそれぞれ組む） ----------------------------
const LAYOUTS = {
  portrait: {
    W: 720, H: 1280,
    f: { kicker: 20, title: 46, sub: 26, h: 28, b: 22, s: 20, m: 16, big: 40, chip: 18 },
    kicker: { x: 48, y: 54 }, title: { x: 48, y: 108 }, sub: { x: 48, y: 150 },
    book: { x: 48, y: 196, w: 222, h: 176 },
    ghost: { x: 48, y: 392, w: 320, h: 38 },
    py: { x: 316, y: 200, w: 150, h: 172 },
    steps: { x: 492, y: 188, w: 188, h: 196 },
    set: { x: 492, y: 398, w: 188, h: 36 },
    frame: { x: 40, y: 452, w: 640 },
    dom: { x: 56, y: 924, w: 290, h: 62 },
    png: { x: 374, y: 924, w: 290, h: 62 },
    rec: { x: 40, y: 1024, w: 470, h: 156 },
    out: { x: 536, y: 1024, w: 144, h: 156 },
    check: { x: 40, y: 1192, w: 384, h: 34 },
    save: { x: 536, y: 1192, w: 144, h: 34 },
    callout: { x: 56, y: 918, w: 608, h: 80, stack: false },
    foot: { x: 48, y: 1260, size: 20 },
    flow: 'v',
  },
  wide: {
    W: 1280, H: 720,
    f: { kicker: 18, title: 40, sub: 22, h: 24, b: 19, s: 17, m: 14, big: 32, chip: 15 },
    kicker: { x: 48, y: 44 }, title: { x: 48, y: 92 }, sub: { x: 48, y: 126 },
    book: { x: 48, y: 170, w: 200, h: 150 },
    ghost: { x: 48, y: 392, w: 250, h: 34 },
    py: { x: 300, y: 174, w: 140, h: 148 },
    steps: { x: 290, y: 352, w: 170, h: 176 },
    set: { x: 48, y: 336, w: 200, h: 34 },
    frame: { x: 500, y: 140, w: 480 },
    dom: { x: 500, y: 488, w: 220, h: 46 },
    png: { x: 760, y: 488, w: 220, h: 46 },
    rec: { x: 500, y: 556, w: 330, h: 130 },
    out: { x: 846, y: 556, w: 134, h: 130 },
    check: { x: 1010, y: 566, w: 230, h: 52 },
    save: { x: 1010, y: 634, w: 230, h: 52 },
    callout: { x: 1010, y: 170, w: 230, h: 260, stack: true },
    foot: { x: 48, y: 706, size: 18 },
    flow: 'h',
  },
};

// 検索画面の中は 344×238 の単位で組み、枠の幅に合わせて拡大する（閲覧ページの図と同じ並び）
const UNIT_EL = {
  '#search': { x: 16, y: 58, w: 150, h: 22 },
  '#area': { x: 172, y: 58, w: 74, h: 22 },
  '#budget': { x: 252, y: 58, w: 76, h: 22 },
  '#saturday': { x: 14, y: 96, w: 52, h: 22 },
  '#power': { x: 70, y: 96, w: 76, h: 22 },
  '#apply': { x: 188, y: 96, w: 70, h: 22 },
  '#reset': { x: 264, y: 96, w: 64, h: 22 },
};
const EL_ORDER = Object.keys(UNIT_EL);

let L = null;
let G = null; // 配置から求めた形（矢印・本の行・要素の位置）

function geometry() {
  L = LAYOUTS[layoutName];
  const Fr = L.frame;
  const k = Fr.w / 344;
  const frame = { x: Fr.x, y: Fr.y, w: Fr.w, h: 238 * k, k };
  const U = (ux, uy) => ({ x: frame.x + ux * k, y: frame.y + uy * k });
  const el = {};
  for (const [sel, b] of Object.entries(UNIT_EL)) {
    const p = U(b.x, b.y);
    el[sel] = { x: p.x, y: p.y, w: b.w * k, h: b.h * k };
  }
  const tokens = F.items.map((it, i) => {
    const p = U(17 + (i % 6) * 53, 128 + Math.floor(i / 6) * 26);
    return { ...it, x: p.x, y: p.y, w: 49 * k, h: 22 * k };
  });
  // 手引きの行（SKILL.mdの話題の表）。今回読んだActorとBrowserだけが栞として出る
  const B = L.book;
  const half = B.w / 2;
  const tabH = Math.round(B.h * 0.16);
  const chosen = F.routes.map((r) => r.file === 'actor' || r.file === 'browser');
  const heights = chosen.map((c) => (c ? tabH : 5));
  const gap = (B.h - 20 - heights.reduce((a, b) => a + b, 0)) / Math.max(1, F.routes.length - 1);
  let ry = B.y + 10;
  const rows = [];
  const anchors = {};
  F.routes.forEach((r, i) => {
    rows.push({ y: ry, h: heights[i], chosen: chosen[i], file: r.file });
    if (chosen[i]) anchors[r.file] = { x: B.x + B.w + 26, y: ry + tabH / 2 };
    ry += heights[i] + gap;
  });
  const P = L.py, S = L.steps, T = L.set, R = L.rec, O = L.out, D = L.dom, N = L.png;
  const bz = (a, b, dir) => {
    if (dir === 'v') { const my = (a.y + b.y) / 2; return [a, { x: a.x, y: my }, { x: b.x, y: my }, b]; }
    const mx = (a.x + b.x) / 2;
    return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
  };
  const links = {
    'book-a': bz(anchors.actor, { x: P.x, y: P.y + P.h * 0.42 }, 'h'),
    'book-b': bz(anchors.browser, { x: P.x, y: P.y + P.h * 0.6 }, 'h'),
    'page-dom': bz({ x: D.x + D.w / 2, y: frame.y + 230 * k }, { x: D.x + D.w / 2, y: D.y }, 'v'),
    'page-png': bz({ x: N.x + N.w / 2, y: frame.y + 230 * k }, { x: N.x + N.w / 2, y: N.y }, 'v'),
    'dom-rec': bz({ x: D.x + D.w / 2, y: D.y + D.h }, { x: D.x + D.w / 2, y: R.y + 14 }, 'v'),
    'png-rec': bz({ x: N.x + N.w / 2, y: N.y + N.h }, { x: R.x + R.w - 30, y: R.y + 14 }, 'v'),
    'rec-out': bz({ x: R.x + R.w, y: R.y + R.h / 2 }, { x: O.x, y: O.y + O.h / 2 }, 'h'),
  };
  if (L.flow === 'v') {
    links['steps-py'] = bz({ x: S.x, y: S.y + S.h * 0.45 }, { x: P.x + P.w, y: P.y + P.h * 0.4 }, 'h');
    links['set-py'] = bz({ x: T.x, y: T.y + T.h / 2 }, { x: P.x + P.w, y: P.y + P.h * 0.8 }, 'h');
    links['py-frame'] = bz({ x: P.x + P.w / 2, y: P.y + P.h }, { x: P.x + P.w / 2, y: frame.y }, 'v');
  } else {
    links['steps-py'] = bz({ x: S.x + S.w / 2, y: S.y }, { x: P.x + P.w / 2, y: P.y + P.h }, 'v');
    links['set-py'] = bz({ x: T.x + T.w * 0.75, y: T.y }, { x: P.x + 14, y: P.y + P.h }, 'v');
    links['py-frame'] = bz({ x: P.x + P.w, y: P.y + P.h / 2 }, { x: frame.x, y: P.y + P.h / 2 }, 'h');
  }
  const chips = {};
  const chipH = L.flow === 'v' ? 30 : 26;
  APIS.forEach((api, i) => { chips[api] = { x: S.x + 8, y: S.y + 44 * (L.flow === 'v' ? 1 : 0.92) + i * (chipH + 8), w: S.w - 16, h: chipH }; });
  // 記録の6つのフォルダー
  const fgap = 10;
  const fw = (R.w - 16 - fgap * 5) / 6;
  const folders = F.counts.map((c, i) => ({ ...c, x: R.x + 8 + i * (fw + fgap), y: R.y + 34, w: fw, h: R.h - 44 }));
  G = { frame, U, el, tokens, rows, anchors, links, chips, folders, half };
}

// ---- 描画の部品 ----------------------------------------------------------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => { const x = clamp01(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const span = (t, a, d) => ease((t - a) / d);
const lerp = (a, b, p) => a + (b - a) * p;
const mixColor = (a, b, p) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], p))).join(',')})`;
};

function rr(x, y, w, h, r) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}
function box(x, y, w, h, r, fill, stroke, lw = 1.5, dash = null) {
  rr(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
function text(s, x, y, size, color, o = {}) {
  ctx.font = `${o.weight || 400} ${size}px ${o.family || SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}
function alpha(a, fn) {
  if (a <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, a);
  fn();
  ctx.restore();
}
function bp(c, t) {
  const u = 1 - t;
  return {
    x: u * u * u * c[0].x + 3 * u * u * t * c[1].x + 3 * u * t * t * c[2].x + t * t * t * c[3].x,
    y: u * u * u * c[0].y + 3 * u * u * t * c[1].y + 3 * u * t * t * c[2].y + t * t * t * c[3].y,
  };
}
function head(tip, from, size, color) {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - size * Math.cos(ang - 0.45), tip.y - size * Math.sin(ang - 0.45));
  ctx.lineTo(tip.x - size * Math.cos(ang + 0.45), tip.y - size * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
function link(c, p, color, lw) {
  if (p <= 0) return;
  ctx.beginPath();
  const n = 40;
  for (let i = 0; i <= n; i += 1) {
    const q = bp(c, (p * i) / n);
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
  const tip = bp(c, p);
  head(tip, bp(c, Math.max(0, p - 0.04)), lw * 4.5, color);
}
function dot(c, p, color, r) {
  if (p <= 0 || p >= 1) return;
  const q = bp(c, p);
  ctx.beginPath();
  ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// 場面ごとの強調（前の場面から0.5秒で移る。29秒からは全体を同じ強さで止める）
const FOCUS = {
  skill: [1, 0.35, 0.28, 0.28, 0.28, 0.28, 1],
  py: [1, 1, 0.5, 0.5, 0.35, 0.35, 1],
  steps: [1, 1, 0.8, 0.8, 0.35, 0.35, 1],
  frame: [1, 1, 1, 1, 0.75, 0.5, 1],
  read: [1, 1, 1, 1, 1, 0.55, 1],
  rec: [1, 1, 1, 1, 1, 1, 1],
  out: [1, 1, 1, 1, 1, 1, 1],
};
function sceneMix(t) {
  for (let k = 1; k < SCENES.length; k += 1) {
    const b = SCENES[k];
    if (t < b - 0.5) return [k - 1, k - 1, 0];
    if (t < b) return [k - 1, k, ease((t - (b - 0.5)) / 0.5)];
  }
  return [6, 6, 0];
}
function fo(name, t) {
  const [i, j, p] = sceneMix(t);
  return Math.max(0.68, lerp(FOCUS[name][i], FOCUS[name][j], p));
}

function titles() {
  return [
    ['手引きを読み、実装する', 'Python実装用の参照スキル'],
    ['Browser → Page → Element', '事前の手順と設定を、Pythonへ'],
    ['文字検索と、条件の指定', 'fill → click ／ select_option'],
    ['チェックして、さらに絞る', '前の条件は引き継ぐ'],
    ['画面から、結果を受け取る', '読み取り専用：evaluate ／ screenshot'],
    ['選んだ結果を、JSONに', `保存済みの記録から${F.sel.id}`],
    ['仕組みを見て、実物を試す', '架空データ／保存済み実行の図解／無音'],
  ];
}

// ---- 時刻ごとの状態（すべて時刻だけから求める） ------------------------------
function formAt(t) {
  let form = { ...DEFAULTS };
  let applied = { ...DEFAULTS };
  for (const s of F.schedule) {
    if (t < s.act) break;
    if (s.a.api === 'fill') {
      const chars = [...s.a.value];
      const n = Math.max(1, Math.ceil(chars.length * clamp01((t - s.act) / 0.35)));
      ({ form, applied } = advance(form, applied, { ...s.a, value: chars.slice(0, n).join('') }));
    } else {
      ({ form, applied } = advance(form, applied, s.a));
    }
  }
  return form;
}
function inFactor(id, t) {
  let v = 1;
  for (const step of F.pool) v = lerp(v, step.ids.has(id) ? 1 : 0, span(t, step.t, 0.4));
  return v;
}
function countAt(t) {
  let c = F.initialCount;
  for (const step of F.pool) if (t >= step.t + 0.2) c = step.count;
  return c;
}
function cursorAt(t) {
  const start = G.U(300, 190);
  let pos = start;
  let prev = start;
  for (const s of F.schedule) {
    if (t < s.move) break;
    const b = G.el[s.a.selector];
    const to = { x: b.x + b.w * 0.7, y: b.y + b.h * 0.55 };
    const p = span(t, s.move, s.md);
    pos = { x: lerp(prev.x, to.x, p), y: lerp(prev.y, to.y, p) };
    prev = to;
  }
  return pos;
}
function activeSteps(t) {
  return F.schedule.filter((s) => t >= s.move && t <= s.act + 0.6);
}

// ---- 一枚の図を描く --------------------------------------------------------
function drawHeader(t) {
  const f = L.f;
  text('Studio Yebisu × Browser Use', L.kicker.x, L.kicker.y, f.kicker, C.muted);
  const T = titles();
  const [i, j, p] = sceneMix(t);
  const one = (k, a, dy) => alpha(a, () => {
    text(T[k][0], L.title.x, L.title.y + dy, f.title, C.ink, { weight: 700, family: SERIF });
    text(T[k][1], L.sub.x, L.sub.y + dy, f.sub, C.petrol, { weight: 700 });
  });
  if (i === j) one(i, 1, 0);
  else { one(i, 1 - p, -8 * p); one(j, p, 8 * (1 - p)); }
}

function drawLinks(t) {
  const g = G.links;
  alpha(fo('skill', t), () => {
    link(g['book-a'], span(t, 2.2, 0.8), C.ink, 2);
    link(g['book-b'], span(t, 2.35, 0.8), C.ink, 2);
  });
  alpha(fo('steps', t), () => {
    link(g['steps-py'], span(t, 4.7, 0.5), C.ink, 2);
    link(g['set-py'], span(t, 5.0, 0.5), C.ink, 2);
  });
  alpha(Math.max(fo('py', t), fo('frame', t)), () => link(g['py-frame'], span(t, 6.0, 0.6), C.ink, 2.2));
  alpha(fo('read', t), () => {
    link(g['page-dom'], span(t, 20.2, 0.7), C.petrol, 2.4);
    link(g['page-png'], span(t, 20.35, 0.7), C.petrol, 2.4);
    link(g['dom-rec'], span(t, 21.5, 0.6), C.petrol, 2.4);
    link(g['png-rec'], span(t, 21.6, 0.6), C.petrol, 2.4);
  });
  alpha(fo('out', t), () => link(g['rec-out'], span(t, 25.3, 0.6), C.petrol, 2.4));
}

function drawBook(t) {
  const B = L.book;
  const f = L.f;
  const half = G.half;
  const spine = B.x + half;
  const open = span(t, 0.2, 1.2);
  alpha(fo('skill', t), () => {
    box(spine, B.y, half, B.h, 6, C.card, C.ink, 1.6);
    // 話題の行：今回読んだActorとBrowserは栞として外へ伸びる
    G.rows.forEach((r, i) => {
      if (r.chosen) {
        const grow = span(t, 1.6 + (r.file === 'browser' ? 0.15 : 0), 0.8);
        const w = lerp(half - 20, half + 18, grow);
        alpha(span(t, 1.0 + i * 0.07, 0.4), () => {
          box(spine + 8, r.y, w, r.h, 5, mixColor(C.line, C.amberSoft, grow), grow > 0.05 ? C.amber : null, 1.6);
          alpha(grow, () => text(r.file === 'actor' ? 'Actor' : 'Browser', spine + 16, r.y + r.h * 0.72, f.b, C.ink, { weight: 700 }));
        });
      } else {
        alpha(span(t, 1.0 + i * 0.07, 0.4), () => box(spine + 10, r.y, half - 24, r.h, 2, C.line, null));
      }
    });
    // 表紙が左へ開き、左のページになる
    const c = Math.cos(Math.PI * open);
    if (c > 0) {
      box(spine, B.y, half * c, B.h, 6, C.petrol, C.ink, 1.6);
      alpha((c - 0.5) * 2, () => {
        text('手引き', spine + 14, B.y + B.h * 0.42, f.h, C.paper, { weight: 700 });
        text('SKILL.md', spine + 14, B.y + B.h * 0.42 + f.m * 1.6, f.m, C.paper, { family: MONO });
      });
    } else {
      const w = half * -c;
      box(spine - w, B.y, w, B.h, 6, C.card, C.ink, 1.6);
      alpha((-c - 0.6) * 2.5, () => {
        const x = B.x + 14;
        text('SKILL.md', x, B.y + 28, f.m, C.muted, { family: MONO });
        text('手引き', x, B.y + 28 + f.h * 1.35, f.h, C.ink, { weight: 700 });
        text('参照スキル', x, B.y + 28 + f.h * 1.35 + f.s * 1.5, f.s, C.muted);
        text('Python用', x, B.y + 28 + f.h * 1.35 + f.s * 2.7, f.s, C.muted);
      });
    }
  });
  // 実行していない分岐：小さく、破線で
  const Gh = L.ghost;
  alpha(span(t, 3.1, 0.5) * 0.9 * Math.max(0.55, fo('skill', t)), () => {
    box(Gh.x, Gh.y, Gh.w, Gh.h, 8, null, C.muted, 1.4, [6, 5]);
    text('Agent.run（LLM判断）は未実行', Gh.x + 12, Gh.y + Gh.h * 0.68, f.s * (L.flow === 'h' ? 0.9 : 1), C.muted);
  });
}

function drawPython(t) {
  const P = L.py;
  const f = L.f;
  const a = span(t, 2.5, 0.6);
  alpha(a * fo('py', t), () => {
    const fold = 18;
    ctx.beginPath();
    ctx.moveTo(P.x, P.y);
    ctx.lineTo(P.x + P.w - fold, P.y);
    ctx.lineTo(P.x + P.w, P.y + fold);
    ctx.lineTo(P.x + P.w, P.y + P.h);
    ctx.lineTo(P.x, P.y + P.h);
    ctx.closePath();
    ctx.fillStyle = C.card;
    ctx.fill();
    const glow = span(t, 5.5, 0.3) * (1 - span(t, 6.3, 0.4));
    ctx.lineWidth = 1.8 + glow * 2;
    ctx.strokeStyle = mixColor(C.ink, C.amber, glow);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(P.x + P.w - fold, P.y);
    ctx.lineTo(P.x + P.w - fold, P.y + fold);
    ctx.lineTo(P.x + P.w, P.y + fold);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    const top = P.y + 16 + f.h;
    const step = (P.y + P.h - 14 - top) / 4;
    text('Python', P.x + 14, top, f.h, C.ink, { weight: 700 });
    ['Browser(…)', 'new_page(…)', '.fill .click'].forEach((s, i) => {
      alpha(span(t, 2.9 + i * 0.2, 0.4), () => text(s, P.x + 14, top + step * (i + 1), f.m, C.petrol, { family: MONO }));
    });
    text('run_browser.py', P.x + 14, P.y + P.h - 14, f.m * 0.92, C.muted, { family: MONO });
  });
}

function drawSteps(t) {
  const S = L.steps;
  const T = L.set;
  const f = L.f;
  const act = activeSteps(t);
  alpha(span(t, 4.0, 0.6) * fo('steps', t), () => {
    box(S.x, S.y, S.w, S.h, 10, C.card, C.ink, 1.6);
    text('事前の手順', S.x + 12, S.y + 30, f.b, C.ink, { weight: 700 });
    APIS.forEach((api, i) => {
      const c = G.chips[api];
      const a = span(t, 4.2 + i * 0.12, 0.35);
      const on = act.some((s) => s.a.api === api) ? 1 : 0;
      alpha(a, () => {
        const dx = (1 - a) * 40;
        box(c.x + dx, c.y, c.w, c.h, c.h / 2, on ? C.amberSoft : C.paper, on ? C.amber : C.line, on ? 2.2 : 1.4);
        text(`${api} ×${F.totals[api]}`, c.x + dx + 12, c.y + c.h * 0.5 + f.chip * 0.36, f.chip, C.ink, { weight: on ? 700 : 400 });
      });
    });
  });
  alpha(span(t, 4.6, 0.5) * fo('steps', t), () => {
    box(T.x, T.y, T.w, T.h, T.h / 2, C.paper, C.line, 1.4);
    text('Browser設定', T.x + T.w / 2, T.y + T.h * 0.5 + f.chip * 0.36, f.chip, C.ink, { align: 'center' });
  });
}

function drawBrowser(t) {
  const Fm = G.frame;
  const k = Fm.k;
  const f = L.f;
  const a = span(t, 6.4, 0.9);
  if (a <= 0) return;
  const tip = G.links['py-frame'][3];
  alpha(a * fo('frame', t), () => {
    ctx.save();
    const sc = 0.55 + 0.45 * a;
    ctx.translate(tip.x, tip.y);
    ctx.scale(sc, sc);
    ctx.translate(-tip.x, -tip.y);
    box(Fm.x, Fm.y, Fm.w, Fm.h, 10 * k, C.card, C.ink, 2);
    ctx.beginPath();
    ctx.moveTo(Fm.x, Fm.y + 22 * k);
    ctx.lineTo(Fm.x + Fm.w, Fm.y + 22 * k);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = C.line;
    ctx.stroke();
    for (const cx of [12, 22, 32]) {
      const p = G.U(cx, 11);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * k, 0, Math.PI * 2);
      ctx.fillStyle = C.line;
      ctx.fill();
    }
    alpha(span(t, 6.9, 0.4), () => {
      const p = G.U(44, 16);
      text('Browser', p.x, p.y, 12 * k, C.ink, { weight: 700 });
      text('= BrowserSession', p.x + 56 * k, p.y, 9.5 * k, C.muted, { family: MONO });
    });
    // Page
    const pa = span(t, 7.0, 0.7);
    alpha(pa, () => {
      const p = G.U(8, 28);
      const inset = (1 - pa) * 14 * k;
      box(p.x + inset, p.y + inset, 328 * k - inset * 2, 202 * k - inset * 2, 6 * k, C.paper, C.petrol, 1.6);
      const lp = G.U(16, 43);
      text('Page', lp.x, lp.y, 12 * k, C.petrol, { weight: 700 });
      text('fixture.html', lp.x + 34 * k, lp.y, 9.5 * k, C.muted, { family: MONO });
    });
    drawElements(t);
    drawTokens(t);
    ctx.restore();
  });
}

function drawElements(t) {
  const k = G.frame.k;
  const form = formAt(t);
  const act = activeSteps(t);
  EL_ORDER.forEach((sel, i) => {
    const b = G.el[sel];
    const a = span(t, 7.7 + i * 0.08, 0.35);
    alpha(a, () => {
      const s = 0.7 + 0.3 * a;
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.scale(s, s);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      const ty = b.y + b.h * 0.5 + 4.3 * k;
      if (sel === '#search' || sel === '#area' || sel === '#budget') {
        box(b.x, b.y, b.w, b.h, 4 * k, C.card, C.muted, 1.3);
        let v = '';
        let muted = false;
        if (sel === '#search') { v = form.keyword || 'キーワード'; muted = !form.keyword; }
        if (sel === '#area') { v = form.area || 'すべて'; muted = !form.area; }
        if (sel === '#budget') { v = form.budget ? `${form.budget}円以内` : '指定なし'; muted = !form.budget; }
        text(v, b.x + 6 * k, ty, 12 * k, muted ? C.muted : C.ink);
        if (sel !== '#search') text('▾', b.x + b.w - 5 * k, ty, 9 * k, C.muted, { align: 'right' });
      } else if (sel === '#saturday' || sel === '#power') {
        const on = sel === '#saturday' ? form.saturday : form.power;
        box(b.x + 2 * k, b.y + 4 * k, 14 * k, 14 * k, 3 * k, on ? C.petrol : C.card, on ? C.petrol : C.muted, 1.3);
        if (on) {
          ctx.beginPath();
          ctx.moveTo(b.x + 5 * k, b.y + 11 * k);
          ctx.lineTo(b.x + 8 * k, b.y + 14 * k);
          ctx.lineTo(b.x + 14 * k, b.y + 7 * k);
          ctx.lineWidth = 2.2 * k * 0.8;
          ctx.strokeStyle = C.paper;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        text(sel === '#saturday' ? '土曜' : '電源あり', b.x + 20 * k, ty, 12 * k, C.ink);
      } else if (sel === '#apply') {
        box(b.x, b.y, b.w, b.h, b.h / 2, C.petrol, C.petrol, 1);
        text('探す', b.x + b.w / 2, ty, 12 * k, C.paper, { weight: 700, align: 'center' });
      } else {
        box(b.x, b.y, b.w, b.h, b.h / 2, C.card, C.petrol, 1.3);
        text('リセット', b.x + b.w / 2, ty, 12 * k, C.petrol, { align: 'center' });
      }
      ctx.restore();
    });
  });
  // Element：いま操作している部品を指す
  alpha(span(t, 8.2, 0.4), () => {
    const lp = G.U(328, 43);
    text('Element', lp.x, lp.y, 12 * k, C.amberText, { weight: 700, align: 'right' });
    const done = F.schedule.filter((s) => t >= s.move);
    const cur = done.length ? done[done.length - 1].a.selector : '#search';
    const b = G.el[cur];
    ctx.beginPath();
    ctx.moveTo(lp.x - 52 * k, lp.y + 4 * k);
    ctx.lineTo(b.x + b.w - 4 * k, b.y - 2 * k);
    ctx.setLineDash([3 * k, 3 * k]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = C.amber;
    ctx.stroke();
    ctx.setLineDash([]);
  });
  for (const s of act) {
    const b = G.el[s.a.selector];
    const ra = span(t, s.move, 0.2) * (1 - span(t, s.act + 0.4, 0.2));
    alpha(ra, () => {
      box(b.x - 3 * k, b.y - 3 * k, b.w + 6 * k, b.h + 6 * k, 7 * k, null, C.amber, 3);
      text(s.a.api, b.x, b.y - 5 * k, 11 * k, C.amberText, { weight: 700 });
    });
    if (s.a.api === 'click') {
      const p = clamp01((t - s.act) / 0.35);
      if (p > 0 && p < 1) {
        alpha(1 - p, () => {
          ctx.beginPath();
          ctx.arc(b.x + b.w * 0.7, b.y + b.h * 0.55, (6 + 22 * p) * k * 0.6, 0, Math.PI * 2);
          ctx.lineWidth = 3;
          ctx.strokeStyle = C.amber;
          ctx.stroke();
        });
      }
    }
  }
}

function drawToken(x, y, w, h, id, v, power, size) {
  box(x, y, w, h, 5, mixColor(C.paper, C.petrol, v), mixColor(C.line, C.petrol, v), 1.4);
  text(id, x + w / 2, y + h * 0.5 + size * 0.36, size, v > 0.5 ? C.paper : C.muted, { weight: 700, align: 'center' });
  if (!power) {
    ctx.beginPath();
    ctx.moveTo(x + w - h * 0.42, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h * 0.42);
    ctx.closePath();
    ctx.fillStyle = C.amber;
    ctx.fill();
  }
}

function drawTokens(t) {
  const k = G.frame.k;
  const pool = F.pool;
  const s05 = pool.find((p) => p.sid === 'S05');
  const s06 = pool.find((p) => p.sid === 'S06');
  const hiNoPower = span(t, 10.9, 0.3) * (1 - span(t, 12.6, 0.3));
  G.tokens.forEach((tk, i) => {
    const a = span(t, 8.3 + i * 0.04, 0.35);
    alpha(a, () => {
      const v = inFactor(tk.id, t);
      const s = 0.86 + 0.14 * v;
      ctx.save();
      ctx.translate(tk.x + tk.w / 2, tk.y + tk.h / 2);
      ctx.scale(s, s);
      ctx.translate(-(tk.x + tk.w / 2), -(tk.y + tk.h / 2));
      drawToken(tk.x, tk.y, tk.w, tk.h, tk.id, v, tk.power, 12 * k);
      if (!tk.power && hiNoPower > 0) alpha(hiNoPower, () => box(tk.x - 3 * k, tk.y - 3 * k, tk.w + 6 * k, tk.h + 6 * k, 6 * k, null, C.amber, 3));
      ctx.restore();
    });
  });
  const emptyA = span(t, s05.t + 0.1, 0.25) * (1 - span(t, s06.t - 0.1, 0.2));
  alpha(emptyA, () => {
    const p = G.U(16, 128);
    box(p.x, p.y, 316 * k, 48 * k, 6 * k, C.card, C.amber, 2, [8, 6]);
    const c = G.U(174, 157);
    text('0件・該当なし（正常な結果）', c.x, c.y, 12.5 * k, C.ink, { weight: 700, align: 'center' });
  });
  alpha(span(t, 8.8, 0.3), () => {
    const p = G.U(16, 201);
    text(`該当 ${countAt(t)}件`, p.x, p.y, 15 * k, C.ink, { weight: 700 });
    const q = G.U(328, 201);
    text('説明に電源なし', q.x, q.y, 10 * k, C.muted, { align: 'right' });
    const m = G.U(250, 192);
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x + 9 * k, m.y);
    ctx.lineTo(m.x + 9 * k, m.y + 9 * k);
    ctx.closePath();
    ctx.fillStyle = C.amber;
    ctx.fill();
  });
}

function drawConnectors(t) {
  // 事前の手順の行 → 操作するElement
  for (const s of activeSteps(t)) {
    const c = G.chips[s.a.api];
    const b = G.el[s.a.selector];
    const a = span(t, s.move + 0.05, 0.2) * (1 - span(t, s.act + 0.35, 0.25)) * 0.9;
    alpha(a, () => {
      ctx.beginPath();
      if (L.flow === 'v') {
        ctx.moveTo(c.x + c.w * 0.3, c.y + c.h);
        ctx.lineTo(b.x + b.w / 2, b.y - 4);
      } else {
        ctx.moveTo(c.x + c.w, c.y + c.h / 2);
        ctx.lineTo(b.x, b.y + b.h / 2);
      }
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.amber;
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
}

function drawCursor(t) {
  const a = span(t, 9.0, 0.3) * (1 - span(t, 20.0, 0.4));
  if (a <= 0) return;
  const p = cursorAt(t);
  const s = G.frame.k * 1.15;
  alpha(a, () => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(4.5, 12);
    ctx.lineTo(7.5, 19);
    ctx.lineTo(10.5, 17.8);
    ctx.lineTo(7.6, 11);
    ctx.lineTo(13, 11);
    ctx.closePath();
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = C.card;
    ctx.stroke();
    ctx.restore();
  });
}

function drawCallouts(t) {
  const Z = L.callout;
  const f = L.f;
  const k = G.frame.k;
  const tokW = 30 * k, tokH = 16 * k;
  // S02：「電源なし」の説明も文字「電源」に一致
  const a1 = span(t, 10.9, 0.3) * (1 - span(t, 12.6, 0.3));
  alpha(a1, () => {
    box(Z.x, Z.y, Z.w, Z.stack ? 120 : Z.h, 10, C.card, C.amber, 1.8);
    F.noPowerS02.forEach((id, i) => drawToken(Z.x + 12 + i * (tokW + 8), Z.y + 12, tokW, tokH, id, 1, false, f.s * 0.8));
    if (Z.stack) {
      text('説明の「電源なし」も', Z.x + 12, Z.y + 12 + tokH + f.s * 1.6, f.s, C.ink, { weight: 700 });
      text('文字「電源」に一致', Z.x + 12, Z.y + 12 + tokH + f.s * 2.9, f.s, C.ink, { weight: 700 });
    } else {
      text('説明の「電源なし」も文字「電源」に一致', Z.x + 12 + F.noPowerS02.length * (tokW + 8) + 4, Z.y + Z.h / 2 + f.s * 0.36, f.s, C.ink, { weight: 700 });
    }
  });
  // S04：残った2件の名前と料金
  const a2 = span(t, 16.2, 0.3) * (1 - span(t, 17.9, 0.3));
  alpha(a2, () => {
    const n = F.s04.length;
    F.s04.forEach((r, i) => {
      const w = Z.stack ? Z.w : (Z.w - 12 * (n - 1)) / n;
      const h = Z.stack ? 104 : Z.h;
      const x = Z.stack ? Z.x : Z.x + i * (w + 12);
      const y = Z.stack ? Z.y + i * (h + 14) : Z.y;
      box(x, y, w, h, 10, C.card, C.petrol, 1.8);
      drawToken(x + 10, y + 10, tokW, tokH, r.id, 1, true, f.s * 0.8);
      if (Z.stack) {
        text(r.price, x + w - 12, y + 10 + tokH * 0.8, f.b, C.ink, { weight: 700, align: 'right' });
        text(r.name, x + 12, y + h - 22, f.b, C.ink, { weight: 700 });
      } else {
        text(r.name, x + 20 + tokW, y + 10 + tokH * 0.85, f.b, C.ink, { weight: 700 });
        text(`1時間 ${r.price}`, x + 20 + tokW, y + h - 14, f.s, C.muted);
      }
      // 席から名前の札へ
      const tk = G.tokens.find((q) => q.id === r.id);
      ctx.beginPath();
      ctx.moveTo(tk.x + tk.w / 2, tk.y + tk.h);
      ctx.lineTo(Z.stack ? x : x + w / 2, Z.stack ? y + h / 2 : y);
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = C.petrol;
      ctx.stroke();
      ctx.setLineDash([]);
    });
  });
}

function drawRead(t) {
  const f = L.f;
  const D = L.dom, N = L.png;
  alpha(fo('read', t), () => {
    alpha(span(t, 20.6, 0.5), () => {
      box(D.x, D.y, D.w, D.h, 10, C.petrolSoft, C.petrol, 1.6);
      text('</>', D.x + 14, D.y + D.h * 0.5 + f.b * 0.36, f.b, C.petrol, { weight: 700, family: MONO });
      text('実DOMを読む', D.x + 14 + f.b * 2.2, D.y + D.h * 0.45, f.b, C.ink, { weight: 700 });
      text('Page.evaluate', D.x + 14 + f.b * 2.2, D.y + D.h * 0.45 + f.m * 1.3, f.m, C.muted, { family: MONO });
    });
    alpha(span(t, 20.8, 0.5), () => {
      box(N.x, N.y, N.w, N.h, 10, C.petrolSoft, C.petrol, 1.6);
      const iw = f.b * 1.6, ih = f.b * 1.15;
      const ix = N.x + 14, iy = N.y + (N.h - ih) / 2;
      box(ix, iy, iw, ih, 3, C.card, C.petrol, 1.4);
      ctx.fillStyle = C.petrol;
      ctx.fillRect(ix, iy, iw, ih * 0.22);
      text('画面PNG ×6', ix + iw + 10, N.y + N.h * 0.45, f.b, C.ink, { weight: 700 });
      text('Page.screenshot', ix + iw + 10, N.y + N.h * 0.45 + f.m * 1.3, f.m, C.muted, { family: MONO });
    });
    // 読み取った値が記録へ流れる
    for (let j = 0; j < 3; j += 1) {
      dot(G.links['page-dom'], clamp01((t - (21.0 + j * 0.2)) / 0.7), C.petrol, 6);
      dot(G.links['page-png'], clamp01((t - (21.05 + j * 0.2)) / 0.7), C.petrol, 6);
      dot(G.links['dom-rec'], clamp01((t - (22.0 + j * 0.2)) / 0.6), C.petrol, 6);
      dot(G.links['png-rec'], clamp01((t - (22.05 + j * 0.2)) / 0.6), C.petrol, 6);
    }
  });
}

function drawRecord(t) {
  const R = L.rec;
  const f = L.f;
  alpha(span(t, 21.8, 0.6) * fo('rec', t), () => {
    box(R.x, R.y + 12, R.w, R.h - 12, 10, C.card, C.ink, 1.6);
    box(R.x, R.y, f.m * 0.6 * 17 + 16, 24, 6, C.card, C.ink, 1.6);
    text('browser-run.json', R.x + 8, R.y + 17, f.m, C.ink, { family: MONO });
    const hl = span(t, 25.0, 0.5);
    G.folders.forEach((fd, i) => {
      const a = span(t, 22.2 + i * 0.25, 0.35);
      const on = fd.id === F.sel.id ? hl : 0;
      alpha(a, () => {
        const y = fd.y - 8 * on + (1 - a) * 12;
        box(fd.x, y, fd.w * 0.42, 12, 3, mixColor(C.paper, C.amberSoft, on), mixColor(C.muted, C.amber, on), 1.3);
        box(fd.x, y + 6, fd.w, fd.h - 6, 5, mixColor(C.paper, C.amberSoft, on), mixColor(C.muted, C.amber, on), 1.3 + on * 1.4);
        text(fd.id, fd.x + fd.w / 2, y + 6 + f.m * 1.6, f.m, C.ink, { family: MONO, align: 'center' });
        text(String(fd.count), fd.x + fd.w / 2, y + 6 + (fd.h - 6) * 0.68, f.big * 0.95, C.ink, { weight: 700, align: 'center' });
        text('件', fd.x + fd.w / 2, y + fd.h - 8, f.s * 0.85, C.muted, { align: 'center' });
      });
    });
  });
  // 期待IDは照合の段だけ。出力の値の出どころではない
  const Ck = L.check;
  alpha(span(t, 23.7, 0.5) * 0.95, () => {
    box(Ck.x, Ck.y, Ck.w, Ck.h, 8, null, C.muted, 1.3, [6, 5]);
    if (L.callout.stack) {
      text('✓ 期待IDは照合だけ', Ck.x + 12, Ck.y + Ck.h * 0.42, f.s, C.muted, { weight: 700 });
      text('値は実DOMから', Ck.x + 12, Ck.y + Ck.h * 0.42 + f.s * 1.25, f.s, C.muted);
    } else {
      text('✓ 期待IDは照合だけ（値は実DOM）', Ck.x + 12, Ck.y + Ck.h * 0.5 + f.s * 0.36, f.s, C.muted);
    }
  });
}

function drawOutput(t) {
  const O = L.out;
  const f = L.f;
  const k = G.frame.k;
  const a = span(t, 25.5, 0.6);
  alpha(a * fo('out', t), () => {
    const fold = 18;
    ctx.beginPath();
    ctx.moveTo(O.x, O.y);
    ctx.lineTo(O.x + O.w - fold, O.y);
    ctx.lineTo(O.x + O.w, O.y + fold);
    ctx.lineTo(O.x + O.w, O.y + O.h);
    ctx.lineTo(O.x, O.y + O.h);
    ctx.closePath();
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.amber;
    ctx.stroke();
    alpha(span(t, 26.4, 0.5), () => {
      text(F.sel.id, O.x + 12, O.y + f.h + 10, f.h, C.ink, { weight: 700 });
      text(`${F.sel.count}件`, O.x + 12, O.y + f.h + 12 + f.big, f.big, C.ink, { weight: 700 });
    });
    alpha(span(t, 26.8, 0.5), () => text('selection.json', O.x + 10, O.y + O.h - 12, f.m * 0.88, C.muted, { family: MONO }));
  });
  // S04の2件が、記録のフォルダーから保存JSONへ移る
  const fd = G.folders.find((x) => x.id === F.sel.id);
  const tokW = (O.w - 32) / 2;
  const tokH = 15 * k;
  F.sel.ids.forEach((id, j) => {
    const p = span(t, 25.9 + j * 0.15, 0.9);
    if (p <= 0) return;
    const from = { x: fd.x + fd.w / 2 - tokW / 2, y: fd.y + fd.h * 0.3 };
    const to = { x: O.x + 10 + j * (tokW + 12), y: O.y + O.h - 22 - tokH - f.m * 0.6 };
    const x = lerp(from.x, to.x, p);
    const y = lerp(from.y, to.y, p) - Math.sin(Math.PI * p) * 50;
    const item = F.items.find((it) => it.id === id);
    alpha(Math.max(fo('out', t), 0.6), () => drawToken(x, y, tokW, tokH, id, 1, item.power, f.s * 0.8));
  });
  // 作例ページの保存につながる（映像の中の操作部品ではない）
  const Sv = L.save;
  alpha(span(t, 27.4, 0.7), () => {
    const cx = Sv.x + 16, cy = Sv.y + Sv.h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy + 4);
    ctx.moveTo(cx - 7, cy - 3);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(cx + 7, cy - 3);
    ctx.moveTo(cx - 11, cy + 10);
    ctx.lineTo(cx + 11, cy + 10);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.petrol;
    ctx.stroke();
    if (L.callout.stack) {
      text('作例ページで', cx + 22, Sv.y + Sv.h * 0.42, f.s, C.petrol, { weight: 700 });
      text('保存できる', cx + 22, Sv.y + Sv.h * 0.42 + f.s * 1.25, f.s, C.petrol, { weight: 700 });
    } else {
      text('ページで保存', cx + 20, cy + f.s * 0.36, f.s * 0.9, C.petrol, { weight: 700 });
    }
  });
}

function drawPulses(t) {
  const g = G.links;
  alpha(fo('skill', t), () => {
    dot(g['book-a'], clamp01((t - 2.6) / 0.6), C.amber, 6);
    dot(g['book-b'], clamp01((t - 2.75) / 0.6), C.amber, 6);
  });
  for (let j = 0; j < 4; j += 1) dot(g['steps-py'], clamp01((t - (5.0 + j * 0.15)) / 0.6), C.amber, 6);
  dot(g['set-py'], clamp01((t - 5.4) / 0.6), C.amber, 6);
  dot(g['py-frame'], clamp01((t - 6.3) / 0.5), C.amber, 6);
}

function drawFooter(t) {
  alpha(span(t, 28.5, 0.5), () => {
    text(`Browser Use ${F.version}（${F.commit}）・MIT・Gregor Zunic`, L.foot.x, L.foot.y, L.foot.size, C.muted);
  });
}

function drawFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!F || !G) return;
  const s = Math.min(canvas.width / L.W, canvas.height / L.H);
  ctx.setTransform(s, 0, 0, s, (canvas.width - L.W * s) / 2, (canvas.height - L.H * s) / 2);
  ctx.save();
  drawHeader(t);
  // 制作側のフレームレビュー補正：最初の手引きを大きく、同じ図の位置へ戻す。
  // シーンや資料・操作結果は変えず、0〜4秒の空白と小さい本の表示だけを調整する。
  ctx.save();
  const opening = 1 - span(t, 2.8, 1.2);
  if (opening > 0) {
    if (layoutName === 'portrait') {
      ctx.translate(-13.6 * opening, 45.8 * opening);
      ctx.scale(1 + 0.45 * opening, 1 + 0.45 * opening);
    } else {
      ctx.translate(152 * opening, -100 * opening);
      ctx.scale(1 + opening, 1 + opening);
    }
  }
  drawLinks(t);
  drawBook(t);
  drawPython(t);
  drawSteps(t);
  drawBrowser(t);
  drawRead(t);
  drawRecord(t);
  drawOutput(t);
  drawCallouts(t);
  drawConnectors(t);
  drawCursor(t);
  drawPulses(t);
  ctx.restore();
  drawFooter(t);
  ctx.restore();
}

// ---- 時間の契約 -------------------------------------------------------------
let ready = false;
let current = 0;

window.seek = (seconds) => {
  const t = Math.min(DURATION, Math.max(0, Number(seconds) || 0));
  if (!ready) return Promise.resolve(window.motionReady).then(() => window.seek(t));
  current = t;
  drawFrame(t);
  if (!RENDER) updateUi(t);
  return Promise.resolve();
};

// ---- 編集用の画面 -------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const ui = {
  play: $('play'), reset: $('reset'), replay: $('replay'), end: $('end'), time: $('time'), clock: $('clock'),
  jumps: [...document.querySelectorAll('[data-jump]')], layouts: [...document.querySelectorAll('button[data-layout]')],
  status: $('status'), detail: $('detail'), retry: $('retry'), caption: $('caption'), assets: $('assets'), assetCount: $('asset-count'),
};
let playing = false;
let raf = 0;
let wall0 = 0;
let t0 = 0;
let lastScene = -1;

function sceneIndex(t) {
  let i = 0;
  for (let k = 0; k < SCENES.length; k += 1) if (t >= SCENES[k]) i = k;
  return i;
}

function captionsFor() {
  const by = F.by;
  const s04 = F.s04.map((r) => `${r.id} ${r.name} ${r.price}`).join('、');
  const c3 = by.S03.conditions;
  return [
    '0〜4秒：手引き（参照スキルSKILL.md）が開き、話題の表からActorとBrowserの文書が栞として出て、Pythonのrun_browser.pyへつながる。Agent.run（LLMの判断）は実行していない。',
    `4〜9秒：事前の手順（${APIS.map((a) => `${a} ${F.totals[a]}回`).join('・')}）とBrowser設定がPythonへ入り、Browserの中にPage、その中に入力欄・選択・チェック・ボタンのElementが開く。最初の一覧は${by.S01.result_count}件。`,
    `9〜14秒：検索欄へ「${by.S02.conditions.keyword}」をfillしてclick。説明に「電源なし」とある${F.noPowerS02.join('・')}も文字で一致し${by.S02.result_count}件のまま。${c3.area}・${c3.budget}円以内をselect_optionしてclickし、${by.S03.result_count}件。`,
    `14〜20秒：土曜と電源ありをcheckしてclickし、前の条件のまま${by.S04.result_count}件（${s04}）。存在しない条件で0件（正常な結果）、リセットで${by.S06.result_count}件に戻る。`,
    `20〜25秒：読み取り専用のPage.evaluateとPage.screenshotで、実DOMと画面PNGを受け取り、6状態を記録（${F.counts.map((c) => c.count).join('・')}件）。期待IDは照合だけに使う。`,
    `25〜29秒：保存済みの記録から${F.sel.id}を選び、${F.sel.count}件（${F.sel.ids.join('・')}）をbrowser-selection.jsonへ。作例ページで保存できる。`,
    '29〜32秒：手引き→Python＋事前の手順→Browser・Page・Element→実DOMと画面PNG→保存した結果、の全体で止まる。架空データ・保存済み実行の図解・無音。',
  ];
}

function updateUi(t) {
  if (!ui.time) return;
  ui.time.value = t.toFixed(1);
  ui.time.setAttribute('aria-valuetext', `${t.toFixed(1)}秒（全${DURATION}秒）`);
  ui.clock.textContent = `${t.toFixed(1)}秒 / ${DURATION.toFixed(1)}秒`;
  const i = sceneIndex(t);
  if (F && i !== lastScene) {
    lastScene = i;
    const c = captionsFor()[i];
    ui.caption.textContent = c;
    canvas.setAttribute('aria-label', `無音の図解映像。${c}`);
  }
  for (const b of ui.jumps) b.setAttribute('aria-current', String(Number(b.dataset.jump) === SCENES[i]));
}

function setControls(on) {
  for (const b of [ui.play, ui.reset, ui.replay, ui.end, ui.time, ...ui.jumps, ...ui.layouts]) if (b) b.disabled = !on;
}

function pause() {
  playing = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (ui.play) { ui.play.textContent = '再生'; ui.play.setAttribute('aria-pressed', 'false'); }
}
function play() {
  if (RENDER || !ready) return;
  if (current >= DURATION) current = 0;
  playing = true;
  wall0 = performance.now();
  t0 = current;
  ui.play.textContent = '一時停止';
  ui.play.setAttribute('aria-pressed', 'true');
  const tick = (now) => {
    if (!playing) return;
    const t = t0 + (now - wall0) / 1000;
    if (t >= DURATION) { window.seek(DURATION); pause(); return; }
    window.seek(t);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function setLayout(name) {
  if (RENDER || !SIZES[name]) return;
  layoutName = name;
  [WIDTH, HEIGHT] = SIZES[name];
  window.motionConfig.width = WIDTH;
  window.motionConfig.height = HEIGHT;
  sizeCanvas();
  for (const b of ui.layouts) b.setAttribute('aria-pressed', String(b.dataset.layout === name));
  if (F) geometry();
  lastScene = -1;
  window.seek(current);
}

function showAssets() {
  if (!ui.assets) return;
  ui.assets.replaceChildren(...F.files.map((f) => {
    const li = document.createElement('li');
    li.textContent = `${f.path}　${f.bytes.toLocaleString('en-US')} bytes　${f.sha256.slice(0, 12)}…　一致`;
    return li;
  }));
  ui.assets.hidden = false;
  ui.assetCount.textContent = `${F.files.length}/${ASSET_PATHS.length}`;
}

let loadToken = 0;
function load() {
  const token = ++loadToken;
  ready = false;
  F = null;
  G = null;
  lastScene = -1;
  pause();
  setControls(false);
  drawFrame(0); // 失敗やり直しの間も古い図を残さない
  if (!RENDER) {
    ui.status.dataset.state = 'loading';
    ui.status.textContent = '18ファイルを確かめています…';
    ui.detail.textContent = '';
    ui.retry.hidden = true;
    ui.caption.textContent = '';
    if (ui.assets) { ui.assets.replaceChildren(); ui.assets.hidden = true; }
    if (ui.assetCount) ui.assetCount.textContent = `0/${ASSET_PATHS.length}`;
  }
  const work = (async () => {
    const v = await loadAndValidate();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    if (token !== loadToken) return;
    F = prepareFilm(v);
    geometry();
    ready = true;
    window.seek(RENDER ? 0 : current);
    if (!RENDER) {
      ui.status.dataset.state = 'ready';
      ui.status.textContent = `${ASSET_PATHS.length}/${ASSET_PATHS.length}ファイルのバイト数とSHA-256、中身の照合が通りました。停止した状態から始まります。`;
      setControls(true);
      showAssets();
    }
  })();
  work.catch((err) => {
    if (token !== loadToken) return;
    F = null;
    G = null;
    drawFrame(0);
    if (!RENDER) {
      ui.status.dataset.state = 'error';
      ui.status.textContent = '素材を照合できなかったため、映像を描きません。';
      ui.detail.textContent = `${err instanceof Fail ? err.message : '予期しないエラー'}。代わりの素材は使いません。`;
      ui.retry.hidden = false;
      ui.retry.disabled = false;
    }
  });
  window.motionReady = work;
  return work;
}

if (!RENDER) {
  ui.play.addEventListener('click', () => (playing ? pause() : play()));
  ui.reset.addEventListener('click', () => { pause(); window.seek(0); });
  ui.replay.addEventListener('click', () => { pause(); window.seek(0); play(); });
  ui.end.addEventListener('click', () => { pause(); window.seek(DURATION); });
  ui.time.addEventListener('input', () => { pause(); window.seek(Number(ui.time.value)); });
  for (const b of ui.jumps) b.addEventListener('click', () => { pause(); window.seek(Number(b.dataset.jump)); });
  for (const b of ui.layouts) b.addEventListener('click', () => setLayout(b.dataset.layout));
  for (const b of ui.layouts) b.setAttribute('aria-pressed', String(b.dataset.layout === layoutName));
  ui.retry.addEventListener('click', () => { load().catch(() => {}); });
}

load().catch(() => {});
