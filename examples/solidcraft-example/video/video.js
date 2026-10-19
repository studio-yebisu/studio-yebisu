// 無音32秒の構造図の動画ソース。図・ローダーは ../concept.js と共通。
// seek(秒) はその時刻の画を背景から描き直すだけで、前の画・呼んだ順番・壁時計・fps に左右されない。

import {loadConcept, drawConcept, sceneAt, FILM, FILM_SCENES, PALETTES, ASSET_COUNT} from '../concept.js?v=visual-r1';

const RENDER = Boolean(window.__MOTION_RENDER__);
const given = window.renderConfig || {};
const positive = value => Number.isFinite(value) && value > 0;
const SIZES = {portrait: [FILM.width, FILM.height], wide: [FILM.height, FILM.width]};

let [width, height] = SIZES[new URLSearchParams(location.search).get('orient') === 'wide' ? 'wide' : 'portrait'];
if (positive(given.width) && positive(given.height)) {
  width = Math.round(given.width);
  height = Math.round(given.height);
}
const fps = positive(given.fps) ? Math.round(given.fps) : FILM.fps;

window.motionConfig = {duration: FILM.duration, fps, width, height, posterTime: FILM.posterTime, audioEvents: []};

const canvas = document.getElementById('film');
const stage = document.getElementById('stage');
const controls = document.getElementById('controls');
const statusEl = document.getElementById('asset-status');
const dimsEl = document.getElementById('asset-dims');
const retry = document.getElementById('retry');
const play = document.getElementById('play');
const reset = document.getElementById('reset');
const replay = document.getElementById('replay');
const end = document.getElementById('end');
const timeInput = document.getElementById('time');
const clock = document.getElementById('clock');
const jumps = Array.from(document.querySelectorAll('button[data-jump]'));
const orients = Array.from(document.querySelectorAll('button[data-orient]'));
const timed = [play, reset, replay, end, timeInput, ...jumps];

let model = null;
let generation = 0;
let current = FILM.posterTime;
let playing = false;
let startedAt = 0;
let frame = 0;

const clampTime = seconds => Math.min(FILM.duration, Math.max(0, Number(seconds) || 0));

function sizeCanvas() {
  canvas.width = width;
  canvas.height = height;
  window.motionConfig.width = width;
  window.motionConfig.height = height;
  dimsEl.textContent = `${width}×${height}・${fps}fps・${FILM.duration}秒・無音（音声トラックなし）`;
  fit();
}

function fit() {
  if (RENDER) {
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    return;
  }
  const room = Math.max(200, window.innerHeight - 40);
  const k = Math.min(1, (stage.clientWidth || window.innerWidth) / width, room / height);
  canvas.style.width = Math.floor(width * k) + 'px';
  canvas.style.height = Math.floor(height * k) + 'px';
}

function clear() {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function paint(t) {
  const ctx = canvas.getContext('2d');
  drawConcept(ctx, {width, height, dpr: 1, palette: PALETTES.light, model, scene: sceneAt(t), film: true});
}

window.seek = seconds => {
  if (!model) return Promise.reject(new Error('素材の検証が終わっていないため描画できません'));
  const t = clampTime(seconds);
  paint(t);
  return Promise.resolve(t);
};

function setStatus(state, message) {
  statusEl.dataset.state = state;
  statusEl.textContent = message;
}

function setTimed(enabled) {
  timed.forEach(control => { control.disabled = !enabled; });
}

function load() {
  const mine = ++generation;
  stop();
  model = null;
  clear();
  setTimed(false);
  retry.hidden = true;
  setStatus('loading', `保存データ${ASSET_COUNT}件の大きさとSHA-256を確かめています（0/${ASSET_COUNT}）`);
  const ready = (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const loaded = await loadConcept({
      onProgress: (done, total) => {
        if (mine === generation && statusEl.dataset.state === 'loading') {
          setStatus('loading', `保存データ${total}件の大きさとSHA-256を確かめています（${done}/${total}）`);
        }
      }
    });
    if (mine !== generation) throw new Error('新しい読み込みに置き換えました');
    model = loaded;
    setStatus('ready', `${loaded.numbers.assets}ファイル確認済み・PNG 4枚を展開済み`);
    setTimed(true);
    show(current);
  })();
  ready.catch(error => {
    if (mine !== generation) return;
    model = null;
    stop();
    clear();
    setTimed(false);
    setStatus('error', `描画できません：${error && error.message ? error.message : error}`);
    retry.hidden = false;
  });
  window.motionReady = ready;
  return ready;
}

// ---- プレビューの再生（書き出しでは使わない） ----

function show(t) {
  current = clampTime(t);
  timeInput.value = current.toFixed(1);
  clock.textContent = `${current.toFixed(1)} / ${FILM.duration.toFixed(1)} 秒`;
  if (model) window.seek(current);
}

function stop() {
  playing = false;
  cancelAnimationFrame(frame);
  play.textContent = '再生';
  play.setAttribute('aria-pressed', 'false');
}

function tick(now) {
  if (!playing) return;
  const t = (now - startedAt) / 1000;
  if (t >= FILM.duration) {
    show(FILM.duration);
    stop();
    return;
  }
  show(t);
  frame = requestAnimationFrame(tick);
}

function start(from) {
  if (!model) return;
  if (from != null) show(from);
  if (current >= FILM.duration - 0.05) show(0);
  playing = true;
  startedAt = performance.now() - current * 1000;
  play.textContent = '一時停止';
  play.setAttribute('aria-pressed', 'true');
  frame = requestAnimationFrame(tick);
}

sizeCanvas();

if (RENDER) {
  document.body.classList.add('render');
  controls.hidden = true;
  load();
} else {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  play.addEventListener('click', () => (playing ? stop() : start()));
  reset.addEventListener('click', () => { stop(); show(0); });
  replay.addEventListener('click', () => { stop(); start(0); });
  end.addEventListener('click', () => { stop(); show(FILM.duration); });
  timeInput.addEventListener('input', () => { stop(); show(Number(timeInput.value)); });
  jumps.forEach(button => button.addEventListener('click', () => { stop(); show(Number(button.dataset.jump)); }));
  orients.forEach(button => button.addEventListener('click', () => {
    const [w, h] = SIZES[button.dataset.orient === 'wide' ? 'wide' : 'portrait'];
    width = w;
    height = h;
    orients.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    sizeCanvas();
    if (model) window.seek(current); else clear();
  }));
  orients.forEach(b => b.setAttribute('aria-pressed', String((b.dataset.orient === 'wide') === (width > height))));
  retry.addEventListener('click', () => load());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  reduce.addEventListener('change', () => { if (reduce.matches) stop(); });
  window.addEventListener('resize', fit);
  // 場面のボタンの時刻は concept.js の FILM_SCENES と同じ
  jumps.forEach((button, i) => {
    const scene = FILM_SCENES[i];
    if (scene) button.title = `${scene.at}秒から`;
  });
  load();
}
