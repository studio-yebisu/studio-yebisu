// 発言を束ねても、違いは残す — 32-second silent film drawn from the saved synthesis.
// Copyright (c) 2026 Studio Yebisu. MIT License.
// One persistent drawing: 3 notebooks, the same 15 slips, 5 clusters, one proposal sheet, one export.
// window.seek(t) paints the finished frame for absolute time t. No audio, no model, no network beyond ./assets.

const MANIFEST_URL = 'assets/manifest.json';
const MANIFEST_SHA256 = 'addd74065288b887752f680f576f60f885111f03bfc96de2d35f9f3e7996d23f';
const ASSET_FILES = ['diagram-data.json', 'interviews.json', 'original-verification.json', 'samples.json', 'synthesis.json', 'timeline.json', 'upstream.json'];
const COMMIT = 'f652327d4e953d7957d99e735c3c7f9964e9d2e5';
const DURATION = 32;
const SCENE_IDS = ['overview', 'inputs', 'cluster', 'contrary', 'notification', 'proposal', 'finish'];
const SCENE_LABEL = { overview: '全体', inputs: 'メモ', cluster: '束ねる', contrary: '違う声', notification: '通知', proposal: '次の一歩', finish: '持ち帰る' };
const FINDING_IDS = ['F01', 'F02', 'F03', 'F04', 'F05'];
const CONFIDENCE_LABEL = { high: '高', medium: '中', low: '低' };
const PARTICIPANT_SHORT = { P01: '月に数回・個人', P02: '週に数回・チーム', P03: '初めて・個人' };
const REC_LINES = {
  R01: ['確定の見出しと番号', 'を出す試作'],
  R02: ['送信前に条件を', '2行で示す試作'],
  R03: ['控えと当日の変更を', '別々に選ぶ紙試作'],
  R04: ['写真と前回の名前', 'を今のまま残す'],
  R05: ['月表示を作る前に', '今の探し方を観察'],
};
// Arrangement inside each saved cluster; checked against synthesis.json and diagram-data.json.
const SPLITS = {
  F01: { groups: [['O01', 'O11'], ['O06']], notes: () => ['完了が見えない', '完了後に番号'] },
  F04: { groups: [['O04', 'O14'], ['O10']], notes: (g) => [`写真 ${g[0].length}人`, `前回名 ${g[1].length}人`], positive: true },
};
const TAGS = { F02: { order: ['O05', 'O07', 'O13'], notes: ['変更可否', '取消料', '取消期限'] } };

const INK = '#1c1a17';
const PAPER = '#f5f0e6';
const CARD = '#fffdf8';
const MUTED = '#5c564c';
const RULE = '#d6cdb9';
const MARKER = '#f3cf4b';
const MARKER_SOFT = '#fbefbd';
const CONTRA = '#7b7468';
const KEEP = '#eef0d8';
const RED = '#a3301c';
const PCOLOR = { P01: '#2f6b4f', P02: '#3d4f91', P03: '#a94f28' };
const PTINT = { P01: '#dcebe1', P02: '#e0e4f4', P03: '#f6e1d5' };
const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic UI","Yu Gothic",Meiryo,sans-serif';
const SERIF = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","BIZ UDMincho",serif';
const MONO = 'ui-monospace,"SFMono-Regular",Consolas,"Liberation Mono",monospace';

/* ---------- size contract ---------- */

const RENDER = window.__MOTION_RENDER__ === true;
const rc = window.renderConfig || {};
const evenSize = (v) => (Number.isInteger(v) && v >= 16 && v <= 4096 && v % 2 === 0 ? v : null);
let W = evenSize(rc.width) || 720;
let H = evenSize(rc.height) || 1280;
if (!RENDER && !rc.width && !rc.height && new URLSearchParams(location.search).get('size') === 'wide') { W = 1280; H = 720; }
const FPS = Number.isInteger(rc.fps) && rc.fps > 0 && rc.fps <= 120 ? rc.fps : 30;
window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: 31, audioEvents: [] };

const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d');
let model = null;
let L = null; // layout for the current size
let G = null; // geometry derived from model + layout

/* ---------- pure time helpers ---------- */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const smooth = (x) => x * x * (3 - 2 * x);
const ease = (t, a, b) => smooth(prog(t, a, b));
const lerp = (a, b, p) => a + (b - a) * p;
function keyed(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return t1 === t0 ? v1 : lerp(v0, v1, smooth((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}
function hash01(str, salt) {
  let h = (2166136261 ^ salt) >>> 0;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 10007) / 10007;
}

/* ---------- loading: pinned bytes, then meaning ---------- */

class AssetError extends Error {}
const fail = (message) => { throw new AssetError(message); };

async function getBytes(url) {
  let res;
  try {
    res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  } catch {
    fail(`${url} を読み込めませんでした。${location.protocol === 'file:' ? 'HTTPサーバーから開いてください。' : ''}`);
  }
  if (!res.ok) fail(`${url} を読み込めませんでした（HTTP ${res.status}）。`);
  return new Uint8Array(await res.arrayBuffer());
}
async function sha256(bytes) {
  if (!globalThis.crypto || !crypto.subtle) fail('このブラウザーでは素材のSHA-256を照合できません。HTTPS か localhost で開いてください。');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
const utf8 = new TextDecoder('utf-8', { fatal: true });
function parse(url, bytes) {
  let text;
  try { text = utf8.decode(bytes); } catch { fail(`${url} をUTF-8として読めませんでした。`); }
  try { return JSON.parse(text); } catch { fail(`${url} をJSONとして読めませんでした。`); }
}

async function loadAssets() {
  const mBytes = await getBytes(MANIFEST_URL);
  if (await sha256(mBytes) !== MANIFEST_SHA256) fail(`${MANIFEST_URL} が固定した版と違います（SHA-256 不一致）。`);
  const manifest = parse(MANIFEST_URL, mBytes);
  if (!manifest || manifest.format !== 'studio-yebisu-motion-assets-v1' || manifest.case !== 'knowledge-work-plugins-example'
    || !Array.isArray(manifest.assets) || manifest.assets.length !== ASSET_FILES.length) fail(`${MANIFEST_URL} の形が想定と違います。`);
  manifest.assets.forEach((a, i) => {
    if (!a || a.file !== ASSET_FILES[i] || !Number.isInteger(a.bytes) || !/^[0-9a-f]{64}$/.test(a.sha256)) fail(`${MANIFEST_URL} の${i + 1}件目が ${ASSET_FILES[i]} ではありません。`);
  });
  const shas = {};
  const loaded = await Promise.all(manifest.assets.map(async (a) => {
    const url = `assets/${a.file}`;
    const bytes = await getBytes(url);
    if (bytes.length !== a.bytes) fail(`${url} が固定した版と違います（${bytes.length}バイト／固定 ${a.bytes}バイト）。`);
    if (await sha256(bytes) !== a.sha256) fail(`${url} が固定した版と違います（SHA-256 不一致）。`);
    shas[a.file] = a.sha256;
    return [a.file.replace(/\.json$/, ''), parse(url, bytes)];
  }));
  return buildModel(Object.fromEntries(loaded), shas);
}

function must(cond, message) {
  if (!cond) fail(`素材の内容が想定と違います：${message}`);
}
const isStr = (v) => typeof v === 'string' && v.length > 0;
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

function buildModel(a, shas) {
  const { interviews, synthesis, samples, timeline, upstream } = a;
  const diagram = a['diagram-data'];
  const history = a['original-verification'];

  // interviews.json: three fictional notebooks, five lines each.
  must(interviews && interviews.fictional === true && Array.isArray(interviews.participants), 'interviews.json が架空の資料ではありません');
  must(same(interviews.participants.map((p) => p.id), ['P01', 'P02', 'P03']), '参加者が P01・P02・P03 ではありません');
  const lines = new Map();
  for (const p of interviews.participants) {
    must(p.method === 'fictional_interview_self_report' && isStr(p.segment), `${p.id} が架空の自己申告ではありません`);
    must(same(p.lines.map((l) => l.id), [1, 2, 3, 4, 5].map((n) => `${p.id}-L0${n}`)), `${p.id} の行が5行ではありません`);
    p.lines.forEach((l, k) => { must(isStr(l.text), `${l.id} が空です`); lines.set(l.id, { p: p.id, k, text: l.text }); });
  }

  // synthesis.json: the saved result, unchanged.
  must(synthesis && synthesis.meta && synthesis.meta.fictional === true && synthesis.meta.participant_count === 3, 'synthesis.json の範囲が違います');
  must(Array.isArray(synthesis.observations) && synthesis.observations.length === 15, '観察が15件ではありません');
  const obs = new Map();
  synthesis.observations.forEach((o, i) => {
    const line = lines.get(o.line_id);
    must(o.id === `O${String(i + 1).padStart(2, '0')}` && line && line.p === o.source_id && o.quote === line.text, `観察 ${o.id} が原文と合いません`);
    must(!obs.has(o.id), `観察 ${o.id} が重複しています`);
    obs.set(o.id, { id: o.id, p: o.source_id, line: o.line_id, k: line.k, kind: o.kind, index: i });
  });
  must(same(synthesis.findings.map((f) => f.id), FINDING_IDS), '発見が F01〜F05 ではありません');
  must(same(synthesis.recommendations.map((r) => r.id), ['R01', 'R02', 'R03', 'R04', 'R05']), '提案が R01〜R05 ではありません');

  // diagram-data.json: the producer's factual index; every entry must agree with the saved synthesis.
  must(diagram && diagram.format === 'studio-yebisu-knowledge-affinity-map-v1' && diagram.fictional === true, 'diagram-data.json の形式が違います');
  must(same(diagram.participants.map((p) => p.id), ['P01', 'P02', 'P03'])
    && diagram.participants.every((p) => same(p.line_ids, interviews.participants.find((q) => q.id === p.id).lines.map((l) => l.id))), '図の参加者と行が原文と合いません');
  must(same(diagram.observations.map((o) => o.id), [...obs.keys()]), '図の観察が保存結果と合いません');
  for (const d of diagram.observations) {
    const o = obs.get(d.id);
    must(d.participant === o.p && d.line_id === o.line && d.kind === o.kind && isStr(d.short_label), `図の観察 ${d.id} が保存結果と合いません`);
    o.label = d.short_label;
  }
  const findings = new Map();
  synthesis.findings.forEach((f, i) => {
    const d = diagram.findings[i];
    const recs = synthesis.recommendations.filter((r) => r.finding_ids.includes(f.id));
    const support = new Set(f.observation_ids.map((oid) => obs.get(oid) && obs.get(oid).p));
    must(d && d.id === f.id && isStr(d.short_label), `図の発見 ${f.id} がありません`);
    must(same(d.support, f.observation_ids) && same(d.participants, f.participant_ids) && same([...support].sort(), [...f.participant_ids].sort()), `${f.id} の支持が保存結果と合いません`);
    must(d.frequency === f.frequency && f.frequency === support.size && d.confidence === f.confidence && CONFIDENCE_LABEL[f.confidence], `${f.id} の人数か確からしさが合いません`);
    must(same(d.contrary_lines, f.contradictions.map((c) => c.line_id)), `${f.id} の反する発言が合いません`);
    must(recs.length === 1 && same(d.recommendation_ids, [recs[0].id]) && isStr(recs[0].priority) && REC_LINES[recs[0].id], `${f.id} の提案が合いません`);
    findings.set(f.id, {
      id: f.id, label: d.short_label, support: f.observation_ids, participants: f.participant_ids,
      freq: f.frequency, conf: CONFIDENCE_LABEL[f.confidence], contraryLines: d.contrary_lines,
      rec: { id: recs[0].id, priority: recs[0].priority },
    });
  });
  must(same([...findings.values()].map((f) => f.freq), [3, 3, 3, 3, 1]), '支持の人数が 3・3・3・3・1 ではありません');
  for (const [fid, s] of Object.entries(SPLITS)) must(same(s.groups.flat().sort(), [...findings.get(fid).support].sort()), `${fid} の分け方が支持と合いません`);
  for (const [fid, s] of Object.entries(TAGS)) must(same([...s.order].sort(), [...findings.get(fid).support].sort()), `${fid} の並びが支持と合いません`);
  must(diagram.default_finding === 'F05', '既定の発見が F05 ではありません');
  const routes = diagram.notification_routes;
  must(Array.isArray(routes) && same(routes.map((r) => r.observation), findings.get('F03').support)
    && routes.every((r) => isStr(r.purpose) && isStr(r.channel)) && new Set(routes.map((r) => r.channel)).size === 3, 'F03 の3本の道が保存結果と合いません');
  const allSupport = new Set([...findings.values()].flatMap((f) => f.support));
  const allContrary = new Set([...findings.values()].flatMap((f) => f.contraryLines));
  must(same(diagram.unassigned_observations, ['O02']) && !allSupport.has('O02') && !allContrary.has(obs.get('O02').line), 'O02 が数えない発言として残っていません');
  const contraryObs = diagram.monthly_contrary_observation;
  must(contraryObs === 'O09' && same(findings.get('F05').contraryLines, [obs.get('O09').line]) && same(findings.get('F05').support, ['O12']), 'F05 の支持と反する発言が合いません');

  // timeline.json: fixed story beats.
  must(timeline && timeline.format === 'studio-yebisu-knowledge-visual-timeline-v1' && timeline.duration === DURATION && timeline.fps === 30 && timeline.silent === true, 'timeline.json が32秒・30fps・無音ではありません');
  must(same(timeline.scenes.map((s) => s.id), SCENE_IDS), '場面の並びが違います');
  timeline.scenes.forEach((s, i) => {
    must(s.in === (i ? timeline.scenes[i - 1].out : 0) && s.out > s.in && isStr(s.headline) && findings.has(s.finding), `場面 ${s.id} の時刻か内容が違います`);
  });
  must(timeline.scenes[timeline.scenes.length - 1].out === DURATION, '最後の場面が32秒で終わりません');

  // upstream.json: pinned source shown in the footer.
  must(upstream && upstream.repository === 'anthropics/knowledge-work-plugins' && upstream.commit === COMMIT
    && upstream.plugin_version === '1.2.0' && upstream.license === 'Apache-2.0'
    && Object.keys(upstream.files_sha256 || {}).length === 7
    && /^[0-9a-f]{64}$/.test(upstream.files_sha256['product-management/skills/synthesize-research/SKILL.md'] || ''), 'upstream.json の固定版が違います');

  // original-verification.json: historical record of the earlier 28-second film; only checked for provenance.
  must(history && history.id === 'knowledge-work-plugins-example' && history.source_commit === COMMIT
    && history.data_checks && history.data_checks.input_sha256 === shas['interviews.json'] && history.data_checks.output_sha256 === shas['synthesis.json'], '旧確認記録の入力・出力ハッシュが素材と合いません');
  const historySeconds = history.video && history.video.native_playback && history.video.native_playback.duration;
  must(Number.isFinite(historySeconds), '旧確認記録に旧動画の長さがありません');

  // samples.json: the saved export case drawn at the end.
  must(samples && samples.format === 'input-output' && Array.isArray(samples.samples), 'samples.json の形式が違います');
  const applied = samples.samples.find((s) => s.id === 'apply-skill');
  must(applied && applied.output.observations === 15 && JSON.stringify(applied.output.findings) === JSON.stringify(synthesis.findings), '操作例 apply-skill が保存結果と合いません');
  const exported = samples.samples.find((s) => s.id === 'exports');
  must(exported && exported.output.selected_finding === 'F05' && exported.output.support_line === obs.get('O12').line
    && exported.output.contradictory_line === obs.get('O09').line && exported.output.support_frequency === findings.get('F05').freq, '操作例 exports が F05 と合いません');

  const S = Object.fromEntries(timeline.scenes.map((s) => [s.id, s]));
  return {
    participants: interviews.participants.map((p) => ({ id: p.id, short: PARTICIPANT_SHORT[p.id], lines: p.lines.map((l) => l.id) })),
    lines,
    obs,
    obsList: [...obs.values()],
    findings,
    routes,
    neutral: 'O02',
    contraryObs,
    scenes: timeline.scenes,
    T: { inputs: S.inputs.in, cluster: S.cluster.in, contrary: S.contrary.in, notification: S.notification.in, proposal: S.proposal.in, finish: S.finish.in },
    exportName: `synthesis-${exported.output.selected_finding}.md`,
    total: interviews.participants.length,
    pin: `${upstream.repository} ${upstream.commit.slice(0, 7)} ・ product-management ${upstream.plugin_version} ・ ${upstream.license}`,
    historySeconds,
  };
}

/* ---------- layout (design units; scaled to the render size) ---------- */

const R = (x, y, w, h) => ({ x, y, w, h });
const PORTRAIT = {
  portrait: true, bw: 720, bh: 1280,
  badgeY: 52, headX: 44, headY: 150, headW: 632, headSize: 42, headLH: 56, headLines: 2,
  slip: { w: 84, h: 60 }, titleH: 52, noteGap: 30,
  notebooks: { P01: R(36, 270, 196, 156), P02: R(262, 270, 196, 156), P03: R(488, 270, 196, 156) },
  clusters: { F01: R(28, 470, 322, 160), F02: R(370, 470, 322, 160), F03: R(28, 648, 322, 212), F04: R(370, 648, 322, 212), F05: R(28, 878, 456, 178) },
  neutral: R(500, 878, 192, 178),
  proposal: R(28, 1086, 420, 128), exportBox: R(480, 1086, 212, 128),
  toProposal: [[140, 1056], [140, 1086]],
  toExport: [[448, 1150], [480, 1150]],
  loose: (pi, k) => ({ x: 46 + k * 128, y: 506 + pi * 172 }),
  footerY: 1252,
};
const WIDE = {
  portrait: false, bw: 1280, bh: 720,
  badgeY: 40, headX: 40, headY: 106, headW: 940, headSize: 34, headLH: 44, headLines: 1,
  slip: { w: 80, h: 56 }, titleH: 46, noteGap: 26,
  notebooks: { P01: R(36, 150, 200, 150), P02: R(36, 325, 200, 150), P03: R(36, 500, 200, 150) },
  clusters: { F01: R(272, 140, 344, 150), F02: R(632, 140, 344, 150), F03: R(272, 304, 344, 196), F04: R(632, 304, 344, 196), F05: R(272, 514, 470, 156) },
  neutral: R(758, 514, 218, 156),
  proposal: R(1010, 180, 234, 236), exportBox: R(1010, 452, 234, 150),
  toProposal: [[700, 514], [700, 507], [993, 507], [993, 300], [1010, 300]],
  toExport: [[1127, 416], [1127, 452]],
  loose: (pi, k) => ({ x: 300 + k * 134, y: 176 + pi * 168 }),
  footerY: 700,
};

function makeLayout(w, h) {
  const base = h >= w ? PORTRAIT : WIDE;
  const s = Math.min(w / base.bw, h / base.bh);
  return { ...base, s, ox: (w - base.bw * s) / 2, oy: (h - base.bh * s) / 2 };
}

function buildGeometry(m, Lx) {
  const { w: sw, h: sh } = Lx.slip;
  const slot0 = new Map();
  const slot1 = new Map();
  const deco = {};
  const groupOf = new Map();
  const order = [];
  for (const fid of FINDING_IDS) {
    const b = Lx.clusters[fid];
    const top = b.y + Lx.titleH;
    const d = { notes: [], dividers: [], terminals: [], lanes: [] };
    const put = (oid, x, y) => { slot0.set(oid, { x, y }); slot1.set(oid, { x, y }); groupOf.set(oid, fid); order.push(oid); };
    if (SPLITS[fid]) {
      const sp = SPLITS[fid];
      const g = 14;
      const gap = 28;
      const pad = (b.w - (3 * sw + g + gap)) / 2;
      const x1 = b.x + pad;
      const x2 = x1 + sw + g;
      const x3 = x2 + sw + gap;
      put(sp.groups[0][0], x1, top);
      put(sp.groups[0][1], x2, top);
      put(sp.groups[1][0], x3, top);
      d.dividers.push({ x: x2 + sw + gap / 2, y1: top + 4, y2: top + sh + Lx.noteGap - 4 });
      const notes = sp.notes(sp.groups);
      d.notes.push({ text: notes[0], x: (x1 + x2 + sw) / 2, y: top + sh + Lx.noteGap });
      d.notes.push({ text: notes[1], x: x3 + sw / 2, y: top + sh + Lx.noteGap });
      d.positive = !!sp.positive;
    } else {
      const gap = (b.w - 3 * sw) / 4;
      const xs = [0, 1, 2].map((i) => b.x + gap + i * (sw + gap));
      if (TAGS[fid]) {
        TAGS[fid].order.forEach((oid, i) => {
          put(oid, xs[i], top);
          d.notes.push({ text: TAGS[fid].notes[i], x: xs[i] + sw / 2, y: top + sh + Lx.noteGap });
        });
      } else if (fid === 'F03') {
        const spacing = sw + gap;
        const tw = Math.min(sw + 20, spacing - 6);
        m.routes.forEach((r, i) => {
          put(r.observation, xs[i], top);
          const ty = top + sh + 40;
          d.terminals.push({ x: xs[i] + sw / 2 - tw / 2, y: ty, w: tw, h: b.y + b.h - 8 - ty, cx: xs[i] + sw / 2, y0: top + sh, purpose: r.purpose, channel: r.channel });
        });
      } else {
        // F05: support lane and contrary lane; the two slips start together and then separate.
        const laneTop = top;
        const laneH = b.h - Lx.titleH - 12;
        const laneW = (b.w - 42) / 2;
        const f = m.findings.get(fid);
        const lanes = [
          { kind: 'support', x: b.x + 14, oid: f.support[0], main: '支持', sub: `${f.freq}/${m.total}人` },
          { kind: 'contrary', x: b.x + 28 + laneW, oid: m.contraryObs, main: '反する', sub: '数えない' },
        ];
        const midY = laneTop + (laneH - sh) / 2;
        lanes.forEach((lane, i) => {
          put(lane.oid, b.x + b.w / 2 + (i ? 10 : -sw - 10), midY);
          slot1.set(lane.oid, { x: lane.x + 16, y: midY });
          d.lanes.push({ ...lane, y: laneTop, w: laneW, h: laneH });
        });
      }
    }
    deco[fid] = d;
  }
  const n = Lx.neutral;
  const ny = n.y + Lx.titleH;
  slot0.set(m.neutral, { x: n.x + (n.w - sw) / 2, y: ny });
  slot1.set(m.neutral, { x: n.x + (n.w - sw) / 2, y: ny });
  groupOf.set(m.neutral, 'neutral');
  order.push(m.neutral);

  const groupStart = {};
  ['F01', 'F02', 'F03', 'F04', 'F05', 'neutral'].forEach((gid, ci) => { groupStart[gid] = m.T.cluster + 0.2 + ci * 0.55; });
  const gather = new Map();
  for (const gid of Object.keys(groupStart)) {
    order.filter((oid) => groupOf.get(oid) === gid).forEach((oid, j) => gather.set(oid, groupStart[gid] + j * 0.08));
  }

  const lineY = (b, k) => b.y + (Lx.portrait ? 58 : 54) + k * (Lx.portrait ? 21 : 20);
  const home = new Map();
  const loose = new Map();
  const pIndex = { P01: 0, P02: 1, P03: 2 };
  for (const o of m.obsList) {
    const b = Lx.notebooks[o.p];
    home.set(o.id, { x: b.x + b.w + 2 - sw / 2, y: lineY(b, o.k) - 4 - sh / 2 });
    const base = Lx.loose(pIndex[o.p], o.k);
    loose.set(o.id, { x: base.x + (hash01(o.id, 1) - 0.5) * 18, y: base.y + (hash01(o.id, 2) - 0.5) * 16, rot: (hash01(o.id, 3) - 0.5) * 0.14 });
  }
  return { slot0, slot1, deco, groupOf, groupStart, gather, home, loose, lineY };
}

/* ---------- emphasis keys (absolute seconds from timeline.json) ---------- */

const LOW = 0.3;
const MID = 0.6;
function dimKeys(T) {
  const tail = [[T.finish, LOW], [T.finish + 0.5, 1]];
  const rest = [[0, 1], [T.cluster + 4, 1], [T.cluster + 4.4, MID], [T.contrary, MID], [T.contrary + 0.8, LOW], ...tail];
  return {
    F01: [[0, 1], [T.contrary, 1], [T.contrary + 0.8, LOW], ...tail],
    F02: rest,
    F04: rest,
    F03: [[0, 1], [T.cluster + 4, 1], [T.cluster + 4.4, MID], [T.contrary, MID], [T.contrary + 0.8, LOW], [T.notification, LOW], [T.notification + 0.8, 1], [T.proposal, 1], [T.proposal + 0.6, LOW], ...tail],
    F05: [[0, 1], [T.cluster + 4, 1], [T.cluster + 4.4, MID], [T.contrary, MID], [T.contrary + 0.8, 1], [T.notification, 1], [T.notification + 0.8, LOW], [T.proposal, LOW], [T.proposal + 0.6, 1]],
  };
}
function focusKeys(T) {
  return {
    F01: [[T.cluster + 4, 0], [T.cluster + 4.4, 1], [T.contrary, 1], [T.contrary + 0.8, 0]],
    F02: [[0, 0]],
    F04: [[0, 0]],
    F03: [[T.notification, 0], [T.notification + 0.8, 1], [T.proposal, 1], [T.proposal + 0.6, 0]],
    F05: [[0, 0.55], [T.inputs, 0.55], [T.inputs + 0.5, 0], [T.contrary, 0], [T.contrary + 0.8, 1], [T.notification, 1], [T.notification + 0.8, 0], [T.proposal, 0], [T.proposal + 0.6, 1]],
  };
}
let DIM = null;
let FOCUS = null;

/* ---------- canvas helpers ---------- */

function alpha(a, fn) {
  if (a <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, a);
  fn();
  ctx.restore();
}
function rr(x, y, w, h, r) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.lineTo(x + w - q, y);
  ctx.arcTo(x + w, y, x + w, y + q, q);
  ctx.lineTo(x + w, y + h - q);
  ctx.arcTo(x + w, y + h, x + w - q, y + h, q);
  ctx.lineTo(x + q, y + h);
  ctx.arcTo(x, y + h, x, y + h - q, q);
  ctx.lineTo(x, y + q);
  ctx.arcTo(x, y, x + q, y, q);
  ctx.closePath();
}
function setFont(size, weight, family) {
  ctx.font = `${weight} ${size}px ${family}`;
}
function text(str, x, y, { size = 20, weight = 400, color = INK, align = 'left', font = SANS, maxW = 0 } = {}) {
  let s = size;
  setFont(s, weight, font);
  if (maxW > 0) {
    while (s > 9 && ctx.measureText(str).width > maxW) {
      s -= 1;
      setFont(s, weight, font);
    }
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}
function measure(str, size, weight, font = SANS) {
  setFont(size, weight, font);
  return ctx.measureText(str).width;
}
// Japanese headline wrap: break after 。 or 、 first, then by character.
function wrapHeadline(str, maxW, size) {
  const parts = str.match(/[^。、]+[。、]?/g) || [str];
  const out = [];
  let line = '';
  for (const part of parts) {
    if (measure(line + part, size, 700, SERIF) <= maxW) { line += part; continue; }
    if (line) out.push(line);
    line = '';
    for (const ch of part) {
      if (measure(line + ch, size, 700, SERIF) > maxW && line) { out.push(line); line = ''; }
      line += ch;
    }
  }
  if (line) out.push(line);
  return out;
}
function polyline(pts, p) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(len);
    total += len;
  }
  let left = total * clamp(p, 0, 1);
  const out = [pts[0]];
  for (let i = 1; i < pts.length && left > 0; i++) {
    const len = segs[i - 1];
    if (left >= len) { out.push(pts[i]); left -= len; continue; }
    const r = left / len;
    out.push([lerp(pts[i - 1][0], pts[i][0], r), lerp(pts[i - 1][1], pts[i][1], r)]);
    left = 0;
  }
  return out;
}
function strokePts(pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}
function arrowHead(from, to, size) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(to[0] - size * Math.cos(ang - 0.45), to[1] - size * Math.sin(ang - 0.45));
  ctx.lineTo(to[0] - size * Math.cos(ang + 0.45), to[1] - size * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
}
function drawArrow(pts, p, { color = INK, width = 4, dash = null } = {}) {
  if (p <= 0) return;
  const part = polyline(pts, p);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  strokePts(part);
  ctx.setLineDash([]);
  if (p >= 0.999 && part.length > 1) arrowHead(part[part.length - 2], part[part.length - 1], width * 3.4);
  ctx.restore();
}
function bezierPts(a, b, down, n = 36) {
  const c1 = down ? [a[0], a[1] + 120] : [a[0] + 110, a[1]];
  const c2 = down ? [b[0], b[1] - 120] : [b[0] - 110, b[1]];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const v = 1 - u;
    pts.push([
      v * v * v * a[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * b[0],
      v * v * v * a[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * b[1],
    ]);
  }
  return pts;
}

/* ---------- the drawing ---------- */

function sceneAt(t) {
  const list = model.scenes;
  for (let i = 0; i < list.length; i++) if (t < list[i].out) return i;
  return list.length - 1;
}

function drawBackdrop() {
  ctx.fillStyle = 'rgba(28,26,23,0.07)';
  for (let y = 20; y < L.bh; y += 40) for (let x = 20; x < L.bw; x += 40) ctx.fillRect(x, y, 2, 2);
}

function pill(label, x, y, { fill = CARD, color = INK, size = 18 } = {}) {
  const w = measure(label, size, 700) + size * 1.2;
  const h = size * 1.75;
  rr(x, y - h + size * 0.45, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  text(label, x + size * 0.6, y, { size, weight: 700, color });
  return w;
}

function drawHeader(t) {
  const size = L.portrait ? 20 : 17;
  const w1 = pill('保存済みの整理を図解', L.headX, L.badgeY, { fill: INK, color: '#fff', size });
  pill(`架空${model.total}人・自己申告`, L.headX + w1 + 10, L.badgeY, { size });
  const i = sceneAt(t);
  const s = model.scenes[i];
  const fadeIn = i ? ease(t, s.in, s.in + 0.35) : 1;
  const fadeOut = i < model.scenes.length - 1 ? 1 - ease(t, s.out - 0.25, s.out) : 1;
  alpha(fadeIn * fadeOut, () => {
    let size2 = L.headSize;
    let lines = wrapHeadline(s.headline, L.headW, size2);
    while (lines.length > L.headLines && size2 > 20) {
      size2 -= 2;
      lines = wrapHeadline(s.headline, L.headW, size2);
    }
    const lh = L.headLH * (size2 / L.headSize);
    lines.forEach((line, k) => text(line, L.headX, L.headY + k * lh, { size: size2, weight: 700, font: SERIF }));
  });
}

function drawFooter() {
  const size = L.portrait ? 15 : 14;
  text(model.pin, L.headX, L.footerY, { size, color: MUTED, maxW: L.bw - 2 * L.headX - 60 });
  text('無音', L.bw - L.headX, L.footerY, { size, weight: 700, color: MUTED, align: 'right' });
}

function drawNotebook(p, t) {
  const b = L.notebooks[p.id];
  const color = PCOLOR[p.id];
  const open = ease(t, model.T.inputs, model.T.inputs + 0.6);
  const traceLine = ease(t, model.T.proposal + 1.0, model.T.proposal + 1.4);
  const support = model.obs.get(model.findings.get('F05').support[0]);
  // page
  rr(b.x + 5, b.y + 5, b.w, b.h, 12);
  ctx.fillStyle = 'rgba(28,26,23,0.10)';
  ctx.fill();
  rr(b.x, b.y, b.w, b.h, 12);
  ctx.fillStyle = '#fffdf6';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  alpha(open, () => {
    const idW = text(p.id, b.x + 34, b.y + 32, { size: L.portrait ? 24 : 22, weight: 800, font: MONO, color });
    text(p.short, b.x + 34 + idW + 10, b.y + 31, { size: 15, color: MUTED, maxW: b.w - (44 + idW) - 14 });
    p.lines.forEach((lineId, k) => {
      const y = G.lineY(b, k);
      const isTrace = p.id === support.p && lineId === support.line;
      if (isTrace && traceLine > 0) alpha(traceLine, () => { rr(b.x + 28, y - 17, b.w - 40, 22, 5); ctx.fillStyle = MARKER; ctx.fill(); });
      const label = isTrace && traceLine > 0.5 ? lineId : lineId.slice(4);
      text(label, b.x + 34, y, { size: 14, weight: 700, font: MONO, color: isTrace && traceLine > 0.5 ? INK : MUTED });
      ctx.strokeStyle = RULE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x + (isTrace && traceLine > 0.5 ? 110 : 76), y + 1);
      ctx.lineTo(b.x + b.w - 18, y + 1);
      ctx.stroke();
    });
  });
  // cover folds back to a spine as the notebook opens
  const cw = lerp(b.w, 20, open);
  rr(b.x, b.y, cw, b.h, 12);
  ctx.fillStyle = color;
  ctx.fill();
  alpha(1 - open, () => {
    text(p.id, b.x + 24, b.y + 62, { size: L.portrait ? 36 : 34, weight: 800, font: MONO, color: '#fff' });
    text(p.short, b.x + 24, b.y + 96, { size: L.portrait ? 18 : 17, weight: 700, color: '#fff', maxW: b.w - 48 });
    text(`${p.lines.length}行・架空`, b.x + 24, b.y + 126, { size: 15, color: '#fff' });
  });
}

function drawCluster(fid, t) {
  const f = model.findings.get(fid);
  const b = L.clusters[fid];
  const d = G.deco[fid];
  const T = model.T;
  const solid = ease(t, G.groupStart[fid] - 0.1, G.groupStart[fid] + 0.7);
  const dim = keyed(t, DIM[fid]);
  const focus = keyed(t, FOCUS[fid]);
  const P = L.portrait;
  alpha(dim, () => {
    if (focus > 0.002) alpha(focus, () => { rr(b.x - 8, b.y - 8, b.w + 16, b.h + 16, 22); ctx.fillStyle = MARKER; ctx.fill(); });
    rr(b.x, b.y, b.w, b.h, 16);
    alpha(0.25 + 0.75 * solid, () => { ctx.fillStyle = d.positive ? KEEP : CARD; ctx.fill(); });
    ctx.save();
    ctx.globalAlpha *= 0.4 + 0.6 * solid;
    if (solid < 0.5) ctx.setLineDash([9, 8]);
    ctx.lineWidth = focus > 0.5 ? 3.5 : 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();

    const ty = b.y + (P ? 36 : 31);
    const ts = P ? 24 : 21;
    const meta = `${f.freq}/${model.total}人・${f.conf}`;
    alpha(0.55 + 0.45 * solid, () => {
      const metaW = measure(meta, P ? 17 : 15, 700);
      const idW = text(fid, b.x + 16, ty, { size: ts, weight: 800, font: MONO });
      const labelW = text(f.label, b.x + 16 + idW + 10, ty, { size: ts, weight: 700, maxW: b.w - idW - metaW - 58 - (d.positive ? 28 : 0) });
      text(meta, b.x + b.w - 16, ty, { size: P ? 17 : 15, weight: 700, color: MUTED, align: 'right' });
      if (d.positive) drawHeart(b.x + 16 + idW + 10 + labelW + 14, ty - ts * 0.4, P ? 9 : 8);
    });
    alpha(solid, () => {
      for (const n of d.notes) text(n.text, n.x, n.y, { size: P ? 17 : 15, color: MUTED, align: 'center' });
      ctx.strokeStyle = MUTED;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      for (const v of d.dividers) { ctx.beginPath(); ctx.moveTo(v.x, v.y1); ctx.lineTo(v.x, v.y2); ctx.stroke(); }
      ctx.setLineDash([]);
    });

    // F05 lanes: support (solid, marker) and contrary (hatched, dashed) stay visibly different.
    const laneP = ease(t, T.contrary + 0.6, T.contrary + 1.4);
    d.lanes.forEach((lane, i) => {
      alpha(laneP, () => {
        rr(lane.x, lane.y, lane.w, lane.h, 12);
        if (lane.kind === 'support') {
          ctx.fillStyle = MARKER_SOFT;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = INK;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#f0ebe1';
          ctx.fill();
          ctx.save();
          rr(lane.x, lane.y, lane.w, lane.h, 12);
          ctx.clip();
          ctx.strokeStyle = 'rgba(123,116,104,0.35)';
          ctx.lineWidth = 3;
          for (let x = lane.x - lane.h; x < lane.x + lane.w; x += 14) { ctx.beginPath(); ctx.moveTo(x, lane.y + lane.h); ctx.lineTo(x + lane.h, lane.y); ctx.stroke(); }
          ctx.restore();
          ctx.setLineDash([10, 7]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = CONTRA;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
      const labelP = ease(t, T.contrary + 2.2 + i * 0.4, T.contrary + 2.6 + i * 0.4);
      alpha(labelP, () => {
        const lx = lane.x + L.slip.w + 34;
        const cy = lane.y + lane.h / 2;
        text(lane.main, lx, cy - 4, { size: P ? 26 : 22, weight: 800, color: lane.kind === 'support' ? INK : CONTRA });
        text(lane.sub, lx, cy + (P ? 24 : 20), { size: P ? 19 : 16, weight: 700, color: MUTED });
      });
    });

    // F03: three separate routes, never merged into one channel.
    d.terminals.forEach((r, j) => {
      const start = T.notification + 0.9 + j * 0.45;
      const rp = ease(t, start, start + 0.7);
      ctx.save();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      if (r.channel !== 'メール' && r.channel !== 'SMS') ctx.setLineDash([4, 6]);
      strokePts(polyline([[r.cx, r.y0 + 2], [r.cx, r.y - 2]], rp));
      ctx.restore();
      const tp = ease(t, start + 0.45, start + 0.9);
      alpha(tp, () => {
        const sc = lerp(0.88, 1, tp);
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.scale(sc, sc);
        rr(-r.w / 2, -r.h / 2, r.w, r.h, 10);
        ctx.fillStyle = PAPER;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        if (r.channel !== 'メール' && r.channel !== 'SMS') ctx.setLineDash([4, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        text(r.purpose, 0, -2, { size: P ? 18 : 16, weight: 800, align: 'center', maxW: r.w - 10 });
        text(r.channel, 0, P ? 20 : 18, { size: P ? 15 : 14, weight: 700, color: MUTED, align: 'center', maxW: r.w - 8 });
        ctx.restore();
        drawChannelIcon(r.channel, r.cx, (r.y0 + r.y) / 2, P ? 15 : 13);
      });
    });
  });
}

function drawHeart(cx, cy, r) {
  ctx.save();
  ctx.fillStyle = PCOLOR.P01;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 1.1);
  ctx.bezierCurveTo(cx - r * 1.6, cy, cx - r * 0.9, cy - r * 1.2, cx, cy - r * 0.35);
  ctx.bezierCurveTo(cx + r * 0.9, cy - r * 1.2, cx + r * 1.6, cy, cx, cy + r * 1.1);
  ctx.fill();
  ctx.restore();
}

function drawChannelIcon(channel, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 1.8;
  if (channel === 'メール') {
    ctx.strokeRect(cx - r * 0.55, cy - r * 0.38, r * 1.1, r * 0.76);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy - r * 0.38);
    ctx.lineTo(cx, cy + r * 0.08);
    ctx.lineTo(cx + r * 0.55, cy - r * 0.38);
    ctx.stroke();
  } else if (channel === 'SMS') {
    rr(cx - r * 0.55, cy - r * 0.42, r * 1.1, r * 0.7, r * 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.2, cy + r * 0.28);
    ctx.lineTo(cx - r * 0.38, cy + r * 0.55);
    ctx.lineTo(cx + r * 0.05, cy + r * 0.28);
    ctx.stroke();
  } else {
    text('?', cx, cy + r * 0.42, { size: r * 1.25, weight: 800, align: 'center' });
  }
  ctx.restore();
}

function drawNeutral(t) {
  const n = L.neutral;
  const P = L.portrait;
  const solid = ease(t, G.groupStart.neutral - 0.1, G.groupStart.neutral + 0.7);
  const dim = keyed(t, DIM.F05);
  const emph = ease(t, model.T.contrary + 2.8, model.T.contrary + 3.4);
  alpha(dim, () => {
    rr(n.x, n.y, n.w, n.h, 16);
    ctx.save();
    ctx.globalAlpha *= 0.4 + 0.6 * solid;
    ctx.setLineDash([2, 8]);
    ctx.lineCap = 'round';
    ctx.lineWidth = lerp(2.5, 3.5, emph);
    ctx.strokeStyle = emph > 0.5 ? INK : MUTED;
    ctx.stroke();
    ctx.restore();
    alpha(0.55 + 0.45 * solid, () => text('未分類', n.x + n.w / 2, n.y + (P ? 36 : 31), { size: P ? 20 : 17, weight: 700, color: MUTED, align: 'center' }));
    alpha(solid, () => {
      const y0 = n.y + L.titleH + L.slip.h + (P ? 30 : 26);
      text('どちらにも', n.x + n.w / 2, y0, { size: P ? 18 : 16, weight: emph > 0.5 ? 800 : 400, color: emph > 0.5 ? INK : MUTED, align: 'center' });
      text('数えない', n.x + n.w / 2, y0 + (P ? 24 : 21), { size: P ? 18 : 16, weight: emph > 0.5 ? 800 : 400, color: emph > 0.5 ? INK : MUTED, align: 'center' });
    });
  });
}

function slipState(o, t) {
  const T = model.T;
  const sw = L.slip.w;
  const sh = L.slip.h;
  const home = G.home.get(o.id);
  const loose = G.loose.get(o.id);
  const tDepart = T.inputs + 0.5 + o.index * 0.2;
  const tArrive = tDepart + 1.0;
  const tGather = G.gather.get(o.id);
  const tSettle = tGather + 1.1;
  const s0 = G.slot0.get(o.id);
  const s1 = G.slot1.get(o.id);
  let x;
  let y;
  let sc = 1;
  let rot = 0;
  const arc = (a, b, p, lift) => {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 + lift;
    const v = 1 - p;
    return { x: v * v * a.x + 2 * v * p * mx + p * p * b.x, y: v * v * a.y + 2 * v * p * my + p * p * b.y };
  };
  if (t < tDepart) {
    ({ x, y } = home);
    sc = 0.34;
  } else if (t < tArrive) {
    const p = ease(t, tDepart, tArrive);
    ({ x, y } = arc(home, loose, p, -70));
    sc = lerp(0.34, 1, p);
    rot = loose.rot * p;
  } else if (t < tGather) {
    ({ x, y } = loose);
    rot = loose.rot;
  } else if (t < tSettle) {
    const p = ease(t, tGather, tSettle);
    ({ x, y } = arc(loose, s0, p, -50));
    rot = loose.rot * (1 - p);
  } else {
    const p = ease(t, T.contrary + 0.6, T.contrary + 1.8);
    x = lerp(s0.x, s1.x, p);
    y = lerp(s0.y, s1.y, p);
  }
  const group = G.groupOf.get(o.id);
  const dim = t < tSettle ? 1 : keyed(t, DIM[group === 'neutral' ? 'F05' : group]);
  const style = o.id === model.contraryObs && t >= T.contrary + 1.0 ? 'contrary'
    : o.id === model.neutral && t >= tSettle ? 'neutral' : 'normal';
  const ring = o.id === model.findings.get('F05').support[0] && t >= T.contrary + 1.6;
  return { x, y, sc, rot, dim, style, ring, cx: x + sw / 2, cy: y + sh / 2, top: [x + sw / 2, y], left: [x, y + sh / 2] };
}

function drawSlip(o, t) {
  const st = slipState(o, t);
  const { w, h } = L.slip;
  const color = PCOLOR[o.p];
  alpha(st.dim, () => {
    ctx.save();
    ctx.translate(st.cx, st.cy);
    ctx.rotate(st.rot);
    ctx.scale(st.sc, st.sc);
    rr(-w / 2 + 4, -h / 2 + 5, w, h, 9);
    ctx.fillStyle = 'rgba(28,26,23,0.12)';
    ctx.fill();
    rr(-w / 2, -h / 2, w, h, 9);
    ctx.fillStyle = PTINT[o.p];
    ctx.fill();
    ctx.save();
    rr(-w / 2, -h / 2, w, h, 9);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, 12);
    ctx.restore();
    rr(-w / 2, -h / 2, w, h, 9);
    ctx.lineWidth = st.style === 'normal' ? 2 : 3;
    ctx.strokeStyle = color;
    if (st.style === 'contrary') ctx.setLineDash([9, 6]);
    if (st.style === 'neutral') { ctx.setLineDash([1, 7]); ctx.lineCap = 'round'; }
    ctx.stroke();
    ctx.setLineDash([]);
    text(o.p, 0, -h / 2 + (L.portrait ? 34 : 32), { size: L.portrait ? 20 : 19, weight: 800, font: MONO, color, align: 'center' });
    text(o.line.slice(4), 0, -h / 2 + (L.portrait ? 54 : 50), { size: L.portrait ? 18 : 17, weight: 700, font: MONO, align: 'center' });
    if (st.ring) {
      rr(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 13);
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    ctx.restore();
  });
}

function pageAnchor(o) {
  const b = L.notebooks[o.p];
  return [b.x + b.w - 16, G.lineY(b, o.k) - 4];
}

function drawThreads(t) {
  const T = model.T;
  // Release: each slip trails a line from its own notebook line while it travels.
  for (const o of model.obsList) {
    const tDepart = T.inputs + 0.5 + o.index * 0.2;
    const tArrive = tDepart + 1.0;
    const a = (t >= tDepart ? 1 : 0) * (1 - prog(t, tArrive, tArrive + 0.8)) * 0.55;
    if (a <= 0.002) continue;
    const st = slipState(o, t);
    alpha(a, () => {
      ctx.strokeStyle = PCOLOR[o.p];
      ctx.lineWidth = 2;
      strokePts([pageAnchor(o), [st.cx, st.cy]]);
    });
  }
  // F05: P03 supports (solid), P02 is contrary (dashed), P01 is counted for neither (dotted).
  const f05 = model.findings.get('F05');
  const dim = keyed(t, DIM.F05);
  const links = [
    { oid: f05.support[0], start: T.contrary + 1.6, dash: null, width: 5 },
    { oid: model.contraryObs, start: T.contrary + 2.0, dash: [12, 9], width: 4 },
    { oid: model.neutral, start: T.contrary + 2.4, dash: [1, 10], width: 5 },
  ];
  for (const link of links) {
    const p = ease(t, link.start, link.start + 1.0);
    if (p <= 0) continue;
    const o = model.obs.get(link.oid);
    const st = slipState(o, t);
    const pts = bezierPts(pageAnchor(o), L.portrait ? st.top : st.left, L.portrait);
    if (link === links[0]) {
      // Trace back from the supporting slip to its exact line before the proposal.
      const back = ease(t, T.proposal + 0.3, T.proposal + 1.3);
      if (back > 0) alpha(dim * 0.85, () => {
        ctx.strokeStyle = MARKER;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        strokePts(polyline([...pts].reverse(), back));
      });
    }
    alpha(dim, () => {
      ctx.strokeStyle = PCOLOR[o.p];
      ctx.lineWidth = link.width;
      ctx.lineCap = 'round';
      if (link.dash) ctx.setLineDash(link.dash);
      strokePts(polyline(pts, p));
      ctx.setLineDash([]);
    });
  }
}

function drawProposal(t) {
  const T = model.T;
  const b = L.proposal;
  const P = L.portrait;
  const rec = model.findings.get('F05').rec;
  const arrowP = ease(t, T.proposal + 1.0, T.proposal + 1.6);
  const fill = ease(t, T.proposal + 1.5, T.proposal + 2.3);
  alpha(0.3 * (1 - arrowP), () => drawArrow(L.toProposal, 1, { width: 3, dash: [6, 8] }));
  drawArrow(L.toProposal, arrowP, { width: 4 });
  const ear = 26;
  const sheet = () => {
    ctx.beginPath();
    ctx.moveTo(b.x + 12, b.y);
    ctx.lineTo(b.x + b.w - ear, b.y);
    ctx.lineTo(b.x + b.w, b.y + ear);
    ctx.lineTo(b.x + b.w, b.y + b.h - 12);
    ctx.arcTo(b.x + b.w, b.y + b.h, b.x + b.w - 12, b.y + b.h, 12);
    ctx.lineTo(b.x + 12, b.y + b.h);
    ctx.arcTo(b.x, b.y + b.h, b.x, b.y + b.h - 12, 12);
    ctx.lineTo(b.x, b.y + 12);
    ctx.arcTo(b.x, b.y, b.x + 12, b.y, 12);
    ctx.closePath();
  };
  // ghost outline is part of the whole map from the first frame
  alpha(0.4 * (1 - fill), () => {
    sheet();
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.setLineDash([]);
    text('次の一歩', b.x + 24, b.y + (P ? 50 : 56), { size: P ? 22 : 20, weight: 700, color: MUTED });
  });
  alpha(fill, () => {
    sheet();
    ctx.fillStyle = '#fffef6';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x + b.w - ear, b.y);
    ctx.lineTo(b.x + b.w - ear, b.y + ear);
    ctx.lineTo(b.x + b.w, b.y + ear);
    ctx.fillStyle = '#ebe3d3';
    ctx.fill();
    ctx.stroke();
    const lines = REC_LINES[rec.id];
    if (P) {
      const idW = text(rec.id, b.x + 22, b.y + 46, { size: 32, weight: 800, font: MONO });
      pill(rec.priority, b.x + 22 + idW + 14, b.y + 42, { size: 17, fill: MARKER_SOFT });
      text(lines[0], b.x + 22, b.y + 84, { size: 22, weight: 700, maxW: b.w - 150 });
      text(lines[1], b.x + 22, b.y + 114, { size: 22, weight: 700, maxW: b.w - 150 });
    } else {
      text(rec.id, b.x + 22, b.y + 54, { size: 32, weight: 800, font: MONO });
      pill(rec.priority, b.x + 22, b.y + 96, { size: 16, fill: MARKER_SOFT });
      text(lines[0], b.x + 22, b.y + 146, { size: 20, weight: 700, maxW: b.w - 40 });
      text(lines[1], b.x + 22, b.y + 176, { size: 20, weight: 700, maxW: b.w - 40 });
    }
    // The validation is a plan: stamp it as not yet done.
    ctx.save();
    const sx = P ? b.x + b.w - 74 : b.x + b.w - 66;
    const sy = P ? b.y + 98 : b.y + 212;
    ctx.translate(sx, sy);
    ctx.rotate(-0.08);
    rr(-48, -22, 96, 34, 6);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = RED;
    ctx.stroke();
    text('未実施', 0, 3, { size: 19, weight: 800, color: RED, align: 'center' });
    ctx.restore();
  });
}

function drawExport(t) {
  const T = model.T;
  const b = L.exportBox;
  const arrowP = ease(t, T.proposal + 2.3, T.proposal + 2.7);
  const fill = ease(t, T.proposal + 2.6, T.proposal + 3.3);
  alpha(0.3 * (1 - arrowP), () => drawArrow(L.toExport, 1, { width: 3, dash: [6, 8] }));
  drawArrow(L.toExport, arrowP, { width: 4 });
  const iconW = 46;
  const iconH = 58;
  const ix = b.x + b.w / 2 - iconW / 2;
  const iy = b.y + 14;
  const doc = () => {
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ix + iconW - 14, iy);
    ctx.lineTo(ix + iconW, iy + 14);
    ctx.lineTo(ix + iconW, iy + iconH);
    ctx.lineTo(ix, iy + iconH);
    ctx.closePath();
  };
  alpha(0.4 * (1 - fill), () => {
    rr(b.x, b.y, b.w, b.h, 14);
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.setLineDash([]);
    doc();
    ctx.stroke();
    text('保存', b.x + b.w / 2, b.y + b.h - 22, { size: 20, weight: 700, color: MUTED, align: 'center' });
  });
  alpha(fill, () => {
    rr(b.x, b.y, b.w, b.h, 14);
    ctx.fillStyle = INK;
    ctx.fill();
    doc();
    ctx.fillStyle = '#fff';
    ctx.fill();
    text('.md', ix + iconW / 2, iy + iconH - 14, { size: 15, weight: 800, font: MONO, align: 'center' });
    text(model.exportName, b.x + b.w / 2, b.y + b.h - (L.portrait ? 30 : 42), { size: 17, weight: 800, font: MONO, color: '#fff', align: 'center', maxW: b.w - 16 });
    text('選んだ発見を1件', b.x + b.w / 2, b.y + b.h - (L.portrait ? 9 : 18), { size: 14, color: '#e8e2d6', align: 'center' });
  });
}

function draw(seconds) {
  const t = clamp(Number.isFinite(seconds) ? seconds : 0, 0, DURATION);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  if (model && L && G) {
    ctx.translate(L.ox, L.oy);
    ctx.scale(L.s, L.s);
    drawBackdrop();
    drawHeader(t);
    drawThreads(t);
    for (const fid of FINDING_IDS) drawCluster(fid, t);
    drawNeutral(t);
    for (const p of model.participants) drawNotebook(p, t);
    for (const o of model.obsList) drawSlip(o, t);
    drawProposal(t);
    drawExport(t);
    drawFooter();
  }
  ctx.restore();
}

/* ---------- size, readiness, seek ---------- */

function applySize(w, h) {
  W = w;
  H = h;
  canvas.width = W;
  canvas.height = H;
  if (RENDER) {
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }
  window.motionConfig.width = W;
  window.motionConfig.height = H;
  L = makeLayout(W, H);
  G = model ? buildGeometry(model, L) : null;
}

async function fontsReady() {
  if (!document.fonts) return;
  const probes = [`700 42px ${SERIF}`, `700 20px ${SANS}`, `400 16px ${SANS}`, `800 20px ${MONO}`];
  await Promise.all(probes.map((f) => document.fonts.load(f, '発言を束ねてもP01').catch(() => [])));
  await document.fonts.ready;
}

applySize(W, H);
window.motionReady = (async () => {
  const m = await loadAssets();
  await fontsReady();
  model = m;
  DIM = dimKeys(m.T);
  FOCUS = focusKeys(m.T);
  G = buildGeometry(model, L);
  draw(0);
  return true;
})();

window.seek = (seconds) => window.motionReady.then(() => { draw(Number(seconds)); });

/* ---------- preview controls (never started under the renderer) ---------- */

const ui = {
  status: document.getElementById('status'),
  error: document.getElementById('film-error'),
  reload: document.getElementById('reload'),
  play: document.getElementById('play'),
  reset: document.getElementById('reset'),
  end: document.getElementById('end'),
  replay: document.getElementById('replay'),
  scrub: document.getElementById('scrub'),
  clock: document.getElementById('clock'),
  scenes: document.getElementById('scenes'),
  sizes: Array.from(document.querySelectorAll('.size[data-size]')),
  motionNote: document.getElementById('motion-note'),
};
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const player = { t: 0, playing: false, raf: 0, timer: 0, from: 0, startedAt: 0 };

function controlsEnabled(on) {
  for (const node of [ui.play, ui.reset, ui.end, ui.replay, ui.scrub, ...ui.sizes, ...ui.scenes.querySelectorAll('button')]) node.disabled = !on;
}

function setTime(t) {
  player.t = clamp(t, 0, DURATION);
  draw(player.t);
  const i = sceneAt(player.t);
  const s = model.scenes[i];
  ui.scrub.value = String(player.t);
  ui.scrub.setAttribute('aria-valuetext', `${player.t.toFixed(1)}秒・${SCENE_LABEL[s.id]}`);
  ui.clock.textContent = `${player.t.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
  canvas.setAttribute('aria-label', `${i + 1}/${model.scenes.length}「${s.headline}」（${player.t.toFixed(1)}秒）`);
  ui.scenes.querySelectorAll('button').forEach((btn, k) => btn.setAttribute('aria-current', String(k === i)));
}

function pause() {
  player.playing = false;
  cancelAnimationFrame(player.raf);
  clearTimeout(player.timer);
  ui.play.textContent = '再生';
  ui.play.setAttribute('aria-pressed', 'false');
}

function play() {
  if (RENDER || !model) return;
  if (player.t >= DURATION - 1e-6) setTime(0);
  player.playing = true;
  ui.play.textContent = '一時停止';
  ui.play.setAttribute('aria-pressed', 'true');
  if (reduceQuery.matches) {
    // Reduced motion: step through each scene's settled frame instead of continuous movement.
    const holds = model.scenes.map((s, i) => (i === model.scenes.length - 1 ? DURATION : s.out - 0.3));
    const step = () => {
      if (!player.playing) return;
      const next = holds.find((h) => h > player.t + 1e-3);
      if (next === undefined) { pause(); return; }
      setTime(next);
      player.timer = setTimeout(step, 2500);
    };
    step();
    return;
  }
  player.from = player.t;
  player.startedAt = performance.now();
  const tick = () => {
    if (!player.playing) return;
    const t = player.from + (performance.now() - player.startedAt) / 1000;
    if (t >= DURATION) {
      setTime(DURATION);
      pause();
      return;
    }
    setTime(t);
    player.raf = requestAnimationFrame(tick);
  };
  player.raf = requestAnimationFrame(tick);
}

function initPreview() {
  ui.status.textContent = `7つの素材（manifest のSHA-256を固定）を照合しました。assets/original-verification.json は旧版（${model.historySeconds}秒）の確認記録で、この32秒版の書き出し・確認は ../verification.json に別記しています。`;
  ui.scenes.replaceChildren(...model.scenes.map((s, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'button button--quiet';
    btn.textContent = `${i + 1} ${SCENE_LABEL[s.id]}`;
    btn.setAttribute('aria-label', `${s.in}秒の場面へ：${s.headline}`);
    btn.addEventListener('click', () => { pause(); setTime(i ? s.in + 0.4 : 0); });
    return btn;
  }));
  ui.motionNote.hidden = !reduceQuery.matches;
  reduceQuery.addEventListener('change', () => { ui.motionNote.hidden = !reduceQuery.matches; if (player.playing) { pause(); } });
  ui.play.addEventListener('click', () => (player.playing ? pause() : play()));
  ui.reset.addEventListener('click', () => { pause(); setTime(0); });
  ui.end.addEventListener('click', () => { pause(); setTime(DURATION); });
  ui.replay.addEventListener('click', () => { pause(); setTime(0); play(); });
  ui.scrub.addEventListener('input', () => { pause(); setTime(Number(ui.scrub.value)); });
  for (const btn of ui.sizes) {
    btn.addEventListener('click', () => {
      const [w, h] = btn.dataset.size.split('x').map(Number);
      applySize(w, h);
      for (const other of ui.sizes) other.setAttribute('aria-pressed', String(other === btn));
      setTime(player.t);
    });
    btn.setAttribute('aria-pressed', String(btn.dataset.size === `${W}x${H}`));
  }
  controlsEnabled(true);
  setTime(0); // starts paused
}

function showFailure(err) {
  model = null;
  G = null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const message = err instanceof AssetError ? err.message : '素材の準備中に問題が起きました。';
  ui.error.textContent = `${message} 動画は描いていません。`;
  ui.error.hidden = false;
  ui.status.textContent = message;
  ui.status.classList.add('is-error');
  canvas.setAttribute('aria-label', '素材を照合できなかったため、動画を描いていません');
  if (!RENDER) {
    pause();
    controlsEnabled(false);
    ui.reload.hidden = false;
  }
}

ui.reload.addEventListener('click', () => location.reload());
window.motionReady.then(() => { if (!RENDER) initPreview(); }, showFailure);
