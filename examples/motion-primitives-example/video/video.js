// Studio Yebisu: Motion Primitives 32 s silent film source (visual-r1).
// The same connected map as ../index.html, drawn by the shared module at any time t: the Accordion source as a
// blueprint, the author AI and the separate build/check, the nesting App → Accordion (MotionConfig + Provider) → Item
// → Trigger / Content, the pressed id going back to the App, the same paper opening, switching and closing, the
// reduced setting, and the unchanged original JSON. Native layouts for portrait 720×1280 and wide 1280×720, 30 fps,
// 960 frames, no audio. Every drawn state is one of the 15 saved browser observations; the motion between them is an
// explanation, not the component running or a recording. Nothing here calls a model or reruns the original build or
// checks. Asset paths resolve from ../concept.js's own module URL, so a renderer entry with <base href="video/"> works.

import {
  loadAssets, drawMap, between, plan, observation, stageAt, STAGE_TIMES, PALETTES, FONT, SERIF, LoadError,
  TOTAL_FILES, PDF_ROW_CROP, seg, ease,
} from '../concept.js?v=visual-r1';

const DURATION = 32, FPS = 30, POSTER = 31;
const SIZES = {portrait: [720, 1280], wide: [1280, 720]};
const LOGICAL = {portrait: [360, 640], wide: [640, 360]};
// Portrait uses the taller vertical arrangement; wide uses the wide one. Both are native layouts, not a rescale.
const MAP = {portrait: {kind: 'tall', rect: {x: 20, y: 78, w: 320, h: 458.7}}, wide: {kind: 'wide', rect: {x: 0, y: 38, w: 640, h: 300}}};
const pal = PALETTES.light;
const bump = (t, a, b) => Math.sin(Math.PI * seg(t, a, b));

// The timeline. Each step joins two saved observations over [at, end]; between segments the end state holds.
// The map stops changing at 28.5 s; 29–32 s holds the full final map.
const SEGMENTS = [
  {at: 0, end: 4, kind: 'intro'},
  {at: 4, end: 8, kind: 'stage', stage: 0, obs: 'initial'},
  {at: 8, end: 11.2, kind: 'stage', stage: 1, obs: 'initial'},
  {at: 11.2, end: 12.3, kind: 'step', a: 'initial', b: 'draft-only'},
  {at: 12.3, end: 13.9, kind: 'step', a: 'draft-only', b: 'search-two'},
  {at: 14, end: 15.9, kind: 'step', a: 'search-two', b: 'open-pdf'},
  {at: 15.95, end: 17.85, kind: 'step', a: 'open-pdf', b: 'switch-images'},
  {at: 17.9, end: 19.8, kind: 'step', a: 'switch-images', b: 'close-images'},
  {at: 20, end: 22.4, kind: 'step', a: 'close-images', b: 'manual-reduced', lane: 'export-images'},
  {at: 23.2, end: 24.4, kind: 'step', a: 'manual-reduced', b: 'os-reduced'},
  {at: 26, end: 26.9, kind: 'step', a: 'os-reduced', b: 'manual-reduced'},
  {at: 26.9, end: 28.6, kind: 'output'},
];

// Seven scenes for the seven jump points.
const SCENES = [
  {at: 0, title: 'Reactの動く部品集から、1つ',
    sub: t => (t < 2.2 ? 'Motion Primitives：motion＋Tailwindの部品' : 'SKILL.mdでも推論APIでもnpm導入でもない')},
  {at: 4, title: '作者AIが書き、制作担当が確かめる',
    sub: t => (t < 6 ? '原典部品＋依頼＋架空6件 → 作者AI' : '画面と最小adapter → 型検査・ビルド・実操作')},
  {at: 8, title: '写した部品の入れ子',
    sub: t => (t < 11.2 ? 'App → Accordion → Item → 押す入口・本文' : t < 12.3 ? '入力しただけでは6件のまま' : '検索ボタンで6件 → 2件')},
  {at: 14, title: '押すと、idがAppへ戻る',
    sub: t => (t < 15.95 ? 'button → toggleItem → onValueChange → App' : t < 17.9 ? '別のid：古い本文が閉じ、新しい本文が開く' : '同じid：閉じる（開くのは常に1件）')},
  {at: 20, title: '動きを抑えても、同じ本文',
    sub: t => (t < 23.2 ? 'ページの設定 → 設定0秒で開く' : 'OS設定（CDP模擬）でも0秒・同じ文とタグ')},
  {at: 26, title: '元の実JSONと、実部品', sub: () => '2529B・保存時刻そのまま／desk.htmlで操作'},
  {at: 29, title: '写した部品＋Appの状態', title2: '→ 同じ紙が開閉する', sub: () => ''},
];

const params = new URLSearchParams(location.search);
const rendering = !!window.__MOTION_RENDER__ || params.has('render');
if (rendering) document.documentElement.classList.add('render');
const rc = window.renderConfig || {};
let orient = rc.width && rc.height ? (rc.width > rc.height ? 'wide' : 'portrait') : params.get('orient') === 'wide' ? 'wide' : 'portrait';

const config = {
  duration: DURATION,
  fps: Number.isInteger(rc.fps) && rc.fps > 0 ? rc.fps : FPS,
  width: Number.isInteger(rc.width) && rc.width > 0 ? rc.width : SIZES[orient][0],
  height: Number.isInteger(rc.height) && rc.height > 0 ? rc.height : SIZES[orient][1],
  posterTime: POSTER,
  audioEvents: [],
};
window.motionConfig = config;

const canvas = document.getElementById('film');
const frame = canvas.parentElement;
const ctx = canvas.getContext('2d');
canvas.width = config.width;
canvas.height = config.height;
frame.dataset.orient = orient;

let assets = null, pdfImage = null, generation = 0, controller = null, current = 0;

const indexAt = (list, t) => { let i = 0; while (i + 1 < list.length && t >= list[i + 1].at) i++; return i; };

// The whole picture at time t, from t alone (no wall clock, no accumulation, no randomness).
function filmState(t) {
  const S = SEGMENTS[indexAt(SEGMENTS, t)];
  const local = seg(t, S.at, S.end);
  if (S.kind === 'intro') {
    // The Accordion source as a blueprint, shrinking into the source box; the rest of the map waits faintly.
    const s = stageAt(assets, observation(assets, 'initial'), 0, 0);
    s.hero = {p: seg(t, 0.9, 3.5)};
    return s;
  }
  if (S.kind === 'stage') {
    const s = stageAt(assets, observation(assets, S.obs), S.stage, local * STAGE_TIMES[S.stage]);
    // In the film the nesting stays fully drawn from the previous scene; the rings name it outside in.
    if (S.stage === 1) s.show = {};
    return s;
  }
  if (S.kind === 'step') {
    const a = observation(assets, S.a), b = observation(assets, S.b);
    return between(assets, a, b, local * plan(a, b).total, S.lane);
  }
  // Output: the App's state as the original saved JSON, and the original screen as supporting evidence.
  const s = between(assets, observation(assets, 'os-reduced'), observation(assets, 'manual-reduced'), Infinity);
  if (t > 26.95 && t < 27.6) s.tokens.push({path: 'app-json', p: seg(t, 26.95, 27.6), color: 'green'});
  s.pulse.json = bump(t, 27.3, 28.1);
  s.pulse.obs = bump(t, 27.6, 28.5);
  s.pulse.desk = bump(t, 27.6, 28.5);
  s.evidence = ease(seg(t, 27.5, 28.3));
  return s;
}

function text(str, x, y, size, {weight = 500, align = 'left', color = pal.ink, family = FONT, max} = {}) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  if (max) ctx.fillText(str, x, y, max); else ctx.fillText(str, x, y);
}

function drawChrome(t) {
  const index = indexAt(SCENES, t), scene = SCENES[index];
  const reveal = 0.4 + 0.6 * ease(seg(t, scene.at, scene.at + 0.3));
  const [LW] = LOGICAL[orient];
  const wide = orient === 'wide';
  const tickW = (LW - 40) / SCENES.length;
  for (let i = 0; i < SCENES.length; i++) {
    ctx.fillStyle = i <= index ? pal.accent : pal.rule;
    ctx.fillRect(20 + i * tickW, wide ? 6 : 12, tickW - 4, 2.5);
  }
  const sub = scene.sub(t);
  ctx.globalAlpha = reveal;
  if (wide) {
    text(scene.title + (scene.title2 || ''), 16, 30, 18, {weight: 700, family: SERIF, max: sub ? 290 : 608});
    if (sub) text(sub, 624, 30, 12, {align: 'right', color: pal.sub, max: 316});
  } else {
    text(scene.title, 20, 44, 21, {weight: 700, family: SERIF, max: 320});
    if (scene.title2) text(scene.title2, 20, 70, 19, {weight: 700, family: SERIF, max: 320});
    else if (sub) text(sub, 20, 67, 13, {color: pal.sub, max: 320});
  }
  ctx.globalAlpha = 1;
}

// Portrait only: under the map, the colour key, which gives way to the original screen crop at the end.
function drawStrip(t) {
  if (orient !== 'portrait') return;
  const ev = pdfImage ? ease(seg(t, 27.5, 28.3)) : 0;
  const y = 552;
  ctx.globalAlpha = 1 - ev;
  const keys = [[pal.blue, pal.blueSoft, '写した原典部品'], [pal.green, pal.greenSoft, '作例のApp'], [pal.accent, pal.accent, '押したid']];
  let x = 22;
  for (const [stroke, fill, label] of keys) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.3;
    ctx.fillRect(x, y, 11, 11);
    ctx.strokeRect(x, y, 11, 11);
    text(label, x + 16, y + 10, 12, {max: 90});
    ctx.font = `500 12px ${FONT}`;
    x += 16 + Math.min(90, ctx.measureText(label).width) + 14;
  }
  ctx.setLineDash([3, 2]);
  ctx.strokeStyle = pal.ink;
  ctx.strokeRect(22, y + 22, 11, 11);
  ctx.setLineDash([]);
  text('制作担当の別工程（型検査・ビルド・実操作）', 38, y + 32, 12, {max: 300});
  if (ev > 0.01) {
    ctx.globalAlpha = ev;
    const [sx, sy, sw, sh] = PDF_ROW_CROP;
    const dh = 58, dw = (sw / sh) * dh;
    ctx.drawImage(pdfImage, sx, sy, sw, sh, 22, y - 6, dw, dh);
    ctx.strokeStyle = pal.blue;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(22, y - 6, dw, dh);
    text('元の実画面（記録）', 22 + dw + 10, y + 12, 13, {weight: 700, max: 320 - dw - 10});
    text('pdf.png：PDFを開いた行', 22 + dw + 10, y + 30, 12, {color: pal.sub, max: 320 - dw - 10});
    text('部品はdesk.htmlで動く', 22 + dw + 10, y + 46, 12, {color: pal.sub, max: 320 - dw - 10});
  }
  ctx.globalAlpha = 1;
}

function drawFoot() {
  const line = '図は保存した実操作記録の説明・部品の実行や録画ではない・無音';
  if (orient === 'wide') text(line, 320, 353, 11, {align: 'center', color: pal.sub, max: 620});
  else text(line, 180, 628, 11, {align: 'center', color: pal.sub, max: 336});
}

function draw(t) {
  current = Math.max(0, Math.min(DURATION, Number.isFinite(t) ? t : 0));
  const W = canvas.width, H = canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  if (assets) {
    const [LW, LH] = LOGICAL[orient];
    const k = Math.min(W / LW, H / LH);
    ctx.translate((W - LW * k) / 2, (H - LH * k) / 2);
    ctx.scale(k, k);
    drawChrome(current);
    const m = MAP[orient];
    drawMap(ctx, m.kind, m.rect, filmState(current), pal, {minPx: 11, images: orient === 'wide' && pdfImage ? {pdf: pdfImage} : null});
    drawStrip(current);
    drawFoot();
  }
  ctx.restore();
}

window.seek = t => {
  const time = Number(t) || 0;
  if (assets) { draw(time); return Promise.resolve(); }
  return window.motionReady.then(() => draw(time));
};

// ---- Loading (shared 22-file gate) and the editor around the canvas ----

const $ = id => document.getElementById(id);
const status = $('asset-status');
const dims = $('asset-dims');
const timeInput = $('time'), clock = $('clock');
const orientButtons = [...document.querySelectorAll('button[data-orient]')];
const editorControls = rendering ? [] : [
  $('play'), $('reset'), $('replay'), $('end'), timeInput, ...document.querySelectorAll('button[data-jump]'), ...orientButtons,
];
let playing = false, playStart = 0, playFrom = 0, raf = 0;

const readyLine = () => `${TOTAL_FILES}件を確認済み・${orient === 'wide' ? '横長' : '縦長'} ${config.width}×${config.height}・32秒・30fps・960フレーム・無音`;

function setStatus(state, message) {
  if (!status) return;
  status.dataset.state = state;
  status.textContent = message;
}

// The original pdf.png, decoded from the bytes already checked by SHA-256. Used only as a small evidence crop.
async function decodePdf(loaded) {
  const blob = new Blob([loaded.raw('video/assets/pdf.png')], {type: 'image/png'});
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function load() {
  const mine = ++generation;
  if (controller) controller.abort();
  controller = new AbortController();
  assets = null;
  pdfImage = null;
  stop();
  draw(current);
  for (const control of editorControls) control.disabled = true;
  if ($('retry')) { $('retry').hidden = true; $('retry').disabled = true; }
  if (dims) dims.textContent = '';
  setStatus('loading', `固定した${TOTAL_FILES}件を確認中`);
  const ready = (async () => {
    const loaded = await loadAssets({signal: controller.signal, onProgress(info) {
      if (mine !== generation) return;
      setStatus('loading', `確認中 ${info.done}/${info.total}`);
    }});
    let image;
    try {
      image = await decodePdf(loaded);
    } catch {
      throw new LoadError('video/assets/pdf.png を画像として読めません');
    }
    await document.fonts.ready;
    if (mine !== generation) throw new DOMException('superseded', 'AbortError');
    assets = loaded;
    pdfImage = image;
    draw(current);
  })();
  window.motionReady = ready;
  ready.then(() => {
    if (mine !== generation) return;
    for (const control of editorControls) control.disabled = false;
    setStatus('ready', readyLine());
    if (dims) dims.textContent = `実画面4枚のPNG寸法を確認済み：${assets.screens.map(sc => `${sc.path.split('/').pop()} ${sc.w}×${sc.h}`).join('・')}`;
    syncClock();
  }, error => {
    if (mine !== generation) return;
    assets = null;
    pdfImage = null;
    draw(current);
    const reason = error instanceof LoadError ? error.message : '読み込み中に予期しないエラーが起きました';
    setStatus('error', `読み込みを止めました。${reason}。図と記録は表示していません。`);
    if ($('retry')) { $('retry').hidden = false; $('retry').disabled = false; }
  });
  // The renderer awaits motionReady itself; avoid an unhandled rejection report in the editor.
  ready.catch(() => {});
}

function syncClock() {
  if (!timeInput) return;
  timeInput.value = String(Math.round(current * 10) / 10);
  clock.value = `${current.toFixed(1)} / ${DURATION.toFixed(1)}秒`;
}

function show(t) { draw(t); syncClock(); }

function stop() {
  playing = false;
  cancelAnimationFrame(raf);
  raf = 0;
  const play = $('play');
  if (play) { play.textContent = '再生'; play.setAttribute('aria-pressed', 'false'); }
}

function tick(now) {
  raf = 0;
  if (!playing || window.__MOTION_RENDER__) { stop(); return; }
  const t = playFrom + (now - playStart) / 1000;
  if (t >= DURATION) { show(DURATION); stop(); return; }
  show(t);
  raf = requestAnimationFrame(tick);
}

function play(from) {
  if (!assets || window.__MOTION_RENDER__) return;
  playing = true;
  playFrom = from >= DURATION ? 0 : from;
  playStart = performance.now();
  const button = $('play');
  button.textContent = '一時停止';
  button.setAttribute('aria-pressed', 'true');
  raf = requestAnimationFrame(tick);
}

// Orientation follows the two buttons; the frame element carries it for CSS, never the root element.
function setOrient(next) {
  orient = next;
  [config.width, config.height] = SIZES[next];
  canvas.width = config.width;
  canvas.height = config.height;
  frame.dataset.orient = next;
  for (const button of orientButtons) button.setAttribute('aria-pressed', String(button.dataset.orient === next));
  if (assets) setStatus('ready', readyLine());
  show(current);
}

if (!rendering) {
  $('play').addEventListener('click', () => { if (playing) stop(); else play(current); });
  $('reset').addEventListener('click', () => { stop(); show(0); });
  $('replay').addEventListener('click', () => { stop(); show(0); play(0); });
  $('end').addEventListener('click', () => { stop(); show(DURATION); });
  timeInput.addEventListener('input', () => { stop(); show(Number(timeInput.value)); });
  for (const button of document.querySelectorAll('button[data-jump]')) {
    button.addEventListener('click', () => { stop(); show(Number(button.dataset.jump)); });
  }
  for (const button of orientButtons) button.addEventListener('click', () => { stop(); setOrient(button.dataset.orient); });
  $('retry').addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });
  for (const button of orientButtons) button.setAttribute('aria-pressed', String(button.dataset.orient === orient));
}

load();
