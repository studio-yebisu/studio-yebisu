// 解説動画の編集用ソース：Motion Reel の時刻の契約と、ネイティブのプレビュー操作。
// 照合は作例ページと同じ ../app.js の verifyAll / loadMedia。合わなければ描かずに止める。音は扱わない。

import { verifyAll, loadMedia, VerifyError } from '../app.js';
import { DURATION, drawFilm, sceneIndexAt, validateStoryboard } from './draw.js';

const SIZES = { portrait: [720, 1280], wide: [1280, 720] };
const $ = (s) => document.querySelector(s);
const canvas = $('#film');
const ctx = canvas.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const isRender = () => Boolean(window.__MOTION_RENDER__);

const rc = window.renderConfig && Number(window.renderConfig.width) > 0 && Number(window.renderConfig.height) > 0
  ? window.renderConfig : null;
const query = new URLSearchParams(location.search);
let orient = rc ? (Number(rc.width) > Number(rc.height) ? 'wide' : 'portrait') : (query.get('orient') === 'wide' ? 'wide' : 'portrait');
let size = rc ? [Math.round(Number(rc.width)), Math.round(Number(rc.height))] : SIZES[orient];

window.motionConfig = {
  duration: DURATION,
  fps: rc && Number(rc.fps) > 0 ? Number(rc.fps) : 30,
  width: size[0],
  height: size[1],
  posterTime: 31,
  audioEvents: [],
};

const els = {
  play: $('#ed-play'),
  replay: $('#ed-replay'),
  start: $('#ed-start'),
  end: $('#ed-end'),
  scrub: $('#ed-scrub'),
  time: $('#ed-time'),
  retry: $('#ed-retry'),
  detail: $('#ed-state-detail'),
  inventory: $('#ed-inventory'),
};
const orientButtons = [...document.querySelectorAll('button[data-orient]')];
const sceneButtons = [...document.querySelectorAll('#ed-scenes button')];
const controls = [els.play, els.replay, els.start, els.end, els.scrub, els.time, ...orientButtons, ...sceneButtons];

const state = { model: null, media: null, story: null, t: 0, playing: false, raf: 0, base: 0, baseT: 0, token: 0 };

if (isRender()) document.body.classList.add('render');

function applySize() {
  canvas.width = size[0];
  canvas.height = size[1];
  canvas.style.aspectRatio = `${size[0]} / ${size[1]}`;
  window.motionConfig.width = size[0];
  window.motionConfig.height = size[1];
  document.body.dataset.orient = orient;
  orientButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === orient)));
}

function draw() {
  if (!state.model) return;
  drawFilm(ctx, state.model, state.media, state.story, state.t, { width: size[0], height: size[1] });
}

function syncUI() {
  els.scrub.value = state.t.toFixed(1);
  els.scrub.setAttribute('aria-valuetext', `${state.t.toFixed(1)}秒`);
  if (document.activeElement !== els.time) els.time.value = state.t.toFixed(1);
  els.play.setAttribute('aria-pressed', String(state.playing));
  els.play.textContent = state.playing ? '一時停止' : '再生';
  if (state.story) {
    const si = sceneIndexAt(state.story, state.t);
    sceneButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === si)));
  }
}

function setTime(v) {
  state.t = Math.min(DURATION, Math.max(0, Number.isFinite(v) ? v : 0));
  syncUI();
}

function pause() {
  state.playing = false;
  cancelAnimationFrame(state.raf);
  state.raf = 0;
  syncUI();
}

function loop(now) {
  if (!state.playing) return;
  setTime(state.baseT + (now - state.base) / 1000);
  draw();
  if (state.t >= DURATION) {
    pause();
    return;
  }
  state.raf = requestAnimationFrame(loop);
}

function play() {
  if (isRender() || !state.model) return;
  if (state.t >= DURATION) setTime(0);
  state.playing = true;
  state.base = performance.now();
  state.baseT = state.t;
  syncUI();
  state.raf = requestAnimationFrame(loop);
}

function setDisabled(on) {
  controls.forEach((c) => { c.disabled = on; });
  if (rc) orientButtons.forEach((b) => { b.disabled = true; });
}

function clearAll() {
  pause();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  els.inventory.replaceChildren();
  if (state.media) state.media.revoke();
  state.media = null;
  state.model = null;
  setDisabled(true);
}

async function fetchStory() {
  let res;
  try {
    res = await fetch(new URL('./storyboard.json', import.meta.url), { cache: 'no-store' });
  } catch {
    throw new VerifyError('絵コンテを読めません', 'video/storyboard.json を取得できませんでした');
  }
  if (!res.ok) throw new VerifyError('絵コンテを読めません', `video/storyboard.json: HTTP ${res.status}`);
  let story;
  try {
    story = await res.json();
  } catch {
    throw new VerifyError('絵コンテを読めません', 'video/storyboard.json を JSON として読めません');
  }
  validateStoryboard(story);
  return story;
}

async function load() {
  const token = ++state.token;
  clearAll();
  els.retry.hidden = true;
  document.body.dataset.state = 'loading';
  els.detail.textContent = '保存済みのファイルを確かめています…';
  try {
    const story = await fetchStory();
    const model = await verifyAll((done, total) => {
      if (token === state.token && document.body.dataset.state === 'loading') {
        els.detail.textContent = `保存済みのファイルを確かめています… ${done}/${total}`;
      }
    });
    const media = await loadMedia(model);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    if (token !== state.token) {
      media.revoke();
      return;
    }
    state.story = story;
    state.model = model;
    state.media = media;
    sceneButtons.forEach((b, i) => {
      const s = story.scenes[i];
      b.setAttribute('aria-label', `場面${i + 1} ${s.kicker}：${s.caption}（${s.start}秒から）`);
      b.title = `${s.kicker}：${s.caption}`;
    });
    els.inventory.replaceChildren(...model.manifest.assets.map((a) => {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = a.path;
      li.append(code, ` ${a.bytes.toLocaleString('ja-JP')} B・${a.sha256.slice(0, 12)}…`);
      return li;
    }));
    setDisabled(false);
    document.body.dataset.state = 'ready';
    els.detail.textContent = `${model.manifest.count}ファイルの大きさと SHA-256、引用、記録どうしを自動で照合しました。人の目視の承認ではありません。`;
    draw();
    syncUI();
    if (!isRender() && !reduce.matches) play();
  } catch (e) {
    if (token !== state.token) return;
    clearAll();
    const err = e instanceof VerifyError ? e : new VerifyError('表示を準備できません', String(e && e.message || e));
    document.body.dataset.state = 'failed';
    els.detail.textContent = `${err.message}。描画を止めています：${err.detail}`;
    els.retry.hidden = false;
    els.retry.disabled = false;
    throw err;
  }
}

function start() {
  window.motionReady = load();
  window.motionReady.catch(() => {});
  return window.motionReady;
}

// 任意の時刻を、それまでの順番に関係なく描く。
window.seek = async (seconds) => {
  await window.motionReady;
  if (isRender()) {
    document.body.classList.add('render');
    pause();
  }
  setTime(Number(seconds));
  draw();
};

els.play.addEventListener('click', () => (state.playing ? pause() : play()));
els.replay.addEventListener('click', () => {
  pause();
  setTime(0);
  draw();
  play();
});
els.start.addEventListener('click', () => {
  pause();
  setTime(0);
  draw();
});
els.end.addEventListener('click', () => {
  pause();
  setTime(DURATION);
  draw();
});
els.scrub.addEventListener('input', () => {
  const next = Number(els.scrub.value);
  pause();
  setTime(next);
  draw();
});

const commitTime = () => {
  const v = Number.parseFloat(String(els.time.value).replace(',', '.'));
  if (Number.isFinite(v)) {
    pause();
    setTime(v);
    draw();
  }
  els.time.value = state.t.toFixed(1);
};
els.time.addEventListener('change', commitTime);
els.time.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    commitTime();
  }
});
els.time.addEventListener('blur', () => { els.time.value = state.t.toFixed(1); });

orientButtons.forEach((b) => b.addEventListener('click', () => {
  if (rc) return;
  orient = b.dataset.orient === 'wide' ? 'wide' : 'portrait';
  size = SIZES[orient];
  applySize();
  draw();
  const url = new URL(location.href);
  url.searchParams.set('orient', orient);
  history.replaceState(null, '', url);
}));

sceneButtons.forEach((b, i) => b.addEventListener('click', () => {
  if (!state.story) return;
  pause();
  setTime(state.story.scenes[i].start);
  draw();
}));

els.retry.addEventListener('click', () => { start(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

applySize();
syncUI();
start();
