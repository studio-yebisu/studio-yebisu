/*
 * Studio Yebisu — Claude-Mem 作例・動く概念図（32秒・無音）
 * Copyright (c) 2026 Studio Yebisu. MIT License. Diagram and film authored by Claude Opus 5.5.
 *
 * One connected library picture: a query lens → one SQLite store with two project shelves → three
 * gates 題名 → 前後 → 本文 → the tray where the returned notes land. The SAME note objects move
 * between scenes: N02 and N01 leave as title tabs, line up as context, N01 unfolds into one open
 * book; the same query reaches two shelves; the reopened store returns N02 again. Every title, ID,
 * order, count and error code is read from the saved original run (assets/memory-run.json) after
 * the manifest and all seven assets match their pinned SHA-256 and byte counts.
 * No audio, no narration, no live inference, no fallback data.
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
  const POSTER_TIME = 19;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: [] };

  // --- Frozen expectations --------------------------------------------------------------------

  const MANIFEST = {
    path: "assets/manifest.json",
    sha256: "a83234ef8ad6f98d84e43f00954b2f069091ce6c166167de644b9d356531a944",
    format: "studio-yebisu-visual-assets-v1",
  };
  // Same order and values as the manifest. Paths are relative to video/assets/.
  const ASSETS = [
    { file: "memory-run.json", sha256: "efd1001c68b48e7ccde9fc3858defac43175f43a73086c538062d13c1a9b931c", bytes: 121103, source: "outputs/memory-run.json" },
    { file: "independent-checks.json", sha256: "378d5b466b192faef1929eb23385341c74f69f7d7ae08fe5edb1ceec682d3e50", bytes: 3081, source: "outputs/independent-checks.json" },
    { file: "notes.json", sha256: "615600356841c0f3a7d8bf55773f2a6869da320a9c03ae2c9552df15be38e5f3", bytes: 2032, source: "input/notes.json" },
    { file: "scenarios.json", sha256: "29f4d0ad731aae355a160a6896c799af502236221f7bff2736038f5a044fd3fd", bytes: 1942, source: "input/scenarios.json" },
    { file: "vendor-lock.json", sha256: "d0f19c3060cc9d95443974a6916b07880b7f6e6fda9ae1c32888f582edbe5a89", bytes: 47458, source: "vendor-lock.json" },
    { file: "diagram-data.json", sha256: "7ffdf77e1fc4c8d911e0f784831076a8bfcb8b4956c670e2ea818e1b0188f575", bytes: 17477, source: "faithful visual projection of original actual records; presentation only" },
    { file: "timeline.json", sha256: "fb7a516ac2fb258bdf07c028d9d4231712c7bb903afbd1a7be986acc3b20b3d3", bytes: 2160, source: "faithful visual projection of original actual records; presentation only" },
  ];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.file, a.sha256]));
  const PIN = {
    format: "studio-yebisu-claude-mem-run-v1",
    repository: "thedotmack/claude-mem",
    commit: "fef3402e674bebbf72a23aeb735e91c92cd34afd",
    version: "13.39.0",
    license: "Apache-2.0",
    notice: "Copyright 2026 Alex Newman",
    lockFiles: 194,
    samples: ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"],
    notes: ["N01", "N02", "N03", "N04", "N05"],
    projects: ["sakura-site", "tsubaki-docs"],
    timelineFormat: "studio-yebisu-claude-mem-visual-timeline-v1",
    diagramFormat: "studio-yebisu-claude-mem-visual-facts-v1",
  };
  // Scene timing is fixed in timeline.json; `read` is where the scene buttons land.
  const SCENE_PLAN = [
    { id: "store", in: 0, out: 5, case: "C02", read: 4.6 },
    { id: "index", in: 5, out: 10, case: "C03", read: 9.4 },
    { id: "context", in: 10, out: 15, case: "C04", read: 14.4 },
    { id: "details", in: 15, out: 21, case: "C05", read: 19 },
    { id: "scope", in: 21, out: 26, case: "C06", read: 24.6 },
    { id: "reopen", in: 26, out: 32, case: "C07", read: 31, last: true },
  ];
  const FILE_MESSAGE = "このページをファイルとして直接開くと、素材を読み込んで照合できません。作例のフォルダー（index.html のある場所）で python -m http.server を実行し、http://localhost:8000/video/ を開いてください。";

  // Picture labels. Each one is checked against the actual title or returned body at load.
  const SPINE = { N01: "下余白", N02: "動画", N03: "JSON", N04: "図", N05: "PDF" };
  const TAG = { N01: "safe-area の下余白", N02: "動画は playsinline", N03: "JSON の入力と出力", N04: "safe-area のドキュメント図", N05: "横長PDF" };
  const EXCERPT = { N01: "ボタンは44px以上にし、本文をバーで隠さない。", N02: "playsinline と controls を付ける。" };
  const PROJECT_JA = { "sakura-site": "さくらサイト", "tsubaki-docs": "つばき資料" };
  const OP_JA = { search: "題名", timeline: "前後", fetch: "本文" };

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
    const shelves = {
      "sakura-site": { x: 44, y: 384, w: 400, h: 306, bookW: 116, gap: 12 },
      "tsubaki-docs": { x: 460, y: 384, w: 216, h: 306, bookW: 92, gap: 12 },
    };
    return {
      DW: 720, DH: 1280, tall: true,
      eyebrow: { x: 48, y: 74, size: 26 },
      headline: { x: 48, y: 148, size: 54, min: 40, max: 624 },
      lens: { cx: 92, cy: 238, r: 32, handle: 24, line: 7 },
      chip: { x: 152, y: 208, h: 60, size: 40, pad: 26, scopeSize: 28, scopeGap: 16 },
      routeFrom: [126, 272],
      cab: { x: 28, y: 312, w: 664, h: 388, head: 54, headSize: 28 },
      shelves, bookY: 402, bookH: 232, shelfLabel: { dy: 288, size: 30 },
      spine: { key: 40, label: 30, id: 22 },
      gates: [0, 1, 2].map((i) => ({ x: 28 + i * 224, y: 740, w: 216, h: 112 })),
      gate: { numR: 22, numSize: 26, label: 44, labelDx: 80, labelDy: 70, badge: 24, badgeDy: 100, flow: "row" },
      tray: { x: 28, y: 872, w: 664, h: 222 },
      rows: [{ x: 28, y: 878, w: 664, h: 100 }, { x: 28, y: 990, w: 664, h: 100 }],
      pair: [{ x: 28, y: 884, w: 664, h: 100 }, { x: 28, y: 984, w: 664, h: 100 }],
      open: { x: 28, y: 872, w: 664, h: 222 },
      split: { "sakura-site": { x: 28, y: 878, w: 324, h: 216 }, "tsubaki-docs": { x: 368, y: 878, w: 324, h: 216 } },
      saves: { "sakura-site": (i) => ({ x: 28 + i * 224, y: 884, w: 216, h: 92 }), "tsubaki-docs": (i) => ({ x: 28 + i * 224, y: 992, w: 216, h: 92 }) },
      replay: { x: 476, y: 992, w: 216, h: 92 },
      copy: { key: 40, title: 34, excerpt: 34, small: 24, flag: 24, header: 54, headerSize: 28, pad: 28 },
      status: { x: 360, y: 1134, size: 30, min: 22, max: 640, align: "center" },
      ticket: { start: { x: 40, y: 890, w: 236, h: 56 }, park: { x: 262, y: 714, w: 200, h: 50 }, size: 26 },
      cta: { cx: 360, cy: 1180, w: 580, h: 58, size: 30 },
      foot: { x: 48, ys: [1236, 1264], size: 20, min: 14, max: 624, oneLine: false },
    };
  }

  function landscapeLayout() {
    const shelves = {
      "sakura-site": { x: 54, y: 304, w: 336, h: 312, bookW: 100, gap: 10 },
      "tsubaki-docs": { x: 404, y: 304, w: 182, h: 312, bookW: 78, gap: 10 },
    };
    return {
      DW: 1280, DH: 720, tall: false,
      eyebrow: { x: 64, y: 56, size: 22 },
      headline: { x: 64, y: 114, size: 48, min: 34, max: 760 },
      lens: { cx: 96, cy: 198, r: 26, handle: 19, line: 6 },
      chip: { x: 146, y: 172, h: 52, size: 36, pad: 22, scopeSize: 26, scopeGap: 14 },
      routeFrom: [123, 225],
      cab: { x: 40, y: 244, w: 560, h: 388, head: 48, headSize: 24 },
      shelves, bookY: 322, bookH: 228, shelfLabel: { dy: 296, size: 26 },
      spine: { key: 34, label: 26, id: 19 },
      gates: [0, 1, 2].map((i) => ({ x: 640, y: 170 + i * 130, w: 190, h: 100 })),
      gate: { numR: 20, numSize: 22, label: 40, labelDx: 66, labelDy: 62, badge: 22, badgeDy: 90, flow: "column" },
      tray: { x: 860, y: 166, w: 380, h: 330 },
      rows: [{ x: 860, y: 176, w: 380, h: 96 }, { x: 860, y: 286, w: 380, h: 96 }],
      pair: [{ x: 860, y: 186, w: 380, h: 96 }, { x: 860, y: 282, w: 380, h: 96 }],
      open: { x: 860, y: 166, w: 380, h: 324 },
      split: { "sakura-site": { x: 860, y: 166, w: 380, h: 158 }, "tsubaki-docs": { x: 860, y: 338, w: 380, h: 158 } },
      saves: { "sakura-site": (i) => ({ x: 860 + i * 128, y: 180, w: 124, h: 84 }), "tsubaki-docs": (i) => ({ x: 860 + i * 128, y: 278, w: 124, h: 84 }) },
      replay: { x: 860, y: 376, w: 380, h: 76 },
      copy: { key: 34, title: 28, excerpt: 30, small: 20, flag: 20, header: 42, headerSize: 24, pad: 20 },
      status: { x: 860, y: 544, size: 26, min: 18, max: 380, align: "left" },
      ticket: { start: { x: 868, y: 190, w: 210, h: 50 }, park: { x: 648, y: 276, w: 178, h: 46 }, size: 24 },
      cta: { cx: 1050, cy: 628, w: 380, h: 54, size: 26 },
      foot: { x: 64, ys: [700], size: 17, min: 13, max: 1152, oneLine: true },
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

  function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    if (isObject(a) && isObject(b)) {
      const ka = Object.keys(a), kb = Object.keys(b);
      return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
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

  function parseJson(bytes, name) {
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new CheckError(`${name} が UTF-8 の文字として読めません。`);
    }
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
    check(manifest.format === MANIFEST.format && deepEqual(manifest.assets, ASSETS), "assets/manifest.json の素材一覧が固定値と一致しません。");
    const data = {};
    await Promise.all(ASSETS.map(async (asset) => {
      const path = `assets/${asset.file}`;
      try {
        const bytes = await fetchBytes(path);
        check(bytes.byteLength === asset.bytes, `${path} のバイト数が manifest と一致しません。`);
        check(await sha256Hex(bytes) === asset.sha256, `${path} の SHA-256 が manifest と一致しません。`);
        data[asset.file] = parseJson(bytes, path);
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

  const callsOf = (sample, side = "output") => new Map((sample?.[side]?.calls ?? []).map((c) => [c.name, c]));

  // Reads the actual record into the few values the picture draws, checking every assumption.
  function buildFilm(data) {
    const record = data["memory-run.json"];
    const notesFile = data["notes.json"];
    const scenarios = data["scenarios.json"];
    const lock = data["vendor-lock.json"];
    const facts = data["diagram-data.json"];
    const timeline = data["timeline.json"];
    const audit = data["independent-checks.json"];

    check(record.format === PIN.format, "元の実行記録の形式が違います。");
    const src = record.source ?? {};
    check(src.repository === PIN.repository && src.commit === PIN.commit && src.version === PIN.version && src.license === PIN.license && src.notice === PIN.notice,
      "元の実行記録の原典・固定コミット・版・利用条件が固定値と一致しません。");
    check(record.source_lock_sha256 === SHA["vendor-lock.json"], "実行記録の vendor-lock.json の SHA-256 が素材と一致しません。");
    check(lock.repository === PIN.repository && lock.commit === PIN.commit && lock.version === PIN.version && Array.isArray(lock.files) && lock.files.length === PIN.lockFiles,
      "vendor-lock.json の固定版または194ファイルの件数が違います。");
    check(record.source_files_verified?.count === PIN.lockFiles, "原典194ファイルの照合が記録にありません。");
    check(deepEqual(record.input_sha256, { "input/notes.json": SHA["notes.json"], "input/scenarios.json": SHA["scenarios.json"] }),
      "実行記録の入力ハッシュが素材の notes.json・scenarios.json と一致しません。");
    check(Array.isArray(record.samples) && record.samples.map((s) => s.id).join(",") === PIN.samples.join(",") && new Set(record.samples.map((s) => s.id)).size === 8,
      "実行記録の場面が C01〜C08 の8件ではありません。");
    check(record.samples.every((s) => Array.isArray(s.checks) && s.checks.length > 0 && s.checks.every((c) => c.passed === true)), "場面の確認に不合格があります。");
    const checks = record.checks ?? {};
    check(checks.passed === true && checks.total === checks.expected_total && Array.isArray(checks.items) && checks.items.length === checks.total
      && checks.items.every((c) => c.passed === true), "実行記録の自動確認が合格になっていません。");
    check(record.guards?.all_attempts_total === 0 && record.guards?.network_attempts_total === 0, "通信・サーバー・プロセスの試みが0件ではありません。");
    check(record.process?.fresh_process === true && record.process?.own_worker_spawns === 1, "新しいプロセスでの読み直しが記録にありません。");
    check(deepEqual(Object.keys(record.ids ?? {}), PIN.notes), "記録の N01〜N05 がそろっていません。");

    check(notesFile.format === "studio-yebisu-claude-mem-notes-v1" && notesFile.fictional === true && Array.isArray(notesFile.notes)
      && notesFile.notes.map((n) => n.key).join(",") === PIN.notes.join(","), "notes.json の形が違います。");
    check(scenarios.format === "studio-yebisu-claude-mem-scenarios-v1" && scenarios.scenarios.map((s) => s.id).join(",") === PIN.samples.join(","),
      "scenarios.json の場面が C01〜C08 ではありません。");
    record.samples.forEach((s, i) => check(s.label === scenarios.scenarios[i].label, `${s.id} の名前が scenarios.json と一致しません。`));

    check(audit.status === "passed" && audit.source?.commit === PIN.commit && audit.source?.version === PIN.version, "independent-checks.json が合格の記録ではありません。");
    for (const note of notesFile.notes) {
      check(audit.notes?.[note.key]?.id === record.ids[note.key] && audit.notes[note.key].title === note.title && audit.notes[note.key].project === note.project,
        `independent-checks.json の ${note.key} が記録と一致しません。`);
    }

    // diagram-data.json is a projection of the record: compare each copied value with its source.
    check(facts.format === PIN.diagramFormat && facts.source_run_sha256 === SHA["memory-run.json"] && facts.fictional === true, "diagram-data.json の形式または元の記録が違います。");
    check(deepEqual(facts.notes, notesFile.notes) && deepEqual(facts.ids, record.ids), "diagram-data.json の5件が notes.json・記録と一致しません。");
    check(Array.isArray(facts.sample_summaries) && facts.sample_summaries.length === 8
      && facts.sample_summaries.every((s, i) => s.id === record.samples[i].id && s.summary === record.samples[i].summary), "diagram-data.json の要約が記録と一致しません。");
    check(Array.isArray(facts.steps) && facts.steps.length > 0, "diagram-data.json に段階の値がありません。");
    for (const step of facts.steps) {
      const sample = record.samples.find((s) => s.id === step.sample);
      const call = callsOf(sample).get(step.call);
      check(call, `diagram-data.json の ${step.sample}/${step.call} が記録にありません。`);
      check(step.source === `outputs/memory-run.json#/samples/${step.sample}/output/calls/${step.call}`, `${step.sample}/${step.call} の出典の書き方が違います。`);
      const r = call.result ?? {};
      check(deepEqual(step.index, r.index ?? []) && deepEqual(step.observations, r.observations ?? []) && (step.step ?? null) === (r.step ?? null)
        && deepEqual(step.error, call.error ?? null), `diagram-data.json の ${step.sample}/${step.call} が記録の戻り値と一致しません。`);
    }

    check(timeline.format === PIN.timelineFormat && timeline.duration === DURATION && timeline.fps === 30 && timeline.frames === 960 && timeline.silent === true,
      "timeline.json が32秒・30fps・960フレーム・無音ではありません。");
    check(Array.isArray(timeline.scenes) && timeline.scenes.length === SCENE_PLAN.length
      && timeline.scenes.every((s, i) => s.id === SCENE_PLAN[i].id && s.in === SCENE_PLAN[i].in && s.out === SCENE_PLAN[i].out && s.case === SCENE_PLAN[i].case
        && typeof s.headline === "string" && s.headline.length > 0), "timeline.json の6場面が固定の時刻表と一致しません。");

    // Values the picture draws.
    const keyById = new Map(Object.entries(record.ids).map(([k, id]) => [String(id), k]));
    const keyOf = (id) => {
      const key = keyById.get(String(id));
      check(key, `記録に N01〜N05 以外の ID ${id} があります。`);
      return key;
    };
    const byId = Object.fromEntries(record.samples.map((s) => [s.id, s]));
    const notes = notesFile.notes.map((n) => ({ ...n, id: record.ids[n.key] }));
    for (const n of notes) {
      check(PIN.projects.includes(n.project), `${n.key} の案件が図の2案件にありません。`);
      check(n.text.includes(`「${PROJECT_JA[n.project]}」`), `${n.key} の本文に案件名がありません。`);
      check(n.title.includes(SPINE[n.key]) && n.title.includes(TAG[n.key]), `${n.key} の短い見出しが題名の一部ではありません。`);
    }
    const c02 = callsOf(byId.C02);
    const saves = {};
    for (const n of notes) {
      const saved = c02.get(`save:${n.key}`)?.result;
      check(saved?.success === true && String(saved.id) === n.id && saved.title === n.title && saved.project === n.project, `C02 の ${n.key} の保存結果が入力と一致しません。`);
      saves[n.key] = String(saved.id);
    }
    const related = notes.map((n) => {
      const r = c02.get(`related_search:${n.key}`)?.result;
      check(r && Array.isArray(r.index), `C02 の ${n.key} の保存前の検索がありません。`);
      return r.project;
    });
    const replay = c02.get("replay:N01")?.result;
    check(replay?.duplicate === true && String(replay.id) === record.ids.N01, "C02 の N01 再送が同じ ID の duplicate になっていません。");
    const after = byId.C02.output.sql_audit_after;
    const counts = Object.fromEntries(PIN.projects.map((p) => [p, notes.filter((n) => n.project === p).length]));
    check(after?.observations === notes.length && PIN.projects.every((p) => after.observations_by_project?.[p] === counts[p]), "C02 の保存後の件数が5件（案件別）と一致しません。");

    const c03 = callsOf(byId.C03).get("index")?.result;
    check(c03?.step === 1 && c03.index.length > 0 && c03.observations.length === 0, "C03 が題名だけの索引になっていません。");
    const c04call = callsOf(byId.C04, "input").get("context");
    const c04 = callsOf(byId.C04).get("context")?.result;
    check(c04?.step === 2 && c04.observations.length === 0 && Array.isArray(c04call?.args?.selectedIds), "C04 が本文なしの前後になっていません。");
    const chosen = c04call.args.selectedIds.map(keyOf);
    const c05call = callsOf(byId.C05, "input").get("details");
    const c05 = callsOf(byId.C05).get("details")?.result;
    check(c05?.step === 3 && c05.observations.length === 1 && deepEqual(c05call?.args?.selectedIds?.map(keyOf), chosen), "C05 が選んだ1件の本文になっていません。");
    const openKey = keyOf(c05.observations[0].id);
    check(c05.observations[0].content.includes(EXCERPT[openKey] ?? "\u0000"), "C05 の本文に図の抜粋がありません。");
    const c06 = {};
    let c06query = null;
    for (const p of PIN.projects) {
      const r = callsOf(byId.C06).get(`auto:${p}`)?.result;
      check(r && r.project === p && r.observations.length === 1 && Array.isArray(r.trace), `C06 の ${p} の結果が1件の本文ではありません。`);
      const key = keyOf(r.observations[0].id);
      check(notes.find((n) => n.key === key).project === p, `C06 の ${p} が別の案件の記録を返しています。`);
      c06[p] = { key, steps: r.trace.map((s) => OP_JA[s.operation] ?? s.operation) };
      check(c06query === null || c06query === r.query, "C06 の2案件で問いが違います。");
      c06query = r.query;
    }
    const c07out = callsOf(byId.C07);
    const worker = byId.C07.output.worker;
    const w = c07out.get("worker_auto")?.result;
    check(worker?.fresh_process === true && w?.observations.length === 1, "C07 の新しいプロセスの結果がありません。");
    const reopenKey = keyOf(w.observations[0].id);
    check(String(w.observations[0].id) === saves[reopenKey] && w.observations[0].content.includes(EXCERPT[reopenKey] ?? "\u0000"), "C07 の本文が保存時の ID・本文と一致しません。");
    const old = c07out.get("worker_old_continuation")?.error;
    check(old?.code === "invalid_continuation", "C07 の前のプロセスの合図が invalid_continuation になっていません。");
    check(worker.sql_audit?.observations === notes.length && PIN.projects.every((p) => worker.sql_audit.observations_by_project?.[p] === counts[p]),
      "C07 の新しいプロセスの件数が5件（案件別）と一致しません。");

    return {
      notes, counts, total: after.observations, saves, related, replayId: String(replay.id),
      headlines: Object.fromEntries(timeline.scenes.map((s) => [s.id, s.headline])),
      c03: { query: c03.query, project: c03.project, order: c03.index.map((r) => keyOf(r.id)), bodies: c03.observations.length },
      chosen,
      c04: { order: c04.index.map((r) => keyOf(r.id)), depth: byId.C04.input.scenario.depthBefore, bodies: c04.observations.length },
      c05: { key: openKey, bodies: c05.observations.length },
      c06: { query: c06query, byProject: c06 },
      c07: { query: w.query, project: w.project, key: reopenKey, id: String(w.observations[0].id), total: worker.sql_audit.observations,
        counts: worker.sql_audit.observations_by_project, oldCode: old.code },
      source: { repository: src.repository, commit: src.commit, version: src.version, license: src.license },
    };
  }

  async function load() {
    const data = await loadAssets();
    const built = buildFilm(data);
    if (document.fonts?.ready) await document.fonts.ready;
    built.tracks = buildTracks(built);
    return built;
  }

  // --- Time helpers (pure) -------------------------------------------------------------------

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const ramp = (t, a, b) => ease(clamp01((t - a) / (b - a)));
  // Visible from a to b with short fades; a window that reaches the end does not fade out.
  const win = (t, a, b, f = 0.3) => Math.min(ramp(t, a, a + f), b >= DURATION ? 1 : 1 - ramp(t, b - f, b));
  const pulse = (t, at, len = 0.6) => (t < at || t > at + len ? 0 : Math.sin(Math.PI * (t - at) / len));
  const lerpRect = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });

  function slotRect(film, key) {
    const note = film.notes.find((n) => n.key === key);
    const shelf = L.shelves[note.project];
    const i = film.notes.filter((n) => n.project === note.project).findIndex((n) => n.key === key);
    return { x: shelf.x + 8 + i * (shelf.bookW + shelf.gap), y: L.bookY, w: shelf.bookW, h: L.bookH };
  }

  const arrival = (i) => 0.45 + i * 0.55;

  // Keyframes for each note copy that leaves its shelf. Built once from the record.
  function buildTracks(film) {
    const tracks = new Map();
    const add = (key, time, r, a, form) => {
      if (!tracks.has(key)) tracks.set(key, []);
      const list = tracks.get(key);
      check(list.length === 0 || list[list.length - 1][0] < time, "図の動きの時刻が前後しています。");
      list.push([time, { r, a, form }]);
    };
    const last = (key) => tracks.get(key)[tracks.get(key).length - 1][1];
    const slot = (key) => slotRect(film, key);
    const out = new Set();

    film.c03.order.forEach((key, i) => {
      const t0 = 5.9 + i * 0.6;
      add(key, t0, slot(key), 0, "tab");
      add(key, t0 + 0.3, slot(key), 1, "tab");
      add(key, t0 + 1.1, L.rows[Math.min(i, L.rows.length - 1)], 1, "tab");
      out.add(key);
    });
    film.c04.order.forEach((key, i) => {
      if (!out.has(key)) { add(key, 10.3, slot(key), 0, "tab"); out.add(key); }
      else add(key, 10.6, last(key).r, 1, "tab");
      add(key, 11.6, L.pair[Math.min(i, L.pair.length - 1)], 1, "tab");
    });
    for (const key of [...out]) {
      if (film.c04.order.includes(key)) continue;
      add(key, 10.6, last(key).r, 1, "tab");
      add(key, 11.4, slot(key), 0, "tab");
      out.delete(key);
    }
    for (const key of [...out]) {
      if (key === film.c05.key) {
        add(key, 15.4, last(key).r, 1, "tab");
        add(key, 16.6, L.open, 1, "open");
      } else {
        add(key, 15.2, last(key).r, 1, "tab");
        add(key, 16.0, slot(key), 0, "tab");
        out.delete(key);
      }
    }
    if (!out.has(film.c05.key)) {
      add(film.c05.key, 15.4, slot(film.c05.key), 0, "open");
      add(film.c05.key, 16.6, L.open, 1, "open");
      out.add(film.c05.key);
    }
    const scopeKeys = PIN.projects.map((p) => film.c06.byProject[p].key);
    for (const key of [...out]) {
      if (scopeKeys.includes(key)) continue;
      add(key, 21.2, last(key).r, 1, last(key).form);
      add(key, 22.0, slot(key), 0, last(key).form);
      out.delete(key);
    }
    for (const p of PIN.projects) {
      const key = film.c06.byProject[p].key;
      if (out.has(key)) {
        add(key, 21.2, last(key).r, 1, last(key).form);
        add(key, 22.2, L.split[p], 1, "card");
      } else {
        add(key, 21.8, slot(key), 0, "card");
        add(key, 22.05, slot(key), 1, "card");
        add(key, 22.9, L.split[p], 1, "card");
        out.add(key);
      }
    }
    for (const key of out) {
      add(key, 25.0, last(key).r, 1, last(key).form);
      add(key, 25.7, slot(key), 0, last(key).form);
    }
    const k7 = film.c07.key;
    add(k7, 27.7, slot(k7), 0, "tab");
    add(k7, 27.95, slot(k7), 1, "tab");
    add(k7, 28.7, L.open, 1, "open");
    return tracks;
  }

  function trackAt(list, t) {
    if (!list || t < list[0][0]) return null;
    for (let i = 0; i < list.length - 1; i += 1) {
      const [t0, a] = list[i];
      const [t1, b] = list[i + 1];
      if (t <= t1) {
        const p = ease(clamp01((t - t0) / (t1 - t0)));
        return { r: lerpRect(a.r, b.r, p), a: lerp(a.a, b.a, p), from: a.form, to: b.form, p };
      }
    }
    const end = list[list.length - 1][1];
    return { r: end.r, a: end.a, from: end.form, to: end.form, p: 1 };
  }

  // --- Drawing primitives --------------------------------------------------------------------

  const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Meiryo", "Noto Sans JP", sans-serif';
  const C = {
    ivory: "#f6f1e6", paper: "#fffcf5", ink: "#1c2333", muted: "#5d6475", line: "#cbbfa6",
    accent: "#c8641e", accentSoft: "#fbe3cc", reject: "#9e3324",
    "sakura-site": { main: "#2745c4", soft: "#e4e8fb" },
    "tsubaki-docs": { main: "#157a74", soft: "#dcefec" },
  };

  function setFont(size, weight = 700) { ctx.font = `${weight} ${size}px ${FONT}`; }

  function fitSize(str, size, min, max, weight = 700) {
    let s = size;
    setFont(s, weight);
    while (s > min && ctx.measureText(str).width > max) {
      s -= 1;
      setFont(s, weight);
    }
    return s;
  }

  function text(str, x, y, { size = 24, weight = 700, color = C.ink, align = "left", alpha = 1 } = {}) {
    if (alpha <= 0.003 || !str) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    setFont(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function wrap(str, maxW, size, weight = 700) {
    setFont(size, weight);
    const tokens = str.match(/[A-Za-z0-9_.\-/()@:%+=#]+|\s+|[\s\S]/gu) ?? [];
    const lines = [];
    let line = "";
    for (const token of tokens) {
      const candidate = line + token;
      if (line && ctx.measureText(candidate).width > maxW && !"。、」）".includes(token)) {
        lines.push(line.trimEnd());
        line = /^\s+$/.test(token) ? "" : token;
      } else {
        line = candidate;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
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

  function bezierPoint(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return [
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ];
  }

  // A route drawn up to `progress`, with an arrowhead once it arrives.
  function routeLine(pts, progress, color, alpha, width) {
    if (alpha <= 0.003 || progress <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    const steps = 48;
    let end = pts[0], prev = pts[0];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= steps; i += 1) {
      const u = (i / steps) * progress;
      prev = end;
      end = bezierPoint(pts[0], pts[1], pts[2], pts[3], u);
      ctx.lineTo(end[0], end[1]);
    }
    ctx.stroke();
    if (progress > 0.96) {
      const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
      const k = width * 3.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(end[0] + Math.cos(ang) * k * 0.4, end[1] + Math.sin(ang) * k * 0.4);
      ctx.lineTo(end[0] - Math.cos(ang - 0.55) * k, end[1] - Math.sin(ang - 0.55) * k);
      ctx.lineTo(end[0] - Math.cos(ang + 0.55) * k, end[1] - Math.sin(ang + 0.55) * k);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function crossMark(cx, cy, r, alpha) {
    if (alpha <= 0.003) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = C.reject;
    ctx.strokeStyle = C.paper;
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = r * 0.22;
    ctx.lineCap = "round";
    const q = r * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx - q, cy - q);
    ctx.lineTo(cx + q, cy + q);
    ctx.moveTo(cx + q, cy - q);
    ctx.lineTo(cx - q, cy + q);
    ctx.stroke();
    ctx.restore();
  }

  function pill(cx, cy, label, size, { fill, color, alpha = 1, padX = size * 0.6, h = size * 1.6, stroke = null }) {
    if (alpha <= 0.003) return 0;
    setFont(size);
    const w = ctx.measureText(label).width + padX * 2;
    box({ x: cx - w / 2, y: cy - h / 2, w, h }, { fill, stroke, width: 2, radius: h / 2, alpha });
    text(label, cx, cy + size * 0.36, { size, color, align: "center", alpha });
    return w;
  }

  // --- The picture ----------------------------------------------------------------------------

  function drawHeadline(film, t) {
    // Keep one readable heading while the diagram's objects continue moving.
    const s = SCENE_PLAN.find((scene) => t >= scene.in && t < scene.out) ?? SCENE_PLAN[SCENE_PLAN.length - 1];
    const head = film.headlines[s.id];
    const size = fitSize(head, L.headline.size, L.headline.min, L.headline.max);
    text(`記録 ${s.case}`, L.eyebrow.x, L.eyebrow.y, { size: L.eyebrow.size, color: C.accent });
    text(head, L.headline.x, L.headline.y, { size });
  }

  function drawLens(film, t) {
    const lens = L.lens;
    const pulses = film.notes.map((_, i) => arrival(i) - 0.35).concat([5.0, 21.1, 27.4]);
    for (const at of pulses) {
      const p = clamp01((t - at) / 0.6);
      if (p <= 0 || p >= 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(lens.cx, lens.cy, lens.r + p * lens.r * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = C.ink;
    ctx.lineCap = "round";
    ctx.lineWidth = lens.line * 1.4;
    ctx.beginPath();
    ctx.moveTo(lens.cx + lens.r * 0.72, lens.cy + lens.r * 0.72);
    ctx.lineTo(lens.cx + lens.r * 0.72 + lens.handle, lens.cy + lens.r * 0.72 + lens.handle);
    ctx.stroke();
    ctx.fillStyle = C.paper;
    ctx.lineWidth = lens.line;
    ctx.beginPath();
    ctx.arc(lens.cx, lens.cy, lens.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ivory;
    ctx.beginPath();
    ctx.arc(lens.cx - lens.r * 0.32, lens.cy - lens.r * 0.32, lens.r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Query token: what goes in.
    const ch = L.chip;
    const tokens = [
      { label: "保存の前に検索", a: win(t + 0.3, 0, 5.0, 0.3), quiet: true },
      { label: film.c03.query, a: win(t, 5.0, 27.4, 0.3) },
      { label: film.c07.query, a: win(t, 27.4, DURATION, 0.3) },
    ];
    for (const tok of tokens) {
      if (tok.a <= 0.003) continue;
      setFont(ch.size);
      const w = ctx.measureText(tok.label).width + ch.pad * 2;
      box({ x: ch.x, y: ch.y, w, h: ch.h }, { fill: tok.quiet ? C.paper : C.ink, stroke: tok.quiet ? C.line : null, width: 2, radius: ch.h / 2, alpha: tok.a });
      text(tok.label, ch.x + ch.pad, ch.y + ch.h / 2 + ch.size * 0.36, { size: tok.quiet ? Math.round(ch.size * 0.8) : ch.size, color: tok.quiet ? C.muted : C.paper, alpha: tok.a });
      const scopes = [
        { label: `→ ${PROJECT_JA[film.c03.project]}`, a: win(t, 5.3, 21.0, 0.3) },
        { label: `→ ${PIN.projects.length}案件`, a: win(t, 21.2, 25.8, 0.3) },
        { label: `→ ${PROJECT_JA[film.c07.project]}`, a: win(t, 27.6, DURATION, 0.3) },
      ];
      if (!tok.quiet) {
        for (const sc of scopes) text(sc.label, ch.x + w + ch.scopeGap, ch.y + ch.h / 2 + ch.scopeSize * 0.36, { size: ch.scopeSize, color: C.muted, alpha: Math.min(sc.a, tok.a) });
      }
    }
  }

  function routes(film, t) {
    const list = film.related.map((project, i) => ({ project, start: arrival(i) - 0.35, end: arrival(i) + 0.3, width: 4 }));
    list.push(
      { project: film.c03.project, start: 5.0, end: 21.0 },
      ...PIN.projects.map((project) => ({ project, start: 21.1, end: 25.8 })),
      { project: film.c07.project, start: 27.4, end: DURATION },
    );
    for (const r of list) {
      const shelf = L.shelves[r.project];
      const from = L.routeFrom;
      const to = [shelf.x + shelf.w / 2, shelf.y + 4];
      const pts = [from, [from[0], from[1] + 60], [to[0], to[1] - 80], to];
      const progress = clamp01((t - r.start) / 0.55);
      const alpha = r.end >= DURATION ? 1 : 1 - ramp(t, r.end - 0.3, r.end);
      if (t < r.start || alpha <= 0.003) continue;
      routeLine(pts, ease(progress), C[r.project].main, alpha, r.width ?? 6);
    }
  }

  function drawStore(film, t) {
    const cab = L.cab;
    box(cab, { fill: C.paper, stroke: C.ink, width: 3, radius: 22 });
    ctx.save();
    ctx.strokeStyle = C.ink;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cab.x, cab.y + cab.head);
    ctx.lineTo(cab.x + cab.w, cab.y + cab.head);
    ctx.stroke();
    ctx.restore();
    const reopened = ramp(t, 26.1, 26.4);
    const baseline = cab.y + cab.head / 2 + cab.headSize * 0.36;
    text("保存先 SQLite（1つ）", cab.x + 20, baseline, { size: cab.headSize, alpha: 1 - reopened });
    if (reopened > 0.003) {
      setFont(cab.headSize);
      const label = "新しいプロセスで開き直した保存先";
      const size = fitSize(label, cab.headSize, Math.round(cab.headSize * 0.75), cab.w - 160);
      text(label, cab.x + 20, baseline, { size, color: C.accent, alpha: reopened });
    }
    const arrived = film.notes.filter((_, i) => t >= arrival(i) + 0.6).length;
    const total = t >= 26.1 ? film.c07.total : arrived;
    text(`${total}件`, cab.x + cab.w - 20, baseline, { size: Math.round(cab.headSize * 1.1), align: "right" });

    for (const project of PIN.projects) {
      const shelf = L.shelves[project];
      const col = C[project];
      box(shelf, { fill: col.soft, radius: 14 });
      ctx.save();
      ctx.strokeStyle = col.main;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(shelf.x + 8, L.bookY + L.bookH + 6);
      ctx.lineTo(shelf.x + shelf.w - 8, L.bookY + L.bookH + 6);
      ctx.stroke();
      ctx.restore();
      const n = film.notes.filter((note, i) => note.project === project && t >= arrival(i) + 0.6).length;
      const shown = t >= 26.1 ? film.c07.counts[project] : n;
      const label = `${PROJECT_JA[project]} ${shown}`;
      const size = fitSize(label, L.shelfLabel.size, Math.round(L.shelfLabel.size * 0.7), shelf.w - 20);
      text(label, shelf.x + 12, shelf.y + L.shelfLabel.dy, { size, color: col.main });
    }
  }

  function drawSpine(film, note, r, alpha, glow) {
    if (alpha <= 0.003) return;
    const col = C[note.project];
    const f = L.spine;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (glow > 0.003) box({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }, { stroke: C.accent, width: 6, radius: 14, alpha: glow });
    box(r, { fill: col.main, radius: 10 });
    box({ x: r.x + 10, y: r.y + 14, w: r.w - 20, h: 6 }, { fill: C.paper, radius: 3, alpha: 0.5 });
    box({ x: r.x + 10, y: r.y + r.h - 54, w: r.w - 20, h: 4 }, { fill: C.paper, radius: 2, alpha: 0.35 });
    text(note.key, r.x + r.w / 2, r.y + 30 + f.key, { size: f.key, color: C.paper, align: "center" });
    const ls = fitSize(SPINE[note.key], f.label, Math.round(f.label * 0.7), r.w - 12);
    text(SPINE[note.key], r.x + r.w / 2, r.y + 60 + f.key + f.label, { size: ls, color: C.paper, align: "center" });
    text(`ID ${note.id}`, r.x + r.w / 2, r.y + r.h - 18, { size: f.id, weight: 600, color: C.paper, align: "center", alpha: 0.9 });
    ctx.restore();
  }

  function copyAlpha(film, key, t) {
    return trackAt(film.tracks.get(key), t)?.a ?? 0;
  }

  function drawSpines(film, t) {
    film.notes.forEach((note, i) => {
      const slot = slotRect(film, note.key);
      const col = C[note.project];
      const a0 = arrival(i);
      const landed = ramp(t, a0, a0 + 0.6);
      const out = copyAlpha(film, note.key, t);
      // The empty place stays drawn while a note is out or not yet saved.
      const ghost = Math.max(1 - landed, out);
      box(slot, { stroke: col.main, width: 3, radius: 10, dash: [10, 10], alpha: ghost * 0.7 });
      if (landed > 0.003) {
        const r = { ...slot, y: slot.y - (1 - landed) * 340 };
        drawSpine(film, note, r, landed * (1 - out), 0);
      }
    });
    // The replay of N01: a second copy drops onto the same book and merges into it.
    const n01 = film.notes.find((n) => n.key === "N01");
    const slot = slotRect(film, n01.key);
    const drop = ramp(t, 3.35, 3.95);
    const merge = 1 - ramp(t, 3.95, 4.3);
    if (t >= 3.35 && t <= 4.3) drawSpine(film, n01, { ...slot, y: slot.y - (1 - drop) * 300 }, 0.55 * merge, 0);
    const flash = pulse(t, 3.95, 0.5);
    if (flash > 0) box({ x: slot.x - 6, y: slot.y - 6, w: slot.w + 12, h: slot.h + 12 }, { stroke: C.accent, width: 6, radius: 14, alpha: flash });
    const badge = win(t, 4.0, 5.2, 0.25);
    pill(slot.x + slot.w / 2 + slot.w * 0.35, slot.y + slot.h * 0.55, `同じ ID ${film.replayId}`, L.copy.small, { fill: C.accent, color: C.paper, alpha: badge });
  }

  function drawDoors(t) {
    const close = ramp(t, 25.7, 26.05) * (1 - ramp(t, 26.25, 26.6));
    if (close <= 0.003) return;
    const cab = L.cab;
    const area = { x: cab.x + 8, y: cab.y + cab.head + 6, w: cab.w - 16, h: cab.h - cab.head - 14 };
    const half = (area.w / 2) * close;
    box({ x: area.x, y: area.y, w: half, h: area.h }, { fill: C.paper, stroke: C.ink, width: 3, radius: 10 });
    box({ x: area.x + area.w - half, y: area.y, w: half, h: area.h }, { fill: C.paper, stroke: C.ink, width: 3, radius: 10 });
    text("閉じて、開き直す", area.x + area.w / 2, area.y + area.h / 2 + L.gate.label * 0.36, { size: L.gate.label, align: "center", alpha: ramp(close, 0.7, 1) });
  }

  function gateGlow(i, t) {
    const own = [[5.2, 10.4], [10.4, 15.2], [15.2, 21.0]][i];
    let g = win(t, own[0], own[1], 0.3);
    for (const seq of [[22.0, 22.35, 22.7], [27.95, 28.25, 28.55]]) g = Math.max(g, pulse(t, seq[i], 0.6));
    return g;
  }

  function drawGates(film, t) {
    const G = L.gate;
    const used = [5.2, 10.4, 15.2];
    const scopeOne = PIN.projects.every((p) => film.c06.byProject[p]) ? `${1}件ずつ` : "";
    const badges = [
      [{ label: `${film.c03.order.length}件`, a: win(t, 7.0, 10.4) }],
      [{ label: `${film.c04.order.length}件`, a: win(t, 11.6, 15.2) }],
      [
        { label: `${film.c05.bodies}件`, a: win(t, 16.6, 21.0) },
        { label: scopeOne, a: win(t, 22.8, 25.8) },
        { label: `${1}件`, a: win(t, 28.7, DURATION) },
      ],
    ];
    L.gates.forEach((g, i) => {
      const glow = gateGlow(i, t);
      const done = ramp(t, used[i], used[i] + 0.3);
      ctx.save();
      rr(g.x, g.y, g.w, g.h, 18);
      ctx.fillStyle = C.paper;
      ctx.fill();
      ctx.globalAlpha = glow;
      ctx.fillStyle = C.accentSoft;
      ctx.fill();
      ctx.restore();
      box(g, { stroke: glow > 0.5 ? C.ink : done > 0.5 ? C.ink : C.line, width: 3 + glow * 2, radius: 18 });
      // drawer handle
      ctx.save();
      ctx.strokeStyle = done > 0.5 || glow > 0.3 ? C.ink : C.line;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(g.x + g.w / 2 - 26, g.y + g.h - 14);
      ctx.lineTo(g.x + g.w / 2 + 26, g.y + g.h - 14);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = glow > 0.3 ? C.accent : done > 0.5 ? C.ink : C.line;
      ctx.beginPath();
      ctx.arc(g.x + 44, g.y + G.labelDy - G.label * 0.36, G.numR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      text(String(i + 1), g.x + 44, g.y + G.labelDy - G.label * 0.36 + G.numSize * 0.36, { size: G.numSize, color: C.paper, align: "center" });
      text(["題名", "前後", "本文"][i], g.x + G.labelDx, g.y + G.labelDy, { size: G.label, color: done > 0.5 || glow > 0.3 ? C.ink : C.muted });
      for (const b of badges[i]) text(b.label, g.x + G.labelDx, g.y + G.badgeDy, { size: G.badge, color: C.accent, alpha: b.a });

      // Connector toward the next gate, and from the active gate toward the tray.
      ctx.save();
      ctx.fillStyle = C.ink;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      if (i < L.gates.length - 1) {
        if (G.flow === "row") {
          const x = g.x + g.w + 4, y = g.y + g.h / 2;
          ctx.moveTo(x - 7, y - 14); ctx.lineTo(x + 9, y); ctx.lineTo(x - 7, y + 14);
        } else {
          const x = g.x + g.w / 2, y = g.y + g.h + 15;
          ctx.moveTo(x - 14, y - 7); ctx.lineTo(x, y + 9); ctx.lineTo(x + 14, y - 7);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      if (glow > 0.003) {
        ctx.save();
        ctx.strokeStyle = C.ink;
        ctx.globalAlpha = glow * 0.5;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        if (G.flow === "row") {
          ctx.moveTo(g.x + g.w / 2, g.y + g.h);
          ctx.lineTo(g.x + g.w / 2, L.tray.y - 4);
        } else {
          ctx.moveTo(g.x + g.w, g.y + g.h / 2);
          ctx.lineTo(L.tray.x - 4, g.y + g.h / 2);
        }
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  function drawSaveChips(film, t) {
    const fade = 1 - ramp(t, 5.0, 5.5);
    if (fade <= 0.003) return;
    const f = L.copy;
    for (const project of PIN.projects) {
      film.notes.filter((n) => n.project === project).forEach((note, i) => {
        const index = film.notes.indexOf(note);
        const a = ramp(t, arrival(index) + 0.45, arrival(index) + 0.75) * fade;
        if (a <= 0.003) return;
        const r = L.saves[project](i);
        const col = C[project];
        box(r, { fill: col.soft, stroke: col.main, width: 3, radius: 14, alpha: a });
        text(note.key, r.x + f.pad * 0.6, r.y + r.h / 2 + f.key * 0.36, { size: f.key, color: col.main, alpha: a });
        text(`ID ${film.saves[note.key]}`, r.x + r.w - f.pad * 0.6, r.y + r.h / 2 + f.title * 0.36, { size: f.title, align: "right", alpha: a });
      });
    }
    const a = ramp(t, 4.0, 4.3) * fade;
    const r = L.replay;
    box(r, { stroke: C.accent, width: 3, radius: 14, dash: [10, 8], alpha: a });
    const label = `N01 再送 → ID ${film.replayId}`;
    const size = fitSize(label, f.small, Math.round(f.small * 0.75), r.w - 24);
    text(label, r.x + r.w / 2, r.y + r.h / 2 + size * 0.36, { size, align: "center", color: C.accent, alpha: a });
  }

  function flagFor(film, key, t) {
    const chosen = film.chosen.includes(key);
    const list = [];
    if (chosen) list.push({ label: "呼び出し側が選択", a: win(t, 8.4, 10.5), accent: true });
    if (film.c04.order.includes(key)) list.push({ label: chosen ? "選んだ1件" : "前後", a: win(t, 11.7, 15.2), accent: chosen });
    return list;
  }

  function accentFor(film, key, t) {
    let a = 0;
    if (film.chosen.includes(key)) a = Math.max(a, win(t, 8.2, 21.2, 0.5));
    if (key === film.c07.key) a = Math.max(a, win(t, 28.3, DURATION, 0.4));
    return a;
  }

  function drawTab(film, note, r, alpha, t) {
    const f = L.copy;
    const col = C[note.project];
    const accent = accentFor(film, note.key, t);
    ctx.save();
    ctx.globalAlpha *= alpha;
    rr(r.x, r.y, r.w, r.h, 14);
    ctx.clip();
    box(r, { fill: C.paper, radius: 14 });
    box({ x: r.x, y: r.y, w: 16, h: r.h }, { fill: col.main, radius: 0 });
    const order = film.c03.order.indexOf(note.key);
    const orderA = order >= 0 ? win(t, 6.0, 10.6) : 0;
    const keyX = r.x + 32 + (orderA > 0.01 ? f.small * 1.4 : 0) * orderA;
    if (orderA > 0.003) text(String(order + 1), r.x + 34, r.y + f.key + 6, { size: f.small, color: C.muted, alpha: orderA });
    text(note.key, keyX, r.y + f.key + 6, { size: f.key, color: col.main });
    const ts = fitSize(note.title, f.title, Math.round(f.title * 0.7), r.w - 52);
    text(note.title, r.x + 32, r.y + r.h - 18, { size: ts, weight: 600 });
    for (const flag of flagFor(film, note.key, t)) {
      if (flag.a <= 0.003) continue;
      setFont(f.flag);
      const w = ctx.measureText(flag.label).width + f.flag * 1.2;
      box({ x: r.x + r.w - w - 14, y: r.y + 12, w, h: f.flag * 1.6 }, { fill: flag.accent ? C.accent : C.ivory, radius: f.flag * 0.8, alpha: flag.a });
      text(flag.label, r.x + r.w - 14 - w / 2, r.y + 12 + f.flag * 1.16, { size: f.flag, color: flag.accent ? C.paper : C.muted, align: "center", alpha: flag.a });
    }
    ctx.restore();
    box(r, { stroke: accent > 0.01 ? C.accent : C.line, width: 3 + accent * 3, radius: 14, alpha });
  }

  function drawOpen(film, note, r, alpha, t) {
    const f = L.copy;
    const col = C[note.project];
    const half = r.w / 2;
    const accent = accentFor(film, note.key, t);
    ctx.save();
    ctx.globalAlpha *= alpha;
    rr(r.x - 8, r.y - 8, r.w + 16, r.h + 16, 22);
    ctx.clip();
    box(r, { fill: col.main, radius: 16 });
    const left = { x: r.x + 10, y: r.y + 10, w: half - 12, h: r.h - 20 };
    const right = { x: r.x + half + 2, y: r.y + 10, w: half - 12, h: r.h - 20 };
    box(left, { fill: C.paper, radius: 8 });
    box(right, { fill: C.paper, radius: 8 });
    ctx.save();
    ctx.strokeStyle = C.ink;
    ctx.globalAlpha *= 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x + half, r.y + 12);
    ctx.lineTo(r.x + half, r.y + r.h - 12);
    ctx.stroke();
    ctx.restore();
    const pad = f.pad * 0.7;
    text(note.key, left.x + pad, left.y + pad + f.key * 0.9, { size: f.key, color: col.main });
    setFont(f.key);
    const kw = ctx.measureText(note.key).width;
    text(`ID ${note.id}`, left.x + pad + kw + f.small * 0.6, left.y + pad + f.key * 0.9, { size: f.small, weight: 600, color: C.muted });
    const titleLines = wrap(note.title, left.w - pad * 2, f.title * 0.86, 700);
    titleLines.slice(0, 3).forEach((line, i) => text(line, left.x + pad, left.y + pad + f.key * 0.9 + f.title * 1.35 * (i + 1), { size: f.title * 0.86 }));
    text("保存した本文", left.x + pad, left.y + left.h - pad * 0.8, { size: f.small * 0.9, weight: 600, color: C.muted });
    const ex = `「${EXCERPT[note.key] ?? ""}」`;
    const lines = wrap(ex, right.w - pad * 2, f.excerpt, 700);
    lines.forEach((line, i) => text(line, right.x + pad, right.y + pad + f.excerpt * (1 + i * 1.32), { size: f.excerpt }));
    ctx.restore();
    if (accent > 0.01) box({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }, { stroke: C.accent, width: 6, radius: 20, alpha: alpha * accent });
  }

  function drawCard(film, note, r, alpha) {
    const f = L.copy;
    const col = C[note.project];
    const steps = film.c06.byProject[note.project]?.steps ?? [];
    ctx.save();
    ctx.globalAlpha *= alpha;
    rr(r.x, r.y, r.w, r.h, 16);
    ctx.clip();
    box(r, { fill: C.paper, radius: 16 });
    box({ x: r.x, y: r.y, w: r.w, h: f.header }, { fill: col.main, radius: 0 });
    text(PROJECT_JA[note.project], r.x + f.pad * 0.7, r.y + f.header / 2 + f.headerSize * 0.36, { size: f.headerSize, color: C.paper });
    const body = r.y + f.header;
    const tall = L.tall;
    text(note.key, r.x + f.pad * 0.7, body + f.key * 1.25, { size: f.key, color: col.main });
    setFont(f.key);
    const kw = ctx.measureText(note.key).width;
    text("本文 1件", r.x + f.pad * 0.7 + kw + f.small * 0.7, body + f.key * 1.25, { size: f.small, color: C.muted });
    const tag = TAG[note.key];
    const ts = fitSize(tag, f.title, Math.round(f.title * 0.7), r.w - f.pad * 1.4);
    text(tag, r.x + f.pad * 0.7, body + f.key * 1.25 + ts * (tall ? 1.5 : 1.35), { size: ts, weight: 700 });
    const trace = steps.join("→");
    const ss = fitSize(trace, f.small, Math.round(f.small * 0.75), r.w - f.pad * 1.4);
    text(trace, r.x + f.pad * 0.7, r.y + r.h - f.pad * 0.6, { size: ss, weight: 600, color: C.muted });
    ctx.restore();
    box(r, { stroke: col.main, width: 4, radius: 16, alpha });
  }

  function drawCopies(film, t) {
    for (const note of film.notes) {
      const st = trackAt(film.tracks.get(note.key), t);
      if (!st || st.a <= 0.003) continue;
      const forms = st.from === st.to ? [[st.from, 1]] : [[st.from, 1 - st.p], [st.to, st.p]];
      for (const [form, k] of forms) {
        const a = st.a * k;
        if (a <= 0.003) continue;
        if (form === "tab") drawTab(film, note, st.r, a, t);
        else if (form === "open") drawOpen(film, note, st.r, a, t);
        else drawCard(film, note, st.r, a);
      }
    }
    // Context binding: the chosen note and its neighbour, side by side.
    const bind = win(t, 11.6, 15.2);
    if (bind > 0.003) {
      const a = L.pair[0], b = L.pair[L.pair.length - 1];
      ctx.save();
      ctx.globalAlpha = bind;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      const x = a.x - 12;
      ctx.moveTo(x + 8, a.y + 6);
      ctx.lineTo(x, a.y + 6);
      ctx.lineTo(x, b.y + b.h - 6);
      ctx.lineTo(x + 8, b.y + b.h - 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  // The previous process's continuation: it travels to the context gate and stops there.
  function drawTicket(film, t) {
    const appear = ramp(t, 26.6, 26.85);
    if (appear <= 0.003) return;
    const tk = L.ticket;
    const move = ramp(t, 26.8, 27.3);
    const r = lerpRect(tk.start, tk.park, move);
    const dim = 1 - ramp(t, 28.2, 28.8) * 0.35;
    const a = appear * dim;
    box(r, { fill: C.paper, stroke: C.reject, width: 3, radius: r.h / 2, dash: [10, 7], alpha: a });
    const size = fitSize("前の合図", tk.size, Math.round(tk.size * 0.75), r.w - r.h - 20);
    text("前の合図", r.x + r.h * 0.5, r.y + r.h / 2 + size * 0.36, { size, color: C.reject, alpha: a });
    crossMark(r.x + r.w - r.h / 2, r.y + r.h / 2, r.h * 0.42 * (0.6 + 0.4 * ramp(t, 27.3, 27.55)), ramp(t, 27.25, 27.45) * dim);
  }

  function drawStatus(film, t) {
    const sp = L.status;
    const split = (counts) => PIN.projects.map((p) => counts[p]).join("＋");
    const lines = [
      { label: `保存 ${film.total}件（${split(film.counts)}）`, a: win(t, 3.0, 4.3, 0.25) },
      { label: `再送は同じ ID ${film.replayId} ・ ${film.total}件のまま`, a: win(t, 4.3, 5.1, 0.25) },
      { label: `本文 ${film.c03.bodies}件 ・ 題名だけ`, a: win(t, 7.2, 10.4) },
      { label: `${film.chosen.join("・")}の前後${film.c04.depth}件 ・ 本文 ${film.c04.bodies}件`, a: win(t, 11.8, 15.2) },
      { label: `本文 ${film.c05.bodies}件 ・ ほかの${film.notes.length - film.c05.bodies}件は閉じたまま`, a: win(t, 17.0, 21.0) },
      { label: `同じ「${film.c06.query}」→ 案件ごとに別の1件`, a: win(t, 23.0, 25.6) },
      { label: `新しいプロセス ・ ${film.c07.total}件（${split(film.c07.counts)}）`, a: win(t, 26.3, 28.7) },
      { label: `同じ ID ${film.c07.id} ・ ${film.c07.total}件のまま`, a: win(t, 28.9, DURATION) },
    ];
    for (const line of lines) {
      if (line.a <= 0.003) continue;
      const size = fitSize(line.label, sp.size, sp.min, sp.max);
      text(line.label, sp.x, sp.y, { size, color: C.ink, align: sp.align === "center" ? "center" : "left", alpha: line.a });
    }
  }

  function drawCta(t) {
    const a = ramp(t, 29.0, 29.5);
    if (a <= 0.003) return;
    const c = L.cta;
    const label = "実際の記録は作例ページで（C01〜C08）";
    const size = fitSize(label, c.size, Math.round(c.size * 0.7), c.w - 40);
    box({ x: c.cx - c.w / 2, y: c.cy - c.h / 2, w: c.w, h: c.h }, { fill: C.ink, radius: c.h / 2, alpha: a });
    text(label, c.cx, c.cy + size * 0.36, { size, color: C.paper, align: "center", alpha: a });
  }

  function drawFooter(film) {
    const f = L.foot;
    const a = "保存済みの実行結果を図にした無音の概念図・架空の2案件・新しい推論なし";
    const b = `${film.source.repository} ${film.source.version}（${film.source.commit.slice(0, 7)}・${film.source.license}）／ 図 Studio Yebisu（MIT）`;
    const lines = f.oneLine ? [`${a} ｜ ${b}`] : [a, b];
    lines.forEach((line, i) => {
      const size = fitSize(line, f.size, f.min, f.max, 500);
      text(line, f.x, f.ys[i], { size, weight: 500, color: C.muted });
    });
  }

  function drawFrame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.ivory;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(S, 0, 0, S, OX, OY);
    drawHeadline(film, t);
    drawStore(film, t);
    drawSpines(film, t);
    drawDoors(t);
    routes(film, t);
    drawLens(film, t);
    drawGates(film, t);
    drawSaveChips(film, t);
    drawCopies(film, t);
    drawTicket(film, t);
    drawStatus(film, t);
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
      const mark = document.createElement("span");
      mark.className = `asset-state is-${st ?? "pending"}`;
      mark.textContent = st === "ok" ? "一致" : st === "bad" ? "不一致・読めない" : "照合前";
      li.append(name, " ", mark, ` ${a.bytes.toLocaleString("en-US")} bytes`);
      return li;
    }));
  }

  function showTime() {
    ui.clock.textContent = loading ? "照合中" : !film ? "映像なし（照合失敗）" : `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
  }

  function playLabel() {
    ui.play.textContent = isPlaying ? "一時停止" : current >= DURATION - 0.001 ? "もう一度再生" : "再生";
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
      b.append(time, `${headlines?.[s.id] ?? s.id}（記録 ${s.case}）`);
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
      setState("ready", `照合済み（${ASSETS.length} / ${ASSETS.length}素材）。無音の動く概念図です。再生は操作したときだけ始まります。`);
      return true;
    });
    ready.catch(fail);
    window.motionReady = ready;
    return ready;
  }

  buildSceneList(null);
  ui.play.addEventListener("click", () => (isPlaying ? stop() : play()));
  ui.reset.addEventListener("click", () => window.seek(0).catch(fail));
  ui.time.addEventListener("input", () => window.seek(ui.time.value).catch(fail));
  ui.retry.addEventListener("click", start);
  start();
})();
