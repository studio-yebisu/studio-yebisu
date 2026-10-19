// LivePortrait 作例の共通部：保存済みファイルの照合、構造図の配置と描画、作例ページの初期化。
// video/main.js と video/draw.js も同じ関数を読み込む。ページの初期化は body[data-app="liveportrait-main"] のときだけ動く。
// ブラウザーでは推論・合成・エンコードをしない。固定された実ファイルを確かめて見せ、保存をブラウザーに渡すだけ。

export const ROOT = new URL('./', import.meta.url);
export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = '266ed258f405089952e35427eee33e7bf28754ff7817ddec428073b2c95472a2';
export const MANIFEST_COUNT = 48;
export const CASE_IDS = ['yaw08', 'yaw16'];
export const SOURCE_REPOSITORY = 'KlingAIResearch/LivePortrait';
export const SOURCE_COMMIT = '9b294b3d0536135442ea73cb01e6cb3ca7029dd3';
export const PUBLIC_INDICES = [0, 9, 18, 26, 35];
const REPO_BLOB = `https://github.com/${SOURCE_REPOSITORY}/blob/${SOURCE_COMMIT}/`;
const PART_IDS = ['prepare', 'appearance', 'motion', 'stitch', 'warp', 'decode'];
const EXPECTED_CALLS = {
  LivePortraitWrapper: 1, prepare_source: 1, get_kp_info: 1, extract_feature_3d: 1,
  transform_keypoint: 73, stitching: 72, warp_decode: 72, parse_output: 72,
};
const EXPECTED_AMPLITUDE = { yaw08: 8, yaw16: 16 };
const REQUIRED_PATHS = [
  'concept/facts.json', 'outputs/results.json', 'inputs/jobs.json', 'inputs/preparation.json',
  'inputs/mona-lisa-original.jpg', 'inputs/portrait-crop.png', 'UPSTREAM.json',
  'vendor/liveportrait/LICENSE', 'vendor/liveportrait/readme.md',
];

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

function same(a, b, detail) {
  if (JSON.stringify(a) !== JSON.stringify(b)) fail('記録どうしが一致しません', detail);
}

function check(cond, detail) {
  if (!cond) fail('記録どうしが一致しません', detail);
}

function isPoints(arr, n) {
  return Array.isArray(arr) && arr.length === n &&
    arr.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite));
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
  check(m && m.schema === 'liveportrait-assets@1', 'concept/manifest.json の schema が違います');
  check(m.case_id === 'liveportrait-example', 'concept/manifest.json の case_id が違います');
  check(m.count === MANIFEST_COUNT && Array.isArray(m.assets) && m.assets.length === MANIFEST_COUNT,
    `concept/manifest.json のファイル数が ${MANIFEST_COUNT} ではありません`);
  const seen = new Set();
  for (const a of m.assets) {
    const ok = a && typeof a.path === 'string' && /^[A-Za-z0-9._/-]+$/.test(a.path) &&
      !a.path.startsWith('/') && !a.path.split('/').includes('..') &&
      Number.isInteger(a.bytes) && a.bytes >= 0 && /^[0-9a-f]{64}$/.test(a.sha256);
    check(ok, `concept/manifest.json の項目の形が違います: ${a && a.path}`);
    check(!seen.has(a.path), `concept/manifest.json に重複があります: ${a.path}`);
    seen.add(a.path);
  }
  for (const p of REQUIRED_PATHS) check(seen.has(p), `concept/manifest.json に ${p} がありません`);
}

// MP4 の箱を読み、映像トラックの数・コマ数・長さ・寸法を取り出す（デコードはしない）。
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
    const handler = String.fromCharCode(...new Uint8Array(buf, hdlr.body + 8, 4));
    tracks.push({
      handler,
      width: view.getUint32(tkhd.end - 8) / 65536,
      height: view.getUint32(tkhd.end - 4) / 65536,
      seconds: timescale ? duration / timescale : NaN,
      samples: view.getUint32(stsz.body + 8),
    });
  }
  return { topTypes: top.map((b) => b.type), tracks };
}

function pngHeader(buf, path) {
  const b = new Uint8Array(buf);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const type = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (b.length < 33 || sig.some((v, i) => b[i] !== v) || type !== 'IHDR') fail('画像の形が記録と違います', `${path} は PNG ではありません`);
  const view = new DataView(buf);
  return { width: view.getUint32(16), height: view.getUint32(20), bitDepth: b[24], colorType: b[25] };
}

function jpegSize(buf, path) {
  const view = new DataView(buf);
  if (view.getUint16(0) !== 0xffd8) fail('画像の形が記録と違います', `${path} は JPEG ではありません`);
  let p = 2;
  while (p + 9 < buf.byteLength) {
    if (view.getUint8(p) !== 0xff) { p += 1; continue; }
    const marker = view.getUint8(p + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
    const len = view.getUint16(p + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) return { height: view.getUint16(p + 5), width: view.getUint16(p + 7), components: view.getUint8(p + 9) };
    p += 2 + len;
  }
  fail('画像の形が記録と違います', `${path} に寸法の情報がありません`);
}

function schedule(amplitude, n) {
  return Array.from({ length: n }, (_, i) =>
    (i === 0 || i === n - 1) ? 0 : Math.round(amplitude * Math.sin((2 * Math.PI * i) / (n - 1)) * 1e6) / 1e6);
}

function crossCheck(manifest, files) {
  const sha = new Map(manifest.assets.map((a) => [a.path, a.sha256]));
  const size = new Map(manifest.assets.map((a) => [a.path, a.bytes]));
  const json = (p) => parseJson(files.get(p), p);
  const listed = (p, h, b, label) => {
    check(sha.has(p), `${label}: ${p} が一覧にありません`);
    check(sha.get(p) === h, `${label}: ${p} の SHA-256 が一覧と違います`);
    if (b !== undefined) check(size.get(p) === b, `${label}: ${p} の大きさが一覧と違います`);
  };

  const facts = json('concept/facts.json');
  const results = json('outputs/results.json');
  const jobsSpec = json('inputs/jobs.json');
  const prep = json('inputs/preparation.json');
  const upstream = json('UPSTREAM.json');

  check(facts.schema === 'liveportrait-actual-facts@1', 'concept/facts.json の schema が違います');
  check(results.schema === 'studio-yebisu/liveportrait-example/results@1', 'outputs/results.json の schema が違います');
  check(facts.identity.source_repository === SOURCE_REPOSITORY && facts.identity.source_commit === SOURCE_COMMIT,
    '原典の固定コミットが違います');
  check(upstream.repository === SOURCE_REPOSITORY && upstream.commit === SOURCE_COMMIT, 'UPSTREAM.json の固定コミットが違います');
  check(Array.isArray(upstream.selected_source_files) && upstream.selected_source_files.length === 22,
    'UPSTREAM.json の選択ファイルが22件ではありません');
  for (const f of upstream.selected_source_files) {
    listed(f.path, f.sha256, f.bytes, 'UPSTREAM.json');
    check(f.path === `vendor/liveportrait/${f.source_path}`, `UPSTREAM.json の置き場所が違います: ${f.path}`);
  }

  const rt = facts.runtime;
  listed(rt.results_path, rt.results_sha256, rt.results_bytes, 'facts.runtime');
  same(rt.calls, EXPECTED_CALLS, '呼び出し回数が想定と違います（facts）');
  same(results.calls, EXPECTED_CALLS, '呼び出し回数が想定と違います（results）');
  same(rt.environment, results.environment, '実行環境の記録が一致しません');
  same(rt.config, results.config, '設定の記録が一致しません');
  same(rt.loaded_networks, results.loaded_networks, '読み込んだネットワークの記録が一致しません');
  same(rt.timings_seconds, results.timings_seconds, '時間の記録が一致しません');
  const nets = rt.loaded_networks;
  for (const k of ['appearance_feature_extractor', 'motion_extractor', 'warping_module', 'spade_generator', 'stitching_retargeting_module.stitching']) {
    check(nets[k] && nets[k].executed === true, `${k} の実行記録がありません`);
  }
  check(nets['stitching_retargeting_module.lip'].executed === false && nets['stitching_retargeting_module.eye'].executed === false,
    '目と口の retargeting は呼んでいない記録のはずです');
  check(rt.config.device === 'cpu' && rt.config.flag_use_half_precision === false && rt.config.flag_stitching === true,
    '実行設定が想定と違います');

  // 入力と手動クロップ
  const orig = facts.input.original;
  const prepared = facts.input.prepared;
  listed(orig.path, orig.sha256, orig.bytes, 'facts.input.original');
  listed(prepared.path, prepared.sha256, prepared.bytes, 'facts.input.prepared');
  same(orig, results.source.original, '元画像の記録が一致しません');
  same(prepared, results.source.prepared, '準備した入力の記録が一致しません');
  same(facts.preparation, prep, 'inputs/preparation.json が facts と一致しません');
  same(orig.crop_box_pil_edges, jobsSpec.source.preparation.crop_box_pil_edges, '手動クロップの枠が一致しません');
  check(prep.output.sha256 === prepared.sha256 && prepared.rederived_from_original_pixel_equal === true,
    '準備した入力の再計算記録が一致しません');
  const ji = jpegSize(files.get(orig.path), orig.path);
  check(ji.width === orig.size[0] && ji.height === orig.size[1], `${orig.path} の寸法が記録と違います`);
  const ci = pngHeader(files.get(prepared.path), prepared.path);
  check(ci.width === prepared.size[0] && ci.height === prepared.size[1] && ci.colorType === 2 && ci.bitDepth === 8,
    `${prepared.path} の寸法か形式が記録と違います`);
  same(rt.config.input_shape, [256, 256], '元APIの入力寸法が256×256ではありません');

  // 1回だけの推定
  const si = rt.source_inference;
  same(si, results.source_inference, '入力からの推定の記録が一致しません');
  check(isPoints(si.kp_canonical_21x3, 21) && isPoints(si.x_source_21x3, 21) && isPoints(si.exp_21x3, 21),
    '21点の配列の形が違います');
  check(si.feature_3d.sha256_f32le === si.feature_3d.sha256_f32le_after_all_frames,
    'F の特徴が全コマの前後で同じ記録になっていません');
  same(si.feature_3d.shape, [1, 32, 16, 64, 64], 'F の特徴の形が違います');
  same(rt.warp_decode_returned_shapes.out, [1, 3, 512, 512], 'G の出力の形が違います');

  // 2つの固定ジョブ
  same(facts.jobs.map((j) => j.id), CASE_IDS, 'facts のジョブが yaw08・yaw16 ではありません');
  same(results.jobs.map((j) => j.id), CASE_IDS, 'results のジョブが yaw08・yaw16 ではありません');
  same(jobsSpec.jobs.map((j) => j.id), CASE_IDS, 'inputs/jobs.json のジョブが yaw08・yaw16 ではありません');
  same(jobsSpec.public_frame_indices, PUBLIC_INDICES, '代表コマの番号が違います');

  const cases = {};
  let bound = 0;
  const grow = (pts) => pts.forEach(([x, y]) => { bound = Math.max(bound, Math.abs(x), Math.abs(y)); });
  grow(si.kp_canonical_21x3);
  grow(si.x_source_21x3);

  CASE_IDS.forEach((id, i) => {
    const fj = facts.jobs[i];
    const rj = results.jobs[i];
    const sj = jobsSpec.jobs[i];
    const amp = EXPECTED_AMPLITUDE[id];
    const n = 36;
    check(fj.amplitude_degrees === amp && rj.amplitude_degrees === amp && sj.control.amplitude_degrees === amp,
      `${id} の振幅が記録と違います`);
    check(fj.frames === n && rj.frames === n && sj.frames === n && fj.fps === 12 && rj.fps === 12 && sj.fps === 12 &&
      fj.duration_seconds === 3, `${id} のコマ数・fps・長さが記録と違います`);
    check(sj.source === prepared.path && rj.source === prepared.path, `${id} の入力が共通の1枚ではありません`);
    check(sj.stitching === true && rj.stitching === true, `${id} の stitching 設定が違います`);
    const expected = schedule(amp, n);
    same(fj.offsets, rj.yaw_offsets_degrees, `${id} の角度の値が facts と results で違います`);
    check(fj.offsets.length === n && fj.offsets.every((v, k) => Math.abs(v - expected[k]) <= 1.5e-6),
      `${id} の角度の値が round(振幅·sin(2πi/35), 6) と違います`);

    listed(fj.video.path, fj.video.sha256, fj.video.bytes, `${id} の動画`);
    listed(fj.job_json.path, fj.job_json.sha256, fj.job_json.bytes, `${id} の記録JSON`);
    check(rj.video.sha256 === fj.video.sha256 && rj.video.bytes === fj.video.bytes, `${id} の動画の記録が一致しません`);
    check(rj.video.audio_streams === 0 && rj.video.video_streams === 1 && rj.video.decoded_frames === n &&
      rj.video.width === 512 && rj.video.height === 512 && rj.video.stream_duration_seconds === 3 &&
      rj.video.moov_before_mdat === true, `${id} の動画の測定記録が想定と違います`);

    const mp4 = parseMp4(files.get(fj.video.path), fj.video.path);
    same(mp4.topTypes, rj.video.top_level_boxes, `${id} の MP4 の箱の並びが記録と違います`);
    check(mp4.tracks.length === 1 && mp4.tracks[0].handler === 'vide', `${id} の MP4 に映像以外のトラックがあります`);
    const tr = mp4.tracks[0];
    check(tr.samples === n && Math.abs(tr.seconds - 3) < 0.02 && tr.width === 512 && tr.height === 512,
      `${id} の MP4 が36コマ・3秒・512×512ではありません`);

    const pj = json(fj.job_json.path);
    same(pj.source, results.source, `${id} の記録JSONの入力が一致しません`);
    same(pj.source_inference, si, `${id} の記録JSONの推定が一致しません`);
    same(pj.job, rj, `${id} の記録JSONが results のジョブと一致しません`);

    check(Array.isArray(rj.frame_records) && rj.frame_records.length === n, `${id} のコマの記録が36件ではありません`);
    rj.frame_records.forEach((r, k) => {
      check(r.index === k && r.yaw_offset_degrees === fj.offsets[k], `${id} のコマ ${k} の記録が一致しません`);
      same(r.png.size, [512, 512], `${id} のコマ ${k} が512×512ではありません`);
    });
    check(rj.frame_records[0].keypoints.pre_stitch_max_abs_diff_from_x_source === 0, `${id} の1コマ目の点が入力と一致しません`);

    same(fj.public_frames.map((f) => f.index), PUBLIC_INDICES, `${id} の代表コマが違います`);
    same(rj.public_frames.map((f) => f.index), PUBLIC_INDICES, `${id} の代表コマが違います`);
    const publicFrames = fj.public_frames.map((f, k) => {
      listed(f.path, f.sha256, undefined, `${id} の代表コマ`);
      check(rj.frame_records[f.index].png.sha256 === f.sha256 && rj.public_frames[k].sha256 === f.sha256,
        `${id} の代表コマ ${f.index} の記録が一致しません`);
      const h = pngHeader(files.get(f.path), f.path);
      check(h.width === 512 && h.height === 512 && h.colorType === 2 && h.bitDepth === 8, `${f.path} が512×512のRGBではありません`);
      return { index: f.index, time: f.time_seconds, path: f.path, sha256: f.sha256, bytes: size.get(f.path), offset: fj.offsets[f.index] };
    });
    check(fj.first_last_png_all_bytes_equal === (sha.get(publicFrames[0].path) === sha.get(publicFrames[4].path)),
      `${id} の最初と最後のコマの記録が一致しません`);

    check(isPoints(fj.target_keypoints_36x21x3?.[0], 21) && fj.target_keypoints_36x21x3.length === n &&
      fj.target_keypoints_36x21x3.every((f) => isPoints(f, 21)), `${id} の変換後の21点の形が違います`);
    check(fj.stitched_keypoints_36x21x3?.length === n && fj.stitched_keypoints_36x21x3.every((f) => isPoints(f, 21)),
      `${id} の補正後の21点の形が違います`);
    const d0 = Math.max(...fj.target_keypoints_36x21x3[0].flat().map((v, k) => Math.abs(v - si.x_source_21x3.flat()[k])));
    check(d0 <= 1e-12, `${id} の1コマ目の変換後の点が入力の点と一致しません`);
    fj.target_keypoints_36x21x3.forEach(grow);
    fj.stitched_keypoints_36x21x3.forEach(grow);

    cases[id] = {
      id,
      label: fj.label,
      amplitude: amp,
      frames: n,
      fps: fj.fps,
      duration: fj.duration_seconds,
      offsets: fj.offsets,
      target: fj.target_keypoints_36x21x3,
      stitched: fj.stitched_keypoints_36x21x3,
      publicFrames,
      firstLastEqual: fj.first_last_png_all_bytes_equal,
      timings: fj.timings_seconds,
      video: { path: fj.video.path, bytes: fj.video.bytes, sha256: fj.video.sha256, record: rj.video, mp4: tr },
      jobJson: { path: fj.job_json.path, bytes: fj.job_json.bytes, sha256: fj.job_json.sha256 },
      records: rj.frame_records,
    };
  });

  // 番号付きの6部品：引用が同梱した原典の該当行と同じか
  same(facts.parts.map((p) => p.id), PART_IDS, '6部品の並びが違います');
  facts.parts.forEach((part, i) => {
    check(part.number === i + 1 && Array.isArray(part.sources) && part.sources.length > 0, `部品 ${part.id} の形が違います`);
    for (const s of part.sources) {
      check(s.path === `vendor/liveportrait/${s.source_path}` && files.has(s.path), `部品 ${part.id} の原典ファイルがありません`);
      check(s.url === `${REPO_BLOB}${s.source_path}#L${s.start_line}`, `部品 ${part.id} のリンクが固定版を指していません`);
      const lines = decodeText(files.get(s.path), s.path).split(/\r?\n/);
      const quoted = lines.slice(s.start_line - 1, s.end_line).join('\n');
      check(s.end_line >= s.start_line && quoted === s.excerpt, `部品 ${part.id} の引用が ${s.source_path} の ${s.start_line}–${s.end_line} 行と違います`);
    }
  });

  return {
    manifest, files, sha, size, facts, results, jobsSpec, prep, upstream, cases,
    parts: facts.parts,
    pose: si.pose_degrees,
    canonical: si.kp_canonical_21x3,
    xSource: si.x_source_21x3,
    featureShape: si.feature_3d.shape,
    outShape: rt.warp_decode_returned_shapes.out,
    inputShape: rt.config.input_shape,
    bound: bound * 1.08,
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
  await pool(manifest.assets, 6, async (a) => {
    const buf = await fetchBytes(a.path);
    if (buf.byteLength !== a.bytes) fail('ファイルの大きさが記録と違います', `${a.path}: ${buf.byteLength} B（記録は ${a.bytes} B）`);
    if ((await sha256Hex(buf)) !== a.sha256) fail('ファイルの中身が記録と違います', `${a.path} の SHA-256 が一致しません`);
    files.set(a.path, buf);
    done += 1;
    onProgress(done, manifest.assets.length);
  });
  return crossCheck(manifest, files);
}

// 照合したバイト列だけから画像を作る。寸法が記録と違えば止める。
export async function loadMedia(model) {
  const urls = [];
  const blobUrl = (path, type) => {
    const u = URL.createObjectURL(new Blob([model.files.get(path)], { type }));
    urls.push(u);
    return u;
  };
  const image = async (path, type, w, h) => {
    const el = new Image();
    el.decoding = 'async';
    el.src = blobUrl(path, type);
    try {
      await el.decode();
    } catch {
      fail('画像を表示できません', `${path} をデコードできません`);
    }
    if (el.naturalWidth !== w || el.naturalHeight !== h) {
      fail('画像の寸法が記録と違います', `${path}: ${el.naturalWidth}×${el.naturalHeight}`);
    }
    return el;
  };
  try {
    const o = model.facts.input.original;
    const p = model.facts.input.prepared;
    const media = {
      urls,
      orig: await image(o.path, 'image/jpeg', o.size[0], o.size[1]),
      crop: await image(p.path, 'image/png', p.size[0], p.size[1]),
      frames: {},
      revoke() { urls.splice(0).forEach((u) => URL.revokeObjectURL(u)); },
    };
    for (const id of CASE_IDS) {
      media.frames[id] = [];
      for (const f of model.cases[id].publicFrames) media.frames[id].push(await image(f.path, 'image/png', 512, 512));
    }
    return media;
  } catch (e) {
    urls.forEach((u) => URL.revokeObjectURL(u));
    throw e;
  }
}

/* ---------- 図の配置（設計座標） ---------- */

export const LAYOUTS = {
  portrait: {
    kind: 'portrait', w: 360, h: 586,
    nodes: {
      readme: { x: 4, y: 4, w: 108, h: 40 },
      author: { x: 126, y: 4, w: 108, h: 40 },
      operator: { x: 248, y: 4, w: 108, h: 40 },
      orig: { x: 8, y: 64, w: 56, h: 100, label: [36, 174] },
      crop: { x: 80, y: 72, w: 84, h: 84, label: [122, 168] },
      resize: { x: 178, y: 96, w: 46, h: 46 },
      yaw: { x: 240, y: 64, w: 116, h: 104 },
      F: { x: 8, y: 196, w: 150, h: 94 },
      M: { x: 184, y: 196, w: 156, h: 94 },
      T: { x: 184, y: 308, w: 156, h: 94 },
      W: { x: 8, y: 420, w: 160, h: 44 },
      G: { x: 184, y: 420, w: 156, h: 44 },
      strip: { x: 8, y: 484, w: 344, h: 62, gap: 8.5 },
      mp4: { x: 8, y: 554, w: 196, h: 28 },
      use: { x: 216, y: 554, w: 140, h: 28 },
    },
    pins: { 1: [201, 82], 2: [22, 210], 3: [198, 210], 4: [198, 322], 5: [22, 442], 6: [198, 442] },
    edges: {
      readme_author: [[112, 24], [126, 24]],
      author_operator: [[234, 24], [248, 24]],
      author_yaw: [[180, 44], [180, 56], [298, 56], [298, 64]],
      orig_crop: [[56, 91], [70, 91], [70, 114], [80, 114]],
      crop_resize: [[164, 119], [178, 119]],
      resize_F: [[201, 142], [201, 186], [83, 186], [83, 196]],
      resize_M: [[201, 142], [201, 186], [262, 186], [262, 196]],
      M_T: [[262, 290], [262, 308]],
      yaw_T: [[350, 168], [350, 336], [340, 336]],
      F_W: [[40, 290], [40, 420]],
      T_W: [[184, 356], [110, 356], [110, 420]],
      W_G: [[168, 442], [184, 442]],
      G_strip: [[262, 464], [262, 484]],
      strip_mp4: [[106, 546], [106, 554]],
      mp4_use: [[204, 568], [216, 568]],
    },
    notes: {
      bypass: { x: 48, y: 306, lines: ['同じF特徴', 'を再利用'] },
      sample: { x: 268, y: 474, text: '代表5枚' },
      fork: [201, 186],
    },
    legend: null,
  },
  wide: {
    kind: 'wide', w: 960, h: 540,
    nodes: {
      readme: { x: 20, y: 14, w: 150, h: 44 },
      author: { x: 190, y: 14, w: 150, h: 44 },
      operator: { x: 360, y: 14, w: 150, h: 44 },
      orig: { x: 24, y: 92, w: 90, h: 160, label: [69, 266] },
      crop: { x: 134, y: 124, w: 100, h: 100, label: [184, 240] },
      resize: { x: 256, y: 152, w: 48, h: 48 },
      yaw: { x: 580, y: 82, w: 180, h: 96 },
      M: { x: 344, y: 88, w: 190, h: 112 },
      F: { x: 344, y: 288, w: 190, h: 100 },
      T: { x: 580, y: 196, w: 180, h: 112 },
      W: { x: 796, y: 210, w: 150, h: 48 },
      G: { x: 796, y: 300, w: 150, h: 48 },
      strip: { x: 554, y: 384, w: 392, h: 72, gap: 8 },
      mp4: { x: 554, y: 474, w: 220, h: 32 },
      use: { x: 790, y: 474, w: 156, h: 32 },
    },
    pins: { 1: [280, 138], 2: [358, 302], 3: [358, 102], 4: [594, 210], 5: [810, 234], 6: [810, 324] },
    edges: {
      readme_author: [[170, 36], [190, 36]],
      author_operator: [[340, 36], [360, 36]],
      author_yaw: [[265, 14], [265, 6], [670, 6], [670, 82]],
      orig_crop: [[100, 136], [120, 136], [120, 174], [134, 174]],
      crop_resize: [[234, 176], [256, 176]],
      resize_M: [[304, 176], [322, 176], [322, 144], [344, 144]],
      resize_F: [[304, 176], [322, 176], [322, 338], [344, 338]],
      M_T: [[534, 170], [556, 170], [556, 236], [580, 236]],
      yaw_T: [[670, 178], [670, 196]],
      T_W: [[760, 234], [796, 234]],
      W_G: [[871, 258], [871, 300]],
      F_W: [[534, 350], [780, 350], [780, 250], [796, 250]],
      G_strip: [[871, 348], [871, 384]],
      strip_mp4: [[650, 456], [650, 474]],
      mp4_use: [[774, 490], [790, 490]],
    },
    notes: {
      bypass: { x: 560, y: 341, lines: ['同じF特徴を再利用'] },
      sample: { x: 880, y: 368, text: '代表5枚' },
      fork: [322, 176],
    },
    legend: { x: 24, y: 300, w: 288, h: 110 },
  },
};

const EDGE_ENDS = {
  readme_author: ['readme', 'author'], author_operator: ['author', 'operator'], author_yaw: ['author', 'yaw'],
  orig_crop: ['orig', 'crop'], crop_resize: ['crop', 'resize'], resize_F: ['resize', 'F'], resize_M: ['resize', 'M'],
  M_T: ['M', 'T'], yaw_T: ['yaw', 'T'], F_W: ['F', 'W'], T_W: ['T', 'W'], W_G: ['W', 'G'],
  G_strip: ['G', 'strip'], strip_mp4: ['strip', 'mp4'], mp4_use: ['mp4', 'use'],
};
const MANUAL_EDGES = new Set(['author_yaw', 'yaw_T']);

export const PART_NODES = { 1: 'resize', 2: 'F', 3: 'M', 4: 'T', 5: 'W', 6: 'G' };

export const STAGES = [
  { id: 0, name: '何か', focus: ['readme', 'author', 'operator', 'F', 'M', 'W', 'G'] },
  { id: 1, name: '渡す', focus: ['orig', 'crop', 'resize', 'yaw', 'F', 'M', 'T', 'author'] },
  { id: 2, name: '返る', focus: ['F', 'T', 'W', 'G', 'strip', 'mp4', 'use'] },
];

/* ---------- 経路の上の位置 ---------- */

export function pathLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

export function along(pts, u) {
  const t = Math.min(1, Math.max(0, u));
  const total = pathLength(pts);
  let left = t * total;
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

export const FILM_PALETTE = {
  paper: '#f3eee4', card: '#fffaf1', ink: '#1f1c18', muted: '#6a6157', line: '#3a342d', faint: '#d8cfc1',
  accent: '#c0402b', f: '#a8741a', m: '#2d5b86', ok: '#2f6a4e',
};

export function readPalette(el) {
  const cs = getComputedStyle(el);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  const P = FILM_PALETTE;
  return {
    paper: v('--paper', P.paper), card: v('--card', P.card), ink: v('--ink', P.ink), muted: v('--muted', P.muted),
    line: v('--line', P.line), faint: v('--faint', P.faint), accent: v('--accent', P.accent),
    f: v('--lane-f', P.f), m: v('--lane-m', P.m), ok: v('--ok', P.ok),
  };
}

function setFont(ctx, size, weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

export function drawText(ctx, s, x, y, o = {}) {
  const size = o.size || 12;
  let sz = size;
  setFont(ctx, sz, o.weight || 600);
  const max = o.max || Infinity;
  while (ctx.measureText(s).width > max && sz > size * 0.7) {
    sz -= 0.5;
    setFont(ctx, sz, o.weight || 600);
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

function strokePath(ctx, pts, color, width, dash, head) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
  if (head) {
    const [x1, y1] = pts[pts.length - 2];
    const [x2, y2] = pts[pts.length - 1];
    const a = Math.atan2(y2 - y1, x2 - x1);
    const L = 6.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - L * Math.cos(a - 0.42), y2 - L * Math.sin(a - 0.42));
    ctx.lineTo(x2 - L * Math.cos(a + 0.42), y2 - L * Math.sin(a + 0.42));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- 部品の形 ---------- */

function card(ctx, n, pal, strong, accentColor) {
  roundRect(ctx, n.x, n.y, n.w, n.h, 6);
  ctx.fillStyle = pal.card;
  ctx.fill();
  ctx.lineWidth = strong ? 1.8 : 1.1;
  ctx.strokeStyle = accentColor || pal.line;
  ctx.stroke();
}

export function drawCube(ctx, cx, cy, s, color, alpha = 1) {
  // 説明用の形。F の特徴ボリュームの値ではない。
  ctx.save();
  const base = ctx.globalAlpha * alpha;
  const d = s * 0.16;
  for (let i = 3; i >= 0; i -= 1) {
    const x = cx - s / 2 + i * d * 0.9;
    const y = cy - s / 2 + 6 - i * d * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y + d);
    ctx.lineTo(x + s * 0.5, y);
    ctx.lineTo(x + s * 0.5, y + s * 0.5);
    ctx.lineTo(x, y + s * 0.5 + d);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = base * (0.22 + 0.16 * (3 - i));
    ctx.fill();
    ctx.globalAlpha = base;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

// 実際の21点（x, y）を枠に収めて描く。名前の付いた目や鼻の位置ではない。
export function drawPoints(ctx, pts, box, bound, o = {}) {
  const k = (Math.min(box.w, box.h) / 2 - 3) / bound;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  ctx.save();
  for (const [x, y] of pts) {
    const px = cx + x * k;
    const py = cy + y * k;
    ctx.beginPath();
    ctx.arc(px, py, o.r || 2.1, 0, Math.PI * 2);
    if (o.hollow) {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = o.color;
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawYawChart(ctx, box, cs, frame, pal, reveal = 1) {
  const n = cs.offsets.length;
  const xAt = (i) => box.x + (i / (n - 1)) * box.w;
  const yAt = (v) => box.y + box.h / 2 - (v / 16) * (box.h / 2 - 2);
  ctx.save();
  ctx.strokeStyle = pal.faint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x, yAt(0));
  ctx.lineTo(box.x + box.w, yAt(0));
  ctx.stroke();
  const last = Math.max(1, Math.round((n - 1) * reveal));
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i <= last; i += 1) {
    const x = xAt(i);
    const y = yAt(cs.offsets[i]);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = pal.accent;
  for (let i = 0; i <= last; i += 1) {
    ctx.beginPath();
    ctx.arc(xAt(i), yAt(cs.offsets[i]), 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (frame >= 0 && frame <= last) {
    ctx.beginPath();
    ctx.arc(xAt(frame), yAt(cs.offsets[frame]), 3.4, 0, Math.PI * 2);
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.restore();
}

function fmtSigned(v, digits = 1) {
  const s = Math.abs(v).toFixed(digits);
  return v < 0 ? `−${s}` : `+${s}`;
}

/* ---------- 図全体 ---------- */

// o: { layout, pal, caseId, frame, focus, tokens, reveal, hidePins, dim }
export function drawMap(ctx, model, media, o) {
  const L = o.layout;
  const N = L.nodes;
  const pal = o.pal;
  const cs = model.cases[o.caseId];
  const frame = o.frame;
  const focus = o.focus ? new Set(o.focus) : null;
  const dim = o.dim ?? 0.3;
  const alphaOf = (id) => (!focus || focus.has(id) ? 1 : Math.max(dim, 0.72));
  const reveal = o.reveal || {};

  ctx.save();
  // 線
  for (const [id, pts] of Object.entries(L.edges)) {
    const [a, b] = EDGE_ENDS[id];
    ctx.globalAlpha = Math.min(alphaOf(a), alphaOf(b));
    if (MANUAL_EDGES.has(id)) strokePath(ctx, pts, pal.accent, 1.6, [4, 3], true);
    else if (id === 'F_W') strokePath(ctx, pts, pal.f, 2.4, null, true);
    else strokePath(ctx, pts, pal.line, 1.4, null, true);
  }
  ctx.globalAlpha = Math.min(alphaOf('resize'), Math.max(alphaOf('F'), alphaOf('M')));
  ctx.fillStyle = pal.line;
  ctx.beginPath();
  ctx.arc(L.notes.fork[0], L.notes.fork[1], 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = Math.min(alphaOf('F'), alphaOf('W'));
  L.notes.bypass.lines.forEach((s, i) => drawText(ctx, s, L.notes.bypass.x, L.notes.bypass.y + i * 14, { size: 11, color: pal.f, weight: 700 }));
  ctx.globalAlpha = Math.min(alphaOf('G'), alphaOf('strip'));
  drawText(ctx, L.notes.sample.text, L.notes.sample.x, L.notes.sample.y, { size: 10.5, color: pal.muted });

  // 上段：誰が何をしたか
  const pill = (id, title, sub, opt = {}) => {
    const n = N[id];
    ctx.globalAlpha = alphaOf(id);
    card(ctx, n, pal, focus && focus.has(id), opt.border);
    const tx = opt.pin ? n.x + 30 : n.x + 9;
    const max = n.w - (tx - n.x) - 6;
    if (sub) {
      drawText(ctx, title, tx, n.y + n.h * 0.34, { size: 12.5, weight: 700, color: pal.ink, max });
      drawText(ctx, sub, tx, n.y + n.h * 0.72, { size: 10.5, weight: 500, color: pal.muted, max });
    } else {
      drawText(ctx, title, tx, n.y + n.h / 2, { size: 12.5, weight: 700, color: pal.ink, max });
    }
  };
  pill('readme', '原典README', 'この範囲だけ使う');
  pill('author', '作者AI ×1', 'ランナーと値を書く');
  pill('operator', '制作担当', '原典を1回だけ実行');

  // 入力：原画→手動crop→元APIの256
  const o0 = model.facts.input.original;
  const box = o0.crop_box_pil_edges;
  {
    const n = N.orig;
    ctx.globalAlpha = alphaOf('orig');
    if (media) ctx.drawImage(media.orig, n.x, n.y, n.w, n.h);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(n.x, n.y, n.w, n.h);
    const sx = n.w / o0.size[0];
    const sy = n.h / o0.size[1];
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(n.x + box[0] * sx, n.y + box[1] * sy, (box[2] - box[0]) * sx, (box[3] - box[1]) * sy);
    drawText(ctx, '原画 s9.jpg', n.label[0], n.label[1], { size: 11, color: pal.ink, align: 'center', max: 76 });
  }
  {
    const n = N.crop;
    ctx.globalAlpha = alphaOf('crop');
    if (media) ctx.drawImage(media.crop, n.x, n.y, n.w, n.h);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(n.x, n.y, n.w, n.h);
    drawText(ctx, `手動crop ${o0.output_size[0]}`, n.label[0], n.label[1], { size: 11, color: pal.ink, align: 'center', max: 90 });
  }
  {
    const n = N.resize;
    ctx.globalAlpha = alphaOf('resize');
    card(ctx, n, pal, focus && focus.has('resize'));
    drawText(ctx, '元API', n.x + n.w / 2, n.y + 15, { size: 10, weight: 500, color: pal.muted, align: 'center' });
    drawText(ctx, String(model.inputShape[0]), n.x + n.w / 2, n.y + 32, { size: 15, weight: 800, color: pal.ink, align: 'center' });
  }

  // 手動の値（作者が決めた36個の角度）
  {
    const n = N.yaw;
    ctx.globalAlpha = alphaOf('yaw');
    card(ctx, n, pal, focus && focus.has('yaw'), pal.accent);
    drawText(ctx, `手動yaw ±${cs.amplitude}°`, n.x + 8, n.y + 13, { size: 12, weight: 800, color: pal.accent, max: n.w - 14 });
    drawYawChart(ctx, { x: n.x + 8, y: n.y + 24, w: n.w - 16, h: n.h - 44 }, cs, frame, pal, reveal.yaw ?? 1);
    drawText(ctx, '作者の36値・保存済み', n.x + 8, n.y + n.h - 10, { size: 10, weight: 500, color: pal.muted, max: n.w - 14 });
  }

  // F：見た目の3D特徴（1回）
  const inner = (n) => ({ x: n.x + 6, y: n.y + 26, w: n.w - 12, h: n.h - 44 });
  {
    const n = N.F;
    ctx.globalAlpha = alphaOf('F');
    card(ctx, n, pal, focus && focus.has('F'), pal.f);
    drawText(ctx, 'F 見た目の特徴', n.x + 30, n.y + 14, { size: 12.5, weight: 800, color: pal.ink, max: n.w - 36 });
    const g = inner(n);
    if (!o.hideGlyphs?.F) drawCube(ctx, g.x + g.w / 2, g.y + g.h / 2, Math.min(g.h * 1.15, 54), pal.f);
    drawText(ctx, `1回・${model.featureShape.slice(1).join('×')}`, n.x + 8, n.y + n.h - 10, { size: 10, weight: 500, color: pal.muted, max: n.w - 14 });
  }
  // M：21点と姿勢（1回）
  {
    const n = N.M;
    ctx.globalAlpha = alphaOf('M');
    card(ctx, n, pal, focus && focus.has('M'), pal.m);
    drawText(ctx, 'M 21点と姿勢', n.x + 30, n.y + 14, { size: 12.5, weight: 800, color: pal.ink, max: n.w - 36 });
    if (!o.hideGlyphs?.M) drawPoints(ctx, model.canonical, inner(n), model.bound, { color: pal.m });
    drawText(ctx, `1回・推定yaw ${model.pose.yaw.toFixed(1)}°`, n.x + 8, n.y + n.h - 10, { size: 10, weight: 500, color: pal.muted, max: n.w - 14 });
  }
  // 変換と stitching：そのコマの実際の21点
  {
    const n = N.T;
    ctx.globalAlpha = alphaOf('T');
    card(ctx, n, pal, focus && focus.has('T'), pal.m);
    drawText(ctx, '向きを変換＋補正', n.x + 30, n.y + 14, { size: 12.5, weight: 800, color: pal.ink, max: n.w - 36 });
    const g = inner(n);
    drawPoints(ctx, model.xSource, g, model.bound, { color: pal.faint, r: 1.8 });
    drawPoints(ctx, cs.target[frame], g, model.bound, { color: pal.m, hollow: true, r: 2.4 });
    drawPoints(ctx, cs.stitched[frame], g, model.bound, { color: pal.m, r: 1.6 });
    drawText(ctx, `yaw ${model.pose.yaw.toFixed(1)}${fmtSigned(cs.offsets[frame])}°・#${frame}`, n.x + 8, n.y + n.h - 10,
      { size: 10, weight: 600, color: pal.muted, max: n.w - 14 });
  }
  pill('W', 'W 同じ特徴を変形', null, { pin: true });
  pill('G', `G ${model.outShape[2]}画像を新しく描く`, null, { pin: true });

  // 実際の生成PNG（36枚のうち代表5枚）
  {
    const n = N.strip;
    ctx.globalAlpha = alphaOf('strip');
    const rects = stripRects(n);
    cs.publicFrames.forEach((f, i) => {
      const r = rects[i];
      if (media) ctx.drawImage(media.frames[cs.id][i], r.x, r.y, r.w, r.h);
      const on = f.index === frame;
      ctx.strokeStyle = on ? pal.accent : pal.line;
      ctx.lineWidth = on ? 2.4 : 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = pal.card;
      ctx.globalAlpha = alphaOf('strip') * 0.86;
      ctx.fillRect(r.x + 1, r.y + r.h - 15, 26, 14);
      ctx.globalAlpha = alphaOf('strip');
      drawText(ctx, `#${f.index}`, r.x + 4, r.y + r.h - 8, { size: 10, weight: 700, color: pal.ink });
    });
  }
  const rec = cs.video.record;
  pill('mp4', `MP4 ${rec.decoded_frames}枚・${rec.stream_duration_seconds}秒・${rec.audio_streams === 0 ? '無音' : '音あり'}`, null);
  pill('use', '再生・保存', null, { border: pal.ok });
  {
    const n = N.use;
    ctx.globalAlpha = alphaOf('use');
    const x = n.x + n.w - 34;
    const y = n.y + n.h / 2;
    ctx.fillStyle = pal.ok;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.ok;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 20, y - 6);
    ctx.lineTo(x + 20, y + 4);
    ctx.moveTo(x + 16, y);
    ctx.lineTo(x + 20, y + 5);
    ctx.lineTo(x + 24, y);
    ctx.stroke();
  }

  // 番号①〜⑥（原典の該当行を開く部品）
  if (!o.hidePins) {
    for (const [num, [x, y]] of Object.entries(L.pins)) {
      ctx.globalAlpha = alphaOf(PART_NODES[num]);
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = pal.ink;
      ctx.fill();
      drawText(ctx, num, x, y + 0.5, { size: 11.5, weight: 800, color: pal.paper, align: 'center' });
    }
  }

  // 凡例（横長の配置だけ）
  if (L.legend) {
    const g = L.legend;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.faint;
    ctx.lineWidth = 1;
    roundRect(ctx, g.x, g.y, g.w, g.h, 6);
    ctx.stroke();
    const rows = [
      [pal.ink, '画像・21点・角度・コマ＝実データ'],
      [pal.f, '立方体と動く印＝説明のための形'],
      [pal.accent, '点線＝作者が決めた手動の値'],
      [pal.muted, '①〜⑥＝原典の該当行を開く'],
    ];
    rows.forEach(([c, s], i) => {
      ctx.fillStyle = c;
      ctx.fillRect(g.x + 12, g.y + 17 + i * 24, 9, 9);
      drawText(ctx, s, g.x + 28, g.y + 22 + i * 24, { size: 11.5, weight: 600, color: pal.ink, max: g.w - 36 });
    });
  }

  // 動く印（説明用。実際の処理時間ではない）
  ctx.globalAlpha = 1;
  for (const t of o.tokens || []) drawToken(ctx, t, model, media, pal);
  ctx.restore();
}

export function drawToken(ctx, t, model, media, pal) {
  ctx.save();
  ctx.globalAlpha = t.alpha ?? 1;
  if (t.kind === 'doc') {
    roundRect(ctx, t.x - 7, t.y - 9, 14, 18, 2);
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      ctx.moveTo(t.x - 4, t.y - 4 + i * 4);
      ctx.lineTo(t.x + 4, t.y - 4 + i * 4);
    }
    ctx.stroke();
  } else if (t.kind === 'cube') {
    drawCube(ctx, t.x, t.y, t.s || 20, pal.f);
  } else if (t.kind === 'points') {
    const s = t.s || 26;
    drawPoints(ctx, t.pts || model.canonical, { x: t.x - s / 2, y: t.y - s / 2, w: s, h: s }, model.bound, { color: pal.m, r: 1.4 });
  } else if (t.kind === 'dot') {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r || 4, 0, Math.PI * 2);
    ctx.fillStyle = t.color || pal.accent;
    ctx.fill();
  } else if (t.kind === 'image' && media) {
    const img = t.img === 'crop' ? media.crop : t.img;
    ctx.drawImage(img, t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
    ctx.strokeStyle = t.stroke || pal.accent;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
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
  return CASE_IDS.includes(id) ? id : 'yaw08';
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
    saveOutput: $('#save-output'),
    saveRecord: $('#save-record'),
    saveSource: $('#save-source'),
    source: $('#source-picture'),
    original: $('#original-picture'),
    video: $('#result-video'),
    videoNote: $('#video-note'),
    frames: $('#frames'),
    stageText: $('#stage-text'),
    inventory: $('#inventory'),
    proof: $('#proof'),
    dialog: $('#part-dialog'),
  };
  const stageButtons = [...document.querySelectorAll('[data-stage]')];
  const caseButtons = [...document.querySelectorAll('[data-case]')];
  const partButtons = [...document.querySelectorAll('[data-part]')];
  const ctx = els.canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const state = {
    stage: 0, caseId: caseFromHash(location.hash), model: null, media: null, view: null,
    pal: readPalette(document.body), token: 0, saveUrls: [], raf: 0, start: performance.now(),
  };

  const setDisabled = (on) => {
    [...stageButtons, ...caseButtons, ...partButtons].forEach((b) => { b.disabled = on; });
    for (const a of [els.saveOutput, els.saveRecord, els.saveSource]) {
      if (on) {
        a.removeAttribute('href');
        a.setAttribute('aria-disabled', 'true');
      } else {
        a.removeAttribute('aria-disabled');
      }
    }
  };

  const revokeSaves = () => state.saveUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));

  const clearAll = () => {
    cancelAnimationFrame(state.raf);
    state.raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    els.video.pause();
    els.video.removeAttribute('src');
    els.video.load();
    els.source.removeAttribute('src');
    els.original.removeAttribute('src');
    els.frames.replaceChildren();
    els.inventory.replaceChildren();
    els.proof.replaceChildren();
    els.videoNote.textContent = '';
    revokeSaves();
    if (state.media) state.media.revoke();
    state.media = null;
    state.model = null;
    document.querySelectorAll('[data-fact]').forEach((n) => { n.textContent = '—'; });
    setDisabled(true);
  };

  const showFailure = (e) => {
    clearAll();
    const err = e instanceof VerifyError ? e : new VerifyError('表示を準備できません', String(e && e.message || e));
    els.status.textContent = `${err.message}。図・動画・保存を止めています。`;
    els.detail.textContent = err.detail;
    els.failure.hidden = false;
    els.retry.disabled = false;
    document.body.dataset.state = 'failed';
  };

  const sizeCanvas = () => {
    const width = els.map.clientWidth;
    if (!width) return;
    const layout = width >= 720 ? LAYOUTS.wide : LAYOUTS.portrait;
    const scale = width / layout.w;
    const height = Math.round(layout.h * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    els.canvas.style.height = `${height}px`;
    els.canvas.width = Math.round(width * dpr);
    els.canvas.height = Math.round(height * dpr);
    state.view = { layout, scale, dpr };
    document.body.dataset.layout = layout.kind;
    for (const b of partButtons) {
      const [x, y] = layout.pins[b.dataset.part];
      b.style.left = `${x * scale - 22}px`;
      b.style.top = `${y * scale - 22}px`;
    }
  };

  const tokensFor = (stage, u, layout, cs, frame) => {
    const E = layout.edges;
    if (stage === 0) {
      const [x, y] = along(joinPaths(E.readme_author, E.author_operator), u);
      return [{ kind: 'doc', x, y }];
    }
    if (stage === 1) {
      if (u < 0.45) {
        const [x, y] = along(joinPaths(E.orig_crop, E.crop_resize), u / 0.45);
        return [{ kind: 'image', img: 'crop', x, y, w: 22, h: 22 }];
      }
      const v = (u - 0.45) / 0.55;
      const [fx, fy] = along(E.resize_F, v);
      const [mx, my] = along(E.resize_M, v);
      const [yx, yy] = along(E.yaw_T, v);
      return [{ kind: 'cube', x: fx, y: fy, s: 18 }, { kind: 'points', x: mx, y: my, s: 24 }, { kind: 'dot', x: yx, y: yy }];
    }
    if (u < 0.5) {
      const [fx, fy] = along(E.F_W, u / 0.5);
      const [tx, ty] = along(E.T_W, u / 0.5);
      return [{ kind: 'cube', x: fx, y: fy, s: 18 }, { kind: 'points', x: tx, y: ty, s: 24, pts: cs.stitched[frame] }];
    }
    if (u < 0.75) {
      const [x, y] = along(E.W_G, (u - 0.5) / 0.25);
      return [{ kind: 'dot', x, y, color: state.pal.ink }];
    }
    const [x, y] = along(E.G_strip, (u - 0.75) / 0.25);
    const i = PUBLIC_INDICES.indexOf(frame);
    return [{ kind: 'image', img: state.media.frames[cs.id][i], x, y, w: 20, h: 20 }];
  };

  const draw = (now) => {
    if (!state.model || !state.view) return;
    const { layout, scale, dpr } = state.view;
    const cs = state.model.cases[state.caseId];
    const still = reduce.matches;
    const elapsed = (now - state.start) / 1000;
    const frame = still ? 9 : PUBLIC_INDICES[Math.floor(elapsed / 1.2) % PUBLIC_INDICES.length];
    const u = (elapsed % 3.6) / 3.6;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    drawMap(ctx, state.model, state.media, {
      layout, pal: state.pal, caseId: state.caseId, frame,
      focus: STAGES[state.stage].focus,
      tokens: still ? [] : tokensFor(state.stage, u, layout, cs, frame),
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

  const fillFacts = () => {
    const m = state.model;
    const rt = m.facts.runtime;
    const set = (key, value) => document.querySelectorAll(`[data-fact="${key}"]`).forEach((n) => { n.textContent = value; });
    set('pose-yaw', m.pose.yaw.toFixed(2));
    set('pose-pitch', m.pose.pitch.toFixed(2));
    set('pose-roll', m.pose.roll.toFixed(2));
    set('count', String(m.manifest.count));
    set('crop-box', `[${m.facts.input.original.crop_box_pil_edges.join(', ')}]`);
    set('orig-size', `${m.facts.input.original.size[0]}×${m.facts.input.original.size[1]}`);
    set('input-shape', `${m.inputShape[0]}×${m.inputShape[1]}`);
    set('feature-shape', m.featureShape.slice(1).join('×'));
    set('calls-warp', String(rt.calls.warp_decode));
    set('calls-transform', String(rt.calls.transform_keypoint));
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
    const rt = m.facts.runtime;
    const env = rt.environment;
    const dl = document.createElement('dl');
    row(dl, '原典', `${SOURCE_REPOSITORY} @ ${SOURCE_COMMIT.slice(0, 7)}（MIT）`);
    row(dl, '重み', `${m.facts.identity.model_repository} @ ${m.facts.identity.model_revision.slice(0, 7)}（MIT）・5ファイル`);
    row(dl, '環境', `Python ${env.python}・torch ${env.torch}・${rt.config.device.toUpperCase()} float32・スレッド ${env.torch_intra_op_threads}・seed ${rt.config.seed}`);
    row(dl, '実行したネットワーク', Object.entries(rt.loaded_networks)
      .map(([k, v]) => `${k}（${v.parameters.toLocaleString('ja-JP')}）${v.executed ? '実行' : '読み込みのみ'}`).join('／'));
    row(dl, '呼び出し回数', Object.entries(rt.calls).map(([k, v]) => `${k} ${v}`).join('・'));
    row(dl, '入力の推定（1回）', `pitch ${m.pose.pitch.toFixed(2)}°・yaw ${m.pose.yaw.toFixed(2)}°・roll ${m.pose.roll.toFixed(2)}°・scale ${m.facts.runtime.source_inference.scale[0].toFixed(4)}`);
    row(dl, 'F の特徴', `${m.featureShape.join('×')}・全コマの前後で同じ SHA-256（${short(m.facts.runtime.source_inference.feature_3d.sha256_f32le)}）`);
    row(dl, '手動crop', `${m.facts.input.original.size.join('×')} の JPEG から PIL の枠 [${m.facts.input.original.crop_box_pil_edges.join(', ')}] を LANCZOS で ${m.facts.input.prepared.size.join('×')} に。ランナーが同じ画素を再計算して一致`);
    const t = rt.timings_seconds;
    row(dl, '時間（1回の測定）', `読み込み ${t.load_seconds.toFixed(2)} 秒・入力の推定 ${t.source_stage_seconds.toFixed(2)} 秒・` +
      CASE_IDS.map((id) => `${id} 生成 ${m.cases[id].timings.generation_wrapper_calls.toFixed(2)} 秒`).join('・') +
      `・全体 ${t.total_wall_seconds.toFixed(2)} 秒。ベンチマークではありません`);
    els.proof.replaceChildren(dl);

    const items = m.manifest.assets.map((a) => {
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
    revokeSaves();
    const make = (path, type) => {
      const u = URL.createObjectURL(new Blob([m.files.get(path)], { type }));
      state.saveUrls.push(u);
      return u;
    };
    const videoUrl = make(cs.video.path, 'video/mp4');
    els.saveOutput.href = videoUrl;
    els.saveOutput.download = `liveportrait-${cs.id}.mp4`;
    els.saveRecord.href = make(cs.jobJson.path, 'application/json');
    els.saveRecord.download = `liveportrait-${cs.id}.json`;
    els.saveSource.href = make(m.facts.input.prepared.path, 'image/png');
    els.saveSource.download = 'liveportrait-portrait-crop.png';
    els.saveOutput.querySelector('[data-label]').textContent = `MP4 ±${cs.amplitude}°`;
    els.saveRecord.querySelector('[data-label]').textContent = `記録 ±${cs.amplitude}°`;

    els.video.src = videoUrl;
    const rec = cs.video.record;
    els.videoNote.textContent =
      `保存済みの結果 ±${cs.amplitude}°：${rec.width}×${rec.height}・${rec.decoded_frames}コマ・${cs.fps}fps・${rec.stream_duration_seconds}秒・` +
      `音声トラック${rec.audio_streams}本・${fmtBytes(cs.video.bytes)}・SHA-256 ${short(cs.video.sha256)}。` +
      'H.264（yuv420p）への圧縮は、元APIの PNG の後に FFmpeg で別に行いました。';

    const figs = cs.publicFrames.map((f, i) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = state.media.frames[cs.id][i].src;
      img.width = 512;
      img.height = 512;
      img.alt = `生成コマ #${f.index}（入力yaw ${fmtSigned(f.offset, 2)}°）`;
      const cap = document.createElement('figcaption');
      cap.textContent = `#${f.index}・${f.time.toFixed(2)}秒・${fmtSigned(f.offset, 2)}°`;
      fig.append(img, cap);
      return fig;
    });
    els.frames.replaceChildren(...figs);
    kick();
  };

  const setStage = (n) => {
    state.stage = n;
    stageButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === n)));
    els.stageText.querySelectorAll('[data-stage-text]').forEach((p) => { p.hidden = Number(p.dataset.stageText) !== n; });
    kick();
  };

  const setCase = (id, pushHash) => {
    state.caseId = CASE_IDS.includes(id) ? id : 'yaw08';
    if (pushHash) history.replaceState(null, '', `#${state.caseId}`);
    if (state.model) renderCase();
  };

  const load = async () => {
    const token = ++state.token;
    clearAll();
    els.failure.hidden = true;
    els.retry.disabled = true;
    els.detail.textContent = '';
    document.body.dataset.state = 'loading';
    els.status.textContent = `保存済みのファイルを確かめています…`;
    try {
      const model = await verifyAll((done, total) => {
        if (token === state.token && document.body.dataset.state === 'loading') {
          els.status.textContent = `保存済みのファイルを確かめています… ${done}/${total}`;
        }
      });
      const media = await loadMedia(model);
      if (token !== state.token) { media.revoke(); return; }
      state.model = model;
      state.media = media;
      els.source.src = media.crop.src;
      els.original.src = media.orig.src;
      setDisabled(false);
      fillFacts();
      fillProof();
      sizeCanvas();
      setStage(state.stage);
      renderCase();
      document.body.dataset.state = 'ready';
      els.status.textContent = `${model.manifest.count}ファイルの大きさと SHA-256、引用、記録どうしを自動で照合しました（人の目視の承認ではありません）。`;
      els.detail.textContent = '';
    } catch (e) {
      if (token === state.token) showFailure(e);
    }
  };

  els.video.addEventListener('loadedmetadata', () => {
    if (!state.model) return;
    const v = els.video;
    if (v.videoWidth && (v.videoWidth !== 512 || v.videoHeight !== 512 || Math.abs(v.duration - 3) > 0.05)) {
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
  [els.saveOutput, els.saveRecord, els.saveSource].forEach((a) => a.addEventListener('click', (ev) => {
    if (!a.getAttribute('href')) {
      ev.preventDefault();
      return;
    }
    els.status.textContent = `保存をブラウザーに依頼しました（${a.download}）。`;
  }));
  els.retry.addEventListener('click', load);

  partButtons.forEach((b) => b.addEventListener('click', () => {
    if (!state.model) return;
    const part = state.model.parts[Number(b.dataset.part) - 1];
    const d = els.dialog;
    d.querySelector('#part-title').textContent = `${part.number}　${part.label}`;
    d.querySelector('#part-meaning').textContent = part.meaning;
    const list = d.querySelector('#part-sources');
    list.replaceChildren(...part.sources.map((s) => {
      const sec = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = `${s.source_path}　${s.start_line}–${s.end_line}行`;
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = s.excerpt.split('\n').map((line, i) => `${String(s.start_line + i).padStart(3, ' ')}  ${line}`).join('\n');
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
      sec.append(h, pre, p);
      return sec;
    }));
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }));
  els.dialog.querySelector('[data-close]').addEventListener('click', () => els.dialog.close());

  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state.model) return;
      sizeCanvas();
      kick();
    }, 60);
  }).observe(els.map);
  const repaint = () => {
    state.pal = readPalette(document.body);
    kick();
  };
  dark.addEventListener('change', repaint);
  reduce.addEventListener('change', kick);
  document.addEventListener('visibilitychange', kick);

  setStage(0);
  caseButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.case === state.caseId)));
  load();
}

if (typeof document !== 'undefined' && document.body && document.body.dataset.app === 'liveportrait-main') {
  main();
}
