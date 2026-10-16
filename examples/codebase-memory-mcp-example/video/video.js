// Studio Yebisu: Codebase Memory MCP作例 — 編集動画（28秒・無音）
// Copyright (c) 2026 Studio Yebisu. MIT License.
// 保存済みの outputs/runs.json と、作例ビューアの実際のスクリーンショットだけを読み、
// window.seek(秒) が任意の時刻の完成した画面を1枚のCanvasへ描く。CLI・Python・AIはここでは動かない。

const RC = window.renderConfig || {};
const pickNum = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
const W = pickNum(RC.width, 1280), H = pickNum(RC.height, 720), FPS = pickNum(RC.fps, 30);
const DURATION = 28, POSTER = 13.5;
const RENDER = window.__MOTION_RENDER__ === true;
window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER, audioEvents: []};
window.motionState = 'loading';
window.motionError = null;
if (RENDER) document.documentElement.classList.add('render');

const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",system-ui,sans-serif';
const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP","Source Han Serif JP",Georgia,serif';
const MONO = '"SFMono-Regular",Consolas,Menlo,"Liberation Mono",monospace';
// 作例ビューア（style.css）と同じ紙・墨・索引の青
const C = {
  paper: '#f7f4ee', card: '#fffdf9', code: '#fbf9f4', ink: '#1c1d21', soft: '#57554e', rule: '#d8d1c3',
  blue: '#1f4e8c', blueWash: '#e5ecf5', blueLine: '#9db3d3', red: '#9b2c26', white: '#ffffff',
};
const M = 64, CW = 1152, RX = M + CW; // 安全余白64px
const R_X = 672; // 右の列（実際の画面の切り抜き）

// 場面の時刻。storyboard.json と同じ値。
const SCENES = [
  {id: 'goal', step: '目的', start: 0, end: 4},
  {id: 'find', step: '探す', start: 4, end: 10},
  {id: 'trace', step: 'たどる', start: 10, end: 16},
  {id: 'update', step: '変える', start: 16, end: 22},
  {id: 'check', step: '確かめる', start: 22, end: 28},
];

// 公開時に確認した保存結果と画面のSHA-256。値が違えば描かずに止まる。
const FILES = {
  runs: {path: 'outputs/runs.json', sha256: '966b504b3c23eb151e8bee15617cecc469875c64cb2310a295f761071c8d3d63'},
  memo: {path: 'outputs/result.md', sha256: 'fafb2c95f6e5c4e627a9161e319a507030b80d7a825662c89f5556dfdf5329b0'},
};
const SHOTS = {
  find: {path: 'assets/screen-find.png', sha256: '73d15f0646acc428e6cd0567ff1815287b9e92540b56af317e5136a4a064907e', width: 1265, height: 889},
  update: {path: 'assets/screen-update.png', sha256: '9aa17607a918077e761f14a3c0b290c6ecaba81f733c03602d10de64c35871aa', width: 1265, height: 889},
  phone: {path: 'assets/screen-phone.png', sha256: 'd5915010dcfde9a6bff1dd29e05d4ae7d9ebe5c8ddcc79cbff55a7041916600f', width: 375, height: 812},
};
// 公開している架空のリポジトリ。runs.json のソースの写しと同じであることを確かめる。
const FIXTURE = {service: 'fixture/service.py', app: 'fixture/app.py', storage: 'fixture/storage.py', revised: 'fixture/storage_revised.py'};

// 切り抜きは元画像の座標。伸縮の比は1.4倍まで。ring は強調する枠。
const CROP = {
  findIndex: {src: {x: 262, y: 274, w: 380, h: 72}, at: {x: R_X, y: 234, w: 475}, ring: [466, 312, 590, 344]}, // 「行（索引の値）」「実ソースの def 行 8 行目（一致）」
  findSource: {src: {x: 634, y: 688, w: 346, h: 114}, at: {x: R_X, y: 382, w: 467}, ring: [636, 692, 978, 746]}, // 実ソース欄の8・9行目と「定義」の印
  update: {src: {x: 508, y: 236, w: 472, h: 154}, at: {x: R_X, y: 232, w: 544}, stale: [511, 238, 739, 388], after: [749, 238, 977, 388]}, // 「変更後・再索引の前」「手で再索引した後」
  phone: {src: {x: 0, y: 0, w: 362, h: 596}, at: {x: RX - 258, y: 200, w: 258}, ring: [18, 263, 249, 302]}, // 最初の画面。右端のスクロールバーを除く
};

const ENTRY_FIND = {x: M, y: 240, w: 380, h: 76}; // 「探す」での関数名の札
const ENTRY = {x: 380, y: 336, w: 300, h: 92}; // 「たどる」での同じ札
const MAIN = {x: M, y: 342, w: 230, h: 80};
const CALLEE_X = 790, CALLEE_W = RX - CALLEE_X, CALLEE_H = 84;
const calleeRect = k => ({x: CALLEE_X, y: 214 + k * 120, w: CALLEE_W, h: CALLEE_H});
const SAVE = {x: M, y: 326, w: 236, h: 76};
const AUDIT = {x: 388, y: 326, w: 252, h: 76};

const canvas = document.getElementById('film');
let ctx = canvas.getContext('2d', {willReadFrequently: true});
const IMG = {};
let D = null, ready = false;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const out3 = p => 1 - (1 - p) ** 3;
const inOut = p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const lerp = (a, b, p) => a + (b - a) * p;
const lerpRect = (a, b, p) => ({x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p)});
const enter = (t, t0, dur = 0.45) => { const p = out3(prog(t, t0, t0 + dur)); return {a: p, dy: (1 - p) * 14}; };
const leave = (t, t0, dur = 0.4) => 1 - prog(t, t0, t0 + dur);
const yen = v => `${Number(v).toLocaleString('ja-JP')}円`;

// ---------- 素材の読み込み（ハッシュと寸法を照合） ----------

const here = path => new URL('../' + path, import.meta.url);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const utf8 = buf => new TextDecoder('utf-8').decode(buf).replace(/\r\n/g, '\n');

async function bytes(path) {
  let res;
  try { res = await fetch(here(path), {cache: 'no-store'}); }
  catch { throw new Error(`${path} を読み込めませんでした。HTTPで配信して開いてください。`); }
  if (!res.ok) throw new Error(`${path} を読み込めませんでした（HTTP ${res.status}）。`);
  return res.arrayBuffer();
}

async function verified(path, sha) {
  const buf = await bytes(path);
  if (!window.crypto || !crypto.subtle) throw new Error('SHA-256を確認できません。localhostのHTTPで開いてください。');
  if (hex(await crypto.subtle.digest('SHA-256', buf)) !== sha) throw new Error(`${path} のSHA-256が公開時の記録と一致しません。`);
  return buf;
}

async function image(shot) {
  const buf = await verified(shot.path, shot.sha256);
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([buf], {type: 'image/png'}));
  try { await img.decode(); }
  catch { throw new Error(`${shot.path} を画像として読めませんでした。`); }
  if (img.naturalWidth !== shot.width || img.naturalHeight !== shot.height) throw new Error(`${shot.path} の寸法が公開時の記録と一致しません。`);
  return img;
}

function sameJSON(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => sameJSON(a[k], b[k]));
}

// ソースの行番号は、保存したソースの写しから数える。
const linesOf = src => src.split('\n');
const defLine = (src, name) => linesOf(src).findIndex(l => l.startsWith(`def ${name}(`)) + 1;
function callLine(src, name, from) {
  const L = linesOf(src), call = new RegExp(`\\b${name}\\(`);
  for (let i = from + 1; i <= L.length; i++) {
    if (/^(def|class)\s/.test(L[i - 1])) break;
    if (call.test(L[i - 1])) return i;
  }
  return 0;
}

// 保存データから、動画に出す値をそのまま取り出す。打ち直しや言い換えはしない。
function select(runs, fx) {
  const fail = m => { throw new Error(`保存データから動画の値を取り出せません（${m}）。`); };
  const must = (ok, m) => { if (!ok) fail(m); };
  const resp = (list, tool, phase) => {
    const r = (list || []).find(x => x.tool === tool && (!phase || x.phase === phase));
    must(r && r.response, `${tool}${phase ? '・' + phase : ''} の応答`);
    return r.response;
  };
  const step = id => { const s = (runs.steps || []).find(x => x.id === id); must(s, `${id} の手順`); return s; };
  const pairs = r => (r.rows || []).map(([caller, callee]) => ({caller, callee}));
  const key = r => r.caller + '\u0000' + r.callee;
  const firstRow = sg => {
    must(sg.total === 1 && sg.groups.length === 1 && sg.groups[0].rows.length === 1, 'search_graph の結果が1件');
    const g = sg.groups[0], [name, label, span] = g.rows[0], [start, end] = String(span).split('-').map(Number);
    must(/^\w+$/.test(name) && start > 0 && end >= start, 'search_graph の名前と行');
    return {name, label, file: g.file, start, end, total: sg.total};
  };

  // ツールと範囲
  const tool = runs.tool || {};
  const semver = /^codebase-memory-mcp (\d+\.\d+\.\d+)$/.exec(tool.version || '');
  must(semver && tool.release === 'v' + semver[1], '--version の出力とリリース名');
  must(/^[0-9a-f]{40}$/.test(tool.commit || ''), 'ソース固定コミット');
  must(String(tool.transport || '').includes('MCP protocol not exercised'), 'MCPプロトコルを使っていない注記');
  const scope = String(runs.scope_note || '');
  must(scope.includes('ブラウザAI') && scope.includes('実行時に記録したトレースではありません'), '範囲の注記');
  const listed = resp(runs.index && runs.index.response, 'list_projects').projects || [];
  must(listed.length === 1 && listed[0].name === runs.project, 'list_projects が返したプロジェクト名');

  // ソースの写しと、公開している fixture/ が同じか
  const base = (runs.source_snapshots || {}).base || {}, changed = (runs.source_snapshots || {}).changed || {};
  const svc = base['fixture/service.py'], stNew = changed['fixture/storage.py'];
  must(svc === fx.service && base['fixture/app.py'] === fx.app && base['fixture/storage.py'] === fx.storage && stNew === fx.revised,
    '公開している fixture/ と実行時のソースの写しが同じ');

  // 1. 探す：search_graph → get_code_snippet → 実ソースの def 行
  const find = step('find');
  const sg = firstRow(resp(find.response, 'search_graph'));
  const sn = resp(find.response, 'get_code_snippet');
  must(sg.label === 'Function' && sn.name === sg.name, '探した関数');
  const entry = sn.name, srcDef = defLine(svc, entry);
  must(srcDef > 0 && sn.start_line === srcDef && sg.start === srcDef, '定義の行が実ソースと一致');
  must(sn.file_path === 'fixture/' + sg.file, '定義のファイル');
  const body = sn.source.replace(/\n$/, '').split('\n'), svcLines = linesOf(svc);
  must(body.every((l, k) => l === svcLines[srcDef - 1 + k]), 'get_code_snippet の本文が実ソースの行と同じ');
  const bodyLines = body.filter(l => l.trim()).length;

  // 2. たどる：query_graph の組と trace_path の1段目
  const tr = step('trace');
  const rows = pairs(resp(tr.response, 'query_graph'));
  const calleeNames = rows.filter(r => r.caller === entry).map(r => r.callee);
  must(calleeNames.length === 3, `${entry} から出る組が3つ（動画の配置と一致）`);
  const tp = resp(tr.response, 'trace_path');
  const hop1 = {};
  for (const g of (tp.callees && tp.callees.groups) || []) for (const [name, hop] of g.rows) if (hop === 1) hop1[name] = g.qn_prefix.split('.').pop();
  must(Object.keys(hop1).length === calleeNames.length && calleeNames.every(n => hop1[n]), 'trace_path の1段目が query_graph の組と同じ');
  const callees = calleeNames.map(name => {
    must(/^\w+$/.test(name), `${name} の名前`);
    const line = callLine(svc, name, srcDef), module = hop1[name];
    must(line > 0 && line <= sn.end_line, `${name} の呼び出し式`);
    must(defLine(base[`fixture/${module}.py`] || '', name) > 0, `${name} の定義（${module}.py）`);
    return {name, line, module};
  });
  const callers = rows.filter(r => r.callee === entry).map(r => r.caller);
  must(callers.length === 1 && /^\w+$/.test(callers[0]), `${entry} を呼ぶ組`);
  const callerFile = Object.keys(base).find(f => f.endsWith('.py') && defLine(base[f], callers[0]) > 0);
  must(callerFile, `${callers[0]} の定義`);
  const callerLine = callLine(base[callerFile], entry, defLine(base[callerFile], callers[0]));
  must(callerLine > 0, `${callers[0]} の中の ${entry} の呼び出し式`);

  // 3. 変える：変更直後（再索引の前）と、手で index_repository をやり直した後
  const up = step('update');
  const initial = runs.calls_before, stale = runs.calls_stale, after = runs.calls_after;
  must(initial && stale && after, '再索引の前後の組');
  must(sameJSON(pairs(resp(up.response, 'query_graph', '再索引の前')), stale.rows)
    && sameJSON(pairs(resp(up.response, 'query_graph', '再索引の後')), after.rows), '前後の組が query_graph の応答と同じ');
  must([initial, stale, after].every(c => c.row_count === c.rows.length), '組の数');
  must(sameJSON(initial.rows, stale.rows), '変更直後の組が初回と同じ（索引は古いまま）');
  const added = after.rows.filter(r => !stale.rows.some(s => key(s) === key(r)));
  must(added.length === 1 && after.rows.length === stale.rows.length + 1, '再索引で増えた組が1つ');
  const edge = added[0];
  must(/^\w+$/.test(edge.caller) && /^\w+$/.test(edge.callee), '増えた組の名前');
  must((up.request || []).some(r => r.tool === 'index_repository' && r.phase === '手で再索引')
    && resp(up.response, 'index_repository', '手で再索引').status === 'indexed', '手で行った index_repository');
  const watch = resp(up.response, 'index_status', '再索引の前').watch || {};
  must(watch.watched === false, '再索引の前の watch');
  must(!fx.storage.includes(edge.callee), `変更前の storage.py に ${edge.callee} がない`);
  const saveDef = defLine(stNew, edge.caller), auditDef = defLine(stNew, edge.callee);
  const addLine = callLine(stNew, edge.callee, saveDef);
  must(saveDef > 0 && auditDef > 0 && addLine > 0, `差し替え後の ${edge.caller}・${edge.callee}`);
  const found = (up.response || []).filter(r => r.tool === 'search_graph' && r.phase === '再索引の後').map(r => firstRow(r.response));
  const saveRow = found.find(r => r.name === edge.caller), auditRow = found.find(r => r.name === edge.callee);
  must(saveRow && auditRow && saveRow.start === saveDef && auditRow.start === auditDef, '再索引後の定義の行が実ソースと一致');

  // 索引とは別の確認：架空の注文を実際に実行して書かれた JSON
  const ex = runs.fixture_execution || {};
  must(ex.base && ex.revised && ex.base.exit_code === 0 && ex.revised.exit_code === 0, 'app.py の終了コード');
  const receiptName = Object.keys(ex.base.files || {}).find(n => n.startsWith('receipt-'));
  const rc = receiptName && ex.base.files[receiptName];
  must(rc && rc.total_jpy === rc.seat_count * rc.seat_price_jpy, '領収の合計');
  must(String(rc.workshop).includes('架空'), '架空の注文であることの印');
  const auditName = Object.keys(ex.revised.files || {}).find(n => n.startsWith('audit-'));
  const ad = auditName && ex.revised.files[auditName];
  must(sameJSON(ex.revised.files[receiptName], rc), '変更後の領収が変更前と同じ');
  must(ad && ad.receipt_file === receiptName && ad.saved_total_jpy === rc.total_jpy && typeof ad.consistent === 'boolean', '照合JSON');

  return {
    version: tool.version, release: tool.release, commit: tool.commit, project: runs.project,
    find: {name: entry, path: sn.file_path, file: sg.file, line: srcDef, bodyLines, hits: sg.total},
    trace: {callees, caller: {name: callers[0], file: callerFile.split('/').pop(), line: callerLine}},
    update: {
      edge, addLine, saveDef, auditDef, file: 'storage.py', watched: watch.watched,
      initialRows: initial.rows.length, staleRows: stale.rows.length, afterRows: after.rows.length,
    },
    run: {
      orderId: rc.order_id, seats: rc.seat_count, price: rc.seat_price_jpy, total: rc.total_jpy, receiptName,
      auditName, recomputed: ad.recomputed_total_jpy, saved: ad.saved_total_jpy, consistent: ad.consistent,
    },
    memoPath: FILES.memo.path, runsPath: FILES.runs.path,
  };
}

async function load() {
  const fontLoads = [`700 52px ${SERIF}`, `700 34px ${SANS}`, `400 28px ${SANS}`, `400 22px ${SANS}`, `700 40px ${MONO}`, `400 22px ${MONO}`]
    .map(f => document.fonts.load(f, 'コードを索引して、関数と呼び出しを探す submit_order 2,400円'));
  const [runsBuf, , service, app, storage, revised] = await Promise.all([
    verified(FILES.runs.path, FILES.runs.sha256),
    // 結果メモは映像に描かないが、持ち帰るファイルとして示すため実在と一致を確かめる
    verified(FILES.memo.path, FILES.memo.sha256),
    ...[FIXTURE.service, FIXTURE.app, FIXTURE.storage, FIXTURE.revised].map(p => bytes(p).then(utf8)),
  ]);
  let runs;
  try { runs = JSON.parse(utf8(runsBuf)); }
  catch { throw new Error(`${FILES.runs.path} をJSONとして読めませんでした。`); }
  for (const [name, shot] of Object.entries(SHOTS)) IMG[name] = await image(shot);
  await Promise.all(fontLoads);
  await document.fonts.ready;
  D = select(runs, {service, app, storage, revised});
}

// ---------- 描画の部品 ----------

function font(weight, size, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }

function layer(a, dy, fn) {
  if (a <= 0.001) return;
  ctx.save(); ctx.globalAlpha *= a; if (dy) ctx.translate(0, dy); fn(); ctx.restore();
}

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// 1行の文字。幅を超えるときは min まで縮める（それ以下にはしない）。
function text(str, x, y, {weight = 400, size = 28, family = SANS, color = C.ink, align = 'left', base = 'alphabetic', max = Infinity, min = size} = {}) {
  let s = size; font(weight, s, family);
  while (s > min && ctx.measureText(str).width > max) font(weight, --s, family);
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}

function tag(str, x, cy, {bg = C.card, fg = C.ink, border = C.ink, size = 22, weight = 700, align = 'left', dash = null} = {}) {
  font(weight, size); const w = ctx.measureText(str).width + 24, h = size + 14;
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  rr(left, cy - h / 2, w, h, 3); ctx.fillStyle = bg; ctx.fill();
  if (border) {
    ctx.save(); if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(str, left + 12, cy + 1);
  return w;
}

// 日本語の禁則を簡単に守る折り返し（エラー表示用）
const NO_START = '、。，．・：；？！）」』】〕〉》ーぁぃぅぇぉっゃゅょァィゥェォッャュョ';
const NO_END = '（「『【〔〈《';
function wrap(str, max) {
  const toks = [...str.matchAll(/[A-Za-z0-9_.,:;/@#%+'’?!-]+|\s+|./gu)].map(m => m[0]);
  const lines = []; let cur = [];
  for (const tok of toks) {
    if (cur.length && !/^\s+$/.test(tok) && ctx.measureText(cur.join('') + tok).width > max) {
      const carry = [];
      if (cur.length > 1 && (NO_START.includes(tok[0]) || NO_END.includes(cur.at(-1).at(-1)))) carry.push(cur.pop());
      lines.push(cur.join('').trim()); cur = [...carry, tok];
    } else cur.push(tok);
  }
  if (cur.length) lines.push(cur.join('').trim());
  return lines;
}

function paragraph(str, x, y, max, lh, {weight = 400, size = 24, family = SANS, color = C.ink} = {}) {
  font(weight, size, family);
  wrap(str, max).forEach((ln, k) => { ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(ln, x, y + k * lh); });
}

const heading = str => text(str, M, 150, {weight: 700, size: 52, family: SERIF, max: CW, min: 44});

function panel(r, accent = C.ink) {
  ctx.fillStyle = C.card; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = accent; ctx.fillRect(r.x, r.y, r.w, 3);
}

// 索引にある関数の札（青）／索引にまだない関数の札（破線）
function fnNode(r, name, sub, {missing = false, size = 30, module = ''} = {}) {
  rr(r.x, r.y, r.w, r.h, 6);
  ctx.fillStyle = missing ? C.paper : C.blueWash; ctx.fill();
  ctx.save(); if (missing) ctx.setLineDash([7, 6]);
  ctx.strokeStyle = missing ? C.soft : C.blue; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  let mw = 0;
  if (module) mw = text(module, r.x + r.w - 20, r.y + 32, {size: 20, family: MONO, color: C.soft, align: 'right', base: 'middle'}) + 16;
  text(name, r.x + 20, r.y + 32, {weight: 700, size, family: MONO, color: missing ? C.soft : C.ink, base: 'middle', max: r.w - 40 - mw, min: size - 6});
  if (sub) text(sub, r.x + 20, r.y + r.h - 22, {size: 22, color: missing ? C.soft : C.ink, base: 'middle', max: r.w - 40, min: 18});
}

// 矢印＝索引の CALLS（静的な呼び出し）。3次ベジェを p（0–1）まで伸ばし、先端に矢じりを置く。
const bez = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
function link(P, p, {color = C.blue, width = 3, dash = null} = {}) {
  if (p <= 0.001) return;
  const pt = u => [bez(P[0][0], P[1][0], P[2][0], P[3][0], u), bez(P[0][1], P[1][1], P[2][1], P[3][1], u)];
  const steps = Math.max(2, Math.ceil(48 * p));
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) { const [x, y] = pt(p * i / steps); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke(); ctx.restore();
  const [x1, y1] = pt(p), [x0, y0] = pt(Math.max(0, p - 0.03));
  ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-12, -7); ctx.lineTo(-12, 7); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
const straight = (x0, y, x1) => [[x0, y], [lerp(x0, x1, 0.33), y], [lerp(x0, x1, 0.66), y], [x1, y]];

// 実画面の切り抜き。元画像の座標→表示先の座標の対応を返す。
function mapper(c) {
  const k = c.at.w / c.src.w;
  return {k, h: c.src.h * k, at: (sx, sy) => [c.at.x + (sx - c.src.x) * k, c.at.y + (sy - c.src.y) * k]};
}
function crop(img, c) {
  const m = mapper(c);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, c.src.x, c.src.y, c.src.w, c.src.h, c.at.x, c.at.y, c.at.w, m.h);
  ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(c.at.x + 0.5, c.at.y + 0.5, c.at.w - 1, m.h - 1);
  return m;
}
function ring(c, box, {color = C.blue, dash = null} = {}) {
  const m = mapper(c), [x0, y0] = m.at(box[0], box[1]), [x1, y1] = m.at(box[2], box[3]);
  ctx.save(); if (dash) ctx.setLineDash(dash);
  rr(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8, 6); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}
const screenLabel = (str, y, x = R_X) => text(str, x, y, {size: 22, color: C.soft, max: RX - x, min: 20});

// ---------- 常に表示する枠 ----------

const sceneAt = t => { let k = 0; SCENES.forEach((s, i) => { if (t >= s.start) k = i; }); return k; };

function topBar(t) {
  const cur = sceneAt(t), cy = 64, items = [];
  let x = M;
  SCENES.forEach((s, k) => {
    const label = `${k + 1} ${s.step}`;
    font(700, 22); const w = ctx.measureText(label).width; // 太字の幅で並べ、場面が変わっても位置を動かさない
    font(k === cur ? 700 : 400, 22);
    ctx.fillStyle = k === cur ? C.ink : C.soft; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, cy);
    items.push({x, w}); x += w;
    if (k < SCENES.length - 1) { font(400, 22); ctx.fillStyle = C.soft; ctx.fillText('→', x + 10, cy); x += 46; }
  });
  const p = cur ? out3(prog(t, SCENES[cur].start, SCENES[cur].start + 0.45)) : 1;
  const a = items[Math.max(0, cur - 1)], b = items[cur];
  ctx.fillStyle = C.ink; ctx.fillRect(lerp(a.x, b.x, p), cy + 17, lerp(a.w, b.w, p), 2);
  // 範囲の札は1つだけ。最後の一枚で尺と無音の表記に替える。
  const swap = prog(t, 25.2, 25.5);
  layer(1 - swap, 0, () => tag('保存済みのCLI結果・架空のリポジトリ', RX, cy, {align: 'right', size: 20}));
  layer(swap, 0, () => tag('28秒・無音の編集動画', RX, cy, {align: 'right', size: 20}));
}

function sourceLabel(t) {
  if (t < 4) return `素材：${D.runsPath}（tool・index・scope_note）`;
  if (t < 10) return `素材：${D.runsPath}（search_graph・get_code_snippet・ソースの写し）＋ ${SHOTS.find.path}`;
  if (t < 16) return `素材：${D.runsPath}（query_graph・trace_path・ソースの写し）`;
  if (t < 22) return `素材：${D.runsPath}（再索引の前後）＋ ${SHOTS.update.path}`;
  if (t < 25.35) return `素材：${D.runsPath}（fixture_execution：実際に書かれたJSON）`;
  return `画面：${SHOTS.phone.path}（Studio Yebisu が撮影した作例ビューアの実画面）`;
}

function footer(t) {
  ctx.fillStyle = C.rule; ctx.fillRect(M, 644, CW, 1);
  text(sourceLabel(t), M, 678, {size: 20, color: C.soft, max: CW - 220, min: 17});
  text('Studio Yebisu 作例', RX, 678, {size: 20, color: C.soft, align: 'right'});
}

// ---------- 1. 目的（0–4秒） ----------

const STEPS = [
  {verb: '探す', sub: '関数の定義と行'},
  {verb: 'たどる', sub: '静的な呼び出し'},
  {verb: '変える', sub: '手で索引し直す'},
  {verb: '確かめる', sub: '保存した結果'},
];

function stepCard(k, s) {
  const r = {x: M + k * 294, y: 310, w: 270, h: 130};
  panel(r);
  ctx.beginPath(); ctx.arc(r.x + 40, r.y + 50, 17, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill();
  text(String(k + 1), r.x + 40, r.y + 51, {weight: 700, size: 22, color: C.paper, align: 'center', base: 'middle'});
  text(s.verb, r.x + 70, r.y + 51, {weight: 700, size: 34, base: 'middle'});
  text(s.sub, r.x + 24, r.y + 104, {size: 26, color: C.soft, max: r.w - 48, min: 22});
}

function sceneGoal(t) {
  const out = leave(t, 3.6, 0.4);
  let e = enter(t, 0.1);
  layer(e.a * out, e.dy, () => text(`Codebase Memory MCP 作例 ・ 公式 CLI（--version：${D.version}）`, M, 132, {size: 24, color: C.soft, max: CW, min: 20}));
  e = enter(t, 0.25, 0.5);
  layer(e.a * out, e.dy, () => text('コードを索引して、関数と呼び出しを探す', M, 206, {weight: 700, size: 52, family: SERIF, max: CW, min: 44}));
  e = enter(t, 0.8);
  layer(e.a * out, e.dy, () => text('知らないコードで、関数の場所・呼び出し先・変更後・保存結果を確かめる', M, 268, {size: 30, max: CW, min: 26}));
  STEPS.forEach((s, k) => { const ce = enter(t, 1.2 + k * 0.15); layer(ce.a * out, ce.dy, () => stepCard(k, s)); });
  e = enter(t, 2.0);
  layer(e.a * out, e.dy, () => {
    const w = tag('保存済み', M, 512, {bg: C.ink, fg: C.paper, border: C.ink, size: 24});
    text('CLI の実行結果を保存して編集した説明です。ブラウザーで AI は動きません', M + w + 18, 513, {size: 28, base: 'middle', max: CW - w - 18, min: 24});
  });
  e = enter(t, 2.2);
  layer(e.a * out, e.dy, () => text(`架空の注文リポジトリ（fixture/）・プロジェクト名 ${D.project}`, M, 584, {size: 24, color: C.soft, max: CW, min: 20}));
}

// ---------- 2. 探す（4–10秒） ----------

function sceneFind(t) {
  const out = leave(t, 9.6, 0.4), f = D.find;
  let e = enter(t, 4.1, 0.5);
  layer(e.a * out, e.dy, () => heading('名前で探し、定義の行を照合する'));
  e = enter(t, 4.5);
  layer(e.a * out, e.dy, () => text(`search_graph が返した定義（${f.hits}件）`, M, 220, {size: 24, color: C.soft, max: 560, min: 20}));
  // 関数名の札は entryNode() が描く（次の場面へ移るため）
  e = enter(t, 5.0);
  layer(e.a * out, e.dy, () => text(`${f.path} の ${f.line}行目`, M, 366, {size: 32, max: 576, min: 26}));
  e = enter(t, 5.6);
  layer(e.a * out, e.dy, () => {
    ctx.fillStyle = C.rule; ctx.fillRect(M, 396, 576, 1);
    const w = tag('一致', M, 440, {bg: C.blue, fg: C.white, border: C.blue, size: 22});
    text(`実ソースの def 行も ${f.line}行目`, M + w + 14, 441, {size: 28, base: 'middle', max: 576 - w - 14, min: 24});
  });
  e = enter(t, 5.9);
  layer(e.a * out, e.dy, () => {
    const w = tag('一致', M, 500, {bg: C.blue, fg: C.white, border: C.blue, size: 22});
    text(`get_code_snippet の本文 ${f.bodyLines}行も同じ`, M + w + 14, 501, {size: 28, base: 'middle', max: 576 - w - 14, min: 24});
  });

  // 実際の画面：索引の値と、実ソースの行
  e = enter(t, 5.3);
  layer(e.a * out, e.dy, () => { screenLabel('実際のビューア画面：索引の値と実ソースの照合', 220); crop(IMG.find, CROP.findIndex); });
  layer(out3(prog(t, 6.0, 6.3)) * out, 0, () => ring(CROP.findIndex, CROP.findIndex.ring));
  e = enter(t, 6.3);
  layer(e.a * out, e.dy, () => { screenLabel(`実際のビューア画面：実ソースの ${f.line}・${f.line + 1}行目`, 368); crop(IMG.find, CROP.findSource); });
  layer(out3(prog(t, 6.9, 7.2)) * out, 0, () => ring(CROP.findSource, CROP.findSource.ring));
}

// 探した関数の札：4.7秒に入り、9.7–10.3秒で「たどる」の札へ移る。15.6秒から消える。
function entryNode(t) {
  if (t < 4.7 || t >= 16) return;
  const e = enter(t, 4.7), m = inOut(prog(t, 9.7, 10.3));
  const r = lerpRect(ENTRY_FIND, ENTRY, m);
  layer(e.a * leave(t, 15.6, 0.4), e.dy * (1 - m), () => {
    rr(r.x, r.y, r.w, r.h, 6); ctx.fillStyle = C.blueWash; ctx.fill();
    ctx.strokeStyle = C.blue; ctx.lineWidth = lerp(2, 3, m); ctx.stroke();
    text(D.find.name, r.x + 22, lerp(r.y + r.h / 2 + 1, r.y + 36, m), {weight: 700, size: Math.round(lerp(40, 32, m)), family: MONO, base: 'middle'});
    layer(prog(t, 10.2, 10.45), 0, () => text(`${D.find.file} ・ 探した関数`, r.x + 22, r.y + r.h - 22, {size: 22, base: 'middle', max: r.w - 44, min: 18}));
  });
}

// ---------- 3. たどる（10–16秒） ----------

function sceneTrace(t) {
  const out = leave(t, 15.6, 0.4), tr = D.trace;
  let e = enter(t, 10.1, 0.5);
  layer(e.a * out, e.dy, () => heading('呼び出し関係を、索引からたどる'));

  // 呼ぶ側：query_graph の組（caller → 探した関数）
  e = enter(t, 10.45);
  layer(e.a * out, e.dy, () => fnNode(MAIN, tr.caller.name, `${tr.caller.file} ${tr.caller.line}行目で呼ぶ`));
  layer(out, 0, () => link(straight(MAIN.x + MAIN.w, MAIN.y + MAIN.h / 2, ENTRY.x - 3), inOut(prog(t, 10.6, 11.0))));

  // 呼ばれる側：返った組の順に並べる。並びは実行の順番を表さない。
  e = enter(t, 11.0);
  layer(e.a * out, e.dy, () => text('呼び出し先（trace_path の1段目も同じ）', RX, 196, {size: 20, color: C.soft, align: 'right', max: CALLEE_W, min: 18}));
  const x0 = ENTRY.x + ENTRY.w, y0 = ENTRY.y + ENTRY.h / 2;
  tr.callees.forEach((c, k) => {
    const r = calleeRect(k), cy = r.y + r.h / 2, s = 11.0 + k * 0.25;
    layer(out, 0, () => link([[x0, y0], [x0 + 55, y0], [x0 + 55, cy], [r.x - 3, cy]], inOut(prog(t, s, s + 0.5))));
    const ce = enter(t, s + 0.3);
    layer(ce.a * out, ce.dy, () => fnNode(r, c.name, `${D.find.file} ${c.line}行目で呼ぶ`, {module: c.module}));
  });

  e = enter(t, 12.1);
  layer(e.a * out, e.dy, () => {
    const w = tag('静的', M, 566, {bg: C.blue, fg: C.white, border: C.blue, size: 22});
    text('→ はソースから読んだ CALLS の関係。実行時の記録ではありません', M + w + 14, 567, {size: 28, base: 'middle', max: CW - w - 14, min: 24});
  });
  e = enter(t, 12.4);
  layer(e.a * out, e.dy, () => text('動的な呼び出しは出ないことがあり、矢印がないことは「呼ばれない」の証明ではありません', M, 616, {size: 24, color: C.soft, max: CW, min: 20}));
}

// ---------- 4. 変える（16–22秒） ----------

function sceneUpdate(t) {
  const out = leave(t, 21.6, 0.4), u = D.update;
  const done = prog(t, 19.0, 19.4); // 手で index_repository をやり直した後
  let e = enter(t, 16.1, 0.5);
  layer(e.a * out, e.dy, () => heading('変えたら、手で索引し直す'));
  e = enter(t, 16.4);
  layer(e.a * out, e.dy, () => text(`実行用コピーの ${u.file} を差し替え`, M, 220, {size: 24, color: C.soft, max: 576, min: 20}));
  e = enter(t, 16.6);
  layer(e.a * out, e.dy, () => text(`${u.edge.caller} の ${u.addLine}行目に、呼び出しを追加`, M, 264, {size: 28, max: 576, min: 24}));

  // 増えた呼び出し：索引にまだない（破線）→ 手で再索引した後（青）
  e = enter(t, 17.0);
  layer(e.a * out, e.dy, () => fnNode(SAVE, u.edge.caller, `${u.file} ${u.saveDef}行目`, {size: 26}));
  const ae = enter(t, 17.2), arrow = straight(SAVE.x + SAVE.w, SAVE.y + SAVE.h / 2, AUDIT.x - 3);
  layer(ae.a * out * (1 - done), ae.dy, () => {
    fnNode(AUDIT, u.edge.callee, '索引にまだない', {missing: true, size: 26});
    link(arrow, inOut(prog(t, 17.2, 17.6)), {color: C.soft, dash: [7, 6]});
  });
  layer(out * done, 0, () => {
    fnNode(AUDIT, u.edge.callee, `${u.file} ${u.auditDef}行目`, {size: 26});
    link(arrow, 1);
  });

  e = enter(t, 17.4);
  layer(e.a * out, e.dy, () => text(`query_graph の組に ${u.edge.caller} → ${u.edge.callee} があるか`, M, 446, {size: 22, color: C.soft, max: 576, min: 18}));
  e = enter(t, 17.6);
  layer(e.a * out, e.dy, () => {
    tag('変更後・再索引の前', M, 488, {bg: C.paper, fg: C.soft, border: C.soft, dash: [5, 4], size: 22});
    text(`なし ・ 組 ${u.staleRows}件`, M + 296, 489, {size: 30, color: C.soft, base: 'middle'});
  });
  e = enter(t, 18.8);
  layer(e.a * out, e.dy, () => {
    tag('手で index_repository', M, 544, {bg: C.blue, fg: C.white, border: C.blue, size: 22});
    text(`あり ・ 組 ${u.afterRows}件`, M + 296, 545, {weight: 700, size: 30, color: C.blue, base: 'middle'});
  });
  e = enter(t, 19.6);
  layer(e.a * out, e.dy, () => text(`CLI の索引は監視されない（watch: ${u.watched}）。変更したら手で再索引する`, M, 606, {size: 28, max: CW, min: 24}));

  // 実際の画面：「変更後・再索引の前」と「手で再索引した後」
  e = enter(t, 17.3);
  layer(e.a * out, e.dy, () => { screenLabel('実際のビューア画面：再索引の前と後', 220); crop(IMG.update, CROP.update); });
  layer(out3(prog(t, 17.9, 18.2)) * (1 - prog(t, 19.2, 19.5)) * out, 0, () => ring(CROP.update, CROP.update.stale, {color: C.ink, dash: [7, 5]}));
  layer(out3(prog(t, 19.3, 19.6)) * out, 0, () => ring(CROP.update, CROP.update.after));
  e = enter(t, 18.1);
  layer(e.a * out, e.dy, () => text(`初回の索引（変更前）も なし ・ 組 ${u.initialRows}件`, R_X, 452, {size: 24, color: C.soft, max: RX - R_X, min: 20}));
}

// ---------- 5. 確かめる（22–28秒） ----------

function runCard(r, label, file, big, bigFamily, sub) {
  panel(r);
  text(label, r.x + 28, r.y + 44, {size: 24, color: C.soft, max: r.w - 56, min: 20});
  text(file, r.x + 28, r.y + 86, {size: 24, family: MONO, max: r.w - 56, min: 20});
  text(big, r.x + 28, r.y + 172, {weight: 700, size: bigFamily === MONO ? 44 : 56, family: bigFamily, max: r.w - 56, min: 36});
  text(sub, r.x + 28, r.y + 232, {size: 28, max: r.w - 56, min: 24});
}

function sceneReceipt(t) {
  const out = leave(t, 25.2, 0.3), run = D.run;
  let e = enter(t, 22.05, 0.5);
  layer(e.a * out, e.dy, () => heading('索引とは別に、架空の注文を実際に実行'));
  e = enter(t, 22.25);
  layer(e.a * out, e.dy, () => {
    const w = tag('実行', M, 214, {bg: C.ink, fg: C.paper, border: C.ink, size: 22});
    text('app.py を Python で実行（終了コード 0）。書かれた JSON をそのまま読む', M + w + 14, 215, {size: 26, base: 'middle', max: CW - w - 14, min: 22});
  });
  e = enter(t, 22.35);
  layer(e.a * out, e.dy, () => runCard({x: M, y: 252, w: 560, h: 280}, '変更前のコピー', run.receiptName, yen(run.total), SANS,
    `total_jpy ＝ ${run.seats}席 × ${yen(run.price)}`));
  e = enter(t, 22.55);
  layer(e.a * out, e.dy, () => runCard({x: RX - 560, y: 252, w: 560, h: 280}, `変更後のコピー（${D.update.edge.callee} あり）`, run.auditName,
    `consistent: ${run.consistent}`, MONO, `再計算 ${yen(run.recomputed)} ＝ 保存 ${yen(run.saved)}`));
  e = enter(t, 22.7);
  layer(e.a * out, e.dy, () => {
    text(`注文 ${run.orderId} は作例用の架空データ。決済・予約・通知はしていません`, M, 580, {size: 28, max: CW, min: 24});
    text(`記録：${D.runsPath} ・ ${D.memoPath}（作例フォルダに保存済み）`, M, 620, {size: 22, color: C.soft, max: CW, min: 18});
  });
}

function sceneFinal(t) {
  const L = CROP.phone.at.x - 40 - M; // 左の列の幅
  let e = enter(t, 25.45, 0.35);
  layer(e.a, e.dy, () => text('Codebase Memory MCP 作例 ・ Studio Yebisu', M, 150, {size: 24, color: C.soft, max: L, min: 20}));
  e = enter(t, 25.45);
  layer(e.a, e.dy, () => text('Codebase Memory MCP で確かめたこと', M, 210, {weight: 700, size: 46, family: SERIF, max: L, min: 42}));
  const u = D.update, rows = [
    ['探す', `${D.find.name} ・ ${D.find.file} ${D.find.line}行目`],
    ['たどる', `${D.find.name} から静的な呼び出し ${D.trace.callees.length}つ`],
    ['変える', `手で再索引して ${u.edge.caller} → ${u.edge.callee}`],
    ['確かめる', `${D.runsPath} ・ ${D.memoPath}`],
  ];
  rows.forEach(([verb, value], k) => {
    const re = enter(t, 25.5 + k * 0.05, 0.35), y = 276 + k * 50;
    layer(re.a, re.dy, () => {
      text(verb, M, y, {weight: 700, size: 28});
      text(value, M + 150, y, {size: 28, max: L - 150, min: 22});
    });
  });
  e = enter(t, 25.6, 0.35);
  layer(e.a, e.dy, () => {
    ctx.fillStyle = C.rule; ctx.fillRect(M, 470, L, 1);
    const w = tag('範囲', M, 508, {bg: C.paper, fg: C.ink, border: C.ink, size: 22});
    text('MCP 経由・ブラウザーAI・意味検索・速さは試していません', M + w + 14, 509, {size: 26, base: 'middle', max: L - w - 14, min: 22});
  });
  e = enter(t, 25.65, 0.3);
  layer(e.a, e.dy, () => {
    text(`${D.version}（${D.release}）・ 公式ネイティブ CLI の保存結果`, M, 562, {size: 22, color: C.soft, max: L, min: 18});
    text(`ソース固定コミット ${D.commit}`, M, 598, {size: 20, family: MONO, color: C.soft, max: L, min: 16});
  });
  // 実際の画面（スマートフォン幅の最初の画面）と「保存済みの結果 / ライブ検索なし」
  e = enter(t, 25.5, 0.4);
  layer(e.a, e.dy, () => {
    text('実際のビューア（スマートフォン幅）', RX, 184, {size: 20, color: C.soft, align: 'right'});
    crop(IMG.phone, CROP.phone);
  });
  layer(out3(prog(t, 25.7, 25.95)), 0, () => ring(CROP.phone, CROP.phone.ring));
}

// ---------- seek ----------

function resetCanvas() {
  canvas.width = W; canvas.height = H; // 毎回、Canvasの内容と状態をすべて初期化する
  ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  const s = Math.min(W / 1280, H / 720);
  ctx.setTransform(s, 0, 0, s, (W - 1280 * s) / 2, (H - 720 * s) / 2);
}

function draw(t) {
  resetCanvas();
  topBar(t);
  footer(t);
  if (t < 4) sceneGoal(t);
  if (t >= 4 && t < 10) sceneFind(t);
  entryNode(t);
  if (t >= 10 && t < 16) sceneTrace(t);
  if (t >= 16 && t < 22) sceneUpdate(t);
  if (t >= 22 && t < 25.5) sceneReceipt(t);
  if (t >= 25.45) sceneFinal(t);
}

function drawError(message) {
  resetCanvas();
  ctx.fillStyle = C.red; ctx.fillRect(M, 280, 6, 150);
  text('素材を読み込めなかったため、動画を描画していません', M + 28, 320, {weight: 700, size: 34, color: C.red, max: CW - 28, min: 24});
  paragraph(message, M + 28, 372, CW - 40, 34, {size: 22});
}

function describe() {
  const f = D.find, tr = D.trace, u = D.update, run = D.run;
  return `Codebase Memory MCPの作例を説明する28秒・無音の編集動画。公式CLI（${D.version}）の保存結果から、`
    + `${f.name}が${f.path}の${f.line}行目にあり実ソースと一致すること、${tr.caller.name}から呼ばれ、${tr.callees.map(c => c.name).join('・')}を呼ぶ静的な関係を示す。`
    + `${u.file}を差し替えた直後の索引には${u.edge.caller}→${u.edge.callee}がなく（組${u.staleRows}件）、手でindex_repositoryをやり直すと現れる（組${u.afterRows}件）。`
    + `索引とは別に、架空の注文${run.orderId}を実際に実行した領収は${yen(run.total)}、照合はconsistent: ${run.consistent}。最後に作例ビューアの実際の画面と、試していない範囲を示す。`;
}

const $ = id => document.getElementById(id);
const ui = {play: $('play'), scrub: $('scrub'), status: $('status'), announce: $('announce')};
let current = POSTER, playing = false, raf = 0, baseT = 0, baseWall = 0, stateText = '素材を読み込んでいます…';

function showStatus() {
  if (ui.status) ui.status.textContent = `${current.toFixed(2)} / ${DURATION.toFixed(2)} 秒 ・ ${stateText}`;
}

window.seek = seconds => {
  const t = clamp(Number(seconds) || 0, 0, DURATION);
  if (!ready) return window.motionReady.then(() => window.seek(t));
  current = t;
  draw(t);
  if (ui.scrub) { ui.scrub.value = t.toFixed(2); ui.scrub.setAttribute('aria-valuetext', `${t.toFixed(1)}秒`); }
  showStatus();
  return undefined;
};

// プレビュー用の再生。書き出し時（__MOTION_RENDER__）は動かさない。
function tick(now) {
  if (!playing) return;
  const t = baseT + (now - baseWall) / 1000;
  if (t >= DURATION) { window.seek(DURATION); setPlaying(false); return; }
  window.seek(t);
  raf = requestAnimationFrame(tick);
}

function setPlaying(on) {
  if (RENDER || !ready) return;
  playing = on;
  cancelAnimationFrame(raf);
  ui.play.textContent = on ? '一時停止' : '再生';
  ui.play.setAttribute('aria-pressed', String(on));
  stateText = on ? '再生中' : '停止中（保存済みの結果から描画・無音）';
  showStatus();
  if (!on) return;
  if (current >= DURATION - 0.01) window.seek(0);
  baseT = current; baseWall = performance.now();
  raf = requestAnimationFrame(tick);
}

function setupUi() {
  canvas.setAttribute('aria-label', describe());
  stateText = '準備完了（保存済みの結果から描画・無音）';
  showStatus();
  if (ui.announce) ui.announce.textContent = '準備完了：28秒・無音の編集動画です。保存済みのCLI結果と実際の画面から描画しています。';
  if (RENDER || !ui.play || !ui.scrub) return;
  ui.play.disabled = false;
  ui.scrub.disabled = false;
  ui.play.addEventListener('click', () => setPlaying(!playing));
  ui.scrub.addEventListener('input', () => {
    window.seek(Number(ui.scrub.value));
    if (playing) { baseT = current; baseWall = performance.now(); }
  });
}

window.motionReady = load().then(() => {
  ready = true;
  window.motionState = 'ready';
  document.documentElement.dataset.motion = 'ready';
  window.seek(RENDER ? 0 : POSTER);
  setupUi();
});

window.motionReady.catch(err => {
  const message = err && err.message ? err.message : String(err);
  window.motionState = 'error';
  window.motionError = message;
  document.documentElement.dataset.motion = 'error';
  drawError(message);
  if (ui.play) ui.play.disabled = true;
  if (ui.scrub) ui.scrub.disabled = true;
  if (ui.status) { ui.status.textContent = `エラー：${message} 再生できません。`; ui.status.classList.add('error'); }
  if (ui.announce) ui.announce.textContent = `エラー：${message}`;
});
