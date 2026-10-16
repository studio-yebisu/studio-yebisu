/* しおり工房 検索ヘルプ — 28秒の無音解説（編集できる元ページ）
 * Canvas 2D で、指定された時刻 t の完成画面を毎回最初から描く。
 * 使うのは実画面のキャプチャ4枚と、実際の入力・操作記録・保存JSONだけ。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */
(() => {
  'use strict';

  // ---- 書き出し条件 -------------------------------------------------------
  const RENDER = window.__MOTION_RENDER__ === true;
  const DURATION = 28;
  const LW = 1280, LH = 720; // 論理座標。実際の大きさへは等倍率で収める
  const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
  const evenSize = (v, fallback) => (Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0 ? v : fallback);
  const WIDTH = evenSize(given.width, 1280);
  const HEIGHT = evenSize(given.height, 720);
  const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
  window.motionConfig = {duration: DURATION, fps: FPS, width: WIDTH, height: HEIGHT, posterTime: 12, audioEvents: []};

  const root = document.documentElement;
  if (RENDER) root.classList.add('is-render');
  const canvas = document.getElementById('film');
  const ctx = canvas.getContext('2d');
  const density = RENDER ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.round(WIDTH * density);
  canvas.height = Math.round(HEIGHT * density);
  canvas.style.aspectRatio = WIDTH + ' / ' + HEIGHT;
  if (RENDER) {
    canvas.style.width = WIDTH + 'px';
    canvas.style.height = HEIGHT + 'px';
  }

  // ---- 見た目（実際の画面と同じ紙・墨・すみれ色） ---------------------------
  const C = {
    paper: '#f7f3ec', card: '#fffdf8', ink: '#221f2a', muted: '#5f5869', line: '#e2d9cb',
    plum: '#574684', plumSoft: '#ece6f6', plumLine: '#cbbfe3',
    night: '#221f2a', nightText: '#f7f3ec', nightValue: '#d5cbf4', nightMuted: '#bdb6c8'
  };
  const SANS = '"Noto Sans JP", "Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Meiryo", sans-serif';
  const MONO = '"Cascadia Mono", "Consolas", "BIZ UDGothic", "MS Gothic", monospace';

  // ---- 素材：凍結した記録（frozen-reviewed-source.json）と同じSHA-256だけを使う ----
  const SOURCES = [
    {key: 'brief', path: '../brief.json', sha256: 'be4b51e24a920c9492106a684bf59edc095a179daa38b1d66eed8b1da13fc1be'},
    {key: 'articles', path: '../input/articles.json', sha256: 'de566f099b82a5bf7e192d913e76d140fbc46564a1a386c185845f5880104771'},
    {key: 'operations', path: '../outputs/operations.json', sha256: 'd324ae5005c14b97ac140d1c19fee3576ac5ca51b06aa5cee17b0a4974e89bed'},
    {key: 'saved', path: '../outputs/downloaded-state.json', sha256: 'd4e218264c3e346ba769d42082f13b9c104bb86ca008442759ee529f92fdd95b'},
    {key: 'manifest', path: 'assets/screen-manifest.json', sha256: '9ec0e70758aefd8cf614fadc8012beeb123db1805bfcde4090df0f510d3407d2'},
    {key: 'phone', path: 'assets/phone.png', sha256: 'cd55ec9d08ee2d789f33728b24892742eae3d3247952b41e4f6c9fc426f02461', pixels: [375, 812]},
    {key: 'search', path: 'assets/search.png', sha256: 'dadfdc3cf639896c7d2722fa6535a1f212e3838845f5ac6b4541bffd041bd095', pixels: [1265, 889]},
    {key: 'pdf', path: 'assets/pdf.png', sha256: 'a58aeb709a8bc507d1a89201a2eef8da3c7bcf6cd857a451d808d42e79333995', pixels: [1265, 2023]},
    {key: 'images', path: 'assets/images.png', sha256: '872d021f27e7ee8dbbd9a9316ef35d63fc49f42726c1d58a9e6512320897de7d', pixels: [1265, 2023]}
  ];
  const ALL_IDS = ['export-pdf', 'export-images', 'input-materials', 'review-comment', 'name-files', 'share-link'];
  const MATCH_IDS = ['export-pdf', 'export-images'];
  const QUERY = '書き出し';
  const PHRASE = '「塗り足し3mmを含める」';

  // 実画面の切り抜き（画像の画素座標）。manifest の DOM 矩形を16px以上の余白で含むことを読み込み時に確かめる
  const CROPS = {
    phone: {x: 0, y: 0, w: 375, h: 675},
    search: {x: 224, y: 236, w: 816, h: 618},
    rows: {x: 232, y: 572, w: 816, h: 476}, // pdf.png と images.png で同じ範囲
    pdfRow: {x: 232, y: 606, w: 816, h: 327}
  };
  // PDF本文の1段落目（pdf.png）。強調は切り抜きの外側を薄くするだけで、画素は変えない
  const PARAGRAPH_1 = {x: 258, y: 731, w: 756, h: 70};
  // 場面をつなぐ基準点：PDFの見出し行の左上
  const ANCHOR = {search: {x: 246, y: 620}, rows: {x: 256, y: 626.84375}};

  const SCENES = [
    {start: 0, end: 4, step: '依頼', headline: () => '探して、ひとつ開く。'},
    {start: 4, end: 8, step: '検索', headline: f => `「${f.query}」で、${f.total}件が${f.matchCount}件に`},
    {start: 8, end: 14, step: '開く', headline: () => '原典のAccordionで、1件だけ開く'},
    {start: 14, end: 18, step: '切り替え', headline: () => 'もう1件を押すと、切り替わる'},
    {start: 18, end: 23, step: '動きを抑える', headline: () => '動きを抑えても、本文は同じ'},
    {start: 23, end: 28, step: '保存', headline: () => 'いまの表示を、JSONで保存'}
  ];

  // ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const prog = (t, a, b) => clamp01((t - a) / (b - a));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  // a から inDur で現れ、b の outDur 前から消える
  const life = (t, a, b, inDur = 0.45, outDur = 0.35) =>
    Math.min(easeOut(prog(t, a, a + inDur)), 1 - easeInOut(prog(t, b - outDur, b)));

  // ---- 読み込みと確認 --------------------------------------------------------
  const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');

  async function load(source) {
    let response;
    try {
      response = await fetch(source.path, {cache: 'no-store'});
    } catch {
      throw new Error(`${source.path} を読み込めません。file:// ではなくローカルサーバーで開いてください`);
    }
    if (!response.ok) throw new Error(`${source.path} が HTTP ${response.status} でした`);
    const bytes = await response.arrayBuffer();
    const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
    if (digest !== source.sha256) throw new Error(`${source.path} のSHA-256が記録と違います（${digest.slice(0, 12)}…）`);
    if (!source.pixels) return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    const bitmap = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
    if (bitmap.width !== source.pixels[0] || bitmap.height !== source.pixels[1]) {
      throw new Error(`${source.path} の大きさが ${bitmap.width}×${bitmap.height} でした`);
    }
    return bitmap;
  }

  const check = (ok, message) => {
    if (!ok) throw new Error('記録の確認に失敗：' + message);
  };
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
  const stable = v => (Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
    : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
    : JSON.stringify(v));
  const norm = s => String(s).normalize('NFKC').toLowerCase();
  const contains = (crop, rect, pad) => rect.x - pad >= crop.x && rect.x + rect.w + pad <= crop.x + crop.w &&
    rect.y - pad >= crop.y && rect.y + rect.h + pad <= crop.y + crop.h;
  const asRect = r => ({x: r.x, y: r.y, w: r.width, h: r.height});

  function buildFacts(d) {
    const {brief, articles, operations, saved, manifest} = d;

    // 入力：6件の架空の手順書
    check(articles && Array.isArray(articles.records) && articles.records.length === 6, '手順書が6件ではありません');
    check(same(articles.records.map(r => r.id), ALL_IDS), '手順書の id が想定と違います');
    for (const r of articles.records) {
      check(typeof r.title === 'string' && typeof r.category === 'string' && typeof r.summary === 'string', `${r.id} の題名・分類・要約`);
      check(Array.isArray(r.body) && r.body.length === 2 && r.body.every(p => typeof p === 'string'), `${r.id} の本文2段落`);
      check(Array.isArray(r.tags) && r.tags.every(tag => typeof tag === 'string'), `${r.id} のタグ`);
    }
    const byId = id => articles.records.find(r => r.id === id);
    const terms = norm(QUERY).split(/\s+/).filter(Boolean);
    const matched = articles.records
      .filter(r => {
        const haystack = norm([r.title, r.category, r.summary, ...r.body, ...r.tags].join('\n'));
        return terms.every(term => haystack.includes(term));
      })
      .map(r => r.id);
    check(same(matched, MATCH_IDS), '「書き出し」を含む手順書が export-pdf と export-images の2件ではありません');
    const pdfBody = byId('export-pdf').body;
    const imagesBody = byId('export-images').body;
    check(pdfBody[0].includes(PHRASE), 'PDFの本文に「塗り足し3mmを含める」がありません');

    // 実際の操作記録
    check(operations.input_sha256 === SOURCES[1].sha256, '操作記録の入力ハッシュ');
    check(Array.isArray(operations.observed_states), '操作記録の形');
    const state = label => {
      const found = operations.observed_states.find(s => s.label === label);
      check(found, `操作記録 ${label} がありません`);
      check(found.ready === true, `${label} が読み込み済みではありません`);
      return found;
    };
    const paragraphsOf = s => (s.regions.length === 1 ? s.regions[0].paragraphs : null);
    const initial = state('initial');
    check(initial.query === '' && same(initial.matching_ids, ALL_IDS), '最初の表示が6件ではありません');
    const search = state('search-two');
    check(search.query === QUERY && same(search.matching_ids, MATCH_IDS) && search.expanded_id === '', '検索後の2件');
    const openPdf = state('open-pdf');
    check(openPdf.expanded_id === 'export-pdf' && openPdf.expanded_buttons.length === 1 && openPdf.mode.reduced === false, 'PDFを開いた記録');
    check(openPdf.regions[0].id === 'guide-panel-export-pdf' && openPdf.regions[0].labelled_by === 'guide-trigger-export-pdf', 'PDFのパネルと見出しの対応');
    check(same(paragraphsOf(openPdf), pdfBody), 'PDFを開いた本文が入力と違います');
    const switchImages = state('switch-images');
    check(switchImages.expanded_id === 'export-images' && switchImages.expanded_buttons.length === 1, '画像への切り替え');
    check(same(paragraphsOf(switchImages), imagesBody), '画像の本文が入力と違います');
    const closeImages = state('close-images');
    check(closeImages.expanded_id === '' && closeImages.expanded_buttons.length === 0, '同じ見出しで閉じた記録');
    const manual = state('manual-reduced');
    check(manual.mode.manual === true && manual.mode.os === false && manual.mode.reduced === true, 'ページの「動きを抑える」');
    check(same(paragraphsOf(manual), pdfBody), '手動で抑えたときの本文');
    const os = state('os-reduced');
    check(os.mode.os === true && os.mode.manual === false && os.mode.reduced === true, 'OSの設定（模擬）');
    check(same(paragraphsOf(os), pdfBody), 'OSの設定（模擬）での本文');

    // 保存したJSON
    check(saved.format === 'studio-yebisu/motion-primitives-example/search-state', '保存JSONの形式');
    check(saved.query === QUERY && saved.total_count === 6 && saved.matching_count === 2, '保存JSONの検索語と件数');
    check(same(saved.matching_ids, MATCH_IDS) && saved.expanded_id === 'export-pdf', '保存JSONの id');
    check(saved.motion && saved.motion.effective_reduced === true && saved.motion.manual_reduced === true &&
      saved.motion.os_reduced === false && saved.motion.transition && saved.motion.transition.duration === 0, '保存JSONの動きの設定');
    check(stable(saved) === stable(operations.downloaded_state), '保存JSONが操作記録の保存内容と一致しません');

    // 依頼と、0.18秒が「設定値」であることの出典
    check(typeof brief.request === 'string' && brief.request.length > 0, '依頼文');
    check(Array.isArray(brief.assumptions) && brief.assumptions.some(s => s.includes('0.18 秒') && s.includes('測った応答時間')), '0.18秒の扱い');

    // 実画面
    check(manifest && Array.isArray(manifest.screens), '画面の記録');
    const screen = key => {
      const source = SOURCES.find(s => s.key === key);
      const found = manifest.screens.find(s => s.file === key + '.png');
      check(found && found.sha256 === source.sha256 && same(found.pixels, source.pixels), `${key}.png の記録`);
      return found;
    };
    const phoneShot = screen('phone');
    const searchShot = screen('search');
    const pdfShot = screen('pdf');
    const imagesShot = screen('images');
    check(phoneShot.state.rows === 6 && phoneShot.state.query === '', 'phone.png の状態');
    check(searchShot.state.rows === 2 && searchShot.state.query === QUERY, 'search.png の状態');
    check(pdfShot.state.expanded === 'export-pdf' && same(pdfShot.state.body, pdfBody), 'pdf.png の状態');
    check(imagesShot.state.expanded === 'export-images' && same(imagesShot.state.body, imagesBody), 'images.png の状態');
    const rows = {pdf: asRect(pdfShot.state.row), images: asRect(imagesShot.state.row), results: asRect(searchShot.state.results)};
    check(contains(CROPS.rows, rows.pdf, 16) && contains(CROPS.rows, rows.images, 16), '開いた行の切り抜き余白');
    check(contains(CROPS.pdfRow, rows.pdf, 16) && contains(CROPS.pdfRow, PARAGRAPH_1, 0), 'PDF行の切り抜き余白');
    check(rows.results.x - 16 >= CROPS.search.x && rows.results.x + rows.results.w + 16 <= CROPS.search.x + CROPS.search.w, '検索結果の切り抜き余白');
    for (const [key, crop] of [['phone', CROPS.phone], ['search', CROPS.search], ['pdf', CROPS.rows], ['pdf', CROPS.pdfRow]]) {
      const size = SOURCES.find(s => s.key === key).pixels;
      check(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= size[0] && crop.y + crop.h <= size[1], `${key}.png の切り抜き範囲`);
    }

    return {
      records: articles.records.map(r => ({id: r.id, title: r.title, category: r.category})),
      total: articles.records.length,
      query: saved.query,
      matchIds: matched,
      matchCount: saved.matching_count,
      request: brief.request,
      normalDuration: '0.18',
      states: {openPdf, switchImages, closeImages, manual, os},
      saved,
      rows,
      img: {phone: d.phone, search: d.search, pdf: d.pdf, images: d.images}
    };
  }

  // ---- 描画の部品 ------------------------------------------------------------
  function font(o) {
    return `${o.weight || 400} ${o.size || 16}px ${o.mono ? MONO : SANS}`;
  }
  function text(c, s, x, y, o = {}) {
    c.save();
    c.font = font(o);
    c.fillStyle = o.color || C.ink;
    c.textAlign = o.align || 'left';
    c.textBaseline = 'alphabetic';
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    c.fillText(s, x, y);
    c.restore();
  }
  function measure(c, s, o) {
    c.save();
    c.font = font(o);
    const w = c.measureText(s).width;
    c.restore();
    return w;
  }
  const NO_START = '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょァィゥェォッャュョ';
  const NO_END = '（「『【〔〈《';
  function wrap(c, s, maxWidth, o) {
    c.save();
    c.font = font(o);
    const tokens = s.match(/[A-Za-z0-9][A-Za-z0-9.\-_/@:=]*|[\s\S]/gu) || [];
    const lines = [];
    let line = '';
    for (const token of tokens) {
      const next = line + token;
      if (line && c.measureText(next).width > maxWidth) {
        let carry = token;
        if (NO_START.includes(token[0]) && line.length > 1) {
          carry = line.slice(-1) + token;
          line = line.slice(0, -1);
        }
        while (line.length > 1 && NO_END.includes(line.slice(-1))) {
          carry = line.slice(-1) + carry;
          line = line.slice(0, -1);
        }
        lines.push(line);
        line = carry.trimStart();
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    c.restore();
    return lines;
  }
  function paragraph(c, s, x, y, maxWidth, lineHeight, o) {
    const lines = wrap(c, s, maxWidth, o);
    lines.forEach((line, i) => text(c, line, x, y + i * lineHeight, o));
    return y + (lines.length - 1) * lineHeight;
  }
  function pathRound(c, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + radius, y);
    c.arcTo(x + w, y, x + w, y + h, radius);
    c.arcTo(x + w, y + h, x, y + h, radius);
    c.arcTo(x, y + h, x, y, radius);
    c.arcTo(x, y, x + w, y, radius);
    c.closePath();
  }
  function pill(c, label, x, y, h, o) {
    c.save();
    c.font = font({size: o.size || 12, weight: o.weight || 700});
    const w = o.width || c.measureText(label).width + (o.pad || 10) * 2;
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
    pathRound(c, x, y, w, h, h / 2);
    if (o.fill) {
      c.fillStyle = o.fill;
      c.fill();
    }
    if (o.stroke) {
      c.strokeStyle = o.stroke;
      c.lineWidth = o.lineWidth || 1;
      c.stroke();
    }
    c.fillStyle = o.color || C.plum;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, x + w / 2, y + h / 2 + 1);
    c.restore();
    return w;
  }
  function tag(c, label, x, y, alpha) {
    if (alpha > 0) text(c, label, x, y, {size: 12, weight: 500, color: C.muted, alpha});
  }
  // 画面の外に置く説明の縦線（実画面の行の高さに合わせる）
  function bar(c, y1, y2, alpha) {
    if (alpha <= 0) return;
    c.save();
    c.globalAlpha *= alpha;
    c.fillStyle = C.plum;
    pathRound(c, 311, y1, 4, Math.max(4, y2 - y1), 2);
    c.fill();
    c.restore();
  }

  // ---- 実画面のパネル ----------------------------------------------------------
  function shots(f) {
    return {
      phone: {img: f.img.phone, src: CROPS.phone, dst: {x: 936, y: 128, s: 0.78}},
      search: {img: f.img.search, src: CROPS.search, dst: {x: 330, y: 128, s: 0.84}},
      pdf: {img: f.img.pdf, src: CROPS.rows, dst: {x: 330, y: 128, s: 0.9}},
      images: {img: f.img.images, src: CROPS.rows, dst: {x: 330, y: 128, s: 0.9}},
      pdfRow: {img: f.img.pdf, src: CROPS.pdfRow, dst: {x: 330, y: 250, s: 0.9}}
    };
  }
  const toScreen = (shot, dst, r) => ({
    x: dst.x + (r.x - shot.src.x) * dst.s,
    y: dst.y + (r.y - shot.src.y) * dst.s,
    w: r.w * dst.s,
    h: r.h * dst.s
  });
  function drawShot(c, shot, dst, alpha) {
    if (alpha <= 0.002) return;
    const w = shot.src.w * dst.s, h = shot.src.h * dst.s;
    c.save();
    c.globalAlpha = alpha;
    c.shadowColor = 'rgba(34, 31, 42, 0.12)';
    c.shadowBlur = 22;
    c.shadowOffsetY = 8;
    pathRound(c, dst.x, dst.y, w, h, 12);
    c.fillStyle = C.card;
    c.fill();
    c.shadowColor = 'transparent';
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    c.clip();
    c.drawImage(shot.img, shot.src.x, shot.src.y, shot.src.w, shot.src.h, dst.x, dst.y, w, h);
    c.restore();
    c.save();
    c.globalAlpha = alpha;
    pathRound(c, dst.x, dst.y, w, h, 12);
    c.strokeStyle = C.line;
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  }
  // 基準点 anchor（画像座標）が target の targetAnchor と同じ位置・倍率に来る配置
  function alignTo(shot, anchor, target, targetAnchor) {
    const s = target.dst.s;
    const x = target.dst.x + (targetAnchor.x - target.src.x) * target.dst.s;
    const y = target.dst.y + (targetAnchor.y - target.src.y) * target.dst.s;
    return {x: x - (anchor.x - shot.src.x) * s, y: y - (anchor.y - shot.src.y) * s, s};
  }
  const lerpDst = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k)});
  // 2枚の実画面を、同じ行が重なるように動かしながら入れ替える（編集上のつなぎ）
  function bridge(c, t, a, b, from, fromAnchor, to, toAnchor) {
    const k = easeInOut(prog(t, a, b));
    c.save();
    c.beginPath();
    c.rect(300, 100, 960, 566); // 見出しと足元には重ねない
    c.clip();
    drawShot(c, from, lerpDst(from.dst, alignTo(from, fromAnchor, to, toAnchor), k), 1 - k);
    drawShot(c, to, lerpDst(alignTo(to, toAnchor, from, fromAnchor), to.dst, k), easeOut(prog(t, a + 0.15 * (b - a), b)));
    c.restore();
  }

  // ---- 場面の要素 ----------------------------------------------------------------
  function drawChrome(c, t) {
    text(c, 'Studio Yebisu × Motion Primitives', 40, 38, {size: 13, weight: 600, color: C.muted});
    let x = 330;
    SCENES.forEach((s, i) => {
      const label = `0${i + 1} ${s.step}`;
      const active = t >= s.start && (t < s.end || i === SCENES.length - 1);
      text(c, label, x, 38, {size: 13, weight: active ? 700 : 500, color: active ? C.plum : C.muted});
      const w = measure(c, label, {size: 13, weight: 700});
      if (active) {
        c.save();
        c.fillStyle = C.plum;
        c.fillRect(x, 45, w, 2);
        c.restore();
      }
      x += w + 22;
    });
    c.save();
    c.fillStyle = C.line;
    c.fillRect(40, 670, 1200, 1);
    c.restore();
    text(c, '架空の手順書・実画面からの編集・無音', 40, 700, {size: 13, weight: 600, color: C.muted});
    text(c, 'Studio Yebisu', 1240, 700, {size: 13, weight: 600, color: C.muted, align: 'right'});
  }

  function drawHeadline(c, t, f) {
    SCENES.forEach((s, i) => {
      const a = i === 0 ? -1 : s.start - 0.05;
      const b = i === SCENES.length - 1 ? 99 : s.end + 0.05;
      const k = life(t, a, b, 0.45, 0.3);
      if (k <= 0) return;
      const rise = i === 0 ? 0 : 10 * (1 - easeOut(prog(t, a, a + 0.45)));
      text(c, s.headline(f), 330, 88 + rise, {size: 34, weight: 700, alpha: k});
    });
  }

  const RAIL = {x: 40, y: 128, w: 250, h: 58, gap: 10};
  const cardTop = i => RAIL.y + i * (RAIL.h + RAIL.gap);
  const matchAt = t => easeInOut(prog(t, 5.0, 5.8));
  const pdfOpenAt = t => Math.max(easeOut(prog(t, 8.7, 9.1)) * (1 - easeOut(prog(t, 14.1, 14.4))), easeOut(prog(t, 18.3, 18.7)));
  const imagesOpenAt = t => easeOut(prog(t, 14.1, 14.4)) * (1 - easeOut(prog(t, 17.8, 18.2)));

  // 6件の手順書カード：位置と形は最後まで変えず、一致と開いた状態だけを重ねる
  function drawRail(c, t, f) {
    text(c, `手順書 ${f.total}件`, 40, 88, {size: 22, weight: 700});
    text(c, 'input/articles.json（架空）', 40, 112, {size: 12, mono: true, color: C.muted});
    const matchK = matchAt(t);
    f.records.forEach((r, i) => {
      const enter = easeOut(prog(t, 0.15 + i * 0.1, 0.65 + i * 0.1));
      if (enter <= 0) return;
      const matched = f.matchIds.includes(r.id);
      const open = r.id === 'export-pdf' ? pdfOpenAt(t) : r.id === 'export-images' ? imagesOpenAt(t) : 0;
      const x = RAIL.x - 14 * (1 - enter), y = cardTop(i);
      c.save();
      c.globalAlpha = enter * (matched ? 1 : 1 - 0.62 * matchK);
      pathRound(c, x, y, RAIL.w, RAIL.h, 10);
      c.fillStyle = C.card;
      c.fill();
      c.strokeStyle = C.line;
      c.lineWidth = 1;
      c.stroke();
      if (matched && matchK > 0) {
        c.save();
        c.globalAlpha *= matchK;
        pathRound(c, x, y, RAIL.w, RAIL.h, 10);
        c.strokeStyle = C.plum;
        c.lineWidth = 2;
        c.stroke();
        c.restore();
      }
      if (open > 0) {
        c.save();
        c.globalAlpha *= open;
        pathRound(c, x, y, RAIL.w, RAIL.h, 10);
        c.clip();
        c.fillStyle = C.plum;
        c.fillRect(x, y, 6, RAIL.h);
        c.restore();
      }
      text(c, r.category, x + 18, y + 22, {size: 12, weight: 700, color: C.plum});
      text(c, r.title, x + 18, y + 45, {size: 17, weight: 700});
      if (matched && matchK > 0) {
        const bx = x + RAIL.w - 12 - 58, by = y + 17;
        pill(c, '一致', bx, by, 24, {width: 58, fill: C.card, stroke: C.plumLine, color: C.plum, alpha: matchK * (1 - open)});
        pill(c, '開いた', bx, by, 24, {width: 58, fill: C.plum, color: '#ffffff', alpha: matchK * open});
      }
      c.restore();
    });
    // 件数
    text(c, '表示している件数', 40, 566, {size: 13, weight: 600, color: C.muted});
    text(c, `${f.total}件`, 40, 616, {size: 44, weight: 700, color: C.plum, alpha: 1 - matchK});
    if (matchK > 0) {
      const w = measure(c, `${f.matchCount}件`, {size: 44, weight: 700});
      text(c, `${f.matchCount}件`, 40, 616, {size: 44, weight: 700, color: C.plum, alpha: matchK});
      text(c, `／ 全${f.total}件`, 40 + w + 8, 616, {size: 15, weight: 600, color: C.muted, alpha: matchK});
      text(c, `検索語「${f.query}」`, 40, 644, {size: 14, color: C.muted, alpha: matchK});
    }
  }

  function drawScreens(c, t, f, S) {
    const phoneA = Math.max(life(t, 0.3, 4.3, 0.6, 0.5), life(t, 23.3, 99, 0.6, 0.3));
    if (phoneA > 0) {
      const rise = t < 12 ? 14 * (1 - easeOut(prog(t, 0.3, 0.9))) : 14 * (1 - easeOut(prog(t, 23.3, 23.9)));
      drawShot(c, S.phone, {...S.phone.dst, y: S.phone.dst.y + rise}, phoneA);
      tag(c, '実画面：最初の表示（スマホ幅）', S.phone.dst.x, 116, phoneA);
    }
    if (t >= 4.0 && t < 7.6) {
      const k = easeOut(prog(t, 4.0, 4.6));
      drawShot(c, S.search, {...S.search.dst, y: S.search.dst.y + 14 * (1 - k)}, k);
    } else if (t >= 7.6 && t < 8.4) {
      bridge(c, t, 7.6, 8.4, S.search, ANCHOR.search, S.pdf, ANCHOR.rows);
    }
    tag(c, 'search.png（実画面・1280px幅）・ 記録 search-two', 330, 116, life(t, 4.2, 7.6, 0.4, 0.3));
    if (t >= 8.4 && t < 14.45) drawShot(c, S.pdf, S.pdf.dst, 1);
    if (t >= 14.0 && t < 17.6) drawShot(c, S.images, S.images.dst, easeInOut(prog(t, 14.0, 14.45)));
    if (t >= 17.6 && t < 18.4) bridge(c, t, 17.6, 18.4, S.images, ANCHOR.rows, S.pdfRow, ANCHOR.rows);
    if (t >= 18.4 && t < 23.1) drawShot(c, S.pdfRow, S.pdfRow.dst, 1 - easeInOut(prog(t, 22.6, 23.1)));
    tag(c, 'pdf.png（実画面）・ 記録 open-pdf', 330, 116, life(t, 8.4, 14.05, 0.4, 0.3));
    tag(c, 'images.png（実画面）・ 記録 switch-images', 330, 116, life(t, 14.15, 17.6, 0.35, 0.3));
  }

  function drawRequest(c, t, f) {
    const k = life(t, -1, 4.1, 0.4, 0.45);
    if (k <= 0) return;
    c.save();
    c.globalAlpha = k;
    text(c, '依頼（brief.json より）', 330, 170, {size: 14, weight: 700, color: C.plum});
    paragraph(c, f.request, 330, 212, 540, 40, {size: 24, weight: 500});
    const chips = [
      `架空のアプリ「しおり工房」の手順書 ${f.total}件`,
      '検索も開閉もブラウザー内（AI・サーバーなし）',
      'Motion Primitives の Accordion を写して使用'
    ];
    chips.forEach((label, i) => {
      const e = easeOut(prog(t, 0.7 + i * 0.25, 1.2 + i * 0.25));
      if (e > 0) pill(c, label, 330, 364 + i * 52 + 8 * (1 - e), 38, {size: 15, weight: 500, pad: 16, fill: C.card, stroke: C.line, color: C.ink, alpha: e});
    });
    c.restore();
  }

  function drawSearchNotes(c, t, f, S) {
    const k = life(t, 4.8, 7.7, 0.5, 0.3);
    if (k > 0) {
      c.save();
      c.globalAlpha = k;
      const x = 1040;
      text(c, '検索語', x, 160, {size: 13, weight: 600, color: C.muted});
      text(c, `「${f.query}」`, x - 8, 194, {size: 24, weight: 700});
      text(c, '一致', x, 246, {size: 13, weight: 600, color: C.muted});
      const w = measure(c, `${f.matchCount}件`, {size: 44, weight: 700});
      text(c, `${f.matchCount}件`, x, 296, {size: 44, weight: 700, color: C.plum});
      text(c, `／ 全${f.total}件`, x + w + 6, 296, {size: 15, weight: 600, color: C.muted});
      const end = paragraph(c, '「検索」を押したときだけ、題名・分類・要約・本文・タグから絞ります。', x, 346, 196, 24, {size: 15, color: C.ink});
      paragraph(c, '全角と半角、大文字と小文字はそろえて比べます。', x, end + 40, 196, 24, {size: 15, color: C.muted});
      c.restore();
    }
    const r = f.rows.results;
    const top = S.search.dst.y + (r.y - S.search.src.y) * S.search.dst.s;
    const bottom = S.search.dst.y + (S.search.src.h - 8) * S.search.dst.s;
    bar(c, top, bottom, life(t, 5.2, 7.6, 0.4, 0.3));
  }

  function codeChip(c, code, x, y, alpha) {
    if (alpha <= 0) return 0;
    c.save();
    c.globalAlpha *= alpha;
    c.font = font({size: 17, weight: 600, mono: true});
    const w = c.measureText(code).width + 28;
    pathRound(c, x, y, w, 42, 8);
    c.fillStyle = C.plumSoft;
    c.fill();
    c.fillStyle = C.plum;
    c.textBaseline = 'middle';
    c.fillText(code, x + 14, y + 22);
    c.restore();
    return w;
  }

  function drawOpenSwitch(c, t, f, S) {
    // 編集のつなぎであることの注記（開く・切り替えの間ずっと）
    text(c, '実画面2枚を編集でつないでいます。実際の開閉の速さを写したものではありません。', 330, 578,
      {size: 13, weight: 500, color: C.muted, alpha: life(t, 8.6, 17.6, 0.4, 0.3)});

    // 開く
    const pdfRow = toScreen(S.pdf, S.pdf.dst, f.rows.pdf);
    bar(c, pdfRow.y, pdfRow.y + pdfRow.h, life(t, 8.8, 14.1, 0.4, 0.25));
    const openA = life(t, 8.8, 14.2, 0.5, 0.25);
    const w1 = codeChip(c, `expandedValue = "${f.states.openPdf.expanded_id}"`, 330, 594, openA);
    if (openA > 0) text(c, `開いている見出し：${f.states.openPdf.expanded_buttons.length}件`, 330 + w1 + 16, 622, {size: 15, weight: 600, alpha: openA});

    const colA = life(t, 8.7, 14.1, 0.5, 0.3);
    if (colA > 0) {
      c.save();
      c.globalAlpha = colA;
      const x = 1084;
      text(c, '原典の部品', x, 150, {size: 13, weight: 600, color: C.muted});
      text(c, 'ibelick/', x, 178, {size: 15, weight: 700});
      text(c, 'motion-primitives', x, 198, {size: 15, weight: 700});
      text(c, '@120f64f（固定）', x, 222, {size: 13, mono: true, color: C.muted});
      ['Accordion', 'AccordionItem', 'AccordionTrigger', 'AccordionContent'].forEach((name, i) => {
        const e = easeOut(prog(t, 9.0 + i * 0.15, 9.4 + i * 0.15));
        text(c, name, x + 8 * (1 - e), 262 + i * 26, {size: 14, mono: true, color: C.plum, alpha: e});
      });
      text(c, 'React 18.3.1', x, 388, {size: 14, color: C.muted});
      text(c, 'Motion 11.12.0', x, 410, {size: 14, color: C.muted});
      paragraph(c, '開く1件はアプリ側の状態で持つ（制御された形）', x, 450, 150, 22, {size: 14, color: C.ink});
      c.restore();
    }

    // 切り替え
    const imagesRow = toScreen(S.images, S.images.dst, f.rows.images);
    bar(c, imagesRow.y, imagesRow.y + imagesRow.h, life(t, 14.4, 17.6, 0.35, 0.3));
    const switchA = life(t, 14.2, 17.6, 0.35, 0.3);
    const w2 = codeChip(c, `expandedValue = "${f.states.switchImages.expanded_id}"`, 330, 594, switchA);
    if (switchA > 0) text(c, `開いている見出し：${f.states.switchImages.expanded_buttons.length}件`, 330 + w2 + 16, 622, {size: 15, weight: 600, alpha: switchA});

    const col2 = life(t, 14.3, 17.6, 0.45, 0.3);
    if (col2 > 0) {
      c.save();
      c.globalAlpha = col2;
      const x = 1084;
      text(c, '切り替え', x, 150, {size: 13, weight: 600, color: C.muted});
      paragraph(c, '別の見出しを押すと、前の1件は閉じる', x, 178, 150, 24, {size: 15, weight: 600});
      text(c, '閉じる', x, 290, {size: 13, weight: 600, color: C.muted});
      paragraph(c, '同じ見出しをもう一度押すと閉じる', x, 318, 150, 24, {size: 15, weight: 600});
      paragraph(c, `記録 close-images：開いている見出し ${f.states.closeImages.expanded_buttons.length}件`, x, 390, 150, 20, {size: 13, color: C.muted});
      c.restore();
    }
  }

  function drawReduce(c, t, f, S) {
    const modes = [
      {title: '通常の動き', value: `開閉の設定 ${f.normalDuration}秒`, note: '見た目の設定値・測定ではない'},
      {title: 'ページで「動きを抑える」', value: `開閉の設定 ${f.saved.motion.transition.duration}秒`, note: '記録 manual-reduced'},
      // 保存JSONは動きを抑えた状態（effective_reduced=true）の transition。OS側も同じ「抑えた状態」として記録されている
      {title: 'OSの「動きを減らす」', value: `開閉の設定 ${f.states.os.mode.reduced ? f.saved.motion.transition.duration : f.normalDuration}秒`, note: 'CDPで模擬・実機ではない'}
    ];
    tag(c, '記録 open-pdf ・ manual-reduced ・ os-reduced（outputs/operations.json）', 330, 116, life(t, 18.3, 22.8, 0.4, 0.3));
    modes.forEach((m, i) => {
      const k = life(t, 18.3 + i * 0.25, 22.8, 0.45, 0.3);
      if (k <= 0) return;
      const x = 330 + i * 310, y = 126 + 8 * (1 - easeOut(prog(t, 18.3 + i * 0.25, 18.75 + i * 0.25)));
      c.save();
      c.globalAlpha = k;
      pathRound(c, x, y, 290, 94, 10);
      c.fillStyle = C.card;
      c.fill();
      c.strokeStyle = i === 0 ? C.line : C.plumLine;
      c.lineWidth = 1;
      c.stroke();
      text(c, m.title, x + 16, y + 28, {size: 15, weight: 700});
      text(c, m.value, x + 16, y + 58, {size: 20, weight: 700, color: C.plum});
      text(c, m.note, x + 16, y + 82, {size: 12, weight: 500, color: C.muted});
      pill(c, '同じ2段落', x + 290 - 14 - 76, y + 66, 22, {width: 76, size: 11, fill: C.plumSoft, color: C.plum});
      c.restore();
    });

    if (t >= 18.4 && t < 23.1) {
      tag(c, 'pdf.png（実画面・通常の動きで開いた状態）', 330, 240, life(t, 18.4, 22.8, 0.4, 0.3));
      const dst = S.pdfRow.dst;
      const panel = {x: dst.x, y: dst.y, w: S.pdfRow.src.w * dst.s, h: S.pdfRow.src.h * dst.s};
      const region = toScreen(S.pdfRow, dst, PARAGRAPH_1);
      const dim = easeInOut(prog(t, 19.6, 20.2)) * (1 - easeInOut(prog(t, 22.5, 23.0)));
      if (dim > 0) {
        c.save();
        pathRound(c, panel.x, panel.y, panel.w, panel.h, 12);
        c.clip();
        c.beginPath();
        c.rect(panel.x, panel.y, panel.w, panel.h);
        c.rect(region.x, region.y, region.w, region.h);
        c.fillStyle = `rgba(247, 243, 236, ${0.62 * dim})`;
        c.fill('evenodd');
        c.restore();
        c.save();
        c.globalAlpha = dim;
        pathRound(c, region.x - 2, region.y - 2, region.w + 4, region.h + 4, 6);
        c.strokeStyle = C.plum;
        c.lineWidth = 2;
        c.stroke();
        c.restore();
      }
      const row = toScreen(S.pdfRow, dst, f.rows.pdf);
      bar(c, row.y, row.y + row.h, life(t, 18.6, 22.8, 0.4, 0.3));
    }

    const q = life(t, 20.0, 22.8, 0.5, 0.3);
    if (q > 0) {
      text(c, PHRASE, 330, 588, {size: 24, weight: 700, color: C.plum, alpha: q});
      text(c, '通常・ページの設定・OSの設定（模擬）の3つの記録で、この文を含む同じ2段落が表示されました。', 330, 618, {size: 14, color: C.ink, alpha: q});
      text(c, '手順書は作例用の架空の文です。', 330, 642, {size: 13, color: C.muted, alpha: q});
    }
  }

  function drawSave(c, t, f) {
    const k = life(t, 23.2, 99, 0.5, 0.3);
    if (k <= 0) return;
    tag(c, 'outputs/downloaded-state.json（抜粋）', 330, 116, k);
    const s = f.saved;
    const lines = [
      ['{', ''],
      ['  "query": ', JSON.stringify(s.query) + ','],
      ['  "matching_count": ', String(s.matching_count) + ','],
      ['  "matching_ids": ', '[' + s.matching_ids.map(id => JSON.stringify(id)).join(', ') + '],'],
      ['  "expanded_id": ', JSON.stringify(s.expanded_id) + ','],
      ['  "motion": {', ''],
      ['    "effective_reduced": ', String(s.motion.effective_reduced) + ','],
      ['    "transition": ', '{ "duration": ' + String(s.motion.transition.duration) + ' }'],
      ['  }', ''],
      ['}', '']
    ];
    const box = {x: 330, y: 128, w: 540, h: 342};
    c.save();
    c.globalAlpha = k;
    c.shadowColor = 'rgba(34, 31, 42, 0.16)';
    c.shadowBlur = 22;
    c.shadowOffsetY = 8;
    pathRound(c, box.x, box.y + 10 * (1 - easeOut(prog(t, 23.2, 23.7))), box.w, box.h, 12);
    c.fillStyle = C.night;
    c.fill();
    c.restore();
    const dy = 10 * (1 - easeOut(prog(t, 23.2, 23.7)));
    text(c, '保存したJSON（実際のファイルから抜粋）', box.x + 24, box.y + 32 + dy, {size: 13, weight: 600, color: C.nightMuted, alpha: k});
    let size = 16;
    const widest = Math.max(...lines.map(([key, value]) => measure(c, key + value, {size, mono: true})));
    if (widest > box.w - 48) size = Math.floor(size * (box.w - 48) / widest);
    lines.forEach(([key, value], i) => {
      const e = easeOut(prog(t, 23.4 + i * 0.09, 23.75 + i * 0.09)) * k;
      if (e <= 0) return;
      const y = box.y + 72 + i * 28 + dy;
      text(c, key, box.x + 24, y, {size, mono: true, color: C.nightText, alpha: e});
      if (value) text(c, value, box.x + 24 + measure(c, key, {size, mono: true}), y, {size, mono: true, weight: 600, color: C.nightValue, alpha: e});
    });

    const cta = life(t, 24.2, 99, 0.5, 0.3);
    if (cta > 0) {
      text(c, '試す順番', 330, 504, {size: 13, weight: 600, color: C.muted, alpha: cta});
      let x = 330;
      ['検索', '開閉', 'JSON保存'].forEach((label, i) => {
        const on = easeOut(prog(t, 24.6 + i * 0.5, 25.0 + i * 0.5));
        pill(c, label, x, 518, 48, {width: 140, size: 18, fill: C.card, stroke: C.plum, lineWidth: 2, color: C.plum, alpha: cta});
        pill(c, label, x, 518, 48, {width: 140, size: 18, fill: C.plum, color: '#ffffff', alpha: cta * on});
        if (i < 2) text(c, '→', x + 140 + 18, 550, {size: 20, weight: 700, color: C.muted, alpha: cta, align: 'center'});
        x += 176;
      });
      text(c, '記事：case.html?id=motion-primitives-example', 330, 612, {size: 15, weight: 600, alpha: cta});
      text(c, `保存時の設定：ページで動きを抑えた状態（effective_reduced = ${s.motion.effective_reduced}）`, 330, 640, {size: 13, color: C.muted, alpha: cta});
    }
  }

  // ---- 1フレームを描く --------------------------------------------------------
  let facts = null;
  let failure = null;
  let currentT = 0;

  function render(t) {
    canvas.width = canvas.width; // 前のフレームの状態を毎回すべて捨てる
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / LW, canvas.height / LH);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - LW * scale) / 2, (canvas.height - LH * scale) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawChrome(ctx, facts ? t : 0);
    if (!facts) {
      const message = failure ? '読み込みに失敗しました。代わりの映像は出しません。' : '素材と記録を確かめています…';
      text(ctx, message, LW / 2, 340, {size: 20, weight: 700, color: failure ? C.ink : C.muted, align: 'center'});
      if (failure) {
        const lines = wrap(ctx, failure.message, 860, {size: 15});
        lines.forEach((line, i) => text(ctx, line, LW / 2, 376 + i * 24, {size: 15, color: C.muted, align: 'center'}));
      }
      return;
    }
    const S = shots(facts);
    drawRail(ctx, t, facts);
    drawHeadline(ctx, t, facts);
    drawScreens(ctx, t, facts, S);
    drawRequest(ctx, t, facts);
    drawSearchNotes(ctx, t, facts, S);
    drawOpenSwitch(ctx, t, facts, S);
    drawReduce(ctx, t, facts, S);
    drawSave(ctx, t, facts);
  }

  const statusEl = document.getElementById('status');
  function setStatus(state, message) {
    root.dataset.motionStatus = state;
    if (!statusEl) return;
    statusEl.dataset.state = state;
    statusEl.textContent = message;
  }

  const clampTime = v => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(DURATION, Math.max(0, n)) : 0;
  };

  render(0);
  setStatus('loading', '素材を読み込み、SHA-256と記録の中身を確かめています…');

  window.motionReady = (async () => {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('この環境ではSHA-256を確かめられません。http://127.0.0.1 などのローカルサーバーで開いてください');
    }
    const loaded = await Promise.all(SOURCES.map(load));
    const data = {};
    SOURCES.forEach((source, i) => { data[source.key] = loaded[i]; });
    const built = buildFacts(data);
    await document.fonts.ready;
    facts = built;
    render(currentT);
    setStatus('ready', '準備完了：JSON 5件と実画面4枚のSHA-256、件数・id・本文の一致を確かめました。');
    return true;
  })().catch(error => {
    failure = error;
    render(currentT);
    setStatus('error', '読み込みに失敗しました：' + error.message + '。代わりの映像は出しません。');
    throw error;
  });
  window.motionReady.catch(() => {});

  // 任意の時刻の完成した画面を描く。呼んだ順番や壁時計には依存しない
  window.seek = seconds => {
    const t = clampTime(seconds);
    currentT = t;
    if (facts) {
      render(t);
      return Promise.resolve(t);
    }
    return window.motionReady.then(() => {
      render(t);
      return t;
    });
  };

  // ---- 編集用のプレビュー（書き出し時は動かさない） ----------------------------
  if (RENDER) return;
  const playButton = document.getElementById('play');
  const range = document.getElementById('time');
  const clock = document.getElementById('clock');
  let playing = false, raf = 0, from = 0, startedAt = 0;
  const seconds = v => v.toFixed(1) + '秒';

  function sync() {
    range.value = String(Math.round(currentT * 10) / 10);
    range.setAttribute('aria-valuetext', `${seconds(currentT)}（全${DURATION}秒）`);
    clock.textContent = `${seconds(currentT)} / ${seconds(DURATION)}`;
    playButton.setAttribute('aria-pressed', String(playing));
    playButton.textContent = playing ? '一時停止' : '再生';
  }
  function frame(now) {
    if (!playing) return;
    const t = Math.min(DURATION, from + (now - startedAt) / 1000);
    currentT = t;
    render(t);
    if (t >= DURATION) {
      playing = false;
      raf = 0;
    } else {
      raf = requestAnimationFrame(frame);
    }
    sync();
  }
  function start() {
    if (!facts || playing) return;
    if (currentT >= DURATION - 0.05) currentT = 0;
    from = currentT;
    startedAt = performance.now();
    playing = true;
    raf = requestAnimationFrame(frame);
    sync();
  }
  function stop() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    sync();
  }
  function jump(t) {
    stop();
    window.seek(t).then(sync);
  }

  playButton.addEventListener('click', () => (playing ? stop() : start()));
  range.addEventListener('input', () => {
    const wanted = Number(range.value); // stop() が表示をそろえる前に読む
    stop();
    window.seek(wanted).then(sync);
  });
  document.addEventListener('keydown', event => {
    if (!facts || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (target === range) {
      // 矢印・Home・End はスライダー標準のまま。PageUp/PageDown だけ2秒にそろえる
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault();
        jump(clampTime(currentT + (event.key === 'PageUp' ? 2 : -2)));
      }
      return;
    }
    if (target !== document.body && target !== canvas && target !== root) return;
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      playing ? stop() : start();
    } else if (event.key === 'Home') {
      event.preventDefault();
      jump(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      jump(DURATION);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      jump(clampTime(currentT + (event.key === 'PageUp' ? 2 : -2)));
    }
  });
  window.motionReady.then(() => {
    playButton.disabled = false;
    range.disabled = false;
    sync();
  }, () => {});
})();
