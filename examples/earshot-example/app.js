(() => {
  'use strict';
  const root = document.getElementById('samples'), status = document.getElementById('sample-status');
  const film = document.getElementById('film'), audio = new Audio();
  audio.volume = 0.75; audio.preload = 'none';
  window.earshotSampleAudio = audio;
  let active, ticket = 0;
  const stop = () => {
    ticket++; audio.pause();
    if (active) {active.button.setAttribute('aria-pressed', 'false'); active.button.textContent = '▶'; active.card.classList.remove('is-playing');}
    active = null;
  };
  function el(tag, className, text) {const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node;}
  fetch('video/timeline.json').then(r => {if (!r.ok) throw new Error(); return r.json();}).then(data => {
    for (const [i, row] of data.sounds.entries()) {
      const card = el('article', 'sound'); card.id = row.key;
      const meta = el('div', 'sound-meta'); meta.append(el('span', '', String(i + 1).padStart(2, '0')), el('span', '', row.duration.toFixed(3) + ' SEC'));
      const heading = el('h3', '', row.label), id = el('p', 'sound-id', row.id);
      const actions = el('div', 'sound-actions'), button = el('button', 'sound-play', '▶');
      button.type = 'button'; button.setAttribute('aria-label', row.label + 'を再生'); button.setAttribute('aria-pressed', 'false'); button.dataset.sound = row.key;
      const download = el('a', '', 'WAVを保存 ↗'); download.href = row.file; download.download = row.key + '.wav';
      button.addEventListener('click', async () => {
        if (active?.button === button && !audio.paused) {stop(); status.textContent = '停止しました。'; return;}
        stop(); const mine = ticket;
        film.contentWindow.postMessage({type: 'earshot-pause-film'}, location.origin);
        active = {button, card}; audio.src = row.file; audio.currentTime = 0;
        try {
          await audio.play(); if (mine !== ticket) return;
          button.textContent = 'Ⅱ'; button.setAttribute('aria-pressed', 'true'); card.classList.add('is-playing');
          status.textContent = row.label + 'を再生中。';
        } catch (error) {if (mine === ticket) {stop(); status.textContent = '再生できませんでした。もう一度押してください。';}}
      });
      actions.append(button, download); card.append(meta, heading, id, actions); root.append(card);
    }
    status.textContent = '再生ボタンを押すと音が鳴ります。';
    focusSample();
  }).catch(() => {status.textContent = '音の一覧を読み込めませんでした。再読み込みしてください。';});
  audio.addEventListener('ended', () => {stop(); status.textContent = '再生が終わりました。';});
  function focusSample() {
    const target = document.getElementById(location.hash.slice(1));
    if (target?.classList.contains('sound')) target.scrollIntoView({block: 'center'});
  }
  window.addEventListener('hashchange', focusSample);
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.source === film.contentWindow && event.data?.type === 'earshot-film-play') {stop(); status.textContent = '映像の音を再生しています。';}
  });
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
})();
