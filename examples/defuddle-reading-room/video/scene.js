/* Defuddle の本文抽出 — original Studio Yebisu composition (MIT). Canvas only, no screenshots, no sound.
   Contract (Motion Reel): window.seek(seconds) rebuilds the complete frame from t alone.
   The page diagram is drawn from the fictional input HTML in ../samples.json. The title, author, options and
   every Markdown line are read from ../extraction-results.json, the saved real output. Which phrases remain or
   are absent is recomputed from that content here, so a phrase that did not survive is drawn as such.
   Without extraction-results.json the film is not drawn and motionReady rejects. */
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

  const D = 28;
  // The composition is laid out on a 1280x720 stage and scaled to the render size.
  const STAGE = {w: 1280, h: 720};
  const FOCUS = 'reading';
  // Title / what is mixed in / handing it over / the Markdown / what remains / into a note.
  const BEATS = [0, 3.2, 8.6, 12.4, 18.8, 23.6, 28];

  const C = {paper: '#f4f1e8', sheet: '#fdfcf8', ink: '#1e2422', soft: '#575e5a', rule: '#d5cfc0', line: '#e7e2d5', indigo: '#2b4a78', indigoSoft: '#e2e7ef', tint: '#ebe7dc'};
  const GOTHIC = '"Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, "Noto Sans JP", sans-serif';
  const MINCHO = '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "BIZ UDPMincho", "Noto Serif JP", serif';
  const MONO = '"BIZ UDGothic", "Cascadia Mono", Consolas, "Noto Sans Mono CJK JP", monospace';

  /* ---------- Data: the saved real output, never a stand-in ---------- */

  let data = null;
  let loadError = null;

  function loadJson(path) {
    return fetch(path, {cache: 'no-cache'}).then(response => {
      if (!response.ok) throw new Error(path + ' を読み込めませんでした（' + response.status + '）');
      return response.json();
    });
  }

  function prepare(samplesJson, resultsJson) {
    const sample = ((samplesJson && samplesJson.samples) || []).find(s => s.id === FOCUS);
    const result = ((resultsJson && resultsJson.results) || []).find(r => r.id === FOCUS);
    if (!sample || typeof sample.input !== 'string') throw new Error('../samples.json に ' + FOCUS + ' の入力がありません');
    if (!result || typeof result.content !== 'string' || !result.content.trim()) throw new Error('../extraction-results.json に ' + FOCUS + ' の content がありません');

    const content = result.content;
    const doc = new DOMParser().parseFromString(sample.input, 'text/html');
    const textOf = n => (n ? n.textContent : '').replace(/\s+/g, ' ').trim();
    const describe = n => {
      if (!n) return '';
      const cls = n.getAttribute('class');
      return '<' + n.tagName.toLowerCase() + (cls ? ' class="' + cls + '"' : '') + '>';
    };
    // In document order an element that also holds the phrase after the current one is its descendant,
    // so the last match is the innermost element.
    const innermost = phrase => {
      let found = null;
      for (const n of doc.body.querySelectorAll('*')) if (n.textContent.includes(phrase)) found = n;
      return found;
    };

    const article = doc.querySelector('article');
    const nav = doc.querySelector('nav');
    const header = doc.querySelector('header');
    const site = textOf(header && header.querySelector('p'));
    const links = nav ? [...nav.querySelectorAll('a')].map(textOf).filter(Boolean) : [];
    const headerWords = [site, ...links].filter(Boolean);

    // The order of removed[] in samples.json is ad, sidebar, footer.
    const regions = sample.removed.map(phrase => {
      const holder = innermost(phrase);
      const region = holder ? holder.closest('aside, footer, nav, header, section') || holder : null;
      return {
        phrase,
        tag: describe(region),
        text: textOf(holder),
        heading: textOf(region && region.querySelector('h2, h3')),
        links: region ? [...region.querySelectorAll('li')].map(textOf) : [],
        ok: !content.includes(phrase)
      };
    });

    const lines = content.split('\n');
    const kept = sample.kept.map(text => ({text, ok: content.includes(text), line: (lines.find(l => l.includes(text)) || '').trim()}));
    const options = resultsJson.options && typeof resultsJson.options === 'object' ? resultsJson.options : {};

    return {
      url: sample.url,
      content,
      lines,
      kept,
      regions,
      header: {tag: describe(header), site, links, ok: headerWords.length > 0 && headerWords.every(w => !content.includes(w))},
      article: {
        tag: describe(article),
        h1: textOf(article && article.querySelector('h1')),
        paras: article ? [...article.querySelectorAll('p')].map(textOf) : [],
        items: article ? [...article.querySelectorAll('li')].map(textOf) : []
      },
      title: typeof result.title === 'string' ? result.title : '',
      author: typeof result.author === 'string' ? result.author : '',
      engine: String(resultsJson.engine || ''),
      commit: String(resultsJson.commit || '').slice(0, 7),
      options: ['markdown', 'useAsync', 'removeImages'].map(key => key + ': ' + (key in options ? JSON.stringify(options[key]) : '（記録なし）')),
      keptAll: kept.every(k => k.ok),
      removedAll: regions.every(r => r.ok),
      memo: [...new Set(kept.filter(k => k.ok && k.line).map(k => k.line))]
    };
  }

  window.motionReady = Promise.all([document.fonts.ready, loadJson('../samples.json'), loadJson('../extraction-results.json')])
    .then(([, samplesJson, resultsJson]) => {
      data = prepare(samplesJson, resultsJson);
      window.seek(window.__lastSeek || 0);
    })
    .catch(error => {
      loadError = error && error.message ? error.message : String(error);
      window.seek(window.__lastSeek || 0);
      throw error;
    });

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
  // Shortens a string with an ellipsis so it fits; used only for one-line labels and context lines.
  function fit(str, maxWidth, size, weight = 400, family = GOTHIC) {
    str = String(str);
    if (measure(str, size, weight, family) <= maxWidth) return str;
    let n = str.length;
    while (n > 0 && measure(str.slice(0, n) + '…', size, weight, family) > maxWidth) n--;
    return str.slice(0, n) + '…';
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
    return lines;
  }
  function para(str, x, top, maxWidth, size, o = {}) {
    let lines = layout(str, maxWidth, size, o.weight || 400, o.family || GOTHIC);
    if (o.maxLines && lines.length > o.maxLines) {
      lines = lines.slice(0, o.maxLines);
      const last = lines[lines.length - 1];
      last.text = fit(last.text + '…', maxWidth, size, o.weight || 400, o.family || GOTHIC);
    }
    const lh = size * (o.lineHeight || 1.6);
    lines.forEach((l, i) => text(l.text, x, top + lh * (i + 0.5), size, o));
    return lines.length * lh;
  }
  function box(x, y, w, h, o = {}) {
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(x, y, w, h); }
    if (o.stroke) {
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = o.lw || 1;
      ctx.setLineDash(o.dash || []);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
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
  function chip(label, x, y, o = {}) {
    const size = o.size || 15;
    const family = o.family || GOTHIC;
    const w = measure(label, size, 700, family) + 16;
    const h = size + 11;
    const left = o.align === 'right' ? x - w : x;
    box(left, y, w, h, {fill: o.fill || C.ink, alpha: o.alpha});
    if (o.dash) box(left, y, w, h, {stroke: o.fill === C.sheet ? C.ink : C.sheet, lw: 1.5, dash: o.dash, alpha: o.alpha});
    text(label, left + 8, y + h / 2, size, {weight: 700, family, color: o.color || C.sheet, alpha: o.alpha});
    return w;
  }
  function sheet(r, alpha, stroke = C.rule) {
    box(r.x, r.y, r.w, r.h, {fill: C.sheet, alpha});
    box(r.x, r.y, r.w, r.h, {stroke, lw: 1.5, alpha});
  }
  function clipTo(r, draw) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    draw();
    ctx.restore();
  }

  /* ---------- Copy ---------- */

  const COPY = {
    head: 'Defuddle の作例',
    field: '調査・情報収集 / Studio Yebisu',
    name: 'Defuddle',
    title: 'Webページから、本文だけを取り出す',
    lead: '記事の本文・タイトル・著者を見つけ、ナビや広告を外して、HTMLやMarkdownで返すライブラリ。',
    origin: d => 'kepano/defuddle　v0.19.5（commit ' + (d.commit || '記録なし') + '）　MIT License　この動画の記事はすべて架空です',
    captions: d => [
      {from: 3.2, to: 8.6, n: 1, title: '記事のHTMLには、本文以外も混ざる', sub: '図：架空の記事 reading.html の構造を描いたものです。ブラウザー画面の撮影ではありません。'},
      {from: 8.6, to: 12.4, n: 2, title: 'Defuddleに渡す', sub: '固定コミットのDefuddleを右のオプションで実行し、出力を extraction-results.json に保存しています。'},
      {from: 12.4, to: 18.8, n: 3, title: '返ってきたMarkdown', sub: 'extraction-results.json の content を、文字を変えずに引用しています。'},
      {from: 18.8, to: 23.6, n: 4,
        title: d.keptAll ? '日時や定員が、Markdownに残る' : 'Markdownに残らなかった条件がある',
        sub: '語句が文字どおり含まれるかを、保存した content で調べた結果です。'},
      {from: 23.6, to: 28, n: 5, title: 'コピーして、読書メモへ', sub: 'Markdownにすると、色や配置は残りません。残るのは見出し・段落・リストです。'}
    ],
    outHead: '本文の外にある文言',
    articleNote: '本文',
    optionsHead: '記録したオプション',
    mdTag: 'extraction-results.json　reading の content',
    keptPass: 'Markdownに残っている',
    keptFail: '見つからない',
    removedHead: '本文の外の文言',
    removedPass: '含まれない',
    removedFail: '含まれている',
    copyButton: 'Markdownをコピー',
    memoTag: '図：コピーしたMarkdownの一部を、読書メモに貼った例',
    memoTitle: '読書メモ',
    endLine: '作例のページでは、架空の3つの記事を、同梱のDefuddleでその場で取り出せます。',
    chapters: ['Defuddle', '混ざる', '渡す', '取り出す', '残る', 'メモへ']
  };

  /* ---------- Scene parts ---------- */

  function drawHeader(t) {
    const a = fade(t, 3.0, 0.5);
    if (a <= 0.001) return;
    text(COPY.head, 64, 40, 20, {weight: 700, alpha: a});
    text(COPY.field, STAGE.w - 64, 40, 18, {align: 'right', color: C.soft, alpha: a});
    line(64, 64, STAGE.w - 64, 64, C.ink, 1, a);
  }

  function drawTitle(t, d) {
    const a = 1 - fade(t, 3.0, 0.4);
    if (a <= 0.001) return;
    const rise = k => (1 - k) * 16;
    const k1 = fade(t, 0.15, 0.55), k2 = fade(t, 0.7, 0.55), k3 = fade(t, 1.4, 0.55);
    text(COPY.name, 64, 206 + rise(k1), 104, {weight: 700, alpha: a * k1});
    const titleY = 326 + rise(k2);
    const tw = text(COPY.title, 64, titleY, 54, {family: MINCHO, weight: 700, alpha: a * k2});
    // An underline drawn under the title like a reader's pencil mark.
    line(64, titleY + 40, 64 + tw * ease((t - 1.1) / 0.6), titleY + 40, C.indigo, 4, a);
    para(COPY.lead, 64, 396 + rise(k3), 1060, 24, {color: C.soft, alpha: a * k3});
    text(COPY.origin(d), 64, 486 + rise(k3), 19, {color: C.soft, alpha: a * k3});
  }

  function drawCaption(t, d) {
    for (const c of COPY.captions(d)) {
      const a = window01(t, c.from + 0.1, c.to + (c.to >= D ? 1 : 0), 0.45, 0.3);
      if (a <= 0.001) continue;
      const dy = (1 - a) * 10;
      const numW = text(String(c.n), 64, 124 + dy, 64, {family: MINCHO, weight: 700, color: C.indigo, alpha: a});
      text(c.title, 64 + numW + 20, 128 + dy, 34, {weight: 700, alpha: a});
      text(fit(c.sub, STAGE.w - 128, 20), 64, 186 + dy, 20, {color: C.soft, alpha: a});
    }
  }

  // Scene 1–2: a diagram of the input page, in its own 720x384 coordinates.
  const PAGE = {w: 720, h: 384};
  const R = {
    header: {x: 0, y: 0, w: 720, h: 56},
    ad: {x: 16, y: 70, w: 688, h: 46},
    article: {x: 16, y: 132, w: 468, h: 194},
    sidebar: {x: 500, y: 132, w: 204, h: 194},
    footer: {x: 0, y: 338, w: 720, h: 46}
  };
  const pagePlace = t => {
    const k = easeInOut((t - 8.7) / 0.7);
    return {x: 64, y: lerp(240, 300, k), s: lerp(1, 0.66, k)};
  };
  const toGlobal = (p, r) => ({x: p.x + r.x * p.s, y: p.y + r.y * p.s, w: r.w * p.s, h: r.h * p.s});

  // How far a region outside the article has faded after extraction; only when the saved content lacks its words.
  const removal = t => ease((t - 10.2) / 0.7);

  // o.tagSize is in page coordinates, enlarged while the page is scaled down so the tag stays legible.
  function drawRegion(r, alpha, o) {
    if (alpha <= 0.001) return;
    box(r.x, r.y, r.w, r.h, {fill: C.sheet, alpha});
    if (o.tint > 0.001) box(r.x, r.y, r.w, r.h, {fill: C.tint, alpha: alpha * o.tint});
    box(r.x, r.y, r.w, r.h, {stroke: o.stroke || C.rule, lw: 1.5, dash: o.dash, alpha});
    clipTo(r, () => o.body(alpha));
    if (o.out > 0.001) line(r.x + 8, r.y + r.h / 2, r.x + 8 + (r.w - 16) * o.out, r.y + r.h / 2, C.ink, 2, Math.min(1, alpha * 3));
    if (o.tag) chip(o.tag, r.x + 10, r.y - (o.tagSize + 11) / 2, {family: MONO, size: o.tagSize, fill: o.tagFill || C.ink, alpha: o.tagA === undefined ? alpha : o.tagA});
  }

  function drawPage(t, d) {
    const a = fade(t, 3.3, 0.4);
    const articleA = a * (1 - fade(t, 11.3, 0.25));
    const othersA = a * (1 - fade(t, 11.2, 0.4));
    if (articleA <= 0.001 && othersA <= 0.001) return;
    const p = pagePlace(t);
    const reveal = i => fade(t, 3.6 + i * 0.3, 0.4);
    const tint = fade(t, 5.6, 0.5);
    const out = removal(t);
    const tagSize = 13 / Math.max(p.s, 0.8);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.s, p.s);
    box(0, 0, PAGE.w, PAGE.h, {fill: C.sheet, alpha: othersA});
    box(0, 0, PAGE.w, PAGE.h, {stroke: C.ink, lw: 1.5, alpha: othersA});

    // A region outside the article fades and is struck through only if the saved content lacks its words.
    const outside = (ok, i) => {
      const gone = ok ? out : 0;
      const base = othersA * reveal(i);
      return {alpha: base * (1 - 0.8 * gone), tagA: base * (1 - 0.55 * gone), tint, out: gone, tagSize};
    };

    const h = outside(d.header.ok, 0);
    drawRegion(R.header, h.alpha, {
      ...h, tag: d.header.tag,
      body: al => {
        text(d.header.site, R.header.x + 18, R.header.y + 30, 17, {weight: 700, alpha: al});
        let x = R.header.x + R.header.w - 18;
        for (let i = d.header.links.length - 1; i >= 0; i--) {
          const w = measure(d.header.links[i], 15);
          x -= w;
          text(d.header.links[i], x, R.header.y + 30, 15, {color: C.soft, alpha: al});
          line(x, R.header.y + 41, x + w, R.header.y + 41, C.soft, 1, al);
          x -= 18;
        }
      }
    });

    const [adData, sideData, footData] = d.regions;
    if (adData) {
      const o = outside(adData.ok, 1);
      drawRegion(R.ad, o.alpha, {
        ...o, dash: [6, 4], tag: adData.tag,
        body: al => text(adData.text, R.ad.x + 16, R.ad.y + R.ad.h / 2 + 2, 15, {color: C.soft, alpha: al})
      });
    }

    const ar = R.article;
    drawRegion(ar, articleA * reveal(2), {
      stroke: C.indigo, tag: d.article.tag, tagFill: C.indigo, tagSize,
      body: al => {
        text(d.article.h1, ar.x + 16, ar.y + 34, 22, {family: MINCHO, weight: 700, alpha: al});
        const used = para(d.article.paras[0] || '', ar.x + 16, ar.y + 56, ar.w - 32, 15, {lineHeight: 1.6, maxLines: 2, alpha: al});
        d.article.items.slice(0, 4).forEach((item, i) => text('・' + item, ar.x + 16, ar.y + 56 + used + 14 + i * 21, 14, {color: C.soft, alpha: al}));
      }
    });

    if (sideData) {
      const o = outside(sideData.ok, 3);
      const sr = R.sidebar;
      drawRegion(sr, o.alpha, {
        ...o, tag: sideData.tag,
        body: al => {
          text(sideData.heading, sr.x + 14, sr.y + 34, 15, {weight: 700, alpha: al});
          const used = para(sideData.text, sr.x + 14, sr.y + 50, sr.w - 28, 14, {lineHeight: 1.55, maxLines: 4, color: C.soft, alpha: al});
          sideData.links.slice(0, 2).forEach((item, i) => text(fit(item, sr.w - 28, 13), sr.x + 14, sr.y + 50 + used + 14 + i * 20, 13, {color: C.soft, alpha: al}));
        }
      });
    }

    if (footData) {
      const o = outside(footData.ok, 4);
      drawRegion(R.footer, o.alpha, {
        ...o, tag: footData.tag,
        body: al => text(footData.text, R.footer.x + 18, R.footer.y + R.footer.h / 2 + 2, 15, {color: C.soft, alpha: al})
      });
    }
    ctx.restore();
  }

  // Scene 1, right: the three phrases outside the article, quoted from the input.
  function drawOutsideList(t, d) {
    const a = window01(t, 5.8, 8.75, 0.4, 0.3);
    if (a <= 0.001) return;
    const x = 836;
    text(COPY.outHead, x, 258, 18, {weight: 700, color: C.soft, alpha: a});
    line(x, 276, STAGE.w - 64, 276, C.ink, 1, a);
    d.regions.forEach((r, i) => {
      const k = fade(t, 6.0 + i * 0.4, 0.4);
      const y = 304 + i * 92 + (1 - k) * 8;
      chip(r.tag, x, y, {family: MONO, size: 13, alpha: a * k});
      text(fit('「' + r.phrase + '」', STAGE.w - 64 - x, 26, 700, MINCHO), x, y + 52, 26, {family: MINCHO, weight: 700, alpha: a * k});
    });
    const k = fade(t, 7.4, 0.4);
    const y = 304 + 3 * 92;
    const cw = chip(d.article.tag, x, y - 4, {family: MONO, size: 13, fill: C.indigo, alpha: a * k});
    text(fit(COPY.articleNote + '：「' + d.article.h1 + '」', STAGE.w - 64 - x - cw - 12, 18, 700), x + cw + 12, y + 9, 18, {weight: 700, color: C.indigo, alpha: a * k});
  }

  // Scene 2: the recorded options, and an arrow from the page into Defuddle.
  const HUB = {x: 620, y: 270, w: 596, h: 254};

  function drawHub(t, d) {
    const a = window01(t, 8.9, 11.6, 0.4, 0.35);
    if (a <= 0.001) return;
    sheet(HUB, a, C.ink);
    const nameW = text(fit(d.engine || 'Defuddle', 300, 30, 700), HUB.x + 28, HUB.y + 42, 30, {weight: 700, alpha: a});
    text('commit ' + (d.commit || '（記録なし）'), HUB.x + 28 + nameW + 20, HUB.y + 44, 15, {family: MONO, color: C.soft, alpha: a});
    line(HUB.x + 28, HUB.y + 70, HUB.x + HUB.w - 28, HUB.y + 70, C.rule, 1, a);
    text(COPY.optionsHead, HUB.x + 28, HUB.y + 94, 16, {weight: 700, color: C.soft, alpha: a});
    const rows = ["url: '" + d.url + "'", ...d.options];
    rows.forEach((row, i) => {
      const k = fade(t, 9.2 + i * 0.14, 0.3);
      text(fit(row, HUB.w - 56, 22, 400, MONO), HUB.x + 28, HUB.y + 128 + i * 32, 22, {family: MONO, alpha: a * k});
    });
    // Arrow from the page diagram to the box.
    const p = pagePlace(t);
    const fromX = p.x + PAGE.w * p.s + 14, y = p.y + PAGE.h * p.s / 2;
    const k = ease((t - 9.7) / 0.4);
    const toX = lerp(fromX, HUB.x - 14, k);
    line(fromX, y, toX, y, C.ink, 2, a);
    if (k > 0.98) {
      ctx.globalAlpha = a;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.moveTo(HUB.x - 6, y);
      ctx.lineTo(HUB.x - 18, y - 7);
      ctx.lineTo(HUB.x - 18, y + 7);
      ctx.closePath();
      ctx.fill();
    }
  }

  // The article block opens into the Markdown sheet.
  const MD = {x: 64, y: 226, w: 1152, h: 414};

  function drawCarry(t) {
    if (t < 11.35 || t > 12.5) return;
    const from = toGlobal(pagePlace(t), R.article);
    const r = lerpRect(from, MD, easeInOut((t - 11.4) / 0.85));
    sheet(r, 1, C.indigo);
  }

  // Scene 3: the saved Markdown, at a readable size, scrolled through from top to end.
  const MDT = {x: MD.x + 60, top: MD.y + 66, width: MD.w - 60 - 44, size: 23, lh: 40};
  const MD_VIEW = {x: MD.x + 1, y: MD.y + 52, w: MD.w - 2, h: MD.h - 60};

  function markdownRows(d) {
    if (d.rows) return d.rows;
    const rows = [];
    let y = 0;
    d.lines.forEach((src, i) => {
      if (!src.trim()) { y += MDT.lh * 0.45; return; }
      const weight = /^#{1,6}\s/.test(src) ? 700 : 400;
      for (const l of layout(src, MDT.width, MDT.size, weight)) {
        rows.push({text: l.text, start: l.start, src: i, y, weight});
        y += MDT.lh;
      }
    });
    d.rows = rows;
    d.rowsHeight = y;
    return rows;
  }

  function keptRects(d, rows, phrase) {
    const src = d.lines.findIndex(l => l.includes(phrase));
    if (src < 0) return [];
    const start = d.lines[src].indexOf(phrase), end = start + phrase.length;
    const rects = [];
    for (const row of rows) {
      if (row.src !== src) continue;
      const s = Math.max(start, row.start), e = Math.min(end, row.start + row.text.length);
      if (s >= e) continue;
      const x0 = measure(row.text.slice(0, s - row.start), MDT.size, row.weight);
      const w = measure(row.text.slice(s - row.start, e - row.start), MDT.size, row.weight);
      rects.push({x: x0, y: row.y, w});
    }
    return rects;
  }

  function drawMarkdown(t, d) {
    const a = t < 12.3 ? 0 : 1 - fade(t, 18.45, 0.35);
    if (a <= 0.001) return;
    const textA = a * fade(t, 12.4, 0.4);
    sheet(MD, a, C.indigo);
    chip(COPY.mdTag, MD.x + 20, MD.y + 16, {family: MONO, size: 14, fill: C.indigo, alpha: textA});
    const meta = 'title：' + (d.title || '（空）') + '　author：' + (d.author || '（空）');
    text(fit(meta, 560, 17), MD.x + MD.w - 24, MD.y + 30, 17, {align: 'right', color: C.soft, alpha: textA});

    const rows = markdownRows(d);
    const maxScroll = Math.max(0, d.rowsHeight - (MD_VIEW.h - (MDT.top - MD_VIEW.y)) + 12);
    const scroll = maxScroll * easeInOut((t - 13.8) / 4.5);
    clipTo(MD_VIEW, () => {
      // A ruled line under every row, and the margin line of a notebook page.
      for (const row of rows) {
        const y = MDT.top + row.y - scroll + MDT.lh;
        if (y > MD_VIEW.y && y < MD.y + MD.h) line(MD.x + 1, y, MD.x + MD.w - 1, y, C.line, 1, a);
      }
      line(MD.x + 40, MD.y + 52, MD.x + 40, MD.y + MD.h, C.indigo, 1, a * 0.6);
      d.kept.forEach((k, i) => {
        if (!k.ok) return;
        const hk = fade(t, 13.0 + i * 0.25, 0.4);
        for (const r of keptRects(d, rows, k.text)) {
          const y = MDT.top + r.y - scroll;
          box(MDT.x + r.x - 3, y + 4, r.w + 6, MDT.lh - 8, {fill: C.indigoSoft, alpha: textA * hk});
          line(MDT.x + r.x - 3, y + MDT.lh - 5, MDT.x + r.x + r.w + 3, y + MDT.lh - 5, C.indigo, 2, textA * hk);
        }
      });
      for (const row of rows) {
        const y = MDT.top + row.y - scroll;
        if (y < MD_VIEW.y - MDT.lh || y > MD.y + MD.h) continue;
        text(row.text, MDT.x, y + MDT.lh / 2, MDT.size, {weight: row.weight, alpha: textA});
      }
    });
    // Where in the whole content the view is.
    if (maxScroll > 0) {
      const trackY = MD_VIEW.y + 8, trackH = MD_VIEW.h - 16, viewH = MD_VIEW.h - (MDT.top - MD_VIEW.y);
      const thumbH = Math.max(28, trackH * viewH / (viewH + maxScroll));
      box(MD.x + MD.w - 14, trackY, 4, trackH, {fill: C.line, alpha: textA});
      box(MD.x + MD.w - 14, trackY + (trackH - thumbH) * (scroll / maxScroll), 4, thumbH, {fill: C.indigo, alpha: textA});
    }
  }

  // Scene 4: each condition at full size, with the Markdown line that holds it.
  function drawKept(t, d) {
    const a = window01(t, 18.8, 23.6, 0.4, 0.35);
    if (a <= 0.001) return;
    const cardW = (STAGE.w - 128 - 24) / 2, cardH = 124;
    d.kept.slice(0, 4).forEach((k, i) => {
      const ka = a * fade(t, 19.1 + i * 0.35, 0.4);
      if (ka <= 0.001) return;
      const x = 64 + (i % 2) * (cardW + 24), y = 236 + Math.floor(i / 2) * (cardH + 18) + (1 - ka / a) * 10;
      sheet({x, y, w: cardW, h: cardH}, ka, k.ok ? C.indigo : C.ink);
      if (k.ok) box(x, y, 6, cardH, {fill: C.indigo, alpha: ka});
      else box(x + 3, y + 3, cardW - 6, cardH - 6, {stroke: C.ink, lw: 1.5, dash: [6, 4], alpha: ka});
      chip(k.ok ? COPY.keptPass : COPY.keptFail, x + cardW - 18, y + 16, {align: 'right', size: 15, fill: k.ok ? C.indigo : C.ink, alpha: ka});
      let size = 38;
      while (size > 24 && measure(k.text, size, 700, MINCHO) > cardW - 60) size -= 2;
      text(k.text, x + 28, y + 64, size, {family: MINCHO, weight: 700, alpha: ka});
      const context = k.ok ? 'Markdownの行：' + k.line : 'この語句は、保存した content にありません。';
      text(fit(context, cardW - 56, 17), x + 28, y + 104, 17, {color: C.soft, alpha: ka});
    });

    const ra = a * fade(t, 21.0, 0.4);
    if (ra <= 0.001) return;
    const y = 548 + Math.max(0, Math.ceil(Math.min(d.kept.length, 4) / 2) - 2) * 142;
    text(COPY.removedHead, 64, y + 16, 17, {weight: 700, color: C.soft, alpha: ra});
    let x = 64 + measure(COPY.removedHead, 17, 700) + 28;
    let rowY = y;
    d.regions.forEach((r, i) => {
      const k = ra * fade(t, 21.2 + i * 0.25, 0.35);
      const quote = '「' + r.phrase + '」';
      const verdict = r.ok ? COPY.removedPass : COPY.removedFail;
      const w = measure(quote, 21, 400, MINCHO) + 8 + measure(verdict, 14, 700) + 16;
      if (x + w > STAGE.w - 64) { x = 64 + measure(COPY.removedHead, 17, 700) + 28; rowY += 40; }
      text(quote, x, rowY + 16, 21, {family: MINCHO, alpha: k});
      chip(verdict, x + measure(quote, 21, 400, MINCHO) + 8, rowY + 4, {size: 14, fill: r.ok ? C.sheet : C.ink, color: r.ok ? C.ink : C.sheet, dash: r.ok ? [3, 2] : null, alpha: k});
      x += w + 26;
    });
  }

  // Scene 5: copy, paste into a reading note.
  const BUTTON = {x: 64, y: 268, w: 290, h: 60};
  const MEMO = {x: 400, y: 236, w: 816, h: 352};

  function drawMemo(t, d) {
    const a = fade(t, 23.6, 0.4);
    if (a <= 0.001) return;
    const press = fade(t, 24.1, 0.15) * (1 - fade(t, 24.45, 0.2));
    box(BUTTON.x, BUTTON.y, BUTTON.w, BUTTON.h, {fill: press > 0.5 ? C.indigo : C.ink, alpha: a});
    text(COPY.copyButton, BUTTON.x + BUTTON.w / 2, BUTTON.y + BUTTON.h / 2, 22, {align: 'center', weight: 700, color: C.sheet, alpha: a});
    para('コピーされるのは content の全文です。右の読書メモには、条件を含む行だけを貼りました。', BUTTON.x, BUTTON.y + BUTTON.h + 24, BUTTON.w, 17, {lineHeight: 1.7, color: C.soft, alpha: a * fade(t, 24.3, 0.4)});

    const ma = a * fade(t, 24.3, 0.4);
    if (ma <= 0.001) return;
    sheet(MEMO, ma, C.ink);
    const lineY0 = MEMO.y + 110, lh = 52;
    for (let y = lineY0 + lh; y < MEMO.y + MEMO.h; y += lh) line(MEMO.x + 1, y, MEMO.x + MEMO.w - 1, y, C.line, 1, ma);
    line(MEMO.x + 40, MEMO.y + 1, MEMO.x + 40, MEMO.y + MEMO.h - 1, C.indigo, 1, ma * 0.6);
    text(COPY.memoTitle, MEMO.x + 60, MEMO.y + 44, 30, {family: MINCHO, weight: 700, alpha: ma});
    text(fit('出典 ' + d.url, 360, 15, 400, MONO), MEMO.x + MEMO.w - 24, MEMO.y + 46, 15, {align: 'right', family: MONO, color: C.soft, alpha: ma});
    text(COPY.memoTag, MEMO.x + 60, MEMO.y + 84, 15, {color: C.soft, alpha: ma});
    d.memo.slice(0, 4).forEach((str, i) => {
      const k = ma * fade(t, 24.7 + i * 0.3, 0.35);
      if (k <= 0.001) return;
      const y = lineY0 + i * lh + lh / 2 + (1 - k / ma) * 6;
      const shown = fit(str, MEMO.w - 100, 25);
      text(shown, MEMO.x + 60, y, 25, {alpha: k});
      // Underline the condition inside the pasted line.
      const kept = d.kept.find(item => item.ok && shown.includes(item.text));
      if (kept) {
        const x0 = MEMO.x + 60 + measure(shown.slice(0, shown.indexOf(kept.text)), 25);
        line(x0, y + 17, x0 + measure(kept.text, 25), y + 17, C.indigo, 2.5, k * fade(t, 25.0 + i * 0.3, 0.3));
      }
    });
    text(COPY.endLine, 64, 622, 21, {weight: 700, alpha: a * fade(t, 25.9, 0.5)});
  }

  function drawChapters(t) {
    const x0 = 64, w = STAGE.w - 128, y = 668;
    const current = beatAt(t);
    line(x0, y, x0 + w, y, C.ink, 1, 0.25);
    box(x0, y - 1.5, w * t / D, 3, {fill: C.indigo});
    for (let i = 0; i < COPY.chapters.length; i++) {
      const bx = x0 + w * BEATS[i] / D;
      line(bx, y - 8, bx, y + 8, C.ink, 1, 0.6);
      text(COPY.chapters[i], bx + 8, y + 24, 17, {weight: i === current ? 700 : 400, color: i === current ? C.ink : C.soft});
    }
  }

  // Shown instead of the film until the saved output is available. Nothing is drawn as if it had run.
  function drawWaiting() {
    text('Defuddle の作例　解説動画', 64, 200, 30, {weight: 700});
    if (loadError) {
      para('保存した実出力（../extraction-results.json）と入力（../samples.json）を読めないため、この動画は描きません。', 64, 260, 1100, 24, {lineHeight: 1.7});
      text(fit(loadError, 1150, 18, 400, MONO), 64, 360, 18, {family: MONO, color: C.soft});
    } else {
      text('入力と保存した実出力を読み込んでいます。', 64, 270, 24, {color: C.soft});
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

    if (!data) {
      drawWaiting();
      ctx.globalAlpha = 1;
      return {time: t, ready: false};
    }
    drawHeader(t);
    drawTitle(t, data);
    drawCaption(t, data);
    drawPage(t, data);
    drawOutsideList(t, data);
    drawHub(t, data);
    drawCarry(t);
    drawMarkdown(t, data);
    drawKept(t, data);
    drawMemo(t, data);
    drawChapters(t);
    ctx.globalAlpha = 1;
    return {time: t, beat: beatAt(t), ready: true};
  };

  window.seek(0);
})();
