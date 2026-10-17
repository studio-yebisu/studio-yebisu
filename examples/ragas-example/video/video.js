/*
 * Studio Yebisu — Ragas 作例・動く概念図（32秒・無音）
 * Copyright (c) 2026 Studio Yebisu. MIT License. Diagram and film authored by Claude Opus 5.5.
 *
 * One connected drawing: an open reference book and two frozen answer strips (変更前 / 変更後) feed three
 * physical measuring tools — a notched overlay (同じ文字 / ExactMatch), a character ruler (文字の近さ /
 * NonLLMStringSimilarity, Levenshtein) and a transparent sleeve the size of the whole reference (全文を含む /
 * StringPresence) — whose values lead to one saved question. A miniature of the same strip, with the same clock,
 * attachment or condition marks, travels into, through and out of the tools. The editor's memo hangs from the book
 * as a separate warm branch (照合メモ・入力); it is supplied input, never a verdict of the tools.
 *
 * Every string, hour and value is read from the saved original result (assets/evaluation.json) after the manifest
 * and all seven assets match their pinned SHA-256 and byte counts and the records agree with each other.
 * No audio, no live execution, no recomputed metric, no fallback data.
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
    sha256: "2543fb265ff55dafe5a70b8895c6c4d7fbfd4d3d5d1ce99656a5f4f8caf4b20e",
    format: "studio-yebisu-visual-assets-v1",
  };
  const PROJECTION = "faithful projection of original fixed actual results";
  // Same order and values as the manifest. Paths are relative to video/assets/.
  const ASSETS = [
    { file: "evaluation.json", sha256: "b3862890b1ee0d48ebad9991cc99310730cbc3769e4717fdd2e4678348c91ea3", bytes: 17360, source: "outputs/evaluation.json" },
    { file: "faq-pairs.json", sha256: "d55fcce5eec82974b01d912dcf6f21de94aede03c37d2a16092b6fa9304705a2", bytes: 10374, source: "input/faq-pairs.json" },
    { file: "metric-source.py", sha256: "9935e46a0a048d4d5a7790abfd0d20c38909231da34b1aab5da5268758b00230", bytes: 6583, source: "vendor/ragas/src/ragas/metrics/collections/_string.py" },
    { file: "original-verification.json", sha256: "bd1d6d44521bd44eb106ef21e070b396814a0068515b8a69b52c7ef70d54a504", bytes: 15545, source: "verification.json" },
    { file: "upstream.json", sha256: "39641a2e0be9f97e6943e4d77b5013767486ce6cf03bf5dbbc94a12a83efa79d", bytes: 1573, source: "original upstream metadata" },
    { file: "diagram-data.json", sha256: "96ddc83082b8c0beff94f5d5f0da73a90e9e14be52dae3b050e8a531141ea075", bytes: 16060, source: PROJECTION },
    { file: "timeline.json", sha256: "96dfe78632370f4a13891da7c0a1a510f64d84aa2d5a18a0c313e8af898dc683", bytes: 2424, source: PROJECTION },
  ];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.file, a.sha256]));
  const PIN = {
    repository: "vibrantlabsai/ragas",
    commit: "298b68274234c060deacab3cf5fb52aa3a20e885",
    license: "Apache-2.0",
    buildLabel: "0.0.0+studio.298b68274234",
    python: "3.12.9",
    rapidfuzz: "3.14.6",
    metricApi: "ragas.metrics.collections",
    sourceFiles: 237,
    packages: 93,
    calls: 60,
    inputFormat: "studio-yebisu-faq-fixture-v1",
    resultFormat: "studio-yebisu-ragas-result-v1",
    diagramFormat: "studio-yebisu-ragas-visual-facts-v1",
    timelineFormat: "studio-yebisu-ragas-visual-timeline-v1",
    ids: ["Q01", "Q02", "Q03", "Q04", "Q05", "Q06", "Q07", "Q08", "Q09", "Q10"],
    docs: ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10"],
    summary: { beforeExact: 4, afterExact: 7, beforePresence: 4, afterPresence: 8, beforeSim: 0.7884922267275208, afterSim: 0.8835109447004609 },
  };
  const METRIC_IDS = ["exact_match", "string_similarity", "string_presence"];
  const METRIC_CLASSES = ["ExactMatch", "NonLLMStringSimilarity", "StringPresence"];
  const BINARY = new Set(["exact_match", "string_presence"]);
  const SIDES = ["before", "after"];
  const SIDE_LABEL = { before: "変更前", after: "変更後" };
  const LABELS = ["grounded", "contradiction", "unsupported_addition"];
  const SHORT_LABEL = { grounded: "資料と合う", contradiction: "資料と矛盾", unsupported_addition: "根拠のない追記" };
  // Plain-text needles in the pinned _string.py. The file is read as text only, never executed.
  const SOURCE_NEEDLES = [
    "class ExactMatch(BaseMetric):",
    "score = float(reference == response)",
    "class StringPresence(BaseMetric):",
    "score = float(reference in response)",
    "class NonLLMStringSimilarity(BaseMetric):",
    "LEVENSHTEIN = \"levenshtein\"",
    "].normalized_distance(reference, response)",
  ];
  // Real fragments drawn on the book and the strips. Each is checked against the saved strings.
  const VIEWS = {
    Q07: { ref: ["前日18時まで"], before: ["前日18時まで"], after: ["前日19時まで"], clock: true },
    Q08: { ref: ["入口の返却箱へ", "本を返せます。"], before: ["本を返せます。"], after: ["本を返せます。"], attach: "延滞しても連絡は不要です。" },
    Q05: {
      ref: ["予約が入っていない", "本に限り、1回だけ", "7日間延長できます。"],
      before: ["予約が入っていない本に"],
      after: ["ほかの人の予約がない本は、", "あと7日だけ、1度延ばせます。"],
      chips: ["予約なし", "1回", "7日間"],
      refTokens: ["予約が入っていない", "1回", "7日間"],
      afterTokens: ["予約がない", "1度", "7日"],
    },
    Q01: { ref: ["10時から18時"], before: ["9時から18時"], after: ["10時から18時"], clock: true },
  };
  // Scene timing is fixed in timeline.json; `read` is where the scene buttons land.
  const SCENE_PLAN = [
    { id: "overview", in: 0, out: 5, case: "Q07", read: 4.8 },
    { id: "deadline", in: 5, out: 11, case: "Q07", read: 10.6 },
    { id: "addition", in: 11, out: 17, case: "Q08", read: 16.6 },
    { id: "paraphrase", in: 17, out: 23, case: "Q05", read: 22.7 },
    { id: "literal_fix", in: 23, out: 27, case: "Q01", read: 26.8 },
    { id: "finish", in: 27, out: 32, case: "Q07", read: 31 },
  ];
  // What moves inside each scene, in seconds from the scene start.
  const BEATS = {
    overview: { build: [0.1, 1.3], travel: { side: "after", start: 1.6, dur: 2.4 } },
    deadline: { clockDrop: [0.6, 1.8], travel: { side: "after", start: 2.2, dur: 2.4 } },
    addition: { travel: { side: "after", start: 1.8, dur: 2.4 } },
    paraphrase: { leaders: [0.8, 2.2], travel: { side: "after", start: 2.6, dur: 2.4 } },
    literal_fix: { early: { side: "before", at: 0.6 }, swap: [1.0, 1.4], travel: { side: "after", start: 1.5, dur: 1.8 } },
    finish: { early: { side: "after", at: 0.6 }, cta: [1.2, 1.8] },
  };
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
    focusList: $("focus-list"),
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

  // --- Palette and type ------------------------------------------------------------------------

  const C = {
    ivory: "#f6f1e6", paper: "#fffcf5", white: "#ffffff", ink: "#1c2333", muted: "#535a6b", faint: "#9aa0ad", rule: "#cfc5b0",
    warm: "#b4571a", warmInk: "#8f4210", warmWash: "#fbe5d5", mark: "#dfe4f2", attach: "#f7d6a6",
  };
  const TOOLS = [
    { id: "exact_match", label: "同じ文字", ink: "#2747c2", wash: "#e6eafb" },
    { id: "string_similarity", label: "文字の近さ", ink: "#0f7a72", wash: "#dcefec" },
    { id: "string_presence", label: "全文を含む", ink: "#94650a", wash: "#f6ebd3" },
  ];
  const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Meiryo", "Noto Sans JP", system-ui, sans-serif';
  const MONO = 'ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace';
  const font = (size, weight = 700, family = SANS) => `${weight} ${size}px ${family}`;

  // --- Layouts (authored natively for each orientation) ------------------------------------

  function portraitLayout() {
    const boxes = [16, 248, 480].map((x) => ({ x, y: 760, w: 224, h: 276 }));
    return {
      DW: 720, DH: 1280, tall: true,
      eyebrow: { x: 40, y: 56, size: 24 },
      headline: { x: 40, y: 124, size: 50, min: 40, max: 640 },
      fusen: { x: 384, y: 146, w: 300, h: 110, pad: 18, title: 22, titleY: 180, label: 40, labelY: 224 },
      book: {
        x: 28, y: 236, w: 664, h: 234, spine: 360, line: 2.5,
        left: { x: 52, w: 288 }, right: { x: 384, w: 284 },
        headY: 286, headSize: 26, qY: 334, qSize: 32, qMin: 26, qLineH: 42, qLines: 3, docY: 452, docSize: 24,
        ref: { 1: { size: 46, min: 32, ys: [350] }, 2: { size: 38, min: 28, ys: [342, 394] }, 3: { size: 30, min: 22, ys: [330, 368, 406] } },
        clock: { cx: 630, cy: 412, r: 36 },
        chips: { y: 426, h: 36, size: 22, gap: 10 },
      },
      strip: {
        x: 28, w: 664, before: 494, after: 576, h: 70, h2: 124, line: 3,
        tab: { dx: 18, labelY: 30, label: 26, scoreY: 58, score: 18, scoreMin: 13, w: 106 },
        textX: 132, one: { y: 50, size: 40, min: 28 }, two: { ys: [48, 100], size: 34, min: 24 },
        clock: { dx: 56, cy: 35, r: 24 },
        attach: { dx: 104, dy: 78, h: 54, size: 36, min: 26 },
      },
      bus: 728,
      boxes,
      tool(i) {
        const b = boxes[i];
        const cx = b.x + b.w / 2;
        return {
          box: b, bar: 10,
          label: { x: cx, y: b.y + 62, size: 40, min: 32, align: "center", max: b.w - 16 },
          inst: { cx, cy: b.y + 140, s: 1 },
          token: { x: cx - 84, y: b.y + 196, w: 168, h: 60, size: 44 },
        };
      },
      bus2: 1050,
      card: { x: 120, y: 1066, w: 480, h: 96 },
      cta: { cx: 360, cy: 1198, w: 560, h: 50, size: 28 },
      foot: { x: 40, ys: [1242, 1268], size: 18, min: 14, max: 640 },
      chipSize: { w: 120, h: 46, r: 15 },
    };
  }

  function landscapeLayout() {
    const boxes = [112, 296, 480].map((y) => ({ x: 572, y, w: 428, h: 168 }));
    return {
      DW: 1280, DH: 720, tall: false,
      eyebrow: { x: 32, y: 38, size: 20 },
      headline: { x: 32, y: 90, size: 42, min: 34, max: 1216 },
      fusen: { x: 300, y: 104, w: 230, h: 90, pad: 14, title: 18, titleY: 128, label: 30, labelY: 164 },
      book: {
        x: 24, y: 174, w: 506, h: 202, spine: 277, line: 2,
        left: { x: 42, w: 220 }, right: { x: 294, w: 216 },
        headY: 212, headSize: 20, qY: 248, qSize: 24, qMin: 20, qLineH: 31, qLines: 3, docY: 360, docSize: 18,
        ref: { 1: { size: 36, min: 24, ys: [262] }, 2: { size: 30, min: 22, ys: [254, 294] }, 3: { size: 24, min: 18, ys: [244, 274, 304] } },
        clock: { cx: 480, cy: 330, r: 28 },
        chips: { y: 320, h: 28, size: 17, gap: 8 },
      },
      strip: {
        x: 24, w: 506, before: 392, after: 460, h: 60, h2: 104, line: 2.5,
        tab: { dx: 12, labelY: 25, label: 22, scoreY: 50, score: 14, scoreMin: 11, w: 88 },
        textX: 108, one: { y: 42, size: 32, min: 22 }, two: { ys: [40, 84], size: 27, min: 19 },
        clock: { dx: 40, cy: 30, r: 20 },
        attach: { dx: 84, dy: 66, h: 46, size: 28, min: 20 },
      },
      bus: 548,
      boxes,
      tool(i) {
        const b = boxes[i];
        return {
          box: b, bar: 8,
          label: { x: b.x + 24, y: b.y + 54, size: 36, min: 30, align: "left", max: 250 },
          inst: { cx: b.x + 142, cy: b.y + 116, s: 0.85 },
          token: { x: b.x + 290, y: b.y + 46, w: 120, h: 84, size: 40 },
        };
      },
      bus2: 1016,
      card: { x: 1032, y: 226, w: 224, h: 228 },
      cta: { cx: 1144, cy: 504, w: 224, h: 66, size: 19 },
      foot: { x: 32, ys: [702], size: 16, min: 13, max: 1216 },
      chipSize: { w: 96, h: 38, r: 12 },
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
  const isText = (v) => typeof v === "string" && v.trim() !== "";
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    if (isObject(a) && isObject(b)) {
      const ka = Object.keys(a);
      const kb = Object.keys(b);
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
        // JSON assets are parsed; the Python source is kept as plain text only and never executed.
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

  function validateInput(input) {
    check(isObject(input) && input.format === PIN.inputFormat && input.fictional === true, "faq-pairs.json が架空の固定入力（studio-yebisu-faq-fixture-v1）ではありません。");
    check(isText(input.annotation_source) && isObject(input.label_meanings) && LABELS.every((l) => isText(input.label_meanings[l])),
      "faq-pairs.json に照合メモの出所と3種類のラベルの説明がありません。");
    check(Array.isArray(input.documents) && deepEqual(input.documents.map((d) => d?.id), PIN.docs), "faq-pairs.json の資料が D01〜D10 の10件ではありません。");
    const docs = new Map();
    for (const d of input.documents) {
      check(isText(d.title) && isText(d.text), `faq-pairs.json の資料 ${d.id} の題名か本文が空です。`);
      docs.set(d.id, d);
    }
    check(Array.isArray(input.cases) && deepEqual(input.cases.map((c) => c?.id), PIN.ids), "faq-pairs.json の問いが Q01〜Q10 の10件ではありません。");
    for (const c of input.cases) {
      check(isText(c.question) && isText(c.reference), `${c.id} の質問または参照文が空です。`);
      const cited = c.reference_document_ids;
      check(Array.isArray(cited) && cited.length === 1 && docs.has(cited[0]) && docs.get(cited[0]).text === c.reference, `${c.id} の参照文が根拠資料の本文と一致しません。`);
      for (const s of SIDES) {
        const a = c[s];
        check(isObject(a) && isText(a.response) && !own(a, "scores") && isObject(a.annotation) && LABELS.includes(a.annotation.label) && isText(a.annotation.note),
          `${c.id} の${SIDE_LABEL[s]}の回答か照合メモの形が違います。`);
      }
    }
    return docs;
  }

  function validateResult(result, input, docs) {
    check(isObject(result) && result.format === PIN.resultFormat && result.fictional === true, "evaluation.json が元の採点結果の形式ではありません。");
    check(deepEqual(result.source, { repository: PIN.repository, commit: PIN.commit }), "evaluation.json の Ragas の固定コミットが一致しません。");
    check(result.input_sha256 === SHA["faq-pairs.json"], "evaluation.json の input_sha256 が faq-pairs.json と一致しません。");
    const rt = result.runtime ?? {};
    check(rt.metric_api === PIN.metricApi && rt.metric_calls === PIN.calls, "evaluation.json が ragas.metrics.collections の60回の呼び出しの記録ではありません。");
    check(Array.isArray(rt.network_attempts) && rt.network_attempts.length === 0 && rt.tracking_disabled === true, "evaluation.json の採点中の通信0件・利用状況の送信停止が確認できません。");
    check(rt.python === PIN.python && rt.rapidfuzz_version === PIN.rapidfuzz && rt.ragas_distribution_version === PIN.buildLabel,
      "evaluation.json の Python・rapidfuzz・手元の版名が元の実行と一致しません。");
    check(Array.isArray(result.metrics) && result.metrics.length === 3 && result.metrics.every((m, i) => m.id === METRIC_IDS[i] && m.ragas_class === METRIC_CLASSES[i]
      && deepEqual(m.range, [0, 1]) && isText(m.label) && isText(m.description)) && result.metrics[1].distance === "LEVENSHTEIN",
    "evaluation.json の3指標の定義が一致しません。");
    check(result.annotation_source === input.annotation_source && deepEqual(result.label_meanings, input.label_meanings), "evaluation.json の照合メモの出所かラベルの説明が入力と一致しません。");
    check(deepEqual(result.documents, input.documents), "evaluation.json の10資料が入力と一致しません。");
    check(Array.isArray(result.rows) && deepEqual(result.rows.map((r) => r?.id), PIN.ids), "evaluation.json の問いが Q01〜Q10 の10件ではありません。");
    result.rows.forEach((r, i) => {
      const c = input.cases[i];
      check(r.question === c.question && r.reference === c.reference && deepEqual(r.reference_document_ids, c.reference_document_ids), `${r.id} の質問・参照文・資料IDが入力と一致しません。`);
      for (const s of SIDES) {
        check(r[s].response === c[s].response && deepEqual(r[s].annotation, c[s].annotation), `${r.id} の${SIDE_LABEL[s]}の回答か照合メモが入力と一致しません。`);
        const sc = r[s].scores;
        check(isObject(sc) && deepEqual(Object.keys(sc), METRIC_IDS), `${r.id} の${SIDE_LABEL[s]}に3つの値がそろっていません。`);
        for (const m of METRIC_IDS) {
          const v = sc[m];
          check(typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 && (!BINARY.has(m) || v === 0 || v === 1), `${r.id} の${SIDE_LABEL[s]}の ${m} が範囲外です。`);
        }
      }
    });
    for (const s of SIDES) {
      const part = result.summary?.[s];
      check(isObject(part), `evaluation.json の${SIDE_LABEL[s]}の集計がありません。`);
      for (const m of METRIC_IDS) {
        const mean = result.rows.reduce((sum, r) => sum + r[s].scores[m], 0) / result.rows.length;
        check(Math.abs(part.mean[m] - mean) <= 1e-9, `evaluation.json の${SIDE_LABEL[s]}の平均（${m}）が各問の値と合いません。`);
      }
      check(part.exact_match_count === result.rows.filter((r) => r[s].scores.exact_match === 1).length
        && part.string_presence_count === result.rows.filter((r) => r[s].scores.string_presence === 1).length, `evaluation.json の${SIDE_LABEL[s]}の件数が各問の値と合いません。`);
      check(LABELS.every((l) => result.annotation_counts?.[s]?.[l] === result.rows.filter((r) => r[s].annotation.label === l).length), "evaluation.json の照合メモのラベル数が各問と合いません。");
    }
    const sm = result.summary;
    check(sm.case_count === 10 && sm.before.exact_match_count === PIN.summary.beforeExact && sm.after.exact_match_count === PIN.summary.afterExact
      && sm.before.string_presence_count === PIN.summary.beforePresence && sm.after.string_presence_count === PIN.summary.afterPresence
      && sm.before.mean.string_similarity === PIN.summary.beforeSim && sm.after.mean.string_similarity === PIN.summary.afterSim,
    "evaluation.json の集計が元の実行の値（4→7・4→8・近さの平均）と一致しません。");
    check(result.annotation_counts.source === "input", "evaluation.json の照合メモのラベル数が入力の値として記録されていません。");
  }

  const hourOf = (token) => {
    const m = /^(\d+)時$/.exec(token);
    return m ? Number(m[1]) : null;
  };
  const joined = (lines) => lines.join("");

  // Builds what the picture draws for one case, checking every fragment against the saved strings.
  function buildView(row, focus) {
    const v = VIEWS[row.id];
    const bad = `図で使う ${row.id} の断片が保存結果の文字列と一致しません。`;
    check(row.reference.includes(joined(v.ref)) && row.before.response.includes(joined(v.before)) && row.after.response.includes(joined(v.after)), bad);
    const view = {
      id: row.id,
      docId: row.reference_document_ids[0],
      question: row.question,
      row,
      ref: decorate(v.ref, row.reference),
      before: decorate(v.before, row.before.response),
      // With an attached slip the strip holds exactly the reference; the slip shows the rest.
      after: decorate(v.after, v.attach ? row.reference : row.after.response),
      rawRef: v.ref,
      rawBefore: v.before,
      rawAfter: v.after,
      clock: null,
      attach: null,
      chips: null,
    };
    check(isObject(focus), `diagram-data.json に ${row.id} の焦点がありません。`);
    if (v.clock) {
      check(focus.type === "clock" && v.ref[0].includes(focus.reference_token) && row.reference.includes(focus.reference_token)
        && v.before[0].includes(focus.before_token) && row.before.response.includes(focus.before_token)
        && v.after[0].includes(focus.after_token) && row.after.response.includes(focus.after_token), bad);
      view.clock = { reference: hourOf(focus.reference_token), before: hourOf(focus.before_token), after: hourOf(focus.after_token) };
      check(SIDES.every((s) => Number.isInteger(view.clock[s])) && Number.isInteger(view.clock.reference), bad);
    }
    if (v.attach) {
      check(focus.type === "attachment" && focus.added_text === v.attach && row.after.response === row.reference + v.attach
        && row.before.response === row.reference && row.reference.includes(focus.reference_token) && joined(v.ref).includes(focus.reference_token), bad);
      view.attach = v.attach;
    }
    if (v.chips) {
      check(focus.type === "same_conditions" && deepEqual(focus.conditions, v.chips) && joined(v.after) === row.after.response
        && v.refTokens.every((t) => joined(v.ref).includes(t)) && v.afterTokens.every((t) => joined(v.after).includes(t))
        && row.after.annotation.note.startsWith(v.chips.join("・")), bad);
      view.chips = { labels: v.chips, refTokens: v.refTokens, afterTokens: v.afterTokens };
    }
    return view;
  }

  // Adds … where a fragment is cut from a longer saved string.
  function decorate(lines, full) {
    const text = joined(lines);
    const out = lines.slice();
    if (!full.startsWith(text)) out[0] = `…${out[0]}`;
    if (!full.endsWith(text)) out[out.length - 1] = `${out[out.length - 1]}…`;
    return out;
  }

  function buildFilm(data) {
    const result = data["evaluation.json"];
    const input = data["faq-pairs.json"];
    const source = data["metric-source.py"];
    const old = data["original-verification.json"];
    const upstream = data["upstream.json"];
    const facts = data["diagram-data.json"];
    const timeline = data["timeline.json"];

    const docs = validateInput(input);
    validateResult(result, input, docs);

    check(typeof source === "string" && SOURCE_NEEDLES.every((n) => source.includes(n)), "metric-source.py が固定版の3指標の実装ではありません。");
    check(upstream?.repository === PIN.repository && upstream.commit === PIN.commit && upstream.license === PIN.license
      && upstream.files_sha256?.["src/ragas/metrics/collections/_string.py"] === SHA["metric-source.py"], "upstream.json の原典・ライセンス・_string.py のハッシュが一致しません。");

    // The original record of the earlier real run. Its movie/browser entries describe the OLD film only.
    const dc = old?.data_checks ?? {};
    const env = old?.runtime_environment ?? {};
    check(old?.source_commit === PIN.commit && dc.status === "passed" && dc.source_commit === PIN.commit && dc.actual_ragas_metric_calls === PIN.calls
      && dc.input_sha256 === SHA["faq-pairs.json"] && dc.evaluation_sha256 === SHA["evaluation.json"] && dc.question_count === 10 && dc.response_count === 20,
    "original-verification.json の元の実行の記録が素材と一致しません。");
    check(env.python === PIN.python && env.version === PIN.buildLabel && env.upstream_release_version_claimed === false
      && env.all_installed_python_source_files_match_fixed === PIN.sourceFiles && env.dependency_count === PIN.packages && env.installed_source_matches_fixed === true,
    "original-verification.json の実行環境（Python・237ファイル・93パッケージ・手元の版名）が一致しません。");
    const independent = dc.independent_full_unicode_distance_comparison;
    check(Array.isArray(independent) && independent.length === 20 && independent.every((e) => {
      const row = result.rows.find((r) => r.id === e.id);
      return row && SIDES.includes(e.stage) && deepEqual(e.independent_expected_scores, row[e.stage].scores);
    }), "original-verification.json の独立した照合20件が保存結果の値と一致しません。");
    check(old.human_approval === false && dc.human_approval === false, "original-verification.json に人による承認の主張があります。");

    check(facts?.format === PIN.diagramFormat && facts.fictional === true && facts.source_evaluation_sha256 === SHA["evaluation.json"] && facts.source_input_sha256 === SHA["faq-pairs.json"],
      "diagram-data.json の形式か元の記録が違います。");
    for (const key of ["summary", "annotation_counts", "metrics", "documents", "rows", "annotation_source"]) {
      check(deepEqual(facts[key], result[key]), `diagram-data.json の ${key} が保存結果と一致しません。`);
    }

    check(timeline?.format === PIN.timelineFormat && timeline.duration === DURATION && timeline.fps === 30 && timeline.frames === 960 && timeline.silent === true,
      "timeline.json が32秒・30fps・960フレーム・無音ではありません。");
    check(Array.isArray(timeline.scenes) && timeline.scenes.length === SCENE_PLAN.length
      && timeline.scenes.every((s, i) => s.id === SCENE_PLAN[i].id && s.in === SCENE_PLAN[i].in && s.out === SCENE_PLAN[i].out && s.case === SCENE_PLAN[i].case && isText(s.headline)),
    "timeline.json の6場面が固定の時刻表と一致しません。");

    const rows = Object.fromEntries(result.rows.map((r) => [r.id, r]));
    const views = {};
    for (const id of Object.keys(VIEWS)) views[id] = buildView(rows[id], facts.focus?.[id]);
    return {
      views,
      headlines: Object.fromEntries(timeline.scenes.map((s) => [s.id, s.headline])),
    };
  }

  async function load() {
    const data = await loadAssets();
    const built = buildFilm(data);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return built;
  }

  // --- Time helpers (pure functions of t) ------------------------------------------------------

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const clampTime = (seconds) => {
    const t = Number(seconds);
    return Number.isFinite(t) ? Math.max(0, Math.min(DURATION, t)) : 0;
  };
  const show = (metricId, v) => (BINARY.has(metricId) ? String(v) : v.toFixed(3));

  function sceneAt(t) {
    let i = 0;
    for (let k = 0; k < SCENE_PLAN.length; k += 1) if (t >= SCENE_PLAN[k].in) i = k;
    return i;
  }

  // Everything the frame needs, derived only from the absolute time.
  function stateAt(time) {
    const t = clampTime(time);
    const i = sceneAt(t);
    const sc = SCENE_PLAN[i];
    const prev = i > 0 ? SCENE_PLAN[i - 1] : null;
    const local = t - sc.in;
    const beat = BEATS[sc.id];
    const view = film.views[sc.case];
    const prevView = prev ? film.views[prev.case] : null;
    const caseChange = Boolean(prev && prev.case !== sc.case);
    const st = {
      t, i, sc, local, beat, view, prevView, caseChange,
      outA: caseChange ? 1 - ramp(local, 0, 0.3) : 0,
      inA: caseChange ? ramp(local, 0.3, 0.6) : 1,
      geomK: caseChange ? ease(ramp(local, 0, 0.6)) : 1,
      // 1 = 変更後 is the strip being measured.
      sideK: beat.swap ? ease(ramp(local, beat.swap[0], beat.swap[1])) : 1,
      build: beat.build ? ease(ramp(local, beat.build[0], beat.build[1])) : 1,
    };
    st.side = st.sideK >= 0.5 ? "after" : "before";
    return st;
  }

  // Which values a tool shows at this moment, and how far it is engaged (0 = idle, 1 = settled).
  function toolState(st, i, frac) {
    const { local, beat, view, prevView } = st;
    if (beat.travel) {
      const at = beat.travel.start + beat.travel.dur * frac[i];
      if (local >= at - 0.15) return { view, side: beat.travel.side, k: ease(ramp(local, at - 0.15, at + 0.25)) };
    }
    if (beat.early && local >= beat.early.at) {
      const off = beat.swap ? ease(ramp(local, beat.swap[0], beat.swap[0] + 0.3)) : 0;
      return { view, side: beat.early.side, k: ease(ramp(local, beat.early.at, beat.early.at + 0.3)) * (1 - off) };
    }
    if (prevView && local < 0.3) return { view: prevView, side: "after", k: 1 - ease(ramp(local, 0, 0.3)) };
    return { view, side: "after", k: 0 };
  }

  // --- Drawing primitives ----------------------------------------------------------------------

  function withAlpha(a, fn) {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, a);
    fn();
    ctx.restore();
  }

  function roundRectPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fitSize(str, maxW, size, min, weight = 700, family = SANS) {
    let s = size;
    ctx.font = font(s, weight, family);
    while (s > min && ctx.measureText(str).width > maxW) {
      s -= 1;
      ctx.font = font(s, weight, family);
    }
    return s;
  }

  function text(str, x, y, size, opts = {}) {
    ctx.font = font(size, opts.weight ?? 700, opts.family ?? SANS);
    ctx.fillStyle = opts.color ?? C.ink;
    ctx.textAlign = opts.align ?? "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
  }

  function measure(str, size, weight = 700) {
    ctx.font = font(size, weight);
    return ctx.measureText(str).width;
  }

  // Greedy per-character wrap (Japanese) to a pixel width.
  function wrapMeasure(str, maxW, size, weight, maxLines) {
    const chars = Array.from(str);
    const lines = [];
    let cur = "";
    ctx.font = font(size, weight);
    for (const ch of chars) {
      if (cur && ctx.measureText(cur + ch).width > maxW) {
        lines.push(cur);
        cur = ch;
      } else cur += ch;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = `${Array.from(lines[maxLines - 1]).slice(0, -1).join("")}…`;
    }
    return lines;
  }

  // Draws a line whose differing characters are bold, dark and underlined; the rest is muted ink.
  function drawMarked(str, flags, x, y, size) {
    const chars = Array.from(str);
    let cx = x;
    let k = 0;
    while (k < chars.length) {
      const f = flags[k];
      let run = "";
      while (k < chars.length && flags[k] === f) run += chars[k++];
      const weight = f ? 800 : 600;
      ctx.font = font(size, weight);
      ctx.fillStyle = f ? C.ink : C.muted;
      ctx.textAlign = "left";
      ctx.fillText(run, cx, y);
      const w = ctx.measureText(run).width;
      if (f) ctx.fillRect(cx, y + size * 0.14, w, Math.max(2, size * 0.07));
      cx += w;
    }
    return cx - x;
  }

  function diffFlags(refFrag, frag) {
    const a = Array.from(refFrag);
    const b = Array.from(frag);
    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
    let tail = 0;
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
    return b.map((_, i) => i >= head && i < b.length - tail);
  }

  function drawClock(cx, cy, r, hour, refHour, wedgeA, lineW) {
    const angle = (hr) => ((hr % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.lineWidth = lineW;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      const inner = k % 3 === 0 ? r * 0.78 : r * 0.88;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97);
      ctx.lineWidth = k % 3 === 0 ? lineW * 0.8 : lineW * 0.45;
      ctx.stroke();
    }
    if (refHour != null && refHour !== hour && wedgeA > 0) {
      withAlpha(wedgeA, () => {
        // The gap between the book's hour and this strip's hour.
        const a0 = angle(refHour);
        const a1 = angle(hour);
        const ccw = ((a1 - a0 + Math.PI * 4) % (Math.PI * 2)) > Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r * 0.86, a0, a1, ccw);
        ctx.closePath();
        ctx.fillStyle = C.mark;
        ctx.fill();
        ctx.setLineDash([lineW * 1.5, lineW * 1.5]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a0) * r * 0.7, cy + Math.sin(a0) * r * 0.7);
        ctx.strokeStyle = C.faint;
        ctx.lineWidth = lineW;
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
    const a = angle(hour);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = lineW * 1.4;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, r * 0.08), 0, Math.PI * 2);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.restore();
  }

  // --- Scene pieces ----------------------------------------------------------------------------

  function stripBox(which, view) {
    const s = L.strip;
    const h = which === "after" && view && view.after.length === 2 ? s.h2 : s.h;
    return { x: s.x, y: s[which], w: s.w, h };
  }

  function afterHeight(st) {
    const cur = stripBox("after", st.view).h;
    if (!st.caseChange) return cur;
    return lerp(stripBox("after", st.prevView).h, cur, st.geomK);
  }

  function activeStripGeom(st) {
    const which = st.side;
    const y = L.strip[which];
    const h = which === "after" ? afterHeight(st) : L.strip.h;
    return { x: L.strip.x, y, w: L.strip.w, h };
  }

  function drawEyebrow() {
    text("Ragas ・ 保存済みの結果 ・ 架空の10問",L.eyebrow.x, L.eyebrow.y, L.eyebrow.size, { color: C.muted, weight: 700 });
  }

  function drawHeadline(st) {
    const hl = L.headline;
    const sc = st.sc;
    const cur = film.headlines[sc.id];
    // Sequential crossfade at each scene boundary: the old line leaves before the new one arrives.
    const next = SCENE_PLAN[st.i + 1];
    let outA = 1;
    if (next && st.t > next.in - 0.3) outA = 1 - ramp(st.t, next.in - 0.3, next.in);
    const inA = st.i === 0 ? 1 : ramp(st.local, 0, 0.3);
    withAlpha(Math.min(outA, inA), () => {
      const size = fitSize(cur, hl.max, hl.size, hl.min, 800);
      text(cur, hl.x, hl.y, size, { weight: 800 });
    });
  }

  function drawFusen(st) {
    const f = L.fusen;
    ctx.save();
    ctx.fillStyle = C.warmWash;
    ctx.strokeStyle = C.warm;
    ctx.lineWidth = L.tall ? 3 : 2.5;
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.fill();
    ctx.stroke();
    text("照合メモ（入力）", f.x + f.pad, f.titleY, f.title, { color: C.warmInk, weight: 800 });
    const labelFor = (view, side) => SHORT_LABEL[view.row[side].annotation.label];
    const drawLabel = (view, side, a) => withAlpha(a, () => {
      text(SIDE_LABEL[side], f.x + f.w - f.pad, f.titleY, f.title, { color: C.warmInk, weight: 600, align: "right" });
      const str = labelFor(view, side);
      const size = fitSize(str, f.w - f.pad * 2, f.label, Math.round(f.label * 0.7), 800);
      text(str, f.x + f.pad, f.labelY, size, { color: C.warmInk, weight: 800 });
    });
    if (st.caseChange) {
      drawLabel(st.prevView, "after", st.outA);
      drawLabel(st.view, st.beat.swap ? "before" : "after", st.inA * (st.beat.swap ? 1 - ramp(st.local, st.beat.swap[0], st.beat.swap[0] + 0.2) : 1));
      if (st.beat.swap) drawLabel(st.view, "after", ramp(st.local, st.beat.swap[0] + 0.2, st.beat.swap[1]));
    } else {
      drawLabel(st.view, "after", 1);
    }
    ctx.restore();
  }

  function drawBookShape() {
    const b = L.book;
    const { x, y, w, h, spine } = b;
    ctx.save();
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = b.line;
    for (const k of [8, 15]) {
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h - 2 + k * 0.4);
      ctx.quadraticCurveTo((x + spine) / 2, y + h - 12 + k, spine, y + h + k * 0.5);
      ctx.quadraticCurveTo((spine + x + w) / 2, y + h - 12 + k, x + w - 4, y + h - 2 + k * 0.4);
      ctx.stroke();
    }
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = b.line;
    for (const edge of [x, x + w]) {
      ctx.beginPath();
      ctx.moveTo(edge, y + 10);
      ctx.quadraticCurveTo((edge + spine) / 2, y - 8, spine, y + 12);
      ctx.lineTo(spine, y + h + 2);
      ctx.quadraticCurveTo((edge + spine) / 2, y + h - 16, edge, y + h - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function refBlock(view) {
    const spec = L.book.ref[view.ref.length];
    const maxW = L.book.right.w;
    let size = spec.size;
    for (const line of view.ref) size = Math.min(size, fitSize(line, maxW, spec.size, spec.min, 700));
    return { spec, size };
  }

  // Position of a token inside a set of drawn lines (for the Q05 condition marks).
  function tokenBox(lines, rawLines, token, x, ys, size, weight) {
    for (let li = 0; li < lines.length; li += 1) {
      const raw = rawLines[li];
      const idx = raw.indexOf(token);
      if (idx < 0) continue;
      const prefix = (lines[li].startsWith("…") && !raw.startsWith("…") ? "…" : "") + raw.slice(0, idx);
      const x0 = x + measure(prefix, size, weight);
      return { x: x0, y: ys[li], w: measure(token, size, weight), size };
    }
    return null;
  }

  function drawBookContent(view, a, st, anchors) {
    const b = L.book;
    withAlpha(a, () => {
      text(`問い ${view.id}`, b.left.x, b.headY, b.headSize, { color: C.muted });
      const qSize = Math.max(b.qMin, b.qSize);
      wrapMeasure(view.question, b.left.w, qSize, 700, b.qLines).forEach((line, i) => text(line, b.left.x, b.qY + i * b.qLineH, qSize, { weight: 700 }));
      text(`資料 ${view.docId}`, b.left.x, b.docY, b.docSize, { color: C.muted, weight: 600 });
      text("参照文", b.right.x, b.headY, b.headSize, { color: C.muted });
      const { spec, size } = refBlock(view);
      view.ref.forEach((line, i) => text(line, b.right.x, spec.ys[i], size, { weight: 700 }));
      if (view.clock) drawClock(b.clock.cx, b.clock.cy, b.clock.r, view.clock.reference, null, 0, L.tall ? 3 : 2.5);
      if (view.chips) {
        // The three conditions as written in the reference: marked in place, named on chips below.
        const cb = b.chips;
        let cx = b.right.x;
        view.chips.labels.forEach((label, k) => {
          const tb = tokenBox(view.ref, view.rawRef, view.chips.refTokens[k], b.right.x, spec.ys, size, 700);
          if (tb) {
            ctx.fillStyle = C.ink;
            ctx.fillRect(tb.x, tb.y + size * 0.16, tb.w, Math.max(2, size * 0.08));
          }
          const w = measure(label, cb.size, 800) + cb.size * 1.1;
          roundRectPath(cx, cb.y, w, cb.h, cb.h / 2);
          ctx.fillStyle = C.white;
          ctx.fill();
          ctx.lineWidth = L.tall ? 2.5 : 2;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
          text(label, cx + w / 2, cb.y + cb.h * 0.72, cb.size, { weight: 800, align: "center" });
          if (anchors) anchors.chips[k] = { x: cx + w / 2, y: cb.y + cb.h };
          cx += w + cb.gap;
        });
      }
    });
  }

  function stripPath(x, y, w, h) {
    const tooth = L.tall ? 8 : 6;
    const steps = Math.max(2, Math.round(h / (tooth * 1.4)));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - tooth, y);
    for (let k = 0; k < steps; k += 1) ctx.lineTo(x + w - (k % 2 ? tooth : 0), y + ((k + 1) * h) / steps);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }

  function drawStripShape(which, h, activeA) {
    const s = L.strip;
    const y = s[which];
    withAlpha(0.45 + 0.55 * activeA, () => {
      stripPath(s.x, y, s.w, h);
      ctx.fillStyle = C.white;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = lerp(s.line * 0.5, s.line, activeA);
      ctx.stroke();
    });
  }

  function drawStripContent(view, which, a, activeA, st, anchors) {
    const s = L.strip;
    const y = s[which];
    const row = view.row[which];
    const lines = view[which];
    const raw = which === "before" ? view.rawBefore : view.rawAfter;
    withAlpha(a * (0.45 + 0.55 * activeA), () => {
      text(SIDE_LABEL[which], s.x + s.tab.dx, y + s.tab.labelY, s.tab.label, { weight: 800 });
      // The strip's own saved values, small, in the tools' colours.
      const parts = METRIC_IDS.map((m) => show(m, row.scores[m]));
      const sep = " ・ ";
      const full = parts.join(sep);
      const size = fitSize(full, s.tab.w, s.tab.score, s.tab.scoreMin, 700);
      let cx = s.x + s.tab.dx;
      parts.forEach((p, k) => {
        text(p, cx, y + s.tab.scoreY, size, { color: TOOLS[k].ink, weight: 800 });
        cx += measure(p, size, 800);
        if (k < 2) {
          text(sep, cx, y + s.tab.scoreY, size, { color: C.faint, weight: 600 });
          cx += measure(sep, size, 600);
        }
      });
      const right = s.x + s.w - (view.clock ? s.clock.dx * 2 : 24);
      const maxW = right - (s.x + s.textX);
      const tx = s.x + s.textX;
      const refFrag = view.ref.length === 1 ? view.ref[0] : null;
      if (lines.length === 1) {
        const size1 = fitSize(lines[0], maxW, s.one.size, s.one.min, 800);
        const flags = refFrag ? diffFlags(refFrag, lines[0]) : Array.from(lines[0]).map(() => false);
        drawMarked(lines[0], flags, tx, y + s.one.y, size1);
      } else {
        let size2 = s.two.size;
        for (const line of lines) size2 = Math.min(size2, fitSize(line, maxW, s.two.size, s.two.min, 600));
        lines.forEach((line, i) => drawMarked(line, Array.from(line).map(() => false), tx, y + s.two.ys[i], size2));
        if (view.chips && which === "after" && anchors) {
          view.chips.afterTokens.forEach((token, k) => {
            const tb = tokenBox(lines, raw, token, tx, s.two.ys.map((d) => y + d), size2, 600);
            if (tb) anchors.tokens[k] = tb;
          });
        }
      }
      if (view.clock) {
        const wedge = st.sc.id === "overview" ? 0 : st.sc.id === "deadline" ? ramp(st.local, 1.6, 2.0) : 1;
        drawClock(s.x + s.w - s.clock.dx, y + s.clock.cy, s.clock.r, view.clock[which], view.clock.reference, wedge, L.tall ? 2.5 : 2);
      }
      if (view.attach && which === "after") {
        // The added sentence: a separate slip taped under the answer that holds the whole reference.
        const at = s.attach;
        const ax = s.x + at.dx;
        const ay = y + at.dy;
        const asz = fitSize(view.attach, s.x + s.w - ax - 40, at.size, at.min, 800);
        const aw = measure(view.attach, asz, 800) + asz;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(-0.012);
        ctx.fillStyle = C.attach;
        ctx.fillRect(0, 0, aw, at.h);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = L.tall ? 2 : 1.5;
        ctx.strokeRect(0, 0, aw, at.h);
        ctx.fillStyle = "rgba(207,197,176,0.95)";
        ctx.fillRect(-10, -8, 34, 16);
        text(view.attach, asz * 0.5, at.h * 0.72, asz, { weight: 800 });
        ctx.restore();
      }
    });
  }

  function drawLeaders(st, anchors) {
    if (st.sc.id !== "paraphrase" || !st.beat.leaders) return;
    const k = ease(ramp(st.local, st.beat.leaders[0], st.beat.leaders[1]));
    if (k <= 0) return;
    withAlpha(st.inA, () => {
      ctx.save();
      ctx.strokeStyle = C.warm;
      ctx.lineWidth = L.tall ? 3 : 2.5;
      ctx.setLineDash(L.tall ? [8, 7] : [6, 5]);
      anchors.chips.forEach((c, i) => {
        const tk = anchors.tokens[i];
        if (!c || !tk) return;
        const ex = tk.x + tk.w / 2;
        const ey = tk.y - tk.size * 0.95;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(lerp(c.x, ex, k), lerp(c.y, ey, k));
        ctx.stroke();
      });
      ctx.setLineDash([]);
      // Once a line arrives, the matching words on the answer are marked.
      withAlpha(ramp(k, 0.85, 1), () => {
        ctx.fillStyle = C.warm;
        anchors.tokens.forEach((tk) => {
          if (tk) ctx.fillRect(tk.x, tk.y + tk.size * 0.16, tk.w, Math.max(2, tk.size * 0.09));
        });
      });
      ctx.restore();
    });
  }

  function drawClockGhost(st) {
    if (st.sc.id !== "deadline" || !st.view.clock) return;
    const [a, b] = st.beat.clockDrop;
    if (st.local < a || st.local > b + 0.2) return;
    const k = ease(ramp(st.local, a, b));
    const bc = L.book.clock;
    const s = L.strip;
    const tx = s.x + s.w - s.clock.dx;
    const ty = s.after + s.clock.cy;
    const cx = lerp(bc.cx, tx, k);
    const cy = lerp(bc.cy, ty, k);
    const r = lerp(bc.r, s.clock.r, k);
    withAlpha(0.85 * (1 - ramp(st.local, b, b + 0.2)), () => {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
      const ang = ((st.view.clock.reference % 12) / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * r * 0.7, cy + Math.sin(ang) * r * 0.7);
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    });
  }

  function connectorPaths(st) {
    const g = activeStripGeom(st);
    const ts = TOOLS.map((_, i) => L.tool(i));
    const segs = [];
    if (L.tall) {
      const midX = L.DW / 2;
      const xs = ts.map((t) => t.inst.cx);
      segs.push([[midX, g.y + g.h], [midX, L.bus]]);
      segs.push([[xs[0], L.bus], [xs[2], L.bus]]);
      xs.forEach((x, i) => segs.push([[x, L.bus], [x, ts[i].box.y]]));
      xs.forEach((x, i) => segs.push([[x, ts[i].box.y + ts[i].box.h], [x, L.bus2]]));
      segs.push([[xs[0], L.bus2], [xs[2], L.bus2]]);
      segs.push([[midX, L.bus2], [midX, L.card.y]]);
    } else {
      const ys = ts.map((t) => t.inst.cy);
      const mid = g.y + g.h / 2;
      segs.push([[g.x + g.w, mid], [L.bus, mid]]);
      segs.push([[L.bus, Math.min(mid, ys[0])], [L.bus, Math.max(mid, ys[2])]]);
      ys.forEach((y, i) => segs.push([[L.bus, y], [ts[i].box.x, y]]));
      ys.forEach((y, i) => segs.push([[ts[i].box.x + ts[i].box.w, y], [L.bus2, y]]));
      segs.push([[L.bus2, ys[0]], [L.bus2, ys[2]]]);
      segs.push([[L.bus2, L.card.y + L.card.h / 2], [L.card.x, L.card.y + L.card.h / 2]]);
    }
    return segs;
  }

  function drawConnectors(st) {
    const segs = connectorPaths(st);
    ctx.save();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = L.tall ? 3 : 2.5;
    ctx.lineCap = "round";
    // During the opening build the lines draw in order; afterwards all are complete.
    const n = segs.length;
    segs.forEach((seg, i) => {
      const k = clamp01(st.build * n - i);
      if (k <= 0) return;
      ctx.beginPath();
      ctx.moveTo(seg[0][0], seg[0][1]);
      ctx.lineTo(lerp(seg[0][0], seg[1][0], k), lerp(seg[0][1], seg[1][1], k));
      ctx.stroke();
    });
    ctx.restore();
  }

  // The miniature's route: active strip → tool 1 → tool 2 → tool 3 → saved question.
  function chipRoute(st) {
    const g = activeStripGeom(st);
    const ts = TOOLS.map((_, i) => L.tool(i).inst);
    let pts;
    if (L.tall) {
      const midX = L.DW / 2;
      pts = [[midX, g.y + g.h / 2], [midX, L.bus], [ts[0].cx, L.bus], [ts[0].cx, ts[0].cy], [ts[1].cx, ts[1].cy], [ts[2].cx, ts[2].cy],
        [ts[2].cx, L.bus2], [midX, L.bus2], [midX, L.card.y + L.card.h / 2]];
    } else {
      const mid = g.y + g.h / 2;
      pts = [[g.x + g.w * 0.75, mid], [L.bus, mid], [L.bus, ts[0].cy], [ts[0].cx, ts[0].cy], [ts[1].cx, ts[1].cy], [ts[2].cx, ts[2].cy],
        [L.bus2, ts[2].cy], [L.bus2, L.card.y + L.card.h / 2], [L.card.x + L.card.w / 2, L.card.y + L.card.h / 2]];
    }
    const lens = [];
    let total = 0;
    for (let i = 1; i < pts.length; i += 1) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(d);
      total += d;
    }
    const cum = [0];
    lens.forEach((d) => cum.push(cum[cum.length - 1] + d));
    const frac = [3, 4, 5].map((idx) => cum[idx] / total);
    const at = (u) => {
      let dist = clamp01(u) * total;
      for (let i = 0; i < lens.length; i += 1) {
        if (dist <= lens[i] || i === lens.length - 1) {
          const k = lens[i] ? Math.min(1, dist / lens[i]) : 1;
          return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
        }
        dist -= lens[i];
      }
      return pts[pts.length - 1];
    };
    return { frac, at };
  }

  function drawComb(v, k, color) {
    // Reference comb above, answer comb below: identical strings lock together; any difference leaves a gap.
    ctx.fillStyle = color;
    ctx.fillRect(-80, -42, 160, 12);
    for (let j = 0; j < 6; j += 1) ctx.fillRect(-74 + j * 28, -30, 12, 18);
    const target = v === 1 ? { yb: -12, shift: 0 } : { yb: 12, shift: 14 };
    const yb = lerp(32, target.yb, k);
    const shift = lerp(0, target.shift, k);
    ctx.fillStyle = C.white;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.fillRect(-80 + shift, yb, 160, 12);
    ctx.strokeRect(-80 + shift, yb, 160, 12);
    for (let j = 0; j < 5; j += 1) {
      ctx.fillRect(-60 + j * 28 + shift, yb - 18, 12, 18);
      ctx.strokeRect(-60 + j * 28 + shift, yb - 18, 12, 18);
    }
  }

  function drawRuler(v, k, color) {
    const val = v * k;
    ctx.fillStyle = color;
    ctx.fillRect(-80, 14, 160 * val, 10);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-80, 8);
    ctx.lineTo(80, 8);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let j = 0; j <= 10; j += 1) {
      const x = -80 + 16 * j;
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x, 8 - (j % 5 === 0 ? 18 : 10));
      ctx.stroke();
    }
    withAlpha(0.35 + 0.65 * k, () => {
      const px = -80 + 160 * val;
      ctx.beginPath();
      ctx.moveTo(px, 2);
      ctx.lineTo(px - 11, -22);
      ctx.lineTo(px + 11, -22);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });
    text("0", -80, 46, 18, { color: C.muted, align: "center", weight: 700 });
    text("1", 80, 46, 18, { color: C.muted, align: "center", weight: 700 });
  }

  function drawSleeve(v, extra, k, color) {
    // A transparent sleeve the size of the whole reference.
    roundRectPath(-70, -28, 140, 56, 10);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
    ctx.setLineDash([10, 6]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    const x0 = lerp(-190, -56, k);
    withAlpha(0.35 + 0.65 * k, () => {
      if (v === 1) {
        ctx.fillStyle = color;
        ctx.fillRect(x0, -10, 112, 20);
        if (extra) {
          // The added slip stays outside the sleeve.
          ctx.save();
          ctx.translate(x0 + 112, -12);
          ctx.rotate(-0.07);
          ctx.fillStyle = C.attach;
          ctx.fillRect(0, 0, 54, 24);
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, 54, 24);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x0, -10, 52, 20);
        ctx.save();
        ctx.translate(lerp(-130, 6, k), lerp(-10, 14, k));
        ctx.rotate(lerp(0, 0.26, k));
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, 56, 20);
        ctx.restore();
      }
    });
  }

  function drawTools(st, route) {
    TOOLS.forEach((tool, i) => {
      const g = L.tool(i);
      const b = g.box;
      const ts = toolState(st, i, route.frac);
      const row = ts.view.row[ts.side];
      const v = row.scores[tool.id];
      ctx.save();
      roundRectPath(b.x, b.y, b.w, b.h, L.tall ? 18 : 14);
      ctx.fillStyle = tool.wash;
      ctx.fill();
      ctx.lineWidth = L.tall ? 3 : 2.5;
      ctx.strokeStyle = tool.ink;
      ctx.stroke();
      ctx.clip();
      ctx.fillStyle = tool.ink;
      ctx.fillRect(b.x, b.y, b.w, g.bar);
      const lab = g.label;
      const ls = fitSize(tool.label, lab.max, lab.size, lab.min, 800);
      text(tool.label, lab.x, lab.y, ls, { weight: 800, align: lab.align });
      ctx.save();
      ctx.translate(g.inst.cx, g.inst.cy);
      ctx.scale(g.inst.s, g.inst.s);
      if (i === 0) drawComb(v, ts.k, tool.ink);
      if (i === 1) drawRuler(v, ts.k, tool.ink);
      if (i === 2) drawSleeve(v, v === 1 && ts.view.row[ts.side].response !== ts.view.row.reference, ts.k, tool.ink);
      ctx.restore();
      const tk = g.token;
      roundRectPath(tk.x, tk.y, tk.w, tk.h, tk.h / 2);
      ctx.fillStyle = C.paper;
      ctx.fill();
      ctx.strokeStyle = tool.ink;
      ctx.lineWidth = L.tall ? 3 : 2.5;
      ctx.stroke();
      withAlpha(ts.k, () => {
        const str = show(tool.id, v);
        const sz = fitSize(str, tk.w - 16, tk.size, Math.round(tk.size * 0.7), 800);
        text(str, tk.x + tk.w / 2, tk.y + tk.h / 2 + sz * 0.36, sz, { weight: 800, align: "center" });
      });
      ctx.restore();
    });
  }

  function drawDocIcon(x, y, w, h) {
    const fold = w * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - fold, y);
    ctx.lineTo(x + w, y + fold);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = L.tall ? 2.5 : 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - fold, y);
    ctx.lineTo(x + w - fold, y + fold);
    ctx.lineTo(x + w, y + fold);
    ctx.stroke();
    ctx.lineWidth = L.tall ? 2 : 1.5;
    for (let k = 0; k < 3; k += 1) {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y + h * (0.48 + k * 0.15));
      ctx.lineTo(x + w * 0.82, y + h * (0.48 + k * 0.15));
      ctx.stroke();
    }
  }

  function drawCard(st) {
    const c = L.card;
    ctx.save();
    roundRectPath(c.x, c.y, c.w, c.h, L.tall ? 16 : 14);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = L.tall ? 3 : 2.5;
    ctx.stroke();
    const content = (view, a) => withAlpha(a, () => {
      if (L.tall) {
        drawDocIcon(c.x + 26, c.y + 16, 50, 64);
        text(`${view.id} ・ 資料${view.docId}`, c.x + 100, c.y + 44, 34, { weight: 800 });
        text(`nagi-faq-${view.id}.json`, c.x + 100, c.y + 80, 24, { color: C.muted, weight: 600, family: MONO });
      } else {
        drawDocIcon(c.x + 22, c.y + 20, 46, 60);
        text(view.id, c.x + 22, c.y + 122, 38, { weight: 800 });
        text(`資料${view.docId}`, c.x + 22, c.y + 160, 26, { weight: 700 });
        const fs = fitSize(`nagi-faq-${view.id}.json`, c.w - 36, 17, 12, 600, MONO);
        text(`nagi-faq-${view.id}.json`, c.x + 22, c.y + 202, fs, { color: C.muted, weight: 600, family: MONO });
      }
    });
    if (st.caseChange) {
      content(st.prevView, st.outA);
      content(st.view, st.inA);
    } else content(st.view, 1);
    ctx.restore();
  }

  function drawMini(x, y, view, side) {
    const m = L.chipSize;
    ctx.save();
    ctx.translate(x - m.w / 2, y - m.h / 2);
    ctx.fillStyle = C.white;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = L.tall ? 3 : 2.5;
    ctx.fillRect(0, 0, m.w, m.h);
    ctx.strokeRect(0, 0, m.w, m.h);
    ctx.lineWidth = L.tall ? 3 : 2;
    const lx = view.clock ? m.r * 2 + 12 : 10;
    for (let k = 0; k < 2; k += 1) {
      ctx.beginPath();
      ctx.moveTo(lx, m.h * (0.38 + k * 0.28));
      ctx.lineTo(m.w - 10, m.h * (0.38 + k * 0.28));
      ctx.stroke();
    }
    if (view.clock) drawClock(m.r + 6, m.h / 2, m.r, view.clock[side], view.clock.reference, 1, L.tall ? 2 : 1.6);
    if (view.attach && side === "after") {
      ctx.fillStyle = C.attach;
      ctx.fillRect(m.w * 0.55, m.h - 4, m.w * 0.5, m.h * 0.42);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(m.w * 0.55, m.h - 4, m.w * 0.5, m.h * 0.42);
    }
    if (view.chips && side === "after") {
      ctx.fillStyle = C.warm;
      for (let k = 0; k < 3; k += 1) {
        ctx.beginPath();
        ctx.arc(m.w * (0.3 + k * 0.2), m.h + 6, L.tall ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawTraveller(st, route) {
    const tr = st.beat.travel;
    if (!tr) return;
    const u = (st.local - tr.start) / tr.dur;
    if (u < 0 || u > 1) return;
    const a = Math.min(ramp(u, 0, 0.05), 1 - ramp(u, 0.95, 1));
    const [x, y] = route.at(u);
    withAlpha(a, () => drawMini(x, y, st.view, tr.side));
  }

  function drawCta(st) {
    if (!st.beat.cta) return;
    const a = ease(ramp(st.local, st.beat.cta[0], st.beat.cta[1]));
    if (a <= 0) return;
    const c = L.cta;
    withAlpha(a, () => {
      roundRectPath(c.cx - c.w / 2, c.cy - c.h / 2, c.w, c.h, L.tall ? c.h / 2 : 16);
      ctx.fillStyle = C.ink;
      ctx.fill();
      if (L.tall) {
        const str = "作例ページで、この問いをJSONで保存";
        const sz = fitSize(str, c.w - 32, c.size, 20, 800);
        text(str, c.cx, c.cy + sz * 0.36, sz, { color: C.paper, weight: 800, align: "center" });
      } else {
        text("作例ページで", c.cx, c.cy - 6, c.size - 2, { color: C.paper, weight: 700, align: "center" });
        const str = "この問いをJSONで保存";
        const sz = fitSize(str, c.w - 20, c.size, 14, 800);
        text(str, c.cx, c.cy + 22, sz, { color: C.paper, weight: 800, align: "center" });
      }
    });
  }

  function drawFooter() {
    const f = L.foot;
    const lines = L.tall
      ? ["架空の10問・保存済みの実結果（Ragas 298b682、60回の ascore）", "照合メモは制作担当の入力。道具の判定でも承認でもありません。無音。"]
      : ["架空の10問・保存済みの実結果（Ragas 298b682、60回の ascore）・照合メモは制作担当の入力で、道具の判定ではありません・無音"];
    lines.forEach((line, i) => {
      const sz = fitSize(line, f.max, f.size, f.min, 600);
      text(line, f.x, f.ys[i], sz, { color: C.muted, weight: 600 });
    });
  }

  let film = null;

  function drawFrame(time) {
    const st = stateAt(time);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.ivory;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(S, 0, 0, S, OX, OY);
    const anchors = { chips: [], tokens: [] };
    const route = chipRoute(st);

    drawEyebrow();
    drawHeadline(st);
    drawFusen(st);
    drawBookShape();
    if (st.caseChange) drawBookContent(st.prevView, st.outA, st, null);
    drawBookContent(st.view, st.inA, st, anchors);
    drawConnectors(st);

    const afterA = st.sideK;
    drawStripShape("before", L.strip.h, 1 - afterA);
    drawStripShape("after", afterHeight(st), afterA);
    for (const which of SIDES) {
      const activeA = which === "after" ? afterA : 1 - afterA;
      if (st.caseChange) drawStripContent(st.prevView, which, st.outA, activeA, st, null);
      drawStripContent(st.view, which, st.inA, activeA, st, anchors);
    }
    drawLeaders(st, anchors);
    drawClockGhost(st);
    drawTools(st, route);
    drawCard(st);
    drawTraveller(st, route);
    drawCta(st);
    drawFooter();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- Editor -----------------------------------------------------------------------------------

  let loading = false;
  let current = 0;
  let isPlaying = false;
  let raf = 0;
  let startTime = 0;
  let startNow = 0;

  function showAssets() {
    const ok = [...assetState.values()].filter((v) => v === "ok").length;
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

  // Full original strings of the cases the film shows, readable as text (not drawn in full).
  function showFocus(built) {
    if (!built) {
      ui.focusList.replaceChildren();
      return;
    }
    ui.focusList.replaceChildren(...Object.values(built.views).map((v) => {
      const li = document.createElement("li");
      const r = v.row;
      const vals = (s) => METRIC_IDS.map((m) => `${m} ${r[s].scores[m]}`).join("・");
      li.textContent = `${v.id}「${r.question}」 参照文：${r.reference}／変更前：${r.before.response}（${vals("before")}、照合メモ・入力：${SHORT_LABEL[r.before.annotation.label]}）／変更後：${r.after.response}（${vals("after")}、照合メモ・入力：${SHORT_LABEL[r.after.annotation.label]}）`;
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
      b.append(time, `${headlines?.[s.id] ?? s.id}（${s.case}）`);
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
    showFocus(null);
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
    showFocus(null);
    current = 0;
    ui.time.value = "0";
    buildSceneList(null);
    showAssets();
    setState("loading", `manifest と素材${ASSETS.length}件の SHA-256、保存した採点結果を照合しています…`);
    showTime();
    const ready = load().then((built) => {
      loading = false;
      film = built;
      buildSceneList(built.headlines);
      showFocus(built);
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
