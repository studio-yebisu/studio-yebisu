// Studio Yebisu: Humanizer作例 — 編集動画（28秒・無音）
// Copyright (c) 2026 Studio Yebisu. MIT License.
// 保存済みの inputs/jobs.json・outputs/revisions.json と、保存結果ビューアの実際のスクリーンショットだけを読み、
// window.seek(秒) が任意の時刻の完成した画面を1枚のCanvasへ描く。AIの実行や文章の書き直しはしない。

const RC = window.renderConfig || {};
const pickNum = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
const W = pickNum(RC.width, 1280), H = pickNum(RC.height, 720), FPS = pickNum(RC.fps, 30);
const DURATION = 28, POSTER = 13.5;
const RENDER = window.__MOTION_RENDER__ === true;
window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER, audioEvents: []};
if (RENDER) document.documentElement.classList.add('render');

const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",system-ui,sans-serif';
const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP","Source Han Serif JP",Georgia,serif';
const MONO = '"SFMono-Regular",Consolas,"Liberation Mono",monospace';
// 作例ページ（style.css）と同じ紙・墨・削除・保持の色
const C = {
  paper: '#faf8f2', sheet: '#fffdf8', ink: '#24342b', soft: '#4b5a50', rule: '#d9d3c3',
  cut: '#b34d36', cutWash: '#f6e3dc', keep: '#23634a', keepWash: '#dcebe2', white: '#ffffff', error: '#8a2a1c',
};
const M = 64, CW = 1152, RX = M + CW; // 安全余白64px

// 場面の時刻。storyboard.json と同じ値。
const SCENES = [
  {id: 'pass', step: '渡す', start: 0, end: 4},
  {id: 'cut', step: '削る', start: 4, end: 10},
  {id: 'keep', step: '残す', start: 10, end: 16},
  {id: 'answer', step: '答えを先に', start: 16, end: 22},
  {id: 'compare', step: '読み比べる', start: 22, end: 28},
];

// 素材一覧（outputs/movie-materials.json）にある実際のスクリーンショットのうち、使う2枚
const SHOTS = {japanese: 'assets/desk-japanese.png', top: 'assets/desk-top.png'};
// 切り抜きは元画像の座標。表示先と同じ縦横比で描き、伸縮させない。
const DESK = {x: 40, y: 180, w: 1170, h: 442};
const RINGS = [
  {box: [64, 240, 592, 302], tag: '削った文（番号つき）', at: 'below-left', t0: 22.5},
  {box: [650, 278, 1180, 372], tag: '残した条件の位置', at: 'below-right', t0: 22.9},
  {box: [54, 573, 193, 615], tag: '初稿と点検を開く', at: 'right', t0: 23.3},
];
const FILES = {x: 18, y: 372, w: 372, h: 74};
const FILE_ROWS = [
  {name: 'revisions.md', sx: 41, sy: 426, label: '推敲メモ（同じ内容を日本語で）'},
  {name: 'revisions.json', sx: 221, sy: 426, label: '結果データ（印・初稿・点検・最終稿・理由）'},
];
const SECTION_JA = {1: '「XではなくY」の対比'}; // 作例ビューア（app.mjs）と同じ訳

const canvas = document.getElementById('film');
let ctx = canvas.getContext('2d', {willReadFrequently: true});
const IMG = {};
let D = null, ready = false;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const out3 = p => 1 - (1 - p) ** 3;
const inOut = p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const lerp = (a, b, p) => a + (b - a) * p;
const lerpRect = (a, b, p) => ({x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p)});
const enter = (t, t0, dur = 0.45) => { const p = out3(prog(t, t0, t0 + dur)); return {a: p, dy: (1 - p) * 14}; };
const leave = (t, t0, dur = 0.4) => 1 - prog(t, t0, t0 + dur);

// ---------- 素材の読み込み（ハッシュと寸法を素材一覧と照合） ----------

const here = path => new URL('../' + path, import.meta.url);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const json = buf => JSON.parse(new TextDecoder('utf-8').decode(buf));

async function bytes(path) {
  let res;
  try { res = await fetch(here(path), {cache: 'no-store'}); }
  catch { throw new Error(`${path} を読み込めませんでした。HTTPで配信して開いてください。`); }
  if (!res.ok) throw new Error(`${path} を読み込めませんでした（HTTP ${res.status}）。`);
  return res.arrayBuffer();
}

async function verified(path, sha) {
  const buf = await bytes(path);
  if (!window.crypto || !crypto.subtle) throw new Error('SHA-256を確認できません。localhostのHTTPで開いてください。');
  if (hex(await crypto.subtle.digest('SHA-256', buf)) !== sha) throw new Error(`${path} のSHA-256が素材一覧と一致しません。`);
  return buf;
}

const sentences = s => s.match(/[^。]+。/g) || [];

// 保存データから、動画に出す引用をそのまま取り出す。言い換えや打ち直しはしない。
function select(source, result) {
  const fail = m => { throw new Error(`保存データから動画の引用を取り出せません（${m}）。`); };
  const must = (ok, m) => { if (!ok) fail(m); };
  must(source.fictional === true && result.fictional === true, '架空の入力であることの表示');
  const pair = id => {
    const s = (source.jobs || []).find(j => j.id === id), r = (result.jobs || []).find(j => j.id === id);
    must(s && r, `${id} がありません`);
    must(s.input === r.input, `${id} の原文が入力ファイルと一致しません`);
    return [s, r];
  };
  const [js, jr] = pair('japanese');
  const [rs, rr] = pair('reply');
  const product = String(source.product || '').split('（')[0];
  must(product && js.input.includes(product), '製品名');

  // 1. 渡すもの（日本語への適用例）
  const paras = js.input.split('\n\n');
  const reader = sentences(js.reader_context).slice(0, 2).join('');
  must(reader && js.reader_context.startsWith(reader), '読み手');
  const labels = (js.facts || []).map(f => f.label);
  must(labels.length > 0, '残す条件');

  // 2. 削る：§1の印が付いた一文と、その削除の理由
  const mark = (jr.marks || []).find(m => m.pattern === 'Not X but Y');
  must(mark && paras[0].includes(mark.quote), '§1の印');
  const cut = (jr.changes || []).find(c => c.before === mark.quote);
  must(cut && cut.after === '' && !jr.final.includes(mark.quote), '削除の記録');

  // 3. 残す：対象と除外の2文
  const keep = (jr.facts || []).find(f => f.label === '対象と除外');
  const keepSrc = keep && (js.facts || []).find(f => f.id === keep.id);
  must(keep && keepSrc && keepSrc.source_quote === keep.source_quote, '対象と除外の条件');
  must(js.input.includes(keep.source_quote) && jr.final.includes(keep.final_quote), '対象と除外の引用位置');
  must(keep.source_quote === keep.final_quote, '対象と除外が原文と同じ文字列');
  const kept = sentences(keep.final_quote);
  must(kept.length === 2 && kept.join('') === keep.final_quote, '対象と除外の2文');
  const neg = '含まれません';
  must(kept[1].includes(neg), '除外の否定文');

  // 4. 答えを先に（英語のサポート返信）
  const asked = (rs.reader_context.match(/"([^"]+)"/) || [])[1] || '';
  const question = ((asked.match(/[^.?!]+[.?!]/g) || []).map(s => s.trim()).at(-1)) || '';
  must(question.endsWith('?') && rs.reader_context.includes(question), '利用者の質問');
  const answer = (rr.facts || []).find(f => f.id === 'reply-1');
  must(answer && answer.source_quote === answer.final_quote && rr.final.startsWith(answer.final_quote), '答えの文');
  const unsure = (rr.facts || []).find(f => f.id === 'reply-4');
  must(unsure && unsure.source_quote === unsure.final_quote && rr.final.endsWith(unsure.final_quote), '時間の見込みの文');
  must(/^Large\b/.test(unsure.final_quote) && /\bmay\b/.test(unsure.final_quote), 'Large・may');
  const residue = (rr.changes || []).filter(c => c.after === '' && (c.sections || []).includes(22)).map(c => c.before);
  must(residue.length === 2 && residue.every(q => rs.input.includes(q) && !rr.final.includes(q)), '削った決まり文句');

  // 5. 読み比べる
  must((result.jobs || []).every(j => typeof j.first_draft === 'string' && Array.isArray(j.remaining_patterns) && typeof j.final === 'string'), '初稿・点検・最終稿');
  const noRun = sentences(result.scope_note || '').find(s => s.includes('AIは実行されません'));
  must(noRun, 'AIを実行しないことの注記');

  return {
    product, jobCount: result.jobs.length, noRun,
    ja: {
      label: js.label, paraCount: paras.length, para1: paras[0], reader, labels,
      cut: {quote: mark.quote, section: mark.section, pattern: mark.pattern, reason: cut.reason},
      keep: {id: keep.id, label: keep.label, sentences: kept, note: keep.note, neg},
    },
    reply: {label: rs.label, question, residue, answer, unsure},
  };
}

async function load() {
  const materials = json(await bytes('outputs/movie-materials.json'));
  if (materials.fictional !== true || materials.audio !== 'silent') throw new Error('素材一覧が、架空の入力・無音の動画用ではありません。');
  const entries = Object.entries(SHOTS).map(([key, path]) => {
    const entry = (materials.screenshots || []).find(s => s.path === path);
    if (!entry) throw new Error(`素材一覧に ${path} がありません。`);
    return [key, entry];
  });
  for (const k of ['inputs', 'results', 'memo']) {
    if (!materials[k] || !materials[k].path || !materials[k].sha256) throw new Error(`素材一覧に ${k} がありません。`);
  }
  const fontLoads = [`600 52px ${SERIF}`, `400 36px ${SERIF}`, `700 24px ${SANS}`, `400 24px ${SANS}`, `700 30px ${MONO}`]
    .map(f => document.fonts.load(f, '原文と残す条件を渡すHumanizer'));
  const [source, result] = await Promise.all([
    verified(materials.inputs.path, materials.inputs.sha256).then(json),
    verified(materials.results.path, materials.results.sha256).then(json),
    // 推敲メモは映像に描かないが、持ち帰るファイルとして示すため実在と一致を確かめる
    verified(materials.memo.path, materials.memo.sha256),
  ]);
  await Promise.all(entries.map(async ([key, entry]) => {
    const buf = await verified(entry.path, entry.sha256);
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([buf], {type: 'image/png'}));
    try { await img.decode(); }
    catch { throw new Error(`${entry.path} を画像として読めませんでした。`); }
    if (img.naturalWidth !== entry.width || img.naturalHeight !== entry.height) throw new Error(`${entry.path} の寸法が素材一覧と一致しません。`);
    IMG[key] = img;
  }));
  await Promise.all(fontLoads);
  await document.fonts.ready;
  D = select(source, result);
}

// ---------- 描画の部品 ----------

function font(weight, size, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }

function layer(a, dy, fn) {
  if (a <= 0.001) return;
  ctx.save(); ctx.globalAlpha *= a; if (dy) ctx.translate(0, dy); fn(); ctx.restore();
}

function clipRect(r, fn) { ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); fn(); ctx.restore(); }

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// 1行の文字。幅を超えるときは min まで縮める（それ以下にはしない）。
function text(str, x, y, {weight = 400, size = 24, family = SANS, color = C.ink, align = 'left', base = 'alphabetic', max = Infinity, min = size} = {}) {
  let s = size; font(weight, s, family);
  while (s > min && ctx.measureText(str).width > max) font(weight, --s, family);
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}

function tag(str, x, cy, {bg = C.sheet, fg = C.ink, border = C.ink, size = 20, weight = 700, align = 'left'} = {}) {
  font(weight, size); const w = ctx.measureText(str).width + 24, h = size + 14;
  const left = align === 'right' ? x - w : x;
  rr(left, cy - h / 2, w, h, 3); ctx.fillStyle = bg; ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(str, left + 12, cy + 1);
  return w;
}

function strike(x, y, w, p, lw = 3) {
  if (p <= 0) return;
  ctx.fillStyle = C.cut; ctx.fillRect(x - 4, y - lw / 2, (w + 8) * p, lw);
}

// 日本語の禁則を簡単に守る折り返し。各行の元の文字位置も返す。
const NO_START = '、。，．・：；？！）」』】〕〉》ーぁぃぅぇぉっゃゅょァィゥェォッャュョ';
const NO_END = '（「『【〔〈《';
function wrap(str, max) {
  const toks = [...str.matchAll(/[A-Za-z0-9_.,:;/@#%+'’?!-]+|\s+|./gu)].map(m => ({s: m[0], i: m.index}));
  const join = arr => arr.map(k => k.s).join('');
  const lines = []; let cur = [];
  for (const tok of toks) {
    if (cur.length && !/^\s+$/.test(tok.s) && ctx.measureText(join(cur) + tok.s).width > max) {
      const carry = [];
      if (cur.length > 1 && (NO_START.includes(tok.s[0]) || NO_END.includes(cur.at(-1).s.at(-1)))) carry.push(cur.pop());
      lines.push(cur); cur = [...carry, tok];
    } else cur.push(tok);
  }
  if (cur.length) lines.push(cur);
  return lines.map(l => {
    while (l.length && /^\s+$/.test(l[0].s)) l.shift();
    while (l.length && /^\s+$/.test(l.at(-1).s)) l.pop();
    return l.length ? {text: join(l), start: l[0].i, end: l.at(-1).i + l.at(-1).s.length} : {text: '', start: 0, end: 0};
  });
}

// 折り返した段落。mark で指定した文字範囲に削除の下地を敷ける。
function paragraph(str, x, y, max, lh, {weight = 400, size = 24, family = SANS, color = C.ink, mark = null, markAlpha = 0} = {}) {
  font(weight, size, family);
  const lines = wrap(str, max);
  lines.forEach((ln, k) => {
    const by = y + k * lh;
    if (mark && markAlpha > 0) {
      const a = Math.max(mark.a, ln.start), b = Math.min(mark.b, ln.end);
      if (b > a) {
        const x0 = x + ctx.measureText(ln.text.slice(0, a - ln.start)).width;
        const x1 = x + ctx.measureText(ln.text.slice(0, b - ln.start)).width;
        layer(markAlpha, 0, () => { ctx.fillStyle = C.cutWash; ctx.fillRect(x0 - 2, by - size * 0.95, x1 - x0 + 4, size * 1.3); });
      }
    }
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(ln.text, x, by);
  });
  return y + lines.length * lh;
}

// 紙の一枚（作例ビューアの欄と同じ、上端の太い罫）
function sheet(r, keep = 0) {
  ctx.fillStyle = C.sheet; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = C.ink; ctx.fillRect(r.x, r.y, r.w, 3);
  if (keep > 0) layer(keep, 0, () => { ctx.fillStyle = C.keep; ctx.fillRect(r.x, r.y, r.w, 3); });
}

// 実画面の切り抜き。元画像の座標→表示先の座標の対応を返す。
function mapper(src, d) {
  const k = d.w / src.w;
  return {k, h: src.h * k, at: (sx, sy) => [d.x + (sx - src.x) * k, d.y + (sy - src.y) * k]};
}
function crop(img, src, d) {
  const m = mapper(src, d);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, src.x, src.y, src.w, src.h, d.x, d.y, d.w, m.h);
  ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, m.h - 1);
  return m;
}

// ---------- 常に表示する枠 ----------

const sceneAt = t => { let k = 0; SCENES.forEach((s, i) => { if (t >= s.start) k = i; }); return k; };

function topBar(t) {
  const cur = sceneAt(t), cy = 80, items = [];
  let x = M;
  SCENES.forEach((s, k) => {
    const label = `${k + 1} ${s.step}`;
    font(700, 20); const w = ctx.measureText(label).width; // 太字の幅で並べ、場面が変わっても位置を動かさない
    font(k === cur ? 700 : 400, 20);
    ctx.fillStyle = k === cur ? C.ink : C.soft; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, cy);
    items.push({x, w}); x += w;
    if (k < SCENES.length - 1) { font(400, 20); ctx.fillStyle = C.soft; ctx.fillText('→', x + 10, cy); x += 44; }
  });
  const p = cur ? out3(prog(t, SCENES[cur].start, SCENES[cur].start + 0.45)) : 1;
  const a = items[Math.max(0, cur - 1)], b = items[cur];
  ctx.fillStyle = C.ink; ctx.fillRect(lerp(a.x, b.x, p), cy + 16, lerp(a.w, b.w, p), 2);
  tag('28秒・無音 ／ 架空の製品文', RX, cy, {align: 'right'});
}

function sourceLabel(t) {
  if (t < 4) return `素材：inputs/jobs.json（${D.ja.label}の入力）`;
  if (t < 10) return `素材：outputs/revisions.json（${D.ja.label}の印と変更）`;
  if (t < 16) return `素材：outputs/revisions.json（${D.ja.label}の最終稿と残した条件）`;
  if (t < 22) return `素材：inputs/jobs.json・outputs/revisions.json（${D.reply.label}）`;
  return '画面：保存結果ビューアの実際のスクリーンショット（desk-japanese.png・desk-top.png）';
}

function footer(t) {
  ctx.fillStyle = C.rule; ctx.fillRect(M, 618, CW, 1);
  text(sourceLabel(t), M, 650, {size: 20, color: C.soft, max: CW - 230, min: 20});
  text('Studio Yebisu 作例', RX, 650, {size: 20, color: C.soft, align: 'right'});
}

// ---------- 1. 渡す（0–4秒） ----------

const SLIPS = [
  {x: 64, y: 262, w: 368, h: 250},
  {x: 456, y: 262, w: 368, h: 250},
  {x: 848, y: 262, w: 368, h: 250},
];

function readerSlip(r) {
  sheet(r);
  text('読み手', r.x + 20, r.y + 46, {weight: 700, size: 28});
  paragraph(D.ja.reader, r.x + 20, r.y + 96, r.w - 40, 36, {size: 24});
}

function factSlip(r) {
  sheet(r);
  text('残す条件', r.x + 20, r.y + 46, {weight: 700, size: 28});
  text(`${D.ja.labels.length}項目`, r.x + r.w - 20, r.y + 46, {size: 20, color: C.soft, align: 'right'});
  let x = r.x + 20, y = r.y + 92;
  for (const label of D.ja.labels) {
    font(700, 20); const w = ctx.measureText(label).width + 24;
    if (x + w > r.x + r.w - 20) { x = r.x + 20; y += 46; }
    tag(label, x, y, {bg: C.keepWash, fg: C.keep, border: C.keep});
    x += w + 8;
  }
}

function scenePass(t) {
  const out = leave(t, 4.0, 0.4);
  layer(out, 0, () => {
    const hw = text('Humanizer', M, 156, {weight: 600, size: 56, family: SERIF});
    text('AIエージェントが読んで従う、Markdownのスキル', M + hw + 28, 156, {size: 24, color: C.soft, max: RX - (M + hw + 28), min: 20});
    const e = enter(t, 0.15, 0.5);
    layer(e.a, e.dy, () => text('原文と、残す条件を渡す', M, 224, {weight: 600, size: 52, family: SERIF}));
  });
  // 原文の紙片は docCard が描き、そのまま次の場面へ持ち越す
  const e1 = enter(t, 1.0, 0.5), e2 = enter(t, 1.3, 0.5);
  layer(e1.a * out, e1.dy + (1 - out) * 24, () => readerSlip(SLIPS[1]));
  layer(e2.a * out, e2.dy + (1 - out) * 24, () => factSlip(SLIPS[2]));
  const e3 = enter(t, 1.9);
  layer(e3.a * out, e3.dy, () => {
    let x = M;
    x += tag(`例：${D.ja.label}`, x, 562, {bg: C.ink, fg: C.paper}) + 12;
    x += tag(`架空の製品「${D.product}」`, x, 562) + 12;
    tag('制作時に保存した結果', x, 562);
  });
}

// ---------- 2–3. 原文の紙片 → 削る一文 → 最終稿（0.7–16秒、同じ一枚） ----------

const CARD_CUT = {x: 64, y: 196, w: 1152, h: 150};
const CARD_HEAD = {x: 64, y: 196, w: 1152, h: 64};
const CARD_KEEP = {x: 64, y: 196, w: 1152, h: 204};

function docCard(t) {
  const e = enter(t, 0.7, 0.5), fade = leave(t, 15.6, 0.4);
  const m = inOut(prog(t, 4.15, 4.9));
  let r;
  if (t < 9.3) r = lerpRect(SLIPS[0], CARD_CUT, m);
  else if (t < 9.85) r = lerpRect(CARD_CUT, CARD_HEAD, inOut(prog(t, 9.3, 9.8)));
  else r = lerpRect(CARD_HEAD, CARD_KEEP, inOut(prog(t, 9.85, 10.4)));
  const toKeep = prog(t, 9.8, 10.15);
  const hy = r.y + lerp(46, 38, m);

  layer(e.a * fade, e.dy, () => {
    sheet(r, toKeep);

    // 見出し：原文 → 最終稿
    layer(1 - toKeep, 0, () => {
      const w = text('原文', r.x + lerp(20, 24, m), hy, {weight: 700, size: lerp(28, 24, m)});
      layer(1 - m, 0, () => text(`第1段落／全${D.ja.paraCount}段落`, r.x + r.w - 20, hy, {size: 20, color: C.soft, align: 'right'}));
      layer(m, 0, () => text(`${D.ja.label} ／ 第1段落`, r.x + 24 + w + 16, hy, {size: 20, color: C.soft}));
    });
    layer(toKeep, 0, () => {
      const w = text('最終稿', r.x + 24, hy, {weight: 700, size: 24, color: C.keep});
      text(D.ja.label, r.x + 24 + w + 16, hy, {size: 20, color: C.soft});
    });

    clipRect(r, () => {
      // 紙片の本文：削る一文に下地を敷いてから、本文が退く
      const start = D.ja.para1.indexOf(D.ja.cut.quote);
      layer(1 - prog(t, 4.35, 4.6), 0, () => paragraph(D.ja.para1, r.x + 20, r.y + 96, 328, 36, {
        family: SERIF, mark: {a: start, b: start + D.ja.cut.quote.length}, markAlpha: prog(t, 4.0, 4.3),
      }));

      // 選んだ一文：大きく置き、取り消し線を引き、行ごと消す
      const qa = enter(t, 4.8, 0.4).a * (1 - prog(t, 9.3, 9.6));
      layer(qa, 0, () => {
        const x = r.x + 24, y = r.y + 108;
        font(400, 36, SERIF); const qw = Math.min(ctx.measureText(D.ja.cut.quote).width, r.w - 48);
        layer(prog(t, 5.4, 5.7), 0, () => { ctx.fillStyle = C.cutWash; ctx.fillRect(x - 6, y - 38, qw + 12, 52); });
        text(D.ja.cut.quote, x, y, {size: 36, family: SERIF, max: r.w - 48, min: 32});
        strike(x, y - 12, qw, out3(prog(t, 5.4, 6.0)));
      });

      // 最終稿：対象と除外の2文がそのまま入る
      const [b, c] = D.ja.keep.sentences;
      const x = r.x + 64, yb = r.y + 110, yc = r.y + 170;
      const wa = prog(t, 11.0, 11.4);
      [[b, yb, 10.2], [c, yc, 10.55]].forEach(([s, y, t0]) => {
        const se = enter(t, t0, 0.45);
        layer(se.a, se.dy, () => {
          font(400, 36, SERIF); const w = Math.min(ctx.measureText(s).width, RX - 24 - x);
          layer(wa, 0, () => {
            ctx.fillStyle = C.keepWash; ctx.fillRect(x - 6, y - 38, w + 12, 50);
            ctx.fillStyle = C.keep; ctx.fillRect(x - 6, y + 12, w + 12, 2);
          });
          text(s, x, y, {size: 36, family: SERIF, max: RX - 24 - x, min: 32});
        });
      });
      const bp = out3(prog(t, 10.9, 11.5));
      if (bp > 0) {
        const bx = r.x + 40, top = r.y + 70, bottom = r.y + 186, tick = 12 * bp;
        ctx.fillStyle = C.keep;
        ctx.fillRect(bx, top, 4, (bottom - top) * bp);
        ctx.fillRect(bx, top, tick, 4);
        ctx.fillRect(bx, top + (bottom - top) * bp - 4, tick, 4);
      }
    });

    // 見出し右の印
    layer(enter(t, 5.0).a * (1 - prog(t, 9.3, 9.6)), 0, () => {
      tag(`§${D.ja.cut.section} ${D.ja.cut.pattern} ／ ${SECTION_JA[D.ja.cut.section] || ''}`, r.x + r.w - 24, r.y + 31, {align: 'right', fg: C.cut, border: C.cut});
    });
    layer(enter(t, 11.6).a, 0, () => {
      tag(`残した条件 ${D.ja.keep.id}：${D.ja.keep.label}`, r.x + r.w - 24, r.y + 31, {align: 'right', bg: C.keepWash, fg: C.keep, border: C.keep});
    });
  });
}

function sceneCut(t) {
  const out = leave(t, 9.3, 0.4);
  let e = enter(t, 4.3, 0.5);
  layer(e.a * out, e.dy, () => text('具体的な事実がない一文を削る', M, 160, {weight: 600, size: 52, family: SERIF}));
  e = enter(t, 5.8);
  layer(e.a * out, e.dy, () => {
    const w = tag('最終稿では削除', M, 404, {bg: C.cut, fg: C.white, border: C.cut});
    text('保存された変更理由', M + w + 16, 404, {size: 20, color: C.soft, base: 'middle'});
  });
  e = enter(t, 6.0);
  layer(e.a * out, e.dy, () => paragraph(D.ja.cut.reason, M, 456, CW, 40, {size: 26}));
}

function sceneKeep(t) {
  const out = leave(t, 15.6, 0.4);
  let e = enter(t, 9.9, 0.5);
  layer(e.a * out, e.dy, () => text('対象と除外は、そのまま残す', M, 160, {weight: 600, size: 52, family: SERIF}));
  e = enter(t, 11.8);
  layer(e.a * out, e.dy, () => {
    const w = tag('残した条件', M, 452, {bg: C.keep, fg: C.white, border: C.keep});
    text(`${D.ja.keep.id}「${D.ja.keep.label}」の保存された説明`, M + w + 16, 452, {size: 20, color: C.soft, base: 'middle'});
  });
  e = enter(t, 12.0);
  layer(e.a * out, e.dy, () => paragraph(D.ja.keep.note, M, 504, CW, 40, {size: 26}));
  e = enter(t, 12.6);
  layer(e.a * out, e.dy, () => text(`原文と最終稿で同じ文字列（否定の「${D.ja.keep.neg}」を含む）`, M, 566, {size: 24, color: C.soft}));
}

// ---------- 4. 答えを先に（16–22秒） ----------

function sceneAnswer(t) {
  const out = leave(t, 21.6, 0.4), R = D.reply;
  let e = enter(t, 16.0, 0.5);
  layer(e.a * out, e.dy, () => text('答えを先に。できないこと・不確実さも残す', M, 160, {weight: 600, size: 48, family: SERIF, max: CW, min: 44}));

  e = enter(t, 16.3);
  layer(e.a * out, e.dy, () => {
    text(`利用者の質問 ／ ${R.label}`, M, 214, {size: 20, color: C.soft});
    text(`“${R.question}”`, M, 254, {size: 30, family: SERIF, max: CW, min: 30});
  });

  e = enter(t, 16.8);
  layer(e.a * out, e.dy, () => {
    text('削った決まり文句', M, 310, {size: 20, color: C.soft, base: 'middle'});
    let x = M + 200;
    R.residue.forEach((q, k) => {
      font(400, 30, SERIF); const w = ctx.measureText(q).width;
      layer(prog(t, 17.1, 17.3), 0, () => { ctx.fillStyle = C.cutWash; ctx.fillRect(x - 6, 310 - 22, w + 12, 44); });
      text(q, x, 310, {size: 30, family: SERIF, base: 'middle'});
      strike(x, 312, w, out3(prog(t, 17.1 + k * 0.2, 17.6 + k * 0.2)));
      x += w + 48;
    });
    ctx.fillStyle = C.rule; ctx.fillRect(M, 346, CW, 1);
  });

  e = enter(t, 17.6);
  layer(e.a * out, e.dy, () => {
    text(`残した条件：${R.answer.label} ／ 最終稿の1文目`, M, 386, {weight: 700, size: 20, color: C.keep});
    ctx.fillStyle = C.keep; ctx.fillRect(M, 400, 4, 44);
    text(R.answer.final_quote, M + 24, 434, {size: 36, family: SERIF, max: CW - 24, min: 32});
  });

  e = enter(t, 18.4);
  layer(e.a * out, e.dy, () => {
    text(`残した条件：${R.unsure.label} ／ 最終稿の最後の文`, M, 486, {weight: 700, size: 20, color: C.keep});
    ctx.fillStyle = C.keep; ctx.fillRect(M, 500, 4, 42);
    const q = R.unsure.final_quote, x = M + 24, y = 532;
    text(q, x, y, {size: 34, family: SERIF, max: CW - 24, min: 34});
    const up = out3(prog(t, 18.9, 19.3));
    for (const word of ['Large', 'may']) {
      const i = q.search(new RegExp(`\\b${word}\\b`));
      font(400, 34, SERIF);
      const x0 = x + ctx.measureText(q.slice(0, i)).width, w = ctx.measureText(word).width;
      ctx.fillStyle = C.keep; ctx.fillRect(x0, y + 8, w * up, 3);
    }
  });

  e = enter(t, 19.2);
  layer(e.a * out, e.dy, () => text(R.unsure.note, M, 590, {size: 24, color: C.soft, max: CW, min: 20}));
}

// ---------- 5. 読み比べる・持ち帰る（22–28秒） ----------

function ring(map, rg) {
  const [x0, y0] = map.at(rg.box[0], rg.box[1]), [x1, y1] = map.at(rg.box[2], rg.box[3]);
  rr(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12, 6);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
  const style = {bg: C.ink, fg: C.paper, border: C.ink};
  if (rg.at === 'below-left') tag(rg.tag, x0 - 6, y1 + 26, style);
  else if (rg.at === 'below-right') tag(rg.tag, x1 + 6, y1 + 26, {...style, align: 'right'});
  else tag(rg.tag, x1 + 18, (y0 + y1) / 2, style);
}

function sceneCompare(t) {
  let e = enter(t, 22.0, 0.5);
  layer(e.a, e.dy, () => text('初稿・点検・最終稿を読み比べる', M, 160, {weight: 600, size: 50, family: SERIF}));

  // 実際の画面：大きく見せてから左へ縮める
  const s = inOut(prog(t, 24.4, 25.1));
  const d = {x: M, y: lerp(182, 196, s), w: lerp(CW, 560, s)};
  const map = mapper(DESK, d);
  layer(out3(prog(t, 22.1, 22.6)), 0, () => crop(IMG.japanese, DESK, d));
  const ringOut = 1 - prog(t, 24.25, 24.45);
  for (const rg of RINGS) layer(out3(prog(t, rg.t0, rg.t0 + 0.3)) * ringOut, 0, () => ring(map, rg));

  const below = d.y + map.h;
  e = enter(t, 24.9, 0.3);
  layer(e.a, e.dy, () => text(`保存結果ビューアの実際の画面（${D.ja.label}）`, M, below + 30, {size: 20, color: C.soft, max: 560, min: 20}));
  [`タブで${D.jobCount}件を切り替える`, '初稿と点検は「初稿と点検を見る」から', '残した条件を選ぶと、最終稿の位置が緑に'].forEach((str, k) => {
    const le = enter(t, 24.95 + k * 0.1, 0.3);
    layer(le.a, le.dy, () => {
      const y = below + 78 + k * 40;
      ctx.fillStyle = C.keep; ctx.fillRect(M, y - 14, 8, 8);
      text(str, M + 20, y, {size: 24, max: 540, min: 22});
    });
  });

  // 持ち帰るファイル：実画面のボタンからファイル名を取り出す
  const fx = 664;
  e = enter(t, 24.7, 0.3);
  layer(e.a, e.dy, () => text('持ち帰るファイル（制作時に保存済み）', fx, 214, {size: 20, color: C.soft}));
  const fd = {x: fx, y: 230, w: 465};
  const fmap = mapper(FILES, fd);
  layer(out3(prog(t, 24.6, 24.9)), 0, () => crop(IMG.top, FILES, fd));
  const p = inOut(prog(t, 24.85, 25.4));
  FILE_ROWS.forEach((f, k) => {
    const [sx, sy] = fmap.at(f.sx, f.sy), y = 384 + k * 82;
    layer(prog(t, 24.8, 24.9), 0, () => text(f.name, lerp(sx, fx, p), lerp(sy, y, p), {weight: 700, size: lerp(13 * fmap.k, 30, p), family: MONO}));
    const le = enter(t, 25.15, 0.3);
    layer(le.a, le.dy, () => text(f.label, fx, y + 32, {size: 22, color: C.ink, max: RX - fx, min: 20}));
  });
  e = enter(t, 25.2, 0.3);
  layer(e.a, e.dy, () => {
    text('outputs/ にある実ファイルです。', fx, 556, {size: 22, color: C.soft});
    text(D.noRun, fx, 588, {size: 22, color: C.soft, max: RX - fx, min: 20});
  });
}

// ---------- seek ----------

function resetCanvas() {
  canvas.width = W; canvas.height = H; // 毎回、Canvasの内容と状態をすべて初期化する
  ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  const s = Math.min(W / 1280, H / 720);
  ctx.setTransform(s, 0, 0, s, (W - 1280 * s) / 2, (H - 720 * s) / 2);
}

function draw(t) {
  resetCanvas();
  topBar(t);
  footer(t);
  if (t < 4.4) scenePass(t);
  if (t >= 4 && t < 9.7) sceneCut(t);
  if (t >= 9.9 && t < 16) sceneKeep(t);
  if (t >= 0.7 && t < 16) docCard(t);
  if (t >= 16 && t < 22) sceneAnswer(t);
  if (t >= 22) sceneCompare(t);
}

function drawError(message) {
  resetCanvas();
  ctx.fillStyle = C.error; ctx.fillRect(M, 280, 6, 150);
  text('素材を読み込めなかったため、動画を描画していません', M + 28, 320, {weight: 700, size: 34, color: C.error, max: CW - 28, min: 24});
  paragraph(message, M + 28, 372, CW - 40, 34, {size: 22});
}

const $ = id => document.getElementById(id);
const ui = {play: $('play'), scrub: $('scrub'), time: $('time'), status: $('status')};
let current = 0, playing = false, raf = 0, baseT = 0, baseWall = 0;

window.seek = seconds => {
  const t = clamp(Number(seconds) || 0, 0, DURATION);
  if (!ready) return window.motionReady.then(() => window.seek(t));
  current = t;
  draw(t);
  if (ui.scrub) ui.scrub.value = t.toFixed(1);
  if (ui.time) ui.time.textContent = `${t.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
  return undefined;
};

// プレビュー用の再生。書き出し時（__MOTION_RENDER__）は動かさない。
function tick(now) {
  if (!playing) return;
  const t = baseT + (now - baseWall) / 1000;
  if (t >= DURATION) { window.seek(DURATION); setPlaying(false); return; }
  window.seek(t);
  raf = requestAnimationFrame(tick);
}

function setPlaying(on) {
  if (RENDER || !ready) return;
  playing = on;
  cancelAnimationFrame(raf);
  ui.play.textContent = on ? '一時停止' : '再生';
  ui.play.setAttribute('aria-pressed', String(on));
  if (!on) return;
  if (current >= DURATION - 0.01) window.seek(0);
  baseT = current; baseWall = performance.now();
  raf = requestAnimationFrame(tick);
}

function setupUi() {
  if (!ui.play || !ui.scrub) return;
  ui.play.disabled = false;
  ui.scrub.disabled = false;
  if (ui.status) ui.status.textContent = '準備完了：28秒・無音の編集動画です。保存済みの結果と実際の画面から描画しています。';
  if (RENDER) return;
  ui.play.addEventListener('click', () => setPlaying(!playing));
  ui.scrub.addEventListener('input', () => {
    window.seek(Number(ui.scrub.value));
    if (playing) { baseT = current; baseWall = performance.now(); }
  });
}

window.motionReady = load().then(() => {
  ready = true;
  window.seek(RENDER ? 0 : POSTER);
  setupUi();
});

window.motionReady.catch(err => {
  const message = err && err.message ? err.message : String(err);
  drawError(message);
  if (ui.play) ui.play.disabled = true;
  if (ui.scrub) ui.scrub.disabled = true;
  if (ui.status) { ui.status.textContent = `エラー：${message} 再生できません。`; ui.status.classList.add('error'); }
});
