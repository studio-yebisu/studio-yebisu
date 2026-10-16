/*
 * Studio Yebisu — Dify 作例・解説動画（28秒・無音・1280×720）
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * Every frame is drawn on one 2D canvas from absolute time only. Ticket fields, memo lines,
 * route names, node titles, edges, rule wording and counts are read from the saved run record,
 * the frozen inputs and workflow.yml after all eight files listed in assets/data-hashes.json
 * match their frozen SHA-256. There is no built-in fallback data: on any mismatch
 * window.motionReady rejects, the failure is shown and no film is drawn.
 * Page text is written with textContent only; input strings are painted as canvas text and
 * are never parsed, evaluated or inserted as HTML.
 */
(() => {
  "use strict";

  // --- Composition contract -------------------------------------------------------------------

  const RENDER = window.__MOTION_RENDER__ === true;
  const requested = window.renderConfig && typeof window.renderConfig === "object" ? window.renderConfig : {};
  const positiveInt = (value, fallback) => (Number.isInteger(value) && value > 0 ? value : fallback);
  const W = positiveInt(requested.width, 1280);
  const H = positiveInt(requested.height, 720);
  const FPS = positiveInt(requested.fps, 30);
  const DURATION = 28;
  const POSTER_TIME = 13.5;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: [] };

  // --- Frozen expectations --------------------------------------------------------------------

  const MANIFEST_PATH = "assets/data-hashes.json";
  const MANIFEST_NAME = "video/assets/data-hashes.json";
  // The manifest must list exactly these eight site-relative files with exactly these digests.
  const FROZEN_HASHES = {
    "outputs/workflow-runs.json": "692cc2f8b07ca77a8b3ccdae0a8abc4359e8a8804985bc4b75db1b56241e6694",
    "outputs/independent-checks.json": "efc466ec2dbd4845a35277225faf419e471872892d08d747130248973f25d2f4",
    "input/tickets.json": "b752f26d73d9fc3f48f8a3389fe876b88d273f2780bc316fdd15232a4d0cdc83",
    "workflow.yml": "d36f345c08705992f654571d35676a211bcae62abcfb6171c8655b308ab0776f",
    "vendor-lock.json": "e454e2189985857c0ac82258dc23b01f0010deecc1cc7bf737ff214d685696ff",
    "video/assets/screens.json": "1f8b5b062368be2ed1e5ff5c7f9a4922140e3b1a016ee2daac289aeb62c2b4fb",
    "video/assets/phone.png": "b5f1194cfc1ecc55f52f72ec4d3e114e3b0cf37bdede2cc1492a65fe745024cd",
    "video/assets/desktop.png": "6404ee75a61253f330febb4a0a46ab855f5ac62458501f05d540f6ef7b0f23b0",
  };
  const ASSET_KEYS = Object.keys(FROZEN_HASHES);
  const FROZEN = {
    format: "studio-yebisu-dify-run-v1",
    repository: "langgenius/dify",
    commit: "f77facfe6520ed379d723288aed0b4806ad76143",
    version: "1.17.1",
    graphon: "0.7.0",
    wheel: "6f7608aaaa65607c4935735137ed4b7029b1e6ca80202cbe829af3370cf4404e",
    sourceFiles: 292,
    checks: 196,
    nodes: 7,
    edges: 8,
  };
  const CASE_IDS = ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08"];
  const INPUT_KEYS = ["ticket_id", "issue", "urgency", "affected_users", "subject", "body"];
  // if-else case order in workflow.yml; "false" is the else branch.
  const ROUTE_ORDER = ["urgent", "billing", "false"];
  const FILE_MESSAGE = "このページをファイルとして直接開くと、素材を読み込んで照合できません。site フォルダーで python -m http.server を実行し、http://localhost:8000/video/ を開いてください。";

  // --- Page ------------------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const ui = {
    editor: $("editor"),
    status: $("status"),
    errorBox: $("error-box"),
    errorText: $("error-text"),
    stage: $("stage"),
    canvas: $("film"),
    play: $("play"),
    reset: $("reset"),
    timeline: $("timeline"),
    time: $("time"),
    counter: $("time-counter"),
    sceneList: $("scene-list"),
    assetSummary: $("asset-summary"),
    assetList: $("asset-list"),
  };

  if (RENDER) {
    document.documentElement.classList.add("is-render");
    ui.canvas.style.width = `${W}px`;
    ui.canvas.style.height = `${H}px`;
  }
  ui.canvas.width = W;
  ui.canvas.height = H;
  const ctx = ui.canvas.getContext("2d", { willReadFrequently: true });
  // Layout is authored in a 1280×720 space and scaled to the requested size.
  const SCALE = Math.min(W / 1280, H / 720);
  const OFFSET_X = (W - 1280 * SCALE) / 2;
  const OFFSET_Y = (H - 720 * SCALE) / 2;

  // --- Loading and checks ---------------------------------------------------------------------

  const BASE = new URL(document.baseURI);

  function check(condition, message) {
    if (!condition) throw new Error(message);
  }

  async function fetchBytes(url, name) {
    check(url.origin === BASE.origin, `${name} が同じ場所のファイルではありません。`);
    let response;
    try {
      response = await fetch(url.href, { cache: "no-store", credentials: "same-origin" });
    } catch {
      throw new Error(`${name} を読み込めませんでした。site フォルダーをローカルの HTTP サーバーで開いてください（例：python -m http.server）。`);
    }
    check(response.ok, `${name} を読み込めませんでした（HTTP ${response.status}）。`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function decodeText(bytes, name) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`${name} が UTF-8 の文字として読めません。`);
    }
  }

  function parseJson(bytes, name) {
    const text = decodeText(bytes, name);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${name} が正しい JSON ではありません。`);
    }
  }

  const assetState = new Map();
  let manifestVerified = false;

  function showAssets() {
    const rows = ASSET_KEYS.filter((key) => assetState.has(key)).map((key) => {
      const item = assetState.get(key);
      const li = document.createElement("li");
      const name = document.createElement("code");
      name.textContent = key;
      const verdict = document.createElement("span");
      verdict.className = item.ok === true ? "verdict is-ok" : item.ok === false ? "verdict is-ng" : "verdict";
      verdict.textContent = item.ok === true ? "一致" : item.ok === false ? "不一致" : "照合中";
      li.append(name, " ", verdict);
      if (item.actual) {
        const digest = document.createElement("code");
        digest.className = "digest";
        digest.textContent = `SHA-256 ${item.actual}`;
        li.append(document.createElement("br"), digest);
      }
      return li;
    });
    ui.assetList.replaceChildren(...rows);
    const ok = [...assetState.values()].filter((item) => item.ok === true).length;
    ui.assetSummary.textContent = manifestVerified
      ? `${MANIFEST_NAME} の8件の対象とハッシュは、この映像ソースに固定した値と一致。読み込んだ素材のうち${ok}件の SHA-256 が一致しました。`
      : `${MANIFEST_NAME} の照合が済んでいません。`;
  }

  async function loadFonts() {
    if (!document.fonts) return;
    const sample = "問い合わせを3つの担当へ 優先対応 請求窓口 通常窓口 0123456789 {{ 7 * 7 }} <script>";
    const specs = [500, 600, 700, 800].map((weight) => font(24, weight)).concat([font(16, 700, MONO)]);
    await Promise.all(specs.map((spec) => document.fonts.load(spec, sample).catch(() => [])));
    await document.fonts.ready;
  }

  async function load() {
    check(location.protocol !== "file:", FILE_MESSAGE);
    check(globalThis.crypto && crypto.subtle, "このブラウザーでは SHA-256 を計算できません。https か http://localhost で開いてください。");
    const manifestBytes = await fetchBytes(new URL(MANIFEST_PATH, BASE), MANIFEST_NAME);
    const manifest = parseJson(manifestBytes, MANIFEST_NAME);
    const hashes = manifest && manifest.files;
    check(hashes && typeof hashes === "object" && !Array.isArray(hashes), `${MANIFEST_NAME} に files がありません。`);
    check(Object.keys(hashes).length === ASSET_KEYS.length && ASSET_KEYS.every((key) => hashes[key] === FROZEN_HASHES[key]),
      `${MANIFEST_NAME} の対象またはハッシュが、固定した8件と一致しません。`);
    for (const key of ASSET_KEYS) {
      check(!key.startsWith("/") && !key.split("/").includes(".."), `${key} は site の中の相対パスではありません。`);
      assetState.set(key, { ok: null, actual: null });
    }
    manifestVerified = true;
    showAssets();

    const bytes = {};
    await Promise.all(ASSET_KEYS.map(async (key) => {
      const data = await fetchBytes(new URL(`../${key}`, BASE), key);
      const actual = await sha256Hex(data);
      assetState.set(key, { ok: actual === hashes[key], actual });
      showAssets();
      check(actual === hashes[key], `${key} の SHA-256 が data-hashes.json と一致しません。`);
      bytes[key] = data;
    }));

    const json = {};
    const bitmaps = {};
    let workflowText = "";
    for (const key of ASSET_KEYS) {
      if (key.endsWith(".json")) {
        json[key] = parseJson(bytes[key], key);
      } else if (key.endsWith(".yml")) {
        workflowText = decodeText(bytes[key], key);
      } else {
        try {
          bitmaps[key] = await createImageBitmap(new Blob([bytes[key]], { type: "image/png" }));
        } catch {
          throw new Error(`${key} を画像として読めません。`);
        }
      }
    }
    const model = buildModel(json, workflowText, hashes, bitmaps);
    await loadFonts();
    return model;
  }

  function buildModel(json, workflowText, hashes, bitmaps) {
    const run = json["outputs/workflow-runs.json"];
    const audit = json["outputs/independent-checks.json"];
    const tickets = json["input/tickets.json"];
    const lock = json["vendor-lock.json"];
    const screensDoc = json["video/assets/screens.json"];

    // Pinned source, runtime dependency, lock and inputs.
    check(run && run.format === FROZEN.format, "実行記録の形式が違います。");
    const source = run.source || {};
    check(source.repository === FROZEN.repository && source.commit === FROZEN.commit && source.version === FROZEN.version,
      "実行記録の原典・固定コミット・版が固定値と一致しません。");
    const dependency = run.runtime_dependency || {};
    check(dependency.name === "graphon" && dependency.version === FROZEN.graphon && dependency.wheel_sha256 === FROZEN.wheel,
      "実行記録の graphon の版または wheel の SHA-256 が固定値と一致しません。");
    check(run.source_lock_sha256 === hashes["vendor-lock.json"], "実行記録の vendor-lock.json の SHA-256 が一致しません。");
    const lockDependency = (lock && lock.runtime_dependency) || {};
    check(lock && lock.repository === FROZEN.repository && lock.commit === FROZEN.commit && lock.version === FROZEN.version
      && lockDependency.name === "graphon" && lockDependency.version === FROZEN.graphon && lockDependency.wheel_sha256 === FROZEN.wheel
      && Array.isArray(lock.files) && lock.files.length === FROZEN.sourceFiles,
      "vendor-lock.json の固定版または件数が違います。");
    const inputHashes = run.input_sha256 || {};
    for (const key of ["input/tickets.json", "workflow.yml"]) {
      check(inputHashes[key] === hashes[key], `${key} の SHA-256 が実行記録と一致しません。`);
    }
    const runtime = run.runtime || {};
    check(runtime.network_attempts === 0 && runtime.process_attempts === 0 && runtime.server_started === false
      && runtime.llm_called === false && runtime.credentials === null,
      "実行記録に通信・子プロセス・サーバー・LLM・認証のいずれかが記録されています。");
    const checks = run.checks || {};
    check(checks.passed === true && checks.count === FROZEN.checks && Array.isArray(checks.items) && checks.items.length === FROZEN.checks,
      "実行記録の自動確認がすべて合格になっていません。");

    // Independent checks.
    check(audit && audit.status === "passed" && audit.source_commit === FROZEN.commit
      && audit.run_sha256 === hashes["outputs/workflow-runs.json"] && audit.source_files_verified === FROZEN.sourceFiles
      && audit.all49_topology_pairs_match === true && audit.raw_api_record_unchanged === true
      && Array.isArray(audit.cases) && audit.cases.length === CASE_IDS.length,
      "独立した照合が合格になっていません。");

    // Frozen fictional inputs.
    check(tickets && tickets.fictional === true && Array.isArray(tickets.cases)
      && tickets.cases.map((item) => item.id).join(",") === CASE_IDS.join(","), "input/tickets.json が架空の8件 D01〜D08 ではありません。");
    check(Array.isArray(run.cases) && run.cases.map((item) => item.id).join(",") === CASE_IDS.join(","),
      "実行記録の問い合わせが D01〜D08 の順ではありません。");

    // Graph: node IDs from Dify's WorkflowGraphTopology, edges and titles from actual engine events.
    const topology = run.topology || {};
    check(Array.isArray(topology.node_ids) && topology.node_ids.length === FROZEN.nodes
      && topology.node_ids.every((id) => Object.hasOwn(NODE_LAYOUT, id)), "実行記録のノードが7つの予定の ID ではありません。");
    const edgeSet = new Map();
    const titles = {};
    const routeNames = {};
    const cases = run.cases.map((item, index) => {
      const frozen = tickets.cases[index];
      check(item.label === frozen.label && item.input && frozen.input, `${item.id} の名前または入力がありません。`);
      check(Object.keys(item.input).length === INPUT_KEYS.length && INPUT_KEYS.every((key) => item.input[key] === frozen.input[key]),
        `${item.id} の入力が input/tickets.json と一致しません。`);
      const output = item.output || {};
      check(typeof output.text === "string" && ROUTE_ORDER.includes(output.selected_case_id)
        && Array.isArray(output.node_path) && output.node_path.length === 5, `${item.id} の出力の形が違います。`);
      const events = Array.isArray(item.events) ? item.events : [];
      const last = events[events.length - 1] || {};
      const finalOutputs = (last.data && last.data.outputs) || {};
      check(events.length > 0 && events[0].type === "GraphRunStartedEvent" && last.type === "GraphRunSucceededEvent"
        && finalOutputs.text === output.text && finalOutputs.selected_case_id === output.selected_case_id,
        `${item.id} の最後のイベントが出力と一致しません。`);
      check(!events.some((event) => /Fail|Exception|Abort|Pause/.test(String(event.type))), `${item.id} に失敗のイベントがあります。`);
      const taken = [];
      for (const event of events) {
        const data = event.data || {};
        if (event.type === "GraphEdgeTakenEvent" || event.type === "GraphEdgeSkippedEvent") {
          const pair = `${data.source_node_id}>${data.target_node_id}`;
          edgeSet.set(pair, { source: data.source_node_id, target: data.target_node_id });
          if (event.type === "GraphEdgeTakenEvent") taken.push(pair);
        }
        if (event.type === "NodeRunStartedEvent") {
          check(typeof data.node_title === "string" && (!titles[data.node_id] || titles[data.node_id] === data.node_title),
            `${item.id} のノード名が一定ではありません。`);
          titles[data.node_id] = data.node_title;
        }
      }
      const path = output.node_path;
      const pathPairs = path.slice(1).map((node, k) => `${path[k]}>${node}`);
      check(taken.join(",") === pathPairs.join(","), `${item.id} の通った線がノードの順と一致しません。`);
      check(Array.isArray(item.checks) && item.checks.length > 0, `${item.id} の確認がありません。`);
      const audited = audit.cases[index];
      check(audited && audited.id === item.id && audited.route === output.selected_case_id
        && Array.isArray(audited.actual_node_path) && audited.actual_node_path.join(",") === path.join(",")
        && audited.exact_input_and_final_event === true && audited.memo_is_real_node_output === true && audited.llm_tokens === 0,
        `${item.id} が独立した照合と一致しません。`);
      const lines = output.text.split("\n");
      const head = /^【担当】(.+)$/.exec(lines[0]);
      check(head, `${item.id} のメモの1行目が【担当】ではありません。`);
      const known = routeNames[output.selected_case_id];
      check(!known || known === head[1], `${item.id} の担当名が同じ分岐の他の記録と一致しません。`);
      routeNames[output.selected_case_id] = head[1];
      return { id: item.id, label: item.label, input: item.input, text: output.text, lines, route: output.selected_case_id, path, pathPairs };
    });
    check(edgeSet.size === FROZEN.edges && [...edgeSet.values()].every((edge) => topology.node_ids.includes(edge.source) && topology.node_ids.includes(edge.target)),
      "実際のイベントから読んだ線が8本ではありません。");
    check(topology.node_ids.every((id) => typeof titles[id] === "string"), "7つのノードの名前がイベントにそろっていません。");

    const byId = Object.fromEntries(cases.map((item) => [item.id, item]));
    const routes = ROUTE_ORDER.map((id) => ({ id, name: routeNames[id], ids: cases.filter((item) => item.route === id).map((item) => item.id) }));
    check(routes.every((route) => typeof route.name === "string" && route.ids.length > 0) && new Set(routes.map((route) => route.name)).size === routes.length,
      "3つの担当名がそろっていません。");
    const auditCounts = audit.route_counts || {};
    check(Object.keys(auditCounts).length === routes.length && routes.every((route) => auditCounts[route.name] === route.ids.length),
      "担当ごとの件数が独立した照合と一致しません。");

    // Rule wording copied from workflow.yml (route node description).
    check(/^kind: app$/m.test(workflowText) && /^version: 0\.3\.0$/m.test(workflowText) && /^ {2}mode: workflow$/m.test(workflowText),
      "workflow.yml が Dify DSL（kind: app・version 0.3.0・mode: workflow）ではありません。");
    const desc = /desc: (上から順に判定し、[^。\n]+。)\s*1\. (\S+) 2\. (\S+) 3\. ([^。\n]+)。/.exec(workflowText);
    check(desc, "workflow.yml に判定順の説明が見つかりません。");
    const rules = [desc[2], desc[3], desc[4]];
    const threshold = /影響人数(\d+)人以上/.exec(rules[0]);
    check(threshold && workflowText.includes("comparison_operator: ≥") && workflowText.includes(`value: '${threshold[1]}'`),
      "workflow.yml の人数の条件が説明と一致しません。");
    const limit = Number(threshold[1]);

    // The five cases the film shows, with the facts each scene states.
    const d02 = byId.D02;
    const d04 = byId.D04;
    const d05 = byId.D05;
    const d06 = byId.D06;
    const d07 = byId.D07;
    check(d02.route === "billing", "D02 が請求の分岐を通っていません。");
    check(d06.route === "urgent" && rules[0].includes(d06.input.urgency) && rules[1].includes(d06.input.issue),
      "D06 が「請求でも至急を先に」の例になっていません。");
    check(d04.route === "false" && d05.route === "urgent" && d04.input.affected_users === limit - 1 && d05.input.affected_users === limit
      && d04.input.issue === d05.input.issue && d04.input.urgency === d05.input.urgency && !rules[0].startsWith(d04.input.urgency),
      "D04・D05 が人数の境目の例になっていません。");
    const subjectLine7 = `件名：${d07.input.subject}`;
    const bodyLines7 = d07.input.body.split("\n");
    const expression7 = /^\{\{[^}]*\}\}/.exec(d07.input.subject);
    check(expression7 && d07.input.body.includes("<script>") && d07.lines.includes(subjectLine7)
      && d07.lines.includes(bodyLines7[0]) && d07.text.includes(d07.input.body) && !d07.text.includes("49"),
      "D07 の入力がメモにそのまま入っていません。");

    // Recorded viewer screenshots.
    check(screensDoc && Array.isArray(screensDoc.screens) && screensDoc.screens.length === 2, "video/assets/screens.json の形が違います。");
    const shots = {};
    for (const screen of screensDoc.screens) {
      const bitmap = bitmaps[screen.file];
      check(bitmap && screen.sha256 === hashes[screen.file] && screen.actual_native_browser_screenshot === true
        && screen.byte_identical_to_capture === true && screen.edited === false
        && bitmap.width === screen.width && bitmap.height === screen.height && CASE_IDS.includes(screen.sample),
        `${screen.file} が記録された実画面と一致しません。`);
      shots[screen.height > screen.width ? "phone" : "desktop"] = { bitmap, width: screen.width, height: screen.height, sample: screen.sample };
    }
    check(shots.phone && shots.desktop && shots.phone.sample === "D05" && shots.desktop.sample === "D02",
      "スマホ（D05）とデスクトップ（D02）の実画面がそろっていません。");

    const model = {
      version: source.version,
      graphon: dependency.version,
      cases,
      byId,
      routes,
      routeIndex: Object.fromEntries(routes.map((route, k) => [route.id, k])),
      titles,
      nodeIds: topology.node_ids,
      edges: [...edgeSet.values()],
      rules,
      ruleLead: desc[1],
      limit,
      limitLabel: `${limit}人以上`,
      d07: { expression: expression7[0], subjectLine: subjectLine7, bodyFirst: bodyLines7[0], bodyRest: bodyLines7.slice(1).join(" ") },
      shots,
    };
    model.tracks = buildTracks(model);
    return model;
  }

  // --- Drawing kit ----------------------------------------------------------------------------

  const SANS = '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", YuGothic, Meiryo, sans-serif';
  const MONO = 'Consolas, "Cascadia Mono", Menlo, "Noto Sans Mono", monospace';
  const C = {
    ivory: "#f6f1e6",
    paper: "#fffcf5",
    navy: "#14213d",
    ink: "#1c2333",
    muted: "#586174",
    cobalt: "#2745c4",
    cobaltSoft: "#e4e8fb",
    teal: "#157a74",
    tealSoft: "#dcefec",
    slate: "#3e4c66",
    slateSoft: "#e7e9ef",
    yellow: "#f2c14e",
    yellowSoft: "#fbefcd",
    line: "#d8cfbc",
  };
  // Route colours follow the if-else order: urgent, billing, else.
  const ROUTE_COLOR = { urgent: C.cobalt, billing: C.teal, false: C.slate };
  const ROUTE_SOFT = { urgent: C.cobaltSoft, billing: C.tealSoft, false: C.slateSoft };

  function font(size, weight = 400, family = SANS) {
    return `${weight} ${size}px ${family}`;
  }
  const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
  const lerp = (a, b, p) => a + (b - a) * p;
  const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);
  const easeInOut = (p) => {
    const x = clamp01(p);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const prog = (t, start, duration) => clamp01((t - start) / duration);
  // 0 → 1 while entering, 1 while held, 1 → 0 while leaving (outAt = null keeps it).
  function fadeWindow(t, inAt, inDuration, outAt, outDuration) {
    const enter = easeOut(prog(t, inAt, inDuration));
    const leave = outAt == null ? 0 : easeInOut(prog(t, outAt, outDuration));
    return Math.min(enter, 1 - leave);
  }

  function layer(alpha, dy, paint) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, alpha);
    if (dy) ctx.translate(0, dy);
    paint();
    ctx.restore();
  }

  function textWidth(text, size, weight = 400, family = SANS) {
    ctx.font = font(size, weight, family);
    return ctx.measureText(text).width;
  }

  function fitSize(text, maxWidth, size, weight = 400, min = 12, family = SANS) {
    let current = size;
    while (current > min && textWidth(text, current, weight, family) > maxWidth) current -= 1;
    return current;
  }

  function say(text, x, y, size, options = {}) {
    ctx.font = font(size, options.weight ?? 400, options.family ?? SANS);
    ctx.fillStyle = options.color ?? C.ink;
    ctx.textAlign = options.align ?? "left";
    ctx.fillText(text, x, y);
    const width = ctx.measureText(text).width;
    ctx.textAlign = "left";
    return width;
  }

  function rr(x, y, w, h, r) {
    const k = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.arcTo(x + w, y, x + w, y + h, k);
    ctx.arcTo(x + w, y + h, x, y + h, k);
    ctx.arcTo(x, y + h, x, y, k);
    ctx.arcTo(x, y, x + w, y, k);
    ctx.closePath();
  }

  function panel(x, y, w, h, options = {}) {
    ctx.save();
    if (options.shadow !== false) {
      ctx.shadowColor = "rgba(20, 33, 61, 0.12)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 5;
    }
    rr(x, y, w, h, options.r ?? 14);
    ctx.fillStyle = options.fill ?? C.paper;
    ctx.fill();
    ctx.restore();
    rr(x, y, w, h, options.r ?? 14);
    ctx.lineWidth = options.lineWidth ?? 1.5;
    ctx.strokeStyle = options.stroke ?? C.line;
    if (options.dash) ctx.setLineDash(options.dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function disc(cx, cy, r, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = lineWidth ?? 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function chip(label, x, cy, color, soft, size = 14) {
    const w = textWidth(label, size, 700, MONO) + 14;
    rr(x, cy - size, w, size * 2, 6);
    ctx.fillStyle = soft;
    ctx.fill();
    say(label, x + 7, cy + size * 0.36, size, { weight: 700, family: MONO, color });
    return w;
  }

  // A yellow pencil stroke revealed left to right. The wobble depends on x only, so the
  // stroke keeps its shape while it grows.
  function pencil(x0, x1, y, p, seed, width = 9, color = C.yellow) {
    const reveal = clamp01(p);
    if (reveal <= 0 || x1 <= x0) return;
    const end = lerp(x0, x1, reveal);
    const wobble = (x) => y + Math.sin((x - x0) / 37 + seed) * 1.6 + Math.sin((x - x0) / 11 + seed * 2.3) * 0.6;
    ctx.save();
    ctx.globalAlpha *= 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, wobble(x0));
    for (let x = x0 + 12; x < end; x += 12) ctx.lineTo(x, wobble(x));
    ctx.lineTo(end, wobble(end));
    ctx.stroke();
    ctx.restore();
  }

  function arrowHead(x, y, angle, color, size = 11) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * Math.cos(angle - 0.45), y - size * Math.sin(angle - 0.45));
    ctx.lineTo(x - size * Math.cos(angle + 0.45), y - size * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();
  }

  function arrow(x0, y0, x1, y1, p, color, width = 2.5) {
    const reveal = clamp01(p);
    if (reveal <= 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(lerp(x0, x1, reveal), lerp(y0, y1, reveal));
    ctx.stroke();
    const head = clamp01((reveal - 0.8) / 0.2);
    if (head > 0) {
      ctx.globalAlpha *= head;
      arrowHead(x1, y1, Math.atan2(y1 - y0, x1 - x0), color);
    }
    ctx.restore();
  }

  // Cubic curve revealed from its start; "v" bends vertically, "h" horizontally.
  function curve(x0, y0, x1, y1, p, color, width, mode, options = {}) {
    const reveal = clamp01(p);
    if (reveal <= 0) return;
    const bend = mode === "v" ? Math.abs(y1 - y0) * 0.5 : Math.abs(x1 - x0) * 0.5;
    const c1 = mode === "v" ? [x0, y0 + bend] : [x0 + bend, y0];
    const c2 = mode === "v" ? [x1, y1 - bend] : [x1 - bend, y1];
    const at = (u) => {
      const v = 1 - u;
      return [
        v * v * v * x0 + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * x1,
        v * v * v * y0 + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * y1,
      ];
    };
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    if (options.dash) ctx.setLineDash(options.dash);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    const steps = 32;
    for (let i = 1; i <= steps; i++) {
      const u = (i / steps) * reveal;
      const [x, y] = at(u);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (options.head && reveal > 0.85) {
      const [ax, ay] = at(reveal);
      const [bx, by] = at(Math.max(0, reveal - 0.04));
      ctx.globalAlpha *= clamp01((reveal - 0.85) / 0.15);
      arrowHead(ax, ay, Math.atan2(ay - by, ax - bx), color, 10);
    }
    ctx.restore();
  }

  // Draws an actual screenshot whole, scaled to fit the box at its own aspect ratio.
  function drawShot(shot, x, y, boxW, boxH) {
    const scale = Math.min(boxW / shot.width, boxH / shot.height);
    const w = shot.width * scale;
    const h = shot.height * scale;
    const left = x + (boxW - w) / 2;
    const top = y + (boxH - h) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(20, 33, 61, 0.18)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = C.paper;
    ctx.fillRect(left, top, w, h);
    ctx.restore();
    ctx.drawImage(shot.bitmap, left, top, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(20, 33, 61, 0.35)";
    ctx.strokeRect(left - 0.5, top - 0.5, w + 1, h + 1);
    return { left, top, w, h };
  }

  // --- Timeline -------------------------------------------------------------------------------

  const SCENES = [
    { n: 1, start: 0, end: 4, hold: 3.2, ids: "D01–D08", steps: [0, 1, 2, 3] },
    { n: 2, start: 4, end: 8, hold: 7.0, ids: "D02", steps: [1, 2] },
    { n: 3, start: 8, end: 12, hold: 11.0, ids: "D06", steps: [1] },
    { n: 4, start: 12, end: 18, hold: 13.5, ids: "D04 → D05", steps: [1] },
    { n: 5, start: 18, end: 22, hold: 21.0, ids: "D07", steps: [2] },
    { n: 6, start: 22, end: 28, hold: 26.0, ids: "D01–D08", steps: [3] },
  ];
  const OPERATION = ["問い合わせを入力", "ルールで担当へ", "引き継ぎメモ", "JSON/DSLを持ち帰る"];
  const RAIL = ["入力", "ルール", "メモ", "持ち帰る"];

  function writeHeadlines(m) {
    const heads = [
      `問い合わせを、${m.routes.length}つの担当へ。`,
      "ルールで、担当のメモへ。",
      "請求でも、至急を先に。",
      `${m.limitLabel}は、優先対応へ。`,
      "入力は、そのままメモに。",
      `${m.cases.length}件の入力と結果を、持ち帰る。`,
    ];
    SCENES.forEach((scene, i) => { scene.head = heads[i]; });
  }

  const sceneAt = (t) => SCENES.reduce((found, scene) => (t >= scene.start ? scene : found), SCENES[0]);

  // Ticket cards: eight small cards in a row (scene 1); the case each later scene shows grows
  // out of its own slot, so one card stays one ticket throughout.
  const SLOT = { y: 200, w: 132, h: 96 };
  const SLOT_GAP = (1152 - 8 * SLOT.w) / 7;
  const slotOf = (i) => ({ x: 64 + i * (SLOT.w + SLOT_GAP), y: SLOT.y, w: SLOT.w, h: SLOT.h });
  const R2 = { x: 64, y: 470, w: 330, h: 160 };
  const R3 = { x: 64, y: 180, w: 1152, h: 110 };
  const R4 = { x: 64, y: 184, w: 380, h: 330 };
  const R5 = { x: 64, y: 190, w: 540, h: 300 };
  const PROPS = ["x", "y", "w", "h", "a"];

  // Each card is a list of keyed states. A key eases from the accumulated state over d seconds
  // starting at its own time, so any time can be evaluated directly.
  function buildTracks(m) {
    const tracks = {};
    m.cases.forEach((item, i) => {
      const slot = slotOf(i);
      const keys = [
        { at: 0, d: 0, ...slot, y: slot.y + 24, a: 0 },
        { at: 0.35 + i * 0.12, d: 0.4, y: slot.y, a: 1, ease: "out" },
      ];
      if (item.id === "D02") {
        keys.push({ at: 4.0, d: 0.5, ...R2 });
        keys.push({ at: 7.65, d: 0.35, a: 0 });
      } else {
        keys.push({ at: 3.65, d: 0.35, a: 0 });
      }
      if (item.id === "D06") {
        keys.push({ at: 8.0, d: 0, ...slot, a: 0 });
        keys.push({ at: 8.0, d: 0.5, ...R3, a: 1 });
        keys.push({ at: 11.65, d: 0.35, a: 0 });
      }
      if (item.id === "D04") {
        keys.push({ at: 12.0, d: 0, ...slot, a: 0 });
        keys.push({ at: 12.0, d: 0.5, ...R4, a: 1 });
        keys.push({ at: 14.7, d: 0.3, a: 0 }); // dip: D04 is fully gone before D05 appears
      }
      if (item.id === "D05") {
        keys.push({ at: 15.0, d: 0, ...R4, y: R4.y + 16, a: 0 });
        keys.push({ at: 15.0, d: 0.3, y: R4.y, a: 1, ease: "out" });
        keys.push({ at: 17.65, d: 0.35, a: 0 });
      }
      if (item.id === "D07") {
        keys.push({ at: 18.0, d: 0, ...slot, a: 0 });
        keys.push({ at: 18.0, d: 0.5, ...R5, a: 1 });
        keys.push({ at: 21.65, d: 0.35, a: 0 });
      }
      tracks[item.id] = keys;
    });
    return tracks;
  }

  function sampleTrack(keys, t) {
    const value = { ...keys[0] };
    for (let i = 1; i < keys.length; i++) {
      const key = keys[i];
      if (t < key.at) break;
      const raw = key.d > 0 ? (t - key.at) / key.d : 1;
      const p = key.ease === "out" ? easeOut(raw) : easeInOut(raw);
      for (const prop of PROPS) if (key[prop] !== undefined) value[prop] = lerp(value[prop], key[prop], p);
    }
    return value;
  }

  // --- Layout of the workflow diagram (explanatory graphic) ----------------------------------

  const NODE_W = 200;
  const NODE_H = 56;
  const COLS = [64, 302, 540, 778, 1016];
  const NODE_LAYOUT = {
    start: [0, 318],
    route: [1, 318],
    "urgent-note": [2, 246],
    "billing-note": [2, 318],
    "support-note": [2, 390],
    merge: [3, 318],
    end: [4, 318],
  };
  const nodeBox = (id) => ({ x: COLS[NODE_LAYOUT[id][0]], y: NODE_LAYOUT[id][1] - NODE_H / 2, cy: NODE_LAYOUT[id][1] });
  const ROUTE_CX = [256, 640, 1024];

  // --- Persistent frame -----------------------------------------------------------------------

  function drawFrame(t) {
    const scene = sceneAt(t);
    const label = "Dify ワークフローの実行記録から";
    const w = say(label, 64, 44, 15, { weight: 700, color: C.navy });
    say(scene.ids, 64 + w + 14, 44, 15, { weight: 700, family: MONO, color: C.cobalt });

    // Operation rail: 入力 → ルール → メモ → 持ち帰る, current step in cobalt.
    const size = 16;
    const sep = " → ";
    let x = 1216 - RAIL.reduce((sum, step, i) => sum + textWidth(step, size, 800) + (i ? textWidth(sep, size, 700) : 0), 0);
    RAIL.forEach((step, i) => {
      if (i) x += say(sep, x, 44, size, { weight: 700, color: C.line });
      const on = scene.steps.includes(i);
      const sw = textWidth(step, size, 800);
      if (on && scene.n > 1) pencil(x - 2, x + sw + 2, 50, 1, 1.3 + i, 6);
      x += say(step, x, 44, size, { weight: 800, color: on ? C.navy : C.muted });
    });

    ctx.fillStyle = C.line;
    ctx.fillRect(64, 61, 1152, 1);
    ctx.fillRect(64, 660, 1152, 1);
    say("Dify DSLの実行記録・無音", 64, 694, 17, { weight: 700, color: C.navy });
    say("Studio Yebisu", 1216, 694, 15, { weight: 600, color: C.muted, align: "right" });
  }

  function drawHeadline(t) {
    for (const scene of SCENES) {
      const last = scene.n === SCENES.length;
      const inAt = scene.start === 0 ? 0.1 : scene.start;
      const alpha = fadeWindow(t, inAt, 0.4, last ? null : scene.end - 0.3, 0.3);
      if (alpha <= 0.002) continue;
      const dy = (1 - easeOut(prog(t, inAt, 0.4))) * 18 - (last ? 0 : easeInOut(prog(t, scene.end - 0.3, 0.3))) * 12;
      const size = fitSize(scene.head, 1060, 60, 800, 44);
      layer(alpha, 0, () => {
        disc(92, 112, 24, C.yellow);
        say(String(scene.n), 92, 121, 24, { weight: 800, color: C.navy, align: "center" });
        say(scene.head, 136, 133 + dy, size, { weight: 800, color: C.navy });
      });
    }
  }

  // --- Ticket cards ---------------------------------------------------------------------------

  function drawSmallTicket(item, s) {
    say(item.id, s.x + 16, s.y + 28, 15, { weight: 700, family: MONO, color: C.navy });
    const kind = `${item.input.issue}・${item.input.urgency}`;
    say(kind, s.x + 16, s.y + 60, fitSize(kind, s.w - 28, 21, 800, 14), { weight: 800, color: C.ink });
    say(`影響${item.input.affected_users}人`, s.x + 16, s.y + 85, 17, { weight: 600, color: C.muted });
  }

  const LARGE = {
    D02(item, s) {
      say(`${item.id} の入力`, s.x + 26, s.y + 36, 16, { weight: 700, color: C.muted });
      say(item.input.subject, s.x + 26, s.y + 80, fitSize(item.input.subject, s.w - 52, 26, 800, 16), { weight: 800 });
      const meta = `${item.input.issue}・${item.input.urgency}／影響${item.input.affected_users}人`;
      say(meta, s.x + 26, s.y + 116, fitSize(meta, s.w - 52, 21, 700, 14), { weight: 700, color: C.navy });
      say(item.input.ticket_id, s.x + 26, s.y + 144, 16, { weight: 700, family: MONO, color: C.muted });
    },
    D06(item, s, t) {
      say(`${item.id} の入力 ・ ${item.input.ticket_id}`, s.x + 28, s.y + 36, 16, { weight: 700, color: C.muted });
      say(item.input.subject, s.x + 28, s.y + 84, fitSize(item.input.subject, 500, 30, 800, 18), { weight: 800 });
      const fields = [
        ["種類", item.input.issue, ROUTE_COLOR.billing],
        ["緊急度", item.input.urgency, ROUTE_COLOR.urgent],
        ["影響人数", `${item.input.affected_users}人`, C.ink],
      ];
      fields.forEach(([label, value, color], k) => {
        const fx = s.x + 600 + k * 190;
        say(label, fx, s.y + 38, 17, { weight: 700, color: C.muted });
        if (k < 2) pencil(fx - 4, fx + textWidth(value, 36, 800) + 4, s.y + 92, easeOut(prog(t, 8.7 + k * 0.15, 0.35)), 2 + k, 10);
        say(value, fx, s.y + 88, 36, { weight: 800, color });
      });
    },
    D04: boundaryCard,
    D05: boundaryCard,
    D07(item, s) {
      say(`${item.id} の入力`, s.x + 28, s.y + 38, 17, { weight: 700, color: C.muted });
      say("件名", s.x + 28, s.y + 82, 17, { weight: 700, color: C.muted });
      say(item.input.subject, s.x + 28, s.y + 126, fitSize(item.input.subject, s.w - 56, 30, 800, 16), { weight: 800, color: C.navy });
      say("本文", s.x + 28, s.y + 176, 17, { weight: 700, color: C.muted });
      say(M.d07.bodyFirst, s.x + 28, s.y + 216, fitSize(M.d07.bodyFirst, s.w - 56, 22, 700, 13, MONO), { weight: 700, family: MONO, color: C.ink });
      if (M.d07.bodyRest) say(M.d07.bodyRest, s.x + 28, s.y + 254, fitSize(M.d07.bodyRest, s.w - 56, 18, 600, 12), { weight: 600, color: C.muted });
    },
  };

  function boundaryCard(item, s) {
    const color = ROUTE_COLOR[item.route];
    say(`${item.id} の入力 ・ ${item.input.ticket_id}`, s.x + 28, s.y + 38, 17, { weight: 700, color: C.muted });
    say("影響人数", s.x + 28, s.y + 84, 22, { weight: 800, color: C.navy });
    const w = say(String(item.input.affected_users), s.x + 24, s.y + 236, 150, { weight: 800, color });
    say("人", s.x + 24 + w + 8, s.y + 236, 40, { weight: 800, color: C.navy });
    say(`${item.input.issue}・${item.input.urgency}`, s.x + 28, s.y + 282, 24, { weight: 800, color: C.ink });
    say(item.input.subject, s.x + 28, s.y + 314, fitSize(item.input.subject, s.w - 56, 19, 600, 12), { weight: 600, color: C.muted });
  }

  function drawTicket(item, s, t) {
    layer(s.a, 0, () => {
      panel(s.x, s.y, s.w, s.h, { r: 12 });
      ctx.save();
      rr(s.x, s.y, s.w, s.h, 12);
      ctx.clip();
      ctx.fillStyle = C.line;
      ctx.fillRect(s.x, s.y, 6, s.h);
      // The route colour appears once the actual results are shown (scene 1, 1.6 s).
      layer(t >= 4 ? 1 : easeOut(prog(t, 1.6, 0.4)), 0, () => {
        ctx.fillStyle = ROUTE_COLOR[item.route];
        ctx.fillRect(s.x, s.y, 6, s.h);
      });
      const detail = clamp01((s.w - SLOT.w) / 90);
      layer(1 - detail, 0, () => drawSmallTicket(item, s));
      if (detail > 0 && LARGE[item.id]) layer(detail, 0, () => LARGE[item.id](item, s, t));
      ctx.restore();
    });
  }

  function drawCards(t) {
    for (const item of M.cases) {
      const state = sampleTrack(M.tracks[item.id], t);
      if (state.a > 0.002) drawTicket(item, state, t);
    }
  }

  // --- Scene 1: eight inputs, three routes ----------------------------------------------------

  function drawOpening(t) {
    layer(fadeWindow(t, 0.2, 0.4, 3.65, 0.35), 0, () => {
      say(`架空の問い合わせ ${M.cases.length}件（実行前に固定）`, 64, 184, 16, { weight: 700, color: C.muted });
    });
    M.routes.forEach((route, k) => {
      const cx = ROUTE_CX[k];
      layer(fadeWindow(t, 1.1 + k * 0.1, 0.4, 3.65, 0.35), 0, () => {
        panel(cx - 165, 420, 330, 84, { fill: ROUTE_SOFT[route.id], stroke: ROUTE_COLOR[route.id], lineWidth: 2, shadow: false });
        say(route.name, cx, 476, 40, { weight: 800, color: ROUTE_COLOR[route.id], align: "center" });
      });
    });
    layer(fadeWindow(t, 1.6, 0.05, 3.65, 0.35), 0, () => {
      M.cases.forEach((item, i) => {
        const k = M.routeIndex[item.route];
        const group = M.routes[k].ids;
        const j = group.indexOf(item.id);
        const slot = slotOf(i);
        const x1 = ROUTE_CX[k] + (j - (group.length - 1) / 2) * 24;
        curve(slot.x + slot.w / 2, slot.y + slot.h + 6, x1, 414, easeOut(prog(t, 1.7 + i * 0.06, 0.5)), ROUTE_COLOR[item.route], 2.5, "v", { head: true });
      });
    });
    layer(fadeWindow(t, 2.3, 0.4, 3.65, 0.35), 0, () => {
      say("線の行き先は、実際に返ったメモの1行目【担当】", 640, 544, 20, { weight: 700, color: C.muted, align: "center" });
    });
    layer(fadeWindow(t, 2.5, 0.4, 3.65, 0.35), 0, () => {
      const size = 26;
      const sep = "  →  ";
      const total = OPERATION.reduce((sum, step, i) => sum + textWidth(step, size, 800) + (i ? textWidth(sep, size, 800) : 0), 0);
      let x = 640 - total / 2;
      OPERATION.forEach((step, i) => {
        if (i) x += say(sep, x, 612, size, { weight: 800, color: C.cobalt });
        x += say(step, x, 612, size, { weight: 800, color: C.navy });
      });
    });
  }

  // --- Scene 2: the seven-node workflow and D02's actual path ---------------------------------

  function drawWorkflow(t) {
    const d02 = M.byId.D02;
    const color = ROUTE_COLOR[d02.route];
    const soft = ROUTE_SOFT[d02.route];
    const edgeAt = (k) => 4.6 + k * 0.32;
    layer(fadeWindow(t, 4.05, 0.4, 7.65, 0.35), 0, () => {
      say(`説明図：workflow.yml の${M.nodeIds.length}ノード・${M.edges.length}本の線。色は ${d02.id} で実際に通った道。`, 64, 186, 17, { weight: 700, color: C.muted });

      for (const edge of M.edges) {
        const a = nodeBox(edge.source);
        const b = nodeBox(edge.target);
        const k = d02.pathPairs.indexOf(`${edge.source}>${edge.target}`);
        curve(a.x + NODE_W, a.cy, b.x, b.cy, 1, C.line, 2, "h", { dash: k < 0 ? [6, 6] : null });
        if (k >= 0) curve(a.x + NODE_W, a.cy, b.x - 2, b.cy, easeInOut(prog(t, edgeAt(k), 0.32)), color, 4, "h", { head: true });
      }

      for (const id of M.nodeIds) {
        const box = nodeBox(id);
        const k = d02.path.indexOf(id);
        const lit = k < 0 ? 0 : easeOut(prog(t, k === 0 ? 4.45 : edgeAt(k - 1) + 0.26, 0.2));
        panel(box.x, box.y, NODE_W, NODE_H, { r: 10, fill: C.paper, dash: k < 0 ? [5, 5] : null, shadow: false });
        layer(lit, 0, () => panel(box.x, box.y, NODE_W, NODE_H, { r: 10, fill: soft, stroke: color, lineWidth: 2.5, shadow: false }));
        const title = M.titles[id];
        say(title, box.x + NODE_W / 2, box.cy + 7, fitSize(title, NODE_W - 20, 19, 800, 13), { weight: 800, color: k < 0 ? C.muted : C.navy, align: "center" });
      }

      // The actual memo D02 returned (three of its lines).
      const memo = easeOut(prog(t, 5.8, 0.4));
      layer(memo, (1 - memo) * 12, () => {
        arrow(R2.x + R2.w + 8, R2.y + R2.h / 2, 422, R2.y + R2.h / 2, 1, C.navy);
        const x = 430;
        const w = 1216 - x;
        panel(x, R2.y, w, R2.h, { stroke: color, lineWidth: 2 });
        say(`${d02.id} の実際のメモ（抜粋）`, x + 28, R2.y + 36, 16, { weight: 700, color: C.muted });
        say(d02.lines[0], x + 28, R2.y + 84, 34, { weight: 800, color });
        const subject = d02.lines.find((line) => line.startsWith("件名："));
        const next = d02.lines.find((line) => line.startsWith("次の対応："));
        say(subject, x + 28, R2.y + 120, fitSize(subject, w - 56, 22, 700, 14), { weight: 700, color: C.ink });
        say(next, x + 28, R2.y + 148, fitSize(next, w - 56, 20, 600, 13), { weight: 600, color: C.muted });
      });
    });
  }

  // --- Scene 3: D06, first match wins ---------------------------------------------------------

  function drawFirstMatch(t) {
    const d06 = M.byId.D06;
    layer(fadeWindow(t, 8.05, 0.4, 11.65, 0.35), 0, () => {
      M.routes.forEach((route, k) => {
        const y = 318 + k * 80;
        const enter = easeOut(prog(t, 8.4 + k * 0.1, 0.35));
        const active = k === 0 ? easeOut(prog(t, 8.9, 0.3)) : 0;
        layer(enter * (k === 2 ? 0.55 : 1), 0, () => {
          panel(64, y, 680, 68, { r: 12, shadow: false });
          layer(active, 0, () => panel(64, y, 680, 68, { r: 12, fill: C.cobaltSoft, stroke: C.cobalt, lineWidth: 2.5, shadow: false }));
          disc(98, y + 34, 17, k === 0 ? C.yellow : C.paper, k === 0 ? null : C.line, 2);
          say(String(k + 1), 98, y + 41, 19, { weight: 800, color: C.navy, align: "center" });
          const condition = M.rules[k];
          const cw = say(condition, 130, y + 44, fitSize(condition, 390, 26, 800, 16), { weight: 800, color: C.navy });
          say("→", 536, y + 44, 26, { weight: 800, color: C.muted });
          say(route.name, 576, y + 44, 26, { weight: 800, color: ROUTE_COLOR[route.id] });
          if (k === 1) layer(easeOut(prog(t, 9.3, 0.35)), 0, () => say("（これも当てはまる）", 130 + cw + 10, y + 43, 18, { weight: 700, color: C.muted }));
        });
      });

      const result = easeOut(prog(t, 9.4, 0.4));
      layer(result, (1 - result) * 12, () => {
        arrow(752, 352, 776, 352, 1, C.cobalt);
        const x = 784;
        const w = 1216 - x;
        panel(x, 318, w, 228, { stroke: ROUTE_COLOR[d06.route], lineWidth: 2 });
        say(`${d06.id} の実際のメモ・1行目`, x + 28, 358, 17, { weight: 700, color: C.muted });
        say(d06.lines[0], x + 28, 418, fitSize(d06.lines[0], w - 56, 38, 800, 22), { weight: 800, color: ROUTE_COLOR[d06.route] });
        say(d06.lines[1], x + 28, 462, fitSize(d06.lines[1], w - 56, 20, 700, 14), { weight: 700, color: C.ink });
        say(`分岐 ID：${d06.route}`, x + 28, 520, 16, { weight: 700, family: MONO, color: C.muted });
      });

      layer(easeOut(prog(t, 9.6, 0.4)), 0, () => {
        const lw = say(M.ruleLead, 64, 600, 22, { weight: 800, color: C.navy });
        say("（workflow.yml の説明文）", 64 + lw + 12, 600, 16, { weight: 700, color: C.muted });
      });
    });
  }

  // --- Scene 4: D04 (99) and D05 (100), a rule boundary ---------------------------------------

  // Axis values are offsets from the threshold read from workflow.yml.
  const AXIS = { x0: 488, x1: 812, y: 410, from: -2.5, to: 1.5 };
  const axisX = (value) => lerp(AXIS.x0, AXIS.x1, (value - M.limit - AXIS.from) / (AXIS.to - AXIS.from));

  function drawBoundary(t) {
    layer(fadeWindow(t, 12.05, 0.4, 17.65, 0.35), 0, () => {
      // Explanatory number line: the ≥ threshold region from workflow.yml.
      const bx = axisX(M.limit);
      ctx.fillStyle = C.cobaltSoft;
      ctx.fillRect(bx, AXIS.y - 44, AXIS.x1 - bx, 88);
      ctx.fillStyle = C.navy;
      ctx.fillRect(AXIS.x0, AXIS.y - 1, AXIS.x1 - AXIS.x0, 2);
      ctx.fillStyle = C.cobalt;
      ctx.fillRect(bx - 1.5, AXIS.y - 60, 3, 104);
      say(M.limitLabel, bx, 318, 30, { weight: 800, color: C.cobalt, align: "center" });
      say(`→ ${M.routes[0].name}`, bx, 352, 22, { weight: 800, color: C.cobalt, align: "center" });
      for (let v = Math.ceil(M.limit + AXIS.from); v <= M.limit + AXIS.to; v++) {
        const x = axisX(v);
        ctx.fillStyle = C.navy;
        ctx.fillRect(x - 1, AXIS.y - 7, 2, 14);
        say(String(v), x, AXIS.y + 40, 20, { weight: 700, color: v >= M.limit ? C.cobalt : C.muted, align: "center" });
      }
      say("説明図：workflow.yml の人数の条件", AXIS.x0, 488, 15, { weight: 700, color: C.muted });

      layer(easeOut(prog(t, 12.6, 0.4)), 0, () => {
        say("ルールが見る3項目で、違うのは影響人数だけ。", 64, 596, 26, { weight: 800, color: C.navy });
      });
    });

    // Each case's marker and actual memo share that case's own card alpha (dip at 14.7–15.3 s).
    for (const id of ["D04", "D05"]) {
      const item = M.byId[id];
      const a = sampleTrack(M.tracks[id], t).a;
      layer(a, 0, () => {
        const color = ROUTE_COLOR[item.route];
        disc(axisX(item.input.affected_users), AXIS.y, 14, color, C.paper, 3);
        const x = 844;
        const w = 1216 - x;
        panel(x, R4.y, w, R4.h, { stroke: color, lineWidth: 2 });
        say(`${item.id} の実際のメモ`, x + 28, R4.y + 38, 17, { weight: 700, color: C.muted });
        say(item.lines[0], x + 28, R4.y + 96, fitSize(item.lines[0], w - 56, 32, 800, 18), { weight: 800, color });
        const subject = item.lines.find((line) => line.startsWith("件名："));
        const kind = item.lines.find((line) => line.startsWith("種類・緊急度："));
        say(subject, x + 28, R4.y + 150, fitSize(subject, w - 56, 19, 700, 12), { weight: 700, color: C.ink });
        say(kind, x + 28, R4.y + 186, fitSize(kind, w - 56, 19, 700, 12), { weight: 700, color: C.ink });
        say(item.lines[1], x + 28, R4.y + 236, fitSize(item.lines[1], w - 56, 18, 600, 12), { weight: 600, color: C.muted });
        say(`分岐 ID：${item.route}`, x + 28, R4.y + 300, 16, { weight: 700, family: MONO, color: C.muted });
      });
    }
  }

  // --- Scene 5: D07, the input stays text -----------------------------------------------------

  function drawLiteral(t) {
    const d07 = M.byId.D07;
    layer(fadeWindow(t, 18.05, 0.4, 21.65, 0.35), 0, () => {
      const right = easeOut(prog(t, 18.5, 0.4));
      layer(right, (1 - right) * 12, () => {
        say("そのまま", 640, 326, 18, { weight: 800, color: C.navy, align: "center" });
        arrow(616, 340, 664, 340, 1, C.navy, 3);
        const x = 676;
        const w = 1216 - x;
        panel(x, R5.y, w, R5.h, { stroke: ROUTE_COLOR[d07.route], lineWidth: 2 });
        say(`${d07.id} の実際のメモ（抜粋）`, x + 28, R5.y + 38, 17, { weight: 700, color: C.muted });
        say(d07.lines[0], x + 28, R5.y + 82, 17, { weight: 700, color: ROUTE_COLOR[d07.route] });
        const subjectSize = fitSize(M.d07.subjectLine, w - 56, 28, 800, 16);
        pencil(x + 24, x + 32 + textWidth(M.d07.subjectLine, subjectSize, 800), R5.y + 134, easeOut(prog(t, 19.0, 0.4)), 1.4, 10);
        say(M.d07.subjectLine, x + 28, R5.y + 126, subjectSize, { weight: 800, color: C.navy });
        say("本文：", x + 28, R5.y + 176, 17, { weight: 700, color: C.muted });
        const bodySize = fitSize(M.d07.bodyFirst, w - 56, 22, 700, 13, MONO);
        pencil(x + 24, x + 32 + textWidth(M.d07.bodyFirst, bodySize, 700, MONO), R5.y + 223, easeOut(prog(t, 19.2, 0.4)), 2.7, 9);
        say(M.d07.bodyFirst, x + 28, R5.y + 216, bodySize, { weight: 700, family: MONO, color: C.ink });
        if (M.d07.bodyRest) say(M.d07.bodyRest, x + 28, R5.y + 254, fitSize(M.d07.bodyRest, w - 56, 18, 600, 12), { weight: 600, color: C.muted });
      });
      layer(easeOut(prog(t, 19.3, 0.4)), 0, () => {
        say(`${M.d07.expression} は計算されず、文字のまま入った。`, 64, 562, 26, { weight: 800, color: C.navy });
        say("小さな1例です。安全性の検証ではありません。", 64, 602, 20, { weight: 700, color: C.muted });
      });
    });
  }

  // --- Scene 6: counts, files, actual screens -------------------------------------------------

  function drawClosing(t) {
    const enter = easeOut(prog(t, 22.0, 0.5));
    layer(enter, (1 - enter) * 14, () => {
      M.routes.forEach((route, k) => {
        const x = 64 + k * 186;
        const a = easeOut(prog(t, 22.2 + k * 0.12, 0.4));
        layer(a, (1 - a) * 10, () => {
          const color = ROUTE_COLOR[route.id];
          const w = say(String(route.ids.length), x, 296, 96, { weight: 800, color });
          say("件", x + w + 6, 296, 30, { weight: 800, color: C.navy });
          say(route.name, x, 340, 26, { weight: 800, color: C.navy });
          let cx = x;
          for (const id of route.ids) cx += chip(id, cx, 378, color, ROUTE_SOFT[route.id], 13) + 6;
        });
      });

      const files = [
        ["workflow.yml", "ワークフローの DSL"],
        ["workflow-runs.json", `${M.cases.length}件の入力・出力・イベント`],
      ];
      layer(easeOut(prog(t, 22.6, 0.4)), 0, () => {
        files.forEach(([name, note], k) => {
          const y = 446 + k * 52;
          panel(64, y - 26, 28, 34, { r: 4, fill: C.yellowSoft, stroke: C.navy, lineWidth: 1.5, shadow: false });
          const nw = say(name, 108, y, 24, { weight: 700, family: MONO, color: C.navy });
          say(note, 108 + nw + 16, y, fitSize(note, 620 - 124 - nw, 20, 700, 13), { weight: 700, color: C.muted });
        });
        say("作例ページで開いて、そのまま保存できます。", 64, 584, 22, { weight: 800, color: C.navy });
      });

      const shots = easeOut(prog(t, 22.4, 0.5));
      layer(shots, 0, () => {
        drawShot(M.shots.desktop, 656, 200, 400, 300);
        drawShot(M.shots.phone, 1072, 200, 144, 300);
        say(`閲覧ページの実画面（左 ${M.shots.desktop.sample}・右 ${M.shots.phone.sample}）`, 656, 534, 15, { weight: 700, color: C.muted });
        say("撮影した画像を縮小しただけで、描き直していません。", 656, 558, 15, { weight: 600, color: C.muted });
      });
    });
  }

  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.ivory;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(SCALE, 0, 0, SCALE, OFFSET_X, OFFSET_Y);
    ctx.textBaseline = "alphabetic";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawFrame(t);
    drawHeadline(t);
    drawOpening(t);
    drawWorkflow(t);
    drawFirstMatch(t);
    drawBoundary(t);
    drawLiteral(t);
    drawCards(t);
    drawClosing(t);
  }

  // --- Time, preview and editor ---------------------------------------------------------------

  let M = null;
  let current = 0;
  let playing = false;
  let frameRequest = 0;
  let clockOrigin = 0;

  const clampTime = (seconds) => {
    const value = Number(seconds);
    return Number.isFinite(value) ? Math.min(DURATION, Math.max(0, value)) : 0;
  };

  function syncControls() {
    const value = current.toFixed(1);
    ui.timeline.value = value;
    if (document.activeElement !== ui.time) ui.time.value = value;
    ui.counter.textContent = `${value} / ${DURATION.toFixed(1)} 秒`;
  }

  function paint(t) {
    current = t;
    draw(t);
    if (!RENDER) syncControls();
  }

  function setPlaying(next) {
    playing = next;
    ui.play.textContent = next ? "一時停止" : "再生";
    ui.play.setAttribute("aria-pressed", String(next));
  }

  function stopPreview() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    setPlaying(false);
  }

  // Preview only: wall-clock playback through window.seek. Never used while rendering.
  function tick(now) {
    frameRequest = 0;
    if (!playing) return;
    const t = Math.min(DURATION, (now - clockOrigin) / 1000);
    window.seek(t);
    if (t >= DURATION) {
      stopPreview();
      return;
    }
    frameRequest = requestAnimationFrame(tick);
  }

  function startPreview() {
    if (RENDER || !M || playing) return;
    if (current >= DURATION) current = 0;
    clockOrigin = performance.now() - current * 1000;
    setPlaying(true);
    frameRequest = requestAnimationFrame(tick);
  }

  function buildSceneList() {
    const items = SCENES.map((scene) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const time = document.createElement("span");
      time.className = "scene-time";
      time.textContent = `${scene.start}〜${scene.end}秒`;
      const head = document.createElement("span");
      head.textContent = `${scene.head}（${scene.ids}）`;
      button.append(time, head);
      button.addEventListener("click", () => {
        stopPreview();
        window.seek(scene.hold);
      });
      li.append(button);
      return li;
    });
    ui.sceneList.replaceChildren(...items);
  }

  function onReady(model) {
    M = model;
    writeHeadlines(M);
    paint(0);
    ui.editor.dataset.state = "ready";
    if (RENDER) return;
    buildSceneList();
    for (const control of [ui.play, ui.reset, ui.timeline, ui.time]) control.disabled = false;
    setPlaying(false);
    ui.status.dataset.state = "ready";
    ui.status.textContent = `${ASSET_KEYS.length}素材を照合しました。SHA-256・固定版・実行と独立照合の合格を確かめてから描いています。`;
  }

  function onFail(error) {
    M = null;
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    playing = false;
    for (const control of [ui.play, ui.reset, ui.timeline, ui.time]) control.disabled = true;
    ui.stage.hidden = true;
    ui.editor.dataset.state = "error";
    ui.status.dataset.state = "error";
    ui.status.textContent = "素材の照合に失敗しました。映像は表示しません。";
    ui.errorText.textContent = error instanceof Error ? error.message : String(error);
    ui.errorBox.hidden = false;
    showAssets();
  }

  const ready = load().then(onReady).catch((error) => {
    onFail(error);
    throw error;
  });
  window.motionReady = ready;
  ready.catch(() => {}); // Shown on the page; the renderer still receives the rejection.

  window.seek = (seconds) => {
    const t = clampTime(seconds);
    return ready.then(() => {
      paint(t);
      return t;
    });
  };

  if (!RENDER) {
    const seekFromField = () => {
      if (ui.time.value === "" || !Number.isFinite(Number(ui.time.value))) return;
      stopPreview();
      window.seek(ui.time.value);
    };
    ui.play.addEventListener("click", () => (playing ? stopPreview() : startPreview()));
    ui.reset.addEventListener("click", () => {
      stopPreview();
      window.seek(0);
    });
    ui.timeline.addEventListener("input", () => {
      stopPreview();
      window.seek(ui.timeline.value);
    });
    ui.time.addEventListener("input", seekFromField);
    ui.time.addEventListener("change", seekFromField);
    ui.time.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      seekFromField();
    });
  }
})();
