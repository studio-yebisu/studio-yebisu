// Motion Video Kit の仕組みを描く共有モジュール（紹介ページと32秒の解説映像で共用）。
// loadEvidence()：固定した25件の記録を読み、SHA-256と相互の関係を確かめ、実フレーム5枚を復号する。
// drawMap()：時刻 t（0–32秒）だけから図を描く純粋関数。壁時計・乱数・前フレームの積算を使わない。
// 読み込んだだけでは何も初期化しない。紹介ページは index.html から initMain() を呼ぶ。

export const COMMIT = 'e4b1c0004080fe6a0deb883631bad5eba1e5f339';
export const MANIFEST_SHA256 = 'c06042bab1b63648880f2676cbfff082374c7855a17c15236519a5a4fbe5a150';
export const DURATION = 32;
export const SCENES = Object.freeze([
  { t: 0, label: '本と実入力' },
  { t: 4, label: 'BRIEFと絵コンテ' },
  { t: 8, label: '部品2本を描画' },
  { t: 14, label: '別のAIが見る' },
  { t: 20, label: '8場面へ組む' },
  { t: 26, label: '測定と判断を分ける' },
  { t: 29, label: '実出力と全体' },
]);

const FILES = [
  'concept/structure.json', 'concept/original-run.json', 'input.md', 'request.txt', 'BRIEF.md', 'storyboard.json',
  'samples.json', 'review-summary.json', 'lab/measurements.json', 'components.mjs', 'film/film.mjs',
  'vendor/motion-video-kit/README.md', 'vendor/motion-video-kit/LICENSE',
  'vendor/motion-video-kit/business-motion-film/SKILL.md',
  'vendor/motion-video-kit/business-motion-film/references/motion-grammar.md',
  'vendor/motion-video-kit/business-motion-film/references/launch-film-notes.md',
  'vendor/motion-video-kit/business-motion-film/references/quality-bar.md',
  'vendor/motion-video-kit/business-motion-film/references/gauntlet.md',
  'vendor/motion-video-kit/business-motion-film/references/critic-prompts.md',
  'vendor/motion-video-kit/business-motion-film/scripts/frozen-time.sh',
  'concept/selection-2p4.png', 'concept/materialize-2p4.png', 'assets/film-00.png', 'assets/film-12.png', 'assets/film-18.png',
];
const FRAMES = { selection: 'concept/selection-2p4.png', materialize: 'concept/materialize-2p4.png', film00: 'assets/film-00.png', film12: 'assets/film-12.png', film18: 'assets/film-18.png' };
const PART_IDS = ['brief', 'grammar', 'storyboard', 'lab', 'critic', 'measure'];
const CASE_IDS = ['selection', 'materialize', 'studio-intro'];
const RECEIPTS = ['storyboard', 'components', 'component-fixes', 'caption', 'film-site', 'film-fixes', 'handoff'];
const HEX64 = /^[0-9a-f]{64}$/;
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export class EvidenceError extends Error {
  constructor(message) { super(message); this.name = 'EvidenceError'; }
}
const need = (ok, message) => { if (!ok) throw new EvidenceError(message); };
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

export async function sha256(bytes) {
  need(globalThis.crypto?.subtle, 'この閲覧環境ではWebCryptoが使えず、記録の整合性を確かめられません（https または localhost で開いてください）。');
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

async function fetchBytes(url, label) {
  let res;
  try { res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' }); }
  catch { throw new EvidenceError(`${label} を読み込めませんでした。通信を確かめて、もう一度読み込んでください。`); }
  need(res.ok, `${label} を読み込めませんでした（HTTP ${res.status}）。`);
  return new Uint8Array(await res.arrayBuffer());
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
function asText(bytes, label) {
  try { return utf8.decode(bytes); } catch { throw new EvidenceError(`${label} をUTF-8の文章として読めません。`); }
}
function asJson(bytes, label) {
  const s = asText(bytes, label);
  try { return JSON.parse(s); } catch { throw new EvidenceError(`${label} をJSONとして読めません。`); }
}

async function decodePng(bytes, path) {
  need(PNG_SIG.every((b, i) => bytes[i] === b), `${path} はPNGの形式ではありません。`);
  const blob = new Blob([bytes], { type: 'image/png' });
  let img;
  try {
    if (typeof createImageBitmap === 'function') img = await createImageBitmap(blob);
    else img = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob), el = new Image();
      el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
      el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      el.src = url;
    });
  } catch { throw new EvidenceError(`${path} を画像として復号できません。`); }
  const w = img.naturalWidth ?? img.width, h = img.naturalHeight ?? img.height;
  need(w === 1920 && h === 1080, `${path} は1920×1080の実フレームではありません（${w}×${h}）。`);
  return img;
}

/** 25件を読み、バイト数・SHA-256・相互の関係・実フレームの復号を確かめる。どれか一つでも違えば EvidenceError。 */
export async function loadEvidence(base = './') {
  const root = new URL(base, document.baseURI);
  const at = p => new URL(p, root).href;
  const mBytes = await fetchBytes(at('concept/manifest.json'), 'concept/manifest.json');
  need(await sha256(mBytes) === MANIFEST_SHA256, 'concept/manifest.json のSHA-256が固定値と一致しません。記録が差し替わっている可能性があります。');
  const manifest = asJson(mBytes, 'concept/manifest.json');
  need(isObj(manifest) && manifest.id === 'motion-video-kit-example' && manifest.revision === 'visual-r1'
    && Array.isArray(manifest.files) && manifest.files.length === FILES.length,
  `concept/manifest.json の形が想定（作例ID・visual-r1・${FILES.length}件）と違います。`);
  manifest.files.forEach((f, i) => need(isObj(f) && f.path === FILES[i] && Number.isSafeInteger(f.bytes) && f.bytes > 0 && HEX64.test(f.sha256),
    `concept/manifest.json の${i + 1}件目（${f?.path ?? '不明'}）の項目が想定と違います。`));
  const shaOf = new Map(manifest.files.map(f => [f.path, f.sha256]));
  const files = new Map();
  await Promise.all(manifest.files.map(async f => {
    const bytes = await fetchBytes(at(f.path), f.path);
    need(bytes.byteLength === f.bytes, `${f.path} の大きさが記録（${f.bytes}バイト）と違います（${bytes.byteLength}バイト）。`);
    need(await sha256(bytes) === f.sha256, `${f.path} のSHA-256が記録と一致しません。`);
    files.set(f.path, bytes);
  }));
  const ev = relate(files, shaOf);
  const images = {};
  for (const [key, path] of Object.entries(FRAMES)) images[key] = await decodePng(files.get(path), path);
  return Object.freeze({ ...ev, manifest, files, images: Object.freeze(images) });
}

function relate(files, shaOf) {
  const T = p => asText(files.get(p), p), J = p => asJson(files.get(p), p);
  const structure = J('concept/structure.json'), run = J('concept/original-run.json'), storyboard = J('storyboard.json');
  const samples = J('samples.json'), review = J('review-summary.json'), lab = J('lab/measurements.json');
  const requestText = T('request.txt'), storyboardText = T('storyboard.json');
  T('input.md'); T('BRIEF.md');

  need(isObj(structure) && structure.id === 'motion-video-kit-example' && structure.source_commit === COMMIT,
    'concept/structure.json の作例IDまたは固定コミットが違います。');
  need(Array.isArray(structure.parts) && structure.parts.map(p => p?.id).join() === PART_IDS.join(), '6つの区分の並びが記録と違います。');
  for (const p of structure.parts) {
    need(['label', 'meaning', 'quote', 'source_path', 'upstream_path', 'source_url'].every(k => typeof p[k] === 'string' && p[k])
      && Number.isInteger(p.line_start) && p.line_start > 0, `区分「${p.id}」の項目が欠けています。`);
    need(p.source_path === `vendor/motion-video-kit/${p.upstream_path}` && files.has(p.source_path), `区分「${p.id}」の原文ファイルが同梱の固定版にありません。`);
    need(p.source_url === `https://github.com/echris6/motion-video-kit/blob/${COMMIT}/${p.upstream_path}#L${p.line_start}`, `区分「${p.id}」の原典URLが固定コミットの行と対応しません。`);
    const line = T(p.source_path).split(/\r?\n/)[p.line_start - 1];
    need(typeof line === 'string' && line.includes(p.quote), `区分「${p.id}」の引用が ${p.upstream_path} の${p.line_start}行目に見つかりません。`);
  }
  need(Array.isArray(structure.mechanisms) && structure.mechanisms.join() === '選ぶと広がる,結果が組み上がる,残る道筋', '3つの動きの記録が違います。');

  const expect = {
    selection: [4, 240, 'KEEP', 'lab/selection-proof.mp4', 'concept/selection-2p4.png'],
    materialize: [4, 240, 'KEEP', 'lab/materialize-proof.mp4', 'concept/materialize-2p4.png'],
    'studio-intro': [20, 1200, 'SHIP', 'film.mp4', 'assets/film-12.png'],
  };
  need(Array.isArray(structure.cases) && structure.cases.map(c => c?.id).join() === CASE_IDS.join(), '3つの記録（部品2本と本編）の並びが違います。');
  const cases = {};
  for (const c of structure.cases) {
    const [dur, frames, verdict, video, frame] = expect[c.id];
    need(c.duration === dur && c.fps === 60 && c.frame_count === frames && c.verdict === verdict && c.video === video
      && c.evidence_frame === frame && HEX64.test(c.sha256) && typeof c.label === 'string' && typeof c.scope === 'string',
    `記録「${c.id}」の尺・フレーム数・判断・ハッシュが想定と違います。`);
    cases[c.id] = c;
  }
  for (const id of ['selection', 'materialize']) {
    const c = cases[id];
    for (const [list, label] of [[review.components, 'review-summary.json'], [lab.components, 'lab/measurements.json'], [run.reviews?.components, 'concept/original-run.json']]) {
      need(Array.isArray(list) && list.length === 2, `${label} の部品レビューが2件ではありません。`);
      const r = list.find(x => x?.id === id);
      need(r && r.video === c.video && r.video_sha256 === c.sha256 && r.duration === 4 && r.fps === 60 && r.frames === 240
        && r.width === 1920 && r.height === 1080 && r.audio === false && r.review_verdict === 'KEEP' && HEX64.test(r.review_report_sha256),
      `${label} の部品「${id}」の記録が実MP4と対応しません。`);
    }
  }
  need(lab.human_approval === false, 'lab/measurements.json に人の承認の記録が想定外の値で入っています。');

  const film = cases['studio-intro'], v = run.film?.video;
  need(isObj(v) && v.sha256 === film.sha256 && v.width === 1920 && v.height === 1080 && v.fps === 60 && v.frameCount === 1200
    && v.duration === 20 && v.hasAudio === false, '本編MP4の仕様（20秒・1920×1080・60fps・1200フレーム・無音）が記録と違います。');
  need(review.film_video_sha256 === film.sha256 && review.full_film_verdict === 'SHIP' && review.human_approval === false
    && run.reviews?.full_film_verdict === 'SHIP' && run.reviews.human_approval === false && run.runtime?.human_approval === false
    && run.runtime.sample_count === 1, '本編の判断（別のAIがSHIP・人の承認なし）の記録が一致しません。');
  const ft = review.frozen_time, m = structure.measure;
  need(isObj(ft) && ft.sha256 === film.sha256 && ft.near_frozen_seconds === 5.5 && ft.longest_non_CTA_run?.seconds === 1.7
    && ft.source_target?.met === false && review.original_numeric_frozen_target_met === false && Array.isArray(ft.runs) && ft.runs.length > 0
    && ft.runs.every(r => Number.isFinite(r?.start) && Number.isFinite(r?.seconds)) && ft.video?.audio_streams === 0,
  'frozen-timeの実測（5.5秒・最長1.7秒・目安未達）の記録が想定と違います。');
  need(isObj(m) && m.file === 'review-summary.json' && m.near_frozen_seconds === 5.5 && m.longest_non_cta === 1.7 && m.original_target_met === false
    && m.ai_verdict === 'SHIP' && m.human_approval === false, '測定とAIの判断を分けた記録が review-summary.json と一致しません。');

  need(Array.isArray(review.ledger), 'レビューの順番の記録がありません。');
  const pick = test => review.ledger.filter(r => test(String(r?.round ?? '')));
  const rounds = {
    selection: pick(r => r.startsWith('selection-')),
    materialize: pick(r => r.startsWith('materialize-')),
    'studio-intro': ['full-film-v1', 'full-film-v2', 'film-v3'].map(id => review.ledger.find(r => r?.round === id)),
  };
  need(rounds['studio-intro'].map(r => r?.verdict).join('|') === 'ONE MORE PASS|ONE MORE PASS|SHIP'
    && rounds['studio-intro'][2].artifact_sha256 === film.sha256, '本編の3回の確認（もう一度→もう一度→SHIP）の記録が違います。');
  need(rounds.selection.at(-1)?.verdict === 'KEEP' && rounds.materialize.at(-1)?.verdict === 'KEEP', '部品の最後の判断がKEEPではありません。');

  need(Array.isArray(run.model_receipts) && run.model_receipts.map(r => r?.phase).join() === RECEIPTS.join()
    && run.model_receipts.every(r => HEX64.test(r.receipt_sha256)), '作者AIの7回の執筆の受領記録が想定と違います。');

  need(samples?.format === 'input-output' && Array.isArray(samples.samples) && samples.samples.length === 1, 'samples.json の実入力が1件ではありません。');
  const s0 = samples.samples[0];
  need(s0.id === 'studio-intro' && s0.input_file === 'input.md' && s0.spec?.duration === 20 && s0.spec.width === 1920 && s0.spec.height === 1080
    && s0.spec.fps === 60 && s0.spec.audio === false && s0.output_files?.video === 'film.mp4' && s0.output_files.storyboard_data === 'storyboard.json'
    && Array.isArray(s0.scenes) && s0.scenes.length === 8, 'samples.json の実入力（studio-intro・20秒の仕様）が想定と違います。');
  need(storyboard?.duration === 20 && storyboard.fps === 60 && storyboard.width === 1920 && storyboard.height === 1080 && storyboard.frames === 1200
    && storyboard.audio === false && Array.isArray(storyboard.scenes) && storyboard.scenes.length === 8, 'storyboard.json の8場面・20秒の仕様が違います。');
  storyboard.scenes.forEach((sc, i) => need(sc?.id === `S0${i + 1}` && sc.id === s0.scenes[i].id && sc.start === s0.scenes[i].start
    && typeof sc.mechanism === 'string' && typeof sc.title === 'string', `storyboard.json の場面 ${i + 1} が samples.json と対応しません。`));
  need(storyboard.scenes[0].start === 0 && storyboard.scenes[7].end === 20, 'storyboard.json の場面が0–20秒を覆っていません。');

  const d = structure.download;
  need(isObj(d) && d.path === 'storyboard.json' && d.bytes === 6267 && d.sha256 === shaOf.get('storyboard.json')
    && files.get('storyboard.json').byteLength === 6267, '保存する元の絵コンテ（6267バイト）の記録が一致しません。');
  need(structure.input?.file === 'input.md' && structure.input.bytes === files.get('input.md').byteLength, '実入力 input.md の大きさが記録と違います。');

  const af = run.actual_movie_frames;
  need(isObj(af) && af.movie_sha256 === film.sha256 && af.human_approval === false && Array.isArray(af.frames), '本編から書き出した実フレームの記録が違います。');
  for (const [file, seconds, frame] of [['assets/film-00.png', 0, 0], ['assets/film-12.png', 12, 720], ['assets/film-18.png', 18, 1080]]) {
    const f = af.frames.find(x => x?.file === file);
    need(f && f.seconds === seconds && f.movie_frame === frame && f.sha256 === shaOf.get(file), `${file} が本編の${seconds}秒目の実フレームとして記録と対応しません。`);
  }
  for (const id of ['selection', 'materialize']) {
    const c = cases[id], f = run.decoded_component_frames?.find(x => x?.file === c.evidence_frame);
    need(f && f.movie_frame === 144 && f.seconds === 2.4 && f.source === c.video && f.source_sha256 === c.sha256 && f.sha256 === shaOf.get(c.evidence_frame),
      `${c.evidence_frame} が4秒の検証MP4の144フレーム目として記録と対応しません。`);
  }

  const kinds = storyboard.scenes.map(sc => (/選ぶと広がる/.test(sc.mechanism) ? 'sel' : /結果/.test(sc.mechanism) ? 'mat' : /残る道筋/.test(sc.mechanism) ? 'rail' : 'actor'));
  return { structure, run, storyboard, samples, review, lab, requestText, storyboardText, storyboardBytes: files.get('storyboard.json'), cases, rounds, kinds };
}

// ---- 時刻の計算（すべて t だけの関数）
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const between = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : clamp01((t - a) / (b - a)));
const smooth = p => (p = clamp01(p), p * p * p * (p * (p * 6 - 15) + 10));
const fadeIn = (t, a, d = 0.4) => smooth(between(t, a, a + d));
const lerp = (a, b, p) => a + (b - a) * p;
const lerpR = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));
/** 速く出て長く減速して着く（k=0.25までは二次、その先は三次。速度は連続）。 */
const TA = 1 / (0.0625 + 0.125), TB = (2 * TA * 0.25) / (3 * 0.5625);
const travel = p => (p = clamp01(p), p < 0.25 ? TA * p * p : 1 - TB * (1 - p) ** 3);
const windows = (t, list, d = 0.12) => Math.min(1, list.reduce((s, [a, b]) => s + fadeIn(t, a, d) * (1 - fadeIn(t, b, d)), 0));

// ---- 色と書体（OSの書体だけ）
const SANS = "'Yu Gothic','YuGothic','Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Meiryo',sans-serif";
const SERIF = "'Yu Mincho','YuMincho','Hiragino Mincho ProN','Noto Serif JP',serif";
const LIGHT = { paper: '#F6F3EB', face: '#FBF9F3', ink: '#17282B', teal: '#0B615E', ochre: '#F1BE47', mute: 'rgba(23,40,43,0.68)', line: 'rgba(23,40,43,0.36)', faint: 'rgba(23,40,43,0.15)' };
const DARK = { paper: '#11191B', face: '#1A2528', ink: '#ECE6D9', teal: '#6CC3BA', ochre: '#E9B949', mute: 'rgba(236,230,217,0.72)', line: 'rgba(236,230,217,0.42)', faint: 'rgba(236,230,217,0.17)' };

// ---- 配置（設計座標）。sq は幅300のスマートフォン、wide は1280×720、tall は720×1280。
// 線の経路はノードの文字を横切らないように手で決めている。
const LAYOUTS = {
  sq: {
    key: 'sq', W: 300, H: 304, fs: 11.5, ft: 12.5, fb: 14, rad: 6, lw: 1.3, u: 1,
    book: [4, 4, 90, 118], input: [4, 130, 90, 74], creator: { cx: 126, cy: 124, r: 26 },
    lab: [104, 4, 58, 60], op: [170, 4, 58, 60], critic: [238, 4, 58, 60],
    strip: [104, 164, 168, 28], page: [108, 156, 40, 46], measure: [4, 216, 198, 86], output: [206, 204, 90, 98],
    path: {
      feed1: [[94, 100], [104, 112]], feed2: [[94, 160], [104, 137]], fwd: [[126, 98], [126, 64]],
      labop: [[162, 34], [170, 34]], movie: [[228, 34], [238, 34]], notes: [[267, 64], [267, 82], [144, 82], [144, 105]],
      brief: [[126, 150], [126, 164]], code: [[251, 192], [251, 204]], ship: [[290, 64], [290, 204]],
    },
    assemble: [[178, 96]],
    slots: { sel: [5, 19, 22, 15], mat: [31, 19, 22, 15] },
    tok: { movie: [26, 15], note: [11, 13], code: [12, 9], sheet: [11, 14] },
    lbl: { strip: [158, 158], notes: [190, 78] },
  },
  wide: {
    key: 'wide', W: 1280, H: 720, fs: 20, ft: 24, fb: 32, rad: 12, lw: 2.4, u: 2.1,
    book: [32, 36, 240, 372], input: [32, 440, 240, 244], creator: { cx: 388, cy: 400, r: 60 },
    lab: [330, 36, 210, 180], op: [590, 36, 210, 180], critic: [892, 36, 236, 180],
    strip: [480, 356, 480, 92], page: [492, 316, 96, 132], measure: [480, 512, 492, 172], output: [1012, 292, 236, 392],
    path: {
      feed1: [[272, 300], [306, 300], [306, 380], [331, 380]], feed2: [[272, 560], [306, 560], [306, 420], [331, 420]],
      fwd: [[388, 340], [388, 216]], labop: [[540, 126], [590, 126]], movie: [[800, 126], [892, 126]],
      notes: [[940, 216], [940, 266], [426, 266], [426, 354]], brief: [[448, 400], [480, 400]],
      code: [[960, 400], [1012, 400]], ship: [[1070, 216], [1070, 292]],
    },
    assemble: [[560, 292]],
    slots: { sel: [20, 60, 76, 52], mat: [114, 60, 76, 52] },
    tok: { movie: [92, 52], note: [32, 40], code: [34, 26], sheet: [30, 38] },
    lbl: { strip: [480, 342], notes: [600, 256], ship: [1084, 262], creator: [388, 490], legend: [[480, 486], [640, 486], [840, 486]] },
  },
  tall: {
    key: 'tall', W: 720, H: 1280, fs: 22, ft: 28, fb: 40, rad: 14, lw: 3, u: 2.3,
    lab: [24, 28, 200, 200], op: [260, 28, 200, 200], critic: [496, 28, 200, 200],
    book: [28, 288, 300, 316], input: [28, 616, 300, 196], creator: { cx: 524, cy: 420, r: 76 },
    strip: [360, 568, 332, 88], page: [372, 520, 100, 140], output: [360, 700, 332, 300], measure: [28, 1028, 664, 232],
    path: {
      fwd: [[524, 344], [524, 262], [124, 262], [124, 228]], labop: [[224, 128], [260, 128]], movie: [[460, 128], [496, 128]],
      notes: [[620, 228], [620, 388], [593, 388]], feed1: [[328, 420], [448, 420]],
      feed2: [[328, 714], [344, 714], [344, 450], [454, 450]], brief: [[524, 496], [524, 568]],
      code: [[660, 656], [660, 700]], ship: [[696, 128], [708, 128], [708, 960], [692, 960]],
    },
    assemble: [[150, 250], [340, 272], [352, 540]],
    slots: { sel: [16, 64, 76, 56], mat: [108, 64, 76, 56] },
    tok: { movie: [96, 54], note: [34, 42], code: [36, 28], sheet: [32, 40] },
    lbl: { strip: [360, 552], notes: [632, 310], legendTitle: [28, 862], legend: [[28, 906], [28, 946], [28, 986]] },
  },
};
export const layoutSize = key => ({ W: LAYOUTS[key].W, H: LAYOUTS[key].H });
export const pickLayout = (w, h) => (w / h > 1.3 ? 'wide' : w / h < 0.75 ? 'tall' : 'sq');

const ENDS = { feed1: ['book', 'creator'], feed2: ['input', 'creator'], fwd: ['creator', 'lab'], labop: ['lab', 'op'], movie: ['op', 'critic'], notes: ['critic', 'creator'], ship: ['critic', 'output'], code: ['strip', 'output'], brief: ['creator', 'page'] };
const FLOWS = [['feed1', 4.2, 0.8], ['feed2', 4.4, 0.8], ['brief', 5.4, 0.4], ['fwd', 8.0, 0.5], ['labop', 10.4, 0.4], ['movie', 14.2, 0.4], ['notes', 16.3, 0.6], ['ship', 28.0, 0.4], ['code', 28.1, 0.4]];
// 運ばれる物：実入力の紙・コード・実MP4・指摘。指摘は作者へ戻るだけで、映像を自動では直さない。
const TRIPS = [
  { kind: 'sheet', path: 'feed1', t0: 4.3, t1: 5.1 }, { kind: 'sheet', path: 'feed2', t0: 4.5, t1: 5.3 },
  { kind: 'code', path: 'labop', t0: 10.6, t1: 11.1 },
  { kind: 'proofs', path: 'movie', t0: 14.6, t1: 15.5 }, { kind: 'note', path: 'notes', t0: 16.4, t1: 17.5 },
  { kind: 'code', path: 'fwd', t0: 17.7, t1: 17.95 }, { kind: 'code', path: 'labop', t0: 17.95, t1: 18.15 },
  { kind: 'proofs', path: 'movie', t0: 18.4, t1: 18.75 },
  { kind: 'code', path: 'fwd', t0: 21.45, t1: 21.75 }, { kind: 'code', path: 'labop', t0: 21.75, t1: 22.0 },
  { kind: 'film', path: 'movie', t0: 22.75, t1: 23.25 }, { kind: 'note', path: 'notes', t0: 23.35, t1: 23.85 },
  { kind: 'code', path: 'fwd', t0: 23.95, t1: 24.1 }, { kind: 'code', path: 'labop', t0: 24.1, t1: 24.28 },
  { kind: 'film', path: 'movie', t0: 24.45, t1: 24.8 }, { kind: 'note', path: 'notes', t0: 24.85, t1: 25.2 },
  { kind: 'code', path: 'fwd', t0: 25.22, t1: 25.36 }, { kind: 'code', path: 'labop', t0: 25.36, t1: 25.5 },
  { kind: 'film', path: 'movie', t0: 25.56, t1: 25.9 },
  { kind: 'ship', path: 'ship', t0: 28.0, t1: 28.8 }, { kind: 'code', path: 'code', t0: 28.2, t1: 28.8 },
];
const PIPS = [5.3, 9.0, 17.6, 20.6, 21.4, 23.9, 28.4]; // 作者AIの7回の執筆（storyboard … handoff）
const SPIN = [[10.95, 11.6], [18.15, 18.4], [22.0, 22.55], [24.28, 24.45], [25.5, 25.56]];
const NODE_T = { creator: [2.8, 4.0], lab: [7.0, 8.0], op: [9.3, 10.3], critic: [13.0, 14.0], output: [27.0, 28.0] };
const STAGE_SETS = [
  ['book', 'input', 'feed1', 'feed2', 'creator', 'brief', 'strip'],
  ['creator', 'fwd', 'lab', 'labop', 'op', 'strip', 'brief', 'code', 'output'],
  ['op', 'movie', 'critic', 'notes', 'measure', 'ship', 'output', 'creator'],
];
const CAM = [
  { t: -1, nodes: ['book', 'input'] },
  { t: 3.3, nodes: ['book', 'input', 'creator', 'strip'] },
  { t: 7.5, nodes: ['creator', 'strip', 'lab', 'op'] },
  { t: 13.2, nodes: ['creator', 'lab', 'op', 'critic'] },
  { t: 19.5, nodes: ['creator', 'lab', 'op', 'critic', 'strip'] },
  { t: 25.3, nodes: ['strip', 'measure', 'output', 'critic'] },
  { t: 28.1, nodes: ['all'] },
];
const VERDICT_JA = { REVISE: '修正', 'ONE MORE PASS': 'もう一度', KEEP: 'KEEP', SHIP: 'SHIP' };
const SHORT_PART = { brief: '依頼', grammar: '動き', storyboard: '絵コンテ', lab: '部品', critic: '評価', measure: '測定' };
const PART_NODE = { brief: 'strip', grammar: 'strip', storyboard: 'strip', lab: 'lab', critic: 'critic', measure: 'measure' };

const rectOf = (L, name) => {
  if (name === 'creator') { const c = L.creator; return [c.cx - c.r, c.cy - c.r, 2 * c.r, 2 * c.r]; }
  if (name === 'all') return [0, 0, L.W, L.H];
  return L[name];
};
const centerOf = (L, name) => { const r = rectOf(L, name); return [r[0] + r[2] / 2, r[1] + r[3] / 2]; };
const route = (L, name) => [centerOf(L, ENDS[name][0]), ...L.path[name], centerOf(L, ENDS[name][1])];
const slotRect = (L, k) => { const s = L.slots[k]; return [L.lab[0] + s[0], L.lab[1] + s[1], s[2], s[3]]; };
const stripCells = L => { const [x, y, w, h] = L.strip, c = w / 8; return Array.from({ length: 8 }, (_, i) => [x + i * c, y, c, h]); };
const glyphBox = (L, c) => (L.key === 'sq' ? [c[0] + 3, c[1] + 4, c[2] - 6, c[3] - 8]
  : L.key === 'wide' ? [c[0] + 8, c[1] + 32, c[2] - 16, c[3] - 42] : [c[0] + 5, c[1] + 34, c[2] - 10, c[3] - 44]);
const measureCells = L => {
  const [x, y, w, h] = L.measure, gap = L.key === 'sq' ? 4 : 16, cw = (w - 2 * gap) / 3;
  return [0, 1, 2].map(i => [x + i * (cw + gap), y, cw, h]);
};

function windowFor(L, names) {
  const pad = 8 * L.u, rs = names.map(n => rectOf(L, n));
  const x0 = Math.min(...rs.map(r => r[0])) - pad, y0 = Math.min(...rs.map(r => r[1])) - pad;
  const x1 = Math.max(...rs.map(r => r[0] + r[2])) + pad, y1 = Math.max(...rs.map(r => r[1] + r[3])) + pad;
  const aspect = L.W / L.H;
  const w = Math.min(L.W, Math.max(L.W / 1.9, x1 - x0, (y1 - y0) * aspect)), h = w / aspect;
  const x = Math.min(L.W - w, Math.max(0, (x0 + x1) / 2 - w / 2)), y = Math.min(L.H - h, Math.max(0, (y0 + y1) / 2 - h / 2));
  return [x, y, w, h];
}
function cameraAt(L, t) {
  let win = windowFor(L, CAM[0].nodes);
  for (const k of CAM.slice(1)) {
    if (t < k.t) break;
    win = lerpR(win, windowFor(L, k.nodes), smooth(between(t, k.t, k.t + 0.9)));
  }
  return win;
}

function pointOn(pts, p) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
  let d = clamp01(p) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? Math.min(1, d / segs[i]) : 1;
      return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f), Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])];
    }
    d -= segs[i];
  }
  return [...pts[pts.length - 1], 0];
}

// ---- 描画の道具
function painter(ctx, P, L) {
  const g = {
    ctx, P, L,
    alpha: a => { ctx.globalAlpha = clamp01(a); },
    rr(x, y, w, h, r) {
      w = Math.max(0.01, w); h = Math.max(0.01, h); r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath(); ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    },
    box(r, { fill = null, stroke = null, lw = L.lw, dash = null, radius = L.rad, a = 1, sa = 1 } = {}) {
      if (a <= 0) return;
      g.rr(r[0], r[1], r[2], r[3], radius);
      if (fill) { g.alpha(a); ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) {
        g.alpha(a * sa); ctx.strokeStyle = stroke; ctx.lineWidth = lw;
        ctx.setLineDash(dash ? dash.map(v => v * L.u) : []); ctx.stroke(); ctx.setLineDash([]);
      }
    },
    text(str, x, y, { size = L.fs, weight = 500, serif = false, color = P.ink, align = 'left', a = 1, base = 'alphabetic' } = {}) {
      if (a <= 0 || !str) return;
      g.alpha(a); ctx.font = `${weight} ${size}px ${serif ? SERIF : SANS}`;
      ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(str, x, y);
    },
    line(pts, { color = P.line, lw = L.lw, a = 1, dash = null } = {}) {
      if (a <= 0) return;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      g.alpha(a); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash(dash ? dash.map(v => v * L.u) : []); ctx.stroke(); ctx.setLineDash([]);
    },
    dot(x, y, r, { fill = null, stroke = null, a = 1, lw = L.lw * 0.8 } = {}) {
      if (a <= 0) return;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { g.alpha(a); ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { g.alpha(a); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    },
    image(img, r, a = 1) {
      if (a <= 0 || !img) return;
      ctx.save(); g.rr(r[0], r[1], r[2], r[3], L.rad * 0.4); ctx.clip(); g.alpha(a);
      ctx.drawImage(img, r[0], r[1], r[2], r[3]); ctx.restore();
      g.box(r, { stroke: P.ink, sa: 0.3, lw: L.lw * 0.6, radius: L.rad * 0.4, a });
    },
  };
  return g;
}

/** 線を進み具合 p まで描き、先端に矢印を付ける。 */
function flow(g, pts, p, color, a) {
  if (p <= 0 || a <= 0) return;
  const { ctx, L } = g;
  const [x, y, ang] = pointOn(pts, p);
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
  const drawn = [pts[0]];
  let d = p * total;
  for (let i = 0; i < segs.length && d > segs[i]; i++) { drawn.push(pts[i + 1]); d -= segs[i]; }
  drawn.push([x, y]);
  g.line(drawn, { color, lw: L.lw, a });
  const s = L.lw * 3.4;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.lineTo(x - s * Math.cos(ang - 0.45), y - s * Math.sin(ang - 0.45));
  ctx.lineTo(x - s * Math.cos(ang + 0.45), y - s * Math.sin(ang + 0.45));
  ctx.closePath(); g.alpha(a); ctx.fillStyle = color; ctx.fill();
}

const pk = L => (sq, wide, tall) => (L.key === 'sq' ? sq : L.key === 'wide' ? wide : tall);

// ---- 部品2本の形（原制作の SelectionFrame / MaterializeFrame を図にしたもの）
function drawSel(g, r, t, a) {
  if (a <= 0) return;
  const { ctx, P, L } = g, rad = Math.min(r[2], r[3]) * 0.2;
  g.box(r, { fill: P.face, stroke: P.teal, lw: L.lw * 1.3, radius: rad, a });
  g.box([r[0] + r[2] * 0.18, r[1] + r[3] * 0.32, r[2] * 0.64, r[3] * 0.14], { fill: P.ink, a: a * 0.3, radius: 1 });
  g.box([r[0] + r[2] * 0.18, r[1] + r[3] * 0.56, r[2] * 0.4, r[3] * 0.12], { fill: P.ink, a: a * 0.18, radius: 1 });
  const per = 2 * (r[2] + r[3]), phase = (0.3 * Math.min(t, 28)) % 1;
  g.rr(r[0], r[1], r[2], r[3], rad);
  ctx.setLineDash([per * 0.14, per * 0.86]); ctx.lineDashOffset = -phase * per;
  g.alpha(a); ctx.strokeStyle = P.ochre; ctx.lineWidth = L.lw * 1.3; ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
}
function drawMat(g, r, fill, a) {
  if (a <= 0) return;
  const { P, L } = g, [x, y, w, h] = r, rad = Math.min(w, h) * 0.2;
  g.box(r, { fill: P.face, stroke: P.ink, sa: 0.55, lw: L.lw, radius: rad, a });
  [[x + w * 0.14, y + h * 0.18, w * 0.72, h * 0.18, P.teal, 0.9], [x + w * 0.14, y + h * 0.46, w * 0.34, h * 0.36, P.ink, 0.3], [x + w * 0.54, y + h * 0.46, w * 0.32, h * 0.36, P.ochre, 0.9]]
    .forEach(([rx, ry, rw, rh, c, o], i) => {
      const p = smooth(clamp01(fill * 3 - i));
      g.box([rx, ry + (1 - p) * h * 0.08, rw, rh], { fill: c, a: a * p * o, radius: 1.5 * L.u });
    });
}
/** 絵コンテの各場面に描く、機構の下書き（細い線）。 */
function drawGlyph(g, kind, r, a, last, color) {
  if (a <= 0) return;
  const { L } = g, [x, y, w, h] = r, lw = L.lw * 0.8, frame = [x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.6];
  if (kind === 'actor') {
    g.box(frame, { stroke: color, lw, radius: 2 * L.u, a });
    g.box([x + w * 0.28, y + h * 0.36, w * 0.44, h * 0.28], { fill: color, a: a * 0.35, radius: L.u });
  } else if (kind === 'sel') {
    g.box(frame, { stroke: color, lw, radius: 2 * L.u, a, dash: [2, 2] });
  } else if (kind === 'mat') {
    g.box(frame, { stroke: color, lw, radius: 2 * L.u, a });
    g.box([x + w * 0.2, y + h * 0.32, w * 0.6, h * 0.1], { fill: color, a: a * 0.3, radius: 1 });
  } else {
    g.line([[x + w * 0.08, y + h * 0.7], [x + w * 0.5, y + h * 0.7], [x + w * 0.5, y + h * 0.35], [x + w * (last ? 0.6 : 0.9), y + h * 0.35]], { color, lw, a });
    if (last) g.box([x + w * 0.58, y + h * 0.2, w * 0.36, h * 0.3], { fill: color, a: a * 0.85, radius: h * 0.15 });
    else g.dot(x + w * 0.9, y + h * 0.35, 1.6 * L.u, { fill: color, a });
  }
}
function drawMovie(g, img, r, a) {
  if (a <= 0) return;
  const { P, L } = g, pad = r[3] * 0.16;
  g.box(r, { fill: P.ink, radius: L.u * 1.5, a });
  for (let i = 0; i < 5; i++) {
    const sx = r[0] + r[2] * (0.1 + i * 0.2) - pad * 0.25;
    g.box([sx, r[1] + pad * 0.3, pad * 0.5, pad * 0.4], { fill: P.face, a: a * 0.8, radius: 0.5 });
    g.box([sx, r[1] + r[3] - pad * 0.7, pad * 0.5, pad * 0.4], { fill: P.face, a: a * 0.8, radius: 0.5 });
  }
  g.image(img, [r[0] + pad * 0.5, r[1] + pad, r[2] - pad, r[3] - pad * 2], a);
}
function drawToken(g, kind, x, y, a, ev) {
  if (a <= 0) return;
  const { P, L } = g;
  if (kind === 'proofs' || kind === 'film' || kind === 'ship') {
    const [w, h] = L.tok.movie;
    if (kind === 'proofs') {
      drawMovie(g, ev.images.selection, [x - w / 2, y - h * 1.12, w, h], a);
      drawMovie(g, ev.images.materialize, [x - w / 2, y + h * 0.12, w, h], a);
    } else drawMovie(g, ev.images.film00, [x - w / 2, y - h / 2, w, h], a);
    return;
  }
  const [w, h] = L.tok[kind], r = [x - w / 2, y - h / 2, w, h];
  if (kind === 'sheet') {
    g.box(r, { fill: P.face, stroke: P.ink, sa: 0.6, lw: L.lw * 0.7, radius: L.u, a });
    for (let i = 0; i < 3; i++) g.line([[r[0] + w * 0.2, r[1] + h * (0.3 + i * 0.2)], [r[0] + w * 0.8, r[1] + h * (0.3 + i * 0.2)]], { color: P.ink, lw: L.lw * 0.5, a: a * 0.5 });
  } else if (kind === 'code') {
    g.box(r, { fill: P.teal, radius: L.u * 1.5, a });
    g.line([[r[0] + w * 0.22, r[1] + h * 0.38], [r[0] + w * 0.7, r[1] + h * 0.38]], { color: P.face, lw: L.lw * 0.6, a });
    g.line([[r[0] + w * 0.32, r[1] + h * 0.64], [r[0] + w * 0.78, r[1] + h * 0.64]], { color: P.face, lw: L.lw * 0.6, a });
  } else if (kind === 'note') {
    const { ctx } = g, f = w * 0.32;
    ctx.beginPath(); ctx.moveTo(r[0], r[1]); ctx.lineTo(r[0] + w - f, r[1]); ctx.lineTo(r[0] + w, r[1] + f); ctx.lineTo(r[0] + w, r[1] + h); ctx.lineTo(r[0], r[1] + h); ctx.closePath();
    g.alpha(a); ctx.fillStyle = P.ochre; ctx.fill();
    for (let i = 0; i < 3; i++) g.line([[r[0] + w * 0.18, r[1] + h * (0.42 + i * 0.17)], [r[0] + w * 0.78, r[1] + h * (0.42 + i * 0.17)]], { color: '#17282B', lw: L.lw * 0.5, a: a * 0.7 });
  }
}

// ---- ノード
function nodeBox(g, r, a, ghost) {
  const { P, L } = g;
  if (ghost > 0) g.box(r, { stroke: P.ink, sa: 0.3, lw: L.lw * 0.8, dash: [3, 3], a: ghost });
  g.box(r, { fill: P.face, stroke: P.ink, sa: 0.5, a });
}

function paintBook(g, t, ev, o, a) {
  const { P, L } = g, [x, y, w, h] = L.book, u = L.u, p = pk(L);
  nodeBox(g, L.book, a, 0);
  g.line([[x + 5 * u, y + L.rad], [x + 5 * u, y + h - L.rad]], { color: P.ink, lw: L.lw * 0.6, a: a * 0.35 });
  g.line([[x + 8 * u, y + L.rad], [x + 8 * u, y + h - L.rad]], { color: P.ink, lw: L.lw * 0.6, a: a * 0.2 });
  if (L.key === 'sq') g.text('スキル', x + 12, y + 17, { size: L.ft, weight: 700, serif: true, a });
  else {
    g.text('Motion Video Kit', x + p(0, 24, 22), y + 46, { size: L.ft, weight: 700, serif: true, a });
    g.text('AIが読む手順書', x + p(0, 24, 22), y + p(0, 78, 80), { color: P.mute, a });
    if (L.key === 'tall') g.text('生成APIではない', x + 22, y + 108, { color: P.mute, a });
  }
  const rowX = x + p(12, 36, 34), rowY = i => y + p(34 + i * 14, 124 + i * 34, 138 + i * 26);
  ev.structure.parts.forEach((part, i) => {
    const ry = rowY(i), sweep = windows(t, [[0.5 + i * 0.35, 0.85 + i * 0.35]], 0.1);
    const hl = Math.max(sweep, o.highlight && o.part === part.id ? 1 : 0);
    if (hl > 0) g.box([rowX - 2 * u, ry + 2.2 * u, w - (rowX - x) - 10 * u, 2.4 * u], { fill: P.ochre, a: a * hl, radius: u });
    g.box([x + w - 2 * u, ry - L.fs * 0.85, 6 * u, L.fs * 0.95], { fill: hl > 0.5 ? P.ochre : P.teal, radius: u, a });
    g.text(L.key === 'sq' ? SHORT_PART[part.id] : part.label, rowX, ry, { a, weight: hl > 0.5 ? 700 : 500 });
  });
  if (L.key === 'wide') {
    g.text('生成APIではない', x + 24, y + 330, { color: P.mute, a });
    g.text('参考28本は未視聴', x + 24, y + 358, { color: P.mute, a });
  } else if (L.key === 'tall') g.text('参考28本は未視聴', x + 22, y + 304, { color: P.mute, a });
}

function paintInput(g, t, a) {
  const { P, L } = g, [x, y, w] = L.input, p = pk(L);
  nodeBox(g, L.input, a, 0);
  const lines = p(['サイト紹介', '作例を見る', '20秒·無音'],
    ['サイト紹介1本', 'CTA「作例を見る」', '20秒·1080p·60fps', '2D·無音', '全件作例とは言わない'],
    ['サイト紹介1本', 'CTA「作例を見る」', '20秒·1080p·60fps', '2D·無音', '全件作例とは言わない']);
  const lx = x + p(8, 18, 20);
  g.text('実入力', lx, y + p(16, 42, 42), { size: L.ft, weight: 700, a });
  if (L.key !== 'sq') g.text('input.md', x + w - 18, y + 42, { color: P.mute, align: 'right', a });
  lines.forEach((s, i) => {
    const ly = y + p(34 + i * 15, 78 + i * 30, 76 + i * 28), sweep = windows(t, [[2.4 + i * 0.3, 2.75 + i * 0.3]], 0.1);
    if (sweep > 0) g.box([lx - 2 * L.u, ly + 2.2 * L.u, w - (lx - x) - 8 * L.u, 2.4 * L.u], { fill: P.ochre, a: a * sweep, radius: L.u });
    g.text(s, lx, ly, { a });
  });
}

function paintCreator(g, t, a, ghost) {
  const { P, L } = g, { cx, cy, r } = L.creator, p = pk(L);
  if (ghost > 0) { g.ctx.setLineDash([3 * L.u, 3 * L.u]); g.dot(cx, cy, r, { stroke: P.ink, a: ghost * 0.3 }); g.ctx.setLineDash([]); }
  if (a <= 0) return;
  for (const at of PIPS) {
    const q = between(t, at, at + 0.6);
    if (q > 0 && q < 1) g.dot(cx, cy, r * (1 + 0.22 * q), { stroke: P.teal, a: a * (1 - q) * 0.6 });
  }
  g.dot(cx, cy, r, { fill: P.face, a });
  g.dot(cx, cy, r, { stroke: P.teal, lw: L.lw * 1.4, a });
  g.text('作者AI', cx, cy + p(-3, -14, -26), { size: L.ft, weight: 700, align: 'center', base: 'middle', a });
  if (L.key !== 'sq') g.text('Opus 5.5', cx, cy + p(0, 14, 4), { align: 'center', base: 'middle', color: P.mute, a });
  if (L.key === 'tall') g.text('7回の執筆', cx, cy + 32, { align: 'center', base: 'middle', a });
  const py = cy + p(11, 38, 56), gap = p(5.6, 10, 12), pr = p(1.9, 3.4, 4);
  PIPS.forEach((at, i) => {
    const px = cx + (i - 3) * gap;
    g.dot(px, py, pr, { stroke: P.teal, lw: L.lw * 0.6, a });
    g.dot(px, py, pr, { fill: P.teal, a: a * fadeIn(t, at, 0.3) });
  });
}

function paintLab(g, t, a, ghost) {
  const { P, L } = g, [x, y] = L.lab, p = pk(L);
  nodeBox(g, L.lab, a, ghost);
  if (a <= 0) return;
  const pre = a * (1 - fadeIn(t, 19.9, 0.1)), post = a * fadeIn(t, 20.9, 0.3), sub = pre * fadeIn(t, 9.2, 0.3);
  const tx = x + p(5, 20, 16), ty = y + p(14, 40, 42);
  g.text(p('部品2本', '部品のコード', '部品2本'), tx, ty, { size: L.ft, weight: 700, a: pre });
  g.text(p('本編コード', '本編のコード', '本編のコード'), tx, ty, { size: L.ft, weight: 700, a: post });
  if (L.key === 'sq') {
    g.text('各4秒', tx, y + 54, { color: P.mute, a: sub });
    g.text('film.mjs', tx, y + 54, { color: P.mute, a: post });
  } else {
    const sl = p(0, 140, 152);
    g.text('選択枠', x + L.slots.sel[0], y + sl, { a: sub });
    g.text('組み上げ', x + L.slots.mat[0], y + sl, { a: sub });
    g.text(p('', '各4秒で単独に検証', '各4秒で検証'), tx, y + p(0, 168, 186), { color: P.mute, a: sub });
    ['部品は変えず', '時刻とデータで', '8場面を組む'].forEach((s, i) => g.text(s, tx, y + p(0, 80, 86) + i * p(0, 32, 36), { a: post }));
    g.text(p('', 'film/film.mjs', 'film.mjs'), tx, y + p(0, 172, 192), { color: P.mute, a: post });
  }
  const resident = a * (1 - fadeIn(t, 20.0, 0.1));
  if (t >= 9.0) drawSel(g, slotRect(L, 'sel'), t, resident);
  if (t >= 9.3) drawMat(g, slotRect(L, 'mat'), between(t, 9.4, 10.3), resident);
}

function paintOp(g, t, ev, o, a, ghost) {
  const { ctx, P, L } = g, [x, y, w] = L.op, p = pk(L);
  nodeBox(g, L.op, a, ghost);
  if (a <= 0) return;
  const tx = x + p(5, 20, 16);
  g.text('制作担当', tx, y + p(14, 40, 42), { size: L.ft, weight: 700, a });
  g.text(p('描画·測定', 'Motion Reelで描画', 'Motion Reel'), tx, y + p(28, 70, 74), { color: P.mute, a });
  if (L.key !== 'sq') g.text(p('', 'frozen-timeで測定', '描画と測定'), tx, y + p(0, 98, 104), { color: P.mute, a });
  const spin = windows(t, SPIN, 0.06);
  if (spin > 0) {
    const sx = x + w - p(8, 28, 28), sy = y + p(10, 32, 34), sr = p(4, 9, 10), ang = t * 7;
    ctx.beginPath(); ctx.arc(sx, sy, sr, ang, ang + 4.2);
    g.alpha(a * spin); ctx.strokeStyle = P.teal; ctx.lineWidth = L.lw; ctx.stroke();
  }
  const single = p([x + 9, y + 34, 40, 22.5], [x + 20, y + 110, 104, 58.5], [x + 16, y + 118, 112, 63]);
  const pair = p([[x + 4, y + 37, 24, 13.5], [x + 30, y + 37, 24, 13.5]], [[x + 20, y + 112, 80, 45], [x + 108, y + 112, 80, 45]], [[x + 12, y + 122, 84, 47.25], [x + 104, y + 122, 84, 47.25]]);
  const proofs = windows(t, [[11.6, 14.6], [18.3, 18.4]]);
  g.image(ev.images.selection, pair[0], a * proofs);
  g.image(ev.images.materialize, pair[1], a * proofs);
  if (t < 25.95) g.image(ev.images.film00, single, a * windows(t, [[22.55, 22.75], [24.36, 24.45], [25.5, 25.56]]));
  else {
    const img = o.caseId === 'selection' ? ev.images.selection : o.caseId === 'materialize' ? ev.images.materialize : ev.images.film00;
    g.image(img, single, a * fadeIn(t, 25.95, 0.12));
  }
}

const roundsText = words => (words.length > 1 && words.every(w => w === words[0]) ? `${words[0]}×${words.length}` : words.join('→'));
function criticView(t, ev, caseId) {
  if (t >= 26) {
    const rs = ev.rounds[caseId] ?? ev.rounds['studio-intro'], last = rs.at(-1).verdict;
    return { a: 1, dots: rs.length, text: roundsText(rs.slice(0, -1).map(r => VERDICT_JA[r.verdict])), ta: 1, final: `v${rs.length} ${last}`, word: last, fa: 1 };
  }
  if (t < 20.3) {
    const a = fadeIn(t, 16.2, 0.2) * (1 - fadeIn(t, 20.1, 0.2));
    return { a, dots: t >= 18.9 ? 2 : 1, text: '修正', ta: 1 - fadeIn(t, 18.9, 0.15), final: 'KEEP×2', word: 'KEEP', fa: fadeIn(t, 19.05, 0.2) };
  }
  const a = fadeIn(t, 22.8, 0.2);
  const second = t >= 24.85, ta = second ? fadeIn(t, 25.0, 0.15) : fadeIn(t, 23.3, 0.2) * (1 - fadeIn(t, 24.85, 0.15));
  return { a, dots: t >= 25.92 ? 3 : second ? 2 : t >= 23.3 ? 1 : 0, text: second ? 'もう一度×2' : 'もう一度', ta, final: 'v3 SHIP', word: 'SHIP', fa: fadeIn(t, 25.92, 0.2) };
}
function paintCritic(g, t, ev, o, a, ghost) {
  const { P, L } = g, [x, y] = L.critic, p = pk(L);
  nodeBox(g, L.critic, a, ghost);
  if (a <= 0) return;
  const tx = x + p(5, 20, 16);
  g.text(p('別のAI', '別のAI', '新しい別のAI'), tx, y + p(14, 40, 42), { size: L.ft, weight: 700, a });
  if (L.key === 'sq') g.text('毎回新規', tx, y + 28, { color: P.mute, a });
  else if (L.key === 'wide') {
    g.text('毎回新しい担当', tx, y + 70, { color: P.mute, a });
    g.text('実MP4·BRIEF·参照', tx, y + 98, { a });
  } else {
    g.text('実MP4とBRIEF', tx, y + 76, { a });
    g.text('と参照を見る', tx, y + 104, { a });
  }
  const v = criticView(t, ev, o.caseId), va = a * v.a;
  if (va <= 0) return;
  const dy = y + p(38, 124, 126), dx = x + p(8, 26, 24), gap = p(7, 18, 18), dr = p(2.2, 6, 6);
  for (let i = 0; i < v.dots; i++) {
    const final = i === v.dots - 1 && v.fa > 0.5;
    g.dot(dx + i * gap, dy, dr, final ? { stroke: P.teal, lw: L.lw * 1.2, a: va } : { fill: P.ink, a: va * 0.55 });
  }
  if (L.key === 'wide') g.text(v.text, x + 90, y + 131, { a: va * v.ta });
  if (L.key === 'tall') g.text(v.text, tx, y + 156, { a: va * v.ta });
  g.text(L.key === 'sq' ? v.word : v.final, tx, y + p(54, 166, 190), { size: L.ft, weight: 700, a: va * v.fa });
}

const centerR = r => [r[0] + r[2] / 2, r[1] + r[3] / 2];
const grow = (r, d) => [r[0] - d, r[1] - d, r[2] + 2 * d, r[3] + 2 * d];
/** 組み立てで部品が絵コンテの場面へ着く時刻（選択枠・組み上げ枠の場面だけ、順に0.14秒ずらす）。 */
function assemblyStarts(ev) {
  let k = 0;
  return ev.kinds.map(kind => (kind === 'sel' || kind === 'mat' ? 20.0 + k++ * 0.14 : null));
}
/** 場面を越えて運ばれる1本の輪郭。1回目は絵コンテ、2回目は組み上げた本編の8場面を左から右へ渡る。 */
function outlineAt(L, t) {
  if (t < 7.6) return null;
  const cells = stripCells(L);
  const step = u => {
    const i = Math.min(7, Math.floor(u));
    return i >= 7 ? cells[7] : lerpR(cells[i], cells[i + 1], smooth(clamp01((u - i - 0.35) / 0.65)));
  };
  const r = t < 21.15 ? step(between(t, 7.6, 12.4) * 7) : step(between(t, 21.4, 25.4) * 7);
  const a = t < 21.15 ? fadeIn(t, 7.6, 0.3) * (1 - fadeIn(t, 21.0, 0.15)) : fadeIn(t, 21.15, 0.15);
  return { r: grow(r, 1.5 * L.u), a };
}

function paintStrip(g, t, ev, a) {
  if (t < 6.2 || a <= 0) return;
  const { P, L } = g, page = L.page, strip = L.strip, m = smooth(between(t, 6.4, 7.4));
  g.box(lerpR(page, strip, m), { fill: P.face, stroke: P.ink, sa: 0.5, radius: L.rad * 0.7, a });
  g.text('BRIEF', page[0] + page[2] * 0.12, page[1] + page[3] * 0.24, { weight: 700, a: a * (1 - smooth(between(t, 6.4, 6.65))) });
  // BRIEF の7行が、そのまま8場面の区切り7本になる。
  for (let i = 1; i <= 7; i++) {
    const ly = page[1] + page[3] * (0.36 + (i - 1) * 0.085), bx = strip[0] + (i * strip[2]) / 8;
    g.line([lerpR([page[0] + page[2] * 0.14, ly], [bx, strip[1] + strip[3] * 0.12], m), lerpR([page[0] + page[2] * 0.86, ly], [bx, strip[1] + strip[3] * 0.88], m)],
      { color: P.ink, lw: L.lw * 0.6, a: a * lerp(0.45, 0.25, m) });
  }
  if (m < 1) return;
  const starts = assemblyStarts(ev);
  stripCells(L).forEach((c, i) => {
    const ga = a * fadeIn(t, 7.3 + i * 0.06, 0.3), kind = ev.kinds[i], box = glyphBox(L, c);
    if (L.key === 'wide') g.text(String(ev.storyboard.scenes[i].start), c[0] + 4, c[1] + 24, { color: P.mute, a: ga });
    if (L.key === 'tall') g.text(String(i + 1), c[0] + 8, c[1] + 26, { color: P.mute, a: ga });
    const land = starts[i] != null ? fadeIn(t, starts[i] + 0.8, 0.2) : fadeIn(t, 21.2, 0.3);
    drawGlyph(g, kind, box, ga * (1 - land), i === 7, P.mute);
    if (starts[i] == null) drawGlyph(g, kind, box, ga * land, i === 7, P.teal);
  });
  const oc = outlineAt(L, t);
  if (oc) g.box(oc.r, { stroke: P.teal, lw: L.lw * 1.4, radius: L.rad * 0.6, a: a * oc.a });
}

function paintMeasure(g, t, ev, fa) {
  const { ctx, P, L } = g, p = pk(L), cells = measureCells(L), ft = ev.review.frozen_time, m = ev.structure.measure;
  const ghost = fadeIn(t, 25.4, 0.4) * (1 - fadeIn(t, 26.0, 0.3));
  if (ghost > 0) g.box(L.measure, { stroke: P.ink, sa: 0.3, dash: [3, 3], lw: L.lw * 0.8, a: ghost * fa });
  const as = [26.0, 26.35, 26.7].map(s => fadeIn(t, s, 0.4) * fa);
  if (as[0] <= 0) return;
  // 3つは別々の枠：補助スクリプトの実測／別のAIの判断／人の承認。合格の印は描かない。
  const styles = [{ sa: 0.55 }, { stroke: P.teal, dash: [5, 3], sa: 0.9 }, { dash: [1.5, 3], sa: 0.5 }];
  cells.forEach((c, i) => g.box(c, { fill: P.face, stroke: P.ink, ...styles[i], a: as[i] }));
  const pad = p(4, 14, 16), titles = p(['測定', 'AI判断', '人の承認'], ['補助の測定', '別のAIの判断', '人の承認'], ['補助の測定', '別のAIの判断', '人の承認']);
  cells.forEach((c, i) => g.text(titles[i], c[0] + pad, c[1] + p(13, 34, 40), { size: L.key === 'sq' ? L.fs : L.ft, weight: 700, a: as[i] }));
  const [c1, c2, c3] = cells;
  const bar = p([c1[0] + 4, c1[1] + 19, c1[2] - 8, 6], [c1[0] + 14, c1[1] + 50, c1[2] - 28, 14], [c1[0] + 16, c1[1] + 60, c1[2] - 32, 16]);
  g.box(bar, { fill: P.ink, a: as[0] * 0.08, radius: 1 });
  ctx.save(); ctx.beginPath(); ctx.rect(bar[0], bar[1] - 1, bar[2] * between(t, 26.2, 27.0), bar[3] + 2); ctx.clip();
  const lr = ft.longest_non_CTA_run;
  for (const run of ft.runs) {
    const longest = run.start === lr.start && run.seconds === lr.seconds;
    g.box([bar[0] + (run.start / 20) * bar[2], bar[1], Math.max(1, (run.seconds / 20) * bar[2]), bar[3]], { fill: longest ? P.ochre : P.ink, a: as[0] * (longest ? 1 : 0.6), radius: 0.5 });
  }
  ctx.restore();
  const na = as[0] * fadeIn(t, 26.9, 0.3), sp = L.key === 'sq' ? '' : ' ';
  const lines1 = [`静止${sp}${ft.near_frozen_seconds}秒`, `最長${sp}${lr.seconds}秒`, `目安 ${ft.source_target.met ? '達成' : '未達'}`];
  lines1.forEach((s, i) => g.text(s, c1[0] + pad, c1[1] + p([38, 54, 70], [94, 126, 156], [112, 150, 186])[i], { a: na, weight: i === 0 ? 700 : 500, size: i === 0 && L.key !== 'sq' ? L.ft : L.fs }));
  if (L.key === 'tall') g.text('≤1秒/30秒·0.6秒', c1[0] + pad, c1[1] + 218, { color: P.mute, a: na });
  const big = p([40, 58, 74], [92, 126, 156], [116, 156, 190]);
  g.text(m.ai_verdict, c2[0] + pad, c2[1] + big[0], { size: L.fb, weight: 700, a: as[1] });
  p(['≠数値合格', '≠品質保証'], ['数値の合格', 'ではない'], ['数値の合格', 'ではない'])
    .forEach((s, i) => g.text(s, c2[0] + pad, c2[1] + big[i + 1], { a: as[1] }));
  if (L.key === 'tall') g.text('品質保証でもない', c2[0] + pad, c2[1] + 222, { color: P.mute, a: as[1] });
  g.text(m.human_approval ? 'あり' : 'なし', c3[0] + pad, c3[1] + big[0], { size: L.fb, weight: 700, a: as[2] });
  g.text('未実施', c3[0] + pad, c3[1] + big[1], { color: P.mute, a: as[2] });
}

function paintOutput(g, t, ev, a, ghost) {
  const { P, L } = g, [x, y] = L.output, p = pk(L), u = L.u, v = ev.run.film.video;
  nodeBox(g, L.output, a, ghost);
  if (a <= 0) return;
  const tx = x + p(5, 16, 16);
  g.text('実出力', tx, y + p(14, 38, 38), { size: L.ft, weight: 700, a });
  const thumb = p([x + 5, y + 19, 80, 45], [x + 16, y + 54, 204, 114.75], [x + 16, y + 54, 180, 101.25]), ia = a * fadeIn(t, 28.55, 0.35);
  g.image(ev.images.film12, thumb, ia);
  if (L.key !== 'sq') {
    const iw = thumb[2] * 0.36, ih = thumb[3] * 0.36, inset = [thumb[0] + thumb[2] - iw - 4 * u, thumb[1] + thumb[3] - ih - 4 * u, iw, ih];
    g.box(grow(inset, 1.5 * u), { fill: P.face, radius: L.rad * 0.4, a: ia });
    g.image(ev.images.film18, inset, ia);
  }
  const lines = p(
    [[`film.mp4 ${v.duration}秒`, tx, 78, 1], ['+ソース·JSON', tx, 93, 0]],
    [['film.mp4', tx, 202, 1], [`${v.duration}秒·${v.width}×${v.height}`, tx, 232, 0], [`${v.fps}fps·${v.frameCount}f·無音`, tx, 262, 0],
      ['film/index.html', tx, 302, 0], ['storyboard.json', tx, 332, 0], ['（元の8場面）', tx, 362, 2]],
    [['film.mp4', x + 212, 80, 1], [`${v.duration}秒`, x + 212, 110, 0], [`${v.fps}fps`, x + 212, 138, 0], ['無音', x + 212, 166, 0],
      [`${v.width}×${v.height}·${v.frameCount}f`, tx, 196, 0], ['film/index.html', tx, 228, 0], ['storyboard.json', tx, 258, 0], ['（元の8場面）', tx, 288, 2]]);
  lines.forEach(([s, lx, ly, w], i) => g.text(s, lx, y + ly, { weight: w === 1 ? 700 : 500, color: w === 2 ? P.mute : P.ink, a: a * fadeIn(t, 28.7 + i * 0.05, 0.3) }));
}

/** 線の上を運ばれる物（ノードの下に描くので、ノードへ入ると隠れる）。 */
function paintTokens(g, t, ev, fa) {
  const { P, L } = g;
  for (const tr of TRIPS) {
    if (t < tr.t0 || t > tr.t1) continue;
    const [x, y] = pointOn(route(L, tr.path), travel(between(t, tr.t0, tr.t1)));
    drawToken(g, tr.kind, x, y, fa(tr.path), ev);
  }
  if (t >= 5.4 && t < 6.2) {
    const q = travel(between(t, 5.4, 6.2)), [x, y] = pointOn(route(L, 'brief'), q), [sw, sh] = L.tok.sheet;
    const w = lerp(sw, L.page[2], q), h = lerp(sh, L.page[3], q);
    g.box([x - w / 2, y - h / 2, w, h], { fill: P.face, stroke: P.ink, sa: 0.5, radius: L.rad * 0.7, a: fa('brief') });
    g.text('BRIEF', x - w / 2 + w * 0.12, y - h / 2 + h * 0.24, { weight: 700, a: fa('brief') * smooth(between(q, 0.6, 1)) });
  }
}

/** 部品2本の移動：作者から検証へ（8.2–9.3秒）、検証から絵コンテの場面へ（20.0秒〜）。 */
function paintComps(g, t, ev, faStrip, faLab) {
  const { L } = g, [cw, ch] = L.tok.code;
  for (const [kind, t0, t1] of [['sel', 8.2, 9.0], ['mat', 8.5, 9.3]]) {
    if (t < t0 || t >= t1) continue;
    const q = travel(between(t, t0, t1)), slot = slotRect(L, kind), [x, y] = pointOn([...L.path.fwd, centerR(slot)], q);
    const w = lerp(cw, slot[2], q), h = lerp(ch, slot[3], q), r = [x - w / 2, y - h / 2, w, h];
    if (kind === 'sel') drawSel(g, r, t, faLab); else drawMat(g, r, 0, faLab);
  }
  const starts = assemblyStarts(ev), cells = stripCells(L);
  ev.kinds.forEach((kind, i) => {
    const t0 = starts[i];
    if (t0 == null || t < t0) return;
    const q = travel(between(t, t0, t0 + 0.9)), from = slotRect(L, kind), to = glyphBox(L, cells[i]);
    const [x, y] = pointOn([centerR(from), ...L.assemble, centerR(to)], q), w = lerp(from[2], to[2], q), h = lerp(from[3], to[3], q);
    const r = [x - w / 2, y - h / 2, w, h];
    if (kind === 'sel') drawSel(g, r, t, faStrip); else drawMat(g, r, 1, faStrip);
  });
}

function paintLabels(g, t, ev, fa) {
  const { P, L } = g, p = pk(L), [sx, sy] = L.lbl.strip;
  g.text(p('8場面の絵コンテ', 'BRIEF → 8場面の絵コンテ', '8場面の絵コンテ'), sx, sy, { weight: 700, a: fadeIn(t, 7.3, 0.3) * (1 - fadeIn(t, 19.9, 0.1)) * fa('strip') });
  g.text(p('20秒の本編·8場面', '20秒の本編·8場面', '20秒の本編'), sx, sy, { weight: 700, a: fadeIn(t, 21.3, 0.3) * fa('strip') });
  g.text(p('指摘', '指摘 → 作者が次の執筆へ', '指摘'), L.lbl.notes[0], L.lbl.notes[1], { color: P.teal, weight: 700, a: fadeIn(t, 16.4, 0.3) * fa('notes') });
  if (L.lbl.ship) g.text('同じMP4', L.lbl.ship[0], L.lbl.ship[1], { color: P.teal, weight: 700, a: fadeIn(t, 28.2, 0.3) * fa('ship') });
  if (L.lbl.creator) g.text('7回の執筆', L.lbl.creator[0], L.lbl.creator[1], { align: 'center', a: fadeIn(t, 5.3, 0.3) * fa('creator') });
  if (L.lbl.legend) {
    const la = fadeIn(t, 7.6, 0.4) * fa('strip');
    if (L.lbl.legendTitle) g.text('3つの動き（文章分析から）', L.lbl.legendTitle[0], L.lbl.legendTitle[1], { weight: 700, a: la });
    ev.structure.mechanisms.forEach((name, i) => {
      const [lx, ly] = L.lbl.legend[i];
      drawGlyph(g, ['sel', 'mat', 'rail'][i], [lx, ly - L.fs * 0.95, L.fs * 1.3, L.fs * 1.1], la, false, P.teal);
      g.text(name, lx + L.fs * 1.5, ly, { a: la });
    });
  }
}

/** 紹介ページだけで使う、選んだ記録（黄土）と区分（ティールの破線）の印。 */
function paintHalos(g, ev, o) {
  if (!o.highlight) return;
  const { P, L } = g, d = 3 * L.u;
  const ring = (r, teal) => g.box(grow(r, d), { stroke: teal ? P.teal : P.ochre, lw: L.lw * 1.1, dash: teal ? [3, 2] : null, radius: L.rad + d, a: 1 });
  if (o.caseId === 'studio-intro') { ring(L.strip); ring(L.output); } else if (o.caseId === 'selection' || o.caseId === 'materialize') {
    ring(L.op);
    const want = o.caseId === 'selection' ? 'sel' : 'mat', cells = stripCells(L);
    ev.kinds.forEach((k, i) => { if (k === want) g.box(grow(glyphBox(L, cells[i]), L.u), { stroke: P.ochre, lw: L.lw, radius: L.rad * 0.5, a: 1 }); });
  }
  const node = PART_NODE[o.part];
  if (node === 'lab' || node === 'critic') ring(L[node], true);
  if (node === 'measure') ring(measureCells(L)[0], true);
}

/**
 * 時刻 t の図を (0,0)–(cw,ch) に描く。opts：{ ev, layout?: 'sq'|'wide'|'tall', dark?, caseId?, stage?: 0|1|2|null, part?, highlight? }。
 * ev がなければ紙色だけを塗る（検証前・失敗時に古い図を残さない）。
 */
export function drawMap(ctx, cw, ch, t, opts = {}) {
  const ev = opts.ev, L = LAYOUTS[opts.layout] ?? LAYOUTS[pickLayout(cw, ch)], P = opts.dark ? DARK : LIGHT;
  ctx.save();
  ctx.globalAlpha = 1; ctx.fillStyle = P.paper; ctx.fillRect(0, 0, cw, ch);
  if (!ev) { ctx.restore(); return; }
  t = Math.min(DURATION, Math.max(0, Number(t) || 0));
  const fit = Math.min(cw / L.W, ch / L.H), win = cameraAt(L, t), s = (fit * L.W) / win[2];
  ctx.translate((cw - L.W * fit) / 2, (ch - L.H * fit) / 2); ctx.scale(s, s); ctx.translate(-win[0], -win[1]);
  const g = painter(ctx, P, L), o = { caseId: 'studio-intro', part: null, stage: null, highlight: false, ...opts };
  const fa = name => (o.stage == null ? 1 : STAGE_SETS[o.stage]?.includes(name) ? 1 : 0.22);
  const nt = name => { const [gh, so] = NODE_T[name]; return [fadeIn(t, so, 0.4) * fa(name), fadeIn(t, gh, 0.5) * (1 - fadeIn(t, so, 0.4)) * fa(name)]; };
  for (const [name, t0, d] of FLOWS) {
    const active = TRIPS.some(tr => tr.path === name && t >= tr.t0 && t <= tr.t1);
    flow(g, L.path[name], between(t, t0, t0 + d), active ? P.teal : P.line, fa(name));
  }
  paintTokens(g, t, ev, fa);
  paintBook(g, t, ev, o, fa('book'));
  paintInput(g, t, fa('input'));
  paintCreator(g, t, ...nt('creator'));
  paintLab(g, t, ...nt('lab'));
  paintOp(g, t, ev, o, ...nt('op'));
  paintCritic(g, t, ev, o, ...nt('critic'));
  paintStrip(g, t, ev, fa('strip'));
  paintMeasure(g, t, ev, fa('measure'));
  paintOutput(g, t, ev, ...nt('output'));
  paintComps(g, t, ev, fa('strip'), fa('lab'));
  paintLabels(g, t, ev, fa);
  paintHalos(g, ev, o);
  ctx.restore();
}

// ---- 紹介ページ（index.html から呼ぶ）
const STAGE_NOTE = {
  all: '本と実入力 → 作者AI → 制作担当が描画 → 別のAIが指摘 → 作者が次の執筆で直す → 実出力。',
  0: 'スキルはAIが読む手順書。実入力と一緒に1人の作者AIが読み、BRIEFと8場面を書きました。',
  1: '作者AIがコードを書き、制作担当が別工程で描画。同じ部品2本を8場面・20秒へ組みました。',
  2: '毎回新しい別のAIが実MP4を見て指摘し、作者へ返しました。測定5.5秒は目安未達、SHIPは人の承認ではありません。',
};
const STAGE_NAME = { 0: '本と入力', 1: '制作', 2: '評価と測定' };
const REPLAY = { all: [[0, 32]], 0: [[0, 8]], 1: [[8, 14], [20, 26]], 2: [[14, 20], [26, 29]] };
const RECEIPT_JA = { storyboard: '絵コンテ', components: '部品2本', 'component-fixes': '部品の修正', caption: '説明文', 'film-site': '本編と紹介ページ', 'film-fixes': '本編の修正', handoff: '引き渡し' };

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };

export function initMain() {
  const $ = id => document.getElementById(id);
  const root = document.documentElement, canvas = $('concept-map'), ctx = canvas.getContext('2d'), figure = canvas.parentElement;
  const caseButtons = [...document.querySelectorAll('.case-switch button[data-case]')];
  const stageButtons = [...document.querySelectorAll('.stage-switch button[data-stage]')];
  const partButtons = [...document.querySelectorAll('.part-switch button[data-part]')];
  const replayBtn = $('replay'), saveBtn = $('save-record'), copyBtn = $('copy-request'), retryBtn = $('retry');
  const gated = [...caseButtons, ...stageButtons, ...partButtons, replayBtn, saveBtn, copyBtn];
  const darkQ = matchMedia('(prefers-color-scheme: dark)'), stillQ = matchMedia('(prefers-reduced-motion: reduce)');
  const st = { ev: null, caseId: 'studio-intro', stage: null, part: 'brief', t: DURATION, layout: 'sq', w: 0, h: 0, dpr: 1, raf: 0, loadId: 0, frameUrl: '', scene: -1 };

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!st.ev) return;
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    drawMap(ctx, st.w, st.h, st.t, { ev: st.ev, layout: st.layout, dark: darkQ.matches, caseId: st.caseId, stage: st.stage, part: st.part, highlight: true });
  }
  function resize() {
    const avail = Math.floor(figure.clientWidth);
    if (!avail) return;
    const layout = avail >= 760 ? 'wide' : 'sq', size = layoutSize(layout);
    const w = layout === 'sq' ? Math.min(avail, 520) : avail, h = Math.round((w * size.H) / size.W);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (w === st.w && h === st.h && dpr === st.dpr && layout === st.layout) return;
    Object.assign(st, { w, h, dpr, layout });
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    render();
  }
  function label() {
    const c = st.ev?.cases[st.caseId];
    canvas.setAttribute('aria-label', `Motion Video Kitの仕組みの図。${st.stage == null ? '全体' : `注目：${STAGE_NAME[st.stage]}`}。${c ? `選んだ記録：${c.label}` : ''}。内容は下の一覧と同じです。`);
  }

  function setState(state, message) {
    root.dataset.state = state;
    $('load-status').textContent = message;
    retryBtn.hidden = state !== 'error';
    gated.forEach(b => { b.disabled = state !== 'ready'; });
  }
  function clearAll() {
    stopReplay();
    st.ev = null; st.t = DURATION;
    render();
    for (const id of ['case-meta', 'phase-note', 'part-label', 'part-meaning', 'part-quote', 'record-name', 'record-content', 'save-status', 'copy-status']) $(id).textContent = '';
    for (const id of ['part-source', 'part-local']) { const a = $(id); a.removeAttribute('href'); a.textContent = ''; }
    $('request-text').value = '';
    for (const id of ['measure-detail', 'ledger-rows', 'receipts']) $(id).replaceChildren();
    const img = $('real-frame');
    img.hidden = true; img.removeAttribute('src');
    if (st.frameUrl) { URL.revokeObjectURL(st.frameUrl); st.frameUrl = ''; }
  }

  function fillCase() {
    const c = st.ev.cases[st.caseId];
    caseButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.case === st.caseId)));
    $('case-meta').replaceChildren(el('strong', c.label), ` ${c.video}・${c.duration}秒・${c.fps}fps・${c.frame_count}フレーム・別のAI ${c.verdict}`,
      el('small', `保存記録の表示（再描画・再評価なし）。${c.scope} SHA-256 ${c.sha256.slice(0, 10)}…`));
    label();
  }
  function fillStage() {
    stageButtons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === st.stage)));
    $('phase-note').textContent = STAGE_NOTE[st.stage ?? 'all'];
    label();
  }
  function fillPart() {
    const p = st.ev.structure.parts.find(x => x.id === st.part);
    partButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.part === st.part)));
    $('part-label').textContent = p.label;
    $('part-meaning').textContent = p.meaning;
    $('part-quote').textContent = p.quote;
    const src = $('part-source'), loc = $('part-local');
    src.href = p.source_url; src.textContent = `原文 ${p.upstream_path} ${p.line_start}行目（固定コミット ${COMMIT.slice(0, 7)}）`;
    loc.href = p.source_path; loc.textContent = `同梱の写し ${p.source_path}`;
  }
  function fillRecords() {
    const ev = st.ev, ft = ev.review.frozen_time, lr = ft.longest_non_CTA_run, d = ev.structure.download;
    $('request-text').value = ev.requestText;
    $('record-name').textContent = `${d.path}・${d.bytes}バイト・SHA-256 ${d.sha256}。原制作の8場面の実データそのもので、選んだ記録から新しく作ったものではありません。`;
    $('record-content').textContent = ev.storyboardText;
    const rows = [
      ['測定（制作担当が原典の frozen-time.sh を実MP4へ実行）', `静止に近い合計 ${ft.near_frozen_seconds}秒（閾値${ft.threshold}・${ft.sample_fps}fps標本）。非CTAの最長 ${lr.seconds}秒（${lr.start}–${lr.end}秒の標本）。`],
      ['原典の目安', `合計およそ1秒/30秒以下・非CTAの連続0.6秒以下 → ${ft.source_target.met ? '達成' : '未達'}。`],
      ['別のAIの判断', `${ev.review.full_film_verdict}（3回目）。数値基準への適合や品質の保証ではありません。`],
      ['人の承認', ev.review.human_approval ? 'あり' : 'なし（未実施）。'],
      ['この図と32秒の解説', '原制作の数値とAI判断は、この図や32秒紹介を評価した結果ではありません。今回の描画・確認はvisual-verification.jsonで別に示します。'],
    ];
    $('measure-detail').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', k), el('dd', v)]));
    $('ledger-rows').replaceChildren(...ev.review.ledger.map(r => {
      const tr = el('tr');
      tr.append(el('td', r.round), el('td', r.verdict), el('td', r.finding ?? r.note ?? ''), el('td', r.revision ?? ''));
      return tr;
    }));
    $('receipts').replaceChildren(...ev.run.model_receipts.map(r => el('li', `${RECEIPT_JA[r.phase]}（${r.phase}）・受領 ${r.receipt_sha256.slice(0, 12)}…`)));
    st.frameUrl = URL.createObjectURL(new Blob([ev.files.get('assets/film-12.png')], { type: 'image/png' }));
    const img = $('real-frame');
    img.src = st.frameUrl; img.hidden = false;
  }

  async function load() {
    const id = ++st.loadId;
    clearAll();
    setState('loading', '25件の記録のバイト数とSHA-256、実フレーム5枚を確かめています…');
    try {
      const ev = await loadEvidence('./');
      if (id !== st.loadId) return;
      st.ev = ev;
      fillCase(); fillStage(); fillPart(); fillRecords();
      setState('ready', '25素材・SHA確認済み');
      render();
    } catch (e) {
      if (id !== st.loadId) return;
      clearAll();
      setState('error', e instanceof EvidenceError ? e.message : '記録の確認中に予期しない問題が起きました。もう一度読み込んでください。');
    }
  }

  function stopReplay() {
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0; st.scene = -1;
    replayBtn.setAttribute('aria-pressed', 'false');
  }
  function replay() {
    if (!st.ev) return;
    stopReplay();
    if (stillQ.matches) {
      st.t = DURATION; render();
      $('phase-note').textContent = `動きを減らす設定のため、完成した図のまま示しています。${STAGE_NOTE[st.stage ?? 'all']}`;
      return;
    }
    const ranges = REPLAY[st.stage ?? 'all'];
    let last = performance.now();
    st.t = ranges[0][0];
    replayBtn.setAttribute('aria-pressed', 'true');
    const step = now => {
      const dt = Math.min(0.1, (now - last) / 1000), inside = ranges.some(([a, b]) => st.t >= a && st.t < b);
      last = now;
      st.t = Math.min(DURATION, st.t + dt * (inside ? 1 : 8));
      const scene = SCENES.findLastIndex(s => st.t >= s.t);
      if (scene !== st.scene) { st.scene = scene; $('phase-note').textContent = `再生中（説明のみ）：${SCENES[scene].label}`; }
      render();
      if (st.t >= DURATION) { stopReplay(); fillStage(); return; }
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  }

  async function saveRecord() {
    const ev = st.ev, status = $('save-status');
    if (!ev) return;
    const bytes = ev.storyboardBytes, d = ev.structure.download;
    if (bytes.byteLength !== d.bytes || await sha256(bytes) !== d.sha256) {
      status.textContent = '元の絵コンテのバイトが確認時と一致しないため、保存を止めました。';
      return;
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
    const a = el('a');
    a.href = url; a.download = d.path; a.hidden = true;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent = `元の絵コンテ ${d.path}（${d.bytes}バイト・SHA-256一致）をブラウザーへ渡しました。保存が終わったかはブラウザーの表示で確かめてください。`;
  }
  async function copyRequest() {
    const text = st.ev?.requestText, status = $('copy-status');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'コピーを依頼しました。貼り付けて中身を確かめてください。';
    } catch {
      const area = $('request-text');
      area.focus(); area.select();
      status.textContent = document.execCommand?.('copy') ? 'コピーを依頼しました。貼り付けて中身を確かめてください。' : 'コピーできませんでした。欄の文字を選んでコピーしてください。';
    }
  }

  caseButtons.forEach(b => b.addEventListener('click', () => { if (!st.ev) return; st.caseId = b.dataset.case; fillCase(); render(); }));
  stageButtons.forEach(b => b.addEventListener('click', () => {
    if (!st.ev) return;
    const n = Number(b.dataset.stage);
    st.stage = st.stage === n ? null : n;
    stopReplay(); st.t = DURATION; fillStage(); render();
  }));
  partButtons.forEach(b => b.addEventListener('click', () => { if (!st.ev) return; st.part = b.dataset.part; fillPart(); render(); }));
  replayBtn.addEventListener('click', replay);
  saveBtn.addEventListener('click', saveRecord);
  copyBtn.addEventListener('click', copyRequest);
  retryBtn.addEventListener('click', load);
  darkQ.addEventListener('change', render);
  stillQ.addEventListener('change', () => { if (stillQ.matches && st.raf) { stopReplay(); st.t = DURATION; fillStage(); render(); } });
  new ResizeObserver(resize).observe(figure);
  window.addEventListener('resize', resize);
  resize();
  load();
}
