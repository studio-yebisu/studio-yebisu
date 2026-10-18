/* Studio Yebisu — 納品メモの解説映像. Original composition, 2026. MIT License.
   Motion Reel time contract: seek(t) paints any frame from t alone.
   Only saved browser PNGs listed in ../captures.json and the real ../outputs/two.json are shown. */
(() => {
  'use strict';
  const NATIVE_W = 1280, NATIVE_H = 720, DURATION = 28, POSTER = 13.5;
  const config = window.renderConfig || {};
  const RENDER = Boolean(window.__MOTION_RENDER__) || new URLSearchParams(location.search).has('render');
  const whole = (value, fallback, min, max) => Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  const width = whole(config.width, NATIVE_W, 16, 4096);
  const height = whole(config.height, NATIVE_H, 16, 4096);
  const fps = whole(config.fps, 30, 1, 120);
  window.motionConfig = {duration: DURATION, fps, width, height, posterTime: POSTER, audioEvents: []};

  const $ = id => document.getElementById(id);
  const root = document.documentElement, stage = $('stage'), box = $('stage-box'), frame = $('frame');

  // The film is always laid out at 1280×720 and scaled as one piece.
  if (RENDER) {
    root.classList.add('is-render');
    for (const el of document.querySelectorAll('[data-preview-only]')) el.remove();
    root.style.setProperty('--film-w', width + 'px');
    root.style.setProperty('--film-h', height + 'px');
    const fit = Math.min(width / NATIVE_W, height / NATIVE_H);
    stage.style.transform = 'translate(' + (width - NATIVE_W * fit) / 2 + 'px,' + (height - NATIVE_H * fit) / 2 + 'px) scale(' + fit + ')';
  }

  // Panel space: CSS px relative to the form panel's top-left corner.
  // before.png is a 1:1 full-page capture (panel at 284.5, 434.97).
  // after-*.png are 1280×720 viewport captures stored at 1265×712, so PNG px = CSS px × 1265/1280
  // (read from the PNGs: the 79px totals read 78 PNG px; the button bottom 445.5 reads 440).
  const SPACE = {
    before: {k: 1, x: 284.5, y: 434.96875},
    after: {k: 1265 / 1280, x: 284.5, y: -0.03125}
  };

  // Camera shots: frame rectangle on the film and the panel-space view centre and zoom.
  const SHOTS = [
    {at: 0, frame: {x: 492, y: 92, w: 732, h: 524}, view: {cx: 348, cy: 232, z: 0.96}},
    {at: 4.8, frame: {x: 492, y: 92, w: 732, h: 340}, view: {cx: 348, cy: 304, z: 732 / 680}},
    {at: 10.4, frame: {x: 56, y: 264, w: 1168, h: 352}, view: {cx: 348, cy: 20 + 176 / (1168 / 704), z: 1168 / 704}},
    {at: 16.2, frame: {x: 56, y: 92, w: 1168, h: 244}, view: {cx: 348, cy: 448, z: 244 / 144}},
    {at: 22.2, frame: {x: 668, y: 92, w: 556, h: 456}, view: {cx: 348, cy: 228 / (556 / 716), z: 556 / 716}}
  ];
  const MOVE = 0.7;

  const clamp01 = x => Math.min(1, Math.max(0, x));
  const ease = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const lerp = (a, b, p) => a + (b - a) * p;
  const rise = (t, start, length) => start === null ? 1 : ease((t - start) / length);
  const shown = (t, start, end) => Math.min(rise(t, start, 0.45), end === null ? 1 : 1 - ease((t - end + 0.35) / 0.35));

  // Image layers, later ones on top. A lower layer stays opaque until the upper one has fully arrived.
  const LAYERS = [
    {capture: 'before', space: 'before', expect: {ids: ['c01', 'c02', 'c03'], total: '3件 / 06:10'},
      opacity: t => t < 5.25 ? 1 : 0},
    {capture: 'after-focus', space: 'after', expect: {ids: ['c02', 'c03'], active: 'clip-c02', time: '04:35', outline: 'rgb(55, 88, 70) solid 2px'},
      opacity: t => t < 10.85 ? rise(t, 4.8, 0.45) : 0},
    {capture: 'after-all', space: 'after', expect: {ids: ['c01', 'c02', 'c03'], count: 3, time: '06:10', notes: true, state: 'ready'},
      opacity: t => t < 12.85 ? rise(t, 10.4, 0.45) : 0},
    {capture: 'after-two', space: 'after', expect: {ids: ['c02', 'c03'], count: 2, time: '04:35', notes: true, state: 'ready'},
      opacity: t => t < 16.65 ? rise(t, 12.4, 0.45) : 0},
    {capture: 'after-handoff', space: 'after', expect: {ids: ['c02', 'c03'], count: 2, time: '04:35', notes: true, state: 'done'},
      opacity: t => rise(t, 16.2, 0.45)}
  ];
  for (const layer of LAYERS) {
    layer.el = document.createElement('img');
    layer.el.alt = '';
    layer.el.decoding = 'sync';
    // Decode the original PNG off-DOM; the bitmap plane is repainted explicitly below.
  }

  // Explicit CPU rasterization avoids Chromium transform-image resampling caches
  // retaining a different rounding result after jumping through other times.
  const picture = document.createElement('canvas');
  picture.setAttribute('aria-hidden', 'true');
  $('frame-images').append(picture);
  const pictureContext = picture.getContext('2d', {alpha: true, willReadFrequently: true, colorSpace: 'srgb'});

  // Highlights in panel space. Row and option rectangles are replaced by measured values on load.
  const MARKS = [
    {el: $('mark-row'), rect: [29, 161.31, 638, 82.09], from: 5.7, to: 10.4},
    {el: $('mark-option'), rect: [29, 337.5, 638, 48], from: 5.7, to: 10.4},
    {el: $('mark-total'), rect: [580, 36, 95, 37], from: 11.2, to: 16.2},
    {el: $('mark-check'), rect: [21, 102, 36, 36], from: 11.2, to: 16.2}
  ];

  const TEXT = [
    {el: $('s1'), from: null, to: 4.8},
    {el: $('s2'), from: 5.1, to: 10.4},
    {el: $('s2-measure'), from: 5.6, to: 10.4},
    {el: $('s3'), from: 10.95, to: 16.2},
    {el: $('s4'), from: 16.9, to: 22.2},
    {el: $('s4-card'), from: 17.3, to: 22.2},
    {el: $('s5a'), from: 22.85, to: null},
    {el: $('s5b'), from: 23.9, to: null}
  ];

  function camera(t) {
    let i = 0;
    while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].at) i++;
    const shot = SHOTS[i];
    if (i === 0 || t >= shot.at + MOVE) return shot;
    const a = SHOTS[i - 1], p = ease((t - shot.at) / MOVE);
    return {
      frame: {x: lerp(a.frame.x, shot.frame.x, p), y: lerp(a.frame.y, shot.frame.y, p), w: lerp(a.frame.w, shot.frame.w, p), h: lerp(a.frame.h, shot.frame.h, p)},
      view: {cx: lerp(a.view.cx, shot.view.cx, p), cy: lerp(a.view.cy, shot.view.cy, p), z: Math.exp(lerp(Math.log(a.view.z), Math.log(shot.view.z), p))}
    };
  }

  function setShown(el, opacity) {
    el.style.opacity = String(opacity);
    el.style.visibility = opacity > 0 ? 'visible' : 'hidden';
  }

  function seek(seconds) {
    const t = Math.min(DURATION, Math.max(0, Number(seconds) || 0));
    const {frame: f, view: v} = camera(t);
    frame.style.left = f.x + 'px';
    frame.style.top = f.y + 'px';
    frame.style.width = f.w + 'px';
    frame.style.height = f.h + 'px';
    const fx = x => f.w / 2 + v.z * (x - v.cx), fy = y => f.h / 2 + v.z * (y - v.cy);
    // Reset the whole pixel buffer on every seek; no prior frame contributes.
    picture.width = Math.ceil(f.w);
    picture.height = Math.ceil(f.h);
    picture.style.width = f.w + 'px';
    picture.style.height = f.h + 'px';
    pictureContext.setTransform(picture.width / f.w, 0, 0, picture.height / f.h, 0, 0);
    pictureContext.imageSmoothingEnabled = true;
    pictureContext.imageSmoothingQuality = 'high';
    for (const layer of LAYERS) {
      const opacity = layer.el.naturalWidth ? layer.opacity(t) : 0;
      if (opacity <= 0) continue;
      const s = SPACE[layer.space];
      pictureContext.globalAlpha = opacity;
      pictureContext.drawImage(layer.el, fx(-s.x), fy(-s.y), layer.el.naturalWidth * v.z / s.k, layer.el.naturalHeight * v.z / s.k);
    }
    pictureContext.globalAlpha = 1;
    for (const mark of MARKS) {
      const [x, y, w, h] = mark.rect;
      mark.el.style.left = fx(x) + 'px';
      mark.el.style.top = fy(y) + 'px';
      mark.el.style.width = w * v.z + 'px';
      mark.el.style.height = h * v.z + 'px';
      setShown(mark.el, shown(t, mark.from, mark.to));
    }
    for (const group of TEXT) {
      const lift = (1 - rise(t, group.from, 0.45)) * 8;
      group.el.style.transform = lift > 0 ? 'translateY(' + lift + 'px)' : 'none';
      setShown(group.el, shown(t, group.from, group.to));
    }
    return {time: t, frame: Math.round(t * fps)};
  }
  window.seek = seek;

  // ---- Assets: every file is fetched, checked against the public records, then decoded. ----
  const resolve = path => new URL(path, document.baseURI).href;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function expect(ok, message) { if (!ok) throw new Error(message); }
  async function fetchOk(path) {
    const response = await fetch(resolve(path), {cache: 'no-store'});
    if (!response.ok) throw new Error(path + ' を読み込めません（HTTP ' + response.status + '）');
    return response;
  }
  const fetchJSON = async path => (await fetchOk(path)).json();
  async function sha256(buffer) {
    if (!globalThis.crypto || !crypto.subtle) {
      if (RENDER) throw new Error('SHA-256 を計算できない環境のため、素材を照合できません');
      return null; // Insecure preview origin: dimensions are still checked.
    }
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  async function loadLayer(layer, captures) {
    const entry = captures.captures.find(c => c.id === layer.capture);
    expect(entry, 'captures.json に ' + layer.capture + ' がありません');
    expect(entry.file === 'assets/' + layer.capture + '.png', layer.capture + ' のファイル名が一致しません');
    expect(entry.source === 'Actual browser screenshot, not recreated UI', layer.capture + ' が実画面の記録ではありません');
    for (const [key, value] of Object.entries(layer.expect)) expect(same(entry.observed[key], value), layer.capture + ' の ' + key + ' が映像の説明と一致しません');
    expect(entry.observed.viewport.width === 1280 && entry.width === 1265, layer.capture + ' の寸法の前提が一致しません');
    const buffer = await (await fetchOk('../' + entry.file)).arrayBuffer();
    const hash = await sha256(buffer);
    expect(hash === null || hash === entry.sha256, entry.file + ' のSHA-256が captures.json と一致しません');
    layer.el.src = URL.createObjectURL(new Blob([buffer], {type: 'image/png'}));
    await layer.el.decode();
    expect(layer.el.naturalWidth === entry.width && layer.el.naturalHeight === entry.height, entry.file + ' の画素数が captures.json と一致しません');
    layer.el.alt = entry.label;
  }

  async function prepare() {
    const [captures, validation, verification, clips] = await Promise.all([
      fetchJSON('../captures.json'), fetchJSON('../validation.json'), fetchJSON('../verification.json'), fetchJSON('../clips.json')
    ]);
    expect(captures.synthetic_input === true, 'captures.json の入力が作例用の架空データではありません');

    // Panel origins used for alignment must match the recorded geometry.
    const before = captures.captures.find(c => c.id === 'before'), focus = captures.captures.find(c => c.id === 'after-focus');
    expect(before && before.observed.crop.x === SPACE.before.x && before.observed.crop.y === SPACE.before.y, 'before.png のパネル位置が一致しません');
    expect(focus && focus.observed.crop.x === SPACE.after.x && focus.observed.crop.y === SPACE.after.y, 'after-focus.png のパネル位置が一致しません');

    // Scene 3 numbers come from the executed export.mjs check and the saved screens.
    const result = id => validation.results.find(r => r.id === id && r.status === 'passed');
    const all = result('all'), two = result('two');
    expect(all && same(all.input.ids, ['c01', 'c02', 'c03']) && two && same(two.input.ids, ['c02', 'c03']), 'validation.json の見本が一致しません');
    const c01 = clips.clips.find(c => c.id === 'c01');
    const widths = new Set(verification.browser.presets.map(p => p.totals_width));
    expect(widths.size === 1, '件数欄の幅が見本ごとに異なります');
    const copy3 = $('s3-copy').textContent;
    for (const piece of [all.observed.count + '件・' + all.observed.time, two.observed.count + '件・' + two.observed.time, '「' + c01.title + '」', [...widths][0] + 'px']) {
      expect(copy3.includes(piece), 'シーン3の文言が記録と一致しません：' + piece);
    }

    // Scene 2 measurements and highlight rectangles come from the 1280px browser check.
    const w1280 = verification.browser.widths.find(w => w.width === 1280);
    const panel = verification.browser.initial.panel;
    expect(w1280 && w1280.labels.length === 4 && panel, 'verification.json に1280px幅の実測がありません');
    const rows = w1280.labels.map(l => Math.round(l.height)), button = Math.round(w1280.button.height);
    const measure = $('s2-measure-value').textContent;
    for (const piece of ['行 ' + rows[1] + 'px', 'メモ ' + rows[3] + 'px', 'ボタン ' + button + 'px']) expect(measure.includes(piece), 'シーン2の実測値が記録と一致しません：' + piece);
    const left = w1280.button.left - panel.left;
    MARKS[0].rect = [left, w1280.labels[1].top - panel.top, w1280.labels[1].width, w1280.labels[1].height];
    MARKS[1].rect = [left, w1280.labels[3].top - panel.top, w1280.labels[3].width, w1280.labels[3].height];

    // Scene 4: the real two.json, checked against the recorded byte-identical download.
    const check = verification.browser.download_checks.find(d => d.id === 'two' && d.phase === 'after-production');
    expect(check && check.matches === true && check.reference === 'outputs/two.json', 'two.json の確認記録がありません');
    const buffer = await (await fetchOk('../outputs/two.json')).arrayBuffer();
    expect(buffer.byteLength === check.bytes, 'two.json のバイト数が確認記録と一致しません');
    const hash = await sha256(buffer);
    expect(hash === null || hash === check.sha256, 'two.json のSHA-256が確認記録と一致しません');
    const text = new TextDecoder('utf-8', {fatal: true}).decode(buffer);
    const data = JSON.parse(text);
    const expected = {schema_version: 1, project: clips.project, clips: clips.clips.filter(c => two.input.ids.includes(c.id))};
    expect(same(data, expected), 'two.json が clips.json の2件（メモあり）と一致しません');
    renderExcerpt(text, data);

    await Promise.all(LAYERS.map(layer => loadLayer(layer, captures)));
    await document.fonts.ready;
    return true;
  }

  // Exact lines of the raw output: the project line, then each clip's id and title lines.
  function renderExcerpt(text, data) {
    const lines = text.split(/\r?\n/);
    const find = wanted => {
      const index = lines.findIndex(line => line.trim() === wanted);
      expect(index >= 0, 'two.json に行がありません：' + wanted);
      return index;
    };
    const groups = [[lines[find('"project": ' + JSON.stringify(data.project) + ',')]]];
    for (const clip of data.clips) {
      const at = find('"id": ' + JSON.stringify(clip.id) + ',');
      expect(lines[at + 1].trim() === '"title": ' + JSON.stringify(clip.title) + ',', 'two.json の題名の行が一致しません');
      groups.push([lines[at], lines[at + 1]]);
    }
    const target = $('json-lines');
    target.replaceChildren();
    groups.forEach((group, i) => {
      if (i) {
        const gap = document.createElement('div');
        gap.className = 'json-gap';
        gap.setAttribute('aria-hidden', 'true');
        target.append(gap);
      }
      for (const line of group) {
        const row = document.createElement('div');
        row.className = 'json-line';
        row.textContent = line;
        target.append(row);
      }
    });
  }

  window.motionReady = prepare();
  seek(0);

  // ---- Preview only: native controls outside the film; no RAF while rendering. ----
  if (!RENDER) {
    const play = $('play'), scrub = $('scrub'), clock = $('clock'), status = $('preview-status');
    let time = 0, playing = false, origin = 0, raf = 0;
    function fit() {
      const parent = box.parentElement, style = getComputedStyle(parent);
      const room = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const scale = Math.min(1, room / NATIVE_W);
      box.style.width = NATIVE_W * scale + 'px';
      box.style.height = NATIVE_H * scale + 'px';
      stage.style.transform = 'scale(' + scale + ')';
    }
    function show(seconds) {
      time = seek(seconds).time;
      scrub.value = time.toFixed(2);
      clock.value = time.toFixed(1) + ' / 28.0 秒';
    }
    function stop() {
      playing = false;
      cancelAnimationFrame(raf);
      play.textContent = '再生';
    }
    function tick(now) {
      if (!playing) return;
      const seconds = (now - origin) / 1000;
      if (seconds >= DURATION) { show(DURATION); stop(); return; }
      show(seconds);
      raf = requestAnimationFrame(tick);
    }
    play.addEventListener('click', () => {
      if (playing) return stop();
      if (time >= DURATION) time = 0;
      playing = true;
      origin = performance.now() - time * 1000;
      play.textContent = '一時停止';
      raf = requestAnimationFrame(tick);
    });
    scrub.addEventListener('input', () => { stop(); show(Number(scrub.value)); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    addEventListener('resize', fit);
    fit();
    show(0);
    window.motionReady.then(() => {
      play.disabled = false;
      scrub.disabled = false;
      show(time);
    }, error => {
      status.textContent = '素材を確認できませんでした：' + error.message + ' 作例フォルダーをローカルサーバー（例：python -m http.server 8000）で開いてください。';
    });
  }
})();
