/* Studio Yebisu — home page. Loads data/catalog.json and data/cases.json (relative paths).
   Categories come only from catalog.categories (fallback: data/categories.json), so adding or
   removing a category needs no change here.
   URL contract: ./?q=<words>&kind=skill|support&case=1#<category id | section id>.
   Old links such as #agents still select that field. Picking a field or submitting the top search
   adds a history entry; typing, the select, and the toggles replace the current one. */
(() => {
  'use strict';

  const {$, $$, h, safeHref, joinLines, lineNodes, loadJSON, norm, scrollBehavior, announce} = window.SY;

  const PAGE_SIZE = 12;
  const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
  const KINDS = new Set(['all', 'skill', 'support']);
  const coarsePointer = matchMedia('(pointer: coarse)');

  // Lookup tables keyed by data ids use null prototypes so ids such as "constructor" stay plain keys.
  const table = () => Object.create(null);
  const isSkill = entry => String(entry.kind || '').trim() === 'スキル';

  const state = {
    entries: [], categoryList: [], categories: table(), totals: table(), caseByEntry: table(),
    cases: undefined, loaded: false,
    q: '', cat: 'all', kind: 'all', withCase: false, limit: PAGE_SIZE
  };

  const list = $('[data-entries]');
  const status = $('[data-status]');
  const empty = $('[data-empty]');
  const errorBox = $('[data-error]');
  const search = $('[data-search]');
  const heroSearch = $('[data-hero-q]');
  const catSelect = $('[data-cat-select]');
  const catDesc = $('[data-cat-desc]');
  const fieldMap = $('[data-field-map]');
  const more = $('[data-more]');
  const withCaseBox = $('[data-with-case]');
  const rail = $('[data-case-rail]');
  const railHead = $('[data-rail-head]');
  const railPrev = $('[data-rail-prev]');
  const railNext = $('[data-rail-next]');

  function categoryLabel(id) {
    return (state.categories[id] && state.categories[id].label) || id || '分類なし';
  }

  // Categories in data order, grouped by `group` in order of first appearance.
  function groupedCategories() {
    const groups = [];
    for (const category of state.categoryList) {
      const name = category.group || '';
      let group = groups.find(item => item.name === name);
      if (!group) groups.push(group = {name, items: []});
      group.items.push(category);
    }
    return groups;
  }

  async function readCategories(data, entries) {
    let source = Array.isArray(data.categories) ? data.categories : [];
    if (!source.length) {
      try {
        const extra = await loadJSON('data/categories.json');
        source = Array.isArray(extra.categories) ? extra.categories : [];
      } catch (_) { source = []; }
    }
    const result = [];
    const seen = new Set();
    for (const category of source) {
      if (!category || typeof category.id !== 'string' || !category.id || seen.has(category.id)) continue;
      seen.add(category.id);
      result.push(category);
    }
    // An entry whose category is not listed still gets an option, so nothing becomes unreachable.
    for (const entry of entries) {
      if (entry.category && !seen.has(entry.category)) {
        seen.add(entry.category);
        result.push({id: String(entry.category), label: String(entry.category)});
      }
    }
    return result;
  }

  /* ---------- Filtering ---------- */

  const termsOf = q => norm(q).split(/\s+/).filter(Boolean);

  function matches(entry, filter, terms) {
    if (filter.cat !== 'all' && entry.category !== filter.cat) return false;
    if (filter.kind !== 'all' && (filter.kind === 'skill') !== isSkill(entry)) return false;
    if (filter.withCase && !state.caseByEntry[entry.id]) return false;
    return terms.every(term => entry._text.includes(term));
  }

  // How many entries a filter would give if only `overrides` changed.
  function countWith(overrides, terms) {
    const filter = {cat: state.cat, kind: state.kind, withCase: state.withCase, ...overrides};
    let total = 0;
    for (const entry of state.entries) if (matches(entry, filter, terms)) total++;
    return total;
  }

  const hasFilters = () => state.cat !== 'all' || state.kind !== 'all' || state.withCase || Boolean(state.q.trim());

  /* ---------- Catalog rows ---------- */

  const caseHref = item => 'case.html?id=' + encodeURIComponent(item.id);
  const entryHref = entry => {
    const item = state.caseByEntry[entry.id];
    return item ? caseHref(item) : 'case.html?entry=' + encodeURIComponent(entry.id || '');
  };

  // Rows are built on first display and cached, so hidden pages cost nothing and images load only when shown.
  function rowFor(entry) {
    if (entry._row) return entry._row;
    const skill = isSkill(entry);
    const produced = state.caseByEntry[entry.id];
    const image = safeHref(entry.image);
    let thumb = null;
    if (image && !VIDEO_EXT.test(image)) {
      const img = h('img', {src: image, alt: '', loading: 'lazy', decoding: 'async', width: '160', height: '90'});
      thumb = h('div', {class: 'entry-thumb', 'aria-hidden': 'true'}, img);
      img.addEventListener('error', () => { thumb.remove(); row.classList.remove('has-thumb'); });
    }
    const tags = Array.isArray(entry.tags) && entry.tags.length
      ? h('ul', {class: 'tags', 'aria-label': 'タグ'}, entry.tags.slice(0, 5).map(tag => h('li', {}, tag)))
      : null;
    const row = h('li', {class: 'entry ' + (skill ? 'is-skill' : 'is-support') + (thumb ? ' has-thumb' : '')},
      h('p', {class: 'entry-meta'},
        h('span', {class: 'entry-kind'}, h('span', {class: 'mark ' + (skill ? 'mark-skill' : 'mark-support'), 'aria-hidden': 'true'}), entry.kind || 'その他'),
        h('span', {}, categoryLabel(entry.category)),
        produced ? h('span', {class: 'entry-case'}, '作例の記事あり') : null),
      h('h3', {class: 'entry-name'}, h('a', {href: entryHref(entry)}, entry.name || entry.id)),
      entry.summary ? h('p', {class: 'entry-summary'}, entry.summary) : null,
      entry.use_case ? h('p', {class: 'entry-use'}, h('span', {class: 'entry-use-label'}, '使いどころ'), entry.use_case) : null,
      tags,
      thumb);
    entry._row = row;
    return row;
  }

  function showPlaceholders() {
    list.replaceChildren(...Array.from({length: 4}, () => h('li', {class: 'placeholder-row', 'aria-hidden': 'true'}, h('span'), h('span'), h('span'))));
    list.setAttribute('aria-busy', 'true');
  }

  function renderFieldMap() {
    fieldMap.replaceChildren(...groupedCategories().map(group => h('div', {class: 'field-group'},
      group.name ? h('h3', {class: 'field-group-name'}, group.name, h('span', {}, group.items.length + '分野')) : null,
      h('ul', {class: 'field-list'}, group.items.map(category => h('li', {},
        h('a', {class: 'field-link', href: '#' + encodeURIComponent(category.id), 'data-cat-link': category.id},
          h('span', {class: 'field-name'}, category.label || category.id),
          h('span', {class: 'field-count'}, h('span', {'data-field-count': category.id}, String(state.totals[category.id] || 0)), h('span', {class: 'sr-only'}, '件')),
          category.description ? h('span', {class: 'field-desc'}, category.description) : null)))))));
    fieldMap.removeAttribute('aria-busy');
  }

  function renderCategorySelect() {
    const option = category => h('option', {value: category.id, 'data-label': category.label || category.id}, category.label || category.id);
    catSelect.replaceChildren(
      h('option', {value: 'all', 'data-label': 'すべての分野'}, 'すべての分野'),
      ...groupedCategories().flatMap(group => group.name
        ? [h('optgroup', {label: group.name}, group.items.map(option))]
        : group.items.map(option)));
  }

  function render() {
    if (!state.loaded) return;
    const terms = termsOf(state.q);
    const casesAvailable = Array.isArray(state.cases);
    withCaseBox.disabled = !casesAvailable && !state.withCase;
    withCaseBox.checked = state.withCase;
    if (!casesAvailable && state.withCase) {
      list.replaceChildren();
      list.removeAttribute('aria-busy');
      empty.hidden = true;
      more.hidden = true;
      catDesc.hidden = true;
      $('[data-case-count]').textContent = '—';
      for (const button of $$('.toolbar [data-reset]')) button.hidden = false;
      status.textContent = '作例の一覧を読み込めないため、この絞り込みは表示できません。上の「もう一度読み込む」か、作例の絞り込みを外してください。';
      return;
    }
    const matched = state.entries.filter(entry => matches(entry, state, terms));
    const shown = matched.slice(0, state.limit);
    list.replaceChildren(...shown.map(rowFor));
    list.removeAttribute('aria-busy');

    const remaining = matched.length - shown.length;
    more.hidden = remaining <= 0;
    if (remaining > 0) {
      more.replaceChildren('さらに' + Math.min(PAGE_SIZE, remaining) + '件を表示', h('span', {class: 'more-rest'}, '残り' + remaining + '件'));
    }

    // Each control shows how many results it would give with the other conditions kept.
    for (const option of catSelect.options) {
      option.textContent = option.dataset.label + '（' + countWith({cat: option.value}, terms) + '）';
    }
    catSelect.value = state.cat;
    for (const el of $$('[data-kind-count]')) el.textContent = String(countWith({kind: el.dataset.kindCount}, terms));
    $('[data-case-count]').textContent = casesAvailable ? String(countWith({withCase: true}, terms)) : '—';
    const narrowed = terms.length > 0 || state.kind !== 'all' || state.withCase;
    for (const el of $$('[data-field-count]')) {
      const id = el.dataset.fieldCount;
      el.textContent = String(narrowed ? countWith({cat: id}, terms) : (state.totals[id] || 0));
    }
    $('[data-fields-note]').textContent = narrowed
      ? '数字は、いまのキーワード・種類・作例の絞り込みで当てはまる件数です。'
      : '数字は掲載している件数です。選ぶと、下のカタログがその分野に絞られます。';

    const parts = [];
    if (state.cat !== 'all') parts.push(categoryLabel(state.cat));
    if (state.kind === 'skill') parts.push('スキル');
    if (state.kind === 'support') parts.push('ツール・教材など');
    if (state.withCase) parts.push('作例の記事あり');
    if (state.q.trim()) parts.push('「' + state.q.trim() + '」');
    status.replaceChildren(...[
      h('span', {class: 'status-main'}, h('strong', {}, String(matched.length)), '件が該当'),
      h('span', {}, '全' + state.entries.length + '件中' + (matched.length ? '・' + shown.length + '件を表示' : '')),
      parts.length ? h('span', {class: 'status-filters'}, '条件：' + parts.join('、')) : null].filter(Boolean));

    empty.hidden = matched.length !== 0;
    if (!matched.length) {
      $('[data-empty-detail]').textContent = !state.entries.length
        ? 'まだ掲載しているものがありません。'
        : state.cat !== 'all' && !state.totals[state.cat]
          ? 'この分野には、まだ掲載している項目がありません。ほかの分野を選ぶか、絞り込みを外してください。'
          : '別の言葉で探すか、分野・種類・作例の絞り込みを外してください。';
    }

    const info = state.cat !== 'all' && state.categories[state.cat];
    catDesc.hidden = !info;
    if (info) {
      catDesc.replaceChildren(...[
        info.group ? h('span', {class: 'category-group'}, info.group) : null,
        h('strong', {}, categoryLabel(state.cat)),
        info.description ? h('span', {}, info.description) : null,
        h('span', {class: 'category-total'}, '掲載' + (state.totals[state.cat] || 0) + '件')].filter(Boolean));
    }

    const filtered = hasFilters();
    for (const button of $$('.toolbar [data-reset]')) button.hidden = !filtered;
    for (const button of $$('[data-kind]')) button.setAttribute('aria-pressed', String(button.dataset.kind === state.kind));
    withCaseBox.checked = state.withCase;
    for (const link of $$('[data-cat-link]')) {
      if (link.dataset.catLink === state.cat) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }

  /* ---------- Cases ---------- */

  function firstSentence(text) {
    const value = String(text || '').trim();
    const end = value.indexOf('。');
    return end >= 0 && end < value.length - 1 ? value.slice(0, end + 1) : value;
  }

  // The skill or tool the case is about: its catalog entry, else the first skill it applied.
  function skillName(item) {
    if (item.catalog_entry && item.catalog_entry.name) return item.catalog_entry.name;
    const first = Array.isArray(item.applied_skills) && item.applied_skills[0];
    return (first && first.name) || '';
  }

  function titleLines(item) {
    if (Array.isArray(item.title_lines) && item.title_lines.length) return item.title_lines.map(String);
    if (item.id === 'brief-to-demo') return ['ひと言を、', '作れる依頼に。'];
    return [item.title || item.id];
  }

  function renderFeature(item) {
    const href = caseHref(item);
    $('[data-feature-cat]').textContent = categoryLabel(item.category);
    const skill = skillName(item);
    $('[data-feature-skill]').textContent = skill;
    $('[data-feature-skill]').hidden = !skill;
    const link = $('[data-feature-link]');
    link.href = href;
    link.replaceChildren(...lineNodes(titleLines(item), 'phrase').filter(Boolean));
    $('[data-feature-read]').href = href;
    $('[data-feature-media]').href = href;
    if (item.summary) $('[data-feature-summary]').textContent = firstSentence(item.summary);
    const demo = safeHref(item.demo);
    const demoLink = $('[data-feature-demo]');
    demoLink.hidden = !demo;
    if (demo) demoLink.href = demo;
    const poster = safeHref(item.poster);
    const img = $('[data-feature-poster]');
    if (poster && img.getAttribute('src') !== poster) img.src = poster;
  }

  function caseCard(item) {
    const href = caseHref(item);
    const poster = safeHref(item.poster);
    const demo = safeHref(item.demo);
    const skill = skillName(item);
    const title = joinLines(titleLines(item));
    let media = null;
    if (poster) {
      const img = h('img', {src: poster, alt: '', width: '1280', height: '720', loading: 'lazy', decoding: 'async'});
      media = h('a', {class: 'case-card-media', href, tabindex: '-1', 'aria-hidden': 'true'}, img);
      img.addEventListener('error', () => media.classList.add('is-missing'));
    }
    return h('li', {class: 'case-card'},
      media,
      h('div', {class: 'case-card-body'},
        h('p', {class: 'card-meta'}, h('span', {class: 'card-cat'}, categoryLabel(item.category)), skill ? h('span', {}, skill) : null),
        h('h3', {class: 'case-card-title'}, h('a', {href}, title)),
        item.summary ? h('p', {class: 'case-card-summary'}, firstSentence(item.summary)) : null,
        demo || item.updated_on ? h('p', {class: 'case-card-foot'},
          demo ? h('a', {class: 'case-card-demo', href: demo}, 'デモを開く', h('span', {class: 'sr-only'}, '：' + title)) : null,
          item.updated_on ? h('span', {class: 'case-card-date'}, String(item.updated_on) + ' 更新') : null) : null));
  }

  function renderCases() {
    const cases = state.cases;
    for (const el of $$('[data-case-total]')) el.textContent = Array.isArray(cases) ? String(cases.length) : '—';
    $('[data-cases-error]').hidden = cases !== null;
    // When cases.json cannot be read, the static feature in the HTML stays readable.
    // When it loads and lists no case, nothing is featured.
    $('[data-feature]').hidden = Array.isArray(cases) && !cases.length;
    if (!Array.isArray(cases) || !cases.length) {
      rail.hidden = true;
      railHead.hidden = true;
      return;
    }
    const feature = cases.find(item => item.id === 'brief-to-demo') || cases[0];
    renderFeature(feature);
    const others = cases.filter(item => item !== feature)
      .map((item, index) => ({item, index}))
      .sort((a, b) => String(b.item.updated_on || '').localeCompare(String(a.item.updated_on || '')) || a.index - b.index)
      .map(({item}) => item);
    rail.hidden = !others.length;
    railHead.hidden = !others.length;
    if (!others.length) return;
    rail.replaceChildren(...others.map(caseCard));
    $('[data-rail-label]').textContent = 'ほかの作例 ' + others.length + '本';
    $('[data-rail-order]').textContent = others.some(item => item.updated_on) ? '更新日の新しい順' : '';
    updateRail();
  }

  function updateRail() {
    if (rail.hidden) return;
    const max = rail.scrollWidth - rail.clientWidth - 2;
    const wasFocused = document.activeElement;
    railPrev.disabled = rail.scrollLeft <= 2;
    railNext.disabled = rail.scrollLeft >= max;
    // A button that becomes disabled loses focus; hand it to the other one.
    if (wasFocused === railPrev && railPrev.disabled && !railNext.disabled) railNext.focus();
    if (wasFocused === railNext && railNext.disabled && !railPrev.disabled) railPrev.focus();
  }

  function stepRail(direction) {
    const card = rail.firstElementChild;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    const width = card ? card.getBoundingClientRect().width + gap : rail.clientWidth;
    const perView = Math.max(1, Math.floor((rail.clientWidth + gap) / width));
    rail.scrollBy({left: direction * width * perView, behavior: scrollBehavior()});
  }

  let railFrame = 0;
  const queueRailUpdate = () => {
    if (!railFrame) railFrame = requestAnimationFrame(() => { railFrame = 0; updateRail(); });
  };
  rail.addEventListener('scroll', queueRailUpdate, {passive: true});
  window.addEventListener('resize', queueRailUpdate, {passive: true});
  railPrev.addEventListener('click', () => stepRail(-1));
  railNext.addEventListener('click', () => stepRail(1));

  /* ---------- URL and history ---------- */

  function categoryFromHash() {
    let id = '';
    try { id = decodeURIComponent(location.hash.replace(/^#/, '')); } catch (_) { return null; }
    return state.categories[id] ? id : null;
  }

  function readURL() {
    const params = new URLSearchParams(location.search);
    const kind = params.get('kind');
    return {
      q: params.get('q') || '',
      kind: KINDS.has(kind) ? kind : 'all',
      withCase: params.get('case') === '1',
      cat: categoryFromHash() || 'all',
      limit: PAGE_SIZE
    };
  }

  function urlFor(forceHash) {
    const params = new URLSearchParams();
    const q = state.q.trim();
    if (q) params.set('q', q);
    if (state.kind !== 'all') params.set('kind', state.kind);
    if (state.withCase) params.set('case', '1');
    const query = params.toString();
    let hash = location.hash;
    if (state.cat !== 'all') hash = '#' + encodeURIComponent(state.cat);
    else if (forceHash) hash = forceHash;
    else if (categoryFromHash() || (query && !hash)) hash = '#catalog';
    return location.pathname + (query ? '?' + query : '') + hash;
  }

  function writeURL(push, forceHash) {
    try {
      history[push ? 'pushState' : 'replaceState']({sy: 1, cat: state.cat}, '', urlFor(forceHash));
    } catch (_) { /* Safari rate-limits history calls; the filters still apply on the page. */ }
  }

  let urlTimer = 0;
  function writeURLSoon() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => writeURL(false), 400);
  }

  function syncInputs() {
    if (document.activeElement !== search) search.value = state.q;
    if (document.activeElement !== heroSearch) heroSearch.value = state.q;
  }

  function scrollToCatalog(smooth = true) {
    const section = $('#catalog');
    section.scrollIntoView({behavior: smooth ? scrollBehavior() : 'auto', block: 'start'});
    section.focus({preventScroll: true});
  }

  // On a fresh visit to a deep link, the content above has only just been built, so scroll again.
  // Reload and back/forward keep the position the browser restores.
  function settleInitialScroll(hadCategory) {
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    if (nav && nav.type !== 'navigate') return;
    if (hadCategory) return scrollToCatalog(false);
    const id = location.hash.slice(1);
    const target = /^[a-z][a-z0-9-]*$/i.test(id) ? document.getElementById(id) : null;
    if (target && id !== 'top') target.scrollIntoView({block: 'start'});
  }

  let restoredFromHistory = false;
  window.addEventListener('popstate', event => {
    restoredFromHistory = Boolean(event.state && event.state.sy === 1);
    if (!state.loaded) return;
    const next = readURL();
    if (restoredFromHistory) next.cat = state.categories[event.state.cat] ? event.state.cat : 'all';
    else if (!categoryFromHash()) next.cat = state.cat; // plain section anchors keep the chosen field
    Object.assign(state, next);
    syncInputs();
    render();
  });

  window.addEventListener('hashchange', () => {
    const fromHistory = restoredFromHistory;
    restoredFromHistory = false;
    const cat = categoryFromHash();
    if (!cat || !state.loaded || fromHistory) return;
    state.cat = cat;
    state.limit = PAGE_SIZE;
    render();
    writeURL(false);
    scrollToCatalog();
  });

  /* ---------- Loading ---------- */

  async function fetchCases() {
    try {
      const data = await loadJSON('data/cases.json');
      return (Array.isArray(data) ? data : (Array.isArray(data.cases) ? data.cases : []))
        .filter(item => item && typeof item.id === 'string' && item.id);
    } catch (_) {
      return null;
    }
  }

  async function loadCatalog() {
    const data = await loadJSON('data/catalog.json');
    const entries = (Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []))
      .filter(entry => entry && (entry.id || entry.name));
    state.categoryList = await readCategories(Array.isArray(data) ? {} : data, entries);
    state.categories = table();
    for (const category of state.categoryList) state.categories[category.id] = category;
    state.entries = entries;
    state.totals = table();
    for (const entry of entries) {
      const category = state.categories[entry.category];
      entry._text = norm([entry.name, entry.summary, entry.use_case, (entry.tags || []).join(' '), entry.kind,
        category && category.label, category && category.group].join(' '));
      state.totals[entry.category] = (state.totals[entry.category] || 0) + 1;
    }
    if (!Array.isArray(data) && data.updated_on) $('[data-updated]').textContent = data.updated_on;
  }

  // Labels for the case cards when the catalog itself could not be read.
  async function loadCategoryLabels() {
    try {
      const extra = await loadJSON('data/categories.json');
      for (const category of Array.isArray(extra.categories) ? extra.categories : []) {
        if (category && typeof category.id === 'string' && category.id) state.categories[category.id] = category;
      }
    } catch (_) { /* ids are shown instead */ }
  }

  // A catalog entry counts as produced only when a Studio Yebisu case points to it.
  function mapCases() {
    state.caseByEntry = table();
    const cases = state.cases || [];
    for (const item of cases) {
      const id = item.catalog_entry && item.catalog_entry.id;
      if (id) state.caseByEntry[id] = item;
    }
    for (const entry of state.entries) {
      entry._row = null;
      if (!state.caseByEntry[entry.id] && typeof entry.guide_url === 'string') {
        const match = /^case\.html\?id=([a-z0-9._-]+)(?:[&#]|$)/i.exec(entry.guide_url.trim());
        const item = match && cases.find(c => c.id === match[1]);
        if (item) state.caseByEntry[entry.id] = item;
      }
    }
  }

  function showCatalogError() {
    list.replaceChildren();
    list.removeAttribute('aria-busy');
    status.textContent = 'カタログを読み込めませんでした。';
    errorBox.hidden = false;
    fieldMap.replaceChildren(h('p', {class: 'field-error'}, '分野の一覧を読み込めませんでした。カタログの「もう一度読み込む」から読み込み直せます。'));
    fieldMap.removeAttribute('aria-busy');
    $('[data-tally-note]').hidden = false;
  }

  let firstRun = true;
  async function start() {
    errorBox.hidden = true;
    empty.hidden = true;
    more.hidden = true;
    status.textContent = 'カタログを読み込んでいます…';
    showPlaceholders();
    fieldMap.setAttribute('aria-busy', 'true');

    const casesTask = Array.isArray(state.cases) ? Promise.resolve(state.cases) : fetchCases();
    let catalogOk = true;
    try { await loadCatalog(); } catch (_) { catalogOk = false; }
    state.cases = await casesTask;
    if (!catalogOk) await loadCategoryLabels();
    mapCases();
    renderCases();
    if (!catalogOk) return showCatalogError();

    state.loaded = true;
    $('[data-tally-note]').hidden = Array.isArray(state.cases);
    for (const el of $$('[data-total]')) el.textContent = String(state.entries.length);
    for (const el of $$('[data-cat-total]')) el.textContent = String(state.categoryList.length);
    renderFieldMap();
    renderCategorySelect();

    const fromURL = readURL();
    Object.assign(state, fromURL);
    syncInputs();
    render();
    writeURL(false);
    if (firstRun) settleInitialScroll(fromURL.cat !== 'all');
    firstRun = false;
  }

  /* ---------- Events ---------- */

  $('[data-feature-poster]').addEventListener('error', () => $('[data-feature-media]').classList.add('is-missing'));

  // Top search: one explicit submit runs a fresh search over everything and moves to the results.
  $('[data-hero-form]').addEventListener('submit', event => {
    event.preventDefault();
    Object.assign(state, {q: heroSearch.value, cat: 'all', kind: 'all', withCase: false, limit: PAGE_SIZE});
    search.value = heroSearch.value;
    render();
    writeURL(true, '#catalog');
    scrollToCatalog(); // focus moves to the section, which also closes the software keyboard
  });

  // Catalog search filters while typing, without moving the page.
  let typingTimer = 0;
  search.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      state.q = search.value;
      state.limit = PAGE_SIZE;
      heroSearch.value = search.value;
      render();
      writeURLSoon();
    }, 150);
  });

  // The keyboard's search key: apply now; on touch screens close the keyboard and show the results.
  $('[data-catalog-form]').addEventListener('submit', event => {
    event.preventDefault();
    clearTimeout(typingTimer);
    state.q = search.value;
    state.limit = PAGE_SIZE;
    render();
    writeURL(false);
    if (coarsePointer.matches) {
      search.blur();
      status.scrollIntoView({behavior: scrollBehavior(), block: 'start'});
    }
  });

  catSelect.addEventListener('change', () => {
    state.cat = state.categories[catSelect.value] ? catSelect.value : 'all';
    state.limit = PAGE_SIZE;
    render();
    writeURL(false);
  });

  for (const button of $$('[data-kind]')) {
    button.addEventListener('click', () => {
      state.kind = KINDS.has(button.dataset.kind) ? button.dataset.kind : 'all';
      state.limit = PAGE_SIZE;
      render();
      writeURL(false);
    });
  }

  withCaseBox.addEventListener('change', () => {
    state.withCase = withCaseBox.checked;
    state.limit = PAGE_SIZE;
    render();
    writeURL(false);
  });

  // The field map is rebuilt from data, so its links are handled by delegation.
  fieldMap.addEventListener('click', event => {
    const link = event.target.closest('[data-cat-link]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    state.cat = state.categories[link.dataset.catLink] ? link.dataset.catLink : 'all';
    state.limit = PAGE_SIZE;
    render();
    writeURL(true);
    scrollToCatalog();
  });

  more.addEventListener('click', () => {
    const before = state.limit;
    state.limit += PAGE_SIZE;
    render();
    // Continue from the first newly shown item.
    const next = list.children[before];
    const link = next && $('.entry-name a', next);
    if (link) link.focus();
  });

  for (const button of $$('[data-reset]')) {
    button.addEventListener('click', () => {
      Object.assign(state, {q: '', cat: 'all', kind: 'all', withCase: false, limit: PAGE_SIZE});
      search.value = '';
      heroSearch.value = '';
      render();
      writeURL(false, '#catalog');
      search.focus();
      announce('絞り込みをすべて外しました。');
    });
  }

  $('[data-retry]').addEventListener('click', start);

  $('[data-cases-retry]').addEventListener('click', async () => {
    state.cases = await fetchCases();
    mapCases();
    renderCases();
    if (state.loaded) {
      $('[data-tally-note]').hidden = Array.isArray(state.cases);
      render();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const active = document.activeElement;
    if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
    event.preventDefault();
    search.focus();
  });

  start();
})();
