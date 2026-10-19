/*
 * PDF Creator 作例：32秒・無音の動く図（編集ソース）
 * 読み込みと図は ../concept.js と共有する。window.seek(秒) は、呼び出し順・fps・壁時計に関係なく、
 * その時刻の完成した1枚を毎回はじめから描く。プレビューの再生（requestAnimationFrame）は seek の外だけで動く。
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 */
import { loadVerified, drawFrame, SCENES, DURATION, FILM_PALETTE, sceneIndex } from '../concept.js';

const RENDER = window.__MOTION_RENDER__ === true;
const SIZES = { portrait: [720, 1280], wide: [1280, 720] };

const config = { duration: DURATION, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: [] };
const requested = window.renderConfig || {};
if (Number.isInteger(requested.width) && requested.width > 0) config.width = requested.width;
if (Number.isInteger(requested.height) && requested.height > 0) config.height = requested.height;
if (Number.isInteger(requested.fps) && requested.fps > 0) config.fps = requested.fps;
window.motionConfig = config;

const $ = id => document.getElementById(id);
const canvas = $('stage');
const statusEl = $('asset-status'), dimsEl = $('asset-dims'), retryEl = $('retry');
const timeEl = $('time'), clockEl = $('clock'), playEl = $('play');
const jumpButtons = [...document.querySelectorAll('button[data-jump]')];
const orientButtons = [...document.querySelectorAll('button[data-orient]')];
const controls = [playEl, $('reset'), $('replay'), $('end'), timeEl, ...jumpButtons, ...orientButtons];

let model = null, current = config.posterTime, playing = false, raf = 0, startWall = 0, attempt = 0;

const layout = () => (config.width > config.height ? 'wide' : 'tall');
const clampTime = seconds => {
  const n = Number(seconds);
  return Number.isFinite(n) ? Math.min(DURATION, Math.max(0, n)) : 0;
};

function paint(t) {
  if (canvas.width !== config.width) canvas.width = config.width;
  if (canvas.height !== config.height) canvas.height = config.height;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!model) return;
  drawFrame(ctx, model, { width: canvas.width, height: canvas.height, layout: layout(), t, palette: FILM_PALETTE, film: true });
}

window.seek = async function seek(seconds) {
  if (!model) throw new Error('照合済みの素材がないため描画できません。再読み込みしてください。');
  const t = clampTime(seconds);
  current = t;
  paint(t);
  timeEl.value = t.toFixed(1);
  clockEl.textContent = `${t.toFixed(1)} / ${DURATION.toFixed(1)} 秒・場面 ${sceneIndex(t) + 1}/${SCENES.length}`;
};

function showDims() {
  if (!model) { dimsEl.textContent = ''; return; }
  const pages = [...model.variants.paper.pages, ...model.variants.phone.pages];
  dimsEl.textContent = `出力 ${config.width}×${config.height}・${config.fps}fps・${DURATION}秒・音声なし ／ ページ画像 ${pages.map(p => `${p.width}×${p.height}`).join('・')}`;
}

function syncOrient() {
  const name = config.width > config.height ? 'wide' : 'portrait';
  for (const button of orientButtons) button.setAttribute('aria-pressed', String(button.dataset.orient === name));
}

function setStatus(state, message) {
  statusEl.dataset.state = state;
  statusEl.textContent = message;
}

function enable(on) {
  for (const control of controls) control.disabled = !on;
}

function stop() {
  playing = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  playEl.textContent = '再生';
}

function play() {
  if (!model || RENDER) return;
  if (current >= DURATION) current = 0;
  playing = true;
  playEl.textContent = '一時停止';
  startWall = performance.now() - current * 1000;
  const tick = now => {
    if (!playing) return;
    const t = (now - startWall) / 1000;
    if (t >= DURATION) {
      window.seek(DURATION);
      stop();
      return;
    }
    window.seek(t);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

async function loadStoryboard() {
  let response;
  try {
    response = await fetch(new URL('./storyboard.json', import.meta.url), { cache: 'no-store' });
  } catch {
    throw new Error('video/storyboard.json を読み込めません。作例フォルダーをHTTPで配信して開いてください。');
  }
  if (!response.ok) throw new Error(`video/storyboard.json の読み込みに失敗しました（HTTP ${response.status}）。`);
  let board;
  try {
    board = await response.json();
  } catch {
    throw new Error('video/storyboard.json がJSONとして読めません。');
  }
  const f = board && board.format;
  if (!f || f.duration !== DURATION || f.fps !== 30 || f.width !== 720 || f.height !== 1280 || f.posterTime !== 31 ||
    f.audio !== 'none' || !Array.isArray(f.audioEvents) || f.audioEvents.length !== 0) {
    throw new Error('video/storyboard.json の書式（32秒・30fps・720×1280・ポスター31秒・音声なし）が違います。');
  }
  if (!Array.isArray(board.scenes) || board.scenes.length !== SCENES.length ||
    board.scenes.some((scene, i) => scene.id !== SCENES[i].id || scene.start !== SCENES[i].start || scene.title !== SCENES[i].title)) {
    throw new Error('video/storyboard.json の場面（id・開始秒・見出し）が concept.js の SCENES と一致しません。');
  }
  if (jumpButtons.length !== SCENES.length || jumpButtons.some((button, i) => Number(button.dataset.jump) !== SCENES[i].start)) {
    throw new Error('場面へ移動するボタンの秒数が場面の開始秒と一致しません。');
  }
  return board;
}

/** 23ファイルの照合・ページ画像のデコード・フォント・場面の記録がそろうと解決し、どれかが欠けると失敗する。 */
function prepare() {
  const run = ++attempt;
  stop();
  model = null;
  enable(false);
  retryEl.hidden = true;
  showDims();
  paint(current);
  setStatus('loading', '保存済みの23ファイルと場面の記録を照合しています…');
  const ready = (async () => {
    try {
      const [loaded] = await Promise.all([
        loadVerified((done, total) => { if (run === attempt && statusEl.dataset.state === 'loading') setStatus('loading', `保存済みのファイルを照合中：${done} / ${total}`); }),
        loadStoryboard(),
        document.fonts.ready,
      ]);
      if (run !== attempt) throw new Error('新しい読み込みに置き換わりました。');
      model = loaded;
      setStatus('ready', '照合済み：23ファイル・ページ画像3枚のデコード・場面の記録。この画面はPDFを生成しません。');
      showDims();
      enable(!RENDER);
      await window.seek(RENDER ? 0 : config.posterTime);
    } catch (error) {
      if (run === attempt) {
        model = null;
        stop();
        enable(false);
        paint(0);
        showDims();
        setStatus('error', `準備を止めました：${error instanceof Error ? error.message : String(error)}`);
        retryEl.hidden = false;
      }
      throw error;
    }
  })();
  window.motionReady = ready;
  ready.catch(() => {});
  return ready;
}

playEl.addEventListener('click', () => (playing ? stop() : play()));
$('reset').addEventListener('click', () => { stop(); window.seek(0); });
$('replay').addEventListener('click', () => { stop(); window.seek(0); play(); });
$('end').addEventListener('click', () => { stop(); window.seek(DURATION); });
timeEl.addEventListener('input', () => { stop(); window.seek(timeEl.value); });
for (const button of jumpButtons) button.addEventListener('click', () => { stop(); window.seek(Number(button.dataset.jump)); });
for (const button of orientButtons) button.addEventListener('click', () => {
  if (RENDER) return;
  stop();
  [config.width, config.height] = SIZES[button.dataset.orient];
  syncOrient();
  showDims();
  window.seek(current);
});
retryEl.addEventListener('click', () => { prepare(); });

syncOrient();
prepare();
