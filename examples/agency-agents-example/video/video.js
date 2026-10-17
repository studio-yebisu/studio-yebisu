'use strict';

/*
 * video.js — 役割をつなぎ、使える予定へ。（32秒・無音の図解の編集ソース）
 *
 * Motion Reel の時間の契約:
 *   - window.seek(秒) は、呼び出しの順番・壁時計・前のフレームに依らず、その時刻の完成した1枚を描く。
 *   - window.motionConfig = { duration: 32, fps, width, height, posterTime: 31, audioEvents: [] }。
 *   - window.renderConfig の width / height / fps を起動時に反映し、縦（720×1280）と横（1280×720）で配置を作り直す。
 *   - window.motionReady は、8つの素材のバイト数・SHA-256・形を確かめ、フォントの準備が済んでから解決する。
 *   - window.__MOTION_RENDER__ === true のときはプレビュー用のタイマーを動かさない。
 * 素材は assets/manifest.json（固定の SHA-256）に記載のものだけを使い、色は ../foundation.css のライトのトークンから読む。
 * 音は使わない（audioEvents は空。音声・読み上げ・音の素材はない）。
 */
(() => {
  /* ---------- 固定値 ---------- */

  const MANIFEST_PATH = 'assets/manifest.json';
  const MANIFEST_SHA256 = '3e5aa40af6c6c8c0fcda8b6cd5ddd740cba09e34fe44944013b30d22e8a3e70e';
  const MANIFEST_FORMAT = 'studio-yebisu-motion-assets-v1';
  const CASE_ID = 'agency-agents-example';
  const ASSETS = Object.freeze({
    event: 'event.json',
    handoff: 'ux-handoff.json',
    record: 'recorded-itinerary.json',
    diagram: 'diagram-data.json',
    decisions: 'implementation-decisions.json',
    timeline: 'timeline.json',
    upstream: 'upstream.json',
    original: 'original-verification.json',
  });
  const DURATION = 32;
  const POSTER_TIME = 31;
  const DEFAULT_FPS = 30;
  const FORMATS = Object.freeze({ wide: { width: 1280, height: 720 }, portrait: { width: 720, height: 1280 } });
  const REPOSITORY = 'msitarzewski/agency-agents';
  const COMMIT = 'bd956db032d907387e6b9ddebff3e18f1de8c679';
  const ROLE_IDS = ['ux-architect', 'frontend-developer'];
  const STAGE_IDS = ['input', 'ux', 'frontend', 'itinerary'];
  const SCENE_IDS = ['overview', 'handoff', 'implementation', 'conflict', 'touch', 'export', 'finish'];
  const SCENE_BOUNDS = [0, 4, 9, 14, 20, 25, 29, 32];
  const SCENE_NAMES = Object.freeze({
    overview: '全体',
    handoff: '受け渡し',
    implementation: '実装',
    conflict: '重なり',
    touch: '14時',
    export: '保存',
    finish: '完成',
  });
  const SESSION_IDS = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
  const EXPORT_FORMAT = 'komorebi-itinerary/v1';
  const EXPORT_NOTICE = '架空のイベントの予定メモです。予約・支払い・参加確定ではありません。';
  const SELECTION_RULE = '開始が相手の終了より前で、相手の開始が終了より前なら重なりとし、重なる企画は同時に選ばない。終了と開始が同時刻なら重ならない。予約不要の企画も開始から終了までの枠全体を使う。';
  const EXPORT_KEYS = ['format', 'fictional', 'reserved', 'notice', 'event', 'source', 'selection_rule', 'selected_ids', 'sessions', 'derived'];
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
    alert: '--color-alert',
    alertSoft: '--color-alert-soft',
    notice: '--color-notice-soft',
    focus: '--color-focus',
  });
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const HEX64_RE = /^[0-9a-f]{64}$/;
  const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  const NOON = 12 * 60;

  /* ---------- 大きさと設定（起動時に1回だけ決める） ---------- */

  const RENDER = window.__MOTION_RENDER__ === true;
  const renderConfig = window.renderConfig && typeof window.renderConfig === 'object' ? window.renderConfig : {};
  const isDimension = (value) => Number.isInteger(value) && value >= 16 && value <= 4096 && value % 2 === 0;
  let preset = FORMATS.wide; // 同梱の render.py は大きさを渡さないため、既定は横
  try {
    const requested = new URLSearchParams(window.location.search).get('format');
    if (requested && Object.prototype.hasOwnProperty.call(FORMATS, requested)) preset = FORMATS[requested];
  } catch {
    // 既定の横のまま
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

  /* ---------- SHA-256 ---------- */

  const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function sha256Fallback(bytes) {
    const length = bytes.length;
    const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
    padded.set(bytes);
    padded[length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(length / 0x20000000));
    view.setUint32(padded.length - 4, (length << 3) >>> 0);
    const hash = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i += 1) {
        const a = w[i - 15];
        const b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = hash;
      for (let i = 0; i < 64; i += 1) {
        const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + s1 + ch + SHA_K[i] + w[i]) >>> 0;
        const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (s0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }
    return Array.from(hash, (word) => word.toString(16).padStart(8, '0')).join('');
  }

  async function sha256Hex(bytes) {
    const subtle = window.crypto && window.crypto.subtle;
    if (subtle && typeof subtle.digest === 'function') {
      try {
        const digest = await subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      } catch {
        // 下の実装で計算する
      }
    }
    return sha256Fallback(bytes);
  }

  /* ---------- 取得と検証 ---------- */

  class AssetError extends Error {}

  const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isText = (value) => typeof value === 'string' && value.trim() !== '';
  const isTime = (value) => typeof value === 'string' && TIME_RE.test(value);
  const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function toMinutes(hm) {
    const match = TIME_RE.exec(hm);
    return Number(match[1]) * 60 + Number(match[2]);
  }

  const overlaps = (a, b) => toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

  function compareSessions(a, b) {
    return (
      toMinutes(a.start) - toMinutes(b.start) ||
      toMinutes(a.end) - toMinutes(b.end) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  }

  function check(condition, where, reason) {
    if (!condition) throw new AssetError(`${where}：${reason}。`);
  }

  async function fetchBytes(path) {
    let response;
    try {
      response = await fetch(path, { cache: 'no-store' });
    } catch {
      throw new AssetError(`${path}：通信に失敗しました。`);
    }
    if (!response.ok) throw new AssetError(`${path}：サーバーが ${response.status} を返しました。`);
    try {
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new AssetError(`${path}：通信が途中で切れました。`);
    }
  }

  const utf8 = new TextDecoder('utf-8', { fatal: true });

  function decode(bytes, path) {
    try {
      return utf8.decode(bytes);
    } catch {
      throw new AssetError(`${path}：UTF-8 の文字として読めませんでした。`);
    }
  }

  function parse(text, path) {
    try {
      return JSON.parse(text);
    } catch {
      throw new AssetError(`${path}：JSONとして読めませんでした。`);
    }
  }

  function validateManifest(data) {
    const where = MANIFEST_PATH;
    check(isPlainObject(data), where, 'オブジェクトが必要です');
    check(data.format === MANIFEST_FORMAT, `${where} の format`, `${MANIFEST_FORMAT} が必要です`);
    check(data.case === CASE_ID, `${where} の case`, `${CASE_ID} が必要です`);
    const expected = Object.values(ASSETS);
    check(Array.isArray(data.assets) && data.assets.length === expected.length, `${where} の assets`, `${expected.length}件の配列が必要です`);
    const seen = new Set();
    data.assets.forEach((entry, index) => {
      const at = `${where} の assets[${index}]`;
      check(isPlainObject(entry), at, 'オブジェクトが必要です');
      check(expected.includes(entry.file) && !seen.has(entry.file), `${at}.file`, '決まった素材名を1回ずつ書く必要があります');
      seen.add(entry.file);
      check(Number.isInteger(entry.bytes) && entry.bytes > 0, `${at}.bytes`, '1以上の整数が必要です');
      check(typeof entry.sha256 === 'string' && HEX64_RE.test(entry.sha256), `${at}.sha256`, '64桁の16進数が必要です');
    });
    return data;
  }

  function validateEvent(event) {
    const where = `assets/${ASSETS.event}`;
    check(isPlainObject(event), where, 'オブジェクトが必要です');
    ['id', 'title', 'date', 'timezone', 'venue'].forEach((key) => check(isText(event[key]), `${where} の ${key}`, '文字列が必要です'));
    check(event.fictional === true, `${where} の fictional`, 'true が必要です');
    check(event.timezone === 'Asia/Tokyo', `${where} の timezone`, 'Asia/Tokyo が必要です');
    check(/^\d{4}-\d{2}-\d{2}$/.test(event.date), `${where} の date`, 'YYYY-MM-DD が必要です');
    check(Array.isArray(event.sessions) && event.sessions.length === SESSION_IDS.length, `${where} の sessions`, '6件の配列が必要です');
    const ids = new Set();
    event.sessions.forEach((session, index) => {
      const at = `${where} の sessions[${index}]`;
      check(isPlainObject(session), at, 'オブジェクトが必要です');
      check(SESSION_IDS.includes(session.id) && !ids.has(session.id), `${at}.id`, 'S01〜S06 を1回ずつ');
      ids.add(session.id);
      ['title', 'room', 'kind'].forEach((key) => check(isText(session[key]), `${at}.${key}`, '文字列が必要です'));
      check(isTime(session.start) && isTime(session.end) && toMinutes(session.start) < toMinutes(session.end), `${at}.start/end`, '開始より後の終了が必要です');
      check(Number.isInteger(session.price_yen) && session.price_yen >= 0, `${at}.price_yen`, '0以上の整数が必要です');
      check(session.capacity === null || (Number.isInteger(session.capacity) && session.capacity >= 1), `${at}.capacity`, '1以上の整数か null');
      check(typeof session.reservation_required === 'boolean', `${at}.reservation_required`, 'true か false');
    });
    return event;
  }

  function validateHandoff(handoff, event) {
    const where = `assets/${ASSETS.handoff}`;
    check(isPlainObject(handoff) && isPlainObject(handoff.meta), `${where} の meta`, 'オブジェクトが必要です');
    check(handoff.meta.fictional === true, `${where} の meta.fictional`, 'true が必要です');
    check(handoff.meta.event_id === event.id, `${where} の meta.event_id`, '入力のイベントと同じ値が必要です');
    check(handoff.meta.source_commit === COMMIT, `${where} の meta.source_commit`, '固定コミットが必要です');
    check(handoff.meta.mode === 'sequential-role-application', `${where} の meta.mode`, 'sequential-role-application が必要です');
    check(Array.isArray(handoff.roles) && handoff.roles.length === ROLE_IDS.length, `${where} の roles`, '2件の配列が必要です');
    handoff.roles.forEach((role, index) => {
      check(isPlainObject(role) && role.id === ROLE_IDS[index] && isText(role.name), `${where} の roles[${index}]`, `${ROLE_IDS[index]} と名前が必要です`);
      check(Array.isArray(role.deliverables) && role.deliverables.every(isText), `${where} の roles[${index}].deliverables`, '文字列の配列が必要です');
    });
    check(handoff.roles[0].deliverables.includes('foundation.css'), `${where} の roles[0].deliverables`, 'foundation.css が必要です');
    check(handoff.roles[0].deliverables.includes('outputs/ux-handoff.json'), `${where} の roles[0].deliverables`, 'outputs/ux-handoff.json が必要です');
    return handoff;
  }

  function buildExport(event, sessions) {
    return {
      format: EXPORT_FORMAT,
      fictional: true,
      reserved: false,
      notice: EXPORT_NOTICE,
      event: { id: event.id, title: event.title, date: event.date, timezone: event.timezone, venue: event.venue },
      source: { event_file: 'input/event.json', role_source: REPOSITORY, role_source_commit: COMMIT },
      selection_rule: SELECTION_RULE,
      selected_ids: sessions.map((session) => session.id),
      sessions,
      derived: { count: sessions.length, total_price_yen: sessions.reduce((sum, session) => sum + session.price_yen, 0) },
    };
  }

  function validateRecord(record, rawText, event) {
    const where = `assets/${ASSETS.record}`;
    check(isPlainObject(record) && sameJSON(Object.keys(record), EXPORT_KEYS), where, '元の書き出しと同じ項目と順番が必要です');
    check(record.format === EXPORT_FORMAT && record.fictional === true && record.reserved === false, where, 'format・fictional=true・reserved=false が必要です');
    check(Array.isArray(record.selected_ids) && record.selected_ids.length > 0, `${where} の selected_ids`, '配列が必要です');
    const sessions = record.selected_ids.map((id) => event.sessions.find((session) => session.id === id));
    check(sessions.every(Boolean), `${where} の selected_ids`, '入力にある企画のIDが必要です');
    const ordered = [...sessions].sort(compareSessions);
    check(sessions.every((session, index) => session === ordered[index]), `${where} の selected_ids`, '時刻順が必要です');
    for (let i = 0; i < sessions.length; i += 1) {
      for (let j = i + 1; j < sessions.length; j += 1) check(!overlaps(sessions[i], sessions[j]), `${where} の selected_ids`, '重なる企画があります');
    }
    check(
      Array.isArray(record.sessions) && record.sessions.length === sessions.length && record.sessions.every((s, i) => sameJSON(s, sessions[i])),
      `${where} の sessions`,
      '入力の企画オブジェクトと同じ値が必要です',
    );
    const total = sessions.reduce((sum, session) => sum + session.price_yen, 0);
    check(sameJSON(record.derived, { count: sessions.length, total_price_yen: total }), `${where} の derived`, '件数と、選んだ企画の費用の合計が必要です');
    check(`${JSON.stringify(buildExport(event, sessions), null, 2)}\n` === rawText, where, '元の書き出し方で同じバイト列にならない');
    return record;
  }

  function validateDiagram(diagram, event, record) {
    const where = `assets/${ASSETS.diagram}`;
    check(isPlainObject(diagram) && diagram.format === 'studio-yebisu-agency-handoff-timeline-v1', `${where} の format`, '決まった形式名が必要です');
    check(diagram.fictional === true, `${where} の fictional`, 'true が必要です');
    check(
      Array.isArray(diagram.stages) && diagram.stages.length === STAGE_IDS.length && diagram.stages.every((stage, i) => isPlainObject(stage) && stage.id === STAGE_IDS[i] && isText(stage.label) && Array.isArray(stage.paths) && stage.paths.length > 0 && stage.paths.every(isText)),
      `${where} の stages`,
      `${STAGE_IDS.join('・')} の順の段階が必要です`,
    );
    check(Array.isArray(diagram.sessions) && diagram.sessions.length === event.sessions.length, `${where} の sessions`, '6件が必要です');
    diagram.sessions.forEach((item, index) => {
      const source = event.sessions.find((session) => isPlainObject(item) && session.id === item.id);
      check(
        source && isText(item.short_label) && item.start === source.start && item.end === source.end && item.price_yen === source.price_yen && item.room === source.room && item.kind === source.kind,
        `${where} の sessions[${index}]`,
        '入力と同じID・時刻・費用・部屋・種類が必要です',
      );
    });
    const computed = [];
    const sorted = [...event.sessions].sort(compareSessions);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        if (overlaps(a, b)) {
          computed.push({ ids: [a.id, b.id], start: toMinutes(a.start) >= toMinutes(b.start) ? a.start : b.start, end: toMinutes(a.end) <= toMinutes(b.end) ? a.end : b.end });
        }
      }
    }
    check(sameJSON(diagram.overlaps, computed), `${where} の overlaps`, '入力から求めた重なりと同じ値が必要です');
    const touch = diagram.touching;
    check(isPlainObject(touch) && Array.isArray(touch.ids) && touch.ids.length === 2 && touch.allowed === true && touch.movement_allowance === false, `${where} の touching`, '接する組と許可が必要です');
    const [first, second] = touch.ids.map((id) => event.sessions.find((session) => session.id === id));
    check(first && second && first.end === touch.at && second.start === touch.at, `${where} の touching`, '入力の終了と開始が同じ時刻である必要があります');
    check(sameJSON(diagram.recorded_selection, record.selected_ids) && diagram.recorded_total_yen === record.derived.total_price_yen, `${where} の recorded_*`, '保存済みの記録と同じ値が必要です');
    check(sameJSON(diagram.selection_after_conflict, [record.selected_ids[0]]), `${where} の selection_after_conflict`, '保存済みの最初の企画が必要です');
    const rejected = event.sessions.find((session) => session.id === diagram.rejected_addition);
    const kept = event.sessions.find((session) => session.id === diagram.selection_after_conflict[0]);
    check(rejected && kept && overlaps(rejected, kept), `${where} の rejected_addition`, '残した企画と重なる企画が必要です');
    return diagram;
  }

  function validateDecisions(decisions) {
    const where = `assets/${ASSETS.decisions}`;
    check(isPlainObject(decisions) && decisions.format === 'studio-yebisu-agency-original-decisions-v1' && decisions.historical === true, where, '決まった形式名と historical=true が必要です');
    check(isPlainObject(decisions.A09) && decisions.A09.status === 'rejected', `${where} の A09`, 'rejected が必要です');
    check(isPlainObject(decisions.A06) && decisions.A06.status === 'amended', `${where} の A06`, 'amended が必要です');
    return decisions;
  }

  function validateTimeline(timeline, record, diagram) {
    const where = `assets/${ASSETS.timeline}`;
    check(isPlainObject(timeline) && timeline.format === 'studio-yebisu-agency-visual-timeline-v1', `${where} の format`, '決まった形式名が必要です');
    check(timeline.duration === DURATION && timeline.fps === DEFAULT_FPS && timeline.silent === true, where, `${DURATION}秒・${DEFAULT_FPS}fps・無音が必要です`);
    check(Array.isArray(timeline.scenes) && timeline.scenes.length === SCENE_IDS.length, `${where} の scenes`, '7場面が必要です');
    timeline.scenes.forEach((scene, index) => {
      check(
        isPlainObject(scene) && scene.id === SCENE_IDS[index] && scene.in === SCENE_BOUNDS[index] && scene.out === SCENE_BOUNDS[index + 1] && isText(scene.headline),
        `${where} の scenes[${index}]`,
        `${SCENE_IDS[index]}（${SCENE_BOUNDS[index]}–${SCENE_BOUNDS[index + 1]}秒）と見出しが必要です`,
      );
    });
    const conflict = timeline.scenes[3];
    check(sameJSON(conflict.selected_ids, diagram.selection_after_conflict) && conflict.rejected_id === diagram.rejected_addition, `${where} の conflict`, '図の素材と同じ選択と拒否が必要です');
    check(sameJSON(timeline.scenes[4].selected_ids, record.selected_ids), `${where} の touch`, '保存済みの記録と同じ選択が必要です');
    check(timeline.scenes[5].record === ASSETS.record, `${where} の export`, `${ASSETS.record} が必要です`);
    return timeline;
  }

  function validateUpstream(upstream) {
    const where = `assets/${ASSETS.upstream}`;
    check(isPlainObject(upstream) && upstream.repository === REPOSITORY && upstream.commit === COMMIT, where, '固定の原典とコミットが必要です');
    check(upstream.license === 'MIT' && isText(upstream.copyright), where, 'MIT と著作権表示が必要です');
    check(upstream.referenced_architect_methodology_present === false, where, '参照先の欠落の記録が必要です');
    return upstream;
  }

  function validateOriginal(original, record) {
    const where = `assets/${ASSETS.original}`;
    check(isPlainObject(original) && original.id === CASE_ID && original.source_commit === COMMIT, where, '同じ作例と固定コミットが必要です');
    check(
      isPlainObject(original.data_checks) && sameJSON(original.data_checks.expected_sample_plan, record.selected_ids) && original.data_checks.expected_sample_total_yen === record.derived.total_price_yen,
      `${where} の data_checks`,
      '保存済みの記録と同じ選択と合計が必要です',
    );
    check(isPlainObject(original.browser) && original.browser.actual_native_export_matches_original_sessions === true, `${where} の browser`, '元の画面での保存の記録が必要です');
    return original;
  }

  function readTokens() {
    const style = window.getComputedStyle(document.documentElement);
    const colors = {};
    Object.entries(TOKENS).forEach(([key, name]) => {
      const value = style.getPropertyValue(name).trim();
      check(COLOR_RE.test(value), `../foundation.css の ${name}`, '色のトークンを読めません');
      colors[key] = value;
    });
    const sans = style.getPropertyValue('--font-sans').replace(/\s+/g, ' ').trim();
    const serif = style.getPropertyValue('--font-serif').replace(/\s+/g, ' ').trim();
    check(isText(sans) && isText(serif), '../foundation.css の書体', '--font-sans と --font-serif が必要です');
    return { colors, fonts: { sans, serif } };
  }

  async function loadAssets() {
    const manifestBytes = await fetchBytes(MANIFEST_PATH);
    check((await sha256Hex(manifestBytes)) === MANIFEST_SHA256, MANIFEST_PATH, 'SHA-256 が固定値と一致しません');
    const manifest = validateManifest(parse(decode(manifestBytes, MANIFEST_PATH), MANIFEST_PATH));
    const texts = {};
    await Promise.all(
      manifest.assets.map(async (entry) => {
        const path = `assets/${entry.file}`;
        const bytes = await fetchBytes(path);
        check(bytes.byteLength === entry.bytes, path, `バイト数が記録の ${entry.bytes} と違います（${bytes.byteLength}）`);
        check((await sha256Hex(bytes)) === entry.sha256, path, 'SHA-256 が記録と一致しません');
        texts[entry.file] = decode(bytes, path);
      }),
    );
    const json = (file) => parse(texts[file], `assets/${file}`);
    const event = validateEvent(json(ASSETS.event));
    const handoff = validateHandoff(json(ASSETS.handoff), event);
    const record = validateRecord(json(ASSETS.record), texts[ASSETS.record], event);
    const diagram = validateDiagram(json(ASSETS.diagram), event, record);
    const decisions = validateDecisions(json(ASSETS.decisions));
    const timeline = validateTimeline(json(ASSETS.timeline), record, diagram);
    const upstream = validateUpstream(json(ASSETS.upstream));
    const original = validateOriginal(json(ASSETS.original), record);
    const theme = readTokens();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return buildModel({ event, handoff, record, diagram, decisions, timeline, upstream, original, theme });
  }

  /* ---------- 素材から作る図の型 ---------- */

  function buildModel(data) {
    const { event, handoff, record, diagram, timeline } = data;
    const sessions = [...event.sessions].sort(compareSessions).map((session) => ({
      ...session,
      short: diagram.sessions.find((item) => item.id === session.id).short_label,
    }));
    const index = new Map(sessions.map((session, i) => [session.id, i]));
    const scenes = timeline.scenes;
    const sc = Object.fromEntries(scenes.map((scene) => [scene.id, scene]));

    // 行（午前・午後）と段: 図のページと同じ規則（空いている段のうち、最後の終了がいちばん遅い段へ）
    const groups = [
      { key: 'am', name: '午前', items: sessions.filter((s) => toMinutes(s.start) < NOON) },
      { key: 'pm', name: '午後', items: sessions.filter((s) => toMinutes(s.start) >= NOON) },
    ].filter((group) => group.items.length > 0);
    groups.forEach((group) => {
      group.start = Math.floor(Math.min(...group.items.map((s) => toMinutes(s.start))) / 60) * 60;
      group.rawEnd = Math.ceil(Math.max(...group.items.map((s) => toMinutes(s.end))) / 60) * 60;
    });
    const span = Math.max(...groups.map((group) => group.rawEnd - group.start));
    const placement = new Map();
    groups.forEach((group, rowIndex) => {
      group.span = span;
      const laneEnds = [];
      group.items.forEach((session) => {
        const start = toMinutes(session.start);
        let best = -1;
        laneEnds.forEach((end, i) => {
          if (end <= start && (best === -1 || end > laneEnds[best])) best = i;
        });
        if (best === -1) {
          best = laneEnds.length;
          laneEnds.push(0);
        }
        laneEnds[best] = toMinutes(session.end);
        placement.set(session.id, { row: rowIndex, lane: best });
      });
      group.laneCount = laneEnds.length;
    });

    // 時刻の割り当て（すべて timeline.json の場面の境目から決める）
    const keep = sc.conflict.selected_ids[0];
    const selectAt = new Map([[keep, sc.conflict.in + 0.4]]);
    sc.touch.selected_ids
      .filter((id) => !selectAt.has(id))
      .forEach((id, k) => selectAt.set(id, sc.touch.in + 0.4 + k * 1.0));
    const T = {
      move1: [sc.handoff.in + 0.4, sc.handoff.in + 1.8],
      attach: [sc.handoff.in + 2.0, sc.handoff.in + 3.2],
      move2: [sc.implementation.in + 0.2, sc.implementation.in + 1.6],
      chipStart: sc.implementation.in + 1.8,
      chipStep: 0.32,
      chipDur: 1.0,
      dropDur: 0.8,
      attempt: sc.conflict.in + 1.8,
      keepTag: [sc.conflict.in + 4.2, sc.conflict.out - 0.3],
      touchHi: [sc.touch.in + 3.0, sc.touch.out - 0.2],
      exportStart: sc.export.in + 0.3,
      exportStep: 0.3,
      exportDur: 1.1,
      sums: [sc.export.in + 2.3, sc.export.in + 2.8],
      flags: [sc.export.in + 2.7, sc.export.in + 3.2],
      pulse: [sc.overview.in + 0.8, sc.overview.out - 0.6],
      slots: [sc.export.in, sc.export.in + 0.3],
    };

    const touchIds = diagram.touching.ids;
    const formatYen = (yen) => `${String(yen).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}円`;
    return {
      ...data,
      sessions,
      index,
      groups,
      placement,
      selectAt,
      keep,
      rejected: sc.conflict.rejected_id,
      touch: { ids: touchIds, at: toMinutes(diagram.touching.at), label: diagram.touching.at },
      overlapsList: diagram.overlaps,
      T,
      scenes,
      stages: diagram.stages,
      roleNames: handoff.roles.map((role) => role.name),
      inputFile: diagram.stages[0].paths[0].split('/').pop(),
      countText: `${record.derived.count}件`,
      totalText: formatYen(record.derived.total_price_yen),
      flagText: `${record.fictional === true ? '架空' : ''}・${record.reserved === false ? '予約ではない' : ''}`,
      originalText: data.original.browser.actual_native_export_matches_original_sessions === true ? '元の画面で保存した記録' : '',
      a09Text: data.decisions.A09.status === 'rejected' ? 'A09 入れ替え案は不採用' : '',
      credit: [
        `${data.upstream.repository} @ ${data.upstream.commit.slice(0, 7)} · ${data.upstream.license}（${data.upstream.copyright}）`,
        `架空イベント「${event.title}」${event.date}`,
      ],
    };
  }

  /* ---------- 配置（縦と横で別々に組む。基準の大きさで描き、拡大縮小する） ---------- */

  function makeLayout(model, width, height) {
    const portrait = height > width;
    const BW = portrait ? 720 : 1280;
    const BH = portrait ? 1280 : 720;
    const s = Math.min(width / BW, height / BH);
    const L = { portrait, BW, BH, s, ox: (width - BW * s) / 2, oy: (height - BH * s) / 2 };

    if (portrait) {
      L.badge = { x: 40, y: 40, h: 46, font: 26, gap: 12, rowGap: 10, maxW: 640 };
      L.headline = { x: 40, gapTop: 22, font: 50, lineH: 62, maxW: 640 };
      L.station = { w: 190, h: 220, labelFont: 32, subFont: 19, labelY: 30, subY: 58, docX: 8, docY: 72, docW: 174, docH: 140, fold: 18, pillFont: 18, swatch: 16 };
      L.stations = [40, 265, 490].map((x) => ({ x, y: 254 }));
      // 縦は 375px 幅の画面で見ると約0.52倍。図の文字は 31px 以上（画面で約16px 以上）にする
      L.chip = { cols: 2, w: 76, h: 38, gapX: 6, gapY: 5, padX: 8, padY: 8, font: 31 };
      L.map = { top: 506, gutterX: 40, gutterW: 40, trackX: 88, trackW: 592, axisH: 38, notesGap: 8, laneH: 78, laneGap: 8, railGap: 10, railH: 46, rowGap: 26, axisFont: 31, barFont: 32, gutterFont: 32, railFont: 22, segFont: 31 };
      L.plan = { x: 40, y: 1080, w: 640, h: 140, titleFont: 32, dateFont: 22, countFont: 32, totalFont: 44, flagFont: 24 };
      L.slot = { dir: 'row', x: 56, y: 1124, w: 96, h: 44, gap: 10, font: 31 };
      L.credit = { x: 40, y: 1240, font: 18, lineH: 24, lines: 2 };
      L.callout = { font: 28, subFont: 24, pad: 12, gap: 20 };
      L.pulseR = 10;
    } else {
      L.badge = { x: 48, y: 26, h: 36, font: 20, gap: 10, rowGap: 8, maxW: 1184 };
      L.headline = { x: 48, gapTop: 16, font: 40, lineH: 50, maxW: 1184 };
      L.station = { w: 250, h: 150, labelFont: 26, subFont: 16, labelY: 22, subY: 22, docX: 8, docY: 42, docW: 234, docH: 100, fold: 14, subRight: true, pillFont: 15, swatch: 14 };
      L.stations = [150, 322, 494].map((y) => ({ x: 48, y }));
      L.chip = { cols: 3, w: 68, h: 36, gapX: 6, gapY: 8, padX: 8, padY: 8, font: 24 };
      L.map = { top: 150, gutterX: 330, gutterW: 34, trackX: 372, trackW: 628, axisH: 30, notesGap: 6, laneH: 62, laneGap: 8, railGap: 8, railH: 38, rowGap: 28, axisFont: 21, barFont: 24, gutterFont: 24, railFont: 17, segFont: 22 };
      L.plan = { x: 1032, y: 150, w: 200, h: 456, titleFont: 26, dateFont: 16, countFont: 26, totalFont: 40, flagFont: 16 };
      L.slot = { dir: 'column', x: 1046, y: 222, w: 172, h: 44, gap: 10, font: 22 };
      L.credit = { x: 48, y: 690, font: 16, lineH: 20, lines: 1 };
      L.callout = { font: 22, subFont: 18, pad: 10, gap: 16 };
      L.pulseR = 8;
    }

    const m = L.map;
    m.lanesH = (count) => count * m.laneH + (count - 1) * m.laneGap;
    let top = m.top;
    L.rows = model.groups.map((group) => {
      const row = { ...group, top, axisY: top, lanesY: top + m.axisH + m.notesGap };
      row.railY = row.lanesY + m.lanesH(group.laneCount) + m.railGap;
      row.bottom = row.railY + m.railH;
      top = row.bottom + m.rowGap;
      return row;
    });
    L.xAt = (row, minutes) => m.trackX + ((minutes - row.start) / row.span) * m.trackW;
    L.bar = (id) => {
      const session = model.sessions[model.index.get(id)];
      const { row: r, lane } = model.placement.get(id);
      const row = L.rows[r];
      const x = L.xAt(row, toMinutes(session.start));
      return { x, y: row.lanesY + lane * (m.laneH + m.laneGap), w: L.xAt(row, toMinutes(session.end)) - x, h: m.laneH };
    };
    L.seg = (id) => {
      const bar = L.bar(id);
      const row = L.rows[model.placement.get(id).row];
      return { x: bar.x, y: row.railY + 5, w: bar.w, h: m.railH - 10 };
    };
    L.stationRect = (i) => ({ x: L.stations[i].x, y: L.stations[i].y, w: L.station.w, h: L.station.h });
    L.docAt = (i) => ({ x: L.stations[i].x + L.station.docX, y: L.stations[i].y + L.station.docY, w: L.station.docW, h: L.station.docH });
    L.chipIn = (doc, i) => {
      const c = L.chip;
      const col = i % c.cols;
      const rowIndex = Math.floor(i / c.cols);
      return { x: doc.x + c.padX + col * (c.w + c.gapX), y: doc.y + c.padY + rowIndex * (c.h + c.gapY), w: c.w, h: c.h };
    };
    L.slotAt = (k) => {
      const sl = L.slot;
      return sl.dir === 'row'
        ? { x: sl.x + k * (sl.w + sl.gap), y: sl.y, w: sl.w, h: sl.h }
        : { x: sl.x, y: sl.y + k * (sl.h + sl.gap), w: sl.w, h: sl.h };
    };

    // 関係の線の通り道
    const st = (i) => L.stationRect(i);
    const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const last = L.rows[L.rows.length - 1];
    const plan = L.plan;
    if (portrait) {
      const fe = st(2);
      L.feToMap = [{ x: fe.x + fe.w / 2, y: fe.y + fe.h }, { x: fe.x + fe.w / 2, y: m.top - 6 }];
      const sideX = m.trackX + m.trackW + 22;
      const turnY = plan.y - 12;
      L.railToPlan = L.rows.map((row) => [
        { x: m.trackX + m.trackW, y: row.railY + m.railH / 2 },
        { x: sideX, y: row.railY + m.railH / 2 },
        { x: sideX, y: turnY },
        { x: plan.x + plan.w - 20, y: turnY },
        { x: plan.x + plan.w - 20, y: plan.y - 2 },
      ]);
      L.pulse = [center(st(0)), center(st(1)), center(st(2)), L.feToMap[1], { x: L.feToMap[1].x, y: last.railY + m.railH / 2 }, ...L.railToPlan[L.rows.length - 1].slice(0, 5), { x: plan.x + plan.w - 20, y: plan.y + 24 }];
    } else {
      const fe = st(2);
      const entryY = last.lanesY + m.lanesH(last.laneCount) / 2;
      L.feToMap = [
        { x: fe.x + fe.w, y: fe.y + fe.h / 2 },
        { x: fe.x + fe.w + 16, y: fe.y + fe.h / 2 },
        { x: fe.x + fe.w + 16, y: entryY },
        { x: m.gutterX - 2, y: entryY },
      ];
      L.railToPlan = L.rows.map((row) => [
        { x: m.trackX + m.trackW, y: row.railY + m.railH / 2 },
        { x: plan.x - 2, y: row.railY + m.railH / 2 },
      ]);
      L.pulse = [center(st(0)), center(st(1)), center(st(2)), ...L.feToMap.slice(1), { x: m.trackX + m.trackW / 2, y: entryY }, { x: m.trackX + m.trackW / 2, y: last.railY + m.railH / 2 }, ...L.railToPlan[L.rows.length - 1], { x: plan.x + 24, y: last.railY + m.railH / 2 }];
    }
    return L;
  }

  /* ---------- 時間の道具（すべて t から直接求める） ---------- */

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  // まだ起きない出来事（開始が Infinity）は 0 のまま
  const prog = (t, a, b) => (Number.isFinite(a) && Number.isFinite(b) && b > a ? clamp((t - a) / (b - a), 0, 1) : 0);
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  const easeOut = (x) => 1 - (1 - x) ** 3;
  const lerp = (a, b, x) => a + (b - a) * x;
  const lerpRect = (a, b, x) => ({ x: lerp(a.x, b.x, x), y: lerp(a.y, b.y, x), w: lerp(a.w, b.w, x), h: lerp(a.h, b.h, x) });
  const window01 = (t, a, b, fade) => Math.min(prog(t, a, a + fade), 1 - prog(t, b - fade, b));

  /* ---------- 描画の道具 ---------- */

  let model = null;
  let L = null;
  let C = null;

  const font = (size, weight = 700, family = 'sans') => `${weight} ${size}px ${family === 'serif' ? model.theme.fonts.serif : model.theme.fonts.sans}`;

  function roundRect(x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function docPath(x, y, w, h, fold) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - fold, y);
    ctx.lineTo(x + w, y + fold);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }

  function text(str, x, y, size, color, options = {}) {
    ctx.font = font(size, options.weight === undefined ? 700 : options.weight, options.family);
    ctx.fillStyle = color;
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function measure(str, size, weight = 700, family = 'sans') {
    ctx.font = font(size, weight, family);
    return ctx.measureText(str).width;
  }

  function fitSize(str, size, maxW, minSize, weight = 700) {
    let current = size;
    while (current > minSize && measure(str, current, weight) > maxW) current -= 1;
    return current;
  }

  function verticalText(str, cx, cy, size, color) {
    const chars = Array.from(str);
    const step = size * 1.08;
    const start = cy - ((chars.length - 1) * step) / 2;
    chars.forEach((ch, i) => text(ch, cx, start + i * step, size, color, { align: 'center' }));
  }

  function hatch(x, y, w, h, color, spacing) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = spacing * 0.45;
    for (let d = -h; d < w + h; d += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + d, y + h);
      ctx.lineTo(x + d + h, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function polyline(points, color, width, dash) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }

  function arrowHead(from, to, color, size) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - size * Math.cos(angle - 0.45), to.y - size * Math.sin(angle - 0.45));
    ctx.lineTo(to.x - size * Math.cos(angle + 0.45), to.y - size * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function arrowLine(points, color, width) {
    polyline(points, color, width);
    arrowHead(points[points.length - 2], points[points.length - 1], color, width * 4 + 4);
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

  const sessionOf = (id) => model.sessions[model.index.get(id)];
  const departAt = (i) => model.T.chipStart + i * model.T.chipStep;
  const landAt = (i) => departAt(i) + model.T.chipDur;
  const selAt = (id) => (model.selectAt.has(id) ? model.selectAt.get(id) : Infinity);
  const inPlan = (id, t) => t >= selAt(id) + model.T.dropDur;

  function docRectAt(t) {
    const { move1, move2 } = model.T;
    const lift = L.portrait ? 26 : 22;
    if (t < move1[0]) return L.docAt(0);
    if (t < move1[1]) {
      const p = easeIO(prog(t, move1[0], move1[1]));
      const r = lerpRect(L.docAt(0), L.docAt(1), p);
      r.y -= Math.sin(Math.PI * p) * lift;
      return r;
    }
    if (t < move2[0]) return L.docAt(1);
    if (t < move2[1]) {
      const p = easeIO(prog(t, move2[0], move2[1]));
      const r = lerpRect(L.docAt(1), L.docAt(2), p);
      r.y -= Math.sin(Math.PI * p) * lift;
      return r;
    }
    return L.docAt(2);
  }

  // 重なりで入れられない（自分は予定になく、重なる相手が予定に入っている）時刻からの進み
  function conflictLevel(id, t) {
    if (t >= selAt(id)) return 0;
    const session = sessionOf(id);
    let level = 0;
    model.sessions.forEach((other) => {
      if (other.id !== id && overlaps(session, other)) {
        const at = selAt(other.id) + model.T.dropDur;
        level = Math.max(level, prog(t, at, at + 0.3));
      }
    });
    return level;
  }

  /* ---------- 各層 ---------- */

  function drawWires(t) {
    const m = L.map;
    const muted = C.muted;
    // 6企画 → 設計 → 実装
    for (let i = 0; i < 2; i += 1) {
      const a = L.stationRect(i);
      const b = L.stationRect(i + 1);
      const points = L.portrait
        ? [{ x: a.x + a.w + 4, y: a.y + a.h / 2 }, { x: b.x - 4, y: b.y + b.h / 2 }]
        : [{ x: a.x + a.w / 2, y: a.y + a.h + 3 }, { x: b.x + b.w / 2, y: b.y - 3 }];
      arrowLine(points, muted, 2.5);
    }
    arrowLine(L.feToMap, muted, 2.5);
    // 予定の列 → 予定メモ（最初の企画が入ると緑になる）
    const firstPlan = Math.min(...model.sessions.map((s) => selAt(s.id))) + model.T.dropDur;
    const live = prog(t, firstPlan, firstPlan + 0.4);
    L.railToPlan.forEach((points) => {
      arrowLine(points, live > 0.5 ? C.action : muted, live > 0.5 ? 3 : 2.5);
    });
    // 選んだ帯 → 予定の列（同じ時刻の幅を点線で下ろす）
    model.sessions.forEach((session) => {
      if (!inPlan(session.id, t)) return;
      const bar = L.bar(session.id);
      const seg = L.seg(session.id);
      const alpha = prog(t, selAt(session.id) + model.T.dropDur, selAt(session.id) + model.T.dropDur + 0.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      polyline([{ x: bar.x + 2, y: bar.y + bar.h }, { x: bar.x + 2, y: seg.y }], C.action, 2, [5, 5]);
      polyline([{ x: bar.x + bar.w - 2, y: bar.y + bar.h }, { x: bar.x + bar.w - 2, y: seg.y }], C.action, 2, [5, 5]);
      ctx.restore();
    });
    // 14:00 で接する線（帯の後ろ）
    const row = L.rows[model.placement.get(model.touch.ids[1]).row];
    const x = L.xAt(row, model.touch.at);
    const hi = window01(t, model.T.touchHi[0], model.T.touchHi[1], 0.3);
    polyline([{ x, y: row.lanesY - m.notesGap }, { x, y: row.bottom }], C.action, 2.5 + hi * 3);
  }

  function drawStations(t) {
    const { move1, move2 } = model.T;
    const active = [t < move1[0] + 0.3, t >= move1[1] && t < move2[0] + 0.3, t >= move2[1] && t < SCENE_BOUNDS[3]];
    for (let i = 0; i < 3; i += 1) {
      const r = L.stationRect(i);
      ctx.save();
      roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fillStyle = C.surface;
      ctx.fill();
      ctx.lineWidth = active[i] ? 4 : 2;
      ctx.strokeStyle = active[i] ? C.action : C.strong;
      ctx.stroke();
      ctx.restore();
      const label = model.stages[i].label;
      const sub = i === 0 ? model.inputFile : model.roleNames[i - 1];
      const st = L.station;
      text(label, r.x + 12, r.y + st.labelY, st.labelFont, C.text);
      if (st.subRight) {
        const size = fitSize(sub, st.subFont, r.w - measure(label, st.labelFont) - 34, 12, 400);
        text(sub, r.x + r.w - 12, r.y + st.subY, size, C.muted, { align: 'right', weight: 400 });
      } else {
        const size = fitSize(sub, st.subFont, r.w - 24, 13, 400);
        text(sub, r.x + 12, r.y + st.subY, size, C.muted, { weight: 400 });
      }
    }
    // 文書が通ったあとに残る跡（元のファイルは残っている）
    const traces = [];
    if (t >= move1[0]) traces.push(0);
    if (t >= move2[0]) traces.push(1);
    traces.forEach((i) => {
      const d = L.docAt(i);
      ctx.save();
      ctx.globalAlpha = 0.55;
      docPath(d.x, d.y, d.w, d.h, L.station.fold);
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.strong;
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawBarBox(r, session, options) {
    const m = L.map;
    const { selected = 0, conflict = 0, textAlpha = 1, ghost = false } = options;
    ctx.save();
    if (ghost) {
      roundRect(r.x, r.y, r.w, r.h, 8);
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.strong;
      ctx.stroke();
      ctx.restore();
      return;
    }
    roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = C.surface;
    ctx.fill();
    if (selected > 0) {
      ctx.globalAlpha = selected;
      ctx.fillStyle = C.actionSoft;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 重なる時間の部分（帯の中だけ。長さは変えない）
    model.overlapsList.forEach((overlap) => {
      if (!overlap.ids.includes(session.id)) return;
      const row = L.rows[model.placement.get(session.id).row];
      const x0 = L.xAt(row, toMinutes(overlap.start));
      const x1 = L.xAt(row, toMinutes(overlap.end));
      ctx.save();
      roundRect(r.x, r.y, r.w, r.h, 8);
      ctx.clip();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = C.alertSoft;
      ctx.fillRect(x0, r.y, x1 - x0, r.h);
      ctx.globalAlpha = options.flash || 0;
      ctx.fillStyle = C.alert;
      ctx.fillRect(x0, r.y, x1 - x0, r.h);
      ctx.restore();
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.alert;
      ctx.beginPath();
      ctx.moveTo(x0, r.y);
      ctx.lineTo(x0, r.y + r.h);
      ctx.moveTo(x1, r.y);
      ctx.lineTo(x1, r.y + r.h);
      ctx.stroke();
      ctx.restore();
    });
    if (conflict > 0) {
      ctx.save();
      ctx.globalAlpha = conflict * 0.85;
      hatch(r.x, r.y, r.w, r.h, C.alertSoft, L.portrait ? 14 : 12);
      ctx.restore();
    }
    roundRect(r.x, r.y, r.w, r.h, 8);
    if (conflict > 0.5 && selected === 0) {
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.alert;
    } else if (selected > 0.5) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.action;
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.strong;
    }
    ctx.stroke();
    ctx.restore();

    if (textAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = textAlpha;
    const size = m.barFont;
    const line1 = `${selected > 0.5 ? '✓' : ''}${session.id} ${session.price_yen === 0 ? '無料' : `${session.price_yen}円`}`;
    const cx = r.x + r.w / 2;
    text(line1, cx, r.y + r.h * 0.31, fitSize(line1, size, r.w - 12, size - 6), C.text, { align: 'center' });
    text(session.short, cx, r.y + r.h * 0.71, fitSize(session.short, size, r.w - 12, size - 6, 400), C.text, { align: 'center', weight: 400 });
    ctx.restore();
  }

  function drawMap(t) {
    const m = L.map;
    L.rows.forEach((row) => {
      const lanesH = m.lanesH(row.laneCount);
      // 縦書きの行名と「予定」
      verticalText(row.name, m.gutterX + m.gutterW / 2, row.lanesY + lanesH / 2, m.gutterFont, C.text);
      verticalText('予定', m.gutterX + m.gutterW / 2, row.railY + m.railH / 2, m.railFont, C.action);
      // 時刻の目盛り
      ctx.save();
      ctx.strokeStyle = C.strong;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(m.trackX, row.axisY + m.axisH);
      ctx.lineTo(m.trackX + m.trackW, row.axisY + m.axisH);
      ctx.stroke();
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 1;
      for (let minutes = row.start; minutes <= row.start + row.span; minutes += 30) {
        const x = L.xAt(row, minutes);
        ctx.beginPath();
        ctx.moveTo(x, row.lanesY);
        ctx.lineTo(x, row.lanesY + lanesH);
        ctx.stroke();
      }
      ctx.restore();
      for (let minutes = row.start; minutes <= row.start + row.span; minutes += 60) {
        const x = L.xAt(row, minutes);
        const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
        const align = minutes === row.start ? 'left' : minutes === row.start + row.span ? 'right' : 'center';
        text(label, x, row.axisY + m.axisH / 2, m.axisFont, C.muted, { align, weight: 400 });
      }
      // 予定の列
      ctx.save();
      roundRect(m.trackX, row.railY, m.trackW, m.railH, 6);
      ctx.fillStyle = C.sunk;
      ctx.fill();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.strong;
      ctx.stroke();
      ctx.restore();
    });

    // 重なりの印（帯の上の ⊓）
    model.overlapsList.forEach((overlap) => {
      const row = L.rows[model.placement.get(overlap.ids[0]).row];
      const x0 = L.xAt(row, toMinutes(overlap.start));
      const x1 = L.xAt(row, toMinutes(overlap.end));
      const y = row.lanesY - 2;
      const shown = prog(t, landAt(model.index.get(overlap.ids[1])), landAt(model.index.get(overlap.ids[1])) + 0.3);
      if (shown <= 0) return;
      ctx.save();
      ctx.globalAlpha = shown;
      polyline([{ x: x0, y }, { x: x0, y: y - m.notesGap + 2 }, { x: x1, y: y - m.notesGap + 2 }, { x: x1, y }], C.alert, 3);
      ctx.restore();
    });

    // 帯（着く前は点線の枠だけ）
    const flash = window01(t, model.T.attempt + 0.7, model.T.attempt + 1.7, 0.25) * (0.35 + 0.25 * Math.sin((t - model.T.attempt) * Math.PI * 4));
    model.sessions.forEach((session, i) => {
      const r = L.bar(session.id);
      if (t < landAt(i)) {
        drawBarBox(r, session, { ghost: true });
        return;
      }
      const flashing = session.id === model.keep || session.id === model.rejected ? Math.max(0, flash) : 0;
      drawBarBox(r, session, {
        selected: prog(t, selAt(session.id), selAt(session.id) + 0.3),
        conflict: conflictLevel(session.id, t),
        textAlpha: prog(t, landAt(i), landAt(i) + 0.25),
        flash: flashing,
      });
    });

    // 予定の列に入った企画
    model.sessions.forEach((session) => {
      if (!inPlan(session.id, t)) return;
      const r = L.seg(session.id);
      ctx.save();
      roundRect(r.x + 1, r.y, r.w - 2, r.h, 5);
      ctx.fillStyle = C.action;
      ctx.fill();
      ctx.restore();
      text(session.id, r.x + r.w / 2, r.y + r.h / 2, m.segFont, C.onAction, { align: 'center' });
    });
  }

  function drawEventDoc(t) {
    const doc = docRectAt(t);
    const st = L.station;
    ctx.save();
    docPath(doc.x, doc.y, doc.w, doc.h, st.fold);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.text;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(doc.x + doc.w - st.fold, doc.y);
    ctx.lineTo(doc.x + doc.w - st.fold, doc.y + st.fold);
    ctx.lineTo(doc.x + doc.w, doc.y + st.fold);
    ctx.stroke();
    ctx.restore();

    // UX設計で付いたもの: 引継ぎ書の札と、foundation.css の実際の色トークン（文書の下端に付いて一緒に運ばれる）
    const attach = easeOut(prog(t, model.T.attach[0], model.T.attach[1]));
    if (attach > 0) {
      const swatches = [C.accent, C.action, C.alert, C.focus, C.text];
      const size = st.swatch;
      const gap = 3;
      const pad = 8;
      const label = '引継ぎ書';
      const labelW = measure(label, st.pillFont);
      const swatchW = swatches.length * size + (swatches.length - 1) * gap;
      const pillW = pad + labelW + 8 + swatchW + pad;
      const pillH = Math.max(st.pillFont * 1.3, size) + 10;
      const px = doc.x + (doc.w - pillW) / 2;
      const py = doc.y + doc.h - 8 + (1 - attach) * -36;
      ctx.save();
      ctx.globalAlpha = attach;
      roundRect(px, py, pillW, pillH, pillH / 2);
      ctx.fillStyle = C.accentSoft;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.accent;
      ctx.stroke();
      text(label, px + pad, py + pillH / 2, st.pillFont, C.text);
      const sx = px + pad + labelW + 8;
      const sy = py + (pillH - size) / 2;
      swatches.forEach((color, k) => {
        ctx.fillStyle = color;
        ctx.fillRect(sx + k * (size + gap), sy, size, size);
      });
      ctx.restore();
    }

    // 6つの企画（同じ形のまま。出ていったあとは空いた枠）
    model.sessions.forEach((session, i) => {
      const slot = L.chipIn(doc, i);
      if (t < departAt(i)) {
        drawChip(slot, session.id, 1);
      } else {
        ctx.save();
        roundRect(slot.x, slot.y, slot.w, slot.h, 6);
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = C.strong;
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  function drawChip(r, id, alpha, fill) {
    ctx.save();
    ctx.globalAlpha = alpha;
    roundRect(r.x, r.y, r.w, r.h, 6);
    ctx.fillStyle = fill || C.surface;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = fill ? fill : C.text;
    ctx.stroke();
    const size = fitSize(id, L.chip.font, r.w - 8, 14);
    text(id, r.x + r.w / 2, r.y + r.h / 2, Math.min(size, Math.max(14, r.h * 0.84)), fill ? C.onAction : C.text, { align: 'center' });
    ctx.restore();
  }

  function drawMovers(t) {
    const T = model.T;
    // 実装の文書から、それぞれの時刻の帯へ開く
    model.sessions.forEach((session, i) => {
      const a = departAt(i);
      const b = landAt(i);
      if (t < a || t >= b) return;
      const p = easeIO(prog(t, a, b));
      const from = L.chipIn(L.docAt(2), i);
      const to = L.bar(session.id);
      const r = lerpRect(from, to, p);
      r.y -= Math.sin(Math.PI * p) * (L.portrait ? 40 : 30);
      r.x += Math.sin(Math.PI * p) * (L.portrait ? 0 : 24);
      ctx.save();
      roundRect(r.x, r.y, r.w, r.h, 7);
      ctx.fillStyle = C.surface;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.text;
      ctx.stroke();
      ctx.restore();
      const size = Math.min(L.map.barFont, Math.max(L.chip.font, r.h * 0.42));
      text(session.id, r.x + r.w / 2, r.y + r.h / 2, size, C.text, { align: 'center' });
    });

    // 予定に入れる: 帯の写しが同じ幅のまま予定の列へ下りる
    model.sessions.forEach((session) => {
      const a = selAt(session.id);
      if (!(t >= a && t < a + T.dropDur)) return;
      const p = easeIO(prog(t, a, a + T.dropDur));
      const r = lerpRect(L.bar(session.id), L.seg(session.id), p);
      ctx.save();
      ctx.globalAlpha = 0.92;
      roundRect(r.x + 1, r.y, r.w - 2, r.h, 6);
      ctx.fillStyle = C.action;
      ctx.fill();
      ctx.restore();
      text(session.id, r.x + r.w / 2, r.y + r.h / 2, L.map.segFont, C.onAction, { align: 'center' });
    });

    // 重なる企画を入れようとする: 下りかけて重なりに当たり、元へ戻る（今の予定は変えない）
    const down = [T.attempt, T.attempt + 0.8];
    const back = [T.attempt + 1.6, T.attempt + 2.4];
    if (t >= down[0] && t < back[1]) {
      const id = model.rejected;
      const bar = L.bar(id);
      const seg = L.seg(id);
      const stop = { x: bar.x, y: seg.y - bar.h * 0.55, w: bar.w, h: bar.h * 0.7 };
      let r;
      if (t < down[1]) r = lerpRect(bar, stop, easeIO(prog(t, down[0], down[1])));
      else if (t < back[0]) r = stop;
      else r = lerpRect(stop, bar, easeIO(prog(t, back[0], back[1])));
      ctx.save();
      ctx.globalAlpha = 0.95;
      roundRect(r.x, r.y, r.w, r.h, 7);
      ctx.fillStyle = C.surface;
      ctx.fill();
      hatch(r.x, r.y, r.w, r.h, C.alertSoft, L.portrait ? 14 : 12);
      roundRect(r.x, r.y, r.w, r.h, 7);
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = C.alert;
      ctx.stroke();
      ctx.restore();
      text(id, r.x + r.w / 2, r.y + r.h / 2, L.map.barFont, C.alert, { align: 'center' });
    }

    // 保存: 選んだ4企画が、保存済みの予定メモへ移る
    model.record.selected_ids.forEach((id, k) => {
      const a = T.exportStart + k * T.exportStep;
      const b = a + T.exportDur;
      if (t < a || t >= b) return;
      const p = easeIO(prog(t, a, b));
      const r = lerpRect(L.seg(id), L.slotAt(k), p);
      r.y -= Math.sin(Math.PI * p) * (L.portrait ? 30 : 0);
      r.x -= Math.sin(Math.PI * p) * (L.portrait ? 0 : 20);
      drawChip(r, id, 1, C.action);
    });
  }

  function drawPlan(t) {
    const P = L.plan;
    const T = model.T;
    ctx.save();
    docPath(P.x, P.y, P.w, P.h, 22);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = C.action;
    ctx.stroke();
    ctx.restore();
    const title = model.stages[3].label;
    text(title, P.x + 16, P.y + (L.portrait ? 26 : 26), P.titleFont, C.text);
    const titleW = measure(title, P.titleFont);
    if (L.portrait) text(model.event.date, P.x + 28 + titleW, P.y + 28, P.dateFont, C.muted, { weight: 400 });
    else text(model.event.date, P.x + 16, P.y + 56, P.dateFont, C.muted, { weight: 400 });

    const slots = prog(t, T.slots[0], T.slots[1]);
    if (slots <= 0) {
      const empty = 'まだ空';
      const y = L.portrait ? L.slot.y + L.slot.h / 2 : L.slot.y + 40;
      text(empty, P.x + 16, y, L.slot.font, C.muted, { weight: 400 });
    }
    model.record.selected_ids.forEach((id, k) => {
      const r = L.slotAt(k);
      if (slots > 0) {
        ctx.save();
        ctx.globalAlpha = slots;
        roundRect(r.x, r.y, r.w, r.h, 6);
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.strong;
        ctx.stroke();
        ctx.restore();
      }
      const landed = T.exportStart + k * T.exportStep + T.exportDur;
      if (t >= landed) {
        if (L.slot.dir === 'row') {
          drawChip(r, id, 1, C.action);
        } else {
          ctx.save();
          roundRect(r.x, r.y, r.w, r.h, 6);
          ctx.fillStyle = C.action;
          ctx.fill();
          ctx.restore();
          const session = sessionOf(id);
          text(`${id} ${session.short}`, r.x + 12, r.y + r.h / 2, fitSize(`${id} ${session.short}`, L.slot.font, r.w - 20, 14), C.onAction);
        }
      }
    });

    const sums = prog(t, T.sums[0], T.sums[1]);
    if (sums > 0) {
      ctx.save();
      ctx.globalAlpha = sums;
      if (L.portrait) {
        text(model.countText, P.x + P.w - 18, P.y + 30, P.countFont, C.text, { align: 'right' });
        text(model.totalText, P.x + P.w - 18, L.slot.y + L.slot.h / 2 + 2, P.totalFont, C.text, { align: 'right' });
      } else {
        const y = L.slotAt(model.record.selected_ids.length - 1).y + L.slot.h + 32;
        text(model.countText, P.x + 16, y, P.countFont, C.text);
        text(model.totalText, P.x + 16, y + 44, P.totalFont, C.text);
      }
      ctx.restore();
    }
    const flags = prog(t, T.flags[0], T.flags[1]);
    if (flags > 0) {
      ctx.save();
      ctx.globalAlpha = flags;
      if (L.portrait) {
        const line = `${model.flagText}｜${model.originalText}`;
        text(line, P.x + 16, P.y + P.h - 20, fitSize(line, P.flagFont, P.w - 32, 14, 400), C.muted, { weight: 400 });
      } else {
        text(model.flagText, P.x + 16, P.y + P.h - 52, P.flagFont, C.muted, { weight: 400 });
        text(model.originalText, P.x + 16, P.y + P.h - 26, fitSize(model.originalText, P.flagFont, P.w - 32, 12, 400), C.muted, { weight: 400 });
      }
      ctx.restore();
    }
  }

  function callout(x, y, h, lines, color, alpha) {
    if (alpha <= 0) return;
    const c = L.callout;
    const widths = lines.map((line, i) => measure(line, i === 0 ? c.font : c.subFont, i === 0 ? 700 : 400));
    const w = Math.max(...widths) + c.pad * 2;
    const right = L.map.trackX + L.map.trackW;
    const bx = Math.min(x, right - w);
    ctx.save();
    ctx.globalAlpha = alpha;
    roundRect(bx, y, w, h, 8);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();
    const lineH = h / (lines.length + 0.2);
    lines.forEach((line, i) => {
      text(line, bx + c.pad, y + lineH * (i + 0.6), i === 0 ? c.font : c.subFont, i === 0 ? color : C.text, { weight: i === 0 ? 700 : 400 });
    });
    ctx.restore();
  }

  function drawCallouts(t) {
    const T = model.T;
    const m = L.map;
    // 重なり: 残した企画の右の空いた段に出す
    const keepBar = L.bar(model.keep);
    const rejected = sessionOf(model.rejected);
    const kept = sessionOf(model.keep);
    const overlap = model.overlapsList.find((o) => o.ids.includes(kept.id) && o.ids.includes(rejected.id));
    const cx = keepBar.x + keepBar.w + L.callout.gap;
    callout(cx, keepBar.y, m.laneH, [`${overlap.start}–${overlap.end} 重なり`, `${rejected.id}は入らない`], C.alert, window01(t, T.attempt + 0.7, T.keepTag[0], 0.2));
    callout(cx, keepBar.y, m.laneH, [`${kept.id}を保持・入れ替えなし`, model.a09Text], C.action, window01(t, T.keepTag[0], T.keepTag[1], 0.2));
    // 14:00 で接する: 線の右の空いた段に出す
    const [a, b] = model.touch.ids;
    const row = L.rows[model.placement.get(b).row];
    const x = L.xAt(row, model.touch.at) + L.callout.gap;
    callout(x, row.lanesY, m.laneH, [`${model.touch.label} 接する`, `${a}と${b}は両方入る`], C.action, window01(t, T.touchHi[0], T.touchHi[1], 0.25));
  }

  function drawPulse(t) {
    const [a, b] = model.T.pulse;
    if (t < a || t > b) return;
    const p = easeIO(prog(t, a, b));
    const alpha = window01(t, a, b, 0.3);
    ctx.save();
    for (let k = 4; k >= 0; k -= 1) {
      const point = pointAlong(L.pulse, p - k * 0.012);
      ctx.globalAlpha = alpha * (k === 0 ? 1 : 0.18 * (5 - k) / 5);
      ctx.beginPath();
      ctx.arc(point.x, point.y, L.pulseR * (k === 0 ? 1 : 0.8), 0, Math.PI * 2);
      ctx.fillStyle = C.action;
      ctx.fill();
    }
    ctx.restore();
  }

  function wrapHeadline(str, size, maxW) {
    if (measure(str, size, 700, 'serif') <= maxW) return [str];
    const chars = Array.from(str);
    const mid = chars.length / 2;
    let split = -1;
    chars.forEach((ch, i) => {
      if ((ch === '、' || ch === '，') && i < chars.length - 1 && (split === -1 || Math.abs(i + 1 - mid) < Math.abs(split - mid))) split = i + 1;
    });
    if (split === -1) split = Math.ceil(mid);
    return [chars.slice(0, split).join(''), chars.slice(split).join('')];
  }

  function drawChrome(t) {
    // 札: 2つは常に出す
    const B = L.badge;
    const badges = [
      { label: '保存済みの制作を図解', fill: C.surface, stroke: C.text },
      { label: '架空企画・予約ではない', fill: C.notice, stroke: C.accent },
    ];
    let x = B.x;
    let y = B.y;
    badges.forEach((badge) => {
      const w = measure(badge.label, B.font) + 32;
      if (x > B.x && x + w > B.x + B.maxW) {
        x = B.x;
        y += B.h + B.rowGap;
      }
      ctx.save();
      roundRect(x, y, w, B.h, B.h / 2);
      ctx.fillStyle = badge.fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = badge.stroke;
      ctx.stroke();
      ctx.restore();
      text(badge.label, x + w / 2, y + B.h / 2, B.font, C.text, { align: 'center' });
      x += w + B.gap;
    });

    // 見出し: 場面ごとに1つだけ。前の見出しが消えてから次を出す
    const H = L.headline;
    const top = y + B.h + H.gapTop;
    model.scenes.forEach((scene, i) => {
      const last = i === model.scenes.length - 1;
      if (t < scene.in || (t >= scene.out && !last)) return;
      const fadeIn = scene.in === 0 ? 1 : prog(t, scene.in, scene.in + 0.3);
      const fadeOut = last ? 1 : 1 - prog(t, scene.out - 0.3, scene.out);
      const alpha = Math.min(fadeIn, fadeOut);
      if (alpha <= 0) return;
      let size = H.font;
      let lines = wrapHeadline(scene.headline, size, H.maxW);
      while (size > 24 && lines.some((line) => measure(line, size, 700, 'serif') > H.maxW)) {
        size -= 2;
        lines = wrapHeadline(scene.headline, size, H.maxW);
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      lines.forEach((line, k) => text(line, H.x, top + H.lineH * (k + 0.5), size, C.text, { family: 'serif' }));
      ctx.restore();
    });

    // 出典
    const K = L.credit;
    if (K.lines === 2) {
      model.credit.forEach((line, k) => {
        text(line, K.x, K.y + k * K.lineH, fitSize(line, K.font, L.BW - K.x * 2, 12, 400), C.muted, { weight: 400 });
      });
    } else {
      const line = model.credit.join(' · ');
      text(line, K.x, K.y, fitSize(line, K.font, L.BW - K.x * 2, 11, 400), C.muted, { weight: 400 });
    }
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
    drawWires(t);
    drawStations(t);
    drawMap(t);
    drawPlan(t);
    drawEventDoc(t);
    drawMovers(t);
    drawCallouts(t);
    drawPulse(t);
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
    reload: document.getElementById('film-reload'),
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

  function show(time) {
    current = clamp(time, 0, DURATION);
    drawFrame(current);
    ui.scrub.value = String(Math.round(current * 10) / 10);
    ui.scrub.setAttribute('aria-valuetext', `${current.toFixed(1)}秒`);
    ui.clock.textContent = `${current.toFixed(1)}秒 / ${DURATION.toFixed(1)}秒`;
    sceneButtons.forEach(({ button, scene }, i) => {
      const last = i === sceneButtons.length - 1;
      const inside = current >= scene.in && (current < scene.out || (last && current <= scene.out));
      if (inside) button.setAttribute('aria-current', 'true');
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
    if (!playing) return;
    const time = Math.min(DURATION, startTime + (now - startWall) / 1000);
    show(time);
    if (time >= DURATION) setPlaying(false); // 最後で止まる。くり返さない
    else frame = window.requestAnimationFrame(tick);
  }

  function initControls() {
    sceneButtons = model.scenes.map((scene) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'c-button v-scene';
      const name = document.createElement('span');
      name.textContent = SCENE_NAMES[scene.id];
      const time = document.createElement('span');
      time.className = 'v-scene__time';
      time.textContent = `${scene.in}秒`;
      button.append(name, time);
      button.setAttribute('aria-label', `${scene.in}秒「${scene.headline}」へ移動`);
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
    controls.forEach((control) => {
      control.disabled = false;
    });
    ui.status.textContent = `8つの素材を確かめました。${WIDTH}×${HEIGHT}・${FPS}fps・${DURATION}秒・音なし。止まった状態です。`;
  }

  function showError(error) {
    clearCanvas();
    if (playing) setPlaying(false);
    controls.forEach((control) => {
      control.disabled = true;
    });
    sceneButtons.forEach(({ button }) => {
      button.disabled = true;
    });
    ui.status.textContent = '';
    ui.errorReason.textContent = error instanceof AssetError ? error.message : '想定していない形式の素材でした。';
    ui.error.hidden = false;
  }

  ui.reload.addEventListener('click', () => window.location.reload());

  /* ---------- 準備と時間の入口 ---------- */

  let ready = false;

  const motionReady = loadAssets()
    .then((built) => {
      model = built;
      C = model.theme.colors;
      L = makeLayout(model, WIDTH, HEIGHT);
      drawFrame(0);
      ready = true;
      if (!RENDER) {
        initControls();
        show(0);
      }
    })
    .catch((error) => {
      ready = false;
      model = null;
      showError(error);
      throw error;
    });
  motionReady.catch(() => {
    // 失敗は画面に出している。書き出し側は motionReady の reject で止まる
  });
  window.motionReady = motionReady;

  window.seek = (seconds) => {
    if (!ready) return motionReady.then(() => drawFrame(seconds));
    drawFrame(seconds);
    return undefined;
  };
})();
