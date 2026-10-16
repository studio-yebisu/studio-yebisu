// しおり工房 字幕デスク（Whisper作例）。
// 保存済みの outputs/session.json と input/script.json を読み、ブラウザーの中だけで字幕の文を直して保存する。
// ここでは Whisper を動かさず、音声も送らない。区間の数と時刻は保存済みの出力のまま変えない。

const SESSION_URL = 'outputs/session.json';
const SCRIPT_URL = 'input/script.json';
const REQUEST_URL = 'request.txt';
const AUDIO_PATH = 'input/review-ja.wav';
const CASE_ID = 'review-ja';
const LOAD_TIMEOUT_MS = 15000;
const TAIL_TOLERANCE = 0.15;
const ARTIFACT_PATTERN = /^review-ja\.(json|txt|srt|vtt|tsv|jsonl)$/;
const LISTED_ARTIFACTS = new Set(['review-ja.json', 'review-ja.txt', 'review-ja.srt']);

const root = document.documentElement;
const $ = (id) => document.getElementById(id);
const els = {
  audio: $('audio'),
  mediaState: $('media-state'),
  mediaTime: $('media-time'),
  mediaSegment: $('media-segment'),
  audioError: $('audio-error'),
  audioReload: $('audio-reload'),
  facts: $('facts'),
  factMaterial: $('fact-material'),
  factDuration: $('fact-duration'),
  factEngine: $('fact-engine'),
  factCount: $('fact-count'),
  loadStatus: $('load-status'),
  retry: $('retry'),
  desk: $('desk'),
  list: $('segment-list'),
  selectedLabel: $('selected-label'),
  seekStart: $('seek-start'),
  draft: $('draft'),
  draftCount: $('draft-count'),
  draftStatus: $('draft-status'),
  draftLines: $('draft-lines'),
  resetOne: $('reset-one'),
  compareRaw: $('compare-raw'),
  compareCurrent: $('compare-current'),
  compareState: $('compare-state'),
  editedCount: $('edited-count'),
  saveSrt: $('save-srt'),
  saveTxt: $('save-txt'),
  saveStatus: $('save-status'),
  referenceSentences: $('reference-sentences'),
  record: $('record'),
  recordStatus: $('record-status'),
  extraFiles: $('extra-files'),
  requestDetails: $('request'),
  requestStatus: $('request-status'),
  requestText: $('request-text'),
  requestRetry: $('request-retry'),
  copyRequest: $('copy-request'),
  copyStatus: $('copy-status'),
};

const state = {
  session: null,
  segments: [],        // { id, start, end, raw, base } raw は保存済みの text そのまま
  drafts: new Map(),   // id → いまの文（ブラウザーの中だけ）
  buttons: new Map(),  // id → 区間のボタン
  selectedId: null,
  pendingSeek: null,   // 音声の情報が来る前に選んだ区間の開始秒
  requestedSeek: null,
  playheadId: null,
  loadController: null,
  requestLoaded: false,
  requestController: null,
};

// ---------- 小さな道具 ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isNum(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clock(seconds) {
  if (!isNum(seconds) || seconds < 0) return '—';
  const tenths = Math.floor(seconds * 10);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${tenths % 10}`;
}

function seconds2(value) {
  return `${value.toFixed(2)}秒`;
}

// SRT の時刻。固定版 whisper/utils.py の format_timestamp と同じく、ミリ秒に丸めてから分ける。
function srtTime(seconds) {
  let ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const m = Math.floor(ms / 60000);
  ms -= m * 60000;
  const s = Math.floor(ms / 1000);
  ms -= s * 1000;
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(h)}:${p2(m)}:${p2(s)},${String(ms).padStart(3, '0')}`;
}

// 書き出す字幕の文。前後の空白を除き（原典の strip と同じ）、空行は詰め、"-->" は原典と同じく "->" にする。
function cueText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n')
    .replaceAll('-->', '->');
}

function charCount(text) {
  return Array.from(text.replace(/\n/g, '')).length;
}

function lineCount(text) {
  return text === '' ? 1 : text.replace(/\r\n?/g, '\n').split('\n').length;
}

function draftOf(segment) {
  return state.drafts.has(segment.id) ? state.drafts.get(segment.id) : segment.base;
}

function isDirty(segment) {
  return draftOf(segment) !== segment.base;
}

function segmentById(id) {
  return state.segments.find((segment) => segment.id === id) || null;
}

// ---------- 読み込み ----------

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, cache: 'no-cache', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`${url} を読めませんでした（HTTP ${response.status}）。`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${url} が JSON として読めませんでした。`);
  }
}

function fail(message) {
  throw new Error(`保存済みの出力の形が想定と違います：${message}`);
}

function validateSession(data) {
  if (!data || typeof data !== 'object') fail('session.json が空です');
  if (data.schema_version !== 1) fail('schema_version が 1 ではありません');
  if (data.id !== CASE_ID) fail('id が review-ja ではありません');
  if (data.status !== 'completed') fail('転記が完了した記録ではありません');
  const audio = data.audio || {};
  if (audio.path !== AUDIO_PATH) fail('音声のパスが input/review-ja.wav ではありません');
  if (audio.kind !== 'synthetic') fail('音声の種類が synthetic ではありません');
  if (!isNum(audio.duration_seconds) || audio.duration_seconds <= 0) fail('音声の長さがありません');
  const engine = data.engine || {};
  if (engine.library !== 'openai-whisper' || engine.model !== 'base' || engine.device !== 'cpu') {
    fail('Whisper base・CPU の記録ではありません');
  }
  if (engine.reference_text_supplied !== false) fail('原稿を渡していない記録になっていません');
  const result = data.result || {};
  if (typeof result.text !== 'string') fail('result.text がありません');
  if (!Array.isArray(result.segments) || result.segments.length === 0) fail('区間がありません');

  const limit = audio.duration_seconds + TAIL_TOLERANCE;
  let previousStart = 0;
  return result.segments.map((segment, index) => {
    if (!segment || segment.id !== index) fail(`区間 ${index} の id が連番ではありません`);
    const { start, end, text } = segment;
    if (!isNum(start) || !isNum(end) || start < 0 || end < start) fail(`区間 ${index} の時刻が正しくありません`);
    if (start < previousStart) fail(`区間 ${index} の開始が前の区間より前です`);
    if (end > limit) fail(`区間 ${index} の終わりが音声の長さを超えています`);
    if (typeof text !== 'string') fail(`区間 ${index} の文がありません`);
    previousStart = start;
    return { id: index, start, end, raw: text, base: text.trim() };
  });
}

function validateScript(data) {
  if (!data || data.id !== CASE_ID || data.language !== 'ja') {
    throw new Error('input/script.json の id か language が想定と違います。');
  }
  if (!Array.isArray(data.sentences) || !data.sentences.every((s) => typeof s === 'string')) {
    throw new Error('input/script.json に原稿の文がありません。');
  }
  return data;
}

function setLoadState(kind, message) {
  root.dataset.state = kind;
  root.dataset.ready = kind === 'ready' ? 'true' : 'false';
  els.loadStatus.textContent = message;
  els.loadStatus.classList.toggle('is-error', kind === 'error');
  els.retry.hidden = kind !== 'error';
}

async function load() {
  state.loadController?.abort();
  const controller = new AbortController();
  state.loadController = controller;
  const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
  setLoadState('loading', '保存済みの出力を読み込んでいます…');

  try {
    const [sessionData, scriptData] = await Promise.all([
      fetchJson(SESSION_URL, controller.signal),
      fetchJson(SCRIPT_URL, controller.signal),
    ]);
    const segments = validateSession(sessionData);
    const script = validateScript(scriptData);
    if (controller !== state.loadController) return;

    state.session = sessionData;
    state.segments = segments;
    state.drafts = new Map();
    renderFacts(sessionData);
    renderSegments();
    renderReference(script);
    renderRecord(sessionData);
    selectSegment(segments[0].id, { seek: false });
    updateSaveState();
    setLoadState('ready', `${segments.length}区間を読み込みました。`);
  } catch (error) {
    if (controller !== state.loadController) return;
    const message = error?.name === 'AbortError'
      ? '読み込みが時間内に終わりませんでした。'
      : (error?.message || '読み込めませんでした。');
    setLoadState('error', `${message} 出力がまだ無いか、通信に失敗しました。もう一度読み込めます。`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 表示 ----------

function renderFacts(session) {
  const { audio, engine } = session;
  els.factDuration.textContent = `長さ ${seconds2(audio.duration_seconds)}`;
  els.factEngine.textContent = `Whisper ${engine.model}・CPUで転記済み`;
  els.factCount.textContent = `${session.result.segments.length}区間`;
  if (typeof audio.voice_name === 'string' && audio.voice_name) {
    els.factMaterial.textContent = '作例の原稿を読んだ合成音声です。';
  }
  els.facts.hidden = false;
}

function renderSegments() {
  els.list.replaceChildren();
  state.buttons.clear();
  for (const segment of state.segments) {
    const button = el('button', 'seg');
    button.type = 'button';
    button.dataset.segmentId = String(segment.id);
    button.setAttribute('aria-pressed', 'false');

    const head = el('span', 'seg-head');
    head.append(
      el('span', 'seg-id', `id ${segment.id}`),
      el('span', 'seg-time', `${clock(segment.start)} → ${clock(segment.end)}`),
      el('span', 'seg-flag'),
      el('span', 'seg-playhead'),
    );
    button.append(head, el('span', 'seg-text'));
    button.addEventListener('click', () => selectSegment(segment.id, { seek: true }));

    const item = el('li');
    item.append(button);
    els.list.append(item);
    state.buttons.set(segment.id, button);
    refreshButton(segment);
  }
}

function refreshButton(segment) {
  const button = state.buttons.get(segment.id);
  if (!button) return;
  const text = draftOf(segment);
  const textNode = button.querySelector('.seg-text');
  textNode.textContent = text === '' ? '（文字なし）' : text;
  textNode.classList.toggle('is-empty', text === '');
  button.querySelector('.seg-flag').textContent = isDirty(segment) ? '編集済み' : '';
  button.querySelector('.seg-playhead').textContent = state.playheadId === segment.id ? '再生位置' : '';
  button.dataset.dirty = String(isDirty(segment));
}

function renderReference(script) {
  els.referenceSentences.replaceChildren(...script.sentences.map((sentence) => el('li', '', sentence)));
}

function renderRecord(session) {
  const { audio, engine, timings, artifacts_sha256: artifacts } = session;
  const rows = [
    ['ライブラリ', `${engine.library} ${engine.version ?? ''}`.trim()],
    ['固定コミット', engine.source_commit],
    ['モデル・装置', `${engine.model}・${engine.device}・${engine.threads}スレッド`],
    ['転記の設定', `language=${engine.language}, task=${engine.task}, fp16=${engine.fp16}, temperature=${engine.temperature}, condition_on_previous_text=${engine.condition_on_previous_text}`],
    ['原稿を渡したか', engine.reference_text_supplied === false ? '渡していない（initial_prompt なし）' : '記録なし'],
    ['重みの SHA-256', engine.checkpoint_sha256],
    ['音声', `${audio.path}・${audio.sample_rate}Hz・${audio.channels}ch・${seconds2(audio.duration_seconds)}`],
    ['音声の SHA-256', audio.sha256],
    ['声', audio.voice_name],
    ['時間', timings && isNum(timings.load_seconds) && isNum(timings.transcribe_seconds)
      ? `読み込み ${seconds2(timings.load_seconds)}・転記 ${seconds2(timings.transcribe_seconds)}（この1回の実行。音声の合成と重みの取得は含まず、速度の比較ではない）`
      : undefined],
    ['記録した日時', session.recorded_at],
  ];
  els.record.replaceChildren();
  for (const [label, value] of rows) {
    if (typeof value !== 'string' || value === '') continue;
    els.record.append(el('dt', '', label), el('dd', '', value));
  }
  els.recordStatus.textContent = 'outputs/session.json から表示しています。';

  els.extraFiles.replaceChildren();
  if (artifacts && typeof artifacts === 'object') {
    for (const name of Object.keys(artifacts)) {
      if (!ARTIFACT_PATTERN.test(name) || LISTED_ARTIFACTS.has(name)) continue;
      const item = el('li');
      const link = el('a', '', `outputs/${name}`);
      link.href = `outputs/${name}`;
      item.append(link, el('span', '', 'Whisper の書き出しそのまま'));
      els.extraFiles.append(item);
    }
  }
  els.extraFiles.hidden = els.extraFiles.childElementCount === 0;
}

// ---------- 選ぶ・移る ----------

function selectSegment(id, { seek }) {
  const segment = segmentById(id);
  if (!segment) return;
  state.selectedId = id;
  els.desk.dataset.selectedId = String(id);
  for (const [buttonId, button] of state.buttons) {
    button.setAttribute('aria-pressed', String(buttonId === id));
  }
  els.selectedLabel.textContent = `選んだ区間：id ${segment.id}・${clock(segment.start)} → ${clock(segment.end)}`;
  els.draft.disabled = false;
  els.seekStart.disabled = false;
  els.draft.value = draftOf(segment);
  updateEditor();
  if (seek) seekTo(segment.start);
}

function seekTo(seconds) {
  const audio = els.audio;
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    applySeek(seconds);
    return;
  }
  state.pendingSeek = seconds;
  els.mediaSegment.textContent = `音声の情報を読み込めたら ${clock(seconds)} へ移ります。`;
  // iOS では preload="metadata" でも読み込まないことがある。選んだ操作の中で読み込みを始める。
  if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY || audio.networkState === HTMLMediaElement.NETWORK_IDLE) {
    audio.load();
  }
}

function applySeek(seconds) {
  const audio = els.audio;
  const duration = Number.isFinite(audio.duration) ? audio.duration : seconds;
  const target = Math.min(Math.max(0, seconds), duration);
  state.requestedSeek = target;
  try {
    audio.currentTime = target;
  } catch {
    state.requestedSeek = null;
    els.mediaSegment.textContent = 'この音声では再生位置を動かせませんでした。';
  }
}

// ---------- 音声の実際の状態 ----------

function setMediaState(kind, label) {
  els.mediaState.dataset.media = kind;
  els.mediaState.textContent = label;
}

function updateTime() {
  const audio = els.audio;
  const duration = Number.isFinite(audio.duration) ? audio.duration : null;
  els.mediaTime.textContent = duration === null
    ? clock(audio.currentTime)
    : `${clock(audio.currentTime)} / ${clock(duration)}`;
  updatePlayhead(audio.currentTime);
}

function updatePlayhead(time) {
  let found = null;
  if (audioHasMetadata()) {
    for (const segment of state.segments) {
      if (time >= segment.start && time < segment.end) found = segment.id;
    }
  }
  if (found === state.playheadId) return;
  const previous = state.playheadId;
  state.playheadId = found;
  for (const id of [previous, found]) {
    const segment = id === null ? null : segmentById(id);
    if (segment) refreshButton(segment);
  }
}

function audioHasMetadata() {
  return els.audio.readyState >= HTMLMediaElement.HAVE_METADATA;
}

function showAudioError() {
  setMediaState('error', '音声を読み込めません');
  els.audioError.hidden = false;
}

function bindAudio() {
  const audio = els.audio;
  audio.addEventListener('loadstart', () => {
    if (audio.readyState === 0) setMediaState('loading', '読み込み中');
  });
  // ブラウザーが先読みを止めたとき（iOS で多い）。再生や区間の選択で読み込みを始める。
  audio.addEventListener('suspend', () => {
    if (audio.readyState === 0 && !audio.error) setMediaState('idle', 'まだ読み込んでいません');
  });
  audio.addEventListener('loadedmetadata', () => {
    els.audioError.hidden = true;
    if (audio.paused) setMediaState('paused', '停止中');
    else setMediaState('playing', '再生中');
    if (state.pendingSeek !== null) {
      const target = state.pendingSeek;
      state.pendingSeek = null;
      applySeek(target);
    }
    updateTime();
  });
  audio.addEventListener('durationchange', updateTime);
  audio.addEventListener('timeupdate', updateTime);
  audio.addEventListener('seeking', updateTime);
  audio.addEventListener('seeked', () => {
    if (audio.paused && !audio.ended) setMediaState('paused', '停止中');
    updateTime();
    if (state.requestedSeek !== null && Math.abs(audio.currentTime - state.requestedSeek) < 0.25) {
      const segment = segmentById(state.selectedId);
      els.mediaSegment.textContent = segment
        ? `id ${segment.id} の頭（${clock(audio.currentTime)}）へ移りました。${audio.paused ? '再生は音声の再生ボタンで。' : ''}`
        : `${clock(audio.currentTime)} へ移りました。`;
    }
    state.requestedSeek = null;
  });
  audio.addEventListener('playing', () => setMediaState('playing', '再生中'));
  audio.addEventListener('waiting', () => setMediaState('loading', '読み込み中'));
  audio.addEventListener('pause', () => {
    if (!audio.ended) setMediaState('paused', '停止中');
  });
  audio.addEventListener('ended', () => setMediaState('paused', '終わりまで再生しました'));
  audio.addEventListener('error', showAudioError);
  els.audioReload.addEventListener('click', () => {
    els.audioError.hidden = true;
    audio.load();
  });

  // モジュールは後から動くので、それまでに起きた状態を拾う。
  if (audio.error) {
    showAudioError();
  } else if (audioHasMetadata()) {
    if (audio.paused) setMediaState('paused', '停止中');
    else setMediaState('playing', '再生中');
    updateTime();
  } else if (audio.networkState === HTMLMediaElement.NETWORK_LOADING) {
    setMediaState('loading', '読み込み中');
  }
}

// ---------- 直す ----------

function updateEditor() {
  const segment = segmentById(state.selectedId);
  if (!segment) return;
  const current = draftOf(segment);
  const dirty = isDirty(segment);
  const lines = lineCount(current);

  els.draft.dataset.dirty = String(dirty);
  els.draftStatus.dataset.dirty = String(dirty);
  if (els.draftStatus.textContent !== (dirty ? '編集中' : '未編集')) {
    els.draftStatus.textContent = dirty ? '編集中' : '未編集';
  }
  els.draftCount.textContent = `${charCount(current)}文字・${lines}行`;
  els.draftLines.hidden = lines <= 2;
  els.resetOne.disabled = !dirty;

  els.compareRaw.textContent = segment.base === '' ? '（文字なし）' : segment.base;
  els.compareCurrent.textContent = current === '' ? '（文字なし）' : current;
  els.compareState.textContent = dirty
    ? '原出力と違います。保存する SRT にはいまの字幕が入り、時刻は原出力のままです。'
    : '原出力と同じです。';

  refreshButton(segment);
  updateSaveState();
}

function editedSegments() {
  return state.segments.filter(isDirty);
}

function updateSaveState() {
  const edited = editedSegments().length;
  els.desk.dataset.editedCount = String(edited);
  els.editedCount.textContent = edited === 0
    ? '編集した区間はまだありません。そのまま保存すると原出力と同じ文になります。'
    : `${state.segments.length}区間のうち ${edited}区間を編集しています。`;
  const ready = state.segments.length > 0;
  els.saveSrt.disabled = !ready;
  els.saveTxt.disabled = !ready;
}

function bindEditor() {
  els.draft.addEventListener('input', () => {
    const segment = segmentById(state.selectedId);
    if (!segment) return;
    state.drafts.set(segment.id, els.draft.value);
    updateEditor();
  });
  els.resetOne.addEventListener('click', () => {
    const segment = segmentById(state.selectedId);
    if (!segment) return;
    state.drafts.delete(segment.id);
    els.draft.value = segment.base;
    updateEditor();
    els.draft.focus();
  });
  els.seekStart.addEventListener('click', () => {
    const segment = segmentById(state.selectedId);
    if (segment) seekTo(segment.start);
  });
}

// ---------- 保存 ----------

function buildSrt() {
  return state.segments
    .map((segment, index) => `${index + 1}\n${srtTime(segment.start)} --> ${srtTime(segment.end)}\n${cueText(draftOf(segment))}\n\n`)
    .join('');
}

function buildTxt() {
  return state.segments.map((segment) => `${cueText(draftOf(segment))}\n`).join('');
}

function saveFile(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function bindSave() {
  const run = (kind) => {
    try {
      const edited = editedSegments().length;
      if (kind === 'srt') {
        saveFile(buildSrt(), 'review-ja-edited.srt', 'application/x-subrip;charset=utf-8');
      } else {
        saveFile(buildTxt(), 'review-ja-edited.txt', 'text/plain;charset=utf-8');
      }
      els.saveStatus.dataset.status = `saved-${kind}`;
      els.saveStatus.textContent = `review-ja-edited.${kind}（${state.segments.length}区間・編集 ${edited}区間）をブラウザーの保存に渡しました。保存できたかはブラウザーの表示で確かめてください。`;
    } catch {
      els.saveStatus.dataset.status = 'error';
      els.saveStatus.textContent = 'ファイルを作れませんでした。このブラウザーではダウンロードできない可能性があります。';
    }
  };
  els.saveSrt.addEventListener('click', () => run('srt'));
  els.saveTxt.addEventListener('click', () => run('txt'));
}

// ---------- 依頼文 ----------

async function loadRequest() {
  state.requestController?.abort();
  const controller = new AbortController();
  state.requestController = controller;
  const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
  els.requestStatus.textContent = '依頼文を読み込んでいます…';
  els.requestRetry.hidden = true;
  els.copyRequest.disabled = true;
  try {
    const response = await fetch(REQUEST_URL, { signal: controller.signal, cache: 'no-cache', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (controller !== state.requestController) return;
    els.requestText.value = text;
    els.requestStatus.textContent = 'request.txt を読み込みました。';
    els.copyRequest.disabled = text.trim() === '';
    state.requestLoaded = true;
  } catch (error) {
    if (controller !== state.requestController) return;
    els.requestStatus.textContent = `依頼文を読み込めませんでした（${error?.name === 'AbortError' ? '時間切れ' : error?.message || '不明'}）。もう一度読み込めます。`;
    els.requestRetry.hidden = false;
  } finally {
    clearTimeout(timer);
  }
}

function manualCopyFallback() {
  els.requestText.focus();
  els.requestText.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  return copied;
}

async function copyRequest() {
  const text = els.requestText.value;
  els.copyStatus.classList.remove('is-error');
  els.copyStatus.textContent = '';
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      els.copyStatus.textContent = '依頼文をコピーしました。';
      return;
    } catch {
      // 下の手動の方法へ
    }
  }
  if (manualCopyFallback()) {
    els.copyStatus.textContent = '依頼文をコピーしました。';
  } else {
    els.copyStatus.classList.add('is-error');
    els.copyStatus.textContent = 'コピーできませんでした。依頼文を選択したので、長押ししてコピーしてください。';
  }
}

function bindRequest() {
  els.requestDetails.addEventListener('toggle', () => {
    if (els.requestDetails.open && !state.requestLoaded && !state.requestController) loadRequest();
  });
  els.requestRetry.addEventListener('click', loadRequest);
  els.copyRequest.addEventListener('click', copyRequest);
}

// ---------- 開始 ----------

bindAudio();
bindEditor();
bindSave();
bindRequest();
els.retry.addEventListener('click', load);
load();
