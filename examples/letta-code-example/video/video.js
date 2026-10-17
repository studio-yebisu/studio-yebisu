/*
 * Studio Yebisu — Letta Code 作例・解説動画（32秒・合成音声のナレーション）
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * One 2D canvas, painted from absolute time only (window.seek). Two native layouts:
 * 720×1280 portrait (main) and 1280×720 landscape. Other sizes reuse the nearer layout, scaled and centred.
 * Before window.motionReady resolves, assets/manifest.json must match its pinned SHA-256 and all eight listed
 * files must match their SHA-256 and byte counts. The run record, inputs, expectations, independent checks,
 * reproduction checks, lock and cue sheet are then cross-checked, and narration.wav is parsed (48 kHz mono PCM16,
 * exactly 32 s) and measured for signal inside each of the five cue windows. There is no built-in result data:
 * what the diagram shows (the missing guide in L02, the two staged changes kept, the separate L03 trial that saved,
 * the short commit hashes and stage counts) comes from the verified record. On any mismatch motionReady rejects,
 * the stage is hidden, controls are disabled and #retry loads again.
 * The book, guide card, memos, tray, gate and Git dots are explanatory drawings of saved results,
 * not measurements, screen recordings or a live agent at work.
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
  const POSTER_TIME = 19.4; // L02 kept: empty guide slot, broken links, two staged cards, closed gate, old dot, reason tag
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: [] };

  // --- Frozen expectations --------------------------------------------------------------------

  const MANIFEST = {
    path: "assets/manifest.json",
    sha256: "abbf435514814f5ad76120d4670f94035bd9c484401eacaaa626ecd335024653",
    format: "studio-yebisu-asset-lock-v1",
    case: "letta-code-example",
  };
  // Same order as the manifest. Paths are relative to video/assets/.
  const ASSETS = [
    { file: "expected.json", sha256: "0f61d8dd6a58b99100759421295ea24a7436a32cb91304111c78b0cb5227a1a8", bytes: 699 },
    { file: "independent-checks.json", sha256: "f94c34d001bbd4f7529b2d058b411401526a5885d87f06b5a874c50f9767d1c6", bytes: 2797 },
    { file: "memory-changes.json", sha256: "852d6c0708eb9c42d31f71ad6fc6f8fcb95849d0d1eb72f4094e60a3e20311e0", bytes: 27161 },
    { file: "memory-runs.json", sha256: "af6e58cb1f8ef95efc44ae266c51713aa1bad06bcc025cda5d42e4cd3bd49570", bytes: 167251 },
    { file: "narration-cues.json", sha256: "980eb6de5e6d6cd6fe2b9a5aca4ba5ce839676a6de395829c4c5bdb5818ebf96", bytes: 4916 },
    { file: "narration.wav", sha256: "cb7cf4c63d0e36e2c632c2d832025af0c294d53e0a962ea152b00b9cc88b1ef2", bytes: 3072044 },
    { file: "reproduction-checks.json", sha256: "574c2fb858278f6b9e47410da12d355e585bbd73457f8e7116b9dcd534ad0431", bytes: 709 },
    { file: "vendor-lock.json", sha256: "a62fbf74fa35f609756adf4b9ef2bbfcfe7e46cfd291058be455601bbc8d4d57", bytes: 2476 },
  ];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.file, a.sha256]));
  const PIN = {
    format: "studio-yebisu-letta-memory-runs-v1",
    inputFormat: "studio-yebisu-letta-memory-changes-v1",
    repository: "letta-ai/letta-code",
    commit: "316e4c0545b549c453e0f85cc81d3540404eff74",
    version: "0.34.14",
    license: "Apache-2.0",
    vendorFiles: 8,
    checks: 208,
    ids: ["L01", "L02", "L03", "L04", "L05", "L06", "L07", "L08"],
    summary: { total: 8, committed: 2, blocked: 6 },
    policy: { version: 1, maxDepth: 2, maxFileCharacters: 900, maxCoreMemoryCharacters: 1200, readOnlyFiles: ["persona.md"] },
    repairPair: ["L02", "L03"],
    guide: "bookclub/MEMORY.md",
    detail: "bookclub/schedule.md",
    tts: "Aratako/Irodori-TTS-v4.1-Small",
    ttsRevision: "2b28324dc263ed5e6638b3cf3dd94c82ead07b4b",
    rate: 48000,
  };
  // Fixed before this film was written (narration-cues.json). The film checks the cue sheet agrees exactly.
  const CUE_PLAN = [
    { id: "intro", text: "記憶のメモを変えたら、保存する前に点検します。", seed: 20261117, file: "audio/intro.wav", sha256: "e82cf0a287575160a2f1ac8f9e1e3314c613121ceef2d151454b6f7e1e7ab429", bytes: 391724, start: 0.8, duration: 4.08, end: 4.88 },
    { id: "missing", text: "案内のファイルがないと、保存は止まります。", seed: 20261118, file: "audio/missing.wav", sha256: "761ddb24608938f8924cd24baab28eab37f5e4a9fcbfc477fe557cdeda0ac984", bytes: 345644, start: 5.6, duration: 3.6, end: 9.2 },
    { id: "repair", text: "案内だけを戻した別の試行では、変更を保存できました。", seed: 20261119, file: "audio/repair.wav", sha256: "399878af56df81225ae53bdf5451a035507c1df25da88207765c3a7adb669a60", bytes: 460844, start: 9.9, duration: 4.8, end: 14.7 },
    { id: "retained", text: "止まった変更も、手元に残ります。理由を見て、必要なところを直します。", seed: 20261120, file: "audio/retained.wav", sha256: "cbcee3c71dd4003cf6990c670b24fb6e0c3f4c22531c30a518e23c6d0b753510", bytes: 668204, start: 15.4, duration: 6.96, end: 22.36 },
    { id: "limits", text: "点検に通っても、内容の正しさは、別の確認です。", seed: 20261121, file: "audio/limits.wav", sha256: "4019382752ba6073ee9bb9ba75fbcd3a09deac9f36d38386ee46dde6d8b8ce3d", bytes: 449324, start: 23.1, duration: 4.68, end: 27.78 },
  ];
  const SCENE_PLAN = [
    { id: "relation", in: 0, out: 5.3, label: "メモを変えたら、点検", case: "L01", badge: "記録 L01", read: 3.0, note: "関係の全体：ルート → 案内 → 2つの詳細、変更の台 → 点検の門 → Git の保存の点。門が形をたどる" },
    { id: "missing", in: 5.3, out: 9.6, label: "案内がないと、止まる", case: "L02", badge: "記録 L02", read: 8.6, note: "案内のカードが抜けて台へ。空いた枠と切れた線。変更2件は門で止まって戻り、Git は前の点のまま" },
    { id: "repair", in: 9.6, out: 15.1, label: "案内を戻した、別の試行", case: "L03", badge: "別の試行 L03", read: 14.2, note: "別のリポジトリの記録 L03：案内だけが枠に戻り、線がつながる。変更が門を通り、Git に新しい点" },
    { id: "retained", in: 15.1, out: 22.8, label: "止まっても、変更は残る", case: "L02", badge: "記録 L02", read: 19.4, note: "記録 L02 に戻る：止まった変更2件は台に残り、理由の札が空いた枠を指す" },
    { id: "limits", in: 22.8, out: 29, label: "点検と、正しさは別", case: "L03", badge: "別の試行 L03", read: 26.6, note: "形の点検は通っても、詳細メモの中身には「？」。正しさは別の確認" },
    { id: "save", in: 29, out: 32, label: "理由を見て、必要な所を直す", case: "L03", badge: "別の試行 L03", read: 31.0, note: "関係の全体と、実行記録の保存をそのまま見せる（3秒）", last: true },
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

  // --- Layouts (authored natively for each orientation; same geometry as the example page) ------

  function portraitLayout() {
    return {
      DW: 720, DH: 1280, u: 1, tall: true,
      eyebrow: { x: 48, y: 72, size: 22 },
      badge: { x: 672, y: 72, size: 26 },
      title: { x: 48, y: 158, size: 56, min: 40, max: 624 },
      foot: { y: 1246, size: 20 },
      root: { cx: 360, cy: 270, w: 178, h: 112 }, rootLabel: { x: 150, y: 284, size: 38 },
      slot: { cx: 360, cy: 452, w: 200, h: 120 }, guideLabel: { x: 150, y: 468, size: 44 },
      details: [{ cx: 168, cy: 640, w: 200, h: 134 }, { cx: 552, cy: 640, w: 200, h: 134 }], detailLabel: { x: 360, y: 656, size: 44 },
      tray: { x: 32, y: 792, w: 252, h: 318, r: 36 }, trayLabel: { x: 62, y: 852, size: 44 }, count: { cx: 244, cy: 832, r: 28, size: 32 },
      card: { w: 92, h: 116 }, trayX: { center: 158, a: 104, b: 214 }, trackY: 958, gateFront: 276,
      gate: {
        cx: 410, lintel: { x: 316, y: 800, w: 188, h: 54 },
        posts: [{ x: 330, y: 854, w: 22, h: 236 }, { x: 468, y: 854, w: 22, h: 236 }],
        barrier: { x: 352, y: 866, w: 116, h: 180 }, lamp: { cx: 476, cy: 827, r: 15 },
        labelX: 392, labelY: 841, labelSize: 40,
        plate: { cx: 410, cy: 958, w: 150, h: 62, size: 36 }, shape: { cx: 410, cy: 958, w: 120, h: 66, size: 40 },
      },
      git: { x: 606, labelY: 808, labelSize: 44, top: 836, bottom: 1100, oldY: 1056, oldR: 24, newY: 958, newR: 30, hashSize: 24 },
      rootLink: [360, 326, 360, 392],
      detailLinks: [[310, 512, 310, 548, 168, 540, 168, 573], [410, 512, 410, 548, 552, 540, 552, 573]],
      origin: [168, 707, 158, 792],
      guideCtrl: { x: 380, y: 860 },
      q: { r: 30, size: 40 },
      tags: {
        reason: { cx: 360, cy: 738, w: 236, h: 62, size: 36 },
        content: { cx: 360, cy: 738, w: 236, h: 62, size: 36 },
        keep: { cx: 158, cy: 1066, w: 150, h: 58, size: 34 },
        trial: { cx: 574, cy: 452, w: 200, h: 64, size: 36 },
        cta: { cx: 470, cy: 1166, w: 300, h: 66, size: 34 },
      },
    };
  }

  function landscapeLayout() {
    return {
      DW: 1280, DH: 720, u: 0.9, tall: false,
      eyebrow: { x: 64, y: 56, size: 19 },
      badge: { x: 1216, y: 56, size: 24 },
      title: { x: 64, y: 122, size: 50, min: 34, max: 900 },
      foot: { y: 698, size: 18 },
      root: { cx: 118, cy: 430, w: 150, h: 100 }, rootLabel: { x: 118, y: 524, size: 34 },
      slot: { cx: 318, cy: 430, w: 160, h: 104 }, guideLabel: { x: 318, y: 362, size: 40 },
      details: [{ cx: 520, cy: 286, w: 172, h: 120 }, { cx: 520, cy: 574, w: 172, h: 120 }], detailLabel: { x: 520, y: 444, size: 40 },
      tray: { x: 640, y: 236, w: 232, h: 388, r: 34 }, trayLabel: { x: 664, y: 290, size: 40 }, count: { cx: 836, cy: 274, r: 24, size: 28 },
      card: { w: 88, h: 112 }, trayX: { center: 756, a: 704, b: 808 }, trackY: 430, gateFront: 872,
      gate: {
        cx: 1002, lintel: { x: 912, y: 232, w: 180, h: 50 },
        posts: [{ x: 924, y: 282, w: 20, h: 318 }, { x: 1060, y: 282, w: 20, h: 318 }],
        barrier: { x: 944, y: 300, w: 116, h: 260 }, lamp: { cx: 1068, cy: 257, r: 13 },
        labelX: 988, labelY: 270, labelSize: 36,
        plate: { cx: 1002, cy: 430, w: 140, h: 58, size: 34 }, shape: { cx: 1002, cy: 430, w: 112, h: 60, size: 36 },
      },
      git: { x: 1180, labelY: 224, labelSize: 40, top: 250, bottom: 612, oldY: 552, oldR: 22, newY: 430, newR: 26, hashSize: 22 },
      rootLink: [193, 430, 238, 430],
      detailLinks: [[398, 410, 424, 410, 404, 286, 434, 286], [398, 450, 424, 450, 404, 574, 434, 574]],
      origin: [606, 286, 640, 330],
      guideCtrl: { x: 510, y: 470 },
      q: { r: 26, size: 36 },
      tags: {
        reason: { cx: 318, cy: 548, w: 214, h: 56, size: 34 },
        content: { cx: 318, cy: 548, w: 214, h: 56, size: 34 },
        keep: { cx: 756, cy: 560, w: 140, h: 54, size: 34 },
        trial: { cx: 318, cy: 290, w: 180, h: 56, size: 34 },
        cta: { cx: 1060, cy: 632, w: 300, h: 58, size: 34 },
      },
    };
  }

  const L = H >= W ? portraitLayout() : landscapeLayout();
  const S = Math.min(W / L.DW, H / L.DH);
  const OX = (W - L.DW * S) / 2;
  const OY = (H - L.DH * S) / 2;
  const u = (n) => n * L.u;
  const boxOf = (b) => ({ x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h });

  // --- Loading and checks ---------------------------------------------------------------------

  class CheckError extends Error {}
  function check(condition, message) {
    if (!condition) throw new CheckError(message);
  }
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isString = (v) => typeof v === "string" && v.length > 0;
  const obj = (v) => (isObject(v) ? v : {});
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const int = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const short = (commit) => (typeof commit === "string" ? commit.slice(0, 7) : "");

  function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    if (isObject(a) && isObject(b)) {
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((k) => own(b, k) && deepEqual(a[k], b[k]));
    }
    return false;
  }

  const changedPaths = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((p) => a[p] !== b[p]).sort();

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

  // RIFF/WAVE, PCM 16-bit mono 48 kHz, exactly 32 s of samples.
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

  const isChange = (c) => isObject(c) && isString(c.status) && isString(c.path);

  function verifyRecord(runs, lock) {
    check(runs.format === PIN.format, "memory-runs.json の形式が違います。");
    const up = obj(runs.upstream);
    check(up.repository === PIN.repository && up.commit === PIN.commit && up.version === PIN.version && up.license === PIN.license
      && up.vendor_lock_sha256 === SHA["vendor-lock.json"] && Array.isArray(up.files) && up.files.length === PIN.vendorFiles,
    "memory-runs.json の Letta Code の固定版が一致しません。");
    check(Array.isArray(lock.files) && deepEqual(up.files, lock.files.map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes, git_blob_sha1: f.git_blob_sha1 }))),
      "記録の原典8ファイルの照合が vendor-lock.json と一致しません。");
    const sums = obj(runs.input_sha256);
    check(sums["input/memory-changes.json"] === SHA["memory-changes.json"] && sums["input/expected.json"] === SHA["expected.json"]
      && sums["vendor-lock.json"] === SHA["vendor-lock.json"], "記録が参照する入力・ロックの SHA-256 が素材と一致しません。");
    check(deepEqual(runs.trusted_policy, PIN.policy), "記録の初期方針が、実行前に固定した値と一致しません。");
    const results = runs.results;
    check(Array.isArray(results) && results.length === PIN.ids.length && results.every(isObject)
      && new Set(results.map((r) => r.id)).size === PIN.ids.length && results.every((r, i) => r.id === PIN.ids[i]),
    "memory-runs.json が L01〜L08 の8件（重複なし）ではありません。");
    for (const r of results) {
      const git = obj(r.git_commit);
      check(typeof r.committed === "boolean" && isObject(r.input) && isObject(r.input.accepted_files) && isObject(r.input.proposed_files)
        && isObject(r.baseline) && isString(r.baseline.commit) && typeof git.exit_code === "number"
        && isString(git.head_before) && isString(git.head_after) && Array.isArray(git.reported_errors)
        && Array.isArray(git.staged_changes_before) && git.staged_changes_before.every(isChange)
        && Array.isArray(git.staged_changes_after) && git.staged_changes_after.every(isChange),
      `${r.id} の記録の形が想定と違います。`);
      const moved = git.head_after !== git.head_before;
      check(r.committed === (git.exit_code === 0) && r.committed === moved && git.head_before === r.baseline.commit
        && (r.committed ? git.staged_changes_after.length === 0 : git.staged_changes_after.length > 0),
      `${r.id} の commit の成否・HEAD・stage の記録が合いません。`);
    }
    const committed = results.filter((r) => r.committed).length;
    check(deepEqual(runs.summary, { total: results.length, committed, blocked: results.length - committed }) && deepEqual(runs.summary, PIN.summary),
      "memory-runs.json の件数のまとめが一致しません。");
    const v = obj(runs.verification);
    check(v.status === "passed" && Array.isArray(v.checks) && v.checks.length === PIN.checks && v.total === PIN.checks
      && v.checks.every((c) => isObject(c) && isString(c.name) && c.passed === true), `実行記録の${PIN.checks}件の確認がすべて合格になっていません。`);
    return { results, rows: new Map(results.map((r) => [r.id, r])) };
  }

  // What the six scenes draw, taken from the verified rows. Anything else stops the film.
  function sceneFacts(rows) {
    const G = PIN.guide;
    const D = PIN.detail;
    const l01 = rows.get("L01");
    const l02 = rows.get("L02");
    const l03 = rows.get("L03");
    const g1 = l01.git_commit;
    const g2 = l02.git_commit;
    const g3 = l03.git_commit;

    check(l01.committed && own(l01.input.proposed_files, G) && deepEqual(g1.staged_changes_before, [{ status: "M", path: D }]),
      "L01 の記録が「案内があり、詳細メモ1件だけを変えた変更」になっていません。");
    check(!l02.committed && g2.exit_code === 1 && g2.head_after === g2.head_before && !own(l02.input.proposed_files, G)
      && deepEqual(g2.staged_changes_after, [{ status: "D", path: G }, { status: "M", path: D }])
      && g2.reported_errors.length === 2 && g2.reported_errors.every((line) => typeof line === "string" && line.endsWith(`missing required index ${G}`)),
    "L02 の記録が「案内 bookclub/MEMORY.md を消して止まり、変更2件が stage に残った1件」になっていません。");
    check(l03.committed && g3.exit_code === 0 && g3.head_after !== g3.head_before && g3.parent_after === l03.baseline.commit
      && l03.baseline.commit === l02.baseline.commit && l01.baseline.commit === l02.baseline.commit
      && deepEqual(l03.input.accepted_files, l02.input.accepted_files)
      && deepEqual(changedPaths(l02.input.proposed_files, l03.input.proposed_files), [G])
      && l03.input.proposed_files[G] === l02.input.accepted_files[G]
      && deepEqual(g3.staged_changes_before, [{ status: "M", path: D }]) && g3.staged_changes_after.length === 0,
    "L03 の記録が「L02 と同じ変更で案内だけを残し、保存された別の試行」になっていません。");

    return {
      base: short(g2.head_before),
      saved: short(g3.head_after),
      counts: { l01: g1.staged_changes_before.length, l02: g2.staged_changes_after.length, l03: g3.staged_changes_before.length, l03After: g3.staged_changes_after.length },
    };
  }

  function verify(j, wavBytes) {
    const runs = j["memory-runs.json"];
    const changes = j["memory-changes.json"];
    const expected = j["expected.json"];
    const indep = j["independent-checks.json"];
    const repro = j["reproduction-checks.json"];
    const lock = j["vendor-lock.json"];
    const cues = j["narration-cues.json"];
    [runs, changes, expected, indep, repro, lock, cues].forEach((value) => check(isObject(value), "素材の JSON の形が想定と違います。"));

    check(lock.repository === PIN.repository && lock.commit === PIN.commit && lock.version === PIN.version && lock.license === PIN.license
      && Array.isArray(lock.files) && lock.files.length === PIN.vendorFiles, "vendor-lock.json の固定版・原典8ファイルが一致しません。");
    const rec = verifyRecord(runs, lock);

    // Inputs and expectations frozen before the run.
    check(changes.format === PIN.inputFormat && changes.fictional === true && deepEqual(changes.trusted_policy, PIN.policy)
      && Array.isArray(changes.cases) && changes.cases.length === PIN.ids.length
      && changes.cases.every((c, i) => isObject(c) && c.id === PIN.ids[i] && c.label === rec.results[i].label
        && deepEqual({ accepted_files: c.accepted_files, proposed_files: c.proposed_files }, rec.results[i].input)),
    "memory-changes.json の8件の入力が、記録の入力と一致しません。");
    check(isObject(expected.commit_success) && PIN.ids.every((id) => expected.commit_success[id] === rec.rows.get(id).committed)
      && expected.case_count === PIN.summary.total && expected.successful_commits === PIN.summary.committed
      && expected.blocked_commits === PIN.summary.blocked && deepEqual(expected.repair_pair, PIN.repairPair),
    "expected.json（実行前の期待）が記録と一致しません。");

    // Independent audit of the real repositories and the fresh reproduction of the same record.
    const hook = obj(runs.validator_script).sha256;
    check(indep.status === "passed" && indep.run_sha256 === SHA["memory-runs.json"] && indep.checks_in_runner === PIN.checks
      && indep.source_files === PIN.vendorFiles && deepEqual(indep.repair_pair_diff, [PIN.guide])
      && Array.isArray(indep.cases) && indep.cases.length === PIN.ids.length
      && indep.cases.every((c, i) => isObject(c) && c.id === PIN.ids[i] && c.committed === rec.results[i].committed
        && c.actual_git_head_and_index_checked === true && c.accepted_and_proposed_bytes_match === true && c.original_hook_sha256 === hook),
    "independent-checks.json が、この記録の8つの Git リポジトリの照合になっていません。");
    check(repro.status === "passed" && repro.cases === PIN.ids.length && repro.result_objects_identical === true
      && repro.entire_record_byte_identical === true && repro.original_sha256 === SHA["memory-runs.json"]
      && repro.reproduced_sha256 === SHA["memory-runs.json"] && repro.successful_commits === PIN.summary.committed
      && repro.blocked_commits === PIN.summary.blocked, "reproduction-checks.json が、この記録の全バイトの再現になっていません。");

    // Cue sheet: five real TTS segments and six scenes, exactly as frozen.
    check(cues.format === "studio-yebisu-narration-cues-v1" && cues.case === MANIFEST.case && cues.duration === DURATION && cues.fps === 30
      && cues.frames === DURATION * 30 && cues.sample_rate === PIN.rate && cues.channels === 1 && cues.encoding === "PCM16"
      && cues.tts === PIN.tts && cues.tts_revision === PIN.ttsRevision && cues.listening_confirmed === false && cues.human_approval === false
      && Array.isArray(cues.cues) && cues.cues.length === CUE_PLAN.length && Array.isArray(cues.scenes) && cues.scenes.length === SCENE_PLAN.length,
    "narration-cues.json の形が想定と違います。");
    CUE_PLAN.forEach((plan, i) => {
      const c = cues.cues[i];
      check(isObject(c) && c.id === plan.id && c.text === plan.text && c.seed === plan.seed && c.file === plan.file && c.sha256 === plan.sha256
        && c.bytes === plan.bytes && Math.abs(c.start - plan.start) < 1e-9 && Math.abs(c.duration - plan.duration) < 1e-9
        && Math.abs(c.end - plan.end) < 1e-9 && c.source_start === 0 && c.sample_exact === true,
      `narration-cues.json のナレーション「${plan.id}」が固定した文・時刻と一致しません。`);
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
  const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
  const font = (size, weight = 500) => `${weight} ${size}px ${SANS}`;

  async function loadFonts() {
    if (!document.fonts || typeof document.fonts.load !== "function") return;
    const sample = "LETTA CODE ・ 記憶の点検 記録 別の試行 L01 L02 L03 メモを変えたら、点検 案内がないと、止まる 案内を戻した、別の試行 止まっても、変更は残る 点検と、正しさは別 理由を見て、必要な所を直す ルート 案内 詳細 変更 点検 保存 止まる 残る 案内がない 中身は別 形 記録を保存 保存済みの実行結果をもとにした図 STUDIO YEBISU ? 0123456789";
    const specs = [font(56, 800), font(50, 800), font(44, 800), font(40, 800), font(36, 800), font(34, 800), font(32, 800), font(26, 700), font(22, 600), font(20, 500), `600 24px ${MONO}`];
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
    return data;
  }

  // --- Time helpers (all values derive from t) ------------------------------------------------

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const bump = (t, at, len = 0.5) => Math.sin(Math.PI * ramp(t, at - 0.05, at + len));

  // A value that holds between changes: steps are [start, end, target] in time order.
  function seq(t, start, steps, shape = inOut) {
    let v = start;
    for (const [a, b, to] of steps) {
      if (t < a) return v;
      if (t < b) return lerp(v, to, shape(ramp(t, a, b)));
      v = to;
    }
    return v;
  }

  // Picture beats. Scene borders and narration come from the verified cue sheet; these are the moves inside them.
  // Guide card: 0 = in its slot, 1 = staged as a deletion in the tray.
  const GUIDE_STEPS = [[5.6, 6.5, 1], [10.1, 11.0, 0], [15.5, 16.4, 1], [22.9, 23.7, 0]];
  const LINK_STEPS = [[6.0, 6.6, 0], [10.9, 11.5, 1], [16.1, 16.6, 0], [23.5, 23.9, 1]];
  const BARRIER_STEPS = [[7.35, 7.6, 1], [9.7, 10.1, 0], [16.3, 16.6, 1], [23.0, 23.3, 0]];
  const STOP_STEPS = [[7.6, 7.75, 1], [9.7, 9.9, 0], [16.55, 16.7, 1], [23.0, 23.2, 0]];
  const OK_STEPS = [[11.8, 12.0, 1], [15.3, 15.5, 0], [23.3, 23.5, 1]];
  const PLATE_STEPS = [[7.7, 7.9, 1], [9.7, 9.9, 0], [16.6, 16.8, 1], [22.9, 23.1, 0]];
  const DOT_STEPS = [[13.4, 13.85, 1], [15.3, 15.55, 0], [24.45, 24.85, 1]];
  const GHOST_STEPS = [[8.0, 8.4, 1], [9.7, 10.0, 0], [15.5, 15.9, 1], [23.0, 23.3, 0]];
  const KEPT_STEPS = [[7.8, 8.4, 1], [9.7, 10.0, 0], [16.6, 17.0, 1], [22.9, 23.2, 0]];
  const STOPLINE_STEPS = [[6.9, 7.7, 1], [9.7, 10.0, 0], [16.0, 16.6, 1], [22.9, 23.2, 0]];
  const PASS_STEPS = [[11.9, 13.5, 1], [15.3, 15.5, 0], [23.6, 24.6, 1]];
  // Change card along the track: C tray centre, B tray right slot, F in front of the gate, M gate, D Git dot.
  const CARD_KEYS = [[0, "C"], [5.8, "C"], [6.3, "B"], [6.9, "B"], [7.7, "F"], [7.75, "F"], [8.6, "B"], [10.4, "B"], [10.9, "C"],
    [11.9, "C"], [12.6, "M"], [13.5, "D"], [15.3, "D"], [16.3, "B"], [23.2, "B"], [23.6, "C"], [24.1, "M"], [24.6, "D"]];
  const COUNT_CHANGES = [6.4, 10.6, 13.5, 16.3, 23.3, 24.6];

  function cardPos(t) {
    const P = { C: L.trayX.center, B: L.trayX.b, F: L.gateFront, M: L.gate.cx, D: L.git.x };
    let x = P[CARD_KEYS[CARD_KEYS.length - 1][1]];
    for (let i = 0; i < CARD_KEYS.length - 1; i++) {
      const [ta, a] = CARD_KEYS[i];
      const [tb, b] = CARD_KEYS[i + 1];
      if (t < tb) {
        x = lerp(P[a], P[b], inOut(ramp(t, ta, tb)));
        break;
      }
    }
    if (t >= 7.7 && t < 8.1) x -= u(14) * Math.exp(-8 * (t - 7.7)) * Math.abs(Math.sin((t - 7.7) * 26));
    const near = L.gate.cx + u(80);
    const s = x <= near ? 1 : lerp(1, 0.32, ramp(x, near, P.D));
    const a = 1 - ramp(x, P.D - u(70), P.D - u(6));
    return { x, y: L.trackY, s, a };
  }

  function countAt(t) {
    const c = film.facts.counts;
    const values = [c.l01, c.l02, c.l03, c.l03After, c.l02, c.l03, c.l03After];
    let i = 0;
    while (i < COUNT_CHANGES.length && t >= COUNT_CHANGES[i]) i++;
    return values[i];
  }

  function stateAt(t) {
    const card = cardPos(t);
    const k = seq(t, 0, GUIDE_STEPS);
    return {
      k,
      attempt: t >= 6.9 && t < 8.6 ? card.x - L.trayX.b : 0,
      links: seq(t, 1, LINK_STEPS),
      barrier: seq(t, 0, BARRIER_STEPS, ease),
      stop: seq(t, 0, STOP_STEPS),
      ok: seq(t, 0, OK_STEPS),
      plate: seq(t, 0, PLATE_STEPS, ease),
      dot: seq(t, 0, DOT_STEPS, ease),
      ghost: seq(t, 0, GHOST_STEPS),
      kept: seq(t, 0, KEPT_STEPS),
      stopLine: seq(t, 0, STOPLINE_STEPS),
      pass: seq(t, 0, PASS_STEPS),
      card,
      count: countAt(t),
      countPulse: Math.max(...COUNT_CHANGES.map((at) => bump(t, at, 0.35))),
      // relation (scene 1): the edited memo, then the gate following the memory structure, then the order to Git
      edit: ramp(t, 0.9, 1.1) * (1 - ramp(t, 2.0, 2.3)),
      origin: ramp(t, 1.1, 1.4) * (1 - ramp(t, 2.2, 2.5)),
      cardBump: bump(t, 1.4, 0.4),
      scanLintel: ramp(t, 2.0, 2.3) * (1 - ramp(t, 3.3, 3.6)),
      scanRoot: ramp(t, 2.3, 2.6) * (1 - ramp(t, 4.4, 4.8)),
      scanDetail: ramp(t, 2.7, 3.0) * (1 - ramp(t, 4.4, 4.8)),
      route: ramp(t, 3.6, 4.8),
      routeAlpha: 1 - ramp(t, 4.9, 5.3),
      // retained (scene 4)
      trial: seq(t, 0, [[9.7, 10.0, 1], [15.1, 15.4, 0], [22.9, 23.2, 1]]),
      keep: seq(t, 0, [[16.8, 17.2, 1], [22.8, 23.1, 0]]),
      hopB: Math.sin(Math.PI * ramp(t, 17.2, 17.7)),
      hopA: Math.sin(Math.PI * ramp(t, 17.5, 18.0)),
      reason: seq(t, 0, [[18.4, 18.9, 1], [22.8, 23.1, 0]]),
      reasonDraw: ramp(t, 18.4, 19.0),
      fix: seq(t, 0, [[20.2, 20.5, 1], [22.8, 23.1, 0]]),
      fixDraw: ramp(t, 20.2, 21.0),
      slotPulse: t >= 19.8 && t < 23.1 ? (0.5 + 0.5 * Math.sin(((t - 19.8) / 1.1) * Math.PI * 2 - Math.PI / 2)) * (1 - ramp(t, 22.8, 23.1)) * ramp(t, 19.8, 20.1) : 0,
      // limits and save (scenes 5–6)
      shape: seq(t, 0, [[24.9, 25.3, 1]], ease),
      q: seq(t, 0, [[25.4, 25.8, 1]], ease),
      qBob: t > 25.8 ? u(4) * Math.sin(((t - 25.8) / 1.8) * Math.PI * 2) : 0,
      content: seq(t, 0, [[25.7, 26.1, 1]], ease),
      cta: seq(t, 0, [[28.5, 28.9, 1]], ease),
      ring: seq(t, 0, [[28.6, 29.0, 1]], ease),
    };
  }

  // --- Drawing helpers ------------------------------------------------------------------------

  const C = {
    paper: "#f5f3eb",
    card: "#fffdf6",
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
    warn: "#d99a72",
    green: "#51a696",
    greenWash: "#deebe3",
    deep: "#325c50",
    tray: "#ece8dc",
    trayKept: "#f4e7da",
    trayLine: "#d2cdbf",
    trayKeptLine: "#e2b896",
    slotLine: "#b9b5aa",
    future: "#b9c6bd",
    ghost: "#9fb3a8",
    lampIdle: "#c9c6bb",
    lampOk: "#6fd0b9",
    lampStop: "#f08a52",
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

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // One line of text; shrinks to fit `max` down to `min`. `halo` draws a paper outline first.
  function text(str, x, y, o = {}) {
    let size = o.size || 24;
    const weight = o.weight || 500;
    const family = o.mono ? MONO : SANS;
    const f = (s) => `${weight} ${s}px ${family}`;
    ctx.font = f(size);
    if (o.max) {
      const min = o.min || size;
      while (size > min && ctx.measureText(str).width > o.max) {
        size -= 1;
        ctx.font = f(size);
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

  // o: { outline, color }
  function pill(p, str, fill, alpha, o = {}) {
    withAlpha(alpha, () => {
      scaled(p.cx, p.cy, 0.9 + 0.1 * clamp01(alpha), () => {
        rr(p.cx - p.w / 2, p.cy - p.h / 2, p.w, p.h, p.h / 2);
        ctx.fillStyle = o.outline ? C.card : fill;
        ctx.fill();
        if (o.outline) {
          ctx.lineWidth = u(3);
          ctx.strokeStyle = fill;
          ctx.stroke();
        }
        text(str, p.cx + (o.dx || 0), p.cy + p.size * 0.36, { size: p.size, weight: 800, color: o.outline ? fill : C.card, align: "center" });
      });
    });
  }

  function bezPoint(c, t) {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = c;
    const v = 1 - t;
    return [v * v * v * x0 + 3 * v * v * t * x1 + 3 * v * t * t * x2 + t * t * t * x3, v * v * v * y0 + 3 * v * v * t * y1 + 3 * v * t * t * y2 + t * t * t * y3];
  }

  function strokeBez(c, a, b) {
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const [x, y] = bezPoint(c, a + ((b - a) * i) / 20);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  // --- Shapes ---------------------------------------------------------------------------------

  function memoPath(x, y, w, h, f) {
    const r = Math.min(10, w * 0.06);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - f, y);
    ctx.lineTo(x + w, y + f);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function bars(x, y, w, h, list) {
    const bh = Math.max(4, 0.075 * h);
    for (const [k, len, color] of list) {
      rr(x + 0.13 * w, y + k * h, len * w, bh, bh / 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  // A detail memo. edited: the line this change added (peach).
  function drawMemo(b, o = {}) {
    const { x, y, w, h } = boxOf(b);
    const f = 0.2 * Math.min(w, h);
    ctx.fillStyle = "rgba(37,44,42,0.07)";
    memoPath(x + 4, y + 7, w, h, f);
    ctx.fill();
    memoPath(x, y, w, h, f);
    ctx.fillStyle = C.purpleWash;
    ctx.fill();
    ctx.lineWidth = u(3);
    ctx.lineJoin = "round";
    ctx.strokeStyle = C.purple;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - f, y);
    ctx.lineTo(x + w - f, y + f);
    ctx.lineTo(x + w, y + f);
    ctx.closePath();
    ctx.fillStyle = C.purpleFold;
    ctx.fill();
    ctx.stroke();
    const list = [[0.3, 0.46, C.purpleBar], [0.48, 0.72, C.purpleBar], [0.66, 0.72, C.purpleBar]];
    if (o.edited) list.push([0.82, 0.56, C.peach]);
    bars(x, y, w, h, list);
  }

  // The root guide: a closed book with a ribbon.
  function drawBook(b) {
    const { x, y, w, h } = boxOf(b);
    rr(x + 4, y + 8, w, h, 12);
    ctx.fillStyle = "rgba(37,44,42,0.07)";
    ctx.fill();
    rr(x + 10, y + 9, w - 10, h - 9, 10);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.lineWidth = u(3);
    ctx.strokeStyle = C.purple;
    ctx.stroke();
    rr(x, y, w - 10, h - 8, 12);
    ctx.fillStyle = C.purpleWash;
    ctx.fill();
    ctx.strokeStyle = C.purpleDeep;
    ctx.stroke();
    const s = 0.17 * w;
    ctx.beginPath();
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s, y + h - 8);
    ctx.lineTo(x + 12, y + h - 8);
    ctx.quadraticCurveTo(x, y + h - 8, x, y + h - 20);
    ctx.lineTo(x, y + 12);
    ctx.quadraticCurveTo(x, y, x + 12, y);
    ctx.closePath();
    ctx.fillStyle = C.purpleDeep;
    ctx.fill();
    ctx.fillStyle = C.purpleBar;
    rr(x + 0.3 * w, y + 0.28 * h, 0.46 * w, 0.09 * h, 0.045 * h);
    ctx.fill();
    rr(x + 0.3 * w, y + 0.46 * h, 0.3 * w, 0.09 * h, 0.045 * h);
    ctx.fill();
    const rx = x + 0.7 * w;
    ctx.beginPath();
    ctx.moveTo(rx, y + h - 10);
    ctx.lineTo(rx, y + h - 10 + 0.24 * h);
    ctx.lineTo(rx + 0.045 * w, y + h - 10 + 0.17 * h);
    ctx.lineTo(rx + 0.09 * w, y + h - 10 + 0.24 * h);
    ctx.lineTo(rx + 0.09 * w, y + h - 10);
    ctx.closePath();
    ctx.fillStyle = C.peach;
    ctx.fill();
  }

  // The child guide (index card with a tab and two rows, one per detail memo). ghost: staged as a deletion.
  function drawIndex(b, ghost) {
    const { x, y, w, h } = boxOf(b);
    const g = ghost > 0.5;
    if (!g) {
      rr(x + 4, y + 8, w, h, 12);
      ctx.fillStyle = "rgba(37,44,42,0.07)";
      ctx.fill();
    }
    rr(x + 0.1 * w, y - 0.13 * h, 0.34 * w, 0.22 * h, 0.06 * h);
    ctx.fillStyle = mix(C.purpleDeep, C.warn, ghost);
    ctx.fill();
    rr(x, y, w, h, 12);
    ctx.fillStyle = g ? "rgba(255,253,246,0.7)" : C.card;
    ctx.fill();
    ctx.lineWidth = u(4);
    ctx.strokeStyle = mix(C.purpleDeep, C.peachDeep, ghost);
    if (g) ctx.setLineDash([u(9), u(7)]);
    ctx.stroke();
    ctx.setLineDash([]);
    const r = Math.min(0.055 * w, 0.07 * h);
    for (const k of [0.4, 0.72]) {
      circle(x + 0.18 * w, y + k * h, r);
      ctx.fillStyle = mix(C.purple, "#e7c6b0", ghost);
      ctx.fill();
      rr(x + 0.3 * w, y + k * h - 0.045 * h, 0.54 * w, 0.09 * h, 0.045 * h);
      ctx.fillStyle = mix(C.purpleBar, "#e7c6b0", ghost);
      ctx.fill();
    }
  }

  function drawBadgeEdit(cx, cy, r) {
    circle(cx, cy, r);
    ctx.fillStyle = C.peach;
    ctx.fill();
    ctx.lineWidth = u(3);
    ctx.strokeStyle = C.card;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = C.ink;
    rr(-0.62 * r, -0.17 * r, 0.9 * r, 0.34 * r, 0.06 * r);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.3 * r, -0.17 * r);
    ctx.lineTo(0.64 * r, 0);
    ctx.lineTo(0.3 * r, 0.17 * r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBadgeMinus(cx, cy, r) {
    circle(cx, cy, r);
    ctx.fillStyle = C.peachDeep;
    ctx.fill();
    ctx.lineWidth = u(3);
    ctx.strokeStyle = C.card;
    ctx.stroke();
    rr(cx - 0.5 * r, cy - 0.12 * r, r, 0.24 * r, 0.1 * r);
    ctx.fillStyle = C.card;
    ctx.fill();
  }

  // A staged change card (copy of the edited detail memo, with a pencil).
  function drawChangeCard(cx, cy, k) {
    const c = L.card;
    scaled(cx, cy, k, () => {
      drawMemo({ cx, cy, w: c.w, h: c.h }, { edited: true });
      drawBadgeEdit(cx - c.w / 2 + 4, cy - c.h / 2 + 4, c.w * 0.21);
    });
  }

  function stripes(x, y, w, h) {
    if (h <= 0.5) return;
    ctx.save();
    rr(x, y, w, h, u(8));
    ctx.clip();
    ctx.fillStyle = C.peach;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,253,246,0.72)";
    const step = u(34);
    for (let s = -w - h; s < w + h; s += step) {
      ctx.beginPath();
      ctx.moveTo(x + s, y + h);
      ctx.lineTo(x + s + h, y);
      ctx.lineTo(x + s + h + step * 0.42, y);
      ctx.lineTo(x + s + step * 0.42, y + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    rr(x, y, w, h, u(8));
    ctx.strokeStyle = "#d98547";
    ctx.lineWidth = u(3);
    ctx.stroke();
  }

  // --- Chrome and titles ----------------------------------------------------------------------

  function drawChrome(t) {
    text("LETTA CODE ・ 記憶の点検", L.eyebrow.x, L.eyebrow.y, { size: L.eyebrow.size, weight: 600, color: C.muted, spacing: "2px" });
    // Which saved record the picture shows.
    for (const s of SCENE_PLAN) {
      if (t < s.in - 0.01 || (!s.last && t >= s.out)) continue;
      const a = (s.in === 0 ? 1 : ramp(t, s.in, s.in + 0.3)) * (s.last ? 1 : 1 - ramp(t, s.out - 0.2, s.out));
      withAlpha(a, () => {
        const b = L.badge;
        const trial = s.badge.startsWith("別の試行");
        ctx.font = font(b.size, 800);
        const w = ctx.measureText(s.badge).width + u(36);
        const h = b.size * 1.7;
        rr(b.x - w, b.y - h * 0.68, w, h, h / 2);
        if (trial) {
          ctx.fillStyle = C.purpleDeep;
          ctx.fill();
        } else {
          ctx.lineWidth = u(2.5);
          ctx.strokeStyle = C.ink;
          ctx.stroke();
        }
        text(s.badge, b.x - w / 2, b.y, { size: b.size, weight: 800, color: trial ? C.card : C.ink, align: "center" });
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
        text(s.label, L.title.x, L.title.y + dy, { size: L.title.size, weight: 800, color: C.ink, max: L.title.max, min: L.title.min });
      });
    }
  }

  // --- The memory structure -------------------------------------------------------------------

  function drawLinks(st) {
    const broken = 1 - st.links;
    const r = L.rootLink;
    ctx.lineCap = "round";
    withAlpha(st.scanRoot, () => {
      ctx.strokeStyle = "rgba(133,129,238,0.35)";
      ctx.lineWidth = u(22);
      line(r[0], r[1], r[2], r[3]);
    });
    withAlpha(st.scanDetail, () => {
      ctx.strokeStyle = "rgba(133,129,238,0.35)";
      ctx.lineWidth = u(22);
      for (const c of L.detailLinks) strokeBez(c, 0, 1);
    });
    ctx.strokeStyle = mix(C.purple, C.warn, broken);
    ctx.lineWidth = u(6);
    line(r[0], r[1], r[2], r[3]);
    for (const c of L.detailLinks) {
      if (broken < 0.01) {
        ctx.strokeStyle = C.purple;
        ctx.lineWidth = u(6);
        strokeBez(c, 0, 1);
        continue;
      }
      const gap = 0.32 * broken;
      ctx.strokeStyle = mix(C.purple, C.peachDeep, broken);
      ctx.lineWidth = u(6 - broken);
      if (broken > 0.5) ctx.setLineDash([u(10), u(12)]);
      strokeBez(c, 0, 0.5 - gap / 2);
      strokeBez(c, 0.5 + gap / 2, 1);
      ctx.setLineDash([]);
      withAlpha(broken, () => {
        for (const at of [0.5 - gap / 2, 0.5 + gap / 2]) {
          const [x, y] = bezPoint(c, at);
          circle(x, y, u(7));
          ctx.fillStyle = C.paper;
          ctx.fill();
          ctx.lineWidth = u(4);
          ctx.strokeStyle = C.peachDeep;
          ctx.stroke();
        }
      });
    }
    // The edited detail memo is where the staged change came from.
    const o = L.origin;
    withAlpha(st.origin, () => {
      ctx.strokeStyle = "rgba(247,168,110,0.45)";
      ctx.lineWidth = u(16);
      line(o[0], o[1], o[2], o[3]);
    });
    ctx.strokeStyle = C.line;
    ctx.lineWidth = u(3);
    ctx.setLineDash([u(6), u(9)]);
    line(o[0], o[1], o[2], o[3]);
    ctx.setLineDash([]);
  }

  function drawSlot(st) {
    const b = boxOf(L.slot);
    const empty = 1 - st.links;
    rr(b.x, b.y, b.w, b.h, 14);
    ctx.fillStyle = "rgba(255,253,246,0.66)";
    ctx.fill();
    ctx.setLineDash([u(10), u(9)]);
    ctx.lineWidth = u(3 + empty + 4 * st.slotPulse);
    ctx.strokeStyle = mix(C.slotLine, C.peachDeep, Math.max(empty, st.slotPulse));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawStructure(t, st) {
    drawLinks(st);
    drawBook(L.root);
    text("ルート", L.rootLabel.x, L.rootLabel.y, { size: L.rootLabel.size, weight: 700, color: C.muted, align: "center" });
    drawSlot(st);
    L.details.forEach((d, i) => {
      drawMemo(d, { edited: i === 0 });
      if (i === 0) withAlpha(st.edit, () => drawBadgeEdit(d.cx - d.w / 2 + 6, d.cy - d.h / 2 + 6, u(26)));
      withAlpha(st.q, () => {
        const b = boxOf(d);
        const cx = b.x + b.w - 10;
        const cy = b.y + 4 + (i ? -st.qBob : st.qBob);
        scaled(cx, cy, 0.7 + 0.3 * st.q, () => {
          circle(cx, cy, L.q.r);
          ctx.fillStyle = C.peachWash;
          ctx.fill();
          ctx.lineWidth = u(4);
          ctx.strokeStyle = C.peach;
          ctx.stroke();
          text("?", cx, cy + L.q.size * 0.36, { size: L.q.size, weight: 900, color: C.ink, align: "center" });
        });
      });
    });
    text("案内", L.guideLabel.x, L.guideLabel.y, { size: L.guideLabel.size, weight: 800, color: C.ink, align: "center", halo: C.paper });
    text("詳細", L.detailLabel.x, L.detailLabel.y, { size: L.detailLabel.size, weight: 800, color: C.ink, align: "center", halo: C.paper });
  }

  // --- Stage tray, route, Git, gate -----------------------------------------------------------

  function drawTray(st) {
    const tr = L.tray;
    rr(tr.x, tr.y, tr.w, tr.h, tr.r);
    ctx.fillStyle = mix(C.tray, C.trayKept, st.kept);
    ctx.fill();
    ctx.lineWidth = u(3);
    ctx.strokeStyle = mix(C.trayLine, C.trayKeptLine, st.kept);
    ctx.stroke();
    text("変更", L.trayLabel.x, L.trayLabel.y, { size: L.trayLabel.size, weight: 800, color: C.ink });
    const c = L.count;
    scaled(c.cx, c.cy, 1 + 0.18 * st.countPulse, () => {
      circle(c.cx, c.cy, c.r);
      ctx.fillStyle = st.count > 0 && st.kept > 0.5 ? C.peachDeep : st.count > 0 ? C.ink : C.deep;
      ctx.fill();
      text(String(st.count), c.cx, c.cy + c.size * 0.36, { size: c.size, weight: 800, color: C.card, align: "center" });
    });
  }

  function drawRoute(st) {
    const y = L.trackY;
    const x0 = L.tray.x + L.tray.w;
    const x1 = L.git.x - L.git.newR;
    const gateA = L.gate.posts[0].x;
    ctx.lineCap = "round";
    ctx.lineWidth = u(5);
    ctx.strokeStyle = C.line;
    ctx.setLineDash([u(10), u(12)]);
    line(x0, y, x1, y);
    ctx.setLineDash([]);
    withAlpha(st.routeAlpha * (st.route > 0 ? 1 : 0), () => {
      ctx.strokeStyle = C.purple;
      ctx.lineWidth = u(6);
      line(x0, y, lerp(x0, x1, st.route), y);
    });
    if (st.stopLine > 0.01) {
      ctx.strokeStyle = C.purple;
      ctx.lineWidth = u(5);
      line(x0, y, lerp(x0, gateA, st.stopLine), y);
    }
    if (st.pass > 0.01) {
      ctx.strokeStyle = C.green;
      ctx.lineWidth = u(6);
      line(x0, y, lerp(x0, x1, st.pass), y);
    }
  }

  function drawGit(st) {
    const g = L.git;
    text("保存", g.x, g.labelY, { size: g.labelSize, weight: 800, color: C.ink, align: "center" });
    ctx.lineCap = "round";
    ctx.strokeStyle = C.deep;
    ctx.lineWidth = u(6);
    line(g.x, g.bottom, g.x, g.oldY);
    ctx.strokeStyle = C.future;
    ctx.lineWidth = u(5);
    ctx.setLineDash([u(8), u(10)]);
    line(g.x, g.oldY, g.x, g.top);
    ctx.setLineDash([]);
    withAlpha(st.dot, () => {
      ctx.strokeStyle = C.green;
      ctx.lineWidth = u(6);
      line(g.x, g.oldY, g.x, lerp(g.oldY, g.newY, st.dot));
    });
    withAlpha(st.ghost, () => {
      circle(g.x, g.newY, g.newR);
      ctx.fillStyle = C.paper;
      ctx.fill();
      ctx.lineWidth = u(4);
      ctx.setLineDash([u(8), u(7)]);
      ctx.strokeStyle = C.ghost;
      ctx.stroke();
      ctx.setLineDash([]);
    });
    circle(g.x, g.oldY, g.oldR);
    ctx.fillStyle = C.deep;
    ctx.fill();
    ctx.lineWidth = u(5);
    ctx.strokeStyle = C.card;
    ctx.stroke();
    text(film.facts.base, g.x, g.oldY + g.oldR + g.hashSize + 2, { size: g.hashSize, weight: 600, color: C.muted, align: "center", mono: true });
    if (st.dot > 0.002) {
      const k = st.dot + 0.22 * Math.sin(Math.PI * st.dot);
      circle(g.x, g.newY, g.newR * k);
      ctx.fillStyle = C.green;
      ctx.fill();
      ctx.lineWidth = u(5);
      ctx.strokeStyle = C.card;
      ctx.stroke();
      withAlpha(st.dot, () => text(film.facts.saved, g.x, g.newY + g.newR + g.hashSize + 2, { size: g.hashSize, weight: 800, color: C.deep, align: "center", mono: true }));
    }
    withAlpha(st.ring, () => {
      circle(g.x, g.newY, g.newR + u(14));
      ctx.lineWidth = u(4);
      ctx.strokeStyle = C.deep;
      ctx.stroke();
    });
  }

  function lampColor(st) {
    if (st.stop > 0.001) return mix(C.lampIdle, C.lampStop, st.stop);
    return mix(C.lampIdle, C.lampOk, st.ok);
  }

  function drawGate(st) {
    const G = L.gate;
    const b = G.barrier;
    stripes(b.x, b.y, b.w, b.h * st.barrier);
    for (const p of G.posts) {
      ctx.save();
      ctx.shadowColor = "rgba(37,44,42,0.10)";
      ctx.shadowBlur = u(10);
      ctx.shadowOffsetY = u(4);
      rr(p.x, p.y, p.w, p.h, p.w / 2);
      ctx.fillStyle = C.purpleDeep;
      ctx.fill();
      ctx.restore();
    }
    const li = G.lintel;
    withAlpha(st.scanLintel, () => {
      rr(li.x - u(12), li.y - u(12), li.w + u(24), li.h + u(24), u(24));
      ctx.fillStyle = "rgba(133,129,238,0.3)";
      ctx.fill();
    });
    rr(li.x, li.y, li.w, li.h, u(14));
    ctx.fillStyle = C.purpleDeep;
    ctx.fill();
    text("点検", G.labelX, G.labelY, { size: G.labelSize, weight: 800, color: C.card, align: "center" });
    circle(G.lamp.cx, G.lamp.cy, G.lamp.r);
    ctx.fillStyle = lampColor(st);
    ctx.fill();
    ctx.lineWidth = u(3);
    ctx.strokeStyle = C.card;
    ctx.stroke();
    const pl = G.plate;
    withAlpha(st.plate * (st.barrier > 0.9 ? 1 : 0), () => {
      rr(pl.cx - pl.w / 2, pl.cy - pl.h / 2, pl.w, pl.h, u(10));
      ctx.fillStyle = C.card;
      ctx.fill();
      ctx.lineWidth = u(3);
      ctx.strokeStyle = C.peachDeep;
      ctx.stroke();
      text("止まる", pl.cx, pl.cy + pl.size * 0.36, { size: pl.size, weight: 800, color: C.ink, align: "center" });
    });
    const sp = G.shape;
    withAlpha(st.shape, () => {
      scaled(sp.cx, sp.cy, 0.8 + 0.2 * st.shape, () => {
        rr(sp.cx - sp.w / 2, sp.cy - sp.h / 2, sp.w, sp.h, u(12));
        ctx.fillStyle = C.deep;
        ctx.fill();
        text("形", sp.cx - sp.w * 0.17, sp.cy + sp.size * 0.36, { size: sp.size, weight: 800, color: C.card, align: "center" });
        ctx.strokeStyle = C.card;
        ctx.lineWidth = u(7);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(sp.cx + sp.w * 0.06, sp.cy + 2);
        ctx.lineTo(sp.cx + sp.w * 0.15, sp.cy + 2 + sp.h * 0.17);
        ctx.lineTo(sp.cx + sp.w * 0.32, sp.cy + 2 - sp.h * 0.19);
        ctx.stroke();
      });
    });
  }

  // --- Moving cards ---------------------------------------------------------------------------

  function guideBox(st) {
    const k = st.k;
    const Sx = L.slot.cx;
    const Sy = L.slot.cy;
    const Ax = L.trayX.a;
    const Ay = L.trackY;
    const Q = L.guideCtrl;
    const v = 1 - k;
    const x = v * v * Sx + 2 * v * k * Q.x + k * k * Ax + (k > 0.999 ? st.attempt : 0);
    const y = v * v * Sy + 2 * v * k * Q.y + k * k * Ay - (k > 0.999 ? u(12) * st.hopA : 0);
    return { cx: x, cy: y, w: lerp(L.slot.w, L.card.w, k), h: lerp(L.slot.h, L.card.h * 0.8, k) };
  }

  function drawGuide(st) {
    const b = guideBox(st);
    drawIndex(b, st.k);
    withAlpha(ramp(st.k, 0.6, 1), () => drawBadgeMinus(b.cx - b.w / 2 + 4, b.cy - b.h / 2 + 4, L.card.w * 0.21));
  }

  function drawCard(st) {
    const c = st.card;
    if (c.a <= 0.002) return;
    const hop = u(12) * st.hopB;
    withAlpha(c.a, () => drawChangeCard(c.x, c.y - hop, c.s * (1 + 0.07 * st.cardBump)));
  }

  // --- Short tags -----------------------------------------------------------------------------

  function leader(x1, y1, x2, y2, color, dash) {
    ctx.strokeStyle = color;
    ctx.lineWidth = u(3);
    ctx.lineCap = "round";
    if (dash) ctx.setLineDash(dash);
    line(x1, y1, x2, y2);
    ctx.setLineDash([]);
    circle(x2, y2, u(5));
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawTags(st) {
    const T = L.tags;
    // Reason marker: from the stopped record back to the empty guide slot.
    if (st.reason > 0.002) {
      const tg = T.reason;
      const sb = boxOf(L.slot);
      const y1 = tg.cy - tg.h / 2;
      const y2 = sb.y + sb.h + u(6);
      withAlpha(st.reason, () => {
        if (st.reasonDraw > 0.01) leader(tg.cx, y1, tg.cx, lerp(y1, y2, st.reasonDraw), C.peachDeep);
        if (L.tall) {
          ctx.strokeStyle = C.peachDeep;
          ctx.lineWidth = u(3);
          ctx.setLineDash([u(5), u(6)]);
          line(tg.cx, tg.cy + tg.h / 2, tg.cx, L.gate.lintel.y);
          ctx.setLineDash([]);
        }
      });
      pill(tg, "案内がない", C.peachDeep, st.reason);
    }
    // Where to fix: a dotted path from the kept guide card back to its slot (a hint, not an edit).
    if (st.fix > 0.002 && st.fixDraw > 0.01) {
      withAlpha(st.fix, () => {
        const Q = L.guideCtrl;
        const A = { x: L.trayX.a, y: L.trackY - L.card.h * 0.4 - u(10) };
        const sb = boxOf(L.slot);
        const Sp = { x: L.slot.cx, y: sb.y + sb.h + u(4) };
        ctx.strokeStyle = C.peachDeep;
        ctx.lineWidth = u(4);
        ctx.lineCap = "round";
        ctx.setLineDash([u(2), u(12)]);
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const s = (st.fixDraw * i) / 24;
          const v = 1 - s;
          const x = v * v * A.x + 2 * v * s * Q.x + s * s * Sp.x;
          const y = v * v * A.y + 2 * v * s * Q.y + s * s * Sp.y;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
    pill(T.keep, "残る", C.peachDeep, st.keep, { outline: true });
    pill(T.trial, "別の試行", C.purpleDeep, st.trial);
    pill(T.content, "中身は別", C.ink, st.content);
    // The page's real action: save the selected record as JSON.
    const cta = T.cta;
    withAlpha(st.cta, () => {
      scaled(cta.cx, cta.cy, 0.9 + 0.1 * st.cta, () => {
        rr(cta.cx - cta.w / 2, cta.cy - cta.h / 2, cta.w, cta.h, cta.h / 2);
        ctx.fillStyle = C.deep;
        ctx.fill();
        const ix = cta.cx - cta.w / 2 + u(44);
        const s = cta.size * 0.45;
        ctx.strokeStyle = C.card;
        ctx.lineWidth = u(4);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(ix, cta.cy - s);
        ctx.lineTo(ix, cta.cy + s * 0.5);
        ctx.moveTo(ix - s * 0.6, cta.cy);
        ctx.lineTo(ix, cta.cy + s * 0.6);
        ctx.lineTo(ix + s * 0.6, cta.cy);
        ctx.moveTo(ix - s, cta.cy + s * 1.05);
        ctx.lineTo(ix + s, cta.cy + s * 1.05);
        ctx.stroke();
        text("記録を保存", cta.cx + u(22), cta.cy + cta.size * 0.36, { size: cta.size, weight: 800, color: C.card, align: "center" });
      });
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
    const st = stateAt(t);
    drawChrome(t);
    drawTitles(t);
    drawStructure(t, st);
    drawTray(st);
    drawRoute(st);
    drawGit(st);
    drawGate(st);
    drawGuide(st);
    drawCard(st);
    drawTags(st);
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
      label.textContent = `${s.label}（${s.badge}）`;
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
