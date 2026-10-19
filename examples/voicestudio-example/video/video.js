// 無音32秒の構造図フィルムの編集用ソース。読み込み・検証・場面・描画は ../concept.js と共通。
// 時刻の契約（motionConfig・motionReady・seek）は、この同期スクリプトが <head> で先に用意する。
// seek(秒) はその時刻の画を背景から描き直すだけで、呼ぶ順番・壁時計・前のコマに左右されない。
// 音声は扱わない（audioEvents は空、audio 要素もない）。
(function () {
  'use strict';

  var DURATION = 32;
  var POSTER = 31;
  var SIZES = {portrait: [720, 1280], wide: [1280, 720]};
  var RENDER = Boolean(window.__MOTION_RENDER__);
  var given = window.renderConfig || {};
  var positive = function (v) { return typeof v === 'number' && isFinite(v) && v > 0; };

  var orient = 'portrait';
  try {
    if (new URLSearchParams(location.search).get('orient') === 'wide') orient = 'wide';
  } catch (_) { /* 既定の縦 */ }
  var width = SIZES[orient][0];
  var height = SIZES[orient][1];
  if (positive(given.width) && positive(given.height)) {
    width = Math.round(given.width);
    height = Math.round(given.height);
    orient = width > height ? 'wide' : 'portrait';
  }
  var fps = positive(given.fps) ? Math.round(given.fps) : 30;

  window.motionConfig = {duration: DURATION, fps: fps, width: width, height: height, posterTime: POSTER, audioEvents: []};
  if (RENDER) document.documentElement.classList.add('is-render');

  var script = document.currentScript;
  var moduleUrl = new URL('../concept.js', script && script.src ? script.src : location.href).href;

  var lib = null;
  var data = null;
  var generation = 0;
  var current = POSTER;
  var playing = false;
  var playFrom = 0;
  var playStart = 0;
  var raf = 0;
  var els = null;

  var clampTime = function (seconds) {
    var t = Number(seconds);
    if (!isFinite(t)) t = 0;
    return Math.min(DURATION, Math.max(0, t));
  };

  function domReady() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise(function (resolve) { document.addEventListener('DOMContentLoaded', resolve, {once: true}); });
  }

  function grab() {
    if (els) return els;
    els = {
      canvas: document.getElementById('film'),
      stage: document.getElementById('stage'),
      status: document.getElementById('asset-status'),
      retry: document.getElementById('retry'),
      dims: document.getElementById('dims'),
      play: document.getElementById('play'),
      replay: document.getElementById('replay'),
      toStart: document.getElementById('to-start'),
      toEnd: document.getElementById('to-end'),
      time: document.getElementById('time'),
      clock: document.getElementById('clock'),
      jumps: document.getElementById('jumps'),
      assets: document.getElementById('asset-list'),
      orients: Array.prototype.slice.call(document.querySelectorAll('button[data-orient]'))
    };
    bind();
    return els;
  }

  function setStatus(state, message) {
    if (!els) return;
    els.status.dataset.state = state;
    els.status.textContent = message;
  }

  function timedControls() {
    var list = [els.play, els.replay, els.toStart, els.toEnd, els.time];
    return list.concat(Array.prototype.slice.call(els.jumps.querySelectorAll('button')));
  }

  function setTimed(enabled) {
    timedControls().forEach(function (control) { control.disabled = !enabled; });
  }

  function sizeCanvas() {
    var canvas = els.canvas;
    canvas.width = width;
    canvas.height = height;
    window.motionConfig.width = width;
    window.motionConfig.height = height;
    els.dims.textContent = width + '×' + height + '・' + fps + 'fps・' + DURATION + '秒・ポスター' + POSTER + '秒・無音（音声トラックなし）';
    els.orients.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.orient === orient)); });
    fit();
  }

  function fit() {
    var canvas = els.canvas;
    if (RENDER) {
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      return;
    }
    var roomW = els.stage.clientWidth || window.innerWidth;
    var roomH = Math.max(260, window.innerHeight - 32);
    var k = Math.min(1, roomW / width, roomH / height);
    canvas.style.width = Math.floor(width * k) + 'px';
    canvas.style.height = Math.floor(height * k) + 'px';
  }

  function clear() {
    var ctx = els.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  }

  function paint(t) {
    var ctx = els.canvas.getContext('2d');
    lib.drawConcept(ctx, {
      width: width, height: height, dpr: 1, data: data,
      scene: lib.sceneAt(t, 'default'), palette: lib.PALETTES.paper, film: true
    });
  }

  function show(t) {
    current = clampTime(t);
    if (els) {
      els.time.value = current.toFixed(1);
      els.clock.textContent = current.toFixed(1) + ' / ' + DURATION.toFixed(1) + ' 秒';
    }
    if (data && lib) paint(current);
  }

  // ---- 書き出しの契約 ----

  window.seek = function (seconds) {
    var waiting = window.motionReady;
    return Promise.resolve(waiting).then(function () {
      if (!data || !lib) throw new Error('保存データの確認が済んでいないため描けません');
      var t = clampTime(seconds);
      show(t);
      return t;
    });
  };

  function listAssets() {
    if (!els) return;
    var items = data ? data.assets : [];
    els.assets.replaceChildren.apply(els.assets, items.map(function (entry) {
      var li = document.createElement('li');
      li.textContent = entry.path + '（' + String(entry.bytes).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' B・' + entry.sha256.slice(0, 12) + '…）';
      return li;
    }));
  }

  function buildJumps() {
    if (!els || els.jumps.childElementCount) return;
    lib.SCENES.forEach(function (scene) {
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.jump = String(scene.start);
      button.disabled = true;
      var head = document.createElement('span');
      head.textContent = scene.index + ' ' + scene.title;
      var when = document.createElement('small');
      when.textContent = scene.start.toFixed(1) + '秒';
      button.append(head, when);
      button.addEventListener('click', function () {
        if (!data) return;
        show(scene.start);
        if (playing) { playFrom = current; playStart = performance.now(); }
      });
      els.jumps.append(button);
    });
  }

  function load() {
    generation += 1;
    var mine = generation;
    stopPlay();
    data = null;
    var attempt = domReady().then(function () {
      grab();
      sizeCanvas();
      clear();
      setTimed(false);
      listAssets();
      els.retry.hidden = true;
      setStatus('loading', '保存データ31件の大きさと SHA-256 を確かめています');
      return import(moduleUrl);
    }).then(function (mod) {
      lib = mod;
      buildJumps();
      setTimed(false);
      return document.fonts && document.fonts.ready ? document.fonts.ready : null;
    }).then(function () {
      return lib.loadData({
        onProgress: function (done, total) {
          if (mine === generation && !data) setStatus('loading', '保存データ' + total + '件の大きさと SHA-256 を確かめています（' + done + '/' + total + '）');
        }
      });
    }).then(function (loaded) {
      if (mine !== generation) throw new Error('新しい読み込みに置き換えました');
      data = loaded;
      listAssets();
      setTimed(true);
      setStatus('ready', loaded.assets.length + 'ファイルの大きさ・SHA-256・中身・原典の行を確かめました。描けます。');
      show(current);
      return true;
    });
    attempt.catch(function (error) {
      if (mine !== generation) return;
      data = null;
      stopPlay();
      if (!els) return;
      clear();
      setTimed(false);
      listAssets();
      setStatus('error', '描けません：' + (error && error.message ? error.message : String(error)));
      els.retry.hidden = false;
    });
    return attempt;
  }

  // ---- プレビューの再生（書き出しでは使わない） ----

  function stopPlay() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (els) {
      els.play.textContent = '再生';
      els.play.setAttribute('aria-pressed', 'false');
    }
  }

  function tick(now) {
    if (!playing) return;
    var t = playFrom + (now - playStart) / 1000;
    if (t >= DURATION) {
      show(DURATION);
      stopPlay();
      return;
    }
    show(t);
    raf = requestAnimationFrame(tick);
  }

  function startPlay(from) {
    if (RENDER || !data) return;
    if (from >= DURATION) from = 0;
    show(from);
    playFrom = current;
    playStart = performance.now();
    playing = true;
    els.play.textContent = '一時停止';
    els.play.setAttribute('aria-pressed', 'true');
    raf = requestAnimationFrame(tick);
  }

  function bind() {
    els.play.addEventListener('click', function () {
      if (playing) stopPlay();
      else startPlay(current);
    });
    els.replay.addEventListener('click', function () {
      stopPlay();
      startPlay(0);
    });
    els.toStart.addEventListener('click', function () {
      stopPlay();
      show(0);
    });
    els.toEnd.addEventListener('click', function () {
      stopPlay();
      show(DURATION);
    });
    els.time.addEventListener('input', function () {
      stopPlay();
      show(els.time.value);
    });
    els.retry.addEventListener('click', function () {
      window.motionReady = load();
    });
    // 向きだけを変える。時刻・再生の状態は保つ。
    els.orients.forEach(function (button) {
      button.addEventListener('click', function () {
        if (RENDER) return;
        orient = button.dataset.orient === 'wide' ? 'wide' : 'portrait';
        width = SIZES[orient][0];
        height = SIZES[orient][1];
        sizeCanvas();
        if (data) paint(current);
        try {
          var url = new URL(location.href);
          url.searchParams.set('orient', orient);
          history.replaceState(null, '', url.href);
        } catch (_) { /* URL を変えられなくても描画は続ける */ }
      });
    });
    window.addEventListener('resize', function () {
      fit();
    });
  }

  window.motionReady = load();
})();
