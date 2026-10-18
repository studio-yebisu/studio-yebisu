// Whisper 作例「声を、文と時刻へ」。
// 保存済みの実記録26件を固定のmanifestで照合してから、同じ概念図をページと図解動画で描く。
// このページではWhisperを動かさない。音声認識は制作時に1回だけ行い、その保存済み出力を読むだけ。
// video/video.js もこのモジュールから照合と描画を読み込む（DOMの起動はこのページのときだけ）。
// Copyright (c) 2026 Studio Yebisu. MIT License.

export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = 'faf7566d8b89263f22ebb65e7b80abd999f37ef20261e209377e4cf14b03788f';
export const SOURCE_COMMIT = '86098128c0b4f24f0e2aa2994de830614b474227';
export const ASSET_COUNT = 26;

const CASE_ID = 'whisper-example';
const VERSION = '20250625';
const AUDIO_PATH = 'input/review-ja.wav';
const AUDIO_SHA256 = '8b9fbf4aeba07b7f2887fd8b9f82e07ea9bc802a5e6907a355ec388e47df82c4';
const CHECKPOINT_SHA256 = 'ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e';
const PART_IDS = ['python', 'features', 'model', 'segments', 'writer', 'review'];
const CHANGED_IDS = [0, 1, 4];
// 照合のための期待値。表示する時刻は必ず照合済みの記録から読む。
const EXPECTED_TIMES = [[0, 4.12], [4.12, 8.700000000000001], [8.700000000000001, 13.56], [13.56, 17.52], [17.52, 20.92]];

export const SRT_FILES = Object.freeze({
  raw: Object.freeze({path: 'outputs/review-ja.srt', bytes: 441, sha256: 'a9d6ffb16a3d61d6e7b2700fc72f34d8bfbf49d40ddfc7befe3b06d4194ac2e1', download: 'review-ja.srt'}),
  review: Object.freeze({path: 'outputs/browser-edited.srt', bytes: 420, sha256: '976709c38a46dcc15f1d230729bdfb2a5390dd8a4fa3eeaf9cf4e93569e0716c', download: 'browser-edited.srt'}),
});

const ASSET_PATHS = Object.freeze([
  'concept/structure.json', 'concept/features.json', 'video/assets/waveform.json', AUDIO_PATH, 'input/script.json',
  'outputs/session.json', 'outputs/review-ja.json', SRT_FILES.raw.path, SRT_FILES.review.path, 'outputs/reference-review.json',
  'outputs/edit-record.json', 'run_transcribe.py', 'derive-features.py', 'request.txt', 'brief.json', 'samples.json',
  'verification.json', 'vendor/whisper/README.md', 'vendor/whisper/model-card.md', 'vendor/whisper/LICENSE',
  'vendor/whisper/whisper/__init__.py', 'vendor/whisper/whisper/transcribe.py', 'vendor/whisper/whisper/audio.py',
  'vendor/whisper/whisper/model.py', 'vendor/whisper/whisper/decoding.py', 'vendor/whisper/whisper/utils.py',
]);

// このファイルの場所が作例のルート。<base href="video/"> の書き出しでも同じ場所を指す。
const ROOT = new URL('./', import.meta.url);

// ---------- 照合 ----------

class AssetError extends Error {}
const fail = (message) => { throw new AssetError(message); };
const check = (ok, message) => { if (!ok) fail(message); };
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const pick = (s) => ({id: s.id, start: s.start, end: s.end, text: s.text});
const sameSegments = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length
  && a.every((s, i) => s && b[i] && s.id === b[i].id && s.start === b[i].start && s.end === b[i].end && s.text === b[i].text);

async function fetchBytes(path, signal) {
  let response;
  try {
    response = await fetch(new URL(path, ROOT), {cache: 'no-store', credentials: 'same-origin', signal});
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    fail(`${path} を取得できませんでした`);
  }
  if (!response.ok) fail(`${path} が HTTP ${response.status} でした`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) fail('この環境ではSHA-256を確かめられません（https か 127.0.0.1 で開いてください）');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeText(bytes, path) {
  let body;
  try {
    body = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    fail(`${path} がUTF-8として読めません`);
  }
  return body.charCodeAt(0) === 0xfeff ? body.slice(1) : body;
}

function parseJson(path, body) {
  try {
    return JSON.parse(body);
  } catch {
    return fail(`${path} がJSONとして読めません`);
  }
}

function validateManifest(m) {
  check(m && m.format === 'studio-yebisu-assets/v1' && m.case_id === CASE_ID && m.source_commit === SOURCE_COMMIT, 'manifest の形式か固定版が違います');
  check(Array.isArray(m.files) && m.files.length === ASSET_COUNT, `manifest の素材が${ASSET_COUNT}件ではありません`);
  check(sameList(m.files.map((f) => f.path), ASSET_PATHS), 'manifest の素材の一覧が違います');
  for (const f of m.files) {
    check(Number.isInteger(f.bytes) && f.bytes > 0 && /^[0-9a-f]{64}$/.test(f.sha256), `manifest の ${f.path} の記録`);
  }
  const entry = (path) => m.files.find((f) => f.path === path);
  check(entry(AUDIO_PATH).sha256 === AUDIO_SHA256, 'manifest の入力WAVのSHA-256');
  for (const srt of Object.values(SRT_FILES)) {
    check(entry(srt.path).sha256 === srt.sha256 && entry(srt.path).bytes === srt.bytes, `manifest の ${srt.path}`);
  }
}

// RIFF/WAVE を読み、PCM16の標本を取り出す
function readWav(u8) {
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  check(u8.byteLength >= 44 && tag(0) === 'RIFF' && tag(8) === 'WAVE', '入力WAVの形式');
  let fmt = null;
  let data = null;
  for (let o = 12; o + 8 <= u8.byteLength;) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    const body = o + 8;
    if (id === 'fmt ') fmt = {format: v.getUint16(body, true), channels: v.getUint16(body + 2, true), rate: v.getUint32(body + 4, true), bits: v.getUint16(body + 14, true)};
    else if (id === 'data') data = {offset: body, size: Math.min(size, u8.byteLength - body)};
    o = body + size + (size % 2);
  }
  check(fmt && data, '入力WAVの fmt と data');
  const frames = Math.floor(data.size / (2 * Math.max(1, fmt.channels)));
  return {...fmt, frames, sample: (i) => v.getInt16(data.offset + i * 2 * fmt.channels, true)};
}

function rmsWindows(wav, size) {
  const out = [];
  for (let start = 0; start < wav.frames; start += size) {
    const end = Math.min(wav.frames, start + size);
    let sum = 0;
    for (let i = start; i < end; i++) {
      const x = wav.sample(i);
      sum += x * x;
    }
    out.push(Math.sqrt(sum / (end - start)) / 32768);
  }
  return out;
}

// whisper.utils.format_timestamp（時を常に出す・小数点はカンマ）と同じ書き方
export function srtTime(seconds) {
  let ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const m = Math.floor(ms / 60000); ms -= m * 60000;
  const s = Math.floor(ms / 1000); ms -= s * 1000;
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(h, 2)}:${p(m, 2)}:${p(s, 2)},${p(ms, 3)}`;
}

function parseSrt(body, path) {
  const blocks = body.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split('\n');
    check(lines.length >= 3 && /^\d+$/.test(lines[0]) && /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/.test(lines[1]), `${path} の${i + 1}番目の区切り`);
    return {index: Number(lines[0]), timing: lines[1], text: lines.slice(2).join('\n')};
  });
}

// 原出力と修正例の違いのうち、いちばん大きい一か所を短く取り出す（句読点・空白・改行は比べない）
export function cueExcerpt(raw, edited) {
  const norm = (s) => Array.from(String(s).replace(/[\s、。，．]/gu, ''));
  const a = norm(raw);
  const b = norm(edited);
  const dp = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hunks = [];
  let cur = null;
  let equal = '';
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (cur) { hunks.push(cur); cur = null; }
      equal += a[i];
      i++; j++;
      continue;
    }
    if (!cur) { cur = {a: '', b: '', before: equal}; equal = ''; }
    if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) { cur.b += b[j]; j++; } else { cur.a += a[i]; i++; }
  }
  if (cur) hunks.push(cur);
  if (!hunks.length) return {raw: '', edited: ''};
  const best = hunks.reduce((x, y) => (y.a.length + y.b.length > x.a.length + x.b.length ? y : x));
  const lead = (best.before.match(/[A-Za-z0-9]+$/u) || [''])[0];
  return {raw: lead + best.a, edited: lead + best.b};
}

function officialUrl(path, line) {
  const prefix = 'vendor/whisper/';
  if (!path.startsWith(prefix)) return null;
  return `https://github.com/openai/whisper/blob/${SOURCE_COMMIT}/${path.slice(prefix.length)}#L${line}`;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function buildBundle(manifest, bytes) {
  const text = (path) => decodeText(bytes.get(path), path);
  const json = (path) => parseJson(path, text(path));
  const sha = (path) => manifest.files.find((f) => f.path === path).sha256;

  const structure = json('concept/structure.json');
  const features = json('concept/features.json');
  const waveform = json('video/assets/waveform.json');
  const script = json('input/script.json');
  const session = json('outputs/session.json');
  const native = json('outputs/review-ja.json');
  const reference = json('outputs/reference-review.json');
  const editRecord = json('outputs/edit-record.json');
  const brief = json('brief.json');
  const samples = json('samples.json');
  const verification = json('verification.json');
  const request = text('request.txt');

  // 構造の記録と6部品の引用
  check(structure.format === 'whisper-structure/v1' && structure.case_id === CASE_ID, 'structure.json の形式');
  check(structure.source_commit === SOURCE_COMMIT && structure.version === VERSION, 'structure.json の固定版');
  check(Array.isArray(structure.parts) && sameList(structure.parts.map((p) => p.id), PART_IDS), 'structure.json の6部品のID');
  const parts = structure.parts.map((part) => {
    check(typeof part.label === 'string' && part.label && typeof part.meaning === 'string' && part.meaning && typeof part.quote === 'string' && part.quote, `部品 ${part.id} の項目`);
    check(bytes.has(part.source_path), `部品 ${part.id} の出典が照合済みの素材にありません`);
    const lines = text(part.source_path).split(/\r?\n/);
    check(Number.isInteger(part.line_start) && part.line_start >= 1 && part.line_start <= lines.length && lines[part.line_start - 1].includes(part.quote),
      `部品 ${part.id} の引用が ${part.source_path} の${part.line_start}行目にありません`);
    return {id: part.id, label: part.label, meaning: part.meaning, quote: part.quote, path: part.source_path, line: part.line_start, upstream: officialUrl(part.source_path, part.line_start)};
  });

  // 実際の1回の呼び出しの設定
  const ENGINE = {
    library: 'openai-whisper', version: VERSION, source_commit: SOURCE_COMMIT, model: 'base', device: 'cpu', task: 'transcribe',
    language: 'ja', fp16: false, temperature: 0, condition_on_previous_text: false, reference_text_supplied: false,
    initial_prompt: null, word_timestamps: false, threads: 4, checkpoint_sha256: CHECKPOINT_SHA256, checkpoint_sha256_expected: CHECKPOINT_SHA256,
  };
  for (const [key, value] of Object.entries(ENGINE)) {
    check(structure.engine?.[key] === value, `structure.json の engine.${key}`);
    check(session.engine?.[key] === value, `session.json の engine.${key}`);
  }
  const x = structure.actual_execution;
  check(x && x.original_inference_runs === 1 && x.new_asr_inference === false && x.new_tts_synthesis === false && x.new_feature_preprocessing_only === true
    && x.reference_text_supplied === false && x.initial_prompt === null && x.word_timestamps === false && x.segments === 5
    && x.audio_listening_confirmed === false && x.timing_accuracy_confirmed === false && x.live_in_this_browser === false, 'structure.json の実行の記録');

  // 入力WAV：実際の標本から形式・長さ・RMSを求め直す
  const audio = structure.audio;
  check(audio && audio.path === AUDIO_PATH && audio.sha256 === AUDIO_SHA256 && sha(AUDIO_PATH) === AUDIO_SHA256, '入力WAVの記録');
  for (const key of ['path', 'sha256', 'duration_seconds', 'sample_rate', 'channels', 'sample_width_bits', 'frames', 'kind', 'voice_name', 'fictional', 'script_path', 'script_sha256']) {
    check(session.audio?.[key] === audio[key], `session.json の audio.${key}`);
  }
  check(audio.kind === 'synthetic' && audio.fictional === true && audio.sample_rate === 16000 && audio.channels === 1 && audio.sample_width_bits === 16 && audio.frames === 336225, '入力WAVの形式の記録');
  check(audio.script_path === 'input/script.json' && audio.script_sha256 === sha('input/script.json'), '原稿のSHA-256');
  const wav = readWav(bytes.get(AUDIO_PATH));
  check(wav.format === 1 && wav.channels === 1 && wav.rate === 16000 && wav.bits === 16 && wav.frames === audio.frames, '入力WAVの中身が記録と違います');
  check(Math.abs(wav.frames / wav.rate - audio.duration_seconds) < 1e-6, '入力WAVの長さ');

  check(waveform.audio_sha256 === AUDIO_SHA256 && waveform.sample_rate === 16000 && waveform.window_samples === 1600, 'waveform.json の形式');
  check(Array.isArray(waveform.values) && waveform.values.length === 211 && waveform.values.every((v) => isNum(v) && v >= 0 && v <= 1), 'waveform.json のRMS 211窓');
  const rms = rmsWindows(wav, 1600);
  check(rms.length === 211 && rms.every((v, i) => Math.abs(v - waveform.values[i]) <= 1e-6), 'RMSがWAVから求めた値と違います');
  check(structure.waveform?.path === 'video/assets/waveform.json' && structure.waveform.windows === 211 && structure.waveform.window_samples === 1600, 'structure.json の waveform');

  // log-Mel の表示（前処理だけの追加実行。推論内部の記録ではない）
  check(features.format === 'whisper-feature-display/v1' && features.source_audio_sha256 === AUDIO_SHA256, 'features.json の形式');
  check(features.source_frames === audio.frames && features.sample_rate === 16000 && isNum(features.duration_seconds) && Math.abs(features.duration_seconds - audio.frames / 16000) < 1e-9, 'features.json の音声');
  check(features.api === 'whisper.audio.log_mel_spectrogram(audio,n_mels=80,padding=N_SAMPLES)', 'features.json の前処理API');
  check(sameList(features.padded_log_mel_shape, [80, 5101]) && sameList(features.content_log_mel_shape, [80, 2101]) && sameList(features.display_shape, [80, 96]), 'features.json の形');
  check(features.padded_log_mel_shape[1] - features.content_log_mel_shape[1] === 3000, 'features.json の30秒パディング');
  check(features.rms_window_samples === 1600 && features.rms_values_verified === 211, 'features.json のRMS照合');
  const range = features.pooled_value_range;
  check(Array.isArray(range) && range.length === 2 && isNum(range[0]) && isNum(range[1]) && range[0] < range[1], 'features.json の値の範囲');
  const matrix = features.display_matrix;
  check(Array.isArray(matrix) && matrix.length === 80 && matrix.every((row) => Array.isArray(row) && row.length === 96 && row.every((v) => isNum(v) && v >= 0 && v <= 1)), 'features.json の80×96の行列');
  let lo = 1;
  let hi = 0;
  for (const row of matrix) for (const v of row) { if (v < lo) lo = v; if (v > hi) hi = v; }
  check(lo <= 1e-6 && hi >= 1 - 1e-6, 'features.json の全体min-max');
  const fd = structure.feature_display;
  check(fd && fd.path === 'concept/features.json' && sameList(fd.shape, [80, 96]) && sameList(fd.actual_content_shape, [80, 2101]), 'structure.json の feature_display');

  // 元の実ASR：5区間（session・ネイティブJSON・構造の記録が一致）
  check(session.schema_version === 1 && session.status === 'completed' && session.result?.language === 'ja' && native.language === 'ja', 'session.json の状態');
  const segments = structure.segments;
  check(Array.isArray(segments) && segments.length === 5, '原出力は5区間のはずです');
  check(sameSegments(segments, session.result.segments), 'session.json の区間と違います');
  check(Array.isArray(native.segments) && sameSegments(segments, native.segments.map(pick)), 'review-ja.json の区間と違います');
  check(typeof native.text === 'string' && native.text === session.result.text, 'review-ja.json の全文');
  segments.forEach((s, i) => {
    check(s.id === i && s.start === EXPECTED_TIMES[i][0] && s.end === EXPECTED_TIMES[i][1] && typeof s.text === 'string' && s.text, `区間 ${i} の時刻か文`);
    check(s.end <= audio.duration_seconds + 0.15, `区間 ${i} の終わりが音声より後です`);
  });

  // 原稿参照の手動修正：id 0・1・4 の文だけ。時刻と区間数は不変
  const edited = structure.edited_segments;
  check(Array.isArray(edited) && edited.length === 5, '修正例の区間数');
  const changed = [];
  edited.forEach((e, i) => {
    const s = segments[i];
    check(e.id === s.id && e.start === s.start && e.end === s.end && typeof e.text === 'string' && e.text, `修正例 ${i} の時刻が原出力と違います`);
    if (e.text !== s.text) changed.push(e.id);
  });
  check(sameList(changed, CHANGED_IDS), '修正した区間が id 0・1・4 ではありません');
  check(sameSegments(edited, editRecord.current_segments), 'edit-record.json の区間');
  check(sameList(editRecord.changed_segment_ids, CHANGED_IDS) && editRecord.cue_count === 5 && editRecord.timestamps_unchanged === true, 'edit-record.json の記録');
  check(editRecord.edited_export_sha256 === SRT_FILES.review.sha256 && editRecord.audio_listening_confirmed === false && editRecord.timing_accuracy_confirmed === false, 'edit-record.json の扱い');
  check(reference.original_output_unchanged === true && reference.timestamps_unchanged === true && reference.audio_listening_confirmed === false && reference.timing_accuracy_confirmed === false, 'reference-review.json の扱い');
  const corrections = structure.corrections;
  check(Array.isArray(corrections) && sameList(corrections.map((c) => c.id), CHANGED_IDS), 'structure.json の修正の記録');
  check(Array.isArray(reference.corrections) && reference.corrections.length === corrections.length, 'reference-review.json の修正の数');
  corrections.forEach((c, k) => {
    const r = reference.corrections[k];
    check(r && r.id === c.id && r.raw === c.raw && r.edited === c.edited && r.basis === c.basis, `修正 ${c.id} が reference-review.json と違います`);
    check(c.raw === segments[c.id].text && c.edited === edited[c.id].text && typeof c.basis === 'string' && c.basis, `修正 ${c.id} の文`);
  });

  // 原稿：合成の入力と、後の見比べ専用（認識には渡していない）
  check(script.id === 'review-ja' && script.kind === 'synthetic' && script.fictional === true && script.language === 'ja' && script.voice_name === audio.voice_name, 'input/script.json の形式');
  check(Array.isArray(script.sentences) && script.sentences.length === 4 && script.reference_text === script.sentences.join('') && script.reference_text === structure.reference_script, 'input/script.json の原稿4文');

  // 書き出し：ネイティブの原出力SRTと、デスクで書き出した修正例SRT
  const out = structure.outputs;
  check(out && out.raw === SRT_FILES.raw.path && out.review === SRT_FILES.review.path && out.raw_sha256 === SRT_FILES.raw.sha256 && out.review_sha256 === SRT_FILES.review.sha256
    && out.raw_bytes === SRT_FILES.raw.bytes && out.review_bytes === SRT_FILES.review.bytes, 'structure.json の出力');
  check(Array.isArray(out.formats) && sameList([...out.formats].sort(), ['json', 'jsonl', 'srt', 'tsv', 'txt', 'vtt']), 'get_writer の6形式');
  check(session.artifacts_sha256?.['review-ja.srt'] === SRT_FILES.raw.sha256 && session.artifacts_sha256['review-ja.json'] === sha('outputs/review-ja.json'), 'session.json の成果物');
  const rawCues = parseSrt(text(SRT_FILES.raw.path), SRT_FILES.raw.path);
  const reviewCues = parseSrt(text(SRT_FILES.review.path), SRT_FILES.review.path);
  check(rawCues.length === 5 && reviewCues.length === 5, 'SRTが5区間ではありません');
  segments.forEach((s, i) => {
    const timing = `${srtTime(s.start)} --> ${srtTime(s.end)}`;
    check(rawCues[i].index === i + 1 && rawCues[i].timing === timing && rawCues[i].text === s.text.trim().replaceAll('-->', '->'), `原出力SRTの${i + 1}番`);
    check(reviewCues[i].index === i + 1 && reviewCues[i].timing === timing && reviewCues[i].text === edited[i].text, `修正例SRTの${i + 1}番`);
  });

  // 原典と制作ソース
  check(text('vendor/whisper/LICENSE').includes('Copyright (c) 2022 OpenAI'), 'Whisper の LICENSE');
  check(text('vendor/whisper/README.md').includes("Whisper's code and model weights are released under the MIT License."), 'Whisper README の利用条件');
  const modelPy = text('vendor/whisper/whisper/model.py');
  check(modelPy.includes('class AudioEncoder(nn.Module):') && modelPy.includes('class TextDecoder(nn.Module):'), 'model.py の encoder と decoder');
  check(text('vendor/whisper/whisper/audio.py').includes('def log_mel_spectrogram('), 'audio.py の前処理');
  check(text('vendor/whisper/whisper/utils.py').includes('def get_writer('), 'utils.py の書き出し');
  check(text('vendor/whisper/whisper/decoding.py').includes('class DecodingResult'), 'decoding.py');
  check(text('vendor/whisper/whisper/__init__.py').includes('def load_model('), '__init__.py の load_model');
  const runner = text('run_transcribe.py');
  check(runner.includes('MODEL_NAME = "base"') && runner.includes('DEVICE = "cpu"') && runner.includes('"condition_on_previous_text": False'), 'run_transcribe.py の設定');
  check(text('derive-features.py').includes('log_mel_spectrogram(str(a.audio),n_mels=80,padding=N_SAMPLES)'), 'derive-features.py の前処理');
  check(request.trim().length > 0, 'request.txt が空です');
  check(verification.id === CASE_ID && verification.source_commit === SOURCE_COMMIT, 'verification.json');
  check(samples.format === 'input-output' && Array.isArray(samples.samples), 'samples.json');
  check(brief && typeof brief === 'object', 'brief.json');

  const excerpts = new Map(corrections.map((c) => [c.id, cueExcerpt(c.raw, c.edited)]));
  return {
    caseId: CASE_ID,
    commit: SOURCE_COMMIT,
    version: VERSION,
    assetCount: manifest.files.length,
    definition: structure.definition,
    parts,
    audio: {path: AUDIO_PATH, duration: audio.duration_seconds, sampleRate: audio.sample_rate, frames: audio.frames, voice: audio.voice_name},
    engine: {model: ENGINE.model, device: ENGINE.device, language: ENGINE.language, task: ENGINE.task, threads: ENGINE.threads, temperature: ENGINE.temperature},
    segments: segments.map(pick),
    edited: edited.map(pick),
    changedIds: changed,
    corrections: corrections.map((c) => ({id: c.id, raw: c.raw, edited: c.edited, basis: c.basis, excerpt: excerpts.get(c.id)})),
    rms: [...waveform.values],
    features: {rows: 80, cols: 96, matrix: matrix.map((row) => [...row])},
    srt: {
      raw: {...SRT_FILES.raw, cues: rawCues},
      review: {...SRT_FILES.review, cues: reviewCues},
    },
    script: {sentences: [...script.sentences]},
    request,
  };
}

// 26件をすべて取り直し、大きさとSHA-256、中身の対応を確かめた記録だけを返す。どれか一つでも違えば例外。
export async function loadValidatedAssets({signal, onProgress} = {}) {
  const manifestBytes = await fetchBytes(MANIFEST_PATH, signal);
  check((await sha256Hex(manifestBytes)) === MANIFEST_SHA256, 'concept/manifest.json のSHA-256が固定値と違います');
  const manifest = parseJson(MANIFEST_PATH, decodeText(manifestBytes, MANIFEST_PATH));
  validateManifest(manifest);
  const bytes = new Map();
  let done = 0;
  onProgress?.(0, manifest.files.length);
  await Promise.all(manifest.files.map(async (entry) => {
    const body = await fetchBytes(entry.path, signal);
    check(body.byteLength === entry.bytes, `${entry.path} の大きさが記録と違います`);
    check((await sha256Hex(body)) === entry.sha256, `${entry.path} のSHA-256が記録と違います`);
    bytes.set(entry.path, body);
    onProgress?.(++done, manifest.files.length);
  }));
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  return deepFreeze(buildBundle(manifest, bytes));
}

// ---------- 概念図の描画（ページと図解動画で共通） ----------

export const FONT = Object.freeze({
  sans: 'system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", "Noto Serif JP", serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, "BIZ UDGothic", monospace',
});

export const PALETTES = Object.freeze({
  light: Object.freeze({paper: '#f3efe6', card: '#fbf9f4', ink: '#1b1d1f', inkSoft: '#45484b', muted: '#676a69', line: '#cfc6b6', petrol: '#0f5c66', petrolSoft: '#d7e6e6', amber: '#9a5a0c', amberBright: '#d9962e', onPetrol: '#f7f4ee'}),
  dark: Object.freeze({paper: '#121517', card: '#1b2023', ink: '#ece7dd', inkSoft: '#c9c4ba', muted: '#a09c94', line: '#3c4447', petrol: '#62b6bf', petrolSoft: '#173338', amber: '#e7b25a', amberBright: '#e7b25a', onPetrol: '#0d1416'}),
});

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});
const R = (x, y, w, h) => ({x, y, w, h});
const cx = (r) => r.x + r.w / 2;
const cy = (r) => r.y + r.h / 2;
export const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x) => 1 - Math.pow(1 - x, 3);

export function restingParams() {
  return {
    show: {wav: 1, plane: 1, machine: 1, res: 1, tokens: 1, cards: 1, axis: 1, book: 1, files: 1},
    emph: {wav: 1, plane: 1, machine: 1, tokens: 1, cards: 1, book: 1, raw: 1, review: 1},
    ghost: 0, ghostBottom: 0,
    wavSlide: 0, wavReveal: 1, planeOpen: 1, planeSweep: 1, resDrop: 0,
    encFlow: 0, encGlow: 0, decGlow: 0, tokensOut: 1, tokenPulse: 0,
    cardsIn: [1, 1, 1, 1, 1], cardLift: [0, 0, 0, 0, 0], selected: -1, selGlow: 0,
    flip: [0, 0, 0, 0, 0], bookSlide: 0, scriptLink: 1, pencil: {from: -1, to: -1, k: 0, alpha: 1},
    writeRaw: 1, writeReview: 1, sizes: 1,
  };
}

function tallLayout(W, u, detail) {
  const m = Math.round(Math.max(12, W * 0.045));
  const iw = W - m * 2;
  const gap = u * 1.5;
  const head = u * 1.65, gut = u * 1.3, pad = u * 0.45;
  let y = u * 0.5;
  const wav = R(m, y, iw, u * 4.3); y += wav.h + gap;
  const plane = R(m, y, iw, u * 6); y += plane.h + gap;
  const machine = R(m, y, iw, u * 7.6); y += machine.h;
  const mp = u * 0.8, mh = u * 2.1;
  const ew = (iw - mp * 3) / 2;
  const enc = R(m + mp, machine.y + mh, ew, machine.h - mh - mp);
  const dec = R(m + mp * 2 + ew, enc.y, ew, enc.h);
  y += u * 0.6;
  const tokRow = R(dec.x, y, dec.w, u * 1.6);
  const tagRow = R(enc.x, y, enc.w, u * 1.6);
  y += tokRow.h + u * 0.9;
  const lane = {x: m + gut, w: iw - gut - pad};
  const cardsBand = R(lane.x, y, lane.w, u * 4.2); y += cardsBand.h;
  const axis = R(lane.x, y, lane.w, u * 1.7); y += axis.h + u * 0.7;
  const bottom = R(m, y, iw, u * (detail ? 7.4 : 6)); y += bottom.h + u * 0.5;
  return finishBottom({W, H: y, wav, plane, machine, enc, dec, tokRow, tagRow, cardsBand, axis, bottom,
    wavIn: R(lane.x, wav.y + head, lane.w, wav.h - head - pad), planeIn: R(lane.x, plane.y + head, lane.w, plane.h - head - pad)}, u);
}

function wideLayout(W, u, detail) {
  const m = u * 1.1;
  const iw = W - m * 2;
  const gx = Math.max(u * 1.8, iw * 0.04);
  const c1 = iw * 0.19, c2 = iw * 0.3, c3 = iw - c1 - c2 - gx * 2;
  const x1 = m, x2 = x1 + c1 + gx, x3 = x2 + c2 + gx;
  const head = u * 1.65, gut = u * 1.3, pad = u * 0.45;
  const top = u * 0.5;
  const wav = R(x1, top, c1, u * 4.6);
  const plane = R(x1, wav.y + wav.h + u * 1.5, c1, u * 6.8);
  const machine = R(x2, top, c2, plane.y + plane.h - top);
  const mp = u * 0.8, mh = u * 2.1;
  const ew = (c2 - mp * 3) / 2;
  const eh = Math.min(machine.h - mh - mp, u * 7);
  const ey = machine.y + mh + (machine.h - mh - mp - eh) / 2;
  const enc = R(x2 + mp, ey, ew, eh);
  const dec = R(x2 + mp * 2 + ew, ey, ew, eh);
  const tokRow = R(dec.x, machine.y + machine.h + u * 0.6, dec.w, u * 1.6);
  const tagRow = R(enc.x, tokRow.y, enc.w, u * 1.6);
  const cardsBand = R(x3, top + u * 1.2, c3, u * 4.6);
  const axis = R(x3, cardsBand.y + cardsBand.h, c3, u * 1.7);
  const bottom = R(x3, axis.y + axis.h + u * 0.9, c3, u * (detail ? 7.6 : 6.2));
  const H = Math.max(bottom.y + bottom.h, tokRow.y + tokRow.h) + u * 0.5;
  return finishBottom({W, H, wav, plane, machine, enc, dec, tokRow, tagRow, cardsBand, axis, bottom,
    wavIn: R(wav.x + gut, wav.y + head, wav.w - gut - pad, wav.h - head - pad),
    planeIn: R(plane.x + gut, plane.y + head, plane.w - gut - pad, plane.h - head - pad)}, u);
}

// 下段：左に原稿（別経路）、右に原出力SRTと修正例SRT
function finishBottom(L, u) {
  const b = L.bottom;
  const bookW = Math.round(b.w * 0.3);
  const labelRow = u * 1.35;
  const pg = u * 0.6;
  const pw = (b.w - bookW - u * 0.8 - pg) / 2;
  L.book = R(b.x, b.y, bookW, b.h);
  L.rawPaper = R(b.x + bookW + u * 0.8, b.y + labelRow, pw, b.h - labelRow);
  L.reviewPaper = R(L.rawPaper.x + pw + pg, L.rawPaper.y, pw, L.rawPaper.h);
  L.callout = R(L.rawPaper.x, b.y, L.reviewPaper.x + pw - L.rawPaper.x, b.h);
  return L;
}

// kind: 'tall'（縦に流れる）か 'wide'（横に流れる）。u は文字と余白の基準。幅に合わせて組み直す。
export function diagramLayout(kind, width, u, d, opts = {}) {
  const L = kind === 'wide' ? wideLayout(width, u, opts.detail) : tallLayout(width, u, opts.detail);
  L.kind = kind;
  L.u = u;
  L.detail = Boolean(opts.detail);
  const min = opts.minFont || 0;
  const f = (k) => Math.max(min, u * k);
  L.fs = {label: f(0.95), small: f(0.8), tiny: f(0.72), num: f(1), clock: f(0.8), chip: f(0.78)};
  const band = L.cardsBand;
  const span = d.audio.duration;
  const gapPx = Math.max(2, u * 0.18);
  L.cards = d.segments.map((s) => R(band.x + (s.start / span) * band.w + gapPx / 2, band.y, ((s.end - s.start) / span) * band.w - gapPx, band.h));
  L.pencilHome = {x: L.book.x + L.book.w * 0.84, y: L.book.y + u * 0.9};
  L.links = linkPaths(L);
  return L;
}

function elbow(x1, y1, x2, y2) {
  if (Math.abs(y1 - y2) < 1) return [[x1, y1], [x2, y2]];
  const xm = (x1 + x2) / 2;
  return [[x1, y1], [xm, y1], [xm, y2], [x2, y2]];
}

function linkPaths(L) {
  const {wav, plane, planeIn, enc, dec, tokRow, cardsBand, axis, rawPaper, reviewPaper, book} = L;
  const wide = L.kind === 'wide';
  const below = axis.y + axis.h;
  return {
    wp: [[cx(planeIn), wav.y + wav.h], [cx(planeIn), plane.y]],
    pe: wide ? elbow(plane.x + plane.w, cy(planeIn), enc.x, cy(enc)) : [[cx(enc), plane.y + plane.h], [cx(enc), enc.y]],
    ed: [[enc.x + enc.w, cy(enc)], [dec.x, cy(dec)]],
    dt: [[cx(dec), dec.y + dec.h], [cx(dec), tokRow.y]],
    tc: wide ? elbow(tokRow.x + tokRow.w, cy(tokRow), cardsBand.x, cy(cardsBand)) : [[cx(tokRow), tokRow.y + tokRow.h], [cx(tokRow), cardsBand.y]],
    wr: [[cx(rawPaper), below], [cx(rawPaper), rawPaper.y]],
    dr: [[cx(reviewPaper), below], [cx(reviewPaper), reviewPaper.y]],
    bk: [[cx(book), book.y + L.u * 0.2], [cx(book), cardsBand.y + cardsBand.h + L.u * 0.15]],
  };
}

function rr(ctx, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

// 文字を描く。max を超えるときは少し縮め、それでも入らなければ「…」で切る（drop なら描かない）。
export function drawText(ctx, s, x, y, o = {}) {
  const fam = FONT[o.family || 'sans'];
  const weight = o.weight || 400;
  let size = o.size || 14;
  let str = String(s);
  ctx.save();
  ctx.font = `${weight} ${size}px ${fam}`;
  if (o.max) {
    const floor = o.min || size * 0.84;
    while (size > floor && ctx.measureText(str).width > o.max) {
      size = Math.max(floor, size - Math.max(0.5, size * 0.04));
      ctx.font = `${weight} ${size}px ${fam}`;
    }
    if (ctx.measureText(str).width > o.max) {
      if (o.drop) { ctx.restore(); return 0; }
      const chars = Array.from(str);
      while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > o.max) chars.pop();
      str = `${chars.join('')}…`;
    }
  }
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  const width = ctx.measureText(str).width;
  if (o.bg) {
    const left = o.align === 'center' ? x - width / 2 : o.align === 'right' ? x - width : x;
    ctx.fillStyle = o.bg;
    rr(ctx, left - size * 0.3, y - size * 0.95, width + size * 0.6, size * 1.3, size * 0.25);
    ctx.fill();
  }
  ctx.fillStyle = o.color || '#000';
  ctx.fillText(str, x, y);
  ctx.restore();
  return width;
}

// 入る幅で先頭から切る。2文字未満しか入らなければ空。
function fitHead(ctx, s, max, font) {
  ctx.save();
  ctx.font = font;
  let out = s;
  if (ctx.measureText(s).width > max) {
    const chars = Array.from(s);
    while (chars.length > 0 && ctx.measureText(`${chars.join('')}…`).width > max) chars.pop();
    out = chars.length >= 2 ? `${chars.join('')}…` : '';
  }
  ctx.restore();
  return out;
}

function arrow(ctx, pts, o) {
  if (!(o.alpha > 0.003)) return;
  const [ex, ey] = pts[pts.length - 1];
  const [px, py] = pts[pts.length - 2];
  const ang = Math.atan2(ey - py, ex - px);
  const hl = o.head;
  ctx.save();
  ctx.globalAlpha *= o.alpha;
  ctx.strokeStyle = o.color;
  ctx.fillStyle = o.color;
  ctx.lineWidth = o.width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineTo(ex - Math.cos(ang) * hl * 0.7, ey - Math.sin(ang) * hl * 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - hl * Math.cos(ang - 0.42), ey - hl * Math.sin(ang - 0.42));
  ctx.lineTo(ex - hl * Math.cos(ang + 0.42), ey - hl * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function panel(ctx, r, pal, o = {}) {
  rr(ctx, r.x, r.y, r.w, r.h, o.radius ?? Math.min(12, r.h * 0.12));
  ctx.fillStyle = o.fill || pal.card;
  ctx.fill();
  ctx.strokeStyle = o.stroke || pal.line;
  ctx.lineWidth = o.width || 1.2;
  ctx.stroke();
}

// 実際のlog-Mel行列（80帯×96列）を、そのまま画素にする。下が低い帯、上が高い帯。
const STOPS = [[0, [24, 36, 44]], [0.38, [16, 88, 98]], [0.62, [64, 140, 138]], [0.82, [206, 168, 92]], [1, [246, 196, 104]]];
function colormap(v) {
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1];
      const [b, cb] = STOPS[i];
      const k = (v - a) / (b - a);
      return ca.map((c, j) => Math.round(c + (cb[j] - c) * k));
    }
  }
  return STOPS[STOPS.length - 1][1];
}
const featureCache = new WeakMap();
function featureImage(d) {
  let image = featureCache.get(d.features);
  if (image) return image;
  const {rows, cols, matrix} = d.features;
  image = document.createElement('canvas');
  image.width = cols;
  image.height = rows;
  const c = image.getContext('2d');
  const data = c.createImageData(cols, rows);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const [red, green, blue] = colormap(matrix[r][col]);
      const o = ((rows - 1 - r) * cols + col) * 4;
      data.data[o] = red;
      data.data[o + 1] = green;
      data.data[o + 2] = blue;
      data.data[o + 3] = 255;
    }
  }
  c.putImageData(data, 0, 0);
  featureCache.set(d.features, image);
  return image;
}

function drawSkeleton(ctx, L, pal, top, bottom) {
  ctx.save();
  ctx.strokeStyle = pal.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([L.u * 0.25, L.u * 0.25]);
  const box = (r, a) => {
    if (a <= 0.003) return;
    ctx.globalAlpha = a;
    rr(ctx, r.x, r.y, r.w, r.h, Math.min(12, r.h * 0.12));
    ctx.stroke();
  };
  for (const r of [L.wav, L.plane, L.machine, L.enc, L.dec, ...L.cards]) box(r, top);
  for (const r of [L.book, L.rawPaper, L.reviewPaper]) box(r, bottom);
  ctx.setLineDash([]);
  const lines = {color: pal.muted, width: 1, head: L.u * 0.35};
  for (const key of ['wp', 'pe', 'ed', 'dt', 'tc']) arrow(ctx, L.links[key], {...lines, alpha: top});
  for (const key of ['wr', 'dr', 'bk']) arrow(ctx, L.links[key], {...lines, alpha: bottom});
  ctx.restore();
}

function drawWav(ctx, L, p, d, pal, alpha) {
  if (alpha <= 0.003) return;
  const {u, fs} = L;
  const r = L.wav;
  const b = L.wavIn;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(-p.wavSlide * (r.x + r.w * 0.7), 0);
  panel(ctx, r, pal);
  const ly = r.y + u * 1.2;
  const w = drawText(ctx, 'WAV', r.x + u * 0.55, ly, {size: fs.label, weight: 700, color: pal.ink});
  drawText(ctx, `${d.audio.duration.toFixed(2)}秒`, r.x + u * 0.55 + w + u * 0.4, ly, {size: fs.small, family: 'mono', color: pal.inkSoft, max: r.w * 0.4});
  drawText(ctx, '実入力', r.x + r.w - u * 0.55, ly, {size: fs.small, color: pal.muted, align: 'right', max: r.w * 0.28, drop: true});
  const peak = Math.max(...d.rms) || 1;
  const mid = b.y + b.h / 2;
  const xOf = (t) => b.x + Math.min(1, t / d.audio.duration) * b.w;
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x - 1, b.y - 1, b.w * p.wavReveal + 2, b.h + 2);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(b.x, mid);
  d.rms.forEach((v, i) => ctx.lineTo(xOf((i + 0.5) * 0.1), mid - (v / peak) * b.h * 0.48));
  ctx.lineTo(b.x + b.w, mid);
  for (let i = d.rms.length - 1; i >= 0; i--) ctx.lineTo(xOf((i + 0.5) * 0.1), mid + (d.rms[i] / peak) * b.h * 0.48);
  ctx.closePath();
  ctx.fillStyle = pal.petrol;
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawPlane(ctx, L, p, d, pal, alpha) {
  if (alpha <= 0.003) return;
  const {u, fs} = L;
  const r = L.plane;
  const b = L.planeIn;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // 波形の下辺から開く
  const open = p.planeOpen;
  const shown = lerpRect(R(r.x, r.y, r.w, Math.min(r.h, u * 1.8)), r, open);
  panel(ctx, shown, pal);
  const ly = r.y + u * 1.2;
  const w = drawText(ctx, 'log-Mel', r.x + u * 0.55, ly, {size: fs.label, weight: 700, color: pal.ink, max: r.w * 0.5});
  drawText(ctx, '80帯', r.x + u * 0.55 + w + u * 0.35, ly, {size: fs.small, color: pal.inkSoft, max: r.w * 0.2, drop: true});
  drawText(ctx, '実音声の特徴', r.x + r.w - u * 0.55, ly, {size: fs.small, weight: 600, color: pal.amber, align: 'right', max: r.w * 0.42, drop: true});
  if (open > 0.02) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w * p.planeSweep, b.h * open);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(featureImage(d), b.x, b.y, b.w, b.h);
    ctx.restore();
    ctx.globalAlpha *= clamp01((open - 0.6) / 0.4);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    const gx = r.x + (b.x - r.x) / 2;
    drawText(ctx, '高', gx, b.y + fs.tiny * 0.9, {size: fs.tiny, color: pal.muted, align: 'center'});
    drawText(ctx, '低', gx, b.y + b.h, {size: fs.tiny, color: pal.muted, align: 'center'});
  }
  ctx.restore();
}

function drawMachineFrame(ctx, L, pal, alpha) {
  if (alpha <= 0.003) return;
  const r = L.machine;
  ctx.save();
  ctx.globalAlpha *= alpha;
  rr(ctx, r.x, r.y, r.w, r.h, Math.min(16, L.u * 0.8));
  ctx.fillStyle = pal.petrolSoft;
  ctx.fill();
  ctx.strokeStyle = pal.petrol;
  ctx.lineWidth = Math.max(1.4, L.u * 0.1);
  ctx.stroke();
  ctx.restore();
}

// 枠の中身。枠へ入る矢印を描いた後に重ね、文字を矢印の上に置く。
function drawMachine(ctx, L, p, d, pal, alpha) {
  if (alpha <= 0.003) return;
  const {u, fs} = L;
  const r = L.machine;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const hy = r.y + u * 1.35;
  const tw = drawText(ctx, 'Python', r.x + u * 0.8, hy, {size: fs.label, weight: 700, color: pal.ink, bg: pal.petrolSoft});
  // 重みと設定：実行の前提として、枠の上辺へ差し込む
  const chips = [
    {text: 'base重み', stroke: pal.amber, color: pal.amber},
    {text: `${d.engine.language}・${d.engine.device.toUpperCase()}`, stroke: pal.inkSoft, color: pal.inkSoft},
  ];
  const ch = u * 1.3;
  let right = r.x + r.w - u * 0.7;
  const leftLimit = r.x + u * 0.8 + tw + u * 0.6;
  ctx.save();
  ctx.globalAlpha *= p.show.res;
  ctx.translate(0, -p.resDrop * u * 2.4);
  // 右から置く。幅が足りなければ設定から省き、重みは残す
  for (const c of chips) {
    ctx.save();
    ctx.font = `600 ${fs.chip}px ${FONT.sans}`;
    const cw = ctx.measureText(c.text).width + u * 0.9;
    ctx.restore();
    if (right - cw < leftLimit) break;
    rr(ctx, right - cw, hy - ch * 0.78, cw, ch, ch / 2);
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    drawText(ctx, c.text, right - cw / 2, hy - ch * 0.78 + ch * 0.7, {size: fs.chip, weight: 600, color: c.color, align: 'center'});
    right -= cw + u * 0.4;
  }
  ctx.restore();
  const box = (b, name, sub, glow) => {
    panel(ctx, b, pal, {stroke: pal.petrol, width: 1.6});
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha *= glow * 0.32;
      rr(ctx, b.x, b.y, b.w, b.h, Math.min(12, b.h * 0.12));
      ctx.fillStyle = pal.petrol;
      ctx.fill();
      ctx.restore();
    }
    drawText(ctx, name, cx(b), cy(b) - u * 0.05, {size: fs.label, weight: 700, color: pal.petrol, align: 'center', max: b.w - u * 0.6});
    drawText(ctx, sub, cx(b), cy(b) + u * 1.05, {size: fs.small, color: pal.inkSoft, align: 'center', max: b.w - u * 0.6, drop: true});
  };
  box(L.enc, 'encoder', '音の特徴', p.encGlow);
  box(L.dec, 'decoder', '文・時刻', p.decGlow);
  arrow(ctx, L.links.ed, {color: pal.petrol, width: Math.max(1.4, u * 0.1), head: Math.max(6, u * 0.45), alpha: 1});
  ctx.restore();
  drawText(ctx, 'モデル構造の図', L.tagRow.x, L.tagRow.y + L.tagRow.h * 0.72, {size: fs.small, color: pal.muted, max: L.tagRow.w, drop: true, alpha});
}

// 前処理済みの同じ色面がencoderへ入る（構造の説明。推論内部の記録ではない）
function drawEncFlow(ctx, L, p, d) {
  const k = p.encFlow;
  if (k <= 0 || k >= 1) return;
  const e = ease(k);
  const r = lerpRect(L.planeIn, R(L.enc.x + L.u * 0.3, L.enc.y + L.u * 0.3, L.enc.w - L.u * 0.6, L.enc.h - L.u * 0.6), e);
  ctx.save();
  ctx.globalAlpha *= (1 - clamp01((k - 0.75) / 0.25)) * 0.95;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(featureImage(d), r.x, r.y, r.w, r.h);
  ctx.restore();
}

function tokenSlots(ctx, L, d) {
  const {u, fs} = L;
  const s0 = d.segments[0];
  const items = [
    {text: s0.start.toFixed(2), family: 'mono', time: true},
    {text: '文', family: 'sans', time: false},
    {text: s0.end.toFixed(2), family: 'mono', time: true},
  ];
  const h = L.tokRow.h * 0.86;
  const gap = u * 0.35;
  ctx.save();
  for (const it of items) {
    ctx.font = `600 ${fs.clock}px ${FONT[it.family]}`;
    it.w = ctx.measureText(it.text).width + u * 0.8;
  }
  ctx.restore();
  const total = items.reduce((sum, it) => sum + it.w, 0) + gap * (items.length - 1);
  let x = L.tokRow.x + (L.tokRow.w - total) / 2;
  for (const it of items) {
    it.r = R(x, L.tokRow.y + (L.tokRow.h - h) / 2, it.w, h);
    x += it.w + gap;
  }
  return items;
}

function drawTokens(ctx, L, p, d, pal, alpha) {
  if (alpha <= 0.003) return;
  const {u, fs} = L;
  const from = R(cx(L.dec) - u * 0.4, L.dec.y + L.dec.h - u * 0.6, u * 0.8, u * 0.6);
  tokenSlots(ctx, L, d).forEach((it, i) => {
    const k = easeOut(clamp01((p.tokensOut - i * 0.18) / 0.64));
    if (k <= 0) return;
    let r = lerpRect(from, it.r, k);
    const s = 1 + 0.16 * p.tokenPulse;
    r = R(cx(r) - (r.w * s) / 2, cy(r) - (r.h * s) / 2, r.w * s, r.h * s);
    ctx.save();
    ctx.globalAlpha *= alpha * k;
    rr(ctx, r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fillStyle = it.time ? pal.card : pal.petrol;
    ctx.fill();
    ctx.strokeStyle = pal.petrol;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    if (k > 0.6) drawText(ctx, it.text, cx(r), cy(r) + fs.clock * 0.36, {size: fs.clock, weight: 600, family: it.family, color: it.time ? pal.petrol : pal.onPetrol, align: 'center'});
    ctx.restore();
  });
}

function drawAxis(ctx, L, p, d, pal, alpha) {
  if (alpha <= 0.003) return;
  const {u, fs} = L;
  const a = L.axis;
  const y = a.y + u * 0.35;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = pal.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a.x, y);
  ctx.lineTo(a.x + a.w, y);
  for (const t of [0, 5, 10, 15]) {
    const x = a.x + (t / d.audio.duration) * a.w;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + u * 0.35);
  }
  ctx.stroke();
  for (const t of [0, 5, 10, 15]) {
    const x = a.x + (t / d.audio.duration) * a.w;
    drawText(ctx, String(t), x, a.y + a.h * 0.92, {size: fs.tiny, family: 'mono', color: pal.muted, align: t === 0 ? 'left' : 'center'});
  }
  drawText(ctx, '推定時刻', a.x + a.w, a.y + a.h * 0.92, {size: fs.tiny, color: pal.muted, align: 'right', max: a.w * 0.24, drop: true});
  ctx.restore();
}

function pencilPoint(L, idx) {
  if (idx < 0) return L.pencilHome;
  const c = L.cards[idx];
  return {x: c.x + c.w * 0.78, y: c.y - L.u * 0.15};
}

function drawCards(ctx, L, p, d, pal, alpha) {
  if (alpha <= 0.003) return;
  const {u, fs} = L;
  const src = R(cx(L.tokRow) - u * 0.6, cy(L.tokRow) - u * 0.4, u * 1.2, u * 0.8);
  const pen = p.pencil;
  d.segments.forEach((seg, i) => {
    const k = p.cardsIn[i];
    if (k <= 0.003) return;
    const target = L.cards[i];
    const r = lerpRect(src, target, k);
    const selected = p.selected === i ? p.selGlow : 0;
    r.y -= (p.cardLift[i] * 0.4 + selected * 0.22) * u;
    const underPen = pen.to === i && pen.k > 0.85 && p.pencil.alpha > 0;
    ctx.save();
    ctx.globalAlpha *= alpha * Math.min(1, k * 2);
    rr(ctx, r.x, r.y, r.w, r.h, Math.min(10, u * 0.45));
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.strokeStyle = selected > 0.01 ? pal.amberBright : underPen ? pal.petrol : pal.line;
    ctx.lineWidth = selected > 0.01 || underPen ? Math.max(2, u * 0.16) : 1.2;
    ctx.stroke();
    if (k > 0.85) {
      ctx.globalAlpha *= clamp01((k - 0.85) / 0.15);
      ctx.save();
      rr(ctx, r.x, r.y, r.w, r.h, Math.min(10, u * 0.45));
      ctx.clip();
      const pad = Math.max(4, u * 0.35);
      const inner = r.w - pad * 2;
      drawText(ctx, String(i + 1), r.x + pad, r.y + u * 1.15, {size: fs.num, weight: 700, color: pal.ink});
      const changed = d.changedIds.includes(seg.id);
      const f = changed ? p.flip[i] : 0;
      const exFont = `500 ${fs.small}px ${FONT.sans}`;
      const ey = r.y + u * 2.4;
      const raw = fitHead(ctx, seg.text.replace(/\n/g, ''), inner, exFont);
      if (raw && f < 1) drawText(ctx, raw, r.x + pad, ey - f * u * 0.7, {size: fs.small, weight: 500, color: pal.inkSoft, alpha: 1 - f});
      if (changed && f > 0) {
        const fixed = fitHead(ctx, d.edited[i].text.replace(/\n/g, ''), inner, exFont);
        if (fixed) drawText(ctx, fixed, r.x + pad, ey + (1 - f) * u * 0.7, {size: fs.small, weight: 600, color: pal.petrol, alpha: f});
        // 手で直した印（右上の小さな三角）
        ctx.save();
        ctx.globalAlpha *= clamp01((f - 0.5) * 2);
        const t = u * 0.6;
        ctx.beginPath();
        ctx.moveTo(r.x + r.w - t, r.y);
        ctx.lineTo(r.x + r.w, r.y);
        ctx.lineTo(r.x + r.w, r.y + t);
        ctx.closePath();
        ctx.fillStyle = pal.petrol;
        ctx.fill();
        ctx.restore();
      }
      // 推定時刻：原出力のまま。幅が足りなければ開始だけ
      const clockFont = `500 ${fs.clock}px ${FONT.mono}`;
      const full = `${seg.start.toFixed(2)}–${seg.end.toFixed(2)}`;
      ctx.save();
      ctx.font = clockFont;
      const label = ctx.measureText(full).width <= inner ? full : seg.start.toFixed(2);
      ctx.restore();
      drawText(ctx, label, r.x + pad, r.y + r.h - u * 0.55, {size: fs.clock, family: 'mono', color: pal.muted, max: inner});
      ctx.restore();
    }
    ctx.restore();
  });
}

function drawBook(ctx, L, p, d, pal, alpha) {
  if (alpha <= 0.003) return;
  const {u, fs} = L;
  const b = L.book;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(-p.bookSlide * (b.x + b.w), 0);
  const iw = Math.min(b.w * 0.72, u * 3.4);
  const ih = u * 2.3;
  const x0 = cx(b);
  const y0 = b.y + u * 0.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ih * 0.1);
    ctx.lineTo(x0 + side * iw / 2, y0);
    ctx.lineTo(x0 + side * iw / 2, y0 + ih);
    ctx.lineTo(x0, y0 + ih + ih * 0.06);
    ctx.closePath();
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.strokeStyle = pal.inkSoft;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.strokeStyle = pal.line;
    ctx.beginPath();
    for (let k = 1; k <= 3; k++) {
      const yy = y0 + ih * (0.25 + k * 0.17);
      ctx.moveTo(x0 + side * iw * 0.1, yy);
      ctx.lineTo(x0 + side * iw * 0.4, yy - ih * 0.04);
    }
    ctx.stroke();
  }
  const ly = y0 + ih + u * 1.35;
  drawText(ctx, '原稿', x0, ly, {size: fs.label, weight: 700, color: pal.ink, align: 'center'});
  drawText(ctx, '認識へ渡さない', x0, ly + u * 1.05, {size: fs.tiny, color: pal.muted, align: 'center', max: b.w, drop: true});
  ctx.restore();
}

function drawPencil(ctx, L, p, pal, alpha) {
  const pen = p.pencil;
  if (alpha * pen.alpha <= 0.003) return;
  const a = pencilPoint(L, pen.from);
  const b = pencilPoint(L, pen.to);
  const k = pen.k;
  const x = lerp(a.x, b.x, k);
  const y = lerp(a.y, b.y, k) - Math.sin(Math.PI * k) * L.u * 1.4;
  const u = L.u;
  ctx.save();
  ctx.globalAlpha *= alpha * pen.alpha;
  ctx.translate(x - p.bookSlide * (L.book.x + L.book.w) * (pen.to < 0 && pen.from < 0 ? 1 : 0), y);
  ctx.rotate(-0.75);
  const len = u * 2;
  const wd = u * 0.46;
  ctx.fillStyle = pal.amberBright;
  ctx.fillRect(wd * 0.9, -wd / 2, len, wd);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(wd * 0.9, -wd / 2);
  ctx.lineTo(wd * 0.9, wd / 2);
  ctx.closePath();
  ctx.fillStyle = pal.ink;
  ctx.fill();
  ctx.restore();
}

function drawPaper(ctx, L, p, d, pal, alpha, kind) {
  if (alpha <= 0.003) return;
  const {u, fs} = L;
  const r = kind === 'raw' ? L.rawPaper : L.reviewPaper;
  const file = d.srt[kind];
  const write = kind === 'raw' ? p.writeRaw : p.writeReview;
  const stroke = kind === 'raw' ? pal.inkSoft : pal.petrol;
  const fold = u * 0.8;
  ctx.save();
  ctx.globalAlpha *= alpha;
  drawText(ctx, kind === 'raw' ? 'writer' : '字幕デスク', cx(r), r.y - u * 0.4, {size: fs.small, weight: 600, family: kind === 'raw' ? 'mono' : 'sans', color: stroke, align: 'center', bg: pal.paper, max: r.w});
  ctx.beginPath();
  ctx.moveTo(r.x, r.y);
  ctx.lineTo(r.x + r.w - fold, r.y);
  ctx.lineTo(r.x + r.w, r.y + fold);
  ctx.lineTo(r.x + r.w, r.y + r.h);
  ctx.lineTo(r.x, r.y + r.h);
  ctx.closePath();
  ctx.fillStyle = pal.card;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r.x + r.w - fold, r.y);
  ctx.lineTo(r.x + r.w - fold, r.y + fold);
  ctx.lineTo(r.x + r.w, r.y + fold);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  const pad = Math.max(5, u * 0.45);
  const inner = r.w - pad * 2;
  drawText(ctx, kind === 'raw' ? '原出力SRT' : '修正例SRT', r.x + pad, r.y + u * 1.15, {size: fs.small, weight: 700, color: pal.ink, max: inner - fold * 0.6});
  drawText(ctx, `${file.bytes} B`, r.x + pad, r.y + u * 2.1, {size: fs.tiny, family: 'mono', color: pal.muted, alpha: p.sizes, max: inner});
  let top = r.y + u * 2.6;
  if (L.detail) {
    // SRTの形を一区間だけ短く：時刻行の頭と文の頭
    const cue = file.cues[0];
    const rowA = clamp01(write * 5);
    drawText(ctx, `${cue.timing.split(' --> ')[0]} →`, r.x + pad, r.y + u * 3.2, {size: fs.tiny, family: 'mono', color: pal.inkSoft, max: inner, alpha: rowA});
    const head = fitHead(ctx, cue.text.replace(/\n/g, ''), inner, `600 ${fs.small}px ${FONT.sans}`);
    if (head) drawText(ctx, head, r.x + pad, r.y + u * 4.25, {size: fs.small, weight: 600, color: kind === 'raw' ? pal.ink : pal.petrol, alpha: rowA});
    top = r.y + u * 4.8;
  }
  const rows = file.cues.length;
  const avail = r.y + r.h - pad * 0.8 - top;
  const rowH = avail / rows;
  const longest = Math.max(...file.cues.map((c) => Array.from(c.text.replace(/\n/g, '')).length));
  file.cues.forEach((cue, i) => {
    const a = clamp01(write * rows - i);
    if (a <= 0 || rowH < 2) return;
    const y = top + rowH * i + rowH * 0.25;
    const len = Array.from(cue.text.replace(/\n/g, '')).length / longest;
    const changed = kind === 'review' && d.changedIds.includes(d.segments[i].id);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = changed ? pal.petrol : pal.muted;
    const bw = Math.max(u * 0.6, (inner - u * 0.2) * len) * (0.4 + 0.6 * a);
    ctx.fillRect(r.x + pad, y, bw, Math.max(2, rowH * 0.42));
    ctx.restore();
  });
  ctx.restore();
}

// p は restingParams() と同じ形。ページの3段階も、動画の各時刻も、この同じ図を描く。
export function drawDiagram(ctx, L, p, d, pal) {
  const {u} = L;
  const vis = (show, emph) => show * (0.32 + 0.68 * emph);
  const a = {
    wav: vis(p.show.wav, p.emph.wav),
    plane: vis(p.show.plane, p.emph.plane),
    machine: vis(p.show.machine, p.emph.machine),
    tokens: vis(p.show.tokens, p.emph.tokens),
    cards: vis(p.show.cards, p.emph.cards),
    axis: vis(p.show.axis, p.emph.cards),
    book: vis(p.show.book, p.emph.book),
    raw: vis(p.show.files, p.emph.raw),
    review: vis(p.show.files, p.emph.review),
  };
  ctx.save();
  if (p.ghost > 0.003 || p.ghostBottom > 0.003) drawSkeleton(ctx, L, pal, p.ghost, p.ghostBottom);
  // 矢印は図形と文字の下に描く
  const line = {color: pal.inkSoft, width: Math.max(1.4, u * 0.1), head: Math.max(6, u * 0.45)};
  arrow(ctx, L.links.wp, {...line, alpha: Math.min(a.wav, a.plane)});
  arrow(ctx, L.links.tc, {...line, alpha: Math.min(a.tokens, a.cards)});
  arrow(ctx, L.links.wr, {...line, alpha: Math.min(a.axis, a.raw)});
  arrow(ctx, L.links.dr, {...line, color: pal.petrol, alpha: Math.min(a.axis, a.review)});
  arrow(ctx, L.links.bk, {...line, color: pal.petrol, dash: [u * 0.35, u * 0.3], alpha: a.book * p.scriptLink});
  drawWav(ctx, L, p, d, pal, a.wav);
  drawPlane(ctx, L, p, d, pal, a.plane);
  drawMachineFrame(ctx, L, pal, a.machine);
  arrow(ctx, L.links.pe, {...line, alpha: Math.min(a.plane, a.machine)});
  arrow(ctx, L.links.dt, {...line, alpha: Math.min(a.machine, a.tokens)});
  drawMachine(ctx, L, p, d, pal, a.machine);
  drawEncFlow(ctx, L, p, d);
  drawTokens(ctx, L, p, d, pal, a.tokens);
  drawAxis(ctx, L, p, d, pal, a.axis);
  drawCards(ctx, L, p, d, pal, a.cards);
  drawBook(ctx, L, p, d, pal, a.book);
  drawPaper(ctx, L, p, d, pal, a.raw, 'raw');
  drawPaper(ctx, L, p, d, pal, a.review, 'review');
  drawPencil(ctx, L, p, pal, a.book);
  ctx.restore();
}

// ---------- 作例ページ ----------

const THEME_KEY = 'studio-yebisu.whisper-example.theme';

function bootPage() {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const els = {
    figure: $('diagram-figure'), canvas: $('diagram'), caption: $('diagram-caption'),
    stages: [...document.querySelectorAll('[data-stage]')], replay: $('replay'),
    save: $('save-srt'), saveMeta: $('save-meta'), desk: $('open-desk'),
    status: $('load-status'), retry: $('retry'),
    modes: [...document.querySelectorAll('[data-mode]')], cueList: $('cue-list'),
    cueNo: $('cue-no'), cueRange: $('cue-range'), cueMeta: $('cue-meta'), cueRaw: $('cue-raw'), cueEdited: $('cue-edited'),
    cueBasis: $('cue-basis'), readout: $('cue-readout'),
    audio: $('input-audio'), audioStatus: $('audio-status'),
    parts: [...document.querySelectorAll('[data-part]')], partLabel: $('part-label'), partMeaning: $('part-meaning'),
    partQuote: $('part-quote'), partSource: $('part-source'),
    call: $('python-call'),
    request: $('request-text'), copy: $('copy-request'), copyStatus: $('copy-status'),
    themes: [...document.querySelectorAll('[data-theme-choice]')],
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const ctx = els.canvas.getContext('2d');
  const ui = {
    data: null, layout: null, stage: 'input', mode: 'raw', cue: 0, part: 'python',
    anim: null, from: null, last: restingParams(), raf: 0, controller: null, pendingSeek: null, dpr: 1,
  };

  // ----- 表示の色 -----
  const readTheme = () => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
    } catch {
      return 'system';
    }
  };
  const palette = () => {
    const t = root.dataset.theme;
    return PALETTES[t === 'dark' || (t !== 'light' && darkQuery.matches) ? 'dark' : 'light'];
  };
  function applyTheme(value, persist) {
    root.dataset.theme = value;
    for (const b of els.themes) b.setAttribute('aria-pressed', String(b.dataset.themeChoice === value));
    if (persist) {
      try { localStorage.setItem(THEME_KEY, value); } catch { /* 保存できなくても表示は切り替える */ }
    }
    draw();
  }
  for (const b of els.themes) b.addEventListener('click', () => applyTheme(b.dataset.themeChoice, true));
  darkQuery.addEventListener?.('change', () => draw());
  applyTheme(readTheme(), false);

  // ----- 図の段階と動き -----
  const bump = (e, a, b) => Math.sin(Math.PI * clamp01((e - a) / (b - a)));
  const stageEmphasis = (stage, mode) => ({
    input: {wav: 1, plane: 1, machine: 0.72, tokens: 0.72, cards: 0.72, book: 0.72, raw: 0.72, review: 0.72},
    model: {wav: 0.72, plane: 1, machine: 1, tokens: 1, cards: 1, book: 0.72, raw: 0.72, review: 0.72},
    subs: {wav: 0.72, plane: 0.72, machine: 0.72, tokens: 0.72, cards: 1, book: mode === 'review' ? 1 : 0.72, raw: mode === 'raw' ? 1 : 0.72, review: mode === 'review' ? 1 : 0.72},
  })[stage];
  const flipTarget = () => (ui.data ? ui.data.segments.map((s) => (ui.mode === 'review' && ui.data.changedIds.includes(s.id) ? 1 : 0)) : [0, 0, 0, 0, 0]);
  const PENCIL_START = 0.3, PENCIL_LEG = 0.6;
  const animLength = () => {
    if (!ui.anim) return 0;
    if (ui.anim.kind === 'mode') return 1.5;
    if (ui.stage === 'input') return 1.9;
    if (ui.stage === 'model') return 2.8;
    return ui.mode === 'raw' ? 1.5 : PENCIL_START + 3 * PENCIL_LEG + 1.5;
  };

  function pageParams(now) {
    const p = restingParams();
    const anim = ui.anim;
    const e = anim ? Math.max(0, (now - anim.t0) / 1000) : Infinity;
    const k = ease(clamp01(e / 0.6));
    const target = stageEmphasis(ui.stage, ui.mode);
    const from = ui.from || {emph: target, flip: flipTarget()};
    for (const key of Object.keys(p.emph)) p.emph[key] = lerp(from.emph[key] ?? target[key], target[key], k);
    p.flip = flipTarget().map((to, i) => lerp(from.flip[i] ?? to, to, k));
    p.selected = ui.cue;
    p.selGlow = 1;
    if (!anim || !Number.isFinite(e)) return p;
    if (anim.kind === 'mode') {
      if (ui.stage === 'subs') {
        if (ui.mode === 'raw') p.writeRaw = clamp01((e - 0.3) / 1.0);
        else p.writeReview = clamp01((e - 0.3) / 1.0);
      }
      return p;
    }
    if (ui.stage === 'input') {
      p.wavReveal = easeOut(clamp01(e / 1.0));
      p.planeSweep = ease(clamp01((e - 0.5) / 1.3));
    } else if (ui.stage === 'model') {
      p.encFlow = clamp01((e - 0.1) / 1.1);
      p.encGlow = bump(e, 0.7, 1.7);
      p.decGlow = bump(e, 1.2, 2.2);
      p.tokenPulse = bump(e, 1.5, 2.1);
      p.cardLift = p.cardLift.map((_, i) => bump(e, 1.8 + i * 0.1, 2.3 + i * 0.1));
    } else if (ui.mode === 'raw') {
      p.writeRaw = clamp01((e - 0.2) / 1.2);
    } else {
      // 鉛筆が直した区間を順に回り、その後にデスクが修正例SRTを書き出す
      const ids = ui.data.changedIds;
      const stops = [-1, ...ids, -1];
      let pen = {from: -1, to: -1, k: 0};
      for (let j = 0; j < stops.length - 1; j++) {
        const s = PENCIL_START + j * PENCIL_LEG;
        if (e >= s) pen = {from: stops[j], to: stops[j + 1], k: ease(clamp01((e - s) / 0.35))};
      }
      p.pencil = {...pen, alpha: 1};
      p.flip = p.flip.map((v, i) => {
        const j = ids.indexOf(i);
        return j < 0 ? 0 : ease(clamp01((e - (PENCIL_START + j * PENCIL_LEG + 0.35)) / 0.3));
      });
      p.writeReview = clamp01((e - (PENCIL_START + ids.length * PENCIL_LEG + 0.4)) / 1.0);
    }
    return p;
  }

  function draw(now = performance.now()) {
    const L = ui.layout;
    if (!ui.data || !L) return;
    const p = pageParams(now);
    ui.last = p;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.setTransform(ui.dpr, 0, 0, ui.dpr, 0, 0);
    drawDiagram(ctx, L, p, ui.data, palette());
  }

  function startAnim(kind) {
    ui.from = {emph: {...ui.last.emph}, flip: [...ui.last.flip]};
    ui.anim = {kind, t0: reduce.matches ? -Infinity : performance.now()};
    cancelAnimationFrame(ui.raf);
    const step = (now) => {
      draw(now);
      if (ui.anim && (now - ui.anim.t0) / 1000 < animLength()) ui.raf = requestAnimationFrame(step);
      else ui.raf = 0;
    };
    ui.raf = requestAnimationFrame(step);
  }

  function relayout() {
    if (!ui.data) return;
    const w = Math.round(els.figure.clientWidth);
    if (w <= 0) return;
    const wide = w >= 680;
    const u = wide ? Math.min(17, Math.max(13, w / 60)) : w < 340 ? 13 : 14;
    ui.layout = diagramLayout(wide ? 'wide' : 'tall', w, u, ui.data, {minFont: 11.5});
    ui.dpr = Math.min(3, window.devicePixelRatio || 1);
    els.canvas.style.height = `${Math.ceil(ui.layout.H)}px`;
    els.canvas.width = Math.round(w * ui.dpr);
    els.canvas.height = Math.round(ui.layout.H * ui.dpr);
    draw();
  }
  new ResizeObserver(() => relayout()).observe(els.figure);

  const STAGE_NAMES = {input: '入力', model: '認識', subs: '字幕'};
  function captionText() {
    const d = ui.data;
    if (!d) return '';
    const n = ui.cue + 1;
    const s = d.segments[ui.cue];
    const c = d.corrections.find((x) => x.id === s.id);
    const range = `推定 ${s.start.toFixed(2)}–${s.end.toFixed(2)}秒`;
    if (ui.stage === 'input') return `入力：実WAV ${d.audio.duration.toFixed(2)}秒の音量と、同じ前処理APIで求めたlog-Mel（実音声の特徴・表示用の平均）。`;
    if (ui.stage === 'model') return `認識：encoderが特徴を受け、decoderが文と時刻のtokenを出し、${d.segments.length}区間になる（モデル構造の図。内部の記録ではない）。`;
    if (ui.mode === 'raw') return c ? `字幕・原出力：${n}番「${c.excerpt.raw}」・${range}。writerがSRTに保存。` : `字幕・原出力：${n}番・${range}。writerがSRTに保存。`;
    return c ? `字幕・修正例：${n}番「${c.excerpt.raw}」→「${c.excerpt.edited}」。原稿を見て手で直し、時刻はそのまま。` : `字幕・修正例：${n}番は原出力のまま・${range}。`;
  }
  const updateCaption = () => { els.caption.textContent = captionText(); };

  function setStage(stage) {
    if (!ui.data || stage === ui.stage) return;
    ui.stage = stage;
    for (const b of els.stages) b.setAttribute('aria-pressed', String(b.dataset.stage === stage));
    updateCaption();
    startAnim('stage');
  }
  for (const b of els.stages) b.addEventListener('click', () => setStage(b.dataset.stage));
  els.replay.addEventListener('click', () => { if (ui.data) startAnim('replay'); });

  // ----- 主操作：照合済みの実SRT -----
  function updateSave() {
    const file = SRT_FILES[ui.mode];
    if (!ui.data) {
      els.save.removeAttribute('href');
      els.save.removeAttribute('download');
      els.save.setAttribute('aria-disabled', 'true');
      els.saveMeta.textContent = '';
      els.desk.removeAttribute('href');
      els.desk.setAttribute('aria-disabled', 'true');
      return;
    }
    els.save.href = file.path;
    els.save.download = file.download;
    els.save.removeAttribute('aria-disabled');
    els.save.textContent = ui.mode === 'raw' ? '原出力SRTを保存' : '修正例SRTを保存';
    els.saveMeta.textContent = `${file.path}・${file.bytes} B・SHA-256照合済み`;
    els.desk.href = 'desk.html';
    els.desk.removeAttribute('aria-disabled');
  }

  function setMode(mode) {
    if (!ui.data || mode === ui.mode) return;
    ui.mode = mode;
    for (const b of els.modes) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    els.readout.dataset.mode = mode;
    updateSave();
    updateCaption();
    startAnim('mode');
  }
  for (const b of els.modes) b.addEventListener('click', () => setMode(b.dataset.mode));

  // ----- 区間を選ぶ・実入力の位置を移す（自動では再生しない） -----
  function renderCues() {
    const d = ui.data;
    els.cueList.replaceChildren(...d.segments.map((s, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cue';
      b.dataset.cue = String(i);
      b.dataset.originalId = String(s.id);
      b.setAttribute('aria-pressed', String(i === ui.cue));
      const no = document.createElement('span');
      no.className = 'cue-no';
      no.textContent = String(i + 1);
      const time = document.createElement('span');
      time.className = 'cue-time';
      time.textContent = `${s.start.toFixed(2)}–${s.end.toFixed(2)}秒`;
      const flag = document.createElement('span');
      flag.className = 'cue-flag';
      flag.textContent = d.changedIds.includes(s.id) ? '修正例あり' : '原出力のまま';
      b.append(no, time, flag);
      b.addEventListener('click', () => selectCue(i, true));
      li.append(b);
      return li;
    }));
  }

  function renderCue() {
    const d = ui.data;
    const s = d.segments[ui.cue];
    const e = d.edited[ui.cue];
    const c = d.corrections.find((x) => x.id === s.id);
    els.cueNo.textContent = `${ui.cue + 1}番`;
    els.cueRange.textContent = `推定 ${s.start.toFixed(2)}–${s.end.toFixed(2)}秒`;
    els.cueMeta.textContent = `元のid ${s.id}`;
    els.cueRaw.textContent = s.text;
    els.cueEdited.textContent = e.text;
    els.cueBasis.textContent = c ? `修正の根拠：${c.basis}` : '原稿と見比べても変えていません。文も時刻も原出力のままです。';
    for (const b of els.cueList.querySelectorAll('button')) b.setAttribute('aria-pressed', String(Number(b.dataset.cue) === ui.cue));
  }

  function selectCue(i, seek) {
    if (!ui.data) return;
    ui.cue = i;
    renderCue();
    updateCaption();
    draw();
    if (seek) seekAudio(ui.data.segments[i].start);
  }

  els.canvas.addEventListener('click', (ev) => {
    const L = ui.layout;
    if (!ui.data || !L) return;
    const box = els.canvas.getBoundingClientRect();
    const x = (ev.clientX - box.left) * (L.W / box.width);
    const y = (ev.clientY - box.top) * (L.H / box.height);
    const i = L.cards.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y - 8 && y <= r.y + r.h + 8);
    if (i >= 0) selectCue(i, true);
  });

  const setAudioStatus = (message) => { els.audioStatus.textContent = message; };
  function seekAudio(seconds) {
    const a = els.audio;
    if (!a.getAttribute('src')) return;
    if (!a.paused) a.pause();
    if (a.readyState >= HTMLMediaElement.HAVE_METADATA) {
      try {
        a.currentTime = seconds;
        setAudioStatus(`${ui.cue + 1}番の頭（${seconds.toFixed(2)}秒）へ移しました。再生は再生ボタンで。`);
      } catch {
        setAudioStatus('この音声では位置を動かせませんでした。');
      }
      return;
    }
    ui.pendingSeek = seconds;
    setAudioStatus(`音声の情報を読み込めたら ${seconds.toFixed(2)}秒へ移します。`);
    if (a.networkState === HTMLMediaElement.NETWORK_EMPTY || a.networkState === HTMLMediaElement.NETWORK_IDLE) a.load();
  }
  els.audio.addEventListener('loadedmetadata', () => {
    if (ui.pendingSeek === null) return;
    const target = ui.pendingSeek;
    ui.pendingSeek = null;
    try {
      els.audio.currentTime = target;
      setAudioStatus(`${ui.cue + 1}番の頭（${target.toFixed(2)}秒）へ移しました。再生は再生ボタンで。`);
    } catch {
      setAudioStatus('この音声では位置を動かせませんでした。');
    }
  });
  els.audio.addEventListener('error', () => {
    if (els.audio.getAttribute('src')) setAudioStatus('音声を読み込めませんでした。下の一覧のWAVから直接開けます。');
  });

  // ----- 6部品 -----
  function renderPart() {
    const part = ui.data.parts.find((x) => x.id === ui.part);
    for (const b of els.parts) b.setAttribute('aria-pressed', String(b.dataset.part === ui.part));
    els.partLabel.textContent = part.label;
    els.partMeaning.textContent = part.meaning;
    els.partQuote.textContent = part.quote;
    const local = document.createElement('a');
    local.href = part.path;
    local.textContent = `${part.path}・${part.line}行目`;
    const nodes = [local];
    if (part.upstream) {
      const up = document.createElement('a');
      up.href = part.upstream;
      up.textContent = '固定版をGitHubで開く';
      up.rel = 'noopener';
      nodes.push(document.createTextNode(' ／ '), up);
    }
    els.partSource.replaceChildren(...nodes);
  }
  for (const b of els.parts) b.addEventListener('click', () => { if (ui.data) { ui.part = b.dataset.part; renderPart(); } });

  function renderCall() {
    const e = ui.data.engine;
    els.call.textContent = [
      `torch.set_num_threads(${e.threads})`,
      `model = whisper.load_model("${e.model}", device="${e.device}")`,
      `model.transcribe(audio, language="${e.language}", task="${e.task}", fp16=False, temperature=${e.temperature}, condition_on_previous_text=False)`,
      'whisper.utils.get_writer("all", out_dir)  # json・jsonl・txt・srt・vtt・tsv',
    ].join('\n');
  }

  // ----- 依頼文のコピー -----
  els.copy.addEventListener('click', async () => {
    const text = els.request.value;
    if (!text) return;
    els.copyStatus.textContent = '';
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        els.copyStatus.textContent = '依頼文をコピーしました。';
        return;
      } catch { /* 下の方法へ */ }
    }
    els.request.focus();
    els.request.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    els.copyStatus.textContent = ok ? '依頼文をコピーしました。' : 'コピーできませんでした。選択した依頼文を長押ししてコピーしてください。';
  });

  // ----- 読み込み・失敗・再試行 -----
  const controls = () => [...els.stages, els.replay, ...els.modes, ...els.parts, els.copy];
  function clearAll() {
    ui.data = null;
    ui.layout = null;
    ui.anim = null;
    ui.from = null;
    cancelAnimationFrame(ui.raf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    els.canvas.width = 0;
    els.canvas.height = 0;
    els.canvas.style.height = '';
    els.caption.textContent = '';
    els.cueList.replaceChildren();
    for (const node of [els.cueNo, els.cueRange, els.cueMeta, els.cueRaw, els.cueEdited, els.cueBasis, els.partLabel, els.partMeaning, els.partQuote, els.call, els.copyStatus, els.audioStatus]) node.textContent = '';
    els.partSource.replaceChildren();
    els.request.value = '';
    ui.pendingSeek = null;
    els.audio.pause();
    els.audio.removeAttribute('src');
    try { els.audio.load(); } catch { /* 空にするだけ */ }
    for (const c of controls()) c.disabled = true;
    updateSave();
  }

  function setState(state, message) {
    root.dataset.state = state;
    els.status.textContent = message;
    els.status.classList.toggle('is-error', state === 'error');
    els.retry.hidden = state !== 'error';
  }

  async function load() {
    ui.controller?.abort();
    const controller = new AbortController();
    ui.controller = controller;
    clearAll();
    setState('loading', `実記録${ASSET_COUNT}件を照合しています…`);
    try {
      const data = await loadValidatedAssets({
        signal: controller.signal,
        onProgress: (n, total) => { if (ui.controller === controller && root.dataset.state === 'loading') els.status.textContent = `実記録を照合しています（${n}/${total}）…`; },
      });
      if (ui.controller !== controller) return;
      ui.data = data;
      for (const c of controls()) c.disabled = false;
      els.audio.src = data.audio.path;
      els.request.value = data.request;
      els.readout.dataset.mode = ui.mode;
      renderCues();
      renderCue();
      renderPart();
      renderCall();
      updateSave();
      updateCaption();
      setState('ready', `実記録${data.assetCount}/${ASSET_COUNT}件をSHA-256で照合済み。この図は保存済みの1回の実行を描いたもので、ブラウザーではWhisperを動かしません。`);
      relayout();
      startAnim('stage');
    } catch (error) {
      if (ui.controller !== controller || error?.name === 'AbortError') return;
      clearAll();
      setState('error', `読み込めませんでした：${error?.message || '不明な理由'}。古い表示は消しました。`);
    }
  }
  els.retry.addEventListener('click', load);
  load();
}

if (typeof document !== 'undefined' && document.documentElement.dataset.page === 'whisper-concept') bootPage();
