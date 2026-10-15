/* 受け止めた瞬間の、青い防御ヒット — original Studio Yebisu composition (MIT). Canvas only.
   Every picture of the effect is a PNG Godot rendered during production, listed in ../capture-manifest.json,
   plus the first-pass ../assets/first-pass-f016.png. Nothing here draws or imitates the effect itself.
   Contract (Motion Reel): window.seek(seconds) rebuilds the complete frame from t alone. No timers, no CSS
   animation, no state carried between calls. A source frame is derived directly from seconds. */
(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const overrides = window.renderConfig || {};
  window.motionConfig = {
    duration: 28,
    fps: overrides.fps || 30,
    width: overrides.width || 1280,
    height: overrides.height || 720,
    posterTime: 16.6,
    audioEvents: []
  };
  canvas.width = window.motionConfig.width;
  canvas.height = window.motionConfig.height;

  const D = 28;
  // The composition is laid out on a 1280×720 stage and scaled (letterboxed) to the render size.
  const STAGE = {w: 1280, h: 720};
  const SRC_FPS = 60, LAST = 30;

  const C = {
    paper: '#f3f0e6', sheet: '#fbfaf5', ink: '#18212d', soft: '#556070', rule: 'rgba(24,33,45,0.2)',
    stage: '#0f1622', blue: '#2a63c9', blueSoft: '#d8e4f7', blueMid: '#b9c9e6', grey: '#e1e4ea',
    accent: '#b8430f', tagBg: 'rgba(10,16,26,0.84)', tagInk: '#e3ebf6'
  };
  const GOTHIC = '"Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
  const MINCHO = '"Yu Mincho", "Hiragino Mincho ProN", "BIZ UDPMincho", serif';
  const MONO = '"Cascadia Mono", Consolas, Menlo, "BIZ UDGothic", monospace';

  // Source rectangles in capture pixels (1280×800). guard keeps the 16:10 shape so the camera can zoom into it.
  const RECT = {
    full: {x: 0, y: 0, w: 1280, h: 800},
    guard: {x: 180, y: 280, w: 480, h: 300},
    tight: {x: 290, y: 330, w: 270, h: 240}
  };

  const SCENES = [
    {id: 'title', from: 0, to: 3.6, label: ''},
    {id: 'request', from: 3.6, to: 7.0, label: '01　依頼'},
    {id: 'normal', from: 7.0, to: 10.0, label: '02　等速'},
    {id: 'slow', from: 10.0, to: 14.8, label: '03　スロー再生'},
    {id: 'keys', from: 14.8, to: 17.4, label: '04　要所のフレーム'},
    {id: 'made', from: 17.4, to: 19.8, label: '05　作り方'},
    {id: 'fix', from: 19.8, to: 24.4, label: '06　見て直す'},
    {id: 'close', from: 24.4, to: 28.0, label: '07　ファイルと次の一歩'}
  ];

  // Normal speed: whole stage, then the camera moves in and the same 0.5 s plays again.
  const NORMAL = {fullPlay: 7.5, zoomFrom: 8.5, zoomTo: 8.9, cropPlay: 8.9};
  // Slow replay: playback speed 1/8 (0.5 s shown over 4 s). Frame labels stay in source time.
  const SLOW = {play: 10.4, speed: 1 / 8};

  const PHASES = [
    {from: 0, to: 1, name: '開始前', text: 'まだ何も出ていない'},
    {from: 2, to: 3, name: '輪郭', text: '薄い輪郭が下から伸びる'},
    {from: 4, to: 5, name: '接点', text: '輪郭がほぼ一周し、白い星'},
    {from: 6, to: 8, name: '接点から青い面へ', text: 'いちばん明るい数フレーム'},
    {from: 9, to: 12, name: '波紋', text: '青い面に波紋が広がる'},
    {from: 13, to: 17, name: '割れる', text: '隙間で6枚の破片に分かれる'},
    {from: 18, to: 23, name: '破片', text: '離れながら薄くなる'},
    {from: 24, to: 29, name: '消えていく', text: '残りが薄れて消える'},
    {from: 30, to: 30, name: '消失', text: '何も残らない'}
  ];
  // Layer groups by recipe frame (inclusive), as in the brief's layer plan; drawn as bands under the slow replay.
  const BANDS = [
    {from: 0, to: 6, color: C.grey},
    {from: 4, to: 8, color: '#ffffff'},
    {from: 4, to: 17, color: C.blueSoft},
    {from: 13, to: 28, color: C.blueMid}
  ];
  const KEYS = [
    {frame: 2, label: '輪郭が伸びる'},
    {frame: 6, label: '白い接点'},
    {frame: 10, label: '青い面の波紋'},
    {frame: 16, label: '隙間が開く'},
    {frame: 23, label: '離れる破片'},
    {frame: 30, label: '何も残らない'}
  ];
  const CHAIN = ['薄い盾の輪郭', '短い白い接点', '青い面の波紋', '隙間を開けた破片', '消失'];
  const BEATS = [['f2', '輪郭が伸びる'], ['f5', '白い星'], ['f10', '青い面と波紋'], ['f16', '6枚に割れる'], ['f23', '離れる破片'], ['f30', '何も残らない']];
  // Excerpt from ../library/vfx/src/VFX_Yebisu_Guard.py (Guard face); omitted fields are marked with an ellipsis.
  const CODE = [
    "dict(name='Guard face',",
    "  renderer='Ring',life=14,delay=4,",
    "  ring=dict(vertices=96,",
    "    outer_color=[215,238,255,255],",
    "    center_color=[80,150,255,185],",
    "    inner_color=[45,105,235,45]),",
    "  alpha_texture=tex('T_NoiseTile02'),",
    "  cutoff=dict(start=.05,end=.9,",
    "    easing='EaseInQuadratic'), …)"
  ];
  const FIX = [
    {at: 20.1, head: '1回目', body: '白い破片が、接点のあとにも光る。'},
    {at: 20.9, head: '原因', body: 'Ringは固定の頂点色で描く。'},
    {at: 21.8, head: '2回目', body: '頂点色を青と紺に変更。'},
    {at: 22.7, head: '3回目', body: '効かない色の指定を削除。'}
  ];

  /* ---------- Loading: the capture manifest and every referenced PNG ---------- */

  const data = {frames: [], before: null, ok: false, error: ''};

  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(img));
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  window.motionReady = (async () => {
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const res = await fetch('../capture-manifest.json');
      if (!res.ok) throw new Error('capture-manifest.json ' + res.status);
      const manifest = await res.json();
      const paths = [];
      for (let f = 0; f <= LAST; f++) {
        const entry = (manifest.frames || []).find(x => x.frame === f);
        if (!entry) throw new Error('f' + f + ' がマニフェストにありません');
        paths.push('../' + entry.path);
      }
      paths.push('../assets/first-pass-f016.png');
      const images = await Promise.all(paths.map(loadImage));
      const missing = images.map((im, i) => (im ? null : paths[i])).filter(Boolean);
      if (missing.length) throw new Error('読み込めない画像 ' + missing.join(', '));
      data.frames = images.slice(0, LAST + 1);
      data.before = images[LAST + 1];
      data.ok = true;
    } catch (err) {
      data.error = String(err && err.message ? err.message : err);
      window.seek(0);
      throw err;
    }
  })();

  /* ---------- Helpers ---------- */

  const clamp01 = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpRect = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k)});
  const appear = (t, at, dur = 0.35) => ease((t - at) / dur);
  // Source frame at time t for a playback that starts at `start` with `speed`; clamped to f0..f30.
  const playFrame = (t, start, speed) => Math.max(0, Math.min(LAST, Math.floor((t - start) * SRC_FPS * speed + 1e-6)));
  const secs = f => (f / SRC_FPS).toFixed(3) + '秒';
  const phaseOf = f => PHASES.find(p => f >= p.from && f <= p.to);

  function font(size, weight = 400, family = GOTHIC) { return weight + ' ' + size + 'px ' + family; }
  function text(str, x, y, o = {}) {
    ctx.font = font(o.size || 24, o.weight || 400, o.family || GOTHIC);
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.fillText(str, x, y);
  }
  const NO_START = '、。，．）」』】ー・：？！ぁぃぅぇぉっゃゅょ…';
  function wrap(str, maxW) {
    const lines = [];
    let line = '';
    for (const ch of str) {
      const test = line + ch;
      if (line && ctx.measureText(test).width > maxW) {
        if (NO_START.includes(ch)) { lines.push(line.slice(0, -1)); line = line.slice(-1) + ch; }
        else { lines.push(line); line = ch; }
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  // Draws wrapped text and returns the y below it.
  function para(str, x, y, maxW, o = {}) {
    const size = o.size || 24, lh = o.lh || Math.round(size * 1.6);
    ctx.font = font(size, o.weight || 400, o.family || GOTHIC);
    const lines = wrap(str, maxW);
    lines.forEach((l, i) => text(l, x, y + i * lh, o));
    return y + lines.length * lh;
  }
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  // Draws fn at k times the current opacity; nothing at 0.
  function faded(k, fn) {
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha *= k;
    fn();
    ctx.restore();
  }
  function frameBox(x, y, w, h, color = C.ink, width = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.strokeRect(x + width / 2, y + width / 2, w - width, h - width);
  }
  // One real capture drawn from a source rectangle into a box, with its provenance tag inside the image.
  function capture(img, src, x, y, w, h, tag) {
    rect(x, y, w, h, C.stage);
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, src.x, src.y, src.w, src.h, x, y, w, h);
    }
    frameBox(x, y, w, h);
    if (tag) {
      ctx.font = font(18, 400);
      const tw = ctx.measureText(tag).width;
      rect(x + 10, y + h - 40, tw + 20, 30, C.tagBg);
      text(tag, x + 20, y + h - 18, {size: 18, color: C.tagInk});
    }
  }
  function chrome(scene) {
    text(scene.label, 60, 52, {size: 22, weight: 700, color: C.accent});
    text('Effekseer VFX の作例　Studio Yebisu', STAGE.w - 60, 52, {size: 18, color: C.soft, align: 'right'});
    rect(60, 68, STAGE.w - 120, 2, C.ink);
  }
  function counter(f, x, y) {
    text('f' + f, x, y, {size: 54, weight: 700, family: MONO});
    text(secs(f), x, y + 40, {size: 26, family: MONO, color: C.soft});
  }

  /* ---------- Scenes ---------- */

  const PANEL = {x: 60, y: 104, w: 832, h: 520};

  function sceneTitle(t) {
    text('Effekseer VFX の作例　ゲーム', 70, 150, {size: 22, color: C.soft});
    text('受け止めた瞬間だけ光る、', 70, 238, {size: 48, weight: 700, family: MINCHO});
    text('青い防御ヒット', 70, 308, {size: 48, weight: 700, family: MINCHO});
    rect(70, 340, 80, 4, C.accent);
    para('AIが書いたレシピをEffekseerでビルドし、Godotで実際に描画した0.5秒です。', 70, 404, 530, {size: 26, lh: 44});
    capture(data.frames[10], RECT.guard, 690, 150, 530, 331, 'Godot 4.7 の実際の描画（切り抜き）');
    text('f10　0.167秒', 690, 520, {size: 22, family: MONO, color: C.soft});
    text('原典：kanaworksai-hue/effekseer-vfx-skill', 70, 650, {size: 20, color: C.soft});
  }

  function sceneRequest(t) {
    text('依頼（架空）', 60, 140, {size: 24, weight: 700, color: C.accent});
    para('架空のアクションゲームで、攻撃を受け止めた瞬間だけ出る青い防御ヒット。約0.5秒。', 60, 206, 1120, {size: 36, weight: 700, family: MINCHO, lh: 58});
    const bw = 200, gap = 40, y = 340;
    CHAIN.forEach((label, i) => {
      const k = appear(t, 4.4 + i * 0.3);
      faded(k, () => {
        const x = 60 + i * (bw + gap), dy = (1 - k) * 12;
        rect(x, y + dy, bw, 72, i === 1 ? '#ffffff' : (i === 4 ? C.paper : C.blueSoft));
        frameBox(x, y + dy, bw, 72);
        text(label, x + bw / 2, y + 46 + dy, {size: 22, weight: 700, align: 'center'});
        if (i < CHAIN.length - 1) text('→', x + bw + gap / 2, y + 46, {size: 26, align: 'center', color: C.soft});
      });
    });
    faded(appear(t, 6.0), () => text('キャラクターを隠さない。一回のガード反応。', 60, 520, {size: 30, weight: 700}));
  }

  function sceneNormal(t) {
    let f, src, tag;
    if (t < NORMAL.zoomFrom) {
      f = t < NORMAL.fullPlay ? 0 : playFrame(t, NORMAL.fullPlay, 1);
      src = RECT.full;
      tag = 'Godot 4.7 の実際の描画（舞台全体）';
    } else if (t < NORMAL.zoomTo) {
      const k = ease((t - NORMAL.zoomFrom) / (NORMAL.zoomTo - NORMAL.zoomFrom));
      f = 0;
      src = lerpRect(RECT.full, RECT.guard, k);
      tag = k < 0.5 ? 'Godot 4.7 の実際の描画（舞台全体）' : 'Godot 4.7 の実際の描画（切り抜き）';
    } else {
      f = playFrame(t, NORMAL.cropPlay, 1);
      src = RECT.guard;
      tag = 'Godot 4.7 の実際の描画（切り抜き）';
    }
    capture(data.frames[f], src, PANEL.x, PANEL.y, PANEL.w, PANEL.h, tag);
    const x = 940;
    text('等速', x, 170, {size: 44, weight: 700, family: MINCHO});
    para('実際の速さで、0.5秒。', x, 222, 280, {size: 24});
    counter(f, x, 340);
    para('左のダミーが受け止める側。白い接点は f4〜f8 の短い光です。', x, 470, 280, {size: 21, color: C.soft, lh: 34});
    text('音声なし', PANEL.x, 668, {size: 18, color: C.soft});
  }

  function bandsBar(f, x, y, w) {
    const col = w / (LAST + 1);
    BANDS.forEach((b, i) => rect(x + b.from * col, y + i * 11, (b.to - b.from + 1) * col, 9, b.color));
    frameBox(x, y - 3, w, BANDS.length * 11 + 4, C.rule);
    rect(x + (f + 0.5) * col - 1.5, y - 8, 3, BANDS.length * 11 + 14, C.accent);
    [0, 10, 20, 30].forEach(n => text('f' + n, x + (n + 0.5) * col, y + BANDS.length * 11 + 26, {size: 18, family: MONO, color: C.soft, align: 'center'}));
  }

  function sceneSlow(t) {
    const f = t < SLOW.play ? 0 : playFrame(t, SLOW.play, SLOW.speed);
    // Same 16:10 shape as the source rectangle, a little smaller to leave room for the layer bands.
    const w = 760, h = 475;
    capture(data.frames[f], RECT.guard, PANEL.x, PANEL.y, w, h, 'Godot 4.7 の実際の描画（切り抜き）');
    bandsBar(f, PANEL.x, PANEL.y + h + 22, w);
    const x = 870, cw = 350, p = phaseOf(f);
    text('スロー再生', x, 170, {size: 40, weight: 700, family: MINCHO});
    para('1/8の速さ。0.5秒を4秒で見せます。', x, 218, cw, {size: 22, lh: 34});
    counter(f, x, 350);
    para('番号と秒は、元の60FPSの時刻のまま。', x, 428, cw, {size: 18, color: C.soft, lh: 28});
    rect(x, 476, cw, 2, C.ink);
    text(p.name, x, 522, {size: 30, weight: 700, color: C.blue, family: MINCHO});
    para(p.text, x, 564, cw, {size: 22, lh: 34});
  }

  function sceneKeys(t) {
    text('要所の6フレーム', 60, 116, {size: 30, weight: 700, family: MINCHO});
    text('すべてGodotの実際の描画を、同じ範囲で切り抜いたもの', 320, 114, {size: 20, color: C.soft});
    const w = 360, h = 225, gx = 30, gy = 22;
    KEYS.forEach((k, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 70 + col * (w + gx), y = 146 + row * (h + 48 + gy);
      faded(appear(t, 14.95 + i * 0.12, 0.3), () => {
        capture(data.frames[k.frame], RECT.guard, x, y, w, h, '');
        text('f' + k.frame, x, y + h + 34, {size: 24, weight: 700, family: MONO, color: C.blue});
        text(k.label, x + 72, y + h + 33, {size: 22, weight: 700});
        text(secs(k.frame), x + w, y + h + 33, {size: 18, family: MONO, color: C.soft, align: 'right'});
      });
    });
  }

  function sceneMade(t) {
    text('ブリーフ → レシピ → 実際の描画', 60, 122, {size: 30, weight: 700, family: MINCHO});
    const cols = [{x: 60, w: 320, at: 17.5}, {x: 410, w: 440, at: 17.9}, {x: 880, w: 340, at: 18.3}];
    const y = 168;
    cols.forEach((c, i) => faded(appear(t, c.at, 0.3), () => {
      if (i === 0) {
        text('ブリーフ', c.x, y + 26, {size: 24, weight: 700});
        text('要所のフレームを先に決める', c.x, y + 60, {size: 18, color: C.soft});
        BEATS.forEach(([fr, label], j) => {
          const yy = y + 112 + j * 52;
          rect(c.x, yy - 34, c.w, 1, C.rule);
          text(fr, c.x, yy, {size: 22, weight: 700, family: MONO, color: C.blue});
          text(label, c.x + 70, yy, {size: 22});
        });
      } else if (i === 1) {
        text('レシピ（Python・抜粋）', c.x, y + 26, {size: 24, weight: 700});
        text('VFX_Yebisu_Guard.py の青い面', c.x, y + 60, {size: 18, color: C.soft});
        rect(c.x, y + 80, c.w, 360, C.sheet);
        frameBox(c.x, y + 80, c.w, 360, C.rule);
        CODE.forEach((line, j) => text(line, c.x + 16, y + 118 + j * 37, {size: 18, family: MONO}));
      } else {
        text('Godotで描画', c.x, y + 26, {size: 24, weight: 700});
        text('Effekseer Core でビルドして再生', c.x, y + 60, {size: 18, color: C.soft});
        capture(data.frames[10], RECT.guard, c.x, y + 80, c.w, Math.round(c.w / 1.6), '実際の描画（切り抜き）');
        text('f10　0.167秒', c.x, y + 80 + Math.round(c.w / 1.6) + 34, {size: 20, family: MONO, color: C.soft});
        para('60FPSで f0〜f30 を撮り、画像を開いて見る。', c.x, y + 80 + Math.round(c.w / 1.6) + 84, c.w, {size: 22, lh: 34});
      }
    }));
  }

  function sceneFix(t) {
    text('f16 の破片を、白から青へ', 60, 122, {size: 30, weight: 700, family: MINCHO});
    const w = 300, h = Math.round(w * 240 / 270), y = 168;
    capture(data.before, RECT.tight, 60, y, w, h, '');
    capture(data.frames[16], RECT.tight, 384, y, w, h, '');
    text('1回目　f16', 60, y + h + 34, {size: 22, weight: 700});
    text('破片が白い', 60, y + h + 66, {size: 22});
    text('最終　f16', 384, y + h + 34, {size: 22, weight: 700, color: C.blue});
    text('破片が青い', 384, y + h + 66, {size: 22});
    para('どちらもGodotの実際の描画を、同じ範囲で切り抜いたもの', 60, y + h + 118, 624, {size: 18, color: C.soft});
    // Positions depend only on the text, so every item has a fixed place whether or not it is visible yet.
    let yy = 170;
    FIX.forEach(item => {
      const top = yy;
      ctx.font = font(22);
      const lines = wrap(item.body, 380).length;
      faded(appear(t, item.at, 0.3), () => {
        rect(740, top - 4, 480, 1, C.rule);
        text(item.head, 740, top + 32, {size: 22, weight: 700, color: item.head === '原因' ? C.accent : C.ink});
        para(item.body, 840, top + 32, 380, {size: 22, lh: 34});
      });
      yy = top + 32 + lines * 34 + 18;
    });
  }

  function sceneClose(t) {
    text('作例で、1フレームずつ確かめる', 60, 130, {size: 34, weight: 700, family: MINCHO});
    const items = [
      ['別のAIの採点', 'ship（人の承認ではありません）'],
      ['Godotでの呼び出し', 'TestApi.gd の12項目が通過'],
      ['未確認', 'ゲームへの組み込み・実機での性能']
    ];
    items.forEach(([head, body], i) => {
      const yy = 196 + i * 62;
      rect(60, yy - 36, 600, 1, C.rule);
      text(head, 60, yy, {size: 22, weight: 700, color: i === 2 ? C.accent : C.ink});
      text(body, 270, yy, {size: 22});
    });
    rect(60, 360, 600, 1, C.rule);
    faded(appear(t, 25.0, 0.4), () => {
      text('公開したファイル', 60, 414, {size: 22, weight: 700});
      text('レシピ・ブリーフ・.efk・0.5秒の動画', 60, 452, {size: 24});
    });
    faded(appear(t, 25.8, 0.4), () => {
      rect(60, 490, 600, 70, C.ink);
      text('レシピを変えたら、改めてレビューする', 84, 535, {size: 26, weight: 700, color: C.sheet});
    });
    capture(data.frames[10], RECT.guard, 720, 104, 500, 312, 'Godot 4.7 の実際の描画（切り抜き）');
    const sw = 158, sh = Math.round(sw / 1.6);
    [6, 16, 23].forEach((fr, i) => {
      const x = 720 + i * (sw + 13);
      capture(data.frames[fr], RECT.guard, x, 432, sw, sh, '');
      text('f' + fr, x, 432 + sh + 28, {size: 18, family: MONO, color: C.soft});
    });
    text('原典：kanaworksai-hue/effekseer-vfx-skill（c289198、MIT）　制作：Studio Yebisu', 60, 668, {size: 18, color: C.soft});
  }

  const DRAW = {title: sceneTitle, request: sceneRequest, normal: sceneNormal, slow: sceneSlow, keys: sceneKeys, made: sceneMade, fix: sceneFix, close: sceneClose};

  /* ---------- seek ---------- */

  window.seek = seconds => {
    const t = Math.max(0, Math.min(D, Number(seconds) || 0));
    const W = canvas.width, H = canvas.height;
    const s = Math.min(W / STAGE.w, H / STAGE.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    rect(0, 0, W, H, C.paper);
    ctx.setTransform(s, 0, 0, s, (W - STAGE.w * s) / 2, (H - STAGE.h * s) / 2);

    if (!data.ok) {
      text(data.error ? '素材を読み込めませんでした' : '読み込み中', 60, 320, {size: 36, weight: 700, family: MINCHO, color: data.error ? C.accent : C.ink});
      if (data.error) para(data.error, 60, 380, 1160, {size: 20, color: C.soft});
      return {time: t, scene: null, ready: false};
    }

    const index = Math.max(0, SCENES.findIndex(sc => t >= sc.from && t < sc.to));
    const scene = t >= D ? SCENES[SCENES.length - 1] : SCENES[index];
    const first = scene === SCENES[0], last = scene === SCENES[SCENES.length - 1];
    const fadeIn = first ? 1 : ease((t - scene.from) / 0.25);
    const fadeOut = last ? 1 : ease((scene.to - t) / 0.25);
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    if (scene.label) chrome(scene);
    DRAW[scene.id](t);
    ctx.globalAlpha = 1;
    return {time: t, scene: scene.id};
  };

  window.seek(0);
})();
