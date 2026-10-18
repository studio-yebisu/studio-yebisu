// Studio Yebisu：Crawl4AI 作例 — 32秒・無音の図解（縦 720×1280 ／ 横 1280×720）
// Copyright (c) 2026 Studio Yebisu. MIT License.
// concept/manifest.json を固定SHA-256で照合し、17素材のバイト数・SHA-256・内容を確かめてから、
// window.seek(秒) がその時刻の完成した1枚を Canvas に描く。保存済みの実行を図にするだけで、
// Crawl4AI・ブラウザー操作・AI はここでは動かない。音声・読み上げ・効果音は無い。
'use strict';
(() => {
  const RC = window.renderConfig || {};
  const RENDER = window.__MOTION_RENDER__ === true;
  const okDim = v => Number.isInteger(v) && v > 0;
  const DURATION = 32, POSTER = 31;
  const FPS = okDim(RC.fps) ? RC.fps : 30;
  const SIZES = {tall: [720, 1280], wide: [1280, 720]};
  let W, H;
  if (okDim(RC.width) && okDim(RC.height)) { W = RC.width; H = RC.height; }
  else { [W, H] = SIZES[new URLSearchParams(location.search).get('layout') === 'wide' ? 'wide' : 'tall']; }
  const publishConfig = () => { window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER, audioEvents: []}; };
  publishConfig();
  window.motionState = 'loading';
  window.motionError = null;
  if (RENDER) document.documentElement.classList.add('render');

  // ---------- 素材（作例ページ app.js と同じ17件・同じ固定値） ----------

  const BASE = '../';
  const PIN = '3d551e51493965163f6d04ff45217904733da852dda723ecb4c2bbe851a79260';
  const CASE = 'crawl4ai-example';
  const COMMIT = '6192d5e5b59cb21f9ca418fd6b798de47c0741d3';
  const VERSION = '0.9.5';
  const RUNS = {path: 'outputs/runs.json', bytes: 33099, sha256: '0b932f3a4ac8190d70ff8e320dc0c0354746bc4ec3279a05d55f591aca4418f5'};
  const MEMO = {path: 'outputs/result.md', bytes: 5852, sha256: 'aba3649b3e65334086b1bf9cf5f708eebf90b6e80c2e6257d30050a0892316e6'};
  const V = 'vendor/crawl4ai/';
  const FIX = {start: 'fixture/docs/start.html', review: 'fixture/docs/review.html', export: 'fixture/docs/export.html', js: 'fixture/docs/dynamic-export.js'};
  const PATHS = ['concept/structure.json', 'brief.json', 'request.txt', 'workflow.py', RUNS.path, MEMO.path, 'samples.json',
    FIX.start, FIX.review, FIX.export, FIX.js, V + 'README.md', V + 'LICENSE', V + 'docs/md_v2/core/markdown-generation.md',
    V + 'docs/md_v2/extraction/no-llm-strategies.md', 'NOTICE.txt', 'verification.json'];
  const ATTR_REQ = 'This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project (https://github.com/unclecode/crawl4ai).';
  const ATTR_USE = 'This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.';
  const SCHEMA = {name: 'Guide sections', baseSelector: 'article.doc-section', fields: [
    {name: 'heading', selector: 'h2', type: 'text'}, {name: 'keypoint', selector: 'p.keypoint', type: 'text'}]};
  const SELECTORS = {css_selector: 'main#guide', excluded_tags: ['nav', 'footer'], wait_for: 'css:#guide[data-ready="true"]', baseSelector: 'article.doc-section'};

  // ---------- 場面（storyboard.json の scenes と同じ秒） ----------

  const SCENES = [
    {id: 'resource', start: 0, end: 4, label: '0 しくみ', caption: 'URLと設定がPythonの呼び出しに集まり、ブラウザーが架空のページを開く。nav・本文・footerが見える。'},
    {id: 'configure', start: 4, end: 9, label: '4 設定', caption: '設定がBrowserConfigとCrawlerRunConfigに分かれ、同じURLのページが広がり、待機の門が現れる。'},
    {id: 'wait', start: 9, end: 14, label: '9 待つ', caption: '書き出しページ：元のHTMLの1節に、ページのJSが2節目を加える。data-readyがtrueになってから門が開く。'},
    {id: 'extract', start: 14, end: 20, label: '14 取り出す', caption: 'main#guideだけを選び、navとfooterを外す。項目の型がh2とp.keypointを見つけ、同じ2節がMarkdownの紙とJSONの項目へ並行して分かれる。'},
    {id: 'pages', start: 20, end: 25, label: '20 3ページ', caption: '保存した3ページが同じ道を通り、3件・6節になる。存在しないページはHTTP 404の門で止まり、3ページの外に診断として残る。'},
    {id: 'save', start: 25, end: 29, label: '25 保存', caption: 'MarkdownとJSONを、workflow.pyが全体の結果メモresult.mdにまとめる。404の診断は別の欄。'},
    {id: 'whole', start: 29, end: 32, label: '29 全体', caption: '全体の流れ：URLと設定→Python→ブラウザー→待つ→本文→文章と項目→保存。手元の架空ページ・保存済み実行の図解・無音。'}
  ];

  // ---------- 色と文字（OSのフォントだけを使う） ----------

  const SANS = 'system-ui,-apple-system,"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo",sans-serif';
  const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","BIZ UDPMincho",serif';
  const MONO = 'ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,monospace';
  const C = {paper: '#f4efe5', paper2: '#ebe4d6', card: '#fffdf8', ink: '#1c2321', soft: '#3d4542', muted: '#5b625d', line: '#d8cfbe',
    link: '#9e937b', petrol: '#1f5f66', petrolSoft: '#dbeae9', amber: '#a86a08', amberSoft: '#f6e3b8', amberInk: '#5f3d00', kit: 'rgba(31,95,102,0.06)'};

  // ---------- 配置（縦と横で組み直す）。[x, y, 幅, 高さ, 不透明度] ----------

  const P = {};
  P.s0 = {url: [-380, 300, 330, 76, 0], cfgB: [780, 300, 110, 76, 0], cfgR: [900, 300, 110, 76, 0], py: [60, 410, 600, 96, 0],
    lib: [40, 630, 640, 530, 0], browser: [60, 560, 600, 0, 0], js: [492, 541, 152, 38, 0], gate: [64, 1048, 592, 90, 0],
    mdf: [64, 858, 284, 116, 0], ext: [372, 858, 284, 116, 0], mdP: [40, 1004, 300, 170, 0], json: [380, 1004, 300, 170, 0],
    d404: [508, 480, 152, 300, 0], memo: [140, 1072, 440, 100, 0],
    c0: [60, 262, 140, 60, 0], c1: [210, 262, 140, 60, 0], c2: [360, 262, 140, 60, 0], cD: [510, 262, 150, 60, 0]};
  P.s1 = {...P.s0, url: [60, 300, 330, 76, 1], cfgB: [420, 300, 110, 76, 1], cfgR: [550, 300, 110, 76, 1], py: [60, 410, 600, 96, 1]};
  P.s1b = {...P.s1, browser: [60, 560, 600, 560, 1]};
  P.s2 = {...P.s1b, url: [60, 262, 600, 60, 1], py: [60, 334, 600, 84, 1], cfgB: [60, 432, 290, 180, 1], cfgR: [370, 432, 290, 180, 1],
    lib: [40, 630, 640, 530, 1], browser: [64, 652, 592, 380, 1], gate: [64, 1048, 592, 90, 1]};
  P.s3 = {...P.s2, cfgB: [60, 432, 290, 64, 1], cfgR: [370, 432, 290, 64, 1], lib: [40, 512, 640, 648, 1], browser: [64, 536, 592, 470, 1],
    js: [492, 541, 152, 38, 1], gate: [64, 1022, 592, 118, 1]};
  P.s4 = {...P.s3, cfgB: [60, 432, 290, 56, 1], cfgR: [370, 432, 290, 56, 1], lib: [40, 500, 640, 488, 1], browser: [64, 520, 592, 290, 1],
    js: [492, 524, 152, 30, 0], gate: [64, 820, 592, 24, 1], mdf: [64, 858, 284, 116, 1], ext: [372, 858, 284, 116, 1],
    mdP: [40, 1004, 300, 170, 1], json: [380, 1004, 300, 170, 1]};
  P.s5 = {...P.s4, c0: [60, 262, 140, 60, 1], c1: [210, 262, 140, 60, 1], c2: [360, 262, 140, 60, 1], cD: [510, 262, 150, 60, 1],
    url: [360, 262, 140, 60, 0], py: [60, 334, 600, 60, 1], cfgB: [60, 404, 290, 44, 1], cfgR: [370, 404, 290, 44, 1],
    lib: [40, 462, 446, 380, 1], browser: [60, 480, 406, 220, 1], gate: [60, 708, 406, 24, 1], mdf: [60, 742, 196, 84, 1], ext: [270, 742, 196, 84, 1],
    mdP: [40, 862, 300, 190, 1], json: [380, 862, 300, 190, 1]};
  P.s5b = {...P.s5, d404: [508, 480, 152, 300, 1]};
  P.s6 = {...P.s5b, memo: [140, 1072, 440, 100, 1]};
  P.s7 = {...P.s6};

  const L = {};
  L.s0 = {url: [-360, 190, 300, 64, 0], cfgB: [1300, 190, 116, 64, 0], cfgR: [1440, 190, 116, 64, 0], py: [64, 270, 560, 80, 0],
    lib: [520, 150, 700, 500, 0], browser: [660, 160, 556, 0, 0], js: [904, 176, 150, 34, 0], gate: [1080, 170, 120, 460, 0],
    mdf: [740, 170, 164, 150, 0], ext: [740, 340, 164, 160, 0], mdP: [936, 150, 284, 230, 0], json: [936, 396, 284, 240, 0],
    d404: [470, 540, 250, 96, 0], memo: [928, 548, 288, 92, 0],
    c0: [64, 170, 180, 52, 0], c1: [64, 232, 180, 52, 0], c2: [64, 294, 180, 52, 0], cD: [64, 372, 180, 52, 0]};
  L.s1 = {...L.s0, url: [64, 190, 300, 64, 1], cfgB: [384, 190, 116, 64, 1], cfgR: [508, 190, 116, 64, 1], py: [64, 270, 560, 80, 1]};
  L.s1b = {...L.s1, browser: [660, 160, 556, 470, 1]};
  L.s2 = {...L.s1b, url: [64, 170, 420, 56, 1], py: [64, 240, 420, 76, 1], cfgB: [64, 336, 200, 170, 1], cfgR: [284, 336, 200, 170, 1],
    lib: [520, 150, 700, 500, 1], browser: [544, 170, 520, 460, 1], gate: [1080, 170, 120, 460, 1]};
  L.s3 = {...L.s2, cfgB: [64, 336, 200, 64, 1], cfgR: [284, 336, 200, 64, 1], js: [904, 176, 150, 34, 1]};
  L.s4 = {...L.s3, url: [64, 170, 300, 52, 1], py: [64, 234, 300, 70, 1], cfgB: [64, 316, 144, 48, 1], cfgR: [220, 316, 144, 48, 1],
    lib: [392, 150, 524, 370, 1], browser: [412, 170, 280, 330, 1], js: [592, 174, 96, 28, 0], gate: [704, 170, 24, 330, 1],
    mdf: [740, 170, 164, 150, 1], ext: [740, 340, 164, 160, 1], mdP: [936, 150, 284, 230, 1], json: [936, 396, 284, 240, 1]};
  L.s5 = {...L.s4, c0: [64, 170, 180, 52, 1], c1: [64, 232, 180, 52, 1], c2: [64, 294, 180, 52, 1], cD: [64, 372, 180, 52, 1],
    url: [64, 294, 180, 52, 0], py: [272, 170, 160, 120, 1], cfgB: [272, 302, 160, 48, 1], cfgR: [272, 360, 160, 48, 1],
    lib: [452, 150, 452, 370, 1], browser: [470, 170, 250, 250, 1], gate: [730, 170, 22, 250, 1], mdf: [762, 170, 128, 118, 1], ext: [762, 302, 128, 118, 1],
    mdP: [928, 150, 288, 170, 1], json: [928, 334, 288, 190, 1]};
  L.s5b = {...L.s5, d404: [470, 540, 250, 96, 1]};
  L.s6 = {...L.s5b, memo: [928, 548, 288, 92, 1]};
  L.s7 = {...L.s6};

  // [配置が整う秒, 移動にかける秒, 配置]。整った後は次の移動まで止まる。
  const KEYS = [[1.6, 1.4, 's1'], [3.4, 1.2, 's1b'], [5.6, 1.4, 's2'], [10.2, 1.2, 's3'], [15.4, 1.4, 's4'],
    [21.6, 1.6, 's5'], [23.2, 0.6, 's5b'], [26.2, 1.2, 's6'], [29.4, 0.8, 's7']];
  const IDS = Object.keys(P.s0);

  // 線。端の向きは2つの形の位置から決める。HOT の時間帯は今の道筋として濃く描く。
  const LINKS = [
    {id: 'url', a: 'url', b: 'py'}, {id: 'cB', a: 'cfgB', b: 'py'}, {id: 'cR', a: 'cfgR', b: 'py'},
    {id: 'c0', a: 'c0', b: 'py'}, {id: 'c1', a: 'c1', b: 'py'}, {id: 'c2', a: 'c2', b: 'py'}, {id: 'cD', a: 'cD', b: 'py', diag: true},
    {id: 'call', a: 'py', b: 'browser'}, {id: 'wait', a: 'browser', b: 'gate'},
    {id: 'toMd', a: 'gate', b: 'mdf', fa: 0.25}, {id: 'toX', a: 'gate', b: 'ext', fa: 0.75},
    {id: 'md', a: 'mdf', b: 'mdP'}, {id: 'x', a: 'ext', b: 'json'},
    {id: 'mdMemo', a: 'mdP', b: 'memo', bus: 'wide'}, {id: 'xMemo', a: 'json', b: 'memo'},
    {id: 'd404', a: 'browser', b: 'd404', diag: true}, {id: 'd404memo', a: 'd404', b: 'memo', diag: true, bus: 'tall', late: true}
  ];
  const TRUNK = [[20, 25], [29, 32]];
  const HOT = {url: [[0, 9]], cB: [[0, 9]], cR: [[0, 9]], call: [[4, 9], ...TRUNK], wait: [[9, 14], ...TRUNK],
    toMd: [[14, 25], [29, 32]], toX: [[14, 25], [29, 32]], md: [[14, 25], [29, 32]], x: [[14, 25], [29, 32]],
    mdMemo: [[25, 32]], xMemo: [[25, 32]], c0: [[20, 25], [29, 32]], c1: [[20, 25], [29, 32]], c2: [[20, 25], [29, 32]]};

  // ---------- 小さな道具 ----------

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = p => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const ramp = (t, a, b) => ease((t - a) / (b - a));
  const mixR = (A, B, p) => A.map((v, i) => v + ((B[i] ?? v) - v) * p);
  const center = r => [r[0] + r[2] / 2, r[1] + r[3] / 2];

  const canvas = document.getElementById('film');
  const ctx = canvas.getContext('2d');
  let portrait = true, S = P, sc = 1, ox = 0, oy = 0;
  function geometry() {
    portrait = H >= W;
    S = portrait ? P : L;
    const [dw, dh] = portrait ? SIZES.tall : SIZES.wide;
    sc = Math.min(W / dw, H / dh);
    ox = (W - dw * sc) / 2; oy = (H - dh * sc) / 2;
    canvas.width = W; canvas.height = H;
    if (RENDER) { canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; }
  }
  geometry();

  function rectAt(id, t) {
    let cur = S.s0[id];
    for (const [kt, d, name] of KEYS) {
      const target = S[name][id];
      if (t >= kt) { cur = target; continue; }
      if (t > kt - d) return mixR(cur, target, ease((t - (kt - d)) / d));
      break;
    }
    return cur;
  }
  function ga(a, fn) {
    if (a <= 0.004) return;
    ctx.save(); ctx.globalAlpha *= clamp(a, 0, 1); fn(); ctx.restore();
  }
  function rr(x, y, w, h, r) {
    const R = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + R, y);
    ctx.arcTo(x + w, y, x + w, y + h, R); ctx.arcTo(x + w, y + h, x, y + h, R);
    ctx.arcTo(x, y + h, x, y, R); ctx.arcTo(x, y, x + w, y, R);
    ctx.closePath();
  }
  function box(r, o = {}) {
    const [x, y, w, h] = r;
    if (w <= 0 || h <= 0) return;
    rr(x, y, w, h, o.radius ?? 12);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) {
      ctx.save(); ctx.lineWidth = o.lw ?? 2; ctx.strokeStyle = o.stroke; if (o.dash) ctx.setLineDash(o.dash);
      ctx.stroke(); ctx.restore();
    }
  }
  const font = (size, weight, fam) => `${weight} ${Math.max(1, Math.round(size * 10) / 10)}px ${fam}`;
  function txt(s, x, y, o = {}) {
    const size = o.size ?? 20, weight = o.weight ?? 400, fam = o.fam ?? SANS;
    let sz = size, str = String(s);
    ctx.font = font(sz, weight, fam);
    if (o.max > 0) {
      while (ctx.measureText(str).width > o.max && sz > size * (o.min ?? 0.72)) { sz *= 0.94; ctx.font = font(sz, weight, fam); }
      if (ctx.measureText(str).width > o.max) {
        while (str.length > 1 && ctx.measureText(str + '…').width > o.max) str = str.slice(0, -1);
        str += '…';
      }
    }
    ctx.fillStyle = o.color ?? C.ink; ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'alphabetic';
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }
  function measure(s, size, weight, fam) { ctx.font = font(size, weight, fam); return ctx.measureText(s).width; }
  // 長いクラス名は大文字の境目で2行に分ける（例：JsonCssExtraction／Strategy）。
  function className(name, x, y, size, max, color) {
    if (measure(name, size, 700, MONO) <= max) { txt(name, x, y, {size, fam: MONO, weight: 700, color}); return 1; }
    const cut = name.search(/(Strategy|Generator|Config)$/);
    const parts = cut > 0 ? [name.slice(0, cut), name.slice(cut)] : [name];
    parts.forEach((p, i) => txt(p, x, y + i * size * 1.2, {size, fam: MONO, weight: 700, color, max}));
    return parts.length;
  }
  function tag(label, x, y, h, fill, color, o = {}) {
    const size = h * 0.58, w = measure(label, size, 800, o.fam ?? SANS) + h * 0.7;
    const left = o.align === 'right' ? x - w : x;
    box([left, y, w, h], {fill, radius: h * 0.3});
    txt(label, left + w / 2, y + h / 2 + 0.5, {size, weight: 800, fam: o.fam ?? SANS, color, align: 'center', base: 'middle'});
    return w;
  }

  // ---------- 図形の内側の幾何 ----------

  function pageGeo(b) {
    const [x, y, w, h] = b;
    const bar = clamp(h * 0.1, 12, 52), pad = clamp(w * 0.03, 5, 18);
    const navH = clamp(h * 0.075, 6, 40), footH = clamp(h * 0.065, 6, 36);
    const top = y + bar + pad * 0.7, bottom = y + h - pad * 0.7;
    const nav = [x + pad, top, w - 2 * pad, navH];
    const foot = [x + pad, bottom - footH, w - 2 * pad, footH];
    const my = top + navH + pad * 0.6;
    const main = [x + pad, my, w - 2 * pad, Math.max(4, bottom - footH - pad * 0.6 - my)];
    const h1H = clamp(main[3] * 0.16, 8, 44);
    const inner = [main[0] + pad * 0.6, main[1] + h1H + pad * 0.5, main[2] - pad * 1.2, Math.max(4, main[3] - h1H - pad * 1.1)];
    const gap = clamp(inner[3] * 0.06, 3, 16), sh = Math.min(120, (inner[3] - gap) / 2);
    const slots = [[inner[0], inner[1], inner[2], sh], [inner[0], inner[1] + sh + gap, inner[2], sh]];
    return {bar, pad, nav, foot, main, h1H, slots};
  }
  function jsonRows(r, n) {
    const [x, y, w, h] = r;
    const pad = clamp(w * 0.04, 6, 16), head = clamp(h * 0.16, 20, 40), cols = clamp(h * 0.1, 14, 26);
    const top = y + pad * 0.6 + head + cols, avail = Math.max(4, y + h - pad - top);
    const gap = clamp(avail * 0.05, 3, 10), rh = (avail - gap * (n - 1)) / n;
    return Array.from({length: n}, (_, i) => [x + pad, top + i * (rh + gap), w - 2 * pad, rh]);
  }
  function mdLayout(r, lines) {
    const [x, y, w, h] = r;
    const pad = clamp(w * 0.05, 8, 18), head = clamp(h * 0.14, 20, 40);
    const top = y + pad * 0.6 + head + pad * 0.4, avail = Math.max(4, y + h - pad * 0.7 - top);
    const wt = l => (l.c === 'l1' ? 1.3 : l.c === 'l2' ? 1.05 : 0.5);
    const total = lines.reduce((n, l) => n + wt(l), 0) + (lines.length - 1) * 0.2;
    const u = Math.min(avail / total, 34);
    let yy = top;
    return lines.map(l => { const lh = wt(l) * u, rect = [x + pad, yy, w - 2 * pad, lh]; yy += lh + u * 0.2; return {...l, rect}; });
  }

  // ---------- 描画 ----------

  let D = null;
  const LS = () => (portrait ? 1 : 0.82); // 文字の基準の倍率

  function drawTitle(t) {
    const [tx, ty, ts, ss] = portrait ? [60, 140, 54, 26] : [64, 84, 44, 21];
    const list = D.titles;
    for (let i = 0; i < list.length; i++) {
      const [st, title, sub] = list[i], en = i + 1 < list.length ? list[i + 1][0] : DURATION + 1;
      const a = (st === 0 ? 1 : ramp(t, st, st + 0.35)) * (1 - ramp(t, en - 0.3, en));
      if (t < st - 0.01 || t > en + 0.01) continue;
      ga(a, () => {
        txt(title, tx, ty, {size: ts, weight: 800, fam: SERIF, max: (portrait ? 600 : 760)});
        txt(sub, tx, ty + ss * 2, {size: ss, color: C.muted, max: portrait ? 600 : 760});
      });
    }
  }

  function anchor(r, s, f) {
    const [x, y, w, h] = r;
    if (s === 't') return {x: x + w * f, y, dx: 0, dy: -1};
    if (s === 'b') return {x: x + w * f, y: y + h, dx: 0, dy: 1};
    if (s === 'l') return {x, y: y + h * f, dx: -1, dy: 0};
    return {x: x + w, y: y + h * f, dx: 1, dy: 0};
  }
  function sides(A, B) {
    if (A[1] + A[3] <= B[1] + 0.5) return ['b', 't'];
    if (A[1] >= B[1] + B[3] - 0.5) return ['t', 'b'];
    if (A[0] + A[2] <= B[0] + 0.5) return ['r', 'l'];
    return ['l', 'r'];
  }
  function arrow(q, color, lw) {
    const s = 5 + lw * 2.2, ux = -q.dx, uy = -q.dy;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(q.x - ux * s - uy * s * 0.55, q.y - uy * s + ux * s * 0.55);
    ctx.lineTo(q.x - ux * s + uy * s * 0.55, q.y - uy * s - ux * s * 0.55);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function curveLink(A, B, o) {
    const [sa, sb] = sides(A, B);
    const p = anchor(A, sa, o.fa ?? 0.5);
    const fb = o.fb ?? (sb === 't' || sb === 'b' ? clamp((p.x - B[0]) / B[2], 0.08, 0.92) : clamp((p.y - B[1]) / B[3], 0.1, 0.9));
    const q = anchor(B, sb, fb);
    const k = Math.max(14, Math.hypot(q.x - p.x, q.y - p.y) * 0.4);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.bezierCurveTo(p.x + p.dx * k, p.y + p.dy * k, q.x + q.dx * k, q.y + q.dy * k, q.x, q.y);
    return q;
  }
  // 余白を回る線（縦：404→メモの右側、横：Markdown→メモの右側）
  function busLink(A, B) {
    const right = portrait ? 696 : 1252;
    const p = {x: A[0] + A[2], y: A[1] + A[3] / 2}, q = {x: B[0] + B[2], y: B[1] + B[3] / 2};
    const r = 16;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.arcTo(right, p.y, right, q.y, r); ctx.arcTo(right, q.y, q.x, q.y, r); ctx.lineTo(q.x, q.y);
    return {x: q.x, y: q.y, dx: 1, dy: 0};
  }
  function drawLinks(R, t, p) {
    for (const l of LINKS) {
      const A = R[l.a], B = R[l.b];
      let a = Math.min(A[4], B[4]);
      if (l.late) a *= p.memoDiag;
      if (l.id === 'd404') a *= ramp(t, 23.0, 23.5);
      if (a <= 0.01 || A[2] < 2 || B[2] < 2 || A[3] < 2 || B[3] < 2) continue;
      const hot = (HOT[l.id] || []).some(([s, e]) => t >= s && t < e);
      const color = l.diag ? C.amber : hot ? C.petrol : C.link;
      const lw = l.diag ? 2.5 : hot ? 3.2 : 2;
      ga(a, () => {
        ctx.save();
        const q = l.bus === (portrait ? 'tall' : 'wide') ? busLink(A, B) : curveLink(A, B, l);
        ctx.lineWidth = lw; ctx.strokeStyle = color;
        if (l.diag) ctx.setLineDash([9, 6]);
        ctx.stroke(); ctx.setLineDash([]);
        arrow(q, color, lw);
        ctx.restore();
      });
    }
  }

  function drawLib(r) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      box(r, {fill: C.kit, stroke: C.petrol, lw: 2.5, dash: [10, 7], radius: 22});
      const s = 22 * LS(), label = `Crawl4AI ${D.version}`, lw = measure(label, s, 800, SANS) + 16;
      ctx.fillStyle = C.paper; ctx.fillRect(x + 24, y - s * 0.7, lw, s * 1.3);
      txt(label, x + 32, y, {size: s, weight: 800, color: C.petrol, base: 'middle'});
    });
  }
  function drawChip(r, d, diag) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      box(r, diag ? {fill: C.amberSoft, stroke: C.amber, lw: 2.5, dash: [8, 5], radius: 10} : {fill: C.card, stroke: C.ink, lw: 2.5, radius: 10});
      const pad = Math.min(14, w * 0.08);
      txt(d.label, x + pad, y + h * 0.48, {size: h * 0.36, weight: 800, color: diag ? C.amberInk : C.ink, max: w - 2 * pad});
      txt(d.file, x + pad, y + h * 0.8, {size: h * 0.22, fam: MONO, color: diag ? C.amberInk : C.muted, max: w - 2 * pad});
    });
  }
  function drawUrl(r) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      box(r, {fill: C.card, stroke: C.ink, lw: 2.5, radius: h / 2});
      const tw = tag('URL', x + h * 0.2, y + h * 0.2, h * 0.6, C.petrol, C.card);
      txt(D.exp.path, x + h * 0.2 + tw + h * 0.3, y + h / 2 + 1, {size: h * 0.34, fam: MONO, weight: 700, base: 'middle', max: w - tw - h * 0.9});
    });
  }
  function drawCfg(r, kind) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      box(r, {fill: C.amberSoft, stroke: C.amber, lw: 2.5, dash: [8, 6], radius: 12});
      const pad = clamp(w * 0.06, 8, 18), name = kind === 'b' ? 'BrowserConfig' : 'CrawlerRunConfig';
      if (w < 140) {
        txt('設定', x + w / 2, y + h * 0.44, {size: h * 0.32, weight: 800, color: C.amberInk, align: 'center', base: 'middle'});
        txt(kind === 'b' ? 'Browser' : 'Run', x + w / 2, y + h * 0.76, {size: h * 0.18, fam: MONO, color: C.amberInk, align: 'center', base: 'middle', max: w - 8});
        return;
      }
      if (h < 100) {
        txt(name, x + pad, y + h / 2 + 1, {size: clamp(h * 0.38, 12, 24), fam: MONO, weight: 800, color: C.amberInk, base: 'middle', max: w - 2 * pad, min: 0.6});
        return;
      }
      const ns = 22 * LS();
      txt(name, x + pad, y + pad + ns, {size: ns, fam: MONO, weight: 800, color: C.amberInk, max: w - 2 * pad});
      const items = kind === 'b' ? D.bItems : D.rItems, top = y + pad + ns * 1.7, lh = (y + h - pad - top) / items.length;
      items.forEach((s, i) => txt(s, x + pad, top + lh * (i + 0.72), {size: clamp(lh * 0.62, 11, 20 * LS()), fam: MONO, color: C.amberInk, max: w - 2 * pad}));
    });
  }
  function drawPy(r) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      box(r, {fill: C.ink, radius: 14});
      const th = Math.min(h * 0.46, 34 * LS()), pad = Math.min(18, w * 0.06);
      if (w >= 420) {
        const tw = tag('Python', x + pad, y + (h - th) / 2, th, C.amber, '#1c1407');
        txt('await crawler.arun(url, config)', x + pad + tw + pad * 0.8, y + h / 2 + 1, {size: clamp(h * 0.3, 14, 26 * LS()), fam: MONO, weight: 700, color: C.card, base: 'middle', max: w - tw - pad * 2.8});
      } else if (h <= 90) {
        const tw = tag('Python', x + pad, y + (h - th) / 2, th, C.amber, '#1c1407'), s = clamp(h * 0.24, 12, 20), lx = x + pad + tw + pad * 0.8;
        txt('await crawler', lx, y + h / 2 - s * 0.25, {size: s, fam: MONO, weight: 700, color: C.card, max: x + w - pad - lx});
        txt('.arun(url, config)', lx, y + h / 2 + s * 1.05, {size: s, fam: MONO, weight: 700, color: C.card, max: x + w - pad - lx});
      } else {
        tag('Python', x + pad, y + pad, th, C.amber, '#1c1407');
        const s = clamp(w * 0.1, 12, 20);
        txt('await crawler', x + pad, y + pad + th + s * 1.4, {size: s, fam: MONO, weight: 700, color: C.card, max: w - 2 * pad});
        txt('.arun(url, config)', x + pad, y + pad + th + s * 2.7, {size: s, fam: MONO, weight: 700, color: C.card, max: w - 2 * pad});
      }
    });
  }
  function drawBrowser(r, g, p) {
    const [x, y, w, h, a] = r;
    if (h < 6) return;
    ga(a, () => {
      ctx.save();
      rr(x, y, w, h, 16); ctx.fillStyle = C.card; ctx.fill(); ctx.clip();
      ctx.fillStyle = C.paper2; ctx.fillRect(x, y, w, g.bar);
      const dr = g.bar * 0.11;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + g.bar * 0.42 + i * dr * 3.2, y + g.bar / 2, dr, 0, Math.PI * 2); ctx.fillStyle = C.line; ctx.fill(); }
      let cx = x + g.bar * 0.42 + dr * 9 + 6;
      cx += txt('Chrome・headless', cx, y + g.bar / 2 + 1, {size: g.bar * 0.3, weight: 800, color: C.petrol, base: 'middle'}) + g.bar * 0.3;
      const aw = Math.max(10, Math.min(x + w * 0.72 - cx, w * 0.45));
      box([cx, y + g.bar * 0.2, aw, g.bar * 0.6], {fill: C.card, radius: g.bar * 0.3});
      txt(D.exp.path, cx + g.bar * 0.3, y + g.bar / 2 + 1, {size: g.bar * 0.32, fam: MONO, base: 'middle', max: aw - g.bar * 0.5});
      // nav と footer：取り出すときに外へずれて薄くなる
      const off = p.nav * 0.9;
      for (const [rect, label, dir] of [[g.nav, 'nav', -1], [g.foot, 'footer', 1]]) {
        const [nx, ny, nw, nh] = rect, yy = ny + dir * off * nh;
        ga(1 - 0.72 * p.nav, () => {
          box([nx, yy, nw, nh], {fill: C.paper2, radius: nh * 0.25});
          txt(label, nx + nh * 0.4, yy + nh / 2 + 1, {size: nh * 0.55, fam: MONO, color: C.muted, base: 'middle'});
          ctx.fillStyle = C.line;
          for (let i = 0; i < 3; i++) ctx.fillRect(nx + nw * (0.3 + i * 0.12), yy + nh * 0.4, nw * 0.08, Math.max(1, nh * 0.2));
        });
      }
      const [mx, my, mw] = g.main;
      txt(D.exp.h1, mx + g.pad * 0.6, my + g.h1H * 0.78, {size: g.h1H * 0.72, fam: SERIF, weight: 800, max: mw - g.pad * 1.2});
      ctx.restore();
      box(r, {stroke: C.ink, lw: 2.5, radius: 16});
      // 本文の範囲 main#guide
      ga(p.scope, () => {
        const [sx, sy, sw, sh] = g.main;
        box([sx - 3, sy - 3, sw + 6, sh + 6], {stroke: C.amber, lw: 3, dash: [10, 6], radius: 8});
        const th = clamp(g.bar * 0.5, 12, 26);
        tag('main#guide', sx + sw - 4, sy - th * 0.55, th, C.amber, '#1c1407', {fam: MONO, align: 'right'});
      });
      ga(p.nav, () => {
        const [nx, ny, nw, nh] = g.nav, s = clamp(nh * 0.7, 10, 22);
        txt('nav・footer を除く', nx + nw, ny - off * nh + nh / 2 + 1, {size: s, weight: 800, color: C.amberInk, align: 'right', base: 'middle'});
      });
    });
  }
  function drawJs(r) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      box(r, {fill: C.paper2, stroke: C.ink, lw: 2, radius: 8});
      txt('ページのJS', x + 10, y + h * 0.44, {size: h * 0.34, weight: 800, max: w - 20});
      txt('dynamic-export.js', x + 10, y + h * 0.8, {size: h * 0.24, fam: MONO, color: C.muted, max: w - 20});
    });
  }
  function drawGate(r, p) {
    const [x, y, w, h, a] = r;
    if (w < 3 || h < 3) return;
    ga(a, () => {
      const rad = Math.min(12, Math.min(w, h) / 3);
      box(r, {fill: C.card, stroke: C.petrol, lw: 2.5, radius: rad});
      ctx.save(); rr(x, y, w, h, rad); ctx.clip();
      const vertical = h > w, k = 1 - 0.88 * p.open;
      const leaves = vertical ? [[x, y, w, h / 2 * k], [x, y + h - h / 2 * k, w, h / 2 * k]] : [[x, y, w / 2 * k, h], [x + w - w / 2 * k, y, w / 2 * k, h]];
      for (const lf of leaves) {
        ctx.fillStyle = C.petrolSoft; ctx.fillRect(...lf);
        ctx.save(); ctx.beginPath(); ctx.rect(...lf); ctx.clip();
        ctx.strokeStyle = C.petrol; ctx.globalAlpha *= 0.35; ctx.lineWidth = 2;
        for (let i = -h; i < w + h; i += 14) { ctx.beginPath(); ctx.moveTo(lf[0] + i, lf[1]); ctx.lineTo(lf[0] + i - h, lf[1] + h); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
      const code = `data-ready="${p.ready ? 'true' : 'false'}"`;
      if (!vertical && h >= 20) {
        const s = clamp(h * 0.3, 11, 30 * LS()), cs = clamp(h * 0.2, 10, 20 * LS()), showCode = h >= 54;
        const lw = Math.max(measure('描画を待つ', s, 800, SANS), showCode ? measure(code, cs, 700, MONO) : 0) + 24;
        const cy = y + h / 2 - (showCode ? cs * 0.6 : 0);
        box([x + w / 2 - lw / 2, cy - s * 0.75, lw, s * 1.5 + (showCode ? cs * 1.4 : 0)], {fill: C.card, radius: 8});
        txt('描画を待つ', x + w / 2, cy + 1, {size: s, weight: 800, color: C.petrol, align: 'center', base: 'middle'});
        if (showCode) txt(code, x + w / 2, cy + s * 0.55 + cs * 0.8, {size: cs, fam: MONO, weight: 700, color: p.ready ? C.petrol : C.amberInk, align: 'center', base: 'middle'});
      } else if (vertical && w >= 16) {
        const s = clamp(w * 0.32, 12, 30 * LS()), chars = Array.from('描画を待つ'), top = y + h / 2 - (chars.length * s * 1.15) / 2 - (w >= 90 ? s : 0);
        box([x + w / 2 - s * 0.75, top - s * 0.4, s * 1.5, chars.length * s * 1.15 + s * 0.3], {fill: C.card, radius: 6});
        chars.forEach((ch, i) => txt(ch, x + w / 2, top + s * 0.5 + i * s * 1.15, {size: s, weight: 800, color: C.petrol, align: 'center', base: 'middle'}));
        if (w >= 90) {
          const cs = clamp(w * 0.13, 11, 17), cy = top + chars.length * s * 1.15 + s * 0.9;
          box([x + 6, cy - cs, w - 12, cs * 3], {fill: C.card, radius: 6});
          txt('data-ready', x + w / 2, cy, {size: cs, fam: MONO, weight: 700, color: C.muted, align: 'center', base: 'middle'});
          txt(`"${p.ready ? 'true' : 'false'}"`, x + w / 2, cy + cs * 1.4, {size: cs * 1.1, fam: MONO, weight: 800, color: p.ready ? C.petrol : C.amberInk, align: 'center', base: 'middle'});
        }
      }
    });
  }
  function drawFilter(r, kind) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      box(r, {fill: C.petrolSoft, stroke: C.petrol, lw: 2.5, radius: kind === 'md' ? 14 : 10});
      const pad = clamp(w * 0.06, 8, 18), bs = clamp(Math.min(h * 0.26, w * 0.13), 13, 30 * LS());
      txt(kind === 'md' ? '文章へ' : '項目の型', x + pad, y + pad + bs * 0.85, {size: bs, weight: 800, color: C.petrol, max: w - 2 * pad});
      const cs = clamp(bs * 0.56, 10, 17);
      let yy = y + pad + bs * 0.85 + cs * 1.5;
      if (h > bs * 2.3) yy += (className(kind === 'md' ? 'DefaultMarkdownGenerator' : 'JsonCssExtractionStrategy', x + pad, yy, cs, w - 2 * pad, C.ink) - 1) * cs * 1.2;
      if (h > bs * 3.4 && yy + cs * 2 < y + h) {
        if (kind === 'md') txt(D.mdOpt, x + pad, yy + cs * 1.6, {size: cs, fam: MONO, color: C.muted, max: w - 2 * pad});
        else {
          const ch = clamp(cs * 1.5, 14, 26);
          let cy = yy + cs * 0.7;
          for (const label of D.fieldMap) {
            if (cy + ch > y + h - 4) break;
            const tw = measure(label, ch * 0.6, 700, MONO) + ch * 0.6;
            box([x + pad, cy, Math.min(tw, w - 2 * pad), ch], {fill: C.amberSoft, stroke: C.amber, lw: 1.5, dash: [5, 3], radius: 5});
            txt(label, x + pad + ch * 0.3, cy + ch / 2 + 1, {size: ch * 0.6, fam: MONO, weight: 700, color: C.amberInk, base: 'middle', max: w - 2 * pad - ch * 0.6});
            cy += ch + 4;
          }
        }
      }
    });
  }
  function header(r, label, sub, count) {
    const [x, y, w, h] = r;
    const pad = clamp(w * 0.04, 6, 16), hh = clamp(h * 0.16, 20, 40) * 0.72;
    const tw = tag(label, x + pad, y + pad * 0.6, hh, C.ink, C.card, {fam: MONO});
    txt(sub, x + pad + tw + 8, y + pad * 0.6 + hh / 2 + 1, {size: hh * 0.5, fam: MONO, color: C.muted, base: 'middle', max: w - tw - pad * 2 - (count ? hh * 3 : 0)});
    if (count) txt(count, x + w - pad, y + pad * 0.6 + hh / 2 + 1, {size: hh * 0.72, weight: 800, align: 'right', base: 'middle'});
  }
  function drawMd(r, p) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      // 後ろの紙：保存した残りの2ページ（届いたときに現れる）
      [1, 0].forEach(i => ga(p.arr[i], () => {
        const o = (i + 1) * 9;
        box([x + o, y - o, w, h], {fill: C.card, stroke: C.ink, lw: 2, radius: 6});
        txt(D.docs[i].label, x + o + w - 12, y - o + 16, {size: 13, weight: 700, color: C.muted, align: 'right'});
      }));
      box(r, {fill: C.card, stroke: C.ink, lw: 2.5, radius: 6});
      const n = 1 + (p.arr[0] > 0.5) + (p.arr[1] > 0.5);
      header(r, 'Markdown', 'response.markdown', `${n}ページ`);
      const lines = mdLayout(r, D.exp.lines), N = lines.length;
      lines.forEach((l, i) => {
        const la = clamp(p.md * N - i, 0, 1);
        ga(0.2 + 0.8 * la, () => {
          const [lx, ly, lw, lh] = l.rect;
          if (l.c === 'p') { ctx.fillStyle = l.kp ? C.amber : C.line; ctx.fillRect(lx, ly + lh * 0.25, lw * (l.kp ? 0.92 : 0.66), Math.max(2, lh * 0.5)); }
          else txt(l.t, lx, ly + lh * 0.78, {size: lh * 0.78, weight: l.c === 'l1' ? 800 : 700, fam: l.c === 'l1' ? SERIF : SANS, color: l.c === 'l1' ? C.ink : C.petrol, max: lw});
        });
      });
    });
  }
  function drawJson(r, p) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      box(r, {fill: C.card, stroke: C.ink, lw: 2.5, radius: 8});
      const n = 2 + 2 * (p.arr[0] > 0.5) + 2 * (p.arr[1] > 0.5);
      header(r, 'JSON', 'extracted_content', `${n}節`);
      const pad = clamp(w * 0.04, 6, 16), head = clamp(h * 0.16, 20, 40), cols = clamp(h * 0.1, 14, 26), cy = y + pad * 0.6 + head + cols * 0.7;
      txt('heading', x + pad + 4, cy, {size: cols * 0.62, fam: MONO, color: C.muted});
      txt('keypoint', x + pad + (w - 2 * pad) * 0.44 + 8, cy, {size: cols * 0.62, fam: MONO, color: C.muted});
      const rows2 = jsonRows(r, 2), rows6 = jsonRows(r, 6);
      const slots = p.rows6 < 0.5 ? rows2 : rows6;
      ga(p.rows6 < 0.5 ? 1 - 2 * p.rows6 : 2 * p.rows6 - 1, () => slots.forEach(s => box(s, {stroke: C.line, lw: 1.5, dash: [5, 4], radius: 5})));
      // 残りの2ページの節（届いたときに現れる）。書き出しの2節は下の drawSections が動かして入れる。
      [0, 1].forEach(d => D.docs[d].sections.forEach((s, j) => drawSec(rows6[d * 2 + j], s, 'html', 1, p.arr[d], 0)));
    });
  }
  function drawSec(r, s, origin, mode, al, find) {
    const [x, y, w, h] = r;
    if (al <= 0.01 || w < 4 || h < 4) return;
    ga(al, () => {
      if (mode < 1) ga(1 - mode, () => {
        box(r, {fill: C.card, stroke: C.ink, lw: 2, radius: Math.min(10, h * 0.15)});
        const px = clamp(w * 0.035, 6, 18), hs = clamp(h * 0.28, 9, 32), ks = clamp(h * 0.16, 7, 20);
        const badge = origin === 'script' ? hs * 1.9 : 0;
        txt(s.heading, x + px, y + h * 0.38, {size: hs, weight: 800, max: w - 2 * px - badge});
        txt(s.keypoint, x + px, y + h * 0.66, {size: ks, color: C.soft, max: w - 2 * px});
        ctx.fillStyle = C.line; ctx.fillRect(x + px, y + h * 0.8, (w - 2 * px) * 0.5, clamp(h * 0.05, 2, 6));
        if (badge) tag('JS', x + w - px, y + h * 0.12, clamp(h * 0.24, 10, 26), C.ink, C.card, {fam: MONO, align: 'right'});
        ga(find, () => {
          box([x - 4, y - 4, w + 8, h + 8], {stroke: C.amber, lw: 2.5, dash: [8, 5], radius: 10});
          const hw = Math.min(measure(s.heading, hs, 800, SANS), w - 2 * px - badge) + 12;
          box([x + px - 6, y + h * 0.38 - hs * 0.95, hw, hs * 1.25], {stroke: C.amber, lw: 2.5, radius: 4});
          box([x + px - 6, y + h * 0.66 - ks * 1.0, w - 2 * px + 12, ks * 1.4], {stroke: C.amber, lw: 2.5, radius: 4});
          const ts = clamp(h * 0.16, 9, 18);
          tag('h2', x + px + hw, y + h * 0.38 - hs * 0.95 - ts * 0.4, ts, C.amber, '#1c1407', {fam: MONO});
          tag('p.keypoint', x + w - px, y + h * 0.66 + ks * 0.3, ts, C.amber, '#1c1407', {fam: MONO, align: 'right'});
        });
      });
      if (mode > 0) ga(mode, () => {
        box(r, {fill: C.petrolSoft, stroke: C.petrol, lw: 2, radius: 6});
        const split = x + w * 0.44, s2 = clamp(h * 0.42, 8, 24 * LS()), pad = Math.min(10, w * 0.03);
        ctx.fillStyle = C.petrol; ctx.fillRect(split, y + h * 0.18, 1.5, h * 0.64);
        txt(s.heading, x + pad, y + h / 2 + 1, {size: s2, weight: 800, base: 'middle', max: split - x - pad * 2});
        txt(s.keypoint, split + pad, y + h / 2 + 1, {size: s2 * 0.82, color: C.soft, base: 'middle', max: x + w - split - pad * 2});
      });
    });
  }
  function drawD404(r, p) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      box(r, {fill: C.amberSoft, stroke: C.amber, lw: 3, radius: 12});
      ga(0.35 + 0.65 * p.lit, () => {
        const tall = h > w, pad = Math.min(16, w * 0.08);
        if (tall) {
          txt('HTTP', x + w / 2, y + h * 0.2, {size: w * 0.18, fam: MONO, weight: 800, color: C.amberInk, align: 'center'});
          txt(String(D.diag.status), x + w / 2, y + h * 0.4, {size: w * 0.36, fam: MONO, weight: 800, color: C.amberInk, align: 'center'});
          txt(`success: ${D.diag.success}`, x + w / 2, y + h * 0.56, {size: w * 0.11, fam: MONO, color: C.amberInk, align: 'center', max: w - 2 * pad});
          const th = w * 0.2, tw = measure('受理しない', th * 0.58, 800, SANS) + th * 0.7;
          tag('受理しない', x + (w - tw) / 2, y + h * 0.64, th, C.amber, '#1c1407');
          txt('診断として', x + w / 2, y + h * 0.86, {size: w * 0.11, color: C.amberInk, align: 'center'});
          txt('別に保存', x + w / 2, y + h * 0.93, {size: w * 0.11, color: C.amberInk, align: 'center'});
        } else {
          txt(`HTTP ${D.diag.status}`, x + pad, y + h * 0.48, {size: h * 0.36, fam: MONO, weight: 800, color: C.amberInk});
          txt(`success: ${D.diag.success}`, x + pad, y + h * 0.8, {size: h * 0.18, fam: MONO, color: C.amberInk});
          tag('受理しない', x + w - pad, y + h * 0.18, h * 0.28, C.amber, '#1c1407', {align: 'right'});
          txt('診断として別に保存', x + w - pad, y + h * 0.8, {size: h * 0.17, color: C.amberInk, align: 'right'});
        }
      });
    });
  }
  function drawMemo(r, p) {
    const [x, y, w, h, a] = r;
    ga(a, () => {
      const f = Math.min(26, h * 0.28);
      ctx.fillStyle = C.paper2; rr(x + 8, y + 8, w, h, 4); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w - f, y); ctx.lineTo(x + w, y + f); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
      ctx.fillStyle = C.card; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w - f, y); ctx.lineTo(x + w - f, y + f); ctx.lineTo(x + w, y + f); ctx.stroke();
      ga(p.memo, () => {
        const pad = Math.min(20, w * 0.05);
        txt(D.memoName, x + pad, y + h * 0.3, {size: h * 0.19, fam: MONO, weight: 700, color: C.petrol});
        txt('全体の結果メモ', x + pad, y + h * 0.68, {size: h * 0.29, fam: SERIF, weight: 800, max: w * 0.55});
        txt(`${D.pages}ページ・${D.sections}節`, x + w - pad - f * 0.3, y + h * 0.56, {size: h * 0.25, weight: 800, align: 'right'});
        txt('workflow.py が作成', x + w - pad - f * 0.3, y + h * 0.84, {size: h * 0.15, color: C.muted, align: 'right'});
      });
      ga(p.memoDiag, () => tag('404は別欄', x + w - f - 6, y - h * 0.17, h * 0.26, C.amber, '#1c1407', {align: 'right'}));
    });
  }
  function drawSections(R, g, p) {
    const rows2 = jsonRows(R.json, 2), rows6 = jsonRows(R.json, 6);
    const rowA = mixR(rows2[0], rows6[4], p.rows6), rowB = mixR(rows2[1], rows6[5], p.rows6);
    const js = R.js, jsS = [js[0] + js[2] * 0.1, js[1] + js[3] * 0.15, js[2] * 0.8, js[3] * 0.7];
    const bBase = mixR(jsS, g.slots[1], p.jsIn);
    const rectA = mixR(g.slots[0], rowA, p.split), rectB = mixR(bBase, rowB, p.split);
    const [sA, sB] = D.exp.sections, [oA, oB] = D.exp.origins;
    // Markdown へも同じ見出しが渡る（並行の枝）。JSON から Markdown を作ってはいない。
    const ghost = Math.sin(Math.PI * p.split) * 0.85;
    if (ghost > 0.01) {
      const md = mdLayout(R.mdP, D.exp.lines).filter(l => l.c === 'l2');
      [[g.slots[0], sA], [g.slots[1], sB]].forEach(([slot, s], i) => {
        if (!md[i]) return;
        const from = [slot[0], slot[1], slot[2] * 0.6, slot[3] * 0.34], gr = mixR(from, md[i].rect, p.split);
        ga(ghost, () => txt('## ' + s.heading, gr[0], gr[1] + gr[3] * 0.8, {size: gr[3] * 0.8, weight: 700, color: C.petrol, max: Math.max(20, gr[2])}));
      });
    }
    drawSec(rectA, sA, oA, p.split, R.browser[4] * p.secA, p.find);
    drawSec(rectB, sB, oB, p.split, p.bIn, p.find);
  }
  function along(points, u) {
    const segs = []; let total = 0;
    for (let i = 1; i < points.length; i++) { const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); segs.push(d); total += d; }
    let dist = clamp(u, 0, 1) * total;
    for (let i = 0; i < segs.length; i++) {
      if (dist <= segs[i] || i === segs.length - 1) { const k = segs[i] ? clamp(dist / segs[i], 0, 1) : 1; return [points[i][0] + (points[i + 1][0] - points[i][0]) * k, points[i][1] + (points[i + 1][1] - points[i][1]) * k]; }
      dist -= segs[i];
    }
    return points[points.length - 1];
  }
  function token([cx, cy], label, kind, s) {
    const w = Math.max(s * 2.4, measure(label, s * 0.46, 800, SANS) + s * 0.8), h = s;
    const st = {doc: [C.card, C.ink, C.ink], diag: [C.amberSoft, C.amber, C.amberInk], md: [C.card, C.ink, C.petrol], pair: [C.petrolSoft, C.petrol, C.ink]}[kind];
    box([cx - w / 2, cy - h / 2, w, h], {fill: st[0], stroke: st[1], lw: 2.5, radius: kind === 'md' ? 4 : 8, dash: kind === 'diag' ? [6, 4] : null});
    txt(label, cx, cy + 1, {size: s * 0.46, weight: 800, color: st[2], align: 'center', base: 'middle'});
  }
  function drawTokens(R, t) {
    const s = portrait ? 40 : 30, c = id => center(R[id]);
    [['c0', 21.0, 0], ['c1', 21.6, 1]].forEach(([chip, t0, i]) => {
      const u = (t - t0) / 1.4;
      if (u <= 0 || u >= 1) return;
      const fade = 1 - ramp(u, 0.9, 1);
      if (u < 0.6) ga(fade, () => token(along([c(chip), c('py'), c('browser'), c('gate')], ease(u / 0.6)), D.docs[i].label, 'doc', s));
      else {
        const v = ease((u - 0.6) / 0.4);
        ga(fade, () => {
          token(along([c('gate'), c('mdf'), c('mdP')], v), 'Markdown', 'md', s * 0.8);
          token(along([c('gate'), c('ext'), c('json')], v), 'JSON', 'pair', s * 0.8);
        });
      }
    });
    const ud = (t - 23.0) / 1.4;
    if (ud > 0 && ud < 1) ga(1 - ramp(ud, 0.9, 1), () => token(along([c('cD'), c('py'), c('browser'), c('d404')], ease(ud)), D.diag.file, 'diag', s));
    const um = (t - 25.4) / 1.0;
    if (um > 0 && um < 1) ga(1 - ramp(um, 0.85, 1), () => {
      token(along([c('mdP'), c('memo')], ease(um)), 'Markdown', 'md', s * 0.8);
      token(along([c('json'), c('memo')], ease(um)), 'JSON', 'pair', s * 0.8);
    });
  }
  function drawFoot(p) {
    const fs = portrait ? 19 : 15, y = portrait ? 1238 : 698, x = portrait ? 60 : 64;
    txt('手元の架空ページ／保存済み実行の図解／無音', x, y, {size: fs, color: C.muted});
    ga(p.cta, () => {
      const cs = portrait ? 32 : 28;
      const [cx, cy] = portrait ? [60, 1206] : [64, 600];
      const w = txt('実際の結果を開く', cx, cy, {size: cs, weight: 800, color: C.petrol});
      txt('→ 作例ページで', cx + w + 14, cy, {size: cs * 0.6, weight: 700, color: C.petrol});
      ctx.fillStyle = C.petrol; ctx.fillRect(cx, cy + 8, w, 3);
      const credit = `Crawl4AI ${D.version}（unclecode/crawl4ai・Apache License 2.0＋帰属表示）`;
      if (portrait) txt(credit, x, y + 26, {size: 15, color: C.muted, max: 600});
      else txt(credit, 1216, y, {size: 14, color: C.muted, align: 'right', max: 560});
    });
  }

  function params(t) {
    return {
      secA: ramp(t, 2.8, 3.4), bIn: ramp(t, 10.3, 10.7), jsIn: ramp(t, 10.6, 11.9), ready: t >= 12.2, open: ramp(t, 12.4, 13.2),
      scope: ramp(t, 15.0, 15.8), nav: ramp(t, 15.3, 16.3), find: ramp(t, 16.3, 17.0) * (1 - ramp(t, 18.0, 18.6)),
      split: ramp(t, 17.4, 18.8), md: ramp(t, 17.8, 19.2), rows6: ramp(t, 20.0, 21.6),
      arr: [ramp(t, 22.2, 22.6), ramp(t, 22.8, 23.2)], lit: ramp(t, 24.2, 24.6),
      memo: ramp(t, 26.0, 26.6), memoDiag: ramp(t, 26.6, 27.4), cta: ramp(t, 28.8, 29.4)
    };
  }
  function frame(t) {
    const R = {};
    for (const id of IDS) R[id] = rectAt(id, t);
    const g = pageGeo(R.browser), p = params(t);
    drawTitle(t);
    drawLinks(R, t, p);
    drawLib(R.lib);
    drawChip(R.c0, D.docs[0]); drawChip(R.c1, D.docs[1]); drawChip(R.c2, D.docs[2]); drawChip(R.cD, D.diag, true);
    drawUrl(R.url); drawCfg(R.cfgB, 'b'); drawCfg(R.cfgR, 'r'); drawPy(R.py);
    drawBrowser(R.browser, g, p);
    drawJs(R.js);
    drawGate(R.gate, p);
    drawFilter(R.mdf, 'md'); drawFilter(R.ext, 'x');
    drawMd(R.mdP, p); drawJson(R.json, p);
    drawD404(R.d404, p);
    drawMemo(R.memo, p);
    drawSections(R, g, p);
    drawTokens(R, t);
    drawFoot(p);
  }
  function draw(t) {
    t = clamp(Number(t) || 0, 0, DURATION);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (D) {
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
      ctx.translate(ox, oy); ctx.scale(sc, sc);
      frame(t);
    }
    ctx.restore();
  }

  // ---------- 照合 ----------

  const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const utf8 = buf => new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(buf);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const need = (ok, what) => { if (!ok) throw new Error(`保存データが図の説明と一致しません（${what}）。`); };
  const sha = async buf => hex(await crypto.subtle.digest('SHA-256', buf));
  async function bytes(path) {
    let res;
    try { res = await fetch(BASE + path, {cache: 'no-store'}); }
    catch { throw new Error(`${path} を読み込めませんでした。HTTPで配信したページを開いてください。`); }
    if (!res.ok) throw new Error(`${path} を読み込めませんでした（HTTP ${res.status}）。`);
    return res.arrayBuffer();
  }
  const assetState = {};
  const onAsset = (path, s) => { assetState[path] = s; if (!RENDER) renderAssets(); };

  async function verify() {
    need(window.crypto && crypto.subtle, 'SHA-256はHTTPSかlocalhostで使えます');
    PATHS.forEach(p => onAsset(p, 'wait'));
    const raw = await bytes('concept/manifest.json');
    need(await sha(raw) === PIN, 'concept/manifest.json の固定SHA-256');
    let man;
    try { man = JSON.parse(utf8(raw)); } catch { throw new Error('concept/manifest.json を読めません。'); }
    need(man.format === 'studio-yebisu-assets/v1' && man.case_id === CASE && man.source_commit === COMMIT, '素材一覧の形式');
    const files = Array.isArray(man.files) ? man.files : [];
    need(files.length === PATHS.length && PATHS.every(p => files.filter(f => f.path === p).length === 1), '素材一覧の17件');
    const text = {};
    await Promise.all(files.map(async f => {
      try {
        const buf = await bytes(f.path);
        if (buf.byteLength !== f.bytes || await sha(buf) !== f.sha256) throw new Error(`${f.path} のバイト数またはSHA-256が素材一覧と一致しません。`);
        try { text[f.path] = utf8(buf); } catch { throw new Error(`${f.path} がUTF-8として読めません。`); }
        onAsset(f.path, 'ok');
      } catch (e) { onAsset(f.path, 'bad'); throw e; }
    }));
    return build(text, files);
  }
  function mdLines(md, sections) {
    const kps = new Set(sections.map(s => s.keypoint));
    return md.split('\n').filter(Boolean).map(line =>
      line.startsWith('## ') ? {c: 'l2', t: line} : line.startsWith('# ') ? {c: 'l1', t: line} : {c: 'p', kp: kps.has(line), t: ''});
  }
  function build(text, files) {
    const json = p => { try { return JSON.parse(text[p]); } catch { throw new Error(`${p} をJSONとして読めません。`); } };
    const file = p => files.find(f => f.path === p);
    const st = json('concept/structure.json'), runs = json(RUNS.path);
    json('brief.json'); json('samples.json'); json('verification.json');
    need(file(RUNS.path).bytes === RUNS.bytes && file(RUNS.path).sha256 === RUNS.sha256, 'runs.json の期待値');
    need(file(MEMO.path).bytes === MEMO.bytes && file(MEMO.path).sha256 === MEMO.sha256, 'result.md の期待値');
    need(st.format === 'crawl4ai-structure/v1' && st.case_id === CASE && st.source_commit === COMMIT && st.version === VERSION, 'structure.json');
    need((st.parts || []).map(p => p.id).join() === 'browser,scope,fields,markdown', '4つの部品ID');
    const sdocs = st.documents || [];
    need(sdocs.map(d => d.id).join() === 'start,review,export' && sdocs.map(d => d.source_section_count).join() === '2,2,1' &&
      sdocs.map(d => d.rendered_section_count).join() === '2,2,2' && sdocs[2].origins.join() === 'html,script', '3ページの節');
    need(runs.format === 'studio-yebisu/crawl4ai-example-runs@1' && runs.library.version === VERSION && runs.library.commit === COMMIT, 'runs.json の版');
    need(same(runs.schema, SCHEMA) && same(runs.selectors, SELECTORS) && same(st.schema, SCHEMA), 'スキーマとセレクター');
    const rdocs = runs.documents || [];
    need(rdocs.length === 3 && rdocs.every((d, i) => d.id === sdocs[i].id && d.accepted === true && d.response.status_code === 200 &&
      same(JSON.parse(d.response.extracted_content), d.sections) && same(d.sections, sdocs[i].sections) && same(d.section_origins, sdocs[i].origins) &&
      d.input_html.text === text[FIX[d.id]]), '3ページの実結果');
    const js = text[FIX.js], added = rdocs[2].sections[1];
    need(js.includes(JSON.stringify(added.heading)) && !text[FIX.export].includes(added.heading) && js.includes('guide.setAttribute("data-ready", "true");'), 'JSが加える節');
    const dg = runs.diagnostic || {}, dr = dg.response || {}, dc = (dg.request || {}).config || {};
    need(dr.status_code === 404 && dr.success === true && dg.accepted === false && dr.extracted_content === null &&
      !('wait_for' in dc) && !('css_selector' in dc) && !('extraction_strategy' in dc), '診断：HTTP 404・success true・受理しない・抽出なし');
    need(text[V + 'LICENSE'].includes(`"${ATTR_REQ}"`) && text['NOTICE.txt'].includes(ATTR_REQ) && text['NOTICE.txt'].includes(ATTR_USE) && text[V + 'README.md'].includes(ATTR_USE), '帰属表示');
    need(text[MEMO.path].includes(ATTR_USE), 'result.md');
    const docs = rdocs.map(d => ({id: d.id, label: d.label, path: d.path, file: d.path.split('/').pop(), h1: d.title.split('｜')[0],
      sections: d.sections, origins: d.section_origins, lines: mdLines(d.response.markdown, d.sections)}));
    const bc = runs.browser.config, cfg = rdocs[0].request.config, o = cfg.markdown_generator.options;
    const pages = rdocs.filter(d => d.accepted).length, sections = rdocs.reduce((n, d) => n + d.sections.length, 0);
    return {
      version: runs.library.version, docs, exp: docs[2],
      diag: {label: '診断', file: dg.path.split('/').pop(), path: dg.path, status: dr.status_code, success: dr.success},
      bItems: [`headless: ${bc.headless}`, `channel: ${bc.channel}`],
      rItems: ['wait_for', 'css_selector', 'excluded_tags', '＋ 出力の設定 ×2'].filter(k => k.startsWith('＋') || k in cfg),
      mdOpt: `ignore_links ${o.ignore_links}・body_width ${o.body_width}`,
      fieldMap: runs.schema.fields.map(f => `${f.selector} → ${f.name}`),
      memoName: MEMO.path.split('/').pop(), pages, sections,
      titles: [
        [0, 'ページを、使える形へ', 'Pythonのライブラリ'],
        [4, '設定を渡して、開く', 'BrowserConfig ・ CrawlerRunConfig'],
        [9, '描画を待つ', 'ページのJSが節を足すまで'],
        [14, '本文から、2つの形へ', 'Markdown と JSON を並行して'],
        [20, '同じ道で、3ページ', `保存した ${pages}ページ・${sections}節`],
        [22.8, 'HTTPも確かめる', `HTTP ${dr.status_code} は資料に入れず、別に記録`],
        [25, '使う・保存する', `workflow.py が ${MEMO.path.split('/').pop()} にまとめる`],
        [29, 'ページを、使える形へ', `Crawl4AI ${runs.library.version} ・ Pythonのライブラリ`]
      ]
    };
  }

  // ---------- 準備・失敗・再試行 ----------

  let ready = false;
  function start() {
    ready = false; D = null;
    window.motionState = 'loading'; window.motionError = null;
    document.documentElement.dataset.motion = 'loading';
    draw(0);
    const run = verify().then(async data => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      D = data; ready = true;
      window.motionState = 'ready';
      document.documentElement.dataset.motion = 'ready';
      return true;
    }).catch(err => {
      D = null; ready = false;
      draw(0);
      window.motionState = 'error';
      window.motionError = err && err.message ? err.message : String(err);
      document.documentElement.dataset.motion = 'error';
      throw err;
    });
    window.motionReady = run;
    return run;
  }
  window.seek = t => {
    if (!ready) return window.motionReady.then(() => draw(t));
    draw(t);
    return undefined;
  };

  // ---------- 編集画面（書き出し時は動かさない） ----------

  const $ = id => document.getElementById(id);
  const ui = !RENDER && $('play');
  let now = POSTER, playing = false, raf = 0, t0 = 0, w0 = 0;

  function renderAssets() {
    const list = $('assets');
    if (!list) return;
    const label = {wait: '照合待ち', ok: '一致', bad: '不一致・読めない'};
    list.replaceChildren(...PATHS.map(p => {
      const li = document.createElement('li'), s = assetState[p] || 'wait';
      li.dataset.state = s;
      const code = document.createElement('code'); code.textContent = p;
      li.append(code, ` — ${label[s]}`);
      return li;
    }));
  }
  function sceneAt(t) { return SCENES.find(s => t >= s.start && t < s.end) || SCENES[SCENES.length - 1]; }
  let lastScene = '';
  function show(t) {
    now = clamp(t, 0, DURATION);
    draw(now);
    if (!ui) return;
    $('clock').textContent = `${now.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
    const scrub = $('scrub');
    scrub.value = String(now);
    scrub.setAttribute('aria-valuetext', `${now.toFixed(1)}秒`);
    const sc2 = sceneAt(now);
    if (sc2.id !== lastScene) { lastScene = sc2.id; $('caption').textContent = `${sc2.start}–${sc2.end}秒：${sc2.caption}`; }
  }
  function setPlaying(on) {
    playing = on;
    cancelAnimationFrame(raf);
    $('play').setAttribute('aria-pressed', String(on));
    $('play').textContent = on ? '一時停止' : '再生';
    if (!on) return;
    if (now >= DURATION - 0.05) now = 0;
    t0 = now; w0 = performance.now();
    const step = ts => {
      const t = t0 + (ts - w0) / 1000;
      if (t >= DURATION) { show(DURATION); setPlaying(false); return; }
      show(t);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function enable(on) {
    document.querySelectorAll('.controls button, .jumps button, .layouts button, #scrub').forEach(n => { n.disabled = !on; });
  }
  function setLayout(name) {
    if (RENDER || !SIZES[name]) return;
    [W, H] = SIZES[name];
    publishConfig();
    geometry();
    document.querySelectorAll('[data-layout]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.layout === name)));
    $('stage').dataset.layout = name;
    show(now);
    if (ready) $('status').textContent = `準備完了：17件すべて一致。${W}×${H}・${FPS}fps・${DURATION}秒・音声なし。`;
  }
  function boot() {
    if (ui) {
      enable(false);
      $('status').textContent = '準備中：17件の保存素材を照合しています…';
      $('retry').hidden = true;
      setPlaying(false);
    }
    start().then(() => {
      if (!ui) { draw(POSTER); return; }
      enable(true);
      $('status').textContent = `準備完了：17件すべて一致。${W}×${H}・${FPS}fps・${DURATION}秒・音声なし。`;
      lastScene = '';
      show(now);
    }).catch(err => {
      if (!ui) return;
      enable(false);
      $('clock').textContent = `– / ${DURATION.toFixed(1)} 秒`;
      $('caption').textContent = '';
      $('status').textContent = `表示できません：${window.motionError || err}`;
      $('retry').hidden = false;
    });
  }
  if (ui) {
    $('play').addEventListener('click', () => setPlaying(!playing));
    $('reset').addEventListener('click', () => { setPlaying(false); show(0); });
    $('end').addEventListener('click', () => { setPlaying(false); show(DURATION); });
    $('replay').addEventListener('click', () => { show(0); setPlaying(true); });
    $('scrub').addEventListener('input', e => { setPlaying(false); show(Number(e.target.value)); });
    document.querySelectorAll('.jumps button').forEach(b => b.addEventListener('click', () => { setPlaying(false); show(Number(b.dataset.t)); }));
    document.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => setLayout(b.dataset.layout)));
    $('retry').addEventListener('click', boot);
    $('stage').dataset.layout = portrait ? 'tall' : 'wide';
    document.querySelectorAll('[data-layout]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.layout === (portrait ? 'tall' : 'wide'))));
    renderAssets();
  }
  boot();
})();
