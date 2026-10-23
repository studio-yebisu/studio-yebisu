// earshot SFX showreel — art & motion only. Pure function of time: no DOM, RAF, randomness or frame state.
(function () {
  const CREAM = '#f2eee3', INK = '#25241f', LIME = '#c4ef3d';
  const FONT = 'Arial, "Helvetica Neue", sans-serif', JP = 'Meiryo, "Yu Gothic", "Hiragino Sans", sans-serif';
  const DEF_CH = [
    { start: 0, end: 5, title: 'POP', caption: '現れる音' }, { start: 5, end: 10, title: 'WHOOSH', caption: '通り抜ける音' },
    { start: 10, end: 15, title: 'HIT', caption: '着地する音' }, { start: 15, end: 20, title: 'SHUTTER', caption: '切り取る音' },
    { start: 20, end: 25, title: 'PITCH', caption: '音程を変える' }, { start: 25, end: 30, title: 'FINALE', caption: '音を、コードで。' }];
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eo = x => 1 - Math.pow(1 - cl(x), 3);
  const eio = x => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const spring = d => d <= 0 ? 0 : 1 - Math.exp(-6 * d) * Math.cos(13 * d);
  const wob = d => d <= 0 ? 0 : Math.exp(-5 * d) * Math.sin(17 * d);

  function times(tl, a, b, def) {
    const e = ((tl && tl.events) || []).map(x => x.time).filter(x => x >= a && x < b).sort((x, y) => x - y);
    return e.length >= def.length ? e.slice(0, def.length) : def;
  }
  function blob(c, x, y, r, col, sx = 1, sy = 1, rot = 0) {
    if (r <= 0) return;
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(sx, sy);
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.restore();
  }
  function ring(c, x, y, r, col, lw, a = 1) {
    if (r <= 0 || lw <= 0 || a <= 0) return;
    c.save(); c.globalAlpha *= a; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.strokeStyle = col; c.lineWidth = lw; c.stroke(); c.restore();
  }
  function streaks(c, x, y, ang, len, S, n = 5) {
    if (len <= 1) return;
    c.save(); c.translate(x, y); c.rotate(ang); c.strokeStyle = INK; c.lineCap = 'round'; c.lineWidth = S * 0.035;
    for (let j = 0; j < n; j++) {
      const o = (j - (n - 1) / 2) * S * 0.13, l = len * (1 - Math.abs(j - (n - 1) / 2) * 0.18);
      c.beginPath(); c.moveTo(-S * 0.35, o); c.lineTo(-S * 0.35 - l, o); c.stroke();
    }
    c.restore();
  }

  // 0–5 POP: dot gathers, main circle springs in, chips orbit, then fold back in.
  function pop(c, t, L, T) {
    const { cx, cy, S } = L, r0 = S * 0.55, fold = eio((t - 4.3) / 0.7);
    const seed = t < T[0] ? S * 0.06 * (1 - 0.5 * eio((t - 0.3) / 0.5)) : 0;
    const d3 = t - T[3];
    if (d3 > 0 && d3 < 1.2) ring(c, cx, cy, r0 * (1 + d3 * 1.6), LIME, S * 0.14 * (1 - d3 / 1.2));
    const chips = [{ t: T[1], a: -0.7, r: 0.2, col: LIME }, { t: T[2], a: 2.4, r: 0.14, col: INK }, { t: T[3], a: 0.9, r: 0.26, col: LIME }];
    chips.forEach(ch => {
      const s = spring(t - ch.t); if (s <= 0) return;
      const a = ch.a + (t - ch.t) * 0.35, dist = S * 1.05 * (1 - fold);
      blob(c, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, S * ch.r * s * (1 - fold * 0.8), ch.col);
    });
    const sq = 0.18 * wob(d3) + 0.1 * wob(t - T[1]) + 0.1 * wob(t - T[2]);
    blob(c, cx, cy, Math.max(seed, r0 * spring(t - T[0])), INK, 1 + sq, 1 - sq);
  }

  // 5–10 WHOOSH: main circle opens into a ring; three bodies fly through it, peak speed at each event.
  function whoosh(c, t, L, T) {
    const { cx, cy, S, R } = L, r0 = S * 0.55, k = eio((t - 5) / 0.4) * (1 - eio((t - 9.5) / 0.5));
    const w = T.reduce((s, x) => s + wob(t - x), 0) * 0.08;
    blob(c, cx, cy, r0 * (1 + w), INK);
    blob(c, cx, cy, r0 * 0.78 * k * (1 + w), CREAM);
    const dirs = [0, Math.PI, -Math.PI / 4], span = Math.max(R.w, R.h) * 0.8;
    T.forEach((te, i) => {
      const u = (t - te) / 0.75; if (Math.abs(u) >= 1) return;
      const p = Math.sin(u * Math.PI / 2), v = Math.cos(u * Math.PI / 2), a = dirs[i];
      const x = cx + Math.cos(a) * span * p, y = cy + Math.sin(a) * span * p;
      streaks(c, x, y, a, S * 1.8 * v, S);
      blob(c, x, y, S * 0.3, i === 1 ? INK : LIME, 1 + 0.6 * v, 1 - 0.2 * v, a);
    });
  }

  // 10–15 HIT: rise, fall, land with squash; crouch, jump, land again and turn lime.
  function hit(c, t, L, T) {
    const { cx, cy, S } = L, r = S * 0.55, rest = cy + S * 0.35, top = cy - S * 0.75, g = rest + r;
    let y = rest, sx = 1, sy = 1;
    if (t < 10.3) y = lerp(cy, top, eo((t - 10) / 0.3));
    else if (t < T[0]) { const s = (t - 10.3) / (T[0] - 10.3); y = lerp(top, rest, s * s); sy = 1 + 0.15 * s; sx = 1 - 0.08 * s; }
    else if (t >= 12.3 && t < T[1]) { const s = (t - 12.3) / (T[1] - 12.3); y = rest - (rest - top) * 4 * s * (1 - s); }
    else if (t > 14.3) y = lerp(rest, cy, eio((t - 14.3) / 0.6));
    T.forEach(te => { const w = t > te ? wob(t - te) * 0.32 : 0; sx += w; sy -= w; });
    const crouch = Math.sin(Math.PI * cl((t - 12.05) / 0.25)) * 0.2; sx += crouch; sy -= crouch;
    const gk = eo((t - 10) / 0.3) * (1 - eio((t - 14.3) / 0.5));
    c.save(); c.globalAlpha = gk; c.fillStyle = INK; c.fillRect(cx - S * 1.3, g, S * 2.6, S * 0.03); c.restore();
    T.forEach((te, i) => {
      const d = t - te; if (d <= 0 || d > 0.9) return;
      const rx = r * (1 + d * (2.4 + i)), f = 1 - d / 0.9;
      c.save(); c.beginPath(); c.ellipse(cx, g, rx, rx * 0.16, 0, 0, Math.PI * 2);
      c.strokeStyle = LIME; c.lineWidth = S * 0.07 * f; c.stroke(); c.restore();
      c.save(); c.strokeStyle = INK; c.lineWidth = S * 0.025; c.lineCap = 'round'; c.globalAlpha = f;
      [-1, 1].forEach(sd => [0.4, 0.75].forEach(a => {
        const ox = cx + sd * r * (1.1 + d * 0.8), l = S * 0.22 * f;
        c.beginPath(); c.moveTo(ox, g - S * 0.05); c.lineTo(ox + sd * l * Math.cos(a), g - S * 0.05 - l * Math.sin(a) * 1.4); c.stroke();
      }));
      c.restore();
    });
    // Keep the bottom pinned to the ground while squashing.
    const yc = y >= rest - 1 ? y + r * (1 - sy) : y;
    blob(c, cx, yc, r, t >= T[1] ? LIME : INK, sx, sy);
  }

  // 15–20 SHUTTER: iris blades grow from the circle, snap closed on each event, then reopen.
  function shutter(c, t, L, T) {
    const { cx, cy, S } = L, r0 = S * 0.55;
    const inn = eo((t - 15) / 0.45) * (1 - eio((t - 19.4) / 0.6));
    const close = Math.max(0, ...T.map(te => {
      const d = t - te; return d < 0 && d > -0.16 ? eio(1 + d / 0.16) : d >= 0 && d < 0.6 ? 1 - eo(d / 0.6) : 0;
    }));
    const shot = T.filter(te => t >= te).length;
    blob(c, cx, cy, r0 * (1 - 0.12 * close), LIME);
    const outer = lerp(r0, S * 1.3, inn), hexR = lerp(lerp(r0, S * 0.95, inn), S * 0.05, close);
    const rot = shot * Math.PI / 3 + close * 0.7;
    if (inn > 0.001) {
      c.save(); c.beginPath(); c.arc(cx, cy, outer, 0, Math.PI * 2);
      for (let j = 0; j <= 6; j++) { const a = rot + j * Math.PI / 3; c[j ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * hexR, cy + Math.sin(a) * hexR); }
      c.fillStyle = INK; c.fill('evenodd');
      c.beginPath(); c.arc(cx, cy, outer, 0, Math.PI * 2); c.clip();
      c.strokeStyle = CREAM; c.lineWidth = S * 0.012;
      for (let j = 0; j < 6; j++) {
        const a = rot + j * Math.PI / 3, vx = cx + Math.cos(a) * hexR, vy = cy + Math.sin(a) * hexR, b = a + Math.PI * 2 / 3;
        c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx + Math.cos(b) * S * 2, vy + Math.sin(b) * S * 2); c.stroke();
      }
      c.restore();
    }
    const b = S * 1.38 * (1 - 0.07 * close) * lerp(0.8, 1, inn), l = S * 0.28;
    c.save(); c.globalAlpha = inn; c.strokeStyle = INK; c.lineWidth = S * 0.035; c.lineCap = 'square';
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      c.beginPath(); c.moveTo(cx + sx * b, cy + sy * (b - l)); c.lineTo(cx + sx * b, cy + sy * b); c.lineTo(cx + sx * (b - l), cy + sy * b); c.stroke();
    });
    c.restore();
  }

  // 20–25 PITCH: circle splits onto three strings; E5 / G5 / B5 ring in turn, then merge.
  function pitch(c, t, L, T) {
    const { cx, cy, S } = L, r0 = S * 0.55, sp = eio((t - 20) / 0.5) * (1 - eio((t - 24.2) / 0.8));
    const rat = [1, 1.19, 1.5], rs = [0.34, 0.28, 0.23];
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * S * 0.95 * sp, y = cy + (1 - i) * S * 0.35 * sp, d = t - T[i];
      const r = lerp(r0, S * rs[i], sp) * (1 + 0.3 * wob(d)), hl = S * 1.3 * sp;
      const A = d > 0 ? S * 0.14 * Math.exp(-2.2 * d) + S * 0.025 * eo((t - 22.3) / 0.4) : 0;
      c.save(); c.globalAlpha = sp; c.strokeStyle = INK; c.lineWidth = S * 0.02; c.beginPath();
      for (let j = 0; j <= 28; j++) {
        const s = j / 28, off = A * Math.sin(Math.PI * s) * Math.cos(d * rat[i] * 38);
        c[j ? 'lineTo' : 'moveTo'](x + off, cy - hl + 2 * hl * s);
      }
      c.stroke(); c.restore();
      for (let k = 0; k < 3; k++) { const dd = d - k * 0.18; if (dd > 0 && dd < 1.2) ring(c, x, y, r * (1 + dd * 1.8), INK, S * 0.03 * (1 - dd / 1.2)); }
      const fill = d > 0 ? 1 : 1 - cl((t - 20) / 0.4);
      blob(c, x, y, r, CREAM);
      c.save(); c.globalAlpha = fill; blob(c, x, y, r, LIME); c.restore();
      ring(c, x, y, r - S * 0.0125, INK, S * 0.025, sp);
    }
  }

  // 25–30 FINALE: wind-up, whoosh to centre, hit as a big disc, shrink to the dot of the wordmark.
  function finale(c, t, W, H, L, T) {
    const { cx, cy, S } = L, r0 = S * 0.55, P = H > W, groups = ['ear', 'sh', 'ot'];
    c.font = `900 100px ${FONT}`;
    const gw = groups.map(s => c.measureText(s).width), tw = gw.reduce((a, b) => a + b, 0);
    const fs = Math.min(W * 0.8 * 100 / (tw + 40), H * (P ? 0.12 : 0.2)), k = fs / 100;
    const wx = W / 2 - (tw * k + fs * 0.36) / 2, by = H * 0.5, ly = by - fs * 0.36;
    const dot = { x: wx + tw * k + fs * 0.2, y: by - fs * 0.09, r: fs * 0.09 }, R2 = Math.min(fs * 0.8, W * 0.3);
    let x = cx, y = cy, r = r0 * (1 - 0.45 * eio((t - 25) / 0.4)), sx = 1, sy = 1;
    const s = eio((t - 25.4) / (T[1] - 25.4));
    if (t > 25.4) {
      const v = Math.sin(Math.PI * cl((t - 25.4) / (T[1] - 25.4)));
      x = lerp(cx, W / 2, s); y = lerp(cy, ly, s) - Math.sin(Math.PI * s) * S * 0.5; r = lerp(r, R2, s);
      if (t < T[1]) streaks(c, x, y, Math.atan2(ly - cy, W / 2 - cx), S * 1.6 * v, S);
    }
    const w = wob(t - T[1]) * 0.28; sx += w; sy -= w;
    const d = t - T[1];
    if (d > 0 && d < 1) ring(c, W / 2, ly, R2 * (1 + d * 1.2), LIME, fs * 0.12 * (1 - d));
    const m = eio((t - 26.5) / 0.4);
    if (m > 0) { x = lerp(W / 2, dot.x, m); y = lerp(ly, dot.y, m); r = lerp(R2, dot.r, m) * (1 + 0.35 * wob(t - T[2])); }
    blob(c, x, y, r, LIME, sx, sy);
    c.textBaseline = 'alphabetic'; c.fillStyle = INK; c.font = `900 ${fs}px ${FONT}`;
    let gx = wx;
    groups.forEach((g, i) => {
      const sc = spring(t - T[2 + i]), gwk = gw[i] * k;
      if (sc > 0) { c.save(); c.translate(gx + gwk / 2, by); c.scale(sc, sc); c.fillText(g, -gwk / 2, 0); c.restore(); }
      gx += gwk;
    });
    const ta = eo((t - 28) / 0.6);
    if (ta > 0) {
      const ts = Math.max(16, fs * 0.26);
      c.save(); c.globalAlpha = ta; c.font = `700 ${ts}px ${JP}`; c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText('音を、コードで。', W / 2, by + fs * 0.4 + (1 - ta) * ts * 0.6); c.restore();
    }
  }

  function side(c, t, W, H, P, chs) {
    const i = chs.findIndex(ch => t >= ch.start && t < ch.end); if (i < 0 || i > 4) return;
    const ch = chs[i], a = eo((t - ch.start) / 0.45) * (1 - eio((t - ch.end + 0.4) / 0.4)); if (a <= 0) return;
    const tx = P ? W * 0.08 : W * 0.07, maxW = P ? W * 0.84 : W * 0.28, y0 = P ? H * 0.77 : H * 0.38;
    let cs = P ? Math.min(W * 0.11, H * 0.065) : Math.min(W * 0.055, H * 0.11);
    c.font = `700 ${cs}px ${JP}`; const cw = c.measureText(ch.caption).width; if (cw > maxW) cs *= maxW / cw;
    const ls = Math.max(14, cs * 0.36), dy = (1 - a) * cs * 0.4;
    c.save(); c.globalAlpha = a; c.textBaseline = 'top'; c.fillStyle = INK;
    c.font = `700 ${ls}px ${FONT}`; c.fillText(`0${i + 1} — ${ch.title}`, tx, y0 + dy);
    c.font = `700 ${cs}px ${JP}`; c.fillText(ch.caption, tx, y0 + ls * 1.7 + dy * 1.5);
    const by = y0 + ls * 1.7 + cs * 1.45, bw = Math.min(maxW, cs * 4);
    c.fillStyle = 'rgba(37,36,31,0.15)'; c.fillRect(tx, by, bw, ls * 0.3);
    c.fillStyle = INK; c.fillRect(tx, by, bw * cl((t - ch.start) / (ch.end - ch.start)), ls * 0.3);
    c.restore();
  }

  window.drawEarshot = function (ctx, t, W, H, timeline) {
    t = cl(+t || 0, 0, 30);
    const P = H > W, R = P ? { x: W * 0.06, y: H * 0.05, w: W * 0.88, h: H * 0.66 } : { x: W * 0.4, y: H * 0.08, w: W * 0.56, h: H * 0.84 };
    const L = { R, cx: R.x + R.w / 2, cy: R.y + R.h / 2, S: Math.min(R.w, R.h) * 0.36 };
    const chs = timeline && timeline.chapters && timeline.chapters.length >= 6 ? timeline.chapters : DEF_CH;
    ctx.save(); ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
    if (t < 25) {
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      if (t < 5) pop(ctx, t, L, times(timeline, 0, 5, [0.8, 1.4, 2.0, 3.4]));
      else if (t < 10) whoosh(ctx, t, L, times(timeline, 5, 10, [5.8, 7.3, 8.8]));
      else if (t < 15) hit(ctx, t, L, times(timeline, 10, 15, [10.65, 12.9]));
      else if (t < 20) shutter(ctx, t, L, times(timeline, 15, 20, [15.65, 17.1, 18.55]));
      else pitch(ctx, t, L, times(timeline, 20, 25, [20.6, 21.25, 21.9]));
      ctx.restore();
      side(ctx, t, W, H, P, chs);
    } else finale(ctx, t, W, H, L, times(timeline, 25, 30, [25.7, 26.1, 26.9, 27.25, 27.6]));
    ctx.restore();
  };
})();
