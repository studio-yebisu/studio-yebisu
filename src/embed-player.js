/* Standalone, muted video for a shared page or a third-party player frame. */
(() => {
  'use strict';
  const video = document.querySelector('video');
  const button = document.querySelector('.embed-play');
  const error = document.querySelector('.embed-error');
  if (!video || !button || !error) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let manual = false;
  let userPaused = false;
  let visible = true;
  let managedPause = false;
  let pending = false;
  let mediaError = false;
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = !reduced.matches;

  function pause() {
    if (!video.paused) { managedPause = true; video.pause(); }
  }
  function sync() {
    if (mediaError) return;
    const active = visible && !document.hidden && !userPaused && (!reduced.matches || manual);
    if (!active) { pause(); button.hidden = !reduced.matches || manual; return; }
    if (pending || !video.paused) return;
    pending = true;
    Promise.resolve(video.play()).then(() => {
      if (!visible || document.hidden || userPaused || (reduced.matches && !manual)) pause();
      else button.hidden = true;
    }).catch(() => { button.hidden = false; }).finally(() => { pending = false; });
  }
  button.addEventListener('click', () => { manual = true; userPaused = false; sync(); });
  video.addEventListener('play', () => {
    userPaused = false;
    if (!pending) manual = true;
    if (!visible || document.hidden || (reduced.matches && !manual)) pause();
    else button.hidden = true;
  });
  video.addEventListener('pause', () => {
    if (managedPause) managedPause = false;
    else if (!document.hidden && visible) userPaused = true;
  });
  video.addEventListener('error', () => { mediaError = true; error.hidden = false; button.hidden = true; });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => { manual = false; video.autoplay = !reduced.matches; sync(); });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .15; sync(); }, {threshold: .15});
    observer.observe(video);
  }
  sync();
})();
