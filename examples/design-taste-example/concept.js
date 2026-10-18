/* Design Taste 作例「AIが画面を作る前に読む、デザインの指針」— 概念図ページと図解動画の共通部分
 * concept/manifest.json（SHA-256 を固定）にある23件を、大きさ・SHA-256・中身の対応で照合してから描く。
 * 照合した events.mjs のバイトをそのままモジュールとして読み、元の filterEvents を3つの条件で呼んで、
 * 保存した結果（results.json・samples.json・concept/records/*.json）と同じIDと順序になることを確かめる。
 * このページと映像は、AIもNodeも動かさない。予約・送信・アカウント・内容の保存もしない（localStorage は表示の色だけ）。
 * 図の中の動きは流れの説明で、元の制作の時間や内部の記録ではない。5冊は実行する道具ではなく、AIが読む文章として描く。
 * ページの初期化は index.html（data-page="design-taste-concept"）でだけ行う。video/video.js は読み込みと描画だけを使う。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

export const CASE_ID = 'design-taste-example';
export const REPO = 'madebymustafa/design-taste';
export const SOURCE_COMMIT = 'c4a6bff0871eb4b15371b0e7d2751628b0ed4608';
export const MANIFEST_PATH = 'concept/manifest.json';
export const MANIFEST_SHA256 = '006de7587719bdae045852e52788df46ace4458df4d040dde3941a275d6d345c';
const V = 'vendor/design-taste/';
const SKILLS = Object.freeze(['design-taste', 'japanese-minimal', 'taste-accessibility', 'taste-typography', 'taste-ux-copy']);
const skillPath = (s) => `${V}skills/${s}/SKILL.md`;
const P = Object.freeze({
  structure: 'concept/structure.json', events: 'events.json', module: 'events.mjs', samples: 'samples.json', results: 'results.json',
  plan: 'design-plan.md', input: 'input.md', request: 'request.txt', validation: 'validation.json',
  readme: `${V}README.md`, license: `${V}LICENSE`,
});
export const PRESET_IDS = Object.freeze(['all', 'children', 'reading']);
export const recordPath = (id) => `concept/records/${id}.json`;
// 元の制作で制作担当が撮った実画面（図には使わず、照合して一覧から開けるようにするだけ）
export const CAPTURES = Object.freeze({
  'assets/all.png': Object.freeze([1280, 900]), 'assets/children.png': Object.freeze([1280, 900]),
  'assets/participation.png': Object.freeze([1280, 900]), 'assets/mobile.png': Object.freeze([320, 1100]),
});
export const ASSET_PATHS = Object.freeze([
  P.structure, P.events, P.module, P.samples, P.results, P.plan, P.input, P.request, P.validation, P.readme, P.license,
  ...SKILLS.map(skillPath), ...PRESET_IDS.map(recordPath), ...Object.keys(CAPTURES),
]);
export const ASSET_COUNT = ASSET_PATHS.length;
// 親が元の results.json の presets をそのまま包んだ3件（大きさとSHA-256は structure.json・manifest.json と同じ値）
const RECORD_PINS = Object.freeze({
  all: Object.freeze({bytes: 176, sha256: '73733a984c949dcdc7d62c53d961d147fc1c00e347f6541af120b96c73a02024'}),
  children: Object.freeze({bytes: 142, sha256: 'c2f989c3eac6525942de0516f95a4c10268c47993cd50b1909aacb2882bb6e49'}),
  reading: Object.freeze({bytes: 131, sha256: '3cd9bfe7491b52a816b5caaae2679deddea6055d911c35c0cd5354e64faafda5'}),
});
export const PART_IDS = Object.freeze(['core', 'style', 'type', 'access', 'copy', 'handoff']);
const PART_SOURCES = Object.freeze({
  core: skillPath('design-taste'), style: skillPath('japanese-minimal'), type: skillPath('taste-typography'),
  access: skillPath('taste-accessibility'), copy: skillPath('taste-ux-copy'), handoff: P.plan,
});
const EVENT_IDS = Object.freeze(['e01', 'e02', 'e03', 'e04', 'e05', 'e06']);
const GROUPS = Object.freeze([
  {id: 'core', label: '共通の指針', skills: ['design-taste']},
  {id: 'style', label: '表現を1つ', skills: ['japanese-minimal']},
  {id: 'helpers', label: '補助の指針', skills: ['taste-accessibility', 'taste-typography', 'taste-ux-copy']},
]);
const COUNTS = Object.freeze({upstream_skills: 24, selected_skills: 5, groups: 3, parts: 6, events: 6, original_Node_checks: 21});
const FILTER = Object.freeze({
  module: 'events.mjs', function: 'filterEvents', search_fields: ['title', 'description', 'place'], normalization: 'NFKC・前後空白除去・小文字化',
  literal_substring: true, word_AND: false, audience_query_AND: true, preserve_input_order: true,
  reading_query_is_short_story: '短編', '読書_matches': 4, reservation_or_network_or_storage: false,
});
const AUD_EXPECTED = Object.freeze({all: 'すべて', children: '子ども', adults: 'おとな', everyone: 'どなたでも'});
const EVENT_FIELDS = Object.freeze(['id', 'date', 'start', 'end', 'title', 'audience', 'audience_label', 'place', 'participation', 'description', 'registration']);
const DESIGN_READ_PREFIX = '**design read**：';
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const githubLine = (up, line) => `https://github.com/${REPO}/blob/${SOURCE_COMMIT}/${up}?plain=1#L${line}`;
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
const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});
// n個を順にずらして動かす（spread は全体に占めるずれの割合）
const stagger = (k, i, n, spread = 0.45) => (n <= 1 ? clamp01(k) : clamp01((k - (i * spread) / (n - 1)) / (1 - spread)));
const val = (o, k, d) => (o && o[k] !== undefined ? o[k] : d);
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
// JSONから来た値だけを凍らせる
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o) && (Array.isArray(o) || Object.getPrototypeOf(o) === Object.prototype)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
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
function pngSize(bytes, path) {
  check(bytes.length > 24 && PNG_SIG.every((b, i) => bytes[i] === b) && String.fromCharCode(...bytes.subarray(12, 16)) === 'IHDR', `${path} がPNGではありません`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [dv.getUint32(16), dv.getUint32(20)];
}

// 照合したバイトをそのままモジュールとして読む。blob: を読めない環境に限り、同じ回に照合した同じ場所の events.mjs を読む
// （どちらの場合も、下で保存した3つの結果・元の検査と同じ値を返すことを確かめてから使う）。
async function importVerified(bytes) {
  let url = null;
  try {
    url = URL.createObjectURL(new Blob([bytes], {type: 'text/javascript'}));
    return await import(url);
  } catch {
    try { return await import(assetUrl(P.module)); } catch { return fail('events.mjs をモジュールとして読めませんでした'); }
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

function validateManifest(m) {
  check(m && m.format === 'design-taste-visual-assets/v1' && m.case_id === CASE_ID, 'concept/manifest.json の形式か作例IDが違います');
  check(Array.isArray(m.files) && sameList(m.files.map((x) => x && x.path), ASSET_PATHS), `concept/manifest.json の素材${ASSET_COUNT}件の一覧が違います`);
  for (const x of m.files) check(Number.isInteger(x.bytes) && x.bytes > 0 && /^[0-9a-f]{64}$/.test(x.sha256), `concept/manifest.json の ${x.path} の記録が読めません`);
  for (const id of PRESET_IDS) {
    const x = m.files.find((y) => y.path === recordPath(id));
    check(x.bytes === RECORD_PINS[id].bytes && x.sha256 === RECORD_PINS[id].sha256, `concept/manifest.json の ${recordPath(id)} が固定値と違います`);
  }
}

function buildBundle(manifest, bytes, mod) {
  const text = (p) => decodeText(bytes.get(p), p);
  const json = (p) => parseJson(p, text(p));
  const entry = (p) => manifest.files.find((x) => x.path === p);

  // 1. 図の部品と範囲（structure.json）
  const S = json(P.structure);
  check(S && S.format === 'design-taste-structure/v1' && S.case_id === CASE_ID && S.source_commit === SOURCE_COMMIT && isStr(S.definition), 'concept/structure.json の形式か固定版が違います');
  check(deepEqual(S.counts, COUNTS), 'concept/structure.json の件数が違います');
  check(deepEqual(S.skill_groups, GROUPS), 'concept/structure.json の3つの群が違います');
  check(deepEqual(S.filter, FILTER), 'concept/structure.json の絞り込みの決まりが違います');
  check(S.actors && ['AI', 'operator', 'visitor'].every((k) => isStr(S.actors[k])), 'concept/structure.json の役割の記録が読めません');
  check(Array.isArray(S.adjustments) && S.adjustments.length === 4 && S.adjustments.every((a) => a && SKILLS.includes(a.source)
    && ['original', 'applied', 'reason'].every((k) => isStr(a[k]))), 'concept/structure.json の調整の記録が読めません');
  check(Array.isArray(S.notes) && S.notes.length > 0 && S.notes.every(isStr), 'concept/structure.json の注記が読めません');
  check(sameList(ids(S.jobs), PRESET_IDS), 'concept/structure.json の3つの条件が違います');
  for (const j of S.jobs) {
    const pin = RECORD_PINS[j.id], e = entry(recordPath(j.id));
    check(isStr(j.label) && j.input && Array.isArray(j.event_ids) && j.count === j.event_ids.length && e.bytes === pin.bytes && e.sha256 === pin.sha256
      && deepEqual(j.output_file, {path: recordPath(j.id), bytes: pin.bytes, sha256: pin.sha256}), `concept/structure.json の ${j.id} の記録ファイルが違います`);
  }

  // 2. 6つの部分：引用が同梱の原典（または元の計画）のその行にあること
  const lines = {};
  for (const p of new Set(Object.values(PART_SOURCES))) lines[p] = text(p).split(/\r?\n/);
  check(sameList(ids(S.parts), PART_IDS), 'concept/structure.json の6つの部分が違います');
  const parts = S.parts.map((x) => {
    check(isStr(x.label) && isStr(x.meaning) && isStr(x.quote) && x.source_path === PART_SOURCES[x.id] && Number.isInteger(x.line_start) && x.line_start >= 1, `${x && x.id} の引用の記録が読めません`);
    const up = x.source_path.startsWith(V) ? x.source_path.slice(V.length) : null;
    check(x.upstream_path === up, `${x.id} の原典のパスが違います`);
    const line = lines[x.source_path][x.line_start - 1] || '';
    check(line.includes(x.quote), `${x.id} の引用が ${x.source_path} の${x.line_start}行目にありません`);
    return Object.freeze({id: x.id, label: x.label, meaning: x.meaning, quote: x.quote, source_path: x.source_path, line_start: x.line_start,
      line: line.trim(), upstream: up, lineUrl: up ? githubLine(up, x.line_start) : null});
  });

  // 3. 同梱の原典：5冊の名前・README・LICENSE
  for (const s of SKILLS) {
    const m = /^---\r?\nname: ([^\r\n]+)\r?\n/.exec(text(skillPath(s)));
    check(m && m[1].trim() === s, `${skillPath(s)} の name が ${s} ではありません`);
  }
  check(text(P.readme).includes('24 skills'), '原典の README に24のスキルの記述がありません');
  const license = text(P.license);
  check(license.trimStart().startsWith('MIT License') && license.includes('Copyright (c) 2026 Mustafa'), '原典の LICENSE が MIT（2026 Mustafa）ではありません');

  // 4. 入力の6件（変えてはいけないデータ）
  const E = json(P.events);
  check(E && E.synthetic === true && E.library === '余白図書室（架空）' && sameList(ids(E.events), EVENT_IDS), 'events.json の6件が違います');
  for (const ev of E.events) {
    check(EVENT_FIELDS.every((k) => isStr(ev[k])) && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) && /^\d{2}:\d{2}$/.test(ev.start) && /^\d{2}:\d{2}$/.test(ev.end)
      && Object.hasOwn(AUD_EXPECTED, ev.audience) && ev.audience !== 'all' && ev.audience_label === AUD_EXPECTED[ev.audience], `events.json の ${ev.id} が読めません`);
  }

  // 5. 元の実行の記録（results・samples・validation）と、ここで読むファイルのハッシュの対応
  const R = json(P.results), SM = json(P.samples), VA = json(P.validation);
  const srcHash = (o) => o && o['events.json'] === entry(P.events).sha256 && o['events.mjs'] === entry(P.module).sha256;
  check(R && isStr(R.scope) && isStr(R.node_version) && srcHash(R.source_sha256) && sameList(ids(R.presets), PRESET_IDS), 'results.json の記録か元のファイルのハッシュが違います');
  check(VA && srcHash(VA.source_sha256) && Array.isArray(VA.checks) && VA.checks.length === COUNTS.original_Node_checks && VA.passed === COUNTS.original_Node_checks
    && VA.failed === 0 && VA.human_approval === false && VA.checks.every((x) => x && x.passed === true), 'validation.json の21条件の記録が違います');
  check(SM && SM.format === 'input-output' && sameList(ids(SM.samples), PRESET_IDS), 'samples.json の3つの見本が違います');
  const savedById = Object.fromEntries(R.presets.map((x) => [x.id, x]));
  const vcheck = (name) => VA.checks.find((x) => x.name === name);

  // 6. 3つの実記録：元の結果と同じ値であること（改行LFのUTF-8）
  const recs = {};
  for (const id of PRESET_IDS) {
    const body = text(recordPath(id));
    check(!body.includes('\r') && body.endsWith('\n'), `${recordPath(id)} が改行LFのUTF-8ではありません`);
    const rec = parseJson(recordPath(id), body);
    const j = S.jobs.find((x) => x.id === id), sm = SM.samples.find((x) => x.id === id);
    check(deepEqual(rec, savedById[id]) && deepEqual(rec, {id, input: j.input, count: j.count, event_ids: j.event_ids}), `${recordPath(id)} の値が results.json の ${id} と違います`);
    check(sm && sm.input_file === P.events && sm.link === `index.html#${id}` && deepEqual(sm.conditions, rec.input)
      && sameList(sm.expected_ids, rec.event_ids) && sameList(sm.actual_ids, rec.event_ids), `samples.json の ${id} が保存した結果と違います`);
    recs[id] = {rec, body};
  }

  // 7. 照合した events.mjs を、このブラウザーで呼ぶ（新しいNodeの実行や、元の21条件のやり直しではない）
  check(typeof mod?.filterEvents === 'function' && typeof mod.formatDateJa === 'function' && typeof mod.weekdayJa === 'function'
    && sameList(mod.SEARCH_FIELDS, FILTER.search_fields) && deepEqual(mod.AUDIENCE_LABELS, AUD_EXPECTED), 'events.mjs の書き出しが違います');
  for (const j of S.jobs) {
    const pr = mod.PRESETS?.[j.id];
    check(pr && pr.label === j.label && deepEqual({audience: pr.audience, query: pr.query}, j.input), `events.mjs の ${j.id} の条件が structure.json と違います`);
  }
  const frozen = deepFreeze(JSON.parse(JSON.stringify(E.events)));
  const run = (input) => {
    let out;
    try { out = mod.filterEvents(frozen, input); } catch { fail('events.mjs の filterEvents を呼べませんでした'); }
    check(Array.isArray(out) && out.every((x) => frozen.includes(x)), 'filterEvents が入力の催しではない値を返しました');
    const got = out.map((x) => x.id);
    check(got.every((id, i) => i === 0 || EVENT_IDS.indexOf(id) > EVENT_IDS.indexOf(got[i - 1])), 'filterEvents が入力の順序を変えました');
    return got;
  };
  const live = {};
  for (const j of S.jobs) {
    live[j.id] = run({...j.input});
    check(sameList(live[j.id], j.event_ids) && sameList(live[j.id], recs[j.id].rec.event_ids), `このブラウザーで呼んだ ${j.id} の結果（${live[j.id].join('・') || 'なし'}）が保存した結果と違います`);
  }
  // 決まりを示す6つの例。元の検査にある4つは、保存した actual_ids とも照らす。
  const PROBES = [
    {query: '読書', audience: 'all', shown: '「読書」', from: 'place-is-searched', note: '会場「読書の間」にも一致（検索は題名・説明・会場）'},
    {query: '短編 読書', audience: 'all', shown: '「短編 読書」', expect: [], note: '語ごとのANDではなく、空白も含めた文字どおりの部分一致'},
    {query: '子ども', audience: 'all', shown: '「子ども」', expect: [], note: '対象の名前は検索の対象ではない'},
    {query: '2026', audience: 'all', shown: '「2026」', from: 'date-is-not-searched', note: '日付と時刻は検索の対象ではない'},
    {query: '　短編　', audience: 'all', shown: '「　短編　」（前後に全角空白）', from: 'trim-wide-spaces', note: 'NFKCのあと前後の空白を除く'},
    {query: '短編', audience: 'children', shown: '「短編」＋対象「子ども」', from: 'audience-and-query', note: '対象と検索語はAND'},
  ];
  const probes = PROBES.map((x) => {
    const got = run({audience: x.audience, query: x.query});
    let expected = x.expect;
    if (x.from) {
      const v = vcheck(x.from);
      const vin = {audience: 'all', query: '', ...(v?.input || {})};
      check(v && vin.audience === x.audience && vin.query === x.query, `validation.json の ${x.from} の条件が違います`);
      expected = v.actual_ids;
    }
    check(sameList(got, expected), `「${x.query}」の結果が記録・決まりと違います`);
    return Object.freeze({shown: x.shown, audience: x.audience, note: x.note, ids: got, fromValidation: Boolean(x.from)});
  });
  check(probes[0].ids.length === FILTER['読書_matches'], '「読書」の件数が structure.json と違います');

  // 8. 表示する行（日付と曜日は events.mjs の関数で）
  const rows = E.events.map((ev, i) => {
    const wk = mod.weekdayJa(ev.date), dateText = mod.formatDateJa(ev.date);
    const fixed = vcheck(`fixed-calendar-${ev.id}`);
    check(fixed && fixed.actual_weekday === wk && /^\d{1,2}月\d{1,2}日$/.test(dateText), `${ev.id} の曜日か日付の表示が元の検査と違います`);
    return Object.freeze({id: ev.id, color: i, day: Number(ev.date.slice(8, 10)), date: ev.date, dateText, wk, start: ev.start, end: ev.end,
      title: ev.title, place: ev.place, audience: ev.audience, audienceLabel: ev.audience_label, participation: ev.participation,
      description: ev.description, registration: ev.registration});
  });
  const AUD = mod.AUDIENCE_LABELS;
  const jobs = {};
  for (const j of S.jobs) {
    const {audience, query} = j.input;
    const picked = j.event_ids.map((id) => rows.find((r) => r.id === id));
    jobs[j.id] = Object.freeze({
      id: j.id, label: j.label, input: j.input, ids: live[j.id], count: j.count, picked,
      path: recordPath(j.id), bytes: RECORD_PINS[j.id].bytes, sha256: RECORD_PINS[j.id].sha256, body: recs[j.id].body,
      desk: `desk.html#${j.id}`, download: `design-taste-${j.id}.json`,
      short: query ? `${query}${j.count}件` : audience !== 'all' ? `${AUD[audience]}${j.count}件` : `${j.count}件`,
      control: query ? {kind: '検索', value: query, select: false} : {kind: '対象', value: AUD[audience], select: true},
      conditionText: `対象「${AUD[audience]}」・${query ? `検索「${query}」` : '検索語なし'}`,
    });
  }

  // 9. 計画・依頼・入力・実画面の静止画
  const planLines = lines[P.plan];
  const readLine = planLines[4] || '';
  check(readLine.startsWith(DESIGN_READ_PREFIX) && text(P.plan).includes('#625C53') && text(P.plan).includes('#8A8378'), 'design-plan.md の方針一行（5行目）が読めません');
  const input = text(P.input);
  check(input.includes('余白図書室') && input.includes('2026年11月'), 'input.md の依頼が違います');
  const request = text(P.request);
  check(request.includes(SOURCE_COMMIT) && request.includes('japanese-minimal') && request.includes('【'), 'request.txt の依頼文が違います');
  const captures = Object.entries(CAPTURES).map(([path, [w, h]]) => {
    const [pw, ph] = pngSize(bytes.get(path), path);
    check(pw === w && ph === h, `${path} の大きさが記録と違います（${pw}×${ph}）`);
    return Object.freeze({path, w, h});
  });

  return {
    manifest, definition: S.definition, actors: S.actors, notes: S.notes, adjustments: S.adjustments, counts: S.counts, groups: S.skill_groups,
    parts, rows, jobs, probes, request, captures, audience: AUD,
    designRead: readLine.slice(DESIGN_READ_PREFIX.length).trim(), nodeVersion: R.node_version,
  };
}

// 23件をすべて取り直して照合し、照合した events.mjs で3つの条件を計算する。どれか一つでも違えば例外。
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
    await Promise.all(manifest.files.map(async (item) => {
      try {
        const body = await fetchBytes(item.path, inner.signal);
        check(body.byteLength === item.bytes, `${item.path} の大きさが記録と違います`);
        check((await sha256Hex(body)) === item.sha256, `${item.path} のSHA-256が記録と違います`);
        bytes.set(item.path, body);
      } catch (error) {
        if (!failed) { failed = true; inner.abort(); }
        throw error;
      }
      if (!failed) onProgress?.('assets', ++done, manifest.files.length);
    }));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    onProgress?.('module', 0, 1);
    const mod = await importVerified(bytes.get(P.module));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return deepFreeze(buildBundle(manifest, bytes, mod));
  } finally {
    signal?.removeEventListener('abort', relay);
  }
}

// ---------- 概念図（ページと図解動画で共通） ----------
// 渡す：共通の本・開いた表現の本・細い補助の本3冊と、依頼の札「誰に / 何を / 催し6件」が、同じ1つのAIへ合流
// 組み立てる：AIが「方針一行」の紙を書く → 同じ紙がAIへ戻る（次の執筆）→ コードの紙 → 制作担当が確認（Node・実画面）
// 使う：同じ紙が6件の罫線の行に開く → 実際の filterEvents が選んだ行の札が結果へ → 参加方法・JSON・実UI

export const FONT = Object.freeze({
  sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, "BIZ UDPGothic", Meiryo, sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "BIZ UDPMincho", serif',
});
// 紙・墨・印の赤。藍はAIが読む／書く流れ、茶は制作担当の確認、赤は使う人の結果。6色は6件の行の目印（色だけでなく日付の数字も添える）。
export const PALETTES = Object.freeze({
  light: Object.freeze({bg: '#F4F1EA', sheet: '#FBF9F4', ink: '#33302B', muted: '#625C53', rule: '#8A8378', line: '#D8D1C4', faint: '#E6E0D4',
    seal: '#B3392A', ai: '#2E4C6D', aiSoft: '#DCE3EB', op: '#7A5320', opSoft: '#EEE2CE', onInk: '#F4F1EA',
    rows: Object.freeze(['#3B6A88', '#8A4767', '#66662C', '#2D7566', '#94601E', '#5B568A'])}),
  dark: Object.freeze({bg: '#1C1A17', sheet: '#25221E', ink: '#ECE6DA', muted: '#BDB4A6', rule: '#7A7266', line: '#3A352F', faint: '#2E2A25',
    seal: '#E8806E', ai: '#9FB8D6', aiSoft: '#232C37', op: '#D9AB6A', opSoft: '#362B1C', onInk: '#1C1A17',
    rows: Object.freeze(['#8DB8D6', '#D79AB8', '#C4C47C', '#7FC6B5', '#E0AE6A', '#ABA6DE'])}),
});
// 計画の紙に描く色見本は、原典と計画の値そのもの（表示の配色に関係なく同じ）
const SW = Object.freeze({paper: '#F4F1EA', ink: '#33302B', seal: '#B3392A', ash: '#8A8378', adjusted: '#625C53'});

// [x, y, w, h]（図の幅・高さに対する割合）
const TALL = {
  books: [0.02, 0.055, 0.50, 0.245], request: [0.60, 0.055, 0.38, 0.205],
  ai: [0.36, 0.34, 0.28, 0.19], page: [0.02, 0.35, 0.28, 0.20], plan: [0.70, 0.35, 0.28, 0.20],
  operator: [0.02, 0.585, 0.42, 0.058], rows: [0.02, 0.695, 0.56, 0.295], tray: [0.62, 0.695, 0.36, 0.295],
};
const WIDE = {
  books: [0.015, 0.11, 0.28, 0.47], request: [0.035, 0.665, 0.24, 0.30],
  ai: [0.335, 0.35, 0.13, 0.30], plan: [0.50, 0.09, 0.155, 0.36], page: [0.50, 0.53, 0.155, 0.31],
  operator: [0.47, 0.885, 0.215, 0.085], rows: [0.71, 0.09, 0.275, 0.53], tray: [0.71, 0.665, 0.275, 0.31],
};
// 3段の名札（番号と「渡す」「組み立てる」「使う」）の位置
const BANDS = {tall: [[0.02, 0.022], [0.02, 0.322], [0.02, 0.668]], wide: [[0.015, 0.04], [0.335, 0.04], [0.71, 0.04]]};
export const STAGE_LABELS = Object.freeze(['渡す', '組み立てる', '使う']);
export const NODE_KEYS = Object.freeze(Object.keys(TALL));
// 線の種類：ai はAIが読む／書く流れ、op は制作担当の確認、use は使う人の結果
const EDGE_KIND = Object.freeze({giveBooks: 'ai', giveReq: 'ai', write: 'ai', back: 'ai', code: 'ai', check: 'op', deliver: 'op', use: 'use'});
export const ALL_EDGES = Object.freeze(Object.keys(EDGE_KIND));
const EDGE_STAGE = {giveBooks: 0, giveReq: 0, write: 1, back: 1, code: 1, check: 1, deliver: 2, use: 2};
const STAGE_NODES = {books: [1, 0, 0], request: [1, 0, 0], ai: [1, 1, 0], plan: [0, 1, 0], page: [0, 1, 0], operator: [0, 1, 0], rows: [0, 0, 1], tray: [0, 0, 1]};
// 6つの部分を選んだときに枠を付ける場所
export const PART_NODES = Object.freeze({core: ['bookCore'], style: ['bookStyle', 'plan'], type: ['bookType', 'plan'], access: ['bookAccess', 'tray'],
  copy: ['bookCopy', 'tray'], handoff: ['ai', 'plan', 'page', 'operator']});

// 5冊：閉じて並んだ位置（映像の最初）と、3つの群に分かれた位置（幅に対する割合）
const BOOK_KEYS = ['core', 'style', 'type', 'access', 'copy'];
const BOOK_FINAL = {core: 0, style: 0.375, type: 0.69, access: 0.7975, copy: 0.905};
const BOOK_CLOSED = {core: 0.1575, style: 0.3775, type: 0.5375, access: 0.6425, copy: 0.7475};
const BOOK_W = {core: 0.21, style: 0.15, type: 0.095, access: 0.095, copy: 0.095};
const BOOK_H = {core: 0.96, style: 0.9, type: 0.84, access: 0.9, copy: 0.8};
const STYLE_OPEN = {x: 0.26, w: 0.38, h: 0.74};
const HELPER_LABEL = {type: '文字', access: '操作', copy: '文言'};
const BOOK_CAPTIONS = [
  {x: 0.105, w: 0.25, text: '共通', sub: 'design-taste'},
  {x: 0.45, w: 0.4, text: '表現を1つ', sub: 'japanese-minimal'},
  {x: 0.845, w: 0.32, text: '補助3冊', sub: 'taste-×3'},
];

export function chooseKind(W, H) { return W >= 900 && W / H >= 1.25 ? 'wide' : 'tall'; }

const right = (r) => r.x + r.w;
const bottom = (r) => r.y + r.h;
const midX = (r) => r.x + r.w / 2;
const midY = (r) => r.y + r.h / 2;
const ctr = (r) => [midX(r), midY(r)];

export function conceptLayout(kind, W, H) {
  const wide = kind === 'wide';
  const n = {};
  for (const [k, [x, y, w, h]] of Object.entries(wide ? WIDE : TALL)) n[k] = {x: x * W, y: y * H, w: w * W, h: h * H};
  const u = wide ? Math.min(W / 74, H / 34) : Math.min(W / 26, H / 30);
  // 文字の下限：見出し13px・小12px・最小11px（スマートフォンでも読める大きさ）
  const f = {label: Math.max(13, u), small: Math.max(12, u * 0.86), tiny: Math.max(11, u * 0.78), big: Math.max(15, u * 1.25)};
  const gap = Math.max(3, u * 0.35);

  // 本棚：棚の線に下をそろえ、下に群の名札
  const B = n.books;
  const two = wide && B.w > f.tiny * 24;
  const capH = f.label * 1.45 + (two ? f.tiny * 1.35 : 0);
  const area = {x: B.x, y: B.y, w: B.w, h: Math.max(10, B.h - capH)};
  const shelf = bottom(area);
  const books = {
    area, shelf, two, capY: shelf + f.label * 0.85, subY: shelf + f.label * 1.5 + f.tiny * 0.55,
    open: {x: B.x + B.w * STYLE_OPEN.x, y: shelf - area.h * STYLE_OPEN.h, w: B.w * STYLE_OPEN.w, h: area.h * STYLE_OPEN.h},
    rect(key, spread) {
      const fx = lerp(BOOK_CLOSED[key], BOOK_FINAL[key], clamp01(spread)), h = area.h * BOOK_H[key];
      return {x: B.x + B.w * fx, y: shelf - h, w: B.w * BOOK_W[key], h};
    },
  };

  // 1つのAI（円）
  const ai = {cx: midX(n.ai), cy: midY(n.ai) - (wide ? 0 : n.ai.h * 0.08), r: Math.min(n.ai.w, n.ai.h) * 0.4};
  const {cx, cy, r} = ai;
  const s45 = r * 0.893;
  const R = n.request, PL = n.plan, PG = n.page, OP = n.operator, RW = n.rows, TR = n.tray;
  const e = {};
  if (wide) {
    const yb = Math.min(midY(B), cy - r - gap * 2);
    e.giveBooks = [[right(B), yb], [cx - r * 0.45, yb], [cx - r * 0.45, cy - s45]];
    e.giveReq = [[right(R), midY(R)], [cx - r * 0.45, midY(R)], [cx - r * 0.45, cy + s45]];
    const yw = midY(PL) - PL.h * 0.12, yBack = midY(PL) + PL.h * 0.22;
    e.write = [[cx + r * 0.45, cy - s45], [cx + r * 0.45, yw], [PL.x, yw]];
    e.back = [[PL.x, yBack], [cx + r * 0.9, yBack], [cx + r * 0.9, cy - r * 0.44]];
    e.code = [[cx + r * 0.9, cy + r * 0.44], [cx + r * 0.9, midY(PG)], [PG.x, midY(PG)]];
    e.check = [[midX(PG), bottom(PG)], [midX(PG), OP.y]];
    const xr = RW.x - Math.max(gap * 1.5, W * 0.012);
    e.deliver = [[right(OP), midY(OP)], [xr, midY(OP)], [xr, midY(RW)], [RW.x, midY(RW)]];
    e.use = [[midX(RW), bottom(RW)], [midX(RW), TR.y]];
  } else {
    const yJ = (bottom(R) + (cy - r)) / 2;
    e.giveBooks = [[cx - r * 0.45, bottom(B)], [cx - r * 0.45, cy - s45]];
    e.giveReq = [[midX(R), bottom(R)], [midX(R), yJ], [cx + r * 0.45, yJ], [cx + r * 0.45, cy - s45]];
    e.write = [[cx + r * 0.866, cy - r * 0.5], [PL.x, cy - r * 0.5]];
    e.back = [[PL.x, cy + r * 0.5], [cx + r * 0.866, cy + r * 0.5]];
    e.code = [[cx - r, cy], [right(PG), cy]];
    e.check = [[midX(PG), bottom(PG)], [midX(PG), OP.y]];
    e.deliver = [[midX(PG), bottom(OP)], [midX(PG), RW.y]];
    e.use = [[right(RW), midY(RW)], [TR.x, midY(RW)]];
  }

  // 6件の罫線の行
  const rh = RW.h / 6;
  const rows = [0, 1, 2, 3, 4, 5].map((i) => ({x: RW.x, y: RW.y + i * rh, w: RW.w, h: rh}));
  return {kind, W, H, u, f, gap, n, e, ai, books, rows};
}

// 既定は完成した姿。ページの段階と動画は、ここから値を変える。
export function restParams() {
  return {
    show: {}, emph: {}, emphEdge: {}, draw: {}, flow: {}, band: [1, 1, 1],
    spread: 1, styleOpen: 1, reqLine: 3, give: 1, plan: 1, adjust: 1, back: 1, code: 1, check: 1, unfold: 1,
    picks: null, chips: null, tray: null, open: 1, out: 1,
    preset: 'children', focusPart: null,
  };
}

// ページの段階：τ=1 渡す、τ=2 組み立てる、τ=3 使う。τの途中は動きの途中。図の形と線はいつも全部見せる。
export function storyParams(tau, preset) {
  const p = restParams();
  const F = p.flow;
  p.preset = preset;
  p.styleOpen = prog(tau, 0, 0.3);
  p.reqLine = 3 * prog(tau, 0.1, 0.45);
  F.giveBooks = F.giveReq = prog(tau, 0.35, 0.6);
  p.give = prog(tau, 0.45, 1.0);
  F.write = prog(tau, 1.0, 1.08);
  p.plan = prog(tau, 1.0, 1.3);
  p.adjust = prog(tau, 1.28, 1.42);
  F.back = prog(tau, 1.42, 1.5);
  p.back = prog(tau, 1.42, 1.58);
  F.code = prog(tau, 1.56, 1.64);
  p.code = prog(tau, 1.58, 1.78);
  F.check = prog(tau, 1.78, 1.86);
  p.check = prog(tau, 1.78, 2.0);
  F.deliver = prog(tau, 1.92, 2.04);
  p.unfold = prog(tau, 2.0, 2.3);
  F.use = prog(tau, 2.28, 2.36);
  p.picks = [{preset, w: prog(tau, 2.3, 2.55)}];
  p.chips = {preset, k: prog(tau, 2.35, 2.7)};
  p.tray = {preset, a: 1};
  p.open = prog(tau, 2.65, 2.85);
  p.out = prog(tau, 2.8, 3.0);
  const w = [tau <= 1 ? 1 : clamp01(2 - tau), clamp01(1 - Math.abs(tau - 2)), clamp01(tau - 2)];
  const weight = (m) => Math.max(m[0] * w[0], m[1] * w[1], m[2] * w[2]);
  for (const [k, m] of Object.entries(STAGE_NODES)) p.emph[k] = 0.7 + 0.3 * weight(m);
  for (let i = 0; i < 3; i++) { p.emphEdge[i] = 0.7 + 0.3 * w[i]; p.band[i] = 0.6 + 0.4 * w[i]; }
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
function hline(c, x0, x1, y, color, width) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x0, y);
  c.lineTo(x1, y);
  c.stroke();
}
// 図の中の文字の下限（drawConcept の間だけ11px）
let FLOOR = 0;
// 幅 max に収まるまで文字を小さくして描く（下限 min）。収まらなければ末尾を「…」にする。描いた幅を返す。
export function drawText(c, s, x, y, o = {}) {
  const weight = o.weight || 400, family = o.family || FONT.sans;
  let size = Math.max(o.size || 14, FLOOR);
  const min = Math.max(Math.min(size, o.min ?? size * 0.8), FLOOR);
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
// 縦書き（1文字ずつ下へ）。高さ maxH に収まるまで小さくし、収まらない分は描かない。
function drawVertical(c, s, x, yCenter, o) {
  const chars = [...s];
  let size = Math.max(o.size, FLOOR);
  const step = () => size * 1.08;
  while (chars.length * step() > o.maxH && size > Math.max(FLOOR, 9)) size -= 0.5;
  const list = chars.length * step() > o.maxH ? chars.slice(0, Math.max(1, Math.floor(o.maxH / step()))) : chars;
  const top = yCenter - (list.length * step()) / 2;
  c.font = `${o.weight || 400} ${size}px ${o.family || FONT.sans}`;
  c.fillStyle = o.color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  list.forEach((ch, i) => c.fillText(ch, x, top + step() * (i + 0.5)));
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
  c.lineCap = 'round';
  c.setLineDash([]);
  c.stroke();
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
function triangle(c, x, y, s, angle, color) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(-s * 0.35, -s * 0.45);
  c.lineTo(s * 0.45, 0);
  c.lineTo(-s * 0.35, s * 0.45);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.restore();
}
// 紙（角を少し折った1枚）
function drawSheet(c, r, pal, u) {
  const fold = Math.min(r.w, r.h) * 0.16;
  c.beginPath();
  c.moveTo(r.x, r.y);
  c.lineTo(right(r) - fold, r.y);
  c.lineTo(right(r), r.y + fold);
  c.lineTo(right(r), bottom(r));
  c.lineTo(r.x, bottom(r));
  c.closePath();
  c.fillStyle = pal.sheet;
  c.fill();
  c.strokeStyle = pal.ink;
  c.lineWidth = Math.max(1.1, u * 0.08);
  c.stroke();
  c.beginPath();
  c.moveTo(right(r) - fold, r.y);
  c.lineTo(right(r) - fold, r.y + fold);
  c.lineTo(right(r), r.y + fold);
  c.stroke();
}
// 動く小さな紙（kind：plan は方針一行の太い線、code は藍のコードの線、list は6件の目印）
function miniSheet(c, r, pal, u, kind) {
  drawSheet(c, r, pal, u * 0.7);
  const pad = Math.max(2, r.w * 0.14), x0 = r.x + pad, w = r.w - pad * 2;
  if (kind === 'plan') {
    c.fillStyle = pal.ink;
    c.fillRect(x0, r.y + r.h * 0.3, w * 0.85, Math.max(1.5, r.h * 0.09));
    hline(c, x0, x0 + w * 0.7, r.y + r.h * 0.58, pal.rule, 1);
    hline(c, x0, x0 + w * 0.55, r.y + r.h * 0.76, pal.rule, 1);
  } else if (kind === 'code') {
    c.fillStyle = pal.ai;
    [0.75, 0.5, 0.65].forEach((fr, i) => c.fillRect(x0 + (i === 1 ? w * 0.12 : 0), r.y + r.h * (0.3 + i * 0.2), w * fr, Math.max(1.2, r.h * 0.07)));
  } else {
    const lh = (r.h - pad * 2) / 6;
    for (let i = 0; i < 6; i++) {
      c.fillStyle = pal.rows[i];
      c.fillRect(x0, r.y + pad + i * lh + lh * 0.2, Math.max(1.5, w * 0.12), lh * 0.6);
      hline(c, x0 + w * 0.2, x0 + w, r.y + pad + (i + 1) * lh - 0.5, pal.rule, 0.8);
    }
  }
}
function drawChip(c, r, color, text, pal, f) {
  c.fillStyle = color;
  rr(c, r.x, r.y, r.w, r.h, 2);
  c.fill();
  if (!text) return;
  // 日付の数字は2桁が入る大きさのときだけ（札ごとに有無が変わらないように）
  const size = Math.min(f.tiny, r.h * 0.8);
  if (size < 11 || r.w < size * 1.5) return;
  drawText(c, text, midX(r), midY(r), {size, weight: 700, color: pal.onInk, align: 'center'});
}

// ---- 各部 ----
function drawBands(c, L, p, pal) {
  const pos = BANDS[L.kind], {f, gap} = L;
  STAGE_LABELS.forEach((label, i) => {
    alpha(c, p.band ? p.band[i] : 1, () => {
      const x = pos[i][0] * L.W, y = pos[i][1] * L.H, s = f.small * 1.3;
      c.fillStyle = pal.ink;
      c.fillRect(x, y - s / 2, s, s);
      drawText(c, String(i + 1), x + s / 2, y, {size: f.tiny, weight: 700, color: pal.onInk, align: 'center'});
      drawText(c, label, x + s + gap * 0.8, y, {size: f.small, weight: 700, color: pal.ink});
    });
  });
}

function drawBooks(c, L, p, pal) {
  const {books, f, u} = L;
  const sp = clamp01(p.spread), op = clamp01(p.styleOpen);
  hline(c, books.area.x, right(books.area), books.shelf + 0.5, pal.rule, Math.max(1, u * 0.07));
  // 共通の本（濃い表紙・縦の題）
  const core = books.rect('core', sp);
  c.fillStyle = pal.ink;
  rr(c, core.x, core.y, core.w, core.h, 2);
  c.fill();
  hline(c, core.x + core.w * 0.15, right(core) - core.w * 0.15, core.y + core.h * 0.07, pal.onInk, 1);
  hline(c, core.x + core.w * 0.15, right(core) - core.w * 0.15, bottom(core) - core.h * 0.07, pal.onInk, 1);
  drawVertical(c, '用途を読む', midX(core), midY(core), {size: Math.min(f.small, core.w * 0.6), maxH: core.h * 0.76, color: pal.onInk, family: FONT.mincho, weight: 600});
  // 表現の本：閉じた背 → 開いた見開き（紙・墨・印の色、明朝、縦の線1本、印）
  const spine = books.rect('style', sp);
  if (op < 1) {
    alpha(c, 1 - op, () => {
      c.fillStyle = pal.sheet;
      rr(c, spine.x, spine.y, spine.w, spine.h, 2);
      c.fill();
      c.strokeStyle = pal.ink;
      c.lineWidth = Math.max(1.1, u * 0.08);
      c.stroke();
      const s = spine.w * 0.42;
      c.fillStyle = pal.seal;
      c.fillRect(midX(spine) - s / 2, spine.y + spine.h * 0.12, s, s);
    });
  }
  if (op > 0) alpha(c, op, () => drawStyleOpen(c, lerpRect(spine, books.open, ease(op)), L, pal));
  // 補助の本3冊（細い背に2文字）
  for (const key of ['type', 'access', 'copy']) {
    const r = books.rect(key, sp);
    c.fillStyle = pal.faint;
    rr(c, r.x, r.y, r.w, r.h, 2);
    c.fill();
    c.strokeStyle = pal.muted;
    c.lineWidth = Math.max(1, u * 0.07);
    c.stroke();
    drawVertical(c, HELPER_LABEL[key], midX(r), midY(r), {size: Math.min(f.small, r.w * 0.8), maxH: r.h * 0.8, color: pal.ink, weight: 700});
  }
  // 3つの群の名札
  alpha(c, sp, () => BOOK_CAPTIONS.forEach((cap) => {
    const x = books.area.x + books.area.w * cap.x;
    drawText(c, cap.text, x, books.capY, {size: f.label, weight: 700, color: pal.ink, align: 'center', max: books.area.w * cap.w});
    if (books.two) drawText(c, cap.sub, x, books.subY, {size: f.tiny, color: pal.muted, align: 'center', max: books.area.w * cap.w});
  }));
}

function drawStyleOpen(c, r, L, pal) {
  const {f, u} = L;
  const half = r.w / 2;
  c.fillStyle = pal.sheet;
  c.fillRect(r.x, r.y, r.w, r.h);
  c.strokeStyle = pal.ink;
  c.lineWidth = Math.max(1.1, u * 0.08);
  c.strokeRect(r.x, r.y, r.w, r.h);
  c.beginPath();
  c.moveTo(r.x + half, r.y);
  c.lineTo(r.x + half, bottom(r));
  c.stroke();
  // 左の頁：紙・墨・印の赤
  const s = Math.max(4, Math.min(half * 0.36, r.h * 0.2));
  const sx = r.x + half * 0.5 - s / 2;
  [SW.paper, SW.ink, SW.seal].forEach((col, i) => {
    const y = r.y + r.h * 0.14 + i * (s + r.h * 0.07);
    c.fillStyle = col;
    c.fillRect(sx, y, s, s);
    c.strokeStyle = pal.ink;
    c.lineWidth = 1;
    c.strokeRect(sx + 0.5, y + 0.5, s - 1, s - 1);
  });
  // 右の頁：明朝の「明」、縦の線1本、印
  const g = Math.min(f.big * 1.1, r.h * 0.38, half * 0.6);
  drawText(c, '明', r.x + half + half * 0.4, r.y + r.h * 0.34, {size: g, weight: 600, family: FONT.mincho, color: pal.ink, align: 'center'});
  c.strokeStyle = pal.ink;
  c.lineWidth = Math.max(1.2, u * 0.09);
  c.beginPath();
  c.moveTo(r.x + half + half * 0.8, r.y + r.h * 0.14);
  c.lineTo(r.x + half + half * 0.8, r.y + r.h * 0.84);
  c.stroke();
  const ss = Math.min(half * 0.24, r.h * 0.16);
  c.fillStyle = pal.seal;
  c.fillRect(r.x + half + half * 0.3, bottom(r) - r.h * 0.12 - ss, ss, ss);
}

function drawRequest(c, L, p, d, pal) {
  const R = L.n.request, {f, gap, u} = L;
  c.fillStyle = pal.sheet;
  rr(c, R.x, R.y, R.w, R.h, 2);
  c.fill();
  c.strokeStyle = pal.ink;
  c.lineWidth = Math.max(1.2, u * 0.08);
  c.stroke();
  const pad = gap * 1.1, headH = f.tiny * 1.5;
  drawText(c, '依頼', R.x + pad, R.y + pad + headH / 2, {size: f.tiny, weight: 700, color: pal.muted});
  const rowH = (R.h - headH - pad * 2) / 3;
  const keys = ['誰に', '何を', `催し${d.rows.length}件`];
  const subs = ['近所の親子・おとな', '探す→日時→参加方法'];
  keys.forEach((k, i) => {
    const y = R.y + pad + headH + rowH * (i + 0.5);
    const w = drawText(c, k, R.x + pad, y, {size: f.label, weight: 700, color: pal.ink, max: R.w - pad * 2});
    const ul = prog(p.reqLine, i, i + 0.7);
    if (ul > 0) { c.fillStyle = pal.ai; c.fillRect(R.x + pad, y + f.label * 0.62, w * ul, Math.max(1.5, u * 0.1)); }
    const x2 = R.x + pad + w + gap;
    if (i === 2) {
      const avail = right(R) - pad - x2, sg = Math.max(1.5, gap * 0.4);
      const s = Math.max(3, Math.min(f.tiny * 0.8, (avail - sg * 5) / 6));
      d.rows.forEach((ev, j) => { c.fillStyle = pal.rows[ev.color]; c.fillRect(x2 + j * (s + sg), y - s / 2, s, s); });
    } else if (L.kind === 'wide') {
      drawText(c, subs[i], x2, y, {size: f.tiny, color: pal.muted, max: right(R) - pad - x2});
    }
  });
}

function drawAI(c, L, p, pal) {
  const {cx, cy, r} = L.ai, {f, u} = L;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = pal.sheet;
  c.fill();
  if (p.give > 0) {
    alpha(c, easeOut(p.give), () => { c.beginPath(); c.arc(cx, cy, r * 0.84, 0, Math.PI * 2); c.fillStyle = pal.aiSoft; c.fill(); });
  }
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.strokeStyle = pal.ai;
  c.lineWidth = Math.max(2, u * 0.15);
  c.stroke();
  if (L.kind === 'wide') {
    drawText(c, 'AI', cx, cy - r * 0.2, {size: Math.min(f.big * 1.3, r * 0.5), weight: 700, color: pal.ink, align: 'center'});
    drawText(c, '同じAIが', cx, cy + r * 0.28, {size: f.tiny, color: pal.ink, align: 'center', max: r * 1.7});
    drawText(c, '2回執筆', cx, cy + r * 0.56, {size: f.tiny, color: pal.ink, align: 'center', max: r * 1.4});
  } else {
    drawText(c, 'AI', cx, cy, {size: Math.min(f.big * 1.25, r * 0.75), weight: 700, color: pal.ink, align: 'center'});
    drawText(c, '同じAIが2回執筆', cx, cy + r + f.tiny * 0.95, {size: f.tiny, color: pal.muted, align: 'center', max: L.W * 0.38});
  }
}

function drawPlan(c, L, p, pal) {
  const r = L.n.plan, {f, gap, u} = L;
  drawSheet(c, r, pal, u);
  const pad = gap * 1.1, headH = f.label * 1.45;
  drawText(c, '方針一行', r.x + pad, r.y + pad + headH / 2, {size: f.label, weight: 700, family: FONT.mincho, color: pal.ink, max: r.w - pad * 2 - r.w * 0.1});
  const ready = prog(p.plan, 0.3, 1);
  const ix = r.x + pad, iy = r.y + pad + headH, iw = r.w - pad * 2, ih = bottom(r) - pad - iy;
  const rowH = ih / 4;
  const row = (i) => prog(ready, i * 0.2, i * 0.2 + 0.4);
  // 0：一行の design read（書かれた1本の線）
  alpha(c, row(0), () => {
    const h = Math.max(2, rowH * 0.18);
    c.fillStyle = pal.ink;
    rr(c, ix, iy + rowH * 0.5 - h / 2, iw * 0.92, h, h / 2);
    c.fill();
  });
  const adj = clamp01(p.adjust);
  const sw = (x, y, s, col) => {
    c.fillStyle = col;
    c.fillRect(x, y - s / 2, s, s);
    c.strokeStyle = pal.ink;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y - s / 2 + 0.5, s - 1, s - 1);
  };
  // 1：紙・墨・印の赤と、薄い灰の文字 → 濃い灰（計画の調整）
  alpha(c, row(1), () => {
    const y = iy + rowH * 1.5, s = Math.max(4, Math.min(rowH * 0.74, iw * 0.13)), sg = Math.max(2, s * 0.22);
    let x = ix;
    for (const col of [SW.paper, SW.ink, SW.seal]) { sw(x, y, s, col); x += s + sg; }
    x += s * 0.45;
    sw(x, y, s, SW.ash);
    if (adj > 0) {
      c.strokeStyle = pal.seal;
      c.lineWidth = Math.max(1.2, u * 0.08);
      c.beginPath();
      c.moveTo(x - 1, y + s / 2 + 1);
      c.lineTo(x - 1 + (s + 2) * adj, y + s / 2 + 1 - (s + 2) * adj);
      c.stroke();
      alpha(c, adj, () => {
        triangle(c, x + s + sg * 1.4, y, s * 0.6, 0, pal.ink);
        sw(x + s + sg * 2.6, y, s, SW.adjusted);
      });
    }
  });
  // 2：明朝とゴシック、ラベル 10–11px → 14px（計画の調整）
  alpha(c, row(2), () => {
    const y = iy + rowH * 2.5, size = Math.min(f.small, rowH * 1.05);
    let x = ix;
    x += drawText(c, '明', x, y, {size, weight: 600, family: FONT.mincho, color: pal.ink}) + 2;
    x += drawText(c, 'ゴ', x, y, {size, color: pal.ink}) + gap;
    const ts = Math.min(f.tiny, rowH * 1.0);
    if (adj < 1) alpha(c, 1 - adj, () => drawText(c, '10–11px', x, y, {size: ts, color: pal.muted, max: right(r) - pad - x}));
    if (adj > 0) {
      alpha(c, adj, () => {
        const w1 = drawText(c, '11', x, y, {size: ts, color: pal.muted});
        hline(c, x - 1, x + w1 + 1, y, pal.seal, Math.max(1.1, u * 0.07));
        drawText(c, '→14px', x + w1 + 1, y, {size: ts, weight: 700, color: pal.ink, max: right(r) - pad - x - w1 - 1});
      });
    }
  });
  // 3：罫線の行と、縦の要素1か所
  alpha(c, row(3), () => {
    const y = iy + rowH * 3.5;
    hline(c, ix, ix + iw * 0.78, y - rowH * 0.2, pal.rule, 1);
    hline(c, ix, ix + iw * 0.78, y + rowH * 0.2, pal.rule, 1);
    c.strokeStyle = pal.ink;
    c.lineWidth = Math.max(1.4, u * 0.1);
    c.beginPath();
    c.moveTo(ix + iw * 0.92, y - rowH * 0.42);
    c.lineTo(ix + iw * 0.92, y + rowH * 0.42);
    c.stroke();
  });
}

function drawPage(c, L, p, d, pal) {
  const r = L.n.page, {f, gap, u} = L;
  drawSheet(c, r, pal, u);
  const pad = gap * 1.1, headH = f.label * 1.45;
  const hw = drawText(c, 'コード', r.x + pad, r.y + pad + headH / 2, {size: f.label, weight: 700, color: pal.ink, max: r.w - pad * 2});
  const sx = r.x + pad + hw + gap, room = right(r) - pad - r.w * 0.12 - sx;
  if (room > f.tiny * 4) drawText(c, 'HTML/CSS/JS', sx, r.y + pad + headH / 2, {size: f.tiny, color: pal.muted, max: room});
  const ready = prog(p.code, 0.3, 1);
  const ix = r.x + pad, iy = r.y + pad + headH, iw = r.w - pad * 2, ih = bottom(r) - pad - iy;
  // コードの線（藍）
  const codeH = ih * 0.4, lh = codeH / 3;
  [0.78, 0.52, 0.66].forEach((fr, i) => {
    const k = prog(ready, i * 0.12, i * 0.12 + 0.35);
    if (k <= 0) return;
    c.fillStyle = pal.ai;
    c.fillRect(ix + (i === 1 ? iw * 0.1 : 0), iy + lh * (i + 0.5) - Math.max(1.2, lh * 0.16), iw * fr * k, Math.max(2, lh * 0.32));
  });
  // 6件の行の下書き（同じ6色の目印）
  const top = iy + codeH + ih * 0.06, rh = (bottom(r) - pad - top) / 6;
  d.rows.forEach((ev, i) => {
    const k = prog(ready, 0.4 + i * 0.08, 0.6 + i * 0.08);
    if (k <= 0) return;
    alpha(c, k, () => {
      c.fillStyle = pal.rows[ev.color];
      c.fillRect(ix, top + i * rh + rh * 0.18, Math.max(2, iw * 0.06), rh * 0.64);
      hline(c, ix + iw * 0.1, ix + iw * (0.1 + 0.9 * k), top + (i + 1) * rh - 0.5, pal.rule, 0.9);
    });
  });
}

function drawOperator(c, L, p, d, pal) {
  const r = L.n.operator, {f, gap, u} = L;
  const act = prog(p.check, 0.3, 0.42) * (1 - prog(p.check, 0.62, 0.75));
  c.fillStyle = pal.opSoft;
  alpha(c, 0.45 + 0.55 * act, () => { rr(c, r.x, r.y, r.w, r.h, 2); c.fill(); });
  rr(c, r.x, r.y, r.w, r.h, 2);
  c.strokeStyle = pal.op;
  c.lineWidth = Math.max(1.5, u * 0.11) * (1 + act * 0.6);
  c.stroke();
  const sub = `Node ${d.counts.original_Node_checks}条件・実画面`;
  const pad = gap * 1.1;
  if (r.h > f.label * 2.7) {
    drawText(c, '制作担当が確認', r.x + pad, r.y + r.h * 0.33, {size: f.label, weight: 700, color: pal.ink, max: r.w - pad * 2});
    drawText(c, sub, r.x + pad, r.y + r.h * 0.72, {size: f.tiny, color: pal.ink, max: r.w - pad * 2});
  } else {
    drawText(c, '制作担当が確認', r.x + pad, midY(r), {size: f.label, weight: 700, color: pal.ink, max: r.w - pad * 2});
    const x = right(r) + gap * 1.4;
    drawText(c, sub, x, midY(r), {size: f.tiny, color: pal.muted, max: L.W - x - gap});
  }
}

// 選ばれた行の重み（id → 0..1）と、選ばれていない行を薄くする度合い
function pickState(p, d) {
  const picks = p.picks || [{preset: p.preset, w: 1}];
  const w = {};
  let dim = 0;
  for (const x of picks) {
    const job = d.jobs[x.preset];
    if (!job || x.w <= 0) continue;
    for (const id of job.ids) w[id] = Math.max(w[id] || 0, x.w);
    if (x.preset !== 'all') dim = Math.max(dim, x.w);
  }
  return {w, dim};
}

function drawRows(c, L, p, d, pal) {
  const {f, gap, u} = L, RW = L.n.rows;
  hline(c, RW.x, right(RW), RW.y, pal.ink, Math.max(1.3, u * 0.09));
  L.rows.forEach((R) => hline(c, R.x, right(R), bottom(R) - 0.5, pal.line, 1));
  const {w: picked, dim} = pickState(p, d);
  const end = L.e.deliver[L.e.deliver.length - 1];
  const titleSize = L.kind === 'wide' ? f.small : f.tiny;
  d.rows.forEach((ev, i) => {
    const R = L.rows[i];
    const k = stagger(p.unfold, i, 6, 0.5);
    if (k <= 0) return;
    const w = picked[ev.id] || 0;
    // 選ばれなかった行も、題名が読める濃さ（6割）に残す
    alpha(c, k * (1 - 0.4 * dim * (1 - w)), () => {
      const y = lerp(end[1] - R.h / 2, R.y, ease(k));
      if (w > 0) alpha(c, 0.16 * w, () => { c.fillStyle = pal.rows[ev.color]; c.fillRect(R.x, y, R.w, R.h - 1); });
      const tabW = Math.max(3, f.tiny * 0.32) * (1 + 0.7 * w);
      c.fillStyle = pal.rows[ev.color];
      c.fillRect(R.x, y + R.h * 0.14, tabW, R.h * 0.72);
      const cyRow = y + R.h / 2;
      let x = R.x + tabW + gap;
      x += drawText(c, `${ev.day}日`, x, cyRow, {size: Math.min(f.small, R.h * 0.72), weight: 700, family: FONT.mincho, color: pal.ink});
      if (R.w > f.small * 20) x += drawText(c, `（${ev.wk}）`, x, cyRow, {size: Math.min(f.tiny, R.h * 0.66), color: pal.muted});
      drawText(c, ev.title, x + gap * 0.8, cyRow, {size: Math.min(titleSize, R.h * 0.7), color: pal.ink, max: right(R) - x - gap * 1.6});
    });
  });
}

// 結果の欄：条件の欄 → 件数と選ばれた行の札 → 参加方法を開く → JSON・実UI
function trayGeo(c, L, job) {
  const T = L.n.tray, {f, gap} = L;
  const pad = gap, x0 = T.x + pad, w = T.w - pad * 2;
  const base = [f.small * 1.75, f.big * 1.35, f.tiny * 1.45, f.small * 1.45, f.small * 1.8];
  const sum = base.reduce((a, b) => a + b, 0);
  const room = T.h - pad * 2;
  const sc = Math.min(1, (room - 4) / sum);
  const g = Math.max(1, (room - sum * sc) / 4);
  let y = T.y + pad;
  const rows = base.map((h0) => { const h = h0 * sc; const r = {x: x0, y, w, h}; y += h + g; return r; });
  c.font = `700 ${f.big}px ${FONT.mincho}`;
  const countW = c.measureText(`${job.count}件`).width;
  const m = job.ids.length, cg = Math.max(2, gap * 0.5);
  const chipH = Math.min(rows[1].h * 0.8, f.small * 1.4);
  const chipW = Math.max(4, Math.min(f.small * 2.3, (w - countW - gap - (m - 1) * cg) / m));
  const slots = job.ids.map((_, j) => ({x: x0 + countW + gap + j * (chipW + cg), y: midY(rows[1]) - chipH / 2, w: chipW, h: chipH}));
  return {rows, slots, x0, w};
}
const trayOf = (p) => p.tray || {preset: p.preset, a: 1};
const chipsOf = (p) => p.chips || {preset: p.preset, k: 1};

function drawTray(c, L, p, d, pal) {
  const T = L.n.tray, {f, gap, u} = L;
  c.fillStyle = pal.sheet;
  rr(c, T.x, T.y, T.w, T.h, 2);
  c.fill();
  c.strokeStyle = pal.rule;
  c.lineWidth = 1;
  c.stroke();
  hline(c, T.x, right(T), T.y, pal.ink, Math.max(1.3, u * 0.09));
  const tray = trayOf(p), job = d.jobs[tray.preset];
  if (!job) return;
  alpha(c, tray.a, () => {
    const G = trayGeo(c, L, job), [r0, r1, r2, r3, r4] = G.rows;
    // 条件の欄（ネイティブの select か検索欄の形）
    const lw = drawText(c, job.control.kind, G.x0, midY(r0), {size: f.tiny, weight: 700, color: pal.muted});
    const bx = G.x0 + lw + gap * 0.8, bw = right(r0) - bx, bh = Math.min(r0.h, f.small * 1.6);
    c.strokeStyle = pal.ink;
    c.lineWidth = 1;
    rr(c, bx, midY(r0) - bh / 2, bw, bh, 2);
    c.stroke();
    const tri = job.control.select ? f.tiny * 0.9 : 0;
    drawText(c, job.control.value, bx + gap, midY(r0), {size: f.small, color: pal.ink, max: bw - gap * 2 - tri});
    if (tri) triangle(c, right(r0) - gap - tri * 0.4, midY(r0), tri, Math.PI / 2, pal.ink);
    // 件数と、着いた札
    const ch = chipsOf(p), ck = ch.preset === tray.preset ? ch.k : 0;
    alpha(c, prog(ck, 0.5, 1), () => drawText(c, `${job.count}件`, G.x0, midY(r1), {size: f.big, weight: 700, family: FONT.mincho, color: pal.ink}));
    job.ids.forEach((id, j) => {
      if (stagger(ck, j, job.ids.length, 0.4) < 1) return;
      const ev = d.rows.find((x) => x.id === id);
      drawChip(c, G.slots[j], pal.rows[ev.color], String(ev.day), pal, f);
    });
    // 参加方法を開く（details の三角が回る）
    const first = job.picked[0], op = clamp01(p.open);
    triangle(c, G.x0 + f.tiny * 0.4, midY(r2), f.tiny * 0.85, (Math.PI / 2) * op, pal.ink);
    drawText(c, '参加方法', G.x0 + f.tiny * 1.1, midY(r2), {size: f.tiny, weight: 700, color: pal.ink, max: G.w - f.tiny * 1.1});
    alpha(c, op, () => {
      c.fillStyle = pal.rows[first.color];
      c.fillRect(G.x0 + f.tiny * 0.25, r3.y + r3.h * 0.15, Math.max(2, f.tiny * 0.25), r3.h * 0.7);
      drawText(c, first.participation, G.x0 + f.tiny * 1.1, midY(r3), {size: f.small, color: pal.ink, max: G.w - f.tiny * 1.1});
    });
    // 使える出力：保存した実結果（JSON）と実際の一覧（実UI）
    alpha(c, easeOut(p.out), () => {
      const s = 0.86 + 0.14 * easeOut(p.out), h = Math.min(r4.h, f.small * 1.65) * s, y = midY(r4) - h / 2;
      c.font = `700 ${f.tiny}px ${FONT.sans}`;
      const w1 = c.measureText('JSON').width + gap * 2.2, w2 = c.measureText('実UI').width + gap * 2.2;
      c.strokeStyle = pal.seal;
      c.lineWidth = Math.max(1.4, u * 0.1);
      rr(c, G.x0, y, w1, h, 2);
      c.stroke();
      drawText(c, 'JSON', G.x0 + w1 / 2, y + h / 2, {size: f.tiny, weight: 700, color: pal.seal, align: 'center'});
      const x2 = G.x0 + w1 + gap;
      c.fillStyle = pal.ink;
      rr(c, x2, y, w2, h, 2);
      c.fill();
      drawText(c, '実UI', x2 + w2 / 2, y + h / 2, {size: f.tiny, weight: 700, color: pal.onInk, align: 'center'});
    });
  });
}

// 動く同じ形：本と依頼の写し、計画の紙、戻る紙、コードの紙、確認を通る紙、行の札
function drawTokens(c, L, p, d, pal) {
  const {f, u, ai, n, e, books} = L;
  const toAi = [ai.cx, ai.cy];
  if (p.give > 0 && p.give < 1) {
    const covers = {core: pal.ink, style: pal.sheet, type: pal.faint, access: pal.faint, copy: pal.faint};
    BOOK_KEYS.forEach((key, i) => {
      const k = stagger(p.give, i, 6, 0.45);
      if (k <= 0 || k >= 1) return;
      const src = key === 'style' && p.styleOpen > 0.5 ? books.open : books.rect(key, p.spread);
      const q = ease(k), pt = pointAt([ctr(src), ...e.giveBooks, toAi], q), s = lerp(1, 0.4, q);
      const w = Math.min(src.w, f.label * 1.4) * s, h = Math.min(src.h, f.label * 2.4) * s;
      alpha(c, 1 - prog(k, 0.8, 1), () => {
        c.fillStyle = covers[key];
        rr(c, pt.x - w / 2, pt.y - h / 2, w, h, 2);
        c.fill();
        c.strokeStyle = key === 'style' ? pal.seal : pal.ink;
        c.lineWidth = 1.2;
        c.stroke();
      });
    });
    const k = stagger(p.give, 5, 6, 0.45);
    if (k > 0 && k < 1) {
      const R = n.request, q = ease(k), pt = pointAt([ctr(R), ...e.giveReq, toAi], q), s = lerp(1, 0.35, q);
      const w = Math.min(R.w * 0.6, f.label * 4.5) * s, h = Math.min(R.h * 0.5, f.label * 2.4) * s;
      alpha(c, 1 - prog(k, 0.8, 1), () => {
        const r = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
        c.fillStyle = pal.sheet;
        rr(c, r.x, r.y, w, h, 2);
        c.fill();
        c.strokeStyle = pal.ink;
        c.lineWidth = 1.2;
        c.stroke();
        const ts = Math.max(1.5, (w * 0.8) / 8);
        d.rows.forEach((ev, j) => { c.fillStyle = pal.rows[ev.color]; c.fillRect(r.x + w * 0.1 + j * ts * 1.3, r.y + h * 0.6, ts, ts); });
      });
    }
  }
  // AIから出て、決まった場所へ広がる紙
  const fly = (k, to, kind) => {
    if (k <= 0 || k >= 1) return;
    const from = {x: ai.cx - to.w * 0.15, y: ai.cy - to.h * 0.15, w: to.w * 0.3, h: to.h * 0.3};
    miniSheet(c, lerpRect(from, to, ease(k)), pal, u, kind);
  };
  fly(prog(p.plan, 0, 0.3), n.plan, 'plan');
  // 同じ計画の紙が、同じAIへ戻る（次の執筆の入力）
  if (p.back > 0 && p.back < 1) {
    const q = ease(p.back), pt = pointAt([ctr(n.plan), ...e.back, toAi], q);
    const w = lerp(n.plan.w * 0.55, n.plan.w * 0.2, q), h = lerp(n.plan.h * 0.55, n.plan.h * 0.2, q);
    alpha(c, 1 - prog(p.back, 0.85, 1), () => miniSheet(c, {x: pt.x - w / 2, y: pt.y - h / 2, w, h}, pal, u, 'plan'));
  }
  fly(prog(p.code, 0, 0.3), n.page, 'code');
  // 確認：同じ画面の紙が制作担当を通り、行の位置へ（「記録」の札。品質の印ではない）
  if (p.check > 0 && p.unfold < 1) {
    const PG = n.page, OP = n.operator, k = p.check;
    let pt, s;
    if (k < 0.4) { const q = ease(prog(k, 0, 0.4)); pt = pointAt([ctr(PG), ...e.check, ctr(OP)], q); s = lerp(1, 0.75, q); }
    else if (k < 0.65) { pt = {x: midX(OP), y: midY(OP)}; s = 0.75; }
    else { pt = pointAt([ctr(OP), ...e.deliver], ease(prog(k, 0.65, 1))); s = 0.75; }
    const h = Math.min(PG.h * 0.5, OP.h * 1.6) * s, w = Math.min(PG.w * 0.42, h * 0.85);
    alpha(c, 1 - prog(p.unfold, 0, 0.35), () => {
      const r = {x: pt.x - w / 2, y: pt.y - h / 2, w, h};
      miniSheet(c, r, pal, u, 'list');
      if (k > 0.62) {
        alpha(c, prog(k, 0.62, 0.72), () => {
          c.font = `700 ${f.tiny}px ${FONT.sans}`;
          const tw = c.measureText('記録').width + 6, th = f.tiny * 1.35;
          c.fillStyle = pal.op;
          rr(c, right(r) - tw * 0.4, r.y - th * 0.6, tw, th, 2);
          c.fill();
          drawText(c, '記録', right(r) - tw * 0.4 + tw / 2, r.y - th * 0.6 + th / 2, {size: f.tiny, weight: 700, color: pal.onInk, align: 'center'});
        });
      }
    });
  }
  // 選ばれた行の札が、同じ色のまま結果の欄へ
  const tray = trayOf(p), ch = chipsOf(p), job = d.jobs[ch.preset];
  if (job && ch.preset === tray.preset && ch.k > 0 && ch.k < 1 && tray.a > 0) {
    const G = trayGeo(c, L, job);
    alpha(c, tray.a, () => job.ids.forEach((id, j) => {
      const kj = stagger(ch.k, j, job.ids.length, 0.4);
      if (kj <= 0 || kj >= 1) return;
      const ev = d.rows.find((x) => x.id === id), R = L.rows[ev.color];
      const from = {x: R.x, y: R.y + R.h * 0.14, w: Math.max(3, f.tiny * 0.55), h: R.h * 0.72};
      drawChip(c, lerpRect(from, G.slots[j], ease(kj)), pal.rows[ev.color], String(ev.day), pal, f);
    }));
  }
}

function focusRect(L, key) {
  const b = L.books;
  if (key === 'bookCore') return b.rect('core', 1);
  if (key === 'bookStyle') return b.open;
  if (key === 'bookType') return b.rect('type', 1);
  if (key === 'bookAccess') return b.rect('access', 1);
  if (key === 'bookCopy') return b.rect('copy', 1);
  if (key === 'ai') return {x: L.ai.cx - L.ai.r, y: L.ai.cy - L.ai.r, w: L.ai.r * 2, h: L.ai.r * 2};
  return L.n[key];
}
function focusBox(c, L, r, pal) {
  const pad = Math.max(3, L.gap * 0.8);
  rr(c, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 3);
  c.strokeStyle = pal.seal;
  c.lineWidth = Math.max(2.5, L.u * 0.16);
  c.stroke();
}
function flowColor(kind, pal) {
  return kind === 'ai' ? pal.ai : kind === 'op' ? pal.op : pal.seal;
}

export function drawConcept(c, L, p, d, pal) {
  const show = (k) => clamp01(val(p.show, k, 1));
  const A = (k) => show(k) * val(p.emph, k, 1);
  FLOOR = 11;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  drawBands(c, L, p, pal);
  for (const key of ALL_EDGES) {
    const k = val(p.draw, key, 1);
    if (k <= 0.001) continue;
    const kind = EDGE_KIND[key];
    alpha(c, val(p.emphEdge, EDGE_STAGE[key], 1), () => {
      strokePath(c, L.e[key], k, {color: pal.muted, width: Math.max(1.3, L.u * 0.09), head: Math.max(5, L.u * 0.38)});
      const fl = Math.min(k, val(p.flow, key, 0));
      if (fl > 0) strokePath(c, L.e[key], fl, {color: flowColor(kind, pal), width: Math.max(2.4, L.u * 0.17), head: Math.max(6.5, L.u * 0.48)});
    });
  }
  alpha(c, A('books'), () => drawBooks(c, L, p, pal));
  alpha(c, A('request'), () => drawRequest(c, L, p, d, pal));
  alpha(c, A('ai'), () => drawAI(c, L, p, pal));
  alpha(c, A('plan'), () => drawPlan(c, L, p, pal));
  alpha(c, A('page'), () => drawPage(c, L, p, d, pal));
  alpha(c, A('operator'), () => drawOperator(c, L, p, d, pal));
  alpha(c, A('rows'), () => drawRows(c, L, p, d, pal));
  alpha(c, A('tray'), () => drawTray(c, L, p, d, pal));
  drawTokens(c, L, p, d, pal);
  if (p.focusPart && PART_NODES[p.focusPart]) for (const k of PART_NODES[p.focusPart]) focusBox(c, L, focusRect(L, k), pal);
  c.restore();
  FLOOR = 0;
}

// ---------- 文（ページと動画で共通） ----------
const fmtIds = (list) => (list.length ? list.join('・') : 'なし');
const eventLine = (ev) => `${ev.dateText}（${ev.wk}）${ev.start}〜${ev.end}　${ev.title}・${ev.place}・${ev.participation}`;
export function describeMap(d, id) {
  const j = d.jobs[id], first = j.picked[0];
  return `図の内容：3段の「渡す」に、共通の本（design-taste）、開いた表現の本（japanese-minimal：紙・墨・印の赤、明朝、縦の線1本）、細い補助の本3冊（文字 taste-typography・操作 taste-accessibility・文言 taste-ux-copy）と、依頼の札「誰に／何を／催し${d.rows.length}件」。`
    + 'どちらも同じ1つのAIへ合流します。「組み立てる」では、AIがまず「方針一行」の紙を書き（紙・墨・印の赤の色見本、薄い灰の文字→濃い灰、明朝とゴシック、10–11px→14px、罫線と縦の線）、'
    + '同じ紙が同じAIへ戻って、次の執筆でコード（HTML/CSS/JS）の紙になります。コードの紙は「制作担当が確認」'
    + `（Node ${d.counts.original_Node_checks}条件・実画面）を通り、「記録」の札が付きます。「使う」で同じ紙が${d.rows.length}件の罫線の行に開きます。`
    + `いまの条件（${j.conditionText}）：${fmtIds(j.ids)} の${j.count}件の行が選ばれ、同じ色の札が結果の欄へ移り、${first.title} の参加方法「${first.participation}」が開き、JSON と実UI の札が出ます。`;
}
export function stageNote(d, id, i) {
  const j = d.jobs[id];
  if (i === 0) return `渡す：5冊の指針（共通1・表現1・補助3）と依頼（誰に・何を・催し${d.rows.length}件）を、同じ1つのAIが読みます。本はAIが読むMarkdownで、実行する道具やAPIではありません。`;
  if (i === 1) return `組み立てる：AIはまず方針一行と計画（design-plan.md）を書き、別の執筆でその計画を使ってHTML/CSS/JSを書きました。Nodeの${d.counts.original_Node_checks}条件と実画面の確認は、制作担当が別の工程で行いました。品質や人の承認の保証ではありません。`;
  return `使う：完成した一覧の${d.rows.length}件の行から、${j.conditionText}で ${fmtIds(j.ids)} の${j.count}件。このページで同じ events.mjs の filterEvents を呼んだ結果で、保存した結果と一致しました。予約・送信・保存はしません。`;
}
export function recordRows(d, id) {
  const j = d.jobs[id];
  return [
    ['条件', j.conditionText],
    ['記録', `${j.path}（${j.bytes} B）：元の results.json の ${id} をそのまま包んだもの`],
    ['件数', `${j.count}件（${fmtIds(j.ids)}）`],
    ['催し', j.picked.map(eventLine)],
    ['照合', 'このページで呼んだ filterEvents の結果・results.json・samples.json・この記録の4つで、IDと順序が同じ'],
  ];
}
export function summaryItems(d) {
  return [
    ['本', `共通の指針 design-taste／表現を1つ japanese-minimal／補助の指針 taste-typography・taste-accessibility・taste-ux-copy。固定版の${d.counts.upstream_skills}のスキルから${d.counts.selected_skills}つを、AIが読むMarkdownとして渡す。`],
    ['依頼', `誰に：近所の親子・おとな・来館者。何を：探す→日時を読む→参加方法を開く。催し${d.rows.length}件：架空の余白図書室の合成データ（input.md）。`],
    ['AIの方針', `同じAIがまず計画（design-plan.md）を書いた。方針一行：${d.designRead}`],
    ['コード', 'その計画を使う別の執筆で、一覧のHTML/CSS/JS（いまの desk.html・app.mjs・events.mjs・style.css）を書いた。'],
    ['制作担当', `Nodeで${d.counts.original_Node_checks}条件、ブラウザーで実画面を、別の工程で確かめた。確かめた範囲の記録で、品質や人の承認ではない。`],
    ['実際の一覧', `${d.rows.length}件の行を対象と語句で絞り、参加方法を開ける。訪れた人の操作はブラウザーの中の計算だけで、AIは動かない。予約・送信・保存はない。`],
  ];
}

// ---------- ページ ----------
const THEME_KEY = 'studio-yebisu.design-taste-example.theme';
const SPEED = [2.6, 3.8, 3.0];
const tauToTime = (x) => { let t = 0; for (let i = 0; i < 3; i++) t += clamp01(x - i) * SPEED[i]; return t; };
const timeToTau = (t) => { let x = 0; for (let i = 0; i < 3; i++) { if (t <= SPEED[i]) return x + t / SPEED[i]; t -= SPEED[i]; x += 1; } return 3; };
// 元の記事の #all・#children・#reading はそのままの条件で開く。#events（以前の一覧の場所）は「すべて」。
const hashPreset = (hash) => {
  const x = String(hash || '').replace(/^#/, '');
  return PRESET_IDS.includes(x) ? x : x === 'events' ? 'all' : null;
};

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

// 利用者が押したときだけコピーする。書き込みが終わってから成功を伝え、どちらの方法もだめなら false。
async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* 下の方法で試す */ }
  }
  const tmp = h('textarea', {class: 'offscreen', readonly: true, 'aria-hidden': 'true', tabindex: '-1'});
  tmp.value = text;
  document.body.append(tmp);
  tmp.select();
  tmp.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  tmp.remove();
  return ok;
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
  const deskA = $('open-desk'), recordA = $('save-record');
  const dynLinks = [deskA, recordA];
  const dependents = () => document.querySelectorAll('button[data-stage], #replay, button[data-preset], button[data-part], #copy-request');
  const readouts = ['stage-note', 'map-desc', 'map-summary', 'record-meta', 'record-content', 'record-path', 'part-label', 'part-meaning', 'part-quote',
    'part-source', 'part-local', 'copy-status', 'probes', 'adjustments'];
  const presetLabels = Object.fromEntries([...document.querySelectorAll('button[data-preset]')].map((b) => [b.dataset.preset, b.textContent]));

  let data = null;
  let caseId = hashPreset(location.hash) || 'children';
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

  // 3つの条件：主な操作・保存リンク・読み出しを、選んだ条件にそろえる（どれも照合済みのパスだけ）
  function setLink(a, href, download) {
    a.setAttribute('href', href);
    if (download) a.setAttribute('download', download); else a.removeAttribute('download');
    a.removeAttribute('aria-disabled');
  }
  function clearLink(a) {
    a.removeAttribute('href');
    a.removeAttribute('download');
    a.removeAttribute('aria-label');
    a.setAttribute('aria-disabled', 'true');
  }
  function renderCase() {
    const job = data.jobs[caseId];
    document.querySelectorAll('button[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === caseId)));
    setLink(deskA, job.desk);
    deskA.setAttribute('aria-label', `実際の一覧を使う（${job.conditionText}で開く）`);
    setLink(recordA, job.path, job.download);
    recordA.setAttribute('aria-label', `実結果を保存（${job.path}、${job.bytes} B）`);
    $('stage-note').textContent = stageNote(data, caseId, stage);
    $('map-desc').textContent = describeMap(data, caseId);
    $('record-meta').replaceChildren(...recordRows(data, caseId).map(([k, v]) => h('div', {}, h('dt', {}, k),
      h('dd', {}, Array.isArray(v) ? h('ul', {class: 'event-lines'}, v.map((x) => h('li', {}, x))) : v))));
    $('record-path').textContent = `（${job.path}）`;
    $('record-content').textContent = job.body;
    $('copy-status').textContent = '';
  }
  function selectCase(id, push) {
    if (!data || !PRESET_IDS.includes(id)) return;
    caseId = id;
    if (push && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    renderCase();
    // 使う段階では、行は開いたまま、選ぶ動きだけをもう一度
    if (stage === 2) animate(2.3, 3); else draw();
  }
  document.querySelectorAll('button[data-preset]').forEach((b) => b.addEventListener('click', () => selectCase(b.dataset.preset, true)));
  window.addEventListener('hashchange', () => {
    const id = hashPreset(location.hash);
    if (!id) return;
    if (data) { if (id !== caseId) selectCase(id, false); } else caseId = id;
  });

  // 6つの部分
  function renderPart() {
    const x = data && part ? data.parts.find((y) => y.id === part) : null;
    $('part-label').textContent = x ? x.label : '';
    $('part-meaning').textContent = x ? x.meaning : '';
    $('part-quote').textContent = x ? x.quote : '';
    $('part-quote-box').setAttribute('lang', x && !x.upstream ? 'ja' : 'en');
    $('part-source').replaceChildren(...(x
      ? (x.lineUrl
        ? [h('a', {href: x.lineUrl, rel: 'noopener'}, `GitHub の固定版 ${x.upstream} の${x.line_start}行目`)]
        : ['原典ではなく、元のAIが書いた計画です：', h('a', {href: x.source_path}, x.source_path), `（${x.line_start}行目）`])
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

  // 固定の記録：条件の名札・部分の名札・流れの要約・調整・決まりの例
  function renderFixed() {
    document.querySelectorAll('button[data-preset]').forEach((b) => { const j = data.jobs[b.dataset.preset]; if (j) b.textContent = j.short; });
    document.querySelectorAll('button[data-part]').forEach((b) => { const x = data.parts.find((y) => y.id === b.dataset.part); if (x) b.textContent = x.label; });
    $('map-summary').replaceChildren(...summaryItems(data).map(([k, v]) => h('li', {}, h('strong', {}, k), v)));
    $('adjustments').replaceChildren(...data.adjustments.map((a) => h('div', {}, h('dt', {}, `${a.source}：${a.original}`), h('dd', {}, `計画で ${a.applied}（${a.reason}）`))));
    $('probes').replaceChildren(...data.probes.map((x) => h('li', {}, h('span', {class: 'probe-q'}, x.shown),
      ` → ${x.ids.length}件（${fmtIds(x.ids)}）：${x.note}${x.fromValidation ? '。元の検査の保存結果とも同じ' : ''}`)));
  }

  // 依頼文のコピー（失敗したら読み取り専用の欄を選んだ状態にして伝える）
  $('copy-request').addEventListener('click', async () => {
    if (!data) return;
    const gen = loadGen;
    const out = $('copy-status'), area = $('request-text');
    out.textContent = '';
    const ok = await copyText(data.request);
    if (!data || gen !== loadGen) return;
    if (ok) { out.textContent = 'request.txt の依頼文をコピーしました。【】の部分を自分の催しと条件に書き換えてください。'; return; }
    out.textContent = 'コピーできませんでした。依頼文の欄を選んだ状態にしたので、端末の操作でコピーしてください。';
    area.focus();
    area.select();
  });

  // 読み込みと失敗
  function setDependents(on) {
    dependents().forEach((el) => { el.disabled = !on; });
    if (!on) for (const a of dynLinks) clearLink(a);
    if (!on) document.querySelectorAll('button[data-preset]').forEach((b) => { b.textContent = presetLabels[b.dataset.preset]; });
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
          setStatus(phase === 'assets' ? `素材 ${done}/${total} を照合しています…` : '照合した events.mjs で3つの条件を計算しています…', 'loading');
        },
      });
      if (gen !== loadGen) return;
      data = bundle;
      root.dataset.state = 'ready';
      setStatus(`素材${ASSET_COUNT}件の大きさとSHA-256を照合し、照合した events.mjs の filterEvents で3つの条件を計算して、保存した結果と同じIDと順序であることを確かめました。AIの実行はしていません。`, 'ready');
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

if (typeof document !== 'undefined' && document.documentElement.dataset.page === 'design-taste-concept') {
  applyStoredTheme();
  initPage();
}
