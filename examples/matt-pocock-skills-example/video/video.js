/* Matt Pocock Skills 作例「AIに、開発の手順を渡す」— 32秒・無音の図解動画（編集できる元ページ）
 * 作例ページと同じ照合（25件の大きさ・SHA-256と中身の対応）と、原関数 search.mjs・baseline/search.mjs の実際の呼び出しを
 * 読み込み時に1回だけ行い、同じ概念図を時刻 t の完成した画面として毎回最初から描く。フレームごとに関数やテストは動かさない。
 * 例は「全角UI」（wide-ui）。件数・テスト数・ファイル名と大きさ・結果の掲載項目は、照合済みの記録と原関数の戻り値から読む。
 * 音は一切使わない（audioEvents は空、音声要素も音の読み込みもない）。AIもNodeもここでは動かない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

import {loadValidatedAssets, conceptLayout, drawConcept, restParams, drawText, shelfRegion, PALETTES, FONT, ASSET_COUNT, ALL_EDGES, NODE_KEYS,
  AssetError, easeOut, ease, prog, steps, queryText} from '../concept.js';

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 32;
const POSTER_TIME = 31;
const JOB = 'wide-ui';
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

// 縦と横で配置を作り直す（同じ時刻表・同じ図。横は横長の図の配置を使う）
const COMPOSE = {
  portrait: {LW: 720, LH: 1280, kind: 'tall', rail: {x: 40, y: 32, h: 46, size: 20, align: 'left'}, title: {x: 40, y: 130, size: 42, max: 640}, sub: {x: 40, y: 178, size: 22, max: 640}, world: {x: 10, y: 206, w: 700, h: 1026}, foot: {x: 40, y: 1256, size: 16, max: 640}},
  wide: {LW: 1280, LH: 720, kind: 'wide', rail: {x: 1240, y: 22, h: 38, size: 17, align: 'right'}, title: {x: 40, y: 48, size: 34, max: 760}, sub: {x: 40, y: 88, size: 19, max: 1200}, world: {x: 20, y: 112, w: 1240, h: 576}, foot: {x: 40, y: 706, size: 14, max: 1200}},
};
const layouts = {};
const layoutFor = (o) => (layouts[o] ||= conceptLayout(COMPOSE[o].kind, COMPOSE[o].world.w, COMPOSE[o].world.h));

// 7場面。最後の動きは28.9秒で終え、29〜32秒は完全に静止させる。
const SCENES = [
  {start: 0, rail: 0, title: () => 'AIが読む、開発の手順書', sub: () => 'Matt Pocock Skills から、この作例で4冊を選んだ'},
  {start: 4, rail: 0, title: () => '依頼と旧コードを読み、AIが書く', sub: (d) => `用語集${d.glossaryTerms.length}語・仕様${d.specCount}条件・入口は1つ（事前に決定・利用者は未確認）`},
  {start: 8, rail: 1, title: () => '同じテストを、別のNodeで実行', sub: (d) => { const c = d.cycles[0]; return `段1：${c.red.tests}件中 失敗${c.red.fail} → 最小の変更 → ${c.green.tests}件中 成功${c.green.pass}`; }},
  {start: 13, rail: 1, title: () => '同じ輪で、1件ずつ足す', sub: (d) => `段2：${d.cycles[1].green.tests}件・段3：${d.cycles[2].green.tests}件で全件成功　テストとは別に${d.acceptance.checks}項目の確認`},
  {start: 18, rail: 1, title: () => '固定差分を、2つの目で別々に', sub: (d) => `規約 ${d.review.standards}件・仕様 ${d.review.spec}件　元の独立AIの記録・書き換えなし・人の承認ではない`},
  {start: 23, rail: 2, title: (d) => `原関数に、同じ${d.entries.length}件を通す`, sub: (d, j) => `${queryText(j.query)} → ${j.final.length}件（旧コード ${j.baseline.length}件）・${j.output.file} ${j.output.bytes.toLocaleString('en-US')} B`},
  {start: 29, rail: 3, title: () => 'AIに、開発の手順を渡す', sub: () => '手順書 → AIが執筆 → Nodeで確認 → 2つの照合 → 呼べる検索'},
];
const RANGES = ['0〜4', '4〜8', '8〜13', '13〜18', '18〜23', '23〜29', '29〜32'];
const sceneIndex = (t) => { for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i; return 0; };
// 見出しと段階の印は場面の0.5秒前から0.1秒前までに入れ替え、29秒からは何も動かさない
const LEAD = 0.5;
const titleIndex = (t) => sceneIndex(t + LEAD);

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
function filmParams(t) {
  const p = restParams();
  const S = p.show, D = p.draw, F = p.flow, E = p.emph, G = p.emphEdge;
  for (const k of NODE_KEYS) S[k] = 0;
  for (const k of ALL_EDGES) D[k] = 0;

  // 0〜4：手順書4冊が1冊ずつ並び、大きな2×2から棚の並びへ戻る
  S.books = 1;
  p.books = 4 * prog(t, 0.2, 2.4);
  p.shelfGrid = 1 - prog(t, 3.3, 4.0);

  // 4〜8：架空の依頼と旧コード → AIが執筆 → 用語集と仕様 → 1つの入口（事前決定・未確認の札）
  S.req = S.old = S.scope = easeOut(prog(t, 4.0, 4.5));
  p.fixture = easeOut(prog(t, 4.1, 4.6));
  S.ai = easeOut(prog(t, 4.3, 4.8));
  D.bookAI = prog(t, 4.6, 5.1);
  D.reqAI = D.oldAI = prog(t, 4.8, 5.3);
  const fade8 = 1 - prog(t, 7.6, 8.2);
  F.bookAI = F.reqAI = F.oldAI = prog(t, 5.2, 5.9) * fade8;
  S.docsG = S.docsS = easeOut(prog(t, 5.6, 6.0));
  D.aiDocs = prog(t, 5.6, 6.0);
  F.aiDocs = prog(t, 5.9, 6.4) * fade8;
  p.docs = easeOut(prog(t, 6.0, 6.7));
  S.module = easeOut(prog(t, 6.3, 6.7));
  D.docsGMod = D.docsSMod = prog(t, 6.5, 6.9);
  F.docsGMod = F.docsSMod = prog(t, 6.8, 7.3) * fade8;
  p.iface = easeOut(prog(t, 6.6, 7.2));
  p.seam = easeOut(prog(t, 7.0, 7.5));

  // 8〜13：段1。同じテストの紙がNodeへ → RED → 最小の変更の紙 → GREEN → 入口の中身が1層
  S.node = easeOut(prog(t, 8.0, 8.5));
  D.aiNode = D.nodeAi = prog(t, 8.2, 8.7);
  D.loopMod = prog(t, 8.4, 8.9);
  p.loop = prog(t, 8.8, 12.6) + prog(t, 13.0, 15.2) + prog(t, 15.2, 17.4);

  // 13〜18：段2・段3も同じ輪とタブ。最後にテストとは別の18項目の札
  S.extra = easeOut(prog(t, 17.0, 17.4));
  p.extra = easeOut(prog(t, 17.2, 17.7));

  // 18〜23：入口のコードから固定差分 → 規約と仕様の目が別々に見る（線は見るだけで、矢印は戻らない）
  S.diff = easeOut(prog(t, 18.3, 18.8));
  D.modDiff = prog(t, 18.3, 18.8);
  F.modDiff = prog(t, 18.6, 19.2) * (1 - prog(t, 22.4, 23.0));
  p.diff = easeOut(prog(t, 18.6, 19.1));
  S.lensA = easeOut(prog(t, 19.2, 19.7));
  p.lensA = easeOut(prog(t, 19.4, 19.9));
  S.lensB = easeOut(prog(t, 19.6, 20.1));
  p.lensB = easeOut(prog(t, 19.8, 20.3));
  p.findA = easeOut(prog(t, 20.6, 21.1));
  p.findB = easeOut(prog(t, 21.1, 21.6));

  // 23〜29：同じ6件が入口へ → 原関数が返した掲載項目が順に出る → 保存したJSONと元の検索台
  S.entries = easeOut(prog(t, 23.0, 23.6));
  D.entMod = prog(t, 23.5, 23.9);
  F.entMod = prog(t, 23.9, 24.6);
  p.travel = prog(t, 24.0, 25.4);
  S.results = easeOut(prog(t, 25.1, 25.5));
  D.modRes = prog(t, 25.1, 25.5);
  F.modRes = prog(t, 25.3, 25.9);
  p.results = prog(t, 25.4, 26.6);
  D.resJson = D.resDesk = prog(t, 26.6, 27.0);
  S.json = S.desk = easeOut(prog(t, 26.7, 27.2));
  p.files = easeOut(prog(t, 26.9, 27.6));
  F.resJson = F.resDesk = prog(t, 27.0, 27.6);

  // 29〜32：全体の経路を同じ濃さで静止（入りは28.3〜28.9秒）
  const whole = prog(t, 28.3, 28.9);
  for (const k of ALL_EDGES) F[k] = Math.max(F[k] || 0, whole);

  // 強調：いま動いている部分を濃く。下限0.7で、ほかの部分も読める濃さに保つ
  const lo = 0.7;
  E.books = steps(t, 1, [[4.8, lo], [28.3, 1]]);
  E.req = E.old = E.scope = E.docsG = E.docsS = steps(t, 1, [[8.0, lo], [28.3, 1]]);
  E.ai = steps(t, 1, [[17.6, lo], [28.3, 1]]);
  E.node = E.extra = steps(t, 1, [[18.0, lo], [28.3, 1]]);
  E.diff = E.lensA = E.lensB = steps(t, 1, [[23.0, lo], [28.3, 1]]);
  G.in = G.docs = steps(t, 1, [[8.0, 0.7], [28.3, 1]]);
  G.loop = G.code = steps(t, 1, [[18.0, 0.7], [28.3, 1]]);
  G.review = steps(t, 1, [[23.0, 0.7], [28.3, 1]]);
  return p;
}

// ---- 画面の枠：段階の印・見出し・足元 ---------------------------------------
function drawRail(comp, t) {
  const active = SCENES[titleIndex(t)].rail;
  const labels = ['読む', '確かめる', '使う'];
  const {h, size} = comp.rail;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT.sans}`;
  const widths = labels.map((l) => ctx.measureText(l).width + size * 1.6);
  const gap = 8;
  const total = widths.reduce((s, w) => s + w, 0) + gap * (labels.length - 1);
  let x = comp.rail.align === 'right' ? comp.rail.x - total : comp.rail.x;
  labels.forEach((label, i) => {
    const w = widths[i];
    const on = active === 3 || i === active;
    ctx.fillStyle = on ? PAL.ink : PAL.bg;
    ctx.fillRect(x, comp.rail.y, w, h);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x + 0.7, comp.rail.y + 0.7, w - 1.4, h - 1.4);
    drawText(ctx, label, x + w / 2, comp.rail.y + h / 2, {size, weight: 700, color: on ? PAL.bg : PAL.ink, align: 'center'});
    x += w + gap;
  });
  ctx.restore();
}

function drawTitles(comp, t) {
  const job = data.jobs[JOB];
  const i = titleIndex(t);
  const k = i === 0 ? 1 : easeOut(prog(t, SCENES[i].start - LEAD, SCENES[i].start - 0.1));
  const one = (scene, a, dy) => {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = a;
    drawText(ctx, scene.title(data, job), comp.title.x, comp.title.y + dy, {size: comp.title.size, weight: 700, family: FONT.mincho, color: PAL.ink, max: comp.title.max, min: 24});
    drawText(ctx, scene.sub(data, job), comp.sub.x, comp.sub.y + dy, {size: comp.sub.size, color: PAL.muted, max: comp.sub.max, min: 13});
    ctx.restore();
  };
  if (i > 0 && k < 1) one(SCENES[i - 1], 1 - k, -8 * k);
  one(SCENES[i], k, 8 * (1 - k));
}

function drawFoot(comp) {
  drawText(ctx, 'mattpocock/skills 49dd158・MIT　保存記録と原関数の実際の呼び出しから描画・無音', comp.foot.x, comp.foot.y, {size: comp.foot.size, color: PAL.muted, max: comp.foot.max, min: 10});
}

// いま加わった形を大きく、合流するたびに連続して引く。拡大は1〜2.4倍、図の外は映さない。絶対時刻だけで決まる。
function diagramCamera(L, t) {
  const fit = (rects) => {
    const pad = 16;
    const x = Math.min(...rects.map((r) => r.x)) - pad, y = Math.min(...rects.map((r) => r.y)) - pad;
    const width = Math.max(...rects.map((r) => r.x + r.w)) + pad - x;
    const height = Math.max(...rects.map((r) => r.y + r.h)) + pad - y;
    const z = Math.max(1, Math.min(L.W / width, L.H / height, 2.4));
    const cx = (L.W - width * z) / 2 - x * z, cy = (L.H - height * z) / 2 - y * z;
    return {z, x: Math.min(0, Math.max(L.W - L.W * z, cx)), y: Math.min(0, Math.max(L.H - L.H * z, cy))};
  };
  const n = L.n;
  const pick = (keys) => keys.map((k) => n[k]);
  const poses = [
    fit([shelfRegion(L, {shelfGrid: 1})]),
    fit(pick(['books', 'req', 'old', 'ai', 'docsG', 'docsS', 'module'])),
    fit(pick(['ai', 'node', 'extra', 'docsG', 'module'])),
    fit(pick(['node', 'module', 'diff', 'lensA', 'lensB'])),
    fit(pick(['module', 'entries', 'results', 'json', 'desk'])),
    {z: 1, x: 0, y: 0},
  ];
  const transitions = [[3.3, 4.0], [7.6, 8.3], [17.6, 18.3], [22.6, 23.3], [28.2, 28.9]];
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
    drawConcept(ctx, L, filmParams(t), data, PAL, JOB);
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
  controls().forEach((el) => { el.disabled = !on || (el.matches('button[data-orient]') && hasSize); });
}
function setStatus(text, state) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.state = state;
  statusEl.setAttribute('role', state === 'error' ? 'alert' : 'status');
}
const readyText = () => `${ASSET_COUNT}件の素材を大きさとSHA-256で照合し、原関数の実際の結果が保存済みの3件と同じ順序であることを確かめました。いまの画面：${dimsText()}・${FPS}fps・${DURATION}秒・無音。`;

function prepare() {
  const gen = ++loadGen;
  controller?.abort();
  controller = new AbortController();
  data = null;
  pause();
  setControls(false);
  if (retryBtn) retryBtn.hidden = true;
  setStatus(`素材 0/${ASSET_COUNT} を照合しています…`, 'loading');
  drawFrame(current);
  const ready = (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const bundle = await loadValidatedAssets({
      signal: controller.signal,
      onProgress: (done, total) => { if (gen === loadGen && statusEl?.dataset.state === 'loading') setStatus(`素材 ${done}/${total} を照合しています…`, 'loading'); },
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
  if (cap && data && cap.dataset.scene !== String(i)) { cap.dataset.scene = String(i); cap.textContent = `${RANGES[i]}秒　${SCENES[i].title(data, data.jobs[JOB])}`; }
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
}
function setOrient(o) {
  if (hasSize || !SIZES[o] || !data) return;
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
