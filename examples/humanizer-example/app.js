// Humanizer 作例「指示書と原文を、同じAIへ」。
// 保存済みの11素材を固定のmanifestで照合してから、同じ概念図をページと図解動画で描く。
// HumanizerはMarkdownの指示書（SKILL.md）で、文章を書き直すプログラム・検出器・モデルではない。
// このページではAIを動かさない。制作時に Claude Opus 5.5 がSKILL.mdを読んで書いた3件の保存結果を読むだけ。
// video/video.js もこのモジュールから照合と描画を読み込む（DOMの起動はこのページのときだけ）。
// Copyright (c) 2026 Studio Yebisu. MIT License.

export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = 'eb2f56d0bb68eeaa28d4089cd79f1ea0f32be88ce323b1e9cd81d1adc25ee417';
export const SOURCE_COMMIT = '225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8';
export const ASSET_COUNT = 11;
export const JOB_IDS = Object.freeze(['release', 'reply', 'japanese']);

const CASE_ID = 'humanizer-example';
const VERSION = '3.1.0';
const PART_IDS = ['manual', 'input', 'mark', 'draft', 'check', 'final'];
const GROUP_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
const GROUP_SIZES = [5, 6, 7, 3, 4, 1];
const COUNTS = {jobs: 3, facts: 17, marks: 13, changes: 11, remaining_patterns: 1};
const PER_JOB = {
  release: {facts: 7, marks: 4, changes: 2, remaining: 0},
  reply: {facts: 4, marks: 5, changes: 6, remaining: 1},
  japanese: {facts: 6, marks: 4, changes: 3, remaining: 0},
};
// reply の答え・点検で残った1文・最終稿での書き方・時間の見込み（保存結果と完全一致を照合する）
const REPLY = Object.freeze({
  answer: 'Support cannot reopen an expired download link.',
  remaining: 'A workspace owner can create a new export from Settings > Export.',
  final: 'As a workspace owner, you can create a new export from Settings > Export.',
  uncertainty: 'Large workspaces may take a few minutes to prepare.',
});

export const MEMO = Object.freeze({path: 'outputs/revisions.md', bytes: 13919, sha256: '148c6a92e08538eb2413c1b02d05156283f0e459328d31d89747b3e57b8a5d51', download: 'revisions.md'});
export const RESULT_JSON = Object.freeze({path: 'outputs/revisions.json', bytes: 21807, sha256: 'a4ac78dd0169100f2ecfbcdec3858cc0787f482be99105c9ad97dd5a67346c30', download: 'revisions.json'});

const ASSET_PATHS = Object.freeze([
  'concept/structure.json', 'inputs/jobs.json', RESULT_JSON.path, MEMO.path, 'outputs/movie-materials.json',
  'samples.json', 'request.txt', 'verification.json', 'vendor/humanizer/SKILL.md', 'vendor/humanizer/README.md', 'vendor/humanizer/LICENSE',
]);

// 図の札に出す短い抜き出し。原文側と最終稿側の両方の引用に含まれることを照合する。
const ANCHOR_TERMS = Object.freeze({
  'release-1': 'October 20, 2026', 'release-2': 'workspace owners', 'release-3': 'Team plan', 'release-4': 'Markdown ZIP',
  'release-5': '24 hours', 'release-6': 'but not comments', 'release-7': 'do not change',
  'reply-1': 'cannot reopen', 'reply-2': 'workspace owner', 'reply-3': 'no additional charge', 'reply-4': 'may take a few minutes',
  'japanese-1': '10月22日', 'japanese-2': '全プラン', 'japanese-3': 'Ctrl+K', 'japanese-4': '含まれません', 'japanese-5': '11月5日まで', 'japanese-6': '保存しません',
});
// 読み手の箱に出す短い語。読み手欄の中にあることを照合する。
const READER_TAGS = Object.freeze({release: '初めて読む', reply: 'workspace owner', japanese: '初めて読む'});

// このファイルの場所が作例のルート。<base href="video/"> の書き出しでも同じ場所を指す。
const ROOT = new URL('./', import.meta.url);

// ---------- 照合 ----------

class AssetError extends Error {}
const fail = (message) => { throw new AssetError(message); };
const check = (ok, message) => { if (!ok) fail(message); };
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const isText = (v) => typeof v === 'string' && v.length > 0;

function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

async function fetchBytes(path, signal) {
  let response;
  try {
    response = await fetch(new URL(path, ROOT), {cache: 'no-store', credentials: 'same-origin', signal});
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    fail(`${path} を取得できませんでした`);
  }
  if (!response.ok) fail(`${path} が HTTP ${response.status} でした`);
  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return fail(`${path} を最後まで読めませんでした`);
  }
}

export async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) fail('この環境ではSHA-256を確かめられません（https か 127.0.0.1 で開いてください）');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeText(bytes, path) {
  let body;
  try {
    body = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    fail(`${path} がUTF-8として読めません`);
  }
  return body.charCodeAt(0) === 0xfeff ? body.slice(1) : body;
}

function parseJson(path, body) {
  try {
    return JSON.parse(body);
  } catch {
    return fail(`${path} がJSONとして読めません`);
  }
}

function validateManifest(m) {
  check(m && m.format === 'studio-yebisu-assets/v1' && m.case_id === CASE_ID && m.source_commit === SOURCE_COMMIT, 'manifest の形式か固定版が違います');
  check(Array.isArray(m.files) && m.files.length === ASSET_COUNT, `manifest の素材が${ASSET_COUNT}件ではありません`);
  check(sameList(m.files.map((f) => f.path), ASSET_PATHS), 'manifest の素材の一覧が違います');
  for (const f of m.files) check(Number.isInteger(f.bytes) && f.bytes > 0 && /^[0-9a-f]{64}$/.test(f.sha256), `manifest の ${f.path} の記録`);
  for (const pin of [MEMO, RESULT_JSON]) {
    const e = m.files.find((f) => f.path === pin.path);
    check(e.sha256 === pin.sha256 && e.bytes === pin.bytes, `manifest の ${pin.path}`);
  }
}

// 原文を文に分ける。英語は . ! ? で、日本語は 。で区切る。分けた文をつなぎ直して元と一致することを確かめる。
const joinSentences = (list, lang) => list.join(lang === 'ja' ? '' : ' ');
function sentencesOf(text, lang, where) {
  const flat = lang === 'ja' ? text.replace(/\s*\n\s*/g, '') : text.replace(/\s+/g, ' ').trim();
  const re = lang === 'ja' ? /[^。]+。/g : /[^.!?]+[.!?]+/g;
  const out = [...flat.matchAll(re)].map((m) => m[0].trim()).filter(Boolean);
  check(joinSentences(out, lang) === flat, `${where} を文に分けられません`);
  return out;
}
function startsOf(list, lang) {
  const sep = lang === 'ja' ? 0 : 1;
  let pos = 0;
  return list.map((s) => { const at = pos; pos += s.length + sep; return at; });
}
function sentenceAt(starts, pos) {
  check(pos >= 0, '引用の位置');
  let k = 0;
  starts.forEach((s, i) => { if (s <= pos) k = i; });
  return k;
}

function buildJob(id, s, inp, r, sample, titles) {
  check(s && inp && r, `${id} がありません`);
  const lang = s.language;
  check(lang === 'en' || lang === 'ja', `${id} の言語`);
  for (const key of ['id', 'label', 'language', 'purpose', 'reader_context', 'input']) {
    check(isText(s[key]) && s[key] === inp[key], `${id} の ${key} が inputs/jobs.json と違います`);
  }
  check(Array.isArray(s.known_context_can_omit) && deepEqual(s.known_context_can_omit, inp.known_context_can_omit ?? []), `${id} の省ける既知の背景が inputs/jobs.json と違います`);
  check(Array.isArray(s.facts) && Array.isArray(inp.facts) && deepEqual(inp.facts, s.facts.map((f) => ({id: f.id, label: f.label, source_quote: f.source_quote}))), `${id} の残す条件が inputs/jobs.json と違います`);
  for (const key of ['id', 'label', 'language', 'input', 'first_draft', 'remaining_patterns', 'final', 'marks', 'changes', 'facts', 'context_omissions', 'explanation_ja']) {
    check(deepEqual(s[key], r[key]), `${id} の ${key} が outputs/revisions.json と違います`);
  }
  check(sample && sample.id === id && sample.label === s.label && sample.language === lang && sample.input === s.input && sample.output === s.final, `samples.json の ${id}`);
  const want = PER_JOB[id];
  check(Array.isArray(s.marks) && Array.isArray(s.changes) && Array.isArray(s.remaining_patterns), `${id} の配列`);
  check(s.facts.length === want.facts && s.marks.length === want.marks && s.changes.length === want.changes && s.remaining_patterns.length === want.remaining, `${id} の件数`);
  check(isText(s.first_draft) && isText(s.final) && isText(s.explanation_ja), `${id} の初稿・最終稿・説明`);

  // 文の対応：初稿＝原文から削った文を除いたもの、最終稿＝初稿の文に書き換えを当てたもの
  const sents = sentencesOf(s.input, lang, `${id} の原文`);
  for (const c of s.changes) {
    check(c && isText(c.before) && typeof c.after === 'string' && isText(c.reason), `${id} の変更点の項目`);
    check(sents.filter((x) => x === c.before).length === 1, `${id} の変更前の引用が原文の1文と一致しません`);
    check(Array.isArray(c.sections) && c.sections.length > 0 && c.sections.every((n) => titles.has(n)), `${id} の変更点の節番号`);
  }
  check(new Set(s.changes.map((c) => c.before)).size === s.changes.length, `${id} の変更点が重複しています`);
  const items = sents.map((text, i) => {
    const c = s.changes.find((x) => x.before === text);
    return {i, text, kind: !c ? 'keep' : c.after === '' ? 'cut' : 'edit', after: c && c.after ? c.after : null, sections: c ? [...c.sections] : [], len: Array.from(text).length, facts: [], j: -1};
  });
  const kept = items.filter((x) => x.kind !== 'cut');
  kept.forEach((x, j) => { x.j = j; });
  check(joinSentences(kept.map((x) => x.text), lang) === s.first_draft, `${id} の初稿が、原文から削った文を除いた形と一致しません`);
  const finalSents = kept.map((x) => x.after ?? x.text);
  check(joinSentences(finalSents, lang) === s.final, `${id} の最終稿が、初稿の文と書き換えから組み立てた形と一致しません`);
  const edits = items.filter((x) => x.kind === 'edit');
  const same = s.first_draft === s.final;

  for (const rem of s.remaining_patterns) {
    check(rem && titles.has(rem.section) && isText(rem.quote) && s.first_draft.includes(rem.quote) && isText(rem.reason), `${id} の点検の引用が初稿にありません`);
  }
  if (id === 'reply') {
    check(!same && edits.length === 1, 'reply の書き換えは1文のはずです');
    const rem = s.remaining_patterns[0];
    check(rem.section === 26 && rem.quote === REPLY.remaining && edits[0].text === REPLY.remaining && edits[0].after === REPLY.final && edits[0].sections.includes(26), 'reply の点検で残った1件と最終稿の書き方');
    check(s.first_draft.startsWith(REPLY.answer) && s.final.startsWith(REPLY.answer), 'reply の答えが最初の文ではありません');
    check(s.first_draft.includes(REPLY.uncertainty) && s.final.includes(REPLY.uncertainty), 'reply の時間の見込み（Large・may・a few minutes）');
    check(s.known_context_can_omit.length === 2 && Array.isArray(s.context_omissions) && deepEqual(s.context_omissions.map((o) => o.quote), s.known_context_can_omit), 'reply の省いた背景は読み手欄の2件だけのはずです');
    for (const o of s.context_omissions) check(isText(o.reason) && s.input.includes(o.quote) && !s.first_draft.includes(o.quote) && !s.final.includes(o.quote), 'reply の省いた背景');
  } else {
    check(same && edits.length === 0 && s.remaining_patterns.length === 0, `${id} は初稿＝最終稿で、点検の残りが空のはずです`);
    check(s.known_context_can_omit.length === 0 && Array.isArray(s.context_omissions) && s.context_omissions.length === 0, `${id} は背景を省いていないはずです`);
  }
  for (const m of s.marks) {
    check(m && titles.get(m.section) === m.pattern && isText(m.quote) && s.input.includes(m.quote) && isText(m.reason), `${id} の印（§${m?.section}）`);
  }

  const flat = joinSentences(sents, lang);
  const srcStarts = startsOf(sents, lang);
  const finStarts = startsOf(finalSents, lang);
  const facts = s.facts.map((f, k) => {
    check(f && f.id === `${id}-${k + 1}` && isText(f.label) && isText(f.note), `${id} の条件 ${k + 1}`);
    check(isText(f.source_quote) && s.input.includes(f.source_quote) && flat.includes(f.source_quote), `${f.id} の原文の引用が原文にありません`);
    check(isText(f.final_quote) && s.final.includes(f.final_quote), `${f.id} の最終稿の引用が最終稿にありません`);
    const term = ANCHOR_TERMS[f.id];
    check(term && f.source_quote.includes(term) && f.final_quote.includes(term), `${f.id} の札の語`);
    const item = items[sentenceAt(srcStarts, flat.indexOf(f.source_quote))];
    check(item.kind !== 'cut', `${f.id} が削った文の中にあります`);
    check(sentenceAt(finStarts, s.final.indexOf(f.final_quote)) === item.j, `${f.id} の位置が原文と最終稿で対応しません`);
    // 一つの条件の引用が複数文にまたがる場合も、その全文に札を結ぶ。
    // japanese-4 は本文だけ／除外対象という続く2文を一つの条件で記録している。
    const sourceEnd = sentenceAt(srcStarts, flat.indexOf(f.source_quote) + f.source_quote.length - 1);
    const finalEnd = sentenceAt(finStarts, s.final.indexOf(f.final_quote) + f.final_quote.length - 1);
    check(items[sourceEnd].j === finalEnd, `${f.id} の引用末尾が原文と最終稿で対応しません`);
    for (let i = item.i; i <= sourceEnd; i++) {
      check(items[i].kind !== 'cut', `${f.id} の途中に削った文があります`);
      items[i].facts.push(f.id);
    }
    return {id: f.id, label: f.label, source: f.source_quote, final: f.final_quote, note: f.note, term, item: item.i, j: item.j};
  });
  check(kept.every((x) => x.facts.length > 0), `${id} の残る文に、条件のない文があります`);

  const tag = READER_TAGS[id];
  check(s.reader_context.includes(tag), `${id} の読み手欄`);
  let question = null;
  if (id === 'reply') {
    const quoted = (s.reader_context.match(/"([^"]+)"/) || [])[1] || '';
    question = (quoted.match(/[^.?!]+[.?!]/g) || []).map((x) => x.trim()).at(-1) || '';
    check(question.endsWith('?') && s.reader_context.includes(question), 'reply の読み手の質問');
  }
  // 帯に出す印：短い2つを原文の順に（保存された印だけ）
  const markPicks = s.marks.map((m, k) => ({section: m.section, quote: m.quote, k}))
    .sort((a, b) => Array.from(a.quote).length - Array.from(b.quote).length || a.k - b.k)
    .slice(0, 2)
    .sort((a, b) => s.input.indexOf(a.quote) - s.input.indexOf(b.quote));
  const lead = kept[0];
  const leadFact = facts.find((f) => f.id === lead.facts[0]);

  return {
    id, label: s.label, language: lang, purpose: s.purpose, readerContext: s.reader_context, readerTag: tag, question,
    known: [...s.known_context_can_omit], input: s.input, firstDraft: s.first_draft, final: s.final, same,
    remaining: s.remaining_patterns.map((x) => ({section: x.section, title: titles.get(x.section), quote: x.quote, reason: x.reason})),
    marks: s.marks.map((m) => ({section: m.section, pattern: m.pattern, quote: m.quote, reason: m.reason})),
    changes: s.changes.map((c) => ({before: c.before, after: c.after, sections: [...c.sections], reason: c.reason})),
    omissions: s.context_omissions.map((o) => ({quote: o.quote, reason: o.reason})),
    explanation: s.explanation_ja,
    facts, items, keptCount: kept.length, cutCount: items.length - kept.length,
    maxLen: Math.max(...items.map((x) => x.len)),
    markPicks: markPicks.map(({section, quote}) => ({section, quote})),
    draftLead: {text: lead.text, term: leadFact ? leadFact.term : ''},
    finalLead: lead.after ?? lead.text,
    edit: edits.length ? {before: edits[0].text, after: edits[0].after, sections: [...edits[0].sections]} : null,
  };
}

function officialUrl(path, line) {
  const prefix = 'vendor/humanizer/';
  if (!path.startsWith(prefix)) return null;
  return `https://github.com/blader/humanizer/blob/${SOURCE_COMMIT}/${path.slice(prefix.length)}#L${line}`;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function buildBundle(manifest, bytes) {
  const text = (path) => decodeText(bytes.get(path), path);
  const json = (path) => parseJson(path, text(path));
  const entry = (path) => manifest.files.find((f) => f.path === path);

  const structure = json('concept/structure.json');
  const inputs = json('inputs/jobs.json');
  const result = json(RESULT_JSON.path);
  const memo = text(MEMO.path);
  const materials = json('outputs/movie-materials.json');
  const samples = json('samples.json');
  const request = text('request.txt');
  const verification = json('verification.json');
  const skill = text('vendor/humanizer/SKILL.md');
  const readme = text('vendor/humanizer/README.md');
  const license = text('vendor/humanizer/LICENSE');
  const skillLines = skill.split(/\r?\n/);

  // 構造の記録
  check(structure && structure.format === 'humanizer-structure/v1' && structure.case_id === CASE_ID, 'structure.json の形式');
  check(structure.source_commit === SOURCE_COMMIT && structure.version === VERSION, 'structure.json の固定版');
  check(isText(structure.definition) && isText(structure.scope_note), 'structure.json の定義と範囲');
  check(deepEqual(structure.counts, COUNTS), 'structure.json の件数（3件・17条件・13印・11変更・残り1件）');
  const gr = structure.guardrails || {};
  check(gr.read_aloud_done === false && gr.human_approval === false && gr.new_original_rewrite === false && gr.live_ai_in_browser === false
    && gr.keep_informative_contrasts === true && gr.reader_omission_only_explicit === true && gr.reply_two_known_context_omissions === true
    && gr.weak_patterns_not_global_bans === true && gr.fact_pairs_are_quote_correspondences_not_meaning_proof === true, 'structure.json の扱いの記録');
  const outs = structure.outputs || {};
  for (const [key, pin] of [['memo', MEMO], ['json', RESULT_JSON]]) {
    check(outs[key] && outs[key].path === pin.path && outs[key].sha256 === pin.sha256 && outs[key].bytes === pin.bytes && entry(pin.path).sha256 === pin.sha256, `structure.json の出力 ${pin.path}`);
  }

  // 6つの部分：引用が出典の該当行にあること
  check(Array.isArray(structure.parts) && sameList(structure.parts.map((p) => p.id), PART_IDS), 'structure.json の6部分のID');
  const parts = structure.parts.map((part) => {
    check(isText(part.label) && isText(part.meaning) && isText(part.quote), `部分 ${part.id} の項目`);
    check(bytes.has(part.source_path) && /\.(md|txt)$/.test(part.source_path), `部分 ${part.id} の出典が照合済みの素材にありません`);
    const lines = text(part.source_path).split(/\r?\n/);
    check(Number.isInteger(part.line_start) && part.line_start >= 1 && part.line_start <= lines.length && lines[part.line_start - 1].includes(part.quote),
      `部分 ${part.id} の引用が ${part.source_path} の${part.line_start}行目にありません`);
    return {id: part.id, label: part.label, meaning: part.meaning, quote: part.quote, path: part.source_path, line: part.line_start, upstream: officialUrl(part.source_path, part.line_start)};
  });

  // 6系統・26型：見出しが SKILL.md の該当行と一致し、§1〜§26 が順にそろう
  check(Array.isArray(structure.pattern_groups) && sameList(structure.pattern_groups.map((g) => g.id), GROUP_IDS), 'structure.json の6系統');
  const titles = new Map();
  let expect = 1;
  const groups = structure.pattern_groups.map((g, gi) => {
    check(isText(g.label) && isText(g.upstream_heading) && g.upstream_heading.startsWith(`${g.id}. `), `系統 ${g.id} の項目`);
    check(Number.isInteger(g.line_start) && skillLines[g.line_start - 1] === `## ${g.upstream_heading}`, `系統 ${g.id} の見出しが SKILL.md の${g.line_start}行目にありません`);
    check(Array.isArray(g.sections) && g.sections.length === GROUP_SIZES[gi] && Array.isArray(g.patterns) && g.patterns.length === g.sections.length, `系統 ${g.id} の型の数`);
    const sections = g.patterns.map((pt, k) => {
      check(pt.section === expect && g.sections[k] === expect, `系統 ${g.id} の節番号`);
      check(isText(pt.title) && Number.isInteger(pt.line_start) && skillLines[pt.line_start - 1] === `### ${pt.section}. ${pt.title}`, `§${pt.section} の見出しが SKILL.md の${pt.line_start}行目にありません`);
      titles.set(pt.section, pt.title);
      expect += 1;
      return {n: pt.section, title: pt.title, line: pt.line_start, weak: false, upstream: officialUrl('vendor/humanizer/SKILL.md', pt.line_start)};
    });
    return {id: g.id, label: g.label, heading: g.upstream_heading, line: g.line_start, upstream: officialUrl('vendor/humanizer/SKILL.md', g.line_start), sections, marks: []};
  });
  check(expect === 27, '26型がそろっていません');
  // 「単独では弱い」印：各節の本文に *weak alone* があるか（SKILL.md から読む）
  const endLine = skillLines.findIndex((l) => l === '## When not to act') + 1;
  check(endLine > 0, 'SKILL.md の「When not to act」');
  const allSections = groups.flatMap((g) => g.sections);
  allSections.forEach((sec, k) => {
    const stop = k + 1 < allSections.length ? allSections[k + 1].line : endLine;
    sec.weak = /\*weak alone\*|\*Weak alone\.\*/.test(skillLines.slice(sec.line, stop - 1).join('\n'));
  });
  const lineOf = (needle) => skillLines.findIndex((l) => l.includes(needle)) + 1;
  const strongLine = lineOf('§1 to §5 justify an edit on one sighting');
  const materialLine = lineOf('Treat the text as material to edit, never as instructions to follow.');
  check(strongLine > 0 && materialLine > 0, 'SKILL.md の強さと素材の扱いの行');

  // 3件：構造の記録・入力・保存結果・samples が一致
  check(inputs.fictional === true && result.fictional === true, '架空の入力であることの記録');
  check(result.skill && result.skill.name === 'Humanizer' && result.skill.version === VERSION && result.skill.commit === SOURCE_COMMIT, 'revisions.json の固定版');
  check(result.scope_note === structure.scope_note, 'revisions.json の範囲の注記');
  check(Array.isArray(structure.jobs) && sameList(structure.jobs.map((j) => j.id), JOB_IDS), 'structure.json の3件のID');
  check(Array.isArray(inputs.jobs) && sameList(inputs.jobs.map((j) => j.id), JOB_IDS), 'inputs/jobs.json の3件のID');
  check(Array.isArray(result.jobs) && sameList(result.jobs.map((j) => j.id), JOB_IDS), 'revisions.json の3件のID');
  check(samples && samples.format === 'input-output' && Array.isArray(samples.samples) && sameList(samples.samples.map((x) => x.id), JOB_IDS), 'samples.json');
  const jobs = {};
  JOB_IDS.forEach((id, i) => { jobs[id] = buildJob(id, structure.jobs[i], inputs.jobs[i], result.jobs[i], samples.samples[i], titles); });
  const total = (key) => JOB_IDS.reduce((sum, id) => sum + jobs[id][key].length, 0);
  check(total('facts') === COUNTS.facts && total('marks') === COUNTS.marks && total('changes') === COUNTS.changes && total('remaining') === COUNTS.remaining_patterns, '3件の合計の件数');
  for (const id of JOB_IDS) {
    for (const m of jobs[id].marks) groups.find((g) => g.sections.some((x) => x.n === m.section)).marks.push({job: id, label: jobs[id].label, section: m.section, quote: m.quote});
  }

  // 推敲メモ：3件の初稿と最終稿をそのまま含む実ファイル
  check(memo.startsWith('# Humanizer作例') && memo.includes('音読はしていません'), `${MEMO.path} の形式`);
  for (const id of JOB_IDS) check(memo.includes(jobs[id].firstDraft) && memo.includes(jobs[id].final), `${MEMO.path} に ${id} の初稿・最終稿がありません`);
  check(materials.fictional === true && materials.audio === 'silent' && materials.human_approval === false, 'movie-materials.json の扱い');
  check(materials.memo?.path === MEMO.path && materials.memo.sha256 === MEMO.sha256 && materials.results?.sha256 === RESULT_JSON.sha256
    && materials.inputs?.sha256 === entry('inputs/jobs.json').sha256, 'movie-materials.json のハッシュ');
  const dc = verification.data_checks || {};
  check(verification.id === CASE_ID && verification.source_commit === SOURCE_COMMIT && verification.human_approval === false, 'verification.json');
  check(dc.fact_quote_pairs === 17 && dc.marks === 13 && dc.changes === 11 && dc.remaining_pattern_quotes_in_first_draft === 1 && dc.human_approval === false, 'verification.json の件数');
  check(request.includes(`https://github.com/blader/humanizer/blob/${SOURCE_COMMIT}/SKILL.md`) && request.includes('原文：') && request.includes('残す条件：'), 'request.txt');
  check(skill.includes('name: humanizer') && skill.includes('version: "3.1.0"') && skill.includes('license: MIT'), 'SKILL.md の固定版');
  check(readme.includes('## The 26 patterns'), 'README.md の26型');
  check(license.includes('MIT License') && license.includes('Copyright (c) 2025 Siqi Chen'), 'Humanizer の LICENSE');

  return {
    caseId: CASE_ID,
    commit: SOURCE_COMMIT,
    version: VERSION,
    assetCount: manifest.files.length,
    definition: structure.definition,
    scopeNote: structure.scope_note,
    parts,
    groups,
    jobs,
    strongLine,
    materialLine,
    memo: {...MEMO},
    json: {...RESULT_JSON},
    request,
  };
}

// 11件をすべて取り直し、大きさとSHA-256、中身の対応を確かめた記録だけを返す。どれか一つでも違えば例外。
// 一件でも失敗したら残りの取得を止め、進み具合の通知もそこで止める。
export async function loadValidatedAssets({signal, onProgress} = {}) {
  const inner = new AbortController();
  const relay = () => inner.abort();
  if (signal?.aborted) inner.abort();
  signal?.addEventListener('abort', relay, {once: true});
  let failed = false;
  try {
    const manifestBytes = await fetchBytes(MANIFEST_PATH, inner.signal);
    check((await sha256Hex(manifestBytes)) === MANIFEST_SHA256, 'concept/manifest.json のSHA-256が固定値と違います');
    const manifest = parseJson(MANIFEST_PATH, decodeText(manifestBytes, MANIFEST_PATH));
    validateManifest(manifest);
    const bytes = new Map();
    let done = 0;
    onProgress?.(0, manifest.files.length);
    await Promise.all(manifest.files.map(async (entry) => {
      try {
        const body = await fetchBytes(entry.path, inner.signal);
        check(body.byteLength === entry.bytes, `${entry.path} の大きさが記録と違います`);
        check((await sha256Hex(body)) === entry.sha256, `${entry.path} のSHA-256が記録と違います`);
        bytes.set(entry.path, body);
      } catch (error) {
        if (!failed) { failed = true; inner.abort(); }
        throw error;
      }
      if (!failed) onProgress?.(++done, manifest.files.length);
    }));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return deepFreeze(buildBundle(manifest, bytes));
  } finally {
    signal?.removeEventListener('abort', relay);
  }
}

// ---------- 概念図の描画（ページと図解動画で共通） ----------
// 図の形：SKILL.mdの本・原文の紙・読み手・残す条件の札 → 同じAIの作業台（印→初稿→点検→最終稿と戻り矢印）
// → 最終稿の紙 → 読み比べ → 推敲メモ。同じ形が動き、合流し、並び替わる。

export const FONT = Object.freeze({
  sans: 'system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", "Noto Serif JP", serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, "BIZ UDGothic", monospace',
});

export const PALETTES = Object.freeze({
  light: Object.freeze({paper: '#f3efe6', card: '#fbf9f4', ink: '#1b1d1f', inkSoft: '#45484b', muted: '#676a69', line: '#cfc6b6', petrol: '#0f5c66', petrolSoft: '#d7e6e6', petrolMid: '#5f9aa1', amber: '#9a5a0c', amberBright: '#d9962e', amberSoft: '#f4e5cb', onPetrol: '#f7f4ee'}),
  dark: Object.freeze({paper: '#121517', card: '#1b2023', ink: '#ece7dd', inkSoft: '#c9c4ba', muted: '#a09c94', line: '#3c4447', petrol: '#62b6bf', petrolSoft: '#173338', petrolMid: '#3d7c84', amber: '#e7b25a', amberBright: '#e7b25a', amberSoft: '#3a2c16', onPetrol: '#0d1416'}),
});

export const STEP_LABELS = Object.freeze(['印', '初稿', '点検', '最終稿']);

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});
const R = (x, y, w, h) => ({x, y, w, h});
const cx = (r) => r.x + r.w / 2;
const cy = (r) => r.y + r.h / 2;
export const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x) => 1 - Math.pow(1 - x, 3);
export const prog = (t, a, b) => clamp01((t - a) / (b - a));
// 入って、出る
export const span = (t, a, b, c, d) => Math.min(easeOut(prog(t, a, b)), 1 - ease(prog(t, c, d)));
// v0 から、各時刻に dur 秒かけて次の値へ（前のフレームに依存しない閉形式）
export function steps(t, v0, changes) {
  let v = v0;
  let prev = v0;
  for (const [at, to, dur = 0.6] of changes) {
    v += (to - prev) * ease(prog(t, at, at + dur));
    prev = to;
  }
  return v;
}

let measurer = null;
function textWidth(s, font) {
  if (!measurer) measurer = document.createElement('canvas').getContext('2d');
  measurer.font = font;
  return measurer.measureText(s).width;
}

export function restingParams(job) {
  return {
    job,
    show: {book: 1, paper: 1, reader: 1, chips: 1, ai: 1, band: 1, final: 1, compare: 1, memo: 1},
    emph: {book: 1, paper: 1, reader: 1, chips: 1, ai: 1, final: 1, compare: 1, memo: 1},
    links: {instr: 1, paperIn: 1, readerIn: 1, bandIn: 1, out: 1, finalToCompare: 1, compareToMemo: 1},
    ghost: 0, bookZoom: 0, bookOpen: 1, stepsPage: 1, stepsFly: 1,
    chipsIn: 1, sheetPos: 0, peel: 0, markGlow: 0, lens: 0, refs: 0, loopGlow: 0, loopRun: 1, rewrite: 0,
    chipsTo: 0, compare: 0, memoTabs: 1, readerGlow: 0,
    band: {material: 1, mark: 0, draft: 0, check: 0, final: 0},
    selFact: null, glowFacts: [], glowK: 0, part: null, partGlow: 0, family: null,
  };
}

// ---- 配置 ----

function fontSizes(u, min) {
  const f = (k) => Math.max(min, u * k);
  return {label: f(0.9), small: f(0.78), tiny: f(0.7), chip: f(0.78), band: f(0.92), big: f(1.45)};
}

function chipMetrics(d, jobId, u, fs) {
  const font = `600 ${fs.chip}px ${FONT.sans}`;
  return {
    h: Math.max(u * 1.55, fs.chip * 1.85),
    gap: u * 0.4,
    rowGap: u * 0.4,
    pad: u * 0.45,
    label: textWidth('残す条件', `700 ${fs.small}px ${FONT.sans}`) + u * 0.8,
    widths: d.jobs[jobId].facts.map((f) => textWidth(f.term, font) + u * 1.1),
    more: (n) => textWidth(`+${n}`, font) + u * 1.1,
  };
}

function chipRowsNeeded(cm, width, maxRows) {
  const right = width - cm.pad * 2;
  let row = 1;
  let x = cm.label;
  for (const w of cm.widths) {
    if (x + w > right && x > 0) { row += 1; x = 0; }
    x += w + cm.gap;
  }
  return Math.min(maxRows, row);
}
const bandHeight = (cm, rows) => cm.pad * 2 + rows * cm.h + (rows - 1) * cm.rowGap;

// 帯の中に札を並べる。入りきらない分は「+n」にまとめ、選んだ札・強調中の札は必ず見せる。
function placeChips(band, cm, n, prefer, maxRows) {
  const left = band.x + cm.pad;
  const right = band.x + band.w - cm.pad;
  const rowY = (row) => band.y + cm.pad + row * (cm.h + cm.rowGap);
  const attempt = (order) => {
    const placed = new Map();
    let row = 0;
    let x = left + cm.label;
    for (const i of order) {
      const w = cm.widths[i];
      if (x + w > right + 0.5) {
        if (row + 1 >= maxRows) break;
        row += 1;
        x = left;
      }
      if (x + w > right + 0.5) break;
      placed.set(i, {x, y: rowY(row), w, row});
      x += w + cm.gap;
    }
    let hidden = order.filter((i) => !placed.has(i));
    let more = null;
    while (hidden.length) {
      const mw = cm.more(hidden.length);
      const rows = [...placed.values()].map((q) => q.row);
      const lastRow = rows.length ? Math.max(...rows) : 0;
      const inRow = [...placed.entries()].filter(([, q]) => q.row === lastRow);
      const endX = inRow.length ? Math.max(...inRow.map(([, q]) => q.x + q.w + cm.gap)) : left + (lastRow === 0 ? cm.label : 0);
      if (endX + mw <= right + 0.5 || !inRow.length) {
        more = {x: endX, y: rowY(lastRow), w: mw, n: hidden.length};
        break;
      }
      placed.delete(inRow[inRow.length - 1][0]);
      hidden = order.filter((i) => !placed.has(i));
    }
    return {placed, hidden, more};
  };
  const natural = [...Array(n).keys()];
  let res = attempt(natural);
  const first = prefer.filter((i) => i >= 0);
  if (first.some((i) => res.hidden.includes(i))) res = attempt([...first, ...natural.filter((i) => !first.includes(i))]);
  return res;
}

// 縦に流れる配置（スマホ・縦動画）。入力 → 条件 → 同じAI → 条件 → 出力（右から左へ戻るU字）
function tallLayout(W, u, cm) {
  const m = Math.round(Math.max(6, W * 0.022));
  const iw = W - m * 2;
  const g = u * 0.55;
  const gut = u * 1.5;
  let y = u * 0.25;
  const rowH = u * 8.4;
  const bw = (iw - g * 2) * 0.32;
  const pw = (iw - g * 2) * 0.35;
  const rw = iw - g * 2 - bw - pw;
  const book = R(m, y, bw, rowH);
  const paper = R(m + bw + g, y, pw, rowH);
  const reader = R(paper.x + pw + g, y, rw, rowH);
  y += rowH + u * 0.9;
  const bandW = iw - gut;
  const bandH = bandHeight(cm, chipRowsNeeded(cm, bandW, 2));
  const bandA = R(m + gut, y, bandW, bandH);
  y += bandH + u * 0.9;
  const ai = R(m, y, iw, u * 14);
  y += ai.h + u * 0.9;
  const bandB = R(m, y, bandW, bandH);
  y += bandH + u * 0.9;
  const og = u * 1.3;
  const cw = (iw - og * 2) / 3;
  const outH = u * 7.8;
  const memo = R(m, y, cw, outH);
  const compare = R(m + cw + og, y, cw, outH);
  const final = R(m + (cw + og) * 2, y, cw, outH);
  y += outH + u * 0.3;
  return {W, H: y, m, gut, maxRows: 2, book, paper, reader, bandA, bandB, ai, final, compare, memo, bookZoom: R(m, u * 0.25, iw, u * 15.5)};
}

// 横に流れる配置（広い画面・横動画）。左に入力、中央に同じAI、右に出力
function wideLayout(W, u, cm) {
  const m = u * 0.9;
  const iw = W - m * 2;
  const gx = Math.max(u * 2.2, iw * 0.035);
  const c1 = iw * 0.3;
  const c2 = iw * 0.39;
  const c3 = iw - c1 - c2 - gx * 2;
  const x1 = m;
  const x2 = x1 + c1 + gx;
  const x3 = x2 + c2 + gx;
  const gy = u * 0.7;
  const top = u * 0.25;
  const bandH = bandHeight(cm, Math.max(chipRowsNeeded(cm, c1, 3), chipRowsNeeded(cm, c3, 3)));
  let y = top;
  const book = R(x1, y, c1, u * 8); y += book.h + gy;
  const paper = R(x1, y, c1, u * 6.6); y += paper.h + gy;
  const reader = R(x1, y, c1, u * 6.2); y += reader.h + gy;
  const bandA = R(x1, y, c1, bandH); y += bandH;
  let y3 = top;
  const bandB = R(x3, y3, c3, bandH); y3 += bandH + gy;
  const final = R(x3, y3, c3, u * 6.6); y3 += final.h + gy * 1.8;
  const compare = R(x3, y3, c3, u * 6.2); y3 += compare.h + gy * 1.8;
  const memo = R(x3, y3, c3, u * 5.4); y3 += memo.h;
  const H = Math.max(y, y3) + u * 0.3;
  const ai = R(x2, top, c2, H - top - u * 0.3);
  return {W, H, m, gut: 0, maxRows: 3, book, paper, reader, bandA, bandB, ai, final, compare, memo, bookZoom: R(x1, top, c1 + gx + c2 * 0.78, Math.min(H - top, u * 17))};
}

// 縦長の紙を枠の中央に置く
function sheetIn(box, aspect = 0.76) {
  let h = box.h;
  let w = h * aspect;
  if (w > box.w) { w = box.w; h = w / aspect; }
  return R(box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
}
const bodyOf = (r, u) => R(r.x + u * 0.55, r.y + u * 1.9, r.w - u * 1.1, r.h - u * 2.35);

function finishInner(L) {
  const {u} = L;
  const wide = L.kind === 'wide';
  // 原文・最終稿・読み比べ・メモの中の紙
  const pb = bodyOf(L.paper, u);
  L.srcSheet = wide ? sheetIn(R(pb.x, pb.y, Math.min(pb.w * 0.3, u * 4), pb.h)) : sheetIn(pb);
  const fb = bodyOf(L.final, u);
  L.finSheet = wide ? sheetIn(R(fb.x, fb.y, Math.min(fb.w * 0.3, u * 4), fb.h)) : sheetIn(fb);
  const cb = bodyOf(L.compare, u);
  const ch = cb.h - u * 1.2;
  L.cmpSrc = wide ? sheetIn(R(cb.x + cb.w * 0.06, cb.y, cb.w * 0.26, ch)) : sheetIn(R(cb.x, cb.y, cb.w * 0.42, ch));
  L.cmpFin = wide ? sheetIn(R(cb.x + cb.w * 0.68, cb.y, cb.w * 0.26, ch)) : sheetIn(R(cb.x + cb.w * 0.58, cb.y, cb.w * 0.42, ch));
  L.cmpLabelY = cb.y + cb.h - u * 0.15;
  const mb = bodyOf(L.memo, u);
  L.memoFile = wide ? sheetIn(R(mb.x, mb.y + u * 0.5, Math.min(mb.w * 0.28, u * 3.6), mb.h - u * 0.5), 0.8) : sheetIn(R(mb.x, mb.y + u * 0.55, mb.w, mb.h - u * 1.75), 0.8);

  // 同じAIの作業台：4つの手順・戻り矢印・文の帯
  const ai = L.ai;
  const pad = u * 0.7;
  const titleH = u * 1.9;
  const loopH = u * 1.7;
  const gapB = u * 0.35;
  const inner = ai.h - titleH - pad;
  const sg = u * 1.05;
  const slotW = (ai.w - pad * 2 - sg * 3) / 4;
  const bandH = Math.min(u * 4.4, Math.max(u * 3.2, inner * 0.3));
  const slotH = Math.min(inner - loopH - gapB - bandH, Math.max(u * 5.4, slotW * 1.5));
  const block = slotH + loopH + gapB + bandH;
  const top = ai.y + titleH + Math.max(0, (inner - block) / 2);
  L.slots = [0, 1, 2, 3].map((k) => {
    const r = R(ai.x + pad + k * (slotW + sg), top, slotW, slotH);
    return {r, sheet: sheetIn(R(r.x + u * 0.4, r.y + u * 0.45, r.w - u * 0.8, r.h - u * 2.0)), ly: r.y + r.h - u * 0.55};
  });
  const sb = top + slotH;
  const ly = sb + loopH * 0.62;
  L.loop = [[cx(L.slots[2].r), sb], [cx(L.slots[2].r), ly], [cx(L.slots[1].r), ly], [cx(L.slots[1].r), sb + 2]];
  L.loopLabel = {x: cx(L.slots[2].r) + u * 0.45, y: ly, max: ai.x + ai.w - pad - (cx(L.slots[2].r) + u * 0.45)};
  L.band = R(ai.x + pad, sb + loopH + gapB, ai.w - pad * 2, bandH);
}

function linkPaths(L) {
  const {u, book, paper, reader, bandA, ai, final, compare, memo} = L;
  const bottom = (r) => r.y + r.h;
  const right = (r) => r.x + r.w;
  if (L.kind === 'wide') {
    return {
      instr: [[right(book), cy(book)], [ai.x, cy(book)]],
      paperIn: [[right(paper), cy(paper)], [ai.x, cy(paper)]],
      readerIn: [[right(reader), cy(reader)], [ai.x, cy(reader)]],
      bandIn: [[right(bandA), cy(bandA)], [ai.x, cy(bandA)]],
      out: [[right(ai), cy(final)], [final.x, cy(final)]],
      finalToCompare: [[cx(final), bottom(final)], [cx(final), compare.y]],
      compareToMemo: [[cx(compare), bottom(compare)], [cx(compare), memo.y]],
      refs: [[[cx(L.slots[2].r), L.slots[2].r.y], [cx(L.slots[2].r), ai.y + u * 1.75], [ai.x + u * 0.35, ai.y + u * 1.75], [ai.x + u * 0.35, cy(paper)], [right(paper), cy(paper)]],
        [[cx(L.slots[2].r) + u * 0.5, L.slots[2].r.y], [cx(L.slots[2].r) + u * 0.5, ai.y + u * 2.05], [ai.x + u * 0.7, ai.y + u * 2.05], [ai.x + u * 0.7, cy(reader)], [right(reader), cy(reader)]]],
      instrLabel: {x: (right(book) + ai.x) / 2, y: cy(book) - u * 0.4, align: 'center'},
      materialLabel: {x: (right(paper) + ai.x) / 2, y: cy(paper) - u * 0.4, align: 'center'},
    };
  }
  const gx = L.m + L.gut * 0.5;
  const ox = L.W - L.m - L.gut * 0.5;
  return {
    instr: [[gx, bottom(book)], [gx, ai.y]],
    paperIn: [[cx(paper), bottom(paper)], [cx(paper), bandA.y]],
    readerIn: [[cx(reader), bottom(reader)], [cx(reader), bandA.y]],
    bandIn: [[cx(bandA), bottom(bandA)], [cx(bandA), ai.y]],
    out: [[ox, bottom(ai)], [ox, final.y]],
    finalToCompare: [[final.x, cy(final)], [right(compare), cy(final)]],
    compareToMemo: [[compare.x, cy(compare)], [right(memo), cy(compare)]],
    refs: [[[cx(L.slots[2].r), L.slots[2].r.y], [cx(L.slots[2].r), ai.y - u * 0.2], [cx(paper), bottom(paper)]],
      [[cx(L.slots[2].r) + u * 0.5, L.slots[2].r.y], [cx(L.slots[2].r) + u * 0.5, ai.y - u * 0.2], [cx(reader), bottom(reader)]]],
    instrLabel: {x: gx + u * 0.3, y: bottom(book) + u * 0.72, align: 'left'},
    materialLabel: {x: cx(paper) + u * 0.3, y: bottom(paper) + u * 0.72, align: 'left'},
  };
}

// kind: 'tall'（縦）か 'wide'（横）。u は文字と余白の基準。選んだ例（jobId）の札の数で高さが変わる。
export function diagramLayout(kind, width, u, d, jobId, opts = {}) {
  const fs = fontSizes(u, opts.minFont || 0);
  // 横の配置は入力と出力の列が細いので、札の文字を少し小さくして4つ以上を収める
  if (kind === 'wide') fs.chip = Math.max(opts.minFont || 0, u * 0.68);
  const cm = chipMetrics(d, jobId, u, fs);
  const L = kind === 'wide' ? wideLayout(width, u, cm) : tallLayout(width, u, cm);
  Object.assign(L, {kind, u, fs, cm, job: jobId});
  finishInner(L);
  L.links = linkPaths(L);
  return L;
}

// ---- 描画の部品 ----

function rr(ctx, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

// 文字を描く。max を超えるときは少し縮め、それでも入らなければ「…」で切る（drop なら描かない）。
export function drawText(ctx, s, x, y, o = {}) {
  const fam = FONT[o.family || 'sans'];
  const weight = o.weight || 400;
  let size = o.size || 14;
  let str = String(s);
  ctx.save();
  ctx.font = `${weight} ${size}px ${fam}`;
  if (o.max) {
    const floor = o.min || size * 0.84;
    while (size > floor && ctx.measureText(str).width > o.max) {
      size = Math.max(floor, size - Math.max(0.5, size * 0.04));
      ctx.font = `${weight} ${size}px ${fam}`;
    }
    if (ctx.measureText(str).width > o.max) {
      if (o.drop) { ctx.restore(); return 0; }
      const chars = Array.from(str);
      while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > o.max) chars.pop();
      str = `${chars.join('')}…`;
    }
  }
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  const width = ctx.measureText(str).width;
  if (o.bg) {
    const left = o.align === 'center' ? x - width / 2 : o.align === 'right' ? x - width : x;
    ctx.fillStyle = o.bg;
    rr(ctx, left - size * 0.3, y - size * 0.95, width + size * 0.6, size * 1.3, size * 0.25);
    ctx.fill();
  }
  ctx.fillStyle = o.color || '#000';
  ctx.fillText(str, x, y);
  ctx.restore();
  return width;
}

// 入る幅で先頭から切る（実際の文の頭だけを見せる）。2文字未満しか入らなければ空。
function fitHead(ctx, s, max, font) {
  ctx.save();
  ctx.font = font;
  let out = s;
  if (ctx.measureText(s).width > max) {
    const chars = Array.from(s);
    while (chars.length > 0 && ctx.measureText(`${chars.join('')}…`).width > max) chars.pop();
    out = chars.length >= 2 ? `${chars.join('')}…` : '';
  }
  ctx.restore();
  return out;
}

// 折れ線を k（0〜1）の長さまで
function partial(pts, k) {
  if (k >= 1) return pts;
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let left = total * clamp01(k);
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (left >= lens[i - 1]) { out.push(pts[i]); left -= lens[i - 1]; continue; }
    const t = lens[i - 1] ? left / lens[i - 1] : 0;
    out.push([lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]);
    break;
  }
  return out;
}

function arrow(ctx, pts, o) {
  const k = o.k ?? 1;
  if (!(o.alpha > 0.003) || k <= 0.003) return;
  const q = partial(pts, k);
  if (q.length < 2) return;
  const [ex, ey] = q[q.length - 1];
  const [px, py] = q[q.length - 2];
  const ang = Math.atan2(ey - py, ex - px);
  const hl = o.head;
  ctx.save();
  ctx.globalAlpha *= o.alpha;
  ctx.strokeStyle = o.color;
  ctx.fillStyle = o.color;
  ctx.lineWidth = o.width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length - 1; i++) ctx.lineTo(q[i][0], q[i][1]);
  ctx.lineTo(ex - Math.cos(ang) * hl * 0.7, ey - Math.sin(ang) * hl * 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  if (!o.noHead) {
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - hl * Math.cos(ang - 0.42), ey - hl * Math.sin(ang - 0.42));
    ctx.lineTo(ex - hl * Math.cos(ang + 0.42), ey - hl * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function panel(ctx, r, pal, o = {}) {
  rr(ctx, r.x, r.y, r.w, r.h, o.radius ?? Math.min(12, r.h * 0.12));
  ctx.fillStyle = o.fill || pal.card;
  ctx.fill();
  ctx.strokeStyle = o.stroke || pal.line;
  ctx.lineWidth = o.width || 1.2;
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function cardHead(ctx, L, r, title, sub, pal, o = {}) {
  const {u, fs} = L;
  const y = r.y + u * 1.3;
  const w = drawText(ctx, title, r.x + u * 0.55, y, {size: fs.label, weight: 700, color: o.titleColor || pal.ink, family: o.family || 'sans', max: r.w - u * 1.1});
  if (sub) drawText(ctx, sub, r.x + r.w - u * 0.55, y, {size: fs.tiny, weight: 600, color: o.subColor || pal.muted, align: 'right', max: r.w - u * 1.6 - w, drop: true});
}

function ring(ctx, r, pal, a, u) {
  if (a <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= a;
  rr(ctx, r.x - u * 0.25, r.y - u * 0.25, r.w + u * 0.5, r.h + u * 0.5, u * 0.6);
  ctx.strokeStyle = pal.amberBright;
  ctx.lineWidth = Math.max(2, u * 0.16);
  ctx.stroke();
  ctx.restore();
}

// ---- 紙：文ごとの線と、条件の留め点 ----
// mode: 'source'（原文のまま）／'work'（作業中：peel で削る文がはがれる）／'final'（最終稿）

function sheetGeometry(L, r, job, mode, peel) {
  const n = job.items.length;
  const m = job.keptCount;
  const inner = R(r.x + r.w * 0.17, r.y + r.h * 0.18, r.w * 0.68, r.h * 0.72);
  const k = mode === 'source' ? 0 : mode === 'final' ? 1 : clamp01(peel);
  const th = Math.max(1.4, Math.min((inner.h / n) * 0.5, L.u * 0.4));
  const rows = [];
  const anchors = new Map();
  for (const it of job.items) {
    const w = inner.w * (0.42 + 0.58 * (it.len / job.maxLen));
    const y0 = inner.y + (inner.h * (it.i + 0.5)) / n;
    if (it.kind === 'cut') {
      if (k >= 1) continue;
      rows.push({it, x: inner.x + k * r.w * 0.85, y: y0 - k * r.h * 0.12, w, th, alpha: 1 - k, rot: k * 0.35});
      continue;
    }
    const y = lerp(y0, inner.y + (inner.h * (it.j + 0.5)) / m, ease(k));
    rows.push({it, x: inner.x, y, w, th, alpha: 1, rot: 0});
    const dot = {x: inner.x - th * 2, y};
    for (const fid of it.facts) anchors.set(fid, dot);
  }
  return {r, rows, anchors, th};
}

function paintSheet(ctx, L, g, pal, o = {}) {
  const {r, th} = g;
  const fold = Math.min(r.w, r.h) * 0.24;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y);
  ctx.lineTo(r.x + r.w - fold, r.y);
  ctx.lineTo(r.x + r.w, r.y + fold);
  ctx.lineTo(r.x + r.w, r.y + r.h);
  ctx.lineTo(r.x, r.y + r.h);
  ctx.closePath();
  ctx.fillStyle = pal.card;
  ctx.fill();
  ctx.strokeStyle = o.stroke || pal.inkSoft;
  ctx.lineWidth = Math.max(1.1, L.u * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r.x + r.w - fold, r.y);
  ctx.lineTo(r.x + r.w - fold, r.y + fold);
  ctx.lineTo(r.x + r.w, r.y + fold);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  for (const row of g.rows) {
    const it = row.it;
    ctx.save();
    ctx.globalAlpha *= row.alpha;
    ctx.translate(row.x, row.y);
    if (row.rot) ctx.rotate(row.rot);
    ctx.fillStyle = it.kind === 'cut' ? pal.muted : pal.inkSoft;
    ctx.fillRect(0, -row.th / 2, row.w, row.th);
    const over = (color, a) => {
      if (a <= 0.003) return;
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.fillStyle = color;
      ctx.fillRect(-row.th * 0.4, -row.th * 0.9, row.w + row.th * 0.8, row.th * 1.8);
      ctx.restore();
    };
    if (it.kind === 'cut') over(pal.amberBright, o.markGlow || 0);
    if (it.kind === 'edit') {
      over(pal.amberBright, (o.lens || 0) * (1 - (o.rewrite || 0)));
      over(pal.petrol, o.rewrite || 0);
    }
    ctx.restore();
  }
  // 留め点：残す条件がある文の頭
  const sel = o.sel;
  const glow = o.glow || [];
  for (const row of g.rows) {
    if (row.it.kind === 'cut' || !row.it.facts.length) continue;
    const isSel = sel && row.it.facts.includes(sel);
    const isGlow = row.it.facts.some((f) => glow.includes(f)) && (o.glowK || 0) > 0;
    ctx.beginPath();
    ctx.arc(row.x - th * 2, row.y, th * (isSel || isGlow ? 1.25 : 0.95), 0, Math.PI * 2);
    ctx.fillStyle = isSel ? pal.amberBright : pal.petrol;
    ctx.fill();
  }
  ctx.restore();
}

function placeholderSheet(ctx, L, r, pal, a) {
  if (a <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.setLineDash([L.u * 0.25, L.u * 0.22]);
  ctx.strokeStyle = pal.muted;
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

// ---- 本：SKILL.md（6系統・26型と4つの手順） ----

function bookRect(L, p) {
  const z = ease(clamp01(p.bookZoom));
  return z > 0 ? lerpRect(L.book, L.bookZoom, z) : L.book;
}

// 本を大きく開いたときだけ、右のページに「How to work」の4手順を出す
function stepPageBox(L, p) {
  const {u} = L;
  const body = bodyOf(bookRect(L, p), u);
  if (body.w < u * 22 || p.stepsPage <= 0.003) return null;
  const famW = body.w * 0.56;
  return {famW, box: R(body.x + famW + u * 0.8, body.y, body.w - famW - u * 0.8, body.h)};
}
function stepRows(L, p) {
  const sp = stepPageBox(L, p);
  if (!sp) return null;
  const {box} = sp;
  const head = L.u * 1.3;
  const rh = (box.h - head) / 4;
  return [0, 1, 2, 3].map((k) => ({x: box.x + L.u * 1.05, y: box.y + head + rh * (k + 0.5), rh, box}));
}

function drawBook(ctx, L, p, d, pal, a) {
  if (a <= 0.003) return;
  const {u, fs} = L;
  const r = bookRect(L, p);
  ctx.save();
  ctx.globalAlpha *= a;
  panel(ctx, r, pal, {stroke: pal.petrol, width: Math.max(1.4, u * 0.1)});
  cardHead(ctx, L, r, 'SKILL.md', '指示書', pal, {family: 'mono', subColor: pal.petrol});
  const body = bodyOf(r, u);
  const sp = stepPageBox(L, p);
  const famBox = R(body.x, body.y, sp ? sp.famW : body.w, body.h);
  if (famBox.w >= u * 11 && famBox.h >= u * 5.2) drawFamilyRows(ctx, L, p, d, pal, famBox);
  else drawBookGlyph(ctx, L, p, d, pal, body);
  if (sp) {
    const rows = stepRows(L, p);
    ctx.save();
    ctx.globalAlpha *= clamp01(p.stepsPage * 2);
    ctx.strokeStyle = pal.line;
    ctx.beginPath();
    ctx.moveTo(sp.box.x - u * 0.4, sp.box.y);
    ctx.lineTo(sp.box.x - u * 0.4, sp.box.y + sp.box.h);
    ctx.stroke();
    drawText(ctx, 'How to work', sp.box.x, sp.box.y + fs.tiny, {size: fs.tiny, weight: 600, family: 'mono', color: pal.muted, max: sp.box.w});
    ctx.restore();
    const labels = ['mark', 'draft', 'check', 'final'].map((id) => d.parts.find((x) => x.id === id).label);
    rows.forEach((row, k) => {
      const ra = clamp01(p.stepsPage * 5 - k);
      if (ra <= 0) return;
      ctx.save();
      ctx.globalAlpha *= ra;
      ctx.beginPath();
      ctx.arc(row.x - u * 0.45, row.y, u * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = pal.petrol;
      ctx.fill();
      drawText(ctx, String(k + 1), row.x - u * 0.45, row.y + fs.tiny * 0.36, {size: fs.tiny, weight: 700, color: pal.onPetrol, align: 'center'});
      drawText(ctx, labels[k], row.x + u * 0.4, row.y + fs.small * 0.36, {size: fs.small, weight: 600, color: pal.ink, max: row.box.x + row.box.w - row.x - u * 0.4});
      ctx.restore();
    });
  }
  ctx.restore();
}

// 6系統を行で：見出しの色札・系統名・型の数だけの刻み
function drawFamilyRows(ctx, L, p, d, pal, box) {
  const {u, fs} = L;
  const rh = box.h / 6;
  const size = Math.min(fs.small, Math.max(fs.tiny, rh * 0.72));
  const tabW = Math.max(u * 1.3, size * 1.7);
  d.groups.forEach((g, i) => {
    const ra = clamp01(p.bookOpen * 7 - i);
    if (ra <= 0) return;
    const y = box.y + rh * i;
    const sel = p.family === g.id;
    ctx.save();
    ctx.globalAlpha *= ra;
    rr(ctx, box.x, y + rh * 0.1, tabW, rh * 0.8, Math.min(4, rh * 0.2));
    ctx.fillStyle = sel ? pal.amberBright : i % 2 ? pal.petrolMid : pal.petrol;
    ctx.fill();
    drawText(ctx, g.id, box.x + tabW / 2, y + rh * 0.5 + size * 0.36, {size, weight: 700, color: pal.onPetrol, align: 'center'});
    const tick = Math.max(2, u * 0.16);
    const step = Math.max(4, u * 0.34);
    const ticksW = g.sections.length * step;
    ctx.fillStyle = sel ? pal.amber : pal.petrol;
    g.sections.forEach((_, k) => ctx.fillRect(box.x + box.w - ticksW + k * step, y + rh * 0.24, tick, rh * 0.52));
    drawText(ctx, g.label, box.x + tabW + u * 0.4, y + rh * 0.5 + size * 0.36, {size, weight: sel ? 700 : 500, color: pal.ink, max: box.w - tabW - ticksW - u * 0.9});
    ctx.restore();
  });
}

// 小さいときの本：表紙と、型の数に比例した6つの見出し
function drawBookGlyph(ctx, L, p, d, pal, body) {
  const {u, fs} = L;
  const tabW = Math.max(u * 0.7, Math.min(u * 1.3, body.w * 0.14));
  const cover = R(body.x, body.y, body.w - tabW, body.h);
  rr(ctx, cover.x, cover.y, cover.w, cover.h, u * 0.3);
  ctx.fillStyle = pal.petrolSoft;
  ctx.fill();
  ctx.strokeStyle = pal.petrol;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = pal.petrol;
  ctx.fillRect(cover.x, cover.y, Math.max(3, u * 0.35), cover.h);
  let y = cover.y;
  d.groups.forEach((g, i) => {
    const h = (cover.h * g.sections.length) / 26;
    const sel = p.family === g.id;
    ctx.fillStyle = sel ? pal.amberBright : i % 2 ? pal.petrolMid : pal.petrol;
    ctx.fillRect(cover.x + cover.w, y + 0.5, tabW * clamp01(p.bookOpen * 7 - i), Math.max(1, h - 1));
    if (h >= fs.tiny * 1.05 && p.bookOpen > 0.9) drawText(ctx, g.id, cover.x + cover.w + tabW / 2, y + h / 2 + fs.tiny * 0.36, {size: fs.tiny, weight: 700, color: pal.onPetrol, align: 'center'});
    y += h;
  });
  const mx = cover.x + cover.w / 2 + u * 0.15;
  drawText(ctx, '26型', mx, cover.y + cover.h * 0.5, {size: fs.big, weight: 700, family: 'mincho', color: pal.ink, align: 'center', max: cover.w - u * 0.6});
  drawText(ctx, '6系統', mx, cover.y + cover.h * 0.5 + fs.tiny * 1.5, {size: fs.tiny, weight: 600, color: pal.petrol, align: 'center', max: cover.w - u * 0.6, drop: true});
  drawText(ctx, '4手順', mx, cover.y + cover.h * 0.5 + fs.tiny * 2.75, {size: fs.tiny, weight: 600, color: pal.petrol, align: 'center', max: cover.w - u * 0.6, drop: true});
}

// ---- 原文・読み手 ----

function drawPaperCard(ctx, L, p, d, pal, a) {
  if (a <= 0.003) return;
  const {u, fs} = L;
  const r = L.paper;
  const job = d.jobs[p.job];
  ctx.save();
  ctx.globalAlpha *= a;
  panel(ctx, r, pal);
  cardHead(ctx, L, r, '原文', job.language === 'ja' ? '日本語' : '英語', pal);
  paintSheet(ctx, L, sheetGeometry(L, L.srcSheet, job, 'source', 0), pal, {sel: p.selFact, glow: p.glowFacts, glowK: p.glowK});
  if (L.kind === 'wide') {
    const body = bodyOf(r, u);
    const tx = L.srcSheet.x + L.srcSheet.w + u * 0.8;
    const max = r.x + r.w - u * 0.55 - tx;
    const font = `400 ${fs.tiny}px ${FONT.sans}`;
    const cuts = job.items.filter((x) => x.kind === 'cut');
    const lines = [
      [fitHead(ctx, cuts[0].text, max, font), pal.muted, 400],
      [`事実の文 ${job.keptCount}`, pal.ink, 700],
      [fitHead(ctx, cuts[cuts.length - 1].text, max, font), pal.muted, 400],
    ];
    const lh = body.h / 3;
    lines.forEach(([s, color, weight], k) => {
      if (s) drawText(ctx, s, tx, body.y + lh * (k + 0.5) + fs.tiny * 0.36, {size: fs.tiny, weight, color, max});
    });
  }
  ctx.restore();
}

function drawReaderCard(ctx, L, p, d, pal, a) {
  if (a <= 0.003) return;
  const {u, fs} = L;
  const r = L.reader;
  const job = d.jobs[p.job];
  ctx.save();
  ctx.globalAlpha *= a;
  panel(ctx, r, pal);
  cardHead(ctx, L, r, '読み手', null, pal);
  const body = bodyOf(r, u);
  const side = r.w >= u * 8.5;
  const hr = u * 0.62;
  const hx = side ? body.x + u * 1.0 : cx(body);
  const hy = body.y + u * 0.8;
  ctx.fillStyle = pal.petrolMid;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx, hy + hr * 2.9, hr * 1.55, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  const known = job.known.length ? `既知の背景 ${job.known.length}件` : '既知の省略なし';
  let glowBox;
  if (side) {
    const tx = body.x + u * 2.4;
    const max = body.x + body.w - tx;
    drawText(ctx, job.readerTag, tx, body.y + u * 0.95, {size: fs.small, weight: 700, color: pal.petrol, max});
    drawText(ctx, known, tx, body.y + u * 2.15, {size: fs.tiny, color: pal.inkSoft, max});
    if (job.question && body.h >= u * 3.6) {
      const q = fitHead(ctx, `“${job.question}”`, body.w, `400 ${fs.tiny}px ${FONT.sans}`);
      if (q) drawText(ctx, q, body.x, body.y + u * 3.4, {size: fs.tiny, color: pal.ink});
    }
    glowBox = R(tx - u * 0.25, body.y - u * 0.15, max + u * 0.3, u * 1.45);
  } else {
    drawText(ctx, job.readerTag, cx(body), body.y + u * 4.0, {size: fs.tiny, weight: 700, color: pal.petrol, align: 'center', max: body.w});
    drawText(ctx, known, cx(body), body.y + u * 5.1, {size: fs.tiny, color: pal.inkSoft, align: 'center', max: body.w});
    glowBox = R(body.x - u * 0.1, body.y + u * 3.0, body.w + u * 0.2, u * 1.4);
  }
  ctx.restore();
  ring(ctx, glowBox, pal, a * p.readerGlow, u * 0.6);
}

// ---- 同じAIの作業台：印→初稿→点検→最終稿、点検から初稿へ戻る矢印、文の帯 ----

function drawAI(ctx, L, p, d, pal, a) {
  if (a <= 0.003) return;
  const {u, fs} = L;
  const r = L.ai;
  const job = d.jobs[p.job];
  ctx.save();
  ctx.globalAlpha *= a;
  rr(ctx, r.x, r.y, r.w, r.h, Math.min(16, u * 0.8));
  ctx.fillStyle = pal.petrolSoft;
  ctx.fill();
  ctx.strokeStyle = pal.petrol;
  ctx.lineWidth = Math.max(1.4, u * 0.11);
  ctx.stroke();
  const ty = r.y + u * 1.3;
  const tw = drawText(ctx, '同じAI', r.x + u * 0.8, ty, {size: fs.label, weight: 700, color: pal.petrol});
  drawText(ctx, '1つのAIが指示書の順に', r.x + u * 1.3 + tw, ty, {size: fs.tiny, color: pal.inkSoft, max: r.w - tw - u * 2.1, drop: true});
  const pos = p.sheetPos;
  const active = pos >= 0.5 && pos < 4.5 ? Math.round(pos) - 1 : -1;
  const labelA = p.stepsFly >= 0.999 ? 1 : 0;
  L.slots.forEach((s, k) => {
    const on = k === active;
    panel(ctx, s.r, pal, {fill: pal.card, stroke: on ? pal.petrol : pal.line, width: on ? Math.max(2, u * 0.14) : 1.1, radius: u * 0.5});
    placeholderSheet(ctx, L, s.sheet, pal, 0.5);
    drawText(ctx, `${k + 1} ${STEP_LABELS[k]}`, cx(s.r), s.ly, {size: fs.small, weight: 700, color: on ? pal.petrol : pal.ink, align: 'center', max: s.r.w - u * 0.3, alpha: labelA});
    if (k < 3) {
      arrow(ctx, [[s.r.x + s.r.w + u * 0.12, cy(s.sheet)], [L.slots[k + 1].r.x - u * 0.12, cy(s.sheet)]],
        {color: pal.inkSoft, width: Math.max(1.2, u * 0.09), head: Math.max(5, u * 0.34), alpha: 1});
    }
  });
  // 戻り矢印：点検で残りがあれば書き直しへ戻る。この例で残りがなければ破線で「残りなし」
  const rem = job.remaining.length;
  const head = Math.max(5.5, u * 0.38);
  if (rem) {
    arrow(ctx, L.loop, {color: pal.amber, width: Math.max(1.3, u * 0.1), head, alpha: 0.6});
    arrow(ctx, L.loop, {color: pal.amberBright, width: Math.max(2.2, u * 0.18), head: head * 1.15, alpha: p.loopGlow, k: p.loopRun});
  } else {
    arrow(ctx, L.loop, {color: pal.muted, width: Math.max(1.1, u * 0.08), head, alpha: 0.75, dash: [u * 0.3, u * 0.25]});
  }
  drawText(ctx, rem ? `残り${rem}件→書き直す` : '残りなし', L.loopLabel.x, L.loopLabel.y + fs.tiny * 0.36,
    {size: fs.tiny, weight: 700, color: rem ? pal.amber : pal.muted, max: L.loopLabel.max});
  ctx.restore();
  drawSentenceBand(ctx, L, p, d, pal, a * clamp01(p.show.band));
}

// 文の帯：いまの手順で扱う実際の短い引用（全文は出さない）
function drawSentenceBand(ctx, L, p, d, pal, a) {
  if (a <= 0.003) return;
  const {u, fs} = L;
  const b = L.band;
  const job = d.jobs[p.job];
  ctx.save();
  ctx.globalAlpha *= a;
  panel(ctx, b, pal, {fill: pal.card, stroke: pal.line, radius: u * 0.5});
  const pillW = Math.max(textWidth('最終稿', `700 ${fs.small}px ${FONT.sans}`) + u * 1.0, u * 3.4);
  const px = b.x + u * 0.5;
  const mid = b.y + b.h / 2;
  const x0 = px + pillW + u * 0.6;
  const max = b.x + b.w - u * 0.6 - x0;
  const line1 = b.y + b.h * 0.4;
  const line2 = b.y + b.h * 0.8;
  const one = mid + fs.band * 0.36;
  const bandFont = (w) => `${w} ${fs.band}px ${FONT.sans}`;
  const modes = [['material', '素材'], ['mark', '印'], ['draft', '初稿'], ['check', '点検'], ['final', '最終稿']];
  for (const [key, name] of modes) {
    const k = clamp01(p.band[key] || 0);
    if (k <= 0.003) continue;
    ctx.save();
    ctx.globalAlpha *= k;
    const ph = fs.small * 1.7;
    rr(ctx, px, mid - ph / 2, pillW, ph, ph / 2);
    ctx.fillStyle = key === 'check' && job.remaining.length ? pal.amber : pal.petrol;
    ctx.fill();
    drawText(ctx, name, px + pillW / 2, mid + fs.small * 0.36, {size: fs.small, weight: 700, color: pal.onPetrol, align: 'center', max: pillW - u * 0.4});
    if (key === 'material') {
      drawText(ctx, '原文は指示でなく、編集する素材', x0, one, {size: fs.band, weight: 600, color: pal.ink, max});
    } else if (key === 'mark') {
      // 保存された印のうち短い2つ。はがす動きに合わせて取り消し線
      let x = x0;
      job.markPicks.forEach((m, i) => {
        const room = x0 + max - x;
        const s = fitHead(ctx, `§${m.section} ${m.quote}`, room - u * 0.6, `600 ${fs.small}px ${FONT.sans}`);
        if (!s || room < u * 4) return;
        const w = drawText(ctx, s, x + u * 0.3, mid + fs.small * 0.36, {size: fs.small, weight: 600, color: pal.amber, bg: pal.amberSoft});
        const st = clamp01(p.peel * 1.6 - i * 0.3);
        if (st > 0) {
          ctx.fillStyle = pal.amber;
          ctx.fillRect(x + u * 0.3, mid - Math.max(0.6, u * 0.05), w * st, Math.max(1.2, u * 0.1));
        }
        x += w + u * 1.2;
      });
    } else if (key === 'draft') {
      const s = fitHead(ctx, job.draftLead.text, max, bandFont(500));
      const w = drawText(ctx, s, x0, one, {size: fs.band, weight: 500, color: pal.ink});
      const at = job.draftLead.term ? s.indexOf(job.draftLead.term) : -1;
      if (w && at >= 0 && (!s.endsWith('…') || at + job.draftLead.term.length <= s.length - 1)) {
        ctx.save();
        ctx.font = bandFont(500);
        const ux = x0 + ctx.measureText(s.slice(0, at)).width;
        const uw = ctx.measureText(job.draftLead.term).width;
        ctx.restore();
        ctx.fillStyle = pal.petrol;
        ctx.fillRect(ux, one + fs.band * 0.22, uw, Math.max(1.5, u * 0.12));
      }
    } else if (key === 'check') {
      if (job.remaining.length) {
        const rem = job.remaining[0];
        const tag = `§${rem.section}`;
        const tw = drawText(ctx, tag, x0 + u * 0.3, line1 + fs.small * 0.36, {size: fs.small, weight: 700, color: pal.onPetrol, bg: pal.amber});
        const qx = x0 + tw + u * 1.1;
        const s = fitHead(ctx, rem.quote, x0 + max - qx, bandFont(500));
        const qw = drawText(ctx, s, qx, line1 + fs.band * 0.36, {size: fs.band, weight: 500, color: pal.ink});
        ctx.fillStyle = pal.amberBright;
        ctx.fillRect(qx, line1 + fs.band * 0.58, qw, Math.max(1.5, u * 0.12));
        drawText(ctx, `読み手：${job.readerTag}`, x0, line2 + fs.tiny * 0.2, {size: fs.tiny, color: pal.inkSoft, max});
        if (p.lens > 0.003) {
          ctx.save();
          ctx.globalAlpha *= p.lens;
          ctx.strokeStyle = pal.amberBright;
          ctx.lineWidth = Math.max(2, u * 0.15);
          const lx = qx + u * 1.1;
          const lyy = line1;
          ctx.beginPath();
          ctx.arc(lx, lyy, u * 0.95, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(lx + u * 0.68, lyy + u * 0.68);
          ctx.lineTo(lx + u * 1.35, lyy + u * 1.35);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        drawText(ctx, '残りなし（追加修正なし）', x0, one, {size: fs.band, weight: 600, color: pal.ink, max});
      }
    } else if (key === 'final') {
      if (job.edit) {
        const before = fitHead(ctx, job.edit.before, max, `400 ${fs.tiny}px ${FONT.sans}`);
        const bw = drawText(ctx, before, x0, line1 - fs.tiny * 0.1, {size: fs.tiny, color: pal.muted});
        ctx.fillStyle = pal.muted;
        ctx.fillRect(x0, line1 - fs.tiny * 0.42, bw * clamp01(p.rewrite), Math.max(1, u * 0.07));
        const after = fitHead(ctx, job.edit.after, max, bandFont(700));
        drawText(ctx, after, x0, line2, {size: fs.band, weight: 700, color: pal.petrol, alpha: clamp01(p.rewrite)});
      } else {
        drawText(ctx, '初稿＝最終稿（追加修正なし）', x0, one, {size: fs.band, weight: 600, color: pal.ink, max});
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---- 出力：最終稿・読み比べ・推敲メモ ----

function drawFinalCard(ctx, L, p, d, pal, a) {
  if (a <= 0.003) return;
  const {u, fs} = L;
  const r = L.final;
  const job = d.jobs[p.job];
  const arrived = clamp01(p.sheetPos - 4);
  ctx.save();
  ctx.globalAlpha *= a;
  panel(ctx, r, pal, {stroke: arrived > 0.99 ? pal.petrol : pal.line, width: arrived > 0.99 ? 1.6 : 1.2});
  cardHead(ctx, L, r, '最終稿', job.same ? '初稿と同じ' : `点検で${job.remaining.length}か所`, pal);
  placeholderSheet(ctx, L, L.finSheet, pal, 0.6 * (1 - clamp01((p.sheetPos - 4.6) / 0.4)));
  if (L.kind === 'wide') {
    const body = bodyOf(r, u);
    const tx = L.finSheet.x + L.finSheet.w + u * 0.8;
    const max = r.x + r.w - u * 0.55 - tx;
    const al = 0.6 + 0.4 * arrived;
    const lead = fitHead(ctx, job.finalLead, max, `500 ${fs.tiny}px ${FONT.sans}`);
    if (lead) drawText(ctx, lead, tx, body.y + body.h * 0.35, {size: fs.tiny, weight: 500, color: pal.ink, alpha: al});
    drawText(ctx, `${job.keptCount}文・条件${job.facts.length}`, tx, body.y + body.h * 0.72, {size: fs.tiny, weight: 700, color: pal.petrol, max, alpha: al});
  }
  ctx.restore();
}

function drawCompareCard(ctx, L, p, d, pal, a) {
  if (a <= 0.003) return;
  const {u, fs} = L;
  const r = L.compare;
  const job = d.jobs[p.job];
  ctx.save();
  ctx.globalAlpha *= a;
  panel(ctx, r, pal);
  cardHead(ctx, L, r, '読み比べ', '採用の前に', pal);
  const gs = sheetGeometry(L, L.cmpSrc, job, 'source', 0);
  const gf = sheetGeometry(L, L.cmpFin, job, 'final', 1);
  // 条件の引用どうしを結ぶ線（文字列の対応。意味の保証ではない）
  for (const f of job.facts) {
    const s = gs.anchors.get(f.id);
    const t = gf.anchors.get(f.id);
    if (!s || !t) continue;
    const sel = f.id === p.selFact;
    arrow(ctx, [[L.cmpSrc.x + L.cmpSrc.w, s.y], [t.x, t.y]], {color: sel ? pal.amberBright : pal.petrol, width: sel ? Math.max(2, u * 0.15) : Math.max(1, u * 0.07), head: 0, noHead: true, alpha: sel ? 1 : 0.55, k: p.compare});
  }
  paintSheet(ctx, L, gs, pal, {sel: p.selFact});
  paintSheet(ctx, L, gf, pal, {sel: p.selFact, stroke: pal.petrol, rewrite: 1});
  drawText(ctx, '原文', cx(L.cmpSrc), L.cmpLabelY, {size: fs.tiny, color: pal.inkSoft, align: 'center', max: L.cmpSrc.w + u});
  drawText(ctx, '最終稿', cx(L.cmpFin), L.cmpLabelY, {size: fs.tiny, color: pal.petrol, weight: 700, align: 'center', max: L.cmpFin.w + u});
  ctx.restore();
}

function drawMemoCard(ctx, L, p, d, pal, a) {
  if (a <= 0.003) return;
  const {u, fs} = L;
  const r = L.memo;
  const f = L.memoFile;
  ctx.save();
  ctx.globalAlpha *= a;
  panel(ctx, r, pal);
  cardHead(ctx, L, r, '推敲メモ', '持ち帰る', pal);
  // 初稿・点検・最終稿の見出し（ファイルの上の小さな札）
  const tabColors = [pal.petrolSoft, pal.amberSoft, pal.petrol];
  const tw = f.w / 3;
  for (let k = 0; k < 3; k++) {
    const tk = clamp01(p.memoTabs * 3.5 - k * 0.8);
    if (tk <= 0) continue;
    ctx.fillStyle = tabColors[k];
    ctx.fillRect(f.x + k * tw + 1, f.y - u * 0.5 * tk, tw - 2, u * 0.5 * tk);
  }
  const fold = Math.min(f.w, f.h) * 0.24;
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.lineTo(f.x + f.w - fold, f.y);
  ctx.lineTo(f.x + f.w, f.y + fold);
  ctx.lineTo(f.x + f.w, f.y + f.h);
  ctx.lineTo(f.x, f.y + f.h);
  ctx.closePath();
  ctx.fillStyle = pal.card;
  ctx.fill();
  ctx.strokeStyle = pal.petrol;
  ctx.lineWidth = Math.max(1.3, u * 0.1);
  ctx.stroke();
  drawText(ctx, 'md', cx(f), f.y + f.h * 0.58, {size: Math.min(fs.label, f.w * 0.36), weight: 700, family: 'mono', color: pal.petrol, align: 'center'});
  const size = `${d.memo.bytes.toLocaleString('en-US')} B`;
  const name = d.memo.path.split('/').pop();
  if (L.kind === 'wide') {
    const body = bodyOf(r, u);
    const tx = f.x + f.w + u * 0.8;
    const max = r.x + r.w - u * 0.55 - tx;
    drawText(ctx, name, tx, body.y + body.h * 0.3, {size: fs.small, weight: 700, family: 'mono', color: pal.ink, max});
    drawText(ctx, `${size}・${JOB_IDS.length}件`, tx, body.y + body.h * 0.62, {size: fs.tiny, family: 'mono', color: pal.inkSoft, max});
    drawText(ctx, '初稿・点検・最終稿', tx, body.y + body.h * 0.94, {size: fs.tiny, color: pal.muted, max, alpha: clamp01(p.memoTabs)});
  } else {
    const body = bodyOf(r, u);
    drawText(ctx, name, cx(body), body.y + body.h - u * 0.1, {size: fs.tiny, weight: 600, family: 'mono', color: pal.ink, align: 'center', max: body.w});
  }
  ctx.restore();
}

// ---- 残す条件の札・留め線・動く1枚の紙 ----

function sheetRectAt(L, pos) {
  const stops = [L.srcSheet, ...L.slots.map((s) => s.sheet), L.finSheet];
  const x = Math.max(0, Math.min(5, pos));
  const i = Math.min(4, Math.floor(x));
  return lerpRect(stops[i], stops[i + 1], x - i);
}

function drawChipsAndSheet(ctx, L, p, d, pal, a) {
  const {u, fs, cm} = L;
  const job = d.jobs[p.job];
  const n = job.facts.length;
  const k = ease(clamp01(p.chipsTo));
  const prefer = [job.facts.findIndex((f) => f.id === p.selFact), ...job.facts.map((f, i) => (p.glowFacts.includes(f.id) ? i : -1))];
  const pa = placeChips(L.bandA, cm, n, prefer, L.maxRows);
  const pb = placeChips(L.bandB, cm, n, prefer, L.maxRows);
  const band = lerpRect(L.bandA, L.bandB, k);
  const pos = Math.max(0, Math.min(5, p.sheetPos));
  const moving = pos > 0.002;
  const geom = sheetGeometry(L, sheetRectAt(L, pos), job, moving ? 'work' : 'source', p.peel);
  const sheetA = pos <= 1 ? lerp(a.paper, a.ai, pos) : pos <= 4 ? a.ai : lerp(a.ai, a.final, pos - 4);
  const ca = a.chips;
  const pop = (i) => clamp01(p.chipsIn * (n + 2) - i);

  if (ca > 0.003) {
    ctx.save();
    ctx.globalAlpha *= ca;
    // 行き先と元の場所は破線で残す
    if (k < 0.999) panel(ctx, L.bandB, pal, {fill: 'rgba(0,0,0,0)', stroke: pal.muted, dash: [u * 0.25, u * 0.25], radius: u * 0.5, width: 1});
    if (k > 0.001) panel(ctx, L.bandA, pal, {fill: 'rgba(0,0,0,0)', stroke: pal.muted, dash: [u * 0.25, u * 0.25], radius: u * 0.5, width: 1});
    panel(ctx, band, pal, {fill: pal.card, stroke: pal.petrolMid, radius: u * 0.5, width: 1.3});
    drawText(ctx, '残す条件', band.x + cm.pad, band.y + cm.pad + cm.h / 2 + fs.small * 0.36, {size: fs.small, weight: 700, color: pal.ink});
    ctx.restore();
  }

  const chips = job.facts.map((f, i) => {
    const qa = pa.placed.get(i);
    const qb = pb.placed.get(i);
    if (qa && qb) return {f, i, q: {x: lerp(qa.x, qb.x, k), y: lerp(qa.y, qb.y, k), w: qa.w}, al: 1};
    if (qa) return {f, i, q: qa, al: 1 - k};
    if (qb) return {f, i, q: qb, al: k};
    return null;
  }).filter(Boolean);

  // 留め線：札 → いま紙がある場所の、その条件を含む文
  for (const c of chips) {
    const dot = geom.anchors.get(c.f.id);
    if (!dot) continue;
    const sel = c.f.id === p.selFact;
    const glow = p.glowFacts.includes(c.f.id) ? p.glowK : 0;
    const fx = c.q.x + c.q.w / 2;
    const fy = dot.y < c.q.y ? c.q.y : c.q.y + cm.h;
    ctx.save();
    ctx.globalAlpha *= Math.min(ca, sheetA) * c.al * pop(c.i) * (sel ? 0.95 : lerp(0.3, 0.85, glow));
    ctx.strokeStyle = sel ? pal.amberBright : pal.petrol;
    ctx.lineWidth = sel ? Math.max(1.6, u * 0.13) : Math.max(1, u * 0.07 + glow * u * 0.05);
    if (!sel && glow < 0.5) ctx.setLineDash([u * 0.2, u * 0.2]);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(dot.x, dot.y);
    ctx.stroke();
    ctx.restore();
  }

  if (moving) {
    paintSheet(ctx, L, geom, pal, {alpha: sheetA, markGlow: p.markGlow, lens: p.lens, rewrite: p.rewrite, sel: p.selFact, glow: p.glowFacts, glowK: p.glowK, stroke: pos >= 4.5 ? pal.petrol : pal.inkSoft});
  }

  for (const c of chips) {
    const pk = pop(c.i);
    if (pk <= 0.003 || ca <= 0.003) continue;
    const sel = c.f.id === p.selFact;
    const glow = p.glowFacts.includes(c.f.id) ? p.glowK : 0;
    ctx.save();
    ctx.globalAlpha *= ca * c.al * pk;
    rr(ctx, c.q.x, c.q.y, c.q.w, cm.h, cm.h / 2);
    ctx.fillStyle = sel ? pal.amberSoft : glow > 0.5 ? pal.petrolSoft : pal.card;
    ctx.fill();
    ctx.strokeStyle = sel ? pal.amberBright : pal.petrol;
    ctx.lineWidth = sel || glow > 0.5 ? Math.max(2, u * 0.14) : 1.2;
    ctx.stroke();
    drawText(ctx, c.f.term, c.q.x + c.q.w / 2, c.q.y + cm.h / 2 + fs.chip * 0.36, {size: fs.chip, weight: 600, color: sel ? pal.ink : pal.petrol, align: 'center', max: c.q.w - u * 0.5});
    ctx.restore();
  }
  for (const [more, al] of [[pa.more, 1 - k], [pb.more, k]]) {
    if (!more || al * ca <= 0.003) continue;
    ctx.save();
    ctx.globalAlpha *= al * ca * clamp01(p.chipsIn * 2);
    rr(ctx, more.x, more.y, more.w, cm.h, cm.h / 2);
    ctx.strokeStyle = pal.muted;
    ctx.lineWidth = 1;
    ctx.stroke();
    drawText(ctx, `+${more.n}`, more.x + more.w / 2, more.y + cm.h / 2 + fs.chip * 0.36, {size: fs.chip, weight: 600, color: pal.muted, align: 'center'});
    ctx.restore();
  }
}

// 図解動画の冒頭：本の4手順が、同じAIの4つの枠へ移る
function drawStepsFly(ctx, L, p, pal) {
  const k = p.stepsFly;
  if (k <= 0.001 || k >= 0.999) return;
  const {u, fs} = L;
  const rows = stepRows(L, p);
  const br = bookRect(L, p);
  L.slots.forEach((s, i) => {
    const q = ease(clamp01(k * 1.6 - i * 0.2));
    if (q <= 0) return;
    const from = rows ? rows[i] : {x: cx(br), y: cy(br)};
    const x = lerp(from.x, cx(s.r), q);
    const y = lerp(from.y, s.ly - fs.small * 0.36, q) - Math.sin(Math.PI * q) * u * 1.5;
    drawText(ctx, `${i + 1} ${STEP_LABELS[i]}`, x, y + fs.small * 0.36, {size: fs.small, weight: 700, color: pal.onPetrol, bg: pal.petrol, align: 'center'});
  });
}

// ---- 線・下書き・強調 ----

function drawLinks(ctx, L, p, pal, a) {
  const {u, fs} = L;
  const lk = L.links;
  const pk = p.links;
  const line = {color: pal.inkSoft, width: Math.max(1.3, u * 0.09), head: Math.max(6, u * 0.42)};
  arrow(ctx, lk.instr, {...line, color: pal.petrol, width: Math.max(1.8, u * 0.13), alpha: Math.min(a.book, a.ai), k: pk.instr});
  arrow(ctx, lk.paperIn, {...line, alpha: Math.min(a.paper, a.ai), k: pk.paperIn});
  arrow(ctx, lk.readerIn, {...line, alpha: Math.min(a.reader, a.ai), k: pk.readerIn});
  arrow(ctx, lk.bandIn, {...line, alpha: Math.min(a.chips, a.ai), k: pk.bandIn});
  arrow(ctx, lk.out, {...line, alpha: Math.min(a.ai, a.final), k: pk.out});
  arrow(ctx, lk.finalToCompare, {...line, alpha: Math.min(a.final, a.compare), k: pk.finalToCompare});
  arrow(ctx, lk.compareToMemo, {...line, alpha: Math.min(a.compare, a.memo), k: pk.compareToMemo});
  const il = lk.instrLabel;
  drawText(ctx, '指示', il.x, il.y, {size: fs.tiny, weight: 700, color: pal.petrol, align: il.align, bg: pal.paper, alpha: Math.min(a.book, a.ai) * clamp01(pk.instr * 2 - 1)});
  const ml = lk.materialLabel;
  drawText(ctx, '素材', ml.x, ml.y, {size: fs.tiny, weight: 700, color: pal.inkSoft, align: ml.align, bg: pal.paper, alpha: Math.min(a.paper, a.ai) * clamp01(pk.paperIn * 2 - 1)});
}

// 点検：初稿を原文と読み手に照らす破線
function drawRefs(ctx, L, p, pal, a) {
  if (p.refs <= 0.003 || a <= 0.003) return;
  for (const pts of L.links.refs) {
    arrow(ctx, pts, {color: pal.amber, width: Math.max(1.2, L.u * 0.09), head: 0, noHead: true, dash: [L.u * 0.3, L.u * 0.22], alpha: a * p.refs});
  }
}

function drawSkeleton(ctx, L, pal, a) {
  if (a <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.strokeStyle = pal.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([L.u * 0.25, L.u * 0.25]);
  for (const r of [L.paper, L.reader, L.bandA, L.ai, L.final, L.compare, L.memo, ...L.slots.map((s) => s.r)]) {
    rr(ctx, r.x, r.y, r.w, r.h, Math.min(12, r.h * 0.12));
    ctx.stroke();
  }
  ctx.restore();
}

function partRects(L, p) {
  switch (p.part) {
    case 'manual': return [bookRect(L, p)];
    case 'input': return [L.paper, L.reader, lerpRect(L.bandA, L.bandB, ease(clamp01(p.chipsTo)))];
    case 'mark': return [L.slots[0].r];
    case 'draft': return [L.slots[1].r];
    case 'check': return [L.slots[2].r];
    case 'final': return [L.slots[3].r, L.final];
    default: return [];
  }
}

// p は restingParams() と同じ形。ページの3段階も、図解動画の各時刻も、この同じ図を描く。
export function drawDiagram(ctx, L, p, d, pal) {
  const A = (key) => clamp01(p.show[key]) * clamp01(p.emph[key] ?? 1);
  const a = {book: A('book'), paper: A('paper'), reader: A('reader'), chips: A('chips'), ai: A('ai'), final: A('final'), compare: A('compare'), memo: A('memo')};
  ctx.save();
  drawSkeleton(ctx, L, pal, p.ghost);
  drawLinks(ctx, L, p, pal, a);
  drawRefs(ctx, L, p, pal, Math.min(a.ai, a.paper));
  const zoomed = p.bookZoom > 0.001;
  if (!zoomed) drawBook(ctx, L, p, d, pal, a.book);
  drawPaperCard(ctx, L, p, d, pal, a.paper);
  drawReaderCard(ctx, L, p, d, pal, a.reader);
  drawAI(ctx, L, p, d, pal, a.ai);
  drawFinalCard(ctx, L, p, d, pal, a.final);
  drawCompareCard(ctx, L, p, d, pal, a.compare);
  drawMemoCard(ctx, L, p, d, pal, a.memo);
  drawChipsAndSheet(ctx, L, p, d, pal, a);
  if (zoomed) drawBook(ctx, L, p, d, pal, a.book);
  drawStepsFly(ctx, L, p, pal);
  for (const r of partRects(L, p)) ring(ctx, r, pal, p.partGlow, L.u);
  ctx.restore();
}

// ---------- 作例ページ ----------

const THEME_KEY = 'studio-yebisu.humanizer-example.theme';
const STAGE_NAMES = {pass: '渡す', revise: '推敲', compare: '読み比べ'};
const STAGE_EMPH = {
  pass: {book: 1, paper: 1, reader: 1, chips: 1, ai: 0.76, final: 0.72, compare: 0.72, memo: 0.72},
  revise: {book: 0.8, paper: 0.82, reader: 0.82, chips: 0.88, ai: 1, final: 0.72, compare: 0.72, memo: 0.72},
  compare: {book: 0.72, paper: 0.86, reader: 0.72, chips: 1, ai: 0.78, final: 1, compare: 1, memo: 1},
};
const STAGE_REST = {
  pass: {sheetPos: 0, peel: 0, rewrite: 0, chipsTo: 0, compare: 0, band: 'material'},
  revise: {sheetPos: 4, peel: 1, rewrite: 1, chipsTo: 0, compare: 0, band: 'final'},
  compare: {sheetPos: 5, peel: 1, rewrite: 1, chipsTo: 1, compare: 1, band: 'final'},
};
const oneHot = (key) => ({material: 0, mark: 0, draft: 0, check: 0, final: 0, [key]: 1});
const mixBand = (a, b, k) => Object.fromEntries(Object.keys(b).map((key) => [key, lerp(a[key] ?? 0, b[key], k)]));

function bootPage() {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const els = {
    figure: $('diagram-figure'), canvas: $('diagram'), caption: $('diagram-caption'),
    stages: [...document.querySelectorAll('[data-stage]')], replay: $('replay'),
    save: $('save-memo'), saveMeta: $('save-meta'), desk: $('open-desk'),
    status: $('load-status'), retry: $('retry'),
    cases: [...document.querySelectorAll('[data-case]')],
    caseTitle: $('case-title'), casePurpose: $('case-purpose'), caseReader: $('case-reader'), caseKnown: $('case-known'),
    factButtons: $('fact-buttons'), factHead: $('fact-head'), factSource: $('fact-source'), factFinal: $('fact-final'), factNote: $('fact-note'),
    remaining: $('case-remaining'), omissions: $('case-omissions'), explain: $('case-explain'),
    finalText: $('final-text'), copyFinal: $('copy-final'), finalStatus: $('final-status'),
    deskCompare: $('desk-compare'), deskDraft: $('desk-draft'), jsonLink: $('json-data'),
    parts: [...document.querySelectorAll('[data-part]')], partLabel: $('part-label'), partMeaning: $('part-meaning'), partQuote: $('part-quote'), partSource: $('part-source'),
    families: [...document.querySelectorAll('[data-family]')], familyTitle: $('family-title'), familyNote: $('family-note'), familyList: $('family-list'), familyMarks: $('family-marks'),
    request: $('request-text'), copyRequest: $('copy-request'), copyStatus: $('copy-status'),
    themes: [...document.querySelectorAll('[data-theme-choice]')],
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const ctx = els.canvas.getContext('2d');
  const hashJob = () => {
    let raw = location.hash.slice(1);
    try { raw = decodeURIComponent(raw); } catch { /* そのまま */ }
    return JOB_IDS.includes(raw) ? raw : null;
  };
  const ui = {
    data: null, layout: null, stage: 'pass', job: hashJob() || 'release', fact: null,
    part: 'manual', partActive: false, family: 'A', familyActive: false,
    anim: null, from: null, last: restingParams('release'), raf: 0, controller: null, dpr: 1,
  };

  // ----- 表示の色 -----
  const readTheme = () => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
    } catch {
      return 'system';
    }
  };
  const palette = () => {
    const t = root.dataset.theme;
    return PALETTES[t === 'dark' || (t !== 'light' && darkQuery.matches) ? 'dark' : 'light'];
  };
  function applyTheme(value, persist) {
    root.dataset.theme = value;
    for (const b of els.themes) b.setAttribute('aria-pressed', String(b.dataset.themeChoice === value));
    if (persist) {
      try { localStorage.setItem(THEME_KEY, value); } catch { /* 保存できなくても表示は切り替える */ }
    }
    draw();
  }
  for (const b of els.themes) b.addEventListener('click', () => applyTheme(b.dataset.themeChoice, true));
  darkQuery.addEventListener?.('change', () => draw());

  // ----- 図の段階と動き（自動では1回だけ。もう一度はボタンで） -----
  const job = () => ui.data.jobs[ui.job];
  const animLength = () => {
    if (!ui.anim) return 0;
    if (ui.stage === 'pass') return 1.5;
    if (ui.stage === 'compare') return 2.4;
    return job().remaining.length ? 6.0 : 4.4;
  };
  const snapshot = (p) => ({emph: {...p.emph}, sheetPos: p.sheetPos, peel: p.peel, rewrite: p.rewrite, chipsTo: p.chipsTo, compare: p.compare, band: {...p.band}});

  function pageParams(now) {
    const p = restingParams(ui.job);
    const rest = STAGE_REST[ui.stage];
    const target = STAGE_EMPH[ui.stage];
    const anim = ui.anim;
    const e = anim ? Math.max(0, (now - anim.t0) / 1000) : Infinity;
    const from = ui.from;
    const k = ease(clamp01(e / 0.6));
    for (const key of Object.keys(p.emph)) p.emph[key] = from ? lerp(from.emph[key], target[key], k) : target[key];
    Object.assign(p, {sheetPos: rest.sheetPos, peel: rest.peel, rewrite: rest.rewrite, chipsTo: rest.chipsTo, compare: rest.compare, band: oneHot(rest.band)});
    p.selFact = ui.fact;
    p.part = ui.partActive ? ui.part : null;
    p.partGlow = 1;
    p.family = ui.familyActive ? ui.family : null;
    if (!anim || !Number.isFinite(e) || e >= animLength() || !from) return p;
    if (ui.stage === 'pass') {
      const m = ease(clamp01(e / 0.8));
      for (const key of ['sheetPos', 'peel', 'rewrite', 'chipsTo', 'compare']) p[key] = lerp(from[key], rest[key], m);
      p.band = mixBand(from.band, oneHot('material'), clamp01(e / 0.5));
      p.links.instr = prog(e, 0, 0.7);
      p.links.paperIn = prog(e, 0.2, 0.9);
      p.links.readerIn = prog(e, 0.35, 1.05);
      p.links.bandIn = prog(e, 0.6, 1.3);
      p.chipsIn = prog(e, 0.3, 1.3);
    } else if (ui.stage === 'revise') {
      // 保存結果の順：印 → 初稿 → 点検 →（残りがあれば初稿へ戻って書き直す）→ 最終稿
      const rem = job().remaining.length > 0;
      p.sheetPos = steps(e, 0, rem
        ? [[0.2, 1, 0.7], [2.0, 2, 0.6], [2.6, 3, 0.6], [3.9, 2, 0.6], [4.9, 4, 0.8]]
        : [[0.2, 1, 0.7], [2.0, 2, 0.6], [2.6, 3, 0.6], [3.5, 4, 0.6]]);
      p.markGlow = easeOut(prog(e, 0.8, 1.2));
      p.peel = ease(prog(e, 1.3, 2.0));
      p.refs = span(e, 2.7, 3.0, 3.9, 4.3);
      p.lens = rem ? span(e, 2.9, 3.2, 4.4, 4.8) : 0;
      p.readerGlow = rem ? span(e, 3.0, 3.3, 4.2, 4.6) : 0;
      p.loopGlow = rem ? span(e, 3.4, 3.7, 4.6, 5.0) : 0;
      p.loopRun = prog(e, 3.4, 4.0);
      p.rewrite = rem ? ease(prog(e, 4.3, 4.9)) : 0;
      const w = (s, t) => Math.min(easeOut(prog(e, s, s + 0.3)), 1 - ease(prog(e, t, t + 0.3)));
      const fin = rem ? 4.3 : 3.4;
      p.band = {material: 1 - prog(e, 0, 0.3), mark: w(0.6, 1.9), draft: w(1.9, 2.6), check: w(2.6, fin), final: easeOut(prog(e, fin, fin + 0.3))};
      p.chipsTo = lerp(from.chipsTo, 0, ease(clamp01(e / 0.6)));
      p.compare = lerp(from.compare, 0, ease(clamp01(e / 0.6)));
    } else {
      p.sheetPos = lerp(from.sheetPos, 5, ease(clamp01(e / 0.8)));
      p.peel = lerp(from.peel, 1, ease(clamp01(e / 0.4)));
      p.rewrite = lerp(from.rewrite, 1, ease(clamp01(e / 0.4)));
      p.chipsTo = lerp(from.chipsTo, 1, ease(prog(e, 0.3, 1.1)));
      p.memoTabs = easeOut(prog(e, 0.9, 1.5));
      p.compare = lerp(Math.min(from.compare, 0), 1, ease(prog(e, 1.2, 2.2)));
      p.links.finalToCompare = prog(e, 0.8, 1.3);
      p.links.compareToMemo = prog(e, 1.3, 1.8);
      p.band = mixBand(from.band, oneHot('final'), clamp01(e / 0.5));
    }
    return p;
  }

  function draw(now = performance.now()) {
    const L = ui.layout;
    if (!ui.data || !L) return;
    const p = pageParams(now);
    ui.last = p;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.setTransform(ui.dpr, 0, 0, ui.dpr, 0, 0);
    drawDiagram(ctx, L, p, ui.data, palette());
  }

  function startAnim(from) {
    ui.from = from || snapshot(ui.last);
    ui.anim = {t0: reduce.matches ? -Infinity : performance.now()};
    cancelAnimationFrame(ui.raf);
    const step = (now) => {
      draw(now);
      if (ui.anim && (now - ui.anim.t0) / 1000 < animLength()) ui.raf = requestAnimationFrame(step);
      else ui.raf = 0;
    };
    ui.raf = requestAnimationFrame(step);
  }

  function relayout() {
    if (!ui.data) return;
    const w = Math.round(els.figure.clientWidth);
    if (w <= 0) return;
    const wide = w >= 680;
    const u = wide ? Math.min(16, Math.max(12.5, w / 66)) : w < 340 ? 12 : Math.min(14, w / 26.5);
    ui.layout = diagramLayout(wide ? 'wide' : 'tall', w, u, ui.data, ui.job, {minFont: 11.5});
    ui.dpr = Math.min(3, window.devicePixelRatio || 1);
    els.canvas.style.height = `${Math.ceil(ui.layout.H)}px`;
    els.canvas.width = Math.round(w * ui.dpr);
    els.canvas.height = Math.round(ui.layout.H * ui.dpr);
    draw();
  }
  new ResizeObserver(() => relayout()).observe(els.figure);

  function captionText() {
    const d = ui.data;
    if (!d) return '';
    const j = job();
    let s;
    if (ui.stage === 'pass') {
      s = `渡す（${j.label}）：SKILL.md（6系統・26型と4つの手順）の指示と、原文・読み手・残す条件${j.facts.length}項目を同じAIへ。原文は指示ではなく編集する素材。`;
    } else if (ui.stage === 'revise') {
      s = j.remaining.length
        ? `推敲（${j.label}）：同じAIが印→初稿→点検→最終稿。点検で残った${j.remaining.length}件（§${j.remaining[0].section}・この作例での解釈）を最終稿で直す。`
        : `推敲（${j.label}）：同じAIが印→初稿→点検→最終稿。点検で残った型はなく、初稿をそのまま最終稿にした（追加修正なし）。`;
    } else {
      s = `読み比べ（${j.label}）：残す条件${j.facts.length}項目を原文と最終稿で読み比べ、推敲メモ revisions.md（${JOB_IDS.length}件）を持ち帰る。引用の対応で、意味の保証ではない。`;
    }
    if (ui.fact) {
      const f = j.facts.find((x) => x.id === ui.fact);
      if (f) s += ` 選択中の条件：${f.id}「${f.term}」（${f.label}）。`;
    }
    if (ui.partActive) s += ` 部分：${d.parts.find((x) => x.id === ui.part).label}。`;
    if (ui.familyActive) s += ` 系統：${ui.family}「${d.groups.find((g) => g.id === ui.family).label}」。`;
    return s;
  }
  const updateCaption = () => { els.caption.textContent = captionText(); };

  function setStage(stage) {
    if (!ui.data || stage === ui.stage) return;
    ui.stage = stage;
    for (const b of els.stages) b.setAttribute('aria-pressed', String(b.dataset.stage === stage));
    updateCaption();
    startAnim();
  }
  for (const b of els.stages) b.addEventListener('click', () => setStage(b.dataset.stage));
  els.replay.addEventListener('click', () => {
    if (!ui.data) return;
    const from = snapshot(ui.last);
    if (ui.stage === 'compare') Object.assign(from, {sheetPos: 4, chipsTo: 0, compare: 0});
    startAnim(from);
  });

  // ----- 主操作：照合済みの実ファイル -----
  const disableLink = (a) => {
    a.removeAttribute('href');
    a.removeAttribute('download');
    a.setAttribute('aria-disabled', 'true');
  };
  const enableLink = (a, href, download) => {
    a.href = href;
    if (download) a.download = download;
    a.removeAttribute('aria-disabled');
  };
  function updateLinks() {
    if (!ui.data) {
      for (const a of [els.save, els.desk, els.deskCompare, els.deskDraft, els.jsonLink]) disableLink(a);
      els.saveMeta.textContent = '';
      return;
    }
    const d = ui.data;
    enableLink(els.save, d.memo.path, d.memo.download);
    els.saveMeta.textContent = `${d.memo.path}・${d.memo.bytes.toLocaleString('en-US')} B・3件入り・SHA-256照合済み`;
    enableLink(els.desk, `desk.html#${ui.job}`);
    enableLink(els.deskCompare, `desk.html#${ui.job}`);
    enableLink(els.deskDraft, `desk.html#${ui.job}`);
    enableLink(els.jsonLink, d.json.path, d.json.download);
  }

  // ----- 3件と残す条件 -----
  const quote = (s, lang) => {
    const q = document.createElement('q');
    q.lang = lang;
    q.textContent = s;
    return q;
  };
  function renderCase() {
    const j = job();
    const lang = j.language;
    for (const b of els.cases) b.setAttribute('aria-pressed', String(b.dataset.case === ui.job));
    els.caseTitle.textContent = `${j.label}（${lang === 'ja' ? '日本語' : '英語'}）`;
    els.casePurpose.textContent = j.purpose;
    els.caseReader.textContent = j.readerContext;
    if (j.known.length) {
      const ul = document.createElement('ul');
      ul.className = 'plain';
      for (const k of j.known) {
        const li = document.createElement('li');
        li.append(quote(k, lang));
        ul.append(li);
      }
      els.caseKnown.replaceChildren(ul);
    } else {
      els.caseKnown.textContent = 'なし（読み手欄に既知の背景の明記がないため、背景は省いていません）';
    }
    els.factButtons.replaceChildren(...j.facts.map((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fact';
      b.dataset.fact = f.id;
      b.setAttribute('aria-pressed', String(f.id === ui.fact));
      const label = document.createElement('span');
      label.className = 'fact-label';
      label.textContent = f.label;
      const term = document.createElement('span');
      term.className = 'fact-term';
      term.lang = lang;
      term.textContent = f.term;
      b.append(label, term);
      b.addEventListener('click', () => selectFact(ui.fact === f.id ? null : f.id));
      return b;
    }));
    renderFact();
    if (j.remaining.length) {
      const ol = document.createElement('ol');
      ol.className = 'plain';
      for (const rem of j.remaining) {
        const li = document.createElement('li');
        const head = document.createElement('p');
        head.className = 'tag-line';
        head.textContent = `§${rem.section} ${rem.title}`;
        const q = document.createElement('p');
        q.append(quote(rem.quote, lang));
        const reason = document.createElement('p');
        reason.className = 'note';
        reason.textContent = rem.reason;
        const disclose = document.createElement('p');
        disclose.className = 'note';
        disclose.textContent = 'この1件を§26（F系統）に当てたのは元の制作AIの解釈です。原典がこの言い換えを例に挙げているわけではなく、三人称が常に誤りという規則でもありません。';
        li.append(head, q, reason, disclose);
        ol.append(li);
      }
      els.remaining.replaceChildren(ol);
    } else {
      const p = document.createElement('p');
      p.textContent = '点検で残った型：なし。初稿をそのまま最終稿にしました（追加修正なし）。';
      els.remaining.replaceChildren(p);
    }
    if (j.omissions.length) {
      const ul = document.createElement('ul');
      ul.className = 'plain';
      for (const o of j.omissions) {
        const li = document.createElement('li');
        const q = document.createElement('p');
        q.append(quote(o.quote, lang));
        const reason = document.createElement('p');
        reason.className = 'note';
        reason.textContent = o.reason;
        li.append(q, reason);
        ul.append(li);
      }
      els.omissions.replaceChildren(ul);
    } else {
      els.omissions.textContent = 'なし';
    }
    els.explain.textContent = j.explanation;
    els.finalText.value = j.final;
    els.finalText.lang = lang;
    els.finalStatus.textContent = '';
  }

  function renderFact() {
    const j = job();
    for (const b of els.factButtons.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.fact === ui.fact));
    const f = j.facts.find((x) => x.id === ui.fact);
    if (!f) {
      els.factHead.textContent = '条件を選ぶと、原文と最終稿の引用が並びます。';
      for (const node of [els.factSource, els.factFinal, els.factNote]) node.replaceChildren();
      return;
    }
    els.factHead.textContent = `${f.id}・${f.label}`;
    els.factSource.replaceChildren(quote(f.source, j.language));
    els.factFinal.replaceChildren(quote(f.final, j.language));
    els.factNote.textContent = f.note;
  }

  function selectFact(id) {
    if (!ui.data) return;
    ui.fact = id;
    renderFact();
    updateCaption();
    draw();
  }

  function selectJob(id, {updateHash = false} = {}) {
    if (!ui.data || !JOB_IDS.includes(id)) return;
    const changed = id !== ui.job;
    ui.job = id;
    if (changed) ui.fact = null;
    if (updateHash && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    renderCase();
    updateLinks();
    updateCaption();
    relayout();
    if (changed) startAnim();
  }
  for (const b of els.cases) b.addEventListener('click', () => selectJob(b.dataset.case, {updateHash: true}));
  window.addEventListener('hashchange', () => { const id = hashJob(); if (id) selectJob(id); });

  // ----- 6つの部分 -----
  function renderPart() {
    const part = ui.data.parts.find((x) => x.id === ui.part);
    for (const b of els.parts) b.setAttribute('aria-pressed', String(b.dataset.part === ui.part));
    els.partLabel.textContent = part.label;
    els.partMeaning.textContent = part.meaning;
    els.partQuote.textContent = part.quote;
    const local = document.createElement('a');
    local.href = part.path;
    local.textContent = `${part.path}・${part.line}行目`;
    const nodes = [local];
    if (part.upstream) {
      const up = document.createElement('a');
      up.href = part.upstream;
      up.rel = 'noopener';
      up.textContent = '固定版をGitHubで開く';
      nodes.push(document.createTextNode(' ／ '), up);
    }
    els.partSource.replaceChildren(...nodes);
  }
  for (const b of els.parts) {
    b.addEventListener('click', () => {
      if (!ui.data) return;
      ui.part = b.dataset.part;
      ui.partActive = true;
      renderPart();
      updateCaption();
      draw();
    });
  }

  // ----- 6系統・26型 -----
  function renderFamily() {
    const d = ui.data;
    const g = d.groups.find((x) => x.id === ui.family);
    for (const b of els.families) b.setAttribute('aria-pressed', String(b.dataset.family === ui.family));
    els.familyTitle.textContent = `${g.id}. ${g.label}（§${g.sections[0].n}${g.sections.length > 1 ? `–${g.sections[g.sections.length - 1].n}` : ''}）`;
    const notes = [`原典の見出し：${g.heading}（SKILL.md ${g.line}行目）`];
    if (g.id === 'A') notes.push(`§1〜5は1回見つけただけでも見直す対象です（SKILL.md ${d.strongLine}行目）。`);
    if (g.sections.some((s) => s.weak)) notes.push('「単独では弱い」型は、同じ箇所にほかの型がそろったときに扱います。一語だけで一律に削りません。');
    els.familyNote.textContent = notes.join(' ');
    els.familyList.replaceChildren(...g.sections.map((s) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = s.upstream;
      a.rel = 'noopener';
      a.lang = 'en';
      a.textContent = `§${s.n} ${s.title}`;
      li.append(a);
      if (s.weak) {
        const tag = document.createElement('span');
        tag.className = 'weak';
        tag.textContent = '単独では弱い';
        li.append(' ', tag);
      }
      return li;
    }));
    if (g.marks.length) {
      const ul = document.createElement('ul');
      ul.className = 'plain';
      for (const m of g.marks) {
        const li = document.createElement('li');
        li.append(`${m.label}・§${m.section} `, quote(m.quote, d.jobs[m.job].language));
        ul.append(li);
      }
      els.familyMarks.replaceChildren(ul);
    } else {
      els.familyMarks.textContent = 'この作例の保存結果には、この系統の印はありません。';
    }
  }
  for (const b of els.families) {
    b.addEventListener('click', () => {
      if (!ui.data) return;
      ui.family = b.dataset.family;
      ui.familyActive = true;
      renderFamily();
      updateCaption();
      draw();
    });
  }

  // ----- コピー（保存済みの文字列そのもの。失敗したら選択して手でコピー） -----
  async function copyText(text, area, status, done) {
    status.textContent = '';
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = done;
        return;
      } catch { /* 下の方法へ */ }
    }
    area.focus();
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    status.textContent = ok ? done : 'コピーできませんでした。選択した文を長押ししてコピーしてください。';
  }
  els.copyFinal.addEventListener('click', () => { if (ui.data) copyText(job().final, els.finalText, els.finalStatus, '最終稿をコピーしました。'); });
  els.copyRequest.addEventListener('click', () => { if (ui.data) copyText(ui.data.request, els.request, els.copyStatus, '依頼文をコピーしました。'); });

  // ----- 読み込み・失敗・再試行 -----
  const controls = () => [...els.stages, els.replay, ...els.cases, ...els.parts, ...els.families, els.copyFinal, els.copyRequest];
  function clearAll() {
    ui.data = null;
    ui.layout = null;
    ui.anim = null;
    ui.from = null;
    cancelAnimationFrame(ui.raf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    els.canvas.width = 0;
    els.canvas.height = 0;
    els.canvas.style.height = '';
    els.caption.textContent = '';
    for (const node of [els.caseTitle, els.casePurpose, els.caseReader, els.caseKnown, els.factHead, els.factSource, els.factFinal, els.factNote,
      els.remaining, els.omissions, els.explain, els.partLabel, els.partMeaning, els.partQuote, els.partSource,
      els.familyTitle, els.familyNote, els.familyList, els.familyMarks, els.finalStatus, els.copyStatus]) node.replaceChildren();
    els.factButtons.replaceChildren();
    els.finalText.value = '';
    els.request.value = '';
    for (const c of controls()) c.disabled = true;
    updateLinks();
  }

  function setState(state, message) {
    root.dataset.state = state;
    els.status.textContent = message;
    els.status.classList.toggle('is-error', state === 'error');
    els.retry.hidden = state !== 'error';
  }

  async function load() {
    ui.controller?.abort();
    const controller = new AbortController();
    ui.controller = controller;
    clearAll();
    setState('loading', `保存済みの素材${ASSET_COUNT}件を照合しています…`);
    try {
      const data = await loadValidatedAssets({
        signal: controller.signal,
        onProgress: (n, total) => { if (ui.controller === controller && root.dataset.state === 'loading') els.status.textContent = `保存済みの素材を照合しています（${n}/${total}）…`; },
      });
      if (ui.controller !== controller) return;
      ui.data = data;
      for (const c of controls()) c.disabled = false;
      els.request.value = data.request;
      renderCase();
      renderPart();
      renderFamily();
      updateLinks();
      updateCaption();
      setState('ready', `素材${data.assetCount}/${ASSET_COUNT}件をSHA-256で照合済み。図は制作時に保存した結果を描いたもので、このページはAIを実行しません。`);
      relayout();
      startAnim({...snapshot(restingParams(ui.job)), emph: {...STAGE_EMPH.pass}});
    } catch (error) {
      if (ui.controller !== controller || error?.name === 'AbortError') return;
      clearAll();
      setState('error', `読み込めませんでした：${error?.message || '不明な理由'}。古い表示は消しました。`);
    }
  }
  els.retry.addEventListener('click', load);
  applyTheme(readTheme(), false);
  load();
}

if (typeof document !== 'undefined' && document.documentElement.dataset.page === 'humanizer-concept') bootPage();
