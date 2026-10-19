// Chatterbox 作例の構造図：共有ローダー・検証・描画と、構造図ページの初期化。
// 保存済みの26ファイルを大きさとSHA-256で確かめて読むだけ。音声合成・推論・AIはこのページでは動かない。
// 編集用の動画ソース（video/video.js）も同じファイルを import する。ページの初期化は
// <html data-concept-page="main"> のときだけ動く。

export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = 'f145d0fc9e56ba1b0a8bf525a7c8a06b88e1ca682bc232ddc98eb2a9cc3df664';
export const ASSET_COUNT = 26;
export const JOB_IDS = ['default', 'expressive', 'second'];
export const PART_IDS = ['entry', 'text', 'condition', 't3', 's3gen', 'perth'];
export const STAGES = [
  {id: 0, label: 'これは何か'},
  {id: 1, label: '何を渡すか'},
  {id: 2, label: '何が返るか'}
];
export const FILM = {duration: 32, fps: 30, width: 720, height: 1280, posterTime: 31};
export const FILM_SCENES = [
  {id: 'tool', at: 0, label: '手元のPython音声合成'},
  {id: 'handoff', at: 4, label: '作者と制作担当'},
  {id: 'split', at: 8, label: '文字IDと条件'},
  {id: 't3', at: 13, label: 'T3の音声ID'},
  {id: 'wave', at: 18.5, label: '波形と透かし'},
  {id: 'files', at: 23.5, label: '実際の3つのWAV'},
  {id: 'whole', at: 28.5, label: '全体図'}
];

const ROOT = new URL('./', import.meta.url);
const SOURCE_REPO = 'resemble-ai/chatterbox';
const SOURCE_COMMIT = '5de7a54aa4e5e2baadb0182dde554908b48b85c2';
const MODEL_REVISION = '5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18';
const PERTH_REPO = 'resemble-ai/Perth';
const PERTH_COMMIT = 'ff1c8ac55a976971245cdd53c18d6131ca00d993';
const SEED = 20261019;
const SAMPLE_RATE = 24000;
const START_TEXT = 255;
const STOP_TEXT = 0;
const SPEECH_VOCAB = 6561;
const STOP_SPEECH = 6562;
const BINS = 240;
const CHECKPOINT_TOTAL = 3191966992;

const TEXT_HOME = 'Please keep the back door closed while the heater is running. The spare keys are in the blue drawer by the sink.';
const TEXT_TRAIN = 'Your train leaves from platform four at nine fifteen. Bring a printed ticket and arrive ten minutes early.';
const BASE_SETTINGS = {exaggeration: 0.5, cfg_weight: 0.5, temperature: 0.8, repetition_penalty: 1.2, min_p: 0.05, top_p: 1.0, audio_prompt_path: null};

// 保護された実出力の値。保存データがこれと1つでも違えば、図も音声も出さない。
const EXPECTED = {
  default: {
    text: TEXT_HOME, settings: BASE_SETTINGS, words: 22,
    file: 'outputs/attempt-01/audio/default.wav', bytes: 222764,
    sha256: 'b750fdbc8e1a609954a5d7f0d5bd072ec3fa9116c1f91cf7fa8b19053b2fba52',
    frames: 111360, seconds: 4.64, textIds: 73, raw: 117, speech: 116, peak: 31513, saturation: 0, asrLiteral: true
  },
  expressive: {
    text: TEXT_HOME, settings: {...BASE_SETTINGS, exaggeration: 0.8, cfg_weight: 0.3}, words: 22,
    file: 'outputs/attempt-01/audio/expressive.wav', bytes: 201644,
    sha256: 'a60cfaf5e609bbbc823efa5bc2f646f1d1a8901a7a4661aeebb669bac53e25fe',
    frames: 100800, seconds: 4.2, textIds: 73, raw: 106, speech: 105, peak: 28897, saturation: 0, asrLiteral: true
  },
  second: {
    text: TEXT_TRAIN, settings: BASE_SETTINGS, words: 18,
    file: 'outputs/attempt-01/audio/second.wav', bytes: 247724,
    sha256: '80fd37b2eefd398d2e9c88ac812bc74b7028715fb26b5fd568eef3b24b363cdd',
    frames: 123840, seconds: 5.16, textIds: 68, raw: 130, speech: 129, peak: 32767, saturation: 1, asrLiteral: false
  }
};

const ASSET_PATHS = [
  'inputs/jobs.json',
  'outputs/attempt-01/results.json',
  'outputs/attempt-01/audio/default.wav',
  'outputs/attempt-01/audio/expressive.wav',
  'outputs/attempt-01/audio/second.wav',
  'concept/waveforms.json',
  'concept/facts.json',
  'run_example.py',
  'implementation.md',
  'vendor/pins.json',
  'vendor/model-card/README.md',
  'vendor/chatterbox/README.md',
  'vendor/chatterbox/LICENSE',
  'vendor/chatterbox/pyproject.toml',
  'vendor/chatterbox/src/chatterbox/tts.py',
  'vendor/chatterbox/src/chatterbox/models/t3/t3.py',
  'vendor/chatterbox/src/chatterbox/models/tokenizers/tokenizer.py',
  'vendor/chatterbox/src/chatterbox/models/s3tokenizer/__init__.py',
  'vendor/chatterbox/src/chatterbox/models/s3gen/s3gen.py',
  'vendor/perth/src/perth/perth_net/perth_net_implicit/perth_watermarker.py',
  'vendor/notices/CorentinJ__Real-Time-Voice-Cloning/LICENSE',
  'vendor/notices/FunAudioLLM__CosyVoice/LICENSE',
  'vendor/notices/jik876__hifi-gan/LICENSE',
  'vendor/notices/Perth/LICENSE',
  'vendor/notices/yl4579__HiFTNet/LICENSE',
  'outputs/asr-check.json'
];

// facts.json の6つの抜粋に加えて、同じ固定ソースから確かめる補足の行
const EXTRA_EXCERPTS = {
  entry: [{source: 'vendor/chatterbox/src/chatterbox/tts.py', line: 129, quote: "    def from_local(cls, ckpt_dir, device) -> 'ChatterboxTTS':"}],
  text: [{source: 'vendor/chatterbox/src/chatterbox/models/tokenizers/tokenizer.py', line: 39, quote: "        txt = txt.replace(' ', SPACE)"}],
  condition: [{source: 'vendor/chatterbox/src/chatterbox/tts.py', line: 182, quote: '    def prepare_conditionals(self, wav_fpath, exaggeration=0.5):'}],
  t3: [
    {source: 'vendor/chatterbox/src/chatterbox/models/t3/t3.py', line: 365, quote: '            # Check for EOS token.\n            if next_token.view(-1) == self.hp.stop_speech_token:'},
    {source: 'vendor/chatterbox/src/chatterbox/tts.py', line: 262, quote: '            speech_tokens = speech_tokens[speech_tokens < 6561]'},
    {source: 'vendor/chatterbox/src/chatterbox/models/s3tokenizer/__init__.py', line: 16, quote: 'def drop_invalid_tokens(x):\n    """Drop SoS and EoS"""'}
  ],
  s3gen: [{source: 'vendor/chatterbox/src/chatterbox/models/s3gen/s3gen.py', line: 234, quote: '    The decoder of S3Gen is a concat of token-to-mel (CFM) and a mel-to-waveform (HiFiGAN) modules.'}],
  perth: [{source: 'vendor/perth/src/perth/perth_net/perth_net_implicit/perth_watermarker.py', line: 33, quote: '    def apply_watermark(self, signal, sample_rate, **_):'}]
};

const SAFE_PATH = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

export class ConceptError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConceptError';
  }
}

function need(condition, message) {
  if (!condition) throw new ConceptError(message);
}

// ---- SHA-256（安全な文脈では Web Crypto、それ以外は同じ計算をJSで行う） ----

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));

function sha256Js(buffer) {
  const bytes = new Uint8Array(buffer);
  const length = bytes.length;
  const padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000));
  view.setUint32(padded.length - 4, (length * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
    for (let i = 0; i < 64; i += 1) {
      const t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + k) >>> 0;
  }
  return Array.from(h, word => word.toString(16).padStart(8, '0')).join('');
}

export async function sha256Hex(buffer) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (subtle && typeof subtle.digest === 'function') {
    try {
      const digest = new Uint8Array(await subtle.digest('SHA-256', buffer));
      return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      // Web Crypto が使えない環境では下の計算に切り替える
    }
  }
  return sha256Js(buffer);
}

// ---- 読み込み ----

const utf8 = new TextDecoder('utf-8', {fatal: true});

function decodeText(entry) {
  try {
    return utf8.decode(entry.buffer);
  } catch (_) {
    throw new ConceptError(`${entry.path} をUTF-8の文字として読めません`);
  }
}

function parseJson(entry) {
  try {
    return JSON.parse(decodeText(entry));
  } catch (error) {
    if (error instanceof ConceptError) throw error;
    throw new ConceptError(`${entry.path} をJSONとして読めません`);
  }
}

async function fetchBuffer(path, signal) {
  let response;
  try {
    response = await fetch(new URL(path, ROOT), {cache: 'no-store', credentials: 'same-origin', signal});
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    throw new ConceptError(`${path} を読み込めません（作例フォルダー全体をローカルのWebサーバーで開いてください）`);
  }
  if (!response.ok) throw new ConceptError(`${path} を読み込めません（HTTP ${response.status}）`);
  return response.arrayBuffer();
}

function checkManifest(manifest) {
  need(manifest && manifest.schema === 'studio-yebisu/chatterbox/fixed-assets@1', 'concept/manifest.json の形式が違います');
  need(Array.isArray(manifest.assets) && manifest.assets.length === ASSET_COUNT,
    `concept/manifest.json のファイル数が${ASSET_COUNT}件ではありません`);
  const seen = new Set();
  const entries = manifest.assets.map((file, index) => {
    need(file && typeof file.path === 'string' && SAFE_PATH.test(file.path),
      `concept/manifest.json の${index + 1}件目のパスが不正です`);
    need(!seen.has(file.path), `concept/manifest.json に同じパスが2回あります：${file.path}`);
    seen.add(file.path);
    need(Number.isInteger(file.bytes) && file.bytes > 0, `${file.path} の記録上の大きさが不正です`);
    need(typeof file.sha256 === 'string' && /^[0-9a-f]{64}$/.test(file.sha256), `${file.path} の記録上のSHA-256が不正です`);
    return {path: file.path, bytes: file.bytes, sha256: file.sha256};
  });
  ASSET_PATHS.forEach(path => need(seen.has(path), `concept/manifest.json に ${path} がありません`));
  return entries;
}

/**
 * manifest の SHA-256 を確かめ、26ファイルすべての大きさと SHA-256 を確かめてから、
 * 中身の形と保護された値（3件の文・設定・ID数・WAV）を照合する。1つでも違えば ConceptError。
 */
export async function loadConcept({onProgress, signal} = {}) {
  const controller = new AbortController();
  const relay = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', relay, {once: true});
  }
  let failed = false;
  const report = (done, total) => {
    if (!failed && !controller.signal.aborted && typeof onProgress === 'function') onProgress(done, total);
  };
  try {
    const manifestBuffer = await fetchBuffer(MANIFEST_PATH, controller.signal);
    need(await sha256Hex(manifestBuffer) === MANIFEST_SHA256, 'concept/manifest.json の内容が記録と一致しません（SHA-256 が違います）');
    const manifest = parseJson({path: MANIFEST_PATH, buffer: manifestBuffer});
    const entries = checkManifest(manifest);
    const files = new Map();
    let done = 0;
    report(0, entries.length);
    await Promise.all(entries.map(async entry => {
      const buffer = await fetchBuffer(entry.path, controller.signal);
      need(buffer.byteLength === entry.bytes,
        `${entry.path} の大きさが記録と違います（${buffer.byteLength}バイト／記録 ${entry.bytes}バイト）`);
      need(await sha256Hex(buffer) === entry.sha256, `${entry.path} の内容が記録と一致しません（SHA-256 が違います）`);
      files.set(entry.path, {path: entry.path, bytes: entry.bytes, sha256: entry.sha256, buffer});
      done += 1;
      report(done, entries.length);
    }));
    if (controller.signal.aborted) throw new ConceptError('読み込みを中止しました');
    return buildModel(entries, files);
  } catch (error) {
    failed = true;
    controller.abort();
    if (error instanceof ConceptError) throw error;
    if (error && error.name === 'AbortError') throw new ConceptError('読み込みを中止しました');
    throw new ConceptError('保存データの確認中に問題が起きました：' + (error && error.message ? error.message : String(error)));
  } finally {
    if (signal) signal.removeEventListener('abort', relay);
  }
}

// ---- 中身の検証（保存データどうしの突き合わせだけ。音声合成やASRは動かさない） ----

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((value, i) => deepEqual(value, b[i]));
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
}

const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const allTrue = record => record && typeof record === 'object' && Object.keys(record).length > 0 && Object.values(record).every(v => v === true);
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

function checkQuote(textOf, source, line, quote, label) {
  need(typeof source === 'string' && ASSET_PATHS.includes(source), `${label}：引用元 ${source} が検証済みファイルにありません`);
  need(Number.isInteger(line) && line > 0 && typeof quote === 'string' && quote.length > 0, `${label}：引用の行か文が不正です`);
  const lines = textOf(source).split('\n');
  const want = quote.split('\n');
  const got = lines.slice(line - 1, line - 1 + want.length).join('\n');
  need(got === quote, `${label}：${source} の${line}行目からの引用が原文と一致しません`);
}

function parseWav(entry) {
  const view = new DataView(entry.buffer);
  const tag = offset => String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
  need(view.byteLength >= 44 && tag(0) === 'RIFF' && tag(8) === 'WAVE', `${entry.path} が WAV ではありません`);
  let fmt = null;
  let data = null;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    need(body + size <= view.byteLength, `${entry.path} のチャンクが途中で切れています`);
    if (id === 'fmt ') {
      need(size >= 16, `${entry.path} の fmt チャンクが短すぎます`);
      fmt = {
        format: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true)
      };
      if (fmt.format === 0xfffe && size >= 26) fmt.format = view.getUint16(body + 24, true);
    } else if (id === 'data') {
      data = {offset: body, size};
    }
    offset = body + size + (size & 1);
  }
  need(fmt && fmt.format === 1 && fmt.channels === 1 && fmt.rate === SAMPLE_RATE && fmt.bits === 16,
    `${entry.path} が PCM16・モノラル・24000Hz ではありません`);
  need(data && data.size % 2 === 0, `${entry.path} に音声データがありません`);
  const frames = data.size / 2;
  const samples = new Int16Array(frames);
  for (let i = 0; i < frames; i += 1) samples[i] = view.getInt16(data.offset + i * 2, true);
  return {frames, samples};
}

function checkEnvelope(id, samples, bins) {
  const n = samples.length;
  need(Array.isArray(bins) && bins.length === BINS, `${id} の波形の包絡が${BINS}区間ではありません`);
  const min = new Float64Array(BINS);
  const max = new Float64Array(BINS);
  const rms = new Float64Array(BINS);
  for (let i = 0; i < BINS; i += 1) {
    const start = Math.floor(i * n / BINS);
    const end = Math.floor((i + 1) * n / BINS);
    const bin = bins[i];
    need(isObject(bin) && bin.frame_start === start && bin.frame_end_exclusive === end, `${id} の包絡の${i + 1}区間目の範囲が違います`);
    let lo = Infinity;
    let hi = -Infinity;
    let sum = 0;
    for (let j = start; j < end; j += 1) {
      const v = samples[j];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      sum += v * v;
    }
    const realMin = lo / 32768;
    const realMax = hi / 32768;
    const realRms = Math.sqrt(sum / (end - start)) / 32768;
    need(Math.abs(bin.min - realMin) < 1e-12 && Math.abs(bin.max - realMax) < 1e-12,
      `${id} の包絡の${i + 1}区間目の最小・最大が実際のWAVと違います`);
    need(Math.abs(bin.rms - realRms) <= 1e-7 + 1e-4 * realRms, `${id} の包絡の${i + 1}区間目のRMSが実際のWAVと違います`);
    min[i] = realMin;
    max[i] = realMax;
    rms[i] = realRms;
  }
  return {min, max, rms};
}

function buildModel(entries, files) {
  const get = path => {
    const entry = files.get(path);
    need(entry, `${path} が読み込まれていません`);
    return entry;
  };
  const texts = new Map();
  const textOf = path => {
    if (!texts.has(path)) texts.set(path, decodeText(get(path)));
    return texts.get(path);
  };

  // 入力（作者が書いた3件）
  const jobsDoc = parseJson(get('inputs/jobs.json'));
  need(jobsDoc.schema === 'studio-yebisu/chatterbox-example/jobs@1' && jobsDoc.language === 'en', 'inputs/jobs.json の形式が違います');
  need(Array.isArray(jobsDoc.jobs) && sameList(jobsDoc.jobs.map(job => job && job.id), JOB_IDS), 'inputs/jobs.json の3件の並びが違います');
  jobsDoc.jobs.forEach(job => {
    const want = EXPECTED[job.id];
    need(job.text === want.text, `inputs/jobs.json の ${job.id} の文が記録と違います`);
    need(job.seed === SEED && deepEqual(job.settings, want.settings), `inputs/jobs.json の ${job.id} の設定かseedが記録と違います`);
  });

  // 実行結果
  const results = parseJson(get('outputs/attempt-01/results.json'));
  need(results.schema === 'studio-yebisu/chatterbox-example/results@1' && results.status === 'passed',
    'outputs/attempt-01/results.json の状態が passed ではありません');
  const pins = results.pins || {};
  need(pins.source_repository === SOURCE_REPO && pins.source_commit === SOURCE_COMMIT && pins.source_version === '0.1.7' &&
    pins.model_revision === MODEL_REVISION && pins.perth_commit === PERTH_COMMIT, 'results.json の固定版が記録と違います');
  const run = results.run || {};
  need(run.generate_calls === 3 && run.device === 'cuda' && run.threads === 4 && sameList(run.job_order, JOB_IDS),
    'results.json の実行の記録（generate 3回・CUDA・4スレッド）が違います');
  need(allTrue(results.overall_checks), 'results.json の全体の確認が通っていません');
  const pair = results.paired_configuration_comparison || {};
  need(pair.base === 'default' && pair.variant === 'expressive' && allTrue(pair.checks) &&
    sameList(pair.changed && pair.changed.exaggeration, [0.5, 0.8]) && sameList(pair.changed && pair.changed.cfg_weight, [0.5, 0.3]),
    'results.json の対の比較の記録が違います');
  const observed = results.model_observed || {};
  need(observed.class === 'chatterbox.tts.ChatterboxTTS' && observed.sample_rate === SAMPLE_RATE &&
    observed.t3_start_text_token === START_TEXT && observed.t3_stop_text_token === STOP_TEXT &&
    observed.t3_start_speech_token === SPEECH_VOCAB && observed.t3_stop_speech_token === STOP_SPEECH,
    'results.json のモデルの記録が違います');
  need(/PerthImplicitWatermarker$/.test(observed.watermarker_class || ''), 'results.json の透かしのクラスが Perth ではありません');
  const conds = observed.builtin_conds_before_first_job;
  need(isObject(conds) && isObject(conds.t3) && isObject(conds.gen), 'results.json に組み込み条件の形の記録がありません');
  const env = results.environment || {};
  need(env.torch_num_threads === 4 && typeof env.cuda_device_name === 'string' && isObject(env.packages), 'results.json の環境の記録が違います');
  need(Array.isArray(results.checkpoint_files) && results.checkpoint_files.length === 5 &&
    results.checkpoint_files.reduce((sum, file) => sum + file.bytes, 0) === CHECKPOINT_TOTAL, 'results.json の重み5ファイルの記録が違います');
  need(Array.isArray(results.jobs) && sameList(results.jobs.map(job => job && job.id), JOB_IDS), 'results.json の3件の並びが違います');

  // 説明のための事実と、実WAVの包絡
  const facts = parseJson(get('concept/facts.json'));
  need(facts.schema === 'chatterbox-actual-facts@1', 'concept/facts.json の形式が違います');
  need(facts.source_pin && facts.source_pin.source_commit === SOURCE_COMMIT && facts.source_pin.model_revision === MODEL_REVISION &&
    facts.source_pin.perth_commit === PERTH_COMMIT, 'concept/facts.json の固定版が違います');
  const perthInstall = facts.perth_install || {};
  need(perthInstall.fixed_commit === PERTH_COMMIT && perthInstall.files === 22 && perthInstall.official_rawbytes === 3 &&
    perthInstall.crlf_only_normalized_content === 19, 'concept/facts.json の Perth 照合の記録が違います');
  need(Array.isArray(facts.actual_outputs) && sameList(facts.actual_outputs.map(item => item && item.id), JOB_IDS), 'concept/facts.json の出力の並びが違います');
  need(Array.isArray(facts.excerpts) && sameList(facts.excerpts.map(item => item && item.id), PART_IDS), 'concept/facts.json の6つの抜粋が違います');

  const waves = parseJson(get('concept/waveforms.json'));
  need(waves.schema === 'chatterbox-real-wav-envelopes@1' && Array.isArray(waves.jobs) && sameList(waves.jobs.map(job => job && job.id), JOB_IDS),
    'concept/waveforms.json の形式が違います');

  const asr = parseJson(get('outputs/asr-check.json'));
  need(asr.model === 'OpenAI Whisper base' && asr.parameters && asr.parameters.initial_prompt === null &&
    Array.isArray(asr.observations) && sameList(asr.observations.map(item => item && item.id), JOB_IDS),
    'outputs/asr-check.json の形式が違います');

  const jobs = {};
  JOB_IDS.forEach((id, index) => {
    const want = EXPECTED[id];
    const r = results.jobs[index];
    need(r.text === want.text && r.seed === SEED && deepEqual(r.settings, want.settings) && r.passed === true && allTrue(r.checks),
      `results.json の ${id} の入力か確認が記録と違います`);
    const st = r.stages_observed || {};
    const textTokens = st.text_tokens || {};
    const ids = textTokens.ids_row0_with_start_stop;
    need(Array.isArray(ids) && ids.length === want.textIds && sameList(textTokens.shape, [2, want.textIds]) &&
      ids[0] === START_TEXT && ids[ids.length - 1] === STOP_TEXT && textTokens.cfg_rows_identical === true,
      `results.json の ${id} の文字IDの記録が違います`);
    const t3 = st.t3_inference || {};
    const raw = t3.raw_speech_token_ids;
    need(t3.calls === 1 && Array.isArray(raw) && raw.length === want.raw && raw.indexOf(STOP_SPEECH) === want.raw - 1,
      `results.json の ${id} の T3 の音声IDの記録が違います`);
    const filter = st.filter || {};
    need(filter.raw_count === want.raw && filter.raw_first_stop_index === want.raw - 1 && filter.s3gen_input_count === want.speech &&
      filter.removed_count === want.raw - want.speech, `results.json の ${id} のID除去の記録が違います`);
    const s3 = st.s3gen_inference || {};
    const kept = raw.slice(0, want.raw - 1).filter(v => v < SPEECH_VOCAB);
    need(s3.calls === 1 && sameList(s3.input_speech_token_ids, kept) && kept.length === want.speech &&
      sameList(s3.output_shape, [1, want.frames]), `results.json の ${id} の S3Gen の記録が違います`);
    const wm = st.apply_watermark || {};
    const pre = wm.pre_watermark_audio_stats || {};
    const post = wm.watermarked_audio_stats || {};
    const back = r.returned_audio || {};
    need(wm.calls === 1 && wm.sample_rate === SAMPLE_RATE && pre.sha256 === s3.output_sha256 && post.sha256 === back.sha256 &&
      pre.sha256 !== post.sha256 && back.samples_abs_over_1 === want.saturation, `results.json の ${id} の透かしの記録が違います`);
    const wav = r.wav || {};
    need(wav.path === `audio/${id}.wav` && wav.bytes === want.bytes && wav.sha256 === want.sha256 && wav.frames === want.frames &&
      wav.duration_seconds === want.seconds && wav.sample_rate === SAMPLE_RATE && wav.channels === 1 && wav.subtype === 'PCM_16' &&
      wav.peak_abs_int16 === want.peak && wav.samples_at_int16_limit === want.saturation &&
      wav.returned_samples_clipped_by_encoding === want.saturation, `results.json の ${id} の WAV の記録が違います`);

    const fact = facts.actual_outputs[index];
    need(fact.file === want.file && fact.bytes === want.bytes && fact.sha256 === want.sha256 && fact.frames === want.frames &&
      fact.seconds === want.seconds && fact.speech_token_count === want.speech && fact.raw_t3_count === want.raw &&
      fact.raw_first_stop_index === want.raw - 1 && fact.peak_abs_int16 === want.peak && fact.pcm16_saturation_samples === want.saturation,
      `concept/facts.json の ${id} が記録と違います`);

    const fileEntry = get(want.file);
    need(fileEntry.sha256 === want.sha256 && fileEntry.bytes === want.bytes, `${want.file} が保護された記録と違います`);
    const pcm = parseWav(fileEntry);
    need(pcm.frames === want.frames, `${want.file} のフレーム数が記録と違います`);
    let peak = 0;
    let atLimit = 0;
    for (let i = 0; i < pcm.samples.length; i += 1) {
      const a = Math.abs(pcm.samples[i]);
      if (a > peak) peak = a;
      if (a >= 32767) atLimit += 1;
    }
    need(peak === want.peak && atLimit === want.saturation, `${want.file} のピークか上限の数が記録と違います`);

    const w = waves.jobs[index];
    need(w.source === want.file && w.source_sha256 === want.sha256 && w.sample_rate === SAMPLE_RATE && w.frames === want.frames &&
      w.duration_seconds === want.seconds, `concept/waveforms.json の ${id} が記録と違います`);
    const envelope = checkEnvelope(id, pcm.samples, w.bins);

    const heard = asr.observations[index];
    need(heard.input_wav_sha256 === want.sha256 && heard.literal_text_equal_after_outer_whitespace === want.asrLiteral &&
      typeof heard.recognition === 'string', `outputs/asr-check.json の ${id} が記録と違います`);

    const words = want.text.split(' ');
    need(words.length === want.words, `${id} の語数が記録と違います`);
    jobs[id] = {
      id,
      text: want.text,
      words: words.length,
      snippet: words.slice(0, 3).join(' ') + '…',
      seed: SEED,
      settings: {...want.settings},
      textIds: ids.length,
      raw: raw.length,
      speech: kept.length,
      file: want.file,
      bytes: want.bytes,
      sha256: want.sha256,
      frames: want.frames,
      seconds: want.seconds,
      sampleRate: SAMPLE_RATE,
      peak: want.peak,
      saturation: want.saturation,
      peakDbfs: wav.peak_dbfs,
      rmsDbfs: wav.rms_dbfs,
      returnedPeak: back.peak_abs,
      watermark: {calls: wm.calls, preSha: pre.sha256, postSha: post.sha256},
      envelope,
      asr: {text: heard.recognition.trim(), literal: heard.literal_text_equal_after_outer_whitespace},
      buffer: fileEntry.buffer
    };
  });

  const parts = {};
  PART_IDS.forEach((id, index) => {
    const item = facts.excerpts[index];
    need(typeof item.label === 'string' && item.label.length > 0, `concept/facts.json の ${id} の名前がありません`);
    checkQuote(textOf, item.source, item.line, item.quote, item.label);
    EXTRA_EXCERPTS[id].forEach(extra => checkQuote(textOf, extra.source, extra.line, extra.quote, item.label));
    parts[id] = {id, label: item.label, source: item.source, line: item.line, quote: item.quote, extras: EXTRA_EXCERPTS[id]};
  });

  const shape = value => (Array.isArray(value) ? value.join('×') : '—');
  return {
    jobs,
    order: JOB_IDS.slice(),
    parts,
    maxSeconds: Math.max(...JOB_IDS.map(id => jobs[id].seconds)),
    assets: entries.map(entry => ({...entry})),
    manifestSha256: MANIFEST_SHA256,
    pins: {
      sourceRepository: SOURCE_REPO, sourceCommit: SOURCE_COMMIT, sourceVersion: pins.source_version,
      modelRepository: pins.model_repository, modelRevision: MODEL_REVISION, perthRepository: PERTH_REPO, perthCommit: PERTH_COMMIT
    },
    env: {
      gpu: env.cuda_device_name,
      gpuShort: env.cuda_device_name.replace(/^NVIDIA\s+(GeForce\s+)?/, ''),
      threads: env.torch_num_threads,
      python: env.python,
      torch: env.packages.torch,
      torchaudio: env.packages.torchaudio,
      chatterbox: env.packages['chatterbox-tts'],
      perth: env.packages['resemble-perth'],
      os: env.os
    },
    conds: {
      speaker: shape(conds.t3.speaker_emb_shape),
      prompt: shape(conds.t3.cond_prompt_speech_tokens_shape),
      emotion: conds.t3.emotion_adv,
      genToken: shape(conds.gen.prompt_token),
      genFeat: shape(conds.gen.prompt_feat),
      genEmbed: shape(conds.gen.embedding)
    },
    checkpoints: {count: results.checkpoint_files.length, bytes: CHECKPOINT_TOTAL},
    perthInstall: {files: perthInstall.files, raw: perthInstall.official_rawbytes, crlf: perthInstall.crlf_only_normalized_content},
    asrModel: asr.model
  };
}

// ---- 図の配置（単位はレイアウトの座標。描くときに画面の大きさへ拡大する） ----

const R = (x, y, w, h) => ({x, y, w, h});
const edge = (from, to, pts, kind = 'main') => ({from, to, pts, kind});

function phoneLayout() {
  const nodes = {
    author: R(4, 4, 74, 40), script: R(90, 4, 112, 40), operator: R(214, 4, 82, 40),
    frame: R(4, 56, 292, 314), header: R(4, 56, 292, 30),
    input: R(22, 96, 164, 58), tokens: R(22, 166, 164, 40), t3: R(22, 218, 164, 50),
    s3gen: R(22, 280, 164, 40), perth: R(22, 332, 164, 30), cond: R(198, 96, 90, 58),
    default: R(4, 384, 94, 72), expressive: R(103, 384, 94, 72), second: R(202, 384, 94, 72),
    use: R(4, 462, 292, 18)
  };
  const cx = {default: 51, expressive: 150, second: 249};
  const edges = {
    a_s: edge('author', 'script', [[78, 24], [90, 24]]),
    s_o: edge('script', 'operator', [[202, 24], [214, 24]]),
    o_h: edge('operator', 'header', [[255, 44], [255, 56]]),
    h_i: edge('header', 'input', [[104, 86], [104, 96]]),
    i_tok: edge('input', 'tokens', [[104, 154], [104, 166]]),
    tok_t3: edge('tokens', 't3', [[104, 206], [104, 218]]),
    set: edge('input', 't3', [[22, 140], [12, 140], [12, 243], [22, 243]], 'set'),
    c_t3: edge('cond', 't3', [[243, 154], [243, 243], [186, 243]], 'cond'),
    c_s3: edge('cond', 's3gen', [[243, 154], [243, 300], [186, 300]], 'cond'),
    t3_s3: edge('t3', 's3gen', [[104, 268], [104, 280]]),
    s3_p: edge('s3gen', 'perth', [[104, 320], [104, 332]])
  };
  const paths = {
    handoff: [[41, 24], [146, 24], [255, 24], [255, 71]],
    text: [[104, 125], [104, 186], [104, 243]],
    set: [[22, 140], [12, 140], [12, 243], [104, 243]],
    cond_t3: [[243, 125], [243, 243], [104, 243]],
    cond_s3: [[243, 125], [243, 300], [104, 300]],
    speech: [[104, 243], [104, 300]]
  };
  JOB_IDS.forEach(id => {
    edges['p_' + id] = edge('perth', id, [[104, 362], [104, 374], [cx[id], 374], [cx[id], 384]]);
    paths['wave_' + id] = [[104, 300], [104, 347], [104, 374], [cx[id], 374], [cx[id], 420]];
  });
  return {name: 'phone', W: 300, H: 482, nodes, edges, paths, compact: true};
}

function shiftLayout(layout, name, dy, H, extraNodes) {
  const moveR = r => R(r.x, r.y + dy, r.w, r.h);
  const movePts = pts => pts.map(([x, y]) => [x, y + dy]);
  const nodes = {};
  Object.entries(layout.nodes).forEach(([key, r]) => { nodes[key] = moveR(r); });
  Object.assign(nodes, extraNodes);
  const edges = {};
  Object.entries(layout.edges).forEach(([key, e]) => { edges[key] = {...e, pts: movePts(e.pts)}; });
  const paths = {};
  Object.entries(layout.paths).forEach(([key, pts]) => { paths[key] = movePts(pts); });
  return {...layout, name, H, nodes, edges, paths};
}

function wideLayout() {
  const nodes = {
    author: R(16, 8, 80, 40), script: R(112, 8, 120, 40), operator: R(248, 8, 92, 40), caption: R(356, 8, 276, 40),
    frame: R(8, 60, 624, 190), header: R(8, 60, 624, 28),
    input: R(20, 108, 128, 58), tokens: R(160, 108, 92, 58), t3: R(264, 108, 104, 58),
    s3gen: R(384, 108, 104, 58), perth: R(504, 108, 112, 58), cond: R(264, 190, 224, 48),
    default: R(20, 266, 150, 86), expressive: R(182, 266, 150, 86), second: R(344, 266, 150, 86),
    use: R(506, 266, 126, 86)
  };
  const cx = {default: 95, expressive: 257, second: 419};
  const edges = {
    a_s: edge('author', 'script', [[96, 28], [112, 28]]),
    s_o: edge('script', 'operator', [[232, 28], [248, 28]]),
    o_h: edge('operator', 'header', [[294, 48], [294, 60]]),
    h_i: edge('header', 'input', [[84, 88], [84, 108]]),
    i_tok: edge('input', 'tokens', [[148, 137], [160, 137]]),
    tok_t3: edge('tokens', 't3', [[252, 137], [264, 137]]),
    set: edge('input', 't3', [[120, 108], [120, 98], [316, 98], [316, 108]], 'set'),
    c_t3: edge('cond', 't3', [[316, 190], [316, 166]], 'cond'),
    c_s3: edge('cond', 's3gen', [[436, 190], [436, 166]], 'cond'),
    t3_s3: edge('t3', 's3gen', [[368, 137], [384, 137]]),
    s3_p: edge('s3gen', 'perth', [[488, 137], [504, 137]]),
    w_use: edge('use', 'use', [[494, 309], [506, 309]])
  };
  const paths = {
    handoff: [[56, 28], [172, 28], [294, 28], [294, 74]],
    text: [[84, 137], [206, 137], [316, 137]],
    set: [[120, 108], [120, 98], [316, 98], [316, 137]],
    cond_t3: [[376, 214], [316, 214], [316, 137]],
    cond_s3: [[376, 214], [436, 214], [436, 137]],
    speech: [[316, 137], [436, 137]]
  };
  JOB_IDS.forEach(id => {
    edges['p_' + id] = edge('perth', id, [[560, 166], [560, 258], [cx[id], 258], [cx[id], 266]]);
    paths['wave_' + id] = [[436, 137], [560, 137], [560, 258], [cx[id], 258], [cx[id], 309]];
  });
  return {name: 'wide', W: 640, H: 360, nodes, edges, paths, compact: false};
}

const PHONE = phoneLayout();
export const LAYOUTS = {
  phone: PHONE,
  portrait: shiftLayout(PHONE, 'portrait', 46, 533, {caption: R(4, 4, 292, 38)}),
  wide: wideLayout()
};
export const PAGE_WIDE_MIN = 700;

export function layoutFor(width, height, film = false) {
  if (film) return width > height ? LAYOUTS.wide : LAYOUTS.portrait;
  return width >= PAGE_WIDE_MIN ? LAYOUTS.wide : LAYOUTS.phone;
}

const PART_NODES = {entry: ['header'], text: ['input', 'tokens'], condition: ['cond'], t3: ['t3'], s3gen: ['s3gen'], perth: ['perth']};
const NODE_PART = {header: 'entry', input: 'text', tokens: 'text', cond: 'condition', t3: 't3', s3gen: 's3gen', perth: 'perth'};

/** ページの図で、押された位置にある部品か出力を返す（CSS px の座標）。 */
export function hitTest(width, height, x, y) {
  const layout = layoutFor(width, height, false);
  const s = Math.min(width / layout.W, height / layout.H);
  const ox = (width - layout.W * s) / 2;
  const oy = (height - layout.H * s) / 2;
  const ux = (x - ox) / s;
  const uy = (y - oy) / s;
  const inside = r => ux >= r.x && ux <= r.x + r.w && uy >= r.y && uy <= r.y + r.h;
  for (const id of JOB_IDS) if (inside(layout.nodes[id])) return {job: id};
  for (const key of Object.keys(NODE_PART)) if (inside(layout.nodes[key])) return {part: NODE_PART[key]};
  return null;
}

// ---- 時刻と段階から、描く状態を決める（閉形式。前の状態を持たない） ----

const clamp = (value, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, value));
const lin = (a, b, t) => clamp((t - a) / (b - a));
const smooth = (a, b, t) => {
  const x = lin(a, b, t);
  return x * x * (3 - 2 * x);
};
const pulse = (a, b, c, d, t) => smooth(a, b, t) * (1 - smooth(c, d, t));
const easeUnit = x => {
  const v = clamp(x);
  return v * v * (3 - 2 * v);
};
const fadeEnds = p => clamp(Math.min(p / 0.1, (1 - p) / 0.1));

const NODE_KEYS = ['author', 'script', 'operator', 'header', 'input', 'tokens', 'cond', 't3', 's3gen', 'perth', 'default', 'expressive', 'second', 'use'];

function filled(value) {
  const out = {};
  NODE_KEYS.forEach(key => { out[key] = value; });
  return out;
}

const STAGE_EMPH = [
  {author: 1, script: 1, operator: 1, header: 1, input: 0.35, tokens: 0.35, cond: 0.35, t3: 0.35, s3gen: 0.35, perth: 0.35},
  {input: 1, tokens: 1, cond: 1, t3: 1},
  {t3: 1, s3gen: 1, perth: 1, use: 1}
];
const STAGE_EDGES = [
  {a_s: 1, s_o: 1, o_h: 1, h_i: 0.6},
  {h_i: 0.6, i_tok: 1, tok_t3: 1, set: 1, c_t3: 1, c_s3: 1},
  {t3_s3: 1, s3_p: 1, w_use: 1}
];

function stageEmph(stage, job) {
  const emph = {...filled(0), ...STAGE_EMPH[stage]};
  if (stage === 2) emph[job] = 1;
  const edges = {...STAGE_EDGES[stage]};
  if (stage === 2) edges['p_' + job] = 1;
  return {emph, edges};
}

function mixMaps(a, b, k) {
  const out = {};
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(key => {
    out[key] = (a[key] || 0) * (1 - k) + (b[key] || 0) * k;
  });
  return out;
}

function stageFlows(stage, job, phase, alpha, still) {
  const flows = [];
  const add = (path, kind, count, offset = 0) => {
    for (let i = 0; i < count; i += 1) {
      const p = still ? (0.55 + i / count) % 1 : (phase + offset + i / count) % 1;
      flows.push({path, kind, p, alpha: alpha * (still ? 1 : fadeEnds(p)), job});
    }
  };
  if (stage === 0) add('handoff', 'paper', 2);
  if (stage === 1) {
    add('text', 'chars', 4);
    add('cond_t3', 'cond', 2);
    add('cond_s3', 'cond', 2, 0.25);
    add('set', 'set', 1, 0.5);
  }
  if (stage === 2) {
    add('speech', 'speech', 4);
    add('wave_' + job, 'chip', 1, 0.3);
  }
  return flows;
}

/**
 * 構造図ページの状態。stage は図の段階（0〜2）で、推論のやり直しではない。
 * phase は動く印の位置（0〜1）。still が真なら動く印を固定の位置に置く。
 */
export function pageScene({stage = 0, job = 'default', part = null, phase = 0, prevStage = null, mix = 1, still = false} = {}) {
  const k = prevStage == null ? 1 : easeUnit(mix);
  const target = stageEmph(stage, job);
  const from = prevStage == null ? target : stageEmph(prevStage, job);
  const jobFocus = {default: 0, expressive: 0, second: 0, [job]: 1};
  return {
    film: false,
    job,
    part,
    appear: filled(1),
    emph: mixMaps(from.emph, target.emph, k),
    edgeEmph: mixMaps(from.edges, target.edges, k),
    flows: stageFlows(stage, job, phase, k, still),
    textShown: null,
    speechShown: null,
    stopGone: 1,
    reveal: {default: 1, expressive: 1, second: 1},
    numbers: {default: 1, expressive: 1, second: 1},
    jobFocus,
    headerAlt: 0,
    useAlt: 0,
    caption: null
  };
}

export function sceneIndexAt(seconds) {
  let index = 0;
  FILM_SCENES.forEach((scene, i) => { if (seconds >= scene.at) index = i; });
  return index;
}

const CAPTIONS = [
  {title: '① 手元で動くPythonの音声合成', tag: () => '原典 resemble-ai/chatterbox・5de7a54・v0.1.7'},
  {title: '② 作者が書き、制作担当が実行', tag: model => `from_local 1回 → generate 3回（${model ? model.env.gpuShort : 'GPU'}）`},
  {title: '③ 英文はIDに、条件は2方向へ', tag: () => '組み込み条件のみ・別の参照音声は渡さない'},
  {title: '④ T3が音声IDを1つずつ', tag: () => '停止ID 6562 で止まり、除いてから次へ'},
  {title: '⑤ 波形にして、透かしを1回', tag: () => 'メル→波形の段は原典に基づく説明図'},
  {title: '⑥ 実際に返った3つのWAV', tag: () => 'PCM16・24kHz・モノラル／実WAVの振幅の包絡'},
  {title: '⑦ 渡す → 変わる → 返る', tag: () => '構造の図解（無音）・数値は保存データから'}
];

/** 動画の t 秒の状態。前の時刻や呼んだ順番に左右されない。 */
export function sceneAt(seconds) {
  const t = clamp(Number(seconds) || 0, 0, FILM.duration);
  const index = sceneIndexAt(t);
  const end = smooth(28.6, 29.4, t);
  const s = (a, b) => smooth(a, b, t);
  const p4 = (a, b, c, d) => pulse(a, b, c, d, t);

  const appear = {
    header: s(0.1, 0.8), input: s(0.6, 1.2), tokens: s(0.8, 1.4), cond: s(1.0, 1.6), t3: s(1.2, 1.8),
    s3gen: s(1.4, 2.0), perth: s(1.6, 2.2), default: s(1.8, 2.4), expressive: s(1.9, 2.5), second: s(2.0, 2.6),
    use: s(2.2, 2.8), author: s(4.0, 4.6), script: s(4.3, 4.9), operator: s(4.6, 5.2)
  };
  // 構造は冒頭から読める。流れの強調と移動だけを時刻に合わせる。
  ['header','input','tokens','cond','t3','s3gen','perth','default','expressive','second','use'].forEach(key => { appear[key] = 1; });
  const intro = key => 0.4 * p4(0.6, 1.4, 3.4, 4.0) * appear[key];
  const emph = {
    author: p4(4.0, 4.6, 5.6, 6.2), script: p4(4.8, 5.4, 6.4, 7.0), operator: p4(5.6, 6.2, 7.4, 8.0),
    header: Math.max(p4(0.4, 1.0, 3.4, 4.0), p4(6.6, 7.2, 8.0, 8.6)),
    input: Math.max(intro('input'), p4(8.0, 8.6, 12.4, 13.0)),
    tokens: Math.max(intro('tokens'), p4(8.8, 9.4, 12.4, 13.0)),
    cond: Math.max(intro('cond'), p4(9.8, 10.4, 12.6, 13.2)),
    t3: Math.max(intro('t3'), p4(11.6, 12.2, 18.4, 19.0)),
    s3gen: Math.max(intro('s3gen'), p4(18.8, 19.4, 21.4, 22.0)),
    perth: Math.max(intro('perth'), p4(20.8, 21.4, 22.6, 23.2)),
    default: p4(22.0, 22.4, 23.6, 24.0), expressive: p4(23.6, 24.0, 25.0, 25.4), second: p4(24.8, 25.2, 26.2, 26.6),
    use: s(28.6, 29.4)
  };
  NODE_KEYS.forEach(key => { emph[key] = Math.max(emph[key] || 0, key === 'use' ? 0 : 0.3 * end); });

  const edgeEmph = {
    a_s: p4(4.6, 5.0, 6.0, 6.6), s_o: p4(5.4, 5.8, 6.8, 7.4), o_h: p4(6.4, 6.8, 7.8, 8.4),
    h_i: p4(7.6, 8.0, 8.8, 9.4),
    i_tok: p4(8.4, 9.0, 12.4, 13.0), tok_t3: p4(9.8, 10.4, 12.4, 13.0),
    set: p4(10.4, 11.0, 12.6, 13.2), c_t3: p4(9.8, 10.4, 12.6, 13.2), c_s3: p4(9.8, 10.4, 12.6, 13.2),
    t3_s3: p4(18.4, 19.0, 20.4, 21.0), s3_p: p4(19.8, 20.4, 21.6, 22.2),
    p_default: p4(21.4, 22.0, 23.0, 23.6), p_expressive: p4(23.6, 24.0, 24.8, 25.2), p_second: p4(24.8, 25.2, 26.0, 26.4),
    w_use: s(28.6, 29.4)
  };
  Object.keys(edgeEmph).forEach(key => { edgeEmph[key] = Math.max(edgeEmph[key], 0.3 * end); });

  const flows = [];
  const travel = (path, kind, a, b, job = 'default') => {
    const p = lin(a, b, t);
    if (t > a && t < b) flows.push({path, kind, p, alpha: fadeEnds(p), job});
  };
  travel('handoff', 'paper', 4.6, 7.6);
  for (let i = 0; i < 5; i += 1) travel('text', 'chars', 8.4 + i * 0.35, 10.4 + i * 0.35);
  for (let i = 0; i < 2; i += 1) {
    travel('cond_t3', 'cond', 10.0 + i * 0.5, 12.0 + i * 0.5);
    travel('cond_s3', 'cond', 10.0 + i * 0.5, 12.0 + i * 0.5);
  }
  travel('set', 'set', 10.6, 12.4);
  for (let i = 0; i < 5; i += 1) travel('speech', 'speech', 18.6 + i * 0.25, 19.8 + i * 0.25);
  travel('wave_default', 'chip', 20.2, 22.4, 'default');
  travel('wave_expressive', 'chip', 23.4, 24.4, 'expressive');
  travel('wave_second', 'chip', 24.6, 25.6, 'second');

  const title = CAPTIONS[index];
  const since = t - FILM_SCENES[index].at;
  return {
    film: true,
    t,
    index,
    job: 'default',
    part: null,
    appear,
    emph,
    edgeEmph,
    flows,
    textShown: lin(8.8, 10.8, t),
    speechShown: lin(13.4, 16.8, t),
    stopGone: smooth(17.4, 18.0, t),
    reveal: {default: lin(22.2, 23.4, t), expressive: lin(23.8, 25.0, t), second: lin(25.0, 26.2, t)},
    numbers: {default: s(23.0, 23.4), expressive: s(24.6, 25.0), second: s(25.8, 26.2)},
    jobFocus: {default: emph.default, expressive: emph.expressive, second: emph.second},
    headerAlt: p4(6.8, 7.3, 8.2, 8.7),
    useAlt: p4(26.4, 27.0, 28.4, 29.0),
    caption: {title: title.title, tag: title.tag, alpha: index === 0 ? 1 : clamp(since / 0.3)}
  };
}

// ---- 色 ----

export const PALETTES = {
  light: {
    bg: '#f4efe4', frame: '#ebe3d2', paper: '#fffdf8', ink: '#1b1916', sub: '#3b362e', line: '#4d463b',
    accent: '#b4361f', accentSoft: '#f6d5c9', cond: '#244887', condSoft: '#d5dff2', set: '#7a5200', setSoft: '#f2e0b4',
    wave: '#1b1916', ghost: '#8a8173'
  },
  dark: {
    bg: '#13120e', frame: '#1c1a15', paper: '#24211b', ink: '#f4efe5', sub: '#d9d1c2', line: '#bdb4a3',
    accent: '#ff8d6e', accentSoft: '#4d2a1f', cond: '#a8c0ff', condSoft: '#223154', set: '#ecc76c', setSoft: '#403315',
    wave: '#f4efe5', ghost: '#8f877a'
  }
};

const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP","Noto Sans CJK JP",system-ui,sans-serif';
const MONO = 'ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,"Liberation Mono",monospace';

function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mix(a, b, k) {
  const x = rgb(a);
  const y = rgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * clamp(k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ---- 描画 ----

function roundRect(ctx, r, radius) {
  const rad = Math.min(radius, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
}

function makeText(ctx, minSize) {
  return (str, x, y, {size = 15, weight = 500, color, align = 'left', maxW = 0, mono = false} = {}) => {
    let sz = size;
    const fontOf = px => `${weight} ${px}px ${mono ? MONO : SANS}`;
    ctx.font = fontOf(sz);
    if (maxW > 0) {
      const w = ctx.measureText(str).width;
      if (w > maxW) {
        sz = Math.max(minSize, sz * maxW / w);
        ctx.font = fontOf(sz);
      }
    }
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  };
}

function polyLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

function pointAlong(pts, p) {
  const total = polyLength(pts);
  let left = clamp(p) * total;
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (left <= seg || i === pts.length - 1) {
      const k = seg === 0 ? 0 : clamp(left / seg);
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
    }
    left -= seg;
  }
  return pts[pts.length - 1];
}

function drawArrow(ctx, pts, color, width, dashed, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dashed ? [4, 3] : []);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.setLineDash([]);
  const [x1, y1] = pts[pts.length - 1];
  const [x0, y0] = pts[pts.length - 2];
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const head = 4 + width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - 0.45), y1 - head * Math.sin(angle - 0.45));
  ctx.lineTo(x1 - head * Math.cos(angle + 0.45), y1 - head * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBox(ctx, r, P, e, kind, alpha) {
  if (alpha <= 0.01) return;
  const soft = kind === 'cond' ? P.condSoft : kind === 'set' ? P.setSoft : P.accentSoft;
  const strong = kind === 'cond' ? P.cond : kind === 'set' ? P.set : P.accent;
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRect(ctx, r, 6);
  ctx.fillStyle = mix(P.paper, soft, e);
  ctx.fill();
  ctx.strokeStyle = mix(P.line, strong, e);
  ctx.lineWidth = 1.2 + 1.4 * e;
  ctx.stroke();
  ctx.restore();
}

function drawStrip(ctx, r, P, total, shown, stopIndex, stopGone, color) {
  const x0 = r.x + 7;
  const w = r.w - 14;
  const y = r.y + r.h - 9;
  const h = 4.5;
  const step = w / total;
  const tick = Math.max(0.5, step * 0.62);
  ctx.save();
  ctx.fillStyle = P.ghost;
  ctx.globalAlpha *= 0.28;
  ctx.fillRect(x0, y + h / 2 - 0.4, w, 0.8);
  ctx.restore();
  for (let i = 0; i < shown; i += 1) {
    const isStop = i === stopIndex;
    ctx.save();
    if (isStop) {
      // 停止ID（6562）。S3Gen へ渡す前に除かれるので、除いた後は描かない
      ctx.globalAlpha *= 1 - stopGone;
      ctx.fillStyle = P.ink;
      ctx.fillRect(x0 + i * step - 0.8, y - 2, tick + 1.6, h + 4);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x0 + i * step, y, tick, h);
    }
    ctx.restore();
  }
}

function drawEnvelope(ctx, area, job, reveal, color, maxSeconds) {
  const env = job.envelope;
  const w = area.w * job.seconds / maxSeconds;
  const mid = area.y + area.h / 2;
  const half = area.h / 2;
  const step = w / BINS;
  const shown = Math.floor(BINS * clamp(reveal));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha *= 0.35;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(area.x, mid);
  ctx.lineTo(area.x + w, mid);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < shown; i += 1) {
    const top = mid - env.max[i] * half;
    const bottom = mid - env.min[i] * half;
    ctx.fillRect(area.x + i * step, top, Math.max(0.5, step * 0.9), Math.max(0.5, bottom - top));
  }
  ctx.restore();
}

function drawChip(ctx, x, y, job, P, alpha) {
  const r = R(x - 16, y - 8, 32, 16);
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRect(ctx, r, 3);
  ctx.fillStyle = P.paper;
  ctx.fill();
  ctx.strokeStyle = P.accent;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // 実WAVの包絡を32列にまとめた小片（同じ形が出力のカードへ入る）
  const env = job.envelope;
  ctx.fillStyle = P.wave;
  for (let c = 0; c < 28; c += 1) {
    let hi = 0;
    let lo = 0;
    const a = Math.floor(c * BINS / 28);
    const b = Math.floor((c + 1) * BINS / 28);
    for (let i = a; i < b; i += 1) {
      hi = Math.max(hi, env.max[i]);
      lo = Math.min(lo, env.min[i]);
    }
    ctx.fillRect(r.x + 2 + c, y - hi * 6, 0.8, Math.max(0.4, (hi - lo) * 6));
  }
  ctx.restore();
}

function drawFlow(ctx, flow, layout, P, model) {
  const pts = layout.paths[flow.path];
  if (!pts || flow.alpha <= 0.01) return;
  const [x, y] = pointAlong(pts, flow.p);
  ctx.save();
  ctx.globalAlpha *= flow.alpha;
  if (flow.kind === 'paper') {
    ctx.fillStyle = P.paper;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 9);
    ctx.lineTo(x + 3, y - 9);
    ctx.lineTo(x + 7, y - 5);
    ctx.lineTo(x + 7, y + 9);
    ctx.lineTo(x - 7, y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.ink;
    for (let i = 0; i < 3; i += 1) ctx.fillRect(x - 4, y - 3 + i * 4, 8, 1);
  } else if (flow.kind === 'chars') {
    ctx.fillStyle = P.ink;
    ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
  } else if (flow.kind === 'cond') {
    ctx.fillStyle = P.cond;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (flow.kind === 'set') {
    ctx.fillStyle = P.set;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    ctx.fill();
  } else if (flow.kind === 'speech') {
    ctx.fillStyle = P.accent;
    ctx.fillRect(x - 3, y - 3, 6, 6);
  } else if (flow.kind === 'chip' && model) {
    ctx.restore();
    drawChip(ctx, x, y, model.jobs[flow.job], P, flow.alpha);
    return;
  }
  ctx.restore();
}

const fmtSettings = settings => `強調${settings.exaggeration}・CFG${settings.cfg_weight}`;
const fmtSeconds = seconds => `${seconds.toFixed(2)}秒`;

/**
 * 図を1枚描く。scene は pageScene() か sceneAt() の結果。model が無ければ背景だけ描く。
 * width・height は描く大きさ（CSS px。動画では画素）、dpr は画素の倍率。
 */
export function drawConcept(ctx, {width, height, dpr = 1, palette = PALETTES.light, model, scene, film = false}) {
  const P = palette;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, width, height);
  if (!model || !scene) return;

  const layout = layoutFor(width, height, film);
  const s = Math.min(width / layout.W, height / layout.H);
  const ox = (width - layout.W * s) / 2;
  const oy = (height - layout.H * s) / 2;
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  const minSize = film ? 0 : 14 / s;
  const text = makeText(ctx, minSize);
  const N = layout.nodes;
  const job = model.jobs[scene.job];
  const ap = key => (scene.appear[key] == null ? 1 : scene.appear[key]);
  const em = key => clamp(scene.emph[key] || 0);
  const wide = layout.name === 'wide';

  // 枠（Chatterbox 本体）と見出し
  const frameAlpha = ap('header');
  if (frameAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = frameAlpha;
    roundRect(ctx, N.frame, 10);
    ctx.fillStyle = P.frame;
    ctx.fill();
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.save();
    roundRect(ctx, N.frame, 10);
    ctx.clip();
    ctx.fillStyle = mix(P.frame, P.accentSoft, em('header'));
    ctx.fillRect(N.header.x, N.header.y, N.header.w, N.header.h);
    ctx.restore();
    ctx.strokeStyle = mix(P.line, P.accent, em('header'));
    ctx.lineWidth = 1 + 1.2 * em('header');
    ctx.beginPath();
    ctx.moveTo(N.header.x, N.header.y + N.header.h);
    ctx.lineTo(N.header.x + N.header.w, N.header.y + N.header.h);
    ctx.stroke();
    const hy = N.header.y + N.header.h / 2;
    const alt = clamp(scene.headerAlt || 0);
    ctx.globalAlpha = frameAlpha * (1 - alt);
    if (wide) {
      text('Chatterbox・ローカルで動くPythonの音声合成（TTS）', N.header.x + 12, hy, {size: 16, weight: 700, color: P.ink, maxW: 400});
      text('ChatterboxTTS.generate(text, …)', N.header.x + N.header.w - 12, hy, {size: 13.5, weight: 500, color: P.sub, align: 'right', mono: true, maxW: 200});
    } else {
      text('Chatterbox・ローカルPython TTS', N.header.x + N.header.w / 2, hy, {size: 15, weight: 700, color: P.ink, align: 'center', maxW: N.header.w - 12});
    }
    if (alt > 0.01) {
      ctx.globalAlpha = frameAlpha * alt;
      text('from_local 1回 → generate 3回', N.header.x + N.header.w / 2, hy, {size: 15, weight: 700, color: P.ink, align: 'center', maxW: N.header.w - 12, mono: true});
    }
    ctx.restore();
  }

  // 関係の矢印（いつも同じ線。強調だけが変わる）
  Object.entries(layout.edges).forEach(([id, e]) => {
    const alpha = Math.min(ap(e.from), ap(e.to));
    const k = clamp(scene.edgeEmph[id] == null ? Math.min(em(e.from), em(e.to)) : scene.edgeEmph[id]);
    const strong = e.kind === 'cond' ? P.cond : e.kind === 'set' ? P.set : P.accent;
    const base = e.kind === 'cond' ? P.cond : e.kind === 'set' ? P.set : P.line;
    drawArrow(ctx, e.pts, mix(base, strong, k), 1.2 + 1.3 * k, e.kind === 'set', alpha);
  });

  // 受け渡しの3つ
  [['author', '作者AI', 'Opus 5.5'], ['script', 'スクリプト', 'と3件の入力'], ['operator', '制作担当', `GPUで実行`]].forEach(([key, a, b]) => {
    const r = N[key];
    drawBox(ctx, r, P, em(key), 'accent', ap(key));
    if (ap(key) <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = ap(key);
    text(a, r.x + r.w / 2, r.y + r.h / 2 - 8.5, {size: 15, weight: 700, color: P.ink, align: 'center', maxW: r.w - 8});
    text(b, r.x + r.w / 2, r.y + r.h / 2 + 9, {size: 15, weight: 500, color: P.sub, align: 'center', maxW: r.w - 8});
    ctx.restore();
  });

  // 入力
  {
    const r = N.input;
    drawBox(ctx, r, P, em('input'), 'accent', ap('input'));
    if (ap('input') > 0.01) {
      ctx.save();
      ctx.globalAlpha = ap('input');
      const x = r.x + 7;
      text('英語テキスト', x, r.y + 11, {size: 15, weight: 700, color: P.ink, maxW: r.w - 50});
      text(`${job.words}語`, r.x + r.w - 7, r.y + 11, {size: 15, weight: 500, color: P.sub, align: 'right'});
      text(job.snippet, x, r.y + 29, {size: 15, weight: 500, color: P.ink, maxW: r.w - 14});
      text(fmtSettings(job.settings), x, r.y + 47, {size: 15, weight: 700, color: P.set, maxW: r.w - 14});
      ctx.restore();
    }
  }

  // 文字ID
  {
    const r = N.tokens;
    drawBox(ctx, r, P, em('tokens'), 'accent', ap('tokens'));
    if (ap('tokens') > 0.01) {
      ctx.save();
      ctx.globalAlpha = ap('tokens');
      const shown = scene.textShown == null ? job.textIds : Math.round(job.textIds * clamp(scene.textShown));
      const label = `${job.textIds}個`;
      if (layout.compact) {
        text('文字ID', r.x + 7, r.y + 12, {size: 15, weight: 700, color: P.ink});
        text(label, r.x + r.w - 7, r.y + 12, {size: 15, weight: 500, color: P.ink, align: 'right'});
      } else {
        text('文字ID', r.x + 7, r.y + 12, {size: 15, weight: 700, color: P.ink, maxW: r.w - 14});
        text(label, r.x + 7, r.y + 30, {size: 15, weight: 500, color: P.ink, maxW: r.w - 14});
      }
      drawStrip(ctx, r, P, job.textIds, shown, -1, 0, P.ink);
      ctx.restore();
    }
  }

  // 組み込み条件
  {
    const r = N.cond;
    drawBox(ctx, r, P, em('cond'), 'cond', ap('cond'));
    if (ap('cond') > 0.01) {
      ctx.save();
      ctx.globalAlpha = ap('cond');
      if (layout.compact) {
        text('conds.pt', r.x + r.w / 2, r.y + 12, {size: 15, weight: 700, color: P.cond, align: 'center', maxW: r.w - 8});
        text('組み込み', r.x + r.w / 2, r.y + 30, {size: 15, weight: 500, color: P.ink, align: 'center', maxW: r.w - 8});
        text('条件のみ', r.x + r.w / 2, r.y + 47, {size: 15, weight: 500, color: P.ink, align: 'center', maxW: r.w - 8});
      } else {
        text('conds.pt 組み込み条件', r.x + r.w / 2, r.y + 15, {size: 15, weight: 700, color: P.cond, align: 'center', maxW: r.w - 12});
        text('→ T3条件 と S3Gen参照・別の音声は渡さない', r.x + r.w / 2, r.y + 34, {size: 14, weight: 500, color: P.ink, align: 'center', maxW: r.w - 12});
      }
      ctx.restore();
    }
  }

  // T3
  {
    const r = N.t3;
    drawBox(ctx, r, P, em('t3'), 'accent', ap('t3'));
    if (ap('t3') > 0.01) {
      ctx.save();
      ctx.globalAlpha = ap('t3');
      const counting = scene.speechShown != null;
      const shown = counting ? Math.round(job.raw * clamp(scene.speechShown)) : job.raw;
      const gone = clamp(scene.stopGone);
      const label = `音声ID ${job.raw}→${job.speech}`;
      if (layout.compact) {
        text('T3（自己回帰）', r.x + 7, r.y + 12, {size: 15, weight: 700, color: P.ink, maxW: r.w - 14});
        text(label, r.x + 7, r.y + 30, {size: 15, weight: 500, color: P.ink, maxW: r.w - 14});
      } else {
        text('T3 自己回帰', r.x + 7, r.y + 12, {size: 15, weight: 700, color: P.ink, maxW: r.w - 14});
        text(label, r.x + 7, r.y + 30, {size: 15, weight: 500, color: P.ink, maxW: r.w - 14});
      }
      drawStrip(ctx, r, P, job.raw, shown, shown === job.raw ? job.raw - 1 : -1, gone, P.accent);
      ctx.restore();
    }
  }

  // S3Gen と Perth
  [['s3gen', 'S3Gen', 'メル→波形'], ['perth', 'Perth', '透かし1回']].forEach(([key, a, b]) => {
    const r = N[key];
    drawBox(ctx, r, P, em(key), 'accent', ap(key));
    if (ap(key) <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = ap(key);
    if (r.h < 36) {
      text(a, r.x + 7, r.y + r.h / 2, {size: 15, weight: 700, color: P.ink});
      text(b, r.x + r.w - 7, r.y + r.h / 2, {size: 15, weight: 500, color: P.ink, align: 'right'});
    } else {
      text(a, r.x + 7, r.y + 12, {size: 15, weight: 700, color: P.ink, maxW: r.w - 14});
      text(b, r.x + 7, r.y + 30, {size: 15, weight: 500, color: P.ink, maxW: r.w - 14});
    }
    ctx.restore();
  });

  // 実際の3つのWAV
  JOB_IDS.forEach(id => {
    const r = N[id];
    const a = ap(id);
    if (a <= 0.01) return;
    const item = model.jobs[id];
    const focus = clamp(scene.jobFocus[id] || 0);
    const selected = !film && id === scene.job;
    ctx.save();
    ctx.globalAlpha = a;
    roundRect(ctx, r, 6);
    ctx.fillStyle = mix(P.paper, P.accentSoft, Math.max(focus * 0.6, em(id) * 0.5));
    ctx.fill();
    ctx.strokeStyle = selected || focus > 0.5 ? P.accent : P.line;
    ctx.lineWidth = selected ? 2.8 : 1.2 + 1.4 * focus;
    ctx.stroke();
    text(id, r.x + 7, r.y + 11, {size: 15, weight: 700, color: P.ink, mono: false, maxW: r.w - 14});
    const area = wide ? R(r.x + 7, r.y + 22, r.w - 14, 40) : R(r.x + 6, r.y + 22, r.w - 12, 30);
    drawEnvelope(ctx, area, item, scene.reveal[id], P.wave, model.maxSeconds);
    const numbers = clamp(scene.numbers[id]);
    if (numbers > 0.01) {
      ctx.globalAlpha = a * numbers;
      const line = wide ? `${fmtSeconds(item.seconds)}・音声ID${item.speech}` : fmtSeconds(item.seconds);
      text(line, r.x + 7, r.y + r.h - 10, {size: 15, weight: 600, color: P.ink, maxW: r.w - 14});
    }
    ctx.restore();
  });

  // 次の使い道
  {
    const r = N.use;
    const a = ap('use');
    if (a > 0.01) {
      const alt = clamp(scene.useAlt || 0);
      ctx.save();
      ctx.globalAlpha = a;
      if (wide) {
        drawBox(ctx, r, P, em('use'), 'accent', 1);
        const lines = alt > 0.5 ? ['左2つは', '同じ文で', '2設定を変更'] : ['ブラウザーで', '再生・保存', '→ 音声編集へ'];
        lines.forEach((line, i) => text(line, r.x + r.w / 2, r.y + 22 + i * 21, {size: 15, weight: i === 1 ? 700 : 500, color: P.ink, align: 'center', maxW: r.w - 12}));
      } else {
        const k = em('use');
        if (k > 0.01) {
          ctx.save();
          ctx.globalAlpha = a * k;
          roundRect(ctx, R(r.x, r.y - 1, r.w, r.h + 2), 5);
          ctx.fillStyle = P.accentSoft;
          ctx.fill();
          ctx.restore();
        }
        const line = alt > 0.5 ? '左2つは同じ文・2設定を同時に変更' : '→ ブラウザーで再生・保存 → 音声編集へ';
        text(line, r.x + r.w / 2, r.y + r.h / 2, {size: 15, weight: 700, color: P.ink, align: 'center', maxW: r.w - 4});
      }
      ctx.restore();
    }
  }

  // 選んだ部品の輪
  if (scene.part && PART_NODES[scene.part]) {
    PART_NODES[scene.part].forEach(key => {
      const r = N[key];
      ctx.save();
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([5, 3]);
      roundRect(ctx, R(r.x - 3, r.y - 3, r.w + 6, r.h + 6), 8);
      ctx.stroke();
      ctx.restore();
    });
  }

  // 動く印（構造の図解。実際の処理時間ではない）
  scene.flows.forEach(flow => drawFlow(ctx, flow, layout, P, model));

  // 動画の見出し
  if (film && scene.caption && N.caption) {
    const r = N.caption;
    ctx.save();
    ctx.globalAlpha = clamp(scene.caption.alpha);
    text(scene.caption.title, r.x + 2, r.y + 12, {size: 17, weight: 800, color: P.ink, maxW: r.w - 4});
    text(scene.caption.tag(model), r.x + 2, r.y + 31, {size: 12.5, weight: 500, color: P.sub, maxW: r.w - 4});
    ctx.restore();
  }
}

/** 図の内容を文章にしたもの（読み上げソフトと、図が見えない場合のため）。 */
export function describeConcept(model, jobId, stage) {
  const job = model.jobs[jobId];
  const base = `Chatterbox はローカルで動く Python の音声合成ツールです。作者AIが書いたスクリプトと3件の入力を、制作担当が手元の ${model.env.gpuShort} で実行しました。`;
  const flow = `英語の文（${job.words}語、${fmtSettings(job.settings)}）は punc_norm と EnTokenizer で文字ID ${job.textIds}個になり、T3 へ入ります。別に、チェックポイントの組み込み条件 conds.pt が T3 の条件と S3Gen の参照の2方向へ入ります。別の参照音声は渡していません。`;
  const back = `T3 は音声IDを ${job.raw}個返し、最後の停止ID ${STOP_SPEECH} を除いた ${job.speech}個を S3Gen がメル→波形にし、Perth が透かしを1回入れて、${fmtSeconds(job.seconds)}の PCM16 WAV（${job.id}）になりました。下に default・expressive・second の3つの実WAVの包絡があります。`;
  const lead = ['まず全体と受け渡し：', 'いま強調しているのは渡すもの：', 'いま強調しているのは返るもの：'][stage] || '';
  return `${lead}${base}${flow}${back}`;
}

// ---- 構造図ページ ----

function initPage() {
  const root = document.documentElement;
  const $ = id => document.getElementById(id);
  const canvas = $('concept-map');
  const wrap = $('map-wrap');
  const status = $('load-status');
  const retry = $('retry');
  const audio = $('audio-output');
  const download = $('download-audio');
  const jobButtons = Array.from(document.querySelectorAll('button[data-job]'));
  const stageButtons = Array.from(document.querySelectorAll('button[data-stage]'));
  const partButtons = Array.from(document.querySelectorAll('button[data-part]'));
  const themeButtons = Array.from(document.querySelectorAll('button[data-theme-set]'));
  const motionButton = $('motion-toggle');
  const controls = [...jobButtons, ...stageButtons, ...partButtons];
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const state = {
    model: null,
    job: 'default',
    stage: 0,
    prevStage: null,
    tweenStart: 0,
    part: null,
    theme: darkQuery.matches ? 'dark' : 'light',
    still: reduceQuery.matches,
    urls: {},
    generation: 0,
    abort: null,
    frame: 0,
    cssW: 0,
    cssH: 0,
    dpr: 1
  };

  const hashJob = () => {
    const id = decodeURIComponent((location.hash || '').slice(1));
    return JOB_IDS.includes(id) ? id : null;
  };

  // ---- 表示 ----

  function sizeCanvas() {
    const cw = Math.max(240, Math.floor(wrap.clientWidth));
    const layout = layoutFor(cw, 0, false);
    const ch = layout.name === 'phone' ? Math.min(420, Math.round(cw * layout.H / layout.W)) : Math.round(cw * layout.H / layout.W);
    state.dpr = Math.min(3, window.devicePixelRatio || 1);
    state.cssW = cw;
    state.cssH = ch;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * state.dpr);
    canvas.height = Math.round(ch * state.dpr);
  }

  function paint(now = performance.now()) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const mixK = state.prevStage == null || state.still ? 1 : clamp((now - state.tweenStart) / 450);
    if (mixK >= 1) state.prevStage = null;
    const scene = state.model ? pageScene({
      stage: state.stage, job: state.job, part: state.part,
      phase: (now % 3600) / 3600, prevStage: state.prevStage, mix: mixK, still: state.still
    }) : null;
    drawConcept(ctx, {width: state.cssW, height: state.cssH, dpr: state.dpr, palette: PALETTES[state.theme], model: state.model, scene});
  }

  function loop(now) {
    state.frame = 0;
    if (!state.model) return;
    paint(now);
    if (!state.still && !document.hidden) state.frame = requestAnimationFrame(loop);
  }

  function restartLoop() {
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    if (!state.model) return;
    if (state.still || document.hidden) paint();
    else state.frame = requestAnimationFrame(loop);
  }

  // ---- 状態の切り替え ----

  function setPressed(buttons, pick) {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(pick(button))));
  }

  const nf = value => value.toLocaleString('ja-JP');

  function updateJobText() {
    const model = state.model;
    const job = model.jobs[state.job];
    $('job-name').textContent = job.id;
    $('job-text').textContent = job.text;
    $('job-meta').textContent = `${fmtSeconds(job.seconds)}・${nf(job.frames)}フレーム・${nf(job.bytes)}バイト・PCM16 モノラル 24kHz・S3Genへ渡した音声ID ${job.speech}個`;
    $('job-settings').textContent = `exaggeration ${job.settings.exaggeration}・cfg_weight ${job.settings.cfg_weight}・temperature ${job.settings.temperature}・seed ${job.seed}`;
    const notes = {
      default: '上流の既定の設定で合成した基準の1本です。',
      expressive: 'default と同じ文・同じseedで、exaggeration と cfg_weight の2つを同時に変えた対の比較です。差をどちらか一方の効果とは言えず、品質や感情表現の証拠でもありません。',
      second: `別の英文（${job.words}語）を既定の設定で合成しました。返った値の1サンプルが1.0を超え、PCM16にする際に32767へ切り詰められています（WAVは元のまま）。聞こえ方への影響は確かめていません。`
    };
    $('job-note').textContent = notes[state.job];
    const stageNotes = [
      `Chatterbox は手元のGPUで動く Python の音声合成（TTS）ツールです。作者AIが書いたスクリプトを、制作担当が ${model.env.gpuShort} で1回だけ実行しました。ブラウザーは保存済みのWAVを再生するだけです。`,
      `渡したのは英語の文（${job.words}語）と設定です。文は文字ID ${job.textIds}個（開始・終了を含む）になり、組み込み条件 conds.pt は T3 と S3Gen の両方へ入ります。別の参照音声は渡していません。`,
      `T3 は音声IDを ${job.raw}個返し、最後の停止ID ${STOP_SPEECH} を除いた ${job.speech}個を S3Gen が波形にしました。Perth の透かしを1回通り、${fmtSeconds(job.seconds)}の WAV が返りました。`
    ];
    $('stage-note').textContent = stageNotes[state.stage];
    $('map-text').textContent = describeConcept(model, state.job, state.stage);
  }

  function selectJob(id, {resetStage = false, fromRoute = false} = {}) {
    if (!state.model || !JOB_IDS.includes(id)) return;
    const changed = id !== state.job || !audio.getAttribute('src');
    state.job = id;
    if (resetStage) {
      state.stage = 0;
      state.prevStage = null;
    }
    if (changed) {
      audio.pause();
      audio.src = state.urls[id];
      audio.load();
      download.href = state.urls[id];
      download.setAttribute('download', `chatterbox-example-${id}.wav`);
      download.removeAttribute('aria-disabled');
      download.removeAttribute('tabindex');
    }
    setPressed(jobButtons, button => button.dataset.job === id);
    setPressed(stageButtons, button => Number(button.dataset.stage) === state.stage);
    if (!fromRoute && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    updateJobText();
    if (state.part) showPart(state.part);
    restartLoop();
  }

  function selectStage(stage) {
    if (!state.model || stage === state.stage) return;
    state.prevStage = state.stage;
    state.tweenStart = performance.now();
    state.stage = stage;
    setPressed(stageButtons, button => Number(button.dataset.stage) === stage);
    updateJobText();
    restartLoop();
  }

  const PART_TEXT = {
    entry: model => `ChatterboxTTS.from_local(ckpt_dir, device) で5つの重み（合計 ${nf(model.checkpoints.bytes)}バイト、同梱しません）を1回読み込み、generate(text, …) を3回呼びました。呼んだのは制作担当の手元の Python ${model.env.python}・${model.env.gpuShort} で、ブラウザーではありません。`,
    text: (model, job) => `punc_norm が句読点を整え、EnTokenizer が空白を [SPACE] にしてから文字ID列にします。${job.id} は開始255と終了0を含めて ${job.textIds}個。CFG のため同じ行が2本 T3 へ入ります。文字IDは辞書の番号で、単語や点数ではありません。`,
    condition: model => `チェックポイントの conds.pt を読み込み、T3 側（話者埋め込み ${model.conds.speaker}・プロンプト音声ID ${model.conds.prompt}・emotion_adv）と S3Gen 側（プロンプトID ${model.conds.genToken}・メル特徴 ${model.conds.genFeat}・埋め込み ${model.conds.genEmbed}）に分かれて入ります。audio_prompt_path は3件とも None で、別の参照音声は渡していません。VoiceEncoder の重みは読み込まれますが、参照音声から条件を作る prepare_conditionals は呼んでいません。組み込み条件は話者とプロンプト音声の特徴を含み、人の声に由来しないことや、独自の声であることを保証するものではありません。`,
    t3: (model, job) => `T3 は条件・文字ID・それまでの音声IDから次の音声IDを1つずつ選び（自己回帰）、停止ID ${STOP_SPEECH} が出たら止まります。${job.id} は ${job.raw}個を返し、最後の ${STOP_SPEECH} を除いた ${job.speech}個が S3Gen へ渡りました。音声IDは単語・確率・点数ではありません。exaggeration は条件の emotion_adv に、cfg_weight は T3 の CFG の重みに入ります。`,
    s3gen: (model, job) => `S3Gen は音声IDから、CFM（条件付きフローマッチング）でメルスペクトログラムを作り、HiFT ボコーダーで 24kHz の波形にします。ここは原典に基づく説明で、各ステップの内部は記録していません。実測したのは入口の ${job.speech}個のIDと、出口の ${nf(job.frames)}サンプルの波形とそのハッシュです。`,
    perth: (model, job) => `generate の最後に Perth の apply_watermark を各ジョブ1回通し、前後の音声のハッシュが違うことと呼び出し回数を記録しました。透かしの検出（get_watermark）は試していません。返った値を [-1, 1] で切り詰め、×32767・四捨五入（偶数丸め）で PCM16 WAV にしています。${job.saturation > 0 ? `${job.id} は1サンプルが上限の32767です。` : `${job.id} で上限に達したサンプルは0です。`}`
  };

  const sourceUrl = (path, line) => {
    if (path.startsWith('vendor/chatterbox/')) return `https://github.com/${SOURCE_REPO}/blob/${SOURCE_COMMIT}/${path.slice('vendor/chatterbox/'.length)}#L${line}`;
    if (path.startsWith('vendor/perth/')) return `https://github.com/${PERTH_REPO}/blob/${PERTH_COMMIT}/${path.slice('vendor/perth/'.length)}#L${line}`;
    return null;
  };

  function quoteBlock(path, line, quote) {
    const figure = document.createElement('figure');
    figure.className = 'quote';
    const cap = document.createElement('figcaption');
    const local = document.createElement('a');
    local.href = path;
    local.textContent = path.replace(/^vendor\//, '');
    cap.append(local, document.createTextNode(` ${line}行目`));
    const remote = sourceUrl(path, line);
    if (remote) {
      const a = document.createElement('a');
      a.href = remote;
      a.rel = 'noopener noreferrer';
      a.textContent = '固定版の原典';
      cap.append(document.createTextNode('・'), a);
    }
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = quote;
    pre.append(code);
    figure.append(cap, pre);
    return figure;
  }

  function showPart(id) {
    const model = state.model;
    if (!model) return;
    state.part = id;
    setPressed(partButtons, button => button.dataset.part === id);
    const part = model.parts[id];
    const job = model.jobs[state.job];
    $('part-title').textContent = part.label;
    $('part-body').textContent = PART_TEXT[id](model, job);
    const box = $('part-quotes');
    box.replaceChildren(quoteBlock(part.source, part.line, part.quote), ...part.extras.map(extra => quoteBlock(extra.source, extra.line, extra.quote)));
    $('part-detail').hidden = false;
    restartLoop();
  }

  function fillFacts() {
    const model = state.model;
    const values = model ? {
      'asset-count': String(model.assets.length),
      'manifest-sha': model.manifestSha256,
      'gpu': model.env.gpu,
      'threads': String(model.env.threads),
      'python': model.env.python,
      'torch': `${model.env.torch}・torchaudio ${model.env.torchaudio}`,
      'checkpoint-count': String(model.checkpoints.count),
      'checkpoint-bytes': nf(model.checkpoints.bytes),
      'perth-files': String(model.perthInstall.files),
      'perth-raw': String(model.perthInstall.raw),
      'perth-crlf': String(model.perthInstall.crlf),
      'asr-model': model.asrModel
    } : {};
    document.querySelectorAll('[data-fill]').forEach(el => { el.textContent = values[el.dataset.fill] || '—'; });

    const body = $('compare-body');
    const assets = $('asset-list');
    const asrList = $('asr-list');
    if (!model) {
      body.replaceChildren();
      assets.replaceChildren();
      asrList.replaceChildren();
      return;
    }
    const rows = [
      ['exaggeration・cfg_weight', job => `${job.settings.exaggeration}・${job.settings.cfg_weight}`],
      ['文', job => (job.text === model.jobs.default.text ? `同じ文（${job.words}語）` : `別の文（${job.words}語）`)],
      ['文字ID（開始・終了を含む）', job => `${job.textIds}個`],
      ['T3 が返した音声ID', job => `${job.raw}個（最後が${STOP_SPEECH}）`],
      ['S3Gen へ渡した音声ID', job => `${job.speech}個`],
      ['長さ', job => fmtSeconds(job.seconds)],
      ['サンプル数', job => nf(job.frames)],
      ['WAVのバイト数', job => nf(job.bytes)],
      ['最大振幅（int16）', job => nf(job.peak)],
      ['上限32767のサンプル', job => `${job.saturation}`]
    ];
    body.replaceChildren(...rows.map(([label, cell]) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = label;
      tr.append(th, ...JOB_IDS.map(id => {
        const td = document.createElement('td');
        td.textContent = cell(model.jobs[id]);
        return td;
      }));
      return tr;
    }));
    assets.replaceChildren(...model.assets.map(entry => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = entry.path;
      a.textContent = entry.path;
      const meta = document.createElement('span');
      meta.className = 'hash';
      meta.textContent = `${nf(entry.bytes)}バイト・SHA-256 ${entry.sha256}`;
      li.append(a, meta);
      return li;
    }));
    asrList.replaceChildren(...JOB_IDS.map(id => {
      const job = model.jobs[id];
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = `${id}：`;
      const q = document.createElement('q');
      q.lang = 'en';
      q.textContent = job.asr.text;
      const note = document.createElement('span');
      note.textContent = job.asr.literal ? '（入力の文と文字どおり一致）' : '（数字・大文字の書き方が違い、文字どおりの一致ではない）';
      li.append(b, q, note);
      return li;
    }));
  }

  // ---- 読み込みと失敗 ----

  function setStatus(kind, message) {
    root.dataset.state = kind;
    status.dataset.state = kind;
    status.textContent = message;
  }

  function releaseAudio() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    download.removeAttribute('href');
    download.setAttribute('aria-disabled', 'true');
    download.setAttribute('tabindex', '-1');
    Object.values(state.urls).forEach(url => URL.revokeObjectURL(url));
    state.urls = {};
  }

  function clearAll() {
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.model = null;
    releaseAudio();
    controls.forEach(button => { button.disabled = true; });
    $('part-detail').hidden = true;
    ['job-name', 'job-text', 'job-meta', 'job-settings', 'job-note', 'stage-note', 'map-text'].forEach(id => { $(id).textContent = '—'; });
    fillFacts();
    paint();
  }

  async function load() {
    const mine = ++state.generation;
    if (state.abort) state.abort.abort();
    const controller = new AbortController();
    state.abort = controller;
    clearAll();
    retry.hidden = true;
    setStatus('loading', `保存データ${ASSET_COUNT}件の大きさとSHA-256を確かめています（0/${ASSET_COUNT}）`);
    try {
      const model = await loadConcept({
        signal: controller.signal,
        onProgress: (done, total) => {
          if (mine === state.generation && status.dataset.state === 'loading') {
            setStatus('loading', `保存データ${total}件の大きさとSHA-256を確かめています（${done}/${total}）`);
          }
        }
      });
      if (mine !== state.generation) return;
      state.model = model;
      JOB_IDS.forEach(id => {
        state.urls[id] = URL.createObjectURL(new Blob([model.jobs[id].buffer], {type: 'audio/wav'}));
      });
      controls.forEach(button => { button.disabled = false; });
      fillFacts();
      setStatus('ready', `${model.assets.length}ファイルの大きさとSHA-256を確認済み。図は構造の図解で、音声はこの確認済みWAVです。`);
      selectJob(hashJob() || 'default', {resetStage: true, fromRoute: true});
    } catch (error) {
      if (mine !== state.generation) return;
      clearAll();
      setStatus('error', `表示できません：${error && error.message ? error.message : error}`);
      retry.hidden = false;
    }
  }

  // ---- 操作 ----

  jobButtons.forEach(button => button.addEventListener('click', () => selectJob(button.dataset.job)));
  stageButtons.forEach(button => button.addEventListener('click', () => selectStage(Number(button.dataset.stage))));
  partButtons.forEach(button => button.addEventListener('click', () => showPart(button.dataset.part)));
  retry.addEventListener('click', () => load());

  canvas.addEventListener('click', event => {
    if (!state.model) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(state.cssW, state.cssH, event.clientX - rect.left, event.clientY - rect.top);
    if (!hit) return;
    if (hit.job) selectJob(hit.job);
    if (hit.part) showPart(hit.part);
  });

  window.addEventListener('hashchange', () => {
    const id = hashJob();
    if (id && state.model) selectJob(id, {resetStage: true, fromRoute: true});
  });

  download.addEventListener('click', event => {
    if (!state.model || !download.getAttribute('href')) {
      event.preventDefault();
      return;
    }
    $('save-status').textContent = `${download.getAttribute('download')} をブラウザーの保存処理へ渡しました。保存が終わったかどうかは、このページからは分かりません。`;
  });

  function applyTheme(theme) {
    state.theme = theme;
    root.dataset.theme = theme;
    setPressed(themeButtons, button => button.dataset.themeSet === theme);
    restartLoop();
    if (!state.model) paint();
  }
  themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeSet)));

  function applyMotion(still) {
    state.still = still;
    motionButton.setAttribute('aria-pressed', String(still));
    motionButton.textContent = still ? '図を動かす' : '図の動きを止める';
    restartLoop();
  }
  motionButton.addEventListener('click', () => applyMotion(!state.still));
  reduceQuery.addEventListener('change', () => applyMotion(reduceQuery.matches));

  document.addEventListener('visibilitychange', () => restartLoop());
  const resize = () => {
    sizeCanvas();
    if (state.model) restartLoop();
    else paint();
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(wrap);
  else window.addEventListener('resize', resize);

  sizeCanvas();
  applyTheme(state.theme);
  applyMotion(state.still);
  load();
}

if (typeof document !== 'undefined' && document.documentElement.dataset.conceptPage === 'main') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage, {once: true});
  else initPage();
}
