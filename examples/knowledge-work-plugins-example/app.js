// 発言を束ねても、違いは残す — saved Synthesize Research output drawn as one affinity map.
// Copyright (c) 2026 Studio Yebisu. MIT License.
// Reads only the four files pinned in data-manifest.json. No model is called from this page.

const SKILL_URL = 'https://github.com/anthropics/knowledge-work-plugins/blob/f652327d4e953d7957d99e735c3c7f9964e9d2e5/product-management/skills/synthesize-research/SKILL.md';
const SOURCE_PIN = 'anthropics/knowledge-work-plugins f652327d4e953d7957d99e735c3c7f9964e9d2e5（product-management v1.2.0・Apache-2.0）';
const COMMIT = 'f652327d4e953d7957d99e735c3c7f9964e9d2e5';
const MANIFEST_URL = 'data-manifest.json';
const MANIFEST_SHA256 = '0bbbb67b9d6fa12c0a6c5c618fb8b3370b704b31bc9554dc99d6791ccaa37674';
const DATA_PATHS = ['input/interviews.json', 'outputs/synthesis.json', 'samples.json', 'request.txt'];
const SAMPLE_IDS = ['apply-skill', 'participant', 'and-search', 'zero', 'origin', 'exports', 'retry'];
const FINDING_IDS = ['F01', 'F02', 'F03', 'F04', 'F05'];
const FREQUENCIES = [3, 3, 3, 3, 1];
const CONFIDENCES = ['medium', 'medium', 'low', 'medium', 'low'];
const LINE_HASH = /^#line-(P\d{2}-L\d{2})$/;
const FINDING_HASH = /^#(F0[1-5])$/;
const DEFAULT_FINDING = 'F05';

const KIND_LABEL = {
  reported_behavior: '自己申告の行動',
  stated_preference: '希望',
  positive_signal: '良い点（自己申告）',
  uncertainty: '未定',
};
const CONFIDENCE_LABEL = { high: '高', medium: '中', low: '低' };

// Short names drawn on the map. They label saved items; exact quotes stay in the reader and folds.
const PARTICIPANT_SHORT = { P01: '月に数回・個人', P02: '週に数回・チーム', P03: '初めて・個人' };
const OBS_LABEL = {
  O01: '再送した', O02: '一日ずつ確認', O03: '控えはメール', O04: '大きい写真', O05: '変更可否を知りたい',
  O06: '番号を探し直す', O07: '取消料に後で気づく', O08: '当日はSMS', O09: '今の方法で困らない', O10: '前回の道具名',
  O11: '店に確認した', O12: '月の空きを見たい', O13: '予約せず閉じた', O14: '写真で大きさ', O15: 'まだ未定',
};
const FINDING_LABEL = { F01: '完了と控え', F02: '送信前の条件', F03: '用途ごとの通知', F04: '良い点を残す', F05: '月表示は1人の希望' };
const REC_LINES = {
  R01: ['確定の見出しと番号', 'を出す試作'],
  R02: ['送信前に条件を', '2行で示す試作'],
  R03: ['控えと当日の変更を', '別々に選ぶ紙試作'],
  R04: ['写真と前回の名前', 'を今のまま残す'],
  R05: ['月表示を作る前に', '今の探し方を観察'],
};
// How each saved cluster is arranged. Checked against synthesis.json before drawing.
const TEMPLATE = {
  F01: { kind: 'split', groups: [['O01', 'O11'], ['O06']], notes: () => ['完了が見えない', '完了後に番号'] },
  F02: { kind: 'tags', order: ['O05', 'O07', 'O13'], notes: ['変更可否', '取消料', '取消期限'] },
  F03: { kind: 'routes', routes: [
    { o: 'O03', channel: 'メール', purpose: '控え' },
    { o: 'O08', channel: 'SMS', purpose: '当日の変更' },
    { o: 'O15', channel: '未定', purpose: 'まだ選ばない' },
  ] },
  F04: { kind: 'split', positive: true, groups: [['O04', 'O14'], ['O10']], notes: (g) => [`写真 ${g[0].length}人`, `前回名 ${g[1].length}人`] },
  F05: { kind: 'lanes', support: ['O12'], contrary: ['P02-L04'], neutral: ['O02'] },
};
const templateObs = (fid) => {
  const t = TEMPLATE[fid];
  if (t.kind === 'split') return t.groups.flat();
  if (t.kind === 'tags') return t.order;
  if (t.kind === 'routes') return t.routes.map((r) => r.o);
  return t.support;
};

/* ---------- map geometry (viewBox units; slips stay ≥44px on a 320px phone) ---------- */

const SW = 48;
const SH = 46;
const box = (x, y, w, h) => ({ x, y, w, h });
const LAYOUTS = {
  tall: {
    w: 360, h: 480, flow: 'down',
    notebooks: { P01: box(4, 4, 112, 52), P02: box(124, 4, 112, 52), P03: box(244, 4, 112, 52) },
    clusters: { F01: box(4, 68, 172, 90), F02: box(184, 68, 172, 90), F03: box(4, 168, 172, 112), F04: box(184, 168, 172, 112), F05: box(4, 290, 258, 104) },
    neutral: box(270, 290, 86, 104),
    finding: box(4, 408, 100, 66), proposal: box(118, 408, 150, 66), save: box(282, 408, 74, 66),
    chain: [[104, 441, 118, 441], [268, 441, 282, 441]],
    routes: {
      F01: [[176, 113], [180, 113], [180, 285], [266, 285], [266, 401], [54, 401], [54, 408]],
      F02: [[184, 113], [180, 113], [180, 285], [266, 285], [266, 401], [54, 401], [54, 408]],
      F03: [[176, 224], [180, 224], [180, 285], [266, 285], [266, 401], [54, 401], [54, 408]],
      F04: [[184, 224], [180, 224], [180, 285], [266, 285], [266, 401], [54, 401], [54, 408]],
      F05: [[54, 394], [54, 408]],
    },
  },
  wide: {
    w: 760, h: 372, flow: 'right',
    notebooks: { P01: box(6, 20, 112, 80), P02: box(6, 150, 112, 80), P03: box(6, 280, 112, 80) },
    clusters: { F01: box(136, 6, 214, 90), F02: box(360, 6, 214, 90), F03: box(136, 106, 214, 112), F04: box(360, 106, 214, 112), F05: box(136, 228, 300, 104) },
    neutral: box(446, 228, 128, 104),
    finding: box(600, 40, 154, 70), proposal: box(600, 140, 154, 110), save: box(600, 280, 154, 60),
    chain: [[677, 110, 677, 140], [677, 250, 677, 280]],
    routes: {
      F01: [[350, 51], [355, 51], [355, 101], [587, 101], [587, 75], [600, 75]],
      F02: [[574, 51], [587, 51], [587, 75], [600, 75]],
      F03: [[350, 162], [355, 162], [355, 223], [587, 223], [587, 75], [600, 75]],
      F04: [[574, 162], [587, 162], [587, 75], [600, 75]],
      F05: [[286, 228], [286, 223], [587, 223], [587, 75], [600, 75]],
    },
  },
};
// The wide composition is used only where its slips still render at 44px or more.
const WIDE_QUERY = window.matchMedia('(min-width: 48rem)');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const $ = (id) => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';
const el = {
  root: document.documentElement,
  loadStatus: $('load-status'),
  retry: $('retry'),
  map: $('map'),
  mapDesc: $('map-desc'),
  choices: Array.from(document.querySelectorAll('.choice[data-finding]')),
  chips: Array.from(document.querySelectorAll('.chip[data-participant]')),
  query: $('query'),
  reset: $('reset'),
  count: $('match-count'),
  evidence: $('evidence'),
  evidenceSummary: $('evidence-summary'),
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
  reader: $('slip-reader'),
  rTitle: $('reader-title'),
  rWho: $('reader-who'),
  rKind: $('reader-kind'),
  rQuote: $('reader-quote'),
  rUse: $('reader-use'),
  rCode: $('reader-code'),
  rInterp: $('reader-interp'),
  rLink: $('reader-link'),
  rClose: $('reader-close'),
  notesStatus: $('notes-status'),
  noteList: $('note-list'),
  openQuestions: $('open-questions'),
  limits: $('limits'),
  unknownsStatus: $('unknowns-status'),
  question: $('research-question'),
  sampleList: $('sample-list'),
  requestText: $('request-text'),
  requestStatus: $('request-status'),
  copy: $('copy-request'),
  copyStatus: $('copy-status'),
};

const state = {
  data: null, // { interviews, synthesis, samples, request, lines, participants, observations, findings, recsByFinding }
  participant: 'all',
  query: '',
  selectedId: null,
  chosenId: null, // the finding the reader asked for; restored when filters allow it again
  renderedId: null,
  visible: [],
  controller: null,
  layout: null,
  map: null,
  slipId: null,
};

class DataError extends Error {}
const fail = (message) => { throw new DataError(message); };

/* ---------- loading: pinned bytes first, then meaning ---------- */

async function getBytes(url, signal) {
  let res;
  try {
    res = await fetch(url, { signal, cache: 'no-store', credentials: 'same-origin' });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    const hint = location.protocol === 'file:'
      ? 'ファイルを直接開くと読み込めません。README.md の手順で、手元のHTTPサーバーから開いてください。'
      : '通信を確かめてから、もう一度読み込んでください。';
    fail(`${url} を読み込めませんでした。${hint}`);
  }
  if (!res.ok) fail(`${url} を読み込めませんでした（HTTP ${res.status}）。`);
  try {
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    fail(`${url} を最後まで読み込めませんでした。`);
  }
}

async function sha256(bytes) {
  if (!globalThis.crypto || !crypto.subtle) {
    fail('このブラウザーでは保存済みファイルのSHA-256を照合できません。HTTPS か localhost で開いてください。');
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
function decode(url, bytes) {
  try { return utf8.decode(bytes); } catch { fail(`${url} をUTF-8として読めませんでした。`); }
}
function parseJSON(url, text) {
  try { return JSON.parse(text); } catch { fail(`${url} をJSONとして読めませんでした。`); }
}

async function loadBundle(signal) {
  const manifestBytes = await getBytes(MANIFEST_URL, signal);
  if (await sha256(manifestBytes) !== MANIFEST_SHA256) fail(`${MANIFEST_URL} が固定した版と違います（SHA-256 が一致しません）。`);
  const manifest = parseJSON(MANIFEST_URL, decode(MANIFEST_URL, manifestBytes));
  if (!manifest || manifest.format !== 'studio-yebisu-knowledge-visual-data-v1' || manifest.commit !== COMMIT
    || !Array.isArray(manifest.files) || manifest.files.length !== DATA_PATHS.length) {
    fail(`${MANIFEST_URL} の形が想定と違います。`);
  }
  manifest.files.forEach((entry, i) => {
    if (!entry || entry.path !== DATA_PATHS[i] || !Number.isInteger(entry.bytes) || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
      fail(`${MANIFEST_URL} の${i + 1}件目が、決めたファイル ${DATA_PATHS[i]} ではありません。`);
    }
  });
  const texts = await Promise.all(manifest.files.map(async (entry) => {
    const bytes = await getBytes(entry.path, signal);
    if (bytes.length !== entry.bytes) fail(`${entry.path} が固定した版と違います（${bytes.length}バイト／固定 ${entry.bytes}バイト）。`);
    if (await sha256(bytes) !== entry.sha256) fail(`${entry.path} が固定した版と違います（SHA-256 が一致しません）。`);
    return decode(entry.path, bytes);
  }));
  return {
    interviews: parseJSON(DATA_PATHS[0], texts[0]),
    synthesis: parseJSON(DATA_PATHS[1], texts[1]),
    samples: parseJSON(DATA_PATHS[2], texts[2]),
    request: texts[3],
  };
}

function must(cond, message) {
  if (!cond) fail(`保存済みデータの形が想定と違います：${message}`);
}
const isStr = (v) => typeof v === 'string' && v.length > 0;
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validate({ interviews, synthesis, samples, request }) {
  // Same checks as comparison.js, then the facts this map draws.
  must(interviews && interviews.fictional === true, 'interviews.json が架空の資料として記録されていません');
  must(Array.isArray(interviews.participants) && interviews.participants.length > 0, '参加者がありません');
  const lines = new Map();
  const participants = new Map();
  for (const p of interviews.participants) {
    must(isStr(p.id) && isStr(p.segment) && Array.isArray(p.lines), '参加者の項目が足りません');
    must(!participants.has(p.id), `参加者 ${p.id} が重複しています`);
    participants.set(p.id, p);
    for (const line of p.lines) {
      must(isStr(line.id) && isStr(line.text), `${p.id} の行の項目が足りません`);
      must(!lines.has(line.id), `行ID ${line.id} が重複しています`);
      lines.set(line.id, { ...line, participant: p.id });
    }
  }
  must(sameList([...participants.keys()], ['P01', 'P02', 'P03']), '架空の参加者が P01・P02・P03 の3人ではありません');
  for (const p of interviews.participants) {
    must(p.method === 'fictional_interview_self_report', `${p.id} が架空の自己申告として記録されていません`);
    must(sameList(p.lines.map((l) => l.id), [1, 2, 3, 4, 5].map((n) => `${p.id}-L0${n}`)), `${p.id} の行が5行ではありません`);
    must(hasOwn(PARTICIPANT_SHORT, p.id), `${p.id} の短い名前がありません`);
  }
  must(lines.size === 15, '原文が15行ではありません');

  must(synthesis && synthesis.meta && synthesis.meta.fictional === true, 'synthesis.json の meta.fictional が true ではありません');
  must(synthesis.meta.participant_count === participants.size, '参加者の人数が原文と合いません');
  must(isStr(synthesis.meta.research_question), '問いがありません');
  must(Array.isArray(synthesis.observations), 'observations がありません');
  const observations = new Map();
  const usedLines = new Set();
  for (const o of synthesis.observations) {
    must(isStr(o.id) && isStr(o.line_id) && isStr(o.source_id), '観察の項目が足りません');
    must(!observations.has(o.id), `観察 ${o.id} が重複しています`);
    const line = lines.get(o.line_id);
    must(line, `観察 ${o.id} の行 ${o.line_id} が原文にありません`);
    must(!usedLines.has(o.line_id), `行 ${o.line_id} の観察が重複しています`);
    usedLines.add(o.line_id);
    must(line.participant === o.source_id, `観察 ${o.id} の参加者が原文と合いません`);
    must(o.quote === line.text, `観察 ${o.id} の引用が原文 ${o.line_id} と一致しません`);
    must(hasOwn(KIND_LABEL, o.kind), `観察 ${o.id} の種類が不明です`);
    must(isStr(o.code) && isStr(o.interpretation), `観察 ${o.id} のコードか解釈がありません`);
    must(hasOwn(OBS_LABEL, o.id), `観察 ${o.id} の短い名前がありません`);
    observations.set(o.id, o);
  }
  must(observations.size === 15 && usedLines.size === 15, '観察が15行と1対1になっていません');

  must(Array.isArray(synthesis.findings), 'findings がありません');
  must(sameList(synthesis.findings.map((f) => f.id), FINDING_IDS), '発見が F01〜F05 の5件ではありません');
  const supportedObs = new Set();
  const contraryLines = new Set();
  synthesis.findings.forEach((f, index) => {
    must(isStr(f.id) && isStr(f.title) && isStr(f.summary), '発見の項目が足りません');
    must(isStr(f.impact) && isStr(f.confidence_reason) && isStr(f.next_step), `発見 ${f.id} の影響・理由・次の一歩が足りません`);
    must(Array.isArray(f.observation_ids) && f.observation_ids.length > 0, `発見 ${f.id} に根拠がありません`);
    must(new Set(f.observation_ids).size === f.observation_ids.length, `発見 ${f.id} の根拠が重複しています`);
    const support = new Set();
    for (const oid of f.observation_ids) {
      const o = observations.get(oid);
      must(o, `発見 ${f.id} の観察 ${oid} がありません`);
      support.add(o.source_id);
      supportedObs.add(oid);
    }
    must(Array.isArray(f.participant_ids)
      && f.participant_ids.length === support.size
      && f.participant_ids.every((id) => support.has(id)), `発見 ${f.id} の参加者が根拠と合いません`);
    must(f.frequency === support.size && f.frequency === FREQUENCIES[index], `発見 ${f.id} の人数が根拠と合いません`);
    must(hasOwn(CONFIDENCE_LABEL, f.confidence) && f.confidence === CONFIDENCES[index], `発見 ${f.id} の確からしさが保存時と違います`);
    must(Array.isArray(f.contradictions), `発見 ${f.id} の反する発言の欄がありません`);
    for (const c of f.contradictions) {
      must(lines.has(c.line_id) && isStr(c.note), `発見 ${f.id} の反する発言 ${c.line_id} が原文にありません`);
      must(!support.has(lines.get(c.line_id).participant), `発見 ${f.id} の反する発言が支持の参加者と重なっています`);
      contraryLines.add(c.line_id);
    }
    const tpl = TEMPLATE[f.id];
    must(sameList([...templateObs(f.id)].sort(), [...f.observation_ids].sort()), `発見 ${f.id} の根拠が図の配置と合いません`);
    must(sameList(f.contradictions.map((c) => c.line_id), tpl.kind === 'lanes' ? tpl.contrary : []), `発見 ${f.id} の反する発言が保存時と違います`);
  });
  for (const oid of TEMPLATE.F05.neutral) {
    const o = observations.get(oid);
    must(o && !supportedObs.has(oid) && !contraryLines.has(o.line_id), `${oid} はどの発見の支持にも反証にも数えない発言のはずです`);
  }
  must(supportedObs.size + TEMPLATE.F05.neutral.length + contraryLines.size === 15, '15枚の発言の置き場所が保存時と合いません');

  const findingIds = new Set(FINDING_IDS);
  must(Array.isArray(synthesis.recommendations), 'recommendations がありません');
  must(sameList(synthesis.recommendations.map((r) => r.id), ['R01', 'R02', 'R03', 'R04', 'R05']), '提案が R01〜R05 の5件ではありません');
  const recsByFinding = new Map();
  for (const r of synthesis.recommendations) {
    must(isStr(r.id) && Array.isArray(r.finding_ids) && r.finding_ids.length > 0, '提案の項目が足りません');
    must(isStr(r.priority) && isStr(r.action) && isStr(r.validation) && isStr(r.feasibility_note), `提案 ${r.id} の項目が足りません`);
    must(hasOwn(REC_LINES, r.id), `提案 ${r.id} の短い名前がありません`);
    for (const fid of r.finding_ids) {
      must(findingIds.has(fid), `提案 ${r.id} が存在しない発見 ${fid} を指しています`);
      if (!recsByFinding.has(fid)) recsByFinding.set(fid, []);
      recsByFinding.get(fid).push(r);
    }
  }
  for (const fid of FINDING_IDS) must((recsByFinding.get(fid) || []).length === 1, `発見 ${fid} の次の提案が1件ではありません`);
  must(Array.isArray(synthesis.open_questions) && synthesis.open_questions.every(isStr)
    && Array.isArray(synthesis.limits) && synthesis.limits.every(isStr), '未解決の問いか限界の欄がありません');

  must(samples && samples.format === 'input-output' && Array.isArray(samples.samples), 'samples.json の形式が input-output ではありません');
  must(sameList(samples.samples.map((s) => s && s.id), SAMPLE_IDS), 'samples.json の操作例が保存時の7件ではありません');
  for (const s of samples.samples) {
    must(isStr(s.label) && isStr(s.input) && isPlainObject(s.output), `操作例 ${s.id} の入力か出力がありません`);
  }
  const applied = samples.samples[0].output;
  must(applied.observations === 15 && applied.source === 'outputs/synthesis.json'
    && JSON.stringify(applied.findings) === JSON.stringify(synthesis.findings), '操作例 apply-skill の出力が synthesis.json の発見と一致しません');
  const exported = samples.samples.find((s) => s.id === 'exports').output;
  must(exported.selected_finding === 'F05' && exported.support_frequency === 1
    && exported.support_line === 'P03-L02' && exported.contradictory_line === 'P02-L04', '操作例 exports が F05 の根拠と合いません');

  must(isStr(request) && request.trim().length > 0 && request.includes(SKILL_URL), 'request.txt が固定版 SKILL.md を指していません');

  const findings = synthesis.findings.map((f, index) => ({ ...f, rank: index + 1, haystack: buildHaystack(f, observations, lines) }));
  return { interviews, synthesis, samples, request, lines, participants, observations, findings, recsByFinding };
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

function wantedFinding() {
  const m = FINDING_HASH.exec(location.hash);
  return m ? m[1] : (state.chosenId || DEFAULT_FINDING);
}

async function load() {
  if (state.controller) state.controller.abort();
  const controller = new AbortController();
  state.controller = controller;
  const want = wantedFinding();
  state.data = null;
  state.visible = [];
  state.selectedId = null;
  clearView();
  setState('loading');
  el.loadStatus.textContent = '固定した4つのファイルを照合しています…';
  el.retry.disabled = true;

  try {
    const bundle = await loadBundle(controller.signal);
    if (controller !== state.controller) return;
    state.data = validate(bundle);
    state.chosenId = want;
    renderNotes();
    renderUnknowns();
    renderScope();
    renderRequest();
    setState('ready');
    el.loadStatus.textContent = `照合済み：架空メモ${state.data.lines.size}行・発見${state.data.findings.length}件（保存済みの整理）`;
    el.retry.hidden = true;
    state.layout = WIDE_QUERY.matches ? 'wide' : 'tall';
    buildMap();
    applyFilters();
    const lineId = lineIdFromHash(location.hash);
    if (lineId) revealLine(lineId);
  } catch (err) {
    if (err.name === 'AbortError' || controller !== state.controller) return;
    state.data = null;
    state.visible = [];
    state.selectedId = null;
    clearView();
    setState('error');
    el.loadStatus.textContent = err instanceof DataError
      ? `${err.message} 図・表示・保存・コピーは止めています。`
      : '読み込みの途中で問題が起きました。図・表示・保存・コピーは止めています。';
    el.retry.hidden = false;
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
  for (const btn of el.choices) btn.disabled = !ready;
  el.query.disabled = !ready;
  el.reset.disabled = !ready;
  el.saveJson.disabled = !ready;
  el.copy.disabled = !ready;
  if (!ready) el.saveMd.disabled = true;
}

function clearView() {
  el.map.replaceChildren();
  el.map.removeAttribute('viewBox');
  el.map.dataset.selected = '';
  state.map = null;
  state.slipId = null;
  el.mapDesc.textContent = '';
  el.count.textContent = '—';
  for (const btn of el.choices) {
    btn.setAttribute('aria-pressed', 'false');
    btn.removeAttribute('aria-label');
  }
  clearDetail('読み込めていないため、発見を表示できません。');
  el.evidenceSummary.textContent = '根拠と全文を読む';
  el.saveMd.disabled = true;
  el.saveMd.textContent = '選んだ発見をMarkdownで保存';
  el.saveStatus.textContent = '';
  state.renderedId = null;
  el.reader.hidden = true;
  el.noteList.replaceChildren();
  el.notesStatus.hidden = false;
  el.notesStatus.textContent = '照合が終わると、input/interviews.json の15行をここに表示します。';
  el.openQuestions.replaceChildren();
  el.limits.replaceChildren();
  el.unknownsStatus.hidden = false;
  el.question.textContent = '（照合後に表示）';
  el.sampleList.replaceChildren();
  el.requestText.value = '';
  el.requestStatus.hidden = false;
  el.requestStatus.textContent = '照合が終わると request.txt を表示します。';
  el.copyStatus.textContent = '';
}

/* ---------- filter & selection ---------- */

function tokens(query) {
  return fold(query).split(/\s+/).filter(Boolean);
}

function applyFilters() {
  if (!state.data) return;
  const words = tokens(state.query);
  const all = state.data.findings;
  state.visible = all.filter((f) =>
    (state.participant === 'all' || f.participant_ids.includes(state.participant))
    && words.every((w) => f.haystack.includes(w)));

  const want = state.chosenId;
  if (want && state.visible.some((f) => f.id === want)) state.selectedId = want;
  else state.selectedId = state.visible.length ? state.visible[0].id : null;
  if (!state.selectedId) state.slipId = null; // zero results: nothing stays selected on the map

  const conditions = [];
  if (state.participant !== 'all') conditions.push(`${state.participant}が支持`);
  if (words.length) conditions.push(`「${state.query.trim()}」を含む`);
  el.count.textContent = `${all.length}件中${state.visible.length}件を表示${conditions.length ? `（${conditions.join('・')}）` : ''}`;

  for (const chip of el.chips) chip.setAttribute('aria-pressed', String(chip.dataset.participant === state.participant));
  renderAll();
}

function selectFinding(id) {
  if (!state.data || !state.visible.some((f) => f.id === id)) return;
  state.chosenId = id;
  state.selectedId = id;
  renderAll();
  if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
}

function current() {
  return state.data && state.selectedId ? state.data.findings.find((f) => f.id === state.selectedId) : null;
}

function renderAll() {
  renderChoices();
  renderDetail();
  paintMap();
  renderReader();
}

function renderChoices() {
  const total = state.data ? state.data.participants.size : 0;
  for (const btn of el.choices) {
    const f = state.data && state.data.findings.find((x) => x.id === btn.dataset.finding);
    const visible = !!f && state.visible.some((x) => x.id === f.id);
    btn.disabled = !visible;
    btn.setAttribute('aria-pressed', String(!!f && f.id === state.selectedId));
    if (f) btn.setAttribute('aria-label', `${f.id} ${f.title}（支持 ${f.frequency}/${total}人・確からしさ ${CONFIDENCE_LABEL[f.confidence]}）${visible ? '' : '・絞り込みの対象外'}`);
  }
}

/* ---------- detail (same reading as comparison.js) ---------- */

function clearDetail(message) {
  el.dEyebrow.textContent = '';
  el.dTitle.textContent = message;
  el.dBody.hidden = true;
  for (const node of [el.dFrequency, el.dConfidence, el.dImpact, el.dSummary, el.dReason, el.dNext]) node.textContent = '';
  el.dEvidence.replaceChildren();
  el.dContra.replaceChildren();
  el.dRecs.replaceChildren();
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
    el.evidenceSummary.textContent = '根拠と全文を読む';
    el.saveMd.disabled = true;
    el.saveMd.textContent = '選んだ発見をMarkdownで保存';
    return;
  }
  const { participants, observations, lines, findings } = state.data;
  el.evidenceSummary.textContent = `根拠と全文を読む（${f.id}）`;
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
  el.saveMd.textContent = `${f.id}をMarkdownで保存`;
}

function evidenceItem({ lineId, participant, kind, quote, noteLabel, note }) {
  const li = document.createElement('li');
  li.className = 'ev';
  li.dataset.p = participant.id;

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

/* ---------- the map ---------- */

function svg(tag, attrs, parent, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  if (parent) parent.append(node);
  return node;
}

function bookAnchor(L, b, k) {
  return L.flow === 'down'
    ? { x: b.x + 18 + k * 19, y: b.y + b.h - 7 }
    : { x: b.x + b.w - 7, y: b.y + 14 + k * 13 };
}
function slipAnchor(L, p) {
  return L.flow === 'down' ? { x: p.x + SW / 2, y: p.y } : { x: p.x, y: p.y + SH / 2 };
}
function threadPath(L, a, b) {
  return L.flow === 'down'
    ? `M${a.x} ${a.y} C${a.x} ${a.y + 40} ${b.x} ${b.y - 40} ${b.x} ${b.y}`
    : `M${a.x} ${a.y} C${a.x + 50} ${a.y} ${b.x - 50} ${b.y} ${b.x} ${b.y}`;
}
const routeD = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

// Which cluster an observation is drawn in. The contrary slip sits in its finding's own lane; the neutral slip in none.
function homeCluster(oid) {
  for (const fid of FINDING_IDS) if (templateObs(fid).includes(oid)) return fid;
  const o = state.data && state.data.observations.get(oid);
  for (const fid of FINDING_IDS) if (o && (TEMPLATE[fid].contrary || []).includes(o.line_id)) return fid;
  return null;
}

function relationOf(f) {
  const rel = new Map();
  if (!f) return rel;
  const { observations } = state.data;
  for (const oid of f.observation_ids) rel.set(oid, 'support');
  for (const c of f.contradictions) {
    for (const o of observations.values()) if (o.line_id === c.line_id) rel.set(o.id, 'contrary');
  }
  for (const oid of TEMPLATE[f.id].neutral || []) rel.set(oid, 'neutral');
  return rel;
}

function membership(oid) {
  const { observations, findings } = state.data;
  const o = observations.get(oid);
  for (const f of findings) {
    if (f.observation_ids.includes(oid)) return `${f.id}の支持`;
    if (f.contradictions.some((c) => c.line_id === o.line_id)) return `${f.id}に反する発言・支持に数えない`;
  }
  return 'どの発見の支持にも反証にも数えない';
}

function buildMap() {
  const L = LAYOUTS[state.layout];
  const d = state.data;
  const total = d.participants.size;
  const root = el.map;
  root.replaceChildren();
  root.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
  root.dataset.layout = state.layout;

  const defs = svg('defs', {}, root);
  const hatch = svg('pattern', { id: 'map-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  svg('rect', { class: 'hatch-bg', width: 6, height: 6 }, hatch);
  svg('line', { class: 'hatch-line', x1: 0, y1: 0, x2: 0, y2: 6 }, hatch);
  const marker = svg('marker', { id: 'map-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
  svg('path', { class: 'arrow-head', d: 'M0 0 L10 5 L0 10 z' }, marker);

  const layer = (name) => svg('g', { class: `layer layer--${name}` }, root);
  const threadLayer = layer('threads');
  const glowLayer = layer('glow');
  const bookLayer = layer('books');
  const groupLayer = layer('groups');
  const wireLayer = layer('wire');
  const chainLayer = layer('chain');
  const slipLayer = layer('slips');

  const pos = new Map();
  const clusters = new Map();
  const place = (oid, x, y) => pos.set(oid, { x, y });
  const note = (g, text, x, y) => svg('text', { class: 'note-text', x, y, 'text-anchor': 'middle' }, g, text);
  const obsByLine = new Map([...d.observations.values()].map((o) => [o.line_id, o.id]));

  for (const f of d.findings) {
    const b = L.clusters[f.id];
    const tpl = TEMPLATE[f.id];
    const g = svg('g', { class: `cluster cluster--${tpl.kind}${tpl.positive ? ' cluster--positive' : ''}`, 'data-finding': f.id }, groupLayer);
    svg('title', {}, g, `${f.id} ${f.title}`);
    svg('rect', { class: 'cluster-mark', x: b.x - 3, y: b.y - 3, width: b.w + 6, height: b.h + 6, rx: 12 }, g);
    svg('rect', { class: 'cluster-box', x: b.x, y: b.y, width: b.w, height: b.h, rx: 9 }, g);
    const title = svg('text', { class: 'cluster-title', x: b.x + 8, y: b.y + 15 }, g);
    svg('tspan', { class: 'cluster-id' }, title, f.id);
    svg('tspan', { dx: 4 }, title, FINDING_LABEL[f.id]);
    svg('text', { class: 'cluster-meta', x: b.x + b.w - 8, y: b.y + 15, 'text-anchor': 'end' }, g,
      `${f.frequency}/${total}・${CONFIDENCE_LABEL[f.confidence]}`);
    const top = b.y + 24;

    if (tpl.kind === 'split') {
      const pad = (b.w - (3 * SW + 6 + 10)) / 2;
      const x1 = b.x + pad;
      const x2 = x1 + SW + 6;
      const x3 = x2 + SW + 10;
      place(tpl.groups[0][0], x1, top);
      place(tpl.groups[0][1], x2, top);
      place(tpl.groups[1][0], x3, top);
      svg('line', { class: 'divider', x1: x2 + SW + 5, y1: top + 2, x2: x2 + SW + 5, y2: top + SH + 12 }, g);
      const notes = tpl.notes(tpl.groups);
      note(g, notes[0], (x1 + x2 + SW) / 2, top + SH + 12);
      note(g, notes[1], x3 + SW / 2, top + SH + 12);
      if (tpl.positive) {
        const cx = b.x + 112;
        svg('path', { class: 'keep-mark', d: `M${cx} ${b.y + 8} c-4 -7 -12 -3 -8 3 l8 7 l8 -7 c4 -6 -4 -10 -8 -3z` }, g);
      }
    } else {
      const gap = (b.w - 3 * SW) / 4;
      const xs = [0, 1, 2].map((i) => b.x + gap + i * (SW + gap));
      if (tpl.kind === 'tags') {
        tpl.order.forEach((oid, i) => { place(oid, xs[i], top); note(g, tpl.notes[i], xs[i] + SW / 2, top + SH + 12); });
      } else if (tpl.kind === 'routes') {
        tpl.routes.forEach((r, i) => {
          place(r.o, xs[i], top);
          const tw = SW + 6;
          const tx = xs[i] - 3;
          const ty = top + SH + 10;
          svg('line', { class: 'route', x1: xs[i] + SW / 2, y1: top + SH + 1, x2: xs[i] + SW / 2, y2: ty - 1, 'marker-end': 'url(#map-arrow)' }, g);
          svg('rect', { class: 'terminal', 'data-channel': r.channel, x: tx, y: ty, width: tw, height: 28, rx: 6 }, g);
          svg('text', { class: 'terminal-main', x: tx + tw / 2, y: ty + 12, 'text-anchor': 'middle' }, g, r.channel);
          svg('text', { class: 'terminal-sub', x: tx + tw / 2, y: ty + 24, 'text-anchor': 'middle' }, g, r.purpose);
        });
      } else {
        const laneW = (b.w - 18) / 2;
        const laneH = b.h - 30;
        const lanes = [
          { cls: 'lane--support', x: b.x + 6, ids: tpl.support, main: '支持', sub: `${f.frequency}/${total}人` },
          { cls: 'lane--contrary', x: b.x + 12 + laneW, ids: tpl.contrary.map((lineId) => obsByLine.get(lineId)), main: '反する', sub: '数えない' },
        ];
        for (const lane of lanes) {
          svg('rect', { class: `lane ${lane.cls}`, x: lane.x, y: top, width: laneW, height: laneH, rx: 7 }, g);
          place(lane.ids[0], lane.x + 8, top + (laneH - SH) / 2);
          svg('text', { class: 'lane-label', x: lane.x + SW + 16, y: top + laneH / 2 - 3 }, g, lane.main);
          svg('text', { class: 'lane-sub', x: lane.x + SW + 16, y: top + laneH / 2 + 12 }, g, lane.sub);
        }
      }
    }
    clusters.set(f.id, g);
  }

  const n = L.neutral;
  const neutral = svg('g', { class: 'neutral' }, groupLayer);
  svg('rect', { class: 'neutral-box', x: n.x, y: n.y, width: n.w, height: n.h, rx: 9 }, neutral);
  svg('text', { class: 'neutral-title', x: n.x + n.w / 2, y: n.y + 15, 'text-anchor': 'middle' }, neutral, '未分類');
  for (const oid of TEMPLATE.F05.neutral) place(oid, n.x + (n.w - SW) / 2, n.y + 24);
  svg('text', { class: 'note-text', x: n.x + n.w / 2, y: n.y + 24 + SH + 13, 'text-anchor': 'middle' }, neutral, 'どちらにも');
  svg('text', { class: 'note-text', x: n.x + n.w / 2, y: n.y + 24 + SH + 25, 'text-anchor': 'middle' }, neutral, '数えない');

  const books = new Map();
  const threads = new Map();
  for (const p of d.interviews.participants) {
    const b = L.notebooks[p.id];
    const g = svg('g', { class: 'book', 'data-p': p.id }, bookLayer);
    svg('title', {}, g, `${p.id}・${p.segment}（架空・自己申告 ${p.lines.length}行）`);
    svg('rect', { class: 'book-page', x: b.x + 3, y: b.y + 3, width: b.w, height: b.h, rx: 6 }, g);
    svg('rect', { class: 'book-cover', x: b.x, y: b.y, width: b.w, height: b.h, rx: 6 }, g);
    svg('rect', { class: 'book-spine', x: b.x, y: b.y, width: 9, height: b.h, rx: 3 }, g);
    svg('text', { class: 'book-id', x: b.x + 16, y: b.y + 20 }, g, p.id);
    svg('text', { class: 'book-count', x: b.x + b.w - (L.flow === 'down' ? 8 : 16), y: b.y + 20, 'text-anchor': 'end' }, g, `${p.lines.length}行`);
    svg('text', { class: 'book-seg', x: b.x + 16, y: b.y + 35 }, g, PARTICIPANT_SHORT[p.id]);
    p.lines.forEach((line, k) => {
      const a = bookAnchor(L, b, k);
      svg('circle', { class: 'book-tick', cx: a.x, cy: a.y, r: 2.4 }, g);
      const oid = obsByLine.get(line.id);
      const dPath = threadPath(L, a, slipAnchor(L, pos.get(oid)));
      threads.set(oid, dPath);
      svg('path', { class: 'thread', 'data-p': p.id, d: dPath }, threadLayer);
    });
    books.set(p.id, g);
  }

  const slips = new Map();
  for (const o of d.observations.values()) {
    const at = pos.get(o.id);
    const g = svg('g', {
      class: 'slip', 'data-obs': o.id, 'data-p': o.source_id, tabindex: 0, role: 'button', 'aria-pressed': 'false',
      'aria-label': `${o.line_id} ${OBS_LABEL[o.id]}（${membership(o.id)}）。原文を読む`,
      transform: `translate(${at.x} ${at.y})`,
    }, slipLayer);
    svg('rect', { class: 'slip-hit', x: -4, y: -5, width: SW + 8, height: SH + 10, rx: 8 }, g);
    svg('rect', { class: 'slip-card', x: 0, y: 0, width: SW, height: SH, rx: 5 }, g);
    svg('path', { class: 'slip-band', d: `M0 5 a5 5 0 0 1 5 -5 h${SW - 10} a5 5 0 0 1 5 5 v4 h-${SW} z` }, g);
    svg('text', { class: 'slip-p', x: SW / 2, y: 24, 'text-anchor': 'middle' }, g, o.source_id);
    svg('text', { class: 'slip-l', x: SW / 2, y: 38, 'text-anchor': 'middle' }, g, o.line_id.slice(4));
    svg('rect', { class: 'slip-ring', x: -2.5, y: -2.5, width: SW + 5, height: SH + 5, rx: 7 }, g);
    slips.set(o.id, g);
  }

  for (const [x1, y1, x2, y2] of L.chain) {
    const across = L.flow === 'down';
    svg('line', { class: 'chain-arrow', x1, y1, x2: across ? x2 - 1 : x2, y2: across ? y2 : y2 - 1, 'marker-end': 'url(#map-arrow)' }, chainLayer);
  }
  const chainGroup = svg('g', { class: 'chain' }, chainLayer);
  const fb = L.finding;
  svg('rect', { class: 'chain-box', x: fb.x, y: fb.y, width: fb.w, height: fb.h, rx: 9 }, chainGroup);
  const f1 = svg('text', { class: 'chain-main', x: fb.x + fb.w / 2, y: fb.y + 20, 'text-anchor': 'middle' }, chainGroup);
  const f2 = svg('text', { class: 'chain-sub', x: fb.x + fb.w / 2, y: fb.y + 38, 'text-anchor': 'middle' }, chainGroup);
  const f3 = svg('text', { class: 'chain-sub', x: fb.x + fb.w / 2, y: fb.y + 54, 'text-anchor': 'middle' }, chainGroup);

  const pb = L.proposal;
  const ear = 12;
  svg('path', { class: 'sheet', d: `M${pb.x} ${pb.y} h${pb.w - ear} l${ear} ${ear} v${pb.h - ear} h-${pb.w} z` }, chainGroup);
  svg('path', { class: 'sheet-fold', d: `M${pb.x + pb.w - ear} ${pb.y} v${ear} h${ear}` }, chainGroup);
  const lh = L.flow === 'down' ? 15 : 19;
  const p1 = svg('text', { class: 'sheet-main', x: pb.x + 9, y: pb.y + 18 }, chainGroup);
  const p2 = svg('text', { class: 'sheet-line', x: pb.x + 9, y: pb.y + 18 + lh + 2 }, chainGroup);
  const p3 = svg('text', { class: 'sheet-line', x: pb.x + 9, y: pb.y + 18 + 2 * lh + 2 }, chainGroup);
  const stamp = svg('text', { class: 'stamp', x: pb.x + pb.w - 8, y: pb.y + pb.h - 7, 'text-anchor': 'end' }, chainGroup);

  const sb = L.save;
  svg('rect', { class: 'chain-box chain-box--save', x: sb.x, y: sb.y, width: sb.w, height: sb.h, rx: 9 }, chainGroup);
  const ix = L.flow === 'down' ? sb.x + sb.w / 2 - 9 : sb.x + 14;
  const iy = L.flow === 'down' ? sb.y + 8 : sb.y + 16;
  svg('path', { class: 'doc', d: `M${ix} ${iy} h12 l6 6 v18 h-18 z` }, chainGroup);
  svg('path', { class: 'doc-arrow', d: `M${ix + 9} ${iy + 9} v9 m-4 -4 l4 4 l4 -4` }, chainGroup);
  const sx = L.flow === 'down' ? sb.x + sb.w / 2 : sb.x + 42;
  const anchor = L.flow === 'down' ? 'middle' : 'start';
  const s1 = svg('text', { class: 'chain-main chain-main--small', x: sx, y: L.flow === 'down' ? sb.y + 46 : sb.y + 27, 'text-anchor': anchor }, chainGroup);
  const s2 = svg('text', { class: 'chain-sub', x: sx, y: L.flow === 'down' ? sb.y + 59 : sb.y + 44, 'text-anchor': anchor }, chainGroup);

  const go = (event) => {
    const g = event.target.closest('.cluster');
    if (g && !event.target.closest('.slip')) selectFinding(g.dataset.finding);
  };
  groupLayer.addEventListener('click', go);

  state.map = { L, clusters, neutral, books, slips, threads, wireLayer, glowLayer, chainGroup, text: { f1, f2, f3, p1, p2, p3, stamp, s1, s2 } };
}

function paintMap() {
  const refs = state.map;
  if (!refs || !state.data) return;
  const d = state.data;
  const f = current();
  const total = d.participants.size;
  const visibleIds = new Set(state.visible.map((x) => x.id));
  const rel = relationOf(f);
  el.map.dataset.selected = f ? f.id : '';

  for (const [fid, node] of refs.clusters) {
    node.classList.toggle('is-selected', !!f && f.id === fid);
    node.classList.toggle('is-out', !visibleIds.has(fid));
    node.classList.toggle('is-dim', !!f && f.id !== fid && visibleIds.has(fid));
  }
  const neutralRelated = !!f && (TEMPLATE[f.id].neutral || []).length > 0;
  refs.neutral.classList.toggle('is-related', neutralRelated);
  refs.neutral.classList.toggle('is-dim', !neutralRelated);

  for (const [oid, node] of refs.slips) {
    const r = rel.get(oid) || '';
    const home = homeCluster(oid);
    node.dataset.rel = r;
    node.classList.toggle('is-out', !r && (home ? !visibleIds.has(home) : !f));
    node.classList.toggle('is-dim', !!f && !r);
    const picked = state.slipId === oid;
    node.classList.toggle('is-picked', picked);
    node.setAttribute('aria-pressed', String(picked));
  }
  for (const [pid, node] of refs.books) node.classList.toggle('is-support', !!f && f.participant_ids.includes(pid));

  refs.glowLayer.replaceChildren();
  for (const [oid, r] of rel) {
    svg('path', { class: `glow glow--${r}`, 'data-p': d.observations.get(oid).source_id, d: refs.threads.get(oid) }, refs.glowLayer);
  }
  refs.wireLayer.replaceChildren();
  if (f) svg('path', { class: 'wire', d: routeD(refs.L.routes[f.id]), pathLength: 1, 'marker-end': 'url(#map-arrow)' }, refs.wireLayer);

  const rec = f ? d.recsByFinding.get(f.id)[0] : null;
  const t = refs.text;
  refs.chainGroup.classList.toggle('is-empty', !f);
  t.f1.textContent = f ? f.id : '—';
  t.f2.textContent = f ? `支持 ${f.frequency}/${total}人` : '該当なし';
  t.f3.textContent = f ? `確からしさ ${CONFIDENCE_LABEL[f.confidence]}` : '';
  t.p1.textContent = rec ? `${rec.id} ${rec.priority}` : '次の一歩';
  t.p2.textContent = rec ? REC_LINES[rec.id][0] : '選んだ発見なし';
  t.p3.textContent = rec ? REC_LINES[rec.id][1] : '';
  t.stamp.textContent = rec ? '未実施' : '';
  t.s1.textContent = f ? 'Markdown' : '保存なし';
  t.s2.textContent = f ? (refs.L.flow === 'down' ? `${f.id}を1件` : `synthesis-${f.id}.md`) : '';

  el.mapDesc.textContent = describe(f, rec);
}

function describe(f, rec) {
  if (!state.data) return '';
  const d = state.data;
  if (!f) return '条件に合う発見がないため、図の選択を外しています。3冊のメモと15枚の発言だけを表示しています。';
  const lineOf = (oid) => d.observations.get(oid).line_id;
  const tpl = TEMPLATE[f.id];
  let s = `${f.id}「${f.title}」を選択中。支持する参加者 ${f.frequency}/${d.participants.size}人（${f.observation_ids.map(lineOf).join('、')}）、確からしさ ${CONFIDENCE_LABEL[f.confidence]}。`;
  s += f.contradictions.length
    ? `反する発言 ${f.contradictions.map((c) => c.line_id).join('、')} は別の列に置き、支持に数えません。`
    : '反する発言の記録はありません。';
  if (tpl.neutral) s += `${tpl.neutral.map(lineOf).join('、')} はどちらにも数えず、外に置いています。`;
  if (tpl.kind === 'routes') s += `${tpl.routes.map((r) => `${lineOf(r.o)}は${r.purpose}・${r.channel}`).join('、')}と、別々の道に分けています。`;
  if (tpl.kind === 'split') s += `${tpl.notes(tpl.groups).map((label, i) => `${label}（${tpl.groups[i].map(lineOf).join('・')}）`).join('と')}に分けています。`;
  if (tpl.positive) s += '今の良い点として残すまとまりです。';
  if (rec) s += `次の一歩は ${rec.id}（${rec.priority}・未実施）：${rec.action}`;
  return s;
}

/* ---------- slip reader ---------- */

function usesOf(lineId) {
  const list = [];
  for (const f of state.data.findings) {
    for (const oid of f.observation_ids) if (state.data.observations.get(oid).line_id === lineId) list.push(`${f.id}の根拠`);
    for (const c of f.contradictions) if (c.line_id === lineId) list.push(`${f.id}に反する発言（支持に数えない）`);
  }
  return list.length ? list.join('・') : 'どの発見の支持にも反証にも数えていません';
}

function pickSlip(oid, { keyboard = false } = {}) {
  if (!state.data || !state.data.observations.has(oid)) return;
  state.slipId = oid;
  const home = homeCluster(oid);
  if (home && state.visible.some((f) => f.id === home)) {
    state.chosenId = home;
    state.selectedId = home;
    if (location.hash !== `#${home}`) history.replaceState(null, '', `#${home}`);
  }
  renderAll();
  const rect = el.reader.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) el.reader.scrollIntoView({ block: 'nearest', behavior: smoothOrAuto() });
  if (keyboard) el.rTitle.focus({ preventScroll: true });
}

function renderReader() {
  const oid = state.slipId;
  if (!oid || !state.data) {
    el.reader.hidden = true;
    return;
  }
  const o = state.data.observations.get(oid);
  const p = state.data.participants.get(o.source_id);
  el.reader.dataset.p = p.id;
  el.rTitle.textContent = `${o.line_id}　${OBS_LABEL[oid]}`;
  el.rWho.textContent = `${p.id}・${p.segment}`;
  el.rKind.textContent = KIND_LABEL[o.kind];
  el.rQuote.textContent = o.quote;
  el.rUse.textContent = usesOf(o.line_id);
  el.rCode.textContent = o.code;
  el.rInterp.textContent = o.interpretation;
  el.rLink.href = `#line-${o.line_id}`;
  el.rLink.textContent = `原文 ${o.line_id} をメモで見る`;
  el.reader.hidden = false;
}

el.map.addEventListener('click', (event) => {
  const slip = event.target.closest('.slip');
  if (slip) pickSlip(slip.dataset.obs);
});
el.map.addEventListener('keydown', (event) => {
  const slip = event.target.closest('.slip');
  if (!slip || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  pickSlip(slip.dataset.obs, { keyboard: true });
});
el.rClose.addEventListener('click', () => {
  const oid = state.slipId;
  state.slipId = null;
  renderAll();
  const node = oid && state.map ? state.map.slips.get(oid) : null;
  if (node) node.focus();
});
el.reader.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') el.rClose.click();
});

/* ---------- source notes ---------- */

function renderNotes() {
  const d = state.data;
  el.noteList.replaceChildren(...d.interviews.participants.map((p) => {
    const details = document.createElement('details');
    details.id = `note-${p.id}`;
    details.className = 'fold note';
    details.dataset.participant = p.id;
    details.dataset.p = p.id;
    const summary = document.createElement('summary');
    const sid = document.createElement('span');
    sid.className = 'sid';
    sid.textContent = p.id;
    summary.append(sid, document.createTextNode(p.segment));
    const body = document.createElement('div');
    body.className = 'fold-body';
    const context = document.createElement('p');
    context.className = 'note-context';
    context.textContent = p.context;
    const ol = document.createElement('ol');
    ol.className = 'lines';
    for (const line of p.lines) {
      const li = document.createElement('li');
      li.id = `line-${line.id}`;
      li.className = 'line';
      li.tabIndex = -1;
      li.dataset.lineId = line.id;
      const id = document.createElement('span');
      id.className = 'line-id';
      id.textContent = line.id;
      const text = document.createElement('span');
      text.className = 'line-text';
      text.textContent = line.text;
      const uses = document.createElement('span');
      uses.className = 'line-uses';
      uses.textContent = usesOf(line.id);
      li.append(id, text, uses);
      ol.append(li);
    }
    body.append(context, ol);
    details.append(summary, body);
    return details;
  }));
  el.notesStatus.hidden = true;
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

function smoothOrAuto() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
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
  if (lineId) {
    revealLine(lineId);
    return;
  }
  const m = FINDING_HASH.exec(location.hash);
  if (!m || !state.data) return;
  state.chosenId = m[1];
  if (!state.visible.some((f) => f.id === m[1])) {
    state.participant = 'all';
    state.query = '';
    el.query.value = '';
  }
  applyFilters();
});

/* ---------- unknowns, scope, request ---------- */

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

function renderScope() {
  el.question.textContent = state.data.synthesis.meta.research_question;
  el.sampleList.replaceChildren(...state.data.samples.samples.map((s) => {
    const li = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = s.label;
    li.append(label, document.createTextNode(`：${s.input}`));
    return li;
  }));
}

function renderRequest() {
  el.requestText.value = state.data.request;
  el.requestStatus.textContent = '';
  el.requestStatus.hidden = true;
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

el.copy.addEventListener('click', async () => {
  const text = state.data ? state.data.request : '';
  if (!text || el.root.dataset.state !== 'ready') return;
  el.copy.disabled = true;
  el.copyStatus.textContent = '';
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('unavailable');
    await navigator.clipboard.writeText(text);
    el.copyStatus.textContent = '依頼文をクリップボードにコピーしました。';
  } catch {
    el.requestText.focus();
    el.requestText.setSelectionRange(0, el.requestText.value.length);
    el.copyStatus.textContent = '自動ではコピーできませんでした。上の欄の依頼文を選択したので、Ctrl+C（スマホでは長押しして「コピー」）でコピーしてください。';
  } finally {
    el.copy.disabled = !(state.data && el.root.dataset.state === 'ready');
  }
});

/* ---------- controls ---------- */

for (const btn of el.choices) {
  btn.addEventListener('click', () => {
    state.slipId = null;
    selectFinding(btn.dataset.finding);
  });
}

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
  if (!state.chosenId) state.chosenId = DEFAULT_FINDING;
  applyFilters();
});

el.retry.addEventListener('click', () => {
  if (state.controller) return; // already loading
  load();
});

WIDE_QUERY.addEventListener('change', () => {
  if (!state.data) return;
  state.layout = WIDE_QUERY.matches ? 'wide' : 'tall';
  buildMap();
  paintMap();
});

load();
