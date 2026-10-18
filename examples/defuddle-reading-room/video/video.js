/* Defuddle 作例「Webページの本文を、Markdownで取り出す」— 32秒・無音の図解動画（編集できる元ページ）
 * 作例ページと同じ照合（21件の大きさ・SHA-256と中身の対応）と、同梱の Defuddle full版による3件の実際の parse() を
 * 読み込み時に1回だけ行い、同じ概念図を時刻 t の完成した画面として毎回最初から描く。フレームごとに Defuddle は呼ばない。
 * 例は「読書会」（reading）。題名・著者・Markdownの行・語句・ファイル名と大きさは、照合済みの記録と実際の戻り値から読む。
 * 映像の中の動きは流れの説明で、Defuddle の内部の処理や時間を記録したものではない。
 * 音は一切使わない（audioEvents は空、音声要素も音の読み込みもない）。AIもNodeもここでは動かない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

import {loadValidatedAssets, conceptLayout, drawConcept, restParams, drawText, PALETTES, FONT, ASSET_COUNT, ALL_EDGES, NODE_KEYS,
  AssetError, easeOut, ease, prog, steps, fmtBytes, SOURCE_COMMIT} from '../concept.js';

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 32;
const POSTER_TIME = 31;
const JOB = 'reading';
const SIZES = {portrait: {width: 720, height: 1280}, wide: {width: 1280, height: 720}};
const ORIENT_LABEL = {portrait: '縦', wide: '横'};
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
if (RENDER || /[?&]render(=|&|$)/.test(location.search)) root.classList.add('is-render');
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

// 縦と横で配置を作り直す（同じ時刻表・同じ図。横は横長の図の配置を使う）
const COMPOSE = {
  portrait: {LW: 720, LH: 1280, kind: 'tall', rail: {x: 40, y: 32, h: 46, size: 20, align: 'left'}, title: {x: 40, y: 130, size: 40, max: 640}, sub: {x: 40, y: 178, size: 21, max: 640}, world: {x: 10, y: 206, w: 700, h: 1026}, foot: {x: 40, y: 1256, size: 15, max: 640}},
  wide: {LW: 1280, LH: 720, kind: 'wide', rail: {x: 1240, y: 22, h: 38, size: 17, align: 'right'}, title: {x: 40, y: 48, size: 33, max: 820}, sub: {x: 40, y: 88, size: 19, max: 1200}, world: {x: 20, y: 112, w: 1240, h: 576}, foot: {x: 40, y: 706, size: 14, max: 1200}},
};
const layouts = {};
const layoutFor = (o) => (layouts[o] ||= conceptLayout(COMPOSE[o].kind, COMPOSE[o].world.w, COMPOSE[o].world.h));

// 7場面。最後の動きは28.9秒で終え、29〜32秒は完全に静止させる。
const SCENES = [
  {start: 0, rail: -1, title: () => 'Defuddle：本文を取り出すライブラリ', sub: () => 'JavaScript・中に「題名・著者」「本文を選ぶ」「Markdown」'},
  {start: 4, rail: 0, title: () => '渡す：ページのHTMLをDocumentに', sub: (d, j) => `${j.fixture} → DOMParser　URL（取得しない）と3つの設定を添える`},
  {start: 8, rail: 1, title: () => '取り出す：題名・著者と本文を分ける', sub: () => '本文を選び、外側の領域を外す（説明図・内部の記録ではない）'},
  {start: 14, rail: 1, title: () => '本文が、Markdownの行になる', sub: (d, j) => { const s = j.live.stats; return `## 見出し${s.headings}・段落${s.paragraphs}・- リスト${s.items}項目　title と author も返る`; }},
  {start: 20, rail: 2, title: () => '語句を文字どおり照合（作例側）', sub: (d, j) => `残る${j.live.kept.length}語はすべてある・本文の外の${j.live.removed.length}語は無い　意味や品質の採点ではない`},
  {start: 26, rail: 2, title: () => '保存して、読む・見比べる', sub: (d, j) => `${j.output.file}（${fmtBytes(j.output.bytes)}）→ メモ・元のページ`},
  {start: 29, rail: 3, title: () => 'Webページの本文を、Markdownで取り出す', sub: () => '渡す → 取り出す → 使う　同梱のfull版の実際の戻り値から描画'},
];
const RANGES = ['0〜4', '4〜8', '8〜14', '14〜20', '20〜26', '26〜29', '29〜32'];
const sceneIndex = (t) => { for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i; return 0; };
// 見出しと段階の印は場面の0.5秒前から0.1秒前までに入れ替え、29秒からは何も動かさない
const LEAD = 0.5;
const titleIndex = (t) => sceneIndex(t + LEAD);

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
function filmParams(t) {
  const p = restParams();
  const S = p.show, D = p.draw, F = p.flow, E = p.emph, G = p.emphEdge;
  for (const k of NODE_KEYS) S[k] = 0;
  for (const k of ALL_EDGES) { D[k] = 0; F[k] = 0; }

  // 0〜4：Defuddle の箱が現れ、ふたが上がって3つの部屋（題名・著者／本文を選ぶ／Markdown）が見える
  S.machine = easeOut(prog(t, 0.2, 0.9));
  p.lid = 1 - ease(prog(t, 1.0, 2.0));
  // 順に：題名・著者 → 本文を選ぶ → Markdown（並びは [題名・著者, 本文を選ぶ, Markdown]）
  p.chambers = [easeOut(prog(t, 1.4, 1.9)), easeOut(prog(t, 1.8, 2.3)), easeOut(prog(t, 2.2, 2.7))];
  D.inMeta = prog(t, 2.6, 3.1);
  D.lensConv = prog(t, 2.8, 3.3);

  // 4〜8：同じ架空のページが色分けされ、HTMLファイル → Document。URLと3つの設定が添えられて入口へ
  S.page = easeOut(prog(t, 4.0, 4.5));
  p.regions = ease(prog(t, 4.5, 5.6));
  S.file = easeOut(prog(t, 5.3, 5.7));
  D.pageFile = prog(t, 5.3, 5.7);
  F.pageFile = prog(t, 5.5, 6.1);
  p.file = prog(t, 5.6, 6.4);
  S.doc = easeOut(prog(t, 6.1, 6.5));
  D.fileDoc = prog(t, 6.1, 6.5);
  F.fileDoc = prog(t, 6.3, 6.8);
  p.doc = prog(t, 6.3, 7.1);
  S.opts = easeOut(prog(t, 6.7, 7.1));
  D.docOpts = prog(t, 6.7, 7.1);
  F.docOpts = prog(t, 7.0, 7.5);
  p.opts = prog(t, 6.9, 7.7);
  D.optsMach = prog(t, 7.4, 7.9);
  F.optsMach = prog(t, 7.6, 8.1);

  // 8〜14：同じDocumentが入る。題名・著者の札は分かれ、記事の段落は虫めがねの下へ、外側の領域は受け皿へ
  p.meta = prog(t, 8.6, 10.4);
  F.inMeta = prog(t, 9.2, 10.0);
  p.drop = prog(t, 9.4, 12.4);
  p.travelA = prog(t, 9.8, 12.8);

  // 14〜20：札が返る値の上段へ、段落はMarkdownの部屋を通って行になり、## と - の印と文字に変わる
  S.card = easeOut(prog(t, 13.8, 14.3));
  D.metaCard = D.convCard = prog(t, 14.0, 14.5);
  p.metaOut = prog(t, 14.4, 15.6);
  F.metaCard = prog(t, 14.6, 15.4);
  F.lensConv = prog(t, 14.6, 15.4);
  p.travelB = prog(t, 14.8, 17.0);
  F.convCard = prog(t, 15.4, 16.2);
  p.md = prog(t, 17.0, 18.6);

  // 20〜26：作例側の照合。残る語句の行に藍の印が付き、本文の外の語は無いと数える
  S.check = easeOut(prog(t, 20.0, 20.4));
  D.cardCheck = prog(t, 20.0, 20.5);
  F.cardCheck = prog(t, 20.3, 20.9);
  p.checks = prog(t, 20.8, 25.0);
  p.tagText = 1;

  // 26〜29：同じ行が reading.md になり、メモへ貼られ、元のページと見比べる
  S.mdfile = easeOut(prog(t, 26.0, 26.4));
  D.checkFile = prog(t, 26.0, 26.4);
  F.checkFile = prog(t, 26.2, 26.7);
  p.files = prog(t, 26.3, 27.2);
  S.memo = S.viewer = easeOut(prog(t, 27.0, 27.4));
  D.fileMemo = D.fileViewer = prog(t, 27.0, 27.4);
  F.fileMemo = F.fileViewer = prog(t, 27.3, 27.8);
  p.use = prog(t, 27.4, 28.3);

  // 29〜32：全体の経路を同じ濃さで静止（入りは28.3〜28.9秒）
  const whole = prog(t, 28.3, 28.9);
  for (const k of ALL_EDGES) F[k] = Math.max(F[k] || 0, whole);

  // 強調：いま動いている部分を濃く。下限0.7で、ほかの部分も読める濃さに保つ
  const lo = 0.7;
  E.page = E.file = steps(t, 1, [[8.0, lo], [28.3, 1]]);
  E.doc = E.opts = steps(t, 1, [[13.8, lo], [28.3, 1]]);
  E.machine = steps(t, 1, [[4.0, lo], [8.0, 1], [19.8, lo], [28.3, 1]]);
  E.card = steps(t, 1, [[25.8, lo], [28.3, 1]]);
  E.check = steps(t, 1, [[25.8, lo], [28.3, 1]]);
  G.give = steps(t, 1, [[13.8, lo], [28.3, 1]]);
  G.take = steps(t, 1, [[19.8, lo], [28.3, 1]]);
  return p;
}

// ---- 画面の枠：段階の印・見出し・足元 ---------------------------------------
function drawRail(comp, t) {
  const active = SCENES[titleIndex(t)].rail;
  const labels = ['渡す', '取り出す', '使う'];
  const {h, size} = comp.rail;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT.sans}`;
  const widths = labels.map((l) => ctx.measureText(l).width + size * 1.6);
  const gap = 8;
  const total = widths.reduce((s, w) => s + w, 0) + gap * (labels.length - 1);
  let x = comp.rail.align === 'right' ? comp.rail.x - total : comp.rail.x;
  labels.forEach((label, i) => {
    const w = widths[i];
    const on = active === 3 || i === active;
    ctx.fillStyle = on ? PAL.ink : PAL.bg;
    ctx.fillRect(x, comp.rail.y, w, h);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x + 0.7, comp.rail.y + 0.7, w - 1.4, h - 1.4);
    drawText(ctx, label, x + w / 2, comp.rail.y + h / 2, {size, weight: 700, color: on ? PAL.bg : PAL.ink, align: 'center'});
    x += w + gap;
  });
  ctx.restore();
}

function drawTitles(comp, t) {
  const job = data.jobs[JOB];
  const i = titleIndex(t);
  const k = i === 0 ? 1 : easeOut(prog(t, SCENES[i].start - LEAD, SCENES[i].start - 0.1));
  const one = (scene, a, dy) => {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = a;
    drawText(ctx, scene.title(data, job), comp.title.x, comp.title.y + dy, {size: comp.title.size, weight: 700, family: FONT.mincho, color: PAL.ink, max: comp.title.max, min: 22});
    drawText(ctx, scene.sub(data, job), comp.sub.x, comp.sub.y + dy, {size: comp.sub.size, color: PAL.muted, max: comp.sub.max, min: 13});
    ctx.restore();
  };
  if (i > 0 && k < 1) one(SCENES[i - 1], 1 - k, -8 * k);
  one(SCENES[i], k, 8 * (1 - k));
}

function drawFoot(comp) {
  drawText(ctx, `kepano/defuddle ${SOURCE_COMMIT.slice(0, 7)}・MIT　同梱のfull版をブラウザーで実行した戻り値から描画・無音`, comp.foot.x, comp.foot.y, {size: comp.foot.size, color: PAL.muted, max: comp.foot.max, min: 10});
}

// いま加わった形を大きく、合流するたびに連続して引く。拡大は1〜2.4倍。絶対時刻だけで決まる。
function diagramCamera(L, t) {
  const fit = (keys, free) => {
    const rects = keys.map((k) => L.n[k]);
    const pad = 16;
    const x = Math.min(...rects.map((r) => r.x)) - pad, y = Math.min(...rects.map((r) => r.y)) - pad;
    const width = Math.max(...rects.map((r) => r.x + r.w)) + pad - x;
    const height = Math.max(...rects.map((r) => r.y + r.h)) + pad - y;
    const z = Math.max(1, Math.min(L.W / width, L.H / height, 2.4));
    const cx = (L.W - width * z) / 2 - x * z, cy = (L.H - height * z) / 2 - y * z;
    // free：まだほかの形が無い最初の場面だけ、箱を画面の中央へ寄せる
    if (free) return {z, x: cx, y: cy};
    return {z, x: Math.min(0, Math.max(L.W - L.W * z, cx)), y: Math.min(0, Math.max(L.H - L.H * z, cy))};
  };
  const poses = [
    fit(['machine', 'tab'], true),
    fit(['page', 'file', 'doc', 'opts']),
    fit(['doc', 'opts', 'machine']),
    fit(['machine', 'card']),
    fit(['card']),
    fit(['card', 'check']),
    fit(['card', 'check', 'mdfile', 'memo', 'viewer']),
    {z: 1, x: 0, y: 0},
  ];
  const transitions = [[3.3, 4.0], [7.6, 8.3], [13.6, 14.3], [16.6, 17.3], [19.6, 20.3], [25.6, 26.3], [28.2, 28.9]];
  const out = {...poses[0]};
  transitions.forEach(([a, b], i) => {
    const k = ease(prog(t, a, b));
    for (const key of ['z', 'x', 'y']) out[key] += (poses[i + 1][key] - poses[i][key]) * k;
  });
  return out;
}

function drawFrame(t) {
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setLineDash([]);
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, W, H);
  if (data) {
    const comp = COMPOSE[orient];
    const k = Math.min(W / comp.LW, H / comp.LH);
    ctx.setTransform(k, 0, 0, k, (W - comp.LW * k) / 2, (H - comp.LH * k) / 2);
    drawRail(comp, t);
    drawTitles(comp, t);
    ctx.save();
    ctx.translate(comp.world.x, comp.world.y);
    ctx.beginPath();
    ctx.rect(0, 0, comp.world.w, comp.world.h);
    ctx.clip();
    const L = layoutFor(orient), camera = diagramCamera(L, t);
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.z, camera.z);
    drawConcept(ctx, L, filmParams(t), data, PAL, JOB);
    ctx.restore();
    drawFoot(comp);
  }
  ctx.restore();
}

// ---- 準備と任意時刻の描画 ---------------------------------------------------
let data = null;
let current = 0;
let loadGen = 0;
let controller = null;

const $ = (id) => document.getElementById(id);
const statusEl = $('asset-status');
const retryBtn = $('retry');
const controls = () => document.querySelectorAll('#play, #reset, #replay, #end, #time, button[data-jump], button[data-orient]');
const dimsText = () => `${ORIENT_LABEL[orient] || ''} ${W}×${H}`.trim();
function setControls(on) {
  if (RENDER) return;
  // 書き出しの大きさが決まっているときは、向きの切り替えだけを止める
  controls().forEach((el) => { el.disabled = !on || (el.matches('button[data-orient]') && hasSize); });
}
function setStatus(text, state) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.state = state;
  statusEl.setAttribute('role', state === 'error' ? 'alert' : 'status');
}
const readyText = () => `素材${ASSET_COUNT}件を照合し、同梱の Defuddle で3件を取り出して、保存済みの出力と全文一致を確かめました。いまの画面：${dimsText()}・${FPS}fps・${DURATION}秒・無音。`;

function prepare() {
  const gen = ++loadGen;
  controller?.abort();
  controller = new AbortController();
  data = null;
  pause();
  setControls(false);
  if (retryBtn) retryBtn.hidden = true;
  setStatus(`素材 0/${ASSET_COUNT} を照合しています…`, 'loading');
  drawFrame(current);
  const ready = (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const bundle = await loadValidatedAssets({
      signal: controller.signal,
      onProgress: (phase, done, total) => {
        if (gen !== loadGen || statusEl?.dataset.state !== 'loading') return;
        setStatus(phase === 'assets' ? `素材 ${done}/${total} を照合しています…` : `同梱の Defuddle で${total}件を取り出しています…`, 'loading');
      },
    });
    if (gen !== loadGen) throw new DOMException('aborted', 'AbortError');
    data = bundle;
    setStatus(readyText(), 'ready');
    setControls(true);
    show(current);
  })();
  ready.catch((error) => {
    if (gen !== loadGen || error?.name === 'AbortError') return;
    data = null;
    pause();
    setControls(false);
    drawFrame(current);
    if (!RENDER) { const cap = $('film-caption'); if (cap) { cap.textContent = ''; delete cap.dataset.scene; } }
    setStatus(`${error instanceof AssetError ? error.message : '素材を読めませんでした'}。描画を止めました。ローカルのHTTPサーバー経由で開き直してください。`, 'error');
    if (retryBtn) retryBtn.hidden = false;
  });
  window.motionReady = ready;
  return ready;
}

const clampT = (s) => Math.max(0, Math.min(DURATION, Number(s) || 0));
window.seek = async (seconds) => {
  await window.motionReady;
  const frame = Math.min(Math.round(clampT(seconds) * FPS), Math.round(DURATION * FPS));
  const t = frame / FPS;
  current = t;
  drawFrame(t);
  if (!RENDER) syncUi(t);
  return {time: t, frame};
};

// ---- プレビュー（書き出し時は使わない） -------------------------------------
let playing = false, raf = 0, startAt = 0;
function syncUi(t) {
  const range = $('time'), clock = $('clock'), cap = $('film-caption');
  if (range) range.value = t.toFixed(1);
  if (clock) clock.value = `${t.toFixed(1)}秒 / ${DURATION.toFixed(1)}秒`;
  const i = sceneIndex(t);
  if (cap && data && cap.dataset.scene !== String(i)) { cap.dataset.scene = String(i); cap.textContent = `${RANGES[i]}秒　${SCENES[i].title(data, data.jobs[JOB])}`; }
}
function show(t) {
  current = clampT(t);
  drawFrame(current);
  if (!RENDER) syncUi(current);
}
function pause() {
  playing = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  const btn = $('play');
  if (btn && !RENDER) { btn.textContent = '再生'; btn.setAttribute('aria-pressed', 'false'); }
}
function play() {
  if (RENDER || !data) return;
  if (current >= DURATION) current = 0;
  playing = true;
  startAt = performance.now() - current * 1000;
  const btn = $('play');
  btn.textContent = '一時停止';
  btn.setAttribute('aria-pressed', 'true');
  const tick = (now) => {
    if (!playing) return;
    const t = (now - startAt) / 1000;
    if (t >= DURATION) { show(DURATION); pause(); return; }
    show(t);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function syncDims() {
  const dims = $('film-dims');
  if (dims) dims.textContent = dimsText();
  canvas.setAttribute('width', String(W));
  canvas.setAttribute('height', String(H));
}
function setOrient(o) {
  if (hasSize || !SIZES[o] || !data) return;
  pause();
  orient = o;
  W = SIZES[o].width;
  H = SIZES[o].height;
  window.motionConfig.width = W;
  window.motionConfig.height = H;
  $('stage')?.setAttribute('data-orient', o);
  document.querySelectorAll('button[data-orient]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === o)));
  syncDims();
  setStatus(readyText(), 'ready');
  show(current);
}

if (!RENDER) {
  $('play')?.addEventListener('click', () => (playing ? pause() : play()));
  $('reset')?.addEventListener('click', () => { pause(); show(0); });
  $('replay')?.addEventListener('click', () => { pause(); show(0); play(); });
  $('end')?.addEventListener('click', () => { pause(); show(DURATION); });
  $('time')?.addEventListener('input', (e) => { pause(); show(Number(e.target.value)); });
  document.querySelectorAll('button[data-jump]').forEach((b) => b.addEventListener('click', () => { pause(); show(Number(b.dataset.jump)); }));
  document.querySelectorAll('button[data-orient]').forEach((b) => b.addEventListener('click', () => setOrient(b.dataset.orient)));
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
  retryBtn?.addEventListener('click', () => prepare());
  $('stage')?.setAttribute('data-orient', orient);
  document.querySelectorAll('button[data-orient]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === orient)));
  syncDims();
}

prepare();
