/* yomiyasu 作例「推敲の指示書と、点検の道具」— 32秒・無音の図解動画（編集できる元ページ）
 * 作例ページと同じ照合（19件の大きさ・SHA-256と中身の対応）と同じ概念図を使い、時刻 t の完成した画面を毎回最初から描く。
 * 例は保存操作の説明（operation）。紙の言い回し・候補・読み比べの語句・JSONはすべて保存済みの実記録から読む。
 * 音は一切使わない（audioEvents は空、音声要素も音の読み込みもない）。AIもPythonもここでは動かない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

import {loadValidatedAssets, conceptLayout, drawConcept, restParams, drawText, PALETTES, FONT, ASSET_COUNT, IN_EDGES, ALL_EDGES, AssetError, easeOut, prog, span, steps} from '../concept.js';

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 32;
const POSTER_TIME = 31;
const JOB = 'operation';
const SIZES = {portrait: {width: 720, height: 1280}, wide: {width: 1280, height: 720}};
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

// 縦と横で配置を作り直す（同じ時刻表・同じ図）
const COMPOSE = {
  portrait: {LW: 720, LH: 1280, kind: 'tall', rail: {x: 40, y: 34, h: 44, size: 20, align: 'left'}, title: {x: 40, y: 134, size: 44, max: 640}, sub: {x: 40, y: 184, size: 23, max: 640}, world: {x: 10, y: 214, w: 700, h: 1012}, foot: {x: 40, y: 1252, size: 16, max: 640}},
  wide: {LW: 1280, LH: 720, kind: 'wide', rail: {x: 1240, y: 22, h: 38, size: 17, align: 'right'}, title: {x: 40, y: 50, size: 36, max: 800}, sub: {x: 40, y: 90, size: 19, max: 800}, world: {x: 20, y: 116, w: 1240, h: 572}, foot: {x: 40, y: 704, size: 14, max: 1200}},
};
const layouts = {};
const layoutFor = (o) => (layouts[o] ||= conceptLayout(COMPOSE[o].kind, COMPOSE[o].world.w, COMPOSE[o].world.h));

// 7場面。最後の場面の入りは28.3〜28.9秒で終え、29〜32秒は完全に静止させる。
const SCENES = [
  {start: 0, title: '推敲の指示書と、点検の道具', sub: () => 'SKILL.md・参照資料と、同梱のPythonスクリプト2つ', rail: 0},
  {start: 4, title: '原文・用途・条件を、同じAIへ', sub: (d) => `例：${d.jobs[JOB].label}（架空のマニュアル）`, rail: 0},
  {start: 8, title: '言い回しを直し、条件は付けたまま', sub: (d) => `保存済みの変更「${d.jobs[JOB].phrases[0].b}」→「${d.jobs[JOB].phrases[0].a}」ほか`, rail: 1},
  {start: 13, title: '推敲後を、Pythonで別に点検', sub: () => 'lintは推敲後、diffは原文と推敲後（--stance=説明）', rail: 2},
  {start: 18, title: '返ってくるのは見直し候補', sub: () => 'つなぎの出現数は、意味や品質の点数ではありません', rail: 2},
  {start: 23, title: '原文と読み直し、保存済みの出力へ', sub: (d) => `${d.jobs[JOB].file.path}・${d.jobs[JOB].file.bytes.toLocaleString('en-US')} B`, rail: 2},
  {start: 29, title: '指示書から、使える推敲結果まで', sub: () => '本と入力 → AI → 別のPython → 読み比べ → JSON', rail: 3},
];
const RANGES = ['0〜4', '4〜8', '8〜13', '13〜18', '18〜23', '23〜29', '29〜32'];
const sceneIndex = (t) => { for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i; return 0; };

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
function filmParams(t) {
  const p = restParams();
  const S = p.show, D = p.draw, F = p.flow, E = p.emph, G = p.emphEdge;

  // 0〜4：本は最初から見える。4つの優先事項と業務文書の参照資料。同梱のPython 2つが本の袋から別の枠へ出る
  S.book = 1;
  S.pocket = 1;
  p.bookOpen = 0.5 + 0.5 * easeOut(prog(t, 0, 1.4));
  S.lint = S.diff = easeOut(prog(t, 0.5, 1.1));
  S.refs = easeOut(prog(t, 0.9, 1.7));
  p.bizGlow = span(t, 1.7, 2.3, 3.8, 4.4);
  S.lane = easeOut(prog(t, 2.3, 3.0));
  p.toolsOut = prog(t, 2.5, 3.7);
  D.bundle = prog(t, 2.6, 3.6);

  // 4〜8：原文の紙・用途と読み手・残す条件が、本と同じ1つのAIへ合流する
  S.ai = easeOut(prog(t, 4.0, 4.6));
  S.paper = easeOut(prog(t, 4.3, 4.9));
  S.packet = easeOut(prog(t, 4.6, 5.2));
  S.pins = easeOut(prog(t, 4.9, 5.5));
  D.skill = prog(t, 5.0, 5.9);
  D.skillStub = prog(t, 5.0, 5.3);
  D.paperIn = prog(t, 5.5, 6.0);
  D.packetIn = prog(t, 5.7, 6.2);
  D.pinsIn = prog(t, 5.9, 6.4);
  const inFlow = prog(t, 6.0, 6.8) * (1 - prog(t, 12.6, 13.2));
  for (const k of IN_EDGES) F[k] = inFlow;
  S.sheet = prog(t, 6.2, 6.5);
  p.s = easeOut(prog(t, 6.6, 7.6)) + easeOut(prog(t, 13.2, 14.2));
  p.pinsAttach = prog(t, 6.8, 7.8);

  // 8〜13：同じ紙の上で、保存済みの言い回し2か所が変わる。条件の札は紙に付いたまま
  p.edit = prog(t, 8.4, 10.4) + prog(t, 10.8, 12.6);
  p.pinGlow = span(t, 8.8, 9.4, 12.4, 13.0);

  // 13〜18：推敲後の紙が出て、別の工程のPythonへ。lint には推敲後、diff には原文と推敲後
  S.after = easeOut(prog(t, 12.8, 13.3));
  D.out = prog(t, 12.8, 13.3);
  F.out = prog(t, 13.3, 14.0) * (1 - prog(t, 17.8, 18.4));
  D.forkLint = prog(t, 14.1, 14.9);
  D.forkDiff = prog(t, 14.3, 15.2);
  D.origDiff = prog(t, 14.6, 15.6);
  p.tok.lint = prog(t, 15.0, 16.6);
  p.tok.diffA = prog(t, 15.3, 16.9);
  p.tok.diffO = prog(t, 15.7, 17.4);
  const forkOff = 1 - prog(t, 22.6, 23.2);
  F.forkLint = prog(t, 15.0, 16.6) * forkOff;
  F.forkDiff = prog(t, 15.3, 16.9) * forkOff;
  F.origDiff = prog(t, 15.7, 17.4) * forkOff;

  // 18〜23：保存済みの候補。lint は指摘なし、diff はつなぎ 2→1（「によって」→「と」、「ただし」は残る）
  D.lintCard = prog(t, 18.0, 18.4);
  S.lintCard = easeOut(prog(t, 18.2, 18.9));
  D.diffCard = prog(t, 18.8, 19.2);
  S.diffCard = easeOut(prog(t, 19.0, 19.7));
  p.cards = span(t, 18.2, 18.9, 22.6, 23.2);
  p.cardDetail = easeOut(prog(t, 20.2, 21.0));
  p.diffFirstOnly = true;
  F.lintCard = F.diffCard = prog(t, 18.0, 19.2) * forkOff;

  // 23〜29：原文と推敲後を読み直し、変わっていない例外と再起動までの範囲をつなぐ。保存済みのJSONへ
  D.lintUse = prog(t, 22.9, 23.5);
  D.diffUse = prog(t, 23.0, 23.7);
  S.compare = easeOut(prog(t, 23.0, 23.7));
  F.lintUse = F.diffUse = prog(t, 23.5, 24.3);
  p.reread = prog(t, 23.8, 25.2);
  p.rereadGlow = easeOut(prog(t, 24.4, 25.2));
  D.json = prog(t, 25.7, 26.2);
  S.json = easeOut(prog(t, 25.8, 26.4));
  F.json = prog(t, 26.0, 26.6);
  p.json = easeOut(prog(t, 26.2, 27.0));

  // 29〜32：全体の経路を同じ濃さで静止（入りは28.3〜28.9秒）
  const whole = prog(t, 28.3, 28.9);
  for (const k of ALL_EDGES) if (k !== 'bundle') F[k] = Math.max(F[k] || 0, whole);

  // 強調：いま動いている部分を濃く。下限0.74で、ほかの部分も読める濃さに保つ
  const lo = 0.74;
  E.book = E.refs = E.pocket = steps(t, 1, [[4.0, lo], [28.3, 1]]);
  E.paper = steps(t, 1, [[8.0, 0.8], [13.6, 1], [18.0, 0.8], [23.0, 1]]);
  E.packet = E.pins = steps(t, 1, [[13.0, lo], [28.3, 1]]);
  E.ai = steps(t, 1, [[13.4, 0.8], [28.3, 1]]);
  E.after = steps(t, 1, [[18.0, 0.8], [23.0, 1]]);
  E.lane = E.lint = E.diff = steps(t, 1, [[4.0, 0.8], [13.0, 1], [23.0, 0.8], [28.3, 1]]);
  E.lintCard = E.diffCard = steps(t, 1, [[23.0, 0.8], [28.3, 1]]);
  G.in = steps(t, 1, [[13.0, 0.8], [28.3, 1]]);
  G.out = steps(t, 1, [[18.0, 0.8], [28.3, 1]]);
  G.fork = G.cards = steps(t, 1, [[23.0, 0.8], [28.3, 1]]);
  G.bundle = steps(t, 1, [[4.0, 0.8], [28.3, 1]]);
  return p;
}

// ---- 画面の枠：段階の印・見出し・足元 ---------------------------------------
function drawRail(comp, t) {
  const active = SCENES[sceneIndex(t)].rail;
  const labels = ['渡す', '推敲', '点検'];
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
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 0.5, comp.rail.y + 0.5, w - 1, h - 1);
    drawText(ctx, label, x + w / 2, comp.rail.y + h / 2, {size, weight: 700, color: on ? PAL.bg : PAL.ink, align: 'center'});
    x += w + gap;
  });
  ctx.restore();
}

function drawTitles(comp, t) {
  const i = sceneIndex(t);
  const k = i === 0 ? 1 : easeOut(prog(t, SCENES[i].start, SCENES[i].start + 0.4));
  const one = (scene, a, dy) => {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = a;
    drawText(ctx, scene.title, comp.title.x, comp.title.y + dy, {size: comp.title.size, weight: 700, family: FONT.mincho, color: PAL.ink, max: comp.title.max, min: 24});
    drawText(ctx, scene.sub(data), comp.sub.x, comp.sub.y + dy, {size: comp.sub.size, color: PAL.muted, max: comp.sub.max, min: 13});
    ctx.restore();
  };
  if (i > 0 && k < 1) one(SCENES[i - 1], 1 - k, -8 * k);
  one(SCENES[i], k, 8 * (1 - k));
}

function drawFoot(comp) {
  drawText(ctx, 'nanaism/yomiyasu 60bf877・MIT　文章は架空・保存済みの記録から描画・無音', comp.foot.x, comp.foot.y, {size: comp.foot.size, color: PAL.muted, max: comp.foot.max, min: 10});
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
    drawConcept(ctx, layoutFor(orient), filmParams(t), data, PAL, JOB);
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
    await document.fonts.ready;
    const bundle = await loadValidatedAssets({
      signal: controller.signal,
      onProgress: (done, total) => { if (gen === loadGen && statusEl?.dataset.state === 'loading') setStatus(`素材 ${done}/${total} を照合しています…`, 'loading'); },
    });
    if (gen !== loadGen) throw new DOMException('aborted', 'AbortError');
    data = bundle;
    setStatus(`${ASSET_COUNT}件の素材を、大きさとSHA-256で照合しました。`, 'ready');
    setControls(true);
    show(current);
  })();
  ready.catch((error) => {
    if (gen !== loadGen || error?.name === 'AbortError') return;
    data = null;
    pause();
    setControls(false);
    drawFrame(current);
    setStatus(`${error instanceof AssetError ? error.message : '素材を読めませんでした'}。描画を止めました。ローカルのHTTPサーバー経由で開いてください。`, 'error');
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
  if (cap && cap.dataset.scene !== String(i)) { cap.dataset.scene = String(i); cap.textContent = `${RANGES[i]}秒　${SCENES[i].title}`; }
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
function setOrient(o) {
  if (hasSize || !SIZES[o]) return;
  orient = o;
  W = SIZES[o].width;
  H = SIZES[o].height;
  window.motionConfig.width = W;
  window.motionConfig.height = H;
  $('stage')?.setAttribute('data-orient', o);
  document.querySelectorAll('button[data-orient]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === o)));
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
  if (hasSize) $('stage')?.setAttribute('data-orient', orient);
}

prepare();
