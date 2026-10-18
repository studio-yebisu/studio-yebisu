/* Crawl4AI 作例：Pythonからブラウザーを動かし、ページを文章と項目に変えるライブラリ
   Copyright (c) 2026 Studio Yebisu. MIT License.
   concept/manifest.json を固定SHA-256で照合し、17素材のバイト数・SHA-256・内容を確かめてから図と読み出しを描く。
   保存済みの実行を図にするだけで、このページは取得・Crawl4AI・AIを動かさず、外部へ通信しない。 */
'use strict';
(() => {
  const PIN = '3d551e51493965163f6d04ff45217904733da852dda723ecb4c2bbe851a79260';
  const CASE = 'crawl4ai-example';
  const COMMIT = '6192d5e5b59cb21f9ca418fd6b798de47c0741d3';
  const VERSION = '0.9.5';
  const DEFINITION = 'Pythonからブラウザーを動かし、ページを文章と項目に変えるライブラリ';
  const RUNS = {path: 'outputs/runs.json', bytes: 33099, sha256: '0b932f3a4ac8190d70ff8e320dc0c0354746bc4ec3279a05d55f591aca4418f5'};
  const MEMO = {path: 'outputs/result.md', bytes: 5852, sha256: 'aba3649b3e65334086b1bf9cf5f708eebf90b6e80c2e6257d30050a0892316e6'};
  const V = 'vendor/crawl4ai/';
  const README = V + 'README.md', LIC = V + 'LICENSE';
  const MDDOC = V + 'docs/md_v2/core/markdown-generation.md', NOLLM = V + 'docs/md_v2/extraction/no-llm-strategies.md';
  const WF = 'workflow.py';
  const FIX = {start: 'fixture/docs/start.html', review: 'fixture/docs/review.html', export: 'fixture/docs/export.html', js: 'fixture/docs/dynamic-export.js'};
  const PATHS = ['concept/structure.json', 'brief.json', 'request.txt', WF, RUNS.path, MEMO.path, 'samples.json',
    FIX.start, FIX.review, FIX.export, FIX.js, README, LIC, MDDOC, NOLLM, 'NOTICE.txt', 'verification.json'];
  const BLOB = `https://github.com/unclecode/crawl4ai/blob/${COMMIT}/`;
  const THEME_KEY = 'studio-yebisu.crawl4ai-example.theme';
  const DOCS = ['start', 'review', 'export'];
  const DOC_OBJ = {start: 'docStart', review: 'docReview', export: 'docExport'};
  const STAGE = {parts: '仕組み', open: '開いて待つ', extract: '取り出す'};
  const PART_IDS = ['browser', 'scope', 'fields', 'markdown'];
  const LEGACY = ['start', 'review', 'export', 'missing', 'docs', 'files', 'request'];
  const ATTR_REQ = 'This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project (https://github.com/unclecode/crawl4ai).';
  const ATTR_USE = 'This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.';
  const SCHEMA = {name: 'Guide sections', baseSelector: 'article.doc-section', fields: [
    {name: 'heading', selector: 'h2', type: 'text'}, {name: 'keypoint', selector: 'p.keypoint', type: 'text'}]};
  const SELECTORS = {css_selector: 'main#guide', excluded_tags: ['nav', 'footer'], wait_for: 'css:#guide[data-ready="true"]', baseSelector: 'article.doc-section'};

  // 元の行の位置。本文は照合済みの実ファイルから切り出し、must の文字列があるかも確かめる。
  const EXCERPTS = {
    browser: [[WF, 274, 281, 'browser_config = BrowserConfig('], [WF, 313, 329, 'result = await crawler.arun(url=url, config=config)'],
      [README, 267, 268, 'AsyncWebCrawler(config=BrowserConfig(headless=True))']],
    scope: [[WF, 50, 53, 'CSS_SELECTOR = "main#guide"'], [WF, 283, 291, 'wait_for=WAIT_FOR,']],
    fields: [[WF, 41, 49, '"baseSelector": "article.doc-section"'], [WF, 292, 292, 'JsonCssExtractionStrategy(copy.deepcopy(SCHEMA))'],
      [NOLLM, 3, 5, 'JsonCssExtractionStrategy']],
    markdown: [[WF, 54, 54, '"body_width": 0'], [WF, 293, 293, 'DefaultMarkdownGenerator(options=dict(MARKDOWN_OPTIONS))'],
      [MDDOC, 43, 45, 'convert the final HTML into markdown'], [MDDOC, 107, 110, 'means no wrapping']]
  };
  const USE = [[WF, 274, 295, 'def document_config():'], [WF, 313, 329, 'async with AsyncWebCrawler(']];
  const ACCEPT = [WF, 357, 359, 'response["success"] is True and response["status_code"] == 200'];
  const DIAG_CFG = [WF, 297, 306, 'def diagnostic_config():'];
  const JS_ADD = [FIX.js, 31, 36, 'window.setTimeout(addSection, '];

  // 図の配置（viewBox単位の x, y, 幅, 高さ）。縦長の画面と横長の画面で組み直す。
  const LAYOUT = {
    tall: {w: 360, h: 488,
      parts: {docStart: [0, 0, 114, 54], docReview: [123, 0, 114, 54], docExport: [246, 0, 114, 54], call: [0, 62, 360, 34],
        lib: [0, 106, 360, 250], bcfg: [8, 120, 112, 58], rcfg: [8, 184, 112, 92], browser: [128, 120, 224, 156], js: [262, 250, 86, 30],
        sec0: [136, 172, 208, 30], sec1: [136, 206, 208, 30], gate: [128, 282, 224, 26], mdgen: [8, 314, 170, 36], ext: [182, 314, 170, 36],
        md: [0, 364, 174, 78], json: [186, 364, 174, 78], door: [0, 450, 150, 38], memo: [70, 450, 220, 38]},
      open: {lib: [0, 106, 360, 300], bcfg: [8, 120, 84, 44], rcfg: [8, 170, 84, 136], browser: [100, 116, 252, 194], js: [258, 262, 88, 30],
        sec0: [110, 172, 232, 34], sec1: [110, 212, 232, 34], sec1Out: [262, 263, 80, 28], gate: [100, 316, 252, 40],
        mdgen: [8, 364, 170, 34], ext: [182, 364, 170, 34], md: [0, 410, 174, 32], json: [186, 410, 174, 32]},
      extract: {lib: [0, 106, 360, 236], bcfg: [8, 120, 84, 32], rcfg: [8, 158, 84, 80], browser: [100, 116, 252, 128], gate: [100, 248, 252, 16],
        mdgen: [8, 272, 170, 62], ext: [182, 272, 170, 62], md: [0, 350, 174, 92], json: [186, 350, 174, 92],
        sec0: [192, 374, 162, 30], sec1: [192, 408, 162, 30]},
      diag: {door: [0, 450, 150, 38], memo: [160, 450, 200, 38]}
    },
    wide: {w: 960, h: 420,
      parts: {call: [0, 0, 124, 104], docStart: [0, 116, 124, 54], docReview: [0, 178, 124, 54], docExport: [0, 240, 124, 54],
        lib: [140, 0, 552, 356], bcfg: [154, 16, 196, 62], rcfg: [358, 16, 320, 62], browser: [154, 90, 300, 252], js: [356, 290, 92, 34],
        sec0: [166, 160, 276, 40], sec1: [166, 206, 276, 40], gate: [462, 90, 40, 252], mdgen: [512, 90, 166, 120], ext: [512, 222, 166, 120],
        md: [706, 0, 200, 200], json: [706, 212, 200, 140], memo: [916, 0, 44, 420], door: [808, 212, 98, 140]},
      open: {bcfg: [154, 16, 150, 44], rcfg: [312, 16, 366, 44], browser: [154, 70, 300, 282], js: [352, 298, 92, 34],
        sec0: [166, 148, 276, 46], sec1: [166, 202, 276, 46], sec1Out: [356, 300, 84, 30], gate: [462, 70, 56, 282],
        mdgen: [526, 70, 152, 136], ext: [526, 216, 152, 136]},
      extract: {bcfg: [154, 16, 150, 44], rcfg: [312, 16, 366, 44], browser: [154, 70, 240, 206], gate: [402, 70, 20, 206],
        mdgen: [432, 70, 246, 130], ext: [432, 212, 246, 140], md: [706, 0, 200, 210], json: [706, 222, 200, 130],
        sec0: [714, 262, 184, 40], sec1: [714, 306, 184, 40]},
      diag: {}
    }
  };
  // 線。段階ごとに on（今の道筋）・base（つながりだけ）・ghost（この後の工程）・diag（診断だけの道）。
  const LINKS = [
    {a: '@doc', sa: {tall: 'b', wide: 't'}, b: 'call', sb: {tall: 't', wide: 'b'}, on: {parts: 'on', open: 'on', extract: 'base'}, diag: 'hide'},
    {a: 'call', sa: {tall: 'b', wide: 'r'}, fa: {tall: 0.62}, b: 'browser', sb: {tall: 't', wide: 'l'}, fb: {wide: 0.25}, on: {parts: 'on', open: 'on', extract: 'base'}},
    {a: 'bcfg', sa: {tall: 'r', wide: 'b'}, b: 'browser', sb: {tall: 'l', wide: 't'}, fb: 0.25, on: {parts: 'on', open: 'base', extract: 'base'}},
    {a: 'rcfg', sa: {tall: 'r', wide: 'b'}, fa: {tall: 0.75, wide: 0.62}, b: 'gate', sb: {tall: 'l', wide: 't'}, on: {parts: 'on', open: 'on', extract: 'base'}, diag: 'hide'},
    {a: 'browser', sa: {tall: 'b', wide: 'r'}, b: 'gate', sb: {tall: 't', wide: 'l'}, on: {parts: 'base', open: 'on', extract: 'on'}},
    {a: 'gate', sa: {tall: 'b', wide: 'r'}, fa: {tall: 0.2, wide: 0.25}, b: 'mdgen', sb: {tall: 't', wide: 'l'}, on: {parts: 'base', open: 'ghost', extract: 'on'}},
    {a: 'gate', sa: {tall: 'b', wide: 'r'}, fa: {tall: 0.8, wide: 0.75}, b: 'ext', sb: {tall: 't', wide: 'l'}, on: {parts: 'base', open: 'ghost', extract: 'on'}, diag: 'hide'},
    {a: 'mdgen', sa: {tall: 'b', wide: 'r'}, b: 'md', sb: {tall: 't', wide: 'l'}, fb: {wide: 0.3}, on: {parts: 'ghost', open: 'ghost', extract: 'on'}},
    {a: 'ext', sa: {tall: 'b', wide: 'r'}, b: 'json', sb: {tall: 't', wide: 'l'}, on: {parts: 'ghost', open: 'ghost', extract: 'on'}, diag: 'hide'},
    {a: 'md', sa: {tall: 'b', wide: 'r'}, fa: {tall: 0.6}, b: 'memo', sb: {tall: 't', wide: 'l'}, fb: {tall: 0.2, wide: 0.24}, on: {parts: 'ghost', open: 'ghost', extract: 'on'}, diag: 'hide'},
    {a: 'json', sa: {tall: 'b', wide: 'r'}, fa: {tall: 0.4}, b: 'memo', sb: {tall: 't', wide: 'l'}, fb: {tall: 0.8, wide: 0.68}, on: {parts: 'ghost', open: 'ghost', extract: 'on'}, diag: 'hide'},
    {a: 'md', sa: 'b', fa: {tall: 0.4, wide: 0.78}, b: 'door', sb: 't', on: {parts: 'diag', open: 'diag', extract: 'diag'}, diagOnly: true},
    {a: 'door', sa: 'r', b: 'memo', sb: 'l', on: {parts: 'diag', open: 'diag', extract: 'diag'}, diagOnly: true}
  ];
  const DIM = {parts: ['md', 'json', 'memo'], open: ['mdgen', 'ext', 'md', 'json', 'memo'], extract: []};

  const $ = id => document.getElementById(id);
  const root = document.documentElement, map = $('map'), svg = map.querySelector('svg.links'), layer = $('link-layer');
  const OBJ = Object.fromEntries(Array.from(map.querySelectorAll('[data-o]'), node => [node.dataset.o, node]));
  const field = name => map.querySelector(`[data-f="${name}"]`);
  const wideMQ = matchMedia('(min-width: 1000px), (min-width: 700px) and (orientation: landscape)');
  const calmMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {stage: 'parts', doc: 'export', lastDoc: 'export', part: 'browser', layout: wideMQ.matches ? 'wide' : 'tall'};
  let M = null, shown = null, anim = 0, loading = 0, joinTimers = [], mdUrl = null;

  function el(tag, props = {}, kids = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') n.textContent = v; else if (k === 'className') n.className = v; else n.setAttribute(k, v);
    }
    for (const kid of [].concat(kids)) if (kid !== null && kid !== undefined) n.append(kid);
    return n;
  }
  const a = (href, text) => el('a', {href, text});
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

  // ---------- 表示の色 ----------

  function setTheme(choice, save) {
    if (!['light', 'dark', 'system'].includes(choice)) choice = 'system';
    if (choice === 'system') root.removeAttribute('data-theme'); else root.dataset.theme = choice;
    document.querySelectorAll('[data-theme-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice)));
    if (save) { try { localStorage.setItem(THEME_KEY, choice); } catch { /* 保存できない環境では今回の表示だけ切り替える */ } }
  }
  let stored = 'system';
  try { stored = localStorage.getItem(THEME_KEY) || 'system'; } catch { /* 読めなければ端末の設定 */ }
  setTheme(stored, false);
  document.querySelectorAll('[data-theme-choice]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeChoice, true)));

  // 以前のページの #start・#missing・#files などは、元の実結果ビューア（desk.html）へ案内する。
  const hashId = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; } };
  function legacy() {
    const h = hashId(), box = $('legacy');
    const ok = LEGACY.includes(h);
    box.hidden = !ok;
    if (ok) box.replaceChildren(`以前のページの「#${h}」は、元の実結果ビューアにあります。`, ' ', a(`desk.html#${h}`, `desk.html#${h} を開く`));
    return ok ? h : '';
  }
  legacy();
  window.addEventListener('hashchange', () => {
    const h = legacy();
    if (M && (DOCS.includes(h) || h === 'missing')) choose('doc', h);
  });

  // ---------- 照合 ----------

  const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const utf8 = buf => new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(buf);
  const need = (ok, what) => { if (!ok) throw new Error(`保存データが図の説明と一致しません（${what}）。`); };
  async function bytes(path) {
    let res;
    try { res = await fetch(path, {cache: 'no-store'}); }
    catch { throw new Error(`${path} を読み込めませんでした。HTTPで配信したページを開いてください。`); }
    if (!res.ok) throw new Error(`${path} を読み込めませんでした（HTTP ${res.status}）。`);
    return res.arrayBuffer();
  }
  const sha = async buf => hex(await crypto.subtle.digest('SHA-256', buf));

  async function load() {
    need(window.crypto && crypto.subtle, 'SHA-256はHTTPSかlocalhostで使えます');
    const raw = await bytes('concept/manifest.json');
    need(await sha(raw) === PIN, 'concept/manifest.json の固定SHA-256');
    let man;
    try { man = JSON.parse(utf8(raw)); } catch { throw new Error('concept/manifest.json を読めません。'); }
    need(man.format === 'studio-yebisu-assets/v1' && man.case_id === CASE && man.source_commit === COMMIT, '素材一覧の形式');
    const files = Array.isArray(man.files) ? man.files : [];
    need(files.length === PATHS.length && PATHS.every(p => files.filter(f => f.path === p).length === 1), '素材一覧の17件');
    const text = {};
    await Promise.all(files.map(async f => {
      const buf = await bytes(f.path);
      if (buf.byteLength !== f.bytes || await sha(buf) !== f.sha256) throw new Error(`${f.path} のバイト数またはSHA-256が素材一覧と一致しません。`);
      try { text[f.path] = utf8(buf); } catch { throw new Error(`${f.path} がUTF-8として読めません。`); }
    }));
    return model(text, files);
  }

  function mdLines(md, sections) {
    const kps = new Set(sections.map(s => s.keypoint));
    return md.split('\n').filter(Boolean).map(line =>
      line.startsWith('## ') ? {c: 'l2', t: line} : line.startsWith('# ') ? {c: 'l1', t: line} : {c: kps.has(line) ? 'p kp' : 'p pn', t: ''});
  }

  function model(text, files) {
    const json = p => { try { return JSON.parse(text[p]); } catch { throw new Error(`${p} をJSONとして読めません。`); } };
    const lines = p => text[p].split(/\r?\n/);
    const file = p => files.find(f => f.path === p);
    const st = json('concept/structure.json'), runs = json(RUNS.path), samples = json('samples.json'), brief = json('brief.json');
    json('verification.json');
    need(file(RUNS.path).bytes === RUNS.bytes && file(RUNS.path).sha256 === RUNS.sha256, 'runs.json の期待値');
    need(file(MEMO.path).bytes === MEMO.bytes && file(MEMO.path).sha256 === MEMO.sha256, 'result.md の期待値');

    need(st.format === 'crawl4ai-structure/v1' && st.case_id === CASE && st.source_commit === COMMIT && st.version === VERSION, 'structure.json の形式と固定版');
    need(st.definition === DEFINITION, '一行の定義');
    const parts = Array.isArray(st.parts) ? st.parts : [];
    need(parts.length === 4 && PART_IDS.every((id, i) => parts[i] && parts[i].id === id), '4つの部品ID');
    for (const p of parts) need(PATHS.includes(p.source_path) && (lines(p.source_path)[p.line_start - 1] || '').includes(p.quote), `部品「${p.label}」の引用`);
    const sdocs = Array.isArray(st.documents) ? st.documents : [];
    need(sdocs.length === 3 && DOCS.every((id, i) => sdocs[i].id === id), '3ページのID');
    need(sdocs.map(d => d.source_section_count).join() === '2,2,1' && sdocs.map(d => d.rendered_section_count).join() === '2,2,2', '節の数（元のHTML 2・2・1、描画後 2・2・2）');
    need(sdocs[0].origins.join() === 'html,html' && sdocs[1].origins.join() === 'html,html' && sdocs[2].origins.join() === 'html,script', '節の出どころ');
    need(same(st.schema, SCHEMA) && same(st.selectors, SELECTORS), 'スキーマとセレクター');
    const sd = st.diagnostic || {};
    need(sd.status_code === 404 && sd.success === true && sd.accepted === false && sd.extracted_content === null && sd.extraction_configured === false, '診断の記録');
    const ax = st.actual_execution || {};
    need(ax.arun_calls === 4 && ax.accepted_documents === 3 && ax.sections === 6 && ax.inference_used === false && ax.live_in_this_browser === false, '実行の範囲');
    need(st.license && st.license.required_attribution === ATTR_REQ && st.license.readme_attribution === ATTR_USE, '帰属表示');

    need(runs.format === 'studio-yebisu/crawl4ai-example-runs@1', 'runs.json の形式');
    const lib = runs.library || {};
    need(lib.name === 'Crawl4AI' && lib.version === VERSION && lib.commit === COMMIT && lib.attribution === ATTR_USE, 'ライブラリの版と固定コミット');
    need(same(runs.schema, SCHEMA) && same(runs.selectors, SELECTORS), '実行時のスキーマとセレクター');
    const bc = (runs.browser || {}).config || {};
    need(bc.headless === true && bc.channel === 'chrome', 'BrowserConfig');
    need(Array.isArray(runs.requests) && runs.requests.length === 4, 'arun 4回');
    const rdocs = Array.isArray(runs.documents) ? runs.documents : [];
    need(rdocs.length === 3 && DOCS.every((id, i) => rdocs[i].id === id), '実行結果の3ページ');
    const docs = {};
    rdocs.forEach((d, i) => {
      const s = sdocs[i], r = d.response || {}, cfg = (d.request || {}).config || {}, path = FIX[d.id], html = text[path];
      need(d.accepted === true && r.status_code === 200 && r.success === true, `${d.label}：HTTP 200・success`);
      need(d.input_html && d.input_html.path === path && d.input_html.sha256 === file(path).sha256 && d.input_html.text === html, `${d.label}：元のHTML`);
      let parsed = null;
      try { parsed = JSON.parse(r.extracted_content); } catch { /* 下の照合で止める */ }
      need(Array.isArray(d.sections) && d.sections.length === 2 && same(parsed, d.sections) && same(s.sections, d.sections), `${d.label}：取り出した節`);
      need(same(d.section_origins, s.origins), `${d.label}：節の出どころ`);
      need(typeof r.markdown === 'string' && d.sections.every(x => r.markdown.includes(x.heading) && r.markdown.includes(x.keypoint)), `${d.label}：Markdown`);
      need(cfg.css_selector === SELECTORS.css_selector && cfg.wait_for === SELECTORS.wait_for && same(cfg.excluded_tags, SELECTORS.excluded_tags) &&
        cfg.extraction_strategy && cfg.extraction_strategy.class === 'JsonCssExtractionStrategy' && same(cfg.extraction_strategy.schema, SCHEMA) &&
        cfg.markdown_generator && cfg.markdown_generator.class === 'DefaultMarkdownGenerator', `${d.label}：設定`);
      need((html.match(/<article class="doc-section">/g) || []).length === s.source_section_count, `${d.label}：元のHTMLの節の数`);
      const ready = (/<main id="guide" data-ready="(true|false)">/.exec(html) || [])[1];
      need(ready === (d.id === 'export' ? 'false' : 'true'), `${d.label}：data-ready`);
      docs[d.id] = {id: d.id, label: d.label, title: d.title, h1: d.title.split('｜')[0], path: d.path, file: path, sections: d.sections,
        origins: d.section_origins, src: s.source_section_count, rendered: s.rendered_section_count, ready, md: r.markdown,
        extracted: r.extracted_content, status: r.status_code, success: r.success, cfg, lines: mdLines(r.markdown, d.sections)};
    });
    const ex = rdocs[2], js = text[FIX.js], added = ex.sections[1];
    need(ex.input_script && ex.input_script.path === FIX.js && ex.input_script.sha256 === file(FIX.js).sha256 && ex.input_script.text === js, 'dynamic-export.js');
    need(js.includes(JSON.stringify(added.heading)) && js.includes(JSON.stringify(added.keypoint)) && !text[FIX.export].includes(added.heading), 'JSが加える節');
    const dyn = st.dynamic || {};
    need(dyn.document_id === 'export' && dyn.heading === added.heading && js.includes(`window.setTimeout(addSection, ${dyn.delay_in_fixture_ms});`) &&
      js.includes('guide.setAttribute("data-ready", "true");'), 'JSの追加とready');
    docs.export.script = FIX.js;

    const dg = runs.diagnostic || {}, dr = dg.response || {}, dc = (dg.request || {}).config || {};
    need(dg.id === 'missing' && dr.status_code === 404 && dr.success === true && dg.accepted === false && dr.extracted_content === null && dg.counted_as_document === false, '診断：HTTP 404・success true・受理しない');
    need(!('wait_for' in dc) && !('css_selector' in dc) && !('extraction_strategy' in dc) && dc.markdown_generator, '診断の設定（待機・範囲・抽出なし）');
    need(typeof dr.markdown === 'string' && dr.markdown.includes('404'), '診断のMarkdown');
    const mdl = dr.markdown.split('\n').filter(Boolean);
    const diag = {id: 'missing', label: dg.label, path: dg.path, status: dr.status_code, success: dr.success, accepted: dg.accepted, md: dr.markdown,
      error: dr.error_message, cfg: dc, h1: mdl[0].replace(/^# /, ''), err: mdl.slice(1, 3).join('\n'), lines: mdLines(dr.markdown, [])};

    const checks = Array.isArray(runs.checks) ? runs.checks : [];
    need(checks.length > 0 && checks.every(c => c.passed === true), 'workflow.py の照合記録');
    const log = Array.isArray(runs.access_log) ? runs.access_log : [];
    const lp = log.map(x => String(x.path || '').split('?')[0]);
    need(!lp.includes('/not-selected.html') && lp.includes('/robots.txt'), 'サーバーの記録');

    const memo = text[MEMO.path];
    need(memo.startsWith('# Crawl4AI 作例') && memo.includes(ATTR_USE) && rdocs.every(d => memo.includes(`### ${d.title}`)), 'result.md の中身');
    need(text[LIC].includes(`"${ATTR_REQ}"`) && text[LIC].includes('Attribution Requirement') && text[README].includes(ATTR_USE) &&
      text['NOTICE.txt'].includes(ATTR_REQ) && text['NOTICE.txt'].includes(ATTR_USE), 'ライセンスと帰属表示');
    need(text['request.txt'].includes(COMMIT), 'request.txt の固定版');
    need(samples.format === 'input-output' && Array.isArray(samples.samples) && samples.samples.length === 4, 'samples.json');
    need(typeof brief.title === 'string' && brief.title.includes('Crawl4AI'), 'brief.json');

    const excerpt = ([path, from, to, must]) => {
      const body = lines(path).slice(from - 1, to).join('\n');
      need(body.includes(must), `${path} L${from} の元の行`);
      const remote = path.startsWith(V) ? `${BLOB}${path.slice(V.length)}#L${from}${to > from ? '-L' + to : ''}` : null;
      return {path, from, to, body, remote};
    };
    const ex2 = {};
    for (const [part, list] of Object.entries(EXCERPTS)) ex2[part] = list.map(excerpt);
    return {
      st, runs, files, docs, diag, checks, log: lp, request: text['request.txt'],
      parts: Object.fromEntries(parts.map(p => [p.id, p])),
      ex: ex2, use: USE.map(excerpt), accept: excerpt(ACCEPT), diagCfg: excerpt(DIAG_CFG), jsAdd: excerpt(JS_ADD),
      accepted: rdocs.filter(d => d.accepted === true).length, sections: rdocs.reduce((n, d) => n + d.sections.length, 0)
    };
  }

  // ---------- 図 ----------

  const pct = (v, total) => `${(v / total * 100).toFixed(3)}%`;
  const pick = v => (v && typeof v === 'object' ? v[state.layout] : v);
  const isDiag = () => state.doc === 'missing';
  function rectsFor(stage) {
    const L = LAYOUT[state.layout];
    const r = {...L.parts, ...L[stage]};
    if (isDiag()) {
      Object.assign(r, L.diag);
      if (state.layout === 'wide') { const [x, y, , h] = r.json; r.json = [x, y, 96, h]; r.door = [x + 102, y, 98, h]; }
    }
    if (stage === 'open' && state.doc === 'export' && map.dataset.join === 'out') r.sec1 = r.sec1Out;
    delete r.sec1Out;
    return r;
  }
  function side(r, s, f = 0.5) {
    const [x, y, w, h] = r;
    if (s === 't') return {x: x + w * f, y, dx: 0, dy: -1};
    if (s === 'b') return {x: x + w * f, y: y + h, dx: 0, dy: 1};
    if (s === 'l') return {x, y: y + h * f, dx: -1, dy: 0};
    return {x: x + w, y: y + h * f, dx: 1, dy: 0};
  }
  function curve(p, q) {
    const k = Math.max(8, Math.hypot(q.x - p.x, q.y - p.y) * 0.42);
    return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}C${(p.x + p.dx * k).toFixed(1)} ${(p.y + p.dy * k).toFixed(1)} ${(q.x + q.dx * k).toFixed(1)} ${(q.y + q.dy * k).toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }
  const paths = LINKS.map(() => layer.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path')));
  function linkClass(l) {
    if (l.diagOnly && !isDiag()) return 'hide';
    if (isDiag() && l.diag === 'hide') return 'hide';
    return l.on[state.stage] || 'hide';
  }
  function ends(l, rects) {
    const docId = DOC_OBJ[isDiag() ? state.lastDoc : state.doc];
    const A = l.a === '@doc' ? docId : l.a;
    let fb = pick(l.fb);
    if (l.a === '@doc' && state.layout === 'tall') { const [x, , w] = rects[A]; fb = (x + w / 2) / rects.call[2]; }
    return [side(rects[A], pick(l.sa), pick(l.fa) ?? 0.5), side(rects[l.b], pick(l.sb), fb ?? 0.5)];
  }
  function drawLinks(rects) {
    LINKS.forEach((l, i) => { const [p, q] = ends(l, rects); paths[i].setAttribute('d', curve(p, q)); });
  }
  function moveLinks(from, to, animate) {
    cancelAnimationFrame(anim);
    if (!animate || calmMQ.matches || !from) { drawLinks(to); return; }
    const t0 = performance.now(), out = p => 1 - Math.pow(1 - p, 3);
    const step = now => {
      const p = out(Math.min(1, (now - t0) / 600)), mid = {};
      for (const id in to) mid[id] = to[id].map((v, k) => from[id][k] + (v - from[id][k]) * p);
      drawLinks(mid);
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function place(animate) {
    const L = LAYOUT[state.layout], to = rectsFor(state.stage);
    map.dataset.layout = state.layout;
    map.dataset.stage = state.stage;
    svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
    for (const [id, [x, y, w, h]] of Object.entries(to)) {
      const s = OBJ[id].style;
      s.left = pct(x, L.w); s.top = pct(y, L.h); s.width = pct(w, L.w); s.height = pct(h, L.h);
    }
    moveLinks(shown, to, animate);
    shown = to;
  }
  function relayout() {
    state.layout = wideMQ.matches ? 'wide' : 'tall';
    shown = null;
    map.classList.add('instant');
    place(false);
    void map.offsetWidth;
    map.classList.remove('instant');
  }
  (wideMQ.addEventListener ? wideMQ.addEventListener.bind(wideMQ, 'change') : wideMQ.addListener.bind(wideMQ))(relayout);

  // 書き出しページを「開いて待つ」で見るとき：2節目がページのJSから加わり、data-ready が true になってから門が開く。
  function clearJoin() { joinTimers.forEach(clearTimeout); joinTimers = []; }
  function readyText() {
    field('ready').textContent = isDiag() ? 'wait_for なし' : `data-ready="${map.dataset.ready}"`;
  }
  function startJoin() {
    clearJoin();
    if (!(state.stage === 'open' && state.doc === 'export') || calmMQ.matches) {
      map.dataset.join = 'in'; map.dataset.ready = 'true'; readyText();
      return;
    }
    map.dataset.join = 'out'; map.dataset.ready = 'false'; readyText();
    const s = OBJ.sec1;
    s.style.transition = 'none';
    const [x, y, w, h] = LAYOUT[state.layout].open.sec1Out, L = LAYOUT[state.layout];
    s.style.left = pct(x, L.w); s.style.top = pct(y, L.h); s.style.width = pct(w, L.w); s.style.height = pct(h, L.h);
    void s.offsetWidth;
    s.style.transition = '';
    joinTimers.push(setTimeout(() => { map.dataset.join = 'in'; place(false); }, 750));
    joinTimers.push(setTimeout(() => { map.dataset.ready = 'true'; readyText(); }, 1450));
  }

  // ---------- 中身（照合済みデータから） ----------

  function fillDoc() {
    const set = (name, value) => { field(name).textContent = value; };
    const d = isDiag() ? M.diag : M.docs[state.doc];
    map.dataset.doc = state.doc;
    set('url', d.path);
    set('addr', d.path);
    set('h1', d.h1);
    set('err', isDiag() ? d.err : '');
    if (!isDiag()) {
      d.sections.forEach((s, i) => {
        set(`h${i === 0 ? '0' : '1s'}`, s.heading);
        set(`k${i}`, s.keypoint);
        set(`o${i}`, d.origins[i] === 'script' ? 'JS' : '');
      });
    }
    const cfg = d.cfg;
    field('rcfg').replaceChildren(
      ...['wait_for', 'css_selector', 'excluded_tags'].map(k => el('li', {className: k in cfg ? '' : 'off', text: k})),
      ...['markdown_generator', 'extraction_strategy'].map(k => el('li', {className: `out${k in cfg ? '' : ' off'}`, text: k})));
    const o = cfg.markdown_generator.options || {};
    set('mdopt', `ignore_links ${o.ignore_links}・body_width ${o.body_width}`);
    set('gateLabel', isDiag() ? '待機なし' : '描画を待つ');
    set('extLabel', isDiag() ? '抽出なし（未設定）' : '項目の型');
    field('holes').replaceChildren(...(isDiag() ? [el('i', {text: '未設定'})]
      : [el('i', {text: M.runs.schema.baseSelector}), ...M.runs.schema.fields.map(f => el('i', {text: `${f.selector}→${f.name}`}))]));
    field('mdl').replaceChildren(...d.lines.map(l => el('span', {className: l.c, text: l.t})));
    set('nul', 'extracted_content: null');
  }

  function fillStatic() {
    const set = (name, value) => { field(name).textContent = value; };
    set('lib', `Crawl4AI ${M.runs.library.version}`);
    const bc = M.runs.browser.config;
    set('bcfg', `headless ${bc.headless}・${bc.channel}`);
    set('doorHttp', `HTTP ${M.diag.status}`);
    set('doorFlag', `success: ${M.diag.success}`);
    set('memoName', MEMO.path.split('/').pop());
    set('memo', `${M.accepted}ページ・${M.sections}節（workflow.py が作成）`);
    for (const id of ['memo-dl', 'memo-dl2']) { const link = $(id); link.href = MEMO.path; link.removeAttribute('aria-disabled'); }
    const runsLink = $('runs-dl'); runsLink.href = RUNS.path; runsLink.removeAttribute('aria-disabled');
    $('request').value = M.request;
    $('copy').disabled = false;
    $('use-src').replaceChildren(...M.use.map(excerptBlock));
    details();
  }

  function dl(pairs) {
    return el('dl', {className: 'facts'}, pairs.flatMap(([k, v]) => [el('dt', {text: k}), el('dd', {}, v)]));
  }
  function excerptBlock(x) {
    return el('details', {className: 'src'}, [
      el('summary', {text: `元の行：${x.path} L${x.from}${x.to > x.from ? '–' + x.to : ''}`}),
      el('pre', {}, el('code', {text: x.body})),
      el('p', {}, x.remote ? [a(x.remote, '固定版をGitHubで開く'), ' · ', a(x.path, '同梱ファイル')] : [a(x.path, 'ファイルを開く')])
    ]);
  }
  function details() {
    const st = M.st, runs = M.runs;
    const n = name => M.log.filter(p => p === name).length;
    $('d-scope').replaceChildren(
      el('p', {text: runs.scope_note}),
      el('p', {text: `この図は、制作担当が実行して保存した arun ${st.actual_execution.arun_calls}回（3ページと診断1件）の記録を再生します。この画面では取得も Crawl4AI の実行もしていません。言語モデルによる推論や要約も使っていません。`}),
      el('p', {text: `fixture を配ったサーバーの記録は${M.log.length}件（robots.txt ${n('/robots.txt')}回、選ばないページ ${n('/not-selected.html')}回）。これは手元のサーバーに届いたリクエストだけの記録で、外部への通信が無かったことの観測ではありません。`}),
      el('p', {text: runs.url_note}),
      el('p', {text: `workflow.py の照合：保存された記録では${M.checks.length}件すべてが通過。実装と実行結果の照合で、品質の評価や人の承認ではありません。待機は手元の架空ページで確かめただけで、ほかのサイトでの動作・精度・速さは試していません。`}),
      el('p', {}, [a('verification.json', '制作時の確認記録（verification.json）'), ' · ', a('desk.html#checks', '照合の一覧（元の実結果ビューア）')]));
    $('d-parts').replaceChildren(
      el('p', {text: st.editorial_note}),
      el('ul', {}, st.flow.parallel_outputs.map(s => el('li', {text: s}))),
      el('p', {text: st.flow.combined_memo}),
      el('p', {text: st.flow.acceptance}));
    $('d-pin').replaceChildren(dl([
      ['ライブラリ', `Crawl4AI ${runs.library.version}`],
      ['固定コミット', a(`https://github.com/unclecode/crawl4ai/tree/${COMMIT}`, `unclecode/crawl4ai @ ${COMMIT}`)],
      ['インストール元', el('code', {text: runs.library.install_source})],
      ['補足', runs.library.commit_note],
      ['同梱した原典', el('span', {}, [a(README, 'README.md'), '・', a(LIC, 'LICENSE'), '・', a(V + 'pyproject.toml', 'pyproject.toml'), '・', a(MDDOC, 'markdown-generation.md'), '・', a(NOLLM, 'no-llm-strategies.md')])],
      ['制作記録', '同梱した公式の5ファイルと、制作時にインストールしたライブラリの86ファイルを、固定版の公式Gitツリーと照合した（制作担当の記録）。']
    ]));
    $('d-assets').replaceChildren(el('p', {text: `素材一覧 concept/manifest.json（SHA-256 ${PIN}）を照合し、次の${M.files.length}件のバイト数とSHA-256を確かめてから図を描いています。`}),
      el('ul', {className: 'assets'}, M.files.map(f => el('li', {}, [a(f.path, f.path), ` ${f.bytes.toLocaleString('en-US')} bytes · `, el('code', {text: f.sha256.slice(0, 16) + '…'})]))));
  }

  // ---------- 選択と読み出し ----------

  function note() {
    if (isDiag()) {
      return {parts: '診断：存在しないページ。待機・本文の範囲・抽出の設定は渡していません。',
        open: `HTTP ${M.diag.status} のページが開く。wait_for は付けていないので待ちません。`,
        extract: `文章は作られても HTTP ${M.diag.status}。success は ${M.diag.success} でも採用せず、診断として別に残します。`}[state.stage];
    }
    const d = M.docs[state.doc];
    if (state.stage === 'parts') return 'URLと設定をPythonで渡す → Chromeで開く → 本文を文章（Markdown）と項目（JSON）の2つへ。';
    if (state.stage === 'open') {
      return d.src < d.rendered
        ? `元のHTMLは${d.src}節。ページのJSが${d.rendered - d.src}節を加え、data-ready が true になってから先へ進みます。`
        : `元のHTMLに${d.src}節。data-ready は最初から true なので、すぐ先へ進みます。`;
    }
    return `main#guide だけを使い nav・footer を除く。同じ${d.sections.length}節を、文章と項目へ並行して出します。`;
  }

  function docReadout() {
    if (mdUrl) { URL.revokeObjectURL(mdUrl); mdUrl = null; }
    if (isDiag()) {
      const g = M.diag;
      $('ro-doc-h').textContent = `診断：${g.path}`;
      $('ro-doc').replaceChildren(...[
        ['HTTP ステータス', String(g.status)],
        ['ライブラリの success', String(g.success)],
        ['この作例での受理', `しない（success かつ HTTP 200 のときだけ受理）`],
        ['extracted_content', 'null（抽出の設定を渡していない）'],
        ['設定の注記', g.cfg.note || ''],
        ['error_message', g.error ? g.error : '（空）']
      ].flatMap(([k, v]) => [el('dt', {text: k}), el('dd', {text: v})]));
      $('ro-doc-more').replaceChildren(
        el('p', {className: 'note', text: 'success はライブラリがページを受け取って処理できたかの旗で、HTTP の成否とは別です。3ページの件数には数えていません。'}),
        el('details', {className: 'src'}, [el('summary', {text: 'response.markdown（404 のページから作られた文字列そのまま）'}), el('pre', {className: 'raw wrap'}, el('code', {text: g.md}))]),
        excerptBlock(M.accept), excerptBlock(M.diagCfg),
        el('p', {}, a('desk.html#missing', '元の実結果ビューアで「取得エラー」を開く')));
      return;
    }
    const d = M.docs[state.doc];
    $('ro-doc-h').textContent = `選んだページ：${d.label}`;
    const input = el('span', {}, [a(d.file, d.file)].concat(d.script ? [' と ', a(d.script, d.script)] : []));
    $('ro-doc').replaceChildren(...[
      ['入力', input],
      ['節の数', `元のHTML ${d.src} → 描画後 ${d.rendered}${d.src < d.rendered ? '（足りない分はページのJSが追加）' : ''}`],
      ['待機', `wait_for: ${d.cfg.wait_for}（元のHTMLの data-ready は "${d.ready}"）`],
      ['本文の範囲', `css_selector: ${d.cfg.css_selector}・excluded_tags: ${d.cfg.excluded_tags.join(', ')}`],
      ['結果', `HTTP ${d.status}・success: ${d.success} → 受理`]
    ].flatMap(([k, v]) => [el('dt', {text: k}), el('dd', {}, v)]));
    mdUrl = URL.createObjectURL(new Blob([d.md], {type: 'text/markdown;charset=utf-8'}));
    $('ro-doc-more').replaceChildren(
      el('ol', {className: 'pairs', 'aria-label': '取り出した見出しと要点'}, d.sections.map((s, i) => el('li', {}, [
        el('span', {className: 'ph', text: s.heading}),
        el('span', {className: 'pk', text: s.keypoint}),
        el('span', {className: `po${d.origins[i] === 'script' ? ' script' : ''}`, text: d.origins[i] === 'script' ? 'JavaScriptが追加した節' : '元のHTMLにある節'})]))),
      el('p', {className: 'note', text: '要点（keypoint）は、各節の p.keypoint の文を CSS セレクターでそのまま取り出したもので、AIの要約ではありません。p.note の文は Markdown には残り、JSON には入りません。'}),
      el('details', {className: 'src'}, [el('summary', {text: 'このページの Markdown（response.markdown・そのまま）'}),
        el('pre', {className: 'raw wrap'}, el('code', {text: d.md})),
        el('p', {}, el('a', {className: 'btn-quiet', href: mdUrl, download: `${d.id}.md`, text: `${d.id}.md として保存`})),
        el('p', {className: 'note', text: 'ライブラリがこの1ページから作った文字列です。全体の結果メモ（result.md）とは別物です。'})]),
      el('details', {className: 'src'}, [el('summary', {text: 'extracted_content（ライブラリが返した文字列そのまま）'}), el('pre', {className: 'raw'}, el('code', {text: d.extracted}))]),
      ...(d.script ? [excerptBlock(M.jsAdd)] : []),
      el('p', {}, a(`desk.html#${d.id}`, `元の実結果ビューアで「${d.label}」を開く`)));
  }

  function partReadout() {
    const p = M.parts[state.part], d = isDiag() ? null : M.docs[state.doc], cfg = (d || M.docs.export).cfg, bc = M.runs.browser.config;
    const values = {
      browser: [['headless', String(bc.headless)], ['channel', bc.channel], ['use_persistent_context', String(bc.use_persistent_context)]],
      scope: [['wait_for', cfg.wait_for], ['css_selector', cfg.css_selector], ['excluded_tags', cfg.excluded_tags.join(', ')],
        ['page_timeout', String(cfg.page_timeout)], ['cache_mode', cfg.cache_mode], ['check_robots_txt', String(cfg.check_robots_txt)]],
      fields: [['baseSelector', M.runs.schema.baseSelector], ...M.runs.schema.fields.map(f => [f.name, `${f.selector}（${f.type}）`])],
      markdown: Object.entries(cfg.markdown_generator.options).map(([k, v]) => [k, String(v)])
    }[state.part];
    $('ro-part').replaceChildren(
      el('p', {className: 'meaning', text: `${p.label}：${p.meaning}`}),
      el('p', {className: 'note'}, ['API：', el('code', {text: p.api})]),
      el('h3', {className: 'sub', text: `今回の設定（3ページ共通${isDiag() ? '・診断では一部なし' : ''}）`}),
      dl(values.map(([k, v]) => [k, el('code', {text: v})])),
      ...M.ex[state.part].map(excerptBlock));
  }

  function update(animate) {
    place(animate);
    const dim = new Set([...DIM[state.stage], ...(isDiag() ? ['ext', 'json'] : [])]);
    for (const [id, node] of Object.entries(OBJ)) {
      const gone = (id === 'js' && !(state.doc === 'export' && state.stage === 'open')) || (id === 'door' && !isDiag()) || ((id === 'sec0' || id === 'sec1') && isDiag());
      node.classList.toggle('gone', gone);
      node.classList.toggle('dim', !gone && dim.has(id));
    }
    map.querySelectorAll('button.doc').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.doc === state.doc)));
    $('diag').setAttribute('aria-pressed', String(isDiag()));
    map.querySelectorAll('[data-part]').forEach(n => n.classList.toggle('sel', n.dataset.part === state.part));
    document.querySelectorAll('[data-part-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.partChoice === state.part)));
    document.querySelectorAll('button[data-stage]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.stage === state.stage)));
    LINKS.forEach((l, i) => {
      const c = linkClass(l);
      paths[i].setAttribute('class', `ln ${c}`);
      paths[i].setAttribute('marker-end', c === 'on' ? 'url(#ah-on)' : c === 'base' || c === 'diag' ? 'url(#ah)' : '');
    });
    readyText();
    $('stage-note').textContent = `${STAGE[state.stage]}：${note()}`;
  }

  function choose(key, value) {
    if (!M || state[key] === value) return;
    state[key] = value;
    if (key === 'doc' && value !== 'missing') state.lastDoc = value;
    if (key === 'part') { update(false); partReadout(); return; }
    fillDoc();
    if (key === 'stage' || key === 'doc') startJoin();
    update(true);
    docReadout(); partReadout();
  }
  document.querySelectorAll('button[data-stage]').forEach(b => b.addEventListener('click', () => choose('stage', b.dataset.stage)));
  map.querySelectorAll('button.doc').forEach(b => b.addEventListener('click', () => choose('doc', b.dataset.doc)));
  $('diag').addEventListener('click', () => choose('doc', isDiag() ? state.lastDoc : 'missing'));
  document.querySelectorAll('[data-part-choice]').forEach(b => b.addEventListener('click', () => choose('part', b.dataset.partChoice)));

  $('copy').addEventListener('click', async () => {
    if (!M) return;
    const area = $('request');
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard');
      await navigator.clipboard.writeText(M.request);
      $('copy-status').textContent = '依頼文をコピーしました。';
    } catch {
      area.focus();
      area.select();
      area.setSelectionRange(0, area.value.length);
      let ok = false;
      try { ok = document.execCommand && document.execCommand('copy'); } catch { ok = false; }
      $('copy-status').textContent = ok ? '依頼文をコピーしました。' : '自動でコピーできませんでした。依頼文を選択したので、長押しか Ctrl+C（Mac は ⌘C）でコピーしてください。';
    }
  });

  // ---------- 読み込み・失敗・再試行 ----------

  function controls(on) {
    document.querySelectorAll('button[data-stage], #map button.doc, #diag').forEach(b => { b.disabled = !on; });
  }
  function clear() {
    M = null;
    clearJoin();
    controls(false);
    $('copy').disabled = true;
    for (const id of ['memo-dl', 'memo-dl2', 'runs-dl']) { const link = $(id); link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
    if (mdUrl) { URL.revokeObjectURL(mdUrl); mdUrl = null; }
    map.querySelectorAll('[data-f]').forEach(n => n.replaceChildren());
    ['ro-doc', 'ro-doc-more', 'ro-part', 'ro-doc-h', 'use-src', 'copy-status', 'd-scope', 'd-parts', 'd-pin', 'd-assets', 'stage-note'].forEach(id => $(id).replaceChildren());
    $('request').value = '';
    layer.querySelectorAll('path').forEach(p => p.setAttribute('d', ''));
    $('readout').hidden = true;
  }
  async function start() {
    const run = ++loading;
    clear();
    map.dataset.state = 'loading';
    $('fail').hidden = true; $('load').hidden = false;
    try {
      const m = await load();
      if (run !== loading) return;
      M = m;
      const h = hashId();
      if (DOCS.includes(h) || h === 'missing') { state.doc = h; if (h !== 'missing') state.lastDoc = h; }
      fillStatic();
      fillDoc();
      map.dataset.state = 'ready';
      $('load').hidden = true;
      $('readout').hidden = false;
      controls(true);
      shown = null;
      startJoin();
      update(false);
      docReadout(); partReadout();
    } catch (err) {
      if (run !== loading) return;
      clear();
      map.dataset.state = 'error';
      $('load').hidden = true;
      $('fail-msg').textContent = err && err.message ? err.message : String(err);
      $('fail').hidden = false;
    }
  }
  $('retry').addEventListener('click', start);
  relayout();
  start();
})();
