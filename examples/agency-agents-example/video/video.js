'use strict';

/*
 * video.js — AIに渡す、専門家の指示書集（32秒・無音の図解の編集ソース・visual-r2）
 *
 * 主役は役割の指示書の構造。同じ指示書・依頼・AI・成果物の図形が、開き・合流し・次の実行へ移る。
 * Motion Reel の時間の契約:
 *   - window.seek(秒) は、呼び出しの順番・壁時計・前のフレームに依らず、その時刻の完成した1枚を描く（毎回 ctx.save/restore）。
 *   - window.motionConfig = { duration: 32, fps, width, height, posterTime: 31, audioEvents: [] }。
 *   - window.renderConfig の width / height / fps を起動時に反映し、縦（720×1280）と横（1280×720）で配置を別々に組む。
 *   - window.motionReady は、11の素材のバイト数・SHA-256・形を確かめ、document.fonts.ready のあとに解決する。
 *   - window.__MOTION_RENDER__ === true のときはプレビュー用のタイマーを動かさない。
 * 素材は ../concept/manifest.json（固定の SHA-256）に記載の11ファイルだけ。色は ../foundation.css のライトのトークン。
 * 音は使わない（audioEvents は空。音声・読み上げ・音の素材はない）。
 */
(() => {
  /* ---------- 固定値 ---------- */

  const MANIFEST_PATH = '../concept/manifest.json';
  const MANIFEST_SHA256 = '522efc56d1f288949d12c156ff913a83634b7015442c1f19c0a6b9722ddefae8';
  const MANIFEST_FORMAT = 'agency-structure-assets/v1';
  const STRUCTURE_FORMAT = 'agency-structure/v1';
  const CASE_ID = 'agency-agents-example';
  const REPOSITORY = 'msitarzewski/agency-agents';
  const COMMIT = 'bd956db032d907387e6b9ddebff3e18f1de8c679';
  // manifest に書かれている順番どおり（パスは作例のフォルダーから。取得時に ../ を付ける）
  const FILES = Object.freeze({
    structure: 'concept/structure.json',
    readme: 'vendor/agency-agents/README.md',
    ux: 'vendor/agency-agents/design/design-ux-architect.md',
    frontend: 'vendor/agency-agents/engineering/engineering-frontend-developer.md',
    event: 'input/event.json',
    handoff: 'outputs/ux-handoff.json',
    foundation: 'foundation.css',
    implementation: 'outputs/implementation.md',
    itinerary: 'outputs/browser-itinerary.json',
    request: 'request.txt',
    license: 'vendor/agency-agents/LICENSE',
  });
  const FILE_ORDER = Object.freeze(Object.values(FILES));
  const ROLE_IDS = ['ux', 'frontend'];
  const PART_IDS = ['identity', 'mission', 'rules', 'workflow', 'deliverables', 'success'];
  const SESSION_IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
  const RECORDED = Object.freeze({ ids: ['S01', 'S03', 'S05', 'S06'], total: 1000 });
  const DURATION = 32;
  const POSTER_TIME = 31;
  const DEFAULT_FPS = 30;
  const FORMATS = Object.freeze({ portrait: { width: 720, height: 1280 }, wide: { width: 1280, height: 720 } });
  // storyboard.json と同じ7場面
  const SCENES = Object.freeze([
    { id: 'library', name: '指示書集', in: 0, out: 4, headline: 'AIに渡す、専門家の指示書集' },
    { id: 'parts', name: '中身', in: 4, out: 10, headline: '1枚の指示書の中身' },
    { id: 'join', name: '渡す', in: 10, out: 13, headline: '役割の指示＋今回の依頼 → AI' },
    { id: 'output', name: '成果物', in: 13, out: 16, headline: '役割の指示＋今回の依頼 → AI' },
    { id: 'next', name: '次の実行', in: 16, out: 23, headline: '成果物を、次の役割の入力へ' },
    { id: 'path', name: '全体', in: 23, out: 28, headline: '役割の指示＋今回の依頼' },
    { id: 'finish', name: '作例へ', in: 28, out: 32, headline: '役割の指示＋今回の依頼' },
  ]);
  // 中身の場面で強調する2つの部分
  const HIGHLIGHTS = Object.freeze([
    { part: 'mission', in: 6.6, out: 8.1 },
    { part: 'deliverables', in: 8.1, out: 9.8 },
  ]);
  const STEPS = ['役割を選ぶ', '依頼と渡す', '成果を確かめる'];
  const PULSE = [24.6, 27.6];
  const TOKENS = Object.freeze({
    bg: '--color-bg',
    surface: '--color-surface',
    sunk: '--color-surface-sunk',
    text: '--color-text',
    muted: '--color-text-muted',
    border: '--color-border',
    strong: '--color-border-strong',
    accent: '--color-accent',
    accentSoft: '--color-accent-soft',
    action: '--color-action',
    actionSoft: '--color-action-soft',
    onAction: '--color-on-action',
  });
  const SWATCH_KEYS = ['bg', 'surface', 'accent', 'action', 'text'];
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const HEX64_RE = /^[0-9a-f]{64}$/;
  const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  const LIBRARY_RE = /\[([^\]]+)\]\(((design|engineering)\/[a-z0-9-]+\.md)\)/g;

  /* ---------- 大きさと設定（起動時に1回だけ決める） ---------- */

  const isObj = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const RENDER = window.__MOTION_RENDER__ === true;
  const renderConfig = isObj(window.renderConfig) ? window.renderConfig : {};
  const isDimension = (value) => Number.isInteger(value) && value >= 16 && value <= 4096 && value % 2 === 0;
  let preset = FORMATS.portrait; // スマホで見る縦が基準
  try {
    const requested = new URLSearchParams(window.location.search).get('format');
    if (requested && Object.prototype.hasOwnProperty.call(FORMATS, requested)) preset = FORMATS[requested];
  } catch {
    // 既定の縦のまま
  }
  const WIDTH = isDimension(renderConfig.width) ? renderConfig.width : preset.width;
  const HEIGHT = isDimension(renderConfig.height) ? renderConfig.height : preset.height;
  const FPS = Number.isInteger(renderConfig.fps) && renderConfig.fps >= 1 && renderConfig.fps <= 120 ? renderConfig.fps : DEFAULT_FPS;

  window.motionConfig = Object.freeze({
    duration: DURATION,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    posterTime: POSTER_TIME,
    audioEvents: Object.freeze([]),
  });

  const canvas = document.getElementById('film');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  if (RENDER) {
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;
  }
  const ctx = canvas.getContext('2d');

  /* ---------- 取得と検証 ---------- */

  class AssetError extends Error {}

  const isText = (value) => typeof value === 'string' && value.trim() !== '';
  const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const toMinutes = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

  function check(condition, where, reason) {
    if (!condition) throw new AssetError(`${where}：${reason}。`);
  }

  async function fetchBytes(url, label) {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store' });
    } catch {
      throw new AssetError(`${label}：通信に失敗しました。`);
    }
    if (!response.ok) throw new AssetError(`${label}：サーバーが ${response.status} を返しました。`);
    try {
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new AssetError(`${label}：通信が途中で切れました。`);
    }
  }

  async function sha256Hex(bytes) {
    const subtle = window.crypto && window.crypto.subtle;
    check(subtle && typeof subtle.digest === 'function', 'SHA-256', 'この環境では計算できません（HTTPS か localhost で開いてください）');
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

  function decode(bytes, label) {
    try {
      return utf8.decode(bytes);
    } catch {
      throw new AssetError(`${label}：UTF-8 の文字として読めませんでした。`);
    }
  }

  function parse(text, label) {
    try {
      return JSON.parse(text);
    } catch {
      throw new AssetError(`${label}：JSONとして読めませんでした。`);
    }
  }

  function validateManifest(data) {
    const where = 'concept/manifest.json';
    check(isObj(data) && data.format === MANIFEST_FORMAT && data.case_id === CASE_ID && data.commit === COMMIT, where, '形式・作例ID・固定コミットが違います');
    check(Array.isArray(data.files) && data.files.length === FILE_ORDER.length, `${where} の files`, `${FILE_ORDER.length}件の配列が必要です`);
    data.files.forEach((entry, index) => {
      check(
        isObj(entry) && entry.path === FILE_ORDER[index] && Number.isInteger(entry.bytes) && entry.bytes > 0 && typeof entry.sha256 === 'string' && HEX64_RE.test(entry.sha256),
        `${where} の files[${index}]`,
        `${FILE_ORDER[index]} のパス・バイト数・SHA-256 が必要です`,
      );
    });
    return data;
  }

  // 11ファイルを突き合わせ、場面に使う事実だけを取り出す
  function buildModel(text) {
    const json = (key) => parse(text[FILES[key]], FILES[key]);
    const structure = json('structure');
    const event = json('event');
    const handoff = json('handoff');
    const itinerary = json('itinerary');

    check(isObj(event) && event.fictional === true && isText(event.id) && isText(event.title) && Array.isArray(event.sessions), FILES.event, '架空のイベントと企画の配列が必要です');
    check(sameJSON(event.sessions.map((s) => (isObj(s) ? s.id : null)).sort(), SESSION_IDS), `${FILES.event} の sessions`, `${SESSION_IDS.join('・')} の6件が必要です`);
    event.sessions.forEach((s) => {
      check(TIME_RE.test(s.start) && TIME_RE.test(s.end) && s.start < s.end && Number.isInteger(s.price_yen) && s.price_yen >= 0, `${FILES.event} の ${s.id}`, '時刻と費用の形が正しくありません');
    });

    const where = FILES.structure;
    check(isObj(structure) && structure.format === STRUCTURE_FORMAT && structure.case_id === CASE_ID && structure.repository === REPOSITORY && structure.commit === COMMIT, where, '形式・作例ID・原典・固定コミットが違います');
    check(isText(structure.editorial_note) && isObj(structure.example) && isText(structure.example.execution) && structure.example.execution.includes('Opus 5.5'), where, '編集上の注記と実行の記録が必要です');
    check(Array.isArray(structure.parts) && sameJSON(structure.parts.map((p) => (isObj(p) ? p.id : null)), PART_IDS), `${where} の parts`, `${PART_IDS.join('・')} の順の6項目が必要です`);
    structure.parts.forEach((part) => check(isText(part.label) && isText(part.section) && isText(part.meaning), `${where} の parts.${part.id}`, '見出し・節・意味が必要です'));
    check(Array.isArray(structure.roles) && sameJSON(structure.roles.map((r) => (isObj(r) ? r.id : null)), ROLE_IDS), `${where} の roles`, 'ux・frontend の2件が必要です');
    const roles = {};
    structure.roles.forEach((role) => {
      const at = `${where} の roles.${role.id}`;
      const raw = text[FILES[role.id]];
      check(role.file === FILES[role.id] && isText(role.name) && isText(role.short) && isText(role.output_short), at, 'ファイル・名前・成果の説明が必要です');
      check(raw.split(/\r?\n/).includes(`name: ${role.name}`), at, '役割ファイルの name と一致しません');
      structure.parts.forEach((part) => {
        const entry = isObj(role.parts) ? role.parts[part.id] : null;
        check(isObj(entry) && isText(entry.source) && isText(entry.applied), `${at}.parts.${part.id}`, '原文の抜粋と今回の適用が必要です');
        check(raw.includes(entry.source), `${at}.parts.${part.id}.source`, '原文の抜粋が役割ファイルにありません');
        check(raw.includes(part.section), at, `節「${part.section}」が役割ファイルにありません`);
      });
      check(Array.isArray(role.input_files) && role.input_files.every((p) => FILE_ORDER.includes(p)), `${at}.input_files`, '確かめたファイルのパスが必要です');
      roles[role.id] = role;
    });
    check(roles.ux.input_files.includes(FILES.event) && roles.ux.input_files.includes(FILES.request), `${where} の roles.ux.input_files`, '依頼文と6企画が必要です');
    check(roles.frontend.input_files.includes(FILES.handoff) && roles.frontend.input_files.includes(FILES.foundation), `${where} の roles.frontend.input_files`, '1回目の成果物が必要です');

    check(
      isObj(handoff) && isObj(handoff.meta) && handoff.meta.fictional === true && handoff.meta.event_id === event.id && handoff.meta.source_commit === COMMIT && handoff.meta.mode === 'sequential-role-application',
      `${FILES.handoff} の meta`,
      '架空・同じイベント・固定コミット・順に当てた記録が必要です',
    );
    check(Array.isArray(handoff.roles) && isObj(handoff.roles[0]) && sameJSON(handoff.roles[0].deliverables, roles.ux.output_files), `${FILES.handoff} の roles[0]`, '1回目の成果物の一覧が図と一致しません');

    const picked = RECORDED.ids.map((id) => event.sessions.find((s) => s.id === id));
    const total = picked.reduce((sum, s) => sum + s.price_yen, 0);
    check(isObj(itinerary) && itinerary.format === 'komorebi-itinerary/v1' && itinerary.fictional === true && itinerary.reserved === false && isObj(itinerary.event) && itinerary.event.id === event.id, FILES.itinerary, '同じ架空イベントの、予約ではない予定メモが必要です');
    check(sameJSON(itinerary.selected_ids, RECORDED.ids) && Array.isArray(itinerary.sessions) && itinerary.sessions.every((s, i) => sameJSON(s, picked[i])), `${FILES.itinerary} の選択`, `${RECORDED.ids.join('・')} が入力と同じ値で必要です`);
    check(total === RECORDED.total && sameJSON(itinerary.derived, { count: picked.length, total_price_yen: total }), `${FILES.itinerary} の derived`, `${picked.length}件・${RECORDED.total}円が必要です`);
    check(sameJSON(structure.example.selected_ids, RECORDED.ids) && structure.example.total_price_yen === total, `${where} の example`, '保存記録に一致しません');

    // README の役割ファイル一覧（棚に並べる実際の名前）
    const readme = text[FILES.readme];
    check(readme.includes('### Option 3: Use as Reference'), FILES.readme, 'Option 3 の節が必要です');
    const seen = new Set();
    const entries = [];
    for (const match of readme.matchAll(LIBRARY_RE)) {
      if (seen.has(match[2])) continue;
      seen.add(match[2]);
      entries.push({ name: match[1], path: `vendor/agency-agents/${match[2]}`, division: match[3] });
    }
    const library = ['design', 'engineering'].flatMap((division) => entries.filter((e) => e.division === division).slice(0, 5));
    const uxIndex = library.findIndex((e) => e.path === FILES.ux && e.name === roles.ux.name);
    const feIndex = library.findIndex((e) => e.path === FILES.frontend && e.name === roles.frontend.name);
    check(library.length === 10 && uxIndex >= 0 && feIndex >= 0, FILES.readme, '一覧に2つの役割ファイルが必要です');

    const license = text[FILES.license];
    check(license.includes('MIT License') && license.includes('Copyright (c) 2025 AgentLand Contributors'), FILES.license, 'MIT と著作権表示が必要です');
    check(text[FILES.request].includes(COMMIT) && text[FILES.request].includes('UX Architect') && text[FILES.request].includes('Frontend Developer'), FILES.request, '2つの役割と固定コミットが必要です');
    check(text[FILES.implementation].includes('A09'), FILES.implementation, 'A09 を採用しなかった記録が必要です');
    const css = text[FILES.foundation];
    check(css.includes(':root[data-theme="dark"]') && css.includes('prefers-color-scheme: dark') && css.includes('--color-action'), FILES.foundation, '色のトークンと3つのテーマが必要です');

    // 時間の小さな地図（2回目の成果の見本）。段は空いている最初の段へ
    const sessions = [...event.sessions].sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || (a.id < b.id ? -1 : 1));
    const laneEnds = [];
    const lanes = sessions.map((s) => {
      let lane = laneEnds.findIndex((end) => end <= toMinutes(s.start));
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = toMinutes(s.end);
      return { id: s.id, start: toMinutes(s.start), end: toMinutes(s.end), lane, picked: RECORDED.ids.includes(s.id) };
    });
    const dayStart = Math.floor(Math.min(...lanes.map((s) => s.start)) / 60) * 60;
    const dayEnd = Math.ceil(Math.max(...lanes.map((s) => s.end)) / 60) * 60;
    const note = structure.editorial_note.split('。').filter(Boolean).slice(0, 2).join('。');

    return {
      parts: structure.parts,
      roles,
      library: library.map((e, i) => ({ ...e, isUx: i === uxIndex, isFrontend: i === feIndex })),
      event: { title: event.title, lanes, laneCount: laneEnds.length, dayStart, dayEnd },
      count: itinerary.derived.count,
      totalText: `${total.toLocaleString('ja-JP')}円`,
      note: `${note}。`,
      credit: [`${REPOSITORY} @ ${COMMIT.slice(0, 7)} · MIT（Copyright (c) 2025 AgentLand Contributors）`, 'コミュニティ作成・Anthropic公式ではありません'],
    };
  }

  function readTheme() {
    const style = window.getComputedStyle(document.documentElement);
    const colors = {};
    Object.entries(TOKENS).forEach(([key, name]) => {
      const value = style.getPropertyValue(name).trim();
      check(COLOR_RE.test(value), `../foundation.css の ${name}`, '色のトークンを読めません');
      colors[key] = value;
    });
    const fonts = {};
    ['sans', 'serif', 'mono'].forEach((key) => {
      fonts[key] = style.getPropertyValue(`--font-${key}`).replace(/\s+/g, ' ').trim();
      check(isText(fonts[key]), '../foundation.css の書体', `--font-${key} が必要です`);
    });
    return { colors, fonts };
  }

  async function loadAssets() {
    const manifestBytes = await fetchBytes(MANIFEST_PATH, 'concept/manifest.json');
    check((await sha256Hex(manifestBytes)) === MANIFEST_SHA256, 'concept/manifest.json', 'SHA-256 が固定値と一致しません。内容が変わっています');
    const manifest = validateManifest(parse(decode(manifestBytes, 'concept/manifest.json'), 'concept/manifest.json'));
    const text = {};
    await Promise.all(
      manifest.files.map(async (entry) => {
        const bytes = await fetchBytes(`../${entry.path}`, entry.path);
        check(bytes.byteLength === entry.bytes, entry.path, `バイト数が記録の ${entry.bytes} と違います（${bytes.byteLength}）`);
        check((await sha256Hex(bytes)) === entry.sha256, entry.path, 'SHA-256 が記録と一致しません。内容が変わっています');
        text[entry.path] = decode(bytes, entry.path);
      }),
    );
    const built = buildModel(text);
    const theme = readTheme();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return { ...built, ...theme };
  }

  /* ---------- 時間の道具（すべて t から直接求める） ---------- */

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const prog = (t, a, b) => (b > a ? clamp((t - a) / (b - a), 0, 1) : t >= b ? 1 : 0);
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  const ease = (t, a, b) => easeIO(prog(t, a, b));
  const lerp = (a, b, x) => a + (b - a) * x;
  const lerpRect = (a, b, x) => ({ x: lerp(a.x, b.x, x), y: lerp(a.y, b.y, x), w: lerp(a.w, b.w, x), h: lerp(a.h, b.h, x) });
  const win = (t, a, b, fade) => Math.min(prog(t, a, a + fade), 1 - prog(t, b - fade, b));
  const R = (x, y, w, h) => ({ x, y, w, h });
  const cx = (r) => r.x + r.w / 2;
  const cy = (r) => r.y + r.h / 2;
  const dot = (p, size) => R(p.x - size / 2, p.y - size / 2, size, size);

  // [[秒, 矩形], ...] の間を ease でつなぐ。最初より前は最初、最後より後は最後
  function track(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i += 1) {
      if (t <= keys[i][0]) {
        const [t0, a] = keys[i - 1];
        const [t1, b] = keys[i];
        return lerpRect(a, b, t1 > t0 ? easeIO((t - t0) / (t1 - t0)) : 1);
      }
    }
    return keys[keys.length - 1][1];
  }

  /* ---------- 配置（縦と横で別々に組む。基準の大きさで描き、拡大縮小する） ---------- */

  function makeLayout(m) {
    const portrait = HEIGHT > WIDTH;
    const BW = portrait ? 720 : 1280;
    const BH = portrait ? 1280 : 720;
    const s = Math.min(WIDTH / BW, HEIGHT / BH);
    const L = { portrait, BW, BH, s, ox: (WIDTH - BW * s) / 2, oy: (HEIGHT - BH * s) / 2 };
    if (portrait) {
      // 縦は 375px 幅の画面で約0.52倍。主なラベルは 28px 以上（画面で約15px）にする
      Object.assign(L, {
        F: { kicker: 26, headline: 46, badge: 22, credit: 17, card: 22, cardLine: 26, label: 32, applied: 28, appliedLine: 34, small: 22, mono: 20, docName: 44, docShort: 30, compactKicker: 20, compactShort: 30, compactName: 20, node: 28, ai: 48, aiSub: 22, aiTall: 38, run: 20, guideTitle: 22, guideId: 17, guideSum: 26, step: 30, cta: 28, note: 22, pill: 22 },
        kicker: { x: 40, y: 56 },
        headline: { x: 40, y: 116, maxW: 640 },
        badge: { right: 680, y: 56 },
        credit: { x: 40, ys: [1236, 1260], maxW: 640 },
        card: { w: 116, h: 170, gap: 15, x0: 40, rows: [258, 488], labels: [238, 468] },
        libCaption: { x: 40, y: 700 },
        strip: { x0: 270, y: 1117, w: 34, h: 46, gap: 8, captionX: 40, captionY: 1140, align: 'left' },
        open: R(40, 180, 640, 880),
        spec: { padX: 32, kickerY: 44, nameY: 92, pathY: 136, ruleY: 164, bandsY: 184, bandH: 84, bandGap: 10, cols: 1, colGap: 0, labelW: 150, panelY: 756 },
        compact: { kickerY: 28, shortY: 62, nameY: 90, nameInline: false, stripeTop: 108 },
        docJoin: R(40, 200, 300, 240),
        docDock: R(60, 290, 290, 230),
        taskFrom: R(760, 200, 300, 240),
        taskJoin: R(380, 200, 300, 240),
        taskDock: R(370, 290, 290, 230),
        aiJoin: R(200, 580, 320, 170),
        handoffOut: R(70, 830, 280, 210),
        cssOut: R(370, 830, 280, 210),
        d1: R(40, 200, 250, 190),
        tk: R(40, 420, 250, 170),
        d2: R(40, 620, 250, 190),
        aiTall: R(330, 200, 110, 610),
        handoff2: R(480, 200, 200, 130),
        css2: R(480, 342, 200, 96),
        token: R(470, 660, 160, 110),
        guide: R(150, 880, 470, 200),
        samePill: { x: 560, y: 845 },
        cta: { cx: 385, y: 1094, h: 48 },
        steps: { x: 360, y: 1172, align: 'center' },
        note: { x: 360, y: 1206, align: 'center' },
        camera: { cx: 360, cy: 640, scale: 0.95 },
      });
    } else {
      Object.assign(L, {
        F: { kicker: 20, headline: 38, badge: 18, credit: 15, card: 18, cardLine: 22, label: 26, applied: 22, appliedLine: 28, small: 18, mono: 17, docName: 36, docShort: 26, compactKicker: 17, compactShort: 26, compactName: 17, node: 24, ai: 44, aiSub: 19, aiTall: 32, run: 17, guideTitle: 19, guideId: 15, guideSum: 22, step: 22, cta: 22, note: 16, pill: 18 },
        kicker: { x: 48, y: 40 },
        headline: { x: 48, y: 84, maxW: 900 },
        badge: { right: 1232, y: 40 },
        credit: { x: 48, ys: [704], maxW: 1184 },
        card: { w: 150, h: 140, gap: 20, x0: 225, rows: [170, 366], labels: [156, 352] },
        libCaption: { x: 225, y: 540 },
        strip: { x0: 836, y: 630, w: 36, h: 44, gap: 8, captionX: 824, captionY: 652, align: 'right' },
        open: R(200, 130, 900, 490),
        spec: { padX: 32, kickerY: 38, nameY: 78, pathY: 110, ruleY: 128, bandsY: 140, bandH: 86, bandGap: 8, cols: 2, colGap: 12, labelW: 120, panelY: 424 },
        compact: { kickerY: 24, shortY: 54, nameY: 54, nameInline: true, stripeTop: 80 },
        docJoin: R(60, 140, 340, 220),
        docDock: R(120, 150, 330, 210),
        taskFrom: R(60, 760, 340, 200),
        taskJoin: R(60, 390, 340, 200),
        taskDock: R(120, 390, 330, 200),
        aiJoin: R(520, 250, 240, 200),
        handoffOut: R(860, 140, 260, 200),
        cssOut: R(860, 380, 260, 180),
        d1: R(60, 130, 300, 150),
        tk: R(60, 300, 300, 130),
        d2: R(60, 450, 300, 150),
        aiTall: R(450, 120, 130, 490),
        handoff2: R(650, 120, 260, 130),
        css2: R(650, 262, 260, 84),
        token: R(640, 432, 150, 84),
        guide: R(820, 368, 400, 232),
        samePill: { x: 515, y: 638 },
        cta: { cx: 1020, y: 614, h: 44 },
        steps: { x: 60, y: 680, align: 'left' },
        note: { x: 1232, y: 684, align: 'right' },
        camera: { cx: 640, cy: 380, scale: 0.95 },
      });
    }

    // 棚: README の一覧から10件。UX Architect 以外は帯の棚へ縮む
    const { card, strip } = L;
    let stripIndex = 0;
    L.library = m.library.map((entry, i) => {
      const row = i < 5 ? 0 : 1;
      const grid = R(card.x0 + (i % 5) * (card.w + card.gap), card.rows[row], card.w, card.h);
      const slot = entry.isUx ? null : R(strip.x0 + stripIndex * (strip.w + strip.gap), strip.y, strip.w, strip.h);
      if (!entry.isUx) stripIndex += 1;
      return { entry, grid, slot };
    });
    const ux = L.library.find((item) => item.entry.isUx);
    const fe = L.library.find((item) => item.entry.isFrontend);

    // 2回目の入力の位置（1回目の成果物から引き継ぎ書とCSSが運ばれる）
    L.p1 = cy(L.d1);
    L.p2 = cy(L.d2);
    L.tokenFrom = portrait ? { x: cx(L.css2), y: L.css2.y + L.css2.h } : { x: L.css2.x + 50, y: L.css2.y + L.css2.h };
    L.guideFrom = portrait ? { x: cx(L.aiTall), y: L.aiTall.y + L.aiTall.h } : { x: L.aiTall.x + L.aiTall.w, y: L.guide.y + L.guide.h * 0.83 };

    const aiCenter = { x: cx(L.aiJoin), y: cy(L.aiJoin) };
    L.tracks = {
      uxDoc: [[0, ux.grid], [1.8, ux.grid], [3.6, L.open], [10.0, L.open], [11.2, L.docJoin], [12.3, L.docJoin], [13.0, L.docDock], [16.0, L.docDock], [17.4, L.d1]],
      feDoc: [[0, fe.grid], [2.0, fe.grid], [3.6, fe.slot], [17.4, fe.slot], [18.8, L.d2]],
      task: [[10.4, L.taskFrom], [11.4, L.taskJoin], [12.3, L.taskJoin], [13.0, L.taskDock], [16.0, L.taskDock], [17.4, L.tk]],
      ai: [[16.0, L.aiJoin], [17.4, L.aiTall]],
      handoff: [[13.0, dot(aiCenter, 24)], [14.2, L.handoffOut], [16.0, L.handoffOut], [17.4, L.handoff2]],
      css: [[13.3, dot(aiCenter, 24)], [14.5, L.cssOut], [16.0, L.cssOut], [17.4, L.css2]],
      token: [[19.0, dot(L.tokenFrom, 30)], [20.4, L.token]],
      guide: [[20.6, dot(L.guideFrom, 24)], [21.8, L.guide]],
    };

    // 全体の場面で光が通る道（役割の指示書 → AI → 成果物 → 次の入力 → AI → 使える画面）
    const ai = L.aiTall;
    const pulse = [
      { x: L.d1.x + L.d1.w, y: L.p1 },
      { x: ai.x, y: L.p1 },
      { x: ai.x + ai.w, y: cy(L.handoff2) },
      { x: L.handoff2.x, y: cy(L.handoff2) },
      L.tokenFrom,
      { x: cx(L.token), y: L.token.y },
      { x: L.token.x, y: cy(L.token) },
      { x: ai.x + ai.w, y: cy(L.token) },
    ];
    if (portrait) pulse.push({ x: cx(ai), y: ai.y + ai.h }, { x: cx(ai), y: L.guide.y });
    else pulse.push({ x: ai.x + ai.w, y: L.guideFrom.y }, { x: L.guide.x, y: L.guideFrom.y });
    L.pulse = pulse;
    return L;
  }

  /* ---------- 描画の道具 ---------- */

  let model = null;
  let L = null;
  let C = null;

  const fontOf = (size, weight = 700, family = 'sans') => `${weight} ${size}px ${model.fonts[family]}`;

  function measure(str, size, weight = 700, family = 'sans') {
    ctx.font = fontOf(size, weight, family);
    return ctx.measureText(str).width;
  }

  function fit(str, size, maxW, min, weight = 700, family = 'sans') {
    let current = size;
    while (current > min && measure(str, current, weight, family) > maxW) current -= 1;
    return current;
  }

  function text(str, x, y, size, color, o = {}) {
    ctx.font = fontOf(size, o.weight === undefined ? 700 : o.weight, o.family || 'sans');
    ctx.fillStyle = color;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  // 英語は語のまとまりで、日本語は文字ごとに折り返す
  function wrap(str, size, maxW, weight = 700, family = 'sans') {
    const tokens = str.match(/[A-Za-z0-9][A-Za-z0-9.,'’&/:+()-]*\s*|\s+|./gu) || [];
    const lines = [];
    let line = '';
    tokens.forEach((token) => {
      const next = line + token;
      if (line && measure(next.trimEnd(), size, weight, family) > maxW) {
        lines.push(line.trimEnd());
        line = token.trimStart();
      } else {
        line = next;
      }
    });
    if (line.trim()) lines.push(line.trimEnd());
    return lines;
  }

  // 指定行数に収まるまで文字を少し小さくする（下限は元の8割）
  function para(str, x, y, size, maxW, lineH, maxLines, color, o = {}) {
    let current = size;
    let lines = wrap(str, current, maxW, o.weight, o.family);
    while (lines.length > maxLines && current > Math.round(size * 0.8)) {
      current -= 1;
      lines = wrap(str, current, maxW, o.weight, o.family);
    }
    lines.slice(0, maxLines).forEach((line, i) => text(line, x, y + i * lineH * (current / size), current, color, o));
  }

  function roundRect(r, radius) {
    const rad = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
    ctx.beginPath();
    ctx.moveTo(r.x + rad, r.y);
    ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
    ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
    ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
    ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
    ctx.closePath();
  }

  // 右上を折った紙
  function paper(r, o = {}) {
    const fold = Math.min(o.fold || 22, r.w * 0.18, r.h * 0.18);
    ctx.save();
    if (o.shadow) {
      ctx.fillStyle = C.border;
      ctx.fillRect(r.x + 6, r.y + 6, r.w, r.h);
    }
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x + r.w - fold, r.y);
    ctx.lineTo(r.x + r.w, r.y + fold);
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.lineTo(r.x, r.y + r.h);
    ctx.closePath();
    ctx.fillStyle = o.fill || C.surface;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.lw || 2;
    ctx.strokeStyle = o.stroke || C.strong;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r.x + r.w - fold, r.y);
    ctx.lineTo(r.x + r.w - fold, r.y + fold);
    ctx.lineTo(r.x + r.w, r.y + fold);
    ctx.closePath();
    ctx.fillStyle = C.sunk;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function pill(label, x, y, size, o = {}) {
    const w = measure(label, size) + size * 1.2;
    const h = size * 1.7;
    const left = o.align === 'right' ? x - w : o.align === 'left' ? x : x - w / 2;
    ctx.save();
    roundRect(R(left, y - h / 2, w, h), h / 2);
    ctx.fillStyle = o.fill || C.surface;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = o.stroke || C.strong;
    ctx.stroke();
    ctx.restore();
    text(label, left + w / 2, y + 1, size, o.color || C.text, { align: 'center' });
    return R(left, y - h / 2, w, h);
  }

  function lines(r, count, top, pitch) {
    ctx.save();
    ctx.fillStyle = C.strong;
    for (let i = 0; i < count; i += 1) {
      const w = (r.w - 40) * (i % 3 === 1 ? 0.8 : i % 3 === 2 ? 0.62 : 1);
      ctx.globalAlpha *= 0.55;
      roundRect(R(r.x + 20, top + i * pitch, w, 6), 3);
      ctx.fill();
      ctx.globalAlpha /= 0.55;
    }
    ctx.restore();
  }

  const NORMALS = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

  // 関係の線（ベジェ）。p は描き進んだ割合。最後まで来たら矢じり
  function edge(a, b, sa, sb, p, o = {}) {
    if (p <= 0) return;
    const c = Math.max(24, Math.hypot(b.x - a.x, b.y - a.y) * 0.42);
    const p1 = { x: a.x + NORMALS[sa][0] * c, y: a.y + NORMALS[sa][1] * c };
    const p2 = { x: b.x + NORMALS[sb][0] * c, y: b.y + NORMALS[sb][1] * c };
    const at = (u) => {
      const v = 1 - u;
      return {
        x: v * v * v * a.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * b.x,
        y: v * v * v * a.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * b.y,
      };
    };
    const steps = 32;
    const end = clamp(p, 0, 1);
    const color = o.color || C.muted;
    const width = o.width || (L.portrait ? 3.5 : 3);
    ctx.save();
    ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.setLineDash(o.dash || []);
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const q = at((i / steps) * end);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    if (end > 0.97) {
      const tip = at(1);
      const back = at(0.94);
      const angle = Math.atan2(tip.y - back.y, tip.x - back.x);
      const size = width * 3.6 + 4;
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x - size * Math.cos(angle - 0.45), tip.y - size * Math.sin(angle - 0.45));
      ctx.lineTo(tip.x - size * Math.cos(angle + 0.45), tip.y - size * Math.sin(angle + 0.45));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function pointAlong(points, fraction) {
    const lengths = [];
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      lengths.push(d);
      total += d;
    }
    let remaining = clamp(fraction, 0, 1) * total;
    for (let i = 1; i < points.length; i += 1) {
      const d = lengths[i - 1];
      if (remaining <= d || i === points.length - 1) {
        const x = d === 0 ? 0 : clamp(remaining / d, 0, 1);
        return { x: lerp(points[i - 1].x, points[i].x, x), y: lerp(points[i - 1].y, points[i].y, x) };
      }
      remaining -= d;
    }
    return points[points.length - 1];
  }

  /* ---------- 場面の状態（t だけで決まる） ---------- */

  // 全体の場面で、いま光っている段階（0: 役割を選ぶ 1: 依頼と渡す 2: 成果を確かめる）
  const stepGlow = (t, k) => win(t, PULSE[0] + k, PULSE[0] + k + 1, 0.2);
  const highlightOf = (t, partId) => HIGHLIGHTS.reduce((v, h) => (h.part === partId ? Math.max(v, win(t, h.in, h.out, 0.25)) : v), 0);

  function openBands(r) {
    const O = L.open;
    const S = L.spec;
    const kx = r.w / O.w;
    const ky = r.h / O.h;
    const bw = S.cols === 2 ? (O.w - 48 - S.colGap) / 2 : O.w - 48;
    return PART_IDS.map((_, i) => {
      const col = S.cols === 2 ? i % 2 : 0;
      const row = S.cols === 2 ? Math.floor(i / 2) : i;
      return R(r.x + (24 + col * (bw + S.colGap)) * kx, r.y + (S.bandsY + row * (S.bandH + S.bandGap)) * ky, bw * kx, S.bandH * ky);
    });
  }

  function stripes(r) {
    const top = r.y + L.compact.stripeTop;
    const pitch = Math.min(16, (r.y + r.h - 16 - top) / 6);
    const h = Math.max(4, pitch * 0.55);
    return PART_IDS.map((_, i) => R(r.x + 20, top + i * pitch, (r.w - 54) * (i % 2 ? 0.78 : 1), h));
  }

  /* ---------- 各層 ---------- */

  // 棚のカードに README の名前。長い語がはみ出さない大きさまで下げる
  function drawCardText(r, name, alpha) {
    if (alpha <= 0 || r.w < 80) return;
    const maxW = r.w - 24;
    let size = L.F.card;
    let rows = wrap(name, size, maxW);
    while (size > 13 && (rows.length > 3 || rows.some((row) => measure(row, size) > maxW))) {
      size -= 1;
      rows = wrap(name, size, maxW);
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    rows.slice(0, 3).forEach((row, i) => text(row, r.x + 12, r.y + 26 + i * L.F.cardLine * (size / L.F.card), size, C.text));
    lines(r, 3, r.y + r.h - 46, 13);
    ctx.restore();
  }

  function drawLibrary(t) {
    const shelfA = 1 - prog(t, 23.0, 23.6);
    L.library.forEach((item) => {
      if (item.entry.isUx || item.entry.isFrontend) return;
      const r = lerpRect(item.grid, item.slot, ease(t, 2.0, 3.6));
      ctx.save();
      ctx.globalAlpha = lerp(1, 0.6, ease(t, 2.0, 3.6)) * shelfA;
      paper(r, { fold: r.w < 80 ? 8 : 18, lw: 1.5 });
      drawCardText(r, item.entry.name, 1 - prog(t, 1.9, 2.4));
      ctx.restore();
    });
    const F = L.F;
    const labelA = 1 - prog(t, 1.6, 2.2);
    if (labelA > 0) {
      ctx.save();
      ctx.globalAlpha = labelA;
      text('design/', L.card.x0, L.card.labels[0], F.mono, C.muted, { weight: 400, family: 'mono' });
      text('engineering/', L.card.x0, L.card.labels[1], F.mono, C.muted, { weight: 400, family: 'mono' });
      text('README の役割ファイル一覧から（一部）', L.libCaption.x, L.libCaption.y, F.small, C.muted, { weight: 400 });
      ctx.restore();
    }
    const capA = prog(t, 3.4, 4.0) * shelfA;
    if (capA > 0) {
      ctx.save();
      ctx.globalAlpha = capA;
      text('ほかの役割ファイル', L.strip.captionX, L.strip.captionY, F.small, C.muted, { weight: 400, align: L.strip.align });
      ctx.restore();
    }
  }

  function drawOpen(r, role, t, fold) {
    const S = L.spec;
    const F = L.F;
    const kx = r.w / L.open.w;
    const ky = r.h / L.open.h;
    const headA = prog(t, 3.3, 3.9) * (1 - prog(t, 10.0, 10.5));
    const x = r.x + S.padX * kx;
    const innerW = r.w - 2 * S.padX * kx;
    if (headA > 0) {
      ctx.save();
      ctx.globalAlpha *= headA;
      text('役割の指示書（Markdown）', x, r.y + S.kickerY * ky, F.small, C.muted);
      text(role.name, x, r.y + S.nameY * ky, F.docName, C.text);
      text(role.short, r.x + r.w - 44 * kx, r.y + S.nameY * ky, F.docShort, C.action, { align: 'right' });
      text(role.file.replace('vendor/agency-agents/', ''), x, r.y + S.pathY * ky, F.mono, C.muted, { weight: 400, family: 'mono' });
      ctx.fillStyle = C.border;
      ctx.fillRect(x, r.y + S.ruleY * ky, innerW, 2);
      ctx.restore();
    }
    // 6つの部分: 帯が1枚ずつ出て、のちに細い線へたたまれる
    const bands = openBands(r);
    const thin = stripes(r);
    const textA = 1 - clamp(fold * 2.2, 0, 1);
    model.parts.forEach((part, i) => {
      const appear = ease(t, 4.3 + i * 0.35, 4.7 + i * 0.35);
      if (appear <= 0) return;
      const b = lerpRect(bands[i], thin[i], fold);
      b.x += (1 - appear) * 24;
      const hl = highlightOf(t, part.id) * (1 - fold);
      const lit = HIGHLIGHTS.some((h) => h.part === part.id);
      ctx.save();
      ctx.globalAlpha *= appear;
      roundRect(b, fold > 0.5 ? 3 : 8);
      // たたみ終わりは、要約の紙の細い線と同じ色・濃さになる
      if (fold > 0.6 && !lit) ctx.globalAlpha *= lerp(1, 0.55, (fold - 0.6) / 0.4);
      ctx.fillStyle = fold > 0.6 ? (lit ? C.accent : C.strong) : C.bg;
      ctx.fill();
      if (hl > 0) {
        ctx.globalAlpha *= hl;
        ctx.fillStyle = C.accentSoft;
        ctx.fill();
        ctx.globalAlpha /= hl;
      }
      if (fold < 0.6) {
        ctx.lineWidth = hl > 0.5 ? 4 : 1.5;
        ctx.strokeStyle = hl > 0.5 ? C.accent : C.border;
        ctx.stroke();
        if (hl > 0) {
          ctx.fillStyle = C.accent;
          ctx.globalAlpha *= hl;
          ctx.fillRect(b.x, b.y, 7, b.h);
        }
      }
      ctx.restore();
      if (textA > 0) {
        ctx.save();
        ctx.globalAlpha *= appear * textA;
        const labelX = b.x + 22 * kx;
        const appliedX = b.x + S.labelW * kx + 10;
        text(part.label, labelX, cy(b), F.label, C.text);
        const applied = role.parts[part.id].applied;
        const lineCount = wrap(applied, F.applied, b.x + b.w - appliedX - 16, 400).length > 1 ? 2 : 1;
        para(applied, appliedX, cy(b) - ((lineCount - 1) * F.appliedLine) / 2, F.applied, b.x + b.w - appliedX - 16, F.appliedLine, 2, C.text, { weight: 400 });
        ctx.restore();
      }
    });
    // 下の欄: 6つの見出しの注記 → 強調した部分の原文
    if (headA <= 0) return;
    const panelY = r.y + S.panelY * ky;
    const noteA = win(t, 5.0, 6.55, 0.3) * headA;
    if (noteA > 0) {
      ctx.save();
      ctx.globalAlpha *= noteA;
      para(model.note, x, panelY + 16, F.small, innerW, F.small * 1.4, L.portrait ? 3 : 2, C.muted, { weight: 400 });
      ctx.restore();
    }
    HIGHLIGHTS.forEach((h) => {
      const a = win(t, h.in, h.out, 0.25) * headA;
      if (a <= 0) return;
      const part = model.parts.find((p) => p.id === h.part);
      ctx.save();
      ctx.globalAlpha *= a;
      text(`原文の節：${part.section}`, x, panelY + 14, F.small - 2, C.accent);
      para(`“${role.parts[h.part].source}”`, x, panelY + 14 + F.small * 1.5, F.small, innerW, F.small * 1.35, 2, C.text, { weight: 400, family: 'serif' });
      ctx.restore();
    });
  }

  function drawCompact(r, role, alpha, o = {}) {
    if (alpha <= 0) return;
    const P = L.compact;
    const F = L.F;
    ctx.save();
    ctx.globalAlpha *= alpha;
    text('役割の指示書', r.x + 20, r.y + P.kickerY, F.compactKicker, C.muted);
    const short = fit(role.short, F.compactShort, r.w - 60, 18);
    text(role.short, r.x + 20, r.y + P.shortY, short, C.text);
    if (P.nameInline) {
      const left = r.x + 30 + measure(role.short, short);
      const size = fit(role.name, F.compactName, r.x + r.w - 30 - left, 12, 400);
      text(role.name, left, r.y + P.nameY + 2, size, C.muted, { weight: 400 });
    } else {
      text(role.name, r.x + 20, r.y + P.nameY, fit(role.name, F.compactName, r.w - 50, 12, 400), C.muted, { weight: 400 });
    }
    if (o.stripes !== false) stripes(r).forEach((b, i) => {
      roundRect(b, 3);
      ctx.fillStyle = o.lit && o.lit.includes(PART_IDS[i]) ? C.accent : C.strong;
      ctx.globalAlpha = alpha * (o.lit && o.lit.includes(PART_IDS[i]) ? 1 : 0.55);
      ctx.fill();
      ctx.globalAlpha = alpha;
    });
    ctx.restore();
  }

  function docStroke(t, emphasis) {
    return emphasis > 0.5 ? { lw: 4, stroke: C.accent } : { lw: 2.5, stroke: C.strong };
  }

  function drawUxDoc(t) {
    const base = track(t, L.tracks.uxDoc);
    const lift = 14 * prog(t, 0.9, 1.3) * (1 - prog(t, 1.8, 2.6));
    const r = { ...base, y: base.y - lift };
    const chosen = win(t, 0.9, 3.6, 0.3);
    const emphasis = Math.max(stepGlow(t, 0), 0);
    const st = chosen > 0.5 ? { lw: 4, stroke: C.action } : docStroke(t, emphasis);
    paper(r, { shadow: true, fold: 24, ...st });
    drawCardText(r, model.roles.ux.name, 1 - prog(t, 1.9, 2.4));
    const fold = ease(t, 10.0, 11.0);
    if (t >= 3.3 && fold < 1) drawOpen(r, model.roles.ux, t, fold);
    // 線は帯がたたみ終わってから要約の紙が引き継ぐ
    drawCompact(r, model.roles.ux, prog(t, 10.5, 11.0), { lit: t < 16 ? HIGHLIGHTS.map((h) => h.part) : [], stripes: fold >= 1 });
  }

  function drawFeDoc(t) {
    const r = track(t, L.tracks.feDoc);
    const shelfA = t < 17.4 ? lerp(1, 0.6, ease(t, 2.0, 3.6)) : 1;
    const run2 = win(t, 18.8, 23.0, 0.3);
    const emphasis = stepGlow(t, 0);
    ctx.save();
    ctx.globalAlpha = shelfA;
    const st = emphasis > 0.5 ? docStroke(t, 1) : run2 > 0.5 ? { lw: 3.5, stroke: C.text } : { lw: r.w < 80 ? 1.5 : 2.5, stroke: C.strong };
    paper(r, { shadow: r.w > 80, fold: r.w < 80 ? 8 : 24, ...st });
    drawCardText(r, model.roles.frontend.name, 1 - prog(t, 1.9, 2.4));
    ctx.restore();
    drawCompact(r, model.roles.frontend, prog(t, 18.2, 18.8));
  }

  function drawTask(t) {
    const a = prog(t, 10.4, 10.9);
    if (a <= 0) return;
    const r = track(t, L.tracks.task);
    const F = L.F;
    const big = r.h >= 200;
    const emphasis = stepGlow(t, 1);
    ctx.save();
    ctx.globalAlpha = a;
    paper(R(r.x + 10, r.y + 10, r.w, r.h), { fold: 18, lw: 1.5 });
    paper(r, { fold: 18, lw: emphasis > 0.5 ? 4 : 2.5, stroke: emphasis > 0.5 ? C.accent : C.strong });
    const compact = clamp((176 - r.h) / 52, 0, 1);
    text('今回の依頼と材料', r.x + 20, r.y + lerp(32, 22, compact), fit('今回の依頼と材料', F.node, r.w - 50, 16), C.text);
    const rows = big ? [r.y + 74, r.y + 132] : [r.y + lerp(68, 52, compact), r.y + lerp(104, 82, compact)];
    const paths = ['request.txt', 'event.json'];
    ['依頼文', '架空の6企画'].forEach((label, i) => {
      text(label, r.x + 20, rows[i], F.small + 2, C.text, { weight: 700 });
      if (big) text(paths[i], r.x + 20, rows[i] + 26, F.mono, C.muted, { weight: 400, family: 'mono' });
    });
    const tickY = big ? r.y + r.h - 34 : r.y + r.h - lerp(30, 20, compact);
    model.event.lanes.forEach((_, i) => {
      roundRect(R(r.x + 20 + i * 30, tickY, 24, 14), 3);
      ctx.fillStyle = C.strong;
      ctx.fill();
    });
    ctx.restore();
  }

  function drawAi(t) {
    const a = prog(t, 10.8, 11.5);
    if (a <= 0) return;
    const base = track(t, L.tracks.ai);
    const k = lerp(0.85, 1, ease(t, 10.8, 11.5));
    const r = R(base.x + (base.w * (1 - k)) / 2, base.y + (base.h * (1 - k)) / 2, base.w * k, base.h * k);
    const F = L.F;
    const emphasis = stepGlow(t, 1);
    ctx.save();
    ctx.globalAlpha = a;
    roundRect(r, 28);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.lineWidth = emphasis > 0.5 ? 5 : 3.5;
    ctx.strokeStyle = emphasis > 0.5 ? C.accent : C.text;
    ctx.stroke();
    const tall = ease(t, 16.4, 17.4);
    // 1回の実行: 読むことを表すレンズと「AI」
    if (tall < 1) {
      ctx.save();
      ctx.globalAlpha *= 1 - tall;
      const lensY = r.y + 40;
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.action;
      ctx.beginPath();
      ctx.arc(cx(r) - 4, lensY - 2, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx(r) + 7, lensY + 9);
      ctx.lineTo(cx(r) + 17, lensY + 19);
      ctx.stroke();
      text('AI', cx(r), cy(r) + 8, F.ai, C.text, { align: 'center' });
      text('指示書と依頼を読む', cx(r), r.y + r.h - 28, fit('指示書と依頼を読む', F.aiSub, r.w - 24, 12, 400), C.muted, { align: 'center', weight: 400 });
      ctx.restore();
    }
    // 2回の実行: 同じAIの縦長の箱。1回目と2回目の入口
    if (tall > 0) {
      ctx.save();
      ctx.globalAlpha *= tall;
      const chars = Array.from('同じAI');
      const step = F.aiTall * 1.08;
      chars.forEach((ch, i) => text(ch, cx(r), cy(r) - ((chars.length - 1) * step) / 2 + i * step, F.aiTall, C.text, { align: 'center' }));
      text('Opus 5.5', cx(r), cy(r) + ((chars.length + 1) * step) / 2 + 6, F.run - 2, C.muted, { align: 'center', weight: 400 });
      pill('1回目', cx(r), L.p1, F.run, { fill: C.bg });
      ctx.globalAlpha *= prog(t, 18.6, 19.2);
      pill('2回目', cx(r), L.p2, F.run, { fill: C.bg, stroke: C.text });
      ctx.restore();
    }
    ctx.restore();
  }

  function drawHandoff(t) {
    const a = prog(t, 13.0, 13.6);
    if (a <= 0) return;
    const r = track(t, L.tracks.handoff);
    if (r.w < 30) return;
    const F = L.F;
    ctx.save();
    ctx.globalAlpha = a;
    paper(r, { shadow: true, fold: 20, lw: 2.5 });
    const inner = prog(t, 13.8, 14.3);
    ctx.globalAlpha = a * inner;
    text('引き継ぎ書', r.x + 18, r.y + 32, fit('引き継ぎ書', F.node, r.w - 50, 16), C.text);
    const count = clamp(Math.floor((r.h - 96) / 18), 1, 5);
    lines(r, count, r.y + 56, 18);
    text('ux-handoff.json・.md', r.x + 18, r.y + r.h - 20, fit('ux-handoff.json・.md', F.mono, r.w - 36, 11, 400, 'mono'), C.muted, { weight: 400, family: 'mono' });
    ctx.restore();
  }

  function swatchRow(x, y, w, h) {
    const cw = w / SWATCH_KEYS.length;
    SWATCH_KEYS.forEach((key, i) => {
      ctx.fillStyle = C[key];
      ctx.fillRect(x + i * cw, y, cw, h);
    });
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.strong;
    ctx.strokeRect(x, y, w, h);
  }

  function drawCss(t) {
    const a = prog(t, 13.3, 13.9);
    if (a <= 0) return;
    const r = track(t, L.tracks.css);
    if (r.w < 30) return;
    const F = L.F;
    ctx.save();
    ctx.globalAlpha = a;
    paper(r, { shadow: true, fold: 20, lw: 2.5 });
    ctx.globalAlpha = a * prog(t, 14.1, 14.6);
    text('CSS土台', r.x + 18, r.y + 30, fit('CSS土台', F.node, r.w - 50, 16), C.text);
    const roomy = r.h >= 160;
    const tight = clamp((120 - r.h) / 25, 0, 1);
    const sh = roomy ? 40 : lerp(clamp(r.h - 74, 14, 24), clamp(r.h - 86, 8, 16), tight);
    swatchRow(r.x + 18, r.y + lerp(50, 46, tight), r.w - 36, sh);
    if (roomy) text('ライト・ダーク・システム', r.x + 18, r.y + 50 + sh + 26, fit('ライト・ダーク・システム', F.small, r.w - 36, 12, 400), C.muted, { weight: 400 });
    text('foundation.css', r.x + 18, r.y + r.h - lerp(16, 10, tight), fit('foundation.css', F.mono, r.w - 36, 11, 400, 'mono'), C.muted, { weight: 400, family: 'mono' });
    ctx.restore();
  }

  function drawToken(t) {
    const a = prog(t, 19.0, 19.3);
    if (a <= 0) return;
    const r = track(t, L.tracks.token);
    const F = L.F;
    ctx.save();
    ctx.globalAlpha = a;
    paper(r, { fold: 14, lw: 3, stroke: C.accent, fill: C.accentSoft });
    if (r.w > 100) {
      ctx.globalAlpha = a * prog(t, 19.9, 20.4);
      const label = '引き継ぎ書＋CSS';
      text(label, r.x + 14, r.y + 24, fit(label, F.small, r.w - 36, 12), C.text);
      const sheet = R(r.x + 14, r.y + 42, (r.w - 40) / 2, r.h - 56);
      paper(sheet, { fold: 8, lw: 1.5 });
      lines({ ...sheet, x: sheet.x - 10, w: sheet.w }, 3, sheet.y + 10, 11);
      swatchRow(r.x + 26 + sheet.w, r.y + 42 + (r.h - 56) / 2 - 10, sheet.w, 20);
    }
    ctx.restore();
  }

  function drawGuide(t) {
    const a = prog(t, 20.6, 21.0);
    if (a <= 0) return;
    const r = track(t, L.tracks.guide);
    const F = L.F;
    const emphasis = stepGlow(t, 2);
    ctx.save();
    ctx.globalAlpha = a;
    roundRect(r, 12);
    ctx.fillStyle = C.bg;
    ctx.fill();
    ctx.lineWidth = emphasis > 0.5 ? 5 : 3;
    ctx.strokeStyle = emphasis > 0.5 ? C.accent : C.text;
    ctx.stroke();
    if (r.w > 120) {
      ctx.globalAlpha = a * prog(t, 21.2, 21.8);
      // ブラウザーの枠
      ctx.save();
      roundRect(r, 12);
      ctx.clip();
      ctx.fillStyle = C.sunk;
      ctx.fillRect(r.x, r.y, r.w, 30);
      ctx.restore();
      [0, 1, 2].forEach((i) => {
        ctx.beginPath();
        ctx.arc(r.x + 20 + i * 18, r.y + 15, 5, 0, Math.PI * 2);
        ctx.fillStyle = C.strong;
        ctx.fill();
      });
      text('guide.html', r.x + r.w - 16, r.y + 15, F.guideId, C.muted, { align: 'right', weight: 400, family: 'mono' });
      const title = `${model.event.title}（架空）`;
      text(title, r.x + 18, r.y + 52, fit(title, F.guideTitle, r.w - 36, 12), C.text);
      // 6企画の小さな時間の地図（実際の時刻）と、保存した4企画
      const ev = model.event;
      const mapX = r.x + 18;
      const mapW = r.w - 36;
      const laneH = L.portrait ? 26 : 30;
      const mapY = r.y + 72;
      const xAt = (min) => mapX + ((min - ev.dayStart) / (ev.dayEnd - ev.dayStart)) * mapW;
      let k = 0;
      ev.lanes.forEach((s) => {
        const b = R(xAt(s.start) + 1, mapY + s.lane * (laneH + 6), xAt(s.end) - xAt(s.start) - 2, laneH);
        const on = s.picked ? prog(t, 21.8 + k * 0.2, 22.1 + k * 0.2) : 0;
        if (s.picked) k += 1;
        roundRect(b, 4);
        ctx.fillStyle = on > 0 ? C.actionSoft : C.surface;
        ctx.fill();
        ctx.lineWidth = on > 0.5 ? 3 : 1.5;
        ctx.strokeStyle = on > 0.5 ? C.action : C.strong;
        ctx.stroke();
        if (b.w >= measure(s.id, F.guideId) + 6) text(s.id, cx(b), cy(b) + 1, F.guideId, on > 0.5 ? C.text : C.muted, { align: 'center' });
      });
      const axisY = mapY + ev.laneCount * (laneH + 6) + 10;
      const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
      text(hhmm(ev.dayStart), mapX, axisY, F.guideId, C.muted, { weight: 400 });
      text(hhmm(ev.dayEnd), mapX + mapW, axisY, F.guideId, C.muted, { weight: 400, align: 'right' });
      ctx.globalAlpha = a * prog(t, 22.5, 22.9);
      const sum = `保存した予定　${model.count}企画・${model.totalText}`;
      text(sum, r.x + 18, r.y + r.h - 24, fit(sum, F.guideSum, r.w - 36, 14), C.action);
    }
    ctx.restore();
  }

  function drawEdges(t) {
    const P = L.portrait;
    const single = 1 - prog(t, 16.0, 16.3);
    if (single > 0 && t >= 11.4) {
      const doc = track(t, L.tracks.uxDoc);
      const task = track(t, L.tracks.task);
      const ai = track(t, L.tracks.ai);
      const ho = track(t, L.tracks.handoff);
      const css = track(t, L.tracks.css);
      const pin = prog(t, 11.4, 12.4);
      const pout = prog(t, 13.2, 14.0);
      const o = { alpha: single };
      if (P) {
        edge({ x: cx(doc), y: doc.y + doc.h }, { x: ai.x + ai.w * 0.3, y: ai.y }, 'bottom', 'top', pin, o);
        edge({ x: cx(task), y: task.y + task.h }, { x: ai.x + ai.w * 0.7, y: ai.y }, 'bottom', 'top', pin, o);
        edge({ x: ai.x + ai.w * 0.3, y: ai.y + ai.h }, { x: cx(ho), y: ho.y }, 'bottom', 'top', pout, o);
        edge({ x: ai.x + ai.w * 0.7, y: ai.y + ai.h }, { x: cx(css), y: css.y }, 'bottom', 'top', pout, o);
      } else {
        edge({ x: doc.x + doc.w, y: cy(doc) }, { x: ai.x, y: ai.y + ai.h * 0.35 }, 'right', 'left', pin, o);
        edge({ x: task.x + task.w, y: cy(task) }, { x: ai.x, y: ai.y + ai.h * 0.65 }, 'right', 'left', pin, o);
        edge({ x: ai.x + ai.w, y: ai.y + ai.h * 0.35 }, { x: ho.x, y: cy(ho) }, 'right', 'left', pout, o);
        edge({ x: ai.x + ai.w, y: ai.y + ai.h * 0.65 }, { x: css.x, y: cy(css) }, 'right', 'left', pout, o);
      }
    }
    const two = prog(t, 17.2, 17.8);
    if (two > 0) {
      const ai = L.aiTall;
      const right = ai.x + ai.w;
      const o = { alpha: two };
      const run2 = prog(t, 18.8, 19.4);
      const accent = { alpha: two, color: C.accent, dash: [10, 8] };
      edge({ x: L.d1.x + L.d1.w, y: L.p1 }, { x: ai.x, y: L.p1 }, 'right', 'left', 1, o);
      edge({ x: L.tk.x + L.tk.w, y: L.tk.y + L.tk.h * 0.35 }, { x: ai.x, y: lerp(L.p1, L.p2, 0.3) }, 'right', 'left', 1, o);
      edge({ x: L.tk.x + L.tk.w, y: L.tk.y + L.tk.h * 0.65 }, { x: ai.x, y: lerp(L.p1, L.p2, 0.7) }, 'right', 'left', run2, o);
      edge({ x: L.d2.x + L.d2.w, y: L.p2 }, { x: ai.x, y: L.p2 }, 'right', 'left', run2, o);
      edge({ x: right, y: cy(L.handoff2) }, { x: L.handoff2.x, y: cy(L.handoff2) }, 'right', 'left', 1, o);
      edge({ x: right, y: cy(L.css2) }, { x: L.css2.x, y: cy(L.css2) }, 'right', 'left', 1, o);
      edge(L.tokenFrom, { x: cx(L.token), y: L.token.y }, 'bottom', 'top', prog(t, 19.0, 20.4), accent);
      edge({ x: L.token.x, y: cy(L.token) }, { x: right, y: cy(L.token) }, 'left', 'right', prog(t, 20.2, 20.6), { ...accent, dash: [] });
      if (P) edge(L.guideFrom, { x: L.guideFrom.x, y: L.guide.y }, 'bottom', 'top', prog(t, 20.6, 21.4), o);
      else edge(L.guideFrom, { x: L.guide.x, y: L.guideFrom.y }, 'right', 'left', prog(t, 20.6, 21.4), o);
    }
  }

  function drawPulse(t) {
    if (t < PULSE[0] || t > PULSE[1] + 0.4) return;
    const p = prog(t, PULSE[0], PULSE[1]);
    const fade = 1 - prog(t, PULSE[1], PULSE[1] + 0.4);
    ctx.save();
    for (let i = 6; i >= 0; i -= 1) {
      const q = pointAlong(L.pulse, p - i * 0.012);
      ctx.globalAlpha = fade * (i === 0 ? 1 : 0.12 * (7 - i) / 2);
      ctx.beginPath();
      ctx.arc(q.x, q.y, i === 0 ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = C.action;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSamePill(t) {
    const a = win(t, 18.4, 23.0, 0.4);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    pill('同じAI・次の実行', L.samePill.x, L.samePill.y, L.F.pill, { stroke: C.text });
    ctx.restore();
  }

  function drawSteps(t) {
    const a = prog(t, 23.8, 24.4);
    if (a <= 0) return;
    const F = L.F;
    const arrow = ' → ';
    const widths = STEPS.map((s) => measure(s, F.step));
    const aw = measure(arrow, F.step, 400);
    const total = widths.reduce((sum, w) => sum + w, 0) + aw * 2;
    let x = L.steps.align === 'center' ? L.steps.x - total / 2 : L.steps.x;
    ctx.save();
    ctx.globalAlpha = a;
    STEPS.forEach((label, k) => {
      const glow = stepGlow(t, k);
      const done = t >= PULSE[1];
      text(label, x, L.steps.y, F.step, glow > 0.5 ? C.action : done ? C.text : C.muted);
      if (glow > 0) {
        ctx.fillStyle = C.action;
        ctx.globalAlpha = a * glow;
        ctx.fillRect(x, L.steps.y + F.step * 0.62, widths[k], 4);
        ctx.globalAlpha = a;
      }
      x += widths[k];
      if (k < STEPS.length - 1) {
        text(arrow, x, L.steps.y, F.step, C.muted, { weight: 400 });
        x += aw;
      }
    });
    ctx.restore();
  }

  function drawFinish(t) {
    const F = L.F;
    const a = prog(t, 28.0, 28.6);
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      const label = '実際の作例を触る →';
      const w = measure(label, F.cta) + F.cta * 1.6;
      const r = R(L.cta.cx - w / 2, L.cta.y, w, L.cta.h);
      ctx.strokeStyle = C.action;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(L.cta.cx, L.guide.y + L.guide.h);
      ctx.lineTo(L.cta.cx, r.y);
      ctx.stroke();
      roundRect(r, L.cta.h / 2);
      ctx.fillStyle = C.action;
      ctx.fill();
      text(label, cx(r), cy(r) + 1, F.cta, C.onAction, { align: 'center' });
      ctx.restore();
    }
  }

  // 図の層の外（引いた図と重ならない位置）に置く小さな注記
  function drawNote(t) {
    const b = prog(t, 28.2, 28.8);
    if (b <= 0) return;
    ctx.save();
    ctx.globalAlpha = b;
    text('架空のイベント作例／AI実行は制作時', L.note.x, L.note.y, L.F.note, C.muted, { weight: 400, align: L.note.align });
    ctx.restore();
  }

  function headlineAt(t) {
    const scene = SCENES.find((s, i) => t < s.out || i === SCENES.length - 1);
    const index = SCENES.indexOf(scene);
    const prev = SCENES[index - 1];
    const next = SCENES[index + 1];
    const fadeIn = prev && prev.headline !== scene.headline ? prog(t, scene.in, scene.in + 0.3) : 1;
    const fadeOut = next && next.headline !== scene.headline ? 1 - prog(t, scene.out - 0.3, scene.out) : 1;
    return { text: scene.headline, alpha: Math.min(fadeIn, fadeOut) };
  }

  function drawChrome(t) {
    const F = L.F;
    text('Agency Agents', L.kicker.x, L.kicker.y, F.kicker, C.muted);
    const badgeA = prog(t, 10.0, 10.4);
    if (badgeA > 0) {
      ctx.save();
      ctx.globalAlpha = badgeA;
      pill('制作済みの流れを図解', L.badge.right, L.badge.y, F.badge, { align: 'right', fill: C.accentSoft, stroke: C.accent });
      ctx.restore();
    }
    const head = headlineAt(t);
    if (head.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = head.alpha;
      text(head.text, L.headline.x, L.headline.y, fit(head.text, F.headline, L.headline.maxW, 26, 700, 'serif'), C.text, { family: 'serif' });
      ctx.restore();
    }
    const lines2 = L.credit.ys.length === 2 ? model.credit : [model.credit.join(' · ')];
    lines2.forEach((line, i) => {
      text(line, L.credit.x, L.credit.ys[i], fit(line, F.credit, L.credit.maxW, 11, 400), C.muted, { weight: 400 });
    });
  }

  /* ---------- 1枚を描く（ctx.save / restore で毎回まるごと） ---------- */

  function drawFrame(seconds) {
    const t = clamp(Number.isFinite(seconds) ? seconds : 0, 0, DURATION);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(L.ox, L.oy);
    ctx.scale(L.s, L.s);
    // 図の層: 全体の場面で少し引いて、道の全体を見せる
    ctx.save();
    const zoom = lerp(1, L.camera.scale, ease(t, 23.0, 24.4));
    ctx.translate(L.camera.cx, L.camera.cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-L.camera.cx, -L.camera.cy);
    drawEdges(t);
    drawLibrary(t);
    drawTask(t);
    drawAi(t);
    drawHandoff(t);
    drawCss(t);
    drawFeDoc(t);
    drawUxDoc(t);
    drawToken(t);
    drawGuide(t);
    drawSamePill(t);
    drawPulse(t);
    drawFinish(t);
    ctx.restore();
    drawSteps(t);
    drawNote(t);
    drawChrome(t);
    ctx.restore();
  }

  function clearCanvas() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  /* ---------- プレビューの操作（書き出しでは使わない） ---------- */

  const ui = {
    error: document.getElementById('film-error'),
    errorReason: document.getElementById('film-error-reason'),
    retry: document.getElementById('film-retry'),
    status: document.getElementById('film-status'),
    play: document.getElementById('film-play'),
    reset: document.getElementById('film-reset'),
    end: document.getElementById('film-end'),
    replay: document.getElementById('film-replay'),
    clock: document.getElementById('film-clock'),
    scrub: document.getElementById('film-scrub'),
    scenes: document.getElementById('film-scenes'),
  };
  const controls = [ui.play, ui.reset, ui.end, ui.replay, ui.scrub];
  let current = 0;
  let playing = false;
  let frame = 0;
  let startWall = 0;
  let startTime = 0;
  let sceneButtons = [];
  let ready = false;
  let wired = false;

  function show(time) {
    current = clamp(time, 0, DURATION);
    drawFrame(current);
    ui.scrub.value = String(Math.round(current * 10) / 10);
    ui.scrub.setAttribute('aria-valuetext', `${current.toFixed(1)}秒`);
    ui.clock.textContent = `${current.toFixed(1)}秒 / ${DURATION.toFixed(1)}秒`;
    sceneButtons.forEach(({ button, scene }, i) => {
      const last = i === sceneButtons.length - 1;
      if (current >= scene.in && (current < scene.out || (last && current <= scene.out))) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  function setPlaying(next) {
    playing = next;
    ui.play.setAttribute('aria-pressed', String(playing));
    ui.play.textContent = playing ? '一時停止' : '再生';
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (playing) {
      startWall = performance.now();
      startTime = current;
      frame = window.requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    frame = 0;
    if (!playing || !ready) return;
    const time = Math.min(DURATION, startTime + (now - startWall) / 1000);
    show(time);
    if (time >= DURATION) setPlaying(false); // 最後で止まる。くり返さない
    else frame = window.requestAnimationFrame(tick);
  }

  function wireControls() {
    if (wired) return;
    wired = true;
    sceneButtons = SCENES.map((scene) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'c-button v-scene';
      const name = document.createElement('span');
      name.textContent = scene.name;
      const time = document.createElement('span');
      time.className = 'v-scene__time';
      time.textContent = `${scene.in}秒`;
      button.append(name, time);
      button.setAttribute('aria-label', `${scene.in}秒「${scene.name}」へ移動`);
      button.addEventListener('click', () => {
        setPlaying(false);
        show(scene.in);
      });
      ui.scenes.append(button);
      return { button, scene };
    });
    ui.play.addEventListener('click', () => {
      if (playing) {
        setPlaying(false);
        return;
      }
      if (current >= DURATION) show(0);
      setPlaying(true);
    });
    ui.reset.addEventListener('click', () => {
      setPlaying(false);
      show(0);
    });
    ui.end.addEventListener('click', () => {
      setPlaying(false);
      show(DURATION);
    });
    ui.replay.addEventListener('click', () => {
      show(0);
      setPlaying(true);
    });
    ui.scrub.addEventListener('input', () => {
      setPlaying(false);
      show(Number(ui.scrub.value));
    });
  }

  function setControlsEnabled(enabled) {
    [...controls, ...sceneButtons.map((item) => item.button)].forEach((control) => {
      control.disabled = !enabled;
    });
  }

  function showError(error) {
    clearCanvas();
    if (playing) setPlaying(false);
    setControlsEnabled(false);
    ui.status.textContent = '';
    ui.errorReason.textContent = error instanceof AssetError ? error.message : '想定していない形式の素材でした。';
    ui.error.hidden = false;
    ui.retry.disabled = false;
  }

  /* ---------- 準備と時間の入口 ---------- */

  function start() {
    ready = false;
    model = null;
    const attempt = loadAssets().then((built) => {
      model = built;
      C = built.colors;
      L = makeLayout(built);
      ready = true;
      ui.error.hidden = true;
      if (RENDER) {
        drawFrame(0);
        return;
      }
      wireControls();
      setControlsEnabled(true);
      show(current);
      ui.status.textContent = `11の素材を確かめました。${WIDTH}×${HEIGHT}・${FPS}fps・${DURATION}秒・音なし。止まった状態です。`;
    });
    attempt.catch((error) => {
      ready = false;
      model = null;
      showError(error);
    });
    window.motionReady = attempt;
    return attempt;
  }

  ui.retry.addEventListener('click', () => {
    ui.retry.disabled = true;
    ui.error.hidden = true;
    ui.status.textContent = '11の素材のバイト数と SHA-256 を確かめ直しています…';
    start();
  });

  start();

  window.seek = (seconds) => {
    if (!ready) return window.motionReady.then(() => drawFrame(seconds));
    drawFrame(seconds);
    return undefined;
  };
})();
