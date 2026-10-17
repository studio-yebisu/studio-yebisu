/*
 * Studio Yebisu — OpenHands 作例・解説動画（33秒・合成音声のナレーション）
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * One 2D canvas, painted from absolute time only (window.seek). Two native layouts:
 * 720×1280 portrait (main) and 1280×720 landscape. Other sizes reuse the nearer layout, scaled and centred.
 * Before window.motionReady resolves, assets/manifest.json must match its pinned SHA-256 and all eight listed
 * files must match their SHA-256 and byte counts. The run record, inputs, independent checks, reproduction checks,
 * lock and cue sheet are then cross-checked, and narration.wav is parsed (48 kHz mono PCM16, exactly 33 s) and
 * measured for signal inside each of the five cue windows. There is no built-in result data: what the diagram
 * shows (missing clock, stop or pass, "?" clock, first reference only, the O04 filename) comes from the verified
 * record. On any mismatch motionReady rejects, the stage is hidden, controls are disabled and #retry loads again.
 * The document, clock, folders, gate and phone are explanatory drawings, not measurements or screen recordings.
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
  const DURATION = 33;
  const POSTER_TIME = 12;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: [] };

  // --- Frozen expectations --------------------------------------------------------------------

  const MANIFEST = {
    path: "assets/manifest.json",
    sha256: "d6370b8ad33b837a2e47780e9250a3079f43f16f1de950ef4c3bdadf812a7080",
    format: "studio-yebisu-asset-lock-v1",
    case: "openhands-example",
  };
  // Same order as the manifest. Paths are relative to video/assets/.
  const ASSETS = [
    { file: "automation-runs.json", sha256: "bc347cc3246fa36a9e4e7d5849e48ecf8119e67e2d6afcd166211e67f453c7b0", bytes: 74735 },
    { file: "automation-settings.json", sha256: "e982b4ca83fd92d9f012a44e98f35dc58b9dfc48a95eede6bb7daff57ce0be6b", bytes: 8430 },
    { file: "expected.json", sha256: "d2e9892831156aa52d87eff81b7b28ce15caaafbde900d828a8763d66064d460", bytes: 730 },
    { file: "independent-checks.json", sha256: "0210a265e0eadf9aa8382fde0fe8b54e529d9c7cc518d9304e3624e1e24376d5", bytes: 18287 },
    { file: "narration-cues.json", sha256: "6a602a04608adaa6a61d141d20f42fe61774c191b70082ff2bb3552fec178ed8", bytes: 4649 },
    { file: "narration.wav", sha256: "4be964f2ffc17338daa3366d09e6ad58547fa92c42fc2e3ee9d6c2a758a71fd4", bytes: 3168044 },
    { file: "reproduction-checks.json", sha256: "c14352c2848f466e5f152fadbd2886020053071c4d7787990619c7177673bb65", bytes: 1418 },
    { file: "vendor-lock.json", sha256: "34149d29d4d4cb0181f41f0b8ac998a5c8baa0c3e13e0af341338eae1dddea02", bytes: 12441 },
  ];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.file, a.sha256]));
  const PIN = {
    format: "studio-yebisu-openhands-automation-runs-v1",
    settingsFormat: "studio-yebisu-openhands-settings-v1",
    repository: "OpenHands/OpenHands",
    commit: "e4775b4ba61a83ba80af5f7b0b826201b8e8ea05",
    version: "1.27.1",
    license: "MIT",
    dependency: "@openhands/extensions",
    dependencyVersion: "0.30.0",
    integrity: "sha512-lPyH0iqSow+ARTX4cumR75e3BJmuqpj2YbKm1cqDcI1SQDXfDTr+/wSVH9dQsOmddEP4Zn+uMoLXpKSO/moonA==",
    originalFiles: 12,
    packageFiles: 29,
    checks: 107,
    independent: 155,
    ids: ["O01", "O02", "O03", "O04", "O05", "O06", "O07", "O08"],
    summary: { total: 8, accepted: 6, rejected: 2 },
    errorName: "AutomationFileValidationError",
    o4: { path: "outputs/exports/O04.automation.json", filename: "O04.automation.json", bytes: 602, sha256: "5e1ae14b8273237d308dceb6fdad445ce7c6e5e210f4e3b6cadcee951d7a5aa3" },
    tts: "Aratako/Irodori-TTS-v4.1-Small",
    ttsRevision: "2b28324dc263ed5e6638b3cf3dd94c82ead07b4b",
    rate: 48000,
  };
  // Fixed before this film was written (narration-cues.json). The film checks the cue sheet agrees exactly.
  const CUE_PLAN = [
    { id: "intro", text: "自動化の設定を、ファイルにして持ち運びます。", start: 0.8, end: 4.56, file: "audio/intro.wav", sha256: "0d9bf741920467ea76c07f3923e12742f4eea6273f42255186b0a710a5cecde2" },
    { id: "missing", text: "時刻が抜けていると、読み込みで止まります。", start: 5.3, end: 8.82, file: "audio/missing.wav", sha256: "b72e955a85463036c5dede198ee71addf500aad66b9ffd4b36be43eb29ebc757" },
    { id: "repair", text: "時刻をひとつ戻すと、形式の点検を通って保存できます。", start: 9.6, end: 14.48, file: "audio/repair.wav", sha256: "c1ddeef882c65dd6968b1bf4e3ab717340b8db61a68541d857b9b01b9dc9219e" },
    { id: "limits", text: "ただし、時刻が正しいか、実際に動くかは、別の確認です。", start: 15.2, end: 20.96, file: "audio/limits.wav", sha256: "e0b3f4f48faeb6e40bc612a4eb9144813f5d18343f4972d0b19b87bacd4c8812" },
    { id: "repository", text: "参照先がふたつあっても、保存されるのは先頭だけ。元の設定と見比べましょう。", start: 21.8, end: 28.88, file: "audio/repository.wav", sha256: "5107797c09e9d1ff1ec948dc67ae6778657e1d17b73eff7996d7bad06f4ae65d" },
  ];
  const SCENE_PLAN = [
    { id: "relation", in: 0, out: 5, label: "設定を、持ち運ぶ", case: "O01", read: 2.6, note: "関係の全体：設定ファイル → 形式の点検 → 保存ファイル" },
    { id: "missing", in: 5, out: 9.3, label: "時刻がないと、止まる", case: "O03", read: 8.2, note: "時刻の部品が抜けた O03 はゲートで止まり、保存ファイルなし" },
    { id: "repair", in: 9.3, out: 15, label: "時刻を戻して、保存", case: "O04", read: 13.0, note: "同じ書類に時刻を戻した O04 が通り、実際のファイルをスマホへ" },
    { id: "limits", in: 15, out: 21.5, label: "形式と、実行は別", case: "O06", read: 19.6, note: "「？」の時刻の O06 も形式OK。実行の枠には入らない" },
    { id: "repository", in: 21.5, out: 30, label: "参照先は、先頭だけ", case: "O07", read: 27.4, note: "参照先2つの O07：2つ目はゲートの外に残り、1つ目だけが保存" },
    { id: "save", in: 30, out: 33, label: "図で確かめ、設定を保存", case: "O04", read: 32.5, note: "関係の全体と保存の印をそのまま見せる（3秒）", last: true },
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
    narration: $("narration"),
    play: $("play"),
    reset: $("reset"),
    mute: $("mute"),
    time: $("time"),
    clock: $("clock"),
    audio: $("preview-audio"),
    sceneList: $("scene-list"),
    assetList: $("asset-list"),
    layoutTall: $("layout-tall"),
    layoutWide: $("layout-wide"),
  };

  if (RENDER) {
    document.documentElement.classList.add("is-render");
    ui.canvas.style.width = `${W}px`;
    ui.canvas.style.height = `${H}px`;
  } else {
    ui.canvas.style.aspectRatio = `${W} / ${H}`;
    ui.stage.classList.toggle("is-tall", H >= W);
    const current = H >= W ? ui.layoutTall : ui.layoutWide;
    if (current) current.setAttribute("aria-current", "page");
  }
  ui.canvas.width = W;
  ui.canvas.height = H;
  const ctx = ui.canvas.getContext("2d");

  // --- Layouts (authored natively for each orientation) ------------------------------------

  function portraitLayout() {
    return {
      DW: 720, DH: 1280, u: 1, tall: true,
      eyebrow: { x: 48, y: 74, size: 22 },
      badge: { x: 672, y: 74, size: 24 },
      title: { x: 48, y: 152, size: 58, min: 40, max: 624 },
      doc: { x: 220, y: 214, w: 220, h: 258 },
      docLabel: { x: 330, y: 530, size: 40 },
      tag: { cx: 112, cy: 270, w: 184, h: 62, size: 34 },
      button: { cx: 112, cy: 344, w: 192, h: 68, size: 33 },
      clockRest: { x: 112, y: 440 },
      gate: {
        postA: { x: 118, y: 616, w: 58, h: 244 }, postB: { x: 484, y: 616, w: 58, h: 244 },
        arm: { x: 176, y: 737, w: 308, h: 46 }, lamp: { cx: 513, cy: 648, r: 17 },
        plate: { cx: 330, cy: 760, w: 196, h: 64, size: 36 }, size: 40, armSize: 32,
      },
      gateC: { x: 330, y: 760 },
      halt: { x: 330, y: 653 },
      calendar: { x: 556, y: 616, w: 144, h: 244 },
      ghostRest: { x: 628, y: 906 },
      dropped: { x: 580, y: 704, w: 96, h: 60 },
      droppedTag: { cx: 628, cy: 822, w: 144, h: 56, size: 34 },
      tray: { x: 56, y: 912, w: 484, h: 264, r: 40 },
      trayLabel: { x: 88, y: 968, size: 40 },
      emblem: { cx: 504, cy: 956, r: 28 },
      saved: { x: 330, y: 1084 },
      keepTag: { cx: 160, cy: 1100, w: 176, h: 58, size: 34 },
      phone: { x: 566, y: 952, w: 126, h: 220, r: 22 },
      foot: { y: 1246, size: 20 },
      rest: [64, 84],
    };
  }

  function landscapeLayout() {
    return {
      DW: 1280, DH: 720, u: 0.9, tall: false,
      eyebrow: { x: 64, y: 58, size: 19 },
      badge: { x: 1216, y: 58, size: 22 },
      title: { x: 64, y: 120, size: 50, min: 34, max: 900 },
      doc: { x: 190, y: 200, w: 200, h: 235 },
      docLabel: { x: 290, y: 484, size: 34 },
      tag: { cx: 96, cy: 252, w: 160, h: 56, size: 32 },
      button: { cx: 290, cy: 550, w: 200, h: 62, size: 32 },
      clockRest: { x: 96, y: 350 },
      gate: {
        postA: { x: 500, y: 178, w: 200, h: 50 }, postB: { x: 500, y: 408, w: 200, h: 50 },
        arm: { x: 578, y: 228, w: 44, h: 180 }, lamp: { cx: 684, cy: 433, r: 14 },
        plate: { cx: 600, cy: 318, w: 180, h: 58, size: 34 }, size: 34, armSize: 30,
      },
      gateC: { x: 600, y: 318 },
      halt: { x: 512, y: 318 },
      calendar: { x: 510, y: 478, w: 180, h: 170 },
      ghostRest: { x: 466, y: 600 },
      dropped: { x: 562, y: 490, w: 88, h: 54 },
      droppedTag: { cx: 606, cy: 600, w: 150, h: 54, size: 32 },
      tray: { x: 770, y: 178, w: 300, h: 280, r: 36 },
      trayLabel: { x: 796, y: 226, size: 34 },
      emblem: { cx: 1036, cy: 216, r: 24 },
      saved: { x: 920, y: 330 },
      keepTag: { cx: 920, cy: 500, w: 168, h: 54, size: 32 },
      phone: { x: 1096, y: 234, w: 124, h: 224, r: 22 },
      foot: { y: 698, size: 18 },
      rest: [56, 64],
    };
  }

  const L = H >= W ? portraitLayout() : landscapeLayout();
  const S = Math.min(W / L.DW, H / L.DH);
  const OX = (W - L.DW * S) / 2;
  const OY = (H - L.DH * S) / 2;
  const u = (n) => n * L.u;
  const K_GATE = 0.6; // size of the travelling copy at the gate and in the tray
  const DOC_C = { x: L.doc.x + L.doc.w / 2, y: L.doc.y + L.doc.h / 2 };
  const boxAt = (cx, cy, k) => ({ x: cx - (L.doc.w * k) / 2, y: cy - (L.doc.h * k) / 2, w: L.doc.w * k, h: L.doc.h * k });
  const SAVED_BOX = boxAt(L.saved.x, L.saved.y, K_GATE);

  // --- Loading and checks ---------------------------------------------------------------------

  class CheckError extends Error {}
  function check(condition, message) {
    if (!condition) throw new CheckError(message);
  }
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isString = (v) => typeof v === "string" && v.length > 0;
  const obj = (v) => (isObject(v) ? v : {});
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const HEX64 = /^[0-9a-f]{64}$/;
  const int = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fileText = (value) => `${JSON.stringify(value, null, 2)}\n`;

  function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    if (isObject(a) && isObject(b)) {
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((k) => own(b, k) && deepEqual(a[k], b[k]));
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
      throw new CheckError(`${relative} を読み込めませんでした。作例のフォルダーをローカルの HTTP サーバーで開いてください。`);
    }
    check(response.ok, `${relative} を読み込めませんでした（HTTP ${response.status}）。`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
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

  const assetState = new Map(); // file → "match" | "mismatch"

  function showAssets() {
    const ok = ASSETS.filter((a) => assetState.get(a.file) === "match").length;
    ui.count.textContent = `${ok} / ${ASSETS.length}素材`;
    ui.count.dataset.state = ok === ASSETS.length ? "match" : [...assetState.values()].includes("mismatch") ? "mismatch" : "pending";
    const rows = ASSETS.map((asset) => {
      const li = document.createElement("li");
      const st = assetState.get(asset.file) || "pending";
      li.dataset.state = st;
      const name = document.createElement("code");
      name.textContent = asset.file;
      const verdict = document.createElement("span");
      verdict.className = "verdict";
      verdict.textContent = st === "match" ? "一致" : st === "mismatch" ? "不一致" : "照合前";
      const size = document.createElement("span");
      size.className = "bytes";
      size.textContent = `${int(asset.bytes)} バイト`;
      li.append(name, " ", verdict, " ", size);
      return li;
    });
    ui.assetList.replaceChildren(...rows);
  }

  // RIFF/WAVE, PCM 16-bit mono 48 kHz, exactly 33 s of samples.
  function parseWav(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    check(bytes.length >= 44 && tag(0) === "RIFF" && tag(8) === "WAVE", "narration.wav が WAV ではありません。");
    let o = 12;
    let fmt = null;
    let data = null;
    while (o + 8 <= bytes.length) {
      const id = tag(o);
      const size = dv.getUint32(o + 4, true);
      const body = o + 8;
      check(body + size <= bytes.length, "narration.wav のチャンクが途中で切れています。");
      if (id === "fmt ") {
        check(size >= 16, "narration.wav の fmt チャンクが短すぎます。");
        fmt = { format: dv.getUint16(body, true), channels: dv.getUint16(body + 2, true), rate: dv.getUint32(body + 4, true), bits: dv.getUint16(body + 14, true) };
      } else if (id === "data") {
        data = { offset: body, size };
      }
      o = body + size + (size & 1);
    }
    check(fmt && data && fmt.format === 1 && fmt.channels === 1 && fmt.rate === PIN.rate && fmt.bits === 16,
      "narration.wav が PCM16・モノラル・48000Hz ではありません。");
    check(data.size === DURATION * PIN.rate * 2, `narration.wav の長さが${DURATION}秒ではありません。`);
    return { dv, offset: data.offset, frames: data.size / 2 };
  }

  // The narration must actually be in the mix at each cue's place (RMS of the window).
  function checkCueSignal(pcm, cue) {
    const a = Math.round(cue.start * PIN.rate);
    const b = Math.min(pcm.frames, Math.round(cue.end * PIN.rate));
    check(a >= 0 && b > a, `ナレーション「${cue.id}」の位置が narration.wav に収まりません。`);
    let sum = 0;
    for (let i = a; i < b; i++) {
      const v = pcm.dv.getInt16(pcm.offset + 2 * i, true) / 32768;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (b - a));
    check(rms > 0.003, `narration.wav の${cue.start.toFixed(2)}〜${cue.end.toFixed(2)}秒に、ナレーション「${cue.id}」の音が見つかりません（RMS ${rms.toFixed(5)}）。`);
  }

  function lockEntries(lock, prefix, extra) {
    return lock.files
      .filter((f) => isObject(f) && isString(f.path) && f.path.startsWith(prefix))
      .map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes, [extra]: f[extra] }));
  }

  function verifyRecord(runs) {
    check(runs.format === PIN.format, "automation-runs.json の形式が違います。");
    const up = obj(runs.upstream);
    check(up.repository === PIN.repository && up.commit === PIN.commit && up.version === PIN.version && up.license === PIN.license
      && up.vendor_lock_sha256 === SHA["vendor-lock.json"] && Array.isArray(up.files) && up.files.length === PIN.originalFiles,
    "automation-runs.json の OpenHands の固定版が一致しません。");
    const dep = obj(runs.dependency);
    check(dep.name === PIN.dependency && dep.version === PIN.dependencyVersion && dep.license === PIN.license
      && dep.integrity === PIN.integrity && Array.isArray(dep.files) && dep.files.length === PIN.packageFiles,
    "automation-runs.json の @openhands/extensions の固定版が一致しません。");
    const sums = obj(runs.input_sha256);
    check(sums["input/automation-settings.json"] === SHA["automation-settings.json"] && sums["input/expected.json"] === SHA["expected.json"]
      && sums["vendor-lock.json"] === SHA["vendor-lock.json"], "記録が参照する入力・ロックの SHA-256 が素材と一致しません。");
    const results = runs.results;
    check(Array.isArray(results) && results.length === PIN.ids.length && results.every(isObject)
      && new Set(results.map((r) => r.id)).size === PIN.ids.length && results.every((r, i) => r.id === PIN.ids[i]),
    "automation-runs.json が O01〜O08 の8件（重複なし）ではありません。");
    for (const r of results) {
      if (r.accepted === true) {
        const rt = obj(r.roundtrip);
        check(isObject(r.file) && r.file.version === 1 && r.file.kind === "automation" && HEX64.test(r.file_sha256)
          && r.file_path === `outputs/exports/${r.id}.automation.json` && isString(r.filename) && isObject(r.parsed) && r.error === null
          && rt.reserialized_sha256 === r.file_sha256 && r.parsed.enabled === false, `${r.id} の形式OKの記録がそろっていません。`);
      } else {
        const e = obj(r.error);
        check(r.accepted === false && r.file === null && r.file_path === null && e.name === PIN.errorName
          && Array.isArray(e.issues) && e.issues.length > 0 && e.message === e.issues.join("\n"), `${r.id} の止まった記録がそろっていません。`);
      }
    }
    const accepted = results.filter((r) => r.accepted).map((r) => r.id);
    const rejected = results.filter((r) => !r.accepted).map((r) => r.id);
    check(deepEqual(runs.summary, { total: results.length, accepted: accepted.length, rejected: rejected.length })
      && deepEqual(runs.summary, PIN.summary), "automation-runs.json の件数のまとめが一致しません。");
    const v = obj(runs.verification);
    check(v.status === "passed" && Array.isArray(v.checks) && v.checks.length === PIN.checks && v.total === PIN.checks
      && v.checks.every((c) => isObject(c) && isString(c.name) && c.passed === true), `実行記録の${PIN.checks}件の確認がすべて合格になっていません。`);
    return { results, rows: new Map(results.map((r) => [r.id, r])), accepted, rejected };
  }

  // What the four scenes draw, taken from the verified rows. Anything else stops the film.
  function sceneFacts(rows) {
    const o3 = rows.get("O03");
    const o4 = rows.get("O04");
    const o6 = rows.get("O06");
    const o7 = rows.get("O07");
    const o1 = rows.get("O01");

    check(o1.accepted && obj(o1.observations.schedule).whitespace_fields === 5 && !Array.isArray(o1.input.repositories),
      "O01 の記録が「時刻あり・参照先1件で形式OK」になっていません。");
    check(!o3.accepted && o3.error.issues.length === 1 && o3.error.issues[0].startsWith("spec.trigger.schedule:")
      && deepEqual(o3.observations.issue_paths, ["spec.trigger.schedule"]) && !own(obj(obj(o3.input.spec).trigger), "schedule"),
    "O03 の記録が「時刻（schedule）の欠けで止まった1件」になっていません。");

    const repair = obj(o4.observations.repair);
    const restored = JSON.parse(JSON.stringify(o4.input));
    const trigger = obj(obj(restored.spec).trigger);
    const added = trigger.schedule;
    delete trigger.schedule;
    check(o4.accepted && repair.role === "repaired" && repair.partner === "O03" && Array.isArray(repair.input_diff)
      && repair.input_diff.length === 1 && repair.input_diff[0].path === "spec.trigger.schedule" && repair.input_diff[0].after === added
      && deepEqual(restored, o3.input) && o4.parsed.trigger.schedule === added,
    "O04 の記録が「O03 に時刻をひとつ戻しただけの設定」になっていません。");
    check(o4.file_path === PIN.o4.path && o4.filename === PIN.o4.filename && o4.file_sha256 === PIN.o4.sha256
      && new TextEncoder().encode(fileText(o4.file)).byteLength === PIN.o4.bytes,
    "O04 から書き出したファイルの名前・大きさ・SHA-256 が固定した値と一致しません。");

    const schedule = obj(o6.observations.schedule);
    check(o6.accepted && isString(schedule.value) && schedule.whitespace_fields !== 5 && schedule.accepted_by_parser === true
      && schedule.cron_grammar_validated === false && o6.parsed.trigger.schedule === schedule.value,
    "O06 の記録が「cron の形でない時刻でも形式OK」になっていません。");

    const repos = obj(o7.observations.repositories);
    const source = Array.isArray(repos.source) ? repos.source : [];
    check(o7.accepted && source.length === 2 && Array.isArray(repos.dropped) && repos.dropped.length === 1
      && deepEqual(repos.dropped[0], source[1]) && o7.file.spec.repository === source[0].url && o7.file.spec.branch === source[0].ref
      && !fileText(o7.file).includes(source[1].url) && repos.fetched === false,
    "O07 の記録が「参照先ふたつのうち先頭だけが残る」になっていません。");

    return { o4Filename: o4.filename, o4Sha: o4.file_sha256, schedule: schedule.value, references: source.length };
  }

  function verify(j, wavBytes) {
    const runs = j["automation-runs.json"];
    const settings = j["automation-settings.json"];
    const expected = j["expected.json"];
    const indep = j["independent-checks.json"];
    const repro = j["reproduction-checks.json"];
    const lock = j["vendor-lock.json"];
    const cues = j["narration-cues.json"];
    [runs, settings, expected, indep, repro, lock, cues].forEach((value) => check(isObject(value), "素材の JSON の形が想定と違います。"));

    const rec = verifyRecord(runs);

    // Lock: the same 12 + 29 files the record verified.
    check(lock.repository === PIN.repository && lock.commit === PIN.commit && lock.version === PIN.version && lock.license === PIN.license
      && isObject(lock.dependency) && lock.dependency.name === PIN.dependency && lock.dependency.version === PIN.dependencyVersion
      && lock.dependency.integrity === PIN.integrity && Array.isArray(lock.files) && lock.files.length === PIN.originalFiles + PIN.packageFiles,
    "vendor-lock.json の固定版・41ファイルが一致しません。");
    check(deepEqual(runs.upstream.files, lockEntries(lock, "vendor/openhands/", "git_blob_sha1"))
      && deepEqual(runs.dependency.files, lockEntries(lock, "vendor/extensions/", "npm_member")),
    "記録の原典・依存ファイルの照合が vendor-lock.json と一致しません。");

    // Inputs frozen before the run.
    check(settings.format === PIN.settingsFormat && settings.fictional === true && Array.isArray(settings.cases)
      && settings.cases.length === PIN.ids.length && settings.cases.every((c, i) => isObject(c) && c.id === PIN.ids[i]
        && deepEqual(c.input, rec.results[i].input) && c.mode === rec.results[i].mode),
    "automation-settings.json の8件の入力が、記録の入力と一致しません。");
    check(expected.case_count === PIN.ids.length && deepEqual(expected.accepted_ids, rec.accepted) && deepEqual(expected.rejected_ids, rec.rejected)
      && deepEqual(expected.repair_pair, ["O03", "O04"]) && expected.non_grammar_validation === "O06" && expected.first_repository_only === "O07",
    "expected.json（実行前の期待）が記録と一致しません。");

    // Independent audit and the fresh reproduction of the same record.
    check(indep.status === "passed" && indep.total === PIN.independent && Array.isArray(indep.checks) && indep.checks.length === PIN.independent
      && indep.checks.every((c) => isObject(c) && c.passed === true) && indep.run_sha256 === SHA["automation-runs.json"] && indep.human_approval === false,
    `independent-checks.json の${PIN.independent}件がすべて通った、この記録の照合になっていません。`);
    const portable = Array.isArray(repro.checks) ? repro.checks.filter((c) => isObject(c) && isString(c.name) && c.name.includes(".automation.json")) : [];
    check(repro.status === "passed" && repro.run_sha256 === SHA["automation-runs.json"] && Array.isArray(repro.checks)
      && repro.total === repro.checks.length && repro.checks.every((c) => isObject(c) && c.passed === true)
      && portable.length === rec.accepted.length && rec.accepted.every((id) => portable.some((c) => c.name.startsWith(`${id}.`)))
      && repro.human_approval === false,
    "reproduction-checks.json が、この記録と6つのファイルの再現になっていません。");

    // Cue sheet: five real TTS segments and six scenes, exactly as frozen.
    check(cues.format === "studio-yebisu-narration-cues-v1" && cues.case === MANIFEST.case && cues.duration === DURATION && cues.fps === 30
      && cues.frames === DURATION * 30 && cues.sample_rate === PIN.rate && cues.channels === 1 && cues.encoding === "PCM16"
      && cues.tts === PIN.tts && cues.tts_revision === PIN.ttsRevision && cues.listening_confirmed === false && cues.human_approval === false
      && Array.isArray(cues.cues) && cues.cues.length === CUE_PLAN.length && Array.isArray(cues.scenes) && cues.scenes.length === SCENE_PLAN.length,
    "narration-cues.json の形が想定と違います。");
    CUE_PLAN.forEach((plan, i) => {
      const c = cues.cues[i];
      check(isObject(c) && c.id === plan.id && c.text === plan.text && c.file === plan.file && c.sha256 === plan.sha256
        && Math.abs(c.start - plan.start) < 1e-9 && Math.abs(c.end - plan.end) < 1e-6 && Math.abs(c.start + c.duration - c.end) < 1e-6
        && c.sample_exact === true, `narration-cues.json のナレーション「${plan.id}」が固定した文・時刻と一致しません。`);
      if (i > 0) check(c.start >= cues.cues[i - 1].end, "ナレーションが重なっています。");
    });
    SCENE_PLAN.forEach((plan, i) => {
      const s = cues.scenes[i];
      check(isObject(s) && s.id === plan.id && s.in === plan.in && s.out === plan.out && s.label === plan.label && s.case === plan.case,
        `narration-cues.json の場面「${plan.id}」が固定した時刻・見出しと一致しません。`);
    });

    const pcm = parseWav(wavBytes);
    CUE_PLAN.forEach((cue) => checkCueSignal(pcm, cue));

    return { facts: sceneFacts(rec.rows), wav: wavBytes };
  }

  // --- Fonts -----------------------------------------------------------------------------------

  const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, "Noto Sans JP", Meiryo, system-ui, sans-serif';
  const font = (size, weight = 500) => `${weight} ${size}px ${SANS}`;

  async function loadFonts() {
    if (!document.fonts || typeof document.fonts.load !== "function") return;
    const sample = "OPENHANDS ・ 設定ファイルの作例 記録 設定を、持ち運ぶ 時刻がないと、止まる 時刻を戻して、保存 形式と、実行は別 参照先は、先頭だけ 図で確かめ、設定を保存 設定ファイル 形式の点検 保存ファイル 保存なし 時刻なし 時刻を戻す 止まる 形式OK 実行 別の確認 残らない 先頭だけ 保存済みの実行結果をもとにした図 STUDIO YEBISU O04.automation.json ? 0123456789";
    const specs = [font(58, 780), font(50, 780), font(40, 700), font(36, 750), font(34, 700), font(32, 700), font(30, 750), font(24, 700), font(20, 500), font(14, 600)];
    await Promise.all(specs.map((spec) => document.fonts.load(spec, sample).catch(() => [])));
    await document.fonts.ready;
  }

  async function load() {
    check(location.protocol !== "file:", FILE_MESSAGE);
    check(globalThis.crypto && crypto.subtle, "このブラウザーでは SHA-256 を計算できません。https か http://localhost で開いてください。");
    const manifestBytes = await fetchBytes(MANIFEST.path);
    const digest = await sha256Hex(manifestBytes);
    check(digest === MANIFEST.sha256, `manifest.json の SHA-256 が固定値と一致しません（読み込んだ値 ${digest}）。`);
    const manifest = parseJson(manifestBytes, "manifest.json");
    check(isObject(manifest) && manifest.format === MANIFEST.format && manifest.case === MANIFEST.case && Array.isArray(manifest.assets)
      && manifest.assets.length === ASSETS.length && ASSETS.every((a, i) => isObject(manifest.assets[i]) && manifest.assets[i].file === a.file
        && manifest.assets[i].sha256 === a.sha256 && manifest.assets[i].bytes === a.bytes),
    `manifest.json の${ASSETS.length}件の対象・SHA-256・バイト数が、この映像ソースに固定した値と一致しません。`);

    const bytes = {};
    const outcomes = await Promise.allSettled(ASSETS.map(async (asset) => {
      const data = await fetchBytes(`assets/${asset.file}`);
      const actual = await sha256Hex(data);
      const ok = actual === asset.sha256 && data.byteLength === asset.bytes;
      assetState.set(asset.file, ok ? "match" : "mismatch");
      showAssets();
      check(ok, `${asset.file} の SHA-256 またはバイト数が manifest.json と一致しません（読み込んだ値 ${actual}・${int(data.byteLength)} バイト）。`);
      bytes[asset.file] = data;
    }));
    const failed = outcomes.find((o) => o.status === "rejected");
    if (failed) throw failed.reason;

    const json = {};
    for (const asset of ASSETS) if (asset.file.endsWith(".json")) json[asset.file] = parseJson(bytes[asset.file], asset.file);
    let data;
    try {
      data = verify(json, bytes["narration.wav"]);
    } catch (error) {
      if (error instanceof CheckError) throw error;
      throw new CheckError(`素材の形が想定と違います（${error && error.message ? error.message : "不明"}）。`);
    }
    await loadFonts();
    const name = data.facts.o4Filename;
    const dot = name.indexOf(".");
    return { ...data, fileHead: dot > 0 ? name.slice(0, dot) : name, fileTail: dot > 0 ? name.slice(dot) : "" };
  }

  // --- Time helpers (all values derive from t) ------------------------------------------------

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const bump = (t, at) => Math.sin(Math.PI * ramp(t, at - 0.06, at + 0.22));
  const fadeIn = (t, a, b) => ease(ramp(t, a, b));
  const fadeOut = (t, a, b) => 1 - ramp(t, a, b);

  // Key times. Scene borders and narration come from the verified cue sheet; these are the picture beats inside them.
  const T = {
    relA: 0.9, relB: 3.9,
    sceneMiss: 5.0, clockOutA: 5.15, clockOutB: 5.85, missA: 6.2, missB: 7.4,
    backA: 9.3, backB: 9.9, tapFix: 10.2, clockInA: 10.3, clockInB: 11.0,
    repA: 11.3, repG: 12.0, repB: 12.9, tapSave: 13.45, flyA: 13.55, flyB: 14.35,
    limA: 16.0, limG: 16.75, limB: 17.5, ghostA: 18.3, ghostB: 19.3,
    repoA: 22.5, repoG: 23.6, detachA: 23.65, repoH: 24.1, detachB: 24.5, repoB: 25.1,
    compareA: 26.6, compareB: 29.4, finalA: 30.0, finalB: 30.5, pointFinal: 30.8,
  };

  // --- Drawing helpers ------------------------------------------------------------------------

  const C = {
    paper: "#f5f3eb",
    card: "#fffdf6",
    screen: "#efece2",
    ink: "#252c2a",
    muted: "#646a63",
    line: "#a6aba1",
    purple: "#8581ee",
    purpleDeep: "#6a65cd",
    purpleWash: "#e7e4f8",
    purpleFold: "#cfcaf3",
    purpleBar: "#bdb8ec",
    peach: "#f7a86e",
    peachLine: "#e0894f",
    peachWash: "#fbe0cb",
    peachDeep: "#a2522c",
    green: "#51a696",
    greenWash: "#deebe3",
    greenFold: "#cfe6dc",
    greenBar: "#b3d6c8",
    deep: "#325c50",
    lampIdle: "#c9c6bb",
    lampOk: "#6fd0b9",
    lampStop: "#f08a52",
    empty: "#7d9b8f",
  };

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  function mix(a, b, k) {
    const A = rgb(a);
    const B = rgb(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp01(k)))).join(",")})`;
  }

  let film = null;

  function rr(x, y, w, h, r) {
    const q = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + q, y);
    ctx.arcTo(x + w, y, x + w, y + h, q);
    ctx.arcTo(x + w, y + h, x, y + h, q);
    ctx.arcTo(x, y + h, x, y, q);
    ctx.arcTo(x, y, x + w, y, q);
    ctx.closePath();
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  }

  // One line of text; shrinks to fit `max` down to `min`. `halo` draws a paper outline first.
  function text(str, x, y, o = {}) {
    let size = o.size || 24;
    const weight = o.weight || 500;
    ctx.font = font(size, weight);
    if (o.max) {
      const min = o.min || size;
      while (size > min && ctx.measureText(str).width > o.max) {
        size -= 1;
        ctx.font = font(size, weight);
      }
    }
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = "alphabetic";
    if (o.spacing && "letterSpacing" in ctx) ctx.letterSpacing = o.spacing;
    if (o.halo) {
      ctx.lineJoin = "round";
      ctx.lineWidth = size * 0.32;
      ctx.strokeStyle = o.halo;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || C.ink;
    ctx.fillText(str, x, y);
    const width = ctx.measureText(str).width;
    if (o.spacing && "letterSpacing" in ctx) ctx.letterSpacing = "0px";
    return width;
  }

  function withAlpha(alpha, fn) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, alpha);
    fn();
    ctx.restore();
  }

  function scaled(cx, cy, k, fn) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate(-cx, -cy);
    fn();
    ctx.restore();
  }

  function pill(p, str, fill, alpha, k = 1) {
    withAlpha(alpha, () => {
      scaled(p.cx, p.cy, k, () => {
        rr(p.cx - p.w / 2, p.cy - p.h / 2, p.w, p.h, p.h / 2);
        ctx.fillStyle = fill;
        ctx.fill();
        text(str, p.cx, p.cy + p.size * 0.36, { size: p.size, weight: 700, color: C.card, align: "center" });
      });
    });
  }

  function leader(x1, y1, x2, y2, alpha, color = C.ink, dash = null) {
    withAlpha(alpha, () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = u(2.4);
      ctx.lineCap = "round";
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      circle(x2, y2, u(4));
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  // --- The document (input, travelling copy, saved file) -------------------------------------

  function docGeo(box, f2) {
    const { x, y, w, h } = box;
    const fy = y + 0.72 * h;
    const fh = 0.17 * h;
    const one = { x: x + 0.13 * w, w: 0.4 * w };
    const a = { x: x + 0.12 * w, w: 0.34 * w };
    return {
      clock: { cx: x + 0.28 * w, cy: y + 0.22 * h, r: 0.15 * w },
      f1: { x: lerp(one.x, a.x, f2), y: fy, w: lerp(one.w, a.w, f2), h: fh },
      f2: { x: x + 0.54 * w, y: fy, w: 0.34 * w, h: fh },
    };
  }

  function docPath(x, y, w, h, f) {
    const r = Math.min(w * 0.04, 8);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - f, y);
    ctx.lineTo(x + w, y + f);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // The clock piece: a conceptual "time" part, not a reading of the schedule. q = 1 shows "?".
  function drawClock(c, q, alpha, scale = 1) {
    withAlpha(alpha, () => {
      const r = c.r * scale;
      ctx.fillStyle = C.peach;
      circle(c.cx, c.cy, r);
      ctx.fill();
      ctx.fillStyle = C.card;
      circle(c.cx, c.cy, r * 0.7);
      ctx.fill();
      withAlpha(1 - q, () => {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = Math.max(1.5, r * 0.12);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(c.cx, c.cy);
        ctx.lineTo(c.cx, c.cy - r * 0.5);
        ctx.moveTo(c.cx, c.cy);
        ctx.lineTo(c.cx - r * 0.38, c.cy);
        ctx.stroke();
      });
      withAlpha(q, () => text("?", c.cx, c.cy + r * 0.37, { size: Math.max(8, r * 1.05), weight: 800, color: C.ink, align: "center" }));
    });
  }

  function drawSlot(c, alpha) {
    withAlpha(alpha, () => {
      ctx.fillStyle = "rgba(255,253,246,0.7)";
      circle(c.cx, c.cy, c.r);
      ctx.fill();
      ctx.strokeStyle = "#8a8f86";
      ctx.lineWidth = Math.max(1.4, c.r * 0.08);
      ctx.setLineDash([c.r * 0.28, c.r * 0.24]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawFolder(f, n, digit, o = {}) {
    withAlpha(o.alpha === undefined ? 1 : o.alpha, () => {
      const t = 0.2 * f.h;
      const r = Math.min(4, f.h * 0.12);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y + t);
      ctx.lineTo(f.x, f.y + r);
      ctx.arcTo(f.x, f.y, f.x + r, f.y, r);
      ctx.lineTo(f.x + 0.36 * f.w, f.y);
      ctx.lineTo(f.x + 0.46 * f.w, f.y + t);
      ctx.lineTo(f.x + f.w - r, f.y + t);
      ctx.arcTo(f.x + f.w, f.y + t, f.x + f.w, f.y + t + r, r);
      ctx.lineTo(f.x + f.w, f.y + f.h - r);
      ctx.arcTo(f.x + f.w, f.y + f.h, f.x + f.w - r, f.y + f.h, r);
      ctx.lineTo(f.x + r, f.y + f.h);
      ctx.arcTo(f.x, f.y + f.h, f.x, f.y + f.h - r, r);
      ctx.closePath();
      ctx.fillStyle = n === 1 ? C.greenFold : C.peachWash;
      ctx.fill();
      ctx.strokeStyle = n === 1 ? C.green : C.peachLine;
      ctx.lineWidth = Math.max(1.4, f.h * 0.06);
      if (o.dashed) ctx.setLineDash([f.h * 0.16, f.h * 0.12]);
      ctx.stroke();
      ctx.setLineDash([]);
      withAlpha(digit, () => text(String(n), f.x + f.w / 2, f.y + f.h * 0.86, { size: Math.max(8, f.h * 0.6), weight: 750, color: C.ink, align: "center" }));
    });
  }

  // o: { out, present, q, f2 (layout 0..1), keep2, digits, ring, alpha, shadow }
  function drawDoc(box, o) {
    withAlpha(o.alpha === undefined ? 1 : o.alpha, () => {
      const { x, y, w, h } = box;
      const f = 0.2 * w;
      const out = o.out || 0;
      if (o.shadow !== false) {
        ctx.save();
        ctx.fillStyle = "rgba(37,44,42,0.08)";
        docPath(x + w * 0.025, y + w * 0.04, w, h, f);
        ctx.fill();
        ctx.restore();
      }
      docPath(x, y, w, h, f);
      ctx.fillStyle = mix(C.purpleWash, C.card, out);
      ctx.fill();
      ctx.strokeStyle = mix(C.purple, C.green, out);
      ctx.lineWidth = Math.max(1.5, w * 0.012);
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w - f, y);
      ctx.lineTo(x + w - f, y + f);
      ctx.lineTo(x + w, y + f);
      ctx.closePath();
      ctx.fillStyle = mix(C.purpleFold, C.greenFold, out);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = mix(C.purpleBar, C.greenBar, out);
      const bar = (bx, by, bw, bh) => { rr(bx, by, bw, bh, bh / 2); ctx.fill(); };
      bar(x + 0.52 * w, y + 0.15 * h, 0.22 * w, 0.045 * h);
      bar(x + 0.52 * w, y + 0.25 * h, 0.16 * w, 0.045 * h);
      bar(x + 0.13 * w, y + 0.42 * h, 0.74 * w, 0.04 * h);
      bar(x + 0.13 * w, y + 0.51 * h, 0.74 * w, 0.04 * h);
      bar(x + 0.13 * w, y + 0.6 * h, 0.46 * w, 0.04 * h);
      const g = docGeo(box, o.f2 || 0);
      const present = o.present === undefined ? 1 : o.present;
      if (present < 1) drawSlot(g.clock, 1);
      drawClock(g.clock, o.q || 0, present);
      if (o.ring > 0.01) {
        withAlpha(o.ring, () => {
          ctx.strokeStyle = C.green;
          ctx.lineWidth = Math.max(2, w * 0.022);
          circle(g.clock.cx, g.clock.cy, g.clock.r * 1.32);
          ctx.stroke();
        });
      }
      drawFolder(g.f1, 1, o.digits || 0);
      const second = (o.f2 || 0) * (o.keep2 === undefined ? 1 : o.keep2);
      if (second > 0.01) drawFolder(g.f2, 2, o.digits || 0, { alpha: second });
    });
  }

  // --- State of each object at time t --------------------------------------------------------

  function dState(t) {
    const present = t < T.clockOutA || t >= T.clockInB ? 1 : 0;
    const q = fadeIn(t, 15.2, 15.7) * (1 - ease(ramp(t, 21.5, 21.9)));
    const f2 = fadeIn(t, 21.7, 22.3) * (1 - ease(ramp(t, T.finalA, T.finalB)));
    const ring = Math.sin(Math.PI * ramp(t, T.clockInB, 12.6));
    return { present, q, f2, digits: f2, ring };
  }

  function armOpen(t) {
    if (t < 5.1) return 1;
    if (t < 5.6) return 1 - inOut(ramp(t, 5.1, 5.6));
    if (t < 11.25) return 0;
    return inOut(ramp(t, 11.25, 11.7)); // open before the repaired copy reaches the arm
  }

  function lampColor(t) {
    const ok = (1 - ramp(t, 5.1, 5.3)) + ramp(t, 11.55, 11.75);
    const stop = ramp(t, 7.35, 7.5) * (1 - ramp(t, 9.3, 9.5));
    if (stop > 0) return mix(C.lampIdle, C.lampStop, stop);
    return mix(C.lampIdle, C.lampOk, clamp01(ok));
  }

  const plateAlpha = (t) => (t < 5.3 ? 1 - ramp(t, 5.0, 5.3) : fadeIn(t, 12.3, 12.6));

  // Accepted pass: doc → gate (a..g), hold (g..h), gate → tray (h..b).
  function pass(t, a, g, h, b) {
    if (t < a || t >= b) return null;
    const G = L.gateC;
    const Sv = L.saved;
    if (t < g) {
      const s = inOut(ramp(t, a, g));
      return { cx: lerp(DOC_C.x, G.x, s), cy: lerp(DOC_C.y, G.y, s), k: lerp(1, K_GATE, ease(ramp(t, a, g))), out: 0 };
    }
    if (t < h) return { cx: G.x, cy: G.y, k: K_GATE, out: 0 };
    const s = inOut(ramp(t, h, b));
    return { cx: lerp(G.x, Sv.x, s), cy: lerp(G.y, Sv.y, s), k: K_GATE, out: ease(ramp(t, h, h + 0.45 * (b - h))) };
  }

  // The travelling copy (null when it is not on the way).
  function pState(t) {
    const d = dState(t);
    let p = pass(t, T.relA, 2.4, 2.4, T.relB);
    if (p) return { ...p, cfg: { present: 1, q: 0, f2: 0 } };
    if (t >= T.missA && t < T.backB) {
      const Hp = L.halt;
      const back = L.tall ? [0, -1] : [-1, 0];
      if (t < T.missB) {
        const s = inOut(ramp(t, T.missA, T.missB));
        p = { cx: lerp(DOC_C.x, Hp.x, s), cy: lerp(DOC_C.y, Hp.y, s), k: lerp(1, K_GATE, ease(ramp(t, T.missA, T.missB))) };
      } else if (t < T.backA) {
        const dt = t - T.missB;
        const recoil = u(14) * Math.exp(-5 * dt) * Math.abs(Math.sin(dt * 14));
        p = { cx: Hp.x + back[0] * recoil, cy: Hp.y + back[1] * recoil, k: K_GATE };
      } else {
        const s = inOut(ramp(t, T.backA, T.backB));
        p = { cx: lerp(Hp.x, DOC_C.x, s), cy: lerp(Hp.y, DOC_C.y, s), k: lerp(K_GATE, 1, s), alpha: 1 - ramp(t, T.backB - 0.2, T.backB) };
      }
      return { ...p, out: 0, cfg: { present: 0, q: 0, f2: 0 } };
    }
    p = pass(t, T.repA, T.repG, T.repG, T.repB);
    if (p) return { ...p, cfg: { present: 1, q: 0, f2: 0 } };
    p = pass(t, T.limA, T.limG, T.limG, T.limB);
    if (p) return { ...p, cfg: { present: 1, q: 1, f2: 0 } };
    p = pass(t, T.repoA, T.repoG, T.repoH, T.repoB);
    if (p) {
      const layout = 1 - ease(ramp(t, T.repoH, T.repoH + 0.5));
      return { ...p, cfg: { present: 1, q: d.q, f2: layout, keep2: t < T.detachA ? 1 : 0, digits: 1 } };
    }
    return null;
  }

  // The saved file in the tray.
  function sState(t) {
    if (t < 5.45) return { alpha: 1 - ramp(t, 5.0, 5.45), cfg: { q: 0, digits: 0 }, pulse: Math.sin(Math.PI * ramp(t, T.relB, T.relB + 0.5)) };
    if (t < T.repB) return null;
    if (t < 15.4) return { alpha: 1 - ramp(t, 15.0, 15.4), cfg: { q: 0, digits: 0 }, pulse: 0 };
    if (t < T.limB) return null;
    if (t < 21.9) return { alpha: 1 - ramp(t, 21.5, 21.9), cfg: { q: 1, digits: 0 }, pulse: 0 };
    if (t < T.repoB) return null;
    return { alpha: 1, cfg: { q: 0, digits: 1 - ease(ramp(t, T.finalA, T.finalB)) }, pulse: 0 };
  }

  // --- Chrome and titles ----------------------------------------------------------------------

  function caseAt(t) {
    for (const s of SCENE_PLAN) if (t >= s.in && (t < s.out || s.last)) return s;
    return SCENE_PLAN[0];
  }

  function drawChrome(t) {
    text("OPENHANDS ・ 設定ファイルの作例", L.eyebrow.x, L.eyebrow.y, { size: L.eyebrow.size, weight: 600, color: C.muted, spacing: "2px" });
    // Which saved record the picture shows.
    for (const s of SCENE_PLAN) {
      const a = (s.in === 0 ? 1 : fadeIn(t, s.in, s.in + 0.3)) * (s.last ? 1 : fadeOut(t, s.out - 0.2, s.out));
      if (t < s.in - 0.01 || (!s.last && t >= s.out)) continue;
      withAlpha(a, () => {
        const str = `記録 ${s.case}`;
        const b = L.badge;
        ctx.font = font(b.size, 700);
        const w = ctx.measureText(str).width + u(32);
        const h = b.size * 1.7;
        rr(b.x - w, b.y - h * 0.68, w, h, h / 2);
        ctx.lineWidth = u(2);
        ctx.strokeStyle = C.ink;
        ctx.stroke();
        text(str, b.x - w / 2, b.y, { size: b.size, weight: 700, color: C.ink, align: "center" });
      });
    }
    text("保存済みの実行結果をもとにした図", L.tall ? 48 : 64, L.foot.y, { size: L.foot.size, weight: 500, color: C.muted });
    text("STUDIO YEBISU", L.DW - (L.tall ? 48 : 64), L.foot.y, { size: L.foot.size - 2, weight: 700, color: C.muted, align: "right", spacing: "3px" });
  }

  function drawTitles(t) {
    for (const s of SCENE_PLAN) {
      if (t < s.in || (t >= s.out && !s.last)) continue;
      const fin = s.in === 0 ? 1 : ease(ramp(t, s.in, s.in + 0.3));
      const fout = s.last ? 1 : 1 - ramp(t, s.out - 0.25, s.out);
      withAlpha(Math.min(fin, fout), () => {
        const dy = (1 - fin) * u(12);
        text(s.label, L.title.x, L.title.y + dy, { size: L.title.size, weight: 780, color: C.ink, max: L.title.max, min: L.title.min });
      });
    }
  }

  // --- Stations -------------------------------------------------------------------------------

  function drawFlow(t) {
    const open = armOpen(t);
    const before = C.purple;
    const after = mix(C.line, C.green, open);
    ctx.lineWidth = u(4);
    ctx.lineCap = "round";
    const seg = (x1, y1, x2, y2, color, dashed) => {
      ctx.strokeStyle = color;
      ctx.setLineDash(dashed ? [u(12), u(12)] : []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const chev = (x, y, color) => {
      const s = u(12);
      ctx.strokeStyle = color;
      ctx.lineJoin = "round";
      ctx.beginPath();
      if (L.tall) {
        ctx.moveTo(x - s, y - s / 2);
        ctx.lineTo(x, y + s / 2);
        ctx.lineTo(x + s, y - s / 2);
      } else {
        ctx.moveTo(x - s / 2, y - s);
        ctx.lineTo(x + s / 2, y);
        ctx.lineTo(x - s / 2, y + s);
      }
      ctx.stroke();
    };
    const G = L.gateC;
    if (L.tall) {
      seg(G.x, L.doc.y + L.doc.h + 74, G.x, G.y, before, false);
      seg(G.x, G.y, G.x, SAVED_BOX.y - 8, after, open < 0.5);
      chev(G.x, L.doc.y + L.doc.h + 104, before);
      chev(G.x, L.tray.y - 14, after);
    } else {
      seg(L.doc.x + L.doc.w + 10, G.y, G.x, G.y, before, false);
      seg(G.x, G.y, SAVED_BOX.x - 8, G.y, after, open < 0.5);
      chev(L.doc.x + L.doc.w + 60, G.y, before);
      chev(L.tray.x - 22, G.y, after);
    }
  }

  function stripes(x, y, w, h) {
    ctx.save();
    rr(x, y, w, h, u(6));
    ctx.clip();
    ctx.fillStyle = C.peach;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,253,246,0.72)";
    const step = u(30);
    const span = w + h;
    for (let s = -h; s < span; s += step) {
      ctx.beginPath();
      ctx.moveTo(x + s, y + h);
      ctx.lineTo(x + s + h, y);
      ctx.lineTo(x + s + h + step * 0.45, y);
      ctx.lineTo(x + s + step * 0.45, y + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    rr(x, y, w, h, u(6));
    ctx.strokeStyle = "#d98547";
    ctx.lineWidth = u(2);
    ctx.stroke();
  }

  function drawGate(t) {
    const G = L.gate;
    const open = armOpen(t);
    const a = G.arm;
    if (open < 0.995) {
      const k = 1 - open;
      if (L.tall) stripes(a.x, a.y, a.w * k, a.h);
      else stripes(a.x, a.y, a.w, a.h * k);
      const stop = ease(ramp(t, 7.35, 7.6)) * (1 - ramp(t, 9.3, 9.6)) * (k > 0.9 ? 1 : 0);
      withAlpha(stop, () => {
        if (L.tall) {
          rr(a.x + a.w / 2 - u(72), a.y + u(4), u(144), a.h - u(8), u(8));
          ctx.fillStyle = C.card;
          ctx.fill();
          text("止まる", a.x + a.w / 2, a.y + a.h / 2 + G.armSize * 0.36, { size: G.armSize, weight: 750, color: C.ink, align: "center" });
        } else {
          rr(a.x + u(4), a.y + a.h / 2 - u(66), a.w - u(8), u(132), u(8));
          ctx.fillStyle = C.card;
          ctx.fill();
          [..."止まる"].forEach((ch, i) => text(ch, a.x + a.w / 2, a.y + a.h / 2 - G.armSize * 1.05 + i * G.armSize * 1.1 + G.armSize * 0.36, { size: G.armSize, weight: 750, color: C.ink, align: "center" }));
        }
      });
    }
    for (const p of [G.postA, G.postB]) {
      ctx.save();
      ctx.shadowColor = "rgba(37,44,42,0.10)";
      ctx.shadowBlur = u(10);
      ctx.shadowOffsetY = u(4);
      rr(p.x, p.y, p.w, p.h, Math.min(p.w, p.h) / 2.2);
      ctx.fillStyle = C.purpleDeep;
      ctx.fill();
      ctx.restore();
    }
    const A = G.postA;
    if (L.tall) {
      [..."形式の点検"].forEach((ch, i) => text(ch, A.x + A.w / 2, A.y + 26 + i * 48 + G.size * 0.36, { size: G.size, weight: 700, color: C.card, align: "center" }));
    } else {
      text("形式の点検", A.x + A.w / 2, A.y + A.h / 2 + G.size * 0.36, { size: G.size, weight: 700, color: C.card, align: "center" });
    }
    ctx.fillStyle = lampColor(t);
    circle(G.lamp.cx, G.lamp.cy, G.lamp.r);
    ctx.fill();
    ctx.lineWidth = u(3);
    ctx.strokeStyle = C.card;
    ctx.stroke();
    const pl = G.plate;
    withAlpha(plateAlpha(t), () => {
      rr(pl.cx - pl.w / 2, pl.cy - pl.h / 2, pl.w, pl.h, pl.h / 2);
      ctx.fillStyle = C.deep;
      ctx.fill();
      text("形式OK", pl.cx, pl.cy + pl.size * 0.36, { size: pl.size, weight: 750, color: C.card, align: "center" });
    });
  }

  function emblem(t) {
    const e = L.emblem;
    const press = Math.max(bump(t, T.tapSave));
    ctx.fillStyle = press > 0.01 ? mix(C.card, C.deep, press) : C.card;
    circle(e.cx, e.cy, e.r);
    ctx.fill();
    ctx.lineWidth = u(2.5);
    ctx.strokeStyle = C.deep;
    ctx.stroke();
    const ink = press > 0.5 ? C.card : C.deep;
    const s = e.r * 0.45;
    ctx.strokeStyle = ink;
    ctx.lineWidth = u(3.5);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(e.cx, e.cy - s);
    ctx.lineTo(e.cx, e.cy + s * 0.55);
    ctx.moveTo(e.cx - s * 0.6, e.cy);
    ctx.lineTo(e.cx, e.cy + s * 0.6);
    ctx.lineTo(e.cx + s * 0.6, e.cy);
    ctx.moveTo(e.cx - s, e.cy + s * 1.05);
    ctx.lineTo(e.cx + s, e.cy + s * 1.05);
    ctx.stroke();
    // Final hold: the save mark is where the page's real download is.
    withAlpha(fadeIn(t, 30.6, 31.0), () => {
      ctx.strokeStyle = C.deep;
      ctx.lineWidth = u(3);
      circle(e.cx, e.cy, e.r + u(10));
      ctx.stroke();
    });
  }

  function drawTray(t, sv) {
    const tr = L.tray;
    rr(tr.x, tr.y, tr.w, tr.h, tr.r);
    ctx.fillStyle = C.greenWash;
    ctx.fill();
    text("保存ファイル", L.trayLabel.x, L.trayLabel.y, { size: L.trayLabel.size, weight: 700, color: C.deep });
    emblem(t);
    const shown = sv ? sv.alpha : 0;
    withAlpha(1 - shown, () => {
      const b = SAVED_BOX;
      rr(b.x, b.y, b.w, b.h, u(8));
      ctx.strokeStyle = C.empty;
      ctx.lineWidth = u(2.5);
      ctx.setLineDash([u(10), u(9)]);
      ctx.stroke();
      ctx.setLineDash([]);
      const none = fadeIn(t, 5.45, 5.8) * fadeOut(t, T.backA, T.backA + 0.3);
      withAlpha(none, () => text("保存なし", L.saved.x, L.saved.y + u(11), { size: L.tall ? 30 : 28, weight: 700, color: "#5d7368", align: "center" }));
    });
  }

  function drawSaved(t, sv) {
    if (!sv || sv.alpha <= 0.002) return;
    const k = 1 + 0.05 * sv.pulse;
    scaled(L.saved.x, L.saved.y, k, () => {
      drawDoc(SAVED_BOX, { out: 1, present: 1, q: sv.cfg.q, f2: 0, digits: sv.cfg.digits, alpha: sv.alpha });
    });
  }

  function drawPhone(t) {
    const p = L.phone;
    rr(p.x, p.y, p.w, p.h, p.r);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.lineWidth = u(3);
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    rr(p.x + p.w / 2 - u(16), p.y + u(12), u(32), u(6), u(3));
    ctx.fillStyle = C.ink;
    ctx.fill();
    const sc = { x: p.x + u(10), y: p.y + u(30), w: p.w - u(20), h: p.h - u(46) };
    rr(sc.x, sc.y, sc.w, sc.h, u(10));
    ctx.fillStyle = C.screen;
    ctx.fill();
    const landed = fadeIn(t, T.flyB, T.flyB + 0.3);
    withAlpha(1 - landed, () => {
      // Empty screen: where a saved file would go.
      const cx = sc.x + sc.w / 2;
      const cy = sc.y + sc.h * 0.42;
      ctx.strokeStyle = "#b9b5aa";
      ctx.lineWidth = u(3);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy - u(20));
      ctx.lineTo(cx, cy + u(12));
      ctx.moveTo(cx - u(12), cy);
      ctx.lineTo(cx, cy + u(12));
      ctx.lineTo(cx + u(12), cy);
      ctx.stroke();
    });
    withAlpha(landed, () => {
      const box = { x: sc.x + sc.w / 2 - u(30), y: sc.y + u(16), w: u(60), h: u(70) };
      drawDoc(box, { out: 1, present: 1, q: 0, f2: 0, shadow: false });
      text(film.fileHead, sc.x + sc.w / 2, sc.y + sc.h * 0.72, { size: L.tall ? 30 : 28, weight: 750, color: C.deep, align: "center", max: sc.w - u(8), min: 14 });
      text(film.fileTail, sc.x + sc.w / 2, sc.y + sc.h * 0.72 + u(26), { size: 14, weight: 600, color: C.muted, align: "center", max: sc.w - u(6), min: 9 });
    });
  }

  function drawCalendar(t) {
    const a = fadeIn(t, 17.6, 18.1) * fadeOut(t, 21.5, 21.9);
    withAlpha(a, () => {
      const c = L.calendar;
      rr(c.x, c.y, c.w, c.h, u(18));
      ctx.fillStyle = C.card;
      ctx.fill();
      ctx.strokeStyle = "#8a8f86";
      ctx.lineWidth = u(2.5);
      ctx.setLineDash([u(12), u(9)]);
      ctx.stroke();
      ctx.setLineDash([]);
      const cx = c.x + c.w / 2;
      if (L.tall) {
        text("実行", cx, c.y + 54, { size: 40, weight: 750, color: C.ink, align: "center" });
        ctx.fillStyle = "#ece9df";
        for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) { rr(c.x + 17 + k * 40, c.y + 74 + r * 30, 30, 22, 4); ctx.fill(); }
        drawSlot({ cx, cy: c.y + 168, r: 30 }, 1);
        text("別の確認", cx, c.y + c.h - 14, { size: 30, weight: 700, color: C.muted, align: "center", max: c.w - 8, min: 24 });
      } else {
        text("実行", cx, c.y + 44, { size: 34, weight: 750, color: C.ink, align: "center" });
        drawSlot({ cx: c.x + 50, cy: c.y + 94, r: 26 }, 1);
        ctx.fillStyle = "#ece9df";
        for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) { rr(c.x + 96 + k * 36, c.y + 70 + r * 28, 28, 20, 4); ctx.fill(); }
        text("別の確認", cx, c.y + c.h - 16, { size: 30, weight: 700, color: C.muted, align: "center", max: c.w - 8, min: 24 });
      }
    });
  }

  // The "?" clock lifts from the saved file but stays outside the run frame. No scheduler is drawn running.
  function drawGhostClock(t) {
    if (t < T.ghostA) return;
    const a = fadeIn(t, T.ghostA, T.ghostA + 0.2) * fadeOut(t, 21.5, 21.9);
    const from = docGeo(SAVED_BOX, 0).clock;
    const s = inOut(ramp(t, T.ghostA, T.ghostB));
    const float = t > T.ghostB ? u(5) * Math.sin(((t - T.ghostB) / 1.6) * Math.PI * 2) : 0;
    const x = lerp(from.cx, L.ghostRest.x, s);
    const y = lerp(from.cy, L.ghostRest.y, s) - Math.sin(Math.PI * s) * u(60) + float;
    drawClock({ cx: x, cy: y, r: from.r }, 1, a, lerp(1, 1.45, s));
  }

  // Clock leaving (O03) and coming back (O04).
  function drawFlyingClocks(t) {
    const g = docGeo(L.doc, 0).clock;
    if (t >= T.clockOutA && t < T.clockOutB) {
      const s = ease(ramp(t, T.clockOutA, T.clockOutB));
      drawClock({ cx: lerp(g.cx, L.clockRest.x, s), cy: lerp(g.cy, L.clockRest.y, s) + Math.sin(Math.PI * s) * u(-30), r: g.r }, 0, 1 - s, lerp(1, 0.7, s));
    }
    if (t >= T.clockInA && t < T.clockInB) {
      const s = inOut(ramp(t, T.clockInA, T.clockInB));
      const b = L.button;
      drawClock({ cx: lerp(b.cx, g.cx, s), cy: lerp(b.cy, g.cy, s) - Math.sin(Math.PI * s) * u(70), r: g.r }, 0, fadeIn(t, T.clockInA, T.clockInA + 0.15), lerp(0.6, 1, s));
    }
  }

  function drawFlyFile(t) {
    if (t < T.flyA || t >= T.flyB + 0.05) return;
    const s = inOut(ramp(t, T.flyA, T.flyB));
    const p = L.phone;
    const a = [L.saved.x, L.saved.y];
    const b = [p.x + p.w / 2, p.y + u(30) + u(16) + u(35)];
    const c = [lerp(a[0], b[0], 0.5), Math.min(a[1], b[1]) - u(L.tall ? 90 : 70)];
    const v = 1 - s;
    const x = v * v * a[0] + 2 * v * s * c[0] + s * s * b[0];
    const y = v * v * a[1] + 2 * v * s * c[1] + s * s * b[1];
    const k = lerp(K_GATE, 60 / L.doc.w, s);
    drawDoc(boxAt(x, y, k), { out: 1, present: 1, q: 0, f2: 0 });
  }

  // O07: the second reference leaves the copy at the gate and stays behind.
  function droppedRect(t) {
    const start = docGeo(boxAt(L.gateC.x, L.gateC.y, K_GATE), 1).f2;
    const d = L.dropped;
    const s = inOut(ramp(t, T.detachA, T.detachB));
    return { x: lerp(start.x, d.x, s), y: lerp(start.y, d.y, s), w: lerp(start.w, d.w, s), h: lerp(start.h, d.h, s), s };
  }

  function drawDropped(t) {
    if (t < T.detachA) return;
    const a = fadeOut(t, T.finalA, T.finalB);
    const r = droppedRect(t);
    withAlpha(a * lerp(1, 0.85, r.s), () => {
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate((-9 * Math.PI / 180) * r.s);
      ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      drawFolder(r, 2, 1, { dashed: r.s > 0.5 });
      ctx.restore();
    });
  }

  function drawTags(t, d) {
    const g = docGeo(L.doc, d.f2).clock;
    const tg = L.tag;
    const miss = fadeIn(t, 5.9, 6.2) * fadeOut(t, 9.35, 9.65);
    if (miss > 0) {
      if (L.tall) leader(tg.cx + tg.w / 2, tg.cy, g.cx - g.r - u(6), g.cy, miss);
      else leader(tg.cx + tg.w / 2, tg.cy, g.cx - g.r - u(6), g.cy, miss);
      pill(tg, "時刻なし", C.peachDeep, miss);
    }
    const btn = fadeIn(t, 9.45, 9.8) * fadeOut(t, 11.7, 12.1);
    pill(L.button, "時刻を戻す", C.deep, btn, 1 - 0.06 * bump(t, T.tapFix));

    const drop = fadeIn(t, 24.6, 24.9) * fadeOut(t, T.finalA, 30.4);
    pill(L.droppedTag, "残らない", C.peachDeep, drop);
    const keep = fadeIn(t, 25.3, 25.6) * fadeOut(t, T.finalA, 30.4);
    if (keep > 0) {
      const f = docGeo(SAVED_BOX, 0).f1;
      const k = L.keepTag;
      if (L.tall) leader(k.cx + k.w / 2, k.cy, f.x - u(6), f.y + f.h / 2, keep);
      else leader(k.cx, k.cy - k.h / 2, f.x + f.w / 2, SAVED_BOX.y + SAVED_BOX.h + u(6), keep);
      pill(k, "先頭だけ", C.deep, keep);
    }

    // 元の設定と見比べる：first folder ↔ saved folder, second folder ↔ the one left behind.
    const cmp = fadeIn(t, T.compareA, T.compareA + 0.4) * fadeOut(t, T.compareB - 0.4, T.compareB);
    if (cmp > 0) {
      const dg = docGeo(L.doc, d.f2);
      const sf = docGeo(SAVED_BOX, 0).f1;
      const dr = droppedRect(t);
      const ring = (f, color) => {
        rr(f.x - u(7), f.y - u(7), f.w + u(14), f.h + u(14), u(10));
        ctx.strokeStyle = color;
        ctx.lineWidth = u(4);
        ctx.stroke();
      };
      withAlpha(cmp, () => {
        ring(dg.f1, C.green);
        ring(sf, C.green);
        ring(dg.f2, C.peachLine);
        ring(dr, C.peachLine);
      });
      leader(dg.f2.x + dg.f2.w / 2, dg.f2.y + dg.f2.h + u(8), dr.x + dr.w / 2, dr.y - u(8), cmp * 0.9, C.peachLine, [u(10), u(9)]);
    }
  }

  // --- Pointer (illustrated fingertip showing how the saved page is used) -----------------------

  function pointerKeys() {
    const [rx, ry] = L.rest;
    const btn = [L.button.cx + u(40), L.button.cy + u(6)];
    const save = [L.emblem.cx, L.emblem.cy];
    const off = (p) => [p[0] + u(rx), p[1] + u(ry)];
    return [
      { t: 0, p: off(btn), a: 0 },
      { t: 9.6, p: off(btn), a: 0 },
      { t: T.tapFix - 0.12, p: btn, a: 1 },
      { t: T.tapFix + 0.35, p: btn, a: 1 },
      { t: T.tapFix + 0.8, p: off(btn), a: 0 },
      { t: T.tapSave - 0.6, p: off(save), a: 0 },
      { t: T.tapSave - 0.12, p: save, a: 1 },
      { t: T.tapSave + 0.4, p: save, a: 1 },
      { t: T.tapSave + 0.9, p: off(save), a: 0 },
      { t: 30.2, p: off(save), a: 0 },
      { t: T.pointFinal, p: save, a: 1 },
      { t: DURATION + 1, p: save, a: 1 },
    ];
  }

  function drawPointer(t) {
    const keys = pointerKeys();
    let x = keys[0].p[0];
    let y = keys[0].p[1];
    let a = 0;
    for (let i = 0; i < keys.length - 1; i++) {
      const k0 = keys[i];
      const k1 = keys[i + 1];
      if (t >= k0.t && t < k1.t) {
        const k = inOut((t - k0.t) / (k1.t - k0.t));
        x = lerp(k0.p[0], k1.p[0], k);
        y = lerp(k0.p[1], k1.p[1], k);
        a = lerp(k0.a, k1.a, k);
        break;
      }
    }
    for (const tap of [T.tapFix, T.tapSave]) {
      const k = ramp(t, tap, tap + 0.6);
      if (k > 0 && k < 1) {
        const at = tap === T.tapFix ? [L.button.cx + u(40), L.button.cy + u(6)] : [L.emblem.cx, L.emblem.cy];
        withAlpha((1 - k) * 0.55, () => {
          ctx.lineWidth = u(3);
          ctx.strokeStyle = C.ink;
          circle(at[0], at[1], u(24 + 44 * ease(k)));
          ctx.stroke();
        });
      }
    }
    if (a <= 0.002) return;
    const press = Math.max(bump(t, T.tapFix), bump(t, T.tapSave));
    const r = u(26) * (1 - 0.14 * press);
    withAlpha(a, () => {
      ctx.fillStyle = "rgba(37,44,42,0.2)";
      circle(x, y, r);
      ctx.fill();
      ctx.lineWidth = u(2.5);
      ctx.strokeStyle = "rgba(255,253,245,0.95)";
      ctx.stroke();
      ctx.fillStyle = "rgba(37,44,42,0.6)";
      circle(x, y, r * 0.4);
      ctx.fill();
    });
  }

  // --- Frame ------------------------------------------------------------------------------------

  function drawFrame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(S, 0, 0, S, OX, OY);
    const d = dState(t);
    const sv = sState(t);
    const p = pState(t);
    drawChrome(t);
    drawTitles(t);
    drawFlow(t);
    drawTray(t, sv);
    drawPhone(t);
    drawCalendar(t);
    drawGate(t);
    drawSaved(t, sv);
    drawDoc(L.doc, { out: 0, present: d.present, q: d.q, f2: d.f2, digits: d.digits, ring: d.ring });
    if (p) {
      drawDoc(boxAt(p.cx, p.cy, p.k), {
        out: p.out, present: p.cfg.present, q: p.cfg.q, f2: p.cfg.f2, keep2: p.cfg.keep2, digits: p.cfg.digits || 0, alpha: p.alpha,
      });
    }
    text("設定ファイル", L.docLabel.x, L.docLabel.y, { size: L.docLabel.size, weight: 700, color: C.ink, align: "center", halo: C.paper });
    drawDropped(t);
    drawGhostClock(t);
    drawFlyingClocks(t);
    drawFlyFile(t);
    drawTags(t, d);
    drawPointer(t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- Seek, preview and editor state -----------------------------------------------------------

  let current = 0;
  let isPlaying = false;
  let loading = false;
  let raf = 0;
  let audioClock = false;
  let startNow = 0;
  let startTime = 0;
  let audioUrl = "";

  const clampTime = (seconds) => {
    const value = Number(seconds);
    return Number.isFinite(value) ? Math.min(DURATION, Math.max(0, value)) : 0;
  };

  function showTime() {
    if (loading) ui.clock.textContent = "照合中";
    else if (!film) ui.clock.textContent = "映像なし（照合失敗）";
    else ui.clock.textContent = `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
  }

  function showNarration(t) {
    const cue = CUE_PLAN.find((c) => t >= c.start - 0.1 && t < c.end + 0.5);
    ui.narration.textContent = cue ? cue.text : "";
  }

  function paint(t) {
    if (!film) throw new Error("素材の照合が済んでいないため描けません。");
    current = t;
    drawFrame(t);
    ui.time.value = String(t);
    showTime();
    showNarration(t);
  }

  window.seek = (seconds) => {
    const t = clampTime(seconds);
    stop();
    return window.motionReady.then(() => paint(t));
  };

  function setPlaying(on) {
    isPlaying = on;
    ui.play.textContent = on ? "一時停止" : "再生";
    showTime();
  }

  // Seeking, reset and the end all stop here; audio never starts from a seek.
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    audioClock = false;
    if (!ui.audio.paused) ui.audio.pause();
    if (isPlaying) setPlaying(false);
  }

  function previewFrame(now) {
    if (!isPlaying) return;
    const t = Math.min(DURATION, audioClock && !ui.audio.paused ? ui.audio.currentTime : startTime + (now - startNow) / 1000);
    try {
      paint(t);
    } catch (error) {
      fail(error);
      return;
    }
    if (t >= DURATION - 1e-3) stop();
    else raf = requestAnimationFrame(previewFrame);
  }

  // Editor preview only: a user click starts the verified narration.wav and the picture follows its clock.
  function play() {
    if (RENDER || !film || loading) return;
    startTime = current >= DURATION - 0.05 ? 0 : current;
    startNow = performance.now();
    setPlaying(true);
    audioClock = false;
    if (audioUrl) {
      try {
        ui.audio.currentTime = startTime;
      } catch {
        // メタデータの前に位置を変えられないブラウザーでは、映像だけで続ける。
      }
      const attempt = ui.audio.play();
      audioClock = true;
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch((error) => {
          if (!isPlaying || (error && error.name === "AbortError")) return;
          audioClock = false;
          startTime = current;
          startNow = performance.now();
          ui.status.textContent = "音を再生できなかったため、映像だけを再生しています。";
        });
      }
    }
    raf = requestAnimationFrame(previewFrame);
  }

  function setControls(enabled) {
    for (const control of [ui.play, ui.reset, ui.mute, ui.time, ...ui.sceneList.querySelectorAll("button")]) control.disabled = !enabled;
  }

  function buildSceneList() {
    const items = SCENE_PLAN.map((s) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = true;
      button.dataset.time = String(s.read);
      const time = document.createElement("span");
      time.className = "scene-time";
      time.textContent = `${s.in}–${s.out}秒`;
      const label = document.createElement("span");
      label.textContent = `${s.label}（記録 ${s.case}）`;
      const note = document.createElement("span");
      note.className = "scene-note";
      note.textContent = s.note;
      button.append(time, label, note);
      button.addEventListener("click", () => {
        window.seek(Number(button.dataset.time)).catch(fail);
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

  function releaseAudio() {
    if (!ui.audio.paused) ui.audio.pause();
    if (ui.audio.getAttribute("src")) {
      ui.audio.removeAttribute("src");
      ui.audio.load();
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = "";
  }

  function fail(error) {
    stop();
    loading = false;
    film = null;
    releaseAudio();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ui.stage.hidden = true;
    ui.narration.textContent = "";
    setControls(false);
    const reason = error && error.message ? error.message : String(error);
    setState("error", "素材を確かめられなかったため、映像を描いていません。");
    ui.errorText.textContent = reason;
    ui.errorBox.hidden = false;
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
    releaseAudio();
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
    setState("loading", `素材${ASSETS.length}件の SHA-256 と記録を照合しています…`);
    showTime();
    const ready = load().then((data) => {
      loading = false;
      film = data;
      if (!RENDER) {
        audioUrl = URL.createObjectURL(new Blob([data.wav], { type: "audio/wav" }));
        ui.audio.src = audioUrl;
      }
      ui.stage.hidden = false;
      paint(current);
      setControls(true);
      setState("ready", "照合済み。再生すると、映像と同じ時刻で照合済みのナレーション（narration.wav）が鳴ります。");
      return true;
    });
    ready.catch(fail);
    window.motionReady = ready;
    return ready;
  }

  buildSceneList();
  ui.play.addEventListener("click", () => (isPlaying ? stop() : play()));
  ui.reset.addEventListener("click", () => {
    window.seek(0).catch(fail);
  });
  ui.mute.addEventListener("click", () => {
    const muted = ui.mute.getAttribute("aria-pressed") !== "true";
    ui.mute.setAttribute("aria-pressed", String(muted));
    ui.audio.muted = muted;
  });
  ui.time.addEventListener("input", () => {
    window.seek(ui.time.value).catch(fail);
  });
  ui.audio.addEventListener("ended", () => {
    if (isPlaying) {
      stop();
      if (film) paint(DURATION);
    }
  });
  ui.retry.addEventListener("click", () => {
    start();
  });
  start();
})();
