/* 凪の図書室 FAQ × Ragas — 点数と根拠を、ひとつの図で。 Copyright (c) 2026 Studio Yebisu. MIT License.
   Page and diagram authored by Claude Opus 5.5.
   Reads the saved input and result JSON, checks their exact bytes (SHA-256) and that they belong together,
   then draws one connected picture: the reference book → two frozen answer strips → three measuring tools
   (同じ文字 / 文字の近さ / 全文を含む) → the saved values of one question. The editor's memo hangs from the book
   as a separate warm branch: it is supplied input, never a metric verdict.
   Nothing here runs Ragas or any AI. There is no built-in fallback data and no metric is recomputed. */
'use strict';

(() => {
  const INPUT_URL = 'input/faq-pairs.json';
  const RESULT_URL = 'outputs/evaluation.json';
  const REQUEST_URL = 'request.txt';
  const INPUT_SHA256 = 'd55fcce5eec82974b01d912dcf6f21de94aede03c37d2a16092b6fa9304705a2';
  const RESULT_SHA256 = 'b3862890b1ee0d48ebad9991cc99310730cbc3769e4717fdd2e4678348c91ea3';
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
  const SHORT_LABEL = { grounded: '資料と合う', contradiction: '資料と矛盾', unsupported_addition: '根拠のない追記' };
  const CASE_COUNT = 10;
  const DOCUMENT_COUNT = 10;
  const DEFAULT_ID = 'Q07';
  const DEFAULT_SIDE = 'after';
  const TOLERANCE = 1e-9;
  const ANIMATION_MS = 1300;

  // The three measuring tools. Neutral colours; none of them means pass or fail.
  const TOOLS = [
    { id: 'exact_match', label: '同じ文字', ink: '#2747c2', wash: '#e6eafb' },
    { id: 'string_similarity', label: '文字の近さ', ink: '#0f7a72', wash: '#dcefec' },
    { id: 'string_presence', label: '全文を含む', ink: '#94650a', wash: '#f6ebd3' },
  ];
  const C = {
    ink: '#1c2333', muted: '#535a6b', faint: '#8b90a0', rule: '#cfc5b0', paper: '#fffcf5', ivory: '#f6f1e6',
    warm: '#b4571a', warmInk: '#8f4210', warmWash: '#fbe5d5', mark: '#e3e7f3', attach: '#f7dcb4',
  };

  // What the picture asserts beyond the generic diff. Each is checked against the saved strings at load.
  const FOCUS = {
    Q07: { type: 'clock', reference: 18, before: 18, after: 19 },
    Q01: { type: 'clock', reference: 10, before: 9, after: 10 },
    Q08: { type: 'attachment' },
    Q05: { type: 'conditions', chips: ['予約なし', '1回', '7日間'], reference: ['予約が入っていない', '1回', '7日間'], after: ['予約がない', '1度', '7日'] },
    Q06: { type: 'same' },
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    caseList: $('case-list'),
    status: $('status'),
    errorBox: $('error-box'),
    errorText: $('error-text'),
    retry: $('retry'),
    figure: $('figure'),
    svg: $('diagram'),
    root: $('diagram-root'),
    title: $('diagram-title'),
    desc: $('diagram-desc'),
    phaseBefore: $('phase-before'),
    phaseAfter: $('phase-after'),
    exportBtn: $('export'),
    exportState: $('export-state'),
    caseTag: $('case-tag'),
    caption: $('caption-text'),
    detailSummaryId: $('detail-summary-id'),
    detailBody: $('detail-body'),
    comparisonLink: $('comparison-link'),
    picker: $('picker'),
    summaryBody: $('summary-body'),
    summaryNote: $('summary-note'),
    annotationNote: $('annotation-note'),
    runtime: $('runtime'),
    sha: $('sha-state'),
    reqState: $('request-state'),
    reqText: $('request-text'),
    copy: $('copy'),
    copyState: $('copy-state'),
  };
  for (const [name, node] of Object.entries(el)) {
    if (!node) throw new Error(`index.html に必要な要素がありません：${name}`);
  }
  const caseButtons = Array.from(el.caseList.querySelectorAll('button.case'));
  const phaseButtons = [el.phaseBefore, el.phaseAfter];
  // Every aria-controls target must exist.
  for (const node of document.querySelectorAll('[aria-controls]')) {
    if (!$(node.getAttribute('aria-controls'))) throw new Error(`aria-controls の参照先がありません：${node.getAttribute('aria-controls')}`);
  }

  class LoadError extends Error {}

  let data = null;
  let selectedId = null;
  let side = DEFAULT_SIDE;
  let inflight = false;
  let raf = 0;

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
  const fmt = (v) => v.toFixed(3);
  // Binary metrics are exactly 0 or 1 (checked at load); similarity is rounded to 3 decimals for display only.
  const show = (metricId, v) => (BINARY.has(metricId) ? String(v) : fmt(v));
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function need(condition, message) {
    if (!condition) throw new LoadError(message);
  }

  /* ---------- loading ---------- */

  async function fetchBytes(url) {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store' });
    } catch {
      throw new LoadError(location.protocol === 'file:'
        ? `${url} を取得できませんでした。ファイルを直接開くとブラウザーが読み込みを止めます。作例のフォルダーで python -m http.server を実行し、http://localhost:8000/ を開いてください。`
        : `${url} を取得できませんでした（通信エラー）。`);
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
    try {
      const digest = await window.crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      throw new LoadError('SHA-256 を計算できなかったため、保存結果のバイト列を照合できません。');
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
      for (const s of SIDES) {
        const a = c[s];
        need(isObj(a) && isText(a.response) && isObj(a.annotation) && LABELS.includes(a.annotation.label) && isText(a.annotation.note),
          `${c.id} の${SIDE_LABEL[s]}の回答または照合メモの形が違います。`);
      }
    }
    return docs;
  }

  function summarize(rows) {
    const out = {};
    for (const s of SIDES) {
      const mean = {};
      for (const m of METRIC_IDS) mean[m] = rows.reduce((sum, r) => sum + r[s].scores[m], 0) / rows.length;
      out[s] = {
        mean,
        exact: rows.filter((r) => r[s].scores.exact_match === 1).length,
        presence: rows.filter((r) => r[s].scores.string_presence === 1).length,
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
      result.metrics.every((m, i) => isObj(m) && m.id === METRIC_IDS[i] && isText(m.label) && isText(m.description) && isText(m.ragas_class) &&
        Array.isArray(m.range) && m.range.length === 2 && m.range[0] === 0 && m.range[1] === 1),
      '結果JSONの指標の定義（3指標・0〜1の範囲）が一致しません。');
    need(result.metrics[0].ragas_class === 'ExactMatch' && result.metrics[1].ragas_class === 'NonLLMStringSimilarity' &&
      result.metrics[1].distance === 'LEVENSHTEIN' && result.metrics[2].ragas_class === 'StringPresence',
      '結果JSONの指標のクラスが ExactMatch・NonLLMStringSimilarity（LEVENSHTEIN）・StringPresence ではありません。');
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
      for (const s of SIDES) {
        const a = r[s];
        const b = c[s];
        need(isObj(a) && a.response === b.response && isObj(a.annotation) && a.annotation.label === b.annotation.label && a.annotation.note === b.annotation.note,
          `${c.id} の${SIDE_LABEL[s]}の回答または照合メモが入力と一致しません。`);
        need(isObj(a.scores), `${c.id} の${SIDE_LABEL[s]}に点数がありません。`);
        for (const m of METRIC_IDS) {
          const v = a.scores[m];
          need(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1, `${c.id} の${SIDE_LABEL[s]}の ${m} が0〜1の数値ではありません。`);
          if (BINARY.has(m)) need(v === 0 || v === 1, `${c.id} の${SIDE_LABEL[s]}の ${m} が0か1ではありません。`);
        }
      }
      return r;
    });

    const computed = summarize(rows);
    const s = result.summary;
    need(isObj(s) && s.case_count === CASE_COUNT, '結果JSONの集計がありません。');
    for (const sd of SIDES) {
      const part = s[sd];
      need(isObj(part) && isObj(part.mean), `結果JSONの${SIDE_LABEL[sd]}の集計がありません。`);
      for (const m of METRIC_IDS) {
        need(typeof part.mean[m] === 'number' && Math.abs(part.mean[m] - computed[sd].mean[m]) <= TOLERANCE,
          `結果JSONの${SIDE_LABEL[sd]}の平均（${m}）が各問の値と合いません。`);
      }
      need(part.exact_match_count === computed[sd].exact && part.string_presence_count === computed[sd].presence,
        `結果JSONの${SIDE_LABEL[sd]}の件数が各問の値と合いません。`);
    }
    const ac = result.annotation_counts;
    need(isObj(ac) && ac.source === 'input' && SIDES.every((sd) => isObj(ac[sd]) &&
      LABELS.every((l) => ac[sd][l] === rows.filter((r) => r[sd].annotation.label === l).length)),
    '結果JSONの照合メモのラベル数（入力の値）が各問と合いません。');
    return { rows, computed };
  }

  const hourIn = (text) => {
    const m = text.match(/(\d+)時/);
    return m ? Number(m[1]) : null;
  };

  // The few extra things the picture draws (clock hours, attachment, three conditions, identical strings).
  function checkFocus(rowsById) {
    for (const [id, f] of Object.entries(FOCUS)) {
      const r = rowsById.get(id);
      need(r, `図で使う ${id} が保存結果にありません。`);
      const bad = `図で使う ${id} の前提が保存結果の文字列と一致しません。`;
      if (f.type === 'clock') {
        need(hourIn(r.reference) === f.reference && hourIn(r.before.response) === f.before && hourIn(r.after.response) === f.after, bad);
      } else if (f.type === 'attachment') {
        need(r.before.response === r.reference && r.after.response.startsWith(r.reference) && r.after.response.length > r.reference.length, bad);
      } else if (f.type === 'conditions') {
        need(f.reference.every((t) => r.reference.includes(t)) && f.after.every((t) => r.after.response.includes(t)) &&
          r.after.annotation.note.startsWith(f.chips.join('・')), bad);
      } else if (f.type === 'same') {
        need(r.before.response === r.reference && r.after.response === r.reference, bad);
      }
    }
  }

  /* ---------- state ---------- */

  function setStatus(text, state = 'loading') {
    el.status.textContent = text;
    el.status.dataset.state = state;
  }

  function setControls(enabled) {
    for (const b of [...caseButtons, ...phaseButtons, el.exportBtn]) b.disabled = !enabled;
  }

  function stopAnimation() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function resetView() {
    stopAnimation();
    data = null;
    selectedId = null;
    el.root.replaceChildren();
    el.title.textContent = '';
    el.desc.textContent = '';
    el.figure.hidden = true;
    setControls(false);
    for (const b of caseButtons) b.setAttribute('aria-pressed', 'false');
    el.exportState.textContent = '';
    el.caseTag.textContent = '';
    el.caption.textContent = '';
    el.detailSummaryId.textContent = '—';
    el.detailBody.replaceChildren();
    el.picker.replaceChildren();
    el.summaryBody.replaceChildren();
    el.summaryNote.textContent = '';
    el.annotationNote.textContent = '';
    el.runtime.textContent = '';
    el.sha.textContent = '';
    el.comparisonLink.href = 'comparison.html';
    el.comparisonLink.textContent = '表形式の前の版で見る（comparison.html）';
  }

  function idFromHash() {
    const m = /^#(Q\d{2})$/.exec(location.hash);
    return m && data && data.rowsById.has(m[1]) ? m[1] : null;
  }

  async function load() {
    if (inflight) return;
    inflight = true;
    el.retry.disabled = true;
    el.errorBox.hidden = true;
    resetView();
    setStatus('保存済みの結果を読み込み、照合しています…');
    try {
      need(window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function',
        'このブラウザーでは SHA-256 を計算できないため、保存結果のバイト列を照合できません。https または localhost で開いてください。');
      const [inputBytes, resultBytes] = await Promise.all([fetchBytes(INPUT_URL), fetchBytes(RESULT_URL)]);
      const [inputSha, resultSha] = await Promise.all([sha256Hex(inputBytes), sha256Hex(resultBytes)]);
      need(inputSha === INPUT_SHA256, `${INPUT_URL} の SHA-256 が固定値と一致しません（${inputSha}）。`);
      need(resultSha === RESULT_SHA256, `${RESULT_URL} の SHA-256 が固定値と一致しません（${resultSha}）。`);
      const input = parseJson(inputBytes, INPUT_URL);
      const result = parseJson(resultBytes, RESULT_URL);
      const docs = validateInput(input);
      const { rows, computed } = validateResult(result, input, docs);
      need(result.input_sha256 === inputSha, '入力ファイルのSHA-256が、結果JSONの input_sha256 と一致しません。別の入力から作った結果です。');
      const rowsById = new Map(rows.map((r) => [r.id, r]));
      for (const b of caseButtons) need(rowsById.has(b.dataset.id), `保存結果に ${b.dataset.id} がありません。`);
      checkFocus(rowsById);
      data = {
        result,
        rows,
        computed,
        rowsById,
        docs: new Map(result.documents.map((d) => [d.id, d])),
        picks: new Map(),
      };
      renderSummary(resultSha, inputSha);
      renderPicker();
      side = DEFAULT_SIDE;
      setPhasePressed();
      el.figure.hidden = false;
      setControls(true);
      setStatus('', 'ready');
      select(idFromHash() || DEFAULT_ID, { animate: false, updateHash: false });
    } catch (error) {
      resetView();
      setStatus('保存結果を確かめられなかったため、図を描いていません。', 'error');
      el.errorText.textContent = error instanceof LoadError
        ? error.message
        : `読み込み中に問題が起きました（${error && error.name ? error.name : 'Error'}）。`;
      el.errorBox.hidden = false;
    } finally {
      inflight = false;
      el.retry.disabled = false;
    }
  }

  /* ---------- folds ---------- */

  function renderSummary(resultSha, inputSha) {
    const { result, computed, rows } = data;
    for (const metric of result.metrics) {
      el.summaryBody.append(h('tr', null,
        h('th', { scope: 'row' },
          h('span', { className: 'metric-name', text: metric.label }),
          h('span', { className: 'metric-class', text: metric.distance ? `${metric.ragas_class}（${metric.distance}）` : metric.ragas_class })),
        h('td', { className: 'num', text: fmt(computed.before.mean[metric.id]) }),
        h('td', { className: 'num', text: fmt(computed.after.mean[metric.id]) })));
    }
    const n = rows.length;
    el.summaryBody.append(
      h('tr', null, h('th', { scope: 'row' }, h('span', { className: 'metric-name', text: '同じ文字が1の問い' }), h('span', { className: 'metric-class', text: 'ExactMatch = 1' })),
        h('td', { className: 'num', text: `${computed.before.exact} / ${n}` }), h('td', { className: 'num', text: `${computed.after.exact} / ${n}` })),
      h('tr', null, h('th', { scope: 'row' }, h('span', { className: 'metric-name', text: '全文を含むが1の問い' }), h('span', { className: 'metric-class', text: 'StringPresence = 1' })),
        h('td', { className: 'num', text: `${computed.before.presence} / ${n}` }), h('td', { className: 'num', text: `${computed.after.presence} / ${n}` })));
    const sm = result.summary;
    el.summaryNote.textContent = `平均は小数第3位までの表示です。保存した値は、文字列の近さの平均が ${sm.before.mean.string_similarity} → ${sm.after.mean.string_similarity}。件数と平均は、固定した2組の文字列を数えたもので、正答率でも、実際のシステムの改善でもありません。`;
    const ac = result.annotation_counts;
    const part = (sd) => LABELS.map((l) => `${SHORT_LABEL[l]} ${ac[sd][l]}`).join('・');
    el.annotationNote.textContent = `照合メモ（入力）のラベル数：変更前 ${part('before')}／変更後 ${part('after')}。制作担当が入力に書いた数で、Ragas の分類ではありません。`;

    const rt = result.runtime;
    const version = rt.ragas_distribution_version === PRETEND_VERSION
      ? `Ragas ${rt.ragas_distribution_version}（固定ソースから入れた手元の版名で、正式リリース番号ではありません）`
      : `Ragas ${rt.ragas_distribution_version}`;
    el.runtime.textContent = `保存した実行の記録：原典 ${result.source.repository} ${result.source.commit}・${version}・rapidfuzz ${rt.rapidfuzz_version}・Python ${rt.python}・${rt.metric_api} の ascore 呼び出し ${rt.metric_calls}回・採点中の通信の試み ${rt.network_attempts.length}件・利用状況の送信は停止。`;
    el.sha.textContent = `このブラウザーで、入力ファイル（SHA-256 ${inputSha}）と結果ファイル（SHA-256 ${resultSha}）のバイト列を計算し、固定値および結果の input_sha256 と照合してから描いています。`;
  }

  function renderPicker() {
    for (const row of data.rows) {
      const label = row.after.annotation.label;
      const btn = h('button', { type: 'button', className: 'pick', 'aria-pressed': 'false', 'aria-controls': 'figure', 'data-id': row.id },
        h('span', { className: 'pick-top' }, h('span', { className: 'pick-id', text: row.id }), row.question),
        h('span', { className: 'pick-sub', text: `変更後の照合メモ（入力）：${SHORT_LABEL[label]}` }));
      data.picks.set(row.id, btn);
      el.picker.append(h('li', null, btn));
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
      headLen: head,
      tailLen: tail,
    };
  }

  function renderDetail(row) {
    const { result } = data;
    const docId = row.reference_document_ids[0];
    const doc = data.docs.get(docId);
    const answers = SIDES.map((s) => {
      const answer = row[s];
      const parts = diffParts(row.reference, answer.response);
      const label = answer.annotation.label;
      return h('article', { className: 'answer', 'aria-label': `${SIDE_LABEL[s]}の固定回答` },
        h('h3', { text: `${SIDE_LABEL[s]}の固定回答` }),
        h('p', { className: 'response' }, parts.head, parts.mid ? h('mark', { text: parts.mid }) : null, parts.tail),
        h('div', { className: 'table-wrap' },
          h('table', null,
            h('caption', { className: 'visually-hidden', text: `${SIDE_LABEL[s]}の3指標の値` }),
            h('thead', null, h('tr', null, h('th', { scope: 'col', text: '道具（指標）' }), h('th', { scope: 'col', text: '保存した値' }), h('th', { scope: 'col', text: '図の表示' }))),
            h('tbody', null, ...result.metrics.map((metric, i) => h('tr', null,
              h('th', { scope: 'row' }, h('span', { className: 'metric-name', text: TOOLS[i].label }), h('span', { className: 'metric-class', text: metric.ragas_class })),
              h('td', { className: 'num', text: String(answer.scores[metric.id]) }),
              h('td', { className: 'num', text: show(metric.id, answer.scores[metric.id]) })))))),
        h('div', { className: 'memo' },
          h('p', { className: 'memo-head', text: '制作担当の照合メモ（入力）' }),
          h('p', { className: 'memo-label', text: `${result.label_meanings[label]}（${label}）` }),
          h('p', { className: 'memo-note', text: answer.annotation.note })));
    });
    el.detailBody.replaceChildren(
      h('p', { className: 'detail-id', text: `${row.id}・根拠資料 ${docId}` }),
      h('h2', { text: row.question }),
      h('h3', { text: `根拠資料 ${doc.id}「${doc.title}」` }),
      h('blockquote', { className: 'doc-text', text: doc.text }),
      h('h3', { text: '参照文（reference）' }),
      h('p', { text: row.reference }),
      h('p', { className: 'fold-note', text: '参照文は資料の本文と同じ文字列です。3つの道具はこの参照文と各回答を比べました。色付きの文字は、参照文と前後が一致しない範囲を示す目印で、意味の判定ではありません。' }),
      ...answers);
  }

  function captionFor(row) {
    const a = row.after.scores;
    const f = FOCUS[row.id];
    switch (row.id) {
      case 'Q07':
        return `資料は${f.reference}時、変更後は${f.after}時。1文字の違いで文字の近さは${fmt(a.string_similarity)}のまま、同じ文字は${show('exact_match', a.exact_match)}。期限の違いを示すのは照合メモ（入力）です。`;
      case 'Q08':
        return `変更後は資料の全文に1文を足した回答。全文を含むは${show('string_presence', a.string_presence)}のまま。足した文は資料にない、と照合メモ（入力）にあります。`;
      case 'Q05':
        return `変更後は言い換えで、同じ文字は${show('exact_match', a.exact_match)}。予約なし・1回・7日間は保たれている、と照合メモ（入力）にあります。`;
      case 'Q01':
        return `変更前は${f.before}時、変更後は${f.after}時。変更後は資料と同じ文字なので、3つの値は${METRIC_IDS.map((m) => show(m, a[m])).join('・')}。`;
      case 'Q06':
        return `変更前と変更後は同じ文字列で、資料とも同じ。3つの値は${METRIC_IDS.map((m) => show(m, a[m])).join('・')}です。`;
      default:
        return `${SIDE_LABEL[side]}の回答の値と照合メモ（入力）を図に描いています。全文は下の「この問いの全文と値」で読めます。`;
    }
  }

  /* ---------- selection ---------- */

  function setPhasePressed() {
    for (const b of phaseButtons) b.setAttribute('aria-pressed', String(b.dataset.side === side));
  }

  function select(id, opts = {}) {
    if (!data || !data.rowsById.has(id)) return;
    if (id !== selectedId) el.exportState.textContent = '';
    selectedId = id;
    const row = data.rowsById.get(id);
    for (const b of caseButtons) b.setAttribute('aria-pressed', String(b.dataset.id === id));
    for (const [rowId, b] of data.picks) b.setAttribute('aria-pressed', String(rowId === id));
    if (opts.updateHash !== false) {
      try {
        history.replaceState(null, '', `#${id}`);
      } catch {
        /* URL update is optional; the selection still works. */
      }
    }
    el.caseTag.textContent = id;
    el.caption.textContent = captionFor(row);
    el.detailSummaryId.textContent = id;
    el.comparisonLink.href = `comparison.html#${id}`;
    el.comparisonLink.textContent = `表形式の前の版で見る（comparison.html#${id}）`;
    renderDetail(row);
    redraw(opts.animate === true);
  }

  function setSide(next) {
    if (!data || !SIDES.includes(next)) return;
    side = next;
    setPhasePressed();
    if (!FOCUS[selectedId]) el.caption.textContent = captionFor(data.rowsById.get(selectedId));
    redraw(true);
  }

  /* ---------- the diagram (SVG, viewBox 340 × 530) ---------- */

  const NS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, String(v));
    if (text != null) node.textContent = text;
    return node;
  }
  const txt = (x, y, text, size, attrs = {}) => sv('text', { x, y, 'font-size': size, fill: C.ink, ...attrs }, text);

  // Wraps characters into lines (Japanese wraps per character); the last kept line ends with … if cut.
  function wrapChars(chars, per, max) {
    const lines = [];
    for (let i = 0; i < chars.length && lines.length < max; i += per) lines.push(chars.slice(i, i + per).map((c, k) => ({ c, i: i + k })));
    if (chars.length > per * max) lines[max - 1][lines[max - 1].length - 1].c = '…';
    return lines;
  }

  // Text whose diff characters are bold, dark and underlined; the rest is muted ink.
  function markedText(x, y, lineH, size, text, flagAt, per, max) {
    const g = sv('g');
    wrapChars(Array.from(text), per, max).forEach((line, li) => {
      const t = sv('text', { x, y: y + li * lineH, 'font-size': size, fill: C.muted });
      let run = '';
      let cur = null;
      const flush = () => {
        if (!run) return;
        t.append(cur ? sv('tspan', { fill: C.ink, 'font-weight': 800, 'text-decoration': 'underline' }, run) : sv('tspan', null, run));
        run = '';
      };
      for (const { c, i } of line) {
        const f = flagAt(i);
        if (f !== cur) {
          flush();
          cur = f;
        }
        run += c;
      }
      flush();
      g.append(t);
    });
    return g;
  }

  function clockGlyph(cx, cy, r, hour, refHour) {
    const g = sv('g');
    const angle = (hr) => ((hr % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    g.append(sv('circle', { cx, cy, r, fill: C.paper, stroke: C.ink, 'stroke-width': 1.4 }));
    for (let k = 0; k < 12; k += 3) {
      const a = (k / 12) * Math.PI * 2;
      g.append(sv('line', { x1: cx + Math.cos(a) * (r - 3), y1: cy + Math.sin(a) * (r - 3), x2: cx + Math.cos(a) * r, y2: cy + Math.sin(a) * r, stroke: C.ink, 'stroke-width': 1 }));
    }
    if (refHour != null && refHour !== hour) {
      // The gap between the book's hour and this strip's hour.
      const a0 = angle(refHour);
      const a1 = angle(hour);
      const rr = r - 2;
      const sweep = ((a1 - a0 + Math.PI * 2) % (Math.PI * 2)) < Math.PI ? 1 : 0;
      g.append(sv('path', { d: `M${cx},${cy} L${cx + Math.cos(a0) * rr},${cy + Math.sin(a0) * rr} A${rr},${rr} 0 0 ${sweep} ${cx + Math.cos(a1) * rr},${cy + Math.sin(a1) * rr} Z`, fill: C.mark, stroke: 'none' }));
      g.append(sv('line', { x1: cx, y1: cy, x2: cx + Math.cos(a0) * r * 0.72, y2: cy + Math.sin(a0) * r * 0.72, stroke: C.faint, 'stroke-width': 1.4, 'stroke-dasharray': '2 2' }));
    }
    const a = angle(hour);
    g.append(sv('line', { x1: cx, y1: cy, x2: cx + Math.cos(a) * r * 0.72, y2: cy + Math.sin(a) * r * 0.72, stroke: C.ink, 'stroke-width': 2, 'stroke-linecap': 'round' }));
    g.append(sv('circle', { cx, cy, r: 1.6, fill: C.ink }));
    return g;
  }

  function stripPath(x, y, w, hgt) {
    // A paper strip with a torn right edge.
    let d = `M${x},${y} H${x + w - 6}`;
    const steps = Math.floor(hgt / 7);
    for (let k = 0; k < steps; k += 1) d += ` l${k % 2 ? -6 : 6},${hgt / steps}`;
    return `${d} H${x} Z`;
  }

  const STRIP = { before: { y: 198 }, after: { y: 264 }, x: 6, w: 328, h: 60 };
  const TOOL_X = [6, 118, 230];
  const TOOL_Y = 352;
  const TOOL_W = 104;
  const TOOL_H = 120;

  function drawFusen(g, row) {
    // The editor's memo: supplied input tucked into the book, a separate warm branch.
    const annotation = row[side].annotation;
    const f = FOCUS[row.id];
    g.append(sv('path', { d: 'M150,1 H334 V70 H150 Z', fill: C.warmWash, stroke: C.warm, 'stroke-width': 1.4 }));
    g.append(txt(160, 17, '照合メモ（入力）', 11.5, { fill: C.warmInk, 'font-weight': 800 }));
    g.append(txt(326, 17, `${SIDE_LABEL[side]}・制作担当`, 10.5, { fill: C.warmInk, 'text-anchor': 'end' }));
    g.append(txt(160, 37, SHORT_LABEL[annotation.label], 16, { fill: C.warmInk, 'font-weight': 800 }));
    const extra = f && f.type === 'conditions' && side === 'after' && annotation.note.startsWith(f.chips.join('・'))
      ? `条件：${f.chips.join('・')}`
      : annotation.label;
    g.append(txt(160, 53, extra, 10.5, { fill: C.warmInk }));
  }

  function drawBook(g, row) {
    const docId = row.reference_document_ids[0];
    // Page stack, then the two open pages meeting at the spine.
    g.append(sv('path', { d: 'M8,196 Q88,188 170,198 Q252,188 332,196', fill: 'none', stroke: C.rule, 'stroke-width': 1.4 }));
    g.append(sv('path', { d: 'M6,66 Q88,58 170,68 L170,194 Q88,184 6,192 Z', fill: C.paper, stroke: C.ink, 'stroke-width': 1.5 }));
    g.append(sv('path', { d: 'M334,66 Q252,58 170,68 L170,194 Q252,184 334,192 Z', fill: C.paper, stroke: C.ink, 'stroke-width': 1.5 }));
    g.append(txt(16, 86, `問い ${row.id}`, 11, { fill: C.muted, 'font-weight': 700 }));
    wrapChars(Array.from(row.question), 11, 3).forEach((line, i) => g.append(txt(16, 106 + i * 18, line.map((x) => x.c).join(''), 13, { 'font-weight': 700 })));
    g.append(txt(16, 180, `資料 ${docId}`, 11, { fill: C.muted }));
    g.append(txt(180, 86, '参照文', 11, { fill: C.muted, 'font-weight': 700 }));
    wrapChars(Array.from(row.reference), 11, 4).forEach((line, i) => g.append(txt(180, 106 + i * 18, line.map((x) => x.c).join(''), 13)));
    const f = FOCUS[row.id];
    if (f && f.type === 'clock') g.append(clockGlyph(314, 82, 11, f.reference, null));
  }

  function drawStrip(g, row, s) {
    const active = s === side;
    const y = STRIP[s].y;
    const { x, w } = STRIP;
    const hgt = STRIP.h;
    const answer = row[s];
    const parts = diffParts(row.reference, answer.response);
    const f = FOCUS[row.id];
    const sg = sv('g', { opacity: active ? 1 : 0.5 });
    sg.append(sv('path', { d: stripPath(x, y, w, hgt), fill: '#fff', stroke: C.ink, 'stroke-width': active ? 2.2 : 1 }));
    sg.append(txt(x + 8, y + 18, SIDE_LABEL[s], 12, { 'font-weight': 800 }));
    if (f && f.type === 'clock') sg.append(clockGlyph(x + 22, y + 36, 10, f[s], f.reference));
    const appended = !parts.removed && !parts.tail && parts.mid && Array.from(parts.head).length <= 19 && Array.from(parts.mid).length <= 17;
    if (appended) {
      // The reference fits whole on the first line; the added sentence is a separate attached slip.
      sg.append(txt(x + 50, y + 19, parts.head, 14, { fill: C.muted }));
      const aw = Array.from(parts.mid).length * 14 + 12;
      sg.append(sv('rect', { x: x + 46, y: y + 26, width: aw, height: 22, fill: C.attach, stroke: C.ink, 'stroke-width': 0.8, transform: `rotate(-1.5 ${x + 46} ${y + 37})` }));
      sg.append(sv('rect', { x: x + 40, y: y + 29, width: 12, height: 6, fill: C.rule, opacity: 0.9 }));
      sg.append(txt(x + 52, y + 42, parts.mid, 14, { 'font-weight': 800 }));
    } else {
      sg.append(markedText(x + 50, y + 19, 18, 14, answer.response, (i) => i >= parts.headLen && i < Array.from(answer.response).length - parts.tailLen, 19, 2));
    }
    const sc = answer.scores;
    sg.append(txt(x + 50, y + 55, `同じ文字 ${show('exact_match', sc.exact_match)} ・ 文字の近さ ${show('string_similarity', sc.string_similarity)} ・ 全文を含む ${show('string_presence', sc.string_presence)}`, 10.5, { fill: C.muted }));
    g.append(sg);
  }

  function drawOverlay(g, cx, y, v, color) {
    // Reference comb on top, answer comb below: identical strings lock together; any difference leaves a gap.
    const left = cx - 36;
    g.append(sv('rect', { x: left, y, width: 72, height: 6, fill: color }));
    for (let k = 0; k < 5; k += 1) g.append(sv('rect', { x: left + 3 + k * 15, y: y + 6, width: 6, height: 8, fill: color }));
    const locked = v === 1;
    const by = locked ? y + 14 : y + 26;
    const shift = locked ? 0 : 6;
    g.append(sv('rect', { x: left + shift, y: by, width: 72, height: 6, fill: '#fff', stroke: color, 'stroke-width': 1.5 }));
    for (let k = 0; k < 4; k += 1) g.append(sv('rect', { x: left + 10.5 + k * 15 + shift, y: by - 8, width: 6, height: 8, fill: '#fff', stroke: color, 'stroke-width': 1.5 }));
  }

  function drawRuler(g, cx, y, v, color) {
    const x0 = cx - 38;
    const len = 76;
    const base = y + 22;
    g.append(sv('rect', { x: x0, y: base + 3, width: len * v, height: 5, fill: color }));
    g.append(sv('line', { x1: x0, y1: base, x2: x0 + len, y2: base, stroke: C.ink, 'stroke-width': 1.4 }));
    for (let k = 0; k <= 10; k += 1) {
      const tx = x0 + (len * k) / 10;
      g.append(sv('line', { x1: tx, y1: base, x2: tx, y2: base - (k % 5 === 0 ? 7 : 4), stroke: C.ink, 'stroke-width': 1 }));
    }
    const px = x0 + len * v;
    g.append(sv('path', { d: `M${px},${base - 1} l-5,-10 h10 Z`, fill: color }));
    g.append(txt(x0, base + 20, '0', 9, { fill: C.muted, 'text-anchor': 'middle' }));
    g.append(txt(x0 + len, base + 20, '1', 9, { fill: C.muted, 'text-anchor': 'middle' }));
  }

  function drawSleeve(g, cx, y, v, longer, color) {
    // A transparent sleeve the size of the whole reference.
    g.append(sv('rect', { x: cx - 34, y: y + 4, width: 68, height: 26, rx: 5, fill: '#fff', 'fill-opacity': 0.6, stroke: color, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
    if (v === 1) {
      g.append(sv('rect', { x: cx - 28, y: y + 12, width: 56, height: 10, fill: color }));
      if (longer) {
        g.append(sv('rect', { x: cx + 30, y: y + 12, width: 20, height: 10, fill: C.attach, stroke: C.ink, 'stroke-width': 0.8, transform: `rotate(-6 ${cx + 30} ${y + 17})` }));
      }
    } else {
      g.append(sv('rect', { x: cx - 28, y: y + 12, width: 24, height: 10, fill: color }));
      g.append(sv('rect', { x: cx + 2, y: y + 22, width: 30, height: 10, fill: 'none', stroke: color, 'stroke-width': 1.5, transform: `rotate(10 ${cx + 2} ${y + 27})` }));
    }
  }

  function drawTools(g, row, flashIndex) {
    const answer = row[side];
    for (let i = 0; i < TOOLS.length; i += 1) {
      const t = TOOLS[i];
      const x = TOOL_X[i];
      const cx = x + TOOL_W / 2;
      const v = answer.scores[t.id];
      g.append(sv('rect', { x, y: TOOL_Y, width: TOOL_W, height: TOOL_H, rx: 10, fill: t.wash, stroke: t.ink, 'stroke-width': flashIndex === i ? 3.2 : 1.5 }));
      g.append(sv('rect', { x: x + 10, y: TOOL_Y, width: TOOL_W - 20, height: 4, fill: t.ink }));
      g.append(txt(cx, TOOL_Y + 24, t.label, 13, { 'text-anchor': 'middle', 'font-weight': 800 }));
      if (i === 0) drawOverlay(g, cx, TOOL_Y + 36, v, t.ink);
      if (i === 1) drawRuler(g, cx, TOOL_Y + 34, v, t.ink);
      if (i === 2) drawSleeve(g, cx, TOOL_Y + 32, v, v === 1 && answer.response !== row.reference, t.ink);
      g.append(sv('rect', { x: x + 14, y: TOOL_Y + 88, width: TOOL_W - 28, height: 24, rx: 12, fill: C.paper, stroke: t.ink, 'stroke-width': 1.5 }));
      g.append(txt(cx, TOOL_Y + 105, show(t.id, v), 15, { 'text-anchor': 'middle', 'font-weight': 800, 'font-variant-numeric': 'tabular-nums' }));
    }
  }

  function drawConnectors(g) {
    const sy = STRIP[side].y + STRIP.h;
    const line = (d, extra = {}) => g.append(sv('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': 1.3, ...extra }));
    // From the active strip down to the three tools…
    line(`M170,${sy} V340 M58,340 H282 M58,340 V${TOOL_Y} M170,340 V${TOOL_Y} M282,340 V${TOOL_Y}`);
    // …and from their values to the one saved question.
    line(`M58,${TOOL_Y + TOOL_H} V482 H282 V${TOOL_Y + TOOL_H} M170,${TOOL_Y + TOOL_H} V490`);
  }

  function drawCard(g, row) {
    const docId = row.reference_document_ids[0];
    g.append(sv('rect', { x: 6, y: 490, width: 328, height: 36, rx: 8, fill: C.paper, stroke: C.ink, 'stroke-width': 1.5 }));
    g.append(sv('path', { d: 'M16,496 h14 l6,6 v18 h-20 Z M30,496 v6 h6', fill: '#fff', stroke: C.ink, 'stroke-width': 1.1 }));
    g.append(txt(44, 506, `${row.id} ・ 資料${docId} ・ 変更前と変更後の値`, 11.5, { 'font-weight': 700 }));
    g.append(txt(44, 521, `nagi-faq-${row.id}.json`, 11, { fill: C.muted, 'font-family': 'ui-monospace, Consolas, Menlo, monospace' }));
  }

  // The same strip, in miniature, travels into each tool and out to the saved question.
  function chipAt(p) {
    const sy = STRIP[side].y + STRIP.h;
    const pts = [[170, sy - 14], [170, 340], [58, 340], [58, TOOL_Y + 46], [170, TOOL_Y + 46], [282, TOOL_Y + 46], [282, 482], [170, 482], [170, 506]];
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i += 1) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(d);
      total += d;
    }
    let dist = p * total;
    for (let i = 0; i < seg.length; i += 1) {
      if (dist <= seg[i] || i === seg.length - 1) {
        const k = seg[i] ? Math.min(1, dist / seg[i]) : 1;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
      }
      dist -= seg[i];
    }
    return pts[pts.length - 1];
  }

  function drawDiagram(p) {
    if (!data || !selectedId) return;
    const row = data.rowsById.get(selectedId);
    const root = el.root;
    const g = sv('g', { 'font-family': 'system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", Meiryo, "Noto Sans JP", sans-serif' });
    let flash = -1;
    let chip = null;
    if (p < 1) {
      chip = chipAt(p);
      for (let i = 0; i < 3; i += 1) {
        if (chip[1] > TOOL_Y && chip[1] < TOOL_Y + TOOL_H && Math.abs(chip[0] - (TOOL_X[i] + TOOL_W / 2)) < 30) flash = i;
      }
    }
    drawFusen(g, row);
    drawBook(g, row);
    drawConnectors(g);
    drawStrip(g, row, 'before');
    drawStrip(g, row, 'after');
    drawTools(g, row, flash);
    drawCard(g, row);
    if (chip) {
      const [cx, cy] = chip;
      g.append(sv('rect', { x: cx - 15, y: cy - 8, width: 30, height: 16, rx: 2, fill: '#fff', stroke: C.ink, 'stroke-width': 1.6 }));
      g.append(sv('path', { d: `M${cx - 10},${cy - 2} h20 M${cx - 10},${cy + 3} h14`, stroke: C.ink, 'stroke-width': 1.2 }));
    }
    root.replaceChildren(g);

    const sc = row[side].scores;
    el.title.textContent = `${row.id}：${row.question}（${SIDE_LABEL[side]}の固定回答）`;
    el.desc.textContent = `資料${row.reference_document_ids[0]}の本の参照文「${row.reference}」と、${SIDE_LABEL[side]}の固定回答「${row[side].response}」を、3つの道具で測った保存済みの値：同じ文字 ${show('exact_match', sc.exact_match)}、文字の近さ ${show('string_similarity', sc.string_similarity)}、全文を含む ${show('string_presence', sc.string_presence)}。本から下がる照合メモ（入力・制作担当）：${SHORT_LABEL[row[side].annotation.label]}。`;
  }

  function redraw(animate) {
    stopAnimation();
    if (!animate || reducedMotion()) {
      drawDiagram(1);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / ANIMATION_MS);
      const p = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      drawDiagram(k >= 1 ? 1 : p);
      raf = k >= 1 ? 0 : requestAnimationFrame(step);
    };
    drawDiagram(0);
    raf = requestAnimationFrame(step);
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
    el.exportState.textContent = `JSONのダウンロードを要求しました（${name}。変更前と変更後の両方の値と根拠資料を含みます）。`;
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

  el.caseList.addEventListener('click', (event) => {
    const btn = event.target.closest('button.case');
    if (!btn || !data || btn.disabled) return;
    select(btn.dataset.id, { animate: true });
  });
  for (const b of phaseButtons) b.addEventListener('click', () => setSide(b.dataset.side));
  el.picker.addEventListener('click', (event) => {
    const btn = event.target.closest('button.pick');
    if (!btn || !data) return;
    select(btn.dataset.id, { animate: true });
    el.figure.focus({ preventScroll: true });
    el.figure.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  window.addEventListener('hashchange', () => {
    const id = idFromHash();
    if (id && id !== selectedId) select(id, { animate: true, updateHash: false });
  });
  el.retry.addEventListener('click', load);
  el.exportBtn.addEventListener('click', exportSelected);
  el.copy.addEventListener('click', copyRequest);

  load();
  loadRequest();
})();
