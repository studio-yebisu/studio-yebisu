/* Quartz の使い方 — original Studio Yebisu composition (MIT). Canvas only; the two screenshots are captures of this example.
   Contract (Motion Reel): window.seek(seconds) rebuilds the complete frame from t alone. */
(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const overrides = window.renderConfig || {};
  window.motionConfig = {
    duration: 28,
    fps: overrides.fps || 30,
    width: overrides.width || 1280,
    height: overrides.height || 720,
    posterTime: 14,
    audioEvents: []
  };

  const D = 28;
  // The composition is laid out on a 1280x720 stage and scaled to the render size.
  const STAGE = {w: 1280, h: 720};
  // Title / parts / sample log / stopped step and its input-output / try the example.
  const BEATS = [0, 4.6, 9.2, 13.4, 22, 28];

  const C = {paper: '#f2eee3', sheet: '#fbf9f3', ink: '#17150f', soft: '#5a5446', orange: '#ff4f00', line: 'rgba(23,21,15,0.22)'};
  const GOTHIC = '"Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, "Noto Sans JP", sans-serif';
  const MINCHO = '"Yu Mincho", "Hiragino Mincho ProN", "BIZ UDPMincho", "Noto Serif JP", serif';

  /* ---------- Screenshots of the example ----------
     Captured by the parent at a 1280px-wide viewport from the top of the page (a 2x capture also works).
     FOCUS is in CSS px of that capture. These are layout estimates; adjust them after looking at the real capture. */
  const SHOTS = {
    light: {src: 'screenshot-light.png', note: '完了のサンプル（ライト表示）'},
    fail: {src: 'screenshot-fail.png', note: 'ツール失敗のサンプル'}
  };
  const PAGE_W = 1280;
  const FOCUS = {
    timeline: {x: 104, y: 254, w: 629, h: 272},
    failRow: {x: 104, y: 434, w: 629, h: 40},
    detail: {x: 757, y: 280, w: 419, h: 700},
    input: {x: 765, y: 732, w: 380, h: 24},
    output: {x: 765, y: 900, w: 240, h: 24}
  };

  function loadImage(shot) {
    return new Promise(resolve => {
      const img = new Image();
      img.decoding = 'sync';
      img.onload = () => { shot.img = img; resolve(); };
      img.onerror = () => { shot.img = null; resolve(); };
      img.src = shot.src;
    });
  }
  window.motionReady = Promise.all([document.fonts.ready, loadImage(SHOTS.light), loadImage(SHOTS.fail)])
    .then(() => window.seek(window.__lastSeek || 0));

  const COPY = {
    head: 'Quartz の使い方',
    field: 'UI・UX',
    name: 'Quartz',
    tagline: 'AIの実行を、見渡せるUIへ。',
    lead: 'AIの実行画面と開発者向けツールのための、白黒を基調にしたデザインシステム。',
    origin: 'arla6ka/skills　MIT License',
    fieldWords: ['Timeline', 'Status', 'JSON view', 'Button'],
    parts: ['Timeline', 'Status', 'JSON view', 'Button', 'Data list', 'Segmented control', 'Page header', 'Badge'],
    rules: ['状態は色ではなく、言葉で書く', 'トークン以外の色や寸法を使わない'],
    captions: [
      {from: 4.6, to: 9.2, n: 1, title: 'QuartzのSKILLと部品を使う', sub: '固定版のSKILL.mdを読み、Timeline・Status・JSON viewなどの実物の部品をそのまま読み込んで組みました。'},
      {from: 9.2, to: 13.4, n: 2, title: 'サンプルの実行ログを渡す', sub: '完了・ツール失敗・入力待ちの3件。AIには接続しない静的なサンプルで、秒数もサンプル値です。'},
      {from: 13.4, to: 17.6, n: 3, title: '止まった段を見つける', sub: 'ツール失敗の例では、3段目「SKILL.mdを取得」に失敗の印が付き、そこで止まっています。'},
      {from: 17.6, to: 22, n: 3, title: 'その段の入力と出力を確かめる', sub: '入力の path に systems/ が抜け、出力は 404。原因は呼び出し側の指定だと読み取れます。'}
    ],
    marks: {timeline: '実行ログ（Timeline）', failRow: '3段目で失敗', input: '入力の path', output: '出力の 404'},
    chapters: ['Quartz', '部品', 'ログ', '確かめる', '作例'],
    endField: 'UI・UX / Studio Yebisu',
    endTitle: ['作例を触って', '確かめる'],
    endSub: '3件のサンプルを切り替え、段を選ぶと入力と出力が出ます。ダーク表示とキーボード操作にも対応しています。'
  };

  /* ---------- Pure time helpers ---------- */

  const clamp01 = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const fade = (t, start, duration) => ease((t - start) / duration);
  const window01 = (t, from, to, inDur = 0.4, outDur = 0.35) => fade(t, from, inDur) * (1 - fade(t, to - outDur, outDur));
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});

  // Holds each key's value and eases to the next one over dur; depends only on t.
  function keyed(t, keys, dur, mix) {
    let value = keys[0].v;
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i].at) break;
      value = mix(keys[i - 1].v, keys[i].v, easeInOut((t - keys[i].at) / dur));
    }
    return value;
  }
  function beatAt(t) {
    let i = 0;
    while (i < BEATS.length - 2 && t >= BEATS[i + 1]) i++;
    return i;
  }

  /* ---------- Drawing helpers ---------- */

  const NO_LINE_START = '、。，．,.）)」』】！？!?・ー…ぁぃぅぇぉっゃゅょ';

  function font(size, weight = 400, family = GOTHIC) {
    ctx.font = weight + ' ' + size.toFixed(1) + 'px ' + family;
  }
  function text(str, x, y, size, o = {}) {
    font(size, o.weight || 400, o.family || GOTHIC);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }
  // Japanese line breaking: between characters, Latin words kept whole, no punctuation at a line start.
  function wrapLines(str, maxWidth) {
    const tokens = String(str).match(/[A-Za-z0-9_.\-/:%]+|[\s\S]/gu) || [];
    const lines = [];
    let line = '';
    for (const token of tokens) {
      const next = line + token;
      if (line && ctx.measureText(next).width > maxWidth && !NO_LINE_START.includes(token)) {
        lines.push(line);
        line = token.trimStart();
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  function para(str, x, top, maxWidth, size, o = {}) {
    font(size, o.weight || 400, o.family || GOTHIC);
    const lines = wrapLines(str, maxWidth);
    const lh = size * (o.lineHeight || 1.6);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => ctx.fillText(line, x, top + lh * (i + 0.5)));
    return lines.length * lh;
  }
  function box(x, y, w, h, o = {}) {
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(x, y, w, h); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 1; ctx.strokeRect(x, y, w, h); }
  }
  function line(x1, y1, x2, y2, color, width, alpha) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /* ---------- The screen: one frame that holds the real screenshots ---------- */

  const FRAMES = [
    {x: 880, y: 92, w: 336, h: 540},
    {x: 560, y: 92, w: 656, h: 430},
    {x: 400, y: 92, w: 816, h: 540},
    {x: 400, y: 92, w: 816, h: 540},
    {x: 660, y: 112, w: 556, h: 380}
  ];
  const frameAt = t => keyed(t, FRAMES.map((v, i) => ({at: BEATS[i], v})), 0.8, lerpRect);

  // Camera in CSS px of the capture: left, top and visible width.
  const around = (r, pad) => ({x: r.x - pad, y: r.y - pad * 1.5, w: r.w + pad * 2});
  const CAM_WHOLE = {x: 0, y: 0, w: PAGE_W};
  const CAM_TIMELINE = around(FOCUS.timeline, 48);
  const CAM_DETAIL = {x: FOCUS.detail.x - 40, y: FOCUS.input.y - 80, w: FOCUS.detail.w + 80};
  const mixCam = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k)});
  const cameraAt = t => keyed(t, [
    {at: 0, v: CAM_WHOLE},
    {at: 10.5, v: CAM_TIMELINE},
    {at: 17.7, v: CAM_DETAIL},
    {at: 22, v: CAM_WHOLE}
  ], 1, mixCam);

  // Fit the camera inside the capture and return the mapping from CSS px to stage px.
  function view(shot, frame, cam) {
    const img = shot.img;
    const k = img.naturalWidth / PAGE_W;
    const pageH = img.naturalHeight / k;
    const w = Math.min(cam.w, PAGE_W);
    const h = w * frame.h / frame.w;
    const x = Math.max(0, Math.min(PAGE_W - w, cam.x));
    const y = Math.max(0, Math.min(Math.max(0, pageH - h), cam.y));
    return {k, pageH, x, y, w, h, s: frame.w / w};
  }

  function drawShot(shot, frame, cam, alpha) {
    if (alpha <= 0.001) return;
    if (!shot.img) {
      // The capture is missing: say so instead of drawing a stand-in UI.
      ctx.setLineDash([8, 8]);
      box(frame.x + 12, frame.y + 12, frame.w - 24, frame.h - 24, {stroke: C.soft, lw: 1.5, alpha});
      ctx.setLineDash([]);
      text(shot.src + ' がまだありません', frame.x + frame.w / 2, frame.y + frame.h / 2 - 14, 20, {align: 'center', weight: 700, color: C.soft, alpha});
      text(shot.note + 'の画面を撮影して置きます', frame.x + frame.w / 2, frame.y + frame.h / 2 + 18, 18, {align: 'center', color: C.soft, alpha});
      return;
    }
    const v = view(shot, frame, cam);
    const srcH = Math.min(v.h, v.pageH - v.y);
    ctx.globalAlpha = alpha;
    ctx.drawImage(shot.img, v.x * v.k, v.y * v.k, v.w * v.k, srcH * v.k, frame.x, frame.y, frame.w, srcH * v.s);
  }

  // A box around a region of the capture, with a short tag above it.
  function mark(shot, frame, cam, region, label, color, alpha) {
    if (alpha <= 0.001 || !shot.img) return;
    const v = view(shot, frame, cam);
    if (region.y + region.h > v.pageH) return;
    const x = frame.x + (region.x - v.x) * v.s, y = frame.y + (region.y - v.y) * v.s;
    const w = region.w * v.s, h = region.h * v.s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.w, frame.h);
    ctx.clip();
    // The box settles inward as it appears.
    const pad = 4 + 6 * (1 - alpha);
    box(x - pad, y - pad, w + pad * 2, h + pad * 2, {stroke: color, lw: 3, alpha});
    font(18, 700);
    const tw = ctx.measureText(label).width + 20;
    const ty = Math.max(frame.y + 4, y - pad - 34);
    box(x - pad, ty, tw, 30, {fill: color, alpha});
    text(label, x - pad + 10, ty + 15, 18, {weight: 700, color: color === C.ink ? C.paper : C.ink, alpha});
    ctx.restore();
  }

  /* ---------- Scene parts ---------- */

  function drawHeader(t) {
    const a = fade(t, 4.2, 0.5);
    text(COPY.head, 64, 40, 20, {weight: 700, alpha: a});
    text(COPY.field, STAGE.w - 64, 40, 20, {weight: 700, align: 'right', color: C.soft, alpha: a});
    line(64, 64, STAGE.w - 64, 64, C.ink, 1, a);
  }

  function drawTitle(t) {
    const a = 1 - fade(t, 4.1, 0.45);
    if (a <= 0.001) return;
    const rise = k => (1 - k) * 16;
    const k1 = fade(t, 0.2, 0.6), k2 = fade(t, 0.9, 0.6), k3 = fade(t, 1.7, 0.6);
    text(COPY.name, 64, 250 + rise(k1), 128, {weight: 700, alpha: a * k1});
    box(68, 336 + rise(k1), 120 * ease((t - 0.6) / 0.6), 8, {fill: C.orange, alpha: a});
    text(COPY.tagline, 64, 410 + rise(k2), 54, {family: MINCHO, weight: 700, alpha: a * k2});
    para(COPY.lead, 64, 470 + rise(k3), 720, 24, {color: C.soft, alpha: a * k3});
    text(COPY.origin, 64, 560 + rise(k3), 20, {color: C.soft, alpha: a * k3});
  }

  // The colour field on the title, which becomes the frame for the screenshots.
  function drawFrame(t, frame) {
    const shotA = fade(t, 4.6, 0.6);
    box(frame.x, frame.y, frame.w, frame.h, {fill: C.sheet});
    const cam = cameraAt(t);
    const toFail = fade(t, 13.4, 0.5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.w, frame.h);
    ctx.clip();
    drawShot(SHOTS.light, frame, cam, shotA * (1 - toFail));
    drawShot(SHOTS.fail, frame, cam, shotA * toFail);
    ctx.restore();

    const inkA = 1 - shotA;
    if (inkA > 0.001) {
      box(frame.x, frame.y, frame.w, frame.h, {fill: C.ink, alpha: inkA});
      COPY.fieldWords.forEach((word, i) => {
        const k = fade(t, 1.2 + i * 0.35, 0.5);
        text(word, frame.x + 36, frame.y + 120 + i * 82 + (1 - k) * 12, 34, {weight: 700, color: C.paper, alpha: inkA * k});
      });
    }

    mark(SHOTS.light, frame, cam, FOCUS.timeline, COPY.marks.timeline, C.ink, window01(t, 11.4, 13.3) * (1 - toFail));
    mark(SHOTS.fail, frame, cam, FOCUS.failRow, COPY.marks.failRow, C.orange, window01(t, 14.4, 17.5));
    mark(SHOTS.fail, frame, cam, FOCUS.input, COPY.marks.input, C.ink, window01(t, 18.7, 21.8));
    mark(SHOTS.fail, frame, cam, FOCUS.output, COPY.marks.output, C.orange, window01(t, 19.6, 21.8));

    box(frame.x, frame.y, frame.w, frame.h, {stroke: C.ink, lw: 1.5, alpha: 1});
  }

  function drawCaptions(t) {
    for (const c of COPY.captions) {
      const a = window01(t, c.from + 0.15, c.to, 0.45, 0.3);
      if (a <= 0.001) continue;
      // Wrap to the frame's resting place, so the text does not reflow while the frame moves.
      const width = FRAMES[beatAt(c.from)].x - 64 - 40;
      const dy = (1 - a) * 10;
      const numW = text(String(c.n), 64, 132 + dy, 72, {family: MINCHO, weight: 700, color: C.orange, alpha: a});
      text('/ 3', 64 + numW + 12, 146 + dy, 22, {color: C.soft, alpha: a});
      const titleH = para(c.title, 64, 186 + dy, width, 34, {weight: 700, lineHeight: 1.35, alpha: a});
      para(c.sub, 64, 186 + titleH + 18 + dy, width, 21, {color: C.soft, lineHeight: 1.7, alpha: a});
    }
  }

  // Step 1 extras: the components used and two rules from the SKILL.
  function drawParts(t) {
    const a = window01(t, 5.6, 9.2, 0.4, 0.3);
    if (a <= 0.001) return;
    const left = 64, maxX = 520;
    let x = left, y = 420;
    font(18, 700);
    COPY.parts.forEach((part, i) => {
      const k = a * fade(t, 5.6 + i * 0.12, 0.3);
      const w = ctx.measureText(part).width + 22;
      if (x + w > maxX) { x = left; y += 42; }
      box(x, y, w, 32, {stroke: C.ink, lw: 1.5, alpha: k});
      text(part, x + 11, y + 16, 18, {weight: 700, alpha: k});
      font(18, 700);
      x += w + 10;
    });
    const r = a * fade(t, 6.8, 0.4);
    COPY.rules.forEach((rule, i) => {
      const ry = y + 70 + i * 36;
      box(left, ry - 3, 6, 6, {fill: C.orange, alpha: r});
      text(rule, left + 18, ry, 20, {weight: 600, alpha: r});
    });
  }

  function drawEnd(t) {
    const a = fade(t, 22.5, 0.5);
    if (a <= 0.001) return;
    const dy = (1 - a) * 14;
    text(COPY.endField, 64, 150 + dy, 24, {weight: 700, alpha: a});
    box(64, 178 + dy, 140 * ease((t - 22.9) / 0.5), 6, {fill: C.orange, alpha: a});
    COPY.endTitle.forEach((str, i) => text(str, 64, 262 + i * 80 + dy, 64, {family: MINCHO, weight: 700, alpha: a}));
    para(COPY.endSub, 64, 400 + dy, 540, 22, {color: C.soft, lineHeight: 1.7, alpha: a * fade(t, 23.1, 0.5)});
  }

  function drawChapters(t) {
    const x0 = 64, w = STAGE.w - 128, y = 668;
    const current = beatAt(t);
    line(x0, y, x0 + w, y, C.ink, 1, 0.25);
    box(x0, y - 1.5, w * t / D, 3, {fill: C.orange});
    for (let i = 0; i < COPY.chapters.length; i++) {
      const bx = x0 + w * BEATS[i] / D;
      line(bx, y - 8, bx, y + 8, C.ink, 1, 0.6);
      text(COPY.chapters[i], bx + 8, y + 24, 18, {weight: i === current ? 700 : 400, color: i === current ? C.ink : C.soft});
    }
  }

  /* ---------- Frame ---------- */

  window.seek = seconds => {
    const config = window.motionConfig;
    const t = Math.max(0, Math.min(config.duration, Number(seconds) || 0));
    window.__lastSeek = t;
    const W = config.width, H = config.height;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    // Reset all context state so the frame never depends on the previous call.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    const s = Math.min(W / STAGE.w, H / STAGE.h);
    ctx.setTransform(s, 0, 0, s, (W - STAGE.w * s) / 2, (H - STAGE.h * s) / 2);

    const frame = frameAt(t);
    drawHeader(t);
    drawTitle(t);
    drawFrame(t, frame);
    drawCaptions(t);
    drawParts(t);
    drawEnd(t);
    drawChapters(t);
    ctx.globalAlpha = 1;
    return {time: t, beat: beatAt(t)};
  };

  window.seek(0);
})();
