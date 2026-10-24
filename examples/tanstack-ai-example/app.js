/* TanStack AI 作例 — 実行記録の再生。保存済みのイベントを時系列どおり表示するだけで、
   ブラウザーからモデルやツールは呼びません。 */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const LEAD = 1.0;          // 質問を見せる導入（秒）
  const TAIL = 2.2;          // 最後に結果を見せる余白（秒）
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const els = {
    ask: $('#ask'), answer: $('#answer'), cursor: $('#cursor'),
    nodeQ: $('#node-question'), nodeT: $('#node-tool'), nodeA: $('#node-answer'),
    slotQ: $('#slot-query'), slotQV: $('#slot-query-value'),
    slotM: $('#slot-max'), slotMV: $('#slot-max-value'),
    toolResult: $('#tool-result'), products: $('#products'),
    play: $('#play'), scrub: $('#scrub'), clock: $('#clock'), status: $('#status'),
    buttons: [...document.querySelectorAll('[data-sample]')],
  };

  let data = null, sample = null, sampleId = 'blue-mug';
  let t = 0, playing = false, raf = 0, origin = 0;

  const duration = () => LEAD + (sample ? sample.recorded_duration_seconds : 0) + TAIL;
  const fmt = n => n.toFixed(1);

  function eventsUpTo(time) {
    // 記録されたイベントを、再生時刻までのものだけ取り出す。
    const out = {argsQ: '', argsM: '', toolStarted: false, toolResult: null, text: '', started: false, finished: false};
    if (!sample) return out;
    const rt = time - LEAD;
    if (rt < 0) return out;
    for (const e of sample.events) {
      if (e.seconds > rt) break;
      if (e.type === 'RUN_STARTED') out.started = true;
      else if (e.type === 'RUN_FINISHED') out.finished = true;
      else if (e.type === 'TOOL_CALL_START') out.toolStarted = true;
      else if (e.type === 'TOOL_CALL_ARGS') {
        const s = collectArgs(e.toolCallId, rt);
        out.argsQ = s.q; out.argsM = s.m;
      } else if (e.type === 'TOOL_CALL_RESULT') out.toolResult = e.content;
      else if (e.type === 'TEXT_MESSAGE_CONTENT') out.text += e.delta || '';
    }
    return out;
  }

  const argsCache = new Map();
  function collectArgs(toolCallId, rt) {
    // 同じ呼び出しのdeltaを順に足して、入力オブジェクトの文字列を組み立てる。
    let q = '', m = '';
    for (const e of sample.events) {
      if (e.seconds > rt) break;
      if (e.type === 'TOOL_CALL_ARGS' && e.toolCallId === toolCallId) {
        const d = e.delta || '';
        const mq = d.match(/"query":\s*"([^"]*)/);
        if (mq) q = mq[1];
        const mm = d.match(/"maxPrice":\s*([0-9]+)/);
        if (mm) m = mm[1];
      }
    }
    argsCache.set(toolCallId, {q, m});
    return {q, m};
  }

  function render() {
    const d = duration();
    els.scrub.max = d.toFixed(2);
    const st = eventsUpTo(t);
    const rt = t - LEAD;

    els.nodeQ.classList.toggle('is-live', true);
    els.nodeT.classList.toggle('is-live', st.toolStarted);
    els.nodeT.setAttribute('aria-hidden', String(!st.toolStarted));
    els.nodeA.classList.toggle('is-live', st.text.length > 0 || st.toolResult !== null);
    els.nodeA.setAttribute('aria-hidden', String(!(st.text.length > 0 || st.toolResult)));

    els.slotQV.textContent = st.argsQ;
    els.slotMV.textContent = st.argsM;
    els.slotQ.classList.toggle('is-filled', !!st.argsQ);
    els.slotM.classList.toggle('is-filled', !!st.argsM);
    els.slotM.classList.toggle('is-na', sample ? !sample.tool_calls[0].input.hasOwnProperty('maxPrice') : false);

    els.toolResult.textContent = st.toolResult ? '返り値 ' + shortJson(st.toolResult) : '';

    els.answer.textContent = st.text;
    els.cursor.classList.toggle('is-on', playing && st.started && !st.finished && reduce.matches === false);

    // 道具の返り値が出たら、実際に返った商品カードを並べる。
    els.products.replaceChildren();
    if (st.toolResult) {
      for (const p of sample.products) els.products.appendChild(productCard(p));
      requestAnimationFrame(() => {
        for (const [i, c] of [...els.products.children].entries()) {
          setTimeout(() => c.classList.add('is-in'), reduce.matches ? 0 : i * 160);
        }
      });
    }
    els.clock.textContent = fmt(Math.min(t, d)) + ' / ' + fmt(d) + '秒';
    els.scrub.value = String(Math.min(t, d));
  }

  function shortJson(s) {
    try {
      const o = JSON.parse(s);
      return JSON.stringify(o).length > 150 ? JSON.stringify(o).slice(0, 150) + '…' : JSON.stringify(o);
    } catch (_) { return s.slice(0, 150); }
  }

  function productCard(p) {
    const card = document.createElement('article');
    card.className = 'product';
    const name = document.createElement('p'); name.className = 'product-name'; name.textContent = p.name;
    const price = document.createElement('p'); price.className = 'product-price'; price.innerHTML = '';
    price.textContent = p.price.toLocaleString('ja-JP');
    const yen = document.createElement('small'); yen.textContent = '円'; price.appendChild(yen);
    const badges = document.createElement('p'); badges.className = 'badges';
    for (const [k, v] of [['id', 'string'], ['name', 'string'], ['price', 'number'], ['color', 'string']]) {
      const b = document.createElement('span'); b.className = 'badge';
      const key = document.createElement('b'); key.textContent = k;
      b.append(key, ': ' + v);
      badges.appendChild(b);
    }
    card.append(name, price, badges);
    return card;
  }

  function draw(time) { t = Math.max(0, Math.min(duration(), time)); render(); }

  function tick(now) {
    if (!playing) return;
    const next = (now - origin) / 1000;
    if (next >= duration()) { stop(); draw(duration()); return; }
    draw(next);
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (!sample) return;
    playing = true;
    origin = performance.now() - t * 1000;
    els.play.textContent = '一時停止';
    els.play.setAttribute('aria-pressed', 'true');
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    els.play.textContent = '再生';
    els.play.setAttribute('aria-pressed', 'false');
    render();
  }

  function setSample(id) {
    sampleId = id;
    sample = data.samples.find(s => s.id === id) || data.samples[0];
    for (const b of els.buttons) b.setAttribute('aria-pressed', String(b.dataset.sample === sample.id));
    els.ask.textContent = sample.input;
    stop();
    draw(0);
    els.status.textContent = '記録「' + sample.label + '」：実際のモデル応答と道具の入出力を、記録された時刻どおりに表示しています（実行自体は2026-10-24に完了済み）。';
  }

  els.play.addEventListener('click', () => (playing ? stop() : (t >= duration() - 0.01 ? (draw(0), play()) : play())));
  els.scrub.addEventListener('input', () => { stop(); draw(Number(els.scrub.value)); });
  for (const b of els.buttons) b.addEventListener('click', () => setSample(b.dataset.sample));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  reduce.addEventListener('change', render);

  fetch('samples.json')
    .then(r => { if (!r.ok) throw new Error('samples.json を読めませんでした（HTTP ' + r.status + '）'); return r.json(); })
    .then(d => {
      data = d;
      for (const b of els.buttons) b.disabled = false;
      els.play.disabled = false;
      els.scrub.disabled = false;
      setSample(sampleId);
    })
    .catch(e => {
      els.status.textContent = '実行記録を読み込めませんでした：' + e.message;
    });
})();
