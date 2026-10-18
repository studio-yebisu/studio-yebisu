/* Matt Pocock Skills 作例「AIに、開発の手順を渡す」— 概念図ページと図解動画の共通部分
 * 25件の素材を、大きさ・SHA-256・中身の対応で照合する。そのあと元の search.mjs と baseline/search.mjs を
 * ブラウザーで実際に呼び、保存済みの3件と同じ順序の結果が返ったときだけ図と読み出しを出す。
 * Matt Pocock Skills はAIが読むMarkdownの手順書集で、それ自体は動かない。このページではAIもNodeのテストも動かない。
 * 図の結果の紙は、原関数が返した掲載項目そのものから描く。
 * ページの初期化は index.html（data-page="matt-pocock-skills-concept"）でだけ行う。video/video.js は読み込みと描画だけを使う。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

export const CASE_ID = 'matt-pocock-skills-example';
export const SOURCE_COMMIT = '49dd158d1076134a641b33efb035946536778336';
export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = '86d1b8195471beefe34e8b084f65219647253b9c5b1d9d7a77b5520a3deb41c6';
const VENDOR = 'vendor/matt-pocock-skills/';
const ENG = `${VENDOR}skills/engineering/`;
export const ASSET_PATHS = Object.freeze([
  'concept/structure.json', 'entries.json', 'results.json', 'tdd-history.json', 'acceptance.json',
  'GLOSSARY.md', 'SPEC.md', 'input.md', 'review.md', 'search.mjs', 'baseline/search.mjs', 'search.test.mjs',
  'request.txt', 'outputs/wide-ui.json', 'outputs/and-query.json', 'outputs/slides-only.json',
  `${VENDOR}LICENSE`, `${VENDOR}README.md`,
  `${ENG}code-review/SKILL.md`, `${ENG}codebase-design/SKILL.md`, `${ENG}domain-modeling/GLOSSARY-FORMAT.md`,
  `${ENG}domain-modeling/SKILL.md`, `${ENG}tdd/mocking.md`, `${ENG}tdd/SKILL.md`, `${ENG}tdd/tests.md`,
]);
export const ASSET_COUNT = ASSET_PATHS.length;
const VENDOR_PATHS = ASSET_PATHS.filter((p) => p.startsWith(VENDOR));
export const JOB_IDS = Object.freeze(['wide-ui', 'and-query', 'slides-only']);
export const ENTRY_IDS = Object.freeze(['ui-notes', 'color-lab', 'slide-story', 'slide-layout', 'motion-cards', 'agent-check']);
export const SKILL_IDS = Object.freeze(['domain', 'design', 'tdd', 'review']);
export const PART_IDS = Object.freeze(['books', 'terms', 'interface', 'loop', 'review', 'result']);
const PHASES = ['baseline', 'red1', 'green1', 'red2', 'green2', 'red3', 'green3'];
const NODE_VERSION = 'v24.18.0';
export const REVIEW_BASE = '8ec362fdce723a627e60cd801b1db6de04e6ed47';
export const REVIEW_HEAD = '8a1e0bf291d1da2b897507b1ebccbe725e9418ab';
const SEAM_CALL = 'searchEntries(entries, query, { category })';
// 保存済み3件の入力と順序（元の制作の記録）。読み込んだ記録がこれと違えば描かない。
const EXPECT = Object.freeze({
  'wide-ui': {query: 'ＵＩ', category: 'all', cycle: 1, before: [], after: ['ui-notes', 'color-lab', 'motion-cards']},
  'and-query': {query: 'UI　設計', category: 'all', cycle: 2, before: [], after: ['ui-notes']},
  'slides-only': {query: '', category: 'slides', cycle: 3, before: [...ENTRY_IDS], after: ['slide-story', 'slide-layout']},
});
export const OUTPUTS = Object.freeze({
  'wide-ui': Object.freeze({path: 'outputs/wide-ui.json', bytes: 634, sha256: '0ceaa5d8c9a079df1e0fbd9f9889ecb7d13d2ae32aeea61bdf54caa06b9b4320'}),
  'and-query': Object.freeze({path: 'outputs/and-query.json', bytes: 315, sha256: '9394ab16b8336b73d03613e03890e65240b8715833ab8c575a4bb371a6211208'}),
  'slides-only': Object.freeze({path: 'outputs/slides-only.json', bytes: 1486, sha256: '9b0f48fd316b506b683b1cabc930d6f8ba3d1f2f30e7883d09fbc42b21abb185'}),
});
export const UPSTREAM_TREE = `https://github.com/mattpocock/skills/tree/${SOURCE_COMMIT}`;
const upstreamLine = (vendorPath, line) => {
  const p = vendorPath.slice(VENDOR.length);
  return `https://github.com/mattpocock/skills/blob/${SOURCE_COMMIT}/${p}${p.endsWith('.md') ? '?plain=1' : ''}#L${line}`;
};
// 本の表紙の短い名前と、この作例での使い方（説明のための整理。原典の分類ではない）
export const SKILL_META = Object.freeze({
  domain: Object.freeze({name: 'domain-modeling', book: '言葉',
    scope: (d) => `架空の依頼の言葉から、掲載項目・表題・タグなど${d.glossaryTerms.length}語を GLOSSARY.md に決めました。実装の決め方は SPEC.md 側に置いています。利用者への聞き取り、ADRの作成はしていません。`}),
  design: Object.freeze({name: 'codebase-design', book: '入口',
    scope: () => `${SEAM_CALL} という1つの入口の内側に、表記ゆれ・タグ・語のAND・分野をまとめました。呼び出し側とテストが同じ入口を通ります。行数で深さを測ったり、生産性を測ったりはしていません。`}),
  tdd: Object.freeze({name: 'tdd', book: 'テスト',
    scope: () => '新しいテスト1件 → 失敗を確かめる → 最小の変更 → 成功を確かめる、を1段ずつ3回。テストとコードは元の Opus 5.5 の別々の実行が書き、Node は制作担当が別に実行しました。整理し直し（リファクタリング）はこの繰り返しに含めていません。原典が求める「seamを利用者と確認する」は行っていません。'}),
  review: Object.freeze({name: 'code-review', book: '照合',
    scope: () => '最後の固定差分を、Standards（規約）と Spec（仕様）の独立したAI2つが別々に照合した、元の制作の記録です。指摘はそれぞれ0件。結果は統合せず、コードも書き換えていません。この画面や映像のレビューでも、人の承認でもありません。'}),
});

const BASE = new URL('./', import.meta.url);
export const assetUrl = (path) => new URL(path, BASE).href;

// ---------- 小さな道具 ----------
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const ease = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
export const prog = (t, a, b) => clamp01((t - a) / (b - a));
export const span = (t, a, b, c, d) => Math.min(easeOut(prog(t, a, b)), 1 - ease(prog(t, c, d)));
// 時刻 at から dur 秒で値を to へ移す変化を順に重ねる（絶対時刻だけで決まる）
export function steps(t, v0, changes) {
  let v = v0, prev = v0;
  for (const [at, to, dur = 0.5] of changes) { v += (to - prev) * ease(prog(t, at, at + dur)); prev = to; }
  return v;
}
const lerp = (a, b, k) => a + (b - a) * k;
export const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});
const isStr = (s) => typeof s === 'string' && s.length > 0;
const ids = (list) => (Array.isArray(list) ? list.map((x) => x && x.id) : []);
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
}
export const queryText = (q) => (q === '' ? '（空）' : `「${q}」`);
export const categoryText = (c) => (c === 'all' ? '全分野' : c);

// ---------- 取得と照合 ----------
export class AssetError extends Error {}
const fail = (message) => { throw new AssetError(message); };
const check = (ok, message) => { if (!ok) fail(message); };

async function fetchBytes(path, signal) {
  let response;
  try {
    response = await fetch(assetUrl(path), {cache: 'no-store', credentials: 'same-origin', signal});
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

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
export async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) fail('このブラウザーではSHA-256を計算できません。HTTPS か http://127.0.0.1 のページとして開いてください');
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

function decodeText(bytes, path) {
  let body;
  try { body = new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch { fail(`${path} がUTF-8として読めません`); }
  return body.charCodeAt(0) === 0xfeff ? body.slice(1) : body;
}
function parseJson(path, body) {
  try { return JSON.parse(body); } catch { return fail(`${path} がJSONとして読めません`); }
}
const splitLines = (text) => text.split(/\r?\n/);

function validateManifest(m) {
  check(m && m.format === 'studio-yebisu-assets/v1' && m.case_id === CASE_ID && m.source_commit === SOURCE_COMMIT, 'manifest の形式か固定版が違います');
  check(Array.isArray(m.files) && sameList(m.files.map((f) => f && f.path), ASSET_PATHS), `manifest の素材${ASSET_COUNT}件の一覧が違います`);
  for (const f of m.files) check(Number.isInteger(f.bytes) && f.bytes > 0 && /^[0-9a-f]{64}$/.test(f.sha256), `manifest の ${f.path} の記録が読めません`);
  for (const pin of Object.values(OUTPUTS)) {
    const e = m.files.find((f) => f.path === pin.path);
    check(e && e.bytes === pin.bytes && e.sha256 === pin.sha256, `manifest の ${pin.path} が固定値と違います`);
  }
}

const tapCount = (tap, re) => (tap.match(re) || []).length;
const failedName = (tap) => { const m = tap.match(/^not ok \d+ - (.+)$/m); return m ? m[1] : ''; };

function buildBundle(manifest, bytes) {
  const text = (p) => decodeText(bytes.get(p), p);
  const json = (p) => parseJson(p, text(p));
  const sha = (p) => manifest.files.find((f) => f.path === p).sha256;
  const S = json('concept/structure.json');
  check(S && S.format === 'matt-skills-structure/v1' && S.case_id === CASE_ID && S.source_commit === SOURCE_COMMIT && isStr(S.definition), 'concept/structure.json の形式か固定版が違います');

  // 原典9件：保存時のCRLFのまま。引用は改行を分けて行番号で確かめる
  const vendorText = Object.fromEntries(VENDOR_PATHS.map((p) => [p, text(p)]));
  for (const p of VENDOR_PATHS) check(vendorText[p].includes('\r\n'), `${p} の改行が保存時のCRLFではありません`);
  const vendorLines = Object.fromEntries(VENDOR_PATHS.map((p) => [p, splitLines(vendorText[p])]));
  const license = vendorText[`${VENDOR}LICENSE`];
  check(license.startsWith('MIT License') && license.includes('Copyright (c) 2026 Matt Pocock'), '原典の LICENSE が MIT License（Matt Pocock）ではありません');
  const quoteRef = (x, what) => {
    check(x && isStr(x.label) && isStr(x.meaning) && isStr(x.quote) && VENDOR_PATHS.includes(x.source_path) && Number.isInteger(x.line_start) && x.line_start >= 1, `${what} の引用の記録が読めません`);
    check((vendorLines[x.source_path][x.line_start - 1] || '').includes(x.quote), `${what} の引用が ${x.source_path} の${x.line_start}行目にありません`);
    return {id: x.id, label: x.label, meaning: x.meaning, quote: x.quote, source_path: x.source_path, line_start: x.line_start,
      shortPath: x.source_path.slice(VENDOR.length), url: assetUrl(x.source_path), lineUrl: upstreamLine(x.source_path, x.line_start)};
  };
  check(sameList(ids(S.skills), SKILL_IDS), 'concept/structure.json の4つのスキルが違います');
  check(sameList(ids(S.parts), PART_IDS), 'concept/structure.json の6つの部分が違います');
  const skills = S.skills.map((x) => ({...quoteRef(x, x.id), ...SKILL_META[x.id], scope: null}));
  const parts = S.parts.map((x) => quoteRef(x, x.id));

  const seam = S.seam || {};
  check(seam.call === SEAM_CALL && seam.human_confirmed === false && isStr(seam.actor) && isStr(seam.catch) && isStr(seam.miss), 'concept/structure.json の入口（seam）の記録が違います');
  const seamQuote = quoteRef(seam.source_quote, 'seam');
  const docs = S.documents || {};
  check(docs.glossary_terms === 8 && docs.spec_acceptance_conditions === 7 && docs.accepted_by_human === false && isStr(docs.author), 'concept/structure.json の用語集と仕様の記録が違います');
  const c = S.counts || {};
  check(c.entries === 6 && c.samples === 3 && c.baseline_tests === 1 && c.red_green_cycles === 3 && c.final_tests === 4 && c.final_pass === 4
    && c.additional_acceptance_checks === 18 && c.chosen_skills === 4 && c.vendor_files === VENDOR_PATHS.length, 'concept/structure.json の件数が違います');
  const g = S.guardrails || {};
  check(g.original_inference_rerun === false && g.original_node_tests_rerun === false && g.new_independent_review === false && g.human_approval === false
    && g.production_site_search_modified === false && g.live_ai_in_browser === false && g.new_ui_calls_original_search_functions === true
    && g.entire_skill_collection_applied === false, 'concept/structure.json の範囲の記録が違います');
  const rv = S.independent_review || {};
  check(rv.standards && rv.standards.findings === 0 && rv.spec && rv.spec.findings === 0 && rv.base === REVIEW_BASE && rv.head === REVIEW_HEAD
    && rv.human_approval === false && rv.ui_reviewed === false && rv.user_supplied_base === false && Array.isArray(rv.scope) && rv.scope.includes('search.mjs'),
  'concept/structure.json の独立レビューの記録が違います');

  // 依頼・用語集・仕様・レビュー・依頼文
  const input = text('input.md');
  const quoteMatch = input.match(/「([^」]+)」/);
  check(quoteMatch && input.includes('searchEntries(entries, query, {category})'), 'input.md の元の依頼か入口がありません');
  const glossaryTerms = [...text('GLOSSARY.md').matchAll(/^\*\*(.+?)\*\*:/gm)].map((m) => m[1]);
  check(glossaryTerms.length === docs.glossary_terms && glossaryTerms.every(isStr), `GLOSSARY.md の用語が${docs.glossary_terms}語ではありません`);
  const spec = text('SPEC.md');
  const accepted = spec.split(/\r?\n## /).find((s) => s.startsWith('確定した受け入れ条件')) || '';
  const conditions = [...accepted.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  check(conditions.length === docs.spec_acceptance_conditions && conditions.every((n, i) => n === i + 1), `SPEC.md の受け入れ条件が${docs.spec_acceptance_conditions}つではありません`);
  check(spec.includes(SEAM_CALL) && spec.includes('利用者と対話して合意したものではありません'), 'SPEC.md の入口の記述が違います');
  const review = text('review.md');
  check(review.includes('Standards：0件') && review.includes('Spec：0件') && review.includes(REVIEW_BASE) && review.includes(REVIEW_HEAD) && review.includes('コミット4件'), 'review.md の記録が違います');
  const request = text('request.txt');
  check(request.includes(SOURCE_COMMIT) && request.includes('skills/engineering/tdd/SKILL.md') && request.includes('seam') && request.includes(quoteMatch[1]), 'request.txt の依頼文が違います');
  const finalSource = text('search.mjs'), baseSource = text('baseline/search.mjs');
  const signature = "export function searchEntries(entries, query, { category = 'all' } = {})";
  check(finalSource.includes(signature) && baseSource.includes(signature), 'search.mjs か baseline/search.mjs の入口が違います');
  check(text('search.test.mjs').includes("from './search.mjs'"), 'search.test.mjs が search.mjs を読んでいません');

  // 合成データ6件
  const entries = json('entries.json');
  check(Array.isArray(entries) && sameList(ids(entries), ENTRY_IDS), 'entries.json の6件が違います');
  for (const e of entries) {
    check(isStr(e.title) && isStr(e.category) && Array.isArray(e.tags) && e.tags.length > 0 && e.tags.every(isStr) && Object.keys(e).length === 4, `entries.json の ${e.id} の形が違います`);
  }
  const byId = new Map(entries.map((e) => [e.id, e]));

  // 保存済み3件：results.json・structure・outputs/*.json・acceptance の samples がすべて同じ
  const results = json('results.json');
  check(results && results.synthetic === true && results.node === NODE_VERSION && sameList(ids(results.samples), JOB_IDS), 'results.json の3件が違います');
  check(sameList(ids(S.jobs), JOB_IDS), 'concept/structure.json の3件が違います');
  const jobs = {};
  JOB_IDS.forEach((id, i) => {
    const sm = results.samples[i], sj = S.jobs[i], ex = EXPECT[id];
    check(sm.query === ex.query && sm.category === ex.category && sj.query === ex.query && sj.category === ex.category && sj.cycle === ex.cycle && isStr(sm.label) && sm.label === sj.label, `${id} の入力が保存記録と違います`);
    check(sameList(ids(sm.before), ex.before) && sameList(ids(sm.after), ex.after) && sameList(sj.before_ids, ex.before) && sameList(sj.after_ids, ex.after), `${id} の結果の順序が保存記録と違います`);
    check([...sm.before, ...sm.after].every((o) => deepEqual(o, byId.get(o.id))), `${id} の掲載項目が entries.json と違います`);
    check(deepEqual(sj.output_file, OUTPUTS[id]), `${id} の出力ファイルの記録が違います`);
    check(deepEqual(json(OUTPUTS[id].path), sm), `${OUTPUTS[id].path} の中身が results.json の ${id} と違います`);
    jobs[id] = {
      id, label: sm.label, query: sm.query, category: sm.category, cycle: sj.cycle,
      output: {...OUTPUTS[id], url: assetUrl(OUTPUTS[id].path), download: `matt-pocock-skills-${id}.json`, file: OUTPUTS[id].path.split('/').pop()},
      saved: {before: sm.before, after: sm.after, beforeIds: ex.before, afterIds: ex.after},
      final: null, baseline: null,
    };
  });

  // 実際のNode実行7回（元の制作で保存）：失敗1件→全成功の形と、ファイルのハッシュのつながり
  const hist = json('tdd-history.json');
  check(hist && hist.synthetic === true && hist.human_approved === false && hist.seam_user_confirmation === false && Array.isArray(hist.runs) && sameList(hist.runs.map((r) => r && r.phase), PHASES), 'tdd-history.json の7回の記録が違います');
  const runs = Object.fromEntries(hist.runs.map((r) => [r.phase, r]));
  for (const r of hist.runs) {
    check(r.node === NODE_VERSION && isStr(r.command) && isStr(r.executed_at) && isStr(r.tap) && [r.tests, r.pass, r.fail, r.exit_code].every(Number.isInteger), `${r.phase} の記録が読めません`);
    check(tapCount(r.tap, /^ok \d+ - /gm) === r.pass && tapCount(r.tap, /^not ok \d+ - /gm) === r.fail && r.tap.includes(`\n# tests ${r.tests}\n`), `${r.phase} の数がTAPの出力と合いません`);
    check(r.source_sha256 && r.source_sha256['entries.json'] === sha('entries.json'), `${r.phase} の entries.json が今の合成データと違います`);
  }
  const b0 = runs.baseline;
  check(b0.tests === 1 && b0.pass === 1 && b0.fail === 0 && b0.exit_code === 0 && b0.source_sha256['search.mjs'] === sha('baseline/search.mjs'), 'baseline の記録が違います');
  check(sameList(ids(S.cycles), [1, 2, 3]), 'concept/structure.json の3段が違います');
  const sameRun = (rec, run) => rec && rec.phase === run.phase && rec.tests === run.tests && rec.pass === run.pass && rec.fail === run.fail && rec.exit_code === run.exit_code && rec.command === run.command && rec.node === run.node;
  const cycles = [1, 2, 3].map((k) => {
    const red = runs[`red${k}`], green = runs[`green${k}`], prev = k === 1 ? b0 : runs[`green${k - 1}`], sc = S.cycles[k - 1];
    check(red.tests === k + 1 && red.pass === k && red.fail === 1 && red.exit_code === 1, `red${k} が「新しい1件だけ失敗」の記録ではありません`);
    check(green.tests === k + 1 && green.pass === k + 1 && green.fail === 0 && green.exit_code === 0, `green${k} が全成功の記録ではありません`);
    check(red.source_sha256['search.mjs'] === prev.source_sha256['search.mjs'] && red.source_sha256['search.test.mjs'] !== prev.source_sha256['search.test.mjs'], `red${k} でテストだけが変わっていません`);
    check(green.source_sha256['search.test.mjs'] === red.source_sha256['search.test.mjs'] && green.source_sha256['search.mjs'] !== red.source_sha256['search.mjs'], `green${k} でコードだけが変わっていません`);
    const name = failedName(red.tap);
    check(isStr(name) && green.tap.includes(`ok ${k + 1} - ${name}`), `段${k}で足したテストの名前が記録と合いません`);
    check(sc.sample_id === JOB_IDS[k - 1] && isStr(sc.label) && sc.new_test_per_cycle === 1 && sameRun(sc.red, red) && sameRun(sc.green, green) && isStr(sc.executor) && isStr(sc.writer), `concept/structure.json の段${k}が tdd-history.json と違います`);
    const pick = (r) => ({phase: r.phase, tests: r.tests, pass: r.pass, fail: r.fail, exit_code: r.exit_code, executed_at: r.executed_at, command: r.command});
    return {id: k, label: sc.label, sampleId: sc.sample_id, newTest: name, red: pick(red), green: pick(green)};
  });
  const g3 = runs.green3;
  check(g3.source_sha256['search.mjs'] === sha('search.mjs') && g3.source_sha256['search.test.mjs'] === sha('search.test.mjs'), '最後の記録のファイルが今の search.mjs・search.test.mjs と違います');

  // テストとは別の18項目
  const acc = json('acceptance.json');
  check(acc && acc.status === 'passed' && acc.node === NODE_VERSION && acc.checks === c.additional_acceptance_checks && acc.new_array_and_no_input_mutation === true
    && Array.isArray(acc.checks_detail) && acc.checks_detail.length === acc.checks
    && acc.checks_detail.every((x) => isStr(x.id) && typeof x.query === 'string' && isStr(x.category) && x.passed === true && sameList(x.expected, x.actual)), 'acceptance.json の18項目の記録が違います');
  check(deepEqual(acc.samples, results.samples), 'acceptance.json の3件が results.json と違います');

  return {
    manifest, request, definition: S.definition,
    inputQuote: quoteMatch[1], glossaryTerms, specCount: conditions.length,
    skills: skills.map((s) => ({...s, scopeText: SKILL_META[s.id].scope({glossaryTerms})})),
    parts, seam: {call: seam.call, actor: seam.actor, catch: seam.catch, miss: seam.miss, confirmed: false, quote: seamQuote},
    entries, jobs, cycles, nodeVersion: NODE_VERSION,
    baselineRun: {phase: 'baseline', tests: b0.tests, pass: b0.pass, fail: b0.fail, exit_code: b0.exit_code, executed_at: b0.executed_at},
    acceptance: {checks: acc.checks, passed: acc.checks_detail.length, detail: acc.checks_detail.map((x) => ({id: x.id, query: x.query, category: x.category, expected: x.expected}))},
    review: {standards: rv.standards.findings, spec: rv.spec.findings, base: rv.base, head: rv.head, reviewedAt: rv.reviewed_at, scope: rv.scope},
    vendorCrlf: VENDOR_PATHS.length,
  };
}

// 元の2つの関数を、照合済みの6件と保存済みの入力で実際に呼ぶ。返った掲載項目そのものを図に使う。
async function callOriginals(bundle) {
  let finalMod, baseMod;
  try {
    [finalMod, baseMod] = await Promise.all([import(assetUrl('search.mjs')), import(assetUrl('baseline/search.mjs'))]);
  } catch {
    fail('search.mjs か baseline/search.mjs をモジュールとして読み込めませんでした');
  }
  check(typeof finalMod.searchEntries === 'function' && typeof baseMod.searchEntries === 'function', 'searchEntries が見つかりません');
  const snapshot = JSON.stringify(bundle.entries);
  for (const id of JOB_IDS) {
    const job = bundle.jobs[id];
    let after, before;
    try {
      after = finalMod.searchEntries(bundle.entries, job.query, {category: job.category});
      before = baseMod.searchEntries(bundle.entries, job.query, {category: job.category});
    } catch {
      fail(`${id}：原関数の呼び出しが失敗しました`);
    }
    check(Array.isArray(after) && after !== bundle.entries && sameList(ids(after), job.saved.afterIds) && after.every((o, i) => deepEqual(o, job.saved.after[i])), `${id}：search.mjs が返した掲載項目と順序が保存記録と違います`);
    check(Array.isArray(before) && sameList(ids(before), job.saved.beforeIds), `${id}：baseline/search.mjs が返した掲載項目が保存記録と違います`);
    job.final = after;
    job.baseline = before;
  }
  check(JSON.stringify(bundle.entries) === snapshot, '原関数の呼び出しで掲載項目が変わりました');
}

// 25件をすべて取り直し、大きさとSHA-256、中身の対応、原関数の実際の結果を確かめた記録だけを返す。どれか一つでも違えば例外。
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
    const bundle = buildBundle(manifest, bytes);
    deepFreeze(bundle.entries);
    await callOriginals(bundle);
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return deepFreeze(bundle);
  } finally {
    signal?.removeEventListener('abort', relay);
  }
}

// ---------- 概念図（ページと図解動画で共通） ----------
// 4冊の手順書 → AIが執筆（依頼・旧コードを読む）→ 用語集・仕様 → 1つの入口を持つ検索モジュール
// AIが書いた同じテストの紙が、制作担当のNodeとの間を往復（RED → 最小の変更 → GREEN）×3段、同じ輪とタブで
// 最後の固定差分を2つの目（規約・仕様）が別々に見る → 同じ6件の掲載項目が入口へ → 原関数が返した掲載項目 → 保存したJSON・元の検索台

export const FONT = Object.freeze({
  sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", "Noto Serif JP", serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
});
// 製図用紙の青灰・墨紺。藍は動き、赤と緑は失敗と成功だけ、黄は原関数が返した掲載項目だけに使う。
export const PALETTES = Object.freeze({
  light: Object.freeze({bg: '#eceff3', sheet: '#fbfcfd', ink: '#14203a', muted: '#4f5b70', rule: '#bcc4d1', flow: '#2b4fd8', flowInk: '#1f3aa8',
    tint: 'rgba(43,79,216,0.11)', red: '#b42318', redSoft: 'rgba(180,35,24,0.10)', green: '#18794e', greenSoft: 'rgba(24,121,78,0.11)',
    hit: '#ffd23f', hitInk: '#14203a', slab: '#14203a', slabInk: '#eef2f8'}),
  dark: Object.freeze({bg: '#0f1622', sheet: '#182131', ink: '#e4eaf4', muted: '#a7b2c4', rule: '#3a475d', flow: '#7d97ff', flowInk: '#a9bbff',
    tint: 'rgba(125,151,255,0.16)', red: '#ff7a6b', redSoft: 'rgba(255,122,107,0.15)', green: '#4cc38a', greenSoft: 'rgba(76,195,138,0.15)',
    hit: '#f5c518', hitInk: '#14203a', slab: '#e4eaf4', slabInk: '#0f1622'}),
});

const TALL = {
  nodes: {
    books: [0.02, 0.005, 0.96, 0.115],
    req: [0.02, 0.145, 0.25, 0.062], old: [0.02, 0.222, 0.25, 0.062],
    ai: [0.32, 0.145, 0.27, 0.14], node: [0.70, 0.145, 0.28, 0.14], extra: [0.70, 0.292, 0.28, 0.03],
    docsG: [0.02, 0.335, 0.25, 0.08], docsS: [0.02, 0.425, 0.25, 0.08],
    module: [0.32, 0.335, 0.36, 0.17],
    lensA: [0.72, 0.335, 0.26, 0.05], diff: [0.72, 0.395, 0.26, 0.05], lensB: [0.72, 0.455, 0.26, 0.05],
    entries: [0.02, 0.545, 0.25, 0.44], results: [0.32, 0.545, 0.66, 0.205],
    json: [0.32, 0.79, 0.32, 0.195], desk: [0.66, 0.79, 0.32, 0.195],
  },
  edges: {
    bookAI: [[0.455, 0.12], [0.455, 0.145]],
    reqAI: [[0.27, 0.176], [0.32, 0.176]],
    oldAI: [[0.27, 0.253], [0.32, 0.253]],
    aiDocs: [[0.36, 0.285], [0.36, 0.31], [0.145, 0.31], [0.145, 0.335]],
    docsGMod: [[0.27, 0.375], [0.32, 0.375]],
    docsSMod: [[0.27, 0.465], [0.32, 0.465]],
    aiNode: [[0.59, 0.185], [0.70, 0.185]],
    nodeAi: [[0.70, 0.245], [0.59, 0.245]],
    loopMod: [[0.645, 0.285], [0.645, 0.335]],
    modDiff: [[0.68, 0.42], [0.72, 0.42]],
    entMod: [[0.27, 0.57], [0.295, 0.57], [0.295, 0.49], [0.32, 0.49]],
    modRes: [[0.50, 0.505], [0.50, 0.545]],
    resJson: [[0.48, 0.75], [0.48, 0.79]],
    resDesk: [[0.82, 0.75], [0.82, 0.79]],
  },
  sights: {sightA: [[0.85, 0.385], [0.85, 0.395]], sightB: [[0.85, 0.455], [0.85, 0.445]]},
  grid: [0.12, 0.005, 0.76, 0.44],
};
const WIDE = {
  nodes: {
    books: [0.01, 0.03, 0.19, 0.44],
    req: [0.01, 0.52, 0.19, 0.14], old: [0.01, 0.69, 0.19, 0.14], scope: [0.01, 0.86, 0.19, 0.11],
    ai: [0.235, 0.03, 0.17, 0.30], node: [0.455, 0.03, 0.17, 0.30], extra: [0.455, 0.34, 0.17, 0.045],
    docsG: [0.235, 0.43, 0.17, 0.085], docsS: [0.235, 0.53, 0.17, 0.085],
    entries: [0.235, 0.645, 0.17, 0.325],
    module: [0.455, 0.43, 0.17, 0.54],
    lensA: [0.665, 0.03, 0.325, 0.09], diff: [0.665, 0.14, 0.325, 0.09], lensB: [0.665, 0.25, 0.325, 0.09],
    results: [0.665, 0.40, 0.325, 0.32],
    json: [0.665, 0.77, 0.157, 0.20], desk: [0.833, 0.77, 0.157, 0.20],
  },
  edges: {
    bookAI: [[0.20, 0.18], [0.235, 0.18]],
    reqAI: [[0.20, 0.59], [0.2175, 0.59], [0.2175, 0.27], [0.235, 0.27]],
    oldAI: [[0.20, 0.76], [0.2175, 0.76], [0.2175, 0.27], [0.235, 0.27]],
    aiDocs: [[0.32, 0.33], [0.32, 0.43]],
    docsGMod: [[0.405, 0.4725], [0.455, 0.4725]],
    docsSMod: [[0.405, 0.5725], [0.455, 0.5725]],
    aiNode: [[0.405, 0.12], [0.455, 0.12]],
    nodeAi: [[0.455, 0.24], [0.405, 0.24]],
    loopMod: [[0.43, 0.33], [0.43, 0.405], [0.54, 0.405], [0.54, 0.43]],
    modDiff: [[0.625, 0.47], [0.645, 0.47], [0.645, 0.185], [0.665, 0.185]],
    entMod: [[0.405, 0.80], [0.455, 0.80]],
    modRes: [[0.625, 0.56], [0.665, 0.56]],
    resJson: [[0.7435, 0.72], [0.7435, 0.77]],
    resDesk: [[0.9115, 0.72], [0.9115, 0.77]],
  },
  sights: {sightA: [[0.8275, 0.12], [0.8275, 0.14]], sightB: [[0.8275, 0.25], [0.8275, 0.23]]},
  grid: null,
};
const EDGE_GROUP = {bookAI: 'in', reqAI: 'in', oldAI: 'in', aiDocs: 'docs', docsGMod: 'docs', docsSMod: 'docs',
  aiNode: 'loop', nodeAi: 'loop', loopMod: 'code', modDiff: 'review', entMod: 'use', modRes: 'use', resJson: 'use', resDesk: 'use'};
export const ALL_EDGES = Object.freeze(Object.keys(EDGE_GROUP));
export const NODE_KEYS = Object.freeze(['books', 'req', 'old', 'scope', 'ai', 'node', 'extra', 'docsG', 'docsS', 'module', 'diff', 'lensA', 'lensB', 'entries', 'results', 'json', 'desk']);
// 6つの部分・4冊を選んだときに枠を付ける場所
export const PART_NODES = Object.freeze({books: ['books'], terms: ['req', 'docsG', 'docsS'], interface: ['module'], loop: ['ai', 'node'], review: ['diff', 'lensA', 'lensB'], result: ['entries', 'results', 'json', 'desk']});
export const SKILL_NODES = Object.freeze({domain: ['docsG'], design: ['module'], tdd: ['ai', 'node'], review: ['diff', 'lensA', 'lensB']});

export function chooseKind(W, H) { return W >= 640 && W / H >= 1.25 ? 'wide' : 'tall'; }

function shelfRects(r, head, gap, grid) {
  const top = r.y + head, h = r.h - head;
  if (!grid) {
    const w = (r.w - gap * 3) / 4;
    return [0, 1, 2, 3].map((i) => ({x: r.x + i * (w + gap), y: top, w, h}));
  }
  const w = (r.w - gap) / 2, hh = (h - gap) / 2;
  return [0, 1, 2, 3].map((i) => ({x: r.x + (i % 2) * (w + gap), y: top + Math.floor(i / 2) * (hh + gap), w, h: hh}));
}

export function conceptLayout(kind, W, H) {
  const spec = kind === 'wide' ? WIDE : TALL;
  const sc = ([x, y, w, h]) => ({x: x * W, y: y * H, w: w * W, h: h * H});
  const pts = (list) => list.map(([x, y]) => [x * W, y * H]);
  const n = {};
  for (const [k, v] of Object.entries(spec.nodes)) n[k] = sc(v);
  const e = {};
  for (const [k, v] of Object.entries(spec.edges)) e[k] = pts(v);
  const s = {};
  for (const [k, v] of Object.entries(spec.sights)) s[k] = pts(v);
  const u = kind === 'wide' ? Math.min(W / 72, H / 34) : Math.min(W / 25, H / 40);
  const f = {label: Math.max(12, u * 0.95), small: Math.max(11, u * 0.8), big: Math.max(16, u * 1.5)};
  const gap = Math.max(4, u * 0.35);
  const head = f.small * 1.7;
  n.shelfRow = n.books;
  n.shelfGrid = spec.grid ? sc(spec.grid) : n.books;
  const gridHead = spec.grid ? f.label * 2 : head;
  n.bookRow = shelfRects(n.books, head, gap, kind === 'wide');
  n.bookGrid = shelfRects(n.shelfGrid, gridHead, spec.grid ? gap * 2.5 : gap, true);
  n.shelfHead = {row: head, grid: gridHead};
  const er = n.entries, eh = f.small * 1.7, eg = Math.max(3, u * 0.22);
  const sh = (er.h - eh - eg * 5) / 6;
  n.strip = ENTRY_IDS.map((_, i) => ({x: er.x, y: er.y + eh + i * (sh + eg), w: er.w, h: sh}));
  const rs = n.results, rh = f.small * 1.9, rg = Math.max(4, u * 0.35);
  const cw = (rs.w - rg * 2) / 3;
  n.card = [0, 1, 2].map((i) => ({x: rs.x + i * (cw + rg), y: rs.y + rh, w: cw, h: rs.h - rh}));
  const m = n.module;
  const bar = Math.max(u * 1.5, Math.min(m.w * 0.2, u * 2.6));
  n.modBar = {x: m.x, y: m.y, w: bar, h: m.h};
  return {kind, W, H, u, f, n, e, s};
}

// 既定は完成した姿。ページの段階と動画は、ここから値を変える。
export function restParams() {
  return {
    show: {}, emph: {}, emphEdge: {}, draw: {}, flow: {},
    books: 4, shelfGrid: 0, fixture: 1, docs: 1, iface: 1, seam: 1,
    loop: 3, loopFlows: true, extra: 1, diff: 1, lensA: 1, lensB: 1, findA: 1, findB: 1,
    travel: 1, results: 1, files: 1,
    focusPart: null, focusSkill: null,
  };
}

// ページの段階：τ=1 読む、τ=2 確かめる、τ=3 使う。τの途中は動きの途中。
const STAGE_NODES = {
  books: [1, 0, 0], req: [1, 0, 0], old: [1, 0, 0], scope: [1, 0, 1], ai: [1, 1, 0], docsG: [1, 0, 0], docsS: [1, 0, 0],
  module: [1, 1, 1], node: [0, 1, 0], extra: [0, 1, 0], diff: [0, 1, 0], lensA: [0, 1, 0], lensB: [0, 1, 0],
  entries: [0, 0, 1], results: [0, 0, 1], json: [0, 0, 1], desk: [0, 0, 1],
};
const STAGE_EDGES = {in: [1, 0, 0], docs: [1, 0, 0], loop: [0, 1, 0], code: [0, 1, 0], review: [0, 1, 0], use: [0, 0, 1]};
export function storyParams(tau) {
  const p = restParams();
  p.books = 4 * prog(tau, 0, 0.45);
  p.fixture = easeOut(prog(tau, 0.15, 0.45));
  p.flow.bookAI = p.flow.reqAI = p.flow.oldAI = prog(tau, 0.35, 0.65) * (1 - prog(tau, 1.05, 1.2));
  p.docs = easeOut(prog(tau, 0.55, 0.8));
  p.flow.aiDocs = prog(tau, 0.5, 0.7) * (1 - prog(tau, 1.05, 1.2));
  p.iface = easeOut(prog(tau, 0.7, 0.92));
  p.flow.docsGMod = p.flow.docsSMod = prog(tau, 0.75, 0.95) * (1 - prog(tau, 1.05, 1.2));
  p.seam = easeOut(prog(tau, 0.85, 1.0));
  p.loop = 3 * prog(tau, 1.05, 1.78);
  p.extra = easeOut(prog(tau, 1.76, 1.84));
  p.diff = easeOut(prog(tau, 1.8, 1.88));
  p.flow.modDiff = prog(tau, 1.8, 1.9) * (1 - prog(tau, 2.05, 2.15));
  p.lensA = easeOut(prog(tau, 1.84, 1.92));
  p.lensB = easeOut(prog(tau, 1.88, 1.96));
  p.findA = easeOut(prog(tau, 1.92, 1.97));
  p.findB = easeOut(prog(tau, 1.95, 2.0));
  p.travel = prog(tau, 2.05, 2.45);
  p.flow.entMod = prog(tau, 2.05, 2.3);
  p.results = prog(tau, 2.45, 2.8);
  p.flow.modRes = prog(tau, 2.42, 2.6);
  p.files = easeOut(prog(tau, 2.72, 2.95));
  p.flow.resJson = p.flow.resDesk = prog(tau, 2.75, 2.95);
  const w = [tau <= 1 ? 1 : clamp01(2 - tau), clamp01(1 - Math.abs(tau - 2)), clamp01(tau - 2)];
  const weight = (m) => Math.max(m[0] * w[0], m[1] * w[1], m[2] * w[2]);
  for (const [k, m] of Object.entries(STAGE_NODES)) p.emph[k] = 0.62 + 0.38 * weight(m);
  for (const [k, m] of Object.entries(STAGE_EDGES)) p.emphEdge[k] = 0.62 + 0.38 * weight(m);
  return p;
}

// 輪の状態：各段は 0〜0.25 テストの紙がNodeへ、0.25 RED、0.4〜0.65 コードの紙がNodeへ、0.65 GREEN、0.75 入口の中身が1層増える
export function nodeState(loop, d) {
  if (loop >= 3) return {kind: 'green', k: 3, run: d.cycles[2].green};
  const k = Math.min(3, Math.floor(Math.max(0, loop)) + 1);
  const ph = loop - (k - 1);
  if (ph < 0.25) return k === 1 ? {kind: 'base', k: 0, run: d.baselineRun} : {kind: 'green', k: k - 1, run: d.cycles[k - 2].green};
  if (ph < 0.65) return {kind: 'red', k, run: d.cycles[k - 1].red};
  return {kind: 'green', k, run: d.cycles[k - 1].green};
}

// ---- 描画の部品 ----
function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function alpha(c, a, fn) {
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha *= Math.min(1, a);
  fn();
  c.restore();
}
// 幅 max に収まるまで文字を小さくして描く（下限 min）。収まらなければ末尾を「…」にする。描いた幅を返す。
export function drawText(c, s, x, y, o = {}) {
  const weight = o.weight || 400, family = o.family || FONT.sans;
  let size = o.size || 14;
  const min = Math.min(size, o.min || 10);
  c.font = `${weight} ${size}px ${family}`;
  let w = c.measureText(s).width;
  if (o.max > 0) {
    while (w > o.max && size > min) {
      size = Math.max(min, size - 0.5);
      c.font = `${weight} ${size}px ${family}`;
      w = c.measureText(s).width;
    }
    if (w > o.max) {
      let t = s;
      while (t.length > 1 && c.measureText(`${t}…`).width > o.max) t = t.slice(0, -1);
      s = `${t}…`;
      w = c.measureText(s).width;
    }
  }
  c.fillStyle = o.color || '#000';
  c.textAlign = o.align || 'left';
  c.textBaseline = o.base || 'middle';
  c.fillText(s, x, y);
  return w;
}
const NO_BREAK_BEFORE = '、。，．」』）・ー：';
// 和文は文字ごと、英数字の並びはひとかたまりで折り返す
function wrapLines(c, s, maxW) {
  const tokens = s.match(/[A-Za-z0-9_.\-/@]+|./gsu) || [];
  const out = [];
  let line = '';
  for (const tk of tokens) {
    if (tk === '\n') { out.push(line); line = ''; continue; }
    const next = line + tk;
    if (line && c.measureText(next).width > maxW && !NO_BREAK_BEFORE.includes(tk)) { out.push(line); line = tk.trimStart(); } else line = next;
  }
  if (line) out.push(line);
  return out;
}
export function drawWrapped(c, s, r, o = {}) {
  const family = o.family || FONT.sans, weight = o.weight || 400, lh = o.lh || 1.35, maxLines = o.maxLines || 99;
  let size = o.size || 14;
  const min = Math.min(size, o.min || 10);
  let lines = [];
  for (let guard = 0; guard < 80; guard++) {
    c.font = `${weight} ${size}px ${family}`;
    lines = wrapLines(c, s, Math.max(1, r.w));
    if ((lines.length <= maxLines && lines.length * size * lh <= r.h + 0.5) || size <= min) break;
    size = Math.max(min, size - 0.5);
  }
  const room = Math.max(1, Math.min(maxLines, Math.floor((r.h + 0.5) / (size * lh)) || 1));
  if (lines.length > room) { lines = lines.slice(0, room); lines[room - 1] = `${lines[room - 1].slice(0, -1)}…`; }
  c.fillStyle = o.color || '#000';
  c.textAlign = o.align || 'left';
  c.textBaseline = 'middle';
  const x = o.align === 'center' ? r.x + r.w / 2 : r.x;
  const total = lines.length * size * lh;
  const y0 = (o.valign === 'middle' ? r.y + (r.h - total) / 2 : r.y) + (size * lh) / 2;
  lines.forEach((ln, i) => c.fillText(ln, x, y0 + i * size * lh));
  return {lines: lines.length, size, height: total};
}
function segments(pts) {
  const list = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    list.push({x0, y0, x1, y1, len});
    total += len;
  }
  return {list, total};
}
function pointAt(pts, k) {
  const {list, total} = segments(pts);
  let d = clamp01(k) * total;
  for (const s of list) {
    if (d <= s.len || s === list[list.length - 1]) {
      const q = s.len ? Math.min(1, d / s.len) : 1;
      return {x: s.x0 + (s.x1 - s.x0) * q, y: s.y0 + (s.y1 - s.y0) * q};
    }
    d -= s.len;
  }
  return {x: pts[0][0], y: pts[0][1]};
}
function strokePath(c, pts, k, o) {
  if (k <= 0.001 || pts.length < 2) return;
  const {list, total} = segments(pts);
  let d = clamp01(k) * total;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  let end = {x: pts[0][0], y: pts[0][1], a: 0};
  for (const s of list) {
    if (d <= 0) break;
    const q = Math.min(1, d / (s.len || 1));
    const x = s.x0 + (s.x1 - s.x0) * q, y = s.y0 + (s.y1 - s.y0) * q;
    c.lineTo(x, y);
    end = {x, y, a: Math.atan2(s.y1 - s.y0, s.x1 - s.x0)};
    d -= s.len;
  }
  c.strokeStyle = o.color;
  c.lineWidth = o.width;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.setLineDash(o.dash || []);
  c.stroke();
  c.setLineDash([]);
  if (o.head > 0) {
    const h = o.head;
    c.beginPath();
    c.moveTo(end.x, end.y);
    c.lineTo(end.x - h * Math.cos(end.a - 0.45), end.y - h * Math.sin(end.a - 0.45));
    c.lineTo(end.x - h * Math.cos(end.a + 0.45), end.y - h * Math.sin(end.a + 0.45));
    c.closePath();
    c.fillStyle = o.color;
    c.fill();
  }
}
function dashed(c, u, on) { c.setLineDash(on ? [Math.max(3, u * 0.3), Math.max(2, u * 0.22)] : []); }
function paper(c, r, pal, u, o = {}) {
  const fold = Math.min(u * 0.75, r.w * 0.22, r.h * 0.32);
  c.beginPath();
  c.moveTo(r.x, r.y);
  c.lineTo(r.x + r.w - fold, r.y);
  c.lineTo(r.x + r.w, r.y + fold);
  c.lineTo(r.x + r.w, r.y + r.h);
  c.lineTo(r.x, r.y + r.h);
  c.closePath();
  c.fillStyle = o.fill || pal.sheet;
  c.fill();
  dashed(c, u, o.dashed);
  c.strokeStyle = o.stroke || pal.ink;
  c.lineWidth = o.lw || 1.3;
  c.stroke();
  c.setLineDash([]);
  c.beginPath();
  c.moveTo(r.x + r.w - fold, r.y);
  c.lineTo(r.x + r.w - fold, r.y + fold);
  c.lineTo(r.x + r.w, r.y + fold);
  c.stroke();
  return fold;
}
function focusBox(c, L, r, pal) {
  const pad = Math.max(3, L.u * 0.22);
  rr(c, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, L.u * 0.35);
  c.setLineDash([]);
  c.strokeStyle = pal.flow;
  c.lineWidth = 3;
  c.stroke();
}
const val = (o, k, dflt) => (o && o[k] !== undefined ? o[k] : dflt);

// ---- 4冊の手順書 ----
function shelfState(L, p) {
  const k = L.kind === 'wide' ? 0 : ease(clamp01(p.shelfGrid));
  const n = L.n;
  return {
    k,
    region: k <= 0 ? n.shelfRow : lerpRect(n.shelfRow, n.shelfGrid, k),
    head: lerp(n.shelfHead.row, n.shelfHead.grid, k),
    books: n.bookRow.map((r, i) => (k <= 0 ? r : lerpRect(r, n.bookGrid[i], k))),
  };
}
export function shelfRegion(L, p) { return shelfState(L, p).region; }
function skillIcon(c, id, r, pal) {
  const s = Math.min(r.w, r.h);
  if (s < 8) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, x0 = cx - s / 2, y0 = cy - s / 2;
  c.save();
  c.lineWidth = Math.max(1.2, s * 0.07);
  c.strokeStyle = pal.ink;
  c.fillStyle = pal.ink;
  c.lineCap = 'round';
  if (id === 'domain') {
    // 用語集：太い語と細い説明の3行
    for (let i = 0; i < 3; i++) {
      const y = y0 + s * (0.2 + i * 0.3);
      c.fillRect(x0, y - s * 0.07, s * 0.3, s * 0.14);
      c.beginPath(); c.moveTo(x0 + s * 0.42, y); c.lineTo(x0 + s * (i === 1 ? 0.78 : 1), y); c.stroke();
    }
  } else if (id === 'design') {
    // 小さな入口と、深い中身
    c.fillRect(x0 + s * 0.36, y0 + s * 0.02, s * 0.28, s * 0.2);
    c.strokeRect(x0 + s * 0.1, y0 + s * 0.24, s * 0.8, s * 0.72);
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x0 + s * 0.22, y0 + s * (0.42 + i * 0.17)); c.lineTo(x0 + s * 0.78, y0 + s * (0.42 + i * 0.17)); c.stroke(); }
  } else if (id === 'tdd') {
    // 失敗（赤）から成功（緑）へ回る輪
    c.lineWidth = Math.max(2, s * 0.12);
    c.strokeStyle = pal.red;
    c.beginPath(); c.arc(cx, cy, s * 0.36, Math.PI * 0.95, Math.PI * 1.9); c.stroke();
    c.strokeStyle = pal.green;
    c.beginPath(); c.arc(cx, cy, s * 0.36, Math.PI * -0.05, Math.PI * 0.85); c.stroke();
    c.fillStyle = pal.green;
    const ax = cx + s * 0.36 * Math.cos(Math.PI * 0.85), ay = cy + s * 0.36 * Math.sin(Math.PI * 0.85);
    c.beginPath(); c.moveTo(ax - s * 0.14, ay - s * 0.02); c.lineTo(ax + s * 0.04, ay - s * 0.16); c.lineTo(ax + s * 0.06, ay + s * 0.08); c.closePath(); c.fill();
  } else if (id === 'review') {
    // 同じ紙を見る2つのレンズ
    c.strokeRect(x0 + s * 0.08, y0 + s * 0.62, s * 0.84, s * 0.3);
    for (const dx of [0.28, 0.72]) {
      c.beginPath(); c.arc(x0 + s * dx, y0 + s * 0.3, s * 0.2, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(x0 + s * dx, y0 + s * 0.5); c.lineTo(x0 + s * dx, y0 + s * 0.6); c.stroke();
    }
  }
  c.restore();
}
function drawBooks(c, L, p, d, pal) {
  const {u, f} = L;
  const st = shelfState(L, p);
  const headSize = lerp(f.small, f.label * 1.15, st.k);
  drawText(c, 'AIが読む手順書・4冊', st.region.x, st.region.y + st.head * 0.45, {size: headSize, weight: 700, color: pal.muted, max: st.region.w});
  d.skills.forEach((sk, i) => {
    const a = clamp01(p.books - i);
    if (a <= 0) return;
    const b0 = st.books[i];
    const b = {...b0, y: b0.y + (1 - easeOut(a)) * u * 0.8};
    alpha(c, a, () => {
      const spine = Math.max(3, b.w * 0.08), rad = Math.min(u * 0.15, 6);
      rr(c, b.x, b.y, b.w, b.h, rad);
      c.fillStyle = pal.sheet;
      c.fill();
      c.save(); rr(c, b.x, b.y, b.w, b.h, rad); c.clip(); c.fillStyle = pal.ink; c.fillRect(b.x, b.y, spine, b.h); c.restore();
      rr(c, b.x, b.y, b.w, b.h, rad);
      c.strokeStyle = pal.ink;
      c.lineWidth = 1.4;
      c.stroke();
      const size = Math.max(f.small, Math.min(b.h * 0.2, b.w * 0.24, f.label * 2.2));
      const inner = b.w - spine;
      skillIcon(c, sk.id, {x: b.x + spine + inner * 0.18, y: b.y + b.h * 0.1, w: inner * 0.64, h: b.h - size * 1.5 - b.h * 0.14}, pal);
      drawText(c, sk.book, b.x + spine + inner / 2, b.y + b.h - size * 0.8, {size, weight: 700, color: pal.ink, align: 'center', max: inner - 6});
    });
  });
}

// ---- 依頼と旧コード（架空の作例の入力） ----
function drawFixture(c, L, p, d, pal) {
  const {u, f, n} = L;
  const a = clamp01(p.fixture);
  for (const key of ['req', 'old']) {
    const r = n[key];
    alpha(c, val(p.show, key, 1) * val(p.emph, key, 1), () => {
      alpha(c, 0.35 + 0.65 * a, () => {
        const fold = paper(c, r, pal, u, {dashed: a < 0.5});
        const pad = Math.max(4, u * 0.35);
        const one = r.h < f.small * 3.2;
        const label = key === 'req' ? '依頼（架空）' : '旧コード';
        drawText(c, label, r.x + pad, r.y + (one ? r.h * 0.32 : pad + f.small * 0.7), {size: f.small, weight: 700, color: key === 'req' ? pal.flowInk : pal.ink, max: r.w - pad * 2 - fold});
        if (a < 0.5) return;
        const body = {x: r.x + pad, y: r.y + (one ? r.h * 0.52 : pad + f.small * 1.55), w: r.w - pad * 2, h: one ? r.h * 0.42 : r.h - pad * 2 - f.small * 1.55};
        if (key === 'req') drawWrapped(c, d.inputQuote, body, {size: f.small, min: 10, family: FONT.mincho, weight: 700, color: pal.ink, maxLines: one ? 1 : 3});
        else drawText(c, '表題だけを探す', body.x, body.y + Math.min(body.h, f.small * 1.4) / 2, {size: f.small * 0.95, color: pal.muted, max: body.w});
      });
    });
  }
  if (L.n.scope) {
    const r = L.n.scope;
    alpha(c, val(p.show, 'scope', 1) * val(p.emph, 'scope', 1) * a, () => {
      rr(c, r.x, r.y, r.w, r.h, u * 0.2);
      dashed(c, u, true);
      c.strokeStyle = pal.muted;
      c.lineWidth = 1.2;
      c.stroke();
      c.setLineDash([]);
      drawWrapped(c, `架空の依頼・合成データ${d.entries.length}件。共有サイトの検索は変えていない`, {x: r.x + u * 0.4, y: r.y + u * 0.2, w: r.w - u * 0.8, h: r.h - u * 0.4}, {size: f.small, color: pal.muted, maxLines: 2, valign: 'middle'});
    });
  }
}

// ---- AIが執筆（元の Opus 5.5 の別々の実行をまとめて表す1つの場所） ----
function drawAI(c, L, p, pal) {
  const {u, f, n, kind} = L, r = n.ai;
  rr(c, r.x, r.y, r.w, r.h, u * 0.35);
  c.fillStyle = pal.slab;
  c.fill();
  const pad = Math.max(5, u * 0.45);
  const big = Math.min(f.big * (kind === 'wide' ? 1.2 : 1), r.h * 0.32);
  drawText(c, 'AIが執筆', r.x + pad, r.y + pad + big * 0.6, {size: big, weight: 700, color: pal.slabInk, max: r.w - pad * 2, family: FONT.mincho});
  const sub = kind === 'wide' ? 'テスト・コード・用語集・仕様を書く。工程ごとに別の実行' : '工程ごとに別の実行';
  drawWrapped(c, sub, {x: r.x + pad, y: r.y + pad + big * 1.3, w: r.w - pad * 2, h: r.h - pad * 2 - big * 1.3}, {size: f.small, color: pal.slabInk, maxLines: kind === 'wide' ? 3 : 2});
}

// ---- Node（制作担当が実行）。3段は同じ輪とタブで示す ----
function drawNode(c, L, p, d, job, pal) {
  const {u, f, n, kind} = L, r = n.node;
  const pad = Math.max(4, u * 0.32), rad = u * 0.2;
  rr(c, r.x, r.y, r.w, r.h, rad);
  c.fillStyle = pal.sheet;
  c.fill();
  const hh = Math.max(f.small * 1.55, r.h * 0.17);
  c.save(); rr(c, r.x, r.y, r.w, r.h, rad); c.clip(); c.fillStyle = pal.ink; c.fillRect(r.x, r.y, r.w, hh); c.restore();
  rr(c, r.x, r.y, r.w, r.h, rad);
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.5;
  c.stroke();
  const nw = drawText(c, 'Node', r.x + pad, r.y + hh / 2, {size: f.small, weight: 700, color: pal.bg, max: r.w * 0.4});
  drawText(c, kind === 'wide' ? `${d.nodeVersion}・制作担当が実行` : '制作担当', r.x + r.w - pad, r.y + hh / 2, {size: f.small * 0.95, color: pal.bg, align: 'right', max: r.w - nw - pad * 3});
  const st = nodeState(p.loop, d);
  const col = st.kind === 'red' ? pal.red : pal.green, soft = st.kind === 'red' ? pal.redSoft : pal.greenSoft;
  const tabsH = Math.max(f.small * 1.45, r.h * 0.17);
  const b = {x: r.x + pad, y: r.y + hh + pad * 0.6, w: r.w - pad * 2, h: r.h - hh - tabsH - pad * 1.9};
  rr(c, b.x, b.y, b.w, b.h, u * 0.12);
  c.fillStyle = soft;
  c.fill();
  c.strokeStyle = col;
  c.lineWidth = 2;
  c.stroke();
  const word = st.kind === 'red' ? 'RED' : st.kind === 'green' ? 'GREEN' : '既存';
  const main = st.kind === 'red' ? `失敗 ${st.run.fail}` : `成功 ${st.run.pass}`;
  const s1 = Math.max(10, Math.min(f.small, b.h * 0.24)), s2 = Math.max(12, Math.min(f.big * 1.15, b.h * 0.42));
  if (kind === 'wide') {
    drawText(c, word, b.x + pad, b.y + b.h * 0.3, {size: s1 * 1.1, weight: 700, color: col, max: b.w * 0.5});
    drawText(c, main, b.x + pad, b.y + b.h * 0.68, {size: s2, weight: 700, color: col, max: b.w * 0.6});
    drawText(c, `全${st.run.tests}件`, b.x + b.w - pad, b.y + b.h * 0.68, {size: s1, color: col, align: 'right', max: b.w * 0.35});
  } else {
    drawText(c, `${word}・全${st.run.tests}件`, b.x + b.w / 2, b.y + b.h * 0.27, {size: s1, weight: 700, color: col, align: 'center', max: b.w - 4});
    drawText(c, main, b.x + b.w / 2, b.y + b.h * 0.67, {size: s2, weight: 700, color: col, align: 'center', max: b.w - 4});
  }
  const tg = Math.max(3, u * 0.2), tw = (r.w - pad * 2 - tg * 2) / 3, ty = r.y + r.h - pad - tabsH;
  for (let i = 0; i < 3; i++) {
    const tx = r.x + pad + i * (tw + tg);
    const done = p.loop >= i + 0.65;
    const active = !done && st.k === i + 1 && st.kind === 'red';
    rr(c, tx, ty, tw, tabsH, u * 0.1);
    c.fillStyle = done ? pal.greenSoft : pal.sheet;
    c.fill();
    dashed(c, u, !done && !active);
    c.strokeStyle = done ? pal.green : active ? pal.red : pal.muted;
    c.lineWidth = active ? 2.4 : 1.2;
    c.stroke();
    c.setLineDash([]);
    drawText(c, `段${i + 1}`, tx + tw / 2, ty + tabsH / 2, {size: Math.min(f.small, tabsH * 0.62), weight: 700, color: done ? pal.green : active ? pal.red : pal.muted, align: 'center', max: tw - 4});
    if (job && job.cycle === i + 1) { c.fillStyle = pal.flow; c.fillRect(tx + tw * 0.15, ty + tabsH + 1.5, tw * 0.7, Math.max(2, u * 0.14)); }
  }
}
function drawExtra(c, L, p, d, pal) {
  const {u, f, n, kind} = L, r = n.extra;
  const a = clamp01(p.extra);
  rr(c, r.x, r.y, r.w, r.h, u * 0.15);
  dashed(c, u, a < 0.5);
  c.strokeStyle = a < 0.5 ? pal.rule : pal.green;
  c.lineWidth = 1.2;
  c.stroke();
  c.setLineDash([]);
  if (a <= 0.01) return;
  alpha(c, a, () => {
    const label = kind === 'wide' ? `テストとは別の確認 ${d.acceptance.passed}/${d.acceptance.checks}` : `別の確認 ${d.acceptance.passed}/${d.acceptance.checks}`;
    drawText(c, label, r.x + r.w / 2, r.y + r.h / 2, {size: Math.min(f.small, r.h * 0.62), weight: 700, color: pal.green, align: 'center', max: r.w - u * 0.4});
  });
}

// ---- 用語集と仕様 ----
function drawDocs(c, L, p, d, pal) {
  const {u, f, n} = L;
  const a = clamp01(p.docs);
  const items = [['docsG', '用語集', d.glossaryTerms.length, '語'], ['docsS', '仕様', d.specCount, '条件']];
  for (const [key, name, num, unit] of items) {
    const r = n[key];
    alpha(c, val(p.show, key, 1) * val(p.emph, key, 1), () => {
      const fold = paper(c, r, pal, u, {dashed: a < 0.5, stroke: a < 0.5 ? pal.muted : pal.ink});
      const pad = Math.max(4, u * 0.35);
      drawText(c, name, r.x + pad, r.y + r.h * 0.32, {size: f.small, weight: 700, color: a < 0.5 ? pal.muted : pal.ink, max: r.w - pad * 2 - fold});
      if (a <= 0.01) return;
      alpha(c, a, () => {
        const size = Math.min(f.big, r.h * 0.42);
        const w = drawText(c, String(num), r.x + pad, r.y + r.h * 0.7, {size, weight: 700, color: pal.ink});
        drawText(c, unit, r.x + pad + w + 3, r.y + r.h * 0.72, {size: f.small, color: pal.muted, max: r.w - w - pad * 3});
      });
    });
  }
}

// ---- 1つの入口を持つ検索モジュール ----
function drawModule(c, L, p, d, pal) {
  const {u, f, n} = L, m = n.module, bar = n.modBar;
  const a = clamp01(p.iface);
  const pad = Math.max(4, u * 0.32);
  rr(c, m.x, m.y, m.w, m.h, u * 0.25);
  c.fillStyle = pal.sheet;
  c.fill();
  dashed(c, u, a < 0.5);
  c.strokeStyle = a < 0.5 ? pal.muted : pal.ink;
  c.lineWidth = 1.6;
  c.stroke();
  c.setLineDash([]);
  alpha(c, a, () => {
    c.save(); rr(c, m.x, m.y, m.w, m.h, u * 0.25); c.clip(); c.fillStyle = pal.ink; c.fillRect(bar.x, bar.y, bar.w, bar.h); c.restore();
    const cs = Math.min(f.label * 1.1, bar.w * 0.62);
    drawText(c, '入', bar.x + bar.w / 2, m.y + m.h / 2 - cs * 0.6, {size: cs, weight: 700, color: pal.bg, align: 'center'});
    drawText(c, '口', bar.x + bar.w / 2, m.y + m.h / 2 + cs * 0.6, {size: cs, weight: 700, color: pal.bg, align: 'center'});
  });
  const bx = m.x + bar.w + pad, bw = m.w - bar.w - pad * 2;
  drawText(c, 'searchEntries', bx, m.y + pad + f.small * 0.7, {size: f.small, weight: 700, family: FONT.mono, color: a < 0.5 ? pal.muted : pal.ink, max: bw});
  const seamH = Math.max(f.small * 1.6, m.h * 0.12);
  const top = m.y + pad + f.small * 1.55, bottom = m.y + m.h - pad - seamH - pad * 0.6;
  const gap = Math.max(2, pad * 0.45);
  const lh = (bottom - top - gap * 2) / 3;
  d.cycles.forEach((cy, i) => {
    const r = {x: bx, y: top + i * (lh + gap), w: bw, h: lh};
    const k = clamp01((p.loop - i - 0.72) / 0.12);
    rr(c, r.x, r.y, r.w, r.h, u * 0.1);
    c.fillStyle = pal.bg;
    c.fill();
    if (k > 0) alpha(c, k, () => { c.fillStyle = pal.tint; c.fill(); });
    dashed(c, u, k < 0.5);
    c.strokeStyle = k < 0.5 ? pal.rule : pal.ink;
    c.lineWidth = 1.1;
    c.stroke();
    c.setLineDash([]);
    drawText(c, cy.label, r.x + pad * 0.6, r.y + r.h / 2, {size: Math.min(f.small, r.h * 0.68), weight: k >= 0.5 ? 700 : 400, color: k >= 0.5 ? pal.ink : pal.muted, max: r.w - pad * 1.2});
  });
  const tag = {x: bx, y: m.y + m.h - pad - seamH, w: bw, h: seamH};
  alpha(c, clamp01(p.seam), () => {
    rr(c, tag.x, tag.y, tag.w, tag.h, u * 0.1);
    dashed(c, u, true);
    c.strokeStyle = pal.red;
    c.lineWidth = 1.2;
    c.stroke();
    c.setLineDash([]);
    drawText(c, L.kind === 'wide' ? 'seam：事前決定・利用者は未確認' : 'seam：利用者未確認', tag.x + tag.w / 2, tag.y + tag.h / 2, {size: Math.min(f.small, tag.h * 0.6), weight: 700, color: pal.red, align: 'center', max: tag.w - 4});
  });
}

// ---- 固定差分と2つの目（照合だけで、書き換えない） ----
function lensIcon(c, x, y, s, pal, col) {
  c.save();
  c.lineWidth = Math.max(1.6, s * 0.12);
  c.strokeStyle = col;
  c.beginPath(); c.arc(x, y, s * 0.36, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(x + s * 0.26, y + s * 0.26); c.lineTo(x + s * 0.5, y + s * 0.5); c.stroke();
  c.restore();
}
function drawReview(c, L, p, d, pal) {
  const {u, f, n, s, kind} = L;
  const dr = n.diff, pad = Math.max(4, u * 0.32);
  alpha(c, val(p.show, 'diff', 1) * val(p.emph, 'diff', 1), () => {
    const a = clamp01(p.diff);
    const fold = paper(c, dr, pal, u, {dashed: a < 0.5, stroke: a < 0.5 ? pal.muted : pal.ink});
    const marks = Math.min(dr.h * 0.7, u * 1.2);
    if (a > 0.01) alpha(c, a, () => {
      c.strokeStyle = pal.ink;
      c.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) {
        const y = dr.y + dr.h * (0.35 + i * 0.3);
        const x = dr.x + pad;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + marks * 0.35, y);
        if (i === 0) { c.moveTo(x + marks * 0.175, y - marks * 0.175); c.lineTo(x + marks * 0.175, y + marks * 0.175); }
        c.stroke();
      }
    });
    const tx = dr.x + pad + marks * 0.55;
    drawText(c, kind === 'wide' ? '固定差分（4コミット）・書き換えない' : '固定差分', tx, dr.y + dr.h / 2, {size: Math.min(f.small, dr.h * 0.5), weight: 700, color: a < 0.5 ? pal.muted : pal.ink, max: dr.x + dr.w - fold - tx - 2});
  });
  const lenses = [['lensA', 'sightA', '規約', 'Standards', d.review.standards, p.lensA, p.findA], ['lensB', 'sightB', '仕様', 'Spec', d.review.spec, p.lensB, p.findB]];
  for (const [key, sight, ja, en, findings, shown, found] of lenses) {
    const r = n[key];
    alpha(c, val(p.show, key, 1) * val(p.emph, key, 1), () => {
      const a = clamp01(shown);
      rr(c, r.x, r.y, r.w, r.h, r.h / 2);
      c.fillStyle = pal.sheet;
      c.fill();
      dashed(c, u, a < 0.5);
      c.strokeStyle = a < 0.5 ? pal.muted : pal.ink;
      c.lineWidth = 1.4;
      c.stroke();
      c.setLineDash([]);
      const is = Math.min(r.h * 0.8, u * 1.8);
      lensIcon(c, r.x + r.h * 0.2 + is * 0.4, r.y + r.h / 2 - is * 0.06, is, pal, a < 0.5 ? pal.muted : pal.ink);
      const tx = r.x + r.h * 0.2 + is + pad * 0.5;
      const label = kind === 'wide' ? `${ja}（${en}）` : ja;
      const lw = drawText(c, label, tx, r.y + r.h / 2, {size: Math.min(f.small, r.h * 0.5), weight: 700, color: a < 0.5 ? pal.muted : pal.ink, max: r.w * 0.5});
      const k = clamp01(found);
      if (k > 0.01) alpha(c, k, () => {
        drawText(c, kind === 'wide' ? `指摘 ${findings}件` : `${findings}件`, r.x + r.w - r.h * 0.45, r.y + r.h / 2, {size: Math.min(f.label, r.h * 0.56), weight: 700, color: pal.ink, align: 'right', max: r.w - (tx - r.x) - lw - r.h * 0.5});
      });
      if (a > 0.01) alpha(c, a, () => strokePath(c, s[sight], 1, {color: pal.muted, width: 1.2, dash: [3, 3]}));
    });
  }
}

// ---- 同じ6件の掲載項目 ----
function drawEntries(c, L, p, d, job, pal) {
  const {u, f, n} = L, er = n.entries;
  drawText(c, `同じ掲載項目 ${d.entries.length}件`, er.x, er.y + f.small * 0.75, {size: f.small, weight: 700, color: pal.muted, max: er.w});
  const decided = clamp01(p.results * 3);
  const hits = job ? new Set(job.final.map((e) => e.id)) : new Set();
  d.entries.forEach((entry, i) => {
    const r = n.strip[i];
    const hit = hits.has(entry.id);
    alpha(c, 1 - (hit ? 0 : 0.5 * decided), () => {
      rr(c, r.x, r.y, r.w, r.h, u * 0.1);
      c.fillStyle = pal.sheet;
      c.fill();
      c.strokeStyle = pal.rule;
      c.lineWidth = 1;
      c.stroke();
      const notch = Math.max(4, u * 0.38);
      c.fillStyle = hit && decided > 0 ? pal.hit : pal.rule;
      if (hit && decided > 0) alpha(c, decided, () => c.fillRect(r.x, r.y, notch, r.h));
      else c.fillRect(r.x, r.y, Math.max(2, notch * 0.4), r.h);
      const tx = r.x + notch + Math.max(3, u * 0.25), tw = r.w - (tx - r.x) - 3;
      const two = r.h >= f.small * 2.7;
      if (two) {
        drawText(c, entry.title, tx, r.y + r.h * 0.33, {size: f.small, weight: 700, color: pal.ink, max: tw});
        drawText(c, entry.tags.join('・'), tx, r.y + r.h * 0.72, {size: Math.max(10, f.small * 0.85), color: pal.muted, max: tw});
      } else {
        drawText(c, entry.title, tx, r.y + r.h / 2, {size: Math.min(f.small, r.h * 0.72), weight: 700, color: pal.ink, max: tw});
      }
    });
  });
}

// ---- 原関数が返した掲載項目（実際の戻り値から描く） ----
function drawResults(c, L, p, d, job, pal) {
  const {u, f, n} = L, rs = n.results;
  const a = clamp01(p.results);
  if (!job || a <= 0.001) {
    n.card.forEach((r) => {
      rr(c, r.x, r.y, r.w, r.h, u * 0.15);
      dashed(c, u, true);
      c.strokeStyle = pal.rule;
      c.lineWidth = 1.1;
      c.stroke();
      c.setLineDash([]);
    });
    drawText(c, '原関数の結果', rs.x, rs.y + f.small * 0.8, {size: f.small, weight: 700, color: pal.muted, max: rs.w});
    return;
  }
  const head = `${queryText(job.query)}${categoryText(job.category)} → ${job.final.length}件`;
  alpha(c, clamp01(a * 4), () => {
    const hw = drawText(c, head, rs.x, rs.y + f.small * 0.8, {size: f.small, weight: 700, color: pal.ink, max: rs.w * 0.72});
    drawText(c, `旧コード ${job.baseline.length}件`, rs.x + rs.w, rs.y + f.small * 0.8, {size: f.small * 0.95, color: pal.muted, align: 'right', max: rs.w - hw - u});
  });
  const start = {x: L.e.modRes[0][0] - u, y: L.e.modRes[0][1] - u, w: u * 2, h: u * 2};
  job.final.forEach((entry, i) => {
    const target = n.card[i];
    if (!target) return;
    const k = easeOut(clamp01((a - i * 0.18) / 0.5));
    if (k <= 0.001) return;
    const r = k >= 1 ? target : lerpRect(start, target, k);
    alpha(c, Math.min(1, k * 1.6), () => {
      rr(c, r.x, r.y, r.w, r.h, u * 0.15);
      c.fillStyle = pal.sheet;
      c.fill();
      c.strokeStyle = pal.ink;
      c.lineWidth = 1.4;
      c.stroke();
      if (k < 0.85) return;
      const pad = Math.max(4, u * 0.35);
      c.fillStyle = pal.hit;
      c.fillRect(r.x, r.y, r.w, Math.max(4, u * 0.32));
      const inner = {x: r.x + pad, y: r.y + Math.max(4, u * 0.32) + pad * 0.6, w: r.w - pad * 2, h: r.h - Math.max(4, u * 0.32) - pad * 1.6};
      const t = drawWrapped(c, entry.title, {x: inner.x, y: inner.y, w: inner.w, h: inner.h * 0.55}, {size: f.label, min: 11, weight: 700, color: pal.ink, maxLines: 2});
      drawWrapped(c, entry.tags.join('・'), {x: inner.x, y: inner.y + Math.max(t.height, f.label) + pad * 0.5, w: inner.w, h: inner.h * 0.45 - pad * 0.5}, {size: f.small * 0.92, min: 10, color: pal.muted, maxLines: 2});
    });
  });
}

// ---- 保存したJSONと、元の検索台 ----
function drawFiles(c, L, p, job, pal) {
  const {u, f, n} = L;
  const a = clamp01(p.files);
  const ready = a >= 0.5 && job;
  const jr = n.json, pad = Math.max(4, u * 0.4);
  alpha(c, val(p.show, 'json', 1) * val(p.emph, 'json', 1), () => {
    paper(c, jr, pal, u, {dashed: !ready, stroke: ready ? pal.ink : pal.muted});
    const g = Math.min(jr.h * 0.34, f.big * 1.2);
    drawText(c, '{ }', jr.x + pad, jr.y + pad + g * 0.6, {size: g, weight: 700, family: FONT.mono, color: ready ? pal.flowInk : pal.muted});
    drawText(c, '保存した結果', jr.x + pad, jr.y + jr.h - pad - f.small * 2.1, {size: f.small, weight: 700, color: ready ? pal.ink : pal.muted, max: jr.w - pad * 2});
    if (ready) alpha(c, a, () => {
      drawText(c, `${job.output.file}・${job.output.bytes.toLocaleString('en-US')} B`, jr.x + pad, jr.y + jr.h - pad - f.small * 0.7, {size: f.small, color: pal.muted, max: jr.w - pad * 2, family: FONT.sans});
    });
  });
  const dr = n.desk;
  alpha(c, val(p.show, 'desk', 1) * val(p.emph, 'desk', 1), () => {
    rr(c, dr.x, dr.y, dr.w, dr.h, u * 0.25);
    c.fillStyle = pal.sheet;
    c.fill();
    dashed(c, u, !ready);
    c.strokeStyle = ready ? pal.ink : pal.muted;
    c.lineWidth = 1.4;
    c.stroke();
    c.setLineDash([]);
    const field = {x: dr.x + pad, y: dr.y + pad, w: dr.w - pad * 2, h: Math.min(dr.h * 0.3, f.label * 2)};
    rr(c, field.x, field.y, field.w, field.h, u * 0.1);
    c.strokeStyle = ready ? pal.ink : pal.muted;
    c.lineWidth = 1.2;
    c.stroke();
    lensIcon(c, field.x + field.w - field.h * 0.55, field.y + field.h / 2 - field.h * 0.05, field.h * 0.75, pal, ready ? pal.ink : pal.muted);
    if (ready) drawText(c, job.query === '' ? '（空）' : job.query, field.x + pad * 0.6, field.y + field.h / 2, {size: Math.min(f.small, field.h * 0.6), color: pal.ink, max: field.w - field.h * 1.2});
    drawText(c, '元の検索台', dr.x + pad, dr.y + dr.h - pad - f.small * 2.1, {size: f.small, weight: 700, color: ready ? pal.ink : pal.muted, max: dr.w - pad * 2});
    drawText(c, '好きな語で試す', dr.x + pad, dr.y + dr.h - pad - f.small * 0.7, {size: f.small, color: pal.muted, max: dr.w - pad * 2});
  });
}

// ---- 動くもの：テストとコードの紙、入口へ向かう6件 ----
function movingPaper(c, L, pt, label, pal, col) {
  const {u, f} = L;
  const w = Math.max(u * 2.6, f.small * 4.2), h = Math.max(u * 1.6, f.small * 1.9);
  const r = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
  paper(c, r, pal, u * 0.7, {stroke: col, lw: 1.8});
  drawText(c, label, r.x + w * 0.45, r.y + h / 2, {size: Math.min(f.small, h * 0.55), weight: 700, color: col, align: 'center', max: w - u * 0.9});
}
function drawMovers(c, L, p, d, job, pal) {
  const {u, e, n} = L;
  if (p.loop > 0 && p.loop < 3) {
    const k = Math.min(3, Math.floor(p.loop) + 1), ph = p.loop - (k - 1);
    const test = prog(ph, 0.02, 0.23), code = prog(ph, 0.42, 0.62);
    if (ph > 0.01 && ph < 0.32) alpha(c, 1 - prog(ph, 0.24, 0.32), () => movingPaper(c, L, pointAt(e.aiNode, ease(test)), L.kind === 'wide' ? `テスト+1（段${k}）` : 'テスト+1', pal, pal.flowInk));
    if (ph >= 0.4 && ph < 0.72) alpha(c, 1 - prog(ph, 0.64, 0.72), () => movingPaper(c, L, pointAt(e.aiNode, ease(code)), '最小の変更', pal, pal.ink));
  }
  const t = clamp01(p.travel);
  if (t > 0 && t < 1) {
    // 各紙は自分の位置から、入口の線と同じ折れ方で入口へ向かう
    const em = e.entMod, mouth = em[em.length - 1];
    n.strip.forEach((r, i) => {
      const k = clamp01((t - i * 0.08) / 0.55);
      if (k <= 0 || k >= 1) return;
      const y = r.y + r.h / 2, sx = r.x + r.w;
      const gx = em.length >= 3 ? em[em.length - 2][0] : (sx + mouth[0]) / 2;
      const path = [[sx, y], [gx, y], [gx, mouth[1]], [mouth[0], mouth[1]]];
      const pt = pointAt(path, ease(k));
      const w = Math.min(r.w * 0.55, u * 3), h = Math.min(r.h * 0.7, u * 1.5);
      alpha(c, 1 - prog(k, 0.8, 1), () => {
        rr(c, pt.x - w / 2, pt.y - h / 2, w, h, u * 0.08);
        c.fillStyle = pal.sheet;
        c.fill();
        c.strokeStyle = pal.flow;
        c.lineWidth = 1.6;
        c.stroke();
      });
    });
  }
}

export function drawConcept(c, L, p, d, pal, jobId) {
  const job = d.jobs[jobId] || null;
  const {n, e, u} = L;
  const show = (k) => clamp01(val(p.show, k, 1));
  const nodeA = (k) => show(k) * val(p.emph, k, 1);
  // 輪の流れ（テストとコードはNodeへ、結果はAIへ戻る・GREENのたびにコードが入口の中身へ）
  const flow = {...p.flow};
  let backColor = pal.flow;
  if (p.loopFlows && p.loop > 0 && p.loop < 3) {
    const k = Math.min(3, Math.floor(p.loop) + 1), ph = p.loop - (k - 1);
    flow.aiNode = Math.max(span(ph, 0.02, 0.1, 0.22, 0.27), span(ph, 0.42, 0.5, 0.6, 0.66));
    const redBack = span(ph, 0.26, 0.31, 0.37, 0.41), greenBack = span(ph, 0.66, 0.71, 0.77, 0.81);
    flow.nodeAi = Math.max(redBack, greenBack);
    backColor = redBack > greenBack ? pal.red : pal.green;
    flow.loopMod = span(ph, 0.68, 0.74, 0.86, 0.92);
  }
  c.save();
  c.lineCap = 'round';
  for (const key of ALL_EDGES) {
    const k = val(p.draw, key, 1);
    if (k <= 0.001) continue;
    const group = EDGE_GROUP[key];
    alpha(c, val(p.emphEdge, group, 1), () => strokePath(c, e[key], k, {color: pal.ink, width: Math.max(1.2, u * 0.08), head: Math.max(5, u * 0.42)}));
    const fl = val(flow, key, 0);
    if (fl > 0) strokePath(c, e[key], Math.min(k, fl), {color: key === 'nodeAi' ? backColor : pal.flow, width: Math.max(2.2, u * 0.16), head: Math.max(6, u * 0.5)});
  }
  alpha(c, nodeA('books'), () => drawBooks(c, L, p, d, pal));
  drawFixture(c, L, p, d, pal);
  alpha(c, nodeA('ai'), () => drawAI(c, L, p, pal));
  alpha(c, nodeA('node'), () => drawNode(c, L, p, d, job, pal));
  alpha(c, nodeA('extra'), () => drawExtra(c, L, p, d, pal));
  drawDocs(c, L, p, d, pal);
  alpha(c, nodeA('module'), () => drawModule(c, L, p, d, pal));
  drawReview(c, L, p, d, pal);
  alpha(c, nodeA('entries'), () => drawEntries(c, L, p, d, job, pal));
  alpha(c, nodeA('results'), () => drawResults(c, L, p, d, job, pal));
  drawFiles(c, L, p, job, pal);
  drawMovers(c, L, p, d, job, pal);

  const box = (k) => focusBox(c, L, k === 'books' ? shelfRegion(L, p) : n[k], pal);
  if (p.focusPart && PART_NODES[p.focusPart]) PART_NODES[p.focusPart].forEach(box);
  if (p.focusSkill && SKILL_NODES[p.focusSkill]) {
    SKILL_NODES[p.focusSkill].forEach(box);
    const i = SKILL_IDS.indexOf(p.focusSkill);
    if (i >= 0) focusBox(c, L, shelfState(L, p).books[i], pal);
  }
  c.restore();
}

// ---------- ページ ----------
const STAGES = Object.freeze([
  {name: '読む', note: (d) => `AIが4冊の手順書（言葉・入口・テスト・照合）を読み、架空の依頼と旧コードから、用語集${d.glossaryTerms.length}語と仕様${d.specCount}条件を書きました。検索の入口は searchEntries の1つ。入口は制作担当が事前に決め、利用者の確認はしていません。`},
  {name: '確かめる', note: (d, j) => `AIが書いた同じテストを、制作担当が別にNodeで実行。各段で新しい1件だけが失敗（RED）してから、最小の変更で全件成功（GREEN）。テストは${d.cycles.map((x) => x.green.tests).join('→')}件と1件ずつ増えました。「${j.label}」は段${j.cycle}で足した例です。最後の固定差分は、元の独立AI2つが規約と仕様を別々に照合し、指摘は各0件でした（人の承認ではありません）。`},
  {name: '使う', note: (d, j) => `このページで原関数 searchEntries を呼び、同じ${d.entries.length}件に${queryText(j.query)}・${categoryText(j.category)}を通すと${j.final.length}件（旧コードは${j.baseline.length}件）。黄色の掲載項目は、関数が返したものそのものです。順序は保存した ${j.output.file} と同じです。`},
]);
const THEME_KEY = 'studio-yebisu.matt-pocock-skills-example.theme';
const SPEED = [1.6, 4.6, 1.9];
const tauToTime = (x) => { let t = 0; for (let i = 0; i < 3; i++) t += clamp01(x - i) * SPEED[i]; return t; };
const timeToTau = (t) => { let x = 0; for (let i = 0; i < 3; i++) { if (t <= SPEED[i]) return x + t / SPEED[i]; t -= SPEED[i]; x += 1; } return 3; };

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// 操作中の同期コピーを先に試し、だめなら非同期のクリップボードを使う。どちらも失敗したら false。
async function copyText(text) {
  const tmp = h('textarea', {class: 'offscreen', readonly: true, 'aria-hidden': 'true', tabindex: '-1'});
  tmp.value = text;
  document.body.append(tmp);
  tmp.select();
  tmp.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  tmp.remove();
  if (ok) return true;
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* 下で失敗として伝える */ }
  return false;
}

function applyStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark' || t === 'system') document.documentElement.dataset.theme = t;
  } catch { /* 保存を読めなくても端末の設定で表示する */ }
}

function initPage() {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const canvas = $('concept-map');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const statusEl = $('load-status'), retryBtn = $('retry');
  const dynLinks = ['save-json', 'open-desk', 'json-current'].map($);
  const dependents = () => document.querySelectorAll('button[data-stage], #replay, button[data-sample], button[data-part], button[data-skill], #copy-request');
  const readouts = ['save-meta', 'stage-note', 'case-io', 'case-result', 'case-ids', 'case-match-text', 'part-label', 'part-meaning', 'part-quote', 'part-source',
    'skill-label', 'skill-name', 'skill-meaning', 'skill-scope', 'skill-quote', 'skill-source',
    'seam-call', 'seam-actor', 'seam-catch', 'seam-miss', 'seam-quote', 'seam-source',
    'request-status', 'cycle-baseline', 'cycle-list', 'acceptance-line', 'acceptance-list', 'review-std', 'review-spec', 'review-range'];
  const areas = ['request-text'].map($);

  let data = null;
  let caseId = JOB_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'wide-ui';
  let stage = 0, tau = 0, raf = 0, part = null, skill = null, loadGen = 0, controller = null;

  // 表示の色（このページだけの保存先）
  const themeButtons = document.querySelectorAll('button[data-theme-choice]');
  const theme = () => root.dataset.theme || 'system';
  const resolved = () => (theme() === 'system' ? (darkMq.matches ? 'dark' : 'light') : theme());
  function setTheme(t, save) {
    root.dataset.theme = t;
    themeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === t)));
    if (save) { try { localStorage.setItem(THEME_KEY, t); } catch { /* 保存できなくても表示は切り替える */ } }
    draw();
  }
  themeButtons.forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themeChoice, true)));
  darkMq.addEventListener?.('change', () => { if (theme() === 'system') draw(); });

  // 図
  function draw() {
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const pal = PALETTES[resolved()];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (!data) return;
    const L = conceptLayout(chooseKind(W, H), W, H);
    const p = storyParams(tau);
    p.focusPart = part;
    p.focusSkill = skill;
    drawConcept(ctx, L, p, data, pal, caseId);
  }
  new ResizeObserver(() => draw()).observe(canvas);

  function stopAnim() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function animate(from, to) {
    stopAnim();
    if (reduce.matches || from === to) { tau = to; draw(); return; }
    const t0 = tauToTime(from), t1 = tauToTime(to), dur = Math.abs(t1 - t0) * 1000;
    const start = performance.now();
    tau = from;
    const tick = (now) => {
      const k = clamp01((now - start) / dur);
      tau = timeToTau(t0 + (t1 - t0) * k);
      draw();
      raf = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    raf = requestAnimationFrame(tick);
  }
  reduce.addEventListener?.('change', () => { if (reduce.matches && raf) { stopAnim(); tau = stage + 1; draw(); } });
  function stageNote() { return data ? `${STAGES[stage].name}：${STAGES[stage].note(data, data.jobs[caseId])}` : ''; }
  function setStage(i, replay) {
    stage = i;
    document.querySelectorAll('button[data-stage]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === i)));
    $('stage-note').textContent = stageNote();
    const target = i + 1;
    animate(replay || target < tau ? i : tau, target);
  }
  document.querySelectorAll('button[data-stage]').forEach((b) => b.addEventListener('click', () => { if (data) setStage(Number(b.dataset.stage), false); }));
  $('replay').addEventListener('click', () => { if (data) setStage(stage, true); });

  // 3件：保存リンク・元の検索台・読み出しを、選んだ件にそろえる
  function renderCase() {
    const job = data.jobs[caseId];
    document.querySelectorAll('button[data-sample]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sample === caseId)));
    const save = $('save-json');
    save.href = job.output.url;
    save.setAttribute('download', job.output.download);
    $('open-desk').href = `desk.html#${caseId}`;
    const cur = $('json-current');
    cur.href = job.output.url;
    cur.textContent = job.output.path;
    for (const a of dynLinks) a.removeAttribute('aria-disabled');
    $('save-meta').textContent = `${job.output.path}・${job.output.bytes.toLocaleString('en-US')} B・SHA-256 ${job.output.sha256.slice(0, 12)}…　照合済み・原関数の結果と同じ順序`;
    $('case-io').textContent = `検索語${queryText(job.query)}・分野 ${job.category}（${categoryText(job.category)}）。保存した例「${job.label}」。`;
    $('case-result').textContent = `このページで呼んだ原関数の結果：search.mjs は${job.final.length}件、旧コードの baseline/search.mjs は${job.baseline.length}件。`;
    $('case-ids').replaceChildren(...job.final.map((e) => h('li', {}, h('b', {}, e.title), `　${e.id}・分野 ${e.category}・タグ ${e.tags.join('、')}`)));
    $('case-match-text').textContent = `返った順序は、保存した記録と同じです。保存ファイル：`;
    $('request-status').textContent = '';
    $('stage-note').textContent = stageNote();
  }
  document.querySelectorAll('button[data-sample]').forEach((b) => b.addEventListener('click', () => {
    if (!data || !JOB_IDS.includes(b.dataset.sample)) return;
    caseId = b.dataset.sample;
    history.replaceState(null, '', `#${caseId}`);
    renderCase();
    draw();
  }));
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (data && JOB_IDS.includes(id) && id !== caseId) { caseId = id; renderCase(); draw(); }
  });

  // 6つの部分・4冊
  const sourceLinks = (x) => [
    h('a', {href: x.url}, `${x.shortPath} の${x.line_start}行目`), '　',
    h('a', {href: x.lineUrl, rel: 'noopener'}, '固定版の該当行（GitHub）'),
  ];
  function renderPart() {
    const x = data && part ? data.parts.find((y) => y.id === part) : null;
    $('part-label').textContent = x ? x.label : '';
    $('part-meaning').textContent = x ? x.meaning : '';
    $('part-quote').textContent = x ? x.quote : '';
    $('part-source').replaceChildren(...(x ? sourceLinks(x) : []));
  }
  function renderSkill() {
    const x = data && skill ? data.skills.find((y) => y.id === skill) : null;
    $('skill-label').textContent = x ? x.label : '';
    $('skill-name').textContent = x ? `${x.name}（skills/engineering/${x.name}/SKILL.md）` : '';
    $('skill-meaning').textContent = x ? x.meaning : '';
    $('skill-scope').textContent = x ? `この作例での範囲：${x.scopeText}` : '';
    $('skill-quote').textContent = x ? x.quote : '';
    $('skill-source').replaceChildren(...(x ? sourceLinks(x) : []));
  }
  document.querySelectorAll('button[data-part]').forEach((b) => b.addEventListener('click', () => {
    if (!data) return;
    part = part === b.dataset.part ? null : b.dataset.part;
    document.querySelectorAll('button[data-part]').forEach((y) => y.setAttribute('aria-pressed', String(y.dataset.part === part)));
    renderPart();
    draw();
  }));
  document.querySelectorAll('button[data-skill]').forEach((b) => b.addEventListener('click', () => {
    if (!data) return;
    skill = skill === b.dataset.skill ? null : b.dataset.skill;
    document.querySelectorAll('button[data-skill]').forEach((y) => y.setAttribute('aria-pressed', String(y.dataset.skill === skill)));
    renderSkill();
    draw();
  }));

  // 入口・記録
  function renderFixed() {
    const sm = data.seam;
    $('seam-call').textContent = sm.call;
    $('seam-actor').textContent = `${sm.actor}。利用者との確認：なし。`;
    $('seam-catch').textContent = sm.catch;
    $('seam-miss').textContent = sm.miss;
    $('seam-quote').textContent = sm.quote.quote;
    $('seam-source').replaceChildren(...sourceLinks(sm.quote));
    const b = data.baselineRun;
    $('cycle-baseline').textContent = `変更前：既存のテスト${b.tests}件・成功${b.pass}件・終了コード${b.exit_code}。`;
    $('cycle-list').replaceChildren(...data.cycles.map((cy) => h('li', {},
      h('b', {}, `段${cy.id}　${cy.label}`),
      h('span', {class: 'cy-test'}, `足したテスト：${cy.newTest}`),
      h('span', {class: 'cy-run'},
        h('span', {class: 'tag-red'}, `RED　${cy.red.tests}件中 失敗${cy.red.fail}・終了コード${cy.red.exit_code}`), ' → ',
        h('span', {class: 'tag-green'}, `GREEN　${cy.green.tests}件中 成功${cy.green.pass}・終了コード${cy.green.exit_code}`)),
      h('span', {class: 'cy-files'},
        h('a', {href: `tdd/red${cy.id}/search.test.mjs`}, '失敗時のテスト'), ' ',
        h('a', {href: `tdd/green${cy.id}/search.mjs`}, '成功時のコード'), ' ',
        h('a', {href: `tdd/green${cy.id}/record.json`}, '記録')))));
    $('acceptance-line').textContent = `テストとは別に、${data.acceptance.checks}項目の確認を保存しています（${data.acceptance.passed}項目とも期待どおり）。最後のテスト4件と合わせて22件とは数えません。`;
    $('acceptance-list').replaceChildren(...data.acceptance.detail.map((x) => h('li', {}, h('code', {}, x.id), `　検索語${queryText(x.query)}・分野 ${x.category} → ${x.expected.length ? x.expected.join('、') : '0件'}`)));
    $('review-std').textContent = `Standards（規約）：指摘 ${data.review.standards}件`;
    $('review-spec').textContent = `Spec（仕様）：指摘 ${data.review.spec}件`;
    $('review-range').textContent = `元の作例用の履歴 ${data.review.base.slice(0, 8)} → ${data.review.head.slice(0, 8)}（4コミット）の差分。対象：${data.review.scope.join('、')}。この公開サイトのGitの履歴とは別物です。`;
  }

  // 依頼文のコピー（失敗したら読み取り専用の欄を選んだ状態にして伝える）
  $('copy-request').addEventListener('click', async () => {
    if (!data) return;
    const ok = await copyText(data.request);
    if (!data) return;
    const out = $('request-status'), area = $('request-text');
    if (ok) { out.textContent = 'request.txt の依頼文をクリップボードへ送りました。貼り付け先で確かめてください。'; return; }
    out.textContent = 'コピーできませんでした。依頼文の欄を選んだ状態にしたので、端末の操作でコピーしてください。';
    area.closest('details')?.setAttribute('open', '');
    area.focus();
    area.select();
  });

  // 読み込みと失敗
  function setDependents(on) {
    dependents().forEach((el) => { el.disabled = !on; });
    if (!on) for (const a of dynLinks) { a.removeAttribute('href'); a.removeAttribute('download'); a.setAttribute('aria-disabled', 'true'); }
  }
  function clearReadouts() {
    for (const id of readouts) $(id).replaceChildren();
    for (const a of areas) a.value = '';
    $('json-current').textContent = '';
    part = null;
    skill = null;
    document.querySelectorAll('button[data-part], button[data-skill]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  }
  function setStatus(text, state) {
    statusEl.textContent = text;
    statusEl.dataset.state = state;
    statusEl.setAttribute('role', state === 'error' ? 'alert' : 'status');
  }
  async function load() {
    const gen = ++loadGen;
    controller?.abort();
    controller = new AbortController();
    stopAnim();
    data = null;
    root.dataset.state = 'loading';
    retryBtn.hidden = true;
    setDependents(false);
    clearReadouts();
    draw();
    setStatus(`保存済みの素材${ASSET_COUNT}件を照合しています…`, 'loading');
    try {
      const bundle = await loadValidatedAssets({
        signal: controller.signal,
        onProgress: (done, total) => { if (gen === loadGen && root.dataset.state === 'loading') setStatus(`素材 ${done}/${total} を照合しています…`, 'loading'); },
      });
      if (gen !== loadGen) return;
      data = bundle;
      root.dataset.state = 'ready';
      setStatus(`${ASSET_COUNT}件の素材を大きさとSHA-256で照合し、原関数の実際の結果が保存済みの3件と同じ順序であることを確かめました。`, 'ready');
      setDependents(true);
      $('request-text').value = data.request;
      renderFixed();
      renderPart();
      renderSkill();
      renderCase();
      tau = 0;
      setStage(0, true);
    } catch (error) {
      if (gen !== loadGen || error?.name === 'AbortError') return;
      stopAnim();
      data = null;
      root.dataset.state = 'error';
      setDependents(false);
      clearReadouts();
      draw();
      const why = error instanceof AssetError ? error.message : '素材を読めませんでした';
      setStatus(`${why}。図と読み出しを止めました。ファイルを直接開いた場合は、ローカルのHTTPサーバー経由で開き直してください。`, 'error');
      retryBtn.hidden = false;
    }
  }
  retryBtn.addEventListener('click', () => load());
  setTheme(theme(), false);
  load();
}

if (typeof document !== 'undefined' && document.documentElement.dataset.page === 'matt-pocock-skills-concept') {
  applyStoredTheme();
  initPage();
}
