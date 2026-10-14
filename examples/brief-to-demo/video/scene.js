/* brief-to-demo の使い方 — original Studio Yebisu composition (MIT). Canvas only, no third-party assets.
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
    posterTime: 22,
    audioEvents: []
  };
  window.motionReady = document.fonts.ready;

  const D = 28;
  // Five beats: input / route / structure / completed brief / hand off to AI.
  const BEATS = [0, 5.2, 10.6, 16.4, 22.4, 28];
  const MORPH_AT = [BEATS[1], BEATS[2], BEATS[3], BEATS[4]].map(at => at + 0.05);

  const C = {paper: '#f2eee3', sheet: '#fbf9f3', ink: '#17150f', soft: '#5a5446', orange: '#ff4f00'};
  const GOTHIC = '"Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, "Noto Sans JP", sans-serif';
  const MINCHO = '"Yu Mincho", "Hiragino Mincho ProN", "BIZ UDPMincho", "Noto Serif JP", serif';

  // Words come from the UI sample in examples/brief-to-demo/samples.json.
  const COPY = {
    head: 'brief-to-demo の使い方',
    tagline: 'ひと言を、作れる依頼に。',
    request: 'イベント受付を使いやすくしたい',
    placeholder: '依頼をひと言で',
    reqLabels: ['依頼', '依頼', '元の依頼', '元の依頼', ''],
    questions: ['何を作る？', '誰が使う？', 'どうなれば完成？'],
    categories: ['UI・UX', 'AIスライド', 'モーション', 'エージェント'],
    route: [
      ['成果物', '操作できる受付の画面'],
      ['読むスキル', 'frontend-design'],
      ['聞き足したこと', '地域のイベント、スマホでも迷わず']
    ],
    fields: [
      {label: '目的', key: 'goal', value: '参加者がスマホで迷わず受付を済ませられる画面を作る'},
      {label: '入力', key: 'inputs', value: 'イベントの名称・日時・会場・定員（主催者から受け取る）'},
      {label: 'スキル', key: 'skill_refs', value: 'frontend-design'},
      {label: '完成条件', key: 'acceptance', value: '360px幅で横スクロールせずに、入力から完了まで進める'}
    ],
    title: '地域イベントのスマホ受付画面',
    category: 'ui-ux',
    goal: '参加者がスマホで迷わず受付を済ませられる画面を作る',
    acceptance: [
      '360px幅で横スクロールせずに、入力から完了まで進める',
      'キーボードだけで全項目の入力と送信ができ、焦点の位置が見える'
    ],
    assumption: 'イベントの名称・日時・会場・定員は未提供',
    footer: 'ほかに見る人・渡す素材・成果物・手順を含む、11項目のJSON',
    copyIdle: '依頼文をコピー',
    copyDone: 'コピーしました',
    aiBox: 'AIの入力欄',
    pasted: [
      '{',
      '  "title": "地域イベントのスマホ受付画面",',
      '  "category": "ui-ux",',
      '  "goal": "参加者がスマホで迷わず受付を済ませられる画面を作る",',
      '  "acceptance": [',
      '    "360px幅で横スクロールせずに、入力から完了まで進める",'
    ],
    pastedLead: '次の制作ブリーフに沿って制作してください。',
    demoNote: '「依頼文をコピー」は、作例のデモページにあります',
    captions: [
      {title: 'ひと言の依頼から始める', sub: 'このままでは、何を作れば完成なのかが決まっていません。'},
      {title: '欲しい成果物から、分野を選ぶ', sub: '受付は画面で使うので、UI・UX。足りない条件は、依頼した人に聞きます。'},
      {title: '目的・入力・スキル・完成条件に分ける', sub: '元の言葉は残したまま、足りないところを項目にします。'},
      {title: '推測したことは、分けて書く', sub: '受け取っていない日時や会場は作らず、仮の条件として残します。'},
      {title: 'コピーして、AIに渡す', sub: '完成条件まで一緒に渡せば、できたものを同じ基準で確かめられます。'}
    ],
    timeline: ['依頼', '分野', '項目', 'ブリーフ', '渡す'],
    end: ['入力と、', '完成条件を', 'そろえる。'],
    brand: 'STUDIO YEBISU'
  };

  /* ---------- Pure time helpers ---------- */

  const clamp01 = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
  const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const fade = (t, start, duration) => ease((t - start) / duration);
  const lerp = (a, b, k) => a + (b - a) * k;

  // Closed-form step response of a damped oscillator (Motion Reel starter). Every value depends only on t.
  function spring(t, frequency = 1.4, damping = 0.86) {
    if (t <= 0) return 0;
    const w = 2 * Math.PI * frequency, wd = w * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + damping * w / wd * Math.sin(wd * t));
  }
  function track(t, initial, changes) {
    let value = initial, previous = initial;
    for (const [at, target] of changes) { value += (target - previous) * spring(t - at); previous = target; }
    return value;
  }
  // Animate every numeric key of per-beat targets through the shared morph times.
  function morph(t, states) {
    const out = {};
    for (const key of Object.keys(states[0])) out[key] = track(t, states[0][key], MORPH_AT.map((at, i) => [at, states[i + 1][key]]));
    return out;
  }
  function beatAt(t) {
    let i = 0;
    while (i < 4 && t >= BEATS[i + 1]) i++;
    return i;
  }
  // Visibility of each beat's own content. Content clears just before the shape moves, then returns.
  function contentAlpha(i, t) {
    if (i === 0) return 1 - fade(t, BEATS[1] - 0.25, 0.25);
    const inA = fade(t, BEATS[i] + 0.45, 0.4);
    return i < 4 ? inA * (1 - fade(t, BEATS[i + 1] - 0.25, 0.25)) : inA;
  }
  function captionAlpha(i, t) {
    if (i === 0) return 1 - fade(t, BEATS[1] - 0.3, 0.3);
    const inA = fade(t, BEATS[i] + 0.2, 0.45);
    return i < 4 ? inA * (1 - fade(t, BEATS[i + 1] - 0.3, 0.3)) : inA * (1 - fade(t, 24.9, 0.35));
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
  // Line breaking for Japanese: break between characters, keep Latin words whole, avoid punctuation at line start.
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
  function measurePara(str, maxWidth, size, o = {}) {
    font(size, o.weight || 400, o.family || GOTHIC);
    return wrapLines(str, maxWidth).length * size * (o.lineHeight || 1.5);
  }
  function para(str, x, top, maxWidth, size, o = {}) {
    font(size, o.weight || 400, o.family || GOTHIC);
    const lines = wrapLines(str, maxWidth);
    const lh = size * (o.lineHeight || 1.5);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => ctx.fillText(line, x, top + lh * (i + 0.5)));
    return lines.length * lh;
  }
  function fit(str, maxWidth) {
    if (ctx.measureText(str).width <= maxWidth) return str;
    let s = str;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
    return s + '…';
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
  function setSpacing(px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px';
  }

  /* ---------- Layout (rebuilt natively for each size) ---------- */

  function layout(W, H) {
    const u = Math.min(W, H);
    if (W / H >= 1.25) {
      const mx = W * 0.055;
      return {W, H, u, wide: true, mx, headY: H * 0.075, ruleY: H * 0.12,
        cap: {x: mx, y: H * 0.2, w: W * 0.31}, num: u * 0.12,
        S: {x: W * 0.43, y: H * 0.17, w: W * 0.515, h: H * 0.67},
        tl: {x: mx, y: H * 0.9, w: W - 2 * mx}};
    }
    const mx = W * 0.06;
    return {W, H, u, wide: false, mx, headY: H * 0.045, ruleY: H * 0.07,
      cap: {x: mx, y: H * 0.1, w: W - 2 * mx}, num: u * 0.09,
      S: {x: mx, y: H * 0.37, w: W - 2 * mx, h: H * 0.49},
      tl: {x: mx, y: H * 0.92, w: W - 2 * mx}};
  }

  // The one object that travels: an input field that becomes the brief.
  function cardStates(L) {
    const {S, u} = L;
    return [
      {x: S.x, y: S.y + S.h * 0.36 - u * 0.1, w: S.w, h: u * 0.2},
      {x: S.x, y: S.y, w: S.w, h: u * 0.17},
      {x: S.x, y: S.y, w: S.w, h: S.h},
      {x: S.x, y: S.y, w: S.w, h: S.h},
      {x: S.x, y: S.y, w: S.w * 0.47, h: S.h * 0.76}
    ];
  }
  function requestStates(u) {
    return [
      {dy: u * 0.12, size: u * 0.05},
      {dy: u * 0.105, size: u * 0.042},
      {dy: u * 0.085, size: u * 0.03},
      {dy: u * 0.15, size: u * 0.026},
      {dy: u * 0.06, size: u * 0.021}
    ];
  }

  /* ---------- Scene parts ---------- */

  function drawHeader(L) {
    const {u, mx, W} = L;
    text(COPY.head, mx, L.headY, u * 0.026, {weight: 700});
    text(COPY.tagline, W - mx, L.headY, u * 0.026, {family: MINCHO, weight: 700, align: 'right'});
    line(mx, L.ruleY, W - mx, L.ruleY, C.ink, 1, 1);
  }

  function drawCaptions(t, L) {
    const {u, cap} = L;
    for (let i = 0; i < 5; i++) {
      const a = captionAlpha(i, t);
      if (a <= 0.001) continue;
      const dy = (1 - a) * u * 0.015;
      const numW = text(String(i + 1), cap.x, cap.y + L.num * 0.45 + dy, L.num, {family: MINCHO, weight: 700, color: C.orange, alpha: a});
      text('/ 5', cap.x + numW + u * 0.015, cap.y + L.num * 0.62 + dy, u * 0.028, {color: C.soft, alpha: a});
      const titleTop = cap.y + L.num + u * 0.02 + dy;
      const titleH = para(COPY.captions[i].title, cap.x, titleTop, cap.w, u * 0.048, {weight: 700, lineHeight: 1.35, alpha: a});
      para(COPY.captions[i].sub, cap.x, titleTop + titleH + u * 0.025, cap.w, u * 0.03, {color: C.soft, lineHeight: 1.6, alpha: a});
    }
  }

  function drawEnd(t, L) {
    const a = fade(t, 25.35, 0.5);
    if (a <= 0.001) return;
    const {u, cap} = L;
    const size = L.wide ? u * 0.075 : u * 0.07;
    const top = cap.y + u * 0.01 + (1 - a) * u * 0.02;
    COPY.end.forEach((str, k) => text(str, cap.x, top + size * (0.6 + k * 1.25), size, {family: MINCHO, weight: 700, alpha: a}));
    const ruleY = top + size * (0.6 + 2 * 1.25) + size * 0.85;
    box(cap.x, ruleY, u * 0.14 * easeOut((t - 25.7) / 0.5), u * 0.007, {fill: C.orange, alpha: a});
    setSpacing(u * 0.006);
    text(COPY.brand, cap.x, ruleY + u * 0.06, u * 0.024, {weight: 700, alpha: fade(t, 25.9, 0.4)});
    setSpacing(0);
  }

  function drawTimeline(t, L) {
    const {u, tl} = L;
    const current = beatAt(t);
    line(tl.x, tl.y, tl.x + tl.w, tl.y, C.ink, 1, 0.25);
    box(tl.x, tl.y - 1.5, tl.w * t / D, 3, {fill: C.orange});
    for (let i = 0; i < 5; i++) {
      const bx = tl.x + tl.w * BEATS[i] / D;
      line(bx, tl.y - u * 0.012, bx, tl.y + u * 0.012, C.ink, 1, 0.6);
      text(COPY.timeline[i], bx + u * 0.01, tl.y + u * 0.033, u * 0.024,
        {weight: i === current ? 700 : 400, color: i === current ? C.ink : C.soft});
    }
  }

  function drawCardShell(card) {
    box(card.x, card.y, card.w, card.h, {fill: C.sheet, stroke: C.ink, lw: 1.5});
  }

  // The request text persists through every beat; only its place and size change.
  function drawRequest(t, L, card) {
    const u = L.u, i = beatAt(t);
    const p = morph(t, requestStates(u));
    const x = card.x + u * 0.035, y = card.y + p.dy;

    const label = COPY.reqLabels[i];
    if (label) {
      const inA = i === 0 || COPY.reqLabels[i - 1] === label ? 1 : fade(t, BEATS[i] + 0.45, 0.35);
      const outA = i < 4 && COPY.reqLabels[i + 1] !== label ? 1 - fade(t, BEATS[i + 1] - 0.25, 0.25) : 1;
      text(label, x, y - p.size * 0.5 - u * 0.026, u * 0.025, {color: C.soft, weight: 700, alpha: inA * outA});
    }

    const typed = i === 0
      ? COPY.request.slice(0, Math.floor(clamp01((t - 0.5) / 1.4) * COPY.request.length))
      : COPY.request;
    if (!typed) text(COPY.placeholder, x, y, p.size, {color: C.soft, alpha: 0.6});
    const width = typed ? text(typed, x, y, p.size, {weight: i <= 1 ? 700 : 600}) : 0;

    if (i === 0 && t < BEATS[1] - 0.3) {
      const on = t < 1.9 || Math.floor((t - 1.9) * 2.4) % 2 === 0;
      if (on) box(x + width + u * 0.004, y - p.size * 0.6, Math.max(2, u * 0.004), p.size * 1.2, {fill: C.orange});
    }
  }

  function drawQuestions(t, L, a) {
    const {u, S} = L;
    const card = cardStates(L)[0];
    const gap = u * 0.016, w = (S.w - gap * 2) / 3, h = u * 0.085;
    const y = card.y + card.h + u * 0.06;
    COPY.questions.forEach((q, k) => {
      const e = ease((t - (2.3 + k * 0.3)) / 0.35);
      const alpha = a * e;
      if (alpha <= 0.001) return;
      const x = S.x + k * (w + gap), yy = y + (1 - e) * u * 0.015;
      ctx.setLineDash([u * 0.008, u * 0.007]);
      box(x, yy, w, h, {stroke: C.soft, lw: 1.5, alpha});
      ctx.setLineDash([]);
      text(q, x + w / 2, yy + h / 2, u * 0.03, {align: 'center', weight: 600, color: C.soft, alpha});
    });
  }

  function drawRoute(t, L, a) {
    const {u, S} = L;
    const top = S.y + u * 0.17;
    const chipsY = S.y + u * 0.27, chipH = u * 0.085, gap = u * 0.016;
    const chipW = (S.w - gap * 3) / 4;
    const pick = fade(t, 6.75, 0.3);

    const lp = easeOut((t - 6.25) / 0.5);
    const cx = S.x + chipW / 2;
    if (lp > 0) {
      line(cx, top, cx, top + (chipsY - top - u * 0.006) * lp, C.orange, 3, a);
      if (lp >= 0.999) {
        ctx.globalAlpha = a;
        ctx.fillStyle = C.orange;
        ctx.beginPath();
        ctx.moveTo(cx - u * 0.012, chipsY - u * 0.02);
        ctx.lineTo(cx + u * 0.012, chipsY - u * 0.02);
        ctx.lineTo(cx, chipsY - u * 0.002);
        ctx.closePath();
        ctx.fill();
      }
    }

    COPY.categories.forEach((name, k) => {
      const e = ease((t - (5.75 + k * 0.12)) / 0.35);
      const selected = k === 0;
      const alpha = a * e * (selected ? 1 : 1 - 0.55 * pick);
      if (alpha <= 0.001) return;
      const x = S.x + k * (chipW + gap), y = chipsY + (1 - e) * u * 0.02;
      if (selected && pick > 0) box(x, y, chipW, chipH, {fill: C.orange, alpha: alpha * pick});
      box(x, y, chipW, chipH, {stroke: C.ink, lw: 1.5, alpha});
      text(name, x + chipW / 2, y + chipH / 2, u * 0.03, {align: 'center', weight: selected ? 700 : 400, alpha});
    });

    const rowsY = chipsY + chipH + u * 0.08;
    COPY.route.forEach(([label, value], k) => {
      const e = ease((t - (7.2 + k * 0.6)) / 0.4);
      const alpha = a * e;
      if (alpha <= 0.001) return;
      const y = rowsY + k * u * 0.075;
      text(label, S.x, y, u * 0.026, {color: C.soft, weight: 700, alpha});
      text(value, S.x + u * 0.2 + (1 - e) * u * 0.02, y, u * 0.036, {weight: 700, alpha});
    });
  }

  function drawStructure(t, L, card, a) {
    const u = L.u, pad = u * 0.035, headH = u * 0.14;
    line(card.x, card.y + headH, card.x + card.w, card.y + headH, C.ink, 1, a);
    const rowsTop = card.y + headH, rowH = (card.h - headH) / 4;
    const labelX = card.x + pad, valueX = card.x + pad + u * 0.2, valueW = card.w - pad * 2 - u * 0.2;

    const barA = a * fade(t, 11.3, 0.3) * (1 - fade(t, 14.6, 0.5));
    if (barA > 0.001) {
      const pos = track(t, 0, [[12.05, 1], [12.8, 2], [13.55, 3]]);
      box(card.x, rowsTop + pos * rowH + rowH * 0.2, u * 0.009, rowH * 0.6, {fill: C.orange, alpha: barA});
    }

    COPY.fields.forEach((f, k) => {
      const reveal = 11.3 + k * 0.75, y = rowsTop + k * rowH;
      if (k) line(card.x + pad, y, card.x + card.w - pad, y, C.ink, 1, a * 0.2);
      const la = a * fade(t, reveal, 0.3);
      if (la <= 0.001) return;
      text(f.label, labelX, y + rowH * 0.5 - u * 0.016, u * 0.034, {weight: 700, alpha: la});
      text(f.key, labelX, y + rowH * 0.5 + u * 0.026, u * 0.024, {color: C.soft, alpha: la});
      const e = ease((t - reveal - 0.2) / 0.4);
      if (a * e <= 0.001) return;
      const size = u * 0.031, opts = {lineHeight: 1.45, weight: f.key === 'skill_refs' ? 700 : 400};
      const h = measurePara(f.value, valueW, size, opts);
      para(f.value, valueX + (1 - e) * u * 0.02, y + (rowH - h) / 2, valueW, size, {...opts, alpha: a * e});
    });
  }

  function drawComplete(t, L, card, a) {
    const u = L.u, pad = u * 0.035;
    const titleA = a * fade(t, 16.85, 0.4);
    text(COPY.title, card.x + pad, card.y + u * 0.07, u * 0.046, {family: MINCHO, weight: 700, alpha: titleA});
    font(u * 0.025, 700);
    const tagW = ctx.measureText(COPY.category).width + u * 0.032, tagH = u * 0.046;
    const tagX = card.x + card.w - pad - tagW, tagY = card.y + u * 0.07 - tagH / 2;
    box(tagX, tagY, tagW, tagH, {fill: C.orange, alpha: titleA});
    text(COPY.category, tagX + tagW / 2, tagY + tagH / 2, u * 0.025, {weight: 700, align: 'center', alpha: titleA});
    line(card.x, card.y + u * 0.19, card.x + card.w, card.y + u * 0.19, C.ink, 1, a);

    const labelX = card.x + pad, labelW = u * 0.21;
    const valueX = labelX + labelW, valueW = card.w - pad * 2 - labelW;
    const size = u * 0.029, lh = 1.45;
    const sections = [
      {label: '目的', key: 'goal', items: [COPY.goal], kind: 'text', at: 17.3},
      {label: '完成条件', key: 'acceptance', items: COPY.acceptance, kind: 'check', at: 17.75},
      {label: '仮に決めたこと', key: 'assumptions', items: [COPY.assumption], kind: 'assume', at: 18.25}
    ];
    let y = card.y + u * 0.215;
    sections.forEach((s, k) => {
      const e = ease((t - s.at) / 0.4);
      const alpha = a * e;
      if (k) line(labelX, y - u * 0.015, card.x + card.w - pad, y - u * 0.015, C.ink, 1, a * 0.2);
      const start = y;
      let itemsH = 0;
      s.items.forEach(item => {
        const indent = s.kind === 'check' ? u * 0.036 : 0;
        const h = measurePara(item, valueW - indent, size, {lineHeight: lh});
        if (alpha > 0.001) {
          if (s.kind === 'check') box(valueX, start + itemsH + size * 0.32, size * 0.82, size * 0.82, {stroke: C.ink, lw: 1.5, alpha});
          para(item, valueX + indent + (1 - e) * u * 0.015, start + itemsH, valueW - indent, size, {lineHeight: lh, alpha, weight: s.kind === 'assume' ? 600 : 400});
        }
        itemsH += h + u * 0.006;
      });
      if (s.kind === 'assume' && alpha > 0.001) {
        const grow = easeOut((t - 18.45) / 0.5);
        box(valueX - u * 0.02, start, u * 0.006, (itemsH - u * 0.006) * grow, {fill: C.orange, alpha: a});
      }
      if (alpha > 0.001) {
        text(s.label, labelX, start + size * lh * 0.5, u * 0.027, {weight: 700, alpha});
        text(s.key, labelX, start + size * lh * 0.5 + u * 0.032, u * 0.022, {color: C.soft, alpha});
      }
      y = start + Math.max(itemsH, u * 0.07) + u * 0.03;
    });

    text(COPY.footer, card.x + pad, card.y + card.h - pad, u * 0.024, {color: C.soft, alpha: a * fade(t, 18.9, 0.4)});
  }

  function copyButton(L, card) {
    const u = L.u, pad = u * 0.028, h = u * 0.07;
    return {x: card.x + pad, y: card.y + card.h - pad - h, w: card.w - pad * 2, h};
  }

  function drawHandoffCard(t, L, card, a) {
    const u = L.u, pad = u * 0.035;
    para(COPY.title, card.x + pad, card.y + u * 0.09, card.w - pad * 2, u * 0.028, {family: MINCHO, weight: 700, lineHeight: 1.35, alpha: a});
    const ratios = [0.92, 0.72, 0.5, 0.84];
    COPY.fields.forEach((f, k) => {
      const y = card.y + u * 0.2 + k * u * 0.055;
      text(f.label, card.x + pad, y, u * 0.022, {color: C.soft, weight: 700, alpha: a});
      const bx = card.x + pad + u * 0.1;
      box(bx, y - u * 0.004, (card.x + card.w - pad - bx) * ratios[k], u * 0.008, {fill: C.ink, alpha: a * 0.22});
    });

    const b = copyButton(L, card);
    const press = Math.max(0, 1 - Math.abs(t - 23.32) / 0.12);
    const s = 1 - 0.04 * press;
    const done = t >= 23.42;
    const bw = b.w * s, bh = b.h * s, bx = b.x + (b.w - bw) / 2, by = b.y + (b.h - bh) / 2;
    box(bx, by, bw, bh, {fill: done ? C.orange : C.ink, stroke: C.ink, lw: 1.5, alpha: a});
    text(done ? COPY.copyDone : COPY.copyIdle, bx + bw / 2, by + bh / 2, u * 0.028, {align: 'center', weight: 700, color: done ? C.ink : C.paper, alpha: a});
  }

  function drawHandoffOutside(t, L, card, a) {
    const {u, S} = L;
    const pad = u * 0.028;
    const ai = {x: S.x + S.w * 0.53, y: S.y, w: S.w * 0.47, h: S.h * 0.76};
    const boxA = a * fade(t, 22.9, 0.4);
    if (boxA > 0.001) {
      box(ai.x, ai.y, ai.w, ai.h, {fill: C.sheet, stroke: C.ink, lw: 1.5, alpha: boxA});
      text(COPY.aiBox, ai.x + pad, ai.y + u * 0.045, u * 0.025, {color: C.soft, weight: 700, alpha: boxA});
      line(ai.x, ai.y + u * 0.085, ai.x + ai.w, ai.y + u * 0.085, C.ink, 1, boxA * 0.4);

      const pa = boxA * fade(t, 24.35, 0.35);
      if (pa > 0.001) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(ai.x + 1, ai.y + u * 0.09, ai.w - 2, ai.h - u * 0.09 - 1);
        ctx.clip();
        let y = ai.y + u * 0.105;
        y += para(COPY.pastedLead, ai.x + pad, y, ai.w - pad * 2, u * 0.026, {weight: 700, lineHeight: 1.45, alpha: pa}) + u * 0.012;
        font(u * 0.022, 400);
        COPY.pasted.forEach(str => {
          text(fit(str, ai.w - pad * 2), ai.x + pad, y + u * 0.018, u * 0.022, {color: C.soft, alpha: pa});
          y += u * 0.036;
        });
        // Fade the bottom edge so the pasted text reads as continuing.
        const fadeTop = ai.y + ai.h - u * 0.09;
        const g = ctx.createLinearGradient(0, fadeTop, 0, ai.y + ai.h);
        g.addColorStop(0, 'rgba(251,249,243,0)');
        g.addColorStop(1, 'rgba(251,249,243,1)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(ai.x + 1, fadeTop, ai.w - 2, u * 0.09 - 1);
        ctx.restore();
      }
    }

    // A copy of the brief travels from the card into the AI box.
    const g = clamp01((t - 23.55) / 0.75);
    if (g > 0 && g < 1) {
      const e = easeInOut(g);
      const dest = {x: ai.x + pad, y: ai.y + u * 0.1, w: ai.w - pad * 2, h: ai.h * 0.6};
      const r = {x: lerp(card.x, dest.x, e), y: lerp(card.y, dest.y, e), w: lerp(card.w, dest.w, e), h: lerp(card.h, dest.h, e)};
      box(r.x, r.y, r.w, r.h, {fill: C.orange, alpha: a * 0.08 * (1 - g)});
      box(r.x, r.y, r.w, r.h, {stroke: C.orange, lw: 2, alpha: a * (1 - g * 0.85)});
    }

    // Pointer that presses the copy button.
    const b = copyButton(L, card);
    const ca = a * fade(t, 22.85, 0.2) * (1 - fade(t, 24.2, 0.3));
    if (ca > 0.001) {
      const m = easeInOut((t - 22.9) / 0.38);
      const px = lerp(S.x + S.w * 0.4, b.x + b.w * 0.62, m), py = lerp(S.y + S.h * 0.98, b.y + b.h * 0.55, m);
      const ring = clamp01((t - 23.3) / 0.35);
      if (ring > 0 && ring < 1) {
        ctx.globalAlpha = a * (1 - ring);
        ctx.strokeStyle = C.orange;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, u * (0.01 + 0.035 * ring), 0, Math.PI * 2);
        ctx.stroke();
      }
      const h = u * 0.036;
      ctx.globalAlpha = ca;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + h);
      ctx.lineTo(px + h * 0.28, py + h * 0.76);
      ctx.lineTo(px + h * 0.46, py + h * 1.1);
      ctx.lineTo(px + h * 0.6, py + h * 1.03);
      ctx.lineTo(px + h * 0.42, py + h * 0.7);
      ctx.lineTo(px + h * 0.76, py + h * 0.7);
      ctx.closePath();
      ctx.fillStyle = C.ink;
      ctx.fill();
      ctx.strokeStyle = C.paper;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const na = a * fade(t, 24.8, 0.4);
    if (na > 0.001) text(COPY.demoNote, S.x, S.y + S.h * 0.76 + u * 0.05, u * 0.025, {color: C.soft, alpha: na});
  }

  /* ---------- Frame ---------- */

  window.seek = seconds => {
    const config = window.motionConfig;
    const t = Math.max(0, Math.min(config.duration, Number(seconds) || 0));
    const W = config.width, H = config.height;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    // Reset every piece of context state so the frame never depends on the previous call.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
    setSpacing(0);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);

    const L = layout(W, H);
    const beat = beatAt(t);
    drawHeader(L);
    drawCaptions(t, L);

    const card = morph(t, cardStates(L));
    drawCardShell(card);
    ctx.save();
    ctx.beginPath();
    ctx.rect(card.x, card.y, card.w, card.h);
    ctx.clip();
    drawRequest(t, L, card);
    if (contentAlpha(2, t) > 0.001) drawStructure(t, L, card, contentAlpha(2, t));
    if (contentAlpha(3, t) > 0.001) drawComplete(t, L, card, contentAlpha(3, t));
    if (contentAlpha(4, t) > 0.001) drawHandoffCard(t, L, card, contentAlpha(4, t));
    ctx.restore();
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.ink;
    ctx.strokeRect(card.x, card.y, card.w, card.h);

    if (contentAlpha(0, t) > 0.001) drawQuestions(t, L, contentAlpha(0, t));
    if (contentAlpha(1, t) > 0.001) drawRoute(t, L, contentAlpha(1, t));
    if (contentAlpha(4, t) > 0.001) drawHandoffOutside(t, L, card, contentAlpha(4, t));

    drawEnd(t, L);
    drawTimeline(t, L);
    ctx.globalAlpha = 1;
    return {time: t, beat};
  };

  window.seek(0);
})();
