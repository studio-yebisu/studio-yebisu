// 解説動画の編集用ソース：Motion Reel の時刻の契約と、プレビューの操作。
// 音は作らない・鳴らさない（audioEvents は空、<audio> も読み上げもない）。実出力のMP4/WAVは照合するだけで再生しない。

import { verifyAll, loadMedia, VerifyError, MANIFEST_COUNT } from '../app.js';
import { DURATION, SCENES, drawFrame } from './draw.js';

const SIZES = { portrait: [720, 1280], wide: [1280, 720] };
const RENDER = Boolean(window.__MOTION_RENDER__);

const cfg = { duration: DURATION, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: [] };
const rc = window.renderConfig;
const positive = (v) => Number.isFinite(Number(v)) && Number(v) > 0;
if (rc && positive(rc.width) && positive(rc.height)) {
  cfg.width = Math.round(Number(rc.width));
  cfg.height = Math.round(Number(rc.height));
}
if (rc && positive(rc.fps)) cfg.fps = Number(rc.fps);
if (!rc) {
  const q = new URLSearchParams(location.search).get('orient');
  if (q === 'wide') [cfg.width, cfg.height] = SIZES.wide;
}
window.motionConfig = cfg;

const $ = (s) => document.querySelector(s);
const canvas = $('#film');
const ctx = canvas.getContext('2d');
const els = {
  play: $('#ed-play'), replay: $('#ed-replay'), start: $('#ed-start'), end: $('#ed-end'),
  time: $('#ed-time'), scrub: $('#ed-scrub'), detail: $('#ed-state-detail'), retry: $('#ed-retry'),
  inventory: $('#ed-inventory'), count: $('#ed-count'),
};
const orientButtons = [...document.querySelectorAll('button[data-orient]')];
const sceneButtons = [...document.querySelectorAll('button[data-scene]')];
const controls = [els.play, els.replay, els.start, els.end, els.time, els.scrub, ...orientButtons, ...sceneButtons];

const state = { model: null, media: null, t: 0, playing: false, raf: 0, base: 0, baseT: 0, token: 0 };
const orientOf = () => (cfg.width > cfg.height ? 'wide' : 'portrait');

if (RENDER) document.body.classList.add('render');

const setControls = (on) => controls.forEach((c) => { c.disabled = !on; });

const sizeCanvas = () => {
  canvas.width = cfg.width;
  canvas.height = cfg.height;
  document.body.dataset.orient = orientOf();
  orientButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === orientOf())));
};

const paint = (t) => {
  const i = drawFrame(ctx, state.model, state.media, { orient: orientOf(), t, width: cfg.width, height: cfg.height });
  sceneButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.scene) === i)));
  if (!RENDER) {
    els.scrub.value = t.toFixed(1);
    if (document.activeElement !== els.time) els.time.value = t.toFixed(1);
  }
};

const clampT = (s) => Math.min(DURATION, Math.max(0, Number.isFinite(Number(s)) ? Number(s) : 0));

const stop = () => {
  state.playing = false;
  cancelAnimationFrame(state.raf);
  state.raf = 0;
  els.play.setAttribute('aria-pressed', 'false');
  els.play.textContent = '再生';
};

const show = (t) => {
  state.t = clampT(t);
  paint(state.t);
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
  if (RENDER || !state.model) return;
  if (state.t >= DURATION) state.t = 0;
  state.playing = true;
  state.base = performance.now();
  state.baseT = state.t;
  els.play.setAttribute('aria-pressed', 'true');
  els.play.textContent = '一時停止';
  state.raf = requestAnimationFrame(tick);
};

const clearCanvas = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const fail = (e) => {
  stop();
  clearCanvas();
  if (state.media) state.media.revoke();
  state.model = null;
  state.media = null;
  setControls(false);
  els.inventory.replaceChildren();
  els.count.textContent = '—';
  const err = e instanceof VerifyError ? e : new VerifyError('準備できません', String((e && e.message) || e));
  document.body.dataset.state = 'failed';
  els.detail.textContent = `${err.message}：${err.detail}。描かずに止めています。`;
  els.retry.hidden = false;
  els.retry.disabled = false;
};

const load = () => {
  const token = ++state.token;
  stop();
  clearCanvas();
  if (state.media) state.media.revoke();
  state.model = null;
  state.media = null;
  setControls(false);
  els.retry.hidden = true;
  els.retry.disabled = true;
  els.inventory.replaceChildren();
  document.body.dataset.state = 'loading';
  els.detail.textContent = '保存済みのファイルを確かめています…';
  const ready = (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const model = await verifyAll((done, total) => {
      if (token === state.token && !RENDER && document.body.dataset.state === 'loading') els.detail.textContent = `保存済みのファイルを確かめています… ${done}/${total}`;
    });
    if (model.manifest.files.length !== MANIFEST_COUNT) throw new VerifyError('素材の数が違います', `${model.manifest.files.length} 件`);
    const media = await loadMedia(model);
    if (token !== state.token) {
      media.revoke();
      throw new VerifyError('読み込みをやり直しました', '古い読み込みは使いません');
    }
    state.model = model;
    state.media = media;
    sizeCanvas();
    show(state.t);
    els.count.textContent = String(model.manifest.files.length);
    els.inventory.replaceChildren(...model.manifest.files.map((a) => {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = a.path;
      li.append(code, ` ${a.bytes.toLocaleString('ja-JP')} B`);
      return li;
    }));
    setControls(true);
    document.body.dataset.state = 'ready';
    els.detail.textContent = `${model.manifest.files.length}ファイルを照合しました（自動の照合で、描画や書き出しの確認ではありません）。`;
    return true;
  })();
  ready.catch((e) => {
    if (token === state.token) fail(e);
  });
  window.motionReady = ready;
  return ready;
};

// 時刻だけから完成した画を描く。準備が失敗していれば描かずに失敗を返す。
window.seek = async (seconds) => {
  await window.motionReady;
  if (!state.model) throw new VerifyError('準備ができていません', '照合が終わっていません');
  stop();
  show(seconds);
};

els.play.addEventListener('click', () => (state.playing ? stop() : play()));
els.replay.addEventListener('click', () => {
  stop();
  show(0);
  play();
});
els.start.addEventListener('click', () => {
  stop();
  show(0);
});
els.end.addEventListener('click', () => {
  stop();
  show(DURATION);
});
// 次の値を先に読み、そのあとで止める（止める処理が操作部を古い時刻へ戻さないように）。
els.scrub.addEventListener('input', () => {
  const next = Number(els.scrub.value);
  stop();
  show(next);
});
els.time.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  ev.preventDefault();
  const next = clampT(String(els.time.value).replace(',', '.'));
  stop();
  show(next);
  els.time.value = next.toFixed(1);
});
els.time.addEventListener('blur', () => { els.time.value = state.t.toFixed(1); });
sceneButtons.forEach((b) => b.addEventListener('click', () => {
  stop();
  show(SCENES[Number(b.dataset.scene)].start);
}));
orientButtons.forEach((b) => b.addEventListener('click', () => {
  const keep = state.t;
  const was = state.playing;
  stop();
  [cfg.width, cfg.height] = SIZES[b.dataset.orient];
  sizeCanvas();
  show(keep);
  if (was) play();
}));
els.retry.addEventListener('click', () => { load(); });

sizeCanvas();
load();
