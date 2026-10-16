/* 点数と根拠を、セットで読む（Ragas 作例）— 28秒・無音の解説映像（編集できる元ページ）
 * Canvas 2D で、時刻 t の完成した画面を毎回最初から描く。前のフレーム・壁時計・乱数には依存しない。
 * 使う素材は、架空FAQの入力・Ragasの保存結果・評価の方法・ブラウザーで保存したJSON・実操作の記録・
 * 実画面の静止キャプチャ6枚とその記録の12ファイルだけ。全てSHA-256で照合してから描く。
 * 値・文・件数は読み込んだファイルから取り出す。照合メモは入力の記入で、Ragasの判定ではない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 28;
const POSTER_TIME = 13.5;
const LW = 1280, LH = 720; // 論理座標。実際の大きさへは等倍率で収め、余りは紙の色で埋める
const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
const evenSize = (v, fallback) => (Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0 ? v : fallback);
const WIDTH = evenSize(given.width, 1280);
const HEIGHT = evenSize(given.height, 720);
const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
window.motionConfig = {duration: DURATION, fps: FPS, width: WIDTH, height: HEIGHT, posterTime: POSTER_TIME, audioEvents: []};

const root = document.documentElement;
if (RENDER) root.classList.add('is-render');
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
const density = RENDER ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
canvas.width = Math.round(WIDTH * density);
canvas.height = Math.round(HEIGHT * density);
canvas.style.aspectRatio = WIDTH + ' / ' + HEIGHT;
if (RENDER) {
  canvas.style.width = WIDTH + 'px';
  canvas.style.height = HEIGHT + 'px';
}

// ---- 見た目（閲覧ページと同じ、温かい紙・墨・深い青緑・錆色） ------------------
const C = {
  paper: '#f5f0e6', card: '#fcf9f2', sunk: '#ece4d4', ink: '#25211c', muted: '#5b5348',
  rule: '#d9cfbd', strong: '#8a7b67', teal: '#15605b', tealSoft: '#dcebe7',
  rust: '#9b3f1d', rustSoft: '#f4dac6'
};
const METRIC_COLORS = [C.teal, C.rust, C.ink]; // 完全一致・文字列の近さ・基準文の包含
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", "Yu Gothic", Meiryo, system-ui, sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "BIZ UDMincho", serif';
const MONO = 'ui-monospace, "SFMono-Regular", Consolas, "BIZ UDGothic", monospace';

// ---- 素材 ------------------------------------------------------------------
// 照合表 assets/data-hashes.json 自体の SHA-256（runtime/frozen-reviewed-source.json の値）。
// 照合表の12ファイルのパスは作例フォルダーからの相対で、このモジュールの1つ上を基準に解決する。
// 書き出し時に <base href="video/"> が入っても import.meta.url 基準なので同じ場所を指す。
const HASH_MANIFEST = {path: 'assets/data-hashes.json', sha256: '5a6126a999ceb2e52b6755ee110307ccf9c3e794ff041e7acafdc5815ea90a20'};
const FILES = {
  'input/faq-pairs.json': {key: 'input', kind: 'json'},
  'outputs/evaluation.json': {key: 'evaluation', kind: 'json'},
  'outputs/method.md': {key: 'method', kind: 'text'},
  'outputs/browser-selection.json': {key: 'selection', kind: 'json'},
  'outputs/browser-record.json': {key: 'record', kind: 'json'},
  'video/assets/screen-manifest.json': {key: 'screens', kind: 'json'},
  'video/assets/desktop-Q07.png': {key: 'dQ07', kind: 'png'},
  'video/assets/desktop-Q08.png': {key: 'dQ08', kind: 'png'},
  'video/assets/desktop-Q05.png': {key: 'dQ05', kind: 'png'},
  'video/assets/phone-initial.png': {key: 'pInitial', kind: 'png'},
  'video/assets/phone-Q07.png': {key: 'pQ07', kind: 'png'},
  'video/assets/phone-Q08.png': {key: 'pQ08', kind: 'png'}
};
const SOURCE_REPO = 'vibrantlabsai/ragas';
const SOURCE_COMMIT = '298b68274234c060deacab3cf5fb52aa3a20e885';
const QUESTION_IDS = ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10'];
const DOC_IDS = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10'];
const STAGES = ['before', 'after'];
const METRIC_IDS = ['exact_match', 'string_similarity', 'string_presence'];
const LABELS = ['grounded', 'contradiction', 'unsupported_addition'];
const SELECTION_BYTES = 3396;        // 制作時の実操作で保存した nagi-faq-Q07.json の大きさ
const SELECTION_PREFIX = 'nagi-faq-'; // 閲覧ページが付ける保存名の頭

// 結果に保存された集計（丸めない値）。読み込んだ値がこれと違えば描かない
const EXPECT_SUMMARY = {
  case_count: 10,
  before: {mean: {exact_match: 0.4, string_similarity: 0.7884922267275208, string_presence: 0.4}, exact_match_count: 4, string_presence_count: 4},
  after: {mean: {exact_match: 0.7, string_similarity: 0.8835109447004609, string_presence: 0.8}, exact_match_count: 7, string_presence_count: 8}
};
// 映像で読む3問（入力の文字列と、実行結果の変更後の値）
const FOCUS = {
  Q07: {
    reference: '予約の取り消しは、受取予定日の前日18時までに連絡してください。',
    after: '予約の取り消しは、受取予定日の前日19時までに連絡してください。',
    label: 'contradiction',
    scores: {exact_match: 0, string_similarity: 0.96875, string_presence: 0}
  },
  Q08: {
    reference: '閉室中は入口の返却箱へ本を返せます。',
    after: '閉室中は入口の返却箱へ本を返せます。延滞しても連絡は不要です。',
    label: 'unsupported_addition',
    scores: {exact_match: 0, string_similarity: 0.5806451612903225, string_presence: 1}
  },
  Q05: {
    reference: '予約が入っていない本に限り、1回だけ7日間延長できます。',
    after: 'ほかの人の予約がない本は、あと7日だけ、1度延ばせます。',
    label: 'grounded',
    scores: {exact_match: 0, string_similarity: 0.2857142857142857, string_presence: 0}
  }
};
const Q08_ADDITION = '延滞しても連絡は不要です。';
const Q08_NOTE_SENTENCE = '資料からは真偽を断定できない。';
const Q05_CONDITIONS = ['予約なし', '1回', '7日間'];

// 実画面の切り抜き（画像の画素座標）と置き場所。倍率は縦横同じで、画素を伸ばさず、上に文字を重ねない。
// region はスクリーン記録のDOM範囲（全体撮影の都合で近似値）で、切り抜きがそれを含むことを確かめる
const CROPS = {
  phoneTop: {img: 'pInitial', x: 0, y: 0, w: 375, h: 520, at: {x: 80, y: 182, s: 0.86}},          // 見出し・検索・絞り込み・件数
  phoneSummary: {img: 'pInitial', x: 0, y: 528, w: 375, h: 284, at: {x: 800, y: 182, s: 1}},       // 10問の平均 変更前→変更後
  q07Answer: {img: 'dQ07', x: 635, y: 1996, w: 568, h: 240, at: {x: 662, y: 352, s: 0.945}, region: ['desktop-Q07.png', 'answer', 1]},
  q08Phone: {img: 'pQ08', x: 20, y: 176, w: 335, h: 350, at: {x: 860, y: 182, s: 1}},             // 変更後の回答と照合メモ（入力）
  q05Answer: {img: 'dQ05', x: 635, y: 1996, w: 568, h: 240, at: {x: 662, y: 352, s: 0.945}, region: ['desktop-Q05.png', 'answer', 1]},
  q07PhoneScores: {img: 'pQ07', x: 0, y: 378, w: 375, h: 322, at: {x: 760, y: 182, s: 1.15}}      // Ragasの計算結果（保存済み）
};

const CORE = '点数と根拠を、セットで読む。';
const FOOTER_SCOPE = '架空FAQの固定回答を比較／実結果を編集・無音';
const FOOTER_NOTE = '照合メモは入力・Ragasの判定ではありません';
const SOURCE_PIN = `${SOURCE_REPO} ${SOURCE_COMMIT.slice(0, 7)} ・ Apache-2.0`;
const SCENES = [
  {id: 'setup', start: 0, end: 4, headline: () => '同じ10問を、2組の回答で。'},
  {id: 'count', start: 4, end: 8, headline: f => `完全一致は${f.count.before}件→${f.count.after}件。`},
  {id: 'q07', start: 8, end: 14, headline: f => `一文字違いでも、${fmt3(f.q07.scores.string_similarity)}。`},
  {id: 'q08', start: 14, end: 19, headline: () => '全文が入っていても、追記は見ない。'},
  {id: 'q05', start: 19, end: 23, headline: () => '言い換えると、完全一致は0。'},
  {id: 'save', start: 23, end: 28, headline: () => '問いを選び、根拠ごと保存。'}
];
const CONTENT_TOP = 134, CONTENT_BOTTOM = 658;

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const enter = (t, at, dur = 0.45) => easeOut(prog(t, at, at + dur));
const rise = (t, at, dur = 0.45, px = 12) => px * (1 - enter(t, at, dur));
// 場面の切り替えは0.5秒の重ね合わせ。上の見出し行と足元の注記はいつも残す
const XF = 0.25;
function sceneAlpha(t, i) {
  const s = SCENES[i];
  const a = i === 0 ? 1 : easeInOut(prog(t, s.start - XF, s.start + XF));
  const b = i === SCENES.length - 1 ? 1 : 1 - easeInOut(prog(t, s.end - XF, s.end + XF));
  return Math.min(a, b);
}
const fmt3 = v => Number(v).toFixed(3);

// ---- 読み込みと確認 --------------------------------------------------------
const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
const check = (ok, message) => {
  if (!ok) throw new Error('記録の確認に失敗：' + message);
};
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return sameList(ka, kb) && ka.every(k => deepEqual(a[k], b[k]));
}

async function fetchVerified(url, label, expected) {
  let response;
  try {
    response = await fetch(url, {cache: 'no-store'});
  } catch {
    throw new Error(`${label} を読み込めません。file:// ではなくローカルサーバーで開いてください`);
  }
  if (!response.ok) throw new Error(`${label} が HTTP ${response.status} でした`);
  const bytes = await response.arrayBuffer();
  const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (digest !== expected) throw new Error(`${label} のSHA-256が制作記録と違います（${digest}）`);
  return {bytes, digest};
}
function decodeText(bytes) {
  let body = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  return body;
}
// 照合済みのバイト列だけから画像を作る（元の縦横比のまま）
async function decodePng(bytes, label) {
  try {
    return await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
  } catch {
    throw new Error(`${label} を画像として読み込めません`);
  }
}

async function loadAll() {
  const manifest = await fetchVerified(new URL(HASH_MANIFEST.path, import.meta.url), 'video/' + HASH_MANIFEST.path, HASH_MANIFEST.sha256);
  const table = JSON.parse(decodeText(manifest.bytes));
  const hashes = table && table.files;
  check(hashes && typeof hashes === 'object' && !Array.isArray(hashes), '照合表の形');
  const listed = Object.keys(hashes).sort();
  check(sameList(listed, Object.keys(FILES).sort()), `照合表のファイル（${listed.length}件）`);
  const data = {}, sizes = {}, verified = [];
  await Promise.all(listed.map(async path => {
    check(/^[A-Za-z0-9_\-/.]+$/.test(path) && !path.split('/').includes('..') && !path.startsWith('/'), `${path} のパス`);
    const expected = String(hashes[path]);
    check(/^[0-9a-f]{64}$/.test(expected), `${path} の照合値`);
    const {bytes, digest} = await fetchVerified(new URL('../' + path, import.meta.url), path, expected);
    const spec = FILES[path];
    sizes[path] = bytes.byteLength;
    if (spec.kind === 'png') data[spec.key] = await decodePng(bytes, path);
    else if (spec.kind === 'json') data[spec.key] = JSON.parse(decodeText(bytes));
    else data[spec.key] = decodeText(bytes);
    verified.push({path, digest});
  }));
  verified.sort((a, b) => a.path.localeCompare(b.path));
  check(verified.length === Object.keys(FILES).length, '照合したファイルの数');
  return {data, sizes, verified, hashes};
}

// 参照文と回答の、前後で一致しない範囲（コードポイント単位）
function diffRange(a, b) {
  const A = [...a], B = [...b];
  let p = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let s = 0;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  return {
    pre: A.slice(0, p).join(''),
    a: A.slice(p, A.length - s).join(''),
    b: B.slice(p, B.length - s).join(''),
    post: A.slice(A.length - s).join('')
  };
}

function buildFacts(d, hashes, sizes) {
  const {input: inp, evaluation: ev, method, selection: sel, record: rec, screens} = d;

  // 入力：作例のために書いた架空FAQ。資料10件・問い10件・固定回答20件・照合メモ
  check(inp.format === 'studio-yebisu-faq-fixture-v1' && inp.fictional === true, '入力の形式と架空の印');
  check(sameList((inp.documents || []).map(x => x.id), DOC_IDS), '資料10件のID');
  check(sameList((inp.cases || []).map(x => x.id), QUESTION_IDS), '問い10件のID');
  check(typeof inp.annotation_source === 'string' && inp.annotation_source.includes('Ragas') && inp.annotation_source.includes('ではなく'), '照合メモの出所の説明');
  check(deepEqual(Object.keys(inp.label_meanings || {}).sort(), [...LABELS].sort()), '照合メモのラベル3種');
  const docs = new Map(inp.documents.map(x => [x.id, x]));
  inp.cases.forEach((q, i) => {
    check(sameList(q.reference_document_ids, [DOC_IDS[i]]), `${q.id} の根拠資料`);
    check(q.reference === docs.get(DOC_IDS[i]).text, `${q.id} の参照文が資料本文と同じ`);
    STAGES.forEach(st => {
      check(q[st] && typeof q[st].response === 'string' && q[st].response.length > 0, `${q.id} ${st} の回答`);
      check(q[st].annotation && LABELS.includes(q[st].annotation.label) && typeof q[st].annotation.note === 'string', `${q.id} ${st} の照合メモ`);
    });
  });

  // 結果：固定版Ragasの3指標を60回呼んだ保存値。入力の20回答とメモがそのまま残っている
  check(ev.format === 'studio-yebisu-ragas-result-v1' && ev.fictional === true, '結果の形式と架空の印');
  check(ev.input_sha256 === hashes['input/faq-pairs.json'], '結果に書かれた入力のSHA-256');
  check(ev.source && ev.source.repository === SOURCE_REPO && ev.source.commit === SOURCE_COMMIT, '原典のコミット');
  const rt = ev.runtime || {};
  check(rt.metric_calls === 60 && Array.isArray(rt.network_attempts) && rt.network_attempts.length === 0 && rt.tracking_disabled === true, '呼び出し回数・通信の試み・送信停止の記録');
  check(sameList((ev.metrics || []).map(m => m.id), METRIC_IDS), '3指標');
  check(ev.annotation_source === inp.annotation_source && deepEqual(ev.label_meanings, inp.label_meanings), '照合メモの出所とラベルの意味');
  check(deepEqual(ev.documents, inp.documents), '結果の資料10件');
  check(Array.isArray(ev.rows) && sameList(ev.rows.map(r => r.id), QUESTION_IDS), '結果の10問');
  let scoreCount = 0;
  ev.rows.forEach((r, i) => {
    const q = inp.cases[i];
    check(r.question === q.question && r.reference === q.reference && sameList(r.reference_document_ids, q.reference_document_ids), `${r.id} の問いと参照文`);
    STAGES.forEach(st => {
      check(r[st].response === q[st].response && deepEqual(r[st].annotation, q[st].annotation), `${r.id} ${st} の回答と照合メモが入力と同じ`);
      check(r[st].scores && sameList(Object.keys(r[st].scores).sort(), [...METRIC_IDS].sort()), `${r.id} ${st} の3つの値`);
      METRIC_IDS.forEach(m => {
        const v = r[st].scores[m];
        check(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1, `${r.id} ${st} の ${m}`);
        scoreCount += 1;
      });
      // 完全一致と包含は、文字列そのものから同じ値になる
      check(r[st].scores.exact_match === (r[st].response === r.reference ? 1 : 0), `${r.id} ${st} の完全一致と文字列`);
      check(r[st].scores.string_presence === (r[st].response.includes(r.reference) ? 1 : 0), `${r.id} ${st} の包含と文字列`);
    });
  });
  check(scoreCount === rt.metric_calls && scoreCount === QUESTION_IDS.length * STAGES.length * METRIC_IDS.length, '値の数（10問×2回答×3指標）');
  check(deepEqual(ev.summary, EXPECT_SUMMARY), '平均と件数の保存値');
  STAGES.forEach(st => {
    METRIC_IDS.forEach(m => {
      const mean = ev.rows.reduce((sum, r) => sum + r[st].scores[m], 0) / ev.rows.length;
      check(Math.abs(mean - ev.summary[st].mean[m]) < 1e-12, `${st} の ${m} の平均`);
    });
    check(ev.rows.filter(r => r[st].scores.exact_match === 1).length === ev.summary[st].exact_match_count, `${st} の完全一致の件数`);
    check(ev.rows.filter(r => r[st].scores.string_presence === 1).length === ev.summary[st].string_presence_count, `${st} の包含の件数`);
  });
  const row = id => ev.rows.find(r => r.id === id);
  for (const [id, e] of Object.entries(FOCUS)) {
    const r = row(id);
    check(r.reference === e.reference && r.before.response === e.reference && r.before.scores.exact_match === 1, `${id} の参照文と変更前`);
    check(r.after.response === e.after && r.after.annotation.label === e.label && deepEqual(r.after.scores, e.scores), `${id} の変更後の回答・照合メモ・値`);
  }

  // 評価の方法：原典のコミットと、照合メモが自動の判定でも承認でもないこと
  check(method.includes(SOURCE_COMMIT) && method.includes('Ragasの自動意味判定や人承認ではありません'), '評価の方法の記録');

  // ブラウザーで実際に保存したJSON：結果のQ07の行・資料D07・3指標の定義をそのまま含む
  check(sizes['outputs/browser-selection.json'] === SELECTION_BYTES, '保存JSONの大きさ');
  check(sel.format === 'studio-yebisu-ragas-selection-v1' && sel.fictional === true, '保存JSONの形式と架空の印');
  check(sel.input_sha256 === ev.input_sha256 && deepEqual(sel.source, ev.source), '保存JSONの入力SHA-256と原典');
  check(deepEqual(sel.metrics, ev.metrics), '保存JSONの3指標の定義');
  check(sel.selected && sel.selected.id === 'Q07' && deepEqual(sel.selected, row('Q07')), '保存JSONの行が結果のQ07と同じ');
  check(deepEqual(sel.documents, [docs.get('D07')]), '保存JSONの根拠資料D07');
  check(sel.annotation_source === ev.annotation_source, '保存JSONの照合メモの出所');

  // 実操作の記録：保存JSONのSHA-256、初期表示と保存の状態
  check(rec.native_selection_sha256 === hashes['outputs/browser-selection.json'] && rec.source_and_scored_row_match === true, '実操作の記録と保存JSON');
  const state = label => (rec.states || []).find(s => s.label === label);
  const initial = state('initial');
  check(initial && initial.selected === 'Q07' && sameList(initial.ids, QUESTION_IDS) && initial.errorVisible === false, '記録 initial');
  const exported = state('export-Q07');
  check(exported && exported.selected === 'Q07' && exported.exportDisabled === false, '記録 export-Q07');

  // 実画面：記録の SHA-256・大きさ、切り抜きが画像の内側で、記録したDOM範囲を含むこと
  check(Array.isArray(screens.screens) && screens.screens.length === 6, '実画面の記録');
  const keyOf = file => FILES['video/assets/' + file] && FILES['video/assets/' + file].key;
  screens.screens.forEach(s => {
    const img = d[keyOf(s.file)];
    check(img && img.width === s.width && img.height === s.height, `${s.file} の大きさ`);
    check(s.sha256 === hashes['video/assets/' + s.file], `${s.file} のSHA-256`);
  });
  for (const [name, crop] of Object.entries(CROPS)) {
    const img = d[crop.img];
    check(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= img.width && crop.y + crop.h <= img.height, `${name} の切り抜き範囲`);
    const right = crop.at.x + crop.w * crop.at.s, bottom = crop.at.y + crop.h * crop.at.s;
    check(right <= 1200.5 && bottom <= CONTENT_BOTTOM, `${name} の置き場所`);
    if (crop.region) {
      const [file, selector, index] = crop.region;
      const regions = screens.screens.find(s => s.file === file).dom_capture.regions.filter(r => r.selector === selector);
      const r = regions[index];
      check(r && r.x >= crop.x && r.y >= crop.y && r.x + r.width <= crop.x + crop.w && r.y + r.height <= crop.y + crop.h, `${name} が ${selector} を含む`);
    }
  }

  // 映像に出す値（すべて読み込んだファイルから取り出す）
  const q7 = row('Q07'), q8 = row('Q08'), q5 = row('Q05');
  const d7 = diffRange(q7.reference, q7.after.response);
  const len7 = [...q7.reference].length;
  check([...d7.a].length === 1 && [...d7.b].length === 1 && [...q7.after.response].length === len7, 'Q07 は1字の置換');
  check(Math.abs(1 - 1 / len7 - q7.after.scores.string_similarity) < 1e-12, 'Q07 の近さが 1 − 1/文字数');
  const t7a = q7.reference.match(/\d+時/), t7b = q7.after.response.match(/\d+時/);
  check(t7a && t7b && t7a[0] !== t7b[0], 'Q07 の期限の時刻');
  check(q8.after.response.startsWith(q8.reference), 'Q08 の回答が参照文から始まる');
  const addition = q8.after.response.slice(q8.reference.length);
  check(addition === Q08_ADDITION && q8.after.annotation.note.includes(Q08_NOTE_SENTENCE), 'Q08 の追記と照合メモ');
  const conditions = q5.after.annotation.note.split('を保持')[0].split('・');
  check(sameList(conditions, Q05_CONDITIONS), 'Q05 の照合メモの3条件');
  const dropped = ev.rows.filter(r => r.before.scores.exact_match === 1 && r.after.scores.exact_match === 0).map(r => r.id);
  check(sameList(dropped, ['Q05', 'Q07', 'Q08']), '変更後に完全一致が0になった問い');

  return {
    img: d,
    title: inp.title,
    meanings: inp.label_meanings,
    docIds: inp.documents.map(x => x.id),
    qIds: ev.rows.map(r => r.id),
    rows: ev.rows,
    metrics: ev.metrics,
    calls: rt.metric_calls,
    count: {before: ev.summary.before.exact_match_count, after: ev.summary.after.exact_match_count, total: ev.summary.case_count},
    dropped,
    q07: {id: q7.id, doc: q7.reference_document_ids[0], reference: q7.reference, after: q7.after.response, d: d7, len: len7,
      refTime: t7a[0], afterTime: t7b[0], label: q7.after.annotation.label, scores: q7.after.scores},
    q08: {id: q8.id, doc: q8.reference_document_ids[0], reference: q8.reference, addition, addLen: [...addition].length,
      label: q8.after.annotation.label, scores: q8.after.scores},
    q05: {id: q5.id, doc: q5.reference_document_ids[0], reference: q5.reference, after: q5.after.response, conditions,
      label: q5.after.annotation.label, scores: q5.after.scores},
    saved: {
      filename: SELECTION_PREFIX + sel.selected.id + '.json',
      bytes: sizes['outputs/browser-selection.json'],
      rows: [
        ['selected.id', sel.selected.id],
        ['after.scores.exact_match', sel.selected.after.scores.exact_match],
        ['after.scores.string_similarity', sel.selected.after.scores.string_similarity],
        ['after.scores.string_presence', sel.selected.after.scores.string_presence],
        ['documents[0].id', sel.documents[0].id],
        ['fictional', sel.fictional]
      ]
    }
  };
}

// ---- 描画の部品 ------------------------------------------------------------
function font(o) {
  const family = o.family === 'serif' ? SERIF : o.family === 'mono' ? MONO : SANS;
  return `${o.weight || 400} ${o.size || 20}px ${family}`;
}
function text(c, s, x, y, o = {}) {
  c.save();
  c.font = font(o);
  c.fillStyle = o.color || C.ink;
  c.textAlign = o.align || 'left';
  c.textBaseline = 'alphabetic';
  c.fillText(s, x, y);
  c.restore();
}
function measure(c, s, o) {
  c.save();
  c.font = font(o);
  const w = c.measureText(s).width;
  c.restore();
  return w;
}
// 測った幅に収まるまで1pxずつ小さくする（下限あり）
function fitSize(c, lines, maxWidth, o, min) {
  let size = o.size;
  while (size > min && lines.some(s => measure(c, s, {...o, size}) > maxWidth)) size -= 1;
  return size;
}
function fitText(c, s, x, y, maxWidth, o, min) {
  const size = fitSize(c, [s], maxWidth, o, min);
  text(c, s, x, y, {...o, size});
  return measure(c, s, {...o, size});
}
// 日本語の折り返し：測った幅で折り、行頭・行末の禁則を守る。英数字の語とパスは分けない
const NO_START = '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ…‥';
const NO_END = '（「『【〔〈《';
function wrapLines(c, s, maxWidth, o) {
  c.save();
  c.font = font(o);
  const lines = [];
  const tokens = String(s).match(/[A-Za-z0-9][A-Za-z0-9._\-/[\]()]*|\s+|[\s\S]/gu) || [];
  let line = '';
  for (const token of tokens) {
    const next = line + token;
    if (line.trim() && !/^\s+$/.test(token) && c.measureText(next).width > maxWidth) {
      let carry = token;
      if (NO_START.includes(token[0]) && line.length > 1) {
        carry = line.slice(-1) + carry;
        line = line.slice(0, -1);
      }
      while (line.length > 1 && NO_END.includes(line.slice(-1))) {
        carry = line.slice(-1) + carry;
        line = line.slice(0, -1);
      }
      lines.push(line.trimEnd());
      line = carry.trimStart();
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  c.restore();
  return lines;
}
// 折り返して描き、最後の行のベースラインを返す
function block(c, s, x, y, maxWidth, lineHeight, o) {
  const lines = wrapLines(c, s, maxWidth, o);
  lines.forEach((line, i) => text(c, line, x, y + i * lineHeight, o));
  return y + (lines.length - 1) * lineHeight;
}
// 1行の中で色や下地を変えて描く。幅に収まらなければ全体を小さくする
function runs(c, segs, x, y, o, maxWidth, min = 24) {
  const size = fitSize(c, [segs.map(s => s.s).join('')], maxWidth, o, min);
  let cx = x;
  segs.forEach(seg => {
    const so = {...o, size, weight: seg.weight || o.weight};
    const w = measure(c, seg.s, so);
    if (seg.bg) {
      c.save();
      roundRect(c, cx - 3, y - size * 0.9, w + 6, size * 1.2, 4);
      c.fillStyle = seg.bg;
      c.fill();
      c.restore();
    }
    text(c, seg.s, cx, y, {...so, color: seg.color || o.color});
    cx += w;
  });
  return {size, end: cx};
}
function roundRect(c, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}
function panel(c, x, y, w, h, o = {}) {
  c.save();
  c.shadowColor = 'rgba(37, 33, 28, 0.10)';
  c.shadowBlur = 14;
  c.shadowOffsetY = 4;
  roundRect(c, x, y, w, h, o.r || 10);
  c.fillStyle = o.fill || C.card;
  c.fill();
  c.restore();
  roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, o.r || 10);
  c.strokeStyle = o.stroke || C.rule;
  c.lineWidth = 1;
  c.stroke();
}
function label(c, s, x, y, o = {}) {
  text(c, s, x, y, {size: 20, weight: 600, color: C.muted, ...o});
}

// 実画面の切り抜きを、等倍率でそのまま置く（画素は変えず、文字も重ねない）
function shot(c, f, key, alpha, dy = 0) {
  if (alpha <= 0.001) return;
  const crop = CROPS[key], img = f.img[crop.img];
  const x = crop.at.x, y = crop.at.y + dy, w = crop.w * crop.at.s, h = crop.h * crop.at.s;
  c.save();
  c.globalAlpha *= alpha;
  c.save();
  c.shadowColor = 'rgba(37, 33, 28, 0.14)';
  c.shadowBlur = 18;
  c.shadowOffsetY = 6;
  roundRect(c, x, y, w, h, 8);
  c.fillStyle = C.card;
  c.fill();
  c.restore();
  c.save();
  roundRect(c, x, y, w, h, 8);
  c.clip();
  c.drawImage(img, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
  c.restore();
  roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  c.strokeStyle = C.strong;
  c.lineWidth = 1;
  c.stroke();
  c.restore();
}
// 大きな数字と、その右の小さな説明
function bigNumber(c, s, x, y, size, color) {
  const o = {size, weight: 700};
  text(c, s, x, y, {...o, color});
  return measure(c, s, o);
}
// 照合メモ（入力）の帯。ラベルは入力の値、文は入力の意味か、入力の文字列から取り出したもの
function noteBand(c, x, y, w, h, tone) {
  c.save();
  roundRect(c, x, y, w, h, 8);
  c.fillStyle = tone === 'teal' ? C.tealSoft : C.rustSoft;
  c.fill();
  c.fillStyle = tone === 'teal' ? C.teal : C.rust;
  c.fillRect(x, y, 5, h);
  c.restore();
}

// ---- いつも出ている枠：題名と原典、足元の範囲の注記 ---------------------------
function drawChrome(c) {
  text(c, 'Studio Yebisu ・ Ragas 作例', 80, 48, {size: 20, weight: 600, color: C.muted});
  text(c, SOURCE_PIN, 1200, 48, {size: 20, weight: 500, color: C.muted, align: 'right'});
  c.save();
  c.fillStyle = C.rule;
  c.fillRect(80, 66, 1120, 1);
  c.fillRect(80, 664, 1120, 1);
  c.restore();
  text(c, FOOTER_SCOPE, 80, 698, {size: 20, weight: 700, color: C.ink});
  text(c, FOOTER_NOTE, 1200, 698, {size: 20, weight: 700, color: C.rust, align: 'right'});
}

function drawHeadlines(c, t, f) {
  SCENES.forEach((s, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    const dy = i === 0 ? 0 : 8 * (1 - easeOut(prog(t, s.start - XF, s.start + 0.35)));
    const line = s.headline(f);
    const o = {size: 46, weight: 600, family: 'serif'};
    const size = fitSize(c, [line], 1120, o, 44);
    c.save();
    c.globalAlpha = a;
    text(c, line, 80, 116 + dy, {...o, size});
    c.restore();
  });
}

// ---- 場面 ------------------------------------------------------------------
// 0〜4秒：スマホの初期表示（実画面）と、入力の10問×2回答×3指標＝60回の図
function drawSetup(c, t, f) {
  const a = sceneAlpha(t, 0);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a * enter(t, 0.05);
  label(c, '実画面・スマホの初期表示', 80, 166);
  c.globalAlpha = a;
  shot(c, f, 'phoneTop', enter(t, 0.1), rise(t, 0.1));

  const X0 = 460, GX = 560, CW = 64, BW = 56;
  c.globalAlpha = a * enter(t, 0.25);
  label(c, `入力 input/faq-pairs.json ・ ${f.title}（架空）`, X0, 166);
  const rows = [
    {name: '資料', y: 190, h: 30, kind: 'doc', at: 0.35},
    {name: '問い', y: 232, h: 34, kind: 'q', at: 0.55},
    {name: '変更前', y: 282, h: 34, kind: 'before', at: 0.8},
    {name: '変更後', y: 326, h: 34, kind: 'after', at: 0.9}
  ];
  rows.forEach(r => {
    c.globalAlpha = a * enter(t, r.at);
    label(c, r.name, X0, r.y + r.h / 2 + 7, r.kind === 'doc' ? {} : {color: C.ink, weight: 700});
    for (let i = 0; i < 10; i++) {
      const x = GX + i * CW;
      c.globalAlpha = a * enter(t, r.at + i * 0.03, 0.3);
      roundRect(c, x, r.y, BW, r.h, 5);
      if (r.kind === 'doc') {
        c.fillStyle = C.sunk;
        c.fill();
        text(c, f.docIds[i], x + BW / 2, r.y + 22, {size: 20, family: 'mono', color: C.muted, align: 'center'});
        continue;
      }
      c.fillStyle = C.card;
      c.fill();
      c.strokeStyle = C.rule;
      c.lineWidth = 1;
      c.stroke();
      if (r.kind === 'q') {
        text(c, f.qIds[i], x + BW / 2, r.y + 24, {size: 20, family: 'mono', weight: 700, align: 'center'});
        continue;
      }
      // 各回答の3指標の呼び出し（1本＝1回）
      const stage = r.kind === 'before' ? 0 : 1;
      for (let j = 0; j < 3; j++) {
        const n = i * 6 + stage * 3 + j;
        const k = enter(t, 1.2 + n * 0.018, 0.2);
        if (k <= 0.001) continue;
        c.globalAlpha = a * k;
        c.fillStyle = METRIC_COLORS[j];
        const bh = 20 * k;
        c.fillRect(x + 11 + j * 13, r.y + 27 - bh, 8, bh);
      }
    }
  });

  c.globalAlpha = a * enter(t, 1.3);
  let lx = X0;
  f.metrics.forEach((m, j) => {
    const o = {size: 22, weight: 600};
    c.fillStyle = METRIC_COLORS[j];
    c.fillRect(lx, 386, 8, 20);
    text(c, m.label, lx + 16, 404, o);
    lx += 16 + measure(c, m.label, o) + 34;
  });

  c.globalAlpha = a * enter(t, 2.5);
  runs(c, [
    {s: `${f.qIds.length}問 × 2回答 × ${f.metrics.length}指標 ＝ `},
    {s: `${f.calls}回`, color: C.teal}
  ], X0, 468, {size: 40, weight: 700}, 740, 34);
  c.globalAlpha = a * enter(t, 2.75);
  block(c, '固定版Ragasの .ascore を実際に呼んだ回数（結果の runtime.metric_calls）。LLM・埋め込み・APIキーは使わない。', X0, 508, 740, 30, {size: 22, color: C.muted});

  c.globalAlpha = a * enter(t, 3.05);
  text(c, CORE, X0, 626, {size: 34, weight: 700, color: C.teal});
  c.restore();
}

// 4〜8秒：完全一致の件数。どの問いが1.0かを、保存した値から並べる
function drawCount(c, t, f) {
  const a = sceneAlpha(t, 1);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a * enter(t, 4.1);
  label(c, '完全一致の件数（ExactMatch が1.0の問い）', 80, 166);
  const big = {size: 84, weight: 700};
  const s1 = `${f.count.before} / ${f.count.total}`, s2 = `${f.count.after} / ${f.count.total}`;
  const w1 = measure(c, s1, big), wa = measure(c, '→', {size: 56, weight: 700});
  c.globalAlpha = a * enter(t, 4.2);
  text(c, s1, 80, 272 + rise(t, 4.2), {...big, color: C.ink});
  c.globalAlpha = a * enter(t, 4.5);
  text(c, '→', 80 + w1 + 24, 262, {size: 56, weight: 700, color: C.strong});
  c.globalAlpha = a * enter(t, 4.7);
  text(c, s2, 80 + w1 + 48 + wa, 272 + rise(t, 4.7), {...big, color: C.teal});

  c.globalAlpha = a * enter(t, 5.0);
  text(c, '固定回答の比較。', 80, 340, {size: 32, weight: 700, color: C.rust});
  text(c, '正答率ではありません。', 80, 384, {size: 32, weight: 700, color: C.rust});

  // 10問それぞれの完全一致（塗り＝1.0）
  const SX = 180, SW = 54, BW = 48, BH = 44;
  [['変更前', 'before', 430, 5.3], ['変更後', 'after', 490, 5.7]].forEach(([name, st, y, at]) => {
    c.globalAlpha = a * enter(t, at - 0.1);
    label(c, name, 80, y + 30, {size: 22, weight: 700, color: C.ink});
    f.rows.forEach((r, i) => {
      const on = r[st].scores.exact_match === 1;
      const x = SX + i * SW;
      c.globalAlpha = a * enter(t, at + i * 0.03, 0.3);
      roundRect(c, x, y, BW, BH, 6);
      c.fillStyle = on ? C.teal : C.card;
      c.fill();
      c.strokeStyle = on ? C.teal : C.rule;
      c.lineWidth = 1.5;
      c.stroke();
      text(c, r.id, x + BW / 2, y + 29, {size: 20, family: 'mono', weight: 700, color: on ? '#ffffff' : C.muted, align: 'center'});
    });
  });
  // 変更前1.0 → 変更後0 になった問いを囲む
  const kr = enter(t, 6.3);
  if (kr > 0.001) {
    c.globalAlpha = a * kr;
    f.dropped.forEach(id => {
      const x = SX + f.qIds.indexOf(id) * SW;
      roundRect(c, x - 4, 426, BW + 8, 112, 8);
      c.strokeStyle = C.rust;
      c.lineWidth = 3;
      c.stroke();
    });
  }
  c.globalAlpha = a * enter(t, 6.5);
  runs(c, [{s: '変更後で0になった問い：'}, {s: f.dropped.join('・'), color: C.rust}], 80, 590, {size: 26, weight: 700}, 640);
  c.globalAlpha = a * enter(t, 6.8);
  text(c, `この${f.dropped.length}問を、根拠と並べて読む。`, 80, 632, {size: 24, weight: 600});

  c.globalAlpha = a * enter(t, 4.3);
  label(c, '実画面・スマホの平均表', 800, 166);
  c.globalAlpha = a;
  shot(c, f, 'phoneSummary', enter(t, 4.35), rise(t, 4.35));
  c.globalAlpha = a * enter(t, 5.2);
  block(c, '平均も文字列の統計。変更前・変更後は意図して作った固定回答の名前で、モデルの比較ではない。', 800, 506, 400, 30, {size: 22, color: C.muted});
  c.restore();
}

// 8〜14秒：Q07。18時→19時の1字の置換で、文字列の近さは高いまま。ポスターは13.5秒（全要素が着地済み）
function drawQ07(c, t, f) {
  const a = sceneAlpha(t, 2);
  if (a <= 0.001) return;
  const q = f.q07, line = {size: 32, weight: 500};
  c.save();
  c.globalAlpha = a * enter(t, 8.1);
  label(c, `参照文 ＝ 資料${q.doc}の本文`, 80, 166);
  c.globalAlpha = a * enter(t, 8.15);
  runs(c, [{s: q.d.pre}, {s: q.d.a, bg: C.tealSoft, color: C.teal, weight: 700}, {s: q.d.post}], 80, 206 + rise(t, 8.15), line, 1120);
  c.globalAlpha = a * enter(t, 8.5);
  label(c, `変更後の固定回答（${q.id}）`, 80, 246);
  c.globalAlpha = a * enter(t, 8.55);
  runs(c, [{s: q.d.pre}, {s: q.d.b, bg: C.rustSoft, color: C.rust, weight: 700}, {s: q.d.post}], 80, 286 + rise(t, 8.55), line, 1120);

  // 保存した3つの値
  c.globalAlpha = a * enter(t, 9.2);
  fitText(c, '文字列の近さ（NonLLMStringSimilarity・LEVENSHTEIN）', 80, 340, 560, {size: 20, weight: 600, color: C.muted}, 20);
  c.globalAlpha = a * enter(t, 9.3);
  const wb = bigNumber(c, fmt3(q.scores.string_similarity), 80, 450 + rise(t, 9.3), 104, C.teal);
  c.globalAlpha = a * enter(t, 9.45);
  label(c, '保存値', 80 + wb + 28, 404);
  text(c, String(q.scores.string_similarity), 80 + wb + 28, 440, {size: 26, weight: 700, family: 'mono'});
  c.globalAlpha = a * enter(t, 9.6);
  text(c, `${q.len}字のうち1字の置換`, 80, 494, {size: 24, weight: 600});
  c.globalAlpha = a * enter(t, 9.8);
  text(c, `完全一致 ${fmt3(q.scores.exact_match)} ・ 基準文の包含 ${fmt3(q.scores.string_presence)}`, 80, 532, {size: 24, weight: 600});
  c.globalAlpha = a * enter(t, 10.1);
  text(c, '文字が近くても、期限は違う。', 80, 570, {size: 24, weight: 700, color: C.rust});

  c.globalAlpha = a * enter(t, 9.0);
  label(c, '実画面・変更後の回答カード（パソコン幅）', 662, 340);
  c.globalAlpha = a;
  shot(c, f, 'q07Answer', enter(t, 9.05), rise(t, 9.05));

  // 照合メモ（入力）
  const kn = enter(t, 10.4);
  if (kn > 0.001) {
    c.globalAlpha = a * kn;
    noteBand(c, 80, 592, 1120, 60, 'rust');
    const lab = `照合メモ（入力）${q.label} ＝ ${f.meanings[q.label]}`;
    const lw = fitText(c, lab, 100, 630, 560, {size: 20, weight: 700, color: C.rust}, 20);
    text(c, `根拠は${q.refTime}。回答は${q.afterTime}。`, 100 + lw + 32, 633, {size: 32, weight: 700});
  }
  c.restore();
}

// 14〜19秒：Q08。参照文の全体を含むので包含は1。後ろの追記は資料にない（入力の照合メモ）
function drawQ08(c, t, f) {
  const a = sceneAlpha(t, 3);
  if (a <= 0.001) return;
  const q = f.q08, line = {size: 32, weight: 500};
  c.save();
  c.globalAlpha = a * enter(t, 14.1);
  label(c, `参照文 ＝ 資料${q.doc}の本文`, 80, 166);
  c.globalAlpha = a * enter(t, 14.15);
  text(c, q.reference, 80, 206 + rise(t, 14.15), line);
  c.globalAlpha = a * enter(t, 14.5);
  label(c, `変更後の固定回答（${q.id}）`, 80, 246);
  c.globalAlpha = a * enter(t, 14.55);
  text(c, q.reference, 80, 288, line);
  // 回答の中の参照文全体に下線（入力の文字列から位置を求める）
  const ku = enter(t, 14.9, 0.5);
  if (ku > 0.001) {
    c.fillStyle = C.teal;
    c.fillRect(80, 298, measure(c, q.reference, line) * ku, 4);
  }
  c.globalAlpha = a * enter(t, 15.0);
  runs(c, [{s: q.addition, bg: C.rustSoft, color: C.rust, weight: 700}], 80, 340, line, 740);

  c.globalAlpha = a * enter(t, 15.3);
  label(c, '基準文の包含（StringPresence）', 80, 390);
  label(c, `完全一致 ${fmt3(q.scores.exact_match)} ・ 近さ ${fmt3(q.scores.string_similarity)}`, 820, 390, {align: 'right'});
  c.globalAlpha = a * enter(t, 15.4);
  const wb = bigNumber(c, fmt3(q.scores.string_presence), 80, 474 + rise(t, 15.4), 96, C.teal);
  c.globalAlpha = a * enter(t, 15.6);
  text(c, '参照文の全体が含まれるので1。', 80 + wb + 28, 430, {size: 24, weight: 600});
  text(c, '後ろの追記は見ていない。', 80 + wb + 28, 466, {size: 24, weight: 700, color: C.rust});

  const kn = enter(t, 15.9);
  if (kn > 0.001) {
    c.globalAlpha = a * kn;
    noteBand(c, 80, 496, 740, 96, 'rust');
    label(c, `照合メモ（入力）${q.label}`, 100, 528, {weight: 700, color: C.rust});
    text(c, f.meanings[q.label], 100, 574, {size: 30, weight: 700});
    c.globalAlpha = a * enter(t, 16.2);
    text(c, `メモより：「${Q08_NOTE_SENTENCE}」`, 80, 630, {size: 22, weight: 600, color: C.muted});
  }

  c.globalAlpha = a * enter(t, 14.3);
  label(c, `実画面・スマホ（${q.id} 変更後）`, 860, 166);
  c.globalAlpha = a;
  shot(c, f, 'q08Phone', enter(t, 14.35), rise(t, 14.35));
  c.globalAlpha = a * enter(t, 15.2);
  block(c, `参照文の後ろに${q.addLen}文字の追記。色付きは画面の目印。`, 860, 566, 340, 28, {size: 20, color: C.muted});
  c.restore();
}

// 19〜23秒：Q05。3条件を保った言い換えでも、完全一致は0（意味が合うことは入力のメモが示す）
function drawQ05(c, t, f) {
  const a = sceneAlpha(t, 4);
  if (a <= 0.001) return;
  const q = f.q05, line = {size: 32, weight: 500};
  c.save();
  c.globalAlpha = a * enter(t, 19.1);
  label(c, `参照文 ＝ 資料${q.doc}の本文`, 80, 166);
  c.globalAlpha = a * enter(t, 19.15);
  text(c, q.reference, 80, 206 + rise(t, 19.15), line);
  c.globalAlpha = a * enter(t, 19.4);
  label(c, `変更後の固定回答（${q.id}）`, 80, 246);
  c.globalAlpha = a * enter(t, 19.45);
  text(c, q.after, 80, 286 + rise(t, 19.45), line);

  c.globalAlpha = a * enter(t, 19.8);
  label(c, '完全一致（ExactMatch）', 80, 340);
  c.globalAlpha = a * enter(t, 19.9);
  const wb = bigNumber(c, fmt3(q.scores.exact_match), 80, 450 + rise(t, 19.9), 104, C.ink);
  c.globalAlpha = a * enter(t, 20.05);
  text(c, `文字列の近さ ${fmt3(q.scores.string_similarity)}`, 80 + wb + 28, 404, {size: 24, weight: 600});
  text(c, `基準文の包含 ${fmt3(q.scores.string_presence)}`, 80 + wb + 28, 442, {size: 24, weight: 600});

  const kn = enter(t, 20.3);
  if (kn > 0.001) {
    c.globalAlpha = a * kn;
    label(c, `照合メモ（入力）${q.label} ＝ ${f.meanings[q.label]}`, 80, 500, {weight: 700, color: C.teal});
    let x = 80;
    q.conditions.forEach((s, i) => {
      c.globalAlpha = a * enter(t, 20.4 + i * 0.12);
      const o = {size: 26, weight: 700};
      const w = measure(c, s, o) + 28;
      roundRect(c, x, 516, w, 46, 23);
      c.fillStyle = C.tealSoft;
      c.fill();
      text(c, s, x + 14, 548, {...o, color: C.teal});
      x += w + 10;
    });
    c.globalAlpha = a * enter(t, 20.8);
    text(c, 'を保持した言い換え', x + 4, 548, {size: 24, weight: 600});
    c.globalAlpha = a * enter(t, 21.0);
    block(c, '意味が合うことを示すのは入力のメモ。3指標は意味を判定しない。', 80, 606, 560, 30, {size: 22, color: C.muted});
  }

  c.globalAlpha = a * enter(t, 19.6);
  label(c, '実画面・変更後の回答カード（パソコン幅）', 662, 340);
  c.globalAlpha = a;
  shot(c, f, 'q05Answer', enter(t, 19.65), rise(t, 19.65));
  c.restore();
}

// 23〜28秒：制作時の実操作で保存したJSONの値と、スマホのQ07の計算結果（24.6秒以降は止めて読む）
function drawSave(c, t, f) {
  const a = sceneAlpha(t, 5);
  if (a <= 0.001) return;
  c.save();
  const X = 80, W = 600, ix = X + 24, iw = W - 48;
  const kp = enter(t, 23.1), dp = rise(t, 23.1);
  const top = 152 + dp;
  c.globalAlpha = a * kp;
  panel(c, X, top, W, 436);
  text(c, '実際に保存したJSON', ix, top + 40, {size: 24, weight: 700, color: C.teal});
  text(c, 'outputs/browser-selection.json', ix, top + 72, {size: 20, family: 'mono', color: C.muted});
  c.fillStyle = C.rule;
  c.fillRect(ix, top + 90, iw, 1);
  const mono = {size: 24, family: 'mono'};
  const lines = f.saved.rows.map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  const size = fitSize(c, lines, iw, mono, 20);
  f.saved.rows.forEach(([k, v], i) => {
    c.globalAlpha = a * enter(t, 23.3 + i * 0.08, 0.35);
    const y = top + 130 + i * 40;
    const key = k + ': ';
    text(c, key, ix, y, {...mono, size, color: C.muted});
    text(c, JSON.stringify(v), ix + measure(c, key, {...mono, size}), y, {...mono, size, weight: 700});
  });
  c.globalAlpha = a * enter(t, 23.85);
  label(c, '保存名', ix, top + 372);
  text(c, `${f.saved.filename} ・ ${f.saved.bytes} bytes`, ix + 76, top + 372, {size: 20, family: 'mono', weight: 700});
  text(c, '制作時の実操作で保存した既存ファイル。', ix, top + 408, {size: 20, color: C.muted});

  c.globalAlpha = a * enter(t, 23.2);
  label(c, '実画面・スマホ（Q07の計算結果）', 760, 166);
  c.globalAlpha = a;
  shot(c, f, 'q07PhoneScores', enter(t, 23.25), rise(t, 23.25));

  c.globalAlpha = a * enter(t, 24.1);
  text(c, CORE, 80, 640, {size: 34, weight: 700, color: C.teal});
  c.globalAlpha = a * enter(t, 24.2);
  text(c, '問い・資料・値・メモを1つのファイルに。', 1200, 640, {size: 22, weight: 600, color: C.muted, align: 'right'});
  c.restore();
}

// ---- 1フレームを描く --------------------------------------------------------
let facts = null;
let failure = null;
let currentT = 0;

function render(t) {
  canvas.width = canvas.width; // 前のフレームの変換・クリップ・状態をすべて捨てる
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / LW, canvas.height / LH);
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - LW * scale) / 2, (canvas.height - LH * scale) / 2);
  ctx.beginPath();
  ctx.rect(0, 0, LW, LH);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawChrome(ctx);
  if (!facts) {
    const message = failure ? '読み込みに失敗しました。代わりの映像は出しません。' : '保存済みのファイルと実画面を確かめています…';
    text(ctx, message, 80, 300, {size: 30, weight: 700, color: failure ? C.rust : C.muted});
    if (failure) block(ctx, failure.message, 80, 348, 1120, 32, {size: 22, color: C.ink});
    return;
  }
  drawHeadlines(ctx, t, facts);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, CONTENT_TOP, LW, CONTENT_BOTTOM - CONTENT_TOP);
  ctx.clip();
  drawSetup(ctx, t, facts);
  drawCount(ctx, t, facts);
  drawQ07(ctx, t, facts);
  drawQ08(ctx, t, facts);
  drawQ05(ctx, t, facts);
  drawSave(ctx, t, facts);
  ctx.restore();
}

const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');
const verifiedEl = document.getElementById('verified');
function setStatus(state, message, detail = '') {
  root.dataset.motionStatus = state;
  if (statusEl) {
    statusEl.dataset.state = state;
    statusEl.textContent = message;
  }
  if (detailEl) detailEl.textContent = detail;
}
const clampTime = v => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(DURATION, Math.max(0, n)) : 0;
};

render(0);
setStatus('loading', '保存済みのファイルと実画面を確かめています…');

window.motionReady = (async () => {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('この環境ではSHA-256を確かめられません。http://127.0.0.1 などのローカルサーバーで開いてください');
  }
  const fontSpecs = [`600 46px ${SERIF}`, `700 104px ${SANS}`, `500 32px ${SANS}`, `400 20px ${SANS}`, `700 24px ${MONO}`];
  if (document.fonts && document.fonts.load) {
    await Promise.all(fontSpecs.map(spec => document.fonts.load(spec, '点数と根拠を予約の取り消し18時0.969Q07')));
    await document.fonts.ready;
  }
  const {data, sizes, verified, hashes} = await loadAll();
  const built = buildFacts(data, hashes, sizes);
  facts = built;
  render(currentT);
  setStatus('ready', `照合した${verified.length}ファイルから描いています`,
    `入力の${built.qIds.length}問・${built.qIds.length * 2}回答、結果の${built.calls}個の値と平均・件数、Q07・Q08・Q05の値と照合メモ（入力）、保存したJSONのQ07の行を確かめました。ページでも映像でもAIやRagasは動きません。`);
  if (verifiedEl) {
    verifiedEl.replaceChildren(...verified.map(v => {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = v.path;
      li.append(code, ` — SHA-256 ${v.digest.slice(0, 12)}…`);
      return li;
    }));
    verifiedEl.hidden = false;
  }
  return true;
})().catch(error => {
  failure = error;
  render(currentT);
  setStatus('error', '読み込みに失敗しました：' + error.message, '代わりの映像は出しません。ファイルを確かめてから再読み込みしてください。');
  throw error;
});
window.motionReady.catch(() => {});

// 任意の時刻の完成した画面を描く。呼んだ順番や壁時計には依存しない
window.seek = seconds => {
  const t = clampTime(seconds);
  currentT = t;
  return window.motionReady.then(() => {
    render(t);
    return t;
  });
};

// ---- 編集用のプレビュー（書き出し時は何も動かさない） --------------------------
// 自動では再生しない（動きを減らす設定でも同じく停止から始まる）。再生は「再生」を押したときだけ
function setupPreview() {
  const play = document.getElementById('play');
  const range = document.getElementById('time');
  const clock = document.getElementById('clock');
  const reload = document.getElementById('reload');
  let playing = false, raf = 0, from = 0, startedAt = 0;
  const sec = v => v.toFixed(1) + '秒';

  function sync() {
    range.value = (Math.round(currentT * 10) / 10).toFixed(1);
    range.setAttribute('aria-valuetext', `${sec(currentT)}（全${DURATION}秒）`);
    clock.textContent = `${sec(currentT)} / ${sec(DURATION)}`;
    play.textContent = playing ? '一時停止' : '再生';
    play.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
  function tick(now) {
    if (!playing) return;
    const t = Math.min(DURATION, from + (now - startedAt) / 1000);
    currentT = t;
    render(t);
    if (t >= DURATION) {
      playing = false;
      raf = 0;
    } else {
      raf = requestAnimationFrame(tick);
    }
    sync();
  }
  function start() {
    if (!facts || playing) return;
    if (currentT >= DURATION - 0.05) currentT = 0;
    from = currentT;
    startedAt = performance.now();
    playing = true;
    raf = requestAnimationFrame(tick);
    sync();
  }
  function stop() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    sync();
  }
  function jump(t) {
    stop();
    currentT = clampTime(t);
    if (facts) render(currentT);
    sync();
  }

  play.addEventListener('click', () => (playing ? stop() : start()));
  // 矢印キーはスライダー標準（0.1秒）。Home・End は先頭・末尾、PageUp・PageDown は2秒ずつ（Home から7回で14秒）
  range.addEventListener('input', () => jump(Number(range.value)));
  range.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const moves = {Home: () => 0, End: () => DURATION, PageUp: () => currentT + 2, PageDown: () => currentT - 2};
    if (Object.hasOwn(moves, event.key)) {
      event.preventDefault();
      jump(Math.round(moves[event.key]() * 10) / 10);
    }
  });
  reload.addEventListener('click', () => location.reload());
  window.motionReady.then(() => {
    play.disabled = false;
    range.disabled = false;
    sync();
  }, () => {
    reload.hidden = false;
  });
}
if (!RENDER) setupPreview();
