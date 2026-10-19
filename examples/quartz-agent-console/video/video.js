// Silent 32-second film of the Quartz concept map.
// window.seek(seconds) redraws one complete frame from the time alone: no timers, no randomness,
// no CSS animation and no dependence on earlier frames. Loading and drawing come from ../concept.js.
import {loadBundle, LoadError, drawMap, makeLayout, palette, seg, ease} from '../concept.js?v=visual-r1-r2';

const RENDER = !!window.__MOTION_RENDER__;
const DURATION = 32;
const SIZES = {portrait: [720, 1280], wide: [1280, 720]};

const config = {duration: DURATION, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: []};
const rc = window.renderConfig;
if (rc && typeof rc === 'object') {
  for (const k of ['width', 'height', 'fps']) if (Number.isFinite(rc[k]) && rc[k] > 0) config[k] = rc[k];
}
window.motionConfig = config;

// Scene times are shared with storyboard.json and the jump buttons.
export const SCENES = [
  {at: 0, title: '指示書と依頼を読む', sub: 'SKILL.mdの8手順と規則、そして短い依頼文'},
  {at: 4, title: '同じ作者AIが書き、別工程で確かめる', sub: '作者はReact・文言・fixture、制作担当は配置とlint・build'},
  {at: 8, title: 'body.quartzの範囲と役割トークン', sub: 'トークンが8部品の見た目へ。テーマはApp.themeで明示切替'},
  {at: 14, title: '押した段のidがAppへ戻る', sub: 'fixture → toSpans → Timeline、onSpanClick → openSteps'},
  {at: 20, title: '選んだ段の入力と出力を読む', sub: '静的サンプル：完了、失敗（systems/ なし・404）、入力待ち'},
  {at: 26, title: 'JSONを渡し、実物で操作する', sub: '事例全体のJSONをブラウザーへ。保存完了は確かめない'},
  {at: 29, title: 'Quartz＝指示書＋トークン＋React部品＋lint', sub: 'AIモデルや実行基盤ではありません'},
];

const sceneIndex = t => { let i = 0; SCENES.forEach((s, k) => { if (t >= s.at) i = k; }); return i; };

// Everything on screen at time t, as plain values.
export function stateAt(t) {
  const s = {caseId: 'completed', stepId: null, p: 0, sel: 1, regrow: 1, part: null, emph: null, appTheme: 'light', bookLit: undefined, rulesLit: undefined, inset: 0};
  const i = sceneIndex(t);
  if (i === 0) {
    s.p = 0.3 * seg(t, 0.3, 3.7);
    s.bookLit = 8 * ease(seg(t, 0.4, 2.6));
    s.rulesLit = 7 * ease(seg(t, 1.6, 3.7));
    s.emph = ['author'];
    s.part = t >= 0.6 ? 'instructions' : null;
  } else if (i === 1) {
    s.p = 0.3 + 0.7 * seg(t, 4.2, 7.7);
    s.emph = ['author', 'gate'];
    s.part = t >= 6.3 ? 'check' : null;
  } else if (i === 2) {
    s.p = 1 + 0.25 * seg(t, 8.2, 10.6);
    s.emph = ['scope'];
    s.part = t < 9.8 ? 'scope' : t < 12.6 ? 'tokens' : 'components';
    s.appTheme = t >= 11.2 && t < 12.4 ? 'dark' : 'light';
  } else if (i === 3) {
    s.p = 1.25 + 0.75 * seg(t, 14.3, 19.2);
    s.emph = ['scope', 'detail'];
    s.part = t >= 16.8 ? 'selection' : null;
  } else if (i === 4) {
    s.emph = ['detail', 'scope'];
    if (t < 21.8) {
      s.p = 2 + 0.4 * seg(t, 20.1, 21.6);
    } else {
      s.p = 2.4;
      s.caseId = t < 23.9 ? 'tool-failed' : 'waiting-input';
      s.sel = seg(t, t < 23.9 ? 21.9 : 24, t < 23.9 ? 23.1 : 25.2);
      s.regrow = seg(s.sel, 0, 0.3);
    }
  } else if (i === 5) {
    s.sel = seg(t, 26, 26.7);
    s.regrow = seg(s.sel, 0, 0.3);
    s.p = 2.4 + 0.6 * seg(t, 26.8, 28.7);
    s.emph = ['out', 'scope'];
    s.inset = seg(t, 27.6, 28.1) * (1 - seg(t, 28.75, 29));
  } else {
    s.p = 3;
  }
  return s;
}

// ---- drawing one frame ----

const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",system-ui,sans-serif';
function text(ctx, s, x, y, {size = 11, weight = 400, color, align = 'left', maxW} = {}) {
  let sz = size;
  ctx.font = `${weight} ${sz}px ${SANS}`;
  if (maxW) while (sz > 9 && ctx.measureText(s).width > maxW) { sz -= 0.5; ctx.font = `${weight} ${sz}px ${SANS}`; }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function drawInset(ctx, shot, x, y, w, h, a, pal) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = pal.paper;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 22);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 22);
  const sh = Math.min(shot.height, shot.width * (h / w));
  ctx.drawImage(shot.img, 0, 0, shot.width, sh, x, y, w, h);
  text(ctx, '元の画面の撮影（実物は desk.html）', x, y + h + 9, {size: 10, color: pal.t2, maxW: w});
  ctx.restore();
}

function drawFrame(ctx, bundle, W, H, t) {
  const wide = W >= H;
  const pal = palette('light');
  const s = stateAt(t), i = sceneIndex(t), scene = SCENES[i];
  const scale = W / (wide ? 720 : 360);
  const dW = wide ? 720 : 360, dH = H / scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, dW, dH);

  const top = wide ? 46 : 88, bottomBand = wide ? 20 : 46;
  if (wide) {
    text(ctx, `${i + 1}/7`, 8, 16, {size: 11, color: pal.t3});
    text(ctx, scene.title, 34, 16, {size: 15, weight: 700, color: pal.ink, maxW: dW - 42});
    text(ctx, scene.sub, 34, 34, {size: 11, color: pal.t2, maxW: dW - 42});
  } else {
    text(ctx, 'Quartz のしくみ', 8, 16, {size: 11, weight: 600, color: pal.t2});
    text(ctx, `${i + 1}/7`, dW - 8, 16, {size: 11, color: pal.t3, align: 'right'});
    text(ctx, scene.title, 8, 42, {size: 17, weight: 700, color: pal.ink, maxW: dW - 16});
    text(ctx, scene.sub, 8, 66, {size: 12, color: pal.t2, maxW: dW - 16});
  }

  const mapH = dH - top - bottomBand;
  const L = makeLayout(wide ? 'wide' : 'portrait', dW, mapH);
  ctx.save();
  ctx.translate(0, top);
  drawMap(ctx, L, {bundle, theme: 'light', ...s});
  if (s.inset > 0) {
    const shot = bundle.images.light;
    // A small proof inset over the (dimmed) book; the real components stay in desk.html.
    if (wide) drawInset(ctx, shot, L.book.x + 4, L.book.y + 4, L.book.w - 8, L.book.h - 24, s.inset, pal);
    else drawInset(ctx, shot, L.book.x + 4, L.book.y + 4, Math.min(170, L.book.w - 8), L.book.h - 24, s.inset, pal);
  }
  ctx.restore();

  const fy = dH - bottomBand / 2;
  if (t >= 8) text(ctx, '表示は静的サンプル・秒は架空の時刻', 8, fy, {size: wide ? 10 : 11, color: pal.t2, maxW: dW * 0.7});
  text(ctx, 'Studio Yebisu', dW - 8, fy, {size: wide ? 10 : 11, color: pal.t3, align: 'right'});
}

// ---- load, verify, seek ----

const root = document.documentElement;
const canvas = document.getElementById('film');
const ui = {
  status: document.getElementById('asset-status'), dims: document.getElementById('asset-dims'), retry: document.getElementById('retry'),
  play: document.getElementById('play'), reset: document.getElementById('reset'), replay: document.getElementById('replay'),
  end: document.getElementById('end'), time: document.getElementById('time'), clock: document.getElementById('clock'),
};
const jumps = Array.from(document.querySelectorAll('button[data-jump]'));
const orients = Array.from(document.querySelectorAll('button[data-orient]'));
let bundle = null, verified = false, current = 0, gen = 0, playing = false, raf = 0, startAt = 0;

const clampTime = v => Math.min(DURATION, Math.max(0, Number(v) || 0));

function sizeCanvas() {
  if (canvas.width !== config.width) canvas.width = config.width;
  if (canvas.height !== config.height) canvas.height = config.height;
  root.dataset.orient = config.width >= config.height ? 'wide' : 'portrait';
  orients.forEach(o => o.setAttribute('aria-pressed', String(o.dataset.orient === root.dataset.orient)));
  if (ui.dims) ui.dims.textContent = `${config.width}×${config.height}、${config.fps}fps、${DURATION}秒、無音`;
}

function clearCanvas() {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

window.seek = function seek(seconds) {
  if (!verified || !bundle) return Promise.reject(new Error('素材の確認が済んでいないため描画できません。'));
  current = clampTime(seconds);
  sizeCanvas();
  drawFrame(canvas.getContext('2d'), bundle, config.width, config.height, current);
  if (!RENDER) {
    if (ui.time) ui.time.value = String(Math.round(current * 10) / 10);
    if (ui.clock) ui.clock.value = `${current.toFixed(1)} / ${DURATION.toFixed(1)}秒`;
  }
  return Promise.resolve();
};

function setControls(on) {
  for (const el of [ui.play, ui.reset, ui.replay, ui.end, ui.time, ...jumps]) if (el) el.disabled = !on;
}

function setStatus(state, message) {
  root.dataset.state = state;
  if (!ui.status) return;
  ui.status.dataset.state = state;
  ui.status.textContent = message;
}

function stop() {
  playing = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (ui.play) { ui.play.textContent = '再生'; ui.play.setAttribute('aria-pressed', 'false'); }
}

// Preview playback lives outside seek and never runs while rendering.
function tick(now) {
  raf = 0;
  if (!playing || RENDER) return;
  const t = (now - startAt) / 1000;
  if (t >= DURATION) { window.seek(DURATION).catch(() => {}); stop(); return; }
  window.seek(t).catch(stop);
  raf = requestAnimationFrame(tick);
}

function play(from) {
  if (RENDER || !verified) return;
  const t0 = from >= DURATION ? 0 : from;
  playing = true;
  startAt = performance.now() - t0 * 1000;
  if (ui.play) { ui.play.textContent = '一時停止'; ui.play.setAttribute('aria-pressed', 'true'); }
  raf = requestAnimationFrame(tick);
}

function startLoad() {
  const mine = ++gen;
  stop();
  verified = false;
  if (bundle) { bundle.dispose(); bundle = null; }
  sizeCanvas();
  clearCanvas();
  setControls(false);
  if (ui.retry) ui.retry.hidden = true;
  setStatus('loading', '素材30件を確かめています（0/30）');
  const ready = (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const b = await loadBundle({
      onProgress(done, total) {
        if (mine === gen && root.dataset.state === 'loading') setStatus('loading', `素材を確かめています（${done}/${total}）`);
      },
    });
    if (mine !== gen) { b.dispose(); throw new Error('新しい読み込みに置き換えました。'); }
    bundle = b;
    verified = true;
    return b;
  })();
  window.motionReady = ready;
  ready.then(() => {
    if (mine !== gen) return;
    setStatus('ready', '素材30件の大きさとSHA-256、撮影画像2枚の復号を確かめました。');
    setControls(true);
    window.seek(RENDER ? config.posterTime : current);
  }, err => {
    if (mine !== gen) return;
    verified = false;
    if (bundle) { bundle.dispose(); bundle = null; }
    stop();
    clearCanvas();
    setControls(false);
    setStatus('error', `${err instanceof LoadError ? err.message : '素材を読み込めませんでした。'} 描画を止めています。`);
    if (ui.retry) { ui.retry.hidden = false; ui.retry.disabled = false; }
  });
  return ready;
}

if (!RENDER) {
  ui.play && ui.play.addEventListener('click', () => (playing ? stop() : play(current)));
  ui.reset && ui.reset.addEventListener('click', () => { stop(); window.seek(0).catch(() => {}); });
  ui.replay && ui.replay.addEventListener('click', () => { stop(); window.seek(0).then(() => play(0), () => {}); });
  ui.end && ui.end.addEventListener('click', () => { stop(); window.seek(DURATION).catch(() => {}); });
  ui.time && ui.time.addEventListener('input', () => { stop(); window.seek(ui.time.value).catch(() => {}); });
  for (const b of jumps) b.addEventListener('click', () => { stop(); window.seek(Number(b.dataset.jump)).catch(() => {}); });
  for (const b of orients) {
    b.addEventListener('click', () => {
      const size = SIZES[b.dataset.orient];
      if (!size) return;
      config.width = size[0];
      config.height = size[1];
      orients.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      sizeCanvas();
      if (verified) window.seek(current).catch(() => {});
    });
  }
  ui.retry && ui.retry.addEventListener('click', () => { startLoad().catch(() => {}); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });
}

startLoad().catch(() => {});
