/* Studio Yebisu original. MIT. window.seek(秒) は、その時刻の完成した画面だけを描く。 */
(() => {
  'use strict';

  const RENDER = Boolean(window.__MOTION_RENDER__) || new URLSearchParams(location.search).has('render');
  const given = window.renderConfig || {};
  const pick = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);
  const W = Math.round(pick(given.width, 1280));
  const H = Math.round(pick(given.height, 720));
  const FPS = Math.round(pick(given.fps, 30));
  const DURATION = 28;
  const BASE_W = 1280;
  const BASE_H = 720;
  // 縦長の配置は作っていない。別の大きさでは1280×720の画面を縮尺だけ合わせて中央に置く。
  const SCALE = Math.min(W / BASE_W, H / BASE_H);

  window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: 8, audioEvents: []};

  const holder = document.getElementById('holder');
  const stage = document.getElementById('stage');
  const box = document.getElementById('box');
  if (RENDER) document.body.classList.add('render');
  stage.style.width = W + 'px';
  stage.style.height = H + 'px';
  box.style.transform = 'translate(' + ((W - BASE_W * SCALE) / 2) + 'px,' + ((H - BASE_H * SCALE) / 2) + 'px) scale(' + SCALE + ')';

  function fitPreview() {
    if (RENDER) {
      holder.style.width = W + 'px';
      holder.style.height = H + 'px';
      stage.style.transform = 'none';
      return;
    }
    const controls = document.getElementById('controls');
    const room = Math.max(160, innerHeight - (controls.offsetHeight || 120) - 48);
    const k = Math.min(1, (innerWidth - 32) / W, room / H);
    holder.style.width = Math.floor(W * k) + 'px';
    holder.style.height = Math.floor(H * k) + 'px';
    stage.style.transform = 'scale(' + k + ')';
  }

  // ---- 部品 ----
  const tracks = [];
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }
  // a0〜a1 で入り、b0〜b1 で出る。状態は時刻だけで決まる。
  function track(element, a0, a1, b0, b1, dy) {
    element.classList.add('el');
    tracks.push({element, a0, a1, b0: b0 == null ? Infinity : b0, b1: b1 == null ? Infinity : b1, dy: dy == null ? 14 : dy});
    return element;
  }
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const ease = v => 1 - Math.pow(1 - v, 3);

  // ---- 素材の読み込みと検証 ----
  async function load(path, as) {
    const response = await fetch(path, {cache: 'no-store'});
    if (!response.ok) throw new Error(path + ' を読み込めません（HTTP ' + response.status + '）');
    return as === 'text' ? response.text() : response.json();
  }
  function validate(results, history, input, glossary) {
    const fail = message => { throw new Error(message); };
    const samples = new Map((results.samples || []).map(sample => [sample.id, sample]));
    for (const id of ['wide-ui', 'and-query', 'slides-only']) {
      const sample = samples.get(id);
      if (!sample || !Array.isArray(sample.before) || !Array.isArray(sample.after)) fail('results.json に ' + id + ' がありません');
      for (const entry of [...sample.before, ...sample.after]) {
        if (typeof entry.id !== 'string' || typeof entry.title !== 'string' || !Array.isArray(entry.tags)) fail('results.json の ' + id + ' の掲載項目が足りません');
      }
    }
    const runs = new Map((history.runs || []).map(run => [run.phase, run]));
    for (const phase of ['baseline', 'red1', 'green1', 'red2', 'green2', 'red3', 'green3']) {
      const run = runs.get(phase);
      if (!run || ![run.tests, run.pass, run.fail, run.exit_code].every(Number.isFinite)) fail('tdd-history.json に ' + phase + ' の数がありません');
      // 図は「各段の失敗1件 → 全成功」を描く。記録がその形でなければ描かない。
      if (phase.startsWith('red') && (run.fail !== 1 || run.exit_code === 0)) fail(phase + ' が失敗1件の記録ではありません');
      if (phase.startsWith('green') && (run.fail !== 0 || run.pass !== run.tests || run.exit_code !== 0)) fail(phase + ' が全成功の記録ではありません');
    }
    const quote = input.match(/「([^」]+)」/);
    if (!quote) fail('input.md に元の依頼がありません');
    const terms = [...glossary.matchAll(/^\*\*(.+?)\*\*:/gm)].map(match => match[1]);
    const picked = ['表題', 'タグ', '語', '分野'];
    if (!picked.every(term => terms.includes(term))) fail('GLOSSARY.md に表題・タグ・語・分野がありません');
    return {samples, runs, quote: quote[0], terms: picked, node: runs.get('green3').node};
  }

  // ---- 組み立て ----
  function tagList(tags) {
    const list = node('div', 'row-tags');
    for (const tag of tags) list.append(node('span', 'tag', tag));
    return list;
  }

  function build(data) {
    const wide = data.samples.get('wide-ui');
    const and = data.samples.get('and-query');
    const all = data.samples.get('slides-only').before.length;
    const last = data.runs.get('green3');

    const hdr = node('div', 'hdr');
    hdr.append(node('b', '', 'Matt Pocock Skills'), document.createTextNode(' の作例｜架空の依頼・合成データ' + all + '件'));
    box.append(track(hdr, 4.5, 4.9, null, null, 0));
    const progress = node('div', 'progress');
    box.append(progress);

    // 1. 0〜4.5秒：短い依頼 → 用語と完成条件を決める
    const s1 = node('div', 's1 flow');
    const terms = node('div', 's1-terms');
    for (const term of data.terms) terms.append(node('span', 'term', term));
    s1.append(
      track(node('div', 's1-kicker', '架空の依頼'), 0.15, 0.55, 4.15, 4.5),
      track(node('div', 's1-quote', data.quote), 0.3, 0.9, 4.15, 4.5, 20),
      track(node('div', 's1-turn', '→ 用語と完成条件を、先に決める'), 1.9, 2.4, 4.15, 4.5),
      track(terms, 2.5, 3.0, 4.15, 4.5));
    box.append(s1);

    // 2. 4.5〜10.5秒：「ＵＩ」で、同じデータに変更前と変更後を通す
    box.append(
      track(node('div', 'scene-title', '全角でも、タグまで探す'), 4.6, 5.0, 10.15, 10.5),
      track(node('div', 'scene-sub', '検索語「' + wide.query + '」・分野 ' + wide.category), 4.7, 5.1, 10.15, 10.5));
    const before2 = node('div', 'panel panel-before');
    before2.append(node('div', 'p-name', '変更前'), node('div', 'p-count', wide.before.length + '件'), node('div', 'p-note', '表題の文字をそのまま探すだけ'));
    box.append(track(before2, 5.2, 5.6, 10.15, 10.5));
    const after2 = node('div', 'panel panel-after');
    const head2 = node('div', 'p-head');
    head2.append(node('div', 'p-name', '変更後'), node('div', 'p-count', wide.after.length + '件'));
    const rows2 = node('div', 'rows');
    wide.after.forEach((entry, i) => {
      const row = node('div', 'row');
      row.append(node('div', 'row-title', entry.title), tagList(entry.tags));
      rows2.append(track(row, 6.4 + i * 0.4, 6.8 + i * 0.4, null, null, 10));
    });
    rows2.querySelectorAll('.el').forEach(element => (element.style.position = 'relative'));
    after2.append(head2, rows2);
    box.append(track(after2, 5.8, 6.2, 10.15, 10.5));
    box.append(track(node('div', 'caption', '表題とタグの両方を、全角・半角と大文字・小文字をそろえて探す'), 7.8, 8.2, 10.15, 10.5, 0));

    // 3. 10.5〜16.5秒：「UI　設計」で語を足して絞る
    box.append(
      track(node('div', 'scene-title', '語を足すと、絞れる'), 10.6, 11.0, 16.15, 16.5),
      track(node('div', 'scene-sub', '検索語「' + and.query + '」（全角空白で区切る）・分野 ' + and.category), 10.7, 11.1, 16.15, 16.5));
    const narrow = node('div', 'narrow flow');
    const from = node('div', 'n-from');
    from.append(node('span', 'n-step', '「' + wide.query + '」だけ　'), node('span', 'n-count', wide.after.length + '件'));
    const to = node('div', 'n-after');
    to.append(node('span', 'n-step', '「' + and.query + '」　'), node('span', 'n-count', and.after.length + '件'));
    narrow.append(track(from, 11.2, 11.6, 16.15, 16.5), track(node('div', 'n-arrow', '→'), 11.9, 12.2, 16.15, 16.5, 0), track(to, 12.1, 12.5, 16.15, 16.5));
    box.append(narrow);
    if (and.after.length !== 1) throw new Error('results.json の and-query が1件ではありません');
    const single = node('div', 'single');
    single.append(node('div', 'row-title', and.after[0].title), tagList(and.after[0].tags));
    box.append(track(single, 12.9, 13.3, 16.15, 16.5));
    box.append(track(node('div', 'caption', 'すべての語を、表題かタグのどこかに含むものだけが残る。変更前は' + and.before.length + '件'), 13.8, 14.2, 16.15, 16.5, 0));

    // 4. 16.5〜22.5秒：実Nodeの記録。各段で失敗1件 → 全成功
    box.append(track(node('div', 'scene-title', '同じテストが、失敗してから通る'), 16.6, 17.0, 22.15, 22.5));
    const cycles = node('div', 'cycles flow');
    ['表記ゆれとタグ', '語を足して絞る', '分野で選ぶ'].forEach((title, i) => {
      const red = data.runs.get('red' + (i + 1));
      const green = data.runs.get('green' + (i + 1));
      const at = 17.2 + i * 1.0;
      const row = node('div', 'cycle');
      const name = node('div', 'c-name', '段' + (i + 1));
      name.append(node('small', '', title));
      const redBox = node('div', 'c-run c-red');
      redBox.append(node('div', 'c-badge', 'RED 失敗'), node('div', 'c-count', red.tests + '件中' + red.fail + '件が失敗'));
      const greenBox = node('div', 'c-run c-green');
      greenBox.append(node('div', 'c-badge', 'GREEN 成功'), node('div', 'c-count', green.tests + '件中' + green.pass + '件が成功'));
      row.append(name, track(redBox, at + 0.1, at + 0.5, null, null, 8), track(node('div', 'c-arrow', '→'), at + 0.5, at + 0.7, null, null, 0), track(greenBox, at + 0.6, at + 1.0, null, null, 8));
      row.querySelectorAll('.el').forEach(element => (element.style.position = 'relative'));
      cycles.append(track(row, at, at + 0.3, 22.15, 22.5, 0));
    });
    box.append(cycles);
    box.append(track(node('div', 'caption', '制作時に Node ' + data.node + ' で実行した記録（tdd-history.json）から読んだ数'), 20.4, 20.8, 22.15, 22.5, 0));

    // 5. 22.5〜28秒：持ち帰れるもの。24.5秒までに出し切り、あとは止める
    box.append(
      track(node('div', 'scene-title', '依頼の一文から、持ち帰れるもの'), 22.6, 23.0),
      track(node('div', 'scene-sub', '仕様・用語集・テスト・変更後のコードが、同じ言葉でつながる'), 22.7, 23.1));
    const takeaway = node('div', 'takeaway flow');
    [['search.mjs', '変更後のコード（searchEntries）'], ['search.test.mjs', 'テスト' + last.tests + '件'], ['SPEC.md', '曖昧さの決め方と受け入れ例'], ['GLOSSARY.md', '用語集']].forEach(([file, what], i) => {
      const row = node('div', 't-row');
      row.append(node('div', 't-file', file), node('div', 't-what', what));
      takeaway.append(track(row, 23.0 + i * 0.25, 23.35 + i * 0.25, null, null, 10));
    });
    box.append(takeaway);
    box.append(track(node('div', 'final-note', '架空の依頼と合成データ' + all + '件。仕様は制作担当が決め、利用者との合意はしていない'), 24.0, 24.4, null, null, 0));

    return progress;
  }

  // ---- 時刻からの描画 ----
  let progressBar = null;
  let built = false;
  function draw(seconds) {
    const t = Math.min(DURATION, Math.max(0, Number(seconds) || 0));
    for (const item of tracks) {
      const vin = ease(clamp01((t - item.a0) / (item.a1 - item.a0)));
      const vout = item.b0 === Infinity ? 0 : ease(clamp01((t - item.b0) / (item.b1 - item.b0)));
      const opacity = vin * (1 - vout);
      const shift = (1 - vin) * item.dy;
      item.element.style.opacity = opacity.toFixed(4);
      item.element.style.transform = shift > 0.005 ? 'translateY(' + shift.toFixed(2) + 'px)' : 'none';
      item.element.style.visibility = opacity > 0.0005 ? 'visible' : 'hidden';
    }
    progressBar.style.transform = 'scaleX(' + (t / DURATION).toFixed(5) + ')';
    return {time: t};
  }

  window.motionReady = (async () => {
    const [results, history, input, glossary] = await Promise.all([
      load('../results.json'), load('../tdd-history.json'), load('../input.md', 'text'), load('../GLOSSARY.md', 'text')
    ]);
    const data = validate(results, history, input, glossary);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    progressBar = build(data);
    built = true;
    draw(0);
  })();

  window.seek = seconds => (built ? draw(seconds) : window.motionReady.then(() => draw(seconds)));

  fitPreview();
  if (RENDER) {
    document.getElementById('controls').remove();
    window.motionReady.catch(error => stage.append(node('div', 'failure', '素材を読み込めなかったため描画しません：' + error.message)));
    return;
  }

  // ---- プレビュー（書き出しには使わない） ----
  const controls = document.getElementById('controls');
  const play = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const output = document.getElementById('time');
  controls.hidden = false;
  fitPreview();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = false, current = 0, started = 0, frame = 0;
  function show(t) {
    current = t;
    draw(t);
    scrub.value = String(t);
    output.value = t.toFixed(2) + '秒';
  }
  function stop() {
    playing = false;
    cancelAnimationFrame(frame);
    play.textContent = '再生';
    play.setAttribute('aria-pressed', 'false');
  }
  function tick(now) {
    if (!playing) return;
    const t = (now - started) / 1000;
    if (t >= DURATION) { show(DURATION); stop(); return; }
    show(t);
    frame = requestAnimationFrame(tick);
  }
  function start() {
    if (current >= DURATION - 0.01) current = 0;
    playing = true;
    started = performance.now() - current * 1000;
    play.textContent = '一時停止';
    play.setAttribute('aria-pressed', 'true');
    frame = requestAnimationFrame(tick);
  }
  play.disabled = true;
  scrub.disabled = true;
  play.addEventListener('click', () => (playing ? stop() : start()));
  scrub.addEventListener('input', () => { stop(); show(Number(scrub.value)); });
  controls.querySelectorAll('[data-at]').forEach(button => button.addEventListener('click', () => { stop(); show(Number(button.dataset.at)); }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  reduce.addEventListener('change', () => { if (reduce.matches) stop(); });
  window.addEventListener('resize', fitPreview);

  window.motionReady.then(() => {
    play.disabled = false;
    scrub.disabled = false;
    if (reduce.matches) show(window.motionConfig.posterTime);
    else { show(0); start(); }
  }, error => {
    stage.append(node('div', 'failure', '素材を読み込めなかったため描画しません：' + error.message));
  });
})();
