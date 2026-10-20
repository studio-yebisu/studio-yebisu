// Ming Image 0.1 Design 作例の共有モジュール。
// ・保存済みの20ファイルを大きさとSHA-256で照合し、記録どうしの関係を確かめる（loadVerified）。
// ・作例ページと編集用ソースは、同じ図の部品（NODES・EDGES・PARTS）と線の形（edgeCurve）を使う。
// ・作例ページの初期化は body[data-app="ming-main"] のときだけ。編集用ソースが読み込んでも何も起きない。
// ブラウザーはモデルも公開デモのAPIも呼ばない。照合した元のバイトを表示・保存するだけ。

export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = 'cdae838a556246ae8b319302ce4c42a2a26a52b25eda1436aa552389320bac06';
export const MANIFEST_COUNT = 20;
export const CASE_ID = 'reading-club';
export const CASE_LABEL = '架空の読書会';
export const IMAGE_PATH = 'outputs/reading-club.png';

const BASE = new URL('./', import.meta.url);
const ORIGINAL_COMMIT = '3515cd7b1e3049fc517eed7d35020251cd06519a';
const SPACE_COMMIT = '367085c6a006004b1658ad3b7edbd498581a33b3';
const MODEL_META_SHA = 'c57c49689d12ef7d4e24a170014f1dc43d3ce258';
const ORIGINAL_BLOB = `https://github.com/inclusionAI/Ming-Image/blob/${ORIGINAL_COMMIT}/`;
const IMAGE_BYTES = 665402;
const IMAGE_SHA256 = '5042b961879f9f4c15a33cb8096edca258ec211822a317eeecda215c7866b607';
const SERVER_INFO = '1024 x 1024 RGBA in 9.9s - 12 steps, CFG 1.0';
const LITERALS = ['こもれび読書会', '2026.11.08 SUN 14:00–16:00', '小箱図書室', '架空のイベント'];
const LITERAL_IDS = ['headline', 'date', 'venue', 'qualifier'];
const EXCERPT_IDS = ['identity', 'separate-skills', 'requirements', 'fixed-revision', 'settings', 'attention'];
const RUNTIME_URLS = {
  'space-app': `https://huggingface.co/spaces/inclusionAI/ming-image-0-1-design-demo/blob/${SPACE_COMMIT}/app.py`,
  'space-pipeline': `https://huggingface.co/spaces/inclusionAI/ming-image-0-1-design-demo/blob/${SPACE_COMMIT}/ming/pipeline.py`,
  'free-quota': 'https://huggingface.co/docs/hub/spaces-zerogpu',
};

export class VerifyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerifyError';
  }
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
const asText = (bytes, path) => {
  try { return utf8.decode(bytes); } catch { throw new VerifyError(`${path} をUTF-8の文字として読めません`); }
};
const asJson = (bytes, path) => {
  try { return JSON.parse(asText(bytes, path)); } catch (e) {
    if (e instanceof VerifyError) throw e;
    throw new VerifyError(`${path} をJSONとして読めません`);
  }
};

export async function sha256Hex(bytes) {
  if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) {
    throw new VerifyError('SHA-256で照合するため、https か localhost で開いてください');
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

const safePath = (p) => typeof p === 'string' && p.length < 200 &&
  p.split('/').every((part) => /^[A-Za-z0-9_.-]+$/.test(part) && part !== '.' && part !== '..');

async function fetchBytes(path, signal) {
  let res;
  try {
    res = await fetch(new URL(path, BASE), { cache: 'no-store', credentials: 'same-origin', signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new VerifyError(`${path} を読み込めません（通信に失敗）`);
  }
  if (!res.ok) throw new VerifyError(`${path} を読み込めません（HTTP ${res.status}）`);
  return new Uint8Array(await res.arrayBuffer());
}

const same = (a, b) => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]));
};

const need = (ok, message) => { if (!ok) throw new VerifyError(message); };

export function readPngHeader(bytes) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  need(bytes.length > 33 && sig.every((v, i) => bytes[i] === v), 'PNGの署名が見つかりません');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  need(view.getUint32(8) === 13 && type === 'IHDR', 'PNGの先頭にIHDRがありません');
  return {
    width: view.getUint32(16), height: view.getUint32(20),
    bitDepth: bytes[24], colorType: bytes[25], interlace: bytes[28],
  };
}

// 保存済みの20ファイルを照合し、図と結果に使うデータを返す。どれか1つでも合わなければ VerifyError。
export async function loadVerified({ signal } = {}) {
  const manifestBytes = await fetchBytes(MANIFEST_PATH, signal);
  need(await sha256Hex(manifestBytes) === MANIFEST_SHA256, 'ファイル一覧（concept/manifest.json）のSHA-256が固定値と違います');
  const manifest = asJson(manifestBytes, MANIFEST_PATH);
  need(manifest?.schema === 'ming-design-manifest@1' && Array.isArray(manifest.files) &&
    manifest.files.length === MANIFEST_COUNT, `ファイル一覧の形式か件数（${MANIFEST_COUNT}件）が違います`);
  const seen = new Set();
  for (const f of manifest.files) {
    need(safePath(f?.path) && !seen.has(f.path) && Number.isInteger(f.bytes) && f.bytes >= 0 &&
      /^[0-9a-f]{64}$/.test(f.sha256 ?? ''), 'ファイル一覧に不正な行があります');
    seen.add(f.path);
  }
  const files = new Map();
  await Promise.all(manifest.files.map(async (f) => {
    const bytes = await fetchBytes(f.path, signal);
    need(bytes.length === f.bytes, `${f.path} の大きさが一覧と違います（${bytes.length} B）`);
    need(await sha256Hex(bytes) === f.sha256, `${f.path} のSHA-256が一覧と違います`);
    files.set(f.path, bytes);
  }));
  return checkRelations(manifest, files);
}

async function checkRelations(manifest, files) {
  const get = (p) => { need(files.has(p), `${p} が一覧にありません`); return files.get(p); };
  const facts = asJson(get('concept/facts.json'), 'concept/facts.json');
  need(facts.schema === 'ming-design-facts@1' && facts.case_id === 'ming-image-design-example' &&
    facts.editorial_parts === 6, 'facts.json の形式が違います');
  need(Array.isArray(facts.cases) && facts.cases.length === 1, 'facts.json の例は1件のはずです');
  const caseInfo = facts.cases[0];
  need(caseInfo.id === CASE_ID && caseInfo.label === CASE_LABEL && caseInfo.image === IMAGE_PATH, '例のIDか名前が違います');
  for (const key of ['image', 'request', 'summary', 'literal_review', 'alpha_check', 'server_info', 'source_prompt']) {
    need(files.has(caseInfo[key]), `例の ${key} が照合済みの一覧にありません`);
  }

  // 原典の6か所：同梱した固定版のファイルの該当行と、引用の文が完全に一致すること。
  need(Array.isArray(facts.excerpts) && facts.excerpts.length === 6 &&
    same(facts.excerpts.map((e) => e.id).sort(), [...EXCERPT_IDS].sort()), '原典の引用は6件のはずです');
  const excerpts = new Map();
  for (const ex of facts.excerpts) {
    need(ex.path.startsWith('vendor/ming/') && files.has(ex.path), `引用 ${ex.id} のファイルが照合済みではありません`);
    need(Number.isInteger(ex.line_start) && Number.isInteger(ex.line_end) && ex.line_start >= 1 && ex.line_end >= ex.line_start,
      `引用 ${ex.id} の行番号が不正です`);
    const lines = asText(get(ex.path), ex.path).split('\n');
    need(lines.slice(ex.line_start - 1, ex.line_end).join('\n') === ex.text, `引用 ${ex.id} が原典の該当行と一致しません`);
    need(ex.url === `${ORIGINAL_BLOB}${ex.path.slice('vendor/ming/'.length)}#L${ex.line_start}`, `引用 ${ex.id} のURLが固定版を指していません`);
    excerpts.set(ex.id, ex);
  }
  need(Array.isArray(facts.runtime_refs) && facts.runtime_refs.length === 3, '公開デモの参照は3件のはずです');
  const runtime = new Map();
  for (const ref of facts.runtime_refs) {
    need(RUNTIME_URLS[ref.id] === ref.url, `参照 ${ref.id} のURLが固定の値と違います`);
    runtime.set(ref.id, ref);
  }

  // 実行の記録・依頼・入力・出力の関係。
  const actual = facts.actual;
  need(actual?.status === 'completed' && actual.route?.space_commit_expected === SPACE_COMMIT &&
    actual.reference_original?.commit === ORIGINAL_COMMIT && actual.space_runtime_sha_stable === true, '実行の記録の版が違います');
  need(facts.reference?.model_metadata_observation?.sha === MODEL_META_SHA, 'モデルのメタデータの記録が違います');
  const summary = asJson(get(caseInfo.summary), caseInfo.summary);
  need(same(summary, actual), 'run-summary.json と facts.json の記録が一致しません');
  const request = asJson(get(caseInfo.request), caseInfo.request);
  need(request.id === CASE_ID && request.synthetic === true && request.jobs === 1 &&
    same(request.literal_strings, LITERALS) && same(actual.request.literal_strings, LITERALS) &&
    same(request.settings, actual.request.settings) && request.route?.space_commit === SPACE_COMMIT &&
    request.reference?.commit === ORIGINAL_COMMIT && request.outputs?.image === IMAGE_PATH, '依頼の内容が記録と一致しません');
  need(request.settings.steps === 12 && request.settings.guidance_scale === 1 && request.settings.seed === 20261020 &&
    request.settings.resolution === '1024 x 1024 (recommended)', '依頼の設定が違います');
  const promptText = asText(get(caseInfo.source_prompt), caseInfo.source_prompt);
  const sent = promptText.endsWith('\n') ? promptText.slice(0, -1) : promptText;
  const sentBytes = new TextEncoder().encode(sent);
  need(sent === actual.request.prompt && sentBytes.length === actual.request.prompt_bytes &&
    await sha256Hex(sentBytes) === actual.request.prompt_sha256, 'prompt.txt と送った文の記録が一致しません');
  const serverInfo = asText(get(caseInfo.server_info), caseInfo.server_info);
  need(serverInfo === SERVER_INFO && actual.image?.server_info === serverInfo, 'サーバーの報告が記録と一致しません');

  const imageBytes = get(IMAGE_PATH);
  const imageSha = await sha256Hex(imageBytes);
  const png = readPngHeader(imageBytes);
  need(imageBytes.length === IMAGE_BYTES && imageSha === IMAGE_SHA256 && actual.image.sha256 === imageSha &&
    actual.image.bytes === imageBytes.length, 'PNGの大きさかSHA-256が記録と違います');
  need(png.width === 1024 && png.height === 1024 && png.bitDepth === 8 && png.colorType === 6 &&
    actual.image.png_header?.width === png.width && actual.image.png_header?.color_type === png.colorType,
    'PNGのヘッダー（1024×1024・RGBA）が記録と違います');

  const alpha = asJson(get(caseInfo.alpha_check), caseInfo.alpha_check);
  need(same(alpha, facts.alpha) && alpha.width === png.width && alpha.height === png.height &&
    alpha.total_pixels === png.width * png.height &&
    alpha.fully_transparent_pixels + alpha.partially_transparent_pixels + alpha.fully_opaque_pixels === alpha.total_pixels &&
    alpha.alpha_min === 216 && alpha.alpha_max === 255 && alpha.fully_transparent_pixels === 0, 'αの数え方の記録が合いません');

  const literal = asJson(get(caseInfo.literal_review), caseInfo.literal_review);
  need(same(literal, facts.literal_review) && Array.isArray(literal.rows) && literal.rows.length === 4 &&
    literal.rows.every((r, i) => r.id === LITERAL_IDS[i] && r.expected === LITERALS[i]) &&
    literal.rows[2].status === 'review_required', '文字の読合せの記録が依頼と合いません');

  return { manifest, files, facts, caseInfo, request, summary, alpha, literal, serverInfo, promptText, png, imageSha, excerpts, runtime };
}

export const formatNumber = (n) => Number(n).toLocaleString('ja-JP');

// ---- 図の部品（作例ページと動画で共通） ----
// 6つのまとまりは説明のための整理で、公式の区分でも6体のAIでもない。
export const NODES = [
  { id: 'docs', part: 1, label: '原典の説明', sub: 'README 3515cd7' },
  { id: 'brief', part: 1, label: '架空の依頼', sub: '4つの文字列' },
  { id: 'author', part: 2, label: '作者AI 1体', sub: 'prompt・clientを書く' },
  { id: 'operator', part: 3, label: '制作担当', sub: '匿名で1回送る' },
  { id: 'space', part: 3, label: '公開デモ', sub: '別実装 367085c' },
  { id: 'tokens', part: 4, label: 'prompt + 256 query', sub: '文と、問いの枠' },
  { id: 'thinker', part: 4, label: 'thinker 1回', sub: 'BailingMoE-v2' },
  { id: 'connector', part: 4, label: 'query の道', sub: 'Qwen2 connector' },
  { id: 'direct', part: 4, label: '直接の道', sub: '3層・文言を運ぶ' },
  { id: 'noise', part: 5, label: 'ノイズ', sub: 'seed固定' },
  { id: 'dit', part: 5, label: 'flow 12回', sub: 'Z-Image・CFG 1' },
  { id: 'vae', part: 5, label: '4ch VAE', sub: 'RGBAの画像へ' },
  { id: 'png', part: 6, label: '実PNG', sub: '1024・RGBA' },
  { id: 'check', part: 6, label: '字形・αを確認', sub: '' },
  { id: 'use', part: 6, label: '元のまま保存', sub: '' },
];

export const EDGES = [
  { from: 'docs', to: 'author' }, { from: 'brief', to: 'author' },
  { from: 'author', to: 'operator' }, { from: 'operator', to: 'space' },
  { from: 'space', to: 'tokens' }, { from: 'tokens', to: 'thinker' },
  { from: 'thinker', to: 'connector', kind: 'query' }, { from: 'thinker', to: 'direct', kind: 'direct' },
  { from: 'connector', to: 'dit', kind: 'query' }, { from: 'direct', to: 'dit', kind: 'direct' },
  { from: 'noise', to: 'dit' }, { from: 'dit', to: 'vae' }, { from: 'vae', to: 'png' },
  { from: 'png', to: 'check' }, { from: 'check', to: 'use' },
];

export const MODEL_NODES = ['tokens', 'thinker', 'connector', 'direct', 'noise', 'dit', 'vae'];

export const PARTS = [
  {
    n: 1, title: '正体', excerpt: 'identity', nodes: ['docs', 'brief'], runtime: [],
    body: 'Ming Image 0.1 Designは、UI・ポスター・図解のような文字の多い絵を作る画像生成モデルと、手元で動かすPythonの手順です。SKILL.md・チャットAIのチーム・ホスト型の製品・編集できるデザイン形式ではありません。原典は同じシリーズの別モデルLayer（平らな画像を透明なレイヤーに分ける）も説明していますが、今回は使っていません。依頼は架空の読書会で、入れる文字は4つだけです。「6B」は公開された識別のラベルで、チェックポイントの容量を測った値ではありません。',
  },
  {
    n: 2, title: '作者AI', excerpt: 'separate-skills', nodes: ['author'], runtime: [],
    body: '作者AI（Claude Opus 5.5・1体）が原典を読み、英語のprompt・依頼のJSON・匿名で送るクライアント・実装メモを書きました。作者は送信も実行もしていません。原典が紹介するDesign Skill・PPT Skillは別のエージェントの手順で、ここでは動かしていません。',
  },
  {
    n: 3, title: '公開デモ', excerpt: 'requirements', nodes: ['operator', 'space'], runtime: ['space-app', 'free-quota'],
    body: '制作担当が別に、原典READMEのDemoリンクから移った無料の公開Space（inclusionAI/ming-image-0-1-design-demo @367085c）へ、匿名でPOSTを1回だけ送りました。トークン・Cookie・アカウント・課金はありません。このSpaceは独自のMingImagePipeline（vLLM-Omni PR #8021に準拠）で動き、原典のinfer.pyとは別の実装です。手元のディスクの空き（約1.75GB）が重み（約52.88GB）に足りず、GPUも別の作業中だったため、ローカルでは動かしていません。原典の「80GiBのGPU」は上流が検証した構成で、ほかの方法で動かないという証明ではありません。',
  },
  {
    n: 4, title: '読む・分ける', excerpt: 'attention', nodes: ['tokens', 'thinker', 'connector', 'direct'], runtime: ['space-pipeline'],
    body: 'promptのトークンの後ろに256個の学習済みの問い（query）の枠を足し、BailingMoE-v2のthinkerが1回だけ読みます。そこから性質の違う2本の条件が出ます。1本目はqueryの最後の状態で、proj_in→双方向のQwen2 connector→proj_outを通ります。2本目はpromptのトークン自身の状態を3つの層から集めた直接の投影で、描く文言を運びます。thinkerはモデルの部品で、作者AIとは別のものです。',
  },
  {
    n: 5, title: '描く', excerpt: 'settings', nodes: ['noise', 'dit', 'vae'], runtime: ['space-pipeline'],
    body: 'seed 20261020から最初のノイズを作り、Z-Imageのflow transformerが2本の条件を受けて12回更新します。CFG 1でも無効ではなく、正の条件と0にした負の条件の差を使います（正＋1×（正−負））。最後に4チャンネルのVAEが1024×1024のRGBA画像にします。',
  },
  {
    n: 6, title: '返る・確かめる', excerpt: 'fixed-revision', nodes: ['png', 'check', 'use'], runtime: [],
    body: '返ったのはPNG 1枚と、サーバーの1行の報告だけです。字形とα（透過の値）は制作担当が別の工程で確かめました。原典のCLIは--revisionで版を固定できますが、公開デモのローダーはrevisionを指定していないため、サーバーが実際に読み込んだ重みの版は確認できません。Hubのメタデータ c57c496 は前後で同じでしたが、実行した重みの証明ではありません。',
  },
];

export const STAGES = [
  {
    label: '①何か',
    caption: '文字入りの絵を描く画像生成モデル。文を1回読み、2本の条件でノイズから12回描く。',
    focus: ['docs', ...MODEL_NODES, 'png'],
  },
  {
    label: '②渡す',
    caption: '原典と架空の依頼→作者AI 1体が書く→制作担当が無料の公開デモへ匿名で1回送る。',
    focus: ['docs', 'brief', 'author', 'operator', 'space', 'tokens'],
  },
  {
    label: '③返る',
    caption: '実際のPNGが1枚返る。字形とαは別に確かめ、元のバイトのまま保存できる。',
    focus: ['dit', 'vae', 'png', 'check', 'use'],
  },
];

// 作例ページの図の配置（viewBox単位）。縦は320幅、横は960幅でそれぞれ組む。
export const PAGE_LAYOUTS = {
  narrow: {
    w: 320, h: 558, label: 13.5, sub: 11.5,
    frame: { x: 2, y: 176, w: 316, h: 298, labelX: 10, labelY: 191 },
    nodes: {
      docs: [6, 4, 148, 44], brief: [166, 4, 148, 44],
      author: [60, 62, 200, 44],
      operator: [6, 120, 148, 44], space: [166, 120, 148, 44],
      tokens: [40, 198, 240, 40], thinker: [40, 250, 240, 42],
      connector: [6, 306, 148, 44], direct: [166, 306, 148, 44],
      noise: [6, 364, 96, 44], dit: [114, 364, 200, 44],
      vae: [80, 420, 160, 42],
      png: [6, 486, 188, 68], check: [204, 486, 110, 32], use: [204, 522, 110, 32],
    },
  },
  wide: {
    w: 960, h: 380, label: 15, sub: 12.5,
    frame: { x: 386, y: 8, w: 410, h: 362, labelX: 398, labelY: 27 },
    nodes: {
      docs: [10, 24, 170, 46], brief: [10, 84, 170, 46],
      author: [200, 54, 170, 46],
      operator: [200, 150, 170, 46], space: [200, 240, 170, 46],
      tokens: [400, 40, 190, 42], thinker: [400, 100, 190, 46],
      connector: [400, 168, 180, 46], direct: [600, 168, 180, 46],
      noise: [400, 246, 130, 46], dit: [545, 246, 235, 46],
      vae: [545, 312, 235, 44],
      png: [812, 40, 140, 190], check: [812, 250, 140, 44], use: [812, 310, 140, 44],
    },
  },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 2つの箱を結ぶ3次ベジェ曲線。下へ流れるか、横へ流れるかを箱の位置から決める。
export function edgeCurve(a, b) {
  const below = b.y >= a.y + a.h - 2;
  if (below) {
    const sx = clamp(b.x + b.w / 2, a.x + 12, a.x + a.w - 12);
    const tx = clamp(sx, b.x + 12, b.x + b.w - 12);
    const y0 = a.y + a.h, y1 = b.y, d = Math.max(12, y1 - y0) / 2;
    return { p0: [sx, y0], c1: [sx, y0 + d], c2: [tx, y1 - d], p3: [tx, y1] };
  }
  const toRight = b.x >= a.x + a.w - 2;
  const sy = clamp(b.y + b.h / 2, a.y + 8, a.y + a.h - 8);
  const ty = clamp(sy, b.y + 8, b.y + b.h - 8);
  const x0 = toRight ? a.x + a.w : a.x, x1 = toRight ? b.x : b.x + b.w;
  const d = (x1 - x0) / 2;
  return { p0: [x0, sy], c1: [x0 + d, sy], c2: [x1 - d, ty], p3: [x1, ty] };
}

export function bezierAt(c, u) {
  const v = 1 - u;
  const a = v * v * v, b = 3 * v * v * u, d = 3 * v * u * u, e = u * u * u;
  return [a * c.p0[0] + b * c.c1[0] + d * c.c2[0] + e * c.p3[0], a * c.p0[1] + b * c.c1[1] + d * c.c2[1] + e * c.p3[1]];
}

const box = (arr) => ({ x: arr[0], y: arr[1], w: arr[2], h: arr[3] });

// ---- 作例ページ ----

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs, parent) => {
  const n = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
  if (parent) parent.append(n);
  return n;
};

function buildGraph(svg, layoutName) {
  const L = PAGE_LAYOUTS[layoutName];
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
  svg.dataset.layout = layoutName;
  const title = svgEl('title', { id: 'graph-title' }, svg);
  title.textContent = 'Ming Image 0.1 Design の構造図';
  const desc = svgEl('desc', { id: 'graph-desc' }, svg);
  desc.textContent = '原典の説明と架空の依頼から、作者AI 1体がpromptとクライアントを書き、制作担当が無料の公開デモへ匿名で1回送る。' +
    'モデルの中では、promptと256個のqueryの枠をthinkerが1回読み、queryの道（connector）と直接の道（3層・文言を運ぶ）の2本の条件に分かれる。' +
    '2本の条件とseed固定のノイズがflow transformerに入り12回更新され、4チャンネルのVAEが実際のPNGにする。字形とαは別に確かめ、元のまま保存する。';
  const defs = svgEl('defs', {}, svg);
  for (const [id, cls] of [['ar-base', 'base'], ['ar-query', 'query'], ['ar-direct', 'direct']]) {
    const m = svgEl('marker', { id, viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
    svgEl('path', { d: 'M0,0 L8,4 L0,8 z', class: `ah ah-${cls}` }, m);
  }
  const F = L.frame;
  svgEl('rect', { x: F.x, y: F.y, width: F.w, height: F.h, rx: 12, class: 'g-frame' }, svg);
  const fl = svgEl('text', { x: F.labelX, y: F.labelY, class: 'g-frame-label' }, svg);
  fl.textContent = 'モデルの中（公開デモのソースに基づく説明）';

  const edges = svgEl('g', { class: 'g-edges' }, svg);
  for (const e of EDGES) {
    const c = edgeCurve(box(L.nodes[e.from]), box(L.nodes[e.to]));
    const kind = e.kind || 'base';
    svgEl('path', {
      d: `M${c.p0} C${c.c1} ${c.c2} ${c.p3}`, class: `g-edge ${kind}`, 'marker-end': `url(#ar-${kind})`,
      'data-from': e.from, 'data-to': e.to,
    }, edges);
  }
  const nodes = svgEl('g', { class: 'g-nodes' }, svg);
  for (const n of NODES) {
    const b = box(L.nodes[n.id]);
    const g = svgEl('g', { class: 'g-node', 'data-id': n.id, 'data-part': n.part }, nodes);
    svgEl('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, class: 'box' }, g);
    svgEl('rect', { x: b.x + 5, y: b.y + 5, width: 15, height: 15, rx: 3, class: 'badge' }, g);
    const bn = svgEl('text', { x: b.x + 12.5, y: b.y + 16.5, class: 'badge-n' }, g);
    bn.textContent = String(n.part);
    const tall = b.h > 100;
    const oneLine = !n.sub;
    const ly = tall ? b.y + 22 : oneLine ? b.y + b.h / 2 + L.label * 0.36 : b.y + b.h / 2 - 2;
    const lt = svgEl('text', { x: b.x + 25, y: ly, class: 'n-label', 'font-size': L.label }, g);
    lt.textContent = n.id === 'check' && layoutName === 'narrow' ? '字形とα' : n.label;
    if (n.sub) {
      const st = svgEl('text', { x: tall ? b.x + 8 : b.x + 25, y: tall ? b.y + 42 : ly + L.sub + 3, class: 'n-sub', 'font-size': L.sub }, g);
      st.textContent = n.sub;
    }
    if (n.id === 'png') {
      const size = tall ? b.w - 20 : b.h - 10;
      const ix = tall ? b.x + 10 : b.x + b.w - size - 5;
      const iy = tall ? b.y + b.h - size - 10 : b.y + 5;
      svgEl('rect', { x: ix - 1, y: iy - 1, width: size + 2, height: size + 2, class: 'thumb-edge' }, g);
      svgEl('image', { x: ix, y: iy, width: size, height: size, class: 'thumb', preserveAspectRatio: 'xMidYMid meet' }, g);
    }
  }
}

const STATUS_LABEL = { readable_visual_only: '目視で読める', review_required: '要確認' };
const SAVES = {
  png: { path: IMAGE_PATH, type: 'image/png' },
  request: { path: 'inputs/request.json', type: 'application/json' },
  summary: { path: 'outputs/run-summary.json', type: 'application/json' },
  prompt: { path: 'inputs/prompt.txt', type: 'text/plain;charset=utf-8' },
  server: { path: 'outputs/server-info.txt', type: 'text/plain;charset=utf-8' },
  literal: { path: 'outputs/literal-review.json', type: 'application/json' },
  alpha: { path: 'outputs/alpha-check.json', type: 'application/json' },
};
const SECTION_IDS = new Set(['result', 'parts', 'limits', 'files']);

export function initMain() {
  const $ = (s) => document.querySelector(s);
  const body = document.body;
  const els = {
    svg: $('#graph'), status: $('#status'), statusText: $('#status-text'), retry: $('#retry'), caption: $('#stage-caption'),
    hashNote: $('#hash-note'), poster: $('#poster'), frame: $('#frame'), zoom: $('#zoom'), zoomOut: $('#zoom-out'),
    zoomReset: $('#zoom-reset'), literal: $('#literal'), alphaDetail: $('#alpha-detail'), settings: $('#settings'),
    saveStatus: $('#save-status'), partCard: $('#part-card'), files: $('#file-list'),
  };
  const stageButtons = [...document.querySelectorAll('button[data-stage]')];
  const partButtons = [...document.querySelectorAll('button[data-part]')];
  const bgButtons = [...document.querySelectorAll('button[data-bg]')];
  const saveButtons = [...document.querySelectorAll('button[data-save]')];
  const actions = [...stageButtons, ...partButtons, ...bgButtons, ...saveButtons, els.zoom, els.zoomReset];
  const wideQuery = window.matchMedia('(min-width: 860px)');
  const state = { token: 0, ctrl: null, model: null, imageUrl: '', stage: 0, part: 0, bg: 'white', saveUrls: new Set(), timers: new Set() };

  const thumb = () => els.svg.querySelector('image.thumb');

  const applyFocus = () => {
    const focus = new Set(STAGES[state.stage].focus);
    const partNodes = new Set(state.model ? PARTS[state.part].nodes : []);
    els.svg.querySelectorAll('.g-node').forEach((g) => {
      g.classList.toggle('on', focus.has(g.dataset.id));
      g.classList.toggle('part-on', partNodes.has(g.dataset.id));
    });
    els.svg.querySelectorAll('.g-edge').forEach((p) => p.classList.toggle('on', focus.has(p.dataset.from) && focus.has(p.dataset.to)));
    stageButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === state.stage)));
    els.caption.textContent = STAGES[state.stage].caption;
  };

  const drawGraph = () => {
    buildGraph(els.svg, wideQuery.matches ? 'wide' : 'narrow');
    if (state.imageUrl) thumb()?.setAttribute('href', state.imageUrl);
    applyFocus();
  };

  const readHash = () => {
    const raw = location.hash.slice(1);
    if (!raw) return '';
    let id;
    try { id = decodeURIComponent(raw); } catch { return '指定された例の書き方を読めないため、架空の読書会を表示しています。'; }
    if (id === CASE_ID || SECTION_IDS.has(id)) return '';
    return `指定された例「${id.slice(0, 40)}」は見つからないため、架空の読書会を表示しています。`;
  };
  const showHash = () => {
    const note = readHash();
    els.hashNote.textContent = note;
    els.hashNote.hidden = !note;
  };

  const forgetUrls = () => {
    state.timers.forEach((t) => clearTimeout(t));
    state.timers.clear();
    state.saveUrls.forEach((u) => URL.revokeObjectURL(u));
    state.saveUrls.clear();
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = '';
  };

  const reset = (mode, reason = '') => {
    forgetUrls();
    state.model = null;
    els.poster.removeAttribute('src');
    thumb()?.removeAttribute('href');
    for (const el of [els.literal, els.alphaDetail, els.settings, els.partCard, els.files]) el.replaceChildren();
    els.saveStatus.textContent = '';
    actions.forEach((a) => { a.disabled = true; });
    body.dataset.state = mode;
    els.status.hidden = false;
    els.retry.hidden = mode !== 'failed';
    els.statusText.textContent = mode === 'failed'
      ? `確認できなかったため、画像・保存・リンクを止めました。理由：${reason}`
      : `保存済みの${MANIFEST_COUNT}ファイルを、大きさとSHA-256で確かめています…`;
    applyFocus();
  };

  const row = (dl, term, value, note) => {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    if (note) {
      const s = document.createElement('small');
      s.textContent = note;
      dd.append(s);
    }
    dl.append(dt, dd);
  };

  const fillResult = (m) => {
    for (const r of m.literal.rows) {
      const li = document.createElement('li');
      li.className = r.status === 'review_required' ? 'warn' : 'ok';
      const exp = document.createElement('span');
      exp.className = 'exp';
      exp.textContent = r.expected;
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = STATUS_LABEL[r.status] || '未確認';
      const obs = document.createElement('p');
      obs.className = 'obs';
      obs.textContent = r.observed;
      li.append(exp, chip, obs);
      if (r.status === 'review_required') {
        const note = document.createElement('p');
        note.className = 'venue-note';
        note.textContent = '会場の字形は要確認';
        li.append(note);
      }
      els.literal.append(li);
    }
    const a = m.alpha;
    row(els.alphaDetail, 'αの範囲', `${a.alpha_min}〜${a.alpha_max}`);
    row(els.alphaDetail, '透明（α=0）', `${formatNumber(a.fully_transparent_pixels)} 画素`);
    row(els.alphaDetail, '半透明（1〜254）', `${formatNumber(a.partially_transparent_pixels)} 画素`);
    row(els.alphaDetail, '不透明（255）', `${formatNumber(a.fully_opaque_pixels)} 画素`);
    row(els.alphaDetail, '合計', `${formatNumber(a.total_pixels)} 画素（${a.width}×${a.height}）`);
    row(els.alphaDetail, '数え方', '制作担当が元のバイトをPillowで読み、数えただけ。再保存・補正はしていません。');

    const s = m.request.settings, act = m.summary;
    row(els.settings, '大きさ', s.resolution, `返ったPNGは ${m.png.width}×${m.png.height}・RGBA・${formatNumber(act.image.bytes)} B`);
    row(els.settings, '反復', `${s.steps} 回`);
    row(els.settings, 'CFG', String(s.guidance_scale.toFixed(1)), '無効ではなく、正の条件と負の条件の差を使う値');
    row(els.settings, 'seed', String(s.seed));
    row(els.settings, 'サーバーの報告', m.serverInfo, 'サーバーの申告。独立したGPUの計測ではありません');
    row(els.settings, '時間', `要求から返却まで ${act.job_wall_seconds} 秒・全体 ${act.total_wall_seconds} 秒`,
      'キュー・GPUの割り当て・通信を含む手元の時計。内部の時間は測っていません');
    row(els.settings, '送り先', `${act.route.space} @${act.route.space_commit_expected.slice(0, 7)}`, '匿名で1回。原典のinfer.pyとは別の実装');
    row(els.settings, '重みの版', '未確認', `ローダーはrevisionを指定していません。Hubのメタデータ ${MODEL_META_SHA.slice(0, 7)} は前後で同じでした`);

    for (const f of m.manifest.files) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = f.path;
      link.textContent = f.path;
      const size = document.createElement('span');
      size.textContent = ` ${formatNumber(f.bytes)} B`;
      li.append(link, size);
      els.files.append(li);
    }
  };

  const fillPart = () => {
    const m = state.model;
    partButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.part) === state.part)));
    els.partCard.replaceChildren();
    if (!m) return;
    const p = PARTS[state.part];
    const ex = m.excerpts.get(p.excerpt);
    const h = document.createElement('h3');
    h.textContent = `${p.n}. ${p.title}`;
    const text = document.createElement('p');
    text.textContent = p.body;
    const quote = document.createElement('figure');
    quote.className = 'excerpt';
    const cap = document.createElement('figcaption');
    cap.textContent = `原典の引用：${ex.label}（${ex.path} ${ex.line_start}–${ex.line_end}行）`;
    const pre = document.createElement('pre');
    pre.textContent = ex.text;
    const link = document.createElement('a');
    link.href = ex.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '原典の該当行を開く（固定版 3515cd7・参照のみで、実行の証拠ではありません）';
    const local = document.createElement('a');
    local.href = ex.path;
    local.textContent = '同梱した原文を開く';
    quote.append(cap, pre, link, document.createTextNode(' ／ '), local);
    els.partCard.append(h, text, quote);
    if (p.runtime.length) {
      const sub = document.createElement('p');
      sub.className = 'runtime-h';
      sub.textContent = '実際に動いたのは別の実装（公開デモ Space @367085c）・無料枠の説明';
      const ul = document.createElement('ul');
      ul.className = 'runtime';
      for (const id of p.runtime) {
        const ref = m.runtime.get(id);
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = ref.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = ref.label;
        li.append(a);
        ul.append(li);
      }
      els.partCard.append(sub, ul);
    }
    applyFocus();
  };

  const setBg = (bg) => {
    state.bg = bg;
    els.frame.classList.remove('bg-white', 'bg-green', 'bg-checker');
    els.frame.classList.add(`bg-${bg}`);
    bgButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bg === bg)));
  };

  const setZoom = (z) => {
    const v = clamp(Number(z) || 100, 100, 400);
    els.zoom.value = String(v);
    els.zoomOut.textContent = `${v}%`;
    els.poster.style.width = `${v}%`;
  };

  const save = (key) => {
    const m = state.model;
    const spec = SAVES[key];
    if (!m || !spec || body.dataset.state !== 'ready') return;
    const bytes = m.files.get(spec.path);
    const name = spec.path.split('/').pop();
    const url = URL.createObjectURL(new Blob([bytes], { type: spec.type }));
    state.saveUrls.add(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      state.saveUrls.delete(url);
      state.timers.delete(timer);
    }, 30000);
    state.timers.add(timer);
    els.saveStatus.textContent = `${name}（元のバイトのまま）の保存をブラウザーに依頼しました。保存できたかはブラウザーの表示で確かめてください。`;
  };

  const load = async () => {
    const token = ++state.token;
    state.ctrl?.abort();
    const ctrl = new AbortController();
    state.ctrl = ctrl;
    reset('loading');
    try {
      const model = await loadVerified({ signal: ctrl.signal });
      if (token !== state.token) return;
      const url = URL.createObjectURL(new Blob([model.files.get(IMAGE_PATH)], { type: 'image/png' }));
      state.imageUrl = url;
      els.poster.src = url;
      try { await els.poster.decode(); } catch { throw new VerifyError('PNGを画像として表示できません'); }
      if (token !== state.token) return;
      state.model = model;
      thumb()?.setAttribute('href', url);
      fillResult(model);
      fillPart();
      actions.forEach((a) => { a.disabled = false; });
      body.dataset.state = 'ready';
      els.retry.hidden = true;
      els.status.hidden = true;
      els.statusText.textContent = '';
      applyFocus();
    } catch (e) {
      if (token !== state.token || e?.name === 'AbortError') return;
      reset('failed', e instanceof VerifyError ? e.message : '予期しない理由で確認を終えられませんでした');
    }
  };

  stageButtons.forEach((b) => b.addEventListener('click', () => { state.stage = Number(b.dataset.stage); applyFocus(); }));
  partButtons.forEach((b) => b.addEventListener('click', () => { state.part = Number(b.dataset.part); fillPart(); }));
  bgButtons.forEach((b) => b.addEventListener('click', () => setBg(b.dataset.bg)));
  saveButtons.forEach((b) => b.addEventListener('click', () => save(b.dataset.save)));
  els.zoom.addEventListener('input', () => setZoom(els.zoom.value));
  els.zoomReset.addEventListener('click', () => { setZoom(100); els.frame.scrollTo(0, 0); });
  els.retry.addEventListener('click', () => load());
  wideQuery.addEventListener('change', drawGraph);
  window.addEventListener('hashchange', showHash);

  drawGraph();
  setBg('white');
  setZoom(100);
  showHash();
  load();
}

if (typeof document !== 'undefined' && document.body?.dataset.app === 'ming-main') initMain();
