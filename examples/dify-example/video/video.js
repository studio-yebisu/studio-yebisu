/*
 * Studio Yebisu — Dify 作例・動く概念図（32秒・無音）
 * Copyright (c) 2026 Studio Yebisu. MIT License. Diagram and film authored by Claude Opus 5.5.
 *
 * One connected drawing: an inquiry envelope carrying three routing values (bill / bolt / people)
 * → one ordered route switch (1 至急 / 100人以上 → 2 請求 → ほか) → three owner desks → まとめる →
 * the handoff memo. The same envelope travels along the edges the engine actually took, passes
 * through the rule and the desk it actually reached, and unfolds into the memo text the engine
 * actually returned. Every ID, value, rule mark, edge, count and memo line is read from the saved
 * original run (assets/workflow-runs.json) after the manifest and all eight assets match their
 * pinned SHA-256 and byte counts. No audio, no live execution, no fallback data.
 */
(() => {
  "use strict";

  // --- Composition contract -------------------------------------------------------------------

  const RENDER = window.__MOTION_RENDER__ === true;
  const requested = window.renderConfig && typeof window.renderConfig === "object" ? window.renderConfig : {};
  const positiveInt = (value, fallback) => (Number.isInteger(value) && value > 0 ? value : fallback);
  const WIDE_PREVIEW = !RENDER && new URLSearchParams(location.search).get("layout") === "wide";
  const W = positiveInt(requested.width, WIDE_PREVIEW ? 1280 : 720);
  const H = positiveInt(requested.height, WIDE_PREVIEW ? 720 : 1280);
  const FPS = positiveInt(requested.fps, 30);
  const DURATION = 32;
  const POSTER_TIME = 31;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: [] };

  // --- Frozen expectations --------------------------------------------------------------------

  const MANIFEST = {
    path: "assets/manifest.json",
    sha256: "10392562045e5c71ad4ed9154fa823c0d3eeed4378a2033ca70001b4fe097559",
    format: "studio-yebisu-visual-assets-v1",
  };
  // Same order and values as the manifest. Paths are relative to video/assets/.
  const PROJECTION = "faithful diagram/timeline projection of original actual records";
  const ASSETS = [
    { file: "workflow-runs.json", sha256: "692cc2f8b07ca77a8b3ccdae0a8abc4359e8a8804985bc4b75db1b56241e6694", bytes: 223288, source: "outputs/workflow-runs.json" },
    { file: "tickets.json", sha256: "b752f26d73d9fc3f48f8a3389fe876b88d273f2780bc316fdd15232a4d0cdc83", bytes: 3036, source: "input/tickets.json" },
    { file: "expected.json", sha256: "0ef127da5302698a91ad9ceb1e7dcbd79863c037057fe07e514428213946b5be", bytes: 325, source: "input/expected.json" },
    { file: "independent-checks.json", sha256: "efc466ec2dbd4845a35277225faf419e471872892d08d747130248973f25d2f4", bytes: 9251, source: "outputs/independent-checks.json" },
    { file: "vendor-lock.json", sha256: "e454e2189985857c0ac82258dc23b01f0010deecc1cc7bf737ff214d685696ff", bytes: 59279, source: "vendor-lock.json" },
    { file: "workflow.yml", sha256: "d36f345c08705992f654571d35676a211bcae62abcfb6171c8655b308ab0776f", bytes: 11662, source: "workflow.yml" },
    { file: "diagram-data.json", sha256: "971c00ea65059192ca72cf3aacf126a505c88fd4d7d5bbce2a40afb6c3114de7", bytes: 8606, source: PROJECTION },
    { file: "timeline.json", sha256: "735073a65b9ebe6e74254ca62b286c05cc0ef866c0f1c40aca232a5130c4a0dc", bytes: 2208, source: PROJECTION },
  ];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.file, a.sha256]));
  const PIN = {
    format: "studio-yebisu-dify-run-v1",
    repository: "langgenius/dify",
    commit: "f77facfe6520ed379d723288aed0b4806ad76143",
    version: "1.17.1",
    graphonName: "graphon",
    graphonVersion: "0.7.0",
    wheelSha256: "6f7608aaaa65607c4935735137ed4b7029b1e6ca80202cbe829af3370cf4404e",
    lockFiles: 292,
    checks: 196,
    events: 160,
    ids: ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08"],
    nodes: ["start", "route", "urgent-note", "billing-note", "support-note", "merge", "end"],
    nodeTypes: ["start", "if-else", "template-transform", "template-transform", "template-transform", "variable-aggregator", "end"],
    edges: [
      ["start", "route", "source"],
      ["route", "urgent-note", "urgent"],
      ["route", "billing-note", "billing"],
      ["route", "support-note", "false"],
      ["urgent-note", "merge", "source"],
      ["billing-note", "merge", "source"],
      ["support-note", "merge", "source"],
      ["merge", "end", "source"],
    ],
    counts: { urgent: 3, billing: 1, false: 4 },
    timelineFormat: "studio-yebisu-dify-visual-timeline-v1",
    diagramFormat: "studio-yebisu-dify-visual-facts-v1",
  };
  const ROUTES = ["urgent", "billing", "false"];
  const ROUTE_LABEL = { urgent: "優先対応", billing: "請求窓口", false: "通常窓口" };
  const MEMO_NODE = { urgent: "urgent-note", billing: "billing-note", false: "support-note" };
  const SLOT_OF = { urgent: 0, billing: 1, false: 2 };
  // Short rule labels drawn inside the one route switch. Checked against diagram-data.json and the DSL.
  const RULE_LINES = [["至急", "100人以上"], ["請求"], ["ほか"]];
  // Scene timing is fixed in timeline.json; `read` is where the scene buttons land.
  const SCENE_PLAN = [
    { id: "overview", in: 0, out: 5, case: "D02", read: 4.6 },
    { id: "billing", in: 5, out: 10, case: "D02", read: 9.6 },
    { id: "priority", in: 10, out: 15, case: "D06", read: 14.6 },
    { id: "boundary", in: 15, out: 22, case: "D04", compare: "D05", read: 21.6 },
    { id: "literal", in: 22, out: 27, case: "D07", read: 26.6 },
    { id: "finish", in: 27, out: 32, case: "D05", read: 31 },
  ];
  const FILE_MESSAGE = "このページをファイルとして直接開くと、素材を読み込んで照合できません。作例のフォルダー（index.html のある場所）で python -m http.server を実行し、http://localhost:8000/video/ を開いてください。";

  // --- Page ------------------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const ui = {
    editor: $("editor"),
    count: $("asset-count"),
    status: $("status"),
    errorBox: $("error"),
    errorText: $("error-text"),
    retry: $("retry"),
    stage: $("stage"),
    canvas: $("film"),
    play: $("play"),
    reset: $("reset"),
    time: $("time"),
    clock: $("clock"),
    sceneList: $("scene-list"),
    assetList: $("asset-list"),
    layoutTall: $("layout-tall"),
    layoutWide: $("layout-wide"),
  };
  for (const [name, node] of Object.entries(ui)) {
    if (!node) throw new Error(`video/index.html に必要な要素がありません：${name}`);
  }

  if (RENDER) {
    document.documentElement.classList.add("is-render");
    ui.canvas.style.width = `${W}px`;
    ui.canvas.style.height = `${H}px`;
  } else {
    ui.canvas.style.aspectRatio = `${W} / ${H}`;
    ui.stage.classList.toggle("is-tall", H >= W);
    (H >= W ? ui.layoutTall : ui.layoutWide).setAttribute("aria-current", "page");
  }
  ui.canvas.width = W;
  ui.canvas.height = H;
  ui.time.max = String(DURATION);
  const ctx = ui.canvas.getContext("2d");

  // --- Layouts (authored natively for each orientation) ------------------------------------

  function portraitLayout() {
    const slots = [{ x: 30, y: 446, w: 272, h: 212 }, { x: 314, y: 446, w: 182, h: 212 }, { x: 508, y: 446, w: 182, h: 212 }];
    const desks = slots.map((s) => ({ x: s.x, y: 720, w: s.w, h: 160 }));
    const cx = slots.map((s) => s.x + s.w / 2);
    const laneY = 410;
    const deskEdge = (i) => [[cx[i], 880], [cx[i], 906], [360, 906], [360, 920]];
    return {
      DW: 720, DH: 1280, tall: true,
      eyebrow: { x: 48, y: 70, size: 26, max: 624 },
      headline: { x: 48, y: 140, size: 52, min: 40, max: 624 },
      home: { x: 40, y: 180, w: 640, h: 170 },
      env: {
        flap: 42, idX: 24, idY: 74, idSize: 34, ticketSize: 28,
        stamps: [0, 1, 2].map((i) => ({ x: 24 + i * 204, y: 92, w: 188, h: 66 })), icon: 38, value: 40,
        literal: { x: 616, y: 58, size: 30, align: "right" },
        placeholder: 34,
      },
      frame: { x: 20, y: 368, w: 680, h: 300 },
      // Portrait has no frame tag: the envelope (and D07's literal) travel along the top border.
      framePill: null,
      lane: cx.map((x) => [x, laneY]),
      slots, desks,
      slotText: { size: 42, lines0: [104, 156], single: 132, cmp: 196, cmpSize: 28, numR: 20, numSize: 24, numDx: 32, numDy: 36, markDx: -32, textDx: 20 },
      // Count tags sit on the desk's top border, clear of the person and of the incoming line.
      deskText: { size: 42, label: 146, head: 40, headR: 19, bar: 92, count: 22, countCy: 0 },
      edges: {
        "start>route": [[cx[0], 350], [cx[0], laneY]],
        "route>urgent-note": [[cx[0], 658], [cx[0], 720]],
        "route>billing-note": [[cx[1], 658], [cx[1], 720]],
        "route>support-note": [[cx[2], 658], [cx[2], 720]],
        "urgent-note>merge": deskEdge(0),
        "billing-note>merge": deskEdge(1),
        "support-note>merge": deskEdge(2),
        "merge>end": [[360, 956], [360, 986]],
      },
      deskExit: cx.map((x) => [x, 880]),
      merge: { x: 360, y: 938, r: 18, label: { x: 390, y: 947, size: 24 } },
      memo: { x: 48, y: 986, w: 624, h: 160 },
      halves: [{ x: 48, y: 986, w: 304, h: 160 }, { x: 368, y: 986, w: 304, h: 160 }],
      memoPlaceholder: 32,
      token: { w: 104, h: 60 },
      cta: { cx: 360, cy: 1188, w: 600, h: 54, size: 30 },
      foot: { x: 48, ys: [1242, 1268], size: 20, min: 15, max: 624 },
    };
  }

  function landscapeLayout() {
    const slots = [{ x: 396, y: 142, w: 234, h: 206 }, { x: 396, y: 358, w: 234, h: 116 }, { x: 396, y: 484, w: 234, h: 108 }];
    const desks = slots.map((s) => ({ x: 668, y: s.y, w: 252, h: s.h }));
    const cy = slots.map((s) => s.y + s.h / 2);
    const laneX = 358;
    const deskEdge = (i) => [[920, cy[i]], [946, cy[i]], [946, 372]];
    return {
      DW: 1280, DH: 720, tall: false,
      eyebrow: { x: 32, y: 46, size: 22, max: 1216 },
      headline: { x: 32, y: 100, size: 44, min: 34, max: 1216 },
      home: { x: 32, y: 132, w: 268, h: 470 },
      env: {
        flap: 44, idX: 20, idY: 84, idSize: 30, ticketSize: 24,
        stamps: [0, 1, 2].map((i) => ({ x: 16, y: 118 + i * 96, w: 236, h: 76 })), icon: 38, value: 38,
        literal: { x: 20, y: 432, size: 28, align: "left" },
        placeholder: 30,
      },
      frame: { x: 324, y: 132, w: 316, h: 470 },
      framePill: { x: 340, y: 132, size: 20, align: "left" },
      lane: cy.map((y) => [laneX, y]),
      slots, desks,
      slotText: { size: 36, lines0: [92, 140], single: null, cmp: 184, cmpSize: 24, numR: 16, numSize: 20, numDx: 26, numDy: 28, markDx: -26, textDx: 20 },
      deskText: { size: 36, label: 13, head: -14, headR: 17, bar: 24, count: 20, countCy: 24 },
      edges: {
        "start>route": [[300, cy[0]], [laneX, cy[0]]],
        "route>urgent-note": [[630, cy[0]], [668, cy[0]]],
        "route>billing-note": [[630, cy[1]], [668, cy[1]]],
        "route>support-note": [[630, cy[2]], [668, cy[2]]],
        "urgent-note>merge": deskEdge(0),
        "billing-note>merge": deskEdge(1),
        "support-note>merge": deskEdge(2),
        "merge>end": [[978, 372], [1000, 372]],
      },
      deskExit: cy.map((y) => [920, y]),
      merge: { x: 962, y: 372, r: 16, label: null },
      memo: { x: 1000, y: 150, w: 256, h: 440 },
      halves: [{ x: 1000, y: 150, w: 256, h: 214 }, { x: 1000, y: 376, w: 256, h: 214 }],
      memoPlaceholder: 26,
      token: { w: 64, h: 44 },
      cta: { cx: 640, cy: 646, w: 440, h: 48, size: 26 },
      foot: { x: 32, ys: [704], size: 16, min: 13, max: 1216 },
    };
  }

  const L = H >= W ? portraitLayout() : landscapeLayout();
  const S = Math.min(W / L.DW, H / L.DH);
  const OX = (W - L.DW * S) / 2;
  const OY = (H - L.DH * S) / 2;

  // --- Loading and checks ---------------------------------------------------------------------

  class CheckError extends Error {}
  function check(condition, message) {
    if (!condition) throw new CheckError(message);
  }
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    if (isObject(a) && isObject(b)) {
      const ka = Object.keys(a), kb = Object.keys(b);
      return ka.length === kb.length && ka.every((k) => own(b, k) && deepEqual(a[k], b[k]));
    }
    return false;
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function fetchBytes(path) {
    let response;
    try {
      response = await fetch(path, { cache: "no-store" });
    } catch {
      throw new CheckError(location.protocol === "file:" ? FILE_MESSAGE : `${path} を読み込めませんでした（通信できませんでした）。`);
    }
    if (!response.ok) throw new CheckError(`${path} を読み込めませんでした（HTTP ${response.status}）。`);
    return new Uint8Array(await response.arrayBuffer());
  }

  function decodeText(bytes, name) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new CheckError(`${name} が UTF-8 の文字として読めません。`);
    }
  }

  function parseJson(bytes, name) {
    const text = decodeText(bytes, name);
    try {
      return JSON.parse(text);
    } catch {
      throw new CheckError(`${name} が正しい JSON ではありません。`);
    }
  }

  const assetState = new Map();

  async function loadAssets() {
    if (location.protocol === "file:") throw new CheckError(FILE_MESSAGE);
    if (!globalThis.crypto?.subtle) throw new CheckError("このブラウザーでは SHA-256 を計算できないため、素材を確かめられません。https または localhost で開いてください。");
    const manifestBytes = await fetchBytes(MANIFEST.path);
    check(await sha256Hex(manifestBytes) === MANIFEST.sha256, "assets/manifest.json の SHA-256 が固定値と一致しません。");
    const manifest = parseJson(manifestBytes, MANIFEST.path);
    check(isObject(manifest) && manifest.format === MANIFEST.format && deepEqual(manifest.assets, ASSETS), "assets/manifest.json の素材一覧が固定値と一致しません。");
    const data = {};
    await Promise.all(ASSETS.map(async (asset) => {
      const path = `assets/${asset.file}`;
      try {
        const bytes = await fetchBytes(path);
        check(bytes.byteLength === asset.bytes, `${path} のバイト数が manifest と一致しません。`);
        check(await sha256Hex(bytes) === asset.sha256, `${path} の SHA-256 が manifest と一致しません。`);
        data[asset.file] = asset.file.endsWith(".json") ? parseJson(bytes, path) : decodeText(bytes, path);
        assetState.set(asset.file, "ok");
      } catch (error) {
        assetState.set(asset.file, "bad");
        throw error;
      } finally {
        showAssets();
      }
    }));
    return data;
  }

  const edgeKey = (e) => `${e[0]}>${e[1]}>${e[2]}`;
  const pathEdges = (route) => [
    ["start", "route", "source"],
    ["route", MEMO_NODE[route], route],
    [MEMO_NODE[route], "merge", "source"],
    ["merge", "end", "source"],
  ];

  // Reads the original DSL bytes as text; no YAML parser is needed for these fixed facts.
  function dslFacts(text) {
    const src = text.replace(/\r\n/g, "\n");
    check(/^kind: app$/m.test(src) && /^version: 0\.3\.0$/m.test(src) && /^  mode: workflow$/m.test(src), "workflow.yml が kind: app・version 0.3.0・mode: workflow ではありません。");
    const edgesAt = src.indexOf("\n    edges:\n");
    const nodesAt = src.indexOf("\n    nodes:\n");
    const viewAt = src.indexOf("\n    viewport:\n");
    check(edgesAt > 0 && nodesAt > edgesAt && viewAt > nodesAt, "workflow.yml のグラフの区切りが読めません。");
    const edgePart = src.slice(edgesAt, nodesAt);
    const nodePart = src.slice(nodesAt, viewAt);
    const unquote = (v) => v.replace(/^'(.*)'$/, "$1");
    const edges = [...edgePart.matchAll(/^      source: (\S+)\n      sourceHandle: (\S+)\n      target: (\S+)$/gm)]
      .map((m) => [m[1], m[3], unquote(m[2])]);
    const nodes = [...nodePart.matchAll(/^      id: (\S+)$/gm)].map((m) => m[1]);
    const types = [...nodePart.matchAll(/^        type: (\S+)$/gm)].map((m) => m[1]);
    const cases = [...nodePart.matchAll(/^        - case_id: (\S+)$/gm)].map((m) => m[1]);
    check(deepEqual(nodes, PIN.nodes) && deepEqual(types, PIN.nodeTypes), "workflow.yml の7ノードの ID・種類が固定値と一致しません。");
    check(deepEqual(edges.map(edgeKey).sort(), PIN.edges.map(edgeKey).sort()), "workflow.yml の8本の線が固定値と一致しません。");
    check(deepEqual(cases, ["urgent", "billing"]), "workflow.yml の判定の順が urgent → billing ではありません。");
    for (const needle of ["value: 至急", "comparison_operator: ≥", "value: '100'", "logical_operator: or", "value: 請求"]) {
      check(src.includes(needle), `workflow.yml に「${needle}」がありません。`);
    }
    return { nodes, edges };
  }

  // One case of the original record, reduced to what the drawing shows. Every value is checked.
  function readCase(item, ticket, oracle) {
    const id = item.id;
    const input = item.input;
    const output = item.output || {};
    const route = output.selected_case_id;
    check(deepEqual(input, ticket.input) && item.label === ticket.label, `${id} の入力が tickets.json と一致しません。`);
    check(ROUTES.includes(route) && route === oracle[id], `${id} の分岐が expected.json と一致しません。`);
    check(deepEqual(output.node_path, ["start", "route", MEMO_NODE[route], "merge", "end"]), `${id} の通ったノードが記録の形と合いません。`);
    const events = item.events;
    check(Array.isArray(events) && events.length > 0 && events[0].type === "GraphRunStartedEvent", `${id} のイベントが開始で始まっていません。`);
    const last = events[events.length - 1];
    check(last.type === "GraphRunSucceededEvent" && last.data?.outputs?.text === output.text && last.data.outputs.selected_case_id === route,
      `${id} の最終イベントが記録のメモ・分岐と一致しません。`);
    const succeeded = events.filter((e) => e.type === "NodeRunSucceededEvent").map((e) => e.data.node_id);
    check(deepEqual(succeeded, output.node_path), `${id} の成功したノードの順が記録と一致しません。`);
    const edgeOf = (e) => [e.data.source_node_id, e.data.target_node_id, e.data.source_handle];
    const taken = events.filter((e) => e.type === "GraphEdgeTakenEvent").map(edgeOf);
    const skipped = events.filter((e) => e.type === "GraphEdgeSkippedEvent").map(edgeOf);
    check(deepEqual(taken.map(edgeKey), pathEdges(route).map(edgeKey)), `${id} の通った線が記録の分岐と一致しません。`);
    const memoNode = events.find((e) => e.type === "NodeRunSucceededEvent" && e.data.node_id === MEMO_NODE[route]);
    check(memoNode?.data?.node_run_result?.outputs?.output === output.text, `${id} のメモが担当のノードの実際の出力と一致しません。`);

    const routeNode = events.find((e) => e.type === "NodeRunSucceededEvent" && e.data.node_id === "route")?.data?.node_run_result;
    check(routeNode?.outputs?.selected_case_id === route, `${id} の route の選択が記録と一致しません。`);
    const groups = (routeNode.process_data?.condition_results ?? []).map((g) => ({ id: g.group?.case_id, results: g.results, final: g.final_result }));
    const expectGroups = { urgent: [true], billing: [false, true], false: [false, false] }[route];
    check(groups.length === expectGroups.length && groups.every((g, i) => g.id === ["urgent", "billing"][i] && g.final === expectGroups[i]
      && Array.isArray(g.results) && g.results.length > 0 && g.results.every((r) => typeof r === "boolean")),
    `${id} の route の判定結果が上から順の記録になっていません。`);
    // Graphon keeps inputs.conditions for the LAST evaluated group. Earlier group values
    // come from the fixed original input and its recorded condition descriptor/results.
    const threshold = routeNode.process_data.condition_results[0].group.conditions.find((c) => c.comparison_operator === "≥");
    check(threshold?.value === "100" && deepEqual(threshold.variable_selector, ["start", "affected_users"]), `${id} の人数の条件が固定版と一致しません。`);
    const cmp = (routeNode.inputs?.conditions ?? []).find((c) => c.comparison_operator === "≥");
    if (cmp) check(cmp.actual_value === input.affected_users && cmp.expected_value === threshold.value, `${id} の人数の実入力が一致しません。`);
    const users = groups[0].results.length === 2 ? { actual: input.affected_users, expected: threshold.value, ok: groups[0].results[1] } : null;
    if (users) check(users.actual === input.affected_users && users.expected === "100", `${id} の人数の比較の値が記録と一致しません。`);

    const lines = output.text.split("\n");
    check(lines[0] === `【担当】${ROUTE_LABEL[route]}` && lines[1] === `問い合わせ：${input.ticket_id}` && lines[2] === `件名：${input.subject}`,
      `${id} のメモの1〜3行目が記録の形と合いません。`);
    const kind = lines[3]?.split("／") ?? [];
    check(kind.length === 2 && kind[1] === `影響${input.affected_users}人`, `${id} のメモの人数の行が記録と一致しません。`);
    return {
      id, label: item.label, input, route, text: output.text, groups, users, taken, skipped,
      head: lines[0], subjectLine: lines[2], usersText: kind[1], events: events.length,
    };
  }

  // Reads the actual record into the few values the picture draws, checking every assumption.
  function buildFilm(data) {
    const record = data["workflow-runs.json"];
    const ticketsFile = data["tickets.json"];
    const expected = data["expected.json"];
    const audit = data["independent-checks.json"];
    const lock = data["vendor-lock.json"];
    const facts = data["diagram-data.json"];
    const timeline = data["timeline.json"];

    check(isObject(record) && record.format === PIN.format, "元の実行記録の形式が違います。");
    const src = record.source ?? {};
    check(src.repository === PIN.repository && src.commit === PIN.commit && src.version === PIN.version, "実行記録の Dify の固定版が一致しません。");
    const dep = record.runtime_dependency ?? {};
    check(dep.name === PIN.graphonName && dep.version === PIN.graphonVersion && dep.wheel_sha256 === PIN.wheelSha256, "実行記録の graphon の版または wheel の SHA-256 が一致しません。");
    check(record.source_lock_sha256 === SHA["vendor-lock.json"], "実行記録の vendor-lock.json の SHA-256 が素材と一致しません。");
    check(deepEqual(record.input_sha256, { "input/tickets.json": SHA["tickets.json"], "input/expected.json": SHA["expected.json"], "workflow.yml": SHA["workflow.yml"] }),
      "実行記録の入力と DSL のハッシュが素材と一致しません。");
    const runtime = record.runtime ?? {};
    check(runtime.network_attempts === 0 && runtime.process_attempts === 0, "実行中の通信または子プロセスの試みが0件ではありません。");
    check(runtime.server_started === false && runtime.llm_called === false, "サーバーやモデルを使っていない実行の記録ではありません。");
    const checks = record.checks ?? {};
    check(checks.passed === true && checks.count === PIN.checks && Array.isArray(checks.items) && checks.items.length === PIN.checks, "実行記録の196の自動確認が合格になっていません。");

    const lockDep = lock?.runtime_dependency ?? {};
    check(lock?.repository === PIN.repository && lock.commit === PIN.commit && lock.version === PIN.version && lockDep.version === PIN.graphonVersion
      && lockDep.wheel_sha256 === PIN.wheelSha256 && Array.isArray(lock.files) && lock.files.length === PIN.lockFiles, "vendor-lock.json の固定版または292ファイルの件数が違います。");

    check(ticketsFile?.fictional === true && Array.isArray(ticketsFile.cases) && deepEqual(ticketsFile.cases.map((c) => c?.id), PIN.ids), "tickets.json が架空の8件 D01〜D08 ではありません。");
    const oracle = expected?.selected_case_ids;
    check(isObject(oracle) && deepEqual(Object.keys(oracle), PIN.ids), "expected.json の8件が D01〜D08 ではありません。");
    check(Array.isArray(record.cases) && deepEqual(record.cases.map((c) => c?.id), PIN.ids) && new Set(record.cases.map((c) => c.id)).size === 8,
      "実行記録の問い合わせが D01〜D08 の8件ではありません。");

    const cases = record.cases.map((item, i) => readCase(item, ticketsFile.cases[i], oracle));
    check(cases.reduce((n, c) => n + c.events, 0) === PIN.events, "実行記録のイベントが合計160件ではありません。");
    const counts = Object.fromEntries(ROUTES.map((r) => [r, cases.filter((c) => c.route === r).length]));
    check(deepEqual(counts, PIN.counts), "担当ごとの件数が 優先対応3・請求窓口1・通常窓口4 ではありません。");

    const dsl = dslFacts(data["workflow.yml"]);
    const seen = new Set(cases.flatMap((c) => [...c.taken, ...c.skipped].map(edgeKey)));
    check(deepEqual([...seen].sort(), dsl.edges.map(edgeKey).sort()), "実行イベントの線が workflow.yml の8本と一致しません。");

    check(audit?.status === "passed" && audit.run_sha256 === SHA["workflow-runs.json"] && audit.source_commit === PIN.commit && audit.source_files_verified === PIN.lockFiles
      && audit.all49_topology_pairs_match === true && audit.raw_api_record_unchanged === true, "independent-checks.json が合格の記録ではありません。");
    check(deepEqual(audit.route_counts, Object.fromEntries(ROUTES.map((r) => [ROUTE_LABEL[r], counts[r]]))), "independent-checks.json の件数が記録と一致しません。");
    check(Array.isArray(audit.cases) && audit.cases.length === 8 && audit.cases.every((a, i) => a.id === cases[i].id && a.route === cases[i].route && a.llm_tokens === 0),
      "independent-checks.json の8件が記録と一致しません。");

    // diagram-data.json is a projection of the record: compare each copied value with its source.
    check(facts?.format === PIN.diagramFormat && facts.source_run_sha256 === SHA["workflow-runs.json"] && facts.fictional === true, "diagram-data.json の形式または元の記録が違います。");
    check(deepEqual(facts.topology, record.topology), "diagram-data.json のつながりが記録と一致しません。");
    check(Array.isArray(facts.cases) && facts.cases.length === 8 && facts.cases.every((f, i) => f.id === cases[i].id && f.label === cases[i].label
      && deepEqual(f.input, cases[i].input) && f.selected_case_id === cases[i].route && deepEqual(f.node_path, record.cases[i].output.node_path) && f.text === cases[i].text),
    "diagram-data.json の8件が記録と一致しません。");
    check(deepEqual(facts.rule_order?.map((r) => r.id), ROUTES)
      && RULE_LINES.every((lines, i) => lines.every((part) => facts.rule_order[i].label.includes(part))), "diagram-data.json の判定の順と短い言葉が図と一致しません。");

    check(timeline?.format === PIN.timelineFormat && timeline.duration === DURATION && timeline.fps === 30 && timeline.frames === 960 && timeline.silent === true,
      "timeline.json が32秒・30fps・960フレーム・無音ではありません。");
    check(Array.isArray(timeline.scenes) && timeline.scenes.length === SCENE_PLAN.length
      && timeline.scenes.every((s, i) => s.id === SCENE_PLAN[i].id && s.in === SCENE_PLAN[i].in && s.out === SCENE_PLAN[i].out && s.case === SCENE_PLAN[i].case
        && (s.compare_case ?? null) === (SCENE_PLAN[i].compare ?? null) && typeof s.headline === "string" && s.headline.length > 0),
    "timeline.json の6場面が固定の時刻表と一致しません。");

    const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
    const d07 = byId.D07;
    const literal = d07.input.subject.match(/^\{\{[^}]*\}\}/)?.[0];
    check(literal && d07.route === "false" && d07.subjectLine === `件名：${d07.input.subject}`, "D07 の件名の記号が通常窓口のメモにそのまま入った記録ではありません。");
    check(byId.D04.users && byId.D05.users && byId.D04.route === "false" && byId.D05.route === "urgent", "D04・D05 の人数の比較が記録にありません。");
    check(byId.D06.input.issue === "請求" && byId.D06.groups.length === 1 && byId.D06.route === "urgent", "D06 が判定1で決まった記録ではありません。");

    return {
      byId, counts, literal,
      headlines: Object.fromEntries(timeline.scenes.map((s) => [s.id, s.headline])),
      source: { version: src.version, graphon: `${dep.name} ${dep.version}` },
    };
  }

  async function load() {
    const data = await loadAssets();
    const built = buildFilm(data);
    if (document.fonts?.ready) await document.fonts.ready;
    built.journeys = buildJourneys(built);
    return built;
  }

  // --- Time helpers (pure) -------------------------------------------------------------------

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const ramp = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : ease(clamp01((t - a) / (b - a))));
  const centerOf = (r) => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, w: r.w, h: r.h });

  function polyLength(poly) {
    let total = 0;
    for (let i = 1; i < poly.length; i += 1) total += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
    return total;
  }

  function pointAlong(poly, p) {
    const target = polyLength(poly) * clamp01(p);
    let walked = 0;
    for (let i = 1; i < poly.length; i += 1) {
      const seg = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
      if (walked + seg >= target || i === poly.length - 1) {
        const q = seg === 0 ? 1 : clamp01((target - walked) / seg);
        return [lerp(poly[i - 1][0], poly[i][0], q), lerp(poly[i - 1][1], poly[i][1], q)];
      }
      walked += seg;
    }
    return poly[poly.length - 1];
  }

  // --- Journeys: the same envelope from the inbox, through the switch and desk, into the memo ----

  // Each journey is a list of timed segments. A frame is a pure function of time over this list.
  function buildJourney(film, id, o) {
    const c = film.byId[id];
    const s = o.s;
    const sel = SLOT_OF[c.route];
    const visited = c.groups.map((_, i) => i);
    if (c.route === "false") visited.push(2);
    const tint = C[c.route].main;
    const segs = [], marks = [], trails = [];
    const tok = (pt, tnt = C.accent) => ({ cx: pt[0], cy: pt[1], w: L.token.w, h: L.token.h, a: 1, form: "token", tint: tnt });
    const home = { ...centerOf(L.home), a: 1, form: "home", tint: C.accent };
    let t = o.T;
    let cur;
    const add = (dur, to, extra = {}) => {
      const seg = { t0: t, t1: t + dur, from: cur, to, ...extra };
      segs.push(seg);
      cur = to;
      t += dur;
      return seg;
    };
    if (o.preset) {
      cur = home;
      segs.push({ t0: 0, t1: 0, from: home, to: home });
    } else {
      cur = { ...home, cy: home.cy - 70, a: 0 };
      add(0.5 * s, home);
    }
    const e0 = L.edges["start>route"];
    add(0.45 * s, tok(e0[0]));
    let seg = add(0.5 * s, tok(e0[e0.length - 1]), { poly: e0 });
    trails.push({ key: "start>route", t0: seg.t0, t1: seg.t1, color: C.accent });

    let checksStart = null;
    let pill = null;
    visited.forEach((slot, k) => {
      if (k > 0) add(0.3 * s, tok(L.lane[slot]), { poly: [L.lane[visited[k - 1]], L.lane[slot]] });
      if (checksStart === null) checksStart = t;
      const long = o.threshold && slot === 0;
      if (long) pill = { t0: t + 0.1 * s, t1: t + 0.7 * s };
      marks.push({ slot, at: t + (long ? 0.8 : 0.08) * s });
      add((long ? 1.3 : 0.35) * s, cur);
    });

    const node = MEMO_NODE[c.route];
    const re = L.edges[`route>${node}`];
    const de = L.edges[`${node}>merge`];
    const me = L.edges["merge>end"];
    const slotLit = t;
    add(0.3 * s, tok(re[0]), { poly: [L.lane[sel], re[0]], under: true });
    seg = add(0.4 * s, tok(re[re.length - 1]), { poly: re });
    trails.push({ key: `route>${node}`, t0: seg.t0, t1: seg.t1, color: tint });
    const deskLit = t;
    add(0.35 * s, tok(L.deskExit[sel], tint), { poly: [re[re.length - 1], L.deskExit[sel]], under: true });
    seg = add(0.55 * s, tok(me[0], tint), { poly: [...de, me[0]] });
    trails.push({ key: `${node}>merge`, t0: seg.t0, t1: seg.t1, color: tint });
    seg = add(0.35 * s, tok(me[me.length - 1], tint), { poly: me });
    trails.push({ key: "merge>end", t0: seg.t0, t1: seg.t1, color: tint });
    const land = o.land === "right" ? { ...centerOf(L.halves[1]), form: "half", half: 1 } : { ...centerOf(L.memo), form: "memo" };
    add(0.45 * s, { ...land, a: 1, tint });
    const memoAt = t;
    if (o.park != null) {
      t = Math.max(t, o.park);
      add(0.35, { ...centerOf(L.halves[0]), form: "half", half: 0, a: 1, tint });
    }
    if (o.exit != null) {
      t = Math.max(t, o.exit);
      add(0.4, { ...cur, cx: cur.cx + (L.tall ? 90 : 70), a: 0 });
    }
    return {
      id, c, segs, marks, trails, sel, slotLit, deskLit, memoAt, pill, checksStart,
      start: o.preset ? 0 : o.T, exit: o.exit ?? null, dimAt: o.dimAt ?? null, dimAlpha: 0.38, marksOff: null,
      threshold: Boolean(o.threshold), literal: Boolean(o.literal),
    };
  }

  function buildJourneys(film) {
    const list = [
      buildJourney(film, "D02", { T: 5.1, preset: true, s: 0.85, exit: 10.0 }),
      buildJourney(film, "D06", { T: 10.0, s: 0.8, exit: 15.0 }),
      buildJourney(film, "D04", { T: 15.0, s: 0.55, threshold: true, park: 18.6, exit: 22.0 }),
      buildJourney(film, "D05", { T: 18.2, s: 0.5, threshold: true, land: "right", exit: 22.0 }),
      buildJourney(film, "D07", { T: 22.0, s: 0.65, literal: true, exit: 27.0 }),
      buildJourney(film, "D05", { T: 27.0, s: 0.58 }),
    ];
    // D04 stays as the dimmed earlier record while D05 takes the other branch.
    list[2].dimAt = list[3].checksStart;
    list.forEach((j, i) => {
      const next = list[i + 1];
      const overlaps = next && j.exit != null && next.checksStart < j.exit;
      j.marksOff = overlaps ? next.checksStart - 0.1 : (j.exit ?? Infinity);
    });
    // Same scene boundaries as the timeline: the final memo must be settled for the last 2.5 seconds.
    check(list[0].memoAt < SCENE_PLAN[1].out && list[1].memoAt < SCENE_PLAN[2].out && list[2].memoAt <= 18.6
      && list[3].memoAt < SCENE_PLAN[3].out && list[4].memoAt < SCENE_PLAN[4].out && list[5].memoAt <= DURATION - 2.5,
    "図の動きの時刻が場面の範囲に収まりません。");
    return list;
  }

  function stateAt(j, t) {
    let seg = null;
    for (const sg of j.segs) {
      if (sg.t0 <= t) seg = sg;
      else break;
    }
    if (!seg) return null;
    if (t >= seg.t1) return { ...seg.to, fromForm: seg.to.form, p: 1, under: false };
    const p = ease(clamp01((t - seg.t0) / (seg.t1 - seg.t0)));
    const a = seg.from, b = seg.to;
    const at = seg.poly ? pointAlong(seg.poly, p) : [lerp(a.cx, b.cx, p), lerp(a.cy, b.cy, p)];
    return {
      cx: at[0], cy: at[1], w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p), a: lerp(a.a, b.a, p),
      form: b.form, fromForm: a.form, p, tint: p < 0.5 ? a.tint : b.tint, half: b.half ?? a.half, under: Boolean(seg.under),
    };
  }

  function weightsOf(st) {
    const w = { home: 0, token: 0, memo: 0, half: 0 };
    w[st.fromForm] += 1 - st.p;
    w[st.form] += st.p;
    return w;
  }

  const highlightAlpha = (j, t) => (j.dimAt != null ? lerp(1, j.dimAlpha, ramp(t, j.dimAt, j.dimAt + 0.25)) : 1)
    * (j.exit != null ? 1 - ramp(t, j.exit, j.exit + 0.4) : 1);
  const marksAlpha = (j, at, t) => ramp(t, at, at + 0.15) * (1 - ramp(t, j.marksOff, j.marksOff + 0.2));

  // --- Drawing primitives --------------------------------------------------------------------

  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Meiryo", "Noto Sans JP", sans-serif';
  const MONO = 'ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, Menlo, monospace';
  const C = {
    ivory: "#f6f1e6", paper: "#fffcf5", ink: "#1c2333", muted: "#5d6475", line: "#cbbfa6", rail: "#ddd3bf",
    accent: "#c8641e", accentSoft: "#fbe3cc", reject: "#9e3324", dim: "#f6f1e6",
    urgent: { main: "#2747c2", soft: "#e3e8fb" },
    billing: { main: "#0f7a72", soft: "#dbefec" },
    false: { main: "#86590f", soft: "#f3e8d2" },
  };

  function setFont(size, weight = 700, family = FONT) { ctx.font = `${weight} ${size}px ${family}`; }

  function fitSize(str, size, min, max, weight = 700) {
    let s = size;
    setFont(s, weight);
    while (s > min && ctx.measureText(str).width > max) {
      s -= 1;
      setFont(s, weight);
    }
    return s;
  }

  function measure(str, size, weight = 700, family = FONT) {
    setFont(size, weight, family);
    return ctx.measureText(str).width;
  }

  function text(str, x, y, { size = 24, weight = 700, color = C.ink, align = "left", alpha = 1, family = FONT } = {}) {
    if (alpha <= 0.003 || !str) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    setFont(size, weight, family);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function wrap(str, maxW, size, weight = 700) {
    setFont(size, weight);
    const lines = [];
    let line = "";
    for (const ch of Array.from(str)) {
      if (line && ctx.measureText(line + ch).width > maxW && !"。、」）".includes(ch)) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function rr(x, y, w, h, r) {
    const q = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + q, y);
    ctx.lineTo(x + w - q, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + q);
    ctx.lineTo(x + w, y + h - q);
    ctx.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
    ctx.lineTo(x + q, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - q);
    ctx.lineTo(x, y + q);
    ctx.quadraticCurveTo(x, y, x + q, y);
    ctx.closePath();
  }

  function box(r, { fill, stroke, width = 2, radius = 12, dash = null, alpha = 1 }) {
    if (alpha <= 0.003) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    rr(r.x, r.y, r.w, r.h, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      if (dash) ctx.setLineDash(dash);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pill(x, cy, label, size, { fill, color, stroke = null, alpha = 1, align = "left", family = FONT, weight = 700 }) {
    if (alpha <= 0.003) return 0;
    const padX = size * 0.5, h = size * 1.45;
    const w = measure(label, size, weight, family) + padX * 2;
    const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    box({ x: left, y: cy - h / 2, w, h }, { fill, stroke, width: 2, radius: h / 2, alpha });
    text(label, left + padX, cy + size * 0.36, { size, color, alpha, family, weight });
    return w;
  }

  function strokePoly(poly, p, color, width, alpha, { dash = null, arrow = false } = {}) {
    if (alpha <= 0.003 || p <= 0) return;
    const end = pointAlong(poly, p);
    const target = polyLength(poly) * clamp01(p);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    let walked = 0;
    let prev = poly[0];
    for (let i = 1; i < poly.length; i += 1) {
      const seg = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
      if (walked + seg >= target) break;
      ctx.lineTo(poly[i][0], poly[i][1]);
      prev = poly[i];
      walked += seg;
    }
    ctx.lineTo(end[0], end[1]);
    ctx.stroke();
    if (arrow && p > 0.97) {
      const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
      const k = Math.max(8, width * 2.4);
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(end[0] - Math.cos(ang - 0.5) * k, end[1] - Math.sin(ang - 0.5) * k);
      ctx.lineTo(end[0] - Math.cos(ang + 0.5) * k, end[1] - Math.sin(ang + 0.5) * k);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function mark(cx, cy, r, ok, alpha, color) {
    if (alpha <= 0.003) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = ok ? color : C.reject;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.paper;
    ctx.lineWidth = Math.max(3, r * 0.22);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (ok) {
      ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.38);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.38);
    } else {
      const q = r * 0.4;
      ctx.moveTo(cx - q, cy - q);
      ctx.lineTo(cx + q, cy + q);
      ctx.moveTo(cx + q, cy - q);
      ctx.lineTo(cx - q, cy + q);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Icons for the three routing values on the envelope: bill = 種類, bolt = 緊急度, people = 人数.
  function iconBill(x, y, s, color) {
    const w = s * 0.74, left = x + (s - w) / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + w * 0.66, y);
    ctx.lineTo(left + w, y + s * 0.26);
    ctx.lineTo(left + w, y + s);
    ctx.lineTo(left, y + s);
    ctx.closePath();
    ctx.stroke();
    for (const k of [0.46, 0.64, 0.82]) {
      ctx.beginPath();
      ctx.moveTo(left + w * 0.22, y + s * k);
      ctx.lineTo(left + w * 0.78, y + s * k);
      ctx.stroke();
    }
    ctx.restore();
  }

  function iconBolt(x, y, s, color) {
    const pts = [[0.58, 0], [0.16, 0.58], [0.46, 0.58], [0.36, 1], [0.86, 0.38], [0.56, 0.38], [0.68, 0]];
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * s, y + py * s) : ctx.moveTo(x + px * s, y + py * s)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function iconPeople(x, y, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    for (const [hx, r, top] of [[0.34, 0.16, 0.12], [0.7, 0.13, 0.2]]) {
      ctx.beginPath();
      ctx.arc(x + hx * s, y + (top + r) * s, r * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + hx * s, y + s * 0.92, r * s * 1.7, s * 0.3, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  function person(cx, headY, r, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, headY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, headY + r * 2.7, r * 1.75, r * 1.45, 0, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }

  // --- The picture ----------------------------------------------------------------------------

  function caseLine(c) {
    return `記録 ${c.id} ・ ${c.input.ticket_id} ・ ${c.input.issue}・${c.input.urgency}・${c.input.affected_users}人`;
  }

  function drawHeadline(film, t) {
    // Exactly one headline: the old one fades out before the new one fades in.
    const i = SCENE_PLAN.findIndex((s) => t >= s.in && t < s.out);
    const s = SCENE_PLAN[i < 0 ? SCENE_PLAN.length - 1 : i];
    const last = s === SCENE_PLAN[SCENE_PLAN.length - 1];
    const a = (s.in === 0 ? 1 : ramp(t, s.in, s.in + 0.3)) * (last ? 1 : 1 - ramp(t, s.out - 0.3, s.out));
    const head = film.headlines[s.id];
    const size = fitSize(head, L.headline.size, L.headline.min, L.headline.max);
    text(head, L.headline.x, L.headline.y, { size, alpha: a });

    // Small eyebrow: the record the envelope belongs to.
    const js = film.journeys;
    let k = 0;
    js.forEach((j, n) => { if (j.start <= t) k = n; });
    const j = js[k];
    const next = js[k + 1];
    const ea = (j.start === 0 ? 1 : ramp(t, j.start, j.start + 0.2)) * (next ? 1 - ramp(t, next.start - 0.2, next.start) : 1);
    const label = s.id === "overview" ? "8件の担当内訳 ・ 封筒の例 D02" : caseLine(j.c);
    const es = fitSize(label, L.eyebrow.size, 16, L.eyebrow.max, 700);
    text(label, L.eyebrow.x, L.eyebrow.y, { size: es, color: C.accent, alpha: ea });
  }

  function drawStartNode() {
    box(L.home, { stroke: C.line, width: 3, radius: 18, dash: [12, 10] });
    const cx = L.home.x + L.home.w / 2, cy = L.home.y + L.home.h / 2;
    text("問い合わせ", cx, cy + L.env.placeholder * 0.36, { size: L.env.placeholder, color: C.line, align: "center" });
  }

  function drawSwitchFrame() {
    box(L.frame, { fill: C.paper, stroke: C.ink, width: 3, radius: 22 });
    // Lane where the envelope is held while the rules are read in order.
    ctx.save();
    ctx.strokeStyle = C.rail;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    const [a, b] = [L.lane[0], L.lane[2]];
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
    const fp = L.framePill;
    if (fp) pill(fp.x, fp.y, "担当を決める・順に判定", fp.size, { fill: C.ink, color: C.paper, align: fp.align });
  }

  function drawBaseEdges() {
    for (const poly of Object.values(L.edges)) strokePoly(poly, 1, C.line, L.tall ? 5 : 4, 1, { arrow: true });
  }

  function overviewAlpha(i, t) {
    return ramp(t, 1.0 + i, 1.5 + i) * (1 - ramp(t, 4.7, 5.1));
  }

  function drawTrails(film, t) {
    // Overview: the three possible routes light one after another (no record travels yet).
    ROUTES.forEach((route, i) => {
      const a = overviewAlpha(i, t);
      if (a <= 0.003) return;
      const node = MEMO_NODE[route];
      const p = ramp(t, 1.0 + i, 1.7 + i);
      for (const key of [`route>${node}`, `${node}>merge`, "merge>end"]) strokePoly(L.edges[key], p, C[route].main, L.tall ? 7 : 6, a * 0.6, { arrow: true });
    });
    for (const j of film.journeys) {
      const a = highlightAlpha(j, t);
      for (const tr of j.trails) {
        if (t < tr.t0) continue;
        strokePoly(L.edges[tr.key], ease(clamp01((t - tr.t0) / (tr.t1 - tr.t0))), tr.color, L.tall ? 9 : 7, a, { arrow: true });
      }
    }
  }

  function drawSlots(film, t) {
    const T = L.slotText;
    L.slots.forEach((r, i) => {
      let lit = 0, litColor = C[ROUTES[i]].main;
      for (const j of film.journeys) {
        if (j.sel !== i) continue;
        lit = Math.max(lit, ramp(t, j.slotLit, j.slotLit + 0.2) * highlightAlpha(j, t));
      }
      lit = Math.max(lit, overviewAlpha(i, t) * 0.6);
      box(r, { fill: C.paper, stroke: C.ink, width: 2, radius: 16 });
      box(r, { fill: C[ROUTES[i]].soft, radius: 16, alpha: lit });
      box(r, { stroke: litColor, width: 6, radius: 16, alpha: lit });
      // Number in reading order.
      ctx.save();
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(r.x + T.numDx, r.y + T.numDy, T.numR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      text(String(i + 1), r.x + T.numDx, r.y + T.numDy + T.numSize * 0.36, { size: T.numSize, color: C.paper, align: "center" });
      const lines = RULE_LINES[i];
      const ys = i === 0 ? T.lines0 : [T.single ?? Math.round(r.h / 2 + T.size * 0.36 + 10)];
      lines.forEach((ln, k) => text(ln, r.x + T.textDx, r.y + ys[k], { size: T.size }));
    });

    // Marks from the recorded condition results, in rule order.
    for (const j of film.journeys) {
      for (const m of j.marks) {
        const a = marksAlpha(j, m.at, t);
        if (a <= 0.003) continue;
        const r = L.slots[m.slot];
        const ok = m.slot === 2 ? j.c.route === "false" : j.c.groups[m.slot].final;
        mark(r.x + r.w + T.markDx, r.y + T.numDy, T.numR, ok, a, C[ROUTES[m.slot]].main);
        if (m.slot === 0) {
          // Which of the two conditions in rule 1 the record evaluated, and how.
          j.c.groups[0].results.forEach((res, k) => {
            const y = r.y + T.lines0[k];
            const w = measure(RULE_LINES[0][k], T.size);
            ctx.save();
            ctx.globalAlpha *= a;
            ctx.strokeStyle = res ? C.urgent.main : C.muted;
            ctx.lineWidth = res ? 6 : 3;
            ctx.lineCap = "round";
            ctx.beginPath();
            const ly = res ? y + 10 : y - T.size * 0.34;
            ctx.moveTo(r.x + T.textDx - 2, ly);
            ctx.lineTo(r.x + T.textDx + w + 2, ly);
            ctx.stroke();
            ctx.restore();
          });
        }
      }
      // Rules after the matched one were never read for this record.
      const fade = j.marks.length ? marksAlpha(j, j.marks[0].at, t) : 0;
      for (let i = j.sel + 1; i < 3; i += 1) box(L.slots[i], { fill: C.dim, radius: 16, alpha: fade * 0.62 });
      if (j.threshold && j.c.users) drawThreshold(j, t);
    }
  }

  function drawThreshold(j, t) {
    const T = L.slotText;
    const r = L.slots[0];
    const a = (1 - ramp(t, j.marksOff, j.marksOff + 0.2));
    if (t < j.pill.t0 || a <= 0.003) return;
    const p = ramp(t, j.pill.t0, j.pill.t1);
    const u = j.c.users;
    const label = `${u.actual}人`;
    const goal = [r.x + T.textDx, r.y + T.cmp - T.cmpSize * 0.36];
    const x = lerp(L.lane[0][0] - measure(label, T.cmpSize) / 2, goal[0], p);
    const y = lerp(L.lane[0][1], goal[1], p);
    const w = pill(x, y, label, T.cmpSize, { fill: C.ink, color: C.paper, alpha: a * ramp(t, j.pill.t0, j.pill.t0 + 0.1) });
    const settled = ramp(t, j.pill.t1 - 0.05, j.pill.t1 + 0.15) * a;
    text(`${u.ok ? "≥" : "＜"} ${u.expected}人`, goal[0] + w + 10, r.y + T.cmp, { size: T.cmpSize, color: u.ok ? C.urgent.main : C.reject, alpha: settled });
  }

  function drawDesks(film, t) {
    const D = L.deskText;
    L.desks.forEach((r, i) => {
      const route = ROUTES[i];
      const col = C[route];
      let lit = 0;
      for (const j of film.journeys) {
        if (j.sel !== i) continue;
        lit = Math.max(lit, ramp(t, j.deskLit, j.deskLit + 0.2) * highlightAlpha(j, t));
      }
      lit = Math.max(lit, overviewAlpha(i, t) * 0.6);
      box(r, { fill: C.paper, stroke: col.main, width: 3, radius: 18 });
      box(r, { fill: col.soft, radius: 18, alpha: lit });
      box(r, { stroke: col.main, width: 7, radius: 18, alpha: lit });
      const label = ROUTE_LABEL[route];
      if (L.tall) {
        const cx = r.x + r.w / 2;
        person(cx, r.y + D.head - lit * 4, D.headR, route === "false" ? C.ink : col.main);
        box({ x: r.x + 14, y: r.y + D.bar, w: r.w - 28, h: 12 }, { fill: col.main, radius: 6 });
        text(label, cx, r.y + D.label, { size: D.size, color: col.main, align: "center" });
      } else {
        const cy = r.y + r.h / 2;
        person(r.x + 46, cy + D.head - lit * 4, D.headR, route === "false" ? C.ink : col.main);
        box({ x: r.x + 14, y: cy + D.bar, w: 64, h: 10 }, { fill: col.main, radius: 5 });
        text(label, r.x + 92, cy + D.label, { size: D.size, color: col.main });
      }
      // Owner counts from the eight actual results: overview and finish only.
      const ca = Math.max(ramp(t, 1.0 + i, 1.3 + i) * (1 - ramp(t, 4.9, 5.2)), ramp(t, 29.0, 29.3));
      pill(r.x + r.w - 12, r.y + D.countCy, `${film.counts[route]}件`, D.count, { fill: col.main, color: C.paper, align: "right", alpha: ca });
    });
  }

  function drawMergeAndEnd() {
    const m = L.merge;
    ctx.save();
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(m.x - m.r * 0.45, m.y);
    ctx.lineTo(m.x + m.r * 0.45, m.y);
    ctx.moveTo(m.x, m.y - m.r * 0.45);
    ctx.lineTo(m.x, m.y + m.r * 0.45);
    ctx.stroke();
    ctx.restore();
    if (m.label) text("まとめる", m.label.x, m.label.y, { size: m.label.size, color: C.muted });
    box(L.memo, { stroke: C.line, width: 3, radius: 18, dash: [12, 10] });
    text("引き継ぎメモ", L.memo.x + L.memo.w / 2, L.memo.y + L.memo.h / 2 + L.memoPlaceholder * 0.36, { size: L.memoPlaceholder, color: C.line, align: "center" });
  }

  // Content mapped from a base rectangle onto the moving rectangle.
  function mapped(base, r, alpha, draw) {
    if (alpha <= 0.003) return;
    const k = Math.min(r.w / base.w, r.h / base.h);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(r.x + (r.w - base.w * k) / 2, r.y + (r.h - base.h * k) / 2);
    ctx.scale(k, k);
    draw();
    ctx.restore();
  }

  function homeContent(c) {
    const E = L.env;
    text(c.id, E.idX, E.idY, { size: E.idSize });
    text(c.input.ticket_id, E.idX + measure(c.id, E.idSize) + 16, E.idY, { size: E.ticketSize, color: C.muted, weight: 600 });
    const values = [c.input.issue, c.input.urgency, `${c.input.affected_users}人`];
    const icons = [iconBill, iconBolt, iconPeople];
    E.stamps.forEach((st, i) => {
      box(st, { fill: C.ivory, stroke: C.ink, width: 2, radius: 12 });
      icons[i](st.x + 12, st.y + (st.h - E.icon) / 2, E.icon, C.ink);
      const size = fitSize(values[i], E.value, 26, st.w - 72);
      text(values[i], st.x + 62, st.y + st.h / 2 + size * 0.36, { size });
    });
  }

  function literalParts(film, c) {
    // The literal string only appears as drawn text; nothing is evaluated.
    return c.input.subject.startsWith(film.literal) ? [film.literal, c.input.subject.slice(film.literal.length)] : null;
  }

  // Full memo: the first and third lines of the actual memo, then the real memo badge with IDs.
  function memoGeometry(variant) {
    if (variant === "memo") {
      return L.tall
        ? { head: { x: 28, y: 64, size: 44 }, subject: { x: 28, y: 112, size: 32, max: 568 }, badge: { x: 28, y: 140, size: 22 } }
        : { head: { x: 20, y: 98, size: 40 }, pre: { x: 20, y: 48, size: 24 }, subject: { x: 20, y: 194, size: 26, max: 216, label: 154 }, badge: { x: 20, y: 384, size: 20 }, ids: { x: 20, y: 420, size: 22 } };
    }
    return L.tall
      ? { pre: { x: 20, y: 40, size: 22 }, head: { x: 20, y: 90, size: 42 }, ids: { x: 20, y: 122, size: 22 }, users: { x: 20, y: 150, size: 26 } }
      : { pre: { x: 20, y: 44, size: 22 }, head: { x: 20, y: 94, size: 38 }, ids: { x: 20, y: 140, size: 22 }, users: { x: 20, y: 182, size: 26 } };
  }

  function memoContent(film, c, variant) {
    const col = C[c.route].main;
    const g = memoGeometry(variant);
    const base = variant === "memo" ? L.memo : L.halves[0];
    box({ x: 14, y: 0, w: base.w - 28, h: 10 }, { fill: col, radius: 5 });
    const head = ROUTE_LABEL[c.route];
    if (variant === "memo" && L.tall) {
      text(c.head, g.head.x, g.head.y, { size: g.head.size, color: col });
      const parts = literalParts(film, c);
      if (parts) {
        const pre = "件名：";
        text(pre, g.subject.x, g.subject.y, { size: g.subject.size });
        const lx = g.subject.x + measure(pre, g.subject.size);
        const lw = pill(lx, g.subject.y - g.subject.size * 0.36, parts[0], g.subject.size - 2, { fill: C.accentSoft, color: C.ink, stroke: C.accent, family: MONO });
        text(parts[1], lx + lw + 4, g.subject.y, { size: g.subject.size });
      } else {
        const size = fitSize(c.subjectLine, g.subject.size, 24, g.subject.max);
        text(c.subjectLine, g.subject.x, g.subject.y, { size });
      }
      const bw = pill(g.badge.x, g.badge.y - g.badge.size * 0.36, "実際のメモ", g.badge.size, { fill: C.ink, color: C.paper });
      text(`${c.id} ・ ${c.input.ticket_id}`, g.badge.x + bw + 12, g.badge.y, { size: g.badge.size + 2, color: C.ink });
    } else if (variant === "memo") {
      text("【担当】", g.pre.x, g.pre.y, { size: g.pre.size, color: col });
      text(head, g.head.x, g.head.y, { size: g.head.size, color: col });
      box({ x: 20, y: 120, w: base.w - 40, h: 2 }, { fill: C.line, radius: 1 });
      text("件名", g.subject.x, g.subject.label, { size: 22, color: C.muted });
      const parts = literalParts(film, c);
      let y = g.subject.y;
      if (parts) {
        pill(g.subject.x, y - g.subject.size * 0.36, parts[0], g.subject.size, { fill: C.accentSoft, color: C.ink, stroke: C.accent, family: MONO });
        y += 44;
        for (const ln of wrap(parts[1].trim(), g.subject.max, g.subject.size)) { text(ln, g.subject.x, y, { size: g.subject.size }); y += 36; }
      } else {
        for (const ln of wrap(c.input.subject, g.subject.max, g.subject.size).slice(0, 4)) { text(ln, g.subject.x, y, { size: g.subject.size }); y += 36; }
      }
      pill(g.badge.x, g.badge.y - g.badge.size * 0.36, "実際のメモ", g.badge.size, { fill: C.ink, color: C.paper });
      text(`${c.id} ・ ${c.input.ticket_id}`, g.ids.x, g.ids.y, { size: g.ids.size });
    } else {
      text("【担当】", g.pre.x, g.pre.y, { size: g.pre.size, color: col });
      text(head, g.head.x, g.head.y, { size: g.head.size, color: col });
      text(`実際のメモ ・ ${c.id} ・ ${c.input.ticket_id}`, g.ids.x, g.ids.y, { size: fitSize(`実際のメモ ・ ${c.id} ・ ${c.input.ticket_id}`, g.ids.size, 16, base.w - 40) });
      text(c.usersText, g.users.x, g.users.y, { size: g.users.size });
    }
  }

  // Where the literal string sits for each envelope form (base coordinates of that form).
  function literalAnchor(film, c, form) {
    if (form === "home") {
      const E = L.env.literal;
      const w = measure(film.literal, E.size, 700, MONO) + E.size;
      return { base: L.home, x: E.align === "right" ? E.x - w : E.x, y: E.y, size: E.size };
    }
    const g = memoGeometry("memo");
    if (L.tall) return { base: L.memo, x: g.subject.x + measure("件名：", g.subject.size), y: g.subject.y - g.subject.size * 0.36, size: g.subject.size - 2 };
    return { base: L.memo, x: g.subject.x, y: g.subject.y - g.subject.size * 0.36, size: g.subject.size };
  }

  function drawLiteral(film, j, st, r) {
    const w = weightsOf(st);
    const carry = (w.home + w.token) * st.a;
    if (carry <= 0.003) return;
    const toGlobal = (anchor) => {
      const k = Math.min(r.w / anchor.base.w, r.h / anchor.base.h);
      const ox = r.x + (r.w - anchor.base.w * k) / 2, oy = r.y + (r.h - anchor.base.h * k) / 2;
      return { x: ox + anchor.x * k, y: oy + anchor.y * k, size: anchor.size * k };
    };
    const home = toGlobal(literalAnchor(film, j.c, "home"));
    const tokenSize = L.tall ? 22 : 16;
    const tokenW = measure(film.literal, tokenSize, 700, MONO) + tokenSize;
    const token = { x: r.x + r.w / 2 - tokenW / 2, y: r.y - tokenSize * 0.95, size: tokenSize };
    const memo = toGlobal(literalAnchor(film, j.c, "memo"));
    const sum = w.home + w.token + w.memo;
    const mix = (key) => (home[key] * w.home + token[key] * w.token + memo[key] * w.memo) / sum;
    pill(mix("x"), mix("y"), film.literal, mix("size"), { fill: C.accentSoft, color: C.ink, stroke: C.accent, family: MONO, alpha: carry });
  }

  function drawEnvelope(film, j, st) {
    const r = { x: st.cx - st.w / 2, y: st.cy - st.h / 2, w: st.w, h: st.h };
    const w = weightsOf(st);
    const a = st.a;
    if (a <= 0.003) return;
    const radius = Math.min(18, r.h * 0.2);
    // Shadow keeps the travelling envelope readable over the lines.
    box({ x: r.x + 3, y: r.y + 5, w: r.w, h: r.h }, { fill: "rgba(28,35,51,0.16)", radius, alpha: a * (w.token + w.home * 0.6) });
    box(r, { fill: C.paper, stroke: C.ink, width: 3, radius, alpha: a });
    // Envelope flap: present while it is an envelope, opens as it becomes the memo.
    const flapA = a * (w.home + w.token);
    if (flapA > 0.003) {
      const depth = w.home * (L.env.flap * (r.h / L.home.h)) + w.token * r.h * 0.42;
      ctx.save();
      ctx.globalAlpha *= flapA;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(r.x + 4, r.y + 3);
      ctx.lineTo(r.x + r.w / 2, r.y + depth);
      ctx.lineTo(r.x + r.w - 4, r.y + 3);
      ctx.stroke();
      ctx.restore();
    }
    if (w.token > 0.003) {
      box({ x: r.x, y: r.y + r.h - Math.max(6, r.h * 0.16), w: r.w, h: Math.max(6, r.h * 0.16) }, { fill: st.tint, radius: 4, alpha: a * w.token });
      const size = Math.round(r.h * 0.34);
      text(j.c.id, r.x + r.w / 2, r.y + r.h * 0.74, { size, align: "center", alpha: a * w.token * w.token });
    }
    mapped(L.home, r, a * w.home * w.home, () => homeContent(j.c));
    mapped(L.memo, r, a * w.memo * w.memo, () => memoContent(film, j.c, "memo"));
    mapped(L.halves[st.half ?? 0], r, a * w.half * w.half, () => memoContent(film, j.c, "half"));
    if (j.literal) drawLiteral(film, j, st, r);
  }

  function drawEnvelopes(film, t, under) {
    for (const j of film.journeys) {
      const st = stateAt(j, t);
      if (!st || st.under !== under) continue;
      drawEnvelope(film, j, st);
    }
  }

  function drawCta(t) {
    const a = ramp(t, 29.2, 29.5);
    if (a <= 0.003) return;
    const c = L.cta;
    box({ x: c.cx - c.w / 2, y: c.cy - c.h / 2, w: c.w, h: c.h }, { fill: C.ink, radius: c.h / 2, alpha: a });
    const label = "作例ページで JSON・DSL を保存";
    const size = fitSize(label, c.size, 18, c.w - 40);
    text(label, c.cx, c.cy + size * 0.36, { size, color: C.paper, align: "center", alpha: a });
  }

  function drawFooter(film) {
    const f = L.foot;
    const lines = f.ys.length > 1
      ? [`保存済みの実行結果 ・ Dify ${film.source.version} の依存 ${film.source.graphon}`, "架空の8件 ・ 説明図は Studio Yebisu の独自作成"]
      : [`保存済みの実行結果 ・ Dify ${film.source.version} の依存 ${film.source.graphon} で実行 ・ 架空の8件 ・ 説明図は Studio Yebisu の独自作成`];
    lines.forEach((ln, i) => {
      const size = fitSize(ln, f.size, f.min, f.max, 600);
      text(ln, f.x, f.ys[i], { size, weight: 600, color: C.muted });
    });
  }

  function drawFrame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.ivory;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(S, 0, 0, S, OX, OY);
    drawStartNode();
    drawSwitchFrame();
    drawBaseEdges();
    drawTrails(film, t);
    drawEnvelopes(film, t, true);
    drawSlots(film, t);
    drawDesks(film, t);
    drawMergeAndEnd();
    drawEnvelopes(film, t, false);
    drawHeadline(film, t);
    drawCta(t);
    drawFooter(film);
  }

  // --- Editor -----------------------------------------------------------------------------------

  let film = null;
  let current = 0;
  let isPlaying = false;
  let loading = false;
  let raf = 0;
  let startNow = 0;
  let startTime = 0;
  const clampTime = (seconds) => {
    const v = Number(seconds);
    return Number.isFinite(v) ? Math.max(0, Math.min(DURATION, v)) : 0;
  };

  function showAssets() {
    const ok = ASSETS.filter((a) => assetState.get(a.file) === "ok").length;
    ui.count.textContent = `${ok} / ${ASSETS.length}素材`;
    ui.count.dataset.state = ok === ASSETS.length ? "ok" : [...assetState.values()].includes("bad") ? "bad" : "pending";
    ui.assetList.replaceChildren(...ASSETS.map((a) => {
      const li = document.createElement("li");
      const st = assetState.get(a.file);
      const name = document.createElement("code");
      name.textContent = a.file;
      const flag = document.createElement("span");
      flag.className = `asset-state is-${st ?? "pending"}`;
      flag.textContent = st === "ok" ? "一致" : st === "bad" ? "不一致・読めない" : "照合前";
      li.append(name, " ", flag, ` ${a.bytes.toLocaleString("en-US")} bytes（元：${a.source}）`);
      return li;
    }));
  }

  function showTime() {
    ui.clock.textContent = loading ? "照合中" : !film ? "映像なし（照合失敗）" : `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
  }

  function playLabel() {
    ui.play.textContent = isPlaying ? "一時停止" : current >= DURATION - 0.001 ? "もう一度再生" : "再生";
    ui.play.setAttribute("aria-pressed", String(isPlaying));
  }

  function paint(t) {
    if (!film) throw new Error("素材の照合前は描けません。");
    current = t;
    drawFrame(t);
    ui.time.value = String(t);
    showTime();
    playLabel();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    isPlaying = false;
    playLabel();
  }

  window.seek = (seconds) => {
    const t = clampTime(seconds);
    stop();
    return window.motionReady.then(() => paint(t));
  };

  function previewFrame(now) {
    if (!isPlaying) return;
    const t = Math.min(DURATION, startTime + (now - startNow) / 1000);
    try {
      paint(t);
    } catch (error) {
      fail(error);
      return;
    }
    if (t >= DURATION) stop();
    else raf = requestAnimationFrame(previewFrame);
  }

  function play() {
    if (RENDER || !film || loading) return;
    startTime = current >= DURATION - 0.05 ? 0 : current;
    startNow = performance.now();
    isPlaying = true;
    playLabel();
    raf = requestAnimationFrame(previewFrame);
  }

  function setControls(enabled) {
    for (const c of [ui.play, ui.reset, ui.time, ...ui.sceneList.querySelectorAll("button")]) c.disabled = !enabled || RENDER;
  }

  function buildSceneList(headlines) {
    ui.sceneList.replaceChildren(...SCENE_PLAN.map((s) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.disabled = true;
      const time = document.createElement("span");
      time.className = "scene-time";
      time.textContent = `${s.in}–${s.out}秒`;
      const cases = s.compare ? `記録 ${s.case}・${s.compare}` : `記録 ${s.case}`;
      b.append(time, `${headlines?.[s.id] ?? s.id}（${cases}）`);
      b.addEventListener("click", () => window.seek(s.read).catch(fail));
      li.append(b);
      return li;
    }));
  }

  function setState(name, message) {
    ui.editor.dataset.state = name;
    ui.status.dataset.state = name;
    ui.status.textContent = message;
  }

  function fail(error) {
    stop();
    loading = false;
    film = null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ui.stage.hidden = true;
    setControls(false);
    setState("error", "素材を確かめられなかったため、映像を描いていません。");
    ui.errorText.textContent = error && error.message ? error.message : String(error);
    ui.errorBox.hidden = false;
    ui.retry.disabled = false;
    showAssets();
    showTime();
  }

  function start() {
    if (loading) return window.motionReady;
    stop();
    loading = true;
    film = null;
    assetState.clear();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ui.stage.hidden = true;
    ui.errorBox.hidden = true;
    ui.retry.disabled = true;
    setControls(false);
    current = 0;
    ui.time.value = "0";
    buildSceneList(null);
    showAssets();
    setState("loading", `manifest と素材${ASSETS.length}件の SHA-256、元の実行記録を照合しています…`);
    showTime();
    const ready = load().then((data) => {
      loading = false;
      film = data;
      buildSceneList(data.headlines);
      ui.stage.hidden = false;
      paint(current);
      setControls(true);
      setState("ready", `照合済み（${ASSETS.length} / ${ASSETS.length}素材）。無音の動く説明図です。再生は操作したときだけ始まります。`);
      return true;
    });
    ready.catch(fail);
    window.motionReady = ready;
    return ready;
  }

  ui.play.addEventListener("click", () => (isPlaying ? stop() : play()));
  ui.reset.addEventListener("click", () => window.seek(0).catch(fail));
  ui.time.addEventListener("input", () => window.seek(ui.time.value).catch(fail));
  ui.retry.addEventListener("click", start);
  start();
})();
