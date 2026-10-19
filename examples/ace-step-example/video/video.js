/* ACE-Step V1 silent explanation film: editor and Motion Reel capture target. Studio Yebisu, MIT.
   No audio elements, audio events, narration or speech. The functional WAV is played only on the example page. */
import {loadData, sceneAt, drawConcept, layoutConcept, PALETTES, SANS, SERIF, SCENES, FILM, fmtInt} from '../concept.js';

const cfg = window.motionConfig;
const ready = window.__aceFilm;
const render = !!window.__MOTION_RENDER__;
// Keep rasterization on one backend across the first frame and repeated capture/readback.
const canvas = document.getElementById('film'), ctx = canvas.getContext('2d', {willReadFrequently: true});
const pal = PALETTES.light; // the film never follows the viewer's theme, so every capture is identical
const $ = s => document.getElementById(s);
const orientButtons = [...document.querySelectorAll('[data-orient]')];
const controls = ['ed-play', 'ed-replay', 'ed-start', 'ed-end', 'ed-scrub'].map($);
let data = null, gen = 0, current = 0, playing = false, raf = 0, origin = 0, sceneButtons = [];

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
function chip(text, x, y, size, color, maxW) {
  ctx.font = '700 ' + size + 'px ' + SANS;
  const w = Math.min(maxW, ctx.measureText(text).width + size * 1.2), h = size * 1.7;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
  ctx.fillStyle = pal.paper; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, size / 12); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  fit(text, x + size * 0.6, y + h / 2, w - size * 1.2);
  return w;
}

/** One complete frame at time t. Pure function of t and the verified data. */
function drawFrame(t) {
  const W = cfg.width, H = cfg.height, tall = H >= W, u = tall ? W / 720 : W / 1280;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
  if (!data) return null;
  const s = sceneAt(t), sc = s.scene, out = data.facts.actual_output, sig = out.measurements.signal;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';

  // Header: identity first.
  const left = (tall ? 30 : 40) * u;
  if (tall) {
    ctx.fillStyle = pal.muted; ctx.font = '600 ' + 22 * u + 'px ' + SANS; ctx.fillText('Studio Yebisu 作例・無音の説明映像', left, 52 * u);
    ctx.fillStyle = pal.ink; ctx.font = '700 ' + 52 * u + 'px ' + SERIF; fit('ACE-Step V1（3.5B）', left, 110 * u, W - 2 * left);
    ctx.fillStyle = pal.muted; ctx.font = '600 ' + 28 * u + 'px ' + SANS; fit('手元のPythonで動く音楽生成モデル', left, 166 * u, W - 2 * left);
  } else {
    ctx.fillStyle = pal.ink; ctx.font = '700 ' + 40 * u + 'px ' + SERIF; fit('ACE-Step V1（3.5B）', left, 56 * u, 520 * u);
    ctx.fillStyle = pal.muted; ctx.font = '600 ' + 22 * u + 'px ' + SANS; fit('手元のPythonで動く音楽生成モデル', left, 98 * u, 520 * u);
    ctx.textAlign = 'right'; ctx.font = '500 ' + 18 * u + 'px ' + SANS;
    ctx.fillText('動きは説明用で、実際の処理時間ではありません', W - left, 50 * u);
    ctx.fillText('潜在・メルの模様は説明図／下の波形は保存WAVの実測', W - left, 78 * u);
    ctx.textAlign = 'left';
  }

  // The connected map, shared with the page.
  const box = tall ? {x: left, y: 206 * u, w: W - 2 * left, h: 806 * u} : {x: left, y: 124 * u, w: W - 2 * left, h: 476 * u};
  const L = layoutConcept(box.w, box.h, {orient: tall ? 'tall' : 'wide', maxFont: 30 * u, minFont: 14});
  drawConcept(ctx, data, s, {layout: L, palette: pal, mode: 'film', x: box.x, y: box.y});

  // Separate numerical checks and the still-pending listening, as two plain chips.
  if (s.checks > 0) {
    ctx.save(); ctx.globalAlpha = s.checks;
    const size = (tall ? 23 : 19) * u;
    const a = '別工程の数値：ピーク ' + sig.whole.peak_abs.toFixed(3) + '・末尾0.5秒 RMS ' + sig.last_0_5_s.rms.toExponential(1);
    const b = '人の聴取：未実施';
    if (tall) { chip(a, left, 1028 * u, size, pal.teal, W - 2 * left); chip(b, left, 1074 * u, size, pal.accent, W - 2 * left); }
    else { const w = chip(a, left, H - 112 * u, size, pal.teal, 760 * u); chip(b, left + w + 14 * u, H - 112 * u, size, pal.accent, 360 * u); }
    ctx.restore();
  }

  // Caption: one short message per scene. The last scene never fades, so 30–32 s is frozen.
  const fadeIn = s.index === 0 ? 1 : smooth((s.time - sc.start) / 0.35);
  const fadeOut = s.index === SCENES.length - 1 ? 1 : 1 - smooth((s.time - (sc.end - 0.35)) / 0.35);
  ctx.save(); ctx.globalAlpha = Math.min(fadeIn, fadeOut);
  const capSize = (tall ? 32 : 27) * u, capY = tall ? 1146 * u : H - 44 * u;
  ctx.font = '700 ' + capSize + 'px ' + SANS;
  const num = (s.index + 1) + '/' + SCENES.length;
  ctx.fillStyle = pal.accent; ctx.fillText(num, left, capY);
  const nw = ctx.measureText(num + '  ').width;
  ctx.fillStyle = pal.ink;
  const lines = wrap(sc.message, W - 2 * left - nw).slice(0, 2);
  lines.forEach((line, i) => ctx.fillText(line, left + nw, capY + i * capSize * 1.3));
  ctx.restore();

  if (tall) {
    ctx.fillStyle = pal.muted; ctx.font = '500 ' + 20 * u + 'px ' + SANS;
    ctx.fillText('動きは説明用で、実際の処理時間ではありません。', left, 1234 * u);
    ctx.fillText('潜在・メルの模様は説明図／下の波形は保存WAVの実測。', left, 1262 * u);
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
function stop() { playing = false; cancelAnimationFrame(raf); if (!render) sync(data ? sceneAt(current) : null); }
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
  sync(sceneAt(current));
}
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
    kind === 'ready' ? '素材をすべて確かめました。任意の時刻を描けます。' : '保存済みのファイルを確かめています…';
  $('ed-state-detail').textContent = kind === 'failed' ? (err && err.message ? err.message : String(err)) + (err && err.detail ? '：' + err.detail : '') : '';
}

function inventory(d) {
  $('ed-manifest').textContent = 'concept/manifest.json SHA-256 ' + d.manifestSha + '（固定値と一致）。' + d.assets.length + 'ファイルの大きさとSHA-256、原典の引用6か所、WAVの形式と長さを確かめました。';
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

async function load(first) {
  const my = ++gen;
  let settle = ready;
  if (!first) {
    let resolve, reject;
    window.motionReady = new Promise((a, b) => { resolve = a; reject = b; });
    window.motionReady.catch(() => {});
    settle = {resolve, reject};
  }
  stop(); data = null; enable(false); state('loading'); drawFrame(current);
  try {
    const [d] = await Promise.all([loadData(), loadStoryboard()]);
    if (my !== gen) return;
    if (document.fonts) await document.fonts.ready;
    if (my !== gen) return;
    data = d;
    if (!render) { inventory(d); enable(true); state('ready'); }
    show(current);
    settle.resolve(true);
  } catch (e) {
    if (my !== gen) return;
    data = null; enable(false); drawFrame(current);
    if (!render) { state('failed', e); $('ed-inventory').replaceChildren(); $('ed-manifest').textContent = ''; }
    settle.reject(e);
  }
}

window.seek = async seconds => {
  await window.motionReady;
  if (playing) stop();
  const s = show(seconds);
  return {time: current, scene: s.scene.id};
};

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
  $('ed-scrub').addEventListener('input', e => { const target = Number(e.target.value); stop(); show(target); });
  $('ed-retry').addEventListener('click', () => load(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
}
load(true);
