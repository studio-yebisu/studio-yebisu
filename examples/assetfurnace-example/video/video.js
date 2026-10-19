/* AssetFurnace silent explanation film: editor and Motion Reel capture target. Studio Yebisu, MIT.
   No audio elements, audio events, narration or speech. Every frame is a pure function of t and the verified files. */
import {loadData, disposeData, sceneAt, drawConcept, layoutConcept, createModelView, drawModelInto,
  PALETTES, SANS, SERIF, SCENES, FILM, CASE_IDS, MODEL_IDS, fmtInt, pct} from '../concept.js';

const cfg = window.motionConfig;
const ready = window.__afFilm;
const render = !!window.__MOTION_RENDER__;
// Keep rasterization on one backend across the first frame and repeated capture/readback.
const canvas = document.getElementById('film'), ctx = canvas.getContext('2d', {willReadFrequently: true});
// One offscreen WebGL canvas for the whole session: fixed size, pixel ratio 1, kept between frames.
const GL = {width: 640, height: 360};
const glCanvas = document.createElement('canvas');
glCanvas.width = GL.width; glCanvas.height = GL.height;
const pal = PALETTES.light; // the film never follows the viewer's theme, so every capture is identical
const $ = s => document.getElementById(s);
const orientButtons = [...document.querySelectorAll('[data-orient]')];
const controls = ['ed-play', 'ed-replay', 'ed-start', 'ed-end', 'ed-scrub'].map($);
let data = null, view = null, gen = 0, current = 0, playing = false, raf = 0, origin = 0, sceneButtons = [];

const clamp = t => Math.max(0, Math.min(FILM.duration, Number(t) || 0));
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

function sizeCanvas() {
  canvas.width = cfg.width; canvas.height = cfg.height;
  if (render) { canvas.style.width = cfg.width + 'px'; canvas.style.height = cfg.height + 'px'; }
}

function wrap(text, maxW) {
  const lines = []; let line = '';
  for (const ch of text) {
    if (line && ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch.trim() ? ch : ''; }
    else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}
function fit(text, x, y, maxW) {
  const w = ctx.measureText(text).width;
  if (w <= maxW) { ctx.fillText(text, x, y); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(maxW / w, 1); ctx.fillText(text, 0, 0); ctx.restore();
}
function rrect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

// The three real settings as chips; the one being walked through (or all, at the end) is filled.
function chips(s, x, y, size, alignRight) {
  ctx.font = '700 ' + size + 'px ' + SANS; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const labels = CASE_IDS.map(id => data.cases[id].request.max_size + '上限');
  const ws = labels.map(l => ctx.measureText(l).width + size * 1.1), gap = size * 0.4, h = size * 1.65;
  let cx = alignRight ? x - ws.reduce((a, b) => a + b, 0) - gap * (ws.length - 1) : x;
  CASE_IDS.forEach((id, i) => {
    const on = s.chip === 'all' || s.chip === id;
    rrect(cx, y, ws[i], h, h / 2);
    ctx.fillStyle = on ? pal.accent : pal.paper; ctx.fill();
    ctx.strokeStyle = on ? pal.accent : pal.line; ctx.lineWidth = Math.max(1.5, size / 14); ctx.stroke();
    ctx.fillStyle = on ? '#ffffff' : pal.muted; ctx.fillText(labels[i], cx + size * 0.55, y + h / 2);
    cx += ws[i] + gap;
  });
}

// Real renders of the actual GLB files: first the packed input, then the three outputs with one shared camera.
function drawStrip(s, R, tall, u) {
  rrect(R.x, R.y, R.w, R.h, 10 * u); ctx.fillStyle = pal.paper; ctx.fill();
  ctx.strokeStyle = pal.line; ctx.lineWidth = 1.5; ctx.stroke();
  const pad = 10 * u, small = Math.round((tall ? 20 : 18) * u), big = Math.round((tall ? 22 : 20) * u);
  ctx.textBaseline = 'middle';
  if (s.strip.input > 0.001) {
    ctx.save(); ctx.globalAlpha = s.strip.input;
    const P = data.packed;
    const lines = ['入力GLB：Poly Haven「Wooden Crate 01」CC0', '既存の3D（AI生成ではない）・メッシュ3・三角形' + fmtInt(P.info.triangles) + '・' + fmtInt(P.bytes) + 'B'];
    if (tall) {
      drawModelInto(ctx, view, 'input', s.yaw, s.pitch, {x: R.x + pad, y: R.y + pad, w: R.w - 2 * pad, h: R.h - 2 * pad - 2.6 * small});
      ctx.textAlign = 'center';
      ctx.font = '700 ' + big + 'px ' + SANS; ctx.fillStyle = pal.ink; fit(lines[0], R.x + R.w / 2, R.y + R.h - 2.1 * small, R.w - 2 * pad);
      ctx.font = '500 ' + small + 'px ' + SANS; ctx.fillStyle = pal.muted; fit(lines[1], R.x + R.w / 2, R.y + R.h - 0.85 * small, R.w - 2 * pad);
    } else {
      drawModelInto(ctx, view, 'input', s.yaw, s.pitch, {x: R.x + pad, y: R.y + pad, w: R.w * 0.36, h: R.h - 2 * pad});
      ctx.textAlign = 'left'; const lx = R.x + R.w * 0.4;
      ctx.font = '700 ' + big + 'px ' + SANS; ctx.fillStyle = pal.ink; fit(lines[0], lx, R.y + R.h * 0.36, R.w * 0.58);
      ctx.font = '500 ' + small + 'px ' + SANS; ctx.fillStyle = pal.muted; fit(lines[1], lx, R.y + R.h * 0.66, R.w * 0.58);
    }
    ctx.restore();
  }
  if (s.strip.trio > 0.001) {
    ctx.save(); ctx.globalAlpha = s.strip.trio;
    const gap = 10 * u, cw = (R.w - 2 * pad - 2 * gap) / 3;
    CASE_IDS.forEach((id, i) => {
      const c = data.cases[id], x = R.x + pad + i * (cw + gap);
      const l1 = c.request.max_size + '上限 ' + fmtInt(c.output.bytes) + 'B';
      const l2 = c.identical ? '入力と同一バイト（3枚保持）' : (c.replaced === 3 ? '3枚置換' : '置換' + c.replaced) + '・入力の' + pct(c.output.bytes, data.packed.bytes) + '%';
      if (tall) {
        drawModelInto(ctx, view, id, s.yaw, s.pitch, {x, y: R.y + pad, w: cw, h: R.h - 2 * pad - 2.6 * small});
        ctx.textAlign = 'center';
        ctx.font = '700 ' + small + 'px ' + SANS; ctx.fillStyle = pal.ink; fit(l1, x + cw / 2, R.y + R.h - 2.1 * small, cw);
        ctx.font = '500 ' + small + 'px ' + SANS; ctx.fillStyle = pal.muted; fit(l2, x + cw / 2, R.y + R.h - 0.85 * small, cw);
      } else {
        drawModelInto(ctx, view, id, s.yaw, s.pitch, {x, y: R.y + pad, w: cw * 0.48, h: R.h - 2 * pad});
        ctx.textAlign = 'left'; const lx = x + cw * 0.52;
        ctx.font = '700 ' + small + 'px ' + SANS; ctx.fillStyle = pal.ink; fit(l1, lx, R.y + R.h * 0.38, cw * 0.48);
        ctx.font = '500 ' + small + 'px ' + SANS; ctx.fillStyle = pal.muted; fit(l2, lx, R.y + R.h * 0.66, cw * 0.48);
      }
    });
    ctx.restore();
  }
}

/** One complete frame at time t. Pure function of t, the verified data and the fixed offscreen view. */
function drawFrame(t) {
  const W = cfg.width, H = cfg.height, tall = H >= W, u = tall ? W / 720 : W / 1280;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
  if (!data || !view) return null;
  const s = sceneAt(t, {data}), sc = s.scene;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';

  // Header: identity first, from frame 0.
  const left = (tall ? 30 : 40) * u;
  if (tall) {
    ctx.fillStyle = pal.muted; ctx.font = '600 ' + 22 * u + 'px ' + SANS; ctx.fillText('Studio Yebisu 作例・無音の説明映像', left, 40 * u);
    ctx.fillStyle = pal.ink; ctx.font = '700 ' + 50 * u + 'px ' + SERIF; fit('AssetFurnace', left, 88 * u, W - 2 * left);
    ctx.fillStyle = pal.muted; ctx.font = '600 ' + 26 * u + 'px ' + SANS; fit('手元の3Dアプリ。今回はテクスチャ圧縮CLIだけ', left, 132 * u, W - 2 * left);
    chips(s, left, 156 * u, 22 * u, false);
  } else {
    ctx.fillStyle = pal.ink; ctx.font = '700 ' + 38 * u + 'px ' + SERIF; fit('AssetFurnace', left, 46 * u, 480 * u);
    ctx.fillStyle = pal.muted; ctx.font = '600 ' + 22 * u + 'px ' + SANS; fit('手元の3Dアプリ。今回はテクスチャ圧縮CLIだけ', left, 86 * u, 560 * u);
    chips(s, W - left, 26 * u, 20 * u, true);
    ctx.textAlign = 'right'; ctx.fillStyle = pal.muted; ctx.font = '500 ' + 18 * u + 'px ' + SANS;
    ctx.fillText('動きは説明用・画像と3Dは実ファイルから描画', W - left, 86 * u);
    ctx.textAlign = 'left';
  }

  // The connected map, shared with the page.
  const box = tall ? {x: left, y: 204 * u, w: W - 2 * left, h: 694 * u} : {x: left, y: 108 * u, w: W - 2 * left, h: 424 * u};
  const L = layoutConcept(box.w, box.h, {orient: tall ? 'tall' : 'wide', film: true, maxFont: (tall ? 26 : 24) * u, minFont: 14});
  drawConcept(ctx, data, s, {layout: L, palette: pal, mode: 'film', x: box.x, y: box.y, view});

  const strip = tall ? {x: left, y: 912 * u, w: W - 2 * left, h: 204 * u} : {x: left, y: 542 * u, w: W - 2 * left, h: 118 * u};
  drawStrip(s, strip, tall, u);

  // Caption: one short message per scene. The last scene never fades, so 30–32 s is frozen.
  const fadeIn = s.index === 0 ? 1 : smooth((s.time - sc.start) / 0.35);
  const fadeOut = s.index === SCENES.length - 1 ? 1 : 1 - smooth((s.time - (sc.end - 0.35)) / 0.35);
  ctx.save(); ctx.globalAlpha = Math.min(fadeIn, fadeOut);
  const capSize = (tall ? 32 : 27) * u, capY = tall ? 1150 * u : H - 34 * u;
  ctx.font = '700 ' + capSize + 'px ' + SANS;
  const num = (s.index + 1) + '/' + SCENES.length;
  ctx.fillStyle = pal.accent; ctx.fillText(num, left, capY);
  const nw = ctx.measureText(num + '  ').width;
  ctx.fillStyle = pal.ink;
  wrap(sc.message, W - 2 * left - nw).slice(0, tall ? 2 : 1).forEach((line, i) => ctx.fillText(line, left + nw, capY + i * capSize * 1.3));
  ctx.restore();

  if (tall) {
    ctx.fillStyle = pal.muted; ctx.font = '500 ' + 20 * u + 'px ' + SANS;
    ctx.fillText('動きは説明用で、実際の処理時間ではありません。', left, 1236 * u);
    ctx.fillText('画像の小片と3Dは、確かめた実ファイルから描いています。', left, 1264 * u);
  }
  return s;
}

/* ---------- editor ---------- */

function enable(on) {
  for (const b of [...orientButtons, ...controls, ...sceneButtons]) b.disabled = !on;
}
function sync(s) {
  $('ed-scrub').value = String(Math.round(current * 10) / 10);
  $('ed-time').value = current.toFixed(1) + ' / ' + FILM.duration.toFixed(1) + '秒';
  $('ed-play').textContent = playing ? '一時停止' : '再生';
  $('ed-play').setAttribute('aria-pressed', String(playing));
  sceneButtons.forEach((b, i) => b.setAttribute('aria-current', String(!!s && s.index === i)));
}
function show(t) { current = clamp(t); const s = drawFrame(current); if (!render) sync(s); return s; }
function stop() { playing = false; cancelAnimationFrame(raf); if (!render) sync(data ? sceneAt(current, {data}) : null); }
function play(from) {
  if (render || !data) return;
  if (from != null) current = clamp(from);
  if (current >= FILM.duration) current = 0;
  playing = true; origin = performance.now() - current * 1000;
  const tick = now => {
    if (!playing) return;
    const t = (now - origin) / 1000;
    if (t >= FILM.duration) { show(FILM.duration); stop(); return; }
    show(t); raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  sync(sceneAt(current, {data}));
}
// Orientation changes only the canvas size; time and play state are kept.
function setOrient(o) {
  const wide = o === 'wide';
  cfg.width = wide ? 1280 : 720; cfg.height = wide ? 720 : 1280;
  orientButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.orient === o)));
  sizeCanvas(); show(current);
}

function state(kind, err) {
  const box = $('ed-state');
  box.classList.toggle('is-failed', kind === 'failed'); box.classList.toggle('is-ready', kind === 'ready');
  $('ed-retry').hidden = kind !== 'failed';
  $('ed-state-text').textContent = kind === 'failed' ? '確かめられなかったため、映像を止めています。' :
    kind === 'ready' ? '素材と3Dをすべて確かめました。任意の時刻を描けます。' : '保存済みのファイルを確かめています…';
  $('ed-state-detail').textContent = kind === 'failed' ? (err && err.message ? err.message : String(err)) + (err && err.detail ? '：' + err.detail : '') : '';
}

function inventory(d) {
  $('ed-manifest').textContent = 'concept/manifest.json SHA-256 ' + d.manifestSha + '（固定値と一致）。' + d.assets.length +
    'ファイルの大きさとSHA-256、原典の引用6か所、4つのGLBの画像・形・三角形の数を確かめ、同じGLBを three.js で読み込みました。';
  $('ed-inventory').replaceChildren(...d.assets.map(a => {
    const li = document.createElement('li'), link = document.createElement('a');
    link.href = '../' + a.path; link.textContent = a.path;
    li.append(link, ' ' + fmtInt(a.bytes) + 'B ' + a.sha256.slice(0, 12) + '…');
    return li;
  }));
}

async function loadStoryboard() {
  let res;
  try { res = await fetch(new URL('storyboard.json', import.meta.url), {cache: 'no-store'}); }
  catch (_) { throw Object.assign(new Error('絵コンテを取得できませんでした'), {detail: 'video/storyboard.json'}); }
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status + 'で絵コンテを取得できませんでした'), {detail: 'video/storyboard.json'});
  let sb;
  try { sb = JSON.parse(await res.text()); } catch (_) { throw Object.assign(new Error('絵コンテがJSONとして読めません'), {detail: 'video/storyboard.json'}); }
  const okScenes = Array.isArray(sb.scenes) && sb.scenes.length === SCENES.length && sb.scenes.every((x, i) =>
    x.id === SCENES[i].id && Array.isArray(x.time) && x.time[0] === SCENES[i].start && x.time[1] === SCENES[i].end && x.message === SCENES[i].message);
  if (!okScenes || sb.duration !== FILM.duration || sb.fps !== FILM.fps || sb.posterTime !== FILM.posterTime || !Array.isArray(sb.audioEvents) || sb.audioEvents.length)
    throw Object.assign(new Error('絵コンテが映像の場面と一致しません'), {detail: 'video/storyboard.json と concept.js の SCENES'});
  return sb;
}

function buildScenes() {
  const list = $('ed-scenes');
  sceneButtons = SCENES.map((sc, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.disabled = true;
    const head = document.createElement('b'); head.textContent = (i + 1) + '　' + sc.start.toFixed(1) + '–' + sc.end.toFixed(1) + '秒';
    b.append(head, sc.message);
    b.addEventListener('click', () => { stop(); show(sc.start); });
    const li = document.createElement('li'); li.append(b); list.append(li);
    return b;
  });
}

function release() {
  if (view) { view.dispose(); view = null; }
  const old = data; data = null; disposeData(old);
}

async function load(first) {
  const my = ++gen;
  let settle = ready;
  if (!first) {
    let resolve, reject;
    window.motionReady = new Promise((a, b) => { resolve = a; reject = b; });
    window.motionReady.catch(() => {});
    settle = {resolve, reject};
  }
  stop(); release(); enable(false); state('loading'); drawFrame(current);
  let d = null, v = null;
  try {
    const loaded = await Promise.all([loadData(), loadStoryboard()]);
    d = loaded[0];
    if (my !== gen) { disposeData(d); return; }
    // Ready only when the real GLBs actually draw: one render of each through the shared view.
    v = createModelView(d, {canvas: glCanvas, width: GL.width, height: GL.height, pixelRatio: 1, preserveDrawingBuffer: true});
    for (const id of MODEL_IDS) v.render(id, 0.62, 0.36);
    if (document.fonts) await document.fonts.ready;
    if (my !== gen) { v.dispose(); disposeData(d); return; }
    data = d; view = v;
    if (!render) { inventory(d); enable(true); state('ready'); }
    show(current);
    settle.resolve(true);
  } catch (e) {
    if (v) v.dispose();
    if (d) disposeData(d);
    if (my !== gen) return;
    data = null; view = null; enable(false); drawFrame(current);
    if (!render) { state('failed', e); $('ed-inventory').replaceChildren(); $('ed-manifest').textContent = ''; }
    settle.reject(e);
  }
}

window.seek = async seconds => {
  await window.motionReady;
  if (playing) stop();
  const s = show(seconds);
  if (!s) throw new Error('映像を描けません（素材か3Dの準備が失われました）');
  return {time: current, scene: s.scene.id};
};

glCanvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  stop(); release(); enable(false); drawFrame(current);
  if (!render) state('failed', Object.assign(new Error('WebGLの描画が中断されました'), {detail: '「もう一度確かめる」で読み込み直します'}));
});

sizeCanvas();
if (!render) {
  buildScenes();
  orientButtons.forEach(b => {
    b.setAttribute('aria-pressed', String((b.dataset.orient === 'wide') === (cfg.width > cfg.height)));
    b.addEventListener('click', () => setOrient(b.dataset.orient));
  });
  $('ed-play').addEventListener('click', () => (playing ? stop() : play()));
  $('ed-replay').addEventListener('click', () => { stop(); play(0); });
  $('ed-start').addEventListener('click', () => { stop(); show(0); });
  $('ed-end').addEventListener('click', () => { stop(); show(FILM.duration); });
  // Read the slider before stop(), because stop() rewrites the slider to the old time.
  $('ed-scrub').addEventListener('input', e => { const target = Number(e.target.value); stop(); show(target); });
  $('ed-retry').addEventListener('click', () => load(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
}
load(true);
