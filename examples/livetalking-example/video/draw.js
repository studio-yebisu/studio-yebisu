// 解説動画の1コマを、時刻 t だけから描く。乱数・タイマー・前のコマの積算は使わない。
// 図・部品の形・色は作例ページと同じ ../app.js のもの。画像は照合済みの実ファイル（肖像・顔・マスク・代表5枚）だけ。

import { phoneLayout, WIDE_LAYOUT, drawMap, drawText, along, joinPaths, PALETTE } from '../app.js';

export const DURATION = 32;
export const CASE_ID = 'default';
const FINAL_STILL = 29.5;

export const SCENES = [
  { id: 'whole', start: 0, end: 4.5, name: '何か', title: 'LiveTalkingは部品をつなぐ', line: '声・顔・出力口をつなぐPythonエンジン' },
  { id: 'inputs', start: 4.5, end: 9, name: '入力', title: '渡すのは既存の2つ', line: '同じ肖像1枚と、英語のWAV' },
  { id: 'face', start: 9, end: 13.5, name: '顔の準備', title: '顔は一度だけ準備', line: '下半分を黒・全体 → 1つの潜在' },
  { id: 'voice', start: 13.5, end: 18, name: '声の分岐', title: '声は2つの道へ', line: '20ms片→特徴／生の音は別の道' },
  { id: 'merge', start: 18, end: 22.5, name: '合流', title: 'U-Netで1回だけ合流', line: '潜在＋特徴 → 顔の部分' },
  { id: 'pair', start: 22.5, end: 27, name: '組と貼り戻し', title: '顔と生の音を組にする', line: '声のコマは貼り戻し・待機は元画像' },
  { id: 'files', start: 27, end: 32, name: '実ファイル', title: '実ファイルが返る', line: 'PNG・WAV→MP4、そのまま保存' },
];

const PHONE = phoneLayout(360);
const TOP = 72;
const FOOT = 56;
const PORTRAIT_DESIGN = { w: PHONE.w, h: TOP + PHONE.h + FOOT };
const WIDE_DESIGN = { w: WIDE_LAYOUT.w, h: WIDE_LAYOUT.h };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => {
  const v = clamp01(x);
  return v * v * (3 - 2 * v);
};
const seg = (p, a, b) => ease((p - a) / (b - a));
const inside = (p, a, b) => p >= a && p < b;

export function sceneIndexAt(t) {
  const tt = Math.min(DURATION, Math.max(0, t));
  for (let i = SCENES.length - 1; i >= 0; i -= 1) if (tt >= SCENES[i].start) return i;
  return 0;
}

const center = (n) => [n.x + n.w / 2, n.y + n.h / 2];

// 場面 i の進み p（0〜1）から、強調・動く印・状態を決める。
function stateAt(t, L, media, model) {
  const i = sceneIndexAt(t);
  const sc = SCENES[i];
  const p = clamp01((t - sc.start) / (sc.end - sc.start));
  const N = L.nodes;
  const E = L.edges;
  const tokens = [];
  const glow = {};
  let focus = null;
  const latentLit = t >= SCENES[2].start + (SCENES[2].end - SCENES[2].start) * 0.6;
  const at = (path, u) => along(path, u);
  const frames = media ? media.frames[CASE_ID] : [];

  if (sc.id === 'whole') {
    if (inside(p, 0.08, 0.78)) {
      const [x, y] = at(L.actorsPath, seg(p, 0.08, 0.72));
      tokens.push({ kind: 'doc', x, y, s: 18 });
    }
    if (p >= 0.72) glow.engine = true;
  } else if (sc.id === 'inputs') {
    focus = ['readme', 'author', 'operator', 'portrait', 'wav', 'prep', 'chunks'];
    if (p < 0.32) {
      const [x, y] = at(joinPaths(E.author_operator, E.operator_engine), seg(p, 0, 0.3));
      tokens.push({ kind: 'doc', x, y, s: 18 });
    }
    if (inside(p, 0.3, 0.86)) {
      const u = seg(p, 0.3, 0.8);
      const [ix, iy] = at(joinPaths([center(N.portrait)], E.portrait_prep, [center(N.prep)]), u);
      const [ax, ay] = at(joinPaths([center(N.wav)], E.wav_chunks, [center(N.chunks)]), u);
      tokens.push({ kind: 'img', img: 'portrait', x: ix, y: iy, s: 26, tag: '肖像' });
      tokens.push({ kind: 'chunk', x: ax, y: ay, s: 22, n: 3, tag: 'WAV' });
    }
    if (p >= 0.8) { glow.prep = true; glow.chunks = true; }
  } else if (sc.id === 'face') {
    focus = ['portrait', 'prep', 'latent'];
    const [sx, sy] = center(N.prep);
    const [ex, ey] = center(N.latent);
    if (p < 0.62) {
      const u = seg(p, 0.06, 0.58);
      const x = sx + (ex - sx) * u;
      const y = sy + (ey - sy) * u;
      const off = 16 * (1 - u);
      const vertical = Math.abs(ey - sy) > Math.abs(ex - sx);
      tokens.push({ kind: 'img', img: 'masked', x: vertical ? x - off : x, y: vertical ? y : y - off, s: 26, tag: '下半分黒' });
      tokens.push({ kind: 'img', img: 'face', x: vertical ? x + off : x, y: vertical ? y : y + off, s: 26, tag: '全体' });
    } else if (p < 0.8) {
      tokens.push({ kind: 'tiles', x: ex, y: ey, s: 14 + 6 * seg(p, 0.62, 0.72) });
    }
    if (p >= 0.6) glow.latent = true;
  } else if (sc.id === 'voice') {
    focus = ['wav', 'chunks', 'whisper', 'queue', 'unet'];
    const toWhisper = joinPaths([center(N.chunks)], E.chunks_whisper, [center(N.whisper)]);
    if (p < 0.42) {
      const [x, y] = at(toWhisper, seg(p, 0.04, 0.4));
      tokens.push({ kind: 'chunk', x, y, s: 20, n: 2 });
    } else if (p < 0.62) {
      const [x, y] = center(N.whisper);
      tokens.push({ kind: 'grid', x, y, s: 20 });
    }
    // 生の音の片は特徴にならず、別の道で組へ向かう（はっきり見える3つの印）。
    for (let k = 0; k < 3; k += 1) {
      const u = seg(p, 0.18 + 0.1 * k, 0.78 + 0.07 * k);
      if (p > 0.18 + 0.1 * k) {
        const [x, y] = at(E.raw_bypass, u);
        tokens.push({ kind: 'chunk', x, y, s: 22, n: 2, tag: k === 0 ? '生の音' : null });
      }
    }
    if (p >= 0.85) glow.queue = true;
  } else if (sc.id === 'merge') {
    focus = ['latent', 'whisper', 'unet', 'queue'];
    // 生の音2片は、別の道の終わりで顔の部分を待つ。
    const [wx0, wy0] = at(E.raw_bypass, 0.96);
    tokens.push({ kind: 'chunk', x: wx0, y: wy0, s: 18, n: 2, alpha: 0.95 });
    if (p < 0.5) {
      const u = seg(p, 0.04, 0.46);
      const [lx, ly] = at(joinPaths([center(N.latent)], E.latent_unet, [center(N.unet)]), u);
      const [wx, wy] = at(joinPaths([center(N.whisper)], E.whisper_unet, [center(N.unet)]), u);
      tokens.push({ kind: 'tiles', x: lx, y: ly, s: 13 }, { kind: 'grid', x: wx, y: wy, s: 18 });
    } else if (p < 0.6) {
      glow.unet = true;
      const [ux, uy] = center(N.unet);
      tokens.push({ kind: 'dot', x: ux, y: uy + 14, r: 5 + 4 * seg(p, 0.5, 0.58) });
    } else {
      glow.unet = true;
      const [x, y] = at(joinPaths([center(N.unet)], E.unet_queue, [center(N.queue)]), seg(p, 0.6, 0.94));
      tokens.push({ kind: 'patch', x, y, s: 22 });
    }
  } else if (sc.id === 'pair') {
    focus = ['queue', 'paste', 'portrait', 'webrtc', 'capture', 'strip'];
    const [qx, qy] = center(N.queue);
    if (p < 0.22) {
      // 顔の部分と、待っていた生の音2片が1組になる。
      const u = seg(p, 0, 0.18);
      const [wx0, wy0] = at(E.raw_bypass, 0.96);
      tokens.push({ kind: 'patch', x: qx - 8, y: qy, s: 22 });
      tokens.push({ kind: 'chunk', x: wx0 + (qx + 14 - wx0) * u, y: wy0 + (qy - wy0) * u, s: 18, n: 2 });
    } else if (p < 0.52) {
      const [x, y] = at(joinPaths([center(N.queue)], E.queue_paste, [center(N.paste)]), seg(p, 0.22, 0.5));
      tokens.push({ kind: 'pair', x, y, s: 20 });
    }
    if (inside(p, 0.04, 0.52)) {
      const [x, y] = at(E.canvas_bypass, seg(p, 0.04, 0.5));
      tokens.push({ kind: 'img', img: 'portrait', x, y, s: 26, tag: '元画像' });
    }
    if (p >= 0.5) glow.paste = true;
    if (p >= 0.6) {
      const lead = seg(p, 0.6, 0.86);
      const next = seg(p, 0.7, 0.96);
      if (frames[0]) {
        const [x, y] = at(L.outPath, lead);
        tokens.push({ kind: 'img', el: frames[0], x, y, s: 28, stroke: PALETTE.idle, tag: '待機' });
      }
      if (frames[1] && p >= 0.7) {
        const [x, y] = at(L.outPath, next);
        tokens.push({ kind: 'img', el: frames[1], x, y, s: 28, stroke: PALETTE.accent, tag: `#${model.cases[CASE_ID].reps[1].index}` });
      }
    }
  } else {
    focus = ['capture', 'strip', 'timeline', 'mp4', 'use', 'files'];
    if (t < FINAL_STILL && p < 0.45 && frames[1]) {
      const [x, y] = at(L.usePath, seg(p, 0.02, 0.4));
      tokens.push({ kind: 'img', el: frames[1], x, y, s: 26, stroke: PALETTE.accent });
    }
    if (t >= 27 + 5 * 0.4) glow.use = true;
  }
  return { i, sc, p, focus, tokens, glow, latentLit };
}

function drawDots(ctx, cx, y, active, r) {
  const gap = r * 3.2;
  const x0 = cx - (gap * (SCENES.length - 1)) / 2;
  SCENES.forEach((_, k) => {
    ctx.beginPath();
    ctx.arc(x0 + k * gap, y, k === active ? r * 1.25 : r, 0, Math.PI * 2);
    ctx.fillStyle = k === active ? PALETTE.accent : PALETTE.faint;
    ctx.fill();
  });
}

// v: { orient: 'portrait'|'wide', t, width, height }
export function drawFrame(ctx, model, media, v) {
  const t = Math.min(DURATION, Math.max(0, Number(v.t) || 0));
  const wide = v.orient === 'wide';
  const L = wide ? WIDE_LAYOUT : PHONE;
  const D = wide ? WIDE_DESIGN : PORTRAIT_DESIGN;
  const k = Math.min(v.width / D.w, v.height / D.h);
  const ox = (v.width - D.w * k) / 2;
  const oy = (v.height - D.h * k) / 2;
  const st = stateAt(t, L, media, model);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, v.width, v.height);
  ctx.setTransform(k, 0, 0, k, ox, oy);

  if (wide) {
    drawMap(ctx, model, media, {
      layout: L, pal: PALETTE, caseId: CASE_ID, focus: st.focus, tokens: st.tokens, glow: st.glow,
      latentLit: st.latentLit, caption: { title: `${st.i + 1}/7　${st.sc.title}`, line: st.sc.line }, miniLegend: true,
    });
  } else {
    drawText(ctx, `${st.i + 1}/7`, 12, 20, { size: 13, weight: 800, color: PALETTE.accent });
    drawText(ctx, st.sc.title, 46, 20, { size: 21, weight: 800, color: PALETTE.ink, max: D.w - 58 });
    drawText(ctx, st.sc.line, 12, 52, { size: 15, weight: 700, color: PALETTE.muted, max: D.w - 24 });
    ctx.save();
    ctx.translate(0, TOP);
    drawMap(ctx, model, media, {
      layout: L, pal: PALETTE, caseId: CASE_ID, focus: st.focus, tokens: st.tokens, glow: st.glow, latentLit: st.latentLit,
    });
    ctx.restore();
    const fy = TOP + L.h;
    drawDots(ctx, D.w / 2, fy + 12, st.i, 4);
    drawText(ctx, '実データ＝画像・波形・回数・帯／説明の形＝片・格子・動く印', D.w / 2, fy + 30, { size: 11, weight: 600, color: PALETTE.ink, align: 'center', max: D.w - 16 });
    drawText(ctx, '例：保存済みの「戸締まりの声」。動きは説明で、処理時間ではない', D.w / 2, fy + 46, { size: 11, weight: 600, color: PALETTE.muted, align: 'center', max: D.w - 16 });
  }
  ctx.restore();
  return st.i;
}
