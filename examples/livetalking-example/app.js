// LiveTalking 作例の共通部：保存済みファイルの照合、構造図の配置と描画、作例ページの初期化。
// video/main.js と video/draw.js も同じ関数を読み込む。ページの初期化は body[data-app="livetalking-main"] のときだけ動く。
// ブラウザーでは推論・合成・エンコード・音声の生成をしない。固定された実ファイルを確かめて見せ、保存をブラウザーに渡すだけ。

export const ROOT = new URL('./', import.meta.url);
export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = '6ccfdc017254734829b38531c681633771499ae5981518e819c434df163e09c8';
export const MANIFEST_COUNT = 63;
export const CASE_IDS = ['default', 'second'];
export const SOURCE_REPOSITORY = 'lipku/LiveTalking';
export const SOURCE_COMMIT = 'eaa2b91559a5c2ed6127e17728efd52b7c407a0d';
export const REPO_BLOB = `https://github.com/${SOURCE_REPOSITORY}/blob/${SOURCE_COMMIT}/`;

const REF_IDS = ['registry', 'audio-chunks', 'whisper-features', 'mask-upper-kept', 'paired-latent', 'unet', 'frame-audio-pair', 'paste-and-watermark'];
const PART_REFS = [['registry'], ['audio-chunks', 'whisper-features'], ['mask-upper-kept', 'paired-latent'], ['unet'], ['frame-audio-pair'], ['paste-and-watermark']];
const FULL_CHECKOUT = 177;
const SELECTED_SOURCES = 27;
const RUNNER_PATHS = 23;
const BBOX = [100, 40, 420, 360];
const SEED = 20261020;
const CHUNK = 320;
const MODEL_REVISIONS = {
  'TMElyralab/MuseTalk': '2bcb936e2fddb4d86db4c62fd45b387d0c061571',
  'stabilityai/sd-vae-ft-mse': '31f26fdeee1355a5c34592e401dd41e45d25a493',
  'openai/whisper-tiny': '169d4a4341b33bc18d8881c4b69c2e104e1cc0af',
};
const MODEL_CARDS = {
  'vendor/model-cards/musetalk-model-card.md': 'musetalkV15/README.md',
  'vendor/model-cards/musetalk-LICENSE.txt': 'musetalkV15/LICENSE.txt',
  'vendor/model-cards/sd-vae-model-card.md': 'sd-vae/README.md',
  'vendor/model-cards/whisper-model-card.md': 'whisper/README.md',
};
const REQUIRED_PATHS = [
  'concept/facts.json', 'outputs/results.json', 'inputs/jobs.json', 'inputs/prepared/preparation.json',
  'inputs/portrait.png', 'inputs/prepared/face256.png', 'inputs/prepared/mask320.png',
  'inputs/prepared/face256-upper-half-masked.png', 'UPSTREAM.json', 'SOURCE-NOTES.md',
  'run_example.py', 'prepare_input.py', 'vendor/livetalking/README.md', 'vendor/livetalking/LICENSE',
];

// 6部品の短い意味（説明のための整理で、原典の区分ではない）。
export const PART_MEANING = {
  1: 'LiveTalkingは、名前で部品（声の入力・アバター・音声合成・出力口）を作ってつなぐPythonの枠組みです。1つのAIでも、SKILL.mdでもありません。',
  2: '渡したWAVを原典が16kHzに変換し、320サンプル＝20msの片に分けます。Whisperは符号器だけが動き、文字起こしはしません。',
  3: '同じ顔の1枚から、下半分を黒くした画像と全体の画像をVAEで1回ずつ符号化し、つないだ1つの潜在（1×8×32×32）を2件で使い回します。',
  4: '潜在と声の特徴がU-Netに入り、timestep 0 で1回だけ計算して、VAEの復号器が顔の部分の画像を返します。繰り返しの拡散サンプリングはありません。',
  5: '予測した顔の部分と、生の音声2片（40ms）を1組にして結果の待ち行列へ入れます。貼り戻しはこの後です。',
  6: 'process_framesが、音の入力がないコマは元の画像を、あるコマは貼り戻しを選び、透かしを描いて、画像と2片の音を出力口へ渡します。',
};

const REF_NOTE = {
  registry: '部品を名前で作る仕組み。LiveTalkingは部品をつなぐ枠組みです。',
  'audio-chunks': '渡した音声を320サンプル（16kHzで20ms）ずつ区切ります。音声認識ではありません。',
  'whisper-features': 'Whisperの符号器の隠れ状態だけを取り出します。文字への書き起こし（復号器）は動きません。',
  'mask-upper-kept': '上半分を1、下半分を0にする原典のマスクです。下半分が黒くなります（診断PNGの保存名 upper-half-masked は逆の言い方のまま保全）。',
  'paired-latent': '下半分を隠した顔と全体の顔の潜在をつなぎ、8チャンネルにします。今回は1回だけ作り、2件で再利用しました。',
  unet: 'timestep 0 で U-Net を1回呼び、VAEで復号して返します。繰り返しのサンプラーはありません。',
  'frame-audio-pair': '予測した顔と生の音声2片を組にして待ち行列へ入れます。貼り戻しと透かしはこの後の process_frames です。',
  'paste-and-watermark': '貼り戻し（または元画像）に「LiveTalking」の透かしを描き、画像と2片の音を出力口へ渡します。',
};

export class VerifyError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'VerifyError';
    this.detail = detail || message;
  }
}

function fail(message, detail) {
  throw new VerifyError(message, detail);
}

/* ---------- 読み込みと照合 ---------- */

async function sha256Hex(buf) {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchBytes(path) {
  let res;
  try {
    res = await fetch(new URL(path, ROOT), { cache: 'no-store' });
  } catch {
    fail('ファイルを読めません', `${path} を取得できませんでした`);
  }
  if (!res.ok) fail('ファイルを読めません', `${path}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

function decodeText(buf, path) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    fail('記録を読めません', `${path} を UTF-8 として読めません`);
  }
}

function parseJson(buf, path) {
  try {
    return JSON.parse(decodeText(buf, path));
  } catch (e) {
    if (e instanceof VerifyError) throw e;
    fail('記録を読めません', `${path} を JSON として読めません`);
  }
}

// キーの並びに依存しない比較。
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

function same(a, b, detail) {
  if (!deepEqual(a, b)) fail('記録どうしが一致しません', detail);
}

function check(cond, detail) {
  if (!cond) fail('記録どうしが一致しません', detail);
}

async function pool(items, size, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

function checkManifest(m) {
  check(m && m.schema === 'livetalking-manifest@1', 'concept/manifest.json の schema が違います');
  check(Array.isArray(m.files) && m.files.length === MANIFEST_COUNT, `concept/manifest.json のファイル数が ${MANIFEST_COUNT} ではありません`);
  const seen = new Set();
  for (const a of m.files) {
    const ok = a && typeof a.path === 'string' && /^[A-Za-z0-9._/-]+$/.test(a.path) &&
      !a.path.startsWith('/') && !a.path.split('/').includes('..') &&
      Number.isInteger(a.bytes) && a.bytes >= 0 && /^[0-9a-f]{64}$/.test(a.sha256);
    check(ok, `concept/manifest.json の項目の形が違います: ${a && a.path}`);
    check(!seen.has(a.path), `concept/manifest.json に重複があります: ${a.path}`);
    seen.add(a.path);
  }
  for (const p of REQUIRED_PATHS) check(seen.has(p), `concept/manifest.json に ${p} がありません`);
}

// MP4 の箱を読み、トラックの種類・寸法・長さ・サンプル数を取り出す（デコードはしない）。
function readBoxes(view, start, end, path) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = view.getUint32(p);
    const type = String.fromCharCode(view.getUint8(p + 4), view.getUint8(p + 5), view.getUint8(p + 6), view.getUint8(p + 7));
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(p + 8));
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header || p + size > end) fail('動画の形が記録と違います', `${path}: MP4 の箱 ${type} が壊れています`);
    out.push({ type, start: p, body: p + header, end: p + size });
    p += size;
  }
  if (p !== end) fail('動画の形が記録と違います', `${path}: MP4 の末尾が揃っていません`);
  return out;
}

function child(view, box, type, path) {
  return readBoxes(view, box.body, box.end, path).find((b) => b.type === type);
}

export function parseMp4(buf, path) {
  const view = new DataView(buf);
  const top = readBoxes(view, 0, buf.byteLength, path);
  const moov = top.find((b) => b.type === 'moov');
  if (!moov) fail('動画の形が記録と違います', `${path}: moov がありません`);
  const tracks = [];
  for (const trak of readBoxes(view, moov.body, moov.end, path).filter((b) => b.type === 'trak')) {
    const tkhd = child(view, trak, 'tkhd', path);
    const mdia = child(view, trak, 'mdia', path);
    if (!tkhd || !mdia) fail('動画の形が記録と違います', `${path}: trak の中身が足りません`);
    const mdhd = child(view, mdia, 'mdhd', path);
    const hdlr = child(view, mdia, 'hdlr', path);
    const minf = child(view, mdia, 'minf', path);
    const stbl = minf && child(view, minf, 'stbl', path);
    const stsz = stbl && child(view, stbl, 'stsz', path);
    if (!mdhd || !hdlr || !stsz) fail('動画の形が記録と違います', `${path}: mdhd・hdlr・stsz が足りません`);
    const v = view.getUint8(mdhd.body);
    const timescale = v === 1 ? view.getUint32(mdhd.body + 20) : view.getUint32(mdhd.body + 12);
    const duration = v === 1 ? Number(view.getBigUint64(mdhd.body + 24)) : view.getUint32(mdhd.body + 16);
    tracks.push({
      handler: String.fromCharCode(...new Uint8Array(buf, hdlr.body + 8, 4)),
      width: view.getUint32(tkhd.end - 8) / 65536,
      height: view.getUint32(tkhd.end - 4) / 65536,
      seconds: timescale ? duration / timescale : NaN,
      samples: view.getUint32(stsz.body + 8),
    });
  }
  return { topTypes: top.map((b) => b.type), tracks };
}

export function parseWav(buf, path) {
  const view = new DataView(buf);
  const tag = (p) => String.fromCharCode(view.getUint8(p), view.getUint8(p + 1), view.getUint8(p + 2), view.getUint8(p + 3));
  if (buf.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') fail('音声の形が記録と違います', `${path} は WAV ではありません`);
  let p = 12;
  let fmt = null;
  let data = null;
  while (p + 8 <= buf.byteLength) {
    const id = tag(p);
    const size = view.getUint32(p + 4, true);
    const body = p + 8;
    if (body + size > buf.byteLength) fail('音声の形が記録と違います', `${path}: ${id} が壊れています`);
    if (id === 'fmt ') {
      fmt = {
        format: view.getUint16(body, true), channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true), bits: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      data = { bytes: size };
    }
    p = body + size + (size % 2);
  }
  if (!fmt || !data) fail('音声の形が記録と違います', `${path} に fmt か data がありません`);
  const frameBytes = (fmt.channels * fmt.bits) / 8;
  if (!(fmt.format === 1 || fmt.format === 0xfffe) || !frameBytes || data.bytes % frameBytes) {
    fail('音声の形が記録と違います', `${path} は整数PCMの WAV ではありません`);
  }
  return { ...fmt, frames: data.bytes / frameBytes };
}

function pngHeader(buf, path) {
  const b = new Uint8Array(buf);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const type = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (b.length < 33 || sig.some((v, i) => b[i] !== v) || type !== 'IHDR') fail('画像の形が記録と違います', `${path} は PNG ではありません`);
  const view = new DataView(buf);
  return { width: view.getUint32(16), height: view.getUint32(20), bitDepth: b[24], colorType: b[25] };
}

function checkPng(files, path, w, h) {
  const p = pngHeader(files.get(path), path);
  check(p.width === w && p.height === h && p.colorType === 2 && p.bitDepth === 8, `${path} が ${w}×${h} の8bit RGB PNG ではありません`);
}

function checkBins(wf, label) {
  check(wf && Array.isArray(wf.min_max_bins) && wf.min_max_bins.length === wf.bins && wf.bins > 0 &&
    wf.min_max_bins.every((v) => Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]) &&
      v[0] >= -1 && v[0] <= v[1] && v[1] <= 1), `${label} の波形の記録の形が違います`);
}

function crossCheck(manifest, files) {
  const sha = new Map(manifest.files.map((a) => [a.path, a.sha256]));
  const size = new Map(manifest.files.map((a) => [a.path, a.bytes]));
  const json = (p) => parseJson(files.get(p), p);
  const listed = (p, h, b, label) => {
    check(sha.has(p), `${label}: ${p} が一覧にありません`);
    check(sha.get(p) === h, `${label}: ${p} の SHA-256 が一覧と違います`);
    if (b !== undefined) check(size.get(p) === b, `${label}: ${p} の大きさが一覧と違います`);
  };

  const facts = json('concept/facts.json');
  const results = json('outputs/results.json');
  const jobs = json('inputs/jobs.json');
  const prep = json('inputs/prepared/preparation.json');
  const upstream = json('UPSTREAM.json');

  // 原典：固定コミット・選んだ27ファイル・ランナーが照合した23パス
  check(facts.schema === 'livetalking-actual-facts@1' && facts.case_id === 'livetalking-example', 'concept/facts.json の schema が違います');
  check(facts.source_commit === SOURCE_COMMIT, 'facts の固定コミットが違います');
  check(upstream.repository === SOURCE_REPOSITORY && upstream.commit === SOURCE_COMMIT && upstream.license === 'Apache-2.0',
    'UPSTREAM.json の原典が違います');
  check(upstream.full_checkout_raw_bytes_verified === FULL_CHECKOUT && upstream.selected_count === SELECTED_SOURCES &&
    Array.isArray(upstream.selected_official_files) && upstream.selected_official_files.length === SELECTED_SOURCES &&
    upstream.required_runner_paths_in_selected_subset === RUNNER_PATHS && upstream.actual_execution_used_full_checkout === true &&
    upstream.selected_subset_executed_independently === false && upstream.weights_and_dependencies_separate === true,
    'UPSTREAM.json の範囲の記録が想定と違います');
  for (const f of upstream.selected_official_files) listed(`vendor/livetalking/${f.path}`, f.sha256, f.bytes, 'UPSTREAM.json');

  check(results.schema === 'studio-yebisu/livetalking-example/results@1' && results.status === 'completed', 'outputs/results.json の schema が違います');
  check(results.source.repository === SOURCE_REPOSITORY && results.source.commit === SOURCE_COMMIT &&
    results.source.layout === 'full checkout' && results.source.source_modified === false, 'results の原典の記録が違います');
  const verified = results.source.verified_files_sha256;
  check(Object.keys(verified).length === RUNNER_PATHS, `ランナーが照合した原典が ${RUNNER_PATHS} パスではありません`);
  for (const [p, h] of Object.entries(verified)) listed(`vendor/livetalking/${p}`, h, undefined, 'ランナーが照合した原典');
  check(results.runner.sha256 === sha.get('run_example.py') && results.runner.jobs_json_sha256 === sha.get('inputs/jobs.json') &&
    results.runner.retries === 0, 'ランナーと jobs の記録が一覧と違います');
  check(/^none/.test(results.scope.source_patching), '原典を改変しない記録になっていません');
  check(/^original EdgeTTS constructed and idle/.test(results.scope.tts), 'TTSを使っていない記録になっていません');

  // モデル：固定した3つ、配布しない
  const mf = facts.models.files;
  check(Array.isArray(mf) && mf.length === 11 && facts.models.redistributed === false, 'モデルの記録が11ファイル・非配布ではありません');
  for (const f of mf) check(MODEL_REVISIONS[f.repository] === f.revision && /^[0-9a-f]{64}$/.test(f.sha256), `モデル ${f.local} の固定版が違います`);
  same(mf.map((f) => f.sha256), results.models.files.map((f) => f.sha256), 'モデルの記録が facts と results で違います');
  for (const [card, local] of Object.entries(MODEL_CARDS)) {
    const f = mf.find((x) => x.local === local);
    check(f && sha.get(card) === f.sha256 && size.get(card) === f.bytes, `${card} が固定版のモデルカードと一致しません`);
  }
  const rt = facts.model_runtime;
  check(deepEqual(rt.timesteps.values, [0]) && /^none/.test(rt.diffusion_sampler_loop), 'U-Net の呼び方の記録が timestep 0 の1回ではありません');
  same(rt.timesteps, results.model_runtime.timesteps, 'timesteps の記録が一致しません');

  // 入力：同じ肖像1枚・2つの既存WAV・手動の枠とマスク
  const pt = facts.inputs.portrait;
  const portraitPath = `inputs/${pt.file}`;
  listed(portraitPath, pt.sha256, pt.bytes, 'facts.inputs.portrait');
  same(facts.inputs, results.inputs, '入力の記録が facts と results で違います');
  checkPng(files, portraitPath, pt.width, pt.height);
  check(pt.width === 512 && pt.height === 512, '肖像が512×512ではありません');
  const fp = facts.preparation;
  const paths = {
    portrait: portraitPath,
    face: 'inputs/prepared/face256.png',
    masked: 'inputs/prepared/face256-upper-half-masked.png',
    mask: 'inputs/prepared/mask320.png',
  };
  listed('inputs/prepared/preparation.json', fp.preparation_json.sha256, fp.preparation_json.bytes, 'facts.preparation');
  listed(paths.face, fp.face256.sha256, fp.face256.bytes, 'facts.preparation');
  listed(paths.mask, fp.mask320.sha256, fp.mask320.bytes, 'facts.preparation');
  listed(paths.masked, fp.diagnostic_upper_half_masked.sha256, fp.diagnostic_upper_half_masked.bytes, 'facts.preparation');
  check(facts.input_images.face === paths.face && facts.input_images.blend_mask === paths.mask &&
    facts.input_images.vae_masked_face === paths.masked && facts.input_images.portrait === paths.portrait, '画像の置き場所の記録が違います');
  same(fp.bbox_xyxy, BBOX, '手動の枠が [100, 40, 420, 360] ではありません');
  same(results.preparation.bbox_xyxy, BBOX, 'results の手動の枠が違います');
  same(prep.bbox_xyxy, BBOX, 'preparation.json の手動の枠が違います');
  same(jobs.avatar.bbox_xyxy, BBOX, 'jobs.json の手動の枠が違います');
  same(prep.mask.mask_coords_xyxy, BBOX, 'マスクの枠が違います');
  check(prep.tool_sha256 === sha.get('prepare_input.py') && prep.source.sha256 === pt.sha256 &&
    prep.crop.output.sha256 === fp.face256.sha256 && prep.mask.output.sha256 === fp.mask320.sha256 &&
    prep.diagnostics.upper_half_masked_face.output.sha256 === fp.diagnostic_upper_half_masked.sha256,
    'preparation.json と一覧・facts が一致しません');
  check(fp.face256_matches_rederivation_from_canvas === true && fp.mask320_matches_declared_rule === true,
    '顔の切り出しかマスクの再計算の記録が一致しません');
  check(/^rows 128\.\.255 set to 0/.test(prep.diagnostics.upper_half_masked_face.operation.replace(/^face256 copy with /, '')),
    '診断PNGが下半分を黒くした記録になっていません');
  checkPng(files, paths.face, 256, 256);
  checkPng(files, paths.masked, 256, 256);
  checkPng(files, paths.mask, 320, 320);

  check(jobs.schema === 'studio-yebisu/livetalking-example/jobs@1' && jobs.source.commit === SOURCE_COMMIT, 'jobs.json の schema が違います');
  const run = jobs.runtime;
  check(run.device === 'cpu' && run.dtype === 'float32' && run.seed === SEED && run.fps === 25 && run.batch_size === 4 &&
    run.l === 10 && run.r === 10 && run.intra_op_threads === 4, 'jobs.json の実行設定が想定と違います');
  check(jobs.policy.retries === 0 && jobs.avatar.full_image_sha256 === pt.sha256, 'jobs.json の方針か肖像が違います');
  same(jobs.jobs.map((j) => j.id), CASE_IDS, 'jobs.json のジョブが default・second ではありません');
  same(facts.cases.map((c) => c.id), CASE_IDS, 'facts のジョブが default・second ではありません');
  same(results.jobs.map((j) => j.id), CASE_IDS, 'results のジョブが default・second ではありません');

  // 共有の潜在（1回だけ作り、2件で再利用）
  const lat = facts.latent;
  check(deepEqual(lat.shape, [1, 8, 32, 32]) && lat.seed === SEED && deepEqual(lat.reused_for_jobs, CASE_IDS) &&
    lat.tensor_sha256 === results.latent.tensor_sha256 && lat.stats.all_finite === true, '共有の潜在の記録が想定と違います');
  const groups = facts.hook_groups;
  const rgroups = results.neural_hooks.groups;
  check(Array.isArray(groups) && groups.length === rgroups.length, '呼び出しの記録の数が一致しません');
  groups.forEach((g, i) => check(g.phase === rgroups[i].phase && g.module === rgroups[i].module && g.calls === rgroups[i].calls,
    `呼び出しの記録 ${g.module} が一致しません`));
  const group = (phase, module) => groups.find((g) => g.phase === phase && g.module === module);
  const enc = group('latent_preparation', 'vae.encoder');
  check(enc && enc.calls === 2, 'VAE の符号化が2回の記録になっていません');

  // 引用：同梱した原典の該当行と同じか
  check(Array.isArray(facts.references) && deepEqual(facts.references.map((r) => r.id), REF_IDS), '原典の引用が8件ではありません');
  const refs = {};
  for (const r of facts.references) {
    check(r.path === `vendor/livetalking/${r.source_path}` && files.has(r.path), `引用 ${r.id} の原典ファイルがありません`);
    const lines = decodeText(files.get(r.path), r.path).split(/\r?\n/);
    const quoted = lines.slice(r.line_start - 1, r.line_end).join('\n');
    check(r.line_end >= r.line_start && quoted === r.excerpt, `引用 ${r.id} が ${r.source_path} の ${r.line_start}–${r.line_end} 行と違います`);
    refs[r.id] = { ...r, url: `${REPO_BLOB}${r.source_path}#L${r.line_start}-L${r.line_end}`, note_ja: REF_NOTE[r.id] };
  }
  check(Array.isArray(facts.parts) && facts.parts.length === 6, '6部品の記録が違います');
  facts.parts.forEach((p, i) => check(p.id === i + 1 && deepEqual(p.refs, PART_REFS[i]), `部品 ${i + 1} の引用の割り当てが違います`));

  // 2つの固定ジョブ：入力WAV→捕捉→MP4/WAV/JSON
  const cases = {};
  CASE_IDS.forEach((id, i) => {
    const fc = facts.cases[i];
    const rj = results.jobs[i];
    const sj = jobs.jobs[i];
    check(fc.prior_tts_input_text === rj.prior_tts_input_text && fc.prior_tts_input_text === sj.prior_tts_input_text,
      `${id} の既存TTSの入力文の記録が一致しません`);

    const na = facts.inputs.audio[id];
    const inPath = fc.input_wav;
    check(inPath === `inputs/${sj.audio}` && na.file === sj.audio, `${id} の入力WAVの置き場所が違います`);
    listed(inPath, sj.audio_sha256, na.bytes, `${id} の入力WAV`);
    check(na.sha256 === sj.audio_sha256 && rj.audio.sha256 === sj.audio_sha256, `${id} の入力WAVの記録が一致しません`);
    const win = parseWav(files.get(inPath), inPath);
    const nat = na.native;
    check(win.rate === nat.sample_rate && win.channels === nat.channels && win.bits === 16 && win.frames === nat.frames &&
      Math.abs(win.frames / win.rate - nat.duration_s) < 1e-9, `${inPath} の形式が記録（${nat.sample_rate}Hz・mono・PCM16）と違います`);
    const sw = fc.source_waveform;
    checkBins(sw, `${id} の入力`);
    check(sw.samples === nat.frames && sw.sample_rate === nat.sample_rate, `${id} の入力の波形の記録が WAV と一致しません`);

    const rs = rj.audio.resampled_by_original;
    check(rs.sample_rate === 16000 && Math.abs(rs.samples - (nat.frames * 16000) / nat.sample_rate) <= 1, `${id} の16kHz変換の記録が違います`);
    const complete = Math.floor(rs.samples / CHUNK);
    check(rj.audio.put_audio_file.chunk_samples === CHUNK && rj.audio.put_audio_file.complete_chunks === complete,
      `${id} の20ms片の数が記録と違います`);

    const r = run.r;
    const B = run.batch_size;
    const T = Math.ceil((r + complete) / (2 * B)) * B;
    const dur = T / run.fps;
    check(rj.capture_target.target_frames === T && fc.captured_frames === T && rj.capture.captured_frames === T &&
      fc.captured_audio_chunks === 2 * T && rj.capture.captured_audio_chunks === 2 * T &&
      Math.abs(fc.captured_duration_s - dur) < 1e-9 && Math.abs(rj.capture.captured_duration_s - dur) < 1e-9 && fc.fps === run.fps,
      `${id} の捕捉の長さが ceil((r+片)/(2·batch))·batch と一致しません`);
    check(rj.warm_up_observed.asr_output_queue_chunks === r && rj.warm_up_observed.asr_output_queue_types.every((t) => t === 1),
      `${id} の先頭の待機の片の記録が違います`);

    const ap = fc.audio_provenance;
    same(ap, rj.capture.audio, `${id} の音の出どころの記録が一致しません`);
    check(ap.input_chunks_captured === complete && ap.input_chunks_expected === complete &&
      ap.input_chunks_bitexact_to_original_resampled_int16 === true && ap.input_chunks_contiguous_in_order === true &&
      ap.all_input_chunks_inside_target === true && ap.prefix_untagged_chunks_observed === r &&
      ap.first_input_chunk_index === r && ap.last_input_chunk_index === r + complete - 1 &&
      ap.untagged_chunks === 2 * T - complete && ap.untagged_chunks_all_zero === ap.untagged_chunks &&
      ap.tail_untagged_chunks_inside_target === 2 * T - complete - r && ap.trim_pad_shift_applied === false,
      `${id} の音の片の並びが記録と違います`);

    // コマごとの記録：待機（元画像）と貼り戻し
    same(fc.frame_summary, rj.capture.frames_summary, `${id} のコマの集計が一致しません`);
    const recs = fc.frame_records;
    check(Array.isArray(recs) && recs.length === T, `${id} のコマの記録が ${T} 件ではありません`);
    same(recs, rj.capture.frames, `${id} のコマの記録が facts と results で違います`);
    const frameIdle = recs.map((rec, k) => {
      check(rec.index === k && deepEqual(rec.chunks, [2 * k, 2 * k + 1]) && rec.changed_pixels_outside_bbox === 0,
        `${id} のコマ ${k} の記録が違います`);
      const idle = rec.identical_to_original_silent_frame_cache === true;
      check(idle === rec.chunk_provenance.every((c) => c === 'untagged'), `${id} のコマ ${k} の待機の判定が音の片と合いません`);
      return idle;
    });
    const idleCount = frameIdle.filter(Boolean).length;
    check(idleCount === fc.frame_summary.identical_to_original_silent_frame_cache &&
      T - idleCount === fc.frame_summary.frames_with_any_input_chunk && fc.frame_summary.max_changed_pixels_outside_bbox === 0,
      `${id} の待機と貼り戻しのコマ数が一致しません`);
    const idleSha = new Set(recs.filter((rec, k) => frameIdle[k]).map((rec) => rec.png_sha256));
    check(idleSha.size === 1, `${id} の待機のコマが同じ画像になっていません`);

    const reps = fc.representatives.map((rep, k) => {
      listed(rep.file, rep.sha256, rep.bytes, `${id} の代表コマ`);
      const rec = recs[rep.index];
      const rr = rj.outputs.representatives[k];
      check(rec && rec.png_sha256 === rep.sha256 && rep.identical_to_original_silent_frame_cache === frameIdle[rep.index] &&
        rr.sha256 === rep.sha256 && `outputs/${rr.file}` === rep.file && rr.index === rep.index, `${id} の代表コマ #${rep.index} の記録が一致しません`);
      checkPng(files, rep.file, 512, 512);
      return { index: rep.index, path: rep.file, sha256: rep.sha256, bytes: rep.bytes, idle: frameIdle[rep.index], time: rep.index / run.fps };
    });
    check(reps.length === 5 && reps[0].index === 0 && reps[4].index === T - 1 && reps[0].idle && reps[4].idle && idleSha.has(reps[0].sha256),
      `${id} の代表5枚の並びが違います`);

    // MP4（実際の出力。H.264＋AAC）
    const om = rj.outputs.mp4;
    listed(fc.mp4, fc.mp4_sha256, fc.mp4_bytes, `${id} の MP4`);
    check(om.sha256 === fc.mp4_sha256 && om.bytes === fc.mp4_bytes && `outputs/${om.file}` === fc.mp4, `${id} の MP4 の記録が一致しません`);
    const vs = om.ffprobe.streams.find((s) => s.codec_type === 'video');
    const as = om.ffprobe.streams.find((s) => s.codec_type === 'audio');
    check(om.ffprobe.streams.length === 2 && vs && as && vs.codec_name === 'h264' && vs.width === 512 && vs.height === 512 &&
      vs.pix_fmt === 'yuv420p' && vs.avg_frame_rate === '25/1' && Number(vs.nb_frames) === T &&
      as.codec_name === 'aac' && as.sample_rate === '16000' && as.channels === 1 &&
      om.checks.all_checks_passed === true && om.checks.decoded_video_frames === T && om.checks.faststart_moov_before_mdat === true &&
      Math.abs(fc.native_mp4_duration_s - dur) < 1e-9, `${id} の MP4 の測定記録が想定と違います`);
    const mp4 = parseMp4(files.get(fc.mp4), fc.mp4);
    same(mp4.topTypes, om.checks.top_level_boxes, `${id} の MP4 の箱の並びが記録と違います`);
    const vt = mp4.tracks.filter((t) => t.handler === 'vide');
    const at = mp4.tracks.filter((t) => t.handler === 'soun');
    check(mp4.tracks.length === 2 && vt.length === 1 && at.length === 1, `${id} の MP4 が映像1本・音声1本ではありません`);
    check(vt[0].samples === T && vt[0].width === 512 && vt[0].height === 512 && Math.abs(vt[0].seconds - dur) < 0.05,
      `${id} の MP4 の映像が ${T}コマ・${dur}秒・512×512ではありません`);
    check(at[0].samples === Number(as.nb_frames) && Math.abs(at[0].seconds - dur) < 0.1, `${id} の MP4 の音声トラックが記録と違います`);

    // 捕捉した16kHz WAV（実際の出力）
    const ow = rj.outputs.wav;
    listed(fc.output_wav, ow.sha256, ow.bytes, `${id} の出力WAV`);
    check(`outputs/${ow.file}` === fc.output_wav && ow.identical_to_private_capture === true && rj.capture.wav_private.sha256 === ow.sha256,
      `${id} の出力WAVの記録が一致しません`);
    const wout = parseWav(files.get(fc.output_wav), fc.output_wav);
    check(wout.rate === 16000 && wout.channels === 1 && wout.bits === 16 && wout.frames === 2 * T * CHUNK &&
      wout.frames === rj.capture.captured_samples && wout.frames === fc.output_waveform.samples,
      `${fc.output_wav} が 16kHz・mono・PCM16・${2 * T * CHUNK}サンプルではありません`);
    checkBins(fc.output_waveform, `${id} の出力`);

    // ジョブの JSON（親の工程が包んだもの）
    listed(fc.record_json, fc.record_sha256, fc.record_bytes, `${id} の記録JSON`);
    const pj = json(fc.record_json);
    same(pj.job, rj, `${id} の記録JSONが results のジョブと一致しません`);
    same(pj.latent, results.latent, `${id} の記録JSONの潜在が一致しません`);

    // 原典の部品と呼び出し回数
    const al = rj.avatar_load;
    check(al.frame0_equals_protected_portrait === true && al.mask0_equals_manual_mask === true && al.latent_equals_shared_latent === true &&
      deepEqual(al.coords, [BBOX]) && deepEqual(al.mask_coords, [BBOX]), `${id} のアバターの読み込みの記録が違います`);
    const con = rj.constructed;
    check(con.avatar === 'MuseReal' && con.asr === 'WhisperASR' && con.tts === 'EdgeTTS' && con.output === 'WebRTCOutput' &&
      con.chunk_samples === CHUNK && rj.tts_idle.messages_queued === 0, `${id} の原典の部品の記録が違います`);
    same(fc.neural_calls_observed, rj.neural_calls_observed, `${id} の呼び出し回数が一致しません`);
    const nc = fc.neural_calls_observed;
    const calls = {
      whisper: nc.by_module['whisper.encoder'].calls,
      whisperAfterQuit: nc.by_module['whisper.encoder'].windows.started_after_quit_signal || 0,
      unet: nc.by_module['unet.model'].calls,
      vaeDec: nc.by_module['vae.decoder'].calls,
    };
    for (const [mod, key] of [['whisper.encoder', 'whisper'], ['unet.model', 'unet'], ['vae.decoder', 'vaeDec']]) {
      check(group(`job:${id}`, mod) && group(`job:${id}`, mod).calls === calls[key], `${id} の ${mod} の回数が記録と違います`);
    }
    const ug = group(`job:${id}`, 'unet.model');
    const us = ug.input_signatures[0];
    check(deepEqual(us.args[0].shape, [B, 8, 32, 32]) && deepEqual(us.kwargs.encoder_hidden_states.shape, [B, 50, 384]),
      `${id} の U-Net の入力の形が記録と違います`);
    check(calls.unet === calls.vaeDec && calls.unet === nc.batches_inside_target_with_input_chunks &&
      calls.unet === rj.capture.batches_with_input_chunks && nc.batches_inside_target === T / B &&
      ug.windows.started_before_capture_target_reached === calls.unet, `${id} の U-Net の回数とバッチの記録が一致しません`);
    const cr = fc.capture_raw;
    same(cr, rj.capture_raw, `${id} の捕捉の生の記録が一致しません`);
    check(cr.captured_frames === T && cr.frames_pushed_beyond_target === cr.video_pushes_total - T &&
      cr.audio_chunks_pushed_beyond_target === cr.audio_pushes_total - 2 * T && cr.tagged_chunks_beyond_target === 0 &&
      cr.order_violations === 0 && cr.adapter_error === null, `${id} の捕捉の外の記録が想定と違います`);
    same(fc.threads, rj.threads, `${id} のスレッドの記録が一致しません`);
    check(fc.threads.worker_exceptions.length === 0 && fc.threads.render_alive_after_join === false, `${id} の後片付けの記録が想定と違います`);

    cases[id] = {
      id,
      label: fc.label,
      priorText: fc.prior_tts_input_text,
      frames: T,
      chunks: 2 * T,
      duration: dur,
      fps: run.fps,
      complete,
      prefix: r,
      tail: 2 * T - complete - r,
      idle: idleCount,
      pasted: T - idleCount,
      frameIdle,
      reps,
      sourceBins: sw.min_max_bins,
      outputBins: fc.output_waveform.min_max_bins,
      inputWav: { path: inPath, bytes: na.bytes, sha256: na.sha256, rate: win.rate, frames: win.frames, duration: nat.duration_s },
      resampled: rs.samples,
      outputWav: { path: fc.output_wav, bytes: ow.bytes, sha256: ow.sha256, rate: wout.rate, frames: wout.frames },
      mp4: {
        path: fc.mp4, bytes: fc.mp4_bytes, sha256: fc.mp4_sha256,
        video: { codec: vs.codec_name, profile: vs.profile, pix: vs.pix_fmt, fps: vs.avg_frame_rate, frames: Number(vs.nb_frames) },
        audio: { codec: as.codec_name, profile: as.profile, rate: Number(as.sample_rate), channels: as.channels },
      },
      record: { path: fc.record_json, bytes: fc.record_bytes, sha256: fc.record_sha256 },
      calls,
      batches: nc.batches_inside_target,
      beyond: { frames: cr.frames_pushed_beyond_target, chunks: cr.audio_chunks_pushed_beyond_target },
      wall: fc.threads.wall_clock_s_render_start_to_return,
      unetMeanMs: ug.mean_ms,
      vaeDecMeanMs: group(`job:${id}`, 'vae.decoder').mean_ms,
    };
  });

  const sum = (f) => CASE_IDS.reduce((s, id) => s + f(cases[id]), 0);
  return {
    manifest, files, sha, size, facts, results, jobs, prep, upstream, cases, refs, paths,
    parts: facts.parts,
    batch: run.batch_size,
    totals: {
      frames: sum((c) => c.frames), pasted: sum((c) => c.pasted), idle: sum((c) => c.idle),
      unet: sum((c) => c.calls.unet), predictions: sum((c) => c.calls.unet * run.batch_size),
    },
    modelBytes: mf.reduce((s, f) => s + f.bytes, 0),
  };
}

export async function verifyAll(onProgress = () => {}) {
  if (!globalThis.crypto || !crypto.subtle) {
    fail('このブラウザーでは照合できません', 'SHA-256 の計算（crypto.subtle）が使えません。https か localhost で開いてください。');
  }
  const manifestBytes = await fetchBytes(MANIFEST_PATH);
  if ((await sha256Hex(manifestBytes)) !== MANIFEST_SHA256) {
    fail('ファイルの一覧が記録と違います', `${MANIFEST_PATH} の SHA-256 が固定値と一致しません`);
  }
  const manifest = parseJson(manifestBytes, MANIFEST_PATH);
  checkManifest(manifest);
  const files = new Map();
  let done = 0;
  await pool(manifest.files, 6, async (a) => {
    const buf = await fetchBytes(a.path);
    if (buf.byteLength !== a.bytes) fail('ファイルの大きさが記録と違います', `${a.path}: ${buf.byteLength} B（記録は ${a.bytes} B）`);
    if ((await sha256Hex(buf)) !== a.sha256) fail('ファイルの中身が記録と違います', `${a.path} の SHA-256 が一致しません`);
    files.set(a.path, buf);
    done += 1;
    onProgress(done, manifest.files.length);
  });
  return crossCheck(manifest, files);
}

// 照合したバイト列だけから画像を作る（音声・動画の要素は作らない）。寸法が記録と違えば止める。
export async function loadMedia(model) {
  const urls = [];
  const image = async (path, w, h) => {
    const u = URL.createObjectURL(new Blob([model.files.get(path)], { type: 'image/png' }));
    urls.push(u);
    const el = new Image();
    el.decoding = 'async';
    el.src = u;
    try {
      await el.decode();
    } catch {
      fail('画像を表示できません', `${path} をデコードできません`);
    }
    if (el.naturalWidth !== w || el.naturalHeight !== h) fail('画像の寸法が記録と違います', `${path}: ${el.naturalWidth}×${el.naturalHeight}`);
    return el;
  };
  try {
    const p = model.paths;
    const media = {
      urls,
      portrait: await image(p.portrait, 512, 512),
      face: await image(p.face, 256, 256),
      masked: await image(p.masked, 256, 256),
      mask: await image(p.mask, 320, 320),
      frames: {},
      revoke() { urls.splice(0).forEach((u) => URL.revokeObjectURL(u)); },
    };
    for (const id of CASE_IDS) {
      media.frames[id] = [];
      for (const f of model.cases[id].reps) media.frames[id].push(await image(f.path, 512, 512));
    }
    return media;
  } catch (e) {
    urls.forEach((u) => URL.revokeObjectURL(u));
    throw e;
  }
}

/* ---------- 図の配置（設計座標） ---------- */

// スマホ：CSSの幅そのもので配置する（縮小した横長の図にはしない）。
export function phoneLayout(width) {
  const W = Math.max(300, Math.min(520, Math.round(width)));
  const m = 17;
  const gap = 10;
  const laneL = 8;
  const laneR = W - 8;
  const cw = (W - 2 * m - gap) / 2;
  const Lx = m;
  const Rx = m + cw + gap;
  const aG = 12;
  const aw = (W - 8 - 2 * aG) / 3;
  const uw = Math.round((W - 2 * m - gap) * 0.56);
  const qx = Lx + uw + gap;
  const qw = W - m - qx;
  const nodes = {
    readme: { x: 4, y: 2, w: aw, h: 42 },
    author: { x: 4 + aw + aG, y: 2, w: aw, h: 42 },
    operator: { x: 4 + 2 * (aw + aG), y: 2, w: aw, h: 42 },
    portrait: { x: Lx, y: 54, w: cw, h: 64 },
    wav: { x: Rx, y: 54, w: cw, h: 64 },
    engine: { x: 2, y: 128, w: W - 4, h: 278 },
    prep: { x: Lx, y: 152, w: cw, h: 72 },
    chunks: { x: Rx, y: 152, w: cw, h: 72 },
    latent: { x: Lx, y: 236, w: cw, h: 44 },
    whisper: { x: Rx, y: 236, w: cw, h: 44 },
    unet: { x: Lx, y: 292, w: uw, h: 48 },
    queue: { x: qx, y: 292, w: qw, h: 48 },
    paste: { x: Lx, y: 352, w: W - 2 * m, h: 46 },
    strip: { x: Lx, y: 422, w: W - 2 * m - 54, h: 46, gap: 5 },
    use: { x: W - m - 46, y: 422, w: 46, h: 46 },
    timeline: { x: Lx, y: 474, w: W - 2 * m, h: 8 },
    files: { x: Lx, y: 496, w: W - 2 * m, h: 14 },
  };
  const op = nodes.operator;
  const px = Lx + cw * 0.25;
  const wx = Rx + cw * 0.75;
  const edges = {
    readme_author: [[4 + aw, 23], [nodes.author.x, 23]],
    author_operator: [[nodes.author.x + aw, 23], [op.x, 23]],
    operator_engine: [[op.x + op.w / 2, 44], [op.x + op.w / 2, 49], [W / 2, 49], [W / 2, 130]],
    portrait_prep: [[px, 118], [px, 152]],
    wav_chunks: [[wx, 118], [wx, 152]],
    prep_latent: [[Lx + cw / 2, 224], [Lx + cw / 2, 236]],
    chunks_whisper: [[Rx + cw / 2, 224], [Rx + cw / 2, 236]],
    latent_unet: [[Lx + cw / 2, 280], [Lx + cw / 2, 292]],
    whisper_unet: [[Rx + cw * 0.35, 280], [Rx + cw * 0.35, 286], [Lx + uw - 24, 286], [Lx + uw - 24, 292]],
    unet_queue: [[Lx + uw, 316], [qx, 316]],
    raw_bypass: [[Rx + cw, 188], [laneR, 188], [laneR, 328], [W - m, 328]],
    queue_paste: [[qx + qw / 2, 340], [qx + qw / 2, 352]],
    canvas_bypass: [[Lx, 86], [laneL, 86], [laneL, 380], [Lx, 380]],
    paste_out: [[W / 2, 398], [W / 2, 422]],
    strip_use: [[nodes.strip.x + nodes.strip.w, 445], [nodes.use.x, 445]],
  };
  return {
    kind: 'phone', w: W, h: 512, nodes, edges,
    fs: { t: 13.5, s: 12, xs: 11.5 },
    pins: {
      1: [W / 2 - 80, 140], 2: [Rx + cw - 13, 165], 3: [Lx + 13, 165],
      4: [Lx + 13, 305], 5: [W - m - 13, 305], 6: [Lx + 13, 365],
    },
    pinR: 10,
    notes: {
      engine: { x: W / 2 - 66, y: 140, text: 'LiveTalking エンジン' },
      canvas: { x: laneL, y: 300, text: '元画像はそのまま' },
      raw: { x: laneR, y: 258, text: '生の音は別の道' },
      out: { x: W / 2 + 7, y: 414, text: 'WebRTCOutput→Disk捕捉' },
    },
    outPath: edges.paste_out,
    usePath: edges.strip_use,
    actorsPath: joinPaths(edges.readme_author, edges.author_operator, edges.operator_engine),
  };
}

// 横長：960×540 の設計座標を幅に合わせて拡大縮小する（PCと横の動画）。
export const WIDE_LAYOUT = (() => {
  const nodes = {
    readme: { x: 16, y: 8, w: 170, h: 46 },
    author: { x: 206, y: 8, w: 200, h: 46 },
    operator: { x: 426, y: 8, w: 190, h: 46 },
    caption: { x: 640, y: 8, w: 304, h: 46 },
    engine: { x: 150, y: 70, w: 794, h: 376 },
    portrait: { x: 16, y: 96, w: 118, h: 118 },
    wav: { x: 16, y: 300, w: 118, h: 86 },
    prep: { x: 170, y: 116, w: 200, h: 112 },
    latent: { x: 392, y: 126, w: 140, h: 92 },
    chunks: { x: 170, y: 290, w: 200, h: 96 },
    whisper: { x: 392, y: 290, w: 140, h: 96 },
    unet: { x: 556, y: 196, w: 124, h: 108 },
    queue: { x: 702, y: 206, w: 104, h: 88 },
    paste: { x: 826, y: 132, w: 110, h: 148 },
    webrtc: { x: 826, y: 300, w: 110, h: 56 },
    legend: { x: 826, y: 370, w: 110, h: 64 },
    capture: { x: 826, y: 462, w: 118, h: 70 },
    strip: { x: 476, y: 462, w: 330, h: 54, gap: 10 },
    timeline: { x: 476, y: 522, w: 330, h: 8 },
    mp4: { x: 256, y: 462, w: 196, h: 70 },
    use: { x: 16, y: 462, w: 216, h: 70 },
  };
  const edges = {
    readme_author: [[186, 31], [206, 31]],
    author_operator: [[406, 31], [426, 31]],
    operator_engine: [[470, 54], [470, 78]],
    portrait_prep: [[134, 170], [170, 170]],
    wav_chunks: [[134, 338], [170, 338]],
    prep_latent: [[370, 172], [392, 172]],
    chunks_whisper: [[370, 338], [392, 338]],
    latent_unet: [[532, 172], [544, 172], [544, 226], [556, 226]],
    whisper_unet: [[532, 338], [544, 338], [544, 276], [556, 276]],
    unet_queue: [[680, 250], [702, 250]],
    raw_bypass: [[270, 386], [270, 416], [754, 416], [754, 294]],
    queue_paste: [[806, 250], [826, 250]],
    canvas_bypass: [[134, 106], [881, 106], [881, 132]],
    paste_webrtc: [[881, 280], [881, 300]],
    webrtc_capture: [[881, 356], [881, 462]],
    capture_strip: [[826, 491], [806, 491]],
    strip_mp4: [[476, 491], [452, 491]],
    mp4_use: [[256, 497], [232, 497]],
  };
  return {
    kind: 'wide', w: 960, h: 540, nodes, edges,
    fs: { t: 14, s: 12.5, xs: 11.5 },
    pins: { 1: [728, 88], 2: [184, 304], 3: [184, 130], 4: [570, 210], 5: [716, 220], 6: [840, 146] },
    pinR: 11,
    notes: {
      engine: { x: 480, y: 88, text: 'LiveTalking エンジン（Python）' },
      canvas: { x: 560, y: 118, text: '元画像512はそのまま貼り戻しへ' },
      raw: { x: 512, y: 430, text: '生の音2片は特徴にせず、別の道で組へ' },
    },
    outPath: joinPaths(edges.paste_webrtc, edges.webrtc_capture, edges.capture_strip),
    usePath: joinPaths(edges.strip_mp4, edges.mp4_use),
    actorsPath: joinPaths(edges.readme_author, edges.author_operator, edges.operator_engine),
  };
})();

const EDGE_ENDS = {
  readme_author: ['readme', 'author'], author_operator: ['author', 'operator'], operator_engine: ['operator', 'engine'],
  portrait_prep: ['portrait', 'prep'], wav_chunks: ['wav', 'chunks'], prep_latent: ['prep', 'latent'],
  chunks_whisper: ['chunks', 'whisper'], latent_unet: ['latent', 'unet'], whisper_unet: ['whisper', 'unet'],
  unet_queue: ['unet', 'queue'], raw_bypass: ['chunks', 'queue'], queue_paste: ['queue', 'paste'],
  canvas_bypass: ['portrait', 'paste'], paste_out: ['paste', 'strip'], strip_use: ['strip', 'use'],
  paste_webrtc: ['paste', 'webrtc'], webrtc_capture: ['webrtc', 'capture'], capture_strip: ['capture', 'strip'],
  strip_mp4: ['strip', 'mp4'], mp4_use: ['mp4', 'use'],
};
const EDGE_KIND = {
  portrait_prep: 'img', prep_latent: 'img', latent_unet: 'img',
  wav_chunks: 'aud', chunks_whisper: 'aud', whisper_unet: 'aud',
  canvas_bypass: 'img-bypass', raw_bypass: 'aud-bypass',
};

export const PART_NODES = { 1: 'engine', 2: 'chunks', 3: 'prep', 4: 'unet', 5: 'queue', 6: 'paste' };
export const NONFOCUS = 0.78;

export const STAGES = [
  { id: 0, name: '何か', focus: ['readme', 'author', 'operator', 'engine', 'prep', 'latent', 'chunks', 'whisper', 'unet', 'queue', 'paste', 'webrtc'] },
  { id: 1, name: '渡す', focus: ['readme', 'author', 'operator', 'portrait', 'wav', 'prep', 'chunks', 'latent'] },
  { id: 2, name: '返る', focus: ['latent', 'whisper', 'unet', 'queue', 'paste', 'webrtc', 'capture', 'strip', 'timeline', 'mp4', 'use', 'files'] },
];

/* ---------- 経路の上の位置 ---------- */

export function pathLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

export function along(pts, u) {
  const t = Math.min(1, Math.max(0, u));
  let left = t * pathLength(pts);
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (left <= len || i === pts.length - 1) {
      const k = len ? Math.min(1, left / len) : 1;
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
    }
    left -= len;
  }
  return pts[pts.length - 1];
}

export function joinPaths(...paths) {
  const out = [];
  for (const p of paths) for (const pt of p) {
    const last = out[out.length - 1];
    if (!last || last[0] !== pt[0] || last[1] !== pt[1]) out.push(pt);
  }
  return out;
}

export function stripRects(node, n = 5) {
  const s = Math.min(node.h, (node.w - node.gap * (n - 1)) / n);
  return Array.from({ length: n }, (_, i) => ({ x: node.x + i * (s + node.gap), y: node.y, w: s, h: s }));
}

/* ---------- 色と文字 ---------- */

export const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Noto Sans JP","Meiryo",system-ui,sans-serif';

export const PALETTE = {
  paper: '#f4eee3', card: '#fffaf1', ink: '#1d1a16', muted: '#5c5348', line: '#2c2722', faint: '#d8cdbb',
  accent: '#b33c22', img: '#94560f', aud: '#1f5a8c', ok: '#2c6a4b', engine: '#8a7558', engineFill: '#f8f1e5', idle: '#8f8578',
};

export function readPalette(el) {
  const cs = getComputedStyle(el);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  const P = PALETTE;
  return {
    paper: v('--paper', P.paper), card: v('--card', P.card), ink: v('--ink', P.ink), muted: v('--muted', P.muted),
    line: v('--line', P.line), faint: v('--faint', P.faint), accent: v('--accent', P.accent), img: v('--img', P.img),
    aud: v('--aud', P.aud), ok: v('--ok', P.ok), engine: v('--engine', P.engine), engineFill: v('--engine-fill', P.engineFill),
    idle: v('--idle', P.idle),
  };
}

function setFont(ctx, size, weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

export function drawText(ctx, s, x, y, o = {}) {
  const size = o.size || 12;
  const weight = o.weight || 600;
  let sz = size;
  setFont(ctx, sz, weight);
  const max = o.max || Infinity;
  while (ctx.measureText(s).width > max && sz > size * 0.8) {
    sz -= 0.25;
    setFont(ctx, sz, weight);
  }
  ctx.fillStyle = o.color || '#000';
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'middle';
  ctx.fillText(s, x, y);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function strokePath(ctx, pts, color, width, head = true) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  if (head) {
    const [x1, y1] = pts[pts.length - 2];
    const [x2, y2] = pts[pts.length - 1];
    const a = Math.atan2(y2 - y1, x2 - x1);
    const L = 5.5 + width * 1.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45));
    ctx.lineTo(x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- 部品の形 ---------- */

function card(ctx, n, pal, o = {}) {
  roundRect(ctx, n.x, n.y, n.w, n.h, 6);
  ctx.fillStyle = o.fill || pal.card;
  ctx.fill();
  ctx.lineWidth = o.strong ? 2.2 : 1.3;
  ctx.strokeStyle = o.stroke || pal.line;
  ctx.stroke();
}

// 実際のPCMのmin/max（facts の測定値）。フルスケール±1で描き、正規化しない。
export function drawWave(ctx, bins, r, color, cursor) {
  const n = bins.length;
  const mid = r.y + r.h / 2;
  const bw = r.w / n;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, bw * 0.75);
  ctx.beginPath();
  bins.forEach(([lo, hi], i) => {
    const x = r.x + (i + 0.5) * bw;
    ctx.moveTo(x, mid - hi * (r.h / 2));
    ctx.lineTo(x, Math.max(mid - lo * (r.h / 2), mid - hi * (r.h / 2) + 0.8));
  });
  ctx.stroke();
  if (cursor !== undefined && cursor !== null) {
    const x = r.x + Math.min(1, Math.max(0, cursor)) * r.w;
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, r.y - 2);
    ctx.lineTo(x, r.y + r.h + 2);
    ctx.stroke();
  }
  ctx.restore();
}

// 説明用の形：20ms片の刻み（数の目安。実際の片の数は文字で示す）。
function drawTicks(ctx, r, color, n = 14) {
  ctx.save();
  ctx.fillStyle = color;
  const w = r.w / n;
  for (let i = 0; i < n; i += 1) {
    const h = r.h * (0.35 + 0.65 * (((i * 7) % 5) / 4));
    ctx.fillRect(r.x + i * w + w * 0.2, r.y + (r.h - h) / 2, w * 0.6, h);
  }
  ctx.restore();
}

// 説明用の形：潜在の8チャンネル（下半分を隠した4＋全体の4）。値の可視化ではない。
export function drawTiles(ctx, x, y, s, pal, lit) {
  ctx.save();
  const g = s * 0.18;
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const tx = x + col * (s + g);
      const ty = y + row * (s + g);
      ctx.fillStyle = row === 0 ? pal.img : pal.card;
      ctx.globalAlpha = row === 0 ? 0.85 - col * 0.12 : 1;
      ctx.fillRect(tx, ty, s, s);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = lit ? pal.accent : pal.img;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(tx, ty, s, s);
      if (row === 0) {
        ctx.fillStyle = pal.ink;
        ctx.fillRect(tx + 1, ty + s / 2, s - 2, s / 2 - 1);
      }
    }
  }
  ctx.restore();
}

// 説明用の形：Whisper 符号器の特徴の格子（実際の活性値ではない）。
export function drawGrid(ctx, x, y, cols, rows, s, pal) {
  ctx.save();
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      ctx.fillStyle = pal.aud;
      ctx.globalAlpha = 0.25 + 0.6 * (((r * 3 + c * 5) % 7) / 6);
      ctx.fillRect(x + c * (s + 2), y + r * (s + 2), s, s);
    }
  }
  ctx.restore();
}

function drawImageBox(ctx, img, r, stroke, width = 1.2) {
  if (img) ctx.drawImage(img, r.x, r.y, r.w, r.h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

function drawBbox(ctx, r, pal) {
  const k = r.w / 512;
  ctx.save();
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([3, 2]);
  ctx.strokeRect(r.x + BBOX[0] * k, r.y + BBOX[1] * k, (BBOX[2] - BBOX[0]) * k, (BBOX[3] - BBOX[1]) * k);
  ctx.restore();
}

function chip(ctx, s, x, y, o) {
  setFont(ctx, o.size, 700);
  const w = ctx.measureText(s).width + 6;
  ctx.fillStyle = o.bg;
  ctx.fillRect(x, y, w, o.size + 4);
  drawText(ctx, s, x + 3, y + (o.size + 4) / 2 + 0.5, { size: o.size, weight: 700, color: o.color });
}

function laneLabel(ctx, note, pal, color, fs) {
  ctx.save();
  ctx.translate(note.x, note.y);
  ctx.rotate(-Math.PI / 2);
  setFont(ctx, fs, 700);
  const w = ctx.measureText(note.text).width + 8;
  ctx.fillStyle = pal.engineFill;
  ctx.fillRect(-w / 2, -fs / 2 - 2, w, fs + 4);
  drawText(ctx, note.text, 0, 0.5, { size: fs, weight: 700, color, align: 'center' });
  ctx.restore();
}

/* ---------- 図全体 ---------- */

// o: { layout, pal, caseId, focus, tokens, hidePins, latentLit, waveCursor, glow, caption, legend, miniLegend }
export function drawMap(ctx, model, media, o) {
  const L = o.layout;
  const N = L.nodes;
  const E = L.edges;
  const pal = o.pal || PALETTE;
  const fs = L.fs;
  const wide = L.kind === 'wide';
  const cs = model.cases[o.caseId];
  const focus = o.focus ? new Set(o.focus) : null;
  const A = (id) => (!focus || focus.has(id) ? 1 : NONFOCUS);
  const on = (id) => Boolean(focus && focus.has(id)) || Boolean(o.glow && o.glow[id]);
  const T = (s, x, y, size, weight, color, max, align) => drawText(ctx, s, x, y, { size, weight, color, max, align });

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, L.w, L.h);

  // エンジンの枠（LiveTalking の中）
  {
    const n = N.engine;
    ctx.globalAlpha = A('engine');
    roundRect(ctx, n.x, n.y, n.w, n.h, 10);
    ctx.fillStyle = pal.engineFill;
    ctx.fill();
    ctx.lineWidth = on('engine') ? 2.4 : 1.5;
    ctx.strokeStyle = pal.engine;
    ctx.stroke();
    const e = L.notes.engine;
    T(e.text, e.x, e.y, fs.t, 800, pal.ink, wide ? 236 : 150);
  }

  // 線（太い線は特徴にしない2本の道：元画像と生の音）
  for (const [id, pts] of Object.entries(E)) {
    const [a, b] = EDGE_ENDS[id];
    ctx.globalAlpha = Math.min(A(a), A(b));
    const kind = EDGE_KIND[id];
    if (kind === 'img') strokePath(ctx, pts, pal.img, 2);
    else if (kind === 'aud') strokePath(ctx, pts, pal.aud, 2);
    else if (kind === 'img-bypass') strokePath(ctx, pts, pal.img, 3.2);
    else if (kind === 'aud-bypass') strokePath(ctx, pts, pal.aud, 3.2);
    else strokePath(ctx, pts, pal.line, 1.7);
  }
  ctx.globalAlpha = Math.min(A('portrait'), A('paste'));
  if (wide) T(L.notes.canvas.text, L.notes.canvas.x, L.notes.canvas.y, fs.xs, 700, pal.img, 260);
  else laneLabel(ctx, L.notes.canvas, pal, pal.img, fs.xs);
  ctx.globalAlpha = Math.min(A('chunks'), A('queue'));
  if (wide) T(L.notes.raw.text, L.notes.raw.x, L.notes.raw.y, fs.xs, 700, pal.aud, 300, 'center');
  else laneLabel(ctx, L.notes.raw, pal, pal.aud, fs.xs);
  if (!wide) {
    ctx.globalAlpha = Math.min(A('paste'), A('strip'));
    T(L.notes.out.text, L.notes.out.x, L.notes.out.y, fs.xs, 600, pal.muted, L.w - L.notes.out.x - 14);
  }

  // 箱の題と小見出し
  const head = (n, title, pinSide, color = pal.ink) => {
    const tx = pinSide === 'left' ? n.x + 26 : n.x + 8;
    const max = n.w - (tx - n.x) - (pinSide === 'right' ? 26 : 6);
    T(title, tx, n.y + 13, fs.t, 800, color, max);
  };
  const sub = (n, s, dy, o2 = {}) => T(s, o2.x ?? n.x + 8, n.y + dy, o2.size || fs.s, o2.weight || 600, o2.color || pal.muted, o2.max ?? n.w - 14, o2.align);

  // 上段：誰が何をしたか
  const pill = (id, title, subtext) => {
    const n = N[id];
    ctx.globalAlpha = A(id);
    card(ctx, n, pal, { strong: on(id) });
    T(title, n.x + 7, n.y + n.h * 0.33, fs.t, 800, pal.ink, n.w - 12);
    T(subtext, n.x + 7, n.y + n.h * 0.74, fs.s, 600, pal.muted, n.w - 12);
  };
  pill('readme', '原典README', wide ? 'API・依頼・既知の入力' : 'API・依頼');
  pill('author', '作者AI ×1', wide ? '準備・runner・jobsを書く' : 'コードを書く');
  pill('operator', '制作担当', wide ? '原典Pythonを別工程で実行' : '別に実行');

  // 入力：同じ肖像1枚と既存のWAV
  {
    const n = N.portrait;
    ctx.globalAlpha = A('portrait');
    if (wide) {
      drawImageBox(ctx, media && media.portrait, n, pal.line, on('portrait') ? 2.2 : 1.2);
      drawBbox(ctx, n, pal);
      T('肖像512・既存の1枚', n.x + n.w / 2, n.y + n.h + 12, fs.s, 700, pal.ink, 132, 'center');
      T('点線＝手動の枠320', n.x + n.w / 2, n.y + n.h + 28, fs.xs, 600, pal.accent, 132, 'center');
    } else {
      card(ctx, n, pal, { strong: on('portrait') });
      const s = n.h - 8;
      const r = { x: n.x + 4, y: n.y + 4, w: s, h: s };
      drawImageBox(ctx, media && media.portrait, r, pal.line);
      drawBbox(ctx, r, pal);
      const tx = n.x + s + 11;
      T('肖像512', tx, n.y + 14, fs.t, 800, pal.ink, n.w - s - 15);
      T('既存の1枚', tx, n.y + 33, fs.s, 600, pal.muted, n.w - s - 15);
      T('点線=手動枠', tx, n.y + 50, fs.xs, 600, pal.accent, n.w - s - 15);
    }
  }
  {
    const n = N.wav;
    ctx.globalAlpha = A('wav');
    card(ctx, n, pal, { strong: on('wav'), stroke: pal.aud });
    T(`WAV ${cs.inputWav.duration}秒`, n.x + 7, n.y + 12, fs.t, 800, pal.ink, n.w - 12);
    const wr = wide ? { x: n.x + 6, y: n.y + 24, w: n.w - 12, h: 38 } : { x: n.x + 6, y: n.y + 22, w: n.w - 12, h: 25 };
    drawWave(ctx, cs.sourceBins, wr, pal.aud, o.waveCursor);
    T(wide ? '既存の英語TTS・24k' : '既存の英語TTS', n.x + 7, n.y + n.h - 9, fs.xs, 600, pal.muted, n.w - 12);
  }

  // 3 顔を一度準備：手動枠→256、下半分を黒・全体
  {
    const n = N.prep;
    ctx.globalAlpha = A('prep');
    card(ctx, n, pal, { strong: on('prep'), stroke: pal.img });
    head(n, '顔を一度準備', 'left');
    const s = wide ? 56 : 34;
    const y0 = n.y + (wide ? 28 : 24);
    const r1 = { x: n.x + (wide ? 10 : 6), y: y0, w: s, h: s };
    const r2 = { x: r1.x + s + (wide ? 8 : 6), y: y0, w: s, h: s };
    drawImageBox(ctx, media && media.face, r1, pal.line);
    drawImageBox(ctx, media && media.masked, r2, pal.line);
    const cy = y0 + s + (wide ? 11 : 8);
    T('全体', r1.x + s / 2, cy, fs.xs, 700, pal.ink, s + 10, 'center');
    T('下半分黒', r2.x + s / 2, cy, fs.xs, 700, pal.ink, s + 14, 'center');
    const tx = r2.x + s + (wide ? 10 : 6);
    const tmax = n.x + n.w - tx - 4;
    T('手動枠', tx, y0 + (wide ? 12 : 9), fs.xs, 700, pal.muted, tmax);
    T('320→256', tx, y0 + (wide ? 30 : 25), fs.xs, 700, pal.muted, tmax);
    if (wide) T('検出なし', tx, y0 + 48, fs.xs, 600, pal.muted, tmax);
  }
  {
    const n = N.latent;
    const lit = Boolean(o.latentLit);
    ctx.globalAlpha = A('latent');
    card(ctx, n, pal, { strong: on('latent') || lit, stroke: lit ? pal.accent : pal.img });
    if (wide) {
      T('共有の潜在', n.x + 8, n.y + 13, fs.t, 800, pal.ink, n.w - 14);
      drawTiles(ctx, n.x + 14, n.y + 28, 22, pal, lit);
      T('1×8×32×32', n.x + 8, n.y + 70, fs.s, 700, pal.muted, n.w - 14);
      T('1回だけ・2件で再利用', n.x + 8, n.y + 84, fs.xs, 600, pal.muted, n.w - 14);
    } else {
      drawTiles(ctx, n.x + 5, n.y + 8, 6.5, pal, lit);
      T('共有の潜在', n.x + 44, n.y + 14, fs.t, 800, pal.ink, n.w - 48);
      T('1×8×32×32・1回', n.x + 44, n.y + 32, fs.s, 600, pal.muted, n.w - 48);
    }
  }

  // 2 声を区切る・特徴へ
  {
    const n = N.chunks;
    ctx.globalAlpha = A('chunks');
    card(ctx, n, pal, { strong: on('chunks'), stroke: pal.aud });
    head(n, '声を区切る', wide ? 'left' : 'right');
    drawTicks(ctx, { x: n.x + 8, y: n.y + (wide ? 28 : 24), w: n.w - 16, h: wide ? 22 : 16 }, pal.aud, wide ? 20 : 14);
    sub(n, `16kへ・20ms×${cs.complete}片`, wide ? 64 : 52, { weight: 700, color: pal.ink });
    sub(n, wide ? '原典の変換・文字にはしない' : '原典の16k変換', wide ? 82 : 66, { size: fs.xs });
  }
  {
    const n = N.whisper;
    ctx.globalAlpha = A('whisper');
    card(ctx, n, pal, { strong: on('whisper'), stroke: pal.aud });
    if (wide) {
      T('Whisper符号器', n.x + 8, n.y + 13, fs.t, 800, pal.ink, n.w - 14);
      drawGrid(ctx, n.x + 10, n.y + 26, 10, 3, 9, pal);
      T('特徴50×384/コマ', n.x + 8, n.y + 70, fs.s, 700, pal.muted, n.w - 14);
      T('復号器・文字起こしなし', n.x + 8, n.y + 85, fs.xs, 600, pal.muted, n.w - 14);
    } else {
      drawGrid(ctx, n.x + 6, n.y + 9, 4, 3, 6, pal);
      T('Whisper符号器', n.x + 42, n.y + 14, fs.t, 800, pal.ink, n.w - 46);
      T('特徴50×384', n.x + 42, n.y + 32, fs.s, 600, pal.muted, n.w - 46);
    }
  }

  // 4 特徴と顔が合流（U-Net 1回→VAE復号）
  {
    const n = N.unet;
    ctx.globalAlpha = A('unet');
    card(ctx, n, pal, { strong: on('unet') });
    head(n, 'U-Net t=0', 'left');
    if (wide) {
      sub(n, '1回の順伝播', 36, { color: pal.ink, weight: 700 });
      sub(n, '→VAE復号', 54, { color: pal.ink, weight: 700 });
      sub(n, '→顔の部分256', 72);
      sub(n, `${cs.calls.unet}回×${model.batch}コマ`, 92, { size: fs.xs });
    } else {
      sub(n, `1回→VAE復号・${cs.calls.unet}回`, 34, { color: pal.ink, weight: 700 });
    }
  }
  // 5 画像と音を組に
  {
    const n = N.queue;
    ctx.globalAlpha = A('queue');
    card(ctx, n, pal, { strong: on('queue') });
    head(n, '組にする', wide ? 'left' : 'right');
    if (wide) {
      sub(n, '顔の部分', 38, { color: pal.ink, weight: 700 });
      sub(n, '＋生の音2片', 56, { color: pal.aud, weight: 700 });
      sub(n, '40ms/コマ', 76, { size: fs.xs });
    } else {
      sub(n, '顔＋生音2片', 34, { color: pal.ink, weight: 700, max: n.w - 12 });
    }
  }
  // 6 貼る・送り出す
  {
    const n = N.paste;
    ctx.globalAlpha = A('paste');
    card(ctx, n, pal, { strong: on('paste') });
    if (wide) {
      head(n, '貼り戻す', 'left');
      const r = { x: n.x + 10, y: n.y + 28, w: 52, h: 52 };
      drawImageBox(ctx, media && media.mask, r, pal.line);
      T('マスク', r.x + r.w + 6, r.y + 18, fs.xs, 700, pal.muted, 40);
      T('320', r.x + r.w + 6, r.y + 34, fs.xs, 700, pal.muted, 40);
      sub(n, '待機＝元画像', 98, { color: pal.ink, weight: 700 });
      sub(n, '声＝貼り戻し', 116, { color: pal.ink, weight: 700 });
      sub(n, '＋透かし', 134);
    } else {
      head(n, '貼る・送り出す', 'left');
      const s = n.h - 8;
      const r = { x: n.x + n.w - s - 4, y: n.y + 4, w: s, h: s };
      drawImageBox(ctx, media && media.mask, r, pal.line);
      T('待機=元画像・声=貼り戻し＋透かし', n.x + 8, n.y + 33, fs.s, 600, pal.muted, n.w - s - 18);
    }
  }
  if (wide) {
    const w = N.webrtc;
    ctx.globalAlpha = A('webrtc');
    card(ctx, w, pal, { strong: on('webrtc') });
    T('WebRTCOutput', w.x + 8, w.y + 16, fs.t, 800, pal.ink, w.w - 14);
    T('原典の出力口', w.x + 8, w.y + 38, fs.s, 600, pal.muted, w.w - 14);
    const c = N.capture;
    ctx.globalAlpha = A('capture');
    card(ctx, c, pal, { strong: on('capture') });
    T('Disk捕捉', c.x + 8, c.y + 15, fs.t, 800, pal.ink, c.w - 14);
    T('制作担当の受け口', c.x + 8, c.y + 36, fs.s, 600, pal.muted, c.w - 14);
    T('PNG＋16k WAV', c.x + 8, c.y + 55, fs.xs, 700, pal.ink, c.w - 14);
  }

  // 返ったファイル：実際のPNG（代表5枚）とコマごとの帯
  {
    const n = N.strip;
    ctx.globalAlpha = A('strip');
    const rects = stripRects(n);
    cs.reps.forEach((f, i) => {
      const r = rects[i];
      drawImageBox(ctx, media && media.frames[cs.id][i], r, f.idle ? pal.idle : pal.accent, 1.6);
      const cfs = wide ? 11 : 10;
      chip(ctx, `#${f.index}`, r.x + 1, r.y + r.h - cfs - 5, { size: cfs, bg: f.idle ? pal.idle : pal.accent, color: '#fff' });
      if (f.idle) chip(ctx, '待機', r.x + 1, r.y + 1, { size: cfs, bg: pal.card, color: pal.ink });
    });
  }
  {
    const n = N.timeline;
    ctx.globalAlpha = A('timeline');
    const w = n.w / cs.frames;
    cs.frameIdle.forEach((idle, k) => {
      ctx.fillStyle = idle ? pal.idle : pal.accent;
      ctx.fillRect(n.x + k * w, n.y, Math.max(w - 0.3, 0.5), n.h);
    });
  }
  if (wide) {
    const m = N.mp4;
    ctx.globalAlpha = A('mp4');
    card(ctx, m, pal, { strong: on('mp4') });
    T(`MP4 ${cs.duration}秒・${cs.frames}コマ`, m.x + 8, m.y + 15, fs.t, 800, pal.ink, m.w - 14);
    T('H.264＋AAC 16k mono', m.x + 8, m.y + 36, fs.s, 600, pal.muted, m.w - 14);
    T('FFmpegで別に包む', m.x + 8, m.y + 55, fs.xs, 600, pal.muted, m.w - 14);
  } else {
    const f = N.files;
    ctx.globalAlpha = A('files');
    T(`MP4 ${cs.duration}秒・H264/AAC・WAV16k・${cs.frames}コマ`, f.x, f.y, fs.xs, 700, pal.ink, f.w);
  }
  {
    const u = N.use;
    ctx.globalAlpha = A('use');
    card(ctx, u, pal, { strong: on('use'), stroke: pal.ok });
    const gx = wide ? u.x + u.w - 30 : u.x + u.w / 2;
    const gy = wide ? u.y + u.h / 2 : u.y + 17;
    ctx.strokeStyle = pal.ok;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(gx, gy - 8);
    ctx.lineTo(gx, gy + 5);
    ctx.moveTo(gx - 6, gy);
    ctx.lineTo(gx, gy + 6);
    ctx.lineTo(gx + 6, gy);
    ctx.moveTo(gx - 8, gy + 10);
    ctx.lineTo(gx + 8, gy + 10);
    ctx.stroke();
    if (wide) {
      T('再生・保存', u.x + 10, u.y + 22, fs.t, 800, pal.ink, u.w - 50);
      T('照合した元のbytesのまま', u.x + 10, u.y + 46, fs.s, 600, pal.muted, u.w - 50);
    } else {
      T('保存', u.x + u.w / 2, u.y + u.h - 10, fs.s, 800, pal.ink, u.w - 4, 'center');
    }
  }

  // 番号①〜⑥（原典の該当行を開く部品）
  if (!o.hidePins) {
    for (const [num, [x, y]] of Object.entries(L.pins)) {
      ctx.globalAlpha = A(PART_NODES[num]);
      ctx.beginPath();
      ctx.arc(x, y, L.pinR, 0, Math.PI * 2);
      ctx.fillStyle = pal.ink;
      ctx.fill();
      T(num, x, y + 0.5, fs.s, 800, pal.paper, 20, 'center');
    }
  }

  // 横長の配置：右上は凡例か場面の見出し、エンジンの右下は短い凡例
  if (wide) {
    const c = N.caption;
    ctx.globalAlpha = 1;
    if (o.caption) {
      T(o.caption.title, c.x + 8, c.y + 14, 16, 800, pal.ink, c.w - 14);
      T(o.caption.line, c.x + 8, c.y + 35, fs.s, 600, pal.muted, c.w - 14);
    } else if (o.legend) {
      const rows = [
        [pal.ink, '実データ：画像・波形・回数・コマの帯'],
        [pal.aud, '説明の形：片・格子・タイル・動く印'],
      ];
      rows.forEach(([color, s], i) => {
        ctx.fillStyle = color;
        ctx.fillRect(c.x + 8, c.y + 9 + i * 20, 9, 9);
        T(s, c.x + 24, c.y + 14 + i * 20, fs.xs, 600, pal.ink, c.w - 30);
      });
    }
    if (o.miniLegend) {
      const g = N.legend;
      T('実データ：画像・波形', g.x, g.y + 10, 10.5, 700, pal.ink, g.w);
      T('回数・コマの帯', g.x, g.y + 25, 10.5, 700, pal.ink, g.w);
      T('説明の形：片・格子', g.x, g.y + 44, 10.5, 600, pal.muted, g.w);
      T('タイル・動く印', g.x, g.y + 59, 10.5, 600, pal.muted, g.w);
    }
  }

  // 動く印（説明用。実際の処理時間ではない）
  ctx.globalAlpha = 1;
  for (const t of o.tokens || []) drawToken(ctx, t, media, pal);
  ctx.restore();
}

export function drawToken(ctx, t, media, pal) {
  ctx.save();
  ctx.globalAlpha = t.alpha ?? 1;
  const s = t.s || 16;
  if (t.kind === 'doc') {
    roundRect(ctx, t.x - s * 0.4, t.y - s / 2, s * 0.8, s, 2);
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      ctx.moveTo(t.x - s * 0.24, t.y - s * 0.22 + i * s * 0.22);
      ctx.lineTo(t.x + s * 0.24, t.y - s * 0.22 + i * s * 0.22);
    }
    ctx.stroke();
  } else if (t.kind === 'img' && media) {
    const img = t.el || media[t.img];
    const w = t.w || s;
    const h = t.h || s;
    if (img) ctx.drawImage(img, t.x - w / 2, t.y - h / 2, w, h);
    ctx.strokeStyle = t.stroke || pal.img;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(t.x - w / 2, t.y - h / 2, w, h);
    if (t.tag) chip(ctx, t.tag, t.x - w / 2, t.y + h / 2 + 1, { size: t.tagSize || 10, bg: t.stroke || pal.img, color: '#fff' });
  } else if (t.kind === 'chunk') {
    // 生の音の片（説明の形）
    ctx.fillStyle = pal.aud;
    const n = t.n || 2;
    for (let i = 0; i < n; i += 1) {
      roundRect(ctx, t.x - (n * s * 0.36) / 2 + i * s * 0.36, t.y - s * 0.32, s * 0.28, s * 0.64, 2);
      ctx.fill();
    }
    if (t.tag) {
      // 名札は印の左に置く（右端の道でも画面の外に出ないように）。
      const size = t.tagSize || 10;
      setFont(ctx, size, 700);
      const w = ctx.measureText(t.tag).width + 6;
      chip(ctx, t.tag, t.x - (n * s * 0.36) / 2 - 3 - w, t.y - (size + 4) / 2, { size, bg: pal.aud, color: '#fff' });
    }
  } else if (t.kind === 'tiles') {
    drawTiles(ctx, t.x - s * 1.1, t.y - s * 0.55, s * 0.44, pal, true);
  } else if (t.kind === 'grid') {
    drawGrid(ctx, t.x - s * 0.7, t.y - s * 0.45, 4, 3, s * 0.26, pal);
  } else if (t.kind === 'patch' || t.kind === 'pair') {
    // 顔の部分（説明の形。実際の予測画像ではない）
    const w = s;
    ctx.fillStyle = pal.card;
    ctx.fillRect(t.x - w / 2, t.y - w / 2, w, w);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(t.x - w / 2, t.y - w / 2, w, w);
    ctx.fillStyle = pal.img;
    ctx.globalAlpha *= 0.55;
    ctx.fillRect(t.x - w / 2 + 2, t.y, w - 4, w / 2 - 2);
    ctx.globalAlpha = t.alpha ?? 1;
    if (t.kind === 'pair') {
      ctx.fillStyle = pal.aud;
      for (let i = 0; i < 2; i += 1) {
        roundRect(ctx, t.x + w / 2 + 3 + i * w * 0.32, t.y - w * 0.32, w * 0.22, w * 0.64, 2);
        ctx.fill();
      }
    }
  } else if (t.kind === 'dot') {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r || 4, 0, Math.PI * 2);
    ctx.fillStyle = t.color || pal.accent;
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- 作例ページ ---------- */

export function caseFromHash(hash) {
  let id = '';
  try {
    id = decodeURIComponent(String(hash || '').replace(/^#/, ''));
  } catch {
    id = '';
  }
  return CASE_IDS.includes(id) ? id : 'default';
}

const fmtBytes = (n) => `${n.toLocaleString('ja-JP')} B`;
const short = (h) => `${h.slice(0, 12)}…`;

function main() {
  const $ = (s) => document.querySelector(s);
  const els = {
    canvas: $('#concept'),
    map: $('#map'),
    status: $('#status'),
    detail: $('#state-detail'),
    retry: $('#retry'),
    failure: $('#failure'),
    saves: {
      mp4: $('#save-mp4'), wav: $('#save-wav'), record: $('#save-record'), portrait: $('#save-portrait'), input: $('#save-input'),
    },
    video: $('#result-video'),
    videoNote: $('#video-note'),
    inAudio: $('#input-audio'),
    outAudio: $('#output-audio'),
    audioNote: $('#audio-note'),
    images: { portrait: $('#img-portrait'), face: $('#img-face'), masked: $('#img-masked'), mask: $('#img-mask') },
    frames: $('#frames'),
    limit: $('#limit-note'),
    stageText: $('#stage-text'),
    inventory: $('#inventory'),
    proof: $('#proof'),
    dialog: $('#part-dialog'),
  };
  const stageButtons = [...document.querySelectorAll('button[data-stage]')];
  const caseButtons = [...document.querySelectorAll('button[data-case]')];
  const partButtons = [...document.querySelectorAll('button[data-part]')];
  const saveLinks = Object.values(els.saves);
  const ctx = els.canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    stage: 0, caseId: caseFromHash(location.hash), model: null, media: null, view: null,
    pal: readPalette(document.body), token: 0, saveUrls: [], raf: 0, start: performance.now(),
  };

  const setDisabled = (on) => {
    [...stageButtons, ...caseButtons, ...partButtons].forEach((b) => { b.disabled = on; });
    for (const a of saveLinks) {
      if (on) {
        a.removeAttribute('href');
        a.removeAttribute('download');
        a.setAttribute('aria-disabled', 'true');
      } else {
        a.removeAttribute('aria-disabled');
      }
    }
  };

  const stopMedia = () => {
    for (const m of [els.video, els.inAudio, els.outAudio]) {
      m.pause();
      m.removeAttribute('src');
      m.load();
    }
  };

  const revokeSaves = () => state.saveUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));

  const clearAll = () => {
    cancelAnimationFrame(state.raf);
    state.raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    stopMedia();
    Object.values(els.images).forEach((img) => img.removeAttribute('src'));
    els.frames.replaceChildren();
    els.inventory.replaceChildren();
    els.proof.replaceChildren();
    els.videoNote.textContent = '';
    els.audioNote.textContent = '';
    els.limit.textContent = '';
    revokeSaves();
    if (state.media) state.media.revoke();
    state.media = null;
    state.model = null;
    document.querySelectorAll('[data-fact]').forEach((n) => { n.textContent = '—'; });
    setDisabled(true);
  };

  const showFailure = (e) => {
    clearAll();
    const err = e instanceof VerifyError ? e : new VerifyError('表示を準備できません', String((e && e.message) || e));
    els.status.textContent = `${err.message}。図・動画・音声・保存を止めています。`;
    els.detail.textContent = err.detail;
    els.failure.hidden = false;
    els.retry.disabled = false;
    document.body.dataset.state = 'failed';
  };

  const sizeCanvas = () => {
    const width = els.map.clientWidth;
    if (!width) return;
    const wide = width >= 860;
    const layout = wide ? WIDE_LAYOUT : phoneLayout(width);
    // スマホの配置は幅そのもので作るので、倍率はほぼ1（300px未満のときだけ少し縮む）。
    const scale = width / layout.w;
    const height = Math.round(layout.h * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    els.canvas.style.height = `${height}px`;
    els.canvas.width = Math.round(width * dpr);
    els.canvas.height = Math.round(height * dpr);
    state.view = { layout, scale, dpr };
    document.body.dataset.layout = layout.kind;
    for (const b of partButtons.filter((p) => p.classList.contains('pin'))) {
      const [x, y] = layout.pins[b.dataset.part];
      b.style.left = `${x * scale - 22}px`;
      b.style.top = `${y * scale - 22}px`;
    }
  };

  const tokensFor = (stage, u, L, cs) => {
    const E = L.edges;
    const media = state.media;
    if (stage === 0) {
      const [x, y] = along(L.actorsPath, u);
      return [{ kind: 'doc', x, y, s: 16 }];
    }
    if (stage === 1) {
      if (u < 0.5) {
        const v = u / 0.5;
        const [ix, iy] = along(E.portrait_prep, v);
        const [ax, ay] = along(E.wav_chunks, v);
        return [{ kind: 'img', img: 'face', x: ix, y: iy, s: 20 }, { kind: 'chunk', x: ax, y: ay, s: 16 }];
      }
      const v = (u - 0.5) / 0.5;
      const [lx, ly] = along(E.prep_latent, v);
      const [wx, wy] = along(E.chunks_whisper, v);
      const [bx, by] = along(E.raw_bypass, v * 0.6);
      return [
        { kind: 'img', img: 'masked', x: lx - 11, y: ly, s: 18 },
        { kind: 'img', img: 'face', x: lx + 11, y: ly, s: 18 },
        { kind: 'grid', x: wx, y: wy, s: 18 },
        { kind: 'chunk', x: bx, y: by, s: 18 },
      ];
    }
    const out = [];
    const [bx, by] = along(E.raw_bypass, u / 0.6);
    const [cx, cy] = along(E.canvas_bypass, u / 0.75);
    if (u < 0.6) out.push({ kind: 'chunk', x: bx, y: by, s: 18 });
    if (u < 0.75) out.push({ kind: 'img', img: 'portrait', x: cx, y: cy, s: 20 });
    if (u < 0.35) {
      const [lx, ly] = along(E.latent_unet, u / 0.35);
      const [wx, wy] = along(E.whisper_unet, u / 0.35);
      out.push({ kind: 'tiles', x: lx, y: ly, s: 14 }, { kind: 'grid', x: wx, y: wy, s: 16 });
    } else if (u < 0.6) {
      const [px, py] = along(E.unet_queue, (u - 0.35) / 0.25);
      out.push({ kind: 'patch', x: px, y: py, s: 16 });
    } else if (u < 0.75) {
      const [qx, qy] = along(E.queue_paste, (u - 0.6) / 0.15);
      out.push({ kind: 'pair', x: qx, y: qy, s: 14 });
    } else {
      const [ox, oy] = along(L.outPath, (u - 0.75) / 0.25);
      out.push({ kind: 'img', el: media.frames[cs.id][1], x: ox, y: oy, s: 22, stroke: state.pal.accent });
    }
    return out;
  };

  const draw = (now) => {
    if (!state.model || !state.view) return;
    const { layout, scale, dpr } = state.view;
    const cs = state.model.cases[state.caseId];
    const still = reduce.matches;
    const u = (((now - state.start) / 1000) % 4.2) / 4.2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    drawMap(ctx, state.model, state.media, {
      layout, pal: state.pal, caseId: state.caseId, focus: STAGES[state.stage].focus,
      legend: true, tokens: still ? [] : tokensFor(state.stage, u, layout, cs),
    });
  };

  const loop = (now) => {
    draw(now);
    state.raf = reduce.matches || document.hidden ? 0 : requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!state.model) return;
    cancelAnimationFrame(state.raf);
    state.raf = 0;
    if (reduce.matches || document.hidden) draw(performance.now());
    else state.raf = requestAnimationFrame(loop);
  };

  const setFact = (key, value) => document.querySelectorAll(`[data-fact="${key}"]`).forEach((n) => { n.textContent = value; });

  const fillFacts = () => {
    const m = state.model;
    setFact('count', String(m.manifest.files.length));
    setFact('bbox', `[${BBOX.join(', ')}]`);
    setFact('total-frames', String(m.totals.frames));
    setFact('total-pasted', String(m.totals.pasted));
    setFact('total-idle', String(m.totals.idle));
    setFact('total-predictions', String(m.totals.predictions));
  };

  const row = (dl, k, v) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  };

  const fillProof = () => {
    const m = state.model;
    const env = m.results.environment;
    const dl = document.createElement('dl');
    row(dl, '原典', `${SOURCE_REPOSITORY} @ ${SOURCE_COMMIT.slice(0, 7)}（Apache-2.0）。実行は全${FULL_CHECKOUT}ファイルのcheckout。同梱は選んだ${SELECTED_SOURCES}ファイル（ランナーが照合する${RUNNER_PATHS}パスを含む。同梱分だけでの再実行はしていません）`);
    row(dl, '実行した範囲', 'MuseReal＋WhisperASR＋BaseAvatar のオフライン描画。原典の WebRTCOutput の受け手を Disk捕捉 にして、画像と音を保存');
    row(dl, 'モデル（配布なし）', `MuseTalk V1.5 @ 2bcb936（MIT）・sd-vae-ft-mse @ 31f26fd（MIT）・whisper-tiny @ 169d4a4（Apache-2.0）。公開・ゲートなしの11ファイル ${fmtBytes(m.modelBytes)}`);
    row(dl, '環境', `Python ${env.python}・torch ${env.packages.torch}・CPU float32・スレッド ${env.torch_runtime.num_threads}・seed ${SEED}`);
    row(dl, '共有の潜在', `1×8×32×32・seed ${SEED} で1回だけ（VAE符号化 2回）。2件で同じものを再利用（SHA-256 ${short(m.facts.latent.tensor_sha256)}、非公開）`);
    for (const id of CASE_IDS) {
      const c = m.cases[id];
      row(dl, `${c.label}（${id}）`,
        `捕捉 ${c.frames}コマ・${c.chunks}片・${c.duration}秒（先頭の待機 ${c.prefix}片・入力 ${c.complete}片・末尾 ${c.tail}片）。` +
        `貼り戻し ${c.pasted}コマ・元画像 ${c.idle}コマ。Whisper符号器 ${c.calls.whisper}回（うち終了の合図の後 ${c.calls.whisperAfterQuit}回）・U-Net ${c.calls.unet}回・VAE復号 ${c.calls.vaeDec}回（各${m.batch}コマ）。` +
        `捕捉の外へ押し出された ${c.beyond.frames}コマ・${c.beyond.chunks}片（MP4に入れていません）。描画の開始から返るまで ${c.wall.toFixed(1)} 秒（1回の測定）`);
    }
    row(dl, '合計', `${m.totals.frames}コマのうち貼り戻し ${m.totals.pasted}・元画像 ${m.totals.idle}。U-Net の予測は ${m.totals.unet}回×${m.batch}＝${m.totals.predictions}枚（混ざったバッチの一部は使われていません）`);
    row(dl, '時間の注意', 'CPU での1回の観測で、リアルタイム性能やベンチマークではありません。図と解説動画の動きも構造の説明で、処理時間ではありません。');
    els.proof.replaceChildren(dl);

    const items = m.manifest.files.map((a) => {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = a.path;
      li.append(code, ` ${fmtBytes(a.bytes)}・${short(a.sha256)}`);
      return li;
    });
    els.inventory.replaceChildren(...items);
  };

  const renderCase = () => {
    const m = state.model;
    const cs = m.cases[state.caseId];
    caseButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.case === state.caseId)));
    stopMedia();
    revokeSaves();
    const make = (path, type) => {
      const u = URL.createObjectURL(new Blob([m.files.get(path)], { type }));
      state.saveUrls.push(u);
      return u;
    };
    const mp4Url = make(cs.mp4.path, 'video/mp4');
    const outUrl = make(cs.outputWav.path, 'audio/wav');
    const inUrl = make(cs.inputWav.path, 'audio/wav');
    const S = els.saves;
    S.mp4.href = mp4Url;
    S.mp4.download = `livetalking-${cs.id}.mp4`;
    S.wav.href = outUrl;
    S.wav.download = `livetalking-${cs.id}-captured-16k.wav`;
    S.record.href = make(cs.record.path, 'application/json');
    S.record.download = `livetalking-${cs.id}.json`;
    S.portrait.href = make(m.paths.portrait, 'image/png');
    S.portrait.download = 'livetalking-portrait.png';
    S.input.href = inUrl;
    S.input.download = `livetalking-${cs.id}-input.wav`;
    document.querySelectorAll('[data-case-label]').forEach((n) => { n.textContent = cs.label; });

    els.video.src = mp4Url;
    els.inAudio.src = inUrl;
    els.outAudio.src = outUrl;
    const v = cs.mp4.video;
    const a = cs.mp4.audio;
    els.videoNote.textContent =
      `保存済みの「${cs.label}」：512×512・${v.frames}コマ・25fps・${cs.duration}秒・${v.codec.toUpperCase()} ${v.profile}＋${a.codec.toUpperCase()} ${a.rate / 1000}kHz mono・` +
      `${fmtBytes(cs.mp4.bytes)}・SHA-256 ${short(cs.mp4.sha256)}。原典が押し出した画像と音を捕捉し、別の工程の FFmpeg で包んだものです。`;
    els.audioNote.textContent =
      `入力は既存の英語TTSのWAV（${cs.inputWav.rate / 1000}kHz・${cs.inputWav.duration}秒）。出力は捕捉した16kHzのWAV（${cs.duration}秒）で、` +
      `先頭の${cs.prefix}片（${cs.prefix * 20}ms）と末尾の${cs.tail}片（${cs.tail * 20}ms）は原典が出した無音のままです。人の耳での確認はしていません。`;

    const figs = cs.reps.map((f, i) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = state.media.frames[cs.id][i].src;
      img.width = 512;
      img.height = 512;
      img.alt = f.idle ? `コマ #${f.index}：元の画像と透かし（待機のコマ）` : `コマ #${f.index}：貼り戻した出力`;
      const cap = document.createElement('figcaption');
      cap.textContent = `#${f.index}・${f.time.toFixed(2)}秒・${f.idle ? '待機＝元画像＋透かし' : '貼り戻し'}`;
      fig.append(img, cap);
      return fig;
    });
    els.frames.replaceChildren(...figs);
    els.limit.textContent = m.facts.observed_visual_limit;
    kick();
  };

  const setStage = (n) => {
    state.stage = n;
    stageButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === n)));
    els.stageText.querySelectorAll('[data-stage-text]').forEach((p) => { p.hidden = Number(p.dataset.stageText) !== n; });
    kick();
  };

  const setCase = (id, pushHash) => {
    state.caseId = CASE_IDS.includes(id) ? id : 'default';
    if (pushHash) history.replaceState(null, '', `#${state.caseId}`);
    caseButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.case === state.caseId)));
    if (state.model) renderCase();
  };

  const load = async () => {
    const token = ++state.token;
    clearAll();
    els.failure.hidden = true;
    els.retry.disabled = true;
    els.detail.textContent = '';
    document.body.dataset.state = 'loading';
    els.status.textContent = '保存済みのファイルを確かめています…';
    try {
      const model = await verifyAll((done, total) => {
        if (token === state.token && document.body.dataset.state === 'loading') {
          els.status.textContent = `保存済みのファイルを確かめています… ${done}/${total}`;
        }
      });
      if (token !== state.token) return;
      const media = await loadMedia(model);
      if (token !== state.token) { media.revoke(); return; }
      state.model = model;
      state.media = media;
      for (const k of Object.keys(els.images)) els.images[k].src = media[k].src;
      setDisabled(false);
      fillFacts();
      fillProof();
      sizeCanvas();
      setStage(state.stage);
      renderCase();
      document.body.dataset.state = 'ready';
      els.status.textContent = `${model.manifest.files.length}ファイルの大きさと SHA-256、原典の8引用、記録どうしを自動で照合しました（人の目視・聴取の承認ではありません）。`;
    } catch (e) {
      if (token === state.token) showFailure(e);
    }
  };

  els.video.addEventListener('loadedmetadata', () => {
    if (!state.model || !els.video.getAttribute('src')) return;
    const v = els.video;
    const cs = state.model.cases[state.caseId];
    if (v.videoWidth && (v.videoWidth !== 512 || v.videoHeight !== 512 || Math.abs(v.duration - cs.duration) > 0.1)) {
      showFailure(new VerifyError('動画の寸法が記録と違います', `ブラウザーでは ${v.videoWidth}×${v.videoHeight}・${v.duration} 秒として読めました`));
    }
  });
  els.video.addEventListener('error', () => {
    if (!state.model || !els.video.getAttribute('src')) return;
    els.videoNote.textContent += ' このブラウザーではこの MP4 を再生できませんでした。保存はできます。';
  });

  stageButtons.forEach((b) => b.addEventListener('click', () => setStage(Number(b.dataset.stage))));
  caseButtons.forEach((b) => b.addEventListener('click', () => setCase(b.dataset.case, true)));
  window.addEventListener('hashchange', () => setCase(caseFromHash(location.hash), false));
  saveLinks.forEach((a) => a.addEventListener('click', (ev) => {
    if (!a.getAttribute('href')) {
      ev.preventDefault();
      return;
    }
    els.status.textContent = `ブラウザーに保存を依頼しました（${a.download}）。`;
  }));
  els.retry.addEventListener('click', load);

  partButtons.forEach((b) => b.addEventListener('click', () => {
    if (!state.model) return;
    const num = Number(b.dataset.part);
    const part = state.model.parts[num - 1];
    const d = els.dialog;
    d.querySelector('#part-title').textContent = `${num}　${part.title}`;
    d.querySelector('#part-meaning').textContent = PART_MEANING[num];
    d.querySelector('#part-sources').replaceChildren(...part.refs.map((id) => {
      const s = state.model.refs[id];
      const sec = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = `${s.source_path}　${s.line_start}–${s.line_end}行`;
      const note = document.createElement('p');
      note.textContent = s.note_ja;
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = s.excerpt.split('\n').map((line, i) => `${String(s.line_start + i).padStart(3, ' ')}  ${line}`).join('\n');
      pre.append(code);
      pre.tabIndex = 0;
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = s.url;
      a.rel = 'noopener';
      a.target = '_blank';
      a.textContent = '固定版の原典で開く（GitHub）';
      const local = document.createElement('a');
      local.href = s.path;
      local.textContent = '同梱の原文';
      p.append(a, '・', local);
      sec.append(h, note, pre, p);
      return sec;
    }));
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }));
  els.dialog.querySelector('[data-close]').addEventListener('click', () => {
    if (typeof els.dialog.close === 'function') els.dialog.close();
    else els.dialog.removeAttribute('open');
  });

  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state.model) return;
      sizeCanvas();
      kick();
    }, 60);
  }).observe(els.map);
  reduce.addEventListener('change', kick);
  document.addEventListener('visibilitychange', kick);

  setStage(0);
  caseButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.case === state.caseId)));
  load();
}

if (typeof document !== 'undefined' && document.body && document.body.dataset.app === 'livetalking-main') {
  main();
}
