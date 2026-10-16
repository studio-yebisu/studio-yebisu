/* 小さなモデルを、ゼロから（Train LLM From Scratch 作例）— 28秒・無音の解説映像（編集できる元ページ）
 * Canvas 2D で、時刻 t の完成した画面を毎回最初から描く。前のフレーム・壁時計・乱数には依存しない。
 * 使う素材は照合表 assets/data-hashes.json に書かれた8ファイルだけ。照合表自体を制作記録の SHA-256 で確かめ、
 * 8件の生のバイト列を照合してから描く。行数・語彙・損失・トークンID・生成文の抜粋は、読み込んだファイルから取り出す。
 * 映像は保存済みの実出力と実画面の静止画を編集したもので、学習や操作の録画ではない。ブラウザーで Python・学習・AI は動かない。
 * Copyright (c) 2026 Studio Yebisu. MIT License. */

// ---- 書き出し条件 ---------------------------------------------------------
const RENDER = window.__MOTION_RENDER__ === true;
const DURATION = 28;
const POSTER_TIME = 13.5;
const given = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
const evenSize = (v, fallback) => (Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0 ? v : fallback);
const WIDTH = evenSize(given.width, 1280);
const HEIGHT = evenSize(given.height, 720);
const FPS = Number.isInteger(given.fps) && given.fps >= 1 && given.fps <= 120 ? given.fps : 30;
window.motionConfig = {duration: DURATION, fps: FPS, width: WIDTH, height: HEIGHT, posterTime: POSTER_TIME, audioEvents: []};

// 論理座標：1280×720 の構図を基準に、渡された縦横比へ短い辺を合わせて広げる。
// 上の帯と足元の帯は実際の端に置き、本文はその間の中央に置く（1280×720 以外は未確認）
const LW = Math.max(1280, Math.round(720 * WIDTH / HEIGHT));
const LH = Math.max(720, Math.round(1280 * HEIGHT / WIDTH));
const OX = (LW - 1280) / 2, OY = (LH - 720) / 2;

const root = document.documentElement;
if (RENDER) root.classList.add('is-render');
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d', {willReadFrequently: true});
const density = RENDER ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
canvas.width = Math.round(WIDTH * density);
canvas.height = Math.round(HEIGHT * density);
canvas.style.aspectRatio = WIDTH + ' / ' + HEIGHT;
if (RENDER) {
  canvas.style.width = WIDTH + 'px';
  canvas.style.height = HEIGHT + 'px';
}

// ---- 見た目（閲覧ページ style.css と同じ、クリーム・紺・コバルト） ------------------
const C = {
  cream: '#f6f1e6', paper: '#fffdf8', ink: '#1c2333', muted: '#545c6c', line: '#d8cfbc',
  navy: '#14213d', cobalt: '#2353c9', cobaltSoft: '#e5ecfb', grid: '#e7dfcf', error: '#9b2c1f'
};
const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, "Noto Sans JP", system-ui, sans-serif';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", serif';
const MONO = 'ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, "Noto Sans Mono", monospace';

// ---- 素材 ------------------------------------------------------------------
// 照合表 video/assets/data-hashes.json 自体の SHA-256（runtime/frozen-reviewed-source.json の files_sha256 の値）。
// パスは作例フォルダーからの相対。このモジュール（video/video.js）の1つ上を基準に解決するので、
// 書き出し時に <base href="video/"> が入っても同じ場所を指す。
const HASH_MANIFEST = {path: 'video/assets/data-hashes.json', sha256: '91cf42aa5717fa4201943bc87d0b3ac5a1de4b7f494d2fff2c2e06253d87e5d6'};
const FILES = {
  'outputs/training-run.json': {key: 'run', kind: 'json'},
  'outputs/independent-checks.json': {key: 'independent', kind: 'json'},
  'input/stories.txt': {key: 'stories', kind: 'text'},
  'input/prompts.json': {key: 'prompts', kind: 'json'},
  'input/run-config.json': {key: 'config', kind: 'json'},
  'video/assets/screen-manifest.json': {key: 'screens', kind: 'json'},
  'video/assets/workbench-phone.png': {key: 'phone', kind: 'png'},
  'video/assets/workbench-desktop.png': {key: 'desktop', kind: 'png'}
};
const INPUTS = ['input/prompts.json', 'input/run-config.json', 'input/stories.txt'];
const SOURCE = {
  repository: 'FareedKhan-dev/train-llm-from-scratch', commit: 'bdd480a518094ca834e05ab32131dc126b522d3d',
  license: 'MIT', copyright: 'Copyright (c) 2025 Fareed Khan', files_verified: 48, modified: false
};
// 照合にだけ使う期待値。映像に出す数は、読み込んだファイルの値
const EXPECT = {lines: 96, unique: 64, train: 83, val: 13, duplicated: 13, vocabRequested: 512, vocab: 417, params: 135552, steps: 800, baseline: 0, newTokens: 48, wrapperChecks: 44};
const PROMPT_IDS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08'];
const SCREENS = ['workbench-phone.png', 'workbench-desktop.png'];

// 実画面の切り抜き（画像の画素座標）と置き場所。倍率は縦横同じで、画素を伸ばさず、消さず、上に文字を重ねない
const CROPS = {
  phoneAfter: {img: 'phone', x: 10, y: 366, w: 342, h: 264, at: {x: 904, y: 314, s: 0.96}} // スマホ幅：P01 の「800回更新後」のカード
};
const CONTENT_TOP = 152, CONTENT_BOTTOM = 664;

const MAIN_MESSAGE = '文型を覚える、その過程を動かす。';
const FOOTER_LEFT = '原典コードの実行記録を編集・無音';
const FOOTER_RIGHT = '続きの文は、学習した小さなモデルの実出力';
const PRACTICE = '定型文を覚える練習';
const NOT_BENCHMARK = '知識・汎化の評価ではありません。';
const AUTHORSHIP = 'コードとページは Claude Opus 5.5 が作成。続きの文は、手元のCPUで学習した小さなモデルの出力です。';
const CTA = '8例と実行記録を、サイトで読む。';
const SCENES = [
  {id: 'corpus', start: 0, end: 4, headline: () => '小さなモデルを、ゼロから。'},
  {id: 'tokens', start: 4, end: 8, headline: () => '文章を、数字に変える。'},
  {id: 'losses', start: 8, end: 12, headline: f => `同じ初期値から、${f.steps.after}更新。`},
  {id: 'compare', start: 12, end: 18, headline: () => '同じ書き出し。違う続き。'},
  {id: 'question', start: 18, end: 22, headline: () => '質問への答えは、覚えていない。'},
  {id: 'pipeline', start: 22, end: 28, headline: () => 'データから、生成までを確かめる。'}
];

// ---- 時刻の関数（すべて絶対時刻 t から閉形式で求める） ---------------------
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const enter = (t, at, dur = 0.45) => easeOut(prog(t, at, at + dur));
const rise = (t, at, dur = 0.45, px = 14) => px * (1 - enter(t, at, dur));
// 場面は重ねない。終わりの0.3秒で紙の色へ消え、次の場面は始まりの0.3秒で現れる。上の帯と足元の帯はいつも残す
const FADE = 0.3;
function sceneAlpha(t, i) {
  const s = SCENES[i];
  const a = i === 0 ? (t >= s.start ? 1 : 0) : easeInOut(prog(t, s.start, s.start + FADE));
  const b = i === SCENES.length - 1 ? 1 : 1 - easeInOut(prog(t, s.end - FADE, s.end));
  return Math.min(a, b);
}

// ---- 読み込みと確認 --------------------------------------------------------
const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
const check = (ok, message) => {
  if (!ok) throw new Error('記録の確認に失敗：' + message);
};
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return sameList(ka, kb) && ka.every(k => deepEqual(a[k], b[k]));
}

async function fetchVerified(url, label, expected) {
  let response;
  try {
    response = await fetch(url, {cache: 'no-store'});
  } catch {
    throw new Error(`${label} を読み込めません。file:// ではなくローカルサーバーで開いてください`);
  }
  if (!response.ok) throw new Error(`${label} が HTTP ${response.status} でした`);
  const bytes = await response.arrayBuffer();
  const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (digest !== expected) throw new Error(`${label} のSHA-256が制作記録と違います（${digest}）`);
  return {bytes, digest};
}
function decodeText(bytes, label) {
  let body;
  try {
    body = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    throw new Error(`${label} がUTF-8として読めません`);
  }
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  return body;
}
function parseJson(bytes, label) {
  try {
    return JSON.parse(decodeText(bytes, label));
  } catch (error) {
    throw new Error(`${label} をJSONとして読めません（${error.message}）`);
  }
}
// 照合済みのバイト列だけから画像を作る（元の縦横比のまま）
async function decodePng(bytes, label) {
  try {
    return await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
  } catch {
    throw new Error(`${label} を画像として読み込めません`);
  }
}

async function loadAll() {
  const manifest = await fetchVerified(new URL('../' + HASH_MANIFEST.path, import.meta.url), HASH_MANIFEST.path, HASH_MANIFEST.sha256);
  const table = parseJson(manifest.bytes, HASH_MANIFEST.path);
  const hashes = table && table.files;
  check(hashes && typeof hashes === 'object' && !Array.isArray(hashes), '照合表の形');
  const listed = Object.keys(hashes).sort();
  check(sameList(listed, Object.keys(FILES).sort()), `照合表のファイル（${listed.length}件）`);
  const data = {}, verified = [];
  await Promise.all(listed.map(async path => {
    check(/^[A-Za-z0-9_\-/.]+$/.test(path) && !path.split('/').includes('..') && !path.startsWith('/'), `${path} のパス`);
    const expected = String(hashes[path]);
    check(/^[0-9a-f]{64}$/.test(expected), `${path} の照合値`);
    const {bytes, digest} = await fetchVerified(new URL('../' + path, import.meta.url), path, expected);
    const spec = FILES[path];
    if (spec.kind === 'png') data[spec.key] = await decodePng(bytes, path);
    else if (spec.kind === 'json') data[spec.key] = parseJson(bytes, path);
    else data[spec.key] = decodeText(bytes, path);
    verified.push({path, digest});
  }));
  verified.sort((a, b) => a.path.localeCompare(b.path));
  check(verified.length === Object.keys(FILES).length, '照合したファイルの数');
  return {data, verified, hashes, manifestDigest: manifest.digest};
}

// s の from 以降で count 個目の「.」の直後の位置（見つからなければ -1）
function sentenceCut(s, from, count) {
  let i = from;
  for (let k = 0; k < count; k++) {
    i = s.indexOf('.', i);
    if (i < 0) return -1;
    i += 1;
  }
  return i;
}

function buildFacts(d, hashes) {
  const {run, independent: ind, stories, prompts, config, screens} = d;

  // 原典の固定コミット・ライセンス・48ファイル無改変
  check(run && run.format === 'studio-yebisu-tiny-lm-run-v1', '実行記録の形式');
  check(deepEqual(run.source, SOURCE), '原典のリポジトリ・固定コミット・MIT・48ファイル無改変');

  // 学習の前に固定した入力3つ：実行記録の SHA-256 と、照合表の値が同じ
  check(sameList(Object.keys(run.inputs_sha256 || {}).sort(), INPUTS), '実行記録の入力の一覧');
  INPUTS.forEach(p => check(run.inputs_sha256[p] === hashes[p], `${p} のSHA-256が実行記録と同じ`));
  check(deepEqual(run.config, config), '設定が学習前に固定した run-config.json と同じ');
  check(config.device === 'cpu' && run.environment && run.environment.torch_cuda_build === null, 'CPUだけの実行');

  // 実行スクリプトの確認（44件）はすべて通っていること。品質の点数ではないので映像には出さない
  const wrapper = Object.entries(run.checks || {});
  check(wrapper.length === EXPECT.wrapperChecks && wrapper.every(([, v]) => v === true), `実行記録の確認${EXPECT.wrapperChecks}件`);

  // 英文：96行・重複を除くと64行。末尾の検証側13行は、すべて学習側に同じ行がある（ファイルから数え直す）
  const ds = run.dataset || {};
  const lines = stories.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  check(lines.every(s => s.trim() !== ''), '英文に空の行がない');
  check(lines.length === EXPECT.lines && ds.story_lines === lines.length, `英文${EXPECT.lines}行`);
  check(ds.train_lines === EXPECT.train && ds.val_lines === EXPECT.val && ds.train_lines + ds.val_lines === lines.length, '学習側83行・検証側13行');
  check(ind.dataset && ind.dataset.train_lines === ds.train_lines && ind.dataset.val_lines_nonempty === ds.val_lines, '別の検証の行数');
  const unique = new Set(lines).size;
  check(unique === EXPECT.unique && ind.dataset.unique_lines_total === unique, '重複を除いた行数');
  const trainSet = new Set(lines.slice(0, ds.train_lines));
  const duplicated = lines.slice(ds.train_lines).filter(s => trainSet.has(s)).length;
  check(duplicated === EXPECT.duplicated && ds.val_lines_identical_to_a_train_line === duplicated &&
    ind.dataset.validation_lines_also_in_training === duplicated, '検証側13行すべてが学習側にもある');

  // BPE：上限512の指定に対して実際の語彙417。学習側の文だけで作った
  check(ds.vocab_size_requested === EXPECT.vocabRequested && config.vocab_size === ds.vocab_size_requested, 'BPEの上限512');
  check(ds.vocab_size === EXPECT.vocab && ind.dataset.vocab_size === ds.vocab_size, '実際の語彙417');
  check(ds.bpe_trained_on === 'train split only', 'BPEは学習側だけで作成');
  check(ds.train_tokens === ind.dataset.train_tokens && ds.val_tokens === ind.dataset.val_tokens, 'トークン数が別の検証と同じ');

  // モデルと学習：135,552パラメータ、0回と800回、800個の学習ミニバッチの損失
  const model = run.model || {}, tr = run.training || {};
  check(model.parameters === EXPECT.params && ind.model_parameters === model.parameters && model.pretrained_weights === false, '135,552パラメータ・事前学習済みの重みなし');
  check(tr.baseline_steps === EXPECT.baseline && tr.before && tr.before.completed_steps === EXPECT.baseline, '学習前は0回更新');
  check(tr.optimizer_steps === EXPECT.steps && config.steps === tr.optimizer_steps && tr.after && tr.after.completed_steps === tr.optimizer_steps, '学習後は800回更新');
  check(ind.trained_optimizer_steps === tr.optimizer_steps && ind.baseline_is_fresh_seeded_initialization === true, '別の検証：同じseedの新しい初期値と800回');
  check(tr.seed === config.seed && tr.threads === config.threads && tr.before.state_sha256 !== tr.after.state_sha256, 'seed・スレッド・重みの変化');
  const losses = tr.losses;
  check(Array.isArray(losses) && losses.length === tr.optimizer_steps && losses.every(v => Number.isFinite(v) && v > 0), `学習ミニバッチの損失${EXPECT.steps}個`);

  // 別の検証：16出力の全文とトークンIDを原典のAPIで作り直して一致
  check(ind.status === 'passed' && ind.sample_count === PROMPT_IDS.length && ind.generated_outputs_rechecked === PROMPT_IDS.length * 2, '別の検証の状態');
  check(ind.original_generation_api_matches_all16_texts_and_token_ids === true && ind.input_hashes_unchanged === true, '16出力の再生成が一致');

  // 8つの書き出しと学習前後の生成（選び直しなし）
  check(sameList((prompts.prompts || []).map(p => p.id), PROMPT_IDS), '書き出しP01〜P08');
  check(sameList((run.samples || []).map(s => s.id), PROMPT_IDS), '実出力8件');
  const samples = {};
  run.samples.forEach((s, i) => {
    const p = prompts.prompts[i];
    check(s.label === p.label && deepEqual(s.input, {text: p.text, max_new_tokens: p.max_new_tokens, temperature: p.temperature, top_k: p.top_k, seed: p.seed}), `${s.id} の入力が固定の書き出しと同じ`);
    check(p.max_new_tokens === EXPECT.newTokens && p.top_k === 1, `${s.id} の生成条件`);
    ['before', 'after'].forEach(phase => {
      const o = s[phase];
      check(o && typeof o.text === 'string' && o.text.startsWith(p.text), `${s.id} ${phase} の全文が入力から始まる`);
      check(o.prompt_tokens === ds.prompt_tokens[s.id] && o.new_tokens === p.max_new_tokens, `${s.id} ${phase} のトークン数`);
      check(Array.isArray(o.token_ids) && o.token_ids.length === o.prompt_tokens + o.new_tokens, `${s.id} ${phase} のトークンID`);
      const rec = (ind.outputs || []).find(x => x.id === s.id && x.phase === phase);
      check(rec && rec.tokens === o.token_ids.length, `${s.id} ${phase} が別の検証と同じ長さ`);
    });
    check(sameList(s.before.token_ids.slice(0, s.before.prompt_tokens), s.after.token_ids.slice(0, s.after.prompt_tokens)), `${s.id} の入力のトークンIDが前後で同じ`);
    samples[s.id] = s;
  });

  // P01：学習前は同じトークンの繰り返し、学習後は学習文の1行と同じ文
  const p01 = samples.P01, prompt1 = p01.input.text;
  const beforeNew = p01.before.token_ids.slice(p01.before.prompt_tokens);
  const beforeCont = p01.before.text.slice(prompt1.length);
  check(beforeNew.every(id => id === beforeNew[0]) && beforeCont.length % beforeNew.length === 0, 'P01 学習前の繰り返し');
  const unit = beforeCont.slice(0, beforeCont.length / beforeNew.length);
  check(/^\s\S+$/.test(unit) && beforeCont === unit.repeat(beforeNew.length), 'P01 学習前の続きが同じ語だけ');
  const afterFirstLine = p01.after.text.split('\n')[0];
  check(lines.includes(afterFirstLine), 'P01 学習後の1行目が学習文の1行と同じ');
  const cut1 = sentenceCut(p01.after.text, prompt1.length, 2);
  check(cut1 > prompt1.length && cut1 <= afterFirstLine.length, 'P01 学習後の抜粋');

  // P08：学習文にない質問。学習後の続きは学習文と同じ並びで、質問には答えていない
  const p08 = samples.P08, prompt8 = p08.input.text;
  check(!stories.includes(prompt8), 'P08 は学習文にない書き出し');
  const cut8 = sentenceCut(p08.after.text, prompt8.length, 2);
  check(cut8 > prompt8.length, 'P08 学習後の抜粋');
  const cont8 = p08.after.text.slice(prompt8.length, cut8);
  check(!cont8.includes('\n') && stories.includes(cont8.trim()), 'P08 の続きが学習文と同じ並び');
  check(!/tokyo|東京/i.test(p08.after.text), 'P08 の続きに答えが入っていない');

  // 実画面：記録の SHA-256・大きさ（画像の実寸と記録の値）、切り抜きが画像の内側で本文の範囲に収まること
  check(Array.isArray(screens.screens) && sameList(screens.screens.map(s => s.file), SCREENS), '実画面2枚の記録');
  screens.screens.forEach(s => {
    const path = 'video/assets/' + s.file, img = d[FILES[path].key];
    check(img && img.width === s.width && img.height === s.height, `${s.file} の大きさ（${s.width}×${s.height}）`);
    check(s.sha256 === hashes[path], `${s.file} のSHA-256`);
  });
  for (const [name, crop] of Object.entries(CROPS)) {
    const img = d[crop.img];
    check(crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= img.width && crop.y + crop.h <= img.height, `${name} の切り抜き範囲`);
    const right = crop.at.x + crop.w * crop.at.s, bottom = crop.at.y + crop.h * crop.at.s;
    check(crop.at.x >= 40 && right <= 1240.5 && crop.at.y >= CONTENT_TOP && bottom <= 580, `${name} の置き場所`);
  }

  // 映像に出す値（すべて読み込んだファイルから取り出す）
  const word = unit.trim();
  return {
    img: d,
    pin: `${run.source.repository.split('/')[1]} ${run.source.commit.slice(0, 7)} ・ ${run.source.license}`,
    corpus: {lines: lines.length, unique, train: ds.train_lines, firsts: lines.slice(0, 3).map(s => s.slice(0, sentenceCut(s, 0, 1)))},
    vocab: {requested: ds.vocab_size_requested, actual: ds.vocab_size},
    params: model.parameters,
    threads: tr.threads,
    losses,
    steps: {before: tr.before.completed_steps, after: tr.after.completed_steps},
    samples: PROMPT_IDS.length,
    p01: {
      id: p01.id,
      prompt: prompt1,
      promptIds: p01.after.token_ids.slice(0, p01.after.prompt_tokens),
      before: {text: prompt1 + unit.repeat(4), note: `続く${beforeNew.length}トークンが、すべて“${word}”`},
      after: {text: p01.after.text.slice(0, cut1), note: '学習文の1行と、一字一句同じ'}
    },
    p08: {id: p08.id, prompt: prompt8, excerpt: p08.after.text.slice(0, cut8)}
  };
}

// ---- 描画の部品 ------------------------------------------------------------
function font(o) {
  const family = o.family === 'serif' ? SERIF : o.family === 'mono' ? MONO : SANS;
  return `${o.weight || 400} ${o.size || 32}px ${family}`;
}
function text(c, s, x, y, o = {}) {
  c.save();
  c.font = font(o);
  c.fillStyle = o.color || C.ink;
  c.textAlign = o.align || 'left';
  c.textBaseline = 'alphabetic';
  c.fillText(s, x, y);
  c.restore();
}
function measure(c, s, o) {
  c.save();
  c.font = font(o);
  const w = c.measureText(s).width;
  c.restore();
  return w;
}
// 測った幅に収まるまで1pxずつ小さくする（下限あり）
function fitSize(c, lines, maxWidth, o, min) {
  let size = o.size;
  while (size > min && lines.some(s => measure(c, s, {...o, size}) > maxWidth)) size -= 1;
  return size;
}
function fitText(c, s, x, y, maxWidth, o, min = 30) {
  const size = fitSize(c, [s], maxWidth, o, min);
  text(c, s, x, y, {...o, size});
  return measure(c, s, {...o, size});
}
const label = (c, s, x, y, o = {}) => fitText(c, s, x, y, o.max || 1184, {size: 30, weight: 600, color: C.muted, ...o}, 30);
// 日本語の折り返し：測った幅で文字ごとに折り、行頭・行末の禁則を守る。英数字の語の途中では折らない
const NO_START = '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ…‥';
const NO_END = '（「『【〔〈《';
const ASCII_WORD = /[A-Za-z0-9.]/;
function wrapRanges(c, chars, maxWidth, o) {
  c.save();
  c.font = font(o);
  const lines = [];
  let start = 0;
  while (start < chars.length) {
    let end = start + 1;
    while (end < chars.length && c.measureText(chars.slice(start, end + 1).join('')).width <= maxWidth) end++;
    if (end < chars.length) {
      while (end - start > 1 && NO_START.includes(chars[end])) end--;
      while (end - start > 1 && NO_END.includes(chars[end - 1])) end--;
      let k = end;
      while (k - start > 1 && ASCII_WORD.test(chars[k]) && ASCII_WORD.test(chars[k - 1])) k--;
      if (k - start > 1) end = k;
    }
    lines.push([start, end]);
    start = end;
    while (start < chars.length && chars[start] === ' ') start++;
  }
  c.restore();
  return lines;
}
function jaBlock(c, s, x, y, maxWidth, lineHeight, o) {
  const chars = [...s];
  const ranges = wrapRanges(c, chars, maxWidth, o);
  ranges.forEach(([a, b], i) => text(c, chars.slice(a, b).join('').trimEnd(), x, y + i * lineHeight, o));
  return ranges.length;
}
// 英文の折り返し：空白で区切った語の単位で、測った幅に収める。文字は変えない
function wordLines(c, s, maxWidth, o) {
  c.save();
  c.font = font(o);
  const lines = [];
  let a = -1, b = -1;
  for (const m of s.matchAll(/\S+/g)) {
    const ws = m.index, we = m.index + m[0].length;
    if (a < 0) {
      a = ws;
      b = we;
    } else if (c.measureText(s.slice(a, we)).width <= maxWidth) {
      b = we;
    } else {
      lines.push([a, b]);
      a = ws;
      b = we;
    }
  }
  if (a >= 0) lines.push([a, b]);
  c.restore();
  return lines;
}
const ELLIPSIS = ' …';
// 実出力の抜粋の配置。入力の部分（先頭 promptLength 文字）は薄く、続きは濃く描く。末尾の「…」は抜粋の印で、出力の文字ではない
function excerptLayout(c, s, maxWidth, o) {
  const lines = wordLines(c, s, maxWidth, {...o, weight: 700});
  const [a, b] = lines[lines.length - 1];
  const tail = measure(c, s.slice(a, b) + ELLIPSIS, {...o, weight: 700});
  return {lines, ellipsisNewLine: tail > maxWidth, count: lines.length + (tail > maxWidth ? 1 : 0)};
}
function excerptBlock(c, s, promptLength, x, y, maxWidth, lineHeight, o) {
  const lay = excerptLayout(c, s, maxWidth, o);
  const soft = {...o, weight: 500, color: C.muted}, strong = {...o, weight: 700, color: C.ink};
  let cx = x, by = y;
  lay.lines.forEach(([a, b], i) => {
    by = y + i * lineHeight;
    cx = x;
    const cut = Math.min(Math.max(promptLength, a), b);
    if (cut > a) {
      const seg = s.slice(a, cut);
      text(c, seg, cx, by, soft);
      cx += measure(c, seg, soft);
    }
    if (b > cut) {
      const seg = s.slice(cut, b);
      text(c, seg, cx, by, strong);
      cx += measure(c, seg, strong);
    }
  });
  if (lay.ellipsisNewLine) text(c, ELLIPSIS.trim(), x, by + lineHeight, {...o, weight: 700, color: C.cobalt});
  else text(c, ELLIPSIS, cx, by, {...o, weight: 700, color: C.cobalt});
}
function roundRect(c, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}
// 紙の上の記録カード（実画面ではない。保存した記録を編集で読みやすく置いたもの）
function card(c, x, y, w, h, o = {}) {
  roundRect(c, x, y, w, h, 10);
  c.fillStyle = o.fill || C.paper;
  c.fill();
  c.strokeStyle = o.stroke || C.line;
  c.lineWidth = o.lineWidth || 1.5;
  roundRect(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 10);
  c.stroke();
  if (o.bar) {
    c.fillStyle = o.bar;
    c.fillRect(x, y + 8, 5, h - 16);
  }
}
function chip(c, s, x, y, o = {}) {
  const size = o.size || 30, h = o.h || 48, pad = o.pad || 14, weight = o.weight || 700;
  const fo = {size, weight, family: o.family};
  const w = measure(c, s, fo) + pad * 2;
  roundRect(c, x, y, w, h, 8);
  c.fillStyle = o.fill || C.paper;
  c.fill();
  text(c, s, x + pad, y + h / 2 + size * 0.36, {...fo, color: o.color || C.ink});
  return w;
}
function bigCount(c, n, x, y, size, color, unit) {
  const o = {size, weight: 700};
  text(c, String(n), x, y, {...o, color});
  const w = measure(c, String(n), o);
  const uo = {size: Math.round(size * 0.3), weight: 700};
  text(c, unit, x + w + 10, y, {...uo, color});
  return w + 10 + measure(c, unit, uo);
}
function arrow(c, x1, x2, y, color = C.navy) {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x1, y);
  c.lineTo(x2 - 12, y);
  c.stroke();
  c.beginPath();
  c.moveTo(x2, y);
  c.lineTo(x2 - 14, y - 9);
  c.lineTo(x2 - 14, y + 9);
  c.closePath();
  c.fill();
}
function arrowDown(c, x, y1, y2, color = C.navy) {
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, y1);
  c.lineTo(x, y2 - 12);
  c.stroke();
  c.beginPath();
  c.moveTo(x, y2);
  c.lineTo(x - 10, y2 - 16);
  c.lineTo(x + 10, y2 - 16);
  c.closePath();
  c.fill();
}
// 実画面の切り抜きを、等倍率でそのまま置く（画素は変えず、文字も重ねない）
function shot(c, f, key, alpha, dy = 0) {
  if (alpha <= 0.001) return;
  const crop = CROPS[key], img = f.img[crop.img];
  const x = crop.at.x, y = crop.at.y + dy, w = crop.w * crop.at.s, h = crop.h * crop.at.s;
  c.save();
  c.globalAlpha *= alpha;
  c.save();
  c.shadowColor = 'rgba(20, 33, 61, 0.14)';
  c.shadowBlur = 16;
  c.shadowOffsetY = 5;
  roundRect(c, x, y, w, h, 8);
  c.fillStyle = C.paper;
  c.fill();
  c.restore();
  c.save();
  roundRect(c, x, y, w, h, 8);
  c.clip();
  c.drawImage(img, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
  c.restore();
  roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  c.strokeStyle = C.line;
  c.lineWidth = 1;
  c.stroke();
  c.restore();
}

// ---- いつも出ている枠：題名と原典、足元の注記（実際の端に置く） -------------------
function drawChrome(c, f) {
  text(c, 'Train LLM From Scratch 作例', 48, 38, {size: 26, weight: 700, color: C.navy});
  if (f) text(c, f.pin, LW - 48, 38, {size: 26, weight: 500, color: C.muted, align: 'right'});
  c.save();
  c.fillStyle = C.line;
  c.fillRect(48, 54, LW - 96, 1);
  c.fillRect(48, LH - 54, LW - 96, 1);
  c.restore();
  text(c, FOOTER_LEFT, 48, LH - 16, {size: 28, weight: 700, color: C.ink});
  text(c, FOOTER_RIGHT, LW - 48, LH - 16, {size: 26, weight: 700, color: C.navy, align: 'right'});
}

function drawHeadlines(c, t, f) {
  SCENES.forEach((s, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    const dy = i === 0 ? 0 : 10 * (1 - easeOut(prog(t, s.start, s.start + 0.4)));
    c.save();
    c.globalAlpha = a;
    text(c, s.headline(f), 48, 134 + dy, {size: 72, weight: 700, family: 'serif', color: C.navy});
    c.restore();
  });
}

// ---- 場面 ------------------------------------------------------------------
// 0〜4秒：作例のために書いた英文。各行の最初の文（実データの抜粋）と、96行・重複を除くと64行
function drawCorpus(c, t, f, a) {
  c.globalAlpha = a * enter(t, 0.15);
  fitText(c, MAIN_MESSAGE, 48, 214 + rise(t, 0.15), 1184, {size: 52, weight: 700, color: C.ink}, 52);
  c.globalAlpha = a * enter(t, 0.35);
  label(c, '実データの抜粋・各行の最初の文', 48, 280, {max: 720});
  f.corpus.firsts.forEach((s, i) => {
    const at = 0.45 + i * 0.15, y = 298 + i * 76 + rise(t, at, 0.45, 12);
    c.globalAlpha = a * enter(t, at);
    card(c, 48, y, 720, 64, {bar: C.navy});
    text(c, s, 72, y + 46, {size: 44, weight: 700, family: 'mono', color: C.ink});
  });
  c.globalAlpha = a * enter(t, 0.95);
  label(c, 'input/stories.txt', 48, 572, {max: 720, family: 'mono', weight: 500});
  c.globalAlpha = a * enter(t, 1.0);
  bigCount(c, f.corpus.lines, 820, 466 + rise(t, 1.0), 200, C.navy, '行');
  c.globalAlpha = a * enter(t, 1.2);
  fitText(c, '自作の定型文', 820, 546 + rise(t, 1.2), 412, {size: 52, weight: 700, color: C.ink}, 52);
  c.globalAlpha = a * enter(t, 1.35);
  label(c, `重複を除くと${f.corpus.unique}行`, 820, 598, {max: 412});
}

// 4〜8秒：P01 の書き出しが、BPE で実際の4つのトークンIDになる。語彙は上限512に対して実417
function drawTokens(c, t, f, a) {
  const p = f.p01;
  c.globalAlpha = a * enter(t, 4.15);
  label(c, `${p.id}の書き出し`, 48, 204, {max: 700});
  c.globalAlpha = a * enter(t, 4.25);
  const dy = rise(t, 4.25);
  card(c, 48, 222 + dy, 700, 88, {stroke: C.navy, lineWidth: 2});
  fitText(c, p.prompt, 76, 282 + dy, 644, {size: 52, weight: 700, family: 'mono', color: C.ink}, 44);
  c.globalAlpha = a * enter(t, 4.55);
  arrowDown(c, 96, 324, 374, C.cobalt);
  label(c, 'BPEで分けて、番号にする', 128, 360, {max: 620, color: C.cobalt, weight: 700});
  let x = 48;
  p.promptIds.forEach((id, i) => {
    const at = 4.7 + i * 0.12;
    c.globalAlpha = a * enter(t, at, 0.35);
    x += chip(c, String(id), x, 390 + rise(t, at, 0.35, 10), {size: 52, h: 80, pad: 22, family: 'mono', fill: C.navy, color: '#ffffff'}) + 16;
  });
  c.globalAlpha = a * enter(t, 5.25);
  label(c, `実際のトークンID・${p.promptIds.length}個`, 48, 518, {max: 700});

  c.fillStyle = C.line;
  c.globalAlpha = a * enter(t, 4.8);
  c.fillRect(788, 180, 1, 440);
  c.globalAlpha = a * enter(t, 4.9);
  label(c, 'BPEの語彙', 820, 204, {max: 412});
  c.globalAlpha = a * enter(t, 5.0);
  text(c, String(f.vocab.actual), 812, 410 + rise(t, 5.0), {size: 200, weight: 700, color: C.navy});
  c.globalAlpha = a * enter(t, 5.2);
  fitText(c, `上限${f.vocab.requested}／実語彙${f.vocab.actual}`, 820, 488, 412, {size: 36, weight: 700, color: C.cobalt}, 30);
  c.globalAlpha = a * enter(t, 5.35);
  label(c, `学習側${f.corpus.train}行の文だけで作成`, 820, 540, {max: 412});
}

// 8〜12秒：保存済みの800個の学習ミニバッチの損失（検証の値ではない）。線は一度に現れ、進み具合の表示はしない
function drawLosses(c, t, f, a) {
  const L = f.losses, n = L.length;
  const X = 112, Y = 236, W = 740, H = 320;
  const yMax = Math.ceil(Math.max(...L) / 2) * 2;
  const px = i => X + ((i + 1) / n) * W;
  const py = v => Y + H * (1 - v / yMax);

  c.globalAlpha = a * enter(t, 8.15);
  const tw = fitText(c, '学習ミニバッチの損失', 48, 204, 520, {size: 36, weight: 700, color: C.navy}, 30);
  label(c, '保存済みの学習記録', 48 + tw + 20, 204, {max: 820 - tw - 20});

  c.globalAlpha = a * enter(t, 8.25);
  for (let v = 0; v <= yMax; v += 2) {
    c.fillStyle = v === 0 ? C.muted : C.grid;
    c.fillRect(X, Math.round(py(v)), W, v === 0 ? 2 : 1);
    text(c, String(v), X - 16, py(v) + 10, {size: 30, weight: 600, color: C.muted, align: 'right'});
  }
  c.fillStyle = C.muted;
  c.fillRect(X, Y, 2, H);
  for (let k = 0; k <= 4; k++) {
    const step = (n / 4) * k, xx = X + (step / n) * W;
    c.fillStyle = C.muted;
    c.fillRect(Math.round(xx), Y + H, 1, 8);
    text(c, k === 4 ? `${step}回` : String(step), xx, Y + H + 42, {size: 30, weight: 600, color: C.muted, align: k === 4 ? 'right' : 'center'});
  }

  c.globalAlpha = a * enter(t, 8.4, 0.6);
  c.strokeStyle = C.cobalt;
  c.lineWidth = 3;
  c.lineJoin = 'round';
  c.beginPath();
  L.forEach((v, i) => (i === 0 ? c.moveTo(px(i), py(v)) : c.lineTo(px(i), py(v))));
  c.stroke();

  c.globalAlpha = a * enter(t, 8.9);
  c.fillStyle = C.navy;
  c.beginPath();
  c.arc(px(0), py(L[0]), 7, 0, Math.PI * 2);
  c.fill();
  text(c, `最初 ${L[0].toFixed(4)}`, px(0) + 18, py(L[0]) - 6, {size: 30, weight: 700, color: C.navy});
  c.globalAlpha = a * enter(t, 9.05);
  c.beginPath();
  c.arc(px(n - 1), py(L[n - 1]), 7, 0, Math.PI * 2);
  c.fill();
  text(c, `最後 ${L[n - 1].toFixed(4)}`, px(n - 1), py(L[n - 1]) - 22, {size: 30, weight: 700, color: C.navy, align: 'right'});

  c.globalAlpha = a * enter(t, 8.6);
  label(c, 'モデルの大きさ', 904, 236, {max: 328});
  c.globalAlpha = a * enter(t, 8.7);
  fitText(c, f.params.toLocaleString('en-US'), 904, 316 + rise(t, 8.7), 328, {size: 72, weight: 700, color: C.navy}, 52);
  label(c, 'パラメータ', 904, 360, {max: 328});
  c.globalAlpha = a * enter(t, 8.85);
  label(c, '手元のPCで学習', 904, 432, {max: 328});
  fitText(c, `CPU・${f.threads}スレッド`, 904, 480 + rise(t, 8.85), 328, {size: 40, weight: 700, color: C.cobalt}, 30);
  c.globalAlpha = a * enter(t, 9.0);
  jaBlock(c, `${f.steps.before}回と${f.steps.after}回は、同じ初期値から`, 904, 540, 328, 40, {size: 30, weight: 600, color: C.muted});
}

// 12〜18秒：P01 の学習前（0回）と800回更新後の実出力の抜粋。ポスター13.5秒（13.35秒までに全要素が着地）
function drawCompare(c, t, f, a) {
  const p = f.p01, Y = 176, W = 572, H = 404;
  const cols = [
    {x: 48, at: 12.2, steps: f.steps.before, sub: '学習前', color: C.navy, stroke: C.line, lineWidth: 1.5, ex: p.before},
    {x: 660, at: 12.45, steps: f.steps.after, sub: '学習後', color: C.cobalt, stroke: C.cobalt, lineWidth: 2.5, ex: p.after}
  ];
  cols.forEach(col => {
    const dy = rise(t, col.at), y = Y + dy;
    c.globalAlpha = a * enter(t, col.at);
    card(c, col.x, y, W, H, {stroke: col.stroke, lineWidth: col.lineWidth});
    const hw = fitText(c, `${col.steps}回更新`, col.x + 28, y + 68, 320, {size: 52, weight: 700, color: col.color}, 52);
    label(c, col.sub, col.x + 28 + hw + 16, y + 68, {max: W - 72 - hw});
    excerptBlock(c, col.ex.text, p.prompt.length, col.x + 28, y + 140, W - 56, 56, {size: 44, family: 'mono'});
    c.globalAlpha = a * enter(t, col.at + 0.35);
    label(c, col.ex.note, col.x + 28, y + H - 30, {max: W - 56, color: col.color, weight: 700});
  });
  c.globalAlpha = a * enter(t, 12.45);
  arrow(c, 624, 656, Y + H / 2, C.cobalt);
  c.globalAlpha = a * enter(t, 12.9);
  label(c, `${p.id}の実出力の抜粋（薄い文字は入力、「…」の先も出力が続く）`, 48, 628, {max: 1184});
}

// 18〜22秒：学習文にない質問 P08。800回更新後の続きは、学習文の型の文で、質問には答えていない
function drawQuestion(c, t, f, a) {
  const q = f.p08;
  c.globalAlpha = a * enter(t, 18.15);
  label(c, `${q.id}・学習文にない質問（学習前に固定した入力）`, 48, 204, {max: 1184, color: C.cobalt, weight: 700});
  c.globalAlpha = a * enter(t, 18.25);
  const dy = rise(t, 18.25);
  card(c, 48, 222 + dy, 1184, 84, {stroke: C.navy, lineWidth: 2});
  const cw = chip(c, '入力', 72, 240 + dy, {size: 30, h: 48, fill: C.navy, color: '#ffffff'});
  fitText(c, q.prompt, 72 + cw + 20, 280 + dy, 1184 - cw - 72, {size: 44, weight: 700, family: 'mono', color: C.ink}, 44);
  c.globalAlpha = a * enter(t, 18.5);
  label(c, `実出力の抜粋（${f.steps.after}回更新後・薄い文字は入力）`, 48, 352, {max: 1184});
  c.globalAlpha = a * enter(t, 18.6);
  const dy2 = rise(t, 18.6);
  card(c, 48, 366 + dy2, 1184, 186, {stroke: C.cobalt, lineWidth: 2.5});
  excerptBlock(c, q.excerpt, q.prompt.length, 76, 428 + dy2, 1128, 56, {size: 44, family: 'mono'});
  c.globalAlpha = a * enter(t, 19.0);
  fitText(c, '質問に答えず、学習文の型が続く。', 48, 618 + rise(t, 19.0), 1184, {size: 52, weight: 700, color: C.navy}, 52);
}

// 22〜28秒：データ → BPE → 学習 → 生成。何の練習かと、何ではないか。24.9秒以降は案内まで静止
function drawPipeline(c, t, f, a) {
  const steps = [
    {k: 'データ', v: `英文${f.corpus.lines}行`},
    {k: 'BPE', v: `語彙${f.vocab.actual}`},
    {k: '学習', v: `${f.steps.after}回更新`},
    {k: '生成', v: `${f.samples}例を比較`}
  ];
  const W = 278, G = 24, Y = 168, H = 96;
  steps.forEach((s, i) => {
    const at = 22.2 + i * 0.15, x = 48 + i * (W + G), y = Y + rise(t, at, 0.45, 10);
    c.globalAlpha = a * enter(t, at);
    card(c, x, y, W, H, {bar: C.cobalt});
    label(c, s.k, x + 24, y + 38, {max: W - 40});
    fitText(c, s.v, x + 24, y + 82, W - 40, {size: 40, weight: 700, color: C.navy}, 32);
    if (i > 0) {
      c.fillStyle = C.cobalt;
      c.beginPath();
      c.moveTo(x - 6, Y + H / 2);
      c.lineTo(x - 18, Y + H / 2 - 9);
      c.lineTo(x - 18, Y + H / 2 + 9);
      c.closePath();
      c.fill();
    }
  });
  c.globalAlpha = a * enter(t, 22.85);
  text(c, PRACTICE, 48, 372 + rise(t, 22.85), {size: 72, weight: 700, family: 'serif', color: C.cobalt});
  c.globalAlpha = a * enter(t, 23.05);
  text(c, NOT_BENCHMARK, 48, 444 + rise(t, 23.05), {size: 52, weight: 700, color: C.ink});
  c.globalAlpha = a * enter(t, 23.35);
  jaBlock(c, AUTHORSHIP, 48, 500, 832, 40, {size: 30, weight: 600, color: C.muted});

  c.globalAlpha = a * enter(t, 23.2);
  label(c, '実画面・スマホ表示', 904, 300, {max: 328});
  c.globalAlpha = a;
  shot(c, f, 'phoneAfter', enter(t, 23.25), rise(t, 23.25));

  const kc = enter(t, 24.4, 0.5);
  if (kc > 0.001) {
    c.globalAlpha = a * kc;
    roundRect(c, 32, 588, 1216, 64, 10);
    c.fillStyle = C.cobaltSoft;
    c.fill();
    c.fillStyle = C.cobalt;
    c.fillRect(32, 588, 6, 64);
    fitText(c, CTA, 56, 638, 1160, {size: 52, weight: 700, color: C.navy}, 52);
  }
}

const DRAW = [drawCorpus, drawTokens, drawLosses, drawCompare, drawQuestion, drawPipeline];

// 文字の大きさは下限より小さくしない。収まらない場合は描かずに理由を出す
function checkLayout(c, f) {
  SCENES.forEach(s => check(measure(c, s.headline(f), {size: 72, weight: 700, family: 'serif'}) <= 1184, `見出し「${s.headline(f)}」が幅に収まる`));
  check(measure(c, MAIN_MESSAGE, {size: 52, weight: 700}) <= 1184, '副題が幅に収まる');
  f.corpus.firsts.forEach(s => check(measure(c, s, {size: 44, weight: 700, family: 'mono'}) <= 672, `抜粋「${s}」が枠に収まる`));
  check(measure(c, PRACTICE, {size: 72, weight: 700, family: 'serif'}) <= 840, '「定型文を覚える練習」が幅に収まる');
  check(measure(c, NOT_BENCHMARK, {size: 52, weight: 700}) <= 848, '「知識・汎化の評価ではありません。」が幅に収まる');
  check(wrapRanges(c, [...AUTHORSHIP], 832, {size: 30, weight: 600}).length <= 2, '作成者の説明が2行に収まる');
  check(excerptLayout(c, f.p01.before.text, 516, {size: 44, family: 'mono'}).count <= 4, 'P01 学習前の抜粋が4行に収まる');
  check(excerptLayout(c, f.p01.after.text, 516, {size: 44, family: 'mono'}).count <= 4, 'P01 学習後の抜粋が4行に収まる');
  check(excerptLayout(c, f.p08.excerpt, 1128, {size: 44, family: 'mono'}).count <= 3, 'P08 の抜粋が3行に収まる');
}

// ---- 1フレームを描く --------------------------------------------------------
let facts = null;
let failure = null;
let currentT = 0;

function render(t) {
  canvas.width = canvas.width; // 前のフレームの変換・クリップ・状態をすべて捨てる
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / LW, canvas.height / LH);
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - LW * scale) / 2, (canvas.height - LH * scale) / 2);
  ctx.beginPath();
  ctx.rect(0, 0, LW, LH);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawChrome(ctx, facts);
  ctx.save();
  ctx.translate(OX, OY);
  if (!facts) {
    const message = failure ? '読み込みに失敗しました。代わりの映像は出しません。' : '保存済みの記録と実画面を確かめています…';
    text(ctx, message, 48, 300, {size: 36, weight: 700, color: failure ? C.error : C.muted});
    if (failure) jaBlock(ctx, failure.message, 48, 356, 1184, 44, {size: 30, color: C.ink});
    ctx.restore();
    return;
  }
  drawHeadlines(ctx, t, facts);
  ctx.beginPath();
  ctx.rect(0, CONTENT_TOP, 1280, CONTENT_BOTTOM - CONTENT_TOP);
  ctx.clip();
  DRAW.forEach((draw, i) => {
    const a = sceneAlpha(t, i);
    if (a <= 0.001) return;
    ctx.save();
    draw(ctx, t, facts, a);
    ctx.restore();
  });
  ctx.restore();
}

const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');
const verifiedEl = document.getElementById('verified');
function setStatus(state, message, detail = '') {
  root.dataset.motionStatus = state;
  if (statusEl) {
    statusEl.dataset.state = state;
    statusEl.textContent = message;
  }
  if (detailEl) detailEl.textContent = detail;
}
const clampTime = v => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(DURATION, Math.max(0, n)) : 0;
};

render(0);
setStatus('loading', '保存済みの記録と実画面を確かめています…');

window.motionReady = (async () => {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('この環境ではSHA-256を確かめられません。http://127.0.0.1 などのローカルサーバーで開いてください');
  }
  const fontSpecs = [`700 72px ${SERIF}`, `700 200px ${SANS}`, `700 52px ${SANS}`, `600 30px ${SANS}`, `700 44px ${MONO}`, `500 44px ${MONO}`];
  if (document.fonts && document.fonts.load) {
    await Promise.all(fontSpecs.map(spec => document.fonts.load(spec, '小さなモデルを、ゼロから文型を覚える過程定型文知識汎化評価 Mira walks to the 0123456789')));
    await document.fonts.ready;
  }
  const {data, verified, hashes, manifestDigest} = await loadAll();
  const built = buildFacts(data, hashes);
  checkLayout(ctx, built);
  facts = built;
  render(currentT);
  setStatus('ready', `照合した${verified.length}ファイルから描いています`,
    `照合表のSHA-256 ${manifestDigest} を確かめ、英文${built.corpus.lines}行（重複を除くと${built.corpus.unique}行）、` +
    `書き出し${built.samples}つの学習前後の実出力、${built.losses.length}個の学習ミニバッチの損失、実画面2枚を照合しました。` +
    'ページでも映像でも Python・学習・AI は動きません。');
  if (verifiedEl) {
    verifiedEl.replaceChildren(...verified.map(v => {
      const li = document.createElement('li');
      const path = document.createElement('code');
      path.textContent = v.path;
      const digest = document.createElement('code');
      digest.className = 'digest';
      digest.textContent = v.digest;
      li.append(path, ' — SHA-256 ', digest);
      return li;
    }));
    verifiedEl.hidden = false;
  }
  return true;
})().catch(error => {
  failure = error;
  render(currentT);
  setStatus('error', '読み込みに失敗しました：' + error.message, '代わりの映像は出しません。ファイルを確かめてから、もう一度読み込んでください。');
  throw error;
});
window.motionReady.catch(() => {});

// 任意の時刻の完成した画面を描く。呼んだ順番や壁時計には依存しない
window.seek = seconds => {
  const t = clampTime(seconds);
  currentT = t;
  return window.motionReady.then(() => {
    render(t);
    return t;
  });
};

// ---- 編集用のプレビュー（書き出し時は何も動かさない） --------------------------
// 自動では再生しない（動きを減らす設定でも同じく停止から始まる）。再生は「再生」を押したときだけ
function setupPreview() {
  const play = document.getElementById('play');
  const range = document.getElementById('time');
  const clock = document.getElementById('clock');
  const reload = document.getElementById('reload');
  let playing = false, raf = 0, from = 0, startedAt = 0;
  const sec = v => v.toFixed(1) + '秒';

  function sync() {
    range.value = (Math.round(currentT * 10) / 10).toFixed(1);
    range.setAttribute('aria-valuetext', `${sec(currentT)}（全${DURATION}秒）`);
    clock.textContent = `${sec(currentT)} / ${sec(DURATION)}`;
    play.textContent = playing ? '一時停止' : '再生';
    play.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
  function tick(now) {
    if (!playing) return;
    const t = Math.min(DURATION, from + (now - startedAt) / 1000);
    currentT = t;
    render(t);
    if (t >= DURATION) {
      playing = false;
      raf = 0;
    } else {
      raf = requestAnimationFrame(tick);
    }
    sync();
  }
  function start() {
    if (!facts || playing) return;
    if (currentT >= DURATION - 0.05) currentT = 0;
    from = currentT;
    startedAt = performance.now();
    playing = true;
    raf = requestAnimationFrame(tick);
    sync();
  }
  function stop() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    sync();
  }
  function jump(t) {
    stop();
    currentT = clampTime(t);
    if (facts) render(currentT);
    sync();
  }

  play.addEventListener('click', () => (playing ? stop() : start()));
  // 矢印キーはスライダー標準（0.1秒）。Home・End は先頭・末尾、PageUp・PageDown は2秒ずつ（Home から7回で14秒）
  range.addEventListener('input', () => jump(Number(range.value)));
  range.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const moves = {Home: () => 0, End: () => DURATION, PageUp: () => currentT + 2, PageDown: () => currentT - 2};
    if (Object.hasOwn(moves, event.key)) {
      event.preventDefault();
      jump(Math.round(moves[event.key]() * 10) / 10);
    }
  });
  reload.addEventListener('click', () => location.reload());
  window.motionReady.then(() => {
    play.disabled = false;
    range.disabled = false;
    sync();
  }, () => {
    reload.hidden = false;
  });
}
if (!RENDER) setupPreview();
