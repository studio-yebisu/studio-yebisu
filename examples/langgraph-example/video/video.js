// Studio Yebisu: LangGraph作例 — 編集動画（28秒・無音）
// Copyright (c) 2026 Studio Yebisu. MIT License.
// 保存済みの outputs/runs.json・inputs/requests.json と、保存結果ビューアの実際のスクリーンショットだけを読み、
// window.seek(秒) が任意の時刻の完成した画面を1枚のCanvasへ描く。Python・LangGraph・AIはここでは動かない。

const RC = window.renderConfig || {};
const pickNum = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
const W = pickNum(RC.width, 1280), H = pickNum(RC.height, 720), FPS = pickNum(RC.fps, 30);
const DURATION = 28, POSTER = 13.5;
const RENDER = window.__MOTION_RENDER__ === true;
window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER, audioEvents: []};
if (RENDER) document.documentElement.classList.add('render');

const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",system-ui,sans-serif';
const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP","Source Han Serif JP",Georgia,serif';
const MONO = '"SFMono-Regular",Consolas,Menlo,"Liberation Mono",monospace';
// 作例ページ（style.css）と同じ紙・墨・承認・停止・差し戻しの色
const C = {
  paper: '#f4eee2', card: '#fbf8f1', sheet: '#fffdf8', ink: '#1e1c19', soft: '#585249', rule: '#d3c8b3',
  green: '#2b684a', greenWash: '#e0ebe2', amber: '#85560a', amberWash: '#f5e5c3', red: '#9e2f29', redWash: '#f5dedb',
  white: '#ffffff',
};
const M = 64, CW = 1152, RX = M + CW; // 安全余白64px

// 場面の時刻。storyboard.json と同じ値。
const SCENES = [
  {id: 'pass', step: '渡す', start: 0, end: 4},
  {id: 'pause', step: '止める', start: 4, end: 10},
  {id: 'resume', step: '再開する', start: 10, end: 16},
  {id: 'branch', step: '分ける', start: 16, end: 22},
  {id: 'inspect', step: '確かめる', start: 22, end: 28},
];

// ノード名の日本語は作例ビューア（app.mjs）と同じ。needs_input だけ札に収まるよう「追加入力」と短くする。
const NODE_LABELS = {validate: '入力確認', needs_input: '追加入力', estimate: '見積', review: '確認待ち', finalize: '要約', __end__: '終了'};
const STATUS = {approved: '承認', rejected: '差し戻し', needs_input: '追加入力が必要'};

// 経路の札：5列の格子。札の幅198px・間隔40px。
const PITCH = 238, CHIP_W = 198;
const col = i => M + i * PITCH;
const chipRect = i => ({x: col(i), y: 250, w: CHIP_W, h: 90});
const tokenRect = pos => ({x: col(pos), y: 190, w: CHIP_W, h: 42});

const CARD = {x: 64, y: 204, w: 640, h: 340};
const P_STATE = {x: 64, y: 392, w: 540, h: 168};
const P_EST = {x: 676, y: 392, w: 540, h: 168};
const P_STATE2 = {x: 64, y: 392, w: 291, h: 168};
const P_ANSWER = {x: 379, y: 392, w: 520, h: 168};
const P_FINAL = {x: 924, y: 392, w: 292, h: 168};

// 素材一覧（outputs/movie-materials.json）にある実際のスクリーンショットのうち、使う1枚
const SHOT = 'assets/desk-pause.png';
// 切り抜きは元画像の座標。「通った経路」から「見積合計」まで。伸縮させない。
const DESK = {x: 280, y: 92, w: 690, h: 520};
const RINGS = [
  {n: 1, box: [629, 134, 893, 207], t0: 22.9}, // 「確認待ち review ここで停止→再開」の札
  {n: 2, box: [296, 574, 556, 604], t0: 23.2}, // 「見積合計 8,000円」の行
];

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

// ---------- 素材の読み込み（ハッシュと寸法を素材一覧と照合） ----------

const here = path => new URL('../' + path, import.meta.url);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const json = buf => JSON.parse(new TextDecoder('utf-8').decode(buf));

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
  if (hex(await crypto.subtle.digest('SHA-256', buf)) !== sha) throw new Error(`${path} のSHA-256が素材一覧と一致しません。`);
  return buf;
}

function sameJSON(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => sameJSON(a[k], b[k]));
}

// 作例ビューア（app.mjs）と同じ並べ方：チェックポイントの next を古い順に
function routeFrom(checkpoints, endedNext) {
  const route = [];
  for (const point of checkpoints) {
    for (const node of point.next || []) if (node !== '__start__' && route.at(-1) !== node) route.push(node);
  }
  if (endedNext && endedNext.length === 0) route.push('__end__');
  return route;
}

// 保存データから、動画に出す値をそのまま取り出す。打ち直しや言い換えはしない。
function select(runs, requests, materials) {
  const fail = m => { throw new Error(`保存データから動画の値を取り出せません（${m}）。`); };
  const must = (ok, m) => { if (!ok) fail(m); };
  must(runs.fictional === true && requests.fictional === true, '架空の入力であることの印');
  must(sameJSON(runs.rules, requests.rules), '単価表と規則が inputs/requests.json と一致');
  must(runs.rules.all_complete_requests_pause_for_review === true, '完全な申請をすべて確認待ちにする規則');
  const names = Object.fromEntries((runs.rules.catalog || []).map(c => [c.sku, c.name]));
  const scope = String(runs.scope_note || '');
  must(scope.includes('InMemorySaver') && scope.includes('同じ Python プロセス内'), 'InMemorySaver と同じプロセス内での再開の注記');
  const noLLM = (scope.match(/[^。]+。/g) || []).map(s => s.trim()).find(s => s.includes('LLM'));
  must(noLLM, 'LLMを使っていないことの注記');

  const job = id => {
    const r = (runs.jobs || []).find(j => j.id === id), s = (requests.jobs || []).find(j => j.id === id);
    must(r && s, `${id} がありません`);
    must(sameJSON(r.input, s.request) && sameJSON(r.test_resume, s.test_resume), `${id} の入力とテスト回答が inputs/requests.json と一致`);
    return r;
  };
  const routeOf = j => routeFrom(j.checkpoints || [], j.end_state && j.end_state.next);
  const paused = (j, route) => {
    must(j.pause && j.pause.interrupts.length === 1, `${j.id} の interrupt`);
    const next = j.pause.state.next;
    must(next.length === 1 && route.includes(next[0]), `${j.id} の停止位置`);
    const cp = j.checkpoints.find(c => (c.interrupt_ids || []).length);
    must(cp && sameJSON(cp.next, next) && cp.interrupt_ids[0] === j.pause.interrupts[0].id, `${j.id} のチェックポイントの interrupt`);
    must(sameJSON(j.final.review, j.test_resume), `${j.id} の最終状態の review がテスト回答と一致`);
    return {next, stop: route.indexOf(next[0])};
  };

  // 通常の申請：停止 → テスト回答 true で再開 → approved
  const a = job('approved');
  const aRoute = routeOf(a), aStop = paused(a, aRoute);
  must(aRoute.length === 5 && aStop.stop === 2 && aRoute.at(-1) === '__end__', '通常の申請の経路が動画の配置（5つの札・3つ目で停止）と一致');
  must(a.test_resume.approved === true && a.final.status === 'approved', '通常の申請の結果');
  must(a.after_resume && Array.isArray(a.after_resume.next) && a.after_resume.next.length === 0, '再開後の next');
  const aState = a.pause.state.values, payload = a.pause.interrupts[0].value;
  must(aState.total_yen === a.final.total_yen && payload.total_yen === aState.total_yen, '見積合計が停止時と最終状態で一致');
  must(aState.budget_flag === false, '通常の申請は基準未満でも止まったこと');
  const lines = aState.line_items || [];
  must(lines.length >= 1 && lines.length <= 2, '見積の行数');
  must(a.input.items.every(i => names[i.sku]), '品目名');

  // 返却日のない申請：止まらずに needs_input
  const m = job('missing');
  const mRoute = routeOf(m);
  must(m.pause === null && m.test_resume === null && m.checks.interrupt_count === 0, '返却日のない申請は interrupt なし');
  must(m.checkpoints.every(c => !(c.interrupt_ids || []).length), '返却日のない申請のチェックポイントに interrupt がない');
  must(m.final.status === 'needs_input' && (m.final.missing_fields || []).length === 1, '返却日のない申請の結果');
  const field = m.final.missing_fields[0];
  must(String(m.input[field] ?? '').trim() === '', '空欄の項目');
  must(mRoute.length <= 3 && !mRoute.includes('estimate') && !mRoute.includes('review'), '返却日のない申請の経路');

  // 高額の申請：停止 → テスト回答 false で再開 → rejected
  const r = job('rejected');
  const rRoute = routeOf(r), rStop = paused(r, rRoute);
  must(rRoute.length <= 5, '高額の申請の経路');
  must(r.test_resume.approved === false && r.final.status === 'rejected', '高額の申請の結果がテスト回答 false による差し戻し');
  must(r.final.budget_flag === true && r.final.total_yen >= runs.rules.budget_review_from_yen, '高額の申請の budget_flag');

  return {
    version: runs.framework.version, jobCount: runs.jobs.length, threshold: runs.rules.budget_review_from_yen, noLLM,
    resultsPath: materials.results.path, memoPath: materials.memo.path, inputsPath: materials.inputs.path,
    a: {
      label: a.label, input: a.input,
      items: a.input.items.map(i => `${names[i.sku]} ×${i.quantity}`).join('　'),
      route: aRoute, stop: aStop.stop, stopNode: aStop.next[0], stopNext: JSON.stringify(aStop.next),
      interrupts: a.pause.interrupts.length, lines, total: aState.total_yen, payloadTotal: payload.total_yen,
      answer: a.test_resume, status: a.final.status, afterNext: JSON.stringify(a.after_resume.next),
    },
    m: {label: m.label, route: mRoute, field, interrupts: m.checks.interrupt_count, status: m.final.status},
    r: {label: r.label, route: rRoute, stop: rStop.stop, total: r.final.total_yen, flag: r.final.budget_flag, answer: r.test_resume, status: r.final.status},
  };
}

async function load() {
  const materials = json(await bytes('outputs/movie-materials.json'));
  if (materials.fictional !== true || materials.audio !== 'silent' || materials.human_approval !== false) {
    throw new Error('素材一覧が、架空の入力・無音・人の承認なしの動画用ではありません。');
  }
  const shot = (materials.screenshots || []).find(s => s.path === SHOT);
  if (!shot) throw new Error(`素材一覧に ${SHOT} がありません。`);
  for (const k of ['inputs', 'results', 'memo']) {
    if (!materials[k] || !materials[k].path || !materials[k].sha256) throw new Error(`素材一覧に ${k} がありません。`);
  }
  const fontLoads = [`600 52px ${SERIF}`, `700 36px ${SANS}`, `400 24px ${SANS}`, `700 20px ${SANS}`, `700 34px ${MONO}`, `400 20px ${MONO}`]
    .map(f => document.fonts.load(f, '機材の貸出を途中で確かめる確認待ち review 8,000円'));
  const [runs, requests] = await Promise.all([
    verified(materials.results.path, materials.results.sha256).then(json),
    verified(materials.inputs.path, materials.inputs.sha256).then(json),
    // 結果メモは映像に描かないが、持ち帰るファイルとして示すため実在と一致を確かめる
    verified(materials.memo.path, materials.memo.sha256),
  ]);
  // workflow.py は素材一覧にハッシュがないため、実在と、映像で触れる呼び出しが書かれていることだけ確かめる
  const source = new TextDecoder('utf-8').decode(await bytes('workflow.py'));
  for (const call of ['interrupt(payload', 'Command(resume=', 'checkpointer=InMemorySaver()']) {
    if (!source.includes(call)) throw new Error(`workflow.py に ${call} が見つかりません。`);
  }
  const buf = await verified(shot.path, shot.sha256);
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([buf], {type: 'image/png'}));
  try { await img.decode(); }
  catch { throw new Error(`${shot.path} を画像として読めませんでした。`); }
  if (img.naturalWidth !== shot.width || img.naturalHeight !== shot.height) throw new Error(`${shot.path} の寸法が素材一覧と一致しません。`);
  IMG.pause = img;
  await Promise.all(fontLoads);
  await document.fonts.ready;
  D = select(runs, requests, materials);
}

// ---------- 描画の部品 ----------

function font(weight, size, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }

function layer(a, dy, fn) {
  if (a <= 0.001) return;
  ctx.save(); ctx.globalAlpha *= a; if (dy) ctx.translate(0, dy); fn(); ctx.restore();
}

function clipRect(r, fn) { ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); fn(); ctx.restore(); }

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// 1行の文字。幅を超えるときは min まで縮める（それ以下にはしない）。
function text(str, x, y, {weight = 400, size = 24, family = SANS, color = C.ink, align = 'left', base = 'alphabetic', max = Infinity, min = size} = {}) {
  let s = size; font(weight, s, family);
  while (s > min && ctx.measureText(str).width > max) font(weight, --s, family);
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}

function tag(str, x, cy, {bg = C.sheet, fg = C.ink, border = C.ink, size = 20, weight = 700, align = 'left', dash = null} = {}) {
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

// 日本語の禁則を簡単に守る折り返し
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
  const lines = wrap(str, max);
  lines.forEach((ln, k) => { ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(ln, x, y + k * lh); });
  return y + lines.length * lh;
}

const heading = str => text(str, M, 160, {weight: 600, size: 52, family: SERIF, max: CW, min: 44});
const caption = str => text(str, M, 598, {size: 24, max: CW, min: 24});

// 紙の一枚（作例ビューアの欄と同じ、上端の太い罫）
function panel(r, accent = C.ink) {
  ctx.fillStyle = C.card; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = accent; ctx.fillRect(r.x, r.y, r.w, 3);
}

function arrow(x, cy) { text('→', x + 20, cy, {size: 24, color: C.soft, align: 'center', base: 'middle'}); }

// 縦の矢印（下から上へ伸びる）
function upArrow(x, y0, y1, p, color) {
  if (p <= 0) return;
  const y = lerp(y0, y1, p);
  ctx.fillStyle = color; ctx.fillRect(x - 1.5, y, 3, y0 - y);
  if (p >= 0.98) { ctx.beginPath(); ctx.moveTo(x, y1 - 2); ctx.lineTo(x - 8, y1 + 10); ctx.lineTo(x + 8, y1 + 10); ctx.closePath(); ctx.fill(); }
}

// 経路の札。reach：到達（破線→実線）、pause：停止（琥珀）、resume：再開（琥珀の帯だけ残す）
function chip(r, node, {reach = 0, pause = 0, resume = 0, small = false} = {}) {
  const label = NODE_LABELS[node] || node, code = node === '__end__' ? '' : node;
  const ls = small ? 26 : 28, cx = r.x + r.w / 2;
  const ly = code ? r.y + (small ? 32 : 42) : r.y + r.h / 2 + ls * 0.36, cy = r.y + (small ? 58 : 72);
  const face = (fill, stroke, lw, fg, codeFg, dash) => {
    ctx.save(); rr(r.x, r.y, r.w, r.h, 6);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); ctx.restore();
    text(label, cx, ly, {weight: 700, size: ls, color: fg, align: 'center'});
    if (code) text(code, cx, cy, {size: 20, family: MONO, color: codeFg, align: 'center'});
  };
  layer(1 - reach, 0, () => face(null, C.rule, 1.5, C.soft, C.soft, [6, 5]));
  layer(reach, 0, () => face(C.card, C.ink, 1.5, C.ink, C.soft));
  layer(reach * pause * (1 - resume), 0, () => face(C.amberWash, C.amber, 3, C.ink, C.amber));
  layer(reach * pause * resume, 0, () => { ctx.fillStyle = C.amber; ctx.fillRect(r.x + 1.5, r.y + 6, 6, r.h - 12); });
}

function stopBadge(r, pause, resume) {
  layer(pause * (1 - resume), 0, () => tag('ここで停止', r.x + r.w - 10, r.y, {align: 'right', bg: C.amber, fg: C.white, border: C.amber}));
  layer(pause * resume, 0, () => tag('停止→再開', r.x + r.w - 10, r.y, {align: 'right', bg: C.amberWash, fg: C.amber, border: C.amber}));
}

// 申請の札（経路の上を進む）
function tokenFace(r, green = 0) {
  rr(r.x, r.y, r.w, r.h, 4); ctx.fillStyle = C.ink; ctx.fill();
  layer(green, 0, () => { rr(r.x, r.y, r.w, r.h, 4); ctx.fillStyle = C.green; ctx.fill(); });
  text(D.a.input.event, r.x + r.w / 2, r.y + r.h / 2 + 1, {weight: 700, size: 20, color: C.paper, align: 'center', base: 'middle', max: r.w - 20, min: 12});
}

// 実画面の切り抜き。元画像の座標→表示先の座標の対応を返す。
function mapper(src, d) {
  const k = d.w / src.w;
  return {k, h: src.h * k, at: (sx, sy) => [d.x + (sx - src.x) * k, d.y + (sy - src.y) * k]};
}
function crop(img, src, d) {
  const m = mapper(src, d);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, src.x, src.y, src.w, src.h, d.x, d.y, d.w, m.h);
  ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, m.h - 1);
  return m;
}

function num(n, cx, cy) {
  ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill();
  text(String(n), cx, cy + 1, {weight: 700, size: 20, color: C.paper, align: 'center', base: 'middle'});
}

// ---------- 常に表示する枠 ----------

const sceneAt = t => { let k = 0; SCENES.forEach((s, i) => { if (t >= s.start) k = i; }); return k; };

function topBar(t) {
  const cur = sceneAt(t), cy = 80, items = [];
  let x = M;
  SCENES.forEach((s, k) => {
    const label = `${k + 1} ${s.step}`;
    font(700, 20); const w = ctx.measureText(label).width; // 太字の幅で並べ、場面が変わっても位置を動かさない
    font(k === cur ? 700 : 400, 20);
    ctx.fillStyle = k === cur ? C.ink : C.soft; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, cy);
    items.push({x, w}); x += w;
    if (k < SCENES.length - 1) { font(400, 20); ctx.fillStyle = C.soft; ctx.fillText('→', x + 10, cy); x += 44; }
  });
  const p = cur ? out3(prog(t, SCENES[cur].start, SCENES[cur].start + 0.45)) : 1;
  const a = items[Math.max(0, cur - 1)], b = items[cur];
  ctx.fillStyle = C.ink; ctx.fillRect(lerp(a.x, b.x, p), cy + 16, lerp(a.w, b.w, p), 2);
  // 範囲の札は1つだけ。最後の場面で尺と無音の表記に替える。
  const swap = prog(t, 22.0, 22.4);
  layer(1 - swap, 0, () => tag('架空入力・保存済みの実行結果', RX, cy, {align: 'right'}));
  layer(swap, 0, () => tag('28秒・無音 ／ 架空入力・テスト回答', RX, cy, {align: 'right'}));
}

function sourceLabel(t) {
  if (t < 4) return `素材：${D.resultsPath}（${D.a.label}の input。${D.inputsPath} と一致）`;
  if (t < 10) return `素材：${D.resultsPath}（${D.a.label}の checkpoints・pause）`;
  if (t < 16) return `素材：${D.resultsPath}（${D.a.label}の test_resume・after_resume・final）`;
  if (t < 22) return `素材：${D.resultsPath}（${D.m.label}・${D.r.label}）`;
  return `画面：保存結果ビューアの実際のスクリーンショット（${SHOT}）`;
}

function footer(t) {
  ctx.fillStyle = C.rule; ctx.fillRect(M, 618, CW, 1);
  text(sourceLabel(t), M, 650, {size: 20, color: C.soft, max: CW - 230, min: 20});
  text('Studio Yebisu 作例', RX, 650, {size: 20, color: C.soft, align: 'right'});
}

// ---------- 1. 渡す（0–4秒） ----------

function requestCard(r, a) {
  ctx.fillStyle = C.sheet; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = C.ink; ctx.fillRect(r.x, r.y, r.w, 3);
  layer(a, 0, () => {
    const inp = D.a.input;
    text('申請（入力）', r.x + 28, r.y + 48, {weight: 700, size: 24});
    text(D.inputsPath, r.x + r.w - 28, r.y + 48, {size: 20, family: MONO, color: C.soft, align: 'right'});
    ctx.fillStyle = C.rule; ctx.fillRect(r.x + 28, r.y + 70, r.w - 56, 1);
    [['申請者', inp.applicant], ['催し', inp.event], ['日程', `${inp.start_date} 〜 ${inp.end_date}`]].forEach(([k, v], i) => {
      const y = r.y + 122 + i * 56;
      text(k, r.x + 28, y, {size: 20, color: C.soft});
      text(v, r.x + 140, y, {size: 30, max: r.w - 168, min: 24});
    });
    text('品目', r.x + 28, r.y + 296, {size: 20, color: C.soft});
    text(D.a.items, r.x + 140, r.y + 298, {weight: 700, size: 36, max: r.w - 168, min: 28});
  });
}

function scenePass(t) {
  const out = leave(t, 4.0, 0.3);
  let e = enter(t, 0.15, 0.5);
  layer(e.a * out, e.dy, () => heading('機材の貸出を、途中で確かめる'));
  const x = 760, w = RX - x;
  e = enter(t, 1.3);
  layer(e.a * out, e.dy, () => {
    ctx.fillStyle = C.ink; ctx.fillRect(716, 373, 24, 2);
    ctx.beginPath(); ctx.moveTo(746, 374); ctx.lineTo(736, 366); ctx.lineTo(736, 382); ctx.closePath(); ctx.fill();
    text('渡す先', x, 262, {size: 20, color: C.soft});
    text('workflow.py の StateGraph', x, 306, {weight: 700, size: 32, max: w, min: 26});
  });
  e = enter(t, 1.6);
  layer(e.a * out, e.dy, () => paragraph(D.noLLM, x, 362, w, 38, {size: 24}));
  e = enter(t, 1.9);
  layer(e.a * out, e.dy, () => {
    text(`LangGraph ${D.version}（Python のライブラリ）`, x, 470, {size: 22, color: C.soft, max: w, min: 20});
    text(`架空の申請${D.jobCount}件を実行し、結果を保存`, x, 506, {size: 22, color: C.soft, max: w, min: 20});
  });
}

// ---------- 申請の札と経路（0.7–16秒、同じ札が進む） ----------

// 札の位置（経路上の番号）。停止前は5.4–7.0秒、再開後は12.1–13.2秒に1つずつ進む。
function tokenPos(t) {
  const p = D.a.stop, post = D.a.route.length - 1 - p;
  let pos = 0;
  for (let k = 0; k < p; k++) { const s = 5.4 + k * (1.6 / p); pos += inOut(prog(t, s, s + Math.min(0.5, 1.6 / p))); }
  for (let k = 0; k < post; k++) { const s = 12.1 + k * (1.1 / post); pos += inOut(prog(t, s, s + Math.min(0.5, 1.1 / post))); }
  return pos;
}

function requestFlow(t) {
  const fade = leave(t, 15.6, 0.4);
  if (t < 4.7) {
    // 申請の紙が、経路の先頭の札へ縮む
    const e = enter(t, 0.7, 0.5);
    const r = lerpRect(CARD, tokenRect(0), inOut(prog(t, 4.0, 4.7)));
    const face = prog(t, 4.3, 4.6);
    layer(e.a * (1 - face), e.dy, () => clipRect(r, () => requestCard(r, 1 - prog(t, 4.0, 4.2))));
    layer(face, 0, () => tokenFace(r));
  }
  if (t >= 4.4) {
    const pos = tokenPos(t), resume = prog(t, 11.9, 12.2);
    D.a.route.forEach((node, i) => {
      const e = enter(t, 4.4 + i * 0.08, 0.4);
      layer(e.a * fade, e.dy, () => {
        const r = chipRect(i), reach = clamp(pos - i + 1), isStop = i === D.a.stop;
        chip(r, node, {reach, pause: isStop ? reach : 0, resume: isStop ? resume : 0});
        if (i < D.a.route.length - 1) arrow(r.x + r.w, r.y + r.h / 2);
        if (isStop) stopBadge(r, reach, resume);
      });
    });
  }
  if (t >= 4.7) layer(fade, 0, () => tokenFace(tokenRect(tokenPos(t)), prog(t, 13.15, 13.35)));
}

// ---------- 2. 止める（4–10秒） ----------

function estimatePanel(r) {
  panel(r);
  text('estimate ノードの見積', r.x + 24, r.y + 34, {size: 20, color: C.soft});
  D.a.lines.forEach((li, k) => {
    const y = r.y + 72 + k * 34;
    text(`${li.name}　${li.quantity} × ${yen(li.unit_yen)}`, r.x + 24, y, {size: 24});
    text(yen(li.subtotal_yen), r.x + r.w - 24, y, {size: 24, align: 'right'});
  });
  ctx.fillStyle = C.rule; ctx.fillRect(r.x + 24, r.y + 120, r.w - 48, 1);
  text('合計', r.x + 24, r.y + 154, {weight: 700, size: 24});
  text(yen(D.a.total), r.x + r.w - 24, r.y + 156, {weight: 700, size: 36, align: 'right'});
}

function scenePause(t) {
  const out = leave(t, 9.6, 0.4);
  let e = enter(t, 4.3, 0.5);
  layer(e.a * out, e.dy, () => heading('確認待ちで止める'));
  e = enter(t, 6.0);
  layer(e.a * out, e.dy, () => estimatePanel(P_EST));
  e = enter(t, 7.4);
  layer(e.a * out, e.dy, () => caption(`完全な申請は、金額にかかわらず ${D.a.stopNode} で止まる`));
}

// 止まった時点の get_state：大きな欄（6.9秒〜）→ 左の小さな欄（9.7–10.3秒）→ 再開後の next（12.0秒〜）
function statePanel(t) {
  const e = enter(t, 6.9), fade = leave(t, 15.6, 0.4);
  const r = lerpRect(P_STATE, P_STATE2, inOut(prog(t, 9.7, 10.3)));
  const after = prog(t, 12.0, 12.3);
  layer(e.a * fade, e.dy, () => {
    panel(r, C.amber);
    layer(after, 0, () => { ctx.fillStyle = C.ink; ctx.fillRect(r.x, r.y, r.w, 3); });
    clipRect(r, () => {
      layer(1 - prog(t, 9.6, 9.8), 0, () => {
        text('止まった時点の get_state', r.x + 24, r.y + 34, {size: 20, color: C.soft});
        text(`next: ${D.a.stopNext}`, r.x + 24, r.y + 96, {weight: 700, size: 36, family: MONO, color: C.amber});
        text(`interrupt ${D.a.interrupts}件（${D.a.stopNode} ノード）`, r.x + 24, r.y + 144, {size: 24});
      });
      layer(prog(t, 10.2, 10.45), 0, () => {
        text('get_state の next', r.x + 20, r.y + 34, {size: 20, color: C.soft});
        layer(1 - after, 0, () => {
          text(D.a.stopNext, r.x + 20, r.y + 94, {weight: 700, size: 32, family: MONO, color: C.amber});
          text('停止中', r.x + 20, r.y + 140, {size: 24, color: C.amber});
        });
        layer(after, 0, () => {
          text(D.a.afterNext, r.x + 20, r.y + 94, {weight: 700, size: 32, family: MONO});
          text('再開後・終了', r.x + 20, r.y + 140, {size: 24});
        });
      });
    });
  });
}

// ---------- 3. 再開する（10–16秒） ----------

function answerCard(r) {
  panel(r);
  const tw = tag('テスト回答', r.x + 20, r.y + 34, {bg: C.ink, fg: C.paper, border: C.ink});
  text(`test_resume（${D.inputsPath.split('/').pop()}）`, r.x + 20 + tw + 12, r.y + 35, {size: 20, color: C.soft, base: 'middle', max: r.w - tw - 52, min: 20});
  const kw = text('approved: ', r.x + 20, r.y + 96, {size: 34, family: MONO});
  text(String(D.a.answer.approved), r.x + 20 + kw, r.y + 96, {weight: 700, size: 34, family: MONO, color: C.green});
  text(D.a.answer.comment, r.x + 20, r.y + 144, {size: 22, max: r.w - 40, min: 20});
}

function finalPanel(r) {
  panel(r, C.green);
  text('最終状態（status）', r.x + 20, r.y + 34, {size: 20, color: C.soft});
  text(D.a.status, r.x + 20, r.y + 92, {weight: 700, size: 34, family: MONO, color: C.green});
  text(`${STATUS[D.a.status] || D.a.status} ／ ${yen(D.a.total)}`, r.x + 20, r.y + 142, {weight: 700, size: 28, max: r.w - 40, min: 22});
}

function sceneResume(t) {
  const out = leave(t, 15.6, 0.4);
  let e = enter(t, 10.1, 0.5);
  layer(e.a * out, e.dy, () => heading('回答を渡して、続きを動かす'));
  const stop = chipRect(D.a.stop), cx = stop.x + stop.w / 2;
  const card = {...P_ANSWER, x: cx - P_ANSWER.w / 2};
  e = enter(t, 10.5);
  layer(e.a * out, e.dy, () => answerCard(card));
  layer(out, 0, () => {
    upArrow(cx, card.y, stop.y + stop.h + 4, inOut(prog(t, 11.3, 11.8)), C.ink);
    layer(prog(t, 11.5, 11.8), 0, () => text('Command(resume=…)', cx + 14, 372, {size: 20, family: MONO, color: C.soft}));
  });
  e = enter(t, 13.0);
  layer(e.a * out, e.dy, () => finalPanel(P_FINAL));
  e = enter(t, 12.4);
  layer(e.a * out, e.dy, () => caption('同じ thread を、同じ Python プロセス内で再開（InMemorySaver）'));
}

// ---------- 4. 分ける（16–22秒） ----------

function rowChips(t, route, y, t0, stop = -1) {
  route.forEach((node, i) => {
    const e = enter(t, t0 + i * 0.12, 0.4);
    layer(e.a, e.dy, () => {
      const r = {x: col(i), y, w: CHIP_W, h: 70};
      chip(r, node, {reach: 1, pause: i === stop ? 1 : 0, small: true});
      if (i < route.length - 1) arrow(r.x + r.w, y + 35);
    });
  });
}

function sceneBranch(t) {
  const out = leave(t, 21.6, 0.4), {m, r} = D;
  layer(out, 0, () => {
    let e = enter(t, 16.1, 0.5);
    layer(e.a, e.dy, () => heading('入力不足は戻す。確認の回答で分ける。'));

    // 返却日のない申請：止まらずに needs_input
    e = enter(t, 16.4);
    layer(e.a, e.dy, () => {
      const w = text(m.label, M, 226, {weight: 700, size: 26});
      const fw = text(`${m.field}：`, M + w + 20, 226, {size: 22, family: MONO, color: C.soft});
      text('（空）', M + w + 20 + fw, 226, {weight: 700, size: 22, color: C.red});
    });
    layer(enter(t, 17.2).a, 0, () => tag(`${m.status}（${STATUS[m.status] || m.status}）`, RX, 216, {align: 'right', bg: C.paper, border: C.ink, dash: [5, 4]}));
    rowChips(t, m.route, 244, 16.5);
    e = enter(t, 17.0);
    layer(e.a, e.dy, () => text(`interrupt ${m.interrupts}件・止まらずに終了`, col(m.route.length), 288, {size: 24, max: RX - col(m.route.length), min: 22}));

    // 高額の申請：停止 → テスト回答 false → rejected
    e = enter(t, 17.6);
    layer(e.a, e.dy, () => {
      const w = text(r.label, M, 380, {weight: 700, size: 26});
      text(`見積 ${yen(r.total)}・budget_flag: ${r.flag}`, M + w + 20, 380, {size: 22, color: C.soft});
    });
    rowChips(t, r.route, 398, 17.7, r.stop);
    e = enter(t, 18.5);
    layer(e.a, e.dy, () => {
      const cx = col(r.stop) + CHIP_W / 2;
      ctx.fillStyle = C.red; ctx.fillRect(cx - 1, 470, 2, 19);
      tag(`テスト回答 approved: ${r.answer.approved}`, cx, 506, {align: 'center', bg: C.redWash, fg: C.red, border: C.red});
    });
    layer(enter(t, 18.8).a, 0, () => tag(`${r.status}（${STATUS[r.status] || r.status}）`, RX, 370, {align: 'right', bg: C.redWash, fg: C.red, border: C.red}));
    e = enter(t, 19.2);
    layer(e.a, e.dy, () => caption(`差し戻しはテスト回答 ${r.answer.approved} による。${yen(D.threshold)}以上は目印（budget_flag）を付けるだけ`));
  });
}

// ---------- 5. 確かめる・持ち帰る（22–28秒） ----------

function ring(map, rg) {
  const [x0, y0] = map.at(rg.box[0], rg.box[1]), [x1, y1] = map.at(rg.box[2], rg.box[3]);
  rr(x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10, 6);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
  num(rg.n, x1 + 5, y0 - 5);
}

function sceneInspect(t) {
  let e = enter(t, 22.0, 0.5);
  layer(e.a, e.dy, () => heading('入力・停止・再開を、あとから確かめる'));

  // 実際の画面（通常の申請の「通った経路」と「確認待ちで止まる」）
  const d = {x: M, y: 194, w: 552};
  const map = mapper(DESK, d);
  layer(out3(prog(t, 22.2, 22.6)), 0, () => crop(IMG.pause, DESK, d));
  for (const rg of RINGS) layer(out3(prog(t, rg.t0, rg.t0 + 0.3)), 0, () => ring(map, rg));

  // 画面と同じ値を、保存データから組版する
  const fx = 664, fw = RX - fx;
  e = enter(t, 22.8);
  layer(e.a, e.dy, () => text(`画面の値（${D.resultsPath} と同じ）`, fx, 222, {size: 20, color: C.soft, max: fw, min: 20}));
  e = enter(t, 23.0);
  layer(e.a, e.dy, () => {
    num(1, fx + 15, 262);
    text('止まった位置（next）', fx + 44, 270, {size: 22, color: C.soft});
    text(D.a.stopNode, RX, 272, {weight: 700, size: 32, family: MONO, color: C.amber, align: 'right'});
  });
  e = enter(t, 23.3);
  layer(e.a, e.dy, () => {
    num(2, fx + 15, 318);
    text('見積合計（interrupt の payload）', fx + 44, 326, {size: 22, color: C.soft, max: fw - 200, min: 20});
    text(yen(D.a.payloadTotal), RX, 328, {weight: 700, size: 32, align: 'right'});
  });
  e = enter(t, 23.8);
  layer(e.a, e.dy, () => {
    ctx.fillStyle = C.rule; ctx.fillRect(fx, 356, fw, 1);
    text('持ち帰るファイル（作例フォルダに保存済み）', fx, 392, {size: 20, color: C.soft, max: fw, min: 20});
  });
  [
    {name: D.resultsPath, label: `${D.jobCount}件の入力・停止時と再開後の状態・チェックポイント`},
    {name: D.memoPath, label: `${D.jobCount}件の経路と結果の日本語メモ`},
    {name: 'python workflow.py', label: `同じ${D.jobCount}件を手元で作り直すときのコマンド`},
  ].forEach((f, k) => {
    const le = enter(t, 24.0 + k * 0.2, 0.45), y = 436 + k * 64;
    layer(le.a, le.dy, () => {
      text(f.name, fx, y, {weight: 700, size: 26, family: MONO, max: fw, min: 22});
      text(f.label, fx, y + 28, {size: 20, color: C.soft, max: fw, min: 20});
    });
  });
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
  if (t < 4.3) scenePass(t);
  if (t >= 0.7 && t < 16) requestFlow(t);
  if (t >= 4 && t < 10) scenePause(t);
  if (t >= 6.9 && t < 16) statePanel(t);
  if (t >= 10 && t < 16) sceneResume(t);
  if (t >= 16 && t < 22) sceneBranch(t);
  if (t >= 22) sceneInspect(t);
}

function drawError(message) {
  resetCanvas();
  ctx.fillStyle = C.red; ctx.fillRect(M, 280, 6, 150);
  text('素材を読み込めなかったため、動画を描画していません', M + 28, 320, {weight: 700, size: 34, color: C.red, max: CW - 28, min: 24});
  paragraph(message, M + 28, 372, CW - 40, 34, {size: 22});
}

function describe() {
  const a = D.a, route = a.route.map(n => NODE_LABELS[n] || n).join('→');
  return `LangGraphの作例を説明する28秒・無音の編集動画。架空の申請「${a.input.event}」（${a.items.replaceAll('　', '、')}）が${route}の順に進み、`
    + `${a.stopNode}（確認待ち）で止まる。見積合計は${yen(a.total)}。テスト回答 approved: ${a.answer.approved} を渡して再開し、${a.status}（${STATUS[a.status]}）で終わる。`
    + `${D.m.label}は止まらずに${D.m.status}、${D.r.label}（${yen(D.r.total)}）はテスト回答 approved: ${D.r.answer.approved} で${D.r.status}になる。`
    + `最後に保存結果ビューアの実際の画面と、持ち帰るファイル ${D.resultsPath}・${D.memoPath} を示す。`;
}

const $ = id => document.getElementById(id);
const ui = {play: $('play'), scrub: $('scrub'), time: $('time'), status: $('status')};
let current = 0, playing = false, raf = 0, baseT = 0, baseWall = 0;

window.seek = seconds => {
  const t = clamp(Number(seconds) || 0, 0, DURATION);
  if (!ready) return window.motionReady.then(() => window.seek(t));
  current = t;
  draw(t);
  if (ui.scrub) { ui.scrub.value = t.toFixed(1); ui.scrub.setAttribute('aria-valuetext', `${t.toFixed(1)}秒`); }
  if (ui.time) ui.time.textContent = `${t.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
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
  if (!on) return;
  if (current >= DURATION - 0.01) window.seek(0);
  baseT = current; baseWall = performance.now();
  raf = requestAnimationFrame(tick);
}

function setupUi() {
  canvas.setAttribute('aria-label', describe());
  if (!ui.play || !ui.scrub) return;
  ui.play.disabled = false;
  ui.scrub.disabled = false;
  if (ui.status) ui.status.textContent = '準備完了：28秒・無音の編集動画です。保存済みの実行結果と実際の画面から描画しています。';
  if (RENDER) return;
  ui.play.addEventListener('click', () => setPlaying(!playing));
  ui.scrub.addEventListener('input', () => {
    window.seek(Number(ui.scrub.value));
    if (playing) { baseT = current; baseWall = performance.now(); }
  });
}

window.motionReady = load().then(() => {
  ready = true;
  window.seek(RENDER ? 0 : POSTER);
  setupUi();
});

window.motionReady.catch(err => {
  const message = err && err.message ? err.message : String(err);
  drawError(message);
  if (ui.play) ui.play.disabled = true;
  if (ui.scrub) ui.scrub.disabled = true;
  if (ui.status) { ui.status.textContent = `エラー：${message} 再生できません。`; ui.status.classList.add('error'); }
});
