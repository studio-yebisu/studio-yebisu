// Studio Yebisu: Crawl4AI 作例 — 編集動画（28秒・1280×720・30fps・無音）
// Copyright (c) 2026 Studio Yebisu. MIT License.
// 保存済みの outputs/runs.json と、作例ビューアの実際のスクリーンショット4枚だけを読み、
// window.seek(秒) がその時刻の完成した画面を1枚のCanvasへ描く。Crawl4AI・ブラウザー操作・AIはここでは動かない。

const RC = window.renderConfig || {};
const dim = (v, d) => (Number.isInteger(v) && v > 0 ? v : d);
const W = dim(RC.width, 1280), H = dim(RC.height, 720), FPS = dim(RC.fps, 30); // 初期化時に一度だけ読む
const DURATION = 28, POSTER = 13.5;
const RENDER = window.__MOTION_RENDER__ === true;
window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER, audioEvents: []};
window.motionState = 'loading';
window.motionError = null;
if (RENDER) document.documentElement.classList.add('render');

const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",system-ui,sans-serif';
const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",serif';
const MONO = 'ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,"Noto Sans Mono",monospace';
// 作例ビューア（../style.css）と同じ紙・墨・ティール・錆色
const C = {
  paper: '#f7f2e8', deep: '#eee5d4', card: '#fffdf8', ink: '#1f1c17', soft: '#464035', muted: '#6a6252',
  line: '#d8cdb9', teal: '#0d6a63', tealDeep: '#08504a', tealSoft: '#dfeeea', rust: '#9c3f22', rustSoft: '#f6e3da', white: '#ffffff',
};
const M = 64, CW = 1152, RX = M + CW; // 1280×720 基準の安全余白64px
const COL = {x: M, w: 616}; // 結果の場面の左の列
const X2 = 560, W2 = RX - X2; // 方法の場面の右の列

// 場面の時刻。storyboard.json の scenes と同じ値。
const SCENES = [
  {id: 'intro', label: '1 依頼', start: 0, end: 4},
  {id: 'method', label: '2 取り方', start: 4, end: 9},
  {id: 'results', label: '3 取り出した節', start: 9, end: 15},
  {id: 'wait', label: '4 JSを待つ', start: 15, end: 19},
  {id: 'missing', label: '5 404', start: 19, end: 23},
  {id: 'saved', label: '6 保存した結果', start: 23, end: 28},
];

// 制作側が凍結した確認済みファイルの SHA-256（runtime/frozen-reviewed-source.json から転記）。違えば描かずに止まる。
const PIN = '6192d5e5b59cb21f9ca418fd6b798de47c0741d3';
const FILES = {
  runs: {path: 'outputs/runs.json', sha256: '0b932f3a4ac8190d70ff8e320dc0c0354746bc4ec3279a05d55f591aca4418f5'},
  memo: {path: 'outputs/result.md', sha256: 'aba3649b3e65334086b1bf9cf5f708eebf90b6e80c2e6257d30050a0892316e6'},
  samples: {path: 'samples.json', sha256: 'a1fda4dc710b5a22d7873cac19550fee61baca2865ac46e576c693248a993377'},
};
const SHOTS = {
  start: {path: 'assets/screen-start.png', sha256: 'af94e3a81beef17371b3da012b4199723b49751a7d94edf69e879b8dac0dcb9c', width: 1265, height: 889},
  export: {path: 'assets/screen-export.png', sha256: '85282c68266a6b36d1f4ca770367320e7d48787487d490e216609e6147765007', width: 1265, height: 889},
  missing: {path: 'assets/screen-missing.png', sha256: '17e3d762ff595eb580254b72fb6cd1fd3bfb6059c3410b6f36c7cbfb89585188', width: 1265, height: 889},
  phone: {path: 'assets/screen-phone.png', sha256: 'f231f447bb88bae83cb053e2c149ecea93c0bc1692eabf525afe9ea37b46def0', width: 375, height: 812},
};
// runs.json に記録された入力ファイルのハッシュが、凍結した fixture と同じかを確かめる（fixture 自体は読まない）
const FIXTURE_SHA = {
  'fixture/docs/start.html': '8780e13670852bbc97bfa8f10c7811c86b053baf91a3526913de907f3d9f31c3',
  'fixture/docs/review.html': '91c0c3c77ef2f5aa06ca0b8dea12206fd5f9ec222457c3527675b9023b0b4a77',
  'fixture/docs/export.html': 'aea275efe3d13485411cf5154b6ad5c239b7d0edce50e7c33faa25ad9e6615e5',
  'fixture/docs/dynamic-export.js': '5ba74a6c7a24e473493a75a090e331c29b717c9cd77d5c9a478d0431cddfdb7b',
};

// 切り抜きは元画像の座標（画像を見て決めた値）。画像そのものは改変せず、描く位置と倍率だけを決める。
// rings は強調枠を置く UI の範囲。枠は要素の外側の余白に描く。
const CROP = {
  startA: {shot: 'start', src: {x: 164, y: 450, w: 460, h: 174}, at: {x: 716, y: 238, w: 500}}, // 節1のカード
  startB: {shot: 'start', src: {x: 628, y: 450, w: 460, h: 174}, at: {x: 716, y: 439, w: 500}}, // 節2のカード
  exportA: {shot: 'export', src: {x: 164, y: 450, w: 460, h: 174}, at: {x: 716, y: 238, w: 500}},
  exportB: {shot: 'export', src: {x: 628, y: 450, w: 460, h: 174}, at: {x: 716, y: 439, w: 500}}, // 「JavaScript が追加した節」
  missing: {shot: 'missing', src: {x: 162, y: 322, w: 926, h: 166}, at: {x: M, y: 222, w: CW}, // 判定欄と説明の最初の行
    rings: {http: [168, 327, 467, 390], accepted: [783, 327, 1083, 390]}},
  phone: {shot: 'phone', src: {x: 0, y: 0, w: 360, h: 440}, at: {x: 856, y: 196, w: 360}, // 右端のスクロールバーを除く
    rings: {saved: [15, 252, 158, 284], facts: [15, 361, 346, 428]}},
};

// 持ち続ける形：3ページの紙。図（入力）→ 縦の列（構造）→ 上の帳（結果）→ 保存した結果の行（ファイル）と形を変える。
const R1 = i => ({x: M + i * 400, y: 292, w: 352, h: 236});
const R2 = i => ({x: M, y: 200 + i * 140, w: 440, h: 124});
const R3 = i => ({x: M + i * 292, y: 72, w: 272, h: 56});
const R4 = i => ({x: 88, y: 292 + i * 50, w: 688, h: 42});
const R3M = {x: 940, y: 72, w: 276, h: 56}; // 取得エラーの札（受理の3枚とは離して置く）
const R4M = {x: 88, y: 456, w: 688, h: 42};
const CARD = {x: M, y: 196, w: 736, h: 320};

const canvas = document.getElementById('film');
let ctx = canvas.getContext('2d', {willReadFrequently: true});
const IMG = {};
let D = null, ready = false;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = p => 1 - (1 - p) ** 3;
const inOut = p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const lerp = (a, b, p) => a + (b - a) * p;
const lerpRect = (a, b, p) => ({x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p)});
const leave = (t, t0, dur = 0.4) => 1 - prog(t, t0, t0 + dur);

// ---------- 素材の読み込み（SHA-256・寸法・中身の照合。代わりの値は使わない） ----------

const here = path => new URL('../' + path, import.meta.url);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const utf8 = buf => new TextDecoder('utf-8', {fatal: true}).decode(buf);

async function verified(file) {
  let res;
  try { res = await fetch(here(file.path), {cache: 'no-store', credentials: 'same-origin'}); }
  catch { throw new Error(`${file.path} を読み込めませんでした。作例フォルダを HTTP で配って開いてください。`); }
  if (!res.ok) throw new Error(`${file.path} を読み込めませんでした（HTTP ${res.status}）。`);
  const buf = await res.arrayBuffer();
  if (hex(await crypto.subtle.digest('SHA-256', buf)) !== file.sha256) throw new Error(`${file.path} の SHA-256 が確認済みの記録と一致しません。`);
  return buf;
}

async function image(shot) {
  const buf = await verified(shot);
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([buf], {type: 'image/png'})); // 照合したバイト列そのものを描く
  try { await img.decode(); }
  catch { throw new Error(`${shot.path} を画像として読めませんでした。`); }
  if (img.naturalWidth !== shot.width || img.naturalHeight !== shot.height) throw new Error(`${shot.path} の寸法が確認済みの記録と一致しません。`);
  return img;
}

function sameJSON(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => sameJSON(a[k], b[k]));
}

// 保存データから、動画に出す値をそのまま取り出す。打ち直しや言い換えはしない。
function select(runs, samples) {
  const must = (ok, what) => { if (!ok) throw new Error(`保存データが動画の前提と合いません（${what}）。`); };
  must(runs && runs.format === 'studio-yebisu/crawl4ai-example-runs@1', 'runs.json の形式');
  const lib = runs.library || {};
  must(lib.name === 'Crawl4AI' && lib.version === '0.9.5' && lib.commit === PIN, 'Crawl4AI 0.9.5・固定コミット');
  const schema = runs.schema || {}, sel = runs.selectors || {};
  must(schema.baseSelector === 'article.doc-section' && sameJSON(schema.fields, [
    {name: 'heading', selector: 'h2', type: 'text'}, {name: 'keypoint', selector: 'p.keypoint', type: 'text'},
  ]), 'JsonCssExtractionStrategy のスキーマ');
  must(sel.css_selector === 'main#guide' && sel.wait_for === 'css:#guide[data-ready="true"]' && sel.baseSelector === schema.baseSelector, 'css_selector・wait_for');
  const reqs = runs.requests || [];
  const docReqs = reqs.filter(r => r.kind === 'document').length, diagReqs = reqs.filter(r => r.kind === 'diagnostic').length;
  must(reqs.length === 4 && docReqs === 3 && diagReqs === 1, 'arun 4回（文書3・診断1）');
  must(String(runs.scope_note || '').includes('127.0.0.1') && String(runs.scope_note).includes('LLM'), '範囲の注記');

  const docs = runs.documents || [];
  must(docs.length === 3 && docs.map(d => d.id).join() === 'start,review,export', '3ページ');
  const pages = docs.map(d => {
    const r = d.response || {}, src = d.input_html || {};
    must(r.status_code === 200 && r.success === true && d.accepted === true, `${d.path}：HTTP 200・受理`);
    must(FIXTURE_SHA[src.path] && src.sha256 === FIXTURE_SHA[src.path] && typeof src.text === 'string', `${src.path} のハッシュ`);
    let parsed = null;
    try { parsed = JSON.parse(r.extracted_content); } catch { /* 下で止める */ }
    must(Array.isArray(parsed) && sameJSON(parsed, d.sections) && d.sections.length === 2, `${d.path}：extracted_content と sections`);
    for (const s of d.sections) {
      must(typeof s.heading === 'string' && s.heading && typeof s.keypoint === 'string' && s.keypoint, `${d.path}：見出しと要点`);
      must(r.markdown.includes('## ' + s.heading) && r.markdown.includes(s.keypoint), `${d.path}：Markdown に見出しと要点`);
    }
    must(Array.isArray(d.section_origins) && d.section_origins.length === d.sections.length, `${d.path}：節の出どころ`);
    const staticCount = (src.text.match(/<article class="doc-section">/g) || []).length; // 元のHTMLファイルに書かれた節の数
    must(String(d.title || '').includes('｜'), `${d.path}：題名`);
    return {id: d.id, label: d.label, title: d.title.split('｜')[0], path: d.path, status: r.status_code,
      sections: d.sections, origins: d.section_origins, staticCount, script: d.section_origins.includes('script')};
  });
  must(sameJSON(pages.map(p => p.staticCount), [2, 2, 1]), '元のHTMLファイルの節 2・2・1');
  must(sameJSON(pages.map(p => p.origins.filter(o => o === 'html').length), [2, 2, 1]), 'html 由来の節 2・2・1');

  // 書き出し：2つ目の節は export.html に無く、dynamic-export.js だけにある
  const exDoc = docs[2], js = exDoc.input_script || {}, added = exDoc.sections[1];
  must(sameJSON(exDoc.section_origins, ['html', 'script']), '書き出しの節の出どころ');
  must(js.path === 'fixture/docs/dynamic-export.js' && js.sha256 === FIXTURE_SHA[js.path] && typeof js.text === 'string', 'dynamic-export.js のハッシュ');
  must(js.text.includes(`var HEADING = "${added.heading}";`) && js.text.includes(`var KEYPOINT = "${added.keypoint}";`), 'JSが追加した節の文');
  must(!exDoc.input_html.text.includes(added.heading) && !exDoc.input_html.text.includes(added.keypoint), 'export.html に追加節の文が無い');
  must(exDoc.input_html.text.includes('data-ready="false"') && js.text.includes('guide.setAttribute("data-ready", "true")'), 'data-ready の印');
  const delay = /window\.setTimeout\(addSection, (\d+)\);/.exec(js.text);
  must(delay, '追加までの待ち');
  must(docs.every(d => d.request && d.request.config && d.request.config.wait_for === sel.wait_for), '3ページとも同じ wait_for');

  // 取得エラー：HTTP 404。ライブラリの success は true のまま記録し、受理しない
  const dg = runs.diagnostic || {}, dr = dg.response || {};
  must(dg.path === '/docs/missing.html' && dr.status_code === 404 && dr.success === true && dr.error_message === ''
    && dg.accepted === false && dg.counted_as_document === false && dr.extracted_content === null, '診断：HTTP 404・success true・受理しない');
  must([...docs.map(d => [d.response, d.accepted]), [dr, dg.accepted]].every(([r, a]) => a === (r.success === true && r.status_code === 200)),
    '受理＝success かつ HTTP 200');

  const log = runs.access_log || [];
  const robots = log.filter(e => e.path === '/robots.txt').length, notSelected = log.filter(e => e.path === '/not-selected.html').length;
  must(log.length === 8 && robots === 1 && notSelected === 0, 'サーバー記録 8件・robots.txt・選ばないページ');
  must(Array.isArray(runs.checks) && runs.checks.length === 10 && runs.checks.every(c => c.passed === true), 'workflow.py の照合');

  const ss = (samples && samples.samples) || [];
  must(samples && samples.format === 'input-output' && ss.length === 4 && ss[3].id === 'missing'
    && ss[3].output.status_code === 404 && ss[3].output.accepted === false && ss.slice(0, 3).every(s => s.output.accepted === true), 'samples.json');

  const accepted = pages.length, sectionCount = pages.reduce((n, p) => n + p.sections.length, 0);
  must(accepted === 3 && sectionCount === 6, '受理 3・節 6');
  return {
    version: lib.version, commit: lib.commit, pages, added, delayMs: Number(delay[1]),
    cssSelector: sel.css_selector, baseSelector: schema.baseSelector, fields: schema.fields, waitFor: sel.wait_for,
    arunCount: reqs.length, diagCount: diagReqs, total: docReqs, accepted, sectionCount,
    diag: {path: dg.path, status: dr.status_code, success: dr.success, accepted: dg.accepted},
    logCount: log.length, notSelected,
  };
}

function checkCrops() {
  for (const [name, c] of Object.entries(CROP)) {
    const s = SHOTS[c.shot], r = c.src;
    if (!(r.x >= 0 && r.y >= 0 && r.x + r.w <= s.width && r.y + r.h <= s.height)) throw new Error(`切り抜き ${name} が画像の外に出ています。`);
    for (const b of Object.values(c.rings || {})) {
      if (!(b[0] >= r.x && b[1] >= r.y && b[2] <= r.x + r.w && b[3] <= r.y + r.h)) throw new Error(`強調枠 ${name} が切り抜きの外に出ています。`);
    }
  }
}

async function load() {
  if (!window.isSecureContext || !window.crypto || !crypto.subtle) {
    throw new Error('SHA-256 を確かめられません。作例フォルダで python -m http.server 8000 を起動し、http://127.0.0.1:8000/video/ で開いてください。');
  }
  const fonts = [`700 52px ${SERIF}`, `700 34px ${SERIF}`, `700 28px ${SANS}`, `400 26px ${SANS}`, `400 20px ${SANS}`, `400 22px ${MONO}`, `700 32px ${MONO}`]
    .map(f => document.fonts.load(f, '3ページを選び、元の段落を取り出して保存 Markdown JSON 404 article.doc-section'));
  const [runsBuf, samplesBuf] = await Promise.all([verified(FILES.runs), verified(FILES.samples), verified(FILES.memo)]);
  let runs, samples;
  try { runs = JSON.parse(utf8(runsBuf)); samples = JSON.parse(utf8(samplesBuf)); }
  catch { throw new Error('runs.json または samples.json を JSON として読めませんでした。'); }
  const names = Object.keys(SHOTS), imgs = await Promise.all(names.map(n => image(SHOTS[n])));
  names.forEach((n, i) => { IMG[n] = imgs[i]; });
  await Promise.all(fonts);
  await document.fonts.ready;
  D = select(runs, samples);
  checkCrops();
  validateLayout();
}

// ---------- 描画の部品 ----------

const ISSUES = new Set();
let checking = false;
const issue = message => { if (checking) ISSUES.add(message); };

function setFont(weight, size, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }

function layer(a, fn, dx = 0, dy = 0) {
  if (!(a > 0.001)) return;
  ctx.save();
  try { ctx.globalAlpha *= Math.min(1, a); if (dx || dy) ctx.translate(dx, dy); fn(); }
  finally { ctx.restore(); }
}

// 入り：t0 から dur 秒で不透明度0→1、dy/dx だけずれた位置から着地する。out は出の係数。
function show(t, t0, out, fn, {dur = 0.45, dy = 14, dx = 0} = {}) {
  const p = ease(prog(t, t0, t0 + dur));
  layer(p * out, fn, (1 - p) * dx, (1 - p) * dy);
}

function clipTo(r, fn) {
  ctx.save();
  try { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); fn(); }
  finally { ctx.restore(); }
}

function rr(x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath();
}

// 1行の文字。幅を超えるときは min まで縮める。それでも超えれば検査で止める。
function line(str, x, y, o = {}) {
  const {weight = 400, size = 28, family = SANS, color = C.ink, align = 'left', base = 'alphabetic', max = Infinity, min = size} = o;
  let s = size; setFont(weight, s, family);
  while (s > min && ctx.measureText(str).width > max) setFont(weight, --s, family);
  const w = ctx.measureText(str).width;
  if (w > max + 0.5) issue(`「${str}」が${Math.round(max)}pxに収まらない`);
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(str, x, y);
  return w;
}

// 日本語の簡単な禁則つき折り返し
const NO_START = '、。，．・：；？！）」』】〕〉》ー々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ';
const NO_END = '（「『【〔〈《';
function wrapLines(str, max) {
  const toks = str.match(/[A-Za-z0-9_.,:;#=\/'"\[\]()@%+-]+|\s+|./gu) || [];
  const lines = [];
  let cur = '';
  for (const tok of toks) {
    if (cur && !/^\s+$/.test(tok) && ctx.measureText(cur + tok).width > max) {
      let carry = '';
      if (cur.length > 1 && (NO_START.includes(tok[0]) || NO_END.includes(cur.slice(-1)))) { carry = cur.slice(-1); cur = cur.slice(0, -1); }
      lines.push(cur.trimEnd());
      cur = carry + tok;
    } else cur += tok;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

// 複数行の文字。lines 行に収まるまで min まで縮める。それでも収まらなければ検査で止める。
function para(str, x, y, max, o = {}) {
  const {weight = 400, size = 26, min = size, family = SANS, color = C.ink, lh = 1.4, lines = 2} = o;
  let s = size, L;
  const fits = () => L.length <= lines && L.every(l => ctx.measureText(l).width <= max + 0.5);
  for (;;) {
    setFont(weight, s, family); L = wrapLines(str, max);
    if (fits() || s <= min) break;
    s -= 1;
  }
  if (!fits()) issue(`「${str.slice(0, 14)}…」が${lines}行に収まらない`);
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  L.slice(0, lines).forEach((l, k) => ctx.fillText(l, x, y + k * Math.round(s * lh)));
  return s;
}

function pill(str, x, cy, o = {}) {
  const {size = 22, weight = 700, family = SANS, fg = C.ink, bg = C.card, border = C.ink, dash = null, align = 'left', pad = 12} = o;
  setFont(weight, size, family);
  const w = ctx.measureText(str).width + pad * 2, h = size + 16;
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  rr(left, cy - h / 2, w, h, 4);
  if (bg) { ctx.fillStyle = bg; ctx.fill(); }
  if (border) {
    ctx.save(); if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(str, left + pad, cy + 1);
  return w;
}

const title = (str, y = 192, size = 44) => line(str, M, y, {weight: 700, size, family: SERIF, max: CW, min: 40});
const secs = ms => (ms / 1000).toLocaleString('ja-JP', {maximumFractionDigits: 2});

// 実画面の切り抜き。枠線は画像の外側1pxに引き、画像の中には描かない。
function cropRect(c) { const k = c.at.w / c.src.w; return {x: c.at.x, y: c.at.y, w: c.at.w, h: c.src.h * k, k}; }
function shot(c) {
  const r = cropRect(c);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(IMG[c.shot], c.src.x, c.src.y, c.src.w, c.src.h, r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1);
}
// 強調枠：切り抜きの外側、または UI 要素の外側の余白に線だけを引く
function frameAround(r, color, out = 8) {
  ctx.save(); rr(r.x - out, r.y - out, r.w + out * 2, r.h + out * 2, 8);
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}
function ringIn(c, box, color, out = 4) {
  const r = cropRect(c);
  const x0 = r.x + (box[0] - c.src.x) * r.k, y0 = r.y + (box[1] - c.src.y) * r.k;
  const x1 = r.x + (box[2] - c.src.x) * r.k, y1 = r.y + (box[3] - c.src.y) * r.k;
  ctx.save(); rr(x0 - out, y0 - out, x1 - x0 + out * 2, y1 - y0 + out * 2, 7);
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}
const screenLabel = (str, x, y, align = 'right', max = 500) => line(str, x, y, {size: 20, color: C.muted, align, max, min: 16});

// ---------- 持ち続ける形：3ページの紙 ----------

// 節を表す小さな図（文字ではなく形）。dashed は読み込み後に JavaScript が足す節の場所。
function block(x, y, w, h, dashed) {
  rr(x, y, w, h, 5);
  if (dashed) {
    ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = C.rust; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    line('JSが追加', x + w / 2, y + h / 2 + 1, {size: 20, weight: 700, color: C.rust, align: 'center', base: 'middle', max: w - 12, min: 16});
    return;
  }
  ctx.fillStyle = C.deep; ctx.fill();
  ctx.fillStyle = C.teal; ctx.fillRect(x, y + 4, 3, h - 8);
  ctx.fillStyle = C.soft; ctx.fillRect(x + 14, y + 12, w * 0.46, 8);
  ctx.fillStyle = C.muted; ctx.fillRect(x + 14, y + 27, w - 28, 5); ctx.fillRect(x + 14, y + 37, w * 0.58, 5);
}

const CONTENT = {
  // 1. 入力の図：パス・題名・元のHTMLファイルにある節（＋JSが足す場所）
  1(r, p) {
    line(p.path, r.x + 24, r.y + 40, {family: MONO, size: 22, color: C.muted, max: r.w - 48, min: 18});
    line(p.title, r.x + 24, r.y + 82, {weight: 700, size: 30, family: SERIF, max: r.w - 48, min: 24});
    for (let k = 0; k < p.staticCount; k++) block(r.x + 24, r.y + 104 + k * 60, r.w - 48, 48, false);
    if (p.script) block(r.x + 24, r.y + 104 + p.staticCount * 60, r.w - 48, 48, true);
  },
  // 2. 構造：同じ節を横に並べる
  2(r, p) {
    line(p.path, r.x + 22, r.y + 36, {family: MONO, size: 22, max: 240, min: 18});
    line(p.title, r.x + r.w - 20, r.y + 36, {size: 22, color: C.muted, align: 'right', max: 160, min: 18});
    for (let k = 0; k < p.staticCount; k++) block(r.x + 22 + k * 132, r.y + 54, 120, 52, false);
    if (p.script) block(r.x + 22 + p.staticCount * 132, r.y + 54, 120, 52, true);
  },
  // 3. 帳：受理したページと節の数
  3(r, p, t) {
    line(p.label, r.x + 18, r.y + r.h / 2 + 1, {weight: 700, size: 24, base: 'middle', max: 132, min: 20});
    layer(prog(t, 9.5, 9.8), () => line(`${p.status}・${p.sections.length}節`, r.x + r.w - 16, r.y + r.h / 2 + 1,
      {weight: 700, size: 22, color: C.tealDeep, align: 'right', base: 'middle', max: 112, min: 18}));
  },
  // 4. 保存した結果の1行
  4(r, p) {
    const cy = r.y + r.h / 2 + 1;
    line(p.label, r.x + 18, cy, {weight: 700, size: 24, base: 'middle', max: 132, min: 20});
    line(p.path, r.x + 160, cy, {family: MONO, size: 20, color: C.muted, base: 'middle', max: 250, min: 16});
    line(`HTTP ${p.status} ・ ${p.sections.length}節 ・ 受理`, r.x + r.w - 16, cy, {weight: 700, size: 22, color: C.tealDeep, align: 'right', base: 'middle', max: 250, min: 18});
  },
};

function pageGeom(t, i) {
  const o = i * 0.08;
  if (t < 4.5 + o) return {r: lerpRect(R1(i), R2(i), inOut(prog(t, 3.7 + o, 4.5 + o))), from: 1, to: 2, m: inOut(prog(t, 3.7 + o, 4.5 + o))};
  if (t < 9.4 + o) return {r: lerpRect(R2(i), R3(i), inOut(prog(t, 8.6 + o, 9.4 + o))), from: 2, to: 3, m: inOut(prog(t, 8.6 + o, 9.4 + o))};
  const m = inOut(prog(t, 22.8 + o, 23.6 + o));
  return {r: lerpRect(R3(i), R4(i), m), from: 3, to: 4, m};
}

// 今の場面で取り上げているページを、ティールの面で示す
function highlight(t, i) {
  if (i === 0) return prog(t, 9.6, 9.9) * leave(t, 14.6, 0.3);
  if (i === 2) return prog(t, 15.2, 15.5) * leave(t, 18.6, 0.3);
  return 0;
}

function sheet(r, hl) {
  rr(r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = C.card; ctx.fill();
  if (hl > 0) { ctx.save(); ctx.globalAlpha *= hl; ctx.fillStyle = C.tealSoft; ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.strokeStyle = hl > 0.5 ? C.teal : C.line; ctx.lineWidth = 1.5 + 1.5 * hl; ctx.stroke(); ctx.restore();
  ctx.save(); rr(r.x, r.y, r.w, r.h, 8); ctx.clip(); ctx.fillStyle = C.teal; ctx.fillRect(r.x, r.y, 5, r.h); ctx.restore();
}

function pagesLayer(t) {
  D.pages.forEach((p, i) => {
    const e = ease(prog(t, 0.35 + i * 0.15, 0.85 + i * 0.15)), g = pageGeom(t, i);
    layer(e, () => {
      sheet(g.r, highlight(t, i));
      clipTo(g.r, () => {
        layer(1 - prog(g.m, 0, 0.35), () => CONTENT[g.from](g.r, p, t));
        layer(prog(g.m, 0.65, 1), () => CONTENT[g.to](g.r, p, t));
      });
    }, 0, (1 - e) * 18);
  });
}

// 取得エラーの札：19.3秒に帳の右端へ破線で入り、最後は保存した結果の区切り線の下へ移る。受理の数には入れない。
function missingLayer(t) {
  if (t < 19.3) return;
  const e = ease(prog(t, 19.3, 19.75)), m = inOut(prog(t, 23.04, 23.84)), r = lerpRect(R3M, R4M, m);
  const hl = prog(t, 19.5, 19.8) * leave(t, 22.6, 0.3);
  layer(e, () => {
    layer(1 - m, () => {
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(930, 76); ctx.lineTo(930, 124); ctx.stroke(); ctx.restore();
    });
    rr(r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = C.paper; ctx.fill();
    if (hl > 0) { ctx.save(); ctx.globalAlpha *= hl; ctx.fillStyle = C.rustSoft; ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.setLineDash([7, 5]); ctx.strokeStyle = C.rust; ctx.lineWidth = 2 + hl; ctx.stroke(); ctx.restore();
    const cy = r.y + r.h / 2 + 1;
    clipTo(r, () => {
      layer(1 - prog(m, 0, 0.35), () => {
        line(String(D.diag.status), r.x + 18, cy, {weight: 700, size: 26, color: C.rust, base: 'middle'});
        line('受理しない', r.x + r.w - 16, cy, {weight: 700, size: 22, color: C.rust, align: 'right', base: 'middle', max: 150, min: 18});
      });
      layer(prog(m, 0.65, 1), () => {
        line('取得エラー', r.x + 18, cy, {weight: 700, size: 24, color: C.rust, base: 'middle', max: 132, min: 20});
        line(D.diag.path, r.x + 160, cy, {family: MONO, size: 20, color: C.muted, base: 'middle', max: 250, min: 16});
        line(`HTTP ${D.diag.status} ・ 受理しない`, r.x + r.w - 16, cy, {weight: 700, size: 22, color: C.rust, align: 'right', base: 'middle', max: 250, min: 18});
      });
    });
  }, 0, (1 - e) * 14);
}

// ---------- 常に表示する注記 ----------

function footer() {
  ctx.fillStyle = C.line; ctx.fillRect(M, 652, CW, 1);
  ctx.fillStyle = C.teal; ctx.fillRect(M, 675, 10, 10);
  line('架空のローカル文書／保存結果から編集／無音', M + 20, 688, {size: 22, color: C.soft, max: 640, min: 18});
  line(`Crawl4AI ${D.version} ・ Studio Yebisu 作例`, RX, 688, {size: 20, color: C.muted, align: 'right', max: 440, min: 16});
}

// ---------- 1. 依頼（0–4秒） ----------

function sceneIntro(t) {
  const out = leave(t, 3.6);
  show(t, -1, out, () => line(`Crawl4AI ${D.version} の作例 ・ 架空の木工ワークショップの手順書`, M, 108, {size: 24, color: C.muted, max: CW, min: 20}));
  show(t, -1, out, () => line('3ページを選び、元の段落を取り出して保存', M, 176, {weight: 700, size: 52, family: SERIF, max: CW, min: 44}));
  show(t, 0.5, out, () => line('見出しと要点を Markdown と JSON に。404 は受理に数えない', M, 232, {size: 30, max: CW, min: 26}));
  show(t, 0.3, out, () => line('入力：指定した3ページ（図）', M, 276, {size: 20, color: C.muted}));
  show(t, 1.5, out, () => {
    const w = line('→', M, 592, {weight: 700, size: 28, color: C.teal});
    line('保存先：outputs/result.md（Markdown）・ outputs/runs.json（JSON）', M + w + 14, 592, {size: 26, max: CW - w - 14, min: 22});
  });
}

// ---------- 2. 取り方（4–9秒） ----------

function sceneMethod(t) {
  const out = leave(t, 8.5);
  show(t, 4.2, out, () => line('CSSで、節ごとに見出しと要点を取り出す', M, 150, {weight: 700, size: 48, family: SERIF, max: CW, min: 40}));
  show(t, 4.6, out, () => { ctx.fillStyle = C.teal; ctx.fillRect(528, 204, 3, 396); }, {dy: 0});
  const kv = (key, value, note, y) => {
    const kw = pill(key, X2, y - 9, {family: MONO, size: 20, weight: 400, fg: C.tealDeep, bg: C.tealSoft, border: null});
    const vw = line(value, X2 + kw + 14, y, {family: MONO, weight: 700, size: 26, max: 300, min: 22});
    line(note, X2 + kw + vw + 28, y, {size: 24, color: C.soft, max: W2 - kw - vw - 28, min: 20});
  };
  show(t, 4.7, out, () => kv('css_selector', D.cssSelector, '→ Markdown の範囲', 236));
  show(t, 5.0, out, () => kv('baseSelector', D.baseSelector, '→ JSON の1件', 294));
  D.fields.forEach((f, k) => show(t, 5.4 + k * 0.2, out, () => {
    const y = 370 + k * 54;
    line(f.selector, X2 + 250, y, {family: MONO, size: 32, align: 'right', max: 250, min: 26});
    line('→', X2 + 272, y, {weight: 700, size: 32, color: C.teal});
    line(f.name, X2 + 324, y, {family: MONO, weight: 700, size: 32, color: C.tealDeep, max: W2 - 324, min: 26});
  }));
  show(t, 6.0, out, () => line('元の段落をそのまま取り出す。AIの要約ではない', X2, 488, {weight: 700, size: 28, max: W2, min: 24}));
  show(t, 6.4, out, () => line(`arun ${D.arunCount}回 ＝ 文書${D.total}ページ ＋ 存在しないURL ${D.diagCount}件`, X2, 546, {size: 26, max: W2, min: 22}));
  show(t, 6.6, out, () => line('手元の 127.0.0.1 だけ。LLM・クラウド・巡回なし', X2, 592, {size: 24, color: C.soft, max: W2, min: 20}));
}

// ---------- 3. 取り出した節（9–15秒） ----------

function sectionBlock(s, x, y, w, accent) {
  ctx.fillStyle = accent; ctx.fillRect(x, y, 4, 128);
  line('heading', x + 20, y + 32, {family: MONO, size: 20, color: accent});
  line(s.heading, x + 136, y + 34, {weight: 700, size: 34, family: SERIF, max: w - 136, min: 28});
  line('keypoint', x + 20, y + 78, {family: MONO, size: 20, color: accent});
  para(s.keypoint, x + 136, y + 78, w - 136, {size: 26, min: 22, lines: 2, lh: 1.35});
}

function sceneResults(t) {
  const out = leave(t, 14.6), p = D.pages[0];
  show(t, 9.1, out, () => title('取り出したのは、元の段落そのもの'));
  clipTo({x: COL.x, y: 206, w: COL.w + 8, h: 440}, () => {
    show(t, 9.3, out, () => line(`${p.title}（${p.path}）の extracted_content`, COL.x, 236, {size: 22, color: C.muted, max: COL.w, min: 18}));
    p.sections.forEach((s, k) => show(t, 9.5 + k * 0.3, out, () => sectionBlock(s, COL.x, 264 + k * 156, COL.w, C.teal)));
    show(t, 10.3, out, () => line(`受理 ${D.accepted}/${D.total} ページ ・ 節は合計 ${D.sectionCount}`, COL.x, 612, {weight: 700, size: 28, color: C.tealDeep, max: COL.w, min: 24}));
  });
  show(t, 9.4, out, () => { screenLabel('実際のビューア画面（screen-start.png）', RX, 226); shot(CROP.startA); }, {dy: 0, dx: 28});
  show(t, 9.6, out, () => shot(CROP.startB), {dy: 0, dx: 28});
}

// ---------- 4. JSを待つ（15–19秒） ----------

function sceneWait(t) {
  const out = leave(t, 18.6), ex = D.pages[2], add = D.added;
  show(t, 15.1, out, () => title('JSが足す節は、印を待ってから取る'));
  const count = (label, n, y, color) => {
    line(label, COL.x, y, {size: 26, max: COL.w - 70, min: 22});
    line(String(n), COL.x + COL.w, y + 4, {weight: 700, size: 44, color, align: 'right'});
  };
  clipTo({x: COL.x, y: 206, w: COL.w + 8, h: 440}, () => {
    show(t, 15.3, out, () => count('export.html のソースにある節', ex.staticCount, 254, C.ink));
    show(t, 15.7, out, () => line(`約${secs(D.delayMs)}秒後、dynamic-export.js が1節を足して印を付ける`, COL.x, 302, {size: 24, color: C.soft, max: COL.w, min: 20}));
    show(t, 16.1, out, () => count('wait_for のあと取り出した節', ex.sections.length, 360, C.tealDeep));
    show(t, 16.3, out, () => line(`wait_for = ${D.waitFor}`, COL.x, 398, {family: MONO, size: 22, color: C.muted, max: COL.w, min: 18}));
    show(t, 16.6, out, () => {
      ctx.fillStyle = C.line; ctx.fillRect(COL.x, 422, COL.w, 1);
      line('JSが追加した節（section_origins: script）', COL.x, 456, {weight: 700, size: 20, color: C.rust, max: COL.w, min: 16});
      line(add.heading, COL.x, 502, {weight: 700, size: 34, family: SERIF, max: COL.w, min: 28});
      para(add.keypoint, COL.x, 546, COL.w, {size: 26, min: 22, lines: 2, lh: 1.35});
    });
  });
  // 同じ位置で、準備のカードから書き出しのカードへ重ねて替える（同じビューアの別のページ）
  show(t, 14.8, out, () => { screenLabel('実際のビューア画面（screen-export.png）', RX, 226); shot(CROP.exportA); shot(CROP.exportB); }, {dy: 0, dur: 0.4});
  layer(ease(prog(t, 16.0, 16.35)) * out, () => frameAround(cropRect(CROP.exportB), C.rust, 6));
}

// ---------- 5. 404（19–23秒） ----------

function sceneMissing(t) {
  const out = leave(t, 22.6), g = D.diag;
  show(t, 19.1, out, () => title(`${g.status} は、受理に数えない`));
  show(t, 19.2, out, () => shot(CROP.missing), {dy: 20});
  layer(ease(prog(t, 19.9, 20.2)) * out, () => { ringIn(CROP.missing, CROP.missing.rings.http, C.rust); ringIn(CROP.missing, CROP.missing.rings.accepted, C.rust); });
  show(t, 19.4, out, () => screenLabel('実際のビューア画面（screen-missing.png）：判定欄と説明の最初の行', M, 460, 'left', CW));
  show(t, 19.9, out, () => {
    let x = M;
    x += pill(`success: ${g.success}`, x, 514, {family: MONO, size: 28, weight: 700, fg: C.ink, bg: C.card, border: C.ink}) + 16;
    x += line('＋', x, 524, {size: 28, color: C.muted}) + 16;
    x += pill(`HTTP ${g.status}`, x, 514, {family: MONO, size: 28, weight: 700, fg: C.rust, bg: C.card, border: C.rust}) + 16;
    x += line('→', x, 524, {weight: 700, size: 28, color: C.rust}) + 16;
    pill('受理しない', x, 514, {size: 28, fg: C.white, bg: C.rust, border: C.rust});
  });
  show(t, 20.3, out, () => line(`受理は success かつ HTTP 200 のときだけ。文書の受理は ${D.accepted}/${D.total} のまま`, M, 580, {size: 28, max: CW, min: 24}));
  show(t, 20.5, out, () => line(`${g.path}：存在しないURLへの診断用の arun ・ error_message は空`, M, 622, {size: 22, color: C.muted, max: CW, min: 18}));
}

// ---------- 6. 保存した結果（23–28秒） ----------

function sceneSaved(t) {
  show(t, 23.45, 1, () => line(`${D.total}ページの${D.sectionCount}節を、Markdown と JSON に保存`, M, 150, {weight: 700, size: 44, family: SERIF, max: CW, min: 40}));
  show(t, 22.95, 1, () => {
    rr(CARD.x, CARD.y, CARD.w, CARD.h, 10); ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
    line('保存した結果', CARD.x + 24, CARD.y + 38, {weight: 700, size: 26});
    line(`受理 ${D.accepted}/${D.total} ・ 節 ${D.sectionCount}`, CARD.x + CARD.w - 24, CARD.y + 38, {weight: 700, size: 24, color: C.tealDeep, align: 'right'});
    line('outputs/result.md ・ outputs/runs.json ・ samples.json', CARD.x + 24, CARD.y + 74, {family: MONO, size: 20, color: C.muted, max: CARD.w - 48, min: 16});
    ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(CARD.x + 24, 446); ctx.lineTo(CARD.x + CARD.w - 24, 446); ctx.stroke(); ctx.restore();
  }, {dy: 0});
  show(t, 23.9, 1, () => line('手元の 127.0.0.1 だけ。公開Web・巡回・LLM・クラウドなし', M, 558, {size: 24, max: CARD.w, min: 20}));
  show(t, 24.05, 1, () => line(`サーバー記録 ${D.logCount}件（robots.txt を含む）・ 選ばないページへの要求 ${D.notSelected}件`, M, 596, {size: 22, color: C.soft, max: CARD.w, min: 18}));
  show(t, 24.2, 1, () => line(`Crawl4AI ${D.version} ・ ${D.commit}`, M, 632, {family: MONO, size: 20, color: C.muted, max: CARD.w, min: 16}));
  show(t, 23.5, 1, () => { screenLabel('実際のビューア（保存済みの結果を読むだけ）', RX, 186); shot(CROP.phone); }, {dy: 0, dx: 28});
  layer(ease(prog(t, 24.5, 24.8)), () => ringIn(CROP.phone, CROP.phone.rings.saved, C.teal));
  layer(ease(prog(t, 24.8, 25.1)), () => ringIn(CROP.phone, CROP.phone.rings.facts, C.teal));
}

// ---------- seek ----------

function reset() {
  canvas.width = W; canvas.height = H; // 毎回、幅と高さを設定し直して内容・変換・クリップ・スタイルを初期化する
  ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.setLineDash([]); ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  // 配置は1280×720用。ほかの比率では同じ配置を余白つきで縮小する。
  const s = Math.min(W / 1280, H / 720);
  ctx.setTransform(s, 0, 0, s, (W - 1280 * s) / 2, (H - 720 * s) / 2);
}

function draw(t) {
  reset();
  footer();
  if (t < 4.05) sceneIntro(t);
  if (t >= 4 && t < 9) sceneMethod(t);
  if (t >= 9 && t < 15.05) sceneResults(t);
  if (t >= 14.7 && t < 19.05) sceneWait(t);
  if (t >= 19 && t < 23.05) sceneMissing(t);
  if (t >= 22.9) sceneSaved(t);
  pagesLayer(t);
  missingLayer(t);
}

// 各場面の要素が出そろった時刻で一度描き、文字が枠に収まるかを確かめる（収まらなければ準備を拒否する）
const CHECK_TIMES = [3.2, 8.2, 13.5, 18.2, 22.2, 27.5];
function validateLayout() {
  checking = true; ISSUES.clear();
  try { CHECK_TIMES.forEach(draw); } finally { checking = false; }
  if (ISSUES.size) throw new Error('文字が枠に収まりません：' + [...ISSUES].slice(0, 3).join(' ／ '));
}

function drawError(message) {
  reset();
  ctx.fillStyle = C.rust; ctx.fillRect(M, 250, 6, 210);
  line('素材を確かめられなかったため、動画を描いていません', M + 28, 300, {weight: 700, size: 34, color: C.rust, max: CW - 28, min: 22});
  para(message, M + 28, 356, CW - 40, {size: 24, min: 18, lines: 4});
}

function describe() {
  const [a, b, c] = D.pages, add = D.added;
  return `Crawl4AI ${D.version} の作例を説明する28秒・無音の編集動画。架空の手順書3ページ（${a.path}・${b.path}・${c.path}）だけに arun し、`
    + `CSSセレクターで節ごとの見出しと要点を元の段落のまま取り出した。受理${D.accepted}/${D.total}ページ、節は合計${D.sectionCount}。`
    + `書き出しのページは元のHTMLに節が${c.staticCount}つで、約${secs(D.delayMs)}秒後に JavaScript が「${add.heading}」を足し、wait_for で待った後に${c.sections.length}節を取り出した。`
    + `存在しない ${D.diag.path} は HTTP ${D.diag.status}、ライブラリの success は ${D.diag.success} だが受理しない。`
    + `最後に保存したファイル、範囲、固定コミット、作例ビューアの実際の画面を示す。保存済みの結果から編集した映像で、連続した画面録画ではない。`;
}

const $ = id => document.getElementById(id);
const ui = {play: $('play'), scrub: $('scrub'), time: $('time'), status: $('status')};
let current = RENDER ? 0 : POSTER, playing = false, raf = 0, baseT = 0, baseWall = 0;
const sceneLabel = t => { let s = SCENES[0]; for (const x of SCENES) if (t >= x.start) s = x; return s.label; };

function syncUi() {
  if (ui.scrub) { ui.scrub.value = String(Math.round(current * 10) / 10); ui.scrub.setAttribute('aria-valuetext', `${current.toFixed(1)}秒・${sceneLabel(current)}`); }
  if (ui.time) ui.time.textContent = `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒 ・ ${sceneLabel(current)}`;
}

window.seek = seconds => {
  const t = clamp(Number(seconds) || 0, 0, DURATION);
  if (!ready) return window.motionReady.then(() => window.seek(t));
  current = t;
  draw(t);
  syncUi();
  return undefined;
};

// プレビュー用の再生。書き出し時（__MOTION_RENDER__）は動かさない。描画はいつも seek(秒) だけで決まる。
function tick(now) {
  if (!playing) return;
  const t = baseT + (now - baseWall) / 1000;
  if (t >= DURATION) { window.seek(DURATION); setPlaying(false); return; }
  window.seek(t);
  raf = requestAnimationFrame(tick);
}

function rebase() { baseT = current; baseWall = performance.now(); }

function setPlaying(on) {
  if (RENDER || !ready) return;
  playing = on;
  cancelAnimationFrame(raf);
  ui.play.textContent = on ? '一時停止' : '再生';
  ui.play.setAttribute('aria-pressed', String(on));
  if (!on) return;
  if (current >= DURATION - 0.05) window.seek(0);
  rebase();
  raf = requestAnimationFrame(tick);
}

function setupUi() {
  canvas.setAttribute('aria-label', describe());
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (ui.status) {
    ui.status.textContent = '準備完了：保存済みの結果と実際の画面から描画しています（28秒・無音・自動再生なし）。'
      + (reduced ? '動きを減らす設定のため、13.5秒の静止画で止めています。再生ボタンを押したときだけ動きます。' : '');
  }
  if (RENDER || !ui.play || !ui.scrub) return;
  ui.play.disabled = false;
  ui.scrub.disabled = false;
  ui.play.addEventListener('click', () => setPlaying(!playing));
  ui.scrub.addEventListener('input', () => { window.seek(Number(ui.scrub.value)); if (playing) rebase(); });
  ui.scrub.addEventListener('keydown', e => {
    const to = {Home: 0, End: DURATION, PageUp: current + 2, PageDown: current - 2}[e.key];
    if (to === undefined) return;
    e.preventDefault();
    window.seek(to);
    if (playing) rebase();
  });
}

window.motionReady = load().then(() => {
  ready = true;
  window.motionState = 'ready';
  document.documentElement.dataset.motion = 'ready';
  draw(current);
  syncUi();
  setupUi();
});

window.motionReady.catch(err => {
  const message = err && err.message ? err.message : String(err);
  window.motionState = 'error';
  window.motionError = message;
  document.documentElement.dataset.motion = 'error';
  try { drawError(message); } catch { /* Canvas が使えない場合も状態欄には出す */ }
  if (ui.play) ui.play.disabled = true;
  if (ui.scrub) ui.scrub.disabled = true;
  if (ui.status) { ui.status.textContent = `エラー：${message} 再生できません。`; ui.status.classList.add('error'); }
});
