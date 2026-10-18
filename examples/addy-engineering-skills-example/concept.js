/* Addy Osmani Agent Skills 作例「AIに、小さな開発手順を渡す」— 概念図ページと図解動画の共通部分
 * 32件の素材を、大きさ・SHA-256・中身の対応で照合する。そのあと元の tasks.mjs と baseline/tasks.mjs の selectTasks を
 * ブラウザーで実際に呼び、保存済みの3件と同じ順序の結果が返ったときだけ図と読み出しを出す。
 * Agent Skills はAIが読む工程別のMarkdown手順集で、それ自体は動かない。このページではAIもNodeのテストも動かない。
 * 図の「返った紙」は、selectTasks が返したTODOのオブジェクトそのもの（入力の6枚と同じ参照）から描く。
 * ページの初期化は index.html（data-page="addy-skills-concept"）でだけ行う。video/video.js は読み込みと描画だけを使う。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

export const CASE_ID = 'addy-engineering-skills-example';
export const SOURCE_COMMIT = 'aeac41d4d005999432bb7312f7ff06383a91d59d';
export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = '6be867b3f2127f80e595b182dddedc05e44ea187c50fc2ea030b1d208d018b50';
const VENDOR = 'vendor/addy-agent-skills/';
const SK = `${VENDOR}skills/`;
export const ASSET_PATHS = Object.freeze([
  'concept/structure.json', 'seed.json', 'results.json', 'samples.json', 'tdd-history.json', 'acceptance-main.json',
  'timezones.json', 'mutation.json', 'core-review.json', 'SPEC.md', 'plan/plan.md', 'plan/todo.md', 'input.md',
  'tasks.mjs', 'baseline/tasks.mjs', 'tasks.test.mjs', 'request.txt',
  'outputs/due-open.json', 'outputs/due-all.json', 'outputs/no-cutoff.json',
  `${VENDOR}LICENSE`, `${VENDOR}README.md`,
  `${VENDOR}references/accessibility-checklist.md`, `${VENDOR}references/definition-of-done.md`, `${VENDOR}references/testing-patterns.md`,
  `${SK}code-review-and-quality/SKILL.md`, `${SK}frontend-ui-engineering/SKILL.md`, `${SK}incremental-implementation/SKILL.md`,
  `${SK}planning-and-task-breakdown/SKILL.md`, `${SK}spec-driven-development/SKILL.md`, `${SK}test-driven-development/SKILL.md`,
  `${SK}using-agent-skills/SKILL.md`,
]);
export const ASSET_COUNT = ASSET_PATHS.length;
const VENDOR_PATHS = ASSET_PATHS.filter((p) => p.startsWith(VENDOR));
export const JOB_IDS = Object.freeze(['due-open', 'due-all', 'no-cutoff']);
export const TASK_IDS = Object.freeze(['proposal', 'sample', 'publish', 'idea', 'brief', 'memo']);
export const SKILL_IDS = Object.freeze(['using', 'spec', 'plan', 'increment', 'tdd', 'review', 'frontend']);
export const PART_IDS = Object.freeze(['guide', 'spec', 'slices', 'loop', 'challenge', 'result']);
export const AREA_IDS = Object.freeze(['objective', 'commands', 'structure', 'style', 'testing', 'boundaries']);
const RUN_PHASES = ['baseline', 'red1', 'green1', 'red2', 'green2'];
const NODE_VERSION = 'v24.18.0';
const FLIP = 'task.dueDate <= cutoff -> task.dueDate < cutoff';
// 保存済み3件の入力と順序（元の制作の記録）。読み込んだ記録がこれと違えば描かない。
const EXPECT = Object.freeze({
  'due-open': {options: {status: 'open', cutoff: '2026-10-15'}, before: ['proposal', 'sample', 'publish', 'idea'], after: ['proposal', 'sample']},
  'due-all': {options: {status: 'all', cutoff: '2026-10-15'}, before: [...TASK_IDS], after: ['proposal', 'sample', 'brief', 'memo']},
  'no-cutoff': {options: {status: 'all', cutoff: null}, before: [...TASK_IDS], after: [...TASK_IDS]},
});
export const OUTPUTS = Object.freeze({
  'due-open': Object.freeze({path: 'outputs/due-open.json', bytes: 926, sha256: 'f0dbce41f757a49a2f2cd05dd918682faadb7f3a3890e666e4297839f2d9a4fb'}),
  'due-all': Object.freeze({path: 'outputs/due-all.json', bytes: 1448, sha256: '8dfba9bd6b2e7e2dc8725fc85caefdb7e20396deac01fe34efa1f7512cfd22a8'}),
  'no-cutoff': Object.freeze({path: 'outputs/no-cutoff.json', bytes: 1688, sha256: 'ad60d219bde9f9cc5a4d61311855233c8986243f9b0415a2c5c41a95182a483c'}),
});
export const PRESET_LABEL = Object.freeze({'due-open': '未完了', 'due-all': '完了も', 'no-cutoff': '指定なし'});
export const UPSTREAM_TREE = `https://github.com/addyosmani/agent-skills/tree/${SOURCE_COMMIT}`;
const upstreamLine = (vendorPath, line) => `https://github.com/addyosmani/agent-skills/blob/${SOURCE_COMMIT}/${vendorPath.slice(VENDOR.length)}?plain=1#L${line}`;

// 3つの束は、この作例の説明のための分け方（原典の分類ではない）。選び方の地図（using-agent-skills）はその上に置く。
export const BUNDLES = Object.freeze([
  Object.freeze({id: 'decide', name: '決める', skills: ['spec', 'plan']}),
  Object.freeze({id: 'advance', name: '進める', skills: ['increment', 'tdd']}),
  Object.freeze({id: 'check', name: '確かめる', skills: ['review', 'frontend']}),
]);
// 本の背の短い名前・中身のひとこと・この作例での範囲
export const SKILL_META = Object.freeze({
  using: Object.freeze({name: 'using-agent-skills', book: '選び方', bundle: '地図', inside: '工程に合う手順を選ぶ地図',
    scope: () => 'この地図から、仕様・計画・増分・テスト・点検・画面の6つを選び、地図と合わせて7つをAIに読ませました。7つのAIが自動で動く仕組みではありません。interview-me など、地図にあるほかの手順は使っていません。'}),
  spec: Object.freeze({name: 'spec-driven-development', book: '仕様', bundle: '決める', inside: 'コードより先に6領域',
    scope: (d) => `AIがコードより先に SPEC.md を書きました。6領域・制作担当が事前に決めた前提${d.assumptions}個・受入条件・未確認の点を含みます。原典の「書いたら止まり、人の承認を待つ」と人への聞き取りは行っていません。`}),
  plan: Object.freeze({name: 'planning-and-task-breakdown', book: '計画', bundle: '決める', inside: '縦に切った小さな増分',
    scope: (d) => `AIが仕様を2つの増分に分け、plan.md と todo.md に書きました。チェック欄${d.plan.unchecked}個は原本のまま空です。計画の人の承認はしていません。`}),
  increment: Object.freeze({name: 'incremental-implementation', book: '増分', bundle: '進める', inside: '1つ確かめてから次へ',
    scope: () => '増分ごとに、AIの変更のあと制作担当がNodeでテストと構文確認を実行し、commitしてから次へ進みました。ブラウザーでの画面確認は、増分ごとではなく全増分の後でした。'}),
  tdd: Object.freeze({name: 'test-driven-development', book: 'テスト', bundle: '進める', inside: '失敗を見てから通す',
    scope: () => '新しいテストを1つ先に足し、制作担当のNodeで失敗（RED）を見てから、AIが最小の変更を書いて成功（GREEN）。これを2回。原典の3つ目の段（整理し直し）は行っていません。'}),
  review: Object.freeze({name: 'code-review-and-quality', book: '点検', bundle: '確かめる', inside: '5軸と、条件の反転',
    scope: () => '元の制作担当が tasks.mjs の <= を < に反転して1件の失敗を確かめ、元のバイトに戻して5件成功。著者とは別のAI（Codexの親）が5軸で1回点検し、必須0・重大0。新しい図や映像の点検でも、人の承認でもありません。'}),
  frontend: Object.freeze({name: 'frontend-ui-engineering', book: '画面', bundle: '確かめる', inside: 'スマホから・320px〜',
    scope: () => '元のTODO画面の配線・ラベル・キー操作・0件・日付エラーの表示を、全増分の後にブラウザーで確かめた記録です。支援技術の全項目の適合や人の承認ではありません。この新しい図の確認は、制作担当が別に行います。'}),
});
// SPEC.md の6領域（見出しは原文の英語、説明はこの作例の要約）
export const SPEC_AREA_META = Object.freeze({
  objective: Object.freeze({en: 'Objective', note: '期限が指定日まで（当日を含む）のTODOだけを出す。足す能力は1つ'}),
  commands: Object.freeze({en: 'Commands', note: '既存の npm test と npm run check だけを使う'}),
  structure: Object.freeze({en: 'Project Structure', note: '判定は tasks.mjs、画面の配線は app.mjs'}),
  style: Object.freeze({en: 'Code Style', note: '暦日は文字列のまま比べる。不正な日付は RangeError'}),
  testing: Object.freeze({en: 'Testing Strategy', note: 'node:test。新しいテストは実装の前に失敗を見る'}),
  boundaries: Object.freeze({en: 'Boundaries', note: '必ず行う／先に聞く／行わない。依存の追加や永続保存はしない'}),
});
const CARD_SHORT = ['指定日まで', '実在する日付'];
const REVIEW_AXIS_JA = Object.freeze({correctness: '正しさ', readability: '読みやすさ', architecture: '設計', security: 'セキュリティ', performance: '性能'});

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
export const md = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${Number(m[2])}/${Number(m[3])}` : ''; };
export const statusText = (s) => ({open: '未完了', all: 'すべて', done: '完了'})[s] || s;
export const cutoffText = (c) => (c ? `${c} まで（当日を含む）` : '期限の指定なし');

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
  if (!globalThis.crypto?.subtle) fail('このブラウザーではSHA-256を計算できないため、照合できません。HTTPS か http://127.0.0.1 のページとして開いてください');
  let digest;
  try { digest = await crypto.subtle.digest('SHA-256', bytes); } catch { fail('SHA-256の計算に失敗したため、照合できません'); }
  return hex(new Uint8Array(digest));
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
  check(m && m.format === 'addy-visual-assets/v1' && m.case_id === CASE_ID, 'manifest の形式か作例名が違います');
  check(Array.isArray(m.files) && m.files.length === ASSET_COUNT, `manifest の素材が${ASSET_COUNT}件ではありません`);
  const paths = m.files.map((f) => f && f.path);
  check(new Set(paths).size === paths.length && sameList([...paths].sort(), [...ASSET_PATHS].sort()), `manifest の素材${ASSET_COUNT}件の一覧が違います`);
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
  check(S && S.format === 'addy-skills-structure/v1' && S.case_id === CASE_ID && S.source_commit === SOURCE_COMMIT && isStr(S.definition) && isStr(S.rule), 'concept/structure.json の形式か固定版が違います');

  // 原典12件：引用は改行で分けて、記録された行番号の行に含まれるかを確かめる（7つのスキルと6つの部分、13組）
  const vendorLines = Object.fromEntries(VENDOR_PATHS.map((p) => [p, splitLines(text(p))]));
  const license = text(`${VENDOR}LICENSE`);
  check(license.startsWith('MIT License') && license.includes('Copyright (c) 2025 Addy Osmani'), '原典の LICENSE が MIT License（Addy Osmani）ではありません');
  const quoteRef = (x, what) => {
    check(x && isStr(x.label) && isStr(x.meaning) && isStr(x.quote) && VENDOR_PATHS.includes(x.source_path) && Number.isInteger(x.line_start) && x.line_start >= 1, `${what} の引用の記録が読めません`);
    check((vendorLines[x.source_path][x.line_start - 1] || '').includes(x.quote), `${what} の引用が ${x.source_path} の${x.line_start}行目にありません`);
    return {id: x.id, label: x.label, meaning: x.meaning, quote: x.quote, source_path: x.source_path, line_start: x.line_start,
      shortPath: x.source_path.slice(VENDOR.length), url: assetUrl(x.source_path), lineUrl: upstreamLine(x.source_path, x.line_start)};
  };
  check(sameList(ids(S.skills), SKILL_IDS), 'concept/structure.json の7つのスキルが違います');
  check(sameList(ids(S.parts), PART_IDS), 'concept/structure.json の6つの部分が違います');
  S.skills.forEach((x) => check(x.source_path === `${SK}${SKILL_META[x.id].name}/SKILL.md`, `${x.id} の原典のファイルが違います`));
  const skills = S.skills.map((x) => ({...quoteRef(x, x.id), ...SKILL_META[x.id], scope: null}));
  const parts = S.parts.map((x) => quoteRef(x, x.id));

  // 仕様の6領域：原典が6領域を求めていること、SPEC.md が6つの見出しを持つこと
  check(sameList(ids(S.spec_areas), AREA_IDS) && S.spec_areas.every((a) => isStr(a.label)), 'concept/structure.json の仕様の6領域が違います');
  const specSkill = text(`${SK}spec-driven-development/SKILL.md`);
  check(specSkill.includes('six core areas') && AREA_IDS.every((id) => specSkill.includes(`**${SPEC_AREA_META[id].en}**`)), '原典 spec-driven-development の6領域が見つかりません');
  const spec = text('SPEC.md');
  check(AREA_IDS.every((id) => new RegExp(`^## \\d+\\. ${SPEC_AREA_META[id].en}`, 'm').test(spec)), 'SPEC.md に6領域の見出しがそろっていません');
  const assumptions = (spec.match(/^\| A\d+ \|/gm) || []).length;
  check(assumptions === 11 && spec.includes('npm test') && spec.includes('npm run check') && spec.includes("RangeError('INVALID_CUTOFF')")
    && spec.includes('**Always**') && spec.includes('**Ask first') && spec.includes('**Never**') && spec.includes('段階承認を経ていない'), 'SPEC.md の前提11個か境界の記述が違います');
  const specAreas = S.spec_areas.map((a) => ({id: a.id, label: a.label, en: SPEC_AREA_META[a.id].en, note: SPEC_AREA_META[a.id].note}));

  // 計画：2つの増分、チェック欄は原本のまま空
  const plan = text('plan/plan.md'), todo = text('plan/todo.md');
  const unchecked = (s) => (s.match(/^\s*- \[ \]/gm) || []).length;
  const planUnchecked = unchecked(plan) + unchecked(todo);
  check(!/\[[xX]\]/.test(plan) && !/\[[xX]\]/.test(todo) && planUnchecked > 0 && (todo.match(/^## Task \d+:/gm) || []).length === 2
    && plan.includes('人のレビュー・承認を経ていない') && S.limits && S.limits.plans_are_original_unchecked === true, 'plan/ の2つの増分か、未チェックのままの欄が記録と違います');

  // 依頼・依頼文・コード
  const input = text('input.md');
  const quoteMatch = input.match(/「([^」]+)」/);
  check(quoteMatch && input.includes('2026-10-15'), 'input.md の架空の依頼が見つかりません');
  const request = text('request.txt');
  check(request.includes(SOURCE_COMMIT) && SKILL_IDS.every((id) => request.includes(`skills/${SKILL_META[id].name}/SKILL.md`))
    && ['definition-of-done.md', 'testing-patterns.md', 'accessibility-checklist.md'].every((r) => request.includes(`references/${r}`)), 'request.txt の依頼文が違います');
  const signature = "export function selectTasks(tasks, {status = 'all', cutoff = null} = {})";
  const finalSource = text('tasks.mjs'), baseSource = text('baseline/tasks.mjs');
  check(finalSource.includes(signature) && baseSource.includes(signature) && finalSource.includes('task.dueDate <= cutoff') && !baseSource.includes('dueDate <='), 'tasks.mjs か baseline/tasks.mjs の selectTasks が違います');
  check(text('tasks.test.mjs').includes("from './tasks.mjs'"), 'tasks.test.mjs が tasks.mjs を読んでいません');

  // 合成TODO6件（入力の順）
  const seed = json('seed.json');
  check(Array.isArray(seed) && sameList(ids(seed), TASK_IDS), 'seed.json の6件が違います');
  for (const t of seed) {
    check(sameList(Object.keys(t), ['id', 'title', 'dueDate', 'done']) && isStr(t.title) && typeof t.done === 'boolean'
      && (t.dueDate === null || /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate)), `seed.json の ${t.id} の形が違います`);
  }
  const byId = new Map(seed.map((t) => [t.id, t]));

  // 保存済み3件：results.json・samples.json・structure・outputs/*.json がすべて同じ
  const results = json('results.json'), samples = json('samples.json');
  check(results && results.synthetic === true && results.node === NODE_VERSION && sameList(ids(results.samples), JOB_IDS), 'results.json の3件が違います');
  check(samples && samples.synthetic === true && sameList(ids(samples.samples), JOB_IDS), 'samples.json の3件が違います');
  check(sameList(ids(S.jobs), JOB_IDS), 'concept/structure.json の3件が違います');
  const jobs = {};
  JOB_IDS.forEach((id, i) => {
    const sm = results.samples[i], sj = S.jobs[i], sp = samples.samples[i], ex = EXPECT[id];
    check(deepEqual(sm.options, ex.options) && deepEqual(sj.options, ex.options) && deepEqual(sp.options, ex.options)
      && isStr(sm.label) && sm.label === sj.label && sm.label === sp.label, `${id} の入力が保存記録と違います`);
    check(sameList(ids(sm.before), ex.before) && sameList(ids(sm.after), ex.after) && sameList(sj.before_ids, ex.before) && sameList(sj.after_ids, ex.after)
      && sameList(sp.before_ids, ex.before) && sameList(sp.after_ids, ex.after), `${id} の結果の順序が保存記録と違います`);
    check([...sm.before, ...sm.after].every((o) => deepEqual(o, byId.get(o.id))), `${id} のTODOが seed.json と違います`);
    check(deepEqual(sj.output_file, OUTPUTS[id]), `${id} の出力ファイルの記録が違います`);
    check(deepEqual(json(OUTPUTS[id].path), sm), `${OUTPUTS[id].path} の中身が results.json の ${id} と違います`);
    jobs[id] = {
      id, label: sm.label, preset: PRESET_LABEL[id], options: {...ex.options},
      output: {...OUTPUTS[id], url: assetUrl(OUTPUTS[id].path), download: `addy-engineering-skills-${id}.json`, file: OUTPUTS[id].path.split('/').pop()},
      saved: {afterIds: ex.after, beforeIds: ex.before, after: sm.after},
      final: null, baseline: null, keptIndex: null,
    };
  });

  // 元の制作で制作担当が実行したNode 5回：失敗1件→全成功の形と、ファイルのハッシュのつながり
  const hist = json('tdd-history.json');
  check(hist && hist.synthetic === true && hist.human_approval === false && Array.isArray(hist.runs) && sameList(hist.runs.map((r) => r && r.phase), RUN_PHASES), 'tdd-history.json の5回の記録が違います');
  const runs = Object.fromEntries(hist.runs.map((r) => [r.phase, r]));
  for (const r of hist.runs) {
    check(r.node === NODE_VERSION && isStr(r.command) && isStr(r.executed_at) && isStr(r.tap) && [r.tests, r.pass, r.fail, r.exit_code].every(Number.isInteger), `${r.phase} の記録が読めません`);
    check(tapCount(r.tap, /^ok \d+ - /gm) === r.pass && tapCount(r.tap, /^not ok \d+ - /gm) === r.fail && r.tap.includes(`\n# tests ${r.tests}\n`), `${r.phase} の数がTAPの出力と合いません`);
    check(r.sources_sha256 && r.sources_sha256['seed.json'] === sha('seed.json'), `${r.phase} の seed.json が今の合成データと違います`);
  }
  const b0 = runs.baseline;
  check(b0.tests === 3 && b0.pass === 3 && b0.fail === 0 && b0.exit_code === 0 && b0.sources_sha256['tasks.mjs'] === sha('baseline/tasks.mjs'), 'baseline の記録が違います');
  check(Array.isArray(S.cycles) && sameList(ids(S.cycles), [1, 2]), 'concept/structure.json の2つの増分が違います');
  const sameRun = (rec, run) => rec && rec.phase === run.phase && rec.tests === run.tests && rec.pass === run.pass && rec.fail === run.fail && rec.exit_code === run.exit_code && rec.node === run.node;
  const pick = (r) => ({phase: r.phase, tests: r.tests, pass: r.pass, fail: r.fail, exit_code: r.exit_code, executed_at: r.executed_at, command: r.command});
  const cycles = [1, 2].map((k) => {
    const red = runs[`red${k}`], green = runs[`green${k}`], prev = k === 1 ? b0 : runs.green1, sc = S.cycles[k - 1];
    check(red.tests === 3 + k && red.pass === 2 + k && red.fail === 1 && red.exit_code === 1, `red${k} が「新しい1件だけ失敗」の記録ではありません`);
    check(green.tests === 3 + k && green.pass === 3 + k && green.fail === 0 && green.exit_code === 0, `green${k} が全成功の記録ではありません`);
    check(red.sources_sha256['tasks.mjs'] === prev.sources_sha256['tasks.mjs'] && red.sources_sha256['tasks.test.mjs'] !== prev.sources_sha256['tasks.test.mjs'], `red${k} でテストだけが変わっていません`);
    check(green.sources_sha256['tasks.test.mjs'] === red.sources_sha256['tasks.test.mjs'] && green.sources_sha256['tasks.mjs'] !== red.sources_sha256['tasks.mjs'], `green${k} でコードだけが変わっていません`);
    const name = failedName(red.tap);
    check(isStr(name) && green.tap.includes(`ok ${3 + k} - ${name}`), `増分${k}で足したテストの名前が記録と合いません`);
    check(isStr(sc.label) && sameRun(sc.red, red) && sameRun(sc.green, green), `concept/structure.json の増分${k}が tdd-history.json と違います`);
    return {id: k, label: sc.label, short: CARD_SHORT[k - 1], newTest: name, red: pick(red), green: pick(green)};
  });
  const g2 = runs.green2;
  check(g2.sources_sha256['tasks.mjs'] === sha('tasks.mjs') && g2.sources_sha256['tasks.test.mjs'] === sha('tasks.test.mjs'), '最後の記録のファイルが今の tasks.mjs・tasks.test.mjs と違います');

  // 境界の反転（元の制作担当の記録）：<= を < にして1件失敗、元のバイトに戻して5件成功
  const mut = json('mutation.json');
  check(deepEqual(mut, S.mutation) && mut.status === 'caught' && mut.change === FLIP && mut.mutant_exit_code === 1 && mut.mutant_failures === 1
    && mut.restored_exit_code === 0 && mut.restored_tests_pass === g2.pass && mut.original_sha256 === sha('tasks.mjs') && mut.restored_sha256 === sha('tasks.mjs')
    && /^[0-9a-f]{64}$/.test(mut.mutant_sha256) && mut.mutant_sha256 !== mut.original_sha256 && mut.human_approval === false, 'mutation.json の反転の記録が違います');

  // 別AIの5軸点検（1回）。必須0・重大0。人の承認ではない
  const cr = json('core-review.json'), R = S.review || {};
  check(cr && Array.isArray(cr.required) && cr.required.length === 0 && R.required === 0 && Array.isArray(cr.critical) && cr.critical.length === 0 && R.critical === 0
    && cr.findings_count === 0 && cr.human_approval === false && R.human_approval === false && Array.isArray(R.axes) && R.axes.length === 5
    && sameList(Object.keys(cr.axes || {}), R.axes) && isStr(cr.reviewer) && isStr(cr.scope) && isStr(R.scope)
    && cr.files && cr.files['tasks.mjs'] === sha('tasks.mjs') && cr.files['tasks.test.mjs'] === sha('tasks.test.mjs') && cr.files['SPEC.md'] === sha('SPEC.md')
    && cr.verification && deepEqual(cr.verification.mutation, mut) && cr.verification.runtime_tests === g2.tests, 'core-review.json の点検の記録が違います');
  const vu = cr.vendor_unchanged_sha256 || {};
  check(Object.keys(vu).length === VENDOR_PATHS.length && Object.entries(vu).every(([k, v]) => VENDOR_PATHS.includes(VENDOR + k) && sha(VENDOR + k) === v), 'core-review.json の原典のハッシュが今の原典と違います');

  // テストとは別の36条件（3つのタイムゾーンで同じ結果）
  const tz = json('timezones.json'), acc = json('acceptance-main.json'), C = S.counts || {};
  check(tz && tz.status === 'passed' && tz.same_outcomes === true && tz.offsets_differ === true && Array.isArray(tz.zones) && tz.zones.length === 2
    && tz.zones.every((z) => isStr(z.name) && z.checks === C.separate_acceptance_checks_per_timezone) && deepEqual(cr.verification.timezone_outcomes, tz), 'timezones.json の記録が違います');
  check(acc && acc.status === 'passed' && acc.node === NODE_VERSION && acc.checks === C.separate_acceptance_checks_per_timezone && Array.isArray(acc.details)
    && acc.details.length === acc.checks && acc.details.every((x) => x && isStr(x.id) && x.passed === true) && cr.verification.independent_acceptance_conditions === acc.checks, 'acceptance-main.json の36条件の記録が違います');
  check(sameList(C.timezone_scopes, [acc.timezone, ...tz.zones.map((z) => z.name)]), '3つのタイムゾーンの記録が違います');
  const accById = new Map(acc.details.map((x) => [x.id, x]));
  check(sameList(accById.get('F1-open')?.actual, EXPECT['due-open'].after) && sameList(accById.get('F2-all')?.actual, EXPECT['due-all'].after)
    && sameList(accById.get('F4-null')?.actual, EXPECT['no-cutoff'].after), '36条件のうち3件の例が保存記録と違います');

  // 件数と範囲
  check(C.selected_skills === 7 && C.parts === 6 && C.spec_areas === 6 && C.tasks === seed.length && C.saved_samples === 3
    && C.original_node_runs === hist.runs.length && C.red_green_cycles === 2 && C.final_tests === g2.tests, 'concept/structure.json の件数が違います');
  check(deepEqual(S.limits, {human_spec_and_plan_approval: false, interviews: false, all_skills_applied: false, browser_each_increment: false,
    browser_after_all_increments: true, plans_are_original_unchecked: true, original_model_or_Node_rerun: false, live_ai_in_new_ui: false,
    new_ui_calls_original_functions: true, persistent_tasks: false}), 'concept/structure.json の範囲の記録が違います');

  // 境界の当日の紙：反転で外れる「未完了・指定日ちょうど」の1枚
  const dayPaper = seed.find((t) => !t.done && t.dueDate === EXPECT['due-open'].options.cutoff);
  check(dayPaper, '指定日ちょうどの未完了TODOが見つかりません');

  return {
    manifest, request, definition: S.definition, rule: S.rule, inputQuote: quoteMatch[1], assumptions, specAreas,
    plan: {unchecked: planUnchecked, increments: 2},
    skills: skills.map((s) => ({...s, scopeText: SKILL_META[s.id].scope({assumptions, plan: {unchecked: planUnchecked}})})),
    parts, seed, jobs, cycles, nodeVersion: NODE_VERSION, dayPaperId: dayPaper.id,
    baselineRun: {phase: 'baseline', tests: b0.tests, pass: b0.pass, fail: b0.fail, exit_code: b0.exit_code, executed_at: b0.executed_at},
    mutation: {change: mut.change, failures: mut.mutant_failures, restoredPass: mut.restored_tests_pass, executedAt: mut.executed_at, command: mut.command,
      original: mut.original_sha256, mutant: mut.mutant_sha256, restored: mut.restored_sha256},
    review: {reviewer: cr.reviewer, reviewerJa: R.reviewer, author: R.author, axes: R.axes.map((a) => ({id: a, ja: REVIEW_AXIS_JA[a] || a})),
      required: R.required, critical: R.critical, scope: R.scope, reviewedAt: cr.reviewed_at},
    acceptance: {checks: acc.checks, zones: [{name: acc.timezone, checks: acc.checks}, ...tz.zones.map((z) => ({name: z.name, checks: z.checks}))]},
  };
}

// 元の2つの selectTasks を、照合済みの6件と保存済みの入力で実際に呼ぶ。返ったTODOそのもの（入力と同じ参照）を図に使う。
async function callOriginals(bundle) {
  let finalMod, baseMod;
  try {
    [finalMod, baseMod] = await Promise.all([import(assetUrl('tasks.mjs')), import(assetUrl('baseline/tasks.mjs'))]);
  } catch {
    fail('tasks.mjs か baseline/tasks.mjs をモジュールとして読み込めませんでした');
  }
  check(typeof finalMod.selectTasks === 'function' && typeof baseMod.selectTasks === 'function', 'selectTasks が見つかりません');
  const snapshot = JSON.stringify(bundle.seed);
  for (const id of JOB_IDS) {
    const job = bundle.jobs[id];
    let after, before;
    try {
      after = finalMod.selectTasks(bundle.seed, {...job.options});
      before = baseMod.selectTasks(bundle.seed, {...job.options});
    } catch {
      fail(`${id}：元の関数の呼び出しが失敗しました`);
    }
    check(Array.isArray(after) && after !== bundle.seed && sameList(ids(after), job.saved.afterIds) && after.every((o, i) => deepEqual(o, job.saved.after[i]))
      && after.every((o) => bundle.seed.includes(o)), `${id}：tasks.mjs が返したTODOと順序が保存記録と違います`);
    check(Array.isArray(before) && sameList(ids(before), job.saved.beforeIds), `${id}：baseline/tasks.mjs が返したTODOが保存記録と違います`);
    job.final = after;
    job.baseline = before;
    job.keptIndex = after.map((o) => bundle.seed.indexOf(o));
  }
  check(JSON.stringify(bundle.seed) === snapshot, '元の関数の呼び出しでTODOが変わりました');
}

// 32件をすべて取り直し、大きさとSHA-256、中身の対応、元の関数の実際の結果を確かめた記録だけを返す。どれか一つでも違えば例外。
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
    deepFreeze(bundle.seed);
    await callOriginals(bundle);
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return deepFreeze(bundle);
  } finally {
    signal?.removeEventListener('abort', relay);
  }
}

// ---------- 概念図（ページと図解動画で共通） ----------
// 選び方の地図と3つの束（7つの手順）→ AIが書く（架空の依頼と旧TODOを読む）→ SPEC.md の6領域 → 2枚の増分カード（人の承認はなし）
// 増分ごとに、AIが書いた同じテストの紙が制作担当のNodeとの間を往復（RED → 最小の変更 → GREEN）
// Node のあとに境界の反転（<= を < にして1件失敗、戻して5件成功）と、別AIの5軸点検1回
// 同じ6枚のTODOが selectTasks（暦日の期限 × 状態）を通り、返った紙が入力の順のまま並ぶ → 保存したJSON・元のTODO

export const FONT = Object.freeze({
  sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", "Noto Serif JP", serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
});
// 元のTODOの紙・墨・錆色（style.css の --paper・--ink・--accent）。錆色は流れと操作、赤と緑は失敗と成功だけ、
// 紫紺は日付印と「返った紙」だけに使う。
export const PALETTES = Object.freeze({
  light: Object.freeze({bg: '#f6f2e8', sheet: '#fffdf7', ink: '#191919', muted: '#57564f', rule: '#c7c1b6', flow: '#8c2c0b', flowInk: '#8c2c0b',
    tint: 'rgba(140,44,11,0.09)', red: '#c8102e', redSoft: 'rgba(200,16,46,0.09)', green: '#1e6b46', greenSoft: 'rgba(30,107,70,0.10)',
    stamp: '#3a3f96', stampInk: '#ffffff', stampSoft: 'rgba(58,63,150,0.10)', slab: '#191919', slabInk: '#f6f2e8', slabMuted: '#d6cfbf'}),
  dark: Object.freeze({bg: '#1c1a16', sheet: '#27241f', ink: '#eee8db', muted: '#b9b2a4', rule: '#4f493f', flow: '#e08a5c', flowInk: '#f0a57c',
    tint: 'rgba(224,138,92,0.14)', red: '#ff6f80', redSoft: 'rgba(255,111,128,0.14)', green: '#62c892', greenSoft: 'rgba(98,200,146,0.14)',
    stamp: '#a9b0ff', stampInk: '#1c1a16', stampSoft: 'rgba(169,176,255,0.16)', slab: '#eee8db', slabInk: '#1c1a16', slabMuted: '#4f4a40'}),
});

// 縦長：上から 手順集 / 依頼・AI・仕様 / 反転・Node・増分 / TODOの紙・関数・返った紙 / 範囲・JSON・元のTODO
const TALL = {
  nodes: {
    lib: [0.02, 0.0, 0.96, 0.135],
    req: [0.02, 0.165, 0.27, 0.057], old: [0.02, 0.233, 0.27, 0.057],
    ai: [0.345, 0.165, 0.29, 0.125], spec: [0.675, 0.165, 0.305, 0.125],
    gate: [0.70, 0.297, 0.255, 0.026],
    chal: [0.02, 0.33, 0.27, 0.17], node: [0.345, 0.33, 0.29, 0.17],
    card0: [0.675, 0.33, 0.305, 0.08], card1: [0.675, 0.42, 0.305, 0.08],
    uiLater: [0.675, 0.503, 0.305, 0.03],
    papers: [0.02, 0.54, 0.29, 0.29], fn: [0.355, 0.54, 0.28, 0.29], kept: [0.68, 0.54, 0.30, 0.29],
    scope: [0.02, 0.87, 0.29, 0.13], json: [0.355, 0.87, 0.28, 0.13], desk: [0.68, 0.87, 0.30, 0.13],
  },
  edges: {
    libAI: [[0.49, 0.135], [0.49, 0.165]],
    reqAI: [[0.29, 0.1935], [0.345, 0.1935]],
    oldAI: [[0.29, 0.2615], [0.345, 0.2615]],
    aiSpec: [[0.635, 0.2275], [0.675, 0.2275]],
    specCards: [[0.8275, 0.29], [0.8275, 0.33]],
    cardsAI: [[0.675, 0.375], [0.655, 0.375], [0.655, 0.27], [0.635, 0.27]],
    aiNode: [[0.44, 0.29], [0.44, 0.33]],
    nodeAI: [[0.54, 0.33], [0.54, 0.29]],
    nodeChal: [[0.345, 0.415], [0.29, 0.415]],
    nodeFn: [[0.49, 0.50], [0.49, 0.54]],
    papersFn: [[0.31, 0.70], [0.355, 0.70]],
    fnKept: [[0.635, 0.70], [0.68, 0.70]],
    outJson: [[0.495, 0.83], [0.495, 0.87]],
    outDesk: [[0.83, 0.83], [0.83, 0.87]],
  },
  libBig: [0.02, 0.03, 0.96, 0.8],
};
// 横長：上段 手順集→AI→仕様→増分、中段 依頼・Node・反転・範囲、下段 TODOの紙→関数→返った紙→JSON・元のTODO
const WIDE = {
  nodes: {
    lib: [0.01, 0.03, 0.29, 0.29],
    ai: [0.35, 0.03, 0.18, 0.29], spec: [0.58, 0.03, 0.18, 0.29],
    gate: [0.763, 0.165, 0.044, 0.12],
    card0: [0.81, 0.03, 0.18, 0.135], card1: [0.81, 0.185, 0.18, 0.135],
    uiLater: [0.85, 0.325, 0.14, 0.026],
    req: [0.01, 0.39, 0.29, 0.095], old: [0.01, 0.50, 0.29, 0.095],
    node: [0.35, 0.39, 0.18, 0.205], chal: [0.58, 0.39, 0.18, 0.205], scope: [0.81, 0.39, 0.18, 0.205],
    papers: [0.01, 0.665, 0.29, 0.315], fn: [0.35, 0.665, 0.18, 0.315], kept: [0.58, 0.665, 0.18, 0.315],
    json: [0.81, 0.665, 0.18, 0.145], desk: [0.81, 0.835, 0.18, 0.145],
  },
  edges: {
    libAI: [[0.30, 0.175], [0.35, 0.175]],
    reqAI: [[0.30, 0.4375], [0.325, 0.4375], [0.325, 0.26], [0.35, 0.26]],
    oldAI: [[0.30, 0.5475], [0.325, 0.5475], [0.325, 0.26], [0.35, 0.26]],
    aiSpec: [[0.53, 0.10], [0.58, 0.10]],
    specCards: [[0.76, 0.10], [0.81, 0.10]],
    cardsAI: [[0.83, 0.32], [0.83, 0.355], [0.50, 0.355], [0.50, 0.32]],
    aiNode: [[0.41, 0.32], [0.41, 0.39]],
    nodeAI: [[0.47, 0.39], [0.47, 0.32]],
    nodeChal: [[0.53, 0.4925], [0.58, 0.4925]],
    nodeFn: [[0.44, 0.595], [0.44, 0.665]],
    papersFn: [[0.30, 0.8225], [0.35, 0.8225]],
    fnKept: [[0.53, 0.8225], [0.58, 0.8225]],
    outJson: [[0.76, 0.7375], [0.81, 0.7375]],
    outDesk: [[0.76, 0.9075], [0.81, 0.9075]],
  },
  libBig: [0.03, 0.04, 0.94, 0.92],
};
const EDGE_GROUP = {libAI: 'in', reqAI: 'in', oldAI: 'in', aiSpec: 'plan', specCards: 'plan', cardsAI: 'plan', aiNode: 'loop', nodeAI: 'loop',
  nodeChal: 'check', nodeFn: 'use', papersFn: 'use', fnKept: 'use', outJson: 'use', outDesk: 'use'};
export const ALL_EDGES = Object.freeze(Object.keys(EDGE_GROUP));
export const NODE_KEYS = Object.freeze(['lib', 'req', 'old', 'ai', 'spec', 'gate', 'cards', 'node', 'chal', 'fn', 'papers', 'kept', 'json', 'desk', 'scope']);
// 6つの部分・7つの手順を選んだときに枠を付ける場所
export const PART_NODES = Object.freeze({guide: ['lib'], spec: ['spec', 'gate'], slices: ['card0', 'card1'], loop: ['ai', 'node'], challenge: ['chal'], result: ['papers', 'fn', 'kept', 'json', 'desk']});
export const SKILL_NODES = Object.freeze({using: [], spec: ['spec'], plan: ['card0', 'card1'], increment: ['card0', 'card1', 'node'], tdd: ['ai', 'node'], review: ['chal'], frontend: ['desk']});

export function chooseKind(W, H) { return W >= 640 && W / H >= 1.25 ? 'wide' : 'tall'; }

export function conceptLayout(kind, W, H) {
  const spec = kind === 'wide' ? WIDE : TALL;
  const sc = ([x, y, w, h]) => ({x: x * W, y: y * H, w: w * W, h: h * H});
  const n = {};
  for (const [k, v] of Object.entries(spec.nodes)) n[k] = sc(v);
  n.libBig = sc(spec.libBig);
  const e = {};
  for (const [k, v] of Object.entries(spec.edges)) e[k] = v.map(([x, y]) => [x * W, y * H]);
  const u = kind === 'wide' ? Math.min(W / 72, H / 34) : Math.min(W / 25, H / 40);
  const f = {label: Math.max(12, u * 0.95), small: Math.max(11, u * 0.8), big: Math.max(16, u * 1.5)};
  const head = f.small * 1.8;
  const slots = (r) => {
    const g = Math.max(2, u * 0.2), h = (r.h - head - g * 5) / 6;
    return TASK_IDS.map((_, i) => ({x: r.x, y: r.y + head + i * (h + g), w: r.w, h}));
  };
  n.paperSlots = slots(n.papers);
  n.keptSlots = slots(n.kept);
  n.cards = [n.card0, n.card1];
  return {kind, W, H, u, f, n, e, head};
}

// 既定は完成した姿。ページの段階と動画は、ここから値を変える。
export function restParams() {
  return {
    show: {}, emph: {}, emphEdge: {}, draw: {}, flow: {},
    books: 7, libBig: 0, fixture: 1, specOpen: 1, fold: 1, gate: 1,
    loop: 2, loopFlows: true, uiLater: 1, chal: 1, review: 1,
    fn: 1, travel: 1, files: 1,
    focusPart: null, focusSkill: null,
  };
}

// ページの段階：τ=1 決める、τ=2 確かめる、τ=3 使う。τの途中は動きの途中。
const STAGE_NODES = {
  lib: [1, 0, 0], req: [1, 0, 0], old: [1, 0, 0], ai: [1, 1, 0], spec: [1, 0, 0], gate: [1, 0, 0], cards: [1, 1, 0],
  node: [0, 1, 0], chal: [0, 1, 0], fn: [0, 0, 1], papers: [0, 0, 1], kept: [0, 0, 1], json: [0, 0, 1], desk: [0, 0, 1], scope: [0, 0, 1],
};
const STAGE_EDGES = {in: [1, 0, 0], plan: [1, 1, 0], loop: [0, 1, 0], check: [0, 1, 0], use: [0, 0, 1]};
export function storyParams(tau) {
  const p = restParams();
  p.books = 7 * prog(tau, 0, 0.4);
  p.fixture = easeOut(prog(tau, 0.15, 0.4));
  const fade = 1 - prog(tau, 1.05, 1.2);
  p.flow.libAI = p.flow.reqAI = p.flow.oldAI = prog(tau, 0.3, 0.55) * fade;
  p.flow.aiSpec = prog(tau, 0.45, 0.6) * fade;
  p.specOpen = prog(tau, 0.5, 0.75);
  p.fold = prog(tau, 0.74, 0.92);
  p.flow.specCards = prog(tau, 0.74, 0.88) * fade;
  p.gate = easeOut(prog(tau, 0.88, 1.0));
  p.loop = 2 * prog(tau, 1.05, 1.7);
  p.uiLater = easeOut(prog(tau, 1.68, 1.74));
  p.chal = prog(tau, 1.72, 1.92);
  p.flow.nodeChal = prog(tau, 1.72, 1.8) * (1 - prog(tau, 2.05, 2.15));
  p.review = easeOut(prog(tau, 1.92, 2.0));
  p.fn = easeOut(prog(tau, 2.02, 2.15));
  p.flow.nodeFn = prog(tau, 2.02, 2.15);
  p.flow.papersFn = prog(tau, 2.1, 2.3);
  p.travel = prog(tau, 2.15, 2.75);
  p.flow.fnKept = prog(tau, 2.4, 2.6);
  p.files = easeOut(prog(tau, 2.75, 2.95));
  p.flow.outJson = p.flow.outDesk = prog(tau, 2.78, 2.95);
  const w = [tau <= 1 ? 1 : clamp01(2 - tau), clamp01(1 - Math.abs(tau - 2)), clamp01(tau - 2)];
  const weight = (m) => Math.max(m[0] * w[0], m[1] * w[1], m[2] * w[2]);
  for (const [k, m] of Object.entries(STAGE_NODES)) p.emph[k] = 0.76 + 0.24 * weight(m);
  for (const [k, m] of Object.entries(STAGE_EDGES)) p.emphEdge[k] = 0.76 + 0.24 * weight(m);
  return p;
}

// Nodeの状態：各増分は 0〜0.25 テストの紙がNodeへ、0.25 RED、0.4〜0.65 最小の変更の紙がNodeへ、0.65 GREEN
export function nodeState(loop, d) {
  if (loop >= 2) return {kind: 'green', k: 2, run: d.cycles[1].green};
  const k = Math.min(2, Math.floor(Math.max(0, loop)) + 1);
  const ph = loop - (k - 1);
  if (ph < 0.25) return k === 1 ? {kind: 'base', k: 0, run: d.baselineRun} : {kind: 'green', k: 1, run: d.cycles[0].green};
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
// 幅 max に収まるまで文字を小さくして描く（下限 min、既定10px）。収まらなければ末尾を「…」にする。描いた幅を返す。
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
  const tokens = s.match(/[A-Za-z0-9_.\-/@<=]+|./gsu) || [];
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
// 本の背の縦書き（1字ずつ）
function drawVertical(c, s, x, y, size, color, family) {
  c.font = `700 ${size}px ${family}`;
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  Array.from(s).forEach((ch, i) => c.fillText(ch, x, y + i * size * 1.06));
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
// 角を折った紙
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
  rr(c, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, L.u * 0.3);
  c.setLineDash([]);
  c.strokeStyle = pal.flow;
  c.lineWidth = 3;
  c.stroke();
}
function badge(c, L, r, text, col, soft) {
  rr(c, r.x, r.y, r.w, r.h, Math.min(r.h / 2, L.u * 0.3));
  c.fillStyle = soft;
  c.fill();
  c.strokeStyle = col;
  c.lineWidth = 1.6;
  c.stroke();
  drawText(c, text, r.x + r.w / 2, r.y + r.h / 2, {size: Math.max(10, Math.min(L.f.small, r.h * 0.7)), weight: 700, color: col, align: 'center', max: r.w - 6});
}
function checkGlyph(c, x, y, s, col) {
  c.save();
  c.strokeStyle = col;
  c.lineWidth = Math.max(1.6, s * 0.16);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(x - s * 0.4, y);
  c.lineTo(x - s * 0.1, y + s * 0.3);
  c.lineTo(x + s * 0.42, y - s * 0.34);
  c.stroke();
  c.restore();
}
const val = (o, k, dflt) => (o && o[k] !== undefined ? o[k] : dflt);

// ---- 手順集：選び方の地図と3つの束 ----
function libGeom(L, k) {
  const {f} = L, n = L.n;
  const e = ease(clamp01(k));
  const r = e <= 0 ? n.lib : e >= 1 ? n.libBig : lerpRect(n.lib, n.libBig, e);
  const headSize = Math.max(f.small, Math.min(r.h * 0.06, f.big));
  const routeH = Math.max(headSize * 1.7, r.h * 0.16);
  const gap = Math.max(3, r.w * 0.012), gap2 = Math.max(4, r.w * 0.02);
  const route = {x: r.x, y: r.y, w: r.w, h: routeH};
  const by = r.y + routeH + gap * 1.5, bh = r.h - routeH - gap * 1.5;
  const bw = (r.w - gap2 * 2) / 3;
  const bundleSize = Math.max(f.small, Math.min(bh * 0.11, f.big));
  const bhh = Math.max(bundleSize * 1.5, bh * 0.18);
  const bundles = BUNDLES.map((_, i) => ({x: r.x + i * (bw + gap2), y: by, w: bw, h: bh}));
  const pad = Math.max(2, bw * 0.05);
  const books = [route];
  bundles.forEach((b) => {
    const w = (b.w - pad * 3) / 2;
    for (let j = 0; j < 2; j++) books.push({x: b.x + pad + j * (w + pad), y: b.y + bhh, w, h: b.h - bhh - pad});
  });
  return {r, k: e, route, bundles, books, headSize, bundleSize, bhh, pad};
}
export function libRegion(L, k) { return libGeom(L, k).r; }

function skillIcon(c, id, r, pal) {
  const s = Math.min(r.w, r.h);
  if (s < 9) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, x0 = cx - s / 2, y0 = cy - s / 2;
  c.save();
  c.lineWidth = Math.max(1.2, s * 0.07);
  c.strokeStyle = pal.ink;
  c.fillStyle = pal.ink;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (id === 'using') {
    // 1本の道から工程へ分かれる
    c.beginPath(); c.moveTo(x0 + s * 0.1, cy); c.lineTo(x0 + s * 0.42, cy);
    for (const dy of [-0.32, 0, 0.32]) { c.moveTo(x0 + s * 0.42, cy); c.lineTo(x0 + s * 0.88, cy + s * dy); }
    c.stroke();
    for (const dy of [-0.32, 0, 0.32]) { c.beginPath(); c.arc(x0 + s * 0.88, cy + s * dy, s * 0.07, 0, Math.PI * 2); c.fill(); }
  } else if (id === 'spec') {
    // 1枚の紙に6つの区画
    c.strokeRect(x0 + s * 0.14, y0 + s * 0.04, s * 0.72, s * 0.92);
    for (let i = 0; i < 6; i++) c.fillRect(x0 + s * (0.25 + (i % 2) * 0.28), y0 + s * (0.16 + Math.floor(i / 2) * 0.27), s * 0.2, s * 0.14);
  } else if (id === 'plan') {
    // 縦に切った2枚
    c.strokeRect(x0 + s * 0.1, y0 + s * 0.08, s * 0.36, s * 0.84);
    c.strokeRect(x0 + s * 0.54, y0 + s * 0.08, s * 0.36, s * 0.84);
    c.beginPath(); c.moveTo(x0 + s * 0.28, y0 + s * 0.3); c.lineTo(x0 + s * 0.28, y0 + s * 0.7); c.moveTo(x0 + s * 0.72, y0 + s * 0.3); c.lineTo(x0 + s * 0.72, y0 + s * 0.7); c.stroke();
  } else if (id === 'increment') {
    // 1段ずつ上がる
    c.beginPath(); c.moveTo(x0 + s * 0.06, y0 + s * 0.9);
    for (let i = 0; i < 3; i++) { c.lineTo(x0 + s * (0.06 + i * 0.3), y0 + s * (0.62 - i * 0.26)); c.lineTo(x0 + s * (0.36 + i * 0.3), y0 + s * (0.62 - i * 0.26)); }
    c.stroke();
  } else if (id === 'tdd') {
    // 失敗（赤）から成功（緑）へ
    c.lineWidth = Math.max(2, s * 0.12);
    c.strokeStyle = pal.red;
    c.beginPath(); c.arc(cx, cy, s * 0.34, Math.PI * 0.95, Math.PI * 1.9); c.stroke();
    c.strokeStyle = pal.green;
    c.beginPath(); c.arc(cx, cy, s * 0.34, Math.PI * -0.05, Math.PI * 0.85); c.stroke();
  } else if (id === 'review') {
    // <= と < を入れ替える
    c.font = `700 ${s * 0.36}px ${FONT.mono}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('<=', cx, y0 + s * 0.26);
    c.fillStyle = pal.red;
    c.fillText('<', cx, y0 + s * 0.78);
    c.beginPath(); c.moveTo(cx + s * 0.34, y0 + s * 0.34); c.lineTo(cx + s * 0.34, y0 + s * 0.68); c.stroke();
  } else if (id === 'frontend') {
    // 小さな画面から
    c.strokeRect(x0 + s * 0.3, y0 + s * 0.04, s * 0.4, s * 0.92);
    c.beginPath(); c.moveTo(x0 + s * 0.38, y0 + s * 0.3); c.lineTo(x0 + s * 0.62, y0 + s * 0.3); c.moveTo(x0 + s * 0.38, y0 + s * 0.48); c.lineTo(x0 + s * 0.62, y0 + s * 0.48); c.stroke();
  }
  c.restore();
}

function drawBook(c, L, b, sk, pal) {
  const {u, f} = L;
  const rad = Math.min(u * 0.15, 5);
  const sp = Math.max(3, Math.min(b.w * 0.1, u * 0.5));
  rr(c, b.x, b.y, b.w, b.h, rad);
  c.fillStyle = pal.sheet;
  c.fill();
  c.save(); rr(c, b.x, b.y, b.w, b.h, rad); c.clip(); c.fillStyle = pal.ink; c.fillRect(b.x, b.y, sp, b.h); c.restore();
  rr(c, b.x, b.y, b.w, b.h, rad);
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.3;
  c.stroke();
  const ix = b.x + sp, iw = b.w - sp;
  const pad = Math.max(2, iw * 0.08);
  if (b.h > b.w * 2.2 && iw > f.small * 2.2) {
    // 背の高い本：縦書きの名前・中身の印・ひとこと
    const size = Math.min(iw * 0.42, f.big * 1.1, b.h * 0.12);
    drawVertical(c, sk.book, ix + iw / 2, b.y + pad + size * 0.7, size, pal.ink, FONT.mincho);
    const iconTop = b.y + pad + size * (Array.from(sk.book).length * 1.06 + 0.5);
    const iconS = Math.min(iw * 0.7, (b.y + b.h - iconTop) * 0.4);
    skillIcon(c, sk.id, {x: ix + (iw - iconS) / 2, y: iconTop, w: iconS, h: iconS}, pal);
    const ty = iconTop + iconS + pad;
    drawWrapped(c, sk.inside, {x: ix + pad, y: ty, w: iw - pad * 2, h: b.y + b.h - pad - ty}, {size: Math.max(f.small, Math.min(f.label, size * 0.5)), color: pal.muted, maxLines: 5, align: 'center'});
    return;
  }
  const size = Math.max(Math.min(f.small, b.h * 0.45), Math.min(b.h * 0.2, iw * 0.26, f.label * 1.6));
  if (b.h > size * 6 && iw > f.small * 5) {
    drawText(c, sk.book, ix + iw / 2, b.y + pad + size * 0.7, {size, weight: 700, color: pal.ink, align: 'center', max: iw - pad * 2, family: FONT.mincho});
    const insideH = Math.min(b.h * 0.3, f.label * 3.4);
    const iconTop = b.y + pad + size * 1.5, iconH = b.y + b.h - pad - insideH - iconTop;
    skillIcon(c, sk.id, {x: ix + pad, y: iconTop, w: iw - pad * 2, h: iconH * 0.86}, pal);
    drawWrapped(c, sk.inside, {x: ix + pad, y: b.y + b.h - pad - insideH, w: iw - pad * 2, h: insideH}, {size: Math.max(f.small, Math.min(f.label, size * 0.55)), color: pal.muted, maxLines: 3, align: 'center', valign: 'middle'});
  } else if (b.h > size * 3.4) {
    skillIcon(c, sk.id, {x: ix + iw * 0.18, y: b.y + b.h * 0.08, w: iw * 0.64, h: b.h - size * 1.6 - b.h * 0.12}, pal);
    drawText(c, sk.book, ix + iw / 2, b.y + b.h - size * 0.85, {size, weight: 700, color: pal.ink, align: 'center', max: iw - 4});
  } else {
    drawText(c, sk.book, ix + iw / 2, b.y + b.h / 2, {size, weight: 700, color: pal.ink, align: 'center', max: iw - 4});
  }
}

function drawLibrary(c, L, p, d, pal) {
  const {u} = L;
  const G = libGeom(L, p.libBig);
  const route = d.skills[0];
  const a0 = clamp01(p.books);
  if (a0 > 0) alpha(c, a0, () => {
    const r = G.route;
    const rad = Math.min(4, u * 0.2), sp = Math.max(4, Math.min(r.h * 0.3, u * 0.6));
    rr(c, r.x, r.y, r.w, r.h, rad);
    c.fillStyle = pal.sheet;
    c.fill();
    c.save(); rr(c, r.x, r.y, r.w, r.h, rad); c.clip(); c.fillStyle = pal.flow; c.fillRect(r.x, r.y, sp, r.h); c.restore();
    rr(c, r.x, r.y, r.w, r.h, rad);
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.3;
    c.stroke();
    const pad = Math.max(3, u * 0.3);
    const icon = Math.min(r.h * 0.72, u * 2.2);
    skillIcon(c, 'using', {x: r.x + sp + pad, y: r.y + (r.h - icon) / 2, w: icon, h: icon}, pal);
    const x0 = r.x + sp + pad * 2 + icon;
    const lw = drawText(c, route.book === '選び方' ? '選び方の地図' : route.book, x0, r.y + r.h / 2, {size: G.headSize, weight: 700, color: pal.ink, max: r.w * 0.45, family: FONT.mincho});
    drawText(c, G.k > 0.5 ? `${route.name}・${route.inside}` : route.name, x0 + lw + pad * 1.5, r.y + r.h / 2,
      {size: Math.max(L.f.small, G.headSize * 0.62), color: pal.muted, max: r.x + r.w - pad - (x0 + lw + pad * 1.5)});
  });
  BUNDLES.forEach((b, i) => {
    const a = clamp01(p.books - (1 + i * 2));
    if (a <= 0) return;
    const br = G.bundles[i];
    alpha(c, a, () => {
      rr(c, br.x, br.y, br.w, br.h, Math.min(5, u * 0.25));
      c.strokeStyle = pal.rule;
      c.lineWidth = 1.2;
      c.stroke();
      drawText(c, b.name, br.x + G.pad * 1.5, br.y + G.bhh / 2, {size: G.bundleSize, weight: 700, color: pal.flowInk, max: br.w - G.pad * 3, family: FONT.mincho});
    });
  });
  for (let i = 1; i < 7; i++) {
    const a = clamp01(p.books - i);
    if (a <= 0) continue;
    const b0 = G.books[i];
    const b = {...b0, y: b0.y + (1 - easeOut(a)) * u * 0.6};
    alpha(c, a, () => drawBook(c, L, b, d.skills[i], pal));
  }
}

// ---- 架空の依頼と旧TODO ----
function drawFixture(c, L, p, d, pal, aReq, aOld) {
  const {u, f, n} = L;
  const a = clamp01(p.fixture);
  const items = [['req', aReq, '依頼（架空）', pal.flowInk], ['old', aOld, '旧TODO', pal.ink]];
  for (const [key, shown, label, col] of items) {
    const r = n[key];
    alpha(c, shown, () => {
      alpha(c, 0.45 + 0.55 * a, () => {
        const fold = paper(c, r, pal, u, {dashed: a < 0.5, stroke: a < 0.5 ? pal.muted : pal.ink});
        const pad = Math.max(3, u * 0.32);
        const one = r.h < f.small * 3.6;
        drawText(c, label, r.x + pad, r.y + (one ? r.h * 0.3 : pad + f.small * 0.7), {size: f.small, weight: 700, color: a < 0.5 ? pal.muted : col, max: r.w - pad * 2 - fold});
        if (a < 0.5) return;
        const body = {x: r.x + pad, y: r.y + (one ? r.h * 0.5 : pad + f.small * 1.6), w: r.w - pad * 2, h: one ? r.h * 0.44 : r.h - pad * 2 - f.small * 1.6};
        if (key === 'req') drawWrapped(c, d.inputQuote, body, {size: f.small, min: 10, family: FONT.mincho, weight: 700, color: pal.ink, maxLines: one ? 1 : 3, valign: one ? 'middle' : undefined});
        else drawText(c, L.kind === 'wide' ? '状態だけで絞る・期限の絞り込みはない' : '状態だけで絞る', body.x, body.y + Math.min(body.h, f.small * 1.4) / 2, {size: f.small, color: pal.muted, max: body.w});
      });
    });
  }
}

// ---- AIが書く（元の Opus 5.5 の別々の実行をまとめて表す1つの机） ----
function aiNowText(p) {
  if (p.loop > 0 && p.loop < 2) return p.loop - Math.floor(p.loop) < 0.4 ? 'テストを1つ足す' : '最小の変更を書く';
  if (p.loop >= 2 && p.fold >= 1) return '仕様・計画・テスト・変更';
  if (p.fold > 0.02) return '2つの増分に分ける';
  if (p.fixture > 0.5) return '先に仕様を書く';
  return '手順を読む';
}
function drawAI(c, L, p, pal) {
  const {u, f, n, kind} = L, r = n.ai;
  rr(c, r.x, r.y, r.w, r.h, u * 0.3);
  c.fillStyle = pal.slab;
  c.fill();
  const pad = Math.max(4, u * 0.4);
  const big = Math.min(f.big * (kind === 'wide' ? 1.2 : 1), r.h * 0.3);
  drawText(c, 'AIが書く', r.x + pad, r.y + pad + big * 0.6, {size: big, weight: 700, color: pal.slabInk, max: r.w - pad * 2, family: FONT.mincho});
  const sub = kind === 'wide' ? '元の Opus 5.5・工程ごとに別の実行' : '別々の実行';
  drawText(c, sub, r.x + pad, r.y + pad + big * 1.55, {size: f.small, color: pal.slabMuted, max: r.w - pad * 2});
  const sh = Math.max(f.small * 1.6, r.h * 0.24);
  const s = {x: r.x + pad * 0.7, y: r.y + r.h - pad * 0.7 - sh, w: r.w - pad * 1.4, h: sh};
  rr(c, s.x, s.y, s.w, s.h, u * 0.12);
  c.fillStyle = pal.sheet;
  c.fill();
  // ペン先の印と、いま書いているもの
  c.fillStyle = pal.flow;
  c.fillRect(s.x, s.y, Math.max(3, u * 0.25), s.h);
  drawText(c, aiNowText(p), s.x + Math.max(3, u * 0.25) + pad * 0.6, s.y + s.h / 2, {size: Math.min(f.small, s.h * 0.62), weight: 700, color: pal.ink, max: s.w - pad * 1.4});
}

// ---- SPEC.md の6領域 ----
function areaGlyph(c, id, x, y, s, col) {
  c.save();
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineWidth = Math.max(1.1, s * 0.11);
  c.lineCap = 'round';
  const h = s / 2;
  if (id === 'objective') { c.beginPath(); c.arc(x, y, h * 0.9, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x, y, h * 0.3, 0, Math.PI * 2); c.fill(); }
  else if (id === 'commands') { c.beginPath(); c.moveTo(x - h * 0.8, y - h * 0.5); c.lineTo(x - h * 0.2, y); c.lineTo(x - h * 0.8, y + h * 0.5); c.moveTo(x, y + h * 0.6); c.lineTo(x + h * 0.85, y + h * 0.6); c.stroke(); }
  else if (id === 'structure') { c.beginPath(); c.moveTo(x - h * 0.7, y - h * 0.8); c.lineTo(x - h * 0.7, y + h * 0.6); c.lineTo(x + h * 0.2, y + h * 0.6); c.moveTo(x - h * 0.7, y - h * 0.1); c.lineTo(x + h * 0.2, y - h * 0.1); c.stroke(); c.fillRect(x + h * 0.3, y - h * 0.35, h * 0.5, h * 0.5); c.fillRect(x + h * 0.3, y + h * 0.35, h * 0.5, h * 0.5); }
  else if (id === 'style') { c.font = `700 ${s * 0.9}px ${FONT.mono}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('{}', x, y); }
  else if (id === 'testing') { c.strokeRect(x - h * 0.75, y - h * 0.75, h * 1.5, h * 1.5); c.beginPath(); c.moveTo(x - h * 0.4, y); c.lineTo(x - h * 0.08, y + h * 0.35); c.lineTo(x + h * 0.45, y - h * 0.35); c.stroke(); }
  else if (id === 'boundaries') { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x - h * 0.8, y + (i - 1) * h * 0.6); c.lineTo(x + h * 0.8, y + (i - 1) * h * 0.6); c.stroke(); } }
  c.restore();
}
function drawSpec(c, L, p, d, pal) {
  const {u, f, n, kind} = L, r = n.spec;
  const a = clamp01(p.specOpen);
  const fold = paper(c, r, pal, u, {dashed: a <= 0.01, stroke: a <= 0.01 ? pal.muted : pal.ink});
  const pad = Math.max(3, u * 0.3);
  const hh = Math.max(f.small * 1.6, r.h * 0.2);
  const nw = drawText(c, 'SPEC.md', r.x + pad, r.y + hh / 2 + 1, {size: f.small, weight: 700, family: FONT.mono, color: a <= 0.01 ? pal.muted : pal.ink, max: r.w * 0.55});
  drawText(c, kind === 'wide' ? '仕様・コードより先' : '6領域', r.x + pad + nw + pad, r.y + hh / 2 + 1, {size: f.small, color: pal.muted, max: r.w - nw - pad * 3 - fold});
  if (a <= 0.001) return;
  const cols = kind === 'wide' ? 3 : 2, rows = 6 / cols, g = Math.max(2, u * 0.16);
  const area = {x: r.x + pad, y: r.y + hh, w: r.w - pad * 2, h: r.h - hh - pad};
  const tw = (area.w - g * (cols - 1)) / cols, th = (area.h - g * (rows - 1)) / rows;
  d.specAreas.forEach((ar, i) => {
    const k = clamp01(a * 6 - i);
    if (k <= 0) return;
    const t = {x: area.x + (i % cols) * (tw + g), y: area.y + Math.floor(i / cols) * (th + g), w: tw, h: th};
    alpha(c, k, () => {
      rr(c, t.x, t.y, t.w, t.h, Math.min(3, u * 0.12));
      c.fillStyle = pal.bg;
      c.fill();
      c.strokeStyle = pal.rule;
      c.lineWidth = 1;
      c.stroke();
      const size = Math.max(10, Math.min(f.small, th * 0.62));
      if (th > size * 2.6) {
        const gs = Math.min(th * 0.42, tw * 0.4);
        areaGlyph(c, ar.id, t.x + t.w / 2, t.y + th * 0.36, gs, pal.ink);
        drawText(c, ar.label, t.x + t.w / 2, t.y + th * 0.78, {size, weight: 700, color: pal.ink, align: 'center', max: t.w - 4});
      } else if (tw > size * 6) {
        const gs = Math.min(th * 0.6, size);
        areaGlyph(c, ar.id, t.x + gs * 0.5 + 3, t.y + th / 2, gs, pal.ink);
        drawText(c, ar.label, t.x + gs + 6, t.y + th / 2, {size, weight: 700, color: pal.ink, max: t.w - gs - 8});
      } else {
        drawText(c, ar.label, t.x + t.w / 2, t.y + th / 2, {size, weight: 700, color: pal.ink, align: 'center', max: t.w - 3});
      }
    });
  });
}

// ---- 人の承認：原典にはある段階。この作例では行っていない（緑の通過印にしない） ----
function drawGate(c, L, p, pal) {
  const {u, f, n} = L, r = n.gate;
  const a = clamp01(p.gate);
  if (a <= 0.001) return;
  alpha(c, a, () => {
    rr(c, r.x, r.y, r.w, r.h, Math.min(r.h / 2, u * 0.25));
    c.fillStyle = pal.bg;
    c.fill();
    dashed(c, u, true);
    c.strokeStyle = pal.muted;
    c.lineWidth = 1.4;
    c.stroke();
    c.setLineDash([]);
    drawWrapped(c, L.kind === 'wide' ? '人の\n承認\nなし' : '人の承認なし', {x: r.x + 2, y: r.y + 1, w: r.w - 4, h: r.h - 2}, {size: Math.min(f.small, Math.max(10, r.h * 0.7)), min: 10, weight: 700, color: pal.ink, align: 'center', valign: 'middle', maxLines: 3});
  });
}

// ---- 2枚の増分カード（計画のチェック欄は原本のまま空） ----
function drawCards(c, L, p, d, pal) {
  const {u, f, n, kind} = L;
  const fold = clamp01(p.fold);
  d.cycles.forEach((cy, i) => {
    const target = n.cards[i];
    const k = easeOut(clamp01(fold * 2 - i));
    if (k <= 0.001) {
      rr(c, target.x, target.y, target.w, target.h, u * 0.15);
      dashed(c, u, true);
      c.strokeStyle = pal.rule;
      c.lineWidth = 1.1;
      c.stroke();
      c.setLineDash([]);
      return;
    }
    const r = k >= 1 ? target : lerpRect(n.spec, target, k);
    const done = p.loop >= i + 0.65;
    const active = p.loop > i && p.loop < i + 0.65;
    alpha(c, Math.min(1, k * 1.5), () => {
      paper(c, r, pal, u * 0.6, {stroke: active ? pal.flow : pal.ink, lw: active ? 2.4 : 1.3});
      if (k < 0.85) return;
      const pad = Math.max(3, u * 0.3);
      const box = Math.max(8, Math.min(f.small * 0.9, r.h * 0.26));
      const y1 = r.y + Math.max(pad + f.small * 0.6, r.h * 0.3), y2 = r.y + r.h * 0.72;
      const nw = drawText(c, `増分${cy.id}`, r.x + pad, y1, {size: f.small, weight: 700, color: active ? pal.flowInk : pal.ink, max: r.w * 0.4});
      // 計画の欄（空のまま）
      const bx = r.x + r.w - pad - box - u * 0.3;
      c.strokeStyle = pal.muted;
      c.lineWidth = 1.2;
      c.strokeRect(bx, y1 - box / 2, box, box);
      if (done) {
        const sw = Math.min(bx - (r.x + pad + nw) - pad * 2, kind === 'wide' ? f.small * 7.4 : f.small * 3.4);
        if (sw > f.small * 2) {
          const sr = {x: bx - pad - sw, y: y1 - f.small * 0.75, w: sw, h: f.small * 1.5};
          rr(c, sr.x, sr.y, sr.w, sr.h, sr.h / 2);
          c.fillStyle = pal.greenSoft;
          c.fill();
          c.strokeStyle = pal.green;
          c.lineWidth = 1.3;
          c.stroke();
          const cs = sr.h * 0.5;
          checkGlyph(c, sr.x + cs * 0.9, sr.y + sr.h / 2, cs, pal.green);
          drawText(c, kind === 'wide' ? 'CLI確認・commit' : 'CLI', sr.x + cs * 1.7, sr.y + sr.h / 2, {size: Math.min(f.small * 0.9, sr.h * 0.62), weight: 700, color: pal.green, max: sr.w - cs * 1.9});
        }
      }
      drawText(c, kind === 'wide' ? cy.label : cy.short, r.x + pad, y2, {size: f.small, color: pal.ink, max: r.w - pad * 2 - u * 0.4});
    });
  });
  const ul = n.uiLater, a = clamp01(p.uiLater);
  if (a > 0.001) alpha(c, a, () => {
    rr(c, ul.x, ul.y, ul.w, ul.h, ul.h / 2);
    dashed(c, u, true);
    c.strokeStyle = pal.muted;
    c.lineWidth = 1.1;
    c.stroke();
    c.setLineDash([]);
    drawText(c, '画面の確認は全増分の後', ul.x + ul.w / 2, ul.y + ul.h / 2, {size: Math.max(10, Math.min(f.small, ul.h * 0.72)), color: pal.ink, align: 'center', max: ul.w - 6});
  });
}

// ---- Node（制作担当が実行）。2つの増分は同じ台とタブで示す ----
function drawNode(c, L, p, d, pal) {
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
  const nw = drawText(c, kind === 'wide' ? `Node ${d.nodeVersion}` : 'Node', r.x + pad, r.y + hh / 2, {size: f.small, weight: 700, color: pal.bg, max: r.w * 0.55});
  drawText(c, kind === 'wide' ? '制作担当が実行' : '制作担当', r.x + r.w - pad, r.y + hh / 2, {size: f.small * 0.95, color: pal.bg, align: 'right', max: r.w - nw - pad * 3});
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
  const tg = Math.max(3, u * 0.2), tw = (r.w - pad * 2 - tg) / 2, ty = r.y + r.h - pad - tabsH;
  for (let i = 0; i < 2; i++) {
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
    drawText(c, `増分${i + 1}`, tx + tw / 2, ty + tabsH / 2, {size: Math.min(f.small, tabsH * 0.62), weight: 700, color: done ? pal.green : active ? pal.red : pal.muted, align: 'center', max: tw - 4});
  }
}

// ---- 境界の反転（元の制作担当の記録）と、別AIの5軸点検1回 ----
function drawChal(c, L, p, d, pal) {
  const {u, f, n, kind} = L, r = n.chal;
  const a = clamp01(p.chal), started = a > 0.001;
  const pad = Math.max(4, u * 0.32), hs = f.small;
  rr(c, r.x, r.y, r.w, r.h, u * 0.2);
  c.fillStyle = pal.sheet;
  c.fill();
  dashed(c, u, !started);
  c.strokeStyle = started ? pal.ink : pal.muted;
  c.lineWidth = 1.5;
  c.stroke();
  c.setLineDash([]);
  drawText(c, kind === 'wide' ? '境界の条件を反転（記録）' : '境界反転・記録', r.x + pad, r.y + pad + hs * 0.6, {size: hs, weight: 700, color: started ? pal.ink : pal.muted, max: r.w - pad * 2});
  const reviewH = Math.max(hs * 1.5, r.h * 0.16), badgeH = Math.max(hs * 1.45, r.h * 0.15);
  const top = r.y + pad + hs * 1.45;
  const mainH = r.y + r.h - pad - reviewH - badgeH - pad - top;
  if (mainH < hs) return;
  const flipped = a >= 0.12 && a < 0.62;
  // 比べ方の印
  const opW = Math.min(r.w * 0.34, mainH * 1.7);
  const op = {x: r.x + pad, y: top, w: opW, h: mainH};
  rr(c, op.x, op.y, op.w, op.h, u * 0.12);
  c.fillStyle = flipped ? pal.redSoft : pal.bg;
  c.fill();
  c.strokeStyle = flipped ? pal.red : pal.rule;
  c.lineWidth = flipped ? 1.8 : 1.1;
  c.stroke();
  drawText(c, flipped ? '<' : '<=', op.x + op.w / 2, op.y + op.h / 2, {size: Math.max(hs, Math.min(op.h * 0.62, f.big * 1.3)), weight: 700, family: FONT.mono, color: flipped ? pal.red : pal.ink, align: 'center', max: op.w - 4});
  // 暦日の線：14・15・16。<= なら15日（当日）が入り、< なら外れる
  const tl = {x: op.x + op.w + pad, y: top, w: r.x + r.w - pad - (op.x + op.w + pad), h: mainH};
  const xs = [0.16, 0.5, 0.84].map((q) => tl.x + tl.w * q);
  const ly = tl.y + tl.h * 0.4, dr = Math.max(3, Math.min(tl.h * 0.15, u * 0.4));
  c.strokeStyle = pal.rule;
  c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(tl.x, ly); c.lineTo(tl.x + tl.w, ly); c.stroke();
  const endX = flipped ? xs[1] - dr * 1.9 : xs[1];
  if (started) {
    c.strokeStyle = pal.stamp;
    c.lineWidth = Math.max(2.5, dr * 0.9);
    c.beginPath(); c.moveTo(tl.x, ly); c.lineTo(endX, ly); c.stroke();
    c.beginPath(); c.moveTo(endX, ly - dr * 1.4); c.lineTo(endX, ly + dr * 1.4); c.stroke();
  }
  const day = d.seed.find((t) => t.id === d.dayPaperId);
  const days = kind === 'wide' ? ['10/14', md(day.dueDate), '10/16'] : ['14', String(Number(day.dueDate.slice(8))), '16'];
  xs.forEach((x, i) => {
    const inside = i === 0 || (i === 1 && !flipped);
    c.beginPath(); c.arc(x, ly, dr, 0, Math.PI * 2);
    if (i === 1 && flipped) { c.fillStyle = pal.sheet; c.fill(); c.strokeStyle = pal.red; c.lineWidth = 2; c.stroke(); }
    else if (inside && started) { c.fillStyle = pal.stamp; c.fill(); }
    else { c.fillStyle = pal.sheet; c.fill(); c.strokeStyle = pal.muted; c.lineWidth = 1.3; c.stroke(); }
    drawText(c, days[i], x, ly + dr + Math.max(10, hs * 0.85) * 0.75, {size: Math.max(10, hs * 0.85), weight: i === 1 ? 700 : 400, color: i === 1 && flipped ? pal.red : pal.muted, align: 'center', max: tl.w / 3});
  });
  // 結果の札：反転中は1件失敗、戻したあと5件成功
  const br = {x: r.x + pad, y: top + mainH + pad * 0.5, w: r.w - pad * 2, h: badgeH - pad * 0.3};
  if (a >= 0.3 && a < 0.62) badge(c, L, br, kind === 'wide' ? `反転した版：テスト${d.mutation.failures}件失敗` : `${d.mutation.failures}件失敗`, pal.red, pal.redSoft);
  else if (a >= 0.75) badge(c, L, br, kind === 'wide' ? `元のバイトに戻して${d.mutation.restoredPass}件成功` : `戻して${d.mutation.restoredPass}件成功`, pal.green, pal.greenSoft);
  // 別AIの点検（1回・5軸）。承認ではない
  const k = clamp01(p.review);
  if (k > 0.001) alpha(c, k, () => {
    const rv = {x: r.x + pad, y: r.y + r.h - pad - reviewH + 2, w: r.w - pad * 2, h: reviewH - 2};
    rr(c, rv.x, rv.y, rv.w, rv.h, u * 0.12);
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.1;
    c.stroke();
    const label = kind === 'wide' ? `別AIの5軸点検：必須${d.review.required}・重大${d.review.critical}（承認ではない）` : `5軸点検 必須${d.review.required}`;
    drawText(c, label, rv.x + rv.w / 2, rv.y + rv.h / 2, {size: Math.max(10, Math.min(hs, rv.h * 0.7)), weight: 700, color: pal.ink, align: 'center', max: rv.w - 4});
  });
}

// ---- selectTasks：暦日の期限 かつ 状態 ----
function drawFn(c, L, p, d, job, pal) {
  const {u, f, n, kind} = L, r = n.fn;
  const a = clamp01(p.fn);
  const pad = Math.max(4, u * 0.35), hs = f.small;
  rr(c, r.x, r.y, r.w, r.h, u * 0.25);
  c.fillStyle = pal.sheet;
  c.fill();
  dashed(c, u, a < 0.5);
  c.strokeStyle = a < 0.5 ? pal.muted : pal.ink;
  c.lineWidth = 1.8;
  c.stroke();
  c.setLineDash([]);
  const nw = drawText(c, 'selectTasks', r.x + pad, r.y + pad + hs * 0.6, {size: hs, weight: 700, family: FONT.mono, color: a < 0.5 ? pal.muted : pal.ink, max: r.w - pad * 2});
  if (kind === 'wide') drawText(c, 'tasks.mjs', r.x + r.w - pad, r.y + pad + hs * 0.6, {size: hs * 0.9, color: pal.muted, align: 'right', family: FONT.mono, max: r.w - nw - pad * 3});
  const top = r.y + pad + hs * 1.5, footH = hs * 1.5;
  const avail = r.y + r.h - pad - footH - top;
  const calH = avail * 0.6, andH = avail * 0.12, stH = avail * 0.28;
  const cal = {x: r.x + pad, y: top, w: r.w - pad * 2, h: calH};
  if (a <= 0.01) {
    rr(c, cal.x, cal.y, cal.w, cal.h, u * 0.15);
    dashed(c, u, true);
    c.strokeStyle = pal.rule;
    c.lineWidth = 1.1;
    c.stroke();
    c.setLineDash([]);
    return;
  }
  alpha(c, a, () => {
    const cut = job.options.cutoff;
    const band = Math.max(5, calH * 0.2);
    rr(c, cal.x, cal.y, cal.w, cal.h, u * 0.15);
    c.fillStyle = pal.bg;
    c.fill();
    dashed(c, u, !cut);
    c.strokeStyle = cut ? pal.ink : pal.muted;
    c.lineWidth = 1.4;
    c.stroke();
    c.setLineDash([]);
    if (cut) {
      c.save(); rr(c, cal.x, cal.y, cal.w, cal.h, u * 0.15); c.clip(); c.fillStyle = pal.flow; c.fillRect(cal.x, cal.y, cal.w, band); c.restore();
      c.fillStyle = pal.sheet;
      for (const q of [0.3, 0.7]) { c.beginPath(); c.arc(cal.x + cal.w * q, cal.y + band / 2, Math.max(1.5, band * 0.18), 0, Math.PI * 2); c.fill(); }
    }
    const body = calH - band;
    const big = Math.max(f.label, Math.min(body * 0.5, cal.w * 0.3, f.big * 1.6));
    drawText(c, cut ? md(cut) : 'なし', cal.x + cal.w / 2, cal.y + band + body * 0.4, {size: big, weight: 700, color: cut ? pal.stamp : pal.muted, align: 'center', max: cal.w - 6});
    const note = cut ? (kind === 'wide' ? `${cut.slice(0, 4)}年・この日まで（当日を含む <=）` : '当日含む') : (kind === 'wide' ? '期限の条件なし' : '期限条件なし');
    drawText(c, note, cal.x + cal.w / 2, cal.y + band + body * 0.8, {size: Math.max(10, Math.min(hs * 0.92, body * 0.2)), color: pal.ink, align: 'center', max: cal.w - 6});
    drawText(c, 'かつ', r.x + r.w / 2, top + calH + andH / 2, {size: Math.max(10, Math.min(hs * 0.9, andH * 0.8)), weight: 700, color: pal.muted, align: 'center'});
    const st = {x: r.x + pad, y: top + calH + andH, w: r.w - pad * 2, h: stH};
    rr(c, st.x, st.y, st.w, st.h, u * 0.12);
    c.fillStyle = pal.bg;
    c.fill();
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.3;
    c.stroke();
    const stLabel = kind === 'wide' ? `状態：${statusText(job.options.status)}` : (job.options.status === 'all' ? '状態すべて' : `${statusText(job.options.status)}だけ`);
    drawText(c, stLabel, st.x + st.w / 2, st.y + st.h / 2, {size: Math.max(10, Math.min(hs, st.h * 0.5)), weight: 700, color: pal.ink, align: 'center', max: st.w - 6});
    drawText(c, kind === 'wide' ? 'このページで実際に呼んだ' : '実際に呼んだ', r.x + r.w / 2, r.y + r.h - pad - footH / 2, {size: Math.max(10, hs * 0.86), color: pal.muted, align: 'center', max: r.w - pad * 2});
  });
}

// ---- 同じ6枚のTODOと、返った紙 ----
function reasonFor(task, opt) {
  if (opt.status !== 'all' && task.done !== (opt.status === 'done')) return task.done ? '完了' : '未完了';
  if (opt.cutoff && task.dueDate === null) return '期限なし';
  if (opt.cutoff && task.dueDate > opt.cutoff) return '期限後';
  return '除外';
}
function drawTask(c, L, r, task, pal, o = {}) {
  const {u, f} = L;
  const kept = Boolean(o.kept), out = Boolean(o.out);
  const fold = paper(c, r, pal, u * 0.5, {stroke: kept ? pal.stamp : out ? pal.muted : pal.ink, lw: kept ? 1.8 : 1.1});
  const pad = Math.max(2, Math.min(u * 0.3, r.h * 0.14));
  const size = Math.max(10, Math.min(f.small, r.h * 0.56));
  const sw = Math.min(r.w * 0.36, size * 3.2);
  const sr = {x: r.x + pad, y: r.y + pad, w: sw, h: r.h - pad * 2};
  if (sr.h < 6 || sr.w < 8) return;
  const dated = task.dueDate !== null;
  rr(c, sr.x, sr.y, sr.w, sr.h, Math.min(3, sr.h * 0.2));
  if (kept && dated) { c.fillStyle = pal.stamp; c.fill(); }
  dashed(c, u, !dated);
  c.strokeStyle = kept ? pal.stamp : pal.muted;
  c.lineWidth = 1.1;
  c.stroke();
  c.setLineDash([]);
  drawText(c, dated ? md(task.dueDate) : 'なし', sr.x + sr.w / 2, sr.y + sr.h / 2, {size: size * 0.95, weight: 700, color: kept && dated ? pal.stampInk : kept ? pal.stamp : dated ? pal.ink : pal.muted, align: 'center', max: sr.w - 3});
  const tx = sr.x + sr.w + pad * 1.4;
  let tw = r.x + r.w - fold * 0.6 - pad - tx;
  let tag = null;
  if (o.reason) {
    c.font = `700 ${Math.max(10, size * 0.9)}px ${FONT.sans}`;
    const right = r.x + r.w - fold * 0.6 - pad;
    const w = c.measureText(o.reason).width + pad * 2.4;
    // 狭い紙では題名を省き、日付印のすぐ右に理由の札を置く
    tag = right - w - pad - tx >= size * 2.5 ? {x: right - w, w} : {x: tx, w: right - tx};
    tag = {...tag, y: r.y + pad, h: r.h - pad * 2};
    tw = tag.x === tx ? 0 : tag.x - pad - tx;
  }
  if (tw > size * 1.2) {
    const color = task.done || out ? pal.muted : pal.ink;
    const w = drawText(c, task.title, tx, r.y + r.h / 2, {size, weight: task.done ? 400 : 700, color, max: tw});
    if (task.done) {
      c.strokeStyle = color;
      c.lineWidth = Math.max(1, size * 0.08);
      c.beginPath(); c.moveTo(tx, r.y + r.h / 2); c.lineTo(tx + w, r.y + r.h / 2); c.stroke();
    }
  }
  if (tag && tag.w >= size * 2) {
    rr(c, tag.x, tag.y, tag.w, tag.h, Math.min(tag.h / 2, u * 0.3));
    c.fillStyle = pal.bg;
    c.fill();
    c.strokeStyle = pal.muted;
    c.lineWidth = 1;
    c.stroke();
    drawText(c, o.reason, tag.x + tag.w / 2, tag.y + tag.h / 2, {size: Math.max(10, size * 0.9), weight: 700, color: pal.ink, align: 'center', max: tag.w - 2});
  }
}
function ghost(c, L, r, pal) {
  rr(c, r.x, r.y, r.w, r.h, L.u * 0.1);
  dashed(c, L.u, true);
  c.strokeStyle = pal.rule;
  c.lineWidth = 1;
  c.stroke();
  c.setLineDash([]);
}
function drawUse(c, L, p, d, job, pal, aP, aK) {
  const {u, f, n, e, kind} = L;
  const t = clamp01(p.travel);
  const hs = f.small;
  alpha(c, aP, () => drawText(c, kind === 'wide' ? `同じTODO ${d.seed.length}枚（入力の順）` : `TODO ${d.seed.length}枚`, n.papers.x, n.papers.y + hs * 0.8, {size: hs, weight: 700, color: pal.muted, max: n.papers.w}));
  alpha(c, aK, () => {
    const kr = n.kept;
    if (t <= 0.001) {
      drawText(c, '返った紙', kr.x, kr.y + hs * 0.8, {size: hs, weight: 700, color: pal.muted, max: kr.w});
      const body = {x: kr.x, y: kr.y + L.head, w: kr.w, h: kr.h - L.head};
      ghost(c, L, body, pal);
      return;
    }
    alpha(c, clamp01(t * 4), () => {
      if (kind !== 'wide') { drawText(c, `返った紙 ${job.final.length}枚`, kr.x, kr.y + hs * 0.8, {size: hs, weight: 700, color: pal.stamp, max: kr.w}); return; }
      const mw = drawText(c, `返った紙 ${job.final.length}枚（入力の順のまま）`, kr.x, kr.y + hs * 0.8, {size: hs, weight: 700, color: pal.stamp, max: kr.w * 0.7});
      drawText(c, `旧関数 ${job.baseline.length}枚`, kr.x + kr.w, kr.y + hs * 0.8, {size: hs * 0.95, color: pal.muted, align: 'right', max: kr.w - mw - u * 0.5});
    });
  });
  const movers = [];
  d.seed.forEach((task, i) => {
    const slot = n.paperSlots[i];
    const j = job.keptIndex.indexOf(i);
    const ki = clamp01((t - i * 0.06) / 0.6);
    if (j >= 0) {
      if (ki > 0) alpha(c, aP, () => ghost(c, L, slot, pal));
      if (ki <= 0) alpha(c, aP, () => drawTask(c, L, slot, task, pal));
      else if (ki >= 1) alpha(c, aK, () => drawTask(c, L, n.keptSlots[j], task, pal, {kept: true}));
      else movers.push({task, slot, to: n.keptSlots[j], k: ki});
    } else {
      // 外れる紙は関数の口まで寄ってから元の位置に戻り、理由の札が付く
      const dx = ki > 0 && ki < 1 ? Math.sin(Math.PI * ki) * u * 1.1 : 0;
      const out = ki >= 0.6;
      alpha(c, aP * (out ? 0.92 : 1), () => drawTask(c, L, {...slot, x: slot.x + dx}, task, pal, {out, reason: out ? reasonFor(task, job.options) : null}));
    }
  });
  for (const m of movers) {
    const {slot, to, k} = m;
    const path = [[slot.x + slot.w / 2, slot.y + slot.h / 2], [e.papersFn[0][0], slot.y + slot.h / 2], e.papersFn[1], e.fnKept[0], [e.fnKept[1][0], to.y + to.h / 2], [to.x + to.w / 2, to.y + to.h / 2]];
    const pt = pointAt(path, ease(k));
    const shrink = 1 - 0.5 * Math.sin(Math.PI * k);
    const w = lerp(slot.w, to.w, k) * shrink, h = lerp(slot.h, to.h, k) * Math.max(0.75, shrink);
    alpha(c, Math.max(aP, aK), () => drawTask(c, L, {x: pt.x - w / 2, y: pt.y - h / 2, w, h}, m.task, pal, {kept: k > 0.5}));
  }
}

// ---- 保存した実結果JSONと、元のTODO ----
function drawFiles(c, L, p, job, pal, aJ, aD) {
  const {u, f, n} = L;
  const a = clamp01(p.files);
  const ready = a >= 0.5;
  const jr = n.json, pad = Math.max(4, u * 0.35);
  alpha(c, aJ, () => {
    paper(c, jr, pal, u, {dashed: !ready, stroke: ready ? pal.ink : pal.muted});
    const g = Math.min(jr.h * 0.3, f.big * 1.1);
    drawText(c, '{ }', jr.x + pad, jr.y + pad + g * 0.6, {size: g, weight: 700, family: FONT.mono, color: ready ? pal.flowInk : pal.muted});
    drawText(c, '実結果JSON', jr.x + pad, jr.y + jr.h - pad - f.small * 2.1, {size: f.small, weight: 700, color: ready ? pal.ink : pal.muted, max: jr.w - pad * 2});
    if (ready) alpha(c, a, () => {
      const size = `${job.output.bytes.toLocaleString('en-US')} B`;
      drawText(c, L.kind === 'wide' ? `${job.output.file}・${size}` : size, jr.x + pad, jr.y + jr.h - pad - f.small * 0.7, {size: f.small, color: pal.muted, max: jr.w - pad * 2});
    });
  });
  const dr = n.desk;
  alpha(c, aD, () => {
    rr(c, dr.x, dr.y, dr.w, dr.h, u * 0.2);
    c.fillStyle = pal.sheet;
    c.fill();
    dashed(c, u, !ready);
    c.strokeStyle = ready ? pal.ink : pal.muted;
    c.lineWidth = 1.4;
    c.stroke();
    c.setLineDash([]);
    // 小さなTODO画面：日付の欄と行
    const sx = dr.x + pad, sw = dr.w - pad * 2, top = dr.y + pad;
    const fh = Math.min(dr.h * 0.24, f.label * 1.7);
    rr(c, sx, top, sw * 0.62, fh, u * 0.08);
    c.strokeStyle = ready ? pal.ink : pal.muted;
    c.lineWidth = 1.1;
    c.stroke();
    if (ready && job.options.cutoff) drawText(c, md(job.options.cutoff), sx + pad * 0.6, top + fh / 2, {size: Math.min(f.small, fh * 0.62), weight: 700, color: pal.stamp, max: sw * 0.62 - pad});
    const rows = Math.min(job.final.length, 3);
    const rh = Math.max(2, Math.min(fh * 0.3, u * 0.25));
    for (let i = 0; i < (ready ? rows : 2); i++) {
      c.fillStyle = ready ? pal.rule : pal.bg;
      c.fillRect(sx + sw * 0.66, top + i * (rh + 2) + 1, sw * 0.34, rh);
    }
    drawText(c, '元のTODO', dr.x + pad, dr.y + dr.h - pad - f.small * 2.1, {size: f.small, weight: 700, color: ready ? pal.ink : pal.muted, max: dr.w - pad * 2});
    drawText(c, L.kind === 'wide' ? '日付と状態を変えて試せる' : '日付で試す', dr.x + pad, dr.y + dr.h - pad - f.small * 0.7, {size: f.small, color: pal.muted, max: dr.w - pad * 2});
  });
}
function drawScope(c, L, d, pal) {
  const {u, f, n} = L, r = n.scope;
  rr(c, r.x, r.y, r.w, r.h, u * 0.2);
  dashed(c, u, true);
  c.strokeStyle = pal.muted;
  c.lineWidth = 1.2;
  c.stroke();
  c.setLineDash([]);
  const note = L.kind === 'wide' ? `架空の依頼と合成TODO${d.seed.length}枚。このページではAIもNodeのテストも動かない` : `架空の依頼・合成${d.seed.length}枚。ここでAIもNodeも動かない`;
  drawWrapped(c, note, {x: r.x + u * 0.4, y: r.y + u * 0.25, w: r.w - u * 0.8, h: r.h - u * 0.5},
    {size: f.small, min: 10, color: pal.ink, maxLines: 5, valign: 'middle'});
}

// ---- 動くもの：テストの紙と最小の変更の紙 ----
function movingPaper(c, L, pt, label, pal, col) {
  const {u, f} = L;
  const w = Math.max(u * 2.8, f.small * 4.4), h = Math.max(u * 1.5, f.small * 1.8);
  const r = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
  paper(c, r, pal, u * 0.6, {stroke: col, lw: 1.8});
  drawText(c, label, r.x + w * 0.46, r.y + h / 2, {size: Math.min(f.small, h * 0.55), weight: 700, color: col, align: 'center', max: w - u * 0.8});
}
function drawLoopMovers(c, L, p, pal) {
  const {e} = L;
  if (!(p.loop > 0 && p.loop < 2)) return;
  const k = Math.min(2, Math.floor(p.loop) + 1), ph = p.loop - (k - 1);
  const test = prog(ph, 0.02, 0.23), code = prog(ph, 0.42, 0.62);
  if (ph > 0.01 && ph < 0.32) alpha(c, 1 - prog(ph, 0.24, 0.32), () => movingPaper(c, L, pointAt(e.aiNode, ease(test)), L.kind === 'wide' ? `テスト+1（増分${k}）` : 'テスト+1', pal, pal.flowInk));
  if (ph >= 0.4 && ph < 0.72) alpha(c, 1 - prog(ph, 0.64, 0.72), () => movingPaper(c, L, pointAt(e.aiNode, ease(code)), '最小の変更', pal, pal.ink));
}

export function drawConcept(c, L, p, d, pal, jobId) {
  const job = d.jobs[jobId] || d.jobs[JOB_IDS[0]];
  const {n, u} = L;
  const e = {...L.e};
  // Connect to actual returned papers, rather than the empty six-slot region.
  const first = n.keptSlots[0], last = n.keptSlots[job.final.length - 1];
  if (first && last) {
    const start = e.fnKept[0], mid = (start[0] + first.x) / 2;
    e.fnKept = [start, [mid, start[1]], [mid, first.y + first.h / 2], [first.x, first.y + first.h / 2]];
    if (L.kind === 'wide') {
      const branch = (n.kept.x + n.kept.w + n.json.x) / 2;
      for (const [key, card, target] of [['outJson', first, n.json], ['outDesk', last, n.desk]]) {
        e[key] = [[card.x + card.w, card.y + card.h / 2], [branch, card.y + card.h / 2], [branch, target.y + target.h / 2], [target.x, target.y + target.h / 2]];
      }
    } else e.outDesk = [[last.x + last.w / 2, last.y + last.h], [n.desk.x + n.desk.w / 2, n.desk.y]];
  }
  L = {...L, e};
  const show = (k) => clamp01(val(p.show, k, 1));
  const nodeA = (k) => show(k) * val(p.emph, k, 1);
  // 増分の輪の流れ（カード→AI、テストと変更はNodeへ、結果は赤か緑でAIへ戻る）
  const flow = {...p.flow};
  let backColor = pal.flow;
  if (p.loopFlows && p.loop > 0 && p.loop < 2) {
    const k = Math.min(2, Math.floor(p.loop) + 1), ph = p.loop - (k - 1);
    flow.cardsAI = Math.max(val(flow, 'cardsAI', 0), span(ph, 0, 0.04, 0.14, 0.2));
    flow.aiNode = Math.max(span(ph, 0.02, 0.1, 0.22, 0.27), span(ph, 0.42, 0.5, 0.6, 0.66));
    const redBack = span(ph, 0.26, 0.31, 0.37, 0.41), greenBack = span(ph, 0.66, 0.71, 0.77, 0.81);
    flow.nodeAI = Math.max(redBack, greenBack);
    backColor = redBack > greenBack ? pal.red : pal.green;
  }
  c.save();
  c.lineCap = 'round';
  for (const key of ALL_EDGES) {
    const k = val(p.draw, key, 1);
    if (k <= 0.001) continue;
    const group = EDGE_GROUP[key];
    alpha(c, val(p.emphEdge, group, 1), () => strokePath(c, e[key], k, {color: pal.ink, width: Math.max(1.2, u * 0.08), head: Math.max(5, u * 0.42)}));
    const fl = val(flow, key, 0);
    if (fl > 0) strokePath(c, e[key], Math.min(k, fl), {color: key === 'nodeAI' ? backColor : pal.flow, width: Math.max(2.2, u * 0.16), head: Math.max(6, u * 0.5)});
  }
  alpha(c, nodeA('lib'), () => drawLibrary(c, L, p, d, pal));
  drawFixture(c, L, p, d, pal, nodeA('req'), nodeA('old'));
  alpha(c, nodeA('ai'), () => drawAI(c, L, p, pal));
  alpha(c, nodeA('spec'), () => drawSpec(c, L, p, d, pal));
  alpha(c, nodeA('cards'), () => drawCards(c, L, p, d, pal));
  alpha(c, nodeA('gate'), () => drawGate(c, L, p, pal));
  alpha(c, nodeA('node'), () => drawNode(c, L, p, d, pal));
  alpha(c, nodeA('chal'), () => drawChal(c, L, p, d, pal));
  alpha(c, nodeA('fn'), () => drawFn(c, L, p, d, job, pal));
  drawUse(c, L, p, d, job, pal, nodeA('papers'), nodeA('kept'));
  drawFiles(c, L, p, job, pal, nodeA('json'), nodeA('desk'));
  alpha(c, nodeA('scope'), () => drawScope(c, L, d, pal));
  drawLoopMovers(c, L, p, pal);

  const box = (k) => focusBox(c, L, k === 'lib' ? libRegion(L, p.libBig) : n[k], pal);
  if (p.focusPart && PART_NODES[p.focusPart]) PART_NODES[p.focusPart].forEach(box);
  if (p.focusSkill && SKILL_NODES[p.focusSkill]) {
    SKILL_NODES[p.focusSkill].forEach(box);
    const i = SKILL_IDS.indexOf(p.focusSkill);
    if (i >= 0) focusBox(c, L, libGeom(L, p.libBig).books[i], pal);
  }
  c.restore();
}

// ---------- ページ ----------
const STAGES = Object.freeze([
  {name: '決める', note: (d) => `AIが選び方の地図と3つの束（7つの手順）を読み、架空の依頼と旧TODOから、コードより先に SPEC.md（6領域・前提${d.assumptions}個）を書いて、2つの増分に分けました。仕様と計画の人の承認はしていません。`},
  {name: '確かめる', note: (d) => { const [c1, c2] = d.cycles; return `増分ごとに、AIが足したテストを制作担当が別にNodeで実行。${c1.red.tests}件中 失敗${c1.red.fail} → 最小の変更 → ${c1.green.pass}件成功、次に${c2.red.tests}件中 失敗${c2.red.fail} → ${c2.green.pass}件成功。最後に <= を < へ反転すると${d.mutation.failures}件失敗し、戻すと${d.mutation.restoredPass}件成功。別AIが5軸で1回点検（必須${d.review.required}）。人の承認ではありません。`; }},
  {name: '使う', note: (d, j) => `このページで tasks.mjs の selectTasks を実際に呼び、同じ${d.seed.length}枚に「状態 ${statusText(j.options.status)}・${cutoffText(j.options.cutoff)}」を通すと${j.final.length}枚が返りました（旧関数は${j.baseline.length}枚）。並びは入力の順のままで、保存した ${j.output.file} と同じです。`},
]);
const THEME_KEY = 'studio-yebisu.addy-engineering-skills-example.theme';
const SPEED = [2.2, 5.0, 2.4];
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

// 操作中の同期コピーを先に試し、だめなら非同期のクリップボードを使う。どちらも失敗したら false。読み戻しはしない。
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
  const dependents = () => document.querySelectorAll('button[data-stage], #replay, button[data-preset], button[data-part], button[data-skill], #copy-request');
  const readouts = ['save-meta', 'stage-note', 'map-live', 'case-io', 'case-result', 'case-ids', 'calls', 'case-match-text',
    'part-label', 'part-meaning', 'part-quote', 'part-source', 'part-extra',
    'skill-label', 'skill-name', 'skill-meaning', 'skill-scope', 'skill-quote', 'skill-source', 'skill-extra',
    'request-status', 'cycle-baseline', 'cycle-list', 'accept-line', 'accept-zones', 'mutation-line', 'review-line', 'review-axes', 'rule-line'];
  const areas = ['request-text'].map($);

  let data = null;
  let caseId = JOB_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : JOB_IDS[0];
  let stage = 0, tau = 0, raf = 0, part = null, skill = null, loadGen = 0, controller = null;

  // 表示の色（このページだけの保存先。TODOのデータは保存しない）
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
  document.querySelectorAll('button[data-stage]').forEach((b) => b.addEventListener('click', () => { if (data) setStage(Number(b.dataset.stage), true); }));
  $('replay').addEventListener('click', () => { if (data) setStage(stage, true); });

  // 3つの例：保存リンク・元のTODO・読み出しを、選んだ例にそろえる
  const taskLine = (t) => `${t.dueDate ? t.dueDate : '期限なし'}・${t.done ? '完了' : '未完了'}`;
  function renderCase() {
    const job = data.jobs[caseId];
    document.querySelectorAll('button[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === caseId)));
    const save = $('save-json');
    save.href = job.output.url;
    save.setAttribute('download', job.output.download);
    $('open-desk').href = `desk.html#${caseId}`;
    const cur = $('json-current');
    cur.href = job.output.url;
    cur.textContent = job.output.path;
    for (const a of dynLinks) a.removeAttribute('aria-disabled');
    $('save-meta').textContent = `${job.output.path}・${job.output.bytes.toLocaleString('en-US')} B・SHA-256 ${job.output.sha256.slice(0, 12)}…（照合済み・元の関数の結果と同じ順序）`;
    $('case-io').textContent = `「${job.preset}」：状態 ${statusText(job.options.status)}（${job.options.status}）・${cutoffText(job.options.cutoff)}。保存した例「${job.label}」。`;
    $('case-result').textContent = `このページで呼んだ結果：tasks.mjs は${job.final.length}枚、旧関数の baseline/tasks.mjs は${job.baseline.length}枚。`;
    $('case-ids').replaceChildren(...job.final.map((t) => h('li', {'data-id': t.id}, h('b', {}, t.title), `　${t.id}・${taskLine(t)}`)));
    $('case-match-text').textContent = '返った順序は保存した記録と同じです。保存ファイル：';
    $('map-live').textContent = `図の「使う」：同じ${data.seed.length}枚のうち、${job.final.map((t) => `${t.title}（${taskLine(t)}）`).join('、')}が返りました。外れた紙には理由の札（完了・期限後・期限なし）が付きます。`;
    $('request-status').textContent = '';
    $('stage-note').textContent = stageNote();
  }
  function renderCalls() {
    $('calls').replaceChildren(...JOB_IDS.map((id) => {
      const j = data.jobs[id];
      const fin = j.final.map((t) => t.id), base = j.baseline.map((t) => t.id);
      return h('li', {'data-job': id, 'data-final-ids': fin.join(','), 'data-baseline-ids': base.join(','), 'data-saved': 'match'},
        h('b', {}, `「${j.preset}」`), `　selectTasks(seed, {status: '${j.options.status}', cutoff: ${j.options.cutoff === null ? 'null' : `'${j.options.cutoff}'`}})`,
        h('span', {class: 'call-row'}, `tasks.mjs → ${fin.join(', ')}（${fin.length}枚・保存記録と一致）`),
        h('span', {class: 'call-row call-row--old'}, `baseline/tasks.mjs → ${base.join(', ')}（${base.length}枚）`));
    }));
  }
  document.querySelectorAll('button[data-preset]').forEach((b) => b.addEventListener('click', () => {
    if (!data || !JOB_IDS.includes(b.dataset.preset)) return;
    caseId = b.dataset.preset;
    history.replaceState(null, '', `#${caseId}`);
    renderCase();
    setStage(2, true);
  }));
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (data && JOB_IDS.includes(id) && id !== caseId) { caseId = id; renderCase(); setStage(2, true); }
  });

  // 6つの部分・7つの手順
  const sourceLinks = (x) => [
    h('a', {href: x.url}, `${x.shortPath} の${x.line_start}行目`), '　',
    h('a', {href: x.lineUrl, rel: 'noopener'}, '固定版の該当行（GitHub）'),
  ];
  const areaList = () => data.specAreas.map((a) => h('li', {}, h('b', {}, a.label), h('span', {lang: 'en', class: 'en'}, a.en), `　${a.note}`));
  function extraFor(kind, id) {
    if (!data || !id) return [];
    if (id === 'spec') return [h('li', {class: 'extra-head'}, `SPEC.md の6領域（${data.specAreas.length}つ）`), ...areaList()];
    if (kind === 'part' && id === 'guide') {
      return [h('li', {}, h('b', {}, '地図'), `　選び方（using-agent-skills）`), ...BUNDLES.map((b) => h('li', {}, h('b', {}, b.name), `　${b.skills.map((s) => `${SKILL_META[s].book}（${SKILL_META[s].name}）`).join('・')}`)),
        h('li', {class: 'extra-note'}, '3つの束は、この作例の説明のための分け方です。原典の分類ではありません。')];
    }
    if (id === 'slices' || id === 'plan') {
      return [...data.cycles.map((cy) => h('li', {}, h('b', {}, `増分${cy.id}`), `　${cy.label}`)),
        h('li', {class: 'extra-note'}, `計画のチェック欄${data.plan.unchecked}個は原本のまま空です。完了の印を後から付けていません。`)];
    }
    return [];
  }
  function renderPart() {
    const x = data && part ? data.parts.find((y) => y.id === part) : null;
    $('part-label').textContent = x ? x.label : '';
    $('part-meaning').textContent = x ? x.meaning : '';
    $('part-quote').textContent = x ? x.quote : '';
    $('part-source').replaceChildren(...(x ? sourceLinks(x) : []));
    $('part-extra').replaceChildren(...extraFor('part', x ? x.id : null));
  }
  function renderSkill() {
    const x = data && skill ? data.skills.find((y) => y.id === skill) : null;
    $('skill-label').textContent = x ? `${x.book}（${x.bundle}）　${x.label}` : '';
    $('skill-name').textContent = x ? `${x.name}（skills/${x.name}/SKILL.md）` : '';
    $('skill-meaning').textContent = x ? x.meaning : '';
    $('skill-scope').textContent = x ? `この作例での範囲：${x.scopeText}` : '';
    $('skill-quote').textContent = x ? x.quote : '';
    $('skill-source').replaceChildren(...(x ? sourceLinks(x) : []));
    $('skill-extra').replaceChildren(...extraFor('skill', x ? x.id : null));
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

  // 元の制作の記録（折りたたみの中）
  function renderFixed() {
    const b = data.baselineRun;
    $('cycle-baseline').textContent = `変更前：既存のテスト${b.tests}件・成功${b.pass}件・終了コード${b.exit_code}（Node ${data.nodeVersion}）。`;
    $('cycle-list').replaceChildren(...data.cycles.map((cy) => h('li', {},
      h('b', {}, `増分${cy.id}　${cy.label}`),
      h('span', {class: 'cy-test'}, `足したテスト：${cy.newTest}`),
      h('span', {class: 'cy-run'},
        h('span', {class: 'tag-red'}, `RED　${cy.red.tests}件中 失敗${cy.red.fail}・終了コード${cy.red.exit_code}`), ' → ',
        h('span', {class: 'tag-green'}, `GREEN　${cy.green.tests}件中 成功${cy.green.pass}・終了コード${cy.green.exit_code}`)),
      h('span', {class: 'cy-files'},
        h('a', {href: `tdd/red${cy.id}/tasks.test.mjs`}, '失敗時のテスト'), ' ',
        h('a', {href: `tdd/green${cy.id}/tasks.mjs`}, '成功時のコード'), ' ',
        h('a', {href: `tdd/green${cy.id}/record.json`}, '記録')))));
    $('accept-line').textContent = `テストとは別に、制作担当が${data.acceptance.checks}条件を確かめた記録です（最後のテスト${data.cycles[1].green.tests}件に足して数えません）。3つのタイムゾーンで同じ結果でした。タイムゾーンや性能の一般的な保証ではありません。確認の台本は配布していません。`;
    $('accept-zones').replaceChildren(...data.acceptance.zones.map((z) => h('li', {}, `${z.name}：${z.checks}条件・すべて期待どおり`)));
    $('mutation-line').textContent = `元の制作担当が tasks.mjs の task.dueDate <= cutoff を < に変えて同じテストを実行し、${data.mutation.failures}件が失敗。元のバイト（SHA-256 ${data.mutation.restored.slice(0, 12)}…）に戻して${data.mutation.restoredPass}件成功。テストした境界を見抜けることを示す記録で、品質全般の保証ではありません。この図や映像は、反転を新しく実行していません。`;
    $('review-line').textContent = `元の制作の点検者（${data.review.reviewerJa}）が、著者（${data.review.author}）の差分を5軸で1回点検した記録です。指摘は必須${data.review.required}件・重大${data.review.critical}件。範囲：${data.review.scope} 並列の子AIや5人の点検者ではなく、人の承認でもありません。`;
    $('review-axes').replaceChildren(...data.review.axes.map((a) => h('li', {}, h('b', {}, a.ja), h('span', {lang: 'en', class: 'en'}, a.id))));
    $('rule-line').textContent = data.rule;
  }

  // 依頼文のコピー（失敗したら読み取り専用の欄を開いて全体を選ぶ）
  $('copy-request').addEventListener('click', async () => {
    if (!data) return;
    const ok = await copyText(data.request);
    if (!data) return;
    const out = $('request-status'), area = $('request-text');
    if (ok) { out.textContent = 'request.txt の依頼文をクリップボードへ送りました。貼り付け先で確かめてください。'; return; }
    out.textContent = 'コピーできませんでした。依頼文の欄を開いて全体を選んだので、端末の操作でコピーしてください。';
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
      setStatus(`${ASSET_COUNT}件の素材を大きさとSHA-256で照合し、元の selectTasks を3回ずつ実際に呼んで、保存済みの3件と同じ順序が返ることを確かめました。`, 'ready');
      setDependents(true);
      $('request-text').value = data.request;
      renderFixed();
      renderCalls();
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

if (typeof document !== 'undefined' && document.documentElement.dataset.page === 'addy-skills-concept') {
  applyStoredTheme();
  initPage();
}
