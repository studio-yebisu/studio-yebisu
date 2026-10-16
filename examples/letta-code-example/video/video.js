/*
 * Studio Yebisu — Letta Code 作例・解説動画（28秒・無音・1280×720）
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * Every frame is drawn on one 2D canvas from absolute time only. File paths, HEAD values,
 * staged changes, original diagnostics, the L08 policy values and the counts are read from the
 * eight frozen assets after assets/data-hashes.json and every listed file match the SHA-256 and
 * byte lengths fixed below, and after the run record agrees with the frozen input, the pinned
 * upstream, the independent checks and the reproduction check. There is no built-in fallback:
 * on any mismatch window.motionReady rejects, the canvas is cleared and hidden, and the editor
 * shows the reason with a retry button that fetches everything again.
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
    sha256: "7b865fd49e59aa5cf0ecd0786aa05e4eee906fb7f77d2f4314e1e46d59a605e8",
    format: "studio-yebisu-letta-film-assets-v1",
  };
  // Same order as the manifest. Paths are relative to video/assets/.
  const ASSETS = [
    { path: "memory-runs.json", sha256: "af6e58cb1f8ef95efc44ae266c51713aa1bad06bcc025cda5d42e4cd3bd49570", bytes: 167251 },
    { path: "independent-checks.json", sha256: "f94c34d001bbd4f7529b2d058b411401526a5885d87f06b5a874c50f9767d1c6", bytes: 2797 },
    { path: "reproduction-checks.json", sha256: "574c2fb858278f6b9e47410da12d355e585bbd73457f8e7116b9dcd534ad0431", bytes: 709 },
    { path: "memory-changes.json", sha256: "852d6c0708eb9c42d31f71ad6fc6f8fcb95849d0d1eb72f4094e60a3e20311e0", bytes: 27161 },
    { path: "vendor-lock.json", sha256: "a62fbf74fa35f609756adf4b9ef2bbfcfe7e46cfd291058be455601bbc8d4d57", bytes: 2476 },
    { path: "screens.json", sha256: "63a15283cc3458b5892118a18f35aecede57e3936e86e3370f08bfe3afe9b23f", bytes: 1423 },
    { path: "phone.jpg", sha256: "fe1ae07f35592dedc6448acb548cfa98a4c7f9595d2b38e6ae6416b739bd33e1", bytes: 48793 },
    { path: "desktop.jpg", sha256: "cbb4ddd550a4259de533e9dfcf1b3922a158f1b9324e150ece597e915b62f496", bytes: 92051 },
  ];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.path, a.sha256]));
  const PIN = {
    repository: "letta-ai/letta-code",
    commit: "316e4c0545b549c453e0f85cc81d3540404eff74",
    version: "0.34.14",
    license: "Apache-2.0",
    validator: "9b815cf928feecc4e830095325983a5ab83d7f284f915807e8de61bbbe075829",
    node: "v24.18.0",
    checks: 208,
  };
  const POLICY = { version: 1, maxDepth: 2, maxFileCharacters: 900, maxCoreMemoryCharacters: 1200, readOnlyFiles: ["persona.md"] };
  const IDS = ["L01", "L02", "L03", "L04", "L05", "L06", "L07", "L08"];
  const COMMITTED = new Set(["L01", "L03"]);
  // Reason fragments fixed before execution (input/memory-changes.json expected_reason).
  const REASONS = {
    L02: "missing required index bookclub/MEMORY.md",
    L04: "901 characters exceeds 900",
    L05: "depth 3 exceeds maxDepth 2",
    L06: "core memory: 1201 characters exceeds 1200",
    L07: "persona.md: read-only file cannot be created, changed or removed",
    L08: ".memfs.config.json is protected and requires human approval to change",
  };
  const RESTORED = "bookclub/MEMORY.md";
  const CONFIG_PATH = ".memfs.config.json";
  const SCREENS = {
    phone: { image: "phone.jpg", case_id: "L02", width: 375, height: 812 },
    desktop: { image: "desktop.jpg", case_id: "L03", width: 1265, height: 889 },
  };
  const FILE_MESSAGE = "このページをファイルとして直接開くと、素材を読み込んで照合できません。作例のフォルダー（render.py のある場所）で python -m http.server を実行し、http://localhost:8000/video/ を開いてください。";

  // --- Scenes ---------------------------------------------------------------------------------

  // read: a settled moment inside the reading hold, used by the scene buttons.
  const SCENES = [
    { n: 1, in: 0, out: 4, read: 2.6, title: "記憶の変更を、保存前に点検する", draw: sceneTitle },
    { n: 2, in: 4, out: 8, read: 6.8, title: "案内を消すと？（L02）", draw: sceneEdit },
    { n: 3, in: 8, out: 12, read: 10.6, title: "案内がないと commit は止まる（L02）", draw: sceneBlocked },
    { n: 4, in: 12, out: 18, read: 13.5, title: "1つ戻して、もう一度点検（L03）", draw: sceneRestore },
    { n: 5, in: 18, out: 22, read: 20.6, title: "APIが通っても保存できるとは限らない（L08）", draw: sceneProtected },
    { n: 6, in: 22, out: 28, read: 25.5, title: "理由を見て、必要な箇所を直す", draw: sceneRead, last: true },
  ];
  const RAIL = ["編集", "止まる", "戻す", "保護", "読む"];

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
  const own = (object, key) => isObject(object) && Object.prototype.hasOwnProperty.call(object, key);
  const short = (commit) => String(commit).slice(0, 7);

  function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
    if (isObject(a) && isObject(b)) {
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((key) => own(b, key) && deepEqual(a[key], b[key]));
    }
    return false;
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
      const item = assetState.get(asset.path) || { ok: null, actual: null };
      const li = document.createElement("li");
      const name = document.createElement("code");
      name.textContent = asset.path;
      const verdict = document.createElement("span");
      verdict.className = item.ok === true ? "verdict is-ok" : item.ok === false ? "verdict is-ng" : "verdict";
      verdict.textContent = item.ok === true ? "準備完了・一致" : item.ok === false ? "不一致" : "照合中";
      const size = document.createElement("span");
      size.className = "bytes";
      size.textContent = `${asset.bytes.toLocaleString("ja-JP")} バイト`;
      const digest = document.createElement("code");
      digest.className = "digest";
      digest.textContent = `SHA-256 ${item.actual || asset.sha256}${item.actual ? "" : "（固定値）"}`;
      li.append(name, " ", verdict, " ", size, document.createElement("br"), digest);
      return li;
    });
    ui.assetList.replaceChildren(...rows);
    const ok = [...assetState.values()].filter((item) => item.ok === true).length;
    ui.assetSummary.textContent = manifestDigest
      ? `video/assets/data-hashes.json（SHA-256 ${manifestDigest}）は固定値と一致。素材${ASSETS.length}件のうち${ok}件の SHA-256 とバイト数が一致しました。`
      : "video/assets/data-hashes.json の照合はまだ終わっていません。";
  }

  function checkJpeg(bytes, name) {
    check(bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      `${name} が JPEG ではありません。`);
  }

  let objectUrls = [];

  async function decodeJpeg(bytes, name, expected) {
    checkJpeg(bytes, name);
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

  function verify(j) {
    const runs = j["memory-runs.json"];
    const indep = j["independent-checks.json"];
    const repro = j["reproduction-checks.json"];
    const changes = j["memory-changes.json"];
    const lock = j["vendor-lock.json"];
    const screens = j["screens.json"];
    [runs, indep, repro, changes, lock, screens].forEach((value, i) => check(isObject(value), `${ASSETS[i].path} の形が想定と違います。`));

    // Pinned upstream, lock, inputs and runtime.
    const up = runs.upstream;
    const pinned = (o) => isObject(o) && o.repository === PIN.repository && o.commit === PIN.commit && o.version === PIN.version && o.license === PIN.license;
    check(runs.format === "studio-yebisu-letta-memory-runs-v1", "memory-runs.json の形式が想定と違います。");
    check(pinned(up), "実行記録の固定版（letta-ai/letta-code 316e4c0・0.34.14・Apache-2.0）が一致しません。");
    check(pinned(lock), "vendor-lock.json の固定版が一致しません。");
    check(Array.isArray(lock.files) && lock.files.length === 8 && deepEqual(lock.files, up.files), "原典8ファイルのハッシュが、実行記録と vendor-lock.json で一致しません。");
    check(up.vendor_lock_sha256 === SHA["vendor-lock.json"] && isObject(runs.input_sha256) && runs.input_sha256["vendor-lock.json"] === SHA["vendor-lock.json"],
      "実行記録が参照する vendor-lock.json の SHA-256 が素材と一致しません。");
    check(runs.input_sha256["input/memory-changes.json"] === SHA["memory-changes.json"], "実行記録が参照する入力の SHA-256 が素材と一致しません。");
    check(isObject(runs.validator_script) && runs.validator_script.sha256 === PIN.validator, "原典の検査スクリプトの SHA-256 が固定値と一致しません。");
    check(isObject(runs.runtime) && runs.runtime.node === PIN.node && runs.runtime.packages_installed === 0, "実行環境（Node 24.18.0・npm の導入なし）が記録と一致しません。");
    check(changes.format === "studio-yebisu-letta-memory-changes-v1" && changes.fictional === true, "memory-changes.json が架空の入力として記録されていません。");
    check(deepEqual(runs.trusted_policy, POLICY) && deepEqual(changes.trusted_policy, POLICY), "初期方針が固定値と一致しません。");

    // Eight results against the frozen input and the expected outcome.
    const results = runs.results;
    check(Array.isArray(results) && results.length === 8 && results.every((r, i) => isObject(r) && r.id === IDS[i]), "実行記録が L01〜L08 の8件ではありません。");
    check(Array.isArray(changes.cases) && changes.cases.length === 8 && changes.cases.every((c, i) => isObject(c) && c.id === IDS[i]), "入力が L01〜L08 の8件ではありません。");
    const byId = {};
    results.forEach((r, i) => {
      const c = changes.cases[i];
      const g = r.git_commit;
      const cli = r.cli;
      check(isObject(r.input) && deepEqual(r.input.accepted_files, c.accepted_files) && deepEqual(r.input.proposed_files, c.proposed_files), `${r.id} の入力が、固定した入力と一致しません。`);
      check(isObject(r.repository) && isObject(r.repository.validator) && r.repository.validator.sha256 === PIN.validator
        && isObject(r.repository.hook) && r.repository.hook.text === runs.validator_script.hook.text, `${r.id} の pre-commit が原典の検査スクリプトと一致しません。`);
      check(isObject(g) && isObject(cli) && isObject(r.api) && isObject(r.api.tree) && Array.isArray(r.api.tree.errors)
        && Array.isArray(g.reported_errors) && Array.isArray(g.staged_changes_before) && Array.isArray(g.staged_changes_after)
        && Array.isArray(cli.reported_errors) && isObject(r.baseline) && g.head_before === r.baseline.commit, `${r.id} の記録の形が想定と違います。`);
      const ok = COMMITTED.has(r.id);
      check(r.committed === ok && c.expected_commit_success === ok, `${r.id} の commit の成否が想定と違います。`);
      if (ok) {
        check(g.exit_code === 0 && cli.exit_code === 0 && g.head_changed === true && g.head_after !== g.head_before && g.parent_after === g.head_before
          && g.stage_retained === false && g.staged_changes_after.length === 0 && g.reported_errors.length === 0, `${r.id} が、HEAD が進み stage が空になった commit として記録されていません。`);
      } else {
        check(g.exit_code === 1 && cli.exit_code === 1 && g.head_changed === false && g.head_after === g.head_before && g.stage_retained === true
          && g.staged_changes_after.length > 0 && deepEqual(g.staged_changes_after, g.staged_changes_before), `${r.id} が、HEAD が変わらず stage が残った停止として記録されていません。`);
        check(g.reported_errors.some((line) => line.includes(REASONS[r.id])) && cli.reported_errors.some((line) => line.includes(REASONS[r.id])),
          `${r.id} の原典の診断に、実行前に決めた理由が見つかりません。`);
      }
      byId[r.id] = r;
    });
    const committedIds = IDS.filter((id) => byId[id].committed);
    const blockedIds = IDS.filter((id) => !byId[id].committed);
    check(isObject(runs.summary) && runs.summary.total === 8 && runs.summary.committed === committedIds.length && runs.summary.blocked === blockedIds.length
      && committedIds.length === 2 && blockedIds.length === 6, "成功2件・停止6件の集計が記録と一致しません。");
    const oracle = runs.oracle_comparison;
    check(isObject(oracle) && Array.isArray(oracle.commit_success) && oracle.commit_success.length === 8 && oracle.commit_success.every((x) => x.match === true),
      "実行前の期待との照合が一致していません。");
    const v = runs.verification;
    check(isObject(v) && v.status === "passed" && v.total === PIN.checks && Array.isArray(v.checks) && v.checks.length === PIN.checks && v.checks.every((x) => x && x.passed === true),
      "実行時の208件の確認がすべて通った記録になっていません。");

    // L02: the child index was deleted; both detail files report the missing index.
    const l02 = byId.L02;
    const baseline = l02.baseline.files.map((f) => f && f.path);
    const children = baseline.filter((p) => typeof p === "string" && p.startsWith("bookclub/") && p !== RESTORED);
    check(isObject(l02.change) && deepEqual(l02.change.removed, [RESTORED]) && baseline.includes("MEMORY.md") && baseline.includes("persona.md") && baseline.includes(RESTORED),
      "L02 で消したファイルが bookclub/MEMORY.md ではありません。");
    check(children.length === 2 && children.every((p) => l02.git_commit.reported_errors.includes(`${p}: missing required index ${RESTORED}`)),
      "L02 の診断が、2つの詳細ファイルの案内不足として記録されていません。");
    check(l02.git_commit.staged_changes_after.length === 2, "L02 の stage に残った変更が2件ではありません。");

    // L02 → L03: a separate trial whose input differs only by restoring the same index.
    const l03 = byId.L03;
    const a = l02.input.proposed_files;
    const b = l03.input.proposed_files;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    const differ = keys.filter((k) => !own(a, k) || !own(b, k) || a[k] !== b[k]);
    check(differ.length === 1 && differ[0] === RESTORED && !own(a, RESTORED) && own(b, RESTORED) && b[RESTORED] === l02.input.accepted_files[RESTORED]
      && deepEqual(l02.input.accepted_files, l03.input.accepted_files), "L02 と L03 の入力の差が、bookclub/MEMORY.md を戻した1ファイルだけではありません。");
    check(l02.repository.directory !== l03.repository.directory, "L02 と L03 が別のリポジトリとして記録されていません。");

    // L08: the initial-policy tree API reports nothing, the original script blocks the config change.
    const l08 = byId.L08;
    const trusted = l08.api.trusted_config;
    const staged = isObject(l08.api.staged_config) ? l08.api.staged_config.parsed : null;
    check(isObject(staged) && deepEqual(trusted, POLICY) && l08.api.staged_config.differs_from_trusted === true && l08.api.tree.errors.length === 0,
      "L08 の検査API（初期方針）の結果が、エラー0件として記録されていません。");
    const changedKeys = [...new Set([...Object.keys(trusted), ...Object.keys(staged)])].filter((k) => !deepEqual(trusted[k], staged[k]));
    check(changedKeys.length === 1 && changedKeys[0] === "maxFileCharacters" && trusted.maxFileCharacters === 900 && staged.maxFileCharacters === 1100,
      "L08 の設定の変更が maxFileCharacters 900 → 1100 だけではありません。");
    check(l08.git_commit.staged_changes_after.some((x) => x && x.status === "M" && x.path === CONFIG_PATH), "L08 の stage に設定の変更が残っていません。");

    // Independent production-side checks.
    check(indep.status === "passed" && indep.run_sha256 === SHA["memory-runs.json"] && indep.checks_in_runner === PIN.checks && indep.source_files === 8
      && deepEqual(indep.repair_pair_diff, [RESTORED]), "independent-checks.json が実行記録と一致しません。");
    check(Array.isArray(indep.cases) && indep.cases.length === 8 && indep.cases.every((c, i) => isObject(c) && c.id === IDS[i]
      && c.actual_git_head_and_index_checked === true && c.accepted_and_proposed_bytes_match === true && c.original_hook_sha256 === PIN.validator
      && c.committed === byId[c.id].committed && isObject(byId[c.id].unicode) && c.root_code_points === byId[c.id].unicode.root_markdown_code_points),
      "independent-checks.json の8件が実行記録と一致しません。");
    check(byId.L06.unicode.root_markdown_code_points === 1201, "L06 のルートの合計文字数が記録と一致しません。");

    // Reproduction in a separate copy and fresh Node process.
    check(repro.status === "passed" && repro.original_sha256 === SHA["memory-runs.json"] && repro.reproduced_sha256 === SHA["memory-runs.json"]
      && repro.entire_record_byte_identical === true && repro.result_objects_identical === true && repro.cases === 8
      && repro.successful_commits === 2 && repro.blocked_commits === 6 && repro.fixed_fictional_git_dates === true,
      "reproduction-checks.json が、記録全体のバイト一致として記録されていません。");

    // Screenshot provenance.
    check(screens.format === "studio-yebisu-letta-screens-v1" && screens.no_image_editing === true && screens.actual_outputs_unchanged === true
      && Array.isArray(screens.screens) && screens.screens.length === 2, "screens.json の形が想定と違います。");
    const shotMeta = {};
    for (const [id, expected] of Object.entries(SCREENS)) {
      const s = screens.screens.find((x) => isObject(x) && x.id === id);
      check(s && s.image === expected.image && s.case_id === expected.case_id && s.width === expected.width && s.height === expected.height
        && s.file_sha256 === SHA[expected.image] && s.run_sha256 === SHA["memory-runs.json"] && /^[0-9a-f]{64}$/.test(s.rgb_sha256 || ""),
        `screens.json の ${expected.image} の記録が素材と一致しません。`);
      shotMeta[id] = s;
    }

    const stderrFirst = (s) => String(s).split("\n")[0];
    return {
      repository: up.repository,
      commit: up.commit,
      version: up.version,
      node: runs.runtime.node,
      checks: v.total,
      shotMeta,
      l02: {
        baseline,
        children,
        removed: RESTORED,
        written: l02.change.written,
        staged: l02.git_commit.staged_changes_after,
        headBefore: short(l02.git_commit.head_before),
        headAfter: short(l02.git_commit.head_after),
        exit: l02.git_commit.exit_code,
        stderrFirst: stderrFirst(l02.git_commit.stderr),
        errors: l02.git_commit.reported_errors,
      },
      repair: {
        rows: Object.keys(b).map((path) => ({ path, inL02: own(a, path), restored: path === RESTORED })),
        headBefore: short(l03.git_commit.head_before),
        headAfter: short(l03.git_commit.head_after),
        stagedAfter: l03.git_commit.staged_changes_after.length,
        directory: l03.repository.directory,
      },
      l08: {
        key: changedKeys[0],
        from: trusted.maxFileCharacters,
        to: staged.maxFileCharacters,
        apiErrors: l08.api.tree.errors.length,
        gitExit: l08.git_commit.exit_code,
        error: l08.git_commit.reported_errors[0],
      },
      summary: { total: results.length, committed: committedIds.length, blocked: blockedIds.length, committedIds, blockedIds },
    };
  }

  const SERIF = '"Yu Mincho", YuMincho, "Hiragino Mincho ProN", "Noto Serif JP", serif';
  const SANS = '"Yu Gothic UI", "Yu Gothic", YuGothic, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, system-ui, sans-serif';
  const MONO = 'Consolas, "Cascadia Mono", Menlo, ui-monospace, monospace';
  const font = (size, weight = 500, family = SANS) => `${weight} ${size}px ${family}`;

  async function loadFonts() {
    if (!document.fonts || typeof document.fonts.load !== "function") return;
    const sample = "記憶の変更を保存前に点検する案内消すと止まる戻して別試行理由直す 0123456789 → bookclub/MEMORY.md";
    const specs = [font(64, 700, SERIF), font(28, 500), font(28, 700), font(28, 800), font(20, 500, MONO), font(20, 700, MONO)];
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
    await Promise.all(ASSETS.map(async (asset) => {
      const data = await fetchBytes(`assets/${asset.path}`);
      const actual = await sha256Hex(data);
      const ok = actual === asset.sha256 && data.byteLength === asset.bytes;
      assetState.set(asset.path, { ok, actual });
      showAssets();
      check(ok, `${asset.path} の SHA-256 またはバイト数が data-hashes.json と一致しません。`);
      bytes[asset.path] = data;
    }));

    const json = {};
    for (const asset of ASSETS) if (asset.path.endsWith(".json")) json[asset.path] = parseJson(bytes[asset.path], asset.path);
    let data;
    try {
      data = verify(json);
    } catch (error) {
      if (error instanceof CheckError) throw error;
      throw new CheckError(`素材の形が想定と違います（${error && error.message ? error.message : "不明"}）。`);
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

  const C = {
    paper: "#f4eee2",
    raised: "#fbf8f2",
    sunk: "#ebe3d3",
    ink: "#1c211f",
    soft: "#4f5753",
    green: "#1f3d33",
    greenSoft: "#dfe8e2",
    rust: "#a84a24",
    rustSoft: "#f4e0d4",
    line: "#d6ccb8",
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

  function wrapWords(str, maxWidth, size, family) {
    ctx.font = font(size, 500, family);
    const lines = [];
    let line = "";
    for (const word of str.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
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
    const w = ctx.measureText(label).width + 20;
    const h = size + 12;
    const left = o.align === "right" ? x - w : x;
    box(left, y - h / 2, w, h, { fill: o.bg, r: h / 2 });
    text(label, left + w / 2, y + size * 0.36, { size, weight: 700, color: o.color, align: "center" });
  }

  function segment(x1, y1, x2, y2, progress, o = {}) {
    if (progress <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress);
    ctx.lineWidth = o.lw || 2;
    ctx.strokeStyle = o.color || C.ink;
    ctx.setLineDash(o.dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function arrow(x1, y, x2, progress, color) {
    if (progress <= 0) return;
    const end = x1 + (x2 - x1) * progress;
    segment(x1, y, end, y, 1, { color, lw: 4 });
    ctx.beginPath();
    ctx.moveTo(end + 4, y);
    ctx.lineTo(end - 12, y - 9);
    ctx.lineTo(end - 12, y + 9);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
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
    ctx.shadowColor = "rgba(28, 33, 31, 0.18)";
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

  function headline(lines, x, y, lt, o) {
    lines.forEach((line, i) => {
      const e = enter(lt, (o.at || 0) + i * 0.14, 0.55);
      layer(e, (1 - e) * 16, () => text(line, x, y + i * (o.lh || 0), { size: o.size, weight: 700, family: SERIF, max: o.max || 1120, min: 52 }));
    });
  }

  function drawChrome(t) {
    text(`Letta Code ${film.version} ・ 記憶の検査の作例`, 80, 50, { size: 18, weight: 700, color: C.green });
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
        ctx.fillStyle = C.rust;
        ctx.fillRect(x, 58, widths[i], 3);
      }
      x += widths[i] + gap;
    });
    text("架空の記憶 ・ 保存済みの実行記録と閲覧ページの実画面 ・ 無音", 80, 702, { size: 15, color: C.soft });
    text(`${film.repository} ${short(film.commit)}`, 1200, 702, { size: 14, family: MONO, color: C.soft, align: "right" });
  }

  // --- Scenes ----------------------------------------------------------------------------------

  function sceneTitle(lt) {
    headline(["記憶の変更を、", "保存前に点検する"], 96, 300, lt, { size: 76, lh: 96, at: 0.05, max: 660 });
    const u = inOut(ramp(lt, 0.9, 1.5));
    if (u > 0) {
      ctx.font = font(76, 700, SERIF);
      const w = Math.min(660, ctx.measureText("保存前に点検する").width);
      ctx.fillStyle = C.rust;
      ctx.fillRect(96, 418, w * u, 6);
    }
    layer(enter(lt, 0.7), 0, () => text("架空の記憶・実際のGit検査", 96, 488, { size: 34, weight: 700, color: C.green }));
    layer(enter(lt, 0.9), 0, () => text(`固定版 ${film.repository} ${film.version}（${short(film.commit)}）`, 96, 530, { size: 18, color: C.soft }));

    // The actual files of the L02 baseline commit; the file L02 edits is tagged.
    const d = film.l02;
    layer(enter(lt, 1.3), 0, () => text("commit の前に点検", 800, 140, { size: 20, weight: 700, color: C.green }));
    d.baseline.forEach((path, i) => {
      const e = enter(lt, 0.3 + i * 0.1, 0.45);
      const nested = path.includes("/");
      const x = 800 + (nested ? 36 : 0);
      const y = 166 + i * 64;
      const w = 400 - (nested ? 36 : 0);
      layer(e, 0, () => {
        ctx.translate((1 - e) * 40, 0);
        box(x, y, w, 50, { fill: C.raised, stroke: C.line, lw: 1.5, r: 8 });
        text(path, x + 18, y + 33, { size: 21, family: MONO, max: w - 100, min: 16 });
        if (d.written.includes(path)) layer(enter(lt, 1.3, 0.4), 0, () => pill("編集", x + w - 12, y + 25, { color: C.rust, bg: C.rustSoft, align: "right" }));
      });
    });
    const sweep = inOut(ramp(lt, 1.6, 2.8));
    if (sweep > 0) {
      const y = 158 + sweep * (d.baseline.length * 64);
      ctx.fillStyle = C.green;
      ctx.fillRect(784, y, 432, 3);
      ctx.beginPath();
      ctx.moveTo(784, y - 7);
      ctx.lineTo(796, y + 1.5);
      ctx.lineTo(784, y + 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  function sceneEdit(lt) {
    const d = film.l02;
    headline(["案内を消すと？"], 80, 176, lt, { size: 68, max: 520 });
    layer(enter(lt, 0.35), 0, () => text("子フォルダーの案内を消して stage した", 80, 236, { size: 28, color: C.soft, max: 520, min: 22 }));
    const removal = inOut(ramp(lt, 1.2, 1.8));

    // Left: the actual staged name-status rows.
    d.staged.forEach((row, i) => layer(enter(lt, 1.3 + i * 0.15), 0, () => {
      const removed = row.status === "D";
      text(row.status, 80, 330 + i * 46, { size: 26, family: MONO, weight: 700, color: removed ? C.rust : C.ink });
      text(row.path, 120, 330 + i * 46, { size: 26, family: MONO, color: removed ? C.rust : C.ink, max: 440, min: 18 });
    }));
    layer(enter(lt, 1.6), 0, () => text("git の記号 D＝削除・M＝変更", 80, 330 + d.staged.length * 46, { size: 18, color: C.soft }));
    layer(enter(lt, 0.6), 0, () => text("説明図：L02 の実際のファイル（基準の commit と stage）", 80, 652, { size: 17, color: C.soft }));

    // Right: explanatory map of the real fixture.
    const R = { x: 690, y: 150, w: 290, h: 56 };
    const P = { x: 1010, y: 150, w: 190, h: 56 };
    const I = { x: 690, y: 300, w: 290, h: 56 };
    const K = [{ x: 600, y: 460, w: 280, h: 56 }, { x: 910, y: 460, w: 290, h: 56 }];
    const node = (r, path, o = {}) => {
      box(r.x, r.y, r.w, r.h, { fill: o.fill || C.raised, stroke: o.stroke || C.line, lw: o.lw || 1.5, dash: o.dash, r: 8 });
      return text(path, r.x + 16, r.y + r.h / 2 + 7, { size: 20, family: MONO, weight: o.weight || 500, color: o.color || C.ink, max: r.w - 32, min: 15 });
    };
    layer(enter(lt, 0.15), 0, () => {
      text("ルートの案内", R.x, R.y - 12, { size: 16, weight: 700, color: C.soft });
      node(R, "MEMORY.md", { weight: 700 });
      node(P, "persona.md");
    });
    const edge = enter(lt, 0.4, 0.5);
    segment(R.x + R.w / 2, R.y + R.h, I.x + I.w / 2, I.y, edge, { color: C.ink });
    layer(enter(lt, 0.3), 0, () => {
      text("子の案内", I.x, I.y - 12, { size: 16, weight: 700, color: removal > 0.5 ? C.rust : C.soft });
      layer(1 - removal, 0, () => box(I.x, I.y, I.w, I.h, { fill: C.greenSoft, stroke: C.green, lw: 2, r: 8 }));
      layer(removal, 0, () => box(I.x, I.y, I.w, I.h, { fill: C.paper, stroke: C.rust, lw: 2, dash: [8, 6], r: 8 }));
      const w = text(d.removed, I.x + 16, I.y + I.h / 2 + 7, { size: 20, family: MONO, weight: 700, color: removal > 0.5 ? C.rust : C.green, max: I.w - 32, min: 15 });
      if (removal > 0) {
        ctx.fillStyle = C.rust;
        ctx.fillRect(I.x + 16, I.y + I.h / 2, w * removal, 2.5);
      }
      layer(removal, 0, () => pill("削除", I.x + I.w + 12, I.y + I.h / 2, { color: C.paper, bg: C.rust }));
    });
    d.children.forEach((path, i) => {
      const k = K[i];
      const from = { x: I.x + I.w / 2, y: I.y + I.h };
      const to = { x: k.x + k.w / 2, y: k.y };
      const p = enter(lt, 0.6 + i * 0.1, 0.5);
      layer(1 - removal, 0, () => segment(from.x, from.y, to.x, to.y, p, { color: C.ink }));
      layer(removal, 0, () => segment(from.x, from.y, to.x, to.y, p, { color: C.rust, dash: [7, 7] }));
      layer(enter(lt, 0.7 + i * 0.1), 0, () => {
        node(k, path);
        if (d.written.includes(path)) layer(enter(lt, 0.8), 0, () => pill("編集", k.x + k.w, k.y - 16, { color: C.rust, bg: C.rustSoft, align: "right", size: 14 }));
      });
      layer(removal, 0, () => text("必要な案内がない", k.x + 4, k.y + k.h + 30, { size: 20, weight: 700, color: C.rust }));
    });
  }

  function sceneBlocked(lt) {
    const d = film.l02;
    headline(["案内がないと", "commitは止まる"], 80, 170, lt, { size: 64, lh: 78, max: 760 });
    layer(enter(lt, 0.55), 0, () => {
      text("HEAD", 80, 330, { size: 22, family: MONO, weight: 700, color: C.soft });
      text(`${d.headBefore} → ${d.headAfter}`, 170, 330, { size: 28, family: MONO });
      text("変わらない", 480, 332, { size: 34, weight: 700, color: C.green });
    });
    layer(enter(lt, 0.75), 0, () => {
      text("stage", 80, 392, { size: 22, family: MONO, weight: 700, color: C.soft });
      text(`${d.staged.length}件の変更が残る`, 170, 394, { size: 34, weight: 700, color: C.green });
      d.staged.forEach((row, i) => text(`${row.status}  ${row.path}`, 170, 432 + i * 27, { size: 19, family: MONO, color: row.status === "D" ? C.rust : C.ink }));
    });
    layer(enter(lt, 1.0), 0, () => {
      box(80, 494, 770, 150, { fill: C.rustSoft, r: 10 });
      ctx.fillStyle = C.rust;
      ctx.fillRect(80, 504, 5, 130);
      text(`原典の診断（git commit の stderr・終了コード ${d.exit}）`, 104, 526, { size: 18, weight: 700, color: C.rust, max: 726 });
      text(d.stderrFirst, 104, 558, { size: 17, family: MONO, max: 726, min: 13 });
      d.errors.forEach((line, i) => text(line, 104, 588 + i * 26, { size: 17, family: MONO, max: 726, min: 13 }));
    });
    const e = enter(lt, 0.35, 0.6);
    layer(e, (1 - e) * 20, () => {
      shot(film.images.phone, 900, 92, 300, 548);
      text("閲覧ページの実画面（L02）", 1050, 666, { size: 16, color: C.soft, align: "center" });
    });
  }

  function sceneRestore(lt) {
    const d = film.repair;
    headline(["1つ戻して、", "もう一度点検"], 80, 170, lt, { size: 64, lh: 78, max: 660 });
    layer(enter(lt, 0.35), 0, () => {
      text("L02（止まった）", 80, 318, { size: 20, weight: 700, color: C.rust });
      text("L03（別の試行）", 430, 318, { size: 20, weight: 700, color: C.green });
    });
    const mark = inOut(ramp(lt, 0.9, 1.3));
    d.rows.forEach((row, i) => {
      const y = 336 + i * 38;
      layer(enter(lt, 0.45 + i * 0.06, 0.4), 0, () => {
        if (row.inL02) {
          text(row.path, 80, y + 25, { size: 18, family: MONO, max: 300, min: 14 });
        } else {
          box(80, y + 2, 300, 32, { stroke: C.rust, dash: [6, 5], lw: 1.5, r: 6 });
          text("（消したまま）", 92, y + 25, { size: 18, color: C.rust });
        }
        text(row.restored ? "＋" : "＝", 404, y + 25, { size: 20, weight: 700, color: row.restored ? C.green : C.soft, align: "center" });
        if (row.restored) layer(mark, 0, () => box(422, y + 1, 318, 34, { fill: C.greenSoft, r: 6 }));
        text(row.path, 430, y + 25, { size: 18, family: MONO, weight: row.restored ? 700 : 500, color: row.restored ? C.green : C.ink, max: 236, min: 14 });
        if (row.restored) layer(mark, 0, () => pill("戻した", 736, y + 18, { color: C.paper, bg: C.green, align: "right", size: 14 }));
      });
    });
    layer(enter(lt, 1.0, 0.35), 0, () => {
      text("L03 は commit できた", 80, 606, { size: 32, weight: 700, color: C.green });
      text(`HEAD ${d.headBefore} → ${d.headAfter} ・ stage に残った変更 ${d.stagedAfter}件`, 80, 642, { size: 19, color: C.soft, max: 660 });
    });
    const e = enter(lt, 0.6, 0.5);
    layer(e, (1 - e) * 18, () => {
      const r = shot(film.images.desktop, 780, 110, 420, 300);
      text("閲覧ページの実画面（L03）", r.x + r.w / 2, r.y + r.h + 30, { size: 16, color: C.soft, align: "center" });
    });
    layer(enter(lt, 1.0, 0.35), 0, () => {
      text("同じ内容に案内を戻した、別の試行", 780, 492, { size: 24, weight: 700, max: 420 });
      text("自動修復ではなく、実行前に固定した別の入力", 780, 526, { size: 17, color: C.soft, max: 420 });
      text(`新しい別の Git リポジトリ（${d.directory}）`, 780, 554, { size: 17, color: C.soft, max: 420 });
    });
  }

  function sceneProtected(lt) {
    const d = film.l08;
    headline(["APIが通っても", "保存できるとは限らない"], 80, 170, lt, { size: 64, lh: 78, max: 1120 });
    layer(enter(lt, 0.4), 0, () => {
      text("保護された設定を上げる変更（L08）", 80, 316, { size: 22, weight: 700, color: C.soft });
      text(CONFIG_PATH, 80, 372, { size: 24, family: MONO });
      text(d.key, 340, 372, { size: 22, family: MONO, color: C.soft });
    });
    layer(enter(lt, 0.55), 0, () => text(String(d.from), 600, 380, { size: 46, family: MONO, weight: 700 }));
    arrow(698, 364, 770, inOut(ramp(lt, 0.7, 1.05)), C.rust);
    layer(enter(lt, 0.95, 0.35), 0, () => text(String(d.to), 790, 380, { size: 46, family: MONO, weight: 700, color: C.rust }));

    layer(enter(lt, 1.0), 0, () => {
      box(80, 420, 540, 196, { fill: C.raised, stroke: C.line, lw: 1.5, r: 12 });
      text("検査API（初期方針）", 108, 462, { size: 24, weight: 700 });
      text(`エラー ${d.apiErrors}件`, 108, 528, { size: 50, weight: 800, color: C.green });
      text(`初期方針（上限 ${d.from}）で stage の木を検査`, 108, 568, { size: 17, color: C.soft, max: 488 });
      text("validateMemoryTreeConstraints", 108, 596, { size: 16, family: MONO, color: C.soft });
    });
    layer(enter(lt, 1.2), 0, () => {
      box(660, 420, 540, 196, { fill: C.rustSoft, r: 12 });
      ctx.fillStyle = C.rust;
      ctx.fillRect(660, 432, 5, 172);
      text("原典の検査（pre-commit）", 688, 462, { size: 24, weight: 700 });
      text(`終了コード ${d.gitExit}`, 1176, 462, { size: 20, weight: 700, color: C.rust, align: "right" });
      text("commit は止まる", 688, 528, { size: 50, weight: 800, color: C.rust, max: 488, min: 40 });
      wrapWords(d.error, 488, 15, MONO).slice(0, 2).forEach((line, i) => text(line, 688, 568 + i * 22, { size: 15, family: MONO, max: 488 }));
    });
    layer(enter(lt, 1.4), 0, () => text("架空の試行です。承認の操作はしていません。", 80, 664, { size: 19, color: C.soft }));
  }

  function sceneRead(lt) {
    const s = film.summary;
    headline(["理由を見て、", "必要な箇所を直す"], 80, 160, lt, { size: 62, lh: 76, max: 700 });
    const count = (y, n, label, ids, color, at) => layer(enter(lt, at), 0, () => {
      const w = text(String(n), 80, y, { size: 100, weight: 800, color });
      text(label, 80 + w + 14, y, { size: 40, weight: 700, max: 600 - w, min: 32 });
      text(ids.join("・"), 80 + w + 16, y + 34, { size: 19, family: MONO, color: C.soft });
    });
    count(345, s.committed, "件 commit できた", s.committedIds, C.green, 0.35);
    count(460, s.blocked, "件 予定どおり止まった", s.blockedIds, C.rust, 0.5);
    layer(enter(lt, 0.65), 0, () => text(`全${s.total}件・それぞれ別の新しい Git リポジトリ`, 80, 540, { size: 20, color: C.soft }));
    layer(enter(lt, 0.8), 0, () => {
      let x = 80;
      ["選ぶ", "理由", "JSONで保存"].forEach((word, i) => {
        if (i) x += text("→", x + 18, 612, { size: 40, weight: 700, color: C.rust }) + 36;
        x += text(word, x, 612, { size: 46, weight: 800 });
      });
    });
    layer(enter(lt, 1.0), 0, () => text(`検査：Node ${film.node} / Git ・ 会話・AI推論なし ・ 実行時の照合 ${film.checks}件すべて通過`, 80, 660, { size: 18, color: C.soft, max: 720, min: 14 }));
    const e = enter(lt, 0.45, 0.6);
    layer(e, (1 - e) * 18, () => {
      shot(film.images.desktop, 820, 108, 380, 270);
      shot(film.images.phone, 1040, 300, 160, 330);
      text("閲覧ページの実画面（L03・L02）", 1200, 664, { size: 16, color: C.soft, align: "right" });
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

  let current = 0;
  let playing = false;
  let raf = 0;
  let startNow = 0;
  let startTime = 0;

  const clampTime = (seconds) => {
    const value = Number(seconds);
    return Number.isFinite(value) ? Math.min(DURATION, Math.max(0, value)) : 0;
  };

  function paint(t) {
    if (!film) throw new Error("素材の照合が済んでいないため描けません。");
    current = t;
    drawFrame(t);
    ui.time.value = String(t);
    ui.timeLabel.textContent = `${t.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
  }

  window.seek = (seconds) => {
    const t = clampTime(seconds);
    return window.motionReady.then(() => paint(t));
  };

  function setPlaying(on) {
    playing = on;
    ui.play.setAttribute("aria-pressed", on ? "true" : "false");
    ui.play.textContent = on ? "一時停止" : "再生";
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    setPlaying(false);
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

  function play() {
    if (RENDER || !film) return;
    if (current >= DURATION) current = 0;
    startTime = current;
    startNow = performance.now();
    setPlaying(true);
    raf = requestAnimationFrame(tick);
  }

  function setControls(enabled) {
    for (const control of [ui.play, ui.time, ...ui.sceneList.querySelectorAll("button")]) control.disabled = !enabled;
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
        stop();
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
  }

  function start() {
    stop();
    film = null;
    current = 0;
    manifestDigest = null;
    assetState.clear();
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls = [];
    ui.stage.hidden = false;
    ui.errorBox.hidden = true;
    ui.retry.disabled = true;
    setControls(false);
    showAssets();
    setState("loading", "素材8件を読み込み、SHA-256 と実行記録を照合しています…");
    const ready = load().then((data) => {
      film = data;
      paint(0);
      ui.retry.hidden = true;
      setControls(true);
      setState("ready", `素材8件の SHA-256 と、固定版 ${short(PIN.commit)}・8件・確認${PIN.checks}件・成功2件と停止6件・L02とL03の差1ファイル・L08の結果の照合が通りました。時刻と再生を操作できます。この画面は保存済みの記録を描くだけで、Git や AI は動きません。`);
      return true;
    });
    ready.catch(fail);
    window.motionReady = ready;
    return ready;
  }

  buildSceneList();
  ui.play.addEventListener("click", () => (playing ? stop() : play()));
  ui.time.addEventListener("input", () => {
    stop();
    window.seek(ui.time.value).catch(fail);
  });
  ui.retry.addEventListener("click", () => {
    start();
  });
  start();
})();
