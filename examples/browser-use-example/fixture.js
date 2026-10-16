// まちの作業席（架空データ）の検索画面。input/workspaces.json だけを読み、出力のJSONには依存しない。
// 絞り込みは「この条件で探す」を押したときだけ行い、「条件をリセット」は押した時点で全件に戻す。
'use strict';

(() => {
  const DATA_URL = 'input/workspaces.json';
  const FORMAT = 'studio-yebisu-workspace-fixture-v1';
  const ITEM_COUNT = 12;
  const AREAS = ['恵比寿', '渋谷', '代官山', '目黒'];
  const BUDGETS = ['', '500', '800', '1000'];
  const DEFAULTS = { keyword: '', area: '', budget: '', saturday: false, power: false };

  const $ = (id) => document.getElementById(id);
  const form = $('search-form');
  const search = $('search');
  const area = $('area');
  const budget = $('budget');
  const saturday = $('saturday');
  const power = $('power');
  const apply = $('apply');
  const reset = $('reset');
  const controls = [search, area, budget, saturday, power, apply, reset];
  const status = $('load-status');
  const errorBox = $('load-error');
  const errorText = $('load-error-text');
  const retry = $('retry');
  const count = $('result-count');
  const empty = $('empty');
  const results = $('results');

  let items = [];
  let revision = 0;
  let inflight = null;

  const setControls = (enabled) => {
    for (const el of controls) el.disabled = !enabled;
  };

  const normalize = (text) => text.normalize('NFKC').toLowerCase();

  const priceText = (yen) => `${yen.toLocaleString('en-US')}円`;
  const saturdayText = (ok) => (ok ? '土曜：利用可' : '土曜：休み');
  const powerText = (ok) => (ok ? '電源：あり' : '電源：なし');

  function validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('データの形が想定と違います');
    if (data.format !== FORMAT) throw new Error('データの形式名が想定と違います');
    if (data.fictional !== true) throw new Error('架空データの印がありません');
    if (!Array.isArray(data.items) || data.items.length !== ITEM_COUNT) {
      throw new Error(`作業席は${ITEM_COUNT}件の想定です`);
    }
    const seen = new Set();
    for (const item of data.items) {
      const ok =
        item && typeof item === 'object' &&
        typeof item.id === 'string' && /^W[0-9]{2}$/.test(item.id) &&
        typeof item.name === 'string' && item.name.length > 0 &&
        AREAS.includes(item.area) &&
        Number.isInteger(item.hourly_yen) && item.hourly_yen > 0 &&
        typeof item.saturday === 'boolean' &&
        typeof item.power === 'boolean' &&
        typeof item.description === 'string' && item.description.length > 0;
      if (!ok) throw new Error(`作業席の項目が足りないか形が違います（${item && item.id ? item.id : '不明'}）`);
      if (seen.has(item.id)) throw new Error(`IDが重複しています（${item.id}）`);
      seen.add(item.id);
    }
    return data.items;
  }

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

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function card(item) {
    const article = el('article', 'card');
    article.dataset.id = item.id;
    article.dataset.area = item.area;
    article.dataset.price = String(item.hourly_yen);
    article.dataset.saturday = String(item.saturday);
    article.dataset.power = String(item.power);
    article.setAttribute('aria-labelledby', `name-${item.id}`);

    const head = el('div', 'card-head');
    const id = el('span', 'card-id', item.id);
    id.dataset.field = 'id';
    const place = el('span', 'card-area', item.area);
    place.dataset.field = 'area';
    head.append(id, place);

    const name = el('h3', 'card-name', item.name);
    name.id = `name-${item.id}`;
    name.dataset.field = 'name';

    const price = el('p', 'card-price');
    const value = el('span', 'price-value', priceText(item.hourly_yen));
    value.dataset.field = 'price';
    price.append(el('span', 'price-unit', '1時間'), ' ', value);

    const tags = el('ul', 'card-tags');
    const sat = el('li', item.saturday ? 'tag tag-yes' : 'tag tag-no', saturdayText(item.saturday));
    sat.dataset.field = 'saturday';
    const pow = el('li', item.power ? 'tag tag-yes' : 'tag tag-no', powerText(item.power));
    pow.dataset.field = 'power';
    tags.append(sat, pow);

    const desc = el('p', 'card-desc', item.description);
    desc.dataset.field = 'description';

    article.append(head, name, price, tags, desc);
    return article;
  }

  function render(cond) {
    const hits = items.filter((item) => matches(item, cond));
    results.replaceChildren(...hits.map(card));
    revision += 1;
    results.dataset.revision = String(revision);
    results.dataset.keyword = cond.keyword;
    results.dataset.area = cond.area;
    results.dataset.budget = cond.budget;
    results.dataset.saturday = String(cond.saturday);
    results.dataset.power = String(cond.power);
    results.hidden = false;
    empty.hidden = hits.length !== 0;
    count.textContent = `該当 ${hits.length}件`;
  }

  function readForm() {
    return {
      keyword: search.value,
      area: AREAS.includes(area.value) ? area.value : '',
      budget: BUDGETS.includes(budget.value) ? budget.value : '',
      saturday: saturday.checked,
      power: power.checked,
    };
  }

  function showError(message) {
    items = [];
    results.replaceChildren();
    results.hidden = true;
    empty.hidden = true;
    setControls(false);
    count.textContent = '件数を表示できません';
    status.dataset.state = 'error';
    status.textContent = '一覧を読み込めませんでした。';
    errorText.textContent = `${message}。代わりのデータは使いません。`;
    errorBox.hidden = false;
    retry.disabled = false;
  }

  async function fetchItems() {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${DATA_URL} を取得できません（HTTP ${response.status}）`);
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`${DATA_URL} がJSONとして読めません`);
    }
    return validate(data);
  }

  function load() {
    if (inflight) return inflight;
    retry.disabled = true;
    errorBox.hidden = true;
    setControls(false);
    status.dataset.state = 'loading';
    status.textContent = '一覧を読み込んでいます…';
    count.textContent = '読み込み中';
    inflight = fetchItems()
      .then((loaded) => {
        items = loaded;
        HTMLFormElement.prototype.reset.call(form);
        render({ ...DEFAULTS });
        setControls(true);
        status.dataset.state = 'ready';
        status.textContent = `架空の作業席${items.length}件を読み込みました。`;
      })
      .catch((err) => {
        showError(err instanceof Error ? err.message : '読み込みに失敗しました');
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (status.dataset.state !== 'ready') return;
    render(readForm());
  });

  reset.addEventListener('click', () => {
    if (status.dataset.state !== 'ready') return;
    HTMLFormElement.prototype.reset.call(form);
    render({ ...DEFAULTS });
  });

  retry.addEventListener('click', () => {
    load();
  });

  load();
})();
