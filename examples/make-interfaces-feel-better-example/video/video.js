// Studio Yebisu: Make Interfaces Feel Better 32 s silent film source (visual-r1).
// The same connected map as ../index.html, drawn by the shared module at any time t. Native layouts for portrait
// 720×1280 and wide 1280×720, 30 fps, 960 frames, no audio. Totals and JSON sizes come from the original export.mjs,
// called once at load on the saved input and compared with the saved outputs; nothing here calls a model or reruns
// the original review or checks. Asset paths resolve from ../concept.js's own module URL, so a renderer entry with
// <base href="video/"> works the same.

import {
  loadAssets, drawMap, finalState, stageState, groupState, PALETTES, FONT, SERIF, LoadError, PART_FOCUS, STAGE_FOCUS,
  CASE_IDS, GROUP_IDS, TOTAL_FILES, seg, ease,
} from '../concept.js?v=visual-r1';

const DURATION = 32, FPS = 30, POSTER = 31, MOTION_END = 28.9;
const SIZES = {portrait: [720, 1280], wide: [1280, 720]};
const LOGICAL = {portrait: [360, 640], wide: [640, 360]};
const MAP_RECT = {portrait: {x: 8, y: 94, w: 344, h: 436}, wide: {x: 8, y: 42, w: 624, h: 274}};
const STRIP = {portrait: {x: 14, y: 540, w: 332, h: 50}, wide: {x: 30, y: 320, w: 580, h: 22}};
const pal = PALETTES.light;

// Scenes start at the seven jump points (0, 4, 8, 14, 20, 26, 29). The closing line fades in from 28.4 so that
// nothing changes after 28.9 s.
const SCENES = [
  {at: 0, title: 'AIが読む、UI細部の指針'},
  {at: 4, title: '画面と依頼を、AIに渡す'},
  {at: 8, title: '3か所に印、同じ画面を直す'},
  {at: 14, title: '3つの変化'},
  {at: 20, title: '同じ入力から、同じJSON'},
  {at: 26, title: '確認は、制作担当の別工程'},
  {at: 28.4, title: 'スキル＋画面＋依頼 →', title2: '直す場所・理由・同じJSON'},
];
const GROUP_SUB = {
  area: '1 押せる範囲：16px → 行全体＋フォーカス',
  numbers: '2 数字：升を固定、幅が動かない',
  button: '3 押下 0.86 → 0.96・ブラウザーへ渡す',
};
// 20–26 s: the three saved presets in turn, each total rolling in the same slots and each file size real.
const RUNS = [['one', 20, 23.4], ['two', 23.4, 24.7], ['all', 24.7, 26]];
const STRIP_AT = {one: 23.1, two: 24.5, all: 25.8};

const params = new URLSearchParams(location.search);
const rendering = !!window.__MOTION_RENDER__ || params.has('render');
if (rendering) document.documentElement.classList.add('render');
const rc = window.renderConfig || {};
let orient = rc.width && rc.height ? (rc.width > rc.height ? 'wide' : 'portrait') : params.get('orient') === 'wide' ? 'wide' : 'portrait';

const config = {
  duration: DURATION,
  fps: Number.isInteger(rc.fps) && rc.fps > 0 ? rc.fps : FPS,
  width: Number.isInteger(rc.width) ? rc.width : SIZES[orient][0],
  height: Number.isInteger(rc.height) ? rc.height : SIZES[orient][1],
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

let assets = null, generation = 0, controller = null, current = 0;

const sceneIndex = t => { let i = 0; while (i + 1 < SCENES.length && t >= SCENES[i + 1].at) i++; return i; };

// The whole picture at time t, from t alone (no wall clock, no accumulation, no randomness). Returns the state and
// the local time the lens needs.
function filmState(t) {
  const ev = (a, b) => ease(seg(t, a, b));
  if (t < 4) {
    // What it is: the book and its five reference tabs first, then the rest of the map as a faint skeleton.
    const s = stageState(assets, 'all', 0, 0);
    s.tokens = [];
    s.tabs = [0, 1, 2, 3, 4].map(i => ev(0.9 + i * 0.3, 1.1 + i * 0.3));
    const rest = ev(2.8, 3.6);
    s.show = {book: ev(0.1, 0.6), req: rest, ai: rest, page: rest, quick: 0, rejected: 0, clips: rest, exp: rest, ribbon: rest, file: 0, verify: 0};
    s.focus = t < 2.8 ? ['book', 'tabs'] : null;
    return {s, e: 0};
  }
  if (t < 8) return {s: stageState(assets, 'all', 0, t - 4), e: t - 4};
  if (t < 14) { const e = (t - 8) * 7 / 6; return {s: stageState(assets, 'all', 1, e), e}; }
  if (t < 20) {
    const i = Math.min(2, Math.floor((t - 14) / 2));
    return {s: groupState(assets, 'all', GROUP_IDS[i], (t - 14 - 2 * i) * 1.3), e: 0};
  }
  if (t < 26) {
    const [id, a, b] = RUNS.find(([, , end]) => t < end) || RUNS[2];
    if (id === 'one') return {s: stageState(assets, 'one', 2, (t - a) * 1.6), e: 0};
    const s = finalState(assets, id);
    s.focus = STAGE_FOCUS[2];
    s.from = id === 'two' ? 'one' : 'two';
    s.roll = ev(a + 0.1, a + 0.6);
    s.tokens.push({path: 'ribbon-b', kind: 'json', p: seg(t, a + 0.5, b - 0.5), live: t > a + 0.5 && t < b - 0.5});
    s.pulse.file = seg(t, b - 0.6, b);
    return {s, e: 0};
  }
  const s = finalState(assets, 'all');
  if (t < 27.4) { s.focus = PART_FOCUS.verify; s.pulse.verify = seg(t, 26.1, 26.9); }
  else if (t < 28.4) s.focus = PART_FOCUS.rejected;
  return {s, e: 0};
}

function subtitle(t) {
  if (t < 4) return t < 2.8 ? '1冊・19原則・5参照／APIでもモデルでもない' : '画面・依頼・契約が1枚の図に';
  if (t < 8) return '元のAIが一度だけ読んだ（いまは動かない）';
  if (t < 14) return 'quick・上限3群／変えない3案も残す';
  if (t < 20) return GROUP_SUB[GROUP_IDS[Math.min(2, Math.floor((t - 14) / 2))]];
  if (t < 26) {
    const [id] = RUNS.find(([, , end]) => t < end) || RUNS[2];
    const p = assets.presets[id];
    return `${id}：${p.count}件・${p.time}・${p.bytes}B（保存済みと一致）`;
  }
  if (t < 28.4) return 'Node8条件・実ダウンロード／人の承認ではない';
  return '';
}

function text(str, x, y, size, {weight = 500, align = 'left', color = pal.ink, family = FONT, max} = {}) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  if (max) ctx.fillText(str, x, y, max); else ctx.fillText(str, x, y);
}

function drawChrome(t) {
  const index = sceneIndex(t), scene = SCENES[index];
  const reveal = 0.4 + 0.6 * ease(seg(t, scene.at, scene.at + 0.3));
  const [LW] = LOGICAL[orient];
  const wide = orient === 'wide';
  // Seven ticks for the seven scenes.
  const tickW = (LW - 40) / SCENES.length;
  for (let i = 0; i < SCENES.length; i++) {
    ctx.fillStyle = i <= index ? pal.accent : pal.rule;
    ctx.fillRect(20 + i * tickW, wide ? 8 : 14, tickW - 4, 2.5);
  }
  const sub = subtitle(t);
  ctx.globalAlpha = reveal;
  if (wide) {
    text(scene.title + (scene.title2 || ''), 16, 32, 20, {weight: 700, family: SERIF, max: sub ? 290 : 608});
    if (sub) text(sub, 624, 32, 13, {align: 'right', color: pal.sub, max: 310});
  } else {
    text(scene.title, 20, 50, 22, {weight: 700, family: SERIF, max: 320});
    if (scene.title2) text(scene.title2, 20, 80, 22, {weight: 700, family: SERIF, max: 320});
    else if (sub) text(sub, 20, 77, 13, {color: pal.sub, max: 320});
  }
  ctx.globalAlpha = 1;
}

// The three saved presets, each appearing when its run in the film is finished. Values are the real results.
function drawStrip(t) {
  const R = STRIP[orient];
  const wide = orient === 'wide';
  const gap = wide ? 10 : 6, cw = (R.w - gap * 2) / 3;
  CASE_IDS.forEach((id, i) => {
    const p = assets.presets[id];
    const x = R.x + i * (cw + gap), y = R.y;
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.paper; ctx.fillRect(x, y, cw, R.h);
    ctx.lineWidth = 1; ctx.strokeStyle = pal.rule; ctx.strokeRect(x, y, cw, R.h);
    text(id, x + 7, y + (wide ? 15 : 16), 12, {weight: 700, color: pal.green});
    ctx.globalAlpha = ease(seg(t, STRIP_AT[id], STRIP_AT[id] + 0.4));
    if (wide) {
      text(`${p.count}件・${p.time}`, x + 40, y + 15, 12, {weight: 700, max: cw * 0.5});
      text(`${p.bytes}B`, x + cw - 8, y + 15, 12, {align: 'right', max: cw * 0.3});
    } else {
      text(`${p.count}件・${p.time}`, x + 7, y + 32, 13, {weight: 700, max: cw - 12});
      text(`JSON ${p.bytes}B`, x + 7, y + 45, 11, {color: pal.sub, max: cw - 12});
    }
    ctx.globalAlpha = 1;
  });
}

function drawFoot() {
  if (orient === 'wide') {
    text('Markdownの指針・元のAIが書いた変更・図は説明用・実検証は別工程・無音', 320, 355, 11, {align: 'center', color: pal.sub});
  } else {
    text('Markdownの指針・元のAIが書いた変更', 180, 612, 11, {align: 'center', color: pal.sub});
    text('図は説明用・実検証は別工程・無音', 180, 628, 11, {align: 'center', color: pal.sub});
  }
}

function draw(t) {
  current = Math.max(0, Math.min(DURATION, t));
  const W = canvas.width, H = canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  if (assets) {
    const motion = Math.min(current, MOTION_END);
    const [LW, LH] = LOGICAL[orient];
    const k = Math.min(W / LW, H / LH);
    ctx.translate((W - LW * k) / 2, (H - LH * k) / 2);
    ctx.scale(k, k);
    drawChrome(motion);
    const {s, e} = filmState(motion);
    drawMap(ctx, orient, MAP_RECT[orient], s, pal, k, e);
    drawStrip(motion);
    drawFoot();
  }
  ctx.restore();
}

window.seek = t => {
  const time = Number(t) || 0;
  if (assets) { draw(time); return Promise.resolve(); }
  return window.motionReady.then(() => draw(time));
};

// ---- Loading (shared 34-file gate) and the editor around the canvas ----

const $ = id => document.getElementById(id);
const status = $('asset-status');
const timeInput = $('time'), clock = $('clock');
const orientButtons = [...document.querySelectorAll('button[data-orient]')];
const editorControls = rendering ? [] : [
  $('play'), $('reset'), $('replay'), $('end'), timeInput, ...document.querySelectorAll('button[data-jump]'), ...orientButtons,
];
let playing = false, playStart = 0, playFrom = 0, raf = 0;

const readyLine = () => `${TOTAL_FILES}件と実計算を確認済み・${orient === 'wide' ? '横長' : '縦長'} ${config.width}×${config.height}・32秒・30fps・無音`;

function setStatus(state, message) {
  if (!status) return;
  status.dataset.state = state;
  status.textContent = message;
}

function load() {
  const mine = ++generation;
  if (controller) controller.abort();
  controller = new AbortController();
  assets = null;
  stop();
  draw(current);
  for (const control of editorControls) control.disabled = true;
  if ($('retry')) { $('retry').hidden = true; $('retry').disabled = true; }
  setStatus('loading', `固定した${TOTAL_FILES}件を確認中`);
  const ready = (async () => {
    const loaded = await loadAssets({signal: controller.signal, onProgress(info) {
      if (mine !== generation) return;
      setStatus('loading', `確認中 ${info.done}/${info.total}`);
    }});
    await document.fonts.ready;
    if (mine !== generation) throw new DOMException('superseded', 'AbortError');
    assets = loaded;
    draw(current);
  })();
  window.motionReady = ready;
  ready.then(() => {
    if (mine !== generation) return;
    for (const control of editorControls) control.disabled = false;
    setStatus('ready', readyLine());
    syncClock();
  }, error => {
    if (mine !== generation) return;
    assets = null;
    draw(current);
    const reason = error instanceof LoadError ? error.message : '読み込み中に予期しないエラーが起きました';
    setStatus('error', `読み込みを止めました。${reason}。図と数値は表示していません。`);
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
