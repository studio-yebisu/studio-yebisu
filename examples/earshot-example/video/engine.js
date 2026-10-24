(() => {
  'use strict';
  const render = window.__MOTION_RENDER__ === true;
  const canvas = document.getElementById('scene'), ctx = canvas.getContext('2d');
  const message = document.getElementById('message'), controls = document.getElementById('controls');
  const override = window.renderConfig || {};
  const even = n => Math.max(16, Math.round(n / 2) * 2);
  let W = override.width || even(innerWidth), H = override.height || even(innerHeight);
  let timeline, lastTime = 0, raf = 0, audio;
  canvas.width = W; canvas.height = H;
  window.motionConfig = {duration: 30, fps: override.fps || 60, width: W, height: H, posterTime: 28.8, audioEvents: []};
  const paint = t => {
    lastTime = Math.max(0, Math.min(30, Number(t) || 0));
    if (typeof ctx.reset === 'function') ctx.reset();
    else canvas.width = W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    window.drawEarshot(ctx, lastTime, W, H, timeline);
  };
  window.motionReady = Promise.all([
    fetch('timeline.json?v=2').then(r => {if (!r.ok) throw new Error('時刻表を読み込めませんでした'); return r.json();}),
    document.fonts.ready
  ]).then(([data]) => {
    if (typeof window.drawEarshot !== 'function') throw new Error('映像を読み込めませんでした');
    timeline = data;
    window.motionConfig.audioEvents = data.events;
    message.hidden = true;
    paint(0);
  });
  window.seek = async t => {await window.motionReady; paint(t);};
  const fail = error => {message.textContent = error.message || '再生できませんでした'; message.hidden = false;};
  window.motionReady.catch(fail);
  if (render) {controls.remove(); return;}

  const play = document.getElementById('play'), scrub = document.getElementById('scrub');
  const time = document.getElementById('time'), mute = document.getElementById('mute');
  audio = new Audio();
  audio.preload = 'auto'; audio.volume = 0.75;
  let audioReady;
  function prepareAudio() {
    if (!audioReady) audioReady = fetch('../assets/playback.m4a?v=2').then(async response => {
      if (!response.ok) throw new Error('音源を読み込めませんでした');
      const url = URL.createObjectURL(await response.blob());
      await new Promise((resolve, reject) => {
        audio.addEventListener('loadedmetadata', resolve, {once: true});
        audio.addEventListener('error', () => reject(new Error('音源を再生できませんでした')), {once: true});
        audio.src = url; audio.load();
      });
    }).catch(error => {audioReady = undefined; throw error;});
    return audioReady;
  }
  window.earshotAudio = audio;
  function drawCurrent() {
    paint(audio.currentTime); scrub.value = String(audio.currentTime);
    time.value = audio.currentTime.toFixed(1) + ' / 30';
  }
  function stop() {
    audio.pause(); cancelAnimationFrame(raf);
    play.textContent = '▶ Play'; play.setAttribute('aria-pressed', 'false');
  }
  window.pauseEarshot = stop;
  function tick() {drawCurrent(); if (!audio.paused) raf = requestAnimationFrame(tick);}
  play.addEventListener('click', async () => {
    if (!audio.paused) return stop();
    try {
      await window.motionReady;
      await prepareAudio();
      if (audio.ended || audio.currentTime >= 29.99) audio.currentTime = 0;
      message.hidden = true;
      await audio.play();
      parent.postMessage({type: 'earshot-film-play'}, location.origin);
      play.textContent = 'Ⅱ Pause'; play.setAttribute('aria-pressed', 'true');
      cancelAnimationFrame(raf); tick();
    } catch (error) {stop(); fail(error);}
  });
  scrub.addEventListener('input', async () => {
    const requested = Number(scrub.value);
    stop();
    try {await window.motionReady; await prepareAudio(); audio.currentTime = requested; drawCurrent();}
    catch (error) {fail(error);}
  });
  mute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    mute.textContent = audio.muted ? '消音' : '音あり';
    mute.setAttribute('aria-pressed', String(audio.muted));
    mute.setAttribute('aria-label', audio.muted ? '音を出す' : '音を消す');
  });
  audio.addEventListener('ended', () => {stop(); drawCurrent();});
  audio.addEventListener('error', () => {stop(); fail(new Error('音源を読み込めませんでした。再読み込みしてください。'));});
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.source === parent && event.data?.type === 'earshot-pause-film') stop();
  });
  window.addEventListener('resize', () => {
    W = even(innerWidth); H = even(innerHeight); canvas.width = W; canvas.height = H;
    window.motionConfig.width = W; window.motionConfig.height = H;
    if (timeline) paint(lastTime);
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', stop);
  window.motionReady.then(prepareAudio).then(() => {controls.hidden = false;}).catch(fail);
})();
