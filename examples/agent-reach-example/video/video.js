/* Agent Reach 作例：URLから根拠メモへ（28秒・無音の編集動画）
   Copyright (c) 2026 Studio Yebisu. MIT License.
   実際のスクリーンショット5枚と保存データ（メモ・比較・実行記録）を読み、
   window.seek(秒) が任意の時刻の完成した画面を1枚のCanvasへ描く。 */
'use strict';
(() => {
  const R = window.renderConfig || {};
  const pick = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
  const W = pick(R.width, 1280), H = pick(R.height, 720), FPS = pick(R.fps, 30);
  const DURATION = 28, POSTER = 13.5;
  const RENDER = window.__MOTION_RENDER__ === true;
  window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER, audioEvents: []};
  if (RENDER) document.documentElement.classList.add('render');

  const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo",system-ui,sans-serif';
  const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","BIZ UDPMincho",serif';
  const MONO = '"Cascadia Mono","Consolas",ui-monospace,monospace';
  const C = {
    paper: '#f7f8f4', card: '#ffffff', ink: '#182f2a', muted: '#45584f', green: '#1c7257', greenSoft: '#e3efe8',
    acid: '#d8f05a', line: '#d3dbd3', warnBg: '#fff3d1', warnInk: '#5e4100', warnLine: '#d9b14a',
    unknown: '#6a4a1c', unknownSoft: '#f4ece0', inkSoft: '#e2e8e4', error: '#8a1f17'
  };

  // 場面の時刻。storyboard.json と同じ値。
  const SCENES = [
    {id: 'url', step: 'URLを渡す', start: 0, end: 4},
    {id: 'doctor', step: '接続確認', start: 4, end: 9},
    {id: 'read', step: '実際に読む', start: 9, end: 14},
    {id: 'sort', step: '根拠を分ける', start: 14, end: 21},
    {id: 'memo', step: 'メモを持ち帰る', start: 21, end: 28}
  ];
  const CATS = [
    {key: 'source', label: '原典で確認', img: 'desk-source', start: 14, strong: C.green, soft: C.greenSoft, softInk: C.green,
      ring: [242, 422, 421, 467], lines: ['原典で確認＝固定版の原典に書いてあること', 'README・SKILL.md・接続コードを照合']},
    {key: 'runtime', label: '実取得', img: 'desk-runtime', start: 16, strong: C.ink, soft: C.inkSoft, softInk: C.ink,
      ring: [409, 422, 627, 467], lines: ['実取得＝今回この環境で実際に読めたこと', 'doctorのwarnは書き換えずに残す']},
    {key: 'unknown', label: '未確認', img: 'desk-unknown', start: 18, strong: C.unknown, soft: C.unknownSoft, softInk: C.unknown,
      ring: [616, 422, 767, 467], lines: ['YouTube・Reddit・Webは今回未確認', 'Hermes内での実行・無料・速度も確かめていない']}
  ];
  const SHOTS = ['desk-all', 'desk-facts', 'desk-source', 'desk-runtime', 'desk-unknown'];

  const canvas = document.getElementById('film');
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  const IMG = {};
  let F = null, ready = false;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const out3 = p => 1 - Math.pow(1 - p, 3);
  const inOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const lerp = (a, b, p) => a + (b - a) * p;
  const enter = (t, t0, dur = 0.5) => { const p = out3(prog(t, t0, t0 + dur)); return {a: p, dy: (1 - p) * 14}; };

  // ---------- 素材の読み込み（ハッシュと寸法を素材一覧と照合） ----------

  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  async function bytes(path) {
    let res;
    try { res = await fetch('../' + path, {cache: 'no-store'}); }
    catch { throw new Error(path + ' を読み込めませんでした。HTTPで配信して開いてください。'); }
    if (!res.ok) throw new Error(`${path} を読み込めませんでした（HTTP ${res.status}）。`);
    return res.arrayBuffer();
  }
  async function verified(path, sha) {
    const buf = await bytes(path);
    if (!window.crypto || !crypto.subtle) throw new Error('SHA-256を確認できません。localhostのHTTPで開いてください。');
    if (hex(await crypto.subtle.digest('SHA-256', buf)) !== sha) throw new Error(path + ' のSHA-256が素材一覧と一致しません。');
    return buf;
  }
  const text = buf => new TextDecoder('utf-8').decode(buf);

  function facts(collection, comparison, memo) {
    const fail = m => { throw new Error('保存データが動画の説明と一致しません（' + m + '）。'); };
    const d = collection.doctor || {};
    if (d.github?.status !== 'warn' || d.twitter?.status !== 'warn') fail('doctorの判定');
    if (d.github.active_backend !== null || d.twitter.active_backend !== null) fail('active_backend');
    const ex = collection.executions || [];
    if (!ex.length || ex.some(e => e.exit_code !== 0)) fail('終了コード');
    const post = collection.post || {};
    const files = collection.repository?.files_verified;
    if (!(files > 0) || post.returned_target_posts !== 1 || post.body_present !== true || post.body_republished !== false) fail('取得件数');
    const unverified = collection.unverified || [];
    if (!unverified.some(u => u.includes('YouTube/Reddit/Web')) || !unverified.some(u => u.includes('Hermes'))) fail('未確認の一覧');
    const items = comparison.items || [];
    const cat = {};
    for (const c of CATS) cat[c.key] = items.filter(i => i.category === c.key).length;
    if (cat.source + cat.runtime + cat.unknown !== items.length || !items.length) fail('根拠の分類');
    const lines = memo.split(/\r?\n/);
    const h1 = lines.find(l => l.startsWith('# '))?.slice(2).trim();
    const h2 = lines.filter(l => l.startsWith('## ')).map(l => l.slice(3).trim());
    if (!h1 || h2.length < 3) fail('メモの見出し');
    return {
      files, posts: post.returned_target_posts, total: items.length, cat, h1, h2,
      gh: ex.filter(e => e.command?.[0] === 'gh').length,
      tw: ex.filter(e => e.command?.[0] === 'twitter').length,
      ghStatus: d.github.status, xStatus: d.twitter.status, backend: String(d.github.active_backend),
      commit: String(collection.repository.commit).slice(0, 7),
      license: collection.repository.license, copyright: collection.repository.copyright,
      twitterCli: collection.versions?.twitter_cli || ''
    };
  }

  async function load() {
    const materials = JSON.parse(text(await bytes('outputs/movie-materials.json')));
    const shots = SHOTS.map(name => {
      const entry = (materials.screenshots || []).find(s => s.path === `assets/${name}.png`);
      if (!entry) throw new Error(`素材一覧に assets/${name}.png がありません。`);
      return entry;
    });
    const fontLoads = [`600 46px ${SERIF}`, `700 36px ${SANS}`, `400 22px ${SANS}`, `700 22px ${MONO}`]
      .map(f => document.fonts.load(f, '根拠メモURL確認warn'));
    const [collection, comparison, memo] = await Promise.all([
      verified(materials.collection.path, materials.collection.sha256).then(b => JSON.parse(text(b))),
      verified(materials.comparison.path, materials.comparison.sha256).then(b => JSON.parse(text(b))),
      verified(materials.memo.path, materials.memo.sha256).then(text)
    ]);
    await Promise.all(shots.map(async (entry, i) => {
      const buf = await verified(entry.path, entry.sha256);
      const bmp = await createImageBitmap(new Blob([buf], {type: 'image/png'}));
      if (bmp.width !== entry.width || bmp.height !== entry.height) throw new Error(entry.path + ' の寸法が素材一覧と一致しません。');
      IMG[SHOTS[i]] = bmp;
    }));
    await Promise.all(fontLoads);
    await document.fonts.ready;
    F = facts(collection, comparison, memo);
  }

  // ---------- 描画の部品 ----------

  function font(weight, size, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }
  function layer(a, dy, fn) {
    if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= a; if (dy) ctx.translate(0, dy); fn(); ctx.restore();
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // 1行の文字。幅を超えるときは min まで縮める（それ以下にはしない）。
  function line(str, x, y, {weight = 400, size = 22, family = SANS, color = C.ink, align = 'left', max = Infinity, min = size, base = 'alphabetic'} = {}) {
    let s = size; font(weight, s, family);
    while (s > min && ctx.measureText(str).width > max) font(weight, --s, family);
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }
  const NO_START = '、。，．・：；？！）」』】〕〉》ーぁぃぅぇぉっゃゅょァィゥェォッャュョ';
  const NO_END = '（「『【〔〈《';
  function wrap(str, max) {
    const toks = str.match(/[A-Za-z0-9_.:/@#%+-]+|./gu) || [];
    const lines = []; let cur = '';
    for (const tok of toks) {
      if (cur && ctx.measureText(cur + tok).width > max) {
        let carry = '';
        if (NO_START.includes(tok[0]) || NO_END.includes(cur.at(-1))) { const ch = Array.from(cur); carry = ch.pop(); cur = ch.join(''); }
        lines.push(cur.trimEnd()); cur = (carry + tok).trimStart();
      } else cur += tok;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function para(str, x, y, max, lh, {weight = 400, size = 22, family = SANS, color = C.ink} = {}) {
    font(weight, size, family); ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const lines = wrap(str, max);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    return y + lines.length * lh;
  }
  function caption(str, t, t0, size = 46) {
    const e = enter(t, t0);
    layer(e.a, e.dy, () => line(str, 56, 128, {weight: 600, size, family: SERIF, max: 1168, min: 36}));
  }
  // 実画面の切り抜き。表示先と同じ縦横比で元画像を切り、伸縮させない。
  function crop(img, view, d) {
    const w = Math.min(view.w, img.width, img.height * d.w / d.h), h = w * d.h / d.w;
    const x0 = clamp(view.cx - w / 2, 0, img.width - w), y0 = clamp(view.cy - h / 2, 0, img.height - h);
    ctx.save();
    ctx.beginPath(); ctx.rect(d.x, d.y, d.w, d.h); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x0, y0, w, h, d.x, d.y, d.w, d.h);
    ctx.restore();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
    const k = d.w / w;
    return (sx, sy) => [d.x + (sx - x0) * k, d.y + (sy - y0) * k];
  }
  const view = (a, b, p) => ({cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), w: lerp(a.w, b.w, p)});
  function clipTo(d, fn) { ctx.save(); ctx.beginPath(); ctx.rect(d.x, d.y, d.w, d.h); ctx.clip(); fn(); ctx.restore(); }
  function tag(str, x, cy, {align = 'left', bg = C.acid, fg = C.ink, size = 22} = {}) {
    font(700, size); const w = ctx.measureText(str).width + 28, h = size + 18;
    const left = align === 'right' ? x - w : x;
    rr(left, cy - h / 2, w, h, 4); ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(str, left + 14, cy + 1);
    return w;
  }
  function warnChip(str, x, cy, size = 22) {
    font(700, size, MONO); const w = ctx.measureText(str).width + 22, h = size + 14;
    rr(x, cy - h / 2, w, h, 4); ctx.fillStyle = C.warnBg; ctx.fill();
    ctx.strokeStyle = C.warnLine; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = C.warnInk; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(str, x + 11, cy + 1);
    return w;
  }

  // ---------- 常に表示する枠 ----------

  const sceneIndex = t => { let i = 0; SCENES.forEach((s, k) => { if (t >= s.start) i = k; }); return i; };
  function frame(t) {
    ctx.fillStyle = C.acid; ctx.fillRect(0, 0, 72, 6);
    const cur = sceneIndex(t), items = [];
    let x = 56;
    SCENES.forEach((s, k) => {
      font(700, 16, MONO); const nw = ctx.measureText(String(k + 1)).width;
      font(k === cur ? 700 : 500, 17); const lw = ctx.measureText(s.step).width;
      const color = k < cur ? C.green : k === cur ? C.ink : C.muted;
      font(700, 16, MONO); ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(k + 1), x, 46);
      font(k === cur ? 700 : 500, 17); ctx.fillText(s.step, x + nw + 8, 46);
      items.push({x, w: nw + 8 + lw});
      x += nw + 8 + lw;
      if (k < SCENES.length - 1) { font(400, 16); ctx.fillStyle = C.green; ctx.fillText('→', x + 12, 46); x += 44; }
    });
    const p = cur ? out3(prog(t, SCENES[cur].start, SCENES[cur].start + 0.45)) : 1;
    const from = items[Math.max(0, cur - 1)], to = items[cur];
    ctx.fillStyle = C.acid; ctx.fillRect(lerp(from.x, to.x, p), 54, lerp(from.w, to.w, p), 5);

    font(700, 16); const label = '実取得をもとにした編集動画 ／ 無音';
    const lw = ctx.measureText(label).width + 24;
    rr(1224 - lw, 24, lw, 32, 4); ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.fillText(label, 1224 - lw + 12, 41);

    ctx.fillStyle = C.line; ctx.fillRect(56, 676, 1168, 1);
    line(sourceLabel(t), 56, 702, {size: 16, color: C.muted, max: 900, min: 16});
    line('Studio Yebisu 作例', 1224, 702, {size: 16, color: C.muted, align: 'right'});
  }
  function sourceLabel(t) {
    const shot = name => `画面：保存結果ビューアの実際のスクリーンショット（${name}.png）`;
    if (t < 4) return shot('desk-all');
    if (t < 14) return shot('desk-facts');
    if (t < 21) return shot(CATS[t < 16 ? 0 : t < 18 ? 1 : 2].img);
    if (t < 24.2) return shot('desk-all');
    return '資料：実際の調査メモ outputs/research-note.md の見出し';
  }

  // ---------- 場面 ----------

  // 1. 公開URLを2つ渡す
  function sceneUrl(t) {
    line('URLから、根拠メモへ', 56, 160, {weight: 600, size: 64, family: SERIF});
    const d = {x: 56, y: 200, w: 1168, h: 233.6};
    const v = view({cx: 625, cy: 462, w: 1090}, {cx: 625, cy: 462, w: 1040}, inOut(prog(t, 0, 4)));
    let m;
    layer(out3(prog(t, 0.2, 0.8)), 0, () => { m = crop(IMG['desk-all'], v, d); });
    [['GitHub原典', 426.5, 1.0], ['X紹介投稿', 516, 1.4]].forEach(([label, sy, t0]) => {
      if (!m) return;
      const [x, y] = m(1124, sy), e = enter(t, t0, 0.45);
      layer(e.a, 0, () => clipTo(d, () => tag(label, x, y, {align: 'right'})));
    });
    const e = enter(t, 1.9);
    layer(e.a, e.dy, () => {
      line('まず、公開URLを2つ渡す', 56, 512, {weight: 700, size: 38});
      line('固定版のGitHubリポジトリと、それを紹介した第三者のX投稿', 56, 556, {size: 24, color: C.muted, max: 1168, min: 21});
    });
  }

  // 2. 接続確認：doctorはwarnのまま
  function sceneDoctor(t) {
    caption('接続の確認と、実取得は分ける', t, 4.0);
    const d = {x: 56, y: 168, w: 760, h: 206};
    const v = view({cx: 625, cy: 240, w: 1050}, {cx: 882, cy: 170, w: 560}, inOut(prog(t, 4.5, 6.2)));
    layer(out3(prog(t, 4.15, 4.7)), 0, () => {
      const m = crop(IMG['desk-facts'], v, d);
      const a = out3(prog(t, 6.2, 6.6));
      layer(a, 0, () => clipTo(d, () => {
        const [x0, y0] = m(625, 111), [x1, y1] = m(1139, 228);
        ctx.strokeStyle = C.warnLine; ctx.lineWidth = 4; ctx.strokeRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6);
      }));
    });
    let e = enter(t, 5.0);
    layer(e.a, e.dy, () => {
      const g = warnChip(F.ghStatus, 852, 200);
      line('GitHub', 852 + g + 14, 200, {weight: 700, size: 26, base: 'middle'});
      const x = warnChip(F.xStatus, 852, 252);
      line('X', 852 + x + 14, 252, {weight: 700, size: 26, base: 'middle'});
      line(`どちらも active_backend: ${F.backend}`, 852, 304, {size: 21, color: C.muted, max: 372, min: 18});
    });
    e = enter(t, 6.4);
    layer(e.a, e.dy, () => para('warnは「読めない」でも「読める保証」でもない', 852, 352, 372, 32, {size: 22}));

    e = enter(t, 5.6);
    layer(e.a, e.dy, () => {
      rr(56, 432, 520, 128, 4); ctx.fillStyle = C.warnBg; ctx.fill(); ctx.strokeStyle = C.warnLine; ctx.lineWidth = 2; ctx.stroke();
      line('① 接続確認（doctor）', 80, 480, {weight: 700, size: 26, color: C.warnInk});
      line(`判定は ${F.ghStatus} のまま記録する`, 80, 526, {size: 23, color: C.warnInk, max: 472, min: 21});
    });
    e = enter(t, 6.9);
    layer(e.a, e.dy, () => {
      line('→', 640, 498, {weight: 700, size: 36, color: C.green, align: 'center'});
      line('別の手順', 640, 532, {weight: 700, size: 17, color: C.green, align: 'center'});
      rr(704, 432, 520, 128, 4); ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
      line('② 実際に読む', 728, 480, {weight: 700, size: 26});
      line('gh API と twitter-cli で直接読む', 728, 526, {size: 23, max: 472, min: 21});
    });
  }

  // 3. 実取得の結果
  function sceneRead(t) {
    caption(`原典${F.files}ファイル・公開投稿${F.posts}件を実取得`, t, 9.0);
    const d = {x: 56, y: 168, w: 680, h: 185};
    const v = view({cx: 370, cy: 298, w: 560}, {cx: 370, cy: 298, w: 530}, inOut(prog(t, 9.2, 13.8)));
    layer(out3(prog(t, 9.15, 9.7)), 0, () => crop(IMG['desk-facts'], v, d));
    const row = (num, label, sub, y) => {
      const nw = line(String(num), 780, y, {weight: 600, size: 96, family: SERIF});
      ctx.fillStyle = C.acid; ctx.fillRect(780, y + 10, nw, 6);
      line(label, 780 + nw + 26, y - 34, {weight: 700, size: 28, max: 444 - nw - 26, min: 22});
      line(sub, 780 + nw + 26, y - 2, {size: 21, color: C.muted, max: 444 - nw - 26, min: 17});
    };
    let e = enter(t, 9.8);
    layer(e.a, e.dy, () => row(F.files, '原典ファイル', 'gh API・Git上とSHA-256一致', 262));
    e = enter(t, 10.3);
    layer(e.a, e.dy, () => row(F.posts, '対象の公開投稿', `twitter-cli ${F.twitterCli}・ID一致・本文あり`, 370));
    e = enter(t, 11.0);
    layer(e.a, e.dy, () => {
      line(`gh api ${F.gh}回・twitter-cli ${F.tw}回、すべて終了コード0`, 56, 448, {weight: 700, size: 26, max: 1168, min: 22});
      line('結果は今回の2つのURLの範囲だけ。記録の時刻は速度の測定ではない', 56, 492, {size: 22, color: C.muted, max: 1168, min: 21});
      line('投稿の本文は転載していない', 56, 528, {size: 22, color: C.muted});
    });
  }

  // 4. 根拠を3つに分ける
  function sceneSort(t) {
    caption(`根拠${F.total}枚を、3つに分ける`, t, 14.0);
    const d = {x: 56, y: 160, w: 1168, h: 222};
    const v = view({cx: 625, cy: 510, w: 1060}, {cx: 625, cy: 512, w: 1000}, inOut(prog(t, 14, 21)));
    let active = 0;
    CATS.forEach((c, k) => { if (t >= c.start) active = k; });
    layer(out3(prog(t, 14.1, 14.6)), 0, () => {
      let m = crop(IMG[CATS[0].img], v, d);
      for (let k = 1; k < CATS.length; k++) {
        const p = prog(t, CATS[k].start, CATS[k].start + 0.3);
        if (p > 0) layer(p, 0, () => { m = crop(IMG[CATS[k].img], v, d); });
      }
      const c = CATS[active], ra = out3(prog(t, c.start + 0.3, c.start + 0.6));
      layer(ra, 0, () => clipTo(d, () => {
        const [x0, y0] = m(c.ring[0], c.ring[1]), [x1, y1] = m(c.ring[2], c.ring[3]);
        const pad = 6, r = (y1 - y0) / 2 + pad;
        rr(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2, r);
        ctx.strokeStyle = C.acid; ctx.lineWidth = 8; ctx.stroke();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke();
      }));
    });

    CATS.forEach((c, k) => {
      const x = 56 + k * 400, y = 408, w = 368, h = 104;
      const reach = out3(prog(t, c.start, c.start + 0.35));
      const next = CATS[k + 1];
      const strong = reach * (next ? 1 - out3(prog(t, next.start, next.start + 0.35)) : 1);
      const body = (bg, fg, border) => {
        rr(x, y, w, h, 4); ctx.fillStyle = bg; ctx.fill();
        if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke(); }
        line(c.label, x + 24, y + h / 2, {weight: 700, size: 26, color: fg, base: 'middle'});
        font(700, 24); const unit = ctx.measureText('件').width;
        line('件', x + w - 24, y + 76, {weight: 700, size: 24, color: fg, align: 'right'});
        line(String(F.cat[c.key]), x + w - 30 - unit, y + 80, {weight: 600, size: 60, family: SERIF, color: fg, align: 'right'});
      };
      layer(1 - reach, 0, () => {
        ctx.setLineDash([6, 6]); rr(x, y, w, h, 4); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
        line(c.label, x + 24, y + h / 2, {weight: 700, size: 26, color: C.muted, base: 'middle'});
      });
      layer(reach, 0, () => body(c.soft, c.softInk, c.softInk));
      layer(strong, 0, () => body(c.strong, C.card, null));
    });

    const c = CATS[active], e = enter(t, c.start + 0.2, 0.4);
    layer(e.a, e.dy, () => {
      line(c.lines[0], 56, 580, {weight: 700, size: 30, color: c.key === 'unknown' ? C.unknown : C.ink, max: 1168, min: 24});
      line(c.lines[1], 56, 620, {size: 23, color: C.muted, max: 1168, min: 21});
    });
  }

  // 5. メモで持ち帰る
  function sceneMemo(t) {
    caption('根拠と未確認を添えて、メモで持ち帰る', t, 21.0, 44);
    const gone = 1 - prog(t, 23.9, 24.3);
    const d = {x: 56, y: 168, w: 1168, h: 138};
    const v = view({cx: 625, cy: 630, w: 1050}, {cx: 625, cy: 630, w: 1030}, inOut(prog(t, 21.2, 24.2)));
    layer(out3(prog(t, 21.2, 21.7)) * gone, 0, () => crop(IMG['desk-all'], v, d));
    let e = enter(t, 21.8);
    layer(e.a * gone, e.dy, () => {
      const w = tag('メモを開く・保存する', 56, 352);
      line('制作時に作成済みの実ファイル（outputs/research-note.md）', 56 + w + 18, 353, {size: 22, color: C.muted, base: 'middle', max: 1168 - w - 18, min: 18});
    });
    e = enter(t, 22.3);
    layer(e.a * gone, e.dy, () => line('入力URL・固定版・doctorと実取得の結果・手順・未確認の点を1つのメモに', 56, 438, {weight: 700, size: 26, max: 1168, min: 22}));

    e = enter(t, 24.2, 0.6);
    layer(e.a, e.dy * 1.6, () => paper(t));
    const boxes = [
      {s: '2つのURL', bg: C.card, fg: C.ink, border: C.line},
      {s: '根拠を分ける', bg: C.greenSoft, fg: C.ink, border: C.green},
      {s: '日本語メモ', bg: C.ink, fg: C.paper, border: null}
    ];
    boxes.forEach((b, k) => {
      const y = 176 + k * 114, be = enter(t, 24.7 + k * 0.25, 0.45);
      layer(be.a, be.dy, () => {
        if (k) line('↓', 968, y - 10, {weight: 700, size: 28, color: C.green, align: 'center'});
        rr(712, y, 512, 76, 4); ctx.fillStyle = b.bg; ctx.fill();
        if (b.border) { ctx.strokeStyle = b.border; ctx.lineWidth = 2; ctx.stroke(); }
        if (k === 2) { ctx.fillStyle = C.acid; ctx.fillRect(712, y, 8, 76); }
        line(b.s, 968, y + 39, {weight: 700, size: 36, color: b.fg, align: 'center', base: 'middle'});
      });
    });
    e = enter(t, 25.35, 0.45);
    layer(e.a, e.dy, () => line(`原典${F.cat.source}・実取得${F.cat.runtime}・未確認${F.cat.unknown}を添えて`, 968, 528, {size: 22, color: C.muted, align: 'center', max: 512, min: 18}));
    e = enter(t, 25.4, 0.45);
    layer(e.a, 0, () => line(`原典：Agent Reach @ ${F.commit}（${F.license} License, © ${F.copyright}）／ 映像・メモ：© 2026 Studio Yebisu（MIT）`, 56, 660, {size: 16, color: C.muted, max: 1168, min: 16}));
  }
  function paper(t) {
    const x = 56, y = 160, w = 608, h = 476;
    ctx.save();
    ctx.shadowColor = 'rgba(24,47,42,0.14)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
    ctx.fillStyle = C.card; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = C.acid; ctx.fillRect(x, y, 72, 6);
    line('outputs/research-note.md ／ 実際の見出し', x + 28, y + 36, {size: 16, color: C.muted, family: MONO, max: w - 56});
    const end = para(F.h1, x + 28, y + 72, w - 56, 30, {weight: 700, size: 22, family: SERIF});
    ctx.fillStyle = C.line; ctx.fillRect(x + 28, end - 12, w - 56, 1);
    const marks = ['原典で確認', '実際の結果', 'まだ確かめていない'];
    let n = 0;
    const pitch = Math.min(38, (y + h - 30 - (end + 26)) / Math.max(1, F.h2.length - 1));
    F.h2.forEach((hd, i) => {
      const ly = end + 26 + i * pitch;
      font(500, 21);
      const tw = Math.min(ctx.measureText(hd).width, w - 84);
      if (marks.some(m => hd.startsWith(m))) {
        const p = out3(prog(t, 24.9 + n * 0.2, 25.3 + n * 0.2)); n++;
        ctx.fillStyle = C.acid; ctx.fillRect(x + 50, ly - 21, (tw + 12) * p, 29);
      }
      ctx.fillStyle = C.green; ctx.fillRect(x + 30, ly - 12, 8, 8);
      line(hd, x + 56, ly, {weight: 500, size: 21, max: w - 84, min: 17});
    });
  }

  // ---------- seek ----------

  function draw(t) {
    canvas.width = W; canvas.height = H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    const s = Math.min(W / 1280, H / 720);
    ctx.setTransform(s, 0, 0, s, (W - 1280 * s) / 2, (H - 720 * s) / 2);
    frame(t);
    const k = sceneIndex(t), sc = SCENES[k];
    const a = (k === 0 ? 1 : out3(prog(t, sc.start, sc.start + 0.5))) * (k === SCENES.length - 1 ? 1 : 1 - prog(t, sc.end - 0.35, sc.end));
    layer(a, 0, () => [sceneUrl, sceneDoctor, sceneRead, sceneSort, sceneMemo][k](t));
  }
  function drawError(message) {
    canvas.width = W; canvas.height = H;
    const s = Math.min(W / 1280, H / 720);
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(s, 0, 0, s, (W - 1280 * s) / 2, (H - 720 * s) / 2);
    ctx.fillStyle = C.error; ctx.fillRect(56, 280, 6, 150);
    line('素材を読み込めなかったため、動画を描画していません', 84, 320, {weight: 700, size: 34, color: C.error, max: 1140, min: 24});
    para(message, 84, 372, 1100, 34, {size: 22, color: C.ink});
  }

  const $ = id => document.getElementById(id);
  const ui = {play: $('play'), scrub: $('scrub'), time: $('time'), status: $('status')};
  let current = 0, playing = false, raf = 0, baseT = 0, baseWall = 0;

  window.seek = seconds => {
    const t = clamp(Number(seconds) || 0, 0, DURATION);
    if (!ready) return window.motionReady.then(() => window.seek(t));
    current = t;
    draw(t);
    if (ui.scrub) ui.scrub.value = t.toFixed(2);
    if (ui.time) ui.time.textContent = `${t.toFixed(2)} / ${DURATION.toFixed(2)} 秒`;
  };

  window.motionReady = load().then(() => {
    ready = true;
    window.seek(RENDER ? 0 : POSTER);
    if (ui.play) { ui.play.disabled = false; ui.scrub.disabled = false; }
    if (ui.status) ui.status.textContent = '準備完了：28秒・無音の編集動画です。実際の画面と保存データから描画しています。';
  });
  window.motionReady.catch(err => {
    drawError(err && err.message ? err.message : String(err));
    if (ui.play) { ui.play.disabled = true; ui.scrub.disabled = true; }
    if (ui.status) ui.status.textContent = 'エラー：' + (err && err.message ? err.message : String(err)) + ' 再生できません。';
  });

  // プレビュー用の再生。書き出し時（__MOTION_RENDER__）は動かさない。
  function tick(now) {
    if (!playing) return;
    let t = baseT + (now - baseWall) / 1000;
    if (t >= DURATION) { t %= DURATION; baseT = t; baseWall = now; }
    window.seek(t);
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    if (RENDER || !ready) return;
    playing = on;
    cancelAnimationFrame(raf);
    ui.play.textContent = on ? '一時停止' : '再生';
    ui.play.setAttribute('aria-pressed', String(on));
    if (on) {
      if (current >= DURATION - 0.01) window.seek(0);
      baseT = current; baseWall = performance.now();
      ui.status.textContent = '再生中（無音）';
      raf = requestAnimationFrame(tick);
    } else ui.status.textContent = `一時停止：${current.toFixed(2)}秒`;
  }
  if (ui.play && !RENDER) {
    ui.play.addEventListener('click', () => setPlaying(!playing));
    ui.scrub.addEventListener('input', () => {
      window.seek(Number(ui.scrub.value));
      if (playing) { baseT = current; baseWall = performance.now(); }
    });
    ui.scrub.addEventListener('change', () => { if (!playing) ui.status.textContent = `${current.toFixed(2)}秒を表示しています`; });
  }
})();
