/*
 * Studio Yebisu — Claude-Mem 作例・解説動画（28秒・無音・1280×720）
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * Every frame is drawn on one 2D canvas from absolute time only. Titles, IDs, bodies and counts
 * come from the saved run record and inputs, read after all eight files listed in
 * assets/data-hashes.json match their SHA-256. There is no built-in fallback data: on any
 * mismatch window.motionReady rejects, the failure is shown and no film is drawn.
 * Page text is written with textContent only.
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
  const MANIFEST_SHA256 = "4c008abd6a277b3a518f069ec7769762a76cf2e60f22810df7443739c9254d5c";
  const ASSET_KEYS = [
    "outputs/memory-run.json",
    "outputs/independent-checks.json",
    "input/notes.json",
    "input/scenarios.json",
    "vendor-lock.json",
    "video/assets/screens.json",
    "video/assets/phone.png",
    "video/assets/desktop.png",
  ];
  const FROZEN = {
    format: "studio-yebisu-claude-mem-run-v1",
    repository: "thedotmack/claude-mem",
    commit: "fef3402e674bebbf72a23aeb735e91c92cd34afd",
    version: "13.39.0",
    license: "Apache-2.0",
    bun: "1.4.3",
    sourceFiles: 194,
    checks: 99,
  };
  const SAMPLE_IDS = ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"];
  const SITE_URL = "studio-yebisu.github.io/studio-yebisu/";
  const OPERATION_JA = { search: "索引", timeline: "文脈", fetch: "本文" };
  // C05: the second sentence of the returned body is shown large, labelled 「本文から抜粋」.
  const EXCERPT_SENTENCE = 1;

  // --- Page ------------------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const ui = {
    editor: $("editor"),
    status: $("status"),
    errorBox: $("error-box"),
    errorText: $("error-text"),
    canvas: $("film"),
    play: $("play"),
    pause: $("pause"),
    reset: $("reset"),
    scrub: $("scrub"),
    time: $("time"),
    timeLabel: $("time-label"),
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
  // Layout is authored in a 1280×720 space and scaled to the requested size (landscape only).
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
      throw new Error(`${name} を読み込めませんでした。site フォルダーをローカルの HTTP サーバーで開いてください。`);
    }
    check(response.ok, `${name} を読み込めませんでした（HTTP ${response.status}）。`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function parseJson(bytes, name) {
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`${name} が UTF-8 の文字として読めません。`);
    }
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
      verdict.className = item.ok ? "verdict is-ok" : "verdict is-ng";
      verdict.textContent = item.ok ? "一致" : "不一致";
      const digest = document.createElement("code");
      digest.className = "digest";
      digest.textContent = item.actual;
      li.append(name, " ", verdict, document.createElement("br"), digest);
      return li;
    });
    ui.assetList.replaceChildren(...rows);
    const ok = [...assetState.values()].filter((item) => item.ok).length;
    ui.assetSummary.textContent = manifestVerified
      ? `video/assets/data-hashes.json（SHA-256 ${MANIFEST_SHA256}）は固定値と一致。記された${ASSET_KEYS.length}件のうち${ok}件が一致しました。`
      : "video/assets/data-hashes.json の照合が済んでいません。";
  }

  async function loadFonts() {
    if (!document.fonts) return;
    const sample = "前回の判断を必要な分だけ取り出す 0123456789 ID";
    const specs = [400, 500, 600, 700, 800].map((weight) => font(24, weight)).concat([font(16, 400, MONO), font(16, 700, MONO)]);
    await Promise.all(specs.map((spec) => document.fonts.load(spec, sample).catch(() => [])));
    await document.fonts.ready;
  }

  async function load() {
    check(globalThis.crypto && crypto.subtle, "このブラウザーでは SHA-256 を計算できません。localhost など安全な場所で開いてください。");
    const manifestName = "video/assets/data-hashes.json";
    const manifestBytes = await fetchBytes(new URL(MANIFEST_PATH, BASE), manifestName);
    check(await sha256Hex(manifestBytes) === MANIFEST_SHA256, `${manifestName} の SHA-256 が固定値と一致しません。`);
    manifestVerified = true;
    const manifest = parseJson(manifestBytes, manifestName);
    const hashes = manifest && manifest.files;
    check(hashes && typeof hashes === "object" && !Array.isArray(hashes), `${manifestName} に files がありません。`);
    check(Object.keys(hashes).length === ASSET_KEYS.length && ASSET_KEYS.every((key) => Object.hasOwn(hashes, key)),
      `${manifestName} の対象が予定の${ASSET_KEYS.length}件ではありません。`);
    for (const key of ASSET_KEYS) {
      check(typeof hashes[key] === "string" && /^[0-9a-f]{64}$/.test(hashes[key]), `${key} の SHA-256 の形が違います。`);
      check(!key.startsWith("/") && !key.split("/").includes(".."), `${key} は site の中の相対パスではありません。`);
    }
    showAssets();

    const bytes = {};
    await Promise.all(ASSET_KEYS.map(async (key) => {
      const data = await fetchBytes(new URL(`../${key}`, BASE), key);
      const actual = await sha256Hex(data);
      assetState.set(key, { expected: hashes[key], actual, ok: actual === hashes[key] });
      showAssets();
      check(actual === hashes[key], `${key} の SHA-256 が data-hashes.json と一致しません。`);
      bytes[key] = data;
    }));

    const json = {};
    const bitmaps = {};
    for (const key of ASSET_KEYS) {
      if (key.endsWith(".json")) {
        json[key] = parseJson(bytes[key], key);
      } else {
        try {
          bitmaps[key] = await createImageBitmap(new Blob([bytes[key]], { type: "image/png" }));
        } catch {
          throw new Error(`${key} を画像として読めません。`);
        }
      }
    }
    const model = buildModel(json, hashes, bitmaps);
    await loadFonts();
    layoutText(model);
    return model;
  }

  function buildModel(json, hashes, bitmaps) {
    const run = json["outputs/memory-run.json"];
    const audit = json["outputs/independent-checks.json"];
    const notesDoc = json["input/notes.json"];
    const scenariosDoc = json["input/scenarios.json"];
    const lock = json["vendor-lock.json"];
    const screensDoc = json["video/assets/screens.json"];

    // Source, lock, inputs and runtime.
    check(run && run.format === FROZEN.format, "実行記録の形式が違います。");
    const source = run.source || {};
    check(source.repository === FROZEN.repository && source.commit === FROZEN.commit && source.version === FROZEN.version
      && source.license === FROZEN.license && typeof source.notice === "string" && source.notice.length > 0,
      "実行記録の原典・固定コミット・版・ライセンスが固定値と一致しません。");
    check(run.source_lock_sha256 === hashes["vendor-lock.json"], "実行記録の vendor-lock.json の SHA-256 が一致しません。");
    check(lock && lock.repository === FROZEN.repository && lock.commit === FROZEN.commit && lock.version === FROZEN.version
      && lock.license === FROZEN.license && Array.isArray(lock.files) && lock.files.length === FROZEN.sourceFiles,
      "vendor-lock.json の固定版または件数が違います。");
    check(run.source_files_verified && run.source_files_verified.count === FROZEN.sourceFiles, "原典の照合件数が固定値と一致しません。");
    const inputHashes = run.input_sha256 || {};
    for (const key of ["input/notes.json", "input/scenarios.json"]) {
      check(inputHashes[key] === hashes[key], `${key} の SHA-256 が実行記録と一致しません。`);
    }
    check(run.runtime && run.runtime.bun === FROZEN.bun, "Bun の版が記録と一致しません。");

    // Automatic checks, guards and the fresh process.
    const checks = run.checks || {};
    check(checks.passed === true && checks.total === FROZEN.checks && checks.expected_total === FROZEN.checks
      && Array.isArray(checks.items) && checks.items.length === FROZEN.checks && checks.items.every((item) => item.passed === true),
      "実行記録の自動確認がすべて合格になっていません。");
    check(run.guards && run.guards.all_attempts_total === 0 && run.guards.network_attempts_total === 0,
      "通信・サーバー・プロセス起動の試みが0件ではありません。");
    check(run.process && run.process.fresh_process === true && run.process.worker_exit_code === 0 && run.process.own_worker_spawns === 1,
      "新しいプロセスでの読み直しが記録されていません。");

    // Samples C01..C08.
    check(Array.isArray(run.samples) && run.samples.map((item) => item.id).join(",") === SAMPLE_IDS.join(","),
      "実行記録の場面が C01〜C08 の順ではありません。");
    check(scenariosDoc && scenariosDoc.format === "studio-yebisu-claude-mem-scenarios-v1" && Array.isArray(scenariosDoc.scenarios)
      && scenariosDoc.scenarios.map((item) => item.id).join(",") === SAMPLE_IDS.join(","), "input/scenarios.json の場面が C01〜C08 ではありません。");
    const S = {};
    run.samples.forEach((sample, index) => {
      check(sample.label === scenariosDoc.scenarios[index].label, `${sample.id} の名前が入力と一致しません。`);
      check(Array.isArray(sample.checks) && sample.checks.length > 0 && sample.checks.every((item) => item.passed === true)
        && checks.by_sample && checks.by_sample[sample.id] === sample.checks.length, `${sample.id} の確認が合格していません。`);
      check(sample.input && Array.isArray(sample.input.calls) && sample.output && Array.isArray(sample.output.calls), `${sample.id} に入力または出力がありません。`);
      S[sample.id] = sample;
    });
    const call = (id, name) => {
      const found = S[id].output.calls.find((item) => item.name === name);
      check(found, `${id} に ${name} の結果がありません。`);
      return found;
    };
    const argsOf = (id, name) => {
      const found = S[id].input.calls.find((item) => item.name === name);
      check(found && found.args, `${id} に ${name} の入力がありません。`);
      return found.args;
    };
    const operations = (result) => (Array.isArray(result.trace) ? result.trace.map((step) => step.operation) : []);

    // The five explicit notes (C02) and the independent SQLite audit.
    check(notesDoc && notesDoc.format === "studio-yebisu-claude-mem-notes-v1" && notesDoc.fictional === true
      && Array.isArray(notesDoc.notes) && notesDoc.notes.length === 5, "input/notes.json の形が違います。");
    check(audit && audit.status === "passed" && audit.source && audit.source.commit === FROZEN.commit && audit.input_hashes_match === true
      && audit.database_unchanged_by_audit === true && audit.sqlite_integrity === "ok" && audit.vendor_files_checked === FROZEN.sourceFiles
      && Array.isArray(audit.fts_queries), "独立した SQLite 監査が合格になっていません。");
    const notes = {};
    const notesList = notesDoc.notes.map((input) => {
      const saved = call("C02", `save:${input.key}`).result;
      check(saved && saved.success === true && saved.duplicate !== true, `${input.key} が新しく保存されていません。`);
      const id = String(saved.id);
      check(String(run.ids && run.ids[input.key]) === id && saved.title === input.title && saved.project === input.project,
        `${input.key} の保存結果が入力と一致しません。`);
      const audited = audit.notes && audit.notes[input.key];
      check(audited && String(audited.id) === id && audited.title === saved.title && audited.project === saved.project,
        `${input.key} が SQLite 監査と一致しません。`);
      const note = { key: input.key, id, title: saved.title, project: saved.project, text: input.text };
      notes[input.key] = note;
      return note;
    });
    const keyById = new Map(notesList.map((note) => [note.id, note.key]));
    check(keyById.size === notesList.length, "保存した5件の ID が重複しています。");
    const noteById = (id) => {
      const key = keyById.get(String(id));
      check(key, `ID ${id} は保存した5件にありません。`);
      return notes[key];
    };
    const saveOrder = S.C02.output.calls.filter((item) => item.name.startsWith("save:")).map((item) => item.name.slice(5));
    check(saveOrder.length === notesList.length && new Set(saveOrder).size === saveOrder.length && saveOrder.every((key) => notes[key]),
      "C02 の保存順が5件と一致しません。");

    const after = S.C02.output.sql_audit_after || {};
    const byProject = after.observations_by_project || {};
    const projects = Object.keys(byProject);
    check(after.observations === notesList.length && projects.length === 2
      && projects.reduce((sum, project) => sum + byProject[project], 0) === after.observations && audit.total_notes === after.observations,
      "C02 の保存後の件数が監査と一致しません。");
    for (const project of projects) {
      check(notesList.filter((note) => note.project === project).length === byProject[project]
        && audit.active_counts && audit.active_counts[project] === byProject[project] && byProject[project] <= 4,
        `${project} の件数が監査と一致しません。`);
    }
    const replayKey = S.C02.input.scenario && S.C02.input.scenario.replay_key;
    check(notes[replayKey], "C02 の再送の対象がありません。");
    const replay = call("C02", `replay:${replayKey}`).result;
    check(replay && replay.duplicate === true && String(replay.id) === notes[replayKey].id, "再送が同じ ID の duplicate になっていません。");

    // C01: before saving.
    const empty = call("C01", "empty_search").result;
    check(empty.complete === true && empty.reason === "no_results" && empty.index.length === 0 && empty.observations.length === 0
      && S.C01.output.sql_audit_before && S.C01.output.sql_audit_before.observations === 0, "C01 が保存前の0件になっていません。");

    // C03: titles only.
    const index = call("C03", "index").result;
    check(index.step === 1 && index.complete === false && index.observations.length === 0 && index.index.length > 0
      && index.index.every((row) => row.project === index.project && noteById(row.id).title === row.title),
      "C03 が題名だけの索引になっていません。");
    const ftsIndex = audit.fts_queries.find((item) => item.query === index.query && item.project === index.project);
    check(ftsIndex && ftsIndex.matches_original_inputs === true
      && ftsIndex.ids.map(String).sort().join(",") === index.index.map((row) => String(row.id)).sort().join(","),
      "C03 の索引が SQLite 監査の検索結果と一致しません。");
    const c03 = { query: index.query, project: index.project, keys: index.index.map((row) => noteById(row.id).key), bodies: index.observations.length };

    // C04: nearby titles for the caller's choice.
    const context = call("C04", "context").result;
    const selected4 = argsOf("C04", "context").selectedIds.map(String);
    const scenario4 = S.C04.input.scenario || {};
    check(context.step === 2 && context.observations.length === 0 && selected4.length === 1
      && context.index.some((row) => String(row.id) === selected4[0])
      && context.index.every((row) => row.project === index.project && noteById(row.id).title === row.title)
      && Number.isInteger(scenario4.depthBefore) && scenario4.depthBefore === scenario4.depthAfter,
      "C04 が選んだ記録の前後の題名になっていません。");
    const c04 = {
      keys: context.index.map((row) => noteById(row.id).key),
      bodies: context.observations.length,
      selected: noteById(selected4[0]).key,
      depth: scenario4.depthBefore,
    };
    check(c03.keys.includes(c04.selected), "C04 で選んだ記録が C03 の索引にありません。");

    // C05: exactly one chosen body.
    const details = call("C05", "details").result;
    const selected5 = argsOf("C05", "details").selectedIds.map(String);
    check(details.step === 3 && details.complete === true && details.observations.length === 1 && selected5.length === 1
      && String(details.observations[0].id) === selected5[0] && noteById(selected5[0]).key === c04.selected,
      "C05 が選んだ1件の本文になっていません。");
    const observation = details.observations[0];
    const hero = noteById(observation.id);
    const split = typeof observation.content === "string" ? observation.content.indexOf("\n\n") : -1;
    check(observation.truncated === false && split > 0, "C05 の本文の形が違います。");
    const subtitle = observation.content.slice(0, split);
    const body = observation.content.slice(split + 2);
    const auditRow = (S.C02.output.sql_audit_rows || []).find((row) => String(row.id) === hero.id);
    check(auditRow && auditRow.subtitle === subtitle && auditRow.narrative_matches_input === true
      && body === hero.text && observation.title === hero.title && observation.project === hero.project,
      "C05 の本文が保存したメモと一致しません。");
    const sentences = body.match(/[^。]+。/g) || [];
    const excerpt = sentences[EXCERPT_SENTENCE];
    check(excerpt && body.includes(excerpt) && excerpt.includes("44px") && body.includes("env(safe-area-inset-bottom)"),
      "C05 の本文から抜粋する文が見つかりません。");
    const steps = operations(details);
    check(steps.join(",") === "search,timeline,fetch", "C05 の段階が 索引 → 文脈 → 本文 ではありません。");
    const c05 = { key: hero.key, id: hero.id, project: hero.project, count: details.observations.length, subtitle, body, excerpt };

    // C06: the same query in two project scopes (auto mode).
    const scenario6 = S.C06.input.scenario || {};
    check(Array.isArray(scenario6.projects) && scenario6.projects.length === 2, "C06 のプロジェクトが2つではありません。");
    const c06rows = scenario6.projects.map((project) => {
      const result = call("C06", `auto:${project}`).result;
      check(result.mode === "auto" && result.strategy === "ranked-lexical" && result.step === 3 && result.complete === true
        && result.query === scenario6.query && result.project === project && result.observations.length === 1
        && operations(result).join(",") === "search,timeline,fetch", `C06 の ${project} が3段階で1件になっていません。`);
      const found = result.observations[0];
      const note = noteById(found.id);
      check(note.project === project && found.title === note.title && found.content.endsWith(note.text), `C06 の ${project} の本文が保存したメモと一致しません。`);
      return { project, key: note.key, id: note.id, title: note.title, count: result.observations.length };
    });
    const heroRow = c06rows.find((row) => row.project === hero.project);
    const otherRow = c06rows.find((row) => row.project !== hero.project);
    check(heroRow && heroRow.key === hero.key && otherRow && otherRow.key !== hero.key && typeof S.C06.output.scope_note === "string",
      "C06 の結果が場面の構成と合いません。");
    let prefix = 0;
    while (prefix < heroRow.title.length && heroRow.title[prefix] === otherRow.title[prefix]) prefix += 1;

    // C07: a fresh Bun process reopens the same SQLite file.
    const worker = S.C07.output.worker || {};
    const reopened = call("C07", "worker_auto").result;
    check(worker.fresh_process === true && worker.exit_code === 0 && reopened.observations.length === 1
      && operations(reopened).join(",") === "search,timeline,fetch", "C07 の新しいプロセスの結果が1件ではありません。");
    const found7 = reopened.observations[0];
    const note7 = noteById(found7.id);
    check(found7.title === note7.title && found7.content.endsWith(note7.text) && note7.key !== hero.key && note7.project === reopened.project,
      "C07 の本文が保存したメモと一致しません。");
    const workerAudit = worker.sql_audit || {};
    check(workerAudit.observations === after.observations && workerAudit.observations_by_project
      && projects.every((project) => workerAudit.observations_by_project[project] === byProject[project]),
      "新しいプロセスで数えた件数が保存時と一致しません。");
    const fts7 = audit.fts_queries.find((item) => item.query === reopened.query && item.project === reopened.project);
    check(fts7 && fts7.ids.map(String).join(",") === note7.id, "C07 の検索結果が SQLite 監査と一致しません。");
    const oldCursor = call("C07", "worker_old_continuation").error;
    check(oldCursor && oldCursor.code === "invalid_continuation", "前のプロセスの合図が拒まれていません。");
    const minutes = /(\d+)\s*minutes/.exec(String(S.C07.output.cursor_note || ""));
    check(minutes, "続きの合図の有効時間が記録にありません。");

    // C08: guard results.
    const rejected = S.C08.output.calls.filter((item) => item.error);
    check(Array.isArray(S.C08.input.scenario.tests) && rejected.length === S.C08.input.scenario.tests.length
      && rejected.every((item) => item.error.is_progressive_search_error === true), "C08 の拒否が記録と一致しません。");
    const unknown = call("C08", "unregistered_project").result;
    check(unknown.index.length === 0 && unknown.observations.length === 0, "未登録のプロジェクトが0件ではありません。");

    // Recorded viewer screenshots.
    check(screensDoc && Array.isArray(screensDoc.screens) && screensDoc.screens.length === 2, "video/assets/screens.json の形が違います。");
    const shots = {};
    for (const screen of screensDoc.screens) {
      const bitmap = bitmaps[screen.file];
      check(bitmap && screen.sha256 === hashes[screen.file] && screen.actual_native_browser_screenshot === true
        && screen.byte_identical_to_capture === true && screen.edited === false
        && bitmap.width === screen.width && bitmap.height === screen.height && SAMPLE_IDS.includes(screen.sample),
        `${screen.file} が記録された実画面と一致しません。`);
      shots[screen.height > screen.width ? "phone" : "desktop"] = { bitmap, width: screen.width, height: screen.height, sample: screen.sample };
    }
    check(shots.phone && shots.desktop, "スマホとデスクトップの実画面が揃っていません。");

    const model = {
      repository: source.repository,
      version: source.version,
      commit: source.commit,
      shortCommit: source.commit.slice(0, 7),
      license: source.license,
      notice: source.notice,
      notes,
      notesList,
      saveOrder,
      projects,
      byProject,
      total: after.observations,
      c01: { count: empty.index.length },
      replay: { id: String(replay.id) },
      c03,
      c04,
      c05,
      hero,
      stepLabels: steps.map((step) => OPERATION_JA[step]),
      c06: { query: scenario6.query, rows: c06rows, hero: heroRow, other: otherRow, prefix },
      c07: { query: reopened.query, note: note7, count: reopened.observations.length, total: workerAudit.observations, minutes: Number(minutes[1]) },
      c08: { rejected: rejected.length },
      samples: run.samples.map((item) => ({ id: item.id, label: item.label })),
      shots,
    };
    model.tracks = buildTracks(model);
    model.drawOrder = notesList.map((note) => note.key).filter((key) => key !== hero.key).concat(hero.key);
    return model;
  }

  // --- Drawing kit ----------------------------------------------------------------------------

  const SANS = '"Noto Sans JP", "Yu Gothic", YuGothic, Meiryo, sans-serif';
  const MONO = 'Consolas, "Cascadia Mono", "Noto Sans Mono", monospace';
  const C = {
    ivory: "#f6f1e6",
    paper: "#fffcf5",
    navy: "#14213d",
    ink: "#1c2333",
    muted: "#586174",
    cobalt: "#2745c4",
    cobaltSoft: "#e4e8fb",
    yellow: "#f2c14e",
    yellowSoft: "#fbefcd",
    teal: "#157a74",
    tealSoft: "#dcefec",
    rust: "#9b3d2c",
    line: "#d8cfbc",
  };

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

  function pill(label, x, baseline, size, options = {}) {
    const weight = options.weight ?? 700;
    const family = options.family ?? SANS;
    const padX = Math.round(size * 0.6);
    const h = Math.round(size * 1.6);
    const w = textWidth(label, size, weight, family) + padX * 2;
    const left = options.align === "center" ? x - w / 2 : x;
    rr(left, baseline - size * 0.36 - h / 2, w, h, h / 2);
    ctx.fillStyle = options.bg ?? C.cobaltSoft;
    ctx.fill();
    say(label, left + padX, baseline, size, { weight, family, color: options.color ?? C.navy });
    return w;
  }

  function chip(label, x, cy, color, soft) {
    const w = textWidth(label, 14, 700, MONO) + 16;
    rr(x, cy - 13, w, 26, 6);
    ctx.fillStyle = soft;
    ctx.fill();
    say(label, x + 8, cy + 5, 14, { weight: 700, family: MONO, color });
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

  function arrow(x0, y0, x1, y1, p, color, width = 2.5) {
    const reveal = clamp01(p);
    if (reveal <= 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(lerp(x0, x1, reveal), lerp(y0, y1, reveal));
    ctx.stroke();
    const head = clamp01((reveal - 0.8) / 0.2);
    if (head > 0) {
      const angle = Math.atan2(y1 - y0, x1 - x0);
      ctx.globalAlpha *= head;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - 11 * Math.cos(angle - 0.45), y1 - 11 * Math.sin(angle - 0.45));
      ctx.lineTo(x1 - 11 * Math.cos(angle + 0.45), y1 - 11 * Math.sin(angle + 0.45));
      ctx.closePath();
      ctx.fill();
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
  }

  const NO_LINE_START = "、。，．・：；？！）」』】〕ー…";

  // Japanese-aware wrapping: ASCII words stay whole, closing punctuation never starts a line.
  function wrap(text, maxWidth, size, weight = 400) {
    ctx.font = font(size, weight);
    const tokens = text.match(/[A-Za-z0-9][A-Za-z0-9()._\-]*|\s+|[\s\S]/gu) || [];
    const lines = [];
    let line = "";
    let start = 0;
    let position = 0;
    for (const token of tokens) {
      const overflow = line && ctx.measureText(line + token).width > maxWidth && !NO_LINE_START.includes(token[0]);
      if (overflow) {
        const trimmed = line.replace(/\s+$/u, "");
        lines.push({ text: trimmed, start, end: start + trimmed.length });
        if (/^\s+$/u.test(token)) {
          line = "";
          start = position + token.length;
        } else {
          line = token;
          start = position;
        }
      } else {
        line += token;
      }
      position += token.length;
    }
    if (line) lines.push({ text: line, start, end: start + line.length });
    return lines;
  }

  function layoutText(m) {
    const width = 612;
    let size = 22;
    let lines = wrap(m.c05.body, width, size, 500);
    while (lines.length > 5 && size > 17) {
      size -= 1;
      lines = wrap(m.c05.body, width, size, 500);
    }
    const from = m.c05.body.indexOf(m.c05.excerpt);
    const to = from + m.c05.excerpt.length;
    const segments = [];
    lines.forEach((line, i) => {
      const a = Math.max(from, line.start);
      const b = Math.min(to, line.end);
      if (b <= a) return;
      segments.push({
        line: i,
        x0: textWidth(line.text.slice(0, a - line.start), size, 500),
        x1: textWidth(line.text.slice(0, b - line.start), size, 500),
      });
    });
    m.c05.layout = {
      subtitle: m.c05.subtitle,
      lines,
      size,
      lineHeight: Math.round(size * 1.6),
      segments,
      total: segments.reduce((sum, segment) => sum + segment.x1 - segment.x0, 0),
    };
    const parts = m.c05.excerpt.match(/[^、]+、?/gu) || [m.c05.excerpt];
    m.c05.excerptLines = parts.flatMap((part) => wrap(part, 620, 40, 800).map((line) => line.text));
  }

  // --- Timeline -------------------------------------------------------------------------------

  const SCENES = [
    { n: 1, start: 0, end: 4, hold: 3.0, tag: "C01・C02" },
    { n: 2, start: 4, end: 8, hold: 7.0, tag: "C03" },
    { n: 3, start: 8, end: 12, hold: 11.0, tag: "C04" },
    { n: 4, start: 12, end: 18, hold: 13.5, tag: "C05" },
    { n: 5, start: 18, end: 22, hold: 21.0, tag: "C06" },
    { n: 6, start: 22, end: 25.4, hold: 24.5, tag: "C07" },
    { n: 7, start: 25.4, end: 28, hold: 27.0, tag: "C01–C08" },
  ];

  function writeHeadlines(m) {
    const heads = [
      "前回の判断、どこだっけ。",
      "まず、題名だけ。",
      "前後を見て、選ぶ。",
      `選んだ${m.c05.count}件の本文へ。`,
      "同じ問いを、別の案件へ。",
      "次のプロセスでも、同じメモから。",
      "前回の判断を、必要な分だけ取り出す。",
    ];
    SCENES.forEach((scene, i) => { scene.head = heads[i]; });
    m.closingLine = `${m.samples.length}場面の実記録で確かめる。`;
  }

  const sceneAt = (t) => SCENES.reduce((found, scene) => (t >= scene.start ? scene : found), SCENES[0]);
  const enterAt = (i) => 0.5 + i * 0.22;
  const PROPS = ["x", "y", "w", "h", "a", "ts", "b"];

  // Each note card is a list of keyed states. A key eases from the accumulated state over d
  // seconds starting at its own time, so any time can be evaluated directly.
  function buildTracks(m) {
    const slots = {};
    m.projects.forEach((project, column) => {
      m.notesList.filter((note) => note.project === project).forEach((note, row) => {
        slots[note.key] = { x: 440 + column * 396, y: 232 + row * 86 };
      });
    });
    const tracks = {};
    m.saveOrder.forEach((key, order) => {
      const slot = slots[key];
      const keys = [
        { at: 0, d: 0, x: slot.x, y: slot.y + 26, w: 380, h: 72, a: 0, ts: 22, b: 0 },
        { at: enterAt(order), d: 0.4, y: slot.y, a: 1, ease: "out" },
      ];
      const i3 = m.c03.keys.indexOf(key);
      const i4 = m.c04.keys.indexOf(key);
      if (i3 >= 0) keys.push({ at: 4.0, d: 0.45, x: 440, y: 250 + i3 * 100, w: 560, h: 84, ts: 28 });
      else if (m.notes[key].project === m.c03.project) keys.push({ at: 4.0, d: 0.4, y: slot.y + 18, a: 0 });
      else keys.push({ at: 4.0, d: 0.4, x: slot.x + 60, a: 0 });
      if (i4 >= 0) keys.push({ at: 8.0, d: 0.45, x: 440, y: 250 + i4 * 100, w: 560, h: 84, ts: 28, a: 1 });
      else if (i3 >= 0) keys.push({ at: 8.0, d: 0.4, a: 0 });

      if (key === m.hero.key) {
        keys.push({ at: 12.0, d: 0.5, x: 64, y: 168, w: 664, h: 312, ts: 30, a: 1 });
        keys.push({ at: 12.35, d: 0.5, b: 1 });
        keys.push({ at: 18.0, d: 0.25, b: 0 });
        keys.push({ at: 18.05, d: 0.45, x: 64, y: 300, w: 548, h: 160, ts: 28 });
        keys.push({ at: 22.0, d: 0.45, x: 132, y: 286, w: 120, h: 44, ts: 14, a: 0 });
      } else {
        if (i4 >= 0) keys.push({ at: 12.0, d: 0.35, y: 250 + i4 * 100 + 40, a: 0 });
        if (key === m.c06.other.key) {
          keys.push({ at: 18.0, d: 0, x: 740, y: 300, w: 548, h: 160, ts: 28, b: 0, a: 0 });
          keys.push({ at: 18.1, d: 0.45, x: 668, a: 1 });
          keys.push({ at: 22.0, d: 0.4, x: 740, a: 0 });
        }
        if (key === m.c07.note.key) {
          keys.push({ at: 22.0, d: 0, x: 200, y: 288, w: 300, h: 70, ts: 22, b: 0, a: 0 });
          keys.push({ at: 22.45, d: 0.5, x: 470, y: 232, w: 746, h: 150, ts: 32, a: 1 });
          keys.push({ at: 25.05, d: 0.35, y: 214, a: 0 });
        }
      }
      tracks[key] = keys;
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

  const projectColor = (project) => (project === M.projects[0] ? C.cobalt : C.teal);
  const projectSoft = (project) => (project === M.projects[0] ? C.cobaltSoft : C.tealSoft);

  // --- Scenes ---------------------------------------------------------------------------------

  function drawFrame(t) {
    const label = `Claude-Mem ${M.version} の実行記録から`;
    const w = say(label, 64, 44, 15, { weight: 700, color: C.navy });
    say(sceneAt(t).tag, 64 + w + 14, 44, 15, { weight: 700, family: MONO, color: C.cobalt });
    ctx.fillStyle = C.line;
    ctx.fillRect(64, 61, 1152, 1);
    ctx.fillRect(64, 660, 1152, 1);
    say(`手で保存 / SQLite FTS5 / ${DURATION}秒・無音`, 64, 694, 17, { weight: 700, color: C.navy });
    say(`原典 ${M.repository} ${M.version} ・ ${M.shortCommit} ・ ${M.license}`, 1216, 694, 15, { weight: 500, color: C.muted, align: "right" });
  }

  function drawHeadline(t) {
    layer(easeOut(prog(t, 0.1, 0.4)), 0, () => disc(92, 112, 26, C.yellow));
    for (const scene of SCENES) {
      const last = scene.n === SCENES.length;
      const inAt = scene.start === 0 ? 0.15 : scene.start;
      const alpha = fadeWindow(t, inAt, 0.4, last ? null : scene.end - 0.3, 0.3);
      if (alpha <= 0.002) continue;
      const dy = (1 - easeOut(prog(t, inAt, 0.4))) * 18 - (last ? 0 : easeInOut(prog(t, scene.end - 0.3, 0.3))) * 12;
      const railed = scene.n >= 2 && scene.n <= 5;
      const size = fitSize(scene.head, railed ? 764 : 1080, last ? 56 : 60, 800, 40);
      layer(alpha, 0, () => {
        if (!last) say(String(scene.n), 92, 121, 26, { weight: 800, color: C.navy, align: "center" });
        say(scene.head, 136, 133 + dy, size, { weight: 800, color: C.navy });
      });
    }
  }

  function drawRail(t) {
    const alpha = fadeWindow(t, 4.0, 0.45, 21.65, 0.35);
    layer(alpha, 0, () => {
      const active = t < 8 ? 0 : t < 12 ? 1 : t < 18 ? 2 : 3; // 3: auto mode runs all steps
      const xs = [930, 1034, 1138];
      ctx.fillStyle = C.line;
      for (let i = 0; i < 2; i++) ctx.fillRect(xs[i] + 84, 111, xs[i + 1] - xs[i] - 90, 2);
      M.stepLabels.forEach((label, i) => {
        const current = active === 3 || i === active;
        const done = i < active;
        const cx = xs[i] + 15;
        disc(cx, 112, 15, current ? C.cobalt : done ? C.cobaltSoft : C.paper, current ? C.cobalt : C.line, 2);
        say(String(i + 1), cx, 118, 16, { weight: 800, color: current ? C.paper : done ? C.cobalt : C.muted, align: "center" });
        say(label, xs[i] + 38, 119, 20, { weight: 800, color: current ? C.navy : C.muted });
      });
      if (active === 3) say("自動モード", 1216, 84, 15, { weight: 800, color: C.cobalt, align: "right" });
    });
  }

  function drawOpening(t) {
    layer(fadeWindow(t, 0.2, 0.45, 3.65, 0.35), 0, () => {
      const landed = M.saveOrder.filter((key, i) => t >= enterAt(i) + 0.2).length;
      const w = say(String(landed), 64, 372, 150, { weight: 800, color: C.cobalt });
      say("件", 64 + w + 10, 372, 40, { weight: 800, color: C.navy });
      say("手で保存した架空のメモ", 64, 432, 28, { weight: 800, color: C.navy });
      const projectLine = M.projects.map((project) => `${project} ${M.byProject[project]}件`).join(" ・ ");
      say(projectLine, 64, 472, fitSize(projectLine, 350, 20, 600, 14), { weight: 600, color: C.muted });
      const lines = [
        `保存前の検索は${M.c01.count}件`,
        `同じメモの再送は同じ ID ${M.replay.id}`,
        `合計は${M.total}件のまま`,
      ];
      lines.forEach((line, i) => say(line, 64, 508 + i * 34, fitSize(line, 350, 20, 600, 14), { weight: 600, color: C.muted }));
      M.projects.forEach((project, column) => {
        const x = 440 + column * 396;
        const w2 = say(project, x, 212, 18, { weight: 800, color: projectColor(project) });
        say(`${M.byProject[project]}件`, x + w2 + 10, 212, 18, { weight: 700, color: C.muted });
      });
    });
  }

  function drawIndexStage(t) {
    layer(fadeWindow(t, 4.0, 0.45, 11.7, 0.3), 0, () => {
      const labelW = say("問い", 440, 214, 16, { weight: 700, color: C.muted });
      const pillW = pill(M.c03.query, 440 + labelW + 10, 214, 20, { bg: C.cobaltSoft, color: C.cobalt, weight: 800 });
      say(`・ ${M.c03.project}`, 440 + labelW + pillW + 20, 214, 17, { weight: 700, color: projectColor(M.c03.project) });

      const data = t < 8 ? { titles: M.c03.keys.length, bodies: M.c03.bodies } : { titles: M.c04.keys.length, bodies: M.c04.bodies };
      const w2 = say(String(data.titles), 64, 372, 150, { weight: 800, color: C.cobalt });
      say("題名", 64 + w2 + 12, 372, 40, { weight: 800, color: C.navy });
      const w0 = textWidth(String(data.bodies), 96, 800);
      const zeroEnd = 64 + w0 + 12 + textWidth("本文", 32, 800);
      pencil(58, zeroEnd + 6, 512, t >= 8 ? easeOut(prog(t, 8.5, 0.4)) : 0, 3.1, 10);
      say(String(data.bodies), 64, 500, 96, { weight: 800, color: C.muted });
      say("本文", 64 + w0 + 12, 500, 32, { weight: 800, color: C.muted });
      layer(fadeWindow(t, 4.3, 0.4, 7.7, 0.3), 0, () => say("索引は題名と ID だけ", 64, 556, 20, { weight: 700, color: C.navy }));
      layer(fadeWindow(t, 8.2, 0.4, 11.7, 0.3), 0, () => say("本文は、まだ開かない", 64, 556, 20, { weight: 700, color: C.navy }));
    });
  }

  function drawIndexOverlays(t) {
    const hero = sampleTrack(M.tracks[M.hero.key], t);
    layer(fadeWindow(t, 5.7, 0.35, 7.65, 0.35), 0, () => {
      const cy = hero.y + hero.h / 2;
      const edge = hero.x + hero.w;
      arrow(edge + 36, cy, edge + 8, cy, easeOut(prog(t, 5.7, 0.3)), C.navy);
      say("呼び出し側が選ぶ", edge + 44, cy + 7, 20, { weight: 800, color: C.navy });
      say(`${M.hero.key} を指定`, edge + 44, cy + 34, 16, { weight: 600, color: C.muted });
    });
    layer(fadeWindow(t, 8.4, 0.4, 11.7, 0.3), 0, () => {
      const rects = M.c04.keys.map((key) => sampleTrack(M.tracks[key], t));
      const y0 = Math.min(...rects.map((r) => r.y));
      const y1 = Math.max(...rects.map((r) => r.y + r.h));
      const bx = 1016;
      ctx.beginPath();
      ctx.moveTo(bx - 8, y0);
      ctx.lineTo(bx, y0);
      ctx.lineTo(bx, y1);
      ctx.lineTo(bx - 8, y1);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.cobalt;
      ctx.stroke();
      const mid = (y0 + y1) / 2;
      say(`選んだ ${M.c04.selected} と`, bx + 16, mid - 6, 18, { weight: 700, color: C.navy });
      say(`前後${M.c04.depth}件まで`, bx + 16, mid + 22, 18, { weight: 800, color: C.cobalt });
    });
  }

  function drawBodyStage(t) {
    layer(fadeWindow(t, 12.3, 0.45, 17.65, 0.35), 0, () => {
      const w1 = say(String(M.c05.count), 760, 330, 150, { weight: 800, color: C.cobalt });
      say("件", 760 + w1 + 8, 330, 40, { weight: 800, color: C.navy });
      say(`本文は${M.c05.count}件だけ`, 760, 388, 28, { weight: 800, color: C.navy });
      say(`ID ${M.c05.id} ・ ${M.c05.project}`, 760, 422, 16, { weight: 700, family: MONO, color: C.muted });
      say(M.stepLabels.join(" → "), 760, 454, 18, { weight: 700, color: C.muted });
    });
    layer(fadeWindow(t, 12.8, 0.4, 17.65, 0.35), 0, () => {
      pill("本文から抜粋", 64, 520, 18, { bg: C.yellowSoft, color: C.navy, weight: 800 });
      ctx.fillStyle = C.yellow;
      ctx.fillRect(64, 540, 6, 46 + 50 * (M.c05.excerptLines.length - 1));
      M.c05.excerptLines.forEach((line, i) => say(line, 88, 578 + i * 50, 40, { weight: 800, color: C.navy }));
    });
  }

  function drawPhone(t) {
    const enter = easeOut(prog(t, 12.5, 0.45));
    const alpha = Math.min(enter, 1 - easeInOut(prog(t, 17.65, 0.35)));
    layer(alpha, 0, () => {
      drawShot(M.shots.phone, lerp(1060, 1012, enter), 168, 204, 440);
      say(`閲覧ページの実画面（${M.shots.phone.sample}）`, 1216, 634, 14, { weight: 600, color: C.muted, align: "right" });
    });
  }

  function drawScopeStage(t) {
    layer(fadeWindow(t, 18.1, 0.4, 21.65, 0.35), 0, () => {
      const pillW = pill(M.c06.query, 640, 236, 32, { align: "center", bg: C.cobaltSoft, color: C.cobalt, weight: 800 });
      say("同じ問い", 640 - pillW / 2 - 14, 231, 18, { weight: 700, color: C.muted, align: "right" });
      const p = easeOut(prog(t, 18.3, 0.4));
      for (const target of [338, 942]) arrow(640, 256, target, 294, p, C.navy, 2);
      say("project は検索の範囲を分けるだけで、認証ではありません。", 640, 512, 24, { weight: 700, color: C.navy, align: "center" });
      say(`どちらも自動モードで ${M.stepLabels.join(" → ")}、本文は各${M.c06.hero.count}件`, 640, 548, 18, { weight: 600, color: C.muted, align: "center" });
    });
  }

  function drawReopenStage(t) {
    layer(fadeWindow(t, 22.0, 0.45, 25.05, 0.35), 0, () => {
      // The same SQLite file.
      const cx = 192;
      const top = 230;
      const rx = 110;
      const ry = 22;
      const h = 150;
      ctx.beginPath();
      ctx.moveTo(cx - rx, top + ry);
      ctx.lineTo(cx - rx, top + h - ry);
      ctx.ellipse(cx, top + h - ry, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(cx + rx, top + ry);
      ctx.ellipse(cx, top + ry, rx, ry, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fillStyle = C.paper;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.navy;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, top + ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.cobaltSoft;
      ctx.fill();
      ctx.stroke();
      say("SQLite", cx, top + 96, 24, { weight: 800, color: C.navy, align: "center" });
      say("同じ保存先", cx, top + 124, 16, { weight: 700, color: C.muted, align: "center" });
      arrow(cx + rx + 10, 300, 458, 300, easeOut(prog(t, 22.35, 0.4)), C.teal);

      layer(fadeWindow(t, 22.3, 0.4, null, 0), 0, () => {
        const w = say(String(M.c07.total), 64, 500, 120, { weight: 800, color: C.cobalt });
        say("件のまま", 64 + w + 10, 500, 32, { weight: 800, color: C.navy });
        const line = M.projects.map((project) => `${project} ${M.byProject[project]}件`).join(" ・ ");
        say(line, 64, 540, fitSize(line, 380, 18, 600, 13), { weight: 600, color: C.muted });
      });
      say("新しい Bun プロセスで開き直す", 470, 214, 20, { weight: 800, color: C.teal });

      layer(fadeWindow(t, 22.9, 0.4, null, 0), 0, () => {
        ctx.save();
        ctx.setLineDash([7, 6]);
        rr(470, 416, 746, 92, 12);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = C.muted;
        ctx.stroke();
        ctx.restore();
        const label = "前のプロセスの続きの合図";
        const tw = say(label, 496, 456, 22, { weight: 700, color: C.navy });
        const strike = easeOut(prog(t, 23.1, 0.35));
        if (strike > 0) {
          ctx.fillStyle = C.rust;
          ctx.fillRect(492, 447, (tw + 8) * strike, 2.5);
        }
        say("→ この新しいプロセスでは使えない", 496 + tw + 20, 456, 20, { weight: 800, color: C.rust });
        say("invalid_continuation", 496, 490, 16, { weight: 700, family: MONO, color: C.muted });
        say(`メモは SQLite に残る。続きの合図は発行したプロセスの中だけ（${M.c07.minutes}分）。`, 470, 548, 18, { weight: 600, color: C.muted });
      });
    });
  }

  function drawClosing(t) {
    const enter = easeOut(prog(t, 25.4, 0.45));
    layer(enter, (1 - enter) * 16, () => {
      const lineW = textWidth(M.closingLine, 40, 800);
      pencil(136, 136 + lineW, 216, easeOut(prog(t, 25.7, 0.3)), 5.2, 10);
      say(M.closingLine, 136, 208, 40, { weight: 800, color: C.navy });

      drawShot(M.shots.desktop, 64, 248, 373, 280);
      drawShot(M.shots.phone, 453, 248, 130, 280);
      say(`Studio Yebisu の閲覧ページの実画面（${M.shots.desktop.sample}・${M.shots.phone.sample}）`, 64, 552, 14, { weight: 600, color: C.muted });

      const labels = {
        C01: `${M.c01.count}件`,
        C02: `${M.total}件`,
        C03: "題名",
        C04: "文脈",
        C05: "本文",
        C06: "範囲",
        C07: "読み直し",
        C08: `拒否${M.c08.rejected}種`,
      };
      M.samples.forEach((sample, i) => {
        const cx = 644 + i * 74;
        disc(cx, 290, 24, C.yellowSoft, C.navy, 2);
        say(sample.id, cx, 295, 13, { weight: 700, family: MONO, color: C.navy, align: "center" });
        say(labels[sample.id] ?? "", cx, 340, 14, { weight: 700, color: C.muted, align: "center" });
      });
      say(SITE_URL, 620, 420, fitSize(SITE_URL, 596, 28, 800, 18), { weight: 800, color: C.cobalt });
      say(`作例ページで、${M.samples.length}場面の入力と戻り値を読めます。`, 620, 456, 18, { weight: 600, color: C.navy });
      say(`原典 ${M.repository} ${M.version}（${M.shortCommit}）`, 620, 512, 16, { weight: 700, color: C.navy });
      say(`${M.license} ・ ${M.notice}`, 620, 538, 15, { weight: 500, color: C.muted });
    });
  }

  // --- Note cards -----------------------------------------------------------------------------

  function cardExtras(note, s, t) {
    const hero = note.key === M.hero.key;
    const ex = { id: null, idSize: 16, idHl: 0, idSub: null, meta: null, metaA: 0, badge: null, titleHl: null, body: null, bodyHl: 0 };
    if (t >= 4 && t < 18) ex.id = `ID ${note.id}`;
    if (hero && t >= 4 && t < 18) {
      const pop = easeOut(prog(t, 5.6, 0.3)) * (1 - easeInOut(prog(t, 17.65, 0.35)));
      if (pop > 0) ex.badge = { n: t < 8 ? 1 : t < 12 ? 2 : 3, a: pop };
    }
    if (hero && t >= 4 && t < 12) ex.titleHl = { from: 0, to: note.title.length, p: easeOut(prog(t, 5.6, 0.4)), seed: 1.7 };
    if (hero && t >= 12 && t < 18.3) {
      ex.body = M.c05.layout;
      ex.bodyHl = easeOut(prog(t, 12.9, 0.4));
    }
    const scoped = t >= 18 && t < 22 ? M.c06.rows.find((row) => row.key === note.key) : null;
    if (scoped) {
      ex.meta = `本文 ${scoped.count}件 ・ ID ${note.id}`;
      ex.metaA = easeOut(prog(t, 18.4, 0.4));
      ex.titleHl = { from: M.c06.prefix, to: note.title.length, p: easeOut(prog(t, 18.7, 0.4)), seed: note.key === M.c06.hero.key ? 2.2 : 0.9 };
    }
    if (t >= 22 && note.key === M.c07.note.key) {
      ex.id = `ID ${note.id}`;
      ex.idSize = 30;
      ex.idHl = easeOut(prog(t, 22.95, 0.35));
      ex.idSub = "保存時と同じ";
      ex.meta = `「${M.c07.query}」で検索 → 本文 ${M.c07.count}件`;
      ex.metaA = easeOut(prog(t, 22.7, 0.4));
    }
    return ex;
  }

  function drawBody(body, x, y, highlight) {
    say(body.subtitle, x + 26, y + 112, 15, { weight: 700, family: MONO, color: C.muted });
    const top = y + 152;
    if (highlight > 0 && body.total > 0) {
      let remaining = highlight * body.total;
      for (const segment of body.segments) {
        if (remaining <= 0) break;
        const length = segment.x1 - segment.x0;
        pencil(x + 26 + segment.x0, x + 26 + segment.x1, top + segment.line * body.lineHeight + 7, Math.min(1, remaining / length), 2.6 + segment.line, 9);
        remaining -= length;
      }
    }
    body.lines.forEach((line, i) => say(line.text, x + 26, top + i * body.lineHeight, body.size, { weight: 500, color: C.ink }));
  }

  function drawCard(note, s, ex) {
    const { x, y, w, h } = s;
    const accent = projectColor(note.project);
    layer(s.a, 0, () => {
      ctx.save();
      ctx.shadowColor = "rgba(20, 33, 61, 0.13)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      rr(x, y, w, h, 14);
      ctx.fillStyle = C.paper;
      ctx.fill();
      ctx.restore();
      rr(x, y, w, h, 14);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.line;
      ctx.stroke();

      ctx.save();
      rr(x, y, w, h, 14);
      ctx.clip();
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, 6, h);
      layer(clamp01((h - 110) / 30), 0, () => say(note.project, x + 26, y + 36, 16, { weight: 800, color: accent }));
      const cy = h < 100 ? y + h / 2 : lerp(y + h / 2, y + 74, clamp01((h - 100) / 40));
      const chipW = chip(note.key, x + 24, cy, accent, projectSoft(note.project));
      const titleX = x + 24 + chipW + 14;
      let right = x + w - 24;
      if (ex.id) {
        const idW = textWidth(ex.id, ex.idSize, 700, MONO);
        const idBase = cy + ex.idSize * 0.34;
        if (ex.idHl > 0) pencil(right - idW - 2, right + 2, idBase + 7, ex.idHl, 4.4, 8);
        say(ex.id, right, idBase, ex.idSize, { weight: 700, family: MONO, color: ex.idSize > 20 ? C.navy : C.muted, align: "right" });
        if (ex.idSub) say(ex.idSub, right, idBase + 28, 15, { weight: 700, color: C.muted, align: "right" });
        right -= idW + 20;
      }
      const size = fitSize(note.title, right - titleX, s.ts, 800, 14);
      const base = cy + size * 0.36;
      if (ex.titleHl && ex.titleHl.p > 0) {
        const x0 = titleX + textWidth(note.title.slice(0, ex.titleHl.from), size, 800);
        const x1 = titleX + textWidth(note.title.slice(0, ex.titleHl.to), size, 800);
        pencil(x0, x1, base + 7, ex.titleHl.p, ex.titleHl.seed, Math.max(6, size * 0.28));
      }
      say(note.title, titleX, base, size, { weight: 800, color: C.ink });
      if (ex.body && s.b > 0.01) layer(s.b, 0, () => drawBody(ex.body, x, y, ex.bodyHl));
      if (ex.meta) layer(ex.metaA, 0, () => say(ex.meta, x + 26, y + h - 24, 16, { weight: 600, color: C.muted }));
      ctx.restore();

      if (ex.badge) {
        layer(ex.badge.a, 0, () => {
          disc(x + 2, y + 2, 19 * (0.6 + 0.4 * ex.badge.a), C.yellow, C.paper, 3);
          say(String(ex.badge.n), x + 2, y + 9, 20, { weight: 800, color: C.navy, align: "center" });
        });
      }
    });
  }

  function drawCards(t) {
    for (const key of M.drawOrder) {
      const state = sampleTrack(M.tracks[key], t);
      if (state.a <= 0.002) continue;
      drawCard(M.notes[key], state, cardExtras(M.notes[key], state, t));
    }
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
    drawRail(t);
    drawOpening(t);
    drawIndexStage(t);
    drawBodyStage(t);
    drawScopeStage(t);
    drawReopenStage(t);
    drawCards(t);
    drawIndexOverlays(t);
    drawPhone(t);
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
    ui.scrub.value = value;
    if (document.activeElement !== ui.time) ui.time.value = value;
    ui.timeLabel.textContent = `${value} / ${DURATION.toFixed(1)} 秒`;
  }

  function paint(t) {
    current = t;
    draw(t);
    if (!RENDER) syncControls();
  }

  function setPlaying(next) {
    playing = next;
    ui.editor.dataset.state = next ? "playing" : "paused";
    ui.play.disabled = !M || RENDER || next;
    ui.pause.disabled = !M || RENDER || !next;
  }

  function stopPreview() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    setPlaying(false);
  }

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
      button.dataset.time = String(scene.hold);
      const time = document.createElement("span");
      time.className = "scene-time";
      time.textContent = `${scene.start.toFixed(1)}〜${scene.end.toFixed(1)}秒`;
      const head = document.createElement("span");
      head.textContent = scene.n === SCENES.length ? `${scene.head} ${M.closingLine}` : scene.head;
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
    if (RENDER) return;
    buildSceneList();
    ui.scrub.disabled = false;
    ui.time.disabled = false;
    ui.reset.disabled = false;
    setPlaying(false);
    ui.status.dataset.state = "ready";
    ui.status.textContent = `素材${ASSET_KEYS.length}件の SHA-256 が一致しました。時刻は下の操作欄で確認できます。`;
  }

  function onFail(error) {
    M = null;
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    playing = false;
    ui.editor.dataset.state = "paused";
    for (const control of [ui.play, ui.pause, ui.reset, ui.scrub, ui.time]) control.disabled = true;
    ui.canvas.hidden = true;
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
    ui.play.addEventListener("click", startPreview);
    ui.pause.addEventListener("click", stopPreview);
    ui.reset.addEventListener("click", () => {
      stopPreview();
      window.seek(0);
    });
    ui.scrub.addEventListener("input", () => {
      stopPreview();
      window.seek(ui.scrub.value);
    });
    ui.time.addEventListener("input", () => {
      if (ui.time.value === "" || !Number.isFinite(Number(ui.time.value))) return;
      stopPreview();
      window.seek(ui.time.value);
    });
    ui.time.addEventListener("change", () => {
      stopPreview();
      window.seek(ui.time.value).then(() => { ui.time.value = current.toFixed(1); });
    });
  }
})();
