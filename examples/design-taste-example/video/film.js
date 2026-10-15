/* 余白図書室（架空）— Design Taste の作例を、保存した実画面で解説する26秒・無音の編集動画。
   見た目はすべて seek(t) の t から直接決める。前の呼び出し・壁時計・乱数には頼らない。
   Studio Yebisu, MIT. */
(() => {
  'use strict';

  const BASE_W = 1280;
  const BASE_H = 720;
  const DURATION = 26;

  const render = window.__MOTION_RENDER__ === true || new URLSearchParams(location.search).has('render');
  const overrides = window.renderConfig || {};
  const pick = (value, fallback) => (Number.isInteger(value) && value > 0 ? value : fallback);
  const W = pick(overrides.width, BASE_W);
  const H = pick(overrides.height, BASE_H);
  const FPS = pick(overrides.fps, 30);
  const LAST = (Math.round(DURATION * FPS) - 1) / FPS; // 30fpsで25.9667秒（780枚目）

  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: 13, audioEvents: [] };

  if (render) document.documentElement.classList.add('is-render');

  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const viewport = $('viewport');

  // 保存した実画面の大きさ（../captures.json と同じ）。違えば読み込みを失敗にする
  const CAPTURES = {
    all: [1280, 900],
    children: [1280, 900],
    participation: [1280, 900],
    mobile: [320, 1100]
  };

  const SCENES = [
    { id: 'input', start: 0, end: 4, label: '1／5　入力' },
    { id: 'direction', start: 4, end: 9, label: '2／5　デザインの方向' },
    { id: 'filter', start: 9, end: 15, label: '3／5　対象で絞る' },
    { id: 'details', start: 15, end: 21, label: '4／5　参加方法を開く' },
    { id: 'request', start: 21, end: 26, label: '5／5　依頼文で試す' }
  ];

  // カメラは [元画像の中心x, 中心y, 倍率]。移動は [開始秒, 終了秒, 行き先]
  const MAIN_BOX = { w: 736, h: 520 };
  const MAIN_START = [640, 450, 0.575];        // all.png 全体（配置を見せるだけ）
  const MAIN_MOVES = [
    [5.2, 6.0, [340, 215, 1.2]],               // 印・縦書き・明朝の見出し
    [6.9, 7.8, [726, 470, 1.3]],               // 日付と時刻の列、罫線の行
    [9.7, 10.5, [726, 585, 1.3]],              // 子ども向けの2件
    [15.6, 16.5, [903, 515, 1.28]]             // e01 の参加方法
  ];
  const SPOT = [612, 518, 1200, 606];          // participation.png の e01 参加方法（要約と本文）

  const FILTER_BOX = { w: 380, h: 324 };
  const FILTER_CAM = [180, 581, 1.3];          // 対象「子ども」と「6件中2件」

  const MOBILE_BOX = { w: 380, h: 372 };
  const MOBILE_START = [160, 900, 1.2];
  const MOBILE_MOVES = [[17.9, 18.9, [160, 945, 1.2]]];

  const POINTS = [[4.0, 5.6], [5.6, 7.3], [7.3, 99]];
  const SOFT = [98, 92, 83];
  const INK = [51, 48, 43];

  const clamp01 = x => Math.max(0, Math.min(1, x));
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const num = (x, digits = 4) => Number(x.toFixed(digits));

  function path(t, start, moves) {
    let [x, y, s] = start;
    for (const [a, b, to] of moves) {
      if (t <= a) break;
      const k = easeInOut(ramp(t, a, b));
      x = lerp(x, to[0], k);
      y = lerp(y, to[1], k);
      s = s * Math.pow(to[2] / s, k);          // 倍率は対数で補間する
      if (t < b) break;
    }
    return [x, y, s];
  }

  function place(img, cam, box) {
    const [cx, cy, s] = cam;
    const tx = box.w / 2 - cx * s;
    const ty = box.h / 2 - cy * s;
    img.style.transform = `translate(${num(tx, 3)}px, ${num(ty, 3)}px) scale(${num(s, 5)})`;
  }

  function show(el, opacity) {
    el.style.opacity = String(num(opacity));
    el.style.visibility = opacity > 0 ? 'visible' : 'hidden';
  }

  function mix(a, b, k) {
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(', ')})`;
  }

  function sceneIndex(t) {
    const i = SCENES.findIndex(scene => t < scene.end);
    return i === -1 ? SCENES.length - 1 : i;
  }

  const sceneEls = [...stage.querySelectorAll('.scene')];
  const sceneLabel = $('scene-label');
  const inputRows = [...stage.querySelectorAll('.input-rows li')];
  const inputNote = $('input-note');
  const points = [...stage.querySelectorAll('.points li')];
  const emTwo = $('em-two');

  const shotMain = $('shot-main');
  const imgAll = $('main-all');
  const imgChildren = $('main-children');
  const imgParticipation = $('main-participation');
  const dims = { top: $('dim-top'), bottom: $('dim-bottom'), left: $('dim-left'), right: $('dim-right') };
  const tagMain = $('tag-main');

  const shotFilter = $('shot-filter');
  const imgFilter = $('filter-children');
  const tagFilter = $('tag-filter');

  const shotMobile = $('shot-mobile');
  const imgMobile = $('mobile');
  const tagMobile = $('tag-mobile');

  const requestParts = [[$('request-quote'), 21.4, 22.0], [$('request-where'), 22.4, 22.9], [$('request-cta'), 23.4, 23.9]];

  function setRect(el, x, y, w, h) {
    el.style.left = `${num(x, 2)}px`;
    el.style.top = `${num(y, 2)}px`;
    el.style.width = `${num(Math.max(0, w), 2)}px`;
    el.style.height = `${num(Math.max(0, h), 2)}px`;
  }

  function seek(seconds) {
    const t = Math.max(0, Math.min(DURATION, Number(seconds) || 0));
    const current = sceneIndex(t);

    // 場面の文字：入りは0.5秒で10px上がる、出は0.35秒
    SCENES.forEach((scene, i) => {
      const fadeIn = i === 0 ? 1 : easeOut(ramp(t, scene.start, scene.start + 0.5));
      const fadeOut = i === SCENES.length - 1 ? 1 : 1 - ramp(t, scene.end - 0.35, scene.end);
      show(sceneEls[i], Math.min(fadeIn, fadeOut));
      sceneEls[i].style.transform = `translateY(${num((1 - fadeIn) * 10, 3)}px)`;
    });
    sceneLabel.textContent = SCENES[current].label;

    // 1　入力の6行を順に出す
    inputRows.forEach((row, i) => {
      row.style.opacity = String(num(ramp(t, 0.35 + i * 0.18, 0.7 + i * 0.18)));
    });
    inputNote.style.opacity = String(num(ramp(t, 1.7, 2.1)));

    // 2　いま窓に映っている点だけを墨にし、赤の印をつける
    points.forEach((li, i) => {
      const [a, b] = POINTS[i];
      const w = clamp01(ramp(t, a, a + 0.3) - ramp(t, b, b + 0.3));
      li.style.color = mix(SOFT, INK, w);
      li.querySelector('.mark').style.opacity = String(num(w));
    });

    // 3　「2件」に下線
    emTwo.style.textDecorationColor = `rgba(179, 57, 42, ${num(ramp(t, 10.3, 10.7))})`;

    // 主な窓：all → children → participation。重ねる側だけを溶かす
    const mainOpacity = ramp(t, 4.0, 4.5) * (1 - ramp(t, 20.65, 21.0));
    show(shotMain, mainOpacity);
    show(tagMain, mainOpacity);
    const cam = path(t, MAIN_START, MAIN_MOVES);
    [imgAll, imgChildren, imgParticipation].forEach(img => place(img, cam, MAIN_BOX));
    show(imgAll, t < 9.6 ? 1 : 0);
    show(imgChildren, t < 15.5 ? ramp(t, 9.0, 9.6) : 0);
    show(imgParticipation, ramp(t, 15.0, 15.5));
    tagMain.textContent = t < 9.3
      ? 'all.png（対象「すべて」6件。画面内は先頭2件まで）'
      : t < 15.25
        ? 'children.png（対象「子ども」6件中2件）'
        : 'participation.png（e01 の参加方法を開いた状態）';

    // e01 の参加方法のまわりを紙の色で薄くする
    const spot = ramp(t, 16.6, 17.1);
    const [cx, cy, s] = cam;
    const x0 = Math.max(0, Math.min(MAIN_BOX.w, MAIN_BOX.w / 2 + (SPOT[0] - cx) * s));
    const x1 = Math.max(0, Math.min(MAIN_BOX.w, MAIN_BOX.w / 2 + (SPOT[2] - cx) * s));
    const y0 = Math.max(0, Math.min(MAIN_BOX.h, MAIN_BOX.h / 2 + (SPOT[1] - cy) * s));
    const y1 = Math.max(0, Math.min(MAIN_BOX.h, MAIN_BOX.h / 2 + (SPOT[3] - cy) * s));
    setRect(dims.top, 0, 0, MAIN_BOX.w, y0);
    setRect(dims.bottom, 0, y1, MAIN_BOX.w, MAIN_BOX.h - y1);
    setRect(dims.left, 0, y0, x0, y1 - y0);
    setRect(dims.right, x1, y0, MAIN_BOX.w - x1, y1 - y0);
    Object.values(dims).forEach(el => show(el, spot));

    // 左の窓：対象欄と件数（3）
    const filterOpacity = ramp(t, 9.4, 9.9) * (1 - ramp(t, 14.65, 15.0));
    show(shotFilter, filterOpacity);
    show(tagFilter, filterOpacity);
    place(imgFilter, FILTER_CAM, FILTER_BOX);

    // 左の窓：320px幅（4）
    const mobileOpacity = ramp(t, 17.8, 18.4) * (1 - ramp(t, 20.65, 21.0));
    show(shotMobile, mobileOpacity);
    show(tagMobile, mobileOpacity);
    place(imgMobile, path(t, MOBILE_START, MOBILE_MOVES), MOBILE_BOX);

    // 5　依頼文の抜粋 → コピーする場所 → 最後の案内
    requestParts.forEach(([el, a, b]) => {
      el.style.opacity = String(num(easeOut(ramp(t, a, b))));
    });

    return { time: t, scene: SCENES[current].id };
  }

  // 720pの画面を、表示領域（書き出しでは renderConfig の大きさ）に収める
  function layout() {
    let w = W;
    let h = H;
    let pad = 0;
    if (!render) {
      const rect = viewport.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      pad = 16;
    }
    const scale = Math.max(0.05, Math.min((w - pad * 2) / BASE_W, (h - pad * 2) / BASE_H));
    const x = (w - BASE_W * scale) / 2;
    const y = (h - BASE_H * scale) / 2;
    stage.style.transform = `translate(${num(x, 3)}px, ${num(y, 3)}px) scale(${num(scale, 6)})`;
  }

  window.seek = seek;
  layout();
  seek(0);

  // 保存画面をすべて復号し、書体の準備を待つ。欠けた素材があれば失敗にする
  const images = [...stage.querySelectorAll('img[data-capture]')];
  window.motionReady = Promise.all(images.map(async img => {
    const src = img.getAttribute('src');
    try {
      await img.decode();
    } catch (error) {
      throw new Error(`保存画面を読み込めません: ${src}`);
    }
    const [w, h] = CAPTURES[img.dataset.capture];
    if (img.naturalWidth !== w || img.naturalHeight !== h) {
      throw new Error(`保存画面の大きさが違います: ${src}（${img.naturalWidth}×${img.naturalHeight}）`);
    }
  })).then(() => document.fonts.ready).then(() => true);

  if (render) {
    // 書き出し：操作を取り除き、タイマーや requestAnimationFrame を動かさない
    const controls = $('controls');
    if (controls) controls.remove();
    return;
  }

  const play = $('play');
  const scrub = $('scrub');
  const clock = $('clock');
  const status = $('film-status');
  const jumps = [...document.querySelectorAll('[data-jump]')];
  let playing = false;
  let current = 0;
  let origin = 0;
  let frame = 0;

  function draw(t) {
    current = Math.max(0, Math.min(LAST, t));
    seek(current);
    const index = sceneIndex(current);
    scrub.value = String(current);
    scrub.setAttribute('aria-valuetext', `${current.toFixed(1)}秒、${SCENES[index].label.replace('　', ' ')}`);
    clock.value = `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
    jumps.forEach((button, i) => button.setAttribute('aria-current', i === index ? 'step' : 'false'));
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(frame);
    play.textContent = '再生';
  }

  function tick(now) {
    if (!playing) return;
    const t = (now - origin) / 1000;
    if (t >= LAST) {
      draw(LAST);
      stop();
      return;
    }
    draw(t);
    frame = requestAnimationFrame(tick);
  }

  play.addEventListener('click', () => {
    if (playing) {
      stop();
      return;
    }
    if (current >= LAST) draw(0);
    playing = true;
    origin = performance.now() - current * 1000;
    play.textContent = '一時停止';
    frame = requestAnimationFrame(tick);
  });

  scrub.addEventListener('input', () => {
    stop();
    draw(Number(scrub.value));
  });

  // 場面の頭は文字が入り始める途中なので、読める位置（0.6秒後）へ移る
  jumps.forEach((button, i) => {
    button.addEventListener('click', () => {
      stop();
      draw(SCENES[i].start + (i === 0 ? 0 : 0.6));
    });
  });

  window.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });

  window.motionReady.catch(error => {
    stop();
    status.textContent = `${error.message}。作例のフォルダをWebサーバーで配信し、video/index.html を開いてください。`;
  });

  draw(0);
})();
