/* 同じ書き出し、違う続き。— 32-second silent explainer of the saved Train LLM From Scratch run.
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * One connected drawing stays on screen the whole time: a book of 96 English lines splits into
 * 83 training and 13 validation lines (all 13 drawn back to their identical training lines),
 * a training-only BPE splitter, a training loop around the 800-update model, the 0-update model
 * held at the same seed, and the same prompt strip branching to both, ending in the saved
 * continuations and the JSON record.
 *
 * Every number and string comes from the nine frozen assets, verified by SHA-256 against a
 * pinned manifest before anything is drawn. The loop, gears and moving pieces are concept motion,
 * not measurements: no probabilities, attention, weight trajectories, per-token decoding or batch
 * trace are shown. Only the original tiny model generated the continuations.
 *
 * Time contract: window.seek(t) draws the finished frame for absolute time t from t alone.
 * No audio, no media elements.
 */
"use strict";

(() => {
  const MANIFEST_URL = "assets/manifest.json";
  const MANIFEST_SHA256 = "06c12f34ace165c708b26afad72cc513da2c8407d636dcf5712e307099b612e9";
  const RECORD_SHA256 = "c2a688ba465078f37bd4e9d2ede7b65107a811525fec064e62a174d4bd4c39e0";
  const ASSET_FILES = ["training-run.json", "stories.txt", "prompts.json", "run-config.json", "independent-checks.json",
    "original-verification.json", "upstream.json", "diagram-data.json", "timeline.json"];
  const INPUTS = {
    "input/prompts.json": "fa1a3d7922b294d608b82b2fb2000ae385a371d34a66e49ebdb6e834a88fc66e",
    "input/run-config.json": "097fda8dff2d3d2fd825ab0431f05f6eceafa099364cdc01b0230a47f5debf69",
    "input/stories.txt": "dfef8dc0905dc3d775cf295fd87e358cfae216d4e72e50d1d850f21e9522e80e",
  };
  const INPUT_ASSET = { "prompts.json": "input/prompts.json", "run-config.json": "input/run-config.json", "stories.txt": "input/stories.txt" };
  const COMMIT = "bdd480a518094ca834e05ab32131dc126b522d3d";
  const REPOSITORY = "FareedKhan-dev/train-llm-from-scratch";
  const CHECK_NAMES = ["inputs_sha256_match", "upstream_files_sha256_match", "stories_96_nonempty_lines",
    "prompts_frozen_p01_to_p08", "upstream_modules_loaded_from_vendor", "train_h5_int32_1d", "train_token_ids_in_range",
    "train_h5_matches_upstream_split_text", "train_h5_decodes_to_split_with_eot", "train_h5_attrs_match_tokenizer",
    "val_h5_int32_1d", "val_token_ids_in_range", "val_h5_matches_upstream_split_text", "val_h5_decodes_to_split_with_eot",
    "val_h5_attrs_match_tokenizer", "split_keeps_every_story_line", "bpe_retrained_from_train_split_matches",
    "corpus_roundtrip_exact", "prompts_roundtrip_exact", "val_has_full_window", "baseline_has_zero_updates",
    "trained_has_all_updates", "losses_finite", "config_same_except_steps_and_out_path", "config_matches_frozen_input",
    "tokenizer_in_checkpoints_matches", "same_tensor_names_shapes_dtypes", "baseline_equals_fresh_seeded_init",
    "weights_changed", "state_sha256_differs", "parameter_count_matches_cli", "final_losses_match_cli",
    "periodic_checkpoints_complete", "checkpoint_metadata_consistent", "checkpoint_losses_are_prefixes",
    "last_checkpoint_state_equals_trained", "generation_shapes_and_prefix", "generate_cli_header_matches_model",
    "generate_cli_matches_api_before_P01", "generate_cli_matches_api_after_P01", "inputs_unchanged_after_run",
    "upstream_files_unchanged_after_run", "site_files_unchanged", "artifact_files_exactly_expected"];
  const IDS = ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08"];
  const SCENE_IDS = ["overview", "corpus", "updates", "continuation", "limit", "finish"];
  const SCENE_BOUNDS = [0, 5, 10, 16, 22, 27, 32];
  const SCENE_CASES = ["P01", "P01", "P01", "P01", "P08", "P01"];
  const COMMAND_IDS = ["prepare-data", "train-baseline-0", "train-800", "generate-cli-before-P01", "generate-cli-after-P01"];

  // ---------------------------------------------------------------- motion contract

  const RENDER = window.__MOTION_RENDER__ === true;
  const rc = window.renderConfig && typeof window.renderConfig === "object" ? window.renderConfig : {};
  const posInt = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
  const W = posInt(rc.width) || 720;
  const H = posInt(rc.height) || 1280;
  const FPS = posInt(rc.fps) || 30;
  const DURATION = 32;
  const POSTER = 31;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER, audioEvents: [] };
  if (RENDER) document.documentElement.classList.add("render");

  const $ = (s) => document.querySelector(s);
  const ui = {
    canvas: $("#film"),
    status: $("#asset-status"),
    failure: $("#failure"),
    reason: $("#failure-reason"),
    retry: $("#retry"),
    play: $("#play"),
    reset: $("#reset"),
    scrub: $("#scrub"),
    time: $("#time"),
    scenes: Array.from(document.querySelectorAll(".scene")),
  };
  ui.canvas.width = W;
  ui.canvas.height = H;
  if (RENDER) {
    ui.canvas.style.width = `${W}px`;
    ui.canvas.style.height = `${H}px`;
  }
  ui.scrub.max = String(DURATION);
  ui.scrub.step = String(1 / FPS);

  // ---------------------------------------------------------------- verification

  class AssetError extends Error {}
  const fail = (message) => { throw new AssetError(message); };
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const isCount = (v) => Number.isInteger(v) && v >= 0;
  const isHex = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);

  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (isObj(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function fetchBytes(url) {
    let response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch {
      fail(`${url} を読み込めませんでした（接続できません）。`);
    }
    if (!response.ok) fail(`${url} を読み込めませんでした（HTTP ${response.status}）。`);
    return response.arrayBuffer();
  }

  function decode(buffer, name) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return fail(`${name} が正しいUTF-8ではありません。`);
    }
  }

  function parseJson(text, name) {
    try {
      return JSON.parse(text);
    } catch {
      return fail(`${name} をJSONとして読めませんでした。`);
    }
  }

  async function verifyAssets(progress) {
    if (!window.crypto || !crypto.subtle) fail("SHA-256を確かめるには、HTTPS か localhost で開く必要があります。");
    const manifestBytes = await fetchBytes(MANIFEST_URL);
    if (await sha256Hex(manifestBytes) !== MANIFEST_SHA256) fail("assets/manifest.json のSHA-256が固定値と一致しません。");
    const manifest = parseJson(decode(manifestBytes, "assets/manifest.json"), "assets/manifest.json");
    if (!isObj(manifest) || manifest.format !== "studio-yebisu-visual-assets-v1" || !Array.isArray(manifest.assets)
      || canonical(manifest.assets.map((a) => a && a.file)) !== canonical(ASSET_FILES)) {
      fail("assets/manifest.json の素材一覧が9つの決めた素材と一致しません。");
    }
    const texts = {};
    let done = 0;
    for (const asset of manifest.assets) {
      if (!isHex(asset.sha256) || !isCount(asset.bytes)) fail(`manifest の ${asset.file} の記録が欠けています。`);
      const url = `assets/${asset.file}`;
      const bytes = await fetchBytes(url);
      if (bytes.byteLength !== asset.bytes) fail(`${url} のバイト数が manifest と一致しません（${bytes.byteLength} / ${asset.bytes}）。`);
      if (await sha256Hex(bytes) !== asset.sha256) fail(`${url} のSHA-256が manifest と一致しません。`);
      texts[asset.file] = decode(bytes, url);
      progress(++done, manifest.assets.length);
    }
    const bySha = Object.fromEntries(manifest.assets.map((a) => [a.file, a.sha256]));
    if (bySha["training-run.json"] !== RECORD_SHA256) fail("training-run.json が保存済みの実行記録（固定SHA-256）ではありません。");
    for (const [file, input] of Object.entries(INPUT_ASSET)) {
      if (bySha[file] !== INPUTS[input]) fail(`${file} が固定した入力 ${input} と一致しません。`);
    }
    const docs = {};
    for (const file of ASSET_FILES) if (file.endsWith(".json")) docs[file] = parseJson(texts[file], `assets/${file}`);
    const data = validateDocs(docs, texts["stories.txt"]);
    await checkOutputHashes(data.rec, docs["independent-checks.json"]);
    return data;
  }

  function validateDocs(docs, stories) {
    const rec = docs["training-run.json"];
    const promptsDoc = docs["prompts.json"];
    const config = docs["run-config.json"];
    const ind = docs["independent-checks.json"];
    const orig = docs["original-verification.json"];
    const up = docs["upstream.json"];
    const dd = docs["diagram-data.json"];
    const tl = docs["timeline.json"];

    // ---- the saved record and its frozen inputs
    if (!isObj(rec) || rec.format !== "studio-yebisu-tiny-lm-run-v1") fail("training-run.json の形式が違います。");
    for (const key of ["source", "config", "inputs_sha256", "checks", "environment", "dataset", "model", "training", "notes", "commands", "artifacts", "samples"]) {
      if (!(key in rec)) fail(`training-run.json に ${key} がありません。`);
    }
    const src = rec.source;
    if (!isObj(src) || src.repository !== REPOSITORY || src.commit !== COMMIT || src.license !== "MIT"
      || src.copyright !== "Copyright (c) 2025 Fareed Khan" || src.files_verified !== 48 || src.modified !== false) {
      fail("training-run.json の原典（固定コミット・48ファイル・無改変・MIT）が一致しません。");
    }
    if (canonical(rec.inputs_sha256) !== canonical(INPUTS)) fail("training-run.json にある入力のSHA-256が固定値と一致しません。");
    if (!isObj(config) || config.format !== "studio-yebisu-tiny-lm-config-v1" || canonical(rec.config) !== canonical(config)) {
      fail("training-run.json の設定が run-config.json と一致しません。");
    }
    if (!isObj(promptsDoc) || promptsDoc.format !== "studio-yebisu-tiny-lm-prompts-v1" || !Array.isArray(promptsDoc.prompts)
      || canonical(promptsDoc.prompts.map((p) => p && p.id)) !== canonical(IDS)) {
      fail("prompts.json がP01〜P08の固定入力ではありません。");
    }
    if (!isObj(rec.checks) || canonical(Object.keys(rec.checks).sort()) !== canonical([...CHECK_NAMES].sort())
      || !CHECK_NAMES.every((name) => rec.checks[name] === true)) {
      fail("training-run.json の実行時の確認44項目がそろっていません。");
    }
    const lines = stories.split(/\r?\n/);
    if (lines[lines.length - 1] === "") lines.pop();
    if (lines.length !== 96 || lines.some((line) => !line.trim())) fail("stories.txt が空行なしの96行ではありません。");

    const d = rec.dataset;
    const m = rec.model;
    const t = rec.training;
    const facts = [
      [d && d.story_lines, 96], [d && d.train_lines, 83], [d && d.val_lines, 13], [d && d.val_lines_identical_to_a_train_line, 13],
      [d && d.train_tokens, 3072], [d && d.val_tokens, 483], [d && d.vocab_size, 417], [d && d.vocab_size_requested, 512],
      [d && d.merges, 160], [d && d.endoftext_id, 416], [m && m.parameters, 135552], [m && m.vocab_rows, 448],
      [m && m.padding_rows, 31], [m && m.context_length, 64], [m && m.n_blocks, 2], [m && m.n_head, 4], [m && m.n_embed, 64],
      [t && t.optimizer_steps, 800], [t && t.baseline_steps, 0], [t && t.seed, 2201], [config.seed, 2201], [config.steps, 800],
      [t && t.final_estimate_batches_per_split, 200],
    ];
    if (facts.some(([actual, expected]) => actual !== expected)) fail("training-run.json の数値が、この作例の実行の値と一致しません。");
    if (m.arch !== "modern" || m.pretrained_weights !== false || d.bpe_trained_on !== "train split only" || !isObj(d.prompt_tokens)) {
      fail("training-run.json のモデル（modern・事前学習なし）かBPEの範囲が一致しません。");
    }
    if (!Array.isArray(t.losses) || t.losses.length !== 800 || !t.losses.every(isNum)) fail("損失の配列が800個の有限の数ではありません。");
    if (!isObj(t.before) || !isObj(t.after) || t.before.completed_steps !== 0 || t.after.completed_steps !== 800
      || !isNum(t.before.dev_loss) || !isNum(t.after.dev_loss) || !isHex(t.before.state_sha256) || !isHex(t.after.state_sha256)
      || t.before.state_sha256 === t.after.state_sha256) {
      fail("0回更新と800回更新のモデルの記録が一致しません。");
    }
    if (!Array.isArray(t.checkpoints) || canonical(t.checkpoints.map((c) => c && c.completed_steps)) !== canonical([0, 200, 400, 600, 800])) {
      fail("保存点が0・200・400・600・800回ではありません。");
    }
    if (t.checkpoints[0].state_sha256 !== t.before.state_sha256 || t.checkpoints[4].state_sha256 !== t.after.state_sha256) {
      fail("保存点と学習前後のモデルの重みのSHA-256が一致しません。");
    }
    if (!Array.isArray(rec.commands) || canonical(rec.commands.map((c) => c && c.id)) !== canonical(COMMAND_IDS)
      || !rec.commands.every((c) => c.exit_code === 0 && Array.isArray(c.args) && isNum(c.seconds))) {
      fail("実行したコマンド5件の記録が一致しません。");
    }
    if (!Array.isArray(rec.artifacts) || rec.artifacts.length !== 9
      || !rec.artifacts.every((a) => isObj(a) && typeof a.label === "string" && isHex(a.sha256) && isCount(a.bytes) && a.public === false)) {
      fail("非公開の保存物9件の記録が一致しません。");
    }
    if (!Array.isArray(rec.samples) || rec.samples.length !== 8) fail("生成の記録が8件ではありません。");
    rec.samples.forEach((s, i) => {
      const p = promptsDoc.prompts[i];
      if (!isObj(s) || s.id !== p.id || s.label !== p.label || !isObj(s.input)) fail(`${p.id} の記録が固定した入力と合いません。`);
      for (const key of ["text", "max_new_tokens", "temperature", "top_k", "seed"]) {
        if (s.input[key] !== p[key]) fail(`${p.id} の入力（${key}）が固定した入力と一致しません。`);
      }
      for (const side of ["before", "after"]) {
        const o = s[side];
        if (!isObj(o) || typeof o.text !== "string" || !o.text.startsWith(p.text) || !Array.isArray(o.token_ids)
          || !o.token_ids.every(isCount) || o.new_tokens !== 48 || o.prompt_tokens !== d.prompt_tokens[s.id]
          || o.token_ids.length !== o.prompt_tokens + 48 || !isCount(o.ids_skipped_in_text)
          || !isCount(o.endoftext_tokens) || !isCount(o.replacement_chars)) {
          fail(`${p.id} の生成の記録が欠けているか、入力と合いません。`);
        }
      }
      if (canonical(s.before.token_ids.slice(0, s.before.prompt_tokens)) !== canonical(s.after.token_ids.slice(0, s.after.prompt_tokens))) {
        fail(`${p.id} の書き出しの番号が、2つのモデルで一致しません。`);
      }
    });

    // The last 13 lines are the validation side; each is drawn back to its identical training line.
    const trainSide = lines.slice(0, d.train_lines);
    const twins = lines.slice(d.train_lines).map((line) => trainSide.indexOf(line));
    if (twins.length !== 13 || twins.some((j) => j < 0)) fail("stories.txt の検証13行が、すべて学習側に見つかりません。");
    const unique = new Set(lines).size;

    // ---- independent checks (a separate script's results, read as facts)
    if (!isObj(ind) || ind.status !== "passed" || ind.sample_count !== 8 || ind.generated_outputs_rechecked !== 16
      || ind.actual_source_files !== 48 || ind.trained_optimizer_steps !== 800 || ind.model_parameters !== m.parameters
      || !isObj(ind.dataset) || ind.dataset.train_tokens !== d.train_tokens || ind.dataset.val_tokens !== d.val_tokens
      || ind.dataset.vocab_size !== d.vocab_size || ind.dataset.train_lines !== d.train_lines
      || ind.dataset.val_lines_nonempty !== d.val_lines || ind.dataset.validation_lines_also_in_training !== 13
      || ind.dataset.unique_lines_total !== unique || !Array.isArray(ind.outputs) || ind.outputs.length !== 16) {
      fail("independent-checks.json が実行記録と一致しません。");
    }

    // ---- upstream metadata and the old verification file (read only as provenance, not as new QA)
    if (!isObj(up) || up.repository !== REPOSITORY || up.commit !== COMMIT || up.license !== "MIT"
      || up.copyright_notice !== "Copyright (c) 2025 Fareed Khan" || !isObj(up.files_sha256)
      || Object.keys(up.files_sha256).length !== 48 || !Object.values(up.files_sha256).every(isHex)) {
      fail("upstream.json の原典48ファイルの記録が一致しません。");
    }
    if (!isObj(orig) || !isObj(orig.upstream) || orig.upstream.commit !== COMMIT) fail("original-verification.json の原典が一致しません。");

    // ---- diagram-data.json must be a faithful projection of the record and the stories
    if (!isObj(dd) || dd.format !== "studio-yebisu-train-llm-visual-facts-v1" || dd.source_record_sha256 !== RECORD_SHA256
      || canonical(dd.inputs_sha256) !== canonical(INPUTS) || canonical(dd.dataset) !== canonical(d)
      || !isObj(dd.model) || !isObj(dd.training) || canonical(dd.corpus_lines) !== canonical(lines)
      || dd.unique_lines !== unique || unique !== 64 || canonical(dd.samples) !== canonical(rec.samples)) {
      fail("diagram-data.json が実行記録と英文の忠実な写しではありません。");
    }
    for (const [key, value] of Object.entries(dd.model)) {
      if (canonical(value) !== canonical(m[key])) fail(`diagram-data.json の model.${key} が実行記録と一致しません。`);
    }
    for (const [key, value] of Object.entries(dd.training)) {
      if (canonical(value) !== canonical(t[key])) fail(`diagram-data.json の training.${key} が実行記録と一致しません。`);
    }

    // ---- timeline.json is authoritative for timing, cases and headlines
    if (!isObj(tl) || tl.format !== "studio-yebisu-train-llm-visual-timeline-v1" || tl.duration !== DURATION || tl.fps !== 30
      || tl.frames !== 960 || tl.silent !== true || !Array.isArray(tl.scenes) || tl.scenes.length !== 6) {
      fail("timeline.json が32秒・30fps・960フレーム・無音・6場面ではありません。");
    }
    tl.scenes.forEach((s, i) => {
      if (!isObj(s) || s.id !== SCENE_IDS[i] || s.in !== SCENE_BOUNDS[i] || s.out !== SCENE_BOUNDS[i + 1]
        || s.case !== SCENE_CASES[i] || typeof s.headline !== "string" || !s.headline) {
        fail(`timeline.json の場面${i + 1}（${SCENE_IDS[i]}）が決めた時刻・入力と一致しません。`);
      }
    });

    const sample = (id) => rec.samples.find((s) => s.id === id);
    return { rec, d, m, t, twins, lines, unique, scenes: tl.scenes, p01: sample("P01"), p08: sample("P08") };
  }

  async function checkOutputHashes(rec, ind) {
    const enc = new TextEncoder();
    const expected = [];
    for (const phase of ["before", "after"]) for (const s of rec.samples) expected.push({ id: s.id, phase, o: s[phase] });
    for (let i = 0; i < expected.length; i++) {
      const e = expected[i];
      const row = ind.outputs[i];
      if (!isObj(row) || row.id !== e.id || row.phase !== e.phase || row.tokens !== e.o.token_ids.length
        || await sha256Hex(enc.encode(e.o.text)) !== row.text_sha256) {
        fail(`independent-checks.json の ${e.id}（${e.phase}）の全文SHA-256が実行記録と一致しません。`);
      }
    }
  }

  // ---------------------------------------------------------------- drawing constants

  const C = {
    bg: "#f6f1e6", rule: "#ece3d1", paper: "#fffdf8", shadow: "#e2d8c4", ink: "#1c2230", navy: "#24395c",
    teal: "#2d6c70", tealSoft: "#e1eceb", ochre: "#a8741c", ochreSoft: "#f3e4c3", muted: "#5f6470",
    machine: "#eef2f3", backSheet: "#efe6d3", texture: "#cbc0a8",
  };
  const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",system-ui,sans-serif';
  const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",serif';
  const MONO = 'ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,"Noto Sans Mono",monospace';
  const fontOf = (size, weight, family) => `${weight} ${size}px ${family}`;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const es = (t, a, b) => ease(seg(t, a, b));
  const lerp = (a, b, p) => a + (b - a) * p;

  // ---------------------------------------------------------------- routes

  function mkRoute(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  const poly = (...xy) => {
    const pts = [];
    for (let i = 0; i < xy.length; i += 2) pts.push({ x: xy[i], y: xy[i + 1] });
    return mkRoute(pts);
  };
  const cubic = (x0, y0, x1, y1, x2, y2, x3, y3, n = 40) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const a = (1 - u) ** 3;
      const b = 3 * (1 - u) ** 2 * u;
      const c = 3 * (1 - u) * u * u;
      const e = u ** 3;
      pts.push({ x: a * x0 + b * x1 + c * x2 + e * x3, y: a * y0 + b * y1 + c * y2 + e * y3 });
    }
    return mkRoute(pts);
  };
  function routeAt(r, p) {
    const target = clamp(p, 0, 1) * r.len;
    for (let i = 1; i < r.pts.length; i++) {
      if (r.cum[i] >= target || i === r.pts.length - 1) {
        const span = r.cum[i] - r.cum[i - 1] || 1;
        const k = clamp((target - r.cum[i - 1]) / span, 0, 1);
        const a = r.pts[i - 1];
        const b = r.pts[i];
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), a: Math.atan2(b.y - a.y, b.x - a.x) };
      }
    }
    return { x: r.pts[0].x, y: r.pts[0].y, a: 0 };
  }

  // ---------------------------------------------------------------- layouts (base units)

  function portraitLayout() {
    return {
      bw: 720, bh: 1280,
      head: { x: 360, y: 124, size: 46, align: "center", maxW: 680 },
      caption: { x: 360, y: 186, size: 23, align: "center", maxW: 680 },
      book: { x: 40, y: 238, w: 150, h: 190 },
      train: { x: 250, y: 228, w: 200, h: 140 },
      val: { x: 250, y: 394, w: 200, h: 62 },
      bulge: 488,
      bpe: { x: 500, y: 232, w: 200, h: 150 },
      dupLabel: { x: 40, y: 500, size: 26 },
      strip: { x: 40, y: 540, w: 560, tag: 22, textMax: 34, chip: 22 },
      m0: { x: 40, y: 772, w: 270, h: 160 },
      m800: { x: 410, y: 772, w: 270, h: 160 },
      ring: 12,
      ringLabel: { x: 692, y: 966, align: "right", size: 19, text: "調整（概念図）", maxW: 128 },
      seed: { x: 360, y: 840, r: 26 },
      seedText: [{ x: 360, y: 890, size: 18, align: "center", key: "seed" }, { x: 360, y: 914, size: 22, align: "center", key: "same1" }, { x: 360, y: 940, size: 22, align: "center", key: "same2" }],
      out0: { x: 20, y: 976, w: 330, h: 166 },
      out800: { x: 370, y: 976, w: 330, h: 166 },
      out: { tag: 21, mono: 26, ids: 20, lines: 2, idCount: 5 },
      json: { x: 220, y: 1162, w: 280, h: 56 },
      footer: { legend: { x: 36, y: 1246 }, source: { x: 360, y: 1270, align: "center", maxW: 680 }, size: 18, note: null },
      big: { book: 64, stack: 48, val: 40, bpe: 48, machine: 56, small: 24 },
      machineText: 112, gearR: 34,
      routes: (sb) => ({
        corpusTrain: cubic(190, 322, 222, 322, 222, 298, 248, 298),
        corpusVal: cubic(190, 352, 222, 352, 222, 425, 248, 425),
        trainBpe: poly(450, 250, 498, 250),
        bpeStrip: poly(560, 382, 560, 538),
        stream: poly(664, 382, 664, 758),
        branch0: cubic(300, sb, 300, sb + 44, 175, 730, 175, 770),
        branch800: cubic(300, sb, 300, sb + 44, 545, 718, 545, 758),
        seed0: poly(334, 840, 312, 840),
        seed800: poly(386, 840, 396, 840),
        out0: poly(175, 932, 180, 974),
        out800: poly(545, 944, 540, 974),
        json0: cubic(185, 1142, 185, 1162, 200, 1190, 218, 1190),
        json800: cubic(535, 1142, 535, 1162, 520, 1190, 502, 1190),
      }),
    };
  }

  function wideLayout() {
    return {
      bw: 1280, bh: 720,
      head: { x: 56, y: 70, size: 42, align: "left", maxW: 1170 },
      caption: { x: 56, y: 108, size: 22, align: "left", maxW: 1170 },
      book: { x: 50, y: 172, w: 130, h: 160 },
      train: { x: 220, y: 150, w: 200, h: 124 },
      val: { x: 220, y: 294, w: 200, h: 56 },
      bulge: 454,
      bpe: { x: 476, y: 154, w: 196, h: 116 },
      dupLabel: { x: 50, y: 392, size: 24 },
      strip: { x: 240, y: 418, w: 440, tag: 20, textMax: 30, chip: 19 },
      m800: { x: 720, y: 152, w: 230, h: 130 },
      m0: { x: 720, y: 486, w: 230, h: 130 },
      ring: 12,
      ringLabel: { x: 710, y: 130, align: "left", size: 20, text: "調整ループ（概念図）", maxW: 260 },
      seed: { x: 835, y: 384, r: 24 },
      seedText: [{ x: 835, y: 391, size: 0, align: "center", key: "none" }, { x: 870, y: 380, size: 22, align: "left", key: "same" }, { x: 870, y: 406, size: 19, align: "left", key: "seedline" }],
      out800: { x: 990, y: 142, w: 262, h: 160 },
      out0: { x: 990, y: 476, w: 262, h: 160 },
      out: { tag: 19, mono: 22, ids: 18, lines: 3, idCount: 5 },
      json: { x: 1010, y: 344, w: 222, h: 64 },
      footer: { legend: { x: 56, y: 684 }, source: { x: 1232, y: 684, align: "right", maxW: 560 }, size: 17, note: { x: 1232, y: 708, size: 15 } },
      big: { book: 54, stack: 44, val: 34, bpe: 44, machine: 48, small: 21 },
      machineText: 96, gearR: 28,
      routes: (sb, mid) => ({
        corpusTrain: cubic(180, 242, 202, 242, 202, 212, 218, 212),
        corpusVal: cubic(180, 272, 202, 272, 202, 322, 218, 322),
        trainBpe: poly(420, 170, 474, 170),
        bpeStrip: poly(574, 270, 574, 416),
        stream: poly(672, 214, 706, 214),
        branch800: cubic(680, mid, 700, mid, 692, 272, 706, 272),
        branch0: cubic(680, mid, 700, mid, 700, 520, 718, 520),
        seed800: poly(835, 360, 835, 296),
        seed0: poly(835, 408, 835, 484),
        out800: poly(962, 216, 988, 216),
        out0: poly(950, 550, 988, 550),
        json800: poly(1121, 302, 1121, 342),
        json0: poly(1121, 476, 1121, 410),
      }),
    };
  }

  // ---------------------------------------------------------------- state prepared once after verification

  let D = null;
  let ctx = null;
  let L = null;
  let S = 1;
  let OX = 0;
  let OY = 0;
  let geom = null;
  let excerpts = null;
  let dupRoutes = null;
  const routeCache = new Map();

  function prepare(data) {
    D = data;
    ctx = ui.canvas.getContext("2d");
    L = H >= W ? portraitLayout() : wideLayout();
    S = Math.min(W / L.bw, H / L.bh);
    OX = (W - L.bw * S) / 2;
    OY = (H - L.bh * S) / 2;
    geom = { P01: stripGeom(D.p01), P08: stripGeom(D.p08) };
    excerpts = {};
    for (const s of [D.p01, D.p08]) {
      excerpts[s.id] = {
        before: excerptLines(s, "before", L.out0.w, L.out.mono, L.out.lines),
        after: excerptLines(s, "after", L.out800.w, L.out.mono, L.out.lines),
      };
    }
    const R = L.train;
    const V = L.val;
    dupRoutes = D.twins.map((j, k) => {
      const yt = twinY(j);
      const yv = V.y + 10 + (k / 12) * (V.h - 20);
      const x0 = R.x + R.w;
      return { j, k, yt, yv, route: cubic(x0, yv, L.bulge, yv, L.bulge, yt, x0, yt, 28) };
    });
  }

  const twinY = (j) => L.train.y + 14 + (j / (D.d.train_lines - 1)) * (L.train.h - 28);

  function routesFor(stripH) {
    const key = stripH.toFixed(2);
    if (!routeCache.has(key)) routeCache.set(key, L.routes(L.strip.y + stripH, L.strip.y + stripH / 2));
    return routeCache.get(key);
  }

  function stripGeom(sample) {
    const St = L.strip;
    const inner = St.w - 28;
    ctx.font = fontOf(St.textMax, 400, MONO);
    const tw = ctx.measureText(sample.input.text).width;
    const textSize = tw > inner ? Math.floor((St.textMax * inner) / tw) : St.textMax;
    ctx.font = fontOf(St.chip, 600, MONO);
    const ids = sample.after.token_ids.slice(0, sample.after.prompt_tokens);
    const chipH = St.chip + 14;
    const chips = [];
    let x = 0;
    let row = 0;
    for (const id of ids) {
      const w = ctx.measureText(String(id)).width + 14;
      if (x > 0 && x + w > inner) { x = 0; row += 1; }
      chips.push({ id, x, row, w });
      x += w + 6;
    }
    const tagY = St.tag + 8;
    const textY = tagY + 10 + textSize;
    const chipsY = textY + 14;
    return { ids, textSize, chips, rows: row + 1, chipH, tagY, textY, chipsY, h: chipsY + (row + 1) * (chipH + 8) + 6 };
  }

  // Literal characters from the start of the saved continuation, stopped at the first line
  // break, wrapped at spaces, and always marked with "…" as an excerpt.
  function excerptLines(sample, side, boxW, size, maxLines) {
    ctx.font = fontOf(size, 400, MONO);
    const perLine = Math.max(8, Math.floor((boxW - 28) / ctx.measureText("0").width));
    const rest = Array.from(sample[side].text.slice(sample.input.text.length));
    const nl = rest.indexOf("\n");
    const chars = nl >= 0 ? rest.slice(0, nl) : rest;
    const out = [];
    let i = 0;
    while (out.length < maxLines && i < chars.length) {
      let end = Math.min(i + perLine, chars.length);
      if (end < chars.length) {
        for (let k = end; k > i + 1; k--) {
          if (chars[k - 1] === " ") { end = k; break; }
        }
      }
      out.push(chars.slice(i, end));
      i = end;
    }
    if (!out.length) return ["…"];
    const last = out[out.length - 1];
    if (last.length >= perLine) last.length = perLine - 1;
    return out.map((line, k) => line.join("") + (k === out.length - 1 ? "…" : ""));
  }

  // ---------------------------------------------------------------- canvas primitives

  function text(str, x, y, o) {
    let size = o.size;
    const weight = o.weight || 400;
    const family = o.family || SANS;
    ctx.font = fontOf(size, weight, family);
    if (o.maxW) {
      const w = ctx.measureText(str).width;
      if (w > o.maxW) {
        size = Math.max(8, Math.floor(((size * o.maxW) / w) * 2) / 2);
        ctx.font = fontOf(size, weight, family);
      }
    }
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = "alphabetic";
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * (o.alpha === undefined ? 1 : o.alpha);
    ctx.fillText(str, x, y);
    ctx.globalAlpha = prev;
    return ctx.measureText(str).width;
  }

  function rr(x, y, w, h, r) {
    const k = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + w - k, y);
    ctx.arcTo(x + w, y, x + w, y + k, k);
    ctx.lineTo(x + w, y + h - k);
    ctx.arcTo(x + w, y + h, x + w - k, y + h, k);
    ctx.lineTo(x + k, y + h);
    ctx.arcTo(x, y + h, x, y + h - k, k);
    ctx.lineTo(x, y + k);
    ctx.arcTo(x, y, x + k, y, k);
    ctx.closePath();
  }

  function paper(r, o = {}) {
    const radius = o.radius === undefined ? 6 : o.radius;
    if (o.shadow !== false) {
      ctx.fillStyle = C.shadow;
      rr(r.x + 5, r.y + 5, r.w, r.h, radius);
      ctx.fill();
    }
    ctx.fillStyle = o.fill || C.paper;
    rr(r.x, r.y, r.w, r.h, radius);
    ctx.fill();
    if (o.stroke !== null) {
      ctx.strokeStyle = o.stroke || C.ink;
      ctx.lineWidth = o.lw || 2;
      ctx.setLineDash(o.dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function useStyle(kind) {
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    if (kind === "train") { ctx.strokeStyle = C.navy; ctx.lineWidth = 4; ctx.setLineDash([]); }
    else if (kind === "infer") { ctx.strokeStyle = C.teal; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); }
    else if (kind === "bpe") { ctx.strokeStyle = C.teal; ctx.lineWidth = 3; ctx.setLineDash([1, 9]); ctx.lineCap = "round"; }
    else if (kind === "dup") { ctx.strokeStyle = C.ochre; ctx.lineWidth = 1.8; ctx.setLineDash([]); }
    else if (kind === "seed") { ctx.strokeStyle = C.muted; ctx.lineWidth = 2.4; ctx.setLineDash([3, 6]); }
    return kind;
  }

  function strokeRoute(r, kind, p = 1, arrow = true) {
    if (p <= 0) return;
    useStyle(kind);
    const target = r.len * Math.min(1, p);
    ctx.beginPath();
    ctx.moveTo(r.pts[0].x, r.pts[0].y);
    let end = r.pts[0];
    let ang = 0;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1];
      const b = r.pts[i];
      ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (r.cum[i] >= target) {
        const k = (target - r.cum[i - 1]) / (r.cum[i] - r.cum[i - 1] || 1);
        end = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
        ctx.lineTo(end.x, end.y);
        break;
      }
      ctx.lineTo(b.x, b.y);
      end = b;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (arrow && p >= 0.999 && kind !== "dup" && kind !== "seed" && kind !== "bpe") arrowHead(end.x, end.y, ang, kind === "train" ? C.navy : C.teal);
  }

  function arrowHead(x, y, a, color) {
    const s = 13;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - s * Math.cos(a - 0.45), y - s * Math.sin(a - 0.45));
    ctx.lineTo(x - s * Math.cos(a + 0.45), y - s * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
  }

  function gear(cx, cy, r, teeth, angle, color, lw) {
    const inner = r * 0.8;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = angle + (i / (teeth * 2)) * Math.PI * 2;
      const a1 = angle + ((i + 1) / (teeth * 2)) * Math.PI * 2;
      const rr0 = i % 2 === 0 ? r : inner;
      if (i === 0) ctx.moveTo(cx + rr0 * Math.cos(a0), cy + rr0 * Math.sin(a0));
      else ctx.lineTo(cx + rr0 * Math.cos(a0), cy + rr0 * Math.sin(a0));
      ctx.lineTo(cx + rr0 * Math.cos(a1), cy + rr0 * Math.sin(a1));
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = angle + (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.32 * Math.cos(a), cy + r * 0.32 * Math.sin(a));
      ctx.lineTo(cx + inner * 0.92 * Math.cos(a), cy + inner * 0.92 * Math.sin(a));
      ctx.stroke();
    }
  }

  function chip(x, y, label, size, o = {}) {
    ctx.font = fontOf(size, 600, MONO);
    const w = label === null ? size * 0.9 : ctx.measureText(label).width + 14;
    const h = size + 14;
    const left = o.center ? x - w / 2 : x;
    const top = o.center ? y - h / 2 : y;
    ctx.fillStyle = o.fill || C.paper;
    rr(left, top, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = o.stroke || C.teal;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();
    if (label !== null) text(label, left + w / 2, top + h - 8, { size, weight: 600, family: MONO, color: o.color || C.navy, align: "center" });
    return w;
  }

  // ---------------------------------------------------------------- what is on screen at time t

  const GROUPS = ["corpus", "bpe", "train", "machines", "prompt", "outputs", "json"];
  const FOCUS = {
    overview: [1, 1, 1, 1, 1, 1, 1],
    corpus: [1, 1, 0.5, 0.4, 0.6, 0.3, 0.3],
    updates: [0.45, 0.7, 1, 1, 0.35, 0.3, 0.3],
    continuation: [0.35, 0.35, 0.35, 1, 1, 1, 0.55],
    limit: [0.35, 0.35, 0.35, 1, 1, 1, 0.45],
    finish: [1, 1, 1, 1, 1, 1, 1],
  };

  function sceneIndex(t) {
    for (let i = D.scenes.length - 1; i >= 0; i--) if (t >= D.scenes[i].in) return i;
    return 0;
  }

  function weights(t) {
    const i = sceneIndex(t);
    const cur = FOCUS[D.scenes[i].id];
    const prev = i > 0 ? FOCUS[D.scenes[i - 1].id] : cur;
    const p = es(t, D.scenes[i].in, D.scenes[i].in + 0.6);
    const reveal = (k) => (t >= 5 ? 1 : es(t, 0.2 + k * 0.4, 0.9 + k * 0.4));
    const out = {};
    GROUPS.forEach((g, k) => {
      const rv = reveal(k);
      out[g] = lerp(prev[k], cur[k], p) * (0.18 + 0.82 * rv);
      out[`${g}Reveal`] = rv;
    });
    return out;
  }

  // Prompt strip(s) on screen: P01, swapped to P08 for the limit scene and back.
  function stripSlots(t) {
    if (t < 22) return [{ s: D.p01, dx: 0, a: 1 }];
    if (t < 27) {
      const out = es(t, 22.0, 22.6);
      const inn = es(t, 22.4, 23.1);
      const slots = [];
      if (out < 1) slots.push({ s: D.p01, dx: -90 * out, a: 1 - out });
      if (inn > 0) slots.push({ s: D.p08, dx: 90 * (1 - inn), a: inn });
      return slots;
    }
    const out = es(t, 27.0, 27.5);
    const inn = es(t, 27.35, 28.0);
    const slots = [];
    if (out < 1) slots.push({ s: D.p08, dx: -90 * out, a: 1 - out });
    if (inn > 0) slots.push({ s: D.p01, dx: 90 * (1 - inn), a: inn });
    return slots;
  }

  function dominant(t) {
    const slots = stripSlots(t);
    return slots.reduce((best, s) => (s.a > best.a ? s : best), slots[0]).s;
  }

  // The saved continuations shown in the output strips: unrolled in scenes 4–5, otherwise held.
  function outState(t) {
    if (t < 16.4) return { s: D.p01, reveal: 1, a: 1 - es(t, 16.0, 16.4) };
    if (t < 18.8) return { s: null, reveal: 0, a: 0 };
    if (t < 22.4) return { s: D.p01, reveal: es(t, 18.8, 20.6), a: 1 - es(t, 22.0, 22.4) };
    if (t < 24.8) return { s: null, reveal: 0, a: 0 };
    if (t < 27.4) return { s: D.p08, reveal: es(t, 24.8, 26.4), a: 1 - es(t, 27.0, 27.4) };
    return { s: D.p01, reveal: 1, a: es(t, 27.4, 28.4) };
  }

  // ---------------------------------------------------------------- frame

  function drawFrame(time) {
    const t = clamp(Number(time) || 0, 0, DURATION);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(S, 0, 0, S, OX, OY);

    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 1;
    for (let y = 40; y < L.bh; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(L.bw, y + 0.5);
      ctx.stroke();
    }

    const w = weights(t);
    const slots = stripSlots(t);
    const main = dominant(t);
    const G = geom[main.id];
    // During a strip swap the branches follow a blended strip height, so they never jump.
    const h01 = geom.P01.h;
    const h08 = geom.P08.h;
    const stripH = t < 22 ? h01 : t < 27 ? lerp(h01, h08, es(t, 22.4, 23.1)) : lerp(h08, h01, es(t, 27.35, 28.0));
    const R = routesFor(Math.round(stripH * 2) / 2);

    group(w.corpus, () => drawCorpus(t, w.corpusReveal));
    group(w.bpe, () => drawBpe(t, w.bpeReveal));
    group(w.train, () => drawTraining(t, R, w.trainReveal));
    group(w.prompt, () => drawPrompt(t, slots, R, w.promptReveal));
    group(w.machines, () => drawMachines(t, R, w.machinesReveal));
    group(w.outputs, () => drawOutputs(t, R, w.outputsReveal));
    group(w.json, () => drawJson(t, R, main, w.jsonReveal));
    drawMovers(t, R, G);
    drawHeadline(t);
    drawFooter();
  }

  function group(alpha, fn) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    fn();
    ctx.restore();
  }

  function drawCorpus(t, rv) {
    const B = L.book;
    const big = L.big;
    ctx.fillStyle = C.backSheet;
    for (const k of [10, 5]) {
      rr(B.x + k, B.y - k, B.w, B.h, 4);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = C.backSheet;
    }
    paper(B, { radius: 4 });
    ctx.strokeStyle = C.texture;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(B.x + 14, B.y + 8);
    ctx.lineTo(B.x + 14, B.y + B.h - 8);
    ctx.stroke();
    const nw = text(String(D.d.story_lines), B.x + B.w / 2 - 10, B.y + B.h * 0.56, { size: big.book, weight: 700, family: SERIF, align: "center" });
    text("行", B.x + B.w / 2 - 10 + nw / 2 + 2, B.y + B.h * 0.56, { size: big.book * 0.55, weight: 700 });
    text("自作の英文", B.x + B.w / 2 + 4, B.y + B.h * 0.84, { size: big.small * 0.92, color: C.muted, align: "center", maxW: B.w - 20 });

    const stack = (r, label, sub, size) => {
      ctx.fillStyle = C.backSheet;
      rr(r.x + 5, r.y - 5, r.w, r.h, 4);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      paper(r, { radius: 4 });
      const lw = text(label, r.x + 16, r.y + r.h / 2 + size * (sub && r.h > 100 ? 0.15 : 0.36), { size, weight: 700, family: SERIF });
      if (sub) {
        if (r.h > 100) text(sub, r.x + 18, r.y + r.h / 2 + size * 0.15 + big.small * 1.35, { size: big.small, color: C.muted });
        else text(sub, r.x + 16 + lw + 10, r.y + r.h / 2 + size * 0.36, { size: big.small, color: C.muted });
      }
    };
    const Rt = L.train;
    const Vt = L.val;
    const tx = Rt.x + Rt.w * 0.75;
    stack(Rt, `${D.d.train_lines}行`, "学習", big.stack);
    stack(Vt, `${D.d.val_lines}行`, "検証", big.val);
    ctx.strokeStyle = C.texture;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const y = Rt.y + 14 + (i / 11) * (Rt.h - 28);
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(Rt.x + Rt.w - 10, y);
      ctx.stroke();
    }
    // the 13 training lines that have a twin, and the 13 validation lines
    const glow = es(t, 7.0, 7.4) * (1 - es(t, 8.2, 8.6));
    if (glow > 0) {
      const y0 = twinY(Math.min(...D.twins)) - 6;
      const y1 = twinY(Math.max(...D.twins)) + 6;
      ctx.fillStyle = C.ochreSoft;
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * glow;
      ctx.fillRect(tx - 8, y0, Rt.x + Rt.w - tx, y1 - y0);
      ctx.globalAlpha = prev;
    }
    ctx.strokeStyle = C.ochre;
    ctx.lineWidth = 2;
    for (const r of dupRoutes) {
      ctx.beginPath();
      ctx.moveTo(tx, r.yt);
      ctx.lineTo(Rt.x + Rt.w - 10, r.yt);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Vt.x + Vt.w * 0.78, r.yv);
      ctx.lineTo(Vt.x + Vt.w - 10, r.yv);
      ctx.stroke();
    }
    strokeRoute(L.routes(0, 0).corpusTrain, "train", rv);
    strokeRoute(L.routes(0, 0).corpusVal, "train", rv);

    // duplicate connections: redrawn during the corpus scene
    const replay = t >= 5 && t < 7.9;
    const p = replay ? es(t, 6.7, 7.9) : rv;
    if (replay) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * 0.2;
      for (const r of dupRoutes) strokeRoute(r.route, "dup", 1);
      ctx.globalAlpha = prev;
    }
    for (const r of dupRoutes) strokeRoute(r.route, "dup", p);
    text(`検証${D.d.val_lines}行は、${D.d.val_lines_identical_to_a_train_line}行とも学習側にもある`, L.dupLabel.x, L.dupLabel.y,
      { size: L.dupLabel.size, weight: 700, color: C.ochre, maxW: L.bw - L.dupLabel.x - 40 });
  }

  function drawBpe(t, rv) {
    const P = L.bpe;
    const big = L.big;
    paper(P, { radius: 6 });
    const bx = P.x + 16;
    const by = P.y + 16;
    const bh = big.bpe * 0.95;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by + bh);
    for (const f of [0.05, 0.38, 0.71]) {
      ctx.moveTo(bx, by + bh * f);
      ctx.lineTo(bx + 10, by + bh * f);
    }
    ctx.moveTo(bx + 16, by);
    ctx.lineTo(bx + 24, by + bh / 2);
    ctx.lineTo(bx + 16, by + bh);
    ctx.stroke();
    text("BPE", bx + 34, by + bh * 0.86, { size: big.bpe, weight: 700, family: SERIF, color: C.navy });
    text("学習側だけ", bx, P.y + P.h * 0.68, { size: big.small * 0.88, maxW: P.w - 30 });
    text(`語彙${D.d.vocab_size}（指定${D.d.vocab_size_requested}）`, bx, P.y + P.h * 0.9, { size: big.small * 0.88, color: C.muted, maxW: P.w - 30 });
    const R = L.routes(0, 0);
    strokeRoute(R.trainBpe, "train", rv);
  }

  function drawTraining(t, R, rv) {
    strokeRoute(R.stream, "train", rv);
    const M = L.m800;
    const pad = L.ring;
    const spin = clamp(t - 10.2, 0, 5.6);
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 10]);
    ctx.lineDashOffset = -38 * spin;
    rr(M.x - pad, M.y - pad, M.w + pad * 2, M.h + pad * 2, 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    arrowHead(M.x + M.w * 0.3, M.y - pad, 0, C.navy);
    arrowHead(M.x + M.w * 0.7, M.y + M.h + pad, Math.PI, C.navy);
    const rl = L.ringLabel;
    text(rl.text, rl.x, rl.y, { size: rl.size, color: C.navy, align: rl.align, maxW: rl.maxW });
  }

  function drawPrompt(t, slots, R, rv) {
    strokeRoute(R.bpeStrip, "bpe", t >= 5 && t < 9.7 ? es(t, 9.0, 9.6) : rv);
    const linkX = R.bpeStrip.pts[0].x;
    const linkY = (R.bpeStrip.pts[0].y + R.bpeStrip.pts[1].y) / 2;
    text("同じBPE", linkX + 12, linkY + 8, { size: L.big.small * 0.85, color: C.teal, weight: 600 });
    strokeRoute(R.branch0, "infer", rv);
    strokeRoute(R.branch800, "infer", rv);
    const idsA = t >= 5 && t < 10 ? (t < 9.3 ? 1 - es(t, 5.0, 5.4) : es(t, 9.3, 9.9)) : 1;
    for (const slot of slots) drawStrip(slot.s, geom[slot.s.id], slot.dx, slot.a, idsA, t);
  }

  function drawStrip(sample, G, dx, a, idsA, t) {
    const St = L.strip;
    const x = St.x + dx;
    const y = St.y;
    const w = St.w;
    const h = G.h;
    ctx.save();
    ctx.globalAlpha *= a;
    const ribbon = (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + w + ox, y + oy);
      ctx.lineTo(x + w - 14 + ox, y + h / 2 + oy);
      ctx.lineTo(x + w + ox, y + h + oy);
      ctx.lineTo(x + ox, y + h + oy);
      ctx.lineTo(x + 14 + ox, y + h / 2 + oy);
      ctx.closePath();
    };
    ctx.fillStyle = C.shadow;
    ribbon(5, 5);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ribbon(0, 0);
    ctx.fill();
    ctx.strokeStyle = C.teal;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.stroke();
    text(`書き出し ${sample.id}・${G.ids.length}個の番号`, x + 24, y + G.tagY, { size: St.tag, weight: 700, color: C.teal, maxW: w - 48 });
    text(sample.input.text, x + 24, y + G.textY, { size: G.textSize, family: MONO, color: C.ink });
    if (idsA > 0) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * idsA;
      for (const c of G.chips) chip(x + 24 + c.x, y + G.chipsY + c.row * (G.chipH + 8), String(c.id), St.chip);
      ctx.globalAlpha = prev;
    }
    ctx.restore();
  }

  function drawMachines(t, R, rv) {
    const seedR = L.seed;
    strokeRoute(R.seed0, "seed", rv);
    strokeRoute(R.seed800, "seed", rv);
    ctx.fillStyle = C.paper;
    ctx.beginPath();
    ctx.arc(seedR.x, seedR.y, seedR.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    text("seed", seedR.x, seedR.y + 6, { size: seedR.r * 0.62, color: C.muted, align: "center" });
    for (const st of L.seedText) {
      if (st.key === "seed") text(String(D.t.seed), st.x, st.y, { size: st.size, color: C.muted, align: st.align });
      if (st.key === "same1") text("同じ", st.x, st.y, { size: st.size, weight: 700, align: st.align });
      if (st.key === "same2") text("初期値", st.x, st.y, { size: st.size, weight: 700, align: st.align });
      if (st.key === "same") text("同じ初期値", st.x, st.y, { size: st.size, weight: 700, align: st.align });
      if (st.key === "seedline") text(`seed ${D.t.seed}`, st.x, st.y, { size: st.size, color: C.muted, align: st.align });
    }

    const flash = Math.max(es(t, 18.1, 18.35) * (1 - es(t, 18.5, 18.9)), es(t, 24.4, 24.65) * (1 - es(t, 24.8, 25.2)));
    const steps = D.t.checkpoints.map((c) => c.completed_steps);
    // checkpoint anchors: all lit outside the update scene; relit one by one inside it
    let lit = steps.length;
    if (t >= 10 && t < 16) {
      lit = 1 + steps.slice(1).reduce((n, _, i) => n + es(t, 10.9 + i * 1.1, 11.2 + i * 1.1), 0);
      lit = lerp(steps.length, lit, es(t, 10.0, 10.4));
    }
    machine(L.m0, D.t.before.completed_steps, 0, flash, [steps[0]], 1, "初期値のまま");
    machine(L.m800, D.t.after.completed_steps, 1.7 * clamp(t - 10.2, 0, 5.6), flash, steps, lit, null);
  }

  function machine(M, count, angle, flash, rail, lit, note) {
    const big = L.big;
    paper(M, { fill: C.machine, stroke: C.navy, lw: 3 + flash * 3, radius: 14 });
    const gr = L.gearR;
    gear(M.x + 16 + gr, M.y + M.h * 0.4, gr, 10, angle, C.navy, 3);
    const tx = M.x + L.machineText;
    text(`${count}回`, tx, M.y + M.h * 0.44, { size: big.machine, weight: 700, family: SERIF, color: C.navy, maxW: M.w - L.machineText - 12 });
    text("更新", tx + 2, M.y + M.h * 0.44 + big.small * 1.3, { size: big.small, color: C.muted });
    const ry = M.y + M.h - Math.round(M.h * 0.2);
    const x0 = tx + 6;
    const x1 = M.x + M.w - 22;
    if (rail.length > 1) {
      ctx.strokeStyle = C.texture;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, ry);
      ctx.lineTo(x1, ry);
      ctx.stroke();
    }
    rail.forEach((v, i) => {
      const x = rail.length > 1 ? lerp(x0, x1, i / (rail.length - 1)) : x0;
      const on = clamp(lit - i, 0, 1);
      ctx.beginPath();
      ctx.arc(x, ry, 6, 0, Math.PI * 2);
      ctx.fillStyle = on > 0.5 ? C.navy : C.paper;
      ctx.fill();
      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 2;
      ctx.stroke();
      text(String(v), x, ry + 22, { size: 14, color: C.muted, align: "center", alpha: 0.5 + 0.5 * on });
    });
    if (note) text(note, x0 + 18, ry + 6, { size: 16, color: C.muted, maxW: x1 - x0 - 10 });
  }

  function drawOutputs(t, R, rv) {
    strokeRoute(R.out0, "infer", rv);
    strokeRoute(R.out800, "infer", rv);
    const st = outState(t);
    drawOut(L.out0, "before", st);
    drawOut(L.out800, "after", st);
  }

  function drawOut(O, side, st) {
    const o = L.out;
    paper(O, { stroke: C.ink, lw: 2, radius: 4 });
    text(`${side === "before" ? "0回更新" : `${D.t.after.completed_steps}回更新`}の続き・抜粋`, O.x + 14, O.y + o.tag + 9,
      { size: o.tag, weight: 700, maxW: O.w - 28 });
    if (!st.s || st.a <= 0) return;
    const lines = excerpts[st.s.id][side];
    const rec = st.s[side];
    const ids = rec.token_ids.slice(rec.prompt_tokens, rec.prompt_tokens + o.idCount);
    ctx.save();
    ctx.globalAlpha *= st.a;
    const edge = O.x + 14 + (O.w - 28) * st.reveal;
    ctx.beginPath();
    ctx.rect(O.x, O.y + o.tag + 14, edge - O.x + 2, O.h - o.tag - 14);
    ctx.clip();
    const lineH = o.mono + (L.bw === 720 ? 12 : 10);
    lines.forEach((line, k) => text(line, O.x + 14, O.y + o.tag + 9 + (k + 1) * lineH, { size: o.mono, family: MONO }));
    text(`${ids.join(" ")} …`, O.x + 14, O.y + O.h - 12, { size: o.ids, family: MONO, color: C.teal, weight: 600 });
    ctx.restore();
    if (st.reveal > 0 && st.reveal < 1) {
      ctx.strokeStyle = C.ochre;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(edge, O.y + o.tag + 16);
      ctx.lineTo(edge, O.y + O.h - 8);
      ctx.stroke();
    }
  }

  function drawJson(t, R, main, rv) {
    strokeRoute(R.json0, "infer", rv);
    strokeRoute(R.json800, "infer", rv);
    const J = L.json;
    const hl = es(t, 28.8, 29.4);
    ctx.fillStyle = C.shadow;
    const sheet = (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(J.x + ox, J.y + oy);
      ctx.lineTo(J.x + J.w - 16 + ox, J.y + oy);
      ctx.lineTo(J.x + J.w + ox, J.y + 16 + oy);
      ctx.lineTo(J.x + J.w + ox, J.y + J.h + oy);
      ctx.lineTo(J.x + ox, J.y + J.h + oy);
      ctx.closePath();
    };
    sheet(5, 5);
    ctx.fill();
    ctx.fillStyle = hl > 0.5 ? C.tealSoft : C.paper;
    sheet(0, 0);
    ctx.fill();
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 3 + hl * 1.5;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(J.x + J.w - 16, J.y);
    ctx.lineTo(J.x + J.w - 16, J.y + 16);
    ctx.lineTo(J.x + J.w, J.y + 16);
    ctx.stroke();
    text("{ }", J.x + 16, J.y + J.h * 0.66, { size: J.h * 0.5, weight: 700, family: MONO, color: C.navy });
    text(`${main.id}.json`, J.x + J.h * 1.05, J.y + J.h * 0.48, { size: J.h * 0.4, weight: 700, family: MONO, maxW: J.w - J.h * 1.05 - 18 });
    text(`0回・${D.t.after.completed_steps}回の両方`, J.x + J.h * 1.05, J.y + J.h * 0.84, { size: J.h * 0.3, color: C.muted, maxW: J.w - J.h * 1.05 - 18 });
  }

  // ---------------------------------------------------------------- moving pieces (concept motion)

  function drawMovers(t, R, G) {
    const base = L.routes(0, 0);
    // overview: one pass along the training side, then the prompt side
    if (t >= 3.3 && t < 4.95) {
      const a = 1 - es(t, 4.7, 4.95);
      const p1 = seg(t, 3.3, 4.1);
      if (p1 > 0 && p1 < 1) {
        const train = [base.corpusTrain, base.trainBpe, R.stream];
        const k = Math.min(2, Math.floor(p1 * 3));
        dot(routeAt(train[k], p1 * 3 - k), C.navy, a);
      }
      const p2 = seg(t, 4.1, 4.9);
      if (p2 > 0 && p2 < 1) {
        for (const side of [[R.branch0, R.out0, R.json0], [R.branch800, R.out800, R.json800]]) {
          const k = Math.min(2, Math.floor(p2 * 3));
          dot(routeAt(side[k], p2 * 3 - k), C.teal, a);
        }
      }
    }

    // corpus scene: lines leave the book for the two stacks
    if (t >= 5.0 && t < 7.2) {
      for (let i = 0; i < 12; i++) {
        const st = 5.1 + i * 0.09;
        const p = es(t, st, st + 0.85);
        if (p <= 0 || p >= 1) continue;
        const toVal = i >= 10;
        const B = L.book;
        const target = toVal ? L.val : L.train;
        const ty = toVal ? target.y + target.h / 2 : target.y + 22 + (i / 9) * (target.h - 44);
        const r = cubic(B.x + B.w, B.y + B.h * 0.5, B.x + B.w + 40, B.y + B.h * 0.5, target.x - 40, ty, target.x + 10, ty, 16);
        slip(routeAt(r, p), toVal ? C.ochre : C.navy);
      }
    }
    // training lines enter the BPE; blank pieces (no IDs) leave it on the training stream
    if (t >= 7.9 && t < 9.9) {
      for (let i = 0; i < 5; i++) {
        const st = 7.9 + i * 0.22;
        const p = es(t, st, st + 0.6);
        if (p > 0 && p < 1) slip(routeAt(base.trainBpe, p), C.navy);
        const q = seg(t, st + 0.6, st + 1.3);
        if (q > 0 && q < 1) blank(routeAt(R.stream, q * 0.3), 1 - seg(q, 0.7, 1));
      }
    }
    // update scene: a steady stream of blank pieces into the loop (not a batch trace)
    if (t >= 10.2 && t < 15.8) {
      const win = es(t, 10.2, 10.6) * (1 - es(t, 15.4, 15.8));
      for (let i = 0; i < 6; i++) {
        const p = (((t - 10.2) * 0.42 + i / 6) % 1 + 1) % 1;
        const fade = Math.min(1, p * 6, (1 - p) * 6);
        blank(routeAt(R.stream, p), win * fade);
      }
    }
    // same prompt IDs travel to both machines; the first saved new ID comes out of each
    const sendIds = (s, t0, t1) => {
      const p = es(t, t0, t1);
      if (p <= 0 || p >= 1) return;
      const g = geom[s.id];
      const a = Math.min(1, p * 8, (1 - p) * 8);
      for (const r of [R.branch0, R.branch800]) idGroup(routeAt(r, p), g.ids, a);
    };
    const sendNext = (s, t0, t1) => {
      const p = es(t, t0, t1);
      if (p <= 0 || p >= 1) return;
      const a = Math.min(1, p * 8, (1 - p) * 8);
      for (const [r, side] of [[R.out0, "before"], [R.out800, "after"]]) {
        const o = s[side];
        const pt = routeAt(r, p);
        ctx.save();
        ctx.globalAlpha = a;
        chip(pt.x, pt.y, String(o.token_ids[o.prompt_tokens]), L.strip.chip, { center: true, fill: C.tealSoft });
        ctx.restore();
      }
    };
    sendIds(D.p01, 16.7, 18.2);
    sendNext(D.p01, 18.25, 18.95);
    sendIds(D.p08, 23.2, 24.45);
    sendNext(D.p08, 24.5, 25.15);
    // finish: both saved continuations go into the one JSON record
    if (t >= 28.3 && t < 29.3) {
      const p = seg(t, 28.3, 29.2);
      const a = Math.min(1, p * 8, (1 - p) * 8);
      if (p > 0 && p < 1) for (const r of [R.json0, R.json800]) dot(routeAt(r, p), C.teal, a);
    }
    void G;
  }

  function dot(pt, color, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function slip(pt, color) {
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.a * 0.3);
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    rr(-22, -7, 44, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.restore();
  }

  function blank(pt, a) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "#e6ebf2";
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 2;
    rr(pt.x - 10, pt.y - 10, 20, 20, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function idGroup(pt, ids, a) {
    ctx.save();
    ctx.globalAlpha = a;
    if (ids.length <= 5) {
      const size = L.strip.chip * 0.8;
      ctx.font = fontOf(size, 600, MONO);
      const widths = ids.map((id) => ctx.measureText(String(id)).width + 14);
      const total = widths.reduce((s, w) => s + w, 0) + (ids.length - 1) * 4;
      let x = pt.x - total / 2;
      ids.forEach((id, i) => {
        chip(x, pt.y - (size + 14) / 2, String(id), size);
        x += widths[i] + 4;
      });
    } else {
      const cols = Math.ceil(ids.length / 2);
      const s = 11;
      const x0 = pt.x - (cols * (s + 3)) / 2;
      ids.forEach((_, i) => {
        const cx = x0 + (i % cols) * (s + 3);
        const cy = pt.y - s - 2 + Math.floor(i / cols) * (s + 3);
        ctx.fillStyle = C.paper;
        ctx.strokeStyle = C.teal;
        ctx.lineWidth = 1.5;
        rr(cx, cy, s, s, 2);
        ctx.fill();
        ctx.stroke();
      });
      text(`${ids.length}個`, pt.x, pt.y + s + 22, { size: 18, weight: 700, color: C.teal, align: "center" });
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- headline, caption, footer

  function captionFor(i) {
    const d = D.d;
    const t = D.t;
    switch (D.scenes[i].id) {
      case "overview": return "保存済みのCPU実行を説明する図（動きは概念）";
      case "corpus": return `BPEは学習側${d.train_lines}行だけで作成・語彙${d.vocab_size}（指定${d.vocab_size_requested}）`;
      case "updates": return `検証損失 ${t.before.dev_loss.toFixed(4)} → ${t.after.dev_loss.toFixed(4)}（200バッチ・検証側は学習側と重複）`;
      case "continuation": {
        const s = D.p01;
        return `同じ番号 ${geom.P01.ids.join("・")} → 次は ${s.before.token_ids[s.before.prompt_tokens]} と ${s.after.token_ids[s.after.prompt_tokens]}`;
      }
      case "limit": return "質問に答えず、学習文の型が続く（保存済みの出力）";
      default: return "文型を覚える練習の記録。知識や品質の保証ではありません。";
    }
  }

  function drawHeadline(t) {
    const i = sceneIndex(t);
    const sc = D.scenes[i];
    const last = i === D.scenes.length - 1;
    const aIn = i === 0 ? 1 : es(t, sc.in, sc.in + 0.3);
    const aOut = last ? 1 : 1 - es(t, sc.out - 0.35, sc.out);
    const a = aIn * aOut;
    if (a > 0) {
      text(sc.headline, L.head.x, L.head.y, { size: L.head.size, weight: 700, family: SERIF, align: L.head.align, maxW: L.head.maxW, alpha: a });
    }
    const c = (i === 0 ? es(t, 0.5, 0.9) : es(t, sc.in + 0.5, sc.in + 0.9)) * aOut;
    if (c > 0) {
      text(captionFor(i), L.caption.x, L.caption.y, { size: L.caption.size, color: C.muted, align: L.caption.align, maxW: L.caption.maxW, alpha: c });
    }
  }

  function drawFooter() {
    const f = L.footer;
    let x = f.legend.x;
    const y = f.legend.y;
    const items = [["train", "学習の流れ"], ["infer", "書き出しの流れ"], ["bpe", "同じBPE"], ["dup", "同じ文"]];
    for (const [kind, label] of items) {
      strokeRoute(poly(x, y - 6, x + 34, y - 6), kind, 1, false);
      x += 42;
      x += text(label, x, y, { size: f.size, color: C.muted }) + 22;
    }
    const src = `原典 ${REPOSITORY}（${COMMIT.slice(0, 7)}・MIT）・保存済み実行の説明図`;
    text(src, f.source.x, f.source.y, { size: f.size * 0.92, color: C.muted, align: f.source.align, maxW: f.source.maxW });
    if (f.note) text("動きは概念で、計測の再生ではありません。続きは小さなモデルの保存済み出力。", f.note.x, f.note.y, { size: f.note.size, color: C.muted, align: "right", maxW: 640 });
  }

  // ---------------------------------------------------------------- editor and render glue

  let ready = false;
  let current = 0;
  let playing = false;
  let playFrom = 0;
  let playStart = 0;
  let raf = 0;
  const END = DURATION;

  function syncUI() {
    ui.scrub.value = String(current);
    ui.time.textContent = `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
    ui.play.textContent = playing ? "一時停止" : current >= END ? "もう一度再生" : "再生";
  }

  function show(t) {
    current = clamp(Number(t) || 0, 0, END);
    drawFrame(current);
    if (!RENDER) syncUI();
  }

  function stop() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function tick() {
    if (!playing) return;
    const t = playFrom + (performance.now() - playStart) / 1000;
    if (t >= END) {
      stop();
      show(END);
      return;
    }
    show(t);
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (!ready || RENDER) return;
    if (playing) { stop(); syncUI(); return; }
    if (current >= END) current = 0;
    playing = true;
    playFrom = current;
    playStart = performance.now();
    syncUI();
    raf = requestAnimationFrame(tick);
  }

  function setControls(enabled) {
    for (const node of [ui.play, ui.reset, ui.scrub, ...ui.scenes]) node.disabled = !enabled;
  }

  const readyPromise = (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const data = await verifyAssets((n, total) => {
      ui.status.textContent = `素材を確かめています（${n}/${total}）`;
    });
    prepare(data);
    ready = true;
    return true;
  })();
  window.motionReady = readyPromise;

  window.seek = (t) => readyPromise.then(() => {
    stop();
    show(t);
  });

  readyPromise.then(() => {
    ui.status.textContent = "9/9 素材を確かめました（manifest と各素材のSHA-256・バイト数）。一時停止中です。";
    ui.canvas.setAttribute("aria-label", `32秒の無音の図解。自作の英文${D.d.story_lines}行を学習${D.d.train_lines}行と検証${D.d.val_lines}行に分け（検証${D.d.val_lines}行はすべて学習側にもある）、学習側だけのBPE（語彙${D.d.vocab_size}）、同じ初期値から0回更新と${D.t.after.completed_steps}回更新の2つのモデル、同じ書き出し「${D.p01.input.text}」の番号を両方に渡した保存済みの続き、質問「${D.p08.input.text}」にも物語が続くこと、前後を含むJSONの記録までを1枚の図で示します。`);
    if (!RENDER) setControls(true);
    show(0);
  }, (error) => {
    ready = false;
    stop();
    setControls(false);
    if (ctx || ui.canvas.getContext) {
      const c = ui.canvas.getContext("2d");
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
    }
    ui.canvas.hidden = true;
    ui.status.textContent = "素材を確かめられなかったため、図を表示していません。";
    ui.reason.textContent = error instanceof AssetError ? error.message : "素材を読み込めませんでした。接続を確かめて、もう一度読み込んでください。";
    ui.failure.hidden = false;
  });

  ui.retry.addEventListener("click", () => location.reload());
  if (!RENDER) {
    ui.play.addEventListener("click", play);
    ui.reset.addEventListener("click", () => { if (!ready) return; stop(); show(0); });
    ui.scrub.addEventListener("input", () => { if (!ready) return; stop(); show(Number(ui.scrub.value)); });
    for (const button of ui.scenes) {
      button.addEventListener("click", () => {
        if (!ready) return;
        const sc = D.scenes[Number(button.dataset.scene)];
        stop();
        show(sc.in === 0 ? 0 : sc.in + 0.4);
      });
    }
  }
})();
