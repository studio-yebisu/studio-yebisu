// 保存済みの SolidCraft の結果を切り替えて見るだけのスクリプト。CAD や AI は動かさない。
(() => {
  'use strict';

  const STATES = {
    default: {
      id: 'tray-default',
      name: '初期',
      alt: {
        iso: 'SolidCraftで描画した初期のトレー（120×80×18 mm・穴8 mm）を斜め上から見た画像。上が開いた箱で、底の中央に丸い穴が1つある。',
        top: '初期のトレーを真上から見た画像。外側と内側の四角い線のあいだが壁で、中央に丸い穴が1つある。'
      },
      files: {
        design: 'outputs/tray-default.json', step: 'outputs/tray-default.step', stl: 'outputs/tray-default.stl',
        iso: 'renders/tray-default-iso.png', top: 'renders/tray-default-top.png'
      }
    },
    resized: {
      id: 'tray-resized',
      name: '変更後',
      alt: {
        iso: 'SolidCraftで描画した変更後のトレー（150×90×24 mm・穴12 mm）を斜め上から見た画像。上が開いた箱で、底の中央に丸い穴が1つある。',
        top: '変更後のトレーを真上から見た画像。外側と内側の四角い線のあいだが壁で、中央に丸い穴が1つある。'
      },
      files: {
        design: 'outputs/tray-resized.json', step: 'outputs/tray-resized.step', stl: 'outputs/tray-resized.stl',
        iso: 'renders/tray-resized-iso.png', top: 'renders/tray-resized-top.png'
      }
    }
  };
  const ORDER = ['default', 'resized'];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const tabs = $$('[role="tab"][data-state]');
  const viewButtons = $$('[data-view]');
  const panel = $('#state-panel');
  const shot = $('#shot');
  const metrics = $('#metrics');
  const metricsTitle = $('#metrics-title');
  const metricsStatus = $('#metrics-status');

  let record = null;
  let loadFailed = false;
  let state = 'default';
  let view = 'iso';

  // 数値の表示
  const grouped = (value, digits) => value.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
  const length = value => {
    const rounded = Math.round(value);
    return Math.abs(value - rounded) < 1e-9 ? String(rounded) : value.toFixed(3);
  };
  const relPercent = (measured, expected) => (Math.abs(measured - expected) / Math.abs(expected) * 100).toFixed(5);
  const coord = value => (Math.abs(value) < 5e-4 ? 0 : value).toFixed(3);

  function setField(name, text) {
    const target = $('[data-field="' + name + '"]', metrics);
    if (target) target.textContent = text;
  }

  function renderMetrics() {
    const data = record && record.states && record.states[state];
    metricsTitle.textContent = STATES[state].name + 'の状態の実測値';
    if (!data) {
      // 読み込み前は HTML に書いた初期の値だけを出す。失敗したら数値を出さない。
      metrics.hidden = loadFailed || state !== 'default';
      return;
    }
    metrics.hidden = false;
    const m = data.measured;
    const e = data.expected;
    const size = [0, 1, 2].map(i => length(m.bbox.max[i] - m.bbox.min[i]));
    setField('size', size.join(' × ') + ' mm');
    setField('hole', length(data.parameters.hole_diameter) + ' mm');
    const fixed = data.fixed_parameters;
    setField('wall', fixed.wall === fixed.floor_thickness
      ? length(fixed.wall) + ' mm'
      : '壁 ' + length(fixed.wall) + ' mm・底 ' + length(fixed.floor_thickness) + ' mm');
    setField('volume', grouped(m.volume_mm3, 2) + ' mm³');
    setField('volume-note', '解析値 ' + grouped(e.volume_mm3, 2) + ' mm³・差 ' + relPercent(m.volume_mm3, e.volume_mm3) + ' %');
    setField('area', grouped(m.area_mm2, 2) + ' mm²');
    setField('area-note', '解析値 ' + grouped(e.area_mm2, 2) + ' mm²・差 ' + relPercent(m.area_mm2, e.area_mm2) + ' %');
    setField('com', '(' + m.center_of_mass.map(coord).join(', ') + ') mm');
    const comGap = Math.max(...m.center_of_mass.map((v, i) => Math.abs(v - e.center_of_mass[i])));
    setField('com-note', '解析値との差 ' + comGap.toFixed(6) + ' mm');
    const features = data.timeline_features || [];
    const clean = features.every(f => f.error == null && f.warning == null);
    const roundtrip = record.export_roundtrips && record.export_roundtrips[state] && record.export_roundtrips[state].json;
    const bodies = roundtrip ? roundtrip.body_count : null;
    setField('health', (bodies != null ? 'ボディ' + bodies + 'つ・' : '') + features.length + '件' + (clean ? 'とも error / warning なし' : 'に error または warning あり'));
  }

  function filesFor(key) {
    return (record && record.files && record.files[key]) || STATES[key].files;
  }

  function render() {
    const files = filesFor(state);
    tabs.forEach(tab => {
      const selected = tab.dataset.state === state;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', STATES[state].id);
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    shot.src = files[view];
    shot.alt = STATES[state].alt[view];
    $$('[data-file]', panel).forEach(link => {
      const href = files[link.dataset.file];
      if (href) link.setAttribute('href', href);
    });
    renderMetrics();
  }

  function select(key, {focus = false, updateHash = true} = {}) {
    if (!STATES[key]) return;
    state = key;
    render();
    if (focus) tabs.find(tab => tab.dataset.state === key).focus();
    if (updateHash && history.replaceState) history.replaceState(null, '', '#' + STATES[key].id);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => select(tab.dataset.state));
    tab.addEventListener('keydown', event => {
      const index = ORDER.indexOf(tab.dataset.state);
      let next = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = ORDER[(index + 1) % ORDER.length];
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = ORDER[(index - 1 + ORDER.length) % ORDER.length];
      else if (event.key === 'Home') next = ORDER[0];
      else if (event.key === 'End') next = ORDER[ORDER.length - 1];
      if (next === null) return;
      event.preventDefault();
      select(next, {focus: true});
    });
  });

  viewButtons.forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    render();
  }));

  function fromHash() {
    const key = ORDER.find(k => '#' + STATES[k].id === location.hash);
    if (key) select(key, {updateHash: false});
  }
  window.addEventListener('hashchange', fromHash);

  // 2つの状態の画像を先に読み込み、切り替えで待たせない
  ORDER.forEach(key => ['iso', 'top'].forEach(kind => { const image = new Image(); image.src = STATES[key].files[kind]; }));

  function validRecord(data) {
    return data && data.states && ORDER.every(key => {
      const s = data.states[key];
      return s && s.measured && s.measured.bbox && s.expected && s.parameters && s.fixed_parameters;
    });
  }

  fetch('measurements.json', {cache: 'no-cache'})
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(data => {
      if (!validRecord(data)) throw new Error('invalid record');
      record = data;
      metricsStatus.textContent = '';
      render();
    })
    .catch(() => {
      record = null;
      loadFailed = true;
      metricsStatus.textContent = '実測値の記録（measurements.json）を読み込めなかったため、数値を表示していません。画像とファイルは見られます。';
      metricsStatus.classList.add('is-error');
      render();
    });

  // 依頼文のコピー
  const copyButton = $('#copy-request');
  const copyStatus = $('#copy-status');
  const requestText = $('#request-text');

  function copyFallback(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'copy-buffer';
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    area.remove();
    return ok;
  }

  function showCopy(ok) {
    copyStatus.textContent = ok ? 'コピーしました。' : 'コピーできませんでした。上の文を選択してコピーしてください。';
    copyStatus.classList.toggle('is-error', !ok);
    copyStatus.classList.toggle('is-ok', ok);
  }

  copyButton.addEventListener('click', () => {
    const text = requestText.textContent;
    copyStatus.textContent = '';
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => showCopy(true), () => showCopy(copyFallback(text)));
    } else {
      showCopy(copyFallback(text));
    }
  });

  fromHash();
  render();
})();
