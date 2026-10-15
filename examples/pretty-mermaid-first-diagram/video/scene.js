/* Pretty Mermaid の使い方 — original Studio Yebisu composition (MIT). Canvas only.
   Every diagram on screen is a file the upstream CLI wrote to ../assets/, and every line of Mermaid is quoted from ../samples.json.
   Nothing here draws a stand-in diagram: a missing file is shown as 未描画.
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
    posterTime: 12.9,
    audioEvents: []
  };

  const D = 28;
  // The composition is laid out on a 1280x720 stage and scaled to the render size.
  const STAGE = {w: 1280, h: 720};
  // Prose / Mermaid / the drawn figure / theme / formats / three types.
  const BEATS = [0, 3.4, 7.6, 16.6, 19.8, 23.6, 28];

  const C = {
    paper: '#f3f0e6', sheet: '#fbfaf5', ink: '#18212d', soft: '#556070', rule: 'rgba(24,33,45,0.2)',
    grid: 'rgba(31,78,140,0.07)', blue: '#1f4e8c', accent: '#b8430f', tint: 'rgba(184,67,15,0.12)', violet: '#6b3fa0',
    light: '#ffffff', dark: '#0d1117', tty: '#161b22', ttyInk: '#e6edf3'
  };
  const GOTHIC = '"Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
  const MINCHO = '"Yu Mincho", "Hiragino Mincho ProN", "BIZ UDPMincho", serif';
  const MONO = '"Cascadia Mono", Consolas, Menlo, "BIZ UDGothic", "MS Gothic", monospace';
  // Text diagrams need full-width characters to be exactly two columns.
  const MONO_CJK = '"BIZ UDGothic", "MS Gothic", "Osaka-Mono", "Noto Sans Mono CJK JP", monospace';
  const TOKEN = /(-->>|->>|-->|\|[^|]+\||:\s.*$|\[\*\]|stateDiagram-v2|\b(?:flowchart|LR|sequenceDiagram|participant|as)\b)/;

  const COPY = {
    head: 'Pretty Mermaid の使い方',
    field: '図解 / Studio Yebisu',
    title: ['手順の文章を、', '図の記述へ。'],
    lead: 'Pretty Mermaid は、Mermaid の記述を SVG・PNG・文字図に書き出すスキルです。まず、図にしたい手順を文章で書きます。',
    origin: 'imxv/Pretty-mermaid-skills　MIT License',
    proseHead: '申込の確認（架空の手順）',
    // One sentence per arrow, in the order of the arrow lines in review-flow.mmd.
    prose: ['申込を入力したら、内容を確認する', '確認したら、不備があるかを見る', '不備があれば、入力へ戻る', '問題がなければ、申込を保存する', '保存したら、完了を通知する'],
    scenes: [
      {from: 3.5, to: 7.6, label: '02', title: 'Mermaidの短い記述'},
      {from: 7.7, to: 16.6, label: '03', title: '原典CLIが描いた図'},
      {from: 16.7, to: 19.8, label: '04', title: 'テーマを切り替える'},
      {from: 19.9, to: 23.6, label: '05', title: '形式を選んで書き出す'},
      {from: 23.7, to: 28.1, label: '06', title: '3種類の図'}
    ],
    captions: [
      {from: 4.2, to: 7.6, text: '矢印1本を1行に書きます。分岐の条件は |不備あり| のように矢印へ添えます。'},
      {from: 8.1, to: 9.6, text: 'review-flow.mmd を原典CLIで書き出したSVGを、そのまま読み込んでいます。'},
      {from: 16.8, to: 19.8, text: '記述はそのまま。--theme だけを変えて書き出し直します。'},
      {from: 20.2, to: 23.6, text: '同じ記述から、使う場所に合わせて SVG・PNG・文字図を書き出します。'}
    ],
    formats: [
      {name: 'SVG', flag: '--theme github-light', use: 'README・文書・Web。拡大しても線がにじまない。'},
      {name: 'PNG', flag: '--format png --width 1200', use: 'チャットやプレビューなど、画像しか受け付けない場所。'},
      {name: '文字図', flag: '--format ascii --color-mode none', use: '端末・ログ・プレーンテキスト。'}
    ],
    types: [
      {id: 'flow', name: '流れ図', focus: ['不備はあるか', '不備あり', '申込を入力'], lines: [4]},
      {id: 'sequence', name: 'シーケンス図', focus: ['申込を保存', '保存結果'], lines: [7, 8]},
      {id: 'state', name: '状態遷移図', focus: ['失敗', '再試行', '待機'], lines: [6]}
    ],
    endTitle: '作例で、記述と出力を読み比べる',
    endSub: '3つの図の記述・ライトとダーク・SVG／PNG／文字図を切り替えて読めます。',
    chapters: ['文章', '記述', '描いた図', 'テーマ', '書き出し', '3種類']
  };

  // The labels each arrow of review-flow.mmd connects, used to aim the camera at the real output.
  const FLOW_FOCUS = [
    ['申込を入力', '内容を確認'],
    ['内容を確認', '不備はあるか'],
    ['不備はあるか', '不備あり', '申込を入力'],
    ['不備はあるか', '問題なし', '申込を保存'],
    ['申込を保存', '完了を通知']
  ];
  const MAP_T = COPY.prose.map((_, i) => 4.9 + i * 0.5);
  const MAP_HOLD = 0.5;
  const EDGE_T = [9.6, 10.9, 12.2, 13.5, 14.8];
  const EDGE_HOLD = 1.3;
  const WHOLE_AGAIN = 16.1;
  const WIPE = {at: 17.2, dur: 1.3};

  /* ---------- Loading: samples.json and the CLI's files ---------- */

  const data = {samples: null, assets: {}, ascii: null};

  const fetchText = path => fetch(path).then(r => (r.ok ? r.text() : null)).catch(() => null);
  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.decoding = 'sync';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Lay the SVG out off screen once to read where the renderer put each label. Used only to aim the camera.
  function measure(svgText) {
    const doc = new DOMParser().parseFromString(svgText.replace(/@import\s+url\((?:'[^']*'|"[^"]*"|[^)]*)\)\s*;/g, ''), 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') return null;
    for (const node of root.querySelectorAll('script, foreignObject')) node.remove();
    const svg = document.importNode(root, true);
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const w = vb && vb.width ? vb.width : parseFloat(svg.getAttribute('width'));
    const h = vb && vb.height ? vb.height : parseFloat(svg.getAttribute('height'));
    if (!(w > 0 && h > 0)) return null;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none';
    host.append(svg);
    document.body.append(host);
    const origin = svg.getBoundingClientRect();
    const labels = [...svg.querySelectorAll('text')].map(node => {
      const r = node.getBoundingClientRect();
      return {text: node.textContent.replace(/\s+/g, ' ').trim(), x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height};
    }).filter(label => label.text && label.w > 0);
    host.remove();
    return {w, h, labels};
  }

  async function loadSvg(path) {
    const [text, img] = await Promise.all([fetchText(path), loadImage(path)]);
    if (!img) return {path, ok: false};
    const geo = text ? measure(text) : null;
    const w = geo ? geo.w : img.naturalWidth, h = geo ? geo.h : img.naturalHeight;
    // Rasterize once at a high scale so the camera can zoom without blur.
    const scale = Math.min(4, 4096 / Math.max(w, h));
    const raster = document.createElement('canvas');
    raster.width = Math.round(w * scale);
    raster.height = Math.round(h * scale);
    raster.getContext('2d').drawImage(img, 0, 0, raster.width, raster.height);
    return {path, ok: true, w, h, raster, labels: geo ? geo.labels : []};
  }

  async function loadAll() {
    const json = await fetchText('../samples.json');
    if (!json) return;
    const samples = {};
    for (const sample of JSON.parse(json).samples) samples[sample.id] = sample;
    data.samples = samples;
    const at = path => '../' + path;
    const [flowLight, flowDark, seqLight, stateLight, png, ascii] = await Promise.all([
      loadSvg(at(samples.flow.svg_light)),
      loadSvg(at(samples.flow.svg_dark)),
      loadSvg(at(samples.sequence.svg_light)),
      loadSvg(at(samples.state.svg_light)),
      loadImage(at(samples.flow.png)),
      fetchText(at(samples.flow.ascii_file))
    ]);
    // The PNG is the same layout at another size, so it shares the light SVG's coordinates.
    const pngAsset = png
      ? {path: at(samples.flow.png), ok: true, raster: png, w: flowLight.ok ? flowLight.w : png.naturalWidth, h: flowLight.ok ? flowLight.h : png.naturalHeight, labels: flowLight.ok ? flowLight.labels : [], px: [png.naturalWidth, png.naturalHeight]}
      : {path: at(samples.flow.png), ok: false};
    data.assets = {flowLight, flowDark, seqLight, stateLight, flowPng: pngAsset};
    data.ascii = ascii === null ? null : ascii.replace(/\s+$/, '').split('\n');
  }

  window.motionReady = loadAll()
    .catch(() => {})
    .then(() => document.fonts.ready)
    .then(() => window.seek(window.__lastSeek || 0));

  /* ---------- Pure time helpers ---------- */

  const clamp01 = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const fade = (t, start, duration) => ease((t - start) / duration);
  const window01 = (t, from, to, inDur = 0.4, outDur = 0.35) => fade(t, from, inDur) * (1 - fade(t, to - outDur, outDur));
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});
  const lerpCam = (a, b, k) => ({cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), w: lerp(a.w, b.w, k)});

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
  // The arrow being explained: by the prose mapping (02) or by the camera walk (03).
  function activeEdge(t) {
    for (let i = MAP_T.length - 1; i >= 0; i--) if (t >= MAP_T[i] && t < MAP_T[i] + MAP_HOLD && t < 7.5) return i;
    for (let i = EDGE_T.length - 1; i >= 0; i--) if (t >= EDGE_T[i] && t < EDGE_T[i] + EDGE_HOLD && t < WHOLE_AGAIN) return i;
    return -1;
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
  function wrapLines(str, maxWidth) {
    const tokens = String(str).match(/[A-Za-z0-9_.\-/:%|]+|[\s\S]/gu) || [];
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
  // Corner marks, as on a proof, around a region.
  function brackets(x, y, w, h, color, alpha, arm = 12) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      ctx.moveTo(cx + dx * arm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * arm);
    }
    ctx.stroke();
  }
  function arrow(x1, y1, x2, y2, color, alpha, k = 1) {
    if (k <= 0.001) return;
    const x = lerp(x1, x2, k), y = lerp(y1, y2, k);
    line(x1, y1, x, y, color, 2, alpha);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x1, y1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (k < 0.98) return;
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 11 * Math.cos(a - 0.4), y2 - 11 * Math.sin(a - 0.4));
    ctx.lineTo(x2 - 11 * Math.cos(a + 0.4), y2 - 11 * Math.sin(a + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  // One line of Mermaid with arrows, labels and keywords set apart. Returns the width.
  function codeLine(str, x, y, size, alpha, first) {
    font(size, 500, MONO);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    let cx = x;
    for (const piece of str.split(TOKEN)) {
      if (!piece) continue;
      let color = C.ink;
      if (/^-/.test(piece)) color = C.accent;
      else if (/^\||^:\s/.test(piece)) color = C.violet;
      else if (piece === '[*]') color = C.blue;
      else if (TOKEN.test(piece) && (first || /^(participant|as)$/.test(piece))) color = C.blue;
      ctx.fillStyle = color;
      ctx.fillText(piece, cx, y);
      cx += ctx.measureText(piece).width;
    }
    return cx - x;
  }
  const sourceLines = sample => sample.input.replace(/\n$/, '').split('\n').map(s => s.trim());

  /* ---------- The real output: camera, placement, marks ---------- */

  function fitCam(asset, frame) {
    const aspect = frame.w / frame.h;
    return {cx: asset.w / 2, cy: asset.h / 2, w: Math.max(asset.w, asset.h * aspect) * 1.04};
  }
  function findLabels(asset, names) {
    const out = [];
    for (const name of names) {
      let hits = asset.labels.filter(l => l.text === name);
      if (!hits.length) hits = asset.labels.filter(l => l.text.includes(name));
      out.push(...hits);
    }
    return out;
  }
  function union(rects) {
    const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y));
    return {x, y, w: Math.max(...rects.map(r => r.x + r.w)) - x, h: Math.max(...rects.map(r => r.y + r.h)) - y};
  }
  // A camera that frames the labels an arrow connects. Falls back to the whole figure.
  function focusCam(asset, frame, names, minFrac = 0.3) {
    const whole = fitCam(asset, frame);
    const hits = findLabels(asset, names);
    if (!hits.length) return whole;
    const b = union(hits);
    const aspect = frame.w / frame.h;
    const pad = 36 + Math.max(b.w, b.h) * 0.15;
    const w = Math.min(whole.w, Math.max(b.w + pad * 2, (b.h + pad * 2) * aspect, asset.w * minFrac));
    const h = w / aspect;
    const cx = w >= asset.w ? asset.w / 2 : Math.max(w / 2, Math.min(asset.w - w / 2, b.x + b.w / 2));
    const cy = h >= asset.h ? asset.h / 2 : Math.max(h / 2, Math.min(asset.h - h / 2, b.y + b.h / 2));
    return {cx, cy, w};
  }
  function view(frame, cam) {
    const s = frame.w / cam.w;
    return {s, x0: frame.x + frame.w / 2 - cam.cx * s, y0: frame.y + frame.h / 2 - cam.cy * s};
  }
  const toStage = (v, r) => ({x: v.x0 + r.x * v.s, y: v.y0 + r.y * v.s, w: r.w * v.s, h: r.h * v.s});

  function unrendered(asset, frame, alpha, dark) {
    const color = dark ? '#9aa4b2' : C.soft;
    ctx.setLineDash([8, 8]);
    box(frame.x + 14, frame.y + 14, frame.w - 28, frame.h - 28, {stroke: color, lw: 1.5, alpha});
    ctx.setLineDash([]);
    const cx = frame.x + frame.w / 2, cy = frame.y + frame.h / 2;
    text(data.samples ? '未描画' : '読み込めません', cx, cy - 30, 22, {align: 'center', weight: 700, color, alpha});
    text(asset && asset.path ? asset.path.replace('../', '') : '../samples.json', cx, cy + 4, 14, {align: 'center', family: MONO, color, alpha});
    text('原典CLIで書き出すと、ここに表示されます', cx, cy + 34, 15, {align: 'center', color, alpha});
  }

  // Draws a CLI output inside frame. Returns the mapping, or null if the file is missing.
  function drawAsset(asset, frame, cam, alpha, bg) {
    if (alpha <= 0.001) return null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.w, frame.h);
    ctx.clip();
    box(frame.x, frame.y, frame.w, frame.h, {fill: bg, alpha});
    let v = null;
    if (asset && asset.ok) {
      v = view(frame, cam);
      ctx.globalAlpha = alpha;
      ctx.drawImage(asset.raster, v.x0, v.y0, asset.w * v.s, asset.h * v.s);
    } else {
      unrendered(asset, frame, alpha, bg === C.dark || bg === C.tty);
    }
    ctx.restore();
    return v;
  }

  function markLabels(asset, frame, v, names, alpha) {
    if (!v || alpha <= 0.001) return null;
    const hits = findLabels(asset, names).map(r => toStage(v, r));
    if (!hits.length) return null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.w, frame.h);
    ctx.clip();
    const pad = 6 + 6 * (1 - alpha);
    for (const r of hits) brackets(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, C.accent, alpha);
    ctx.restore();
    return union(hits);
  }

  /* ---------- Scene parts ---------- */

  function drawBackground() {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, STAGE.w, STAGE.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 16; x < STAGE.w; x += 24) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, STAGE.h); }
    for (let y = 12; y < STAGE.h; y += 24) { ctx.moveTo(0, y + 0.5); ctx.lineTo(STAGE.w, y + 0.5); }
    ctx.stroke();
  }

  function drawHeader() {
    text(COPY.head, 64, 40, 20, {weight: 700});
    text(COPY.field, STAGE.w - 64, 40, 18, {weight: 700, align: 'right', color: C.soft});
    line(64, 64, STAGE.w - 64, 64, C.ink, 2, 1);
  }

  function drawIntro(t) {
    const a = 1 - fade(t, 3.0, 0.4);
    if (a <= 0.001) return;
    const rise = k => (1 - k) * 16;
    const k1 = fade(t, 0.15, 0.6), k2 = fade(t, 0.7, 0.6), k3 = fade(t, 1.3, 0.6);
    text('01　文章の手順', 64, 124, 20, {weight: 700, color: C.accent, alpha: a * k1});
    COPY.title.forEach((s, i) => text(s, 64, 200 + i * 72 + rise(k1), 56, {family: MINCHO, weight: 700, alpha: a * (i ? k2 : k1)}));
    box(68, 316 + rise(k2), 120 * ease((t - 0.9) / 0.6), 6, {fill: C.accent, alpha: a});
    para(COPY.lead, 64, 352 + rise(k3), 500, 21, {color: C.soft, lineHeight: 1.75, alpha: a * k3});
    text(COPY.origin, 64, 548, 17, {family: MONO, color: C.soft, alpha: a * k3});
  }

  // Code lines share rows with the prose sentences, so each sentence sits beside its arrow.
  const ROW = n => 214 + (n - 1) * 60;
  const PROSE_RECTS = [{x: 640, y: 130, w: 576, h: 450}, {x: 64, y: 130, w: 470, h: 450}];
  const CODE_RECTS = [{x: 600, y: 130, w: 616, h: 450}, {x: 64, y: 130, w: 470, h: 450}];
  const FRAME = {x: 566, y: 130, w: 650, h: 420};

  function proseRect(t) { return keyed(t, [{at: 0, v: PROSE_RECTS[0]}, {at: 3.4, v: PROSE_RECTS[1]}], 0.7, lerpRect); }
  function codeRect(t) { return keyed(t, [{at: 0, v: CODE_RECTS[0]}, {at: 7.6, v: CODE_RECTS[1]}], 0.8, lerpRect); }

  function drawProse(t) {
    const a = fade(t, 0.3, 0.5) * (1 - fade(t, 7.5, 0.4));
    if (a <= 0.001) return;
    const r = proseRect(t);
    box(r.x, r.y, r.w, r.h, {fill: C.sheet, stroke: C.ink, lw: 1, alpha: a});
    text('文章', r.x + 20, r.y + 24, 15, {color: C.soft, alpha: a});
    line(r.x, r.y + 46, r.x + r.w, r.y + 46, C.rule, 1, a);
    text(COPY.proseHead, r.x + 28, ROW(1), 18, {weight: 700, color: C.soft, alpha: a});
    line(r.x + 28, ROW(1) + 26, r.x + r.w - 28, ROW(1) + 26, C.rule, 1, a);
    const edge = activeEdge(t);
    COPY.prose.forEach((s, i) => {
      const k = a * fade(t, 0.6 + i * 0.32, 0.4);
      const y = ROW(i + 2);
      if (i === edge) box(r.x + 1, y - 24, r.w - 2, 48, {fill: C.tint, alpha: k});
      text(String(i + 1), r.x + 34, y, 26, {family: MINCHO, weight: 700, color: C.accent, align: 'center', alpha: k});
      font(22, 600);
      const size = Math.min(22, 22 * (r.w - 96) / ctx.measureText(s).width);
      text(s, r.x + 62, y, size, {weight: 600, alpha: k});
    });
  }

  function drawCode(t) {
    const a = fade(t, 3.8, 0.5) * (1 - fade(t, 16.5, 0.4));
    if (a <= 0.001) return;
    const r = codeRect(t);
    const slide = (1 - fade(t, 3.8, 0.6)) * 40;
    const x = r.x + slide;
    box(x, r.y, r.w, r.h, {fill: '#ffffff', stroke: C.ink, lw: 1, alpha: a});
    const name = data.samples ? 'inputs/' + data.samples.flow.stem + '.mmd' : '';
    text(name, x + 20, r.y + 24, 15, {family: MONO, color: C.soft, alpha: a});
    line(x, r.y + 46, x + r.w, r.y + 46, C.rule, 1, a);
    if (!data.samples) {
      text('samples.json を読み込めません', x + 20, ROW(2), 18, {color: C.soft, alpha: a});
      return;
    }
    const lines = sourceLines(data.samples.flow);
    const gutter = 52;
    font(20, 500, MONO);
    const widest = Math.max(...lines.map((s, i) => ctx.measureText(s).width + (i ? 20 : 0)));
    const size = Math.max(13, Math.min(22, 20 * (r.w - gutter - 36) / widest));
    line(x + gutter, r.y + 47, x + gutter, r.y + r.h, C.rule, 1, a);
    const edge = activeEdge(t);
    lines.forEach((s, i) => {
      const n = i + 1, y = ROW(n);
      const k = a * fade(t, 4.0 + i * 0.12, 0.3);
      if (edge >= 0 && n === edge + 2) {
        box(x + 1, y - 24, r.w - 2, 48, {fill: C.tint, alpha: k});
        box(x + 1, y - 24, 4, 48, {fill: C.accent, alpha: k});
      }
      text(String(n), x + gutter - 14, y, 15, {family: MONO, color: '#96a0ad', align: 'right', alpha: k});
      codeLine(s, x + gutter + 16 + (i ? 20 : 0), y, size, k, i === 0);
    });
  }

  // 02: a connector from each sentence to the line that writes it.
  function drawMapping(t) {
    const a = 1 - fade(t, 7.4, 0.3);
    if (a <= 0.001 || !data.samples) return;
    const p = proseRect(t), c = codeRect(t);
    const edge = activeEdge(t);
    MAP_T.forEach((at, i) => {
      if (t < at) return;
      const y = ROW(i + 2);
      const k = ease((t - at) / 0.3);
      arrow(p.x + p.w + 6, y, c.x - 6, y, C.accent, a * (i === edge ? 1 : 0.4), k);
    });
  }

  function cameraAt(t, asset) {
    const keys = [{at: 0, v: fitCam(asset, FRAME)}];
    EDGE_T.forEach((at, i) => keys.push({at, v: focusCam(asset, FRAME, FLOW_FOCUS[i])}));
    keys.push({at: WHOLE_AGAIN, v: fitCam(asset, FRAME)});
    return keyed(t, keys, 0.6, lerpCam);
  }

  // 03 and 04: the real flowchart, walked arrow by arrow, then the theme wipe.
  function drawFigure(t) {
    const a = fade(t, 8.0, 0.6) * (1 - fade(t, 19.7, 0.4));
    if (a <= 0.001) return;
    const {flowLight, flowDark} = data.assets;
    const light = flowLight && flowLight.ok ? flowLight : null;
    const cam = light ? cameraAt(t, light) : null;
    const p = easeInOut((t - WIPE.at) / WIPE.dur);
    const split = FRAME.x + FRAME.w * p;

    let v = null;
    if (p < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(split, FRAME.y, FRAME.x + FRAME.w - split, FRAME.h);
      ctx.clip();
      v = drawAsset(flowLight, FRAME, cam || {cx: 0, cy: 0, w: 1}, a, C.light);
      ctx.restore();
    }
    if (p > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(FRAME.x, FRAME.y, split - FRAME.x, FRAME.h);
      ctx.clip();
      const dark = flowDark && flowDark.ok ? flowDark : null;
      drawAsset(flowDark, FRAME, dark ? cameraAt(t, dark) : {cx: 0, cy: 0, w: 1}, a, C.dark);
      ctx.restore();
    }
    box(FRAME.x, FRAME.y, FRAME.w, FRAME.h, {stroke: C.ink, lw: 1.5, alpha: a});

    // The wipe line names both themes while it crosses.
    if (p > 0 && p < 1) {
      line(split, FRAME.y - 8, split, FRAME.y + FRAME.h + 8, C.accent, 3, a);
      font(15, 700, MONO);
      const lw = ctx.measureText('github-dark').width + 16;
      box(split - lw - 6, FRAME.y + 12, lw, 26, {fill: C.accent, alpha: a});
      text('github-dark', split - lw + 2, FRAME.y + 25, 15, {family: MONO, weight: 700, color: '#fff', alpha: a});
      box(split + 6, FRAME.y + 12, ctx.measureText('github-light').width + 16, 26, {fill: C.ink, alpha: a});
      text('github-light', split + 14, FRAME.y + 25, 15, {family: MONO, weight: 700, color: '#fff', alpha: a});
    }

    const darkSide = p >= 0.5;
    const sample = data.samples && data.samples.flow;
    if (sample) {
      const path = darkSide ? sample.svg_dark : sample.svg_light;
      text(path + '　--theme ' + (darkSide ? 'github-dark' : 'github-light'), FRAME.x, FRAME.y + FRAME.h + 22, 15, {family: MONO, color: C.soft, alpha: a});
    }

    // The arrow being explained: marks on the labels it connects, and a leader from its source line.
    const edge = activeEdge(t);
    if (edge < 0 || t < EDGE_T[0] || !light) return;
    const at = EDGE_T[edge];
    const k = window01(t, at + 0.5, at + EDGE_HOLD, 0.25, 0.2);
    const target = markLabels(light, FRAME, v, FLOW_FOCUS[edge], k);
    if (target) {
      const c = codeRect(t);
      const y = ROW(edge + 2);
      arrow(c.x + c.w + 4, y, target.x - 10, target.y + target.h / 2, C.accent, k * 0.9, ease((t - at - 0.5) / 0.3));
    }
  }

  function drawEdgeCaption(t) {
    const edge = activeEdge(t);
    if (edge < 0 || t < EDGE_T[0] || !data.samples) return;
    const at = EDGE_T[edge];
    const k = window01(t, at + 0.1, at + EDGE_HOLD, 0.3, 0.2);
    const n = edge + 2;
    const w = text(n + '行目', 64, 616, 20, {weight: 700, color: C.accent, alpha: k});
    text(data.samples.flow.relationships[edge], 64 + w + 18, 616, 22, {weight: 700, alpha: k});
  }

  // 04: the command beside the wipe. Only the theme value changes.
  function drawCommand(t) {
    const a = window01(t, 16.8, 19.8, 0.4, 0.35);
    if (a <= 0.001 || !data.samples) return;
    const r = CODE_RECTS[1];
    box(r.x, r.y, r.w, r.h, {fill: '#ffffff', stroke: C.ink, lw: 1, alpha: a});
    text('同じ ' + 'inputs/' + data.samples.flow.stem + '.mmd を描き直す', r.x + 20, r.y + 24, 15, {color: C.soft, alpha: a});
    line(r.x, r.y + 46, r.x + r.w, r.y + 46, C.rule, 1, a);
    const p = easeInOut((t - WIPE.at) / WIPE.dur);
    const rows = [
      ['node scripts/render.mjs', 0],
      ['--input review-flow.mmd', 1],
      ['--theme', 2],
      ["--font 'Yu Gothic'", 1]
    ];
    rows.forEach(([s, kind], i) => {
      const y = ROW(2) + i * 64;
      const x = r.x + 28 + (i ? 24 : 0);
      if (kind === 2) {
        box(r.x + 1, y - 26, r.w - 2, 52, {fill: C.tint, alpha: a});
        box(r.x + 1, y - 26, 4, 52, {fill: C.accent, alpha: a});
        const w = text(s + ' ', x, y, 22, {family: MONO, weight: 500, alpha: a});
        text('github-light', x + w, y - 10 * p, 22, {family: MONO, weight: 700, color: C.accent, alpha: a * (1 - p)});
        text('github-dark', x + w, y + 10 * (1 - p), 22, {family: MONO, weight: 700, color: C.accent, alpha: a * p});
      } else {
        text(s, x, y, 20, {family: MONO, weight: 500, color: kind ? C.ink : C.soft, alpha: a});
      }
    });
  }

  const PANELS = [{x: 64, y: 130, w: 368, h: 300}, {x: 456, y: 130, w: 368, h: 300}, {x: 848, y: 130, w: 368, h: 300}];

  function drawAscii(panel, alpha, t) {
    box(panel.x, panel.y, panel.w, panel.h, {fill: C.tty, alpha});
    if (!data.ascii) { unrendered({path: '../' + (data.samples ? data.samples.flow.ascii_file : '')}, panel, alpha, true); return; }
    ctx.save();
    ctx.beginPath();
    ctx.rect(panel.x, panel.y, panel.w, panel.h);
    ctx.clip();
    font(16, 400, MONO_CJK);
    const widest = Math.max(...data.ascii.map(s => ctx.measureText(s).width), 1);
    const size = Math.max(12, Math.min(18, 16 * (panel.w - 32) / widest));
    font(size, 400, MONO_CJK);
    const textW = Math.max(...data.ascii.map(s => ctx.measureText(s).width));
    const lh = size * 1.3;
    const textH = data.ascii.length * lh;
    // Wider or taller than the panel: pan across it slowly instead of shrinking the text.
    const pan = ease((t - 20.6) / 2.6);
    const ox = Math.min(0, panel.w - 32 - textW) * pan;
    const oy = Math.min(0, panel.h - 32 - textH) * pan;
    const top = panel.y + 16 + Math.max(0, (panel.h - 32 - textH) / 2) + oy;
    data.ascii.forEach((s, i) => text(s, panel.x + 16 + ox, top + lh * (i + 0.5), size, {family: MONO_CJK, color: C.ttyInk, alpha}));
    ctx.restore();
  }

  // 05: one region of the same figure as SVG and as PNG, and the text diagram.
  function drawFormats(t) {
    const out = 1 - fade(t, 23.4, 0.35);
    if (t < 19.7 || out <= 0.001) return;
    const {flowLight, flowPng} = data.assets;
    const focus = ['不備はあるか', '不備あり', '問題なし'];
    PANELS.forEach((panel, i) => {
      const a = fade(t, 19.9 + i * 0.3, 0.4) * out;
      if (a <= 0.001) return;
      const dy = (1 - a) * 12;
      const r = {x: panel.x, y: panel.y + dy, w: panel.w, h: panel.h};
      if (i < 2) {
        const asset = i === 0 ? flowLight : flowPng;
        let cam = {cx: 0, cy: 0, w: 1};
        if (asset && asset.ok) {
          const base = focusCam(asset, r, focus, 0.22);
          // A slow push in, the same on both, so SVG and PNG can be compared at one scale.
          cam = {cx: base.cx, cy: base.cy, w: base.w * lerp(1, 0.78, ease((t - 20.2) / 3.2))};
        }
        drawAsset(asset, r, cam, a, C.light);
        if (i === 1 && asset && asset.ok) {
          const tag = asset.px[0] + '×' + asset.px[1] + 'px';
          font(13, 700, MONO);
          const tw = ctx.measureText(tag).width + 14;
          box(r.x + r.w - tw - 10, r.y + 10, tw, 24, {fill: C.ink, alpha: a});
          text(tag, r.x + r.w - tw - 3, r.y + 22, 13, {family: MONO, weight: 700, color: '#fff', alpha: a});
        }
      } else {
        drawAscii(r, a, t);
      }
      box(r.x, r.y, r.w, r.h, {stroke: C.ink, lw: 1.5, alpha: a});
      const f = COPY.formats[i];
      text(f.name, r.x, 462 + dy, 26, {weight: 700, alpha: a});
      text(f.flag, r.x, 496 + dy, 15, {family: MONO, color: C.accent, alpha: a});
      para(f.use, r.x, 512 + dy, r.w, 17, {color: C.soft, lineHeight: 1.6, alpha: a});
    });
  }

  // 06: the three diagram types, each framed on one relationship and the line that writes it.
  function drawTypes(t) {
    if (t < 23.5) return;
    const assets = {flow: data.assets.flowLight, sequence: data.assets.seqLight, state: data.assets.stateLight};
    COPY.types.forEach((type, i) => {
      const a = fade(t, 23.7 + i * 0.35, 0.45);
      if (a <= 0.001) return;
      const dy = (1 - a) * 12;
      const panel = PANELS[i];
      const r = {x: panel.x, y: panel.y + dy, w: panel.w, h: panel.h - 40};
      const asset = assets[type.id];
      const cam = asset && asset.ok ? focusCam(asset, r, type.focus, 0.35) : {cx: 0, cy: 0, w: 1};
      const v = drawAsset(asset, r, cam, a, C.light);
      if (asset && asset.ok) markLabels(asset, r, v, type.focus.slice(-2), a * fade(t, 24.5 + i * 0.35, 0.4));
      box(r.x, r.y, r.w, r.h, {stroke: C.ink, lw: 1.5, alpha: a});
      const sample = data.samples && data.samples[type.id];
      if (!sample) return;
      const lines = sourceLines(sample);
      text(lines[0], r.x, 418 + dy, 16, {family: MONO, weight: 700, color: C.blue, alpha: a});
      text(type.name, r.x, 450 + dy, 24, {weight: 700, alpha: a});
      type.lines.forEach((n, j) => {
        font(16, 500, MONO);
        const s = lines[n - 1];
        const size = Math.min(16, 16 * (r.w - 40) / ctx.measureText(s).width);
        text(String(n), r.x + 14, 490 + j * 28 + dy, 13, {family: MONO, color: '#96a0ad', align: 'right', alpha: a});
        codeLine(s, r.x + 26, 490 + j * 28 + dy, size, a, false);
      });
    });
    const e = fade(t, 26.0, 0.5);
    if (e <= 0.001) return;
    const dy = (1 - e) * 10;
    box(64, 574 + dy, 140 * ease((t - 26.2) / 0.5), 4, {fill: C.accent, alpha: e});
    text(COPY.endTitle, 64, 606 + dy, 30, {family: MINCHO, weight: 700, alpha: e});
    text(COPY.endSub, 64, 640 + dy, 16, {color: C.soft, alpha: e * fade(t, 26.4, 0.5)});
  }

  function drawSceneLabels(t) {
    for (const s of COPY.scenes) {
      const a = window01(t, s.from, s.to, 0.4, 0.3);
      if (a <= 0.001) continue;
      const w = text(s.label, 64, 100, 18, {family: MONO, weight: 700, color: C.accent, alpha: a});
      text(s.title, 64 + w + 14, 100, 22, {family: MINCHO, weight: 700, alpha: a});
    }
  }

  function drawCaptions(t) {
    for (const c of COPY.captions) {
      const a = window01(t, c.from, c.to, 0.4, 0.3);
      if (a <= 0.001) continue;
      text(c.text, 64, 616 + (1 - a) * 6, 20, {weight: 600, alpha: a});
    }
  }

  function drawChapters(t) {
    const x0 = 64, w = STAGE.w - 128, y = 672;
    const current = beatAt(t);
    line(x0, y, x0 + w, y, C.ink, 1, 0.25);
    box(x0, y - 1.5, w * t / D, 3, {fill: C.accent});
    for (let i = 0; i < COPY.chapters.length; i++) {
      const bx = x0 + w * BEATS[i] / D;
      line(bx, y - 8, bx, y + 8, C.ink, 1, 0.6);
      text(COPY.chapters[i], bx + 8, y + 22, 16, {weight: i === current ? 700 : 400, color: i === current ? C.ink : C.soft});
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

    drawBackground();
    drawHeader();
    drawIntro(t);
    drawProse(t);
    drawCode(t);
    drawMapping(t);
    drawFigure(t);
    drawCommand(t);
    drawFormats(t);
    drawTypes(t);
    drawSceneLabels(t);
    drawCaptions(t);
    drawEdgeCaption(t);
    drawChapters(t);
    ctx.globalAlpha = 1;
    return {time: t, beat: beatAt(t)};
  };

  // motionReady draws again once samples.json and the CLI's files are loaded.
  window.seek(0);
})();
