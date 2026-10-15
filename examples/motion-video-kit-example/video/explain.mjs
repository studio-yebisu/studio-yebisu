// 解説映像（22秒・1280×720・30fps・無音）：実入力 → 絵コンテ → できた作品 → 別担当の確認 → 試す。
// 作品の画面は、最終の本編MP4から書き出した ../assets/film-XX.png だけを使い、描き直さない。画像が1枚でも欠けたら motionReady を失敗させる。
// 輪郭は本編と同じ SelectionFrame。画面はすべて seek(t) の純粋関数で、画像の要素は作り直さずに属性だけを変える。
import { COLOR, between, smoother, glide, trackRect, selectionFrame, text, rectEl } from '../components.mjs';

const { paper, face, ink, teal, ochre } = COLOR;
const fade = (t, a, d = 0.2) => smoother(between(t, a, a + d));
const group = (o, body, dy = 0) => (o <= 0 ? '' : `<g opacity="${+o.toFixed(3)}"${dy ? ` transform="translate(0 ${+dy.toFixed(2)})"` : ''}>${body}</g>`);
const rise = (t, a, body, o = 1, d = 0.28) => { const p = fade(t, a, d); return group(p * o, body, (1 - p) * 10); };
const scaleRect = (r, s, cx, cy) => [cx + (r[0] - cx) * s, cy + (r[1] - cy) * s, r[2] * s, r[3] * s, ...(r.length > 4 ? [r[4] * s] : [])];
const pushed = (r, s) => scaleRect(r, s, r[0] + r[2] / 2, r[1] + r[3] / 2);
const zoom = (s, cx, cy, body) => `<g transform="translate(${+(cx * (1 - s)).toFixed(3)} ${+(cy * (1 - s)).toFixed(3)}) scale(${+s.toFixed(5)})">${body}</g>`;
const heading = str => text(80, 150, str, { size: 40, weight: 600, family: 'serif' });
const small = (x, y, str, extra = {}) => text(x, y, str, { size: 22, opacity: 0.72, ...extra });
const frameLine = r => rectEl(r, `fill="none" stroke="${ink}" stroke-opacity="0.16" stroke-width="2"`);

// ---- 場面の配置
const CARD = [80, 196, 1120, 380, 20];
const cardRect = t => pushed(CARD, 1 + 0.015 * between(t, 0, 4));
const CELL = i => [80 + i * 140, 200, 124, 124, 12];
const FILM = [80, 186, 832, 468, 8];
const filmRect = t => pushed(FILM, 1 + 0.02 * between(t, 8.95, 13.45));
const THUMB = i => [80 + (i % 4) * 260, i < 4 ? 280 : 455, 240, 135];
const GRID = [64, 264, 1052, 374, 16], gridScale = t => 1 + 0.015 * between(t, 13.95, 17.5);
const gridRect = t => scaleRect(GRID, gridScale(t), 590, 451);
const END = [720, 196, 480, 270, 8];
const endRect = t => pushed(END, 1 + 0.02 * between(t, 18.1, 22));

// 輪郭は入力のカード → 絵コンテの8つの構図を順に → 作品 → 書き出しのフレーム全体 → 最後の画面、と受け渡す。
// 通り道にある文字は、輪郭が動く前に消え、着いてから入る。
const OUTLINE = [{ rect: cardRect }, { t0: 4.25, t1: 4.65, rect: CELL(0) },
  ...[1, 2, 3, 4, 5, 6, 7].map(i => ({ t0: 4.7 + i * 0.45, t1: 5 + i * 0.45, rect: CELL(i) })),
  { t0: 8.55, t1: 8.95, rect: filmRect }, { t0: 13.5, t1: 13.9, rect: gridRect }, { t0: 17.7, t1: 18.1, rect: endRect }];

// ---- 実画像の置き場所（同じ画像でも場所ごとに別の要素）。
const KEYS = ['00', '03', '05', '09', '12', '15', '18'];
const SRC = k => new URL(`../assets/film-${k}.png`, import.meta.url).href;
const filmOn = t => fade(t, 8.55, 0.25) * (1 - fade(t, 13.45));
const PLACES = [
  { key: '00', rect: filmRect, o: filmOn },
  { key: '03', rect: filmRect, o: t => filmOn(t) * fade(t, 10) },
  { key: '05', rect: filmRect, o: t => filmOn(t) * fade(t, 11.2) },
  { key: '12', rect: filmRect, o: t => filmOn(t) * fade(t, 12.4) },
  ...KEYS.map((key, i) => ({ key, rect: t => scaleRect(THUMB(i), gridScale(t), 590, 451), o: t => fade(t, 13.45 + i * 0.05) * (1 - fade(t, 17.55)) })),
  { key: '18', rect: endRect, o: t => fade(t, 17.6, 0.25) },
];

// ---- 絵コンテの8つの構図（storyboard.md の構図を、1920×1080 の座標の簡単な図形で描いて縮める）。
const CARDS6 = [[1056, 168], [1452, 168], [1056, 444], [1452, 444], [1056, 720], [1452, 720]];
const box = (r, fill, o = 1, extra = '') => rectEl(r, `rx="${Math.min(40, r[3] / 2)}" fill="${fill}" opacity="${o}" ${extra}`);
const grid6 = (motion = 'none') => CARDS6.map(([x, y], i) => box([x, y, 372, 252], i === 2 && motion !== 'none' ? motion : face, 1, `stroke="${ink}" stroke-opacity="0.25" stroke-width="12"`)).join('');
const PICTO = [
  box([96, 380, 760, 110], ink, 0.55) + box([96, 530, 640, 110], ink, 0.55) + grid6() + rectEl([1056, 444, 372, 252], `rx="20" fill="none" stroke="${teal}" stroke-width="36"`),
  box([119, 232, 40, 660], ink, 0.2) + box([592, 160, 1184, 802], ochre, 1, `stroke="${teal}" stroke-width="36"`) + box([656, 240, 560, 110], ink, 0.6),
  box([560, 96, 1264, 888], face) + box([560, 96, 1264, 120], ochre) + [0, 1, 2, 3].map(i => box([600, 248 + i * 176, 1184, 152], ink, 0.1)).join('') + box([1432, 296, 312, 56], teal, 0.6),
  box([560, 96, 1264, 888], face) + box([608, 196, 620, 40], ink, 0.3) + box([608, 300, 520, 80], ink, 0.6) + box([600, 432, 580, 472], ink, 0.12) + box([1204, 432, 580, 472], ink, 0.12),
  box([592, 160, 1176, 672], face) + box([656, 250, 1000, 100], ink, 0.6) + box([656, 380, 700, 100], ink, 0.6) + box([656, 500, 588, 30], ochre),
  box([592, 112, 1200, 104], face) + box([592, 240, 1200, 744], face) + box([700, 360, 360, 120], ink, 0.4) + box([1150, 360, 560, 520], ink, 0.12),
  box([560, 120, 1264, 456], face) + box([1420, 452, 360, 88], ink) + box([560, 608, 620, 280], face) + box([1204, 608, 620, 280], face),
  box([176, 330, 720, 100], ink, 0.6) + box([176, 460, 760, 100], ink, 0.6) + box([176, 640, 656, 176], teal) + grid6(ochre),
];
const NAMES = ['表紙', '接写', '一覧', '記事', '引用', '入力と結果', '依頼文の節', 'CTA'];
function storyboard(t, o) {
  let cells = '', labels = '';
  PICTO.forEach((p, i) => {
    const [x, y] = CELL(i), shape = fade(t, 4.15 + i * 0.03);
    cells += group(shape * o, rectEl(CELL(i), `rx="12" fill="${face}" stroke="${ink}" stroke-opacity="0.16" stroke-width="2"`)
      + `<g transform="translate(${x + 10} ${y + 33}) scale(${104 / 1920})"><rect width="1920" height="1080" fill="${paper}"/>${p}</g>`);
    labels += text(x, 356, `S0${i + 1}`, { size: 22, weight: 700, fill: teal }) + small(x, 386, NAMES[i], { size: 20 });
  });
  // 名前は、輪郭が作品の枠へ広がって下の辺が通る前（8.30–8.50）に消える。
  return cells + rise(t, 4.75, labels, 1 - fade(t, 8.3));
}

function beats(t) {
  let s = '';
  // 1. 実入力（frame0 で完成）。中身は輪郭が動く前に消える。
  const b1 = 1 - fade(t, 4, 0.2);
  if (t < 4.4) {
    const c = 1 + 0.015 * between(t, 0, 4), chips = ['依頼', '確認済みの事実', '見る人・次の行動', 'ブランド・条件', '原典の適用'];
    let row = '', x = 120;
    chips.forEach(label => { const w = label.length * 20 + 32; row += rectEl([x, 500, w, 40], `rx="20" fill="${teal}" fill-opacity="0.1"`) + text(x + 16, 527, label, { size: 20, fill: teal }); x += w + 12; });
    s += group(1 - fade(t, 4.15), rectEl(cardRect(t), `rx="${20 * c}" fill="${face}" stroke="${ink}" stroke-opacity="0.16" stroke-width="2"`));
    s += group(b1, heading('1　実際の入力から始める') + zoom(c, 640, 386, small(120, 252, 'input.md の「依頼」より')
      + text(120, 346, '「Studio Yebisuの公開サイトを紹介する', { size: 44, weight: 600, family: 'serif' })
      + text(120, 418, '20秒の短いコード動画を作ってください。」', { size: 44, weight: 600, family: 'serif' })
      + rectEl([120, 434, 600, 8], `fill="${ochre}"`) + row));
  }
  // 2. 絵コンテ。8つの構図の面は輪郭が動き出す前に在る。
  if (t >= 4.1 && t < 8.8) {
    const o = 1 - fade(t, 8.5);
    s += rise(t, 4.35, heading('2　絵コンテで、8つの構図を先に決める'), 1 - fade(t, 8.4)) + storyboard(t, o);
    s += rise(t, 4.75, text(80, 480, '1本の輪郭を、表紙のカードから「作例を見る」まで受け渡す', { size: 30, weight: 500 }), 1 - fade(t, 8.4));
  }
  // 3. できた作品。右の説明は輪郭が着いてから入る。
  if (t >= 8.5 && t < 13.7) {
    const out = 1 - fade(t, 13.3), shown = [[0, '0秒'], [10, '3秒'], [11.2, '5秒'], [12.4, '12秒']];
    s += group(filmOn(t), frameLine(filmRect(t)));
    s += rise(t, 8.75, heading('3　できた作品：20秒・無音の映像'), out);
    let times = '';
    shown.forEach(([a, label], i) => { const next = shown[i + 1]; times += group(fade(t, a) * (next ? 1 - fade(t, next[0]) : 1), text(944, 340, label, { size: 44, weight: 700, fill: teal })); });
    s += rise(t, 9, small(944, 236, '本編のMP4から') + small(944, 266, '書き出したフレーム') + times + small(944, 380, '1920×1080・60fps'), out);
  }
  // 4. 別担当の確認。文と時刻は輪郭が全体を囲んでから入る。
  if (t >= 13.4 && t < 17.8) {
    const out = 1 - fade(t, 17.45), k = gridScale(t);
    s += rise(t, 13.6, heading('4　作った担当とは別のAIが、書き出しを確かめる'), out);
    s += rise(t, 13.95, text(80, 232, '部品は実際のMP4を別担当のAIが見て、指摘を直してから本編へ入れた', { size: 28, weight: 500 }), out);
    s += zoom(k, 590, 451, KEYS.map((key, i) => { const r = THUMB(i); return group(fade(t, 13.45 + i * 0.05) * (1 - fade(t, 17.55)), frameLine(r))
      + rise(t, 14 + i * 0.04, small(r[0], r[1] + 161, `${Number(key)}秒`, { size: 20 }), out); }).join(''));
  }
  // 5. 試す（最後まで読める）。
  if (t >= 17.6) {
    s += group(fade(t, 17.6, 0.25), frameLine(endRect(t))) + rise(t, 17.85, heading('5　依頼文をコピーして、自分の事実で試す'));
    s += rise(t, 18.2, text(80, 300, '記事の依頼文をコピーし、', { size: 30, weight: 500 }) + text(80, 346, '事実と条件を自分のものへ。', { size: 30, weight: 500 }));
    s += rise(t, 18.3, small(720, 496, '本編の18秒'));
  }
  return s;
}

/** 時刻 t の画像以外の層（SVG の中身）。 */
function overlay(t) {
  let s = text(80, 64, 'Motion Video Kit の使用例', { size: 22, weight: 700, fill: teal }) + small(1200, 64, '解説・22秒・無音', { anchor: 'end' });
  s += beats(t);
  s += selectionFrame({ id: 'sel', rect: trackRect(t, OUTLINE), orbit: { phase: t * 0.3, length: 0.06 } });
  [0, 4.4, 8.8, 13.6, 18].forEach((a, i, all) => {
    const x = 80 + i * 228, b = all[i + 1] ?? 22;
    s += rectEl([x, 668, 212, 4], `fill="${ink}" opacity="0.14"`) + rectEl([x, 668, 212 * between(t, a, b), 4], `fill="${teal}"`);
  });
  return s;
}

export function start() {
  const rc = window.renderConfig || {};
  const config = { duration: 22, fps: rc.fps || 30, width: rc.width || 1280, height: rc.height || 720, posterTime: 11, audioEvents: [] };
  window.motionConfig = config;
  const NS = 'http://www.w3.org/2000/svg';
  const stage = document.getElementById('stage'), range = document.getElementById('time');
  const readout = document.getElementById('readout'), play = document.getElementById('play'), notice = document.getElementById('notice');
  stage.innerHTML = `<rect width="1280" height="720" fill="${paper}"/><g id="imgs"></g><g id="fg"></g>`;
  const imgs = stage.querySelector('#imgs'), fg = stage.querySelector('#fg');
  const nodes = PLACES.map(() => imgs.appendChild(document.createElementNS(NS, 'image')));
  const missing = k => new Error(`必要な画像 assets/film-${k}.png を読み込めません。本編のMP4から書き出してください。`);
  const loads = PLACES.map((p, i) => new Promise((resolve, reject) => {
    const el = nodes[i];
    el.setAttribute('preserveAspectRatio', 'none');
    el.setAttribute('opacity', '0');
    el.addEventListener('load', resolve, { once: true });
    el.addEventListener('error', () => reject(missing(p.key)), { once: true });
    el.setAttribute('href', SRC(p.key));
  }));
  const decodes = KEYS.map(k => {
    const img = new Image();
    img.src = SRC(k);
    return img.decode().then(() => {
      if (!img.naturalWidth || img.naturalWidth * 9 !== img.naturalHeight * 16) throw new Error(`assets/film-${k}.png の縦横比が16:9ではありません。`);
    }, () => { throw missing(k); });
  });
  let now = 0, raf = 0, last = 0;
  window.seek = t => {
    now = Math.min(config.duration, Math.max(0, Number(t) || 0));
    PLACES.forEach((p, i) => {
      const o = p.o(now), [x, y, w, h] = p.rect(now), el = nodes[i];
      el.setAttribute('opacity', String(+o.toFixed(3)));
      [['x', x], ['y', y], ['width', w], ['height', h]].forEach(([k, v]) => el.setAttribute(k, String(+v.toFixed(2))));
    });
    fg.innerHTML = overlay(now);
    range.value = String(now);
    readout.value = now.toFixed(2) + '秒';
  };
  window.seek(0);
  const fonts = ['600 40px "Yu Mincho"', '500 30px "Yu Gothic"', '700 22px "Yu Gothic"'].map(f => document.fonts.load(f).catch(() => []));
  window.motionReady = Promise.all([...fonts, ...decodes, ...loads]).then(() => document.fonts.ready).then(() => window.seek(now));
  if (window.__MOTION_RENDER__) { document.documentElement.classList.add('render'); return; }
  window.motionReady.catch(error => { notice.hidden = false; notice.textContent = error.message; });

  range.max = String(config.duration);
  range.step = String(1 / config.fps);
  const stop = () => { cancelAnimationFrame(raf); raf = 0; last = 0; play.textContent = '再生'; play.setAttribute('aria-pressed', 'false'); };
  const tick = ts => {
    if (window.__MOTION_RENDER__) return stop();
    if (last) {
      const next = now + (ts - last) / 1000;
      if (next >= config.duration) { window.seek(config.duration); return stop(); }
      window.seek(next);
    }
    last = ts;
    raf = requestAnimationFrame(tick);
  };
  const toggle = () => {
    if (raf) return stop();
    if (now >= config.duration) window.seek(0);
    play.textContent = '一時停止';
    play.setAttribute('aria-pressed', 'true');
    raf = requestAnimationFrame(tick);
  };
  play.addEventListener('click', toggle);
  range.addEventListener('input', () => { stop(); window.seek(range.value); });
  stage.addEventListener('keydown', e => {
    const step = e.shiftKey ? 1 : 1 / config.fps;
    const keys = { ' ': toggle, k: toggle, ArrowLeft: () => window.seek(now - step), ArrowRight: () => window.seek(now + step),
      Home: () => window.seek(0), End: () => window.seek(config.duration) };
    if (!keys[e.key]) return;
    e.preventDefault();
    if (keys[e.key] !== toggle) stop();
    keys[e.key]();
  });
}
