/* Studio Yebisu original Motion Reel source for the Addy Agent Skills example. MIT.
   Names, dates, ids and counts come from the saved records next to the example.
   Nothing here runs the code, an AI, or a terminal; the reel only draws those records. */
(() => {
  'use strict';
  const RENDER = Boolean(window.__MOTION_RENDER__) || new URLSearchParams(location.search).has('render');
  const given = window.renderConfig || {};
  const BASE = {width: 1280, height: 720};
  const DURATION = 28;
  window.motionConfig = {duration: DURATION, fps: given.fps || 30, width: given.width || BASE.width, height: given.height || BASE.height, posterTime: 8, audioEvents: []};
  const SCENES = [[0, 4.5, '依頼と仕様'], [4.5, 11, '4件から2件'], [11, 17, '線の引き方'], [17, 22.5, 'テストの記録'], [22.5, 28, '持ち帰る']];
  const STATUS = {all: 'すべて', open: '未完了', done: '完了'};
  const PHASE = {baseline: '既存', red1: 'RED 1', green1: 'GREEN 1', red2: 'RED 2', green2: 'GREEN 2'};
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const stage = document.getElementById('stage');
  const holder = document.getElementById('holder');
  const viewport = document.getElementById('viewport');
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b) => ease((t - a) / (b - a));
  const items = [], scenes = [], progress = [];
  let built = false;

  function node(parent, tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    parent.append(el);
    return el;
  }
  // kind: rise (fade + lift), fade, grow-x, grow-y. dim: [start, end, floor] lowers opacity later.
  function enter(el, start, length = 0.4, kind = 'rise', dim = null) {
    items.push({el, start, length, kind, dim});
    return el;
  }
  function apply({el, start, length, kind, dim}, t) {
    const p = ramp(t, start, start + length);
    if (kind === 'grow-x') { el.style.transform = `scaleX(${p.toFixed(4)})`; return; }
    if (kind === 'grow-y') { el.style.transform = `scaleY(${p.toFixed(4)})`; return; }
    const lower = dim ? 1 - (1 - dim[2]) * ramp(t, dim[0], dim[1]) : 1;
    el.style.opacity = (p * lower).toFixed(4);
    if (kind === 'rise') el.style.transform = `translateY(${((1 - p) * 16).toFixed(2)}px)`;
  }
  function need(ok, message) { if (!ok) throw new Error(message); }
  async function load(path, text = false) {
    const response = await fetch(path, {cache: 'no-store'});
    if (!response.ok) throw new Error(path + ' を読めません（' + response.status + '）');
    return text ? response.text() : response.json();
  }
  const utc = offset => { const h = -offset / 60; return 'UTC' + (h >= 0 ? '+' : '−') + Math.abs(h); };

  function validate({results, history, mutation, acceptance, zones, input}) {
    const samples = Array.isArray(results.samples) ? results.samples : [];
    const open = samples.find(s => s.id === 'due-open');
    const all = samples.find(s => s.id === 'no-cutoff');
    const isTask = task => task && typeof task.id === 'string' && typeof task.title === 'string' && (task.dueDate === null || DATE.test(task.dueDate));
    need(open && open.options && STATUS[open.options.status] && DATE.test(open.options.cutoff), 'results.json に due-open の入力がありません');
    need(Array.isArray(open.before) && open.before.every(isTask) && Array.isArray(open.after) && open.after.every(isTask), 'due-open の記録の形が違います');
    need(open.after.length > 0 && open.after.length < open.before.length && open.after.every(a => open.before.some(b => b.id === a.id)), 'due-open の結果が変更前の一部ではありません');
    const cutoff = open.options.cutoff;
    const kept = new Set(open.after.map(task => task.id));
    need(open.before.every(task => (task.dueDate !== null && task.dueDate <= cutoff) === kept.has(task.id)), 'due-open の結果が「指定日まで」の線と合いません');
    need(all && Array.isArray(all.after) && all.after.length > 0 && typeof results.node === 'string', 'results.json に no-cutoff または Node の版がありません');
    const order = ['baseline', 'red1', 'green1', 'red2', 'green2'];
    const runs = Array.isArray(history.runs) ? history.runs : [];
    need(runs.length === order.length && runs.every((run, i) => run.phase === order[i] && run.tests === run.pass + run.fail), 'tdd-history.json の段の並びが違います');
    need(runs.every(run => run.phase.startsWith('red') ? run.fail === 1 && run.exit_code !== 0 : run.fail === 0 && run.exit_code === 0), '各段の記録が「失敗1件 → 全成功」の形ではありません');
    need(history.human_approval === false, 'tdd-history.json に人の承認の扱いがありません');
    const ops = String(mutation.change || '').split('->').map(side => (/(<=|<)\s*cutoff/.exec(side) || [])[1]);
    need(mutation.status === 'caught' && ops.length === 2 && ops[0] === '<=' && ops[1] === '<' && mutation.mutant_failures === 1 && mutation.restored_exit_code === 0 && mutation.restored_tests_pass === runs.at(-1).pass, 'mutation.json の記録の形が違います');
    need(acceptance.status === 'passed' && Number.isInteger(acceptance.checks) && Array.isArray(acceptance.details) && acceptance.details.length === acceptance.checks && acceptance.details.every(d => d.passed === true) && Number.isFinite(acceptance.timezoneOffset), 'acceptance-main.json が全件成功の記録ではありません');
    const list = Array.isArray(zones.zones) ? zones.zones : [];
    need(zones.same_outcomes === true && zones.offsets_differ === true && list.length >= 2 && list.every(z => z.checks === acceptance.checks && Number.isFinite(z.offset_minutes)), 'timezones.json の記録の形が違います');
    const quote = (/「([^」]+)」/.exec(input) || [])[1];
    need(quote, 'input.md に依頼の文がありません');
    return {open, cutoff, kept, seedCount: all.after.length, node: results.node, runs, ops, mutation, checks: acceptance.checks,
      zones: [acceptance.timezoneOffset, ...list.map(z => z.offset_minutes)].map(utc), quote};
  }

  function scene(index, kicker, title) {
    const el = node(stage, 'section', 'scene');
    scenes[index] = el;
    if (kicker) node(el, 'div', 'abs kicker', kicker);
    if (title) enter(node(el, 'div', 'abs title m', title), SCENES[index][0] + 0.1);
    return el;
  }

  function build(d) {
    stage.replaceChildren();
    node(stage, 'div', 'abs brand', 'STUDIO YEBISU ／ Addy Agent Skills の作例');
    const bar = node(stage, 'div', 'abs progress');
    for (const [, , label] of SCENES) progress.push(node(bar, 'div', '', label));

    // 1. The request and three rules decided before code.
    const s1 = scene(0, '依頼');
    const [first, ...rest] = d.quote.split('。').filter(Boolean);
    node(s1, 'div', 'abs quote m', '「' + first.replace('へ期限', 'へ\n期限') + '。」');
    enter(node(s1, 'div', 'abs quote-rest', rest.map(x => x + '。').join('')), 0.4, 0.5);
    enter(node(s1, 'div', 'abs rule-head', 'コードより先に、仕様で決めた3つ'), 1.5);
    [['1', '当日を含む'], ['2', '期限なしは除く'], ['3', '状態と同時に効く']].forEach(([n, text], i) => {
      const chip = node(s1, 'div', 'abs chip');
      chip.style.left = (96 + i * 364) + 'px';
      node(chip, 'span', '', n);
      node(chip, 'b', '', text);
      enter(chip, 1.9 + i * 0.4);
    });
    enter(node(s1, 'div', 'abs caption', `架空の工房と合成TODO${d.seedCount}件の作例。依頼も制作担当が用意しました。`), 2.9);

    // 2. The saved result for status open and the cutoff: before list to after list.
    const s2 = scene(1, '実際の入力');
    enter(node(s2, 'div', 'abs inputs m', `状態：${STATUS[d.open.options.status]}　期限：${d.cutoff} まで`), 4.6);
    const rows = node(s2, 'div', 'abs rows');
    d.open.before.forEach((task, i) => {
      const keep = d.kept.has(task.id);
      const row = node(rows, 'div', 'row');
      node(row, 'span', '', task.title);
      node(row, 'span', 'd', task.dueDate || '期限なし');
      enter(node(row, 'span', 'v', keep ? '残る' : '除外'), 6.6, 0.5, 'fade');
      enter(row, 4.9 + i * 0.2, 0.35, 'rise', keep ? null : [6.7, 7.3, 0.45]);
      if (!keep) enter(node(row, 'span', 'strike'), 6.7, 0.6, 'grow-x');
    });
    const box = enter(node(s2, 'div', 'abs count-box'), 5.2);
    node(box, 'div', 'l', '表示する件数');
    enter(node(box, 'div', 'abs count-n m', d.open.before.length + '件'), 5.2, 0.4, 'fade', [6.7, 7.1, 0]);
    enter(node(box, 'div', 'abs count-n m', d.open.after.length + '件'), 6.8, 0.5, 'fade');
    enter(node(box, 'div', 'abs count-sub', '状態の絞り込みだけ'), 5.2, 0.4, 'fade', [6.7, 7.1, 0]);
    enter(node(box, 'div', 'abs count-sub', '期限の条件をかけた後'), 6.8, 0.5, 'fade');
    enter(node(s2, 'div', 'abs caption', `保存した実行結果（results.json）：Node ${d.node} で selectTasks を実行`), 5.4);

    // 3. Where the line falls, derived from the same saved result.
    const s3 = scene(2, '線の引き方', '指定日の当日までを残す');
    const dates = [...new Set([...d.open.before.map(task => task.dueDate).filter(Boolean), d.cutoff])].sort();
    const step = 820 / dates.length;
    const xOf = date => date === null ? 1100 : 120 + (dates.indexOf(date) + 0.5) * step;
    enter(node(s3, 'div', 'abs axis'), 11.3, 0.6, 'grow-x');
    for (const date of dates) {
      const tick = node(s3, 'div', 'abs tick', date);
      tick.style.left = xOf(date).toFixed(1) + 'px';
      enter(tick, 11.6, 0.4, 'fade');
    }
    const next = dates[dates.indexOf(d.cutoff) + 1];
    const lineX = next ? (xOf(d.cutoff) + xOf(next)) / 2 : xOf(d.cutoff) + step / 2;
    const cut = node(s3, 'div', 'abs cut');
    cut.style.left = lineX.toFixed(1) + 'px';
    enter(cut, 12.0, 0.5, 'grow-y');
    const cutLabel = node(s3, 'div', 'abs cut-label', `${d.cutoff} まで（当日を含む）`);
    cutLabel.style.left = lineX.toFixed(1) + 'px';
    enter(cutLabel, 12.1, 0.4);
    enter(node(s3, 'div', 'abs nodate', '期限なし'), 11.6, 0.4, 'fade');
    d.open.before.forEach((task, i) => {
      const keep = d.kept.has(task.id);
      const card = node(s3, 'div', 'abs card' + (keep ? '' : ' out'));
      card.style.left = xOf(task.dueDate).toFixed(1) + 'px';
      node(card, 'div', 't', task.title);
      const reason = task.dueDate === null ? '期限なし' : task.dueDate === d.cutoff ? '指定日の当日' : task.dueDate < d.cutoff ? '指定日より前' : '指定日より後';
      node(card, 'div', 'r', (keep ? '残る・' : '除く・') + reason);
      enter(card, 12.7 + i * 0.6, 0.4);
    });
    enter(node(s3, 'div', 'abs caption', '線は results.json の保存結果から引いています。並びは入力順のままです。'), 15.0);

    // 4. Saved test runs, then the one-condition inversion.
    const s4 = scene(3, 'テストの記録（tdd-history.json・mutation.json）', '失敗を見てから、通す');
    const runs = node(s4, 'div', 'abs runs');
    d.runs.forEach((run, i) => {
      const red = run.phase.startsWith('red');
      const card = node(runs, 'div', 'run' + (red ? ' red' : ''));
      node(card, 'div', 'p m', PHASE[run.phase]);
      const squares = node(card, 'div', 'sq');
      for (let k = 0; k < run.tests; k++) node(squares, 'span', k < run.pass ? '' : 'f', k < run.pass ? '✓' : '×');
      node(card, 'div', 's', red ? `${run.fail}件失敗／${run.tests}件` : `${run.pass}件すべて成功`);
      enter(card, 17.4 + i * 0.4, 0.35);
    });
    const mut = enter(node(s4, 'div', 'abs mut'), 19.7);
    node(mut, 'span', 'k', '条件を1か所反転');
    node(mut, 'span', 'c code', d.ops[0]);
    node(mut, 'span', '', '→');
    node(mut, 'span', 'c code', d.ops[1]);
    enter(node(mut, 'span', 'bad', `${d.mutation.mutant_failures}件失敗`), 20.3, 0.35, 'fade');
    enter(node(mut, 'span', 'ok', `戻すと${d.mutation.restored_tests_pass}件成功`), 20.8, 0.35, 'fade');
    enter(node(s4, 'div', 'abs caption', `別の確認：${d.checks}条件を ${d.zones.join('・')} で実行し、すべて同じ結果`), 21.0);

    // 5. What a reader can take home. Settled by 24.4 s, then held.
    const s5 = scene(4, '持ち帰れるもの', '仕様・コード・テストが残る');
    const files = node(s5, 'div', 'abs files');
    [['SPEC.md', '仕様：6つの領域\n受入条件'], ['tasks.mjs', 'コード：期限の絞り込み\n日付の検証'], ['tasks.test.mjs', `テスト：${d.runs.at(-1).tests}件`]].forEach(([name, text], i) => {
      const file = node(files, 'div', 'file');
      node(file, 'div', 'n code', name);
      node(file, 'div', 'x', text);
      enter(file, 22.9 + i * 0.3, 0.35);
    });
    const facts = enter(node(s5, 'div', 'abs facts'), 23.9);
    for (const text of [`合成データ${d.seedCount}件`, '架空の工房', '人の段階承認なし']) node(facts, 'span', '', text);
    enter(node(s5, 'div', 'abs caption', '保存した記録から作った映像です。画面の操作を撮ったものではありません。'), 24.0);
  }

  function layout() {
    const w = RENDER ? window.motionConfig.width : viewport.clientWidth;
    const h = RENDER ? window.motionConfig.height : viewport.clientHeight;
    const s = Math.min(w / BASE.width, h / BASE.height);
    holder.style.transform = `translate(${((w - BASE.width * s) / 2).toFixed(3)}px, ${((h - BASE.height * s) / 2).toFixed(3)}px) scale(${s.toFixed(5)})`;
  }

  function draw(seconds) {
    const t = Math.max(0, Math.min(DURATION, Number(seconds) || 0));
    layout();
    const current = SCENES.findIndex(([, end], i) => t < end || i === SCENES.length - 1);
    scenes.forEach((el, i) => {
      const [start, end] = SCENES[i];
      const last = i === SCENES.length - 1;
      const v = t < start || (!last && t > end) ? 0 : (i === 0 ? 1 : ramp(t, start, start + 0.3)) * (last ? 1 : 1 - ramp(t, end - 0.3, end));
      el.style.opacity = v.toFixed(4);
      el.style.visibility = v > 0 ? 'visible' : 'hidden';
    });
    for (const item of items) apply(item, t);
    progress.forEach((el, i) => el.classList.toggle('on', i === current));
    return {time: t, scene: current};
  }

  window.motionReady = (async () => {
    const [results, history, mutation, acceptance, zones, input] = await Promise.all([
      load('../results.json'), load('../tdd-history.json'), load('../mutation.json'),
      load('../acceptance-main.json'), load('../timezones.json'), load('../input.md', true)]);
    const data = validate({results, history, mutation, acceptance, zones, input});
    if (document.fonts) {
      await Promise.all(['600 54px "Yu Mincho"', '400 28px "Yu Gothic UI"', '400 30px Consolas'].map(font => document.fonts.load(font)));
      await document.fonts.ready;
    }
    build(data);
    built = true;
    draw(0);
  })();
  window.seek = seconds => (built ? draw(seconds) : window.motionReady.then(() => draw(seconds)));

  window.motionReady.catch(error => node(stage, 'div', 'failure', '記録を読めないため描画しません：' + error.message));
  const controls = document.getElementById('controls');
  if (RENDER) { controls.remove(); return; }
  window.motionReady.then(() => {
    document.documentElement.classList.add('preview');
    controls.hidden = false;
    const play = document.getElementById('play'), scrub = document.getElementById('scrub'), out = document.getElementById('time');
    let playing = false, at = 0, origin = 0, raf = 0;
    const show = t => { at = t; window.seek(t); scrub.value = String(t); out.value = t.toFixed(2) + '秒'; };
    const stop = () => { playing = false; cancelAnimationFrame(raf); play.textContent = '再生'; play.setAttribute('aria-pressed', 'false'); };
    const tick = now => {
      if (!playing || window.__MOTION_RENDER__) return stop();
      show(((now - origin) / 1000) % DURATION);
      raf = requestAnimationFrame(tick);
    };
    play.addEventListener('click', () => {
      if (playing) return stop();
      playing = true; origin = performance.now() - at * 1000;
      play.textContent = '停止'; play.setAttribute('aria-pressed', 'true');
      raf = requestAnimationFrame(tick);
    });
    scrub.addEventListener('input', () => { stop(); show(Number(scrub.value)); });
    for (const button of controls.querySelectorAll('[data-at]')) button.addEventListener('click', () => { stop(); show(Number(button.dataset.at)); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener('resize', () => show(at));
    show(0);
  });
})();
