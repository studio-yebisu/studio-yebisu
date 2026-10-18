/* Defuddle 作例「Webページの本文を、Markdownで取り出す」— 概念図ページと図解動画の共通部分
 * 21件の素材を大きさ・SHA-256・中身の対応で照合してから、同梱の Defuddle full版（固定コミット 556d74e からビルドした UMD）を
 * SRI付きで読み込み、保存済みの3つの入力を読み込みごとに1回だけ実際に parse() する。返った title・author・content が
 * 保存済みの出力と全文一致したときだけ、その戻り値から図と読み出しを描く。
 * Defuddle は JavaScript のライブラリで、SKILL.md・モデル・要約AIではない。このページはAIにもNodeにも接続しない。
 * 図の中の「選ぶ・外す」は原典の説明にもとづく説明図で、内部の削除ログ・選択器・計測ではない。
 * ページの初期化は index.html（data-page="defuddle-concept"）でだけ行う。video/video.js は読み込みと描画だけを使う。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

export const CASE_ID = 'defuddle-reading-room';
export const SOURCE_COMMIT = '556d74e8c8fd68c49912d4b11a4ae9ec04d7b2b5';
export const VERSION = '0.19.5';
export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = '484374ed48ed16793c45dfa9edbd94ff51d2e2d11038bec68620160606faa699';
const VENDOR = 'vendor/defuddle/';
const SRC = `${VENDOR}source/src/`;
export const BUNDLE_PATH = `${VENDOR}defuddle.full.js`;
export const BUNDLE_SRI = 'sha256-97OQdFKjN1nwxyEGxLwziIbt8vRY4/O6+CAt8TiUA5Q=';
export const ASSET_PATHS = Object.freeze([
  'concept/structure.json', 'samples.json', 'extraction-results.json',
  'fixtures/reading.html', 'fixtures/operation.html', 'fixtures/research.html',
  BUNDLE_PATH, `${VENDOR}LICENSE`, `${VENDOR}package-lock.json`, `${VENDOR}package.json`, `${VENDOR}README.md`,
  `${SRC}defuddle.ts`, `${SRC}index.full.ts`, `${SRC}markdown.ts`, `${SRC}node.ts`,
  `${VENDOR}THIRD_PARTY_NOTICES.txt`, `${VENDOR}UPSTREAM.json`, 'request.txt',
  'outputs/reading.md', 'outputs/operation.md', 'outputs/research.md',
]);
export const ASSET_COUNT = ASSET_PATHS.length;
// 元の配布のまま改行CRLFの4件と、公式と同じ改行LFの固定ソース4件
const CRLF_FILES = [`${VENDOR}README.md`, `${VENDOR}LICENSE`, `${VENDOR}package.json`, `${VENDOR}package-lock.json`];
const LF_FILES = [`${SRC}index.full.ts`, `${SRC}node.ts`, `${SRC}defuddle.ts`, `${SRC}markdown.ts`];
const VENDOR_TEXT = [...CRLF_FILES, ...LF_FILES, `${VENDOR}THIRD_PARTY_NOTICES.txt`, `${VENDOR}UPSTREAM.json`];
export const OPTIONS = Object.freeze({markdown: true, useAsync: false, removeImages: true});
export const JOB_IDS = Object.freeze(['reading', 'operation', 'research']);
export const PART_IDS = Object.freeze(['input', 'options', 'metadata', 'extract', 'markdown', 'use']);
export const PRESET_LABEL = Object.freeze({reading: '読書会', operation: '保存手順', research: '検索テスト'});
const KEPT_COUNT = Object.freeze({reading: 4, operation: 3, research: 3});
const REMOVED = Object.freeze(['広告枠だけの文章', '関連記事だけの案内', '購読登録だけの案内']);
export const OUTPUTS = Object.freeze({
  reading: Object.freeze({path: 'outputs/reading.md', bytes: 1294, sha256: '25480a9e4d9b5b94f32243c0fd6af18d18dd436ff772c97cef7ff15faed6f1c1'}),
  operation: Object.freeze({path: 'outputs/operation.md', bytes: 1213, sha256: '95be1e92a1211339da505f54f6d71bc0a319b429171c732bfae607707b7fa828'}),
  research: Object.freeze({path: 'outputs/research.md', bytes: 1132, sha256: '55758d1395b572bbdee836806bd0e6e51fd57229bdb595be63d83bf1e7baa8e9'}),
});
// 原典の固定ソースで、呼び出しの道筋を示す行（行番号は読み込んだファイルから探す）
const SOURCE_LINES = Object.freeze([
  {id: 'full-parse', path: `${SRC}index.full.ts`, find: 'const result = this.defuddle.parse();', note: 'full版の parse()：まず本体の parse() で本文とメタ情報を取り出す'},
  {id: 'full-md', path: `${SRC}index.full.ts`, find: "toMarkdown(result, this.options, this.options.url ?? '');", note: '続けて toMarkdown へ渡す'},
  {id: 'md-branch', path: `${SRC}markdown.ts`, find: 'result.content = createMarkdownContent(result.content, url);', note: 'markdown:true なら content をMarkdownに置き換える'},
  {id: 'async-guard', path: `${SRC}defuddle.ts`, find: 'if ((result && result.wordCount > 0) || this.options.useAsync === false) {', note: 'parseAsync()：useAsync:false なら手元の結果を返し、外部APIの補完へ進まない'},
  {id: 'node-async', path: `${SRC}node.ts`, find: 'const result = await defuddle.parseAsync();', note: 'Node版の Defuddle(document, url, options) は parseAsync() を呼ぶ（元の制作の実行）'},
  {id: 'node-md', path: `${SRC}node.ts`, find: 'toMarkdown(result, options ?? {}, pageUrl);', note: 'そのあとMarkdownへ変換する'},
]);

const upstreamOf = (p) => p.slice(VENDOR.length).replace(/^source\//, '');
export const UPSTREAM_TREE = `https://github.com/kepano/defuddle/tree/${SOURCE_COMMIT}`;
const upstreamLine = (p, line) => {
  const up = upstreamOf(p);
  return `https://github.com/kepano/defuddle/blob/${SOURCE_COMMIT}/${up}${up.endsWith('.md') ? '?plain=1' : ''}#L${line}`;
};

const BASE = new URL('./', import.meta.url);
export const assetUrl = (path) => new URL(path, BASE).href;

// ---------- 小さな道具 ----------
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const ease = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
export const prog = (t, a, b) => clamp01((t - a) / (b - a));
// 時刻 at から dur 秒で値を to へ移す変化を順に重ねる（絶対時刻だけで決まる）
export function steps(t, v0, changes) {
  let v = v0, prev = v0;
  for (const [at, to, dur = 0.5] of changes) { v += (to - prev) * ease(prog(t, at, at + dur)); prev = to; }
  return v;
}
const lerp = (a, b, k) => a + (b - a) * k;
export const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});
// n個を順にずらして動かす（spread は全体に占めるずれの割合）
const stagger = (k, i, n, spread = 0.45) => (n <= 1 ? clamp01(k) : clamp01((k - (i * spread) / (n - 1)) / (1 - spread)));
const isStr = (s) => typeof s === 'string' && s.length > 0;
const ids = (list) => (Array.isArray(list) ? list.map((x) => x && x.id) : []);
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
}
const toLF = (s) => s.replace(/\r\n/g, '\n');
const squash = (s) => s.replace(/\s+/g, ' ').trim();
export const fmtBytes = (n) => `${n.toLocaleString('en-US')} B`;
export const hostPath = (url) => url.replace(/^https?:\/\//, '');

// ---------- 取得と照合 ----------
export class AssetError extends Error {}
const fail = (message) => { throw new AssetError(message); };
const check = (ok, message) => { if (!ok) fail(message); };

async function fetchBytes(path, signal) {
  let response;
  try {
    response = await fetch(assetUrl(path), {cache: 'no-store', credentials: 'same-origin', signal});
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    fail(`${path} を取得できませんでした`);
  }
  if (!response.ok) fail(`${path} が HTTP ${response.status} でした`);
  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return fail(`${path} を最後まで読めませんでした`);
  }
}

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
export async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) fail('このブラウザーではSHA-256を計算できません。HTTPS か http://127.0.0.1 のページとして開いてください');
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}
const sriOf = (sha) => `sha256-${btoa(String.fromCharCode(...sha.match(/../g).map((h) => parseInt(h, 16))))}`;

function decodeText(bytes, path) {
  let body;
  try { body = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes); } catch { fail(`${path} がUTF-8として読めません`); }
  return body;
}
function parseJson(path, body) {
  try { return JSON.parse(body.charCodeAt(0) === 0xfeff ? body.slice(1) : body); } catch { return fail(`${path} がJSONとして読めません`); }
}
const splitLines = (text) => text.split(/\r?\n/);

function validateManifest(m) {
  check(m && m.format === 'defuddle-visual-assets/v1' && m.case_id === CASE_ID, 'manifest の形式か作例IDが違います');
  check(Array.isArray(m.files) && sameList(m.files.map((f) => f && f.path), ASSET_PATHS), `manifest の素材${ASSET_COUNT}件の一覧が違います`);
  for (const f of m.files) check(Number.isInteger(f.bytes) && f.bytes > 0 && /^[0-9a-f]{64}$/.test(f.sha256), `manifest の ${f.path} の記録が読めません`);
  for (const pin of Object.values(OUTPUTS)) {
    const e = m.files.find((f) => f.path === pin.path);
    check(e && e.bytes === pin.bytes && e.sha256 === pin.sha256, `manifest の ${pin.path} が固定値と違います`);
  }
  const b = m.files.find((f) => f.path === BUNDLE_PATH);
  check(sriOf(b.sha256) === BUNDLE_SRI, `manifest の ${BUNDLE_PATH} のハッシュが、読み込みに使うSRIと合いません`);
}

// 入力HTMLの領域を読む（図の「元のページ」を描くためだけ。Defuddle の処理とは別の、入力そのものの構造）
function analyzeInput(html, removed, id) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const q = (s) => doc.querySelector(s);
  const header = q('body > header'), ad = q('body > aside.ad'), article = q('main article'), side = q('aside.sidebar'), footer = q('body > footer');
  check(header && ad && article && side && footer, `${id}：入力HTMLにヘッダー・広告・記事・関連記事・フッターの領域がそろっていません`);
  check(ad.textContent.includes(removed[0]) && side.textContent.includes(removed[1]) && footer.textContent.includes(removed[2]),
    `${id}：本文の外の3語が、入力HTMLの広告・関連記事・フッターにありません`);
  const blocks = [];
  for (const el of article.children) {
    const tag = el.tagName;
    if (/^H[1-6]$/.test(tag)) blocks.push({type: 'h', level: Number(tag[1]), text: squash(el.textContent)});
    else if (tag === 'P') blocks.push({type: 'p', text: squash(el.textContent)});
    else if (tag === 'UL' || tag === 'OL') {
      for (const li of el.children) if (li.tagName === 'LI') blocks.push({type: 'li', ordered: tag === 'OL', text: squash(li.textContent)});
    }
  }
  check(blocks.length > 0, `${id}：入力HTMLの記事に段落がありません`);
  return {
    title: squash(q('title')?.textContent || ''),
    author: q('meta[name="author"]')?.getAttribute('content') || '',
    navCount: header.querySelectorAll('nav a').length,
    sideItems: side.querySelectorAll('li').length,
    footerLines: footer.querySelectorAll('p').length,
    blocks,
  };
}

// 返ったMarkdownを、見出し・段落・リスト項目の並びに分ける（図と数のため。content 自体は変えない）
export function mdBlocks(content) {
  const out = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let m;
    if ((m = line.match(/^(#{1,6}) (.*)$/))) out.push({type: 'h', mark: m[1], text: m[2]});
    else if ((m = line.match(/^(\d+)\. (.*)$/))) out.push({type: 'li', ordered: true, mark: `${m[1]}.`, text: m[2]});
    else if ((m = line.match(/^[-*] (.*)$/))) out.push({type: 'li', ordered: false, mark: '-', text: m[1]});
    else out.push({type: 'p', mark: '', text: line});
  }
  return out;
}

function buildBundle(manifest, bytes) {
  const text = (p) => decodeText(bytes.get(p), p);
  const json = (p) => parseJson(p, text(p));
  const entry = (p) => manifest.files.find((f) => f.path === p);

  const S = json('concept/structure.json');
  check(S && S.format === 'defuddle-structure/v1' && S.case_id === CASE_ID && S.source_commit === SOURCE_COMMIT && isStr(S.definition), 'concept/structure.json の形式か固定版が違います');
  check(deepEqual(S.options, OPTIONS), 'concept/structure.json の3つの設定が違います');
  const c = S.counts || {};
  check(c.samples === 3 && c.kept_phrases === 10 && c.excluded_phrases_per_sample === 3 && c.parts === 6, 'concept/structure.json の件数が違います');
  const lim = S.limits || {};
  check(lim.synthetic === true && lim.live_browser_library === true && lim.original_AI_or_Node_rerun === false && lim.arbitrary_URL_fetch === false
    && lim.LLM === false && lim.external_API_fallback === false && lim.semantic_quality_judge === false && lim.internal_trace_measured === false
    && lim.human_approval === false && lim.actual_app_save_or_research === false, 'concept/structure.json の範囲の記録が違います');
  const ep = S.entrypoints || {};
  check(S.inside && S.inside.diagram_not_internal_trace === true && isStr(ep.browser) && isStr(ep.original_node) && isStr(ep.scope), 'concept/structure.json の呼び出し方の記録が違います');

  // 原典：配布のCRLFと固定ソースのLFを区別したまま読む
  const vt = Object.fromEntries(VENDOR_TEXT.map((p) => [p, text(p)]));
  for (const p of CRLF_FILES) check(vt[p].includes('\r\n'), `${p} が元の配布の改行CRLFではありません`);
  for (const p of LF_FILES) check(!vt[p].includes('\r'), `${p} が公式の改行LFではありません`);
  const vl = Object.fromEntries(VENDOR_TEXT.map((p) => [p, splitLines(vt[p])]));
  const license = vt[`${VENDOR}LICENSE`];
  check(license.startsWith('MIT License') && license.includes('Copyright (c) 2025 Steph Ango (@kepano)'), '原典の LICENSE が MIT License（Steph Ango）ではありません');
  const pkg = parseJson(`${VENDOR}package.json`, vt[`${VENDOR}package.json`]);
  check(pkg && pkg.name === 'defuddle' && pkg.version === VERSION && pkg.license === 'MIT', `package.json が defuddle ${VERSION}（MIT）ではありません`);
  const lock = json(`${VENDOR}package-lock.json`);
  check(lock && lock.name === 'defuddle' && lock.version === VERSION, `package-lock.json が defuddle ${VERSION} ではありません`);
  const up = parseJson(`${VENDOR}UPSTREAM.json`, vt[`${VENDOR}UPSTREAM.json`]);
  check(up && up.repository === 'kepano/defuddle' && up.commit === SOURCE_COMMIT && up.version === VERSION, 'UPSTREAM.json の固定版が違います');
  const notices = vt[`${VENDOR}THIRD_PARTY_NOTICES.txt`];
  check(['turndown', 'mathml-to-latex', 'temml', '@xmldom/xmldom'].every((s) => notices.includes(s)) && notices.includes('MIT License'), 'THIRD_PARTY_NOTICES.txt の同梱ライブラリの告知が足りません');

  const quoteRef = (x) => {
    check(x && isStr(x.label) && isStr(x.meaning) && isStr(x.quote) && VENDOR_TEXT.includes(x.source_path) && Number.isInteger(x.line_start) && x.line_start >= 1, `${x && x.id} の引用の記録が読めません`);
    check(x.upstream_path === upstreamOf(x.source_path), `${x.id} の原典のパスが違います`);
    check((vl[x.source_path][x.line_start - 1] || '').includes(x.quote), `${x.id} の引用が ${x.source_path} の${x.line_start}行目にありません`);
    return {id: x.id, label: x.label, meaning: x.meaning, quote: x.quote, source_path: x.source_path, line_start: x.line_start,
      shortPath: x.upstream_path, url: assetUrl(x.source_path), lineUrl: upstreamLine(x.source_path, x.line_start)};
  };
  check(sameList(ids(S.parts), PART_IDS), 'concept/structure.json の6つの部分が違います');
  const parts = S.parts.map(quoteRef);
  const sourceLines = SOURCE_LINES.map((s) => {
    const i = vl[s.path].findIndex((l) => l.includes(s.find));
    check(i >= 0, `${s.path} に「${s.find}」がありません`);
    return {id: s.id, note: s.note, code: vl[s.path][i].trim(), line: i + 1, shortPath: upstreamOf(s.path), url: assetUrl(s.path), lineUrl: upstreamLine(s.path, i + 1)};
  });

  // 3件：structure・samples・保存済みの出力・outputs/*.md・入力のHTMLファイルがすべて同じ
  const samples = json('samples.json');
  check(samples && samples.format === 'input-output' && samples.synthetic === true && sameList(ids(samples.samples), JOB_IDS), 'samples.json の3件が違います');
  const results = json('extraction-results.json');
  check(results && results.engine === 'Defuddle' && results.commit === SOURCE_COMMIT && deepEqual(results.options, OPTIONS) && sameList(ids(results.results), JOB_IDS),
    'extraction-results.json の固定版・設定・3件が違います');
  check(sameList(ids(S.jobs), JOB_IDS), 'concept/structure.json の3件が違います');
  let keptTotal = 0;
  const jobs = {};
  JOB_IDS.forEach((id, i) => {
    const sj = S.jobs[i], sm = samples.samples[i], r = results.results[i], out = OUTPUTS[id];
    check(isStr(sj.label) && sj.label === sm.label && sj.url === `https://example.test/${id}` && sm.url === sj.url && sj.fixture === `fixtures/${id}.html` && sm.fixture === sj.fixture,
      `${id} のラベル・URL・入力ファイルが記録どうしで違います`);
    check(isStr(sj.title) && isStr(sj.author) && r.title === sj.title && r.author === sj.author, `${id} の title・author が記録どうしで違います`);
    check(Array.isArray(sj.kept) && sj.kept.length === KEPT_COUNT[id] && sj.kept.every(isStr) && deepEqual(sj.kept, sm.kept) && deepEqual(sj.kept, r.kept), `${id} の残るべき語句が記録どうしで違います`);
    check(deepEqual(sj.removed, REMOVED) && deepEqual(sm.removed, REMOVED) && deepEqual(r.removed, REMOVED), `${id} の本文の外の3語が違います`);
    check(deepEqual(sj.output_file, out) && sj.source_content_sha256 === out.sha256, `${id} の出力ファイルの記録が違います`);
    const fixture = text(sj.fixture);
    check(typeof sm.input === 'string' && toLF(fixture) === sm.input, `${sj.fixture} が samples.json の入力と違います（改行CRLFだけはそろえて比べます）`);
    check(isStr(r.content) && r.content === sm.output, `${id} の保存済みの content が samples.json の出力と違います`);
    check(text(out.path) === r.content, `${out.path} の中身が保存済みの content と違います`);
    check(sj.kept.every((k) => r.content.includes(k)) && REMOVED.every((k) => !r.content.includes(k)), `${id} の保存済みの content が語句の条件に合いません`);
    keptTotal += sj.kept.length;
    jobs[id] = {
      id, label: sj.label, preset: PRESET_LABEL[id], url: sj.url, fixture: sj.fixture, fixtureBytes: entry(sj.fixture).bytes, fixtureCrlf: fixture.includes('\r\n'),
      input: sm.input, kept: sj.kept, removed: REMOVED,
      saved: {title: r.title, author: r.author, content: r.content},
      output: {...out, url: assetUrl(out.path), file: `${id}.md`, download: `${id}.md`},
      page: analyzeInput(sm.input, REMOVED, id),
      live: null,
    };
  });
  check(keptTotal === c.kept_phrases, `残るべき語句が合計${c.kept_phrases}語ではありません`);
  // ページの説明で引く、検索テストの但し書き（旧画面を選んだ2人と、未検証の一文）
  check(['残る2人は、旧画面のほうが慣れていて速いと答えています', '実務での効果は未検証です'].every((s) => jobs.research.saved.content.includes(s)), 'research の content に但し書きの文がありません');

  const request = text('request.txt');
  check(request.includes(SOURCE_COMMIT) && request.includes('useAsync: false') && request.includes('removeImages: true'), 'request.txt の依頼文が違います');
  return {
    manifest, request, definition: S.definition, entrypoints: {browser: ep.browser, node: ep.original_node, scope: ep.scope},
    parts, sourceLines, jobs, keptTotal,
    vendor: {crlf: CRLF_FILES.map(upstreamOf), lf: LF_FILES.map(upstreamOf), bundleBytes: entry(BUNDLE_PATH).bytes},
  };
}

// ---------- 同梱のDefuddleを読み込んで、3件を実際に取り出す ----------
// 照合済みのハッシュから作ったSRI付きで <script> を足す。読み込めたらコンストラクタを保持し、再試行では再利用する。
let bundleCtor = null;
let bundlePending = null;
let bundleTries = 0;
function loadBundle() {
  if (bundleCtor) return Promise.resolve(bundleCtor);
  if (bundlePending) return bundlePending;
  bundlePending = new Promise((resolve, reject) => {
    for (const old of document.querySelectorAll('script[data-defuddle-bundle]')) old.remove();
    try { delete window.Defuddle; } catch { window.Defuddle = undefined; }
    const url = new URL(assetUrl(BUNDLE_PATH));
    if (bundleTries++ > 0) url.searchParams.set('try', String(bundleTries));
    const s = document.createElement('script');
    s.src = url.href;
    s.integrity = BUNDLE_SRI;
    s.referrerPolicy = 'no-referrer';
    s.dataset.defuddleBundle = '';
    s.addEventListener('load', () => {
      const g = window.Defuddle;
      const Ctor = g && (typeof g.default === 'function' ? g.default : g);
      if (typeof Ctor === 'function' && typeof Ctor.prototype?.parse === 'function') { bundleCtor = Ctor; resolve(Ctor); }
      else reject(new AssetError(`${BUNDLE_PATH} を読み込みましたが、Defuddle が見つかりません`));
    }, {once: true});
    s.addEventListener('error', () => reject(new AssetError(`${BUNDLE_PATH} を実行できませんでした（SRIの照合か取得に失敗）`)), {once: true});
    document.head.append(s);
  }).finally(() => { bundlePending = null; });
  return bundlePending;
}

async function runLive(bundle, signal) {
  const Defuddle = await loadBundle();
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  for (const id of JOB_IDS) {
    const job = bundle.jobs[id];
    let r;
    try {
      const doc = new DOMParser().parseFromString(job.input, 'text/html');
      r = new Defuddle(doc, {url: job.url, markdown: true, useAsync: false, removeImages: true}).parse();
    } catch {
      fail(`${id}：Defuddle の parse() が失敗しました`);
    }
    check(r && typeof r.title === 'string' && typeof r.author === 'string' && typeof r.content === 'string', `${id}：parse() が title・author・content を返しませんでした`);
    check(r.title === job.saved.title, `${id}：返った title が保存済みの出力と違います`);
    check(r.author === job.saved.author, `${id}：返った author が保存済みの出力と違います`);
    check(r.content === job.saved.content, `${id}：返った content が保存済みの出力と全文一致しません`);
    const body = new TextEncoder().encode(r.content);
    check(body.byteLength === job.output.bytes && (await sha256Hex(body)) === job.output.sha256, `${id}：返った content のUTF-8が ${job.output.path} とバイト単位で違います`);
    const blocks = mdBlocks(r.content);
    const kept = job.kept.map((text) => ({text, ok: r.content.includes(text), block: blocks.findIndex((b) => b.text.includes(text))}));
    const removed = job.removed.map((text) => ({text, ok: !r.content.includes(text)}));
    check(kept.every((k) => k.ok) && removed.every((k) => k.ok), `${id}：返った content が語句の条件に合いません`);
    const items = blocks.filter((b) => b.type === 'li');
    job.live = {
      title: r.title, author: r.author, content: r.content, blocks, kept, removed,
      stats: {
        headings: blocks.filter((b) => b.type === 'h').length,
        paragraphs: blocks.filter((b) => b.type === 'p').length,
        items: items.length, ordered: items.some((b) => b.ordered),
        chars: [...r.content].length, bytes: body.byteLength,
      },
    };
  }
}

// 21件をすべて取り直して照合し、同梱のDefuddleで3件を取り出す。どれか一つでも違えば例外。
export async function loadValidatedAssets({signal, onProgress} = {}) {
  const inner = new AbortController();
  const relay = () => inner.abort();
  if (signal?.aborted) inner.abort();
  signal?.addEventListener('abort', relay, {once: true});
  let failed = false;
  try {
    const manifestBytes = await fetchBytes(MANIFEST_PATH, inner.signal);
    check((await sha256Hex(manifestBytes)) === MANIFEST_SHA256, 'concept/manifest.json のSHA-256が固定値と違います');
    const manifest = parseJson(MANIFEST_PATH, decodeText(manifestBytes, MANIFEST_PATH));
    validateManifest(manifest);
    const bytes = new Map();
    let done = 0;
    onProgress?.('assets', 0, manifest.files.length);
    await Promise.all(manifest.files.map(async (entry) => {
      try {
        const body = await fetchBytes(entry.path, inner.signal);
        check(body.byteLength === entry.bytes, `${entry.path} の大きさが記録と違います`);
        check((await sha256Hex(body)) === entry.sha256, `${entry.path} のSHA-256が記録と違います`);
        bytes.set(entry.path, body);
      } catch (error) {
        if (!failed) { failed = true; inner.abort(); }
        throw error;
      }
      if (!failed) onProgress?.('assets', ++done, manifest.files.length);
    }));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const bundle = buildBundle(manifest, bytes);
    onProgress?.('parse', 0, JOB_IDS.length);
    await runLive(bundle, signal);
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return deepFreeze(bundle);
  } finally {
    signal?.removeEventListener('abort', relay);
  }
}

// ---------- 概念図（ページと図解動画で共通） ----------
// 渡す：元のページ（入力HTMLの領域）→ HTMLファイル → DOMParserのDocument、そこへURLと3つの設定を添える
// 取り出す：Defuddle の中で、題名・著者の札が本文と分かれ、本文の段落は虫めがねの下に集まり、外側の領域はふるいの下へ。
//           集まった段落が ##・行・箇条の印を持つMarkdownの行になり、題名・著者と一緒に「返る値」になる
// 使う：作例側の語句の照合 → 実際の .md → メモと、元のページとの見比べ

export const FONT = Object.freeze({
  sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", "Noto Serif JP", serif',
  mono: '"BIZ UDGothic", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
});
// 紙・墨・藍。藍は本文の流れ、セピアは題名と著者の札、斜線の灰は本文の外の領域だけに使う。
export const PALETTES = Object.freeze({
  light: Object.freeze({bg: '#f4f1e8', sheet: '#fdfcf8', ink: '#1e2422', muted: '#575e5a', rule: '#c9c2b0', machine: '#e8e2d2',
    indigo: '#2b4a78', indigoSoft: '#dde4ef', meta: '#8a4f1d', metaSoft: '#f4e7d6', clutter: '#e3ddce', clutterInk: '#8b8370', onInk: '#fdfcf8'}),
  dark: Object.freeze({bg: '#15181a', sheet: '#1f2427', ink: '#ece7da', muted: '#b4b7af', rule: '#4d5252', machine: '#262b2e',
    indigo: '#a9bfe8', indigoSoft: '#273248', meta: '#e3b78c', metaSoft: '#3a2f24', clutter: '#2d2b26', clutterInk: '#9d9581', onInk: '#15181a'}),
});

const TALL = {
  page: [0.02, 0.005, 0.46, 0.35], file: [0.58, 0.005, 0.40, 0.075], doc: [0.58, 0.11, 0.40, 0.12], opts: [0.58, 0.265, 0.40, 0.125],
  tab: [0.02, 0.37, 0.30, 0.04], machine: [0.02, 0.41, 0.96, 0.25],
  meta: [0.045, 0.45, 0.20, 0.19], conv: [0.27, 0.45, 0.31, 0.19], lens: [0.61, 0.45, 0.34, 0.19],
  card: [0.02, 0.70, 0.58, 0.295], check: [0.65, 0.70, 0.33, 0.085], mdfile: [0.65, 0.815, 0.33, 0.075],
  memo: [0.65, 0.92, 0.12, 0.075], viewer: [0.79, 0.92, 0.19, 0.075],
};
const WIDE = {
  page: [0.01, 0.03, 0.19, 0.94], file: [0.235, 0.03, 0.15, 0.14], doc: [0.235, 0.25, 0.15, 0.25], opts: [0.235, 0.58, 0.15, 0.2],
  tab: [0.42, 0.03, 0.13, 0.07], machine: [0.42, 0.10, 0.30, 0.87],
  meta: [0.44, 0.14, 0.26, 0.10], conv: [0.44, 0.28, 0.26, 0.19], lens: [0.44, 0.53, 0.26, 0.41],
  card: [0.755, 0.10, 0.235, 0.43], check: [0.755, 0.58, 0.235, 0.11], mdfile: [0.755, 0.735, 0.235, 0.10],
  memo: [0.755, 0.87, 0.09, 0.10], viewer: [0.855, 0.87, 0.135, 0.10],
};
export const NODE_KEYS = Object.freeze(['page', 'file', 'doc', 'opts', 'machine', 'card', 'check', 'mdfile', 'memo', 'viewer']);
const EDGE_GROUP = {pageFile: 'give', fileDoc: 'give', docOpts: 'give', optsMach: 'give',
  inMeta: 'take', lensConv: 'take', metaCard: 'take', convCard: 'take', cardCheck: 'use', checkFile: 'use', fileMemo: 'use', fileViewer: 'use'};
export const ALL_EDGES = Object.freeze(Object.keys(EDGE_GROUP));
const META_EDGES = new Set(['inMeta', 'metaCard']);
// 6つの部分を選んだときに枠を付ける場所
export const PART_NODES = Object.freeze({input: ['page', 'file', 'doc'], options: ['opts'], metadata: ['meta', 'cardHead'], extract: ['lens'],
  markdown: ['conv', 'cardBody'], use: ['card', 'check', 'mdfile', 'memo', 'viewer']});
const CHIP_LABEL = {title: '題名', author: '著者', header: 'ナビ', ad: '広告', article: '本文', side: '関連', footer: '購読'};
const CLUTTER_KEYS = ['header', 'ad', 'side', 'footer'];

export function chooseKind(W, H) { return W >= 640 && W / H >= 1.25 ? 'wide' : 'tall'; }

const right = (r) => r.x + r.w;
const bottom = (r) => r.y + r.h;
const midX = (r) => r.x + r.w / 2;
const midY = (r) => r.y + r.h / 2;

export function conceptLayout(kind, W, H) {
  const spec = kind === 'wide' ? WIDE : TALL;
  const n = {};
  for (const [k, [x, y, w, h]] of Object.entries(spec)) n[k] = {x: x * W, y: y * H, w: w * W, h: h * H};
  const u = kind === 'wide' ? Math.min(W / 72, H / 34) : Math.min(W / 25, H / 40);
  const f = {label: Math.max(11, u * 0.95), small: Math.max(10, u * 0.8), tiny: Math.max(9, u * 0.68), big: Math.max(13, u * 1.25)};
  const gap = Math.max(3, u * 0.3);

  // 返る値：上に title・author、下に content
  const hh = Math.min(n.card.h * 0.34, f.tiny * 1.45 * 2 + gap * 2.2);
  n.cardHead = {x: n.card.x, y: n.card.y, w: n.card.w, h: hh};
  n.cardBody = {x: n.card.x, y: n.card.y + hh, w: n.card.w, h: n.card.h - hh};

  // 機械の入口 I：Documentと設定がここで中へ入り、題名・著者の線が分かれる
  const e = {};
  let I;
  if (kind === 'wide') {
    I = {x: (n.machine.x + n.meta.x) / 2, y: midY(n.opts)};
    e.pageFile = [[right(n.page), midY(n.file)], [n.file.x, midY(n.file)]];
    e.fileDoc = [[midX(n.file), bottom(n.file)], [midX(n.doc), n.doc.y]];
    e.docOpts = [[midX(n.doc), bottom(n.doc)], [midX(n.opts), n.opts.y]];
    e.optsMach = [[right(n.opts), I.y], [I.x, I.y], [n.lens.x, I.y]];
    e.inMeta = [[I.x, I.y], [I.x, midY(n.meta)], [n.meta.x, midY(n.meta)]];
    e.lensConv = [[midX(n.conv), n.lens.y], [midX(n.conv), bottom(n.conv)]];
    const mx = (right(n.meta) + n.card.x) / 2, hy = midY(n.cardHead);
    e.metaCard = [[right(n.meta), midY(n.meta)], [mx, midY(n.meta)], [mx, hy], [n.card.x, hy]];
    e.convCard = [[right(n.conv), midY(n.conv)], [n.card.x, midY(n.conv)]];
    e.cardCheck = [[midX(n.card), bottom(n.card)], [midX(n.check), n.check.y]];
  } else {
    I = {x: midX(n.opts), y: (n.machine.y + n.meta.y) / 2};
    e.pageFile = [[right(n.page), midY(n.file)], [n.file.x, midY(n.file)]];
    e.fileDoc = [[midX(n.file), bottom(n.file)], [midX(n.doc), n.doc.y]];
    e.docOpts = [[midX(n.doc), bottom(n.doc)], [midX(n.opts), n.opts.y]];
    e.optsMach = [[midX(n.opts), bottom(n.opts)], [I.x, I.y], [I.x, n.lens.y]];
    e.inMeta = [[I.x, I.y], [midX(n.meta), I.y], [midX(n.meta), n.meta.y]];
    e.lensConv = [[n.lens.x, midY(n.lens)], [right(n.conv), midY(n.lens)]];
    e.metaCard = [[midX(n.meta), bottom(n.meta)], [midX(n.meta), n.card.y]];
    e.convCard = [[midX(n.conv), bottom(n.conv)], [midX(n.conv), n.card.y]];
    e.cardCheck = [[right(n.card), midY(n.check)], [n.check.x, midY(n.check)]];
  }
  e.checkFile = [[midX(n.check), bottom(n.check)], [midX(n.mdfile), n.mdfile.y]];
  e.fileMemo = [[midX(n.memo), bottom(n.mdfile)], [midX(n.memo), n.memo.y]];
  e.fileViewer = [[midX(n.viewer), bottom(n.mdfile)], [midX(n.viewer), n.viewer.y]];

  // 部屋の中の置き場
  const lens = n.lens, head = f.small * 1.6;
  const sieveY = lens.y + lens.h * 0.62;
  const tray = {x: lens.x + gap, y: sieveY + gap, w: lens.w - gap * 2, h: bottom(lens) - sieveY - gap * 2};
  const slotW = (tray.w - gap * 3) / 4;
  const traySlots = CLUTTER_KEYS.map((_, i) => ({x: tray.x + i * (slotW + gap), y: tray.y + tray.h * 0.18, w: slotW, h: tray.h * 0.74}));
  const glass = {x: lens.x + gap * 1.5, y: lens.y + head, w: lens.w - gap * 3, h: sieveY - lens.y - head - gap};
  const metaSlots = [0, 1].map((i) => {
    const top = n.meta.y + head, h = Math.min((n.meta.h - head - gap * 3) / 2, f.small * 1.8);
    return {x: n.meta.x + gap, y: top + gap + i * (h + gap), w: n.meta.w - gap * 2, h};
  });

  // Documentの木：head（題名・著者）と body（5つの領域）
  const d = n.doc, dh = f.small * 1.7;
  const rowH = Math.min((d.h - dh - gap * 2) / 2, f.tiny * 2.1);
  const labW = f.tiny * 2.9;
  const x0 = d.x + gap + labW, avail = right(d) - gap - x0;
  const y1 = d.y + dh, y2 = y1 + rowH + gap * 0.8;
  const chips = {hdr: dh, rowH, labW, rows: [y1, y2]};
  const hw = Math.min((avail - gap) / 2, f.tiny * 4.2);
  chips.title = {x: x0, y: y1, w: hw, h: rowH};
  chips.author = {x: x0 + hw + gap, y: y1, w: hw, h: rowH};
  const bw = (avail - gap * 0.5 * 4) / 5;
  ['header', 'ad', 'article', 'side', 'footer'].forEach((k, i) => { chips[k] = {x: x0 + i * (bw + gap * 0.5), y: y2, w: bw, h: rowH}; });

  return {kind, W, H, u, f, gap, n, e, I, sieveY, tray, traySlots, glass, metaSlots, chips};
}

// 既定は完成した姿。ページの段階と動画は、ここから値を変える。
export function restParams() {
  return {
    show: {}, emph: {}, emphEdge: {}, draw: {}, flow: {},
    lid: 0, chambers: [1, 1, 1], regions: 1, file: 1, doc: 1, opts: 1,
    meta: 1, metaOut: 1, travelA: 1, travelB: 1, drop: 1, md: 1, checks: 1, files: 1, use: 1, tagText: 0,
    focusPart: null,
  };
}

// ページの段階：τ=1 渡す、τ=2 取り出す、τ=3 使う。τの途中は動きの途中。図の形と線はいつも全部見せる。
const STAGE_NODES = {page: [1, 0, 0], file: [1, 0, 0], doc: [1, 1, 0], opts: [1, 0, 0], machine: [0, 1, 0], card: [0, 1, 1],
  check: [0, 0, 1], mdfile: [0, 0, 1], memo: [0, 0, 1], viewer: [0, 0, 1]};
const STAGE_EDGES = {give: [1, 0, 0], take: [0, 1, 0], use: [0, 0, 1]};
export function storyParams(tau) {
  const p = restParams();
  const F = p.flow;
  p.regions = ease(prog(tau, 0, 0.3));
  F.pageFile = prog(tau, 0.2, 0.4);
  p.file = prog(tau, 0.25, 0.5);
  F.fileDoc = prog(tau, 0.45, 0.55);
  p.doc = prog(tau, 0.5, 0.75);
  F.docOpts = prog(tau, 0.65, 0.75);
  p.opts = prog(tau, 0.7, 0.9);
  F.optsMach = prog(tau, 0.85, 1.0);
  p.meta = prog(tau, 1.0, 1.3);
  F.inMeta = prog(tau, 1.05, 1.25);
  p.drop = prog(tau, 1.05, 1.5);
  p.travelA = prog(tau, 1.1, 1.45);
  p.metaOut = prog(tau, 1.35, 1.6);
  F.metaCard = prog(tau, 1.4, 1.55);
  F.lensConv = prog(tau, 1.45, 1.6);
  p.travelB = prog(tau, 1.48, 1.85);
  F.convCard = prog(tau, 1.6, 1.75);
  p.md = prog(tau, 1.75, 1.97);
  p.checks = prog(tau, 2.0, 2.45);
  F.cardCheck = prog(tau, 2.0, 2.12);
  F.checkFile = prog(tau, 2.4, 2.52);
  p.files = prog(tau, 2.45, 2.7);
  F.fileMemo = F.fileViewer = prog(tau, 2.65, 2.78);
  p.use = prog(tau, 2.7, 3.0);
  p.tagText = 1;
  const w = [tau <= 1 ? 1 : clamp01(2 - tau), clamp01(1 - Math.abs(tau - 2)), clamp01(tau - 2)];
  const weight = (m) => Math.max(m[0] * w[0], m[1] * w[1], m[2] * w[2]);
  for (const [k, m] of Object.entries(STAGE_NODES)) p.emph[k] = 0.66 + 0.34 * weight(m);
  for (const [k, m] of Object.entries(STAGE_EDGES)) p.emphEdge[k] = 0.66 + 0.34 * weight(m);
  return p;
}

// ---- 描画の部品 ----
function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function alpha(c, a, fn) {
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha *= Math.min(1, a);
  fn();
  c.restore();
}
// 幅 max に収まるまで文字を小さくして描く（下限 min）。収まらなければ末尾を「…」にする。描いた幅を返す。
export function drawText(c, s, x, y, o = {}) {
  const weight = o.weight || 400, family = o.family || FONT.sans;
  let size = o.size || 14;
  const min = Math.min(size, o.min || 9);
  c.font = `${weight} ${size}px ${family}`;
  let w = c.measureText(s).width;
  if (o.max > 0) {
    while (w > o.max && size > min) {
      size = Math.max(min, size - 0.5);
      c.font = `${weight} ${size}px ${family}`;
      w = c.measureText(s).width;
    }
    if (w > o.max) {
      let t = s;
      while (t.length > 1 && c.measureText(`${t}…`).width > o.max) t = t.slice(0, -1);
      s = `${t}…`;
      w = c.measureText(s).width;
    }
  }
  c.fillStyle = o.color || '#000';
  c.textAlign = o.align || 'left';
  c.textBaseline = o.base || 'middle';
  c.fillText(s, x, y);
  return w;
}
function segments(pts) {
  const list = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    list.push({x0, y0, x1, y1, len});
    total += len;
  }
  return {list, total};
}
function pointAt(pts, k) {
  const {list, total} = segments(pts);
  let d = clamp01(k) * total;
  for (const s of list) {
    if (d <= s.len || s === list[list.length - 1]) {
      const q = s.len ? Math.min(1, d / s.len) : 1;
      return {x: s.x0 + (s.x1 - s.x0) * q, y: s.y0 + (s.y1 - s.y0) * q};
    }
    d -= s.len;
  }
  return {x: pts[0][0], y: pts[0][1]};
}
function strokePath(c, pts, k, o) {
  if (k <= 0.001 || pts.length < 2) return;
  const {list, total} = segments(pts);
  let d = clamp01(k) * total;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  let end = {x: pts[0][0], y: pts[0][1], a: 0};
  for (const s of list) {
    if (d <= 0) break;
    const q = Math.min(1, d / (s.len || 1));
    const x = s.x0 + (s.x1 - s.x0) * q, y = s.y0 + (s.y1 - s.y0) * q;
    c.lineTo(x, y);
    end = {x, y, a: Math.atan2(s.y1 - s.y0, s.x1 - s.x0)};
    d -= s.len;
  }
  c.strokeStyle = o.color;
  c.lineWidth = o.width;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.setLineDash([]);
  c.stroke();
  if (o.head > 0) {
    const h = o.head;
    c.beginPath();
    c.moveTo(end.x, end.y);
    c.lineTo(end.x - h * Math.cos(end.a - 0.45), end.y - h * Math.sin(end.a - 0.45));
    c.lineTo(end.x - h * Math.cos(end.a + 0.45), end.y - h * Math.sin(end.a + 0.45));
    c.closePath();
    c.fillStyle = o.color;
    c.fill();
  }
}
function box(c, r, pal, o = {}) {
  rr(c, r.x, r.y, r.w, r.h, o.radius ?? 4);
  if (o.fill !== false) { c.fillStyle = o.fill || pal.sheet; c.fill(); }
  c.setLineDash(o.dash ? [o.dash, o.dash * 0.75] : []);
  c.strokeStyle = o.stroke || pal.ink;
  c.lineWidth = o.lw || 1.4;
  c.stroke();
  c.setLineDash([]);
}
function hatch(c, r, color, step, lw = 1) {
  c.save();
  c.beginPath();
  c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.beginPath();
  for (let x = r.x - r.h; x < r.x + r.w; x += step) { c.moveTo(x, r.y + r.h); c.lineTo(x + r.h, r.y); }
  c.stroke();
  c.restore();
}
// 本文の外の領域：斜線の灰と点線
function clutterBox(c, r, pal, u, label, size) {
  c.fillStyle = pal.clutter;
  c.fillRect(r.x, r.y, r.w, r.h);
  hatch(c, r, pal.clutterInk, Math.max(4, u * 0.42), Math.max(0.8, u * 0.05));
  c.setLineDash([Math.max(2, u * 0.2), Math.max(2, u * 0.15)]);
  c.strokeStyle = pal.clutterInk;
  c.lineWidth = 1;
  c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  c.setLineDash([]);
  if (label && r.h >= size * 1.05) {
    c.font = `700 ${size}px ${FONT.sans}`;
    const tw = c.measureText(label).width;
    if (tw + 4 <= r.w) {
      const ph = Math.min(r.h - 2, size * 1.35);
      c.fillStyle = pal.clutter;
      c.fillRect(midX(r) - tw / 2 - 3, midY(r) - ph / 2, tw + 6, ph);
      drawText(c, label, midX(r), midY(r), {size, weight: 700, color: pal.muted, align: 'center'});
    }
  }
}
// 題名・著者の札（セピアの値札）
function tagPath(c, r) {
  const nose = Math.min(r.h * 0.5, r.w * 0.28);
  c.beginPath();
  c.moveTo(r.x, r.y + r.h / 2);
  c.lineTo(r.x + nose, r.y);
  c.lineTo(r.x + r.w, r.y);
  c.lineTo(r.x + r.w, r.y + r.h);
  c.lineTo(r.x + nose, r.y + r.h);
  c.closePath();
}
function metaTag(c, r, pal, label, size) {
  tagPath(c, r);
  c.fillStyle = pal.metaSoft;
  c.fill();
  c.strokeStyle = pal.meta;
  c.lineWidth = Math.max(1.1, r.h * 0.07);
  c.stroke();
  const nose = Math.min(r.h * 0.5, r.w * 0.28);
  c.beginPath();
  c.arc(r.x + nose * 0.75, r.y + r.h / 2, Math.max(1, r.h * 0.11), 0, Math.PI * 2);
  c.stroke();
  if (label && r.w > size * 1.6 + nose) drawText(c, label, r.x + nose + (r.w - nose) / 2, midY(r), {size: Math.min(size, r.h * 0.78), min: 7, weight: 700, color: pal.meta, align: 'center', max: r.w - nose - 2});
}
function fileShape(c, r, pal, o = {}) {
  const fold = Math.min(r.w * 0.28, r.h * 0.32);
  c.beginPath();
  c.moveTo(r.x, r.y);
  c.lineTo(r.x + r.w - fold, r.y);
  c.lineTo(r.x + r.w, r.y + fold);
  c.lineTo(r.x + r.w, r.y + r.h);
  c.lineTo(r.x, r.y + r.h);
  c.closePath();
  if (o.fill !== false) { c.fillStyle = o.fill || pal.sheet; c.fill(); }
  c.setLineDash(o.dash ? [o.dash, o.dash * 0.75] : []);
  c.strokeStyle = o.stroke || pal.ink;
  c.lineWidth = o.lw || 1.3;
  c.stroke();
  c.setLineDash([]);
  c.beginPath();
  c.moveTo(r.x + r.w - fold, r.y);
  c.lineTo(r.x + r.w - fold, r.y + fold);
  c.lineTo(r.x + r.w, r.y + fold);
  c.stroke();
}
function checkMark(c, x, y, s, color) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = Math.max(1.4, s * 0.2);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(x - s * 0.45, y);
  c.lineTo(x - s * 0.12, y + s * 0.33);
  c.lineTo(x + s * 0.48, y - s * 0.38);
  c.stroke();
  c.restore();
}
function focusBox(c, L, r, pal) {
  const pad = Math.max(3, L.u * 0.22);
  rr(c, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, L.u * 0.35);
  c.setLineDash([]);
  c.strokeStyle = pal.indigo;
  c.lineWidth = 3;
  c.stroke();
}
const val = (o, k, dflt) => (o && o[k] !== undefined ? o[k] : dflt);

// ---- 段落の形（元のページ・機械の中・Markdownで同じ形を使う） ----
const ROW_W = {h: 1.5, p: 1.2, li: 0.8};
function rowRects(r, blocks, pad) {
  const total = blocks.reduce((s, b) => s + ROW_W[b.type], 0) || 1;
  const unit = Math.max(0, r.h - pad * 2) / total;
  let y = r.y + pad;
  return blocks.map((b) => {
    const h = ROW_W[b.type] * unit;
    const out = {x: r.x + pad, y, w: r.w - pad * 2, h};
    y += h;
    return out;
  });
}
function blockGlyph(c, type, r, pal, o = {}) {
  if (r.w <= 1 || r.h <= 0.5) return;
  const ink = o.ink || pal.ink, soft = o.soft || pal.muted;
  const lh = Math.max(1, Math.min(r.h * 0.2, 3));
  if (type === 'h') {
    const h = Math.max(1.5, Math.min(r.h * 0.42, 6));
    c.fillStyle = ink;
    c.fillRect(r.x, r.y + (r.h - h) / 2, r.w * 0.62, h);
  } else if (type === 'li') {
    const d = Math.max(1, Math.min(r.h * 0.17, 2.4));
    c.fillStyle = ink;
    c.beginPath();
    c.arc(r.x + d + 0.5, r.y + r.h / 2, d, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = soft;
    c.fillRect(r.x + d * 2 + 3, r.y + r.h / 2 - lh / 2, (r.w - d * 2 - 3) * 0.78, lh);
  } else {
    c.fillStyle = soft;
    c.fillRect(r.x, r.y + r.h * 0.33 - lh / 2, r.w, lh);
    c.fillRect(r.x, r.y + r.h * 0.7 - lh / 2, r.w * 0.68, lh);
  }
}

// ---- 元のページ（入力HTMLの領域から描いた図。画面の撮影ではない） ----
function pageRegions(r, u, k, mini) {
  const pad = Math.max(mini ? 1.5 : 2, u * (mini ? 0.12 : 0.22));
  const bar = mini ? pad : Math.max(8, Math.min(r.h * 0.07, u * 1.15));
  const gap = Math.max(1, u * 0.1) + k * u * (mini ? 0.08 : 0.22);
  const x0 = r.x + pad, w = r.w - pad * 2;
  let y = r.y + bar + pad;
  const H = r.y + r.h - pad - y;
  const hh = H * 0.11, ah = H * 0.085, fh = H * 0.11;
  const bh = Math.max(1, H - hh - ah - fh - gap * 3);
  const header = {x: x0, y, w, h: hh};
  y += hh + gap;
  const ad = {x: x0, y, w, h: ah};
  y += ah + gap;
  const aw = (w - gap) * 0.67;
  const article = {x: x0, y, w: aw, h: bh};
  const side = {x: x0 + aw + gap, y, w: w - aw - gap, h: bh};
  y += bh + gap;
  const footer = {x: x0, y, w, h: fh};
  return {pad, bar, header, ad, article, side, footer};
}
function drawPage(c, L, r, job, pal, k, mini) {
  const u = L.u, f = L.f, info = job.page;
  const g = pageRegions(r, u, k, mini);
  box(c, r, pal, {radius: Math.min(u * 0.3, 6), lw: mini ? 1 : 1.6});
  if (!mini) {
    c.strokeStyle = pal.rule;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(r.x, r.y + g.bar);
    c.lineTo(right(r), r.y + g.bar);
    c.stroke();
    const fs = Math.min(f.tiny, g.bar * 0.75);
    const lw = drawText(c, '元のページ', r.x + g.pad * 1.5, r.y + g.bar / 2, {size: fs, min: 7, weight: 700, color: pal.ink, max: r.w * 0.45});
    drawText(c, hostPath(job.url), right(r) - g.pad * 1.5, r.y + g.bar / 2, {size: fs * 0.92, min: 7, color: pal.muted, align: 'right', max: r.w - lw - g.pad * 5});
  }
  const lab = mini ? 0 : f.tiny;
  // ヘッダーとナビ・広告・関連記事・購読：最初は普通の紙、kで本文の外の領域として色が付く
  const plain = (rect) => { c.fillStyle = pal.sheet; c.fillRect(rect.x, rect.y, rect.w, rect.h); c.strokeStyle = pal.rule; c.lineWidth = 1; c.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1); };
  const outer = (rect, label, content) => {
    plain(rect);
    content(rect);
    alpha(c, k, () => clutterBox(c, rect, pal, u, mini ? '' : label, lab));
  };
  outer(g.header, CHIP_LABEL.header, (rect) => {
    const lh = Math.max(1.5, rect.h * 0.22);
    c.fillStyle = pal.ink;
    c.fillRect(rect.x + rect.w * 0.05, midY(rect) - lh / 2, rect.w * 0.3, lh);
    const n = Math.max(1, info.navCount), pw = (rect.w * 0.5) / n;
    c.fillStyle = pal.muted;
    for (let i = 0; i < n; i++) c.fillRect(rect.x + rect.w * 0.45 + i * pw, midY(rect) - lh * 0.35, pw * 0.7, lh * 0.7);
  });
  outer(g.ad, CHIP_LABEL.ad, (rect) => { c.fillStyle = pal.muted; c.fillRect(rect.x + rect.w * 0.05, midY(rect) - 0.75, rect.w * 0.6, 1.5); });
  outer(g.side, CHIP_LABEL.side, (rect) => {
    const pad = Math.max(1.5, u * 0.15);
    const rows = rowRects(rect, [{type: 'h'}, {type: 'p'}, ...Array.from({length: Math.max(1, info.sideItems)}, () => ({type: 'li'}))], pad);
    rows.forEach((rw, i) => blockGlyph(c, i === 0 ? 'h' : i === 1 ? 'p' : 'li', rw, pal, {ink: pal.muted}));
  });
  outer(g.footer, CHIP_LABEL.footer, (rect) => {
    c.fillStyle = pal.muted;
    for (let i = 0; i < Math.max(1, info.footerLines); i++) c.fillRect(rect.x + rect.w * 0.05, rect.y + rect.h * (0.35 + i * 0.3), rect.w * (0.7 - i * 0.2), 1.3);
  });
  // 記事：藍の実線。中の段落は入力HTMLの順
  c.fillStyle = pal.sheet;
  c.fillRect(g.article.x, g.article.y, g.article.w, g.article.h);
  c.strokeStyle = pal.rule;
  c.lineWidth = 1;
  c.strokeRect(g.article.x + 0.5, g.article.y + 0.5, g.article.w - 1, g.article.h - 1);
  alpha(c, k, () => { c.strokeStyle = pal.indigo; c.lineWidth = mini ? 1.2 : 2; c.strokeRect(g.article.x + 1, g.article.y + 1, g.article.w - 2, g.article.h - 2); });
  const rows = rowRects(g.article, info.blocks, Math.max(1.5, u * (mini ? 0.1 : 0.22)));
  rows.forEach((rw, i) => blockGlyph(c, info.blocks[i].type, rw, pal));
  return g;
}

// ---- 各部分 ----
function drawFileNode(c, L, p, job, pal) {
  const r = L.n.file, f = L.f, g = L.gap;
  const done = p.file >= 1;
  box(c, r, pal, {dash: done ? 0 : Math.max(3, L.u * 0.25), stroke: done ? pal.ink : pal.rule});
  const ih = r.h - g * 2, iw = Math.min(ih * 0.78, r.w * 0.22);
  const icon = {x: r.x + g, y: r.y + g, w: iw, h: ih};
  alpha(c, done ? 1 : 0.35, () => {
    fileShape(c, icon, pal, {stroke: pal.ink});
    drawText(c, '<>', midX(icon), icon.y + icon.h * 0.62, {size: Math.min(f.tiny, iw * 0.42), min: 6, weight: 700, color: pal.indigo, align: 'center', family: FONT.mono});
  });
  const tx = right(icon) + g, tw = right(r) - g - tx;
  const two = r.h >= f.small * 2.6;
  drawText(c, `${job.id}.html`, tx, two ? r.y + r.h * 0.34 : midY(r), {size: f.small, weight: 700, color: pal.ink, max: tw});
  if (two) drawText(c, 'HTMLの文字列', tx, r.y + r.h * 0.72, {size: f.tiny, color: pal.muted, max: tw});
}
function drawDocNode(c, L, p, job, pal) {
  const r = L.n.doc, f = L.f, g = L.gap, ch = L.chips, u = L.u;
  box(c, r, pal, {});
  drawText(c, 'Document', r.x + g, r.y + ch.hdr / 2, {size: f.small, weight: 700, color: pal.ink, max: r.w * 0.56});
  drawText(c, 'DOMParser', right(r) - g, r.y + ch.hdr / 2, {size: f.tiny, color: pal.muted, align: 'right', max: r.w * 0.4});
  const order = ['title', 'author', 'header', 'ad', 'article', 'side', 'footer'];
  const k = p.doc * order.length;
  ['head', 'body'].forEach((lab, i) => alpha(c, clamp01(k - (i ? 2 : 0)), () => {
    drawText(c, lab, r.x + g, ch.rows[i] + ch.rowH / 2, {size: f.tiny, color: pal.muted, max: ch.labW - 2, family: FONT.mono});
  }));
  order.forEach((key, i) => alpha(c, clamp01(k - i), () => {
    const cr = ch[key];
    if (key === 'title' || key === 'author') metaTag(c, cr, pal, CHIP_LABEL[key], f.tiny);
    else if (key === 'article') {
      c.fillStyle = pal.sheet;
      c.fillRect(cr.x, cr.y, cr.w, cr.h);
      c.strokeStyle = pal.indigo;
      c.lineWidth = 2;
      c.strokeRect(cr.x + 1, cr.y + 1, cr.w - 2, cr.h - 2);
      if (cr.w > f.tiny * 2.1) drawText(c, CHIP_LABEL.article, midX(cr), midY(cr), {size: Math.min(f.tiny, cr.h * 0.8), min: 7, weight: 700, color: pal.indigo, align: 'center', max: cr.w - 3});
    } else clutterBox(c, cr, pal, u * 0.6, cr.w > f.tiny * 2.1 ? CHIP_LABEL[key] : '', Math.min(f.tiny, cr.h * 0.8));
  }));
}
function optRows(job) {
  return [
    {key: 'url', val: hostPath(job.url), url: true},
    {key: 'markdown', val: 'true'},
    {key: 'useAsync', val: 'false'},
    {key: 'removeImages', val: 'true'},
  ];
}
function drawOptsNode(c, L, p, job, pal) {
  const r = L.n.opts, f = L.f, g = L.gap;
  box(c, r, pal, {});
  const rows = optRows(job);
  const rh = (r.h - g * 1.2) / rows.length;
  const size = Math.min(f.tiny, rh * 0.82);
  c.font = `700 ${size}px ${FONT.mono}`;
  const kw = Math.min(r.w * 0.52, Math.max(...rows.map((x) => c.measureText(x.key).width)) + size * 0.6);
  rows.forEach((row, i) => alpha(c, clamp01(p.opts * rows.length - i), () => {
    const y = r.y + g * 0.6 + rh * (i + 0.5);
    let x = r.x + g;
    if (row.url) {
      const tg = {x, y: y - rh * 0.36, w: size * 1.2, h: rh * 0.72};
      metaTag(c, tg, pal, '', size);
      x = right(tg) + 2;
    }
    drawText(c, row.key, x, y, {size, min: 7, weight: 700, color: pal.ink, max: r.x + g + kw - x, family: FONT.mono});
    drawText(c, row.val, r.x + g + kw, y, {size, min: 7, color: row.url ? pal.muted : pal.indigo, max: right(r) - g - (r.x + g + kw), family: FONT.mono});
  }));
}

function drawMachineBody(c, L, p, pal) {
  const m = L.n.machine, t = L.n.tab, f = L.f, u = L.u;
  // 見出しのタブ
  rr(c, t.x, t.y, t.w, t.h + 4, Math.min(u * 0.3, 6));
  c.fillStyle = pal.ink;
  c.fill();
  const tw = drawText(c, 'Defuddle', t.x + L.gap * 1.4, t.y + t.h / 2 + 1, {size: Math.min(f.label * 1.05, t.h * 0.72), min: 9, weight: 700, color: pal.onInk, family: FONT.mincho, max: t.w * 0.72});
  drawText(c, 'full', t.x + L.gap * 2 + tw, t.y + t.h / 2 + 1, {size: Math.min(f.tiny, t.h * 0.6), min: 7, color: pal.onInk, max: right(t) - (t.x + L.gap * 2 + tw) - 2});
  box(c, m, pal, {fill: pal.machine, lw: Math.max(2, u * 0.16), radius: Math.min(u * 0.4, 8)});
  // 「中は説明図」：入口の線と重ならない側に小さく
  const note = '中は説明図';
  if (L.kind === 'wide') drawText(c, note, right(m) - L.gap, m.y + (L.n.meta.y - m.y) / 2, {size: f.tiny, color: pal.muted, align: 'right', max: m.w * 0.4});
  else drawText(c, note, right(m) - L.gap, m.y + (L.n.meta.y - m.y) / 2, {size: f.tiny, color: pal.muted, align: 'right', max: right(m) - L.I.x - L.gap * 3});
}
function chamberFrame(c, L, r, pal, label, color) {
  box(c, r, pal, {lw: 1.3, radius: Math.min(L.u * 0.3, 6)});
  drawText(c, label, r.x + L.gap, r.y + L.f.small * 0.85, {size: L.f.small, weight: 700, color: color || pal.ink, max: r.w - L.gap * 2});
}
function drawChambers(c, L, p, d, job, pal) {
  const {n, f, u, gap} = L;
  const [cm, cl, cc] = p.chambers;
  // 題名・著者の部屋：札の形の目印
  alpha(c, cm, () => {
    chamberFrame(c, L, n.meta, pal, '題名・著者', pal.meta);
    const resting = p.meta >= 1 && p.metaOut <= 0;
    if (!resting) {
      const s = Math.min(n.meta.w * 0.55, (n.meta.h - f.small * 1.7) * 0.45);
      metaTag(c, {x: midX(n.meta) - s / 2, y: n.meta.y + f.small * 1.7 + (n.meta.h - f.small * 1.7 - s * 0.55) / 2, w: s, h: s * 0.55}, pal, '', f.tiny);
    }
  });
  // 本文を選ぶ部屋：虫めがね・ふるい・外した領域の受け皿
  alpha(c, cl, () => {
    chamberFrame(c, L, n.lens, pal, '本文を選ぶ', pal.indigo);
    const gl = L.glass;
    const rad = Math.min(gl.w * 0.3, gl.h * 0.45);
    const gx = midX(gl), gy = midY(gl);
    c.strokeStyle = pal.indigo;
    c.lineWidth = Math.max(1.6, u * 0.12);
    c.beginPath();
    c.arc(gx, gy, rad, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(gx + rad * 0.72, gy + rad * 0.72);
    c.lineTo(gx + rad * 1.18, gy + rad * 1.1);
    c.stroke();
    // ふるい
    c.setLineDash([Math.max(3, u * 0.28), Math.max(2, u * 0.2)]);
    c.strokeStyle = pal.clutterInk;
    c.lineWidth = Math.max(1.2, u * 0.09);
    c.beginPath();
    c.moveTo(n.lens.x + gap, L.sieveY);
    c.lineTo(right(n.lens) - gap, L.sieveY);
    c.stroke();
    c.setLineDash([]);
    drawText(c, '外す', right(n.lens) - gap, L.sieveY - f.tiny * 0.75, {size: f.tiny, weight: 700, color: pal.muted, align: 'right', max: n.lens.w * 0.3});
    // 受け皿に落ちた外側の領域（説明図）
    CLUTTER_KEYS.forEach((key, i) => {
      if (stagger(p.drop, i, CLUTTER_KEYS.length) < 1) return;
      const s = L.traySlots[i];
      clutterBox(c, s, pal, u * 0.6, s.w > f.tiny * 2.1 ? CHIP_LABEL[key] : '', Math.min(f.tiny, s.h * 0.7));
    });
  });
  // Markdownの部屋：## と - の印
  alpha(c, cc, () => {
    chamberFrame(c, L, n.conv, pal, 'Markdown', pal.indigo);
    const top = n.conv.y + f.small * 1.8, h = bottom(n.conv) - top - gap;
    const rows = [['##', 'h'], ['', 'p'], ['-', 'li'], ['-', 'li']];
    const rh = h / rows.length, size = Math.min(f.small, rh * 0.8);
    const mw = size * 1.6;
    rows.forEach(([mark, type], i) => {
      const y = top + rh * i;
      if (mark) drawText(c, mark, n.conv.x + gap, y + rh / 2, {size, weight: 700, color: pal.indigo, family: FONT.mono});
      blockGlyph(c, type === 'li' ? 'p' : type, {x: n.conv.x + gap + mw, y: y + rh * 0.15, w: n.conv.w - gap * 2 - mw, h: rh * 0.7}, pal);
    });
  });
}

function drawCard(c, L, p, d, job, pal) {
  const {n, f, u, gap} = L;
  const live = job.live;
  const done = p.metaOut >= 1 || p.travelB > 0;
  box(c, n.card, pal, {lw: 1.6, dash: done ? 0 : Math.max(3, u * 0.25), stroke: done ? pal.ink : pal.rule});
  // 上：title・author（Defuddleが本文と別に返した値）
  const hd = n.cardHead;
  c.strokeStyle = pal.rule;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(hd.x + gap, bottom(hd));
  c.lineTo(right(hd) - gap, bottom(hd));
  c.stroke();
  const rows = [['title', live.title], ['author', live.author]];
  const rh = (hd.h - gap) / 2;
  rows.forEach(([key, value], i) => {
    const y = hd.y + gap * 0.5 + rh * (i + 0.5);
    const kw = drawText(c, key, hd.x + gap, y, {size: f.tiny, min: 7, color: pal.muted, family: FONT.mono, max: hd.w * 0.28});
    // 札が届いた瞬間に値が出る（札の動きと同じずらし方）
    const k = prog(stagger(p.metaOut, i, 2, 0.3), 0.85, 1);
    const x = hd.x + gap * 1.8 + Math.max(kw, f.tiny * 3.2);
    if (k > 0) alpha(c, k, () => drawText(c, value, x, y, {size: f.small, min: 8, weight: 700, color: pal.meta, max: right(hd) - gap - x}));
    else {
      c.strokeStyle = pal.rule;
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(right(hd) - gap, y);
      c.stroke();
      c.setLineDash([]);
    }
  });
  // 下：content（返ったMarkdownの行）。段落が届いた行から現れ、p.md で ## ・ - の印と文字に変わる
  const body = n.cardBody, blocks = live.blocks, N = blocks.length;
  const rects = rowRects(body, blocks, Math.max(2, u * 0.25));
  const markW = f.tiny * 1.9;
  rects.forEach((r, i) => {
    if (stagger(p.travelB, i, N) < 1) return;
    const b = blocks[i];
    const inner = {x: r.x + markW, y: r.y + r.h * 0.12, w: r.w - markW, h: r.h * 0.76};
    // 行が低すぎて文字が読めない画面では、同じ形（太い棒・2本の線・点と線）のまま印だけを残す
    const textOk = r.h >= 10;
    alpha(c, 1 - (textOk ? p.md : 0), () => blockGlyph(c, b.type, {x: r.x, y: inner.y, w: r.w, h: inner.h}, pal));
    if (textOk) alpha(c, p.md, () => {
      const size = Math.min(b.type === 'h' ? f.small : f.tiny, r.h * 0.8);
      if (b.mark) drawText(c, b.mark, r.x, midY(r), {size, min: 8, weight: 700, color: pal.indigo, family: FONT.mono, max: markW - 2});
      drawText(c, b.text, inner.x, midY(r), {size, min: 8, weight: b.type === 'h' ? 700 : 400, color: b.type === 'p' ? pal.muted : pal.ink, max: inner.w});
    });
  });
  // 作例側の照合：残るべき語句がある行に藍の印（語句の文字は入る幅があるときだけ）
  const K = live.kept.length, total = K + live.removed.length;
  live.kept.forEach((kp, j) => {
    const a = clamp01((p.checks * total - j) * 1.5);
    if (a <= 0 || kp.block < 0 || stagger(p.travelB, kp.block, N) < 1) return;
    const r = rects[kp.block];
    alpha(c, a, () => {
      const s = Math.max(6, Math.min(r.h * 0.95, f.small));
      c.fillStyle = pal.indigoSoft;
      c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = pal.indigo;
      c.fillRect(r.x, bottom(r) - Math.max(1.2, r.h * 0.1), r.w, Math.max(1.2, r.h * 0.1));
      const b = blocks[kp.block];
      const tagSize = Math.min(f.tiny, r.h * 0.8);
      if (r.h >= 10) {
        if (b.mark) drawText(c, b.mark, r.x, midY(r), {size: tagSize, min: 8, weight: 700, color: pal.indigo, family: FONT.mono, max: markW - 2});
        c.font = `700 ${tagSize}px ${FONT.sans}`;
        const tw = c.measureText(kp.text).width;
        const room = r.w - markW - s * 1.4;
        if (p.tagText && tw <= room) drawText(c, kp.text, r.x + markW, midY(r), {size: tagSize, weight: 700, color: pal.indigo});
        else drawText(c, b.text, r.x + markW, midY(r), {size: tagSize, min: 8, color: pal.ink, max: room});
      } else blockGlyph(c, b.type, {x: r.x, y: r.y + r.h * 0.12, w: r.w - s * 1.4, h: r.h * 0.76}, pal, {ink: pal.indigo});
      checkMark(c, right(r) - s * 0.6, midY(r), s, pal.indigo);
    });
  });
}
function drawCheckNode(c, L, p, job, pal) {
  const r = L.n.check, f = L.f, g = L.gap, live = job.live;
  const K = live.kept.length, R = live.removed.length, total = K + R;
  const shown = Math.floor(p.checks * total + 1e-6);
  const nk = Math.min(K, shown), nr = Math.max(0, Math.min(R, shown - K));
  box(c, r, pal, {dash: p.checks > 0 ? 0 : Math.max(3, L.u * 0.25), stroke: p.checks > 0 ? pal.ink : pal.rule});
  const withHead = r.h >= f.tiny * 1.35 * 3 + g;
  const rowsTop = withHead ? r.y + f.tiny * 1.4 + g * 0.4 : r.y + g * 0.4;
  if (withHead) drawText(c, '語句の照合（作例）', r.x + g, r.y + f.tiny * 0.85 + g * 0.2, {size: f.tiny, weight: 700, color: pal.muted, max: r.w - g * 2});
  const rh = (bottom(r) - g * 0.4 - rowsTop) / 2;
  [['残る', nk, K, nk === K && p.checks > 0], ['入らない', nr, R, nr === R && shown >= total]].forEach(([label, num, all, ok], i) => {
    const y = rowsTop + rh * (i + 0.5), size = Math.min(f.small, rh * 0.8);
    const lw = drawText(c, label, r.x + g, y, {size, min: 8, weight: 700, color: pal.ink, max: r.w * 0.55});
    drawText(c, `${num}/${all}`, r.x + g * 1.8 + lw, y, {size, min: 8, color: pal.indigo, weight: 700, max: r.w * 0.3});
    if (ok) checkMark(c, right(r) - g - size * 0.6, y, size, pal.indigo);
  });
}
function drawMdFile(c, L, p, job, pal) {
  const r = L.n.mdfile, f = L.f, g = L.gap;
  const done = p.files >= 1;
  box(c, r, pal, {dash: done ? 0 : Math.max(3, L.u * 0.25), stroke: done ? pal.ink : pal.rule});
  const ih = r.h - g * 2, iw = Math.min(ih * 0.78, r.w * 0.24);
  const icon = {x: r.x + g, y: r.y + g, w: iw, h: ih};
  alpha(c, done ? 1 : 0.35, () => {
    fileShape(c, icon, pal, {stroke: pal.indigo, lw: 1.6});
    drawText(c, '#', midX(icon), icon.y + icon.h * 0.6, {size: Math.min(f.small, iw * 0.55), min: 6, weight: 700, color: pal.indigo, align: 'center', family: FONT.mono});
  });
  const tx = right(icon) + g, tw = right(r) - g - tx;
  const two = r.h >= f.small * 2.6;
  drawText(c, job.output.file, tx, two ? r.y + r.h * 0.34 : midY(r), {size: f.small, weight: 700, color: pal.ink, max: tw});
  if (two) alpha(c, done ? 1 : 0.5, () => drawText(c, fmtBytes(job.output.bytes), tx, r.y + r.h * 0.72, {size: f.tiny, color: pal.muted, max: tw}));
}
function smallLabel(c, L, r, text, pal) {
  const size = Math.min(L.f.tiny, r.h * 0.3);
  drawText(c, text, midX(r), bottom(r) - size * 0.75, {size, min: 7, weight: 700, color: pal.ink, align: 'center', max: r.w - 4});
  return size * 1.5;
}
function drawMemo(c, L, p, job, pal) {
  const r = L.n.memo;
  box(c, r, pal, {dash: p.use > 0 ? 0 : Math.max(3, L.u * 0.25), stroke: p.use > 0 ? pal.ink : pal.rule});
  const lab = smallLabel(c, L, r, 'メモ', pal);
  const area = {x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - lab - 4};
  const s = Math.min(area.w * 0.7, area.h);
  const nb = {x: midX(area) - s * 0.42, y: area.y + (area.h - s) / 2, w: s * 0.84, h: s};
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.2;
  c.strokeRect(nb.x, nb.y, nb.w, nb.h);
  c.fillStyle = pal.ink;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(nb.x, nb.y + nb.h * (0.18 + i * 0.22), Math.max(1, s * 0.04), 0, Math.PI * 2); c.fill(); }
  alpha(c, p.use, () => {
    c.fillStyle = pal.indigo;
    c.fillRect(nb.x + nb.w * 0.18, nb.y + nb.h * 0.2, nb.w * 0.55, Math.max(1.5, nb.h * 0.08));
    c.fillStyle = pal.muted;
    for (let i = 0; i < 3; i++) c.fillRect(nb.x + nb.w * 0.18, nb.y + nb.h * (0.45 + i * 0.17), nb.w * (0.65 - i * 0.12), Math.max(1, nb.h * 0.05));
  });
}
function drawViewer(c, L, p, job, pal) {
  const r = L.n.viewer;
  box(c, r, pal, {dash: p.use > 0 ? 0 : Math.max(3, L.u * 0.25), stroke: p.use > 0 ? pal.ink : pal.rule});
  const lab = smallLabel(c, L, r, '元のページ', pal);
  const area = {x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - lab - 4};
  const h = area.h, w = Math.min(area.w, h * 0.85);
  const pg = {x: midX(area) - w / 2, y: area.y, w, h};
  alpha(c, 0.35 + 0.65 * p.use, () => drawPage(c, L, pg, job, pal, 1, true));
}

// ---- 動く写し（同じ形が経路に沿って進む） ----
function ghostPathA(L, start) {
  // Documentの札 → 設定 → 入口 → 虫めがね
  return [start, ...L.e.docOpts, ...L.e.optsMach.slice(0, 2)];
}
function drawGhosts(c, L, p, d, job, pal) {
  const {n, e, f, u, chips, gap} = L;
  const live = job.live;
  const ctr = (r) => [midX(r), midY(r)];
  // ページ → HTMLファイル：ページの写しが縮んで入る
  if (p.file > 0 && p.file < 1) {
    const k = ease(p.file);
    const icon = {x: n.file.x + gap, y: n.file.y + gap, w: Math.min((n.file.h - gap * 2) * 0.78, n.file.w * 0.22), h: n.file.h - gap * 2};
    alpha(c, 1 - prog(p.file, 0.75, 1) * 0.8, () => drawPage(c, L, lerpRect(n.page, icon, k), job, pal, 1, true));
  }
  // 題名・著者の札：Document → 入口 → 題名・著者の部屋 → 返る値の上段
  ['title', 'author'].forEach((key, i) => {
    const kA = stagger(p.meta, i, 2, 0.3), kB = stagger(p.metaOut, i, 2, 0.3);
    if (kA <= 0 || kB >= 1) return;
    const slot = L.metaSlots[i];
    let rect;
    if (kB <= 0) {
      const path = [...ghostPathA(L, ctr(chips[key])).slice(0, -1), ...e.inMeta, ctr(slot)];
      const pt = pointAt(path, ease(kA));
      const w = lerp(chips[key].w, slot.w, ease(kA)), h = lerp(chips[key].h, slot.h, ease(kA));
      rect = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
    } else {
      const target = {x: n.cardHead.x + gap, y: n.cardHead.y + gap * 0.5 + (n.cardHead.h - gap) / 2 * i, w: n.cardHead.w * 0.5, h: (n.cardHead.h - gap) / 2};
      const path = [ctr(slot), ...e.metaCard, ctr(target)];
      const pt = pointAt(path, ease(kB));
      const w = lerp(slot.w, target.w, ease(kB)), h = lerp(slot.h, target.h, ease(kB));
      rect = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
    }
    metaTag(c, rect, pal, CHIP_LABEL[key], f.tiny);
  });
  // 本文の外の領域：Document → 入口 → 虫めがね → ふるいを抜けて受け皿へ（説明図）
  CLUTTER_KEYS.forEach((key, i) => {
    const k = stagger(p.drop, i, CLUTTER_KEYS.length);
    if (k <= 0 || k >= 1) return;
    const slot = L.traySlots[i];
    const path = [...ghostPathA(L, ctr(chips[key])), [midX(L.glass) + (i - 1.5) * slot.w * 0.6, midY(L.glass)], [midX(slot), L.sieveY], ctr(slot)];
    const pt = pointAt(path, ease(k));
    const w = lerp(chips[key].w, slot.w, ease(k)), h = lerp(chips[key].h, slot.h, ease(k));
    clutterBox(c, {x: pt.x - w / 2, y: pt.y - h / 2, w, h}, pal, u * 0.6, '', f.tiny);
  });
  // 記事の段落：Document → 虫めがねの下に集まる → Markdownの部屋 → 返る値の行
  const blocks = live.blocks, N = blocks.length;
  const rects = rowRects(n.cardBody, blocks, Math.max(2, u * 0.25));
  const gl = L.glass, cols = 2, rowsN = Math.ceil(N / cols);
  const sw = (gl.w * 0.62 - gap) / cols, sh = Math.min((gl.h * 0.8) / rowsN, f.tiny * 1.2);
  const gx0 = midX(gl) - (sw * cols + gap) / 2, gy0 = midY(gl) - (sh * rowsN) / 2;
  const convC = [midX(n.conv), midY(n.conv) + f.small * 0.5];
  blocks.forEach((b, i) => {
    const kA = stagger(p.travelA, i, N), kB = stagger(p.travelB, i, N);
    if (kA <= 0 || kB >= 1) return;
    const slot = {x: gx0 + (i % cols) * (sw + gap), y: gy0 + Math.floor(i / cols) * sh, w: sw, h: sh * 0.86};
    let rect;
    if (kB <= 0) {
      const path = [...ghostPathA(L, ctr(chips.article)), ctr(slot)];
      const pt = pointAt(path, ease(kA));
      const w = lerp(chips.article.w * 0.8, slot.w, ease(kA)), h = lerp(chips.article.h * 0.4, slot.h, ease(kA));
      rect = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
    } else {
      const target = rects[i];
      const path = [ctr(slot), ...e.lensConv, convC, ...e.convCard, ctr(target)];
      const pt = pointAt(path, ease(kB));
      const w = lerp(slot.w, target.w, ease(kB)), h = lerp(slot.h, target.h, ease(kB));
      rect = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
    }
    c.fillStyle = pal.sheet;
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
    c.strokeStyle = pal.indigo;
    c.lineWidth = 1.2;
    c.strokeRect(rect.x, rect.y, rect.w, rect.h);
    blockGlyph(c, b.type, {x: rect.x + 1.5, y: rect.y + rect.h * 0.1, w: rect.w - 3, h: rect.h * 0.8}, pal);
  });
  // 返る値 → .md：content の行がそのまま1つのファイルへ
  if (p.files > 0 && p.files < 1) {
    const k = ease(p.files);
    const icon = {x: n.mdfile.x + gap, y: n.mdfile.y + gap, w: Math.min((n.mdfile.h - gap * 2) * 0.78, n.mdfile.w * 0.24), h: n.mdfile.h - gap * 2};
    const path = [ctr(n.cardBody), ...e.cardCheck, ...e.checkFile, ctr(icon)];
    const pt = pointAt(path, k);
    const w = lerp(n.cardBody.w, icon.w, k), h = lerp(n.cardBody.h, icon.h, k);
    const r = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
    alpha(c, 1 - prog(p.files, 0.8, 1) * 0.7, () => {
      fileShape(c, r, pal, {stroke: pal.indigo, lw: 1.6});
      const rows = rowRects({x: r.x, y: r.y + r.h * 0.12, w: r.w * 0.82, h: r.h * 0.84}, blocks, Math.max(1, r.w * 0.04));
      rows.forEach((rw, i) => blockGlyph(c, blocks[i].type, rw, pal, {ink: pal.indigo}));
    });
  }
  // .md → メモ：同じファイルの写しが貼られる
  if (p.use > 0 && p.use < 0.7) {
    const k = ease(p.use / 0.7);
    const s = Math.min(n.mdfile.h * 0.5, n.memo.w * 0.5);
    const pt = pointAt([[midX(n.memo), midY(n.mdfile)], ...e.fileMemo, ctr(n.memo)], k);
    alpha(c, 1 - k * 0.6, () => fileShape(c, {x: pt.x - s * 0.4, y: pt.y - s / 2, w: s * 0.8, h: s}, pal, {stroke: pal.indigo, lw: 1.4}));
  }
}

export function drawConcept(c, L, p, d, pal, jobId) {
  const job = d.jobs[jobId];
  const {n, e, u} = L;
  const show = (k) => clamp01(val(p.show, k, 1));
  const A = (k) => show(k) * val(p.emph, k, 1);
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  alpha(c, A('machine'), () => drawMachineBody(c, L, p, pal));
  for (const key of ALL_EDGES) {
    const k = val(p.draw, key, 1);
    if (k <= 0.001) continue;
    alpha(c, val(p.emphEdge, EDGE_GROUP[key], 1), () => {
      strokePath(c, e[key], k, {color: pal.ink, width: Math.max(1.8, u * 0.12), head: Math.max(6, u * 0.45)});
      const fl = Math.min(k, val(p.flow, key, 0));
      if (fl > 0) strokePath(c, e[key], fl, {color: META_EDGES.has(key) ? pal.meta : pal.indigo, width: Math.max(3, u * 0.22), head: Math.max(7, u * 0.56)});
    });
  }
  alpha(c, A('page'), () => drawPage(c, L, n.page, job, pal, p.regions, false));
  alpha(c, A('file'), () => drawFileNode(c, L, p, job, pal));
  alpha(c, A('doc'), () => drawDocNode(c, L, p, job, pal));
  alpha(c, A('opts'), () => drawOptsNode(c, L, p, job, pal));
  alpha(c, A('machine'), () => drawChambers(c, L, p, d, job, pal));
  alpha(c, A('card'), () => drawCard(c, L, p, d, job, pal));
  alpha(c, A('check'), () => drawCheckNode(c, L, p, job, pal));
  alpha(c, A('mdfile'), () => drawMdFile(c, L, p, job, pal));
  alpha(c, A('memo'), () => drawMemo(c, L, p, job, pal));
  alpha(c, A('viewer'), () => drawViewer(c, L, p, job, pal));
  drawGhosts(c, L, p, d, job, pal);
  // 動画の最初だけ：機械のふたが上へ開いて、3つの部屋が見える
  if (p.lid > 0.001) {
    alpha(c, show('machine'), () => {
      const m = n.machine, inset = Math.max(2, u * 0.16);
      const h = (m.h - inset * 2) * p.lid;
      rr(c, m.x + inset, m.y + inset, m.w - inset * 2, h, Math.min(u * 0.35, 7));
      c.fillStyle = pal.ink;
      c.fill();
      if (h > L.f.big * 1.6) drawText(c, 'Defuddle', midX(m), m.y + inset + h / 2, {size: L.f.big * 1.4, weight: 700, family: FONT.mincho, color: pal.onInk, align: 'center', max: m.w * 0.8});
    });
  }
  if (p.focusPart && PART_NODES[p.focusPart]) for (const k of PART_NODES[p.focusPart]) focusBox(c, L, n[k], pal);
  c.restore();
}

// ---------- ページ ----------
export function stageNote(d, job, i) {
  const s = job.live.stats;
  const list = `${s.items}項目（${s.ordered ? '番号つき' : '箇条書き'}）`;
  return [
    `渡す：架空の「${job.label}」のHTML（${job.fixture}）を DOMParser で Document にし、URL（${hostPath(job.url)}・取得はしない）と markdown・useAsync:false・removeImages を添えて、同梱の Defuddle に渡します。`,
    `取り出す：Defuddle（full版）が題名と著者を本文と別に返し、本文を選んで外側の領域を除き、Markdownに変換します。このページで返った content は、見出し${s.headings}・段落${s.paragraphs}・リスト${list}。部屋の中の動きは説明図で、内部の記録ではありません。`,
    `使う：作例側で語句を文字どおり照合し、残るべき${job.live.kept.length}語はすべてあり、本文の外の${job.live.removed.length}語はありません。${job.output.file}（${fmtBytes(job.output.bytes)}）は、このページで返った content とバイト単位で同じです。`,
  ][i];
}
export function describeMap(d, job) {
  const s = job.live.stats;
  return `図の内容：架空の「${job.label}」の元のページ（ナビ・広告・記事・関連記事・購読の領域。入力HTMLから描いた図）→ ${job.fixture} → DOMParser の Document（head に題名と著者、body に5つの領域）。`
    + `URL（${hostPath(job.url)}、取得しない）と markdown:true・useAsync:false・removeImages:true を添えて、Defuddle（full版 ${VERSION}）の入口へ。`
    + `中には3つの部屋があります。題名・著者の部屋で「${job.live.title}」「${job.live.author}」が本文と別に分かれ、本文を選ぶ部屋で記事の段落が虫めがねの下に集まり、外側の4つの領域はふるいの下の受け皿へ落ちます（説明図で、内部の記録ではありません）。`
    + `段落はMarkdownの部屋で ## の見出し${s.headings}・段落${s.paragraphs}・リスト${s.items}項目の行になり、題名・著者と一緒に「返る値」になります。`
    + `そのあと作例側で語句を照合（残る${job.live.kept.length}語・入らない${job.live.removed.length}語）し、${job.output.file}（${fmtBytes(job.output.bytes)}）をメモに使い、元のページと見比べます。`;
}

const THEME_KEY = 'studio-yebisu.defuddle-reading-room.theme';
const SPEED = [2.2, 3.4, 2.4];
const tauToTime = (x) => { let t = 0; for (let i = 0; i < 3; i++) t += clamp01(x - i) * SPEED[i]; return t; };
const timeToTau = (t) => { let x = 0; for (let i = 0; i < 3; i++) { if (t <= SPEED[i]) return x + t / SPEED[i]; t -= SPEED[i]; x += 1; } return 3; };

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// 操作中の同期コピーを先に試し、だめなら非同期のクリップボードを使う。どちらも失敗したら false。
async function copyText(text) {
  const tmp = h('textarea', {class: 'offscreen', readonly: true, 'aria-hidden': 'true', tabindex: '-1'});
  tmp.value = text;
  document.body.append(tmp);
  tmp.select();
  tmp.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  tmp.remove();
  if (ok) return true;
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* 下で失敗として伝える */ }
  return false;
}

function applyStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark' || t === 'system') document.documentElement.dataset.theme = t;
  } catch { /* 保存を読めなくても端末の設定で表示する */ }
}

function excerpt(content) {
  const lines = content.split('\n').filter((l) => l.trim());
  let out = '';
  for (const l of lines) {
    if ((out + l).length > 150) break;
    out += (out ? '\n' : '') + l;
  }
  return out || lines[0] || '';
}

function initPage() {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const canvas = $('concept-map');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const statusEl = $('load-status'), retryBtn = $('retry');
  const dynLinks = ['save-md', 'open-desk'].map($);
  const dependents = () => document.querySelectorAll('button[data-stage], #replay, button[data-preset], button[data-part], #copy-request');
  const readouts = ['save-meta', 'stage-note', 'map-desc', 'case-title', 'case-author', 'case-excerpt', 'case-content', 'case-checks', 'case-stats', 'case-compare',
    'part-label', 'part-meaning', 'part-quote', 'part-source', 'part-local', 'copy-status', 'source-lines', 'node-compare', 'vendor-lines'];

  let data = null;
  let caseId = JOB_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'reading';
  let stage = 2, tau = 0, raf = 0, part = null, loadGen = 0, controller = null;

  // 表示の色（このページだけの保存先）
  const themeButtons = document.querySelectorAll('button[data-theme-choice]');
  const theme = () => root.dataset.theme || 'system';
  const resolved = () => (theme() === 'system' ? (darkMq.matches ? 'dark' : 'light') : theme());
  function setTheme(t, save) {
    root.dataset.theme = t;
    themeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === t)));
    if (save) { try { localStorage.setItem(THEME_KEY, t); } catch { /* 保存できなくても表示は切り替える */ } }
    draw();
  }
  themeButtons.forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themeChoice, true)));
  darkMq.addEventListener?.('change', () => { if (theme() === 'system') draw(); });

  // 図
  function draw() {
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const pal = PALETTES[resolved()];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (!data) {
      const msg = root.dataset.state === 'error' ? '照合できなかったため、図を止めました' : '素材を照合し、Defuddleを準備しています…';
      drawText(ctx, msg, W / 2, H / 2, {size: 15, color: pal.muted, align: 'center', max: W - 24});
      ctx.restore();
      return;
    }
    const L = conceptLayout(chooseKind(W, H), W, H);
    const p = storyParams(tau);
    p.focusPart = part;
    drawConcept(ctx, L, p, data, pal, caseId);
    ctx.restore();
  }
  new ResizeObserver(() => draw()).observe(canvas);

  function stopAnim() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function animate(from, to) {
    stopAnim();
    if (reduce.matches || from === to) { tau = to; draw(); return; }
    const t0 = tauToTime(from), t1 = tauToTime(to), dur = Math.abs(t1 - t0) * 1000;
    const start = performance.now();
    tau = from;
    const tick = (now) => {
      const k = clamp01((now - start) / dur);
      tau = timeToTau(t0 + (t1 - t0) * k);
      draw();
      raf = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    raf = requestAnimationFrame(tick);
  }
  reduce.addEventListener?.('change', () => { if (reduce.matches && raf) { stopAnim(); tau = stage + 1; draw(); } });
  function setStage(i, replay) {
    stage = i;
    document.querySelectorAll('button[data-stage]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === i)));
    $('stage-note').textContent = data ? stageNote(data, data.jobs[caseId], stage) : '';
    const target = i + 1;
    animate(replay || target < tau ? i : tau, target);
  }
  document.querySelectorAll('button[data-stage]').forEach((b) => b.addEventListener('click', () => { if (data) setStage(Number(b.dataset.stage), false); }));
  $('replay').addEventListener('click', () => { if (data) setStage(stage, true); });

  // 3件：保存リンク・元のページ・読み出しを、選んだ件にそろえる。切り替えでは取り出し直さない（読み込み時の結果を使う）。
  function renderCase() {
    const job = data.jobs[caseId], live = job.live, s = live.stats;
    document.querySelectorAll('button[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === caseId)));
    const save = $('save-md');
    save.href = job.output.url;
    save.setAttribute('download', job.output.download);
    $('open-desk').href = `desk.html#${caseId}`;
    for (const a of dynLinks) a.removeAttribute('aria-disabled');
    $('save-meta').textContent = `${job.output.path}・${fmtBytes(job.output.bytes)}・SHA-256 ${job.output.sha256.slice(0, 12)}…　このページで返った content とバイト単位で同じ`;
    $('stage-note').textContent = stageNote(data, job, stage);
    $('map-desc').textContent = describeMap(data, job);
    $('case-title').textContent = live.title;
    $('case-author').textContent = live.author;
    $('case-excerpt').textContent = excerpt(live.content);
    $('case-content').textContent = live.content;
    $('case-stats').replaceChildren(
      h('div', {}, h('dt', {}, '見出し（##）'), h('dd', {}, `${s.headings}`)),
      h('div', {}, h('dt', {}, '段落'), h('dd', {}, `${s.paragraphs}`)),
      h('div', {}, h('dt', {}, s.ordered ? 'リスト（1. 2. 3.）' : 'リスト（-）'), h('dd', {}, `${s.items}項目`)),
      h('div', {}, h('dt', {}, '文字数'), h('dd', {}, `${s.chars.toLocaleString('en-US')}字`)),
      h('div', {}, h('dt', {}, 'UTF-8'), h('dd', {}, fmtBytes(s.bytes))));
    $('case-checks').replaceChildren(
      ...live.kept.map((k) => h('li', {class: 'is-kept'}, h('span', {class: 'phrase'}, `「${k.text}」`), h('span', {class: 'verdict'}, k.ok ? '残っている' : '見つからない'))),
      ...live.removed.map((k) => h('li', {class: 'is-removed'}, h('span', {class: 'phrase'}, `「${k.text}」`), h('span', {class: 'verdict'}, k.ok ? '含まれない' : '含まれている'))));
    $('case-compare').textContent = `保存済みのNode出力（extraction-results.json、元の制作で jsdom を使って実行）と比べて：title 一致・author 一致・content 全文一致。${job.output.path} ともバイト単位で一致。`;
    $('copy-status').textContent = '';
  }
  function selectCase(id, push) {
    if (!data || !JOB_IDS.includes(id)) return;
    caseId = id;
    if (push && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    renderCase();
    draw();
  }
  document.querySelectorAll('button[data-preset]').forEach((b) => b.addEventListener('click', () => selectCase(b.dataset.preset, true)));
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (data && JOB_IDS.includes(id) && id !== caseId) selectCase(id, false);
  });

  // 6つの部分
  function renderPart() {
    const x = data && part ? data.parts.find((y) => y.id === part) : null;
    $('part-label').textContent = x ? x.label : '';
    $('part-meaning').textContent = x ? x.meaning : '';
    $('part-quote').textContent = x ? x.quote : '';
    $('part-source').replaceChildren(...(x ? [h('a', {href: x.lineUrl, rel: 'noopener'}, `GitHub の固定版 ${x.shortPath} の${x.line_start}行目`)] : []));
    $('part-local').replaceChildren(...(x ? [h('a', {href: x.url}, `同梱の ${x.source_path}`), `（${x.line_start}行目）`] : []));
  }
  document.querySelectorAll('button[data-part]').forEach((b) => b.addEventListener('click', () => {
    if (!data) return;
    part = part === b.dataset.part ? null : b.dataset.part;
    document.querySelectorAll('button[data-part]').forEach((y) => y.setAttribute('aria-pressed', String(y.dataset.part === part)));
    renderPart();
    draw();
  }));

  // 固定の記録：原典の行・Node出力との比較・配布ファイルの改行
  function renderFixed() {
    document.querySelectorAll('button[data-part]').forEach((b) => {
      const x = data.parts.find((y) => y.id === b.dataset.part);
      if (x) b.textContent = x.label;
    });
    $('source-lines').replaceChildren(...data.sourceLines.map((s) => h('li', {},
      h('span', {class: 'src-note'}, s.note),
      h('code', {class: 'src-code'}, s.code),
      h('span', {class: 'src-links'}, h('a', {href: s.lineUrl, rel: 'noopener'}, `${s.shortPath} の${s.line}行目（GitHub）`), h('a', {href: s.url}, '同梱のファイル')))));
    $('node-compare').replaceChildren(...JOB_IDS.map((id) => {
      const j = data.jobs[id];
      return h('li', {}, h('b', {}, `${j.preset}（${j.label}）`),
        `　title「${j.live.title}」・author「${j.live.author}」・content ${fmtBytes(j.live.stats.bytes)}：保存済みのNode出力と一致。入力 ${j.fixture}（${fmtBytes(j.fixtureBytes)}${j.fixtureCrlf ? '・改行CRLF' : ''}）は samples.json の入力と${j.fixtureCrlf ? '改行だけそろえて' : ''}同じ。`);
    }));
    $('vendor-lines').replaceChildren(
      h('li', {}, `元の配布のまま改行CRLF：${data.vendor.crlf.join('・')}。公式のGitのファイルは改行LFなので生のバイトは違い、改行をそろえると中身が一致します。`),
      h('li', {}, `公式と同じ改行LF：${data.vendor.lf.join('・')}（固定コミットのソースの一部）。`),
      h('li', {}, `defuddle.full.js（${fmtBytes(data.vendor.bundleBytes)}）は元の制作でこの固定ソースからビルドした生成物です。原典の生のファイルではなく、今回ビルドし直してもいません。読み込みは ${BUNDLE_SRI} の照合つき。`));
  }

  // 依頼文のコピー（失敗したら読み取り専用の欄を選んだ状態にして伝える）
  $('copy-request').addEventListener('click', async () => {
    if (!data) return;
    const ok = await copyText(data.request);
    if (!data) return;
    const out = $('copy-status'), area = $('request-text');
    if (ok) { out.textContent = 'request.txt の依頼文をコピーしました。貼り付け先で確かめてください。'; return; }
    out.textContent = 'コピーできませんでした。依頼文の欄を選んだ状態にしたので、端末の操作でコピーしてください。';
    area.closest('details')?.setAttribute('open', '');
    area.focus();
    area.select();
  });

  // 読み込みと失敗
  function setDependents(on) {
    dependents().forEach((el) => { el.disabled = !on; });
    if (!on) for (const a of dynLinks) { a.removeAttribute('href'); a.removeAttribute('download'); a.setAttribute('aria-disabled', 'true'); }
  }
  function clearReadouts() {
    for (const id of readouts) $(id).replaceChildren();
    $('request-text').value = '';
    part = null;
    document.querySelectorAll('button[data-part], button[data-preset]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  }
  function setStatus(text, state) {
    statusEl.textContent = text;
    statusEl.dataset.state = state;
    statusEl.setAttribute('role', state === 'error' ? 'alert' : 'status');
  }
  async function load() {
    const gen = ++loadGen;
    controller?.abort();
    controller = new AbortController();
    stopAnim();
    data = null;
    root.dataset.state = 'loading';
    retryBtn.hidden = true;
    setDependents(false);
    clearReadouts();
    draw();
    setStatus(`素材${ASSET_COUNT}件を照合しています…`, 'loading');
    try {
      const bundle = await loadValidatedAssets({
        signal: controller.signal,
        onProgress: (phase, done, total) => {
          if (gen !== loadGen || root.dataset.state !== 'loading') return;
          setStatus(phase === 'assets' ? `素材 ${done}/${total} を照合しています…` : `同梱の Defuddle で${total}件を取り出しています…`, 'loading');
        },
      });
      if (gen !== loadGen) return;
      data = bundle;
      root.dataset.state = 'ready';
      setStatus(`素材${ASSET_COUNT}件を照合し、同梱の Defuddle ${VERSION} をこのブラウザーで3件実行しました。返った title・author・content は保存済みの出力と全文一致しています。`, 'ready');
      setDependents(true);
      $('request-text').value = data.request;
      renderFixed();
      renderPart();
      renderCase();
      tau = 0;
      setStage(2, false);
    } catch (error) {
      if (gen !== loadGen || error?.name === 'AbortError') return;
      stopAnim();
      data = null;
      root.dataset.state = 'error';
      setDependents(false);
      clearReadouts();
      draw();
      const why = error instanceof AssetError ? error.message : '素材を読めませんでした';
      setStatus(`${why}。図と読み出しを止めました。ファイルを直接開いた場合は、ローカルのHTTPサーバー経由で開き直してください。`, 'error');
      retryBtn.hidden = false;
    }
  }
  retryBtn.addEventListener('click', () => load());
  setTheme(theme(), false);
  load();
}

if (typeof document !== 'undefined' && document.documentElement.dataset.page === 'defuddle-concept') {
  applyStoredTheme();
  initPage();
}
