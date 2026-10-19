// 32秒・無音の解説映像の編集ページ。図は ../concept.js の drawMap() で描き、seek(秒) は時刻だけから完成した画面を返す。
// 書き出し（window.__MOTION_RENDER__）では操作を隠し、プレビューの再生（requestAnimationFrame）を動かさない。
import { loadEvidence, drawMap, DURATION, SCENES, EvidenceError } from '../concept.js';

const SIZES = { portrait: [720, 1280], wide: [1280, 720] };
const rendering = Boolean(window.__MOTION_RENDER__);
const config = window.motionConfig;
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
const status = document.getElementById('asset-status');
const dims = document.getElementById('asset-dims');
const retryBtn = document.getElementById('retry');
const controls = document.getElementById('controls');

let ev = null;
let ready = null;
let fps = config.fps;
let current = 0;

// レンダラーが渡す大きさとFPSを使う。縦なら tall、横なら wide の配置で描き直す（縮小ではない）。
const rc = window.renderConfig;
const valid = n => Number.isInteger(n) && n > 0 && n <= 8192;
let [width, height] = rc && valid(rc.width) && valid(rc.height) ? [rc.width, rc.height] : [config.width, config.height];
if (rc && Number.isFinite(rc.fps) && rc.fps > 0) fps = rc.fps;

function applySize(w, h) {
  width = w; height = h;
  Object.assign(config, { width: w, height: h, fps });
  canvas.width = w; canvas.height = h;
  if (rendering) { canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
  showDims();
}
function showDims() {
  dims.textContent = `${width}×${height}・${fps}fps・${DURATION}秒・音声なし${ev ? '・記録25件のSHA-256一致・実フレーム5枚（1920×1080）を復号' : ''}`;
}
function blank() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
function paint(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawMap(ctx, canvas.width, canvas.height, t, { ev, layout: canvas.height > canvas.width ? 'tall' : 'wide' });
}
function setStatus(state, message) {
  status.dataset.state = state;
  status.textContent = message;
  retryBtn.hidden = state !== 'error';
  showDims();
}

async function prepare() {
  ev = null;
  blank();
  setStatus('loading', '25件の記録のバイト数とSHA-256、実フレーム5枚を確かめています…');
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const loaded = await loadEvidence('../');
    ev = loaded;
    paint(current);
    setStatus('ready', '準備完了：記録と実フレームを確認しました。');
  } catch (error) {
    ev = null;
    blank();
    setStatus('error', error instanceof EvidenceError ? error.message : '記録の確認中に予期しない問題が起きました。もう一度読み込んでください。');
    throw error;
  }
}
function boot() {
  const p = prepare();
  p.catch(() => {});
  ready = p;
  return p;
}

applySize(width, height);
const first = boot();
if (window.__motionSettle) {
  first.then(window.__motionSettle.resolve, window.__motionSettle.reject);
  delete window.__motionSettle;
} else window.motionReady = first;

/** 任意の時刻 seconds（0–32）の完成した画面を描く。呼び出しの順番・FPS・壁時計に依らない。 */
window.seek = seconds => {
  const s = Number(seconds);
  if (!Number.isFinite(s)) return Promise.reject(new RangeError('seek(seconds) には有限の秒数を渡してください。'));
  const t = Math.min(DURATION, Math.max(0, s));
  return ready.then(() => {
    try { paint(t); } catch (error) { blank(); throw error; }
    current = t;
    showClock(t);
    return t;
  });
};

retryBtn.addEventListener('click', () => {
  pause();
  window.motionReady = boot();
});

// ---- プレビューだけの操作（書き出しでは使わない）
const playBtn = document.getElementById('play');
const range = document.getElementById('time');
const clock = document.getElementById('clock');
let raf = 0;
let startAt = 0;

function showClock(t) {
  if (rendering) return;
  range.value = t.toFixed(1);
  clock.textContent = `${t.toFixed(1)} / ${DURATION.toFixed(1)}秒`;
}
function pause() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  playBtn.textContent = '再生';
  playBtn.setAttribute('aria-pressed', 'false');
}
function play() {
  if (rendering || !ev) return;
  pause();
  if (current >= DURATION) current = 0;
  startAt = performance.now() - current * 1000;
  playBtn.textContent = '一時停止';
  playBtn.setAttribute('aria-pressed', 'true');
  const step = now => {
    const t = Math.min(DURATION, (now - startAt) / 1000);
    paint(t);
    current = t;
    showClock(t);
    if (t >= DURATION) { pause(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
const jumpTo = s => { pause(); window.seek(s).catch(() => {}); };

if (rendering) {
  document.documentElement.classList.add('render');
  controls.hidden = true;
} else {
  playBtn.addEventListener('click', () => (raf ? pause() : play()));
  document.getElementById('reset').addEventListener('click', () => jumpTo(0));
  document.getElementById('end').addEventListener('click', () => jumpTo(DURATION));
  document.getElementById('replay').addEventListener('click', () => {
    pause();
    window.seek(0).then(play, () => {});
  });
  range.addEventListener('input', () => jumpTo(Number(range.value)));
  // 場面と縦横は、それぞれの操作の群の中のボタンだけが受け持つ（状態表示の data-* では動かない）。
  const sceneTimes = new Set(SCENES.map(s => s.t));
  controls.querySelectorAll('.jumps > button[data-jump]').forEach(b => {
    const s = Number(b.getAttribute('data-jump'));
    if (sceneTimes.has(s)) b.addEventListener('click', () => jumpTo(s));
  });
  const orientButtons = [...controls.querySelectorAll('.orient > button[data-orient]')];
  orientButtons.forEach(b => b.addEventListener('click', () => {
    const size = SIZES[b.getAttribute('data-orient')];
    if (!size) return;
    pause();
    applySize(size[0], size[1]);
    orientButtons.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    if (ev) paint(current); else blank();
  }));
  const startWide = width > height;
  orientButtons.forEach(o => o.setAttribute('aria-pressed', String((o.getAttribute('data-orient') === 'wide') === startWide)));
  showClock(0);
}
