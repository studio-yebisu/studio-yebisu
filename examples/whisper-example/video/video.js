/* しおり工房 字幕デスク（Whisper作例）— 28秒・無音の解説映像（編集できる元ページ）
 * Canvas 2D で、時刻 t の完成した画面を毎回最初から描く。前のフレームや壁時計には依存しない。
 * 使う素材は、実際の入力WAV・Whisperの保存済み出力・ブラウザーで保存したSRT・実画面のキャプチャ4枚だけ。
 * 映像に出す文は、読み込んだファイルから取り出す（ここに転記の文を書き写さない）。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 28;
const POSTER_TIME = 13.5;
const LW = 1280, LH = 720; // 論理座標。実際の大きさへは等倍率で収める
const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
const evenSize = (v, fallback) => (Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0 ? v : fallback);
const WIDTH = evenSize(given.width, 1280);
const HEIGHT = evenSize(given.height, 720);
const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
window.motionConfig = {duration: DURATION, fps: FPS, width: WIDTH, height: HEIGHT, posterTime: POSTER_TIME, audioEvents: []};

const root = document.documentElement;
if (RENDER) root.classList.add('is-render');
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
const density = RENDER ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
canvas.width = Math.round(WIDTH * density);
canvas.height = Math.round(HEIGHT * density);
canvas.style.aspectRatio = WIDTH + ' / ' + HEIGHT;
if (RENDER) {
  canvas.style.width = WIDTH + 'px';
  canvas.style.height = HEIGHT + 'px';
}

// ---- 見た目（作例ページと同じ紙・墨・すもも色） ------------------------------
const C = {
  paper: '#f4efe6', card: '#fffcf7', ink: '#1c1814', inkSoft: '#4a4339', muted: '#655c51',
  line: '#d9cdbd', plum: '#6a2c5a', plumSoft: '#f3e6ef', quiet: '#b9ab9b'
};
const SANS = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", sans-serif';
const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", "Noto Serif JP", serif';
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, "BIZ UDGothic", "MS Gothic", monospace';

// ---- 素材：制作記録（runtime/frozen-reviewed-source.json）の SHA-256 と同じものだけを使う ----
// パスはこのモジュールからの相対。書き出し時に <base href="video/"> が入っても同じ場所を指す。
const SOURCES = [
  {key: 'request', path: '../request.txt', kind: 'text', sha256: '4a24bc1227f122514638a1c158a46fc2de043d4f7d09807ae9ebd1881fac3405'},
  {key: 'script', path: '../input/script.json', kind: 'json', sha256: '2ab9861f781ae0451d43e341cd7cb1104a65f8c891aa571622a659a0fb7e7fef'},
  {key: 'wav', path: '../input/review-ja.wav', kind: 'wav', sha256: '8b9fbf4aeba07b7f2887fd8b9f82e07ea9bc802a5e6907a355ec388e47df82c4'},
  {key: 'session', path: '../outputs/session.json', kind: 'json', sha256: '4cf1dc6fef3956147acad65b2c7937d9959a85af18ee245d4a9096cbea61cbc3'},
  {key: 'rawSrt', path: '../outputs/review-ja.srt', kind: 'text', sha256: 'a9d6ffb16a3d61d6e7b2700fc72f34d8bfbf49d40ddfc7befe3b06d4194ac2e1'},
  {key: 'editedSrt', path: '../outputs/browser-edited.srt', kind: 'text', sha256: '976709c38a46dcc15f1d230729bdfb2a5390dd8a4fa3eeaf9cf4e93569e0716c'},
  {key: 'editRecord', path: '../outputs/edit-record.json', kind: 'json', sha256: 'd236e2ed1d1f4ff62f647b9500018cff5e90d984bc7839a4e863a2e232a41c5c'},
  {key: 'reference', path: '../outputs/reference-review.json', kind: 'json', sha256: '7338ec0dd65bc8c7c6d36a31a0d9bcea1f1f624657551db089acb0a46897178b'},
  {key: 'manifest', path: 'assets/screen-manifest.json', kind: 'json', sha256: 'b543611de5bf83b199bdfccbdd531d5d252fe39d891023992f1127f6a160e558'},
  {key: 'waveform', path: 'assets/waveform.json', kind: 'json', sha256: '5dbe1cd9842a6b575557597a08c1f03fdd6d4ef7812678c5d1877e5ac6f833cb'},
  {key: 'phone', path: 'assets/phone-raw.png', kind: 'png', sha256: '6f85e9f551cebd1e959332afe4120b31fec9bc52d192724f6ccefe43b17980d8', pixels: [375, 812]},
  {key: 'desktopRaw', path: 'assets/desktop-raw.png', kind: 'png', sha256: '90b4d76631004a75adc246515ea1bc4e0524cededf593d6b64d794fa1bf6a985', pixels: [1265, 1886]},
  {key: 'editedFirst', path: 'assets/desktop-edited-first.png', kind: 'png', sha256: '3c27e243fd4ec2e074ce57205bfb430db8269eaf771014d86b3e8aa122246a07', pixels: [1265, 1940]},
  {key: 'editedLast', path: 'assets/desktop-edited-last.png', kind: 'png', sha256: '41080772ef774af426dbb59b56490b922c9b103c0c02a498c06b7851461f8f1c', pixels: [1265, 1911]}
];
const SOURCE_COMMIT = '86098128c0b4f24f0e2aa2994de830614b474227';
const CHECKPOINT_SHA256 = 'ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e';
const FEATURE_ID = 0;          // 前後を大きく見せる区間
const STUDIO_NAME = 'しおり工房'; // 原稿・直した字幕にあり、原出力には無いことを読み込み時に確かめる

// 実画面の切り抜き（画像の画素座標）。パネルの枠の外に約10pxの余白を含め、文字を切らない
const CROPS = {
  rawList: {img: 'desktopRaw', x: 78, y: 477, w: 526, h: 532},     // 区間の一覧（原出力）
  rawEditor: {img: 'desktopRaw', x: 600, y: 477, w: 602, h: 667},   // 文を直す欄（編集前）
  editEditor: {img: 'editedFirst', x: 600, y: 503, w: 602, h: 665}, // 文を直す欄（id 0 を直した後）
  editList: {img: 'editedLast', x: 78, y: 503, w: 526, h: 590},     // 3区間を直した後の一覧
  savePanel: {img: 'editedFirst', x: 600, y: 1167, w: 602, h: 165}, // 保存パネルの見出しとボタンまで（保存状態の行は含めない）
  phoneTop: {img: 'phone', x: 0, y: 0, w: 375, h: 524}              // スマホ幅の初期画面の上部
};
// desktop-edited-first.png の「原出力といまの字幕」の範囲（枠を重ねる位置）
const COMPARE = {x: 626, y: 968, w: 550, h: 174};
// 切り抜きを置く位置（左上と等倍率）
const PLACE = {
  rawList: {x: 80, y: 176, s: 0.88},
  editor: {x: 80, y: 176, s: 0.7},
  editList: {x: 80, y: 176, s: 0.79},
  savePanel: {x: 80, y: 172, s: 1.1},
  phoneTop: {x: 80, y: 176, s: 0.9}
};

const STEPS = ['入力', '実際の原出力', '原稿を参照して直す', 'SRTで保存'];
const SCENES = [
  {id: 'input', start: 0, end: 4, step: 0, headline: () => '転記の誤りを、そのまま直せる。'},
  {id: 'raw', start: 4, end: 8, step: 1, headline: () => '実際の原出力：工房名が別の文字に。'},
  {id: 'edit', start: 8, end: 15.5, step: 2, headline: () => '原稿を参照して、手で直す。'},
  {id: 'count', start: 15.5, end: 20, step: 2, headline: f => `直したのは${f.changedIds.length}区間。時刻は推定値のまま。`},
  {id: 'srt', start: 20, end: 24, step: 3, headline: () => 'ブラウザーから、SRTで保存。'},
  {id: 'next', start: 24, end: 28, step: 3, headline: () => '転記の誤りを、そのまま直せる。'}
];
const CONTENT_TOP = 136, CONTENT_BOTTOM = 664;

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const enter = (t, at, dur = 0.4) => easeOut(prog(t, at, at + dur));
const rise = (t, at, dur = 0.4, px = 10) => px * (1 - enter(t, at, dur));
// 場面の入りは0.45秒、出は0.4秒。隣の場面と重ねて、画面全体が空になる瞬間を作らない
function sceneAlpha(t, i) {
  const s = SCENES[i];
  const a = i === 0 ? 1 : easeOut(prog(t, s.start - 0.05, s.start + 0.4));
  const b = i === SCENES.length - 1 ? 1 : 1 - easeInOut(prog(t, s.end - 0.35, s.end + 0.05));
  return Math.min(a, b);
}

// ---- 読み込みと確認 --------------------------------------------------------
const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
const check = (ok, message) => {
  if (!ok) throw new Error('記録の確認に失敗：' + message);
};

async function load(source) {
  const url = new URL(source.path, import.meta.url);
  let response;
  try {
    response = await fetch(url, {cache: 'no-store'});
  } catch {
    throw new Error(`${source.path} を読み込めません。file:// ではなくローカルサーバーで開いてください`);
  }
  if (!response.ok) throw new Error(`${source.path} が HTTP ${response.status} でした`);
  const bytes = await response.arrayBuffer();
  const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (digest !== source.sha256) throw new Error(`${source.path} のSHA-256が制作記録と違います（${digest}）`);
  if (source.kind === 'wav') return {bytes, sha256: digest};
  if (source.kind === 'png') {
    const bitmap = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
    if (bitmap.width !== source.pixels[0] || bitmap.height !== source.pixels[1]) {
      throw new Error(`${source.path} の大きさが ${bitmap.width}×${bitmap.height} でした`);
    }
    return bitmap;
  }
  let body = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  return source.kind === 'json' ? JSON.parse(body) : {text: body, sha256: digest};
}

// RIFF/WAVE（PCM16）を読み、0.1秒ごとのRMSを実際の標本から求める
function readWav(bytes) {
  const v = new DataView(bytes);
  const tag = o => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  check(bytes.byteLength >= 44 && tag(0) === 'RIFF' && tag(8) === 'WAVE', 'WAV の形式');
  let fmt = null, data = null;
  for (let o = 12; o + 8 <= bytes.byteLength;) {
    const id = tag(o), size = v.getUint32(o + 4, true), body = o + 8;
    if (id === 'fmt ') {
      fmt = {format: v.getUint16(body, true), channels: v.getUint16(body + 2, true), rate: v.getUint32(body + 4, true), bits: v.getUint16(body + 14, true)};
    } else if (id === 'data') {
      data = {offset: body, size: Math.min(size, bytes.byteLength - body)};
    }
    o = body + size + (size % 2);
  }
  check(fmt && data, 'WAV の fmt と data');
  check(fmt.format === 1 && fmt.bits === 16, 'WAV が PCM16 ではありません');
  const frames = Math.floor(data.size / (2 * fmt.channels));
  return {...fmt, frames, sample: i => v.getInt16(data.offset + i * 2 * fmt.channels, true)};
}
function rmsWindows(wav, windowSamples) {
  const out = [];
  for (let start = 0; start < wav.frames; start += windowSamples) {
    const end = Math.min(wav.frames, start + windowSamples);
    let sum = 0;
    for (let i = start; i < end; i++) {
      const x = wav.sample(i) / 32768;
      sum += x * x;
    }
    out.push(Math.sqrt(sum / (end - start)));
  }
  return out;
}

// SRT を番号・時刻行・文に分ける（文の改行はそのまま）
function parseSrt(body) {
  const blocks = body.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
  return blocks.map(block => {
    const lines = block.split('\n');
    check(lines.length >= 3 && /^\d+$/.test(lines[0]) && /^\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}$/.test(lines[1]), 'SRT の区切り');
    return {index: Number(lines[0]), timing: lines[1], text: lines.slice(2).join('\n')};
  });
}
// whisper.utils.format_timestamp（時を常に出し、小数点はカンマ）と同じ書き方
function srtTime(seconds) {
  let ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const m = Math.floor(ms / 60000); ms -= m * 60000;
  const s = Math.floor(ms / 1000); ms -= s * 1000;
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(h, 2)}:${p(m, 2)}:${p(s, 2)},${p(ms, 3)}`;
}
const fmtS = v => v.toFixed(2);
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

function buildFacts(d) {
  const {request, script, session, rawSrt, editedSrt, editRecord, reference, manifest, waveform} = d;

  // 入力：作例用の原稿を読み上げた合成音声
  check(script.kind === 'synthetic' && script.fictional === true && Array.isArray(script.sentences), '原稿の種類');
  check(session.audio && session.audio.kind === 'synthetic' && session.audio.fictional === true, '音声の種類');
  check(session.audio.voice_name === script.voice_name, '読み上げの声の名前');
  check(session.audio.script_sha256 === SOURCES.find(s => s.key === 'script').sha256, '原稿の SHA-256');
  const wavSource = d.wav;
  check(wavSource.sha256 === session.audio.sha256 && wavSource.sha256 === waveform.audio_sha256, 'WAV の SHA-256 と記録');
  const wav = readWav(wavSource.bytes);
  check(wav.channels === 1 && wav.rate === session.audio.sample_rate && wav.bits === session.audio.sample_width_bits, 'WAV の形式と記録');
  check(wav.frames === session.audio.frames, 'WAV の標本数と記録');
  check(Math.abs(wav.frames / wav.rate - session.audio.duration_seconds) < 1e-5, 'WAV の長さと記録');

  // RMS：waveform.json の値を、WAV の標本から求め直した値と照らす
  check(waveform.sample_rate === wav.rate && Number.isInteger(waveform.window_samples) && Array.isArray(waveform.values), 'RMS の記録の形');
  const rms = rmsWindows(wav, waveform.window_samples);
  check(rms.length === waveform.values.length, 'RMS の窓の数');
  check(rms.every((value, i) => Math.abs(value - waveform.values[i]) <= 2e-5), 'RMS の値が WAV から求めた値と違います');

  // 依頼文：入力の指定（request.txt の「入力：」行の最初の一文をそのまま）
  const inputLine = request.text.split('\n').find(line => line.startsWith('入力：'));
  check(inputLine && inputLine.includes('。'), '依頼文の入力の行');
  const requestInput = inputLine.slice(0, inputLine.indexOf('。') + 1);

  // 転記の条件（実際の1回の実行）
  const e = session.engine;
  check(session.status === 'completed' && e.source_commit === SOURCE_COMMIT && e.model === 'base' && e.device === 'cpu', '転記の条件（固定版・base・CPU）');
  check(e.checkpoint_sha256 === CHECKPOINT_SHA256 && e.checkpoint_sha256_expected === CHECKPOINT_SHA256, '重みの SHA-256');
  check(e.language === 'ja' && e.initial_prompt === null && e.reference_text_supplied === false, '言語と、原稿を渡していないこと');
  check(Array.isArray(session.notes) && session.notes.some(n => n.startsWith('One run on one file')), '1回の実行という記録');

  // 原出力：session.json の区間と、Whisper が書いた SRT が同じであること
  const segs = session.result.segments;
  check(Array.isArray(segs) && segs.length > 0, '区間');
  const rawCues = parseSrt(rawSrt.text);
  check(rawSrt.sha256 === session.artifacts_sha256['review-ja.srt'], '原出力 SRT の SHA-256 と記録');
  check(rawCues.length === segs.length, '原出力 SRT の区間数');
  segs.forEach((s, i) => {
    check(s.id === i && rawCues[i].index === i + 1, `区間 ${i} の番号`);
    check(rawCues[i].timing === `${srtTime(s.start)} --> ${srtTime(s.end)}`, `区間 ${i} の時刻`);
    check(rawCues[i].text === s.text.trim(), `区間 ${i} の文`);
    check(s.end <= session.audio.duration_seconds + 0.15, `区間 ${i} の終わり`);
  });

  // 手で直した記録：時刻は全区間そのまま、文が変わった区間だけを数える
  const edited = editRecord.current_segments;
  check(Array.isArray(edited) && edited.length === segs.length && editRecord.cue_count === segs.length, '直した記録の区間数');
  edited.forEach((s, i) => check(s.id === segs[i].id && s.start === segs[i].start && s.end === segs[i].end, `区間 ${i} の時刻が変わっています`));
  const changedIds = edited.filter((s, i) => s.text !== segs[i].text).map(s => s.id);
  check(sameList(changedIds, editRecord.changed_segment_ids) && editRecord.timestamps_unchanged === true, '直した区間の一覧');
  check(editRecord.audio_listening_confirmed === false && editRecord.timing_accuracy_confirmed === false, '聞いての確認・時刻の確認の扱い');
  check(reference.audio_listening_confirmed === false && reference.timing_accuracy_confirmed === false && reference.original_output_unchanged === true, '原稿参照の記録の扱い');
  check(sameList(reference.corrections.map(c => c.id), changedIds), '原稿参照の区間');
  reference.corrections.forEach(c => {
    check(c.raw === segs[c.id].text && c.edited === edited[c.id].text, `原稿参照の区間 ${c.id} の文`);
  });

  // ブラウザーが保存した SRT：番号は1から連番、時刻行は原出力と同じ、文は直した記録と同じ
  const cues = parseSrt(editedSrt.text);
  check(editedSrt.sha256 === editRecord.edited_export_sha256, '保存した SRT の SHA-256 と記録');
  check(cues.length === segs.length, '保存した SRT の区間数');
  cues.forEach((cue, i) => {
    check(cue.index === i + 1 && cue.timing === rawCues[i].timing, `保存した SRT ${i + 1} の番号と時刻`);
    check(cue.text === edited[i].text, `保存した SRT ${i + 1} の文`);
  });

  // 前後を見せる区間：原稿の工房名が原出力には無く、直した字幕にはある
  check(changedIds.includes(FEATURE_ID), '大きく見せる区間が直した区間に含まれていません');
  const script0 = script.sentences[FEATURE_ID];
  check(typeof script0 === 'string' && script0.includes(STUDIO_NAME), '原稿の工房名');
  check(!segs[FEATURE_ID].text.includes(STUDIO_NAME) && edited[FEATURE_ID].text.includes(STUDIO_NAME), '工房名の前後');

  // 実画面：manifest の SHA-256 と大きさ、切り抜きの範囲
  check(manifest && Array.isArray(manifest.screens), '画面の記録');
  const files = {phone: 'phone-raw.png', desktopRaw: 'desktop-raw.png', editedFirst: 'desktop-edited-first.png', editedLast: 'desktop-edited-last.png'};
  for (const [key, file] of Object.entries(files)) {
    const source = SOURCES.find(s => s.key === key);
    const screen = manifest.screens.find(s => s.file === file);
    check(screen && screen.sha256 === source.sha256 && screen.width === source.pixels[0] && screen.height === source.pixels[1], `${file} の記録`);
  }
  for (const [name, crop] of Object.entries(CROPS)) {
    const size = SOURCES.find(s => s.key === crop.img).pixels;
    check(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= size[0] && crop.y + crop.h <= size[1], `${name} の切り抜き範囲`);
  }

  return {
    img: {phone: d.phone, desktopRaw: d.desktopRaw, editedFirst: d.editedFirst, editedLast: d.editedLast},
    voice: session.audio.voice_name,
    duration: session.audio.duration_seconds,
    audioFacts: `${fmtS(session.audio.duration_seconds)}秒 ・ ${session.audio.sample_rate / 1000}kHz ・ ${wav.channels === 1 ? 'モノラル' : wav.channels + 'ch'} ・ PCM${wav.bits}`,
    requestInput,
    rms,
    windowSeconds: waveform.window_samples / wav.rate,
    segs,
    edited,
    changedIds,
    script0,
    engine: {commit: e.source_commit.slice(0, 8), model: e.model, device: e.device.toUpperCase(), threads: e.threads, language: e.language},
    cues,
    rawCues
  };
}

// ---- 描画の部品 ------------------------------------------------------------
function font(o) {
  const family = o.family === 'mincho' ? MINCHO : o.family === 'mono' ? MONO : SANS;
  return `${o.weight || 400} ${o.size || 18}px ${family}`;
}
function text(c, s, x, y, o = {}) {
  c.save();
  c.font = font(o);
  c.fillStyle = o.color || C.ink;
  c.textAlign = o.align || 'left';
  c.textBaseline = 'alphabetic';
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
  c.fillText(s, x, y);
  c.restore();
}
function measure(c, s, o) {
  c.save();
  c.font = font(o);
  const w = c.measureText(s).width;
  c.restore();
  return w;
}
// 日本語の折り返し：測った幅で折り、行頭・行末の禁則を守る。文中の改行はそのまま
const NO_START = '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ…‥';
const NO_END = '（「『【〔〈《';
function wrap(c, s, maxWidth, o) {
  c.save();
  c.font = font(o);
  const lines = [];
  for (const para of String(s).split('\n')) {
    const tokens = para.match(/[A-Za-z0-9][A-Za-z0-9.,:=_\-/@]*|\s+|[\s\S]/gu) || [];
    let line = '';
    for (const token of tokens) {
      const next = line + token;
      if (line.trim() && !/^\s+$/.test(token) && c.measureText(next).width > maxWidth) {
        let carry = token;
        if (NO_START.includes(token[0]) && line.length > 1) {
          carry = line.slice(-1) + carry;
          line = line.slice(0, -1);
        }
        while (line.length > 1 && NO_END.includes(line.slice(-1))) {
          carry = line.slice(-1) + carry;
          line = line.slice(0, -1);
        }
        lines.push(line.trimEnd());
        line = carry;
      } else {
        line = next;
      }
    }
    lines.push(line.trimEnd());
  }
  c.restore();
  return lines;
}
// 折り返して描き、最後の行のベースラインを返す
function block(c, s, x, y, maxWidth, lineHeight, o) {
  const lines = wrap(c, s, maxWidth, o);
  lines.forEach((line, i) => text(c, line, x, y + i * lineHeight, o));
  return y + (lines.length - 1) * lineHeight;
}
function roundRect(c, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}
function pill(c, label, x, y, h, o) {
  c.save();
  c.font = font(o);
  const w = o.width || Math.ceil(c.measureText(label).width) + 2 * (o.pad === undefined ? 14 : o.pad);
  roundRect(c, x, y, w, h, h / 2);
  if (o.fill) {
    c.fillStyle = o.fill;
    c.fill();
  }
  if (o.stroke) {
    c.strokeStyle = o.stroke;
    c.lineWidth = o.lineWidth || 1.5;
    c.stroke();
  }
  c.fillStyle = o.color || C.ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, x + w / 2, y + h / 2 + 1);
  c.restore();
  return w;
}
// 左の細い縦線（原出力・原稿は控えめ、直した字幕はすもも色）
function rule(c, x, y1, y2, color, width) {
  c.save();
  c.fillStyle = color;
  c.fillRect(x, y1, width, Math.max(2, y2 - y1));
  c.restore();
}

// 実画面の切り抜きを、等倍率でそのまま置く（画素は変えない）
function drawShot(c, f, key, place, alpha, dy = 0, shadow = true) {
  if (alpha <= 0.001) return null;
  const crop = CROPS[key], img = f.img[crop.img];
  const x = place.x, y = place.y + dy, w = crop.w * place.s, h = crop.h * place.s;
  c.save();
  c.globalAlpha *= alpha;
  if (shadow) {
    c.save();
    c.shadowColor = 'rgba(28, 24, 20, 0.14)';
    c.shadowBlur = 18;
    c.shadowOffsetY = 6;
    roundRect(c, x, y, w, h, 8);
    c.fillStyle = C.card;
    c.fill();
    c.restore();
  }
  c.save();
  roundRect(c, x, y, w, h, 8);
  c.clip();
  c.drawImage(img, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
  c.restore();
  roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  c.strokeStyle = C.line;
  c.lineWidth = 1;
  c.stroke();
  c.restore();
  return {x, y, w, h, s: place.s, crop};
}
const toScreen = (shot, r) => ({
  x: shot.x + (r.x - shot.crop.x) * shot.s,
  y: shot.y + (r.y - shot.crop.y) * shot.s,
  w: r.w * shot.s,
  h: r.h * shot.s
});
function shotLabel(c, s, x, y, alpha) {
  if (alpha > 0) text(c, s, x, y, {size: 16, weight: 600, color: C.muted, alpha});
}

// ---- いつも出ている枠：見出しの上の4段階と、出典の足元 ---------------------
function drawChrome(c, t) {
  text(c, 'Studio Yebisu ・ Whisper 作例', 80, 46, {size: 16, weight: 600, color: C.muted});
  // 4段階：いまの段階をすもも色で示す（場面の重なりに合わせて色を移す）
  const weight = STEPS.map((_, k) => SCENES.reduce((sum, s, i) => sum + (s.step === k ? sceneAlpha(t, i) : 0), 0));
  const current = SCENES.find((s, i) => t < s.end || i === SCENES.length - 1).step;
  const o = {size: 17, weight: 700};
  const widths = STEPS.map(label => measure(c, label, o));
  const gap = 30, dot = 24;
  const total = widths.reduce((a, w) => a + w + dot + 8, 0) + gap * (STEPS.length - 1);
  let x = 1200 - total;
  STEPS.forEach((label, k) => {
    const on = clamp01(weight[k]);
    const base = k < current ? C.ink : C.muted;
    const cx = x + dot / 2, cy = 40;
    c.save();
    c.beginPath();
    c.arc(cx, cy, dot / 2 - 1, 0, Math.PI * 2);
    c.strokeStyle = base;
    c.lineWidth = 1.5;
    c.stroke();
    if (on > 0) {
      c.globalAlpha = on;
      c.fillStyle = C.plum;
      c.fill();
    }
    c.restore();
    text(c, String(k + 1), cx, cy + 5, {size: 14, weight: 700, color: base, align: 'center', alpha: 1 - on});
    text(c, String(k + 1), cx, cy + 5, {size: 14, weight: 700, color: '#ffffff', align: 'center', alpha: on});
    const lx = x + dot + 8;
    text(c, label, lx, 46, {...o, color: base, alpha: 1 - on});
    text(c, label, lx, 46, {...o, color: C.plum, alpha: on});
    if (on > 0) {
      c.save();
      c.globalAlpha = on;
      c.fillStyle = C.plum;
      c.fillRect(lx, 54, widths[k], 2);
      c.restore();
    }
    x = lx + widths[k] + gap;
  });
  c.save();
  c.fillStyle = C.line;
  c.fillRect(80, 66, 1120, 1);
  c.fillRect(80, CONTENT_BOTTOM, 1120, 1);
  c.restore();
  // 足元：無音・合成音声・編集でつないだ静止画であること
  const foot = '無音 ・ 入力は作例用原稿の合成音声 ・ 実画面の静止キャプチャを編集でつないだ解説（連続録画ではありません）';
  const lines = wrap(c, foot, 960, {size: 16, weight: 500});
  lines.forEach((line, i) => text(c, line, 80, 692 - (lines.length - 1) * 20 + i * 20, {size: 16, weight: 500, color: C.inkSoft}));
  text(c, 'Studio Yebisu', 1200, 692, {size: 16, weight: 600, color: C.muted, align: 'right'});
}

function drawHeadlines(c, t, f) {
  SCENES.forEach((s, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    const dy = i === 0 ? 0 : 8 * (1 - easeOut(prog(t, s.start - 0.05, s.start + 0.4)));
    text(c, s.headline(f), 80, 118 + dy, {size: 40, weight: 600, family: 'mincho', alpha: a});
  });
}

// ---- 入力WAVのRMS（場面1で大きく、場面2で小さくして区間の時刻を重ねる） ------
const WAVE_BIG = {x: 80, y: 372, w: 1120, h: 180};
const WAVE_SMALL = {x: 600, y: 190, w: 600, h: 66};
function waveX(f, rect, seconds) {
  return rect.x + (seconds / f.duration) * rect.w;
}
function drawWave(c, t, f) {
  const k = easeInOut(prog(t, 3.6, 4.4));
  const alpha = t < 4.4 ? 1 : sceneAlpha(t, 1);
  if (alpha <= 0.001) return;
  const r = {
    x: lerp(WAVE_BIG.x, WAVE_SMALL.x, k), y: lerp(WAVE_BIG.y, WAVE_SMALL.y, k),
    w: lerp(WAVE_BIG.w, WAVE_SMALL.w, k), h: lerp(WAVE_BIG.h, WAVE_SMALL.h, k)
  };
  const grow = easeOut(prog(t, 0.1, 0.9)); // 高さが伸びる演出。再生位置を表すものではない
  const peak = Math.max(...f.rms);
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = C.line;
  c.fillRect(r.x, r.y + r.h, r.w, 1);
  c.fillStyle = C.plum;
  f.rms.forEach((v, i) => {
    const x1 = waveX(f, r, i * f.windowSeconds);
    const x2 = waveX(f, r, Math.min((i + 1) * f.windowSeconds, f.duration));
    const bw = Math.max(1, (x2 - x1) * 0.7);
    const h = (v / peak) * r.h * grow;
    if (h > 0.2) c.fillRect(x1, r.y + r.h - h, bw, h);
  });
  c.restore();

  // 場面1：ラベルと時間の目盛り
  const a1 = sceneAlpha(t, 0);
  if (a1 > 0.001) {
    c.save();
    c.globalAlpha = a1 * (1 - k);
    text(c, '入力WAVのRMS（0.1秒ごと）— 音の大きさの目安で、認識の信頼度ではありません', 80, 356, {size: 16, weight: 600, color: C.muted});
    for (const s of [0, 5, 10, 15]) {
      const x = waveX(f, WAVE_BIG, s);
      c.fillStyle = C.quiet;
      c.fillRect(x, WAVE_BIG.y + WAVE_BIG.h + 1, 1, 8);
      text(c, s === 0 ? '0秒' : String(s), x, 584, {size: 16, color: C.muted, align: s === 0 ? 'left' : 'center'});
    }
    text(c, `${fmtS(f.duration)}秒`, WAVE_BIG.x + WAVE_BIG.w, 584, {size: 16, weight: 700, color: C.inkSoft, align: 'right'});
    c.restore();
  }

  // 場面2：Whisper が返した区間の時刻を、同じ時間の軸に並べる
  const a2 = Math.min(alpha, enter(t, 4.3, 0.4));
  if (a2 > 0.001) {
    c.save();
    c.globalAlpha = a2;
    text(c, `入力WAVのRMSと、Whisperが返した${f.segs.length}区間の時刻`, WAVE_SMALL.x, 176, {size: 16, weight: 600, color: C.muted});
    f.segs.forEach(s => {
      const x1 = waveX(f, WAVE_SMALL, s.start) + 1, x2 = waveX(f, WAVE_SMALL, s.end) - 1;
      const featured = s.id === FEATURE_ID;
      c.fillStyle = featured ? C.plum : C.quiet;
      c.fillRect(x1, WAVE_SMALL.y + WAVE_SMALL.h + 10, Math.max(2, x2 - x1), 6);
      text(c, `id ${s.id}`, (x1 + x2) / 2, WAVE_SMALL.y + WAVE_SMALL.h + 38, {size: 16, weight: featured ? 700 : 500, color: featured ? C.plum : C.muted, align: 'center'});
    });
    c.restore();
  }
}

// ---- 場面 ------------------------------------------------------------------
function drawInput(c, t, f) {
  const a = sceneAlpha(t, 0);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a;
  text(c, '入力', 80, 182, {size: 18, weight: 700, color: C.muted});
  text(c, '作例用の原稿を読み上げた合成音声', 80, 222, {size: 28, weight: 700});
  text(c, `${f.voice}・人の録音ではありません`, 80, 256, {size: 18, color: C.inkSoft});
  text(c, f.audioFacts, 80, 304, {size: 26, weight: 700, color: C.plum});
  text(c, '依頼（request.txt より）', 760, 182, {size: 16, weight: 700, color: C.muted});
  block(c, f.requestInput, 760, 220, 440, 32, {size: 20, color: C.ink});
  c.restore();
}

function drawRaw(c, t, f) {
  const a = sceneAlpha(t, 1);
  if (a <= 0.001) return;
  const seg = f.segs[FEATURE_ID];
  c.save();
  c.globalAlpha = a;
  shotLabel(c, '実画面：区間の一覧（保存済みの原出力をそのまま表示）', 80, 162, 1);
  drawShot(c, f, 'rawList', PLACE.rawList, 1, rise(t, 4.0, 0.45));
  const k = enter(t, 4.45, 0.4), dy = rise(t, 4.45, 0.4);
  c.globalAlpha = a * k;
  text(c, `実際の原出力 id ${seg.id}（${fmtS(seg.start)}〜${fmtS(seg.end)}秒）`, 600, 344 + dy, {size: 18, weight: 700, color: C.plum});
  const last = block(c, seg.text, 600, 390 + dy, 600, 44, {size: 34, weight: 700});
  text(c, `原稿の「${STUDIO_NAME}」とは違う文字です。`, 600, last + 44, {size: 22, color: C.inkSoft});
  const facts = [
    `openai/whisper ${f.engine.commit}（固定）・ ${f.engine.model} ・ ${f.engine.device} ${f.engine.threads}スレッド`,
    `language=${f.engine.language} ・ initial_prompt なし（原稿は渡していない）`,
    '制作時に1回だけ転記。区間の時刻はWhisperの推定値です。'
  ];
  const k2 = enter(t, 4.8, 0.4);
  c.globalAlpha = a * k2;
  facts.forEach((line, i) => text(c, line, 600, last + 108 + i * 30, {size: 18, color: C.muted}));
  c.restore();
}

function drawEdit(c, t, f) {
  const a = sceneAlpha(t, 2);
  if (a <= 0.001) return;
  const seg = f.segs[FEATURE_ID], fixed = f.edited[FEATURE_ID];
  const swap = easeInOut(prog(t, 10.6, 11.05)); // 編集前と後の実画面を入れ替える（編集上のつなぎ）
  const dy = rise(t, 7.95, 0.45);
  c.save();
  c.globalAlpha = a;
  shotLabel(c, '実画面・編集前', 80, 162, 1 - swap);
  shotLabel(c, `実画面・id ${FEATURE_ID} を直した後`, 80, 162, swap);
  if (swap < 1) drawShot(c, f, 'rawEditor', PLACE.editor, 1, dy);
  const shot = drawShot(c, f, 'editEditor', PLACE.editor, swap, dy, false);
  // 実画面の「原出力といまの字幕」を枠で指す（枠は映像側で重ねたもの）
  const frame = enter(t, 11.2, 0.4);
  if (shot && frame > 0) {
    const r = toScreen(shot, COMPARE);
    c.save();
    c.globalAlpha *= frame;
    roundRect(c, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 6);
    c.strokeStyle = C.plum;
    c.lineWidth = 2.5;
    c.stroke();
    c.restore();
  }

  const X = 568, W = 632;
  // ① 原出力
  const kA = enter(t, 8.25), dA = rise(t, 8.25);
  c.globalAlpha = a * kA;
  rule(c, 548, 172 + dA, 242 + dA, C.quiet, 3);
  text(c, `① Whisperの原出力（id ${seg.id}）`, X, 190 + dA, {size: 18, weight: 700, color: C.muted});
  block(c, seg.text, X, 230 + dA, W, 38, {size: 28, weight: 600, color: C.inkSoft});
  // ② 読み上げた原稿
  const kB = enter(t, 9.3), dB = rise(t, 9.3);
  c.globalAlpha = a * kB;
  rule(c, 548, 274 + dB, 344 + dB, C.quiet, 3);
  text(c, '② 読み上げた原稿（Whisperには渡していない）', X, 292 + dB, {size: 18, weight: 700, color: C.muted});
  block(c, f.script0, X, 332 + dB, W, 38, {size: 28, weight: 600, color: C.ink});
  // ③ 直した字幕（保存した文。改行もそのまま）
  const kC = enter(t, 10.8), dC = rise(t, 10.8);
  c.globalAlpha = a * kC;
  text(c, `③ 手で直した字幕（時刻 ${fmtS(fixed.start)}〜${fmtS(fixed.end)}秒はそのまま）`, X, 398 + dC, {size: 18, weight: 700, color: C.plum});
  const lastC = block(c, fixed.text, X, 446 + dC, W, 46, {size: 34, weight: 700, color: C.plum});
  rule(c, 548, 380 + dC, lastC + 12, C.plum, 4);
  // 注記
  const kN = enter(t, 11.4);
  c.globalAlpha = a * kN;
  block(c, '原稿を参照して、手で直しました。音声を聞いて確かめた校正ではありません。', 548, lastC + 70, 652, 26, {size: 18, color: C.inkSoft});
  c.restore();
}

function drawCount(c, t, f) {
  const a = sceneAlpha(t, 3);
  if (a <= 0.001) return;
  const total = f.segs.length;
  c.save();
  c.globalAlpha = a;
  shotLabel(c, `実画面：${f.changedIds.length}区間を直した後の一覧`, 80, 162, 1);
  drawShot(c, f, 'editList', PLACE.editList, 1, rise(t, 15.45, 0.45));
  const k = enter(t, 15.75), dy = rise(t, 15.75);
  c.globalAlpha = a * k;
  const big = `${f.changedIds.length}区間`;
  text(c, big, 548, 218 + dy, {size: 60, weight: 700, color: C.plum});
  text(c, `／ 全${total}区間の文を手で修正`, 548 + measure(c, big, {size: 60, weight: 700}) + 14, 218 + dy, {size: 26, weight: 700});
  text(c, 'id', 548, 272, {size: 16, weight: 600, color: C.muted});
  text(c, '時刻（秒）', 630, 272, {size: 16, weight: 600, color: C.muted});
  text(c, '文', 900, 272, {size: 16, weight: 600, color: C.muted});
  c.fillStyle = C.line;
  c.fillRect(548, 284, 652, 1);
  f.edited.forEach((s, i) => {
    const kr = enter(t, 16.0 + i * 0.08, 0.35);
    c.globalAlpha = a * kr;
    const y = 320 + i * 46;
    const changed = f.changedIds.includes(s.id);
    text(c, `id ${s.id}`, 548, y, {size: 22, weight: 700, family: 'mono', color: changed ? C.plum : C.inkSoft});
    text(c, `${fmtS(s.start)} → ${fmtS(s.end)}`, 630, y, {size: 22, family: 'mono', color: C.ink});
    if (changed) pill(c, '手で修正', 900, y - 22, 30, {size: 16, weight: 700, fill: C.plum, color: '#ffffff'});
    else pill(c, '原出力のまま', 900, y - 22, 30, {size: 16, weight: 600, stroke: C.quiet, color: C.muted});
  });
  const kT = enter(t, 16.7);
  c.globalAlpha = a * kT;
  text(c, `時刻は${total}区間とも推定値のまま（変更なし）`, 548, 560, {size: 26, weight: 700});
  const kN = enter(t, 17.1);
  c.globalAlpha = a * kN;
  block(c, '聞いての確認はしていません。発音と時刻の正しさは未確認です。', 548, 604, 652, 26, {size: 18, color: C.inkSoft});
  c.restore();
}

function drawSrt(c, t, f) {
  const a = sceneAlpha(t, 4);
  if (a <= 0.001) return;
  const cues = f.cues, first = cues[0], lastCue = cues[cues.length - 1];
  const changed = cue => cue.text !== f.rawCues[cue.index - 1].text;
  c.save();
  c.globalAlpha = a;
  const shot = drawShot(c, f, 'savePanel', PLACE.savePanel, 1, rise(t, 19.95, 0.45));
  const below = shot ? shot.y + shot.h : 360;
  block(c, '実画面：保存パネル（SRTとTXTを保存した後に撮影。保存の状態を示す行は切り抜きの外）', 80, below + 26, 662, 22, {size: 16, weight: 600, color: C.muted});
  const k = enter(t, 20.4), dy = rise(t, 20.4);
  c.globalAlpha = a * k;
  const nChanged = cues.filter(changed).length;
  text(c, `保存したSRT：${cues.length}区間（番号は1から連番）`, 80, 466 + dy, {size: 26, weight: 700});
  text(c, `文を直したのは ${nChanged}区間`, 80, 506 + dy, {size: 26, weight: 700, color: C.plum});
  text(c, '時刻の行は、原出力のSRTと同じ', 80, 546 + dy, {size: 26, weight: 700});
  c.globalAlpha = a * enter(t, 20.8);
  block(c, 'ダウンロードの表示は撮影していません。保存されたファイルの中身で示しています。', 80, 596, 662, 24, {size: 18, color: C.inkSoft});

  // 保存した実ファイルの抜粋（最初と最後の区間をそのまま）
  const kc = enter(t, 20.15, 0.45), dc = rise(t, 20.15, 0.45);
  c.globalAlpha = a * kc;
  const box = {x: 780, y: 172 + dc, w: 420, h: 472};
  c.save();
  c.shadowColor = 'rgba(28, 24, 20, 0.12)';
  c.shadowBlur = 18;
  c.shadowOffsetY = 6;
  roundRect(c, box.x, box.y, box.w, box.h, 10);
  c.fillStyle = C.card;
  c.fill();
  c.restore();
  roundRect(c, box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1, 10);
  c.strokeStyle = C.line;
  c.lineWidth = 1;
  c.stroke();
  const ix = box.x + 26;
  text(c, 'outputs/browser-edited.srt', ix, box.y + 36, {size: 16, weight: 700, family: 'mono', color: C.plum});
  text(c, 'ブラウザーが保存した実ファイル（抜粋）', ix, box.y + 60, {size: 16, color: C.muted});
  const drawCue = (cue, y) => {
    text(c, String(cue.index), ix, y, {size: 22, weight: 700, family: 'mono'});
    if (changed(cue)) pill(c, '修正', ix + 40, y - 20, 26, {size: 14, weight: 700, fill: C.plumSoft, color: C.plum, pad: 10});
    text(c, cue.timing, ix, y + 34, {size: 19, family: 'mono', color: C.inkSoft});
    return block(c, cue.text, ix, y + 74, box.w - 52, 36, {size: 26, weight: 600, color: C.ink});
  };
  const end1 = drawCue(first, box.y + 112);
  const omitted = `⋮  ${cues[1].index}〜${cues[cues.length - 2].index} は省略`;
  text(c, omitted, ix, end1 + 42, {size: 16, color: C.muted});
  drawCue(lastCue, end1 + 92);
  c.restore();
}

function drawNext(c, t, f) {
  const a = sceneAlpha(t, 5);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a;
  shotLabel(c, '実画面：スマホ幅の初期画面（未編集）', 80, 162, 1);
  drawShot(c, f, 'phoneTop', PLACE.phoneTop, 1, rise(t, 23.95, 0.45));
  const X = 480;
  text(c, '試す順番（作例のページで）', X, 196, {size: 18, weight: 700, color: C.muted});
  let x = X;
  ['音声を開く', '文を直す', 'SRTで保存'].forEach((label, i) => {
    const k = enter(t, 24.0 + i * 0.05, 0.4);
    c.globalAlpha = a * k;
    const w = pill(c, label, x, 214 + rise(t, 24.0 + i * 0.05, 0.4, 8), 60, {size: 26, weight: 700, fill: i === 2 ? C.plum : C.card, stroke: C.plum, lineWidth: 2, color: i === 2 ? '#ffffff' : C.plum, pad: 24});
    x += w;
    if (i < 2) {
      text(c, '→', x + 22, 254, {size: 26, weight: 700, color: C.muted, align: 'center'});
      x += 44;
    }
  });
  c.globalAlpha = a * enter(t, 24.05, 0.4);
  let y = block(c, 'この動画は無音です。元の合成音声は、作例のページで再生できます。', X, 336, 720, 36, {size: 24, color: C.ink});
  y = block(c, 'ページでは Whisper は動きません。保存済みの原出力を直して、SRTで保存します。', X, y + 46, 720, 36, {size: 24, color: C.ink});
  y = block(c, '時刻は推定値のまま。音声を聞いての確認は未実施です。', X, y + 46, 720, 36, {size: 24, color: C.inkSoft});
  text(c, '映像とコード：Claude Opus 5.5 ／ 音声認識：Whisper base（制作時に1回・CPU）', X, 616, {size: 16, color: C.muted});
  c.restore();
}

// ---- 1フレームを描く --------------------------------------------------------
let facts = null;
let failure = null;
let currentT = 0;

function render(t) {
  canvas.width = canvas.width; // 前のフレームの変換・クリップ・状態をすべて捨てる
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / LW, canvas.height / LH);
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - LW * scale) / 2, (canvas.height - LH * scale) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawChrome(ctx, facts ? t : 0);
  if (!facts) {
    const message = failure ? '読み込みに失敗しました。代わりの映像は出しません。' : '実入力・出力と画面を読み込んでいます…';
    text(ctx, message, 80, 300, {size: 26, weight: 700, color: failure ? C.plum : C.muted});
    if (failure) block(ctx, failure.message, 80, 344, 1120, 28, {size: 18, color: C.inkSoft});
    return;
  }
  drawHeadlines(ctx, t, facts);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, CONTENT_TOP, LW, CONTENT_BOTTOM - CONTENT_TOP);
  ctx.clip();
  drawInput(ctx, t, facts);
  drawRaw(ctx, t, facts);
  drawWave(ctx, t, facts);
  drawEdit(ctx, t, facts);
  drawCount(ctx, t, facts);
  drawSrt(ctx, t, facts);
  drawNext(ctx, t, facts);
  ctx.restore();
}

const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');
function setStatus(state, message, detail = '') {
  root.dataset.motionStatus = state;
  if (statusEl) {
    statusEl.dataset.state = state;
    statusEl.textContent = message;
  }
  if (detailEl) detailEl.textContent = detail;
}
const clampTime = v => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(DURATION, Math.max(0, n)) : 0;
};

render(0);
setStatus('loading', '実入力・出力と画面を読み込んでいます…');

window.motionReady = (async () => {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('この環境ではSHA-256を確かめられません。http://127.0.0.1 などのローカルサーバーで開いてください');
  }
  const loaded = await Promise.all(SOURCES.map(load));
  const data = {};
  SOURCES.forEach((source, i) => { data[source.key] = loaded[i]; });
  await document.fonts.ready;
  const built = buildFacts(data);
  facts = built;
  render(currentT);
  setStatus('ready', '実入力・出力と画面を読み込みました',
    `ファイル${SOURCES.length}件のSHA-256を制作記録の値と照合し、WAVから求めたRMS、${built.segs.length}区間の時刻と文、保存したSRTの一致を確かめてから描いています。`);
  return true;
})().catch(error => {
  failure = error;
  render(currentT);
  setStatus('error', '読み込みに失敗しました：' + error.message, '代わりの映像は出しません。ファイルを確かめてから再読み込みしてください。');
  throw error;
});
window.motionReady.catch(() => {});

// 任意の時刻の完成した画面を描く。呼んだ順番や壁時計には依存しない
window.seek = seconds => {
  const t = clampTime(seconds);
  currentT = t;
  return window.motionReady.then(() => {
    render(t);
    return t;
  });
};

// ---- 編集用のプレビュー（書き出し時は何も動かさない） --------------------------
// 自動では再生しない（prefers-reduced-motion の設定にかかわらず、最初は停止）。再生は「再生」ボタンを押したときだけ
function setupPreview() {
  const play = document.getElementById('play');
  const range = document.getElementById('time');
  const clock = document.getElementById('clock');
  const reload = document.getElementById('reload');
  let playing = false, raf = 0, from = 0, startedAt = 0;
  const sec = v => v.toFixed(1) + '秒';

  function sync() {
    range.value = (Math.round(currentT * 10) / 10).toFixed(1);
    range.setAttribute('aria-valuetext', `${sec(currentT)}（全${DURATION}秒）`);
    clock.textContent = `${sec(currentT)} / ${sec(DURATION)}`;
    play.textContent = playing ? '一時停止' : '再生';
    play.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
  function tick(now) {
    if (!playing) return;
    const t = Math.min(DURATION, from + (now - startedAt) / 1000);
    currentT = t;
    render(t);
    if (t >= DURATION) {
      playing = false;
      raf = 0;
    } else {
      raf = requestAnimationFrame(tick);
    }
    sync();
  }
  function start() {
    if (!facts || playing) return;
    if (currentT >= DURATION - 0.05) currentT = 0;
    from = currentT;
    startedAt = performance.now();
    playing = true;
    raf = requestAnimationFrame(tick);
    sync();
  }
  function stop() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    sync();
  }
  function jump(t) {
    stop();
    currentT = clampTime(t);
    render(currentT);
    sync();
  }

  play.addEventListener('click', () => (playing ? stop() : start()));
  // 矢印・Home・End はスライダー標準のまま
  range.addEventListener('input', () => jump(Number(range.value)));
  // PageUp/PageDown は2秒ずつ（先頭から7回で14秒）
  range.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      jump(Math.round((currentT + (event.key === 'PageUp' ? 2 : -2)) * 10) / 10);
    }
  });
  reload.addEventListener('click', () => location.reload());
  window.motionReady.then(() => {
    play.disabled = false;
    range.disabled = false;
    sync();
  }, () => {
    reload.hidden = false;
  });
}
if (!RENDER) setupPreview();
