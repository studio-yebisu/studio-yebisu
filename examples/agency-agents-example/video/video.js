/* 2役を渡し、動く案内へ（Agency Agents 作例）— 28秒・無音の解説映像（編集できる元ページ）
 * Canvas 2D で、時刻 t の完成した画面を毎回最初から描く。前のフレームや壁時計には依存しない。
 * 使う素材は、架空イベントの入力・UX Architect の引き継ぎ書・実装の記録・ブラウザーで保存したJSON・
 * 実操作の記録・実画面の静止キャプチャ6枚だけ。時刻・費用・役割名・件数は読み込んだファイルから取り出す。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 28;
const POSTER_TIME = 13.5;
const LW = 1280, LH = 720; // 論理座標。実際の大きさへは等倍率で収め、余りは紙の色で埋める
const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
const evenSize = (v, fallback) => (Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0 ? v : fallback);
const WIDTH = evenSize(given.width, 1280);
const HEIGHT = evenSize(given.height, 720);
const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
window.motionConfig = {duration: DURATION, fps: FPS, width: WIDTH, height: HEIGHT, posterTime: POSTER_TIME, audioEvents: []};

const root = document.documentElement;
if (RENDER) root.classList.add('is-render');
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
const density = RENDER ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
canvas.width = Math.round(WIDTH * density);
canvas.height = Math.round(HEIGHT * density);
canvas.style.aspectRatio = WIDTH + ' / ' + HEIGHT;
if (RENDER) {
  canvas.style.width = WIDTH + 'px';
  canvas.style.height = HEIGHT + 'px';
}

// ---- 見た目（企画ガイドの foundation.css ライトと同じ紙・墨・テラコッタ・緑） --------
const C = {
  paper: '#f7f1e6', card: '#fffaf2', sunk: '#efe6d6', ink: '#2a2420', muted: '#5c5148',
  rule: '#ddd0bc', strong: '#857565', accent: '#a8462a', accentSoft: '#f6e6dc',
  green: '#3f6b4a', greenSoft: '#e3ecdf', alert: '#962f1c', alertSoft: '#f8e3da', notice: '#f0e4c6'
};
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", "Yu Gothic", Meiryo, system-ui, sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "BIZ UDMincho", serif';
const MONO = 'ui-monospace, "SFMono-Regular", Consolas, "BIZ UDGothic", monospace';

// ---- 素材 ------------------------------------------------------------------
// 照合表 assets/data-hashes.json 自体の SHA-256（runtime/frozen-reviewed-source.json の値）。
// 照合表の12ファイルのパスは作例フォルダーからの相対で、このモジュールの1つ上を基準に解決する。
// 書き出し時に <base href="video/"> が入っても import.meta.url 基準なので同じ場所を指す。
const HASH_MANIFEST = {path: 'assets/data-hashes.json', sha256: '9a433954dbadd51ad4784643c21d8e55bebf190fd7ac8cbcf6eae1b90a546210'};
const FILES = {
  'input/event.json': {key: 'event', kind: 'json'},
  'outputs/ux-handoff.json': {key: 'handoff', kind: 'json'},
  'outputs/implementation.md': {key: 'implementation', kind: 'text'},
  'outputs/browser-itinerary.json': {key: 'exported', kind: 'json'},
  'outputs/browser-record.json': {key: 'record', kind: 'json'},
  'video/assets/screen-manifest.json': {key: 'screens', kind: 'json'},
  'video/assets/desktop-all.png': {key: 'all', kind: 'png'},
  'video/assets/desktop-conflict.png': {key: 'conflict', kind: 'png'},
  'video/assets/desktop-plan.png': {key: 'plan', kind: 'png'},
  'video/assets/phone-initial.png': {key: 'phoneInitial', kind: 'png'},
  'video/assets/phone-plan.png': {key: 'phonePlan', kind: 'png'},
  'video/assets/phone-dark.png': {key: 'phoneDark', kind: 'png'}
};
const SOURCE_COMMIT = 'bd956db032d907387e6b9ddebff3e18f1de8c679';

// 入力の6企画と照らす値（映像に出す値そのものは読み込んだ入力から取る）
const EXPECT = [
  {id: 'S01', title: '押し花のしおり', start: '10:00', end: '10:45', price_yen: 300, reservation_required: true},
  {id: 'S02', title: '街角の種を知る', start: '10:30', end: '11:00', price_yen: 0, reservation_required: false},
  {id: 'S03', title: '紙でつくる小さな町', start: '11:15', end: '12:00', price_yen: 200, reservation_required: true},
  {id: 'S04', title: '音のさんぽを聞く', start: '13:00', end: '13:30', price_yen: 0, reservation_required: false},
  {id: 'S05', title: '小さな糸の織りもの', start: '13:15', end: '14:00', price_yen: 500, reservation_required: true},
  {id: 'S06', title: 'ほつれの直し方 相談室', start: '14:00', end: '15:00', price_yen: 0, reservation_required: false}
];
const PLAN = ['S01', 'S03', 'S05', 'S06']; // ブラウザーで実際に書き出した予定
const CONFLICT_STATE = 'conflict-S02';     // S01 を入れた後に S02 を押した実操作の記録

// 実画面の切り抜き（画像の画素座標）。DOMの記録は全体撮影後の近似値なので、文字の外で切る
const CROPS = {
  phoneTop: {img: 'phoneInitial', x: 0, y: 0, w: 375, h: 594, contains: null},     // 見出し〜「企画を探す」まで
  darkTop: {img: 'phoneDark', x: 0, y: 0, w: 375, h: 594, contains: null},
  cards: {img: 'all', x: 64, y: 880, w: 752, h: 422, contains: ['desktop-all.png', '#session-1-title', '#session-2-title']},
  conflictNote: {img: 'conflict', x: 452, y: 1358, w: 353, h: 197, contains: ['desktop-conflict.png', '#session-2-conflict']},
  planLower: {img: 'phonePlan', x: 0, y: 20, w: 375, h: 540, contains: null}       // 回る予定の下部（S06・件数・合計・保存）
};
// 置き場所（論理座標）と倍率。倍率は縦横同じで、画素を伸ばさない
const PLACE = {
  compPhone: {x: 80, y: 180, s: 0.79},
  compCards: {x: 404, y: 180, s: 0.8},
  conflictNote: {x: 690, y: 182, s: 1.4},
  planLower: {x: 808, y: 180, s: 0.86},
  saveLight: {x: 660, y: 180, s: 0.66},
  saveDark: {x: 928, y: 180, s: 0.66}
};

const CORE = '2役を渡し、動く案内へ。';
const FOOTER = '架空イベントの作例・予約受付なし／実画面を編集・無音';
const SOURCE_LINE = `agency-agents ${SOURCE_COMMIT.slice(0, 7)}・MIT・コミュニティ作成`;
const STEPS = ['入力', '設計', '実装', '保存'];
const SCENES = [
  {id: 'request', start: 0, end: 4, step: 0, headline: '「地域イベントを、スマホで案内したい。」'},
  {id: 'handoff', start: 4, end: 8, step: 1, headline: '役割ごとに、入力と成果を渡す。'},
  {id: 'compare', start: 8, end: 12, step: 2, headline: '時間・費用・対象を比べる。'},
  {id: 'conflict', start: 12, end: 18, step: 2, headline: '重なる追加は、止める。'},
  {id: 'touch', start: 18, end: 23, step: 3, headline: '終わりと始まりが同時刻なら、選べる。'},
  {id: 'save', start: 23, end: 28, step: 3, headline: '作例で選んで、予定を保存。'}
];
const CONTENT_TOP = 134, CONTENT_BOTTOM = 658;

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const enter = (t, at, dur = 0.4) => easeOut(prog(t, at, at + dur));
const rise = (t, at, dur = 0.4, px = 10) => px * (1 - enter(t, at, dur));
// 場面の切り替えは0.4秒の重ね合わせ（前の場面が消える分だけ次が現れる）。上の段階表示と足元はいつも残す
const XF = 0.2;
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
  const hashes = JSON.parse(decodeText(manifest.bytes)).files;
  check(hashes && typeof hashes === 'object', '照合表の形');
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
  return {data, verified, hashes};
}

const toMin = s => {
  const m = /^(\d{2}):(\d{2})$/.exec(String(s));
  check(m, `時刻 ${s} の形`);
  return Number(m[1]) * 60 + Number(m[2]);
};
const fmtMin = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const overlaps = (a, b) => toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
const yen = n => (n === 0 ? '無料' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '円');
const span = s => `${s.start}–${s.end}`;

function buildFacts(d, hashes) {
  const {event: ev, handoff: ho, implementation: md, exported: ex, record: rec, screens} = d;

  // 入力：作例のために書いた架空イベント。6企画が照合値と一致する
  check(ev.fictional === true && typeof ev.venue === 'string' && ev.venue.includes('架空'), '架空のイベントと会場');
  check(ev.title === 'こもれび つくる日' && ev.date === '2026-11-07' && ev.timezone === 'Asia/Tokyo', 'イベントの題名・日付・タイムゾーン');
  check(Array.isArray(ev.sessions) && sameList(ev.sessions.map(s => s.id), EXPECT.map(e => e.id)), '6企画のID');
  const byId = new Map();
  ev.sessions.forEach((s, i) => {
    const e = EXPECT[i];
    check(s.title === e.title && s.start === e.start && s.end === e.end && s.price_yen === e.price_yen && s.reservation_required === e.reservation_required, `${s.id} の題名・時刻・費用・予約`);
    check(toMin(s.start) < toMin(s.end) && typeof s.age === 'string', `${s.id} の時刻と対象`);
    byId.set(s.id, s);
  });
  const S = id => byId.get(id);

  // 重なりと接する時刻（入力の時刻から計算する）
  check(overlaps(S('S01'), S('S02')) && overlaps(S('S04'), S('S05')), '重なる2組');
  check(!overlaps(S('S05'), S('S06')) && S('S05').end === S('S06').start, 'S05 と S06 は接するだけ');
  for (let i = 0; i < PLAN.length; i++) for (let j = i + 1; j < PLAN.length; j++) check(!overlaps(S(PLAN[i]), S(PLAN[j])), `予定 ${PLAN[i]}×${PLAN[j]} が重ならない`);
  const ovStart = Math.max(toMin(S('S01').start), toMin(S('S02').start));
  const ovEnd = Math.min(toMin(S('S01').end), toMin(S('S02').end));

  // UX Architect の引き継ぎ書：2役・固定版・順に適用。Frontend 側の確認項目は将来の提案
  check(ho.meta && ho.meta.fictional === true && ho.meta.event_id === ev.id && ho.meta.source_commit === SOURCE_COMMIT, '引き継ぎ書の meta');
  check(ho.meta.mode === 'sequential-role-application', '引き継ぎ書の適用方法');
  check(Array.isArray(ho.roles) && sameList(ho.roles.map(r => r.id), ['ux-architect', 'frontend-developer']), '引き継ぎ書の2役');
  const [ux, fe] = ho.roles;
  check(sameList(ux.inputs, ['input/event.json']) && ux.deliverables.includes('outputs/ux-handoff.json') && ux.deliverables.includes('foundation.css'), 'UX Architect の入力と成果');
  check(['input/event.json', 'outputs/ux-handoff.json', 'foundation.css'].every(p => fe.inputs.includes(p)), 'Frontend Developer の入力');
  check(fe.deliverables.includes('index.html') && fe.deliverables.includes('app.js'), 'Frontend Developer の成果');
  check(Array.isArray(ux.checks) && Array.isArray(fe.checks) && Array.isArray(fe.applied_instructions), '確認項目の形');
  const a09 = (ho.acceptance || []).find(a => a.id === 'A09');
  check(a09 && a09.criterion.includes('入れ替える'), '引き継ぎ書の A09（入れ替えの提案）');
  check(String(ho.data_contract && ho.data_contract.conflict_rule).includes('touching endpoints allowed'), '重なりの規則');

  // 実装の記録：A09 を採用しなかったこと、モデル、参照先がないこと
  check(md.includes('A09') && md.includes('採用しない') && md.includes('claude-opus-5-5') && md.includes('ai/agents/architect.md'), '実装の記録');

  // ブラウザーで実際に保存したJSON：入力の企画オブジェクトそのまま、合計は計算値
  check(ex.format === 'komorebi-itinerary/v1' && ex.fictional === true && ex.reserved === false, '保存JSONの format・fictional・reserved');
  check(sameList(ex.selected_ids, PLAN), '保存JSONの selected_ids');
  check(Array.isArray(ex.sessions) && sameList(ex.sessions.map(s => s.id), PLAN) && ex.sessions.every(s => deepEqual(s, S(s.id))), '保存JSONの企画が入力と同じ');
  const sum = ex.sessions.reduce((a, s) => a + s.price_yen, 0);
  check(ex.derived && ex.derived.count === ex.sessions.length && ex.derived.total_price_yen === sum, '保存JSONの件数と合計');
  check(deepEqual(ex.event, {id: ev.id, title: ev.title, date: ev.date, timezone: ev.timezone, venue: ev.venue}), '保存JSONの event');
  check(ex.source && ex.source.role_source_commit === SOURCE_COMMIT && String(ex.selection_rule).includes('同時刻なら重ならない'), '保存JSONの source と規則');

  // 実操作の記録：保存JSONのSHA-256、S02 を止めた状態、4件の状態、要求したファイル名
  check(rec.export_sha256 === hashes['outputs/browser-itinerary.json'] && rec.selected_original_sessions_match === true, '記録の保存JSON');
  const state = label => (rec.states || []).find(s => s.label === label);
  const conflict = state(CONFLICT_STATE);
  check(conflict && sameList(conflict.selected, ['S01']) && conflict.notice.includes(S('S02').title) && conflict.notice.includes('1件のまま'), `記録 ${CONFLICT_STATE}`);
  const touching = state('touching-S06');
  check(touching && sameList(touching.selected, PLAN) && touching.total === yen(sum), '記録 touching-S06');
  const filename = `${ev.id}-${ev.date}-itinerary.json`;
  const exportState = state('final-export-request');
  check(exportState && exportState.notice.includes(filename), '記録のファイル名');

  // 実画面：記録の SHA-256・大きさ、切り抜きが記録の範囲を含むこと
  check(Array.isArray(screens.screens) && screens.screens.length === 6, '実画面の記録');
  const keyOf = file => FILES['video/assets/' + file] && FILES['video/assets/' + file].key;
  screens.screens.forEach(s => {
    const img = d[keyOf(s.file)];
    check(img && img.width === s.width && img.height === s.height, `${s.file} の大きさ`);
    check(s.sha256 === hashes['video/assets/' + s.file], `${s.file} のSHA-256`);
  });
  for (const [name, crop] of Object.entries(CROPS)) {
    const img = d[crop.img];
    check(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= img.width && crop.y + crop.h <= img.height, `${name} の切り抜き範囲`);
    if (crop.contains) {
      const [file, ...ids] = crop.contains;
      const rects = screens.screens.find(s => s.file === file).dom_capture.rects;
      ids.forEach(id => {
        const r = rects[id];
        check(r && r.width > 0 && r.x >= crop.x && r.y >= crop.y && r.x + r.width <= crop.x + crop.w && r.y + r.height <= crop.y + crop.h, `${name} が ${id} を含む`);
      });
    }
  }

  const base = p => p.split('/').pop();
  return {
    img: d, ev, S, ux, fe, filename,
    roleFile: {ux: base(ux.source_path), fe: base(fe.source_path)},
    overlap: {start: fmtMin(ovStart), end: fmtMin(ovEnd)},
    conflict,
    plan: {ids: ex.selected_ids, count: ex.derived.count, total: ex.derived.total_price_yen, fictional: ex.fictional, reserved: ex.reserved}
  };
}

// ---- 描画の部品 ------------------------------------------------------------
function font(o) {
  const family = o.family === 'serif' ? SERIF : o.family === 'mono' ? MONO : SANS;
  return `${o.weight || 400} ${o.size || 20}px ${family}`;
}
function text(c, s, x, y, o = {}) {
  c.save();
  c.font = font(o);
  c.fillStyle = o.color || C.ink;
  c.textAlign = o.align || 'left';
  c.textBaseline = 'alphabetic';
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
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
// 日本語の折り返し：測った幅で折り、行頭・行末の禁則を守る。英数字の語とファイル名は分けない
const NO_START = '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ…‥–';
const NO_END = '（「『【〔〈《';
function greedy(c, s, maxWidth) {
  const lines = [];
  for (const para of String(s).split('\n')) {
    const tokens = para.match(/[A-Za-z0-9][A-Za-z0-9.,:=_\-/@–]*|\s+|[\s\S]/gu) || [];
    let line = '';
    for (const token of tokens) {
      const next = line + token;
      if (line.trim() && !/^\s+$/.test(token) && c.measureText(next).width > maxWidth) {
        let carry = token;
        if (NO_START.includes(token[0]) && line.length > 1) {
          carry = line.slice(-1) + carry;
          line = line.slice(0, -1);
        }
        while (line.length > 1 && NO_END.includes(line.slice(-1))) {
          carry = line.slice(-1) + carry;
          line = line.slice(0, -1);
        }
        lines.push(line.trimEnd());
        line = carry;
      } else {
        line = next;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
// 行数を変えずに、いちばん狭く収まる幅で折り直す（最後の行に1〜2字だけ残さない）
function wrap(c, s, maxWidth, o) {
  c.save();
  c.font = font(o);
  let lines = greedy(c, s, maxWidth);
  if (lines.length > 1) {
    let lo = maxWidth * 0.4, hi = maxWidth;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (greedy(c, s, mid).length <= lines.length) hi = mid;
      else lo = mid;
    }
    lines = greedy(c, s, hi);
  }
  c.restore();
  return lines;
}
// 折り返して描き、最後の行のベースラインを返す
function block(c, s, x, y, maxWidth, lineHeight, o) {
  const lines = wrap(c, s, maxWidth, o);
  lines.forEach((line, i) => text(c, line, x, y + i * lineHeight, o));
  return y + (lines.length - 1) * lineHeight;
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
function card(c, x, y, w, h, o = {}) {
  c.save();
  c.shadowColor = 'rgba(42, 36, 32, 0.10)';
  c.shadowBlur = 16;
  c.shadowOffsetY = 5;
  roundRect(c, x, y, w, h, o.r || 10);
  c.fillStyle = o.fill || C.card;
  c.fill();
  c.restore();
  roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, o.r || 10);
  c.strokeStyle = o.stroke || C.rule;
  c.lineWidth = o.lineWidth || 1;
  c.stroke();
}
function pill(c, s, x, y, h, o) {
  c.save();
  c.font = font(o);
  const w = o.width || Math.ceil(c.measureText(s).width) + 2 * (o.pad === undefined ? 14 : o.pad);
  roundRect(c, x, y, w, h, o.radius === undefined ? h / 2 : o.radius);
  if (o.fill) {
    c.fillStyle = o.fill;
    c.fill();
  }
  if (o.stroke) {
    c.strokeStyle = o.stroke;
    c.lineWidth = o.lineWidth || 1.5;
    c.stroke();
  }
  c.fillStyle = o.color || C.ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(s, x + w / 2, y + h / 2 + 1);
  c.restore();
  return w;
}
function label(c, s, x, y, o = {}) {
  text(c, s, x, y, {size: 20, weight: 600, color: C.muted, ...o});
}
// 矢印（k で始点から伸びる。時刻から直接求める）
function arrow(c, x1, y1, x2, y2, color, k) {
  if (k <= 0.001) return;
  const ex = lerp(x1, x2, k), ey = lerp(y1, y2, k);
  c.save();
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(ex, ey);
  c.stroke();
  if (k >= 0.999) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - 14 * Math.cos(ang - 0.45), y2 - 14 * Math.sin(ang - 0.45));
    c.lineTo(x2 - 14 * Math.cos(ang + 0.45), y2 - 14 * Math.sin(ang + 0.45));
    c.closePath();
    c.fill();
  }
  c.restore();
}

// 実画面の切り抜きを、等倍率でそのまま置く（画素は変えず、文字も重ねない）
function drawShot(c, f, key, placeKey, alpha, dy = 0) {
  if (alpha <= 0.001) return null;
  const crop = CROPS[key], place = PLACE[placeKey], img = f.img[crop.img];
  const x = place.x, y = place.y + dy, w = crop.w * place.s, h = crop.h * place.s;
  c.save();
  c.globalAlpha *= alpha;
  c.save();
  c.shadowColor = 'rgba(42, 36, 32, 0.14)';
  c.shadowBlur = 18;
  c.shadowOffsetY = 6;
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
  c.strokeStyle = C.strong;
  c.lineWidth = 1;
  c.stroke();
  c.restore();
  return {x, y, w, h};
}

// 入力の時刻から描く区間の図（実画面ではない）。from〜to の分を x0〜x1 に置く
function timeline(from, to, x0, x1) {
  return m => x0 + ((m - from) / (to - from)) * (x1 - x0);
}
function axis(c, X, from, to, step, y, x0, x1) {
  c.save();
  c.fillStyle = C.strong;
  c.fillRect(x0, y, x1 - x0, 2);
  for (let m = from; m <= to; m += step) {
    c.fillRect(X(m) - 1, y - 6, 2, 14);
    text(c, fmtMin(m), X(m), y + 32, {size: 20, weight: 600, color: C.muted, align: 'center'});
  }
  c.restore();
}
function bar(c, X, s, y, h, o, k) {
  if (k <= 0.001) return;
  const x0 = X(toMin(s.start)), x1 = X(toMin(s.end));
  const w = (x1 - x0) * k;
  c.save();
  roundRect(c, x0, y, w, h, 6);
  c.fillStyle = o.fill;
  c.fill();
  if (o.stroke) {
    c.strokeStyle = o.stroke;
    c.lineWidth = 2;
    c.stroke();
  }
  c.restore();
  const t = {size: 26, weight: 700, color: o.color};
  if (k >= 0.999) {
    const tw = measure(c, span(s), t);
    if (tw + 24 <= x1 - x0) text(c, span(s), x0 + 12, y + h / 2 + 9, t);
    else text(c, span(s), x1 + 12, y + h / 2 + 9, {...t, color: o.outside || C.ink});
  }
}
function sessionName(c, s, x, y, note, noteColor) {
  text(c, s.id, x, y, {size: 20, weight: 700, family: 'mono', color: C.green});
  const nx = x + measure(c, s.id, {size: 20, weight: 700, family: 'mono'}) + 12;
  text(c, s.title, nx, y, {size: 24, weight: 700});
  if (note) text(c, note, nx + measure(c, s.title, {size: 24, weight: 700}) + 14, y, {size: 20, weight: 600, color: noteColor || C.muted});
}

// ---- いつも出ている枠：上の4段階と、足元の範囲の注記 -------------------------
function sceneIndex(t) {
  const i = SCENES.findIndex(s => t < s.end);
  return i < 0 ? SCENES.length - 1 : i;
}
function drawChrome(c, t, live) {
  text(c, 'Studio Yebisu ・ Agency Agents 作例', 80, 47, {size: 20, weight: 600, color: C.muted});
  const o = {size: 20, weight: 700};
  const weight = STEPS.map((_, k) => (live ? clamp01(SCENES.reduce((sum, s, i) => sum + (s.step === k ? sceneAlpha(t, i) : 0), 0)) : 0));
  const current = live ? SCENES[sceneIndex(t)].step : -1;
  const widths = STEPS.map(s => Math.ceil(measure(c, s, o)) + 30);
  const gap = 38;
  let x = 1200 - widths.reduce((a, w) => a + w, 0) - gap * (STEPS.length - 1);
  STEPS.forEach((s, k) => {
    const on = weight[k];
    const base = k < current ? C.ink : C.muted;
    c.save();
    c.globalAlpha = 1 - on;
    pill(c, s, x, 22, 34, {...o, fill: C.card, stroke: C.rule, lineWidth: 1, color: base, width: widths[k]});
    c.globalAlpha = on;
    pill(c, s, x, 22, 34, {...o, fill: C.green, color: '#ffffff', width: widths[k]});
    c.restore();
    x += widths[k];
    if (k < STEPS.length - 1) text(c, '→', x + gap / 2, 46, {size: 20, weight: 700, color: C.strong, align: 'center'});
    x += gap;
  });
  c.save();
  c.fillStyle = C.rule;
  c.fillRect(80, 66, 1120, 1);
  c.fillRect(80, 664, 1120, 1);
  c.restore();
  text(c, FOOTER, 80, 698, {size: 20, weight: 700, color: C.ink});
  text(c, SOURCE_LINE, 1200, 698, {size: 20, weight: 500, color: C.muted, align: 'right'});
}

function drawHeadlines(c, t) {
  SCENES.forEach((s, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    const dy = i === 0 ? 0 : 8 * (1 - easeOut(prog(t, s.start - XF, s.start + 0.35)));
    const o = {size: 44, weight: 600, family: 'serif'};
    const size = fitSize(c, [s.headline], 1120, o, 38);
    text(c, s.headline, 80, 116 + dy, {...o, size, alpha: a});
  });
}

// ---- 場面 ------------------------------------------------------------------
// 0〜4秒：元の依頼と入力の6企画。2つの役割を同じ Opus 5.5 が順に適用する
function drawRequest(c, t, f) {
  const a = sceneAlpha(t, 0);
  if (a <= 0.001) return;
  const ev = f.ev;
  c.save();
  c.globalAlpha = a * enter(t, 0.1);
  label(c, `入力 input/event.json（架空・${ev.date}・${ev.sessions.length}企画）`, 80, 166);

  // 入力の6企画（入力の値から描く。実画面ではない）
  const k0 = enter(t, 0.2), d0 = rise(t, 0.2);
  c.globalAlpha = a * k0;
  const X = 80, Y = 186 + d0, W = 520;
  card(c, X, Y, W, 384);
  text(c, ev.title, X + 24, Y + 44, {size: 30, weight: 700, family: 'serif'});
  text(c, ev.venue, X + 24, Y + 76, {size: 20, color: C.muted});
  c.fillStyle = C.rule;
  c.fillRect(X + 24, Y + 94, W - 48, 1);
  ev.sessions.forEach((s, i) => {
    const at = 0.35 + i * 0.07;
    c.globalAlpha = a * enter(t, at, 0.35);
    const y = Y + 136 + i * 44 + rise(t, at, 0.35, 6);
    text(c, s.id, X + 24, y, {size: 20, weight: 700, family: 'mono', color: C.green});
    text(c, span(s), X + 82, y, {size: 22, weight: 600});
    text(c, s.title, X + 246, y, {size: 22});
  });

  // 2つの役割（引き継ぎ書の roles の名前と役割ファイル）
  const RX = 640, RW = 560;
  const role = (r, file, n, y, at) => {
    const k = enter(t, at), dy = rise(t, at);
    c.globalAlpha = a * k;
    card(c, RX, y + dy, RW, 104);
    pill(c, `${n}回目の実行`, RX + 20, y + dy + 20, 32, {size: 20, weight: 700, fill: C.greenSoft, color: C.green, pad: 12});
    text(c, r.name, RX + 190, y + dy + 46, {size: 32, weight: 700});
    text(c, file, RX + 20, y + dy + 86, {size: 20, family: 'mono', color: C.muted});
  };
  role(f.ux, f.roleFile.ux, 1, 186, 0.9);
  c.globalAlpha = a;
  arrow(c, RX + 44, 300, RX + 44, 362, C.accent, enter(t, 1.3, 0.4));
  c.globalAlpha = a * enter(t, 1.45);
  text(c, '同じ Opus 5.5 で順に適用', RX + 84, 344, {size: 30, weight: 700, color: C.accent});
  role(f.fe, f.roleFile.fe, 2, 370, 1.8);
  c.globalAlpha = a * enter(t, 2.2);
  block(c, '別々の実行で、1つずつ。独立した2エージェントや自動の受け渡しではない。', RX, 512, RW, 30, {size: 20, color: C.muted});

  c.globalAlpha = a * enter(t, 2.6);
  text(c, CORE, 80, 628, {size: 34, weight: 700, color: C.green});
  c.restore();
}

// 4〜8秒：役割ごとの入力・成果・確認（引き継ぎ書の roles から）。違えた点は A09
function drawHandoff(c, t, f) {
  const a = sceneAlpha(t, 1);
  if (a <= 0.001) return;
  c.save();
  const W = 460, Y = 152, H = 420;
  const mono = {size: 22, family: 'mono'};
  const roleCard = (r, n, X, at, outs, checkText) => {
    const k = enter(t, at), dy = rise(t, at);
    c.globalAlpha = a * k;
    card(c, X, Y + dy, W, H);
    const w = pill(c, `${n}回目`, X + 20, Y + dy + 20, 32, {size: 20, weight: 700, fill: C.greenSoft, color: C.green, pad: 12});
    text(c, r.name, X + 20 + w + 14, Y + dy + 47, {size: 30, weight: 700});
    let y = Y + dy + 96;
    label(c, '入力', X + 20, y);
    r.inputs.forEach(p => {
      y += 32;
      text(c, p, X + 20, y, {...mono, size: fitSize(c, [p], W - 40, mono, 18)});
    });
    y += 44;
    label(c, '成果', X + 20, y);
    outs.forEach(p => {
      y += 32;
      text(c, p, X + 20, y, {...mono, size: fitSize(c, [p], W - 40, mono, 18), weight: 700, color: C.green});
    });
    y += 44;
    label(c, '確認', X + 20, y);
    block(c, checkText, X + 20, y + 32, W - 40, 28, {size: 20});
  };
  roleCard(f.ux, 1, 80, 4.15, f.ux.deliverables, `引き継ぎ書に${f.ux.checks.length}項目（ファイルを読む静的な確認）`);
  const feOuts = [f.fe.deliverables.filter(p => !p.startsWith('outputs/')).join('・'), ...f.fe.deliverables.filter(p => p.startsWith('outputs/'))];
  roleCard(f.fe, 2, 740, 4.8, feOuts, `引き継ぎ書が示した${f.fe.checks.length}項目（提案。実際の確認は制作側）`);

  // 渡したもの：UX の成果のうち、Frontend の入力になったファイル
  c.globalAlpha = a;
  arrow(c, 556, 330, 724, 330, C.accent, enter(t, 4.55, 0.4));
  const handed = f.fe.inputs.filter(p => f.ux.deliverables.includes(p)).map(p => p.split('/').pop());
  c.globalAlpha = a * enter(t, 4.9);
  text(c, '渡す', 640, 306, {size: 26, weight: 700, color: C.accent, align: 'center'});
  handed.forEach((p, i) => {
    const o = {size: 20, weight: 700, family: 'mono'};
    const w = Math.ceil(measure(c, p, o)) + 20;
    pill(c, p, 640 - w / 2, 350 + i * 44, 34, {...o, fill: C.accentSoft, color: C.accent, width: w, radius: 6});
  });

  c.globalAlpha = a * enter(t, 5.6);
  block(c, '違えた点：重なる企画の「入れ替える」案（A09）は採用せず、追加を止める。', 80, 616, 1120, 30, {size: 24, weight: 700, color: C.alert});
  c.restore();
}

// 8〜12秒：スマホの初期表示と、企画カードの実画面。入力の値を読める大きさで添える
function drawCompare(c, t, f) {
  const a = sceneAlpha(t, 2);
  if (a <= 0.001) return;
  const s1 = f.S('S01'), s2 = f.S('S02');
  c.save();
  c.globalAlpha = a * enter(t, 8.1);
  label(c, 'スマホの初期表示（実画面）', 80, 166);
  label(c, '実画面・企画カード（パソコン幅・何も選ぶ前）', 404, 166);
  c.globalAlpha = a;
  drawShot(c, f, 'phoneTop', 'compPhone', enter(t, 8.15), rise(t, 8.15));
  drawShot(c, f, 'cards', 'compCards', enter(t, 8.3), rise(t, 8.3));

  c.globalAlpha = a * enter(t, 8.9);
  block(c, '6企画とも入力の値のまま。定員は企画上の設定で、残席ではない。', 1030, 204, 170, 30, {size: 20, color: C.muted});

  // 入力から取り出した S01・S02 の値（読める大きさの説明。画面の文字は書き換えない）
  const cols = [
    {head: '時間', rows: [span(s1), span(s2)]},
    {head: '費用', rows: [yen(s1.price_yen), yen(s2.price_yen)]},
    {head: '対象', rows: [s1.age, s2.age]}
  ];
  cols.forEach((col, i) => {
    const at = 8.6 + i * 0.12;
    c.globalAlpha = a * enter(t, at);
    const x = 404 + i * 266, dy = rise(t, at, 0.4, 6);
    c.fillStyle = C.accent;
    c.fillRect(x, 532 + dy, 4, 116);
    label(c, col.head, x + 14, 552 + dy, {weight: 700, color: C.accent});
    let y = 584 + dy;
    [s1, s2].forEach((s, j) => {
      text(c, s.id, x + 14, y, {size: 20, weight: 700, family: 'mono', color: C.green});
      const end = block(c, col.rows[j], x + 62, y, 196, 26, {size: 22, weight: 600});
      y = end + 32;
    });
  });
  c.restore();
}

// 12〜18秒：S01 を選んだ後に S02 を押しても入らない（実画面の注記と、実操作の記録）。ポスターは13.5秒
function drawConflict(c, t, f) {
  const a = sceneAlpha(t, 3);
  if (a <= 0.001) return;
  const s1 = f.S('S01'), s2 = f.S('S02');
  c.save();
  c.globalAlpha = a * enter(t, 12.1);
  label(c, '入力の時刻から描いた図（実画面ではない）', 80, 166);

  const from = Math.floor(Math.min(toMin(s1.start), toMin(s2.start)) / 60) * 60;
  const to = Math.ceil(Math.max(toMin(s1.end), toMin(s2.end)) / 60) * 60;
  const X = timeline(from, to, 120, 600);
  // 重なる区間（入力の時刻から計算した値）
  const kb = enter(t, 12.7);
  if (kb > 0.001) {
    const x0 = X(toMin(f.overlap.start)), x1 = X(toMin(f.overlap.end));
    c.globalAlpha = a * kb;
    c.fillStyle = C.alertSoft;
    c.fillRect(x0, 230, x1 - x0, 156);
    c.save();
    c.strokeStyle = C.alert;
    c.lineWidth = 2;
    c.setLineDash([6, 5]);
    c.strokeRect(x0, 230, x1 - x0, 156);
    c.restore();
  }
  c.globalAlpha = a * enter(t, 12.2);
  sessionName(c, s1, 120, 222, '回る予定に入っている', C.green);
  c.globalAlpha = a;
  bar(c, X, s1, 236, 46, {fill: C.green, color: '#ffffff'}, enter(t, 12.25, 0.45));
  c.globalAlpha = a * enter(t, 12.45);
  sessionName(c, s2, 120, 322, '追加を押した');
  c.globalAlpha = a;
  bar(c, X, s2, 336, 46, {fill: C.card, stroke: C.alert, color: C.alert}, enter(t, 12.5, 0.45));
  c.globalAlpha = a * enter(t, 12.2);
  axis(c, X, from, to, 30, 404, 120, 600);
  c.globalAlpha = a * enter(t, 12.85);
  text(c, `${f.overlap.start}–${f.overlap.end} が重なる`, 80, 482, {size: 30, weight: 700, color: C.alert});

  // 実操作の記録（browser-record.json の conflict-S02）
  const kr = enter(t, 12.95), dr = rise(t, 12.95);
  c.globalAlpha = a * kr;
  card(c, 80, 504 + dr, 560, 134, {fill: C.greenSoft, stroke: C.green});
  label(c, `実際の操作の記録 ${CONFLICT_STATE}`, 104, 536 + dr, {color: C.green, weight: 700});
  text(c, `予定は${f.conflict.selected.length}件のまま`, 104, 582 + dr, {size: 34, weight: 700});
  text(c, `選択中 [${f.conflict.selected.join(', ')}]・${s2.id} は入れない`, 104, 620 + dr, {size: 22, weight: 600, color: C.muted});

  // 実画面：S02 のカードに出た注記（S01 を選んだ後）
  c.globalAlpha = a * enter(t, 12.3);
  label(c, `実画面・${s2.id} の注記（${s1.id} を選んだ後）`, 690, 166);
  c.globalAlpha = a;
  drawShot(c, f, 'conflictNote', 'conflictNote', enter(t, 12.35), rise(t, 12.35));
  const kn = enter(t, 13.05), dn = rise(t, 13.05);
  c.globalAlpha = a * kn;
  text(c, '入れ替えはしない。', 690, 512 + dn, {size: 30, weight: 700});
  block(c, 'UX案の「入れ替える」（A09）は不採用。入れたいときは、先に今の企画を外す。', 690, 552 + dn, 510, 30, {size: 22, color: C.muted});
  c.restore();
}

// 18〜23秒：S05 の終わりと S06 の始まりが同じ 14:00。両方入り、実際に書き出した予定は4件・合計
function drawTouch(c, t, f) {
  const a = sceneAlpha(t, 4);
  if (a <= 0.001) return;
  const s5 = f.S('S05'), s6 = f.S('S06');
  c.save();
  c.globalAlpha = a * enter(t, 18.1);
  label(c, '入力の時刻から描いた図（実画面ではない）', 80, 166);
  const from = Math.floor(toMin(s5.start) / 60) * 60;
  const to = Math.ceil(toMin(s6.end) / 60) * 60;
  const X = timeline(from, to, 120, 640);
  c.globalAlpha = a * enter(t, 18.2);
  sessionName(c, s5, 120, 222);
  c.globalAlpha = a;
  bar(c, X, s5, 236, 46, {fill: C.green, color: '#ffffff'}, enter(t, 18.25, 0.45));
  c.globalAlpha = a * enter(t, 18.45);
  sessionName(c, s6, X(toMin(s6.start)) + 12, 322); // 接する線の右から書き、線と文字を重ねない
  c.globalAlpha = a;
  bar(c, X, s6, 336, 46, {fill: C.green, color: '#ffffff'}, enter(t, 18.5, 0.45));
  c.globalAlpha = a * enter(t, 18.2);
  axis(c, X, from, to, 60, 404, 120, 640);
  // 接する時刻の線
  const kl = enter(t, 18.8);
  if (kl > 0.001) {
    const xb = X(toMin(s5.end));
    c.globalAlpha = a * kl;
    c.fillStyle = C.accent;
    c.fillRect(xb - 1.5, 232, 3, 172);
  }
  c.globalAlpha = a * enter(t, 18.95);
  text(c, `${s5.end} で接する＝重ならない`, 80, 482, {size: 30, weight: 700, color: C.accent});
  c.globalAlpha = a * enter(t, 19.25);
  block(c, `${s6.id} は ${span(s6)} の枠全体を選ぶ。途中参加・移動時間・予約の約束ではない。`, 80, 518, 600, 30, {size: 22, color: C.muted});

  // ブラウザーで書き出したJSONの derived（計算値）
  const kc = enter(t, 19.55), dc = rise(t, 19.55);
  c.globalAlpha = a * kc;
  card(c, 80, 572 + dc, 600, 74, {fill: C.greenSoft, stroke: C.green});
  label(c, '書き出した予定', 102, 618 + dc, {color: C.green, weight: 700});
  text(c, `${f.plan.count}件・合計 ${yen(f.plan.total)}`, 260, 622 + dc, {size: 34, weight: 700, color: C.ink});

  // 実画面：スマホ幅の回る予定の下部
  c.globalAlpha = a * enter(t, 18.3);
  label(c, `実画面・スマホの回る予定（下部：${s6.id} と合計）`, 740, 166);
  c.globalAlpha = a;
  drawShot(c, f, 'planLower', 'planLower', enter(t, 18.35), rise(t, 18.35));
  c.restore();
}

// 23〜28秒：実際に保存したJSONの値と、スマホのライト／ダークの初期表示（24.6秒以降は止めて読む）
function drawSave(c, t, f) {
  const a = sceneAlpha(t, 5);
  if (a <= 0.001) return;
  c.save();
  const X = 80, W = 556, ix = X + 24, iw = W - 48;
  const kp = enter(t, 23.1), dp = rise(t, 23.1);
  const top = 152 + dp;
  c.globalAlpha = a * kp;
  card(c, X, top, W, 432);
  text(c, '実際に保存したJSON', ix, top + 40, {size: 24, weight: 700, color: C.green});
  text(c, 'outputs/browser-itinerary.json', ix, top + 72, {size: 20, family: 'mono', color: C.muted});
  c.fillStyle = C.rule;
  c.fillRect(ix, top + 90, iw, 1);
  const rows = [
    ['"selected_ids": ', '[' + f.plan.ids.map(id => JSON.stringify(id)).join(', ') + '],'],
    ['"count": ', f.plan.count + ','],
    ['"total_price_yen": ', f.plan.total + ','],
    ['"fictional": ', String(f.plan.fictional) + ','],
    ['"reserved": ', String(f.plan.reserved)]
  ];
  const mono = {size: 24, family: 'mono'};
  const size = fitSize(c, rows.map(r => r[0] + r[1]), iw, mono, 20);
  rows.forEach(([k, v], i) => {
    const at = 23.3 + i * 0.08;
    c.globalAlpha = a * enter(t, at, 0.35);
    const y = top + 132 + i * 42;
    text(c, k, ix, y, {...mono, size, color: C.muted});
    text(c, v, ix + measure(c, k, {...mono, size}), y, {...mono, size, weight: 700, color: C.ink});
  });
  c.globalAlpha = a * enter(t, 23.75);
  label(c, 'ブラウザーで保存したときのファイル名', ix, top + 360);
  const fo = {size: 20, family: 'mono', weight: 700};
  text(c, f.filename, ix, top + 394, {...fo, size: fitSize(c, [f.filename], iw, fo, 16), color: C.ink});
  c.globalAlpha = a * enter(t, 24.0);
  block(c, '予約・支払い・参加確定ではない。予定は再読み込みで消え、テーマだけ残る。', X, 618, W, 28, {size: 20, color: C.muted});

  // 実画面：スマホの初期表示（ライト・ダーク）
  c.globalAlpha = a * enter(t, 23.2);
  label(c, '実画面・スマホの初期表示（ライト／ダーク）', 660, 166);
  c.globalAlpha = a;
  drawShot(c, f, 'phoneTop', 'saveLight', enter(t, 23.2), rise(t, 23.2));
  drawShot(c, f, 'darkTop', 'saveDark', enter(t, 23.35), rise(t, 23.35));
  c.globalAlpha = a * enter(t, 23.6);
  label(c, 'ライト', 660, 600);
  label(c, 'ダーク', 928, 600);
  c.globalAlpha = a * enter(t, 24.2);
  text(c, CORE, 660, 642, {size: 30, weight: 700, color: C.green});
  c.restore();
}

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
  drawChrome(ctx, t, Boolean(facts));
  if (!facts) {
    const message = failure ? '読み込みに失敗しました。代わりの映像は出しません。' : '保存済みのファイルと実画面を確かめています…';
    text(ctx, message, 80, 300, {size: 30, weight: 700, color: failure ? C.alert : C.muted});
    if (failure) block(ctx, failure.message, 80, 348, 1120, 32, {size: 22, color: C.ink});
    return;
  }
  drawHeadlines(ctx, t);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, CONTENT_TOP, LW, CONTENT_BOTTOM - CONTENT_TOP);
  ctx.clip();
  drawRequest(ctx, t, facts);
  drawHandoff(ctx, t, facts);
  drawCompare(ctx, t, facts);
  drawConflict(ctx, t, facts);
  drawTouch(ctx, t, facts);
  drawSave(ctx, t, facts);
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
  const fontSpecs = [`600 44px ${SERIF}`, `700 30px ${SERIF}`, `700 34px ${SANS}`, `400 20px ${SANS}`, `700 24px ${MONO}`];
  if (document.fonts && document.fonts.load) {
    await Promise.all(fontSpecs.map(spec => document.fonts.load(spec, '重なる追加は止める押し花のしおりS01')));
    await document.fonts.ready;
  }
  const {data, verified, hashes} = await loadAll();
  const built = buildFacts(data, hashes);
  facts = built;
  render(currentT);
  setStatus('ready', `照合した${verified.length}ファイルから描いています`,
    `入力の${built.ev.sessions.length}企画の時刻・費用、引き継ぎ書の2役、保存したJSONの${built.plan.count}件・合計${yen(built.plan.total)}、実操作の記録 ${CONFLICT_STATE} を確かめました。ページでも映像でもAIは動きません。`);
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
