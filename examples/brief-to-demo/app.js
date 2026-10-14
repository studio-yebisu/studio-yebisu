/* brief-to-demo viewer. Shows three briefs produced in advance; nothing here calls an AI. */
(() => {
  'use strict';

  const CATEGORY_LABELS = {'ui-ux': 'UI・UX', slides: 'AIスライド', motion: 'モーション', agents: 'エージェント・便利スキル'};
  // Field order and Japanese labels follow the JSON shape in skills/brief-to-demo/SKILL.md.
  const FIELDS = [
    ['audience', '見る人', 'text'],
    ['goal', '目的', 'text'],
    ['inputs', '渡す素材', 'list'],
    ['skill_refs', '読むスキル', 'refs'],
    ['deliverables', '成果物', 'list'],
    ['steps', '手順', 'steps'],
    ['acceptance', '完成条件', 'checks'],
    ['assumptions', '仮に決めたこと', 'assume']
  ];

  const $ = (selector, root = document) => root.querySelector(selector);

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  const announcer = $('[data-announce]');
  function announce(message) {
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = message; }, 30);
  }

  const tabs = $('[data-tabs]');
  const panel = $('[data-panel]');
  let samples = [];
  let current = null;

  function handoffText(brief) {
    return [
      '次の制作ブリーフに沿って制作してください。',
      '1. skill_refs にあるSKILL.mdや資料を、作り始める前に読んでください。',
      '2. 未指定の条件は assumptions に分け、依頼の範囲で進めてください。成果を左右する未解決の選択だけ確認してください。',
      '3. 完成したら、acceptance の条件を一つずつ満たしたか報告してください。',
      '',
      JSON.stringify(brief, null, 2)
    ].join('\n');
  }

  function fieldValue(kind, value) {
    const items = Array.isArray(value) ? value : [value];
    if (kind === 'text') return h('p', {}, String(value || ''));
    if (kind === 'steps') return h('ol', {class: 'f-steps'}, items.map(item => h('li', {}, item)));
    if (kind === 'checks') return h('ul', {class: 'f-checks'}, items.map(item => h('li', {}, item)));
    if (kind === 'assume') return h('ul', {class: 'f-assume'}, items.map(item => h('li', {}, item)));
    if (kind === 'refs') return h('ul', {class: 'f-list'}, items.map(item => h('li', {}, skillRef(item))));
    return h('ul', {class: 'f-list'}, items.map(item => h('li', {}, item)));
  }

  function skillRef(ref) {
    return /^https?:\/\//i.test(ref) ? h('a', {href: ref}, ref.replace(/^https?:\/\//, '')) : h('code', {}, ref);
  }

  function render(sample) {
    const brief = sample.brief;
    const route = sample.route || {};
    current = sample;

    $('[data-cat-name]').textContent = route.category_label || CATEGORY_LABELS[brief.category] || brief.category;
    $('[data-reason]').textContent = route.reason || '';
    const skills = route.skills && route.skills.length
      ? route.skills
      : (brief.skill_refs || []).map(ref => ({name: ref, ref, why: ''}));
    $('[data-skills]').replaceChildren(...skills.map(skill =>
      h('li', {}, h('strong', {}, skill.name), skill.ref ? h('span', {class: 'skill-ref'}, skillRef(skill.ref)) : null, skill.why ? h('span', {class: 'skill-why'}, skill.why) : null)));

    $('[data-title]').textContent = brief.title;
    $('[data-request]').textContent = brief.request;
    $('[data-fields]').replaceChildren(...FIELDS.filter(([key]) => brief[key] !== undefined).map(([key, label, kind]) =>
      h('div', {class: 'field field-' + key},
        h('dt', {}, h('span', {class: 'field-label'}, label), h('span', {class: 'field-key'}, key)),
        h('dd', {}, fieldValue(kind, brief[key])))));
    $('[data-json]').textContent = JSON.stringify(brief, null, 2);

    for (const tab of tabs.querySelectorAll('[role="tab"]')) {
      const selected = tab.dataset.id === sample.id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) panel.setAttribute('aria-labelledby', tab.id);
    }
    panel.hidden = false;
  }

  function select(id, options = {}) {
    const sample = samples.find(item => item.id === id) || samples[0];
    if (!sample) return;
    render(sample);
    if (options.updateHash) history.replaceState(null, '', '#' + sample.id);
    if (options.focus) document.getElementById('tab-' + sample.id).focus();
  }

  function onKey(event) {
    const list = Array.from(tabs.querySelectorAll('[role="tab"]'));
    const index = list.indexOf(event.currentTarget);
    let next = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = list[(index + 1) % list.length];
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = list[(index - 1 + list.length) % list.length];
    else if (event.key === 'Home') next = list[0];
    else if (event.key === 'End') next = list[list.length - 1];
    if (!next) return;
    event.preventDefault();
    select(next.dataset.id, {updateHash: true, focus: true});
  }

  async function copy(button) {
    if (!current) return;
    const text = handoffText(current.brief);
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
    button.textContent = ok ? 'コピーしました' : 'コピーできませんでした';
    announce(ok ? '依頼文をコピーしました。' : 'コピーできませんでした。下の「JSONをそのまま見る」から選択してコピーしてください。');
    clearTimeout(button._reset);
    button._reset = setTimeout(() => { button.textContent = '依頼文をコピー'; }, 2200);
  }

  function download() {
    if (!current) return;
    const blob = new Blob([JSON.stringify(current.brief, null, 2) + '\n'], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = h('a', {href: url, download: 'brief-' + current.id + '.json'});
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('brief-' + current.id + '.json を保存しました。');
  }

  async function start() {
    try {
      const response = await fetch('samples.json', {cache: 'no-cache'});
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      samples = (data.samples || []).filter(item => item && item.id && item.brief);
      if (!samples.length) throw new Error('empty');
    } catch (_) {
      tabs.replaceChildren(h('p', {class: 'state', role: 'alert'}, 'サンプルを読み込めませんでした。ページを再読み込みしてください。'),
        h('button', {type: 'button', class: 'btn btn-line', onclick: () => location.reload()}, '再読み込み'));
      return;
    }

    tabs.replaceChildren(...samples.map(sample => {
      const tab = h('button', {type: 'button', role: 'tab', id: 'tab-' + sample.id, class: 'tab', 'data-id': sample.id, 'aria-controls': 'panel', 'aria-selected': 'false', tabindex: '-1'},
        h('span', {class: 'tab-label'}, sample.label + '　' + (CATEGORY_LABELS[sample.brief.category] || sample.brief.category)),
        h('q', {class: 'tab-request'}, sample.brief.request));
      tab.addEventListener('click', () => select(sample.id, {updateHash: true}));
      tab.addEventListener('keydown', onKey);
      return tab;
    }));
    select(location.hash.slice(1));
  }

  $('[data-copy]').addEventListener('click', event => copy(event.currentTarget));
  $('[data-download]').addEventListener('click', download);
  window.addEventListener('hashchange', () => { if (samples.length) select(location.hash.slice(1)); });

  start();
})();
