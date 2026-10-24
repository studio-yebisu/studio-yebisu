/* HatchZip 作例 — 実測トレースの再生。保存済みのサンプル列を表示するだけで、
   このページから何かを実行することはありません。 */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const PB = 15; // 再生時間（秒）。実時間ではなく見やすく伸縮したもの。
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const els = {
    canvas: $('#trace'), play: $('#play'), scrub: $('#scrub'), clock: $('#clock'), status: $('#status'), seal: $('#seal'),
    files: $('#c-files'), archive: $('#c-archive'), output: $('#c-output'), total: $('#c-total'),
    barPeak: $('#bar-peak'), barConv: $('#bar-conv'), barPeakV: $('#bar-peak-v'), barConvV: $('#bar-conv-v'),
    buttons: [...document.querySelectorAll('[data-sample]')],
  };
  const ctx = els.canvas.getContext('2d');

  const PAPER = '#fbf9f3', INK = '#17150f', MUTED = '#6b6455', RULE = 'rgba(23,21,15,0.2)';
  const ACCENT = '#ff4f00', BLUE = '#2749c9', SOFT = '#e7e1d0', LIME = '#cbef3a';

  let data = null, sample = null, sampleId = 'zip-stored';
  let t = 0, playing = false, raf = 0, origin = 0, sizeKey = '';

  const fmt = n => n.toLocaleString('ja-JP');
  const scale = () => PB / sample.duration_seconds;
  const mt = () => Math.min(t / scale(), sample.duration_seconds);

  // トレースを時刻mtで読む：バイトは線形補間、ファイル数は直近の点の値。
  function at(time) {
    const tr = sample.trace;
    if (time <= tr[0].seconds) return tr[0];
    const last = tr[tr.length - 1];
    if (time >= last.seconds) return last;
    for (let i = 1; i < tr.length; i++) {
      if (tr[i].seconds >= time) {
        const a = tr[i - 1], b = tr[i];
        const k = (time - a.seconds) / (b.seconds - a.seconds || 1);
        return {
          seconds: time,
          archive_bytes: a.archive_bytes + (b.archive_bytes - a.archive_bytes) * k,
          output_bytes: a.output_bytes + (b.output_bytes - a.output_bytes) * k,
          sidecar_bytes: a.sidecar_bytes + (b.sidecar_bytes - a.sidecar_bytes) * k,
          total_bytes: a.total_bytes + (b.total_bytes - a.total_bytes) * k,
          output_files: a.output_files,
        };
      }
    }
    return last;
  }

  function fitCanvas() {
    const w = Math.max(280, els.canvas.clientWidth), h = Math.max(240, els.canvas.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = w + 'x' + h + '@' + dpr;
    if (key === sizeKey) return;
    sizeKey = key;
    els.canvas.width = Math.round(w * dpr);
    els.canvas.height = Math.round(h * dpr);
  }

  function draw() {
    fitCanvas();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = els.canvas.width / dpr, H = els.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!sample) {
      ctx.fillStyle = MUTED;
      ctx.font = '600 14px ' + 'sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('実測記録を読み込んでいます…', W / 2, H / 2);
      return;
    }
    const cur = at(mt());
    const init = sample.trace[0];
    const ground = H - 46;

    // 左：アーカイブブロック（バイト量に比例して縮む）
    const colW = Math.min(150, W * 0.24);
    const maxH = H - 110;
    const aH0 = maxH, aH = maxH * (cur.archive_bytes / init.archive_bytes);
    const ax = W * 0.08, ay = ground - aH;
    ctx.fillStyle = ACCENT;
    ctx.fillRect(ax, ay, colW, aH);
    // 斜線のハッチ（削られた部分の ghost）
    ctx.save();
    ctx.strokeStyle = 'rgba(255,79,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = ground - aH0; y < ground; y += 7) { ctx.moveTo(ax, y); ctx.lineTo(ax + colW, y + colW * 0.5); }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.font = '700 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('アーカイブ（コピー）', ax + colW / 2, ground + 18);
    ctx.font = '600 11px monospace';
    ctx.fillText(fmt(Math.round(cur.archive_bytes)) + ' B', ax + colW / 2, ground + 34);

    // 真ん中：消費されていく矢印
    const mx = ax + colW + 26;
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, ground - 20);
    ctx.lineTo(mx + 54, ground - 20);
    ctx.lineTo(mx + 46, ground - 26);
    ctx.moveTo(mx + 54, ground - 20);
    ctx.lineTo(mx + 46, ground - 14);
    ctx.stroke();

    // 右：出力エリア（ファイルのタイルが育つ）
    const ox = mx + 84, ow = W - ox - W * 0.06;
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, ground - maxH, ow, maxH);
    const tiles = Math.min(cur.output_files, 96);
    const tcols = Math.max(4, Math.floor(ow / 26));
    const tsize = Math.min(20, (ow - 10) / tcols - 4);
    for (let i = 0; i < tiles; i++) {
      const cxx = ox + 6 + (i % tcols) * (tsize + 4);
      const cyy = ground - 6 - tsize - Math.floor(i / tcols) * (tsize + 4);
      if (cyy < ground - maxH + 4) break;
      ctx.fillStyle = cur.output_files >= sample.result.file_count && mt() >= sample.duration_seconds ? BLUE : INK;
      ctx.fillRect(cxx, cyy, tsize, tsize);
    }
    ctx.fillStyle = INK;
    ctx.font = '700 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('出力（' + fmt(sample.result.file_count) + 'ファイル）', ox + ow / 2, ground + 18);
    ctx.font = '600 11px monospace';
    ctx.fillText(fmt(Math.round(cur.output_bytes)) + ' B', ox + ow / 2, ground + 34);

    // 進捗バー（トレース時刻）
    ctx.fillStyle = SOFT;
    ctx.fillRect(W * 0.08, H - 12, W * 0.84, 6);
    ctx.fillStyle = LIME;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.fillRect(W * 0.08, H - 12, W * 0.84 * Math.min(1, t / PB), 6);
    ctx.strokeRect(W * 0.08, H - 12, W * 0.84, 6);
  }

  function updateDom() {
    if (!sample) return;
    const cur = at(mt());
    els.files.textContent = fmt(cur.output_files) + ' / ' + fmt(sample.result.file_count);
    els.archive.textContent = fmt(Math.round(cur.archive_bytes));
    els.output.textContent = fmt(Math.round(cur.output_bytes));
    els.total.textContent = fmt(Math.round(cur.total_bytes));
    els.clock.textContent = t.toFixed(1) + ' / ' + PB.toFixed(1) + '秒';
    els.scrub.value = String(Math.min(t, PB));
    els.seal.hidden = !(cur.output_files >= sample.result.file_count && mt() >= sample.duration_seconds);
    if (els.seal.hidden === false) els.seal.textContent = fmt(sample.result.file_count) + '件すべてのSHA-256が一致';
  }

  function render() { draw(); updateDom(); }

  function tick(now) {
    if (!playing) return;
    const next = (now - origin) / 1000;
    if (next >= PB) { stop(); t = PB; render(); return; }
    t = next;
    render();
    raf = requestAnimationFrame(tick);
  }
  function play() {
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
    // 比較バー（固定値）
    const peak = sample.observed_peak_bytes, conv = sample.conventional_final_coexistence_bytes;
    const max = Math.max(peak, conv);
    els.barPeak.style.width = (peak / max * 100).toFixed(1) + '%';
    els.barConv.style.width = (conv / max * 100).toFixed(1) + '%';
    els.barPeakV.textContent = fmt(peak) + ' B';
    els.barConvV.textContent = fmt(conv) + ' B';
    stop();
    t = 0;
    render();
    els.status.textContent = sample.label + '：実測トレースの再生（' + sample.input + '）。再生時間は実時間ではなく、見やすく伸縮しています。';
  }

  els.play.addEventListener('click', () => (playing ? stop() : (t >= PB - 0.01 ? (t = 0, render(), play()) : play())));
  els.scrub.addEventListener('input', () => { stop(); t = Number(els.scrub.value); render(); });
  for (const b of els.buttons) b.addEventListener('click', () => setSample(b.dataset.sample));
  window.addEventListener('resize', draw);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

  fetch('samples.json')
    .then(r => { if (!r.ok) throw new Error('samples.json を読めませんでした（HTTP ' + r.status + '）'); return r.json(); })
    .then(d => {
      data = d;
      for (const b of els.buttons) b.disabled = false;
      els.play.disabled = false;
      els.scrub.disabled = false;
      setSample(sampleId);
    })
    .catch(e => { els.status.textContent = '実測記録を読み込めませんでした：' + e.message; });
  void reduce;
})();
