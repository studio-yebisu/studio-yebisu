/*
 * Studio Yebisu — OpenVoice 作例・解説動画（36秒・実際の3つの音声）
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * One 2D canvas, painted from absolute time only (window.seek). Two native layouts:
 * 720×1280 portrait (main) and 1280×720 landscape. Other sizes reuse the nearer layout, scaled and centred.
 * Before window.motionReady resolves, assets/manifest.json must match its pinned SHA-256 and all eight listed
 * files must match their SHA-256 and byte counts. The records are then cross-checked, and the three cue windows
 * of comparison.wav are re-measured and compared with the recorded 0.1 s RMS. There is no built-in data:
 * waveforms, durations, cue times and the filename come from the verified files. On any mismatch motionReady
 * rejects, the stage is hidden, controls are disabled and #retry loads everything again.
 * The coloured forms and droplets are explanatory graphics; only the bars are measured audio.
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
  const DURATION = 36;
  const POSTER_TIME = 19.5;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: [] };

  // --- Frozen expectations --------------------------------------------------------------------

  const MANIFEST = {
    path: "assets/manifest.json",
    sha256: "ecc27c8ccbcef03db45d0b6fd64464d52fadb1e4a6fa55e2de36aadc8e718611",
    format: "studio-yebisu-asset-lock-v1",
    case: "openvoice-example",
  };
  // Same order as the manifest. Paths are relative to video/assets/.
  const ASSETS = [
  {
    "file": "audio-cues.json",
    "sha256": "34144e93728b268aa71eb15616bbb00358cbce19502ca0b93b45ee8f5c235e61",
    "bytes": 1600
  },
  {
    "file": "comparison.wav",
    "sha256": "2e67215623a3ed8f0ded08269e0da05302276908885a6f8e75601e933e65f14c",
    "bytes": 1587644
  },
  {
    "file": "independent-checks.json",
    "sha256": "af11b38caa5cd9d8a058b9a332176c3e1f6edf577145489f60f1a33612d047ff",
    "bytes": 13053
  },
  {
    "file": "model-lock.json",
    "sha256": "a8c97e5f61932d029ecdde2b628d3ee102909f476bc45e1fb0b17c864518181a",
    "bytes": 1484
  },
  {
    "file": "vendor-lock.json",
    "sha256": "53a17e009e9b0ba6545515523790bafb6946f4691bd93e7f53b4001a95e29e76",
    "bytes": 5130
  },
  {
    "file": "voice-requests.json",
    "sha256": "faf4d83cd845d9e0253e8c6fb94bbd0c1d10d1db81b8023c9b09445454cfc9e6",
    "bytes": 4549
  },
  {
    "file": "voice-runs.json",
    "sha256": "7ac84902b84b6bbad83f8fb7075ed5b5ccce4eb73c248a57367372d2ebe40d97",
    "bytes": 40578
  },
  {
    "file": "watermark-lock.json",
    "sha256": "ff9770637114cef87c4570bb051f155b5a3bd2075677109099cbd550d103b9cc",
    "bytes": 3275
  }
];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.file, a.sha256]));
  const PIN = {
    repository: "myshell-ai/OpenVoice",
    commit: "74a1d147b17a8c3092dd5430504bd83ef6c7eb23",
    model: "myshell-ai/OpenVoiceV2",
    revision: "f36e7edfe1684461a8343844af60babc2efbb727",
    vendorFiles: 23,
    checks: 83,
    independent: 116,
    message: "SYEBISU!",
    wavmark: "0.0.3",
    wavmarkRevision: "0ad3c7b74f641bddb61f6b85cdf2de0d93a5bfef",
    rate: 22050,
    bin: 2205,
  };
  const CASES = {
    V01: { source: "welcome", reference: "ichiro", output: "outputs/welcome-ichiro.wav" },
    V02: { source: "closing", reference: "ichiro", output: "outputs/closing-ichiro.wav" },
    V03: { source: "welcome", reference: "sayaka", output: "outputs/welcome-sayaka.wav" },
  };
  const VOICES = {
    welcome: { role: "source", path: "input/welcome.wav" },
    closing: { role: "source", path: "input/closing.wav" },
    ichiro: { role: "reference", path: "input/reference-ichiro.wav" },
    sayaka: { role: "reference", path: "input/reference-sayaka.wav" },
  };
  // Fixed before the mix was made (audio-cues.json); the film checks the cue sheet agrees.
  const CUE_PLAN = [
    { role: "source", file: "input/welcome.wav", start: 3.0, excerpt: false },
    { role: "reference", file: "input/reference-ichiro.wav", start: 13.5, excerpt: true, duration: 3.5, fade: 0.02 },
    { role: "output", file: "outputs/welcome-ichiro.wav", start: 17.5, excerpt: false },
  ];
  const SOURCE_LABEL = "ようこそ案内";
  const FILE_MESSAGE = "このページをファイルとして直接開くと、素材を読み込んで照合できません。作例のフォルダー（index.html のある場所）で python -m http.server を実行し、http://localhost:8000/video/ を開いてください。";

  // --- Scenes (editor list and on-film titles) ---------------------------------------------------

  const SCENES = [
    { in: 0, out: 2.9, read: 1.4, title: "声色だけを、着替える", sub: "", note: "関係の全体：元の音声＋見本 → OpenVoice → 変換後" },
    { in: 2.9, out: 13.2, read: 8.2, title: "ことばは、元の音声から", sub: "実際の入力音声", note: "元の音声（実音・全体）" },
    { in: 13.2, out: 17.3, read: 15.6, title: "声色は、見本から", sub: "実際の見本・3.5秒", note: "見本の声・抜粋（実音・3.5秒）" },
    { in: 17.3, out: 27.4, read: 19.5, title: "重ねると、変換後", sub: "実際の変換結果", note: "重なって変換後へ（実音・全体）" },
    { in: 27.4, out: 31.4, read: 30.6, title: "見本を替えると", sub: "保存済みの変換結果", note: "明るい声 を選ぶ（保存済みの結果・音なし）" },
    { in: 31.4, out: 36, read: 35, title: "聞き比べて、保存", sub: "作例ページで聞けます", note: "WAV を保存（終わりの静止2秒以上）", last: true },
  ];

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
    const src = { x: 48, y: 262, w: 296, h: 228, r: 62 };
    const ref = { x: 376, y: 262, w: 296, h: 228, r: 62 };
    return {
      DW: 720, DH: 1280, u: 1, tall: true,
      eyebrow: { x: 48, y: 82, size: 21 },
      title: { x: 48, y: 156, size: 58, min: 40, max: 624 },
      sub: { x: 48, y: 204, size: 26, max: 624 },
      src, ref,
      srcWave: { x: src.x + 30, y: src.y + 44, w: src.w - 60, h: 104 },
      refWave: { x: ref.x + 30, y: ref.y + 44, w: ref.w - 60, h: 104 },
      srcPlay: { cx: src.x + src.w - 44, cy: src.y + src.h - 42, r: 26 },
      refPlay: { cx: ref.x + ref.w - 44, cy: ref.y + ref.h - 42, r: 26 },
      plus: { x: 360, y: 386, size: 30 },
      srcLabel: { x: 196, y: 544, size: 34, align: "center" },
      srcCaption: { x: 196, y: 586, size: 24, align: "center" },
      refLabel: { x: 524, y: 544, size: 34, align: "center" },
      chips: { x: 379, y: 562, w: 140, h: 52, gap: 10, size: 22 },
      pathA: [[196, 612], [196, 690], [290, 694], [312, 720]],
      pathB: [[524, 630], [524, 690], [430, 694], [408, 720]],
      proc: { cx: 360, cy: 806, r: 96, sep: 34, cr: 58 },
      procLabel: { x: 360, y: 940, size: 26 },
      pathOut: [[360, 954], [360, 966], [360, 980], [360, 996]],
      out: { x: 48, y: 1004, w: 624, h: 204, r: 44 },
      outHead: { x: 84, y: 1056, size: 34 },
      save: { cx: 628, cy: 1044, r: 25 },
      outWave: { x: 84, y: 1080, w: 436, h: 78 },
      play: { cx: 592, cy: 1124, r: 38 },
      outCaption: { x: 84, y: 1190, size: 22 },
      phone: { x: 544, y: 666, w: 128, h: 232, r: 24 },
      foot: { y: 1250, size: 19 },
      bars: { src: 34, ref: 40, out: 60 },
      rest: [64, 84],
    };
  }

  function landscapeLayout() {
    const src = { x: 64, y: 206, w: 300, h: 164, r: 50 };
    const ref = { x: 64, y: 436, w: 300, h: 164, r: 50 };
    return {
      DW: 1280, DH: 720, u: 0.9, tall: false,
      eyebrow: { x: 64, y: 64, size: 19 },
      title: { x: 64, y: 124, size: 52, min: 38, max: 720 },
      sub: { x: 64, y: 166, size: 23, max: 720 },
      src, ref,
      srcWave: { x: src.x + 28, y: src.y + 26, w: src.w - 56, h: 74 },
      refWave: { x: ref.x + 28, y: ref.y + 26, w: ref.w - 56, h: 74 },
      srcPlay: { cx: src.x + src.w - 38, cy: src.y + src.h - 34, r: 23 },
      refPlay: { cx: ref.x + ref.w - 38, cy: ref.y + ref.h - 34, r: 23 },
      plus: { x: 404, y: 403, size: 28 },
      srcLabel: { x: 64, y: 408, size: 30, align: "left" },
      srcCaption: { x: null, y: 408, size: 22, align: "left" },
      refLabel: { x: 64, y: 638, size: 30, align: "left" },
      chips: { x: null, y: 610, w: 122, h: 46, gap: 8, size: 20 },
      pathA: [[364, 288], [468, 288], [512, 326], [556, 350]],
      pathB: [[364, 518], [468, 518], [512, 480], [556, 456]],
      proc: { cx: 640, cy: 403, r: 100, sep: 36, cr: 60 },
      procLabel: { x: 640, y: 540, size: 26 },
      pathOut: [[742, 403], [762, 403], [784, 403], [806, 403]],
      out: { x: 814, y: 262, w: 402, h: 282, r: 44 },
      outHead: { x: 848, y: 316, size: 32 },
      save: { cx: 1176, cy: 306, r: 24 },
      outWave: { x: 848, y: 352, w: 252, h: 104 },
      play: { cx: 1162, cy: 404, r: 38 },
      outCaption: { x: 848, y: 510, size: 22 },
      phone: { x: 1098, y: 34, w: 118, h: 208, r: 22 },
      foot: { y: 696, size: 18 },
      bars: { src: 36, ref: 40, out: 44 },
      rest: [60, 70],
    };
  }

  const L = H >= W ? portraitLayout() : landscapeLayout();
  const S = Math.min(W / L.DW, H / L.DH);
  const OX = (W - L.DW * S) / 2;
  const OY = (H - L.DH * S) / 2;
  const u = (n) => n * L.u;

  // --- Loading and checks ---------------------------------------------------------------------

  class CheckError extends Error {}
  function check(condition, message) {
    if (!condition) throw new CheckError(message);
  }
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
  const isString = (v) => typeof v === "string" && v.length > 0;
  const HEX64 = /^[0-9a-f]{64}$/;
  const int = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const leaf = (path) => String(path).split("/").pop();

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

  function checkAudio(audio, label) {
    check(isObject(audio) && HEX64.test(audio.file_sha256) && Number.isInteger(audio.file_bytes)
      && audio.format === "WAV" && audio.subtype === "PCM_16" && audio.sample_rate === PIN.rate && audio.channels === 1
      && Number.isInteger(audio.frames) && audio.frames > 0 && isNumber(audio.duration_seconds)
      && Math.abs(audio.duration_seconds - audio.frames / PIN.rate) < 1e-5,
    `${label} の WAV の記録が想定と違います。`);
    const w = audio.waveform;
    check(isObject(w) && w.bin_seconds === 0.1 && w.bin_samples === PIN.bin && Array.isArray(w.rms)
      && w.rms.length === Math.ceil(audio.frames / PIN.bin) && w.rms.every((v) => isNumber(v) && v >= 0 && v <= 1)
      && w.rms.some((v) => v > 0), `${label} の実測波形の記録が読めません。`);
  }

  // RIFF/WAVE, PCM 16-bit mono 22050 Hz, exactly 36 s of samples.
  function parseWav(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    check(bytes.length >= 44 && tag(0) === "RIFF" && tag(8) === "WAVE", "comparison.wav が WAV ではありません。");
    let o = 12;
    let fmt = null;
    let data = null;
    while (o + 8 <= bytes.length) {
      const id = tag(o);
      const size = dv.getUint32(o + 4, true);
      const body = o + 8;
      check(body + size <= bytes.length, "comparison.wav のチャンクが途中で切れています。");
      if (id === "fmt ") {
        check(size >= 16, "comparison.wav の fmt チャンクが短すぎます。");
        fmt = { format: dv.getUint16(body, true), channels: dv.getUint16(body + 2, true), rate: dv.getUint32(body + 4, true), bits: dv.getUint16(body + 14, true) };
      } else if (id === "data") {
        data = { offset: body, size };
      }
      o = body + size + (size & 1);
    }
    check(fmt && data && fmt.format === 1 && fmt.channels === 1 && fmt.rate === PIN.rate && fmt.bits === 16,
      "comparison.wav が PCM16・モノラル・22050Hz ではありません。");
    check(data.size === DURATION * PIN.rate * 2, `comparison.wav の長さが${DURATION}秒ではありません。`);
    return { dv, offset: data.offset, frames: data.size / 2 };
  }

  // Re-measure 0.1 s RMS bins of one cue window in the mix and compare them with the record.
  function checkCueRms(pcm, start, frames, rms, bins, label) {
    const first = Math.round(start * PIN.rate);
    check(Math.abs(first - start * PIN.rate) < 1e-6 && first + frames <= pcm.frames, `${label} の位置が comparison.wav の中に収まりません。`);
    for (let b = 0; b < bins; b++) {
      const n = Math.min(PIN.bin, frames - b * PIN.bin);
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const v = pcm.dv.getInt16(pcm.offset + 2 * (first + b * PIN.bin + i), true) / 32768;
        sum += v * v;
      }
      const got = Math.sqrt(sum / n);
      const want = rms[b];
      check(Math.abs(got - want) <= 2e-4 + 0.01 * want,
        `comparison.wav の${label}（${(start + b * 0.1).toFixed(1)}秒付近）の音量が記録と一致しません（測定 ${got.toFixed(5)}・記録 ${want}）。`);
    }
  }

  function verify(j, wavBytes) {
    const runs = j["voice-runs.json"];
    const req = j["voice-requests.json"];
    const cues = j["audio-cues.json"];
    const indep = j["independent-checks.json"];
    const mlock = j["model-lock.json"];
    const vlock = j["vendor-lock.json"];
    const wlock = j["watermark-lock.json"];
    [runs, req, cues, indep, mlock, vlock, wlock].forEach((value) => check(isObject(value), "素材の JSON の形が想定と違います。"));

    // Pinned source, model, locks and the run conditions.
    check(runs.format === "studio-yebisu-openvoice-runs-v1" && runs.status === "completed", "voice-runs.json の形式が違うか、完了していません。");
    const up = isObject(runs.upstream) ? runs.upstream : {};
    check(up.repository === PIN.repository && up.commit === PIN.commit && up.license === "MIT"
      && up.vendor_lock_sha256 === SHA["vendor-lock.json"] && up.vendor_files_verified === PIN.vendorFiles,
    "voice-runs.json の OpenVoice の固定版・原典の照合が一致しません。");
    check(vlock.repository === PIN.repository && vlock.commit === PIN.commit && isObject(vlock.files)
      && Object.keys(vlock.files).length === PIN.vendorFiles, "vendor-lock.json の固定版が一致しません。");
    const model = isObject(runs.model) ? runs.model : {};
    const ckpt = "converter/checkpoint.pth";
    check(model.repository === PIN.model && model.revision === PIN.revision && model.version === "v2"
      && model.model_lock_sha256 === SHA["model-lock.json"] && mlock.repository === PIN.model && mlock.revision === PIN.revision
      && isObject(mlock.files) && isObject(model.files) && isObject(mlock.files[ckpt]) && isObject(model.files[ckpt])
      && mlock.files[ckpt].sha256 === model.files[ckpt].sha256 && mlock.files[ckpt].bytes === model.files[ckpt].bytes,
    "モデルの固定リビジョンと重みのハッシュが、記録と model-lock.json で一致しません。");
    const sums = isObject(runs.input_sha256) ? runs.input_sha256 : {};
    check(sums["vendor-lock.json"] === SHA["vendor-lock.json"] && sums["input/voice-requests.json"] === SHA["voice-requests.json"]
      && sums["model-lock.json"] === SHA["model-lock.json"], "記録が参照する入力・ロックの SHA-256 が素材と一致しません。");
    const rt = isObject(runs.runtime) ? runs.runtime : {};
    const wm = isObject(rt.watermark_model) ? rt.watermark_model : {};
    check(rt.device === "cpu" && rt.enable_watermark === true && wm.revision === PIN.wavmarkRevision && wm.revision === wlock.revision
      && wm.sha256 === wlock.sha256 && wm.package === `wavmark==${PIN.wavmark}` && wlock.version === PIN.wavmark
      && wm.message === PIN.message && wlock.message === PIN.message, "透かし（WavMark）の固定版が、記録と watermark-lock.json で一致しません。");
    check(Array.isArray(runs.checks) && runs.checks.length === PIN.checks && runs.check_count === PIN.checks
      && runs.checks_passed === PIN.checks && runs.checks.every((c) => isObject(c) && c.passed === true),
    `実行時の${PIN.checks}件の確認がすべて通った記録になっていません。`);
    check(isObject(runs.verification) && runs.verification.human_approval === false, "記録の確認の範囲が読めません。");

    // Inputs and the three conversions against the frozen request.
    check(req.synthetic_only === true && isObject(req.conversion) && req.conversion.source_commit === PIN.commit
      && req.conversion.model_revision === PIN.revision && Array.isArray(req.voices) && Array.isArray(req.cases),
    "voice-requests.json の固定版・形が想定と違います。");
    check(Array.isArray(runs.assets) && runs.assets.length === 4 && Array.isArray(runs.results) && runs.results.length === 3,
      "voice-runs.json が入力4本・変換3件になっていません。");
    const assets = {};
    for (const [id, voice] of Object.entries(VOICES)) {
      const a = runs.assets.find((x) => isObject(x) && x.id === id);
      const r = req.voices.find((x) => isObject(x) && x.id === id);
      check(a && r && a.role === voice.role && a.path === voice.path && r.file === voice.path && a.synthetic === true
        && isString(a.text) && a.text === r.text && a.voice_name === r.voice_name, `入力 ${id} が voice-requests.json と一致しません。`);
      checkAudio(a.audio, `入力 ${id}`);
      assets[id] = a;
    }
    const results = {};
    for (const [id, plan] of Object.entries(CASES)) {
      const r = runs.results.find((x) => isObject(x) && x.id === id);
      const c = req.cases.find((x) => isObject(x) && x.id === id);
      check(r && c && c.source_id === plan.source && c.reference_id === plan.reference && c.output === plan.output
        && isObject(r.input) && r.input.source_id === plan.source && r.input.reference_id === plan.reference
        && isObject(r.output) && r.output.path === plan.output, `${id} の組み合わせが voice-requests.json と一致しません。`);
      checkAudio(r.output, id);
      const mark = r.output.watermark_detection;
      check(isObject(mark) && mark.matches === true && mark.decoded_message === PIN.message, `${id} の透かしの読み出しの記録が想定と違います。`);
      results[id] = r;
    }

    // Independent file audit of the same seven WAVs.
    check(indep.passed === true && indep.check_count === PIN.independent && Array.isArray(indep.checks)
      && indep.checks.length === PIN.independent && indep.checks.every((x) => isObject(x) && x.passed === true)
      && indep.listening_confirmed === false && indep.human_approval === false && isObject(indep.assets),
    `independent-checks.json の${PIN.independent}件がすべて通った記録になっていません。`);
    const wavs = [...Object.values(assets).map((a) => ({ path: a.path, audio: a.audio })), ...Object.values(results).map((r) => ({ path: r.output.path, audio: r.output }))];
    check(wavs.every((x) => isObject(indep.assets[x.path]) && indep.assets[x.path].sha256 === x.audio.file_sha256
      && indep.assets[x.path].bytes === x.audio.file_bytes && indep.assets[x.path].frames === x.audio.frames),
    "独立した照合の7本の WAV が、実行記録と一致しません。");

    // Cue sheet: the three real clips, where they sit in comparison.wav.
    check(cues.duration === DURATION && cues.sample_rate === PIN.rate && cues.channels === 1 && Array.isArray(cues.cues)
      && cues.cues.length === CUE_PLAN.length && cues.listening_confirmed === false && cues.watermark_after_AAC_confirmed === false,
    "audio-cues.json の形が想定と違います。");
    const byPath = Object.fromEntries(wavs.map((x) => [x.path, x.audio]));
    const cue = {};
    CUE_PLAN.forEach((plan, i) => {
      const c = cues.cues[i];
      const audio = byPath[plan.file];
      const duration = plan.excerpt ? plan.duration : audio.frames / PIN.rate;
      check(isObject(c) && c.role === plan.role && c.file === plan.file && c.original_sha256 === audio.file_sha256
        && c.start === plan.start && c.source_start === 0 && c.excerpt === plan.excerpt
        && Math.abs(c.duration - duration) < 1e-6 && Math.abs(c.end - (c.start + c.duration)) < 1e-6
        && c.tail_fade_seconds === (plan.excerpt ? plan.fade : 0), `audio-cues.json の ${plan.role} のキューが記録と一致しません。`);
      cue[plan.role] = { start: c.start, end: c.end, frames: Math.round(duration * PIN.rate) };
    });

    // The mix itself.
    const pcm = parseWav(wavBytes);
    const src = assets.welcome.audio;
    const ichiro = assets.ichiro.audio;
    const v01 = results.V01.output;
    checkCueRms(pcm, cue.source.start, src.frames, src.waveform.rms, src.waveform.rms.length, "元の音声");
    checkCueRms(pcm, cue.reference.start, cue.reference.frames, ichiro.waveform.rms, Math.floor(cue.reference.frames / PIN.bin) - 1, "見本の抜粋");
    checkCueRms(pcm, cue.output.start, v01.frames, v01.waveform.rms, v01.waveform.rms.length, "変換後");

    return {
      source: { rms: src.waveform.rms, duration: src.duration_seconds },
      ichiro: { rms: ichiro.waveform.rms, duration: ichiro.duration_seconds },
      sayaka: { rms: assets.sayaka.audio.waveform.rms, duration: assets.sayaka.audio.duration_seconds },
      v01: { rms: v01.waveform.rms, duration: v01.duration_seconds },
      v03: { rms: results.V03.output.waveform.rms, duration: results.V03.output.duration_seconds },
      file: leaf(results.V03.output.path),
      cue,
      wav: wavBytes,
    };
  }

  // --- Fonts -----------------------------------------------------------------------------------

  const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, "Noto Sans JP", Meiryo, system-ui, sans-serif';
  const font = (size, weight = 500) => `${weight} ${size}px ${SANS}`;

  async function loadFonts() {
    if (!document.fonts || typeof document.fonts.load !== "function") return;
    const sample = "OPENVOICE 声色変換 声色だけを、着替える ことばは元の音声から 見本 重ねると変換後 替える 保存済みの結果 聞き比べて保存 作例ページで聞けます 実際の入力音声 抜粋 3.5秒 ようこそ案内 落ち着いた声 明るい声 OpenVoice WAV welcome-sayaka.wav 合成音声の比較 STUDIO YEBISU ＋ × 0123456789";
    const specs = [font(58, 780), font(52, 780), font(34, 700), font(30, 700), font(26, 600), font(24, 500), font(22, 600), font(20, 500), font(16, 600)];
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
      data = verify(json, bytes["comparison.wav"]);
    } catch (error) {
      if (error instanceof CheckError) throw error;
      throw new CheckError(`素材の形が想定と違います（${error && error.message ? error.message : "不明"}）。`);
    }
    await loadFonts();
    return prepare(data);
  }

  // --- Prepared drawing data (computed once from verified records) -----------------------------

  function group(rms, n) {
    return Array.from({ length: n }, (_, i) => {
      const a = Math.floor((i * rms.length) / n);
      const b = Math.max(Math.floor(((i + 1) * rms.length) / n), a + 1);
      return Math.max(0, ...rms.slice(a, b));
    });
  }

  function prepare(d) {
    const g = {
      src: group(d.source.rms, L.bars.src),
      ichiro: group(d.ichiro.rms, L.bars.ref),
      sayaka: group(d.sayaka.rms, L.bars.ref),
      v01: group(d.v01.rms, L.bars.out),
      v03: group(d.v03.rms, L.bars.out),
      mini: group(d.v03.rms, 18),
    };
    g.srcMax = Math.max(1e-6, ...g.src);
    g.refMax = Math.max(1e-6, ...g.ichiro, ...g.sayaka);
    g.outMax = Math.max(1e-6, ...g.v01, ...g.v03);
    g.miniMax = Math.max(1e-6, ...g.mini);
    const peak = (rms) => Math.max(1e-6, ...rms);
    return {
      ...d,
      g,
      peak: { src: peak(d.source.rms), ichiro: peak(d.ichiro.rms), v01: peak(d.v01.rms) },
      T: {
        sS: d.cue.source.start, sE: d.cue.source.end,
        rS: d.cue.reference.start, rE: d.cue.reference.end,
        oS: d.cue.output.start, oE: d.cue.output.end,
        chipTap: 28.4, chipSwap: 28.45, saveTap: 32.3, land: 33.4,
      },
    };
  }

  // --- Time helpers (all values derive from t) ------------------------------------------------

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const bump = (t, at) => Math.sin(Math.PI * ramp(t, at - 0.06, at + 0.22));

  // Measured RMS at a time inside a clip (linear between 0.1 s bin centres; 0 outside).
  function rmsAt(rms, seconds) {
    const x = seconds * 10 - 0.5;
    const i = Math.floor(x);
    const f = x - i;
    const at = (k) => (k >= 0 && k < rms.length ? rms[k] : 0);
    return lerp(at(i), at(i + 1), f);
  }

  // --- Drawing helpers ------------------------------------------------------------------------

  const C = {
    paper: "#f5f3eb",
    ink: "#252c2a",
    muted: "#646a63",
    line: "#a6aba1",
    ring: "#dedbd0",
    chipLine: "#d3d5cb",
    white: "#fffdf5",
    purple: "#8581ee",
    purpleBar: "#7772ce",
    purpleWash: "#e7e4f8",
    peach: "#f7a86e",
    peachBar: "#d48b56",
    peachWash: "#f8e4d4",
    pink: "#e5a5b2",
    pinkBar: "#bd7e8d",
    pinkWash: "#f4dee3",
    green: "#51a696",
    greenBar: "#609184",
    greenWash: "#deebe3",
    deep: "#325c50",
  };

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  function mix(a, b, k) {
    const A = rgb(a);
    const B = rgb(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp01(k)))).join(",")})`;
  }

  let film = null;

  function rr(x, y, w, h, r) {
    const q = Math.min(r, w / 2, h / 2);
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

  // One line of text; shrinks to fit `max` down to `min`.
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
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = "alphabetic";
    if (o.spacing && "letterSpacing" in ctx) ctx.letterSpacing = o.spacing;
    if (o.max) ctx.fillText(str, x, y, o.max);
    else ctx.fillText(str, x, y);
    const width = ctx.measureText(str).width;
    if (o.spacing && "letterSpacing" in ctx) ctx.letterSpacing = "0px";
    return width;
  }

  function measure(str, size, weight) {
    ctx.font = font(size, weight);
    return ctx.measureText(str).width;
  }

  function withAlpha(alpha, fn) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
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

  function bez(p, s) {
    const v = 1 - s;
    const a = v * v * v;
    const b = 3 * v * v * s;
    const c = 3 * v * s * s;
    const d = s * s * s;
    return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
  }

  function strokePath(p, color, width, arrow) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    ctx.bezierCurveTo(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]);
    ctx.stroke();
    if (arrow) {
      const ang = Math.atan2(p[3][1] - p[2][1], p[3][0] - p[2][0]);
      const s = u(11);
      ctx.beginPath();
      ctx.moveTo(p[3][0] - Math.cos(ang - 0.55) * s, p[3][1] - Math.sin(ang - 0.55) * s);
      ctx.lineTo(p[3][0], p[3][1]);
      ctx.lineTo(p[3][0] - Math.cos(ang + 0.55) * s, p[3][1] - Math.sin(ang + 0.55) * s);
      ctx.stroke();
    }
  }

  // Measured bars. alphaOf(i, centre) returns the opacity of bar i (centre is its position 0..1).
  function bars(groups, max, box, color, alphaOf) {
    const n = groups.length;
    const step = box.w / n;
    const bw = Math.max(2, step * 0.56);
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = alphaOf ? alphaOf(i, (i + 0.5) / n) : 1;
      if (a <= 0.003) continue;
      const h = Math.max(u(4), (groups[i] / max) * box.h);
      ctx.save();
      ctx.globalAlpha *= a;
      rr(box.x + i * step + (step - bw) / 2, box.y + (box.h - h) / 2, bw, h, bw / 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Soft conceptual voice form (not measured): a circle with a slow, deterministic wobble.
  function form(cx, cy, r, color, alpha, phase) {
    if (alpha <= 0.002 || r <= 0.5) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = color;
    ctx.beginPath();
    const n = 44;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + 0.06 * Math.sin(3 * a + phase) + 0.035 * Math.sin(5 * a - phase * 1.7);
      const x = cx + Math.cos(a) * r * k;
      const y = cy + Math.sin(a) * r * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function playIcon(p, playing, fill, ink) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.06)";
    ctx.shadowBlur = u(6);
    ctx.fillStyle = fill;
    circle(p.cx, p.cy, p.r);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = ink;
    const s = p.r * 0.36;
    if (playing) {
      rr(p.cx - s * 0.95, p.cy - s, s * 0.6, s * 2, s * 0.15);
      ctx.fill();
      rr(p.cx + s * 0.35, p.cy - s, s * 0.6, s * 2, s * 0.15);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(p.cx - s * 0.6, p.cy - s);
      ctx.lineTo(p.cx + s * 1.05, p.cy);
      ctx.lineTo(p.cx - s * 0.6, p.cy + s);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- Activity -------------------------------------------------------------------------------

  function activity(t) {
    const T = film.T;
    const on = (s, e) => ease(ramp(t, s - 0.3, s)) * (1 - ramp(t, e, e + 0.35));
    const a = { source: on(T.sS, T.sE), reference: on(T.rS, T.rE), output: on(T.oS, T.oE) };
    a.focus = Math.max(a.source, a.reference, a.output);
    a.dim = (role) => 1 - 0.42 * clamp01(a.focus - a[role]);
    return a;
  }
  const playing = (t, s, e) => t >= s && t < e;

  // Where the output's measured bars have been revealed (0..1), or 1 when not revealing.
  function outProgress(t) {
    const T = film.T;
    return t < T.oS ? 0 : clamp01((t - T.oS) / (T.oE - T.oS));
  }

  // --- Chrome and titles ----------------------------------------------------------------------

  function drawChrome() {
    text("OPENVOICE ・ 声色変換", L.eyebrow.x, L.eyebrow.y, { size: L.eyebrow.size, weight: 600, color: C.muted, spacing: "2px" });
    text("合成音声の比較", L.tall ? 48 : 64, L.foot.y, { size: L.foot.size, weight: 500, color: C.muted });
    text("STUDIO YEBISU", L.DW - (L.tall ? 48 : 64), L.foot.y, { size: L.foot.size - 2, weight: 700, color: C.muted, align: "right", spacing: "3px" });
  }

  function drawTitles(t) {
    for (const s of SCENES) {
      if (t < s.in || (t >= s.out && !s.last)) continue;
      const fadeIn = s.in === 0 ? 1 : ease(ramp(t, s.in, s.in + 0.3));
      const fadeOut = s.last ? 1 : 1 - ramp(t, s.out - 0.25, s.out);
      const a = Math.min(fadeIn, fadeOut);
      withAlpha(a, () => {
        const dy = (1 - fadeIn) * u(12);
        text(s.title, L.title.x, L.title.y + dy, { size: L.title.size, weight: 780, color: C.ink, max: L.title.max, min: L.title.min });
        if (s.sub) {
          const k = s.in === 0 ? 1 : ease(ramp(t, s.in + 0.15, s.in + 0.5));
          withAlpha(k, () => text(s.sub, L.sub.x, L.sub.y + dy, { size: L.sub.size, weight: 500, color: C.muted, max: L.sub.max, min: 16 }));
        }
      });
    }
  }

  // --- Diagram --------------------------------------------------------------------------------

  function drawConnectors() {
    strokePath(L.pathA, C.line, u(2.6), true);
    strokePath(L.pathB, C.line, u(2.6), false);
    strokePath(L.pathOut, C.line, u(2.6), true);
  }

  function nodeShell(b, wash, active, alpha, inner) {
    withAlpha(alpha, () => {
      scaled(b.x + b.w / 2, b.y + b.h / 2, 1 + 0.03 * active, () => {
        rr(b.x, b.y, b.w, b.h, b.r);
        ctx.fillStyle = wash;
        ctx.fill();
        if (active > 0.01) {
          ctx.lineWidth = u(3);
          ctx.strokeStyle = `rgba(37,44,42,${0.32 * active})`;
          ctx.stroke();
        }
        inner();
      });
    });
  }

  function drawSource(t, act) {
    const T = film.T;
    const g = film.g;
    const p = playing(t, T.sS, T.sE) ? (t - T.sS) / film.source.duration : null;
    nodeShell(L.src, C.purpleWash, act.source, act.dim("source"), () => {
      bars(g.src, g.srcMax, L.srcWave, C.purpleBar, (i, c) => (p === null ? 1 : c <= p ? 1 : 0.32));
      playIcon(L.srcPlay, p !== null, "rgba(255,255,255,0.9)", C.ink);
    });
    withAlpha(act.dim("source"), () => {
      const lb = L.srcLabel;
      const w = text("元の音声", lb.x, lb.y, { size: lb.size, weight: 700, align: lb.align });
      const cap = L.srcCaption;
      const cx = cap.x === null ? lb.x + w + u(16) : cap.x;
      text(SOURCE_LABEL, cx, cap.y, { size: cap.size, weight: 500, color: C.muted, align: cap.align });
    });
  }

  function chipRects() {
    const c = L.chips;
    const x0 = c.x === null ? L.refLabel.x + measure("声色の見本", L.refLabel.size, 700) + u(20) : c.x;
    return [
      { name: "穏やか", dot: C.peach, x: x0, y: c.y, w: c.w, h: c.h },
      { name: "明るい", dot: C.pink, x: x0 + c.w + c.gap, y: c.y, w: c.w, h: c.h },
    ];
  }

  function drawChips(t) {
    const k = ease(ramp(t, film.T.chipSwap, film.T.chipSwap + 0.25));
    const press = bump(t, film.T.chipTap);
    chipRects().forEach((r, i) => {
      const sel = i === 0 ? 1 - k : k;
      scaled(r.x + r.w / 2, r.y + r.h / 2, i === 1 ? 1 - 0.05 * press : 1, () => {
        rr(r.x, r.y, r.w, r.h, r.h / 2);
        ctx.lineWidth = u(1.6);
        ctx.strokeStyle = C.chipLine;
        ctx.stroke();
        withAlpha(sel, () => {
          rr(r.x, r.y, r.w, r.h, r.h / 2);
          ctx.fillStyle = C.white;
          ctx.fill();
          ctx.lineWidth = u(2.2);
          ctx.strokeStyle = C.ink;
          ctx.stroke();
        });
        ctx.fillStyle = r.dot;
        circle(r.x + u(24), r.y + r.h / 2, u(6.5));
        ctx.fill();
        text(r.name, r.x + u(40), r.y + r.h / 2 + L.chips.size * 0.36, { size: L.chips.size, weight: 600, color: C.ink });
      });
    });
  }

  function drawReference(t, act) {
    const T = film.T;
    const g = film.g;
    const swap = ease(ramp(t, 28.5, 29.1));
    const ex = 3.5 / film.ichiro.duration; // the excerpt's share of the whole reference clip
    const lit = ease(ramp(t, T.rS - 0.4, T.rS)) * (1 - ramp(t, T.rE + 0.1, T.rE + 0.5));
    const pr = ex * clamp01((t - T.rS) / (T.rE - T.rS));
    const wash = mix(C.peachWash, C.pinkWash, swap);
    nodeShell(L.ref, wash, act.reference, act.dim("reference"), () => {
      const box = L.refWave;
      if (lit > 0.01) {
        withAlpha(0.55 * lit, () => {
          rr(box.x - u(6), box.y - u(8), box.w * ex + u(12), box.h + u(16), u(12));
          ctx.fillStyle = C.white;
          ctx.fill();
        });
      }
      const alphaOf = (i, c) => (lit <= 0.01 ? 1 : c <= pr ? 1 : c <= ex ? lerp(1, 0.5, lit) : lerp(1, 0.2, lit));
      withAlpha(1 - swap, () => bars(g.ichiro, g.refMax, box, C.peachBar, alphaOf));
      withAlpha(swap, () => bars(g.sayaka, g.refMax, box, C.pinkBar));
      playIcon(L.refPlay, playing(t, T.rS, T.rE), "rgba(255,255,255,0.9)", C.ink);
    });
    // Tag for the excerpt, straddling the node's top edge.
    withAlpha(lit, () => {
      const label = "見本の声・抜粋";
      const size = u(21);
      const w = measure(label, size, 700) + u(30);
      const h = u(40);
      const cx = L.ref.x + L.ref.w / 2;
      rr(cx - w / 2, L.ref.y - h / 2, w, h, h / 2);
      ctx.fillStyle = C.ink;
      ctx.fill();
      text(label, cx, L.ref.y + size * 0.36, { size, weight: 700, color: C.white, align: "center" });
    });
    withAlpha(act.dim("reference"), () => {
      const lb = L.refLabel;
      text("声色の見本", lb.x, lb.y, { size: lb.size, weight: 700, align: lb.align });
      drawChips(t);
    });
  }

  function drawPlus() {
    text("＋", L.plus.x, L.plus.y + L.plus.size * 0.36, { size: L.plus.size, weight: 400, color: C.line, align: "center" });
  }

  // Fill of each input's form inside OpenVoice: full in the opening picture, emptied, then filled by its flow.
  function fills(t) {
    const T = film.T;
    const empty = 0.16;
    const start = ease(ramp(t, 2.4, 3.0));
    const a = t < T.sS ? lerp(1, empty, start) : Math.min(1, empty + 0.5 * ramp(t, T.sS, T.sE) + 0.34 * ease(ramp(t, T.sE, T.sE + 0.55)));
    const b = t < T.rS ? lerp(1, empty, start) : Math.min(1, empty + 0.5 * ramp(t, T.rS, T.rE) + 0.34 * ease(ramp(t, T.rE, T.rE + 0.45)));
    return { a, b };
  }

  function drawProcess(t, act) {
    const T = film.T;
    const P = L.proc;
    const f = fills(t);
    const p = clamp01((t - T.oS) / (T.oE - T.oS));
    const merging = Math.sin(Math.PI * p);
    const sep = P.sep * (1 - 0.5 * merging);
    const angle = 0.35 * Math.sin(Math.PI * 2 * p);
    const phase = 1.6 * clamp01((t - T.sS) / (T.sE - T.sS)) + 2.6 * p;
    const swapB = ease(ramp(t, 28.7, 29.3));
    const cy = P.cy - P.r * 0.07;
    // Ring
    ctx.lineWidth = u(2.4);
    ctx.strokeStyle = act.output > 0.01 ? mix(C.ring, C.ink, 0.35 * act.output) : C.ring;
    circle(P.cx, P.cy, P.r * (1 + 0.03 * act.output));
    ctx.stroke();
    // The two forms that arrived through the connectors.
    const ax = P.cx - sep * Math.cos(angle);
    const ay = cy - sep * Math.sin(angle);
    const bx = P.cx + sep * Math.cos(angle);
    const by = cy + sep * Math.sin(angle);
    form(ax, ay, P.cr, C.purple, f.a, phase);
    form(bx, by, P.cr, mix(C.peach, C.pink, swapB), f.b, phase + 1.3);
    // Squiggle: a fixed drawing, moving only while the converted audio plays.
    const amp = P.cr * 0.22 * (0.7 + (act.output > 0 ? 0.7 * (rmsAt(film.v01.rms, t - T.oS) / film.peak.v01) : 0));
    const shift = 5 * clamp01((t - T.oS) / (T.oE - T.oS)) * (T.oE - T.oS);
    const half = P.cr * 1.1;
    withAlpha(Math.min(f.a, f.b), () => {
      ctx.strokeStyle = C.white;
      ctx.lineWidth = u(5);
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = P.cx - half + (2 * half * i) / 40;
        const env = Math.sin((Math.PI * i) / 40);
        const y = cy + 4 + Math.sin(i * 0.62 + shift) * amp * env;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }

  function drawProcLabel() {
    text("OpenVoice", L.procLabel.x, L.procLabel.y, { size: L.procLabel.size, weight: 650, color: C.muted, align: "center", spacing: "1px" });
  }

  function saveIcon(p, press) {
    ctx.fillStyle = press > 0.01 ? mix(C.white, C.deep, press) : C.white;
    circle(p.cx, p.cy, p.r);
    ctx.fill();
    ctx.lineWidth = u(2);
    ctx.strokeStyle = C.deep;
    ctx.stroke();
    const ink = press > 0.5 ? C.white : C.deep;
    const s = p.r * 0.42;
    ctx.strokeStyle = ink;
    ctx.lineWidth = u(3);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.cx, p.cy - s);
    ctx.lineTo(p.cx, p.cy + s * 0.55);
    ctx.moveTo(p.cx - s * 0.6, p.cy);
    ctx.lineTo(p.cx, p.cy + s * 0.6);
    ctx.lineTo(p.cx + s * 0.6, p.cy);
    ctx.moveTo(p.cx - s, p.cy + s * 1.05);
    ctx.lineTo(p.cx + s, p.cy + s * 1.05);
    ctx.stroke();
  }

  function drawOutput(t, act) {
    const T = film.T;
    const g = film.g;
    const b = L.out;
    const opening = 1 - ease(ramp(t, 2.4, 3.0));          // full at the start, then a ghost until revealed
    const p = outProgress(t);
    const revealing = t >= T.oS;
    const swap = ease(ramp(t, 29.4, 30.1));
    withAlpha(act.dim("output"), () => {
      scaled(b.x + b.w / 2, b.y + b.h / 2, 1 + 0.02 * act.output, () => {
        rr(b.x, b.y, b.w, b.h, b.r);
        ctx.fillStyle = C.greenWash;
        ctx.fill();
        if (act.output > 0.01) {
          ctx.lineWidth = u(3);
          ctx.strokeStyle = `rgba(50,92,80,${0.4 * act.output})`;
          ctx.stroke();
        }
        const hw = text("変換後", L.outHead.x, L.outHead.y, { size: L.outHead.size, weight: 700 });
        const dur = lerp(film.v01.duration, film.v03.duration, swap);
        text(`${dur.toFixed(1)} 秒`, L.outHead.x + hw + u(16), L.outHead.y, { size: u(22), weight: 500, color: "#5d7368" });
        saveIcon(L.save, bump(t, T.saveTap));
        const ghost = 0.2;
        const alphaOf = (i, c) => {
          if (revealing) return c <= p ? 1 : ghost;
          return lerp(ghost, 1, opening);
        };
        withAlpha(1 - swap, () => bars(g.v01, g.outMax, L.outWave, C.greenBar, alphaOf));
        withAlpha(swap, () => bars(g.v03, g.outMax, L.outWave, C.greenBar));
        // Playhead while the converted audio plays.
        if (playing(t, T.oS, T.oE)) {
          const x = L.outWave.x + p * L.outWave.w;
          ctx.fillStyle = C.deep;
          rr(x - u(1.5), L.outWave.y - u(6), u(3), L.outWave.h + u(12), u(1.5));
          ctx.fill();
        }
        playIcon(L.play, playing(t, T.oS, T.oE), C.deep, C.white);
        const cap = L.outCaption;
        withAlpha(1 - swap, () => text(`${SOURCE_LABEL} × 落ち着いた声`, cap.x, cap.y, { size: cap.size, weight: 500, color: "#4a6358" }));
        withAlpha(swap, () => text(`${SOURCE_LABEL} × 明るい声`, cap.x, cap.y, { size: cap.size, weight: 500, color: "#4a6358" }));
      });
    });
  }

  // --- Flows (conceptual droplets along the connectors; sizes follow the measured RMS) ----------

  function stream(path, from, to, every, travel, rms, peak, color, t, base) {
    const first = Math.max(0, Math.floor((t - travel - from) / every));
    const last = Math.floor((Math.min(t, to) - from) / every);
    for (let k = first; k <= last; k++) {
      const e = from + k * every;
      if (e > to || e > t) continue;
      const s = (t - e) / travel;
      if (s < 0 || s > 1) continue;
      const v = rmsAt(rms, e - from) / peak;
      if (v < 0.06) continue;
      const [x, y] = bez(path, inOut(s));
      const a = Math.min(1, s / 0.15) * Math.min(1, (1 - s) / 0.25);
      form(x, y, u(base + 15 * v), color, 0.8 * a, e * 3);
    }
  }

  function drawFlows(t) {
    const T = film.T;
    const P = L.proc;
    // Source → OpenVoice, and the last form settling into the left circle.
    stream(L.pathA, T.sS, T.sE, 0.32, 1.25, film.source.rms, film.peak.src, C.purple, t, 5);
    stream(L.pathB, T.rS, T.rE, 0.3, 1.0, film.ichiro.rms, film.peak.ichiro, C.peach, t, 5);
    for (const [path, at, color] of [[L.pathA, T.sE, C.purple], [L.pathB, T.rE, C.peach]]) {
      const s = ramp(t, at - 0.05, at + 0.5);
      if (s > 0 && s < 1) {
        const [x, y] = bez(path, inOut(s));
        form(x, y, u(16 + 10 * s), color, 0.85 * Math.min(1, (1 - s) / 0.3), at);
      }
    }
    // OpenVoice → the converted waveform, landing where its measured bars are being revealed.
    if (t >= T.oS - 0.1 && t <= T.oE + 1) {
      const every = 0.28;
      const travel = 0.9;
      const first = Math.max(0, Math.floor((t - travel - T.oS) / every));
      const last = Math.floor((Math.min(t, T.oE) - T.oS) / every);
      for (let k = first; k <= last; k++) {
        const e = T.oS + k * every;
        if (e > T.oE || e > t) continue;
        const s = (t - e) / travel;
        if (s < 0 || s > 1) continue;
        const v = rmsAt(film.v01.rms, e + travel - T.oS) / film.peak.v01;
        if (v < 0.06) continue;
        const arrive = outProgress(e + travel);
        const target = [L.outWave.x + arrive * L.outWave.w, L.outWave.y + L.outWave.h / 2];
        const start = L.tall ? [P.cx, P.cy + P.r * 0.6] : [P.cx + P.r * 0.6, P.cy];
        const path = L.tall
          ? [start, [start[0], start[1] + 150], [target[0], target[1] - 110], target]
          : [start, [start[0] + 90, start[1]], [target[0] - 60, target[1]], target];
        const [x, y] = bez(path, inOut(s));
        const from = k % 2 === 0 ? C.purple : C.peach;
        const a = Math.min(1, s / 0.15) * Math.min(1, (1 - s) / 0.2);
        form(x, y, u(5 + 12 * v) * (1 - 0.35 * s), mix(from, C.green, s), 0.8 * a, e * 3);
      }
    }
    // Choosing 明るい声: a short pink pulse (no audio; the saved V03 result replaces the bars).
    for (let k = 0; k < 3; k++) {
      const s = ramp(t, 28.55 + k * 0.16, 29.25 + k * 0.16);
      if (s > 0 && s < 1) {
        const [x, y] = bez(L.pathB, inOut(s));
        form(x, y, u(11), C.pink, 0.8 * Math.min(1, s / 0.15) * Math.min(1, (1 - s) / 0.25), k);
      }
    }
    for (let k = 0; k < 4; k++) {
      const s = ramp(t, 29.1 + k * 0.12, 29.85 + k * 0.12);
      if (s > 0 && s < 1) {
        const target = [L.outWave.x + ((k + 0.5) / 4) * L.outWave.w, L.outWave.y + L.outWave.h / 2];
        const start = L.tall ? [P.cx, P.cy + P.r * 0.6] : [P.cx + P.r * 0.6, P.cy];
        const path = L.tall
          ? [start, [start[0], start[1] + 150], [target[0], target[1] - 110], target]
          : [start, [start[0] + 90, start[1]], [target[0] - 60, target[1]], target];
        const [x, y] = bez(path, inOut(s));
        form(x, y, u(10) * (1 - 0.3 * s), mix(C.pink, C.green, s), 0.8 * Math.min(1, s / 0.15) * Math.min(1, (1 - s) / 0.2), k + 5);
      }
    }
  }

  // --- Save to a device -------------------------------------------------------------------------

  function phoneScreen() {
    const p = L.phone;
    return { x: p.x + u(10), y: p.y + u(30), w: p.w - u(20), h: p.h - u(48) };
  }

  function fileIcon(cx, cy, k) {
    const w = u(54) * k;
    const h = u(66) * k;
    const f = u(14) * k;
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - f, y);
    ctx.lineTo(x + w, y + f);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = C.greenWash;
    ctx.fill();
    ctx.lineWidth = u(2.2) * k;
    ctx.strokeStyle = C.deep;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - f, y);
    ctx.lineTo(x + w - f, y + f);
    ctx.lineTo(x + w, y + f);
    ctx.stroke();
    text("WAV", cx, y + h - u(14) * k, { size: Math.max(8, u(16) * k), weight: 800, color: C.deep, align: "center" });
  }

  function drawPhone(t) {
    const appear = ease(ramp(t, 31.6, 32.1));
    if (appear <= 0) return;
    const p = L.phone;
    const dy = (1 - appear) * u(24);
    withAlpha(appear, () => {
      ctx.save();
      ctx.translate(0, dy);
      rr(p.x, p.y, p.w, p.h, p.r);
      ctx.fillStyle = C.white;
      ctx.fill();
      ctx.lineWidth = u(3);
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      rr(p.x + p.w / 2 - u(16), p.y + u(12), u(32), u(6), u(3));
      ctx.fillStyle = C.ink;
      ctx.fill();
      const sc = phoneScreen();
      rr(sc.x, sc.y, sc.w, sc.h, u(10));
      ctx.fillStyle = C.paper;
      ctx.fill();
      const landed = ease(ramp(t, film.T.land, film.T.land + 0.35));
      withAlpha(landed, () => {
        fileIcon(sc.x + sc.w / 2, sc.y + sc.h * 0.34, 0.9);
        const mini = { x: sc.x + u(10), y: sc.y + sc.h * 0.62, w: sc.w - u(20), h: u(26) };
        bars(film.g.mini, film.g.miniMax, mini, C.greenBar);
        text(film.file, sc.x + sc.w / 2, sc.y + sc.h - u(12), { size: u(13), weight: 600, color: C.muted, align: "center", max: sc.w - u(8), min: 8 });
      });
      ctx.restore();
    });
  }

  function drawFile(t) {
    const T = film.T;
    if (t < 32.4 || t >= T.land + 0.05) return;
    const grow = ease(ramp(t, 32.4, 32.6));
    const s = inOut(ramp(t, 32.6, T.land));
    const sc = phoneScreen();
    const a = [L.save.cx, L.save.cy];
    const b = [sc.x + sc.w / 2, sc.y + sc.h * 0.34];
    const c = [lerp(a[0], b[0], 0.5) + (L.tall ? u(40) : u(60)), Math.min(a[1], b[1]) - u(L.tall ? 60 : 30)];
    const v = 1 - s;
    const x = v * v * a[0] + 2 * v * s * c[0] + s * s * b[0];
    const y = v * v * a[1] + 2 * v * s * c[1] + s * s * b[1];
    fileIcon(x, y, lerp(0.6, 1, grow) * lerp(1, 0.9, s));
  }

  // --- Pointer (illustrated fingertip showing how the saved page is used) -----------------------

  function pointerKeys() {
    const T = film.T;
    const [rx, ry] = L.rest;
    const say = chipRects()[1];
    const pt = (x, y) => [x, y];
    const src = pt(L.srcPlay.cx, L.srcPlay.cy);
    const ref = pt(L.refPlay.cx, L.refPlay.cy);
    const out = pt(L.play.cx, L.play.cy);
    const chip = pt(say.x + say.w / 2, say.y + say.h / 2);
    const save = pt(L.save.cx, L.save.cy);
    const off = (p) => [p[0] + u(rx), p[1] + u(ry)];
    return [
      { t: 0, p: off(src), a: 0 },
      { t: T.sS - 0.9, p: off(src), a: 0 },
      { t: T.sS - 0.15, p: src, a: 1 },
      { t: T.sS + 0.4, p: src, a: 1 },
      { t: T.sS + 0.9, p: off(src), a: 0 },
      { t: T.rS - 0.75, p: off(ref), a: 0 },
      { t: T.rS - 0.15, p: ref, a: 1 },
      { t: T.rS + 0.4, p: ref, a: 1 },
      { t: T.rS + 0.9, p: off(ref), a: 0 },
      { t: T.oS - 0.7, p: off(out), a: 0 },
      { t: T.oS - 0.15, p: out, a: 1 },
      { t: T.oS + 0.4, p: out, a: 1 },
      { t: T.oS + 0.9, p: off(out), a: 0 },
      { t: 27.45, p: off(chip), a: 0 },
      { t: T.chipTap - 0.1, p: chip, a: 1 },
      { t: 31.5, p: chip, a: 1 },
      { t: T.saveTap - 0.12, p: save, a: 1 },
      { t: T.saveTap + 0.5, p: save, a: 1 },
      { t: T.land, p: off(save), a: 0 },
    ];
  }

  function drawPointer(t) {
    const T = film.T;
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
    const taps = [T.sS, T.rS, T.oS, T.chipTap, T.saveTap];
    for (const tap of taps) {
      const k = ramp(t, tap, tap + 0.6);
      if (k > 0 && k < 1) {
        const key = keys.find((q) => q.t <= tap && q.a === 1 && keys[keys.indexOf(q) + 1] && keys[keys.indexOf(q) + 1].t > tap) || null;
        const at = key ? key.p : [x, y];
        withAlpha((1 - k) * 0.55, () => {
          ctx.lineWidth = u(3);
          ctx.strokeStyle = C.ink;
          circle(at[0], at[1], u(24 + 44 * ease(k)));
          ctx.stroke();
        });
      }
    }
    if (a <= 0.002) return;
    const press = Math.max(...taps.map((tap) => bump(t, tap)));
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
    const act = activity(t);
    drawChrome();
    drawTitles(t);
    drawConnectors();
    drawSource(t, act);
    drawReference(t, act);
    drawPlus();
    drawProcess(t, act);
    drawOutput(t, act);
    drawFlows(t);
    drawProcLabel();
    drawPhone(t);
    drawFile(t);
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

  function paint(t) {
    if (!film) throw new Error("素材の照合が済んでいないため描けません。");
    current = t;
    drawFrame(t);
    ui.time.value = String(t);
    showTime();
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

  // Editor preview only: a user click starts the verified comparison.wav and the picture follows its clock.
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
    const items = SCENES.map((s) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = true;
      button.dataset.time = String(s.read);
      const time = document.createElement("span");
      time.className = "scene-time";
      time.textContent = `${s.in}–${s.out}秒`;
      const label = document.createElement("span");
      label.textContent = `${s.title}　${s.note}`;
      button.append(time, label);
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
      setState("ready", "照合済み。再生すると、映像と同じ時刻で実際の音（comparison.wav）が鳴ります。");
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
