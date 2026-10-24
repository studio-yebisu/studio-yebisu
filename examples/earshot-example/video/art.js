/* earshot 0.4 — 30s motion reel art layer. Canvas2D, deterministic in t. */
(function () {
  var B = '#2757ff', K = '#0b0e12', WT = '#f6f8fc';
  var PI = Math.PI, HP = PI / 2;
  var S = 720, CX = 640, CY = 360, PT = false;

  function cl(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lin(t, a, b) { return cl((t - a) / (b - a), 0, 1); }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function eio(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eo(x) { return 1 - Math.pow(1 - x, 3); }
  function eo5(x) { return 1 - Math.pow(1 - x, 5); }
  function ei(x) { return x * x * x; }
  function sp(x) { return x <= 0 ? 0 : 1 - Math.exp(-11 * x) * Math.cos(17 * x); }
  function hit(t, c, k) { var d = t - c; return d < 0 ? 0 : Math.exp(-d * (k || 9)); }
  function hits(t, cs, k) { var s = 0; for (var i = 0; i < cs.length; i++) s += hit(t, cs[i], k); return s; }
  function arc(t, a, b) { return Math.sin(PI * lin(t, a, b)); }
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function rgb(h) {
    if (h[0] !== '#') return (h.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function mix(a, b, x) {
    var p = rgb(a), q = rgb(b); x = cl(x, 0, 1);
    return 'rgb(' + Math.round(lerp(p[0], q[0], x)) + ',' + Math.round(lerp(p[1], q[1], x)) + ',' + Math.round(lerp(p[2], q[2], x)) + ')';
  }
  function kf(t, T, V, E) {
    if (t <= T[0]) return V[0].slice();
    for (var i = 0; i < T.length - 1; i++) {
      if (t <= T[i + 1]) {
        var x = (E && E[i] || eio)((t - T[i]) / (T[i + 1] - T[i])), o = [];
        for (var j = 0; j < V[i].length; j++) o.push(lerp(V[i][j], V[i + 1][j], x));
        return o;
      }
    }
    return V[V.length - 1].slice();
  }
  function cam(p, f) { return { x: p[0], y: p[1], z: p[2], yaw: p[3], pitch: p[4], roll: p[5], f: f }; }
  function bg(ctx, W, H, c) { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }

  // perspective projection of a world point through the camera
  function P3(c, p) {
    var dx = p[0] - c.x, dy = p[1] - c.y, dz = p[2] - c.z;
    var cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    var x = dx * cy - dz * sy, z = dx * sy + dz * cy;
    var cp = Math.cos(c.pitch), spt = Math.sin(c.pitch);
    var y = dy * cp - z * spt; z = dy * spt + z * cp;
    if (z < .05) return null;
    var cr = Math.cos(c.roll), sr = Math.sin(c.roll);
    var k = c.f * S / z;
    return [CX + (x * cr - y * sr) * k, CY - (x * sr + y * cr) * k, z];
  }
  // rounded rectangle lying in the plane spanned by unit axes u,v around o
  function add(L, c, o, u, v, w, h, r, col, opt) {
    opt = opt || {};
    var hw = w / 2, hh = h / 2; r = Math.max(0, Math.min(r, hw, hh));
    var n = r > 0 ? (opt.n || 8) : 0, pts = [], zs = 0;
    var C = [[hw - r, hh - r, 0], [-hw + r, hh - r, 1], [-hw + r, -hh + r, 2], [hw - r, -hh + r, 3]];
    for (var i = 0; i < 4; i++) for (var j = 0; j <= n; j++) {
      var a = (C[i][2] + (n ? j / n : 0)) * HP;
      var lx = C[i][0] + Math.cos(a) * r, ly = C[i][1] + Math.sin(a) * r;
      var q = P3(c, [o[0] + u[0] * lx + v[0] * ly, o[1] + u[1] * lx + v[1] * ly, o[2] + u[2] * lx + v[2] * ly]);
      if (!q) return;
      pts.push(q); zs += q[2];
    }
    var z = zs / pts.length;
    L.push({ z: z + (opt.b || 0), p: pts, c: col, lw: opt.lw ? opt.lw * c.f * S / z : 0 });
  }
  function line(L, c, pts3, col, lw) {
    var p = [], zs = 0;
    for (var i = 0; i < pts3.length; i++) { var q = P3(c, pts3[i]); if (!q) return; p.push(q); zs += q[2]; }
    var z = zs / p.length;
    L.push({ z: z, p: p, c: col, lw: lw * c.f * S / z, open: true });
  }
  function mkR(rx, ry, rz) {
    var a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
    return function (v) {
      var y = v[1] * a - v[2] * b, z = v[1] * b + v[2] * a, x = v[0];
      var x2 = x * c + z * d; z = -x * d + z * c;
      return [x2 * e - y * f, x2 * f + y * e, z];
    };
  }
  // box with half sizes d; cols order +x,-x,+y,-y,+z,-z
  function box(L, c, o, d, R, cols) {
    for (var ax = 0; ax < 3; ax++) for (var sg = -1; sg <= 1; sg += 2) {
      var a1 = (ax + 1) % 3, a2 = (ax + 2) % 3, n = [0, 0, 0], e1 = [0, 0, 0], e2 = [0, 0, 0];
      n[ax] = sg; e1[a1] = 1; e2[a2] = 1;
      var nw = R(n), fc = [o[0] + nw[0] * d[ax], o[1] + nw[1] * d[ax], o[2] + nw[2] * d[ax]];
      if ((fc[0] - c.x) * nw[0] + (fc[1] - c.y) * nw[1] + (fc[2] - c.z) * nw[2] >= 0) continue;
      add(L, c, fc, R(e1), R(e2), 2 * d[a1], 2 * d[a2], 0, cols[ax * 2 + (sg > 0 ? 0 : 1)]);
    }
  }
  function flush(ctx, L) {
    L.sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < L.length; i++) {
      var it = L[i], p = it.p;
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      for (var j = 1; j < p.length; j++) ctx.lineTo(p[j][0], p[j][1]);
      if (!it.open) ctx.closePath();
      if (it.lw) { ctx.lineWidth = it.lw; ctx.strokeStyle = it.c; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
      else { ctx.fillStyle = it.c; ctx.fill(); }
    }
  }
  function rolled(a, rl) { // card axes: yaw a, in-plane roll rl
    var ca = Math.cos(a), sa = Math.sin(a), cr = Math.cos(rl), sr = Math.sin(rl);
    return [[ca * cr, sr, -sa * cr], [-ca * sr, cr, sa * sr]];
  }
  function amp(arr, i, mx) {
    i = ((Math.floor(i) % 192) + 192) % 192;
    if (arr && arr.length) return cl(Math.abs(+arr[Math.floor(i * arr.length / 192)] || 0) / mx, 0, 1);
    var x = i / 192;
    return cl(Math.abs(Math.sin(x * 23) * .6 + Math.sin(x * 61 + 1) * .3) * Math.exp(-x * 1.6) + .08, 0, 1);
  }

  var F1 = function () { return PT ? 1.85 : 1.3; };
  var BAR_X = [-.8, 0, .8], BAR_C = [K, B, K];

  /* 0 – 6.5625: tactile mark → perspective card rack → dive */
  function rack(ctx, t, W, H, L) {
    var m = eio(lin(t, 1.72, 2.7)), F = F1();
    bg(ctx, W, H, mix(WT, '#e6eaf1', m));
    var pop = [.05, .46875, .9375, 1.40625], clk = [2.34, 2.81, 4.22, 4.69, 5.16], hop = [3, 9, 7, 10, 8];
    var p = kf(t, [0, 1.875, 3.75, 6.0, 6.5625], [[0, 0, -4.2, 0, 0, 0], [0, 0, -4.2, 0, 0, 0],
      PT ? [-0.8, 1.9, -11.5, .55, -.2, -.07] : [-0.5, 1.3, -10, .42, -.14, -.05],
      PT ? [4.6, .9, -7.4, -.5, -.08, .06] : [4.2, .6, -6.2, -.38, -.06, .04],
      [6, 0, -.2, 0, 0, 0]], [eio, eo, eio, ei]);
    if (t < 1.875) p[2] += .25 * hits(t, pop, 10);
    var c = cam(p, F);
    for (var i = 0; i < 14; i++) {
      var k = i - 4, bar = k >= 0 && k < 3, x, y = 0, z = 0, w, h, a, col, rl = 0;
      var mi = bar ? 1 : eo(lin(t, 1.875 + Math.abs(i - 5) * .06, 2.55 + Math.abs(i - 5) * .07));
      if (mi <= 0) continue;
      var ra = i === 8 ? .6 * (1 - eio(lin(t, 5.6, 6.45))) : .6;
      if (bar) {
        var pp = hit(t, pop[k + 0], 10) + hit(t, pop[3], 8);
        x = lerp(BAR_X[k], (i - 5) * 2, m); w = lerp(.48 * (1 - .14 * pp), 1.5, m);
        h = lerp(2.3 * (1 + .2 * pp), 2.1, m); y = lerp(.12 * pp, 0, m); a = ra * m; col = BAR_C[k];
        if (k === 1) rl = -.32 * eo5(lin(t, .9375, 1.05)) * (1 - eio(lin(t, 1.40625, 1.7)));
      } else {
        x = (i - 5) * 2; z = (1 - mi) * 9; w = 1.5; h = 2.1; a = ra * mi;
        col = i === 8 ? WT : [K, B, '#c3cbd8'][i % 3];
      }
      for (var j = 0; j < clk.length; j++) if (hop[j] === i) { y += .42 * arc(t, clk[j], clk[j] + .3); rl += .12 * arc(t, clk[j], clk[j] + .3); }
      var ax = rolled(a, rl), u = ax[0], v = ax[1];
      add(L, c, [x, y, z], u, v, w, h, lerp(.2, .16, m), col);
      if (i === 8) {
        var ic = [[-.32, -.45, .5, .08, K], [.36, -.45, .44, .22, B]];
        for (var q = 0; q < 2; q++) {
          var o = [x + u[0] * ic[q][0] + v[0] * ic[q][1], y + v[1] * ic[q][1] + u[1] * ic[q][0], z + u[2] * ic[q][0] + v[2] * ic[q][1]];
          add(L, c, o, u, v, ic[q][2], ic[q][2], ic[q][3], ic[q][4], { b: -.002 - q * .0005, n: 5 });
        }
      }
    }
    if (m > 0) {
      for (var b = 0; b < 22; b++) add(L, c, [(b - 8) * 1.3, -2.3 - (1 - m) * 2, 6], [1, 0, 0], [0, 1, 0], 1.0, .55, .14, '#d1d8e3');
      for (var g = 0; g < 3; g++) add(L, c, [-6 + g * 9, 3.4 + (1 - m) * 3, 13], [1, 0, 0], [0, 1, 0], 6, 2.4, .9, '#dbe0e9');
      for (var f = 0; f < 7; f++) {
        var fx = ((f * 4.1 - t * 5.5) % 28 + 28) % 28 - 8;
        add(L, c, [fx, -1.9 - (1 - m) * 3, -4.2], [1, 0, 0], [0, 1, 0], .9, .22, .11, f % 3 ? B : K);
      }
    }
  }

  /* 6.5625 – 10.3125: macro rail, black cube tumbles, blue ball strikes */
  function sculpt(ctx, t, W, H, L) {
    bg(ctx, W, H, WT);
    var I = [6.8, 7.5, 8.2, 9.1], tk = [7.73, 8.44, 9.38], n = 0;
    while (n < 4 && t >= I[n]) n++;
    var e = -2 + n, th = 0, bx, by = .3, cont = 0;
    if (n < 4) {
      var Ti = I[n], T0 = n ? I[n - 1] : 6.5625, ap = lin(t, T0 + .04, Ti - .26);
      th = HP * ei(lin(t, Ti - .26, Ti));
      bx = e - .3 - .5 * (1 - eio(ap)) + .5 * ei(lin(t, Ti - .26, Ti));
      by = .3 + .85 * Math.sin(PI * ap);
      cont = hit(t, Ti - .26, 14);
    } else {
      var q = eo(lin(t, 9.1, 9.6));
      bx = lerp(e - .8, e + .5, q); by = .3 + 1.7 * q;
    }
    var land = n ? hit(t, I[n - 1], 13) : 0;
    var d = [.5 * (1 + .12 * land), .5 * (1 - .2 * land), .5];
    var ccx = th > 0 ? e + 1 - .5 * Math.cos(th) + .5 * Math.sin(th) : e + .5;
    var ccy = th > 0 ? .5 * Math.sin(th) + .5 * Math.cos(th) : d[1];

    var bp = [lerp(-1.6, 2.4, lin(t, 6.5625, 9.6)), PT ? 1.9 : 1.25, PT ? -8.8 : -6.8, .1 * Math.sin(t * 1.3), PT ? -.2 : -.15, 0];
    bp[2] = lerp(-2.2, bp[2], eo(lin(t, 6.5625, 7.15)));
    bp[1] += .04 * hits(t, I, 16);
    var dv = ei(lin(t, 9.55, 10.3125));
    var p = [lerp(bp[0], bx, dv), lerp(bp[1], by, dv), lerp(bp[2], -.32, dv), bp[3] * (1 - dv), bp[4] * (1 - dv), .06 * dv];
    var c = cam(p, PT ? 1.5 : 1.3);

    add(L, c, [1, 2.4, 9], [1, 0, 0], [0, 1, 0], 10, 5, .7, '#e7ebf2');
    add(L, c, [.5, 0, .62], [1, 0, 0], [0, 0, 1], 18, .05, 0, '#c9d0dc');
    add(L, c, [ccx, .001, 0], [1, 0, 0], [0, 0, 1], 1.15, 1.05, .3, '#dfe4ec', { b: 40 });
    add(L, c, [bx, .001, 0], [1, 0, 0], [0, 0, 1], .6 / (1 + by * .4), .5, .25, '#e3e7ee', { b: 40 });
    for (var j = 0; j < 3; j++) {
      var ph = HP * eo(lin(t, tk[j], tk[j] + .12)) * (1 - eo(lin(t, tk[j] + .25, tk[j] + .55)));
      var tv = [0, Math.sin(ph), Math.cos(ph)], tx = [.9, 2.1, 3.4][j];
      add(L, c, [tx, tv[1] * .25, .8 + tv[2] * .25], [1, 0, 0], tv, .16, .5, .05, B);
    }
    add(L, c, [-3.6 + (t - 6.5625) * .35, .3, -2.6], [1, 0, 0], [0, 1, 0], 2.4, .6, .3, K);
    box(L, c, [ccx, ccy, 0], d, mkR(0, 0, -th), ['#2a303b', '#1b2029', '#343b48', K, '#151a22', K]);
    add(L, c, [bx, by, 0], [1, 0, 0], [0, 1, 0], .6 * (1 + .25 * cont), .6 * (1 - .25 * cont), .3, B, { n: 6, b: -.01 });
    flush(ctx, L); L.length = 0;
    if (t > 10.2) { ctx.globalAlpha = lin(t, 10.2, 10.3125); bg(ctx, W, H, B); ctx.globalAlpha = 1; }
  }

  /* 10.3125 – 15: waveform ribbon in space; camera flies through */
  function czAt(t) { return (t - 10.3125) * 6 + 3 * eio(lin(t, 12.0, 12.6)) + 4 * ei(lin(t, 14.5, 15)); }
  function ribbon(ctx, t, W, H, L, tl) {
    var wf = tl && tl.waveforms, arr = wf && (wf.whoosh || wf.hit), mx = 1e-6;
    if (arr && arr.length) for (var a = 0; a < arr.length; a++) mx = Math.max(mx, Math.abs(+arr[a] || 0));
    var end = eio(lin(t, 14.45, 15)), gl = t > 11.25 && t < 11.45;
    bg(ctx, W, H, mix(B, K, end));
    var cz = czAt(t), u = t - 10.3125, sw = PT ? [1.0, 2.2] : [2.2, 1.0];
    function px(z) { return Math.sin(z * .26) * sw[0]; }
    function py(z) { return Math.cos(z * .19) * sw[1]; }
    var roll = .25 * Math.sin(u * 1.3) + .9 * eio(lin(t, 12.1875, 12.9)) - .6 * eio(lin(t, 14.8, 15.2));
    var c = cam([px(cz + 2) * .55, py(cz + 2) * .5, cz, -.12 * Math.cos(cz * .26), .05 * Math.sin(cz * .19), roll], PT ? 1.5 : 1.1);
    var k0 = Math.ceil((cz + .4) / .7), base = PT ? HP : 0;
    for (var k = k0; k < k0 + 44; k++) {
      var z = k * .7, h = .35 + amp(arr, k * 4, mx) * 3.4, an = base + k * .09, fog = Math.pow(cl((z - cz) / 28, 0, 1), 1.2);
      var x = px(z), y = py(z), col = k % 7 === 0 ? K : WT;
      if (gl) { x += (rnd(k + Math.floor(t * 40)) - .5) * .9; if (rnd(k * 3 + Math.floor(t * 40)) > .6) col = K; }
      var uu = [Math.cos(an), Math.sin(an), 0], vv = [-Math.sin(an), Math.cos(an), 0];
      add(L, c, [x, y, z], uu, vv, .22 + end * 5, h + end * 3, .11, mix(mix(col, K, end), mix(B, K, end), fog));
      if (k % 3 === 0) add(L, c, [x + (PT ? 1.4 : 2.6), y - (PT ? 2.6 : 1.4), z], [1, 0, 0], [0, 1, 0], .2, .2, .1, mix(mix(WT, K, end), B, fog));
    }
    var bells = [12.65, 13.125, 13.59];
    for (var b = 0; b < 3; b++) {
      if (t < bells[b]) continue;
      var s = eo(lin(t, bells[b], bells[b] + .2)), rz = czAt(bells[b]) + 7;
      if (rz < cz + .3) continue;
      add(L, c, [px(rz) * .6, py(rz) * .6, rz], [1, 0, 0], [0, 1, 0], (PT ? 2.8 : 4.4) * s, (PT ? 4.4 : 2.8) * s, .7, mix(WT, K, end), { lw: .09 });
    }
  }

  /* 15 – 18.75: black field, a close kinetic solid with sharp transformations */
  function solid(ctx, t, W, H, L) {
    bg(ctx, W, H, K);
    var T = [15.05, 16.4, 17.1], D = [[1.25, 1.25, 1.25], [2.7, .36, 1.7], [.48, 3.0, .48], [1.45, 1.45, 1.45]];
    var d = D[0].slice(), ry = .55 + (t - 15) * .6;
    for (var j = 0; j < 3; j++) { var s = sp(t - T[j]); for (var q = 0; q < 3; q++) d[q] += (D[j + 1][q] - D[j][q]) * s; ry += HP * s; }
    var rx = .42 - .3 * sp(t - 16.4) + .5 * sp(t - 17.1), a = ei(lin(t, 18.1, 18.75));
    ry += a * 7;
    for (q = 0; q < 3; q++) d[q] = d[q] / 2 * (1 + a * 5);
    var c = cam([.35 * Math.sin(t * .8), .5, (PT ? -7.4 : -5.8) + a * 2.5, -.06, -.08, .05 * a], PT ? 1.5 : 1.15);
    var base = ['#c4ccd9', '#8792a6', B, '#1a1f29', '#dfe5ee', WT], cols = [];
    for (q = 0; q < 6; q++) cols.push(mix(base[q], WT, a));
    box(L, c, [0, 0, 0], d, mkR(rx, ry, .08 * Math.sin(t * 2)), cols);
    var oa = t * 2.4;
    box(L, c, [Math.cos(oa) * 2.4, .3 * Math.sin(t * 1.7), Math.sin(oa) * 2.4], [.18, .18, .18], mkR(t * 3, t * 2, 0), [B, '#1d44d8', '#5a7dff', '#1636b8', B, '#2f5cff']);
    var pl = [15.94, 17.81];
    for (var p = 0; p < 2; p++) {
      if (t < pl[p]) continue;
      var dt = t - pl[p], A = .5 * Math.exp(-dt * 5), pts = [];
      for (var x = -7; x <= 7.01; x += .35) pts.push([x, -.9 + p * 1.8 + A * Math.sin(x * 1.1) * Math.sin(dt * 46), 1.6]);
      line(L, c, pts, B, .045);
    }
    flush(ctx, L); L.length = 0;
    var sh = [15.05, 16.4, 17.1];
    ctx.fillStyle = WT;
    for (j = 0; j < 3; j++) {
      var kk = lin(t, sh[j] - .02, sh[j] + .14);
      if (kk <= 0 || kk >= 1) continue;
      var cv = Math.sin(PI * kk) * (PT ? H : W) * .16;
      if (PT) { ctx.fillRect(0, 0, W, cv); ctx.fillRect(0, H - cv, W, cv); }
      else { ctx.fillRect(0, 0, cv, H); ctx.fillRect(W - cv, 0, cv, H); }
    }
    if (t > 18.55) { ctx.globalAlpha = lin(t, 18.55, 18.75); bg(ctx, W, H, WT); ctx.globalAlpha = 1; }
  }

  /* 18.75 – 28.125: tile groove, then pullback recombination into the mark */
  function camT(t) {
    var w1 = eio(lin(t, 21.56, 22.15)), w2 = eio(lin(t, 23.44, 24.0)), s = 1 - 2 * w1 + 2 * w2, tr = lin(t, 18.9, 24.375);
    var h = hit(t, 20.625, 7) + hit(t, 22.5, 7);
    var p = PT ? [.3 + .4 * s, lerp(3.2, -3.2, tr), -10.5 + h * .5, .12 * s, .36 * s, -.05 * s]
      : [lerp(-3, 3, tr), -.3, -8.6 + h * .5, .42 * s, -.1, .04 * s];
    var ii = eo5(lin(t, 18.75, 19.35)), z0 = [0, 0, -.5, 0, 0, 0];
    for (var i = 0; i < 6; i++) p[i] = lerp(z0[i], p[i], ii);
    return p;
  }
  function tiles(ctx, t, W, H, L) {
    bg(ctx, W, H, WT);
    var tt = t > 27.88 ? 27.88 : t, F6 = PT ? 1.4 : 1.2;
    var p, f = F6;
    if (tt <= 24.375) p = camT(tt);
    else {
      p = kf(tt, [24.375, 26.0, 27.45], [camT(24.375), PT ? [0, 1, -20, .25, -.05, -.1] : [0, .6, -17, -.3, -.04, .08], [0, 0, -4.2, 0, 0, 0]], [eio, eio]);
      p[5] += -.28 * Math.sin(PI * lin(tt, 26.25, 27.3));
      var sk = .05 * lin(tt, 25.8, 27.4) * (tt < 27.45 ? 1 : 0);
      p[0] += sk * Math.sin(tt * 91); p[1] += sk * Math.cos(tt * 77);
      f = lerp(F6, F1(), eio(lin(tt, 26.0, 27.45)));
    }
    var c = cam(p, f);
    var cols = PT ? 6 : 11, rows = PT ? 11 : 6, N = cols * rows, spc = 1.1;
    var flips = [18.75, 19.22, 19.69, 20.16, 21.56, 23.44], hs = [20.625, 22.5], clk = [21.0, 21.14, 21.28, 23.1, 23.24], ends = [26.72, 26.95, 27.19];
    var pal = [K, B, '#dde3ec'], nk = [0, 0, 0];
    for (var i = 0; i < N; i++) nk[i % 3]++;
    for (var b = 0; b < 4; b++) add(L, c, [(b - 1.5) * 7, (b % 2) * 3 - 1.5, 9], [1, 0, 0], [0, 1, 0], 5, 3, .8, '#e8ecf2');
    var solidBars = tt > 27.2;
    for (i = 0; i < N; i++) {
      var cc = i % cols, r = Math.floor(i / cols), k = i % 3, j = Math.floor(i / 3);
      if (solidBars) break;
      var x = (cc - (cols - 1) / 2) * spc, y = (r - (rows - 1) / 2) * spc, rr = rnd(i * 3.1);
      var z = rr < .28 ? -1.2 : rr < .7 ? 0 : 1.6, dd = Math.sqrt(x * x + y * y) / spc;
      var fl = 0, n = 0;
      for (var q = 0; q < flips.length; q++) {
        var st = flips[q] + dd * .035;
        fl += PI * eo(lin(tt, st, st + .3)); if (tt > st + .15) n++;
      }
      for (q = 0; q < 2; q++) if (tt > hs[q] + dd * .05) z -= .9 * hit(tt, hs[q] + dd * .05, 6);
      var row0 = PT ? 5 : 2;
      for (q = 0; q < 5; q++) if (r === row0 && cc === (q < 3 ? 3 + q : 1 + q) % cols) z -= .7 * arc(tt, clk[q], clk[q] + .22);
      var col = pal[(cc + r * 2 + (rnd(i) > .7 ? 1 : 0) + n) % 3];
      var g = eio(lin(tt, 24.45 + rnd(i + 9) * .7, ends[k]));
      var th = 2.3 / nk[k], ty = -1.15 + (j + .5) * th;
      x = lerp(x, BAR_X[k], g); y = lerp(y, ty, g); z = lerp(z, 0, g) + Math.sin(PI * g) * (rnd(i + 4) - .5) * 4;
      var w = lerp(.95, .48, g), h = lerp(.95, th, g), an = (fl % PI) * (1 - g);
      if (g > .5) col = BAR_C[k];
      var u = PT ? [Math.cos(an), 0, Math.sin(an)] : [1, 0, 0], v = PT ? [0, 1, 0] : [0, Math.cos(an), Math.sin(an)];
      add(L, c, [x, y, z], u, v, w, h, .14 * (1 - g), col);
    }
    if (solidBars) {
      var pp = hit(tt, 27.65, 16);
      for (k = 0; k < 3; k++) add(L, c, [BAR_X[k], .12 * pp, 0], [1, 0, 0], [0, 1, 0], .48 * (1 - .14 * pp), 2.3 * (1 + .2 * pp), lerp(0, .2, lin(tt, 27.2, 27.4)), BAR_C[k]);
    }
  }

  /* 28.125 – 30: composed wordmark */
  function rr2(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function wordmark(ctx, t, W, H) {
    bg(ctx, W, H, WT);
    var u = t - 28.125, kp = F1() * S / 4.2;
    var fs = PT ? W * .205 : W * .118, word = 'earshot';
    ctx.font = 'bold ' + fs + 'px Arial'; ctx.textBaseline = 'alphabetic';
    var tw = ctx.measureText(word).width, bw = fs * (PT ? .17 : .13), gp = fs * (PT ? .1 : .075), bh = fs * (PT ? 1.0 : .74);
    var gw = 3 * bw + 2 * gp, gx, base, bb;
    if (PT) { gx = (W - gw) / 2; bb = H * .5 - fs * .3; base = H * .5 + fs * .72; }
    else { var tot = gw + fs * .28 + tw; gx = (W - tot) / 2; base = H * .5 + fs * .36; bb = base; }
    var wx = PT ? (W - tw) / 2 : gx + gw + fs * .28;
    var sc = 1 + .025 * (1 - eo(lin(u, 0, 1.2)));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
    for (var k = 0; k < 3; k++) {
      var e = cl(sp(u - k * .04) , 0, 1.08);
      var sx = CX + BAR_X[k] * kp - .24 * kp, sy = CY - 1.15 * kp, sw = .48 * kp, sh = 2.3 * kp;
      var tx = gx + k * (bw + gp), ty = bb - bh;
      if (k === 1) ty -= fs * .06 * arc(u, .9, 1.25);
      ctx.fillStyle = BAR_C[k];
      rr2(ctx, lerp(sx, tx, e), lerp(sy, ty, e), lerp(sw, bw, e), lerp(sh, bh, e), lerp(.2 * kp, bw * .5, cl(e, 0, 1)));
    }
    ctx.save(); ctx.beginPath(); ctx.rect(0, base - fs * 1.1, W, fs * 1.32); ctx.clip();
    ctx.fillStyle = K;
    for (var i = 0; i < word.length; i++) {
      var pr = eo5(lin(u, .1 + i * .035, .55 + i * .035)), lx = wx + ctx.measureText(word.slice(0, i)).width;
      ctx.fillText(word[i], lx, base + (1 - pr) * fs * 1.05);
    }
    ctx.restore();
    var va = eo(lin(u, .5, .8));
    ctx.globalAlpha = va; ctx.fillStyle = B; ctx.font = 'bold ' + fs * .2 + 'px Arial';
    ctx.fillText('0.4', wx + tw + fs * .05, base - fs * .52 + (1 - va) * fs * .1);
    var sa = eo(lin(u, .7, 1.05)), sfs = Math.max(11, fs * (PT ? .1 : .085)), s2 = 'studio_yebisu';
    ctx.globalAlpha = sa * .72; ctx.fillStyle = K; ctx.font = sfs + 'px Arial';
    var ls = sfs * .14, sw2 = 0;
    for (i = 0; i < s2.length; i++) sw2 += ctx.measureText(s2[i]).width + ls;
    var x0 = (W - sw2 + ls) / 2, yb = H - (PT ? H * .07 : H * .09);
    for (i = 0; i < s2.length; i++) { ctx.fillText(s2[i], x0, yb); x0 += ctx.measureText(s2[i]).width + ls; }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  window.drawEarshot = function (ctx, t, W, H, timeline) {
    t = cl(+t || 0, 0, 30);
    PT = H > W; S = Math.min(W, H); CX = W / 2; CY = H / 2;
    var L = [];
    ctx.save();
    if (t < 6.5625) rack(ctx, t, W, H, L);
    else if (t < 10.3125) sculpt(ctx, t, W, H, L);
    else if (t < 15) ribbon(ctx, t, W, H, L, timeline);
    else if (t < 18.75) solid(ctx, t, W, H, L);
    else if (t < 28.125) tiles(ctx, t, W, H, L);
    else { wordmark(ctx, t, W, H); ctx.restore(); return; }
    flush(ctx, L);
    ctx.restore();
  };
})();
