/* brief-to-demo 作例「ひと言を、制作の設計図へ」— 32秒・無音の図解動画（編集できる元ページ）
 * 作例ページと同じ照合（12件の大きさ・SHA-256と中身の対応）と同じ概念図を使い、時刻 t の完成した画面を毎回最初から描く。
 * 例はUI画面の依頼（ui）。依頼文・分野・読むスキル・未提供の言い回し・ファイル名と大きさはすべて照合済みの保存記録から読む。
 * 音は一切使わない（audioEvents は空、音声要素も音の読み込みもない）。AIはここでは動かない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

import {loadValidatedAssets, conceptLayout, drawConcept, restParams, drawText, PALETTES, FONT, ASSET_COUNT, ACTUAL_EDGES, AssetError, easeOut, ease, prog, span, steps} from '../concept.js';

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 32;
const POSTER_TIME = 31;
const JOB = 'ui';
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

// 縦と横で配置を作り直す（同じ時刻表・同じ図）
const COMPOSE = {
  portrait: {LW: 720, LH: 1280, kind: 'tall', rail: {x: 40, y: 34, h: 44, size: 20, align: 'left'}, title: {x: 40, y: 134, size: 44, max: 640}, sub: {x: 40, y: 184, size: 23, max: 640}, world: {x: 10, y: 214, w: 700, h: 1012}, foot: {x: 40, y: 1252, size: 16, max: 640}},
  wide: {LW: 1280, LH: 720, kind: 'wide', rail: {x: 1240, y: 22, h: 38, size: 17, align: 'right'}, title: {x: 40, y: 50, size: 36, max: 800}, sub: {x: 40, y: 90, size: 19, max: 800}, world: {x: 20, y: 116, w: 1240, h: 572}, foot: {x: 40, y: 704, size: 14, max: 1200}},
};
const layouts = {};
const layoutFor = (o) => (layouts[o] ||= conceptLayout(COMPOSE[o].kind, COMPOSE[o].world.w, COMPOSE[o].world.h));

// 7場面。最後の場面の入りは28.3〜28.9秒で終え、29〜32秒は完全に静止させる。
const fileLabel = (f) => `${f.path.split('/').pop()} ${f.bytes.toLocaleString('en-US')} B`;
const SCENES = [
  {start: 0, title: 'AIが読む指示書', sub: () => 'brief-to-demo の SKILL.md と、3つの決まり', rail: 0},
  {start: 4, title: '指示書と依頼1枚を、1つのAIへ', sub: () => '受け取ったのは短い依頼文だけ。素材はなし', rail: 0},
  {start: 8, title: '同じ紙が、11項目のブリーフに開く', sub: () => '4つのまとまりは説明用。11項目は原典のJSON', rail: 1},
  {start: 13, title: '次に受け取る素材と、読むスキル', sub: (j) => `素材は計画だけ・分野 ${j.categoryLabel} → 読む ${j.skill.name}`, rail: 1},
  {start: 18, title: '仮の条件は、別のポケットへ', sub: (j) => `「${j.unset.text}」。値は入れない`, rail: 1},
  {start: 23, title: '保存したJSONと、引き継ぎ文', sub: (j) => `${fileLabel(j.json)}・${fileLabel(j.handoff)}・次の制作は未実行`, rail: 2},
  {start: 29, title: 'ひと言を、制作の設計図へ', sub: () => '指示書と依頼 → 1つのAI → 11項目 → 保存・コピー', rail: 3},
];
const RANGES = ['0〜4', '4〜8', '8〜13', '13〜18', '18〜23', '23〜29', '29〜32'];
const sceneIndex = (t) => { for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i; return 0; };
// 見出しと段階の印は場面の0.5秒前から0.1秒前までに入れ替え、29秒からは何も動かさない
const LEAD = 0.5;
const titleIndex = (t) => sceneIndex(t + LEAD);

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
function filmParams(t) {
  const p = restParams();
  const S = p.show, D = p.draw, F = p.flow, E = p.emph, G = p.emphEdge;
  for (const k of Object.keys(SHOW_KEYS)) S[k] = 0;

  // 0〜4：本は最初から見える。開きながら3つの決まりの札が順に現れる
  S.book = 1;
  p.bookOpen = 0.5 + 0.5 * easeOut(prog(t, 0, 1.2));
  p.rules = 3 * prog(t, 0.5, 2.6);

  // 4〜8：受け取ったのは依頼文1枚だけ（素材の欄は空）。本と依頼の線が1つのAIへ入り、紙が作業台へ
  S.tray = S.sheet = easeOut(prog(t, 4.0, 4.6));
  S.ai = easeOut(prog(t, 4.4, 5.0));
  D.bookIn = prog(t, 5.0, 5.6);
  D.reqIn = prog(t, 5.2, 5.8);
  F.bookIn = F.reqIn = prog(t, 5.6, 6.4) * (1 - prog(t, 12.4, 13.0));
  p.s = ease(prog(t, 6.3, 7.6)) + ease(prog(t, 8.6, 10.0));

  // 8〜13：同じ紙が開いて11項目の袋になる。3つのまとまりが順に埋まり、仮の条件のポケットが少し出る
  S.packet = S.pocket = easeOut(prog(t, 8.0, 8.5));
  D.open = prog(t, 8.2, 8.7);
  F.open = prog(t, 8.6, 9.4) * (1 - prog(t, 17.6, 18.2));
  p.fill = easeOut(prog(t, 9.4, 10.2));
  p.groupFill = [easeOut(prog(t, 9.8, 10.6)), easeOut(prog(t, 10.5, 11.3)), easeOut(prog(t, 11.2, 12.0))];
  p.pocketOut = 0.6 * prog(t, 11.6, 12.4) + 0.4 * prog(t, 18.3, 19.5);

  // 13〜18：受け取った依頼と、まだ受け取っていない素材の計画を並べる。分野と読むスキルが決まる
  const hold = (a) => span(t, a, a + 0.6, 17.4, 18.0);
  p.trayGlow = Math.max(span(t, 4.6, 5.0, 7.2, 7.8), hold(13.2));
  p.slotGlow = {inputs: hold(13.2), category: hold(14.8), skill_refs: hold(15.8)};
  S.route = easeOut(prog(t, 14.4, 15.0));
  D.route = prog(t, 14.5, 15.0);
  F.route = prog(t, 15.0, 15.7) * (1 - prog(t, 22.6, 23.2));
  p.route = easeOut(prog(t, 15.3, 16.0));
  p.skillName = easeOut(prog(t, 16.0, 16.7));

  // 18〜23：ポケットが分かれ、中空の印4つと「未提供」の言い回しが値のないまま残る
  p.pins = 4 * prog(t, 19.3, 20.7);
  p.unset = easeOut(prog(t, 20.8, 21.6));
  p.ruleGlow = {'by-result': hold(14.8), separate: span(t, 18.3, 18.9, 22.4, 23.0), 'no-facts': span(t, 20.8, 21.4, 22.4, 23.0)};

  // 23〜29：保存済みのJSONと引き継ぎ文。次の制作は点線の枠だけ（未実行）
  D.toJson = prog(t, 23.1, 23.6);
  D.toHandoff = prog(t, 23.3, 23.8);
  S.json = easeOut(prog(t, 23.4, 24.0));
  S.handoff = easeOut(prog(t, 23.9, 24.5));
  p.outputs = easeOut(prog(t, 23.8, 24.8));
  F.toJson = prog(t, 23.6, 24.3);
  F.toHandoff = prog(t, 23.8, 24.5);
  S.next = easeOut(prog(t, 25.4, 26.0));
  p.next = easeOut(prog(t, 25.4, 26.4));
  D.handNext = prog(t, 26.0, 26.8);
  D.routeNext = prog(t, 26.3, 27.1);

  // 29〜32：実際の経路を同じ濃さで静止（入りは28.3〜28.9秒）。次の制作への点線は色を付けない
  const whole = prog(t, 28.3, 28.9);
  for (const k of ACTUAL_EDGES) F[k] = Math.max(F[k] || 0, whole);

  // 強調：いま動いている部分を濃く。下限0.74で、ほかの部分も読める濃さに保つ
  const lo = 0.74;
  E.book = steps(t, 1, [[4.6, lo], [13.0, 1], [23.0, lo], [28.3, 1]]);
  E.tray = steps(t, 1, [[8.0, lo], [13.0, 1], [18.0, lo], [28.3, 1]]);
  E.ai = steps(t, 1, [[10.2, lo], [28.3, 1]]);
  E.packet = E.pocket = steps(t, 1, [[23.0, 0.85], [28.3, 1]]);
  E.route = steps(t, 1, [[18.0, 0.85], [23.0, 1]]);
  G.in = steps(t, 1, [[13.0, 0.8], [28.3, 1]]);
  G.open = steps(t, 1, [[18.0, 0.8], [28.3, 1]]);
  G.route = steps(t, 1, [[23.0, 0.85], [28.3, 1]]);
  return p;
}
const SHOW_KEYS = {book: 1, tray: 1, sheet: 1, ai: 1, packet: 1, pocket: 1, route: 1, json: 1, handoff: 1, next: 1};

// ---- 画面の枠：段階の印・見出し・足元 ---------------------------------------
function drawRail(comp, t) {
  const active = SCENES[titleIndex(t)].rail;
  const labels = ['読む', '組む', '渡す'];
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
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 0.5, comp.rail.y + 0.5, w - 1, h - 1);
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
    drawText(ctx, scene.title, comp.title.x, comp.title.y + dy, {size: comp.title.size, weight: 700, family: FONT.mincho, color: PAL.ink, max: comp.title.max, min: 24});
    drawText(ctx, scene.sub(job), comp.sub.x, comp.sub.y + dy, {size: comp.sub.size, color: PAL.muted, max: comp.sub.max, min: 13});
    ctx.restore();
  };
  if (i > 0 && k < 1) one(SCENES[i - 1], 1 - k, -8 * k);
  one(SCENES[i], k, 8 * (1 - k));
}

function drawFoot(comp) {
  drawText(ctx, 'studio-yebisu bc2984a・MIT　保存済みの記録から描画・無音・ここでAIは動いていません', comp.foot.x, comp.foot.y, {size: comp.foot.size, color: PAL.muted, max: comp.foot.max, min: 10});
}

// 画面確認後の読みやすさ調整：まだ存在しない図の空白を埋めず、今ある同じ図を中央へ寄せる。
// 0〜4秒は本を拡大し、依頼・AI・ブリーフが加わるたびに連続的に全体へ引く。絶対時刻から決定する。
function diagramCamera(L, t) {
  const fit = (keys) => {
    const rs = keys.map(k => L.n[k]), pad = 18;
    const x = Math.min(...rs.map(r => r.x)) - pad, y = Math.min(...rs.map(r => r.y)) - pad;
    const width = Math.max(...rs.map(r => r.x + r.w)) + pad - x;
    const height = Math.max(...rs.map(r => r.y + r.h)) + pad - y;
    const z = Math.min(L.W / width, L.H / height, 2.2);
    return {z, x: (L.W - width*z)/2 - x*z, y: (L.H - height*z)/2 - y*z};
  };
  const poses = [fit(['book']), fit(['book','tray','ai']), fit(['book','tray','ai','packet','pocket']), fit(['book','tray','ai','packet','pocket','route']), {z:1,x:0,y:0}];
  const transitions = [[3.3,4.0],[7.7,8.5],[13.7,14.5],[22.6,23.5]];
  let out = {...poses[0]};
  transitions.forEach(([a,b],i) => { const k=ease(prog(t,a,b)); for (const key of ['z','x','y']) out[key]+=(poses[i+1][key]-poses[i][key])*k; });
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
    ctx.beginPath(); ctx.rect(0,0,comp.world.w,comp.world.h); ctx.clip();
    const L=layoutFor(orient), camera=diagramCamera(L,t);
    ctx.translate(camera.x,camera.y); ctx.scale(camera.z,camera.z);
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
  controls().forEach((el) => { el.disabled = !on || (el.matches('button[data-orient]') && hasSize); });
}
function setStatus(text, state) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.state = state;
  statusEl.setAttribute('role', state === 'error' ? 'alert' : 'status');
}
const readyText = () => `${ASSET_COUNT}件の素材を、大きさとSHA-256で照合しました。いまの画面：${dimsText()}・${FPS}fps・${DURATION}秒・無音。`;

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
    await document.fonts.ready;
    const bundle = await loadValidatedAssets({
      signal: controller.signal,
      onProgress: (done, total) => { if (gen === loadGen && statusEl?.dataset.state === 'loading') setStatus(`素材 ${done}/${total} を照合しています…`, 'loading'); },
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
    setStatus(`${error instanceof AssetError ? error.message : '素材を読めませんでした'}。描画を止めました。ローカルのHTTPサーバー経由で開いてください。`, 'error');
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
  if (cap && data && cap.dataset.scene !== String(i)) { cap.dataset.scene = String(i); cap.textContent = `${RANGES[i]}秒　${SCENES[i].title}`; }
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
function setOrient(o) {
  if (hasSize || !SIZES[o] || !data) return;
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
function syncDims() {
  const dims = $('film-dims');
  if (dims) dims.textContent = dimsText();
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
  if (hasSize) {
    $('stage')?.setAttribute('data-orient', orient);
    document.querySelectorAll('button[data-orient]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === orient)));
  }
  syncDims();
}

prepare();
