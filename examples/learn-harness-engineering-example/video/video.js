// 「1件だけ進めて、続きはファイルへ。」無音の図解動画。縦 720×1280 と横 1280×720 を別々に組む。
// assets/manifest.json（SHA-256 固定）と10件の素材をバイト数・SHA-256・中身で確かめてから motionReady を解決する。
// window.seek(t) は時刻 t だけから画面全体を描く。前の画面・壁時計・乱数・CSSアニメーションに頼らない。音は持たない。
'use strict';

(() => {
  const RENDER = window.__MOTION_RENDER__ === true;
  const rc = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
  const wantWide = !RENDER && new URLSearchParams(location.search).get('layout') === 'wide';
  const W = Number.isInteger(rc.width) && rc.width > 0 ? rc.width : (wantWide ? 1280 : 720);
  const H = Number.isInteger(rc.height) && rc.height > 0 ? rc.height : (wantWide ? 720 : 1280);
  const FPS = Number.isInteger(rc.fps) && rc.fps > 0 ? rc.fps : 30;
  const DURATION = 32;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: 31, audioEvents: [] };

  const MANIFEST_URL = 'assets/manifest.json';
  const MANIFEST_SHA256 = '9e049f50bdaf51486d705800e9d19bef93d143037362586dc76437c4a84f5050';
  const CASE_ID = 'learn-harness-engineering-example';
  const REPO = 'walkinglabs/learn-harness-engineering';
  const PIN = '38ddcd2bf8d65271f668b94e7c875ca1d629d622';
  const ASSET_FILES = [
    'diagram-data.json', 'exercise-run.json', 'handoff-data.json', 'harness-created.json', 'note-index.json',
    'original-verification.json', 'queries.json', 'timeline.json', 'upstream.json', 'verification-run.json',
  ];
  const SCENES = [
    ['overview', 0, 5, 'Q03', 'all'],
    ['five-files', 5, 10, 'Q03', 'implementation'],
    ['one-feature', 10, 16, 'Q03', 'implementation'],
    ['verification', 16, 22, 'Q06', 'verified'],
    ['resume', 22, 27, 'Q03', 'resume'],
    ['finish', 27, 32, 'Q03', 'all'],
  ];
  const SCENE_LABEL = {
    overview: '全体', 'five-files': '5つのファイル', 'one-feature': '1件だけ',
    verification: '確かめる', resume: '次のセッション', finish: '持ち帰る',
  };
  const NOTE_IDS = ['N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08'];
  const QUERY_IDS = ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08'];
  const FILES = ['AGENTS.md', 'feature_list.json', 'init.sh', 'progress.md', 'session-handoff.md'];
  const STATE_FILES = ['feature_list.json', 'progress.md', 'session-handoff.md'];
  const STATE_K = { 1: 0, 3: 1, 4: 2 };
  const ROLE_LINES = {
    'AGENTS.md': ['作業の', '決まり'],
    'feature_list.json': ['1件に', '絞る'],
    'progress.md': ['今', 'どこか'],
    'session-handoff.md': ['次へ', '渡す'],
    'init.sh': ['実行して', '確かめる'],
  };
  const STATUS_TEXT = { 'not-started': '未着手', 'in-progress': '作業中', done: '完了' };

  const C = {
    bg: '#f5efe2', card: '#fffdf8', paper: '#fffdf7', ink: '#182238', navy: '#1d2c4f', muted: '#5b6070',
    teal: '#1f7a72', tealInk: '#135049', tealSoft: '#d6ebe6', resultBg: '#f1f9f7',
    ochre: '#a86c14', ochreSoft: '#f4e3c2', ochreInk: '#7a4d0c', red: '#a8432c', redSoft: '#f3d9d0',
    line: '#cdbf9f', desk: '#fbf6ea', grey: '#9aa1ad', ghost: '#b3a88f', edge: '#7a7f8a',
    folderBack: '#e2bf7e', folderFront: '#f1d9a6', folderEdge: '#a8701c',
  };
  const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",sans-serif';
  const SERIF = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
  const MONO = '"Cascadia Mono",Consolas,"Menlo","Courier New",monospace';

  const GLYPHS = {
    'AGENTS.md': { d: 'M5 6h2M10 6h9M5 12h2M10 12h9M5 18h2M10 18h9' },
    'feature_list.json': { d: 'M4 5h5v5H4zM12 7.5h8M4 14h5v5H4zM12 16.5h8', fill: 'M4 5h5v5H4z' },
    'progress.md': { d: 'M12 21s-6-6.2-6-10.5a6 6 0 0 1 12 0C18 14.8 12 21 12 21zM12 8.2a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z' },
    'session-handoff.md': { d: 'M3 12h14M12 6l6 6-6 6' },
    'init.sh': { d: 'M4 4.5l8 5-8 5zM13 17l3 3 5-6.5', fill: 'M4 4.5l8 5-8 5z' },
    check: { d: 'M6 4h12v16H6zM9 12.5l2.2 2.2L15.5 10' },
    save: { d: 'M12 4v11M7 10l5 5 5-5M5 20h14' },
  };

  const PEEK = {
    card: { x: -58, y: -30, s: 0.34 },
    evidence: { x: 4, y: -34, s: 0.36 },
    f0: { x: 46, y: -32, s: 0.34 },
    f1: { x: 74, y: -28, s: 0.34 },
    f2: { x: 100, y: -24, s: 0.34 },
  };

  function portraitAnchors() {
    return {
      W: 720, H: 1280,
      head: { x: 40, y: 116, size: 36 },
      dots: { x: 680, y: 56, gap: 22, r: 6 },
      footer: { x: 40, y: 1250, size: 17 },
      railLabel: { x: 90, y: 212, size: 17, align: 'center' },
      slots: [226, 356, 568, 756, 1000].map((y) => ({ x: 30, y, w: 120, h: 100 })),
      conn: [[150, 276, 176, 276], [150, 406, 176, 406], [150, 618, 192, 618], [150, 806, 196, 806], [150, 1050, 176, 1050]],
      chip: { x: 360, y: 480, w: 360, h: 96 },
      big: [0, 1, 2, 3, 4].map((i) => ({ x: 40 + i * 130, y: 600, w: 120, h: 160 })),
      desk1: { x: 176, y: 180, w: 516, h: 320, title: { x: 198, y: 222 } },
      pill: { x: 424, y: 194, w: 264, h: 40, size: 19 },
      tokens: { x: 688, y: 248, h: 34, align: 'right', size: 18 },
      pile: { cx: 316, cy: 314, w: 104, h: 72, cap: { x: 250, y: 322, align: 'right', size: 18 } },
      fan: { x0: 198, step: 61.5, y: 280, w: 56, h: 74 },
      card1: { x: 316, y: 434 },
      result: { x: 452, y: 378, w: 236, h: 112 },
      record: { x: 608, y: 312, s: 1 },
      recordArrow: [608, 376, 608, 366],
      arrows: [[316, 361, 316, 376], [432, 434, 450, 434]],
      spine: [[316, 492, 316, 520], [316, 646, 316, 736], [316, 862, 316, 894]],
      gate: { cx: 316, beamX1: 186, beamX2: 446, beamY: 524, beamH: 22, pillarW: 18, pTop: 546, pBot: 644, cardY: 594, cardS: 0.86 },
      gateGlow: { x: 172, y: 512, w: 524, h: 218 },
      gateText: { icon: { x: 478, y: 574, size: 26 }, x: 498, align: 'left', lines: [{ y: 582, size: 24 }, { y: 612, size: 18 }, { y: 640, size: 18 }] },
      checks: { label: { x: 196, y: 684, size: 20, align: 'left' }, x0: 344, y: 677, step: 30, r: 11, tag: true },
      rejects: { label: { x: 196, y: 720, size: 18, align: 'left' }, ok: { x: 590, y: 720, size: 20 }, x0: 344, y: 713, step: 22, size: 14, fromX: 712 },
      folder: { x: 316, y: 800, s: 1 },
      folder2: { x: 316, y: 1030, s: 0.72 },
      tray: { x: 456, y: 740, w: 236, h: 126, label: { x: 472, y: 766 }, card: { x: 580, y: 818, s: 0.72 } },
      boundary: { x1: 176, y1: 878, x2: 692, y2: 878, label: { x: 692, y: 870, align: 'right' } },
      desk2: { x: 176, y: 896, w: 516, h: 300, title: { x: 198, y: 938 }, sub: { x: 198, y: 972 } },
      card2: { x: 316, y: 1136 },
      rows: { x: 462, y0: 994, w: 226, h: 58, gap: 8, label: { x: 462, y: 982, size: 18 } },
    };
  }

  function wideAnchors() {
    return {
      W: 1280, H: 720,
      head: { x: 48, y: 64, size: 32 },
      dots: { x: 1232, y: 50, gap: 22, r: 6 },
      footer: { x: 48, y: 708, size: 14 },
      railLabel: { x: 48, y: 100, size: 15, align: 'left' },
      slots: [120, 340, 610, 796, 1080].map((cx) => ({ x: cx - 60, y: 112, w: 120, h: 92 })),
      conn: [[120, 232, 120, 250], [340, 232, 340, 250], [610, 232, 610, 314], [796, 232, 796, 412], [1080, 232, 1080, 250]],
      chip: { x: 640, y: 262, w: 360, h: 84 },
      big: [0, 1, 2, 3, 4].map((i) => ({ x: 155 + i * 200, y: 330, w: 170, h: 200 })),
      desk1: { x: 40, y: 250, w: 480, h: 434, title: { x: 60, y: 290 } },
      pill: { x: 60, y: 304, w: 262, h: 38, size: 19 },
      tokens: { x: 338, y: 306, h: 34, align: 'left', size: 18 },
      pile: { cx: 150, cy: 470, w: 104, h: 72, cap: { x: 150, y: 534, align: 'center', size: 17 } },
      fan: { x0: 60, step: 57, y: 352, w: 52, h: 70 },
      card1: { x: 360, y: 470 },
      result: { x: 242, y: 556, w: 236, h: 112 },
      record: { x: 130, y: 612, s: 0.9 },
      recordArrow: [240, 612, 186, 612],
      arrows: [[213, 470, 244, 470], [360, 528, 360, 554]],
      spine: [[476, 470, 536, 470], [684, 470, 710, 470], [882, 470, 936, 470]],
      gate: { cx: 610, beamX1: 534, beamX2: 686, beamY: 316, beamH: 22, pillarW: 16, pTop: 338, pBot: 600, cardY: 470, cardS: 0.46 },
      gateGlow: { x: 526, y: 304, w: 168, h: 384 },
      gateText: { icon: null, x: 610, align: 'center', lines: [{ y: 630, size: 20 }] },
      checks: { label: { x: 610, y: 656, size: 17, align: 'center' }, x0: 564, y: 380, step: 13, r: 5.5, tag: false },
      rejects: { label: { x: 610, y: 680, size: 17, align: 'center' }, ok: null, x0: 559, y: 556, step: 9.6, size: 7, fromX: 700 },
      folder: { x: 796, y: 470, s: 0.7 },
      folder2: { x: 1010, y: 430, s: 0.6 },
      tray: { x: 712, y: 540, w: 168, h: 144, label: { x: 724, y: 566 }, card: { x: 796, y: 628, s: 0.62 } },
      boundary: { x1: 900, y1: 250, x2: 900, y2: 684, label: { x: 900, y: 242, align: 'center' } },
      desk2: { x: 920, y: 250, w: 320, h: 434, title: { x: 940, y: 290 }, sub: { x: 940, y: 324 } },
      card2: { x: 1080, y: 600 },
      rows: { x: 1096, y0: 384, w: 136, h: 44, gap: 8, label: { x: 1096, y: 372, size: 15 } },
    };
  }

  const canvas = document.getElementById('film');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const A = H >= W ? portraitAnchors() : wideAnchors();
  const K = Math.min(W / A.W, H / A.H);
  const OX = (W - A.W * K) / 2;
  const OY = (H - A.H * K) / 2;
  const PATHS = Object.fromEntries(Object.entries(GLYPHS).map(([k, g]) => [k, { d: new Path2D(g.d), fill: g.fill ? new Path2D(g.fill) : null }]));

  let D = null;
  let ready = false;

  // ---------- 時刻の計算（すべて t だけから） ----------

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const prog = (t, a, b) => ease(clamp((t - a) / (b - a)));
  const lin = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, p) => a + (b - a) * p;
  const env = (t, a, b, f = 0.3) => prog(t, a, a + f) * (1 - prog(t, b - f, b));
  function mix(a, b, p) {
    const out = {};
    for (const k of Object.keys(a)) out[k] = typeof a[k] === 'number' && typeof b[k] === 'number' ? lerp(a[k], b[k], p) : a[k];
    return out;
  }
  function mixColor(a, b, p) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], p))).join(',')})`;
  }

  // ---------- 描画の部品 ----------

  function setFont(size, weight = 400, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }
  function text(str, x, y, o = {}) {
    const size = o.size || 20;
    let s = size;
    setFont(s, o.weight || 400, o.family || SANS);
    if (o.maxW) while (s > 9 && ctx.measureText(str).width > o.maxW) { s -= 1; setFont(s, o.weight || 400, o.family || SANS); }
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }
  function measure(str, size, weight = 400, family = SANS) { setFont(size, weight, family); return ctx.measureText(str).width; }
  function rrect(x, y, w, h, r) {
    const q = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + q, y);
    ctx.arcTo(x + w, y, x + w, y + h, q);
    ctx.arcTo(x + w, y + h, x, y + h, q);
    ctx.arcTo(x, y + h, x, y, q);
    ctx.arcTo(x, y, x + w, y, q);
    ctx.closePath();
  }
  function paint(fill, stroke, lw = 2, dash = null) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.setLineDash(dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  function paperPath(x, y, w, h) {
    const f = Math.min(w, h) * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - f, y);
    ctx.lineTo(x + w, y + f);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    return f;
  }
  function paper(x, y, w, h, fill, stroke, lw) {
    const f = paperPath(x, y, w, h);
    paint(fill, stroke, lw);
    ctx.beginPath();
    ctx.moveTo(x + w - f, y);
    ctx.lineTo(x + w - f, y + f);
    ctx.lineTo(x + w, y + f);
    ctx.closePath();
    paint('#e9dfc9', stroke, lw * 0.8);
  }
  function glyph(name, cx, cy, size, color, fillColor) {
    const g = PATHS[name];
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / 24, size / 24);
    if (g.fill) { ctx.fillStyle = fillColor || C.teal; ctx.fill(g.fill); }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(g.d);
    ctx.restore();
  }
  function line(x1, y1, x2, y2, color, lw, dash) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function arrow([x1, y1, x2, y2], p, color = C.navy, lw = 3) {
    if (p <= 0) return;
    const ex = lerp(x1, x2, p);
    const ey = lerp(y1, y2, p);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const len = 12;
    line(x1, y1, ex - Math.cos(ang) * len * 0.6 * p, ey - Math.sin(ang) * len * 0.6 * p, color, lw);
    ctx.save();
    ctx.globalAlpha *= clamp((p - 0.6) / 0.4);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(ang) * len + Math.sin(ang) * len * 0.55, ey - Math.sin(ang) * len - Math.cos(ang) * len * 0.55);
    ctx.lineTo(ex - Math.cos(ang) * len - Math.sin(ang) * len * 0.55, ey - Math.sin(ang) * len + Math.cos(ang) * len * 0.55);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  function pill(x, y, str, kind, size, align = 'left') {
    const colors = {
      progress: [C.ochreSoft, C.ochre, C.ochreInk],
      done: [C.teal, null, '#ffffff'],
      idle: ['#ffffff', '#8a909c', C.muted],
      teal: [C.teal, null, '#ffffff'],
      query: [C.card, C.teal, C.tealInk],
    }[kind];
    const w = measure(str, size, 700) + size * 1.2;
    const h = size + 10;
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    rrect(left, y, w, h, h / 2);
    paint(colors[0], colors[1], 1.6);
    text(str, left + w / 2, y + h / 2 + size * 0.36, { size, weight: 700, color: colors[2], align: 'center' });
    return w;
  }
  function withAlpha(a, fn) {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha *= a;
    fn();
    ctx.restore();
  }
  function person(x, y, size, color) {
    ctx.beginPath();
    ctx.arc(x, y - size * 0.18, size * 0.2, 0, Math.PI * 2);
    paint(color);
    ctx.beginPath();
    ctx.arc(x, y + size * 0.42, size * 0.36, Math.PI, 0);
    ctx.closePath();
    paint(color);
  }

  // ---------- 図の物 ----------

  // 作業カード（自然な大きさ 228×112 を中心と倍率で置く）
  function taskCard(pose, f, o = {}) {
    withAlpha(o.alpha === undefined ? 1 : o.alpha, () => {
      ctx.save();
      ctx.translate(pose.x, pose.y);
      ctx.scale(pose.s, pose.s);
      const w = 228;
      const h = 112;
      if (o.ring > 0) withAlpha(o.ring, () => { rrect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 20); paint(null, C.teal, 5); });
      rrect(-w / 2, -h / 2, w, h, 14);
      paint(C.card, C.navy, 3);
      rrect(-w / 2 + 3, -h / 2 + 3, 10, h - 6, 5);
      paint(o.parked ? C.grey : C.teal);
      text(f.id, -w / 2 + 26, -h / 2 + 30, { size: 18, family: MONO, color: C.muted });
      text(f.name, -w / 2 + 26, -h / 2 + 62, { size: 24, weight: 700, color: C.navy, maxW: w - 40 });
      const stamp = o.stamp || 0;
      const kind = o.status === 'done' ? 'done' : o.status === 'in-progress' ? 'progress' : 'idle';
      ctx.save();
      ctx.translate(-w / 2 + 26, h / 2 - 40);
      const pop = 1 + 0.3 * stamp * (1 - stamp) * 4 * 0.5;
      ctx.scale(pop, pop);
      pill(0, 0, STATUS_TEXT[o.status] || o.status, kind, 18);
      ctx.restore();
      if (o.badge > 0) withAlpha(o.badge, () => pill(w / 2 + 8, -h / 2 - 20, '1件だけ', 'teal', 17, 'right'));
      ctx.restore();
    });
  }

  function fileShape(r, name, o = {}) {
    const { x, y, w, h } = r;
    if (w < 2 || h < 2) return;
    withAlpha(o.alpha === undefined ? 1 : o.alpha, () => {
      if (o.glow > 0) withAlpha(o.glow, () => { rrect(x - 8, y - 8, w + 16, h + 16, 12); paint(null, C.teal, 5); });
      paper(x, y, w, h, C.paper, C.navy, Math.max(1.5, Math.min(w, h) * 0.028));
      const lines = ROLE_LINES[name];
      if (w / h > 1.8) {
        glyph(name, x + h * 0.5, y + h / 2, h * 0.5, C.navy, C.teal);
        const fz = Math.min(h * 0.36, 22);
        text(lines.join(''), x + h + 4, y + h / 2 + fz * 0.36, { size: fz, weight: 700, color: C.navy, maxW: w - h - 10 });
      } else {
        glyph(name, x + w / 2, y + h * 0.27, Math.min(w, h) * 0.3, C.navy, C.teal);
        if (h >= 56) {
          const fz = Math.min(w * 0.19, h * 0.19);
          text(lines[0], x + w / 2, y + h * 0.62, { size: fz, weight: 700, color: C.navy, align: 'center' });
          text(lines[1], x + w / 2, y + h * 0.62 + fz * 1.18, { size: fz, weight: 700, color: C.navy, align: 'center' });
        }
      }
      if (o.badge > 0) {
        withAlpha(o.badge, () => {
          const bs = Math.max(13, Math.min(18, Math.min(w, h) * 0.3));
          const pop = 1 + 0.25 * (1 - o.badge);
          ctx.save();
          ctx.translate(x + w + 4, y - 2);
          ctx.scale(pop, pop);
          pill(0, -bs * 0.4, '更新', 'progress', bs, 'right');
          ctx.restore();
        });
      }
      if (o.name > 0) withAlpha(o.name, () => text(name, x + w / 2, y + h + 15, { size: 13, family: MONO, color: C.muted, align: 'center' }));
    });
  }

  function noteResultView(q) {
    const res = q.output.results;
    const n = res.length;
    return {
      n,
      big: n === 0 ? '0件' : n === 1 ? res[0].id : n === 2 ? `${res[0].id}・${res[1].id}` : `${res[0].id}〜${res[n - 1].id}`,
      title: n === 0 ? '該当なし' : n === 1 ? res[0].title : `${res[0].title} ほか`,
      excerpt: n === 0 ? null : res[0].body,
    };
  }

  function resultCard(r, q, alpha) {
    withAlpha(alpha, () => {
      const { x, y, w, h } = r;
      rrect(x, y, w, h, 12);
      paint(C.resultBg, C.teal, 3);
      const v = noteResultView(q);
      text(`${q.id}の実際の結果`, x + 14, y + 26, { size: 16, weight: 700, color: C.tealInk });
      text(`${v.n}件`, x + w - 14, y + 26, { size: 16, weight: 700, color: C.tealInk, align: 'right' });
      text(v.big, x + 14, y + 64, { size: 32, weight: 700, family: MONO, color: C.ink });
      const bw = measure(v.big, 32, 700, MONO);
      text(v.title, x + 14 + bw + 12, y + 62, { size: 21, weight: 700, color: C.navy, maxW: w - bw - 40 });
      if (v.excerpt) {
        line(x + 16, y + 76, x + 16, y + 104, C.teal, 2.5);
        const chars = [...v.excerpt];
        const per = 12;
        const l1 = chars.slice(0, per).join('');
        const l2 = chars.slice(per, per * 2 - 1).join('') + (chars.length > per * 2 - 1 ? '…' : '');
        text(l1, x + 26, y + 88, { size: 15, family: SERIF, color: C.tealInk });
        text(l2, x + 26, y + 106, { size: 15, family: SERIF, color: C.tealInk });
      } else {
        text('該当なしが正しい結果', x + 14, y + 96, { size: 16, color: C.muted });
      }
    });
  }

  function folderBack(p, a) {
    withAlpha(a, () => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.s, p.s);
      rrect(-120, -62, 104, 26, 8);
      paint(C.folderBack, C.folderEdge, 2.5);
      rrect(-120, -50, 240, 110, 12);
      paint(C.folderBack, C.folderEdge, 2.5);
      ctx.restore();
    });
  }
  function folderFront(p, a) {
    withAlpha(a, () => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.s, p.s);
      rrect(-120, -8, 240, 68, 12);
      paint(C.folderFront, C.folderEdge, 2.5);
      text('ファイルに残す', 0, 36, { size: 22, weight: 700, color: C.navy, align: 'center' });
      ctx.restore();
    });
  }

  function evidencePaper(p, a) {
    withAlpha(a, () => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.s, p.s);
      paper(-50, -60, 100, 120, C.paper, C.teal, 3);
      glyph('check', 0, -24, 40, C.teal);
      text('検証の記録', 0, 22, { size: 17, weight: 700, color: C.navy, align: 'center' });
      text(`${D.vq}問・${D.nc}件`, 0, 44, { size: 14, color: C.muted, align: 'center' });
      ctx.restore();
    });
  }

  function recordPaper(p, a, q) {
    withAlpha(a, () => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.s, p.s);
      paper(-60, -50, 120, 100, C.paper, C.teal, 3);
      glyph('save', 0, -20, 32, C.teal);
      text(`${q.id}.json`, 0, 14, { size: 16, family: MONO, color: C.ink, align: 'center' });
      text('保存', 0, 38, { size: 18, weight: 700, color: C.tealInk, align: 'center' });
      ctx.restore();
    });
  }

  // ---------- 位置（時刻の関数） ----------

  const folderPose = (t) => mix(A.folder, A.folder2, prog(t, 22.4, 24.0));
  function inFolder(t, key) {
    const f = folderPose(t);
    const o = PEEK[key];
    return { x: f.x + o.x * f.s, y: f.y + o.y * f.s, s: o.s * f.s };
  }
  const card1Home = () => ({ x: A.card1.x, y: A.card1.y, s: 1 });
  const card2Home = () => ({ x: A.card2.x, y: A.card2.y, s: 1 });
  const gatePose = () => ({ x: A.gate.cx, y: A.gate.cardY, s: A.gate.cardS });

  function cardPose(t) {
    if (t < 16) return { pose: card1Home(), layer: 'top' };
    if (t < 17) return { pose: mix(card1Home(), gatePose(), prog(t, 16, 17)), layer: 'top' };
    if (t < 21.0) return { pose: gatePose(), layer: 'top' };
    if (t < 21.9) return { pose: mix(gatePose(), inFolder(t, 'card'), prog(t, 21.0, 21.9)), layer: 'top' };
    if (t < 24.2) return { pose: inFolder(t, 'card'), layer: 'folder' };
    if (t < 25.0) return { pose: mix(inFolder(t, 'card'), card2Home(), prog(t, 24.2, 25.0)), layer: 'top' };
    return { pose: card2Home(), layer: 'top' };
  }

  function evidencePose(t) {
    if (t < 20.6) return null;
    const start = { x: A.gate.cx, y: A.gate.cardY, s: 0.3 };
    if (t < 21.4) return { pose: mix(start, inFolder(t, 'evidence'), prog(t, 20.6, 21.4)), layer: 'top', a: prog(t, 20.6, 20.8) };
    return { pose: inFolder(t, 'evidence'), layer: 'folder', a: 1 };
  }

  const mixRect = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });
  function folderRect(t, key, slot) {
    const c = inFolder(t, key);
    return { x: c.x - (slot.w * c.s) / 2, y: c.y - (slot.h * c.s) / 2, w: slot.w * c.s, h: slot.h * c.s };
  }
  function rowRect(k) {
    const r = A.rows;
    return { x: r.x, y: r.y0 + k * (r.h + r.gap), w: r.w, h: r.h };
  }

  function fileState(t, i) {
    const slot = A.slots[i];
    const big = A.big[i];
    const pop0 = 5.5 + i * 0.5;
    const pop1 = pop0 + 0.45;
    const fly0 = 8.6 + i * 0.1;
    const fly1 = fly0 + 0.9;
    if (t < pop0) return null;
    if (t < pop1) {
      const c = A.chip;
      return { rect: mixRect({ x: c.x - 12, y: c.y - 12, w: 24, h: 24 }, big, prog(t, pop0, pop1)), a: lin(t, pop0, pop0 + 0.15), layer: 'top', name: 0 };
    }
    if (t < fly0) return { rect: big, a: 1, layer: 'top', name: 1 };
    if (t < fly1) return { rect: mixRect(big, slot, prog(t, fly0, fly1)), a: 1, layer: 'top', name: 0 };
    const k = STATE_K[i];
    if (k === undefined) return { rect: slot, a: 1, layer: 'top', name: 1 };
    const in0 = 21.0 + k * 0.15;
    const in1 = in0 + 0.8;
    const out0 = 24.2 + k * 0.12;
    const out1 = out0 + 0.8;
    const back0 = 27.0 + k * 0.12;
    const back1 = back0 + 1.2;
    const key = `f${k}`;
    if (t < in0) return { rect: slot, a: 1, layer: 'top', name: 1 };
    if (t < in1) return { rect: mixRect(slot, folderRect(t, key, slot), prog(t, in0, in1)), a: 1, layer: 'top', name: 0 };
    if (t < out0) return { rect: folderRect(t, key, slot), a: 1, layer: 'folder', name: 0 };
    if (t < out1) return { rect: mixRect(folderRect(t, key, slot), rowRect(k), prog(t, out0, out1)), a: 1, layer: 'top', name: 0 };
    if (t < back0) return { rect: rowRect(k), a: 1, layer: 'top', name: 0 };
    if (t < back1) return { rect: mixRect(rowRect(k), slot, prog(t, back0, back1)), a: 1, layer: 'top', name: 0 };
    return { rect: slot, a: 1, layer: 'top', name: 1 };
  }

  function fileGlow(t, i) {
    if (i === 0 || i === 1) return env(t, 10.2, 11.2);
    if (i === 2) return env(t, 16.2, 17.2);
    return 0;
  }

  function drawFile(t, i, layer) {
    const s = fileState(t, i);
    if (!s || s.layer !== layer) return;
    const k = STATE_K[i];
    const badge = k === undefined ? 0 : prog(t, 25.0 + k * 0.25, 25.3 + k * 0.25);
    fileShape(s.rect, FILES[i], { alpha: s.a, glow: fileGlow(t, i), badge, name: s.name });
  }

  // ---------- 場面ごとの層 ----------

  function sceneIndex(t) {
    for (let i = 0; i < SCENES.length; i += 1) if (t < SCENES[i][2]) return i;
    return SCENES.length - 1;
  }

  function drawDesk(box, title, a, focus, dim) {
    withAlpha(a, () => {
      rrect(box.x, box.y, box.w, box.h, 18);
      paint(dim ? '#f4efe3' : C.desk, C.line, 2, dim ? [10, 8] : null);
      if (focus > 0) withAlpha(focus, () => { rrect(box.x, box.y, box.w, box.h, 18); paint(null, C.teal, 4.5); });
      text(title, box.title.x, box.title.y, { size: 26, weight: 700, color: C.navy });
    });
  }

  function drawGateFrame(t, a) {
    const g = A.gate;
    const on = prog(t, 16.6, 17.0);
    withAlpha(a, () => {
      const col = mixColor(C.grey, C.navy, on);
      rrect(g.beamX1, g.beamY, g.beamX2 - g.beamX1, g.beamH, 5);
      paint(col);
      text('確かめる', g.cx, g.beamY + g.beamH * 0.78, { size: g.beamH * 0.74, weight: 700, color: '#ffffff', align: 'center' });
      rrect(g.beamX1 + 6, g.pTop, g.pillarW, g.pBot - g.pTop, 4);
      paint(col);
      rrect(g.beamX2 - 6 - g.pillarW, g.pTop, g.pillarW, g.pBot - g.pTop, 4);
      paint(col);
      line(g.beamX1 - 6, g.pBot, g.beamX2 + 6, g.pBot, C.ghost, 2.5);
    });
  }

  function drawStations(t) {
    const focus1 = env(t, 10.0, 16.0, 0.4);
    drawDesk(A.desk1, '実装のセッション', prog(t, 0, 0.6), focus1, false);
    const gg = env(t, 16.0, 22.0, 0.4);
    withAlpha(gg, () => { const r = A.gateGlow; rrect(r.x, r.y, r.w, r.h, 18); paint(C.tealSoft); });
    drawGateFrame(t, prog(t, 0.15, 0.75));
    // 待機の場所
    withAlpha(prog(t, 0.35, 0.95), () => {
      const tr = A.tray;
      rrect(tr.x, tr.y, tr.w, tr.h, 14);
      paint(null, C.ghost, 2, [8, 7]);
      text('待機', tr.label.x, tr.label.y, { size: 18, weight: 700, color: C.muted });
    });
    // セッションの区切り
    withAlpha(prog(t, 0.5, 1.1), () => {
      const b = A.boundary;
      line(b.x1, b.y1, b.x2, b.y2, C.ghost, 2.5, [12, 10]);
      text('セッションが変わる', b.label.x, b.label.y, { size: 15, color: C.muted, align: b.label.align });
    });
    const live = prog(t, 22.0, 22.6);
    drawDesk(A.desk2, '新しいセッション', prog(t, 0.45, 1.05) * (0.55 + 0.45 * live), env(t, 22.2, 27.0, 0.4), live < 0.5);
    withAlpha(prog(t, 23.4, 23.9), () => text('根拠を読んで状態更新', A.desk2.sub.x, A.desk2.sub.y, { size: 22, weight: 700, color: C.tealInk }));
    // まだ誰もいない席と、カードが離れた席
    withAlpha(prog(t, 0.45, 1.05) * (1 - prog(t, 24.6, 25.0)), () => ghostSlot(A.card2, 'まだ'));
    withAlpha(prog(t, 16.3, 16.8), () => ghostSlot(A.card1, ''));
  }

  function ghostSlot(c, label) {
    rrect(c.x - 114, c.y - 56, 228, 112, 14);
    paint(null, C.ghost, 2, [8, 6]);
    if (label) text(label, c.x, c.y + 8, { size: 20, color: C.muted, align: 'center' });
  }

  function drawConnectors(t) {
    A.conn.forEach((ln, i) => {
      const solid = prog(t, 9.4 + i * 0.08, 9.9 + i * 0.08);
      withAlpha(0.6 * prog(t, 0.6, 1.2) * (1 - solid), () => line(ln[0], ln[1], ln[2], ln[3], C.ghost, 2, [6, 6]));
      if (solid > 0) {
        const ex = lerp(ln[0], ln[2], solid);
        const ey = lerp(ln[1], ln[3], solid);
        const glow = fileGlow(t, i);
        line(ln[0], ln[1], ex, ey, mixColor(C.grey, C.teal, glow), 2.5 + glow * 2);
        withAlpha(clamp((solid - 0.8) / 0.2), () => { ctx.beginPath(); ctx.arc(ln[2], ln[3], 5, 0, Math.PI * 2); paint(mixColor(C.grey, C.teal, glow)); });
      }
    });
  }

  function drawRailSlots(t) {
    const a = prog(t, 0.4, 1.0);
    withAlpha(a, () => {
      const l = A.railLabel;
      text('5つのファイル', l.x, l.y, { size: l.size, weight: 700, color: C.navy, align: l.align });
      A.slots.forEach((s) => { rrect(s.x, s.y, s.w, s.h, 8); paint(null, C.ghost, 2, [7, 6]); });
    });
  }

  function drawSpine(t) {
    arrow(A.spine[0], prog(t, 1.0, 1.6), mixColor(C.navy, C.teal, env(t, 15.8, 17.2)));
    arrow(A.spine[1], prog(t, 1.6, 2.1), mixColor(C.navy, C.teal, env(t, 20.6, 22.0)));
    arrow(A.spine[2], prog(t, 2.1, 2.7), mixColor(C.navy, C.teal, env(t, 22.2, 24.2)));
    arrow(A.arrows[0], prog(t, 0.9, 1.3));
    arrow(A.arrows[1], prog(t, 1.3, 1.7));
    arrow(A.recordArrow, prog(t, 28.2, 28.8), C.teal);
    withAlpha(0.5 * prog(t, 22.8, 23.4), () => {
      const f = A.folder;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.s, f.s);
      rrect(-120, -50, 240, 110, 12);
      paint(null, C.folderEdge, 2.5, [8, 7]);
      ctx.restore();
    });
  }

  function drawFolderLayer(t) {
    const fp = folderPose(t);
    const fa = prog(t, 0.3, 0.9);
    folderBack(fp, fa);
    const ev = evidencePose(t);
    if (ev && ev.layer === 'folder') evidencePaper(ev.pose, ev.a);
    const cp = cardPose(t);
    if (cp.layer === 'folder') taskCard(cp.pose, D.f1Impl, { status: D.f1Impl.status });
    for (let i = 0; i < FILES.length; i += 1) drawFile(t, i, 'folder');
    folderFront(fp, fa);
  }

  function pileRect(i) {
    const p = A.pile;
    return { x: p.cx - p.w / 2 + (i - 3.5) * 2.4, y: p.cy - p.h / 2 + (i - 3.5) * 1.8, w: p.w, h: p.h };
  }
  function fanRect(i) {
    const f = A.fan;
    return { x: f.x0 + i * f.step, y: f.y, w: f.w, h: f.h };
  }
  const fanP = (t, i) => prog(t, 12.4 + i * 0.035, 13.1 + i * 0.035) * (1 - prog(t, 14.0 + (7 - i) * 0.035, 14.7 + (7 - i) * 0.035));

  function drawNotes(t) {
    const a = prog(t, 0.5, 1.1);
    const matched = new Set(D.q03.output.result_ids);
    const m = prog(t, 13.2, 13.6) * (1 - prog(t, 14.5, 14.9));
    let spread = 0;
    withAlpha(a, () => {
      D.notes.forEach((note, i) => {
        const fp = fanP(t, i);
        spread = Math.max(spread, fp);
        const r = mixRect(pileRect(i), fanRect(i), fp);
        const hit = matched.has(note.id);
        withAlpha(hit ? 1 : 1 - 0.68 * m, () => {
          rrect(r.x, r.y, r.w, r.h, 6);
          paint(hit ? mixColor(C.paper, C.tealSoft, m) : C.paper, hit ? mixColor(C.edge, C.teal, m) : C.edge, 1.6 + (hit ? 1.6 * m : 0));
          withAlpha(1 - fp, () => {
            if (i === D.notes.length - 1) for (let k = 0; k < 3; k += 1) line(r.x + 14, r.y + 20 + k * 16, r.x + r.w - 14 - (k % 2) * 20, r.y + 20 + k * 16, '#c9c2b2', 2);
          });
          withAlpha(fp, () => text(note.id, r.x + r.w / 2, r.y + r.h / 2 + 7, { size: 18, weight: 700, family: MONO, color: hit && m > 0 ? C.tealInk : C.ink, align: 'center' }));
        });
      });
      const c = A.pile.cap;
      withAlpha(1 - spread, () => text(`メモ${D.notes.length}件`, c.x, c.y, { size: c.size, weight: 700, color: C.navy, align: c.align }));
    });
    // N02 から結果へ（実際の結果の写し）
    if (t >= 13.8 && t < 14.95) {
      const idx = D.notes.findIndex((n) => n.id === D.q03.output.result_ids[0]);
      if (idx >= 0) {
        const r = mixRect(fanRect(idx), A.result, prog(t, 13.8, 14.8));
        withAlpha(1 - prog(t, 14.6, 14.95), () => {
          rrect(r.x, r.y, r.w, r.h, 10);
          paint(C.resultBg, C.teal, 3);
          text(D.notes[idx].id, r.x + r.w / 2, r.y + r.h / 2 + 8, { size: 20, weight: 700, family: MONO, color: C.tealInk, align: 'center' });
        });
      }
    }
  }

  function q6Weight(t) { return prog(t, 19.6, 20.0) * (1 - prog(t, 22.0, 22.4)); }

  function drawQueryPill(t) {
    const p = A.pill;
    const a = prog(t, 1.0, 1.5);
    const w6 = q6Weight(t);
    withAlpha(a, () => {
      rrect(p.x, p.y, p.w, p.h, p.h / 2);
      paint(C.card, C.teal, 2.4);
      [[D.q03, 1 - w6], [D.q06, w6]].forEach(([q, qa]) => withAlpha(qa, () => {
        const idw = measure(`${q.id} `, p.size, 700, MONO);
        text(`${q.id} `, p.x + 14, p.y + p.h / 2 + p.size * 0.36, { size: p.size, weight: 700, family: MONO, color: C.tealInk });
        text(`「${q.input.query}」`, p.x + 14 + idw, p.y + p.h / 2 + p.size * 0.36, { size: p.size, color: C.tealInk, maxW: p.w - idw - 24 });
      }));
    });
    const ta = prog(t, 11.8, 12.3) * (1 - prog(t, 15.6, 16.0));
    withAlpha(ta, () => {
      const tk = A.tokens;
      const chips = D.q03.output.tokens;
      const widths = chips.map((c) => measure(c, tk.size, 700) + tk.size * 1.2);
      const total = widths.reduce((s, w) => s + w, 0) + (chips.length - 1) * 10;
      let x = tk.align === 'right' ? tk.x - total : tk.x;
      chips.forEach((c, i) => {
        const d = (1 - prog(t, 11.8 + i * 0.12, 12.3 + i * 0.12)) * 18;
        pill(x, tk.y - d, c, 'teal', tk.size);
        x += widths[i] + 10;
      });
    });
  }

  function drawResults(t) {
    const vis = t < 10.4 ? prog(t, 1.2, 1.8) : t < 14.5 ? 1 - prog(t, 10.4, 10.8) : prog(t, 14.5, 14.9);
    const w6 = q6Weight(t);
    resultCard(A.result, D.q03, vis * (1 - w6));
    resultCard(A.result, D.q06, vis * w6);
  }

  function drawGateText(t) {
    const g = A.gateText;
    withAlpha(prog(t, 16.2, 16.8), () => {
      if (g.icon) person(g.icon.x, g.icon.y, g.icon.size, C.navy);
      const [l1, l2, l3] = g.lines;
      text('制作担当が実行', g.x, l1.y, { size: l1.size, weight: 700, color: C.navy, align: g.align });
      if (l2) text('./init.sh', g.x, l2.y, { size: l2.size, family: MONO, color: C.muted, align: g.align });
      if (l3) text(`終了コード ${D.exit}`, g.x, l3.y, { size: l3.size, color: C.muted, align: g.align });
    });
    const ck = A.checks;
    withAlpha(prog(t, 16.9, 17.2), () => {
      text(`${D.vq}問 一致`, ck.label.x, ck.label.y, { size: ck.label.size, weight: 700, color: C.tealInk, align: ck.label.align });
      for (let i = 0; i < D.vq; i += 1) {
        const cx = ck.x0 + i * ck.step;
        const on = prog(t, 17.0 + i * 0.2, 17.15 + i * 0.2);
        ctx.beginPath();
        ctx.arc(cx, ck.y, ck.r, 0, Math.PI * 2);
        paint(on > 0 ? mixColor(C.paper, C.teal, on) : C.paper, C.teal, 2);
        if (on > 0.5) {
          ctx.beginPath();
          ctx.moveTo(cx - ck.r * 0.45, ck.y + ck.r * 0.02);
          ctx.lineTo(cx - ck.r * 0.1, ck.y + ck.r * 0.38);
          ctx.lineTo(cx + ck.r * 0.5, ck.y - ck.r * 0.35);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1.5, ck.r * 0.22);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
        if (i === D.q06Index) {
          const ring = env(t, 19.6, 22.0, 0.4);
          withAlpha(ring, () => {
            ctx.beginPath();
            ctx.arc(cx, ck.y, ck.r + 5, 0, Math.PI * 2);
            paint(null, C.ochre, 3);
            if (ck.tag) text(D.q06.id, cx, ck.y - ck.r - 9, { size: 14, weight: 700, family: MONO, color: C.ochreInk, align: 'center' });
          });
        }
      }
    });
    const rj = A.rejects;
    const okP = prog(t, 20.3, 20.7);
    withAlpha(prog(t, 18.6, 18.9), () => {
      const base = `不正入力${D.nc}件`;
      if (rj.ok) {
        text(base, rj.label.x, rj.label.y, { size: rj.label.size, weight: 700, color: C.red, align: rj.label.align });
        withAlpha(okP, () => text('拒否 ✓', rj.ok.x, rj.ok.y, { size: rj.ok.size, weight: 700, color: C.tealInk }));
      } else {
        withAlpha(1 - okP, () => text(base, rj.label.x, rj.label.y, { size: rj.label.size, weight: 700, color: C.red, align: rj.label.align }));
        withAlpha(okP, () => text(`${base}を拒否 ✓`, rj.label.x, rj.label.y, { size: rj.label.size, weight: 700, color: C.tealInk, align: rj.label.align }));
      }
    });
    for (let i = 0; i < D.nc; i += 1) {
      const t0 = 18.7 + i * 0.13;
      if (t < t0) continue;
      const p = prog(t, t0, t0 + 0.32);
      const x = lerp(rj.fromX, rj.x0 + i * rj.step, p);
      const s = rj.size;
      const y = rj.y - s / 2;
      const stop = p >= 1 ? 1 : 0;
      rrect(x, y, s, s, 2);
      paint(stop ? C.redSoft : C.ochreSoft, stop ? C.red : C.ochre, 1.6);
      if (stop) {
        line(x + s * 0.25, y + s * 0.25, x + s * 0.75, y + s * 0.75, C.red, Math.max(1.2, s * 0.14));
        line(x + s * 0.75, y + s * 0.25, x + s * 0.25, y + s * 0.75, C.red, Math.max(1.2, s * 0.14));
      }
    }
  }

  function drawTray(t) {
    const tr = A.tray;
    const pulse = Math.max(env(t, 10.8, 11.8), env(t, 26.0, 27.0));
    taskCard({ x: tr.card.x, y: tr.card.y, s: tr.card.s }, D.f2Impl, {
      alpha: prog(t, 1.4, 2.0), status: t < 25.6 ? D.f2Impl.status : D.f2Res.status, parked: true, ring: pulse,
    });
  }

  function drawCardTop(t) {
    const cp = cardPose(t);
    if (cp.layer !== 'top') return;
    const stamp = prog(t, 25.6, 25.95);
    const status = stamp < 0.5 ? D.f1Impl.status : D.f1Res.status;
    taskCard(cp.pose, stamp < 0.5 ? D.f1Impl : D.f1Res, {
      alpha: prog(t, 0.6, 1.2), status, stamp, ring: env(t, 10.2, 16.0, 0.4), badge: env(t, 10.3, 16.0, 0.4),
    });
  }

  function drawEvidenceTop(t) {
    const ev = evidencePose(t);
    if (ev && ev.layer === 'top') evidencePaper(ev.pose, ev.a);
  }

  function drawRecord(t) {
    if (t < 27.4) return;
    const r = A.result;
    const from = { x: r.x + r.w / 2, y: r.y + r.h / 2, s: 0.3 };
    const to = { x: A.record.x, y: A.record.y, s: A.record.s };
    recordPaper(mix(from, to, prog(t, 27.4, 28.4)), prog(t, 27.4, 27.6), D.q03);
  }

  function drawTravelDot(t) {
    const a = env(t, 2.8, 4.6, 0.25);
    if (a <= 0) return;
    const pts = [card1Home(), gatePose(), A.folder, card2Home()];
    const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
    const total = lens.reduce((s, l) => s + l, 0);
    let d = prog(t, 2.9, 4.5) * total;
    let x = pts[0].x;
    let y = pts[0].y;
    for (let i = 0; i < lens.length; i += 1) {
      if (d <= lens[i] || i === lens.length - 1) {
        const p = lens[i] === 0 ? 1 : clamp(d / lens[i]);
        x = lerp(pts[i].x, pts[i + 1].x, p);
        y = lerp(pts[i].y, pts[i + 1].y, p);
        break;
      }
      d -= lens[i];
    }
    withAlpha(a, () => {
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      paint('rgba(31,122,114,0.25)');
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      paint(C.teal);
    });
  }

  function drawVeilAndChip(t) {
    withAlpha(0.88 * prog(t, 5.0, 5.4) * (1 - prog(t, 8.8, 9.4)), () => { ctx.fillStyle = C.bg; ctx.fillRect(-OX / K, -OY / K, W / K, H / K); });
    withAlpha(prog(t, 5.1, 5.5) * (1 - prog(t, 8.6, 9.0)), () => {
      const c = A.chip;
      rrect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 16);
      paint(C.navy);
      text('Harness Creator', c.x, c.y + 4, { size: 30, weight: 700, color: '#ffffff', align: 'center' });
      text('create-harness.mjs', c.x, c.y + 32, { size: 16, family: MONO, color: C.tealSoft, align: 'center' });
    });
  }

  function drawRowsLabel(t) {
    const r = A.rows.label;
    withAlpha(prog(t, 24.8, 25.2) * (1 - prog(t, 27.0, 27.4)), () => text('更新は3つだけ', r.x, r.y, { size: r.size, weight: 700, color: C.ochreInk }));
  }

  function drawChrome(t) {
    const i = sceneIndex(t);
    const sc = D.timeline.scenes[i];
    const aIn = i === 0 ? prog(t, 0.2, 0.7) : prog(t, sc.in, sc.in + 0.45);
    const aOut = i === SCENES.length - 1 ? 1 : 1 - prog(t, sc.out - 0.35, sc.out);
    withAlpha(aIn * aOut, () => text(sc.headline, A.head.x, A.head.y, { size: A.head.size, weight: 700, family: SERIF, color: C.navy, maxW: A.W - A.head.x * 2 }));
    const dt = A.dots;
    SCENES.forEach((_, k) => {
      ctx.beginPath();
      ctx.arc(dt.x - (SCENES.length - 1 - k) * dt.gap, dt.y, dt.r, 0, Math.PI * 2);
      paint(k === i ? C.teal : k < i ? '#9fc7c1' : '#ffffff', C.teal, 1.6);
    });
    text(D.footer, A.footer.x, A.footer.y, { size: A.footer.size, color: C.muted, maxW: A.W - A.footer.x * 2 });
  }

  function draw(time) {
    const t = clamp(Number(time) || 0, 0, DURATION);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    if (!ready) { ctx.restore(); return; }
    ctx.setTransform(K, 0, 0, K, OX, OY);
    drawStations(t);
    drawConnectors(t);
    drawRailSlots(t);
    drawSpine(t);
    drawFolderLayer(t);
    drawNotes(t);
    drawQueryPill(t);
    drawResults(t);
    drawGateText(t);
    drawTray(t);
    drawCardTop(t);
    drawEvidenceTop(t);
    drawRecord(t);
    drawTravelDot(t);
    drawRowsLabel(t);
    drawVeilAndChip(t);
    for (let i = 0; i < FILES.length; i += 1) drawFile(t, i, 'top');
    drawChrome(t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
  }

  // ---------- 素材の読み込みと照合（合わなければ止める） ----------

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fail = (message) => { throw new Error(message); };
  const sortedKeys = (o) => Object.keys(o).sort().join('\n');
  function same(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
    if (isObj(a)) {
      if (!isObj(b)) return false;
      const ka = Object.keys(a).sort();
      const kb = Object.keys(b).sort();
      return ka.length === kb.length && ka.every((k, i) => k === kb[i] && same(a[k], b[k]));
    }
    return false;
  }

  async function fetchBytes(url) {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store' });
    } catch {
      return fail(`${url} を取得できません（通信できませんでした）`);
    }
    if (!response.ok) fail(`${url} を取得できません（HTTP ${response.status}）`);
    return response.arrayBuffer();
  }
  function parseJson(buffer, url) {
    let textValue;
    try {
      textValue = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      fail(`${url} が UTF-8 として読めません`);
    }
    try {
      return JSON.parse(textValue);
    } catch {
      return fail(`${url} がJSONとして読めません`);
    }
  }
  async function sha256(buffer) {
    if (!window.crypto || !window.crypto.subtle) fail('この環境ではSHA-256を計算できないため、素材を確かめられません');
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  const sha256Text = (s) => sha256(new TextEncoder().encode(s));

  async function loadAssets() {
    const mbuf = await fetchBytes(MANIFEST_URL);
    if ((await sha256(mbuf)) !== MANIFEST_SHA256) fail('assets/manifest.json が固定した内容と違います（SHA-256 が一致しません）');
    const manifest = parseJson(mbuf, MANIFEST_URL);
    if (!isObj(manifest) || sortedKeys(manifest) !== 'assets\ncase\nformat' || manifest.format !== 'studio-yebisu-motion-assets-v1' || manifest.case !== CASE_ID) fail('assets/manifest.json の形式が想定と違います');
    if (!Array.isArray(manifest.assets) || manifest.assets.map((a) => a && a.file).join() !== ASSET_FILES.join()) fail('素材が想定の10件と違います');
    for (const a of manifest.assets) {
      if (sortedKeys(a) !== 'bytes\nfile\nsha256' || !Number.isInteger(a.bytes) || a.bytes <= 0 || !/^[0-9a-f]{64}$/.test(a.sha256)) fail(`${a.file} の記録の形が想定と違います`);
    }
    const buffers = await Promise.all(manifest.assets.map((a) => fetchBytes(`assets/${a.file}`)));
    const J = {};
    for (let i = 0; i < manifest.assets.length; i += 1) {
      const a = manifest.assets[i];
      if (buffers[i].byteLength !== a.bytes) fail(`assets/${a.file} のバイト数が記録と違います`);
      if ((await sha256(buffers[i])) !== a.sha256) fail(`assets/${a.file} の SHA-256 が記録と違います`);
      J[a.file] = parseJson(buffers[i], `assets/${a.file}`);
    }
    return checkAssets(J);
  }

  async function checkAssets(J) {
    const tl = J['timeline.json'];
    if (!isObj(tl) || tl.format !== 'studio-yebisu-harness-visual-timeline-v1' || tl.duration !== DURATION || tl.fps !== 30 || tl.silent !== true || !Array.isArray(tl.scenes) || tl.scenes.length !== SCENES.length) fail('timeline.json が32秒・30fps・無音・6場面ではありません');
    tl.scenes.forEach((s, i) => {
      const [id, tin, tout, q, st] = SCENES[i];
      if (s.id !== id || s.in !== tin || s.out !== tout || s.query !== q || s.stage !== st || typeof s.headline !== 'string' || s.headline === '') fail(`timeline.json の場面 ${i + 1} が想定と違います`);
    });

    const run = J['exercise-run.json'];
    if (!isObj(run) || run.format !== 'studio-yebisu-harness-exercise-v1' || !isObj(run.source) || run.source.repository !== REPO || run.source.commit !== PIN || run.fictional !== true) fail('exercise-run.json の形式・固定コミットが想定と違います');
    if (!Array.isArray(run.queries) || run.queries.map((q) => q.id).join() !== QUERY_IDS.join()) fail('exercise-run.json の8問が想定と違います');
    const idx = J['note-index.json'];
    if (!isObj(idx) || idx.format !== 'studio-yebisu-note-index-v1' || !Array.isArray(idx.notes) || idx.notes.map((n) => n.id).join() !== NOTE_IDS.join()) fail('note-index.json が8件の索引ではありません');
    const byId = new Map(idx.notes.map((n) => [n.id, n]));
    const qs = J['queries.json'];
    if (!isObj(qs) || qs.format !== 'studio-yebisu-note-queries-v1' || qs.fictional !== true || !Array.isArray(qs.queries) || qs.queries.map((q) => q.id).join() !== QUERY_IDS.join()) fail('queries.json が固定の8問ではありません');
    run.queries.forEach((q, i) => {
      const want = qs.queries[i];
      const out = q.output;
      if (q.status !== 'passed' || q.label !== want.label || q.input.query !== want.query || q.input.tag !== want.tag) fail(`${q.id} の条件が固定の8問と違います`);
      if (!isObj(out) || out.format !== 'studio-yebisu-note-search-v1' || out.query !== want.query || out.tag !== want.tag || !same(out.result_ids, want.expected_ids)) fail(`${q.id} の CLI 出力が想定と違います`);
      if (!same(out.results, out.result_ids.map((id) => byId.get(id)))) fail(`${q.id} の結果の全項目が索引と一致しません`);
    });
    const q03 = run.queries[2];
    const q06 = run.queries[5];
    if (!same(q03.output.tokens, ['読書会', '土曜']) || !same(q03.output.result_ids, ['N02'])) fail('Q03 の実際の結果が「読書会・土曜 → N02」ではありません');
    if (q06.output.result_ids.length !== 0 || q06.output.results.length !== 0) fail('Q06 の実際の結果が0件ではありません');

    const v = run.verification;
    if (!isObj(v) || v.command !== './init.sh' || v.exit_code !== 0 || v.note_count !== 8 || v.query_count !== 8 || v.negative_control_count !== 11) fail('exercise-run.json の検証の記録が想定と違います');
    const ver = J['verification-run.json'];
    if (!isObj(ver) || ver.format !== 'studio-yebisu-note-verification-v1' || ver.status !== 'passed' || ver.note_count !== 8 || ver.query_count !== 8 || ver.source_integrity !== true) fail('verification-run.json が passed・8件・8問ではありません');
    if (!Array.isArray(ver.queries) || ver.queries.length !== 8 || !ver.queries.every((q, i) => q.id === QUERY_IDS[i] && q.status === 'passed' && same(q.actual_ids, run.queries[i].output.result_ids))) fail('verification-run.json の8問が実行記録と一致しません');
    if (!Array.isArray(ver.negative_controls) || ver.negative_controls.length !== v.negative_control_count ||
        !ver.negative_controls.every((c) => c.exit_code === 1 && c.success_artifact_created === false && c.status === 'passed')) fail('verification-run.json の不正入力11件が「正しく拒否」ではありません');

    if (!Array.isArray(run.sessions) || run.sessions.length !== 2 || run.sessions[0].id !== 'implementation' || run.sessions[1].id !== 'resume') fail('exercise-run.json の2つのセッションが想定と違います');
    const feats = run.sessions.map((s) => {
      const f1 = s.features.find((f) => f.id === 'feat-001');
      const f2 = s.features.find((f) => f.id === 'feat-002');
      if (!f1 || !f2) fail(`${s.id} の feat-001・feat-002 がありません`);
      return { f1, f2 };
    });
    if (feats[0].f1.status !== 'in-progress' || feats[0].f2.status !== 'not-started' || feats[1].f1.status !== 'done' || feats[1].f2.status !== 'not-started') fail('2つのセッションの状態が想定と違います');

    const cr = J['harness-created.json'];
    if (!isObj(cr) || cr.format !== 'studio-yebisu-harness-created-v1' || cr.source.commit !== PIN || cr.exit_code !== 0 || !isObj(cr.created_files_sha256) || sortedKeys(cr.created_files_sha256) !== [...FILES].sort().join('\n')) fail('harness-created.json が想定と違います');

    const hd = J['handoff-data.json'];
    if (!isObj(hd) || hd.format !== 'studio-yebisu-harness-handoff-data-v1' || hd.source_commit !== PIN) fail('handoff-data.json の形式・固定コミットが想定と違います');
    if (!Array.isArray(hd.scaffold) || [...hd.scaffold.map((s) => s.name)].sort().join('\n') !== [...FILES].sort().join('\n')) fail('handoff-data.json の雛形が5ファイルではありません');
    for (const s of hd.scaffold) {
      if (s.sha256 !== cr.created_files_sha256[s.name] || (await sha256Text(s.text)) !== s.sha256) fail(`雛形 ${s.name} の中身が生成記録の SHA-256 と一致しません`);
    }
    for (const [i, key] of ['implementation', 'resume'].entries()) {
      const snap = hd.sessions && hd.sessions[key];
      if (!isObj(snap) || sortedKeys(snap) !== [...STATE_FILES].sort().join('\n')) fail(`handoff-data.json の ${key} の状態ファイルが3つではありません`);
      let fl;
      try { fl = JSON.parse(snap['feature_list.json']); } catch { fail(`${key} の feature_list.json が読めません`); }
      if (!same(fl.features, run.sessions[i].features)) fail(`${key} の feature_list.json が実行記録の状態と一致しません`);
    }
    for (const name of STATE_FILES) {
      if (hd.sessions.implementation[name] === hd.sessions.resume[name]) fail(`${name} が再開セッションで変わっていません`);
      if (hd.final_files[name] !== hd.sessions.resume[name]) fail(`最終の ${name} が再開後の写しと違います`);
    }
    if (hd.final_files['init.sh'] !== hd.scaffold.find((s) => s.name === 'init.sh').text) fail('最終の init.sh が生成時のままではありません');
    const facts = hd.facts;
    if (!isObj(facts) || facts.initial_session_ran_shell !== false || facts.production_editor_ran_verification !== true || facts.new_resume_session_ran_shell !== false ||
        !same(facts.resume_updates_only, STATE_FILES) || facts.feat002_not_started !== true || facts.new_revision_no_cli_or_agent_rerun !== true) fail('handoff-data.json の事実の記録が想定と違います');

    const dd = J['diagram-data.json'];
    if (!isObj(dd) || dd.format !== 'studio-yebisu-harness-diagram-v1' || dd.default_query !== 'Q03') fail('diagram-data.json の形式が想定と違います');
    if (!isObj(dd.file_roles) || sortedKeys(dd.file_roles) !== [...FILES].sort().join('\n') || !FILES.every((f) => dd.file_roles[f] === ROLE_LINES[f].join(''))) fail('diagram-data.json の5ファイルの役割が想定と違います');
    if (!same(dd.created_files, cr.created_files_sha256) || !same(dd.queries, run.queries) || !same(dd.notes, idx.notes) || !same(dd.sessions, run.sessions)) fail('diagram-data.json が実行記録と一致しません');
    if (!isObj(dd.verification) || dd.verification.negative_control_count !== 11 || dd.verification.query_count !== 8 || dd.verification.exit_code !== 0) fail('diagram-data.json の検証の件数が想定と違います');

    const up = J['upstream.json'];
    if (!isObj(up) || up.repository !== REPO || up.commit !== PIN || up.license !== 'MIT' || up.copyright_notice !== 'Copyright (c) 2025 WalkingLab') fail('upstream.json の原典・ライセンスが想定と違います');
    // original-verification.json は旧28秒版の確認記録。読み込みと照合だけ行い、この動画の確認としては使わない。
    const ov = J['original-verification.json'];
    if (!isObj(ov) || ov.id !== CASE_ID || ov.source_commit !== PIN) fail('original-verification.json が想定と違います');

    return {
      timeline: tl,
      notes: idx.notes,
      q03,
      q06,
      q06Index: ver.queries.findIndex((q) => q.id === 'Q06'),
      f1Impl: feats[0].f1,
      f2Impl: feats[0].f2,
      f1Res: feats[1].f1,
      f2Res: feats[1].f2,
      vq: ver.queries.length,
      nc: ver.negative_controls.length,
      exit: v.exit_code,
      footer: `Harness Creator（${up.commit.slice(0, 7)}・${up.license}）・架空のメモ${idx.notes.length}件・保存済みの実行記録`,
    };
  }

  async function fontsReady() {
    const loads = ['700 36px', '400 20px', '700 20px'].flatMap((w) => [`${w} ${SANS}`, `${w} ${SERIF}`]).concat([`400 16px ${MONO}`, `700 18px ${MONO}`]);
    if (document.fonts && document.fonts.load) await Promise.allSettled(loads.map((f) => document.fonts.load(f, '1件だけ進めて、続きはファイルへ。N02')));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  }

  // ---------- プレビュー（書き出し時は動かさない） ----------

  const $ = (id) => document.getElementById(id);
  const ui = {
    play: $('play'), replay: $('replay'), start: $('to-start'), end: $('to-end'), scrub: $('scrub'),
    time: $('time'), scenes: $('scenes'), status: $('film-status'),
    error: $('film-error'), errorText: $('film-error-text'), retry: $('film-retry'),
  };
  const buttons = [ui.play, ui.replay, ui.start, ui.end, ui.scrub];
  let current = 0;
  let playing = false;
  let anchorT = 0;
  let anchorNow = 0;
  let raf = 0;

  function markLayout() {
    const wide = W > H;
    const lp = $('lay-portrait');
    const lw = $('lay-wide');
    if (lp && lw) {
      (wide ? lw : lp).setAttribute('aria-current', 'page');
      (wide ? lp : lw).removeAttribute('aria-current');
    }
  }

  function updateUi() {
    if (RENDER) return;
    ui.time.textContent = `${current.toFixed(2)} / ${DURATION.toFixed(2)} 秒`;
    ui.scrub.value = String(current);
    ui.play.textContent = playing ? '一時停止' : '再生';
    const si = sceneIndex(current);
    for (const b of ui.scenes.querySelectorAll('.pv-scene')) b.setAttribute('aria-current', String(Number(b.dataset.i) === si));
  }

  function show(t) {
    current = clamp(t, 0, DURATION);
    draw(current);
    updateUi();
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    updateUi();
  }

  function tick(now) {
    if (!playing) return;
    const t = anchorT + (now - anchorNow) / 1000;
    if (t >= DURATION) {
      show(DURATION);
      stop();
      return;
    }
    show(t);
    raf = requestAnimationFrame(tick);
  }

  function play(from) {
    if (RENDER || !ready) return;
    if (from !== undefined) current = from;
    if (current >= DURATION) current = 0;
    playing = true;
    anchorT = current;
    anchorNow = performance.now();
    raf = requestAnimationFrame(tick);
    updateUi();
  }

  function buildScenes() {
    ui.scenes.replaceChildren(...D.timeline.scenes.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pv-scene';
      b.dataset.i = String(i);
      b.textContent = `${s.in}秒 ${SCENE_LABEL[s.id] || s.id}`;
      b.addEventListener('click', () => { stop(); show(s.in); });
      return b;
    }));
  }

  function showError(err) {
    stop();
    ready = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const b of buttons) b.disabled = true;
    for (const b of ui.scenes.querySelectorAll('button')) b.disabled = true;
    ui.errorText.textContent = err instanceof Error ? err.message : '素材を読み込めませんでした';
    ui.error.hidden = false;
    ui.status.textContent = '素材の照合に失敗したため、動画を描いていません。';
  }

  window.motionReady = (async () => {
    const data = await loadAssets();
    await fontsReady();
    D = data;
    ready = true;
    if (!RENDER) {
      buildScenes();
      for (const b of buttons) b.disabled = false;
      ui.status.textContent = '素材10件の SHA-256 と中身を確かめました。停止中です（自動では再生しません）。';
      show(0);
    }
  })();
  window.motionReady.catch(showError);

  window.seek = (t) => {
    if (!ready) return window.motionReady.then(() => draw(t));
    draw(t);
    return Promise.resolve();
  };

  markLayout();
  draw(0);
  if (!RENDER) {
    ui.play.addEventListener('click', () => (playing ? stop() : play()));
    ui.replay.addEventListener('click', () => { stop(); play(0); });
    ui.start.addEventListener('click', () => { stop(); show(0); });
    ui.end.addEventListener('click', () => { stop(); show(DURATION); });
    ui.scrub.addEventListener('input', () => { stop(); show(Number(ui.scrub.value)); });
    ui.retry.addEventListener('click', () => location.reload());
  }
})();
