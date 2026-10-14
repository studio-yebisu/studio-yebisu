/* Search helpers are shared with the dependency-free Node checks. */
(function () {
  'use strict';
  function normalize(value) {
    return String(value).normalize('NFKC').toLocaleLowerCase('ja').trim();
  }
  function matches(entry, query, category, origin) {
    if (category !== 'all' && entry.category !== category) return false;
    if (origin !== 'all' && entry.origin !== origin) return false;
    const haystack = normalize([entry.name, entry.repo, entry.headline, entry.summary,
      entry.best_for, entry.requirements, entry.limits, entry.kind_label,
      entry.category_label, ...entry.tags].join(' '));
    return normalize(query).split(/\s+/u).filter(Boolean).every(term => haystack.includes(term));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { normalize, matches };
  if (typeof document === 'undefined') return;
  const entries = JSON.parse(document.getElementById('catalog-data').textContent);
  const form = document.getElementById('filters');
  const search = document.getElementById('search');
  const origin = document.getElementById('origin');
  const count = document.getElementById('result-count');
  const empty = document.getElementById('empty');
  const status = document.getElementById('copy-status');
  const categoryButtons = [...document.querySelectorAll('[data-category]')];
  let category = 'all';
  let statusTimer;
  function applyFilters() {
    let visible = 0;
    entries.forEach(entry => {
      const show = matches(entry, search.value, category, origin.value);
      document.getElementById(entry.id).hidden = !show;
      if (show) visible++;
    });
    count.textContent = `${visible} / ${entries.length} 件`;
    empty.hidden = visible !== 0;
    categoryButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
  }
  form.addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', applyFilters);
  origin.addEventListener('change', applyFilters);
  categoryButtons.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category;
    applyFilters();
  }));
  form.addEventListener('reset', event => {
    event.preventDefault();
    search.value = '';
    origin.value = 'all';
    category = 'all';
    applyFilters();
  });
  // A guide/compare link must still reveal its target after filtering.
  document.querySelectorAll('a[href^="#"]').forEach(anchor => anchor.addEventListener('click', () => {
    const target = document.getElementById(anchor.getAttribute('href').slice(1));
    if (target && target.matches('[data-resource]') && target.hidden) form.reset();
  }));
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const source = document.getElementById(button.dataset.copy);
    let message;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(source.textContent);
      message = '依頼文をコピーしました。';
    } catch (_error) {
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      message = '依頼文を選択しました。Ctrl+C（Macは⌘C）でコピーしてください。';
    }
    clearTimeout(statusTimer);
    status.textContent = message;
    statusTimer = setTimeout(() => { status.textContent = ''; }, 6000);
  }));
  applyFilters();
}());
