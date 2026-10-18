/* yomiyasu 作例「推敲の指示書と、点検の道具」— 概念図ページと図解動画の共通部分
 * 19件の素材を、大きさ・SHA-256・中身の対応で照合してから図と読み出しを出す。
 * このページではAIもPythonも実行しない。図の文字は保存済みの記録から読み、紙に載せる言い回しは
 * 保存済みの変更（before / after）に含まれる部分文字列だけを使う。
 * ページの初期化は index.html（data-page="yomiyasu-concept"）でだけ行う。video/video.js は読み込みと描画だけを使う。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

export const CASE_ID = 'yomiyasu-before-after';
export const SOURCE_COMMIT = '60bf877acebc86651e0b67d70112a66245f87758';
export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = '36fe6daa11f75730ee31fdfe6ebd4ddb8a16c333ae66c311f3fa6c6c071afe6a';
export const ASSET_PATHS = Object.freeze([
  'concept/structure.json', 'inputs/original-jobs.json', 'samples.json', 'concept/checks.json',
  'outputs/release.json', 'outputs/operation.json', 'outputs/research.json', 'request.txt',
  'vendor/yomiyasu/SKILL.md', 'vendor/yomiyasu/references/domains/business.md',
  'vendor/yomiyasu/references/gemini-syntax.md', 'vendor/yomiyasu/references/slop-catalog.md',
  'vendor/yomiyasu/scripts/yomiyasu_lint.py', 'vendor/yomiyasu/scripts/yomiyasu_diff.py',
  'vendor/yomiyasu/scripts/markdown_visibility.py', 'vendor/yomiyasu/LICENSE',
  'vendor/yomiyasu/UNICODE-LICENSE.txt', 'vendor/yomiyasu/README.md', 'vendor/yomiyasu/UPSTREAM.json',
]);
export const ASSET_COUNT = ASSET_PATHS.length;
export const JOB_IDS = Object.freeze(['release', 'operation', 'research']);
export const OUTPUTS = Object.freeze({
  release: Object.freeze({path: 'outputs/release.json', bytes: 2773, sha256: 'e006e66f87b4ae53af5fbcd5ebbb9041964e7dc1a782f8f5f8748f5e0bea29b0'}),
  operation: Object.freeze({path: 'outputs/operation.json', bytes: 2402, sha256: '32b6a055faab420bf6cfab1ea65228022683fb5287904e9fec836c371d0288e4'}),
  research: Object.freeze({path: 'outputs/research.json', bytes: 2953, sha256: 'fa4ba5652f2aa896e23438e44adb7211a70e17141588364323b457c7ad6ec0d5'}),
});
export const UPSTREAM_SKILL_URL = `https://github.com/nanaism/yomiyasu/blob/${SOURCE_COMMIT}/skills/yomiyasu/SKILL.md`;
const PART_IDS = ['manual', 'context', 'rewrite', 'lint', 'diff', 'use'];
const PRINCIPLE_IDS = ['claim', 'weight', 'strength', 'function'];
const CHANGE_COUNTS = [3, 2, 3];
const CONDITION_COUNTS = [5, 4, 5];

// 紙に載せる言い回し。保存済みの変更 change 番目の before / after に含まれる部分文字列（読み込み時に確かめる）。
export const PHRASES = Object.freeze({
  release: [{b: '実装を実施しました', a: '実装しました', change: 0}, {b: '表示は行われません', a: '表示されません', change: 2}],
  operation: [{b: '反映が実現されます', a: '反映されます', change: 0}, {b: '再起動を実施する', a: '再起動する', change: 1}],
  research: [{b: '得られました', a: '得ました', change: 0}, {b: '検証が行われていません', a: '検証されていません', change: 2}],
});
// 動画で、読み比べの線に添える語句。原文と推敲後の両方にそのまま含まれる部分だけ。
const REREAD = Object.freeze({
  operation: [{fact: 'operation-2', text: '従来の設定が維持されます'}, {fact: 'operation-3', text: '画面上に残ります'}],
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
const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});
const isStr = (s) => typeof s === 'string' && s.length > 0;
const ids = (list) => (Array.isArray(list) ? list.map((x) => x && x.id) : []);
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
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
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const ror = (x, n) => (x >>> n) | (x << (32 - n));
// crypto.subtle が使えない環境（http で別の端末から開いた場合など）のための、同じ結果を返すSHA-256
function softSha256(bytes) {
  const n = bytes.length, total = ((n + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[n] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(n / 0x20000000));
  view.setUint32(total - 4, (n << 3) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      w[i] = (w[i - 16] + (ror(a, 7) ^ ror(a, 18) ^ (a >>> 3)) + w[i - 7] + (ror(b, 17) ^ ror(b, 19) ^ (b >>> 10))) | 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0;
      const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += k;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]);
  return hex(out);
}

export async function sha256Hex(bytes) {
  if (globalThis.crypto?.subtle) {
    try { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))); } catch { /* 下の実装で求める */ }
  }
  return softSha256(bytes);
}

function decodeText(bytes, path) {
  let body;
  try { body = new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch { fail(`${path} がUTF-8として読めません`); }
  return body.charCodeAt(0) === 0xfeff ? body.slice(1) : body;
}
function parseJson(path, body) {
  try { return JSON.parse(body); } catch { return fail(`${path} がJSONとして読めません`); }
}

function validateManifest(m) {
  check(m && m.format === 'studio-yebisu-assets/v1' && m.case_id === CASE_ID && m.source_commit === SOURCE_COMMIT, 'manifest の形式か固定版が違います');
  check(Array.isArray(m.files) && sameList(m.files.map((f) => f && f.path), ASSET_PATHS), `manifest の素材${ASSET_COUNT}件の一覧が違います`);
  for (const f of m.files) check(Number.isInteger(f.bytes) && f.bytes > 0 && /^[0-9a-f]{64}$/.test(f.sha256), `manifest の ${f.path} の記録が読めません`);
  for (const pin of Object.values(OUTPUTS)) {
    const e = m.files.find((f) => f.path === pin.path);
    check(e && e.bytes === pin.bytes && e.sha256 === pin.sha256, `manifest の ${pin.path} が固定値と違います`);
  }
}

// diff の保存済み出力から、種類ごとの候補の札を作る（文字列と件数だけ。推論や判定は足さない）
const DIFF_KEYS = {structure: '構造', spans: '範囲', bold: '太字', type_changes: '文の種類の印'};
function diffCards(diff) {
  const out = [];
  for (const m of diff.markers) out.push(`${m.kind} ${m.orig}→${m.rewrite}`);
  if (diff.endings.changes.length) out.push(`文末の分類 ${diff.endings.changes.length}文`);
  if (diff.new_words.length) out.push(`元にない語 ${diff.new_words.length}`);
  if (diff.lost_words.length) out.push(`消えた語 ${diff.lost_words.length}`);
  for (const [key, label] of Object.entries(DIFF_KEYS)) if (diff[key].length) out.push(`${label} ${diff[key].length}`);
  const logic = new Map();
  for (const item of diff.logic) logic.set(item.kind, (logic.get(item.kind) || 0) + 1);
  for (const [kind, count] of logic) out.push(`${kind} ${count}文`);
  return out;
}

function buildBundle(manifest, bytes) {
  const text = (p) => decodeText(bytes.get(p), p);
  const json = (p) => parseJson(p, text(p));
  const structure = json('concept/structure.json');
  const checks = json('concept/checks.json');
  const samples = json('samples.json');
  const jobsIn = json('inputs/original-jobs.json');
  const request = text('request.txt');
  const skillLines = text('vendor/yomiyasu/SKILL.md').split(/\r?\n/);

  check(structure && structure.format === 'yomiyasu-structure/v1' && structure.case_id === CASE_ID && structure.source_commit === SOURCE_COMMIT, 'concept/structure.json の形式か固定版が違います');
  check(sameList(ids(structure.jobs), JOB_IDS), 'concept/structure.json の3件のIDが違います');
  check(samples && samples.format === 'input-output' && samples.synthetic === true && sameList(ids(samples.samples), JOB_IDS), 'samples.json の3件が違います');
  check(jobsIn && jobsIn.synthetic === true && sameList(ids(jobsIn.samples), JOB_IDS), 'inputs/original-jobs.json の3件が違います');
  check(checks && checks.format === 'yomiyasu-checks/v1' && sameList(ids(checks.samples), JOB_IDS)
    && checks.meaning_or_quality_guarantee === false && checks.human_approval === false, 'concept/checks.json の記録が違います');
  const c = structure.counts || {};
  check(c.jobs === 3 && c.changes === 8 && c.quoted_conditions === 14 && c.original_lint_runs === 3 && c.original_diff_runs === 3, 'concept/structure.json の件数が違います');
  const g = structure.guardrails || {};
  check(g.new_original_rewrite === false && g.new_lint_diff_execution === false && g.live_ai_in_browser === false
    && g.human_approval === false && g.semantic_equivalence_guarantee === false, 'concept/structure.json の範囲の記録が違います');

  const jobs = {};
  let changeTotal = 0, conditionTotal = 0;
  JOB_IDS.forEach((id, i) => {
    const s = structure.jobs[i], sample = samples.samples[i], src = jobsIn.samples[i], chk = checks.samples[i];
    check(isStr(s.input) && s.input === sample.input && s.input === src.input, `${id} の原文が保存先ごとに違います`);
    check(isStr(s.output) && s.output === sample.output, `${id} の推敲後が samples.json と違います`);
    check(isStr(s.context) && s.context === sample.context && s.context === src.context, `${id} の用途が保存先ごとに違います`);
    check(isStr(s.label) && s.label === sample.label && s.label === src.label, `${id} の名前が保存先ごとに違います`);
    check(Array.isArray(s.changes) && s.changes.length === CHANGE_COUNTS[i] && deepEqual(s.changes, sample.changes), `${id} の変更が${CHANGE_COUNTS[i]}件の保存記録と違います`);
    check(Array.isArray(s.preserved) && s.preserved.length === CONDITION_COUNTS[i] && deepEqual(s.preserved, sample.preserved), `${id} の残した条件が${CONDITION_COUNTS[i]}件の保存記録と違います`);
    check(sameList(s.preserved.map((x) => x.condition), src.must_preserve), `${id} の残す条件が入力と違います`);
    for (const ch of s.changes) check(isStr(ch.before) && isStr(ch.after) && isStr(ch.reason) && s.input.includes(ch.before) && s.output.includes(ch.after), `${id} の変更の引用が本文にありません`);
    for (const pr of s.preserved) check(isStr(pr.excerpt) && s.output.includes(pr.excerpt), `${id} の条件の引用が推敲後にありません`);
    check(Array.isArray(s.facts) && s.facts.length === s.preserved.length, `${id} の条件の対応が足りません`);
    s.facts.forEach((f, k) => check(f && f.id === `${id}-${k + 1}` && f.label === s.preserved[k].condition && isStr(f.source) && isStr(f.final)
      && s.input.includes(f.source) && s.output.includes(f.final), `${id} の条件${k + 1}の引用が原文か推敲後にありません`));
    const pin = OUTPUTS[id];
    check(s.output_file && s.output_file.path === pin.path && s.output_file.bytes === pin.bytes && s.output_file.sha256 === pin.sha256, `${id} の出力ファイルの記録が違います`);
    check(deepEqual(json(pin.path), sample), `${pin.path} の中身が samples.json の ${id} と違います`);
    check(chk.original_execution === true && chk.new_execution === false && chk.producer_executed_python === true && chk.stance === '説明', `${id} の点検の実行記録が違います`);
    const lint = chk.lint, diff = chk.diff;
    check(lint && Array.isArray(lint.findings) && diff && diff.endings && Array.isArray(diff.endings.changes)
      && ['markers', 'new_words', 'lost_words', 'structure', 'spans', 'logic', 'bold', 'type_changes'].every((k) => Array.isArray(diff[k])), `${id} の点検記録の形が違います`);
    for (const ph of PHRASES[id]) {
      const ch = s.changes[ph.change];
      check(ch && ch.before.includes(ph.b) && ch.after.includes(ph.a), `${id} の図の言い回しが保存済みの変更にありません`);
    }
    const reread = (REREAD[id] || []).map((r) => {
      const index = s.facts.findIndex((f) => f.id === r.fact);
      check(index >= 0 && s.input.includes(r.text) && s.output.includes(r.text) && s.facts[index].final.includes(r.text), `${id} の読み比べの語句が本文にありません`);
      return {index, text: r.text};
    });
    // diff が挙げた候補の補足（保存済みの文字列から言える範囲だけ。合わなければ出さない）
    const notes = [];
    const m0 = diff.markers[0];
    if (id === 'release' && m0 && m0.orig_hits.includes('れません') && s.input.includes('表示は行われません') && s.output.includes('表示されません')) {
      notes.push('「れません」は原文の「行われません」に含まれる文字列です。原文の「表示は行われません」も推敲後の「表示されません」も、否定のままです。');
    }
    if (diff.endings.changes.length) notes.push('文末の分類は、スクリプトが文末の形から見分けた候補です。');
    if (id === 'operation' && m0 && m0.orig_hits.includes('によって') && m0.rewrite_hits.includes('ただし') && s.changes[0].before.includes('ことによって') && s.changes[0].after.includes('押すと')) {
      notes.push('原文の「によって」は推敲後で「と」になり、「ただし」は残っています。');
    }
    if (!diff.markers.length && diff.logic.length) notes.push(`markers は空ですが、logic に${diff.logic.length}文が挙がっています。候補が0件という意味ではありません。`);
    const diffDetail = id === 'operation' && notes.some((n) => n.includes('によって')) ? ['「によって」→「と」', '「ただし」は残る'] : [];
    changeTotal += s.changes.length;
    conditionTotal += s.preserved.length;
    jobs[id] = {
      id, label: s.label, input: s.input, output: s.output, context: s.context, changes: s.changes, preserved: s.preserved,
      facts: s.facts, file: {...pin, url: assetUrl(pin.path), download: `yomiyasu-${id}.json`},
      lint, diff, cards: {lint: lint.findings.length ? [`候補${lint.findings.length}件`] : ['指摘なし', '候補0件'], diff: diffCards(diff)},
      notes, diffDetail, reread, phrases: PHRASES[id],
    };
  });
  check(changeTotal === 8 && conditionTotal === 14, '3件の変更8件・条件14件がそろいません');

  check(sameList(ids(structure.parts), PART_IDS), 'concept/structure.json の6つの部分が違います');
  check(sameList(ids(structure.principles), PRINCIPLE_IDS), 'concept/structure.json の4つの優先事項が違います');
  for (const x of [...structure.parts, ...structure.principles]) {
    check(isStr(x.label) && isStr(x.meaning) && isStr(x.quote) && x.source_path === 'vendor/yomiyasu/SKILL.md' && Number.isInteger(x.line_start)
      && x.line_start >= 1 && (skillLines[x.line_start - 1] || '').includes(x.quote), `${x.id} の引用が SKILL.md の${x.line_start}行目にありません`);
  }
  const domains = structure.domains;
  check(sameList(ids(domains), ['tech', 'business', 'essay']) && domains.every((dm) => isStr(dm.label) && dm.tested === (dm.id === 'business')), '参照資料の分野の記録が違います');
  const lineRef = (x) => ({...x, url: assetUrl(x.source_path), lineUrl: `${UPSTREAM_SKILL_URL}#L${x.line_start}`});
  return {
    manifest, request, jobs, domains,
    parts: structure.parts.map(lineRef), principles: structure.principles.map(lineRef),
    definition: structure.definition,
  };
}

// 19件をすべて取り直し、大きさとSHA-256、中身の対応を確かめた記録だけを返す。どれか一つでも違えば例外。
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

// ---------- 概念図（ページと図解動画で共通） ----------
// 本（SKILL.md・4つの優先事項）と参照資料、原文の紙・用途の封筒・残す条件の札 → 同じ1つのAI → 推敲後の紙
// → 別の工程のPython（lint は推敲後、diff は原文と推敲後）→ 候補の札 → 原文との読み比べ → 実際のJSON。

export const FONT = Object.freeze({
  sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, Meiryo, "Noto Sans JP", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", "Noto Serif JP", serif',
});
export const PALETTES = Object.freeze({
  light: Object.freeze({bg: '#f3eee2', sheet: '#fbf8f1', ink: '#1f1b16', muted: '#5d5548', rule: '#cfc4ae', brick: '#9a3a22', tint: 'rgba(154,58,34,0.11)', lane: '#e9e3d5', desk: '#2a241d', deskInk: '#fbf8f1', tool: '#f6f2e9'}),
  dark: Object.freeze({bg: '#171411', sheet: '#24201a', ink: '#efe7d6', muted: '#c4b8a3', rule: '#564c3e', brick: '#e58a66', tint: 'rgba(229,138,102,0.17)', lane: '#1f1b16', desk: '#e9e0cd', deskInk: '#1d1914', tool: '#2a251e'}),
});

const TALL = {
  nodes: {
    book: [0.02, 0.005, 0.54, 0.205], refs: [0.60, 0.005, 0.38, 0.205], pocket: [0.03, 0.21, 0.22, 0.028],
    paper: [0.05, 0.265, 0.20, 0.09], packet: [0.33, 0.265, 0.25, 0.09], pins: [0.62, 0.265, 0.34, 0.09],
    ai: [0.05, 0.40, 0.61, 0.115], after: [0.72, 0.40, 0.25, 0.115],
    lane: [0.01, 0.56, 0.98, 0.255], diff: [0.05, 0.62, 0.40, 0.075], lint: [0.55, 0.62, 0.40, 0.075],
    diffCard: [0.05, 0.715, 0.40, 0.08], lintCard: [0.55, 0.715, 0.40, 0.08],
    compare: [0.05, 0.855, 0.55, 0.14], json: [0.70, 0.865, 0.27, 0.12],
  },
  edges: {
    skill: [[0.79, 0.21], [0.79, 0.235], [0.29, 0.235], [0.29, 0.40]],
    skillStub: [[0.29, 0.21], [0.29, 0.235]],
    paperIn: [[0.15, 0.355], [0.15, 0.40]],
    packetIn: [[0.455, 0.355], [0.455, 0.40]],
    pinsIn: [[0.70, 0.355], [0.62, 0.40]],
    out: [[0.66, 0.4575], [0.72, 0.4575]],
    forkLint: [[0.80, 0.515], [0.80, 0.62]],
    forkDiff: [[0.80, 0.515], [0.80, 0.54], [0.38, 0.54], [0.38, 0.62]],
    origDiff: [[0.05, 0.31], [0.02, 0.31], [0.02, 0.6575], [0.05, 0.6575]],
    diffCard: [[0.25, 0.695], [0.25, 0.715]],
    lintCard: [[0.75, 0.695], [0.75, 0.715]],
    diffUse: [[0.25, 0.795], [0.25, 0.855]],
    lintUse: [[0.62, 0.795], [0.56, 0.855]],
    json: [[0.60, 0.925], [0.70, 0.925]],
  },
  dots: [[0.29, 0.235], [0.80, 0.54]],
};
const WIDE = {
  nodes: {
    book: [0.01, 0.04, 0.20, 0.44], refs: [0.23, 0.04, 0.14, 0.44], pocket: [0.02, 0.48, 0.12, 0.05],
    pins: [0.40, 0.04, 0.13, 0.12], packet: [0.40, 0.19, 0.13, 0.12], paper: [0.40, 0.34, 0.13, 0.14],
    ai: [0.57, 0.06, 0.19, 0.38], after: [0.80, 0.08, 0.18, 0.34],
    lane: [0.29, 0.56, 0.43, 0.42], diff: [0.31, 0.65, 0.18, 0.11], lint: [0.52, 0.65, 0.18, 0.11],
    diffCard: [0.31, 0.80, 0.18, 0.13], lintCard: [0.52, 0.80, 0.18, 0.13],
    compare: [0.75, 0.58, 0.14, 0.36], json: [0.905, 0.62, 0.085, 0.28], pyNote: [0.01, 0.62, 0.26, 0.28],
  },
  edges: {
    skill: [[0.11, 0.04], [0.11, 0.015], [0.665, 0.015], [0.665, 0.06]],
    skillStub: [[0.30, 0.04], [0.30, 0.015]],
    pinsIn: [[0.53, 0.10], [0.57, 0.10]],
    packetIn: [[0.53, 0.25], [0.57, 0.25]],
    paperIn: [[0.53, 0.41], [0.57, 0.41]],
    out: [[0.76, 0.25], [0.80, 0.25]],
    forkLint: [[0.89, 0.42], [0.89, 0.51], [0.61, 0.51], [0.61, 0.65]],
    forkDiff: [[0.89, 0.42], [0.89, 0.51], [0.44, 0.51], [0.44, 0.65]],
    origDiff: [[0.42, 0.48], [0.42, 0.585], [0.36, 0.585], [0.36, 0.65]],
    diffCard: [[0.40, 0.76], [0.40, 0.80]],
    lintCard: [[0.61, 0.76], [0.61, 0.80]],
    lintUse: [[0.70, 0.865], [0.75, 0.865]],
    diffUse: [[0.40, 0.93], [0.40, 0.965], [0.79, 0.965], [0.79, 0.94]],
    json: [[0.89, 0.76], [0.905, 0.76]],
    bundle: [[0.07, 0.53], [0.07, 0.62]],
  },
  dots: [[0.30, 0.015], [0.61, 0.51]],
};
const EDGE_GROUP = {skill: 'in', skillStub: 'in', paperIn: 'in', packetIn: 'in', pinsIn: 'in', out: 'out', forkLint: 'fork', forkDiff: 'fork', origDiff: 'fork', diffCard: 'cards', lintCard: 'cards', diffUse: 'use', lintUse: 'use', json: 'use', bundle: 'bundle'};
export const IN_EDGES = Object.freeze(['skill', 'skillStub', 'paperIn', 'packetIn', 'pinsIn']);
export const ALL_EDGES = Object.freeze(Object.keys(EDGE_GROUP));
// 「6つの部分」を選んだときに枠を付ける場所
export const PART_NODES = Object.freeze({manual: ['book'], context: ['refs'], rewrite: ['ai', 'after'], lint: ['lint', 'lintCard'], diff: ['diff', 'diffCard'], use: ['compare', 'json']});

export function chooseKind(W, H) { return W >= 640 && W / H >= 1.45 ? 'wide' : 'tall'; }

export function conceptLayout(kind, W, H) {
  const spec = kind === 'wide' ? WIDE : TALL;
  const n = {};
  for (const [k, [x, y, w, h]] of Object.entries(spec.nodes)) n[k] = {x: x * W, y: y * H, w: w * W, h: h * H};
  const e = {};
  for (const [k, pts] of Object.entries(spec.edges)) e[k] = pts.map(([x, y]) => [x * W, y * H]);
  const dots = spec.dots.map(([x, y]) => [x * W, y * H]);
  const u = kind === 'wide' ? Math.min(W / 70, H / 31) : Math.min(W / 25, H / 40);
  const ai = n.ai;
  n.aiSpot = kind === 'wide'
    ? {x: ai.x + u * 0.5, y: ai.y + ai.h * 0.36, w: ai.w - u, h: ai.h * 0.64 - u * 0.5}
    : {x: ai.x + ai.w * 0.36, y: ai.y + u * 0.35, w: ai.w * 0.64 - u * 0.35, h: ai.h - u * 0.7};
  const f = {label: u * 0.95, small: Math.max(10, u * 0.76), big: u * 1.6};
  return {kind, W, H, u, n, e, dots, f};
}

// どの段階でも全体の構造は描く。動くのは紙・札・写し・色の線だけ。
export function restParams() {
  return {
    show: {}, emph: {}, emphEdge: {}, draw: {}, flow: {}, tok: {lint: 0, diffA: 0, diffO: 0},
    s: 2, edit: 1, pinsAttach: 1, cards: 0, reread: 1, json: 0, bookOpen: 1, toolsOut: 1,
    bizGlow: 0, pinGlow: 0, cardDetail: 0, diffFirstOnly: false, rereadGlow: 0, focusPart: null, focusPrinciple: null,
  };
}

// ページの段階：τ=1 渡す、τ=2 推敲、τ=3 点検。τの途中は動きの途中。
const STAGE_NODES = {
  book: [1, 0, 0], refs: [1, 0, 0], pocket: [1, 0, 1], paper: [1, 0, 1], packet: [1, 1, 0], pins: [1, 1, 0], ai: [1, 1, 0], after: [0, 1, 1],
  lane: [0, 0, 1], lint: [0, 0, 1], diff: [0, 0, 1], lintCard: [0, 0, 1], diffCard: [0, 0, 1], compare: [0, 0, 1], json: [0, 0, 1],
};
const STAGE_EDGES = {in: [1, 0, 0], out: [0, 1, 1], fork: [0, 0, 1], cards: [0, 0, 1], use: [0, 0, 1], bundle: [0, 0, 1]};
export function storyParams(tau) {
  const p = restParams();
  p.s = ease(prog(tau, 0.25, 0.95)) + ease(prog(tau, 2.0, 2.4));
  p.pinsAttach = ease(prog(tau, 0.4, 1.0));
  p.edit = prog(tau, 1.1, 1.9);
  p.pinGlow = span(tau, 1.1, 1.3, 2.0, 2.2);
  const inFlow = prog(tau, 0.05, 0.6) * (1 - prog(tau, 1.05, 1.4));
  for (const k of IN_EDGES) p.flow[k] = inFlow;
  p.flow.out = prog(tau, 2.0, 2.3);
  p.flow.forkLint = prog(tau, 2.3, 2.55);
  p.flow.forkDiff = prog(tau, 2.3, 2.6);
  p.flow.origDiff = prog(tau, 2.32, 2.62);
  p.tok.lint = prog(tau, 2.3, 2.58);
  p.tok.diffA = prog(tau, 2.3, 2.62);
  p.tok.diffO = prog(tau, 2.32, 2.64);
  p.flow.lintCard = p.flow.diffCard = prog(tau, 2.6, 2.7);
  p.cards = easeOut(prog(tau, 2.62, 2.8));
  p.flow.lintUse = p.flow.diffUse = prog(tau, 2.75, 2.88);
  p.reread = prog(tau, 2.78, 2.95);
  p.flow.json = prog(tau, 2.88, 2.97);
  p.json = easeOut(prog(tau, 2.9, 3.0));
  const w = [tau <= 1 ? 1 : clamp01(2 - tau), clamp01(1 - Math.abs(tau - 2)), clamp01(tau - 2)];
  const weight = (m) => Math.max(m[0] * w[0], m[1] * w[1], m[2] * w[2]);
  for (const [k, m] of Object.entries(STAGE_NODES)) p.emph[k] = 0.72 + 0.28 * weight(m);
  for (const [k, m] of Object.entries(STAGE_EDGES)) p.emphEdge[k] = 0.72 + 0.28 * weight(m);
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
// 幅 max に収まるまで文字を小さくして描く。描いた幅を返す。
export function drawText(c, s, x, y, o = {}) {
  const weight = o.weight || 400, family = o.family || FONT.sans;
  let size = o.size || 14;
  const min = Math.min(size, o.min || 9);
  c.font = `${weight} ${size}px ${family}`;
  let w = c.measureText(s).width;
  if (o.max > 0) {
    while (w > o.max && size > min) {
      size = Math.max(min, size - 0.5);
      c.font = `${weight} ${size}px ${family}`;
      w = c.measureText(s).width;
    }
  }
  c.fillStyle = o.color || '#000';
  c.textAlign = o.align || 'left';
  c.textBaseline = o.base || 'middle';
  c.fillText(s, x, y);
  return w;
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
function pointOn(pts, k) {
  const {list, total} = segments(pts);
  let d = clamp01(k) * total;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (d <= s.len || i === list.length - 1) {
      const q = s.len ? Math.min(1, d / s.len) : 0;
      return {x: s.x0 + (s.x1 - s.x0) * q, y: s.y0 + (s.y1 - s.y0) * q};
    }
    d -= s.len;
  }
  return {x: pts[0][0], y: pts[0][1]};
}
function strokePath(c, pts, k, o) {
  if (k <= 0.001) return;
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

function paperShape(c, r, pal, u, o = {}) {
  const fold = Math.min(u * 0.7, r.w * 0.22, r.h * 0.3);
  c.beginPath();
  c.moveTo(r.x, r.y);
  c.lineTo(r.x + r.w - fold, r.y);
  c.lineTo(r.x + r.w, r.y + fold);
  c.lineTo(r.x + r.w, r.y + r.h);
  c.lineTo(r.x, r.y + r.h);
  c.closePath();
  c.fillStyle = o.fill || pal.sheet;
  c.fill();
  c.setLineDash(o.dashed ? [u * 0.3, u * 0.22] : []);
  c.strokeStyle = o.stroke || pal.ink;
  c.lineWidth = o.lw || 1.2;
  c.stroke();
  c.setLineDash([]);
  c.beginPath();
  c.moveTo(r.x + r.w - fold, r.y);
  c.lineTo(r.x + r.w - fold, r.y + fold);
  c.lineTo(r.x + r.w, r.y + fold);
  c.stroke();
}
function ruledLines(c, r, top, pal, u, color, underline) {
  const widths = [0.82, 0.66, 0.74, 0.5];
  let i = 0;
  for (let y = top; y < r.y + r.h - u * 0.3 && i < widths.length; y += u * 0.55, i++) {
    c.beginPath();
    c.moveTo(r.x + u * 0.4, y);
    c.lineTo(r.x + u * 0.4 + (r.w - u * 0.8) * widths[i], y);
    c.strokeStyle = underline && i === 0 ? pal.brick : color;
    c.lineWidth = underline && i === 0 ? 2 : 1;
    c.stroke();
  }
}
function pinHead(c, x, y, rad, pal, glow) {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y + rad * 2.2);
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.2;
  c.stroke();
  if (glow > 0) alpha(c, glow, () => { c.beginPath(); c.arc(x, y, rad * 2, 0, Math.PI * 2); c.fillStyle = pal.tint; c.fill(); });
  c.beginPath();
  c.arc(x, y, rad, 0, Math.PI * 2);
  c.fillStyle = pal.brick;
  c.fill();
}
function pinsNodePoints(r, count, u) {
  const y = r.y + r.h * 0.66, x0 = r.x + u * 0.7, x1 = r.x + r.w - u * 0.7;
  return Array.from({length: count}, (_, i) => ({x: count > 1 ? lerp(x0, x1, i / (count - 1)) : (x0 + x1) / 2, y}));
}
function sheetPinPoints(r, count) {
  return Array.from({length: count}, (_, i) => ({x: r.x + r.w * (count > 1 ? 0.18 + (0.6 * i) / (count - 1) : 0.5), y: r.y}));
}

function drawBook(c, L, p, d, pal) {
  const {u, f} = L, r = L.n.book;
  const headH = f.label * 1.7;
  rr(c, r.x, r.y, r.w, headH, u * 0.25);
  c.fillStyle = pal.ink;
  c.fill();
  drawText(c, 'SKILL.md', r.x + u * 0.5, r.y + headH / 2, {size: f.label, weight: 700, color: pal.bg, max: r.w * 0.5});
  drawText(c, 'yomiyasu', r.x + r.w - u * 0.5, r.y + headH / 2, {size: f.small, color: pal.bg, align: 'right', max: r.w * 0.38});
  const top = r.y + headH + u * 0.3, bot = r.y + r.h;
  const cx = r.x + r.w / 2, half = (r.w / 2) * (0.62 + 0.38 * clamp01(p.bookOpen));
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx, top + u * 0.25);
    c.quadraticCurveTo(cx + side * half * 0.5, top - u * 0.12, cx + side * half, top + u * 0.05);
    c.lineTo(cx + side * half, bot);
    c.quadraticCurveTo(cx + side * half * 0.5, bot - u * 0.3, cx, bot - u * 0.05);
    c.closePath();
    c.fillStyle = pal.sheet;
    c.fill();
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.2;
    c.stroke();
  }
  const bandH = f.small * 1.7;
  const area = bot - top - bandH - u * 1.1;
  const slipH = Math.min(f.label * 1.9, (area - u * 0.3) / 2);
  d.principles.forEach((pr, i) => {
    const side = i < 2 ? -1 : 1, row = i % 2;
    const x = side < 0 ? cx - half + u * 0.35 : cx + u * 0.3;
    const w = half - u * 0.65;
    const y = top + u * 0.5 + row * (slipH + u * 0.3);
    const on = p.focusPrinciple === pr.id;
    c.fillStyle = on ? pal.brick : pal.tint;
    c.fillRect(x, y, w, slipH);
    c.fillStyle = pal.brick;
    c.fillRect(x, y, Math.max(2, u * 0.18), slipH);
    drawText(c, pr.label, x + u * 0.45, y + slipH / 2, {size: f.label * 0.92, weight: 700, color: on ? pal.sheet : pal.ink, max: w - u * 0.6});
  });
  const by = bot - bandH - u * 0.4, bx = cx - half + u * 0.35, bw = 2 * half - u * 0.7;
  c.strokeStyle = pal.brick;
  c.lineWidth = 1.4;
  c.strokeRect(bx, by, bw, bandH);
  drawText(c, '勝手に足さない', bx + bw / 2, by + bandH / 2, {size: f.small, weight: 700, color: pal.brick, align: 'center', max: bw - u * 0.6});
}

// 本に付いた袋：Pythonの道具2つは同じスキルに同梱されている。道具が出たあとに文字が見える。
function drawPocket(c, L, p, pal) {
  const {u, f} = L, r = L.n.pocket;
  rr(c, r.x, r.y, r.w, r.h, u * 0.15);
  c.fillStyle = pal.tool;
  c.fill();
  c.strokeStyle = pal.ink;
  c.lineWidth = 1;
  c.stroke();
  alpha(c, clamp01(p.toolsOut * 1.6 - 0.6), () => drawText(c, '同梱 Python 2つ', r.x + u * 0.35, r.y + r.h / 2, {size: f.small * 0.95, weight: 700, color: pal.ink, max: r.w - u * 0.5, min: 8}));
}

function drawRefs(c, L, p, d, pal) {
  const {u, f} = L, r = L.n.refs;
  drawText(c, '参照資料', r.x + u * 0.3, r.y + f.label * 0.85, {size: f.label, weight: 700, color: pal.ink, max: r.w - u * 0.6});
  const top = r.y + f.label * 1.75, gap = u * 0.3;
  const rowH = (r.y + r.h - top - gap * 2) / 3;
  const x = r.x + u * 0.2, w = r.w - u * 0.4;
  const dom = Object.fromEntries(d.domains.map((x0) => [x0.id, x0]));
  // 今回使った業務文書
  rr(c, x, top, w, rowH, u * 0.15);
  c.fillStyle = pal.sheet;
  c.fill();
  if (p.bizGlow > 0) alpha(c, p.bizGlow, () => { c.fillStyle = pal.tint; c.fill(); });
  c.strokeStyle = pal.brick;
  c.lineWidth = 1.6 + p.bizGlow;
  c.stroke();
  const chip = drawChipWidth(c, '今回', f.small);
  drawText(c, dom.business.label, x + u * 0.35, top + rowH / 2, {size: f.label * 0.92, weight: 700, color: pal.ink, max: w - chip - u * 0.9});
  rr(c, x + w - chip - u * 0.25, top + rowH * 0.2, chip, rowH * 0.6, u * 0.12);
  c.fillStyle = pal.brick;
  c.fill();
  drawText(c, '今回', x + w - chip / 2 - u * 0.25, top + rowH / 2, {size: f.small * 0.9, weight: 700, color: pal.sheet, align: 'center', max: chip});
  // 使っていない分野
  const y2 = top + rowH + gap, half = (w - u * 0.25) / 2;
  [dom.tech, dom.essay].forEach((dm, i) => {
    const xx = x + i * (half + u * 0.25);
    rr(c, xx, y2, half, rowH, u * 0.15);
    c.setLineDash([u * 0.25, u * 0.2]);
    c.strokeStyle = pal.muted;
    c.lineWidth = 1;
    c.stroke();
    c.setLineDash([]);
    drawText(c, dm.label, xx + half / 2, y2 + rowH / 2, {size: f.small, color: pal.muted, align: 'center', max: half - u * 0.3});
  });
  // 構文と語彙の参照（2つ）
  const y3 = y2 + rowH + gap;
  for (const off of [u * 0.22, 0]) {
    rr(c, x + off, y3 - off * 0.6, w - u * 0.22, rowH, u * 0.15);
    c.fillStyle = pal.sheet;
    c.fill();
    c.strokeStyle = pal.ink;
    c.lineWidth = 1;
    c.stroke();
  }
  drawText(c, '構文・語彙', x + u * 0.35, y3 + rowH / 2, {size: f.label * 0.9, weight: 700, color: pal.ink, max: w - u * 0.9});
}
function drawChipWidth(c, s, size) {
  c.font = `700 ${size * 0.9}px ${FONT.sans}`;
  return c.measureText(s).width + size * 0.9;
}

function drawLabeledPaper(c, L, r, label, pal, o = {}) {
  const {u, f} = L;
  paperShape(c, r, pal, u, o);
  drawText(c, label, r.x + u * 0.35, r.y + Math.min(f.label * 0.95, r.h * 0.3), {size: f.label * 0.95, weight: 700, color: o.dashed ? pal.muted : pal.ink, max: r.w - u * 1.1});
  if (!o.dashed) ruledLines(c, r, r.y + f.label * 1.9, pal, u, pal.rule, o.underline);
}

function drawPacket(c, L, pal) {
  const {u, f} = L, r = L.n.packet;
  rr(c, r.x, r.y, r.w, r.h, u * 0.15);
  c.fillStyle = pal.sheet;
  c.fill();
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.2;
  c.stroke();
  c.beginPath();
  c.moveTo(r.x + u * 0.1, r.y + u * 0.1);
  c.lineTo(r.x + r.w / 2, r.y + r.h * 0.4);
  c.lineTo(r.x + r.w - u * 0.1, r.y + u * 0.1);
  c.strokeStyle = pal.muted;
  c.lineWidth = 1;
  c.stroke();
  drawText(c, '用途・読み手', r.x + r.w / 2, r.y + r.h * 0.72, {size: f.label * 0.95, weight: 700, color: pal.ink, align: 'center', max: r.w - u * 0.5});
}

function drawPins(c, L, job, p, pal) {
  const {u, f} = L, r = L.n.pins;
  rr(c, r.x, r.y, r.w, r.h, u * 0.15);
  c.fillStyle = pal.sheet;
  c.fill();
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.2;
  c.stroke();
  const count = job.preserved.length;
  const cw = drawText(c, String(count), r.x + r.w - u * 0.4, r.y + f.label * 0.95, {size: f.label, weight: 700, color: pal.brick, align: 'right'});
  drawText(c, '残す条件', r.x + u * 0.4, r.y + f.label * 0.95, {size: f.label * 0.95, weight: 700, color: pal.ink, max: r.w - cw - u * 1.2});
  // 札が紙へ移ったあとも、元の位置は薄く残す（どの条件を渡したかが分かるように）
  alpha(c, 1 - 0.6 * ease(clamp01(p.pinsAttach)), () => {
    for (const pt of pinsNodePoints(r, count, u)) pinHead(c, pt.x, pt.y - u * 0.2, u * 0.22, pal, 0);
  });
}

function drawDesk(c, L, pal) {
  const {u, f, kind} = L, r = L.n.ai;
  rr(c, r.x, r.y, r.w, r.h, u * 0.4);
  c.fillStyle = pal.desk;
  c.fill();
  if (kind === 'wide') {
    const aw = drawText(c, 'AI', r.x + u * 0.6, r.y + r.h * 0.17, {size: f.big, weight: 700, color: pal.deskInk});
    drawText(c, 'Opus 5.5・制作時', r.x + u * 0.9 + aw, r.y + r.h * 0.17, {size: f.small, color: pal.deskInk, max: r.w - aw - u * 1.4});
  } else {
    const cx = r.x + r.w * 0.18;
    drawText(c, 'AI', cx, r.y + r.h * 0.4, {size: f.big, weight: 700, color: pal.deskInk, align: 'center'});
    drawText(c, 'Opus 5.5・制作時', cx, r.y + r.h * 0.76, {size: f.small, color: pal.deskInk, align: 'center', max: r.w * 0.33, min: 8});
  }
  const s = L.n.aiSpot;
  alpha(c, 0.4, () => {
    c.setLineDash([u * 0.25, u * 0.2]);
    c.strokeStyle = pal.deskInk;
    c.lineWidth = 1;
    c.strokeRect(s.x, s.y, s.w, s.h);
    c.setLineDash([]);
  });
}

function drawLane(c, L, pal) {
  const {u, f, kind} = L, r = L.n.lane;
  rr(c, r.x, r.y, r.w, r.h, u * 0.5);
  c.fillStyle = pal.lane;
  c.fill();
  c.setLineDash([u * 0.35, u * 0.25]);
  c.strokeStyle = pal.muted;
  c.lineWidth = 1.2;
  c.stroke();
  c.setLineDash([]);
  if (kind === 'wide') {
    const nr = L.n.pyNote;
    drawText(c, '同梱のPython 2つ', nr.x + nr.w, nr.y + f.label, {size: f.label * 1.05, weight: 700, color: pal.ink, align: 'right', max: nr.w});
    drawText(c, '制作担当が別に実行', nr.x + nr.w, nr.y + f.label * 2.5, {size: f.small, color: pal.ink, align: 'right', max: nr.w});
    drawText(c, 'lint・diff 各1回・保存済み', nr.x + nr.w, nr.y + f.label * 3.7, {size: f.small, color: pal.muted, align: 'right', max: nr.w});
  } else {
    const x = r.x + L.W * 0.035, max = L.W * 0.33;
    drawText(c, 'Python', x, r.y + f.label * 0.95, {size: f.label, weight: 700, color: pal.ink, max});
    drawText(c, '制作担当が別に実行', x, r.y + f.label * 2.15, {size: f.small, color: pal.ink, max, min: 8});
  }
}

function drawTool(c, L, r, kind, pal) {
  const {u, f} = L;
  rr(c, r.x, r.y, r.w, r.h, u * 0.2);
  c.fillStyle = pal.tool;
  c.fill();
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.5;
  c.stroke();
  const ic = Math.min(r.h * 0.55, u * 1.3), ix = r.x + Math.min(u * 0.4, r.w * 0.08), iy = r.y + r.h / 2;
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.5;
  if (kind === 'lint') {
    c.beginPath();
    c.arc(ix + ic * 0.38, iy - ic * 0.08, ic * 0.3, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(ix + ic * 0.6, iy + ic * 0.15);
    c.lineTo(ix + ic * 0.9, iy + ic * 0.45);
    c.stroke();
  } else {
    c.strokeRect(ix, iy - ic * 0.45, ic * 0.5, ic * 0.7);
    c.fillStyle = pal.tool;
    c.fillRect(ix + ic * 0.35, iy - ic * 0.25, ic * 0.5, ic * 0.7);
    c.strokeRect(ix + ic * 0.35, iy - ic * 0.25, ic * 0.5, ic * 0.7);
  }
  if (r.h < u * 1.4) return;
  const tx = ix + ic + u * 0.3, maxW = r.x + r.w - u * 0.3 - tx;
  const nw = drawText(c, kind, tx, r.y + r.h * 0.33, {size: f.label, weight: 700, color: pal.ink, max: maxW * 0.5});
  if (kind === 'diff') drawText(c, '--stance=説明', tx + nw + u * 0.35, r.y + r.h * 0.33, {size: f.small * 0.95, color: pal.muted, max: maxW - nw - u * 0.35, min: 7.5});
  drawText(c, kind === 'lint' ? '推敲後を読む' : '原文と推敲後', tx, r.y + r.h * 0.72, {size: f.small, color: pal.ink, max: maxW, min: 8});
}

function drawCard(c, L, r, lines, pal, pop, detail) {
  const {u, f} = L;
  for (const i of [2, 1]) {
    rr(c, r.x + i * u * 0.16, r.y - i * u * 0.12, r.w, r.h, u * 0.15);
    c.fillStyle = pal.sheet;
    c.fill();
    c.strokeStyle = pal.rule;
    c.lineWidth = 1;
    c.stroke();
  }
  rr(c, r.x, r.y, r.w, r.h, u * 0.15);
  c.fillStyle = pal.sheet;
  c.fill();
  c.strokeStyle = pop > 0.01 ? pal.brick : pal.ink;
  c.lineWidth = 1.2 + 1.2 * pop;
  c.stroke();
  c.fillStyle = pal.brick;
  c.fillRect(r.x, r.y + u * 0.15, Math.max(2, u * 0.16), r.h - u * 0.3);
  const rows = [{text: '候補', tag: true}, ...lines.map((t) => ({text: t})), ...detail.lines.map((t) => ({text: t, detail: true}))];
  const rowH = (r.h - u * 0.3) / rows.length;
  rows.forEach((row, i) => {
    const y = r.y + u * 0.15 + rowH * (i + 0.5), x = r.x + u * 0.45, max = r.w - u * 0.7;
    const size = Math.min(row.tag ? f.small * 0.95 : f.label * 0.92, rowH * 0.86);
    const draw = () => drawText(c, row.text, x, y, {size, weight: row.tag || i === 1 ? 700 : 400, color: row.tag || row.detail ? pal.brick : pal.ink, max, min: 7.5});
    if (row.detail) alpha(c, detail.k, draw); else draw();
  });
}

function cardLines(job, kind, L) {
  if (kind === 'lint') return job.cards.lint;
  const list = job.cards.diff;
  const room = L.kind === 'tall' && L.u < 18 ? 1 : 2;
  if (list.length <= room) return list;
  return [...list.slice(0, room), `ほか${list.length - room}種類`];
}

function drawCompare(c, L, p, job, pal) {
  const {u, f} = L, r = L.n.compare;
  rr(c, r.x, r.y, r.w, r.h, u * 0.25);
  c.fillStyle = pal.sheet;
  c.fill();
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.2;
  c.stroke();
  const count = job.facts.length;
  const cw = drawText(c, `条件 ${count}`, r.x + r.w - u * 0.4, r.y + f.label * 0.95, {size: f.small, color: pal.muted, align: 'right'});
  drawText(c, '読み比べ', r.x + u * 0.4, r.y + f.label * 0.95, {size: f.label, weight: 700, color: pal.ink, max: r.w - cw - u * 1.2});
  const y0 = r.y + f.label * 1.9, y1 = r.y + r.h - u * 0.35;
  const pw = Math.min(r.w * 0.26, (y1 - y0) * 0.9);
  const left = {x: r.x + u * 0.35, y: y0, w: pw, h: y1 - y0};
  const right = {x: r.x + r.w - u * 0.35 - pw, y: y0, w: pw, h: y1 - y0};
  const mini = {...L, f: {...f, label: Math.min(f.small, pw / 3.2)}};
  drawLabeledPaper(c, mini, left, '原文', pal);
  drawLabeledPaper(c, mini, right, '推敲後', pal, {underline: true});
  const glow = new Map(job.reread.map((g) => [g.index, g.text]));
  for (let i = 0; i < count; i++) {
    const y = y0 + ((y1 - y0) * (i + 1)) / (count + 1);
    const k = prog(p.reread, i / (count + 1), (i + 2) / (count + 1));
    if (k <= 0) continue;
    const xa = left.x + left.w, xb = right.x;
    const lit = glow.has(i) ? p.rereadGlow : 0;
    c.beginPath();
    c.moveTo(xa, y);
    c.lineTo(lerp(xa, xb, k), y);
    c.strokeStyle = lit > 0.5 ? pal.brick : pal.ink;
    c.lineWidth = 1.2 + lit * 1.3;
    c.stroke();
    pinHead(c, xa, y - u * 0.18, u * 0.16, pal, 0);
    if (k >= 1) pinHead(c, xb, y - u * 0.18, u * 0.16, pal, 0);
    if (lit > 0) alpha(c, lit, () => drawText(c, glow.get(i), (xa + xb) / 2, y - u * 0.45, {size: f.small, weight: 700, color: pal.brick, align: 'center', max: xb - xa - u * 0.4, min: 8}));
  }
}

function drawJson(c, L, p, job, pal) {
  const {u, f} = L, r = L.n.json;
  paperShape(c, r, pal, u, {stroke: p.json > 0.01 ? pal.brick : pal.ink, lw: 1.3 + 1.6 * p.json});
  const name = job.file.path.split('/').pop();
  const lh = Math.min(f.label * 1.25, r.h / 3.4);
  const y = r.y + r.h / 2 - lh;
  drawText(c, '{ }', r.x + u * 0.4, y, {size: Math.min(f.label * 1.1, lh), weight: 700, color: pal.brick});
  drawText(c, name, r.x + u * 0.4, y + lh, {size: Math.min(f.label * 0.95, lh * 0.9), weight: 700, color: pal.ink, max: r.w - u * 0.7, min: 8});
  drawText(c, `${job.file.bytes.toLocaleString('en-US')} B`, r.x + u * 0.4, y + lh * 2, {size: Math.min(f.small, lh * 0.8), color: pal.muted, max: r.w - u * 0.7});
}

// 紙に載った言い回し：原文の語に線を引き、保存済みの推敲後の語を書く
function drawPhrase(c, L, r, job, edit, pal) {
  const {u, f} = L;
  const list = job.phrases;
  const e = Math.max(0, Math.min(list.length, edit));
  // Keep the completed phrase at an integer boundary until the next edit starts.
  const i = Math.min(list.length - 1, Math.max(0, Math.ceil(e) - 1));
  const k = e - i;
  const pair = list[i];
  const pad = u * 0.35, maxW = r.w - pad * 2;
  const size = Math.min(f.label * 1.05, r.h * 0.3);
  const y1 = r.y + r.h * 0.36, y2 = r.y + r.h * 0.74;
  alpha(c, i > 0 ? easeOut(prog(k, 0, 0.12)) : 1, () => {
    let wb = 0;
    alpha(c, 1 - 0.4 * prog(k, 0.45, 0.8), () => { wb = drawText(c, pair.b, r.x + pad, y1, {size, family: FONT.mincho, color: pal.ink, max: maxW, min: 8}); });
    const sk = ease(prog(k, 0.05, 0.45));
    if (sk > 0) {
      c.beginPath();
      c.moveTo(r.x + pad, y1);
      c.lineTo(r.x + pad + wb * sk, y1);
      c.strokeStyle = pal.brick;
      c.lineWidth = Math.max(1.6, u * 0.12);
      c.stroke();
    }
    alpha(c, easeOut(prog(k, 0.42, 0.85)), () => {
      const wa = drawText(c, pair.a, r.x + pad, y2, {size, weight: 700, family: FONT.mincho, color: pal.brick, max: maxW, min: 8});
      c.beginPath();
      c.moveTo(r.x + pad, y2 + size * 0.62);
      c.lineTo(r.x + pad + wa, y2 + size * 0.62);
      c.strokeStyle = pal.brick;
      c.lineWidth = 1.5;
      c.stroke();
    });
  });
}

// 原文から写した1枚の紙：原文の位置 → AIの作業台（s=1）→ 推敲後の位置（s=2）。条件の札は付いたまま。
function drawSheet(c, L, p, job, pal) {
  const {u, f, n} = L;
  const s = Math.max(0, Math.min(2, p.s));
  const r = s <= 1 ? lerpRect(n.paper, n.aiSpot, s) : lerpRect(n.aiSpot, n.after, s - 1);
  const w0 = clamp01(1 - s * 2), w1 = clamp01(1 - Math.abs(s - 1) * 2), w2 = clamp01((s - 1.5) * 2);
  paperShape(c, r, pal, u);
  if (w0 > 0) alpha(c, w0, () => {
    drawText(c, '原文', r.x + u * 0.35, r.y + Math.min(f.label * 0.95, r.h * 0.3), {size: f.label * 0.95, weight: 700, color: pal.ink, max: r.w - u});
    ruledLines(c, r, r.y + f.label * 1.9, pal, u, pal.rule, false);
  });
  if (w1 > 0) alpha(c, w1, () => drawPhrase(c, L, r, job, p.edit, pal));
  if (w2 > 0) alpha(c, w2, () => {
    drawText(c, '推敲後', r.x + u * 0.35, r.y + Math.min(f.label * 0.95, r.h * 0.3), {size: f.label * 0.95, weight: 700, color: pal.ink, max: r.w * 0.55});
    drawText(c, `変更${job.changes.length}`, r.x + r.w - u * 0.35, r.y + r.h - u * 0.55, {size: f.small, weight: 700, color: pal.brick, align: 'right', max: r.w * 0.5});
    ruledLines(c, {...r, h: r.h - u * 0.6}, r.y + f.label * 1.9, pal, u, pal.rule, true);
  });
  const count = job.preserved.length;
  if (p.pinsAttach > 0) {
    const from = pinsNodePoints(n.pins, count, u), to = sheetPinPoints(r, count);
    alpha(c, Math.min(1, p.pinsAttach * 3), () => {
      for (let i = 0; i < count; i++) {
        const k = ease(p.pinsAttach);
        pinHead(c, lerp(from[i].x, to[i].x, k), lerp(from[i].y - u * 0.2, to[i].y, k), u * 0.22, pal, p.pinGlow);
      }
    });
  }
}

function drawCopy(c, L, pts, k, pal, edited) {
  if (k <= 0.001 || k >= 0.999) return;
  const pt = pointOn(pts, k);
  const w = L.u * 1.4, h = L.u * 1.8;
  const r = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
  alpha(c, Math.min(1, k * 6, (1 - k) * 6), () => {
    paperShape(c, r, pal, L.u * 0.7, {stroke: edited ? pal.brick : pal.ink});
    ruledLines(c, r, r.y + h * 0.4, pal, L.u * 0.6, pal.rule, edited);
  });
}

function focusBox(c, L, r, pal) {
  const pad = L.u * 0.25;
  rr(c, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, L.u * 0.35);
  c.strokeStyle = pal.brick;
  c.lineWidth = 2.5;
  c.stroke();
}

const val = (o, k, dflt) => (o[k] === undefined ? dflt : o[k]);

export function drawConcept(c, L, p, d, pal, jobId) {
  const job = d.jobs[jobId];
  const {n, e, u} = L;
  const show = (k) => clamp01(val(p.show, k, 1));
  const nodeA = (k) => show(k) * val(p.emph, k, 1);
  c.save();
  c.lineCap = 'round';

  alpha(c, nodeA('lane'), () => drawLane(c, L, pal));
  // 線（構造）と、動きの間だけ濃くなる線
  for (const key of ALL_EDGES) {
    if (!e[key]) continue;
    const k = val(p.draw, key, 1);
    const group = EDGE_GROUP[key];
    const a = val(p.emphEdge, group, 1);
    const stub = key === 'skillStub' || key === 'bundle';
    alpha(c, a, () => strokePath(c, e[key], k, {color: key === 'bundle' ? pal.muted : pal.ink, width: Math.max(1.2, u * 0.09), head: stub ? 0 : u * 0.5, dash: key === 'bundle' ? [u * 0.18, u * 0.28] : null}));
    const fl = val(p.flow, key, 0);
    if (fl > 0 && !stub) strokePath(c, e[key], Math.min(k, fl), {color: pal.brick, width: Math.max(2.2, u * 0.17), head: u * 0.55});
    else if (fl > 0) strokePath(c, e[key], Math.min(k, fl), {color: pal.brick, width: Math.max(2.2, u * 0.17), head: 0});
  }
  alpha(c, val(p.emphEdge, 'fork', 1) * clamp01(val(p.draw, 'forkDiff', 1) * 4), () => {
    for (const [x, y] of L.dots.slice(1)) { c.beginPath(); c.arc(x, y, Math.max(2.5, u * 0.2), 0, Math.PI * 2); c.fillStyle = pal.ink; c.fill(); }
  });
  alpha(c, val(p.emphEdge, 'in', 1) * clamp01(val(p.draw, 'skill', 1) * 4), () => {
    const [x, y] = L.dots[0];
    c.beginPath(); c.arc(x, y, Math.max(2.5, u * 0.2), 0, Math.PI * 2); c.fillStyle = pal.ink; c.fill();
  });

  alpha(c, nodeA('book'), () => drawBook(c, L, p, d, pal));
  alpha(c, nodeA('pocket'), () => drawPocket(c, L, p, pal));
  alpha(c, nodeA('refs'), () => drawRefs(c, L, p, d, pal));
  alpha(c, nodeA('paper'), () => drawLabeledPaper(c, L, n.paper, '原文', pal));
  alpha(c, nodeA('packet'), () => drawPacket(c, L, pal));
  alpha(c, nodeA('pins'), () => drawPins(c, L, job, p, pal));
  alpha(c, nodeA('ai'), () => drawDesk(c, L, pal));
  alpha(c, nodeA('after'), () => drawLabeledPaper(c, L, n.after, '推敲後', pal, {dashed: true, fill: 'rgba(0,0,0,0)', stroke: pal.muted}));
  // lint と diff：最初は本の袋（同梱）にあり、別の工程の枠へ出る
  for (const kind of ['diff', 'lint']) {
    const pocket = n.pocket;
    const small = {x: pocket.x + (kind === 'diff' ? pocket.w * 0.52 : pocket.w * 0.04), y: pocket.y + pocket.h * 0.1, w: pocket.w * 0.44, h: pocket.h * 0.8};
    const r = lerpRect(small, n[kind], ease(clamp01(p.toolsOut)));
    alpha(c, nodeA(kind), () => drawTool(c, L, r, kind, pal));
  }
  // 動画では最初の候補と、その補足（保存済みの変更の語句）だけを大きく載せる
  const first = p.diffFirstOnly && job.diffDetail.length;
  alpha(c, nodeA('diffCard'), () => drawCard(c, L, n.diffCard, first ? job.cards.diff.slice(0, 1) : cardLines(job, 'diff', L), pal, p.cards, {lines: first ? job.diffDetail : [], k: p.cardDetail}));
  alpha(c, nodeA('lintCard'), () => drawCard(c, L, n.lintCard, cardLines(job, 'lint', L), pal, p.cards, {lines: [], k: 0}));
  alpha(c, nodeA('compare'), () => drawCompare(c, L, p, job, pal));
  alpha(c, nodeA('json'), () => drawJson(c, L, p, job, pal));

  // 推敲後の写しは lint と diff へ、原文の写しは diff へ
  drawCopy(c, L, e.forkLint, p.tok.lint, pal, true);
  drawCopy(c, L, e.forkDiff, p.tok.diffA, pal, true);
  drawCopy(c, L, e.origDiff, p.tok.diffO, pal, false);
  alpha(c, show('sheet') * Math.max(val(p.emph, 'ai', 1), val(p.emph, 'after', 1)), () => drawSheet(c, L, p, job, pal));

  if (p.focusPart && PART_NODES[p.focusPart]) for (const k of PART_NODES[p.focusPart]) focusBox(c, L, n[k], pal);
  if (p.focusPrinciple) focusBox(c, L, n.book, pal);
  c.restore();
}

// ---------- ページ ----------
const STAGES = Object.freeze([
  {name: '渡す', note: (j) => `SKILL.mdと業務文書の参照資料に、原文・用途と読み手・残す条件${j.preserved.length}つを合わせて、同じ1つのAIに渡します。例は「${j.label}」です。`},
  {name: '推敲', note: (j) => `AIが言い回しを直します（「${j.phrases[0].b}」→「${j.phrases[0].a}」）。残す条件は紙に付いたままです。表示するのは制作時の保存済みの出力です。`},
  {name: '点検', note: (j) => `制作担当が別にPythonを実行しました。lintは推敲後を、diffは原文と推敲後を読み、見直し候補を返します。原文と読み比べた保存済みの${j.file.path.split('/').pop()}を持ち帰れます。`},
]);
const THEME_KEY = 'studio-yebisu.yomiyasu-before-after.theme';

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

function initPage() {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const canvas = $('concept-map');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const statusEl = $('load-status'), retryBtn = $('retry');
  const saveLink = $('save-json'), deskLink = $('open-desk'), deskLink2 = $('case-desk'), rawLink = $('case-raw');
  const dependents = () => document.querySelectorAll('button[data-stage], #replay, button[data-case], button[data-part], button[data-principle], #copy-output, #copy-request');
  const readouts = ['save-meta', 'stage-note', 'case-title', 'case-context', 'case-input', 'change-list', 'condition-list', 'part-label', 'part-meaning', 'part-quote', 'part-source', 'principle-label', 'principle-meaning', 'principle-quote', 'principle-source', 'checks-body', 'output-status', 'request-status'];

  let data = null;
  let caseId = JOB_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'release';
  let stage = 0, tau = 1, raf = 0, part = null, principle = null, loadGen = 0, controller = null;

  // 表示の色
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (!data) return;
    const L = conceptLayout(chooseKind(W, H), W, H);
    const p = storyParams(tau);
    p.focusPart = part;
    p.focusPrinciple = principle;
    drawConcept(ctx, L, p, data, pal, caseId);
  }
  new ResizeObserver(() => draw()).observe(canvas);

  function stopAnim() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function animate(from, to) {
    stopAnim();
    if (reduce.matches || from === to) { tau = to; draw(); return; }
    const dur = Math.min(2000, Math.max(500, Math.abs(to - from) * 1100));
    const t0 = performance.now();
    const tick = (now) => {
      const k = clamp01((now - t0) / dur);
      tau = from + (to - from) * k;
      draw();
      raf = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    tau = from;
    raf = requestAnimationFrame(tick);
  }
  function setStage(i, replay) {
    stage = i;
    document.querySelectorAll('button[data-stage]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === i)));
    if (data) $('stage-note').textContent = STAGES[i].note(data.jobs[caseId]);
    const target = i + 1;
    animate(replay || target < tau ? i : tau, target);
  }
  document.querySelectorAll('button[data-stage]').forEach((b) => b.addEventListener('click', () => setStage(Number(b.dataset.stage), false)));
  $('replay').addEventListener('click', () => setStage(stage, true));

  // 3件
  function renderCase() {
    const job = data.jobs[caseId];
    document.querySelectorAll('button[data-case]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.case === caseId)));
    saveLink.href = job.file.url;
    saveLink.setAttribute('download', job.file.download);
    deskLink.href = deskLink2.href = `desk.html#${caseId}`;
    rawLink.href = job.file.url;
    rawLink.textContent = job.file.path;
    for (const a of [saveLink, deskLink, deskLink2, rawLink]) a.removeAttribute('aria-disabled');
    $('save-meta').textContent = `${job.file.path}・${job.file.bytes.toLocaleString('en-US')} B・SHA-256 ${job.file.sha256.slice(0, 12)}…（このページで照合）`;
    $('case-title').textContent = `${job.label}（${job.id}）`;
    $('case-context').textContent = job.context;
    $('case-input').textContent = job.input;
    $('output-text').value = job.output;
    $('output-status').textContent = '';
    $('change-list').replaceChildren(...job.changes.map((ch) => h('li', {},
      h('p', {class: 'pair'}, h('del', {}, ch.before), h('span', {class: 'arrow', 'aria-hidden': 'true'}, '→'), h('ins', {}, ch.after)),
      h('p', {class: 'reason'}, h('span', {class: 'tag'}, '保存された理由'), ch.reason))));
    $('condition-list').replaceChildren(...job.facts.map((fc) => h('li', {},
      h('p', {class: 'cond'}, fc.label),
      h('dl', {class: 'quote-pair'},
        h('div', {}, h('dt', {}, '原文'), h('dd', {}, fc.source)),
        h('div', {}, h('dt', {}, '推敲後'), h('dd', {}, fc.final))))));
    renderChecks(job);
    $('stage-note').textContent = STAGES[stage].note(job);
  }
  function renderChecks(job) {
    const d = job.diff;
    const items = [];
    for (const m of d.markers) items.push(`言い回しの印「${m.kind}」：原文 ${m.orig}（${m.orig_hits.join('・') || 'なし'}）→ 推敲後 ${m.rewrite}（${m.rewrite_hits.join('・') || 'なし'}）`);
    for (const ch of d.endings.changes) items.push(`文末の分類：「${ch.orig}」${ch.orig_kind} → 「${ch.rewrite}」${ch.rewrite_kind}`);
    if (d.new_words.length) items.push(`元にない語：${d.new_words.join('・')}`);
    if (d.lost_words.length) items.push(`消えた語：${d.lost_words.join('・')}`);
    for (const [key, label] of Object.entries(DIFF_KEYS)) if (d[key].length) items.push(`${label}：${d[key].length}件`);
    for (const lg of d.logic) items.push(`${lg.kind}：「${lg.sentence}」`);
    $('checks-body').replaceChildren(
      h('h3', {}, `lint（推敲後）`),
      h('p', {}, job.lint.findings.length ? `findings ${job.lint.findings.length}件` : 'findings は空です（指摘なし・候補0件）。', ` 文字数 ${job.lint.metrics?.char_count ?? '—'}。`),
      h('h3', {}, 'diff（原文と推敲後・--stance=説明）'),
      items.length ? h('ul', {class: 'plain'}, items.map((t) => h('li', {}, t))) : h('p', {}, '保存された候補はありません。'),
      job.notes.length ? h('div', {class: 'notes'}, h('p', {class: 'tag'}, '保存済みの文字列から言えること'), job.notes.map((t) => h('p', {}, t))) : null,
    );
  }
  document.querySelectorAll('button[data-case]').forEach((b) => b.addEventListener('click', () => {
    if (!data || !JOB_IDS.includes(b.dataset.case)) return;
    caseId = b.dataset.case;
    history.replaceState(null, '', `#${caseId}`);
    renderCase();
    draw();
  }));
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (data && JOB_IDS.includes(id) && id !== caseId) { caseId = id; renderCase(); draw(); }
  });

  // 6つの部分と4つの優先事項
  function renderRef(prefix, item) {
    $(`${prefix}-label`).textContent = item ? item.label : '';
    $(`${prefix}-meaning`).textContent = item ? item.meaning : '';
    $(`${prefix}-quote`).textContent = item ? item.quote : '';
    $(`${prefix}-source`).replaceChildren(...(item ? [
      h('a', {href: item.url}, `${item.source_path} の${item.line_start}行目`), '　',
      h('a', {href: item.lineUrl, rel: 'noopener'}, '固定版の該当行（GitHub）'),
    ] : []));
  }
  document.querySelectorAll('button[data-part]').forEach((b) => b.addEventListener('click', () => {
    if (!data) return;
    part = part === b.dataset.part ? null : b.dataset.part;
    document.querySelectorAll('button[data-part]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.part === part)));
    renderRef('part', data.parts.find((x) => x.id === part));
    draw();
  }));
  document.querySelectorAll('button[data-principle]').forEach((b) => b.addEventListener('click', () => {
    if (!data) return;
    principle = principle === b.dataset.principle ? null : b.dataset.principle;
    document.querySelectorAll('button[data-principle]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.principle === principle)));
    renderRef('principle', data.principles.find((x) => x.id === principle));
    draw();
  }));

  // コピー（失敗したら欄を選んだ状態にして伝える）
  async function copyFrom(area, text, statusId, done) {
    const out = $(statusId);
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch { ok = false; }
    if (!ok) { try { area.focus(); area.select(); ok = document.execCommand('copy'); } catch { ok = false; } }
    out.textContent = ok ? done : 'コピーできませんでした。欄の文字を選んだ状態にしたので、端末の操作でコピーしてください。';
    if (!ok) { area.focus(); area.select(); }
  }
  $('copy-output').addEventListener('click', () => { if (data) copyFrom($('output-text'), data.jobs[caseId].output, 'output-status', '保存済みの推敲後をコピーしました。'); });
  $('copy-request').addEventListener('click', () => { if (data) copyFrom($('request-text'), data.request, 'request-status', 'request.txt の依頼文をコピーしました。'); });

  // 読み込みと失敗
  function setDependents(on) {
    dependents().forEach((el) => { el.disabled = !on; });
    if (!on) for (const a of [saveLink, deskLink, deskLink2, rawLink]) { a.removeAttribute('href'); a.removeAttribute('download'); a.setAttribute('aria-disabled', 'true'); }
  }
  function clearReadouts() {
    for (const id of readouts) $(id).replaceChildren();
    $('output-text').value = '';
    $('request-text').value = '';
    rawLink.textContent = '出力ファイル';
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
      setStatus(`${ASSET_COUNT}件の素材を、大きさとSHA-256で照合しました。`, 'ready');
      setDependents(true);
      $('request-text').value = data.request;
      document.querySelectorAll('button[data-case]').forEach((b) => { const j = data.jobs[b.dataset.case]; if (j) b.querySelector('.case-label').textContent = j.label; });
      renderRef('part', data.parts.find((x) => x.id === part));
      renderRef('principle', data.principles.find((x) => x.id === principle));
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
      setStatus(`${why}。図と読み出しを止めました。ファイルを直接開いた場合は、ローカルのHTTPサーバー経由で開いてください。`, 'error');
      retryBtn.hidden = false;
    }
  }
  retryBtn.addEventListener('click', () => load());
  setTheme(theme(), false);
  load();
}

if (typeof document !== 'undefined' && document.documentElement.dataset.page === 'yomiyasu-concept') initPage();
