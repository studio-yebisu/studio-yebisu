// 解説動画の1コマを時刻だけから描く。図そのものは作例ページと同じ ../app.js の drawMap を使う。
// 乱数・タイマー・前のコマの積算は使わない。どの順番で seek しても同じ画になる。

import {
  LAYOUTS, FILM_PALETTE, VerifyError, drawMap, drawText, along, joinPaths, stripRects, roundRect,
} from '../app.js';

export const DURATION = 32;
export const SCENE_IDS = ['identity', 'source', 'split', 'manual-yaw', 'rejoin', 'frames', 'use'];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const span = (p, a, b) => ease((p - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const lerpRect = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
const centerOf = (r) => [r.x + r.w / 2, r.y + r.h / 2];

export function validateStoryboard(story) {
  const ok = story && story.duration === DURATION && story.fps === 30 && story.posterTime === 31 &&
    Array.isArray(story.scenes) && story.scenes.length === SCENE_IDS.length &&
    story.scenes.every((s, i) => s.id === SCENE_IDS[i] && s.start === (i ? story.scenes[i - 1].end : 0) &&
      s.end > s.start && typeof s.kicker === 'string' && typeof s.caption === 'string') &&
    story.scenes[story.scenes.length - 1].end === DURATION;
  if (!ok) throw new VerifyError('絵コンテが想定と違います', 'video/storyboard.json の7場面・時刻・32秒が揃っていません');
}

export function sceneIndexAt(story, t) {
  for (let i = 0; i < story.scenes.length; i += 1) if (t < story.scenes[i].end) return i;
  return story.scenes.length - 1;
}

export function filmGeometry(width, height) {
  const orient = width > height ? 'wide' : 'portrait';
  const L = LAYOUTS[orient];
  const k = orient === 'wide' ? height / 720 : width / 720;
  const bandH = (orient === 'wide' ? 64 : 120) * k;
  const scale = Math.min(width / L.w, (height - bandH) / L.h);
  return {
    orient, L, k, bandH, scale,
    ox: (width - L.w * scale) / 2,
    oy: bandH + (height - bandH - L.h * scale) / 2,
  };
}

function cropBoxRect(model, n) {
  const o = model.facts.input.original;
  const b = o.crop_box_pil_edges;
  const sx = n.w / o.size[0];
  const sy = n.h / o.size[1];
  return { x: n.x + b[0] * sx, y: n.y + b[1] * sy, w: (b[2] - b[0]) * sx, h: (b[3] - b[1]) * sy };
}

function fmtSigned(v, digits = 1) {
  const s = Math.abs(v).toFixed(digits);
  return v < 0 ? `−${s}` : `+${s}`;
}

// 実際のPNGを大きく並べる面（設計座標）
const PANELS = {
  portrait: {
    back: { x: 4, y: 50, w: 352, h: 492 },
    src: { x: 14, y: 66, w: 160, h: 160 },
    gen0: { x: 186, y: 66, w: 160, h: 160 },
    pairLabelY: 240,
    rowLabelY: [266, 376],
    rowY: [276, 386],
    rowX: 8, size: 64, gap: 6,
    foot: { x: 14, y: [494, 512] },
  },
  wide: {
    back: { x: 14, y: 8, w: 932, h: 524 },
    src: { x: 36, y: 40, w: 200, h: 200 },
    gen0: { x: 256, y: 40, w: 200, h: 200 },
    pairLabelY: 258,
    rowLabelY: [44, 200],
    rowY: [56, 212],
    rowX: 490, size: 80, gap: 8,
    foot: { x: 36, y: [300, 322] },
  },
};

function drawFramesPanel(ctx, model, media, L, k, pal) {
  if (k <= 0) return;
  const P = PANELS[L.kind];
  const slots = stripRects(L.nodes.strip);
  ctx.save();
  ctx.globalAlpha = 0.95 * k;
  ctx.fillStyle = pal.paper;
  roundRect(ctx, P.back.x, P.back.y, P.back.w, P.back.h, 10);
  ctx.fill();
  ctx.globalAlpha = 1;

  const put = (img, r, stroke, width = 1.2) => {
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  };
  put(media.crop, lerpRect(L.nodes.crop, P.src, k), pal.accent, 1.8);
  put(media.frames.yaw08[0], lerpRect(slots[0], P.gen0, k), pal.ink, 1.8);

  ['yaw08', 'yaw16'].forEach((id, row) => {
    const cs = model.cases[id];
    cs.publicFrames.forEach((f, i) => {
      const to = { x: P.rowX + i * (P.size + P.gap), y: P.rowY[row], w: P.size, h: P.size };
      put(media.frames[id][i], lerpRect(slots[i], to, k), pal.line);
    });
  });

  ctx.globalAlpha = k;
  drawText(ctx, '入力（手動crop）', P.src.x, P.pairLabelY, { size: 12, weight: 700, color: pal.accent, max: P.src.w });
  drawText(ctx, '生成 #0（オフセット0）', P.gen0.x, P.pairLabelY, { size: 12, weight: 700, color: pal.ink, max: P.gen0.w });
  ['yaw08', 'yaw16'].forEach((id, row) => {
    const cs = model.cases[id];
    drawText(ctx, `入力yaw ±${cs.amplitude}°・保存済みの結果`, P.rowX, P.rowLabelY[row], { size: 12, weight: 800, color: pal.ink, max: 5 * P.size });
    cs.publicFrames.forEach((f, i) => {
      const x = P.rowX + i * (P.size + P.gap);
      drawText(ctx, `#${f.index} ${fmtSigned(f.offset)}°`, x, P.rowY[row] + P.size + 10,
        { size: 10, weight: 600, color: pal.muted, max: P.size });
    });
  });
  drawText(ctx, '36コマのうち代表5枚。どれもGが描いた実際のPNG。', P.foot.x, P.foot.y[0], { size: 11, weight: 600, color: pal.ink, max: 330 });
  drawText(ctx, '#0 と #35 は同じバイト列。入力の1枚とは別物。', P.foot.x, P.foot.y[1], { size: 11, weight: 600, color: pal.muted, max: 330 });
  ctx.restore();
}

// 場面ごとの状態：p は場面内の進み（0〜1）
const PLANS = {
  identity(p, { L }) {
    const [x, y] = along(joinPaths(L.edges.readme_author, L.edges.author_operator), span(p, 0.12, 0.8));
    return { caseId: 'yaw08', frame: 0, focus: ['readme', 'author', 'operator', 'F', 'M', 'W', 'G'], tokens: [{ kind: 'doc', x, y }] };
  },
  source(p, { model, L }) {
    const tokens = [];
    if (p >= 0.12 && p < 0.55) {
      const r = lerpRect(cropBoxRect(model, L.nodes.orig), L.nodes.crop, span(p, 0.12, 0.55));
      tokens.push({ kind: 'image', img: 'crop', x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w, h: r.h });
    } else if (p >= 0.55) {
      const k = span(p, 0.58, 0.92);
      const [x, y] = along(L.edges.crop_resize, k);
      const s = lerp(30, 16, k);
      tokens.push({ kind: 'image', img: 'crop', x, y, w: s, h: s, alpha: 1 - span(p, 0.9, 1) });
    }
    return { caseId: 'yaw08', frame: 0, focus: ['operator', 'orig', 'crop', 'resize'], tokens };
  },
  split(p, { L }) {
    const k = span(p, 0.12, 0.7);
    const arrived = p >= 0.7;
    const tokens = [];
    if (!arrived) {
      const [fx, fy] = along(L.edges.resize_F, k);
      const [mx, my] = along(L.edges.resize_M, k);
      tokens.push({ kind: 'cube', x: fx, y: fy, s: lerp(14, 26, k) }, { kind: 'points', x: mx, y: my, s: lerp(18, 34, k) });
    }
    return { caseId: 'yaw08', frame: 0, focus: ['resize', 'F', 'M'], tokens, hideGlyphs: { F: !arrived, M: !arrived } };
  },
  'manual-yaw'(p, { L }) {
    const tokens = [];
    if (p < 0.18) {
      const [x, y] = along(L.edges.author_yaw, span(p, 0, 0.18));
      tokens.push({ kind: 'dot', x, y });
    } else if (p < 0.35) {
      const [x, y] = along(L.edges.yaw_T, span(p, 0.18, 0.35));
      tokens.push({ kind: 'dot', x, y });
    }
    const frame = p < 0.35 ? 0 : Math.min(35, Math.floor(((p - 0.35) / 0.65) * 36));
    return { caseId: 'yaw16', frame, focus: ['author', 'yaw', 'M', 'T'], tokens, reveal: { yaw: clamp01((p - 0.04) / 0.28) } };
  },
  rejoin(p, { model, media, L }) {
    const cs = model.cases.yaw16;
    const frame = 9;
    const E = L.edges;
    const W = L.nodes.W;
    const wc = centerOf(W);
    const slot = stripRects(L.nodes.strip)[1];
    const tokens = [];
    if (p < 0.55) {
      const [fx, fy] = along(E.F_W, span(p, 0.02, 0.5));
      const [tx, ty] = along(E.T_W, span(p, 0.15, 0.5));
      tokens.push({ kind: 'cube', x: fx, y: fy, s: 22 }, { kind: 'points', x: tx, y: ty, s: 30, pts: cs.stitched[frame] });
    } else if (p < 0.64) {
      const k = span(p, 0.55, 0.64);
      const fEnd = E.F_W[E.F_W.length - 1];
      const tEnd = E.T_W[E.T_W.length - 1];
      tokens.push(
        { kind: 'cube', x: lerp(fEnd[0], wc[0], k), y: lerp(fEnd[1], wc[1], k), s: lerp(22, 12, k), alpha: 1 - 0.5 * k },
        { kind: 'points', x: lerp(tEnd[0], wc[0], k), y: lerp(tEnd[1], wc[1], k), s: lerp(30, 16, k), pts: cs.stitched[frame], alpha: 1 - 0.5 * k },
      );
    } else if (p < 0.78) {
      const [x, y] = along(E.W_G, span(p, 0.64, 0.78));
      tokens.push({ kind: 'dot', x, y, color: FILM_PALETTE.ink });
    } else {
      const k = span(p, 0.78, 0.97);
      const [x, y] = along(joinPaths(E.G_strip, [centerOf(slot)]), k);
      const s = lerp(14, slot.w, k);
      tokens.push({ kind: 'image', img: media.frames.yaw16[1], x, y, w: s, h: s, stroke: FILM_PALETTE.ink });
    }
    return { caseId: 'yaw16', frame, focus: ['F', 'T', 'W', 'G', 'strip'], tokens };
  },
  frames(p, { model, media, L }) {
    const k = span(p, 0, 0.18) * (1 - span(p, 0.86, 1));
    return {
      caseId: 'yaw08', frame: 0, focus: ['strip'], tokens: [],
      overlay: (ctx, pal) => drawFramesPanel(ctx, model, media, L, k, pal),
    };
  },
  use(p, { L }) {
    const E = L.edges;
    const tokens = [];
    if (p < 0.45) {
      const [x, y] = along(joinPaths(E.strip_mp4, E.mp4_use), span(p, 0.04, 0.45));
      tokens.push({ kind: 'dot', x, y, color: FILM_PALETTE.ok });
    }
    return { caseId: 'yaw08', frame: 9, focus: ['strip', 'mp4', 'use'], tokens, facts: true };
  },
};

function drawBand(ctx, geo, width, story, si, model, showFacts, pal) {
  const { k, bandH, orient } = geo;
  const s = story.scenes[si];
  ctx.save();
  ctx.strokeStyle = pal.faint;
  ctx.lineWidth = Math.max(1, k);
  ctx.beginPath();
  ctx.moveTo(24 * k, bandH - 6 * k);
  ctx.lineTo(width - 24 * k, bandH - 6 * k);
  ctx.stroke();

  const dotsW = 7 * 18 * k;
  const dotsX = width - 28 * k - dotsW;
  const dotsY = orient === 'wide' ? bandH / 2 : 40 * k;
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.arc(dotsX + i * 18 * k + 9 * k, dotsY, 5 * k, 0, Math.PI * 2);
    ctx.fillStyle = i === si ? pal.accent : pal.faint;
    ctx.fill();
  }

  const rec = model.cases.yaw08.video.record;
  const facts = `MP4 ${rec.width}×${rec.height}・${rec.decoded_frames}コマ・${model.cases.yaw08.fps}fps・${rec.stream_duration_seconds}秒・音声なし`;
  if (orient === 'wide') {
    const x = 28 * k;
    drawText(ctx, `${si + 1}  ${s.kicker}`, x, bandH / 2, { size: 18 * k, weight: 800, color: pal.accent });
    const kw = ctx.measureText(`${si + 1}  ${s.kicker}`).width;
    drawText(ctx, s.caption, x + kw + 18 * k, bandH / 2, { size: 27 * k, weight: 800, color: pal.ink, max: 560 * k });
    if (showFacts) drawText(ctx, facts, dotsX - 20 * k, bandH / 2, { size: 16 * k, weight: 600, color: pal.muted, align: 'right', max: 400 * k });
  } else {
    drawText(ctx, `${si + 1}  ${s.kicker}`, 32 * k, 40 * k, { size: 20 * k, weight: 800, color: pal.accent, max: dotsX - 48 * k });
    drawText(ctx, s.caption, 32 * k, 80 * k, { size: 33 * k, weight: 800, color: pal.ink, max: width - 64 * k });
    if (showFacts) drawText(ctx, facts, 32 * k, 106 * k, { size: 16 * k, weight: 600, color: pal.muted, max: width - 64 * k });
  }
  ctx.restore();
}

// 任意の時刻 t（秒）の完成した1コマを描く。
export function drawFilm(ctx, model, media, story, t, { width, height }) {
  const pal = FILM_PALETTE;
  const T = Math.min(DURATION, Math.max(0, Number.isFinite(t) ? t : 0));
  const geo = filmGeometry(width, height);
  const si = sceneIndexAt(story, T);
  const s = story.scenes[si];
  const p = clamp01((T - s.start) / (s.end - s.start));
  const plan = PLANS[s.id](p, { model, media, L: geo.L });

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, width, height);
  drawBand(ctx, geo, width, story, si, model, Boolean(plan.facts), pal);

  ctx.save();
  ctx.translate(geo.ox, geo.oy);
  ctx.scale(geo.scale, geo.scale);
  drawMap(ctx, model, media, {
    layout: geo.L, pal, caseId: plan.caseId, frame: plan.frame, focus: plan.focus, tokens: plan.tokens,
    reveal: plan.reveal, hideGlyphs: plan.hideGlyphs, dim: 0.28,
  });
  if (plan.overlay) plan.overlay(ctx, pal);
  ctx.restore();
}
