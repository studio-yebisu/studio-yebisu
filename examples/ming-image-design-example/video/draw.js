// 32秒・無音の解説動画の描画。同じ1枚の図を、時刻だけから描く（乱数・タイマー・前のコマの積算なし）。
// 画像は照合した実際のPNG 1枚だけ。粒・枠・目盛り・四角は説明の形で、測った内部の値や途中の画像ではない。

import { NODES, EDGES, edgeCurve, bezierAt, formatNumber, VerifyError } from '../app.js';

export const DURATION = 32;
export const SCENE_IDS = ['identity', 'handoff', 'read', 'split', 'draw', 'png', 'use'];
const STILL_FROM = 29.6; // ここから先は動きを止める（30秒・31秒が同じ絵になる）

const C = {
  paper: '#f6f0e1', card: '#fffaf0', hi: '#fffdf7', faint: '#ece3cd', frame: '#efe7d2', ink: '#1b2a21',
  forest: '#1f3d2b', green: '#2f5d3f', ochre: '#b7791f', ochreInk: '#85560f', muted: '#45554a', line: '#c9bc9c',
  warn: '#f7e6c4', okBg: '#e3ecdf',
};
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", serif';
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "YuGothic", "Noto Sans JP", system-ui, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
const NODE = Object.fromEntries(NODES.map((n) => [n.id, n]));
const NOTES = [
  '図の動き・粒・時間の表示は説明用。測った内部の値や処理時間ではありません。',
  '図の動き・粒・時間の表示は説明用。測った内部の値や処理時間ではありません。',
  '粒の数と並びは説明の形。256はqueryの枠の数（公開デモのソースより）。',
  '道の形は公開デモのソースに基づく説明。内部の値は測っていません。',
  '粒・12の目盛り・四角は説明の形。実際の途中画像は保存していません。',
  '画像は保存した実際のPNG 1枚をそのまま表示。新しい生成はしていません。',
  '確認は制作担当が目で読んだ記録とαの数え方。人の承認ではありません。',
];

// 縦と横はそれぞれの大きさで組み直す（片方を拡大縮小しない）。
export const FILM_LAYOUTS = {
  portrait: {
    w: 720, h: 1280, pad: 36, label: 26, sub: 20, badge: 24, radius: 12, chip: 18,
    head: { kicker: 21, kickerY: 56, title: 40, titleY: 106, msg: 25, msgY: 148, msgLine: 34, maxW: 648 },
    frame: { x: 16, y: 488, w: 688, h: 362, labelX: 30, labelY: 512, label: 19 },
    nodes: {
      docs: [30, 214, 315, 72], brief: [375, 214, 315, 72],
      author: [160, 308, 400, 72],
      operator: [30, 402, 315, 72], space: [375, 402, 315, 72],
      tokens: [130, 524, 460, 62], thinker: [130, 598, 460, 64],
      connector: [30, 678, 315, 72], direct: [375, 678, 315, 72],
      noise: [30, 766, 190, 72], dit: [240, 766, 240, 72], vae: [500, 766, 190, 72],
      png: [30, 868, 330, 350], check: [380, 868, 310, 250], use: [380, 1132, 310, 86],
    },
    png: { labelY: 34, subY: 62, top: 74, sha: 17 },
    check: { titleY: 36, rowY: 74, rowLine: 34, row: 19, mark: 16, alphaY: 222, alpha: 17 },
    read: { chips: [34, 530, 86, 104], chipsLabel: [77, 654], grid: [600, 530, 84, 84], gridLabel: [642, 636], tag: 16 },
    foot: { barY: 1234, barH: 7, noteY: 1266, note: 17 },
  },
  landscape: {
    w: 1280, h: 720, pad: 28, label: 21, sub: 15, badge: 19, radius: 10, chip: 14,
    head: { kicker: 17, kickerY: 36, title: 34, titleY: 78, msg: 21, msgY: 112, msgLine: 28, maxW: 1224 },
    frame: { x: 372, y: 150, w: 628, h: 450, labelX: 386, labelY: 172, label: 16 },
    nodes: {
      docs: [20, 160, 165, 66], brief: [199, 160, 165, 66],
      author: [20, 252, 344, 64],
      operator: [20, 342, 344, 64], space: [20, 432, 344, 64],
      tokens: [388, 196, 190, 60], thinker: [388, 280, 190, 64],
      connector: [600, 196, 190, 64], direct: [600, 300, 180, 64],
      noise: [388, 410, 190, 64], dit: [812, 400, 178, 70], vae: [812, 510, 178, 64],
      png: [1016, 150, 244, 290], check: [1016, 452, 244, 150], use: [1016, 612, 244, 50],
    },
    png: { labelY: 28, subY: 50, top: 60, sha: 13 },
    check: { titleY: 27, rowY: 52, rowLine: 21, row: 15, mark: 12, alphaY: 140, alpha: 13 },
    read: { chips: [392, 352, 96, 40], chipsLabel: [440, 404], grid: [500, 350, 48, 48], gridLabel: [566, 380], tag: 12 },
    foot: { barY: 670, barH: 6, noteY: 704, note: 15 },
  },
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => { const x = clamp01(v); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const span = (p, a, b) => clamp01((p - a) / (b - a));
const box = (a) => ({ x: a[0], y: a[1], w: a[2], h: a[3] });

// seed と位置だけから決まる値（説明の粒の色に使う。実際のノイズの値ではない）。
function hash(a, b) {
  let x = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ 20261020;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function validateStoryboard(sb) {
  if (!sb || sb.schema !== 'ming-film-storyboard@1' || sb.duration !== DURATION || sb.fps !== 30 || sb.audio !== 'none' ||
    !Array.isArray(sb.scenes) || sb.scenes.length !== SCENE_IDS.length) {
    throw new VerifyError('絵コンテ（video/storyboard.json）の形式が違います');
  }
  const ids = new Set(NODES.map((n) => n.id));
  sb.scenes.forEach((s, i) => {
    const start = i === 0 ? 0 : sb.scenes[i - 1].end;
    const ok = s && s.id === SCENE_IDS[i] && s.start === start && Number.isFinite(s.end) && s.end > s.start &&
      typeof s.title === 'string' && s.title.length > 0 && s.title.length <= 40 &&
      typeof s.message === 'string' && s.message.length > 0 && s.message.length <= 60 &&
      Array.isArray(s.focus) && s.focus.every((f) => ids.has(f));
    if (!ok) throw new VerifyError(`絵コンテの場面 ${i + 1} が不正です`);
  });
  if (sb.scenes[sb.scenes.length - 1].end !== DURATION) throw new VerifyError('絵コンテの長さが32秒ではありません');
  return sb;
}

export function sceneAt(scenes, t) {
  let i = 0;
  for (let k = 0; k < scenes.length; k++) if (t >= scenes[k].start) i = k;
  return i;
}

function roundRect(ctx, x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

function text(ctx, str, x, y, { size, weight = 400, family = SANS, color = C.ink, align = 'left', maxW } = {}) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (maxW) ctx.fillText(str, x, y, maxW); else ctx.fillText(str, x, y);
}

const NO_START = '、。，．）」』・ー：';
function wrap(ctx, str, maxW) {
  const lines = [];
  let line = '';
  for (const ch of str) {
    if (line && ctx.measureText(line + ch).width > maxW && !NO_START.includes(ch)) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// 線の上を進む点：複数の曲線をつないだ折れ線の上で、全長に対する割合 f の位置。
function pathPoints(curves) {
  const pts = [];
  for (const c of curves) for (let k = 0; k <= 24; k++) pts.push(bezierAt(c, k / 24));
  return pts;
}
function along(pts, f) {
  const lens = [0];
  for (let k = 1; k < pts.length; k++) lens.push(lens[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const target = clamp01(f) * lens[lens.length - 1];
  for (let k = 1; k < pts.length; k++) {
    if (lens[k] >= target) {
      const seg = lens[k] - lens[k - 1] || 1;
      const u = (target - lens[k - 1]) / seg;
      return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u];
    }
  }
  return pts[pts.length - 1];
}

function chip(ctx, L, x, y, label, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${L.chip}px ${SANS}`;
  const w = ctx.measureText(label).width + L.chip * 1.1;
  const h = L.chip * 1.7;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = C.hi;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  text(ctx, label, x, y + L.chip * 0.36, { size: L.chip, weight: 700, color, align: 'center' });
  ctx.restore();
}

function glow(ctx, L, b, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.85 * amount;
  roundRect(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, L.radius + 6);
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.ochre;
  ctx.stroke();
  ctx.restore();
}

function noisePatch(ctx, x, y, size, alpha) {
  const n = 8, c = size / n;
  ctx.save();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = hash(i, j);
      ctx.globalAlpha = alpha * (0.45 + 0.55 * hash(j + 11, i + 5));
      ctx.fillStyle = v < 0.34 ? C.green : v < 0.67 ? '#cfc3a2' : C.ochre;
      ctx.fillRect(x + i * c, y + j * c, c + 0.4, c + 0.4);
    }
  }
  ctx.restore();
}

function drawHeader(ctx, L, sc, i, time) {
  const H = L.head;
  const a = i === 0 ? 1 : ease((time - sc.start) / 0.4);
  text(ctx, `Ming Image 0.1 Design ・ ${i + 1} / 7 ・ 無音`, L.pad, H.kickerY, { size: H.kicker, weight: 700, color: C.ochreInk });
  ctx.save();
  ctx.globalAlpha = a;
  text(ctx, sc.title, L.pad, H.titleY, { size: H.title, weight: 800, family: SERIF, color: C.forest, maxW: H.maxW });
  ctx.font = `500 ${H.msg}px ${SANS}`;
  wrap(ctx, sc.message, H.maxW).slice(0, 2).forEach((line, k) => {
    text(ctx, line, L.pad, H.msgY + k * H.msgLine, { size: H.msg, weight: 500, color: C.ink, maxW: H.maxW });
  });
  ctx.restore();
}

function drawModelFrame(ctx, L, amount) {
  const F = L.frame;
  ctx.save();
  roundRect(ctx, F.x, F.y, F.w, F.h, 16);
  ctx.fillStyle = C.frame;
  ctx.fill();
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.green;
  ctx.stroke();
  ctx.setLineDash([]);
  if (amount > 0) {
    ctx.globalAlpha = amount;
    ctx.lineWidth = 5;
    ctx.strokeStyle = C.ochre;
    ctx.stroke();
  }
  ctx.restore();
  text(ctx, 'モデルの中（公開デモのソースに基づく説明）', F.labelX, F.labelY, { size: F.label, weight: 700, color: C.green });
}

function drawEdges(ctx, L, B, focus, tm) {
  for (const e of EDGES) {
    const c = edgeCurve(B[e.from], B[e.to]);
    const on = focus.has(e.from) && focus.has(e.to);
    const color = e.kind === 'query' ? C.ochre : e.kind === 'direct' ? C.forest : C.green;
    const base = e.kind === 'direct' ? 3.4 : e.kind === 'query' ? 3 : 2.4;
    ctx.save();
    ctx.globalAlpha = on ? 1 : 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = on ? base + 1.2 : base;
    if (on) { ctx.setLineDash([10, 8]); ctx.lineDashOffset = -tm * 40; }
    ctx.beginPath();
    ctx.moveTo(...c.p0);
    ctx.bezierCurveTo(...c.c1, ...c.c2, ...c.p3);
    ctx.stroke();
    ctx.setLineDash([]);
    let dx = c.p3[0] - c.c2[0], dy = c.p3[1] - c.c2[1];
    if (Math.hypot(dx, dy) < 0.01) { dx = c.p3[0] - c.p0[0]; dy = c.p3[1] - c.p0[1]; }
    const ang = Math.atan2(dy, dx), s = L.chip * 0.6;
    ctx.translate(...c.p3);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 1.4, -s * 0.75);
    ctx.lineTo(-s * 1.4, s * 0.75);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
}

function nodeShell(ctx, L, id, b, w) {
  const n = NODE[id];
  ctx.globalAlpha = 0.8 + 0.2 * w;
  roundRect(ctx, b.x, b.y, b.w, b.h, L.radius);
  ctx.fillStyle = w > 0.5 ? C.hi : C.card;
  ctx.fill();
  ctx.lineWidth = 2 + 2 * w;
  ctx.strokeStyle = w > 0.5 ? C.ochreInk : C.green;
  ctx.stroke();
  const bs = L.badge;
  roundRect(ctx, b.x + 8, b.y + 8, bs, bs, 4);
  ctx.fillStyle = C.ochre;
  ctx.fill();
  text(ctx, String(n.part), b.x + 8 + bs / 2, b.y + 8 + bs * 0.74, { size: Math.round(bs * 0.66), weight: 800, color: '#fff', align: 'center' });
  return b.x + 8 + bs + 10;
}

function drawPlainNode(ctx, L, id, b, w, subText) {
  ctx.save();
  const x = nodeShell(ctx, L, id, b, w);
  const n = NODE[id];
  const maxW = b.x + b.w - 10 - x;
  const sub = subText ?? n.sub;
  if (sub) {
    const top = b.y + (b.h - (L.label + 6 + L.sub)) / 2;
    const ly = top + L.label * 0.86;
    text(ctx, n.label, x, ly, { size: L.label, weight: 800, maxW });
    text(ctx, sub, x, ly + 6 + L.sub * 0.98, { size: L.sub, color: C.muted, maxW });
  } else {
    text(ctx, n.label, x, b.y + b.h / 2 + L.label * 0.36, { size: L.label, weight: 800, maxW });
  }
  ctx.restore();
}

function posterRect(L, b) {
  const P = L.png;
  const size = Math.min(b.w - 20, b.h - P.top - 10);
  return { x: b.x + (b.w - size) / 2, y: b.y + P.top, s: size };
}

function drawPngNode(ctx, L, b, w, data, shaAlpha) {
  const P = L.png;
  ctx.save();
  const x = nodeShell(ctx, L, 'png', b, w);
  const m = data.model;
  text(ctx, '実PNG', x, b.y + P.labelY, { size: L.label, weight: 800 });
  text(ctx, `${m.png.width}×${m.png.height}・RGBA・${formatNumber(m.summary.image.bytes)} B`, b.x + 10, b.y + P.subY,
    { size: L.sub, color: C.muted, maxW: b.w - 20 });
  if (shaAlpha > 0) {
    ctx.save();
    ctx.globalAlpha *= shaAlpha;
    text(ctx, `SHA-256 ${m.imageSha.slice(0, 8)}…`, b.x + b.w - 10, b.y + P.labelY, { size: P.sha, weight: 600, family: MONO, color: C.ochreInk, align: 'right', maxW: b.w * 0.55 });
    ctx.restore();
  }
  const r = posterRect(L, b);
  ctx.fillStyle = C.faint;
  ctx.fillRect(r.x - 2, r.y - 2, r.s + 4, r.s + 4);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(data.image, r.x, r.y, r.s, r.s);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x - 1, r.y - 1, r.s + 2, r.s + 2);
  ctx.restore();
}

function drawCheckNode(ctx, L, b, w, data, q) {
  const K = L.check;
  ctx.save();
  const x = nodeShell(ctx, L, 'check', b, w);
  text(ctx, NODE.check.label, x, b.y + K.titleY, { size: L.label, weight: 800, maxW: b.x + b.w - 10 - x });
  const rows = data.model.literal.rows;
  const markW = K.mark * 4.4;
  rows.forEach((r, k) => {
    const y = b.y + K.rowY + k * K.rowLine;
    const shown = q > 0.1 + k * 0.15;
    const warn = r.status === 'review_required';
    if (shown && warn) {
      ctx.fillStyle = C.warn;
      ctx.fillRect(b.x + 6, y - K.row * 1.05, b.w - 12, K.rowLine - 2);
    }
    text(ctx, r.expected, b.x + 12, y, { size: K.row, weight: 700, family: SERIF, color: shown ? C.forest : C.muted, maxW: b.w - 24 - markW });
    if (shown) {
      text(ctx, warn ? '要確認' : '読める', b.x + b.w - 12, y, { size: K.mark, weight: 800, color: warn ? C.ochreInk : C.green, align: 'right' });
    }
  });
  if (q > 0.7) {
    const a = data.model.alpha;
    ctx.save();
    ctx.globalAlpha *= span(q, 0.7, 0.85);
    text(ctx, `α ${a.alpha_min}〜${a.alpha_max}・透明 ${formatNumber(a.fully_transparent_pixels)}・半透明 ${formatNumber(a.partially_transparent_pixels)}`,
      b.x + 12, b.y + K.alphaY, { size: K.alpha, weight: 700, color: C.ochreInk, maxW: b.w - 24 });
    ctx.restore();
  }
  ctx.restore();
}

function drawUseNode(ctx, L, b, w, q) {
  ctx.save();
  const x = nodeShell(ctx, L, 'use', b, w);
  const sub = q > 0.85 ? 'PNG・依頼・記録を元のまま' : '';
  if (sub && b.h >= L.label + L.sub + 20) {
    const top = b.y + (b.h - (L.label + 6 + L.sub)) / 2;
    const ly = top + L.label * 0.86;
    text(ctx, NODE.use.label, x, ly, { size: L.label, weight: 800 });
    text(ctx, sub, x, ly + 6 + L.sub * 0.98, { size: L.sub, color: C.muted, maxW: b.x + b.w - 10 - x });
  } else {
    text(ctx, NODE.use.label, x, b.y + b.h / 2 + L.label * 0.36, { size: L.label, weight: 800 });
  }
  if (q > 0.85) {
    const cx = b.x + b.w - 26, cy = b.y + b.h / 2, r = Math.min(14, b.h / 2 - 6);
    ctx.globalAlpha = span(q, 0.85, 1);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = C.green;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.4);
    ctx.lineTo(cx + r * 0.55, cy - r * 0.4);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

function drawFooter(ctx, L, i) {
  const F = L.foot;
  const n = SCENE_IDS.length, gap = 6, total = L.w - L.pad * 2;
  const segW = (total - gap * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = k === i ? C.forest : k < i ? '#8fa894' : C.line;
    ctx.fillRect(L.pad + k * (segW + gap), F.barY, segW, F.barH);
  }
  text(ctx, NOTES[i], L.pad, F.noteY, { size: F.note, color: C.muted, maxW: total });
}

// 場面ごとの動く印（説明の形）。p は場面内の進み 0..1。
function overlay(ctx, L, B, sc, i, p, time, data) {
  const curve = (a, b) => edgeCurve(B[a], B[b]);
  if (i === 1) {
    const a = ease(span(p, 0, 0.32));
    if (p < 0.34) {
      chip(ctx, L, ...bezierAt(curve('docs', 'author'), a), 'README', C.green);
      chip(ctx, L, ...bezierAt(curve('brief', 'author'), a), '4つの文字', C.green);
    } else if (p < 0.66) {
      chip(ctx, L, ...bezierAt(curve('author', 'operator'), ease(span(p, 0.34, 0.64))), 'prompt・client', C.ochreInk);
    } else {
      chip(ctx, L, ...bezierAt(curve('operator', 'space'), ease(span(p, 0.66, 0.92))), '匿名POST ×1', C.ochreInk);
    }
  } else if (i === 2) {
    const R = L.read;
    const [cx, cy, cw, ch] = R.chips;
    const [gx, gy, gs] = R.grid;
    const th = B.thinker;
    const pull = ease(span(p, 0.55, 0.9));
    const fade = 1 - span(p, 0.8, 0.95);
    const tx = th.x + th.w / 2, ty = th.y + th.h / 2;
    const cols = cw > ch ? 3 : 1, rows = Math.ceil(6 / cols);
    const w = cw / cols - 4, h = Math.min(16, ch / rows - 4);
    ctx.save();
    for (let k = 0; k < 6; k++) {
      if (p < k * 0.05) continue;
      const x0 = cx + (k % cols) * (w + 4), y0 = cy + Math.floor(k / cols) * (h + 4);
      const x = x0 + (tx - x0) * pull, y = y0 + (ty - y0) * pull;
      ctx.globalAlpha = fade;
      roundRect(ctx, x, y, w * (1 - 0.6 * pull), h, 4);
      ctx.fillStyle = C.green;
      ctx.fill();
    }
    const ga = span(p, 0.15, 0.35) * fade;
    if (ga > 0) {
      const s = gs * (1 - 0.7 * pull);
      const ox = gx + (tx - gx - s / 2) * pull, oy = gy + (ty - gy - s / 2) * pull;
      const step = s / 16;
      ctx.globalAlpha = ga;
      ctx.fillStyle = C.ochre;
      for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) ctx.fillRect(ox + c * step + step * 0.2, oy + r * step + step * 0.2, step * 0.6, step * 0.6);
    }
    ctx.restore();
    const la = (1 - pull) * span(p, 0.1, 0.3);
    if (la > 0) {
      ctx.save();
      ctx.globalAlpha = la;
      text(ctx, 'prompt', R.chipsLabel[0], R.chipsLabel[1], { size: R.tag, weight: 700, color: C.green, align: 'center' });
      text(ctx, '256', R.gridLabel[0], R.gridLabel[1], { size: R.tag, weight: 800, color: C.ochreInk, align: 'center' });
      ctx.restore();
    }
    glow(ctx, L, th, span(p, 0.6, 0.8) * (1 - 0.4 * span(p, 0.9, 1)));
  } else if (i === 3) {
    const q = pathPoints([curve('thinker', 'connector'), curve('connector', 'dit')]);
    const d = pathPoints([curve('thinker', 'direct'), curve('direct', 'dit')]);
    ctx.save();
    for (let k = 0; k < 5; k++) {
      const f = span(p, k * 0.07, k * 0.07 + 0.6);
      if (f <= 0 || f >= 1) continue;
      const [x, y] = along(q, f);
      ctx.beginPath();
      ctx.arc(x, y, L.chip * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = C.ochre;
      ctx.fill();
    }
    const f = span(p, 0.05, 0.68);
    if (f > 0 && f < 1) {
      const [x, y] = along(d, f);
      ctx.strokeStyle = C.forest;
      ctx.lineWidth = 3.5;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(x - L.chip * 0.8, y + k * L.chip * 0.38);
        ctx.lineTo(x + L.chip * 0.8, y + k * L.chip * 0.38);
        ctx.stroke();
      }
    }
    ctx.restore();
    glow(ctx, L, B.dit, span(p, 0.7, 0.85));
  } else if (i === 4) {
    const nb = B.noise, size = Math.min(nb.h - 16, 36);
    const mv = ease(span(p, 0, 0.28));
    if (p < 0.3) {
      const [x, y] = bezierAt(curve('noise', 'dit'), mv);
      const s = size * (1 - 0.6 * mv);
      noisePatch(ctx, x - s / 2, y - s / 2, s, 1 - span(p, 0.22, 0.3));
    }
    const db = B.dit, steps = Math.floor(12 * span(p, 0.22, 0.82));
    const tw = (db.w - 24) / 12;
    for (let k = 0; k < 12; k++) {
      ctx.fillStyle = k < steps ? C.ochre : C.line;
      ctx.fillRect(db.x + 12 + k * tw + 1, db.y + db.h - 9, tw - 2, 5);
    }
    if (p > 0.78 && p < 0.88) {
      const [x, y] = bezierAt(curve('dit', 'vae'), ease(span(p, 0.78, 0.86)));
      const s = L.chip * 1.1;
      ctx.fillStyle = C.green;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    const colors = ['#b5523b', '#2f7d4f', '#3b5fa0', '#8a8a8a'];
    ['R', 'G', 'B', 'A'].forEach((ch, k) => {
      const f = ease(span(p, 0.84 + k * 0.025, 0.95 + k * 0.012));
      if (f <= 0 || f >= 1) return;
      const [x, y] = bezierAt(curve('vae', 'png'), f);
      const s = L.chip * 1.3;
      ctx.fillStyle = colors[k];
      ctx.fillRect(x - s / 2 + (k - 1.5) * s * 1.1, y - s / 2, s, s);
      text(ctx, ch, x + (k - 1.5) * s * 1.1, y + s * 0.3, { size: L.chip * 0.8, weight: 800, color: '#fff', align: 'center' });
    });
    glow(ctx, L, B.png, span(p, 0.93, 1));
  } else if (i === 5) {
    glow(ctx, L, B.png, 1);
  } else if (i === 6) {
    glow(ctx, L, B.png, 1 - ease(span(p, 0, 0.3)));
  }
}

const subOverride = (i, p) => {
  if (i === 3 && p > 0.7) return { dit: '2本の条件が合流' };
  if (i === 4) {
    const k = Math.floor(12 * span(p, 0.22, 0.82));
    return { dit: p < 0.22 ? 'Z-Image・CFG 1' : `更新 ${Math.max(1, k)}/12・CFG 1` };
  }
  return {};
};

// 任意の時刻 t の完成した1コマを描く。戻り値は場面の番号（0..6）。
export function drawFrame(ctx, data, { orient, t, width, height }) {
  const L = FILM_LAYOUTS[orient === 'landscape' ? 'landscape' : 'portrait'];
  const scenes = data.storyboard.scenes;
  const time = Math.min(DURATION, Math.max(0, Number(t) || 0));
  const i = sceneAt(scenes, time);
  const sc = scenes[i];
  const tm = Math.min(time, STILL_FROM);
  const p = clamp01((tm - sc.start) / (Math.min(sc.end, STILL_FROM) - sc.start));
  const B = Object.fromEntries(Object.entries(L.nodes).map(([k, v]) => [k, box(v)]));
  const cur = new Set(sc.focus);
  const prev = new Set(i > 0 ? scenes[i - 1].focus : sc.focus);
  const blend = ease((time - sc.start) / 0.35);
  const weight = (id) => {
    const a = prev.has(id) ? 1 : 0, b = cur.has(id) ? 1 : 0;
    return a + (b - a) * blend;
  };

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, width, height);
  const s = Math.min(width / L.w, height / L.h);
  ctx.translate((width - L.w * s) / 2, (height - L.h * s) / 2);
  ctx.scale(s, s);

  drawHeader(ctx, L, sc, i, time);
  drawModelFrame(ctx, L, i === 0 ? 0.35 + 0.65 * ease(tm / 1.6) : i === 1 ? 1 - ease((time - sc.start) / 0.4) : 0);
  drawEdges(ctx, L, B, cur, tm);
  const subs = subOverride(i, p);
  for (const n of NODES) {
    const w = weight(n.id);
    if (n.id === 'png') drawPngNode(ctx, L, B.png, w, data, i === 5 ? ease(span(p, 0.3, 0.5)) : i === 6 ? 1 : 0);
    else if (n.id === 'check') drawCheckNode(ctx, L, B.check, w, data, i === 6 ? p : 0);
    else if (n.id === 'use') drawUseNode(ctx, L, B.use, w, i === 6 ? p : 0);
    else drawPlainNode(ctx, L, n.id, B[n.id], w, subs[n.id]);
    if (n.id === 'noise') {
      const nb = B.noise, size = Math.min(nb.h - 16, 36);
      noisePatch(ctx, nb.x + nb.w - size - 8, nb.y + 8, size, 0.9);
    }
  }
  overlay(ctx, L, B, sc, i, p, time, data);
  drawFooter(ctx, L, i);
  ctx.restore();
  return i;
}
