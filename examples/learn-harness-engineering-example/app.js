// 「1件だけ進めて、続きはファイルへ。」— Harness Creator 作例の図解ページ。開いても Node・CLI・AI は動かない。
// data-manifest.json（SHA-256 固定）に載った29ファイルだけを取得し、バイト数・SHA-256・中身の一致を確かめてから図を描く。
// 1つでも合わなければ図と結果を消し、理由と「もう一度読み込む」を出す。代わりのデータは持たない。
// 図の中の結果と保存ボタンは Node CLI の保存記録。ブラウザー内の検索は別の欄で、保存記録を書き換えない。
'use strict';

(() => {
  const MANIFEST_URL = 'data-manifest.json';
  const MANIFEST_SHA256 = 'd26b983e3e0895ba9d0aa4e9c106f5c2d1145675aafc876cc96ec7841a8152da';
  const REPO = 'walkinglabs/learn-harness-engineering';
  const PIN = '38ddcd2bf8d65271f668b94e7c875ca1d629d622';
  const NOTE_IDS = ['N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08'];
  const QUERY_IDS = ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08'];
  const CREATED_FILES = ['AGENTS.md', 'feature_list.json', 'progress.md', 'session-handoff.md', 'init.sh'];
  const STATE_FILES = ['feature_list.json', 'progress.md', 'session-handoff.md'];
  const NOTE_KEYS = ['body', 'id', 'source', 'source_sha256', 'tags', 'title'];
  const PATH = {
    index: 'project/outputs/index.json',
    run: 'outputs/exercise-run.json',
    verification: 'project/outputs/verification.json',
    created: 'outputs/harness-created.json',
    queries: 'project/input/queries.json',
  };
  const noteUrl = (id) => `project/input/notes/${id}.md`;
  const scaffoldUrl = (name) => `outputs/scaffold/${name}`;
  const snapUrl = (session, name) => `outputs/sessions/${session}/${name}`;
  const projectUrl = (name) => `project/${name}`;
  const recordUrl = (id) => `project/outputs/queries/${id}.json`;
  // 準備済みマニフェストに載るはずの29ファイル（この順）。これ以外のパスは受け付けない。
  const KNOWN_FILES = [
    PATH.index, PATH.run, PATH.verification, PATH.created, PATH.queries,
    ...NOTE_IDS.map(noteUrl),
    ...CREATED_FILES.map(scaffoldUrl),
    ...STATE_FILES.map((n) => snapUrl('implementation', n)),
    ...STATE_FILES.map((n) => snapUrl('resume', n)),
    projectUrl('AGENTS.md'), ...STATE_FILES.map(projectUrl), projectUrl('init.sh'),
  ];
  const INPUT_KEYS = [PATH.queries, ...NOTE_IDS.map(noteUrl)];
  const DEFAULT_ID = 'Q03';
  const STAGES = ['implementation', 'verification', 'resume'];
  const STAGE_LABEL = { implementation: '実装後', verification: '検証', resume: '再開後' };
  const STATUS_TEXT = { 'not-started': '未着手', 'in-progress': '作業中', blocked: '停止中', done: '完了' };
  const STATUS_KIND = { 'not-started': 'p-idle', 'in-progress': 'p-progress', blocked: 'p-wait', done: 'p-done' };
  const ROLE = {
    'AGENTS.md': '作業の決まり',
    'feature_list.json': '1件に絞る',
    'progress.md': '今どこか',
    'session-handoff.md': '次へ渡す',
    'init.sh': '実行して確かめる',
  };
  const ROLE_LINES = {
    'AGENTS.md': ['作業の', '決まり'],
    'feature_list.json': ['1件に', '絞る'],
    'progress.md': ['今', 'どこか'],
    'session-handoff.md': ['次へ', '渡す'],
    'init.sh': ['実行して', '確かめる'],
  };
  const SHA = /^[0-9a-f]{64}$/;

  const $ = (id) => document.getElementById(id);
  const figure = $('diagram');
  const svg = $('dg');
  const svgTitle = $('dg-title');
  const desc = $('diagram-desc');
  const loadPanel = $('load-panel');
  const loadStatus = $('load-status');
  const loadError = $('load-error');
  const loadErrorText = $('load-error-text');
  const retry = $('retry');
  const stageBtns = [...document.querySelectorAll('.seg')];
  const queryBtns = [...document.querySelectorAll('.q')];
  const downloadBtn = $('download-record');
  const downloadStatus = $('download-status');
  const compareLink = $('compare-link');
  const navCompare = $('nav-compare');
  const pickerCurrent = $('picker-current');
  const pickerList = $('picker-list');
  const recordSum = $('record-sum');
  const recordTitle = $('record-title');
  const recordFields = $('record-fields');
  const recordEmpty = $('record-empty');
  const recordResults = $('record-results');
  const recordFile = $('record-file');
  const recordCompare = $('record-compare');
  const form = $('search-form');
  const queryInput = $('query');
  const tagSelect = $('tag');
  const applyBtn = $('apply');
  const resetBtn = $('reset');
  const count = $('count');
  const empty = $('empty');
  const relation = $('relation');
  const notesList = $('notes');
  const createdCommand = $('created-command');
  const filesList = $('files-list');
  const sessionsList = $('sessions-list');
  const sessionsCheck = $('sessions-check');
  const verifyFields = $('verify-fields');
  const verifyQueries = $('verify-queries');
  const verifyControls = $('verify-controls');
  const inputsList = $('inputs-list');
  const requestState = $('request-state');
  const requestText = $('request-text');
  const copyBtn = $('copy');
  const copyState = $('copy-state');
  const requestRetry = $('request-retry');
  const toast = $('toast');
  const wideMq = window.matchMedia('(min-width: 720px)');

  let loaded = null;
  let stage = 'resume';
  let selectedId = QUERY_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : DEFAULT_ID;
  let generation = 0;
  let controller = null;
  let lastLive = null;
  let requestInflight = null;
  let toastTimer = 0;

  // ---------- 共通 ----------

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

  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const v of Object.values(value)) deepFreeze(v);
    }
    return value;
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

  async function fetchBytes(url, signal) {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store', signal });
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
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
    if (!window.crypto || !window.crypto.subtle) fail('この環境ではSHA-256を計算できないため、記録との一致を確かめられません');
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

  function checkManifest(manifest) {
    if (!sameKeys(manifest, ['commit', 'files', 'format', 'source']) || manifest.format !== 'studio-yebisu-harness-visual-data-v1') fail('data-manifest.json の形式が想定と違います');
    if (manifest.source !== REPO || manifest.commit !== PIN) fail('data-manifest.json の原典が固定コミットと違います');
    if (!Array.isArray(manifest.files) || manifest.files.length !== KNOWN_FILES.length) fail(`data-manifest.json のファイルが${KNOWN_FILES.length}件ではありません`);
    manifest.files.forEach((f, i) => {
      if (!sameKeys(f, ['bytes', 'path', 'sha256'])) fail('data-manifest.json の項目の形が想定と違います');
      if (f.path !== KNOWN_FILES[i]) fail(`data-manifest.json に想定外のパスがあります（${String(f.path)}）`);
      if (!Number.isInteger(f.bytes) || f.bytes <= 0 || typeof f.sha256 !== 'string' || !SHA.test(f.sha256)) fail(`${f.path} のバイト数か SHA-256 の記録が想定と違います`);
    });
  }

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

  function checkCreated(created, hashes) {
    if (!isObj(created) || created.format !== 'studio-yebisu-harness-created-v1') fail('5ファイルの生成記録の形式が想定と違います');
    if (!isObj(created.source) || created.source.repository !== REPO || created.source.commit !== PIN) fail('生成記録の原典が固定コミットと違います');
    if (created.exit_code !== 0 || typeof created.command !== 'string' || !created.command.includes('create-harness.mjs')) fail('生成記録の実行結果が想定と違います');
    if (!isObj(created.created_files_sha256) || sortedKeys(created.created_files_sha256) !== [...CREATED_FILES].sort().join('\n') ||
        !Object.values(created.created_files_sha256).every((v) => SHA.test(v))) {
      fail('生成記録に5ファイルの SHA-256 がそろっていません');
    }
    for (const name of CREATED_FILES) {
      if (hashes[scaffoldUrl(name)] !== created.created_files_sha256[name]) fail(`生成時の原本 ${scaffoldUrl(name)} が生成記録の SHA-256 と一致しません`);
    }
  }

  function featuresOf(session) {
    const list = Array.isArray(session.features) ? session.features : null;
    if (!list) fail(`${session.id} セッションの機能の記録がありません`);
    const byId = new Map(list.filter(isObj).map((f) => [f.id, f]));
    const f1 = byId.get('feat-001');
    const f2 = byId.get('feat-002');
    if (!f1 || !f2 || list.length !== 2) fail(`${session.id} セッションの記録が feat-001・feat-002 の2件ではありません`);
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
        h.creation !== PATH.created || h.structural_assessment !== 'outputs/harness-assessment.json') {
      fail('実行記録のハーネス生成の項目が想定と違います');
    }
    if (sortedKeys(created.created_files_sha256) !== [...h.created_files].sort().join('\n')) fail('生成記録と実行記録の5ファイルが一致しません');

    const v = run.verification;
    if (!isObj(v) || v.command !== './init.sh' || v.exit_code !== 0 || v.report !== PATH.verification ||
        v.note_count !== 8 || v.query_count !== 8 || v.negative_control_count !== 11) {
      fail('実行記録の検証（./init.sh・終了コード0・8件・8問・不正入力11件）が想定と違います');
    }

    if (!Array.isArray(run.sessions) || run.sessions.length !== 2) fail('実行記録のセッションが2つではありません');
    const [first, second] = run.sessions;
    if (!isObj(first) || first.id !== 'implementation' || first.state !== 'awaiting-verification') fail('実装セッションの記録が想定と違います');
    if (!isObj(second) || second.id !== 'resume' || second.state !== 'verified-handoff') fail('再開セッションの記録が想定と違います');
    const a = featuresOf(first);
    const b = featuresOf(second);
    if (a.f1.status !== 'in-progress' || a.f2.status !== 'not-started') fail('実装セッション後の状態が「feat-001 作業中・feat-002 未着手」ではありません');
    if (a.list.filter((f) => f.status === 'in-progress').length !== 1) fail('実装セッション後に作業中の機能が1件ではありません');
    if (b.f1.status !== 'done' || b.f2.status !== 'not-started') fail('再開セッション後の状態が「feat-001 完了・feat-002 未着手」ではありません');
    if (typeof b.f1.evidence !== 'string' || !b.f1.evidence.includes('outputs/verification.json')) fail('再開セッション後の feat-001 に検証の記録の場所がありません');

    const byId = new Map(index.notes.map((n) => [n.id, n]));
    if (!Array.isArray(run.queries) || run.queries.map((q) => q && q.id).join() !== QUERY_IDS.join()) fail('実行記録の検索が Q01〜Q08 の8問ではありません');
    run.queries.forEach((q, i) => {
      const want = queriesDoc.queries[i];
      if (!sameKeys(q, ['id', 'input', 'label', 'output', 'status'])) fail(`${q.id} の記録の項目が想定と違います`);
      if (q.label !== want.label || !sameKeys(q.input, ['query', 'tag']) || q.input.query !== want.query || q.input.tag !== want.tag) fail(`${q.id} の条件が入力と違います`);
      if (q.status !== 'passed') fail(`${q.id} が照合済み（passed）ではありません`);
      const out = q.output;
      if (!sameKeys(out, ['format', 'query', 'result_ids', 'results', 'tag', 'tokens']) || out.format !== 'studio-yebisu-note-search-v1' || out.query !== want.query || out.tag !== want.tag) fail(`${q.id} の CLI 出力の形が想定と違います`);
      if (!Array.isArray(out.tokens) || !same(out.tokens, tokensOf(want.query))) fail(`${q.id} の tokens が条件の正規化と違います`);
      if (!same(out.result_ids, want.expected_ids)) fail(`${q.id} の結果のIDが期待と違います`);
      if (!Array.isArray(out.results) || !same(out.results, out.result_ids.map((id) => byId.get(id)))) fail(`${q.id} の結果の全項目が索引のメモと一致しません`);
    });
    return { implementation: a, resume: b };
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
    if (!Array.isArray(nc) || nc.length !== run.verification.negative_control_count) fail('不正な入力の件数が実行記録と一致しません');
    nc.forEach((c, i) => {
      const id = `NC${String(i + 1).padStart(2, '0')}`;
      if (!isObj(c) || c.id !== id || typeof c.label !== 'string' || c.exit_code !== 1 ||
          c.success_artifact_created !== false || c.status !== 'passed') {
        fail(`不正な入力 ${id} の記録が「終了コード1・成功の出力なし・passed」ではありません`);
      }
    });
  }

  // 2つの時点の状態ファイル：feature_list.json の中身が実行記録と同じで、再開で3ファイルだけが変わり、
  // project/ の3ファイルが再開後の写しと同じバイト列、init.sh は生成時のまま。
  function checkSnapshots(raw, hashes, run, sessions) {
    for (const [i, session] of ['implementation', 'resume'].entries()) {
      const path = snapUrl(session, 'feature_list.json');
      const doc = parseJson(raw[path], path);
      if (!sameKeys(doc, ['features']) || !same(doc.features, run.sessions[i].features)) fail(`${path} の状態が実行記録と一致しません`);
      for (const name of ['progress.md', 'session-handoff.md']) decode(raw[snapUrl(session, name)], snapUrl(session, name));
    }
    for (const name of STATE_FILES) {
      const before = hashes[snapUrl('implementation', name)];
      const after = hashes[snapUrl('resume', name)];
      if (before === after) fail(`${name} が再開セッションで更新されていません`);
      if (before === hashes[scaffoldUrl(name)]) fail(`実装セッション後の ${name} が雛形のままです`);
      if (hashes[projectUrl(name)] !== after) fail(`project/${name} が再開後の写しと同じバイト列ではありません`);
    }
    if (hashes[projectUrl('init.sh')] !== hashes[scaffoldUrl('init.sh')]) fail('project/init.sh が生成時の init.sh と同じではありません');
    if (hashes[projectUrl('AGENTS.md')] === hashes[scaffoldUrl('AGENTS.md')]) fail('project/AGENTS.md が雛形から書き換えられていません');
    decode(raw[projectUrl('AGENTS.md')], projectUrl('AGENTS.md'));
    if (sessions.resume.f1.status !== 'done') fail('再開後の feat-001 が完了ではありません');
  }

  async function fetchAll(signal) {
    const manifestBuf = await fetchBytes(MANIFEST_URL, signal);
    if ((await sha256(manifestBuf)) !== MANIFEST_SHA256) fail('data-manifest.json が固定した内容と違います（SHA-256 が一致しません）');
    const manifest = parseJson(manifestBuf, MANIFEST_URL);
    checkManifest(manifest);

    const buffers = await Promise.all(manifest.files.map((f) => fetchBytes(f.path, signal)));
    const raw = {};
    const hashes = {};
    for (let i = 0; i < manifest.files.length; i += 1) {
      const f = manifest.files[i];
      const buf = buffers[i];
      if (buf.byteLength !== f.bytes) fail(`${f.path} のバイト数（${buf.byteLength}）が記録（${f.bytes}）と違います`);
      const hash = await sha256(buf);
      if (hash !== f.sha256) fail(`${f.path} の SHA-256 が記録と違います`);
      raw[f.path] = buf;
      hashes[f.path] = hash;
    }

    const index = parseJson(raw[PATH.index], PATH.index);
    const run = parseJson(raw[PATH.run], PATH.run);
    const verification = parseJson(raw[PATH.verification], PATH.verification);
    const created = parseJson(raw[PATH.created], PATH.created);
    const queriesDoc = parseJson(raw[PATH.queries], PATH.queries);
    const texts = Object.fromEntries(NOTE_IDS.map((id) => [id, decode(raw[noteUrl(id)], noteUrl(id))]));

    checkQueries(queriesDoc);
    checkIndex(index, texts, hashes);
    checkCreated(created, hashes);
    const sessions = checkRun(run, { hashes, queriesDoc, index, created });
    checkVerification(verification, run, queriesDoc);
    checkSnapshots(raw, hashes, run, sessions);
    return deepFreeze({ index, run, verification, created, queriesDoc, hashes, sessions });
  }

  // ---------- 図（SVG） ----------

  const SVGNS = 'http://www.w3.org/2000/svg';
  // 横幅の目安（全角1、半角0.58）。SVGの文字は描く前に測れないため、枠の幅をこれで決める。
  const emw = (s) => [...s].reduce((w, ch) => w + (/[\x20-\x7e]/.test(ch) ? 0.58 : 1), 0);

  const GLYPHS = {
    'AGENTS.md': { d: 'M5 6h2M10 6h9M5 12h2M10 12h9M5 18h2M10 18h9' },
    'feature_list.json': { d: 'M4 5h5v5H4zM12 7.5h8M4 14h5v5H4zM12 16.5h8', fill: 'M4 5h5v5H4z' },
    'progress.md': { d: 'M12 21s-6-6.2-6-10.5a6 6 0 0 1 12 0C18 14.8 12 21 12 21zM12 8.2a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z' },
    'session-handoff.md': { d: 'M3 12h14M12 6l6 6-6 6' },
    'init.sh': { d: 'M4 4.5l8 5-8 5zM13 17l3 3 5-6.5', fill: 'M4 4.5l8 5-8 5z' },
    check: { d: 'M6 4h12v16H6zM9 12.5l2.2 2.2L15.5 10' },
    search: { d: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM15.5 15.5L20 20' },
  };

  const LAYOUTS = {
    portrait: {
      w: 360, h: 528,
      fs: { title: 12.5, label: 11, small: 10, tiny: 9, big: 16, file: 10.5, head: 9.5, card: 10 },
      head: { x: 4, y: 15, anchor: 'start', text: '5つのファイル' },
      groupLine: [37, 24, 37, 492],
      files: [30, 104, 204, 306, 436].map((y) => ({ x: 5, y, w: 64, h: 54 })),
      fileNameY: null,
      fileLinks: [[69, 57, 80, 57], [69, 131, 80, 131], [69, 231, 84, 231], [69, 333, 82, 333], [69, 463, 80, 463]],
      desk1: { x: 80, y: 22, w: 276, h: 164, tx: 92, ty: 41 },
      pill: { x: 198, y: 28, w: 154, h: 20 },
      notes: { x: 86, y: 60, w: 36, h: 46, step: 1.3, cap: { x: 109, y: 132 } },
      card1: { x: 142, y: 58, w: 96, h: 66 },
      result: { x: 250, y: 58, w: 100, h: 72, inline: false },
      excerpt: { x: 255, y: 148, chars: 10, lines: 2, lh: 13, bar: [250, 138, 250, 165] },
      record: { x: 252, y: 180, anchor: 'start' },
      arrows: {
        notes: [133, 91, 141, 91],
        result: [239, 91, 249, 91],
        spine: [[190, 125, 190, 195], [190, 263, 190, 289], [190, 385, 190, 403]],
      },
      gate: {
        cx: 190, beamY: 198, beamH: 9, half: 30, pillarW: 9, bottom: 262,
        label: { x: 90, y: 228, anchor: 'start' }, cmd: { x: 90, y: 243, anchor: 'start' },
        text: { x: 232, y: 216, lh: 19, anchor: 'start' }, glow: { x: 154, y: 192, w: 72, h: 76 },
      },
      folder: {
        x: 82, y: 280, w: 180, h: 104, tab: 84, tabH: 14, label: { x: 88, y: 290.5 },
        papers: { y: 302, w: 26, h: 34, xs: [90, 120, 150, 192, 222] }, caps: [{ x: 133, y: 354 }, { x: 221, y: 354 }],
      },
      tray: { x: 270, y: 284, w: 86, h: 100, label: { x: 278, y: 299 }, card: { x: 275, y: 306, w: 76, h: 70 } },
      desk2: { x: 80, y: 404, w: 276, h: 120, tx: 92, ty: 423, sx: 92, sy: 440 },
      card2: { x: 142, y: 448, w: 96, h: 66 },
      side: { cap: { x: 250, y: 468, anchor: 'start' }, glyphs: [252, 277, 302], gy: 476, gw: 20, gh: 24, foot: { x: 250, y: 516, anchor: 'start' } },
    },
    wide: {
      w: 1000, h: 400,
      fs: { title: 16, label: 14, small: 12.5, tiny: 11, big: 22, file: 13, head: 12.5, card: 13 },
      head: { x: 20, y: 13, anchor: 'start', text: 'Harness Creatorが作った5つのファイル' },
      groupLine: [72, 52, 875, 52],
      files: [72, 190, 480, 650, 875].map((cx) => ({ x: cx - 40, y: 22, w: 80, h: 62 })),
      fileNameY: 98,
      fileLinks: [[72, 103, 72, 118], [190, 103, 190, 118], [480, 103, 480, 150], [650, 103, 650, 140], [875, 103, 875, 118]],
      desk1: { x: 20, y: 118, w: 380, h: 272, tx: 34, ty: 141 },
      pill: { x: 186, y: 126, w: 204, h: 24 },
      notes: { x: 40, y: 176, w: 44, h: 58, step: 1.8, cap: { x: 68, y: 268 } },
      card1: { x: 130, y: 170, w: 120, h: 82 },
      result: { x: 130, y: 272, w: 255, h: 76, inline: true },
      excerpt: { x: 146, y: 339, chars: 17, lines: 1, lh: 15, bar: [138, 328, 138, 343] },
      record: { x: 385, y: 374, anchor: 'end' },
      arrows: {
        notes: [100, 211, 128, 211],
        result: [190, 253, 190, 271],
        spine: [[251, 211, 438, 211], [522, 211, 558, 211], [741, 211, 759, 211]],
      },
      gate: {
        cx: 480, beamY: 150, beamH: 12, half: 40, pillarW: 12, bottom: 262,
        label: { x: 480, y: 284, anchor: 'middle' }, cmd: { x: 480, y: 300, anchor: 'middle' },
        text: { x: 480, y: 324, lh: 19, anchor: 'middle' }, glow: { x: 428, y: 142, w: 104, h: 128 },
      },
      folder: {
        x: 560, y: 140, w: 180, h: 130, tab: 104, tabH: 17, label: { x: 568, y: 153 },
        papers: { y: 178, w: 28, h: 38, xs: [572, 604, 636, 680, 710] }, caps: [{ x: 618, y: 238 }, { x: 709, y: 238 }],
      },
      tray: { x: 560, y: 288, w: 180, h: 100, label: { x: 572, y: 307 }, card: { x: 576, y: 314, w: 148, h: 66 } },
      desk2: { x: 760, y: 118, w: 225, h: 272, tx: 774, ty: 141, sx: 774, sy: 162 },
      card2: { x: 812, y: 176, w: 120, h: 82 },
      side: { cap: { x: 872, y: 288, anchor: 'middle' }, glyphs: [838, 862, 886], gy: 298, gw: 22, gh: 28, foot: { x: 872, y: 350, anchor: 'middle' } },
    },
  };

  function sv(tag, attrs, parent) {
    const node = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined && v !== null) node.setAttribute(k, String(v));
    if (parent) parent.append(node);
    return node;
  }

  function stext(parent, x, y, str, cls, size, anchor = 'start') {
    const t = sv('text', { x, y, class: cls, 'font-size': size, 'text-anchor': anchor }, parent);
    t.textContent = str;
    return t;
  }

  function slink(parent, href, label) {
    const a = sv('a', { href, 'aria-label': label }, parent);
    sv('title', {}, a).textContent = label;
    return a;
  }

  function sline(parent, [x1, y1, x2, y2], cls) {
    return sv('line', { x1, y1, x2, y2, class: cls }, parent);
  }

  function arrow(parent, [x1, y1, x2, y2], on) {
    const cls = on ? '' : ' is-off';
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const len = 6;
    const bx = x2 - Math.cos(ang) * len;
    const by = y2 - Math.sin(ang) * len;
    sline(parent, [x1, y1, bx, by], `d-arrow${cls}`);
    const px = Math.sin(ang) * len * 0.55;
    const py = -Math.cos(ang) * len * 0.55;
    sv('path', { d: `M${x2} ${y2}L${bx + px} ${by + py}L${bx - px} ${by - py}Z`, class: `d-arrowhead${cls}` }, parent);
  }

  function paper(parent, x, y, w, h, cls, fold) {
    const f = fold === undefined ? Math.min(w, h) * 0.22 : fold;
    sv('path', { d: `M${x} ${y}H${x + w - f}L${x + w} ${y + f}V${y + h}H${x}Z`, class: cls }, parent);
    sv('path', { d: `M${x + w - f} ${y}V${y + f}H${x + w}Z`, class: 'd-fold' }, parent);
  }

  function glyph(parent, name, cx, cy, size) {
    const g = GLYPHS[name];
    const k = size / 24;
    const wrap = sv('g', { transform: `translate(${cx - size / 2} ${cy - size / 2}) scale(${k})`, 'aria-hidden': 'true' }, parent);
    if (g.fill) sv('path', { d: g.fill, class: 'd-glyph-fill' }, wrap);
    sv('path', { d: g.d, class: 'd-glyph', 'stroke-width': 2 }, wrap);
  }

  function pill(parent, x, y, text, kind, size, anchor = 'start') {
    const w = emw(text) * size + size * 1.2;
    const h = size + 7;
    const left = anchor === 'middle' ? x - w / 2 : x;
    const g = sv('g', { class: kind }, parent);
    sv('rect', { x: left, y, width: w, height: h, rx: h / 2 }, g);
    stext(g, left + w / 2, y + h / 2 + size * 0.36, text, '', size, 'middle');
    return w;
  }

  function badge(parent, rx, ry, text, run, size) {
    const w = emw(text) * size + size * 0.9;
    const h = size + 5;
    sv('rect', { x: rx - w, y: ry, width: w, height: h, rx: 3, class: `d-badge${run ? ' is-run' : ''}` }, parent);
    stext(parent, rx - w / 2, ry + h / 2 + size * 0.36, text, 'd-badge-text', size, 'middle');
  }

  function wrapChars(text, chars, lines) {
    const all = [...text];
    const out = [];
    for (let i = 0; i < lines; i += 1) out.push(all.slice(i * chars, (i + 1) * chars).join(''));
    if (all.length > chars * lines) {
      const last = [...out[lines - 1]];
      last[last.length - 1] = '…';
      out[lines - 1] = last.join('');
    }
    return out.filter((s) => s !== '');
  }

  function querySummary(input) {
    const parts = [];
    if (input.query !== '') parts.push(`「${input.query}」`);
    if (input.tag !== '') parts.push(`タグ「${input.tag}」`);
    return parts.length ? parts.join('＋') : '語なし・タグなし';
  }

  function resultView(q) {
    const res = q.output.results;
    const n = res.length;
    const big = n === 0 ? '0件' : n === 1 ? res[0].id : n === 2 ? `${res[0].id}・${res[1].id}` : `${res[0].id}〜${res[n - 1].id}`;
    const title = n === 0 ? '該当なし' : n === 1 ? res[0].title : `${res[0].title} ほか`;
    const excerpt = n === 0 ? '該当なしが正しい結果' : res[0].body;
    return { n, big, title, excerpt };
  }

  function taskCard(parent, box, f, L, opts = {}) {
    const fs = L.fs;
    const { x, y, w, h } = box;
    sv('rect', { x, y, width: w, height: h, rx: 7, class: 'd-card' }, parent);
    sv('rect', { x: x + 1, y: y + 1, width: 4, height: h - 2, rx: 2, class: `d-band${opts.parked ? ' is-parked' : ''}` }, parent);
    const pad = x + 10;
    stext(parent, pad, y + fs.tiny + 7, f.id, 'd-mono', fs.tiny);
    stext(parent, pad, y + fs.tiny + fs.label + 12, f.name, 'd-name', opts.nameSize || fs.card);
    const ps = fs.tiny + 0.5;
    pill(parent, pad, y + h - ps - 13, STATUS_TEXT[f.status] || f.status, STATUS_KIND[f.status] || 'p-idle', ps);
  }

  function ghostCard(parent, box, text, L) {
    sv('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 7, class: 'd-card is-ghost' }, parent);
    stext(parent, box.x + box.w / 2, box.y + box.h / 2 + L.fs.small * 0.36, text, 'd-muted', L.fs.small, 'middle');
  }

  function fileHref(name, snap) {
    return STATE_FILES.includes(name) ? snapUrl(snap, name) : projectUrl(name);
  }

  function drawDiagram() {
    const name = wideMq.matches ? 'wide' : 'portrait';
    const L = LAYOUTS[name];
    const fs = L.fs;
    figure.dataset.layout = name;
    svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
    for (const node of [...svg.childNodes]) if (node !== svgTitle) node.remove();
    if (!loaded) return;

    const q = selectedQuery();
    const sess = stage === 'resume' ? loaded.sessions.resume : loaded.sessions.implementation;
    const snap = stage === 'resume' ? 'resume' : 'implementation';
    const ran = stage !== 'implementation';
    const resumed = stage === 'resume';
    const root = sv('g', { class: 'd-fresh' }, svg);

    // 5つのファイルのまとまり
    sline(root, L.groupLine, 'd-group-line');
    stext(root, L.head.x, L.head.y, L.head.text, 'd-title', fs.head, L.head.anchor);

    // 机・門・フォルダー・次の机（土台）
    const d1 = L.desk1;
    sv('rect', { x: d1.x, y: d1.y, width: d1.w, height: d1.h, rx: 10, class: `d-desk${stage === 'implementation' ? ' is-active' : ''}` }, root);
    stext(root, d1.tx, d1.ty, '実装のセッション', 'd-title', fs.title);
    const d2 = L.desk2;
    sv('rect', { x: d2.x, y: d2.y, width: d2.w, height: d2.h, rx: 10, class: `d-desk${resumed ? ' is-active' : ' is-dim'}` }, root);
    stext(root, d2.tx, d2.ty, '新しいセッション', 'd-title', fs.title);
    stext(root, d2.sx, d2.sy, resumed ? '根拠を読んで状態更新' : 'まだ始まっていない', resumed ? 'd-sub' : 'd-muted', fs.label);
    const gt = L.gate;
    if (stage === 'verification') sv('rect', { x: gt.glow.x, y: gt.glow.y, width: gt.glow.w, height: gt.glow.h, rx: 10, fill: '#d6ebe6' }, root);

    // ファイルから受け持つ場所への線
    L.fileLinks.forEach((ln) => {
      sline(root, ln, 'd-connector');
      sv('circle', { cx: ln[2], cy: ln[3], r: 2.4, class: 'd-dot' }, root);
    });

    // 流れの矢印（机 → 門 → フォルダー → 次の机）
    arrow(root, L.arrows.spine[0], ran);
    arrow(root, L.arrows.spine[1], ran);
    arrow(root, L.arrows.spine[2], resumed);
    arrow(root, L.arrows.notes, true);
    arrow(root, L.arrows.result, ran);

    // 5つのファイル
    const marks = {
      implementation: { 'AGENTS.md': '書換', 'feature_list.json': '書換', 'progress.md': '書換', 'session-handoff.md': '書換' },
      verification: { 'init.sh': '実行' },
      resume: { 'feature_list.json': '更新', 'progress.md': '更新', 'session-handoff.md': '更新' },
    }[stage];
    ['AGENTS.md', 'feature_list.json', 'init.sh', 'progress.md', 'session-handoff.md'].forEach((file, i) => {
      const box = L.files[i];
      const mark = marks[file];
      const a = slink(root, fileHref(file, snap), `${ROLE[file]}（${file}）を開く`);
      paper(a, box.x, box.y, box.w, box.h, `d-file${mark ? ' is-lit' : ''}`);
      const cx = box.x + box.w / 2;
      glyph(a, file, cx, box.y + box.h * 0.3, box.h * 0.3);
      const [l1, l2] = ROLE_LINES[file];
      stext(a, cx, box.y + box.h * 0.66, l1, 'd-file-label', fs.file, 'middle');
      stext(a, cx, box.y + box.h * 0.66 + fs.file * 1.12, l2, 'd-file-label', fs.file, 'middle');
      if (mark) badge(a, box.x + box.w + 3, box.y - 5, mark, mark === '実行', fs.tiny - 1);
      if (L.fileNameY) stext(root, cx, L.fileNameY, file, 'd-mono', fs.tiny - 1, 'middle');
    });

    // 検索の条件（選んだ保存記録）
    const p = L.pill;
    const pa = slink(root, PATH.queries, `${q.id} の条件（固定した8問）を開く`);
    sv('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.h / 2, class: 'd-pillbox' }, pa);
    const pt = sv('text', { x: p.x + 8, y: p.y + p.h / 2 + fs.small * 0.36, 'font-size': fs.small }, pa);
    sv('tspan', { class: 'd-pill-id' }, pt).textContent = `${q.id} `;
    sv('tspan', { class: 'd-pill-q' }, pt).textContent = querySummary(q.input);

    // 架空のメモ8件（一致したメモに印）
    const nb = L.notes;
    const matched = new Set(q.output.result_ids);
    const na = slink(root, PATH.index, '架空のメモ8件の索引（index.json）を開く');
    NOTE_IDS.forEach((id, i) => {
      const nx = nb.x + i * nb.step;
      const ny = nb.y + i * nb.step;
      sv('rect', { x: nx, y: ny, width: nb.w, height: nb.h, rx: 2.5, class: 'd-note' }, na);
    });
    const fx = nb.x + 7 * nb.step;
    const fy = nb.y + 7 * nb.step;
    for (let k = 0; k < 4; k += 1) sline(na, [fx + 6, fy + 10 + k * 8, fx + nb.w - 6 - (k % 2) * 8, fy + 10 + k * 8], 'd-note-line');
    NOTE_IDS.forEach((id, i) => {
      if (!matched.has(id)) return;
      sv('rect', { x: fx + nb.w, y: nb.y + 4 + i * ((nb.h + 7 * nb.step - 10) / 8), width: 5, height: 4.5, rx: 1, class: 'd-note-tab' }, na);
    });
    stext(root, nb.cap.x, nb.cap.y, 'メモ8件', 'd-strong', fs.small, 'middle');

    // 作業中の1件（feat-001）
    if (resumed) ghostCard(root, L.card1, '次へ渡した', L);
    else taskCard(slink(root, snapUrl('implementation', 'feature_list.json'), `feat-001 ${sess.f1.name}：${STATUS_TEXT[sess.f1.status]}（実装後の feature_list.json）`), L.card1, sess.f1, L);

    // 実際の結果（Node CLI の保存記録）
    const rv = resultView(q);
    const rb = L.result;
    const rg = sv('g', { class: ran ? '' : 'is-pending' }, root);
    const firstSource = rv.n > 0 ? projectUrl(q.output.results[0].source) : recordUrl(q.id);
    const ra = slink(rg, firstSource, rv.n > 0 ? `${q.id} の結果 ${rv.big}（元のメモ ${q.output.results[0].source}）を開く` : `${q.id} の結果 0件の記録を開く`);
    sv('rect', { x: rb.x, y: rb.y, width: rb.w, height: rb.h, rx: 7, class: `d-result${ran ? '' : ' is-pending-box'}` }, ra);
    const hy = rb.y + fs.tiny + 6;
    stext(ra, rb.x + 8, hy, `${q.id}の結果・${rv.n}件`, 'd-result-head', fs.tiny);
    const by = hy + fs.big + 5;
    stext(ra, rb.x + 8, by, rv.big, 'd-result-big', fs.big);
    if (rb.inline) stext(ra, rb.x + 8 + emw(rv.big) * fs.big + 10, by, rv.title, 'd-name', fs.label);
    else stext(ra, rb.x + 8, by + fs.small + 6, rv.title, 'd-name', fs.small);
    const ex = L.excerpt;
    if (ex.bar) sline(rg, ex.bar, 'd-quote-bar');
    wrapChars(rv.excerpt, ex.chars, ex.lines).forEach((line, i) => stext(rg, ex.x, ex.y + i * ex.lh, line, 'd-quote', fs.small));
    const rl = slink(rg, recordUrl(q.id), `${q.id} の保存記録（${q.id}.json）を開く`);
    stext(rl, L.record.x, L.record.y, `${q.id}の保存記録 ↗`, 'd-sub', fs.small, L.record.anchor);
    if (!ran) pill(root, rb.x + rb.w / 2, rb.y + rb.h / 2 - fs.tiny / 2 - 3, 'まだ実行前', 'p-wait', fs.tiny, 'middle');

    // 確かめる門（制作担当が実行）
    const ga = ran ? slink(root, PATH.verification, '検証の記録（verification.json）を開く：制作担当が ./init.sh を実行') : sv('g', {}, root);
    const gcls = `d-gate-part${ran ? ' is-on' : ''}`;
    sv('rect', { x: gt.cx - gt.half, y: gt.beamY, width: gt.half * 2, height: gt.beamH, rx: 2, class: gcls }, ga);
    sv('rect', { x: gt.cx - gt.half + 4, y: gt.beamY + gt.beamH, width: gt.pillarW, height: gt.bottom - gt.beamY - gt.beamH, class: gcls }, ga);
    sv('rect', { x: gt.cx + gt.half - 4 - gt.pillarW, y: gt.beamY + gt.beamH, width: gt.pillarW, height: gt.bottom - gt.beamY - gt.beamH, class: gcls }, ga);
    sline(ga, [gt.cx - gt.half - 6, gt.bottom, gt.cx + gt.half + 6, gt.bottom], 'd-gate-floor');
    stext(ga, gt.label.x, gt.label.y, '確かめる', 'd-title', fs.title, gt.label.anchor);
    stext(ga, gt.cmd.x, gt.cmd.y, './init.sh', 'd-mono', fs.tiny, gt.cmd.anchor);
    const v = loaded.verification;
    const lines = ran
      ? [['制作担当が実行', 'd-title'], [`✓ ${v.queries.length}問 一致`, 'd-check'], [`✓ 不正入力${v.negative_controls.length}件を拒否`, 'd-check']]
      : [['まだ実行していない', 'd-muted']];
    lines.forEach(([text, cls], i) => stext(ga, gt.text.x, gt.text.y + i * gt.text.lh, text, cls, i === 0 ? fs.label : fs.small, gt.text.anchor));

    // ファイルに残す（フォルダー）
    const fd = L.folder;
    sv('rect', { x: fd.x, y: fd.y, width: fd.tab, height: fd.tabH + 4, rx: 4, class: 'd-folder-back' }, root);
    sv('rect', { x: fd.x, y: fd.y + fd.tabH, width: fd.w, height: fd.h - fd.tabH, rx: 7, class: 'd-folder-back' }, root);
    stext(root, fd.label.x, fd.label.y + (fd.tabH - 14) / 2, 'ファイルに残す', 'd-folder-tab-text', fs.small - 0.5);
    const fp = fd.papers;
    STATE_FILES.forEach((file, i) => {
      const a = slink(root, snapUrl(snap, file), `${ROLE[file]}（${snap === 'resume' ? '再開後' : '実装後'}の ${file}）を開く`);
      paper(a, fp.xs[i], fp.y, fp.w, fp.h, `d-mini${resumed ? ' is-lit' : ''}`);
      glyph(a, file, fp.xs[i] + fp.w / 2, fp.y + fp.h / 2 + 1, fp.w * 0.62);
    });
    [['check', PATH.verification, '検証の記録（verification.json）を開く'], ['search', recordUrl(q.id), `${q.id} の保存記録を開く`]].forEach(([g, href, label], k) => {
      const px = fp.xs[3 + k];
      if (ran) {
        const a = slink(root, href, label);
        paper(a, px, fp.y, fp.w, fp.h, 'd-mini');
        glyph(a, g, px + fp.w / 2, fp.y + fp.h / 2 + 1, fp.w * 0.62);
      } else {
        sv('rect', { x: px, y: fp.y, width: fp.w, height: fp.h, rx: 2, class: 'd-mini is-ghost' }, root);
      }
    });
    stext(root, fd.caps[0].x, fd.caps[0].y, '状態3つ', 'd-title', fs.small, 'middle');
    stext(root, fd.caps[1].x, fd.caps[1].y, '実行の記録', ran ? 'd-title' : 'd-muted', fs.small, 'middle');

    // 待機（feat-002 は未着手のまま）
    const tr = L.tray;
    sv('rect', { x: tr.x, y: tr.y, width: tr.w, height: tr.h, rx: 8, class: 'd-tray' }, root);
    stext(root, tr.label.x, tr.label.y, '待機', 'd-muted', fs.small);
    taskCard(slink(root, snapUrl(snap, 'feature_list.json'), `feat-002 ${sess.f2.name}：${STATUS_TEXT[sess.f2.status]}`), tr.card, sess.f2, L, { parked: true, nameSize: fs.small });

    // 新しいセッション
    if (resumed) {
      taskCard(slink(root, snapUrl('resume', 'feature_list.json'), `feat-001 ${sess.f1.name}：${STATUS_TEXT[sess.f1.status]}（再開後の feature_list.json）`), L.card2, sess.f1, L);
      const sd = L.side;
      const sa = slink(root, snapUrl('resume', 'session-handoff.md'), '再開後の session-handoff.md を開く：更新は3ファイルだけ');
      stext(sa, sd.cap.x, sd.cap.y, '更新は3つだけ', 'd-title', fs.small, sd.cap.anchor);
      STATE_FILES.forEach((file, i) => {
        paper(sa, sd.glyphs[i], sd.gy, sd.gw, sd.gh, 'd-mini is-lit');
        glyph(sa, file, sd.glyphs[i] + sd.gw / 2, sd.gy + sd.gh / 2 + 1, sd.gw * 0.62);
      });
      stext(sa, sd.foot.x, sd.foot.y, 'コードは変えず', 'd-muted', fs.small, sd.foot.anchor);
    } else {
      ghostCard(root, L.card2, 'まだ', L);
    }

    desc.textContent = describe(q, sess);
  }

  function describe(q, sess) {
    const v = loaded.verification;
    const ids = q.output.result_ids.length ? q.output.result_ids.join('・') : '0件';
    const head = {
      implementation: `実装後：実装のセッションが終わった時点。feat-001 は${STATUS_TEXT[sess.f1.status]}（実装済み・未検証）、feat-002 は${STATUS_TEXT[sess.f2.status]}。検証はまだ実行していない。`,
      verification: `検証：制作担当が ./init.sh を実行し、${v.queries.length}問が一致、不正入力${v.negative_controls.length}件を正しく拒否。状態ファイルはまだ feat-001 ${STATUS_TEXT[sess.f1.status]}。`,
      resume: `再開後：新しいセッションが保存された根拠を読み、状態ファイル3つだけを更新。feat-001 は${STATUS_TEXT[sess.f1.status]}、feat-002 は${STATUS_TEXT[sess.f2.status]}のまま。`,
    }[stage];
    return `${head}選んだ保存記録 ${q.id}（${q.label}）の結果：${ids}。`;
  }

  // ---------- 選んだ記録 ----------

  const selectedQuery = () => loaded && loaded.run.queries.find((q) => q.id === selectedId);
  const showText = (s) => (s === '' ? '（空）' : `「${s}」`);

  function renderRecord(q) {
    const out = q.output;
    recordSum.textContent = `（${q.id}）`;
    recordTitle.textContent = `${q.id}　${q.label}`;
    const spaceNote = /　/.test(out.query) ? '（全角空白を含む）' : '';
    const rows = [
      ['query', `${showText(out.query)}${spaceNote}`],
      ['tag', showText(out.tag)],
      ['tokens', out.tokens.length ? out.tokens.join('・') : 'なし（語の条件なし）'],
      ['result_ids', out.result_ids.length ? out.result_ids.join('・') : 'なし'],
      ['件数', `${out.results.length}件`],
      ['status', q.status],
    ];
    recordFields.replaceChildren(...rows.flatMap(([k, val]) => [el('dt', '', k), el('dd', '', val)]));
    recordEmpty.hidden = out.results.length !== 0;
    recordEmpty.textContent = out.results.length === 0 ? '保存記録は0件です。期待IDも空で、該当なしが正しい結果です。' : '';
    recordResults.replaceChildren(...out.results.map((note) => {
      const li = el('li', 'rr');
      const head = el('p', 'rr-head');
      head.append(el('span', 'rr-id', note.id), el('strong', '', note.title));
      const src = el('p', 'rr-meta');
      src.append('source：', link(projectUrl(note.source), note.source, ''));
      li.append(head, el('p', 'note-tags', `タグ：${note.tags.join('・')}`), el('p', 'rr-body', note.body), src, el('p', 'rr-meta', `source_sha256：${note.source_sha256}`));
      return li;
    }));
    recordFile.href = recordUrl(q.id);
    recordFile.textContent = `${q.id}.json を開く`;
    recordCompare.href = `comparison.html#${q.id}`;
  }

  function renderSelection() {
    const q = selectedQuery();
    for (const btn of queryBtns) btn.setAttribute('aria-pressed', String(btn.dataset.q === selectedId));
    for (const btn of pickerList.querySelectorAll('.pick')) btn.setAttribute('aria-pressed', String(btn.dataset.q === selectedId));
    pickerCurrent.textContent = `（選択中：${selectedId}）`;
    compareLink.href = `comparison.html#${selectedId}`;
    navCompare.href = `comparison.html#${selectedId}`;
    downloadBtn.textContent = `${selectedId}の記録を保存`;
    if (!q) return;
    renderRecord(q);
    downloadStatus.textContent = '';
  }

  function selectQuery(id, { fromHash = false } = {}) {
    if (!QUERY_IDS.includes(id)) return;
    selectedId = id;
    if (!fromHash && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    renderSelection();
    if (!loaded) return;
    const q = selectedQuery();
    queryInput.value = q.input.query;
    tagSelect.value = q.input.tag;
    if (tagSelect.value !== q.input.tag) tagSelect.value = '';
    runLive();
    drawDiagram();
  }

  function setStage(next) {
    if (!STAGES.includes(next)) return;
    stage = next;
    for (const btn of stageBtns) btn.setAttribute('aria-pressed', String(btn.dataset.stage === stage));
    if (loaded) drawDiagram();
  }

  function renderPicker() {
    pickerList.replaceChildren(...loaded.run.queries.map((q) => {
      const li = el('li');
      const btn = el('button', 'pick');
      btn.type = 'button';
      btn.dataset.q = q.id;
      btn.setAttribute('aria-pressed', String(q.id === selectedId));
      btn.append(el('span', 'pick-id', q.id), el('span', 'pick-count', `${q.output.result_ids.length}件`), el('span', '', `${q.label}　${querySummary(q.input)}`));
      btn.addEventListener('click', () => selectQuery(q.id));
      li.append(btn);
      return li;
    }));
  }

  function downloadRecord() {
    const q = selectedQuery();
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
    downloadStatus.textContent = `${name} の保存を要求しました。保存されたかはブラウザーの表示で確かめてください。`;
  }

  // ---------- ブラウザー内の検索 ----------

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
    const head = el('p', 'note-head');
    const title = el('strong', '');
    markedText(title, note.title, tokens);
    head.append(el('span', 'note-id', note.id), title);
    const tags = el('p', 'note-tags');
    tags.append('タグ：');
    const tagKey = normalize(tag).trim();
    note.tags.forEach((t, i) => {
      if (i > 0) tags.append('・');
      tags.append(tagKey !== '' && normalize(t).trim() === tagKey ? el('mark', '', t) : t);
    });
    const body = el('p', 'note-body');
    markedText(body, note.body, tokens);
    li.append(head, tags, body, link(projectUrl(note.source), `元のメモ ${note.source}`));
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
    count.textContent = `ブラウザー内の検索 ${results.length}件／全${loaded.index.notes.length}件（${words}、${tagText}）`;
    empty.hidden = results.length !== 0;
    notesList.replaceChildren(...results.map((note) => noteCard(note, tokens, tag)));
    renderRelation();
  }

  function renderRelation() {
    const q = selectedQuery();
    if (!q || !lastLive) return;
    const savedIds = q.output.result_ids;
    const idText = (ids) => (ids.length ? ids.join('・') : '0件');
    if (lastLive.query === q.input.query && lastLive.tag === q.input.tag) {
      relation.textContent = same(lastLive.ids, savedIds)
        ? `${q.id} と同じ条件です。ブラウザー内の検索（${idText(lastLive.ids)}）も保存記録と一致します。`
        : `${q.id} と同じ条件ですが、ブラウザー内の検索（${idText(lastLive.ids)}）は保存記録（${idText(savedIds)}）と違います。図と保存ボタンは保存記録のままです。`;
    } else {
      relation.textContent = `${q.id} の条件から変えた検索です。図と保存ボタンは ${q.id} の保存記録（${idText(savedIds)}）のままです。`;
    }
  }

  function fillTags(notes) {
    const tags = [...new Set(notes.flatMap((n) => n.tags))].sort();
    const first = el('option', '', 'すべてのタグ');
    first.value = '';
    tagSelect.replaceChildren(first, ...tags.map((t) => {
      const option = el('option', '', t);
      option.value = t;
      return option;
    }));
  }

  // ---------- 折りたたみの中身 ----------

  function renderFolds() {
    const { created, verification, run, sessions, index } = loaded;
    createdCommand.textContent = `${created.command}（終了コード ${created.exit_code}）`;
    filesList.replaceChildren(...CREATED_FILES.map((name) => {
      const li = el('li', 'file-item');
      const head = el('p', 'rr-head');
      head.append(el('span', 'file-role', ROLE[name]), el('span', 'file-name', name));
      const kept = name === 'init.sh' ? '生成時のまま使用' : '実装のセッションが課題用に書き換え';
      const row = el('p', 'link-row');
      row.append(link(scaffoldUrl(name), '生成時の原本'), link(projectUrl(name), '最終の project/ 版'));
      li.append(head, el('p', 'hint', kept), row, el('span', 'file-sha', `生成時 SHA-256 ${created.created_files_sha256[name]}`));
      return li;
    }));

    const sessionBox = (key, title, note) => {
      const s = sessions[key];
      const box = el('section', 'session');
      box.append(el('h3', '', title), el('p', 'hint', note));
      const ul = el('ul');
      ul.append(el('li', '', `feat-001 ${s.f1.name}：${STATUS_TEXT[s.f1.status]}`), el('li', '', `feat-002 ${s.f2.name}：${STATUS_TEXT[s.f2.status]}`));
      box.append(ul, el('p', 'evidence', `feat-001 の証拠欄：${s.f1.evidence}`));
      const row = el('p', 'link-row');
      for (const name of STATE_FILES) row.append(link(snapUrl(key, name), name));
      box.append(row);
      return box;
    };
    sessionsList.replaceChildren(
      sessionBox('implementation', '実装のセッションの終わり', 'Opus のセッションがコード・検証スクリプト・文書を書き、雛形の4ファイルを書き換えた。シェルは実行していない。'),
      sessionBox('resume', '新しいセッションの終わり', '別の新しい Opus のセッションが保存ファイルと検証の記録を読み、この3ファイルだけを更新した。自分では実行していない。'),
    );
    sessionsCheck.textContent = 'このページで確かめたこと：3ファイルが実装後と再開後で異なる。project/ の3ファイルは再開後の写しと同じバイト列。init.sh は生成時のまま。feature_list.json の中身は実行記録の2つの状態と一致。';

    const v = run.verification;
    const rows = [
      ['実行した人', '制作担当（AIのセッションではない）'],
      ['コマンド', `${v.command}（中身は node scripts/verify.mjs）`],
      ['終了コード', String(v.exit_code)],
      ['メモ', `${verification.note_count}件を入力ファイルと照合`],
      ['検索', `${verification.query_count}問すべて期待IDと全項目が一致`],
      ['不正な入力', `${verification.negative_controls.length}件すべて正しく拒否`],
      ['入力の一致', `検証の前後で入力が変わらず（source_integrity: ${verification.source_integrity}）`],
    ];
    verifyFields.replaceChildren(...rows.flatMap(([k, val]) => [el('dt', '', k), el('dd', '', val)]));
    verifyQueries.replaceChildren(...verification.queries.map((vq, i) => {
      const li = el('li');
      li.append(el('span', 'mini-id', vq.id), el('span', '', run.queries[i].label), el('span', '', vq.actual_ids.length ? vq.actual_ids.join('・') : '0件'), el('span', 'mini-ok', '✓ 一致'));
      return li;
    }));
    verifyControls.replaceChildren(...verification.negative_controls.map((c) => {
      const li = el('li');
      li.append(el('span', 'mini-id', c.id), el('span', '', c.label.replace(/^意図的な失敗：/, '')), el('span', '', `終了コード ${c.exit_code}`), el('span', 'mini-ok', '✓ 正しく拒否'));
      return li;
    }));

    inputsList.replaceChildren(...index.notes.map((note) => {
      const li = el('li', 'input-item');
      const head = el('p', 'rr-head');
      head.append(el('span', 'rr-id', note.id), el('strong', '', note.title));
      li.append(head, el('p', 'note-tags', `タグ：${note.tags.join('・')}`), el('p', 'rr-body', note.body), link(noteUrl(note.id), `元のメモ ${noteUrl(note.id)}`));
      return li;
    }));
  }

  // ---------- 読み込み ----------

  function setControls(enabled) {
    for (const btn of [...stageBtns, ...queryBtns, queryInput, tagSelect, applyBtn, resetBtn, downloadBtn]) btn.disabled = !enabled;
  }

  function clearOutputs() {
    loaded = null;
    lastLive = null;
    document.body.classList.remove('is-ready');
    setControls(false);
    drawDiagram();
    desc.textContent = '';
    pickerList.replaceChildren();
    recordFields.replaceChildren();
    recordResults.replaceChildren();
    recordEmpty.hidden = true;
    count.textContent = '';
    empty.hidden = true;
    relation.textContent = '';
    notesList.replaceChildren();
    filesList.replaceChildren();
    sessionsList.replaceChildren();
    verifyFields.replaceChildren();
    verifyQueries.replaceChildren();
    verifyControls.replaceChildren();
    inputsList.replaceChildren();
    downloadStatus.textContent = '';
  }

  function load() {
    generation += 1;
    const mine = generation;
    if (controller) controller.abort();
    controller = new AbortController();
    const { signal } = controller;
    clearOutputs();
    retry.disabled = true;
    loadError.hidden = true;
    loadPanel.dataset.state = 'loading';
    loadStatus.textContent = '保存した実行記録を読み込み、照合しています…';
    return fetchAll(signal)
      .then((data) => {
        if (mine !== generation) return;
        loaded = data;
        fillTags(data.index.notes);
        renderPicker();
        renderFolds();
        setControls(true);
        document.body.classList.add('is-ready');
        loadPanel.dataset.state = 'ready';
        loadStatus.textContent = '入力・実行記録・状態ファイルの一致を確認しました。';
        setStage(stage);
        selectQuery(selectedId, { fromHash: true });
      })
      .catch((err) => {
        if (mine !== generation || (err && err.name === 'AbortError')) return;
        clearOutputs();
        loadPanel.dataset.state = 'error';
        loadStatus.textContent = '記録を表示できません。';
        loadErrorText.textContent = err instanceof Error ? err.message : '読み込みに失敗しました';
        loadError.hidden = false;
      })
      .finally(() => {
        if (mine === generation) retry.disabled = false;
      });
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

  // ---------- 操作 ----------

  for (const btn of stageBtns) btn.addEventListener('click', () => setStage(btn.dataset.stage));
  for (const btn of queryBtns) btn.addEventListener('click', () => selectQuery(btn.dataset.q));
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
    if (QUERY_IDS.includes(id)) selectQuery(id, { fromHash: true });
  });
  if (wideMq.addEventListener) wideMq.addEventListener('change', drawDiagram);
  else wideMq.addListener(drawDiagram);
  retry.addEventListener('click', () => { load(); });
  downloadBtn.addEventListener('click', downloadRecord);
  copyBtn.addEventListener('click', () => { copyRequest(); });
  requestRetry.addEventListener('click', () => { loadRequest(); });

  renderSelection();
  load();
  loadRequest();
})();
