// コードのつながりを、地図に。— 32秒・無音の概念図ムービー（Studio Yebisu、MIT License）
// 1枚の図（コードの束 → 手で回す索引の橋 → 呼び出しの地図 → 実際の記録の保存先）を、同じ形のまま動かす。
// window.seek(t) は時刻 t だけから1枚を描く。呼び出し順・壁時計・前のフレームには依存しない。
// 描く事実は7つのローカルJSON（SHA-256を固定した manifest で確認）から読む。音声・外部通信・AIは使わない。
(() => {
  "use strict";

  const MANIFEST = { path: "assets/manifest.json", sha256: "e015e3ddc03445b9cedf70f1254f557421dac65b477448c4852233cf0cf27fab" };
  const ASSET_FILES = ["runs.json", "samples.json", "fixture-data.json", "diagram-data.json", "timeline.json", "upstream.json", "original-verification.json"];
  const CASE_ID = "codebase-memory-mcp-example";
  const COMMIT = "ec6427c38176efcd37b28682e82f2491afda94be";
  const DURATION = 32;
  const POSTER = 31;
  const SCENE_IDS = ["overview", "index", "find", "trace", "stale", "reindex", "finish"];
  const SCENE_BOUNDS = [0, 5, 10, 15, 20, 24, 28, 32];
  const SCENE_NAMES = { overview: "全体", index: "索引する", find: "探す", trace: "たどる", stale: "変更・未更新", reindex: "手で更新", finish: "保存" };
  const OP_NAMES = { find: "探す", trace: "たどる", update: "更新する" };
  const SOURCE_ORDER = ["fixture/app.py", "fixture/service.py", "fixture/validation.py", "fixture/pricing.py", "fixture/storage.py"];
  const NODE_IDS = ["main", "submit_order", "validate_order", "calculate_total", "save_receipt", "audit_receipt"];
  const QN_RULE = 'qn = qn_prefix == "" ? name : qn_prefix + "." + name';

  const C = {
    cream: "#f4eee1",
    paper: "#fffbf2",
    navy: "#1b2741",
    muted: "#586174",
    line: "#cfc4ab",
    bar: "#b9ae98",
    teal: "#13756d",
    tealInk: "#0d5a53",
    tealSoft: "#dcefe9",
    map: "#e8f1ec",
    mapEdge: "#a6cbc1",
    dot: "#c4dcd4",
    ochre: "#c7851a",
    ochreInk: "#7f4f00",
    ochreSoft: "#f7e5bf",
    ochreLight: "#fff3d9",
  };
  const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif';
  const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", serif';
  const MONO = 'Consolas, "SFMono-Regular", Menlo, "Liberation Mono", monospace';

  /* ---------- 書き出しの設定（初期化時に renderConfig を反映） ---------- */

  const params = new URLSearchParams(location.search);
  const RENDER = window.__MOTION_RENDER__ === true || params.has("render");
  const renderConfig = window.renderConfig && typeof window.renderConfig === "object" ? window.renderConfig : {};
  const evenInt = (value) => (Number.isInteger(value) && value >= 16 && value <= 4096 ? value : null);
  const wideStart = params.get("size") === "wide";
  let W = evenInt(renderConfig.width) || (wideStart ? 1280 : 720);
  let H = evenInt(renderConfig.height) || (wideStart ? 720 : 1280);
  const FPS = Number.isInteger(renderConfig.fps) && renderConfig.fps > 0 && renderConfig.fps <= 120 ? renderConfig.fps : 30;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER, audioEvents: [] };
  if (RENDER) document.documentElement.classList.add("is-render");

  const canvas = document.getElementById("film");
  const ctx = canvas.getContext("2d");
  function sizeCanvas() {
    canvas.width = W;
    canvas.height = H;
    document.documentElement.style.setProperty("--ar", String(W / H));
  }
  sizeCanvas();

  let resolveReady;
  let rejectReady;
  window.motionReady = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  window.motionReady.catch(() => {});

  /* ---------- 数の道具（すべて時刻からの純粋な関数） ---------- */

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeIO = (v) => {
    const x = clamp01(v);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const ramp = (t, a, b) => easeIO((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;
  const window01 = (t, a, b, c, d) => ramp(t, a, b) * (1 - ramp(t, c, d));

  /* ---------- 素材の確認 ---------- */

  class AssetError extends Error {}
  const check = (condition, message) => {
    if (!condition) throw new AssetError(message);
  };

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }

  async function sha256Hex(bytes) {
    check(globalThis.crypto && crypto.subtle && typeof crypto.subtle.digest === "function", "この接続では SHA-256 を計算できません。http://127.0.0.1 などで開いてください。");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function fetchBytes(path) {
    let response;
    try {
      response = await fetch(path, { cache: "no-store", credentials: "same-origin" });
    } catch (error) {
      throw new AssetError(`${path} を取得できませんでした（${error && error.message ? error.message : "通信エラー"}）。`);
    }
    check(response.ok, `${path} を読み込めませんでした（HTTP ${response.status}）。`);
    return new Uint8Array(await response.arrayBuffer());
  }

  function parse(bytes, path) {
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new AssetError(`${path} を UTF-8 として読めませんでした。`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new AssetError(`${path} をJSONとして読めませんでした。`);
    }
  }

  async function loadAssets() {
    check(location.protocol !== "file:", "file:// では素材を読めません。作例フォルダで python -m http.server 8000 を起動して開いてください。");
    const manifestBytes = await fetchBytes(MANIFEST.path);
    const manifestHash = await sha256Hex(manifestBytes);
    check(manifestHash === MANIFEST.sha256, `assets/manifest.json の SHA-256 が固定値と違います（${manifestHash.slice(0, 12)}…）。`);
    const manifest = parse(manifestBytes, MANIFEST.path);
    check(manifest.format === "studio-yebisu-motion-assets-v1" && manifest.case === CASE_ID, "assets/manifest.json の形式か作例IDが違います。");
    check(Array.isArray(manifest.assets) && manifest.assets.length === ASSET_FILES.length, "assets/manifest.json の素材が7件ではありません。");
    check(deepEqual(manifest.assets.map((a) => a && a.file).sort(), [...ASSET_FILES].sort()), "assets/manifest.json の素材の名前が想定と違います。");
    const data = {};
    await Promise.all(
      manifest.assets.map(async (asset) => {
        check(Number.isInteger(asset.bytes) && asset.bytes > 0 && /^[0-9a-f]{64}$/.test(asset.sha256), `${asset.file} の長さか SHA-256 の形が違います。`);
        const path = `assets/${asset.file}`;
        const bytes = await fetchBytes(path);
        check(bytes.byteLength === asset.bytes, `${path} の長さが記録と違います（${bytes.byteLength} / ${asset.bytes} バイト）。`);
        check((await sha256Hex(bytes)) === asset.sha256, `${path} の SHA-256 が記録と違います。`);
        data[asset.file] = parse(bytes, path);
      }),
    );
    return derive(data);
  }

  const lineAt = (text, n) => text.split("\n")[n - 1];

  async function derive(a) {
    const runs = a["runs.json"];
    const samples = a["samples.json"];
    const fixture = a["fixture-data.json"];
    const diagram = a["diagram-data.json"];
    const timeline = a["timeline.json"];
    const upstream = a["upstream.json"];
    const history = a["original-verification.json"];

    // timeline.json：固定した 32 秒・7 場面
    check(timeline.format === "studio-yebisu-codebase-visual-timeline-v1" && timeline.duration === DURATION && timeline.fps === 30 && timeline.silent === true, "timeline.json が32秒・30fps・無音の固定値ではありません。");
    check(Array.isArray(timeline.scenes) && timeline.scenes.map((s) => s && s.id).join() === SCENE_IDS.join(), "timeline.json の場面が想定の7つではありません。");
    timeline.scenes.forEach((scene, i) => {
      check(scene.in === SCENE_BOUNDS[i] && scene.out === SCENE_BOUNDS[i + 1], `timeline.json の ${scene.id} の時刻が固定値と違います。`);
      check(typeof scene.headline === "string" && scene.headline.length > 0 && OP_NAMES[scene.operation] && ["before", "stale", "after"].includes(scene.phase), `timeline.json の ${scene.id} の内容が欠けています。`);
    });

    // runs.json：公式CLIの実行記録
    check(runs.tool && runs.tool.commit === COMMIT && runs.tool.version === "codebase-memory-mcp 0.12.0" && runs.tool.transport === "official native CLI; MCP protocol not exercised", "runs.json の版か呼び方が固定値と違います。");
    check(Array.isArray(runs.steps) && runs.steps.map((s) => s.id).join() === "find,trace,update", "runs.json の steps が find・trace・update ではありません。");
    const steps = Object.fromEntries(runs.steps.map((s) => [s.id, s]));
    let calls = 0;
    for (const stage of [runs.index, ...runs.steps]) {
      check(Array.isArray(stage.request) && Array.isArray(stage.response) && stage.request.length === stage.response.length, "runs.json の要求と応答の数が合いません。");
      stage.request.forEach((req, i) => check(req.tool === stage.response[i].tool && req.phase === stage.response[i].phase, "runs.json の要求と応答の並びが合いません。"));
      calls += stage.request.length;
    }
    check(calls === 18, `公式CLIの呼び出しが ${calls} 回です（18 回のはず）。`);

    // samples.json：runs.json の要求と応答そのもの
    check(samples.format === "input-output" && samples.samples.map((s) => s.id).join() === "find,trace,update", "samples.json の3件が想定と違います。");
    for (const s of samples.samples) check(deepEqual(s.input, steps[s.id].request) && deepEqual(s.output, steps[s.id].response), `samples.json の ${s.id} が runs.json と一致しません。`);

    // fixture-data.json：実ファイルの本文（長さと SHA-256 を本文から計算して照合）
    check(fixture.format === "studio-yebisu-codebase-fixture-v1" && Array.isArray(fixture.files) && fixture.files.length === 7, "fixture-data.json の形式が違います。");
    const texts = {};
    for (const file of fixture.files) {
      const bytes = new TextEncoder().encode(file.text);
      check(bytes.byteLength === file.bytes, `fixture-data.json の ${file.path} の長さが本文と合いません。`);
      check((await sha256Hex(bytes)) === file.sha256, `fixture-data.json の ${file.path} の SHA-256 が本文と合いません。`);
      texts[file.path] = file.text;
    }
    const base = runs.source_snapshots.base;
    const changed = runs.source_snapshots.changed;
    for (const path of Object.keys(base)) check(texts[path] === base[path], `${path} が runs.json のソースの写しと一致しません。`);
    check(texts["fixture/storage_revised.py"] === changed["fixture/storage.py"], "storage_revised.py が runs.json の変更後の写しと一致しません。");
    for (const path of SOURCE_ORDER) check(typeof texts[path] === "string", `${path} の本文がありません。`);

    // 探す・たどる・更新の事実
    const find = steps.find.facts;
    check(find.line === 8 && find.source_def_line === 8 && find.line_matches_source === true && find.file === "fixture/service.py", "探すの定義行が service.py 8 行目ではありません。");
    const defText = lineAt(texts[find.file], find.line);
    check(defText.startsWith("def submit_order("), "service.py の 8 行目が def submit_order ではありません。");
    // v0.12 のまとめた応答：cols で列名を付け、qn_rule で qualified_name を組み立てる
    const search = steps.find.response[0].response;
    check(steps.find.response[0].tool === "search_graph" && search.qn_rule === QN_RULE && Array.isArray(search.cols) && search.groups.length === 1 && search.groups[0].rows.length === 1, "search_graph のまとめた応答の形が違います。");
    const group = search.groups[0];
    const hit = Object.fromEntries(search.cols.map((col, i) => [col, group.rows[0][i]]));
    const qualified = group.qn_prefix === "" ? hit.name : `${group.qn_prefix}.${hit.name}`;
    check(hit.name === "submit_order" && qualified === find.qualified_name && `fixture/${group.file}` === find.file, "search_graph の結果が submit_order の定義と一致しません。");
    const span = hit.lines;
    check(span === `${find.line}-${find.line + find.snippet_lines - 1}`, "search_graph の行範囲が本文の行数と合いません。");
    const callLines = {};
    for (const call of find.call_expressions) {
      check(lineAt(texts[find.file], call.line).trim() === call.text, `${call.callee} の呼び出し行が実ソースと一致しません。`);
      callLines[call.callee] = call.line;
    }
    const appLines = texts["fixture/app.py"].split("\n");
    const mainCall = appLines.findIndex((l) => l.includes("submit_order(")) + 1;

    const rows = { before: runs.calls_before.rows, stale: runs.calls_stale.rows, after: runs.calls_after.rows };
    const internal = (list) => list.filter((r) => NODE_IDS.includes(r.caller) && NODE_IDS.includes(r.callee)).map((r) => [r.caller, r.callee]);
    check(rows.before.length === 6 && rows.stale.length === 6 && rows.after.length === 7, "CALLS の組が 6・6・7 件ではありません。");
    const edge = steps.update.facts.new_edge;
    const has = (list) => list.some((r) => r.caller === edge.caller && r.callee === edge.callee);
    check(!has(rows.before) && !has(rows.stale) && has(rows.after), "新しい線が手で再索引した後だけに現れる記録ではありません。");
    const watchStates = [runs.index.facts.watch, steps.update.facts.watch_before_reindex, steps.update.facts.watch_after_reindex];
    check(watchStates.every((w) => w && w.watched === false), "watch.watched が false ではありません。");
    const upd = steps.update.facts;
    check(lineAt(changed["fixture/storage.py"], upd.call_expression.line).trim() === upd.call_expression.text, "変更後の storage.py の呼び出し行が一致しません。");
    check(lineAt(changed["fixture/storage.py"], upd.audit_receipt.line).startsWith("def audit_receipt("), "変更後の storage.py の audit_receipt の定義行が一致しません。");

    // diagram-data.json：図の役割名と線（runs.json と照合）
    check(diagram.format === "studio-yebisu-codebase-diagram-v1" && diagram.fictional === true, "diagram-data.json の形式が違います。");
    check(deepEqual(diagram.nodes.map((n) => n.id), NODE_IDS), "diagram-data.json のカードが想定の6つではありません。");
    const nodes = Object.fromEntries(diagram.nodes.map((n) => [n.id, n]));
    for (const n of diagram.nodes) check(n.function === n.id && typeof n.label === "string" && n.label.length > 0 && texts[`fixture/${n.file}`] !== undefined, `diagram-data.json の ${n.id} が欠けています。`);
    check(nodes.submit_order.line === find.line && nodes.main.line === mainCall, "diagram-data.json の行が実ソースと一致しません。");
    for (const id of ["validate_order", "calculate_total", "save_receipt"]) check(nodes[id].call_line === callLines[id], `diagram-data.json の ${id} の呼び出し行が一致しません。`);
    check(nodes.audit_receipt.line === upd.audit_receipt.line && nodes.audit_receipt.call_line === upd.call_expression.line, "diagram-data.json の audit_receipt の行が一致しません。");
    check(deepEqual(internal(rows.before), diagram.internal_edges_before) && deepEqual(internal(rows.stale), diagram.internal_edges_before) && deepEqual(internal(rows.after), diagram.internal_edges_after), "diagram-data.json の線が実際の組と一致しません。");
    check(diagram.internal_edges_before.length === 4 && diagram.internal_edges_after.length === 5, "描く線が 4・5 本ではありません。");
    check(deepEqual(diagram.query_row_counts, { before: 6, stale: 6, after: 7 }), "diagram-data.json の件数が 6・6・7 ではありません。");
    check(deepEqual(diagram.definition, steps.find.facts) && deepEqual(diagram.trace, steps.trace.facts) && deepEqual(diagram.update, steps.update.facts), "diagram-data.json の照合結果が runs.json と一致しません。");
    check(deepEqual(diagram.separate_fixture_execution, runs.fixture_execution), "diagram-data.json の別の実行が runs.json と一致しません。");

    // 別の実行（Python）：領収 2,400 円、監査 consistent:true
    const order = JSON.parse(texts["fixture/sample_order.json"]);
    const total = order.seat_count * order.seat_price_jpy;
    const fx = runs.fixture_execution;
    const receiptName = `receipt-${order.order_id}.json`;
    const auditFile = fx.revised.files[`audit-${order.order_id}.json`];
    check(fx.base.exit_code === 0 && fx.revised.exit_code === 0 && fx.base.files[receiptName].total_jpy === total && fx.revised.files[receiptName].total_jpy === total, "別の実行の領収の合計が注文と合いません。");
    check(auditFile && auditFile.consistent === true && auditFile.recomputed_total_jpy === total && auditFile.saved_total_jpy === total, "別の実行の監査が一致していません。");

    // upstream.json：原典の版と利用条件
    check(upstream.repository === "DeusData/codebase-memory-mcp" && upstream.commit === COMMIT && runs.tool.version.endsWith(upstream.version) && upstream.license === "MIT" && upstream.copyright_notice === "Copyright (c) 2025 DeusData", "upstream.json の原典情報が runs.json と一致しません。");
    check(upstream.scope === runs.scope_note, "upstream.json の範囲が runs.json と一致しません。");

    // original-verification.json：以前（28秒版）の確認記録。新しい映像の確認ではなく、実行の数を突き合わせるだけに使う
    const dc = history.data_checks;
    check(history.id === CASE_ID && history.source_commit === COMMIT, "original-verification.json の作例IDか固定コミットが違います。");
    check(dc.native_tool_calls === calls && dc.query_rows_before === 6 && dc.query_rows_stale === 6 && dc.query_rows_after === 7 && dc.base_and_revised_total_jpy === total && dc.actual_audit_consistent === true && dc.new_edge_after_manual_reindex_only === true, "original-verification.json の実行の数が runs.json と一致しません。");

    const sceneById = Object.fromEntries(timeline.scenes.map((s) => [s.id, s]));
    return {
      scenes: timeline.scenes,
      S: sceneById,
      files: SOURCE_ORDER.map((path) => ({ path, stem: path.replace(/^fixture\//, "").replace(/\.py$/, ""), text: texts[path] })),
      revisedStorage: changed["fixture/storage.py"],
      nodes,
      edgesBefore: diagram.internal_edges_before,
      edgesAfter: diagram.internal_edges_after,
      newEdge: [edge.caller, edge.callee],
      counts: diagram.query_row_counts,
      defLine: find.line,
      defText,
      span,
      serviceFile: find.file.replace(/^fixture\//, ""),
      mainCall,
      auditCall: upd.call_expression.line,
      auditDef: upd.audit_receipt.line,
      order,
      total,
      calls,
      version: upstream.version,
      commitShort: COMMIT.slice(0, 7),
      cliDate: String(runs.index.response.find((r) => r.tool === "index_status").response.indexed_at).slice(0, 10),
      recordFor: (op) => `codebase-memory-${op}.json`,
    };
  }

  /* ---------- 配置（縦と横で別に組む） ---------- */

  const PORTRAIT = {
    base: [720, 1280],
    progress: { x: 48, y: 42, w: 624, h: 6 },
    sceneLabel: { x: 48, y: 84, size: 20 },
    headline: { x: 48, y: 146, w: 624, size: 46, lh: 58, lines: 2 },
    srcLabel: { x: 48, y: 252, size: 20 },
    srcTag: { x: 672, y: 252, align: "right", size: 19, changed: "コード：変更後（storage.py）" },
    files: [[40, 268], [172, 268], [304, 268], [436, 268], [568, 268]],
    file: { w: 112, h: 124, bars: 7, barTop: 22, barStep: 8.6, barLeft: 12, barW: 88, name: 19, ext: 13 },
    bridge: { x: 40, y: 424, w: 556, h: 56, vertical: false, label: 24, mono: 15 },
    knob: { x: 644, y: 452, r: 30, label: 18 },
    map: { x: 28, y: 520, w: 664, h: 598 },
    mapTitle: { x: 664, y: 566, size: 27 },
    mapTag: { x: 56, y: 1098, size: 19 },
    count: { x: 664, y: 1098, size: 16 },
    nodes: {
      main: [360, 642, 280, 76],
      submit_order: [360, 768, 340, 84],
      validate_order: [138, 918, 200, 96],
      calculate_total: [360, 918, 200, 96],
      save_receipt: [582, 918, 200, 96],
      audit_receipt: [582, 1034, 200, 72],
    },
    nodeFont: { big: [30, 18], mid: [26, 16], small: [24, 15] },
    edgeLabel: 18,
    callout: { x: 40, y: 400, w: 640, h: 106, pointer: 228, code: 22, head: 20 },
    pin: [[64, 506], [64, 768], [190, 768]],
    fileBadge: 16,
    bracket: { x1: 40, x2: 680, y: 982, label: 19 },
    sheet: { w: 180, h: 66, stale: [526, 320, -5], bridge: [262, 419, 0], fn: 18, sub: 16 },
    stopLine: [[560, 390], [528, 432]],
    stopPill: { x: 474, y: 432, w: 104, h: 40, size: 19 },
    tray: { x: 40, y: 1132, w: 404, h: 64, title: 20, name: 15 },
    slip: { x: 456, y: 1132, w: 224, h: 64, title: 15, body: 15 },
    trayLink: [[242, 1118], [242, 1132]],
    recordFrom: [360, 1100],
    disclaimer: { cx: 360, y: 1214, h: 38, size: 21 },
    footer: { cx: 360, y: 1266, size: 14 },
    dots: 26,
  };

  const WIDE = {
    base: [1280, 720],
    progress: { x: 48, y: 28, w: 1184, h: 5 },
    sceneLabel: { x: 48, y: 62, size: 17 },
    headline: { x: 48, y: 108, w: 1184, size: 38, lh: 46, lines: 1 },
    srcLabel: { x: 48, y: 154, size: 17 },
    srcTag: { x: 48, y: 606, align: "left", size: 16, changed: "コード：変更後" },
    files: [[48, 166], [48, 250], [48, 334], [48, 418], [48, 502]],
    file: { w: 168, h: 70, bars: 6, barTop: 13, barStep: 8.4, barLeft: 10, barW: 52, name: 19, ext: 12 },
    bridge: { x: 240, y: 166, w: 52, h: 406, vertical: true, label: 22, mono: 12 },
    knob: { x: 266, y: 612, r: 26, label: 16 },
    map: { x: 316, y: 128, w: 584, h: 514 },
    mapTitle: { x: 880, y: 166, size: 23 },
    mapTag: { x: 340, y: 626, size: 16 },
    count: { x: 880, y: 626, size: 14 },
    nodes: {
      main: [608, 214, 240, 64],
      submit_order: [608, 316, 290, 72],
      validate_order: [434, 446, 168, 86],
      calculate_total: [608, 446, 168, 86],
      save_receipt: [782, 446, 168, 86],
      audit_receipt: [782, 560, 168, 62],
    },
    nodeFont: { big: [24, 15], mid: [21, 14], small: [20, 13] },
    edgeLabel: 15,
    callout: { x: 924, y: 140, w: 324, h: 124, pointer: null, code: 14, head: 17 },
    pin: [[753, 316], [838, 316], [924, 214]],
    fileBadge: 14,
    bracket: { x1: 350, x2: 866, y: 502, label: 16 },
    sheet: { w: 176, h: 60, stale: [50, 516, -4], bridge: [176, 436, 0], fn: 16, sub: 14 },
    stopLine: [[220, 520], [248, 500]],
    stopPill: { x: 228, y: 466, w: 76, h: 32, size: 16 },
    tray: { x: 924, y: 300, w: 324, h: 100, title: 18, name: 13 },
    slip: { x: 924, y: 418, w: 324, h: 84, title: 15, body: 14, long: true },
    trayLink: [[900, 350], [924, 350]],
    recordFrom: [900, 470],
    disclaimer: { cx: 608, y: 652, h: 30, size: 17 },
    footer: { cx: 640, y: 708, size: 12.5 },
    dots: 24,
  };

  /* ---------- 描画の道具 ---------- */

  function font(size, weight = 400, family = SANS) {
    ctx.font = `${weight} ${size}px ${family}`;
  }

  function text(str, x, y, o = {}) {
    font(o.size || 16, o.weight || 400, o.family || SANS);
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.base || "alphabetic";
    if (o.halo) {
      ctx.lineJoin = "round";
      ctx.lineWidth = o.halo;
      ctx.strokeStyle = o.haloColor || C.map;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || C.navy;
    ctx.fillText(str, x, y);
  }

  function fitSize(str, maxW, size, weight, family, min) {
    let s = size;
    font(s, weight, family);
    while (s > min && ctx.measureText(str).width > maxW) {
      s -= 1;
      font(s, weight, family);
    }
    return s;
  }

  function measure(str, size, weight = 400, family = SANS) {
    font(size, weight, family);
    return ctx.measureText(str).width;
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function filePath(x, y, w, h) {
    const ear = Math.min(22, w * 0.2, h * 0.3);
    ctx.beginPath();
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + w - ear, y);
    ctx.lineTo(x + w, y + ear);
    ctx.lineTo(x + w, y + h - 6);
    ctx.quadraticCurveTo(x + w, y + h, x + w - 6, y + h);
    ctx.lineTo(x + 6, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - 6);
    ctx.lineTo(x, y + 6);
    ctx.quadraticCurveTo(x, y, x + 6, y);
    ctx.closePath();
    return ear;
  }

  function pill(cx, y, label, o) {
    const w = measure(label, o.size, 700) + o.size * 1.4;
    const h = o.h || o.size * 1.8;
    roundRect(cx - w / 2, y, w, h, h / 2);
    ctx.fillStyle = o.fill;
    ctx.fill();
    if (o.stroke) {
      ctx.lineWidth = o.lineWidth || 2;
      ctx.strokeStyle = o.stroke;
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    text(label, cx, y + h / 2 + o.size * 0.36, { size: o.size, weight: 700, color: o.color, align: "center" });
    return w;
  }

  function bezier(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return [
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ];
  }

  function strokePartial(points, r) {
    if (r <= 0) return null;
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const goal = lengths[lengths.length - 1] * clamp01(r);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    let tip = points[0];
    for (let i = 1; i < points.length; i++) {
      if (lengths[i] <= goal) {
        ctx.lineTo(points[i][0], points[i][1]);
        tip = points[i];
      } else {
        const k = (goal - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
        tip = [mix(points[i - 1][0], points[i][0], k), mix(points[i - 1][1], points[i][1], k)];
        ctx.lineTo(tip[0], tip[1]);
        break;
      }
    }
    ctx.stroke();
    return tip;
  }

  function arrowHead(points, size, color) {
    const n = points.length;
    const [x1, y1] = points[n - 1];
    const [x0, y0] = points[n - 2];
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - size * Math.cos(ang - 0.45), y1 - size * Math.sin(ang - 0.45));
    ctx.lineTo(x1 - size * Math.cos(ang + 0.45), y1 - size * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  const rectOf = (L, id) => {
    const [cx, cy, w, h] = L.nodes[id];
    return { cx, cy, w, h, x: cx - w / 2, y: cy - h / 2 };
  };

  function edgePoints(L, from, to) {
    const a = rectOf(L, from);
    const z = rectOf(L, to);
    const p0 = [a.cx, a.y + a.h];
    const p3 = [z.cx, z.y - 3];
    if (Math.abs(p0[0] - p3[0]) < 1) return [p0, p3];
    const dy = p3[1] - p0[1];
    const p1 = [p0[0], p0[1] + dy * 0.55];
    const p2 = [p3[0], p3[1] - dy * 0.55];
    const pts = [];
    for (let i = 0; i <= 28; i++) pts.push(bezier(p0, p1, p2, p3, i / 28));
    return pts;
  }

  /* ---------- 時刻ごとの状態 ---------- */

  const T = {
    landStart: 5.8,
    landStep: 0.32,
    landTravel: 1.5,
  };
  const landTime = (i) => T.landStart + i * T.landStep + T.landTravel;

  function sceneAt(D, t) {
    let index = D.scenes.length - 1;
    for (let i = 0; i < D.scenes.length; i++) {
      if (t >= D.scenes[i].in && t < D.scenes[i].out) {
        index = i;
        break;
      }
    }
    return index;
  }

  /* ---------- 場面を構成する部品 ---------- */

  function drawHeader(D, L, t) {
    const idx = sceneAt(D, t);
    const scene = D.scenes[idx];
    // 進み具合（7区間）
    const p = L.progress;
    D.scenes.forEach((s) => {
      const x0 = p.x + (s.in / DURATION) * p.w + 2;
      const x1 = p.x + (s.out / DURATION) * p.w - 2;
      roundRect(x0, p.y, x1 - x0, p.h, p.h / 2);
      ctx.fillStyle = "#e2d8c3";
      ctx.fill();
      // 場面に入ったら 0.4 秒で区間を満たす（最後の 2.5 秒は動かない）
      const k = ramp(t, s.in, s.in + 0.4);
      if (k > 0) {
        roundRect(x0, p.y, Math.max(p.h, (x1 - x0) * k), p.h, p.h / 2);
        ctx.fillStyle = s.operation === "update" ? C.ochre : C.teal;
        ctx.fill();
      }
    });
    const label = `${idx + 1}/${D.scenes.length}  ${SCENE_NAMES[scene.id]} ·  保存済みの実行：${OP_NAMES[scene.operation]}`;
    text(label, L.sceneLabel.x, L.sceneLabel.y, { size: L.sceneLabel.size, weight: 700, color: C.muted });

    // 見出し（timeline.json の文。場面の境目で 0.4 秒だけ重ねて切り替え）
    const fadeIn = idx === 0 ? 1 : ramp(t, scene.in, scene.in + 0.4);
    drawHeadline(L, scene.headline, 1);
  }

  function drawHeadline(L, str, alpha) {
    if (alpha <= 0) return;
    const h = L.headline;
    const lines = wrapHeadline(str, h);
    ctx.save();
    ctx.globalAlpha *= alpha;
    lines.lines.forEach((line, i) => text(line, h.x, h.y + i * h.lh * (lines.size / h.size), { size: lines.size, weight: 700, family: SERIF }));
    ctx.restore();
  }

  function wrapHeadline(str, h) {
    for (let size = h.size; size >= Math.round(h.size * 0.62); size -= 2) {
      font(size, 700, SERIF);
      if (ctx.measureText(str).width <= h.w) return { size, lines: [str] };
      if (h.lines < 2) continue;
      const comma = str.indexOf("、");
      if (comma > 0) {
        const a = str.slice(0, comma + 1);
        const b = str.slice(comma + 1);
        if (ctx.measureText(a).width <= h.w && ctx.measureText(b).width <= h.w) return { size, lines: [a, b] };
      }
      let a = "";
      let i = 0;
      for (; i < str.length; i++) {
        if (ctx.measureText(a + str[i]).width > h.w) break;
        a += str[i];
      }
      let b = str.slice(i);
      while (b && "、。」）".includes(b[0]) && a.length > 1) {
        b = a.slice(-1) + b;
        a = a.slice(0, -1);
      }
      if (ctx.measureText(b).width <= h.w) return { size, lines: [a, b] };
    }
    return { size: Math.round(h.size * 0.62), lines: [str] };
  }

  // 実ファイルの空でない行の長さを、そのまま細い線の長さにする
  function codeBars(src, x, y, f, alpha) {
    if (alpha <= 0) return;
    const lines = src.split("\n").filter((l) => l.trim() !== "").slice(0, f.bars);
    const longest = Math.max(...lines.map((l) => l.trim().length), 1);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = C.bar;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    lines.forEach((line, i) => {
      const indent = Math.min(line.length - line.trimStart().length, 8) / 8;
      const x0 = x + f.barLeft + indent * f.barW * 0.2;
      const len = Math.max(6, (line.trim().length / longest) * (f.barW - (x0 - x - f.barLeft)));
      const yy = y + f.barTop + i * f.barStep;
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x0 + len, yy);
      ctx.stroke();
    });
    ctx.restore();
  }

  function fileState(D, i, t) {
    const path = D.files[i].path;
    const isService = path === "fixture/service.py";
    const isStorage = path === "fixture/storage.py";
    const findK = window01(t, 10, 10.6, 14.6, 15.2);
    const traceK = window01(t, 15, 15.6, 19.6, 20.2);
    const focusFT = window01(t, 10, 10.6, 19.6, 20.2);
    const focusUpd = window01(t, 20, 20.6, 28, 28.6);
    let alpha = 1;
    if (!isService) alpha -= 0.55 * focusFT;
    if (!isStorage) alpha -= 0.45 * focusUpd;
    const changedK = isStorage ? ramp(t, 20.3, 21.0) : 0;
    const start = T.landStart + i * T.landStep;
    const lift = window01(t, start - 0.2, start + 0.1, start + 0.5, start + 0.9);
    return { alpha, findK: isService ? findK : 0, traceK: isService ? traceK : 0, changedK, lift };
  }

  function drawFiles(D, L, t) {
    const f = L.file;
    text("コード", L.srcLabel.x, L.srcLabel.y, { size: L.srcLabel.size, weight: 700 });
    // 元のコード（変更前）か、変更後か
    const changedTag = ramp(t, 20.8, 21.4);
    const tag = L.srcTag;
    ctx.save();
    ctx.globalAlpha = 1 - changedTag;
    text("コード：変更前", tag.x, tag.y, { size: tag.size, weight: 700, color: C.muted, align: tag.align });
    ctx.globalAlpha = changedTag;
    text(tag.changed, tag.x, tag.y, { size: tag.size, weight: 700, color: C.ochreInk, align: tag.align });
    ctx.restore();

    D.files.forEach((file, i) => {
      const [x, y] = L.files[i];
      const s = fileState(D, i, t);
      // コード → 索引の橋（点線）
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = "#b3a88f";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      if (L.bridge.vertical) {
        ctx.moveTo(x + f.w, y + f.h / 2);
        ctx.lineTo(L.bridge.x, y + f.h / 2);
      } else {
        const cx = x + f.w / 2;
        ctx.moveTo(cx, y + f.h);
        ctx.lineTo(Math.min(cx, L.bridge.x + L.bridge.w - 12), L.bridge.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const dy = -6 * s.lift;
      filePath(x, y + dy, f.w, f.h);
      let fill = C.paper;
      let stroke = C.navy;
      let lw = 2;
      if (s.findK > 0) {
        fill = C.ochreLight;
        stroke = C.ochre;
        lw = mix(2, 4, s.findK);
      }
      if (s.traceK > 0) {
        fill = C.tealSoft;
        stroke = C.teal;
        lw = mix(2, 4, s.traceK);
      }
      if (s.changedK > 0) {
        fill = C.ochreSoft;
        stroke = C.ochre;
        lw = mix(2, 3.5, s.changedK);
      }
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      if (s.lift > 0) {
        ctx.save();
        ctx.globalAlpha *= s.lift * 0.6;
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.teal;
        ctx.stroke();
        ctx.restore();
      }
      // 本文の線：storage.py は変更後に実際の変更後の本文へ
      if (file.path === "fixture/storage.py") {
        codeBars(file.text, x, y + dy, f, 1 - s.changedK);
        codeBars(D.revisedStorage, x, y + dy, f, s.changedK);
      } else {
        codeBars(file.text, x, y + dy, f, 1);
      }
      if (L.bridge.vertical) {
        text(file.stem, x + 70, y + dy + f.h / 2 + 7, { size: fitSize(file.stem, f.w - 80, f.name, 700, MONO, 12), weight: 700, family: MONO });
        text(".py", x + f.w - 10, y + dy + f.h - 10, { size: f.ext, family: MONO, color: C.muted, align: "right" });
      } else {
        text(file.stem, x + f.w / 2, y + dy + f.h - 14, { size: fitSize(file.stem, f.w - 12, f.name, 700, MONO, 12), weight: 700, family: MONO, align: "center" });
        text(".py", x + f.w - 10, y + dy + f.h - 38, { size: f.ext, family: MONO, color: C.muted, align: "right" });
      }
      ctx.restore();
    });
  }

  function drawBridge(D, L, t) {
    const b = L.bridge;
    const glow = Math.max(window01(t, 5.6, 6.0, 8.4, 8.9), window01(t, 24.0, 24.4, 26.4, 27.0));
    ctx.save();
    roundRect(b.x, b.y, b.w, b.h, (b.vertical ? b.w : b.h) / 2);
    ctx.fillStyle = C.navy;
    ctx.fill();
    if (glow > 0) {
      ctx.globalAlpha = glow;
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.teal;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const manual = window01(t, 23.8, 24.2, 27.8, 28.2);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (b.vertical) {
      const draw = (chars, alpha, color) => {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        const total = chars.length * (b.label + 4);
        chars.split("").forEach((ch, i) => text(ch, cx, cy - total / 2 + (i + 0.8) * (b.label + 4), { size: b.label, weight: 700, color: C.paper, align: "center" }));
        ctx.restore();
      };
      draw(manual >= 0.5 ? "手で索引" : "索引する", 1, C.paper);
    } else {
      const drawRow = (label, alpha) => {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        const w1 = measure(label, b.label, 700);
        const w2 = measure("index_repository", b.mono, 400, MONO);
        const x0 = cx - (w1 + 16 + w2) / 2;
        text(label, x0, cy + b.label * 0.36, { size: b.label, weight: 700, color: C.paper });
        text("index_repository", x0 + w1 + 16, cy + b.mono * 0.36, { size: b.mono, family: MONO, color: "#cfe5df" });
        ctx.restore();
      };
      drawRow(manual >= 0.5 ? "手で索引" : "索引する", 1);
    }
    // 取っ手：索引するときだけ回る
    const k = L.knob;
    const turn = ramp(t, 5.8, 8.4) * 2 + ramp(t, 24.0, 25.8) * 2;
    const ang = -Math.PI / 4 + turn * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2);
    ctx.fillStyle = t >= 26.8 ? C.teal : C.ochre;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.navy;
    ctx.stroke();
    const gx = k.x + Math.cos(ang) * k.r * 0.62;
    const gy = k.y + Math.sin(ang) * k.r * 0.62;
    ctx.beginPath();
    ctx.moveTo(k.x, k.y);
    ctx.lineTo(gx, gy);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(gx, gy, 5, 0, Math.PI * 2);
    ctx.fillStyle = C.navy;
    ctx.fill();
    if (b.vertical) text("手で", k.x + k.r + 8, k.y + k.label * 0.36, { size: k.label, weight: 700 });
    else text("手で", k.x, k.y + k.r + k.label + 6, { size: k.label, weight: 700, align: "center" });
    ctx.restore();
  }

  function drawMap(D, L, t) {
    const m = L.map;
    ctx.save();
    roundRect(m.x, m.y, m.w, m.h, 28);
    ctx.fillStyle = C.map;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.mapEdge;
    ctx.stroke();
    // 方眼の点
    ctx.fillStyle = C.dot;
    for (let x = m.x + L.dots; x < m.x + m.w - 8; x += L.dots) {
      for (let y = m.y + L.dots; y < m.y + m.h - 8; y += L.dots) {
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 変更後・未更新：地図の縁を黄土の破線に
    const stale = window01(t, 21.4, 22.0, 26.6, 27.2);
    if (stale > 0) {
      ctx.globalAlpha = stale;
      roundRect(m.x, m.y, m.w, m.h, 28);
      ctx.setLineDash([12, 9]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.ochre;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // 索引から地図への3本
    ctx.strokeStyle = "#8f9bb0";
    ctx.lineWidth = 3;
    const b = L.bridge;
    for (const k of [0.2, 0.5, 0.8]) {
      ctx.beginPath();
      if (b.vertical) {
        const y = b.y + b.h * k;
        ctx.moveTo(b.x + b.w, y);
        ctx.lineTo(m.x, y);
      } else {
        const x = b.x + b.w * k;
        ctx.moveTo(x, b.y + b.h);
        ctx.lineTo(x, m.y);
      }
      ctx.stroke();
    }
    text("呼び出しの地図", L.mapTitle.x, L.mapTitle.y, { size: L.mapTitle.size, weight: 700, align: "right" });

    // 地図の版（コードの版とは別に表示）
    const indexing = window01(t, 5.0, 5.6, 8.6, 9.2);
    const staleTag = ramp(t, 21.4, 22.0);
    const afterTag = ramp(t, 26.8, 27.3);
    const tag = L.mapTag;
    const items = [
      ["地図：初回の索引", C.muted, (1 - indexing) * (1 - staleTag)],
      ["地図：初回のまま（未更新）", C.ochreInk, staleTag * (1 - afterTag)],
      ["地図：手で索引し直した後 ✓", C.tealInk, afterTag],
    ];
    for (const [label, color, alpha] of items) {
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      text(label, tag.x, tag.y, { size: tag.size, weight: 700, color });
    }
    ctx.globalAlpha = 1;
    // 描いた線と、問い合わせの全件（小さく）
    const c = L.count;
    const before = `描いた線 ${D.edgesBefore.length}本 · 全${D.counts.before}件`;
    const after = `描いた線 ${D.edgesAfter.length}本 · 全${D.counts.after}件`;
    ctx.globalAlpha = (1 - afterTag) * (1 - indexing);
    text(before, c.x, c.y, { size: c.size, color: C.muted, align: "right" });
    ctx.globalAlpha = afterTag;
    text(after, c.x, c.y, { size: c.size, color: C.muted, align: "right" });
    ctx.restore();
  }

  function edgeStyle(D, from, to, t) {
    const isNew = from === D.newEdge[0] && to === D.newEdge[1];
    let reveal;
    let alpha = 1;
    if (isNew) {
      reveal = ramp(t, 26.4, 27.2);
    } else if (t < 5) {
      reveal = ramp(t, 0.2, 1.4);
    } else if (t < 8.6) {
      reveal = 1;
      alpha = 1 - ramp(t, 5.0, 5.6);
    } else {
      reveal = ramp(t, 8.6, 9.6);
    }
    const findK = window01(t, 10, 10.6, 14.8, 15.4);
    const traceK = window01(t, 15.4, 16.2, 19.6, 20.2);
    const updK = window01(t, 20.6, 21.2, 28.0, 28.6);
    let width = 4;
    let color = C.teal;
    if (!isNew) alpha *= 1 - 0.68 * findK;
    if (from === "submit_order") {
      width = mix(4, 8, traceK);
      color = traceK > 0.5 ? C.tealInk : C.teal;
    } else if (!isNew) {
      alpha *= 1 - 0.5 * traceK;
    }
    if (!isNew) alpha *= 1 - 0.4 * updK;
    if (isNew) {
      width = 6;
      color = C.ochre;
    }
    return { reveal, alpha, width, color, traceK };
  }

  function edgeLabel(D, from, to) {
    if (from === "main") return `app.py ${D.mainCall}行`;
    if (from === "submit_order") return `${D.nodes[to].call_line}行`;
    if (from === D.newEdge[0] && to === D.newEdge[1]) return `${D.auditCall}行`;
    return "";
  }

  function drawEdges(D, L, t) {
    const all = [...D.edgesBefore];
    for (const e of D.edgesAfter) if (!all.some((x) => x[0] === e[0] && x[1] === e[1])) all.push(e);
    for (const [from, to] of all) {
      const s = edgeStyle(D, from, to, t);
      if (s.reveal <= 0 || s.alpha <= 0) continue;
      const pts = edgePoints(L, from, to);
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.strokeStyle = s.color;
      strokePartial(pts, s.reveal);
      if (s.reveal >= 0.999) arrowHead(pts, 10 + s.width * 1.4, s.color);
      const label = edgeLabel(D, from, to);
      if (label && s.reveal >= 0.999) {
        const a = rectOf(L, from);
        const z = rectOf(L, to);
        // 線の終わりに重ならないよう、線の外側に置く
        const dir = z.cx < a.cx - 1 ? -1 : 1;
        let x = z.cx + dir * 12;
        let y = z.y - 12;
        let align = dir < 0 ? "right" : "left";
        if (from === "main") {
          x = a.cx + 14;
          y = (a.y + a.h + z.y) / 2 + 6;
          align = "left";
        } else if (to === D.newEdge[1]) {
          x = a.cx - 14;
          y = (a.y + a.h + z.y) / 2 + 6;
          align = "right";
        }
        text(label, x, y, { size: L.edgeLabel * (1 + 0.15 * s.traceK), weight: 700, align, halo: 6, color: to === D.newEdge[1] ? C.ochreInk : C.navy });
      }
      ctx.restore();
    }
  }

  function nodeSolid(D, id, t) {
    if (id === "audit_receipt") return ramp(t, 26.2, 26.7);
    if (t < 5) return 1;
    const fileIndex = D.files.findIndex((f) => f.path === `fixture/${D.nodes[id].file}`);
    const land = landTime(fileIndex);
    if (t < land - 0.1) return 1 - ramp(t, 5.0, 5.6);
    return ramp(t, land - 0.1, land + 0.2);
  }

  function drawNodes(D, L, t) {
    const findK = window01(t, 10, 10.6, 14.8, 15.4);
    const traceK = window01(t, 15.2, 15.8, 19.6, 20.2);
    const updK = window01(t, 20.6, 21.2, 28.0, 28.6);
    const intro = 0.94 + 0.06 * ramp(t, 0, 0.9);
    for (const id of NODE_IDS) {
      const solid = nodeSolid(D, id, t);
      const r = rectOf(L, id);
      const size = id === "main" || id === "submit_order" ? L.nodeFont.big : id === "audit_receipt" ? L.nodeFont.small : L.nodeFont.mid;
      // 空いた枠（索引し直すあいだ）
      if (id !== "audit_receipt" && solid < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - solid;
        roundRect(r.x, r.y, r.w, r.h, 16);
        ctx.setLineDash([8, 7]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#8fb7ad";
        ctx.stroke();
        ctx.restore();
      }
      if (solid <= 0) continue;
      let alpha = solid;
      if (id !== "submit_order") alpha *= 1 - 0.66 * findK;
      if (id === "main") alpha *= 1 - 0.45 * traceK;
      if (id !== "save_receipt" && id !== "audit_receipt") alpha *= 1 - 0.4 * updK;
      const isSibling = ["validate_order", "calculate_total", "save_receipt"].includes(id);
      let fill = C.paper;
      let stroke = C.navy;
      let lw = 2.4;
      if (id === "submit_order" && findK > 0) {
        fill = C.ochreLight;
        stroke = C.ochre;
        lw = mix(2.4, 5, findK);
      }
      if ((id === "submit_order" || isSibling) && traceK > 0) {
        fill = isSibling ? C.tealSoft : fill;
        stroke = C.teal;
        lw = mix(2.4, 4.5, traceK);
      }
      if (id === "save_receipt" && updK > 0) lw = mix(2.4, 4, updK);
      if (id === "audit_receipt") {
        fill = C.ochreLight;
        stroke = C.ochre;
        lw = 3.5;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      const sc = t < 1 ? intro : 1;
      ctx.translate(r.cx, r.cy);
      ctx.scale(sc, sc);
      ctx.translate(-r.cx, -r.cy);
      roundRect(r.x, r.y, r.w, r.h, 16);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      const role = D.nodes[id].label;
      text(role, r.cx, r.cy - size[1] * 0.18, { size: fitSize(role, r.w - 20, size[0], 700, SANS, 14), weight: 700, align: "center" });
      text(id, r.cx, r.cy + size[0] * 0.62 + 2, { size: fitSize(id, r.w - 18, size[1], 400, MONO, 10), family: MONO, color: C.muted, align: "center" });
      ctx.restore();
    }
  }

  // 索引する：各ファイルから写しのカードが橋を渡り、地図の関数カードになる
  function drawIndexCards(D, L, t) {
    if (t < T.landStart || t > landTime(D.files.length - 1) + 0.3) return;
    const f = L.file;
    const b = L.bridge;
    D.files.forEach((file, i) => {
      const start = T.landStart + i * T.landStep;
      const mid = start + 0.7;
      const end = start + T.landTravel;
      if (t <= start || t >= end + 0.2) return;
      const id = NODE_IDS.find((n) => n !== "audit_receipt" && `fixture/${D.nodes[n].file}` === file.path);
      const r = rectOf(L, id);
      const [fx, fy] = L.files[i];
      const from = [fx + f.w / 2, fy + f.h / 2];
      const via = b.vertical ? [b.x + b.w / 2, from[1]] : [Math.min(from[0], b.x + b.w - 30), b.y + b.h / 2];
      const k1 = ramp(t, start, mid);
      const k2 = ramp(t, mid, end);
      const x = t < mid ? mix(from[0], via[0], k1) : mix(via[0], r.cx, k2);
      const y = t < mid ? mix(from[1], via[1], k1) : mix(via[1], r.cy, k2);
      const w = t < mid ? mix(f.w * 0.6, f.w * 0.5, k1) : mix(f.w * 0.5, r.w, k2);
      const h = t < mid ? mix(f.h * 0.5, f.h * 0.4, k1) : mix(f.h * 0.4, r.h, k2);
      const fade = 1 - ramp(t, end, end + 0.2);
      ctx.save();
      ctx.globalAlpha = fade;
      roundRect(x - w / 2, y - h / 2, w, h, 10);
      ctx.fillStyle = C.paper;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.teal;
      ctx.stroke();
      if (k2 > 0.4) {
        ctx.globalAlpha = fade * ramp(k2, 0.4, 1);
        text(D.nodes[id].label, x, y + 6, { size: fitSize(D.nodes[id].label, w - 16, L.nodeFont.mid[0], 700, SANS, 10), weight: 700, align: "center" });
      }
      ctx.restore();
    });
  }

  // 探す：submit_order の定義（service.py 8 行目）
  function drawFind(D, L, t) {
    const a = window01(t, 10.5, 11.2, 14.6, 15.2);
    if (a <= 0) return;
    const c = L.callout;
    const svcIndex = D.files.findIndex((f) => f.path === `fixture/${D.serviceFile}`);
    const [fx, fy] = L.files[svcIndex];
    ctx.save();
    ctx.globalAlpha = a;
    // ファイルに行番号の札
    const badge = `${D.defLine}行目`;
    pill(fx + L.file.w - 10, fy - 14, badge, { size: L.fileBadge, fill: C.ochre, color: "#fff", h: L.fileBadge * 1.7 });
    // 吹き出し
    roundRect(c.x, c.y, c.w, c.h, 16);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ochre;
    ctx.stroke();
    if (c.pointer !== null) {
      ctx.beginPath();
      ctx.moveTo(c.pointer - 16, c.y + 1);
      ctx.lineTo(c.pointer, c.y - 12);
      ctx.lineTo(c.pointer + 16, c.y + 1);
      ctx.closePath();
      ctx.fillStyle = C.ochre;
      ctx.fill();
    }
    const head = `${D.serviceFile} · ${D.span.replace("-", "–")}行`;
    text(head, c.x + 20, c.y + 18 + c.head, { size: c.head, weight: 700, color: C.ochreInk });
    text("実ソースと一致", c.x + c.w - 20, c.y + 18 + c.head, { size: c.head * 0.85, weight: 700, color: C.tealInk, align: "right" });
    // 実ソースの定義行（fixture-data.json の本文から）
    const codeY = c.y + c.h - 24;
    roundRect(c.x + 12, codeY - c.code - 6, c.w - 24, c.code + 18, 8);
    ctx.fillStyle = C.ochreSoft;
    ctx.fill();
    const number = c.pointer !== null ? `${D.defLine}  ` : "";
    const codeSize = fitSize(number + D.defText, c.w - 48, c.code, 400, MONO, 10);
    if (number) text(number, c.x + 24, codeY, { size: codeSize, family: MONO, color: C.muted });
    text(D.defText, c.x + 24 + (number ? measure(number, codeSize, 400, MONO) : 0), codeY, { size: codeSize, family: MONO, weight: 700 });
    // 地図のカードとつなぐ
    const pinK = ramp(t, 11.0, 12.0);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = C.ochre;
    ctx.setLineDash([9, 7]);
    const tip = strokePartial(L.pin, pinK);
    ctx.setLineDash([]);
    if (tip && pinK > 0.98) {
      ctx.beginPath();
      ctx.arc(L.pin[L.pin.length - 1][0], L.pin[L.pin.length - 1][1], 7, 0, Math.PI * 2);
      ctx.fillStyle = C.ochre;
      ctx.fill();
    }
    ctx.restore();
  }

  // たどる：同じ関数から並んだ3本（順番ではない）
  function drawTraceBracket(D, L, t) {
    const a = window01(t, 16.2, 17.0, 19.4, 20.0);
    if (a <= 0) return;
    const b = L.bracket;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = C.tealInk;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y - 12);
    ctx.lineTo(b.x1, b.y);
    ctx.lineTo(b.x2, b.y);
    ctx.lineTo(b.x2, b.y - 12);
    ctx.stroke();
    const n = D.edgesBefore.filter((e) => e[0] === "submit_order").length;
    pill((b.x1 + b.x2) / 2, b.y + 8, `同じ関数から ${n}本 · 順番ではない`, { size: b.label, fill: C.tealInk, color: "#fff" });
    ctx.restore();
  }

  // 変更の印：変更した storage.py の写しが、手で回す索引を渡って地図のカードになる
  function drawSheet(D, L, t) {
    if (t < 20.2) return;
    const s = L.sheet;
    const target = rectOf(L, D.newEdge[1]);
    const drop = ramp(t, 20.2, 21.0);
    const leg1 = ramp(t, 24.4, 25.3);
    const leg2 = ramp(t, 25.3, 26.4);
    let x;
    let y;
    let w = s.w;
    let h = s.h;
    let rot = s.stale[2];
    let alpha = drop;
    if (t < 24.4) {
      x = s.stale[0];
      y = s.stale[1] - 50 * (1 - drop);
    } else if (t < 25.3) {
      x = mix(s.stale[0], s.bridge[0], leg1);
      y = mix(s.stale[1], s.bridge[1], leg1);
      rot = mix(s.stale[2], 0, leg1);
    } else {
      x = mix(s.bridge[0], target.x, leg2);
      y = mix(s.bridge[1], target.y, leg2);
      w = mix(s.w, target.w, leg2);
      h = mix(s.h, target.h, leg2);
      rot = 0;
      alpha = 1 - ramp(t, 26.3, 26.7);
    }
    if (alpha <= 0) return;

    // 未反映：橋の手前で止まっている
    const stop = window01(t, 22.0, 22.8, 24.0, 24.4);
    if (stop > 0) {
      ctx.save();
      ctx.globalAlpha = stop;
      ctx.strokeStyle = C.ochre;
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(L.stopLine[0][0], L.stopLine[0][1]);
      ctx.lineTo(L.stopLine[1][0], L.stopLine[1][1]);
      ctx.stroke();
      ctx.setLineDash([]);
      const p = L.stopPill;
      roundRect(p.x, p.y, p.w, p.h, p.h / 2);
      ctx.fillStyle = C.paper;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.ochre;
      ctx.stroke();
      text("未反映", p.x + p.w / 2, p.y + p.h / 2 + p.size * 0.36, { size: p.size, weight: 700, color: C.ochreInk, align: "center" });
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rot * Math.PI) / 180);
    roundRect(-w / 2, -h / 2, w, h, 10);
    ctx.fillStyle = C.ochreSoft;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ochre;
    ctx.stroke();
    // 紙の折り目
    ctx.beginPath();
    ctx.moveTo(w / 2 - 18, -h / 2);
    ctx.lineTo(w / 2, -h / 2 + 18);
    ctx.stroke();
    const textK = 1 - ramp(t, 25.6, 26.2);
    ctx.globalAlpha = alpha * textK;
    const fn = `+ ${D.newEdge[1]}`;
    text(fn, 0, -h / 2 + s.fn + 8, { size: fitSize(fn, w - 20, s.fn, 700, MONO, 10), weight: 700, family: MONO, color: "#5f3b00", align: "center" });
    text(`${D.auditCall}行に追加`, 0, h / 2 - 12, { size: s.sub, weight: 700, color: "#5f3b00", align: "center" });
    ctx.restore();
  }

  // 保存先：実際の記録（CLIの応答）と、別の実行（Python）は別の箱
  function drawTray(D, L, t) {
    const tr = L.tray;
    const idx = sceneAt(D, t);
    const op = D.scenes[idx].operation;
    const finish = ramp(t, 28.0, 29.3);
    ctx.save();
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(L.trayLink[0][0], L.trayLink[0][1]);
    ctx.lineTo(L.trayLink[1][0], L.trayLink[1][1]);
    ctx.stroke();
    ctx.setLineDash([]);
    roundRect(tr.x, tr.y, tr.w, tr.h, 14);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.lineWidth = mix(2, 4, finish);
    ctx.strokeStyle = finish > 0 ? C.teal : C.navy;
    ctx.stroke();
    // 書類のアイコン（終盤は地図から記録が届く）
    const iconW = tr.h * 0.42;
    const iconH = tr.h * 0.56;
    const ix = tr.x + 16;
    const iy = tr.y + (tr.h - iconH) / 2;
    const from = L.recordFrom;
    const travel = window01(t, 28.0, 28.1, 29.2, 29.3);
    if (travel > 0 && t < 29.3) {
      const k = ramp(t, 28.0, 29.2);
      const dx = mix(from[0], ix, k);
      const dy = mix(from[1], iy, k);
      filePath(dx, dy, iconW, iconH);
      ctx.fillStyle = C.tealSoft;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.teal;
      ctx.stroke();
    }
    filePath(ix, iy, iconW, iconH);
    ctx.fillStyle = t >= 29.2 ? C.tealSoft : C.paper;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.teal;
    ctx.stroke();
    const tx = ix + iconW + 14;
    const titleY = tr.y + tr.h / 2 - 4;
    text(finish > 0.5 ? "実際の記録を保存" : "実際の記録（保存済み）", tx, titleY, { size: tr.title, weight: 700 });
    const name = D.recordFor(op);
    text(name, tx, titleY + tr.name + 8, { size: fitSize(name, tr.x + tr.w - tx - 12, tr.name, 400, MONO, 9), family: MONO, color: C.tealInk });
    if (L === WIDE) text(`公式CLI ${D.calls}回の応答（${D.cliDate}）`, tx, titleY + tr.name * 2 + 18, { size: 13, color: C.muted });
    ctx.restore();

    // 別の実行：架空の注文を Python で動かした領収と監査（索引の線とは別）
    const slipK = ramp(t, 28.6, 29.4);
    if (slipK <= 0) return;
    const sl = L.slip;
    ctx.save();
    ctx.globalAlpha = slipK;
    roundRect(sl.x, sl.y, sl.w, sl.h, 12);
    ctx.fillStyle = "#fffaf0";
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ochre;
    ctx.stroke();
    ctx.setLineDash([]);
    text("別の実行（Python）", sl.x + 14, sl.y + sl.title + 10, { size: sl.title, weight: 700, color: C.ochreInk });
    text("索引とは別", sl.x + sl.w - 12, sl.y + sl.title + 10, { size: Math.round(sl.title * 0.75), weight: 700, color: C.muted, align: "right" });
    const total = `${D.total.toLocaleString("ja-JP")}円`;
    const body = sl.long
      ? `架空の注文 ${D.order.seat_count}席×${D.order.seat_price_jpy.toLocaleString("ja-JP")}円 → 領収 ${total} · 監査一致`
      : `領収 ${total} · 監査一致`;
    text(body, sl.x + 14, sl.y + sl.h - 14, { size: fitSize(body, sl.w - 28, sl.body, 400, SANS, 10) });
    ctx.restore();
  }

  function drawFooter(D, L, t) {
    const d = L.disclaimer;
    pill(d.cx, d.y, "線＝静的な呼び出し · 実行の流れではない", { size: d.size, fill: C.navy, color: C.paper, h: d.h });
    const f = L.footer;
    text(`保存済みの実行結果から描画 · 架空の注文 · 無音 · codebase-memory-mcp ${D.version}（${D.commitShort}）`, f.cx, f.y, { size: fitSize(`保存済みの実行結果から描画 · 架空の注文 · 無音 · codebase-memory-mcp ${D.version}（${D.commitShort}）`, L.base[0] - 64, f.size, 400, SANS, 9), color: C.muted, align: "center" });
  }

  /* ---------- 1フレーム ---------- */

  let DATA = null;
  let failed = false;

  function draw(t) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, W, H);
    const L = H > W ? PORTRAIT : WIDE;
    const [bw, bh] = L.base;
    const s = Math.min(W / bw, H / bh);
    ctx.translate((W - bw * s) / 2, (H - bh * s) / 2);
    ctx.scale(s, s);
    drawHeader(DATA, L, t);
    drawMap(DATA, L, t);
    drawFiles(DATA, L, t);
    drawBridge(DATA, L, t);
    drawEdges(DATA, L, t);
    drawNodes(DATA, L, t);
    drawIndexCards(DATA, L, t);
    drawTraceBracket(DATA, L, t);
    drawFind(DATA, L, t);
    drawSheet(DATA, L, t);
    drawTray(DATA, L, t);
    drawFooter(DATA, L, t);
    ctx.restore();
  }

  const clampTime = (seconds) => {
    const v = Number(seconds);
    if (!Number.isFinite(v)) return 0;
    return v < 0 ? 0 : v > DURATION ? DURATION : v;
  };

  window.seek = (seconds) => {
    const t = clampTime(seconds);
    if (failed) return window.motionReady;
    if (!DATA) return window.motionReady.then(() => window.seek(t));
    draw(t);
    if (!RENDER) setPosition(t);
    return Promise.resolve();
  };

  /* ---------- プレビュー（書き出し時は動かさない） ---------- */

  const ui = {
    status: document.getElementById("status"),
    play: document.getElementById("play"),
    reset: document.getElementById("reset"),
    end: document.getElementById("end"),
    replay: document.getElementById("replay"),
    scrub: document.getElementById("scrub"),
    time: document.getElementById("time"),
    scenes: document.getElementById("scenes"),
    portrait: document.getElementById("size-portrait"),
    wide: document.getElementById("size-wide"),
    note: document.getElementById("motion-note"),
    error: document.getElementById("film-error"),
    errorText: document.getElementById("film-error-text"),
    retry: document.getElementById("film-retry"),
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let current = 0;
  let playing = false;
  let raf = 0;
  let playFromWall = 0;
  let playFromTime = 0;

  function setPosition(t) {
    current = t;
    ui.scrub.value = String(t);
    ui.time.textContent = `${t.toFixed(2)} / ${DURATION.toFixed(2)} 秒`;
    if (DATA) {
      const idx = sceneAt(DATA, t);
      for (const button of ui.scenes.querySelectorAll("button")) button.setAttribute("aria-current", String(Number(button.dataset.index) === idx));
    }
  }

  function setPlaying(on) {
    playing = on;
    ui.play.textContent = on ? "一時停止" : "再生";
    ui.play.setAttribute("aria-pressed", String(on));
    if (!on && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function frame(now) {
    raf = 0;
    if (!playing) return;
    let t = playFromTime + (now - playFromWall) / 1000;
    if (t >= DURATION) {
      t = DURATION;
      setPlaying(false);
    }
    window.seek(t);
    if (playing) raf = requestAnimationFrame(frame);
  }

  function play() {
    if (RENDER || !DATA) return;
    if (current >= DURATION) current = 0;
    playFromTime = current;
    playFromWall = performance.now();
    setPlaying(true);
    raf = requestAnimationFrame(frame);
  }

  function setSize(wide) {
    if (RENDER) return;
    W = wide ? 1280 : 720;
    H = wide ? 720 : 1280;
    window.motionConfig.width = W;
    window.motionConfig.height = H;
    sizeCanvas();
    ui.portrait.setAttribute("aria-pressed", String(!wide));
    ui.wide.setAttribute("aria-pressed", String(wide));
    if (DATA) window.seek(current);
  }

  function enableControls(on) {
    for (const el of [ui.play, ui.reset, ui.end, ui.replay, ui.scrub, ui.portrait, ui.wide, ...ui.scenes.querySelectorAll("button")]) el.disabled = !on;
  }

  function buildSceneButtons(D) {
    ui.scenes.replaceChildren(
      ...D.scenes.map((scene, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn";
        button.dataset.index = String(i);
        button.append(`${i + 1}. ${SCENE_NAMES[scene.id]}`);
        const small = document.createElement("small");
        small.textContent = `${scene.in}–${scene.out}秒`;
        button.append(small);
        button.addEventListener("click", () => {
          setPlaying(false);
          // 動きを減らす設定では、場面の完成した状態を表示する
          const target = reduceMotion.matches ? Math.min(scene.out - 0.1, DURATION) : scene.in;
          window.seek(target);
        });
        return button;
      }),
    );
  }

  if (!RENDER) {
    ui.play.addEventListener("click", () => (playing ? setPlaying(false) : play()));
    ui.reset.addEventListener("click", () => {
      setPlaying(false);
      window.seek(0);
    });
    ui.end.addEventListener("click", () => {
      setPlaying(false);
      window.seek(DURATION);
    });
    ui.replay.addEventListener("click", () => {
      setPlaying(false);
      window.seek(0);
      play();
    });
    ui.scrub.addEventListener("input", () => {
      setPlaying(false);
      window.seek(Number(ui.scrub.value));
    });
    ui.portrait.addEventListener("click", () => setSize(false));
    ui.wide.addEventListener("click", () => setSize(true));
    ui.retry.addEventListener("click", () => location.reload());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && playing) setPlaying(false);
    });
    if (reduceMotion.matches) ui.note.textContent = "動きを減らす設定です。自動では再生しません。場面ボタンは各場面の完成した状態を表示します。音声・ナレーション・音声トラックはありません。";
    ui.portrait.setAttribute("aria-pressed", String(H > W));
    ui.wide.setAttribute("aria-pressed", String(!(H > W)));
  }

  function fail(error) {
    failed = true;
    DATA = null;
    setPlaying(false);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    enableControls(false);
    const message = error instanceof AssetError ? error.message : `素材の読み込み中に問題が起きました（${error && error.message ? error.message : String(error)}）。`;
    ui.error.hidden = false;
    ui.errorText.textContent = message;
    ui.status.className = "status is-error";
    ui.status.textContent = "描画できません。素材を確かめられませんでした。";
    rejectReady(error instanceof Error ? error : new Error(String(error)));
  }

  enableControls(false);
  loadAssets()
    .then(async (D) => {
      if (document.fonts) {
        await Promise.all([
          document.fonts.load(`700 46px ${SERIF}`, "コードのつながりを、地図に。"),
          document.fonts.load(`700 24px ${SANS}`, "呼び出しの地図"),
          document.fonts.load(`400 18px ${MONO}`, "submit_order"),
        ]).catch(() => []);
        await document.fonts.ready;
      }
      DATA = D;
      if (!RENDER) {
        buildSceneButtons(D);
        enableControls(true);
        ui.status.className = "status";
        ui.status.textContent = `準備完了：7つの素材の長さと SHA-256 を確認し、保存済みの実行結果から描画しています（無音）。`;
      }
      draw(0);
      if (!RENDER) setPosition(0);
      resolveReady();
    })
    .catch(fail);
})();
