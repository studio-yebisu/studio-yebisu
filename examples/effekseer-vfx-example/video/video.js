// Studio Yebisu: Effekseer VFX 32 s silent film source (visual-r1).
// The same connected diagram as ../index.html, drawn by the shared module at any time t. Native layouts for
// portrait 720×1280 and wide 1280×720, 30 fps, 960 frames, no audio. Effect pixels are the saved Godot PNGs only.

import {loadAssets, drawMap, restingState, PALETTES, FONT, LoadError, STAGE_FOCUS, seg, ease, frameTime} from '../concept.js?v=visual-r1';

const DURATION = 32, FPS = 30, POSTER = 31, MOTION_END = 28.9;
const SIZES = {portrait: [720, 1280], wide: [1280, 720]};
const LOGICAL = {portrait: [360, 640], wide: [640, 360]};
const MAP_RECT = {portrait: {x: 10, y: 96, w: 340, h: 476}, wide: {x: 8, y: 44, w: 624, h: 292.5}};
const TOOTH = Math.PI / 5;
const pal = PALETTES.light;

// Scenes start at the seven jump points (0, 4, 8, 14, 20, 26, 29). The closing line fades in from 28.4 so that
// nothing changes after 28.9 s.
const SCENES = [
  {at: 0, title: '効果を、コードと実描画で作る', sub: 'AIが読む手順書と、Pythonの道具'},
  {at: 4, title: '手順＋依頼 → 制作AI', sub: 'AIが設計メモとPythonレシピを書く'},
  {at: 8, title: 'レシピ → Core → Godot', sub: '制作担当がビルドして描画・保存'},
  {at: 14, title: '見て、1種類ずつ直す', sub: 'f16：白い破片 → 青い破片 → 同じ画'},
  {at: 20, title: '画像と基準だけを別のAIへ', sub: '元の別AIレビュー / 人の承認ではない'},
  {at: 26, title: '開く・保存して使う', sub: '実描画の31枚と、効果一式'},
  {at: 28.4, title: '手順＋依頼→レシピ→実描画', title2: '→見て直す→使う', sub: ''},
];

const FOCUS = [
  ['book', 'tabs'],
  STAGE_FOCUS[0],
  ['recipe', 'lane', 'tex', 'core', 'chip', 'godot', 'e:recipe-core', 'e:tex-core', 'e:core-godot'],
  ['godot', 'eye', 'rounds', 'ai', 'recipe', 'core', 'chip', 'e:loop', 'e:ai-recipe', 'e:recipe-core', 'e:core-godot'],
  ['godot', 'rubric', 'rev', 'review', 'proof', 'lib', 'e:godot-rev', 'e:rubric-rev', 'e:rev-review', 'e:review-proof', 'e:proof-lib', 'e:build-lib'],
  ['godot', 'chip', 'lib', 'action', 'e:lib-action', 'e:build-lib'],
  null,
];

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
const ctx = canvas.getContext('2d');
canvas.width = config.width;
canvas.height = config.height;
document.documentElement.dataset.orient = orient;

let assets = null, generation = 0, controller = null, current = 0;

const sceneIndex = t => { let i = 0; while (i + 1 < SCENES.length && t >= SCENES[i + 1].at) i++; return i; };
const lerp = (a, b, p) => a + (b - a) * p;

// The whole picture at time t, from t alone (no wall clock, no accumulation, no randomness).
function filmState(t) {
  const ev = (a, b) => ease(seg(t, a, b));
  const s = restingState({ghost: 0.14});
  const show = s.show;
  show.book = ev(0.2, 0.9); show.tabs = show.book;
  s.bookOpen = ev(0.8, 1.8);
  s.tabs = 6 * seg(t, 1.4, 3.2);
  s.part = t >= 1.4 && t < 3.2 ? Math.min(5, Math.floor(s.tabs)) : -1;
  show.request = ev(4.0, 4.6); s.beats = 5 * seg(t, 4.3, 5.5);
  show.ai = ev(4.8, 5.4); s.aiPulse = seg(t, 6.4, 6.9);
  show.brief = ev(7.2, 7.7); show.recipe = show.brief;
  s.stackLit = lerp(0.3, 1, ev(8.0, 8.8));
  show.lane = ev(8.0, 8.5); show.tex = show.lane; show.core = ev(8.3, 8.8);
  s.gear = ev(9.2, 10.0) * TOOTH * 6;
  show.chip = ev(9.8, 10.1); show.godot = ev(9.6, 10.2);
  show.eye = ev(13.8, 14.4); show.rounds = show.eye;
  show.rev = ev(19.8, 20.3); show.rubric = ev(20.0, 20.4);
  show.review = ev(21.2, 21.6); show.proof = ev(21.7, 22.1); show.lib = ev(22.4, 22.8);
  show.action = ev(26.0, 26.5);

  const first = assets.firstPass, final16 = assets.frame(16), f10 = assets.frame(10);
  const move = (edge, kind, a, b, extra = {}) => s.tokens.push({edge, kind, p: seg(t, a, b), ...extra});
  move('book-ai', 'page', 5.4, 6.4);
  move('req-ai', 'page', 5.5, 6.5);
  move('ai-brief', 'page', 6.7, 7.5);
  move('ai-recipe', 'page', 6.7, 7.5);
  move('recipe-core', 'stack', 8.6, 9.4);
  move('tex-core', 'tex', 8.6, 9.4);
  move('core-godot', 'file', 9.9, 10.6);
  // Round 1 → 2: the actual image goes round the loop to the author, one fix goes back through the build.
  move('loop', 'image', 15.2, 16.0, {image: first, crop: 'compare'});
  move('ai-recipe', 'page', 16.0, 16.3);
  move('recipe-core', 'stack', 16.3, 16.6);
  move('core-godot', 'file', 16.6, 17.0);
  // Round 2 → 3.
  move('loop', 'image', 18.2, 18.9, {image: final16, crop: 'compare'});
  move('ai-recipe', 'page', 18.9, 19.05);
  move('recipe-core', 'stack', 19.05, 19.2);
  move('core-godot', 'file', 19.2, 19.4);
  // Independent branch: final images and the rubric, never the recipe.
  move('godot-rev', 'image', 20.2, 21.0, {image: f10});
  move('rubric-rev', 'rubric', 20.3, 21.0);
  move('rev-review', 'review', 21.2, 21.7);
  move('review-proof', 'review', 21.8, 22.4);
  move('proof-lib', 'review', 22.5, 23.1);
  move('build-lib', 'file', 22.6, 23.4);
  move('lib-action', 'file', 26.4, 27.2);
  s.actionPulse = seg(t, 27.2, 28.0);

  s.rounds = ev(14.0, 14.3) + ev(17.0, 17.3) + ev(19.4, 19.7);
  s.roundHot = t >= 14 && t < 17 ? 0 : t >= 17 && t < 19.4 ? 1 : t >= 19.4 && t < 20 ? 2 : -1;

  // Viewport: saved PNGs labelled with their own capture time (frame / 60), never the film time.
  const v = s.view;
  let f = 0, tag = '';
  if (t < 11.0) f = 0;
  else if (t < 11.5) { f = Math.min(30, Math.floor((t - 11.0) * 60)); tag = `等速 f${f} · ${frameTime(f)}`; }
  else if (t < 11.6) { f = 30; tag = `等速 f30 · ${frameTime(30)}`; }
  else if (t < 13.4) { f = Math.min(30, Math.floor(((t - 11.6) / 1.8) * 31)); tag = `ゆっくり f${f} · ${frameTime(f)}`; }
  else f = 10;
  v.image = assets.frame(f);
  v.crop = 'defender';
  v.label = `f${f} · ${frameTime(f)}`;
  v.tag = tag;
  if (t >= 14 && t < 20) {
    v.crop = 'compare';
    v.image = t < 17 ? first : final16;
    v.tag = t < 17 ? '1回目 f16 · 白い破片' : t < 19.4 ? '2回目 f16 · 青い破片' : '3回目 f16 · 2回目と同じ';
  } else if (t >= 20) {
    v.image = f10;
    v.label = `f10 · ${frameTime(10)}`;
    v.tag = t >= 23.6 && t < 26 ? `実描画 f10 · ${frameTime(10)}` : '';
  }
  v.zoom = ev(10.5, 11.0) * (1 - ev(13.5, 14.0))
    + 0.75 * ev(14.2, 14.6) * (1 - ev(14.9, 15.2))
    + 0.75 * ev(17.1, 17.5) * (1 - ev(17.8, 18.2))
    + ev(23.6, 24.0) * (1 - ev(25.6, 26.0));

  s.focus = t >= 28.4 ? null : FOCUS[sceneIndex(t)];
  return s;
}

function text(str, x, y, size, {weight = 500, align = 'left', color = pal.ink, family = FONT, max} = {}) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  if (max) ctx.fillText(str, x, y, max); else ctx.fillText(str, x, y);
}

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

function drawChrome(t) {
  const index = sceneIndex(t), scene = SCENES[index];
  const reveal = 0.4 + 0.6 * ease(seg(t, scene.at, scene.at + 0.3));
  const [LW] = LOGICAL[orient];
  const wide = orient === 'wide';
  // Seven ticks for the seven scenes.
  const tickW = (LW - 40) / SCENES.length;
  for (let i = 0; i < SCENES.length; i++) {
    ctx.fillStyle = i <= index ? pal.verm : pal.rule;
    ctx.fillRect(20 + i * tickW, wide ? 8 : 14, tickW - 4, 2.5);
  }
  ctx.globalAlpha = reveal;
  if (wide) {
    text(scene.title + (scene.title2 || ''), 16, 34, 20, {weight: 700, family: SERIF, max: scene.sub ? 340 : 608});
    if (scene.sub) text(scene.sub, 624, 34, 13, {align: 'right', color: pal.sub, max: 260});
  } else {
    text(scene.title, 20, 50, 22, {weight: 700, family: SERIF, max: 320});
    if (scene.title2) text(scene.title2, 20, 80, 22, {weight: 700, family: SERIF, max: 320});
    else if (scene.sub) text(scene.sub, 20, 78, 14, {color: pal.sub, max: 320});
  }
  ctx.globalAlpha = 1;
  const actors = t >= 8 && t < 20;
  if (wide) {
    text('効果の画像は Godot で描画・保存したPNG', 16, 354, 11, {color: pal.sub});
    if (actors) text('AIが執筆 / 制作担当が実行', 624, 354, 11, {weight: 700, align: 'right'});
  } else {
    if (actors) text('AIが執筆 / 制作担当が実行', 180, 598, 12, {weight: 700, align: 'center'});
    text('効果の画像は Godot で描画・保存したPNG', 180, 622, 11, {align: 'center', color: pal.sub});
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
    drawMap(ctx, orient, MAP_RECT[orient], filmState(motion), pal, k);
  }
  ctx.restore();
}

window.seek = t => {
  const time = Number(t) || 0;
  if (assets) { draw(time); return Promise.resolve(); }
  return window.motionReady.then(() => draw(time));
};

// ---- Loading (shared 51-file gate) and the editor around the canvas ----

const $ = id => document.getElementById(id);
const status = $('asset-status');
const timeInput = $('time'), clock = $('clock');
const editorControls = rendering ? [] : [
  $('play'), $('reset'), $('replay'), $('end'), timeInput,
  ...document.querySelectorAll('button[data-jump]'), ...document.querySelectorAll('button[data-orient]'),
];
let playing = false, playStart = 0, playFrom = 0, raf = 0;

function setStatus(state, message) {
  if (!status) return;
  status.dataset.state = state;
  status.textContent = message;
}

function load() {
  const mine = ++generation;
  if (controller) controller.abort();
  controller = new AbortController();
  if (assets) { assets.close(); assets = null; }
  stop();
  draw(current);
  for (const control of editorControls) control.disabled = true;
  if ($('retry')) { $('retry').hidden = true; $('retry').disabled = true; }
  setStatus('loading', '固定した51件を確認中');
  const ready = (async () => {
    const loaded = await loadAssets({signal: controller.signal, onProgress(info) {
      if (mine !== generation) return;
      setStatus('loading', info.phase === 'files' ? `確認中 ${info.done}/51` : `画像 ${info.done}/${info.total}`);
    }});
    await document.fonts.ready;
    if (mine !== generation) { loaded.close(); throw new DOMException('superseded', 'AbortError'); }
    assets = loaded;
    draw(current);
  })();
  window.motionReady = ready;
  ready.then(() => {
    if (mine !== generation) return;
    for (const control of editorControls) control.disabled = false;
    setStatus('ready', `51件を確認済み・${orient === 'wide' ? '横長 1280×720' : '縦長 720×1280'}・32秒・30fps・無音`);
    syncClock();
  }, error => {
    if (mine !== generation) return;
    draw(current);
    const reason = error instanceof LoadError ? error.message : '読み込み中に予期しないエラーが起きました';
    setStatus('error', `読み込みを止めました。${reason}。図と画像は表示していません。`);
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
  if (!assets) return;
  playing = true;
  playFrom = from >= DURATION ? 0 : from;
  playStart = performance.now();
  const button = $('play');
  button.textContent = '一時停止';
  button.setAttribute('aria-pressed', 'true');
  raf = requestAnimationFrame(tick);
}

function setOrient(next) {
  orient = next;
  [config.width, config.height] = SIZES[next];
  canvas.width = config.width;
  canvas.height = config.height;
  document.documentElement.dataset.orient = next;
  for (const button of document.querySelectorAll('button[data-orient]')) button.setAttribute('aria-pressed', String(button.dataset.orient === next));
  if (assets) setStatus('ready', `51件を確認済み・${next === 'wide' ? '横長 1280×720' : '縦長 720×1280'}・32秒・30fps・無音`);
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
  for (const button of document.querySelectorAll('button[data-orient]')) {
    button.addEventListener('click', () => { stop(); setOrient(button.dataset.orient); });
  }
  $('retry').addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });
  for (const button of document.querySelectorAll('button[data-orient]')) button.setAttribute('aria-pressed', String(button.dataset.orient === orient));
}

load();
