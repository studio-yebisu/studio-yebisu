/* Design Taste 作例「AIが画面を作る前に読む、デザインの指針」— 32秒・無音の図解動画（編集できる元ページ）
 * 作例ページと同じ照合（23件の大きさ・SHA-256と中身の対応、照合した events.mjs の filterEvents の3つの結果）を
 * 読み込み時に1回だけ行い、同じ概念図を時刻 t の完成した画面として毎回最初から描く。フレームごとの取得や通信はしない。
 * 5冊・依頼・紙・6件の行は、最初から最後まで同じ形のまま動く。選ぶ行（子ども→e01・e04、短編→e02）は関数の結果から読む。
 * 映像の中の動きは流れの説明で、元の制作の時間や内部の記録ではない。
 * 音は一切使わない（audioEvents は空、音声要素も音の読み込みもない）。AIもNodeもここでは動かない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

import {loadValidatedAssets, conceptLayout, drawConcept, restParams, drawText, PALETTES, FONT, ASSET_COUNT, ALL_EDGES, NODE_KEYS,
  STAGE_LABELS, AssetError, easeOut, ease, prog, steps, REPO, SOURCE_COMMIT} from '../concept.js';

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 32;
const POSTER_TIME = 31;
const SIZES = {portrait: {width: 720, height: 1280}, wide: {width: 1280, height: 720}};
const ORIENT_LABEL = {portrait: '縦', wide: '横'};
const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
const evenSize = (v) => Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0;
const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
const hasSize = evenSize(given.width) && evenSize(given.height);
let orient = hasSize && given.width > given.height ? 'wide' : 'portrait';
let W = hasSize ? given.width : SIZES[orient].width;
let H = hasSize ? given.height : SIZES[orient].height;
window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: []};

const PAL = PALETTES.light;
const root = document.documentElement;
if (RENDER || /[?&]render(=|&|$)/.test(location.search)) root.classList.add('is-render');
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

// 縦と横で配置を作り直す（同じ時刻表・同じ図。縦は縦長の図、横は横長の図の配置）
const COMPOSE = {
  portrait: {LW: 720, LH: 1280, kind: 'tall', rail: {x: 36, y: 28, h: 46, size: 20, align: 'left'}, title: {x: 36, y: 126, size: 36, max: 648},
    sub: {x: 36, y: 170, size: 20, max: 648}, world: {x: 16, y: 200, w: 688, h: 1028}, foot: {x: 36, y: 1254, size: 15, max: 648}},
  wide: {LW: 1280, LH: 720, kind: 'wide', rail: {x: 1244, y: 22, h: 38, size: 17, align: 'right'}, title: {x: 36, y: 44, size: 30, max: 760},
    sub: {x: 36, y: 84, size: 18, max: 1200}, world: {x: 18, y: 106, w: 1244, h: 588}, foot: {x: 36, y: 708, size: 14, max: 1200}},
};
const layouts = {};
const layoutFor = (o) => (layouts[o] ||= conceptLayout(COMPOSE[o].kind, COMPOSE[o].world.w, COMPOSE[o].world.h));

// 7場面。最後の動きは28.9秒で終え、29〜32秒は完全に静止させる。件数とIDは照合した関数の結果から読む。
const ids = (j) => j.ids.join('・');
const SCENES = [
  {start: 0, rail: -1, title: () => '画面を作る前に、方針をそろえる', sub: () => 'Design Taste：AIが読むMarkdownの指針（UI生成APIではない）'},
  {start: 4, rail: 0, title: () => '5冊と依頼を、同じ1つのAIへ', sub: (d) => `誰に・何を・催し${d.rows.length}件。5つのAIではない`},
  {start: 8, rail: 1, title: () => 'AIがまず「方針一行」と計画を書く', sub: () => '灰の文字→濃い灰、10–11px→14px（計画の上の調整）'},
  {start: 14, rail: 1, title: () => '計画を使う次の執筆で、HTML/CSS/JSへ', sub: (d) => `AIが執筆 / 制作担当が実行（Node ${d.counts.original_Node_checks}条件・実画面）`},
  {start: 20, rail: 2, title: () => '同じ6件の行から、実際の関数が選ぶ',
    sub: (d) => `${d.audience.children}→${d.jobs.children.count}件（${ids(d.jobs.children)}）・「${d.jobs.reading.input.query}」→${d.jobs.reading.count}件（${ids(d.jobs.reading)}）`},
  {start: 26, rail: 2, title: () => '使える一覧と、保存した実結果', sub: (d) => `${d.jobs.reading.desk} で開く・${d.jobs.reading.path}`},
  {start: 29, rail: 3, title: () => '本 → 方針 → コード → 使う', sub: () => 'Design Taste：画面を作る前に、方針をそろえる'},
];
const RANGES = ['0〜4', '4〜8', '8〜14', '14〜20', '20〜26', '26〜29', '29〜32'];
const sceneIndex = (t) => { for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i; return 0; };
// 見出しと段階の印は場面の0.5秒前から0.1秒前までに入れ替え、29秒からは何も動かさない
const LEAD = 0.5;
const titleIndex = (t) => sceneIndex(t + LEAD);
const lerp = (a, b, k) => a + (b - a) * k;
function railWeights(t) {
  const on = (s) => [0, 1, 2].map((j) => (s.rail === 3 || s.rail === j ? 1 : 0));
  const i = titleIndex(t), cur = on(SCENES[i]);
  if (i === 0) return cur;
  const k = easeOut(prog(t, SCENES[i].start - LEAD, SCENES[i].start - 0.1)), prev = on(SCENES[i - 1]);
  return cur.map((v, j) => lerp(prev[j], v, k));
}

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
function filmParams(t) {
  const p = restParams();
  const S = p.show, D = p.draw, F = p.flow, E = p.emph, G = p.emphEdge;
  for (const k of NODE_KEYS) S[k] = 0;
  for (const k of ALL_EDGES) { D[k] = 0; F[k] = 0; }

  // 0〜4：並んだ5冊が現れ、3つの群に分かれ、表現の本が開く
  S.books = easeOut(prog(t, 0.2, 0.8));
  p.spread = prog(t, 1.0, 2.2);
  p.styleOpen = prog(t, 2.0, 3.0);

  // 4〜8：依頼の札（誰に・何を・催し6件に順に下線）と1つのAI。5冊と依頼の写しがAIへ合流
  S.request = easeOut(prog(t, 4.0, 4.4));
  S.ai = easeOut(prog(t, 4.3, 4.7));
  p.reqLine = 3 * prog(t, 4.5, 6.0);
  D.giveBooks = D.giveReq = prog(t, 4.6, 5.0);
  F.giveBooks = F.giveReq = prog(t, 5.6, 6.2);
  p.give = prog(t, 6.0, 7.6);

  // 8〜14：AIが方針一行の紙を書き、計画の上で色と文字の大きさを調整。同じ紙が同じAIへ戻る
  S.plan = easeOut(prog(t, 8.0, 8.4));
  D.write = prog(t, 8.2, 8.6);
  F.write = prog(t, 8.5, 9.0);
  p.plan = prog(t, 8.7, 10.6);
  p.adjust = prog(t, 10.9, 12.1);
  D.back = prog(t, 12.0, 12.3);
  F.back = prog(t, 12.2, 12.6);
  p.back = prog(t, 12.4, 13.5);

  // 14〜20：次の執筆でコードの紙。制作担当の確認を通り、「記録」の札で行の場所へ
  S.page = easeOut(prog(t, 14.0, 14.4));
  D.code = prog(t, 14.2, 14.6);
  F.code = prog(t, 14.5, 15.0);
  p.code = prog(t, 14.8, 16.4);
  S.operator = easeOut(prog(t, 16.2, 16.6));
  D.check = prog(t, 16.4, 16.8);
  F.check = prog(t, 16.8, 17.3);
  p.check = prog(t, 17.0, 19.4);
  S.rows = easeOut(prog(t, 18.4, 18.9));
  D.deliver = prog(t, 18.4, 18.8);
  F.deliver = prog(t, 18.6, 19.3);

  // 20〜26：同じ紙が6件の行に開き、関数の結果で「子ども」2件 → 「短編」1件。札は同じ色のまま結果の欄へ
  p.unfold = prog(t, 20.4, 21.9);
  S.tray = easeOut(prog(t, 21.6, 22.0));
  D.use = prog(t, 21.7, 22.1);
  F.use = prog(t, 22.0, 22.4);
  const SWAP = 23.85;
  const early = t < SWAP;
  p.picks = [{preset: 'children', w: prog(t, 22.2, 22.8) * (1 - prog(t, 23.6, 24.1))}, {preset: 'reading', w: prog(t, 23.6, 24.1)}];
  p.preset = early ? 'children' : 'reading';
  // 欄の中身は、薄くなりきった時刻（23.85秒）で入れ替える
  p.tray = {preset: p.preset, a: early ? 1 - prog(t, 23.55, SWAP) : prog(t, SWAP, 24.15)};
  p.chips = {preset: p.preset, k: early ? prog(t, 22.3, 23.0) : prog(t, 24.1, 24.8)};
  p.open = early ? prog(t, 22.9, 23.4) : prog(t, 24.8, 25.4);

  // 26〜29：使える出力（JSON・実UI）
  p.out = prog(t, 26.2, 27.4);

  // 29〜32：全体の流れを同じ濃さで静止（入りは28.3〜28.9秒）
  const whole = prog(t, 28.3, 28.9);
  for (const k of ALL_EDGES) F[k] = Math.max(F[k] || 0, whole);

  // 強調：いま動いている部分を濃く。下限0.7で、ほかの部分も読める濃さに保つ
  const lo = 0.7;
  E.books = steps(t, 1, [[14.0, lo], [28.3, 1]]);
  E.request = steps(t, 1, [[8.0, lo], [28.3, 1]]);
  E.ai = steps(t, 1, [[20.0, lo], [28.3, 1]]);
  E.plan = steps(t, 1, [[16.4, lo], [28.3, 1]]);
  E.page = E.operator = steps(t, 1, [[20.0, lo], [28.3, 1]]);
  G[0] = steps(t, 1, [[8.0, lo], [28.3, 1]]);
  G[1] = steps(t, 1, [[20.0, lo], [28.3, 1]]);
  G[2] = 1;
  const rw = railWeights(t), seen = [prog(t, 3.6, 4.2), prog(t, 7.8, 8.3), prog(t, 19.8, 20.3)];
  p.band = rw.map((w, i) => seen[i] * (0.6 + 0.4 * w));
  return p;
}

// ---- 画面の枠：段階の印・見出し・足元 ---------------------------------------
function drawRail(comp, t) {
  const w = railWeights(t);
  const {h, size} = comp.rail;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT.sans}`;
  const widths = STAGE_LABELS.map((l) => ctx.measureText(l).width + size * 1.6);
  const gap = 8;
  const total = widths.reduce((s, x) => s + x, 0) + gap * (STAGE_LABELS.length - 1);
  let x = comp.rail.align === 'right' ? comp.rail.x - total : comp.rail.x;
  STAGE_LABELS.forEach((label, i) => {
    const bw = widths[i], y = comp.rail.y;
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(x, y, bw, h);
    if (w[i] > 0.001) { ctx.globalAlpha = w[i]; ctx.fillStyle = PAL.ink; ctx.fillRect(x, y, bw, h); ctx.globalAlpha = 1; }
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x + 0.7, y + 0.7, bw - 1.4, h - 1.4);
    if (w[i] < 0.999) { ctx.globalAlpha = 1 - w[i]; drawText(ctx, label, x + bw / 2, y + h / 2, {size, weight: 700, color: PAL.ink, align: 'center'}); }
    if (w[i] > 0.001) { ctx.globalAlpha = w[i]; drawText(ctx, label, x + bw / 2, y + h / 2, {size, weight: 700, color: PAL.bg, align: 'center'}); }
    ctx.globalAlpha = 1;
    x += bw + gap;
  });
  ctx.restore();
}

function drawTitles(comp, t) {
  const i = titleIndex(t);
  const k = i === 0 ? 1 : easeOut(prog(t, SCENES[i].start - LEAD, SCENES[i].start - 0.1));
  const one = (scene, a, dy) => {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = a;
    drawText(ctx, scene.title(data), comp.title.x, comp.title.y + dy, {size: comp.title.size, weight: 600, family: FONT.mincho, color: PAL.ink, max: comp.title.max, min: 22});
    drawText(ctx, scene.sub(data), comp.sub.x, comp.sub.y + dy, {size: comp.sub.size, color: PAL.muted, max: comp.sub.max, min: 13});
    ctx.restore();
  };
  if (i > 0 && k < 1) one(SCENES[i - 1], 1 - k, -8 * k);
  one(SCENES[i], k, 8 * (1 - k));
}

function drawFoot(comp) {
  drawText(ctx, `${REPO} ${SOURCE_COMMIT.slice(0, 7)}・MIT　照合した記録と関数の結果から描画・無音`, comp.foot.x, comp.foot.y, {size: comp.foot.size, color: PAL.muted, max: comp.foot.max, min: 10});
}

// いま加わった形を大きく、合流するたびに連続して引く。拡大は1〜1.8倍。絶対時刻だけで決まる。
function diagramCamera(L, t) {
  const fit = (keys, free) => {
    const rects = keys.map((k) => L.n[k]);
    const pad = 16;
    const x = Math.min(...rects.map((r) => r.x)) - pad, y = Math.min(...rects.map((r) => r.y)) - pad;
    const width = Math.max(...rects.map((r) => r.x + r.w)) + pad - x;
    const height = Math.max(...rects.map((r) => r.y + r.h)) + pad - y;
    const z = Math.max(1, Math.min(L.W / width, L.H / height, 1.8));
    const cx = (L.W - width * z) / 2 - x * z, cy = (L.H - height * z) / 2 - y * z;
    // free：まだほかの形が無い最初の場面だけ、形を画面の中央へ寄せる
    if (free) return {z, x: cx, y: cy};
    return {z, x: Math.min(0, Math.max(L.W - L.W * z, cx)), y: Math.min(0, Math.max(L.H - L.H * z, cy))};
  };
  const poses = [
    fit(['books'], true),
    fit(['books', 'request', 'ai']),
    fit(['books', 'ai', 'plan']),
    fit(['ai', 'plan', 'page', 'operator']),
    fit(['operator', 'rows', 'tray']),
    fit(['rows', 'tray']),
    {z: 1, x: 0, y: 0},
  ];
  const transitions = [[3.3, 4.0], [7.6, 8.3], [13.6, 14.3], [19.6, 20.3], [25.6, 26.3], [28.2, 28.9]];
  const out = {...poses[0]};
  transitions.forEach(([a, b], i) => {
    const k = ease(prog(t, a, b));
    for (const key of ['z', 'x', 'y']) out[key] += (poses[i + 1][key] - poses[i][key]) * k;
  });
  return out;
}

function drawFrame(t) {
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setLineDash([]);
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, W, H);
  if (data) {
    const comp = COMPOSE[orient];
    const k = Math.min(W / comp.LW, H / comp.LH);
    ctx.setTransform(k, 0, 0, k, (W - comp.LW * k) / 2, (H - comp.LH * k) / 2);
    drawRail(comp, t);
    drawTitles(comp, t);
    ctx.save();
    ctx.translate(comp.world.x, comp.world.y);
    ctx.beginPath();
    ctx.rect(0, 0, comp.world.w, comp.world.h);
    ctx.clip();
    const L = layoutFor(orient), camera = diagramCamera(L, t);
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.z, camera.z);
    drawConcept(ctx, L, filmParams(t), data, PAL);
    ctx.restore();
    drawFoot(comp);
  }
  ctx.restore();
}

// ---- 準備と任意時刻の描画 ---------------------------------------------------
let data = null;
let current = 0;
let loadGen = 0;
let controller = null;

const $ = (id) => document.getElementById(id);
const statusEl = $('asset-status');
const retryBtn = $('retry');
const controls = () => document.querySelectorAll('#play, #reset, #replay, #end, #time, button[data-jump], button[data-orient]');
const dimsText = () => `${ORIENT_LABEL[orient] || ''} ${W}×${H}`.trim();
function setControls(on) {
  if (RENDER) return;
  // 書き出しの大きさが決まっているときは、向きの切り替えだけを止める
  controls().forEach((el) => { el.disabled = !on || (el.matches('button[data-orient]') && hasSize); });
}
function setStatus(text, state) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.state = state;
  statusEl.setAttribute('role', state === 'error' ? 'alert' : 'status');
}
const readyText = () => `素材${ASSET_COUNT}件を照合し、照合した events.mjs で3つの条件を計算しました（保存した結果と同じ）。いまの画面：${dimsText()}・${FPS}fps・${DURATION}秒・無音。`;

function prepare() {
  const gen = ++loadGen;
  controller?.abort();
  controller = new AbortController();
  data = null;
  pause();
  setControls(false);
  if (retryBtn) retryBtn.hidden = true;
  if (!RENDER) { const cap = $('film-caption'); if (cap) { cap.textContent = ''; delete cap.dataset.scene; } }
  setStatus(`素材 0/${ASSET_COUNT} を照合しています…`, 'loading');
  drawFrame(current);
  const ready = (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const bundle = await loadValidatedAssets({
      signal: controller.signal,
      onProgress: (phase, done, total) => {
        if (gen !== loadGen || statusEl?.dataset.state !== 'loading') return;
        setStatus(phase === 'assets' ? `素材 ${done}/${total} を照合しています…` : '照合した events.mjs で3つの条件を計算しています…', 'loading');
      },
    });
    if (gen !== loadGen) throw new DOMException('aborted', 'AbortError');
    data = bundle;
    setStatus(readyText(), 'ready');
    setControls(true);
    show(current);
  })();
  ready.catch((error) => {
    if (gen !== loadGen || error?.name === 'AbortError') return;
    data = null;
    pause();
    setControls(false);
    drawFrame(current);
    if (!RENDER) { const cap = $('film-caption'); if (cap) { cap.textContent = ''; delete cap.dataset.scene; } }
    setStatus(`${error instanceof AssetError ? error.message : '素材を読めませんでした'}。描画を止めました。ローカルのHTTPサーバー経由で開き直してください。`, 'error');
    if (retryBtn) retryBtn.hidden = false;
  });
  window.motionReady = ready;
  return ready;
}

const clampT = (s) => Math.max(0, Math.min(DURATION, Number(s) || 0));
window.seek = async (seconds) => {
  await window.motionReady;
  const frame = Math.min(Math.round(clampT(seconds) * FPS), Math.round(DURATION * FPS));
  const t = frame / FPS;
  current = t;
  drawFrame(t);
  if (!RENDER) syncUi(t);
  return {time: t, frame};
};

// ---- プレビュー（書き出し時は使わない） -------------------------------------
let playing = false, raf = 0, startAt = 0;
function syncUi(t) {
  const range = $('time'), clock = $('clock'), cap = $('film-caption');
  if (range) range.value = t.toFixed(1);
  if (clock) clock.value = `${t.toFixed(1)}秒 / ${DURATION.toFixed(1)}秒`;
  const i = sceneIndex(t);
  if (cap && data && cap.dataset.scene !== String(i)) { cap.dataset.scene = String(i); cap.textContent = `${RANGES[i]}秒　${SCENES[i].title(data)}`; }
}
function show(t) {
  current = clampT(t);
  drawFrame(current);
  if (!RENDER) syncUi(current);
}
function pause() {
  playing = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  const btn = $('play');
  if (btn && !RENDER) { btn.textContent = '再生'; btn.setAttribute('aria-pressed', 'false'); }
}
function play() {
  if (RENDER || !data) return;
  if (current >= DURATION) current = 0;
  playing = true;
  startAt = performance.now() - current * 1000;
  const btn = $('play');
  btn.textContent = '一時停止';
  btn.setAttribute('aria-pressed', 'true');
  const tick = (now) => {
    if (!playing) return;
    const t = (now - startAt) / 1000;
    if (t >= DURATION) { show(DURATION); pause(); return; }
    show(t);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function syncDims() {
  const dims = $('film-dims');
  if (dims) dims.textContent = dimsText();
  canvas.setAttribute('width', String(W));
  canvas.setAttribute('height', String(H));
}
function setOrient(o) {
  if (hasSize || !SIZES[o] || !data) return;
  pause();
  orient = o;
  W = SIZES[o].width;
  H = SIZES[o].height;
  window.motionConfig.width = W;
  window.motionConfig.height = H;
  $('stage')?.setAttribute('data-orient', o);
  document.querySelectorAll('button[data-orient]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === o)));
  syncDims();
  setStatus(readyText(), 'ready');
  show(current);
}

if (!RENDER) {
  $('play')?.addEventListener('click', () => (playing ? pause() : play()));
  $('reset')?.addEventListener('click', () => { pause(); show(0); });
  $('replay')?.addEventListener('click', () => { pause(); show(0); play(); });
  $('end')?.addEventListener('click', () => { pause(); show(DURATION); });
  $('time')?.addEventListener('input', (e) => { pause(); show(Number(e.target.value)); });
  document.querySelectorAll('button[data-jump]').forEach((b) => b.addEventListener('click', () => { pause(); show(Number(b.dataset.jump)); }));
  document.querySelectorAll('button[data-orient]').forEach((b) => b.addEventListener('click', () => setOrient(b.dataset.orient)));
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
  retryBtn?.addEventListener('click', () => prepare());
  $('stage')?.setAttribute('data-orient', orient);
  document.querySelectorAll('button[data-orient]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === orient)));
  syncDims();
}

prepare();
