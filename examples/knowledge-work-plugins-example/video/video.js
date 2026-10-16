/* 声から、次の試作へ（Synthesize Research 作例）— 28秒・無音の解説映像（編集できる元ページ）
 * Canvas 2D で、時刻 t の完成した画面を毎回最初から描く。前のフレームや壁時計には依存しない。
 * 使う素材は、架空のヒアリングメモ・保存済みの整理・ブラウザーで保存した2ファイル・実画面のキャプチャ6枚だけ。
 * 映像に出す引用・発見・人数は、読み込んだファイルから取り出す（ここに書き写さない）。
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

// ---- 見た目（作例のビューアと同じ生成り・墨・深緑） ----------------------------
const C = {
  paper: '#f7f2e7', paperDeep: '#efe7d6', card: '#fffdf8', ink: '#1d1b18', muted: '#59544b',
  rule: '#d8ceb9', quiet: '#a99f8a', green: '#1d4b38', greenSoft: '#e3ece4', greenInk: '#163a2b',
  amber: '#7a4a12', amberSoft: '#f6ead6'
};
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", "Yu Gothic", Meiryo, system-ui, sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "BIZ UDMincho", serif';
const MONO = 'ui-monospace, "SFMono-Regular", Consolas, "BIZ UDGothic", monospace';

// ---- 素材 ------------------------------------------------------------------
// 照合表 assets/data-hashes.json 自体の SHA-256（runtime/frozen-reviewed-source.json の値）。
// 照合表に並ぶ11ファイルのパスは作例フォルダーからの相対で、このモジュールの1つ上を基準に解決する。
// 書き出し時に <base href="video/"> が入っても import.meta.url 基準なので同じ場所を指す。
const HASH_MANIFEST = {path: 'assets/data-hashes.json', sha256: 'f0cfc61ed9b6a24cdc88b5ded4f2e608d27b6ef653b65a6f2a4da31680d95b90'};
const FILES = {
  'input/interviews.json': {key: 'interviews', kind: 'json'},
  'outputs/synthesis.json': {key: 'synthesis', kind: 'json'},
  'outputs/browser-selected.md': {key: 'selectedMd', kind: 'text'},
  'outputs/browser-complete.json': {key: 'complete', kind: 'json'},
  'video/assets/screen-manifest.json': {key: 'screens', kind: 'json'},
  'video/assets/desktop-first.png': {key: 'first', kind: 'png'},
  'video/assets/desktop-notifications.png': {key: 'notify', kind: 'png'},
  'video/assets/desktop-calendar.png': {key: 'calendar', kind: 'png'},
  'video/assets/desktop-origin.png': {key: 'origin', kind: 'png'},
  'video/assets/phone-initial.png': {key: 'phoneInitial', kind: 'png'},
  'video/assets/phone-calendar.png': {key: 'phoneCalendar', kind: 'png'}
};
const SOURCE_COMMIT = 'f652327d4e953d7957d99e735c3c7f9964e9d2e5';
const SKILL_URL = `https://github.com/anthropics/knowledge-work-plugins/blob/${SOURCE_COMMIT}/product-management/skills/synthesize-research/SKILL.md`;

// 映像で扱う発見と行（中身はすべて読み込んだデータから取り出し、読み込み時に関係を確かめる）
const FOCUS = 'F05';          // 月単位の空き表示：支持1人と、別に置く反する発言
const SUPPORT_LINE = 'P03-L02';
const CONTRA_LINE = 'P02-L04';
const NEUTRAL_LINE = 'P01-L02'; // 支持にも反証にも数えない行
const PURPOSE = 'F03';        // 通知手段：用途の違いを残す
// 「原文から抜粋」：各行の本文に完全に含まれる部分だけ。用途の見出しは読み込み時に原文・観察と照らす
const PURPOSE_ROWS = [
  {line: 'P01-L03', label: '控え', excerpt: '予約の控えはメールに残したいです。', inText: true},
  {line: 'P02-L03', label: '当日の変更', excerpt: '当日の変更はSMSで知りたいです。', inText: true},
  {line: 'P03-L05', label: '未定', excerpt: 'どちらがよいか分かりません。', kind: 'uncertainty'}
];
const CONF = {high: '高', medium: '中', low: '低'};

// 実画面の切り抜き（画像の画素座標）。DOMの記録は全体撮影後の近似値なので、文字の外に余白を取る
const CROPS = {
  phoneTop: {img: 'phoneInitial', x: 0, y: 0, w: 375, h: 420, contains: null},          // 最初の画面の上部（見出し・参加者・読み込み済みの表示）
  list: {img: 'first', x: 78, y: 612, w: 374, h: 420, contains: ['desktop-first.png', 'finding-list']},
  calendar: {img: 'calendar', x: 465, y: 1076, w: 720, h: 560, contains: ['desktop-calendar.png', 'd-evidence', 'd-contra']},
  origin: {img: 'origin', x: 72, y: 2890, w: 1136, h: 250, contains: ['desktop-origin.png', 'line-P02-L04']},
  notify: {img: 'notify', x: 465, y: 1104, w: 720, h: 532, contains: null},              // F03 の支持する発言の見出しと上の2件
  phone: {img: 'phoneCalendar', x: 0, y: 0, w: 375, h: 812, contains: null}              // スマホ幅・F05 の詳細（全体）
};
// 切り抜きの中で枠を重ねる範囲（画像の画素座標・近似）
const BOX = {
  support: {x: 474, y: 1086, w: 702, h: 266},
  contra: {x: 474, y: 1358, w: 702, h: 268},
  originLine: {x: 99, y: 2980, w: 1082, h: 82}
};
const PLACE = {
  phoneTop: {x: 80, y: 234, s: 0.98},
  list: {x: 80, y: 164, s: 1.08},
  calendar: {x: 80, y: 164, s: 0.86},
  origin: {x: 80, y: 164, s: 0.98},
  notify: {x: 80, y: 164, s: 0.76},
  phone: {x: 80, y: 164, s: 0.58}
};

const CORE = 'まとめた理由を、原文までたどれる。';
const FOOTER = '架空メモ3件・保存済みの整理／無音・実画面を編集';
const STEPS = ['メモ', '発見', '原文', '保存'];
const SCENES = [
  {id: 'memo', start: 0, end: 4.5, step: 0, headline: () => CORE},
  {id: 'findings', start: 4.5, end: 7.5, step: 1, headline: f => `発見は${f.findings.length}件。どれも暫定の解釈。`},
  {id: 'focus', start: 7.5, end: 14, step: 1, headline: f => `月表示を望むのは、${f.focus.frequency}人。`},
  {id: 'origin', start: 14, end: 18, step: 2, headline: () => '引用から、原文の同じ行へ。'},
  {id: 'purpose', start: 18, end: 23, step: 2, headline: () => '用途の違いも、残す。'},
  {id: 'save', start: 23, end: 28, step: 3, headline: () => CORE}
];
const CONTENT_TOP = 136, CONTENT_BOTTOM = 656;

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const enter = (t, at, dur = 0.4) => easeOut(prog(t, at, at + dur));
const rise = (t, at, dur = 0.4, px = 10) => px * (1 - enter(t, at, dur));
// 場面の入りは0.45秒、出は0.4秒。隣の場面と重ね、上の段階表示と足元はいつも残す
function sceneAlpha(t, i) {
  const s = SCENES[i];
  const a = i === 0 ? 1 : easeOut(prog(t, s.start - 0.05, s.start + 0.4));
  const b = i === SCENES.length - 1 ? 1 : 1 - easeInOut(prog(t, s.end - 0.35, s.end + 0.05));
  return Math.min(a, b);
}

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
// 照合済みのバイト列だけから画像を作る。読み込めたら一時URLを片づける
async function decodePng(bytes, label) {
  const url = URL.createObjectURL(new Blob([bytes], {type: 'image/png'}));
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`${label} を画像として読み込めません`);
  }
  const bitmap = await createImageBitmap(img);
  URL.revokeObjectURL(url);
  return bitmap;
}

async function loadAll() {
  const manifestUrl = new URL(HASH_MANIFEST.path, import.meta.url);
  const manifestBytes = await fetchVerified(manifestUrl, 'video/' + HASH_MANIFEST.path, HASH_MANIFEST.sha256);
  const hashes = JSON.parse(decodeText(manifestBytes.bytes)).files_sha256;
  check(hashes && typeof hashes === 'object', '照合表の形');
  const listed = Object.keys(hashes).sort();
  check(sameList(listed, Object.keys(FILES).sort()), `照合表のファイル（${listed.length}件）`);
  const data = {}, verified = [];
  await Promise.all(listed.map(async path => {
    check(/^[A-Za-z0-9_\-/.]+$/.test(path) && !path.split('/').includes('..') && !path.startsWith('/'), `${path} のパス`);
    const expected = String(hashes[path]);
    check(/^[0-9a-f]{64}$/.test(expected), `${path} の照合値`);
    const {bytes, digest} = await fetchVerified(new URL('../' + path, import.meta.url), path, expected);
    const spec = FILES[path];
    if (spec.kind === 'png') data[spec.key] = await decodePng(bytes, path);
    else if (spec.kind === 'json') data[spec.key] = JSON.parse(decodeText(bytes));
    else data[spec.key] = decodeText(bytes);
    verified.push({path, digest});
  }));
  verified.sort((a, b) => a.path.localeCompare(b.path));
  return {data, verified};
}

function buildFacts(d) {
  const {interviews: input, synthesis: syn, complete, selectedMd, screens} = d;

  // 入力：架空のヒアリングメモ。参加者3人・各5行・計15行、行IDは重ならない
  check(input.fictional === true && syn.meta && syn.meta.fictional === true, '架空の入力と整理であること');
  const people = input.participants;
  check(Array.isArray(people) && people.length === 3, '参加者は3人');
  const lineText = new Map(), lineOwner = new Map(), personById = new Map();
  people.forEach(p => {
    check(p.method === 'fictional_interview_self_report', `${p.id} は架空の自己申告`);
    check(Array.isArray(p.lines) && p.lines.length === 5, `${p.id} の行数`);
    personById.set(p.id, p);
    p.lines.forEach(l => {
      check(!lineText.has(l.id) && l.id.startsWith(p.id + '-L') && typeof l.text === 'string', `行ID ${l.id}`);
      lineText.set(l.id, l.text);
      lineOwner.set(l.id, p.id);
    });
  });
  check(lineText.size === 15, '原文は15行');
  check(syn.meta.participant_count === people.length, '整理の参加者数');
  check(typeof syn.meta.method === 'string' && syn.meta.method.includes(SOURCE_COMMIT.slice(0, 7)), '固定版の記録');

  // 観察：15行それぞれ1件。引用は原文の同じ行と完全に一致
  check(Array.isArray(syn.observations) && syn.observations.length === 15, '観察は15件');
  const obs = new Map();
  syn.observations.forEach(o => {
    check(!obs.has(o.id), `観察 ${o.id} の重複`);
    check(lineText.get(o.line_id) === o.quote, `${o.line_id} の引用が原文と違います`);
    check(lineOwner.get(o.line_id) === o.source_id, `${o.line_id} の参加者`);
    obs.set(o.id, o);
  });
  check(new Set(syn.observations.map(o => o.line_id)).size === 15, '観察が15行を1回ずつ使う');

  // 発見：人数は根拠の観察の、別々の参加者の数。反する発言は支持の行に入らない
  check(Array.isArray(syn.findings) && syn.findings.length === 5, '発見は5件');
  const byId = new Map();
  syn.findings.forEach(f => {
    const support = f.observation_ids.map(id => {
      const o = obs.get(id);
      check(o, `${f.id} の観察 ${id}`);
      return o;
    });
    const distinct = [...new Set(support.map(o => o.source_id))].sort();
    check(sameList(distinct, [...f.participant_ids].sort()) && f.frequency === distinct.length, `${f.id} の人数`);
    check(Array.isArray(f.contradictions), `${f.id} の反する発言`);
    f.contradictions.forEach(c => {
      check(lineText.has(c.line_id) && !support.some(o => o.line_id === c.line_id), `${f.id} の反する発言 ${c.line_id}`);
    });
    check(Object.hasOwn(CONF, f.confidence), `${f.id} の確からしさ`);
    byId.set(f.id, {...f, support});
  });
  syn.recommendations.forEach(r => r.finding_ids.forEach(id => check(byId.has(id), `提案 ${r.id} の発見 ${id}`)));

  // ブラウザーで保存した整理全体：値が synthesis.json と同じ
  check(deepEqual(complete, syn), '保存した整理全体のJSONが synthesis.json と違います');

  // 大きく見せる発見：支持は1人（P03-L02）、反する発言は P02-L04、P01-L02 はどちらにも数えない
  const focus = byId.get(FOCUS);
  check(focus && focus.frequency === 1 && sameList(focus.participant_ids, ['P03']), `${FOCUS} の支持`);
  check(focus.support.length === 1 && focus.support[0].line_id === SUPPORT_LINE, `${FOCUS} の支持の行`);
  check(focus.contradictions.length === 1 && focus.contradictions[0].line_id === CONTRA_LINE, `${FOCUS} の反する発言`);
  check(focus.summary.includes(NEUTRAL_LINE) && lineOwner.get(NEUTRAL_LINE) !== 'P03' && NEUTRAL_LINE !== CONTRA_LINE, `${NEUTRAL_LINE} の扱い`);

  // 用途の違い：3行とも F03 の根拠。抜粋は本文にそのまま含まれる
  const purpose = byId.get(PURPOSE);
  check(purpose && purpose.frequency === 3, `${PURPOSE} の人数`);
  const purposeRows = PURPOSE_ROWS.map(r => {
    const o = purpose.support.find(s => s.line_id === r.line);
    check(o, `${PURPOSE} の根拠 ${r.line}`);
    const full = lineText.get(r.line);
    check(full.includes(r.excerpt), `${r.line} の抜粋が原文にありません`);
    if (r.inText) check(full.includes(r.label), `${r.line} の用途「${r.label}」`);
    if (r.kind) check(o.kind === r.kind, `${r.line} の種類`);
    return {...r, pid: o.source_id};
  });
  const purposeSentences = purpose.summary.split('。').filter(Boolean);
  const purposeNote = purposeSentences[purposeSentences.length - 1] + '。';
  check(purposeNote.includes('用途'), `${PURPOSE} の解釈の文`);

  // ブラウザーで保存した選んだ発見の Markdown：原文の引用と反する発言、固定原典を含む
  const md = selectedMd.replace(/\r\n?/g, '\n').split('\n');
  const title = `# ${focus.id} ${focus.title}`;
  check(md[0] === title, 'Markdownの見出し');
  const freqLine = `- 支持する参加者：${focus.frequency}/${people.length}人（${focus.participant_ids.join('・')}）`;
  check(md.includes(freqLine), 'Markdownの人数');
  const section = (prefix, lineId, quote) => {
    const i = md.findIndex(l => l.startsWith(prefix));
    check(i > 0, `Markdownの「${prefix}」`);
    const idLine = md.slice(i + 1).find(l => l.startsWith('- '));
    const quoteLine = md.slice(i + 1).find(l => l.trim().startsWith('> '));
    check(idLine && idLine.startsWith(`- ${lineId}（`), `Markdownの ${lineId}`);
    check(quoteLine && quoteLine.trim() === '> ' + quote, `Markdownの ${lineId} の引用`);
    return {head: md[i], id: idLine, quote: quoteLine.trim()};
  };
  const mdSupport = section('## 支持する発言', SUPPORT_LINE, lineText.get(SUPPORT_LINE));
  const mdContra = section('## 反する発言', CONTRA_LINE, lineText.get(CONTRA_LINE));
  check(selectedMd.includes(focus.next_step) && selectedMd.includes(SKILL_URL) && selectedMd.includes('架空'), 'Markdownの次の一歩・固定原典・架空の注記');

  // 実画面：記録の SHA-256・大きさ・選んでいた発見、切り抜きが記録の範囲を含むこと
  check(Array.isArray(screens.screens) && screens.screens.length === 6, '実画面の記録');
  const keyOf = file => FILES['video/assets/' + file] && FILES['video/assets/' + file].key;
  const selected = {'desktop-first.png': 'F01', 'desktop-notifications.png': PURPOSE, 'desktop-calendar.png': FOCUS, 'desktop-origin.png': FOCUS};
  screens.screens.forEach(s => {
    const img = d[keyOf(s.file)];
    check(img && img.width === s.width && img.height === s.height, `${s.file} の大きさ`);
    if (selected[s.file]) check(s.dom_capture && s.dom_capture.selected === selected[s.file], `${s.file} で選んでいた発見`);
  });
  for (const [name, crop] of Object.entries(CROPS)) {
    const img = d[crop.img];
    check(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= img.width && crop.y + crop.h <= img.height, `${name} の切り抜き範囲`);
    if (crop.contains) {
      const [file, ...ids] = crop.contains;
      const regions = screens.screens.find(s => s.file === file).dom_capture.regions;
      ids.forEach(id => {
        const r = regions.find(g => g.id === id);
        check(r && r.x >= crop.x && r.y >= crop.y && r.x + r.width <= crop.x + crop.w && r.y + r.height <= crop.y + crop.h, `${name} が ${id} を含む`);
      });
    }
  }

  const label = id => ({id, pid: lineOwner.get(id), segment: personById.get(lineOwner.get(id)).segment, text: lineText.get(id)});
  return {
    img: d,
    n: people.length,
    lineCount: lineText.size,
    obsCount: obs.size,
    question: input.research_question,
    memoLines: [NEUTRAL_LINE, CONTRA_LINE, SUPPORT_LINE].map(label).sort((a, b) => a.pid.localeCompare(b.pid)),
    findings: syn.findings.map(f => byId.get(f.id)),
    focus,
    support: label(SUPPORT_LINE),
    contra: label(CONTRA_LINE),
    purpose,
    purposeRows,
    purposeNote,
    md: {title, freq: freqLine, support: mdSupport, contra: mdContra}
  };
}

// ---- 描画の部品 ------------------------------------------------------------
function font(o) {
  const family = o.family === 'serif' ? SERIF : o.family === 'mono' ? MONO : SANS;
  return `${o.weight || 400} ${o.size || 18}px ${family}`;
}
function text(c, s, x, y, o = {}) {
  c.save();
  c.font = font(o);
  c.fillStyle = o.color || C.ink;
  c.textAlign = o.align || 'left';
  c.textBaseline = 'alphabetic';
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
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
// 日本語の折り返し：測った幅で折り、行頭・行末の禁則を守る。英数字の語とIDは分けない
const NO_START = '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ…‥';
const NO_END = '（「『【〔〈《';
function greedy(c, s, maxWidth) {
  const lines = [];
  for (const para of String(s).split('\n')) {
    const tokens = para.match(/[A-Za-z0-9][A-Za-z0-9.,:=_\-/@]*|\s+|[\s\S]/gu) || [];
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
        line = carry;
      } else {
        line = next;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
// 行数を変えずに、いちばん狭く収まる幅で折り直す（最後の行に1〜2字だけ残さない）
function wrap(c, s, maxWidth, o) {
  c.save();
  c.font = font(o);
  let lines = greedy(c, s, maxWidth);
  if (lines.length > 1) {
    let lo = maxWidth * 0.4, hi = maxWidth;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (greedy(c, s, mid).length <= lines.length) hi = mid;
      else lo = mid;
    }
    lines = greedy(c, s, hi);
  }
  c.restore();
  return lines;
}
// 折り返して描き、最後の行のベースラインを返す
function block(c, s, x, y, maxWidth, lineHeight, o) {
  const lines = wrap(c, s, maxWidth, o);
  lines.forEach((line, i) => text(c, line, x, y + i * lineHeight, o));
  return y + (lines.length - 1) * lineHeight;
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
function card(c, x, y, w, h, o = {}) {
  c.save();
  c.shadowColor = 'rgba(29, 27, 24, 0.10)';
  c.shadowBlur = 16;
  c.shadowOffsetY = 5;
  roundRect(c, x, y, w, h, o.r || 10);
  c.fillStyle = o.fill || C.card;
  c.fill();
  c.restore();
  roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, o.r || 10);
  c.strokeStyle = o.stroke || C.rule;
  c.lineWidth = 1;
  c.stroke();
}
function pill(c, label, x, y, h, o) {
  c.save();
  c.font = font(o);
  const w = o.width || Math.ceil(c.measureText(label).width) + 2 * (o.pad === undefined ? 14 : o.pad);
  roundRect(c, x, y, w, h, o.radius === undefined ? h / 2 : o.radius);
  if (o.fill) {
    c.fillStyle = o.fill;
    c.fill();
  }
  if (o.stroke) {
    c.strokeStyle = o.stroke;
    c.lineWidth = o.lineWidth || 1.5;
    c.stroke();
  }
  c.fillStyle = o.color || C.ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, x + w / 2, y + h / 2 + 1);
  c.restore();
  return w;
}
function rule(c, x, y1, y2, color, width) {
  c.save();
  c.fillStyle = color;
  c.fillRect(x, y1, width, Math.max(2, y2 - y1));
  c.restore();
}
function label(c, s, x, y, o = {}) {
  text(c, s, x, y, {size: 17, weight: 600, color: C.muted, ...o});
}

// 実画面の切り抜きを、等倍率でそのまま置く（画素は変えず、文字も重ねない）
function drawShot(c, f, key, alpha, dy = 0) {
  if (alpha <= 0.001) return null;
  const crop = CROPS[key], place = PLACE[key], img = f.img[crop.img];
  const x = place.x, y = place.y + dy, w = crop.w * place.s, h = crop.h * place.s;
  c.save();
  c.globalAlpha *= alpha;
  c.save();
  c.shadowColor = 'rgba(29, 27, 24, 0.14)';
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
  c.strokeStyle = C.rule;
  c.lineWidth = 1;
  c.stroke();
  c.restore();
  return {x, y, w, h, s: place.s, crop};
}
const toScreen = (shot, r) => ({
  x: shot.x + (r.x - shot.crop.x) * shot.s,
  y: shot.y + (r.y - shot.crop.y) * shot.s,
  w: r.w * shot.s,
  h: r.h * shot.s
});
// 実画面の上に重ねる枠（映像側の注目の印。画面の中身は変えない）
function focusBox(c, r, color, alpha) {
  if (alpha <= 0.001) return;
  c.save();
  c.globalAlpha *= alpha;
  roundRect(c, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8);
  c.strokeStyle = color;
  c.lineWidth = 3;
  c.stroke();
  c.restore();
}
// 枠と説明をつなぐ線。k で始点から伸びる（時刻から直接求める）
function connector(c, x1, y1, x2, y2, color, k) {
  if (k <= 0.001) return;
  const ex = lerp(x1, x2, k), ey = lerp(y1, y2, k);
  c.save();
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(ex, ey);
  c.stroke();
  c.beginPath();
  c.arc(x1, y1, 4.5, 0, Math.PI * 2);
  c.fill();
  if (k >= 0.999) {
    c.beginPath();
    c.arc(x2, y2, 4.5, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// ---- いつも出ている枠：上の4段階と、足元の範囲の注記 -------------------------
function sceneIndex(t) {
  const i = SCENES.findIndex(s => t < s.end);
  return i < 0 ? SCENES.length - 1 : i;
}
function drawChrome(c, t, live) {
  text(c, 'Studio Yebisu ・ Synthesize Research 作例', 80, 44, {size: 17, weight: 600, color: C.muted});
  const o = {size: 18, weight: 700};
  const weight = STEPS.map((_, k) => (live ? clamp01(SCENES.reduce((sum, s, i) => sum + (s.step === k ? sceneAlpha(t, i) : 0), 0)) : 0));
  const current = live ? SCENES[sceneIndex(t)].step : -1;
  const widths = STEPS.map(s => Math.ceil(measure(c, s, o)) + 28);
  const arrow = 34;
  let x = 1200 - widths.reduce((a, w) => a + w, 0) - arrow * (STEPS.length - 1);
  STEPS.forEach((s, k) => {
    const on = weight[k];
    const base = k < current ? C.ink : C.muted;
    c.save();
    c.globalAlpha = 1 - on;
    pill(c, s, x, 24, 32, {...o, stroke: C.rule, lineWidth: 1, color: base, width: widths[k]});
    c.globalAlpha = on;
    pill(c, s, x, 24, 32, {...o, fill: C.green, color: '#ffffff', width: widths[k]});
    c.restore();
    x += widths[k];
    if (k < STEPS.length - 1) text(c, '→', x + arrow / 2, 46, {size: 18, weight: 700, color: C.quiet, align: 'center'});
    x += arrow;
  });
  c.save();
  c.fillStyle = C.rule;
  c.fillRect(80, 66, 1120, 1);
  c.fillRect(80, 664, 1120, 1);
  c.restore();
  text(c, FOOTER, 80, 697, {size: 18, weight: 700, color: C.ink});
  text(c, `knowledge-work-plugins ${SOURCE_COMMIT.slice(0, 7)} ・ Apache-2.0`, 1200, 697, {size: 17, weight: 500, color: C.muted, align: 'right'});
}

function drawHeadlines(c, t, f) {
  SCENES.forEach((s, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    const dy = i === 0 ? 0 : 8 * (1 - easeOut(prog(t, s.start - 0.05, s.start + 0.4)));
    text(c, s.headline(f), 80, 118 + dy, {size: 42, weight: 600, family: 'serif', alpha: a});
  });
}

// ---- 場面 ------------------------------------------------------------------
// 0〜4.5秒：問いと、原文の3行（空き日の探し方）。整理の結果はまだ出さない
function drawMemo(c, t, f) {
  const a = sceneAlpha(t, 0);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a * enter(t, 0, 0.35);
  const pw = pill(c, '問い', 80, 150, 36, {size: 18, weight: 700, fill: C.greenSoft, color: C.greenInk, pad: 14});
  block(c, f.question, 80 + pw + 16, 177, 1120 - pw - 16, 34, {size: 26, weight: 600});
  c.globalAlpha = a;
  label(c, '作例の実画面・最初の画面', 80, 222);
  drawShot(c, f, 'phoneTop', enter(t, 0.15, 0.4), rise(t, 0.15));
  label(c, `原文の3行（架空メモ${f.n}人・${f.lineCount}行のうち、空き日の探し方）`, 488, 222);
  f.memoLines.forEach((m, i) => {
    const at = 0.3 + i * 0.14;
    c.globalAlpha = a * enter(t, at);
    const y = 234 + i * 136 + rise(t, at);
    card(c, 488, y, 712, 128);
    text(c, m.id, 512, y + 32, {size: 18, weight: 700, family: 'mono', color: C.greenInk});
    text(c, `${m.pid}・${m.segment}`, 512 + measure(c, m.id, {size: 18, weight: 700, family: 'mono'}) + 14, y + 32, {size: 18, color: C.muted});
    block(c, m.text, 512, y + 74, 664, 36, {size: 26, family: 'serif'});
  });
  c.restore();
}

// 4.5〜7.5秒：保存済みの発見5件（実画面の一覧と、読める大きさの一覧）
function drawFindings(c, t, f) {
  const a = sceneAlpha(t, 1);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a;
  label(c, '実画面・発見の一覧（開いた直後）', 80, 154);
  drawShot(c, f, 'list', 1, rise(t, 4.45, 0.45));
  label(c, '保存済みの整理 outputs/synthesis.json', 532, 154);
  const hl = enter(t, 6.6, 0.4);
  f.findings.forEach((g, i) => {
    const y = 198 + i * 82;
    const at = 4.6 + i * 0.08;
    c.globalAlpha = a * enter(t, at, 0.35);
    const dy = rise(t, at, 0.35, 8);
    if (g.id === FOCUS && hl > 0) {
      c.save();
      c.globalAlpha *= hl;
      roundRect(c, 516, y - 36 + dy, 684, 78, 8);
      c.fillStyle = C.greenSoft;
      c.fill();
      c.fillStyle = C.green;
      c.fillRect(516, y - 36 + dy, 5, 78);
      c.restore();
    }
    text(c, g.id, 536, y + dy, {size: 20, weight: 700, family: 'mono', color: C.greenInk});
    text(c, g.title, 598, y + dy, {size: 26, weight: 700});
    const contra = g.contradictions.length ? `・反する発言 ${g.contradictions.length}` : '';
    text(c, `${g.frequency}/${f.n}人・確からしさ ${CONF[g.confidence]}${contra}`, 598, y + 30 + dy, {size: 18, color: C.muted});
  });
  c.globalAlpha = a * enter(t, 5.2);
  block(c, `人数は、この架空の${f.n}人のうち何人か。利用者全体の割合ではありません。並びも暫定です。`, 532, 606, 668, 26, {size: 18, color: C.muted});
  c.restore();
}

// 7.5〜14秒：F05。支持1人の原文と、別に置いた反する発言（ポスターは13.5秒）
function drawFocus(c, t, f) {
  const a = sceneAlpha(t, 2);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a;
  label(c, `実画面・${f.focus.id} の詳細（支持する発言と反する発言）`, 80, 154);
  const shot = drawShot(c, f, 'calendar', 1, rise(t, 7.45, 0.45));
  const sb = toScreen(shot, BOX.support), cb = toScreen(shot, BOX.contra);
  focusBox(c, sb, C.green, enter(t, 8.2));
  focusBox(c, cb, C.amber, enter(t, 9.8));

  const X = 740, W = 460;
  // 支持する発言（原文のまま）
  const k1 = enter(t, 7.9), d1 = rise(t, 7.9);
  c.globalAlpha = a * k1;
  text(c, '支持する発言（原文のまま）', X, 176 + d1, {size: 18, weight: 700, color: C.green});
  text(c, f.support.id, X + W, 176 + d1, {size: 18, weight: 700, family: 'mono', color: C.greenInk, align: 'right'});
  const qEnd = block(c, f.support.text, X + 18, 218 + d1, W - 18, 40, {size: 28, family: 'serif'});
  rule(c, X, 192 + d1, qEnd + 12, C.green, 4);
  // 人数
  const k2 = enter(t, 8.5), d2 = rise(t, 8.5);
  c.globalAlpha = a * k2;
  const big = `${f.focus.frequency}/${f.n}人`;
  const countY = qEnd + 66 + d2;
  text(c, big, X, countY, {size: 52, weight: 700, color: C.green});
  text(c, `（${f.focus.participant_ids.join('・')}）だけ`, X + measure(c, big, {size: 52, weight: 700}) + 8, countY, {size: 26, weight: 700});
  // 反する発言（支持に数えない）
  const k3 = enter(t, 9.9), d3 = rise(t, 9.9);
  c.globalAlpha = a * k3;
  const cTop = countY + 50 + d3;
  text(c, '反する発言（別の欄）', X, cTop, {size: 18, weight: 700, color: C.amber});
  text(c, f.contra.id, X + W, cTop, {size: 18, weight: 700, family: 'mono', color: C.amber, align: 'right'});
  const cEnd = block(c, f.contra.text, X + 18, cTop + 38, W - 18, 36, {size: 26, family: 'serif'});
  rule(c, X, cTop + 14, cEnd + 10, C.amber, 4);
  // 数え方
  const k4 = enter(t, 10.7), d4 = rise(t, 10.7);
  c.globalAlpha = a * k4;
  text(c, '反する発言は、支持に数えない。', X, cEnd + 52 + d4, {size: 26, weight: 700});
  const k5 = enter(t, 11.3);
  c.globalAlpha = a * k5;
  block(c, `確からしさ ${CONF[f.focus.confidence]}。${NEUTRAL_LINE} は支持にも反証にも数えない。人数はこの架空の${f.n}人の中だけ。`, X, cEnd + 88, W, 26, {size: 18, color: C.muted});
  // 枠と説明をつなぐ線
  c.globalAlpha = a;
  connector(c, sb.x + sb.w + 4, sb.y + sb.h * 0.42, X - 10, 210 + d1, C.green, enter(t, 8.6, 0.4));
  connector(c, cb.x + cb.w + 4, cb.y + cb.h * 0.42, X - 10, cTop + 28, C.amber, enter(t, 10.2, 0.4));
  c.restore();
}

// 14〜18秒：反する発言の原文の行（原文へ移った後の実画面）
function drawOrigin(c, t, f) {
  const a = sceneAlpha(t, 3);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a;
  label(c, `実画面・原文のメモ ${f.contra.pid}（行へ移った後の静止画）`, 80, 154);
  const shot = drawShot(c, f, 'origin', 1, rise(t, 13.95, 0.45));
  const lb = toScreen(shot, BOX.originLine);
  focusBox(c, lb, C.green, enter(t, 14.6));
  // 発見の側から、同じ行IDへ
  const kc = enter(t, 14.9);
  c.globalAlpha = a * kc;
  const chipW = pill(c, `${f.focus.id} の反する発言 ${f.contra.id}`, 80, 440, 38, {size: 18, weight: 700, fill: C.amberSoft, color: C.amber, stroke: C.amber, lineWidth: 1.5, pad: 16});
  // 線はメモの枠の左の余白（文字のない所）を通して、行の枠へ
  c.globalAlpha = a;
  const midY = lb.y + lb.h / 2;
  connector(c, 92, 440, 92, midY, C.amber, enter(t, 15.0, 0.3));
  if (t >= 15.3) connector(c, 92, midY, lb.x - 5, midY, C.amber, enter(t, 15.3, 0.2));
  const kq = enter(t, 15.3), dq = rise(t, 15.3);
  c.globalAlpha = a * kq;
  text(c, `原文 ${f.contra.id}（input/interviews.json・${f.contra.pid}）`, 80 + chipW + 24, 466 + dq, {size: 18, weight: 600, color: C.muted});
  const qEnd = block(c, f.contra.text, 98, 534 + dq, 1102, 42, {size: 30, family: 'serif'});
  rule(c, 80, 506 + dq, qEnd + 12, C.green, 4);
  const kn = enter(t, 15.8);
  c.globalAlpha = a * kn;
  text(c, '整理の中の引用は、この原文の行と同じ文。', 80, qEnd + 48, {size: 26, weight: 700});
  text(c, `${f.contra.pid}・${f.contra.segment}。支持の人数（${f.focus.frequency}/${f.n}人）には入れていません。`, 80, qEnd + 72, {size: 18, color: C.muted});
  c.restore();
}

// 18〜23秒：F03。控え・当日の変更・未定を、原文の抜粋のまま並べる
function drawPurpose(c, t, f) {
  const a = sceneAlpha(t, 4);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a;
  label(c, `実画面・${f.purpose.id} の支持する発言（3件のうち上の2件）`, 80, 154);
  drawShot(c, f, 'notify', 1, rise(t, 17.95, 0.45));
  const X = 690, W = 510;
  const k0 = enter(t, 18.2), d0 = rise(t, 18.2);
  c.globalAlpha = a * k0;
  text(c, f.purpose.title, X, 190 + d0, {size: 26, weight: 700});
  text(c, `${f.purpose.id}・${f.purpose.frequency}/${f.n}人・確からしさ ${CONF[f.purpose.confidence]}（暫定）`, X, 220 + d0, {size: 18, color: C.muted});
  text(c, '原文から抜粋（全文は原文の行に）', X, 262 + d0, {size: 17, weight: 700, color: C.green});
  f.purposeRows.forEach((r, i) => {
    const at = 18.5 + i * 0.4;
    c.globalAlpha = a * enter(t, at);
    const y = 306 + i * 92 + rise(t, at);
    rule(c, X, y - 26, y + 50, C.green, 4);
    text(c, r.label, X + 18, y, {size: 28, weight: 700, color: C.green});
    text(c, `${r.pid}・${r.line}`, X + 18 + measure(c, r.label, {size: 28, weight: 700}) + 14, y, {size: 18, weight: 600, family: 'mono', color: C.muted});
    block(c, r.excerpt, X + 18, y + 40, W - 18, 34, {size: 26, family: 'serif'});
  });
  const k4 = enter(t, 20.0), d4 = rise(t, 20.0);
  c.globalAlpha = a * k4;
  text(c, '一つの手段に決める根拠にはしない。', 80, 612 + d4, {size: 26, weight: 700});
  const k5 = enter(t, 20.4);
  c.globalAlpha = a * k5;
  text(c, '整理者の解釈：' + f.purposeNote, 80, 644, {size: 18, color: C.muted});
  c.restore();
}

// 23〜28秒：ブラウザーで保存した選んだ発見の Markdown と、スマホ幅の実画面（最後は止めて読む）
function drawSave(c, t, f) {
  const a = sceneAlpha(t, 5);
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha = a;
  label(c, `作例の実画面・${f.focus.id}`, 80, 154, {weight: 700, color: C.ink});
  const ph = drawShot(c, f, 'phone', enter(t, 23.0), rise(t, 23.0));
  if (ph) {
    roundRect(c, ph.x - 6, ph.y - 6, ph.w + 12, ph.h + 12, 16);
    c.strokeStyle = C.ink;
    c.lineWidth = 2;
    c.stroke();
  }
  // 保存した実ファイルの抜粋（行はファイルのまま）
  const kc = enter(t, 23.15, 0.4), dc = rise(t, 23.15, 0.4);
  c.globalAlpha = a * kc;
  const X = 336, W = 864, top = 146 + dc;
  const ix = X + 24, iw = W - 48, q = {size: 26, family: 'serif'};
  const extra = 34 * (wrap(c, f.md.support.quote, iw, q).length - 1 + wrap(c, f.md.contra.quote, iw, q).length - 1);
  const H = 360 + extra;
  card(c, X, top, W, H);
  text(c, `synthesis-${f.focus.id}.md`, ix, top + 34, {size: 22, weight: 700, family: 'mono', color: C.green});
  text(c, '保存した実ファイル outputs/browser-selected.md の抜粋', X + W - 24, top + 34, {size: 17, color: C.muted, align: 'right'});
  c.fillStyle = C.rule;
  c.fillRect(ix, top + 50, iw, 1);
  text(c, f.md.title, ix, top + 88, {size: 26, weight: 700});
  text(c, f.md.freq, ix, top + 126, {size: 26, weight: 700, color: C.green});
  text(c, f.md.support.head, ix, top + 166, {size: 18, weight: 700, color: C.green});
  text(c, f.md.support.id, ix, top + 192, {size: 17, color: C.muted});
  const sEnd = block(c, f.md.support.quote, ix, top + 228, iw, 34, {size: 26, family: 'serif'});
  text(c, f.md.contra.head, ix, sEnd + 40, {size: 18, weight: 700, color: C.amber});
  text(c, f.md.contra.id, ix, sEnd + 66, {size: 17, color: C.muted});
  block(c, f.md.contra.quote, ix, sEnd + 102, iw, 34, {size: 26, family: 'serif'});
  // 作例のページで試す順番
  let x = X;
  const ctaY = 146 + H + 16;
  ['発見を選ぶ', '原文を読む', '保存'].forEach((s, i) => {
    const at = 23.35 + i * 0.05;
    c.globalAlpha = a * enter(t, at);
    const last = i === 2;
    const w = pill(c, s, x, ctaY + rise(t, at, 0.4, 8), 54, {size: 26, weight: 700, fill: last ? C.green : C.card, stroke: C.green, lineWidth: 2, color: last ? '#ffffff' : C.green, pad: 24});
    x += w;
    if (i < 2) {
      text(c, '→', x + 22, ctaY + 37, {size: 26, weight: 700, color: C.quiet, align: 'center'});
      x += 44;
    }
  });
  c.globalAlpha = a * enter(t, 23.55);
  text(c, 'ページを開いてもAIは動きません。表示も保存も、保存済みの整理から。', X, 642, {size: 18, color: C.muted});
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
  drawChrome(ctx, t, Boolean(facts));
  if (!facts) {
    const message = failure ? '読み込みに失敗しました。代わりの映像は出しません。' : '保存済みのファイルと実画面を確かめています…';
    text(ctx, message, 80, 300, {size: 26, weight: 700, color: failure ? '#8a1f2d' : C.muted});
    if (failure) block(ctx, failure.message, 80, 344, 1120, 28, {size: 18, color: C.ink});
    return;
  }
  drawHeadlines(ctx, t, facts);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, CONTENT_TOP, LW, CONTENT_BOTTOM - CONTENT_TOP);
  ctx.clip();
  drawMemo(ctx, t, facts);
  drawFindings(ctx, t, facts);
  drawFocus(ctx, t, facts);
  drawOrigin(ctx, t, facts);
  drawPurpose(ctx, t, facts);
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
  const fontSpecs = [`600 42px ${SERIF}`, `400 26px ${SERIF}`, `700 26px ${SANS}`, `400 18px ${SANS}`, `700 18px ${MONO}`];
  await Promise.all(fontSpecs.map(spec => document.fonts.load(spec, '月表示を望むのは原文P02-L04')));
  await document.fonts.ready;
  const {data, verified} = await loadAll();
  const built = buildFacts(data);
  facts = built;
  render(currentT);
  setStatus('ready', `照合した${verified.length}ファイルから描いています`,
    `原文${built.lineCount}行・観察${built.obsCount}件・発見${built.findings.length}件の引用と人数、保存した2ファイルの中身を確かめました。整理を新しく行う機能はありません。`);
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
// 自動では再生しない（prefers-reduced-motion の設定にかかわらず、最初は停止）。再生は「再生」を押したときだけ
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
    render(currentT);
    sync();
  }

  play.addEventListener('click', () => (playing ? stop() : start()));
  // 矢印・Home・End はスライダー標準のまま
  range.addEventListener('input', () => jump(Number(range.value)));
  // PageUp/PageDown は2秒ずつ（Home から7回で14秒）
  range.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      jump(Math.round((currentT + (event.key === 'PageUp' ? 2 : -2)) * 10) / 10);
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
