/* Diagram Design の作例 — 解説動画（Studio Yebisu, MIT）。Canvas only.
   The figure on screen is always the exported ../diagrams/intake.png, cropped and scaled; nothing redraws it.
   Crops, highlight brackets, route codes and counts come from ../diagram-data.json.
   A missing or mismatched asset rejects motionReady and draws a plain error frame instead of a stand-in.
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
    posterTime: 11,
    audioEvents: []
  };

  const D = 28;
  const STAGE = {w: 1280, h: 720};
  const VIEW = {w: 1280, h: 720};            // the diagram's viewBox
  const PNG_PATH = '../diagrams/intake.png';
  const DATA_PATH = '../diagram-data.json';

  const C = {
    paper: '#f2eee3', sheet: '#fbf9f2', ink: '#17150f', soft: '#4f4a3f',
    rule: 'rgba(23,21,15,0.22)', faint: 'rgba(23,21,15,0.12)', accent: '#b83a00'
  };
  const GOTHIC = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", sans-serif';
  const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", "Noto Serif JP", serif';
  const MONO = '"Geist Mono", ui-monospace, Consolas, Menlo, monospace';   // Latin IDs and paths only

  /* ---------- Timeline (seconds). Scene beats: request 0–5 / overview 5–12 / branches 12–23 / save 23–28 ----------
     Branches: missing 12–16, unresolved 16–20, completion 20–23 (same crop as unresolved, no camera move).
     Every camera move is followed by stopped time; marks start only after the camera has settled. */

  const BEATS = [0, 5, 12, 23, 28];
  const T = {
    introOut: 4.6, figIn: 4.9,
    toMissing: 12.0, toUnresolved: 16.0, toFinal: 23.0,
    move: 0.9, finalMove: 1.0
  };

  // Frames on the stage. F is 2:1 so a crop never needs a second aspect; F2 holds the whole 16:9 figure.
  const F = {x: 40, y: 16, w: 1200, h: 600};
  const F2 = {x: 64, y: 120, w: 672, h: 378};

  // Cameras in diagram units: centre and visible width. Visible height = w * frame.h / frame.w.
  const CAM = {
    full: {cx: 640, cy: 360, w: 1440},       // whole figure, fit to F's height
    push: {cx: 640, cy: 360, w: 1380},       // slow push during the overview
    missing: {cx: 340, cy: 276, w: 640},     // x 20..660, y 116..436 — R2, C2 and both lane names
    // x 472..1352, y 138..578 — C3, E10, R3, S1, R4, E09, R5. The pinned lane strip covers x 472..596,
    // so R3 (x 624) and its bracket stay clear of the strip's rule; only R2 / E05, not used here, sit under it.
    unresolved: {cx: 912, cy: 358, w: 880},
    final: {cx: 640, cy: 360, w: 1280}       // whole figure, exact fit in F2
  };
  // The figure's own lane-name column (x 38..162). When a crop leaves it behind, the same pixels stay pinned at the left.
  const LANE_COLUMN = {x: 38, w: 124};

  const COPY = {
    kicker: 'Diagram Design の作例',
    title: ['問い合わせ対応を、', '1枚の図に。'],
    quoteHead: '依頼の文（request.txt）',
    tagWhole: '実際の図',
    tagCrop: '実際の図を拡大',
    filesHead: '保存するファイル',
    files: [
      {path: 'diagrams/intake.html', note: '正本。単独で開けるHTML'},
      {path: 'diagrams/intake.svg', note: '工程名や線を直せるSVG'},
      {path: 'diagrams/intake.png', note: '資料に貼れる画像'},
      {path: 'diagram-data.json', note: '工程と矢印の記録'}
    ]
  };

  /* ---------- Assets ---------- */

  const state = {img: null, data: null, s: 1, error: null, derived: null};

  function loadImage(src) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    return img.decode().then(() => img, () => { throw new Error(src.replace('../', '') + ' を読み込めません'); });
  }
  function loadJSON(src) {
    return fetch(src).then(r => {
      if (!r.ok) throw new Error(src.replace('../', '') + ' を読み込めません');
      return r.json();
    });
  }

  // Everything the captions say is derived here from diagram-data.json; a mismatch fails the render.
  function derive(data) {
    const need = (cond, what) => { if (!cond) throw new Error('diagram-data.json: ' + what); };
    need(Array.isArray(data.nodes) && Array.isArray(data.edges) && Array.isArray(data.lanes) && Array.isArray(data.routes), '工程・矢印・段・経路がありません');
    const nodes = Object.fromEntries(data.nodes.map(n => [n.id, n]));
    const edges = Object.fromEntries(data.edges.map(e => [e.id, e]));
    const lanes = Object.fromEntries(data.lanes.map(l => [l.id, l]));
    const routes = Object.fromEntries(data.routes.map(r => [r.id, r]));
    for (const id of ['C1', 'C2', 'C3', 'R1', 'R2', 'R3', 'R4', 'R5', 'S1']) need(nodes[id] && nodes[id].bbox, id + ' の位置がありません');
    for (const id of ['E03', 'E04', 'E05', 'E09', 'E10']) need(edges[id] && edges[id].label_mask, id + ' のラベルの位置がありません');
    for (const id of ['customer', 'intake', 'specialist']) need(lanes[id] && Array.isArray(lanes[id].y), id + ' の段がありません');
    for (const id of ['route-missing', 'route-unresolved', 'route-complete']) need(routes[id], id + ' がありません');
    const laneOf = id => nodes[id].lane;
    const cross = data.edges.filter(e => laneOf(e.from) !== laneOf(e.to));
    need(cross.length === data.edges.filter(e => e.cross_lane).length, 'cross_lane が段の配置と合いません');
    const allTouchIntake = cross.every(e => laneOf(e.from) === 'intake' || laneOf(e.to) === 'intake');
    need(allTouchIntake, '受付につながらない受け渡しがあります');
    const intoDone = data.edges.filter(e => nodes[e.to].kind === 'complete');
    need(intoDone.length === 1 && intoDone[0].id === 'E09', '完了へ入る矢印が E09 だけではありません');
    return {nodes, edges, lanes, routes, crossCount: cross.length};
  }

  let lastSeek = 0;
  const ready = (async () => {
    const [img, data] = await Promise.all([loadImage(PNG_PATH), loadJSON(DATA_PATH)]);
    const aspect = img.naturalWidth / img.naturalHeight;
    if (img.naturalWidth < VIEW.w || Math.abs(aspect - VIEW.w / VIEW.h) > 0.01) {
      throw new Error('diagrams/intake.png の大きさが viewBox 1280×720 と合いません（' + img.naturalWidth + '×' + img.naturalHeight + '）');
    }
    state.derived = derive(data);
    state.data = data;
    state.img = img;
    state.s = img.naturalWidth / VIEW.w;
    await document.fonts.ready;
    window.seek(lastSeek);
  })();
  ready.catch(err => { state.error = err && err.message ? err.message : String(err); window.seek(lastSeek); });
  window.motionReady = ready;

  /* ---------- Pure time helpers ---------- */

  const clamp01 = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const fade = (t, start, dur) => ease((t - start) / dur);
  const span = (t, from, to, inDur = 0.4, outDur = 0.35) => fade(t, from, inDur) * (1 - fade(t, to - outDur, outDur));
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpCam = (a, b, k) => ({cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), w: lerp(a.w, b.w, k)});
  const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});

  function camAt(t) {
    if (t < T.toMissing) return lerpCam(CAM.full, CAM.push, ease((t - T.figIn) / (T.toMissing - T.figIn)));
    let cam = lerpCam(CAM.push, CAM.missing, easeInOut((t - T.toMissing) / T.move));
    if (t >= T.toUnresolved) cam = lerpCam(CAM.missing, CAM.unresolved, easeInOut((t - T.toUnresolved) / T.move));
    if (t >= T.toFinal) cam = lerpCam(CAM.unresolved, CAM.final, easeInOut((t - T.toFinal) / T.finalMove));
    return cam;
  }
  function frameAt(t) {
    return t < T.toFinal ? F : lerpRect(F, F2, easeInOut((t - T.toFinal) / T.finalMove));
  }
  function beatAt(t) {
    let i = 0;
    while (i < BEATS.length - 2 && t >= BEATS[i + 1]) i++;
    return i;
  }

  /* ---------- Drawing helpers ---------- */

  const NO_LINE_START = '、。，．）」』】！？・ー…ぁぃぅぇぉっゃゅょ';

  function font(size, weight, family) { ctx.font = (weight || 400) + ' ' + size + 'px ' + (family || GOTHIC); }
  function text(str, x, y, size, o = {}) {
    font(size, o.weight, o.family);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }
  function wrap(str, maxWidth) {
    const lines = [];
    let line = '';
    for (const ch of Array.from(str)) {
      if (line && ctx.measureText(line + ch).width > maxWidth && !NO_LINE_START.includes(ch)) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }
  function para(str, x, top, maxWidth, size, o = {}) {
    font(size, o.weight, o.family);
    const lines = wrap(str, maxWidth);
    const lh = size * (o.lineHeight || 1.6);
    lines.forEach((l, i) => text(l, x, top + lh * (i + 0.5), size, o));
    return lines.length * lh;
  }
  function rect(x, y, w, h, o = {}) {
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(x, y, w, h); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 1; ctx.strokeRect(x, y, w, h); }
  }
  function hline(x1, x2, y, color, width, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x1, y - width / 2, x2 - x1, width);
  }
  // Proof-style corner marks: an editorial annotation drawn over the figure, never part of it.
  function brackets(r, alpha, pad = 7, arm = 14) {
    if (alpha <= 0.001) return;
    const x = r.x - pad, y = r.y - pad, w = r.w + pad * 2, h = r.h + pad * 2;
    const a = Math.min(arm, w / 3, h / 2);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      ctx.moveTo(cx + dx * a, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * a);
    }
    ctx.stroke();
  }

  /* ---------- The real figure, through a camera ---------- */

  function view(frame, cam) {
    const k = frame.w / cam.w;
    const visH = frame.h / k;
    return {frame, k, left: cam.cx - cam.w / 2, top: cam.cy - visH / 2, visW: cam.w, visH};
  }
  const toStage = (v, r) => ({x: v.frame.x + (r.x - v.left) * v.k, y: v.frame.y + (r.y - v.top) * v.k, w: r.w * v.k, h: r.h * v.k});

  function blit(v, sx, sy, sw, sh, dx, dy) {
    if (sw <= 0 || sh <= 0) return;
    const s = state.s;
    ctx.drawImage(state.img, sx * s, sy * s, sw * s, sh * s, dx, dy, sw * v.k, sh * v.k);
  }

  function drawFigure(v, alpha) {
    const {frame} = v;
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.w, frame.h);
    ctx.clip();
    rect(frame.x, frame.y, frame.w, frame.h, {fill: C.paper, alpha});
    ctx.globalAlpha = alpha;
    const x0 = Math.max(0, v.left), y0 = Math.max(0, v.top);
    const x1 = Math.min(VIEW.w, v.left + v.visW), y1 = Math.min(VIEW.h, v.top + v.visH);
    blit(v, x0, y0, x1 - x0, y1 - y0, frame.x + (x0 - v.left) * v.k, frame.y + (y0 - v.top) * v.k);

    // Sticky lane names: where the column would have scrolled off, draw the same pixels pinned at the left edge.
    const realX = frame.x + (LANE_COLUMN.x - v.left) * v.k;
    const pinned = clamp01((frame.x - realX) / (40 * v.k));
    if (realX < frame.x) {
      ctx.globalAlpha = alpha;
      blit(v, LANE_COLUMN.x, y0, LANE_COLUMN.w, y1 - y0, frame.x, frame.y + (y0 - v.top) * v.k);
      const edge = frame.x + LANE_COLUMN.w * v.k;
      ctx.globalAlpha = alpha * pinned;
      ctx.fillStyle = C.ink;
      ctx.fillRect(edge, frame.y, 2, frame.h);
    }
    ctx.restore();
    rect(frame.x, frame.y, frame.w, frame.h, {stroke: C.ink, lw: 1.5, alpha});
  }

  // Source tag. 'top' sits on the empty title row of the whole figure, 'bottom' on the empty
  // lower-right of each crop (clear of every label), 'above' over the small final frame.
  function tag(v, label, alpha, where) {
    if (alpha <= 0.001) return;
    const {frame} = v;
    font(24, 600);
    const w1 = ctx.measureText(label).width;
    font(20, 500, MONO);
    const w2 = ctx.measureText('diagrams/intake.png').width;
    const w = w1 + w2 + 44, h = 40;
    const x = frame.x + frame.w - w - (where === 'above' ? 0 : 12);
    const y = where === 'bottom' ? frame.y + frame.h - h - 12 : where === 'above' ? frame.y - h - 12 : frame.y + 12;
    rect(x, y, w, h, {fill: C.paper, stroke: C.ink, lw: 1, alpha});
    text(label, x + 16, y + h / 2, 24, {weight: 600, alpha});
    text('diagrams/intake.png', x + 28 + w1, y + h / 2 + 1, 20, {family: MONO, weight: 500, color: C.soft, alpha});
  }

  /* ---------- Scenes ---------- */

  function drawIntro(t) {
    const a = 1 - fade(t, T.introOut, 0.5);
    if (a <= 0.001) return;
    const d = state.derived;
    const rise = k => (1 - k) * 14;
    const k1 = fade(t, 0.15, 0.6), k2 = fade(t, 0.6, 0.6), k3 = fade(t, 1.0, 0.6);
    text(COPY.kicker, 64, 84, 24, {weight: 600, color: C.accent, alpha: a * k1});
    COPY.title.forEach((line, i) => text(line, 64, 168 + i * 78 + rise(i ? k2 : k1), 60, {family: MINCHO, weight: 600, alpha: a * (i ? k2 : k1)}));

    // The request sentence that sets the three lanes (fact P2), quoted from diagram-data.json.
    const p2 = state.data.facts.find(f => f.id === 'P2');
    const qx = 720, qy = 112 + rise(k3);
    hline(qx, 1216, qy, C.ink, 2, a * k3);
    text(COPY.quoteHead, qx, qy + 30, 24, {color: C.soft, alpha: a * k3});
    para('「' + (p2 ? p2.text : '') + '」', qx, qy + 52, 496, 28, {weight: 600, lineHeight: 1.6, alpha: a * k3});

    // Three lanes with varied widths; duties and step counts from the data.
    const cols = [
      {id: 'customer', x: 64, w: 340},
      {id: 'intake', x: 436, w: 440},
      {id: 'specialist', x: 908, w: 308}
    ];
    cols.forEach((col, i) => {
      const lane = d.lanes[col.id];
      const k = fade(t, 1.6 + i * 0.4, 0.5) * a;
      if (k <= 0.001) return;
      const y = 404 + (1 - k) * 12;
      hline(col.x, col.x + col.w, y, col.id === 'intake' ? C.accent : C.ink, 2, k);
      const cw = text(lane.code, col.x, y + 40, 24, {family: MONO, weight: 600, color: C.soft, alpha: k});
      text(lane.name, col.x + cw + 12, y + 40, 34, {weight: 700, alpha: k});
      text(lane.duties, col.x, y + 88, 26, {color: C.soft, alpha: k});
      text('工程 ' + lane.nodes.length, col.x, y + 132, 24, {weight: 600, alpha: k});
    });
  }

  function overviewMarks(t, v) {
    const d = state.derived;
    // Lane-name column of each lane, one after another.
    ['customer', 'intake', 'specialist'].forEach((id, i) => {
      const [y0, y1] = d.lanes[id].y;
      brackets(toStage(v, {x: 44, y: y0 + 8, w: 112, h: y1 - y0 - 16}), span(t, 5.9 + i * 0.4, 8.7, 0.3, 0.3), 4, 12);
    });
    // The intake band: every cross-lane arrow has one end here.
    const [iy0, iy1] = d.lanes.intake.y;
    brackets(toStage(v, {x: 168, y: iy0 + 4, w: 1068, h: iy1 - iy0 - 8}), span(t, 9.2, 11.9, 0.4, 0.3), 4, 18);
  }

  function nodeMark(v, id, t, from, to) { brackets(toStage(v, state.derived.nodes[id].bbox), span(t, from, to, 0.3, 0.3)); }
  function labelMark(v, id, t, from, to) {
    const m = state.derived.edges[id].label_mask;
    brackets(toStage(v, {x: m.x, y: m.y, w: m.w, h: m.h}), span(t, from, to, 0.3, 0.3), 5, 10);
  }

  function branchMarks(t, v) {
    // Missing information: R2 → E03 → C2 → E04 → R2
    nodeMark(v, 'R2', t, 13.0, 15.9);
    labelMark(v, 'E03', t, 13.3, 15.9);
    nodeMark(v, 'C2', t, 13.6, 15.9);
    labelMark(v, 'E04', t, 13.9, 15.9);
    // Unresolved: C3 → E10 → R3 → E06 → S1
    nodeMark(v, 'C3', t, 17.0, 19.8);
    labelMark(v, 'E10', t, 17.3, 19.8);
    nodeMark(v, 'R3', t, 17.6, 19.8);
    nodeMark(v, 'S1', t, 17.9, 19.8);
    // Completion: C3 → E09 → R5
    nodeMark(v, 'C3', t, 20.2, 22.9);
    labelMark(v, 'E09', t, 20.5, 22.9);
    nodeMark(v, 'R5', t, 20.8, 22.9);
  }

  // A route written with the figure's own IDs: IDs in mono, arrows in the gothic face.
  function routeCode(route, x, y, alpha) {
    const tokens = [];
    route.nodes.forEach((n, i) => {
      tokens.push(n);
      if (i < route.edges.length) tokens.push(route.edges[i]);
    });
    let cx = x;
    tokens.forEach((tk, i) => {
      if (i) cx += text('→', cx + 10, y, 24, {color: C.soft, alpha}) + 20;
      cx += text(tk, cx, y + 1, 22, {family: MONO, weight: 600, color: /^E/.test(tk) ? C.soft : C.ink, alpha});
    });
  }

  function captions(t) {
    const d = state.derived;
    const list = [
      {from: 1.2, to: 4.8, text: '架空の「よりみちラボ」の問い合わせ業務を、3者の受け持ちで1枚の図にします。'},
      {from: 5.6, to: 8.7, text: '段が担当、箱が工程。段をまたぐ矢印が、担当の間の受け渡しです。'},
      {from: 8.9, to: 11.9, text: '段をまたぐ矢印は' + d.crossCount + '本。どれも片方の端が、受付の工程です。'},
      {from: 12.5, to: 15.9, text: '3情報が足りなければ、受付が追加を依頼。顧客が補足して、確認へ戻ります。', route: 'route-missing'},
      {from: 16.5, to: 19.8, text: '解決しなければ、受付の工程R3から専門担当へ戻します。', route: 'route-unresolved'},
      {from: 19.95, to: 22.9, text: '顧客が解決を確認し、受付が対応記録を残したら完了です。', route: 'route-complete'},
      {from: 23.5, to: 28.5, text: 'HTMLとSVGで保存。工程名や矢印は、あとから直せます。'}
    ];
    for (const c of list) {
      const a = span(t, c.from, c.to, 0.4, 0.3);
      if (a <= 0.001) continue;
      const dy = (1 - a) * 6;
      text(c.text, 64, 652 + dy, 28, {weight: 600, alpha: a});
      if (c.route) routeCode(d.routes[c.route], 64, 692 + dy, a * fade(t, c.from + 0.3, 0.4));
    }
  }

  // Row starts after T.toFinal. HTML and SVG arrive together; PNG and JSON are done by 24.65 s, leaving a still end.
  const FILE_IN = [0.6, 0.6, 1.0, 1.2];

  function drawFiles(t) {
    const a0 = fade(t, T.toFinal + 0.4, 0.5);
    if (a0 <= 0.001) return;
    const x = 784, w = 432;
    text(COPY.filesHead, x, 146, 30, {family: MINCHO, weight: 600, alpha: a0});
    COPY.files.forEach((f, i) => {
      const a = fade(t, T.toFinal + FILE_IN[i], 0.45);
      if (a <= 0.001) return;
      const y = 186 + i * 96 + (1 - a) * 10;
      hline(x, x + w, y, i ? C.rule : C.ink, i ? 1 : 2, a);
      text(f.path, x, y + 30, 22, {family: MONO, weight: 600, color: i === 0 ? C.accent : C.ink, alpha: a});
      text(f.note, x, y + 66, 24, {color: C.soft, alpha: a});
    });
  }

  function progress(t) {
    hline(0, STAGE.w, 717, C.faint, 6, 1);
    hline(0, STAGE.w * t / D, 717, C.accent, 6, 1);
  }

  function drawError(message) {
    text('素材を読み込めませんでした', 64, 300, 36, {weight: 700});
    para(message, 64, 340, 1100, 26, {color: C.soft});
    text('代わりの図は描きません。diagrams/intake.png と diagram-data.json を用意してから開き直してください。', 64, 470, 24, {color: C.soft});
  }

  /* ---------- Frame ---------- */

  window.seek = seconds => {
    const config = window.motionConfig;
    const t = Math.max(0, Math.min(config.duration, Number(seconds) || 0));
    lastSeek = t;
    const W = config.width, H = config.height;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    // Reset every piece of context state so a frame never depends on the previous call.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
    ctx.lineJoin = 'miter';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    const s = Math.min(W / STAGE.w, H / STAGE.h);
    ctx.setTransform(s, 0, 0, s, (W - STAGE.w * s) / 2, (H - STAGE.h * s) / 2);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, STAGE.w, STAGE.h);

    if (state.error) { drawError(state.error); return {time: t, error: state.error}; }
    if (!state.img) { text('読み込み中', 64, 360, 28, {color: C.soft}); return {time: t, loading: true}; }

    drawIntro(t);
    const fa = fade(t, T.figIn, 0.7);
    if (fa > 0.001) {
      const v = view(frameAt(t), camAt(t));
      drawFigure(v, fa);
      if (t < T.toMissing) overviewMarks(t, v);
      else if (t < T.toFinal) branchMarks(t, v);
      const crop = span(t, T.toMissing + 0.3, T.toFinal + 0.5, 0.3, 0.3);
      tag(v, COPY.tagWhole, fa * (1 - crop), t >= T.toFinal ? 'above' : 'top');
      tag(v, COPY.tagCrop, crop, 'bottom');
    }
    drawFiles(t);
    captions(t);
    progress(t);
    ctx.globalAlpha = 1;
    return {time: t, beat: beatAt(t)};
  };

  window.seek(0);
})();
