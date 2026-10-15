// 保存済みの比較データと実行記録を読み込んで表示する。新しい取得は行わない。

const COMPARISON_PATH = 'outputs/comparison.json';
const COLLECTION_PATH = 'outputs/collection.json';
const REQUEST_PATH = 'request.txt';

const CATEGORIES = {
  source: '原典で確認',
  runtime: '今回実際に読んだ',
  unknown: '未確認',
};
const FILTERS = ['all', ...Object.keys(CATEGORIES)];
const REPO_BLOB = 'https://github.com/Panniantong/Agent-Reach/blob/';

const $ = (selector) => document.querySelector(selector);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'className') node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child !== null && child !== undefined && child !== '') node.append(child);
  }
  return node;
}

async function loadJSON(path) {
  let res;
  try {
    res = await fetch(path, { cache: 'no-store' });
  } catch (err) {
    throw new Error(`${path} を読み込めませんでした（${err.message}）。`);
  }
  if (!res.ok) throw new Error(`${path} の読み込みに失敗しました（HTTP ${res.status}）。`);
  try {
    return await res.json();
  } catch {
    throw new Error(`${path} をJSONとして読めませんでした。`);
  }
}

function isText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// 外部リンクは固定コミットのGitHubとXの投稿だけ、内部リンクは相対パスだけを許可する。
function checkHref(raw, commit) {
  if (!isText(raw)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//');
  if (!hasScheme) return raw.startsWith('/') ? null : raw;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname === 'github.com') {
    return raw.startsWith(`${REPO_BLOB}${commit}/`) ? url.href : null;
  }
  if (url.hostname === 'x.com') return url.href;
  return null;
}

function validateComparison(data) {
  if (!data || typeof data !== 'object') throw new Error(`${COMPARISON_PATH} の中身が空です。`);
  if (!isText(data.source_commit)) throw new Error(`${COMPARISON_PATH} に source_commit がありません。`);
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error(`${COMPARISON_PATH} に根拠カードがありません。`);
  }
  for (const item of data.items) {
    const where = `${COMPARISON_PATH} の ${item && item.id ? item.id : '（idなし）'}`;
    if (!item || !isText(item.id)) throw new Error(`${where}：id がありません。`);
    if (!(item.category in CATEGORIES)) throw new Error(`${where}：分類「${item.category}」は使えません。`);
    for (const key of ['label', 'finding', 'basis', 'caution']) {
      if (!isText(item[key])) throw new Error(`${where}：${key} がありません。`);
    }
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
      throw new Error(`${where}：根拠リンクがありません。`);
    }
    for (const ev of item.evidence) {
      if (!ev || !isText(ev.label) || !checkHref(ev.url, data.source_commit)) {
        throw new Error(`${where}：根拠リンク「${ev && ev.url}」は固定版の原典・投稿URL・保存データのいずれでもありません。`);
      }
    }
  }
}

function validateCollection(data) {
  const fail = (what) => {
    throw new Error(`${COLLECTION_PATH} に ${what} がありません。`);
  };
  if (!data || typeof data !== 'object') fail('データ');
  if (!data.repository || !isText(data.repository.commit)) fail('repository.commit');
  if (!data.doctor || !data.doctor.github || !data.doctor.twitter) fail('doctor の判定');
  if (!isText(data.doctor.github.status) || !isText(data.doctor.twitter.status)) fail('doctor の status');
  if (!data.post || !isText(data.post.id)) fail('post.id');
  if (!Array.isArray(data.executions) || data.executions.length === 0) fail('executions');
  if (!isText(data.collected_at)) fail('collected_at');
}

function formatUtc(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

function formatJst(iso) {
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function backendText(value) {
  return value === null || value === undefined ? 'null' : String(value);
}

function describeHref(href) {
  if (href.startsWith(REPO_BLOB)) {
    const [pathPart, hash = ''] = href.slice(REPO_BLOB.length).split('#');
    const path = pathPart.split('/').slice(1).join('/');
    const m = hash.match(/^L(\d+)(?:-L(\d+))?$/);
    const lines = m ? (m[2] ? ` ${m[1]}–${m[2]}行` : ` ${m[1]}行`) : '';
    return `GitHub 固定版 ${path}${lines}`;
  }
  if (href.startsWith('https://x.com/')) return 'X の公開投稿';
  return `保存データ ${href}`;
}

// ---- 実行結果の要約 ----

function fact(term, valueNodes) {
  return el('div', {}, [el('dt', { text: term }), el('dd', {}, valueNodes)]);
}

function doctorValue(entry) {
  const status = String(entry.status);
  return [
    el('span', { className: status === 'ok' ? 'status-tag ok' : 'status-tag', text: status }),
    el('span', { className: 'sub', text: `active_backend: ${backendText(entry.active_backend)}` }),
  ];
}

function renderFacts(collection) {
  const facts = $('#facts');
  const repo = collection.repository;
  const post = collection.post;
  const jst = formatJst(collection.collected_at);
  facts.replaceChildren(
    fact('固定コミット', [el('span', { className: 'hash', text: repo.commit })]),
    fact('取得日時', [
      formatUtc(collection.collected_at),
      jst ? el('span', { className: 'sub', text: `日本時間 ${jst}` }) : null,
    ]),
    fact('doctor：GitHub', doctorValue(collection.doctor.github)),
    fact('doctor：X', doctorValue(collection.doctor.twitter)),
    fact('原典の照合', [
      `${repo.files_verified}ファイル`,
      el('span', { className: 'sub', text: `gh APIで取得し、Git上の本文とSHA-256一致（${repo.license}）` }),
    ]),
    fact('紹介投稿', [
      `対象 ${post.returned_target_posts}件・本文${post.body_present ? 'あり' : 'なし'}`,
      el('span', {
        className: 'sub',
        text: `ID ${post.id}・本文は${post.body_republished ? '掲載' : '転載していません'}`,
      }),
    ]),
  );
  facts.hidden = false;
}

function renderSequence(collection, comparison) {
  const runs = collection.executions;
  const doctorRun = runs.find((r) => r.step === 'doctor');
  const ghRuns = runs.filter((r) => Array.isArray(r.command) && r.command[0] === 'gh');
  const postRun = runs.find((r) => r.step === 'post');
  const { github, twitter } = collection.doctor;

  $('#sequence-date').textContent = `実行日時は ${formatUtc(collection.collected_at)}。`;

  $('#step-doctor').textContent =
    `agent-reach doctor --json を実行${doctorRun ? `（終了コード ${doctorRun.exit_code}）` : ''}。` +
    `GitHub は ${github.status}／active_backend: ${backendText(github.active_backend)}、` +
    `X は ${twitter.status}／active_backend: ${backendText(twitter.active_backend)}。判定は書き換えずに記録。`;

  const ghAllZero = ghRuns.length > 0 && ghRuns.every((r) => r.exit_code === 0);
  $('#step-read').textContent =
    `gh api を${ghRuns.length}回（原典${collection.repository.files_verified}ファイルを含む）、` +
    `${ghAllZero ? 'すべて終了コード0' : '終了コード0以外の呼び出しあり'}。` +
    (postRun
      ? `twitter-cliで公開投稿${collection.post.returned_target_posts}件を取得（終了コード ${postRun.exit_code}、本文${collection.post.body_present ? 'あり' : 'なし'}）。`
      : '投稿の取得記録はありません。');

  const counts = countByCategory(comparison.items);
  $('#step-sort').textContent =
    `${comparison.items.length}枚に分類：` +
    Object.entries(CATEGORIES)
      .map(([key, label]) => `${label} ${counts[key]}`)
      .join('・') +
    '。紹介投稿の説明は機能の根拠にしていません。';

  $('#step-save').textContent =
    '調査メモ（outputs/research-note.md）と比較データ（outputs/comparison.json）を保存。ページ上部のボタンから同じメモをダウンロードできます。';

  $('#sequence').hidden = false;
}

// ---- 根拠カード ----

function countByCategory(items) {
  const counts = { all: items.length };
  for (const key of Object.keys(CATEGORIES)) counts[key] = 0;
  for (const item of items) counts[item.category] += 1;
  return counts;
}

function renderCard(item, commit) {
  const links = item.evidence.map((ev) => {
    const href = checkHref(ev.url, commit);
    return el('li', {}, [
      el('a', { href, text: ev.label }),
      el('span', { className: 'where', text: describeHref(href) }),
    ]);
  });

  return el('article', { className: 'card', id: `card-${item.id}`, 'data-category': item.category }, [
    el('h3', { text: item.label }),
    el('p', { className: `cat cat-${item.category}`, text: CATEGORIES[item.category] }),
    el('dl', {}, [
      el('dt', { text: 'わかったこと' }),
      el('dd', { text: item.finding }),
      el('dt', { text: '根拠の読み方' }),
      el('dd', { text: item.basis }),
    ]),
    el('div', { className: 'evidence' }, [el('h4', { text: '根拠を開く' }), el('ul', {}, links)]),
    el('p', { className: 'caution' }, [el('strong', { text: '注意' }), item.caution]),
  ]);
}

function setupFilters(comparison) {
  const counts = countByCategory(comparison.items);
  const cards = comparison.items.map((item) => ({
    category: item.category,
    node: renderCard(item, comparison.source_commit),
  }));
  $('#cards').replaceChildren(...cards.map((c) => c.node));

  const buttons = [...document.querySelectorAll('.filter')];
  for (const span of document.querySelectorAll('[data-count]')) {
    span.textContent = `（${counts[span.dataset.count]}件）`;
  }

  const resultCount = $('#result-count');
  const apply = (filter) => {
    let shown = 0;
    for (const card of cards) {
      const visible = filter === 'all' || card.category === filter;
      card.node.hidden = !visible;
      if (visible) shown += 1;
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    }
    resultCount.textContent =
      filter === 'all'
        ? `全${counts.all}件を表示しています。`
        : `「${CATEGORIES[filter]}」の${shown}件を表示しています（全${counts.all}件）。`;
  };

  const hashFilter = () => {
    const value = location.hash.slice(1);
    return FILTERS.includes(value) ? value : null;
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      if (hashFilter() === filter) apply(filter);
      else location.hash = filter;
    });
  }

  // ページ内リンクで別のハッシュに移っても、絞り込みの状態は保つ。
  window.addEventListener('hashchange', () => {
    const filter = hashFilter();
    if (filter) apply(filter);
  });

  apply(hashFilter() || 'all');
}

// ---- 技術情報 ----

function renderTechnical(collection) {
  const list = $('#executions');
  list.replaceChildren(
    ...collection.executions.map((run) =>
      el('li', {}, [
        el('strong', { text: run.step }),
        ' ',
        el('code', { text: Array.isArray(run.command) ? run.command.join(' ') : '' }),
        el('span', {
          className: 'meta',
          text: `終了コード ${run.exit_code}・stdout SHA-256 ${run.stdout_sha256 || '記録なし'}`,
        }),
      ]),
    ),
  );

  const v = collection.versions || {};
  const rows = [
    ['Python', v.python],
    ['gh', v.gh_version],
    ['twitter-cli', v.twitter_cli],
    ['agent-reach（環境の表記）', v.agent_reach_installed],
    ['実行した原典', v.executed_agent_reach_source],
  ].filter(([, value]) => isText(value));
  $('#versions').replaceChildren(
    ...rows.map(([term, value]) => el('div', {}, [el('dt', { text: term }), el('dd', { text: value })])),
  );

  if (isText(collection.credential_handling)) {
    $('#credential-note').textContent = `認証の扱い：${collection.credential_handling}`;
  }
  if (isText(collection.warning)) {
    $('#warning-note').textContent = `受け取った警告：${collection.warning}`;
  }

  const unverified = Array.isArray(collection.unverified) ? collection.unverified.filter(isText) : [];
  $('#unverified-list').replaceChildren(...unverified.map((text) => el('li', { text: `未確認：${text}` })));
}

// ---- 依頼文 ----

async function loadRequest() {
  const pre = $('#request-text');
  const copyButton = $('#copy-request');
  const status = $('#copy-status');
  const errorBox = $('#request-error');
  try {
    const res = await fetch(REQUEST_PATH, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!isText(text)) throw new Error('中身が空です');
    pre.textContent = text;
    pre.hidden = false;
    if (navigator.clipboard && window.isSecureContext) {
      copyButton.hidden = false;
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          status.textContent = '依頼文をコピーしました。';
        } catch {
          status.textContent = 'コピーできませんでした。下の依頼文を選択してコピーしてください。';
        }
      });
    }
  } catch (err) {
    errorBox.textContent = `依頼文（${REQUEST_PATH}）を読み込めませんでした（${err.message}）。「request.txt を保存」から直接開けます。`;
    errorBox.hidden = false;
  }
}

// ---- 起動 ----

function showError(err) {
  const box = $('#load-error');
  box.replaceChildren(
    el('p', { text: `保存データを表示できません：${err.message}` }),
    el('p', {
      text:
        location.protocol === 'file:'
          ? 'file:// で開くとブラウザーがデータの読み込みを止めます。README.md の手順でHTTPサーバーから開いてください。'
          : '調査メモ（Markdown）は上のボタンから直接ダウンロードできます。',
    }),
  );
  box.hidden = false;
}

async function main() {
  const status = $('#load-status');
  loadRequest();
  try {
    const [comparison, collection] = await Promise.all([loadJSON(COMPARISON_PATH), loadJSON(COLLECTION_PATH)]);
    validateComparison(comparison);
    validateCollection(collection);
    if (comparison.source_commit !== collection.repository.commit) {
      throw new Error('比較データと実行記録の固定コミットが一致しません。');
    }

    renderFacts(collection);
    renderSequence(collection, comparison);
    $('#comparison-summary').textContent = comparison.summary || '';
    $('#scope-note').textContent = comparison.scope_note || '';
    if (isText(comparison.updated_on)) $('#updated-on').textContent = comparison.updated_on;
    setupFilters(comparison);
    renderTechnical(collection);
    $('#evidence').hidden = false;
    status.hidden = true;
    // Article sample links arrive before the asynchronously loaded cards exist.
    // Resolve their actual card fragment only after the results are visible.
    const cardTarget = location.hash.startsWith('#card-')
      ? document.getElementById(location.hash.slice(1)) : null;
    if (cardTarget && cardTarget.matches('.card') && !cardTarget.hidden) {
      cardTarget.scrollIntoView({block: 'start'});
    }
  } catch (err) {
    status.hidden = true;
    showError(err);
  }
}

main();
