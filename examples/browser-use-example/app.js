// Browser Use作例「手順を、ブラウザーの操作へ」— 保存済みの実行記録を一枚の概念図で読むページ。
// このページではPython・Browser Use・AIは動かない。concept/manifest.json（固定したSHA-256）に載った
// 18ファイルのバイト数とSHA-256を確かめ、中身を互いに照合してから図・保存・コピーを有効にする。
// Copyright (c) 2026 Studio Yebisu. MIT License.
'use strict';

(() => {
  const PIN = '98fa56dccf5aec3d1c24ad24d05145b799fd42e72a148700b389360b4272c3c3';
  const MANIFEST_URL = 'concept/manifest.json';
  const CASE_ID = 'browser-use-example';
  const COMMIT = 'c75e8476e26d18b7617643bc2ae082fae8eae431';
  const VERSION = '0.13.11';
  const ASSET_PATHS = [
    'concept/structure.json', 'brief.json', 'request.txt', 'run_browser.py',
    'input/workspaces.json', 'input/scenarios.json',
    'outputs/browser-run.json', 'outputs/browser-selection.json', 'outputs/method.md',
    'samples.json', 'fixture.html', 'fixture.js',
    'vendor/browser-use/README.md', 'vendor/browser-use/LICENSE',
    'vendor/browser-use/skills/open-source/SKILL.md',
    'vendor/browser-use/skills/open-source/references/actor.md',
    'vendor/browser-use/skills/open-source/references/browser.md',
    'verification.json',
  ];
  const SKILL_PATH = 'vendor/browser-use/skills/open-source/SKILL.md';
  const SELECTION_PATH = 'outputs/browser-selection.json';
  const PART_IDS = ['skill', 'browser', 'page', 'actions', 'output'];
  const IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
  const COUNTS = [12, 12, 4, 2, 0, 12];
  const ACTION_TOTALS = { fill: 2, select_option: 2, check: 2, click: 5 };
  const APIS = ['fill', 'select_option', 'check', 'click'];
  const CALLS = { fill: 'Element.fill', select_option: 'Element.select_option', check: 'Element.check', click: 'Element.click' };
  const DEFAULTS = { keyword: '', area: '', budget: '', saturday: false, power: false };
  const SELECTION_FORMAT = 'studio-yebisu-browser-selection-v1';
  const DEFAULT_ID = 'S04';
  const STAGES = ['guide', 'drive', 'receive'];
  const THEME_KEY = 'studio-yebisu.browser-use-example.theme';
  const NS = 'http://www.w3.org/2000/svg';

  const $ = (id) => document.getElementById(id);
  const svg = $('diagram');
  const diaTitle = $('dia-title');
  const diaDesc = $('dia-desc');
  const diaStatus = $('dia-status');
  const loadError = $('load-error');
  const loadErrorText = $('load-error-text');
  const retryBtn = $('retry');
  const caption = $('dia-caption');
  const saveBtn = $('save');
  const replayBtn = $('replay');
  const saveState = $('save-state');
  const stageBtns = [...document.querySelectorAll('.stage')];
  const stateList = $('state-list');
  const deskLink = $('desk-link');
  const originalLink = $('original-link');
  const detail = $('detail');
  const detailNote = $('detail-note');
  const detailActions = $('detail-actions');
  const detailConditions = $('detail-conditions');
  const detailCheck = $('detail-check');
  const detailCountTitle = $('detail-count-title');
  const detailEmpty = $('detail-empty');
  const detailResults = $('detail-results');
  const shotLink = $('shot-link');
  const shotImg = $('shot-img');
  const shotLinks = $('shot-links');
  const partsSection = $('parts');
  const partList = $('part-list');
  const partPanel = $('part-panel');
  const scopeBox = $('scope-box');
  const scopeList = $('scope-list');
  const requestText = $('request-text');
  const copyBtn = $('copy');
  const copyState = $('copy-state');
  const techState = $('tech-state');
  const techList = $('tech-list');

  const wideQuery = window.matchMedia('(orientation: landscape) and (min-width: 700px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const view = { data: null, stage: 'guide', scenario: DEFAULT_ID, part: '', layout: '' };
  let refs = null;
  let loadToken = 0;
  let anim = 0;

  // ---------- 表示の色（自分のキーだけを保存し、保存できない環境でも切り替える） ----------
  const themeBtns = [...document.querySelectorAll('[data-theme-choice]')];
  function applyTheme(choice, persist) {
    const value = ['system', 'light', 'dark'].includes(choice) ? choice : 'system';
    document.documentElement.dataset.theme = value;
    for (const b of themeBtns) b.setAttribute('aria-pressed', String(b.dataset.themeChoice === value));
    if (persist) {
      try { localStorage.setItem(THEME_KEY, value); } catch { /* 保存できなくても表示は切り替わる */ }
    }
  }
  let savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch { savedTheme = null; }
  applyTheme(savedTheme, false);
  for (const b of themeBtns) b.addEventListener('click', () => applyTheme(b.dataset.themeChoice, true));

  // ---------- 取得と照合 ----------
  class Fail extends Error {}
  const fail = (message) => { throw new Fail(message); };

  async function fetchBytes(path) {
    let response;
    try {
      response = await fetch(path, { cache: 'no-store' });
    } catch {
      fail(`${path} を取得できません（通信エラー）`);
    }
    if (!response.ok) fail(`${path} を取得できません（HTTP ${response.status}）`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async function sha256(bytes) {
    if (!(window.crypto && crypto.subtle)) fail('この環境ではSHA-256を計算できないため、ファイルを照合できません');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  function asText(bytes, path) {
    try { return decoder.decode(bytes); } catch { return fail(`${path} がUTF-8として読めません`); }
  }
  function asJson(bytes, path) {
    const source = asText(bytes, path);
    try { return JSON.parse(source); } catch { return fail(`${path} がJSONとして読めません`); }
  }

  function same(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
  }

  async function loadAssets() {
    const manifestBytes = await fetchBytes(MANIFEST_URL);
    if ((await sha256(manifestBytes)) !== PIN) fail('concept/manifest.json が固定したSHA-256と一致しません');
    const manifest = asJson(manifestBytes, MANIFEST_URL);
    if (manifest.format !== 'studio-yebisu-assets/v1' || manifest.case_id !== CASE_ID || manifest.source_commit !== COMMIT) {
      fail('concept/manifest.json の形式・作例ID・固定コミットが想定と違います');
    }
    if (!Array.isArray(manifest.files) || manifest.files.map((f) => f && f.path).join('\n') !== ASSET_PATHS.join('\n')) {
      fail('素材の一覧が、想定した18ファイルと違います');
    }
    const files = {};
    await Promise.all(manifest.files.map(async (f) => {
      if (!Number.isInteger(f.bytes) || f.bytes <= 0 || typeof f.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256)) {
        fail(`${f.path} の記録（大きさ・SHA-256）の形が違います`);
      }
      const bytes = await fetchBytes(f.path);
      if (bytes.byteLength !== f.bytes) fail(`${f.path} の大きさが記録と違います（${bytes.byteLength} / ${f.bytes} bytes）`);
      if ((await sha256(bytes)) !== f.sha256) fail(`${f.path} のSHA-256が記録と違います`);
      files[f.path] = bytes;
    }));
    return { manifest, files };
  }

  // fixture.js・run_browser.py と同じ決まり。キーワードは文字の一致で、設備の判定ではない。
  const normalize = (s) => s.normalize('NFKC').toLowerCase();
  function matches(item, cond) {
    const haystack = normalize([item.name, item.area, item.description].join(' '));
    const tokens = normalize(cond.keyword).split(/\s+/u).filter(Boolean);
    if (!tokens.every((t) => haystack.includes(t))) return false;
    if (cond.area && item.area !== cond.area) return false;
    if (cond.budget && item.hourly_yen > Number(cond.budget)) return false;
    if (cond.saturday && !item.saturday) return false;
    if (cond.power && !item.power) return false;
    return true;
  }

  // 1操作のあとのフォームと、適用中の条件（run_browser.py の advance と同じ）。
  function advance(form, applied, action) {
    const f = { ...form };
    let a = { ...applied };
    if (action.api === 'fill') f.keyword = action.value;
    else if (action.api === 'select_option') f[action.selector === '#area' ? 'area' : 'budget'] = action.value;
    else if (action.api === 'check') f[action.selector === '#saturday' ? 'saturday' : 'power'] = true;
    else if (action.selector === '#apply') a = { ...f };
    else return { form: { ...DEFAULTS }, applied: { ...DEFAULTS } };
    return { form: f, applied: a };
  }

  function parseRoutes(skill) {
    const routes = [];
    for (const line of skill.split(/\r?\n/)) {
      const m = /^\|\s*(.+?)\s*\|\s*`references\/([a-z-]+)\.md`\s*\|\s*$/.exec(line);
      if (m) routes.push({ topic: m[1], file: m[2] });
    }
    return routes;
  }

  function validate(manifest, files) {
    const sha = Object.fromEntries(manifest.files.map((f) => [f.path, f.sha256]));
    const st = asJson(files['concept/structure.json'], 'concept/structure.json');
    const ws = asJson(files['input/workspaces.json'], 'input/workspaces.json');
    const sc = asJson(files['input/scenarios.json'], 'input/scenarios.json');
    const run = asJson(files['outputs/browser-run.json'], 'outputs/browser-run.json');
    const sel = asJson(files[SELECTION_PATH], SELECTION_PATH);
    for (const p of ['brief.json', 'samples.json', 'verification.json']) asJson(files[p], p);
    const py = asText(files['run_browser.py'], 'run_browser.py');
    const skill = asText(files[SKILL_PATH], SKILL_PATH);
    const license = asText(files['vendor/browser-use/LICENSE'], 'vendor/browser-use/LICENSE');
    const request = asText(files['request.txt'], 'request.txt');
    for (const p of ['outputs/method.md', 'fixture.html', 'fixture.js', 'vendor/browser-use/README.md',
      'vendor/browser-use/skills/open-source/references/actor.md', 'vendor/browser-use/skills/open-source/references/browser.md']) asText(files[p], p);

    // 構成の説明
    if (st.format !== 'browser-use-structure/v1' || st.case_id !== CASE_ID || st.source_commit !== COMMIT || st.version !== VERSION) {
      fail('concept/structure.json の形式・版が想定と違います');
    }
    if (!Array.isArray(st.parts) || st.parts.map((p) => p && p.id).join() !== PART_IDS.join()) fail('5つの部品のIDが想定と違います');
    if (!Array.isArray(st.scenarios) || st.scenarios.map((s) => s && s.id).join() !== IDS.join()) fail('6状態のIDが想定と違います');
    if (st.default_id !== DEFAULT_ID) fail('初期表示の状態がS04ではありません');
    if (st.selection_path !== SELECTION_PATH || st.selection_bytes !== 3012 || st.selection_sha256 !== sha[SELECTION_PATH]) {
      fail('保存した原本（S04）の記録が固定値と違います');
    }
    const ex = st.actual_execution || {};
    if (ex.agent_run !== false || ex.llm_calls !== 0 || ex.actions !== 11 || ex.states !== 6 || ex.live_in_this_browser !== false) {
      fail('構成の説明の実行範囲が「操作11回・6状態・Agent.runなし・LLM 0回」ではありません');
    }
    if (!st.skill || !same(st.skill.selected_references, [
      'vendor/browser-use/skills/open-source/references/actor.md',
      'vendor/browser-use/skills/open-source/references/browser.md',
    ])) fail('参照スキルから選んだ文書がActorとBrowserの2つではありません');
    const sources = { 'run_browser.py': py, [SKILL_PATH]: skill };
    for (const p of st.parts) {
      const src = sources[p.source_path];
      if (src === undefined) fail(`${p.id} の原文の場所が照合済みのファイルではありません`);
      const line = src.split(/\r?\n/)[p.line_start - 1];
      if (typeof p.quote !== 'string' || !p.quote || typeof line !== 'string' || !line.includes(p.quote)) {
        fail(`${p.id} の引用が ${p.source_path} の${p.line_start}行目にありません`);
      }
    }
    const routes = parseRoutes(skill);
    const routeFiles = routes.map((r) => r.file);
    if (routes.length < 3 || !routeFiles.includes('actor') || !routeFiles.includes('browser')) fail('SKILL.md の話題の表から、ActorとBrowserの行を読めません');

    // 入力
    if (ws.format !== 'studio-yebisu-workspace-fixture-v1' || ws.fictional !== true || !Array.isArray(ws.items) || ws.items.length !== 12) {
      fail('input/workspaces.json が架空の作業席12件の形ではありません');
    }
    const items = new Map(ws.items.map((i) => [i && i.id, i]));
    if (items.size !== 12) fail('input/workspaces.json のIDが重複しています');
    if (sc.format !== 'studio-yebisu-browser-scenarios-v1' || !Array.isArray(sc.scenarios) || sc.scenarios.map((s) => s && s.id).join() !== IDS.join()) {
      fail('input/scenarios.json がS01〜S06の手順の形ではありません');
    }

    // 実行記録
    if (run.format !== 'studio-yebisu-browser-run-v1' || run.fictional !== true) fail('outputs/browser-run.json の形式が想定と違います');
    const src = run.source || {};
    if (src.repository !== 'browser-use/browser-use' || src.commit !== COMMIT || src.distribution_version !== VERSION || src.license !== 'MIT') {
      fail('実行記録の原典（リポジトリ・固定コミット・版・ライセンス）が想定と違います');
    }
    const ih = run.inputs_sha256 || {};
    if (ih['input/workspaces.json'] !== sha['input/workspaces.json'] || ih['input/scenarios.json'] !== sha['input/scenarios.json']) {
      fail('実行記録の入力SHA-256が、照合した入力と一致しません');
    }
    if (!run.scope || run.scope.agent_run !== false || run.scope.llm_calls !== 0) fail('実行記録の範囲が「Agent.runなし・LLM呼び出し0」ではありません');
    const rt = run.runtime || {};
    if (rt.agent_run !== false || rt.llm_calls !== 0 || rt.llm_constructed !== false || rt.browser_use !== VERSION) {
      fail('実行時の記録が「browser-use 0.13.11・LLMなし」ではありません');
    }
    if (!same(rt.action_success_counts, ACTION_TOTALS)) fail('成功した操作の内訳が fill2・select_option2・check2・click5 ではありません');
    if (!Array.isArray(run.scenarios) || run.scenarios.map((s) => s && s.id).join() !== IDS.join()) fail('実行記録の状態がS01〜S06ではありません');

    let form = { ...DEFAULTS };
    let applied = { ...DEFAULTS };
    let total = 0;
    run.scenarios.forEach((s, i) => {
      const input = sc.scenarios[i];
      const card = st.scenarios[i];
      if (!Array.isArray(s.actions) || !Array.isArray(input.actions) || s.actions.length !== input.actions.length) fail(`${s.id} の操作の数が手順の入力と違います`);
      s.actions.forEach((a, j) => {
        const want = input.actions[j];
        if (!APIS.includes(a.api) || a.api !== want.api || a.selector !== want.selector || a.call !== CALLS[want.api] || (a.value ?? null) !== (want.value ?? null)) {
          fail(`${s.id} の操作${j + 1}が手順の入力と違います`);
        }
        ({ form, applied } = advance(form, applied, a));
        total += 1;
      });
      if (!same(s.conditions, form)) fail(`${s.id} の読み取った条件が、手順から求めた条件と違います`);
      if (!Array.isArray(s.results) || s.result_count !== s.results.length || s.result_count !== COUNTS[i]) fail(`${s.id} の件数が想定（${COUNTS[i]}件）と違います`);
      for (const r of s.results) {
        const it = r && items.get(r.id);
        if (!it || r.name !== it.name || r.area !== it.area || r.hourly_yen !== it.hourly_yen || r.saturday !== it.saturday || r.power !== it.power || r.description !== it.description) {
          fail(`${s.id} の結果 ${r && r.id} が入力の作業席と一致しません`);
        }
      }
      const ids = s.results.map((r) => r.id);
      const computed = ws.items.filter((it) => matches(it, applied)).map((it) => it.id);
      if (ids.join() !== computed.join()) fail(`${s.id} の結果が、検索の決まりで入力から求めた並びと違います`);
      if (!same(s.expected_ids, input.expected_ids) || s.expected_ids.join() !== ids.join()) fail(`${s.id} の照合用の期待IDが結果と一致しません`);
      if (s.empty_visible !== (ids.length === 0) || s.count_text !== `該当 ${ids.length}件` || s.status !== 'passed') fail(`${s.id} の件数表示・該当なしの表示が結果と合いません`);
      const shot = s.screenshot || {};
      if (shot.src !== `captures/${s.id}.png` || shot.width !== 1280 || shot.height !== 900 || !/^[0-9a-f]{64}$/.test(shot.sha256 || '')) fail(`${s.id} の画像の記録が想定と違います`);
      if (!card || card.result_count !== s.result_count || !same(card.result_ids, ids) || !same(card.conditions, s.conditions)
        || !card.screenshot || card.screenshot.sha256 !== shot.sha256 || card.empty_visible !== s.empty_visible) {
        fail(`${s.id} の構成の説明が実行記録と一致しません`);
      }
    });
    if (total !== 11) fail('操作の合計が11回ではありません');

    const s04 = run.scenarios[IDS.indexOf(DEFAULT_ID)];
    const rebuilt = { format: SELECTION_FORMAT, source: run.source, inputs_sha256: run.inputs_sha256, scope: run.scope, selected: s04 };
    if (!same(sel, rebuilt)) fail('保存した原本（S04）が、実行記録のS04と一致しません');
    if (!license.includes('MIT License') || !license.includes('Copyright (c) 2024 Gregor Zunic')) fail('Browser UseのLICENSEがMIT（Gregor Zunic）ではありません');

    return { manifest, files, st, ws, sc, run, sel, items, routes, request };
  }

  // ---------- 図（SVG） ----------
  const LAYOUTS = {
    portrait: {
      vb: [360, 540],
      book: { x: 8, y: 10, w: 116, h: 94 },
      ghost: { x: 8, y: 114, w: 162, h: 18 },
      py: { x: 150, y: 14, w: 92, h: 86 },
      steps: { x: 256, y: 10, w: 96, h: 90 },
      set: { x: 256, y: 106, w: 96, h: 16 },
      frame: { x: 8, y: 142 },
      rec: { x: 8, y: 442 },
      out: { x: 276, y: 442 },
      others: null,
      flow: 'v',
    },
    wide: {
      vb: [760, 424],
      book: { x: 16, y: 34, w: 150, h: 120 },
      ghost: { x: 16, y: 168, w: 150, h: 20 },
      py: { x: 214, y: 40, w: 104, h: 112 },
      steps: { x: 196, y: 190, w: 140, h: 104 },
      set: { x: 16, y: 232, w: 150, h: 20 },
      frame: { x: 396, y: 16 },
      rec: { x: 396, y: 322 },
      out: { x: 664, y: 322 },
      others: { x: 16, y: 280 },
      flow: 'h',
    },
  };

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined && v !== null) node.setAttribute(k, String(v));
    if (parent) parent.append(node);
    return node;
  }
  function txt(parent, x, y, value, cls, extra) {
    const node = el('text', { x, y, class: cls, ...(extra || {}) }, parent);
    node.textContent = value;
    return node;
  }
  function curve(a, b, dir) {
    if (dir === 'v') {
      const my = (a.y + b.y) / 2;
      return `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
    }
    const mx = (a.x + b.x) / 2;
    return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
  }

  function clearDiagram() {
    stopAnim();
    svg.replaceChildren(diaTitle, diaDesc);
    svg.removeAttribute('viewBox');
    svg.classList.add('is-empty');
    refs = null;
  }

  function buildDiagram() {
    const d = view.data;
    const L = LAYOUTS[view.layout];
    stopAnim();
    svg.replaceChildren(diaTitle, diaDesc);
    svg.classList.remove('is-empty');
    svg.setAttribute('viewBox', `0 0 ${L.vb[0]} ${L.vb[1]}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const r = { el: {}, chips: {}, tokens: [], folders: {}, links: {} };

    const defs = el('defs', {}, svg);
    for (const [id, cls] of [['bu-ah', 'd-head'], ['bu-ah-read', 'd-head-read']]) {
      const m = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0 0 L10 5 L0 10 Z', class: cls }, m);
    }

    const B = L.book, P = L.py, S = L.steps, T = L.set, G = L.ghost;
    const fx = L.frame.x, fy = L.frame.y, R = L.rec, O = L.out;
    const links = el('g', {}, svg);
    const link = (id, a, b, dir, stage, read) => {
      const p = el('path', { id: `bu-${id}`, d: curve(a, b, dir), class: read ? 'd-link-read' : 'd-link', 'marker-end': `url(#${read ? 'bu-ah-read' : 'bu-ah'})`, 'data-in': stage }, links);
      r.links[id] = p;
      return p;
    };

    // 手引き（参照スキル）：表の行を栞にし、今回読んだActorとBrowserだけを引き出す
    const gSkill = el('g', { 'data-in': 'guide' }, svg);
    const half = B.w / 2;
    el('rect', { x: B.x, y: B.y, width: half, height: B.h, rx: 3, class: 'd-paper' }, gSkill);
    el('rect', { x: B.x + half, y: B.y, width: half, height: B.h, rx: 3, class: 'd-paper' }, gSkill);
    txt(gSkill, B.x + 7, B.y + 15, 'SKILL.md', 't-m t-mut');
    txt(gSkill, B.x + 7, B.y + 35, '手引き', 't-h');
    txt(gSkill, B.x + 7, B.y + 51, '参照スキル', 't-xs t-mut');
    txt(gSkill, B.x + 7, B.y + 63, 'Python用', 't-xs t-mut');
    const rx = B.x + half;
    const chosen = d.routes.map((rt) => rt.file === 'actor' || rt.file === 'browser');
    const heights = chosen.map((c) => (c ? 14 : 3));
    const avail = B.h - 14;
    const gap = (avail - heights.reduce((a, b) => a + b, 0)) / Math.max(1, d.routes.length - 1);
    let ry = B.y + 7;
    const anchors = {};
    d.routes.forEach((rt, i) => {
      if (chosen[i]) {
        el('rect', { x: rx + 4, y: ry, width: half + 6, height: 14, rx: 3, class: 'd-leaf-on' }, gSkill);
        txt(gSkill, rx + 8, ry + 10.5, rt.file === 'actor' ? 'Actor' : 'Browser', 't-b');
        anchors[rt.file] = { x: rx + half + 10, y: ry + 7 };
      } else {
        el('rect', { x: rx + 6, y: ry, width: half - 14, height: 3, rx: 1.5, class: 'd-leaf' }, gSkill);
      }
      ry += heights[i] + gap;
    });
    const ghost = el('g', { 'data-in': 'guide' }, svg);
    el('rect', { x: G.x, y: G.y, width: G.w, height: G.h, rx: 4, class: 'd-ghost' }, ghost);
    txt(ghost, G.x + 6, G.y + G.h * 0.7, 'Agent.run（LLM判断）は未実行', 't-xs t-mut');
    if (L.others) {
      const rest = d.routes.filter((rt) => rt.file !== 'actor' && rt.file !== 'browser').map((rt) => rt.file);
      const gO = el('g', { 'data-in': 'guide' }, svg);
      txt(gO, L.others.x, L.others.y, '手引きのほかの話題（今回は使わない）', 't-xs t-mut');
      for (let i = 0; i < rest.length; i += 3) txt(gO, L.others.x, L.others.y + 14 + (i / 3) * 12, rest.slice(i, i + 3).join('・'), 't-m t-mut');
    }

    // Python
    const gPy = el('g', { 'data-in': 'guide drive' }, svg);
    el('path', { d: `M${P.x} ${P.y} H${P.x + P.w - 12} L${P.x + P.w} ${P.y + 12} V${P.y + P.h} H${P.x} Z`, class: 'd-card' }, gPy);
    el('path', { d: `M${P.x + P.w - 12} ${P.y} V${P.y + 12} H${P.x + P.w}`, class: 'd-link' }, gPy);
    txt(gPy, P.x + 8, P.y + 20, 'Python', 't-h');
    ['Browser(…)', 'new_page(…)', 'element.fill'].forEach((s, i) => txt(gPy, P.x + 8, P.y + 34 + i * 12, s, 't-m t-pet'));
    txt(gPy, P.x + 8, P.y + P.h - 7, 'run_browser.py', 't-m t-mut');

    // 事前の手順とBrowser設定
    const gSteps = el('g', { 'data-in': 'drive' }, svg);
    el('rect', { x: S.x, y: S.y, width: S.w, height: S.h, rx: 6, class: 'd-card' }, gSteps);
    txt(gSteps, S.x + 7, S.y + 14, '事前の手順', 't-b');
    const chipGap = 3;
    const chipH = (S.h - 26 - chipGap * 3) / 4;
    APIS.forEach((api, i) => {
      const cy = S.y + 20 + i * (chipH + chipGap);
      const rect = el('rect', { x: S.x + 6, y: cy, width: S.w - 12, height: chipH, rx: chipH / 2, class: 'd-chip' }, gSteps);
      txt(gSteps, S.x + 12, cy + chipH * 0.5 + 3.2, `${api} ×${d.run.runtime.action_success_counts[api]}`, 't-xs');
      r.chips[api] = rect;
    });
    const gSet = el('g', { 'data-in': 'drive' }, svg);
    el('rect', { x: T.x, y: T.y, width: T.w, height: T.h, rx: T.h / 2, class: 'd-chip' }, gSet);
    txt(gSet, T.x + T.w / 2, T.y + T.h * 0.5 + 3.2, 'Browser設定', 't-xs', { 'text-anchor': 'middle' });

    // 手引き→Python、手順・設定→Python、Python→ブラウザー
    link('book-a', anchors.actor, { x: P.x, y: P.y + P.h * 0.42 }, 'h', 'guide');
    link('book-b', anchors.browser, { x: P.x, y: P.y + P.h * 0.6 }, 'h', 'guide');
    if (L.flow === 'v') {
      link('steps-py', { x: S.x, y: S.y + S.h * 0.45 }, { x: P.x + P.w, y: P.y + P.h * 0.4 }, 'h', 'drive');
      link('set-py', { x: T.x, y: T.y + T.h / 2 }, { x: P.x + P.w, y: P.y + P.h * 0.8 }, 'h', 'drive');
      link('py-frame', { x: P.x + P.w / 2, y: P.y + P.h }, { x: P.x + P.w / 2, y: fy }, 'v', 'drive');
    } else {
      link('steps-py', { x: S.x + S.w / 2, y: S.y }, { x: P.x + P.w / 2, y: P.y + P.h }, 'v', 'drive');
      link('set-py', { x: T.x + T.w * 0.75, y: T.y }, { x: P.x + 12, y: P.y + P.h }, 'v', 'drive');
      link('py-frame', { x: P.x + P.w, y: P.y + P.h / 2 }, { x: fx, y: P.y + P.h / 2 }, 'h', 'drive');
    }

    // Browser（BrowserSession）→ Page → Element
    const gFrame = el('g', { 'data-in': 'drive receive' }, svg);
    el('rect', { x: fx, y: fy, width: 344, height: 238, rx: 10, class: 'd-card' }, gFrame);
    for (const cx of [12, 22, 32]) el('circle', { cx: fx + cx, cy: fy + 11, r: 3, class: 'd-bar' }, gFrame);
    txt(gFrame, fx + 44, fy + 15, 'Browser', 't-b');
    txt(gFrame, fx + 94, fy + 15, '= BrowserSession', 't-m t-mut');
    el('rect', { x: fx + 8, y: fy + 28, width: 328, height: 202, rx: 6, class: 'd-paper' }, gFrame);
    txt(gFrame, fx + 16, fy + 42, 'Page', 't-b t-pet');
    txt(gFrame, fx + 46, fy + 42, 'fixture.html', 't-m t-mut');
    txt(gFrame, fx + 328, fy + 42, 'Element', 't-b t-amb', { 'text-anchor': 'end' });
    r.leader = el('path', { d: '', class: 'ring', 'stroke-dasharray': '2 2', 'stroke-width': 1 }, gFrame);

    const E = {
      '#search': { x: fx + 16, y: fy + 58, w: 150, h: 22 },
      '#area': { x: fx + 172, y: fy + 58, w: 74, h: 22 },
      '#budget': { x: fx + 252, y: fy + 58, w: 76, h: 22 },
      '#saturday': { x: fx + 14, y: fy + 96, w: 52, h: 22 },
      '#power': { x: fx + 70, y: fy + 96, w: 76, h: 22 },
      '#apply': { x: fx + 188, y: fy + 96, w: 70, h: 22 },
      '#reset': { x: fx + 264, y: fy + 96, w: 64, h: 22 },
    };
    const gEl = el('g', { 'data-in': 'drive receive' }, svg);
    for (const [sel, b] of Object.entries(E)) {
      const item = { ...b };
      if (sel === '#search' || sel === '#area' || sel === '#budget') {
        el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 4, class: 'd-field' }, gEl);
        item.value = txt(gEl, b.x + 6, b.y + 15, '', 't-s');
        if (sel !== '#search') txt(gEl, b.x + b.w - 7, b.y + 15, '▾', 't-xs t-mut', { 'text-anchor': 'end' });
      } else if (sel === '#saturday' || sel === '#power') {
        item.box = el('rect', { x: b.x + 2, y: b.y + 4, width: 14, height: 14, rx: 3, class: 'box-off' }, gEl);
        item.mark = el('path', { d: `M${b.x + 5} ${b.y + 11} l3 3 l6 -7`, class: 'check-mark', visibility: 'hidden' }, gEl);
        txt(gEl, b.x + 20, b.y + 15, sel === '#saturday' ? '土曜' : '電源あり', 't-s');
      } else if (sel === '#apply') {
        el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 11, class: 'd-btn' }, gEl);
        txt(gEl, b.x + b.w / 2, b.y + 15, '探す', 't-b t-inv', { 'text-anchor': 'middle' });
      } else {
        el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 11, class: 'd-btn-q' }, gEl);
        txt(gEl, b.x + b.w / 2, b.y + 15, 'リセット', 't-s t-pet', { 'text-anchor': 'middle' });
      }
      item.ring = el('rect', { x: b.x - 2, y: b.y - 2, width: b.w + 4, height: b.h + 4, rx: 6, class: 'ring', visibility: 'hidden' }, gEl);
      item.tag = txt(gEl, b.x, b.y - 3, '', 't-xs t-amb', { visibility: 'hidden' });
      r.el[sel] = item;
    }

    // 結果の席（実際の12件の並び）
    const gTok = el('g', { 'data-in': 'drive receive' }, svg);
    d.ws.items.forEach((it, i) => {
      const x = fx + 17 + (i % 6) * 53;
      const y = fy + 128 + Math.floor(i / 6) * 26;
      const g = el('g', { class: 'tok' }, gTok);
      el('rect', { x, y, width: 49, height: 22, rx: 4 }, g);
      txt(g, x + 24.5, y + 15, it.id, '', { 'text-anchor': 'middle' });
      if (!it.power) el('path', { d: `M${x + 40} ${y} H${x + 49} V${y + 9} Z`, class: 'tok-mark' }, g);
      r.tokens.push({ id: it.id, g });
    });
    r.empty = el('g', { visibility: 'hidden' }, gTok);
    el('rect', { x: fx + 16, y: fy + 128, width: 316, height: 48, rx: 6, class: 'empty-box' }, r.empty);
    txt(r.empty, fx + 174, fy + 156, '0件・該当なし（正常な結果）', 't-s', { 'text-anchor': 'middle' });
    r.count = txt(gTok, fx + 16, fy + 200, '', 't-big');
    el('path', { d: `M${fx + 254} ${fy + 192} H${fx + 262} V${fy + 200} Z`, class: 'tok-mark' }, gTok);
    txt(gTok, fx + 328, fy + 200, '説明に電源なし', 't-xs t-mut', { 'text-anchor': 'end' });

    // 読み取り：実DOMと画面PNG → 実行記録 → 保存JSON
    const dom = { x: fx + 16, y: fy + 256, w: 132, h: 30 };
    const png = { x: fx + 180, y: fy + 256, w: 132, h: 30 };
    link('page-dom', { x: dom.x + dom.w / 2, y: fy + 230 }, { x: dom.x + dom.w / 2, y: dom.y }, 'v', 'receive', true);
    link('page-png', { x: png.x + png.w / 2, y: fy + 230 }, { x: png.x + png.w / 2, y: png.y }, 'v', 'receive', true);
    link('dom-rec', { x: dom.x + dom.w / 2, y: dom.y + dom.h }, { x: dom.x + dom.w / 2, y: R.y + 10 }, 'v', 'receive', true);
    link('png-rec', { x: png.x + png.w / 2, y: png.y + png.h }, { x: R.x + 232, y: R.y + 10 }, 'v', 'receive', true);
    link('rec-out', { x: R.x + 252, y: R.y + 51 }, { x: O.x, y: O.y + 51 }, 'h', 'receive', true);
    const gRead = el('g', { 'data-in': 'receive' }, svg);
    for (const [b, main, api] of [[dom, '実DOMを読む', 'Page.evaluate'], [png, '画面PNG ×6', 'Page.screenshot']]) {
      el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 6, class: 'd-soft' }, gRead);
      txt(gRead, b.x + 8, b.y + 13, main, 't-b');
      txt(gRead, b.x + 8, b.y + 25, api, 't-m t-mut');
    }
    const gRec = el('g', { 'data-in': 'receive' }, svg);
    el('rect', { x: R.x, y: R.y + 10, width: 252, height: 82, rx: 6, class: 'd-card' }, gRec);
    el('rect', { x: R.x, y: R.y, width: 106, height: 15, rx: 3, class: 'd-card' }, gRec);
    txt(gRec, R.x + 6, R.y + 11, 'browser-run.json', 't-m');
    d.run.scenarios.forEach((s, i) => {
      const x = R.x + 8 + i * 41;
      const y = R.y + 22;
      const g = el('g', {}, gRec);
      const tab = el('rect', { x, y, width: 14, height: 8, rx: 2, class: 'folder' }, g);
      const body = el('rect', { x, y: y + 5, width: 36, height: 58, rx: 3, class: 'folder' }, g);
      txt(g, x + 18, y + 20, s.id, 't-xs', { 'text-anchor': 'middle' });
      txt(g, x + 18, y + 42, String(s.result_count), 't-big', { 'text-anchor': 'middle' });
      txt(g, x + 18, y + 55, '件', 't-xs t-mut', { 'text-anchor': 'middle' });
      r.folders[s.id] = [tab, body];
    });
    const gOut = el('g', { 'data-in': 'receive' }, svg);
    el('path', { d: `M${O.x} ${O.y} H${O.x + 64} L${O.x + 76} ${O.y + 12} V${O.y + 92} H${O.x} Z`, class: 'd-card' }, gOut);
    txt(gOut, O.x + 7, O.y + 14, '保存JSON', 't-xs t-mut');
    r.outId = txt(gOut, O.x + 7, O.y + 32, '', 't-h');
    r.outCount = txt(gOut, O.x + 7, O.y + 52, '', 't-big');
    r.minis = [];
    for (let i = 0; i < 12; i += 1) {
      r.minis.push(el('rect', { x: O.x + 7 + (i % 6) * 10, y: O.y + 60 + Math.floor(i / 6) * 10, width: 7, height: 7, rx: 1.5, class: 'mini', visibility: 'hidden' }, gOut));
    }
    txt(gOut, O.x + 7, O.y + 87, 'selection', 't-m t-mut');
    r.gOut = gOut;

    // 部品の枠・カーソル・動く点（暗くしない上の層）
    const top = el('g', {}, svg);
    const ring = (part, x, y, w, h) => el('rect', { x: x - 4, y: y - 4, width: w + 8, height: h + 8, rx: 8, class: 'part-ring', 'data-ring': part }, top);
    ring('skill', B.x, B.y, B.w + 10, B.h);
    ring('browser', fx, fy, 344, 238);
    ring('page', fx + 8, fy + 28, 328, 202);
    ring('actions', S.x, S.y, S.w, S.h);
    ring('actions', fx + 12, fy + 52, 320, 70);
    ring('output', fx + 12, fy + 252, 336, R.y + 92 - (fy + 252));
    r.cursor = el('path', { d: 'M0 0 L0 16 L4.5 12 L7.5 19 L10.5 17.8 L7.6 11 L13 11 Z', class: 'cursor', visibility: 'hidden' }, top);
    r.pulses = el('g', {}, top);
    r.E = E;
    r.frame = { x: fx, y: fy };
    refs = r;
  }

  const scen = (id) => view.data.run.scenarios[IDS.indexOf(id)];
  const idsOf = (s) => s.results.map((x) => x.id);

  function finalState(id) {
    const s = scen(id);
    return {
      form: s.conditions,
      ids: idsOf(s),
      targets: s.actions,
      cursor: s.actions.length ? s.actions[s.actions.length - 1].selector : null,
      folder: true,
      outReady: true,
    };
  }

  function cursorPoint(sel) {
    const b = refs.E[sel];
    return { x: b.x + b.w * 0.7, y: b.y + b.h * 0.55 };
  }

  function paint(state, cursorAt) {
    if (!refs) return;
    const id = view.scenario;
    const s = scen(id);
    const f = state.form;
    const E = refs.el;
    E['#search'].value.textContent = f.keyword || 'キーワード';
    E['#search'].value.setAttribute('class', f.keyword ? 't-s' : 't-s t-mut');
    E['#area'].value.textContent = f.area || 'すべて';
    E['#area'].value.setAttribute('class', f.area ? 't-s' : 't-s t-mut');
    E['#budget'].value.textContent = f.budget ? `${f.budget}円以内` : '指定なし';
    E['#budget'].value.setAttribute('class', f.budget ? 't-s' : 't-s t-mut');
    for (const [sel, key] of [['#saturday', 'saturday'], ['#power', 'power']]) {
      E[sel].box.setAttribute('class', f[key] ? 'box-on' : 'box-off');
      E[sel].mark.setAttribute('visibility', f[key] ? 'visible' : 'hidden');
    }
    for (const item of Object.values(E)) {
      item.ring.setAttribute('visibility', 'hidden');
      item.tag.setAttribute('visibility', 'hidden');
    }
    for (const a of state.targets) {
      E[a.selector].ring.setAttribute('visibility', 'visible');
      E[a.selector].tag.textContent = a.api;
      E[a.selector].tag.setAttribute('visibility', 'visible');
    }
    const lead = state.targets.length ? state.targets[0].selector : '#search';
    const lb = refs.E[lead];
    const fx = refs.frame.x, fy = refs.frame.y;
    refs.leader.setAttribute('d', `M${fx + 300} ${fy + 45} L${lb.x + lb.w - 4} ${lb.y - 2}`);

    const inSet = new Set(state.ids);
    for (const t of refs.tokens) t.g.setAttribute('class', inSet.has(t.id) ? 'tok' : 'tok is-out');
    refs.count.textContent = `該当 ${state.ids.length}件`;
    refs.empty.setAttribute('visibility', state.ids.length === 0 && state.showEmpty !== false ? 'visible' : 'hidden');

    const used = new Set(s.actions.map((a) => a.api));
    for (const api of APIS) refs.chips[api].setAttribute('class', used.has(api) ? 'd-chip is-used' : 'd-chip');
    for (const [sid, shapes] of Object.entries(refs.folders)) {
      for (const shape of shapes) shape.setAttribute('class', state.folder && sid === id ? 'folder is-on' : 'folder');
    }
    refs.outId.textContent = id;
    refs.outCount.textContent = `${s.result_count}件`;
    refs.minis.forEach((m, i) => m.setAttribute('visibility', i < s.result_count ? 'visible' : 'hidden'));
    refs.gOut.style.opacity = state.outReady ? '' : '0.35';

    const at = cursorAt || (state.cursor ? cursorPoint(state.cursor) : null);
    if (at) {
      refs.cursor.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`);
      refs.cursor.setAttribute('visibility', 'visible');
    } else {
      refs.cursor.setAttribute('visibility', 'hidden');
    }
  }

  // ---------- 動き（押したときに一度だけ。止まったら最終の状態を描く） ----------
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  function stopAnim() {
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
    if (refs) refs.pulses.replaceChildren();
  }

  function buildSeq(stage, id) {
    const i = IDS.indexOf(id);
    const s = scen(id);
    const prev = i > 0 ? view.data.run.scenarios[i - 1] : null;
    if (stage === 'guide') {
      return { total: 1100, pulses: [['book-a', 0, 700], ['book-b', 160, 700]] };
    }
    if (stage === 'receive') {
      return {
        total: 1900,
        pulses: [['page-dom', 0, 500], ['page-png', 100, 500], ['dom-rec', 560, 450], ['png-rec', 660, 450], ['rec-out', 1220, 480]],
        folderAt: 1100,
        outAt: 1680,
      };
    }
    const acts = s.actions.map((a, k) => ({ a, move: 900 + k * 650, act: 900 + k * 650 + 380 }));
    const last = acts.length ? acts[acts.length - 1].act : 900;
    return {
      total: last + 700,
      pulses: [['steps-py', 0, 450], ['set-py', 100, 450], ['py-frame', 450, 450]],
      drive: { acts, prev, switchAt: acts.length ? last + 120 : 900 },
    };
  }

  function frameAt(seq, e) {
    const final = finalState(view.scenario);
    const state = { ...final };
    let cursorAt = null;
    if (seq.drive) {
      const { acts, prev, switchAt } = seq.drive;
      let form = prev ? { ...prev.conditions } : { ...DEFAULTS };
      let applied = { ...form };
      const targets = [];
      let from = prev && prev.actions.length ? cursorPoint(prev.actions[prev.actions.length - 1].selector) : { x: refs.frame.x + 172, y: refs.frame.y + 30 };
      cursorAt = null;
      for (const step of acts) {
        const to = cursorPoint(step.a.selector);
        if (e >= step.move) {
          const p = ease(clamp01((e - step.move) / 380));
          cursorAt = { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p };
        }
        if (e >= step.act) {
          if (step.a.api === 'fill') {
            const chars = [...step.a.value];
            const n = Math.ceil(chars.length * clamp01((e - step.act) / 260));
            ({ form, applied } = advance(form, applied, { ...step.a, value: chars.slice(0, Math.max(1, n)).join('') }));
          } else {
            ({ form, applied } = advance(form, applied, step.a));
          }
          targets.push(step.a);
        }
        from = to;
      }
      state.form = form;
      state.targets = targets;
      state.ids = e >= switchAt ? final.ids : (prev ? idsOf(prev) : []);
      state.showEmpty = e >= switchAt;
      if (!acts.length) cursorAt = null;
    }
    if (seq.folderAt !== undefined) state.folder = e >= seq.folderAt;
    if (seq.outAt !== undefined) state.outReady = e >= seq.outAt;
    paint(state, cursorAt);
    seq.dots.forEach((dot) => {
      const [, at, dur] = dot.spec;
      if (e < at || e > at + dur) { dot.node.setAttribute('visibility', 'hidden'); return; }
      const pt = dot.path.getPointAtLength(dot.len * ease((e - at) / dur));
      dot.node.setAttribute('cx', pt.x.toFixed(1));
      dot.node.setAttribute('cy', pt.y.toFixed(1));
      dot.node.setAttribute('visibility', 'visible');
    });
  }

  function play() {
    if (!view.data || !refs) return;
    stopAnim();
    const final = finalState(view.scenario);
    if (reduceMotion.matches) { paint(final); return; }
    const seq = buildSeq(view.stage, view.scenario);
    seq.dots = seq.pulses.map((spec) => {
      const path = refs.links[spec[0]];
      return { spec, path, len: path.getTotalLength(), node: el('circle', { r: 4, class: 'pulse', visibility: 'hidden' }, refs.pulses) };
    });
    const t0 = performance.now();
    const tick = (now) => {
      const e = now - t0;
      if (e >= seq.total) { stopAnim(); paint(final); return; }
      frameAt(seq, e);
      anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }

  // ---------- 文章（見出し・説明・詳細） ----------
  function actionText(a) {
    return `${a.api} ${a.selector}${a.value ? `「${a.value}」` : ''}`;
  }

  function setCaption() {
    const s = scen(view.scenario);
    const ids = idsOf(s);
    const b = document.createElement('b');
    let rest = '';
    if (view.stage === 'guide') {
      b.textContent = '手引き';
      rest = '：参照スキルSKILL.mdの話題の表からActorとBrowserの文書を選び、Pythonを書いた。スキル自体はブラウザーを動かさない。';
    } else if (view.stage === 'drive') {
      b.textContent = `${s.id} ${s.label}`;
      rest = `：${s.actions.length ? s.actions.map(actionText).join(' → ') : '操作なし（読み込み完了を待つ）'}。事前の手順をPythonが順に実行。`;
    } else {
      b.textContent = `${s.id}・${s.result_count}件`;
      const list = ids.length && ids.length <= 4 ? `（${ids.join('・')}）` : '';
      rest = `：実DOMから結果${list}を読み、画面PNGと実行記録へ。${ids.length === 0 ? '0件は正常な結果。' : ''}この結果をJSONで保存できる。`;
    }
    caption.replaceChildren(b, document.createTextNode(rest));

    const c = s.conditions;
    const cond = [c.keyword && `キーワード「${c.keyword}」`, c.area, c.budget && `${c.budget}円以内`, c.saturday && '土曜', c.power && '電源あり'].filter(Boolean).join('・') || '条件なし';
    const part = view.part ? `選んだ部品：${view.data.st.parts.find((p) => p.id === view.part).label}。` : '';
    diaDesc.textContent = `参照スキルSKILL.mdからActorとBrowserの文書を選び、Pythonのrun_browser.pyを書いた。事前の手順（fill・select_option・check・click）とBrowser設定がPythonに入り、Browser（BrowserSession）の中のPageで、Elementの入力欄・選択・チェック・ボタンを操作する。いま示している段階：${b.textContent}。${s.id}「${s.label}」：${cond}、結果${s.result_count}件${ids.length ? `（${ids.join('・')}）` : ''}。実DOMと画面PNGを読み、browser-run.jsonへ記録し、選んだ状態をJSONとして保存できる。Agent.run（LLMの判断）は実行していない。${part}`;
  }

  function renderDetail() {
    const d = view.data;
    const s = scen(view.scenario);
    detail.hidden = false;
    detailNote.textContent = `${s.id}「${s.label}」。${d.st.distinctions[s.id] || '読み込み直後の一覧。操作はなく、12件すべてが表示された。'}`;
    detailActions.replaceChildren(...(s.actions.length ? s.actions.map((a) => {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = a.call;
      li.append(code, ` ${a.selector}${a.value ? `　値「${a.value}」` : ''}`);
      return li;
    }) : [Object.assign(document.createElement('li'), { textContent: '操作なし（検索画面の読み込み完了を待って読む）' })]));
    const c = s.conditions;
    const rows = [['キーワード', c.keyword ? `「${c.keyword}」（文字の一致）` : 'なし'], ['エリア', c.area || 'すべて'], ['1時間の予算', c.budget ? `${c.budget}円以内` : '指定なし'], ['土曜に使える', c.saturday ? 'チェックあり' : 'なし'], ['電源あり', c.power ? 'チェックあり' : 'なし']];
    detailConditions.replaceChildren(...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      return [dt, dd];
    }));
    detailCheck.textContent = `照合：手順の入力に書いた期待ID（${s.expected_ids.length}件）と一致。期待IDは照合だけに使い、結果の値は画面のDOMから読んだもの。`;
    detailCountTitle.textContent = `結果 ${s.count_text}`;
    detailEmpty.hidden = !s.empty_visible;
    detailEmpty.textContent = s.empty_visible ? `${s.empty_text}（0件は失敗ではなく、条件に合う席がないという結果）` : '';
    detailResults.replaceChildren(...s.results.map((r) => {
      const li = document.createElement('li');
      const rid = Object.assign(document.createElement('span'), { className: 'rid', textContent: r.id });
      const name = Object.assign(document.createElement('span'), { className: 'rname', textContent: r.name });
      const meta = Object.assign(document.createElement('span'), { className: 'rmeta', textContent: `${r.area}・1時間${r.text.price}・${r.text.saturday}・${r.text.power}｜${r.description}` });
      li.append(rid, name, meta);
      return li;
    }));
    const src = `outputs/${s.screenshot.src}`;
    shotLink.href = src;
    shotImg.src = src;
    shotImg.alt = `${s.id}の実行時の画面（Page.screenshot、1280×900）`;
    shotLinks.replaceChildren(...d.run.scenarios.map((x) => {
      const li = document.createElement('li');
      const a = Object.assign(document.createElement('a'), { href: `outputs/${x.screenshot.src}`, textContent: `${x.id}.png` });
      li.append(a);
      return li;
    }));
  }

  function renderStates() {
    stateList.replaceChildren(...view.data.run.scenarios.map((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'state-btn';
      b.dataset.id = s.id;
      const sid = Object.assign(document.createElement('span'), { className: 'sid', textContent: s.id });
      const label = Object.assign(document.createElement('span'), { className: 'slabel', textContent: s.label });
      const count = Object.assign(document.createElement('span'), { className: 'scount', textContent: String(s.result_count) });
      count.append(Object.assign(document.createElement('small'), { textContent: '件' }));
      b.append(sid, label, count);
      b.setAttribute('aria-label', `${s.id} ${s.label}、${s.result_count}件`);
      b.addEventListener('click', () => { selectScenario(s.id); play(); });
      return b;
    }));
  }

  function renderParts() {
    const d = view.data;
    partsSection.hidden = false;
    partList.replaceChildren(...d.st.parts.map((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'part-btn';
      b.dataset.part = p.id;
      b.textContent = p.label;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => selectPart(view.part === p.id ? '' : p.id));
      return b;
    }));
  }

  function selectPart(id) {
    const d = view.data;
    view.part = id;
    svg.dataset.part = id;
    for (const b of partList.querySelectorAll('.part-btn')) b.setAttribute('aria-pressed', String(b.dataset.part === id));
    if (!id) { partPanel.replaceChildren(); setCaption(); return; }
    const p = d.st.parts.find((x) => x.id === id);
    const h = Object.assign(document.createElement('h3'), { textContent: p.label });
    const api = Object.assign(document.createElement('p'), { className: 'api', textContent: p.api });
    const meaning = Object.assign(document.createElement('p'), { textContent: p.meaning });
    const quote = Object.assign(document.createElement('blockquote'), { textContent: p.quote });
    const where = document.createElement('p');
    where.append('原文：', Object.assign(document.createElement('a'), { href: p.source_path, textContent: p.source_path }), `（${p.line_start}行目）`);
    if (p.source_path.startsWith('vendor/browser-use/')) {
      const up = p.source_path.slice('vendor/browser-use/'.length);
      where.append('・', Object.assign(document.createElement('a'), { href: `https://github.com/browser-use/browser-use/blob/${COMMIT}/${up}#L${p.line_start}`, textContent: 'GitHubの固定版' }));
    }
    const extra = [];
    if (id === 'skill') extra.push(d.st.skill.not_a_runtime, d.st.skill.applied_by);
    if (id === 'browser') extra.push(d.st.hierarchy.browser, d.st.hierarchy.cdp);
    if (id === 'page') extra.push(`${d.st.hierarchy.page}。${d.st.hierarchy.element}。`);
    if (id === 'actions') extra.push(d.st.flow.execution);
    if (id === 'output') extra.push(d.st.flow.readback);
    partPanel.replaceChildren(h, api, meaning, quote, where, ...extra.map((t) => Object.assign(document.createElement('p'), { className: 'note', textContent: t })));
    setCaption();
  }

  function renderScope() {
    const d = view.data;
    const sc = d.run.scope;
    const ex = d.st.actual_execution;
    const items = [
      d.st.flow.authorship,
      sc.method,
      sc.steps,
      ex.scope,
      sc.network_note,
      `実行していないこと：${ex.not_exercised.join('・')}。`,
      sc.data,
      d.st.editorial_note,
    ];
    scopeList.replaceChildren(...items.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    scopeBox.hidden = false;
  }

  function renderTech() {
    const d = view.data;
    techState.textContent = `concept/manifest.json は固定したSHA-256（${PIN.slice(0, 12)}…）と一致。載っている18ファイルのバイト数とSHA-256がすべて一致し、中身の照合も通りました。`;
    techList.replaceChildren(...d.manifest.files.map((f) => Object.assign(document.createElement('li'), { textContent: `${f.path}　${f.bytes.toLocaleString('en-US')} bytes　${f.sha256.slice(0, 16)}…　一致` })));
  }

  function selectScenario(id) {
    if (!IDS.includes(id)) return;
    view.scenario = id;
    stopAnim();
    const s = scen(id);
    for (const b of stateList.querySelectorAll('.state-btn')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
    saveBtn.textContent = `この結果を保存（${id}・${s.result_count}件）`;
    deskLink.href = `desk.html#${id}`;
    saveState.textContent = '';
    paint(finalState(id));
    setCaption();
    renderDetail();
  }

  function selectStage(stage) {
    if (!STAGES.includes(stage)) return;
    view.stage = stage;
    svg.dataset.stage = stage;
    for (const b of stageBtns) b.setAttribute('aria-pressed', String(b.dataset.stage === stage));
    setCaption();
  }

  // ---------- 保存・コピー ----------
  function saveSelected() {
    const d = view.data;
    if (!d) return;
    const id = view.scenario;
    const name = `browser-use-selection-${id}.json`;
    let bytes;
    let how;
    if (id === DEFAULT_ID) {
      bytes = d.files[SELECTION_PATH];
      how = '保存した原本と同じバイト列';
    } else {
      const record = { format: SELECTION_FORMAT, source: d.run.source, inputs_sha256: d.run.inputs_sha256, scope: d.run.scope, selected: scen(id) };
      bytes = new TextEncoder().encode(`${JSON.stringify(record, null, 2)}\n`);
      how = '照合済みの実行記録から、原本と同じ形式で作成';
    }
    try {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      saveState.textContent = `${name} の保存をブラウザーに求めました（${how}）。`;
    } catch {
      saveState.textContent = 'この環境では保存を始められませんでした。下の「元のS04 JSON」か outputs/browser-run.json を開いてください。';
    }
  }

  async function copyRequest() {
    const value = view.data ? view.data.request : '';
    if (!value) return;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard');
      await navigator.clipboard.writeText(value);
      copyState.textContent = '依頼文をコピーしました。';
    } catch {
      requestText.focus();
      requestText.select();
      copyState.textContent = '自動でコピーできませんでした。選択した依頼文を、端末の操作でコピーしてください。';
    }
  }

  // ---------- 読み込み・失敗・やり直し ----------
  function setEnabled(on) {
    for (const b of stageBtns) b.disabled = !on;
    saveBtn.disabled = !on;
    replayBtn.disabled = !on;
    copyBtn.disabled = !on;
    for (const b of document.querySelectorAll('.state-btn, .part-btn')) b.disabled = !on;
  }

  function resetReadouts() {
    view.data = null;
    clearDiagram();
    caption.replaceChildren();
    diaDesc.textContent = '記録を確かめています。';
    saveBtn.textContent = 'この結果を保存';
    saveState.textContent = '';
    stateList.replaceChildren();
    detail.hidden = true;
    shotImg.removeAttribute('src');
    partsSection.hidden = true;
    partList.replaceChildren();
    partPanel.replaceChildren();
    scopeBox.hidden = true;
    scopeList.replaceChildren();
    requestText.value = '';
    copyState.textContent = '';
    techState.textContent = '';
    techList.replaceChildren();
    originalLink.hidden = true;
    svg.dataset.part = '';
    view.part = '';
    setEnabled(false);
  }

  function chooseLayout() {
    const next = wideQuery.matches ? 'wide' : 'portrait';
    if (next === view.layout && refs) return;
    view.layout = next;
    if (view.data) {
      buildDiagram();
      paint(finalState(view.scenario));
    }
  }

  function idFromHash() {
    const m = /^#(S0[1-6])$/.exec(location.hash);
    return m ? m[1] : null;
  }

  async function load() {
    const token = ++loadToken;
    resetReadouts();
    loadError.hidden = true;
    retryBtn.disabled = true;
    diaStatus.hidden = false;
    diaStatus.textContent = '18ファイルを確かめています…';
    try {
      const { manifest, files } = await loadAssets();
      const data = validate(manifest, files);
      if (token !== loadToken) return;
      view.data = data;
      view.layout = wideQuery.matches ? 'wide' : 'portrait';
      buildDiagram();
      renderStates();
      renderParts();
      renderScope();
      renderTech();
      requestText.value = data.request;
      originalLink.hidden = false;
      diaStatus.hidden = true;
      setEnabled(true);
      selectStage(view.stage);
      selectPart(view.part);
      selectScenario(idFromHash() || DEFAULT_ID);
    } catch (err) {
      if (token !== loadToken) return;
      resetReadouts();
      diaStatus.hidden = true;
      loadErrorText.textContent = `${err instanceof Fail ? err.message : '読み込み中に予期しないエラーが起きました'}。代わりのデータは使いません。`;
      loadError.hidden = false;
      retryBtn.disabled = false;
    }
  }

  for (const b of stageBtns) b.addEventListener('click', () => { selectStage(b.dataset.stage); play(); });
  replayBtn.addEventListener('click', play);
  saveBtn.addEventListener('click', saveSelected);
  copyBtn.addEventListener('click', copyRequest);
  retryBtn.addEventListener('click', load);
  window.addEventListener('hashchange', () => {
    const id = idFromHash();
    if (id && view.data) selectScenario(id);
  });
  const onLayout = () => chooseLayout();
  if (wideQuery.addEventListener) wideQuery.addEventListener('change', onLayout); else wideQuery.addListener(onLayout);
  const onMotion = () => { if (reduceMotion.matches && view.data) { stopAnim(); paint(finalState(view.scenario)); } };
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotion); else reduceMotion.addListener(onMotion);

  load();
})();
