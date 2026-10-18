/* 3D Asset Server 作例「既存の3D素材を探し、一式で受け取る」— 概念図ページと図解動画の共通部分
 * concept/manifest.json（SHA-256 を固定）にある25件を、大きさ・SHA-256・記録どうしの中身の対応で照合してから、
 * 保存済みの実記録（outputs/asset-runs.json と、その A08・A04・A07 をそのまま包んだ concept/records/*.json）、
 * 取得済みの実ファイル、制作担当が撮った実表示の静止画（concept/actual-crate.png）だけから、図と読み出しを描く。
 * このページは検索も取得もしない。Poly Haven・Fab・AI・Node・原典のコードを、ここで実行したり通信したりしない。
 * 図の中の動きは流れの説明で、元の実行の時間や内部の記録ではない。
 * ページの初期化は index.html（data-page="asset-concept"）でだけ行う。video/video.js は読み込みと描画だけを使う。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

export const CASE_ID = '3d-asset-server-example';
export const REPO = 'arielshad/3d-asset-server';
export const SOURCE_COMMIT = 'f605df3425011bae55ade114c9e7b276f5b1297b';
export const VERSION = '0.1.0';
export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = 'd669c6d3908a4ef62f6b6d989184b585d84477666e181828fda90fc72d456761';
const V = 'vendor/3d-asset-server/';
const MODEL = 'outputs/assets/polyhaven-wooden_crate_01/';
export const IMAGE_PATH = 'concept/actual-crate.png';
export const BUNDLE_ZIP = 'outputs/model-bundle.zip';
const P = Object.freeze({
  structure: 'concept/structure.json', runs: 'outputs/asset-runs.json', requests: 'input/asset-requests.json',
  expected: 'input/expected.json', lock: 'vendor-lock.json', request: 'request.txt',
  skill: `${V}web/src/content/SKILL.md`, agents: `${V}web/src/content/AGENTS.md`, service: `${V}src/core/service.ts`,
  download: `${V}src/core/download.ts`, view: 'model-view.js', polyhaven: `${V}src/providers/polyhaven.ts`,
  linked: `${V}src/providers/linked.ts`, http: `${V}src/core/http.ts`, license: `${V}LICENSE`,
});
export const MODEL_FILES = Object.freeze([
  `${MODEL}wooden_crate_01_1k.gltf`, `${MODEL}textures/wooden_crate_01_diff_1k.jpg`, `${MODEL}textures/wooden_crate_01_nor_gl_1k.jpg`,
  `${MODEL}wooden_crate_01.bin`, `${MODEL}textures/wooden_crate_01_arm_1k.jpg`,
]);
export const JOB_IDS = Object.freeze(['A08', 'A04', 'A07']);
const RUN_IDS = Object.freeze(['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08']);
export const recordPath = (id) => `concept/records/${id}.json`;
export const ASSET_PATHS = Object.freeze([
  P.structure, IMAGE_PATH, P.runs, P.requests, P.expected, P.lock, P.request, BUNDLE_ZIP,
  ...JOB_IDS.map(recordPath),
  P.skill, P.agents, P.service, P.download, P.view, P.polyhaven, P.linked, P.http, P.license,
  ...MODEL_FILES,
]);
export const ASSET_COUNT = ASSET_PATHS.length;
const VENDOR_FILES = Object.freeze([P.skill, P.agents, P.service, P.download, P.polyhaven, P.linked, P.http, P.license]);
const QUOTABLE = Object.freeze([P.skill, P.agents, P.service, P.download, P.view]);
// 親が元の asset-runs.json の結果をそのまま包んだ3件（大きさとSHA-256は structure.json・manifest.json と同じ値）
const RECORD_PINS = Object.freeze({
  A08: Object.freeze({bytes: 11049, sha256: 'a41f8a647eeaeb366e553e574169b5476d31e6c45efb22eacb06bd52b38190bd'}),
  A04: Object.freeze({bytes: 1892, sha256: 'c3f6266d468bca20d05885ec9771079e286c9720754ccda30705e04713542e36'}),
  A07: Object.freeze({bytes: 968, sha256: 'e34a9f1fe02073f7116307949a16a723d697e5ea300ad21fb9869fe511299beb'}),
});
export const PART_IDS = Object.freeze(['skill', 'execute', 'providers', 'selection', 'budget', 'use']);
export const PRESET_LABEL = Object.freeze({A08: '1kを取得', A04: '8kは止まる', A07: 'リンクだけ'});
const ASSET_ID = 'polyhaven:wooden_crate_01';
const CREDIT = 'Wooden Crate 01 by James Ray Cock / Poly Haven / CC0';
const BUDGET = Object.freeze({max: 4194304, oneK: 2277087, eightK: 118636175});
const A04_MESSAGE = 'Selection is 113.1 MB, above the 4.0 MB limit. Pick a lower resolution.';
const COUNTS = Object.freeze({original_operations: 8, original_checks: 39, independent_checks: 212, offline_replay_checks: 29,
  enabled_providers: 2, actual_network_requests: 8, api_requests: 3, download_requests: 5, models: 1, files: 5, meshes: 3, triangles: 6576});
const LIMIT_KEYS = Object.freeze(['live_request_on_page_open', 'original_inference_or_download_rerun', 'hosted_REST_MCP_used', 'all_providers_tested',
  'paid_asset_or_account', 'three_D_generation', 'human_approval', 'game_integration', 'visual_quality_or_performance_guarantee']);
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// 本の右ページの5つの印（SKILL.md の Rules の要約。図の短い名札）
export const RULES = Object.freeze(['IDの書き方', '用途で形式', 'ライセンス', '直接不可→URL', '容量を先に']);
export const STEPS = Object.freeze(['検索', '確認', '取得']);

export const githubLine = (up, line) => `https://github.com/${REPO}/blob/${SOURCE_COMMIT}/${up}${up.endsWith('.md') ? '?plain=1' : ''}#L${line}`;
export const UPSTREAM_TREE = `https://github.com/${REPO}/tree/${SOURCE_COMMIT}`;
const BASE = new URL('./', import.meta.url);
export const assetUrl = (path) => new URL(path, BASE).href;

// ---------- 小さな道具 ----------
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const ease = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
export const prog = (t, a, b) => clamp01((t - a) / (b - a));
// 時刻 at から dur 秒で値を to へ移す変化を順に重ねる（絶対時刻だけで決まる）
export function steps(t, v0, changes) {
  let v = v0, prev = v0;
  for (const [at, to, dur = 0.5] of changes) { v += (to - prev) * ease(prog(t, at, at + dur)); prev = to; }
  return v;
}
const lerp = (a, b, k) => a + (b - a) * k;
// n個を順にずらして動かす（spread は全体に占めるずれの割合）
const stagger = (k, i, n, spread = 0.45) => (n <= 1 ? clamp01(k) : clamp01((k - (i * spread) / (n - 1)) / (1 - spread)));
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
// JSONから来た値だけを凍らせる（画像のビットマップには触れない）
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o) && (Array.isArray(o) || Object.getPrototypeOf(o) === Object.prototype)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
const hostOf = (url) => { try { return new URL(url).hostname; } catch { return ''; } };
export const fmtBytes = (n) => `${n.toLocaleString('en-US')} B`;
// MiB（1,048,576 B）で小数2桁。割り切れるときは整数で書く
export const fmtMiB = (n) => { const v = n / 1048576; return `${Number.isInteger(v) ? v : v.toFixed(2)}MiB`; };
const kindOf = (path) => (/\.gltf$/i.test(path) ? 'gltf' : /\.bin$/i.test(path) ? 'bin' : 'img');
const tagOf = (path) => {
  const k = kindOf(path);
  if (k !== 'img') return k;
  const m = /_(diff|nor_gl|arm)_/.exec(path);
  return m ? m[1].replace('_gl', '') : 'jpg';
};

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
  try { body = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes); } catch { fail(`${path} がUTF-8として読めません`); }
  return body;
}
function parseJson(path, body) {
  try { return JSON.parse(body.charCodeAt(0) === 0xfeff ? body.slice(1) : body); } catch { return fail(`${path} がJSONとして読めません`); }
}

function validateManifest(m) {
  check(m && m.format === '3d-assets-visual-assets/v1' && m.case_id === CASE_ID, 'concept/manifest.json の形式か作例IDが違います');
  check(Array.isArray(m.files) && sameList(m.files.map((x) => x && x.path), ASSET_PATHS), `concept/manifest.json の素材${ASSET_COUNT}件の一覧が違います`);
  for (const x of m.files) check(Number.isInteger(x.bytes) && x.bytes > 0 && /^[0-9a-f]{64}$/.test(x.sha256), `concept/manifest.json の ${x.path} の記録が読めません`);
  for (const id of JOB_IDS) {
    const x = m.files.find((y) => y.path === recordPath(id));
    check(x.bytes === RECORD_PINS[id].bytes && x.sha256 === RECORD_PINS[id].sha256, `concept/manifest.json の ${recordPath(id)} が固定値と違います`);
  }
}

function buildBundle(manifest, bytes) {
  const text = (p) => decodeText(bytes.get(p), p);
  const json = (p) => parseJson(p, text(p));
  const entry = (p) => manifest.files.find((x) => x.path === p);

  // 1. 図の部品と範囲（structure.json）
  const S = json(P.structure);
  check(S && S.format === '3d-assets-structure/v1' && S.case_id === CASE_ID && S.source_commit === SOURCE_COMMIT && isStr(S.definition), 'concept/structure.json の形式か固定版が違います');
  check(deepEqual(S.budget, {max_bytes: BUDGET.max, one_k_bytes: BUDGET.oneK, eight_k_bytes: BUDGET.eightK, blocked_download_requests: 0}), 'concept/structure.json の予算と容量が違います');
  check(deepEqual(S.counts, COUNTS), 'concept/structure.json の件数が違います');
  check(deepEqual(S.bundle_contents, {gltf: 1, bin: 1, images: 3}), 'concept/structure.json の一式の中身が違います');
  check(S.limits && sameList(Object.keys(S.limits), LIMIT_KEYS) && LIMIT_KEYS.every((k) => S.limits[k] === false), 'concept/structure.json の範囲の記録が違います');
  const A = S.asset || {};
  check(A.id === ASSET_ID && A.credit === CREDIT && A.author === 'James Ray Cock' && A.provider === 'Poly Haven' && A.license?.name === 'CC0'
    && A.license.attributionRequired === false && A.source_url === 'https://polyhaven.com/a/wooden_crate_01', 'concept/structure.json の素材と出典が違います');
  check(S.roles && ['original_opus', 'production_operator', 'new_UI'].every((k) => isStr(S.roles[k])), 'concept/structure.json の役割の記録が読めません');
  check(S.actual_view_image?.path === IMAGE_PATH && isStr(S.actual_view_image.meaning), 'concept/structure.json の実表示の静止画の記録が違います');
  check(Array.isArray(S.workflow) && S.workflow.length === 5 && S.workflow.every(isStr) && Array.isArray(S.notes) && S.notes.every(isStr), 'concept/structure.json の手順か注記が読めません');
  check(sameList(ids(S.jobs), JOB_IDS), 'concept/structure.json の3件が違います');
  for (const j of S.jobs) {
    const pin = RECORD_PINS[j.id], e = entry(recordPath(j.id));
    check(j.label === PRESET_LABEL[j.id] && j.desk_url === `desk.html#${j.id}` && e.bytes === pin.bytes && e.sha256 === pin.sha256
      && deepEqual(j.record_file, {path: recordPath(j.id), bytes: pin.bytes, sha256: pin.sha256}), `concept/structure.json の ${j.id} の記録ファイルが違います`);
  }

  // 2. 6つの部分：引用が同梱の原典（または作例側の表示部）のその行にあること
  const lines = Object.fromEntries(QUOTABLE.map((p) => [p, text(p).split(/\r?\n/)]));
  check(sameList(ids(S.parts), PART_IDS), 'concept/structure.json の6つの部分が違います');
  const parts = S.parts.map((x) => {
    check(isStr(x.label) && isStr(x.meaning) && isStr(x.quote) && QUOTABLE.includes(x.source_path) && Number.isInteger(x.line_start) && x.line_start >= 1, `${x && x.id} の引用の記録が読めません`);
    const up = x.source_path.startsWith(V) ? x.source_path.slice(V.length) : null;
    check(x.upstream_path === up, `${x.id} の原典のパスが違います`);
    const line = lines[x.source_path][x.line_start - 1] || '';
    check(line.includes(x.quote), `${x.id} の引用が ${x.source_path} の${x.line_start}行目にありません`);
    return Object.freeze({id: x.id, label: x.label, meaning: x.meaning, quote: x.quote, source_path: x.source_path, line_start: x.line_start,
      line: line.trim(), upstream: up, url: assetUrl(x.source_path), lineUrl: up ? githubLine(up, x.line_start) : null});
  });

  // 3. 原典の固定版：ロックの115件のうち、ここで読む8件が同じバイトであること
  const lock = json(P.lock);
  check(lock && lock.repository === REPO && lock.commit === SOURCE_COMMIT && lock.version === VERSION && lock.license === 'Apache-2.0'
    && lock.three?.version === '0.180.0' && lock.three.license === 'MIT' && Array.isArray(lock.files) && lock.files.length === 115, 'vendor-lock.json の固定版か115件の一覧が違います');
  for (const p of VENDOR_FILES) {
    const l = lock.files.find((x) => x && x.path === p), e = entry(p);
    check(l && l.kind === 'original' && l.bytes === e.bytes && l.sha256 === e.sha256, `${p} が vendor-lock.json の記録と違います`);
  }
  const license = text(P.license);
  check(license.trimStart().startsWith('Apache License') && license.includes('Version 2.0, January 2004'), '原典の LICENSE が Apache License 2.0 ではありません');

  // 4. 入力と期待（実行の前に固定したもの）
  const requests = json(P.requests), expected = json(P.expected);
  check(requests && requests.format === 'studio-yebisu-3d-asset-input-v1' && deepEqual(requests.providers, ['polyhaven', 'fab'])
    && requests.max_bytes === BUDGET.max && sameList(ids(requests.cases), RUN_IDS), 'input/asset-requests.json の形式・配信元・予算・8件が違います');
  check(expected && expected.cases === 8 && expected.search_contains === ASSET_ID && deepEqual(expected.search_provider_status, {polyhaven: 'ok', fab: 'link'})
    && expected.chosen_asset_license === 'CC0' && expected.chosen_author === 'James Ray Cock' && expected.one_k_files === 5 && expected.one_k_bytes === BUDGET.oneK
    && expected.budget_should_reject === true && expected.direct_only_fab_status === 'skipped' && expected.download_max_bytes === BUDGET.max
    && expected.no_8k_download === true, 'input/expected.json の期待が違います');

  // 5. 元の実行の記録
  const runs = json(P.runs);
  const up = runs?.upstream || {};
  check(runs && runs.format === 'studio-yebisu-3d-asset-runs-v1' && up.repository === REPO && up.commit === SOURCE_COMMIT && up.version === VERSION
    && up.license === 'Apache-2.0' && up.vendor_files_verified === 115, 'outputs/asset-runs.json の固定版が違います');
  check(up.vendor_lock_sha256 === entry(P.lock).sha256 && up.skill?.sha256 === entry(P.skill).sha256 && up.agents_guide?.sha256 === entry(P.agents).sha256,
    'outputs/asset-runs.json が記録した原典のハッシュが、同梱のファイルと違います');
  check(deepEqual(runs.input_sha256, {[P.requests]: entry(P.requests).sha256, [P.expected]: entry(P.expected).sha256, [P.lock]: entry(P.lock).sha256}),
    'outputs/asset-runs.json が記録した入力のハッシュが、同梱のファイルと違います');
  check(deepEqual(runs.runtime?.providers, ['polyhaven', 'fab']) && isStr(runs.runtime.node) && runs.three?.version === '0.180.0' && runs.three.license === 'MIT',
    'outputs/asset-runs.json の実行環境の記録が違います');
  check(deepEqual(runs.asset, S.asset), 'outputs/asset-runs.json の素材と出典が concept/structure.json と違います');
  const R = runs.results;
  check(Array.isArray(R) && sameList(ids(R), RUN_IDS) && R.every((r, i) => deepEqual(r.input, requests.cases[i])), 'outputs/asset-runs.json の8件のIDか入力が input/asset-requests.json と違います');
  const net = runs.network || {};
  check(net.requests === COUNTS.actual_network_requests && net.api_requests === COUNTS.api_requests && net.file_requests === COUNTS.download_requests
    && sameList(net.hosts, ['api.polyhaven.com', 'dl.polyhaven.org']), 'outputs/asset-runs.json の通信の数か接続先が違います');
  const sum = runs.summary || {}, ver = runs.verification || {};
  check(sum.operations === COUNTS.original_operations && sum.downloaded_models === 1 && sum.files === 5 && sum.bytes === BUDGET.oneK
    && sum.checks_total === COUNTS.original_checks && sum.checks_passed === COUNTS.original_checks, 'outputs/asset-runs.json のまとめの数が違います');
  check(ver.status === 'passed' && ver.total === COUNTS.original_checks && ver.passed === COUNTS.original_checks && Array.isArray(ver.checks)
    && ver.checks.length === COUNTS.original_checks && ver.checks.every((x) => x && x.passed === true), 'outputs/asset-runs.json の確認の合否が違います');
  const byId = Object.fromEntries(R.map((r) => [r.id, r]));

  // 6. 3つの実記録：元の結果と同じ値であること（改行LFのUTF-8）
  const recs = {};
  for (const id of JOB_IDS) {
    const body = text(recordPath(id));
    check(!body.includes('\r') && body.endsWith('\n'), `${recordPath(id)} が改行LFのUTF-8ではありません`);
    const rec = parseJson(recordPath(id), body);
    check(deepEqual(rec, byId[id]), `${recordPath(id)} の値が outputs/asset-runs.json の ${id} と違います`);
    recs[id] = {rec, body};
  }

  // A01：候補と配信元ごとの状態（図の候補カードと Fab のリンク）
  const a01 = byId.A01, res = a01.output?.results, provs = a01.output?.providers || [];
  check(Array.isArray(res) && res.length === 3 && res[0].id === ASSET_ID && res.every((x) => x && x.provider === 'polyhaven' && x.type === 'model' && x.license?.name === 'CC0' && isStr(x.title)),
    'A01 の候補3件が違います');
  const ph1 = provs.find((x) => x.provider === 'polyhaven'), fab1 = provs.find((x) => x.provider === 'fab');
  check(ph1 && ph1.status === 'ok' && ph1.count === 3 && fab1 && fab1.status === 'link' && fab1.count === 0 && isStr(fab1.searchUrl)
    && fab1.searchUrl.startsWith('https://www.fab.com/search') && a01.observations?.network?.requests === 1, 'A01 の配信元ごとの状態が違います');
  const candidates = res.map((x, i) => Object.freeze({id: x.id, title: x.title, short: x.title.replace(/^Wooden /, ''), author: x.author, license: x.license.name, chosen: i === 0}));

  // A03：取得の前に分かった1kの合計
  const a03 = byId.A03;
  check(!a03.error && a03.output?.totalBytes === BUDGET.oneK && Array.isArray(a03.output.expanded) && a03.output.expanded.length === 5
    && a03.observations?.within_budget === true && a03.observations.network?.requests === 0, 'A03 の1kの選択と合計が違います');

  // A08：1kの5ファイルを実際に取得した記録と、同梱の実ファイル
  const a08 = recs.A08.rec, o8 = a08.output || {};
  check(!a08.error && deepEqual(a08.input.selection, {format: 'gltf', resolution: '1k'}) && a08.input.max_bytes === BUDGET.max, 'A08 の入力が違います');
  check(deepEqual(o8.bundle, {format: 'gltf', resolution: ['1k'], file_count: 5, total_bytes: BUDGET.oneK, contents: {gltf: 1, bin: 1, images: 3}}), 'A08 の一式の記録が違います');
  const man = o8.manifest;
  check(o8.download?.bytes === BUDGET.oneK && Array.isArray(o8.download.files) && Array.isArray(man) && man.length === 5
    && sameList(man.map((x) => x.path), o8.download.files), 'A08 の取得したファイルの一覧が違います');
  check(sameList(man.map((x) => x.public_path).sort(), [...MODEL_FILES].sort()) && o8.model_entry === MODEL_FILES[0], 'A08 の保存先が同梱の5ファイルと違います');
  for (const x of man) {
    const e = entry(x.public_path);
    check(e && e.bytes === x.bytes && e.sha256 === x.sha256 && x.bytes === x.api_size && x.md5 === x.api_md5 && x.network?.status === 200
      && x.network.bytes === x.bytes && x.network.sha256 === x.sha256, `${x.public_path} の大きさかSHA-256が A08 の記録と違います`);
  }
  const total8 = man.reduce((s, x) => s + x.bytes, 0);
  check(total8 === BUDGET.oneK && total8 <= BUDGET.max && a03.output.expanded.every((x) => man.some((y) => y.path === x.path && y.bytes === x.sizeBytes)), 'A08 の合計か A03 との対応が違います');
  check(man.filter((x) => x.path.startsWith('textures/')).length === 3 && man.filter((x) => !x.path.includes('/')).length === 2, 'A08 の相対パスの形が違います');
  const ob8 = a08.observations || {}, calls8 = ob8.network?.calls;
  check(ob8.download_requests === 5 && ob8.network?.requests === 5 && Array.isArray(calls8) && calls8.length === 5
    && calls8.every((x) => x.status === 200 && hostOf(x.url) === 'dl.polyhaven.org')
    && sameList(calls8.map((x) => x.url).sort(), man.map((x) => x.url).sort()), 'A08 の通信の記録が違います');
  check(o8.gltf?.version === '2.0' && o8.gltf.scene?.triangles === COUNTS.triangles && o8.gltf.counts?.meshes === COUNTS.meshes && deepEqual(o8.asset, S.asset), 'A08 の glTF か出典の記録が違います');
  const bin8 = man.find((x) => x.path.endsWith('.bin'));

  // A04：8kは予算を超え、取得の前に止まった
  const a04 = recs.A04.rec, o4 = a04.output || {}, ob4 = a04.observations || {};
  check(deepEqual(a04.input.selection, {format: 'gltf', resolution: '8k'}) && a04.input.max_bytes === BUDGET.max, 'A04 の入力が違います');
  check(o4.totalBytes === BUDGET.eightK && o4.maxBytes === BUDGET.max && sameList(o4.selection_resolution, ['8k']) && Array.isArray(o4.expanded)
    && o4.expanded.length === 5 && o4.expanded.reduce((s, x) => s + x.sizeBytes, 0) === BUDGET.eightK, 'A04 の8kの合計が違います');
  check(a04.error?.name === 'Error' && a04.error.message === A04_MESSAGE, 'A04 の原典の例外が違います');
  check(ob4.download_requests === 0 && ob4.budget_dir_existed_before === false && ob4.budget_dir_created === false && ob4.network?.requests === 0
    && ob4.exceeds_by_bytes === BUDGET.eightK - BUDGET.max && !('unexpected_download' in ob4), 'A04 の「通信0件・フォルダーなし」の記録が違います');

  // A07：Fabだけを直接取得に絞ると skipped（エラーではない）
  const a07 = recs.A07.rec, o7 = a07.output || {}, q7 = a07.input?.request || {};
  check(!a07.error && deepEqual(q7.providers, ['fab']) && q7.downloadableOnly === true && Array.isArray(o7.results) && o7.results.length === 0
    && Array.isArray(o7.providers) && o7.providers.length === 1, 'A07 の入力か結果が違います');
  const f7 = o7.providers[0];
  check(f7.provider === 'fab' && f7.status === 'skipped' && f7.error === 'no direct downloads' && f7.count === 0
    && a07.observations?.network?.requests === 0 && deepEqual(a07.observations.provider_status, {fab: 'skipped'}), 'A07 の Fab の状態か通信の記録が違います');

  // 依頼文と実表示の静止画
  const request = text(P.request);
  check(request.includes(SOURCE_COMMIT) && request.includes('4194304') && request.includes('Webの小さなシーンに置くCC0の木箱') && request.includes('Studio-Yebisu-3D-example/1.0'),
    'request.txt の依頼文が違います');
  const png = bytes.get(IMAGE_PATH);
  check(PNG_SIG.every((b, i) => png[i] === b), `${IMAGE_PATH} がPNGではありません`);

  const files8 = man.map((x) => ({path: x.path, name: x.path.split('/').pop(), bytes: x.bytes, sha256: x.sha256, kind: kindOf(x.path), tag: tagOf(x.path)}));
  const files4 = o4.expanded.map((x) => ({path: x.path, name: x.path.split('/').pop(), bytes: x.sizeBytes, kind: kindOf(x.path), tag: tagOf(x.path)}));
  const sel = (r) => `${r.input.asset_id}・${r.input.selection.format}・${r.input.selection.resolution}・予算 ${fmtBytes(r.input.max_bytes)}`;
  const c8 = o8.bundle.contents;
  const job = (id, extra) => ({
    id, label: PRESET_LABEL[id], recordLabel: recs[id].rec.label, operation: recs[id].rec.operation,
    path: recordPath(id), bytes: RECORD_PINS[id].bytes, sha256: RECORD_PINS[id].sha256, body: recs[id].body, rec: recs[id].rec,
    desk: `desk.html#${id}`, download: `3d-asset-server-${id}.json`, ...extra,
  });
  const jobs = {
    A08: job('A08', {
      files: files8, total: total8, max: a08.input.max_bytes, requests: ob8.download_requests, binUrl8k: /\/8k\//.test(bin8.url), binBytes: bin8.bytes,
      folder: o8.folder, contents: c8, triangles: o8.gltf.scene.triangles, meshes: o8.gltf.counts.meshes,
      inputText: sel(a08),
      resultText: `${files8.length}ファイル・${fmtBytes(total8)}（${fmtMiB(total8)}）：gltf ${c8.gltf}・bin ${c8.bin}・画像 ${c8.images}`,
      networkText: `dl.polyhaven.org へ ${calls8.length}件（すべて HTTP ${calls8[0].status}・保存ファイルと同じ SHA-256）`,
    }),
    A04: job('A04', {
      files: files4, total: o4.totalBytes, max: o4.maxBytes, requests: ob4.download_requests, error: {name: a04.error.name, message: a04.error.message},
      exceeds: ob4.exceeds_by_bytes,
      inputText: sel(a04),
      resultText: `${a04.error.name}: ${a04.error.message}（合計 ${fmtBytes(o4.totalBytes)}・予算を ${fmtBytes(ob4.exceeds_by_bytes)} 超過）`,
      networkText: `取得の通信 ${ob4.download_requests}件・保存フォルダーは作られていない`,
    }),
    A07: job('A07', {
      files: [], total: 0, requests: a07.observations.network.requests, provider: {name: f7.name, status: f7.status, error: f7.error},
      inputText: `「${q7.query}」・${q7.types.join('・')}・配信元 ${q7.providers.join('・')}・downloadableOnly・freeOnly・${q7.limit}件まで`,
      resultText: `結果 ${o7.results.length}件・${f7.name} は ${f7.status}（error 欄の「${f7.error}」は対象外の理由で、配信元の失敗ではない）`,
      networkText: `${a07.observations.network.requests}件（Fab への通信なし）`,
    }),
  };
  return {
    manifest, definition: S.definition, roles: S.roles, notes: S.notes, workflow: S.workflow, imageMeaning: S.actual_view_image.meaning,
    asset: S.asset, counts: S.counts, budget: {max: BUDGET.max, oneK: BUDGET.oneK, eightK: BUDGET.eightK},
    parts, candidates, a01: {fabSearchUrl: fab1.searchUrl, phTotal: ph1.total}, jobs, request,
    run: {node: runs.runtime.node, operations: sum.operations, checks: ver.total, requests: net.requests, api: net.api_requests, files: net.file_requests,
      deps: (up.runtime_dependencies || []).filter((x) => x && isStr(x.name)).map((x) => `${x.name} ${x.version}（${x.license}）`)},
  };
}

// 照合済みのバイトだけを画像として読む（URL指定の読み込みはしない）
async function decodeImage(bytes) {
  const blob = new Blob([bytes], {type: 'image/png'});
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      return {source: bmp, w: bmp.width, h: bmp.height};
    } catch { /* 下の通常の画像の読み込みで試す */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return {source: img, w: img.naturalWidth, h: img.naturalHeight};
  } catch {
    return fail(`${IMAGE_PATH} を画像として読めませんでした`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 25件をすべて取り直して照合する。どれか一つでも違えば例外。
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
    onProgress?.('assets', 0, manifest.files.length);
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
      if (!failed) onProgress?.('assets', ++done, manifest.files.length);
    }));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const bundle = buildBundle(manifest, bytes);
    onProgress?.('image', 0, 1);
    bundle.image = await decodeImage(bytes.get(IMAGE_PATH));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return deepFreeze(bundle);
  } finally {
    signal?.removeEventListener('abort', relay);
  }
}

// ---------- 概念図（ページと図解動画で共通） ----------
// 渡す：手順書の本（見出し札3つ・規則の印5つ）と依頼の札がAIへ合流 → AIが書いた run.mjs → 制作担当がNodeで実行
// 選んで確かめる：原典の AssetService が Poly Haven（API）と Fab（リンクだけ）へ分かれる → 候補カード3枚 → 選んだ木箱にCC0と形式の札
//                → カードが5つのファイルに開き、予算のゲートへ（A08 1kは通る・A04 8kは止まる）
// 受け取る：同じ5ファイルが相対パスのまま保存フォルダーへ → 実表示の静止画（実3Dの入口）とZIP

export const FONT = Object.freeze({
  sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", "Noto Serif JP", serif',
  mono: '"BIZ UDGothic", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
});
// 紙・墨・木・銅。青灰はAIが読む／書く側、銅は実際の実行と実データの流れ、緑は条件に合う、朱は止まる。
export const PALETTES = Object.freeze({
  light: Object.freeze({bg: '#ece3d3', sheet: '#fbf8f1', ink: '#201a15', muted: '#5a4f46', rule: '#c6b59c', faint: '#e4d9c6',
    copper: '#9c4d1b', copperSoft: '#f1dccb', slate: '#3e5170', slateSoft: '#dfe4ec', green: '#2d6a43', greenSoft: '#dcebdf',
    stop: '#9b2c1c', stopSoft: '#f6dcd4', wood: '#b77b45', woodDark: '#6f4220', onWood: '#fbf8f1', onInk: '#fbf8f1'}),
  dark: Object.freeze({bg: '#171310', sheet: '#221c18', ink: '#efe6d8', muted: '#bcae9c', rule: '#4c4239', faint: '#2a231e',
    copper: '#e39a63', copperSoft: '#3d2a1d', slate: '#aebedb', slateSoft: '#262d3a', green: '#8fcd9f', greenSoft: '#1f3326',
    stop: '#f29a86', stopSoft: '#3e231d', wood: '#c99260', woodDark: '#8d5c33', onWood: '#fff7ea', onInk: '#171310'}),
});

// [x, y, w, h]（図の幅・高さに対する割合）
const TALL = {
  book: [0.020, 0.008, 0.310, 0.142], other: [0.020, 0.160, 0.310, 0.036], request: [0.020, 0.206, 0.310, 0.070],
  ai: [0.400, 0.030, 0.220, 0.105], script: [0.720, 0.008, 0.140, 0.112], operator: [0.600, 0.160, 0.380, 0.080],
  service: [0.100, 0.300, 0.880, 0.050], ph: [0.020, 0.385, 0.560, 0.055], fab: [0.620, 0.385, 0.360, 0.055],
  cands: [0.020, 0.470, 0.560, 0.120], fabres: [0.620, 0.470, 0.360, 0.100], gate: [0.020, 0.618, 0.960, 0.120],
  folder: [0.020, 0.772, 0.560, 0.223], preview: [0.620, 0.772, 0.360, 0.223],
};
const WIDE = {
  book: [0.010, 0.030, 0.145, 0.420], other: [0.010, 0.500, 0.145, 0.100], request: [0.010, 0.660, 0.145, 0.200],
  ai: [0.180, 0.080, 0.130, 0.220], script: [0.240, 0.400, 0.055, 0.240], operator: [0.205, 0.740, 0.105, 0.180],
  service: [0.335, 0.030, 0.345, 0.120], ph: [0.335, 0.230, 0.200, 0.110], fab: [0.560, 0.230, 0.120, 0.110],
  cands: [0.335, 0.410, 0.200, 0.250], fabres: [0.560, 0.410, 0.120, 0.210], gate: [0.335, 0.700, 0.345, 0.200],
  folder: [0.720, 0.500, 0.270, 0.460], preview: [0.720, 0.030, 0.270, 0.410],
};
export const NODE_KEYS = Object.freeze(Object.keys(TALL));
// 線の種類：dash は未実行の入口、ai は手順書と依頼をAIが読み書きする流れ、hand は書いた台本の受け渡し、
// run は実際の実行と実データ、link は Fab のリンクだけの返り、stop は予算で止まる脇道
const EDGE_KIND = {bookOther: 'dash', bookAi: 'ai', reqAi: 'ai', aiScript: 'ai', scriptOp: 'hand', opService: 'run', servicePh: 'run',
  serviceFab: 'link', phCands: 'run', fabRes: 'link', cardsGate: 'run', side8k: 'stop', gateFolder: 'run', folderPreview: 'run'};
export const ALL_EDGES = Object.freeze(Object.keys(EDGE_KIND));
const EDGE_STAGE = {bookOther: 0, bookAi: 0, reqAi: 0, aiScript: 0, scriptOp: 0, opService: 1, servicePh: 1, serviceFab: 1, phCands: 1,
  fabRes: 1, cardsGate: 1, side8k: 1, gateFolder: 2, folderPreview: 2};
// 6つの部分を選んだときに枠を付ける場所
export const PART_NODES = Object.freeze({skill: ['book'], execute: ['other', 'ai', 'script', 'operator'], providers: ['service', 'ph', 'fab', 'fabres'],
  selection: ['cands', 'lane1'], budget: ['gate'], use: ['folder', 'preview']});

export function chooseKind(W, H) { return W >= 640 && W / H >= 1.25 ? 'wide' : 'tall'; }

const right = (r) => r.x + r.w;
const bottom = (r) => r.y + r.h;
const midX = (r) => r.x + r.w / 2;
const midY = (r) => r.y + r.h / 2;
const ctr = (r) => [midX(r), midY(r)];

export function conceptLayout(kind, W, H) {
  const wide = kind === 'wide';
  const spec = wide ? WIDE : TALL;
  const n = {};
  for (const [k, [x, y, w, h]] of Object.entries(spec)) n[k] = {x: x * W, y: y * H, w: w * W, h: h * H};
  const u = wide ? Math.min(W / 74, H / 34) : Math.min(W / 26, H / 40);
  const phone = W < 600;
  const f = {label: Math.max(phone ? 13 : 11, u * 0.95), small: Math.max(phone ? 11 : 10, u * 0.8), tiny: Math.max(phone ? 10 : 9, u * 0.68), big: Math.max(phone ? 15 : 13, u * 1.2)};
  const gap = Math.max(3, u * 0.3);

  // 候補：選んだ木箱（左の大きいカード）と、ほかの2件（右に小さく2段）
  const capH = f.tiny * 1.5;
  const ci = {x: n.cands.x + gap, y: n.cands.y + capH, w: n.cands.w - gap * 2, h: n.cands.h - capH - gap};
  const cardSlots = [
    {x: ci.x, y: ci.y, w: ci.w * 0.5, h: ci.h},
    {x: ci.x + ci.w * 0.5 + gap, y: ci.y, w: ci.w * 0.5 - gap, h: (ci.h - gap) / 2},
    {x: ci.x + ci.w * 0.5 + gap, y: ci.y + (ci.h + gap) / 2, w: ci.w * 0.5 - gap, h: (ci.h - gap) / 2},
  ];
  const fr = n.fabres;
  const fabRows = {
    link: {x: fr.x + gap, y: fr.y + gap * 0.5, w: fr.w - gap * 2, h: fr.h / 2 - gap * 0.75},
    skip: {x: fr.x + gap, y: midY(fr) + gap * 0.25, w: fr.w - gap * 2, h: fr.h / 2 - gap * 0.75},
  };

  // 予算のゲート：A08 1k の通り道と、A04 8k の脇道。下端の棒が予算（4MiB）で、合計の長さを塗る
  const col1 = wide ? n.fabres : n.cands, col8 = wide ? n.cands : n.fabres;
  n.lane1 = {x: col1.x, y: n.gate.y, w: col1.w, h: n.gate.h};
  n.lane8 = {x: col8.x, y: n.gate.y, w: col8.w, h: n.gate.h};
  const lanes = {};
  for (const [which, r] of [['1k', n.lane1], ['8k', n.lane8]]) {
    const ix = r.x + gap, iw = r.w - gap * 2;
    const textH = f.tiny * 1.45, barH = Math.max(5, u * 0.36);
    const text = {x: ix, y: r.y + gap * 0.5, w: iw, h: textH};
    const labW = wide ? f.tiny * 4.8 : f.tiny * 2.7;
    const bar = {x: ix, y: bottom(r) - gap - barH, w: iw - labW - gap * 0.6, h: barH};
    const barLabel = {x: right(bar) + gap * 0.6, y: bar.y + barH / 2, w: labW};
    const top = bottom(text) + gap * 0.4, slotH = Math.max(6, bar.y - gap * 0.8 - top);
    const sg = Math.max(2, gap * 0.6), sw = (iw - sg * 4) / 5;
    lanes[which] = {r, text, bar, barLabel, slots: [0, 1, 2, 3, 4].map((i) => ({x: ix + i * (sw + sg), y: top, w: sw, h: slotH}))};
  }

  // 保存フォルダー：同じ大きさのタイルが、相対パスのまま入る（直下に gltf・bin、textures/ に画像3つ）
  const fo = n.folder;
  const tabH = Math.max(f.tiny * 1.55, Math.min(fo.h * 0.13, f.small * 1.8));
  const fi = {x: fo.x + gap, y: fo.y + tabH + gap, w: fo.w - gap * 2, h: fo.h - tabH - gap * 2};
  const t1 = laneTile(lanes['1k'].slots[0], true);
  const tw = t1.w, th = Math.min(t1.h, fi.h / 3.6);
  const listMode = fi.w >= tw * 7 && fi.h >= (th + gap * 0.6) * 6;
  let root, tex, texLabel;
  if (listMode) {
    const rowH = fi.h / 6;
    const rowY = (i) => fi.y + rowH * i + (rowH - th) / 2;
    root = [0, 1].map((i) => ({x: fi.x, y: rowY(i), w: tw, h: th}));
    texLabel = {x: fi.x, y: fi.y + rowH * 2, w: fi.w, h: rowH};
    tex = [0, 1, 2].map((i) => ({x: fi.x + tw * 0.6, y: rowY(3 + i), w: tw, h: th}));
  } else {
    const labH = f.tiny * 1.3;
    const rowGap = Math.max(gap * 0.5, (fi.h - th * 2 - labH) / 3);
    root = [0, 1].map((i) => ({x: fi.x + i * (tw + gap), y: fi.y + rowGap * 0.5, w: tw, h: th}));
    texLabel = {x: fi.x, y: bottom(root[0]) + rowGap * 0.6, w: fi.w, h: labH};
    tex = [0, 1, 2].map((i) => ({x: fi.x + i * (tw + gap), y: bottom(texLabel) + rowGap * 0.2, w: tw, h: th}));
  }
  const zipW = f.tiny * 3.2, zipH = Math.min(tabH * 0.92, f.tiny * 1.6);
  const folder = {tabH, inner: fi, root, tex, texLabel, listMode, zip: {x: right(fo) - zipW - gap * 0.5, y: fo.y + (tabH - zipH) / 2, w: zipW, h: zipH}};

  // 実表示の静止画と出典
  const pv = n.preview;
  const credH = f.tiny * 1.3 * 2 + gap * 0.4;
  const img = {x: pv.x + gap, y: pv.y + gap, w: pv.w - gap * 2, h: pv.h - credH - gap * 2};
  const preview = {img, cred: {x: pv.x + gap, y: bottom(img) + gap * 0.5, w: pv.w - gap * 2, h: credH},
    chip: {x: right(img) - f.tiny * 3.3, y: img.y + gap * 0.4, w: f.tiny * 3, h: f.tiny * 1.55}};

  // 線
  const e = {};
  const svc = n.service, op = n.operator, req = n.request;
  e.bookOther = [[midX(n.book), bottom(n.book)], [midX(n.book), n.other.y]];
  e.bookAi = [[right(n.book), midY(n.ai)], [n.ai.x, midY(n.ai)]];
  if (wide) {
    const ax = n.ai.x + n.ai.w * 0.12;
    e.reqAi = [[right(req), midY(req)], [ax, midY(req)], [ax, bottom(n.ai)]];
    e.aiScript = [[midX(n.script), bottom(n.ai)], [midX(n.script), n.script.y]];
    const sx = (right(op) + svc.x) / 2;
    e.opService = [[right(op), midY(op)], [sx, midY(op)], [sx, midY(svc)], [svc.x, midY(svc)]];
  } else {
    e.reqAi = [[right(req), midY(req)], [midX(n.ai), midY(req)], [midX(n.ai), bottom(n.ai)]];
    e.aiScript = [[right(n.ai), midY(n.script)], [n.script.x, midY(n.script)]];
    e.opService = [[midX(op), bottom(op)], [midX(op), svc.y]];
  }
  e.scriptOp = [[midX(n.script), bottom(n.script)], [midX(n.script), op.y]];
  e.servicePh = [[midX(n.ph), bottom(svc)], [midX(n.ph), n.ph.y]];
  e.serviceFab = [[midX(n.fab), bottom(svc)], [midX(n.fab), n.fab.y]];
  e.phCands = [[midX(n.ph), bottom(n.ph)], [midX(n.ph), n.cands.y]];
  e.fabRes = [[midX(n.fab), bottom(n.fab)], [midX(n.fab), n.fabres.y]];
  // 選んだカードの下で1本に出て、途中で 1k の通り道と 8k の脇道に分かれる
  const cx = midX(cardSlots[0]);
  const yMid = (Math.max(bottom(n.cands), bottom(n.fabres)) + n.gate.y) / 2;
  e.cardsGate = [[cx, bottom(n.cands)], [cx, yMid], [midX(n.lane1), yMid], [midX(n.lane1), n.gate.y]];
  e.side8k = [[cx, bottom(n.cands)], [cx, yMid], [midX(n.lane8), yMid], [midX(n.lane8), n.gate.y]];
  if (wide) {
    const yLow = (bottom(n.gate) + H) / 2, xTurn = (right(n.gate) + n.folder.x) / 2;
    e.gateFolder = [[midX(n.lane1), bottom(n.gate)], [midX(n.lane1), yLow], [xTurn, yLow], [xTurn, midY(n.folder)], [n.folder.x, midY(n.folder)]];
    e.folderPreview = [[midX(n.folder), n.folder.y], [midX(n.folder), bottom(n.preview)]];
  } else {
    e.gateFolder = [[midX(n.lane1), bottom(n.gate)], [midX(n.lane1), n.folder.y]];
    e.folderPreview = [[right(n.folder), midY(n.preview)], [n.preview.x, midY(n.preview)]];
  }
  return {kind, W, H, u, f, gap, n, e, cardSlots, fabRows, lanes, folder, preview};
}

// 1kのタイルは低く、8kは高く（大きさの違いの目印。実際の比は予算の棒の長さで示す）。どちらも枠の下端にそろえる
function laneTile(slot, one) {
  const h = one ? Math.min(slot.h * 0.7, slot.w * 0.8) : Math.min(slot.h, slot.w * 1.3);
  return {x: slot.x, y: slot.y + slot.h - h, w: slot.w, h};
}
function folderSlot(L, files, i) {
  const isTex = (x) => x.path.startsWith('textures/');
  const file = files[i];
  const j = files.filter((x) => isTex(x) === isTex(file)).indexOf(file);
  return (isTex(file) ? L.folder.tex : L.folder.root)[j] || L.folder.root[0];
}

// 既定は完成した姿（A08）。ページの段階と動画は、ここから値を変える。
export function restParams() {
  return {
    show: {}, emph: {}, emphEdge: {}, draw: {}, flow: {},
    bookOpen: 1, tabs: 1, rules: 1, give: 1, write: 1, hand: 1, run: 1,
    fork: 1, cards: 1, fabLink: 1, fabSkip: 0, tags: 1,
    split1: 1, split8: 0, meter1: 1, meter8: 0, stop8: 0, pass1: 1, reveal: 1, bundle: 1,
    lane1: 1, lane8: 0, phIdle: 0, endIdle: 0, res: '1k',
    focusPart: null,
  };
}

// ページの段階：τ=1 渡す、τ=2 選んで確かめる、τ=3 受け取る。τの途中は動きの途中。図の形と線はいつも全部見せる。
const STAGE_NODES = {book: [1, 0, 0], other: [1, 0, 0], request: [1, 0, 0], ai: [1, 0, 0], script: [1, 0, 0], operator: [1, 1, 0],
  service: [0, 1, 0], ph: [0, 1, 0], fab: [0, 1, 0], cands: [0, 1, 0], fabres: [0, 1, 0], gate: [0, 1, 1], folder: [0, 0, 1], preview: [0, 0, 1]};
export function storyParams(tau, jobId) {
  const p = restParams();
  const F = p.flow;
  p.bookOpen = prog(tau, 0, 0.2);
  p.tabs = prog(tau, 0.05, 0.3);
  p.rules = prog(tau, 0.15, 0.4);
  F.bookAi = F.reqAi = prog(tau, 0.3, 0.5);
  p.give = prog(tau, 0.3, 0.6);
  F.aiScript = prog(tau, 0.52, 0.64);
  p.write = prog(tau, 0.55, 0.75);
  F.scriptOp = prog(tau, 0.75, 0.9);
  p.hand = prog(tau, 0.72, 0.95);
  p.run = prog(tau, 0.9, 1);
  F.opService = prog(tau, 1.0, 1.1);
  p.fork = prog(tau, 1.05, 1.25);
  F.servicePh = F.serviceFab = prog(tau, 1.1, 1.25);
  F.phCands = prog(tau, 1.2, 1.3);
  p.cards = prog(tau, 1.2, 1.45);
  F.fabRes = prog(tau, 1.2, 1.3);
  const fabK = prog(tau, 1.22, 1.42);
  p.fabLink = fabK;
  p.tags = prog(tau, 1.45, 1.6);
  const splitK = prog(tau, 1.58, 1.8), meterK = prog(tau, 1.78, 1.92), routeK = prog(tau, 1.58, 1.7);
  F.gateFolder = prog(tau, 2.0, 2.15);
  p.pass1 = prog(tau, 2.0, 2.4);
  F.folderPreview = prog(tau, 2.4, 2.5);
  p.reveal = prog(tau, 2.45, 2.8);
  p.bundle = prog(tau, 2.7, 3.0);
  if (jobId === 'A04') {
    Object.assign(p, {lane1: 0, lane8: 1, res: '8k', split1: 0, split8: splitK, meter1: 0, meter8: meterK, stop8: prog(tau, 1.9, 2.0),
      pass1: 0, reveal: 0, bundle: 0, endIdle: 1});
    F.side8k = routeK;
    F.gateFolder = F.folderPreview = 0;
  } else if (jobId === 'A07') {
    // A07 は Fab だけを指定した検索。Poly Haven は呼ばれず、A01 の候補カードは薄く残す
    Object.assign(p, {lane1: 0, lane8: 0, res: null, split1: 0, split8: 0, meter1: 0, meter8: 0, stop8: 0, pass1: 0, reveal: 0, bundle: 0,
      endIdle: 1, phIdle: 1, fabLink: 0, fabSkip: fabK, tags: 0, cards: 1});
    F.servicePh = F.phCands = F.gateFolder = F.folderPreview = 0;
  } else {
    p.split1 = splitK;
    p.meter1 = meterK;
    F.cardsGate = routeK;
  }
  const w = [tau <= 1 ? 1 : clamp01(2 - tau), clamp01(1 - Math.abs(tau - 2)), clamp01(tau - 2)];
  const weight = (m) => Math.max(m[0] * w[0], m[1] * w[1], m[2] * w[2]);
  for (const [k, m] of Object.entries(STAGE_NODES)) p.emph[k] = 0.62 + 0.38 * weight(m);
  for (let i = 0; i < 3; i++) p.emphEdge[i] = 0.62 + 0.38 * w[i];
  return p;
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
  const phone = c.canvas.id === 'concept-map' && c.canvas.clientWidth < 600;
  let size = Math.max(o.size || 14, phone ? 10 : 0);
  const min = Math.max(Math.min(size, o.min || 9), phone ? 10 : 0);
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
const textW = (c, s, size, weight = 700, family = FONT.sans) => { c.font = `${weight} ${size}px ${family}`; return c.measureText(s).width; };
// 中央に1〜2行（上は太字、下は小さく）
function lines2(c, r, a, b, o) {
  const pad = o.pad ?? 4;
  const s1 = Math.min(o.size, r.h * 0.46), s2 = Math.min(o.sub ?? s1 * 0.8, r.h * 0.34);
  if (!b || r.h < (s1 + s2) * 1.2) {
    drawText(c, a, midX(r), midY(r), {size: Math.min(o.size, r.h * 0.62), weight: 700, family: o.family, color: o.color, align: 'center', max: r.w - pad * 2, min: 7});
    return;
  }
  const gy = s1 * 0.2, top = midY(r) - (s1 + gy + s2) / 2;
  drawText(c, a, midX(r), top + s1 / 2, {size: s1, weight: 700, family: o.family, color: o.color, align: 'center', max: r.w - pad * 2, min: 7});
  drawText(c, b, midX(r), top + s1 + gy + s2 / 2, {size: s2, color: o.subColor || o.color, align: 'center', max: r.w - pad * 2, min: 7});
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
    if (s.len < 0.01) continue;
    const q = Math.min(1, d / s.len);
    const x = s.x0 + (s.x1 - s.x0) * q, y = s.y0 + (s.y1 - s.y0) * q;
    c.lineTo(x, y);
    end = {x, y, a: Math.atan2(s.y1 - s.y0, s.x1 - s.x0)};
    d -= s.len;
  }
  c.strokeStyle = o.color;
  c.lineWidth = o.width;
  c.lineJoin = 'round';
  c.lineCap = o.dash ? 'butt' : 'round';
  c.setLineDash(o.dash ? [o.dash, o.dash * 0.8] : []);
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
function box(c, r, pal, o = {}) {
  rr(c, r.x, r.y, r.w, r.h, o.radius ?? 4);
  if (o.fill !== false) { c.fillStyle = o.fill || pal.sheet; c.fill(); }
  c.setLineDash(o.dash ? [o.dash, o.dash * 0.75] : []);
  c.strokeStyle = o.stroke || pal.ink;
  c.lineWidth = o.lw || 1.4;
  c.stroke();
  c.setLineDash([]);
}
function fileShape(c, r, pal, o = {}) {
  const fold = Math.min(r.w * 0.3, r.h * 0.32);
  c.beginPath();
  c.moveTo(r.x, r.y);
  c.lineTo(r.x + r.w - fold, r.y);
  c.lineTo(r.x + r.w, r.y + fold);
  c.lineTo(r.x + r.w, r.y + r.h);
  c.lineTo(r.x, r.y + r.h);
  c.closePath();
  if (o.fill !== false) { c.fillStyle = o.fill || pal.sheet; c.fill(); }
  c.setLineDash(o.dash ? [o.dash, o.dash * 0.75] : []);
  c.strokeStyle = o.stroke || pal.ink;
  c.lineWidth = o.lw || 1.3;
  c.stroke();
  c.setLineDash([]);
  c.beginPath();
  c.moveTo(r.x + r.w - fold, r.y);
  c.lineTo(r.x + r.w - fold, r.y + fold);
  c.lineTo(r.x + r.w, r.y + fold);
  c.stroke();
}
function chip(c, r, label, o) {
  rr(c, r.x, r.y, r.w, r.h, Math.min(r.h / 2, 5));
  c.fillStyle = o.fill;
  c.fill();
  if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = 1.2; c.stroke(); }
  drawText(c, label, midX(r), midY(r), {size: Math.min(o.size, r.h * 0.74), weight: 700, color: o.color, align: 'center', max: r.w - 3, min: 6});
}
function checkMark(c, x, y, s, color) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = Math.max(1.4, s * 0.2);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(x - s * 0.45, y);
  c.lineTo(x - s * 0.12, y + s * 0.33);
  c.lineTo(x + s * 0.48, y - s * 0.38);
  c.stroke();
  c.restore();
}
// 止まる印：丸に斜めの棒
function stopMark(c, x, y, s, pal) {
  c.save();
  c.beginPath();
  c.arc(x, y, s / 2, 0, Math.PI * 2);
  c.fillStyle = pal.stopSoft;
  c.fill();
  c.strokeStyle = pal.stop;
  c.lineWidth = Math.max(1.5, s * 0.14);
  c.stroke();
  c.beginPath();
  c.moveTo(x - s * 0.3, y + s * 0.3);
  c.lineTo(x + s * 0.3, y - s * 0.3);
  c.stroke();
  c.restore();
}
function linkIcon(c, x, y, s, color) {
  c.save();
  c.translate(x, y);
  c.rotate(-Math.PI / 4);
  c.strokeStyle = color;
  c.lineWidth = Math.max(1.3, s * 0.14);
  rr(c, -s * 0.62, -s * 0.2, s * 0.7, s * 0.4, s * 0.2);
  c.stroke();
  rr(c, -s * 0.08, -s * 0.2, s * 0.7, s * 0.4, s * 0.2);
  c.stroke();
  c.restore();
}
function diamond(c, x, y, s, color) {
  c.beginPath();
  c.moveTo(x, y - s);
  c.lineTo(x + s, y);
  c.lineTo(x, y + s);
  c.lineTo(x - s, y);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}
// 木箱の形（候補カードの絵）：ふたと、板の線
function crateGlyph(c, r, pal) {
  if (r.w < 4 || r.h < 4) return;
  const lid = r.h * 0.28;
  c.fillStyle = pal.wood;
  c.fillRect(r.x, r.y + lid, r.w, r.h - lid);
  c.fillStyle = pal.woodDark;
  c.fillRect(r.x - r.w * 0.03, r.y, r.w * 1.06, lid);
  c.strokeStyle = pal.woodDark;
  c.lineWidth = Math.max(0.8, r.h * 0.05);
  c.beginPath();
  for (let i = 1; i < 3; i++) { const y = r.y + lid + ((r.h - lid) * i) / 3; c.moveTo(r.x, y); c.lineTo(r.x + r.w, y); }
  c.stroke();
  c.strokeRect(r.x, r.y + lid, r.w, r.h - lid);
}
// ファイルのタイル：gltf は紙（銅の縁）、bin は濃い木、画像は木目と名札。同じ形のまま、通り道とフォルダーを移る
function fileTile(c, r, pal, file, f, o = {}) {
  if (r.w < 3 || r.h < 3) return;
  const stroke = o.stop ? pal.stop : file.kind === 'gltf' ? pal.copper : pal.woodDark;
  const lw = Math.max(1.1, Math.min(r.w, r.h) * 0.06);
  const size = Math.min(f.tiny, r.h * 0.46, r.w * 0.36);
  if (file.kind === 'gltf') {
    fileShape(c, r, pal, {fill: pal.sheet, stroke, lw});
    drawText(c, file.tag, midX(r), midY(r) + r.h * 0.08, {size, weight: 700, color: pal.copper, align: 'center', max: r.w - 3, min: 6});
  } else if (file.kind === 'bin') {
    rr(c, r.x, r.y, r.w, r.h, 2);
    c.fillStyle = pal.woodDark;
    c.fill();
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
    drawText(c, 'bin', midX(r), midY(r), {size, weight: 700, color: pal.onWood, align: 'center', max: r.w - 3, min: 6});
  } else {
    c.fillStyle = pal.wood;
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = pal.woodDark;
    c.lineWidth = Math.max(0.7, r.h * 0.035);
    c.beginPath();
    for (let i = 1; i <= 2; i++) {
      const y = r.y + (r.h * 0.56 * i) / 3;
      c.moveTo(r.x + 1, y);
      c.quadraticCurveTo(midX(r), y + r.h * 0.07 * (i % 2 ? 1 : -1), right(r) - 1, y);
    }
    c.stroke();
    const band = {x: r.x, y: r.y + r.h * 0.56, w: r.w, h: r.h * 0.44};
    c.fillStyle = pal.sheet;
    c.fillRect(band.x, band.y, band.w, band.h);
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.strokeRect(r.x, r.y, r.w, r.h);
    drawText(c, file.tag, midX(band), midY(band), {size: Math.min(size, band.h * 0.9), weight: 700, color: pal.ink, align: 'center', max: r.w - 3, min: 6});
  }
}
function focusBox(c, L, r, pal) {
  const pad = Math.max(3, L.u * 0.22);
  rr(c, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, L.u * 0.35);
  c.setLineDash([]);
  c.strokeStyle = pal.slate;
  c.lineWidth = 3;
  c.stroke();
}
const val = (o, k, dflt) => (o && o[k] !== undefined ? o[k] : dflt);

// ---- 形ごとの描画 ----
function drawBook(c, L, p, pal) {
  const r = L.n.book, {f, gap, u} = L;
  const tabH = Math.min(r.h * 0.2, f.tiny * 1.6);
  const body = {x: r.x, y: r.y + tabH, w: r.w, h: r.h - tabH};
  const open = ease(p.bookOpen);
  const spine = midX(body);
  const half = (body.w / 2) * (0.4 + 0.6 * open);
  const pages = {x: spine - half, y: body.y, w: half * 2, h: body.h};
  // 見出し札：手順の3つ（検索・確認・取得）
  const tw = (body.w - gap * 4) / 3;
  STEPS.forEach((label, i) => {
    const k = easeOut(stagger(p.tabs, i, 3, 0.4));
    if (k <= 0) return;
    const t = {x: body.x + gap + i * (tw + gap), y: body.y - tabH * k, w: tw, h: tabH * k + 3};
    rr(c, t.x, t.y, t.w, t.h, Math.min(4, tabH * 0.3));
    c.fillStyle = pal.slateSoft;
    c.fill();
    c.strokeStyle = pal.slate;
    c.lineWidth = 1.2;
    c.stroke();
    if (k > 0.6) drawText(c, label, midX(t), t.y + tabH * 0.5, {size: Math.min(f.tiny, tabH * 0.72), weight: 700, color: pal.slate, align: 'center', max: t.w - 2, min: 7});
  });
  // 表紙と見開き
  const pad = Math.max(1.5, u * 0.14);
  rr(c, pages.x - pad, pages.y - pad * 0.5, pages.w + pad * 2, pages.h + pad * 1.5, 3);
  c.fillStyle = pal.slate;
  c.fill();
  c.fillStyle = pal.sheet;
  c.fillRect(pages.x, pages.y, pages.w, pages.h);
  c.strokeStyle = pal.rule;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(spine, pages.y);
  c.lineTo(spine, bottom(pages));
  c.stroke();
  if (open < 0.5) return;
  alpha(c, (open - 0.5) * 2, () => {
    const left = {x: pages.x + gap * 0.8, y: pages.y + gap * 0.5, w: half - gap * 1.4, h: pages.h - gap};
    const rp = {x: spine + gap * 0.6, y: left.y, w: half - gap * 1.3, h: left.h};
    const hh = Math.min(f.tiny * 1.35, left.h * 0.3);
    const hs = Math.min(f.tiny, hh * 0.82);
    drawText(c, L.W < 600 ? '手順' : 'SKILL.md', left.x, left.y + hh / 2, {size: hs, weight: 700, family: FONT.mono, color: pal.ink, max: left.w, min: 6});
    drawText(c, L.W < 600 ? '規則' : 'AGENTS.md', rp.x, rp.y + hh / 2, {size: hs, weight: 700, family: FONT.mono, color: pal.ink, max: rp.w, min: 6});
    // 左：手順3つ（番号は見出し札と同じ順）
    const rowH = (left.h - hh) / 3;
    for (let i = 0; i < 3; i++) {
      const y = left.y + hh + rowH * (i + 0.5);
      const ns = Math.min(f.tiny, rowH * 0.78);
      drawText(c, String(i + 1), left.x, y, {size: ns, weight: 700, color: pal.slate, min: 6});
      const x0 = left.x + ns * 1.1, k = stagger(p.tabs, i, 3, 0.4);
      c.strokeStyle = pal.muted;
      c.lineWidth = Math.max(1, rowH * 0.12);
      c.beginPath();
      c.moveTo(x0, y);
      c.lineTo(x0 + (right(left) - x0) * (0.9 - i * 0.12) * k, y);
      c.stroke();
    }
    // 右：規則5つの印（場所があれば短い名札）
    const rH = (rp.h - hh) / 5;
    const named = rH >= f.tiny * 1.15 && rp.w >= f.tiny * 5;
    RULES.forEach((label, i) => {
      const k = stagger(p.rules, i, 5, 0.5);
      if (k <= 0) return;
      const y = rp.y + hh + rH * (i + 0.5), s = Math.min(rH * 0.32, f.tiny * 0.42);
      alpha(c, k, () => {
        diamond(c, rp.x + s, y, s, pal.slate);
        if (named) drawText(c, label, rp.x + s * 2.8, y, {size: Math.min(f.tiny, rH * 0.7), color: pal.ink, max: rp.w - s * 2.8, min: 7});
        else {
          c.strokeStyle = pal.rule;
          c.lineWidth = Math.max(1, rH * 0.14);
          c.beginPath();
          c.moveTo(rp.x + s * 2.6, y);
          c.lineTo(right(rp) - (i % 2 ? rp.w * 0.2 : 2), y);
          c.stroke();
        }
      });
    });
  });
}
function drawOther(c, L, pal) {
  const r = L.n.other, {f, gap, u} = L;
  box(c, r, pal, {fill: false, stroke: pal.muted, dash: Math.max(3, u * 0.25), lw: 1.1, radius: 3});
  const size = Math.min(f.tiny, r.h * 0.5);
  const sw = textW(c, '未実行', size) + size * 0.9;
  const stamp = {x: right(r) - gap * 0.6 - sw, y: r.y + r.h * 0.18, w: sw, h: r.h * 0.64};
  chip(c, stamp, '未実行', {fill: 'transparent', stroke: pal.muted, color: pal.muted, size});
  const avail = stamp.x - r.x - gap * 1.4;
  const full = '他の入口 MCP / REST';
  drawText(c, textW(c, full, size, 400) <= avail ? full : 'MCP / REST', r.x + gap * 0.8, midY(r), {size, color: pal.muted, max: avail, min: 7});
}
function drawRequest(c, L, d, pal) {
  const r = L.n.request, {f, gap} = L;
  box(c, r, pal, {fill: pal.sheet, stroke: pal.ink, lw: 1.4, radius: 3});
  // 綴じ穴（依頼の札）
  c.beginPath();
  c.arc(r.x + gap * 1.3, r.y + gap * 1.3, Math.max(1.5, gap * 0.4), 0, Math.PI * 2);
  c.strokeStyle = pal.muted;
  c.lineWidth = 1;
  c.stroke();
  const items = ['木箱', 'Web', 'CC0', fmtMiB(d.budget.max)];
  const full = items.join(' / ');
  const size = Math.min(f.small, r.h * 0.36);
  const avail = r.w - gap * 3;
  if (textW(c, full, size) <= avail) {
    if (r.h >= size * 2.9) {
      drawText(c, '依頼', r.x + gap * 2.6, r.y + r.h * 0.3, {size: Math.min(f.tiny, size), color: pal.muted, min: 7});
      drawText(c, full, midX(r), r.y + r.h * 0.66, {size, weight: 700, color: pal.ink, align: 'center', max: avail, min: 7});
    } else drawText(c, full, midX(r), midY(r), {size, weight: 700, color: pal.ink, align: 'center', max: avail, min: 7});
  } else {
    lines2(c, r, `${items[0]} / ${items[1]}`, `${items[2]} / ${items[3]}`, {size, sub: size, color: pal.ink, subColor: pal.ink, pad: gap});
  }
}
function drawAI(c, L, pal) {
  const r = L.n.ai, {f, u} = L;
  rr(c, r.x, r.y, r.w, r.h, Math.min(r.h / 2, u * 0.9));
  c.fillStyle = pal.slateSoft;
  c.fill();
  c.setLineDash([Math.max(3, u * 0.28), Math.max(2, u * 0.2)]);
  c.strokeStyle = pal.slate;
  c.lineWidth = 1.6;
  c.stroke();
  c.setLineDash([]);
  lines2(c, r, 'AI（Opus）', '読んで書く', {size: f.label, sub: f.tiny, color: pal.slate, subColor: pal.ink, pad: L.W < 600 ? 4 : r.h * 0.3});
}
function drawScript(c, L, p, pal) {
  const r = L.n.script, {f, gap, u} = L;
  fileShape(c, r, pal, {fill: pal.sheet, stroke: pal.slate, lw: 1.5, dash: p.write > 0 ? 0 : Math.max(3, u * 0.25)});
  const labH = f.tiny * 1.4;
  const area = {x: r.x + gap, y: r.y + Math.min(r.w * 0.3, r.h * 0.32) + gap * 0.3, w: r.w - gap * 2, h: r.h - labH - Math.min(r.w * 0.3, r.h * 0.32) - gap};
  const widths = [0.75, 0.5, 0.85, 0.4, 0.65];
  const n = Math.max(2, Math.min(widths.length, Math.floor(area.h / Math.max(4, u * 0.45))));
  for (let i = 0; i < n; i++) {
    const k = stagger(p.write, i, n, 0.5);
    if (k <= 0) continue;
    const y = area.y + (area.h * (i + 0.5)) / n;
    c.strokeStyle = i % 2 ? pal.muted : pal.slate;
    c.lineWidth = Math.max(1.2, u * 0.13);
    c.beginPath();
    c.moveTo(area.x + (i === 2 || i === 3 ? area.w * 0.12 : 0), y);
    c.lineTo(area.x + area.w * widths[i] * k, y);
    c.stroke();
  }
  drawText(c, 'run.mjs', midX(r), bottom(r) - labH / 2 - 1, {size: Math.min(f.tiny, r.w * 0.2), weight: 700, family: FONT.mono, color: pal.slate, align: 'center', max: r.w - 4, min: 6});
}
function drawOperator(c, L, p, pal) {
  const r = L.n.operator, {f, u} = L;
  rr(c, r.x, r.y, r.w, r.h, Math.min(u * 0.35, 6));
  c.fillStyle = pal.sheet;
  c.fill();
  alpha(c, ease(p.run), () => { c.fillStyle = pal.copperSoft; c.fill(); });
  c.strokeStyle = pal.copper;
  c.lineWidth = 2;
  c.stroke();
  lines2(c, r, '制作担当', 'Nodeで1回実行', {size: f.label, sub: f.tiny, color: pal.copper, subColor: pal.ink, pad: 4});
}
function drawService(c, L, pal) {
  const r = L.n.service, {f, gap} = L;
  box(c, r, pal, {fill: pal.sheet, stroke: pal.ink, lw: 1.8, radius: 3});
  const size = Math.min(f.label, r.h * 0.5);
  const ss = Math.min(f.tiny, size * 0.9);
  const sw = textW(c, '原典', ss) + ss * 1.1;
  const stamp = {x: r.x + gap, y: r.y + r.h * 0.2, w: sw, h: r.h * 0.6};
  chip(c, stamp, '原典', {fill: pal.ink, color: pal.onInk, size: ss});
  const x0 = right(stamp) + gap;
  const w1 = drawText(c, 'AssetService', x0, midY(r), {size, weight: 700, color: pal.ink, max: right(r) - x0 - gap, min: 8});
  const rest = right(r) - (x0 + w1) - gap * 2;
  const sub = '検索・詳細・選択・取得の関数';
  if (rest >= textW(c, sub, f.tiny, 400)) drawText(c, sub, x0 + w1 + gap * 1.2, midY(r), {size: f.tiny, color: pal.muted, max: rest});
}
function drawProvider(c, L, r, title, sub, pal, dashed) {
  const {f, u} = L;
  box(c, r, pal, {fill: pal.sheet, stroke: pal.ink, lw: 1.5, radius: 3, dash: dashed ? Math.max(3, u * 0.28) : 0});
  lines2(c, r, title, sub, {size: f.label, sub: f.tiny, color: pal.ink, subColor: pal.muted, pad: 4});
}
function candCard(c, L, r, cand, pal, chosen) {
  const {f} = L;
  if (r.w < 4 || r.h < 4) return;
  rr(c, r.x, r.y, r.w, r.h, 3);
  c.fillStyle = pal.sheet;
  c.fill();
  c.strokeStyle = chosen ? pal.woodDark : pal.rule;
  c.lineWidth = chosen ? 2 : 1.2;
  c.stroke();
  const pad = Math.max(2, r.h * 0.08);
  if (chosen) {
    const tagH = Math.min(f.tiny * 1.4, r.h * 0.3);
    const titled = r.h >= f.tiny * 5;
    const gh = r.h - tagH - pad * 3 - (titled ? f.tiny * 1.3 : 0);
    const gw = Math.min(r.w * 0.62, gh * 1.7);
    crateGlyph(c, {x: midX(r) - gw / 2, y: r.y + pad, w: gw, h: gh}, pal);
    if (titled) drawText(c, cand.short, midX(r), r.y + pad * 1.6 + gh + f.tiny * 0.62, {size: f.tiny, weight: 700, color: pal.ink, align: 'center', max: r.w - pad * 2, min: 7});
  } else {
    const gh = r.h - pad * 2, gw = Math.min(gh * 1.5, r.w * 0.34);
    crateGlyph(c, {x: r.x + pad, y: r.y + pad + gh * 0.12, w: gw, h: gh * 0.76}, pal);
    drawText(c, cand.short, r.x + pad * 2 + gw, midY(r), {size: Math.min(f.tiny, r.h * 0.52), color: pal.ink, max: r.w - gw - pad * 3, min: 6});
  }
}
function drawCands(c, L, p, d, pal) {
  const r = L.n.cands, {f, gap} = L;
  box(c, r, pal, {fill: pal.faint, stroke: pal.rule, lw: 1.1, radius: 4});
  drawText(c, `A01 候補${d.candidates.length}件`, r.x + gap, r.y + f.tiny * 0.78, {size: f.tiny, weight: 700, color: pal.muted, max: r.w - gap * 2, min: 7});
  d.candidates.forEach((cand, i) => {
    if (stagger(p.cards, i, 3, 0.4) >= 1) candCard(c, L, L.cardSlots[i], cand, pal, cand.chosen);
  });
  // 選んだ木箱の札：ライセンス（緑）と形式・解像度（銅）
  if (p.tags > 0 && p.cards >= 1) {
    const card = L.cardSlots[0];
    const pad = Math.max(2, card.h * 0.08);
    const tagH = Math.min(f.tiny * 1.4, card.h * 0.3), size = Math.min(f.tiny, tagH * 0.78);
    const labels = [['CC0', pal.greenSoft, pal.green], [p.res ? `glTF ${p.res}` : 'glTF', pal.copperSoft, pal.copper]];
    const widths = labels.map(([s]) => textW(c, s, size) + size * 0.9);
    const total = widths[0] + widths[1] + gap * 0.6;
    const scale = Math.min(1, (card.w - pad * 2) / total);
    let x = midX(card) - (total * scale) / 2;
    labels.forEach(([s, fill, ink], i) => {
      const k = easeOut(stagger(p.tags, i, 2, 0.4));
      if (k <= 0) return;
      const w = widths[i] * scale;
      alpha(c, k, () => chip(c, {x, y: bottom(card) - pad - tagH + (1 - k) * tagH * 0.6, w, h: tagH}, s, {fill, stroke: ink, color: ink, size: size * Math.max(0.8, scale)}));
      x += w + gap * 0.6 * scale;
    });
  }
}
function drawFabRes(c, L, p, d, pal) {
  const r = L.n.fabres, {f} = L;
  box(c, r, pal, {fill: false, stroke: pal.rule, lw: 1.1, radius: 4});
  const {link, skip} = L.fabRows;
  if (p.fabLink >= 1) {
    const s = Math.min(link.h * 0.7, f.small * 1.3);
    linkIcon(c, link.x + s * 0.6, midY(link), s, pal.copper);
    drawText(c, 'A01 検索URL', link.x + s * 1.35, midY(link), {size: Math.min(f.tiny, link.h * 0.5), weight: 700, color: pal.copper, max: link.w - s * 1.4, min: 6});
  }
  if (p.fabSkip > 0) {
    alpha(c, easeOut(p.fabSkip), () => {
      const size = Math.min(f.tiny, skip.h * 0.42);
      const label = `A07 ${d.jobs.A07.provider.status}`;
      const sw = Math.min(skip.w, textW(c, label, size) + size * 1.2);
      chip(c, {x: skip.x, y: skip.y + skip.h * 0.08, w: sw, h: Math.min(skip.h * 0.5, size * 1.6)}, label, {fill: 'transparent', stroke: pal.muted, color: pal.ink, size});
      drawText(c, '通信なし・エラーではない', skip.x, skip.y + skip.h * 0.8, {size: Math.min(f.tiny, skip.h * 0.34), color: pal.muted, max: skip.w, min: 6});
    });
  }
}
function drawLane(c, L, p, d, pal, which) {
  const one = which === '1k';
  const S = L.lanes[which], {f, gap, u} = L;
  const act = one ? p.lane1 : p.lane8;
  const job = one ? d.jobs.A08 : d.jobs.A04;
  const meter = one ? p.meter1 : p.meter8;
  const split = one ? p.split1 : p.split8;
  const tone = act > 0 ? pal.ink : pal.muted;
  alpha(c, 0.42 + 0.58 * act, () => {
    drawText(c, `${job.id} ${which}`, S.text.x, midY(S.text), {size: f.tiny, weight: 700, color: tone, max: S.text.w * 0.46, min: 7});
    if (meter > 0 && act > 0) {
      alpha(c, easeOut(meter), () => drawText(c, fmtMiB(job.total), right(S.text), midY(S.text), {size: f.tiny, weight: 700, color: one ? pal.green : pal.stop, align: 'right', max: S.text.w * 0.52, min: 7}));
    }
    // 5つの置き場（点線）
    c.setLineDash([Math.max(2, u * 0.16), Math.max(2, u * 0.14)]);
    c.strokeStyle = pal.rule;
    c.lineWidth = 1;
    for (const s of S.slots) { const t = laneTile(s, one); c.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1); }
    c.setLineDash([]);
    if (act > 0) {
      job.files.forEach((file, i) => {
        const ks = stagger(split, i, 5, 0.5), kp = one ? stagger(p.pass1, i, 5, 0.5) : 0;
        if (ks >= 1 && kp <= 0) fileTile(c, laneTile(S.slots[i], one), pal, file, f, {stop: !one && p.stop8 > 0});
      });
    }
    // 予算の棒：全長が予算。合計の割合を塗る（8k は端で止まる）
    const b = S.bar;
    rr(c, b.x, b.y, b.w, b.h, b.h / 2);
    c.fillStyle = pal.sheet;
    c.fill();
    if (meter > 0 && act > 0) {
      const ratio = Math.min(1, job.total / d.budget.max) * ease(meter);
      c.save();
      rr(c, b.x, b.y, b.w, b.h, b.h / 2);
      c.clip();
      c.fillStyle = one ? pal.green : pal.stop;
      c.fillRect(b.x, b.y, b.w * ratio, b.h);
      c.restore();
    }
    rr(c, b.x, b.y, b.w, b.h, b.h / 2);
    c.strokeStyle = !one && p.stop8 > 0 && act > 0 ? pal.stop : pal.ink;
    c.lineWidth = !one && p.stop8 > 0 && act > 0 ? 2.2 : 1.2;
    c.stroke();
    const lab = textW(c, `予算${fmtMiB(d.budget.max)}`, f.tiny, 700) <= S.barLabel.w ? `予算${fmtMiB(d.budget.max)}` : fmtMiB(d.budget.max);
    drawText(c, lab, S.barLabel.x, S.barLabel.y, {size: f.tiny, weight: 700, color: tone, max: S.barLabel.w, min: 6});
    if (one && meter >= 1 && act > 0) checkMark(c, b.x + b.w * Math.min(1, job.total / d.budget.max) + b.h * 1.6, b.y + b.h / 2, Math.max(8, b.h * 1.8), pal.green);
    if (!one && p.stop8 > 0 && act > 0) {
      alpha(c, easeOut(p.stop8), () => {
        const s = Math.max(10, Math.min(S.slots[0].h * 0.9, u * 1.1));
        stopMark(c, right(b) - s * 0.2, b.y + b.h / 2 - s * 0.55, s, pal);
        // 閉じた柵：タイルの下の太い線
        c.strokeStyle = pal.stop;
        c.lineWidth = Math.max(2, u * 0.18);
        c.beginPath();
        c.moveTo(S.slots[0].x, bottom(S.slots[0]) + gap * 0.35);
        c.lineTo(right(S.slots[4]), bottom(S.slots[4]) + gap * 0.35);
        c.stroke();
      });
    }
  });
}
function drawGate(c, L, p, d, pal) {
  const g = L.n.gate, {u} = L;
  box(c, g, pal, {fill: pal.faint, stroke: pal.rule, lw: 1.1, radius: 4, dash: Math.max(3, u * 0.25)});
  drawLane(c, L, p, d, pal, '1k');
  drawLane(c, L, p, d, pal, '8k');
}
function drawFolder(c, L, p, d, pal) {
  const r = L.n.folder, F = L.folder, {f, gap, u} = L;
  const idle = p.endIdle > 0;
  const tabW = Math.min(r.w * 0.82, r.w - F.zip.w - gap * 2);
  // フォルダーの形：つまみと本体
  c.beginPath();
  c.moveTo(r.x, r.y + F.tabH);
  c.lineTo(r.x, r.y + 3);
  c.quadraticCurveTo(r.x, r.y, r.x + 3, r.y);
  c.lineTo(r.x + tabW - F.tabH * 0.6, r.y);
  c.lineTo(r.x + tabW, r.y + F.tabH);
  c.lineTo(right(r), r.y + F.tabH);
  c.lineTo(right(r), bottom(r));
  c.lineTo(r.x, bottom(r));
  c.closePath();
  c.fillStyle = idle ? pal.faint : pal.sheet;
  c.fill();
  c.setLineDash(idle ? [Math.max(3, u * 0.28), Math.max(2, u * 0.2)] : []);
  c.strokeStyle = idle ? pal.muted : pal.ink;
  c.lineWidth = idle ? 1.2 : 1.6;
  c.stroke();
  c.setLineDash([]);
  const job = d.jobs.A08;
  drawText(c, `${job.folder}/`, r.x + gap, r.y + F.tabH * 0.55, {size: Math.min(f.tiny, F.tabH * 0.66), weight: 700, family: FONT.mono, color: idle ? pal.muted : pal.ink, max: tabW - gap * 2, min: 6});
  if (idle) {
    lines2(c, F.inner, '保存フォルダーなし', 'この操作では受け取らない', {size: f.small, sub: f.tiny, color: pal.muted, subColor: pal.muted, pad: gap});
    return;
  }
  // 置き場と、受け取った5ファイル（相対パスのまま）
  const files = job.files;
  c.setLineDash([Math.max(2, u * 0.16), Math.max(2, u * 0.14)]);
  c.strokeStyle = pal.rule;
  c.lineWidth = 1;
  for (const s of [...F.root, ...F.tex]) c.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
  c.setLineDash([]);
  drawText(c, 'textures/', F.texLabel.x, midY(F.texLabel), {size: Math.min(f.tiny, F.texLabel.h * 0.8), weight: 700, family: FONT.mono, color: pal.muted, max: F.texLabel.w, min: 6});
  const arrived = files.map((x, i) => p.lane1 > 0 && stagger(p.pass1, i, 5, 0.5) >= 1);
  files.forEach((file, i) => {
    if (!arrived[i]) return;
    const s = folderSlot(L, files, i);
    fileTile(c, s, pal, file, f);
    if (F.listMode) {
      const x0 = right(s) + gap;
      drawText(c, file.name, x0, midY(s), {size: f.tiny, family: FONT.mono, color: pal.ink, max: right(F.inner) - x0 - f.tiny * 6, min: 7});
      drawText(c, fmtBytes(file.bytes), right(F.inner), midY(s), {size: f.tiny, color: pal.muted, align: 'right', max: f.tiny * 6, min: 7});
    }
  });
  // 中身と合計（グリッドのときは空いた右側に）
  if (arrived.every(Boolean)) {
    const c8 = job.contents;
    const sum = `gltf + bin + 画像${c8.images}`;
    if (!F.listMode) {
      const x0 = right(F.root[1]) + gap * 1.2, w = right(F.inner) - x0;
      if (w > f.tiny * 4) {
        drawText(c, sum, x0, midY(F.root[0]), {size: f.tiny, weight: 700, color: pal.ink, max: w, min: 6});
        drawText(c, fmtMiB(job.total), x0, midY(F.root[0]) + f.tiny * 1.35, {size: f.tiny, color: pal.green, weight: 700, max: w, min: 6});
      }
    } else {
      drawText(c, `${sum}・${fmtBytes(job.total)}`, right(F.inner), midY(F.texLabel), {size: f.tiny, weight: 700, color: pal.green, align: 'right', max: F.inner.w * 0.62, min: 7});
    }
  }
  if (p.bundle > 0) alpha(c, easeOut(p.bundle), () => chip(c, F.zip, 'ZIP', {fill: pal.copper, color: pal.onInk, size: Math.min(f.tiny, F.zip.h * 0.72)}));
}
function drawPreview(c, L, p, d, pal) {
  const r = L.n.preview, PV = L.preview, {f, gap, u} = L;
  const idle = p.endIdle > 0;
  box(c, r, pal, {fill: idle ? pal.faint : pal.sheet, stroke: idle ? pal.muted : pal.ink, lw: 1.4, radius: 4, dash: idle ? Math.max(3, u * 0.28) : 0});
  if (idle) {
    lines2(c, PV.img, '取得なし', '実物は A08 の記録', {size: f.small, sub: f.tiny, color: pal.muted, subColor: pal.muted, pad: gap});
  } else if (d.image && p.reveal > 0) {
    // 照合済みの静止画を、比率を保って収める（上から現れるだけで、回転などの加工はしない）
    const im = d.image, k = Math.min(PV.img.w / im.w, PV.img.h / im.h);
    const w = im.w * k, h = im.h * k, x = midX(PV.img) - w / 2, y = midY(PV.img) - h / 2;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h * ease(p.reveal));
    c.clip();
    c.drawImage(im.source, x, y, w, h);
    c.restore();
  } else {
    c.setLineDash([Math.max(2, u * 0.16), Math.max(2, u * 0.14)]);
    c.strokeStyle = pal.rule;
    c.lineWidth = 1;
    c.strokeRect(PV.img.x + 0.5, PV.img.y + 0.5, PV.img.w - 1, PV.img.h - 1);
    c.setLineDash([]);
  }
  // 出典（作者 / 配布元・ライセンス）
  const a = d.asset, cs = Math.min(f.tiny, PV.cred.h * 0.42);
  const credColor = idle ? pal.muted : pal.ink;
  drawText(c, a.author, PV.cred.x, PV.cred.y + PV.cred.h * 0.27, {size: cs, weight: 700, color: credColor, max: PV.cred.w, min: 6});
  drawText(c, `${a.provider}・${a.license.name}`, PV.cred.x, PV.cred.y + PV.cred.h * 0.75, {size: cs, color: idle ? pal.muted : pal.green, weight: 700, max: PV.cred.w, min: 6});
  if (!idle && p.bundle > 0) alpha(c, easeOut(p.bundle), () => chip(c, PV.chip, '実3D', {fill: pal.ink, color: pal.onInk, size: Math.min(f.tiny, PV.chip.h * 0.72)}));
}

// 動いている途中の写し（同じ形が線に沿って移り、分かれ、合流する）
function drawGhosts(c, L, p, d, pal) {
  const {n, e, u, f} = L;
  const dot = (pt, color, rad) => { c.beginPath(); c.arc(pt.x, pt.y, rad, 0, Math.PI * 2); c.fillStyle = color; c.fill(); };
  // 渡す：本と依頼の写しがAIへ入って一つになる
  if (p.give > 0 && p.give < 1) {
    const k = ease(p.give);
    const s = Math.min(n.book.w, n.book.h) * 0.36 * (1 - 0.55 * k);
    const a = pointAt([ctr(n.book), ...e.bookAi, ctr(n.ai)], k);
    rr(c, a.x - s * 0.62, a.y - s * 0.46, s * 1.24, s * 0.92, 2);
    c.fillStyle = pal.slate;
    c.fill();
    c.fillStyle = pal.sheet;
    c.fillRect(a.x - s * 0.52, a.y - s * 0.36, s * 1.04, s * 0.72);
    c.strokeStyle = pal.rule;
    c.beginPath();
    c.moveTo(a.x, a.y - s * 0.36);
    c.lineTo(a.x, a.y + s * 0.36);
    c.stroke();
    const b = pointAt([ctr(n.request), ...e.reqAi, ctr(n.ai)], k);
    const w = n.request.w * 0.45 * (1 - 0.55 * k), h = n.request.h * 0.6 * (1 - 0.55 * k);
    box(c, {x: b.x - w / 2, y: b.y - h / 2, w, h}, pal, {fill: pal.sheet, stroke: pal.ink, lw: 1.2, radius: 2});
  }
  // AIが書いた run.mjs の写しが、別の工程の制作担当へ渡る
  if (p.hand > 0 && p.hand < 1) {
    const k = ease(p.hand);
    const pt = pointAt([ctr(n.script), ...e.scriptOp, ctr(n.operator)], k);
    const w = n.script.w * (0.75 - 0.3 * k), h = n.script.h * (0.75 - 0.3 * k);
    fileShape(c, {x: pt.x - w / 2, y: pt.y - h / 2, w, h}, pal, {fill: pal.sheet, stroke: pal.slate, lw: 1.4});
  }
  // 実行：制作担当 → AssetService → 2つの配信元へ分かれる
  if (p.fork > 0 && p.fork < 1) {
    const rad = Math.max(3, u * 0.3);
    if (p.fork < 0.45) dot(pointAt([ctr(n.operator), ...e.opService], p.fork / 0.45), pal.copper, rad);
    else {
      const k = (p.fork - 0.45) / 0.55;
      if (!p.phIdle) dot(pointAt(e.servicePh, k), pal.copper, rad);
      dot(pointAt(e.serviceFab, k), pal.copper, rad);
    }
  }
  // Poly Haven から候補カードが届く
  if (!p.phIdle) {
    d.candidates.forEach((cand, i) => {
      const k = stagger(p.cards, i, 3, 0.4);
      if (k <= 0 || k >= 1) return;
      const slot = L.cardSlots[i], q = ease(k);
      const pt = pointAt([ctr(n.ph), ...e.phCands, ctr(slot)], q);
      const w = lerp(slot.w * 0.4, slot.w, q), h = lerp(slot.h * 0.4, slot.h, q);
      candCard(c, L, {x: pt.x - w / 2, y: pt.y - h / 2, w, h}, cand, pal, cand.chosen);
    });
  }
  // Fab からはリンクだけが届く
  if (p.fabLink > 0 && p.fabLink < 1) {
    const s = Math.min(L.fabRows.link.h * 0.7, f.small * 1.3);
    const pt = pointAt([ctr(n.fab), ...e.fabRes, [L.fabRows.link.x + s * 0.6, midY(L.fabRows.link)]], ease(p.fabLink));
    linkIcon(c, pt.x, pt.y, s, pal.copper);
  }
  // 選んだカードが5つのファイルに開き、通り道へ
  for (const which of ['1k', '8k']) {
    const one = which === '1k';
    if ((one ? p.lane1 : p.lane8) <= 0) continue;
    const K = one ? p.split1 : p.split8, job = one ? d.jobs.A08 : d.jobs.A04, S = L.lanes[which];
    const route = one ? e.cardsGate : e.side8k, start = L.cardSlots[0];
    job.files.forEach((file, i) => {
      const k = stagger(K, i, 5, 0.5);
      if (k <= 0 || k >= 1) return;
      const target = laneTile(S.slots[i], one), q = ease(k);
      const pt = pointAt([ctr(start), ...route, ctr(target)], q);
      const w = lerp(target.w * 0.5, target.w, q), h = lerp(target.h * 0.5, target.h, q);
      fileTile(c, {x: pt.x - w / 2, y: pt.y - h / 2, w, h}, pal, file, f);
    });
  }
  // 1k の5ファイルがゲートを抜け、相対パスのままフォルダーへ合流
  if (p.lane1 > 0 && !p.endIdle) {
    const files = d.jobs.A08.files;
    files.forEach((file, i) => {
      const k = stagger(p.pass1, i, 5, 0.5);
      if (k <= 0 || k >= 1) return;
      const from = laneTile(L.lanes['1k'].slots[i], true), to = folderSlot(L, files, i), q = ease(k);
      const pt = pointAt([ctr(from), ...e.gateFolder, ctr(to)], q);
      const w = lerp(from.w, to.w, q), h = lerp(from.h, to.h, q);
      fileTile(c, {x: pt.x - w / 2, y: pt.y - h / 2, w, h}, pal, file, f);
    });
  }
}

// 選んだ記録で使わない部分を薄くする（形と線は残す）
function modeAlpha(k, p) {
  if (p.phIdle && (k === 'ph' || k === 'cands')) return 0.4;
  return 1;
}
function edgeMode(key, p) {
  if (p.phIdle && (key === 'servicePh' || key === 'phCands' || key === 'cardsGate' || key === 'side8k')) return 0.3;
  if (key === 'cardsGate') return 0.35 + 0.65 * p.lane1;
  if (key === 'side8k') return 0.35 + 0.65 * p.lane8;
  if ((key === 'gateFolder' || key === 'folderPreview') && p.endIdle) return 0.35;
  return 1;
}
function flowColor(kind, pal) {
  return kind === 'ai' ? pal.slate : kind === 'stop' ? pal.stop : pal.copper;
}

export function drawConcept(c, L, p, d, pal) {
  const {n, e, u} = L;
  const show = (k) => clamp01(val(p.show, k, 1));
  const A = (k) => show(k) * val(p.emph, k, 1) * modeAlpha(k, p);
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const key of ALL_EDGES) {
    const k = val(p.draw, key, 1);
    if (k <= 0.001) continue;
    const kind = EDGE_KIND[key];
    const dash = kind === 'dash' || kind === 'stop' || kind === 'link' ? Math.max(3, u * 0.3) : 0;
    alpha(c, val(p.emphEdge, EDGE_STAGE[key], 1) * edgeMode(key, p), () => {
      strokePath(c, e[key], k, {color: kind === 'dash' ? pal.muted : pal.ink, width: Math.max(1.6, u * 0.11), head: kind === 'dash' ? 0 : Math.max(6, u * 0.42), dash});
      const fl = Math.min(k, val(p.flow, key, 0));
      if (fl > 0 && kind !== 'dash') strokePath(c, e[key], fl, {color: flowColor(kind, pal), width: Math.max(3, u * 0.2), head: Math.max(7, u * 0.52), dash});
    });
  }
  alpha(c, A('book'), () => drawBook(c, L, p, pal));
  alpha(c, A('other'), () => drawOther(c, L, pal));
  alpha(c, A('request'), () => drawRequest(c, L, d, pal));
  alpha(c, A('ai'), () => drawAI(c, L, pal));
  alpha(c, A('script'), () => drawScript(c, L, p, pal));
  alpha(c, A('operator'), () => drawOperator(c, L, p, pal));
  alpha(c, A('service'), () => drawService(c, L, pal));
  alpha(c, A('ph'), () => drawProvider(c, L, n.ph, 'Poly Haven', 'API・直接取得', pal, false));
  alpha(c, A('fab'), () => drawProvider(c, L, n.fab, 'Fab', 'リンクだけ', pal, true));
  alpha(c, A('cands'), () => drawCands(c, L, p, d, pal));
  alpha(c, A('fabres'), () => drawFabRes(c, L, p, d, pal));
  alpha(c, A('gate'), () => drawGate(c, L, p, d, pal));
  alpha(c, A('folder'), () => drawFolder(c, L, p, d, pal));
  alpha(c, A('preview'), () => drawPreview(c, L, p, d, pal));
  drawGhosts(c, L, p, d, pal);
  if (p.focusPart && PART_NODES[p.focusPart]) for (const k of PART_NODES[p.focusPart]) focusBox(c, L, n[k], pal);
  c.restore();
}

// ---------- 文（ページと動画で共通） ----------
export function describeMap(d, id) {
  const c = d.candidates.map((x) => x.short).join('・');
  const head = `図の内容：左上の本は原典のMarkdownの手順書（SKILL.md と AGENTS.md）。上端の3つの見出し札は手順の${STEPS.join('・')}、右のページの5つの印は規則（${RULES.join('・')}）。`
    + '本の下に点線の札「他の入口 MCP / REST・未実行」。'
    + `依頼の札「木箱 / Web / CC0 / ${fmtMiB(d.budget.max)}」と本が「AI（Opus）読んで書く」に合流し、AIが書いた run.mjs が「制作担当・Nodeで1回実行」へ渡されます。`
    + '制作担当の実行から、原典の AssetService が Poly Haven（API・直接取得）と Fab（リンクだけ、点線）に分かれます。'
    + `A01 の記録では Poly Haven から候補${d.candidates.length}件（${c}）、Fab は検索URLだけで通信なし。選んだ ${d.candidates[0].short} に CC0 と glTF の札。`;
  const j = d.jobs[id];
  if (id === 'A08') {
    return `${head}A08：1k を選ぶと ${j.files.length}ファイル（gltf・bin・画像${j.contents.images}）。合計 ${fmtBytes(j.total)}（${fmtMiB(j.total)}）は予算 ${fmtBytes(j.max)}（${fmtMiB(j.max)}）以内で、ゲートを通り、`
      + `保存フォルダー ${j.folder}/ に相対パスのまま入ります（直下に gltf と bin、textures/ に画像3つ）。その先に実物の木箱の表示（${d.asset.author} / ${d.asset.provider} / ${d.asset.license.name}）、ZIP と実3Dの入口。`;
  }
  if (id === 'A04') {
    return `${head}A04：8k の${j.files.length}ファイル、合計 ${fmtBytes(j.total)}（${fmtMiB(j.total)}）は予算を超え、ゲートの脇道で止まります。`
      + `取得の通信は${j.requests}件、保存フォルダーは作られていません。1k への自動の切り替えも、8k の取得もありません。フォルダーと実物の表示は点線のまま。`;
  }
  return `${head}A07：Fab だけを直接取得できるものに絞った検索。Fab は ${j.provider.status}（「${j.provider.error}」は対象外の理由で、エラーではない）。`
    + `結果は0件、通信は${j.requests}件。Poly Haven はこの検索では指定していないため薄く表示。フォルダーと実物の表示は点線のまま。`;
}
export function stageNote(d, id, i) {
  const j = d.jobs[id];
  if (i === 0) {
    return '渡す：手順書（SKILL.md・AGENTS.md）と依頼を元のAI（Opus）が読み、run.mjs を書きました。それを別の工程で制作担当がNodeで1回実行し、原典のライブラリ関数を呼びました。AIがCLIやサーバーを動かしたのではありません。';
  }
  if (i === 1) {
    if (id === 'A08') return `選んで確かめる：AssetService が Poly Haven と Fab へ。候補から ${d.candidates[0].short}（CC0）を選び、glTF・1k で${j.files.length}ファイル、合計 ${fmtMiB(j.total)} を取得の前に予算 ${fmtMiB(j.max)} と比べました。`;
    if (id === 'A04') return `選んで確かめる：8k の合計は ${fmtMiB(j.total)}。downloadFiles が予算を超えると判断し、フォルダーを作る前・通信の前に例外で止まりました。`;
    return `選んで確かめる：Fab だけを直接取得に絞ると、Fab は直接取得に対応しないため ${j.provider.status}。通信はなく、結果は0件です（エラーではありません）。`;
  }
  if (id === 'A08') return `受け取る：${j.files.length}ファイルが相対パスを保って1つのフォルダーへ（通信${j.requests}件・計 ${fmtBytes(j.total)}）。「実3Dを回して見る」は、この5ファイルを照合して three.js で回せる以前の画面（desk.html）を開きます。`;
  if (id === 'A04') return `受け取る：この操作では何も受け取っていません（取得の通信${j.requests}件・保存フォルダーなし）。止まった実記録を開けます。`;
  return '受け取る：直接取得できる候補がないため、受け取るファイルはありません。Fab は検索URLを返すリンク型の配信元です（A01 の記録）。';
}
export function recordRows(d, id) {
  const j = d.jobs[id];
  const rows = [
    ['記録', `${j.path}（${fmtBytes(j.bytes)}）：元の実行の ${id} をそのまま包んだもの`],
    ['操作', `${j.recordLabel}（${j.operation}）`],
    ['入力', j.inputText],
    ['結果', j.resultText],
    ['通信', j.networkText],
  ];
  if (id !== 'A07') rows.push(['素材', d.asset.credit]);
  return rows;
}

// ---------- ページ ----------
const THEME_KEY = 'studio-yebisu.3d-asset-server-example.theme';
const SPEED = [2.6, 3.4, 2.4];
const tauToTime = (x) => { let t = 0; for (let i = 0; i < 3; i++) t += clamp01(x - i) * SPEED[i]; return t; };
const timeToTau = (t) => { let x = 0; for (let i = 0; i < 3; i++) { if (t <= SPEED[i]) return x + t / SPEED[i]; t -= SPEED[i]; x += 1; } return 3; };
const DESK_LABEL = Object.freeze({A08: '実3Dを回して見る', A04: '止まった実記録を開く', A07: 'skippedの実記録を開く'});

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
  // Original article sample links retain all8IDs; the5notinthisthree-presetdiagram open their unchanged real records.
  function routeOriginalRecord() {
    const id = location.hash.slice(1);
    if (!['A01', 'A02', 'A03', 'A05', 'A06'].includes(id)) return false;
    location.replace(new URL(`desk.html#${id}`, import.meta.url).href);
    return true;
  }
  if (routeOriginalRecord()) return;
  window.addEventListener('hashchange', routeOriginalRecord);
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const canvas = $('concept-map');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const statusEl = $('load-status'), retryBtn = $('retry');
  const deskA = $('open-desk'), recordA = $('save-record'), bundleA = $('save-bundle');
  const dynLinks = [deskA, recordA, bundleA];
  const dependents = () => document.querySelectorAll('button[data-stage], #replay, button[data-preset], button[data-part], #copy-request');
  const readouts = ['stage-note', 'map-desc', 'record-meta', 'record-content', 'record-path', 'part-label', 'part-meaning', 'part-quote',
    'part-source', 'part-local', 'copy-status', 'run-facts', 'bin-note'];

  let data = null;
  let caseId = JOB_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'A08';
  let stage = 2, tau = 0, raf = 0, part = null, loadGen = 0, controller = null;

  // 表示の色（このページだけの保存先。ほかの内容は保存しない）
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
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (!data) {
      const msg = root.dataset.state === 'error' ? '照合できなかったため、図を止めました' : '保存した記録と実ファイルを照合しています…';
      drawText(ctx, msg, W / 2, H / 2, {size: 15, color: pal.muted, align: 'center', max: W - 24});
      ctx.restore();
      return;
    }
    const L = conceptLayout(chooseKind(W, H), W, H);
    const p = storyParams(tau, caseId);
    p.focusPart = part;
    drawConcept(ctx, L, p, data, pal);
    ctx.restore();
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
  function setStage(i, replay) {
    stage = i;
    document.querySelectorAll('button[data-stage]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === i)));
    $('stage-note').textContent = data ? stageNote(data, caseId, stage) : '';
    const target = i + 1;
    animate(replay || target < tau ? i : tau, target);
  }
  document.querySelectorAll('button[data-stage]').forEach((b) => b.addEventListener('click', () => { if (data) setStage(Number(b.dataset.stage), false); }));
  $('replay').addEventListener('click', () => { if (data) setStage(stage, true); });

  // 3つの実記録：主な操作・保存リンク・読み出しを、選んだ記録にそろえる（どれも照合済みのパスだけ）
  function setLink(a, href, download) {
    a.setAttribute('href', href);
    if (download) a.setAttribute('download', download); else a.removeAttribute('download');
    a.removeAttribute('aria-disabled');
  }
  function clearLink(a) {
    a.removeAttribute('href');
    a.removeAttribute('download');
    a.setAttribute('aria-disabled', 'true');
  }
  function renderCase() {
    const job = data.jobs[caseId];
    document.querySelectorAll('button[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === caseId)));
    deskA.textContent = DESK_LABEL[caseId];
    setLink(deskA, job.desk);
    setLink(recordA, job.path, job.download);
    if (caseId === 'A08') {
      bundleA.hidden = false;
      setLink(bundleA, BUNDLE_ZIP, 'polyhaven-wooden_crate_01-1k-gltf.zip');
    } else {
      clearLink(bundleA);
      bundleA.hidden = true;
    }
    $('stage-note').textContent = stageNote(data, caseId, stage);
    $('map-desc').textContent = describeMap(data, caseId);
    $('record-meta').replaceChildren(...recordRows(data, caseId).map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v))));
    $('record-path').textContent = `（${job.path}）`;
    $('record-content').textContent = job.body;
    $('copy-status').textContent = '';
  }
  function selectCase(id, push) {
    if (!data || !JOB_IDS.includes(id)) return;
    caseId = id;
    if (push && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    renderCase();
    draw();
  }
  document.querySelectorAll('button[data-preset]').forEach((b) => b.addEventListener('click', () => selectCase(b.dataset.preset, true)));
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (data && JOB_IDS.includes(id) && id !== caseId) selectCase(id, false);
  });

  // 6つの部分
  function renderPart() {
    const x = data && part ? data.parts.find((y) => y.id === part) : null;
    $('part-label').textContent = x ? x.label : '';
    $('part-meaning').textContent = x ? x.meaning : '';
    $('part-quote').textContent = x ? x.quote : '';
    $('part-source').replaceChildren(...(x
      ? (x.lineUrl ? [h('a', {href: x.lineUrl, rel: 'noopener'}, `GitHub の固定版 ${x.upstream} の${x.line_start}行目`)] : ['原典ではなく、作例側の表示部（元のOpusが書いたコード）です。'])
      : []));
    $('part-local').replaceChildren(...(x ? [h('a', {href: x.source_path}, `同梱の ${x.source_path}`), `（${x.line_start}行目：${x.line}）`] : []));
  }
  document.querySelectorAll('button[data-part]').forEach((b) => b.addEventListener('click', () => {
    if (!data) return;
    part = part === b.dataset.part ? null : b.dataset.part;
    document.querySelectorAll('button[data-part]').forEach((y) => y.setAttribute('aria-pressed', String(y.dataset.part === part)));
    renderPart();
    draw();
  }));

  // 固定の記録：部分の名札・元の実行の数・bin の配信URLの注記
  function renderFixed() {
    document.querySelectorAll('button[data-part]').forEach((b) => {
      const x = data.parts.find((y) => y.id === b.dataset.part);
      if (x) b.textContent = x.label;
    });
    const r = data.run, c = data.counts;
    $('run-facts').replaceChildren(
      h('li', {}, `元の実行：制作担当が Node ${r.node} で run.mjs を1回実行し、原典の関数で${r.operations}操作。原典側の確認${r.checks}件はすべて合格。`),
      h('li', {}, `実際の通信は${r.requests}件（Poly Haven の API ${r.api}件・ファイル${r.files}件）。Fab への通信はありません。`),
      h('li', {}, `制作側の独立した照合${c.independent_checks}件と、保存した応答を使うオフラインの再生${c.offline_replay_checks}件（ライブAPIの再照会ではない）は、元の制作で行ったものです。`),
      h('li', {}, `このページは、その記録と実ファイル${ASSET_COUNT}件を照合して読むだけです。検索・取得・推論・Node・ビルド・再生のどれもやり直していません。`),
      ...(r.deps.length ? [h('li', {}, `原典が読み込む依存：${r.deps.join('・')}。`)] : []));
    const j = data.jobs.A08;
    $('bin-note').textContent = j.binUrl8k
      ? `1k の glTF が参照する wooden_crate_01.bin（${fmtBytes(j.binBytes)}）は、配信URLが 8k の階層にありますが、どの解像度でも共通の形のデータです。「1k」は選んだ画像の解像度を指します。`
      : `wooden_crate_01.bin は ${fmtBytes(j.binBytes)} です。`;
  }

  // 依頼文のコピー（失敗したら読み取り専用の欄を選んだ状態にして伝える）
  $('copy-request').addEventListener('click', async () => {
    if (!data) return;
    const ok = await copyText(data.request);
    if (!data) return;
    const out = $('copy-status'), area = $('request-text');
    if (ok) { out.textContent = 'request.txt の依頼文をコピーしました。貼り付け先で確かめてください。'; return; }
    out.textContent = 'コピーできませんでした。依頼文の欄を選んだ状態にしたので、端末の操作でコピーしてください。';
    area.closest('details')?.setAttribute('open', '');
    area.focus();
    area.select();
  });

  // 読み込みと失敗
  function setDependents(on) {
    dependents().forEach((el) => { el.disabled = !on; });
    if (!on) for (const a of dynLinks) clearLink(a);
    if (!on) { bundleA.hidden = false; deskA.textContent = DESK_LABEL.A08; }
  }
  function clearReadouts() {
    for (const id of readouts) $(id).replaceChildren();
    $('request-text').value = '';
    part = null;
    document.querySelectorAll('button[data-part], button[data-preset]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
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
    setStatus(`素材${ASSET_COUNT}件を照合しています…`, 'loading');
    try {
      const bundle = await loadValidatedAssets({
        signal: controller.signal,
        onProgress: (phase, done, total) => {
          if (gen !== loadGen || root.dataset.state !== 'loading') return;
          setStatus(phase === 'assets' ? `素材 ${done}/${total} を照合しています…` : '照合した静止画を読み込んでいます…', 'loading');
        },
      });
      if (gen !== loadGen) return;
      data = bundle;
      root.dataset.state = 'ready';
      setStatus(`素材${ASSET_COUNT}件の大きさとSHA-256、記録どうしの対応を照合しました。図は保存した実記録と実ファイルだけを読み、検索・取得・AIの実行はしていません。`, 'ready');
      setDependents(true);
      $('request-text').value = data.request;
      renderFixed();
      renderPart();
      renderCase();
      tau = 0;
      setStage(2, false);
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

if (typeof document !== 'undefined' && document.documentElement.dataset.page === 'asset-concept') {
  applyStoredTheme();
  initPage();
}
