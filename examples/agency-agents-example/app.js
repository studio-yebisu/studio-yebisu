'use strict';

/*
 * app.js — 役割をつなぎ、使える予定へ。（架空イベント「こもれび つくる日」の図のページ）
 *
 * visual-r1 の再改修。元の2段階（UX Architect → Frontend Developer）の成果を読み込んで1枚の図にする。
 * 元の成果（input/event.json・outputs/*・foundation.css・comparison.*）は書き換えない。
 * 重なりの判定（半開区間）、重なる追加を止めて今の予定を残す動き、書き出しの形と項目の順番は、
 * 元の comparison.js（Frontend Developer 段階の実装）をそのまま引き継ぐ。
 * 起動時に data-manifest.json を固定の SHA-256 で確かめ、記載の7ファイルのバイト数・SHA-256・形を
 * 確かめてから描く。取得したデータは textContent と DOM API だけで描き、HTML として差し込まない。
 */
(() => {
  /* ---------- 固定値 ---------- */

  const MANIFEST_PATH = 'data-manifest.json';
  const MANIFEST_SHA256 = '7f520d44c2961ace15a96399266e7c6223cda5e442db2913dadecc154024775c';
  const MANIFEST_FORMAT = 'studio-yebisu-agency-visual-data-v1';
  const FILES = Object.freeze({
    event: 'input/event.json',
    handoff: 'outputs/ux-handoff.json',
    recorded: 'outputs/browser-itinerary.json',
    alternative: 'outputs/browser-itinerary-alternative.json',
    samples: 'samples.json',
    request: 'request.txt',
    foundation: 'foundation.css',
  });
  const FILE_ORDER = Object.freeze(Object.values(FILES));
  const ROLE_SOURCE = Object.freeze({
    repository: 'msitarzewski/agency-agents',
    commit: 'bd956db032d907387e6b9ddebff3e18f1de8c679',
  });
  const ROLE_IDS = ['ux-architect', 'frontend-developer'];
  const ROLE_ANCHORS = Object.freeze({ 'ux-architect': 'role-ux', 'frontend-developer': 'role-frontend' });
  const HANDOFF_MODE = 'sequential-role-application';
  const SESSION_IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
  // 保存済みの書き出し2つ。読み込み時に、この画面の書き出しで同じバイト列になることまで確かめる
  const RECORD_EXPECT = Object.freeze({
    [FILES.recorded]: Object.freeze({ ids: ['S01', 'S03', 'S05', 'S06'], total: 1000 }),
    [FILES.alternative]: Object.freeze({ ids: ['S01', 'S03', 'S04', 'S06'], total: 500 }),
  });
  // 図の帯に書く短い呼び名（動画の video/assets/diagram-data.json の short_label と同じ）。正式名は各所に全文で出す
  const SHORT_LABELS = Object.freeze({
    S01: '押し花',
    S02: '種の話',
    S03: '紙の町',
    S04: '音さんぽ',
    S05: '糸の布',
    S06: 'ほつれ相談',
  });
  const THEME_KEY = 'studio-yebisu.agency-agents-example.theme';
  const THEMES = ['system', 'light', 'dark'];
  const KIND_LABELS = Object.freeze({ workshop: 'ワークショップ', talk: 'トーク', consultation: '相談' });
  const FILTER_VALUES = Object.freeze({
    kind: ['all', 'workshop', 'talk', 'consultation'],
    time: ['all', 'morning', 'afternoon'],
    fee: ['all', 'free', 'paid'],
  });
  const NOON = 12 * 60;
  // 書き出しの固定文。元の comparison.js と同じ文字列で、保存済みの記録とも一致を確かめる
  const EXPORT_FORMAT = 'komorebi-itinerary/v1';
  const EXPORT_NOTICE = '架空のイベントの予定メモです。予約・支払い・参加確定ではありません。';
  const SELECTION_RULE = '開始が相手の終了より前で、相手の開始が終了より前なら重なりとし、重なる企画は同時に選ばない。終了と開始が同時刻なら重ならない。予約不要の企画も開始から終了までの枠全体を使う。';
  const EXPORT_KEYS = ['format', 'fictional', 'reserved', 'notice', 'event', 'source', 'selection_rule', 'selected_ids', 'sessions', 'derived'];
  const SEARCH_DELAY = 400;
  const ANNOUNCE_DELAY = 60;
  const REVOKE_DELAY = 60000;
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const SLUG_RE = /^[A-Za-z0-9_-]+$/;
  const PATH_RE = /^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/;
  const HEX64_RE = /^[0-9a-f]{64}$/;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- SHA-256 ---------- */

  const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  // crypto.subtle が使えない環境（HTTP の非安全な配信など）でも同じ値を出す、ビルドなしの実装
  function sha256Fallback(bytes) {
    const length = bytes.length;
    const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
    padded.set(bytes);
    padded[length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(length / 0x20000000));
    view.setUint32(padded.length - 4, (length << 3) >>> 0);
    const hash = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i += 1) {
        const a = w[i - 15];
        const b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = hash;
      for (let i = 0; i < 64; i += 1) {
        const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + s1 + ch + SHA_K[i] + w[i]) >>> 0;
        const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (s0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }
    return Array.from(hash, (word) => word.toString(16).padStart(8, '0')).join('');
  }

  async function sha256Hex(bytes) {
    const subtle = window.crypto && window.crypto.subtle;
    if (subtle && typeof subtle.digest === 'function') {
      try {
        const digest = await subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      } catch {
        // 下の実装で計算する
      }
    }
    return sha256Fallback(bytes);
  }

  /* ---------- 画面の要素 ---------- */

  const $ = (id) => document.getElementById(id);

  const ui = {
    root: document.documentElement,
    themeButtons: Array.from(document.querySelectorAll('[data-theme-choice]')),
    themeNote: $('theme-note'),
    themeMeta: document.querySelector('meta[name="theme-color"]'),
    heroEvent: $('hero-event'),
    map: $('map'),
    loadStatus: $('load-status'),
    loadError: $('load-error'),
    loadErrorReason: $('load-error-reason'),
    loadRetry: $('load-retry'),
    figure: $('figure'),
    wires: $('wires'),
    nodeInput: $('node-input'),
    nodeUx: $('node-ux'),
    nodeFe: $('node-fe'),
    filterNote: $('filter-note'),
    filterNoteText: $('filter-note-text'),
    filterNoteReset: $('filter-note-reset'),
    timemap: $('timemap'),
    plan: $('plan'),
    tryRecorded: $('try-recorded'),
    planChips: $('plan-chips'),
    saveReason: $('save-reason'),
    focusLine: $('focus-line'),
    toggle: $('toggle-session'),
    save: $('save-json'),
    focusNote: $('focus-note'),
    actionStatus: $('action-status'),
    detailBody: $('detail-body'),
    filterForm: $('filter-form'),
    filterSet: $('filter-set'),
    query: $('filter-query'),
    kind: $('filter-kind'),
    time: $('filter-time'),
    fee: $('filter-fee'),
    filterReset: $('filter-reset'),
    filtersTitle: $('filters-title'),
    resultStatus: $('result-status'),
    noResults: $('no-results'),
    noResultsReset: $('no-results-reset'),
    itineraryTitle: $('itinerary-title'),
    itineraryEmpty: $('itinerary-empty'),
    itineraryList: $('itinerary-list'),
    itinerarySummary: $('itinerary-summary'),
    itineraryCount: $('itinerary-count'),
    itinerarySpan: $('itinerary-span'),
    itineraryTotal: $('itinerary-total'),
    itineraryReservation: $('itinerary-reservation'),
    recordMatch: $('record-match'),
    exportStatus: $('export-status'),
    clearButton: $('clear-button'),
    sessionsAll: $('sessions-all'),
    sessionsAllList: $('sessions-all-list'),
    info: {
      title: $('info-title'),
      subtitle: $('info-subtitle'),
      date: $('info-date'),
      timezone: $('info-timezone'),
      hours: $('info-hours'),
      venue: $('info-venue'),
      admission: $('info-admission'),
      area: $('info-area'),
      reservation: $('info-reservation'),
      access: $('info-access'),
      weather: $('info-weather'),
    },
    roles: $('roles'),
    decisionA09: $('decision-a09-text'),
    decisionA06: $('decision-a06-text'),
    decisionRule: $('decision-rule'),
    samplesList: $('samples-list'),
    requestText: $('request-text'),
    copyButton: $('copy-request'),
    copyStatus: $('copy-status'),
    copyFallback: $('copy-fallback'),
    copyFallbackText: $('copy-fallback-text'),
  };

  /* ---------- 状態（1か所） ---------- */

  const state = {
    status: 'loading', // 'loading' | 'ready' | 'error'
    event: null,
    handoff: null,
    recorded: null,
    alternative: null,
    samples: null,
    requestText: '',
    sessions: [], // 開始→終了→ID の順
    selected: new Set(), // 保存しない。再読み込みで空に戻る
    focusId: null,
    filters: { kind: 'all', time: 'all', fee: 'all', query: '' },
    visible: new Set(),
    recent: null, // 直前の入力の変化（図の強調に使う）
    theme: 'system',
    themeSaveFailed: false,
  };

  let view = null; // 図の要素（読み込みごとに作り直す）
  let loadToken = 0;
  let loadController = null;
  let recentSerial = 0;
  let appliedRecent = 0;

  /* ---------- 小さな道具 ---------- */

  class LoadError extends Error {
    constructor(kind, detail) {
      super(detail);
      this.kind = kind; // 'network' | 'http' | 'parse' | 'integrity' | 'validation'
      this.detail = detail;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function timeEl(date, hm) {
    const node = el('time', null, hm);
    node.dateTime = `${date}T${hm}`;
    return node;
  }

  const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isText = (value) => typeof value === 'string' && value.trim() !== '';
  const isTextArray = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);
  const isTime = (value) => typeof value === 'string' && TIME_RE.test(value);
  const isSafePath = (value) => typeof value === 'string' && PATH_RE.test(value) && !value.split('/').includes('..');
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function toMinutes(hm) {
    const match = TIME_RE.exec(hm);
    return Number(match[1]) * 60 + Number(match[2]);
  }

  const fmtClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

  function isCalendarDate(value) {
    const match = DATE_RE.exec(value);
    if (!match) return false;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  const normalize = (value) => value.normalize('NFKC').toLowerCase();
  const fmtFee = (yen) => (yen === 0 ? '無料' : `${yen.toLocaleString('ja-JP')}円`);
  const fmtTotal = (yen) => `${yen.toLocaleString('ja-JP')}円`;
  const fmtRange = (session) => `${session.start}–${session.end}`;
  const fmtCapacity = (capacity) => (capacity === null ? '設定なし' : `${capacity}人（企画上の設定。残席ではありません）`);
  const fmtReservation = (required) => (required ? '必要（この作例では受付しません）' : '不要');
  const duration = (session) => toMinutes(session.end) - toMinutes(session.start);
  const shortLabel = (session) => (hasOwn(SHORT_LABELS, session.id) ? SHORT_LABELS[session.id] : session.title.slice(0, 4));
  const quoteTitles = (sessions) => sessions.map((s) => `「${s.title}」`).join('・');

  function fmtDate(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return `${year}年${month}月${day}日`;
  }

  function compareSessions(a, b) {
    return (
      toMinutes(a.start) - toMinutes(b.start) ||
      toMinutes(a.end) - toMinutes(b.end) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  }

  // 半開区間 [start, end) の重なり。終了と開始が同時刻なら重ならない
  function overlaps(a, b) {
    return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
  }

  function overlapRange(a, b) {
    const start = toMinutes(a.start) >= toMinutes(b.start) ? a.start : b.start;
    const end = toMinutes(a.end) <= toMinutes(b.end) ? a.end : b.end;
    return `${start}–${end}`;
  }

  const describeClashes = (session, clashes) =>
    clashes.map((c) => `「${c.title}」（${c.id}・${fmtRange(c)}）と${overlapRange(session, c)}の時間`).join('、');

  const reduceMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let announceTimer = 0;
  function announce(message) {
    window.clearTimeout(announceTimer);
    ui.actionStatus.textContent = '';
    announceTimer = window.setTimeout(() => {
      ui.actionStatus.textContent = message;
    }, ANNOUNCE_DELAY);
  }

  function setLiveText(node, message) {
    node.textContent = '';
    window.setTimeout(() => {
      node.textContent = message;
    }, ANNOUNCE_DELAY);
  }

  function setBusy(button, busy, idleLabel) {
    if (busy) {
      button.setAttribute('aria-disabled', 'true');
      button.textContent = '読み込み中…';
    } else {
      button.removeAttribute('aria-disabled');
      button.textContent = idleLabel;
    }
  }

  /* ---------- 取得と固定値の照合 ---------- */

  async function fetchBytes(path, signal) {
    let response;
    try {
      response = await fetch(path, { cache: 'no-store', signal });
    } catch (error) {
      if (error && error.name === 'AbortError') throw error;
      throw new LoadError('network', `${path}：通信に失敗しました。`);
    }
    if (!response.ok) throw new LoadError('http', `${path}：サーバーが ${response.status} を返しました。`);
    try {
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (error && error.name === 'AbortError') throw error;
      throw new LoadError('network', `${path}：通信が途中で切れました。`);
    }
  }

  const utf8 = new TextDecoder('utf-8', { fatal: true });

  function decodeText(bytes, path) {
    try {
      return utf8.decode(bytes);
    } catch {
      throw new LoadError('parse', `${path}：UTF-8 の文字として読めませんでした。`);
    }
  }

  function parseJSON(text, path) {
    try {
      return JSON.parse(text);
    } catch {
      throw new LoadError('parse', `${path}：JSONとして読めませんでした。`);
    }
  }

  async function verifyEntry(entry, signal) {
    const bytes = await fetchBytes(entry.path, signal);
    if (bytes.byteLength !== entry.bytes) {
      throw new LoadError('integrity', `${entry.path}：バイト数が記録の ${entry.bytes} と違います（${bytes.byteLength}）。内容が変わっています。`);
    }
    const digest = await sha256Hex(bytes);
    if (digest !== entry.sha256) {
      throw new LoadError('integrity', `${entry.path}：SHA-256 が記録と一致しません。内容が変わっています。`);
    }
    return bytes;
  }

  const asLoadError = (error) =>
    error instanceof LoadError ? error : new LoadError('validation', '想定していない形式のデータでした。');

  /* ---------- 形の検証 ---------- */

  function fail(where, reason) {
    throw new LoadError('validation', `${where} の形式が正しくありません（${reason}）。`);
  }

  function requireText(object, key, where) {
    if (!isText(object[key])) fail(`${where}${key}`, '空でない文字列が必要です');
  }

  function validateManifest(data) {
    const where = `${MANIFEST_PATH} の`;
    if (!isPlainObject(data)) fail(`${where}最上位`, 'オブジェクトが必要です');
    if (data.format !== MANIFEST_FORMAT) fail(`${where}format`, `${MANIFEST_FORMAT} が必要です`);
    if (data.source !== ROLE_SOURCE.repository) fail(`${where}source`, `${ROLE_SOURCE.repository} が必要です`);
    if (data.commit !== ROLE_SOURCE.commit) fail(`${where}commit`, '固定コミットが必要です');
    if (!Array.isArray(data.files) || data.files.length !== FILE_ORDER.length) fail(`${where}files`, `${FILE_ORDER.length}件の配列が必要です`);
    data.files.forEach((entry, index) => {
      const at = `${where}files[${index}]`;
      if (!isPlainObject(entry)) fail(at, 'オブジェクトが必要です');
      if (entry.path !== FILE_ORDER[index]) fail(`${at}.path`, `${FILE_ORDER[index]} が必要です`);
      if (!Number.isInteger(entry.bytes) || entry.bytes <= 0) fail(`${at}.bytes`, '1以上の整数が必要です');
      if (typeof entry.sha256 !== 'string' || !HEX64_RE.test(entry.sha256)) fail(`${at}.sha256`, '64桁の16進数が必要です');
    });
    return data;
  }

  function validateEvent(data) {
    const where = `${FILES.event} の`;
    if (!isPlainObject(data)) fail(`${where}最上位`, 'オブジェクトが必要です');
    ['id', 'title', 'subtitle', 'venue', 'area', 'admission', 'reservation_note', 'access', 'weather'].forEach((key) =>
      requireText(data, key, where),
    );
    if (!SLUG_RE.test(data.id)) fail(`${where}id`, '英数字・ハイフン・下線だけが使えます');
    if (data.fictional !== true) fail(`${where}fictional`, 'この作例は架空のイベントだけを表示するため true が必要です');
    if (typeof data.date !== 'string' || !isCalendarDate(data.date)) fail(`${where}date`, 'YYYY-MM-DD の実在する日付が必要です');
    if (data.timezone !== 'Asia/Tokyo') fail(`${where}timezone`, 'このページは日本時間で表示するため Asia/Tokyo が必要です');
    if (!isTime(data.opening)) fail(`${where}opening`, 'HH:MM の時刻が必要です');
    if (!isTime(data.closing)) fail(`${where}closing`, 'HH:MM の時刻が必要です');
    if (toMinutes(data.opening) >= toMinutes(data.closing)) fail(`${where}closing`, '開場より後の時刻が必要です');
    if (!Array.isArray(data.sessions)) fail(`${where}sessions`, '配列が必要です');
    if (data.sessions.length !== SESSION_IDS.length) {
      fail(`${where}sessions`, `${SESSION_IDS.length}件の企画が必要です（${data.sessions.length}件でした）`);
    }
    const ids = new Set();
    data.sessions.forEach((session, index) => {
      const at = `${where}sessions[${index}].`;
      if (!isPlainObject(session)) fail(`${where}sessions[${index}]`, 'オブジェクトが必要です');
      ['id', 'title', 'room', 'age', 'description', 'note'].forEach((key) => requireText(session, key, at));
      if (ids.has(session.id)) fail(`${at}id`, `「${session.id}」が重複しています`);
      ids.add(session.id);
      if (typeof session.kind !== 'string' || !hasOwn(KIND_LABELS, session.kind)) {
        fail(`${at}kind`, 'workshop・talk・consultation のどれかが必要です');
      }
      if (!isTime(session.start)) fail(`${at}start`, 'HH:MM の時刻が必要です');
      if (!isTime(session.end)) fail(`${at}end`, 'HH:MM の時刻が必要です');
      if (toMinutes(session.start) >= toMinutes(session.end)) fail(`${at}end`, '開始より後の時刻が必要です');
      if (!Number.isInteger(session.price_yen) || session.price_yen < 0) fail(`${at}price_yen`, '0以上の整数が必要です');
      if (session.capacity !== null && (!Number.isInteger(session.capacity) || session.capacity < 1)) {
        fail(`${at}capacity`, '1以上の整数か null が必要です');
      }
      if (typeof session.reservation_required !== 'boolean') fail(`${at}reservation_required`, 'true か false が必要です');
    });
    if (!SESSION_IDS.every((id) => ids.has(id))) fail(`${where}sessions`, `${SESSION_IDS.join('・')} がそろっている必要があります`);
    return data;
  }

  function validateHandoff(data, event) {
    const where = `${FILES.handoff} の`;
    if (!isPlainObject(data)) fail(`${where}最上位`, 'オブジェクトが必要です');
    const { meta } = data;
    if (!isPlainObject(meta)) fail(`${where}meta`, 'オブジェクトが必要です');
    if (meta.fictional !== true) fail(`${where}meta.fictional`, 'true が必要です');
    if (meta.event_id !== event.id) fail(`${where}meta.event_id`, `入力のイベント（${event.id}）と同じ値が必要です`);
    if (meta.source_commit !== ROLE_SOURCE.commit) fail(`${where}meta.source_commit`, '固定コミットが必要です');
    if (meta.mode !== HANDOFF_MODE) fail(`${where}meta.mode`, `${HANDOFF_MODE} が必要です`);
    if (!Array.isArray(data.roles) || data.roles.length !== ROLE_IDS.length) fail(`${where}roles`, `${ROLE_IDS.length}件の配列が必要です`);
    data.roles.forEach((role, index) => {
      const at = `${where}roles[${index}]`;
      if (!isPlainObject(role)) fail(at, 'オブジェクトが必要です');
      if (role.id !== ROLE_IDS[index]) fail(`${at}.id`, `${ROLE_IDS[index]} が必要です`);
      requireText(role, 'name', `${at}.`);
      if (!isSafePath(role.source_path)) fail(`${at}.source_path`, 'このフォルダー内の相対パスが必要です');
      ['inputs', 'deliverables'].forEach((key) => {
        if (!Array.isArray(role[key]) || role[key].length === 0 || !role[key].every(isSafePath)) {
          fail(`${at}.${key}`, 'このフォルダー内の相対パスの配列が必要です');
        }
      });
      if (!isTextArray(role.checks)) fail(`${at}.checks`, '空でない文字列の配列が必要です');
      if (
        !Array.isArray(role.applied_instructions) ||
        !role.applied_instructions.every((item) => isPlainObject(item) && isText(item.instruction) && isText(item.application))
      ) {
        fail(`${at}.applied_instructions`, '指示と適用の組の配列が必要です');
      }
    });
    if (!Array.isArray(data.acceptance) || !data.acceptance.every((item) => isPlainObject(item) && isText(item.id) && isText(item.criterion))) {
      fail(`${where}acceptance`, 'id と criterion の組の配列が必要です');
    }
    ['A06', 'A09'].forEach((id) => {
      if (!data.acceptance.some((item) => item.id === id)) fail(`${where}acceptance`, `${id} が必要です`);
    });
    if (!isPlainObject(data.data_contract) || !isText(data.data_contract.conflict_rule)) {
      fail(`${where}data_contract.conflict_rule`, '空でない文字列が必要です');
    }
    return data;
  }

  const eventSummary = (event) => ({ id: event.id, title: event.title, date: event.date, timezone: event.timezone, venue: event.venue });
  const exportSource = () => ({ event_file: FILES.event, role_source: ROLE_SOURCE.repository, role_source_commit: ROLE_SOURCE.commit });

  // 元の comparison.js の buildExport と同じ形・同じ項目の順番
  function buildExport(event, sessions) {
    return {
      format: EXPORT_FORMAT,
      fictional: true,
      reserved: false,
      notice: EXPORT_NOTICE,
      event: eventSummary(event),
      source: exportSource(),
      selection_rule: SELECTION_RULE,
      selected_ids: sessions.map((session) => session.id),
      sessions, // 入力の企画オブジェクトをそのまま、時刻順で
      derived: { count: sessions.length, total_price_yen: sessions.reduce((sum, session) => sum + session.price_yen, 0) },
    };
  }

  const serializeExport = (object) => `${JSON.stringify(object, null, 2)}\n`;

  function validateRecord(record, rawText, event, path) {
    const expect = RECORD_EXPECT[path];
    const where = `${path} の`;
    if (!isPlainObject(record)) fail(`${where}最上位`, 'オブジェクトが必要です');
    if (!sameJSON(Object.keys(record), EXPORT_KEYS)) fail(`${where}最上位`, '項目と順番が元の書き出しと違います');
    if (record.format !== EXPORT_FORMAT) fail(`${where}format`, `${EXPORT_FORMAT} が必要です`);
    if (record.fictional !== true) fail(`${where}fictional`, 'true が必要です');
    if (record.reserved !== false) fail(`${where}reserved`, 'false が必要です');
    if (record.notice !== EXPORT_NOTICE) fail(`${where}notice`, '元の書き出しの文と違います');
    if (!sameJSON(record.event, eventSummary(event))) fail(`${where}event`, '入力のイベントの値と違います');
    if (!sameJSON(record.source, exportSource())) fail(`${where}source`, '元の書き出しの値と違います');
    if (record.selection_rule !== SELECTION_RULE) fail(`${where}selection_rule`, '元の書き出しの文と違います');
    if (!Array.isArray(record.selected_ids) || !sameJSON(record.selected_ids, expect.ids)) {
      fail(`${where}selected_ids`, `${expect.ids.join('・')} が必要です`);
    }
    const sessions = expect.ids.map((id) => event.sessions.find((session) => session.id === id));
    const ordered = [...sessions].sort(compareSessions);
    if (!sessions.every((session, index) => session === ordered[index])) fail(`${where}selected_ids`, '時刻順が必要です');
    for (let i = 0; i < sessions.length; i += 1) {
      for (let j = i + 1; j < sessions.length; j += 1) {
        if (overlaps(sessions[i], sessions[j])) fail(`${where}selected_ids`, `${sessions[i].id} と ${sessions[j].id} が重なっています`);
      }
    }
    if (
      !Array.isArray(record.sessions) ||
      record.sessions.length !== sessions.length ||
      !record.sessions.every((session, index) => sameJSON(session, sessions[index]))
    ) {
      fail(`${where}sessions`, '入力の企画オブジェクトと同じ値・同じ項目の順番が必要です');
    }
    const total = sessions.reduce((sum, session) => sum + session.price_yen, 0);
    if (!sameJSON(record.derived, { count: sessions.length, total_price_yen: total }) || total !== expect.total) {
      fail(`${where}derived`, `件数 ${sessions.length} と、選んだ企画の費用の合計 ${expect.total} が必要です`);
    }
    if (serializeExport(buildExport(event, sessions)) !== rawText) {
      fail(`${where}全体`, 'この画面の書き出しで同じバイト列を作れません');
    }
    return record;
  }

  function validateSamples(data, recorded) {
    const where = `${FILES.samples} の`;
    if (!isPlainObject(data) || data.format !== 'input-output') fail(`${where}format`, 'input-output が必要です');
    if (!Array.isArray(data.samples) || data.samples.length === 0) fail(`${where}samples`, '1件以上の配列が必要です');
    const ids = new Set();
    data.samples.forEach((sample, index) => {
      const at = `${where}samples[${index}].`;
      if (!isPlainObject(sample)) fail(`${where}samples[${index}]`, 'オブジェクトが必要です');
      ['id', 'label', 'input'].forEach((key) => requireText(sample, key, at));
      if (ids.has(sample.id)) fail(`${at}id`, `「${sample.id}」が重複しています`);
      ids.add(sample.id);
      if (!hasOwn(sample, 'output') || sample.output === null) fail(`${at}output`, '値が必要です');
    });
    const exported = data.samples.find((sample) => sample.id === 'export');
    if (
      !exported ||
      !isPlainObject(exported.output) ||
      exported.output.path !== FILES.recorded ||
      !sameJSON(exported.output.selected_ids, recorded.selected_ids) ||
      !sameJSON(exported.output.derived, recorded.derived)
    ) {
      fail(`${where}export`, `${FILES.recorded} と同じ選択と合計が必要です`);
    }
    return data;
  }

  /* ---------- テーマ ---------- */

  const darkQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const systemIsDark = () => Boolean(darkQuery && darkQuery.matches);

  function readStoredTheme() {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      return THEMES.includes(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  function updateThemeNote() {
    let text =
      state.theme === 'system'
        ? `端末の設定に合わせています（いまは${systemIsDark() ? 'ダーク' : 'ライト'}）。`
        : `${state.theme === 'dark' ? 'ダーク' : 'ライト'}で表示しています。`;
    if (state.themeSaveFailed) text += '表示テーマを保存できませんでした。この画面を開いている間だけ反映します。';
    ui.themeNote.textContent = text;
  }

  function updateThemeMeta() {
    if (!ui.themeMeta) return;
    const value = window.getComputedStyle(ui.root).getPropertyValue('--theme-color-meta').trim();
    if (value) ui.themeMeta.setAttribute('content', value);
  }

  function applyTheme(choice, persist) {
    state.theme = THEMES.includes(choice) ? choice : 'system';
    ui.root.setAttribute('data-theme', state.theme);
    if (persist) {
      try {
        window.localStorage.setItem(THEME_KEY, state.theme);
        state.themeSaveFailed = false;
      } catch {
        state.themeSaveFailed = true;
      }
    }
    ui.themeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === state.theme));
    });
    updateThemeNote();
    updateThemeMeta();
  }

  function initTheme() {
    applyTheme(readStoredTheme(), false);
    ui.themeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const choice = button.dataset.themeChoice;
        if (THEMES.includes(choice)) applyTheme(choice, true);
      });
    });
    if (darkQuery) {
      const onSystemChange = () => {
        if (state.theme !== 'system') return;
        updateThemeNote();
        updateThemeMeta();
      };
      if (typeof darkQuery.addEventListener === 'function') darkQuery.addEventListener('change', onSystemChange);
      else if (typeof darkQuery.addListener === 'function') darkQuery.addListener(onSystemChange);
    }
  }

  /* ---------- 読み込み（失敗したら止めて、古い内容を残さない） ---------- */

  async function loadAll(fromRetry) {
    loadToken += 1;
    const token = loadToken;
    if (loadController) loadController.abort();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    loadController = controller;
    const signal = controller ? controller.signal : undefined;
    enterLoading();
    try {
      const manifestBytes = await fetchBytes(MANIFEST_PATH, signal);
      const manifestDigest = await sha256Hex(manifestBytes);
      if (token !== loadToken) return;
      if (manifestDigest !== MANIFEST_SHA256) {
        throw new LoadError('integrity', `${MANIFEST_PATH}：SHA-256 が固定値と一致しません。内容が変わっています。`);
      }
      const manifest = validateManifest(parseJSON(decodeText(manifestBytes, MANIFEST_PATH), MANIFEST_PATH));
      const contents = await Promise.all(manifest.files.map((entry) => verifyEntry(entry, signal)));
      if (token !== loadToken) return;
      const text = {};
      manifest.files.forEach((entry, index) => {
        text[entry.path] = decodeText(contents[index], entry.path);
      });
      const event = validateEvent(parseJSON(text[FILES.event], FILES.event));
      const handoff = validateHandoff(parseJSON(text[FILES.handoff], FILES.handoff), event);
      const recorded = validateRecord(parseJSON(text[FILES.recorded], FILES.recorded), text[FILES.recorded], event, FILES.recorded);
      const alternative = validateRecord(
        parseJSON(text[FILES.alternative], FILES.alternative),
        text[FILES.alternative],
        event,
        FILES.alternative,
      );
      const samples = validateSamples(parseJSON(text[FILES.samples], FILES.samples), recorded);
      const requestText = text[FILES.request];
      if (requestText.trim() === '') throw new LoadError('validation', `${FILES.request}：依頼文が空でした。`);
      if (token !== loadToken) return;
      onReady({ event, handoff, recorded, alternative, samples, requestText }, fromRetry);
    } catch (error) {
      if (token !== loadToken || (error && error.name === 'AbortError')) return;
      onError(asLoadError(error), fromRetry);
    } finally {
      if (token === loadToken) loadController = null;
    }
  }

  function resetData() {
    window.clearTimeout(resultTimer);
    state.event = null;
    state.handoff = null;
    state.recorded = null;
    state.alternative = null;
    state.samples = null;
    state.requestText = '';
    state.sessions = [];
    state.selected.clear();
    state.focusId = null;
    state.visible = new Set();
    state.recent = null;
    view = null;
    appliedRecent = 0;

    ui.figure.hidden = true;
    ui.wires.replaceChildren();
    ui.timemap.replaceChildren();
    ui.planChips.replaceChildren();
    ui.planChips.hidden = true;
    ui.heroEvent.textContent = '';
    ui.focusLine.replaceChildren();
    ui.focusNote.textContent = '';
    window.clearTimeout(announceTimer);
    ui.actionStatus.textContent = '';
    ui.toggle.disabled = true;
    ui.toggle.setAttribute('aria-pressed', 'false');
    ui.toggle.textContent = '入れる';
    ui.save.disabled = true;
    ui.tryRecorded.disabled = true;
    ui.filterNote.hidden = true;
    ui.detailBody.replaceChildren();
    ui.filterSet.disabled = true;
    ui.resultStatus.textContent = '';
    ui.noResults.hidden = true;
    ui.itineraryList.replaceChildren();
    ui.itineraryList.hidden = true;
    ui.itinerarySummary.hidden = true;
    ui.itineraryReservation.hidden = true;
    ui.recordMatch.hidden = true;
    hideExportStatus();
    ui.clearButton.hidden = true;
    ui.sessionsAllList.replaceChildren();
    Object.values(ui.info).forEach((node) => {
      node.textContent = '';
    });
    ui.info.date.removeAttribute('datetime');
    ui.roles.replaceChildren();
    ui.decisionA09.textContent = '';
    ui.decisionA06.textContent = '';
    ui.decisionRule.textContent = '';
    ui.samplesList.replaceChildren();
    ui.requestText.textContent = '';
    ui.requestText.hidden = true;
    ui.copyButton.disabled = true;
    ui.copyStatus.textContent = '';
    ui.copyFallback.hidden = true;
    ui.copyFallbackText.value = '';
  }

  function updateUnavailableTexts() {
    const reason =
      state.status === 'error' ? '元のファイルを確かめられなかったため、保存できません。' : '読み込み後に保存できます。';
    ui.saveReason.textContent = reason;
    ui.itineraryEmpty.hidden = false;
    ui.itineraryEmpty.textContent =
      state.status === 'error'
        ? '元のファイルを確かめられなかったため、回る予定を作れません。図の上の「もう一度読み込む」を試してください。'
        : '企画データを確かめたあと、ここで回る予定を作れます。';
  }

  function enterLoading() {
    state.status = 'loading';
    resetData();
    if (ui.loadError.hidden) {
      ui.loadStatus.hidden = false;
      ui.loadStatus.textContent = '固定した7つのファイルを読み込み、バイト数と SHA-256 を確かめています…';
    }
    setBusy(ui.loadRetry, true);
    updateUnavailableTexts();
  }

  function onError(error, fromRetry) {
    state.status = 'error';
    resetData();
    ui.loadStatus.textContent = '';
    ui.loadStatus.hidden = true;
    ui.loadError.hidden = false;
    setLiveText(ui.loadErrorReason, error.detail);
    setBusy(ui.loadRetry, false, 'もう一度読み込む');
    updateUnavailableTexts();
    if (fromRetry) ui.loadRetry.focus();
  }

  function onReady(data, fromRetry) {
    state.status = 'ready';
    state.event = data.event;
    state.handoff = data.handoff;
    state.recorded = data.recorded;
    state.alternative = data.alternative;
    state.samples = data.samples;
    state.requestText = data.requestText;
    state.sessions = [...data.event.sessions].sort(compareSessions);
    state.selected.clear();
    state.recent = null;
    state.focusId = idFromHash() || state.sessions[0].id;

    ui.heroEvent.textContent = data.event.title;
    fillEventInfo(data.event);
    buildFigure();
    buildAllSessions();
    buildMaking(data.handoff, data.samples);
    ui.requestText.textContent = data.requestText;
    ui.requestText.hidden = false;
    ui.copyButton.disabled = false;
    ui.tryRecorded.textContent = `保存済みの${data.recorded.selected_ids.length}企画を試す`;
    ui.tryRecorded.disabled = false;

    ui.loadStatus.textContent = '';
    ui.loadStatus.hidden = true;
    ui.loadError.hidden = true;
    setBusy(ui.loadRetry, false, 'もう一度読み込む');
    ui.filterSet.disabled = false;
    ui.figure.hidden = false;
    readFilters();
    computeVisible();
    render();
    updateResultStatusNow();
    if (fromRetry) ui.map.focus();
  }

  /* ---------- 図を組み立てる ---------- */

  function buildRows(sessions) {
    const groups = [
      { key: 'am', name: '午前', items: sessions.filter((s) => toMinutes(s.start) < NOON) },
      { key: 'pm', name: '午後', items: sessions.filter((s) => toMinutes(s.start) >= NOON) },
    ].filter((group) => group.items.length > 0);
    groups.forEach((group) => {
      group.start = Math.floor(Math.min(...group.items.map((s) => toMinutes(s.start))) / 60) * 60;
      group.rawEnd = Math.ceil(Math.max(...group.items.map((s) => toMinutes(s.end))) / 60) * 60;
    });
    // 午前と午後を同じ縮尺にする
    const span = Math.max(...groups.map((group) => group.rawEnd - group.start));
    groups.forEach((group) => {
      group.span = span;
      group.end = group.start + span;
      // 段の割り当て: 空いている段のうち、最後の終了がいちばん遅い段へ（接する企画は同じ段に並ぶ）
      const laneEnds = [];
      group.lanes = new Map();
      group.items.forEach((session) => {
        const start = toMinutes(session.start);
        let best = -1;
        laneEnds.forEach((end, index) => {
          if (end <= start && (best === -1 || end > laneEnds[best])) best = index;
        });
        if (best === -1) {
          best = laneEnds.length;
          laneEnds.push(0);
        }
        laneEnds[best] = toMinutes(session.end);
        group.lanes.set(session.id, best);
      });
      group.laneCount = laneEnds.length;
      group.overlaps = [];
      group.touches = [];
      for (let i = 0; i < group.items.length; i += 1) {
        for (let j = i + 1; j < group.items.length; j += 1) {
          const a = group.items[i];
          const b = group.items[j];
          if (overlaps(a, b)) {
            group.overlaps.push({
              a,
              b,
              start: Math.max(toMinutes(a.start), toMinutes(b.start)),
              end: Math.min(toMinutes(a.end), toMinutes(b.end)),
            });
          } else if (a.end === b.start || b.end === a.start) {
            group.touches.push({ a, b, at: toMinutes(a.end === b.start ? a.end : b.end) });
          }
        }
      }
    });
    return groups;
  }

  const percent = (value) => String(Math.round(value * 10000) / 10000);

  // 印の文字は、左寄りなら印の右へ、右寄りなら印の左へ置き、帯の外へはみ出さないようにする
  function placeNoteLabel(label, startX, endX) {
    if (startX > 60) {
      label.dataset.anchor = 'end';
      label.style.setProperty('--xr', percent(100 - endX));
    } else {
      label.style.setProperty('--x', percent(startX));
    }
  }

  // 幅に合わせて3段階の文字を用意し、CSS のコンテナークエリで1つだけを出す
  function noteText(label, short, medium, long) {
    label.append(el('span', 'c-mark__s', short), el('span', 'c-mark__m', medium), el('span', 'c-mark__l', long));
  }

  function buildFigure() {
    const groups = buildRows(state.sessions);
    view = { rows: [], bars: new Map(), segs: new Map(), marks: [] };
    const fragment = document.createDocumentFragment();

    groups.forEach((group) => {
      const at = (minutes) => ((minutes - group.start) / group.span) * 100;
      const row = el('div', 'c-row');
      row.dataset.row = group.key;
      row.style.setProperty('--lanes', String(group.laneCount));

      const gutter = el('div', 'c-row__gutter');
      gutter.setAttribute('aria-hidden', 'true');
      gutter.append(el('span', 'c-row__name', group.name), el('span', 'c-row__railname', '予定'));

      const track = el('div', 'c-row__track');
      track.style.setProperty('--cols', String(group.span / 30));
      const caption = el('p', 'u-visually-hidden', `${group.name}の帯（${fmtClock(group.start)}–${fmtClock(group.end)}）`);

      const axis = el('div', 'c-axis');
      axis.setAttribute('aria-hidden', 'true');
      for (let minutes = group.start; minutes <= group.end; minutes += 30) {
        const tick = el('span', `c-axis__tick ${minutes % 60 === 0 ? 'c-axis__tick--hour' : 'c-axis__tick--half'}`, fmtClock(minutes));
        tick.style.setProperty('--x', percent(at(minutes)));
        if (minutes === group.start) tick.dataset.edge = 'start';
        else if (minutes === group.end) tick.dataset.edge = 'end';
        axis.append(tick);
      }

      const notes = el('div', 'c-notes');
      notes.setAttribute('aria-hidden', 'true');
      const lanes = el('div', 'c-lanes');
      const rail = el('div', 'c-rail');
      rail.setAttribute('aria-hidden', 'true');

      group.items.forEach((session) => {
        const start = toMinutes(session.start);
        const end = toMinutes(session.end);
        const button = el('button', 'c-bar');
        button.type = 'button';
        button.dataset.id = session.id;
        button.style.setProperty('--x', percent(at(start)));
        button.style.setProperty('--w', percent(((end - start) / group.span) * 100));
        button.style.setProperty('--lane', String(group.lanes.get(session.id)));
        const top = el('span', 'c-bar__top');
        top.append(el('span', 'c-bar__id', session.id), el('span', 'c-bar__fee', fmtFee(session.price_yen)));
        const sr = el('span', 'u-visually-hidden');
        button.append(top, el('span', 'c-bar__label', shortLabel(session)), sr);
        button.addEventListener('click', () => focusSession(session.id, { updateHash: true }));
        lanes.append(button);
        view.bars.set(session.id, { button, sr, session });

        const seg = el('span', 'c-seg', session.id);
        seg.style.setProperty('--x', percent(at(start)));
        seg.style.setProperty('--w', percent(((end - start) / group.span) * 100));
        seg.hidden = true;
        rail.append(seg);
        view.segs.set(session.id, seg);
      });

      group.overlaps.forEach((overlap) => {
        const x = at(overlap.start);
        const width = ((overlap.end - overlap.start) / group.span) * 100;
        const range = `${fmtClock(overlap.start)}–${fmtClock(overlap.end)}`;
        const bracket = el('span', 'c-mark c-mark--overlap');
        bracket.style.setProperty('--x', percent(x));
        bracket.style.setProperty('--w', percent(width));
        const label = el('span', 'c-mark__label c-mark__label--overlap');
        noteText(label, '重なり', `重なり${overlap.end - overlap.start}分`, `${range} 重なり`);
        placeNoteLabel(label, x + width, x);
        notes.append(bracket, label);
        const nodes = [bracket, label];
        // 重なる部分を、それぞれの帯の中にも斜線で示す（帯の長さは変えない）
        [overlap.a, overlap.b].forEach((session) => {
          const s = toMinutes(session.start);
          const length = toMinutes(session.end) - s;
          const shade = el('span', 'c-bar__overlap');
          shade.setAttribute('aria-hidden', 'true');
          shade.style.setProperty('--ox', percent(((overlap.start - s) / length) * 100));
          shade.style.setProperty('--ow', percent(((overlap.end - overlap.start) / length) * 100));
          view.bars.get(session.id).button.prepend(shade);
          nodes.push(shade);
        });
        view.marks.push({ type: 'overlap', ids: [overlap.a.id, overlap.b.id], nodes, bracket });
      });

      group.touches.forEach((touch) => {
        const x = at(touch.at);
        const line = el('span', 'c-touch');
        line.setAttribute('aria-hidden', 'true');
        line.style.setProperty('--x', percent(x));
        const label = el('span', 'c-mark__label c-mark__label--touch');
        noteText(label, '接する', `${fmtClock(touch.at)} 接する`, `${fmtClock(touch.at)} 接する（両方入る）`);
        placeNoteLabel(label, x, x);
        notes.append(label);
        track.append(line);
        view.marks.push({ type: 'touch', ids: [touch.a.id, touch.b.id], nodes: [line, label] });
      });

      track.append(caption, axis, notes, lanes, rail);
      row.append(gutter, track);
      fragment.append(row);
      view.rows.push({ row, gutter, rail });
    });

    ui.timemap.replaceChildren(fragment);
  }

  function addMeta(list, label, value) {
    const dd = el('dd');
    dd.append(value);
    list.append(el('dt', null, label), dd);
  }

  function fullIntervalNote(session) {
    return `予約不要の企画も、回る予定では${fmtRange(session)}の枠全体を使うものとして重なりを判定します。`;
  }

  // 元の入力の値を省略せずに並べる（注目中の企画と、6企画の全項目で共用）
  function sessionFacts(session) {
    const list = el('dl', 'c-meta c-facts');
    const time = el('span', 'u-tabular');
    time.append(timeEl(state.event.date, session.start), '–', timeEl(state.event.date, session.end), `（${duration(session)}分）`);
    addMeta(list, '時間', time);
    addMeta(list, '種類', KIND_LABELS[session.kind]);
    addMeta(list, '費用', fmtFee(session.price_yen));
    addMeta(list, '対象', session.age);
    addMeta(list, '定員', fmtCapacity(session.capacity));
    addMeta(list, '予約', fmtReservation(session.reservation_required));
    addMeta(list, '部屋', session.room);
    addMeta(list, '内容', session.description);
    addMeta(list, 'メモ', session.note);
    return list;
  }

  function buildAllSessions() {
    const fragment = document.createDocumentFragment();
    state.sessions.forEach((session) => {
      const article = el('article', 'c-card c-full');
      article.id = `session-full-${session.id}`;
      const heading = el('h3', 'c-full__title');
      heading.append(el('span', 'c-full__id', session.id), session.title);
      article.append(heading, sessionFacts(session));
      if (!session.reservation_required) article.append(el('p', 'u-small u-muted', fullIntervalNote(session)));
      const link = el('a', 'c-full__link', `図で${session.id}に注目する`);
      link.href = `#${session.id}`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        focusSession(session.id, { updateHash: true, reveal: true, moveFocus: true });
      });
      article.append(link);
      fragment.append(article);
    });
    ui.sessionsAllList.replaceChildren(fragment);
  }

  function fillEventInfo(event) {
    ui.info.title.textContent = event.title;
    ui.info.subtitle.textContent = event.subtitle;
    ui.info.date.textContent = fmtDate(event.date);
    ui.info.date.dateTime = event.date;
    ui.info.timezone.textContent = `日本時間（${event.timezone}）。曜日は入力にないため書いていません。`;
    ui.info.hours.textContent = `${event.opening}–${event.closing}`;
    ui.info.venue.textContent = event.venue;
    ui.info.admission.textContent = event.admission;
    ui.info.area.textContent = event.area;
    ui.info.reservation.textContent = event.reservation_note;
    ui.info.access.textContent = event.access;
    ui.info.weather.textContent = event.weather;
  }

  function pathList(paths) {
    const list = el('ul', 'u-list-reset c-linklist');
    list.setAttribute('role', 'list');
    paths.forEach((path) => {
      const item = el('li');
      const link = el('a', null, path);
      link.href = path;
      item.append(link);
      list.append(item);
    });
    return list;
  }

  function buildMaking(handoff, samples) {
    const fragment = document.createDocumentFragment();
    handoff.roles.forEach((role, index) => {
      const article = el('article', 'c-card c-role');
      article.id = ROLE_ANCHORS[role.id];
      const heading = el('h4', 'c-role__title');
      heading.append(el('span', 'c-role__step', `段階${index + 1}`), role.name);
      const facts = el('dl', 'c-meta c-role__facts');
      addMeta(facts, '役割ファイル', pathList([role.source_path]));
      addMeta(facts, '入力', pathList(role.inputs));
      addMeta(facts, '成果物', pathList(role.deliverables));
      article.append(heading, facts);

      const checks = el('details', 'c-role__more');
      checks.append(el('summary', null, `引継ぎ書に書いた確認項目（${role.checks.length}件・合格の記録ではありません）`));
      const checkList = el('ul', 'c-role__list');
      role.checks.forEach((check) => checkList.append(el('li', null, check)));
      checks.append(checkList);
      article.append(checks);

      if (role.applied_instructions.length > 0) {
        const applied = el('details', 'c-role__more');
        applied.append(el('summary', null, `役割ファイルの指示をどう当てたか（${role.applied_instructions.length}件）`));
        const appliedList = el('ol', 'c-role__list');
        role.applied_instructions.forEach((item) => {
          const li = el('li');
          li.append(el('p', null, item.instruction), el('p', 'u-muted', item.application));
          appliedList.append(li);
        });
        applied.append(appliedList);
        article.append(applied);
      }
      fragment.append(article);
    });
    ui.roles.replaceChildren(fragment);

    ui.decisionA09.textContent = handoff.acceptance.find((item) => item.id === 'A09').criterion;
    ui.decisionA06.textContent = handoff.acceptance.find((item) => item.id === 'A06').criterion;
    ui.decisionRule.textContent = handoff.data_contract.conflict_rule;

    const items = document.createDocumentFragment();
    samples.samples.forEach((sample) => {
      const output = sample.output;
      let result = '';
      if (isPlainObject(output) && isText(output.notice)) result = output.notice;
      else if (isPlainObject(output) && isText(output.path) && Array.isArray(output.selected_ids) && isPlainObject(output.derived)) {
        result = `${output.path}：${output.selected_ids.join('・')}、${output.derived.count}件、${fmtTotal(output.derived.total_price_yen)}`;
      }
      if (!result) return;
      const li = el('li', 'c-samples__item');
      li.append(el('p', 'c-samples__label', sample.label), el('p', 'u-small', `操作：${sample.input}`), el('p', 'u-small u-muted', `記録：${result}`));
      items.append(li);
    });
    ui.samplesList.replaceChildren(items);
  }

  /* ---------- 描画（状態から描くだけ） ---------- */

  const sessionById = (id) => state.sessions.find((session) => session.id === id) || null;
  const focused = () => (state.focusId ? sessionById(state.focusId) : null);

  function selectedSessions() {
    if (state.status !== 'ready') return [];
    return state.sessions.filter((session) => state.selected.has(session.id));
  }

  function overlappingSelected(session) {
    return selectedSessions().filter((other) => other.id !== session.id && overlaps(session, other));
  }

  function render() {
    if (state.status !== 'ready' || !view) return;
    updateBars();
    updateMarks();
    updateRails();
    applyRecentFlags();
    updatePlan();
    updateFocusPanel();
    updateDetail();
    updateItinerary();
    updateFilterNote();
    scheduleWires();
  }

  function updateBars() {
    view.bars.forEach(({ button, sr, session }) => {
      const selected = state.selected.has(session.id);
      const clashes = selected ? [] : overlappingSelected(session);
      button.dataset.state = selected ? 'selected' : clashes.length > 0 ? 'conflict' : 'available';
      button.hidden = !state.visible.has(session.id);
      if (session.id === state.focusId) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
      const status = selected
        ? '回る予定に入っています'
        : clashes.length > 0
          ? `予定の${clashes.map((c) => `${c.id}「${c.title}」`).join('・')}と時間が重なります`
          : '回る予定に入れられます';
      sr.textContent = `：${session.title}、${fmtRange(session)}。${status}。`;
    });
  }

  function updateMarks() {
    view.marks.forEach((mark) => {
      const shown = mark.ids.every((id) => state.visible.has(id));
      const live =
        mark.type === 'overlap' ? mark.ids.some((id) => state.selected.has(id)) : mark.ids.every((id) => state.selected.has(id));
      mark.nodes.forEach((node) => {
        node.hidden = !shown;
        node.dataset.live = String(live);
      });
    });
  }

  function updateRails() {
    view.segs.forEach((seg, id) => {
      seg.hidden = !state.selected.has(id);
    });
  }

  function setRecent(recent) {
    recentSerial += 1;
    state.recent = recent ? { ...recent, serial: recentSerial } : null;
  }

  // 入力の変化を図に一度だけ示す。動きを減らす設定では動かさず、枠の強調だけを残す
  function applyRecentFlags() {
    const recent = state.recent;
    const serial = recent ? recent.serial : 0;
    if (serial === appliedRecent) return;
    appliedRecent = serial;
    ui.timemap.querySelectorAll('[data-recent]').forEach((node) => node.removeAttribute('data-recent'));
    if (!recent) return;
    void ui.timemap.offsetWidth; // 同じ印を続けて付けても動きが始まるように
    if (recent.type === 'add') {
      recent.ids.forEach((id) => {
        const seg = view.segs.get(id);
        if (seg) seg.dataset.recent = 'add';
      });
    } else if (recent.type === 'conflict') {
      const [id] = recent.ids;
      const bar = view.bars.get(id);
      if (bar) bar.button.dataset.recent = 'rejected';
      recent.clashes.forEach((clashId) => {
        const seg = view.segs.get(clashId);
        if (seg) seg.dataset.recent = 'blocking';
        view.marks.forEach((mark) => {
          if (mark.type === 'overlap' && mark.ids.includes(id) && mark.ids.includes(clashId)) mark.bracket.dataset.recent = 'conflict';
        });
      });
    }
  }

  function updatePlan() {
    const items = selectedSessions();
    ui.planChips.replaceChildren(
      ...items.map((session) => {
        const li = el('li', 'c-chip');
        li.append(
          el('span', 'c-chip__id', session.id),
          el('span', 'c-chip__label', shortLabel(session)),
          el('span', 'u-visually-hidden', `：${session.title}、${fmtRange(session)}、${fmtFee(session.price_yen)}`),
        );
        return li;
      }),
    );
    ui.planChips.hidden = items.length === 0;
    updateExport();
  }

  function updateExport() {
    const items = selectedSessions();
    const ok = state.status === 'ready' && items.length > 0;
    ui.save.disabled = !ok;
    ui.saveReason.replaceChildren();
    if (state.status !== 'ready') {
      updateUnavailableTexts();
    } else if (items.length === 0) {
      ui.saveReason.textContent = 'まだ空です。1件以上入れると保存できます。';
    } else {
      const total = items.reduce((sum, session) => sum + session.price_yen, 0);
      ui.saveReason.append(
        el('span', 'c-plan__count', `${items.length}件・${fmtTotal(total)}`),
        el('span', 'u-visually-hidden', `。${exportFilename()} として保存できます。予約や参加確定にはなりません。`),
      );
    }
  }

  function updateFocusPanel() {
    const session = focused();
    if (!session) return;
    const selected = state.selected.has(session.id);
    const clashes = selected ? [] : overlappingSelected(session);
    ui.focusLine.replaceChildren(
      el('span', 'c-act__id', session.id),
      el('span', 'c-act__title', session.title),
      el('span', 'c-act__meta u-tabular', `${fmtRange(session)}・${fmtFee(session.price_yen)}`),
    );
    ui.toggle.disabled = false;
    ui.toggle.setAttribute('aria-pressed', String(selected));
    ui.toggle.replaceChildren(
      document.createTextNode(selected ? `${session.id}を外す` : `${session.id}を入れる`),
      el('span', 'u-visually-hidden', `：${session.title}`),
    );
    ui.toggle.classList.toggle('c-button--primary', !selected && clashes.length === 0);
    ui.toggle.dataset.state = selected ? 'selected' : clashes.length > 0 ? 'conflict' : 'available';

    let note = '';
    if (selected) {
      note = '回る予定に入っています。外すときは、もう一度押します。';
    } else if (clashes.length > 0) {
      note = `予定の${describeClashes(session, clashes)}が重なるため、押しても入りません。今の予定はそのままです。`;
    } else {
      const touching = selectedSessions().filter((other) => other.end === session.start || other.start === session.end);
      if (touching.length > 0) {
        note = `${touching
          .map((other) => (other.end === session.start ? `${other.id}の終了${other.end}` : `${other.id}の開始${other.start}`))
          .join('・')}と接するだけなので、一緒に入ります（移動の時間は考えていません）。`;
      }
    }
    if (!state.visible.has(session.id)) note += '今の絞り込みでは、図に出ていません。';
    ui.focusNote.textContent = note;
  }

  function updateDetail() {
    const session = focused();
    if (!session) {
      ui.detailBody.replaceChildren();
      return;
    }
    const card = el('article', 'c-card c-detail__card');
    card.dataset.state = state.selected.has(session.id) ? 'selected' : overlappingSelected(session).length > 0 ? 'conflict' : 'available';
    const heading = el('h3', 'c-detail__title');
    heading.append(el('span', 'c-full__id', session.id), session.title);
    card.append(heading, sessionFacts(session));
    if (!session.reservation_required) card.append(el('p', 'u-small u-muted', fullIntervalNote(session)));
    const clashes = overlappingSelected(session);
    const status = state.selected.has(session.id)
      ? '回る予定に入っています。'
      : clashes.length > 0
        ? `回る予定の${describeClashes(session, clashes)}が重なるため、入れられません。こちらにする場合は、先に${quoteTitles(clashes)}を外してください。`
        : '回る予定に入れられます。';
    card.append(el('p', 'c-detail__state', status));
    ui.detailBody.replaceChildren(card);
  }

  function updateItinerary() {
    const items = selectedSessions();
    const count = items.length;
    ui.itineraryList.replaceChildren();
    items.forEach((session, index) => {
      const li = el('li', 'c-itinerary__item');
      const info = el('div', 'c-itinerary__info');
      const time = el('p', 'c-itinerary__time u-tabular');
      time.append(timeEl(state.event.date, session.start), '–', timeEl(state.event.date, session.end));
      const detail = [
        fmtFee(session.price_yen),
        session.room,
        session.reservation_required ? '予約が必要（この作例では受付しません）' : `予約不要（${fmtRange(session)}の枠全体）`,
      ].join('・');
      const name = el('p', 'c-itinerary__name');
      name.append(el('span', 'c-full__id', session.id), session.title);
      info.append(time, name, el('p', 'u-small u-muted', detail));
      const remove = el('button', 'c-button c-itinerary__remove');
      remove.type = 'button';
      remove.append('外す', el('span', 'u-visually-hidden', `：${session.title}`));
      remove.addEventListener('click', () => onRemoveItem(session, index));
      li.append(info, remove);
      ui.itineraryList.append(li);
    });

    ui.itineraryEmpty.textContent = 'まだ企画を選んでいません。図の帯を押して注目し、「入れる」を押すと、ここに時間順で並びます。';
    ui.itineraryEmpty.hidden = count > 0;
    ui.itineraryList.hidden = count === 0;
    ui.itinerarySummary.hidden = count === 0;
    if (count > 0) {
      const total = items.reduce((sum, session) => sum + session.price_yen, 0);
      const last = items.reduce((latest, session) => (toMinutes(session.end) > toMinutes(latest.end) ? session : latest));
      ui.itineraryCount.textContent = `${count}件`;
      ui.itinerarySpan.textContent = `${items[0].start}–${last.end}（間の空き時間を含む）`;
      ui.itineraryTotal.textContent = fmtTotal(total);
    }
    const reserved = items.filter((session) => session.reservation_required).length;
    ui.itineraryReservation.hidden = reserved === 0;
    ui.itineraryReservation.textContent =
      reserved > 0 ? `予約が必要な企画が${reserved}件あります。この作例では予約を受け付けていないため、参加の確保にはなりません。` : '';

    const ids = items.map((session) => session.id);
    const match = [
      [state.recorded, FILES.recorded],
      [state.alternative, FILES.alternative],
    ].find(([record]) => record && sameJSON(record.selected_ids, ids));
    ui.recordMatch.hidden = !match;
    ui.recordMatch.textContent = match
      ? `この${count}件の書き出しは、保存済みの記録 ${match[1]} と同じバイト列になります（読み込み時に、この画面の書き出し方で照合しています）。`
      : '';

    ui.clearButton.hidden = count === 0;
    ui.clearButton.textContent = `回る予定をすべて外す（${count}件）`;
  }

  /* ---------- 線（関係の矢印。文字の後ろに描く） ---------- */

  let wireFrame = 0;

  function scheduleWires() {
    if (wireFrame) return;
    wireFrame = window.requestAnimationFrame(drawWires);
  }

  function svgNode(tag, attributes) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  const r1 = (value) => Math.round(value * 10) / 10;

  function wire(d, kind) {
    return svgNode('path', { d, class: `c-wire c-wire--${kind}` });
  }

  function arrowHead(x, y, direction, kind) {
    const s = 5;
    const points =
      direction === 'down'
        ? `${r1(x - s)},${r1(y - s * 1.4)} ${r1(x + s)},${r1(y - s * 1.4)} ${r1(x)},${r1(y)}`
        : `${r1(x - s * 1.4)},${r1(y - s)} ${r1(x - s * 1.4)},${r1(y + s)} ${r1(x)},${r1(y)}`;
    return svgNode('polygon', { points, class: `c-arrow c-arrow--${kind}` });
  }

  function drawWires() {
    wireFrame = 0;
    const svg = ui.wires;
    if (state.status !== 'ready' || !view || ui.figure.hidden) {
      svg.replaceChildren();
      return;
    }
    const box = ui.figure.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) {
      svg.replaceChildren();
      return;
    }
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const rel = (node) => {
      const r = node.getBoundingClientRect();
      return {
        l: r.left - box.left,
        t: r.top - box.top,
        r: r.right - box.left,
        b: r.bottom - box.top,
        cx: r.left - box.left + r.width / 2,
        cy: r.top - box.top + r.height / 2,
      };
    };
    const parts = [];

    // 6企画 → UX設計 → 実装
    const nodes = [ui.nodeInput, ui.nodeUx, ui.nodeFe].map(rel);
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const a = nodes[i];
      const b = nodes[i + 1];
      if (b.l - a.r >= 12) {
        parts.push(wire(`M${r1(a.r + 2)} ${r1(a.cy)}H${r1(b.l - 2)}`, 'flow'), arrowHead(b.l - 2, a.cy, 'right', 'flow'));
      }
    }
    // 実装 → 時間の図
    const fe = nodes[nodes.length - 1];
    const map = rel(ui.timemap);
    if (map.t - fe.b >= 8) {
      parts.push(wire(`M${r1(fe.cx)} ${r1(fe.b + 1)}V${r1(map.t - 1)}`, 'flow'), arrowHead(fe.cx, map.t - 1, 'down', 'flow'));
    }
    // 選んだ企画の帯 → 予定の列（同じ時刻の幅を点線で下ろす）
    view.bars.forEach(({ button, session }) => {
      if (!state.selected.has(session.id) || button.hidden) return;
      const bar = rel(button);
      const seg = rel(view.segs.get(session.id));
      parts.push(wire(`M${r1(bar.l + 1.5)} ${r1(bar.b)}V${r1(seg.t)}M${r1(bar.r - 1.5)} ${r1(bar.b)}V${r1(seg.t)}`, 'drop'));
    });
    // 予定の列 → 予定メモ
    const plan = rel(ui.plan);
    view.rows.forEach(({ rail, gutter }) => {
      const r = rel(rail);
      const g = rel(gutter);
      const x = g.l + 2;
      const turn = plan.t - 10;
      if (turn <= r.cy) return;
      const tx = Math.max(plan.l + 20, x + 14);
      parts.push(
        wire(`M${r1(r.l)} ${r1(r.cy)}H${r1(x)}V${r1(turn)}H${r1(tx)}V${r1(plan.t - 1)}`, 'plan'),
        arrowHead(tx, plan.t - 1, 'down', 'plan'),
      );
    });
    svg.replaceChildren(...parts);
  }

  /* ---------- 操作 ---------- */

  function focusSession(id, options = {}) {
    if (state.status !== 'ready' || !sessionById(id)) return;
    state.focusId = id;
    setRecent(null);
    if (options.updateHash) {
      try {
        window.history.replaceState(null, '', `#${id}`);
      } catch {
        // 履歴を書き換えられない環境でも、注目だけは変える
      }
    }
    render();
    if (options.reveal) ui.map.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    if (options.moveFocus) {
      const bar = view.bars.get(id);
      if (bar && !bar.button.hidden) bar.button.focus({ preventScroll: true });
      else ui.toggle.focus({ preventScroll: true });
    }
  }

  function idFromHash() {
    let raw = '';
    try {
      raw = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return null;
    }
    return state.sessions.some((session) => session.id === raw) ? raw : null;
  }

  function onHashChange() {
    if (state.status !== 'ready') return;
    const id = idFromHash();
    if (id) focusSession(id, { reveal: true, moveFocus: true });
  }

  // 重なる企画は入れず、理由を知らせて何も変えない。黙って入れ替えることはしない（元の実装のまま）
  function onToggle() {
    if (state.status !== 'ready') return;
    const session = focused();
    if (!session) return;
    if (state.selected.has(session.id)) {
      state.selected.delete(session.id);
      setRecent({ type: 'remove', ids: [session.id], clashes: [] });
      hideExportStatus();
      render();
      announce(`「${session.title}」（${session.id}）を回る予定から外しました。いま${state.selected.size}件です。`);
      return;
    }
    const clashes = overlappingSelected(session);
    if (clashes.length > 0) {
      setRecent({ type: 'conflict', ids: [session.id], clashes: clashes.map((c) => c.id) });
      render();
      announce(
        `「${session.title}」（${session.id}・${fmtRange(session)}）は入れていません。予定の${describeClashes(session, clashes)}が重なります。回る予定は${state.selected.size}件のまま変わっていません。こちらにする場合は、先に${quoteTitles(clashes)}を外してください。`,
      );
      return;
    }
    state.selected.add(session.id);
    setRecent({ type: 'add', ids: [session.id], clashes: [] });
    hideExportStatus();
    render();
    const blocked = state.sessions.filter((other) => !state.selected.has(other.id) && overlaps(session, other));
    const total = selectedSessions().reduce((sum, s) => sum + s.price_yen, 0);
    let message = `「${session.title}」（${session.id}・${fmtRange(session)}）を回る予定に入れました。いま${state.selected.size}件、費用の合計${fmtTotal(total)}です。`;
    if (blocked.length > 0) message += `${blocked.map((b) => b.id).join('・')}は時間が重なるため、このままでは入りません。`;
    announce(message);
  }

  function onTryRecorded() {
    if (state.status !== 'ready') return;
    const added = [];
    const already = [];
    const blocked = [];
    state.recorded.selected_ids.forEach((id) => {
      const session = sessionById(id);
      if (state.selected.has(id)) {
        already.push(id);
        return;
      }
      const clashes = overlappingSelected(session);
      if (clashes.length > 0) {
        blocked.push(`${id}は予定の${clashes.map((c) => c.id).join('・')}と重なるため入れていません`);
        return;
      }
      state.selected.add(id);
      added.push(id);
    });
    setRecent(added.length > 0 ? { type: 'add', ids: added, clashes: [] } : null);
    hideExportStatus();
    render();
    let message = `保存済みの記録（${FILES.recorded}）の${state.recorded.selected_ids.length}企画を、重なりを確かめながら入れました。`;
    if (added.length > 0) message += `追加：${added.join('・')}。`;
    if (already.length > 0) message += `すでに入っていた：${already.join('・')}。`;
    if (blocked.length > 0) message += `${blocked.join('。')}。`;
    message += `いま${state.selected.size}件です。`;
    announce(message);
  }

  function onRemoveItem(session, index) {
    if (state.status !== 'ready') return;
    state.selected.delete(session.id);
    setRecent({ type: 'remove', ids: [session.id], clashes: [] });
    hideExportStatus();
    render();
    announce(`「${session.title}」（${session.id}）を回る予定から外しました。いま${state.selected.size}件です。`);
    const buttons = ui.itineraryList.querySelectorAll('.c-itinerary__remove');
    const target = buttons[index] || buttons[index - 1] || ui.itineraryTitle;
    target.focus();
  }

  function onClearAll() {
    const count = state.selected.size;
    if (state.status !== 'ready' || count === 0) return;
    state.selected.clear();
    setRecent(null);
    hideExportStatus();
    render();
    announce(`回る予定の${count}件をすべて外しました。`);
    ui.itineraryTitle.focus();
  }

  /* ---------- 絞り込み（表示だけを変え、予定は消さない） ---------- */

  const pick = (value, allowed) => (allowed.includes(value) ? value : 'all');

  function readFilters() {
    state.filters = {
      kind: pick(ui.kind.value, FILTER_VALUES.kind),
      time: pick(ui.time.value, FILTER_VALUES.time),
      fee: pick(ui.fee.value, FILTER_VALUES.fee),
      query: ui.query.value,
    };
  }

  function matches(session, tokens) {
    const { kind, time, fee } = state.filters;
    if (kind !== 'all' && session.kind !== kind) return false;
    const start = toMinutes(session.start);
    if (time === 'morning' && start >= NOON) return false;
    if (time === 'afternoon' && start < NOON) return false;
    if (fee === 'free' && session.price_yen !== 0) return false;
    if (fee === 'paid' && session.price_yen === 0) return false;
    const haystack = normalize([session.title, session.description, session.room, session.age, session.note].join('\n'));
    return tokens.every((token) => haystack.includes(token));
  }

  function computeVisible() {
    const tokens = normalize(state.filters.query).split(/\s+/u).filter(Boolean);
    state.visible = new Set(state.sessions.filter((session) => matches(session, tokens)).map((session) => session.id));
  }

  const filtersActive = () =>
    state.filters.kind !== 'all' || state.filters.time !== 'all' || state.filters.fee !== 'all' || state.filters.query.trim() !== '';

  function resultText() {
    if (state.status !== 'ready') return '';
    const total = state.sessions.length;
    const shown = state.visible.size;
    const hiddenSelected = selectedSessions().filter((session) => !state.visible.has(session.id)).length;
    let text =
      shown === 0
        ? `${total}件中0件です。条件に合う企画はありません。`
        : `${total}件中${shown}件を図に出しています。`;
    if (hiddenSelected > 0) text += `回る予定のうち${hiddenSelected}件は、今の条件では図に出ていません（予定には残っています）。`;
    return text;
  }

  let resultTimer = 0;

  function updateResultStatusNow() {
    window.clearTimeout(resultTimer);
    const text = resultText();
    if (ui.resultStatus.textContent !== text) ui.resultStatus.textContent = text;
  }

  function updateFilterNote() {
    const active = state.status === 'ready' && filtersActive();
    ui.filterNote.hidden = !active;
    ui.filterNoteText.textContent = active ? `絞り込み中：${resultText()}` : '';
    ui.noResults.hidden = !(state.status === 'ready' && state.visible.size === 0);
  }

  function applyFilters(delay) {
    if (state.status !== 'ready') return;
    readFilters();
    computeVisible();
    render();
    if (delay > 0) {
      window.clearTimeout(resultTimer);
      resultTimer = window.setTimeout(updateResultStatusNow, delay);
    } else {
      updateResultStatusNow();
    }
  }

  function resetFilters() {
    ui.query.value = '';
    ui.kind.value = 'all';
    ui.time.value = 'all';
    ui.fee.value = 'all';
    applyFilters(0);
  }

  function initFilters() {
    ui.filterForm.addEventListener('submit', (event) => event.preventDefault());
    ui.query.addEventListener('input', () => applyFilters(SEARCH_DELAY));
    [ui.kind, ui.time, ui.fee].forEach((select) => {
      select.addEventListener('change', () => applyFilters(0));
    });
    ui.filterReset.addEventListener('click', resetFilters);
    ui.noResultsReset.addEventListener('click', () => {
      resetFilters();
      ui.filtersTitle.focus();
    });
    ui.filterNoteReset.addEventListener('click', () => {
      resetFilters();
      if (focused()) ui.toggle.focus({ preventScroll: true });
    });
  }

  /* ---------- JSON の書き出し（元の形のまま、今の選択から作る） ---------- */

  const exportFilename = () => `${state.event.id}-${state.event.date}-itinerary.json`;

  function showExportStatus(message, tone) {
    ui.exportStatus.textContent = message;
    if (tone) ui.exportStatus.dataset.tone = tone;
    else delete ui.exportStatus.dataset.tone;
    ui.exportStatus.hidden = false;
  }

  function hideExportStatus() {
    ui.exportStatus.hidden = true;
    ui.exportStatus.textContent = '';
  }

  function onExport() {
    if (state.status !== 'ready' || state.selected.size === 0) return;
    const filename = exportFilename();
    let url = '';
    try {
      const blob = new Blob([serializeExport(buildExport(state.event, selectedSessions()))], { type: 'application/json' });
      url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      if (url) URL.revokeObjectURL(url);
      const message = 'JSONファイルを作れませんでした。回る予定はそのまま残っています。もう一度お試しください。';
      showExportStatus(message, 'alert');
      announce(message);
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
    // ページからは保存の完了や保存先を確かめられないため、要求したことだけを伝える
    const message = `JSONのダウンロードを要求しました（${filename}）。保存できたかと保存先は、ブラウザーのダウンロード表示で確かめてください。`;
    showExportStatus(message);
    announce(message);
  }

  /* ---------- 依頼文のコピー ---------- */

  async function copyRequest() {
    if (state.status !== 'ready' || !state.requestText) return;
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('unavailable');
      await navigator.clipboard.writeText(state.requestText);
      ui.copyFallback.hidden = true;
      setLiveText(ui.copyStatus, '依頼文をクリップボードにコピーしました。');
    } catch {
      ui.copyFallbackText.value = state.requestText;
      ui.copyFallback.hidden = false;
      ui.copyFallbackText.focus();
      ui.copyFallbackText.select();
      setLiveText(ui.copyStatus, 'この環境では自動でコピーできませんでした。下の欄の文を選択したので、端末のコピー操作でコピーしてください。');
    }
  }

  /* ---------- 起動 ---------- */

  function onOpenLink(event) {
    const target = event.target instanceof Element ? event.target.closest('a[data-open]') : null;
    if (!target) return;
    const details = document.getElementById(target.dataset.open);
    if (details && details.tagName === 'DETAILS') details.open = true;
  }

  function init() {
    initTheme();
    initFilters();
    ui.toggle.addEventListener('click', onToggle);
    ui.save.addEventListener('click', onExport);
    ui.tryRecorded.addEventListener('click', onTryRecorded);
    ui.clearButton.addEventListener('click', onClearAll);
    ui.copyButton.addEventListener('click', copyRequest);
    ui.loadRetry.addEventListener('click', () => {
      if (ui.loadRetry.getAttribute('aria-disabled') !== 'true') loadAll(true);
    });
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', onOpenLink);
    if (typeof window.ResizeObserver === 'function') new window.ResizeObserver(scheduleWires).observe(ui.figure);
    else window.addEventListener('resize', scheduleWires);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleWires);
    updateUnavailableTexts();
    loadAll(false);
  }

  init();
})();
