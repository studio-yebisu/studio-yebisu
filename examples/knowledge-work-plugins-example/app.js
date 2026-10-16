// 声から、次の試作へ — saved Synthesize Research output viewer.
// Copyright (c) 2026 Studio Yebisu. MIT License.
// Reads input/interviews.json and outputs/synthesis.json. No model is called from this page.

const SKILL_URL = 'https://github.com/anthropics/knowledge-work-plugins/blob/f652327d4e953d7957d99e735c3c7f9964e9d2e5/product-management/skills/synthesize-research/SKILL.md';
const SOURCE_PIN = 'anthropics/knowledge-work-plugins f652327d4e953d7957d99e735c3c7f9964e9d2e5（product-management v1.2.0・Apache-2.0）';
const LINE_HASH = /^#line-(P\d{2}-L\d{2})$/;

const KIND_LABEL = {
  reported_behavior: '自己申告の行動',
  stated_preference: '希望',
  positive_signal: '良い点（自己申告）',
  uncertainty: '未定',
};
const CONFIDENCE_LABEL = { high: '高', medium: '中', low: '低' };

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const $ = (id) => document.getElementById(id);
const el = {
  root: document.documentElement,
  loadStatus: $('load-status'),
  retry: $('retry'),
  chips: Array.from(document.querySelectorAll('[data-participant]')).filter((n) => n.tagName === 'BUTTON'),
  query: $('query'),
  reset: $('reset'),
  count: $('match-count'),
  list: $('finding-list'),
  empty: $('empty'),
  detail: $('detail'),
  dEyebrow: $('detail-eyebrow'),
  dTitle: $('detail-title'),
  dBody: $('detail-body'),
  dFrequency: $('d-frequency'),
  dConfidence: $('d-confidence'),
  dImpact: $('d-impact'),
  dSummary: $('d-summary'),
  dEvidence: $('d-evidence'),
  dContra: $('d-contra'),
  dContraNone: $('d-contra-none'),
  dReason: $('d-reason'),
  dNext: $('d-next'),
  dRecs: $('d-recs'),
  saveMd: $('save-md'),
  saveJson: $('save-json'),
  saveStatus: $('save-status'),
  openQuestions: $('open-questions'),
  limits: $('limits'),
  unknownsStatus: $('unknowns-status'),
  requestText: $('request-text'),
  requestStatus: $('request-status'),
  requestRetry: $('request-retry'),
  copy: $('copy-request'),
  copyStatus: $('copy-status'),
};

const state = {
  data: null, // { interviews, synthesis, lines, participants, observations, findings, recsByFinding }
  participant: 'all',
  query: '',
  selectedId: null,
  renderedId: null,
  visible: [],
  controller: null,
  requestController: null,
  requestText: '',
};

class DataError extends Error {}

/* ---------- loading ---------- */

async function getJSON(url, signal) {
  let res;
  try {
    res = await fetch(url, { signal, cache: 'no-store' });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    const hint = location.protocol === 'file:'
      ? 'ファイルを直接開くと読み込めません。README.md の手順で、手元のHTTPサーバーから開いてください。'
      : '通信を確かめてから、もう一度読み込んでください。';
    throw new DataError(`${url} を読み込めませんでした。${hint}`);
  }
  if (!res.ok) throw new DataError(`${url} を読み込めませんでした（HTTP ${res.status}）。`);
  try {
    return await res.json();
  } catch {
    throw new DataError(`${url} をJSONとして読めませんでした。`);
  }
}

function must(cond, message) {
  if (!cond) throw new DataError(`保存済みデータの形が想定と違います：${message}`);
}
const isStr = (v) => typeof v === 'string' && v.length > 0;

function validate(interviews, synthesis) {
  must(interviews && interviews.fictional === true, 'interviews.json が架空の資料として記録されていません');
  must(Array.isArray(interviews.participants) && interviews.participants.length > 0, '参加者がありません');
  const lines = new Map();
  const participants = new Map();
  for (const p of interviews.participants) {
    must(isStr(p.id) && isStr(p.segment) && Array.isArray(p.lines), '参加者の項目が足りません');
    participants.set(p.id, p);
    for (const line of p.lines) {
      must(isStr(line.id) && isStr(line.text), `${p.id} の行の項目が足りません`);
      must(!lines.has(line.id), `行ID ${line.id} が重複しています`);
      lines.set(line.id, { ...line, participant: p.id });
    }
  }

  must(synthesis && synthesis.meta && synthesis.meta.fictional === true, 'synthesis.json の meta.fictional が true ではありません');
  must(synthesis.meta.participant_count === participants.size, '参加者の人数が原文と合いません');
  must(Array.isArray(synthesis.observations), 'observations がありません');
  const observations = new Map();
  for (const o of synthesis.observations) {
    must(isStr(o.id) && isStr(o.line_id) && isStr(o.source_id), '観察の項目が足りません');
    const line = lines.get(o.line_id);
    must(line, `観察 ${o.id} の行 ${o.line_id} が原文にありません`);
    must(line.participant === o.source_id, `観察 ${o.id} の参加者が原文と合いません`);
    must(o.quote === line.text, `観察 ${o.id} の引用が原文 ${o.line_id} と一致しません`);
    must(hasOwn(KIND_LABEL, o.kind),`観察 ${o.id} の種類が不明です`);
    observations.set(o.id, o);
  }

  must(Array.isArray(synthesis.findings), 'findings がありません');
  for (const f of synthesis.findings) {
    must(isStr(f.id) && isStr(f.title) && isStr(f.summary), '発見の項目が足りません');
    must(Array.isArray(f.observation_ids) && f.observation_ids.length > 0, `発見 ${f.id} に根拠がありません`);
    const support = new Set();
    for (const oid of f.observation_ids) {
      const o = observations.get(oid);
      must(o, `発見 ${f.id} の観察 ${oid} がありません`);
      support.add(o.source_id);
    }
    must(Array.isArray(f.participant_ids)
      && f.participant_ids.length === support.size
      && f.participant_ids.every((id) => support.has(id)), `発見 ${f.id} の参加者が根拠と合いません`);
    must(f.frequency === support.size, `発見 ${f.id} の人数が根拠と合いません`);
    must(hasOwn(CONFIDENCE_LABEL, f.confidence),`発見 ${f.id} の確からしさが不明です`);
    must(Array.isArray(f.contradictions), `発見 ${f.id} の反する発言の欄がありません`);
    for (const c of f.contradictions) {
      must(lines.has(c.line_id), `発見 ${f.id} の反する発言 ${c.line_id} が原文にありません`);
    }
  }

  const findingIds = new Set(synthesis.findings.map((f) => f.id));
  must(Array.isArray(synthesis.recommendations), 'recommendations がありません');
  const recsByFinding = new Map();
  for (const r of synthesis.recommendations) {
    must(isStr(r.id) && Array.isArray(r.finding_ids), '提案の項目が足りません');
    for (const fid of r.finding_ids) {
      must(findingIds.has(fid), `提案 ${r.id} が存在しない発見 ${fid} を指しています`);
      if (!recsByFinding.has(fid)) recsByFinding.set(fid, []);
      recsByFinding.get(fid).push(r);
    }
  }
  must(Array.isArray(synthesis.open_questions) && Array.isArray(synthesis.limits), '未解決の問いか限界の欄がありません');

  // The notes printed in the page must be the same text as input/interviews.json.
  const printed = document.querySelectorAll('.line[data-line-id]');
  must(printed.length === lines.size, 'ページの原文の行数が input/interviews.json と合いません');
  for (const li of printed) {
    const line = lines.get(li.dataset.lineId);
    const text = li.querySelector('.line-text');
    must(line && text && text.textContent === line.text, `ページの原文 ${li.dataset.lineId} が input/interviews.json と一致しません`);
  }

  const findings = synthesis.findings.map((f, index) => ({ ...f, rank: index + 1, haystack: buildHaystack(f, observations, lines) }));
  return { interviews, synthesis, lines, participants, observations, findings, recsByFinding };
}

function fold(text) {
  return String(text).normalize('NFKC').toLowerCase();
}

function buildHaystack(f, observations, lines) {
  const parts = [f.id, f.title, f.summary, f.impact, f.confidence_reason, f.next_step];
  for (const oid of f.observation_ids) {
    const o = observations.get(oid);
    parts.push(o.line_id, o.quote, o.code, o.interpretation);
  }
  for (const c of f.contradictions) parts.push(c.line_id, lines.get(c.line_id).text, c.note);
  return fold(parts.join('\n'));
}

async function load() {
  if (state.controller) state.controller.abort();
  const controller = new AbortController();
  state.controller = controller;
  setState('loading');
  el.loadStatus.textContent = '保存済みの整理と原文を読み込んでいます…';
  el.retry.disabled = true;

  try {
    const [interviews, synthesis] = await Promise.all([
      getJSON('input/interviews.json', controller.signal),
      getJSON('outputs/synthesis.json', controller.signal),
    ]);
    if (controller !== state.controller) return;
    state.data = validate(interviews, synthesis);
    renderUnknowns();
    annotateLines();
    setState('ready');
    el.loadStatus.textContent = `保存済みの整理を読み込みました。発見は${state.data.findings.length}件です。`;
    el.retry.hidden = true;
    applyFilters({ keepSelection: false });
  } catch (err) {
    if (err.name === 'AbortError' || controller !== state.controller) return;
    state.data = null;
    state.visible = [];
    state.selectedId = null;
    setState('error');
    el.loadStatus.textContent = err instanceof DataError
      ? `${err.message} 表示と保存は止めています。`
      : '読み込みの途中で問題が起きました。表示と保存は止めています。';
    el.retry.hidden = false;
    clearView();
  } finally {
    if (controller === state.controller) {
      state.controller = null;
      el.retry.disabled = false;
    }
  }
}

function setState(name) {
  el.root.dataset.state = name;
  el.loadStatus.classList.toggle('is-error', name === 'error');
  const ready = name === 'ready';
  for (const chip of el.chips) chip.disabled = !ready;
  el.query.disabled = !ready;
  el.reset.disabled = !ready;
  el.saveJson.disabled = !ready;
  if (!ready) el.saveMd.disabled = true;
}

function clearView() {
  el.list.replaceChildren();
  el.empty.hidden = true;
  el.count.textContent = '—';
  clearDetail('読み込めていないため、発見を表示できません。');
  el.saveMd.disabled = true;
  el.saveMd.textContent = '選んだ発見をMarkdownで保存';
  el.openQuestions.replaceChildren();
  el.limits.replaceChildren();
  el.unknownsStatus.hidden = false;
  for (const node of document.querySelectorAll('.line-uses')) node.remove();
}

/* ---------- filter & list ---------- */

function tokens(query) {
  return fold(query).split(/\s+/).filter(Boolean);
}

function applyFilters({ keepSelection = true } = {}) {
  if (!state.data) return;
  const words = tokens(state.query);
  const all = state.data.findings;
  state.visible = all.filter((f) =>
    (state.participant === 'all' || f.participant_ids.includes(state.participant))
    && words.every((w) => f.haystack.includes(w)));

  if (!keepSelection || !state.visible.some((f) => f.id === state.selectedId)) {
    state.selectedId = state.visible.length ? state.visible[0].id : null;
  }

  const conditions = [];
  if (state.participant !== 'all') conditions.push(`${state.participant}が支持`);
  if (words.length) conditions.push(`「${state.query.trim()}」を含む`);
  el.count.textContent = `${all.length}件中${state.visible.length}件を表示${conditions.length ? `（${conditions.join('・')}）` : ''}`;

  for (const chip of el.chips) chip.setAttribute('aria-pressed', String(chip.dataset.participant === state.participant));
  renderList();
  renderDetail();
}

function renderList() {
  const items = state.visible.map((f) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'finding-btn';
    btn.dataset.findingId = f.id;
    btn.setAttribute('aria-pressed', String(f.id === state.selectedId));

    const no = document.createElement('span');
    no.className = 'finding-no';
    no.textContent = f.id;
    const name = document.createElement('span');
    name.className = 'finding-name';
    name.textContent = f.title;
    const meta = document.createElement('span');
    meta.className = 'finding-meta';
    meta.textContent = `${f.frequency}/${state.data.participants.size}人・確からしさ ${CONFIDENCE_LABEL[f.confidence]}${f.contradictions.length ? `・反する発言 ${f.contradictions.length}` : ''}`;
    btn.append(no, name, meta);
    li.append(btn);
    return li;
  });
  el.list.replaceChildren(...items);
  el.empty.hidden = state.visible.length > 0;
}

function selectFinding(id, { fromList = false } = {}) {
  if (!state.visible.some((f) => f.id === id)) return;
  state.selectedId = id;
  for (const btn of el.list.querySelectorAll('.finding-btn')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.findingId === id));
  }
  renderDetail();
  if (fromList && window.matchMedia('(max-width: 63.99rem)').matches) {
    el.dTitle.focus({ preventScroll: true });
    el.detail.scrollIntoView({ block: 'start', behavior: smoothOrAuto() });
  }
}

function smoothOrAuto() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/* ---------- detail ---------- */

function clearDetail(message) {
  el.dEyebrow.textContent = '';
  el.dTitle.textContent = message;
  el.dBody.hidden = true;
  for (const node of [el.dFrequency, el.dConfidence, el.dImpact, el.dSummary, el.dReason, el.dNext]) node.textContent = '';
  el.dEvidence.replaceChildren();
  el.dContra.replaceChildren();
  el.dRecs.replaceChildren();
}

function current() {
  return state.data && state.selectedId ? state.data.findings.find((f) => f.id === state.selectedId) : null;
}

function renderDetail() {
  const f = current();
  const shownId = f ? f.id : null;
  if (shownId !== state.renderedId) {
    state.renderedId = shownId;
    el.saveStatus.textContent = '';
  }
  if (!f) {
    clearDetail(state.data ? '条件に合う発見がないため、表示している発見はありません。' : '読み込めていないため、発見を表示できません。');
    el.saveMd.disabled = true;
    el.saveMd.textContent = '選んだ発見をMarkdownで保存';
    return;
  }
  const { participants, observations, lines, findings } = state.data;
  el.dEyebrow.textContent = `${f.id}・優先順 ${f.rank}/${findings.length}（暫定）`;
  el.dTitle.textContent = f.title;
  el.dBody.hidden = false;
  el.dFrequency.textContent = `${f.frequency}/${participants.size}人（${f.participant_ids.join('・')}）`;
  el.dConfidence.textContent = CONFIDENCE_LABEL[f.confidence];
  el.dImpact.textContent = f.impact;
  el.dSummary.textContent = f.summary;
  el.dReason.textContent = f.confidence_reason;
  el.dNext.textContent = f.next_step;

  el.dEvidence.replaceChildren(...f.observation_ids.map((oid) => {
    const o = observations.get(oid);
    return evidenceItem({
      lineId: o.line_id,
      participant: participants.get(o.source_id),
      kind: KIND_LABEL[o.kind],
      quote: o.quote,
      noteLabel: '解釈',
      note: o.interpretation,
    });
  }));

  el.dContra.replaceChildren(...f.contradictions.map((c) => {
    const line = lines.get(c.line_id);
    return evidenceItem({
      lineId: c.line_id,
      participant: participants.get(line.participant),
      kind: '反する発言',
      quote: line.text,
      noteLabel: 'この発見との関係',
      note: c.note,
    });
  }));
  el.dContraNone.hidden = f.contradictions.length > 0;

  const recs = state.data.recsByFinding.get(f.id) || [];
  el.dRecs.replaceChildren(...recs.map(recItem));

  el.saveMd.disabled = false;
  el.saveMd.textContent = `選んだ発見（${f.id}）をMarkdownで保存`;
}

function evidenceItem({ lineId, participant, kind, quote, noteLabel, note }) {
  const li = document.createElement('li');
  li.className = 'ev';

  const head = document.createElement('p');
  head.className = 'ev-head';
  const idSpan = document.createElement('span');
  idSpan.className = 'ev-line';
  idSpan.textContent = lineId;
  const who = document.createElement('span');
  who.textContent = `${participant.id}・${participant.segment}`;
  const kindSpan = document.createElement('span');
  kindSpan.className = 'ev-kind';
  kindSpan.textContent = kind;
  head.append(idSpan, who, kindSpan);

  const bq = document.createElement('blockquote');
  bq.className = 'ev-quote';
  bq.textContent = quote;

  const jump = document.createElement('p');
  jump.className = 'ev-jump';
  const a = document.createElement('a');
  a.className = 'textlink';
  a.href = `#line-${lineId}`;
  a.textContent = `原文 ${lineId} を見る`;
  jump.append(a);

  const interp = document.createElement('p');
  interp.className = 'ev-interp';
  const label = document.createElement('span');
  label.className = 'ev-interp-label';
  label.textContent = `${noteLabel}（整理者）`;
  interp.append(label, document.createTextNode(note));

  li.append(head, bq, jump, interp);
  return li;
}

function recItem(r) {
  const li = document.createElement('li');
  li.className = 'rec';
  const head = document.createElement('p');
  head.className = 'rec-head';
  head.append(document.createTextNode(`提案 ${r.id}`));
  const prio = document.createElement('span');
  prio.className = 'rec-prio';
  prio.textContent = r.priority;
  head.append(prio);
  const dl = document.createElement('dl');
  for (const [term, value] of [['すること', r.action], ['確かめ方（未実施）', r.validation], ['実現の見込み（仮定）', r.feasibility_note]]) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.append(dt, dd);
  }
  li.append(head, dl);
  return li;
}

/* ---------- source notes ---------- */

function annotateLines() {
  for (const node of document.querySelectorAll('.line-uses')) node.remove();
  const uses = new Map();
  const add = (lineId, text) => {
    if (!uses.has(lineId)) uses.set(lineId, []);
    uses.get(lineId).push(text);
  };
  for (const f of state.data.findings) {
    for (const oid of f.observation_ids) add(state.data.observations.get(oid).line_id, `${f.id}の根拠`);
    for (const c of f.contradictions) add(c.line_id, `${f.id}に反する発言`);
  }
  for (const li of document.querySelectorAll('.line[data-line-id]')) {
    const span = document.createElement('span');
    span.className = 'line-uses';
    const list = uses.get(li.dataset.lineId);
    span.textContent = list ? list.join('・') : 'どの発見の支持にも数えていません';
    li.append(span);
  }
}

function revealLine(lineId, { focus = true } = {}) {
  const target = document.getElementById(`line-${lineId}`);
  if (!target || !target.classList.contains('line')) return false;
  const details = target.closest('details');
  if (details && !details.open) details.open = true;
  for (const node of document.querySelectorAll('.line.is-target')) node.classList.remove('is-target');
  target.classList.add('is-target');
  if (focus) {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: smoothOrAuto() });
  }
  return true;
}

function lineIdFromHash(hash) {
  const m = LINE_HASH.exec(hash);
  return m ? m[1] : null;
}

document.addEventListener('click', (event) => {
  const a = event.target.closest('a[href^="#line-"]');
  if (!a) return;
  const hash = a.getAttribute('href');
  const lineId = lineIdFromHash(hash);
  if (!lineId) return;
  // Open the participant's notes before the browser scrolls to the fragment.
  const target = document.getElementById(`line-${lineId}`);
  const details = target && target.closest('details');
  if (details) details.open = true;
  if (location.hash === hash) revealLine(lineId); // same fragment: no hashchange fires
});

window.addEventListener('hashchange', () => {
  const lineId = lineIdFromHash(location.hash);
  if (lineId) revealLine(lineId);
});

/* ---------- unknowns ---------- */

function renderUnknowns() {
  const toItems = (list) => list.map((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  });
  el.openQuestions.replaceChildren(...toItems(state.data.synthesis.open_questions));
  el.limits.replaceChildren(...toItems(state.data.synthesis.limits));
  el.unknownsStatus.hidden = true;
}

/* ---------- export ---------- */

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function findingMarkdown(f) {
  const { participants, observations, lines, synthesis } = state.data;
  const total = participants.size;
  const out = [];
  out.push(`# ${f.id} ${f.title}`, '');
  out.push(`> 架空のヒアリングメモ${total}件（すべて架空の参加者の自己申告）を整理した保存済みの結果のうち1件です。人数は「この${total}人のうち何人か」で、利用者全体の割合ではありません。発見は暫定的な解釈で、実装や正式採用の判断ではありません。`, '');
  out.push(`- 問い：${synthesis.meta.research_question}`);
  out.push(`- 支持する参加者：${f.frequency}/${total}人（${f.participant_ids.join('・')}）`);
  out.push(`- 確からしさ：${CONFIDENCE_LABEL[f.confidence]}（${f.confidence_reason}）`);
  out.push(`- 影響：${f.impact}`);
  out.push(`- 優先順：${f.rank}/${state.data.findings.length}（暫定）`, '');
  out.push('## 発見（整理者の解釈）', '', f.summary, '');
  out.push('## 支持する発言（原文のまま）', '');
  for (const oid of f.observation_ids) {
    const o = observations.get(oid);
    const p = participants.get(o.source_id);
    out.push(`- ${o.line_id}（${p.id}・${p.segment}／${KIND_LABEL[o.kind]}）`);
    out.push(`  > ${o.quote}`);
    out.push(`  - 解釈（整理者）：${o.interpretation}`);
  }
  out.push('', '## 反する発言（支持の人数に数えない）', '');
  if (f.contradictions.length === 0) {
    out.push('この発見に反する発言は記録していません。');
  } else {
    for (const c of f.contradictions) {
      const line = lines.get(c.line_id);
      const p = participants.get(line.participant);
      out.push(`- ${c.line_id}（${p.id}・${p.segment}）`);
      out.push(`  > ${line.text}`);
      out.push(`  - この発見との関係（整理者）：${c.note}`);
    }
  }
  out.push('', '## 次の一歩', '', f.next_step, '');
  const recs = state.data.recsByFinding.get(f.id) || [];
  if (recs.length) {
    out.push('## 関わる提案', '');
    for (const r of recs) {
      out.push(`- ${r.id}［${r.priority}］${r.action}`);
      out.push(`  - 確かめ方（未実施）：${r.validation}`);
      out.push(`  - 実現の見込み（仮定）：${r.feasibility_note}`);
    }
    out.push('');
  }
  out.push('## 出典と範囲', '');
  out.push(`- 原文：input/interviews.json（架空・${total}人・自己申告。操作の観察・ログ・アンケートは含まない）`);
  out.push('- 整理：outputs/synthesis.json（制作時に Claude Opus 5.5 が固定版 SKILL.md を適用して保存した結果。人によるレビューなし）');
  out.push(`- スキル：${SOURCE_PIN}`);
  out.push(`  ${SKILL_URL}`);
  out.push('- このファイルは保存済みデータから組み立てたもので、新しいAIの整理は行っていません。');
  return out.join('\n') + '\n';
}

el.saveMd.addEventListener('click', () => {
  const f = current();
  if (!f || el.root.dataset.state !== 'ready') return;
  const name = `synthesis-${f.id}.md`;
  download(name, findingMarkdown(f), 'text/markdown;charset=utf-8');
  el.saveStatus.textContent = `${f.id} のMarkdown（${name}）のダウンロードを開始しました。`;
});

el.saveJson.addEventListener('click', () => {
  if (!state.data || el.root.dataset.state !== 'ready') return;
  download('synthesis.json', JSON.stringify(state.data.synthesis, null, 2) + '\n', 'application/json;charset=utf-8');
  el.saveStatus.textContent = '整理全体のJSON（synthesis.json）のダウンロードを開始しました。';
});

/* ---------- request.txt ---------- */

async function loadRequest() {
  if (state.requestController) state.requestController.abort();
  const controller = new AbortController();
  state.requestController = controller;
  el.copy.disabled = true;
  el.requestRetry.disabled = true;
  el.requestStatus.textContent = 'request.txt を読み込んでいます…';
  try {
    const res = await fetch('request.txt', { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new DataError(`request.txt を読み込めませんでした（HTTP ${res.status}）。`);
    const text = await res.text();
    if (controller !== state.requestController) return;
    if (!text.trim()) throw new DataError('request.txt が空です。');
    state.requestText = text;
    el.requestText.value = text;
    el.requestStatus.textContent = '';
    el.requestStatus.hidden = true;
    el.requestRetry.hidden = true;
    el.copy.disabled = false;
  } catch (err) {
    if (err.name === 'AbortError' || controller !== state.requestController) return;
    state.requestText = '';
    el.requestText.value = '';
    el.requestStatus.hidden = false;
    el.requestStatus.textContent = err instanceof DataError ? err.message : 'request.txt を読み込めませんでした。上のリンクから直接開けます。';
    el.requestRetry.hidden = false;
  } finally {
    if (controller === state.requestController) {
      state.requestController = null;
      el.requestRetry.disabled = false;
    }
  }
}

el.copy.addEventListener('click', async () => {
  if (!state.requestText) return;
  el.copy.disabled = true;
  el.copyStatus.textContent = '';
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('unavailable');
    await navigator.clipboard.writeText(state.requestText);
    el.copyStatus.textContent = '依頼文をクリップボードにコピーしました。';
  } catch {
    el.requestText.focus();
    el.requestText.setSelectionRange(0, el.requestText.value.length);
    el.copyStatus.textContent = '自動ではコピーできませんでした。上の欄の依頼文を選択したので、Ctrl+C（スマホでは長押しして「コピー」）でコピーしてください。';
  } finally {
    el.copy.disabled = !state.requestText;
  }
});

el.requestRetry.addEventListener('click', loadRequest);

/* ---------- controls ---------- */

for (const chip of el.chips) {
  chip.addEventListener('click', () => {
    state.participant = chip.dataset.participant;
    applyFilters();
  });
}

el.query.addEventListener('input', () => {
  state.query = el.query.value;
  applyFilters();
});
el.query.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') event.preventDefault();
});

el.reset.addEventListener('click', () => {
  state.participant = 'all';
  state.query = '';
  el.query.value = '';
  applyFilters({ keepSelection: false });
});

el.list.addEventListener('click', (event) => {
  const btn = event.target.closest('.finding-btn');
  if (btn) selectFinding(btn.dataset.findingId, { fromList: true });
});

el.retry.addEventListener('click', () => {
  if (state.controller) return; // already loading
  load();
});

load();
loadRequest();
{
  const lineId = lineIdFromHash(location.hash);
  if (lineId) revealLine(lineId);
}
