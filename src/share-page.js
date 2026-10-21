/* The image-card destination uses the same portrait breakpoint as the gallery. */
(() => {
  'use strict';
  const frame = document.querySelector('[data-responsive-player]');
  const download = document.querySelector('[data-responsive-download]');
  if (!frame || !download) return;
  const narrow = matchMedia('(max-width: 699px)');
  function sync() {
    const orientation = narrow.matches ? 'portrait' : 'landscape';
    if (frame.getAttribute('src') !== frame.dataset[orientation]) frame.src = frame.dataset[orientation];
    frame.classList.toggle('is-portrait', narrow.matches);
    frame.classList.toggle('is-landscape', !narrow.matches);
    frame.width = frame.dataset[orientation + 'Width'];
    frame.height = frame.dataset[orientation + 'Height'];
    download.href = download.dataset[orientation];
  }
  narrow.addEventListener('change', sync);
  sync();
})();
