'use strict';

/*
 * app.js — こもれび つくる日 企画ガイド（架空イベントの作例）
 *
 * Frontend Developer 段階の実装。ビルドなしの vanilla JS 1ファイル。
 * 状態は state の1か所に置き、部品は状態から描く。取得したデータは textContent と DOM API だけで描き、HTML として差し込まない。
 * 通信は同じフォルダーの input/event.json・outputs/ux-handoff.json・request.txt だけ。
 */
(() => {
  const PATHS = Object.freeze({
    event: 'input/event.json',
    handoff: 'outputs/ux-handoff.json',
    request: 'request.txt',
  });
  const ROLE_SOURCE = Object.freeze({
    repository: 'msitarzewski/agency-agents',
    commit: 'bd956db032d907387e6b9ddebff3e18f1de8c679',
  });
  const THEME_KEY = 'studio-yebisu.agency-agents-example.theme';
  const THEMES = ['system', 'light', 'dark'];
  const KIND_LABELS = Object.freeze({ workshop: 'ワークショップ', talk: 'トーク', consultation: '相談' });
  const FILTER_VALUES = Object.freeze({
    kind: ['all', 'workshop', 'talk', 'consultation'],
    time: ['all', 'morning', 'afternoon'],
    fee: ['all', 'free', 'paid'],
  });
  const SESSION_COUNT = 6;
  const NOON = 12 * 60;
  const ROLE_IDS = ['ux-architect', 'frontend-developer'];
  const EXPORT_FORMAT = 'komorebi-itinerary/v1';
  const EXPORT_NOTICE = '架空のイベントの予定メモです。予約・支払い・参加確定ではありません。';
  const SELECTION_RULE = '開始が相手の終了より前で、相手の開始が終了より前なら重なりとし、重なる企画は同時に選ばない。終了と開始が同時刻なら重ならない。予約不要の企画も開始から終了までの枠全体を使う。';
  const SEARCH_DELAY = 400;
  const ANNOUNCE_DELAY = 60;
  const REVOKE_DELAY = 60000;
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const SLUG_RE = /^[A-Za-z0-9_-]+$/;
  const PATH_RE = /^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/;

  const $ = (id) => document.getElementById(id);

  const ui = {
    root: document.documentElement,
    themeButtons: Array.from(document.querySelectorAll('[data-theme-choice]')),
    themeNote: $('theme-note'),
    themeMeta: document.querySelector('meta[name="theme-color"]'),
    title: $('event-title'),
    subtitle: $('event-subtitle'),
    area: $('event-area'),
    reservationNote: $('event-reservation-note'),
    loadStatus: $('load-status'),
    loadError: $('load-error'),
    loadErrorReason: $('load-error-reason'),
    loadRetry: $('load-retry'),
    facts: $('event-facts'),
    factDate: $('fact-date'),
    factTimezone: $('fact-timezone'),
    factHours: $('fact-hours'),
    factVenue: $('fact-venue'),
    factAdmission: $('fact-admission'),
    more: $('event-more'),
    access: $('event-access'),
    weather: $('event-weather'),
    filtersTitle: $('filters-title'),
    filterForm: $('filter-form'),
    filterSet: $('filter-set'),
    query: $('filter-query'),
    kind: $('filter-kind'),
    time: $('filter-time'),
    fee: $('filter-fee'),
    filterReset: $('filter-reset'),
    resultStatus: $('result-status'),
    noResults: $('no-results'),
    noResultsReset: $('no-results-reset'),
    sessionsTitle: $('sessions-title'),
    list: $('session-list'),
    jumpLinks: [$('jump-top'), $('jump-bottom')],
    itineraryTitle: $('itinerary-title'),
    itineraryEmpty: $('itinerary-empty'),
    itineraryList: $('itinerary-list'),
    itinerarySummary: $('itinerary-summary'),
    itineraryCount: $('itinerary-count'),
    itinerarySpan: $('itinerary-span'),
    itineraryTotal: $('itinerary-total'),
    itineraryReservation: $('itinerary-reservation'),
    exportButton: $('export-button'),
    exportReason: $('export-reason'),
    exportStatus: $('export-status'),
    clearButton: $('clear-button'),
    appStatus: $('app-status'),
    handoffStatus: $('handoff-status'),
    handoffError: $('handoff-error'),
    handoffErrorReason: $('handoff-error-reason'),
    handoffRetry: $('handoff-retry'),
    handoffMismatch: $('handoff-mismatch'),
    roles: $('roles'),
    decisions: $('decisions'),
    decisionA09: $('decision-a09'),
    decisionA09Text: $('decision-a09-text'),
    decisionRule: $('decision-rule'),
    requestDetails: $('request-details'),
    requestStatus: $('request-status'),
    requestError: $('request-error'),
    requestErrorReason: $('request-error-reason'),
    requestRetry: $('request-retry'),
    requestText: $('request-text'),
    copyButton: $('copy-button'),
    copyStatus: $('copy-status'),
    copyFallback: $('copy-fallback'),
    copyFallbackText: $('copy-fallback-text'),
  };

  const state = {
    eventStatus: 'loading', // 'loading' | 'ready' | 'error'
    event: null,
    handoffStatus: 'loading',
    handoff: null,
    requestStatus: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
    requestText: '',
    filters: { kind: 'all', time: 'all', fee: 'all', query: '' },
    selected: new Set(), // 保存しない。再読み込みで空に戻る
    theme: 'system',
    themeSaveFailed: false,
  };

  // 同じファイルへの読み込みを重ねないための目印
  const inflight = { event: false, handoff: false, request: false };
  let cards = [];

  /* ---------- 小さな道具 ---------- */

  class LoadError extends Error {
    constructor(kind, detail) {
      super(detail);
      this.kind = kind; // 'network' | 'http' | 'parse' | 'validation'
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

  function toMinutes(hm) {
    const match = TIME_RE.exec(hm);
    return Number(match[1]) * 60 + Number(match[2]);
  }

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
  const quoteTitles = (sessions) => sessions.map((s) => `「${s.title}」`).join('・');
  const describeSessions = (sessions) => sessions.map((s) => `「${s.title}」（${fmtRange(s)}）`).join('・');

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

  let announceTimer = 0;
  function announce(message) {
    window.clearTimeout(announceTimer);
    ui.appStatus.textContent = '';
    announceTimer = window.setTimeout(() => {
      ui.appStatus.textContent = message;
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

  /* ---------- 取得 ---------- */

  async function fetchText(path) {
    let response;
    try {
      response = await fetch(path, { cache: 'no-store' });
    } catch {
      throw new LoadError('network', '通信に失敗しました。');
    }
    if (!response.ok) throw new LoadError('http', `サーバーが ${response.status} を返しました。`);
    try {
      return await response.text();
    } catch {
      throw new LoadError('network', '通信が途中で切れました。');
    }
  }

  async function fetchJSON(path) {
    const text = await fetchText(path);
    try {
      return JSON.parse(text);
    } catch {
      throw new LoadError('parse', 'JSONとして読めませんでした。');
    }
  }

  const asLoadError = (error) =>
    error instanceof LoadError ? error : new LoadError('validation', '想定していない形式のデータでした。');

  /* ---------- 検証 ---------- */

  function fail(path, reason) {
    throw new LoadError('validation', `${path} の形式が正しくありません（${reason}）。`);
  }

  function requireText(object, key, prefix) {
    if (!isText(object[key])) fail(`${prefix}${key}`, '空でない文字列が必要です');
  }

  function validateEvent(data) {
    if (!isPlainObject(data)) fail('最上位', 'オブジェクトが必要です');
    ['id', 'title', 'subtitle', 'venue', 'area', 'admission', 'reservation_note', 'access', 'weather'].forEach((key) =>
      requireText(data, key, ''),
    );
    if (!SLUG_RE.test(data.id)) fail('id', '英数字・ハイフン・下線だけが使えます');
    if (data.fictional !== true) fail('fictional', 'この作例は架空のイベントだけを表示するため true が必要です');
    if (typeof data.date !== 'string' || !isCalendarDate(data.date)) fail('date', 'YYYY-MM-DD の実在する日付が必要です');
    if (data.timezone !== 'Asia/Tokyo') fail('timezone', 'このページは日本時間で表示するため Asia/Tokyo が必要です');
    if (!isTime(data.opening)) fail('opening', 'HH:MM の時刻が必要です');
    if (!isTime(data.closing)) fail('closing', 'HH:MM の時刻が必要です');
    if (toMinutes(data.opening) >= toMinutes(data.closing)) fail('closing', '開場より後の時刻が必要です');
    if (!Array.isArray(data.sessions)) fail('sessions', '配列が必要です');
    if (data.sessions.length !== SESSION_COUNT) {
      fail('sessions', `このページは${SESSION_COUNT}件の企画を前提にしています（${data.sessions.length}件でした）`);
    }

    const ids = new Set();
    data.sessions.forEach((session, index) => {
      const path = `sessions[${index}]`;
      if (!isPlainObject(session)) fail(path, 'オブジェクトが必要です');
      ['id', 'title', 'room', 'age', 'description', 'note'].forEach((key) => requireText(session, key, `${path}.`));
      if (ids.has(session.id)) fail(`${path}.id`, `「${session.id}」が重複しています`);
      ids.add(session.id);
      if (typeof session.kind !== 'string' || !hasOwn(KIND_LABELS, session.kind)) {
        fail(`${path}.kind`, 'workshop・talk・consultation のどれかが必要です');
      }
      if (!isTime(session.start)) fail(`${path}.start`, 'HH:MM の時刻が必要です');
      if (!isTime(session.end)) fail(`${path}.end`, 'HH:MM の時刻が必要です');
      if (toMinutes(session.start) >= toMinutes(session.end)) fail(`${path}.end`, '開始より後の時刻が必要です');
      if (!Number.isInteger(session.price_yen) || session.price_yen < 0) fail(`${path}.price_yen`, '0以上の整数が必要です');
      if (session.capacity !== null && (!Number.isInteger(session.capacity) || session.capacity < 1)) {
        fail(`${path}.capacity`, '1以上の整数か null が必要です');
      }
      if (typeof session.reservation_required !== 'boolean') fail(`${path}.reservation_required`, 'true か false が必要です');
    });
    return data;
  }

  function validateHandoff(data) {
    if (!isPlainObject(data)) fail('最上位', 'オブジェクトが必要です');
    const { meta } = data;
    if (!isPlainObject(meta)) fail('meta', 'オブジェクトが必要です');
    if (meta.fictional !== true) fail('meta.fictional', 'true が必要です');
    requireText(meta, 'event_id', 'meta.');
    if (meta.source_commit !== ROLE_SOURCE.commit) fail('meta.source_commit', `固定コミット ${ROLE_SOURCE.commit} が必要です`);
    if (!Array.isArray(data.roles) || data.roles.length !== ROLE_IDS.length) fail('roles', `${ROLE_IDS.length}件の配列が必要です`);
    data.roles.forEach((role, index) => {
      const path = `roles[${index}]`;
      if (!isPlainObject(role)) fail(path, 'オブジェクトが必要です');
      if (role.id !== ROLE_IDS[index]) fail(`${path}.id`, `${ROLE_IDS[index]} が必要です`);
      requireText(role, 'name', `${path}.`);
      if (!isSafePath(role.source_path)) fail(`${path}.source_path`, 'このフォルダー内の相対パスが必要です');
      ['inputs', 'deliverables'].forEach((key) => {
        if (!Array.isArray(role[key]) || role[key].length === 0 || !role[key].every(isSafePath)) {
          fail(`${path}.${key}`, 'このフォルダー内の相対パスの配列が必要です');
        }
      });
      if (!isTextArray(role.checks)) fail(`${path}.checks`, '空でない文字列の配列が必要です');
      if (
        !Array.isArray(role.applied_instructions) ||
        !role.applied_instructions.every((item) => isPlainObject(item) && isText(item.instruction) && isText(item.application))
      ) {
        fail(`${path}.applied_instructions`, '指示と適用の組の配列が必要です');
      }
    });
    if (!Array.isArray(data.acceptance) || !data.acceptance.every((item) => isPlainObject(item) && isText(item.id) && isText(item.criterion))) {
      fail('acceptance', 'id と criterion の組の配列が必要です');
    }
    if (!isPlainObject(data.data_contract) || !isText(data.data_contract.conflict_rule)) {
      fail('data_contract.conflict_rule', '空でない文字列が必要です');
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

  /* ---------- 企画データの読み込み ---------- */

  function showEventLoading() {
    state.eventStatus = 'loading';
    if (ui.loadError.hidden) ui.loadStatus.textContent = '企画データを読み込んでいます…';
    setBusy(ui.loadRetry, true);
    ui.filterSet.disabled = true;
    renderItinerary();
  }

  async function loadEvent(fromRetry) {
    if (inflight.event) return;
    inflight.event = true;
    showEventLoading();
    let data = null;
    let error = null;
    try {
      data = validateEvent(await fetchJSON(PATHS.event));
    } catch (caught) {
      error = asLoadError(caught);
    }
    inflight.event = false;
    if (error) onEventError(error, fromRetry);
    else onEventReady(data, fromRetry);
  }

  function onEventError(error, fromRetry) {
    state.eventStatus = 'error';
    state.event = null;
    state.selected.clear();
    cards = [];
    ui.list.replaceChildren();
    ui.loadStatus.textContent = '';
    ui.facts.hidden = true;
    ui.more.hidden = true;
    ui.subtitle.hidden = true;
    ui.area.textContent = '';
    ui.reservationNote.textContent = '';
    ui.filterSet.disabled = true;
    ui.noResults.hidden = true;
    ui.resultStatus.textContent = '';
    ui.loadError.hidden = false;
    setLiveText(ui.loadErrorReason, error.detail);
    setBusy(ui.loadRetry, false, 'もう一度読み込む');
    if (fromRetry) ui.loadRetry.focus();
    renderItinerary();
    renderHandoffMatch();
  }

  function onEventReady(data, fromRetry) {
    state.event = data;
    state.eventStatus = 'ready';
    state.selected.clear();
    renderIntro(data);
    cards = [...data.sessions].sort(compareSessions).map((session, index) => buildCard(session, index, data.date));
    ui.list.replaceChildren(...cards.map((card) => card.li));
    ui.loadStatus.textContent = '';
    ui.loadError.hidden = true;
    setBusy(ui.loadRetry, false, 'もう一度読み込む');
    ui.filterSet.disabled = false;
    readFilters();
    applyFilters(0);
    renderSelection();
    renderHandoffMatch();
    if (fromRetry) ui.filtersTitle.focus();
  }

  function renderIntro(data) {
    ui.title.textContent = data.title;
    document.title = `${data.title} 企画ガイド（架空イベントの作例）`;
    ui.subtitle.textContent = data.subtitle;
    ui.subtitle.hidden = false;
    ui.area.textContent = data.area;
    ui.reservationNote.textContent = data.reservation_note;
    ui.factDate.textContent = fmtDate(data.date);
    ui.factDate.dateTime = data.date;
    ui.factTimezone.textContent = `時刻は日本時間（${data.timezone}）`;
    ui.factHours.textContent = `${data.opening}–${data.closing}`;
    ui.factVenue.textContent = data.venue;
    ui.factAdmission.textContent = data.admission;
    ui.access.textContent = data.access;
    ui.weather.textContent = data.weather;
    ui.facts.hidden = false;
    ui.more.hidden = false;
  }

  /* ---------- 企画カード ---------- */

  function addMeta(list, label, value) {
    list.append(el('dt', null, label), el('dd', null, value));
  }

  function buildCard(session, index, date) {
    const base = `session-${index + 1}`;
    const li = el('li', 'c-session-list__item');
    const article = el('article', 'c-card c-session');
    article.dataset.state = 'available';
    article.setAttribute('aria-labelledby', `${base}-title`);

    const grid = el('div', 'l-session-grid');
    const time = el('p', 'c-session__time');
    const range = el('span', 'c-session__range');
    range.append(timeEl(date, session.start), '–', timeEl(date, session.end));
    time.append(range, el('span', 'c-session__duration', `${toMinutes(session.end) - toMinutes(session.start)}分`));

    const body = el('div', 'c-session__body l-stack');
    const tags = el('div', 'c-session__tags l-cluster');
    tags.append(
      el('span', `c-tag c-tag--${session.kind}`, KIND_LABELS[session.kind]),
      session.reservation_required ? el('span', 'c-tag c-tag--required', '予約が必要') : el('span', 'c-tag c-tag--open', '予約不要'),
    );
    const title = el('h3', 'c-session__title', session.title);
    title.id = `${base}-title`;
    const meta = el('dl', 'c-meta c-session__meta');
    addMeta(meta, '部屋', session.room);
    addMeta(meta, '費用', fmtFee(session.price_yen));
    addMeta(meta, '対象', session.age);
    addMeta(meta, '定員', fmtCapacity(session.capacity));
    addMeta(meta, '予約', fmtReservation(session.reservation_required));
    addMeta(meta, 'メモ', session.note);
    body.append(tags, title, el('p', 'c-session__desc', session.description), meta);

    if (!session.reservation_required) {
      body.append(
        el('p', 'c-session__block', `予約不要の企画も、回る予定では${fmtRange(session)}の枠全体を使うものとして重なりを判定します。`),
      );
    }

    const selectedNote = el('p', 'c-session__selected', '回る予定に入っています。外すときは、もう一度このボタンを押すか、回る予定の「外す」を使います。');
    selectedNote.id = `${base}-selected`;
    selectedNote.hidden = true;
    const conflictNote = el('p', 'c-session__conflict');
    conflictNote.id = `${base}-conflict`;
    conflictNote.hidden = true;

    const button = el('button', 'c-button c-button--block c-button--primary c-session__toggle');
    button.type = 'button';
    button.id = `${base}-toggle`;
    button.setAttribute('aria-pressed', 'false');
    button.append('回る予定に入れる', el('span', 'u-visually-hidden', `：${session.title}`));
    body.append(selectedNote, conflictNote, button);

    grid.append(time, body);
    article.append(grid);
    li.append(article);

    const card = {
      session,
      li,
      article,
      button,
      selectedNote,
      conflictNote,
      haystack: normalize([session.title, session.description, session.room, session.age, session.note].join('\n')),
    };
    button.addEventListener('click', () => onToggle(card));
    return card;
  }

  function conflictMessage(clashes) {
    return `回る予定の${describeSessions(clashes)}と時間が重なるため、入れられません。こちらにする場合は、先に回る予定から${quoteTitles(clashes)}を外してください。`;
  }

  function updateCards() {
    cards.forEach((card) => {
      const selected = state.selected.has(card.session.id);
      const clashes = selected ? [] : overlappingSelected(card.session);
      const status = selected ? 'selected' : clashes.length > 0 ? 'conflict' : 'available';
      card.article.dataset.state = status;
      card.button.setAttribute('aria-pressed', String(selected));
      card.button.firstChild.nodeValue = selected ? '回る予定から外す' : '回る予定に入れる';
      card.button.classList.toggle('c-button--primary', status === 'available');
      card.selectedNote.hidden = !selected;
      card.conflictNote.hidden = status !== 'conflict';
      card.conflictNote.textContent = status === 'conflict' ? conflictMessage(clashes) : '';
      delete card.conflictNote.dataset.attempted;
      const describedBy = status === 'conflict' ? card.conflictNote.id : selected ? card.selectedNote.id : '';
      if (describedBy) card.button.setAttribute('aria-describedby', describedBy);
      else card.button.removeAttribute('aria-describedby');
    });
  }

  /* ---------- 選択（回る予定） ---------- */

  const sessionById = (id) => state.event.sessions.find((session) => session.id === id);

  function selectedSessions() {
    if (state.eventStatus !== 'ready') return [];
    return state.event.sessions.filter((session) => state.selected.has(session.id)).sort(compareSessions);
  }

  function overlappingSelected(session) {
    return selectedSessions().filter((other) => other.id !== session.id && overlaps(session, other));
  }

  // 重なる企画は入れず、理由を返して何も変えない。黙って入れ替えることはしない
  function addSession(session) {
    if (!sessionById(session.id)) return { ok: false, clashes: [] };
    const clashes = overlappingSelected(session);
    if (clashes.length > 0) return { ok: false, clashes };
    state.selected.add(session.id);
    return { ok: true, clashes: [] };
  }

  function removeSession(session) {
    state.selected.delete(session.id);
  }

  function onToggle(card) {
    if (state.eventStatus !== 'ready') return;
    const { session } = card;
    if (state.selected.has(session.id)) {
      removeSession(session);
      announce(`「${session.title}」を回る予定から外しました。いま${state.selected.size}件です。`);
      renderSelection();
      return;
    }
    const result = addSession(session);
    if (!result.ok) {
      card.conflictNote.dataset.attempted = 'true';
      announce(
        `「${session.title}」（${fmtRange(session)}）は入れていません。回る予定の${describeSessions(result.clashes)}と時間が重なります。回る予定は${state.selected.size}件のまま変わっていません。`,
      );
      return;
    }
    const blocked = state.event.sessions.filter((other) => !state.selected.has(other.id) && overlaps(session, other));
    let message = `「${session.title}」（${fmtRange(session)}）を回る予定に入れました。いま${state.selected.size}件です。`;
    if (blocked.length > 0) message += `${quoteTitles(blocked)}は時間が重なるため、このままでは入れられません。`;
    announce(message);
    renderSelection();
  }

  function onRemoveItem(session, index) {
    removeSession(session);
    announce(`「${session.title}」を回る予定から外しました。いま${state.selected.size}件です。`);
    renderSelection();
    const buttons = ui.itineraryList.querySelectorAll('.c-itinerary__remove');
    const target = buttons[index] || buttons[index - 1] || ui.itineraryTitle;
    target.focus();
  }

  function onClearAll() {
    const count = state.selected.size;
    if (count === 0) return;
    state.selected.clear();
    announce(`回る予定の${count}件をすべて外しました。`);
    renderSelection();
    ui.itineraryTitle.focus();
  }

  function renderSelection() {
    hideExportStatus();
    updateCards();
    renderItinerary();
    updateResultStatusNow();
  }

  function renderItinerary() {
    const items = selectedSessions();
    const count = items.length;
    ui.itineraryList.replaceChildren();
    items.forEach((session, index) => {
      const li = el('li', 'c-itinerary__item');
      const info = el('div', 'c-itinerary__info');
      const time = el('p', 'c-itinerary__time');
      time.append(timeEl(state.event.date, session.start), '–', timeEl(state.event.date, session.end));
      const detail = [
        fmtFee(session.price_yen),
        session.room,
        session.reservation_required ? '予約が必要（この作例では受付しません）' : `予約不要（${fmtRange(session)}の枠全体）`,
      ].join('・');
      info.append(time, el('p', 'c-itinerary__name', session.title), el('p', 'c-itinerary__detail', detail));
      const remove = el('button', 'c-button c-itinerary__remove');
      remove.type = 'button';
      remove.append('外す', el('span', 'u-visually-hidden', `：${session.title}`));
      remove.addEventListener('click', () => onRemoveItem(session, index));
      li.append(info, remove);
      ui.itineraryList.append(li);
    });

    ui.itineraryEmpty.textContent =
      state.eventStatus === 'ready'
        ? 'まだ企画を選んでいません。企画一覧で「回る予定に入れる」を押すと、ここに時間順で並びます。'
        : state.eventStatus === 'error'
          ? '企画データを読み込めなかったため、回る予定を作れません。'
          : '企画データを読み込むと、ここで回る予定を作れます。';
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

    ui.clearButton.hidden = count === 0;
    ui.clearButton.textContent = `回る予定をすべて外す（${count}件）`;
    ui.jumpLinks.forEach((link) => {
      link.textContent = `回る予定（${count}件）を見る`;
    });
    updateExport();
  }

  /* ---------- 絞り込み ---------- */

  const pick = (value, allowed) => (allowed.includes(value) ? value : 'all');

  function readFilters() {
    state.filters = {
      kind: pick(ui.kind.value, FILTER_VALUES.kind),
      time: pick(ui.time.value, FILTER_VALUES.time),
      fee: pick(ui.fee.value, FILTER_VALUES.fee),
      query: ui.query.value,
    };
  }

  function matches(card, tokens) {
    const { session } = card;
    const { kind, time, fee } = state.filters;
    if (kind !== 'all' && session.kind !== kind) return false;
    const start = toMinutes(session.start);
    if (time === 'morning' && start >= NOON) return false;
    if (time === 'afternoon' && start < NOON) return false;
    if (fee === 'free' && session.price_yen !== 0) return false;
    if (fee === 'paid' && session.price_yen === 0) return false;
    return tokens.every((token) => card.haystack.includes(token));
  }

  let resultTimer = 0;

  function resultText() {
    if (state.eventStatus !== 'ready') return '';
    const shown = cards.filter((card) => !card.li.hidden).length;
    const hiddenSelected = cards.filter((card) => card.li.hidden && state.selected.has(card.session.id)).length;
    let text =
      shown === 0 ? `${cards.length}件中0件です。条件に合う企画はありません。` : `${cards.length}件中${shown}件を表示しています。`;
    if (hiddenSelected > 0) text += `回る予定のうち${hiddenSelected}件は、今の条件では一覧に出ていません。`;
    return text;
  }

  function updateResultStatusNow() {
    window.clearTimeout(resultTimer);
    const text = resultText();
    if (ui.resultStatus.textContent !== text) ui.resultStatus.textContent = text;
  }

  function applyFilters(delay) {
    if (state.eventStatus !== 'ready') return;
    const tokens = normalize(state.filters.query).split(/\s+/u).filter(Boolean);
    let shown = 0;
    cards.forEach((card) => {
      const visible = matches(card, tokens);
      card.li.hidden = !visible;
      if (visible) shown += 1;
    });
    ui.noResults.hidden = shown !== 0;
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
    readFilters();
    applyFilters(0);
  }

  function initFilters() {
    ui.filterForm.addEventListener('submit', (event) => event.preventDefault());
    ui.query.addEventListener('input', () => {
      readFilters();
      applyFilters(SEARCH_DELAY);
    });
    [ui.kind, ui.time, ui.fee].forEach((select) => {
      select.addEventListener('change', () => {
        readFilters();
        applyFilters(0);
      });
    });
    ui.filterReset.addEventListener('click', resetFilters);
    ui.noResultsReset.addEventListener('click', () => {
      resetFilters();
      ui.sessionsTitle.focus();
    });
  }

  /* ---------- JSON の書き出し ---------- */

  const exportFilename = () => `${state.event.id}-${state.event.date}-itinerary.json`;

  function exportAvailability() {
    if (state.eventStatus === 'loading') return { ok: false, reason: '企画データの読み込み後に保存できます。' };
    if (state.eventStatus === 'error') return { ok: false, reason: '企画データを読み込めなかったため保存できません。' };
    if (state.selected.size === 0) return { ok: false, reason: '企画を1件以上選ぶと保存できます。' };
    return {
      ok: true,
      reason: `選んだ${state.selected.size}件を ${exportFilename()} として保存します。予約や参加確定にはなりません。`,
    };
  }

  function updateExport() {
    const { ok, reason } = exportAvailability();
    ui.exportButton.disabled = !ok;
    ui.exportReason.textContent = reason;
  }

  function buildExport() {
    const { event } = state;
    const sessions = selectedSessions(); // 入力の企画オブジェクトをそのまま、時刻順で
    return {
      format: EXPORT_FORMAT,
      fictional: true,
      reserved: false,
      notice: EXPORT_NOTICE,
      event: { id: event.id, title: event.title, date: event.date, timezone: event.timezone, venue: event.venue },
      source: { event_file: PATHS.event, role_source: ROLE_SOURCE.repository, role_source_commit: ROLE_SOURCE.commit },
      selection_rule: SELECTION_RULE,
      selected_ids: sessions.map((session) => session.id),
      sessions,
      derived: { count: sessions.length, total_price_yen: sessions.reduce((sum, session) => sum + session.price_yen, 0) },
    };
  }

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
    if (!exportAvailability().ok) return;
    const filename = exportFilename();
    let url = '';
    try {
      const blob = new Blob([`${JSON.stringify(buildExport(), null, 2)}\n`], { type: 'application/json' });
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
    // ページからは保存の完了を確かめられないため、要求したことだけを伝える
    const message = `JSONのダウンロードを要求しました（${filename}）。保存できたかは、ブラウザーのダウンロード表示で確かめてください。`;
    showExportStatus(message);
    announce(message);
  }

  /* ---------- 引き継ぎ書（ページ下部の details） ---------- */

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

  function addFact(list, label, content) {
    const row = el('div');
    const value = el('dd');
    value.append(content);
    row.append(el('dt', null, label), value);
    list.append(row);
  }

  function renderRoles(handoff) {
    const fragment = document.createDocumentFragment();
    handoff.roles.forEach((role, index) => {
      const article = el('article', 'c-role');
      const heading = el('h3', 'c-role__title');
      heading.append(el('span', 'c-role__step', `段階${index + 1}`), role.name);
      const facts = el('dl', 'c-role__facts');
      addFact(facts, '役割ファイル', pathList([role.source_path]));
      addFact(facts, '入力', pathList(role.inputs));
      addFact(facts, '成果物', pathList(role.deliverables));
      article.append(heading, facts);

      const checks = el('details', 'c-role__more');
      checks.append(el('summary', null, `引き継ぎ書に書いた確認項目（${role.checks.length}件・合格の記録ではありません）`));
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
          li.append(el('p', null, item.instruction), el('p', null, item.application));
          appliedList.append(li);
        });
        applied.append(appliedList);
        article.append(applied);
      }
      fragment.append(article);
    });
    ui.roles.replaceChildren(fragment);

    const a09 = handoff.acceptance.find((item) => item.id === 'A09');
    ui.decisionA09Text.textContent = a09 ? a09.criterion : '';
    ui.decisionA09.hidden = !a09;
    ui.decisionRule.textContent = handoff.data_contract.conflict_rule;
    ui.decisions.hidden = false;
  }

  function renderHandoffMatch() {
    const mismatch =
      state.handoffStatus === 'ready' && state.eventStatus === 'ready' && state.handoff.meta.event_id !== state.event.id;
    ui.handoffMismatch.hidden = !mismatch;
    ui.handoffMismatch.textContent = mismatch
      ? `引き継ぎ書の対象（${state.handoff.meta.event_id}）と、読み込んだ企画データ（${state.event.id}）が一致しません。`
      : '';
  }

  async function loadHandoff(fromRetry) {
    if (inflight.handoff) return;
    inflight.handoff = true;
    state.handoffStatus = 'loading';
    if (ui.handoffError.hidden) ui.handoffStatus.textContent = '引き継ぎ書を読み込んでいます…';
    setBusy(ui.handoffRetry, true);
    let data = null;
    let error = null;
    try {
      data = validateHandoff(await fetchJSON(PATHS.handoff));
    } catch (caught) {
      error = asLoadError(caught);
    }
    inflight.handoff = false;
    setBusy(ui.handoffRetry, false, 'もう一度読み込む');
    if (error) {
      state.handoffStatus = 'error';
      state.handoff = null;
      ui.handoffStatus.textContent = '';
      ui.roles.replaceChildren();
      ui.decisions.hidden = true;
      ui.handoffError.hidden = false;
      setLiveText(ui.handoffErrorReason, error.detail);
      if (fromRetry) ui.handoffRetry.focus();
    } else {
      state.handoffStatus = 'ready';
      state.handoff = data;
      ui.handoffStatus.textContent = '';
      ui.handoffError.hidden = true;
      renderRoles(data);
      const firstTitle = ui.roles.querySelector('.c-role__title');
      if (fromRetry && firstTitle) {
        firstTitle.tabIndex = -1;
        firstTitle.focus();
      }
    }
    renderHandoffMatch();
  }

  /* ---------- 依頼文（開いたときに読み込む） ---------- */

  async function loadRequest(fromRetry) {
    if (inflight.request) return;
    inflight.request = true;
    state.requestStatus = 'loading';
    ui.copyButton.disabled = true;
    if (ui.requestError.hidden) ui.requestStatus.textContent = '依頼文を読み込んでいます…';
    setBusy(ui.requestRetry, true);
    let text = '';
    let error = null;
    try {
      text = await fetchText(PATHS.request);
      if (text.trim() === '') throw new LoadError('validation', '依頼文のファイルが空でした。');
    } catch (caught) {
      error = asLoadError(caught);
    }
    inflight.request = false;
    setBusy(ui.requestRetry, false, 'もう一度読み込む');
    if (error) {
      state.requestStatus = 'error';
      state.requestText = '';
      ui.requestStatus.textContent = '';
      ui.requestText.hidden = true;
      ui.requestError.hidden = false;
      setLiveText(ui.requestErrorReason, error.detail);
      if (fromRetry) ui.requestRetry.focus();
      return;
    }
    state.requestStatus = 'ready';
    state.requestText = text;
    ui.requestText.textContent = text;
    ui.requestText.hidden = false;
    ui.requestError.hidden = true;
    ui.requestStatus.textContent = '';
    ui.copyButton.disabled = false;
    if (fromRetry) ui.copyButton.focus();
  }

  async function copyRequest() {
    if (state.requestStatus !== 'ready') return;
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

  function init() {
    initTheme();
    initFilters();
    ui.exportButton.addEventListener('click', onExport);
    ui.clearButton.addEventListener('click', onClearAll);
    ui.loadRetry.addEventListener('click', () => {
      if (ui.loadRetry.getAttribute('aria-disabled') !== 'true') loadEvent(true);
    });
    ui.handoffRetry.addEventListener('click', () => {
      if (ui.handoffRetry.getAttribute('aria-disabled') !== 'true') loadHandoff(true);
    });
    ui.requestRetry.addEventListener('click', () => {
      if (ui.requestRetry.getAttribute('aria-disabled') !== 'true') loadRequest(true);
    });
    ui.requestDetails.addEventListener('toggle', () => {
      if (ui.requestDetails.open && state.requestStatus === 'idle') loadRequest(false);
    });
    ui.copyButton.addEventListener('click', copyRequest);
    renderItinerary();
    loadEvent(false);
    loadHandoff(false);
  }

  init();
})();
