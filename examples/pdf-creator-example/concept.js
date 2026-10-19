/*
 * PDF Creator 作例：概念図の共有モジュール
 *   loadVerified() 固定SHA-256の concept/manifest.json と記録された23ファイルを照合して読み込む
 *   drawFrame()    手順書・作者AI・制作担当・変換・PDF・読み比べ・使う、を1枚の図で描く（時刻tだけで決まる）
 *   initMain()     作例ページ（index.html）の操作。video/ の編集画面からは呼ばない
 * 読み込みだけでは何も起動しない。PDFは生成せず、保存済みの原本を照合して扱う。
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 */

export const MANIFEST_SHA256 = 'ce604633be16bcee326e7ff6713d85e428d4bf97dd06cc2ceeb23ce48d597f99';
export const ROOT = new URL('./', import.meta.url);
export const DURATION = 32;

export const SCENES = Object.freeze([
  { id: 'contents', start: 0, title: 'AIが読む手順書と、日本語の原稿', sub: '手順書＝版の選び方・5テーマ・変換スクリプト・全ページ確認' },
  { id: 'author', start: 4, title: '同じ作者AIが読み、制作担当が別工程で実行', sub: '作者AIは原稿・版の選択・和文CSSを用意（シェルは実行していない）' },
  { id: 'convert', start: 8, title: '原典の変換：HTML → CSS → Chrome', sub: "markdown_to_pdf(theme=…, backend='chrome')" },
  { id: 'wrap', start: 14, title: '同じ原稿が、版の枠で折り返す', sub: 'A4は1ページ、148×210mmは2ページ（生成後の実測）' },
  { id: 'inspect', start: 20, title: 'ページ画像にして、原稿と読み比べる', sub: 'lint警告はエラーではない・表がないため罫線検査は対象外' },
  { id: 'use', start: 26, title: '保存済みの原PDFと原稿を使う', sub: 'この図はPDFを再生成しない・A4で配る／細いページで読む' },
  { id: 'map', start: 29, title: '手順書 → 作者AI → 制作担当 → 変換 → PDF → 読み比べ → 使う', sub: '全体図・無音・保存済みの原制作から作図' },
].map(Object.freeze));

export const PART_IDS = Object.freeze(['instructions', 'theme', 'convert', 'backend', 'preview', 'review']);

const COMMIT = 'e37b50c323cf99471f18ac17a11c923bb96ce2ba';
const UPSTREAM = 'vendor/pdf-creator/daymade-docs/pdf-creator/';
const SKILL = UPSTREAM + 'SKILL.md';
const CONVERTER = UPSTREAM + 'scripts/md_to_pdf.py';
const EXPECTED_FILES = Object.freeze([
  'concept/structure.json', 'concept/original-run.json', 'input.md', 'request.txt',
  'inputs/event.json', 'inputs/event.md', 'outputs/manifest.json', 'validation.json',
  'build_pdfs.py', 'themes/japanese-a4.css', 'themes/japanese-phone.css',
  SKILL, CONVERTER, UPSTREAM + 'themes/warm-terra.css', UPSTREAM + 'themes/mobile.css',
  'vendor/pdf-creator/LICENSE', 'FONT-OFL.txt', 'samples.json',
  'assets/paper-page-1.png', 'assets/phone-page-1.png', 'assets/phone-page-2.png',
  'outputs/atelier-a4.pdf', 'outputs/atelier-phone.pdf',
]);
const PINNED = Object.freeze({
  paper: Object.freeze({ file: 'outputs/atelier-a4.pdf', name: 'atelier-a4.pdf', bytes: 63663, pages: 1, size: [210, 297], theme: 'warm-terra', override: 'themes/japanese-a4.css', short: 'A4' }),
  phone: Object.freeze({ file: 'outputs/atelier-phone.pdf', name: 'atelier-phone.pdf', bytes: 64484, pages: 2, size: [148, 210], theme: 'mobile', override: 'themes/japanese-phone.css', short: '細' }),
});
const BLOCK_COUNT = 29;
const NOTICE_LINE = '**ご注意：これは架空のイベントです。参加の申し込みはできません。**';
const HEX64 = /^[0-9a-f]{64}$/;

export class LoadError extends Error {}
const fail = message => { throw new LoadError(message); };
const check = (condition, message) => { if (!condition) fail(message); };
export const formatBytes = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/* ---------------------------------------------------------------- 読み込みと照合 */

async function fetchBytes(path) {
  let response;
  try {
    response = await fetch(new URL(path, ROOT), { cache: 'no-store' });
  } catch {
    fail(`${path} を読み込めません。file:// ではなく、作例フォルダーをHTTPで配信して開いてください。`);
  }
  if (!response.ok) fail(`${path} の読み込みに失敗しました（HTTP ${response.status}）。`);
  return new Uint8Array(await response.arrayBuffer());
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function decode(bytes, path) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail(`${path} がUTF-8の文字として読めません。`);
  }
}

function parseJson(bytes, path) {
  const source = decode(bytes, path);
  try {
    return JSON.parse(source);
  } catch {
    fail(`${path} がJSONとして読めません。`);
  }
}

const splitLines = text => text.split(/\r?\n/);

function pngSize(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b)) return null;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function latin1(bytes) {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

function checkManifest(manifest) {
  check(manifest && manifest.id === 'pdf-creator-example' && manifest.revision === 'visual-r1' && Array.isArray(manifest.files),
    'concept/manifest.json の形が想定と違います（id・revision・files）。');
  check(manifest.files.length === EXPECTED_FILES.length,
    `concept/manifest.json の記録が${EXPECTED_FILES.length}件ではありません（${manifest.files.length}件）。`);
  const seen = new Set();
  for (const file of manifest.files) {
    check(file && typeof file.path === 'string' && Number.isInteger(file.bytes) && file.bytes > 0 && typeof file.sha256 === 'string' && HEX64.test(file.sha256),
      'concept/manifest.json に形の違う項目があります（path・bytes・sha256）。');
    check(EXPECTED_FILES.includes(file.path), `想定していないファイル ${file.path} が記録されています。`);
    check(!seen.has(file.path), `${file.path} が二重に記録されています。`);
    seen.add(file.path);
  }
}

/** 原稿の各行を、PDFの本文ブロックと同じ単位（29件）に分ける。 */
export function parseBlocks(markdown) {
  const strip = s => s.replace(/\*\*/g, '');
  const blocks = [];
  for (const raw of splitLines(markdown)) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) blocks.push({ kind: m[1].length === 1 ? 'h1' : 'h2', text: m[2] });
    else if ((m = line.match(/^(\d+)\.\s+(.*)$/))) blocks.push({ kind: 'ol', n: Number(m[1]), text: strip(m[2]) });
    else if ((m = line.match(/^[-*+]\s+(.*)$/))) blocks.push({ kind: 'li', text: strip(m[1]), optional: m[1].includes('（任意）') });
    else if (/^\*\*.+\*\*$/.test(line)) blocks.push({ kind: 'notice', text: strip(line) });
    else blocks.push({ kind: 'p', text: line });
  }
  return blocks.map((block, index) => Object.freeze({ ...block, index }));
}

const variantKey = v => JSON.stringify([v.id, v.label, v.file, v.theme, v.size_mm, v.page_count, v.pdf_sha256, v.bytes,
  (v.pages || []).map(p => [p.number, p.image, p.width, p.height, p.sha256])]);

/**
 * 固定SHA-256の記録から23ファイルを読み、長さ・SHA-256・相互の記録・PDFとPNGの中身を照合する。
 * どれか1つでも合わなければ日本語の理由つきで失敗する（部分的な結果は返さない）。
 */
export async function loadVerified(onProgress) {
  const progress = typeof onProgress === 'function' ? onProgress : () => {};
  check(globalThis.crypto && crypto.subtle, 'この表示環境ではWebCryptoのSHA-256が使えません。HTTPS、または127.0.0.1のHTTPで開いてください。');
  check(typeof createImageBitmap === 'function', 'このブラウザーはページ画像の検証（createImageBitmap）に対応していません。');
  const manifestBytes = await fetchBytes('concept/manifest.json');
  check(await sha256Hex(manifestBytes) === MANIFEST_SHA256,
    'concept/manifest.json が固定したSHA-256と一致しません。記録の取り違えか改変の可能性があります。');
  const manifest = parseJson(manifestBytes, 'concept/manifest.json');
  checkManifest(manifest);
  const bytes = new Map();
  let done = 0;
  progress(0, manifest.files.length);
  await Promise.all(manifest.files.map(async file => {
    const data = await fetchBytes(file.path);
    check(data.byteLength === file.bytes, `${file.path} の長さが記録と違います（${formatBytes(data.byteLength)}／記録 ${formatBytes(file.bytes)} バイト）。`);
    check(await sha256Hex(data) === file.sha256, `${file.path} のSHA-256が記録と一致しません。`);
    bytes.set(file.path, data);
    progress(++done, manifest.files.length);
  }));
  return buildModel(manifest, bytes);
}

async function buildModel(manifest, bytes) {
  const entry = path => manifest.files.find(f => f.path === path);
  const text = path => decode(bytes.get(path), path);
  const json = path => parseJson(bytes.get(path), path);
  const structure = json('concept/structure.json');
  const run = json('concept/original-run.json');
  const outputs = json('outputs/manifest.json');
  const samples = json('samples.json');
  const validation = json('validation.json');
  const event = json('inputs/event.json');
  const markdown = text('inputs/event.md');
  const request = text('request.txt');
  const skillLines = splitLines(text(SKILL));
  const converterLines = splitLines(text(CONVERTER));
  const markdownSha = entry('inputs/event.md').sha256;

  // 構造の記録：固定コミット・6部品・引用行
  check(structure && structure.id === 'pdf-creator-example' && structure.source_commit === COMMIT,
    'concept/structure.json の作例IDか固定コミットが違います。');
  check(Array.isArray(structure.parts) && structure.parts.map(p => p && p.id).join() === PART_IDS.join(),
    'concept/structure.json に6つの部品（instructions〜review）が順に揃っていません。');
  for (const part of structure.parts) {
    check(['label', 'meaning', 'quote', 'source_path', 'upstream_path', 'source_url'].every(k => typeof part[k] === 'string' && part[k]) && Number.isInteger(part.line_start) && part.line_start > 0,
      `部品 ${part.id} の記録が不足しています。`);
    const source = part.source_path === SKILL ? skillLines : part.source_path === CONVERTER ? converterLines : null;
    check(source, `部品 ${part.id} の出典 ${part.source_path} は照合済みのファイルではありません。`);
    check(source[part.line_start - 1] === part.quote, `部品 ${part.id} の引用が ${part.source_path} の${part.line_start}行目にありません。`);
    check(part.source_path === 'vendor/pdf-creator/' + part.upstream_path &&
      part.source_url === `https://github.com/daymade/claude-code-skills/blob/${COMMIT}/${part.upstream_path}#L${part.line_start}`,
      `部品 ${part.id} の原典URLが固定コミットの該当行を指していません。`);
  }

  // 原稿：共通のSHA-256・架空の注意・流れ6件・持ち物3件（任意1件）・表なし
  check(structure.input && structure.input.file === 'inputs/event.md' && structure.input.sha256 === markdownSha && structure.input.tables === false,
    'concept/structure.json の原稿の記録が inputs/event.md と一致しません。');
  const lines = splitLines(markdown).map(l => l.trim());
  check(typeof event.notice === 'string' && markdown.includes(event.notice) && lines.includes(NOTICE_LINE),
    'inputs/event.md に固定の「架空の案内」の注意書きが原本どおりにありません。');
  check(Array.isArray(event.schedule) && event.schedule.length === 6, 'inputs/event.json の当日の流れが6件ではありません。');
  event.schedule.forEach((item, i) => check(lines.includes(`${i + 1}. **${item.time}** ${item.activity}`),
    `inputs/event.md に流れの${i + 1}番（${item.time}）が原本どおりにありません。`));
  check(Array.isArray(event.items) && event.items.length === 3, 'inputs/event.json の持ち物が3件ではありません。');
  event.items.forEach(item => check(lines.includes(`- ${item}`), `inputs/event.md に持ち物「${item}」がありません。`));
  check(event.items.filter(item => item.includes('（任意）')).length === 1 && event.items[2].includes('（任意）'),
    '任意の持ち物（3つ目）の記録が原稿と違います。');
  check(event.capacity === 12 && lines.includes(`- **定員**：${event.capacity}名`) && lines.includes(`- **日付**：${event.date}`),
    '日付か定員（12名）が inputs/event.json と inputs/event.md で一致しません。');
  check(!lines.some(l => l.startsWith('|')), '原稿に表が含まれています。この作例は表なしの記録です。');
  const blocks = parseBlocks(markdown);
  check(blocks.length === BLOCK_COUNT && structure.input.text_blocks_per_pdf === BLOCK_COUNT,
    `原稿の本文ブロックが${BLOCK_COUNT}件ではありません（${blocks.length}件）。`);
  const split = blocks.findIndex(b => b.kind === 'ol' && b.n === 4);
  check(split > 0, '原稿に流れの4番が見つかりません。');

  // 2つの版：structure・outputs・samples・validation・元の生成記録・実ファイル
  check(Array.isArray(structure.variants) && structure.variants.map(v => v.id).join() === 'paper,phone',
    'concept/structure.json の版が paper・phone の2つではありません。');
  check(outputs.generated === true && outputs.source === 'inputs/event.md' && outputs.source_sha256 === markdownSha && outputs.backend === 'chrome' && Array.isArray(outputs.variants),
    'outputs/manifest.json の原稿かバックエンド（chrome）が記録と違います。');
  check(samples.format === 'input-output' && Array.isArray(samples.samples) && samples.samples.map(s => s.id).join() === 'paper,phone',
    'samples.json の2件（paper・phone）が揃っていません。');
  check(validation.source_sha256 === markdownSha && validation.backend === 'chrome' && validation.human_approval === false &&
    validation.markdown_blocks_checked && validation.markdown_blocks_checked.paper === BLOCK_COUNT && validation.markdown_blocks_checked.phone === BLOCK_COUNT &&
    typeof validation.tables === 'string' && Array.isArray(validation.variants),
    'validation.json の原稿・バックエンド・29ブロックの照合記録が違います。');
  const model = run && run.model;
  check(model && model.requested === 'claude-opus-5-5' && Array.isArray(model.reported) && model.reported.length > 0 && model.reported.every(m => m === 'claude-opus-5-5'),
    'concept/original-run.json の制作モデルが claude-opus-5-5 として記録されていません。');
  check(Array.isArray(model.receipts) && model.receipts.map(r => r.phase).join() === 'implement,video' &&
    model.receipts.every(r => HEX64.test(r.receipt_sha256) && HEX64.test(r.execution_sha256) && HEX64.test(r.prompt_sha256)),
    '元のモデル実行の受領記録2件（implement・video）が揃っていません。');
  const build = run.pdf_build;
  check(build && build.backend === 'chrome' && build.source_sha256 === markdownSha && build.upstream_converter_sha256 === entry(CONVERTER).sha256 && Array.isArray(build.variants),
    '元のPDF生成記録の原稿・変換スクリプト・バックエンドが一致しません。');

  const variants = {};
  let totalPages = 0;
  for (const v of structure.variants) {
    const pin = PINNED[v.id];
    check(v.file === pin.file && v.bytes === pin.bytes && v.page_count === pin.pages && JSON.stringify(v.size_mm) === JSON.stringify(pin.size),
      `${v.id} の版（ファイル・バイト数・ページ数・寸法）が固定した記録と違います。`);
    const out = outputs.variants.find(o => o.id === v.id);
    check(out && variantKey(out) === variantKey(v), `${v.id} の版の記録が concept/structure.json と outputs/manifest.json で違います。`);
    const fileEntry = entry(v.file);
    check(fileEntry && fileEntry.bytes === v.bytes && fileEntry.sha256 === v.pdf_sha256, `${v.file} の長さかSHA-256が版の記録と違います。`);
    const sample = samples.samples.find(s => s.id === v.id);
    check(sample.actual_pdf === v.file && sample.pdf_sha256 === v.pdf_sha256 && sample.actual_page_count === v.page_count && sample.source_sha256 === markdownSha,
      `samples.json の ${v.id} が版の記録と違います。`);
    const checked = validation.variants.find(x => x.id === v.id);
    check(checked && checked.page_count === v.page_count && checked.pdf_sha256 === v.pdf_sha256 && JSON.stringify(checked.size_mm) === JSON.stringify(v.size_mm) && checked.text_facts_match === true,
      `validation.json の ${v.id} が版の記録と違います。`);
    const built = build.variants.find(x => x.id === v.id);
    check(built && built.backend === 'chrome' && built.base_theme === pin.theme && built.override === pin.override && built.bytes === v.bytes && built.pdf_sha256 === v.pdf_sha256 &&
      built.upstream_api_executed === true && built.override_sha256 === (entry(pin.override) || {}).sha256,
      `元の生成記録の ${v.id}（テーマ・追加CSS・バイト数・SHA-256）が一致しません。`);
    const pdf = bytes.get(v.file);
    check(latin1(pdf.subarray(0, 5)) === '%PDF-', `${v.file} が %PDF- で始まっていません。`);
    check(latin1(pdf.subarray(Math.max(0, pdf.length - 64))).trimEnd().endsWith('%%EOF'), `${v.file} が %%EOF で終わっていません。`);
    check(Array.isArray(v.pages) && v.pages.length === v.page_count, `${v.id} のページ画像の数がページ数と違います。`);
    const pages = [];
    for (const page of v.pages) {
      const pageEntry = entry(page.image);
      check(pageEntry && pageEntry.sha256 === page.sha256, `${page.image} のSHA-256が版の記録と違います。`);
      const data = bytes.get(page.image);
      const size = pngSize(data);
      check(size && size.width === page.width && size.height === page.height, `${page.image} の寸法が記録（${page.width}×${page.height}）と違います。`);
      let bitmap;
      try {
        bitmap = await createImageBitmap(new Blob([data], { type: 'image/png' }));
      } catch {
        fail(`${page.image} を画像としてデコードできません。`);
      }
      check(bitmap.width === page.width && bitmap.height === page.height, `${page.image} のデコード後の寸法が記録と違います。`);
      pages.push(Object.freeze({ ...page, bitmap, bytes: data }));
    }
    totalPages += pages.length;
    variants[v.id] = Object.freeze({ ...v, pin, pages: Object.freeze(pages), pdf, name: pin.name });
  }
  check(validation.visual_review && validation.visual_review.all_pages === totalPages && totalPages === 3,
    '全ページの確認記録が3ページと一致しません。');

  return Object.freeze({
    manifest, structure, run, outputs, samples, validation, event, markdown, request, blocks: Object.freeze(blocks), split,
    variants: Object.freeze(variants), markdownSha, commit: COMMIT, totalPages,
  });
}

/* ---------------------------------------------------------------- 配色と配置 */

export const FILM_PALETTE = Object.freeze({
  bg: '#f4eee3', card: '#fffaf2', card2: '#ece3d4', ink: '#1f1a15', muted: '#6b5f53', line: '#cbbca9', edge: '#4a4037',
  accent: '#b5532e', accentSoft: '#f3dccd', blue: '#2d5b7a', blueSoft: '#dde8ef', green: '#3b6a4b', greenSoft: '#dfeadf',
  chip: '#efe6d8', onBlue: '#ffffff',
});
// 原稿とPDFのページは、どちらの配色でも紙の色で描く（同じ紙の見え方を保つ）
const SHEET = Object.freeze({ paper: '#fffdf8', line: '#d6c8b5', shadow: 'rgba(60,40,20,0.16)', ink: '#2a221b', body: '#8c7e6f', muted: '#c4b7a7', accent: '#c0603a', accentSoft: '#f4dccd' });

/** 作例ページのCSS変数から図の配色を読む（明暗の設定に合わせる）。 */
export function paletteFrom(element) {
  const style = getComputedStyle(element);
  const out = {};
  for (const [key, fallback] of Object.entries(FILM_PALETTE)) {
    const name = '--map-' + key.replace(/[A-Z0-9]/g, c => '-' + c.toLowerCase());
    out[key] = style.getPropertyValue(name).trim() || fallback;
  }
  return Object.freeze(out);
}

const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",system-ui,sans-serif';
const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",serif';
const R = (x, y, w, h) => Object.freeze({ x, y, w, h });

// 3つの配置：横長の映像と広い画面（wide）、縦長の映像（tall）、スマートフォンの作例ページ（compact）。
// どれも同じ部品と矢印を持ち、線が交差しないように経路を決めてある。
const LAYOUTS = {
  wide: {
    W: 1280, H: 720, full: true, header: { x: 36, title: 40, sub: 64, right: 1244 }, token: [38, 52],
    n: {
      book: R(36, 84, 240, 262), src: R(36, 372, 240, 300), ai: R(312, 280, 164, 170), asks: R(316, 462, 160, 54),
      op: R(508, 84, 248, 588), conv: R(520, 236, 224, 424),
      s1: R(532, 280, 200, 84), s2: R(532, 384, 200, 156), s3: R(532, 560, 200, 84),
      a4: R(800, 84, 144, 204), ph1: R(784, 534, 96, 136), ph2: R(888, 534, 96, 136),
      png: R(1008, 84, 236, 180), rev: R(1008, 300, 236, 170), use: R(1008, 506, 236, 166),
    },
    e: {
      e1: [[276, 215], [394, 215], [394, 280]],
      e2: [[276, 522], [300, 522], [300, 420], [312, 420]],
      e2b: [[396, 462], [396, 450]],
      e3: [[476, 322], [532, 322]],
      e4: [[632, 364], [632, 384]],
      e5: [[632, 540], [632, 560]],
      e6: [[732, 602], [770, 602], [770, 186], [800, 186]],
      e7: [[732, 602], [784, 602]],
      e8: [[944, 174], [1008, 174]],
      e9: [[984, 602], [996, 602], [996, 240], [1008, 240]],
      e10: [[1126, 264], [1126, 300]],
      e11: [[156, 672], [156, 698], [1258, 698], [1258, 385], [1244, 385]],
      e12: [[1126, 470], [1126, 506]],
    },
    c: {
      book: { title: [58, 112], sub: [58, 132], rows: { x: 50, y: 146, h: 48.5 } },
      src: { title: [50, 398], sheet: R(50, 412, 120, 246), call: { x: 184, y: 432, step: 24 } },
      ai: { title: [328, 308], sub: [328, 328], badge: [456, 300], chips: { x: 328, y: 342, w: 132, h: 24, gap: 4, dir: 'v' }, note: [328, 440] },
      asks: { x: 316, y: 462, w: 76, h: 24, gap: 8 },
      op: { tab: R(508, 84, 74, 26), title: [592, 103], sub: [520, 128], chips: { x: 520, y: 144, w: 108, h: 26, cols: 2, gap: 8 } },
      conv: { badge: [542, 258], head: [556, 263] },
      s1: { title: [546, 306], sub: [546, 328] }, s2: { badge: [552, 402], title: [566, 407], strips: { x: 544, y: 416, w: 134, h: 24, gap: 6 } }, s3: { title: [546, 586], sub: [546, 608] },
      frames: { a4: [872, 314, 'center'], ph: [884, 500, 'center'], note: [884, 420, 'center'] },
      png: { title: [1022, 108], count: [1206, 160], thumbs: { x: 1022, y: 118, h: 70, gap: 10 }, chips: [R(1020, 198, 212, 26), R(1020, 230, 212, 26)] },
      rev: { badge: [1030, 326], title: [1046, 331], rows: { x: 1024, y: 362, step: 26 }, foot: [1024, 456] },
      use: { title: [1022, 532], files: [R(1020, 544, 104, 44), R(1132, 544, 104, 44)], rows: [1022, 612], foot: [1022, 640], note: [1022, 662] },
      e11: [640, 691],
    },
  },
  tall: {
    W: 720, H: 1280, full: true, header: { x: 28, kicker: 30, title: 62, sub: 86 }, token: [38, 52],
    n: {
      book: R(28, 104, 320, 232), src: R(372, 104, 320, 232), ai: R(28, 360, 240, 128), asks: R(296, 380, 224, 54),
      op: R(20, 508, 680, 292), conv: R(36, 584, 648, 204),
      s1: R(52, 624, 180, 148), s2: R(252, 624, 216, 148), s3: R(488, 624, 180, 148),
      a4: R(52, 836, 132, 187), ph1: R(232, 846, 112, 159), ph2: R(356, 846, 112, 159),
      png: R(28, 1040, 664, 92), rev: R(28, 1150, 324, 118), use: R(368, 1150, 324, 118),
    },
    e: {
      e1: [[148, 336], [148, 360]],
      e2: [[532, 336], [532, 456], [268, 456]],
      e2b: [[296, 407], [268, 407]],
      e3: [[148, 488], [148, 624]],
      e4: [[232, 698], [252, 698]],
      e5: [[468, 698], [488, 698]],
      e6: [[578, 772], [578, 816], [118, 816], [118, 836]],
      e7: [[288, 816], [288, 846]],
      e8: [[118, 1023], [118, 1040]],
      e9: [[288, 1005], [288, 1040]],
      e10: [[190, 1132], [190, 1150]],
      e11: [[692, 220], [708, 220], [708, 1141], [300, 1141], [300, 1150]],
      e12: [[352, 1209], [368, 1209]],
    },
    c: {
      book: { title: [50, 132], sub: [50, 152], rows: { x: 42, y: 166, h: 41 } },
      src: { title: [386, 130], sheet: R(386, 142, 140, 180), call: { x: 540, y: 162, step: 22 } },
      ai: { title: [44, 388], sub: [44, 408], badge: [248, 380], chips: { x: 44, y: 420, w: 64, h: 24, gap: 8, dir: 'h' }, note: [44, 478] },
      asks: { x: 296, y: 380, w: 106, h: 24, gap: 12 },
      op: { tab: R(20, 508, 74, 26), title: [252, 532], sub: [330, 532], chips: { x: 252, y: 546, w: 102, h: 26, cols: 4, gap: 8 } },
      conv: { badge: [264, 602], head: [278, 607] },
      s1: { title: [66, 650], sub: [66, 670] }, s2: { badge: [272, 644], title: [286, 650], strips: { x: 264, y: 660, w: 150, h: 24, gap: 6 } }, s3: { title: [502, 650], sub: [502, 670] },
      frames: { a4: [492, 878, 'left'], ph: [492, 946, 'left'], note: [492, 1006, 'left'] },
      png: { title: [44, 1064], count: [44, 1090], thumbs: { x: 220, y: 1050, h: 72, gap: 10 }, chips: [R(410, 1052, 270, 26), R(410, 1086, 270, 26)] },
      rev: { badge: [48, 1172], title: [64, 1177], rows: { x: 44, y: 1202, step: 20 }, foot: [44, 1262] },
      use: { title: [384, 1176], files: [R(384, 1188, 140, 40), R(536, 1188, 140, 40)], rows: [384, 1250], foot: null, note: null },
      e11: null,
    },
  },
  compact: {
    W: 340, H: 340, full: false, header: null, token: [20, 28],
    n: {
      book: R(6, 4, 92, 74), ai: R(124, 10, 92, 62), src: R(242, 4, 92, 74),
      op: R(4, 90, 282, 104), conv: R(12, 112, 268, 74),
      s1: R(18, 134, 76, 46), s2: R(106, 134, 76, 46), s3: R(194, 134, 80, 46),
      group: R(8, 204, 166, 90), a4: R(16, 210, 44, 62), ph1: R(74, 214, 38, 54), ph2: R(118, 214, 38, 54),
      png: R(184, 210, 64, 62), rev: R(258, 210, 76, 84), use: R(8, 302, 326, 34),
    },
    e: {
      e1: [[98, 41], [124, 41]],
      e2: [[242, 41], [216, 41]],
      e3: [[150, 72], [150, 84], [56, 84], [56, 134]],
      e4: [[94, 157], [106, 157]],
      e5: [[182, 157], [194, 157]],
      e6: [[234, 180], [234, 199], [38, 199], [38, 210]],
      e7: [[93, 199], [93, 214]],
      e8: [[174, 241], [184, 241]],
      e10: [[248, 241], [258, 241]],
      e11: [[310, 78], [310, 210]],
      e12: [[296, 294], [296, 302]],
    },
    c: {
      book: { title: [52, 24], badges: { x: 22, y: 44, step: 20 }, sub: [52, 68] },
      src: { sheet: R(250, 10, 36, 62), title: [312, 46] },
      ai: { title: [170, 38], sub: [170, 58] },
      op: { tab: [280, 103] },
      conv: { head: [274, 126] },
      s1: { title: [24, 162] }, s2: { title: [112, 162] }, s3: { title: [200, 162] },
      frames: { a4: [38, 288], ph: [115, 288] },
      png: { label: [216, 288], thumbs: { x: 188, y: 222, h: 38, fan: 15 } },
      rev: { badge: [296, 232], title: [296, 262], sub: [296, 282] },
      use: { title: [171, 324] },
    },
  },
};
export const LAYOUT_NAMES = Object.freeze(Object.keys(LAYOUTS));

// 図の段階・部品・場面ごとに、どの部品を前に出すか
const STAGE_NODES = [['book', 'src', 'asks', 'ai'], ['op', 'conv', 'a4', 'ph', 'group'], ['png', 'rev', 'use']];
const SCENE_NODES = [
  ['book', 'src'], ['book', 'src', 'asks', 'ai', 'op'], ['ai', 'op', 'conv'], ['conv', 'a4', 'ph', 'group'],
  ['a4', 'ph', 'group', 'png', 'rev', 'src'], ['a4', 'ph', 'group', 'rev', 'use'], null,
];
const EDGE_NODES = {
  e1: ['book', 'ai'], e2: ['src', 'ai'], e2b: ['asks', 'ai'], e3: ['ai', 'conv'], e4: ['conv'], e5: ['conv'],
  e6: ['conv', 'a4'], e7: ['conv', 'ph'], e8: ['a4', 'png'], e9: ['ph', 'png'], e10: ['png', 'rev'], e11: ['rev'], e12: ['rev', 'use'],
};
const PART_TARGETS = { instructions: ['book'], theme: ['s2'], convert: ['conv'], backend: ['s3'], preview: ['png'], review: ['rev'] };
const PART_SECTION = { instructions: 0, theme: 1, convert: 2, backend: 2, preview: 2, review: 3 };
const SECTIONS = [
  { title: '版の選び方', sub: '原稿・用途・配布先で選ぶ' },
  { title: '5テーマ', sub: '' },
  { title: '変換とプレビュー', sub: 'Python・Pandoc・Chrome' },
  { title: '全ページを読む', sub: '生成後に必ず目で確認' },
];
const THEMES = ['default', 'cjk-auto', 'warm-terra', 'warm-terra-menu', 'mobile'];

/* ---------------------------------------------------------------- 時刻 */

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = x => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;

export function sceneIndex(t) {
  let index = 0;
  SCENES.forEach((scene, i) => { if (t >= scene.start) index = i; });
  return index;
}

/** 時刻tから各部品の出現・変化の割合を求める（前の時刻の結果は使わない）。 */
function timeline(t) {
  const [a, b, c, d, e, f] = SCENES.map(s => s.start);
  const w = (x, y) => ease((t - x) / (y - x));
  const l = (x, y) => clamp01((t - x) / (y - x));
  const seq = (n, from, step, len) => Array.from({ length: n }, (_, i) => w(from + i * step, from + i * step + len));
  return {
    t, c, d,
    book: w(a + 0.1, a + 1.1), sec: seq(4, a + 0.9, 0.5, 0.5), src: w(a + 0.6, a + 1.6), srcRows: l(a + 1.1, a + 3.4),
    asks: w(b, b + 0.7), e1: w(b + 0.3, b + 1.2), e2: w(b + 0.3, b + 1.2), e2b: w(b + 0.5, b + 1.0), ai: w(b + 0.6, b + 1.4),
    tokIn: l(b + 1.2, b + 2.3), aiOut: seq(3, b + 2.2, 0.3, 0.4), op: w(b + 2.6, b + 3.4), opChips: seq(4, b + 3.0, 0.2, 0.4),
    conv: w(c, c + 0.7), e3: w(c + 0.2, c + 0.8), tok3: l(c + 0.4, c + 1.2), html: w(c + 1.4, c + 2.3),
    e4: w(c + 2.1, c + 2.5), tok4: l(c + 2.4, c + 2.9), layers: seq(3, c + 2.9, 0.5, 0.4),
    e5: w(c + 4.2, c + 4.6), tok5: l(c + 4.4, c + 4.9), pdf: w(c + 5.0, c + 5.6),
    active: [w(c + 1.0, c + 1.3) * (1 - w(c + 2.3, c + 2.6)), w(c + 2.8, c + 3.1) * (1 - w(c + 4.4, c + 4.7)), w(c + 4.8, c + 5.1) * (1 - w(d + 0.3, d + 0.8))],
    e6: w(d, d + 0.8), e7: w(d, d + 0.8), tok6: l(d + 0.3, d + 1.4),
    a4: w(d + 0.6, d + 1.3), a4fill: w(d + 1.2, d + 2.6), ph: w(d + 0.9, d + 1.6), phfill: w(d + 1.3, d + 1.7), wrap: l(d + 1.6, d + 4.4), ph2: w(d + 3.0, d + 3.6),
    a4label: w(d + 2.4, d + 3.0), phlabel: w(d + 4.2, d + 4.8), observed: w(d + 4.8, d + 5.4),
    e8: w(e, e + 0.6), e9: w(e, e + 0.6), png: w(e + 0.2, e + 0.8), thumbs: seq(3, e + 0.6, 0.35, 0.4), pngChips: w(e + 1.9, e + 2.5),
    e11: w(e + 2.5, e + 3.7), tok11: l(e + 2.7, e + 4.0), e10: w(e + 2.9, e + 3.5), rev: w(e + 3.3, e + 4.0), revRows: seq(3, e + 4.0, 0.4, 0.4),
    e12: w(f, f + 0.5), tok12: l(f + 0.1, f + 0.8), use: w(f + 0.2, f + 0.9), useRows: seq(3, f + 0.9, 0.35, 0.4),
  };
}

/* ---------------------------------------------------------------- 描画の部品 */

function rrect(ctx, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function panel(g, r, o = {}) {
  const { ctx, pal } = g;
  rrect(ctx, r.x, r.y, r.w, r.h, o.radius ?? 10);
  if (o.fill !== null) { ctx.fillStyle = o.fill || pal.card; ctx.fill(); }
  if (o.stroke !== null) {
    ctx.setLineDash(o.dash || []);
    ctx.lineWidth = o.lw || 1.5;
    ctx.strokeStyle = o.stroke || pal.line;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function setFont(g, size, weight, serif) {
  const px = Math.max(size, g.minFont);
  g.ctx.font = `${weight || 400} ${px}px ${serif ? SERIF : SANS}`;
  return px;
}

/** 文字を描く。maxを超える場合は縮めるが、最小の文字サイズ（作例ページでは11CSSpx）より小さくしない。 */
function text(g, str, x, y, size, o = {}) {
  const { ctx } = g;
  const px = setFont(g, size, o.weight, o.serif);
  if (o.max) {
    const width = ctx.measureText(str).width;
    if (width > o.max) setFont(g, Math.max(g.minFont, px * o.max / width), o.weight, o.serif);
  }
  ctx.fillStyle = o.color || g.pal.ink;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  ctx.fillText(str, x, y);
}

function chip(g, r, label, o = {}) {
  panel(g, r, { radius: Math.min(r.h / 2, 8), fill: o.fill || g.pal.chip, stroke: o.stroke ?? null, lw: o.lw });
  text(g, label, r.x + r.w / 2, r.y + r.h / 2 + 0.5, o.size || 12, { align: 'center', base: 'middle', color: o.color, weight: o.weight || 600, max: r.w - 8 });
}

function numberBadge(g, cx, cy, n, radius = 9) {
  const { ctx, pal } = g;
  const size = Math.max(radius * 1.25, g.minFont);
  const r = Math.max(radius, size * 0.62);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = pal.card;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = pal.accent;
  ctx.stroke();
  text(g, String(n), cx, cy + 0.5, size, { align: 'center', base: 'middle', color: pal.accent, weight: 700 });
}

function page(g, r) {
  const { ctx } = g;
  ctx.fillStyle = SHEET.shadow;
  ctx.fillRect(r.x + 2, r.y + 3, r.w, r.h);
  ctx.fillStyle = SHEET.paper;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.lineWidth = 1;
  ctx.strokeStyle = SHEET.line;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
}

function segments(pts) {
  const out = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    out.push({ x0, y0, x1, y1, len });
    total += len;
  }
  return { out, total };
}

function pointAt(pts, u) {
  const { out, total } = segments(pts);
  let d = clamp01(u) * total;
  for (let i = 0; i < out.length; i++) {
    const s = out[i];
    if (d <= s.len || i === out.length - 1) {
      const k = s.len ? Math.min(1, d / s.len) : 0;
      return { x: lerp(s.x0, s.x1, k), y: lerp(s.y0, s.y1, k) };
    }
    d -= s.len;
  }
  return { x: pts[0][0], y: pts[0][1] };
}

function partial(pts, p) {
  const { out, total } = segments(pts);
  let d = clamp01(p) * total;
  const result = [pts[0]];
  for (const s of out) {
    if (d >= s.len) { result.push([s.x1, s.y1]); d -= s.len; continue; }
    const k = s.len ? d / s.len : 0;
    result.push([lerp(s.x0, s.x1, k), lerp(s.y0, s.y1, k)]);
    break;
  }
  return result;
}

function drawEdge(g, pts, p, alpha, o = {}) {
  if (!pts || p <= 0 || alpha <= 0) return;
  const { ctx, pal } = g;
  const sub = partial(pts, p);
  if (sub.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = o.color || pal.edge;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = o.width || (g.L.full ? 2.4 : 1.8);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(o.dash || []);
  ctx.beginPath();
  ctx.moveTo(sub[0][0], sub[0][1]);
  for (let i = 1; i < sub.length; i++) ctx.lineTo(sub[i][0], sub[i][1]);
  ctx.stroke();
  ctx.setLineDash([]);
  const [x1, y1] = sub[sub.length - 1], [x0, y0] = sub[sub.length - 2];
  if (Math.hypot(x1 - x0, y1 - y0) > 0.01) {
    const a = Math.atan2(y1 - y0, x1 - x0), h = g.L.full ? 10 : 6.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45));
    ctx.lineTo(x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- 同じ原稿の「紙の模様」 */

// 1行あたりの全角文字数の目安。実際の組版の再現ではなく、折り返しの違いを見せる図の値。
const CPL = { source: 30, paper: 44, phone: 27 };

/** 29ブロックを行に並べる。見出し・注意・箇条書き・番号付き・段落を、決まった太さと色の帯で表す。 */
function flowRows(blocks, cpl) {
  const rows = [];
  let y = 0;
  blocks.forEach((block, i) => {
    const k = block.kind;
    const scale = k === 'h1' ? 1.7 : k === 'h2' ? 1.3 : 1;
    const indent = k === 'ol' || k === 'li' ? 2 : 0;
    const per = Math.max(3, Math.floor((cpl - indent) / scale));
    const unit = k === 'h1' ? 1.9 : k === 'h2' ? 1.5 : 1;
    if (i > 0) y += k === 'h2' ? 0.8 : 0.3;
    let rest = block.text.length, line = 0;
    do {
      const take = Math.min(rest, per);
      rows.push({ block, index: block.index, line, x: indent, w: take * scale, y, h: unit });
      y += unit;
      rest -= take;
      line++;
    } while (rest > 0);
  });
  return { rows, height: y };
}

const FLOWS = new WeakMap();
function flowsFor(model) {
  let flows = FLOWS.get(model);
  if (!flows) {
    flows = { source: flowRows(model.blocks, CPL.source), paper: flowRows(model.blocks, CPL.paper), phone: flowRows(model.blocks, CPL.phone) };
    FLOWS.set(model, flows);
  }
  return flows;
}

function tag(g, right, cy, label, size = 11) {
  const { ctx } = g;
  const px = setFont(g, size, 700);
  const w = ctx.measureText(label).width + px * 0.8, h = px * 1.35;
  rrect(ctx, right - w, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = SHEET.paper;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = SHEET.accent;
  ctx.stroke();
  ctx.fillStyle = SHEET.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, right - w / 2, cy + 0.5);
}

function drawFlow(g, r, flow, cpl, o = {}) {
  const { ctx } = g;
  const alpha = ctx.globalAlpha * (o.alpha ?? 1);
  if (alpha <= 0) return;
  const pad = o.pad ?? Math.max(2, Math.min(r.w, r.h) * 0.08);
  const ix = r.x + pad, cw = (r.w - pad * 2) / cpl;
  const from = o.from ?? 0, to = o.to ?? Infinity;
  const first = flow.rows.find(row => row.index >= from);
  const base = first ? first.y : 0;
  const lh = o.lh ?? (r.h - pad * 2) / Math.max(1, flow.height);
  const top = r.y + pad;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (o.clip) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
  const numbered = [];
  for (const row of flow.rows) {
    if (row.index < from || row.index >= to) continue;
    if (o.reveal != null && row.index >= o.reveal) break;
    const b = row.block, k = b.kind;
    const y = top + (row.y - base) * lh, rowH = lh * row.h;
    const th = Math.max(0.8, rowH * (k === 'h1' ? 0.5 : k === 'h2' ? 0.46 : 0.42));
    const cy = y + rowH * 0.55;
    const x = ix + row.x * cw, w = Math.max(cw, Math.min(row.w, cpl - row.x) * cw);
    if (k === 'notice') {
      ctx.fillStyle = SHEET.accentSoft;
      ctx.fillRect(x - 1, cy - th, w + 2, th * 2);
      ctx.fillStyle = SHEET.accent;
      ctx.fillRect(x, cy - th / 2, w, th);
    } else if (k === 'li' && b.optional) {
      ctx.setLineDash([Math.max(1.5, th), Math.max(1, th * 0.7)]);
      ctx.lineWidth = Math.max(0.6, th * 0.45);
      ctx.strokeStyle = SHEET.body;
      ctx.strokeRect(x, cy - th / 2, w, th);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = k === 'h1' ? SHEET.ink : k === 'h2' ? SHEET.accent : k === 'p' ? SHEET.muted : SHEET.body;
      ctx.fillRect(x, cy - th / 2, w, th);
    }
    if (row.line === 0 && (k === 'li' || k === 'ol')) {
      const m = Math.max(0.8, th * 0.9);
      ctx.fillStyle = k === 'ol' ? SHEET.accent : SHEET.body;
      ctx.fillRect(ix + cw * 0.4, cy - m / 2, m, m);
    }
    if (k === 'ol') numbered.push({ n: b.n, y0: y, y1: y + rowH });
    if (o.optionalTag && k === 'li' && b.optional && row.line === 0) tag(g, r.x + r.w - 3, cy, '任意', o.tagSize);
  }
  if (o.tag && numbered.length) {
    // 番号付きの流れ（1〜6）が、どのページに何番まで入ったかを示す印
    const nums = numbered.map(item => item.n);
    const lo = Math.min(...nums), hi = Math.max(...nums);
    const y0 = numbered[0].y0, y1 = numbered[numbered.length - 1].y1;
    ctx.strokeStyle = SHEET.accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w - 2, y0);
    ctx.lineTo(r.x + r.w - 2, y1);
    ctx.stroke();
    tag(g, r.x + r.w - 3, (y0 + y1) / 2, lo === hi ? String(lo) : `${lo}–${hi}`, o.tagSize);
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- 強調 */

function sceneEmphasis(t, key) {
  let best = 0;
  SCENES.forEach((scene, i) => {
    const nodes = SCENE_NODES[i];
    if (nodes && !nodes.includes(key)) return;
    const end = i + 1 < SCENES.length ? SCENES[i + 1].start : DURATION + 1;
    best = Math.max(best, Math.min(clamp01((t - scene.start + 0.3) / 0.4), clamp01((end + 0.1 - t) / 0.4)));
  });
  return 0.6 + 0.4 * best;
}

function dimOf(g, key) {
  if (g.film) return sceneEmphasis(g.t, key);
  const f = g.focus;
  let a = 1;
  if (f.stage != null && STAGE_NODES[f.stage] && !STAGE_NODES[f.stage].includes(key)) a = 0.68;
  if (f.case === 'paper' && key === 'ph') a = Math.min(a, 0.68);
  if (f.case === 'phone' && key === 'a4') a = Math.min(a, 0.68);
  return a;
}

const caseTheme = g => (!g.film && g.focus.case && PINNED[g.focus.case] ? PINNED[g.focus.case].theme : null);

/* ---------------------------------------------------------------- 各部品 */

function drawHeader(g) {
  const { L, pal } = g, H = L.header;
  if (!H) return;
  const i = sceneIndex(g.t), scene = SCENES[i];
  const kicker = g.film ? `PDF Creator の中身　${i + 1} / ${SCENES.length}` : 'PDF Creator の中身';
  if (H.right != null) {
    text(g, scene.title, H.x, H.title, 26, { weight: 700, serif: true, max: 1000 });
    text(g, scene.sub, H.x, H.sub, 14, { color: pal.muted, max: 1000 });
    text(g, kicker, H.right, H.title, 13, { align: 'right', color: pal.accent, weight: 700 });
  } else {
    text(g, kicker, H.x, H.kicker, 13, { color: pal.accent, weight: 700 });
    text(g, scene.title, H.x, H.title, 26, { weight: 700, serif: true, max: L.W - H.x * 2 });
    text(g, scene.sub, H.x, H.sub, 14, { color: pal.muted, max: L.W - H.x * 2 });
  }
}

function drawSwatches(g, x, y, max) {
  const { ctx, pal } = g;
  const size = 11, gap = 4;
  const chosen = caseTheme(g) ? [caseTheme(g)] : ['warm-terra', 'mobile'];
  THEMES.forEach((name, i) => {
    const used = chosen.includes(name);
    ctx.fillStyle = used ? pal.accent : pal.card;
    ctx.fillRect(x + i * (size + gap), y, size, size);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = used ? pal.accent : pal.muted;
    ctx.strokeRect(x + i * (size + gap) + 0.5, y + 0.5, size - 1, size - 1);
  });
  const lx = x + THEMES.length * (size + gap) + 4;
  const label = max > 200 ? `${chosen.join('・')} を使用` : `${chosen.length}つを使用`;
  text(g, label, lx, y + size - 1, 12, { color: pal.muted, max: x + max - lx });
}

function drawBook(g) {
  const { ctx, L, T, pal } = g, r = L.n.book, c = L.c.book;
  const a = T.book * dimOf(g, 'book');
  if (a <= 0) return;
  const hot = !g.film && g.focus.ring ? PART_SECTION[g.focus.part] ?? -1 : -1;
  ctx.save();
  ctx.globalAlpha = a;
  panel(g, R(r.x + 5, r.y + 5, r.w, r.h), { fill: pal.card2, stroke: pal.line, radius: 8 });
  panel(g, r, { fill: pal.card, stroke: pal.ink, lw: 1.6, radius: 8 });
  ctx.fillStyle = pal.accent;
  ctx.fillRect(r.x + 3, r.y + 6, L.full ? 8 : 6, r.h - 12);
  if (L.full) {
    text(g, 'PDF Creator', c.title[0], c.title[1], 19, { weight: 700, serif: true, max: r.w - 34 });
    text(g, '手順書 SKILL.md ＋ 変換.py ＋ テーマCSS', c.sub[0], c.sub[1], 12, { color: pal.muted, max: r.w - 34 });
    SECTIONS.forEach((section, i) => {
      const k = T.sec[i];
      if (k <= 0) return;
      const y = c.rows.y + i * c.rows.h, mid = y + c.rows.h / 2;
      ctx.globalAlpha = a * k;
      if (i === hot) panel(g, R(r.x + 14, y + 2, r.w - 22, c.rows.h - 4), { fill: pal.accentSoft, stroke: null, radius: 6 });
      numberBadge(g, c.rows.x + 6, mid - 2, i + 1);
      const tx = c.rows.x + 24, max = r.x + r.w - 10 - tx;
      text(g, section.title, tx, mid - 3, 14, { weight: 700, max });
      if (i === 1) drawSwatches(g, tx, mid + 4, max);
      else text(g, section.sub, tx, mid + 14, 12, { color: pal.muted, max });
    });
  } else {
    text(g, '手順書', c.title[0], c.title[1], 13, { weight: 700, align: 'center' });
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = a * T.sec[i];
      const x = c.badges.x + i * c.badges.step;
      if (i === hot) {
        ctx.beginPath();
        ctx.arc(x, c.badges.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = pal.accentSoft;
        ctx.fill();
      }
      numberBadge(g, x, c.badges.y, i + 1, 7);
    }
    ctx.globalAlpha = a;
    text(g, 'SKILL.md', c.sub[0], c.sub[1], 11, { align: 'center', color: pal.muted, max: r.w - 16 });
  }
  ctx.restore();
}

function drawSource(g) {
  const { ctx, L, T, pal, model } = g, r = L.n.src, c = L.c.src;
  const a = T.src * dimOf(g, 'src');
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  panel(g, r, { fill: pal.card, stroke: pal.line, radius: 10 });
  page(g, c.sheet);
  drawFlow(g, c.sheet, g.flows.source, CPL.source, { reveal: T.srcRows * model.blocks.length, tag: L.full, optionalTag: L.full, tagSize: 11 });
  if (L.full) {
    text(g, '原稿 event.md', c.title[0], c.title[1], 14, { weight: 700, max: r.w - 28 });
    const event = model.event;
    const avail = r.x + r.w - 8 - c.call.x;
    const lines = [
      [`${model.blocks.length}ブロック`, pal.ink], ['流れ 6項目', pal.accent], ['持ち物 3', pal.ink],
      ['うち任意 1', pal.muted], ['架空の注意', pal.accent], [`定員 ${event.capacity}名`, pal.ink],
    ];
    if (avail >= 130) lines.push([event.date, pal.ink]);
    lines.forEach(([label, color], i) => {
      const k = clamp01(T.srcRows * 1.4 - i * 0.12);
      if (k <= 0) return;
      ctx.globalAlpha = a * k;
      const y = c.call.y + i * c.call.step;
      ctx.fillStyle = color;
      ctx.fillRect(c.call.x, y - 9, 4, 11);
      text(g, label, c.call.x + 10, y, 13, { weight: 600, max: avail - 10 });
    });
  } else {
    text(g, '原稿', c.title[0], c.title[1], 13, { weight: 700, align: 'center' });
  }
  ctx.restore();
}

function drawAsks(g) {
  const { ctx, L, T, pal } = g;
  if (!L.full) return;
  const a = T.asks * dimOf(g, 'asks');
  if (a <= 0) return;
  const c = L.c.asks;
  ctx.save();
  ctx.globalAlpha = a;
  ['用途', '日本語', 'フォント', '2版'].forEach((label, i) => {
    chip(g, R(c.x + (i % 2) * (c.w + c.gap), c.y + Math.floor(i / 2) * (c.h + 6), c.w, c.h), label, { fill: pal.accentSoft, size: 12 });
  });
  ctx.restore();
}

function drawAI(g) {
  const { ctx, L, T, pal } = g, r = L.n.ai, c = L.c.ai;
  const a = T.ai * dimOf(g, 'ai');
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  panel(g, r, { fill: pal.card, stroke: pal.ink, lw: 2.4, radius: L.full ? 18 : 14 });
  if (L.full) {
    text(g, '作者AI', c.title[0], c.title[1], 20, { weight: 700, serif: true });
    text(g, 'Opus 5.5・1つ', c.sub[0], c.sub[1], 12, { color: pal.muted });
    numberBadge(g, c.badge[0], c.badge[1], 1);
    const vertical = c.chips.dir === 'v';
    const labels = vertical ? ['原稿（Markdown）', '版の選択', '追加の和文CSS'] : ['原稿MD', '版の選択', '和文CSS'];
    labels.forEach((label, i) => {
      const k = T.aiOut[i];
      if (k <= 0) return;
      ctx.globalAlpha = a * k;
      const x = vertical ? c.chips.x : c.chips.x + i * (c.chips.w + c.chips.gap);
      const y = vertical ? c.chips.y + i * (c.chips.h + c.chips.gap) : c.chips.y;
      chip(g, R(x, y, c.chips.w, c.chips.h), label, { fill: pal.accentSoft, size: 12 });
    });
    ctx.globalAlpha = a * T.aiOut[2];
    text(g, 'シェルは実行しない', c.note[0], c.note[1], 11, { color: pal.muted });
  } else {
    text(g, '作者AI', c.title[0], c.title[1], 14, { weight: 700, align: 'center' });
    text(g, 'Opus 5.5', c.sub[0], c.sub[1], 11, { align: 'center', color: pal.muted, max: r.w - 10 });
  }
  ctx.restore();
}

function drawOperator(g) {
  const { ctx, L, T, pal } = g, r = L.n.op, c = L.c.op;
  const a = T.op * dimOf(g, 'op');
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  panel(g, r, { fill: pal.blueSoft, stroke: pal.blue, dash: [8, 6], lw: 1.8, radius: 14 });
  if (L.full) {
    panel(g, c.tab, { fill: pal.blue, stroke: null, radius: 8 });
    text(g, '別工程', c.tab.x + c.tab.w / 2, c.tab.y + c.tab.h / 2 + 0.5, 13, { align: 'center', base: 'middle', color: pal.onBlue, weight: 700 });
    text(g, '制作担当', c.title[0], c.title[1], 16, { weight: 700, color: pal.blue });
    text(g, 'build_pdfs.py が原典を呼ぶ', c.sub[0], c.sub[1], 12, { color: pal.muted, max: r.x + r.w - 12 - c.sub[0] });
    const cc = c.chips;
    ['Chrome指定', 'lang=ja', '静的TTF', 'UTF-8'].forEach((label, i) => {
      const k = T.opChips[i];
      if (k <= 0) return;
      ctx.globalAlpha = a * k;
      const box = R(cc.x + (i % cc.cols) * (cc.w + cc.gap), cc.y + Math.floor(i / cc.cols) * (cc.h + 8), cc.w, cc.h);
      chip(g, box, label, { fill: pal.card, stroke: pal.blue, lw: 1, color: pal.blue, size: 12 });
    });
  } else {
    text(g, '別工程・制作担当', c.tab[0], c.tab[1], 12, { align: 'right', color: pal.blue, weight: 700 });
  }
  ctx.restore();
}

function drawConverter(g) {
  const { ctx, L, T, pal } = g, n = L.n, c = L.c;
  const a = T.conv * dimOf(g, 'conv');
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  panel(g, n.conv, { fill: pal.card, stroke: pal.ink, lw: 1.8, radius: 12 });
  if (L.full) {
    numberBadge(g, c.conv.badge[0], c.conv.badge[1], 3);
    text(g, 'markdown_to_pdf（原典）', c.conv.head[0], c.conv.head[1], 14, { weight: 700, max: n.conv.x + n.conv.w - 12 - c.conv.head[0] });
  } else {
    const px = setFont(g, 12, 700);
    const width = ctx.measureText('原典の変換').width;
    text(g, '原典の変換', c.conv.head[0], c.conv.head[1], 12, { align: 'right', weight: 700 });
    numberBadge(g, c.conv.head[0] - width - px * 0.9, c.conv.head[1] - px * 0.35, 3, 7);
  }
  ['s1', 's2', 's3'].forEach((key, i) => {
    panel(g, n[key], { fill: pal.chip, stroke: pal.line, radius: 8 });
    const hot = T.active[i];
    if (hot > 0) {
      ctx.save();
      ctx.globalAlpha = a * hot;
      panel(g, n[key], { fill: pal.accentSoft, stroke: pal.accent, lw: 2, radius: 8 });
      ctx.restore();
    }
  });
  if (L.full) {
    text(g, 'Pandoc', c.s1.title[0], c.s1.title[1], 15, { weight: 700 });
    text(g, 'Markdown → HTML', c.s1.sub[0], c.s1.sub[1], 12, { color: pal.muted, max: n.s1.w - 60 });
    numberBadge(g, c.s2.badge[0], c.s2.badge[1], 2, 8);
    text(g, 'CSSを重ねる', c.s2.title[0], c.s2.title[1], 15, { weight: 700, max: n.s2.x + n.s2.w - 12 - c.s2.title[0] });
    const theme = caseTheme(g);
    const strips = [[theme ? `原典 ${theme}` : '原典テーマ', pal.accent], ['CJKパッチ（原典）', pal.blue], ['和文CSS（後置）', pal.green]];
    const st = c.s2.strips;
    strips.forEach(([label, color], i) => {
      const k = T.layers[i];
      if (k <= 0) return;
      ctx.globalAlpha = a * k;
      const box = R(st.x, st.y + i * (st.h + st.gap), st.w, st.h);
      panel(g, box, { fill: pal.card, stroke: color, lw: 1.4, radius: 5 });
      ctx.fillStyle = color;
      ctx.fillRect(box.x, box.y, 5, box.h);
      text(g, label, box.x + 12, box.y + box.h / 2 + 0.5, 12, { base: 'middle', max: box.w - 16 });
    });
    ctx.globalAlpha = a;
    text(g, 'Chrome', c.s3.title[0], c.s3.title[1], 15, { weight: 700 });
    text(g, '明示してPDFへ', c.s3.sub[0], c.s3.sub[1], 12, { color: pal.muted, max: n.s3.w - 60 });
  } else {
    text(g, 'HTML', c.s1.title[0], c.s1.title[1], 12, { weight: 700 });
    text(g, 'CSS', c.s2.title[0], c.s2.title[1], 12, { weight: 700 });
    text(g, 'Chrome', c.s3.title[0], c.s3.title[1], 12, { weight: 700 });
  }
  ctx.restore();
}

function label2(g, spot, first, second) {
  const [x, y, align] = spot;
  text(g, first, x, y, 13, { weight: 700, align });
  text(g, second, x, y + 20, 12, { weight: 700, align, color: g.pal.accent });
}

function drawFrames(g) {
  const { ctx, L, T, pal, model } = g, n = L.n, c = L.c.frames, flows = g.flows;
  if (n.group) {
    const a = Math.max(T.a4, T.ph) * dimOf(g, 'group');
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      panel(g, n.group, { fill: pal.card, stroke: pal.line, radius: 8 });
      ctx.restore();
    }
  }
  const paper = model.variants.paper, phone = model.variants.phone;
  const aPaper = T.a4 * dimOf(g, 'a4');
  if (aPaper > 0) {
    ctx.save();
    ctx.globalAlpha = aPaper;
    page(g, n.a4);
    drawFlow(g, n.a4, flows.paper, CPL.paper, { alpha: T.a4fill, tag: L.full, tagSize: 11 });
    if (L.full) {
      ctx.globalAlpha = aPaper * T.a4label;
      label2(g, c.a4, `A4 ${paper.size_mm[0]}×${paper.size_mm[1]}mm`, `${paper.page_count}ページ（実測）`);
    } else {
      ctx.globalAlpha = aPaper * T.a4fill;
      text(g, `A4 ${paper.page_count}枚`, c.a4[0], c.a4[1], 12, { align: 'center', weight: 700, max: 56 });
    }
    ctx.restore();
  }
  const aPhone = T.ph * dimOf(g, 'ph');
  if (aPhone > 0) {
    ctx.save();
    ctx.globalAlpha = aPhone;
    page(g, n.ph1);
    const pad = Math.max(2, Math.min(n.ph1.w, n.ph1.h) * 0.08);
    const rows = flows.phone;
    const splitY = rows.rows.find(row => row.index >= model.split).y;
    const lh = (n.ph1.h - pad * 2) / Math.max(splitY, rows.height - splitY);
    if (T.wrap < 0.5) {
      // 同じ原稿が細い枠で折り返し、はみ出した分は次のページへ
      const cpl = Math.round(lerp(CPL.paper, CPL.phone, T.wrap / 0.5));
      drawFlow(g, n.ph1, flowRows(model.blocks, cpl), cpl, { alpha: T.phfill, lh, pad, clip: true });
    } else {
      drawFlow(g, n.ph1, rows, CPL.phone, { to: model.split, lh, pad, tag: L.full, tagSize: 11, alpha: T.phfill });
    }
    if (T.ph2 > 0) {
      ctx.globalAlpha = aPhone * T.ph2;
      const second = R(lerp(n.ph1.x, n.ph2.x, T.ph2), n.ph2.y, n.ph2.w, n.ph2.h);
      page(g, second);
      drawFlow(g, second, rows, CPL.phone, { from: model.split, lh, pad, tag: L.full, tagSize: 11 });
    }
    if (L.full) {
      ctx.globalAlpha = aPhone * T.phlabel;
      label2(g, c.ph, `細いページ ${phone.size_mm[0]}×${phone.size_mm[1]}mm`, `${phone.page_count}ページ（実測）`);
      ctx.globalAlpha = aPhone * T.observed;
      text(g, 'ページ数は生成後に数えた結果', c.note[0], c.note[1], 11, { align: c.note[2], color: pal.muted, max: 200 });
    } else {
      ctx.globalAlpha = aPhone * T.phfill;
      text(g, `細いページ${phone.page_count}枚`, c.ph[0], c.ph[1], 12, { align: 'center', weight: 700, max: 82 });
    }
    ctx.restore();
  }
}

function drawPreview(g) {
  const { ctx, L, T, pal, model } = g, r = L.n.png, c = L.c.png;
  const a = T.png * dimOf(g, 'png');
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  panel(g, r, { fill: pal.card, stroke: pal.line, radius: 10 });
  const pages = [...model.variants.paper.pages, ...model.variants.phone.pages];
  const spec = c.thumbs;
  let x = spec.x;
  pages.forEach((p, i) => {
    const k = T.thumbs[i];
    const h = spec.h, w = h * p.width / p.height;
    if (k > 0) {
      ctx.globalAlpha = a * k;
      const box = R(x, spec.y + (1 - k) * 6, w, h);
      page(g, box);
      ctx.drawImage(p.bitmap, box.x, box.y, box.w, box.h);
    }
    x += spec.fan ?? w + spec.gap;
  });
  ctx.globalAlpha = a;
  if (L.full) {
    text(g, 'ページ画像（Poppler）', c.title[0], c.title[1], 14, { weight: 700, max: r.w - 28 });
    text(g, `${pages.length}枚`, c.count[0], c.count[1], 13, { color: pal.muted, weight: 700 });
    ctx.globalAlpha = a * T.pngChips;
    chip(g, c.chips[0], 'lint：警告はエラーではない', { size: 12 });
    chip(g, c.chips[1], '表なし → 罫線検査は対象外', { size: 12 });
  } else {
    text(g, 'PNG', c.label[0], c.label[1], 12, { align: 'center', weight: 700 });
  }
  ctx.restore();
}

function drawReview(g) {
  const { ctx, L, T, pal, model } = g, r = L.n.rev, c = L.c.rev;
  const a = T.rev * dimOf(g, 'rev');
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  panel(g, r, { fill: pal.greenSoft, stroke: pal.green, lw: 1.8, radius: 12 });
  if (L.full) {
    numberBadge(g, c.badge[0], c.badge[1], 4);
    text(g, '別工程で読み比べ', c.title[0], c.title[1], 15, { weight: 700, color: pal.green, max: r.x + r.w - 10 - c.title[0] });
    const rows = [
      `全${model.totalPages}ページを原稿と見比べ`,
      `各PDF ${model.validation.markdown_blocks_checked.paper}ブロックの文字を照合`,
      '埋込TrueTypeを確認',
    ];
    rows.forEach((label, i) => {
      const k = T.revRows[i];
      if (k <= 0) return;
      ctx.globalAlpha = a * k;
      const y = c.rows.y + i * c.rows.step;
      ctx.fillStyle = pal.green;
      ctx.fillRect(c.rows.x, y - 6, 5, 5);
      text(g, label, c.rows.x + 12, y, 12, { max: r.x + r.w - 10 - c.rows.x - 12 });
    });
    ctx.globalAlpha = a * T.revRows[2];
    text(g, 'lintは警告のみ・人の承認はなし', c.foot[0], c.foot[1], 11, { color: pal.muted, max: r.x + r.w - 10 - c.foot[0] });
  } else {
    numberBadge(g, c.badge[0], c.badge[1], 4, 7);
    text(g, '読み比べ', c.title[0], c.title[1], 13, { weight: 700, align: 'center', color: pal.green, max: r.w - 6 });
    text(g, `${model.totalPages}ページ`, c.sub[0], c.sub[1], 11, { align: 'center', color: pal.muted });
  }
  ctx.restore();
}

function drawUse(g) {
  const { ctx, L, T, pal, model } = g, r = L.n.use, c = L.c.use;
  const a = T.use * dimOf(g, 'use');
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  panel(g, r, { fill: pal.card, stroke: pal.accent, lw: 2, radius: 12 });
  if (L.full) {
    text(g, '使う：保存済みの原PDF', c.title[0], c.title[1], 15, { weight: 700, max: r.x + r.w - 10 - c.title[0] });
    ['paper', 'phone'].forEach((id, i) => {
      const v = model.variants[id], box = c.files[i];
      const selected = !g.film && g.focus.case === id;
      ctx.globalAlpha = a * T.useRows[0];
      panel(g, box, { fill: selected ? pal.accentSoft : pal.chip, stroke: selected ? pal.accent : null, lw: 2, radius: 8 });
      text(g, `${v.pin.short}・${v.page_count}ページ`, box.x + 8, box.y + 18, 13, { weight: 700, max: box.w - 14 });
      text(g, `${formatBytes(v.bytes)}バイト`, box.x + 8, box.y + 35, 11, { color: pal.muted, max: box.w - 14 });
    });
    ctx.globalAlpha = a * T.useRows[1];
    text(g, c.foot ? '原稿・追加CSS・再現手順' : '原稿・追加CSS・再現手順 → 配る／読む', c.rows[0], c.rows[1], 12, { weight: 600, max: r.x + r.w - 10 - c.rows[0] });
    ctx.globalAlpha = a * T.useRows[2];
    if (c.foot) text(g, '→ 配る ／ 読む', c.foot[0], c.foot[1], 14, { weight: 700, color: pal.accent });
    if (c.note) text(g, 'この図ではPDFを再生成しない', c.note[0], c.note[1], 11, { color: pal.muted, max: r.x + r.w - 10 - c.note[0] });
  } else {
    text(g, '使う：原PDF 2点・原稿 → 配る／読む', c.title[0], c.title[1], 12, { align: 'center', weight: 700, max: r.w - 12 });
  }
  ctx.restore();
}

function drawEdges(g) {
  const { ctx, L, T, pal } = g;
  for (const [key, pts] of Object.entries(L.e)) {
    const nodes = !L.full && key === 'e8' ? ['group', 'png'] : EDGE_NODES[key];
    const alpha = Math.min(...nodes.map(k => dimOf(g, k)));
    drawEdge(g, pts, T[key], alpha, key === 'e11' ? { color: pal.accent, dash: [3, 6] } : {});
  }
  if (L.c.e11 && T.e11 > 0.6) {
    ctx.save();
    ctx.globalAlpha = (T.e11 - 0.6) / 0.4 * dimOf(g, 'rev');
    text(g, '原稿も並べて読む', L.c.e11[0], L.c.e11[1], 12, { color: pal.accent, weight: 700 });
    ctx.restore();
  }
}

function drawToken(g, x, y, o) {
  const { ctx, pal, L } = g;
  const [tw, th] = L.token;
  const r = R(x - tw / 2, y - th / 2, tw, th);
  ctx.save();
  ctx.globalAlpha = o.alpha;
  if (o.kind === 'book') {
    panel(g, r, { fill: pal.card, stroke: pal.ink, lw: 1.4, radius: 3 });
    ctx.fillStyle = pal.accent;
    ctx.fillRect(r.x, r.y + 2, Math.max(3, tw * 0.14), th - 4);
    ctx.fillStyle = pal.line;
    for (let i = 0; i < 4; i++) ctx.fillRect(r.x + tw * 0.3, r.y + th * (0.22 + i * 0.16), tw * 0.55, Math.max(1, th * 0.05));
    ctx.restore();
    return;
  }
  const colors = [pal.accent, pal.blue, pal.green];
  for (let i = 2; i >= 0; i--) {
    const k = (o.layers || [])[i] || 0;
    if (k <= 0) continue;
    const off = (i + 1) * 3.2 * k;
    ctx.globalAlpha = o.alpha * k;
    ctx.fillStyle = colors[i];
    ctx.fillRect(r.x + off, r.y - off, tw, th);
  }
  ctx.globalAlpha = o.alpha;
  page(g, r);
  drawFlow(g, r, g.flows.source, CPL.source, { pad: Math.max(2, tw * 0.12) });
  if (o.html > 0) {
    ctx.globalAlpha = o.alpha * o.html;
    ctx.strokeStyle = pal.blue;
    ctx.lineWidth = 1.8;
    const m = th * 0.12, cy = r.y + th / 2;
    ctx.beginPath();
    ctx.moveTo(r.x - 3, cy - m); ctx.lineTo(r.x - 3 - m * 0.8, cy); ctx.lineTo(r.x - 3, cy + m);
    ctx.moveTo(r.x + tw + 3, cy - m); ctx.lineTo(r.x + tw + 3 + m * 0.8, cy); ctx.lineTo(r.x + tw + 3, cy + m);
    ctx.stroke();
  }
  if (o.badge) {
    ctx.globalAlpha = o.alpha;
    const px = setFont(g, 11, 700);
    const bw = ctx.measureText(o.badge).width + px, bh = px * 1.4;
    chip(g, R(r.x + tw - bw * 0.6, r.y - bh * 0.6, bw, bh), o.badge, { fill: o.badge === 'PDF' ? pal.accent : pal.ink, color: pal.card, size: 11, weight: 700 });
  }
  ctx.restore();
}

function anchor(g, key) {
  const r = g.L.n[key], [tw, th] = g.L.token;
  return { x: r.x + r.w - tw / 2 - 10, y: r.y + r.h - th / 2 - Math.min(8, (r.h - th) / 2) };
}

const fade = u => Math.min(1, u / 0.15, (1 - u) / 0.15);
const lerpPoint = (p, q, k) => ({ x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k) });

/** 同じ原稿（と手順書）の印が、矢印に沿って移動する。どの印もtだけで位置が決まる。 */
function drawTokens(g) {
  const { L, T } = g, e = L.e;
  const travel = (pts, u, o) => {
    if (!pts || u <= 0 || u >= 1) return;
    const p = pointAt(pts, ease(u));
    drawToken(g, p.x, p.y, { ...o, alpha: fade(u) });
  };
  travel(e.e1, T.tokIn, { kind: 'book' });
  travel(e.e2, T.tokIn, { badge: 'MD' });
  const a1 = anchor(g, 's1'), a2 = anchor(g, 's2'), a3 = anchor(g, 's3');
  const inside = { badge: T.pdf > 0.5 ? 'PDF' : T.html > 0.5 ? 'HTML' : 'MD', html: T.html, layers: T.layers };
  if (T.tok3 > 0 && T.tok3 < 1) {
    travel([...e.e3, [a1.x, a1.y]], T.tok3, inside);
  } else if (T.tok3 >= 1 && T.t < T.d + 0.3) {
    let p = a1;
    if (T.tok4 > 0) p = lerpPoint(a1, a2, ease(T.tok4));
    if (T.tok5 > 0) p = lerpPoint(a2, a3, ease(T.tok5));
    drawToken(g, p.x, p.y, { ...inside, alpha: 1 });
  }
  const pdf = { badge: 'PDF', layers: [1, 1, 1] };
  travel([[a3.x, a3.y], ...e.e6], T.tok6, pdf);
  travel([[a3.x, a3.y], ...e.e7], T.tok6, pdf);
  travel(e.e11, T.tok11, { badge: 'MD' });
  travel(e.e12, T.tok12, { badge: 'PDF' });
}

function drawFocus(g) {
  if (g.film || !g.focus.ring || !PART_TARGETS[g.focus.part]) return;
  const { ctx, pal, L } = g;
  ctx.save();
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = L.full ? 3.5 : 2.5;
  for (const key of PART_TARGETS[g.focus.part]) {
    const r = L.n[key];
    rrect(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 12);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 1枚の図を描く。結果は model・layout・t・focus・配色だけで決まり、前の描画やタイマーには依存しない。
 * o: { width, height, layout: 'wide'|'tall'|'compact', t, palette, film, focus: {case, stage, part, ring}, minFontPx }
 */
export function drawFrame(ctx, model, o) {
  const L = LAYOUTS[o.layout] || LAYOUTS.compact;
  const t = Math.min(DURATION, Math.max(0, Number(o.t) || 0));
  const s = Math.min(o.width / L.W, o.height / L.H);
  const g = {
    ctx, L, s, model, t, T: timeline(t), pal: o.palette || FILM_PALETTE, film: !!o.film, focus: o.focus || {},
    minFont: o.minFontPx ? o.minFontPx / s : 0, flows: flowsFor(model),
  };
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.fillStyle = g.pal.bg;
  ctx.fillRect(0, 0, o.width, o.height);
  ctx.translate((o.width - L.W * s) / 2, (o.height - L.H * s) / 2);
  ctx.scale(s, s);
  drawHeader(g);
  drawOperator(g);
  drawConverter(g);
  drawEdges(g);
  drawBook(g);
  drawSource(g);
  drawAsks(g);
  drawAI(g);
  drawFrames(g);
  drawPreview(g);
  drawReview(g);
  drawUse(g);
  drawTokens(g);
  drawFocus(g);
  ctx.restore();
}

/* ---------------------------------------------------------------- 作例ページ */

const STAGE_NOTES = [
  '手順書は、版の選び方・5テーマ・Pythonの変換とプレビュー・全ページ確認を書いた、AIが読む指示書です。元のOpus 5.5（作者AIは1つ）が手順書と原稿・依頼（用途・日本語・フォント・2版）を読み、日本語のMarkdown・追加の和文CSS・閲覧ページ・旧28秒の解説を書きました。作者AIはシェルを実行していません。',
  '制作担当が別工程で build_pdfs.py を実行し、原典の markdown_to_pdf(theme=…, backend=\'chrome\', previews=True) を呼びました。中ではPandocでHTMLにし、原典テーマ＋CJKパッチ＋後置の和文CSSを重ね、指定したChromeでPDFにします。Chrome検出・使い捨てプロファイル・UTF-8・lang=ja・静的TrueType（400/700/800）は今回の補助で、原典の18ファイルは変えていません。補助なしの原典コマンドだけで同じ日本語の結果になるとは示していません。',
  'PDFは原典の処理でPopplerのページ画像になり、中国語向けの一部の字組みlintも走ります。警告はエラーでも自動修正でもありません。原稿に表がないため、罫線検査は合格0件ではなく対象外です。元の制作担当が全3ページを原稿と見比べ、各PDF 29ブロックの文字と埋込TrueTypeを確認しました。人による承認はしていません。いま使えるのは保存済みの原PDFで、このページでは再実行しません。',
];
const OVERVIEW_NOTE = '手順書と原稿を同じ作者AIが読み、制作担当が別工程で原典の markdown_to_pdf() を実行。PDFはページ画像にして原稿と読み比べ、保存済みの原PDFを使います。段階のボタンで図の一部を前に出せます。';

/** index.html の操作を始める。video/ からは呼ばない。 */
export function initMain() {
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const canvas = $('concept-map');
  const el = {
    status: $('load-status'), retry: $('retry'), caseMeta: $('case-meta'), phase: $('phase-note'), replay: $('replay'),
    desk: $('open-desk'), save: $('save-record'), saveStatus: $('save-status'), recordName: $('record-name'), recordContent: $('record-content'),
    partLabel: $('part-label'), partMeaning: $('part-meaning'), partQuote: $('part-quote'), partSource: $('part-source'), partLocal: $('part-local'),
    request: $('request-text'), copy: $('copy-request'), copyStatus: $('copy-status'),
  };
  const caseButtons = [...document.querySelectorAll('button[data-case]')];
  const stageButtons = [...document.querySelectorAll('button[data-stage]')];
  const partButtons = [...document.querySelectorAll('button[data-part]')];
  const articles = { paper: $('paper'), phone: $('phone') };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const hashCase = () => (location.hash === '#phone' ? 'phone' : location.hash === '#paper' ? 'paper' : null);
  const state = { case: hashCase() || 'paper', stage: null, part: 'instructions', ring: false };
  let model = null, replayT = null, raf = 0, generation = 0, urls = [];

  function paint() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!model) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(ctx, model, {
      width: rect.width, height: rect.height, layout: rect.width >= 960 ? 'wide' : 'compact',
      t: replayT ?? DURATION, palette: paletteFrom(canvas), film: replayT != null, minFontPx: 11,
      focus: { case: state.case, stage: state.stage, part: state.part, ring: state.ring },
    });
  }

  function stopReplay() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    replayT = null;
  }

  function startReplay() {
    stopReplay();
    if (!model) return;
    if (reduce.matches) {
      paint();
      el.phase.textContent = '動きを減らす設定のため、完成した図をそのまま表示しています。内容は動きのある表示と同じです。';
      return;
    }
    const start = performance.now();
    const step = now => {
      const t = (now - start) / 1000 * 3;
      if (t >= DURATION) { stopReplay(); paint(); return; }
      replayT = t;
      paint();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function setControls(on) {
    for (const button of [...caseButtons, ...stageButtons, ...partButtons, el.save, el.copy, el.replay]) button.disabled = !on;
    if (on) {
      el.desk.href = `desk.html#${state.case}`;
      el.desk.removeAttribute('aria-disabled');
    } else {
      el.desk.removeAttribute('href');
      el.desk.setAttribute('aria-disabled', 'true');
    }
  }

  function clearAll() {
    paint();
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    for (const node of [el.caseMeta, el.phase, el.saveStatus, el.recordName, el.recordContent, el.partLabel, el.partMeaning, el.partQuote, el.partSource, el.partLocal, el.copyStatus]) node.textContent = '';
    el.partSource.removeAttribute('href');
    el.partLocal.removeAttribute('href');
    el.request.value = '';
    for (const article of Object.values(articles)) {
      article.querySelector('[data-facts]').replaceChildren();
      article.querySelector('[data-thumbs]').replaceChildren();
    }
  }

  function fact(list, term, value, mono) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    if (mono) dd.className = 'mono';
    list.append(dt, dd);
  }

  function fillArticles() {
    for (const id of ['paper', 'phone']) {
      const v = model.variants[id], article = articles[id];
      const list = article.querySelector('[data-facts]');
      fact(list, '版', `${v.pin.theme}（原典）＋ ${v.pin.override}`);
      fact(list, '寸法', `${v.size_mm[0]}×${v.size_mm[1]}mm`);
      fact(list, 'ページ数', `${v.page_count}ページ（生成後の実測）`);
      fact(list, '原PDF', `${v.name}・${formatBytes(v.bytes)}バイト`);
      fact(list, 'バックエンド', 'chrome（明示）');
      fact(list, 'SHA-256', v.pdf_sha256, true);
      const thumbs = article.querySelector('[data-thumbs]');
      for (const p of v.pages) {
        const url = URL.createObjectURL(new Blob([p.bytes], { type: 'image/png' }));
        urls.push(url);
        const img = document.createElement('img');
        img.src = url;
        img.width = p.width;
        img.height = p.height;
        img.loading = 'lazy';
        img.alt = `${v.label} ${p.number}/${v.page_count}ページ目（保存済みPDFの実ページ画像）`;
        thumbs.append(img);
      }
    }
  }

  function update() {
    if (!model) return;
    const v = model.variants[state.case];
    for (const button of caseButtons) button.setAttribute('aria-pressed', String(button.dataset.case === state.case));
    for (const button of stageButtons) button.setAttribute('aria-pressed', String(Number(button.dataset.stage) === state.stage));
    for (const button of partButtons) button.setAttribute('aria-pressed', String(state.ring && button.dataset.part === state.part));
    for (const [id, article] of Object.entries(articles)) article.hidden = id !== state.case;
    el.desk.href = `desk.html#${state.case}`;
    el.caseMeta.textContent = `${v.label}：${v.pin.theme}＋${v.pin.override.replace('themes/', '')}・${v.size_mm[0]}×${v.size_mm[1]}mm・${v.page_count}ページ（実測）・${formatBytes(v.bytes)}バイト`;
    const caseLine = state.case === 'paper'
      ? '選択中：会場で配る用途 → 原典warm-terra＋japanese-a4.css → A4 1ページ。'
      : '選択中：スマートフォンで読む用途 → 原典mobile＋japanese-phone.css → 148×210mm 2ページ。';
    el.phase.textContent = `${state.stage == null ? OVERVIEW_NOTE : STAGE_NOTES[state.stage]} ${caseLine}`;
    el.recordName.textContent = v.name;
    el.recordContent.textContent = `保存済みの原PDF・${formatBytes(v.bytes)}バイト・${v.page_count}ページ・${v.size_mm[0]}×${v.size_mm[1]}mm・${v.theme}・backend chrome・SHA-256 ${v.pdf_sha256}`;
    const part = model.structure.parts.find(p => p.id === state.part);
    el.partLabel.textContent = part.label;
    el.partMeaning.textContent = part.meaning;
    el.partQuote.textContent = part.quote;
    el.partSource.textContent = `原典 ${part.upstream_path} ${part.line_start}行目（固定コミット ${model.commit.slice(0, 7)}）`;
    el.partSource.href = part.source_url;
    el.partLocal.textContent = `同梱 ${part.source_path}（${part.line_start}行目）`;
    el.partLocal.href = part.source_path;
    paint();
  }

  async function load() {
    const run = ++generation;
    stopReplay();
    model = null;
    clearAll();
    setControls(false);
    root.dataset.state = 'loading';
    el.retry.hidden = true;
    el.status.textContent = '保存済みの23ファイルを照合しています…';
    try {
      const loaded = await loadVerified((done, total) => {
        if (run === generation && root.dataset.state === 'loading') el.status.textContent = `保存済みのファイルを照合中：${done} / ${total}`;
      });
      if (run !== generation) return;
      model = loaded;
      for (const button of partButtons) {
        const part = model.structure.parts.find(p => p.id === button.dataset.part);
        if (part) button.textContent = part.label;
      }
      el.request.value = model.request;
      fillArticles();
      root.dataset.state = 'ready';
      el.status.textContent = '照合済み：23ファイルが固定した記録と一致。PDFは保存済みの原本で、このページでは生成しません。';
      setControls(true);
      update();
    } catch (error) {
      if (run !== generation) return;
      model = null;
      clearAll();
      setControls(false);
      root.dataset.state = 'error';
      el.status.textContent = `表示を止めました：${error instanceof Error ? error.message : String(error)}`;
      el.retry.hidden = false;
    }
  }

  for (const button of caseButtons) button.addEventListener('click', () => {
    stopReplay();
    state.case = button.dataset.case;
    history.replaceState(null, '', '#' + state.case);
    el.saveStatus.textContent = '';
    update();
  });
  for (const button of stageButtons) button.addEventListener('click', () => {
    stopReplay();
    const stage = Number(button.dataset.stage);
    state.stage = state.stage === stage ? null : stage;
    update();
  });
  for (const button of partButtons) button.addEventListener('click', () => {
    stopReplay();
    state.part = button.dataset.part;
    state.ring = true;
    update();
  });
  el.replay.addEventListener('click', startReplay);
  el.retry.addEventListener('click', load);
  el.save.addEventListener('click', () => {
    if (!model || root.dataset.state !== 'ready') return;
    const v = model.variants[state.case];
    const blob = new Blob([v.pdf], { type: 'application/pdf' });
    if (blob.size !== v.bytes) {
      el.saveStatus.textContent = '保存を中止しました：渡すデータの長さが記録と一致しません。';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = v.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    el.saveStatus.textContent = `${v.name}（保存済みの原PDF・${formatBytes(v.bytes)}バイト）をブラウザーに渡しました。ディスクへの保存が終わったかは、このページからは確認できません。`;
  });
  el.copy.addEventListener('click', async () => {
    if (!model) return;
    try {
      await navigator.clipboard.writeText(model.request);
      el.copyStatus.textContent = '依頼文をコピーしました。貼り付け先で内容を確かめてください。';
    } catch {
      el.request.focus();
      el.request.select();
      el.copyStatus.textContent = 'コピーできませんでした。選択した依頼文を手動でコピーしてください。';
    }
  });
  window.addEventListener('hashchange', () => {
    const next = hashCase();
    if (next && next !== state.case) { state.case = next; update(); }
  });
  scheme.addEventListener('change', paint);
  new ResizeObserver(() => paint()).observe(canvas);
  load();
}
