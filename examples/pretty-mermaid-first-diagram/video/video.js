// Pretty Mermaid の32秒・無音の解説映像（編集ソース）。Studio Yebisu（MIT License）。
// window.seek(seconds) は時刻だけから完成した1枚を描き直す。前のフレーム・呼び出し順・壁時計・fpsに依存しない。
// 図は ../concept.js の共有ローダーで検証した保存済みの原出力だけを使う。音声・ナレーション・モデル呼び出しはない。
import { loadVerifiedBundle, computeLayout, drawConcept, PALETTES, span, LoadError, MANIFEST_FILE_COUNT } from '../concept.js?v=visual-r1-final';

// 場面の正本。storyboard.json は同じ時刻を説明する写しで、描画には読み込まない。
export const SCENES = [
  { t: 0, label: '指示書と依頼', focus: ['book', 'request'] },
  { t: 4, label: '作者AIが.mmdを書く', focus: ['book', 'request', 'author', 'source', 'settings', 'operator'] },
  { t: 8, label: '制作担当がCLIへ渡す', focus: ['operator', 'settings', 'source', 'cli', 'cli.read', 'cli.bm'] },
  { t: 14, label: 'SVG・PNG・文字図の3経路', focus: ['cli', 'tiles'] },
  { t: 20, label: '別工程で読んで照合', focus: ['check', 'source', 'tiles'] },
  { t: 26, label: '用途で使い分ける', focus: ['check', 'use', 'source', 'tiles'] },
  { t: 29, label: '全体の地図', focus: null },
];

// 部品が現れる時刻（秒）。0.6秒かけて現れる。
const REVEAL = {
  book: -1, request: -1, author: 3.4, settings: 4.3, source: 4.9, operator: 6.9,
  cli: 8.5, 'cli.read': 9.3, 'cli.bm': 10.3, 'cli.svg': 13.5, 'cli.ascii': 13.6, 'cli.png': 15.0, 'cli.resvg': 15.9,
  'tile.svgLight': 14.4, 'tile.svgDark': 14.5, 'tile.png': 14.6, 'tile.text': 14.7,
  check: 19.8, use: 25.8,
};
const FILM_CASE = 'flow';
const DURATION = 32;

const renderMode = Boolean(window.__MOTION_RENDER__) || /[?&]render(=|&|$)/.test(location.search);
const requested = window.renderConfig || {};
const evenSize = v => Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0;
const config = { duration: DURATION, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: [] };
if (evenSize(requested.width)) config.width = requested.width;
if (evenSize(requested.height)) config.height = requested.height;
if (Number.isInteger(requested.fps) && requested.fps >= 1 && requested.fps <= 120) config.fps = requested.fps;
window.motionConfig = config;

const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
let bundle = null;
let attempt = 0;

function sizeCanvas() {
  canvas.width = config.width;
  canvas.height = config.height;
  canvas.style.aspectRatio = `${config.width} / ${config.height}`;
}

const sceneIndex = t => {
  let i = 0;
  while (i + 1 < SCENES.length && t >= SCENES[i + 1].t) i += 1;
  return i;
};
const member = (scene, id, group) => !scene.focus || scene.focus.includes(id) || Boolean(group && scene.focus.includes(group));

function frameState(t) {
  const i = sceneIndex(t);
  const scene = SCENES[i];
  const blend = i === 0 ? 1 : span(t, scene.t, scene.t + 0.6);
  return {
    P: PALETTES.light,
    clock: t,
    reveal: id => (id in REVEAL ? span(t, REVEAL[id], REVEAL[id] + 0.6) : 1),
    focusWeight: (id, group) => {
      const now = member(scene, id, group) ? 1 : 0;
      if (i === 0) return now;
      const before = member(SCENES[i - 1], id, group) ? 1 : 0;
      return before + (now - before) * blend;
    },
    part: null,
    partNodes: null,
    caseData: bundle.caseById[FILM_CASE],
    theme: 'light',
    format: null,
    selected: null,
    title: { index: i, total: SCENES.length, label: scene.label },
  };
}

function clampTime(seconds) {
  const t = Number(seconds);
  return Number.isFinite(t) ? Math.min(DURATION, Math.max(0, t)) : 0;
}

function paint(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawConcept(ctx, computeLayout(config.width, config.height), frameState(t));
}

function clearCanvas() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

window.seek = seconds => {
  if (!bundle) return Promise.reject(new Error('素材の検証が終わっていないため、この時刻を描けません。'));
  paint(clampTime(seconds));
  return Promise.resolve();
};

// ───────── 確認用の操作（書き出しには含めない） ─────────
const $ = id => document.getElementById(id);
const ui = {
  status: $('asset-status'), dims: $('asset-dims'), retry: $('retry'), play: $('play'), reset: $('reset'),
  replay: $('replay'), end: $('end'), time: $('time'), clock: $('clock'),
};
const jumps = [...document.querySelectorAll('button[data-jump]')];
const orients = [...document.querySelectorAll('button[data-orient]')];
const timeline = [ui.play, ui.reset, ui.replay, ui.end, ui.time, ...jumps, ...orients].filter(Boolean);
let playing = false;
let raf = 0;
let startedAt = 0;
let current = 0;

function setStatus(state, text) {
  if (!ui.status) return;
  ui.status.dataset.state = state;
  ui.status.textContent = text;
}

function setControls(on) {
  timeline.forEach(control => { control.disabled = !on; });
}

function describeDims() {
  if (ui.dims) ui.dims.textContent = `${config.width}×${config.height}・${config.fps}fps・${DURATION}秒・無音`;
}

function show(t) {
  current = clampTime(t);
  paint(current);
  if (ui.time) ui.time.value = String(current);
  if (ui.clock) ui.clock.value = `${current.toFixed(1)} / ${DURATION.toFixed(1)}秒`;
  const i = sceneIndex(current);
  jumps.forEach((button, k) => button.setAttribute('aria-current', String(k === i)));
}

function stop() {
  playing = false;
  cancelAnimationFrame(raf);
  raf = 0;
  if (ui.play) {
    ui.play.textContent = '再生';
    ui.play.setAttribute('aria-pressed', 'false');
  }
}

function tick(now) {
  if (!playing || !bundle || window.__MOTION_RENDER__) {
    stop();
    return;
  }
  const t = (now - startedAt) / 1000;
  if (t >= DURATION) {
    show(DURATION);
    stop();
    return;
  }
  show(t);
  raf = requestAnimationFrame(tick);
}

function play() {
  if (!bundle || renderMode || window.__MOTION_RENDER__) return;
  if (current >= DURATION) current = 0;
  playing = true;
  startedAt = performance.now() - current * 1000;
  ui.play.textContent = '一時停止';
  ui.play.setAttribute('aria-pressed', 'true');
  raf = requestAnimationFrame(tick);
}

function setOrientation(kind) {
  if (renderMode) return;
  stop();
  const wide = kind === 'wide';
  config.width = wide ? 1280 : 720;
  config.height = wide ? 720 : 1280;
  orients.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.orient === kind)));
  document.documentElement.dataset.orient = kind;
  sizeCanvas();
  describeDims();
  if (bundle) show(current);
}

function start() {
  const mine = ++attempt;
  stop();
  bundle = null;
  clearCanvas();
  setControls(false);
  if (ui.retry) ui.retry.hidden = true;
  setStatus('loading', `保存済みの${MANIFEST_FILE_COUNT}ファイルを検証しています…`);
  const ready = (async () => {
    const verified = await loadVerifiedBundle({
      onProgress: (done, total) => {
        if (mine === attempt && ui.status?.dataset.state === 'loading') setStatus('loading', `保存済みのファイルを検証しています… ${done}/${total}`);
      },
    });
    if (document.fonts?.ready) await document.fonts.ready;
    if (mine !== attempt) throw new Error('新しい読み込みに置き換えられました。');
    bundle = verified;
    setStatus('ready', '28ファイルのSHA-256とPNGの読み込みを確認済み。保存済みの原出力だけで描きます。');
    setControls(true);
    show(current);
  })();
  ready.catch(error => {
    if (mine !== attempt) return;
    bundle = null;
    stop();
    clearCanvas();
    setControls(false);
    setStatus('error', `描画を止めました：${error instanceof LoadError ? error.message : '保存済みファイルを確かめられませんでした。'}`);
    if (ui.retry) ui.retry.hidden = false;
  });
  window.motionReady = ready;
}

sizeCanvas();
describeDims();
if (renderMode) document.documentElement.classList.add('render');
document.documentElement.dataset.orient = config.width > config.height ? 'wide' : 'portrait';
orients.forEach(button => button.setAttribute('aria-pressed', String((button.dataset.orient === 'wide') === (config.width > config.height))));

ui.play?.addEventListener('click', () => (playing ? stop() : play()));
ui.reset?.addEventListener('click', () => { stop(); show(0); });
ui.replay?.addEventListener('click', () => { stop(); show(0); play(); });
ui.end?.addEventListener('click', () => { stop(); show(DURATION); });
ui.time?.addEventListener('input', () => { stop(); show(Number(ui.time.value)); });
jumps.forEach(button => button.addEventListener('click', () => { stop(); show(Number(button.dataset.jump)); }));
orients.forEach(button => button.addEventListener('click', () => setOrientation(button.dataset.orient)));
ui.retry?.addEventListener('click', start);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

start();
