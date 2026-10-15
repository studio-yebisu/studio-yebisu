/* Studio Yebisu — article page. case.html?id=<case-id> or case.html?entry=<catalog-id>. */
(() => {
  'use strict';

  const STATUS_LABELS = {draft: '制作中', produced: '制作済み', rendered: '動画を書き出し済み', reviewed: '確認済み', published: '掲載済み'};
  const MODEL_LABELS = {'claude-opus-5-5': 'Claude Opus 5.5'};
  // Extra files that belong to a case but are not part of the case schema.
  const CASE_EXTRAS = {
    'brief-to-demo': {
      videoNote: '28秒、音声なし。「イベント受付を使いやすくしたい」がブリーフになり、AIへ渡すまで。',
      videoSource: 'examples/brief-to-demo/video/index.html',
      skillLicense: 'skills/brief-to-demo/LICENSE'
    }
  };
  const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
  const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

  const $ = (selector, root = document) => root.querySelector(selector);
  const root = $('[data-root]');

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

  function safeHref(value) {
    if (typeof value !== 'string') return null;
    const url = value.trim();
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return null;
    return url;
  }

  async function loadJSON(url) {
    const response = await fetch(url, {cache: 'no-cache'});
    if (!response.ok) throw new Error(url + ' ' + response.status);
    return response.json();
  }

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
    announce(ok ? 'コピーしました。' : 'コピーできませんでした。文章を選択してコピーしてください。');
    clearTimeout(button._reset);
    button._reset = setTimeout(() => { button.textContent = original; }, 2200);
  }

  function promptBlock(text, label) {
    const copy = h('button', {type: 'button', class: 'btn btn-ink', onclick: () => copyText(text, copy)}, '依頼文をコピー');
    return h('div', {class: 'prompt'},
      h('pre', {tabindex: '0', 'aria-label': label}, text),
      h('div', {class: 'prompt-bar'}, h('span', {class: 'prompt-label'}, label), copy));
  }

  /* ---------- Catalog and categories ---------- */

  // Category labels come from catalog.categories (fallback: data/categories.json), never from this file.
  const categories = Object.create(null);
  let catalogPromise = null;

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = (async () => {
        const data = await loadJSON('data/catalog.json');
        const entries = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);
        let list = !Array.isArray(data) && Array.isArray(data.categories) ? data.categories : [];
        if (!list.length) {
          try {
            const extra = await loadJSON('data/categories.json');
            list = Array.isArray(extra.categories) ? extra.categories : [];
          } catch (_) { list = []; }
        }
        const ordered = [];
        for (const category of list) {
          if (!category || typeof category.id !== 'string' || !category.id || categories[category.id]) continue;
          categories[category.id] = category;
          ordered.push(category);
        }
        return {entries, categories: ordered};
      })();
    }
    return catalogPromise;
  }

  async function loadCases() {
    try {
      const data = await loadJSON('data/cases.json');
      return (Array.isArray(data) ? data : (Array.isArray(data.cases) ? data.cases : [])).filter(item => item && item.id);
    } catch (_) {
      return [];
    }
  }

  const categoryLabel = id => (categories[id] && categories[id].label) || id || '分類なし';
  const categoryHref = id => './#' + encodeURIComponent(categories[id] ? id : 'catalog');

  function sourceLabel(entry) {
    const id = entry.source_project;
    if (id === 'curated') return 'Studio Yebisu 原典確認済みの紹介';
    if (!id) return 'Studio Yebisu 統合カタログ';
    return categories[id] ? 'Studio Yebisu ' + categoryLabel(id) + 'のカタログ' : String(id);
  }

  function renderFooterCategories(list) {
    const nav = $('[data-colophon-cats]');
    if (!nav || !list.length) return;
    nav.replaceChildren(...list.map(category => h('a', {href: './#' + encodeURIComponent(category.id)}, category.label || category.id)));
  }

  function show(...nodes) {
    root.replaceChildren(...nodes);
    root.removeAttribute('aria-busy');
  }

  function showState(title, body) {
    document.title = title + '｜Studio Yebisu';
    show(h('div', {class: 'page-state'},
      h('h1', {class: 'empty-title'}, title),
      h('p', {}, body),
      h('a', {class: 'btn btn-ink', href: './#catalog'}, 'カタログを開く')));
  }

  function section(id, title, ...children) {
    return h('section', {class: 'a-section', id, 'aria-labelledby': id + '-title'}, h('h2', {id: id + '-title'}, title), ...children);
  }

  /* ---------- Produced case ---------- */

  async function findCase(id) {
    const found = (await loadCases()).find(item => item.id === id);
    if (found) return found;
    try {
      const single = await loadJSON('data/cases/' + encodeURIComponent(id) + '.json');
      if (single && single.id === id) return single;
    } catch (_) { /* not found */ }
    return null;
  }

  function videoBlock(item, extras) {
    const video = safeHref(item.video);
    if (!video) return null;
    const poster = safeHref(item.poster);
    const figure = h('figure');
    const player = h('video', {controls: true, preload: 'metadata', playsinline: true, poster, 'aria-label': (item.title || '') + 'の解説動画'},
      h('source', {src: video, type: 'video/mp4'}));
    const fail = () => {
      if (!player.isConnected) return;
      player.replaceWith(h('p', {class: 'video-fallback'}, '動画を読み込めませんでした。時間をおいて開き直してください。'));
    };
    player.addEventListener('error', fail);
    $('source', player).addEventListener('error', fail);
    figure.append(player, h('figcaption', {},
      h('span', {}, extras.videoNote || '使い方の解説動画'),
      h('span', {}, h('a', {href: video, download: ''}, 'MP4を保存'), extras.videoSource ? ['　', h('a', {href: extras.videoSource}, '映像のソースを開く')] : null)));
    return h('div', {class: 'article-video'}, figure);
  }

  function sampleRow(sample, demo) {
    const brief = sample.brief || {};
    const route = sample.route || {};
    const skills = (route.skills || []).map(skill => skill.name).filter(Boolean);
    const acceptance = (brief.acceptance || []).slice(0, 3);
    const assumptions = (brief.assumptions || []).slice(0, 1);
    return h('li', {class: 'sample'},
      h('div', {class: 'sample-in'},
        h('span', {class: 'sample-label'}, '入力　' + (sample.label || '')),
        h('q', {}, brief.request || '')),
      h('div', {class: 'sample-out'},
        h('dl', {},
          h('dt', {}, '題名'), h('dd', {}, brief.title || ''),
          h('dt', {}, '分野'), h('dd', {}, route.category_label || categoryLabel(brief.category)),
          h('dt', {}, '読むスキル'), h('dd', {}, skills.join('、') || (brief.skill_refs || []).join('、')),
          h('dt', {}, '目的'), h('dd', {}, brief.goal || ''),
          h('dt', {}, '完成条件'), h('dd', {}, h('ul', {}, acceptance.map(text => h('li', {}, text)))),
          assumptions.length ? [h('dt', {}, '仮の条件'), h('dd', {}, assumptions[0])] : null),
        demo ? h('a', {href: demo + '#' + encodeURIComponent(sample.id)}, 'このブリーフをデモで全部見る') : null));
  }

  function samplePairRow(sample, demo) {
    const value = data => typeof data === 'string' ? h('p', {}, data) : h('pre', {class: 'sample-value', tabindex: '0'}, JSON.stringify(data, null, 2));
    return h('li', {class: 'sample'},
      h('div', {class: 'sample-in'}, h('span', {class: 'sample-label'}, sample.label || sample.id),
        h('span', {class: 'sample-label'}, '入力'), value(sample.input)),
      h('div', {class: 'sample-out'}, h('span', {class: 'sample-label'}, '結果'), value(sample.output),
        demo ? h('a', {href: demo + '#' + encodeURIComponent(sample.id)}, 'この作例を開く') : null));
  }

  async function renderCase(item) {
    const extras = {
      ...(CASE_EXTRAS[item.id] || {}),
      ...(item.video_note ? {videoNote: item.video_note} : {}),
      ...(safeHref(item.video_source) ? {videoSource: safeHref(item.video_source)} : {}),
      ...(safeHref(item.skill_license) ? {skillLicense: safeHref(item.skill_license)} : {})
    };
    const pairs = item.sample_format === 'input-output';
    const demo = safeHref(item.demo);
    const skill = safeHref(item.skill);
    const samplesUrl = safeHref(item.samples);
    document.title = (item.title || item.id) + '｜Studio Yebisu';

    const head = h('header', {class: 'article-head'},
      h('nav', {class: 'article-crumbs', 'aria-label': 'パンくず'},
        h('a', {href: './'}, 'トップ'),
        h('a', {href: categoryHref(item.category)}, categoryLabel(item.category))),
      h('h1', {class: 'article-title'}, Array.isArray(item.title_lines) && item.title_lines.length
        ? item.title_lines.flatMap((line, index) => [index ? h('br') : null, line])
        : item.id === 'brief-to-demo' ? ['ひと言を、', h('br'), '作れる依頼に。'] : (item.title || item.id)),
      h('p', {class: 'article-lead'}, item.summary || ''),
      h('dl', {class: 'article-facts'},
        h('dt', {}, '分野'), h('dd', {}, categoryLabel(item.category)),
        item.model ? [h('dt', {}, '制作モデル'), h('dd', {}, MODEL_LABELS[item.model] || item.model)] : null,
        item.status ? [h('dt', {}, '状態'), h('dd', {}, STATUS_LABELS[item.status] || item.status)] : null,
        item.license ? [h('dt', {}, 'ライセンス'), h('dd', {}, item.license)] : null));

    const toc = [];
    const sections = [];
    const add = (id, title, ...children) => { toc.push([id, title]); sections.push(section(id, title, ...children)); };

    if (demo) {
      add('demo', 'デモ',
        h('div', {class: 'demo-callout'},
          h('p', {}, item.demo_description || '実際の依頼を選ぶと、選ばれた分野、読むスキル、できあがったブリーフが並びます。依頼文のコピーとJSONの保存もできます。'),
          h('a', {class: 'btn btn-ink', href: demo}, 'デモを開く')),
        h('p', {class: 'd-note'}, item.demo_note || 'デモに表示されるのは、事前に制作したサンプルです。ページ上でAIを実行することはありません。'));
    }

    let samples = [];
    if (samplesUrl) {
      try {
        const data = await loadJSON(samplesUrl);
        samples = Array.isArray(data.samples) ? data.samples : [];
      } catch (_) { samples = []; }
    }
    if (samples.length) {
      add('examples', item.samples_title || (pairs ? '実入力と結果' : samples.length + 'つの依頼と、できたブリーフ'),
        h('p', {}, item.samples_intro || (pairs ? '作例で使った入力と、表示する結果です。' : 'どれも依頼の文はそのまま残し、成果物から分野を選んでいます。依頼にない日時や名前は書かず、仮の条件として分けました。')),
        h('ol', {class: 'samples'}, samples.map(sample => pairs ? samplePairRow(sample, demo) : sampleRow(sample, demo))));
    }

    if (item.request) {
      add('prompt', 'AIへの頼み方',
        h('p', {}, item.request_intro || 'SKILL.mdを読み込めるAIに、次の文章を渡します。最後の「依頼：」の部分を、自分の言葉に置き換えて使ってください。'),
        promptBlock(item.request, '依頼文の例'));
    }

    if (Array.isArray(item.steps) && item.steps.length) {
      add('method', '制作の方法',
        h('ol', {class: 'steps'}, item.steps.map(step => h('li', {}, h('h3', {}, step.title || ''), h('p', {}, step.body || '')))));
    }

    if (Array.isArray(item.applied_skills) && item.applied_skills.length) {
      add('skills', '使ったスキルと、使い方',
        h('dl', {class: 'applied'}, item.applied_skills.map(applied => {
          const source = safeHref(applied.source);
          return h('div', {},
            h('dt', {}, applied.name || '', source ? h('small', {}, h('a', {href: source}, applied.source)) : (applied.source ? h('small', {}, applied.source) : null)),
            h('dd', {}, applied.applied || ''));
        })));
    }

    const downloads = [
      skill && ['スキル（SKILL.md）', 'AIに読ませる手順書', skill],
      extras.skillLicense && ['スキルのライセンス', '原典の利用条件', extras.skillLicense],
      samplesUrl && [pairs ? '実入力と結果（JSON）' : samples.length + '件のブリーフ（JSON）', 'デモで表示しているサンプル', samplesUrl],
      ['この作例の記録（JSON）', '手順・使ったスキル・出典', 'data/cases/' + encodeURIComponent(item.id) + '.json'],
      extras.videoSource && ['映像のソース', 'ブラウザで開いて再生・確認できます', extras.videoSource]
    ].filter(Boolean);
    add('downloads', 'ダウンロード',
      h('div', {class: 'downloads'}, downloads.map(([label, note, href]) =>
        h('a', {href, download: /\.(md|json)$/i.test(href) || /LICENSE$/.test(href) ? '' : null}, h('strong', {}, label), h('span', {}, note)))));

    if (Array.isArray(item.limitations) && item.limitations.length) {
      add('limits', 'できないことと注意', h('ul', {class: 'limits'}, item.limitations.map(text => h('li', {}, text))));
    }

    const sources = (item.sources || []).map(source => [source.label, safeHref(source.url)]).filter(([, url]) => url);
    add('sources', '出典とライセンス',
      sources.length ? h('div', {class: 'd-links'}, sources.map(([label, url]) => h('a', {href: url}, h('span', {}, label || url), h('small', {}, url.replace(/^https?:\/\//, ''))))) : null,
      h('p', {class: 'd-note'}, item.license_note || ((item.license ? 'この作例のスキル・サンプル・映像ソースは ' + item.license + ' License です。' : '') + '外部の原典は、それぞれのライセンスに従います。')));

    const tocNav = h('nav', {class: 'toc', 'aria-label': '目次'},
      h('p', {}, '目次'),
      h('ol', {}, toc.map(([id, title]) => h('li', {}, h('a', {href: '#' + id}, title)))));

    show(head, videoBlock(item, extras), h('div', {class: 'article-body'}, tocNav, h('div', {class: 'article-main'}, sections)));
  }

  /* ---------- Imported catalog entry ---------- */

  // A catalog entry counts as produced only when a Studio Yebisu case points to it.
  function caseForEntry(entry, cases) {
    const direct = cases.find(item => item.catalog_entry && item.catalog_entry.id === entry.id);
    if (direct) return direct;
    const match = typeof entry.guide_url === 'string' && /^case\.html\?id=([a-z0-9._-]+)(?:[&#]|$)/i.exec(entry.guide_url.trim());
    return match ? cases.find(item => item.id === match[1]) || null : null;
  }

  function renderEntry(entry, produced) {
    document.title = (entry.name || entry.id) + '｜Studio Yebisu';
    const skill = String(entry.kind || '').trim() === 'スキル';
    const category = categories[entry.category];
    const caseHref = produced ? 'case.html?id=' + encodeURIComponent(produced.id) : null;
    const image = safeHref(entry.image);
    let media = null;
    if (image) {
      media = h('figure', {class: 'd-media'});
      const el = VIDEO_EXT.test(image)
        ? h('video', {src: image, controls: true, preload: 'none', playsinline: true, 'aria-label': (entry.name || '') + (produced ? 'の作例動画' : 'の動画')})
        : h('img', {src: image, alt: (entry.name || '') + (produced ? 'の作例画像' : 'の紹介画像'), decoding: 'async'});
      el.addEventListener('error', () => media.classList.add('is-missing'));
      media.append(el);
    }

    const hasPrompt = typeof entry.prompt === 'string' && entry.prompt.trim();
    const guide = safeHref(entry.guide_url) || safeHref(entry.source_url);
    const prompt = hasPrompt ? entry.prompt.trim() : [
      (entry.name || entry.id) + ' を使いたいです。',
      'まず原典の説明' + (guide ? '（' + guide + '）' : '') + 'を読み、次の用途に合うか確かめてから進めてください。',
      entry.use_case ? '用途：' + entry.use_case : '',
      '完成したら、何を作ったかと、確かめた方法を短く教えてください。'
    ].filter(Boolean).join('\n');

    const license = safeHref(entry.license_url);
    const source = safeHref(entry.source_url);
    const selfPage = 'case.html?entry=' + encodeURIComponent(entry.id);
    const links = [
      ['原典', entry.source_url],
      ['使い方の案内', entry.guide_url === caseHref || entry.guide_url === selfPage ? null : entry.guide_url],
      ['制作した作例の記事', caseHref],
      [produced ? '作例を開く' : '掲載元の見本', entry.example_url === selfPage ? null : entry.example_url],
      ['スキルをダウンロード', entry.skill_download]
    ].map(([label, url]) => [label, safeHref(url)]).filter(([, url]) => url);

    const head = h('header', {class: 'article-head'},
      h('nav', {class: 'article-crumbs', 'aria-label': 'パンくず'},
        h('a', {href: './'}, 'トップ'),
        h('a', {href: categoryHref(entry.category)}, categoryLabel(entry.category))),
      h('div', {},
        h('p', {class: 'd-meta'},
          h('span', {class: 'entry-kind'}, h('span', {class: 'mark ' + (skill ? 'mark-skill' : 'mark-support'), 'aria-hidden': 'true'}), entry.kind || 'その他'),
          h('span', {}, categoryLabel(entry.category)),
          caseHref ? h('a', {class: 'entry-case', href: caseHref}, '制作した作例あり') : null),
        h('h1', {class: 'article-title article-title-entry'}, entry.name || entry.id)),
      h('p', {class: 'article-lead'}, entry.summary || ''),
      h('dl', {class: 'article-facts'},
        h('dt', {}, '分野'), h('dd', {}, h('a', {href: categoryHref(entry.category)}, categoryLabel(entry.category)), category && category.group ? '（' + category.group + '）' : null),
        h('dt', {}, '種類'), h('dd', {}, entry.kind || 'その他'),
        h('dt', {}, '作例'), h('dd', {}, caseHref ? h('a', {href: caseHref}, '制作した作例の記事あり') : entry.verification_stage === 'source-reviewed' ? '紹介のみ（作例は未制作）' : entry.example_url || entry.image ? '掲載元の作例・見本あり' : 'この統合サイトの記事は未掲載')));

    const toc = [];
    const sections = [];
    const add = (id, title, ...children) => { toc.push([id, title]); sections.push(section(id, title, ...children)); };

    if (entry.use_case) add('use', '使いどころ', h('p', {}, entry.use_case));
    if (Array.isArray(entry.workflow) && entry.workflow.length) add('workflow', '最初の試し方', h('ol', {class: 'd-list'}, entry.workflow.map(step => h('li', {}, step))));
    if (Array.isArray(entry.requirements) && entry.requirements.length) add('requirements', '使う環境', h('ul', {class: 'd-list'}, entry.requirements.map(requirement => h('li', {}, requirement))));
    add('prompt', 'AIへの頼み方',
      promptBlock(prompt, hasPrompt ? '依頼文の例' : '依頼文のひな形'),
      hasPrompt ? null : h('p', {class: 'd-note'}, 'この項目には依頼文の例がまだないため、原典を読んでから使うためのひな形を表示しています。'));
    add('conditions', '分類・確認状況・ライセンス',
      h('dl', {class: 'd-facts'},
        h('dt', {}, '分野'), h('dd', {}, categoryLabel(entry.category), category && category.description ? h('span', {class: 'd-note d-inline'}, category.description) : null),
        h('dt', {}, '確認状況'), h('dd', {}, entry.verification || '記載なし'),
        h('dt', {}, '原典'), h('dd', {}, source ? h('a', {href: source}, source.replace(/^https?:\/\//, '')) : '記載なし'),
        h('dt', {}, 'ライセンス'), h('dd', {}, license ? h('a', {href: license}, entry.license || 'ライセンスを見る') : (entry.license || '原典で確認してください')),
        h('dt', {}, '作例'), h('dd', {}, caseHref
          ? h('a', {href: caseHref}, produced.title || 'Studio Yebisuで制作した作例')
          : entry.verification_stage === 'source-reviewed' ? '紹介のみで、作例・動画は未制作です。' : entry.example_url || entry.image ? '掲載元の作例・見本を参照できます。確認した範囲は上記の記録をご覧ください。' : 'この統合サイトの制作記事は未掲載です。')),
      entry.license_note ? h('p', {class: 'd-note'}, entry.license_note) : null);
    if (links.length) {
      add('links', 'リンク', h('div', {class: 'd-links'}, links.map(([label, url]) =>
        h('a', {href: url}, h('span', {}, label), h('small', {}, /^https?:/i.test(url) ? url.replace(/^https?:\/\//, '') : 'このサイト内')))));
    }
    if (Array.isArray(entry.tags) && entry.tags.length) add('tags', 'タグ', h('ul', {class: 'tags'}, entry.tags.map(tag => h('li', {}, tag))));
    add('source-note', '出典について',
      h('p', {}, entry.source_note || ('この項目は、' + sourceLabel(entry) + 'に掲載している情報です。説明は原典をもとに日本語でまとめています。最新の内容と利用条件は原典で確かめてください。')),
      h('div', {class: 'd-cta'}, h('a', {class: 'btn btn-line', href: categoryHref(entry.category)}, categoryLabel(entry.category) + 'の一覧に戻る')));

    show(head, h('div', {class: 'article-body'},
      h('nav', {class: 'toc', 'aria-label': '目次'}, h('p', {}, '目次'), h('ol', {},
        toc.map(([id, title]) => h('li', {}, h('a', {href: '#' + id}, title))))),
      h('div', {class: 'article-main'}, media, sections)));
  }

  /* ---------- Route ---------- */

  async function start() {
    const params = new URLSearchParams(location.search);
    const caseId = params.get('id');
    const entryId = params.get('entry');

    // Labels for every route; the article still renders if the catalog cannot be read.
    const catalog = loadCatalog();
    catalog.then(data => renderFooterCategories(data.categories)).catch(() => {});

    if (caseId) {
      if (!ID_PATTERN.test(caseId)) return showState('作例が見つかりません', 'URLの作例名が正しくありません。カタログから選び直してください。');
      const [item] = await Promise.all([findCase(caseId), catalog.catch(() => null)]);
      if (!item) return showState('作例が見つかりません', '「' + caseId + '」という作例はまだ掲載されていません。カタログから選び直してください。');
      return renderCase(item);
    }

    if (entryId) {
      if (!ID_PATTERN.test(entryId)) return showState('項目が見つかりません', 'URLの項目名が正しくありません。カタログから選び直してください。');
      let entries;
      let cases;
      try {
        [{entries}, cases] = await Promise.all([catalog, loadCases()]);
      } catch (_) {
        return showState('カタログを読み込めませんでした', '通信状態を確かめてから、ページを再読み込みしてください。');
      }
      const entry = entries.find(item => item && item.id === entryId);
      if (!entry) return showState('項目が見つかりません', '「' + entryId + '」はカタログにありません。名前が変わった可能性があります。カタログから探し直してください。');
      return renderEntry(entry, caseForEntry(entry, cases));
    }

    showState('表示する作例が選ばれていません', 'カタログか作例の一覧から、見たいものを選んでください。');
  }

  start().catch(() => showState('ページを表示できませんでした', '時間をおいて、もう一度開いてください。'));
})();
