// 解説動画の編集用ソース：Motion Reel の時刻の契約と、プレビューの操作。
// window.renderConfig を最初に読み、motionConfig・motionReady・seek(秒) を用意する。
// 音は作らない・鳴らさない（audioEvents は空。audio要素も読み上げもない）。モデルや公開デモは呼ばない。

import { loadVerified, VerifyError, MANIFEST_COUNT, IMAGE_PATH, formatNumber } from '../app.js';
import { DURATION, drawFrame, validateStoryboard } from './draw.js';

const SIZES = { portrait: [720, 1280], landscape: [1280, 720] };
const RENDER = Boolean(window.__MOTION_RENDER__) || /[?&]render=/.test(location.search);

const cfg = { duration: DURATION, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: [] };
const rc = window.renderConfig;
const positiveInt = (v) => Number.isInteger(Number(v)) && Number(v) > 0;
if (rc && typeof rc === 'object') {
  if (positiveInt(rc.width) && positiveInt(rc.height)) {
    cfg.width = Number(rc.width);
    cfg.height = Number(rc.height);
  }
  if (positiveInt(rc.fps)) cfg.fps = Number(rc.fps);
} else if (new URLSearchParams(location.search).get('orient') === 'landscape') {
  [cfg.width, cfg.height] = SIZES.landscape;
}
window.motionConfig = cfg;

let ready = null;
const newReady = () => {
  let res, rej;
  const promise = new Promise((a, b) => { res = a; rej = b; });
  promise.catch(() => {});
  ready = { res, rej };
  window.motionReady = promise;
};
newReady();

const $ = (s) => document.querySelector(s);
const canvas = $('#film');
const ctx = canvas.getContext('2d');
const els = {
  play: $('#ed-play'), replay: $('#ed-replay'), start: $('#ed-start'), end: $('#ed-end'), time: $('#ed-time'),
  scrub: $('#ed-scrub'), detail: $('#ed-state-detail'), retry: $('#ed-retry'), inventory: $('#ed-inventory'), count: $('#ed-count'),
};
const orientButtons = [...document.querySelectorAll('button[data-orient]')];
const sceneButtons = [...document.querySelectorAll('button[data-scene]')];
const controls = [els.play, els.replay, els.start, els.end, els.time, els.scrub, ...orientButtons, ...sceneButtons];
const state = { data: null, t: 0, playing: false, raf: 0, base: 0, baseT: 0, token: 0, ctrl: null, imageUrl: '' };

const orientOf = () => (cfg.width > cfg.height ? 'landscape' : 'portrait');
const clampT = (s) => Math.min(DURATION, Math.max(0, Number.isFinite(Number(s)) ? Number(s) : 0));
const setControls = (on) => controls.forEach((c) => { c.disabled = !on; });

const sizeCanvas = () => {
  if (canvas.width !== cfg.width) canvas.width = cfg.width;
  if (canvas.height !== cfg.height) canvas.height = cfg.height;
  document.body.dataset.orient = orientOf();
  orientButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === orientOf())));
};

const paint = (t) => {
  if (!state.data) return;
  const i = drawFrame(ctx, state.data, { orient: orientOf(), t, width: canvas.width, height: canvas.height });
  if (RENDER) return;
  sceneButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.scene) === i)));
  els.scrub.value = t.toFixed(1);
  if (document.activeElement !== els.time) els.time.value = t.toFixed(1);
};

const show = (t) => {
  state.t = clampT(t);
  paint(state.t);
};

const stop = () => {
  state.playing = false;
  cancelAnimationFrame(state.raf);
  state.raf = 0;
  els.play.setAttribute('aria-pressed', 'false');
  els.play.textContent = '再生';
};

const tick = (now) => {
  if (!state.playing) return;
  const t = state.baseT + (now - state.base) / 1000;
  if (t >= DURATION) {
    show(DURATION);
    stop();
    return;
  }
  show(t);
  state.raf = requestAnimationFrame(tick);
};

const play = () => {
  if (RENDER || !state.data) return;
  if (state.t >= DURATION) show(0);
  state.playing = true;
  state.base = performance.now();
  state.baseT = state.t;
  els.play.setAttribute('aria-pressed', 'true');
  els.play.textContent = '一時停止';
  state.raf = requestAnimationFrame(tick);
};

// 任意の時刻の完成した1コマを描く。呼んだ順番・前のコマ・壁時計には依存しない。
window.seek = async (seconds) => {
  await window.motionReady;
  show(seconds);
};

const forgetImage = () => {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = '';
};

const fillInventory = (model) => {
  els.inventory.replaceChildren();
  for (const f of model.manifest.files) {
    const li = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = ` ${formatNumber(f.bytes)} B・${f.sha256.slice(0, 12)}…`;
    li.append(document.createTextNode(`✓ ${f.path}`), code);
    els.inventory.append(li);
  }
  els.count.textContent = `${model.manifest.files.length}/${MANIFEST_COUNT}`;
};

const setLoading = () => {
  stop();
  state.data = null;
  forgetImage();
  setControls(false);
  els.inventory.replaceChildren();
  els.count.textContent = `0/${MANIFEST_COUNT}`;
  els.retry.hidden = true;
  document.body.dataset.state = 'loading';
  els.detail.textContent = `保存済みの${MANIFEST_COUNT}ファイルを、大きさとSHA-256で確かめています…`;
};

const fail = (reason) => {
  stop();
  state.data = null;
  forgetImage();
  setControls(false);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  els.inventory.replaceChildren();
  els.count.textContent = `0/${MANIFEST_COUNT}`;
  document.body.dataset.state = 'failed';
  els.detail.textContent = `確認できなかったため、描画と操作を止めました。理由：${reason}`;
  els.retry.hidden = RENDER;
};

const loadStoryboard = async (signal) => {
  let res;
  try {
    res = await fetch(new URL('./storyboard.json', import.meta.url), { cache: 'no-store', credentials: 'same-origin', signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new VerifyError('video/storyboard.json を読み込めません（通信に失敗）');
  }
  if (!res.ok) throw new VerifyError(`video/storyboard.json を読み込めません（HTTP ${res.status}）`);
  let sb;
  try { sb = await res.json(); } catch { throw new VerifyError('video/storyboard.json をJSONとして読めません'); }
  return validateStoryboard(sb);
};

const load = async () => {
  const token = ++state.token;
  state.ctrl?.abort();
  const ctrl = new AbortController();
  state.ctrl = ctrl;
  const mine = ready;
  setLoading();
  try {
    const model = await loadVerified({ signal: ctrl.signal });
    const storyboard = await loadStoryboard(ctrl.signal);
    if (token !== state.token) return;
    const url = URL.createObjectURL(new Blob([model.files.get(IMAGE_PATH)], { type: 'image/png' }));
    state.imageUrl = url;
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new VerifyError('PNGを画像として読めません'); }
    await document.fonts.ready;
    if (token !== state.token) return;
    state.data = { model, storyboard, image };
    fillInventory(model);
    sizeCanvas();
    document.body.dataset.state = 'ready';
    els.detail.textContent = `${MANIFEST_COUNT}ファイルを照合しました。描いているのは保存済みの実データと説明の形です。`;
    setControls(!RENDER);
    show(state.t);
    mine.res();
  } catch (e) {
    if (token !== state.token || e?.name === 'AbortError') return;
    fail(e instanceof VerifyError ? e.message : '予期しない理由で準備を終えられませんでした');
    mine.rej(e instanceof Error ? e : new Error(String(e)));
  }
};

if (!RENDER) {
  els.play.addEventListener('click', () => (state.playing ? stop() : play()));
  els.replay.addEventListener('click', () => { stop(); show(0); play(); });
  els.start.addEventListener('click', () => { stop(); show(0); });
  els.end.addEventListener('click', () => { stop(); show(DURATION); });
  els.scrub.addEventListener('input', () => {
    const v = Number(els.scrub.value); // 一時停止で表示が変わる前に、つまみの値を読む
    stop();
    show(v);
  });
  els.time.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = Number(String(els.time.value).trim().replace(',', '.'));
    if (!Number.isFinite(v)) { els.time.value = state.t.toFixed(1); return; }
    stop();
    show(v);
    els.time.value = state.t.toFixed(1);
  });
  sceneButtons.forEach((b) => b.addEventListener('click', () => {
    const sc = state.data?.storyboard.scenes[Number(b.dataset.scene)];
    if (!sc) return;
    stop();
    show(sc.start);
  }));
  orientButtons.forEach((b) => b.addEventListener('click', () => {
    const size = SIZES[b.dataset.orient];
    if (!size || !state.data) return;
    [cfg.width, cfg.height] = size;
    sizeCanvas();
    if (state.playing) { state.base = performance.now(); state.baseT = state.t; }
    paint(state.t);
  }));
  els.retry.addEventListener('click', () => { newReady(); load(); });
}

sizeCanvas();
setControls(false);
load();
