/* Diagram Design の作例 — 32秒の紹介映像（Studio Yebisu, MIT）。Canvas only, silent.
   The network is the same one the page draws (../concept.js): the book and the request join at one
   AI writer, the paper becomes HTML with inline SVG, the operator checks it and makes SVG/PNG copies,
   and all three reconnect to the saved figure. A camera reframes that one graph; nothing is a slide.
   The actual figure is ../diagrams/intake.png from verified bytes; route marks come from
   ../diagram-data.json. Contract (Motion Reel): window.seek(seconds) rebuilds the frame from t alone. */
import {
  PALETTES, FONTS, PART_IDS, portraitLayout, wideLayout, restState, drawNetwork, drawFigure, drawRoute,
  paperLanes, ramp, clamp, lerpRect, loadVerified, releaseModel, AssetError
} from '../concept.js?v=visual-r1';

const DURATION = 32;
const MOTION_END = 28.9;   // every value below is computed from min(t, MOTION_END): 28.9–32 is one still
const POSTER = 31;

const rc = window.renderConfig || {};
const query = new URLSearchParams(location.search);
const RENDER = Boolean(window.__MOTION_RENDER__) || query.has('render');
if (RENDER) document.documentElement.classList.add('render');

const BASE = {portrait: {w: 720, h: 1280}, wide: {w: 1280, h: 720}};
const FIXED = rc.width > 0 && rc.height > 0;
let orient = FIXED ? (rc.width >= rc.height ? 'wide' : 'portrait') : (query.get('orient') === 'wide' ? 'wide' : 'portrait');

function outSize() {
  if (FIXED) return {width: Math.round(rc.width), height: Math.round(rc.height)};
  return {width: BASE[orient].w, height: BASE[orient].h};
}

window.motionConfig = {
  duration: DURATION,
  fps: rc.fps > 0 ? rc.fps : 30,
  width: outSize().width,
  height: outSize().height,
  posterTime: POSTER,
  audioEvents: []
};

const pal = PALETTES.light;
const LAYOUT = {portrait: portraitLayout(), wide: wideLayout()};

/* Per-orientation composition, laid out natively for each frame size (frame px). */
const COMP = {
  portrait: {
    head: {x: 360, y: 108, size: 44, subY: 160, sub: 22, maxW: 680, lines: [92, 148], linesSize: 40},
    box: {x: 20, y: 204, w: 680, h: 890},
    eBox: {x: 20, y: 190, w: 680, h: 448},
    hero: {x: 20, y: 682, w: 680, h: 382.5},
    callout: {x: 360, y: 1112, size: 30, sub: 22, gap: 40},
    callLines: true,
    bands: [190, 1096],
    sidebar: {x: 40, y: 1120, cols: 15, cell: 16, gap: 5, labelX: 372, labelY: 1132, size: 22, sub: 18},
    bytes: {x: 360, y: 1152, size: 18},
    credit: {x: 360, y: 1242, size: 14},
    cams: {A: [0, 0, 196, 124], B: [0, 0, 360, 172], C: [0, 124, 230, 166], full: [0, 0, 360, 420], E: [0, 0, 360, 420]}
  },
  wide: {
    head: {x: 640, y: 54, size: 36, subY: 90, sub: 18, maxW: 1200, lines: null, linesSize: 34},
    box: {x: 24, y: 108, w: 1232, h: 552},
    eBox: {x: 16, y: 112, w: 568, h: 540},
    hero: {x: 600, y: 146, w: 664, h: 373.5},
    callout: {x: 932, y: 570, size: 24, sub: 17, gap: 32},
    callLines: false,
    bands: [104, 662],
    sidebar: {x: 24, y: 666, cols: 45, cell: 10, gap: 3, labelX: 624, labelY: 676, size: 16, sub: 13},
    bytes: {x: 640, y: 682, size: 15},
    credit: {x: 640, y: 706, size: 12},
    cams: {A: [8, 8, 250, 152], B: [8, 8, 420, 404], C: [268, 100, 420, 210], full: [0, 0, 960, 420], E: [8, 6, 688, 408]}
  }
};

const SCENES = [
  {t0: 0, t1: 4, h: '関係を読み、図の形を選ぶ', sub: 'Diagram Design：AIが読む図づくりの指針'},
  {t0: 4, t1: 8, h: '指針＋依頼 → AI', sub: '6つの見出しの本と、架空の依頼（3担当・分岐・戻り・完了）'},
  {t0: 8, t1: 14, h: 'AIが形を選び、HTMLに描く', sub: '保存済みの作例の判断を図解（新しい実行ではない）'},
  {t0: 14, t1: 20, h: 'AIが執筆 / 制作担当が実行', sub: '点検 → SVG書出し・PNG撮影（HTMLは正本のまま）'},
  {t0: 20, t1: 26, h: '実際の図：戻り道と完了', sub: '保存済みの intake.png と経路の記録'},
  {t0: 26, t1: 27.9, h: '開く・編集に使う', sub: 'HTML（正本）・SVG（編集用）・PNG（画像）'},
  {t0: 27.9, t1: Infinity, h: '指針＋依頼 → AIが図を書く → 確認・書出し → 使う', lines: ['指針＋依頼 → AIが図を書く', '→ 確認・書出し → 使う'], sub: ''}
];

// Camera keyframes: [start, focus rect, frame box]. Each move is followed by held time.
const CAMERA = [[0, 'A', 'box'], [4, 'B', 'box'], [8, 'C', 'box'], [14, 'full', 'box'], [20, 'E', 'eBox'], [26, 'full', 'box']];

const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
let model = null;

const rectOf = a => ({x: a[0], y: a[1], w: a[2], h: a[3]});

function camera(t, C) {
  let i = 0;
  while (i + 1 < CAMERA.length && t >= CAMERA[i + 1][0]) i++;
  const cur = CAMERA[i], prev = CAMERA[Math.max(0, i - 1)];
  const span = cur[1] === 'E' || prev[1] === 'E' ? 1.2 : 0.9;
  const k = i === 0 ? 1 : ramp(t, cur[0], cur[0] + span);
  const rect = lerpRect(rectOf(C.cams[prev[1]]), rectOf(C.cams[cur[1]]), k);
  const box = lerpRect(C[prev[2]], C[cur[2]], k);
  const s = Math.min(box.w / rect.w, box.h / rect.h);
  return {s, x: box.x + (box.w - rect.w * s) / 2 - rect.x * s, y: box.y + (box.h - rect.h * s) / 2 - rect.y * s};
}

const toScreen = (r, cam) => ({x: cam.x + r.x * cam.s, y: cam.y + r.y * cam.s, w: r.w * cam.s, h: r.h * cam.s});

function filmState(t) {
  const S = restState();
  S.book = ramp(t, 0.4, 1.5);
  S.tabs = ramp(t, 1.2, 3.0);
  S.bookMarks = ramp(t, 2.2, 3.4);
  S.part = t >= 1.2 && t < 3.4 ? PART_IDS[Math.min(5, Math.floor((t - 1.2) / 0.3))] : null;
  S.ring = false;   // the film marks the tab only; the page adds a ring when a reader picks a part
  S.request = ramp(t, 4.6, 5.6);
  S.chips = ramp(t, 5.6, 6.6);
  S.inflow = ramp(t, 6.6, 7.7);
  S.ai = ramp(t, 7.4, 8.2);
  S.card = ramp(t, 9.6, 10.2);
  S.unfold = ramp(t, 10.2, 11.4);
  S.lanes = ramp(t, 11.0, 11.6);
  S.units = ramp(t, 11.4, 12.8);
  S.returns = ramp(t, 12.8, 13.5);
  S.tools = ramp(t, 14.6, 15.6);
  S.toOp = ramp(t, 15.6, 16.5);
  S.check = ramp(t, 16.5, 17.2);
  S.ack = ramp(t, 17.0, 17.5);
  S.fork = ramp(t, 17.6, 19.0);
  S.tags = ramp(t, 18.6, 19.2);
  S.figure = ramp(t, 19.2, 20.2);
  S.tagsLit = ramp(t, 26.8, 27.4);
  S.action = ramp(t, 27.0, 27.7);
  S.zone = t < 8 ? 0 : t < 20 ? 1 : t < 27.9 ? 2 : -1;
  return S;
}

function fitText(text, size, weight, family, maxW) {
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width;
  return w > maxW ? Math.floor(size * maxW / w) : size;
}

function drawHeadline(t, C) {
  const H = C.head;
  SCENES.forEach((sc, i) => {
    const aIn = i === 0 ? ramp(t, 0.15, 0.7) : ramp(t, sc.t0, sc.t0 + 0.45);
    const aOut = Number.isFinite(sc.t1) ? 1 - ramp(t, sc.t1 - 0.35, sc.t1) : 1;
    const a = aIn * aOut;
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = pal.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (sc.lines && H.lines) {
      sc.lines.forEach((line, j) => {
        const size = fitText(line, H.linesSize, 600, FONTS.mincho, H.maxW);
        ctx.font = `600 ${size}px ${FONTS.mincho}`;
        ctx.fillText(line, H.x, H.lines[j]);
      });
    } else {
      const size = fitText(sc.h, sc.lines ? H.linesSize : H.size, 600, FONTS.mincho, H.maxW);
      ctx.font = `600 ${size}px ${FONTS.mincho}`;
      ctx.fillText(sc.h, H.x, sc.lines ? (H.y + H.subY) / 2 : H.y);
    }
    if (sc.sub) {
      const size = fitText(sc.sub, H.sub, 400, FONTS.gothic, H.maxW);
      ctx.font = `400 ${size}px ${FONTS.gothic}`;
      ctx.fillStyle = pal.soft;
      ctx.fillText(sc.sub, H.x, H.subY);
    }
    ctx.restore();
  });
}

function drawSidebar(t, C) {
  const a = ramp(t, 8.6, 9.3) * (1 - ramp(t, 13.5, 14));
  if (a <= 0) return 0;
  const sb = C.sidebar;
  const pick = ramp(t, 9.2, 9.8);
  ctx.save();
  ctx.globalAlpha = a;
  for (let i = 0; i < 45; i++) {
    const col = i % sb.cols, row = Math.floor(i / sb.cols);
    const x = sb.x + col * (sb.cell + sb.gap), y = sb.y + row * (sb.cell + sb.gap);
    ctx.strokeStyle = pal.rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, sb.cell - 1, sb.cell - 1);
    if (i === 8 && pick > 0) {
      ctx.save();
      ctx.globalAlpha = a * pick;
      ctx.fillStyle = pal.accent;
      ctx.fillRect(x, y, sb.cell, sb.cell);
      ctx.restore();
    }
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pal.ink;
  ctx.font = `600 ${sb.size}px ${FONTS.gothic}`;
  ctx.fillText('45種類 → スイムレーン', sb.labelX, sb.labelY);
  ctx.fillStyle = pal.soft;
  ctx.font = `400 ${sb.sub}px ${FONTS.gothic}`;
  ctx.fillText('意味の型（9種）は使わず', sb.labelX, sb.labelY + sb.size * 1.25);
  ctx.restore();
  return a;
}

const group = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function drawFooter(t, C, sidebarAlpha) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const bytesA = ramp(t, 27.2, 27.9);
  if (bytesA > 0) {
    ctx.globalAlpha = bytesA;
    ctx.fillStyle = pal.ink;
    ctx.font = `400 ${C.bytes.size}px ${FONTS.mono}`;
    ctx.fillText(`HTML ${group(model.sizes.html)} B ・ SVG ${group(model.sizes.svg)} B ・ PNG 2560×1440`, C.bytes.x, C.bytes.y);
  }
  const creditA = 1 - sidebarAlpha;
  if (creditA > 0) {
    ctx.globalAlpha = creditA;
    ctx.fillStyle = pal.soft;
    ctx.font = `400 ${C.credit.size}px ${FONTS.gothic}`;
    ctx.fillText('Studio Yebisu ・ Diagram Design の作例（架空の依頼・保存済みの成果物）', C.credit.x, C.credit.y);
  }
  ctx.restore();
}

function drawHero(t, C, cam, L) {
  const k = ramp(t, 20, 21.2) * (1 - ramp(t, 26, 27.2));
  if (k <= 0) return;
  const slot = toScreen(L.figure, cam);
  const r = lerpRect(slot, C.hero, k);
  ctx.save();
  if (C.callLines) {
    ctx.globalAlpha = k;
    ctx.strokeStyle = pal.rule;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(slot.x, slot.y + slot.h);
    ctx.lineTo(r.x, r.y);
    ctx.moveTo(slot.x + slot.w, slot.y + slot.h);
    ctx.lineTo(r.x + r.w, r.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = pal.bg;
  ctx.fillRect(r.x - 18, r.y - 10, r.w + 28, r.h + 20);
  drawFigure(ctx, r, model, pal, {frame: 1.5});

  // The same three strips leave the HTML paper and line up with the actual figure's lanes.
  const bands = ramp(t, 20.6, 21.5);
  const from = paperLanes(L).map(l => toScreen(l, cam));
  model.data.lanes.forEach((lane, i) => {
    const to = {x: r.x - 14, y: r.y + r.h * lane.y[0] / 720, w: 8, h: r.h * (lane.y[1] - lane.y[0]) / 720};
    const cur = lerpRect(from[i], to, bands);
    ctx.fillStyle = pal.lane[i];
    ctx.fillRect(cur.x, cur.y, cur.w, cur.h);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(cur.x, cur.y, cur.w, cur.h);
  });

  const marks = [
    ['route-missing', ramp(t, 21.4, 22.5), 1 - ramp(t, 22.8, 23.1)],
    ['route-unresolved', ramp(t, 23.1, 24.2), 1 - ramp(t, 24.4, 24.7)],
    ['route-complete', ramp(t, 24.7, 25.5), 1 - ramp(t, 26.0, 26.6)]
  ];
  for (const [id, rk, a] of marks) {
    if (rk > 0 && a > 0) drawRoute(ctx, r, model, id, rk, pal, {alpha: a * k, color: id === 'route-complete' ? pal.accent : pal.ink});
  }
  ctx.restore();
}

// Route notes read the edge label and endpoint names from diagram-data.json.
function drawCallouts(t, C) {
  const k = ramp(t, 20, 21.2) * (1 - ramp(t, 26, 27.2));
  if (k <= 0) return;
  const notes = [
    ['E04', ramp(t, 21.4, 21.8) * (1 - ramp(t, 22.8, 23.1))],
    ['E10', ramp(t, 23.1, 23.5) * (1 - ramp(t, 24.4, 24.7))],
    ['E09', ramp(t, 24.7, 25.1) * (1 - ramp(t, 26.0, 26.6))]
  ];
  const cl = C.callout;
  for (const [eid, a] of notes) {
    if (a <= 0) continue;
    const e = model.edgeById.get(eid);
    const fromNode = model.nodeById.get(e.from), toNode = model.nodeById.get(e.to);
    const accent = e.style === 'accent';
    ctx.save();
    ctx.globalAlpha = a * k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent ? pal.accent : pal.ink;
    ctx.font = `600 ${cl.size}px ${FONTS.gothic}`;
    ctx.fillText(`${e.id}「${e.label}」${e.kind === 'return' ? '（戻り）' : ''}`, cl.x, cl.y);
    ctx.fillStyle = pal.soft;
    ctx.font = `400 ${cl.sub}px ${FONTS.gothic}`;
    ctx.fillText(`${fromNode.id} ${fromNode.name} → ${toNode.id} ${toNode.name}`, cl.x, cl.y + cl.gap);
    ctx.restore();
  }
}

function drawPlain(message) {
  const {width, height} = canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, width, height);
  if (message) {
    ctx.fillStyle = pal.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(Math.min(width, height) / 22)}px ${FONTS.gothic}`;
    ctx.fillText(message, width / 2, height / 2);
  }
  ctx.restore();
}

function draw(seconds) {
  if (!model) return;
  const t = clamp(seconds, 0, MOTION_END);
  const B = BASE[orient], C = COMP[orient], L = LAYOUT[orient];
  const {width, height} = canvas;
  const k = Math.min(width / B.w, height / B.h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.translate((width - B.w * k) / 2, (height - B.h * k) / 2);
  ctx.scale(k, k);

  const S = filmState(t);
  const cam = camera(t, C);
  S.scale = cam.s;
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.s, cam.s);
  drawNetwork(ctx, L, S, pal, model);
  ctx.restore();

  drawHero(t, C, cam, L);
  // Keep the headline band and the footer band clear of the zoomed graph.
  ctx.save();
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, B.w, C.bands[0]);
  ctx.fillRect(0, C.bands[1], B.w, B.h - C.bands[1]);
  ctx.strokeStyle = pal.rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, C.bands[0] - 0.5);
  ctx.lineTo(B.w - 24, C.bands[0] - 0.5);
  ctx.stroke();
  ctx.restore();
  drawCallouts(t, C);
  drawHeadline(t, C);
  const sa = drawSidebar(t, C);
  drawFooter(t, C, sa);
  ctx.restore();
}

/* ---------- Loading, seek and the editor ---------- */

const statusEl = document.getElementById('asset-status');
const retryEl = document.getElementById('retry');
const playEl = document.getElementById('play');
const timeEl = document.getElementById('time');
const clockEl = document.getElementById('clock');
const controls = [playEl, timeEl, ...['reset', 'replay', 'end'].map(id => document.getElementById(id)),
  ...document.querySelectorAll('button[data-jump]'), ...document.querySelectorAll('button[data-orient]')];

let gen = 0;
let controller = null;
let current = 0;
let playing = false;
let startAt = 0;
let raf = 0;

function setStatus(state, text) {
  document.documentElement.dataset.state = state;
  if (statusEl) {
    statusEl.dataset.state = state;
    statusEl.textContent = text;
  }
}

function setControls(on) {
  for (const el of controls) if (el) el.disabled = !on;
}

function applySize() {
  const s = outSize();
  canvas.width = s.width;
  canvas.height = s.height;
  window.motionConfig.width = s.width;
  window.motionConfig.height = s.height;
  canvas.dataset.orient = orient;
  for (const b of document.querySelectorAll('button[data-orient]')) b.setAttribute('aria-pressed', String(b.dataset.orient === orient));
}

function load() {
  const my = ++gen;
  if (controller) controller.abort();
  controller = new AbortController();
  pause();
  releaseModel(model);
  model = null;
  setControls(false);
  if (retryEl) {
    retryEl.hidden = true;
    retryEl.disabled = true;
  }
  setStatus('loading', '保存済みの27ファイルを照合しています…');
  drawPlain('');
  const ready = loadVerified({signal: controller.signal}).then(async m => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    if (my !== gen) {
      releaseModel(m);
      throw new AssetError('新しい読み込みに置き換えました。');
    }
    model = m;
    setStatus('ready', '27ファイルを照合しました（目録と各ファイルの大きさ・SHA-256が一致、PNG 2560×1440）。');
    setControls(true);
    show(current);
    return true;
  });
  ready.catch(err => {
    if (my !== gen) return;
    model = null;
    setControls(false);
    const message = err instanceof AssetError ? err.message : '保存済みのファイルを確認できませんでした。';
    setStatus('error', `${message} 映像は描きません。`);
    drawPlain('素材を確認できませんでした');
    if (retryEl) {
      retryEl.hidden = false;
      retryEl.disabled = false;
    }
  });
  return ready;
}

const clampTime = t => clamp(Number(t) || 0, 0, DURATION);

window.seek = seconds => {
  const t = clampTime(seconds);
  current = t;
  if (!model) return window.motionReady.then(() => draw(t));
  draw(t);
  return undefined;
};

function show(t) {
  current = clampTime(t);
  draw(current);
  if (timeEl) timeEl.value = String(Math.round(current * 10) / 10);
  if (clockEl) clockEl.value = `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
}

function pause() {
  playing = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (playEl) {
    playEl.textContent = '再生';
    playEl.setAttribute('aria-pressed', 'false');
  }
}

function tick(now) {
  raf = 0;
  if (!playing || window.__MOTION_RENDER__ || !model) {
    pause();
    return;
  }
  const t = (now - startAt) / 1000;
  if (t >= DURATION) {
    show(DURATION);
    pause();
    return;
  }
  show(t);
  raf = requestAnimationFrame(tick);
}

function play() {
  if (!model || window.__MOTION_RENDER__) return;
  if (current >= DURATION) current = 0;
  playing = true;
  startAt = performance.now() - current * 1000;
  playEl.textContent = '一時停止';
  playEl.setAttribute('aria-pressed', 'true');
  raf = requestAnimationFrame(tick);
}

applySize();
window.motionReady = load();

if (!RENDER) {
  playEl.addEventListener('click', () => (playing ? pause() : play()));
  document.getElementById('reset').addEventListener('click', () => {
    pause();
    show(0);
  });
  document.getElementById('replay').addEventListener('click', () => {
    pause();
    show(0);
    play();
  });
  document.getElementById('end').addEventListener('click', () => {
    pause();
    show(DURATION);
  });
  timeEl.addEventListener('input', () => {
    pause();
    show(Number(timeEl.value));
  });
  for (const b of document.querySelectorAll('button[data-jump]')) {
    b.addEventListener('click', () => {
      pause();
      show(Number(b.dataset.jump));
    });
  }
  for (const b of document.querySelectorAll('button[data-orient]')) {
    b.addEventListener('click', () => {
      if (FIXED || orient === b.dataset.orient) return;
      orient = b.dataset.orient;
      applySize();
      show(current);
    });
  }
  retryEl.addEventListener('click', () => {
    window.motionReady = load();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) pause();
  });
}
