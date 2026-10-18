/* 3D Asset Server 作例「既存の3D素材を探し、一式で受け取る」— 32秒・無音の図解動画（編集できる元ページ）
 * 作例ページと同じ照合（25件の大きさ・SHA-256と、記録どうしの中身の対応）を読み込み時に1回だけ行い、
 * 同じ概念図を時刻 t の完成した画面として毎回最初から描く。フレームごとの取得や通信はしない。
 * 主な例は A08（1kを取得）。A04（8kは止まる）の脇道と A07（Fab は skipped）は、別の記録として同じ図の中で短く示す。
 * 候補・状態・ファイル・大きさ・出典は、照合済みの記録と実ファイルから読む。実物の静止画は、照合したバイトから読んだもの。
 * 映像の中の動きは流れの説明で、元の実行の時間や内部の記録ではない。
 * 音は一切使わない（audioEvents は空、音声要素も音の読み込みもない）。AIもNodeもここでは動かない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

import {loadValidatedAssets, conceptLayout, drawConcept, restParams, drawText, PALETTES, FONT, ASSET_COUNT, ALL_EDGES, NODE_KEYS,
  AssetError, easeOut, ease, prog, steps, fmtMiB, REPO, SOURCE_COMMIT} from '../concept.js';

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 32;
const POSTER_TIME = 31;
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
  portrait: {LW: 720, LH: 1280, kind: 'tall', rail: {x: 40, y: 30, h: 46, size: 20, align: 'left'}, title: {x: 40, y: 128, size: 38, max: 640}, sub: {x: 40, y: 174, size: 20, max: 640}, world: {x: 10, y: 202, w: 700, h: 1032}, foot: {x: 40, y: 1256, size: 15, max: 640}},
  wide: {LW: 1280, LH: 720, kind: 'wide', rail: {x: 1240, y: 22, h: 38, size: 17, align: 'right'}, title: {x: 40, y: 46, size: 31, max: 760}, sub: {x: 40, y: 86, size: 18, max: 1200}, world: {x: 20, y: 108, w: 1240, h: 586}, foot: {x: 40, y: 708, size: 14, max: 1200}},
};
const layouts = {};
const layoutFor = (o) => (layouts[o] ||= conceptLayout(COMPOSE[o].kind, COMPOSE[o].world.w, COMPOSE[o].world.h));

// 7場面。最後の動きは28.9秒で終え、29〜32秒は完全に静止させる。数と名前は照合済みの記録から読む。
const SCENES = [
  {start: 0, rail: -1, title: () => '既存の3D素材を探し、一式で受け取る', sub: () => '3D Asset Server：AIが読む手順書と、検索・確認・取得の道具'},
  {start: 4, rail: 0, title: () => '渡す：手順書と依頼から、AIが run.mjs を書く', sub: () => 'Nodeで実行したのは制作担当（別の工程）'},
  {start: 8, rail: 1, title: () => '原典の AssetService が配信元へ振り分ける', sub: (d) => `Poly Haven から候補${d.candidates.length}件・Fab は検索URLだけ（通信なし）`},
  {start: 14, rail: 1, title: () => '取得の前に、合計を予算と比べる', sub: (d) => `A08 1k ${fmtMiB(d.jobs.A08.total)}は通る・A04 8k ${fmtMiB(d.jobs.A04.total)}は通信${d.jobs.A04.requests}件で止まる`},
  {start: 20, rail: 2, title: (d) => `受け取る：${d.jobs.A08.files.length}ファイルが相対パスのままフォルダーへ`, sub: (d) => `gltf + bin + 画像${d.jobs.A08.contents.images}・${d.asset.author} / ${d.asset.provider} / ${d.asset.license.name}`},
  {start: 26, rail: 2, title: () => '保存した実物を、実3DとZIPで使う', sub: () => '保存した記録と実ファイルを読むだけ（再検索・再取得なし）'},
  {start: 29, rail: 3, title: () => '既存の3D素材を探し、一式で受け取る', sub: () => '手順書と依頼 → AIが書く → Nodeで実行 → 配信元・選択・予算 → 実物'},
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
  // A08 の通り道と A04 の脇道を両方見せる（別々の記録）
  p.lane1 = 1;
  p.lane8 = 1;
  p.res = '1k';

  // 0〜4：手順書の本が開き、見出し札3つと規則の印5つ。隣に検索・取得の道具（AssetService と2つの配信元）の形
  S.book = easeOut(prog(t, 0.2, 0.8));
  p.bookOpen = prog(t, 0.5, 1.4);
  p.tabs = prog(t, 1.0, 2.0);
  p.rules = prog(t, 1.6, 2.8);
  S.service = easeOut(prog(t, 0.9, 1.4));
  S.ph = S.fab = easeOut(prog(t, 1.3, 1.8));
  D.servicePh = D.serviceFab = prog(t, 1.3, 1.8);
  S.other = easeOut(prog(t, 2.6, 3.1));
  D.bookOther = prog(t, 2.6, 3.1);

  // 4〜8：依頼の札と本の写しがAIへ合流 → AIが run.mjs を書く → 写しが制作担当へ渡る
  S.request = easeOut(prog(t, 4.0, 4.4));
  S.ai = easeOut(prog(t, 4.2, 4.6));
  D.bookAi = D.reqAi = prog(t, 4.4, 4.8);
  F.bookAi = F.reqAi = prog(t, 4.7, 5.3);
  p.give = prog(t, 4.7, 5.7);
  S.script = easeOut(prog(t, 5.6, 5.9));
  D.aiScript = prog(t, 5.6, 5.9);
  F.aiScript = prog(t, 5.8, 6.2);
  p.write = prog(t, 5.9, 6.6);
  S.operator = easeOut(prog(t, 6.4, 6.8));
  D.scriptOp = prog(t, 6.5, 6.9);
  F.scriptOp = prog(t, 6.8, 7.3);
  p.hand = prog(t, 6.8, 7.6);
  p.run = prog(t, 7.5, 7.9);

  // 8〜14：実行が AssetService から2つの配信元へ分かれ、候補カードとリンクが届く。選んだ木箱に札
  D.opService = prog(t, 8.0, 8.4);
  F.opService = prog(t, 8.3, 8.8);
  p.fork = prog(t, 8.4, 9.6);
  F.servicePh = F.serviceFab = prog(t, 8.9, 9.5);
  S.cands = S.fabres = easeOut(prog(t, 9.2, 9.6));
  D.phCands = D.fabRes = prog(t, 9.3, 9.7);
  F.phCands = F.fabRes = prog(t, 9.6, 10.0);
  p.cards = prog(t, 9.7, 11.2);
  p.fabLink = prog(t, 9.9, 10.9);
  p.tags = prog(t, 11.6, 12.8);

  // 14〜20：同じカードが5つのファイルに開き、1k の通り道と 8k の脇道へ。予算の棒を塗り、8k は端で止まる
  S.gate = easeOut(prog(t, 14.0, 14.4));
  D.cardsGate = D.side8k = prog(t, 14.2, 14.7);
  F.cardsGate = F.side8k = prog(t, 14.6, 15.2);
  p.split1 = p.split8 = prog(t, 14.8, 16.4);
  p.meter1 = p.meter8 = prog(t, 16.6, 17.6);
  p.stop8 = prog(t, 17.8, 18.6);

  // 20〜26：1k の5ファイルがフォルダーへ合流し、実物の静止画が現れる。Fab の欄に A07 の skipped
  S.folder = easeOut(prog(t, 20.0, 20.4));
  D.gateFolder = prog(t, 20.2, 20.6);
  F.gateFolder = prog(t, 20.5, 21.1);
  p.pass1 = prog(t, 20.6, 22.4);
  S.preview = easeOut(prog(t, 22.2, 22.6));
  D.folderPreview = prog(t, 22.4, 22.8);
  F.folderPreview = prog(t, 22.7, 23.1);
  p.reveal = prog(t, 23.0, 24.0);
  p.fabSkip = prog(t, 24.2, 25.0);

  // 26〜29：フォルダーに ZIP、実物の表示に実3Dの札
  p.bundle = prog(t, 26.2, 27.4);

  // 29〜32：全体の経路を同じ濃さで静止（入りは28.3〜28.9秒）
  const whole = prog(t, 28.3, 28.9);
  for (const k of ALL_EDGES) F[k] = Math.max(F[k] || 0, whole);

  // 強調：いま動いている部分を濃く。下限0.7で、ほかの部分も読める濃さに保つ
  const lo = 0.7;
  E.book = E.other = E.request = E.ai = E.script = steps(t, 1, [[8.0, lo], [28.3, 1]]);
  E.operator = steps(t, 1, [[14.0, lo], [28.3, 1]]);
  E.service = E.ph = E.fab = steps(t, 1, [[4.0, lo], [8.0, 1], [14.0, lo], [28.3, 1]]);
  E.cands = steps(t, 1, [[20.0, lo], [28.3, 1]]);
  E.fabres = steps(t, 1, [[14.0, lo], [24.0, 1], [25.6, lo], [28.3, 1]]);
  E.gate = steps(t, 1, [[20.0, lo], [28.3, 1]]);
  G[0] = steps(t, 1, [[8.0, lo], [28.3, 1]]);
  G[1] = steps(t, 1, [[20.0, lo], [28.3, 1]]);
  G[2] = 1;
  return p;
}

// ---- 画面の枠：段階の印・見出し・足元 ---------------------------------------
function drawRail(comp, t) {
  const active = SCENES[titleIndex(t)].rail;
  const labels = ['渡す', '選んで確かめる', '受け取る'];
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
  const i = titleIndex(t);
  const k = i === 0 ? 1 : easeOut(prog(t, SCENES[i].start - LEAD, SCENES[i].start - 0.1));
  const one = (scene, a, dy) => {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = a;
    drawText(ctx, scene.title(data), comp.title.x, comp.title.y + dy, {size: comp.title.size, weight: 700, family: FONT.mincho, color: PAL.ink, max: comp.title.max, min: 22});
    drawText(ctx, scene.sub(data), comp.sub.x, comp.sub.y + dy, {size: comp.sub.size, color: PAL.muted, max: comp.sub.max, min: 13});
    ctx.restore();
  };
  if (i > 0 && k < 1) one(SCENES[i - 1], 1 - k, -8 * k);
  one(SCENES[i], k, 8 * (1 - k));
}

function drawFoot(comp) {
  drawText(ctx, `${REPO} ${SOURCE_COMMIT.slice(0, 7)}・Apache-2.0　保存した実記録と実ファイルから描画・無音`, comp.foot.x, comp.foot.y, {size: comp.foot.size, color: PAL.muted, max: comp.foot.max, min: 10});
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
    // free：まだほかの形が無い最初の場面だけ、形を画面の中央へ寄せる
    if (free) return {z, x: cx, y: cy};
    return {z, x: Math.min(0, Math.max(L.W - L.W * z, cx)), y: Math.min(0, Math.max(L.H - L.H * z, cy))};
  };
  const poses = [
    fit(['book', 'service', 'ph', 'fab'], true),
    fit(['book', 'other', 'request', 'ai', 'script', 'operator']),
    fit(['operator', 'service', 'ph', 'fab', 'cands', 'fabres']),
    fit(['cands', 'fabres', 'gate']),
    fit(['fabres', 'gate', 'folder', 'preview']),
    fit(['folder', 'preview']),
    {z: 1, x: 0, y: 0},
  ];
  const transitions = [[3.3, 4.0], [7.6, 8.3], [13.6, 14.3], [19.6, 20.3], [25.6, 26.3], [28.2, 28.9]];
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
    drawConcept(ctx, L, filmParams(t), data, PAL);
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
const readyText = () => `素材${ASSET_COUNT}件を照合しました。保存した実記録と実ファイルだけから描いています。いまの画面：${dimsText()}・${FPS}fps・${DURATION}秒・無音。`;

function prepare() {
  const gen = ++loadGen;
  controller?.abort();
  controller = new AbortController();
  data = null;
  pause();
  setControls(false);
  if (retryBtn) retryBtn.hidden = true;
  if (!RENDER) { const cap = $('film-caption'); if (cap) { cap.textContent = ''; delete cap.dataset.scene; } }
  setStatus(`素材 0/${ASSET_COUNT} を照合しています…`, 'loading');
  drawFrame(current);
  const ready = (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const bundle = await loadValidatedAssets({
      signal: controller.signal,
      onProgress: (phase, done, total) => {
        if (gen !== loadGen || statusEl?.dataset.state !== 'loading') return;
        setStatus(phase === 'assets' ? `素材 ${done}/${total} を照合しています…` : '照合した静止画を読み込んでいます…', 'loading');
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
  if (cap && data && cap.dataset.scene !== String(i)) { cap.dataset.scene = String(i); cap.textContent = `${RANGES[i]}秒　${SCENES[i].title(data)}`; }
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
