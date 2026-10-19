// VoiceStudio 作例の共通モジュール。作例ページ（index.html）と無音フィルムの編集ソース（video/）が
// 同じ読み込み・検証・場面・描画を使う。書き出す名前：
//   loadData({signal, onProgress})  31素材の大きさと SHA-256、facts の形、原典の行、WAV の形を確かめたデータを返す
//   stageScene(stage, job)          作例ページの3段階（0 何か・1 渡す・2 返る）の図の状態
//   sceneAt(seconds, job)           フィルムの任意時刻の図の状態（閉じた式。呼ぶ順番・時計・乱数に依存しない）
//   drawConcept(ctx, options)       図を描く。配置は layoutConcept(width, height, {film}) が決める
// ブラウザーでは推論・合成・録音・外部通信をしない。読むのは同じ作例フォルダーのファイルだけ。

export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = '1584cea4f4843351eb4b087a15a4b3bb29cb992bddbf6a5c11966b84fc1fbcc4';
export const ASSET_COUNT = 31;
export const FACTS_SCHEMA = 'voicestudio-actual-facts@1';
export const JOB_IDS = Object.freeze(['default', 'expressive', 'second']);
export const PART_IDS = Object.freeze(['skill', 'cli', 'route', 'selection', 'recognizer', 'result']);
export const SOURCE_COMMIT = '6f0ed2ebeaf620bcea8a293cd210bba920b73622';
export const SOURCE_URL = `https://github.com/debpalash/VoiceStudio/tree/${SOURCE_COMMIT}`;
export const FILM = Object.freeze({duration: 32, fps: 30, width: 720, height: 1280, posterTime: 31, freezeFrom: 30});
export const ROOT = new URL('./', import.meta.url);

// フィルムの7場面。秒数は説明の演出で、実際の処理時間ではない。video/storyboard.json と同じ値。
export const SCENES = Object.freeze([
  {index: 1, start: 0, end: 4.5, title: '公開の手順書と依頼', sub: 'SKILL.md（Markdown）と WAV の場所'},
  {index: 2, start: 4.5, end: 9, title: '作者AI 1体がクライアントを書く', sub: 'run_example.py を書くだけで、実行はしない'},
  {index: 3, start: 9, end: 13.5, title: '担当者が原典CLIを実行', sub: 'WAVはそのまま＋faster-whisper・en・verbose_json'},
  {index: 4, start: 13.5, end: 18, title: '手元の VoiceStudio API', sub: '利用条件と導入済みを確かめ、アダプターを用意'},
  {index: 5, start: 18, end: 22.5, title: '別の認識モデルが推定する', sub: 'faster-whisper-base（MIT）・ログでは CPU int8'},
  {index: 6, start: 22.5, end: 27, title: '2つの推定区間と全文', sub: 'JSON は CLI の出力そのまま、TXT は text＋改行'},
  {index: 7, start: 27, end: 32, title: '読む・比べる・使う', sub: '参照文は送らず、最後に文字どおり照合'}
]);

export const STAGES = Object.freeze([
  {id: 0, name: '何か'},
  {id: 1, name: '渡す'},
  {id: 2, name: '返る'}
]);

// 6つの部品は説明のための整理（facts.json の six_parts_are）。公式の区分ではない。
export const PART_NODE = Object.freeze({skill: 'skill', cli: 'cli', route: 'api', selection: 'select', recognizer: 'model', result: 'output'});
const NODE_PART = Object.freeze(Object.fromEntries(Object.entries(PART_NODE).map(([part, node]) => [node, part])));
const PART_NUMBER = Object.freeze({skill: 1, cli: 2, route: 3, selection: 4, recognizer: 5, result: 6});

export class ConceptError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConceptError';
  }
}

function need(ok, message) {
  if (!ok) throw new ConceptError(message);
}

function abortError() {
  return new DOMException('読み込みを中断しました', 'AbortError');
}

// ---- SHA-256（Web Crypto が使えない http の端末でも同じ結果を出す） ----

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

function sha256Plain(buffer) {
  const bytes = new Uint8Array(buffer);
  const total = ((bytes.length + 9 + 63) >> 6) << 6;
  const block = new Uint8Array(total);
  block.set(bytes);
  block[bytes.length] = 0x80;
  const view = new DataView(block.buffer);
  const bits = bytes.length * 8;
  view.setUint32(total - 8, Math.floor(bits / 0x100000000));
  view.setUint32(total - 4, bits >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < total; offset += 64) {
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
      // 安全な文脈でない場合は下の計算で同じ値を出す
    }
  }
  return sha256Plain(buffer);
}

// ---- 読み込みと検証 ----

const utf8 = new TextDecoder('utf-8', {fatal: true});

function safePath(path) {
  return typeof path === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_.\-/]*$/.test(path) &&
    !path.split('/').some(part => part === '' || part === '.' || part === '..');
}

async function fetchBytes(path, signal) {
  if (signal && signal.aborted) throw abortError();
  let response;
  try {
    response = await fetch(new URL(path, ROOT), {cache: 'no-store', credentials: 'same-origin', signal});
  } catch (error) {
    if (signal && signal.aborted) throw abortError();
    throw new ConceptError(`${path} を読み込めません。作例フォルダー全体をローカルのWebサーバーで開いてください。`);
  }
  if (!response.ok) throw new ConceptError(`${path} を読み込めません（HTTP ${response.status}）。`);
  return response.arrayBuffer();
}

function checkManifest(manifest) {
  need(manifest && manifest.schema === 'studio-yebisu-assets@1', 'concept/manifest.json の形式（schema）が違います。');
  need(Array.isArray(manifest.assets) && manifest.assets.length === ASSET_COUNT,
    `concept/manifest.json の素材が${ASSET_COUNT}件ではありません。`);
  const seen = new Set();
  return manifest.assets.map((file, index) => {
    need(file && safePath(file.path), `concept/manifest.json の${index + 1}件目のパスが不正です。`);
    need(!seen.has(file.path), `concept/manifest.json に同じパスが2回あります：${file.path}`);
    seen.add(file.path);
    need(Number.isInteger(file.bytes) && file.bytes > 0, `${file.path} の記録上の大きさが不正です。`);
    need(typeof file.sha256 === 'string' && /^[0-9a-f]{64}$/.test(file.sha256), `${file.path} の記録上の SHA-256 が不正です。`);
    return Object.freeze({path: file.path, bytes: file.bytes, sha256: file.sha256});
  });
}

const REQUIRED = Object.freeze([
  'inputs/jobs.json',
  'outputs/attempt-01/results.json',
  'outputs/attempt-01/capabilities.json',
  'concept/facts.json',
  'concept/waveforms.json',
  'run_example.py',
  'vendor/voicestudio/skills/voicestudio/SKILL.md',
  'vendor/voicestudio/LICENSE',
  ...JOB_IDS.flatMap(id => [`inputs/audio/${id}.wav`, `outputs/attempt-01/${id}.json`, `outputs/attempt-01/${id}.txt`])
]);

async function eachLimited(items, limit, task) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await task(item);
    }
  };
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
}

function same(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every(key => Object.prototype.hasOwnProperty.call(b, key) && same(a[key], b[key]));
}

function readWav(path, buffer) {
  const view = new DataView(buffer);
  const tag = offset => String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
  need(buffer.byteLength >= 44 && tag(0) === 'RIFF' && tag(8) === 'WAVE', `${path} は RIFF/WAVE ではありません。`);
  let fmt = null;
  let data = null;
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    need(body + size <= buffer.byteLength, `${path} のチャンクが途中で切れています。`);
    if (id === 'fmt ') {
      need(size >= 16, `${path} の fmt チャンクが短すぎます。`);
      fmt = {format: view.getUint16(body, true), channels: view.getUint16(body + 2, true), rate: view.getUint32(body + 4, true), bits: view.getUint16(body + 14, true)};
    } else if (id === 'data') {
      data = {size};
    }
    offset = body + size + (size & 1);
  }
  need(fmt && data, `${path} に fmt と data がそろっていません。`);
  need(fmt.format === 1 && fmt.channels === 1 && fmt.bits === 16, `${path} はモノラルの PCM16 ではありません。`);
  need(data.size % 2 === 0, `${path} の音声データの大きさが合いません。`);
  return {rate: fmt.rate, channels: fmt.channels, frames: data.size / 2};
}

function upstreamUrl(path, start, end) {
  const prefix = 'vendor/voicestudio/';
  if (!path.startsWith(prefix)) return null;
  return `https://github.com/debpalash/VoiceStudio/blob/${SOURCE_COMMIT}/${path.slice(prefix.length)}#L${start}-L${end}`;
}

// 返った文と参照文の単語の並びの差（表示の目印。返った文は直さない）
export function wordDiff(returned, reference) {
  const x = returned.split(/\s+/).filter(Boolean);
  const y = reference.split(/\s+/).filter(Boolean);
  const table = Array.from({length: x.length + 1}, () => new Uint16Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i -= 1) {
    for (let j = y.length - 1; j >= 0; j -= 1) {
      table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const left = [];
  const right = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      left.push({word: x[i], same: true});
      right.push({word: y[j], same: true});
      i += 1; j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      left.push({word: x[i], same: false});
      i += 1;
    } else {
      right.push({word: y[j], same: false});
      j += 1;
    }
  }
  while (i < x.length) { left.push({word: x[i], same: false}); i += 1; }
  while (j < y.length) { right.push({word: y[j], same: false}); j += 1; }
  return {returned: left, reference: right};
}

function buildData(entries, buffers) {
  const byPath = new Map(entries.map(entry => [entry.path, entry]));
  REQUIRED.forEach(path => need(byPath.has(path), `concept/manifest.json に ${path} がありません。`));
  const texts = new Map();
  const text = path => {
    if (!texts.has(path)) {
      try {
        texts.set(path, utf8.decode(buffers.get(path)));
      } catch (_) {
        throw new ConceptError(`${path} を UTF-8 の文字として読めません。`);
      }
    }
    return texts.get(path);
  };
  const json = path => {
    try {
      return JSON.parse(text(path));
    } catch (error) {
      if (error instanceof ConceptError) throw error;
      throw new ConceptError(`${path} を JSON として読めません。`);
    }
  };

  const facts = json('concept/facts.json');
  const waves = json('concept/waveforms.json');
  const jobsFile = json('inputs/jobs.json');
  const results = json('outputs/attempt-01/results.json');
  const capabilities = json('outputs/attempt-01/capabilities.json');

  need(facts && facts.schema === FACTS_SCHEMA, `concept/facts.json の形式が ${FACTS_SCHEMA} ではありません。`);
  need(facts.source_pin && facts.source_pin.commit === SOURCE_COMMIT && facts.source_pin.version === '0.5.7',
    'concept/facts.json の原典の固定コミットまたは版が違います。');
  need(facts.selected_model && facts.selected_model.repository === 'Systran/faster-whisper-base',
    'concept/facts.json の認識モデルが違います。');
  const calls = facts.cli_invocations || {};
  need(calls.capabilities && calls.capabilities.attempted === 1 && calls.capabilities.succeeded === 1 &&
    calls.transcribe && calls.transcribe.attempted === 3 && calls.transcribe.succeeded === 3,
  'concept/facts.json の原典CLIの呼び出し回数が記録と違います。');
  need(Array.isArray(facts.actual_outputs) && same(facts.actual_outputs.map(item => item && item.id), [...JOB_IDS]),
    'concept/facts.json の3件の ID が default・expressive・second ではありません。');
  need(waves && waves.schema === 'voicestudio-real-input-envelopes@1' && Array.isArray(waves.jobs) &&
    same(waves.jobs.map(item => item && item.id), [...JOB_IDS]), 'concept/waveforms.json の形式または ID が違います。');
  need(jobsFile && Array.isArray(jobsFile.jobs) && same(jobsFile.jobs.map(item => item && item.id), [...JOB_IDS]),
    'inputs/jobs.json の3件の ID が違います。');
  need(results && results.status === 'completed' && Array.isArray(results.jobs) &&
    same(results.jobs.map(item => item && item.id), [...JOB_IDS]) && same(results.cli_invocations, facts.cli_invocations),
  'outputs/attempt-01/results.json が完了の記録として読めません。');
  need(capabilities && capabilities.endpoints && capabilities.endpoints.batch_transcription &&
    capabilities.endpoints.batch_transcription.path === '/v1/audio/transcriptions' && capabilities.service_version === '0.5.7',
  'outputs/attempt-01/capabilities.json のバッチ経路または版が違います。');

  const jobs = {};
  JOB_IDS.forEach((id, index) => {
    const f = facts.actual_outputs[index];
    const w = waves.jobs[index];
    const plan = jobsFile.jobs[index];
    const run = results.jobs[index];
    const wavPath = f.input && f.input.audio;
    need(wavPath === `inputs/audio/${id}.wav`, `${id} の入力 WAV のパスが違います。`);
    const wavEntry = byPath.get(wavPath);
    need(wavEntry.bytes === f.input.bytes && wavEntry.sha256 === f.input.sha256, `${id} の入力 WAV が facts の記録と違います。`);
    need(plan.audio === wavPath && plan.sha256 === f.input.sha256 && plan.bytes === f.input.bytes, `${id} の入力 WAV が inputs/jobs.json と違います。`);
    need(run.input && run.input.sha256 === f.input.sha256 && run.input_unchanged_after_request === true, `${id} の入力が results.json の記録と違います。`);
    const wav = readWav(wavPath, buffers.get(wavPath));
    need(wav.rate === 24000 && wav.frames === f.input.frames && wav.rate === f.input.sample_rate_hz, `${id} の WAV の長さまたはサンプリング周波数が記録と違います。`);
    const seconds = wav.frames / wav.rate;
    need(Math.abs(seconds - f.input.seconds) < 1e-6, `${id} の WAV の秒数が記録と違います。`);

    need(w.source === wavPath && w.source_sha256 === f.input.sha256 && w.frames === wav.frames && w.sample_rate === wav.rate,
      `${id} の振幅の包絡が入力 WAV と対応していません。`);
    need(Array.isArray(w.bins) && w.bins.length === 240, `${id} の振幅の包絡が240区間ではありません。`);
    const bins = w.bins.map((bin, i) => {
      need(bin && bin.frame_start === Math.floor(i * wav.frames / 240) && bin.frame_end_exclusive === Math.floor((i + 1) * wav.frames / 240),
        `${id} の振幅の包絡の${i + 1}区間目が連続していません。`);
      need([bin.min, bin.max, bin.rms].every(Number.isFinite) && bin.min >= -1 && bin.min <= bin.max && bin.max <= 1 && bin.rms >= 0 && bin.rms <= 1,
        `${id} の振幅の包絡の${i + 1}区間目の値が不正です。`);
      return Object.freeze({start: bin.frame_start / wav.rate, min: bin.min, max: bin.max});
    });

    const req = f.request || {};
    need(req.model === 'faster-whisper' && req.language === 'en' && req.response_format === 'verbose_json' &&
      req.reference_sent === false && req.word_timestamps_requested === false, `${id} の要求の条件が記録と違います。`);

    const jsonPath = f.raw_json && f.raw_json.path;
    const txtPath = f.txt_projection && f.txt_projection.path;
    need(jsonPath === `outputs/attempt-01/${id}.json` && txtPath === `outputs/attempt-01/${id}.txt`, `${id} の出力ファイルのパスが違います。`);
    const jsonEntry = byPath.get(jsonPath);
    const txtEntry = byPath.get(txtPath);
    need(jsonEntry.bytes === f.raw_json.bytes && jsonEntry.sha256 === f.raw_json.sha256 && run.raw_output && run.raw_output.sha256 === jsonEntry.sha256,
      `${id}.json が記録と違います。`);
    need(txtEntry.bytes === f.txt_projection.bytes && txtEntry.sha256 === f.txt_projection.sha256 && run.txt_projection && run.txt_projection.sha256 === txtEntry.sha256,
      `${id}.txt が記録と違います。`);
    const rawText = text(jsonPath);
    need(rawText.endsWith('\n') && f.raw_json.ends_with_lf === true, `${id}.json の末尾の改行が記録と違います。`);
    const raw = json(jsonPath);
    need(same(raw, f.response), `${id}.json の中身が facts の返答と一致しません。`);
    need(raw.task === 'transcribe' && raw.language === 'en' && typeof raw.text === 'string' && Array.isArray(raw.segments) && raw.segments.length === 2,
      `${id}.json が2区間の verbose_json ではありません。`);
    need(Math.abs(raw.duration - seconds) < 1e-6, `${id}.json の duration が入力の長さと違います。`);
    let previousEnd = 0;
    const segments = raw.segments.map((seg, i) => {
      need(seg.id === i && Number.isFinite(seg.start) && Number.isFinite(seg.end) && seg.start >= previousEnd - 1e-9 && seg.end > seg.start && seg.end <= raw.duration + 1e-9,
        `${id}.json の${i + 1}区間目の時刻が不正です。`);
      previousEnd = seg.end;
      return Object.freeze({start: seg.start, end: seg.end, text: seg.text});
    });
    need(raw.text === segments.map(seg => seg.text.trim()).join(' '), `${id}.json の全文が区間の文をつないだものと一致しません。`);
    const txtText = text(txtPath);
    need(txtText === `${raw.text}\n`, `${id}.txt が返った text に改行を1つ足したものではありません。`);

    const ref = f.reference || {};
    need(typeof ref.text === 'string' && ref.sent_to_voicestudio === false && plan.reference_text === ref.text,
      `${id} の参照文の記録が違います。`);
    const literal = raw.text === ref.text;
    need(literal === ref.literal_equal_to_returned_text && run.reference && run.reference.literal_equal_to_returned_text === literal,
      `${id} の文字どおりの一致の記録が中身と合いません。`);
    const diff = wordDiff(raw.text, ref.text);
    const digits = diff.returned.filter(token => !token.same && /\d/.test(token.word)).map(token => token.word.replace(/[.,;:!?]+$/, ''));

    jobs[id] = Object.freeze({
      id,
      index,
      wav: Object.freeze({path: wavPath, name: `${id}.wav`, bytes: wavEntry.bytes, sha256: wavEntry.sha256, rate: wav.rate, frames: wav.frames, seconds}),
      bins: Object.freeze(bins),
      response: Object.freeze({task: raw.task, language: raw.language, duration: raw.duration, text: raw.text, segments: Object.freeze(segments)}),
      json: Object.freeze({path: jsonPath, name: `${id}.json`, bytes: jsonEntry.bytes, sha256: jsonEntry.sha256, text: rawText}),
      txt: Object.freeze({path: txtPath, name: `${id}.txt`, bytes: txtEntry.bytes, sha256: txtEntry.sha256, text: txtText}),
      reference: ref.text,
      literal,
      diff,
      digits: Object.freeze(digits),
      elapsed: f.elapsed_s
    });
  });

  need(Array.isArray(facts.excerpts) && same(facts.excerpts.map(item => item && item.id), [...PART_IDS]),
    'concept/facts.json の6つの部品の ID が違います。');
  const parts = facts.excerpts.map(excerpt => {
    need(typeof excerpt.title === 'string' && typeof excerpt.role === 'string' && Array.isArray(excerpt.quotes) && excerpt.quotes.length > 0,
      `concept/facts.json の部品 ${excerpt.id} の形が違います。`);
    const quotes = excerpt.quotes.map(quote => {
      const entry = byPath.get(quote.path);
      need(entry, `引用元 ${quote.path} が確かめる素材に含まれていません。`);
      need(quote.source_sha256 === entry.sha256, `引用元 ${quote.path} の SHA-256 が記録と違います。`);
      const lines = text(quote.path).split('\n');
      need(Number.isInteger(quote.start_line) && Number.isInteger(quote.end_line) && quote.start_line >= 1 &&
        quote.end_line >= quote.start_line && quote.end_line <= lines.length, `${quote.path} の引用の行の範囲が不正です。`);
      need(lines.slice(quote.start_line - 1, quote.end_line).join('\n') === quote.text,
        `${quote.path} の ${quote.start_line}–${quote.end_line} 行目が引用と一致しません。`);
      return Object.freeze({path: quote.path, start: quote.start_line, end: quote.end_line, text: quote.text, url: upstreamUrl(quote.path, quote.start_line, quote.end_line)});
    });
    return Object.freeze({id: excerpt.id, title: excerpt.title, role: excerpt.role, quotes: Object.freeze(quotes)});
  });

  return Object.freeze({
    assets: Object.freeze(entries),
    buffers,
    facts,
    results,
    capabilities,
    jobs: Object.freeze(jobs),
    parts: Object.freeze(parts),
    partById: Object.freeze(Object.fromEntries(parts.map(part => [part.id, part])))
  });
}

export async function loadData({signal, onProgress} = {}) {
  const inner = new AbortController();
  const relay = () => inner.abort();
  if (signal) {
    if (signal.aborted) throw abortError();
    signal.addEventListener('abort', relay, {once: true});
  }
  try {
    const manifestBuffer = await fetchBytes(MANIFEST_PATH, inner.signal);
    const manifestHash = await sha256Hex(manifestBuffer);
    need(manifestHash === MANIFEST_SHA256, 'concept/manifest.json の SHA-256 が固定値と一致しません。');
    let manifest;
    try {
      manifest = JSON.parse(utf8.decode(manifestBuffer));
    } catch (_) {
      throw new ConceptError('concept/manifest.json を JSON として読めません。');
    }
    const entries = checkManifest(manifest);
    const buffers = new Map();
    let done = 0;
    if (onProgress) onProgress(0, entries.length);
    try {
      await eachLimited(entries, 6, async entry => {
        const buffer = await fetchBytes(entry.path, inner.signal);
        need(buffer.byteLength === entry.bytes, `${entry.path} の大きさが記録（${entry.bytes} B）と違います（${buffer.byteLength} B）。`);
        need(await sha256Hex(buffer) === entry.sha256, `${entry.path} の SHA-256 が記録と一致しません。`);
        buffers.set(entry.path, buffer);
        done += 1;
        if (onProgress && !inner.signal.aborted) onProgress(done, entries.length);
      });
    } catch (error) {
      inner.abort();
      throw error;
    }
    if (signal && signal.aborted) throw abortError();
    return buildData(entries, buffers);
  } finally {
    if (signal) signal.removeEventListener('abort', relay);
  }
}

// ---- 場面（閉じた式） ----

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const clamp01 = value => clamp(value, 0, 1);
const smooth = value => value * value * (3 - 2 * value);
const lerp = (a, b, k) => a + (b - a) * k;
const ramp = (t, a, b) => smooth(clamp01((t - a) / (b - a)));
const bump = (t, a, b, fade = 0.6) => ramp(t, a, a + fade) * (1 - ramp(t, b - fade, b));
export const easeStage = smooth;

const NODE_IDS = Object.freeze(['skill', 'request', 'author', 'cli', 'api', 'select', 'model', 'output', 'json', 'txt', 'compare']);
const allOnes = () => Object.fromEntries([...NODE_IDS, 'app', 'ref'].map(id => [id, 1]));

export function sceneAt(seconds, job = 'default') {
  const t = clamp(Number(seconds) || 0, 0, FILM.duration);
  const whole = ramp(t, 27.4, 28.6);
  const show = {
    skill: ramp(t, 0.3, 1.1), request: ramp(t, 0.8, 1.6), author: ramp(t, 4.5, 5.3),
    app: ramp(t, 9, 9.8), cli: ramp(t, 9, 9.8), api: ramp(t, 13.5, 14.2), select: ramp(t, 13.9, 14.6),
    model: ramp(t, 18, 18.8), output: ramp(t, 22.5, 23.2), json: ramp(t, 24.8, 25.5), txt: ramp(t, 25.1, 25.8),
    compare: ramp(t, 25.4, 26.1), ref: 1
  };
  // Operator readability correction: keep the whole structural map visible; focus and the same carriers explain each handoff.
  Object.keys(show).forEach(key => { show[key] = 1; });
  const focus = {
    skill: bump(t, 0, 7), request: bump(t, 0.6, 7), author: bump(t, 4.5, 12), cli: bump(t, 9, 15.4),
    api: bump(t, 13.5, 17.2), select: bump(t, 15.4, 20.2), model: bump(t, 18, 24.2),
    output: ramp(t, 22.6, 23.4), json: ramp(t, 24.8, 25.6), txt: ramp(t, 25.1, 25.9), compare: ramp(t, 25.4, 26.4),
    ref: ramp(t, 25.4, 26.4), app: bump(t, 9, 18.6)
  };
  Object.keys(focus).forEach(key => { focus[key] = Math.max(focus[key], whole); });
  const scene = SCENES.find(item => t >= item.start && t < item.end) || SCENES[SCENES.length - 1];
  const last = scene.index === SCENES.length;
  const captionAlpha = (scene.index === 1 ? 1 : ramp(t, scene.start, scene.start + 0.45)) * (last ? 1 : 1 - ramp(t, scene.end - 0.3, scene.end));
  return {
    t,
    job,
    show,
    focus,
    carrier: {
      at: ramp(t, 5, 6.5) + ramp(t, 9.6, 11) + ramp(t, 13.8, 15) + ramp(t, 15.6, 16.9) + ramp(t, 18.6, 20) + ramp(t, 22.6, 23.7),
      kind: ramp(t, 6.6, 7.6) + ramp(t, 11, 12.2) + ramp(t, 20.2, 21.4),
      alpha: 1 - ramp(t, 23.7, 24.1)
    },
    outWave: ramp(t, 23.7, 24.1),
    split: ramp(t, 24.1, 25.3),
    refDraw: ramp(t, 25.4, 26.8),
    verdict: ramp(t, 26.6, 27.3),
    foot: {input: 1 - ramp(t, 22.6, 23.3), text: ramp(t, 23.3, 24) * (1 - ramp(t, 27.2, 27.8)), summary: ramp(t, 27.8, 29)},
    caption: {index: scene.index, title: scene.title, sub: scene.sub, alpha: captionAlpha},
    playhead: null,
    activeSegment: -1
  };
}

export function stageScene(stage, job = 'default') {
  const s = clamp(Math.round(Number(stage) || 0), 0, 2);
  const focusSets = [
    {skill: 1, request: 0.6, author: 0.6, app: 1, cli: 1, api: 1, select: 1, model: 1, output: 1, json: 0.35, txt: 0.35, compare: 0.35, ref: 0.45},
    {skill: 0.45, request: 1, author: 1, app: 1, cli: 1, api: 1, select: 0.4, model: 0.4, output: 0.25, json: 0.25, txt: 0.25, compare: 0.3, ref: 1},
    {skill: 0.3, request: 0.3, author: 0.3, app: 0.45, cli: 0.35, api: 0.35, select: 0.45, model: 1, output: 1, json: 1, txt: 1, compare: 1, ref: 1}
  ];
  const carriers = [
    {at: 0, kind: 0, alpha: 1},
    {at: 3, kind: 2, alpha: 1},
    {at: 6, kind: 3, alpha: 0}
  ];
  return {
    t: null,
    job,
    show: allOnes(),
    focus: {...focusSets[s]},
    carrier: {...carriers[s]},
    outWave: s === 2 ? 1 : 0,
    split: s === 2 ? 1 : 0,
    refDraw: 1,
    verdict: s === 2 ? 1 : 0,
    foot: {input: 0, text: 0, summary: 0},
    caption: null,
    playhead: null,
    activeSegment: -1
  };
}

export function mixScene(a, b, k) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const out = {};
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach(key => {
      out[key] = key in a && key in b ? mixScene(a[key], b[key], k) : (k < 0.5 ? a[key] : b[key]);
    });
    return out;
  }
  return k < 0.5 ? a : b;
}

// ---- 配置 ----

const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic UI","Yu Gothic","Meiryo",system-ui,sans-serif';
const SERIF = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","BIZ UDPMincho",serif';

function fontsFor(u, film) {
  return {
    label: Math.max(14, Math.round(15 * u)),
    sub: Math.max(14, Math.round(13.5 * u)),
    small: Math.max(film ? 12 : 14, Math.round(12 * u))
  };
}

const badgeRadius = u => Math.max(10, Math.round(9 * u));
const centerOf = r => [r.x + r.w / 2, r.y + r.h / 2];

function sideNode(n, fraction, u, numbered) {
  const r = badgeRadius(u);
  const inner = Math.round(5 * u);
  const sw = Math.round(n.w * fraction);
  n.slot = {x: n.x + n.w - sw, y: n.y + inner, w: sw - inner, h: n.h - 2 * inner};
  const lx = n.x + (numbered ? r + Math.round(5 * u) : Math.round(8 * u));
  n.label = {x: lx, y: n.y, w: n.slot.x - lx - inner, h: n.h};
  n.badge = numbered ? {x: n.x, y: n.y + n.h / 2, r} : null;
  return n;
}

function stackNode(n, u, fs, numbered) {
  const r = badgeRadius(u);
  const inner = Math.round(6 * u);
  const lh = fs.label + fs.sub + Math.round(10 * u);
  const lx = n.x + (numbered ? r + Math.round(5 * u) : Math.round(8 * u));
  n.label = {x: lx, y: n.y + Math.round(2 * u), w: n.x + n.w - inner - lx, h: lh};
  const sy = n.label.y + lh + Math.round(2 * u);
  n.slot = {x: n.x + inner, y: sy, w: n.w - 2 * inner, h: n.y + n.h - inner - sy};
  n.badge = numbered ? {x: n.x, y: n.label.y + lh / 2, r} : null;
  return n;
}

function plainNode(n, u, numbered) {
  const r = badgeRadius(u);
  const lx = n.x + (numbered ? r + Math.round(5 * u) : Math.round(8 * u));
  n.label = {x: lx, y: n.y, w: n.x + n.w - Math.round(6 * u) - lx, h: n.h};
  n.slot = null;
  n.badge = numbered ? {x: n.x, y: n.y + n.h / 2, r} : null;
  return n;
}

function outputNode(n, u, fs) {
  const r = badgeRadius(u);
  const inner = Math.round(6 * u);
  const strip = fs.sub + Math.round(8 * u);
  const timesH = fs.small + Math.round(4 * u);
  const lx = n.x + r + Math.round(5 * u);
  n.label = {x: lx, y: n.y + Math.round(2 * u), w: n.x + n.w - inner - lx, h: strip};
  n.times = {x: n.x + inner, y: n.y + n.h - inner - timesH, w: n.w - 2 * inner, h: timesH};
  const wy = n.label.y + strip;
  n.wave = {x: n.x + inner + Math.round(4 * u), y: wy, w: n.w - 2 * inner - Math.round(8 * u), h: n.times.y - wy - Math.round(2 * u)};
  n.slot = n.wave;
  n.badge = {x: n.x, y: n.label.y + strip / 2, r};
  return n;
}

const halfOf = (r, side, gap) => {
  const w = (r.w - gap) / 2;
  return {x: r.x + side * (w + gap), y: r.y, w, h: r.h};
};

function layoutTall(W, H, film) {
  const u = film ? W / 360 : clamp(W / 360, 0.88, 1.2);
  const fs = fontsFor(u, film);
  const r = badgeRadius(u);
  const pad = Math.round(8 * u);
  const captionH = film ? Math.round(H * 0.11) : 0;
  const footerH = film ? Math.round(H * 0.155) : 0;
  const gutter = Math.max(26, Math.round(24 * u));
  const left = Math.max(pad, r + 4);
  const right = W - gutter;
  const top = pad + captionH;
  const bottom = H - pad - footerH;
  const gap = Math.max(10, Math.round(11 * u));
  const tab = fs.sub + Math.round(10 * u);
  const inset = Math.round(7 * u);
  const weights = [1, 1, 1, 1, 1, 1, 2, 1];
  const unit = (bottom - top - tab - inset - gap * (weights.length - 1)) / weights.reduce((sum, v) => sum + v, 0);
  const rows = [];
  let y = top;
  weights.forEach((weight, i) => {
    if (i === 2) y += tab;
    if (i === 5) y += inset;
    rows.push({y, h: unit * weight});
    y += unit * weight + gap;
  });
  const span = (row, x0, x1) => ({x: x0, y: rows[row].y, w: x1 - x0, h: rows[row].h});
  const halfW = (right - left - gap) / 2;
  const slotF = W < 330 ? 0.38 : 0.42;
  const N = {};
  N.skill = sideNode(span(0, left, left + halfW), W < 330 ? 0.28 : 0.34, u, true);
  N.request = sideNode(span(0, right - halfW, right), W < 330 ? 0.28 : 0.34, u, false);
  N.author = sideNode(span(1, left, right), slotF, u, false);
  N.cli = sideNode(span(2, left + inset, right - inset), slotF, u, true);
  N.api = sideNode(span(3, left + inset, right - inset), slotF, u, true);
  N.select = sideNode(span(4, left + inset, right - inset), slotF, u, true);
  N.model = sideNode(span(5, left, right), slotF, u, true);
  N.output = outputNode(span(6, left, right), u, fs);
  const jw = Math.round((right - left - 2 * gap) * 0.24);
  N.json = plainNode(span(7, left, left + jw), u, false);
  N.txt = plainNode(span(7, left + jw + gap, left + 2 * jw + gap), u, false);
  N.compare = plainNode(span(7, left + 2 * (jw + gap), right), u, false);
  const app = {x: left, y: rows[2].y - tab, w: right - left, h: rows[4].y + rows[4].h + inset - (rows[2].y - tab)};

  const colX = left + (right - left) * 0.24;
  const down = (a, x, yEnd) => [[x, a.y + a.h], [x, yEnd]];
  const cy = n => n.y + n.h / 2;
  const edges = [
    {from: 'skill', to: 'author', pts: down(N.skill, N.skill.x + N.skill.w / 2, N.author.y)},
    {from: 'request', to: 'author', pts: down(N.request, N.request.x + N.request.w / 2, N.author.y)},
    {from: 'author', to: 'cli', pts: down(N.author, colX, app.y)},
    {from: 'cli', to: 'api', pts: down(N.cli, colX, N.api.y)},
    {from: 'api', to: 'select', pts: down(N.api, colX, N.select.y)},
    {from: 'select', to: 'model', pts: down(N.select, colX, N.model.y)},
    {from: 'model', to: 'output', pts: down(N.model, colX, N.output.y)},
    {from: 'output', to: 'json', pts: down(N.output, N.json.x + N.json.w / 2, N.json.y)},
    {from: 'json', to: 'txt', pts: [[N.json.x + N.json.w, cy(N.json)], [N.txt.x, cy(N.txt)]]},
    {from: 'txt', to: 'compare', pts: [[N.txt.x + N.txt.w, cy(N.txt)], [N.compare.x, cy(N.compare)]]}
  ];
  const gx = right + gutter / 2;
  const ref = [[N.request.x + N.request.w, cy(N.request)], [gx, cy(N.request)], [gx, cy(N.compare)], [N.compare.x + N.compare.w, cy(N.compare)]];

  const sc = n => centerOf(n.slot);
  const turnY = N.output.y - gap / 2;
  const [mx, my] = sc(N.model);
  const [wx, wy] = centerOf(N.output.wave);
  const carrier = {
    paper: {from: N.skill.slot, to: halfOf(N.author.slot, 0, Math.round(4 * u))},
    card: {from: N.request.slot, to: halfOf(N.author.slot, 1, Math.round(4 * u))},
    slots: [null, N.author.slot, N.cli.slot, N.api.slot, N.select.slot, N.model.slot, N.output.wave],
    paths: [null, [sc(N.author), sc(N.cli)], [sc(N.cli), sc(N.api)], [sc(N.api), sc(N.select)], [sc(N.select), sc(N.model)],
      [[mx, my], [mx, turnY], [wx, turnY], [wx, wy]]]
  };
  return {
    wide: false, film, W, H, u, fs, nodes: N, app, edges, ref, refLabel: {x: gx, y: app.y + app.h / 2}, carrier,
    caption: film ? {x: pad * 2, y: pad, w: W - pad * 4, h: captionH} : null,
    footer: film ? {x: pad * 2, y: H - pad - footerH + Math.round(6 * u), w: W - pad * 4, h: footerH - Math.round(6 * u)} : null
  };
}

function layoutWide(W, H, film) {
  const u = film ? H / 430 : clamp(H / 400, 1, 1.2);
  const fs = fontsFor(u, film);
  const r = badgeRadius(u);
  const pad = Math.round(10 * u);
  const captionH = film ? Math.round(H * 0.15) : 0;
  const footerH = film ? Math.round(H * 0.14) : 0;
  const gutter = Math.max(30, Math.round(28 * u));
  const left = Math.max(pad, r + 4);
  const right = W - gutter;
  const top = pad + captionH;
  const bottom = H - pad - footerH;
  const gapX = Math.round(24 * u);
  const tab = fs.sub + Math.round(10 * u);
  const inset = Math.round(8 * u);
  const g12 = tab + Math.round(22 * u);
  const g23 = Math.round(26 * u) + inset;
  const unit = (bottom - top - g12 - g23) / 3.1;
  const r1 = {y: top, h: unit * 0.85};
  const r2 = {y: r1.y + r1.h + g12, h: unit * 1.15};
  const r3 = {y: r2.y + r2.h + g23, h: unit * 1.1};
  const third = (right - left - 2 * gapX) / 3;
  const col = (right - left - 3 * gapX) / 4;
  const cx0 = i => left + i * (col + gapX);
  const N = {};
  N.skill = sideNode({x: left, y: r1.y, w: third, h: r1.h}, 0.36, u, true);
  N.author = sideNode({x: left + third + gapX, y: r1.y, w: third, h: r1.h}, 0.36, u, false);
  N.request = sideNode({x: left + 2 * (third + gapX), y: r1.y, w: third, h: r1.h}, 0.36, u, false);
  N.cli = stackNode({x: cx0(0) + inset, y: r2.y, w: col - inset, h: r2.h}, u, fs, true);
  N.api = stackNode({x: cx0(1), y: r2.y, w: col, h: r2.h}, u, fs, true);
  N.select = stackNode({x: cx0(2), y: r2.y, w: col - inset, h: r2.h}, u, fs, true);
  N.model = stackNode({x: cx0(3), y: r2.y, w: col, h: r2.h}, u, fs, true);
  N.output = outputNode({x: left, y: r3.y, w: 2 * col + gapX, h: r3.h}, u, fs);
  const gapY = Math.round(12 * u);
  const half = (r3.h - gapY) / 2;
  N.json = plainNode({x: cx0(2), y: r3.y, w: col, h: half}, u, false);
  N.txt = plainNode({x: cx0(2), y: r3.y + half + gapY, w: col, h: half}, u, false);
  N.compare = plainNode({x: cx0(3), y: r3.y, w: col, h: r3.h}, u, false);
  const app = {x: left, y: r2.y - tab, w: cx0(2) + col - left, h: r2.h + tab + inset};

  const cx = n => n.x + n.w / 2;
  const cy = n => n.y + n.h / 2;
  const across = (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]];
  const midY12 = r1.y + r1.h + (g12 - tab) / 2;
  const midY23 = r2.y + r2.h + inset + (g23 - inset) / 2;
  const edges = [
    {from: 'skill', to: 'author', pts: across(N.skill, N.author)},
    {from: 'request', to: 'author', pts: [[N.request.x, cy(N.request)], [N.author.x + N.author.w, cy(N.author)]]},
    {from: 'author', to: 'cli', pts: [[cx(N.author), N.author.y + N.author.h], [cx(N.author), midY12], [cx(N.cli), midY12], [cx(N.cli), app.y]]},
    {from: 'cli', to: 'api', pts: across(N.cli, N.api)},
    {from: 'api', to: 'select', pts: across(N.api, N.select)},
    {from: 'select', to: 'model', pts: across(N.select, N.model)},
    {from: 'model', to: 'output', pts: [[cx(N.model), N.model.y + N.model.h], [cx(N.model), midY23], [cx(N.output), midY23], [cx(N.output), N.output.y]]},
    {from: 'output', to: 'json', pts: [[N.output.x + N.output.w, cy(N.json)], [N.json.x, cy(N.json)]]},
    {from: 'json', to: 'txt', pts: [[cx(N.json), N.json.y + N.json.h], [cx(N.json), N.txt.y]]},
    {from: 'txt', to: 'compare', pts: [[N.txt.x + N.txt.w, cy(N.txt)], [N.compare.x, cy(N.txt)]]}
  ];
  const gx = right + gutter / 2;
  const ref = [[N.request.x + N.request.w, cy(N.request)], [gx, cy(N.request)], [gx, cy(N.compare)], [N.compare.x + N.compare.w, cy(N.compare)]];

  const sc = n => centerOf(n.slot);
  const [ax, ay] = sc(N.author);
  const [kx, ky] = sc(N.cli);
  const [mx, my] = sc(N.model);
  const [wx, wy] = centerOf(N.output.wave);
  const carrier = {
    paper: {from: N.skill.slot, to: halfOf(N.author.slot, 0, Math.round(4 * u))},
    card: {from: N.request.slot, to: halfOf(N.author.slot, 1, Math.round(4 * u))},
    slots: [null, N.author.slot, N.cli.slot, N.api.slot, N.select.slot, N.model.slot, N.output.wave],
    paths: [null, [[ax, ay], [ax, midY12], [kx, midY12], [kx, ky]], [sc(N.cli), sc(N.api)], [sc(N.api), sc(N.select)], [sc(N.select), sc(N.model)],
      [[mx, my], [mx, midY23], [wx, midY23], [wx, wy]]]
  };
  return {
    wide: true, film, W, H, u, fs, nodes: N, app, edges, ref, refLabel: {x: gx, y: app.y + app.h / 2}, carrier,
    caption: film ? {x: pad * 2, y: pad, w: W - pad * 4, h: captionH} : null,
    footer: film ? {x: pad * 2, y: H - pad - footerH + Math.round(4 * u), w: W - pad * 4, h: footerH - Math.round(4 * u)} : null
  };
}

export function layoutConcept(width, height, {film = false} = {}) {
  return width > height * 1.15 ? layoutWide(width, height, film) : layoutTall(width, height, film);
}

// 作例ページの図の高さ（幅に合わせる）。720px 以上は横の配置。
export function preferredHeight(width) {
  if (width >= 720) return clamp(Math.round(width * 0.54), 420, 640);
  return width < 420 ? 430 : Math.max(470, Math.round(width * 1.5));
}

// ---- 色 ----

export const PALETTES = Object.freeze({
  paper: Object.freeze({
    bg: '#f2eee5', card: '#fbf9f4', ink: '#1b1915', muted: '#575146', line: '#7d7466', faint: '#cbc2b1', accent: '#b3401f', onBadge: '#ffffff',
    wave: '#3b362d', seg: ['#b3401f', '#2b4876'], ref: '#6b4a8a',
    tones: {
      base: {fill: '#fbf9f4', line: '#6d6557'}, author: {fill: '#f2e3c3', line: '#8a6214'}, app: {fill: '#e1e7f1', line: '#2b4876'},
      model: {fill: '#deeadf', line: '#2c6342'}, out: {fill: '#fbf9f4', line: '#1b1915'}, ref: {fill: '#efe6f3', line: '#6b4a8a'}
    }
  }),
  ink: Object.freeze({
    bg: '#15140f', card: '#1f1d17', ink: '#efe9dd', muted: '#bfb7a8', line: '#9a917f', faint: '#4d483e', accent: '#ef8160', onBadge: '#15140f',
    wave: '#d9d1c2', seg: ['#ef8160', '#93b3e8'], ref: '#c6a6e6',
    tones: {
      base: {fill: '#1f1d17', line: '#a39a88'}, author: {fill: '#3a2f17', line: '#dcb15c'}, app: {fill: '#1b2638', line: '#93b3e8'},
      model: {fill: '#17291e', line: '#82c99d'}, out: {fill: '#1f1d17', line: '#efe9dd'}, ref: {fill: '#2a2133', line: '#c6a6e6'}
    }
  })
});

const NODE_TONE = Object.freeze({skill: 'base', request: 'base', author: 'author', cli: 'app', api: 'app', select: 'app', model: 'model', output: 'out', json: 'out', txt: 'out', compare: 'ref'});
const NODE_TEXT = Object.freeze({
  skill: ['手順書', ['SKILL.md']],
  request: ['依頼', ['WAVの場所', 'WAV']],
  author: ['作者AI（1体）', ['クライアントを書く', 'コードを書く']],
  cli: ['担当者が実行', ['原典CLI']],
  api: ['ローカルAPI', ['127.0.0.1:3900']],
  select: ['選択と準備', ['条件・導入を確認', '条件と導入']],
  model: ['認識モデル（別）', ['faster-whisper-base']],
  output: ['返った推定区間', ['']]
});

export const fmtSeconds = value => Number(value).toFixed(2);
export const groupDigits = value => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function verdictText(job, short = false) {
  if (job.literal) return short ? '文字どおり一致' : '参照文と文字どおり一致';
  const digits = job.digits.length ? `（${job.digits.join('・')}）` : '';
  return short ? '文字どおり不一致' : `文字どおり不一致${digits}`;
}

function nodeText(id, job, scene) {
  if (id === 'json') return ['JSON', [`${groupDigits(job.json.bytes)} B`]];
  if (id === 'txt') return ['TXT', [`${groupDigits(job.txt.bytes)} B`]];
  if (id === 'compare') {
    if (scene.verdict > 0.5) return ['参照文と照合', job.literal ? ['文字どおり一致', '一致'] : ['文字どおり不一致', '不一致']];
    return ['参照文と照合', ['最後に比べる', 'あとで']];
  }
  return NODE_TEXT[id];
}

// ---- 描画の部品 ----

const font = (size, weight = 400, family = SANS) => `${weight} ${size}px ${family}`;

function roundPath(ctx, r, radius) {
  const q = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
  ctx.beginPath();
  ctx.moveTo(r.x + q, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, q);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, q);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, q);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, q);
  ctx.closePath();
}

function pickFit(ctx, variants, maxWidth) {
  for (const variant of variants) if (ctx.measureText(variant).width <= maxWidth) return variant;
  return variants[variants.length - 1];
}

function writeText(ctx, str, x, y, maxWidth) {
  if (maxWidth && maxWidth > 0) ctx.fillText(str, x, y, maxWidth);
  else ctx.fillText(str, x, y);
}

function polyLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

function slicePoly(pts, fraction) {
  const goal = clamp01(fraction) * polyLength(pts);
  const out = [pts[0]];
  let walked = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (walked + seg >= goal) {
      const k = seg ? (goal - walked) / seg : 1;
      out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]);
      return out;
    }
    walked += seg;
    out.push(pts[i]);
  }
  return out;
}

function pointOn(pts, fraction) {
  const part = slicePoly(pts, fraction);
  return part[part.length - 1];
}

function strokeArrow(ctx, pts, color, width, head, dash = null) {
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (!head) return;
  const [x1, y1] = pts[pts.length - 1];
  const [x0, y0] = pts[pts.length - 2];
  const angle = Math.atan2(y1 - y0, x1 - x0);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - 0.48), y1 - head * Math.sin(angle - 0.48));
  ctx.lineTo(x1 - head * Math.cos(angle + 0.48), y1 - head * Math.sin(angle + 0.48));
  ctx.closePath();
  ctx.fill();
}

const value = (map, key, fallback) => (map && Number.isFinite(map[key]) ? map[key] : fallback);

// 実際の PCM16 の min/max 包絡を描く。split で2つの推定区間に分かれる（区間外は薄く残す）。
function drawWave(ctx, rect, job, P, u, {split = 0, playhead = null, active = -1, alpha = 1} = {}) {
  if (rect.w <= 2 || rect.h <= 2) return;
  const dur = job.wav.seconds;
  const segs = job.response.segments;
  const boundary = segs[1].start;
  const gapPx = Math.min(16 * u, rect.w * 0.05) * split;
  const span = rect.w - gapPx;
  const segOf = t => segs.findIndex(seg => t >= seg.start - 1e-9 && t < seg.end - 1e-9);
  const xAt = (t, side) => rect.x + (t / dur) * span + (side === 1 ? gapPx : 0);
  const mid = rect.y + rect.h / 2;
  const half = rect.h / 2 * 0.94;
  const barW = Math.max(1, (span / job.bins.length) * 0.78);
  const passes = split > 0 ? [[1 - split, 'plain'], [split, 'seg']] : [[1, 'plain']];
  passes.forEach(([weight, mode]) => {
    if (weight <= 0.001) return;
    job.bins.forEach(bin => {
      const seg = segOf(bin.start);
      const side = bin.start >= boundary - 1e-9 ? 1 : 0;
      let color = P.wave;
      let k = 1;
      if (mode === 'seg') {
        if (seg >= 0) color = P.seg[seg];
        else { color = P.faint; k = 0.9; }
      }
      ctx.globalAlpha = alpha * weight * k;
      ctx.fillStyle = color;
      const top = mid - bin.max * half;
      const bottom = mid - bin.min * half;
      ctx.fillRect(xAt(bin.start, side), top, barW, Math.max(1, bottom - top));
    });
  });
  if (split > 0) {
    segs.forEach((seg, i) => {
      const x0 = xAt(seg.start, i);
      const x1 = xAt(seg.end, i);
      const box = {x: x0, y: rect.y - 2 * u, w: Math.max(2, x1 - x0), h: rect.h + 4 * u};
      roundPath(ctx, box, 4 * u);
      if (i === active) {
        ctx.globalAlpha = alpha * split * 0.14;
        ctx.fillStyle = P.seg[i];
        ctx.fill();
      }
      ctx.globalAlpha = alpha * split;
      ctx.strokeStyle = P.seg[i];
      ctx.lineWidth = (i === active ? 2.6 : 1.4) * u;
      ctx.stroke();
    });
  }
  if (Number.isFinite(playhead)) {
    const t = clamp(playhead, 0, dur);
    const x = xAt(t, t >= boundary ? 1 : 0);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = Math.max(1.5, 2 * u);
    ctx.beginPath();
    ctx.moveTo(x, rect.y - 3 * u);
    ctx.lineTo(x, rect.y + rect.h + 3 * u);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
}

function drawPaper(ctx, r, P, u, alpha) {
  if (alpha <= 0.002) return;
  const w = Math.min(r.w, r.h * 0.82);
  const box = {x: r.x + (r.w - w) / 2, y: r.y, w, h: r.h};
  const fold = Math.min(box.w, box.h) * 0.26;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = P.card;
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = Math.max(1, 1.3 * u);
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x + box.w - fold, box.y);
  ctx.lineTo(box.x + box.w, box.y + fold);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = P.line;
  const lines = 4;
  for (let i = 0; i < lines; i += 1) {
    const ly = box.y + box.h * (0.3 + i * 0.16);
    ctx.fillRect(box.x + box.w * 0.16, ly, box.w * (i === lines - 1 ? 0.42 : 0.66), Math.max(1, 1.4 * u));
  }
}

function drawCard(ctx, r, job, P, u, alpha) {
  if (alpha <= 0.002) return;
  ctx.globalAlpha = alpha;
  roundPath(ctx, r, 4 * u);
  ctx.fillStyle = P.card;
  ctx.fill();
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = Math.max(1, 1.3 * u);
  ctx.stroke();
  const inner = {x: r.x + r.w * 0.1, y: r.y + r.h * 0.18, w: r.w * 0.8, h: r.h * 0.64};
  drawWave(ctx, inner, job, P, u, {alpha});
}

function drawScript(ctx, r, P, u, fs, alpha) {
  if (alpha <= 0.002) return;
  ctx.globalAlpha = alpha;
  roundPath(ctx, r, 4 * u);
  ctx.fillStyle = P.card;
  ctx.fill();
  ctx.strokeStyle = P.tones.author.line;
  ctx.lineWidth = Math.max(1.2, 1.6 * u);
  ctx.stroke();
  ctx.save();
  roundPath(ctx, r, 4 * u);
  ctx.clip();
  ctx.font = font(fs.sub, 600, SANS);
  ctx.fillStyle = P.ink;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const label = 'run_example.py';
  if (ctx.measureText(label).width <= r.w - 8 * u && r.h >= fs.sub + 4) {
    writeText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, r.w - 8 * u);
  } else {
    ctx.fillStyle = P.line;
    for (let i = 0; i < 3; i += 1) ctx.fillRect(r.x + r.w * 0.14, r.y + r.h * (0.3 + i * 0.2), r.w * (0.5 + (i % 2) * 0.2), Math.max(1, 1.4 * u));
  }
  ctx.restore();
}

function drawEnvelope(ctx, r, job, P, u, fs, alpha) {
  if (alpha <= 0.002) return;
  ctx.globalAlpha = alpha;
  roundPath(ctx, r, 4 * u);
  ctx.fillStyle = P.card;
  ctx.fill();
  ctx.strokeStyle = P.tones.app.line;
  ctx.lineWidth = Math.max(1.2, 1.6 * u);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r.x + 3 * u, r.y + 3 * u);
  ctx.lineTo(r.x + r.w / 2, r.y + r.h * 0.34);
  ctx.lineTo(r.x + r.w - 3 * u, r.y + 3 * u);
  ctx.lineWidth = Math.max(1, 1.1 * u);
  ctx.stroke();
  ctx.font = font(fs.sub, 600, SANS);
  const word = 'WAV＋条件';
  const tw = ctx.measureText(word).width;
  const room = r.w - 12 * u;
  if (tw + 34 * u <= room && r.h >= fs.sub + 10 * u) {
    const wave = {x: r.x + 6 * u, y: r.y + r.h * 0.42, w: room - tw - 8 * u, h: r.h * 0.5};
    drawWave(ctx, wave, job, P, u, {alpha});
    ctx.globalAlpha = alpha;
    ctx.fillStyle = P.ink;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    writeText(ctx, word, r.x + r.w - 6 * u, r.y + r.h * 0.67);
  } else {
    drawWave(ctx, {x: r.x + 6 * u, y: r.y + r.h * 0.4, w: r.w - 12 * u, h: r.h * 0.52}, job, P, u, {alpha});
  }
}

function drawBadge(ctx, badge, number, color, P) {
  if (!badge) return;
  ctx.beginPath();
  ctx.arc(badge.x, badge.y, badge.r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = P.onBadge;
  ctx.font = font(Math.max(14, Math.round(badge.r * 1.25)), 700, SANS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), badge.x, badge.y + 0.5);
}

function drawLabel(ctx, box, title, subs, fs, P, single = false) {
  ctx.fillStyle = P.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = font(fs.label, 700, SANS);
  const hasSub = !single && subs && subs[0];
  const lead = Math.round(fs.sub * 0.2);
  const blockH = hasSub ? fs.label + lead + fs.sub : fs.label;
  const y0 = box.y + (box.h - blockH) / 2;
  writeText(ctx, title, box.x, y0, box.w);
  if (hasSub) {
    ctx.font = font(fs.sub, 400, SANS);
    ctx.fillStyle = P.muted;
    writeText(ctx, pickFit(ctx, subs, box.w), box.x, y0 + fs.label + lead, box.w);
  }
}

function drawNode(ctx, L, P, id, scene, job, part) {
  const n = L.nodes[id];
  const shown = value(scene.show, id, 1);
  if (shown <= 0.002) return;
  const f = value(scene.focus, id, 0);
  const tone = P.tones[NODE_TONE[id]];
  const u = L.u;
  const selected = part && PART_NODE[part] === id;
  ctx.save();
  ctx.globalAlpha = shown;
  roundPath(ctx, n, 8 * u);
  ctx.fillStyle = P.card;
  ctx.fill();
  ctx.globalAlpha = shown * (0.4 + 0.6 * f);
  ctx.fillStyle = tone.fill;
  ctx.fill();
  ctx.globalAlpha = shown;
  ctx.lineWidth = Math.max(1, (1.1 + 1.4 * f) * u);
  ctx.strokeStyle = tone.line;
  if (id === 'model') ctx.setLineDash([6 * u, 4 * u]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (selected) {
    roundPath(ctx, {x: n.x - 4 * u, y: n.y - 4 * u, w: n.w + 8 * u, h: n.h + 8 * u}, 11 * u);
    ctx.lineWidth = Math.max(2, 2.6 * u);
    ctx.strokeStyle = P.accent;
    ctx.stroke();
  }
  if ((id === 'skill' || id === 'request') && n.slot) {
    roundPath(ctx, n.slot, 4 * u);
    ctx.setLineDash([3 * u, 3 * u]);
    ctx.lineWidth = Math.max(1, u);
    ctx.strokeStyle = P.faint;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const [title, subs] = nodeText(id, job, scene);
  drawLabel(ctx, n.label, title, subs, L.fs, P, id === 'output');
  const partId = NODE_PART[id];
  if (partId) drawBadge(ctx, n.badge, PART_NUMBER[partId], selected ? P.accent : tone.line, P);
  ctx.restore();
}

function drawApp(ctx, L, P, scene) {
  const shown = value(scene.show, 'app', 1);
  if (shown <= 0.002) return;
  const f = value(scene.focus, 'app', 0);
  const u = L.u;
  const tone = P.tones.app;
  ctx.save();
  ctx.globalAlpha = shown;
  roundPath(ctx, L.app, 12 * u);
  ctx.globalAlpha = shown * (0.28 + 0.3 * f);
  ctx.fillStyle = tone.fill;
  ctx.fill();
  ctx.globalAlpha = shown;
  ctx.lineWidth = Math.max(1, (1.2 + f) * u);
  ctx.strokeStyle = tone.line;
  ctx.stroke();
  ctx.font = font(L.fs.sub, 700, SANS);
  ctx.fillStyle = tone.line;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const tabH = L.fs.sub + Math.round(10 * u);
  const label = pickFit(ctx, ['VoiceStudio（原典・手元）', 'VoiceStudio'], L.app.w - 20 * u);
  writeText(ctx, label, L.app.x + 10 * u, L.app.y + tabH / 2 + 1, L.app.w - 20 * u);
  ctx.restore();
}

function drawEdges(ctx, L, P, scene) {
  const u = L.u;
  ctx.save();
  L.edges.forEach(edge => {
    const shown = Math.min(value(scene.show, edge.from, 1), value(scene.show, edge.to, 1));
    if (shown <= 0.002) return;
    const f = (value(scene.focus, edge.from, 0) + value(scene.focus, edge.to, 0)) / 2;
    ctx.globalAlpha = shown * (0.55 + 0.45 * f);
    strokeArrow(ctx, edge.pts, f > 0.5 ? P.ink : P.line, Math.max(1.2, (1.2 + f) * u), Math.max(6, 6 * u));
  });
  ctx.restore();
}

function drawRef(ctx, L, P, scene) {
  const draw = value(scene, 'refDraw', 0);
  const shown = value(scene.show, 'request', 1);
  if (draw <= 0.002 || shown <= 0.002) return;
  const u = L.u;
  const f = value(scene.focus, 'ref', 0);
  ctx.save();
  ctx.globalAlpha = shown * (0.55 + 0.45 * f);
  const pts = slicePoly(L.ref, draw);
  strokeArrow(ctx, pts, P.ref, Math.max(1.2, (1.2 + f) * u), draw > 0.98 ? Math.max(6, 6 * u) : 0, [5 * u, 4 * u]);
  const chars = Array.from('参照文は送らない');
  const size = L.fs.small;
  const step = size * 1.08;
  const y0 = L.refLabel.y - (chars.length * step) / 2;
  ctx.globalAlpha = shown * Math.min(1, draw * 1.6);
  ctx.fillStyle = P.bg;
  ctx.fillRect(L.refLabel.x - size * 0.62, y0 - 3 * u, size * 1.24, chars.length * step + 6 * u);
  ctx.fillStyle = P.ref;
  ctx.font = font(size, 700, SANS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  chars.forEach((ch, i) => ctx.fillText(ch, L.refLabel.x, y0 + i * step));
  ctx.restore();
}

function drawOutput(ctx, L, P, scene, job) {
  const n = L.nodes.output;
  const shown = value(scene.show, 'output', 1);
  if (shown <= 0.002) return;
  const u = L.u;
  const outWave = value(scene, 'outWave', 0);
  const split = value(scene, 'split', 0);
  ctx.save();
  if (outWave < 1) {
    ctx.globalAlpha = shown * (1 - outWave);
    roundPath(ctx, n.wave, 4 * u);
    ctx.setLineDash([4 * u, 4 * u]);
    ctx.lineWidth = Math.max(1, u);
    ctx.strokeStyle = P.line;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = font(L.fs.small, 400, SANS);
    ctx.fillStyle = P.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const note = pickFit(ctx, ['ここに推定区間と全文が返る', '区間と全文が返る'], n.wave.w - 12 * u);
    writeText(ctx, note, n.wave.x + n.wave.w / 2, n.wave.y + n.wave.h / 2, n.wave.w - 12 * u);
  }
  if (outWave > 0) {
    drawWave(ctx, n.wave, job, P, u, {split, playhead: scene.playhead, active: scene.activeSegment, alpha: shown * outWave});
  }
  if (split > 0.02) {
    const dur = job.wav.seconds;
    const gapPx = Math.min(16 * u, n.wave.w * 0.05) * split;
    const span = n.wave.w - gapPx;
    ctx.globalAlpha = shown * split;
    ctx.font = font(L.fs.small, 600, SANS);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    job.response.segments.forEach((seg, i) => {
      const x0 = n.wave.x + (seg.start / dur) * span + (i ? gapPx : 0);
      const x1 = n.wave.x + (seg.end / dur) * span + (i ? gapPx : 0);
      ctx.fillStyle = P.seg[i];
      const label = pickFit(ctx, [`${fmtSeconds(seg.start)}–${fmtSeconds(seg.end)}秒`, `${fmtSeconds(seg.start)}–${fmtSeconds(seg.end)}`], x1 - x0);
      writeText(ctx, label, (x0 + x1) / 2, n.times.y + n.times.h / 2, Math.max(20, x1 - x0));
    });
  }
  ctx.restore();
}

function carrierRect(L, at) {
  const C = L.carrier;
  const i = Math.min(5, Math.max(1, Math.floor(at)));
  const f = clamp01(at - i);
  const [x, y] = pointOn(C.paths[i], f);
  const a = C.slots[i];
  const b = C.slots[i + 1];
  const w = lerp(a.w, b.w, f);
  const h = lerp(a.h, b.h, f);
  return {x: x - w / 2, y: y - h / 2, w, h};
}

function drawCarrier(ctx, L, P, scene, job) {
  const c = scene.carrier;
  if (!c || c.alpha <= 0.002) return;
  const u = L.u;
  const at = clamp(c.at, 0, 6);
  const kind = clamp(c.kind, 0, 3);
  const k0 = Math.min(2, Math.floor(kind));
  const kf = kind - k0;
  const weights = [0, 0, 0, 0];
  weights[k0] = 1 - kf;
  weights[k0 + 1] += kf;
  ctx.save();
  const base = ctx.globalAlpha * c.alpha;
  const C = L.carrier;
  let rect;
  if (at < 1) {
    const e = smooth(at);
    const paper = {
      x: lerp(C.paper.from.x, C.paper.to.x, e), y: lerp(C.paper.from.y, C.paper.to.y, e),
      w: lerp(C.paper.from.w, C.paper.to.w, e), h: lerp(C.paper.from.h, C.paper.to.h, e)
    };
    const card = {
      x: lerp(C.card.from.x, C.card.to.x, e), y: lerp(C.card.from.y, C.card.to.y, e),
      w: lerp(C.card.from.w, C.card.to.w, e), h: lerp(C.card.from.h, C.card.to.h, e)
    };
    drawPaper(ctx, paper, P, u, base * weights[0]);
    drawCard(ctx, card, job, P, u, base * weights[0]);
    rect = C.slots[1];
  } else {
    rect = carrierRect(L, at);
    if (weights[0] > 0.002) {
      drawPaper(ctx, halfOf(rect, 0, 4 * u), P, u, base * weights[0]);
      drawCard(ctx, halfOf(rect, 1, 4 * u), job, P, u, base * weights[0]);
    }
  }
  drawScript(ctx, rect, P, u, L.fs, base * weights[1]);
  drawEnvelope(ctx, rect, job, P, u, L.fs, base * weights[2]);
  if (weights[3] > 0.002) drawWave(ctx, rect, job, P, u, {alpha: base * weights[3]});
  ctx.restore();
}

function wrapWords(ctx, words, maxWidth) {
  const lines = [];
  let line = [];
  let width = 0;
  const space = ctx.measureText(' ').width;
  words.forEach(item => {
    const w = ctx.measureText(item.word).width;
    if (line.length && width + space + w > maxWidth) {
      lines.push(line);
      line = [];
      width = 0;
    }
    width += (line.length ? space : 0) + w;
    line.push({...item, w});
  });
  if (line.length) lines.push(line);
  return lines;
}

function drawCaption(ctx, L, P, scene) {
  const cap = scene.caption;
  const R = L.caption;
  if (!cap || !R) return;
  const u = L.u;
  const titleSize = L.wide ? Math.round(L.H * 0.05) : Math.round(L.W * 0.054);
  const subSize = L.wide ? Math.round(L.H * 0.032) : Math.round(L.W * 0.034);
  ctx.save();
  ctx.font = font(Math.round(subSize * 0.8), 600, SANS);
  ctx.fillStyle = P.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('VoiceStudio の作例　無音', R.x, R.y);
  ctx.textAlign = 'right';
  ctx.fillText(`${cap.index} / ${SCENES.length}`, R.x + R.w, R.y);
  ctx.globalAlpha = cap.alpha;
  const top = R.y + subSize * 1.25;
  ctx.textAlign = 'left';
  ctx.font = font(titleSize, 700, SERIF);
  ctx.fillStyle = P.ink;
  writeText(ctx, cap.title, R.x, top, R.w);
  ctx.font = font(subSize, 400, SANS);
  ctx.fillStyle = P.muted;
  writeText(ctx, cap.sub, R.x, top + titleSize * 1.25, R.w);
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.accent;
  ctx.fillRect(R.x, R.y + R.h - 3 * u, R.w * (cap.index / SCENES.length), Math.max(2, 1.5 * u));
  ctx.restore();
}

function drawSummaryCell(ctx, rect, job, P, u, size) {
  const waveW = Math.min(rect.w * (rect.w > rect.h * 6 ? 0.3 : 0.22), rect.h * 2.6);
  drawWave(ctx, {x: rect.x, y: rect.y + rect.h * 0.12, w: waveW, h: rect.h * 0.76}, job, P, u, {split: 1, alpha: ctx.globalAlpha});
  const tx = rect.x + waveW + 10 * u;
  const tw = rect.x + rect.w - tx;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = font(size, 700, SANS);
  ctx.fillStyle = P.ink;
  const lineY = rect.y + (rect.h - size * 2.3) / 2;
  writeText(ctx, `${job.id}　${verdictText(job)}`, tx, lineY, tw);
  ctx.font = font(Math.round(size * 0.9), 400, SANS);
  ctx.fillStyle = P.muted;
  const [a, b] = job.response.segments;
  writeText(ctx, `推定 ${fmtSeconds(a.start)}–${fmtSeconds(a.end)}｜${fmtSeconds(b.start)}–${fmtSeconds(b.end)}秒`, tx, lineY + size * 1.3, tw);
}

function drawFooter(ctx, L, P, scene, data, job) {
  const R = L.footer;
  const foot = scene.foot;
  if (!R || !foot) return;
  const u = L.u;
  const size = L.fs.small;
  ctx.save();
  if (foot.input > 0.002) {
    ctx.globalAlpha = foot.input * value(scene.show, 'request', 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = font(L.fs.sub, 700, SANS);
    ctx.fillStyle = P.ink;
    writeText(ctx, `実際の入力：${job.wav.name}`, R.x, R.y + 4 * u, R.w);
    ctx.font = font(size, 400, SANS);
    ctx.fillStyle = P.muted;
    writeText(ctx, `${fmtSeconds(job.wav.seconds)}秒・${groupDigits(job.wav.bytes)} B・24 kHz・モノラル・PCM16`, R.x, R.y + 4 * u + L.fs.sub * 1.35, R.w);
    writeText(ctx, '合成英語（Chatterbox の出力・透かし入り）を変えずに渡す', R.x, R.y + 4 * u + L.fs.sub * 1.35 + size * 1.35, R.w);
  }
  if (foot.text > 0.002) {
    ctx.globalAlpha = foot.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = font(size, 600, SANS);
    ctx.fillStyle = P.muted;
    writeText(ctx, '返った全文（そのまま・英語）', R.x, R.y + 2 * u, R.w);
    ctx.font = font(L.fs.sub, 400, SANS);
    const words = job.response.segments.flatMap((seg, i) => seg.text.trim().split(/\s+/).map(word => ({word, seg: i})));
    const lines = wrapWords(ctx, words, R.w);
    const lineH = L.fs.sub * 1.3;
    lines.slice(0, 3).forEach((line, li) => {
      let x = R.x;
      const space = ctx.measureText(' ').width;
      line.forEach(item => {
        ctx.fillStyle = P.seg[item.seg];
        ctx.fillText(item.word, x, R.y + size * 1.45 + li * lineH);
        x += item.w + space;
      });
    });
  }
  if (foot.summary > 0.002) {
    ctx.globalAlpha = foot.summary;
    const ids = JOB_IDS;
    if (L.wide) {
      const w = (R.w - 2 * 14 * u) / 3;
      ids.forEach((id, i) => drawSummaryCell(ctx, {x: R.x + i * (w + 14 * u), y: R.y, w, h: R.h}, data.jobs[id], P, u, size));
    } else {
      const h = R.h / 3;
      ids.forEach((id, i) => drawSummaryCell(ctx, {x: R.x, y: R.y + i * h, w: R.w, h: h - 4 * u}, data.jobs[id], P, u, size));
    }
  }
  ctx.restore();
}

// 図を1枚描く。scene は sceneAt / stageScene / mixScene の結果。
export function drawConcept(ctx, {width, height, dpr = 1, data, scene, palette = PALETTES.paper, film = false, part = null, layout = null}) {
  const L = layout || layoutConcept(width, height, {film});
  const P = palette;
  const job = data.jobs[scene.job] || data.jobs.default;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, width, height);
  if (film) drawCaption(ctx, L, P, scene);
  drawApp(ctx, L, P, scene);
  drawEdges(ctx, L, P, scene);
  drawRef(ctx, L, P, scene);
  ['skill', 'request', 'author', 'cli', 'api', 'select', 'model', 'output', 'json', 'txt', 'compare'].forEach(id => drawNode(ctx, L, P, id, scene, job, part));
  drawOutput(ctx, L, P, scene, job);
  drawCarrier(ctx, L, P, scene, job);
  if (film) drawFooter(ctx, L, P, scene, data, job);
  ctx.restore();
  return L;
}

// ---- 作例ページ（index.html のときだけ動く） ----

const STAGE_NOTES = [
  () => 'VoiceStudio は手元で動く音声アプリ兼サーバー（AGPL-3.0）。文字を推定するのは、そこで選んだ別の認識モデル（MIT）です。番号の部品を押すと、原典の該当行を読めます。',
  () => '担当者が原典CLIで、WAV を変えずに faster-whisper・en・verbose_json の条件と一緒に 127.0.0.1:3900 へ POST しました。参照文は送っていません。',
  job => {
    const [a, b] = job.response.segments;
    const verdict = job.literal ? '文字どおり一致しました' : `文字どおりには一致しません（返った表記 ${job.digits.join('・')} などはそのまま）`;
    return `返ったのは2つの推定区間（${fmtSeconds(a.start)}–${fmtSeconds(a.end)}秒・${fmtSeconds(b.start)}–${fmtSeconds(b.end)}秒）と全文。JSON は CLI の出力そのまま、TXT はその text に改行を1つ足しただけです。参照文とは最後に比べ、${verdict}。`;
  }
];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, val]) => {
    if (val === null || val === undefined || val === false) return;
    if (key === 'class') node.className = val;
    else if (key === 'text') node.textContent = val;
    else node.setAttribute(key, val === true ? '' : String(val));
  });
  children.flat().forEach(child => {
    if (child === null || child === undefined || child === false) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

function initPage() {
  const $ = id => document.getElementById(id);
  const canvas = $('concept-canvas');
  const frame = $('concept-frame');
  const layer = $('part-layer');
  const statusEl = $('load-status');
  const failure = $('load-failure');
  const failureText = $('load-failure-text');
  const retry = $('retry');
  const audio = $('input-audio');
  const stageNote = $('stage-note');
  const partBrief = $('part-brief');
  const saveNote = $('save-note');
  const downloads = {input: $('download-input'), json: $('download-json'), text: $('download-text')};
  const jobButtons = Array.from(document.querySelectorAll('button[data-job]'));
  const stageButtons = Array.from(document.querySelectorAll('button[data-stage]'));
  const partButtons = Array.from(document.querySelectorAll('button[data-part]'));
  const segButtons = Array.from(document.querySelectorAll('button[data-segment]'));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dark = window.matchMedia('(prefers-color-scheme: dark)');

  const state = {data: null, generation: 0, controller: null, job: 'default', stage: 0, part: 'skill', urls: new Map(), shown: null, tween: 0, frame: 0, layout: null, size: null};

  const jobFromHash = () => {
    let id = '';
    try { id = decodeURIComponent(location.hash.replace(/^#/, '')); } catch (_) { id = ''; }
    return JOB_IDS.includes(id) ? id : 'default';
  };

  function setStatus(kind, message) {
    statusEl.dataset.state = kind;
    statusEl.textContent = message;
  }

  function measure() {
    const w = Math.max(240, Math.floor(frame.clientWidth));
    const h = preferredHeight(w);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    layer.style.height = `${h}px`;
    state.size = {w, h, dpr};
    state.layout = layoutConcept(w, h, {film: false});
    placeParts();
  }

  function placeParts() {
    const L = state.layout;
    if (!L) return;
    partButtons.forEach(button => {
      const n = L.nodes[PART_NODE[button.dataset.part]];
      const r = n.badge ? n.badge.r : 0;
      const h = Math.max(44, n.h);
      button.style.left = `${Math.round(n.x - r)}px`;
      button.style.top = `${Math.round(n.y - (h - n.h) / 2)}px`;
      button.style.width = `${Math.round(n.w + r)}px`;
      button.style.height = `${Math.round(h)}px`;
    });
  }

  function clearCanvas() {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function liveScene(base) {
    const scene = {...base};
    const job = state.data && state.data.jobs[state.job];
    const live = job && audio.getAttribute('src') && (!audio.paused || audio.currentTime > 0) && !audio.ended;
    scene.playhead = live ? audio.currentTime : null;
    scene.activeSegment = live ? job.response.segments.findIndex(seg => audio.currentTime >= seg.start && audio.currentTime < seg.end) : -1;
    return scene;
  }

  function render() {
    if (!state.data || !state.size) return;
    const base = state.shown || stageScene(state.stage, state.job);
    drawConcept(canvas.getContext('2d'), {
      width: state.size.w, height: state.size.h, dpr: state.size.dpr, data: state.data, scene: liveScene(base),
      palette: dark.matches ? PALETTES.ink : PALETTES.paper, part: state.part, layout: state.layout
    });
  }

  function scheduleRender() {
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      render();
    });
  }

  function describe() {
    const job = state.data && state.data.jobs[state.job];
    const stageName = STAGES[state.stage].name;
    const tail = job ? `参照文との照合は${verdictText(job, true)}。` : '';
    canvas.setAttribute('aria-label', `構造図（${stageName}・${state.job}）。公開の手順書 SKILL.md と依頼（WAV の場所）を作者AI 1体が読んでクライアントを書き、担当者が原典CLIを実行。WAV と条件が手元の VoiceStudio API（127.0.0.1:3900）へ入り、利用条件と導入済みモデルを確かめて、別の認識モデル faster-whisper-base が2つの推定区間と全文を返す。JSON は CLI の出力そのまま、TXT は text に改行を足したもの。参照文は送らず最後に比べる。${tail}`);
  }

  function updateSelections() {
    jobButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.job === state.job)));
    stageButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.stage) === state.stage)));
    partButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.part === state.part)));
    const job = state.data && state.data.jobs[state.job];
    stageNote.textContent = job ? STAGE_NOTES[state.stage](job) : '';
    describe();
  }

  function setEnabled(enabled) {
    [...jobButtons, ...stageButtons, ...partButtons, ...segButtons].forEach(button => { button.disabled = !enabled; });
    layer.hidden = !enabled;
    Object.values(downloads).forEach(link => {
      if (!enabled) {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
      }
    });
  }

  function revokeUrls() {
    state.urls.forEach(url => URL.revokeObjectURL(url));
    state.urls.clear();
  }

  function urlFor(path, type) {
    if (!state.urls.has(path)) state.urls.set(path, URL.createObjectURL(new Blob([state.data.buffers.get(path)], {type})));
    return state.urls.get(path);
  }

  function setDownload(link, path, name, type) {
    link.href = urlFor(path, type);
    link.download = name;
    link.removeAttribute('aria-disabled');
  }

  function fillText(id, value) {
    const node = $(id);
    if (node) node.textContent = value;
  }

  function fillJob(job) {
    const [a, b] = job.response.segments;
    fillText('input-name', job.wav.name);
    fillText('input-facts', `${fmtSeconds(job.wav.seconds)}秒・${groupDigits(job.wav.bytes)} B・24 kHz・モノラル・PCM16`);
    fillText('request-line', `<python> -m backend.speech_client --engine-url http://127.0.0.1:3900 transcribe <作例>/inputs/audio/${job.id}.wav --model faster-whisper --language en --format verbose_json`);
    segButtons.forEach(button => {
      const seg = job.response.segments[Number(button.dataset.segment)];
      button.querySelector('.seg-time').textContent = `${fmtSeconds(seg.start)}–${fmtSeconds(seg.end)}秒`;
    });
    const list = $('segment-list');
    list.replaceChildren(...job.response.segments.map((seg, i) => el('li', {class: `seg seg-${i}`},
      el('span', {class: 'seg-when'}, `区間${i + 1}　${fmtSeconds(seg.start)}–${fmtSeconds(seg.end)}秒（推定）`),
      el('span', {class: 'seg-words', lang: 'en'}, seg.text.trim()))));
    const tail = job.wav.seconds - b.end;
    fillText('coverage-note', tail > 0.0005
      ? `入力は${fmtSeconds(job.wav.seconds)}秒で、返った区間は${fmtSeconds(b.end)}秒までです。最後の${fmtSeconds(tail)}秒は区間に含まれていません（返ったまま）。`
      : `返った区間は入力の終わり（${fmtSeconds(job.wav.seconds)}秒）までです。区間の境目 ${fmtSeconds(a.end)}秒 も推定です。`);
    fillText('returned-text', job.response.text);
    const markWords = (node, tokens) => node.replaceChildren(...tokens.flatMap((token, i) => [
      i ? ' ' : '', token.same ? token.word : el('mark', {}, token.word)
    ]));
    markWords($('returned-marked'), job.diff.returned);
    markWords($('reference-marked'), job.diff.reference);
    fillText('literal-result', job.literal ? '文字どおりの一致：true（一致）' : '文字どおりの一致：false（一致しない）');
    $('literal-result').dataset.literal = String(job.literal);
    fillText('literal-note', job.literal
      ? 'この一致は文字列の比較だけです。人が聞いて確かめた結果や、発音・意味・時刻の正しさの保証ではありません。'
      : `返った表記（${job.digits.join('・')} など数字の書き方、Platform の大文字）を直していません。参照文の読み方とは文字どおりには一致しません。時刻・意味・発音の正しさは確かめていません。`);
    fillText('raw-json', job.json.text);
    fillText('raw-text', job.txt.text);
    fillText('raw-json-meta', `${job.json.name}・${groupDigits(job.json.bytes)} B・原典CLIの標準出力そのまま（末尾の改行は CLI が付けたもの）`);
    fillText('raw-text-meta', `${job.txt.name}・${groupDigits(job.txt.bytes)} B・返った text に改行1つを足しただけ`);
    fillText('elapsed', `${job.elapsed.toFixed(3)}秒`);
    setDownload(downloads.input, job.wav.path, job.wav.name, 'audio/wav');
    setDownload(downloads.json, job.json.path, job.json.name, 'application/json');
    setDownload(downloads.text, job.txt.path, job.txt.name, 'text/plain;charset=utf-8');
    fillText('download-input-size', `${groupDigits(job.wav.bytes)} B`);
    fillText('download-json-size', `${groupDigits(job.json.bytes)} B`);
    fillText('download-text-size', `${groupDigits(job.txt.bytes)} B`);
  }

  function fillPart() {
    const part = state.data && state.data.partById[state.part];
    if (!part) return;
    const n = PART_NUMBER[part.id];
    partBrief.replaceChildren(el('b', {}, `${n} ${part.title}`), '　', part.role, '　', el('a', {href: '#part-detail'}, '原典の行を読む'));
    $('part-title').textContent = `${n} ${part.title}`;
    $('part-role').textContent = part.role;
    $('part-quotes').replaceChildren(...part.quotes.map(quote => el('details', {class: 'quote'},
      el('summary', {}, el('span', {class: 'quote-path'}, quote.path.replace(/^vendor\//, '')), `　${quote.start}–${quote.end}行目`),
      el('pre', {lang: 'en', tabindex: '0'}, el('code', {}, quote.text)),
      el('p', {class: 'quote-links'},
        el('a', {href: quote.path}, '同梱の原文ファイル'),
        quote.url ? ['　', el('a', {href: quote.url, rel: 'noopener noreferrer'}, `固定版で ${quote.start}–${quote.end}行目を開く`)] : null))));
  }

  function selectJob(id, {resetStage = false} = {}) {
    state.job = JOB_IDS.includes(id) ? id : 'default';
    if (resetStage) state.stage = 0;
    cancelAnimationFrame(state.tween);
    state.tween = 0;
    state.shown = stageScene(state.stage, state.job);
    if (state.data) {
      const job = state.data.jobs[state.job];
      audio.pause();
      audio.src = urlFor(job.wav.path, 'audio/wav');
      audio.load();
      fillJob(job);
      saveNote.textContent = '';
      render();
    }
    updateSelections();
  }

  function goStage(next) {
    if (!state.data) return;
    const target = clamp(Number(next) || 0, 0, 2);
    const from = state.shown || stageScene(state.stage, state.job);
    state.stage = target;
    updateSelections();
    const to = stageScene(target, state.job);
    cancelAnimationFrame(state.tween);
    if (reduced.matches) {
      state.shown = to;
      render();
      return;
    }
    const mine = state.generation;
    const began = performance.now();
    const step = now => {
      if (mine !== state.generation || !state.data) return;
      const k = Math.min(1, (now - began) / 520);
      state.shown = mixScene(from, to, smooth(k));
      render();
      state.tween = k < 1 ? requestAnimationFrame(step) : 0;
    };
    state.tween = requestAnimationFrame(step);
  }

  function teardown(error) {
    state.data = null;
    cancelAnimationFrame(state.tween);
    cancelAnimationFrame(state.frame);
    state.tween = 0;
    state.frame = 0;
    state.shown = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    revokeUrls();
    setEnabled(false);
    clearCanvas();
    ['input-name', 'input-facts', 'request-line', 'returned-text', 'literal-result', 'literal-note', 'raw-json', 'raw-text',
      'raw-json-meta', 'raw-text-meta', 'elapsed', 'coverage-note', 'download-input-size', 'download-json-size', 'download-text-size', 'part-title', 'part-role']
      .forEach(id => fillText(id, ''));
    ['segment-list', 'returned-marked', 'reference-marked', 'part-quotes'].forEach(id => $(id).replaceChildren());
    segButtons.forEach(button => { button.querySelector('.seg-time').textContent = ''; button.removeAttribute('aria-current'); });
    stageNote.textContent = '';
    partBrief.textContent = '';
    saveNote.textContent = '';
    document.body.dataset.state = error ? 'error' : 'loading';
    if (error) {
      const message = error && error.message ? error.message : String(error);
      canvas.setAttribute('aria-label', `図を表示できません：${message}`);
      failureText.textContent = message;
      failure.hidden = false;
      retry.disabled = false;
      setStatus('error', '保存データを確かめられなかったため、図・音声・保存を止めました。');
    } else {
      canvas.setAttribute('aria-label', '保存データを確かめています');
      failure.hidden = true;
      setStatus('loading', `保存データ${ASSET_COUNT}件の大きさと SHA-256 を確かめています`);
    }
  }

  async function boot() {
    state.generation += 1;
    const mine = state.generation;
    if (state.controller) state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    teardown(null);
    retry.disabled = true;
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const data = await loadData({
        signal: controller.signal,
        onProgress: (done, total) => {
          if (mine === state.generation && !state.data) setStatus('loading', `保存データ${total}件の大きさと SHA-256 を確かめています（${done}/${total}）`);
        }
      });
      if (mine !== state.generation) return;
      state.data = data;
      document.body.dataset.state = 'ready';
      setEnabled(true);
      measure();
      fillPart();
      selectJob(state.job);
      setStatus('ready', `${data.assets.length}ファイルの大きさ・SHA-256・中身・原典の行を確かめました。図・音声・保存は確認済みのデータだけを使います。`);
    } catch (error) {
      if (mine !== state.generation || (error && error.name === 'AbortError')) return;
      teardown(error);
    }
  }

  jobButtons.forEach(button => button.addEventListener('click', () => {
    if (!state.data) return;
    history.replaceState(null, '', `#${button.dataset.job}`);
    selectJob(button.dataset.job);
  }));
  stageButtons.forEach(button => button.addEventListener('click', () => goStage(Number(button.dataset.stage))));
  partButtons.forEach(button => button.addEventListener('click', () => {
    if (!state.data) return;
    state.part = button.dataset.part;
    updateSelections();
    fillPart();
    render();
  }));
  segButtons.forEach(button => button.addEventListener('click', () => {
    if (!state.data) return;
    const seg = state.data.jobs[state.job].response.segments[Number(button.dataset.segment)];
    const seekNow = () => { audio.currentTime = seg.start; };
    if (audio.readyState >= 1) seekNow();
    else audio.addEventListener('loadedmetadata', seekNow, {once: true});
    const playing = audio.play();
    if (playing && typeof playing.catch === 'function') playing.catch(() => {});
  }));
  Object.values(downloads).forEach(link => link.addEventListener('click', event => {
    if (!state.data || !link.getAttribute('href')) {
      event.preventDefault();
      return;
    }
    saveNote.textContent = `${link.download} の保存をブラウザーに渡しました。保存できたかはブラウザーの表示で確かめてください。`;
  }));
  ['timeupdate', 'seeked', 'play', 'pause', 'ended', 'emptied'].forEach(type => audio.addEventListener(type, () => {
    if (!state.data) return;
    const job = state.data.jobs[state.job];
    const t = audio.currentTime;
    segButtons.forEach(button => {
      const seg = job.response.segments[Number(button.dataset.segment)];
      const on = !audio.ended && (!audio.paused || t > 0) && t >= seg.start && t < seg.end;
      if (on) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    if (!state.tween) scheduleRender();
  }));
  audio.addEventListener('error', () => {
    if (!state.data || !audio.getAttribute('src')) return;
    saveNote.textContent = 'このブラウザーでは入力 WAV を再生できませんでした。保存して別のアプリで開けます。';
  });
  retry.addEventListener('click', () => boot());
  window.addEventListener('hashchange', () => selectJob(jobFromHash(), {resetStage: true}));
  const onResize = () => {
    if (!state.data) return;
    if (state.size && state.size.w === Math.max(240, Math.floor(frame.clientWidth))) return;
    measure();
    render();
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(onResize).observe(frame);
  else window.addEventListener('resize', onResize);
  const onTheme = () => render();
  if (dark.addEventListener) dark.addEventListener('change', onTheme);

  state.job = jobFromHash();
  updateSelections();
  boot();
}

if (typeof document !== 'undefined' && document.documentElement.dataset.page === 'concept') initPage();
