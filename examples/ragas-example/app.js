/* 凪の図書室 FAQ × Ragas string metrics viewer. Copyright (c) 2026 Studio Yebisu. MIT License.
   Reads the saved input and result JSON, checks that they belong together, and shows them.
   Nothing here runs Ragas or any AI; there is no built-in fallback data. */
'use strict';

(() => {
  const INPUT_URL = 'input/faq-pairs.json';
  const RESULT_URL = 'outputs/evaluation.json';
  const REQUEST_URL = 'request.txt';
  const PIN = Object.freeze({ repository: 'vibrantlabsai/ragas', commit: '298b68274234c060deacab3cf5fb52aa3a20e885' });
  const PRETEND_VERSION = '0.0.0+studio.298b68274234';
  const INPUT_FORMAT = 'studio-yebisu-faq-fixture-v1';
  const RESULT_FORMAT = 'studio-yebisu-ragas-result-v1';
  const EXPORT_FORMAT = 'studio-yebisu-ragas-selection-v1';
  const METRIC_API = 'ragas.metrics.collections';
  const METRIC_IDS = ['exact_match', 'string_similarity', 'string_presence'];
  const BINARY = new Set(['exact_match', 'string_presence']);
  const SIDES = ['before', 'after'];
  const SIDE_LABEL = { before: '変更前', after: '変更後' };
  const LABELS = ['grounded', 'contradiction', 'unsupported_addition'];
  const CHECK_LABELS = new Set(['contradiction', 'unsupported_addition']);
  const SHORT_LABEL = { grounded: '資料と合う', contradiction: '資料と矛盾', unsupported_addition: '根拠のない追記' };
  const CASE_COUNT = 10;
  const DOCUMENT_COUNT = 10;
  const DEFAULT_ID = 'Q07';
  const TOLERANCE = 1e-9;

  const $ = (id) => document.getElementById(id);
  const el = {
    loadState: $('load-state'),
    loadError: $('load-error'),
    loadErrorText: $('load-error-text'),
    retry: $('retry'),
    app: $('app'),
    filters: $('filters'),
    q: $('q'),
    memo: $('memo'),
    reset: $('reset'),
    count: $('count'),
    summaryBody: $('summary-body'),
    runtime: $('runtime'),
    sha: $('sha-state'),
    list: $('list'),
    detail: $('detail'),
    detailId: $('detail-id'),
    detailH: $('detail-h'),
    docHead: $('doc-head'),
    docText: $('doc-text'),
    refText: $('ref-text'),
    scoreBody: $('score-body'),
    answers: $('answers'),
    exportBtn: $('export'),
    exportState: $('export-state'),
    reqState: $('request-state'),
    reqText: $('request-text'),
    copy: $('copy'),
    copyState: $('copy-state'),
  };
  const optionText = new Map(Array.from(el.memo.options, (o) => [o.value, o.textContent]));

  class LoadError extends Error {}

  let data = null;
  let selectedId = null;
  let inflight = false;

  /* ---------- helpers ---------- */

  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value == null) continue;
        if (key === 'className') node.className = value;
        else if (key === 'text') node.textContent = value;
        else node.setAttribute(key, value);
      }
    }
    for (const child of children) {
      if (child == null) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isText = (v) => typeof v === 'string' && v.trim() !== '';
  const norm = (s) => s.normalize('NFKC').toLowerCase();
  const fmt = (v) => v.toFixed(3);

  function need(condition, message) {
    if (!condition) throw new LoadError(message);
  }

  function fmtDelta(d) {
    if (d === 0) return '±0.000';
    return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(3)}`;
  }

  /* ---------- loading ---------- */

  async function fetchBytes(url) {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store' });
    } catch {
      throw new LoadError(`${url} を取得できませんでした（通信エラー）。`);
    }
    if (!response.ok) throw new LoadError(`${url} の取得に失敗しました（HTTP ${response.status}）。`);
    return response.arrayBuffer();
  }

  function parseJson(bytes, url) {
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new LoadError(`${url} がUTF-8のテキストではありません。`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new LoadError(`${url} をJSONとして読めませんでした。`);
    }
  }

  async function sha256Hex(buffer) {
    const subtle = window.crypto && window.crypto.subtle;
    if (!subtle || typeof subtle.digest !== 'function') return null;
    try {
      const digest = await subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  }

  function validateInput(input) {
    need(isObj(input), '入力JSONの形が違います（オブジェクトではありません）。');
    need(input.format === INPUT_FORMAT, `入力JSONの format が ${INPUT_FORMAT} ではありません。`);
    need(input.fictional === true, '入力JSONに fictional: true がありません。');
    need(isText(input.annotation_source), '入力JSONに annotation_source がありません。');
    need(isObj(input.label_meanings) && LABELS.every((l) => isText(input.label_meanings[l])),
      '入力JSONの label_meanings に3種類のラベルの説明がありません。');
    need(Array.isArray(input.documents) && input.documents.length === DOCUMENT_COUNT,
      `入力JSONの資料が${DOCUMENT_COUNT}件ではありません。`);
    const docs = new Map();
    for (const d of input.documents) {
      need(isObj(d) && isText(d.id) && isText(d.title) && isText(d.text), '入力JSONに形の違う資料があります。');
      need(!docs.has(d.id), `資料ID ${d.id} が重複しています。`);
      docs.set(d.id, d);
    }
    need(Array.isArray(input.cases) && input.cases.length === CASE_COUNT, `入力JSONの問いが${CASE_COUNT}件ではありません。`);
    const ids = new Set();
    for (const c of input.cases) {
      need(isObj(c) && isText(c.id), '入力JSONにIDのない問いがあります。');
      need(!ids.has(c.id), `問いのID ${c.id} が重複しています。`);
      ids.add(c.id);
      need(isText(c.question) && isText(c.reference), `${c.id} の質問または参照文が空です。`);
      const cited = c.reference_document_ids;
      need(Array.isArray(cited) && cited.length === 1 && docs.has(cited[0]), `${c.id} の根拠資料IDが1件の既知IDではありません。`);
      need(docs.get(cited[0]).text === c.reference, `${c.id} の参照文が資料 ${cited[0]} の本文と一致しません。`);
      for (const side of SIDES) {
        const a = c[side];
        need(isObj(a) && isText(a.response) && isObj(a.annotation) && LABELS.includes(a.annotation.label) && isText(a.annotation.note),
          `${c.id} の${SIDE_LABEL[side]}の回答または照合メモの形が違います。`);
      }
    }
    return docs;
  }

  function summarize(rows) {
    const out = {};
    for (const side of SIDES) {
      const mean = {};
      for (const m of METRIC_IDS) mean[m] = rows.reduce((sum, r) => sum + r[side].scores[m], 0) / rows.length;
      out[side] = {
        mean,
        exact: rows.filter((r) => r[side].scores.exact_match === 1).length,
        presence: rows.filter((r) => r[side].scores.string_presence === 1).length,
      };
    }
    return out;
  }

  function validateResult(result, input, docs) {
    need(isObj(result) && result.format === RESULT_FORMAT, `結果JSONの format が ${RESULT_FORMAT} ではありません。`);
    need(result.fictional === true, '結果JSONに fictional: true がありません。');
    need(isObj(result.source) && result.source.repository === PIN.repository && result.source.commit === PIN.commit,
      '結果JSONの原典が固定コミットと違います。');
    need(typeof result.input_sha256 === 'string' && /^[0-9a-f]{64}$/.test(result.input_sha256), '結果JSONの input_sha256 の形が違います。');
    const rt = result.runtime;
    need(isObj(rt) && rt.metric_api === METRIC_API && isText(rt.python) && isText(rt.ragas_distribution_version) && isText(rt.rapidfuzz_version),
      '結果JSONの実行情報（Python・Ragas・rapidfuzz・指標API）が足りません。');
    need(rt.metric_calls === CASE_COUNT * SIDES.length * METRIC_IDS.length, '結果JSONの指標の呼び出し回数が60回ではありません。');
    need(Array.isArray(rt.network_attempts) && rt.network_attempts.length === 0, '結果JSONに採点中の通信の試みが記録されています。');
    need(rt.tracking_disabled === true, '結果JSONで利用状況の送信停止が確認されていません。');
    need(Array.isArray(result.metrics) && result.metrics.length === METRIC_IDS.length &&
      result.metrics.every((m, i) => isObj(m) && m.id === METRIC_IDS[i] && isText(m.label) && isText(m.description) && isText(m.ragas_class)),
      '結果JSONの指標の定義が3指標と一致しません。');
    need(result.annotation_source === input.annotation_source, '結果JSONの照合メモの出所が入力と一致しません。');
    need(isObj(result.label_meanings) && LABELS.every((l) => result.label_meanings[l] === input.label_meanings[l]),
      '結果JSONのラベルの説明が入力と一致しません。');

    need(Array.isArray(result.documents) && result.documents.length === docs.size, '結果JSONの資料の件数が入力と一致しません。');
    const seenDocs = new Set();
    for (const d of result.documents) {
      need(isObj(d) && docs.has(d.id) && !seenDocs.has(d.id), '結果JSONに入力にない資料か重複した資料があります。');
      seenDocs.add(d.id);
      const original = docs.get(d.id);
      need(d.title === original.title && d.text === original.text, `結果JSONの資料 ${d.id} が入力と一致しません。`);
    }

    need(Array.isArray(result.rows) && result.rows.length === CASE_COUNT, `結果JSONの問いが${CASE_COUNT}件ではありません。`);
    const byId = new Map();
    for (const r of result.rows) {
      need(isObj(r) && isText(r.id) && !byId.has(r.id), '結果JSONにIDのない問いか重複した問いがあります。');
      byId.set(r.id, r);
    }
    const rows = input.cases.map((c) => {
      const r = byId.get(c.id);
      need(r, `結果JSONに ${c.id} がありません。`);
      need(r.question === c.question && r.reference === c.reference && Array.isArray(r.reference_document_ids) &&
        r.reference_document_ids.length === 1 && r.reference_document_ids[0] === c.reference_document_ids[0],
        `${c.id} の質問・参照文・資料IDが入力と一致しません。`);
      for (const side of SIDES) {
        const a = r[side];
        const b = c[side];
        need(isObj(a) && a.response === b.response && isObj(a.annotation) && a.annotation.label === b.annotation.label && a.annotation.note === b.annotation.note,
          `${c.id} の${SIDE_LABEL[side]}の回答または照合メモが入力と一致しません。`);
        need(isObj(a.scores), `${c.id} の${SIDE_LABEL[side]}に点数がありません。`);
        for (const m of METRIC_IDS) {
          const v = a.scores[m];
          need(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1, `${c.id} の${SIDE_LABEL[side]}の ${m} が0〜1の数値ではありません。`);
          if (BINARY.has(m)) need(v === 0 || v === 1, `${c.id} の${SIDE_LABEL[side]}の ${m} が0か1ではありません。`);
        }
      }
      return r;
    });

    const computed = summarize(rows);
    const s = result.summary;
    need(isObj(s) && s.case_count === CASE_COUNT, '結果JSONの集計がありません。');
    for (const side of SIDES) {
      const part = s[side];
      need(isObj(part) && isObj(part.mean), `結果JSONの${SIDE_LABEL[side]}の集計がありません。`);
      for (const m of METRIC_IDS) {
        need(typeof part.mean[m] === 'number' && Math.abs(part.mean[m] - computed[side].mean[m]) <= TOLERANCE,
          `結果JSONの${SIDE_LABEL[side]}の平均（${m}）が各問の値と合いません。`);
      }
      need(part.exact_match_count === computed[side].exact && part.string_presence_count === computed[side].presence,
        `結果JSONの${SIDE_LABEL[side]}の件数が各問の値と合いません。`);
    }
    return { rows, computed };
  }

  function resetView() {
    data = null;
    selectedId = null;
    el.app.hidden = true;
    el.detail.hidden = true;
    el.exportBtn.disabled = true;
    el.exportState.textContent = '';
    el.list.replaceChildren();
    el.summaryBody.replaceChildren();
    el.scoreBody.replaceChildren();
    el.answers.replaceChildren();
    el.count.textContent = '';
    el.runtime.textContent = '';
    el.sha.textContent = '';
    el.q.value = '';
    el.memo.value = 'all';
    for (const option of el.memo.options) option.textContent = optionText.get(option.value);
  }

  async function load() {
    if (inflight) return;
    inflight = true;
    el.retry.disabled = true;
    el.loadError.hidden = true;
    resetView();
    el.loadState.textContent = '保存済みの結果を読み込んでいます…';
    try {
      const [inputBytes, resultBytes] = await Promise.all([fetchBytes(INPUT_URL), fetchBytes(RESULT_URL)]);
      const input = parseJson(inputBytes, INPUT_URL);
      const result = parseJson(resultBytes, RESULT_URL);
      const docs = validateInput(input);
      const { rows, computed } = validateResult(result, input, docs);
      const sha = await sha256Hex(inputBytes);
      if (sha !== null && sha !== result.input_sha256) {
        throw new LoadError('入力ファイルのSHA-256が、結果JSONの input_sha256 と一致しません。別の入力から作った結果です。');
      }
      data = {
        input,
        result,
        rows,
        computed,
        docs: new Map(result.documents.map((d) => [d.id, d])),
        rowsById: new Map(rows.map((r) => [r.id, r])),
        shaChecked: sha !== null,
        items: new Map(),
        haystack: new Map(rows.map((r) => [r.id, norm([
          r.id, r.question, r.reference,
          r.before.response, r.after.response,
          r.before.annotation.note, r.after.annotation.note,
        ].join('\n'))])),
      };
      renderSummary();
      renderList();
      el.loadState.textContent = '';
      el.app.hidden = false;
      selectedId = data.rowsById.has(DEFAULT_ID) ? DEFAULT_ID : rows[0].id;
      applyFilters();
    } catch (error) {
      resetView();
      el.loadState.textContent = '';
      el.loadErrorText.textContent = error instanceof LoadError
        ? error.message
        : `読み込み中に問題が起きました（${error && error.name ? error.name : 'Error'}）。`;
      el.loadError.hidden = false;
    } finally {
      inflight = false;
      el.retry.disabled = false;
    }
  }

  /* ---------- rendering ---------- */

  function renderSummary() {
    const { result, computed, rows } = data;
    for (const metric of result.metrics) {
      el.summaryBody.append(h('tr', null,
        h('th', { scope: 'row' },
          h('span', { className: 'metric-name', text: metric.label }),
          h('span', { className: 'metric-class', text: metric.distance ? `${metric.ragas_class}（${metric.distance}）` : metric.ragas_class })),
        h('td', { className: 'num', text: fmt(computed.before.mean[metric.id]) }),
        h('td', { className: 'num', text: fmt(computed.after.mean[metric.id]) })));
    }
    el.summaryBody.append(h('tr', null,
      h('th', { scope: 'row' },
        h('span', { className: 'metric-name', text: '完全一致の件数' }),
        h('span', { className: 'metric-class', text: 'ExactMatch が1.0の問い' })),
      h('td', { className: 'num', text: `${computed.before.exact} / ${rows.length}` }),
      h('td', { className: 'num', text: `${computed.after.exact} / ${rows.length}` })));

    const rt = result.runtime;
    const version = rt.ragas_distribution_version === PRETEND_VERSION
      ? `Ragas ${rt.ragas_distribution_version}（固定ソースから入れた手元の版名で、正式リリース番号ではありません）`
      : `Ragas ${rt.ragas_distribution_version}`;
    el.runtime.textContent = `原典 ${result.source.repository} ${result.source.commit}・${version}・rapidfuzz ${rt.rapidfuzz_version}・Python ${rt.python}・指標の呼び出し ${rt.metric_calls}回・採点中の通信の試み ${rt.network_attempts.length}件・利用状況の送信は停止。`;
    el.sha.textContent = data.shaChecked
      ? `入力ファイルのSHA-256（${result.input_sha256}）を、このブラウザーで計算して結果JSONの値と照合しました。`
      : `このブラウザーではWebCryptoが使えないため、入力ファイルのSHA-256は照合していません（結果JSONの値：${result.input_sha256}）。`;

    const after = data.rows.map((r) => r.after.annotation.label);
    const counts = {
      all: data.rows.length,
      'after-check': after.filter((l) => CHECK_LABELS.has(l)).length,
      'after-grounded': after.filter((l) => l === 'grounded').length,
    };
    for (const option of el.memo.options) option.textContent = `${optionText.get(option.value)}（${counts[option.value]}）`;
  }

  function renderList() {
    for (const row of data.rows) {
      const label = row.after.annotation.label;
      const b = row.before.scores;
      const a = row.after.scores;
      const btn = h('button', { type: 'button', className: 'q-btn', 'aria-pressed': 'false', 'data-id': row.id },
        h('span', { className: 'q-top' }, h('span', { className: 'q-id', text: row.id }), row.question),
        h('span', { className: 'q-sub', text: `完全一致 ${b.exact_match}→${a.exact_match}・近さ ${fmt(b.string_similarity)}→${fmt(a.string_similarity)}・包含 ${b.string_presence}→${a.string_presence}` }),
        h('span', null, h('span', { className: CHECK_LABELS.has(label) ? 'chip warn' : 'chip', text: `変更後のメモ：${SHORT_LABEL[label]}` })));
      const li = h('li', null, btn);
      data.items.set(row.id, { li, btn });
      el.list.append(li);
    }
  }

  function diffParts(reference, response) {
    const a = Array.from(reference);
    const b = Array.from(response);
    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
    let tail = 0;
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
    return {
      head: b.slice(0, head).join(''),
      mid: b.slice(head, b.length - tail).join(''),
      tail: b.slice(b.length - tail).join(''),
      removed: a.slice(head, a.length - tail).join(''),
    };
  }

  function diffSentence(p) {
    const mid = Array.from(p.mid).length;
    const removed = Array.from(p.removed).length;
    if (!mid && !removed) return '参照文と同じ文字列です。';
    if (!removed) return `参照文の文字はそのまま並び、色付きの${mid}文字が加わっています。`;
    if (!mid) return `参照文の「${p.removed}」がありません。`;
    if (mid <= 12 && removed <= 12) return `参照文の「${p.removed}」が、回答では「${p.mid}」です。`;
    return `前後の一致を除くと、参照文の${removed}文字と回答の${mid}文字が違います。`;
  }

  function renderDetail(row) {
    const { result } = data;
    const docId = row.reference_document_ids[0];
    const doc = data.docs.get(docId);
    el.detailId.textContent = `${row.id}・根拠資料 ${docId}`;
    el.detailH.textContent = row.question;
    el.docHead.textContent = `${doc.id}「${doc.title}」`;
    el.docText.textContent = doc.text;
    el.refText.textContent = row.reference;

    el.scoreBody.replaceChildren(...result.metrics.map((metric) => {
      const before = row.before.scores[metric.id];
      const after = row.after.scores[metric.id];
      return h('tr', null,
        h('th', { scope: 'row' },
          h('span', { className: 'metric-name', text: metric.label }),
          h('span', { className: 'metric-class', text: metric.ragas_class })),
        h('td', { className: 'num', text: fmt(before) }),
        h('td', { className: 'num', text: fmt(after) }),
        h('td', { className: 'num', text: fmtDelta(after - before) }));
    }));

    el.answers.replaceChildren(...SIDES.map((side) => {
      const answer = row[side];
      const parts = diffParts(row.reference, answer.response);
      const label = answer.annotation.label;
      return h('article', { className: 'answer', 'aria-label': `${SIDE_LABEL[side]}の固定回答` },
        h('h4', { text: `${SIDE_LABEL[side]}の固定回答` }),
        h('p', { className: 'response' }, parts.head, parts.mid ? h('mark', { text: parts.mid }) : null, parts.tail),
        h('p', { className: 'diff-line', text: diffSentence(parts) }),
        h('div', { className: 'memo' },
          h('p', { className: 'memo-head', text: '制作担当の照合メモ（入力）' }),
          h('p', { className: CHECK_LABELS.has(label) ? 'memo-label warn' : 'memo-label ok', text: `${result.label_meanings[label]}（${label}）` }),
          h('p', { className: 'memo-note', text: answer.annotation.note })));
    }));
  }

  /* ---------- selection and filters ---------- */

  function select(id, focusHeading) {
    const changed = id !== selectedId;
    selectedId = id;
    for (const [rowId, item] of data.items) item.btn.setAttribute('aria-pressed', String(rowId === id));
    if (changed) el.exportState.textContent = '';
    if (id === null) {
      el.detail.hidden = true;
      el.exportBtn.disabled = true;
      return;
    }
    renderDetail(data.rowsById.get(id));
    el.detail.hidden = false;
    el.exportBtn.disabled = false;
    if (focusHeading) {
      el.detailH.focus({ preventScroll: true });
      el.detail.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }

  function applyFilters() {
    if (!data) return;
    const tokens = norm(el.q.value).split(/\s+/).filter(Boolean);
    const mode = el.memo.value;
    const visible = [];
    for (const row of data.rows) {
      const label = row.after.annotation.label;
      const memoOk = mode === 'all'
        || (mode === 'after-check' && CHECK_LABELS.has(label))
        || (mode === 'after-grounded' && label === 'grounded');
      const hay = data.haystack.get(row.id);
      const shown = memoOk && tokens.every((t) => hay.includes(t));
      data.items.get(row.id).li.hidden = !shown;
      if (shown) visible.push(row.id);
    }
    const total = data.rows.length;
    el.count.textContent = visible.length
      ? `${total}問中 ${visible.length}問を表示`
      : `${total}問中 0問。条件に合う問いがありません。「条件を戻す」で全件に戻せます。`;
    if (!visible.length) {
      select(null, false);
      return;
    }
    select(visible.includes(selectedId) ? selectedId : visible[0], false);
  }

  function resetFilters() {
    if (!data) return;
    el.q.value = '';
    el.memo.value = 'all';
    selectedId = data.rowsById.has(DEFAULT_ID) ? DEFAULT_ID : data.rows[0].id;
    el.exportState.textContent = '';
    applyFilters();
  }

  /* ---------- export ---------- */

  function exportSelected() {
    if (!data || selectedId === null) return;
    const row = data.rowsById.get(selectedId);
    const { result } = data;
    const payload = {
      format: EXPORT_FORMAT,
      fictional: true,
      source: result.source,
      input_sha256: result.input_sha256,
      metrics: result.metrics,
      selected: row,
      documents: row.reference_document_ids.map((id) => data.docs.get(id)),
      annotation_source: result.annotation_source,
    };
    const name = `nagi-faq-${row.id.replace(/[^A-Za-z0-9_-]/g, '_')}.json`;
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    el.exportState.textContent = `JSONのダウンロードを要求しました（${name}）。`;
  }

  /* ---------- request text ---------- */

  async function loadRequest() {
    try {
      let response;
      try {
        response = await fetch(REQUEST_URL, { cache: 'no-store' });
      } catch {
        throw new Error('通信エラー');
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!text.trim()) throw new Error('ファイルが空です');
      el.reqText.value = text;
      el.reqText.hidden = false;
      el.copy.hidden = false;
      el.reqState.textContent = '';
    } catch (error) {
      el.reqState.textContent = `依頼文を読み込めませんでした（${error.message}）。下の request.txt を直接開けます。結果の表示には影響しません。`;
    }
  }

  async function copyRequest() {
    el.copyState.textContent = '';
    try {
      if (!window.isSecureContext || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('clipboard unavailable');
      }
      await navigator.clipboard.writeText(el.reqText.value);
      el.copyState.textContent = '依頼文をコピーしました。';
    } catch {
      el.reqText.focus();
      el.reqText.select();
      el.copyState.textContent = 'コピーできませんでした。上の欄の文字を選択しました。長押しまたは Ctrl+C でコピーしてください。';
    }
  }

  /* ---------- events ---------- */

  el.filters.addEventListener('submit', (event) => event.preventDefault());
  el.q.addEventListener('input', applyFilters);
  el.memo.addEventListener('change', applyFilters);
  el.reset.addEventListener('click', resetFilters);
  el.list.addEventListener('click', (event) => {
    const btn = event.target.closest('button.q-btn');
    if (!btn || !data) return;
    select(btn.dataset.id, true);
  });
  el.retry.addEventListener('click', load);
  el.exportBtn.addEventListener('click', exportSelected);
  el.copy.addEventListener('click', copyRequest);

  load();
  loadRequest();
})();
