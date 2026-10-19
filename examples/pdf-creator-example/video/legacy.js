/*
 * PDF Creator 作例 — 28秒・無音の解説映像（Motion Reel の時間契約）
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * - 実PDFから書き出したページPNG（../assets/）を画面外で一度だけ読み込み、
 *   seek(t) のたびに Canvas2D を作り直して drawImage で切り抜き・拡大するだけで描く。画素は作らない。
 * - 場面の時刻・切り抜き範囲・抜粋は legacy-storyboard.json、ファイル名・寸法・ページ数は ../outputs/manifest.json から読む。
 * - 画面の状態は時刻 t だけで決まる。前のフレーム・壁時計・乱数・CSSアニメーションに依存しない。
 */
(() => {
  'use strict';

  const LOGICAL_WIDTH = 1280;
  const LOGICAL_HEIGHT = 720;
  const DURATION = 28;
  const POSTER_TIME = 13.5;
  const BACKGROUND = '#1d1916';
  const TERRA = '#d97756';

  const rendering = window.__MOTION_RENDER__ === true;
  const requested = window.renderConfig || {};
  const whole = (value, fallback) => (Number.isInteger(value) && value > 0 ? value : fallback);
  const WIDTH = whole(requested.width, LOGICAL_WIDTH);
  const HEIGHT = whole(requested.height, LOGICAL_HEIGHT);
  const FPS = whole(requested.fps, 30);
  const LAST_FRAME_TIME = (Math.ceil(DURATION * FPS) - 1) / FPS;

  window.motionConfig = {duration: DURATION, fps: FPS, width: WIDTH, height: HEIGHT, posterTime: POSTER_TIME, audioEvents: []};

  // 論理ステージ 1280×720 を、指定サイズへ等倍率で収める（縦横比が違えば余白を付ける）。
  const fit = Math.min(WIDTH / LOGICAL_WIDTH, HEIGHT / LOGICAL_HEIGHT);
  const offsetX = (WIDTH - LOGICAL_WIDTH * fit) / 2;
  const offsetY = (HEIGHT - LOGICAL_HEIGHT * fit) / 2;

  const root = document.documentElement;
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('plates');
  const layer = document.getElementById('layer');
  root.classList.toggle('is-render', rendering);
  stage.style.width = WIDTH + 'px';
  stage.style.height = HEIGHT + 'px';
  canvas.style.width = WIDTH + 'px';
  canvas.style.height = HEIGHT + 'px';
  layer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${fit})`;

  // ---- 時間の関数（すべて t からの直接計算） ----

  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const camera = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const lerp = (a, b, p) => a + (b - a) * p;
  const lerpRect = (a, b, p) => a.map((value, i) => lerp(value, b[i], p));

  function track(points, t) {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 0; i < points.length - 1; i++) {
      const [t0, v0] = points[i];
      const [t1, v1] = points[i + 1];
      if (t < t1) return lerp(v0, v1, smooth((t - t0) / (t1 - t0)));
    }
    return points[points.length - 1][1];
  }

  // キー間では「行き先の切り抜き範囲」が画面上で占める矩形を線形に動かし、倍率は等方に保つ。
  // 見える窓は、前のキーの表示範囲から次のキーの表示範囲へ動かす。
  function plateAt(plate, t) {
    const keys = plate.keys;
    let a = keys[0];
    let b = keys[0];
    let p = 0;
    if (t >= keys[keys.length - 1].t) {
      a = b = keys[keys.length - 1];
    } else if (t > keys[0].t) {
      for (let i = 0; i < keys.length - 1; i++) {
        if (t < keys[i + 1].t) {
          a = keys[i];
          b = keys[i + 1];
          p = camera((t - a.t) / (b.t - a.t));
          break;
        }
      }
    }
    const [vx, vy, vw, vh] = b.view;
    const ax = a.at[0] - a.view[0] * a.scale;
    const ay = a.at[1] - a.view[1] * a.scale;
    const target = [b.at[0], b.at[1], vw * b.scale, vh * b.scale];
    const focus = lerpRect([ax + vx * a.scale, ay + vy * a.scale, vw * a.scale, vh * a.scale], target, p);
    const scale = focus[2] / vw;
    const origin = [focus[0] - vx * scale, focus[1] - vy * scale];
    const view = lerpRect([a.at[0], a.at[1], a.view[2] * a.scale, a.view[3] * a.scale], target, p);
    return {origin, scale, view};
  }

  // ---- 読み込み済みの素材 ----

  let board = null;
  let manifest = null;
  const images = new Map();
  const plates = new Map();
  let sceneNodes = [];
  let timedNodes = [];
  let ready = false;

  function drawPlate(context, plate, t) {
    const alpha = track(plate.alpha, t);
    if (alpha <= 0) return;
    const image = images.get(plate.image);
    const {origin, scale, view} = plateAt(plate, t);
    const x0 = Math.max(view[0], origin[0]);
    const y0 = Math.max(view[1], origin[1]);
    const x1 = Math.min(view[0] + view[2], origin[0] + image.naturalWidth * scale);
    const y1 = Math.min(view[1] + view[3], origin[1] + image.naturalHeight * scale);
    if (x1 <= x0 || y1 <= y0) return;
    context.globalAlpha = alpha;
    context.fillStyle = 'rgba(0, 0, 0, 0.32)';
    context.fillRect(x0, y0 + 4, x1 - x0, y1 - y0);
    context.drawImage(image, (x0 - origin[0]) / scale, (y0 - origin[1]) / scale, (x1 - x0) / scale, (y1 - y0) / scale, x0, y0, x1 - x0, y1 - y0);
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(244, 237, 228, 0.24)';
    context.strokeRect(x0 - 0.5, y0 - 0.5, x1 - x0 + 1, y1 - y0 + 1);
  }

  function drawMark(context, mark, t) {
    const alpha = track(mark.alpha, t);
    if (alpha <= 0) return;
    const {origin, scale} = plateAt(plates.get(mark.plate), t);
    const [x, y, w, h] = mark.rect;
    context.globalAlpha = alpha;
    context.lineWidth = 2;
    context.strokeStyle = TERRA;
    context.strokeRect(origin[0] + x * scale, origin[1] + y * scale, w * scale, h * scale);
  }

  function paintCanvas(t) {
    // 幅と高さを毎回設定し直して、前のフレームの状態を残さない。
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.setTransform(fit, 0, 0, fit, offsetX, offsetY);
    for (const plate of board.plates) drawPlate(context, plate, t);
    for (const mark of board.marks) drawMark(context, mark, t);
  }

  function paintDom(t) {
    for (const {node, scene} of sceneNodes) {
      const enter = smooth((t - scene.enter[0]) / (scene.enter[1] - scene.enter[0]));
      const leave = scene.leave ? 1 - smooth((t - scene.leave[0]) / (scene.leave[1] - scene.leave[0])) : 1;
      const alpha = Math.min(enter, leave);
      node.style.opacity = alpha.toFixed(4);
      node.style.transform = `translateY(${((1 - enter) * 12).toFixed(2)}px)`;
      node.style.visibility = alpha > 0 ? 'visible' : 'hidden';
    }
    for (const {node, from, to} of timedNodes) {
      const v = smooth((t - from) / (to - from));
      node.style.opacity = v.toFixed(4);
      node.style.transform = `translateY(${((1 - v) * 10).toFixed(2)}px)`;
    }
  }

  function frame(seconds) {
    const t = Math.min(DURATION, Math.max(0, Number(seconds) || 0));
    paintCanvas(t);
    paintDom(t);
    return t;
  }

  // ---- 読み込みと照合（失敗したら準備を失敗にし、ごまかさない） ----

  // HTTP（localhost を含む安全な接続）では、読み込んだバイト列を manifest の sha256 と照合する。
  const hashing = Boolean(window.isSecureContext && window.crypto && window.crypto.subtle);

  async function fetchBytes(path) {
    const response = await fetch(path, {cache: 'no-store'});
    if (!response.ok) throw new Error(`${path} を読み込めません（HTTP ${response.status}）`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async function fetchText(path) {
    return new TextDecoder('utf-8').decode(await fetchBytes(path));
  }

  async function verifiedBytes(path, expected) {
    const bytes = await fetchBytes(path);
    if (hashing) {
      const digest = new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes));
      const hex = [...digest].map(b => b.toString(16).padStart(2, '0')).join('');
      check(hex === expected, `${path} の sha256 が manifest と一致しません`);
    }
    return bytes;
  }

  // 画面外の Image へ一度だけ読み込む。DOM には置かない。
  async function decode(path, expected) {
    const bytes = await verifiedBytes('../' + path, expected);
    const image = new Image();
    image.src = URL.createObjectURL(new Blob([bytes], {type: 'image/png'}));
    try {
      await image.decode();
    } catch {
      throw new Error(`画像を読み込めません：${path}`);
    }
    return image;
  }

  const variantOf = id => {
    const variant = manifest.variants.find(v => v.id === id);
    if (!variant) throw new Error(`manifest に版 ${id} がありません`);
    return variant;
  };

  function check(condition, message) {
    if (!condition) throw new Error(message);
  }

  function checkBoard() {
    const f = board.format;
    check(f.duration === DURATION && f.posterTime === POSTER_TIME && f.fps === 30 && f.width === LOGICAL_WIDTH && f.height === LOGICAL_HEIGHT, 'storyboard の尺・サイズが映像の設定と一致しません');
    check(manifest.generated === true, 'manifest が生成済みの記録ではありません');
    for (const fact of board.facts) {
      const v = variantOf(fact.variant);
      check(v.file === fact.file && v.page_count === fact.page_count && v.pages.length === fact.page_count && String(v.size_mm) === String(fact.size_mm), `${fact.file} の記録が manifest と一致しません`);
    }
    const ids = new Set();
    for (const plate of board.plates) {
      check(!ids.has(plate.id), `切り抜き ${plate.id} が重複しています`);
      ids.add(plate.id);
      for (let i = 1; i < plate.keys.length; i++) check(plate.keys[i].t > plate.keys[i - 1].t, `${plate.id} のキー時刻が増加していません`);
      for (let i = 1; i < plate.alpha.length; i++) check(plate.alpha[i][0] > plate.alpha[i - 1][0], `${plate.id} の不透明度の時刻が増加していません`);
    }
    for (const mark of board.marks) check(ids.has(mark.plate), `注釈 ${mark.id} の対象がありません`);
  }

  function pagesByImage() {
    const pages = new Map();
    for (const variant of manifest.variants) for (const page of variant.pages) pages.set(page.image, page);
    return pages;
  }

  function checkPlateGeometry(pages) {
    for (const plate of board.plates) {
      const page = pages.get(plate.image);
      const image = images.get(plate.image);
      check(image.naturalWidth === page.width && image.naturalHeight === page.height, `${plate.image} の大きさが manifest と一致しません`);
      for (const key of plate.keys) {
        const [x, y, w, h] = key.view;
        check(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= page.width && y + h <= page.height, `${plate.id} の切り抜き範囲がページ画像の外にあります`);
      }
    }
  }

  function renderExcerpt(target, excerpt, text) {
    const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
    target.replaceChildren();
    for (const item of excerpt.lines) {
      const actual = lines[item.line - 1];
      const matches = typeof actual === 'string' && (item.cut === 'start' ? actual.endsWith(item.text) : item.cut === 'end' ? actual.startsWith(item.text) : actual === item.text);
      check(matches, `${excerpt.file} の${item.line}行目が抜粋と一致しません`);
      const row = document.createElement('span');
      row.className = 'line';
      const number = document.createElement('span');
      number.className = 'no';
      number.textContent = String(item.line);
      const body = document.createElement('span');
      body.className = 'text';
      body.textContent = (item.cut === 'start' ? '…' : '') + item.text + (item.cut === 'end' ? '…' : '');
      row.append(number, body);
      target.append(row);
    }
  }

  function bindManifest() {
    const fields = {
      file: v => v.file,
      name: v => v.file.split('/').pop(),
      size: v => `${v.size_mm[0]}×${v.size_mm[1]}mm`,
      pages: v => `${v.page_count}ページ`,
      theme: v => v.theme,
      label: v => v.label
    };
    for (const node of document.querySelectorAll('[data-variant]')) {
      const read = fields[node.dataset.field];
      check(read, `未知の項目：${node.dataset.field}`);
      node.textContent = read(variantOf(node.dataset.variant));
    }
    for (const node of document.querySelectorAll('[data-manifest]')) {
      const value = manifest[node.dataset.manifest];
      check(typeof value === 'string', `manifest に ${node.dataset.manifest} がありません`);
      node.textContent = value;
    }
  }

  function bindScenes() {
    sceneNodes = board.scenes.map(scene => {
      const node = document.querySelector(`[data-scene="${scene.id}"]`);
      check(node, `場面 ${scene.id} の要素がありません`);
      node.querySelector('.title').textContent = scene.title;
      node.querySelector('.caption').textContent = scene.caption;
      node.querySelector('.source').textContent = scene.source;
      return {node, scene};
    });
    timedNodes = [...document.querySelectorAll('[data-in]')].map(node => {
      const [from, to] = node.dataset.in.split(',').map(Number);
      check(Number.isFinite(from) && to > from, 'data-in の時刻が不正です');
      return {node, from, to};
    });
  }

  async function load() {
    const [boardText, manifestText] = await Promise.all([fetchText('legacy-storyboard.json'), fetchText('../outputs/manifest.json')]);
    board = JSON.parse(boardText);
    manifest = JSON.parse(manifestText);
    checkBoard();
    const pages = pagesByImage();
    const needed = [...new Set(board.plates.map(plate => plate.image))];
    for (const path of needed) check(pages.has(path), `${path} は manifest のページ画像ではありません`);
    const [sourceBytes, requestText, ...decoded] = await Promise.all([
      verifiedBytes('../' + manifest.source, manifest.source_sha256),
      fetchText('../' + board.excerpts.request.file),
      ...needed.map(path => decode(path, pages.get(path).sha256))
    ]);
    const sourceText = new TextDecoder('utf-8').decode(sourceBytes);
    needed.forEach((path, i) => images.set(path, decoded[i]));
    for (const plate of board.plates) plates.set(plate.id, plate);
    checkPlateGeometry(pages);
    check(board.excerpts.markdown.file === manifest.source, '原稿の抜粋が manifest の原稿と違います');
    renderExcerpt(document.querySelector('[data-excerpt="markdown"]'), board.excerpts.markdown, sourceText);
    renderExcerpt(document.querySelector('[data-excerpt="request"]'), board.excerpts.request, requestText);
    bindManifest();
    bindScenes();
    await document.fonts.ready;
    ready = true;
  }

  window.motionReady = load();

  window.seek = async seconds => {
    if (!ready) await window.motionReady;
    frame(seconds);
  };

  // ---- プレビュー（書き出し時は使わない） ----

  const play = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const timeLabel = document.getElementById('time');
  const status = document.getElementById('status');

  window.motionReady.then(() => {
    if (rendering) return;
    status.textContent = hashing
      ? '準備完了：PNG 3枚と原稿の sha256、ページ数・寸法、抜粋の行を manifest・元ファイルと照合しました'
      : '準備完了：ページ数・寸法と抜粋の行を照合しました（この接続では sha256 照合を省略）';
    play.disabled = false;
    scrub.disabled = false;
    show(POSTER_TIME);
  }, error => {
    status.textContent = '読み込みに失敗しました：' + error.message;
    status.classList.add('is-error');
    console.error(error);
  });

  if (rendering) return;

  let playing = false;
  let request = 0;
  let wallStart = 0;
  let timeStart = 0;
  let current = 0;

  function show(seconds) {
    current = frame(seconds);
    scrub.value = current.toFixed(2);
    timeLabel.textContent = `${current.toFixed(2)} / ${DURATION.toFixed(2)} 秒`;
  }

  function tick(now) {
    const t = timeStart + (now - wallStart) / 1000;
    if (t >= LAST_FRAME_TIME) {
      show(LAST_FRAME_TIME);
      stop();
      return;
    }
    show(t);
    request = requestAnimationFrame(tick);
  }

  function start() {
    if (current >= LAST_FRAME_TIME - 1e-6) current = 0;
    timeStart = current;
    wallStart = performance.now();
    playing = true;
    play.textContent = '一時停止';
    play.setAttribute('aria-pressed', 'true');
    request = requestAnimationFrame(tick);
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(request);
    play.textContent = '再生';
    play.setAttribute('aria-pressed', 'false');
  }

  play.addEventListener('click', () => (playing ? stop() : start()));
  scrub.addEventListener('input', () => {
    if (playing) stop();
    show(Number(scrub.value));
  });

  // 画面幅に合わせてプレビューだけ縮小する。書き出しの原寸フレームには影響しない。
  const frameBox = document.getElementById('frame');
  function fitPreview() {
    const parent = frameBox.parentElement;
    const style = getComputedStyle(parent);
    const available = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const s = Math.min(1, available / WIDTH);
    frameBox.style.width = WIDTH * s + 'px';
    frameBox.style.height = HEIGHT * s + 'px';
    stage.style.transform = s === 1 ? 'none' : `scale(${s})`;
  }
  fitPreview();
  window.addEventListener('resize', fitPreview);
})();
