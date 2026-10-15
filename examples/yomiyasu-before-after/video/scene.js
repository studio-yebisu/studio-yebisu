/* yomiyasu の推敲 — original Studio Yebisu composition (MIT). Canvas only, no screenshots, no sound.
   Contract (Motion Reel): window.seek(seconds) rebuilds the complete frame from t alone.
   Every quoted sentence below is copied exactly from ../samples.json (input, output, context, preserved). */
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
    posterTime: 20.8,
    audioEvents: []
  };

  const D = 28;
  // The composition is laid out on a 1280x720 stage and scaled to the render size.
  const STAGE = {w: 1280, h: 720};
  // Title / what is handed over / what changes / what is checked / strength kept / the example.
  const BEATS = [0, 3.6, 8.0, 15.6, 21.6, 25.4, 28];

  const C = {paper: '#f3eee2', sheet: '#fbf8f1', ink: '#1f1b16', soft: '#5d5548', rule: '#d6ccb8', red: '#9a3a22', kept: '#e6dcc6'};
  const GOTHIC = '"Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, "Noto Sans JP", sans-serif';
  const MINCHO = '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "BIZ UDPMincho", "Noto Serif JP", serif';

  window.motionReady = document.fonts.ready.then(() => window.seek(window.__lastSeek || 0));

  /* ---------- Copy (quotes are exact; see samples.json) ---------- */

  const OPERATION = {
    first: '設定ファイルの保存ボタンを押すことによって、変更内容の反映が実現されます。',
    context: 'アプリの操作マニュアル。操作と結果、例外を説明する架空の文章。敬体。',
    output: '設定ファイルの保存ボタンを押すと、変更内容が反映されます。ただし、音声ファイルの出力を伴う処理については、アプリを再起動するまで従来の設定が維持されます。保存に失敗した場合、編集した内容は画面上に残りますが、ディスクには書き込まれません。',
    changed: ['押すと、変更内容が反映されます', 'アプリを再起動するまで'],
    preserved: [
      {condition: '保存ボタンで変更を反映', excerpt: '保存ボタンを押すと、変更内容が反映されます'},
      {condition: '音声ファイルの出力は再起動まで従来の設定', excerpt: '音声ファイルの出力を伴う処理については、アプリを再起動するまで従来の設定が維持されます'},
      {condition: '保存失敗時も画面の編集内容は残る', excerpt: '保存に失敗した場合、編集した内容は画面上に残ります'},
      {condition: '失敗時はディスクに書き込まれない', excerpt: 'ディスクには書き込まれません'}
    ]
  };

  // The two sentences that change, split at a comma or clause so each line stays large.
  // {b, a} is the original wording and the wording after the rewrite; the plain strings are left as they were.
  const EDIT_A = {
    label: '保存操作の説明　1文目',
    lines: [
      ['設定ファイルの保存ボタンを押す', {b: 'ことによって', a: 'と', key: 'a1'}, '、'],
      ['変更内容', {b: 'の反映が実現され', a: 'が反映され', key: 'a2'}, 'ます。']
    ],
    timing: {a1: 8.55, a2: 8.85},
    from: 8.0, to: 12.0
  };
  const EDIT_B = {
    label: '保存操作の説明　2文目',
    lead: 'ただし、音声ファイルの出力を伴う処理については、',
    lines: [
      ['アプリ', {b: 'の再起動を実施する', a: 'を再起動する', key: 'b1'}, 'まで'],
      ['従来の設定が維持されます。']
    ],
    timing: {b1: 12.75},
    from: 12.0, to: 15.6
  };

  const RESEARCH = {
    label: '架空の調査メモ　3文目（原文と推敲後で同じ）',
    lines: ['入力ミスを減らせる可能性はあると考えていますが、', 'その効果を確認できたわけではありません。'],
    marks: [
      {line: 0, part: '可能性はあると考えています', tag: '推量のまま', at: 22.5},
      {line: 1, part: '確認できたわけではありません', tag: '未確認のまま', at: 23.1}
    ],
    numbers: ['8人の協力者のうち6人', '1人あたり5分']
  };

  const COPY = {
    head: 'yomiyasu の作例',
    field: '文章・翻訳 / Studio Yebisu',
    name: 'yomiyasu',
    title: '意味と条件を保つ日本語の推敲',
    titleMark: '推敲',
    lead: 'AIが書いた日本語の言い回しを、主張・数値・言い切りの強さを変えずに整えるスキル。',
    origin: 'nanaism/yomiyasu　MIT License　この動画の文章はすべて架空です',
    captions: [
      {from: 3.6, to: 8.0, n: 1, title: '原文と用途を渡す', sub: 'yomiyasu は書き直す前に、文書の用途と読み手、各文の働きを確かめます。'},
      {from: 8.0, to: 15.6, n: 2, title: '名詞を重ねた言い回しを動詞に戻す', sub: '「〜の反映が実現されます」「〜を実施する」だけを直し、ほかの語と文の順序は残しました。'},
      {from: 15.6, to: 21.6, n: 3, title: '条件が残っているかを照らし合わせる', sub: '制作時に4つの条件を一つずつ確かめた記録です。自動の判定ではありません。'},
      {from: 21.6, to: 25.4, n: 4, title: '言い切りの強さも変えない', sub: '可能性と未確認を述べる文は原文のまま残し、数値も変えていません。'}
    ],
    cards: [
      {tag: '原文（1文目を抜粋）', body: OPERATION.first, family: MINCHO},
      {tag: '用途と読み手', body: OPERATION.context, family: MINCHO},
      {tag: '読むスキル', body: 'yomiyasu の SKILL.md と、業務文書向けの business.md', family: GOTHIC}
    ],
    hub: '推敲',
    keptHead: '推敲後（保存操作の説明、全文）',
    condHead: '残す条件',
    numbersTag: '数値も原文のまま',
    chapters: ['yomiyasu', '渡す', '変わる', '守る', '強さ', '作例'],
    endField: '文章・翻訳 / Studio Yebisu',
    endTitle: ['3件の原文と推敲後を', '作例で読み比べる'],
    endSub: '機能のお知らせ・保存操作の説明・架空の調査メモ。変えたところの理由と、残した条件も並べています。ページ上でAIは実行しません。'
  };

  /* ---------- Pure time helpers ---------- */

  const clamp01 = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const fade = (t, start, duration) => ease((t - start) / duration);
  const window01 = (t, from, to, inDur = 0.4, outDur = 0.35) => fade(t, from, inDur) * (1 - fade(t, to - outDur, outDur));
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});

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
  function measure(str, size, weight = 400, family = GOTHIC) {
    font(size, weight, family);
    return ctx.measureText(str).width;
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
  // Japanese line breaking that keeps the source index of each line, so quoted ranges can be boxed.
  function layout(str, maxWidth, size, weight = 400, family = GOTHIC) {
    font(size, weight, family);
    const tokens = String(str).match(/[A-Za-z0-9_.\-/:%]+|[\s\S]/gu) || [];
    const lines = [];
    let line = '', start = 0, index = 0;
    for (const token of tokens) {
      const next = line + token;
      if (line && ctx.measureText(next).width > maxWidth && !NO_LINE_START.includes(token)) {
        lines.push({text: line, start});
        line = token;
        start = index;
      } else {
        line = next;
      }
      index += token.length;
    }
    if (line) lines.push({text: line, start});
    return {lines, size, weight, family};
  }
  function para(str, x, top, maxWidth, size, o = {}) {
    const lay = layout(str, maxWidth, size, o.weight || 400, o.family || GOTHIC);
    const lh = size * (o.lineHeight || 1.6);
    lay.lines.forEach((l, i) => text(l.text, x, top + lh * (i + 0.5), size, o));
    return lay.lines.length * lh;
  }
  // Rectangles covering text[start, end) in a layout drawn at (x, top) with line height lh.
  function rangeRects(lay, x, top, lh, start, end) {
    const rects = [];
    lay.lines.forEach((l, i) => {
      const s = Math.max(start, l.start), e = Math.min(end, l.start + l.text.length);
      if (s >= e) return;
      font(lay.size, lay.weight, lay.family);
      const x0 = x + ctx.measureText(l.text.slice(0, s - l.start)).width;
      const w = ctx.measureText(l.text.slice(s - l.start, e - l.start)).width;
      rects.push({x: x0, y: top + lh * i, w, h: lh});
    });
    return rects;
  }
  function box(x, y, w, h, o = {}) {
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(x, y, w, h); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 1; ctx.strokeRect(x, y, w, h); }
  }
  function line(x1, y1, x2, y2, color, width, alpha) {
    if (alpha <= 0.001) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function tag(label, x, y, o = {}) {
    const size = o.size || 17;
    const w = measure(label, size, 700) + 18;
    box(x, y, w, size + 13, {fill: o.fill || C.red, alpha: o.alpha});
    text(label, x + 9, y + (size + 13) / 2, size, {weight: 700, color: o.color || C.sheet, alpha: o.alpha});
    return w;
  }
  function sheet(r, alpha) {
    box(r.x, r.y, r.w, r.h, {fill: C.sheet, alpha});
    box(r.x, r.y, r.w, r.h, {stroke: C.rule, lw: 1.5, alpha});
  }

  /* ---------- Scene parts ---------- */

  function drawHeader(t) {
    const a = fade(t, 3.3, 0.5) * (1 - fade(t, 25.1, 0.4));
    if (a <= 0.001) return;
    text(COPY.head, 64, 40, 20, {weight: 700, alpha: a});
    text(COPY.field, STAGE.w - 64, 40, 18, {align: 'right', color: C.soft, alpha: a});
    line(64, 64, STAGE.w - 64, 64, C.ink, 1, a);
  }

  function drawTitle(t) {
    const a = 1 - fade(t, 3.25, 0.4);
    if (a <= 0.001) return;
    const rise = k => (1 - k) * 16;
    const k1 = fade(t, 0.15, 0.55), k2 = fade(t, 0.7, 0.55), k3 = fade(t, 1.5, 0.55);
    text(COPY.name, 64, 210 + rise(k1), 104, {weight: 700, alpha: a * k1});
    const titleY = 330 + rise(k2);
    const tw = text(COPY.title, 64, titleY, 56, {family: MINCHO, weight: 700, alpha: a * k2});
    // A proofreader's line drawn under the word 推敲.
    const markW = measure(COPY.titleMark, 56, 700, MINCHO);
    const markX = 64 + tw - markW;
    line(markX, titleY + 40, markX + markW * ease((t - 1.15) / 0.55), titleY + 40, C.red, 4, a);
    para(COPY.lead, 64, 400 + rise(k3), 1000, 24, {color: C.soft, alpha: a * k3});
    text(COPY.origin, 64, 486 + rise(k3), 19, {color: C.soft, alpha: a * k3});
  }

  function drawCaption(t) {
    for (const c of COPY.captions) {
      const a = window01(t, c.from + 0.1, c.to, 0.45, 0.3);
      if (a <= 0.001) continue;
      const dy = (1 - a) * 10;
      const numW = text(String(c.n), 64, 124 + dy, 64, {family: MINCHO, weight: 700, color: C.red, alpha: a});
      text(c.title, 64 + numW + 20, 128 + dy, 34, {weight: 700, alpha: a});
      text(c.sub, 64, 186 + dy, 20, {color: C.soft, alpha: a});
    }
  }

  // Scene 1: the original, its purpose and the skill go into one step.
  const CARD_Y = 250, CARD_H = 236, CARD_W = 352;
  const cardRect = i => ({x: 64 + i * (CARD_W + 48), y: CARD_Y, w: CARD_W, h: CARD_H});
  const HUB = {x: 560, y: 548, w: 160, h: 52};
  const EDIT_SHEET = {x: 64, y: 236, w: 1152, h: 380};

  function drawHandOver(t) {
    const a = window01(t, 3.7, 8.0, 0.4, 0.5);
    if (a <= 0.001) return;
    COPY.cards.forEach((card, i) => {
      const k = fade(t, 4.0 + i * 0.35, 0.45);
      // The first card leaves last: it becomes the sheet of the next scene.
      const out = i === 0 ? 1 : 1 - fade(t, 7.2, 0.4);
      const r = cardRect(i);
      const alpha = a * k * out;
      if (alpha <= 0.001) return;
      const y = r.y + (1 - k) * 18;
      sheet({x: r.x, y, w: r.w, h: r.h}, alpha * (i === 0 ? 1 - fade(t, 7.45, 0.2) : 1));
      const contentA = alpha * (i === 0 ? 1 - fade(t, 7.3, 0.3) : 1);
      tag(card.tag, r.x + 20, y + 20, {alpha: contentA, fill: i === 0 ? C.red : C.ink});
      para(card.body, r.x + 22, y + 66, r.w - 44, 23, {family: card.family, lineHeight: 1.75, alpha: contentA});
      // A line from each card down into the rewrite step.
      const lk = fade(t, 5.4 + i * 0.15, 0.5);
      const fromX = r.x + r.w / 2, fromY = y + r.h, toX = HUB.x + HUB.w / 2, toY = HUB.y;
      line(fromX, fromY, lerp(fromX, toX, lk), lerp(fromY, toY, lk), C.ink, 1.5, contentA * 0.7);
    });
    const hubA = a * fade(t, 5.8, 0.4) * (1 - fade(t, 7.2, 0.4));
    if (hubA > 0.001) {
      box(HUB.x, HUB.y, HUB.w, HUB.h, {fill: C.ink, alpha: hubA});
      text(COPY.hub, HUB.x + HUB.w / 2, HUB.y + HUB.h / 2, 24, {weight: 700, align: 'center', color: C.sheet, alpha: hubA});
    }
  }

  // The first card opens into the sheet on which the sentence is revised.
  function drawCarry(t) {
    const k = easeInOut((t - 7.35) / 0.65);
    if (t < 7.35 || t > 8.3) return;
    const r = lerpRect(cardRect(0), EDIT_SHEET, k);
    sheet(r, 1);
  }

  // One line of a sentence with {b, a} parts that are struck, annotated and then closed up.
  function drawEditLine(segs, x, y, size, t, timing, alpha) {
    let cx = x;
    for (const seg of segs) {
      if (typeof seg === 'string') {
        cx += text(seg, cx, y, size, {family: MINCHO, alpha});
        continue;
      }
      const t0 = timing[seg.key];
      const wB = measure(seg.b, size, 400, MINCHO), wA = measure(seg.a, size, 400, MINCHO);
      const strike = ease((t - t0) / 0.5);
      const note = ease((t - t0 - 0.5) / 0.4);
      const close = easeInOut((t - t0 - 1.2) / 0.7);
      const w = lerp(wB, wA, close);

      // The original wording, clipped as the gap closes.
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, y - size, w, size * 2);
      ctx.clip();
      text(seg.b, cx, y, size, {family: MINCHO, alpha: alpha * (1 - close)});
      ctx.restore();
      // Strike-through in red-brown.
      line(cx, y + 2, cx + Math.min(wB * strike, w), y + 2, C.red, 3, alpha * (1 - close));
      // The replacement written above the line, with a short leader.
      const noteSize = size * 0.6, noteY = y - size * 1.08;
      const noteA = alpha * note * (1 - close);
      line(cx + Math.min(wB, 28) / 2, y - size * 0.45, cx + Math.min(wB, 28) / 2, noteY + noteSize * 0.55, C.red, 1.5, noteA);
      text(seg.a, cx, noteY, noteSize, {family: MINCHO, weight: 700, color: C.red, alpha: noteA});
      // The replacement drops into place and keeps a red underline.
      const inA = alpha * close;
      text(seg.a, cx, y - (1 - close) * size * 0.5, size, {family: MINCHO, alpha: inA});
      line(cx, y + size * 0.66, cx + wA * ease((t - t0 - 1.7) / 0.4), y + size * 0.66, C.red, 2.5, inA);
      cx += w;
    }
    return cx - x;
  }

  function drawEdits(t) {
    const sheetA = fade(t, 8.0, 0.2) * (1 - fade(t, EDIT_B.to - 0.3, 0.3));
    if (sheetA <= 0.001) return;
    sheet(EDIT_SHEET, 1 - fade(t, EDIT_B.to - 0.3, 0.3));
    const x = EDIT_SHEET.x + 56;

    const aA = window01(t, EDIT_A.from + 0.15, EDIT_A.to, 0.4, 0.35);
    if (aA > 0.001) {
      tag(EDIT_A.label, EDIT_SHEET.x + 24, EDIT_SHEET.y + 22, {fill: C.ink, alpha: aA});
      EDIT_A.lines.forEach((segs, i) => drawEditLine(segs, x, 404 + i * 98, 46, t, EDIT_A.timing, aA));
    }

    const aB = window01(t, EDIT_B.from + 0.1, EDIT_B.to, 0.4, 0.35);
    if (aB > 0.001) {
      tag(EDIT_B.label, EDIT_SHEET.x + 24, EDIT_SHEET.y + 22, {fill: C.ink, alpha: aB});
      text(EDIT_B.lead, x, 338, 28, {family: MINCHO, color: C.soft, alpha: aB});
      EDIT_B.lines.forEach((segs, i) => drawEditLine(segs, x, 446 + i * 92, 46, t, EDIT_B.timing, aB));
    }
  }

  // Scene 3: the whole revised text, each condition linked to the words that keep it.
  const KEPT_SHEET = {x: 444, y: 248, w: 772, h: 372};
  const KEPT_TEXT = {x: 444 + 32, top: 248 + 76, width: 772 - 64, size: 27, lh: 27 * 1.95};
  const COND = {x: 64, top: 300, gap: 70, width: 340};
  const condAt = i => 16.3 + i * 1.1;

  function drawKept(t) {
    const a = window01(t, 15.6, 21.6, 0.45, 0.35);
    if (a <= 0.001) return;
    sheet(KEPT_SHEET, a);
    tag(COPY.keptHead, KEPT_SHEET.x + 24, KEPT_SHEET.y + 22, {fill: C.ink, alpha: a});
    text(COPY.condHead, COND.x, COND.top - 46, 18, {weight: 700, color: C.soft, alpha: a});
    line(COND.x, COND.top - 28, COND.x + COND.width, COND.top - 28, C.ink, 1, a);

    const lay = layout(OPERATION.output, KEPT_TEXT.width, KEPT_TEXT.size, 400, MINCHO);
    // Boxes go under the text.
    OPERATION.preserved.forEach((item, i) => {
      const k = fade(t, condAt(i) + 0.35, 0.4);
      if (k <= 0.001) return;
      const start = OPERATION.output.indexOf(item.excerpt);
      const current = 1 - fade(t, condAt(i) + 1.1, 0.4) * 0.45;
      for (const r of rangeRects(lay, KEPT_TEXT.x, KEPT_TEXT.top, KEPT_TEXT.lh, start, start + item.excerpt.length)) {
        const pad = 3 + 5 * (1 - k);
        box(r.x - pad, r.y + 4 - pad, r.w + pad * 2, r.h - 8 + pad * 2, {fill: C.kept, alpha: a * k * current});
        box(r.x - pad, r.y + 4 - pad, r.w + pad * 2, r.h - 8 + pad * 2, {stroke: C.ink, lw: 1.5, alpha: a * k * current});
      }
    });
    // The changed wording keeps its red underline from the previous scene.
    for (const part of OPERATION.changed) {
      const start = OPERATION.output.indexOf(part);
      for (const r of rangeRects(lay, KEPT_TEXT.x, KEPT_TEXT.top, KEPT_TEXT.lh, start, start + part.length)) {
        line(r.x, r.y + r.h * 0.5 + KEPT_TEXT.size * 0.64, r.x + r.w, r.y + r.h * 0.5 + KEPT_TEXT.size * 0.64, C.red, 2, a * 0.85);
      }
    }
    lay.lines.forEach((l, i) => text(l.text, KEPT_TEXT.x, KEPT_TEXT.top + KEPT_TEXT.lh * (i + 0.5), KEPT_TEXT.size, {family: MINCHO, alpha: a}));

    // The conditions, one at a time, each drawn over to its words.
    OPERATION.preserved.forEach((item, i) => {
      const k = fade(t, condAt(i), 0.4);
      if (k <= 0.001) return;
      const y = COND.top + i * COND.gap;
      const focus = 1 - fade(t, condAt(i) + 1.1, 0.4) * 0.5;
      box(COND.x, y - 2, 4, 44, {fill: C.red, alpha: a * k * focus});
      para(item.condition, COND.x + 18, y - 4 + (1 - k) * 8, COND.width - 18, 20, {weight: 700, lineHeight: 1.45, alpha: a * k * Math.max(focus, 0.75)});
      const start = OPERATION.output.indexOf(item.excerpt);
      const first = rangeRects(lay, KEPT_TEXT.x, KEPT_TEXT.top, KEPT_TEXT.lh, start, start + item.excerpt.length)[0];
      const lk = ease((t - condAt(i) - 0.2) / 0.45);
      const fromX = COND.x + COND.width + 6, fromY = y + 20;
      // Point at the start of the line that holds the words, so the connector never crosses the text.
      const toX = KEPT_TEXT.x - 12, toY = first.y + first.h / 2;
      line(fromX, fromY, lerp(fromX, toX, lk), lerp(fromY, toY, lk), C.ink, 1.5, a * (1 - fade(t, condAt(i) + 1.0, 0.4)) * 0.9);
    });
  }

  // Scene 4: a sentence that was left as it was, with its hedge and its negation marked.
  const STRENGTH = {x: 64 + 56, top: 360, size: 42, lh: 96};

  function drawStrength(t) {
    const a = window01(t, 21.6, 25.4, 0.45, 0.35);
    if (a <= 0.001) return;
    sheet(EDIT_SHEET, a);
    tag(RESEARCH.label, EDIT_SHEET.x + 24, EDIT_SHEET.y + 22, {fill: C.ink, alpha: a});
    RESEARCH.marks.forEach(mark => {
      const k = fade(t, mark.at, 0.45);
      if (k <= 0.001) return;
      const lineText = RESEARCH.lines[mark.line];
      const x = STRENGTH.x + measure(lineText.slice(0, lineText.indexOf(mark.part)), STRENGTH.size, 400, MINCHO);
      const w = measure(mark.part, STRENGTH.size, 400, MINCHO);
      const cy = STRENGTH.top + mark.line * STRENGTH.lh;
      const pad = 5 + 6 * (1 - k);
      box(x - pad, cy - STRENGTH.size * 0.7 - pad, w + pad * 2, STRENGTH.size * 1.4 + pad * 2, {fill: C.kept, alpha: a * k});
      box(x - pad, cy - STRENGTH.size * 0.7 - pad, w + pad * 2, STRENGTH.size * 1.4 + pad * 2, {stroke: C.ink, lw: 1.5, alpha: a * k});
      tag(mark.tag, x - pad, cy - STRENGTH.size * 0.7 - pad - 34, {alpha: a * k});
    });
    RESEARCH.lines.forEach((str, i) => text(str, STRENGTH.x, STRENGTH.top + i * STRENGTH.lh, STRENGTH.size, {family: MINCHO, alpha: a}));

    const nk = fade(t, 23.7, 0.45);
    if (nk > 0.001) {
      const y = 548;
      line(STRENGTH.x, y - 26, EDIT_SHEET.x + EDIT_SHEET.w - 56, y - 26, C.rule, 1, a * nk);
      let x = STRENGTH.x + text(COPY.numbersTag, STRENGTH.x, y, 18, {weight: 700, color: C.soft, alpha: a * nk}) + 20;
      for (const n of RESEARCH.numbers) {
        const w = measure(n, 24, 400, MINCHO) + 24;
        box(x, y - 20, w, 40, {stroke: C.ink, lw: 1.5, alpha: a * nk});
        text(n, x + 12, y, 24, {family: MINCHO, alpha: a * nk});
        x += w + 14;
      }
    }
  }

  function drawEnd(t) {
    const a = fade(t, 25.5, 0.5);
    if (a <= 0.001) return;
    const dy = (1 - a) * 14;
    text(COPY.endField, 64, 150 + dy, 22, {weight: 700, alpha: a});
    box(64, 176 + dy, 140 * ease((t - 25.8) / 0.5), 5, {fill: C.red, alpha: a});
    COPY.endTitle.forEach((str, i) => text(str, 64, 262 + i * 80 + dy, 60, {family: MINCHO, weight: 700, alpha: a}));
    para(COPY.endSub, 64, 400 + dy, 820, 22, {color: C.soft, lineHeight: 1.7, alpha: a * fade(t, 26.0, 0.5)});
  }

  function drawChapters(t) {
    const x0 = 64, w = STAGE.w - 128, y = 668;
    const current = beatAt(t);
    line(x0, y, x0 + w, y, C.ink, 1, 0.25);
    box(x0, y - 1.5, w * t / D, 3, {fill: C.red});
    for (let i = 0; i < COPY.chapters.length; i++) {
      const bx = x0 + w * BEATS[i] / D;
      line(bx, y - 8, bx, y + 8, C.ink, 1, 0.6);
      text(COPY.chapters[i], bx + 8, y + 24, 17, {weight: i === current ? 700 : 400, color: i === current ? C.ink : C.soft});
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
    ctx.lineCap = 'butt';
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    const s = Math.min(W / STAGE.w, H / STAGE.h);
    ctx.setTransform(s, 0, 0, s, (W - STAGE.w * s) / 2, (H - STAGE.h * s) / 2);

    drawHeader(t);
    drawTitle(t);
    drawCaption(t);
    drawHandOver(t);
    drawCarry(t);
    drawEdits(t);
    drawKept(t);
    drawStrength(t);
    drawEnd(t);
    drawChapters(t);
    ctx.globalAlpha = 1;
    return {time: t, beat: beatAt(t)};
  };

  window.seek(0);
})();
