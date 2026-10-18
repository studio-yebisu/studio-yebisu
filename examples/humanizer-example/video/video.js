/* Humanizer 作例「指示書と原文を、同じAIへ」— 32秒・無音の図解動画（編集できる元ページ）
 * 作例ページと同じ照合（11件の大きさ・SHA-256と中身の対応）と同じ概念図を使い、時刻 t の完成した画面を毎回最初から描く。
 * 例は、点検で1件が残ったサポート返信（reply）。文・印・条件・最終稿はすべて保存済みの実記録から読む。
 * 音は一切使わない（audioEvents は空、音声要素も音の読み込みもない）。AIもここでは動かない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

import {loadValidatedAssets, diagramLayout, drawDiagram, restingParams, drawText, PALETTES, ASSET_COUNT, MEMO, ease, easeOut, prog, span, steps} from '../app.js';

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 32;
const POSTER_TIME = 31;
const JOB = 'reply';
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
  portrait: {LW: 720, LH: 1280, kind: 'tall', u: 24, rail: {x: 40, y: 34, align: 'left'}, title: {x: 40, y: 146, size: 46, max: 640}, sub: {y: 190, size: 23}, world: {x: 8, y: 216, w: 704, h: 1004}, foot: {y: 1252, size: 17}},
  wide: {LW: 1280, LH: 720, kind: 'wide', u: 21, rail: {x: 1240, y: 26, align: 'right'}, title: {x: 40, y: 72, size: 40, max: 820}, sub: {y: 106, size: 20}, world: {x: 20, y: 124, w: 1240, h: 558}, foot: {y: 706, size: 15}},
};

// 7場面。最後の場面の入りは28.4〜28.85秒で終え、29〜32秒は完全に静止させる。
const SCENES = [
  {start: 0, end: 4, title: '推敲の手順を、AIへ渡す', sub: () => 'Humanizer：Markdownの指示書（SKILL.md）', rail: 0},
  {start: 4, end: 9, title: '原文・読み手・残す条件', sub: () => '原文は指示ではなく、編集する素材', rail: 0},
  {start: 9, end: 14, title: '型を見つけ、初稿を書く', sub: (d) => `強い型から${d.jobs[JOB].marks.length}か所に印（サポート返信）`, rail: 1},
  {start: 14, end: 20, title: '初稿を、読み手に照らす', sub: (d) => `残り${d.jobs[JOB].remaining.length}件：§${d.jobs[JOB].remaining[0].section}（この作例での解釈）`, rail: 1},
  {start: 20, end: 25, title: '条件を残し、相手へ書く', sub: (d) => `担当の条件・「${d.jobs[JOB].facts[0].term}」・「may」は動かさない`, rail: 1},
  {start: 25, end: 28.4, title: '原文と読み比べ、持ち帰る', sub: () => `${MEMO.path}・${MEMO.bytes.toLocaleString('en-US')} B`, rail: 2},
  {start: 28.4, end: 32, title: 'スキルの構造から、実際の推敲へ', sub: () => '保存済み3件の図解／無音', rail: 3},
];
const RANGES = ['0〜4', '4〜9', '9〜14', '14〜20', '20〜25', '25〜29', '29〜32'];

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
function filmParams(t, d) {
  const p = restingParams(JOB);
  const job = d.jobs[JOB];
  p.ghost = 0.2 * easeOut(prog(t, 0.2, 1.0)) * (1 - ease(prog(t, 8.4, 9.2)));

  // 1：本（SKILL.md）が0秒から見え、6系統・26型と4手順を開き、4手順が同じAIの枠へ移る
  p.show.book = 1;
  p.bookZoom = 1 - ease(prog(t, 2.6, 3.5));
  p.bookOpen = prog(t, 0.2, 1.5);
  p.stepsPage = prog(t, 1.1, 2.0);
  p.show.ai = easeOut(prog(t, 2.8, 3.6));
  p.show.band = easeOut(prog(t, 3.4, 4.0));
  p.stepsFly = prog(t, 2.9, 3.9);
  p.links.instr = prog(t, 3.4, 4.0);
  // 2：原文・読み手・残す条件が入り、同じAIへ合流する
  p.show.paper = easeOut(prog(t, 4.2, 5.0));
  p.show.reader = easeOut(prog(t, 4.6, 5.4));
  p.show.chips = easeOut(prog(t, 5.1, 5.7));
  p.chipsIn = prog(t, 5.3, 6.4);
  p.links.paperIn = prog(t, 6.0, 6.7);
  p.links.readerIn = prog(t, 6.2, 6.9);
  p.links.bandIn = prog(t, 6.5, 7.2);
  const outs = easeOut(prog(t, 6.8, 7.6));
  p.show.final = outs;
  p.show.compare = outs;
  p.show.memo = outs;
  p.links.out = prog(t, 25.0, 25.6);
  p.links.finalToCompare = prog(t, 26.2, 26.8);
  p.links.compareToMemo = prog(t, 27.0, 27.6);
  // 残す条件のうち「cannot reopen」と「may take a few minutes」を最後まで目立たせる
  p.glowFacts = [job.facts[0].id, job.facts[3].id];
  p.glowK = easeOut(prog(t, 7.6, 8.2));

  // 3〜5：同じ1枚の紙が、印 → 初稿 → 点検 → 初稿へ戻る → 最終稿 → 出力へ
  p.sheetPos = steps(t, 0, [[9.2, 1, 0.8], [12.4, 2, 0.8], [14.2, 3, 0.8], [18.6, 2, 0.8], [21.8, 4, 1.2], [25.2, 5, 0.8]]);
  p.markGlow = easeOut(prog(t, 10.0, 10.6));
  p.peel = ease(prog(t, 11.2, 12.4));
  p.refs = span(t, 14.8, 15.4, 19.0, 19.6);
  p.lens = span(t, 15.6, 16.2, 20.6, 21.2);
  p.readerGlow = span(t, 16.2, 16.8, 19.4, 20.0);
  p.loopGlow = span(t, 17.2, 17.8, 22.8, 23.6);
  p.loopRun = prog(t, 17.3, 18.5);
  p.rewrite = ease(prog(t, 20.8, 21.8));
  p.band = {
    material: span(t, 7.0, 7.5, 9.6, 10.0),
    mark: span(t, 10.1, 10.5, 12.3, 12.7),
    draft: span(t, 12.8, 13.2, 14.6, 15.0),
    check: span(t, 15.0, 15.4, 20.4, 21.0),
    final: easeOut(prog(t, 20.6, 21.2)),
  };
  // 6：最終稿の紙と条件の札が出力へ。読み比べの線とメモの見出し
  p.chipsTo = ease(prog(t, 25.4, 26.6));
  p.memoTabs = prog(t, 26.4, 27.2);
  p.compare = prog(t, 26.8, 27.8);

  // 強調：いま動いている部分を濃く。下限0.72で、ほかの部分も読める濃さに保つ。28.3秒から全体を同じ濃さへ
  p.emph.book = steps(t, 1, [[4.2, 0.74], [28.3, 1]]);
  p.emph.paper = steps(t, 1, [[9, 0.8], [14.6, 1], [20, 0.8], [25.2, 1]]);
  p.emph.reader = steps(t, 1, [[9, 0.78], [14.6, 1], [20, 0.78], [28.3, 1]]);
  p.emph.ai = steps(t, 1, [[4.2, 0.8], [9, 1], [25.2, 0.8], [28.3, 1]]);
  for (const key of ['final', 'compare', 'memo']) p.emph[key] = steps(t, 0.72, [[25.2, 1]]);
  return p;
}

// ---- 画面の枠：段階の印・見出し・足元 ---------------------------------------
function sceneIndex(t) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i;
  return 0;
}

function drawRail(c, comp, t) {
  const active = SCENES[sceneIndex(t)].rail;
  const labels = ['渡す', '推敲', '読み比べ'];
  const h = comp.kind === 'tall' ? 40 : 36;
  const size = comp.kind === 'tall' ? 19 : 17;
  c.save();
  c.font = `700 ${size}px system-ui, sans-serif`;
  const widths = labels.map((l) => Math.max(size * 2, c.measureText(l).width) + 28);
  c.restore();
  const gap = 10;
  const total = widths.reduce((s, w) => s + w, 0) + gap * (labels.length - 1);
  let x = comp.rail.align === 'right' ? comp.rail.x - total : comp.rail.x;
  labels.forEach((label, i) => {
    const w = widths[i];
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
    drawText(c, s.sub(d), comp.title.x, comp.sub.y + dy, {size: comp.sub.size, weight: 600, color: i === 3 ? PAL.amber : PAL.inkSoft, max: comp.title.max, alpha: a});
  });
  c.save();
  c.fillStyle = PAL.line;
  c.fillRect(comp.title.x, comp.foot.y - comp.foot.size * 1.6, comp.LW - comp.title.x * 2, 1);
  c.restore();
  drawText(c, 'Humanizer：MIT © 2025 Siqi Chen ／ 図解：Studio Yebisu ／ 架空の製品文・保存済みの結果', comp.title.x, comp.foot.y, {size: comp.foot.size, color: PAL.muted, max: (comp.LW - comp.title.x * 2) * 0.86});
  drawText(c, '無音', comp.LW - comp.title.x, comp.foot.y, {size: comp.foot.size, weight: 700, color: PAL.inkSoft, align: 'right'});
}

// ---- 1フレームを描く --------------------------------------------------------
let data = null;
let world = null;
let currentT = 0;

function buildWorld() {
  const comp = COMPOSE[orient];
  const L = diagramLayout(comp.kind, comp.world.w, comp.u, data, JOB);
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
  drawDiagram(c, world.L, filmParams(t, data), data, PAL);
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
  jumps: [...document.querySelectorAll('button[data-jump]')], orients: [...document.querySelectorAll('button[data-orient]')],
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
  if (!data) els.caption.textContent = '';
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
  if (RENDER || !data || playing) return;
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
  if (!data) return;
  pause();
  currentT = clampTime(t);
  render(currentT);
  syncUi(true);
}

function setOrientation(next) {
  if (RENDER || next === orient || !data) return;
  pause();
  orient = next;
  W = SIZES[next].width;
  H = SIZES[next].height;
  window.motionConfig.width = W;
  window.motionConfig.height = H;
  els.stage.dataset.orient = next;
  for (const b of els.orients) b.setAttribute('aria-pressed', String(b.dataset.orient === next));
  sizeCanvas();
  world = buildWorld();
  render(currentT);
  syncUi(true);
}

// ---- 読み込み：11件をすべて照合し、フォントを待ってから描く ----------------------
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
