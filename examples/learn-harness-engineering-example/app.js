// 架空の書店メモを探す練習の記録を読むページ。ページを開いても Node・CLI・AI は動かない。
// 実行の記録4件と入力9件を取得し、形・固定コミット・入力のSHA-256・中身の一致を確かめてから表示する。
// 上の検索はこのブラウザーで索引を探す。下の保存記録は Node CLI の実行結果で、検索欄の状態には左右されない。
'use strict';

(() => {
  const PIN = '38ddcd2bf8d65271f668b94e7c875ca1d629d622';
  const REPO = 'walkinglabs/learn-harness-engineering';
  const URLS = {
    index: 'project/outputs/index.json',
    run: 'outputs/exercise-run.json',
    verification: 'project/outputs/verification.json',
    created: 'outputs/harness-created.json',
  };
  const QUERIES_URL = 'project/input/queries.json';
  const NOTE_IDS = ['N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08'];
  const QUERY_IDS = ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08'];
  const noteUrl = (id) => `project/input/notes/${id}.md`;
  const INPUT_KEYS = [QUERIES_URL, ...NOTE_IDS.map(noteUrl)];
  const CREATED_FILES = ['AGENTS.md', 'feature_list.json', 'progress.md', 'session-handoff.md', 'init.sh'];
  const NOTE_KEYS = ['body', 'id', 'source', 'source_sha256', 'tags', 'title'];
  const DEFAULT_ID = 'Q03';
  const STATUS_TEXT = { 'not-started': '未着手', 'in-progress': '作業中', blocked: '停止中', done: '完了' };
  const SHA = /^[0-9a-f]{64}$/;

  const $ = (id) => document.getElementById(id);
  const loadStatus = $('load-status');
  const loadError = $('load-error');
  const loadErrorText = $('load-error-text');
  const retry = $('retry');
  const form = $('search-form');
  const queryInput = $('query');
  const tagSelect = $('tag');
  const applyBtn = $('apply');
  const resetBtn = $('reset');
  const count = $('count');
  const empty = $('empty');
  const notesList = $('notes');
  const recordList = $('record-list');
  const record = $('record');
  const recordTitle = $('record-title');
  const recordQuery = $('record-query');
  const recordTag = $('record-tag');
  const recordTokens = $('record-tokens');
  const recordCount = $('record-count');
  const recordIds = $('record-result-ids');
  const recordRelation = $('record-relation');
  const recordEmpty = $('record-empty');
  const recordResults = $('record-results');
  const downloadBtn = $('download-record');
  const downloadStatus = $('download-status');
  const techWait = $('tech-wait');
  const techLive = $('tech-live');
  const techCommand = $('tech-command');
  const techCreated = $('tech-created');
  const techSessions = $('tech-sessions');
  const techEvidence = $('tech-evidence');
  const techVerification = $('tech-verification');
  const techControls = $('tech-controls');
  const requestState = $('request-state');
  const requestText = $('request-text');
  const copyBtn = $('copy');
  const copyState = $('copy-state');
  const requestRetry = $('request-retry');
  const toast = $('toast');

  let loaded = null;
  let selectedId = QUERY_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : DEFAULT_ID;
  let lastLive = null;
  let inflight = null;
  let requestInflight = null;
  let toastTimer = 0;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fail = (message) => { throw new Error(message); };
  const sortedKeys = (obj) => Object.keys(obj).sort().join('\n');
  const sameKeys = (obj, keys) => isObj(obj) && sortedKeys(obj) === [...keys].sort().join('\n');

  function same(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
    if (isObj(a)) {
      if (!isObj(b)) return false;
      const ka = Object.keys(a).sort();
      const kb = Object.keys(b).sort();
      return ka.length === kb.length && ka.every((k, i) => k === kb[i] && same(a[k], b[k]));
    }
    return false;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function link(href, text, className = 'chip') {
    const a = el('a', className, text);
    a.href = href;
    return a;
  }

  async function fetchBytes(url) {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store' });
    } catch {
      return fail(`${url} を取得できません（通信できませんでした）`);
    }
    if (!response.ok) fail(`${url} を取得できません（HTTP ${response.status}）`);
    return response.arrayBuffer();
  }

  function decode(buffer, url) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      return fail(`${url} が UTF-8 として読めません`);
    }
  }

  function parseJson(buffer, url) {
    const text = decode(buffer, url);
    try {
      return JSON.parse(text);
    } catch {
      return fail(`${url} がJSONとして読めません`);
    }
  }

  async function sha256(buffer) {
    if (!window.crypto || !window.crypto.subtle) fail('この環境ではSHA-256を計算できないため、入力との一致を確かめられません');
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------- 検索（CLI と同じ規則をこのブラウザーで行う） ----------

  const normalize = (s) => s.normalize('NFKC').toLowerCase();
  const tokensOf = (query) => normalize(query).trim().split(/\s+/u).filter(Boolean);

  function search(notes, query, tag) {
    const tokens = tokensOf(query);
    const tagKey = normalize(tag).trim();
    const results = notes.filter((note) => {
      if (tagKey !== '' && !note.tags.some((t) => normalize(t).trim() === tagKey)) return false;
      const haystack = normalize([note.id, note.title, ...note.tags, note.body].join('\n'));
      return tokens.every((token) => haystack.includes(token));
    });
    return { tokens, results };
  }

  // ---------- 照合 ----------

  function parseNoteText(text, id) {
    const match = /^([^\r\n]*)\r?\n\r?\n([\s\S]*)$/.exec(text);
    if (!match) fail(`${noteUrl(id)} が「1行目のJSON・空行・本文」の形ではありません`);
    let meta;
    try {
      meta = JSON.parse(match[1]);
    } catch {
      fail(`${noteUrl(id)} の1行目がJSONとして読めません`);
    }
    return { meta, body: match[2].trim() };
  }

  function checkQueries(doc) {
    if (!isObj(doc) || doc.format !== 'studio-yebisu-note-queries-v1' || doc.fictional !== true || !Array.isArray(doc.queries)) {
      fail('8問の入力（queries.json）の形が想定と違います');
    }
    if (doc.queries.map((q) => q && q.id).join() !== QUERY_IDS.join()) fail('8問の入力が Q01〜Q08 の順になっていません');
    for (const q of doc.queries) {
      if (typeof q.label !== 'string' || typeof q.query !== 'string' || typeof q.tag !== 'string' ||
          !Array.isArray(q.expected_ids) || !q.expected_ids.every((id) => NOTE_IDS.includes(id))) {
        fail(`${q.id} の入力の形が想定と違います`);
      }
    }
  }

  function checkIndex(index, texts, hashes) {
    if (!sameKeys(index, ['format', 'inputs_sha256', 'notes']) || index.format !== 'studio-yebisu-note-index-v1') fail('索引の形式が想定と違います');
    if (!Array.isArray(index.notes) || index.notes.map((n) => n && n.id).join() !== NOTE_IDS.join()) fail('索引のメモが N01〜N08 の8件ではありません');
    if (!isObj(index.inputs_sha256) || sortedKeys(index.inputs_sha256) !== NOTE_IDS.map((id) => `input/notes/${id}.md`).sort().join('\n')) {
      fail('索引の inputs_sha256 が8件の入力とそろっていません');
    }
    for (const note of index.notes) {
      const where = `索引の ${note.id}`;
      if (!sameKeys(note, NOTE_KEYS)) fail(`${where} の項目が想定と違います`);
      const source = `input/notes/${note.id}.md`;
      if (note.source !== source) fail(`${where} の source が ${source} ではありません`);
      const actual = hashes[noteUrl(note.id)];
      if (note.source_sha256 !== actual || index.inputs_sha256[source] !== actual) fail(`${where} の SHA-256 が、このページで計算した入力の値と一致しません`);
      const { meta, body } = parseNoteText(texts[note.id], note.id);
      if (meta.id !== note.id || meta.title !== note.title || !same(meta.tags, note.tags) || body !== note.body) {
        fail(`${where} の題名・タグ・本文が入力ファイルと一致しません`);
      }
    }
  }

  function checkCreated(created) {
    if (!isObj(created) || created.format !== 'studio-yebisu-harness-created-v1') fail('5ファイルの生成記録の形式が想定と違います');
    if (!isObj(created.source) || created.source.repository !== REPO || created.source.commit !== PIN) fail('生成記録の原典が固定コミットと違います');
    if (created.exit_code !== 0 || typeof created.command !== 'string') fail('生成記録の実行結果が想定と違います');
    if (!isObj(created.created_files_sha256) || sortedKeys(created.created_files_sha256) !== [...CREATED_FILES].sort().join('\n') ||
        !Object.values(created.created_files_sha256).every((v) => SHA.test(v))) {
      fail('生成記録に5ファイルの SHA-256 がそろっていません');
    }
  }

  function featuresOf(session) {
    const list = Array.isArray(session.features) ? session.features
      : isObj(session.features) && Array.isArray(session.features.features) ? session.features.features : null;
    if (!list) fail(`${session.id} セッションの機能の記録がありません`);
    const byId = new Map(list.filter(isObj).map((f) => [f.id, f]));
    const f1 = byId.get('feat-001');
    const f2 = byId.get('feat-002');
    if (!f1 || !f2) fail(`${session.id} セッションの記録に feat-001・feat-002 がありません`);
    return { list, f1, f2 };
  }

  function checkRun(run, ctx) {
    const { hashes, queriesDoc, index, created } = ctx;
    if (!isObj(run) || run.format !== 'studio-yebisu-harness-exercise-v1') fail('実行記録の形式名が想定と違います');
    if (!isObj(run.source) || run.source.repository !== REPO || run.source.commit !== PIN) fail('実行記録の原典が固定コミットと違います');
    if (run.fictional !== true || typeof run.scope !== 'string' || run.scope.trim() === '') fail('実行記録に架空データの印か範囲の説明がありません');
    if (!isObj(run.inputs_sha256) || sortedKeys(run.inputs_sha256) !== [...INPUT_KEYS].sort().join('\n')) fail('実行記録に入力9件のSHA-256がそろっていません');
    for (const key of INPUT_KEYS) {
      if (run.inputs_sha256[key] !== hashes[key]) fail(`${key} が、実行時の入力とSHA-256で一致しません`);
    }

    const h = run.harness;
    if (!isObj(h) || !Array.isArray(h.created_files) || [...h.created_files].sort().join('\n') !== [...CREATED_FILES].sort().join('\n') ||
        h.creation !== URLS.created || h.structural_assessment !== 'outputs/harness-assessment.json') {
      fail('実行記録のハーネス生成の項目が想定と違います');
    }
    if (sortedKeys(created.created_files_sha256) !== [...h.created_files].sort().join('\n')) fail('生成記録と実行記録の5ファイルが一致しません');

    const v = run.verification;
    if (!isObj(v) || v.command !== './init.sh' || v.exit_code !== 0 || v.report !== URLS.verification ||
        v.note_count !== 8 || v.query_count !== 8 || !Number.isInteger(v.negative_control_count) || v.negative_control_count < 1) {
      fail('実行記録の検証（./init.sh・終了コード0・8件・8問）が想定と違います');
    }

    if (!Array.isArray(run.sessions) || run.sessions.length !== 2) fail('実行記録のセッションが2つではありません');
    const [first, second] = run.sessions;
    if (!isObj(first) || first.id !== 'implementation' || first.state !== 'awaiting-verification') fail('実装セッションの記録が想定と違います');
    if (!isObj(second) || second.id !== 'resume' || second.state !== 'verified-handoff') fail('再開セッションの記録が想定と違います');
    const a = featuresOf(first);
    const b = featuresOf(second);
    if (a.f1.status !== 'in-progress' || a.f2.status !== 'not-started') fail('実装セッション後の状態が「feat-001 作業中・feat-002 未着手」ではありません');
    if (b.f1.status !== 'done' || b.f2.status !== 'not-started') fail('再開セッション後の状態が「feat-001 完了・feat-002 未着手」ではありません');

    const byId = new Map(index.notes.map((n) => [n.id, n]));
    if (!Array.isArray(run.queries) || run.queries.map((q) => q && q.id).join() !== QUERY_IDS.join()) fail('実行記録の検索が Q01〜Q08 の8問ではありません');
    run.queries.forEach((q, i) => {
      const want = queriesDoc.queries[i];
      if (q.label !== want.label || !isObj(q.input) || q.input.query !== want.query || q.input.tag !== want.tag) fail(`${q.id} の条件が入力と違います`);
      if (q.status !== 'passed') fail(`${q.id} が照合済み（passed）ではありません`);
      const out = q.output;
      if (!isObj(out) || out.format !== 'studio-yebisu-note-search-v1' || out.query !== want.query || out.tag !== want.tag) fail(`${q.id} の CLI 出力の形が想定と違います`);
      if (!Array.isArray(out.tokens) || !out.tokens.every((t) => typeof t === 'string')) fail(`${q.id} の tokens が想定と違います`);
      if (!same(out.result_ids, want.expected_ids)) fail(`${q.id} の結果のIDが期待と違います`);
      if (!Array.isArray(out.results) || !same(out.results, out.result_ids.map((id) => byId.get(id)))) fail(`${q.id} の結果の全項目が索引のメモと一致しません`);
    });
    return { first: a, second: b };
  }

  function checkVerification(report, run, queriesDoc) {
    if (!isObj(report) || report.format !== 'studio-yebisu-note-verification-v1') fail('検証の出力の形式名が想定と違います');
    if (report.status !== 'passed' || report.note_count !== 8 || report.query_count !== 8 || report.source_integrity !== true) {
      fail('検証の出力が「passed・8件・8問・入力の一致」になっていません');
    }
    if (Array.isArray(report.failures) && report.failures.length > 0) fail('検証の出力に失敗した確認があります');
    if (!Array.isArray(report.queries) || report.queries.map((q) => q && q.id).join() !== QUERY_IDS.join()) fail('検証の出力が Q01〜Q08 の8問ではありません');
    report.queries.forEach((q, i) => {
      const want = queriesDoc.queries[i];
      if (q.query !== want.query || q.tag !== want.tag || !same(q.expected_ids, want.expected_ids) ||
          !same(q.actual_ids, want.expected_ids) || !same(q.actual_ids, run.queries[i].output.result_ids) || q.status !== 'passed') {
        fail(`検証の出力の ${q.id} が入力・実行記録と一致しません`);
      }
    });
    const nc = report.negative_controls;
    if (!Array.isArray(nc) || nc.length !== run.verification.negative_control_count) fail('意図的な失敗の件数が実行記録と一致しません');
    for (const c of nc) {
      if (!isObj(c) || typeof c.id !== 'string' || typeof c.label !== 'string' || !Number.isInteger(c.exit_code) || c.exit_code === 0 ||
          c.success_artifact_created !== false || c.status !== 'passed') {
        fail(`意図的な失敗 ${c && c.id} の記録が想定と違います`);
      }
    }
  }

  async function fetchAll() {
    const keys = Object.keys(URLS);
    const buffers = await Promise.all([...keys.map((k) => fetchBytes(URLS[k])), ...INPUT_KEYS.map(fetchBytes)]);
    const outputs = Object.fromEntries(keys.map((k, i) => [k, parseJson(buffers[i], URLS[k])]));
    const inputBuffers = buffers.slice(keys.length);
    const hashList = await Promise.all(inputBuffers.map(sha256));
    const hashes = Object.fromEntries(INPUT_KEYS.map((key, i) => [key, hashList[i]]));
    const queriesDoc = parseJson(inputBuffers[0], QUERIES_URL);
    const texts = Object.fromEntries(NOTE_IDS.map((id, i) => [id, decode(inputBuffers[i + 1], noteUrl(id))]));

    checkQueries(queriesDoc);
    checkIndex(outputs.index, texts, hashes);
    checkCreated(outputs.created);
    const sessions = checkRun(outputs.run, { hashes, queriesDoc, index: outputs.index, created: outputs.created });
    checkVerification(outputs.verification, outputs.run, queriesDoc);
    return { ...outputs, queriesDoc, hashes, sessions };
  }

  // ---------- 表示：検索 ----------

  function markedText(parent, text, tokens) {
    const lower = text.toLowerCase();
    const useful = lower.length === text.length ? tokens.filter((t) => t && lower.includes(t)) : [];
    let at = 0;
    while (useful.length && at < text.length) {
      let next = -1;
      let hit = '';
      for (const t of useful) {
        const i = lower.indexOf(t, at);
        if (i !== -1 && (next === -1 || i < next || (i === next && t.length > hit.length))) { next = i; hit = t; }
      }
      if (next === -1) break;
      if (next > at) parent.append(text.slice(at, next));
      parent.append(el('mark', '', text.slice(next, next + hit.length)));
      at = next + hit.length;
    }
    if (at < text.length) parent.append(text.slice(at));
  }

  function noteCard(note, tokens, tag) {
    const li = el('li', 'note');
    li.dataset.id = note.id;
    const head = el('p', 'note-head');
    const title = el('strong', 'note-title');
    markedText(title, note.title, tokens);
    head.append(el('span', 'note-id', note.id), title);
    const tags = el('p', 'note-tags');
    tags.append(el('span', 'note-label', 'タグ'));
    const tagKey = normalize(tag).trim();
    note.tags.forEach((t, i) => {
      if (i > 0) tags.append('・');
      tags.append(tagKey !== '' && normalize(t).trim() === tagKey ? el('mark', '', t) : t);
    });
    const body = el('p', 'note-body');
    markedText(body, note.body, tokens);
    li.append(head, tags, body, link(`project/${note.source}`, `元のメモ ${note.source}`));
    return li;
  }

  function runLive() {
    if (!loaded) return;
    const query = queryInput.value;
    const tag = tagSelect.value;
    const { tokens, results } = search(loaded.index.notes, query, tag);
    lastLive = { query, tag, ids: results.map((n) => n.id) };
    const words = tokens.length ? `語：${tokens.join('・')}` : '語なし';
    const tagText = tag ? `タグ：${tag}` : 'タグ指定なし';
    count.textContent = `ブラウザー検索 ${results.length}件／全${loaded.index.notes.length}件（${words}、${tagText}）`;
    empty.hidden = results.length !== 0;
    notesList.replaceChildren(...results.map((note) => noteCard(note, tokens, tag)));
    renderRelation();
  }

  // ---------- 表示：保存記録 ----------

  const selected = () => loaded && loaded.run.queries.find((q) => q.id === selectedId);
  const showText = (s) => (s === '' ? '（空）' : `「${s}」`);

  function renderRelation() {
    const q = selected();
    if (!q || !lastLive) return;
    const savedIds = q.output.result_ids;
    const idText = (ids) => (ids.length ? ids.join('・') : '0件');
    if (lastLive.query === q.input.query && lastLive.tag === q.input.tag) {
      recordRelation.textContent = same(lastLive.ids, savedIds)
        ? `上の検索欄は ${q.id} と同じ条件です。ブラウザー検索の結果（${idText(lastLive.ids)}）も、この保存記録と一致します。`
        : `上の検索欄は ${q.id} と同じ条件ですが、ブラウザー検索の結果（${idText(lastLive.ids)}）は保存記録（${idText(savedIds)}）と違います。ここには保存したCLIの結果をそのまま出しています。`;
    } else {
      recordRelation.textContent = `上の検索欄は ${q.id} の条件から変わっています（ブラウザー検索 ${idText(lastLive.ids)}）。ここには ${q.id} で保存したCLIの結果をそのまま出しています。`;
    }
  }

  function renderRecordList() {
    recordList.replaceChildren(...loaded.run.queries.map((q) => {
      const li = el('li');
      const btn = el('button', 'record-btn');
      btn.type = 'button';
      btn.dataset.id = q.id;
      btn.setAttribute('aria-pressed', String(q.id === selectedId));
      btn.append(el('span', 'rb-id', q.id), el('span', 'rb-count', `${q.output.result_ids.length}件`), el('span', 'rb-label', q.label));
      btn.addEventListener('click', () => select(q.id));
      li.append(btn);
      return li;
    }));
  }

  function renderRecord(q) {
    const out = q.output;
    recordTitle.textContent = `${q.id}　${q.label}`;
    const spaceNote = /　/.test(out.query) ? '（全角空白を含む）' : '';
    recordQuery.textContent = `${showText(out.query)}${spaceNote}`;
    recordTag.textContent = showText(out.tag);
    recordTokens.textContent = out.tokens.length ? out.tokens.join('・') : 'なし（語の条件なし）';
    recordCount.textContent = `${out.results.length}件`;
    recordIds.textContent = out.result_ids.length ? out.result_ids.join('・') : 'なし';
    recordEmpty.hidden = out.results.length !== 0;
    recordEmpty.textContent = out.results.length === 0
      ? '保存記録は0件です。期待IDも空で、該当なしが正しい結果です。'
      : '';
    recordResults.replaceChildren(...out.results.map((note) => {
      const li = el('li', 'rr');
      li.dataset.id = note.id;
      const head = el('p', 'rr-head');
      head.append(el('span', 'note-id', note.id), el('strong', '', note.title));
      li.append(head, el('p', 'rr-tags', `タグ：${note.tags.join('・')}`), el('p', 'rr-body', note.body), el('p', 'rr-source', `source：${note.source}`));
      return li;
    }));
    downloadStatus.textContent = '';
    downloadBtn.disabled = false;
    record.hidden = false;
  }

  function select(id) {
    if (!loaded) return;
    const q = loaded.run.queries.find((x) => x.id === id);
    if (!q) return;
    selectedId = id;
    for (const btn of recordList.querySelectorAll('.record-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.id === id));
    renderRecord(q);
    queryInput.value = q.input.query;
    tagSelect.value = q.input.tag;
    if (tagSelect.value !== q.input.tag) tagSelect.value = '';
    runLive();
  }

  function downloadRecord() {
    const q = selected();
    if (!q) return;
    const name = `learn-harness-${q.id}.json`;
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(q, null, 2)}\n`], { type: 'application/json' }));
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    downloadStatus.textContent = `JSONのダウンロードを要求しました（${name}）。保存できたかはブラウザーの表示で確かめてください。`;
  }

  // ---------- 表示：状態と検証 ----------

  function renderTech(data) {
    const { created, run, verification, sessions } = data;
    techCommand.textContent = created.command;
    techCreated.replaceChildren(...CREATED_FILES.map((name) => {
      const li = el('li');
      li.append(el('span', 'file-name', name), el('span', 'file-sha', `SHA-256 ${created.created_files_sha256[name]}`),
        link(`outputs/scaffold/${name}`, `生成時の原本 outputs/scaffold/${name}`));
      return li;
    }));

    const row = (label, a, b) => {
      const tr = el('tr');
      tr.append(el('th', '', label), el('td', '', STATUS_TEXT[a] || a), el('td', '', STATUS_TEXT[b] || b));
      tr.firstChild.scope = 'row';
      return tr;
    };
    const f1Name = sessions.second.f1.name || 'feat-001';
    const f2Name = sessions.second.f2.name || 'feat-002';
    techSessions.replaceChildren(
      row(`feat-001 ${f1Name}`, sessions.first.f1.status, sessions.second.f1.status),
      row(`feat-002 ${f2Name}`, sessions.first.f2.status, sessions.second.f2.status),
    );
    const evidence = typeof sessions.second.f1.evidence === 'string' ? sessions.second.f1.evidence : '';
    techEvidence.textContent = evidence ? `再開セッション後の feat-001 の証拠欄：${evidence}` : '';
    techEvidence.hidden = !evidence;

    const v = run.verification;
    const rows = [
      ['実行したコマンド', `${v.command}（中身は node scripts/verify.mjs）`],
      ['終了コード', String(v.exit_code)],
      ['メモ', `${verification.note_count}件を入力ファイルと照合`],
      ['検索', `${verification.query_count}問すべて期待IDと全項目が一致`],
      ['意図的な失敗', `${verification.negative_controls.length}件すべて、CLIが断り成功の出力なし`],
      ['入力の一致', '検証の前後で入力が変わらず（source_integrity: true）'],
      ['このページの照合', `入力${INPUT_KEYS.length}件のSHA-256をブラウザーで再計算し、実行記録と一致`],
    ];
    techVerification.replaceChildren(...rows.flatMap(([k, val]) => [el('dt', '', k), el('dd', '', val)]));
    techControls.replaceChildren(...verification.negative_controls.map((c) => {
      const li = el('li');
      li.append(el('span', 'nc-id', c.id), el('span', 'nc-label', c.label), el('span', 'nc-exit', `終了コード ${c.exit_code}`));
      return li;
    }));
    techWait.hidden = true;
    techLive.hidden = false;
  }

  function fillTags(notes) {
    const tags = [...new Set(notes.flatMap((n) => n.tags))].sort();
    tagSelect.replaceChildren(el('option', '', 'すべてのタグ'), ...tags.map((t) => {
      const option = el('option', '', t);
      option.value = t;
      return option;
    }));
    tagSelect.firstChild.value = '';
  }

  function setControls(enabled) {
    for (const node of [queryInput, tagSelect, applyBtn, resetBtn]) node.disabled = !enabled;
    if (!enabled) downloadBtn.disabled = true;
  }

  function clearOutputs() {
    loaded = null;
    lastLive = null;
    setControls(false);
    count.textContent = '';
    empty.hidden = true;
    notesList.replaceChildren();
    recordList.replaceChildren();
    record.hidden = true;
    recordResults.replaceChildren();
    recordRelation.textContent = '';
    downloadStatus.textContent = '';
    techLive.hidden = true;
    techWait.hidden = false;
    techCreated.replaceChildren();
    techSessions.replaceChildren();
    techVerification.replaceChildren();
    techControls.replaceChildren();
  }

  function load() {
    if (inflight) return inflight;
    clearOutputs();
    retry.disabled = true;
    loadError.hidden = true;
    loadStatus.dataset.state = 'loading';
    loadStatus.textContent = '実行記録を読み込んでいます…';
    inflight = fetchAll()
      .then((data) => {
        loaded = data;
        fillTags(data.index.notes);
        renderRecordList();
        renderTech(data);
        setControls(true);
        select(selectedId);
        loadStatus.dataset.state = 'ready';
        loadStatus.textContent = '入力と実行記録の一致を確認しました。';
      })
      .catch((err) => {
        clearOutputs();
        loadStatus.dataset.state = 'error';
        loadStatus.textContent = '記録を表示できません。';
        loadErrorText.textContent = err instanceof Error ? err.message : '読み込みに失敗しました';
        loadError.hidden = false;
      })
      .finally(() => {
        inflight = null;
        retry.disabled = false;
      });
    return inflight;
  }

  // ---------- 依頼文 ----------

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  }

  function loadRequest() {
    if (requestInflight) return requestInflight;
    requestRetry.hidden = true;
    copyBtn.hidden = true;
    requestText.hidden = true;
    requestState.textContent = '依頼文を読み込んでいます…';
    requestInflight = fetch('request.txt', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) fail(`request.txt を取得できません（HTTP ${response.status}）`);
        return response.text();
      })
      .then((text) => {
        requestText.value = text;
        requestText.hidden = false;
        copyBtn.hidden = false;
        requestState.textContent = '';
      })
      .catch((err) => {
        requestRetry.hidden = false;
        requestState.textContent = `依頼文を読み込めませんでした。${err instanceof Error ? err.message : ''}`;
      })
      .finally(() => { requestInflight = null; });
    return requestInflight;
  }

  async function copyRequest() {
    const text = requestText.value;
    copyState.textContent = '';
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copyState.textContent = '依頼文をコピーしました。';
        showToast('依頼文をコピーしました');
        return;
      } catch {
        // 下の方法へ
      }
    }
    requestText.focus();
    requestText.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    if (ok) {
      copyState.textContent = '依頼文をコピーしました。';
      showToast('依頼文をコピーしました');
    } else {
      copyState.textContent = 'コピーできませんでした。選択した依頼文を長押しするか、Ctrl+C でコピーしてください。';
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runLive();
  });
  resetBtn.addEventListener('click', () => {
    queryInput.value = '';
    tagSelect.value = '';
    runLive();
  });
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (QUERY_IDS.includes(id)) { selectedId = id; if (loaded) select(id); }
  });
  retry.addEventListener('click', () => { load(); });
  downloadBtn.addEventListener('click', downloadRecord);
  copyBtn.addEventListener('click', () => { copyRequest(); });
  requestRetry.addEventListener('click', () => { loadRequest(); });

  load();
  loadRequest();
})();
