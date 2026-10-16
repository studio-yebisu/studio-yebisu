/*
 * Studio Yebisu — OpenHands Agent Canvas 作例・解説動画（28秒・無音・1280×720）
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * Every frame is drawn on one 2D canvas from absolute time only. File names, JSON lines, the
 * original error, the O03→O04 difference, the O06 schedule, the O07 repositories and all counts
 * are read from the eight frozen assets after assets/data-hashes.json and every listed file match
 * the SHA-256 and byte lengths fixed below, and after the run record agrees with the frozen input,
 * the pinned upstream, the vendor lock, the independent checks and the reproduction check.
 * There is no built-in fallback: on any mismatch window.motionReady rejects, the canvas is cleared
 * and hidden, controls are disabled, and #retry fetches everything again.
 * Page text is written with textContent only; record strings are painted as canvas text.
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

  const MANIFEST = {
    path: "assets/data-hashes.json",
    sha256: "03326022147ec1c0402c10c89a021c5e2f6a5c58f6a18cd6086f35c3fedac99a",
    format: "studio-yebisu-openhands-film-assets-v1",
  };
  // Same order as the manifest. Paths are relative to video/assets/.
  const ASSETS = [
    { path: "automation-runs.json", sha256: "bc347cc3246fa36a9e4e7d5849e48ecf8119e67e2d6afcd166211e67f453c7b0", bytes: 74735 },
    { path: "independent-checks.json", sha256: "0210a265e0eadf9aa8382fde0fe8b54e529d9c7cc518d9304e3624e1e24376d5", bytes: 18287 },
    { path: "reproduction-checks.json", sha256: "c14352c2848f466e5f152fadbd2886020053071c4d7787990619c7177673bb65", bytes: 1418 },
    { path: "automation-settings.json", sha256: "e982b4ca83fd92d9f012a44e98f35dc58b9dfc48a95eede6bb7daff57ce0be6b", bytes: 8430 },
    { path: "vendor-lock.json", sha256: "34149d29d4d4cb0181f41f0b8ac998a5c8baa0c3e13e0af341338eae1dddea02", bytes: 12441 },
    { path: "screens.json", sha256: "83651387a40da36b3333feb968fd38aaa860c9217b825c0825bce5cae91f04f5", bytes: 1431 },
    { path: "phone.jpg", sha256: "17f2ac189a3b088aa79086b6d888c56d85e01b2a2bf0dff69c6a57ce7d015a4c", bytes: 49727 },
    { path: "desktop.jpg", sha256: "7baf46f6ac483c9a47f9dbb597afd0d241197ac1dfbef7e7ce9c2fbd0da695d5", bytes: 95074 },
  ];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.path, a.sha256]));
  const PIN = {
    repository: "OpenHands/OpenHands",
    commit: "e4775b4ba61a83ba80af5f7b0b826201b8e8ea05",
    version: "1.27.1",
    license: "MIT",
    node: "v24.18.0",
    originalFiles: 12,
    packageFiles: 29,
    checks: 107,
    independent: 155,
    reproduction: 9,
    dependency: {
      name: "@openhands/extensions",
      version: "0.30.0",
      license: "MIT",
      integrity: "sha512-lPyH0iqSow+ARTX4cumR75e3BJmuqpj2YbKm1cqDcI1SQDXfDTr+/wSVH9dQsOmddEP4Zn+uMoLXpKSO/moonA==",
    },
  };
  const FORMAT = {
    runs: "studio-yebisu-openhands-automation-runs-v1",
    settings: "studio-yebisu-openhands-settings-v1",
    screens: "studio-yebisu-openhands-screens-v1",
  };
  const ENVELOPE = { fileVersion: 1, fileKind: "automation", filenameSuffix: ".automation.json" };
  const API = ["serializeAutomation", "getAutomationExportFilename", "parseAutomationFile", "AutomationFileValidationError", "hasAutomationInterface", "getImportExportSpec"];
  const ERROR_NAME = "AutomationFileValidationError";
  const IDS = ["O01", "O02", "O03", "O04", "O05", "O06", "O07", "O08"];
  const MODES = ["export-roundtrip", "import"];
  const ACCEPTED = ["O01", "O02", "O04", "O06", "O07", "O08"];
  const REJECTED = ["O03", "O05"];
  // Fixed before execution (input/expected.json); the film only checks that the record contains them.
  const O03_ERROR = "spec.trigger.schedule: required for a scheduled trigger";
  const REPAIR_PATH = "spec.trigger.schedule";
  const REPAIR_VALUE = "0 9 * * 6";
  const UNCHECKED_SCHEDULE = "not-a-cron";
  const O05_ISSUES = 6;
  const SCREENS = {
    phone: { image: "phone.jpg", case_id: "O03", width: 375, height: 812 },
    desktop: { image: "desktop.jpg", case_id: "O07", width: 1265, height: 889 },
  };
  const FILE_MESSAGE = "このページをファイルとして直接開くと、素材を読み込んで照合できません。作例のフォルダー（render.py のある場所）で python -m http.server を実行し、http://localhost:8000/video/ を開いてください。";

  // --- Scenes ---------------------------------------------------------------------------------

  // read: a settled moment inside the reading hold, used by the scene buttons.
  const SCENES = [
    { n: 1, in: 0, out: 4, read: 2.8, title: "自動化の設定を、持ち運ぶ前に点検する", draw: sceneTitle },
    { n: 2, in: 4, out: 8, read: 6.6, title: "時刻がないと？（O03 の入力）", draw: sceneMissing },
    { n: 3, in: 8, out: 12, read: 10.6, title: "足りない項目を、理由から見つける（O03 の原典の誤り）", draw: sceneReason },
    { n: 4, in: 12, out: 18, read: 15, title: "時刻を足して、もう一度点検（O04・別の呼び出し）", draw: sceneRepair },
    { n: 5, in: 18, out: 22, read: 20.6, title: "形が通っても、時刻は未検証（O06・O07）", draw: sceneUnchecked },
    { n: 6, in: 22, out: 28, read: 25.5, title: "設定を選ぶ → 理由 → 保存（8設定の結果）", draw: sceneRead, last: true },
  ];
  const RAIL = ["入力", "理由", "再点検", "注意", "保存"];

  // --- Page ------------------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const ui = {
    editor: $("editor"),
    status: $("editor-status"),
    errorBox: $("error-box"),
    errorText: $("error-text"),
    retry: $("retry"),
    stage: $("stage"),
    canvas: $("film"),
    play: $("play"),
    reset: $("reset"),
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
  // Layout is authored in a 1280×720 space and scaled to the requested size.
  const SCALE = Math.min(W / 1280, H / 720);
  const OFFSET_X = (W - 1280 * SCALE) / 2;
  const OFFSET_Y = (H - 720 * SCALE) / 2;

  // --- Loading and checks ---------------------------------------------------------------------

  class CheckError extends Error {}

  function check(condition, message) {
    if (!condition) throw new CheckError(message);
  }

  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const isString = (value) => typeof value === "string";
  const own = (object, key) => isObject(object) && Object.prototype.hasOwnProperty.call(object, key);
  const short = (commit) => String(commit).slice(0, 7);
  // The exact bytes run.mjs wrote to outputs/exports/: pretty JSON with a final newline.
  const fileText = (value) => `${JSON.stringify(value, null, 2)}\n`;

  function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
    if (isObject(a) && isObject(b)) {
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((key) => own(b, key) && deepEqual(a[key], b[key]));
    }
    return false;
  }

  // Dotted paths where two plain JSON values differ (arrays compared whole).
  function diffPaths(a, b, prefix = "") {
    if (isObject(a) && isObject(b)) {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
      return keys.flatMap((key) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (!own(a, key) || !own(b, key)) return [path];
        return diffPaths(a[key], b[key], path);
      });
    }
    return deepEqual(a, b) ? [] : [prefix];
  }

  async function fetchBytes(relative) {
    const url = new URL(relative, document.baseURI);
    check(url.origin === new URL(document.baseURI).origin, `${relative} が同じ場所のファイルではありません。`);
    let response;
    try {
      response = await fetch(url.href, { cache: "no-store", credentials: "same-origin" });
    } catch {
      throw new CheckError(`${relative} を読み込めませんでした。作例のフォルダーをローカルの HTTP サーバーで開いてください（例：python -m http.server）。`);
    }
    check(response.ok, `${relative} を読み込めませんでした（HTTP ${response.status}）。`);
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
      throw new CheckError(`${name} が UTF-8 の文字として読めません。`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new CheckError(`${name} が正しい JSON ではありません。`);
    }
  }

  const assetState = new Map();
  let manifestDigest = null;

  function showAssets() {
    const rows = ASSETS.map((asset) => {
      const item = assetState.get(asset.path) || { ok: null, actual: null, size: null };
      const li = document.createElement("li");
      const name = document.createElement("code");
      name.className = "asset-name";
      name.textContent = asset.path;
      const verdict = document.createElement("span");
      verdict.className = item.ok === true ? "verdict is-ok" : item.ok === false ? "verdict is-ng" : "verdict";
      verdict.textContent = item.ok === true ? "一致" : item.ok === false ? "不一致" : "照合前";
      const size = document.createElement("span");
      size.className = "bytes";
      size.textContent = item.ok === false && item.size !== asset.bytes
        ? `固定値 ${asset.bytes.toLocaleString("ja-JP")} バイト／読み込んだ値 ${Number(item.size).toLocaleString("ja-JP")} バイト`
        : `${asset.bytes.toLocaleString("ja-JP")} バイト`;
      const digest = document.createElement("code");
      digest.className = "digest";
      digest.textContent = `SHA-256 ${asset.sha256}`;
      li.append(name, " ", verdict, " ", size, document.createElement("br"), digest);
      if (item.ok === false && item.actual && item.actual !== asset.sha256) {
        const actual = document.createElement("code");
        actual.className = "digest is-ng";
        actual.textContent = `読み込んだ値 ${item.actual}`;
        li.append(document.createElement("br"), actual);
      }
      return li;
    });
    ui.assetList.replaceChildren(...rows);
    const ok = [...assetState.values()].filter((item) => item.ok === true).length;
    ui.assetSummary.textContent = manifestDigest
      ? `video/assets/data-hashes.json（SHA-256 ${manifestDigest}）は固定値と一致。素材${ASSETS.length}件のうち${ok}件の SHA-256 とバイト数が一致しました。`
      : `video/assets/data-hashes.json（固定値 SHA-256 ${MANIFEST.sha256}）の照合はまだ終わっていません。下は固定した素材${ASSETS.length}件の値です。`;
  }

  // Width and height from the first SOF segment, read from the original bytes.
  function jpegSize(bytes) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      if (marker === 0xff) { i += 1; continue; }
      if (marker === 0xd9 || marker === 0xda) return null;
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + length;
    }
    return null;
  }

  let objectUrls = [];

  async function decodeJpeg(bytes, name, expected) {
    const n = bytes.length;
    check(n > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[n - 2] === 0xff && bytes[n - 1] === 0xd9,
      `${name} が JPEG の開始・終了の印を持っていません。`);
    const header = jpegSize(bytes);
    check(header && header.width === expected.width && header.height === expected.height,
      `${name} の JPEG ヘッダーの大きさが screens.json（${expected.width}×${expected.height}）と一致しません。`);
    const blob = new Blob([bytes], { type: "image/jpeg" });
    let image;
    try {
      if (typeof createImageBitmap === "function") {
        image = await createImageBitmap(blob);
      } else {
        image = new Image();
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        image.src = url;
        await image.decode();
      }
    } catch {
      throw new CheckError(`${name} を画像として読み込めませんでした。`);
    }
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    check(width === expected.width && height === expected.height, `${name} を読み込んだ大きさが screens.json と一致しません。`);
    return image;
  }

  function fileLines(file) {
    const q = (value) => JSON.stringify(value);
    const trigger = Object.keys(file.spec.trigger);
    return [
      { s: "{", d: 0 },
      { s: `"version": ${q(file.version)},`, d: 1, key: "version" },
      { s: `"kind": ${q(file.kind)},`, d: 1, key: "kind" },
      { s: `"spec": {`, d: 1 },
      { s: `"name": ${q(file.spec.name)},`, d: 2, key: "spec.name" },
      { s: `"trigger": {`, d: 2 },
      ...trigger.map((key, i) => ({ s: `"${key}": ${q(file.spec.trigger[key])}${i < trigger.length - 1 ? "," : ""}`, d: 3, key: `spec.trigger.${key}` })),
      { s: "},", d: 2 },
      { s: `"enabled": ${q(file.spec.enabled)},`, d: 2, key: "spec.enabled" },
      { s: "…", d: 2 },
      { s: "}", d: 1 },
      { s: "}", d: 0 },
    ];
  }

  function verify(j) {
    const runs = j["automation-runs.json"];
    const indep = j["independent-checks.json"];
    const repro = j["reproduction-checks.json"];
    const settings = j["automation-settings.json"];
    const lock = j["vendor-lock.json"];
    const screens = j["screens.json"];
    [runs, indep, repro, settings, lock, screens].forEach((value, i) => check(isObject(value), `${ASSETS[i].path} の形が想定と違います。`));

    // Pinned upstream, lock, dependency, inputs and runtime.
    const up = runs.upstream;
    const dep = runs.dependency;
    const pinned = (o) => isObject(o) && o.repository === PIN.repository && o.commit === PIN.commit && o.version === PIN.version && o.license === PIN.license;
    check(runs.format === FORMAT.runs, "automation-runs.json の形式が想定と違います。");
    check(pinned(up), `実行記録の固定版（${PIN.repository} ${short(PIN.commit)}・${PIN.version}・${PIN.license}）が一致しません。`);
    check(pinned(lock), "vendor-lock.json の固定版が一致しません。");
    check(Array.isArray(up.files) && up.files.length === PIN.originalFiles
      && up.files.every((f) => isObject(f) && isString(f.path) && f.path.startsWith("vendor/openhands/") && /^[0-9a-f]{40}$/.test(f.git_blob_sha1 || "")),
      `実行記録の原典${PIN.originalFiles}ファイル（Git blob つき）が想定と違います。`);
    check(isObject(dep) && dep.name === PIN.dependency.name && dep.version === PIN.dependency.version && dep.license === PIN.dependency.license
      && dep.integrity === PIN.dependency.integrity && Array.isArray(dep.files) && dep.files.length === PIN.packageFiles
      && dep.files.every((f) => isObject(f) && isString(f.path) && f.path.startsWith("vendor/extensions/") && isString(f.npm_member) && f.npm_member.startsWith("package/")),
      `依存 ${PIN.dependency.name} ${PIN.dependency.version} の${PIN.packageFiles}ファイルの記録が想定と違います。`);
    check(Array.isArray(lock.files) && lock.files.length === PIN.originalFiles + PIN.packageFiles, "vendor-lock.json のファイル数が41件ではありません。");
    const lockByPath = new Map(lock.files.map((f) => [isObject(f) ? f.path : null, f]));
    check(lockByPath.size === lock.files.length && [...up.files, ...dep.files].every((f) => deepEqual(f, lockByPath.get(f.path))),
      "原典12ファイルと依存29ファイルのハッシュが、実行記録と vendor-lock.json で一致しません。");
    check(isObject(lock.dependency) && lock.dependency.name === dep.name && lock.dependency.version === dep.version
      && lock.dependency.integrity === dep.integrity && lock.dependency.archive_sha256 === dep.archive_sha256,
      "vendor-lock.json の依存の固定が実行記録と一致しません。");
    check(up.vendor_lock_sha256 === SHA["vendor-lock.json"] && isObject(runs.input_sha256)
      && runs.input_sha256["vendor-lock.json"] === SHA["vendor-lock.json"]
      && runs.input_sha256["input/automation-settings.json"] === SHA["automation-settings.json"],
      "実行記録が参照する入力・ロックの SHA-256 が素材と一致しません。");
    check(isObject(runs.runtime) && runs.runtime.node === PIN.node && runs.runtime.packages_installed === 0 && runs.runtime.network === false,
      `実行環境（Node ${PIN.node}・npm の導入なし・通信なし）が記録と一致しません。`);
    check(Array.isArray(runs.api_entrypoints) && deepEqual(runs.api_entrypoints.map((x) => x && x.name), API),
      "呼んだ原典の関数の一覧が想定と違います。");
    const env = isObject(runs.interface) ? runs.interface.envelope : null;
    check(runs.interface && runs.interface.admitted === true && isObject(env) && env.fileVersion === ENVELOPE.fileVersion
      && env.fileKind === ENVELOPE.fileKind && env.filenameSuffix === ENVELOPE.filenameSuffix,
      "ファイルの封筒（version 1・kind automation・.automation.json）が審査を通った記録になっていません。");
    check(settings.format === FORMAT.settings && settings.fictional === true, "automation-settings.json が架空の入力として記録されていません。");
    const urls = JSON.stringify(settings).match(/https?:\/\/[^"\s\\]+/g) || [];
    check(urls.length > 0 && urls.every((u) => new URL(u).hostname === "example.invalid"), "入力の参照先がすべて架空の example.invalid ではありません。");

    // Eight results against the frozen input and the expected outcome.
    const results = runs.results;
    check(Array.isArray(results) && results.length === 8 && results.every((r, i) => isObject(r) && r.id === IDS[i]), "実行記録が O01〜O08 の8件ではありません。");
    check(Array.isArray(settings.cases) && settings.cases.length === 8 && settings.cases.every((c, i) => isObject(c) && c.id === IDS[i]), "入力が O01〜O08 の8件ではありません。");
    const byId = {};
    results.forEach((r, i) => {
      const c = settings.cases[i];
      check(MODES.includes(r.mode) && r.mode === c.mode && deepEqual(r.input, c.input), `${r.id} の入力が、固定した入力と一致しません。`);
      const ok = ACCEPTED.includes(r.id);
      check(r.accepted === ok, `${r.id} の形の判定が想定と違います。`);
      if (ok) {
        const f = r.file;
        const rt = r.roundtrip;
        check(isObject(f) && deepEqual(Object.keys(f), ["version", "kind", "spec"]) && f.version === ENVELOPE.fileVersion && f.kind === ENVELOPE.fileKind
          && isObject(f.spec) && isObject(f.spec.trigger) && f.spec.enabled === false && r.error === null
          && isString(r.filename) && r.filename.endsWith(ENVELOPE.filenameSuffix) && !/[\\/]/.test(r.filename)
          && r.file_path === `outputs/exports/${r.id}.automation.json` && /^[0-9a-f]{64}$/.test(r.file_sha256 || "")
          && isObject(rt) && rt.reserialized_equals_file === true && rt.reparsed_equals_parsed === true
          && rt.reserialized_sha256 === r.file_sha256 && rt.error === null,
          `${r.id} が、形が通った無効（enabled: false）のファイルとして記録されていません。`);
      } else {
        const e = r.error;
        check(r.file === null && r.file_path === null && r.filename === null && r.parsed === null && r.roundtrip === null
          && isObject(e) && e.name === ERROR_NAME && Array.isArray(e.issues) && e.issues.length > 0 && e.issues.every(isString)
          && e.message === e.issues.join("\n"),
          `${r.id} が、原典の ${ERROR_NAME} で止まった記録になっていません。`);
      }
      byId[r.id] = r;
    });
    const acceptedIds = IDS.filter((id) => byId[id].accepted);
    const rejectedIds = IDS.filter((id) => !byId[id].accepted);
    check(deepEqual(acceptedIds, ACCEPTED) && deepEqual(rejectedIds, REJECTED) && isObject(runs.summary)
      && runs.summary.total === 8 && runs.summary.accepted === acceptedIds.length && runs.summary.rejected === rejectedIds.length,
      "形が通った6件・止まった2件の集計が記録と一致しません。");
    const oracle = runs.oracle_comparison;
    check(isObject(oracle) && isObject(oracle.accepted_ids) && deepEqual(oracle.accepted_ids.actual, acceptedIds) && deepEqual(oracle.accepted_ids.expected, acceptedIds)
      && isObject(oracle.rejected_ids) && deepEqual(oracle.rejected_ids.actual, rejectedIds) && deepEqual(oracle.rejected_ids.expected, rejectedIds),
      "実行前の期待との照合が一致していません。");
    const v = runs.verification;
    check(isObject(v) && v.status === "passed" && v.total === PIN.checks && Array.isArray(v.checks) && v.checks.length === PIN.checks
      && v.checks.every((x) => isObject(x) && x.passed === true), `実行時の${PIN.checks}件の確認がすべて通った記録になっていません。`);

    // O03: the original error, exactly one issue.
    const o03 = byId.O03;
    check(deepEqual(o03.error.issues, [O03_ERROR]) && o03.input.spec.trigger.type === "cron" && !own(o03.input.spec.trigger, "schedule"),
      "O03 が、schedule の無い cron の入力と原典の誤り1件として記録されていません。");

    // O03 → O04: a separate call whose input differs only by the added schedule.
    const o04 = byId.O04;
    check(deepEqual(diffPaths(o03.input, o04.input), [REPAIR_PATH]) && o04.input.spec.trigger.schedule === REPAIR_VALUE
      && o04.parsed.trigger.schedule === REPAIR_VALUE && o04.file.spec.trigger.schedule === REPAIR_VALUE
      && isObject(o04.observations.repair) && o04.observations.repair.partner === "O03"
      && deepEqual(o04.observations.repair.input_diff, [{ path: REPAIR_PATH, change: "added", after: REPAIR_VALUE }]),
      "O03 と O04 の入力の差が、spec.trigger.schedule を足した1か所だけではありません。");

    // O05: six issues together.
    check(byId.O05.error.issues.length === O05_ISSUES && byId.O05.observations.issue_count === O05_ISSUES, "O05 の原典の誤りが6件ではありません。");

    // O06: a non-cron schedule still passes; grammar is not checked.
    const o06 = byId.O06;
    check(o06.input.spec.trigger.schedule === UNCHECKED_SCHEDULE && o06.file.spec.trigger.schedule === UNCHECKED_SCHEDULE
      && isObject(o06.observations.schedule) && o06.observations.schedule.accepted_by_parser === true && o06.observations.schedule.cron_grammar_validated === false,
      "O06 が、cron の形でない schedule が通った記録になっていません。");

    // O07: only the first of two repositories is written; the deprecated pair is overridden.
    const o07 = byId.O07;
    const repos = o07.input.repositories;
    const ro = o07.observations.repositories;
    check(Array.isArray(repos) && repos.length === 2 && repos.every((x) => isObject(x) && isString(x.url) && isString(x.ref))
      && o07.file.spec.repository === repos[0].url && o07.file.spec.branch === repos[0].ref
      && !JSON.stringify(o07.file).includes(repos[1].url) && o07.input.repository !== repos[0].url
      && isObject(ro) && deepEqual(ro.dropped, [repos[1]]) && ro.deprecated_overridden === true && ro.fetched === false,
      "O07 が、先頭の参照先だけを書き出した記録になっていません。");

    // O08: literal text survives unchanged.
    const o08 = byId.O08;
    check(["<script>", "{{", "\n"].every((s) => o08.input.prompt.includes(s)) && o08.file.spec.prompt === o08.input.prompt && o08.parsed.prompt === o08.input.prompt,
      "O08 の文字がそのまま残った記録になっていません。");

    // Independent production-side checks.
    check(indep.status === "passed" && indep.total === PIN.independent && Array.isArray(indep.checks) && indep.checks.length === PIN.independent
      && indep.checks.every((x) => isObject(x) && x.passed === true) && indep.run_sha256 === SHA["automation-runs.json"] && indep.human_approval === false,
      `independent-checks.json の${PIN.independent}件が、この実行記録に対してすべて通った記録になっていません。`);

    // Fresh-process reproduction in a separate copy.
    const fresh = Array.isArray(repro.checks) ? repro.checks : [];
    check(repro.status === "passed" && repro.total === PIN.reproduction && fresh.length === PIN.reproduction && fresh.every((x) => isObject(x) && x.passed === true)
      && repro.run_sha256 === SHA["automation-runs.json"] && repro.human_approval === false
      && fresh.some((x) => x.name === "entire fresh Node record byte identical")
      && ACCEPTED.every((id) => fresh.some((x) => x.name === `${id}.automation.json fresh portable artifact byte identical`)),
      "reproduction-checks.json が、記録全体と6ファイルのバイト一致として記録されていません。");
    const reproducedFiles = fresh.filter((x) => / fresh portable artifact byte identical$/.test(x.name)).length;

    // Screenshot provenance.
    check(screens.format === FORMAT.screens && screens.no_image_editing === true && screens.actual_outputs_unchanged === true && screens.physical_ios_tested === false
      && Array.isArray(screens.screens) && screens.screens.length === 2, "screens.json の形が想定と違います。");
    for (const [id, expected] of Object.entries(SCREENS)) {
      const s = screens.screens.find((x) => isObject(x) && x.id === id);
      check(s && s.image === expected.image && s.case_id === expected.case_id && s.width === expected.width && s.height === expected.height
        && s.image_format === "JPEG" && s.file_sha256 === SHA[expected.image] && s.run_sha256 === SHA["automation-runs.json"] && /^[0-9a-f]{64}$/.test(s.rgb_sha256 || ""),
        `screens.json の ${expected.image} の記録が素材と一致しません。`);
    }

    const triggerRows = (trigger) => Object.keys(trigger).map((key) => ({ path: `spec.trigger.${key}`, key, value: JSON.stringify(trigger[key]) }));
    const tail = (url) => url.replace(/^https:\/\/example\.invalid\//, "");
    return {
      repository: up.repository,
      commit: up.commit,
      version: up.version,
      node: runs.runtime.node,
      checks: v.total,
      independent: indep.total,
      reproducedFiles,
      byId,
      o01: { filename: byId.O01.filename, lines: fileLines(byId.O01.file) },
      o03: {
        id: o03.id,
        rows: [
          { path: "version", value: JSON.stringify(o03.input.version) },
          { path: "kind", value: JSON.stringify(o03.input.kind) },
          { path: "spec.name", value: JSON.stringify(o03.input.spec.name) },
          ...triggerRows(o03.input.spec.trigger),
          { path: REPAIR_PATH, missing: true },
        ],
        errorName: o03.error.name,
        issues: o03.error.issues,
      },
      o04: {
        id: o04.id,
        filename: o04.filename,
        path: o04.file_path,
        sha: o04.file_sha256,
        file: o04.file,
        lines: fileLines(o04.file),
        diff: Object.keys(o04.input.spec.trigger).map((key) => ({
          key,
          before: own(o03.input.spec.trigger, key) ? `${key}: ${JSON.stringify(o03.input.spec.trigger[key])}` : null,
          after: `${key}: ${JSON.stringify(o04.input.spec.trigger[key])}`,
          added: `spec.trigger.${key}` === REPAIR_PATH,
        })),
      },
      o06: { id: o06.id, schedule: o06.file.spec.trigger.schedule },
      o07: {
        id: o07.id,
        count: repos.length,
        kept: `${tail(repos[0].url)}（${repos[0].ref}）`,
        dropped: `${tail(repos[1].url)}（${repos[1].ref}）`,
      },
      summary: { total: results.length, accepted: acceptedIds.length, rejected: rejectedIds.length, acceptedIds, rejectedIds },
    };
  }

  const SERIF = '"Yu Mincho", YuMincho, "Hiragino Mincho ProN", "Noto Serif JP", serif';
  const SANS = '"Yu Gothic UI", "Yu Gothic", YuGothic, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, system-ui, sans-serif';
  const MONO = 'Consolas, "Cascadia Mono", Menlo, ui-monospace, monospace';
  const font = (size, weight = 500, family = SANS) => `${weight} ${size}px ${family}`;

  async function loadFonts() {
    if (!document.fonts || typeof document.fonts.load !== "function") return;
    const sample = "自動化の設定を持ち運ぶ前に点検する時刻がないと足りない項目理由見つける足して未検証選ぶ保存 0123456789 → spec.trigger.schedule";
    const specs = [font(70, 700, SERIF), font(28, 500), font(28, 700), font(96, 800), font(18, 500, MONO), font(18, 700, MONO)];
    await Promise.all(specs.map((spec) => document.fonts.load(spec, sample).catch(() => [])));
    await document.fonts.ready;
  }

  async function load() {
    check(location.protocol !== "file:", FILE_MESSAGE);
    check(globalThis.crypto && crypto.subtle, "このブラウザーでは SHA-256 を計算できません。https か http://localhost で開いてください。");
    const manifestBytes = await fetchBytes(MANIFEST.path);
    const digest = await sha256Hex(manifestBytes);
    check(digest === MANIFEST.sha256, `data-hashes.json の SHA-256 が固定値と一致しません（読み込んだ値 ${digest}）。`);
    const manifest = parseJson(manifestBytes, "data-hashes.json");
    check(isObject(manifest) && manifest.format === MANIFEST.format && manifest.source_commit === PIN.commit && Array.isArray(manifest.files)
      && manifest.files.length === ASSETS.length && ASSETS.every((a, i) => isObject(manifest.files[i]) && manifest.files[i].path === a.path
        && manifest.files[i].sha256 === a.sha256 && manifest.files[i].bytes === a.bytes),
      "data-hashes.json の8件の対象・SHA-256・バイト数が、この映像ソースに固定した値と一致しません。");
    manifestDigest = digest;
    showAssets();

    const bytes = {};
    const outcomes = await Promise.allSettled(ASSETS.map(async (asset) => {
      const data = await fetchBytes(`assets/${asset.path}`);
      const actual = await sha256Hex(data);
      const ok = actual === asset.sha256 && data.byteLength === asset.bytes;
      assetState.set(asset.path, { ok, actual, size: data.byteLength });
      showAssets();
      check(ok, `${asset.path} の SHA-256 またはバイト数が data-hashes.json と一致しません（読み込んだ値 ${actual}・${data.byteLength} バイト）。`);
      bytes[asset.path] = data;
    }));
    const failed = outcomes.find((o) => o.status === "rejected");
    if (failed) throw failed.reason;

    const json = {};
    for (const asset of ASSETS) if (asset.path.endsWith(".json")) json[asset.path] = parseJson(bytes[asset.path], asset.path);
    let data;
    try {
      data = verify(json);
    } catch (error) {
      if (error instanceof CheckError) throw error;
      throw new CheckError(`素材の形が想定と違います（${error && error.message ? error.message : "不明"}）。`);
    }
    // The six portable files: rebuild the written bytes from the record and match file_sha256.
    const encoder = new TextEncoder();
    for (const id of ACCEPTED) {
      const r = data.byId[id];
      const fileBytes = encoder.encode(fileText(r.file));
      check(await sha256Hex(fileBytes) === r.file_sha256, `${id} の書き出しファイルの bytes が、記録の file_sha256 と一致しません。`);
      if (id === "O04") data.o04.bytes = fileBytes.byteLength;
    }
    data.images = {
      phone: await decodeJpeg(bytes["phone.jpg"], "phone.jpg", SCREENS.phone),
      desktop: await decodeJpeg(bytes["desktop.jpg"], "desktop.jpg", SCREENS.desktop),
    };
    await loadFonts();
    return data;
  }

  // --- Time helpers (all values derive from t) ------------------------------------------------

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const enter = (t, at, d = 0.45) => ease(ramp(t, at, at + d));

  function sceneAlpha(t, s) {
    if (t < s.in || (t >= s.out && !s.last)) return 0;
    const fadeIn = s.n === 1 ? 1 : ease(ramp(t, s.in, s.in + 0.35));
    const fadeOut = s.last ? 1 : 1 - ramp(t, s.out - 0.35, s.out);
    return Math.min(fadeIn, fadeOut);
  }

  // --- Drawing helpers ------------------------------------------------------------------------

  // The viewer's palette: pale lavender paper, deep plum and ink, lime for accepted, amber for caution.
  const C = {
    paper: "#f6f3fa",
    raised: "#fdfcff",
    sunk: "#ebe5f3",
    ink: "#211a29",
    soft: "#574d63",
    plum: "#3d1a44",
    plumMid: "#6a3473",
    plumSoft: "#efe4f1",
    lime: "#c3e85a",
    limeSoft: "#eef8d2",
    limeInk: "#3c5208",
    amber: "#a85f00",
    amberSoft: "#fcefd5",
    amberLine: "#e0a540",
    line: "#dbd2e5",
  };

  let film = null;

  function layer(alpha, dy, fn) {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (dy) ctx.translate(0, dy);
    fn();
    ctx.restore();
  }

  // Draws one line; shrinks to fit `max` down to `min`, then compresses as a last resort.
  function text(str, x, y, o = {}) {
    const family = o.family || SANS;
    const weight = o.weight || 500;
    let size = o.size || 24;
    ctx.font = font(size, weight, family);
    if (o.max) {
      const min = o.min || size;
      while (size > min && ctx.measureText(str).width > o.max) {
        size -= 1;
        ctx.font = font(size, weight, family);
      }
    }
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = "alphabetic";
    if (o.max) ctx.fillText(str, x, y, o.max);
    else ctx.fillText(str, x, y);
    return Math.min(ctx.measureText(str).width, o.max || Infinity);
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function box(x, y, w, h, o = {}) {
    rr(x, y, w, h, o.r === undefined ? 10 : o.r);
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    if (o.stroke) {
      ctx.lineWidth = o.lw || 2;
      ctx.strokeStyle = o.stroke;
      ctx.setLineDash(o.dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function pill(label, x, y, o) {
    const size = o.size || 16;
    ctx.font = font(size, 700);
    const w = ctx.measureText(label).width + 22;
    const h = size + 14;
    const left = o.align === "right" ? x - w : x;
    box(left, y - h / 2, w, h, { fill: o.bg, stroke: o.stroke, lw: 1.5, r: h / 2 });
    text(label, left + w / 2, y + size * 0.36, { size, weight: 700, color: o.color, align: "center" });
    return w;
  }

  function strike(x, y, w, progress, color) {
    if (progress <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * progress, 2.5);
  }

  // A portable .automation.json drawn as a paper file with a folded corner; lines are actual JSON.
  function fileCard(model, x, y, w, lt, o = {}) {
    const n = model.lines.length;
    const h = 104 + (n - 1) * 28;
    const f = 26;
    ctx.save();
    ctx.shadowColor = "rgba(33, 26, 41, 0.14)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + w - f, y);
    ctx.lineTo(x + w, y + f);
    ctx.lineTo(x + w, y + h - 10);
    ctx.arcTo(x + w, y + h, x + w - 10, y + h, 10);
    ctx.lineTo(x + 10, y + h);
    ctx.arcTo(x, y + h, x, y + h - 10, 10);
    ctx.lineTo(x, y + 10);
    ctx.arcTo(x, y, x + 10, y, 10);
    ctx.closePath();
    ctx.fillStyle = C.raised;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.line;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - f, y);
    ctx.lineTo(x + w - f, y + f);
    ctx.lineTo(x + w, y + f);
    ctx.closePath();
    ctx.fillStyle = C.plumSoft;
    ctx.fill();
    ctx.stroke();
    text(model.filename, x + 20, y + 34, { size: 17, weight: 700, family: MONO, color: C.plum, max: w - 48 - f, min: 12 });
    ctx.fillStyle = C.line;
    ctx.fillRect(x + 1, y + 50, w - 2, 1);
    model.lines.forEach((line, i) => {
      const yy = y + 82 + i * 28;
      const mark = o.marks && line.key ? o.marks[line.key] : null;
      layer(enter(lt, (o.at || 0) + i * 0.05, 0.35), 0, () => {
        if (mark) layer(mark.alpha === undefined ? 1 : mark.alpha, 0, () => box(x + 12, yy - 20, w - 24, 27, { fill: mark.fill, r: 4 }));
        text(line.s, x + 20 + line.d * 18, yy, { size: 17, family: MONO, weight: mark && mark.weight ? mark.weight : 500, color: mark && mark.color ? mark.color : C.ink, max: w - 40 - line.d * 18, min: 12 });
      });
    });
    return { x, y, w, h };
  }

  // Draws a verified screenshot whole (contain), scaled only, with a thin paper frame.
  function shot(image, x, y, w, h) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const s = Math.min(w / iw, h / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(33, 26, 41, 0.18)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = C.raised;
    ctx.fillRect(dx - 6, dy - 6, dw + 12, dh + 12);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.line;
    ctx.strokeRect(dx - 6, dy - 6, dw + 12, dh + 12);
    return { x: dx, y: dy, w: dw, h: dh };
  }

  // A save chip: tray and down arrow, the native file download in the viewer.
  function saveChip(label, x, y, o = {}) {
    const size = o.size || 20;
    ctx.font = font(size, 700);
    const w = Math.min(o.max || 1120, ctx.measureText(label).width + 76);
    const h = size + 26;
    box(x, y, w, h, { fill: C.limeSoft, stroke: C.lime, lw: 2, r: h / 2 });
    const cx = x + 30;
    const cy = y + h / 2;
    ctx.strokeStyle = C.limeInk;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx, cy + 3);
    ctx.moveTo(cx - 6, cy - 3);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx + 6, cy - 3);
    ctx.moveTo(cx - 10, cy + 5);
    ctx.lineTo(cx - 10, cy + 10);
    ctx.lineTo(cx + 10, cy + 10);
    ctx.lineTo(cx + 10, cy + 5);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    text(label, x + 52, y + h / 2 + size * 0.36, { size, weight: 700, color: C.limeInk, max: w - 70, min: 14 });
    return w;
  }

  function headline(lines, x, y, lt, o) {
    lines.forEach((line, i) => {
      const e = enter(lt, (o.at || 0) + i * 0.14, 0.55);
      layer(e, (1 - e) * 16, () => text(line, x, y + i * (o.lh || 0), { size: o.size, weight: 700, family: SERIF, color: C.plum, max: o.max || 1120, min: 56 }));
    });
  }

  function drawChrome(t) {
    ctx.fillStyle = C.plum;
    ctx.fillRect(0, 0, 1280, 5);
    text(`OpenHands Agent Canvas ${film.version} ・ 自動化ファイルの入出力`, 80, 50, { size: 18, weight: 700, color: C.plum });
    ctx.fillStyle = C.line;
    ctx.fillRect(80, 68, 1120, 1);
    const sceneIndex = t >= DURATION ? SCENES.length - 1 : SCENES.findIndex((s) => t >= s.in && t < s.out);
    const active = sceneIndex - 1; // scene 1 is the title; scenes 2–6 map to the five steps
    ctx.font = font(18, 700);
    const gap = 26;
    const widths = RAIL.map((label) => ctx.measureText(label).width);
    let x = 1200 - widths.reduce((sum, w) => sum + w, 0) - gap * (RAIL.length - 1);
    RAIL.forEach((label, i) => {
      const on = i === active;
      text(label, x, 50, { size: 18, weight: 700, color: on ? C.ink : C.soft });
      if (on) {
        ctx.fillStyle = C.plumMid;
        ctx.fillRect(x, 58, widths[i], 3);
      }
      x += widths[i] + gap;
    });
    text("架空の設定 ・ 原典APIの保存記録と閲覧ページの実画面 ・ 無音", 80, 702, { size: 15, color: C.soft });
    text(`${film.repository} ${short(film.commit)}`, 1200, 702, { size: 14, family: MONO, color: C.soft, align: "right" });
  }

  // --- Scenes ----------------------------------------------------------------------------------

  function sceneTitle(lt) {
    headline(["自動化の設定を、", "持ち運ぶ前に点検する"], 80, 280, lt, { size: 70, lh: 92, at: 0.05, max: 700 });
    const u = inOut(ramp(lt, 0.9, 1.5));
    if (u > 0) {
      ctx.font = font(70, 700, SERIF);
      const w = Math.min(700, ctx.measureText("持ち運ぶ前に点検する").width);
      ctx.fillStyle = C.lime;
      ctx.fillRect(80, 394, w * u, 8);
    }
    layer(enter(lt, 0.7), 0, () => text("架空の設定・原典APIの実結果", 80, 468, { size: 30, weight: 700, color: C.plumMid }));
    layer(enter(lt, 0.9), 0, () => text(`固定版 ${film.repository} ${film.version}（${short(film.commit)}）の書き出し・読み込み`, 80, 510, { size: 18, color: C.soft, max: 700, min: 14 }));

    // The actual O01 portable file written by serializeAutomation.
    const e = enter(lt, 0.25, 0.6);
    let card = null;
    layer(e, 0, () => {
      ctx.translate((1 - e) * 40, 0);
      card = fileCard(film.o01, 830, 104, 370, lt, { at: 0.35, marks: { version: { fill: C.limeSoft }, kind: { fill: C.limeSoft } } });
    });
    if (!card) return;
    const sweep = inOut(ramp(lt, 1.5, 2.6));
    layer(sweep > 0 ? 1 - ramp(lt, 2.6, 2.9) : 0, 0, () => {
      const y = card.y + 56 + sweep * (card.h - 66);
      ctx.fillStyle = C.limeInk;
      ctx.fillRect(card.x - 14, y, card.w + 28, 3);
      ctx.beginPath();
      ctx.moveTo(card.x - 14, y - 7);
      ctx.lineTo(card.x - 2, y + 1.5);
      ctx.lineTo(card.x - 14, y + 10);
      ctx.closePath();
      ctx.fill();
    });
    layer(enter(lt, 2.6, 0.35), 0, () => pill("読み戻し：形が通った", card.x + card.w - 14, card.y + card.h - 22, { color: C.ink, bg: C.lime, align: "right", size: 15 }));
    layer(enter(lt, 1.0), 0, () => {
      text("O01 を書き出した実ファイル（抜粋）", card.x, card.y + card.h + 30, { size: 15, color: C.soft, max: card.w });
      text("serializeAutomation の出力", card.x, card.y + card.h + 52, { size: 14, family: MONO, color: C.soft, max: card.w });
    });
  }

  function sceneMissing(lt) {
    const d = film.o03;
    headline(["時刻がないと？"], 80, 190, lt, { size: 72, max: 580 });
    layer(enter(lt, 0.35), 0, () => text("cron の設定なのに、schedule がない", 80, 252, { size: 28, color: C.soft, max: 580, min: 22 }));
    layer(enter(lt, 0.7), 0, () => text("type が cron ＝ 時刻で動く設定", 80, 360, { size: 28, weight: 700, max: 580, min: 22 }));
    layer(enter(lt, 0.85), 0, () => text("schedule ＝ いつ動くかの値", 80, 410, { size: 28, weight: 700, max: 580, min: 22 }));
    layer(enter(lt, 1.3), 0, () => text(`${d.id} には schedule が入っていない`, 80, 472, { size: 28, weight: 700, color: C.amber, max: 580, min: 22 }));
    layer(enter(lt, 0.6), 0, () => text(`説明図：${d.id} の実際の入力ファイル（Agent Canvas の画面ではありません）`, 80, 652, { size: 16, color: C.soft, max: 1120 }));

    // Explanatory map of the actual O03 import input, ending with the missing field.
    const X = 700;
    const BW = 500;
    layer(enter(lt, 0.15), 0, () => text(`${d.id} の入力（import：ファイルをそのまま読む）`, X, 130, { size: 17, weight: 700, color: C.soft, max: BW }));
    d.rows.forEach((row, i) => {
      const y = 148 + i * 70;
      const at = row.missing ? 1.0 : 0.25 + i * 0.08;
      layer(enter(lt, at, 0.4), 0, () => {
        ctx.translate((1 - enter(lt, at, 0.4)) * 24, 0);
        if (row.missing) {
          box(X, y, BW, 60, { fill: C.amberSoft, stroke: C.amber, lw: 2, dash: [8, 6], r: 8 });
          text(row.path, X + 18, y + 23, { size: 16, family: MONO, weight: 700, color: C.amber, max: BW - 120 });
          text("（ない）", X + 18, y + 50, { size: 22, weight: 700, color: C.amber });
          pill("いつ動く？", X + BW - 14, y + 30, { color: C.amber, bg: C.raised, stroke: C.amber, align: "right", size: 15 });
        } else {
          const focus = row.path === "spec.trigger.type";
          box(X, y, BW, 60, { fill: focus ? C.plumSoft : C.raised, stroke: C.line, lw: 1.5, r: 8 });
          text(row.path, X + 18, y + 23, { size: 16, family: MONO, color: C.soft, max: BW - 36 });
          text(row.value, X + 18, y + 50, { size: 22, family: MONO, weight: focus ? 700 : 500, color: C.ink, max: BW - 36, min: 14 });
        }
      });
    });
  }

  function sceneReason(lt) {
    const d = film.o03;
    headline(["足りない項目を、", "理由から見つける"], 80, 170, lt, { size: 64, lh: 78, max: 760 });
    layer(enter(lt, 0.45), 0, () => pill(`${d.id}　止まった`, 80, 300, { color: "#fff", bg: C.plum, size: 18 }));
    layer(enter(lt, 0.7), 0, () => {
      box(80, 336, 760, 206, { fill: C.raised, stroke: C.line, lw: 1.5, r: 10 });
      ctx.fillStyle = C.plumMid;
      ctx.fillRect(80, 336, 6, 206);
      text(`原典の判定 ・ ${d.errorName}（${d.issues.length}件）`, 108, 372, { size: 18, weight: 700, color: C.plum, max: 712, min: 14 });
      d.issues.forEach((issue, i) => text(issue, 108, 420 + i * 30, { size: 22, family: MONO, weight: 700, color: C.plum, max: 712, min: 15 }));
      text("時刻で動く設定なのに、いつ動くかを書く schedule がない", 108, 468, { size: 22, color: C.ink, max: 712, min: 16 });
      text("このため、ファイル・名前・読み戻しは作られなかった", 108, 510, { size: 18, color: C.soft, max: 712 });
    });
    layer(enter(lt, 0.9), 0, () => text("原典の parseAutomationFile が返した issues の文を、そのまま表示", 80, 580, { size: 16, color: C.soft, max: 760 }));
    const e = enter(lt, 0.35, 0.6);
    layer(e, (1 - e) * 20, () => {
      shot(film.images.phone, 900, 92, 300, 548);
      text(`閲覧ページの実画面（${d.id}・スマホ）`, 1050, 666, { size: 16, color: C.soft, align: "center" });
    });
  }

  function sceneRepair(lt) {
    const d = film.o04;
    headline(["時刻を足して、", "もう一度点検"], 80, 170, lt, { size: 64, lh: 78, max: 680 });
    layer(enter(lt, 0.3), 0, () => {
      text("spec.trigger（入力の比較）", 80, 296, { size: 16, weight: 700, color: C.soft });
      text(`${film.o03.id}（止まった）`, 80, 326, { size: 20, weight: 700, color: C.plum });
      text(`${d.id}（別に呼んだ）`, 420, 326, { size: 20, weight: 700, color: C.limeInk });
    });
    const mark = inOut(ramp(lt, 0.9, 1.3));
    d.diff.forEach((row, i) => {
      const y = 340 + i * 42;
      layer(enter(lt, 0.4 + i * 0.08, 0.4), 0, () => {
        if (row.before) {
          text(row.before, 80, y + 26, { size: 19, family: MONO, max: 290, min: 13 });
        } else {
          box(80, y + 3, 290, 32, { stroke: C.plumMid, dash: [6, 5], lw: 1.5, r: 6 });
          text("（なし）", 92, y + 26, { size: 18, color: C.plumMid });
        }
        text(row.added ? "＋" : "＝", 395, y + 26, { size: 20, weight: 700, color: row.added ? C.limeInk : C.soft, align: "center" });
        if (row.added) layer(mark, 0, () => box(412, y + 2, 296, 34, { fill: C.limeSoft, stroke: C.lime, lw: 1.5, r: 6 }));
        text(row.after, 420, y + 26, { size: 19, family: MONO, weight: row.added ? 700 : 500, color: row.added ? C.limeInk : C.ink, max: 212, min: 13 });
        if (row.added) layer(mark, 0, () => pill("足した", 704, y + 19, { color: C.ink, bg: C.lime, align: "right", size: 14 }));
      });
    });
    layer(enter(lt, 1.0, 0.4), 0, () => {
      pill(`${d.id}　形が通った`, 80, 500, { color: C.ink, bg: C.lime, size: 22 });
      text(`version: ${d.file.version} ・ kind: ${JSON.stringify(d.file.kind)} ・ enabled: ${d.file.spec.enabled}`, 80, 550, { size: 19, family: MONO, max: 680, min: 14 });
      text(`書き出した実ファイル ${d.path}`, 80, 580, { size: 17, color: C.soft, max: 680, min: 13 });
      text(`${d.bytes.toLocaleString("ja-JP")} バイト ・ SHA-256 ${d.sha.slice(0, 16)}…`, 80, 606, { size: 15, family: MONO, color: C.soft, max: 680 });
    });
    layer(enter(lt, 1.0, 0.4), 0, () => text(`${film.o03.id} とは別の parseAutomationFile の呼び出し。AI の自動修復でも、予定の登録でもありません`, 80, 652, { size: 17, color: C.soft, max: 1120, min: 14 }));

    const e = enter(lt, 0.5, 0.5);
    let card = null;
    layer(e, (1 - e) * 18, () => {
      card = fileCard(d, 800, 96, 400, lt, { at: 0.45, marks: { "spec.trigger.schedule": { fill: C.limeSoft, color: C.limeInk, weight: 700, alpha: mark } } });
    });
    if (!card) return;
    layer(enter(lt, 1.05, 0.35), 0, () => {
      pill("形が通った", card.x + card.w - 14, card.y + card.h - 22, { color: C.ink, bg: C.lime, align: "right", size: 18 });
      saveChip(`保存：${d.filename}`, card.x, card.y + card.h + 22, { size: 18, max: card.w });
    });
  }

  function sceneUnchecked(lt) {
    const d = film.o06;
    const r = film.o07;
    headline(["形が通っても、", "時刻は未検証"], 80, 170, lt, { size: 64, lh: 78, max: 640 });
    layer(enter(lt, 0.45), 0, () => text(`${d.id}：schedule が "${d.schedule}" でも通った`, 80, 330, { size: 26, weight: 700, max: 620, min: 20 }));
    layer(enter(lt, 0.65), 0, () => {
      text("原典の読み込みが見るのは、", 80, 384, { size: 24, max: 620 });
      text("schedule が空でない文字列かだけ", 80, 422, { size: 24, max: 620 });
    });
    layer(enter(lt, 0.85), 0, () => text("cron の書き方も、いつ動くかも未確認", 80, 476, { size: 26, weight: 700, color: C.amber, max: 620, min: 20 }));
    layer(enter(lt, 1.0), 0, () => text("止めたのでも、直したのでもありません", 80, 520, { size: 20, color: C.soft, max: 620 }));

    // O06: the actual accepted file value.
    layer(enter(lt, 0.4, 0.5), 0, () => {
      box(760, 104, 440, 196, { fill: C.raised, stroke: C.line, lw: 1.5, r: 12 });
      text(`${d.id} の書き出しファイル`, 784, 138, { size: 16, weight: 700, color: C.soft });
      text(`"schedule": ${JSON.stringify(d.schedule)}`, 784, 198, { size: 28, family: MONO, weight: 700, color: C.amber, max: 392, min: 18 });
      const w = pill("形は通った", 784, 252, { color: C.ink, bg: C.lime, size: 16 });
      pill("cron の書き方は未検証", 784 + w + 10, 252, { color: C.amber, bg: C.amberSoft, stroke: C.amberLine, size: 16 });
    });

    // O07: supplementary caveat, the second repository is dropped.
    layer(enter(lt, 0.9, 0.45), 0, () => {
      box(760, 336, 440, 236, { fill: C.amberSoft, stroke: C.amberLine, lw: 1.5, r: 12 });
      ctx.fillStyle = C.amber;
      ctx.fillRect(760, 336, 6, 236);
      text(`${r.id} ・ 参照先${r.count}件の設定を書き出すと`, 786, 370, { size: 18, weight: 700, color: C.amber, max: 390 });
      text(r.kept, 786, 416, { size: 17, family: MONO, weight: 700, color: C.limeInk, max: 300, min: 12 });
      pill("入る", 1186, 410, { color: C.ink, bg: C.lime, align: "right", size: 14 });
      const w = text(r.dropped, 786, 458, { size: 17, family: MONO, color: C.amber, max: 300, min: 12 });
      strike(786, 452, w, inOut(ramp(lt, 1.25, 1.6)), C.amber);
      pill("落ちる", 1186, 452, { color: C.amber, bg: C.raised, stroke: C.amberLine, align: "right", size: 14 });
      text("ファイルに入るのは先頭の1件だけ", 786, 508, { size: 19, weight: 700, color: C.ink, max: 390 });
      text("古い repository・branch も先頭の値で上書き", 786, 540, { size: 15, color: C.soft, max: 390 });
    });
    layer(enter(lt, 1.1), 0, () => text("参照先は架空の example.invalid で、取得していません", 760, 604, { size: 15, color: C.soft, max: 440 }));
  }

  function sceneRead(lt) {
    const s = film.summary;
    layer(enter(lt, 0.05, 0.55), (1 - enter(lt, 0.05, 0.55)) * 16, () => {
      let x = 80;
      ["設定を選ぶ", "→", "理由", "→", "保存"].forEach((word, i) => {
        const arrow = word === "→";
        x += text(word, x, 172, { size: 60, weight: arrow ? 700 : 800, family: arrow ? SANS : SERIF, color: arrow ? C.plumMid : C.plum }) + (i < 4 ? 26 : 0);
      });
    });
    const count = (y, n, label, ids, color, note, at) => layer(enter(lt, at), 0, () => {
      const w = text(String(n), 80, y, { size: 96, weight: 800, color });
      text(label, 80 + w + 16, y - 8, { size: 52, weight: 700, max: 600 - w, min: 46 });
      text(`${ids.join("・")} ・ ${note}`, 80 + w + 18, y + 28, { size: 18, color: C.soft, max: 600 - w, min: 13 });
    });
    count(318, s.accepted, "件　形が通った", s.acceptedIds, C.limeInk, "ファイルの形", 0.35);
    count(436, s.rejected, "件　止まった", s.rejectedIds, C.plum, "原典の誤り", 0.5);
    layer(enter(lt, 0.65), 0, () => text(`全${s.total}設定。${s.accepted}件は形の検査を通った数で、動く自動化の数ではありません`, 80, 516, { size: 20, color: C.soft, max: 700, min: 15 }));
    layer(enter(lt, 0.85), 0, () => saveChip(`${film.o04.filename} を保存（閲覧ページ）`, 80, 546, { size: 20, max: 700 }));
    layer(enter(lt, 1.0), 0, () => {
      text(`原典APIの実行時の確認 ${film.checks}件すべて通過 ・ 独立した確認 ${film.independent}件 ・ 別の Node プロセスで記録と${film.reproducedFiles}ファイルがバイト一致`, 80, 640, { size: 16, color: C.soft, max: 1120, min: 12 });
      text(`映像：Claude Opus 5.5 が編集ソースを作成 ／ 記録の値：原典の関数（Node ${film.node}）・エージェントやモデルの実行なし`, 80, 666, { size: 15, color: C.soft, max: 1120, min: 12 });
    });
    const e = enter(lt, 0.45, 0.6);
    layer(e, (1 - e) * 18, () => {
      const r = shot(film.images.desktop, 820, 236, 380, 270);
      text(`閲覧ページの実画面（${film.o07.id}・パソコン）`, r.x + r.w / 2, r.y + r.h + 32, { size: 16, color: C.soft, align: "center", max: 380 });
      text("ファイルに入る参照先は先頭の1件だけ", r.x + r.w / 2, r.y + r.h + 56, { size: 15, color: C.amber, align: "center", max: 380 });
    });
  }

  function drawFrame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(SCALE, 0, 0, SCALE, OFFSET_X, OFFSET_Y);
    drawChrome(t);
    for (const s of SCENES) {
      const alpha = sceneAlpha(t, s);
      if (alpha > 0.001) layer(alpha, 0, () => s.draw(t - s.in));
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- Seek, preview and editor state -------------------------------------------------------

  let current = 0;  // time on the canvas
  let selected = 0; // last time chosen by the range, a scene button or window.seek; #reset returns here
  let playing = false;
  let loading = false;
  let raf = 0;
  let startNow = 0;
  let startTime = 0;

  const clampTime = (seconds) => {
    const value = Number(seconds);
    return Number.isFinite(value) ? Math.min(DURATION, Math.max(0, value)) : 0;
  };

  function showTime() {
    const state = loading ? "読み込み中" : !film ? "停止（照合失敗）" : playing ? "再生中" : "停止中";
    ui.timeLabel.textContent = `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒 ・ ${state}`;
    ui.reset.textContent = `${selected.toFixed(1)}秒に戻す`;
  }

  function paint(t) {
    if (!film) throw new Error("素材の照合が済んでいないため描けません。");
    current = t;
    drawFrame(t);
    ui.time.value = String(t);
    showTime();
  }

  window.seek = (seconds) => {
    const t = clampTime(seconds);
    selected = t;
    stop();
    return window.motionReady.then(() => paint(t));
  };

  function setPlaying(on) {
    playing = on;
    ui.play.setAttribute("aria-pressed", on ? "true" : "false");
    ui.play.textContent = on ? "一時停止" : "再生";
    showTime();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (playing) setPlaying(false);
  }

  function tick(now) {
    if (!playing) return;
    const t = Math.min(DURATION, startTime + (now - startNow) / 1000);
    try {
      paint(t);
    } catch (error) {
      fail(error);
      return;
    }
    if (t >= DURATION) stop();
    else raf = requestAnimationFrame(tick);
  }

  // Editor preview only; the renderer never plays.
  function play() {
    if (RENDER || !film || loading) return;
    startTime = current >= DURATION ? 0 : current;
    startNow = performance.now();
    setPlaying(true);
    raf = requestAnimationFrame(tick);
  }

  function setControls(enabled) {
    for (const control of [ui.play, ui.reset, ui.time, ...ui.sceneList.querySelectorAll("button")]) control.disabled = !enabled;
  }

  function buildSceneList() {
    const items = SCENES.map((s) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = true;
      const time = document.createElement("span");
      time.className = "scene-time";
      time.textContent = `${s.in}–${s.out}秒`;
      const label = document.createElement("span");
      label.textContent = s.title;
      button.append(time, label);
      button.addEventListener("click", () => {
        window.seek(s.read).catch(fail);
      });
      li.append(button);
      return li;
    });
    ui.sceneList.replaceChildren(...items);
  }

  function setState(state, message) {
    ui.editor.dataset.state = state;
    ui.status.dataset.state = state;
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
    const reason = error && error.message ? error.message : String(error);
    setState("error", `照合に失敗したため、映像を描いていません。${reason}`);
    ui.errorText.textContent = reason;
    ui.errorBox.hidden = false;
    ui.retry.hidden = false;
    ui.retry.disabled = false;
    showAssets();
    showTime();
  }

  // One load at a time. Retry fetches the manifest and all eight files again; nothing is cached.
  function start() {
    if (loading) return window.motionReady;
    stop();
    loading = true;
    film = null;
    manifestDigest = null;
    assetState.clear();
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ui.stage.hidden = true;
    ui.errorBox.hidden = true;
    ui.retry.disabled = true;
    setControls(false);
    showAssets();
    current = selected;
    showTime();
    setState("loading", "素材8件を読み込み、SHA-256 と実行記録を照合しています…");
    const ready = load().then((data) => {
      loading = false;
      film = data;
      ui.stage.hidden = false;
      paint(selected);
      ui.retry.hidden = true;
      setControls(true);
      setState("ready", `素材8件の SHA-256・バイト数と、固定版 ${short(PIN.commit)}・8件・確認${PIN.checks}件・形が通った6件と止まった2件・O03 の原典の誤り・O04 の差1か所・O06・O07・6ファイルの bytes の照合が通りました。この画面は保存済みの記録を描くだけで、OpenHands・エージェント・AI は動きません。`);
      return true;
    });
    ready.catch(fail);
    window.motionReady = ready;
    return ready;
  }

  buildSceneList();
  ui.play.addEventListener("click", () => (playing ? stop() : play()));
  ui.reset.addEventListener("click", () => {
    window.seek(selected).catch(fail);
  });
  ui.time.addEventListener("input", () => {
    window.seek(ui.time.value).catch(fail);
  });
  ui.retry.addEventListener("click", () => {
    start();
  });
  start();
})();
