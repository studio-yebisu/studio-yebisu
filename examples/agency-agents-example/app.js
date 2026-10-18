'use strict';

/*
 * app.js — Agency Agents「AIに渡す、専門家の指示書集」の図（visual-r2）
 *
 * 主役は役割の指示書そのものと、その渡し方。concept/manifest.json を固定の SHA-256 で確かめ、
 * 記載の11ファイルのバイト数・SHA-256・形と、原文の抜粋が実際の役割ファイルにあることを確かめてから描く。
 * 図の切替は説明のためのもので、AIは呼び出さない。企画ガイドの操作は guide.html（保存済みの成果）に任せる。
 * 取得した文字は textContent と DOM API だけで描き、HTML として差し込まない。
 */
(() => {
  /* ---------- 固定値 ---------- */

  const MANIFEST_PATH = 'concept/manifest.json';
  const MANIFEST_SHA256 = '522efc56d1f288949d12c156ff913a83634b7015442c1f19c0a6b9722ddefae8';
  const MANIFEST_FORMAT = 'agency-structure-assets/v1';
  const STRUCTURE_FORMAT = 'agency-structure/v1';
  const CASE_ID = 'agency-agents-example';
  const REPOSITORY = 'msitarzewski/agency-agents';
  const COMMIT = 'bd956db032d907387e6b9ddebff3e18f1de8c679';
  // manifest に書かれている順番どおり
  const FILES = Object.freeze({
    structure: 'concept/structure.json',
    readme: 'vendor/agency-agents/README.md',
    ux: 'vendor/agency-agents/design/design-ux-architect.md',
    frontend: 'vendor/agency-agents/engineering/engineering-frontend-developer.md',
    event: 'input/event.json',
    handoff: 'outputs/ux-handoff.json',
    foundation: 'foundation.css',
    implementation: 'outputs/implementation.md',
    itinerary: 'outputs/browser-itinerary.json',
    request: 'request.txt',
    license: 'vendor/agency-agents/LICENSE',
  });
  const FILE_ORDER = Object.freeze(Object.values(FILES));
  const ROLE_IDS = ['ux', 'frontend'];
  const PART_IDS = ['identity', 'mission', 'rules', 'workflow', 'deliverables', 'success'];
  const SESSION_IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
  const RECORDED = Object.freeze({ ids: ['S01', 'S03', 'S05', 'S06'], total: 1000 });
  const STAGES = ['contents', 'hand', 'link'];
  const STAGE_TEXT = Object.freeze({
    contents: { name: '中身', line: '1 中身：指示書は1つのMarkdown文書。6つの部分は、この2つの原典に共通する見出しを制作担当が整理したもので、全役割共通の形式ではありません。' },
    hand: { name: '渡す', line: '2 渡す：指示書と今回の依頼・材料を一緒にAIへ。指示書が自分で動くのではなく、AIが両方を読んで成果物を作ります。' },
    link: { name: 'つなぐ', line: '3 つなぐ：1回目の成果物を、次の指示書と一緒に2回目の入力へ。同じAIに別の指示書を渡し、ファイルは制作担当が渡しました。' },
  });
  // 今回の依頼と材料に並べる順番と呼び名
  const INPUT_LABELS = Object.freeze({
    'request.txt': { name: '依頼文', order: 0 },
    'input/event.json': { name: '架空の6企画', order: 1 },
    'outputs/ux-handoff.json': { name: '引き継ぎ書', order: 2 },
    'foundation.css': { name: 'CSS土台', order: 3 },
  });
  // foundation.css の実際のトークン（このページも同じファイルを読み込んでいる）
  const SWATCH_TOKENS = ['--color-bg', '--color-surface', '--color-accent', '--color-action', '--color-text'];
  const THEME_KEY = 'studio-yebisu.agency-agents-example.theme';
  const THEMES = ['system', 'light', 'dark'];
  const MOVE_MS = 420;
  const ANNOUNCE_DELAY = 60;
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const HEX64_RE = /^[0-9a-f]{64}$/;
  const PATH_RE = /^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- 画面の要素 ---------- */

  const $ = (id) => document.getElementById(id);
  const ui = {
    root: document.documentElement,
    themeButtons: Array.from(document.querySelectorAll('[data-theme-choice]')),
    themeNote: $('theme-note'),
    themeMeta: document.querySelector('meta[name="theme-color"]'),
    concept: $('concept'),
    deepLink: $('deep-link'),
    roleButtons: Array.from(document.querySelectorAll('[data-role-choice]')),
    stageButtons: Array.from(document.querySelectorAll('[data-stage-choice]')),
    loadStatus: $('load-status'),
    loadError: $('load-error'),
    loadErrorReason: $('load-error-reason'),
    retry: $('load-retry'),
    figure: $('figure'),
    wires: $('wires'),
    figureDesc: $('figure-desc'),
    readout: $('readout'),
    readoutStage: $('readout-stage'),
    partLabel: $('part-label'),
    partMeaning: $('part-meaning'),
    partApplied: $('part-applied'),
    sourceQuote: $('source-quote'),
    sourceSection: $('source-section'),
    sourceLink: $('source-link'),
    sourceNote: $('source-note'),
    live: $('live'),
    dataLinks: Array.from(document.querySelectorAll('a[data-href]')),
    copyButton: $('copy-request'),
    copyStatus: $('copy-status'),
    copyFallback: $('copy-fallback'),
    copyFallbackText: $('copy-fallback-text'),
  };

  /* ---------- 状態（1か所） ---------- */

  const DEFAULTS = Object.freeze({ role: 'ux', stage: 'contents', part: 'identity' });
  const state = { status: 'loading', model: null, ...DEFAULTS };
  let view = null; // 図の要素（読み込みごとに作り直す）
  let loadToken = 0;
  let loadController = null;
  let wireTimer = 0;
  let pendingFresh = false;
  let movingUntil = 0;

  /* ---------- 小さな道具 ---------- */

  class LoadError extends Error {}

  function check(condition, where, reason) {
    if (!condition) throw new LoadError(`${where}：${reason}。`);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const isObj = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isText = (value) => typeof value === 'string' && value.trim() !== '';
  const isPathList = (value) => Array.isArray(value) && value.length > 0 && value.every((p) => typeof p === 'string' && PATH_RE.test(p) && !p.split('/').includes('..'));
  const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const shortPath = (path) => path.replace(/^vendor\/agency-agents\//, '');
  const yen = (value) => `${value.toLocaleString('ja-JP')}円`;
  const reduceMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wideQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 48rem)') : null;

  function setLive(node, message) {
    node.textContent = '';
    window.setTimeout(() => {
      node.textContent = message;
    }, ANNOUNCE_DELAY);
  }

  /* ---------- 取得と照合 ---------- */

  async function fetchBytes(path, signal) {
    let response;
    try {
      response = await fetch(path, { cache: 'no-store', signal });
    } catch (error) {
      if (error && error.name === 'AbortError') throw error;
      throw new LoadError(`${path}：通信に失敗しました。`);
    }
    if (!response.ok) throw new LoadError(`${path}：サーバーが ${response.status} を返しました。`);
    try {
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (error && error.name === 'AbortError') throw error;
      throw new LoadError(`${path}：通信が途中で切れました。`);
    }
  }

  async function sha256Hex(bytes) {
    const subtle = window.crypto && window.crypto.subtle;
    check(subtle && typeof subtle.digest === 'function', 'SHA-256', 'この環境では計算できません（HTTPS か localhost で開いてください）');
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // BOM も含めて原文のまま読む（依頼文はこの文字列をそのままコピーする）
  const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

  function decode(bytes, path) {
    try {
      return utf8.decode(bytes);
    } catch {
      throw new LoadError(`${path}：UTF-8 の文字として読めませんでした。`);
    }
  }

  function parse(text, path) {
    try {
      return JSON.parse(text);
    } catch {
      throw new LoadError(`${path}：JSONとして読めませんでした。`);
    }
  }

  function validateManifest(data) {
    check(isObj(data) && data.format === MANIFEST_FORMAT && data.case_id === CASE_ID && data.commit === COMMIT, MANIFEST_PATH, '形式・作例ID・固定コミットが違います');
    check(Array.isArray(data.files) && data.files.length === FILE_ORDER.length, `${MANIFEST_PATH} の files`, `${FILE_ORDER.length}件の配列が必要です`);
    data.files.forEach((entry, index) => {
      check(
        isObj(entry) && entry.path === FILE_ORDER[index] && Number.isInteger(entry.bytes) && entry.bytes > 0 && typeof entry.sha256 === 'string' && HEX64_RE.test(entry.sha256),
        `${MANIFEST_PATH} の files[${index}]`,
        `${FILE_ORDER[index]} のパス・バイト数・SHA-256 が必要です`,
      );
    });
    return data;
  }

  // 11ファイルの中身を突き合わせ、図に使う形にまとめる
  function buildModel(text, manifest) {
    const json = (key) => parse(text[FILES[key]], FILES[key]);
    const structure = json('structure');
    const event = json('event');
    const handoff = json('handoff');
    const itinerary = json('itinerary');

    // 入力: 架空の6企画
    check(isObj(event) && event.fictional === true && isText(event.id) && isText(event.title) && Array.isArray(event.sessions), FILES.event, '架空のイベントと企画の配列が必要です');
    check(sameJSON(event.sessions.map((s) => (isObj(s) ? s.id : null)).sort(), SESSION_IDS), `${FILES.event} の sessions`, `${SESSION_IDS.join('・')} の6件が必要です`);
    event.sessions.forEach((s) => {
      check(TIME_RE.test(s.start) && TIME_RE.test(s.end) && s.start < s.end && Number.isInteger(s.price_yen) && s.price_yen >= 0, `${FILES.event} の ${s.id}`, '時刻と費用の形が正しくありません');
    });

    // 説明用の構造（6つの部分・2つの役割）
    const where = FILES.structure;
    check(
      isObj(structure) && structure.format === STRUCTURE_FORMAT && structure.case_id === CASE_ID && structure.repository === REPOSITORY && structure.commit === COMMIT,
      where,
      '形式・作例ID・原典・固定コミットが違います',
    );
    check(isText(structure.definition) && isText(structure.usage) && isText(structure.editorial_note), where, '定義・使い方・編集上の注記が必要です');
    check(Array.isArray(structure.parts) && sameJSON(structure.parts.map((p) => (isObj(p) ? p.id : null)), PART_IDS), `${where} の parts`, `${PART_IDS.join('・')} の順の6項目が必要です`);
    structure.parts.forEach((part) => check(isText(part.label) && isText(part.section) && isText(part.meaning), `${where} の parts.${part.id}`, '見出し・節・意味が必要です'));
    check(Array.isArray(structure.roles) && sameJSON(structure.roles.map((r) => (isObj(r) ? r.id : null)), ROLE_IDS), `${where} の roles`, 'ux・frontend の2件が必要です');
    const roles = {};
    structure.roles.forEach((role) => {
      const at = `${where} の roles.${role.id}`;
      const raw = text[FILES[role.id]];
      check(role.file === FILES[role.id], at, `file に ${FILES[role.id]} が必要です`);
      check(isText(role.name) && isText(role.short) && isText(role.output_short), at, '名前・短い名前・成果の説明が必要です');
      check(raw.split(/\r?\n/).includes(`name: ${role.name}`), at, '役割ファイルの name と一致しません');
      structure.parts.forEach((part) => {
        const entry = isObj(role.parts) ? role.parts[part.id] : null;
        check(isObj(entry) && isText(entry.source) && isText(entry.applied), `${at}.parts.${part.id}`, '原文の抜粋と今回の適用が必要です');
        check(raw.includes(entry.source), `${at}.parts.${part.id}.source`, '原文の抜粋が役割ファイルにありません');
        check(raw.includes(part.section), at, `節「${part.section}」が役割ファイルにありません`);
      });
      check(isPathList(role.input_files) && role.input_files.every((p) => FILE_ORDER.includes(p) && INPUT_LABELS[p]), `${at}.input_files`, '確かめたファイルのパスが必要です');
      check(isPathList(role.output_files), `${at}.output_files`, 'パスの配列が必要です');
      roles[role.id] = role;
    });
    check(roles.frontend.output_files.includes('guide.html') && roles.frontend.output_files.includes(FILES.implementation), `${where} の roles.frontend.output_files`, 'guide.html と実装記録が必要です');

    // 1回目の成果: 引き継ぎ書（順に当てた記録・固定コミット）
    check(
      isObj(handoff) && isObj(handoff.meta) && handoff.meta.fictional === true && handoff.meta.event_id === event.id && handoff.meta.source_commit === COMMIT && handoff.meta.mode === 'sequential-role-application' && handoff.meta.stage === 'ux-handoff',
      `${FILES.handoff} の meta`,
      '架空・同じイベント・固定コミット・順に当てた記録が必要です',
    );
    check(
      Array.isArray(handoff.roles) && handoff.roles.length === 2 && isObj(handoff.roles[0]) && isObj(handoff.roles[1]) && handoff.roles[0].source_path === FILES.ux && handoff.roles[1].source_path === FILES.frontend,
      `${FILES.handoff} の roles`,
      '2つの役割ファイルのパスが必要です',
    );
    check(sameJSON(handoff.roles[0].deliverables, roles.ux.output_files), `${FILES.handoff} の roles[0].deliverables`, '1回目の成果物の一覧が図と一致しません');
    check(Array.isArray(handoff.acceptance) && handoff.acceptance.some((a) => isObj(a) && a.id === 'A09'), `${FILES.handoff} の acceptance`, 'A09 の記録が必要です');

    // 2回目の成果で保存した予定（4企画・1,000円）
    const picked = RECORDED.ids.map((id) => event.sessions.find((s) => s.id === id));
    const total = picked.reduce((sum, s) => sum + s.price_yen, 0);
    check(isObj(itinerary) && itinerary.format === 'komorebi-itinerary/v1' && itinerary.fictional === true && itinerary.reserved === false, FILES.itinerary, '架空・予約ではない予定メモが必要です');
    check(isObj(itinerary.event) && itinerary.event.id === event.id && isObj(itinerary.source) && itinerary.source.role_source_commit === COMMIT, FILES.itinerary, '同じイベントと固定コミットが必要です');
    check(sameJSON(itinerary.selected_ids, RECORDED.ids), `${FILES.itinerary} の selected_ids`, `${RECORDED.ids.join('・')} が必要です`);
    check(Array.isArray(itinerary.sessions) && itinerary.sessions.length === picked.length && itinerary.sessions.every((s, i) => sameJSON(s, picked[i])), `${FILES.itinerary} の sessions`, '入力の企画と同じ値が必要です');
    check(total === RECORDED.total && sameJSON(itinerary.derived, { count: picked.length, total_price_yen: total }), `${FILES.itinerary} の derived`, `${picked.length}件・${yen(RECORDED.total)}が必要です`);
    const ex = structure.example;
    check(
      isObj(ex) && ex.event_file === FILES.event && ex.fictional === true && ex.session_count === event.sessions.length && ex.recorded_export === FILES.itinerary && sameJSON(ex.selected_ids, itinerary.selected_ids) && ex.total_price_yen === total,
      `${where} の example`,
      '入力と保存記録に一致しません',
    );

    // 文章のファイル
    check(text[FILES.readme].includes('### Option 3: Use as Reference'), FILES.readme, 'Option 3 の節が必要です');
    check(text[FILES.license].includes('MIT License') && text[FILES.license].includes('Copyright (c) 2025 AgentLand Contributors'), FILES.license, 'MIT と著作権表示が必要です');
    check(text[FILES.request].includes(COMMIT) && text[FILES.request].includes('UX Architect') && text[FILES.request].includes('Frontend Developer'), FILES.request, '2つの役割と固定コミットが必要です');
    check(text[FILES.implementation].includes('A09'), FILES.implementation, 'A09 を採用しなかった記録が必要です');
    check(text[FILES.foundation].includes('--color-action'), FILES.foundation, '色のトークンが必要です');

    return {
      structure,
      parts: structure.parts,
      roles,
      event,
      sessions: [...event.sessions].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)),
      picked: new Set(itinerary.selected_ids),
      count: itinerary.derived.count,
      total,
      request: text[FILES.request],
      requestBytes: manifest.files[FILE_ORDER.indexOf(FILES.request)].bytes,
    };
  }

  /* ---------- テーマ ---------- */

  const darkQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let theme = 'system';
  let themeSaveFailed = false;

  function readStoredTheme() {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      return THEMES.includes(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  function applyTheme(choice, persist) {
    theme = THEMES.includes(choice) ? choice : 'system';
    ui.root.setAttribute('data-theme', theme);
    if (persist) {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
        themeSaveFailed = false;
      } catch {
        themeSaveFailed = true;
      }
    }
    ui.themeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
    const dark = darkQuery && darkQuery.matches;
    let note = theme === 'system' ? `端末の設定に合わせています（いまは${dark ? 'ダーク' : 'ライト'}）。` : `${theme === 'dark' ? 'ダーク' : 'ライト'}で表示しています。`;
    if (themeSaveFailed) note += '表示テーマを保存できませんでした。この画面を開いている間だけ反映します。';
    ui.themeNote.textContent = note;
    const meta = window.getComputedStyle(ui.root).getPropertyValue('--theme-color-meta').trim();
    if (ui.themeMeta && meta) ui.themeMeta.setAttribute('content', meta);
  }

  function initTheme() {
    applyTheme(readStoredTheme(), false);
    ui.themeButtons.forEach((button) => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice, true)));
    if (darkQuery) {
      const onChange = () => {
        if (theme === 'system') applyTheme('system', false);
      };
      if (typeof darkQuery.addEventListener === 'function') darkQuery.addEventListener('change', onChange);
      else if (typeof darkQuery.addListener === 'function') darkQuery.addListener(onChange);
    }
  }

  /* ---------- 図の部品 ---------- */

  function buildDoc(model, role) {
    const node = el('section', 'd-node d-doc');
    node.id = `doc-${role.id}`;
    node.setAttribute('aria-label', `役割の指示書：${role.short}（${role.name}）`);
    const head = el('div', 'd-doc__head');
    const name = el('span', 'd-doc__name', role.name);
    name.lang = 'en';
    head.append(el('span', 'd-kicker', '役割の指示書'), el('span', 'd-doc__short', role.short), name, el('span', 'd-doc__path', shortPath(role.file)));
    const parts = el('div', 'd-doc__parts');
    const buttons = new Map();
    model.parts.forEach((part) => {
      const button = el('button', 'd-part');
      button.type = 'button';
      button.dataset.part = part.id;
      button.setAttribute('aria-pressed', 'false');
      button.append(el('span', 'd-part__label', part.label), el('span', 'd-part__applied', role.parts[part.id].applied));
      button.addEventListener('click', () => selectPart(part.id));
      parts.append(button);
      buttons.set(part.id, button);
    });
    node.append(head, parts);
    return { el: node, parts, buttons };
  }

  function buildTask() {
    const node = el('div', 'd-node d-task');
    node.id = 'task';
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', '今回の依頼と材料');
    const list = el('ul', 'u-list-reset d-task__list');
    list.setAttribute('role', 'list');
    node.append(el('span', 'd-kicker', '今回の依頼と材料'), list);
    return { el: node, list };
  }

  function buildAi() {
    const node = el('div', 'd-node d-ai');
    node.id = 'ai';
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', 'AI（Markdownを読めるAI。今回は同じ Claude Opus 5.5）');
    const lens = el('span', 'd-ai__lens');
    lens.setAttribute('aria-hidden', 'true');
    node.append(
      lens,
      el('span', 'd-ai__name', 'AI'),
      el('span', 'd-ai__sub', '指示書と依頼を読む'),
      el('span', 'd-ai__same', '同じAI'),
      el('span', 'd-ai__run d-ai__run--1', '1回目'),
      el('span', 'd-ai__run d-ai__run--2', '2回目'),
    );
    return { el: node };
  }

  function buildOutUx(role) {
    const node = el('div', 'd-node d-out d-out--ux');
    node.id = 'out-ux';
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', `1回目の成果物：${role.output_short}`);
    const sheet = el('div', 'd-sheet');
    const swatches = el('div', 'd-swatches');
    [sheet, swatches].forEach((n) => n.setAttribute('aria-hidden', 'true'));
    for (let i = 0; i < 4; i += 1) sheet.append(el('span'));
    SWATCH_TOKENS.forEach((token) => {
      const chip = el('span');
      chip.style.backgroundColor = `var(${token})`;
      swatches.append(chip);
    });
    node.append(
      el('span', 'd-kicker', '成果物'),
      el('span', 'd-out__title', role.output_short),
      sheet,
      swatches,
      el('span', 'd-out__files', 'ux-handoff.json・.md／foundation.css'),
      el('span', 'd-out__check', '確認観点は目標。達成は測っていません'),
    );
    return { el: node };
  }

  function buildOutFrontend(model, role) {
    const node = el('div', 'd-node d-out d-out--frontend');
    node.id = 'out-frontend';
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', `2回目の成果物：${role.output_short}`);
    const browser = el('div', 'd-browser');
    const bar = el('div', 'd-browser__bar');
    bar.setAttribute('aria-hidden', 'true');
    bar.append(el('span'), el('span'), el('span'));
    const chips = el('div', 'd-browser__chips');
    chips.setAttribute('aria-hidden', 'true');
    model.sessions.forEach((session) => chips.append(el('span', `d-chip${model.picked.has(session.id) ? ' is-picked' : ''}`, session.id)));
    const ids = model.sessions.filter((s) => model.picked.has(s.id)).map((s) => s.id).join('・');
    browser.append(
      bar,
      el('span', 'd-browser__title', `${model.event.title}（架空）`),
      chips,
      el('span', 'u-visually-hidden', `6企画のうち ${ids} を選んだ保存記録。`),
      el('span', 'd-browser__sum', `保存した予定 ${model.count}企画・${yen(model.total)}`),
    );
    node.append(
      el('span', 'd-kicker', '成果物'),
      el('span', 'd-out__title', role.output_short),
      browser,
      el('span', 'd-out__files', 'guide.html ほか'),
      el('span', 'd-out__check', '確認観点は目標。達成は測っていません'),
    );
    return { el: node };
  }

  function buildFigure(model) {
    const docs = { ux: buildDoc(model, model.roles.ux), frontend: buildDoc(model, model.roles.frontend) };
    const outs = { ux: buildOutUx(model.roles.ux), frontend: buildOutFrontend(model, model.roles.frontend) };
    const task = buildTask();
    const ai = buildAi();
    const edgeLabel = el('span', 'd-edge-label', '次の入力');
    edgeLabel.setAttribute('aria-hidden', 'true');
    edgeLabel.hidden = true;
    ui.figure.append(docs.ux.el, docs.frontend.el, task.el, ai.el, outs.ux.el, outs.frontend.el, edgeLabel);
    view = {
      docs,
      outs,
      task,
      ai,
      edgeLabel,
      byId: { 'doc-ux': docs.ux.el, 'doc-frontend': docs.frontend.el, task: task.el, ai: ai.el, 'out-ux': outs.ux.el, 'out-frontend': outs.frontend.el },
      nodes: [docs.ux.el, docs.frontend.el, task.el, ai.el, outs.ux.el, outs.frontend.el],
    };
  }

  /* ---------- 描画（状態から決める） ---------- */

  function renderTask() {
    const { model } = state;
    const role = model.roles[state.role];
    const shared = model.roles.ux.input_files;
    const files = [...role.input_files].sort((a, b) => INPUT_LABELS[a].order - INPUT_LABELS[b].order);
    const items = files.map((path) => {
      const prev = !shared.includes(path);
      const item = el('li', `d-file${prev ? ' d-file--prev' : ''}`);
      if (prev) item.append(el('span', 'd-file__from', '1回目の成果'));
      item.append(el('span', 'd-file__name', INPUT_LABELS[path].name), el('span', 'd-file__path', path));
      if (path === FILES.event) {
        const ticks = el('span', 'd-ticks');
        ticks.setAttribute('aria-hidden', 'true');
        model.sessions.forEach(() => ticks.append(el('span')));
        item.append(ticks);
      }
      return item;
    });
    view.task.list.replaceChildren(...items);
  }

  function describe() {
    const { model, role, stage } = state;
    const r = model.roles[role];
    const ux = model.roles.ux;
    const fe = model.roles.frontend;
    const inputs = (x) => x.input_files.map((p) => INPUT_LABELS[p].name).join('・');
    if (stage === 'contents') {
      return `${r.short}（${r.name}）の指示書。中身は ${model.parts.map((p) => p.label).join('・')} の6つ。下に今回の依頼と材料、AI、成果物「${r.output_short}」がつながっています。`;
    }
    if (stage === 'hand') return `${r.short}の指示書と、今回の依頼と材料（${inputs(r)}）が一緒にAIへ入り、AIが成果物「${r.output_short}」を作ります。`;
    return `同じAIに2回渡した流れ。1回目は${ux.short}の指示書と、依頼・架空の6企画から「${ux.output_short}」。その成果物が次の入力になり、2回目は${fe.short}の指示書と同じ依頼・6企画と一緒に「${fe.output_short}」になりました。`;
  }

  function render() {
    const { model, role, stage, part } = state;
    const link = stage === 'link';
    ui.figure.dataset.stage = stage;
    ui.figure.dataset.role = role;
    ui.figure.dataset.focus = part;
    ROLE_IDS.forEach((id) => {
      const current = id === role;
      const doc = view.docs[id];
      const out = view.outs[id];
      doc.el.hidden = !link && !current;
      out.el.hidden = !link && !current;
      doc.el.classList.toggle('is-current', current);
      out.el.classList.toggle('is-current', current);
      // 「つなぐ」では部分を細い線にまとめ、操作から外す（選んだ部分は色で残す）
      doc.parts.toggleAttribute('inert', link || !current);
      doc.buttons.forEach((button, pid) => button.setAttribute('aria-pressed', String(current && pid === part)));
    });
    renderTask();
    view.edgeLabel.hidden = !link;

    ui.roleButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.roleChoice === role)));
    ui.stageButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stageChoice === stage)));

    const r = model.roles[role];
    const def = model.parts.find((p) => p.id === part);
    const entry = r.parts[part];
    ui.readoutStage.textContent = STAGE_TEXT[stage].line;
    ui.partLabel.textContent = `${r.short}の「${def.label}」`;
    ui.partMeaning.textContent = def.meaning;
    ui.partApplied.textContent = entry.applied;
    ui.sourceQuote.textContent = entry.source;
    ui.sourceSection.textContent = def.section;
    ui.sourceLink.textContent = r.file;
    ui.sourceLink.href = r.file;
    ui.sourceNote.textContent = model.structure.editorial_note;
    ui.figureDesc.textContent = describe();
  }

  /* ---------- 線（ノードの実際の位置から引く。線はラベルの後ろ） ---------- */

  function edgesFor() {
    const doc = `doc-${state.role}`;
    const out = `out-${state.role}`;
    if (state.stage === 'link') {
      return [
        { a: 'doc-ux', as: 'right', b: 'ai', bs: 'left', bf: 'align', run: 'ux' },
        { a: 'task', as: 'right', af: 0.35, b: 'ai', bs: 'left', bf: 0.42, run: 'ux' },
        { a: 'task', as: 'right', af: 0.65, b: 'ai', bs: 'left', bf: 0.58, run: 'frontend' },
        { a: 'doc-frontend', as: 'right', b: 'ai', bs: 'left', bf: 'align', run: 'frontend' },
        { a: 'ai', as: 'right', af: 'align', b: 'out-ux', bs: 'left', run: 'ux' },
        { a: 'out-ux', as: 'bottom', b: 'ai', bs: 'right', bf: 0.64, run: 'frontend', handoff: true },
        { a: 'ai', as: 'right', af: 'align', b: 'out-frontend', bs: 'left', run: 'frontend' },
      ];
    }
    if (wideQuery && wideQuery.matches) {
      return [
        { a: doc, as: 'right', b: 'ai', bs: 'left', bf: 0.38 },
        { a: 'task', as: 'right', b: 'ai', bs: 'left', bf: 0.62 },
        { a: 'ai', as: 'right', b: out, bs: 'left' },
      ];
    }
    if (state.stage === 'contents') {
      return [
        { a: doc, as: 'bottom', b: 'ai', bs: 'top' },
        { a: 'task', as: 'right', b: 'ai', bs: 'left' },
        { a: 'ai', as: 'right', b: out, bs: 'left' },
      ];
    }
    return [
      { a: doc, as: 'bottom', b: 'ai', bs: 'top', bf: 0.3 },
      { a: 'task', as: 'bottom', b: 'ai', bs: 'top', bf: 0.7 },
      { a: 'ai', as: 'right', b: out, bs: 'left' },
    ];
  }

  const NORMALS = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

  // 辺の上の点。f は辺に沿った割合、'align' は相手の中心にそろえる（角は避ける）
  function sidePoint(r, side, f, other) {
    const vertical = side === 'left' || side === 'right';
    const inset = 14;
    let along;
    if (f === 'align') {
      along = vertical
        ? Math.min(Math.max(other.y + other.h / 2, r.y + inset), r.y + r.h - inset)
        : Math.min(Math.max(other.x + other.w / 2, r.x + inset), r.x + r.w - inset);
    } else {
      const k = typeof f === 'number' ? f : 0.5;
      along = vertical ? r.y + r.h * k : r.x + r.w * k;
    }
    if (side === 'left') return { x: r.x, y: along };
    if (side === 'right') return { x: r.x + r.w, y: along };
    if (side === 'top') return { x: along, y: r.y };
    return { x: along, y: r.y + r.h };
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function markers() {
    const defs = svgEl('defs', {});
    [['arrow', 'd-arrow'], ['arrow-accent', 'd-arrow d-arrow--accent']].forEach(([id, cls]) => {
      const marker = svgEl('marker', { id: `wire-${id}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
      marker.append(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: cls }));
      defs.append(marker);
    });
    return defs;
  }

  function drawWires(fresh) {
    if (!view || ui.figure.hidden) return;
    const box = ui.figure.getBoundingClientRect();
    const width = ui.figure.clientWidth;
    const height = ui.figure.clientHeight;
    const rectOf = (node) => {
      const r = node.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
    };
    ui.wires.setAttribute('viewBox', `0 0 ${width} ${height}`);
    ui.wires.setAttribute('width', String(width));
    ui.wires.setAttribute('height', String(height));
    const animate = fresh && !reduceMotion();
    const paths = [];
    edgesFor().forEach((edge) => {
      const ra = rectOf(view.byId[edge.a]);
      const rb = rectOf(view.byId[edge.b]);
      const p0 = sidePoint(ra, edge.as, edge.af, rb);
      const p3 = sidePoint(rb, edge.bs, edge.bf, ra);
      const [nax, nay] = NORMALS[edge.as];
      const [nbx, nby] = NORMALS[edge.bs];
      const c = Math.max(18, Math.hypot(p3.x - p0.x, p3.y - p0.y) * 0.42);
      const p1 = { x: p0.x + nax * c, y: p0.y + nay * c };
      const p2 = { x: p3.x + nbx * c, y: p3.y + nby * c };
      const hot = !edge.run || edge.run === state.role;
      const path = svgEl('path', {
        d: `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
        class: `d-wire${hot ? ' is-hot' : ''}${edge.handoff ? ' d-wire--handoff' : ''}`,
        'marker-end': `url(#wire-${edge.handoff ? 'arrow-accent' : 'arrow'})`,
      });
      if (animate) {
        if (edge.handoff) path.classList.add('is-fading');
        else {
          path.setAttribute('pathLength', '1');
          path.classList.add('is-drawing');
        }
      }
      paths.push(path);
      if (edge.handoff) {
        // ベジェの中点に「次の入力」
        view.edgeLabel.style.left = `${(p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8}px`;
        view.edgeLabel.style.top = `${(p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8}px`;
      }
    });
    ui.wires.replaceChildren(markers(), ...paths);
    if (animate) {
      ui.wires.getBoundingClientRect(); // 初期状態を確定してから線を伸ばす
      paths.forEach((path) => path.classList.remove('is-drawing', 'is-fading'));
    }
  }

  // 大きさの変化で予約し直しても、段階の切替で予約した線の伸びは残す
  function scheduleWires(fresh) {
    window.clearTimeout(wireTimer);
    pendingFresh = pendingFresh || fresh;
    const wait = Math.max(0, movingUntil - performance.now());
    wireTimer = window.setTimeout(() => {
      ui.figure.classList.remove('is-moving');
      drawWires(pendingFresh);
      pendingFresh = false;
    }, wait);
  }

  // 同じ部品が新しい位置へ動く（FLIP）。動きを減らす設定では位置だけ変える
  function update(mutate, message) {
    const before = new Map(view.nodes.map((node) => [node, node.hidden ? null : node.getBoundingClientRect()]));
    mutate();
    render();
    const motion = !reduceMotion() && typeof Element.prototype.animate === 'function';
    if (motion) {
      ui.figure.classList.add('is-moving');
      movingUntil = performance.now() + MOVE_MS;
      view.nodes.forEach((node) => {
        if (node.hidden) return;
        const a = before.get(node);
        if (!a) {
          node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
          return;
        }
        const b = node.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: MOVE_MS, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
        }
      });
    }
    scheduleWires(true);
    if (message) setLive(ui.live, message);
  }

  function selectRole(id) {
    if (state.status !== 'ready' || !ROLE_IDS.includes(id) || id === state.role) return;
    const r = state.model.roles[id];
    update(() => {
      state.role = id;
    }, `${r.short}（${r.name}）の指示書に切り替えました。成果物は「${r.output_short}」。`);
  }

  function selectStage(id) {
    if (state.status !== 'ready' || !STAGES.includes(id) || id === state.stage) return;
    update(() => {
      state.stage = id;
    }, STAGE_TEXT[id].line);
  }

  function selectPart(id) {
    if (state.status !== 'ready' || !PART_IDS.includes(id)) return;
    state.part = id;
    render();
    const def = state.model.parts.find((p) => p.id === id);
    setLive(ui.live, `${def.label}：${def.meaning}。今回は「${state.model.roles[state.role].parts[id].applied}」。`);
  }

  /* ---------- 読み込み（失敗したら止めて、古い内容を残さない） ---------- */

  function setControls(enabled) {
    [...ui.roleButtons, ...ui.stageButtons, ui.copyButton].forEach((button) => {
      button.disabled = !enabled;
    });
    ui.dataLinks.forEach((link) => {
      if (enabled) {
        link.href = link.dataset.href;
        link.removeAttribute('aria-disabled');
        if ('download' in link.dataset) link.setAttribute('download', '');
      } else {
        link.removeAttribute('href');
        link.removeAttribute('download');
        link.setAttribute('aria-disabled', 'true');
      }
    });
  }

  function teardown() {
    window.clearTimeout(wireTimer);
    pendingFresh = false;
    Object.assign(state, { model: null }, DEFAULTS);
    view = null;
    setControls(false);
    ui.figure.hidden = true;
    ui.figure.classList.remove('is-moving');
    ui.figure.replaceChildren(ui.wires);
    ui.wires.replaceChildren();
    ui.figureDesc.textContent = '';
    ui.readout.hidden = true;
    [ui.readoutStage, ui.partLabel, ui.partMeaning, ui.partApplied, ui.sourceQuote, ui.sourceSection, ui.sourceLink, ui.sourceNote, ui.live, ui.copyStatus].forEach((node) => {
      node.textContent = '';
    });
    ui.sourceLink.removeAttribute('href');
    ui.copyFallback.hidden = true;
    ui.copyFallbackText.value = '';
    ui.roleButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.roleChoice === DEFAULTS.role)));
    ui.stageButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stageChoice === DEFAULTS.stage)));
  }

  function setRetryBusy(busy) {
    if (busy) {
      ui.retry.setAttribute('aria-disabled', 'true');
      ui.retry.textContent = '読み込み中…';
    } else {
      ui.retry.removeAttribute('aria-disabled');
      ui.retry.textContent = 'もう一度読み込む';
    }
  }

  function enterLoading() {
    state.status = 'loading';
    teardown();
    if (ui.loadError.hidden) {
      ui.loadStatus.hidden = false;
      ui.loadStatus.textContent = `固定した${FILE_ORDER.length}のファイルを読み込み、バイト数と SHA-256 を確かめています…`;
    }
    setRetryBusy(true);
  }

  function onError(error, fromRetry) {
    state.status = 'error';
    teardown();
    ui.loadStatus.textContent = '';
    ui.loadStatus.hidden = true;
    ui.loadError.hidden = false;
    setLive(ui.loadErrorReason, error instanceof LoadError ? error.message : '想定していない形式のデータでした。');
    setRetryBusy(false);
    if (fromRetry) ui.retry.focus();
  }

  function onReady(model, fromRetry) {
    state.status = 'ready';
    state.model = model;
    buildFigure(model);
    ui.loadStatus.textContent = '';
    ui.loadStatus.hidden = true;
    ui.loadError.hidden = true;
    setRetryBusy(false);
    ui.figure.hidden = false;
    ui.readout.hidden = false;
    setControls(true);
    render();
    scheduleWires(true);
    if (fromRetry) ui.concept.focus({ preventScroll: true });
  }

  async function load(fromRetry) {
    if (fromRetry && ui.retry.getAttribute('aria-disabled') === 'true') return;
    loadToken += 1;
    const token = loadToken;
    if (loadController) loadController.abort();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    loadController = controller;
    const signal = controller ? controller.signal : undefined;
    enterLoading();
    try {
      const manifestBytes = await fetchBytes(MANIFEST_PATH, signal);
      check((await sha256Hex(manifestBytes)) === MANIFEST_SHA256, MANIFEST_PATH, 'SHA-256 が固定値と一致しません。内容が変わっています');
      const manifest = validateManifest(parse(decode(manifestBytes, MANIFEST_PATH), MANIFEST_PATH));
      const text = {};
      await Promise.all(
        manifest.files.map(async (entry) => {
          const bytes = await fetchBytes(entry.path, signal);
          check(bytes.byteLength === entry.bytes, entry.path, `バイト数が記録の ${entry.bytes} と違います（${bytes.byteLength}）`);
          check((await sha256Hex(bytes)) === entry.sha256, entry.path, 'SHA-256 が記録と一致しません。内容が変わっています');
          text[entry.path] = decode(bytes, entry.path);
        }),
      );
      if (token !== loadToken) return;
      onReady(buildModel(text, manifest), fromRetry);
    } catch (error) {
      if (token !== loadToken || (error && error.name === 'AbortError')) return;
      onError(error, fromRetry);
    } finally {
      if (token === loadToken) loadController = null;
    }
  }

  /* ---------- 依頼文のコピー ---------- */

  async function copyRequest() {
    const model = state.model;
    if (!model) return;
    ui.copyFallback.hidden = true;
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('unavailable');
      await navigator.clipboard.writeText(model.request);
      setLive(ui.copyStatus, `依頼文をコピーしました（原文 ${model.requestBytes.toLocaleString('ja-JP')} バイトのまま）。`);
    } catch {
      if (state.model !== model) return;
      ui.copyFallbackText.value = model.request;
      ui.copyFallback.hidden = false;
      ui.copyFallbackText.focus();
      ui.copyFallbackText.select();
      setLive(ui.copyStatus, 'コピーできませんでした。下の欄に全文を選択してあります。手動でコピーしてください。');
    }
  }

  /* ---------- 以前の #S01〜#S06 へのリンク ---------- */

  function showDeepLink(moveFocus) {
    const match = /^#(S0[1-6])$/.exec(window.location.hash);
    if (!match) {
      ui.deepLink.hidden = true;
      ui.deepLink.replaceChildren();
      return;
    }
    const link = el('a', 'p-deeplink__link', `作例ガイドで${match[1]}を開く`);
    link.href = `guide.html#${match[1]}`;
    ui.deepLink.replaceChildren(el('span', null, `以前のリンク（#${match[1]}）の企画は、作例ガイドで開けます。`), link);
    ui.deepLink.hidden = false;
    if (moveFocus) link.focus({ preventScroll: true });
  }

  /* ---------- 起動 ---------- */

  function init() {
    initTheme();
    ui.roleButtons.forEach((b) => b.addEventListener('click', () => selectRole(b.dataset.roleChoice)));
    ui.stageButtons.forEach((b) => b.addEventListener('click', () => selectStage(b.dataset.stageChoice)));
    ui.retry.addEventListener('click', () => load(true));
    ui.copyButton.addEventListener('click', copyRequest);
    window.addEventListener('hashchange', () => showDeepLink(true));
    if (typeof window.ResizeObserver === 'function') new window.ResizeObserver(() => scheduleWires(false)).observe(ui.figure);
    else window.addEventListener('resize', () => scheduleWires(false));
    if (wideQuery) {
      const onWide = () => scheduleWires(false);
      if (typeof wideQuery.addEventListener === 'function') wideQuery.addEventListener('change', onWide);
      else if (typeof wideQuery.addListener === 'function') wideQuery.addListener(onWide);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => scheduleWires(false));
    showDeepLink(true);
    load(false);
  }

  init();
})();
