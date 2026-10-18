/* Whisper 作例「声を、文と時刻へ」— 32秒・無音の図解動画（編集できる元ページ）
 * 作例ページと同じ照合（26件のSHA-256と中身の対応）と同じ概念図を使い、時刻 t の完成した画面を毎回最初から描く。
 * 波形は実WAVのRMS、色面は実WAVへ同じ前処理APIを当てたlog-Mel、区間・修正・SRTは保存済みの実記録。
 * 音は一切使わない（audioEvents は空、音声要素も音の読み込みもない）。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

import {loadValidatedAssets, diagramLayout, drawDiagram, restingParams, drawText, PALETTES, ASSET_COUNT, ease, easeOut} from '../app.js';

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 32;
const POSTER_TIME = 31;
const SIZES = {portrait: {width: 720, height: 1280}, wide: {width: 1280, height: 720}};
const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
const evenSize = (v) => Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0;
const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
const hasSize = evenSize(given.width) && evenSize(given.height);
let orient = hasSize && given.width > given.height ? 'wide' : 'portrait';
let W = hasSize ? given.width : SIZES[orient].width;
let H = hasSize ? given.height : SIZES[orient].height;
window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: []};

const PAL = PALETTES.light;
const root = document.documentElement;
if (RENDER) root.classList.add('is-render');
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');

// 縦と横で配置を作り直す（同じ時刻表・同じ図）
const COMPOSE = {
  portrait: {LW: 720, LH: 1280, kind: 'tall', u: 25, rail: {x: 40, y: 34, align: 'left'}, title: {x: 40, y: 146, size: 46, max: 640}, sub: {y: 190, size: 23}, world: {x: 0, y: 214, w: 720, h: 1004}, foot: {y: 1252, size: 17}},
  wide: {LW: 1280, LH: 720, kind: 'wide', u: 26, rail: {x: 1240, y: 26, align: 'right'}, title: {x: 40, y: 74, size: 42, max: 860}, sub: {y: 110, size: 21}, world: {x: 20, y: 134, w: 1240, h: 548}, foot: {y: 706, size: 15}},
};

// 7場面。最後の場面の入りは28.4〜28.9秒で終え、29〜32秒は完全に静止させる。
const SCENES = [
  {start: 0, end: 4, title: '声を、文と時刻へ', sub: () => 'Whisper・音声認識', rail: 0},
  {start: 4, end: 9, title: '音を、特徴にする', sub: () => '実入力を同じ前処理APIで表示', rail: 0},
  {start: 9, end: 14, title: '特徴から、文と推定時刻へ', sub: () => 'モデル構造の図', rail: 1},
  {start: 14, end: 20, title: '原出力には、誤りも残る', sub: () => '保存済みの5区間・時刻は推定値', rail: 2},
  {start: 20, end: 25, title: '原稿と見比べ、文だけ手で直す', sub: () => '原稿は認識に渡していない', rail: 2},
  {start: 25, end: 28.4, title: '時刻はそのまま、字幕に保存', sub: (d) => `原出力 ${d.srt.raw.bytes} B／修正例 ${d.srt.review.bytes} B`, rail: 2},
  {start: 28.4, end: 32, title: '仕組みを見て、字幕デスクへ', sub: () => '保存済み実行の図解／無音', rail: 3},
];
const JUMPS = [0, 4, 9, 14, 20, 25, 29];
// 場面の表示上の区切り（6の終わりと7の入りは28.4〜28.9秒で重ねる）
const RANGES = ['0〜4', '4〜9', '9〜14', '14〜20', '20〜25', '25〜29', '29〜32'];

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
// 入って、出る
const span = (t, a, b, c, d) => Math.min(easeOut(prog(t, a, b)), 1 - ease(prog(t, c, d)));
// v0 から、各時刻に0.6秒かけて次の値へ（前の値に依存しない加算）
function steps(t, v0, changes, dur = 0.6) {
  let v = v0;
  let prev = v0;
  for (const [at, to] of changes) {
    v += (to - prev) * ease(prog(t, at, at + dur));
    prev = to;
  }
  return v;
}

function filmParams(t) {
  const p = restingParams();
  const ghost = 0.22 * easeOut(prog(t, 0.6, 1.4));
  p.ghost = ghost;
  p.ghostBottom = ghost * (1 - ease(prog(t, 13.6, 14.2)));

  // 1：実WAVが入り、Pythonと重み・設定の構造へつながる
  p.wavSlide = 1 - easeOut(prog(t, 0.15, 1.3));
  p.wavReveal = easeOut(prog(t, 0.3, 1.8));
  p.show.machine = easeOut(prog(t, 1.2, 2.2));
  p.show.res = easeOut(prog(t, 1.9, 2.8));
  p.resDrop = 1 - easeOut(prog(t, 1.9, 2.8));
  // 2：同じ波形の下から、実際のlog-Mel色面が開く
  p.show.plane = prog(t, 4.2, 4.5);
  p.planeOpen = ease(prog(t, 4.3, 6.0));
  p.planeSweep = ease(prog(t, 4.5, 7.2));
  // 3：同じ色面がencoderへ入り、decoderがtokenを出し、5枚の区間へ開く
  p.encFlow = prog(t, 9.3, 10.8);
  p.encGlow = span(t, 10.0, 10.6, 11.6, 12.4);
  p.decGlow = span(t, 10.8, 11.3, 12.4, 13.2);
  p.show.tokens = prog(t, 11.3, 11.5);
  p.tokensOut = easeOut(prog(t, 11.3, 12.1));
  p.show.cards = t >= 12.2 ? 1 : 0;
  p.cardsIn = p.cardsIn.map((_, i) => ease(prog(t, 12.2 + i * 0.16, 12.9 + i * 0.16)));
  // 4：推定時刻の軸と、1番の原出力
  p.show.axis = easeOut(prog(t, 14.2, 14.9));
  p.selected = t >= 15 ? 0 : -1;
  p.selGlow = easeOut(prog(t, 15, 15.6)) * (1 - ease(prog(t, 25, 25.6)));
  // 5：原稿の別経路が認識の後から入り、1・2・5番の文だけを替える
  p.show.book = easeOut(prog(t, 20.2, 21));
  p.bookSlide = 1 - easeOut(prog(t, 20.2, 21));
  p.scriptLink = easeOut(prog(t, 20.9, 21.5));
  const legs = [[21.4, 22, -1, 0], [22.55, 23, 0, 1], [23.55, 24, 1, 4], [24.55, 25, 4, -1]];
  let pen = {from: -1, to: -1, k: 0};
  for (const [a, b, from, to] of legs) if (t >= a) pen = {from, to, k: ease(prog(t, a, b))};
  p.pencil = {...pen, alpha: 1};
  const flips = {0: [22, 22.5], 1: [23, 23.5], 4: [24, 24.5]};
  p.flip = p.flip.map((_, i) => (flips[i] ? ease(prog(t, flips[i][0], flips[i][1])) : 0));
  // 6：同じ5枚が、原出力SRTと修正例SRTへ書き出される
  p.show.files = easeOut(prog(t, 25.2, 25.9));
  p.writeRaw = prog(t, 25.8, 27);
  p.writeReview = prog(t, 26.6, 27.8);
  p.sizes = easeOut(prog(t, 27.5, 28.1));
  // 強調：いま動いている部分を濃く、ほかは薄く。28.3秒から全体を同じ濃さへ
  p.emph.wav = steps(t, 1, [[9, 0.68], [28.3, 1]]);
  p.emph.plane = steps(t, 1, [[14, 0.68], [28.3, 1]]);
  p.emph.machine = steps(t, 1, [[4, 0.68], [9, 1], [14, 0.68], [28.3, 1]]);
  p.emph.tokens = steps(t, 1, [[14, 0.68], [28.3, 1]]);
  p.emph.book = steps(t, 1, [[25.2, 0.68], [28.3, 1]]);
  return p;
}

// ---- 画面の枠：段階の印・見出し・足元 ---------------------------------------
function sceneIndex(t) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i;
  return 0;
}

function drawRail(c, comp, t) {
  const active = SCENES[sceneIndex(t)].rail;
  const labels = ['入力', '認識', '字幕'];
  const h = comp.kind === 'tall' ? 40 : 36;
  const size = comp.kind === 'tall' ? 19 : 17;
  const w = size * 2 + 28;
  const gap = 10;
  const total = labels.length * w + (labels.length - 1) * gap;
  let x = comp.rail.align === 'right' ? comp.rail.x - total : comp.rail.x;
  labels.forEach((label, i) => {
    const on = active === 3 || i === active;
    const done = active !== 3 && i < active;
    c.save();
    c.beginPath();
    c.roundRect(x, comp.rail.y, w, h, h / 2);
    c.fillStyle = on ? PAL.petrol : PAL.card;
    c.fill();
    c.strokeStyle = on || done ? PAL.petrol : PAL.line;
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
    drawText(c, label, x + w / 2, comp.rail.y + h * 0.68, {size, weight: 700, color: on ? PAL.onPetrol : done ? PAL.petrol : PAL.muted, align: 'center'});
    x += w + gap;
  });
}

function drawChrome(c, comp, t, d) {
  drawRail(c, comp, t);
  SCENES.forEach((s, i) => {
    const enter = i === 0 ? 1 : easeOut(prog(t, s.start, s.start + 0.45));
    const leave = i === SCENES.length - 1 ? 1 : 1 - ease(prog(t, s.end - 0.35, s.end));
    const a = Math.min(enter, leave);
    if (a <= 0.003) return;
    const dy = (1 - enter) * 10;
    drawText(c, s.title, comp.title.x, comp.title.y + dy, {size: comp.title.size, weight: 600, family: 'mincho', color: PAL.ink, max: comp.title.max, min: comp.title.size * 0.8, alpha: a});
    drawText(c, s.sub(d), comp.title.x, comp.sub.y + dy, {size: comp.sub.size, weight: 600, color: i === 2 || i === 1 ? PAL.amber : PAL.inkSoft, max: comp.title.max, alpha: a});
  });
  c.save();
  c.fillStyle = PAL.line;
  c.fillRect(comp.title.x, comp.foot.y - comp.foot.size * 1.6, comp.LW - comp.title.x * 2, 1);
  c.restore();
  drawText(c, 'Whisper：MIT © 2022 OpenAI ／ 図解：Studio Yebisu', comp.title.x, comp.foot.y, {size: comp.foot.size, color: PAL.muted, max: (comp.LW - comp.title.x * 2) * 0.78});
  drawText(c, '無音', comp.LW - comp.title.x, comp.foot.y, {size: comp.foot.size, weight: 700, color: PAL.inkSoft, align: 'right'});
}

// ---- 1番の原出力と修正の吹き出し（図の下段に、同じ縮尺で置く） ----------------
function drawCallouts(c, L, t, d) {
  const u = L.u;
  const seg = d.segments[0];
  const fix = d.corrections.find((x) => x.id === seg.id);
  const range = `${seg.start.toFixed(2)}–${seg.end.toFixed(2)}秒`;
  const card = L.cards[0];
  const box = (r, a, stroke) => {
    c.save();
    c.globalAlpha *= a;
    c.beginPath();
    c.roundRect(r.x, r.y, r.w, r.h, Math.min(14, u * 0.6));
    c.fillStyle = PAL.card;
    c.fill();
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
    c.restore();
  };
  // 場面4：原出力のまま（誤りも残る）
  const a4 = easeOut(prog(t, 15.3, 16)) * (1 - ease(prog(t, 19.7, 20.2)));
  if (a4 > 0.003) {
    const r = L.bottom;
    c.save();
    c.globalAlpha *= a4;
    c.strokeStyle = PAL.amberBright;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(card.x + card.w / 2, card.y + card.h);
    c.lineTo(card.x + card.w / 2, r.y);
    c.stroke();
    c.restore();
    box(r, a4, PAL.amberBright);
    const x = r.x + u * 0.7;
    drawText(c, `1番の原出力・推定 ${range}`, x, r.y + u * 1.5, {size: u * 0.85, weight: 600, color: PAL.inkSoft, max: r.w - u * 1.4, alpha: a4});
    drawText(c, `「${fix.excerpt.raw}」`, x - u * 0.4, r.y + u * 3.9, {size: u * 1.9, weight: 600, family: 'mincho', color: PAL.ink, max: r.w - u * 1.2, alpha: a4});
    drawText(c, '保存済みの実出力（原稿と違う文字）', x, r.y + u * 5.6, {size: u * 0.78, color: PAL.muted, max: r.w - u * 1.4, alpha: a4});
  }
  // 場面5：原稿と見比べた手動の修正。時刻はそのまま
  const a5 = easeOut(prog(t, 21.6, 22.2)) * (1 - ease(prog(t, 24.8, 25.3)));
  if (a5 > 0.003) {
    const r = L.callout;
    box(r, a5, PAL.petrol);
    const x = r.x + u * 0.6;
    const max = r.w - u * 1.2;
    drawText(c, '原稿を見て、手で修正', x, r.y + u * 1.4, {size: u * 0.8, weight: 600, color: PAL.inkSoft, max, alpha: a5});
    const rawText = `「${fix.excerpt.raw}」`;
    const w = drawText(c, rawText, x - u * 0.3, r.y + u * 2.95, {size: u * 1.1, family: 'mincho', color: PAL.muted, max, alpha: a5});
    c.save();
    c.globalAlpha *= a5 * easeOut(prog(t, 21.9, 22.3));
    c.fillStyle = PAL.muted;
    c.fillRect(x - u * 0.1, r.y + u * 2.6, Math.max(0, w - u * 0.4), Math.max(1.5, u * 0.08));
    c.restore();
    const a6 = a5 * easeOut(prog(t, 22, 22.5));
    drawText(c, `→「${fix.excerpt.edited}」`, x, r.y + u * 4.8, {size: u * 1.5, weight: 700, family: 'mincho', color: PAL.petrol, max, alpha: a6});
    drawText(c, `時刻 ${range}はそのまま`, x, r.y + u * 6.4, {size: u * 0.78, color: PAL.muted, max, alpha: a6});
  }
}

// ---- 1フレームを描く --------------------------------------------------------
let data = null;
let world = null;
let currentT = 0;

function buildWorld() {
  const comp = COMPOSE[orient];
  const L = diagramLayout(comp.kind, comp.world.w, comp.u, data, {detail: true});
  const s = Math.min(1, comp.world.w / L.W, comp.world.h / L.H);
  return {L, s, ox: comp.world.x + (comp.world.w - L.W * s) / 2, oy: comp.world.y + (comp.world.h - L.H * s) / 2};
}

function sizeCanvas() {
  const density = RENDER ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.round(W * density);
  canvas.height = Math.round(H * density);
  canvas.style.aspectRatio = `${W} / ${H}`;
  if (RENDER) {
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }
}

function render(t) {
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = PAL.paper;
  c.fillRect(0, 0, canvas.width, canvas.height);
  if (!data || !world) return; // 読み込み中・失敗時は空の紙だけ（代わりの映像を出さない）
  const comp = COMPOSE[orient];
  const k = Math.min(canvas.width / comp.LW, canvas.height / comp.LH);
  c.setTransform(k, 0, 0, k, (canvas.width - comp.LW * k) / 2, (canvas.height - comp.LH * k) / 2);
  c.save();
  drawChrome(c, comp, t, data);
  c.restore();
  c.save();
  c.translate(world.ox, world.oy);
  c.scale(world.s, world.s);
  drawDiagram(c, world.L, filmParams(t), data, PAL);
  drawCallouts(c, world.L, t, data);
  c.restore();
}

const clampTime = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(DURATION, Math.max(0, n)) : 0;
};

// ---- プレビューの部品（書き出し時は登録しない） --------------------------------
const $ = (id) => document.getElementById(id);
const els = {
  stage: $('stage'), caption: $('film-caption'), status: $('asset-status'), retry: $('retry'),
  play: $('play'), reset: $('reset'), replay: $('replay'), end: $('end'), range: $('time'), clock: $('clock'),
  jumps: [...document.querySelectorAll('[data-jump]')], orients: [...document.querySelectorAll('button[data-orient]')],
};
let playing = false;
let raf = 0;
let from = 0;
let startedAt = 0;
let lastScene = -1;
let loadSeq = 0;

const sec = (v) => `${v.toFixed(1)}秒`;
function syncUi(announce) {
  if (RENDER || !els.range) return;
  els.range.value = (Math.round(currentT * 10) / 10).toFixed(1);
  els.range.setAttribute('aria-valuetext', `${sec(currentT)}（全${DURATION}秒）`);
  els.clock.textContent = `${sec(currentT)} / ${sec(DURATION)}`;
  els.play.textContent = playing ? '一時停止' : '再生';
  els.play.setAttribute('aria-pressed', String(playing));
  const i = sceneIndex(currentT);
  if (data && (announce || i !== lastScene)) {
    const s = SCENES[i];
    els.caption.textContent = `${i + 1}/7・${RANGES[i]}秒：${s.title}（${s.sub(data)}）`;
  }
  lastScene = i;
}

function setControls(enabled) {
  if (RENDER || !els.play) return;
  for (const b of [els.play, els.reset, els.replay, els.end, els.range, ...els.jumps, ...els.orients]) b.disabled = !enabled;
}

function setStatus(state, message) {
  root.dataset.motionStatus = state;
  if (RENDER || !els.status) return;
  els.status.dataset.state = state;
  els.status.textContent = message;
  els.retry.hidden = state !== 'error';
}

function tick(now) {
  if (!playing) return;
  const t = Math.min(DURATION, from + (now - startedAt) / 1000);
  currentT = t;
  render(t);
  if (t >= DURATION) {
    playing = false;
    raf = 0;
    syncUi(true);
    return;
  }
  syncUi(false);
  raf = requestAnimationFrame(tick);
}
function play() {
  if (!data || playing) return;
  if (currentT >= DURATION - 0.05) currentT = 0;
  from = currentT;
  startedAt = performance.now();
  playing = true;
  raf = requestAnimationFrame(tick);
  syncUi(true);
}
function pause() {
  playing = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  syncUi(true);
}
function jump(t) {
  pause();
  currentT = clampTime(t);
  render(currentT);
  syncUi(true);
}

function setOrientation(next) {
  if (RENDER || next === orient) return;
  pause();
  orient = next;
  W = SIZES[next].width;
  H = SIZES[next].height;
  window.motionConfig.width = W;
  window.motionConfig.height = H;
  els.stage.dataset.orient = next;
  for (const b of els.orients) b.setAttribute('aria-pressed', String(b.dataset.orient === next));
  sizeCanvas();
  world = data ? buildWorld() : null;
  render(currentT);
  syncUi(true);
}

// ---- 読み込み：26件をすべて照合し、フォントを待ってから描く ----------------------
function prepare() {
  const seq = ++loadSeq;
  data = null;
  world = null;
  if (!RENDER) pause();
  render(currentT);
  setControls(false);
  setStatus('loading', `素材 0/${ASSET_COUNT} を照合しています…`);
  const work = (async () => {
    const loaded = await loadValidatedAssets({
      onProgress: (n, total) => { if (seq === loadSeq && root.dataset.motionStatus === 'loading') setStatus('loading', `素材 ${n}/${total} を照合しています…`); },
    });
    await document.fonts.ready;
    if (seq !== loadSeq) return true;
    data = loaded;
    world = buildWorld();
    render(currentT);
    setControls(true);
    setStatus('ready', `素材 ${loaded.assetCount}/${ASSET_COUNT} 照合済み`);
    syncUi(true);
    return true;
  })();
  work.catch((error) => {
    if (seq !== loadSeq) return;
    data = null;
    world = null;
    render(currentT);
    setControls(false);
    if (!RENDER && els.caption) els.caption.textContent = '';
    setStatus('error', `読み込みに失敗しました：${error?.message || '不明な理由'}。代わりの映像は出しません。`);
  });
  return work;
}

sizeCanvas();
render(0);
window.motionReady = prepare();

// 任意の時刻の完成した画面を描く。呼んだ順番や壁時計には依存しない
window.seek = (seconds) => {
  const t = clampTime(seconds);
  currentT = t;
  if (data && world) {
    render(t);
    syncUi(true);
    return Promise.resolve(t);
  }
  return Promise.resolve(window.motionReady).then(() => {
    currentT = t;
    render(t);
    syncUi(true);
    return t;
  });
};

if (!RENDER) {
  els.stage.dataset.orient = orient;
  for (const b of els.orients) b.setAttribute('aria-pressed', String(b.dataset.orient === orient));
  els.play.addEventListener('click', () => (playing ? pause() : play()));
  els.reset.addEventListener('click', () => jump(0));
  els.replay.addEventListener('click', () => { jump(0); play(); });
  els.end.addEventListener('click', () => jump(DURATION));
  els.range.addEventListener('input', () => jump(Number(els.range.value)));
  for (const b of els.jumps) b.addEventListener('click', () => jump(Number(b.dataset.jump)));
  for (const b of els.orients) b.addEventListener('click', () => setOrientation(b.dataset.orient));
  els.retry.addEventListener('click', () => { window.motionReady = prepare(); });
  // 窓の大きさが変わっても画素密度だけ合わせ直す（構図は固定の論理座標）
  window.addEventListener('resize', () => { sizeCanvas(); render(currentT); });
  syncUi(true);
}

export {JUMPS, RANGES, SCENES};
