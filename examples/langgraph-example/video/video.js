// Studio Yebisu: LangGraph 32 s silent film source (visual-r1).
// The same connected map as ../index.html, drawn by the shared module at any time t. Native layouts for portrait
// 720×1280 and wide 1280×720, 30 fps, 960 frames, no audio. Every value on the state card and in the strip is read
// from the original saved checkpoints; nothing here runs Python, LangGraph or a model.

import {
  loadAssets, drawMap, runState, caseFacts, PALETTES, FONT, SERIF, LoadError, PART_FOCUS, CASE_IDS, TOTAL_FILES, seg, ease,
} from '../concept.js?v=visual-r1';

const DURATION = 32, FPS = 30, POSTER = 31, MOTION_END = 28.9;
const SIZES = {portrait: [720, 1280], wide: [1280, 720]};
const LOGICAL = {portrait: [360, 640], wide: [640, 360]};
const MAP_RECT = {portrait: {x: 8, y: 92, w: 344, h: 436}, wide: {x: 8, y: 42, w: 624, h: 272}};
const STRIP = {portrait: {x: 14, y: 540, w: 332, h: 52}, wide: {x: 30, y: 318, w: 580, h: 26}};
const pal = PALETTES.light;

// Scenes start at the seven jump points (0, 4, 8, 14, 20, 26, 29). The closing line fades in from 28.4 so that
// nothing changes after 28.9 s.
const SCENES = [
  {at: 0, title: 'LangGraphは、Pythonの部品集'},
  {at: 4, title: 'AIが書き、制作担当が動かす'},
  {at: 8, title: '申請Aが道をたどり、止まる'},
  {at: 14, title: 'テスト値で、reviewの先頭から'},
  {at: 20, title: '同じグラフで、別の申請'},
  {at: 26, title: '最終stateを保存して開く'},
  {at: 28.4, title: 'state＋関数＋分岐', title2: '＋止めて、続ける'},
];
// 0–4 s: the six explanatory parts light up one after another on the same picture.
const INTRO = [
  [0.3, 'state', 'StateGraph：共有state＋5つの関数'],
  [1.0, 'edges', 'add_conditional_edges：入力で道を分ける'],
  [1.6, 'compile', 'compile → invoke'],
  [2.2, 'memory', 'InMemorySaver：同じプロセスのメモリ'],
  [2.8, 'interrupt', 'interrupt：reviewで止める'],
  [3.4, 'resume', 'Command：回答で続きを動かす'],
];
const SAVE_FOCUS = ['card', 'finalize', 'end', 'record', 'viewer', 'e:finalize-end', 'e:end-record', 'e:record-viewer'];

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

function intro(s, t) {
  const ev = (a, b) => ease(seg(t, a, b));
  for (const id of ['book', 'req', 'ai', 'wf', 'op']) s.show[id] = 0;
  s.show.title = ev(0.1, 0.5);
  for (const id of ['start', 'validate', 'estimate', 'review', 'finalize', 'end']) s.show[id] = ev(0.3, 0.9);
  s.show.fork = ev(1.0, 1.3);
  s.show.needs = s.show.end2 = ev(1.1, 1.4);
  s.show.compile = s.show.invoke = ev(1.6, 1.9);
  s.show.shelf = ev(2.2, 2.5);
  s.show.reply = ev(3.4, 3.7);
  s.show.record = s.show.viewer = ev(3.6, 3.9);
  s.card.alpha = ev(0.4, 0.9);
  // The gate closes once, briefly, to show what interrupt does; no job is stopped yet.
  s.gate = ev(2.9, 3.1) * (1 - ev(3.25, 3.4));
  let part = null;
  for (const [at, id] of INTRO) if (t >= at) part = id;
  s.focus = part ? PART_FOCUS[part] : null;
}

function authoring(s, t) {
  const ev = (a, b) => ease(seg(t, a, b));
  s.show.book = s.show.req = ev(4.0, 4.4);
  s.show.ai = ev(4.3, 4.7);
  s.show.wf = ev(4.9, 5.3);
  s.show.op = ev(5.4, 5.8);
}

// The whole picture at time t, from t alone (no wall clock, no accumulation, no randomness).
function filmState(t) {
  const {approved: A, missing: B, rejected: C} = assets.jobs;
  const saved = assets.sheets;
  // Threads that already ran keep their saved snapshots in the same in-memory tray; later threads are still empty.
  const sheets = {approved: t >= 20 ? saved.approved : 0, missing: t >= 22.3 ? saved.missing : 0, rejected: 0};
  let s;
  if (t < 4) {
    s = runState(A, 0, 0, sheets);
    intro(s, t);
  } else if (t < 8) {
    s = runState(A, 0, t - 4.2, sheets);
    authoring(s, t);
  } else if (t < 14) {
    s = runState(A, 1, t - 8.2, sheets);
  } else if (t < 20) {
    s = runState(A, 2, t - 14.2, sheets);
  } else if (t < 22.3) {
    s = runState(B, 1, (t - 20.1) * 1.4, sheets);
    s.card.alpha = ease(seg(t, 20.0, 20.35));
    s.focus = null;
  } else if (t < 24.6) {
    s = runState(C, 1, (t - 22.4) * 2, sheets);
    s.card.alpha = ease(seg(t, 22.3, 22.6));
    s.focus = null;
  } else if (t < 26.2) {
    s = runState(C, 2, (t - 24.6) * 2, sheets);
    s.focus = null;
  } else {
    s = runState(C, 2, Math.min(5, 3.2 + (t - 26.2)), sheets);
    s.focus = t < 28.4 ? SAVE_FOCUS : null;
  }
  return s;
}

function subtitle(t) {
  const A = caseFacts(assets.jobs.approved), C = caseFacts(assets.jobs.rejected);
  if (t < 0.3) return 'AIモデルやホストAPIではない';
  if (t < 4) {
    let sub = '';
    for (const [at, , line] of INTRO) if (t >= at) sub = line;
    return sub;
  }
  if (t < 8) return '原典API＋依頼文 → workflow.py → Python実行';
  if (t < 12.6) return `validate → estimate ${A.value} → reviewで停止`;
  if (t < 14) return '完全な申請は金額にかかわらず停止';
  if (t < 20) return `Command(resume=テスト値 ${A.reply}) → 同じthread A`;
  if (t < 22.3) return 'B：返却日が空 → needs_input・停止なし';
  if (t < 26) return `C：${C.value}・予算フラグは目印だけ → ${C.reply} → ${C.status}`;
  if (t < 28.4) return `concept/jobs/${assets.jobs.rejected.id}.json → 元の実データ`;
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
    ctx.fillStyle = i <= index ? pal.blue : pal.rule;
    ctx.fillRect(20 + i * tickW, wide ? 8 : 14, tickW - 4, 2.5);
  }
  const sub = subtitle(t);
  ctx.globalAlpha = reveal;
  if (wide) {
    text(scene.title + (scene.title2 || ''), 16, 32, 20, {weight: 700, family: SERIF, max: sub ? 300 : 608});
    if (sub) text(sub, 624, 32, 13, {align: 'right', color: pal.sub, max: 300});
  } else {
    text(scene.title, 20, 50, 22, {weight: 700, family: SERIF, max: 320});
    if (scene.title2) text(scene.title2, 20, 80, 22, {weight: 700, family: SERIF, max: 320});
    else if (sub) text(sub, 20, 77, 13, {color: pal.sub, max: 320});
  }
  ctx.globalAlpha = 1;
}

// Final field values of the three saved jobs, each appearing when its run in the film is finished.
function drawStrip(t) {
  const R = STRIP[orient];
  const wide = orient === 'wide';
  const gap = wide ? 10 : 6, cw = (R.w - gap * 2) / 3;
  const appear = {
    approved: ease(seg(t, 18.1, 18.6)),
    missing: ease(seg(t, 22.0, 22.4)),
    rejected: ease(seg(t, 26.8, 27.3)),
  };
  CASE_IDS.forEach((id, i) => {
    const f = caseFacts(assets.jobs[id]);
    const x = R.x + i * (cw + gap), y = R.y;
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.card; ctx.fillRect(x, y, cw, R.h);
    ctx.lineWidth = 1; ctx.strokeStyle = pal.rule; ctx.strokeRect(x, y, cw, R.h);
    text(f.letter, x + 8, y + (wide ? 18 : 16), 13, {weight: 700, color: pal.blue});
    ctx.globalAlpha = appear[id];
    if (wide) {
      text(f.status, x + 24, y + 18, 12, {weight: 700, max: cw * 0.5});
      text(f.value, x + cw - 8, y + 18, 12, {align: 'right', max: cw * 0.4});
    } else {
      text(f.label, x + 22, y + 16, 11, {color: pal.sub, max: cw - 28});
      text(f.status, x + 8, y + 33, 13, {weight: 700, max: cw - 14});
      text(f.value, x + 8, y + 47, 12, {max: cw - 14});
    }
    ctx.globalAlpha = 1;
  });
}

function drawFoot() {
  if (orient === 'wide') {
    text('規則処理・保存記録の図解・回答はテスト値・同じプロセスのメモリ', 320, 355, 11, {align: 'center', color: pal.sub});
  } else {
    text('規則処理・保存記録の図解', 180, 614, 11, {align: 'center', color: pal.sub});
    text('回答はテスト値・同じプロセスのメモリ', 180, 630, 11, {align: 'center', color: pal.sub});
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

// ---- Loading (shared 21-file gate) and the editor around the canvas ----

const $ = id => document.getElementById(id);
const status = $('asset-status');
const timeInput = $('time'), clock = $('clock');
const editorControls = rendering ? [] : [
  $('play'), $('reset'), $('replay'), $('end'), timeInput,
  ...document.querySelectorAll('button[data-jump]'), ...document.querySelectorAll('button[data-orient]'),
];
let playing = false, playStart = 0, playFrom = 0, raf = 0;

const readyLine = () => `${TOTAL_FILES}件を確認済み・${orient === 'wide' ? '横長 1280×720' : '縦長 720×1280'}・32秒・30fps・無音`;

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

function setOrient(next) {
  orient = next;
  [config.width, config.height] = SIZES[next];
  canvas.width = config.width;
  canvas.height = config.height;
  document.documentElement.dataset.orient = next;
  for (const button of document.querySelectorAll('button[data-orient]')) button.setAttribute('aria-pressed', String(button.dataset.orient === next));
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
  for (const button of document.querySelectorAll('button[data-orient]')) {
    button.addEventListener('click', () => { stop(); setOrient(button.dataset.orient); });
  }
  $('retry').addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });
  for (const button of document.querySelectorAll('button[data-orient]')) button.setAttribute('aria-pressed', String(button.dataset.orient === orient));
}

load();
