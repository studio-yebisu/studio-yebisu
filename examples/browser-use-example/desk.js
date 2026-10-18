// 保存した Browser Use の操作記録を読むページ。ページを開いても Browser Use や AI は動かない。
// 入力2件と outputs/browser-run.json を取得し、形・固定コミット・入力のSHA-256・中身の一致を確かめてから表示する。
'use strict';

(() => {
  const PIN = 'c75e8476e26d18b7617643bc2ae082fae8eae431';
  const RUN_URL = 'outputs/browser-run.json';
  const INPUT_KEYS = ['input/workspaces.json', 'input/scenarios.json'];
  const IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
  const DEFAULT_ID = 'S04';
  const DEFAULTS = { keyword: '', area: '', budget: '', saturday: false, power: false };
  const CALLS = { fill: 'Element.fill', select_option: 'Element.select_option', check: 'Element.check', click: 'Element.click' };
  const BUTTON_TEXT = { '#apply': 'この条件で探す', '#reset': '条件をリセット' };
  const CHECK_TEXT = { '#saturday': '土曜に使える', '#power': '電源あり' };
  const SELECT_TEXT = { '#area': 'エリア', '#budget': '1時間の予算' };

  const $ = (id) => document.getElementById(id);
  const loadState = $('load-state');
  const loadError = $('load-error');
  const loadErrorText = $('load-error-text');
  const retry = $('retry');
  const list = $('scenario-list');
  const detail = $('detail');
  const detailId = $('detail-id');
  const detailTitle = $('detail-title');
  const detailNote = $('detail-note');
  const detailActions = $('detail-actions');
  const detailConditions = $('detail-conditions');
  const detailCount = $('detail-count');
  const detailEmpty = $('detail-empty');
  const detailResults = $('detail-results');
  const shotLink = $('shot-link');
  const shotImg = $('shot-img');
  const shotCaption = $('shot-caption');
  const exportBtn = $('export');
  const exportState = $('export-state');
  const captureLinks = $('capture-links');
  const tech = $('tech');
  const requestState = $('request-state');
  const requestText = $('request-text');
  const copyBtn = $('copy');
  const copyState = $('copy-state');
  const requestRetry = $('request-retry');

  let loaded = null;
  let selectedId = DEFAULT_ID;
  let inflight = null;
  let requestInflight = null;

  const priceText = (yen) => `${yen.toLocaleString('en-US')}円`;
  const saturdayText = (ok) => (ok ? '土曜：利用可' : '土曜：休み');
  const powerText = (ok) => (ok ? '電源：あり' : '電源：なし');
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fail = (message) => { throw new Error(message); };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function fetchBytes(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) fail(`${url} を取得できません（HTTP ${response.status}）`);
    return response.arrayBuffer();
  }

  function parseJson(buffer, url) {
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    } catch {
      return fail(`${url} がJSONとして読めません`);
    }
  }

  async function sha256(buffer) {
    if (!window.crypto || !window.crypto.subtle) fail('この環境ではSHA-256を計算できないため、入力との一致を確かめられません');
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------- 照合 ----------

  function checkInputs(ws, sc) {
    if (!isObj(ws) || ws.format !== 'studio-yebisu-workspace-fixture-v1' || ws.fictional !== true) fail('作業席の入力の形が想定と違います');
    if (!Array.isArray(ws.items) || ws.items.length !== 12) fail('作業席の入力が12件ではありません');
    const items = new Map();
    for (const item of ws.items) {
      if (!isObj(item) || typeof item.id !== 'string' || items.has(item.id)) fail('作業席のIDが不正か重複しています');
      if (typeof item.name !== 'string' || typeof item.area !== 'string' || !Number.isInteger(item.hourly_yen) ||
          typeof item.saturday !== 'boolean' || typeof item.power !== 'boolean' || typeof item.description !== 'string') {
        fail(`作業席 ${item.id} の項目の形が想定と違います`);
      }
      items.set(item.id, item);
    }
    if (!isObj(sc) || sc.format !== 'studio-yebisu-browser-scenarios-v1' || !Array.isArray(sc.scenarios)) fail('手順の入力の形が想定と違います');
    if (sc.scenarios.map((s) => s && s.id).join() !== IDS.join()) fail('手順の入力が S01〜S06 の順になっていません');
    return items;
  }

  function advance(form, action) {
    const next = { ...form };
    if (action.api === 'fill') next.keyword = action.value;
    else if (action.api === 'select_option') next[action.selector === '#area' ? 'area' : 'budget'] = action.value;
    else if (action.api === 'check') next[action.selector === '#saturday' ? 'saturday' : 'power'] = true;
    else if (action.selector === '#reset') return { ...DEFAULTS };
    return next;
  }

  function sameConditions(a, b) {
    return isObj(a) && Object.keys(a).length === 5 &&
      ['keyword', 'area', 'budget', 'saturday', 'power'].every((k) => a[k] === b[k]);
  }

  function checkRun(run, items, sc, hashes) {
    if (!isObj(run) || run.format !== 'studio-yebisu-browser-run-v1') fail('実行記録の形式名が想定と違います');
    if (run.fictional !== true) fail('実行記録に架空データの印がありません');
    if (!isObj(run.source) || run.source.repository !== 'browser-use/browser-use' || run.source.commit !== PIN) {
      fail('実行記録の原典が固定コミットと違います');
    }
    if (!isObj(run.inputs_sha256) || Object.keys(run.inputs_sha256).sort().join() !== [...INPUT_KEYS].sort().join()) {
      fail('実行記録に入力のSHA-256がそろっていません');
    }
    for (const key of INPUT_KEYS) {
      if (run.inputs_sha256[key] !== hashes[key]) fail(`${key} が、実行時の入力とSHA-256で一致しません`);
    }
    if (!isObj(run.scope) || run.scope.agent_run !== false || run.scope.llm_calls !== 0) fail('実行記録の範囲（Agent・LLMなし）が想定と違います');
    const rt = run.runtime;
    if (!isObj(rt) || rt.agent_run !== false || rt.llm_calls !== 0 || rt.llm_constructed !== false ||
        typeof rt.python !== 'string' || typeof rt.browser_use !== 'string' || !isObj(rt.action_success_counts)) {
      fail('実行環境の記録が想定と違います');
    }
    if (!isObj(run.fixture) || run.fixture.url !== 'fixture.html') fail('操作した画面の記録が想定と違います');
    if (!Array.isArray(run.scenarios) || run.scenarios.length !== 6) fail('実行記録が6状態ではありません');

    let form = { ...DEFAULTS };
    run.scenarios.forEach((s, i) => {
      const input = sc.scenarios[i];
      const where = IDS[i];
      if (!isObj(s) || s.id !== where || s.label !== input.label) fail(`${where} のIDか名前が入力と違います`);
      if (s.status !== 'passed') fail(`${where} が照合済み（passed）ではありません`);
      if (!Array.isArray(s.actions) || s.actions.length !== input.actions.length) fail(`${where} の操作の数が入力と違います`);
      s.actions.forEach((a, j) => {
        const want = input.actions[j];
        if (!isObj(a) || a.api !== want.api || a.selector !== want.selector || a.value !== want.value || a.call !== CALLS[want.api]) {
          fail(`${where} の${j + 1}番目の操作が入力と違います`);
        }
        form = advance(form, want);
      });
      if (!sameConditions(s.conditions, form)) fail(`${where} の条件が手順から求めた値と違います`);
      if (!Array.isArray(s.expected_ids) || s.expected_ids.join() !== input.expected_ids.join()) fail(`${where} の期待IDが入力と違います`);
      if (!Array.isArray(s.results)) fail(`${where} の結果がありません`);
      if (s.results.map((r) => r && r.id).join() !== s.expected_ids.join()) fail(`${where} の結果のIDが期待と違います`);
      for (const r of s.results) {
        const item = items.get(r.id);
        const ok = item && r.name === item.name && r.area === item.area && r.hourly_yen === item.hourly_yen &&
          r.saturday === item.saturday && r.power === item.power && r.description === item.description &&
          isObj(r.text) && r.text.price === priceText(item.hourly_yen) &&
          r.text.saturday === saturdayText(item.saturday) && r.text.power === powerText(item.power);
        if (!ok) fail(`${where} の ${r.id} が入力の作業席と一致しません`);
      }
      const n = s.results.length;
      if (s.result_count !== n || s.count_text !== `該当 ${n}件` || s.empty_visible !== (n === 0)) fail(`${where} の件数の記録が結果と合いません`);
      const shot = s.screenshot;
      if (!isObj(shot) || shot.src !== `captures/${where}.png` || !/^[0-9a-f]{64}$/.test(shot.sha256) ||
          !Number.isInteger(shot.width) || shot.width <= 0 || !Number.isInteger(shot.height) || shot.height <= 0) {
        fail(`${where} の画像の記録が想定と違います`);
      }
    });
  }

  // ---------- 表示 ----------

  function describeAction(a) {
    if (a.api === 'fill') return `${a.selector}（キーワード）に「${a.value}」を入力`;
    if (a.api === 'select_option') {
      const shown = a.selector === '#budget' ? `${Number(a.value).toLocaleString('en-US')}円以内` : a.value;
      return `${a.selector}（${SELECT_TEXT[a.selector]}）で「${shown}」を選ぶ`;
    }
    if (a.api === 'check') return `${a.selector}（${CHECK_TEXT[a.selector]}）にチェック`;
    return `${a.selector}「${BUTTON_TEXT[a.selector]}」をクリック`;
  }

  function callText(a) {
    return a.value === undefined ? `${a.call}()` : `${a.call}(${JSON.stringify(a.value)})`;
  }

  function conditionRows(c) {
    return [
      ['キーワード', c.keyword ? `「${c.keyword}」` : 'なし'],
      ['エリア', c.area || 'すべて'],
      ['1時間の予算', c.budget ? `${Number(c.budget).toLocaleString('en-US')}円以内` : '指定なし'],
      ['土曜に使える', c.saturday ? 'チェックあり' : 'チェックなし'],
      ['電源あり', c.power ? 'チェックあり' : 'チェックなし'],
    ];
  }

  function noteFor(s) {
    const n = s.results.length;
    const ids = s.results.map((r) => r.id).join('・');
    const c = s.conditions;
    switch (s.id) {
      case 'S01':
        return `読み込みの完了（#load-status が ready）を待ち、操作せずに読み取りました。入力の${n}件が入力の順に並んでいます。`;
      case 'S02': {
        const nashi = s.results.filter((r) => r.description.includes('電源なし')).map((r) => r.id);
        const extra = nashi.length ? `説明文に「電源なし」とある ${nashi.join('・')} も文字が一致するため、` : '';
        return `キーワード「${c.keyword}」は、名前・エリア・説明文の文字に一致した席を残します。${extra}${n}件が残りました。キーワードは設備の分類ではありません。電源の有無で絞るのは「電源あり」の条件（S04）です。`;
      }
      case 'S03':
        return `キーワード「${c.keyword}」を残したまま、エリアと予算を足して探しました。${n}件（${ids}）が残っています。`;
      case 'S04':
        return `S03までの条件に「土曜に使える」「電源あり」を足すと、${n}件（${ids}）になりました。電源の有無は、各席の「電源」の項目で絞っています。`;
      case 'S05':
        return `キーワードを「${c.keyword}」に置き換えると${n}件になり、該当なしの案内が出ました。0件は失敗ではなく、確かめたかった状態です。`;
      default:
        return `「条件をリセット」を押した時点で、すべての条件が外れて${n}件に戻りました。`;
    }
  }

  function markedText(parent, text, tokens) {
    const useful = tokens.filter((t) => t && text.includes(t));
    if (!useful.length) {
      parent.textContent = text;
      return;
    }
    let rest = text;
    while (rest) {
      let at = -1;
      let hit = '';
      for (const t of useful) {
        const i = rest.indexOf(t);
        if (i !== -1 && (at === -1 || i < at)) { at = i; hit = t; }
      }
      if (at === -1) { parent.append(rest); break; }
      if (at > 0) parent.append(rest.slice(0, at));
      parent.append(el('mark', '', hit));
      rest = rest.slice(at + hit.length);
    }
  }

  function renderList() {
    const items = loaded.run.scenarios.map((s) => {
      const li = el('li');
      const btn = el('button', 'scenario-btn');
      btn.type = 'button';
      btn.dataset.id = s.id;
      btn.setAttribute('aria-pressed', String(s.id === selectedId));
      btn.append(el('span', 'sc-id', s.id), el('span', 'sc-label', s.label), el('span', 'sc-count', `${s.results.length}件`));
      btn.addEventListener('click', () => select(s.id, true));
      li.append(btn);
      return li;
    });
    list.replaceChildren(...items);
  }

  function renderDetail(s) {
    detailId.textContent = `${s.id}　Browser Useの操作APIで実行した記録`;
    detailTitle.textContent = s.label;
    detailNote.textContent = noteFor(s);

    if (s.actions.length === 0) {
      detailActions.replaceChildren(el('li', 'action-none', '操作なし。読み込みの完了を待ってから画面を読み取りました。'));
    } else {
      detailActions.replaceChildren(...s.actions.map((a) => {
        const li = el('li');
        li.append(el('span', 'action-what', describeAction(a)), el('code', 'action-call', callText(a)));
        return li;
      }));
    }

    detailConditions.replaceChildren(...conditionRows(s.conditions).flatMap(([k, v]) => [el('dt', '', k), el('dd', '', v)]));

    const n = s.results.length;
    detailCount.textContent = `${n}件`;
    detailEmpty.hidden = n !== 0;
    detailEmpty.textContent = n === 0 ? `画面の表示：${s.empty_text || ''}` : '';
    const tokens = s.conditions.keyword.normalize('NFKC').split(/\s+/u).filter(Boolean);
    detailResults.replaceChildren(...s.results.map((r) => {
      const li = el('li', 'result');
      const head = el('p', 'result-head');
      head.append(el('span', 'result-id', r.id), el('strong', 'result-name', r.name));
      const meta = el('p', 'result-meta', `${r.area}・1時間 ${r.text.price}・${r.text.saturday}・${r.text.power}`);
      const desc = el('p', 'result-desc');
      markedText(desc, r.description, tokens);
      li.append(head, meta, desc);
      return li;
    }));

    const src = new URL(s.screenshot.src, new URL(RUN_URL, location.href)).href;
    shotImg.src = src;
    shotImg.width = s.screenshot.width;
    shotImg.height = s.screenshot.height;
    shotImg.alt = `${s.id}「${s.label}」の実行時の画面。結果は${n}件。`;
    shotLink.href = src;
    const open = el('a', '', '元の画像を開く');
    open.href = src;
    shotCaption.replaceChildren(`実行時の画面 ${s.screenshot.width}×${s.screenshot.height}（Page.screenshot で保存）　`, open);

    exportBtn.disabled = false;
    exportState.textContent = '';
    detail.hidden = false;
  }

  function select(id, explicit) {
    if (!loaded) return;
    const s = loaded.run.scenarios.find((x) => x.id === id);
    if (!s) return;
    selectedId = id;
    for (const btn of list.querySelectorAll('.scenario-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.id === id));
    renderDetail(s);
    if (explicit) {
      detailTitle.focus({ preventScroll: true });
      detailTitle.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }

  function renderTech(run) {
    const rt = run.runtime;
    const counts = Object.entries(rt.action_success_counts).map(([k, v]) => `${k} ${v}回`).join('・');
    const api = isObj(rt.api_calls) ? Object.entries(rt.api_calls).map(([k, v]) => `${k} ${v}回`).join('・') : '記録なし';
    const rows = [
      ['原典', `${run.source.repository} @ ${run.source.commit}（配布版 ${run.source.distribution_version}）`],
      ['Python', rt.python],
      ['browser-use', rt.browser_use],
      ['ブラウザー', rt.browser_product || '記録なし'],
      ['Agent.run・LLM', `Agent.run なし・LLM 呼び出し ${rt.llm_calls}回（LLMは作っていません）`],
      ['成功した操作', counts],
      ['API呼び出し', api],
    ];
    for (const key of INPUT_KEYS) rows.push([`${key} のSHA-256`, `${run.inputs_sha256[key]}（このページで再計算して一致）`]);
    for (const s of run.scenarios) rows.push([`${s.id} の画像のSHA-256`, `${s.screenshot.sha256}（実行記録の値）`]);
    rows.push(['通信の範囲', run.scope.network_note || '記録なし']);
    tech.replaceChildren(...rows.flatMap(([k, v]) => [el('dt', '', k), el('dd', '', v)]));

    captureLinks.replaceChildren(...run.scenarios.map((s) => {
      const li = el('li');
      const a = el('a', '', `${s.id}の画像`);
      a.href = new URL(s.screenshot.src, new URL(RUN_URL, location.href)).href;
      li.append(a);
      return li;
    }));
  }

  function showError(message) {
    loaded = null;
    list.replaceChildren();
    detail.hidden = true;
    exportBtn.disabled = true;
    tech.replaceChildren();
    captureLinks.replaceChildren();
    loadState.textContent = '記録を表示できません。';
    loadErrorText.textContent = message;
    loadError.hidden = false;
    retry.disabled = false;
  }

  async function fetchAll() {
    const [wsBuf, scBuf, runBuf] = await Promise.all([fetchBytes(INPUT_KEYS[0]), fetchBytes(INPUT_KEYS[1]), fetchBytes(RUN_URL)]);
    const hashes = { [INPUT_KEYS[0]]: await sha256(wsBuf), [INPUT_KEYS[1]]: await sha256(scBuf) };
    const ws = parseJson(wsBuf, INPUT_KEYS[0]);
    const sc = parseJson(scBuf, INPUT_KEYS[1]);
    const run = parseJson(runBuf, RUN_URL);
    const items = checkInputs(ws, sc);
    checkRun(run, items, sc, hashes);
    return { run };
  }

  function load() {
    if (inflight) return inflight;
    retry.disabled = true;
    loadError.hidden = true;
    detail.hidden = true;
    exportBtn.disabled = true;
    loadState.textContent = '保存した記録を読み込んでいます…';
    inflight = fetchAll()
      .then((result) => {
        loaded = result;
        renderList();
        renderTech(result.run);
        select(selectedId, false);
        loadState.textContent = '6状態の記録を読み込み、入力とSHA-256・中身が一致することを確かめました。';
      })
      .catch((err) => showError(err instanceof Error ? err.message : '読み込みに失敗しました'))
      .finally(() => { inflight = null; });
    return inflight;
  }

  function exportSelected() {
    if (!loaded) return;
    const s = loaded.run.scenarios.find((x) => x.id === selectedId);
    if (!s) return;
    const run = loaded.run;
    const payload = {
      format: 'studio-yebisu-browser-selection-v1',
      source: run.source,
      inputs_sha256: run.inputs_sha256,
      scope: run.scope,
      selected: s,
    };
    const name = `browser-use-example-${s.id}.json`;
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }));
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    exportState.textContent = `JSONのダウンロードを要求しました（${name}）。保存できたかはブラウザーの表示で確かめてください。`;
  }

  // ---------- 依頼文 ----------

  function loadRequest() {
    if (requestInflight) return requestInflight;
    requestRetry.hidden = true;
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
        requestText.hidden = true;
        copyBtn.hidden = true;
        requestRetry.hidden = false;
        requestState.textContent = `依頼文を読み込めませんでした。${err instanceof Error ? err.message : ''}`;
      })
      .finally(() => { requestInflight = null; });
    return requestInflight;
  }

  async function copyRequest() {
    const text = requestText.value;
    copyState.textContent = '';
    try {
      await navigator.clipboard.writeText(text);
      copyState.textContent = '依頼文をコピーしました。';
      return;
    } catch {
      // 下の方法へ
    }
    requestText.focus();
    requestText.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    copyState.textContent = ok
      ? '依頼文をコピーしました。'
      : 'コピーできませんでした。選択した依頼文を長押しするか、Ctrl+C でコピーしてください。';
  }

  retry.addEventListener('click', () => { load(); });
  exportBtn.addEventListener('click', exportSelected);
  copyBtn.addEventListener('click', () => { copyRequest(); });
  requestRetry.addEventListener('click', () => { loadRequest(); });

  load();
  loadRequest();
})();
