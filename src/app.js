/* Studio Yebisu — catalog page. Loads data/catalog.json and data/cases.json (relative paths). */
(() => {
  'use strict';

  const CATEGORY_DEFAULTS = {
    'ui-ux': {label: 'UI・UX', description: '画面を設計し、操作を整える。'},
    slides: {label: 'AIスライド', description: '原稿から、伝わる日本語資料へ。'},
    motion: {label: 'モーション', description: '文字と図形で、使い方を見せる。'},
    agents: {label: 'エージェント・便利スキル', description: '調べる、整理する、手を動かす。'}
  };
  const STATUS_LABELS = {draft: '制作中', produced: '制作済み', rendered: '動画を書き出し済み', reviewed: '確認済み', published: '掲載済み'};
  const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  // Small element builder. Text is always set as text, never parsed as HTML.
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  // Allow https/http and same-site relative paths only.
  function safeHref(value) {
    if (typeof value !== 'string') return null;
    const url = value.trim();
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return null;
    return url;
  }

  const norm = value => String(value ?? '').normalize('NFKC').toLowerCase();
  const isSkill = entry => String(entry.kind || '').trim() === 'スキル';

  async function loadJSON(url) {
    const response = await fetch(url, {cache: 'no-cache'});
    if (!response.ok) throw new Error(url + ' ' + response.status);
    return response.json();
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const announcer = $('[data-announce]');
  function announce(message) {
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = message; }, 30);
  }

  async function copyText(text, button) {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
    } catch (_) { ok = false; }
    if (!ok) {
      const area = h('textarea', {class: 'sr-only', readonly: true});
      area.value = text;
      document.body.append(area);
      area.select();
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      area.remove();
    }
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = ok ? 'コピーしました' : 'コピーできませんでした';
    announce(ok ? '依頼文をコピーしました。' : 'コピーできませんでした。文章を選択してコピーしてください。');
    clearTimeout(button._reset);
    button._reset = setTimeout(() => { button.textContent = original; }, 2200);
  }

  /* ---------- State ---------- */

  const state = {entries: [], categories: {}, q: '', cat: 'all', kind: 'all', loaded: false};

  const list = $('[data-entries]');
  const status = $('[data-status]');
  const empty = $('[data-empty]');
  const errorBox = $('[data-error]');
  const search = $('[data-search]');
  const catDesc = $('[data-cat-desc]');

  function categoryLabel(id) {
    return (state.categories[id] && state.categories[id].label) || (CATEGORY_DEFAULTS[id] && CATEGORY_DEFAULTS[id].label) || id || '分類なし';
  }

  function matchesQuery(entry, terms) {
    return terms.every(term => entry._text.includes(term));
  }
  function matchesKind(entry, kind) {
    return kind === 'all' || (kind === 'skill') === isSkill(entry);
  }
  function matchesCat(entry, cat) {
    return cat === 'all' || entry.category === cat;
  }

  /* ---------- Catalog rendering ---------- */

  function showPlaceholders() {
    list.replaceChildren(...Array.from({length: 4}, () => h('li', {class: 'placeholder-row', 'aria-hidden': 'true'}, h('span'), h('span'), h('span'))));
    list.setAttribute('aria-busy', 'true');
  }

  function buildRow(entry) {
    const skill = isSkill(entry);
    const open = h('button', {type: 'button', class: 'entry-open', 'aria-haspopup': 'dialog', onclick: () => openDetail(entry, open)}, entry.name || entry.id);
    const tags = Array.isArray(entry.tags) && entry.tags.length
      ? h('ul', {class: 'tags', 'aria-label': 'タグ'}, entry.tags.slice(0, 6).map(tag => h('li', {}, tag)))
      : null;
    const image = safeHref(entry.image);
    let thumb = null;
    if (image && !VIDEO_EXT.test(image)) {
      const img = h('img', {src: image, alt: '', loading: 'lazy', decoding: 'async', width: '320', height: '240'});
      thumb = h('div', {class: 'entry-thumb'}, img);
      img.addEventListener('error', () => { thumb.classList.add('is-missing'); thumb.parentElement && thumb.parentElement.classList.remove('has-thumb'); });
    }
    const li = h('li', {class: 'entry ' + (skill ? 'is-skill' : 'is-support') + (thumb ? ' has-thumb' : '')},
      h('p', {class: 'entry-meta'},
        h('span', {class: 'entry-kind'}, h('span', {class: 'mark ' + (skill ? 'mark-skill' : 'mark-support'), 'aria-hidden': 'true'}), entry.kind || 'その他'),
        h('span', {}, categoryLabel(entry.category))),
      h('h3', {class: 'entry-name'}, open),
      entry.summary ? h('p', {class: 'entry-summary'}, entry.summary) : null,
      entry.use_case ? h('p', {class: 'entry-use'}, '使いどころ：', entry.use_case) : null,
      tags,
      thumb);
    return li;
  }

  function renderCatalog() {
    const rows = state.entries.map(entry => { entry._row = buildRow(entry); return entry._row; });
    list.replaceChildren(...rows);
    list.removeAttribute('aria-busy');
    applyFilters();
  }

  function applyFilters() {
    if (!state.loaded) return;
    const terms = norm(state.q).split(/\s+/).filter(Boolean);
    let shown = 0, shownSkills = 0;
    for (const entry of state.entries) {
      const visible = matchesQuery(entry, terms) && matchesCat(entry, state.cat) && matchesKind(entry, state.kind);
      entry._row.hidden = !visible;
      if (visible) { shown++; if (isSkill(entry)) shownSkills++; }
    }

    // Live counts: each filter shows how many results it would give with the other filters kept.
    for (const el of $$('[data-cat-buttons] [data-count-for]')) {
      const cat = el.dataset.countFor;
      el.textContent = String(state.entries.filter(e => matchesQuery(e, terms) && matchesKind(e, state.kind) && matchesCat(e, cat)).length);
    }
    for (const el of $$('[data-kind-count]')) {
      const kind = el.dataset.kindCount;
      el.textContent = String(state.entries.filter(e => matchesQuery(e, terms) && matchesCat(e, state.cat) && matchesKind(e, kind)).length);
    }

    const parts = [];
    if (state.cat !== 'all') parts.push(categoryLabel(state.cat));
    if (state.kind === 'skill') parts.push('スキルのみ');
    if (state.kind === 'support') parts.push('ライブラリ・ツールのみ');
    if (state.q.trim()) parts.push('「' + state.q.trim() + '」');
    status.replaceChildren(
      h('span', {}, h('strong', {}, String(shown)), '件を表示'),
      h('span', {}, '全' + state.entries.length + '件中' + (parts.length ? '、' + parts.join('、') : '')),
      shown ? h('span', {}, 'うちスキル' + shownSkills + '件、ライブラリ・ツール' + (shown - shownSkills) + '件') : null);

    empty.hidden = shown !== 0;
    if (!shown) {
      $('[data-empty-detail]').textContent = state.entries.length
        ? '別の言葉で探すか、分野と種類の絞り込みを外してください。'
        : 'まだ掲載しているものがありません。';
    }

    const info = state.cat !== 'all' && (state.categories[state.cat] || CATEGORY_DEFAULTS[state.cat]);
    catDesc.hidden = !info;
    if (info) catDesc.textContent = categoryLabel(state.cat) + '　' + (info.description || '');

    for (const button of $$('[data-cat]')) button.setAttribute('aria-pressed', String(button.dataset.cat === state.cat));
    for (const button of $$('[data-kind]')) button.setAttribute('aria-pressed', String(button.dataset.kind === state.kind));
    for (const link of $$('[data-cat-link]')) link.setAttribute('aria-current', String(link.dataset.catLink === state.cat));
  }

  function scrollToCatalog() {
    const section = $('#catalog');
    section.scrollIntoView({behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start'});
    section.focus({preventScroll: true});
  }

  function selectCategory(cat, options = {}) {
    state.cat = CATEGORY_DEFAULTS[cat] || state.categories[cat] ? cat : 'all';
    applyFilters();
    if (options.updateHash) history.replaceState(null, '', state.cat === 'all' ? '#catalog' : '#' + state.cat);
    if (options.scroll) scrollToCatalog();
  }

  function categoryFromHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    return CATEGORY_DEFAULTS[id] || state.categories[id] ? id : null;
  }

  /* ---------- Detail dialog ---------- */

  const dialog = $('[data-detail]');
  const dialogBody = $('[data-detail-body]');
  let lastOpener = null;

  function fallbackPrompt(entry) {
    const lines = [(entry.name || entry.id) + ' を使いたいです。'];
    const source = safeHref(entry.guide_url) || safeHref(entry.source_url);
    lines.push('まず原典の説明' + (source ? '（' + source + '）' : '') + 'を読み、次の用途に合うか確かめてから進めてください。');
    if (entry.use_case) lines.push('用途：' + entry.use_case);
    lines.push('完成したら、何を作ったかと、確かめた方法を短く教えてください。');
    return lines.join('\n');
  }

  function promptBlock(entry) {
    const hasPrompt = typeof entry.prompt === 'string' && entry.prompt.trim();
    const text = hasPrompt ? entry.prompt.trim() : fallbackPrompt(entry);
    const copy = h('button', {type: 'button', class: 'btn btn-ink', onclick: () => copyText(text, copy)}, '依頼文をコピー');
    return h('div', {},
      h('div', {class: 'prompt'},
        h('pre', {tabindex: '0', 'aria-label': '依頼文'}, text),
        h('div', {class: 'prompt-bar'}, h('span', {class: 'prompt-label'}, hasPrompt ? '依頼文の例' : '依頼文のひな形'), copy)),
      hasPrompt ? null : h('p', {class: 'd-note'}, 'この項目には依頼文の例がまだないため、原典を読んでから使うためのひな形を表示しています。'));
  }

  function mediaBlock(entry) {
    const src = safeHref(entry.image);
    if (!src) return null;
    const figure = h('figure', {class: 'd-media'});
    const media = VIDEO_EXT.test(src)
      ? h('video', {src, controls: true, preload: 'none', playsinline: true, 'aria-label': (entry.name || '') + 'の作例動画'})
      : h('img', {src, alt: (entry.name || '') + 'の作例画像', loading: 'lazy', decoding: 'async'});
    media.addEventListener('error', () => figure.classList.add('is-missing'));
    figure.append(media);
    return figure;
  }

  function linkList(entry) {
    const items = [
      ['原典', entry.source_url],
      ['使い方の案内', entry.guide_url],
      ['作例', entry.example_url],
      ['スキルをダウンロード', entry.skill_download]
    ].map(([label, url]) => [label, safeHref(url)]).filter(([, url]) => url);
    if (!items.length) return null;
    return h('div', {class: 'd-links'}, items.map(([label, url]) => {
      const external = /^https?:/i.test(url);
      return h('a', {href: url, download: label === 'スキルをダウンロード' && !external ? '' : null},
        h('span', {}, label), h('small', {}, external ? url.replace(/^https?:\/\//, '') : 'このサイト内'));
    }));
  }

  function conditions(entry) {
    const license = safeHref(entry.license_url);
    return h('dl', {class: 'd-facts'},
      h('dt', {}, 'ライセンス'),
      h('dd', {}, license ? h('a', {href: license}, entry.license || 'ライセンスを見る') : (entry.license || '原典で確認してください')),
      h('dt', {}, '確認状況'),
      h('dd', {}, entry.verification || '記載なし'),
      h('dt', {}, '掲載元'),
      h('dd', {}, categoryLabel(entry.source_project || entry.category) + 'のカタログ'));
  }

  function openDetail(entry, opener) {
    lastOpener = opener || document.activeElement;
    const skill = isSkill(entry);
    const links = linkList(entry);
    dialogBody.replaceChildren(
      h('p', {class: 'd-meta'},
        h('span', {class: 'entry-kind'}, h('span', {class: 'mark ' + (skill ? 'mark-skill' : 'mark-support'), 'aria-hidden': 'true'}), entry.kind || 'その他'),
        h('span', {}, categoryLabel(entry.category))),
      h('h2', {id: 'detail-title', class: 'd-title'}, entry.name || entry.id),
      entry.summary ? h('p', {class: 'd-summary'}, entry.summary) : null,
      mediaBlock(entry),
      entry.use_case ? h('section', {class: 'd-section'}, h('h3', {}, '使いどころ'), h('p', {}, entry.use_case)) : null,
      h('section', {class: 'd-section'}, h('h3', {}, 'AIへの頼み方'), promptBlock(entry)),
      h('section', {class: 'd-section'}, h('h3', {}, '使う条件'), conditions(entry)),
      links ? h('section', {class: 'd-section'}, h('h3', {}, 'リンク'), links) : null,
      Array.isArray(entry.tags) && entry.tags.length ? h('ul', {class: 'tags', 'aria-label': 'タグ'}, entry.tags.map(tag => h('li', {}, tag))) : null,
      h('div', {class: 'd-cta'}, h('a', {class: 'btn btn-line', href: 'case.html?entry=' + encodeURIComponent(entry.id)}, 'この項目のページを開く')));
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.body.classList.add('has-dialog');
    dialog.scrollTop = 0;
    $('[data-close]', dialog).focus();
  }

  function closeDetail() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  dialog.addEventListener('close', () => {
    document.body.classList.remove('has-dialog');
    for (const video of $$('video', dialog)) video.pause();
    if (lastOpener && document.contains(lastOpener)) lastOpener.focus();
  });
  $('[data-close]', dialog).addEventListener('click', closeDetail);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) closeDetail();
  });

  /* ---------- Loading ---------- */

  async function loadCatalog() {
    errorBox.hidden = true;
    empty.hidden = true;
    status.textContent = 'カタログを読み込んでいます…';
    showPlaceholders();
    try {
      const data = await loadJSON('data/catalog.json');
      const entries = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);
      state.categories = {};
      for (const category of Array.isArray(data.categories) ? data.categories : []) {
        if (category && category.id) state.categories[category.id] = category;
      }
      state.entries = entries.filter(entry => entry && (entry.id || entry.name));
      for (const entry of state.entries) {
        entry._text = norm([entry.name, entry.summary, entry.use_case, (entry.tags || []).join(' '), entry.kind].join(' '));
      }
      state.loaded = true;

      const totals = {all: state.entries.length};
      for (const entry of state.entries) totals[entry.category] = (totals[entry.category] || 0) + 1;
      $('[data-total]').textContent = String(totals.all);
      for (const el of $$('[data-index-list] [data-count-for]')) el.textContent = String(totals[el.dataset.countFor] || 0);
      for (const link of $$('[data-cat-link]')) {
        const info = state.categories[link.dataset.catLink];
        if (info && info.description) $('.index-desc', link).textContent = info.description;
      }
      if (data.updated_on) $('[data-updated]').textContent = data.updated_on;

      const fromHash = categoryFromHash();
      if (fromHash) state.cat = fromHash;
      renderCatalog();
      if (fromHash) scrollToCatalog();
    } catch (error) {
      list.replaceChildren();
      list.removeAttribute('aria-busy');
      status.textContent = 'カタログを読み込めませんでした。';
      errorBox.hidden = false;
    }
  }

  async function loadCases() {
    let cases = [];
    try {
      const data = await loadJSON('data/cases.json');
      cases = Array.isArray(data) ? data : (Array.isArray(data.cases) ? data.cases : []);
    } catch (_) {
      return; // The feature band already holds the first case as static text.
    }
    const feature = cases.find(item => item && item.id === 'brief-to-demo') || cases[0];
    if (feature) {
      if (feature.title) {
        const title = $('[data-feature-title]');
        if (feature.id === 'brief-to-demo') title.replaceChildren('ひと言を、', h('br'), '作れる依頼に。');
        else title.textContent = feature.title;
      }
      if (feature.summary) $('[data-feature-summary]').textContent = feature.summary;
      $('[data-feature-link]').href = 'case.html?id=' + encodeURIComponent(feature.id);
      const demo = safeHref(feature.demo);
      if (demo) $('[data-feature-demo]').href = demo;
      const poster = safeHref(feature.poster);
      if (poster && $('[data-feature-poster]').getAttribute('src') !== poster) $('[data-feature-poster]').src = poster;
    }
    const others = cases.filter(item => item && item !== feature && item.id);
    if (!others.length) return;
    $('[data-case-list]').replaceChildren(...others.map(item => h('li', {class: 'case-row'},
      h('h3', {}, h('a', {href: 'case.html?id=' + encodeURIComponent(item.id)}, item.title || item.id)),
      h('p', {}, item.summary || ''),
      h('span', {class: 'case-status'}, categoryLabel(item.category) + '　' + (STATUS_LABELS[item.status] || item.status || '')))));
    $('[data-cases]').hidden = false;
  }

  /* ---------- Events ---------- */

  const poster = $('[data-feature-poster]');
  poster.addEventListener('error', () => $('[data-feature-media]').classList.add('is-missing'));
  if (poster.complete && poster.naturalWidth === 0 && poster.getAttribute('src')) $('[data-feature-media]').classList.add('is-missing');

  search.addEventListener('input', () => { state.q = search.value; applyFilters(); });

  $('[data-search-form]').addEventListener('submit', event => {
    event.preventDefault();
    const value = $('[data-search-mirror]').value;
    search.value = value;
    state.q = value;
    applyFilters();
    scrollToCatalog();
    search.focus({preventScroll: true});
  });

  for (const button of $$('[data-cat]')) {
    button.addEventListener('click', () => selectCategory(button.dataset.cat, {updateHash: true}));
  }
  for (const button of $$('[data-kind]')) {
    button.addEventListener('click', () => { state.kind = button.dataset.kind; applyFilters(); });
  }
  for (const link of $$('[data-cat-link]')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      history.pushState(null, '', '#' + link.dataset.catLink);
      selectCategory(link.dataset.catLink, {scroll: true});
    });
  }
  window.addEventListener('hashchange', () => {
    const cat = categoryFromHash();
    if (cat) selectCategory(cat, {scroll: true});
  });
  window.addEventListener('popstate', () => {
    const cat = categoryFromHash();
    selectCategory(cat || 'all');
  });

  $('[data-reset]').addEventListener('click', () => {
    state.q = ''; state.cat = 'all'; state.kind = 'all';
    search.value = '';
    $('[data-search-mirror]').value = '';
    history.replaceState(null, '', '#catalog');
    applyFilters();
    search.focus();
  });
  $('[data-retry]').addEventListener('click', loadCatalog);

  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const active = document.activeElement;
    if (dialog.open || (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)))) return;
    event.preventDefault();
    search.focus();
  });

  loadCatalog();
  loadCases();
})();
