/* Train LLM From Scratch 作例 — 図解ページ. Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * Reads the saved run record (outputs/training-run.json) and the three frozen inputs, checks
 * their pinned SHA-256 values and that they belong together, then draws one connected diagram
 * of that actual run: corpus → training-only BPE → 0-update and 800-update models → the saved
 * continuations of the same prompt. Nothing here runs Python, trains, generates or calls an AI.
 * There is no built-in fallback data: if anything is missing or does not match, the page clears
 * what it drew, says why, and offers a retry.
 */
"use strict";

(() => {
  const RECORD_URL = "outputs/training-run.json";
  const RECORD_SHA256 = "c2a688ba465078f37bd4e9d2ede7b65107a811525fec064e62a174d4bd4c39e0";
  const REQUEST_URL = "request.txt";
  const EXPECTED = {
    format: "studio-yebisu-tiny-lm-run-v1",
    promptsFormat: "studio-yebisu-tiny-lm-prompts-v1",
    configFormat: "studio-yebisu-tiny-lm-config-v1",
    repository: "FareedKhan-dev/train-llm-from-scratch",
    commit: "bdd480a518094ca834e05ab32131dc126b522d3d",
    copyright: "Copyright (c) 2025 Fareed Khan",
    sourceFiles: 48,
    storyLines: 96,
    ids: ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08"],
    commands: ["prepare-data", "train-baseline-0", "train-800", "generate-cli-before-P01", "generate-cli-after-P01"],
    artifacts: 9,
    recordKeys: ["source", "config", "inputs_sha256", "checks", "environment", "dataset", "model", "training",
      "notes", "commands", "artifacts", "samples"],
  };
  // Facts of this one saved run. The record is pinned by SHA-256; these guard what the diagram draws.
  const RUN = {
    trainLines: 83, valLines: 13, duplicateLines: 13, uniqueLines: 64, trainTokens: 3072, valTokens: 483,
    vocab: 417, vocabRequested: 512, merges: 160, endoftextId: 416, vocabRows: 448, paddingRows: 31,
    parameters: 135552, context: 64, blocks: 2, heads: 4, embed: 64, steps: 800, seed: 2201, newTokens: 48,
    finalBatches: 200, periodicBatches: 10,
  };
  const INPUTS = {
    "input/prompts.json": "fa1a3d7922b294d608b82b2fb2000ae385a371d34a66e49ebdb6e834a88fc66e",
    "input/run-config.json": "097fda8dff2d3d2fd825ab0431f05f6eceafa099364cdc01b0230a47f5debf69",
    "input/stories.txt": "dfef8dc0905dc3d775cf295fd87e358cfae216d4e72e50d1d850f21e9522e80e",
  };
  // Every check run.py records, with what it means. All must be true in the record.
  const CHECK_LABELS = {
    inputs_sha256_match: "入力3ファイルのSHA-256が固定値と一致",
    upstream_files_sha256_match: "原典48ファイルのSHA-256が固定コミットの値と一致",
    stories_96_nonempty_lines: "英文が空行なしの96行",
    prompts_frozen_p01_to_p08: "8つの入力がP01〜P08の順で、形がそろっている",
    upstream_modules_loaded_from_vendor: "読み込んだ原典のモジュールが同梱の vendor/ のもの",
    train_h5_int32_1d: "学習側のHDF5が1次元のint32",
    val_h5_int32_1d: "検証側のHDF5が1次元のint32",
    train_token_ids_in_range: "学習側のトークンIDが語彙の範囲内",
    val_token_ids_in_range: "検証側のトークンIDが語彙の範囲内",
    train_h5_matches_upstream_split_text: "学習側のHDF5が、原典の split_text で分けた文の符号化（末尾に区切り記号）と一致",
    val_h5_matches_upstream_split_text: "検証側のHDF5が、原典の split_text で分けた文の符号化（末尾に区切り記号）と一致",
    train_h5_decodes_to_split_with_eot: "学習側のHDF5を文字に戻すと、分けた文と区切り記号に一致",
    val_h5_decodes_to_split_with_eot: "検証側のHDF5を文字に戻すと、分けた文と区切り記号に一致",
    train_h5_attrs_match_tokenizer: "学習側のHDF5の属性が tokenizer.json と一致",
    val_h5_attrs_match_tokenizer: "検証側のHDF5の属性が tokenizer.json と一致",
    split_keeps_every_story_line: "学習側と検証側を合わせると96行がそろう",
    bpe_retrained_from_train_split_matches: "学習側だけでBPEを学び直すと、保存された語彙と一致",
    corpus_roundtrip_exact: "96行全体を符号化して戻すと元の文と一致",
    prompts_roundtrip_exact: "8つの入力を符号化して戻すと元の文と一致",
    val_has_full_window: "検証側に64トークンの窓が1つ以上ある",
    baseline_has_zero_updates: "学習前のモデルは更新0回（損失の記録も空）",
    trained_has_all_updates: "学習後のモデルは800回更新し、損失が800個",
    losses_finite: "すべての損失が有限の値",
    config_same_except_steps_and_out_path: "2回の学習設定の違いは、更新回数・学習率を下げる時点・保存先だけ",
    config_matches_frozen_input: "チェックポイントの設定が固定した設定と一致",
    tokenizer_in_checkpoints_matches: "2つのモデルに保存されたトークナイザーが tokenizer.json と一致",
    same_tensor_names_shapes_dtypes: "学習前後でテンソルの名前・形・型が同じ",
    baseline_equals_fresh_seeded_init: "学習前の重みが、同じseedで新しく作ったモデルと一致",
    weights_changed: "学習で重みが変わった",
    state_sha256_differs: "学習前後の重みのSHA-256が異なる",
    parameter_count_matches_cli: "パラメータ数が学習CLIの表示と一致",
    final_losses_match_cli: "最後の損失が学習CLIの表示と一致",
    periodic_checkpoints_complete: "200・400・600・800回の保存点がそろっている",
    checkpoint_metadata_consistent: "保存点の回数・設定・損失が整合",
    checkpoint_losses_are_prefixes: "保存点の損失の列が、最終の列の先頭と一致",
    last_checkpoint_state_equals_trained: "800回の保存点と学習後のモデルの重みが一致",
    generation_shapes_and_prefix: "どの生成も入力のトークンから始まり、新しいトークンが48個",
    generate_cli_header_matches_model: "生成CLIが表示したモデルの大きさ・窓・装置が一致",
    generate_cli_matches_api_before_P01: "P01・学習前：生成CLIとAPIの全文が一致",
    generate_cli_matches_api_after_P01: "P01・800回更新後：生成CLIとAPIの全文が一致",
    inputs_unchanged_after_run: "実行後も入力3ファイルが変わっていない",
    upstream_files_unchanged_after_run: "実行後も原典48ファイルが変わっていない",
    site_files_unchanged: "公開フォルダのファイルが増えも変わりもしていない",
    artifact_files_exactly_expected: "非公開の保存先に、予定したファイルだけがある",
  };
  const PHASE_LABEL = { before: "0回更新", after: "800回更新" };

  const $ = (selector) => document.querySelector(selector);
  const view = {
    status: $("#status"),
    retry: $("#retry"),
    cases: Array.from(document.querySelectorAll(".case")),
    allCases: $("#all-cases"),
    diagram: $("#diagram"),
    phase: $("#phase"),
    phaseInputs: Array.from(document.querySelectorAll('input[name="phase"]')),
    save: $("#save"),
    saveStatus: $("#save-status"),
    viewerLink: $("#viewer-link"),
    fullInput: $("#full-input"),
    inputSettings: $("#input-settings"),
    beforeText: $("#before-text"),
    afterText: $("#after-text"),
    beforeCounts: $("#before-counts"),
    afterCounts: $("#after-counts"),
    beforeIds: $("#before-ids"),
    afterIds: $("#after-ids"),
    dupSummary: $("#dup-summary"),
    dupList: $("#dup-list"),
    chart: $("#loss-chart"),
    lossSummary: $("#loss-summary"),
    estimateTable: $("#estimate-table"),
    checkpointTable: $("#checkpoint-table"),
    uniformNote: $("#uniform-note"),
    checkList: $("#check-list"),
    checkCount: $("#check-count"),
    factsList: $("#facts-list"),
    commandList: $("#command-list"),
    copy: $("#copy-request"),
    copyStatus: $("#copy-status"),
    fallback: $("#request-fallback"),
    fallbackLabel: $("#request-fallback-label"),
  };
  const state = { record: null, current: null, phase: "after", twins: null, lines: null, controller: null, token: 0, chartWidth: 0 };
  const wideQuery = window.matchMedia("(min-width: 760px)");

  class RecordError extends Error {}
  const fail = (message) => { throw new RecordError(message); };

  // ---------------------------------------------------------------- small helpers

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    for (const child of children) node.append(child);
    return node;
  }

  function svgEl(tag, attrs = {}, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const isCount = (v) => Number.isInteger(v) && v >= 0;
  const isHex = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
  const fmtLoss = (v) => v.toFixed(4);
  const fmtInt = (v) => v.toLocaleString("ja-JP");

  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (isObj(value)) {
      return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function fetchOk(url, signal) {
    const response = await fetch(url, { cache: "no-store", signal });
    if (!response.ok) {
      if (url === RECORD_URL && response.status === 404) {
        fail("学習の記録（outputs/training-run.json）が見つかりません（HTTP 404）。配置を確かめて、もう一度読み込んでください。");
      }
      fail(`${url} を読み込めませんでした（HTTP ${response.status}）。`);
    }
    return response;
  }

  // ---------------------------------------------------------------- loading

  function setControls(enabled) {
    for (const button of view.cases) button.disabled = !enabled;
    for (const button of view.allCases.querySelectorAll("button")) button.disabled = !enabled;
    view.phase.disabled = !enabled;
    view.save.disabled = !enabled;
  }

  function setState(name, message) {
    view.status.dataset.state = name;
    view.status.textContent = message;
    view.retry.hidden = name !== "error";
    setControls(name === "ready");
  }

  function clearView() {
    state.record = null;
    state.current = null;
    state.twins = null;
    state.lines = null;
    state.chartWidth = 0;
    for (const node of [view.diagram, view.allCases, view.inputSettings, view.dupList, view.chart, view.estimateTable,
      view.checkpointTable, view.checkList, view.factsList, view.commandList, view.fullInput, view.beforeText,
      view.afterText]) {
      node.replaceChildren();
    }
    for (const node of [view.beforeCounts, view.afterCounts, view.beforeIds, view.afterIds, view.dupSummary,
      view.lossSummary, view.uniformNote, view.saveStatus]) {
      node.textContent = "";
    }
    view.diagram.setAttribute("aria-busy", "true");
    for (const button of view.cases) button.setAttribute("aria-pressed", "false");
    view.save.textContent = "選んだ記録をJSONで保存";
    view.viewerLink.href = "comparison.html";
    view.viewerLink.textContent = "元の閲覧画面で記録を詳しく見る";
  }

  async function load() {
    if (state.controller) state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    const token = ++state.token;
    clearView();
    setState("loading", "保存済みの実行記録を確かめています…");
    try {
      if (!window.crypto || !crypto.subtle) {
        fail("SHA-256を確かめるには、安全な接続（HTTPS または localhost）で開く必要があります。");
      }
      const paths = Object.keys(INPUTS);
      const responses = await Promise.all([
        fetchOk(RECORD_URL, controller.signal),
        ...paths.map((path) => fetchOk(path, controller.signal)),
      ]);
      const buffers = await Promise.all(responses.map((r) => r.arrayBuffer()));
      const hashes = await Promise.all(buffers.map(sha256Hex));
      if (hashes[0] !== RECORD_SHA256) fail("実行記録（outputs/training-run.json）のSHA-256が固定値と一致しません。");
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let record;
      try {
        record = JSON.parse(decoder.decode(buffers[0]));
      } catch {
        fail("実行記録をJSONとして読めませんでした。");
      }
      const texts = {};
      paths.forEach((path, i) => {
        if (hashes[i + 1] !== INPUTS[path]) fail(`${path} のSHA-256が固定値と一致しません。`);
        texts[path] = decoder.decode(buffers[i + 1]);
      });
      let promptsDoc;
      let config;
      try {
        promptsDoc = JSON.parse(texts["input/prompts.json"]);
        config = JSON.parse(texts["input/run-config.json"]);
      } catch {
        fail("入力ファイルをJSONとして読めませんでした。");
      }
      const extra = validate(record, promptsDoc, config, texts["input/stories.txt"]);
      if (token !== state.token) return;
      render(record, extra);
      setState("ready", "保存済みの実行記録と入力のSHA-256を確かめました。");
      choose(hashId() || EXPECTED.ids[0]);
      drawChart();
    } catch (error) {
      if (token !== state.token || error.name === "AbortError") return;
      clearView();
      const message = error instanceof RecordError
        ? error.message
        : error instanceof TypeError && /decode/i.test(String(error.message))
          ? "記録か入力が正しいUTF-8ではありません。"
          : "記録を読み込めませんでした。接続を確かめて、もう一度読み込んでください。";
      setState("error", message);
    } finally {
      if (token === state.token) state.controller = null;
    }
  }

  // ---------------------------------------------------------------- validation

  function count(list, predicate) {
    let n = 0;
    for (const item of list) if (predicate(item)) n += 1;
    return n;
  }

  function validate(rec, promptsDoc, config, stories) {
    // ---- everything the original viewer (comparison.js) checks
    if (!isObj(rec)) fail("実行記録がJSONのオブジェクトではありません。");
    if (rec.format !== EXPECTED.format) fail("実行記録の形式が違います。");
    if (!isObj(rec.source) || rec.source.repository !== EXPECTED.repository || rec.source.commit !== EXPECTED.commit) {
      fail("実行記録の原典リポジトリか固定コミットが一致しません。");
    }
    if (!isObj(rec.inputs_sha256) || canonical(rec.inputs_sha256) !== canonical(INPUTS)) {
      fail("実行記録にある入力のSHA-256が固定値と一致しません。");
    }
    if (!isObj(config) || canonical(rec.config) !== canonical(config)) {
      fail("実行記録の設定が input/run-config.json と一致しません。");
    }
    const prompts = isObj(promptsDoc) && Array.isArray(promptsDoc.prompts) ? promptsDoc.prompts : [];
    if (canonical(prompts.map((p) => p && p.id)) !== canonical(EXPECTED.ids)) fail("input/prompts.json の入力がP01〜P08ではありません。");

    const lines = stories.split(/\r?\n/);
    if (lines[lines.length - 1] === "") lines.pop();
    if (lines.length !== EXPECTED.storyLines || lines.some((line) => !line.trim())) fail("input/stories.txt が96行ではありません。");

    if (!isObj(rec.checks)) fail("実行時の確認がありません。");
    for (const [name, label] of Object.entries(CHECK_LABELS)) {
      if (rec.checks[name] !== true) fail(`実行時の確認「${label}」が記録にありません。`);
    }

    const m = rec.model;
    if (!isObj(m) || !isCount(m.parameters) || m.parameters === 0 || m.arch !== config.arch
      || m.context_length !== config.context_length || !isCount(m.vocab_rows) || !Array.isArray(m.tensors)) {
      fail("モデルの記録が設定と合いません。");
    }

    const t = rec.training;
    if (!isObj(t) || t.optimizer_steps !== config.steps || t.baseline_steps !== 0) fail("更新回数が「学習前0回・学習後800回」ではありません。");
    if (!Array.isArray(t.losses) || t.losses.length !== config.steps || !t.losses.every(isNum)) {
      fail(`損失の配列が${config.steps}個の有限の数ではありません。`);
    }
    for (const side of ["before", "after"]) {
      const s = t[side];
      if (!isObj(s) || !isNum(s.train_loss) || !isNum(s.dev_loss) || !isHex(s.state_sha256)) fail("学習前後の損失か重みのSHA-256が欠けています。");
    }
    if (t.before.completed_steps !== 0 || t.after.completed_steps !== config.steps) fail("学習前後の更新回数が合いません。");
    if (t.before.state_sha256 === t.after.state_sha256) fail("学習前後の重みが同じです。");

    let periodic = [];
    for (let s = config.checkpoint_every; s <= config.steps; s += config.checkpoint_every) periodic.push(s);
    if (config.keep_last > 0) periodic = periodic.slice(-config.keep_last);
    if (!Array.isArray(t.checkpoints) || canonical(t.checkpoints.map((c) => c && c.completed_steps)) !== canonical([0, ...periodic])) {
      fail("途中の保存点がそろっていません。");
    }
    t.checkpoints.forEach((c, i) => {
      if (!isHex(c.state_sha256)) fail("保存点の重みのSHA-256が欠けています。");
      if (i === 0) {
        if (!isObj(c.final_estimate) || !isNum(c.final_estimate.train_loss) || !isNum(c.final_estimate.dev_loss)) fail("学習前の損失が欠けています。");
      } else {
        const e = c.periodic_eval;
        if (!isNum(c.minibatch_loss) || !isObj(e) || !isNum(e.train_loss) || !isNum(e.dev_loss) || !isCount(e.after_updates)) {
          fail("保存点の損失が欠けています。");
        }
      }
    });

    const d = rec.dataset;
    if (!isObj(d) || d.story_lines !== EXPECTED.storyLines || !isCount(d.train_tokens) || !isCount(d.val_tokens)) {
      fail("データの記録が96行の入力と合いません。");
    }

    if (!Array.isArray(rec.samples) || rec.samples.length !== prompts.length) fail("生成の記録が8件ではありません。");
    rec.samples.forEach((s, i) => {
      const p = prompts[i];
      if (!isObj(s) || s.id !== p.id || s.label !== p.label || !isObj(s.input)) fail(`${p.id} の記録が固定した入力と合いません。`);
      for (const key of ["text", "max_new_tokens", "temperature", "top_k", "seed"]) {
        if (s.input[key] !== p[key]) fail(`${p.id} の入力（${key}）が固定した入力と一致しません。`);
      }
      for (const side of ["before", "after"]) {
        const o = s[side];
        if (!isObj(o) || typeof o.text !== "string" || !Array.isArray(o.token_ids) || !o.token_ids.every(isCount)
          || o.new_tokens !== p.max_new_tokens || o.token_ids.length !== o.prompt_tokens + p.max_new_tokens
          || !o.text.startsWith(p.text)) {
          fail(`${p.id} の生成の記録が欠けているか、入力と合いません。`);
        }
      }
    });

    if (!Array.isArray(rec.commands) || rec.commands.length === 0
      || !rec.commands.every((c) => isObj(c) && c.exit_code === 0 && Array.isArray(c.args) && isNum(c.seconds))) {
      fail("コマンドの記録が欠けているか、終了コードが0ではありません。");
    }

    // ---- additional checks for what this page draws
    for (const key of EXPECTED.recordKeys) if (!(key in rec)) fail(`実行記録に ${key} がありません。`);
    if (promptsDoc.format !== EXPECTED.promptsFormat) fail("input/prompts.json の形式が違います。");
    if (config.format !== EXPECTED.configFormat) fail("input/run-config.json の形式が違います。");
    const src = rec.source;
    if (src.files_verified !== EXPECTED.sourceFiles || src.modified !== false || src.license !== "MIT" || src.copyright !== EXPECTED.copyright) {
      fail("原典48ファイル・無改変・MITの記録が一致しません。");
    }
    if (canonical(Object.keys(rec.checks).sort()) !== canonical(Object.keys(CHECK_LABELS).sort())) {
      fail("実行時の確認が、決めた44項目と一致しません。");
    }
    if (!isObj(rec.environment) || !isObj(rec.notes)) fail("実行環境か注記の記録が欠けています。");

    if (canonical(rec.commands.map((c) => c.id)) !== canonical(EXPECTED.commands)) fail("実行したコマンドの記録が5件の予定と一致しません。");
    for (const c of rec.commands) {
      if (c.args[0] !== "python" || !c.args.every((a) => typeof a === "string") || !isNum(c.timeout_seconds)) {
        fail(`コマンド ${c.id} の記録の形が違います。`);
      }
    }
    const argAfter = (c, flag) => c.args[c.args.indexOf(flag) + 1];
    const [prep, base, train, cliBefore, cliAfter] = rec.commands;
    if (argAfter(prep, "--vocab_size") !== String(config.vocab_size) || argAfter(prep, "--dataset") !== config.dataset) {
      fail("データ準備のコマンドが設定と合いません。");
    }
    if (argAfter(base, "--steps") !== "0" || argAfter(train, "--steps") !== String(config.steps)
      || argAfter(base, "--seed") !== String(config.seed) || argAfter(train, "--seed") !== String(config.seed)) {
      fail("学習コマンドの更新回数かseedが「0回と800回・同じseed」ではありません。");
    }
    for (const c of [cliBefore, cliAfter]) {
      if (argAfter(c, "--input_text") !== prompts[0].text || argAfter(c, "--max_new_tokens") !== String(prompts[0].max_new_tokens)) {
        fail("P01の生成CLIのコマンドが入力と合いません。");
      }
    }

    if (!Array.isArray(rec.artifacts) || rec.artifacts.length !== EXPECTED.artifacts
      || !rec.artifacts.every((a) => isObj(a) && typeof a.label === "string" && isCount(a.bytes) && a.bytes > 0 && isHex(a.sha256) && a.public === false)) {
      fail("非公開の保存物9件の記録（名前・バイト数・SHA-256・非公開）が欠けています。");
    }

    const facts = [
      [d.train_lines, RUN.trainLines], [d.val_lines, RUN.valLines], [d.val_lines_identical_to_a_train_line, RUN.duplicateLines],
      [d.train_tokens, RUN.trainTokens], [d.val_tokens, RUN.valTokens], [d.vocab_size, RUN.vocab],
      [d.vocab_size_requested, RUN.vocabRequested], [d.merges, RUN.merges], [d.endoftext_id, RUN.endoftextId],
      [m.parameters, RUN.parameters], [m.vocab_rows, RUN.vocabRows], [m.padding_rows, RUN.paddingRows],
      [m.context_length, RUN.context], [m.n_blocks, RUN.blocks], [m.n_head, RUN.heads], [m.n_embed, RUN.embed],
      [t.optimizer_steps, RUN.steps], [t.seed, RUN.seed], [config.seed, RUN.seed],
      [t.final_estimate_batches_per_split, RUN.finalBatches], [t.periodic_eval_batches_per_split, RUN.periodicBatches],
    ];
    if (facts.some(([actual, expected]) => actual !== expected)) fail("記録の数値が、この作例の実行の値と一致しません。");
    if (!Array.isArray(d.special_tokens) || !d.special_tokens.every((s) => typeof s === "string") || !isObj(d.prompt_tokens)) {
      fail("語彙の特別な記号か書き出しのトークン数の記録が欠けています。");
    }
    if (d.bpe_trained_on !== "train split only" || m.pretrained_weights !== false || d.train_lines + d.val_lines !== lines.length) {
      fail("BPEの学習範囲か事前学習済みの重みの記録が一致しません。");
    }
    if (t.batch_size !== config.batch_size || t.learning_rate !== config.lr) fail("学習の設定がバッチ数か学習率で合いません。");
    const first = t.checkpoints[0];
    const last = t.checkpoints[t.checkpoints.length - 1];
    if (first.state_sha256 !== t.before.state_sha256 || last.state_sha256 !== t.after.state_sha256
      || first.final_estimate.dev_loss !== t.before.dev_loss || first.final_estimate.train_loss !== t.before.train_loss) {
      fail("保存点と学習前後のモデルの記録が一致しません。");
    }
    for (const c of t.checkpoints.slice(1)) {
      if (c.minibatch_loss !== t.losses[c.completed_steps - 1]) fail("保存点のミニバッチ損失が損失の配列と一致しません。");
    }

    rec.samples.forEach((s) => {
      const promptTokens = d.prompt_tokens && d.prompt_tokens[s.id];
      for (const side of ["before", "after"]) {
        const o = s[side];
        if (o.prompt_tokens !== promptTokens || o.new_tokens !== RUN.newTokens) fail(`${s.id} の書き出しのトークン数が記録と合いません。`);
        if (!isCount(o.ids_skipped_in_text) || !isCount(o.endoftext_tokens) || !isCount(o.replacement_chars)) {
          fail(`${s.id} の件数の記録が欠けています。`);
        }
        if (o.endoftext_tokens !== count(o.token_ids, (id) => id === d.endoftext_id)
          || o.ids_skipped_in_text !== count(o.token_ids, (id) => id >= d.vocab_size)
          || o.replacement_chars !== count(o.text, (ch) => ch === "�")) {
          fail(`${s.id} の区切り記号・語彙外ID・置換文字の件数が中身と合いません。`);
        }
      }
      const a = s.before.token_ids.slice(0, promptTokens);
      const b = s.after.token_ids.slice(0, promptTokens);
      if (canonical(a) !== canonical(b)) fail(`${s.id} の書き出しの番号が、2つのモデルで一致しません。`);
    });

    // The last 13 lines are the validation side; each must equal a line on the training side.
    const trainSide = lines.slice(0, d.train_lines);
    const valSide = lines.slice(d.train_lines);
    const twins = valSide.map((line) => trainSide.indexOf(line));
    if (twins.filter((j) => j >= 0).length !== d.val_lines_identical_to_a_train_line) {
      fail("英文の検証側と学習側の重なりが、記録の13行と一致しません。");
    }
    if (new Set(lines).size !== RUN.uniqueLines) fail("英文の異なる行の数が64ではありません。");
    return { lines, twins };
  }

  // ---------------------------------------------------------------- static parts of the record

  function render(rec, extra) {
    state.record = rec;
    state.lines = extra.lines;
    state.twins = extra.twins;
    const t = rec.training;
    const m = rec.model;
    const d = rec.dataset;

    view.allCases.replaceChildren(...rec.samples.map((s) => {
      const button = el("button", { type: "button", "aria-pressed": "false", "data-id": s.id },
        el("span", { class: "sample-id" }, s.id), el("span", { class: "sample-label" }, s.label));
      button.addEventListener("click", () => choose(s.id, { updateHash: true }));
      return button;
    }));

    // Duplicate lines, from the actual input file.
    view.dupSummary.textContent = `英文${d.story_lines}行のうち、末尾の${d.val_lines}行が検証側です（原典の split_text が末尾12.5%付近の改行で分割）。その${d.val_lines}行はすべて、学習側${d.train_lines}行の中に同じ文があります。英文全体の異なる文は${new Set(extra.lines).size}種類です。BPEは学習側の文だけで作りました。`;
    view.dupList.replaceChildren(...extra.twins.map((j, k) => {
      const valNo = d.train_lines + k + 1;
      return el("li", {},
        el("span", { class: "pair-no" }, `${valNo}行目（検証） = ${j + 1}行目（学習）`),
        el("span", { class: "line-text" }, extra.lines[d.train_lines + k]));
    }));

    // Loss: the 200-batch final estimates, kept apart from the minibatch curve.
    view.estimateTable.replaceChildren(
      el("tr", {}, el("th", { scope: "row" }, "0回更新"), el("td", {}, fmtLoss(t.before.train_loss)), el("td", {}, fmtLoss(t.before.dev_loss))),
      el("tr", {}, el("th", { scope: "row" }, `${t.optimizer_steps}回更新`), el("td", {}, fmtLoss(t.after.train_loss)), el("td", {}, fmtLoss(t.after.dev_loss))),
    );
    view.checkpointTable.replaceChildren(...t.checkpoints.slice(1).map((c) => {
      const e = c.periodic_eval;
      return el("tr", {}, el("th", { scope: "row" }, fmtInt(c.completed_steps)),
        el("td", {}, `${e.after_updates}回目の更新後`), el("td", {}, fmtLoss(e.train_loss)),
        el("td", {}, fmtLoss(e.dev_loss)), el("td", {}, fmtLoss(c.minibatch_loss)));
    }));
    view.uniformNote.textContent = `参考：出力の${fmtInt(m.vocab_rows)}行（語彙${d.vocab_size}＋余り${m.padding_rows}）に均等に賭けた場合の損失は ln(${m.vocab_rows}) ≈ ${Math.log(m.vocab_rows).toFixed(3)} です。`;

    const seconds = (id) => {
      const c = rec.commands.find((x) => x.id === id);
      return c ? `${c.seconds.toFixed(3)}秒` : "記録なし";
    };
    const env = rec.environment;
    const pkgs = isObj(env.packages) ? env.packages : {};
    const facts = [
      ["データ", `自作の英文${d.story_lines}行。学習側${d.train_lines}行・${fmtInt(d.train_tokens)}トークン、検証側${d.val_lines}行・${fmtInt(d.val_tokens)}トークン（区切り記号を含む）。検証側${d.val_lines}行のうち${d.val_lines_identical_to_a_train_line}行は学習側にも同じ行があります。`],
      ["BPE語彙", `${d.vocab_size}（指定${d.vocab_size_requested}・統合${d.merges}回・区切り記号 ${d.special_tokens.join("")} は${d.endoftext_id}番）。学習側だけで学習。`],
      ["モデル", `${m.arch}・${m.n_embed}次元・${m.n_head}ヘッド・${m.n_blocks}ブロック・文脈${m.context_length}トークン・${fmtInt(m.parameters)}パラメータ。出力${m.vocab_rows}行のうち語彙の外の余り${m.padding_rows}行。事前学習済みの重みは使っていません。`],
      ["学習", `同じseed ${t.seed}・同じ初期値から、0回更新と${t.optimizer_steps}回更新。${t.optimizer}・バッチ${t.batch_size}・学習率${t.learning_rate}（${t.lr_decay_at_zero_based_step + 1}回目の更新のあと${t.learning_rate_decayed}）・CPU ${t.threads}スレッド。`],
      ["重みのSHA-256", `0回 ${t.before.state_sha256.slice(0, 12)}…／${t.optimizer_steps}回 ${t.after.state_sha256.slice(0, 12)}…（変わったテンソル ${m.changed_tensors}／${m.tensors.length}）`],
      ["所要時間", `${t.optimizer_steps}回の学習CLI ${seconds(`train-${t.optimizer_steps}`)}（評価と保存を含む、このPC1台の経過時間）`],
      ["実行環境", `Python ${env.python || "?"}・PyTorch ${pkgs.torch || "?"}・${env.os || "?"} ${env.machine || ""}`.trim()],
    ];
    view.factsList.replaceChildren(...facts.map(([k, v]) => el("div", {}, el("dt", {}, k), el("dd", {}, v))));

    view.commandList.replaceChildren(...rec.commands.map((c) => el("li", {},
      `${c.id}：終了コード ${c.exit_code}・${c.seconds.toFixed(3)}秒`,
      el("code", {}, c.args.map(shellWord).join(" ")))));

    view.checkCount.textContent = String(Object.keys(rec.checks).length);
    view.checkList.replaceChildren(...Object.keys(rec.checks).map((name) =>
      el("li", {}, CHECK_LABELS[name] || name)));
  }

  function shellWord(arg) {
    const s = String(arg);
    return /^[\w@%+=:,./<>-]+$/.test(s) ? s : JSON.stringify(s);
  }

  function hashId() {
    let id = "";
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ""; }
    return EXPECTED.ids.includes(id) ? id : null;
  }

  function countsText(o) {
    const parts = [`書き出し${o.prompt_tokens}トークン＋新しく${o.new_tokens}トークン`];
    parts.push(`語彙の外のID（埋め込みの余り行）${o.ids_skipped_in_text}個`);
    parts.push(`区切り記号 <|endoftext|> ${o.endoftext_tokens}個`);
    parts.push(`置換文字（�）${o.replacement_chars}個`);
    return parts.join("・");
  }

  function renderOutput(node, text, prompt) {
    node.replaceChildren();
    if (text.startsWith(prompt)) {
      node.append(el("span", { class: "prefix" }, prompt), document.createTextNode(text.slice(prompt.length)));
    } else {
      node.textContent = text;
    }
  }

  // ---------------------------------------------------------------- selection

  function choose(id, options = {}) {
    const rec = state.record;
    if (!rec) return;
    const sample = rec.samples.find((s) => s.id === id) || rec.samples[0];
    state.current = sample;
    for (const button of view.cases) button.setAttribute("aria-pressed", String(button.dataset.id === sample.id));
    for (const button of view.allCases.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.id === sample.id));
    }
    view.save.textContent = `${sample.id}の記録をJSONで保存`;
    view.viewerLink.href = `comparison.html#${sample.id}`;
    view.viewerLink.textContent = `元の閲覧画面で${sample.id}の記録を詳しく見る`;
    view.saveStatus.textContent = "";

    view.fullInput.textContent = sample.input.text;
    const settings = [
      ["番号", `${sample.id}（${sample.label}）`],
      ["書き出しのトークンID", sample.after.token_ids.slice(0, sample.after.prompt_tokens).join(" ")],
      ["生成の条件", `新しく${sample.input.max_new_tokens}トークン・温度${sample.input.temperature}・top_k ${sample.input.top_k}（毎回いちばん確率の高い番号）・seed ${sample.input.seed}`],
    ];
    view.inputSettings.replaceChildren(...settings.map(([k, v]) => el("div", {}, el("dt", {}, k), el("dd", {}, v))));
    renderOutput(view.beforeText, sample.before.text, sample.input.text);
    renderOutput(view.afterText, sample.after.text, sample.input.text);
    view.beforeCounts.textContent = countsText(sample.before);
    view.afterCounts.textContent = countsText(sample.after);
    view.beforeIds.textContent = sample.before.token_ids.join(" ");
    view.afterIds.textContent = sample.after.token_ids.join(" ");

    drawDiagram();
    if (options.updateHash && location.hash !== `#${sample.id}`) history.replaceState(null, "", `#${sample.id}`);
  }

  function setPhase(phase) {
    state.phase = phase === "before" ? "before" : "after";
    for (const input of view.phaseInputs) input.checked = input.value === state.phase;
    drawDiagram();
  }

  // ---------------------------------------------------------------- the connected diagram

  // Two separately composed layouts in SVG user units. The wide one starts at the same
  // width as the CSS media query that changes the diagram's aspect ratio.
  const LAYOUTS = {
    narrow: {
      W: 360, H: 452,
      book: { x: 8, y: 20, w: 64, h: 80 },
      train: { x: 98, y: 12, w: 100, h: 62 },
      val: { x: 98, y: 84, w: 100, h: 28 },
      bulge: 212,
      bpe: { x: 222, y: 12, w: 130, h: 64 },
      dupLabel: { x: 8, y: 129 },
      strip: { x: 12, y: 138, w: 262, tagY: 13, textY: 29, chipsY: 36 },
      m0: { x: 16, y: 242, w: 128, h: 72 },
      m800: { x: 214, y: 242, w: 128, h: 72 },
      ring: 7,
      seed: { x: 176, y: 266, r: 11 },
      out0: { x: 6, y: 334, w: 170, h: 74 },
      out800: { x: 184, y: 334, w: 170, h: 74 },
      json: { x: 105, y: 420, w: 150, h: 28 },
      legend: [{ x: 6, y: 428, kind: "train" }, { x: 6, y: 443, kind: "infer" }, { x: 268, y: 443, kind: "dup" }],
      type: { glyph: 22, label: 11, small: 9.5, mono: 11.5, chip: 9, ids: 9, tag: 9.5 },
      outLines: 2, idCount: 5, outRightTag: false,
      routes: (sb) => ({
        corpusTrain: "M72,52 C86,52 86,40 96,40",
        corpusVal: "M72,68 C86,68 86,98 96,98",
        trainBpe: "M198,22 H220",
        bpeStrip: "M240,76 V136",
        stream: "M338,76 V233",
        branch0: `M137,${sb} C137,${sb + 16} 80,224 80,240`,
        branch800: `M137,${sb} C137,${sb + 16} 278,217 278,233`,
        seed0: "M165,266 H146",
        seed800: "M187,266 H205",
        out0: "M80,314 V332",
        out800: "M278,321 V332",
        json0: "M91,408 C91,428 96,434 103,434",
        json800: "M269,408 C269,428 264,434 257,434",
      }),
      blankChips: [[338, 104], [338, 132], [338, 160]],
      seedLabel: [{ x: 176, y: 291, anchor: "middle" }, { x: 176, y: 303, anchor: "middle" }],
    },
    wide: {
      W: 960, H: 380,
      book: { x: 16, y: 46, w: 92, h: 110 },
      train: { x: 138, y: 24, w: 140, h: 92 },
      val: { x: 138, y: 132, w: 140, h: 40 },
      bulge: 294,
      bpe: { x: 306, y: 28, w: 150, h: 84 },
      dupLabel: { x: 16, y: 198 },
      strip: { x: 180, y: 214, w: 290, tagY: 15, textY: 34, chipsY: 42 },
      m800: { x: 520, y: 32, w: 170, h: 96 },
      m0: { x: 520, y: 256, w: 170, h: 96 },
      ring: 8,
      seed: { x: 605, y: 192, r: 13 },
      out800: { x: 730, y: 28, w: 210, h: 100 },
      out0: { x: 730, y: 252, w: 210, h: 100 },
      json: { x: 760, y: 168, w: 150, h: 40 },
      legend: [{ x: 16, y: 300, kind: "train" }, { x: 16, y: 318, kind: "infer" }, { x: 16, y: 336, kind: "dup" }],
      type: { glyph: 30, label: 13, small: 11, mono: 13, chip: 11, ids: 10.5, tag: 11 },
      outLines: 3, idCount: 7, outRightTag: true,
      routes: (sb, mid) => ({
        corpusTrain: "M108,92 C123,92 123,70 136,70",
        corpusVal: "M108,112 C123,112 123,152 136,152",
        trainBpe: "M278,40 H304",
        bpeStrip: "M380,112 V212",
        stream: "M456,80 H510",
        branch800: `M470,${mid} C494,${mid} 490,116 510,116`,
        branch0: `M470,${mid} C494,${mid} 496,282 518,282`,
        seed800: "M605,179 V138",
        seed0: "M605,205 V254",
        out800: "M698,78 H728",
        out0: "M690,304 H728",
        json800: "M835,128 V166",
        json0: "M835,252 V210",
      }),
      blankChips: [[470, 80], [488, 80]],
      seedLabel: [{ x: 624, y: 189, anchor: "start" }, { x: 624, y: 205, anchor: "start" }],
    },
  };

  // An excerpt of the saved continuation: literal characters from the start of the text after
  // the prompt, stopped at the first line break, always marked with "…".
  function excerptLines(sample, side, perLine, maxLines) {
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

  function chipLayout(ids, width, size) {
    const charW = size * 0.62;
    const h = size + 6;
    const gap = 2.5;
    const chips = [];
    let x = 0;
    let row = 0;
    for (const id of ids) {
      const w = String(id).length * charW + 6;
      if (x > 0 && x + w > width) { x = 0; row += 1; }
      chips.push({ id, x, row, w, h });
      x += w + gap;
    }
    return { chips, rows: row + 1, h };
  }

  function gearPath(cx, cy, r, teeth) {
    const inner = r * 0.78;
    const parts = [];
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = (i / (teeth * 2)) * Math.PI * 2;
      const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : inner;
      parts.push(`${i === 0 ? "M" : "L"}${(cx + rr * Math.cos(a0)).toFixed(2)},${(cy + rr * Math.sin(a0)).toFixed(2)}`);
      parts.push(`L${(cx + rr * Math.cos(a1)).toFixed(2)},${(cy + rr * Math.sin(a1)).toFixed(2)}`);
    }
    return `${parts.join(" ")} Z`;
  }

  function drawDiagram() {
    const rec = state.record;
    const sample = state.current;
    if (!rec || !sample) { view.diagram.replaceChildren(); return; }
    const L = wideQuery.matches ? LAYOUTS.wide : LAYOUTS.narrow;
    const T = L.type;
    const d = rec.dataset;
    const t = rec.training;
    const promptIds = sample.after.token_ids.slice(0, sample.after.prompt_tokens);

    const root = svgEl("svg", {
      viewBox: `0 0 ${L.W} ${L.H}`, role: "img", "aria-labelledby": "diagram-title diagram-desc",
      "data-phase": state.phase, preserveAspectRatio: "xMidYMid meet",
    });
    const g = (cls) => { const node = svgEl("g", cls ? { class: cls } : {}); root.append(node); return node; };
    const text = (parent, x, y, str, size, cls = "", attrs = {}) => {
      const node = svgEl("text", { x, y, "font-size": size, class: cls, ...attrs }, str);
      if (/\bmono\b/.test(cls)) node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      parent.append(node);
      return node;
    };
    const rect = (parent, r, cls, rx = 4) => parent.append(svgEl("rect", { x: r.x, y: r.y, width: r.w, height: r.h, rx, class: cls }));
    const path = (parent, dPath, cls, marker) => parent.append(svgEl("path", { d: dPath, class: cls, ...(marker ? { "marker-end": `url(#${marker})` } : {}) }));

    // Literal excerpts for the description and the strips.
    const perLine = (w, size) => Math.max(8, Math.floor((w - 16) / (size * 0.6)));
    const ex0 = excerptLines(sample, "before", perLine(L.out0.w, T.mono), L.outLines);
    const ex800 = excerptLines(sample, "after", perLine(L.out800.w, T.mono), L.outLines);

    root.append(svgEl("title", { id: "diagram-title" }, `${sample.id}「${sample.input.text}」の保存済みの続き（0回更新と${t.optimizer_steps}回更新）`));
    root.append(svgEl("desc", { id: "diagram-desc" },
      `自作の英文${d.story_lines}行を学習${d.train_lines}行と検証${d.val_lines}行に分け、検証${d.val_lines}行はすべて学習側にも同じ文がある。BPEは学習側だけで作り語彙${d.vocab_size}。同じ初期値（seed ${t.seed}）から片方だけ${t.optimizer_steps}回調整。書き出し「${sample.input.text}」の${promptIds.length}個の番号（${promptIds.join(" ")}）を両方のモデルに渡した保存済みの続き。0回更新の抜粋「${ex0.join("")}」、${t.optimizer_steps}回更新の抜粋「${ex800.join("")}」。現在の強調は${PHASE_LABEL[state.phase]}。`));

    const defs = svgEl("defs");
    for (const [id, cls] of [["arrow-train", "arrow-train"], ["arrow-infer", "arrow-infer"]]) {
      const marker = svgEl("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" });
      marker.append(svgEl("path", { d: "M0,0 L10,5 L0,10 z", class: cls }));
      defs.append(marker);
    }
    root.append(defs);

    // ---- strip geometry first: the branches start at its edge
    const S = L.strip;
    const chipInfo = chipLayout(promptIds, S.w - 24, T.chip);
    const stripH = S.chipsY + chipInfo.rows * (chipInfo.h + 4) + 4;
    const routes = L.routes(S.y + stripH, S.y + stripH / 2);

    // ---- corpus: one book of 96 lines splits into 83 training and 13 validation lines
    const corpus = g("corpus");
    const B = L.book;
    rect(corpus, { x: B.x + 4, y: B.y - 4, w: B.w, h: B.h }, "sheet-back", 3);
    rect(corpus, { x: B.x + 2, y: B.y - 2, w: B.w, h: B.h }, "sheet-back", 3);
    rect(corpus, B, "sheet", 3);
    corpus.append(svgEl("line", { x1: B.x + 7, y1: B.y + 3, x2: B.x + 7, y2: B.y + B.h - 3, class: "texture" }));
    const bookText = text(corpus, B.x + B.w / 2 + 3, B.y + B.h * 0.52, "", T.glyph, "big", { "text-anchor": "middle" });
    bookText.append(svgEl("tspan", {}, String(d.story_lines)), svgEl("tspan", { "font-size": T.label }, "行"));
    text(corpus, B.x + B.w / 2 + 3, B.y + B.h * 0.8, "自作の英文", T.small, "muted", { "text-anchor": "middle" });

    const stack = (r, n, label, sub, cls) => {
      rect(corpus, { x: r.x + 3, y: r.y - 3, w: r.w, h: r.h }, "sheet-back", 3);
      rect(corpus, r, `sheet ${cls}`, 3);
      const tx = r.x + r.w * 0.62;
      for (let i = 0; i < n; i++) {
        const y = r.y + 6 + (i / Math.max(1, n - 1)) * (r.h - 12);
        corpus.append(svgEl("line", { x1: tx, y1: y, x2: r.x + r.w - 6, y2: y, class: "texture" }));
      }
      const lab = text(corpus, r.x + 7, r.y + r.h / 2 + (sub ? -1 : 4), "", sub ? T.glyph * 0.8 : T.label, "bold");
      lab.append(svgEl("tspan", {}, label));
      if (sub) text(corpus, r.x + 7, r.y + r.h / 2 + T.label + 3, sub, T.label, "muted");
      return tx;
    };
    const R = L.train;
    const V = L.val;
    const trainTx = stack(R, 10, `${d.train_lines}行`, "学習", "train-stack");
    const valTx = stack(V, 0, `${d.val_lines}行 検証`, "", "val-stack");
    path(corpus, routes.corpusTrain, "train-flow", "arrow-train");
    path(corpus, routes.corpusVal, "train-flow", "arrow-train");

    // Each validation line is drawn back to the training line that has the same text.
    const twinY = (j) => R.y + 6 + (j / (d.train_lines - 1)) * (R.h - 12);
    const valY = (k) => V.y + 5 + (k / Math.max(1, d.val_lines - 1)) * (V.h - 10);
    const dup = g("duplicates");
    state.twins.forEach((j, k) => {
      if (j < 0) return;
      dup.append(svgEl("line", { x1: trainTx, y1: twinY(j), x2: R.x + R.w - 6, y2: twinY(j), class: "twin" }));
      dup.append(svgEl("line", { x1: valTx, y1: valY(k), x2: V.x + V.w - 6, y2: valY(k), class: "twin" }));
      const x0 = R.x + R.w;
      dup.append(svgEl("path", { d: `M${x0},${valY(k).toFixed(2)} C${L.bulge},${valY(k).toFixed(2)} ${L.bulge},${twinY(j).toFixed(2)} ${x0},${twinY(j).toFixed(2)}`, class: "dup" }));
    });
    text(dup, L.dupLabel.x, L.dupLabel.y, `検証${d.val_lines}行は、${d.val_lines_identical_to_a_train_line}行とも学習側にもある`, T.small, "ochre bold");

    // ---- BPE splitter, fed only from the training stack
    const bpe = g("bpe");
    const P = L.bpe;
    rect(bpe, P, "sheet", 4);
    const bx = P.x + 8;
    const by = P.y + 7;
    const bh = T.glyph * 0.9;
    bpe.append(svgEl("path", { d: `M${bx},${by} V${by + bh} M${bx},${by + 2} h7 M${bx},${by + bh * 0.35} h7 M${bx},${by + bh * 0.7} h7 M${bx + 12},${by} l5,${bh / 2} l-5,${bh / 2}`, class: "blade" }));
    text(bpe, bx + 22, by + bh * 0.85, "BPE", T.glyph * 0.9, "big navy");
    text(bpe, bx, P.y + P.h * 0.68, "学習側の文だけで作成", T.small);
    text(bpe, bx, P.y + P.h * 0.9, `語彙${d.vocab_size}（指定${d.vocab_size_requested}）`, T.small, "muted");
    path(bpe, routes.trainBpe, "train-flow", "arrow-train");
    path(bpe, routes.bpeStrip, "bpe-link");
    const linkX = Number(/M([\d.]+)/.exec(routes.bpeStrip)[1]);
    const linkY = (P.y + P.h + S.y) / 2;
    text(bpe, linkX + 5, linkY + 3, "同じBPE", T.small, "teal");

    // ---- training stream (blank pieces: not the prompt's IDs) into the 800-update loop
    const training = g("training");
    path(training, routes.stream, "train-flow", "arrow-train");
    for (const [cx, cy] of L.blankChips) {
      training.append(svgEl("rect", { x: cx - 5, y: cy - 5, width: 10, height: 10, rx: 2, class: "blank-chip" }));
    }

    // ---- the seed node joins both machines: same initial weights
    const seed = g("seed");
    seed.append(svgEl("circle", { cx: L.seed.x, cy: L.seed.y, r: L.seed.r, class: "seed" }));
    text(seed, L.seed.x, L.seed.y + 3, "seed", T.small * 0.82, "muted", { "text-anchor": "middle" });
    path(seed, routes.seed0, "seed-link");
    path(seed, routes.seed800, "seed-link");
    text(seed, L.seedLabel[0].x, L.seedLabel[0].y, String(t.seed), T.small, "muted", { "text-anchor": L.seedLabel[0].anchor });
    text(seed, L.seedLabel[1].x, L.seedLabel[1].y, "同じ初期値", T.small, "", { "text-anchor": L.seedLabel[1].anchor });

    // ---- machines and their routes (before = 0 updates, after = 800 updates)
    const machine = (parent, M, steps, sub) => {
      rect(parent, M, "machine", 6);
      const r = Math.min(M.h * 0.2, 16);
      parent.append(svgEl("path", { d: gearPath(M.x + r + 7, M.y + M.h * 0.42, r, 9), class: "gear" }));
      parent.append(svgEl("circle", { cx: M.x + r + 7, cy: M.y + M.h * 0.42, r: r * 0.32, class: "gear" }));
      const tx = M.x + r * 2 + 16;
      const big = text(parent, tx, M.y + M.h * 0.5, "", T.glyph, "big navy");
      big.append(svgEl("tspan", {}, String(steps)), svgEl("tspan", { "font-size": T.label }, "回更新"));
      text(parent, tx, M.y + M.h * 0.78, sub, T.small, "muted");
    };
    const before = g("route-before");
    const after = g("route-after");
    path(before, routes.branch0, "infer-flow", "arrow-infer");
    path(after, routes.branch800, "infer-flow", "arrow-infer");
    machine(before, L.m0, t.before.completed_steps, "初期値のまま");
    const M8 = L.m800;
    const pad = L.ring;
    after.append(svgEl("rect", { x: M8.x - pad, y: M8.y - pad, width: M8.w + pad * 2, height: M8.h + pad * 2, rx: 10, class: "loop" }));
    const tri = (x, y, dir) => after.append(svgEl("path", { d: dir > 0 ? `M${x - 4},${y - 4} L${x + 3},${y} L${x - 4},${y + 4} z` : `M${x + 4},${y - 4} L${x - 3},${y} L${x + 4},${y + 4} z`, class: "arrow-train" }));
    tri(M8.x + M8.w * 0.25, M8.y - pad, 1);
    tri(M8.x + M8.w * 0.75, M8.y + M8.h + pad, -1);
    machine(after, M8, t.after.completed_steps, "調整ループ・概念");

    // ---- the selected prompt as one paper strip with its actual prompt token IDs
    const strip = g("prompt");
    const sx = S.x;
    const sy = S.y;
    strip.append(svgEl("path", { d: `M${sx},${sy} H${sx + S.w} L${sx + S.w - 6},${sy + stripH / 2} L${sx + S.w},${sy + stripH} H${sx} L${sx + 6},${sy + stripH / 2} Z`, class: "strip" }));
    text(strip, sx + 12, sy + S.tagY, `書き出し ${sample.id}・${promptIds.length}個の番号`, T.tag, "teal bold");
    text(strip, sx + 12, sy + S.textY, sample.input.text, T.mono, "mono");
    for (const c of chipInfo.chips) {
      const cx = sx + 12 + c.x;
      const cy = sy + S.chipsY + c.row * (c.h + 4);
      strip.append(svgEl("rect", { x: cx, y: cy, width: c.w, height: c.h, rx: 3, class: "chip" }));
      text(strip, cx + c.w / 2, cy + c.h - 4.5, String(c.id), T.chip, "mono navy", { "text-anchor": "middle" });
    }

    // ---- saved continuations as paper strips: literal excerpts and the first new IDs
    const outStrip = (parent, O, side, lines) => {
      const o = sample[side];
      rect(parent, O, "out", 3);
      const tagY = O.y + T.tag + 4;
      text(parent, O.x + 8, tagY, `${PHASE_LABEL[side]}の続き・抜粋`, T.tag, "bold");
      if (L.outRightTag) text(parent, O.x + O.w - 8, tagY, `新しく${o.new_tokens}トークン`, T.tag, "muted", { "text-anchor": "end" });
      lines.forEach((line, k) => text(parent, O.x + 8, tagY + 4 + (k + 1) * (T.mono + 4), line, T.mono, "mono"));
      const ids = o.token_ids.slice(o.prompt_tokens, o.prompt_tokens + L.idCount);
      text(parent, O.x + 8, O.y + O.h - 7, `${ids.join(" ")} …`, T.ids, "mono teal");
    };
    path(before, routes.out0, "infer-flow", "arrow-infer");
    path(after, routes.out800, "infer-flow", "arrow-infer");
    outStrip(before, L.out0, "before", ex0);
    outStrip(after, L.out800, "after", ex800);
    path(before, routes.json0, "infer-flow", "arrow-infer");
    path(after, routes.json800, "infer-flow", "arrow-infer");

    // ---- the record that the save button downloads
    const json = g("json");
    const J = L.json;
    json.append(svgEl("path", { d: `M${J.x},${J.y} H${J.x + J.w - 9} L${J.x + J.w},${J.y + 9} V${J.y + J.h} H${J.x} Z`, class: "json" }));
    json.append(svgEl("path", { d: `M${J.x + J.w - 9},${J.y} V${J.y + 9} H${J.x + J.w}`, class: "json" }));
    const jt = text(json, J.x + J.w / 2, J.y + J.h / 2 + T.small * 0.38, "", T.small, "", { "text-anchor": "middle" });
    jt.append(svgEl("tspan", { class: "mono bold" }, `${sample.id}.json`), svgEl("tspan", { class: "muted" }, "（0回・800回）"));

    // ---- legend: training flow and prompt flow are drawn differently
    const legend = g("legend");
    for (const item of L.legend) {
      const cls = item.kind === "train" ? "train-flow" : item.kind === "infer" ? "infer-flow" : "dup";
      legend.append(svgEl("line", { x1: item.x, y1: item.y - 3, x2: item.x + 16, y2: item.y - 3, class: cls }));
      const label = item.kind === "train" ? "学習の流れ" : item.kind === "infer" ? "書き出しの流れ" : "同じ文（重複）";
      text(legend, item.x + 20, item.y, label, T.small, "muted");
    }

    view.diagram.replaceChildren(root);
    view.diagram.setAttribute("aria-busy", "false");
  }

  // ---------------------------------------------------------------- loss chart

  function drawChart() {
    const rec = state.record;
    if (!rec) return;
    const measured = Math.round(view.chart.clientWidth);
    if (!measured) return; // inside a closed fold; drawn when it opens
    const width = Math.max(280, measured);
    if (Math.abs(width - state.chartWidth) < 4 && view.chart.firstChild) return;
    state.chartWidth = width;

    const t = rec.training;
    const losses = t.losses;
    const n = losses.length;
    const height = width < 480 ? 230 : 290;
    const pad = { left: 46, right: 14, top: 26, bottom: 44 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const max = Math.max(...losses);
    const yStep = Math.ceil(max) <= 4 ? 1 : Math.ceil(max) <= 10 ? 2 : Math.ceil(Math.ceil(max) / 5);
    const yMax = Math.ceil(max / yStep) * yStep || yStep;
    const x = (u) => pad.left + (u / n) * plotW;
    const y = (v) => pad.top + plotH - (v / yMax) * plotH;

    let minIndex = 0;
    losses.forEach((v, i) => { if (v < losses[minIndex]) minIndex = i; });
    const decayAfter = t.lr_decay_at_zero_based_step + 1;
    const summary = `更新1回目の損失は${fmtLoss(losses[0])}、最小は${fmtLoss(losses[minIndex])}（${minIndex + 1}回目）、${n}回目は${fmtLoss(losses[n - 1])}。各点はその回の更新に使った${t.batch_size}本の学習ミニバッチの損失で、検証損失ではありません。点線は学習率を1/10にした位置（${decayAfter}回目の更新のあと）です。最後の200バッチ評価は下の表で別に示します。`;
    view.lossSummary.textContent = summary;

    const root = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-labelledby": "loss-chart-title loss-chart-desc" });
    root.append(svgEl("title", { id: "loss-chart-title" }, "学習ミニバッチの損失の推移（800回）"), svgEl("desc", { id: "loss-chart-desc" }, summary));

    for (let v = 0; v <= yMax + 1e-9; v += yStep) {
      root.append(svgEl("line", { class: "grid", x1: pad.left, x2: width - pad.right, y1: y(v), y2: y(v) }));
      root.append(svgEl("text", { x: pad.left - 8, y: y(v) + 4, "text-anchor": "end" }, String(v)));
    }
    const xStep = n >= 800 ? 200 : Math.max(1, Math.round(n / 4));
    for (let u = 0; u <= n; u += xStep) {
      root.append(svgEl("line", { class: "axis", x1: x(u), x2: x(u), y1: pad.top + plotH, y2: pad.top + plotH + 5 }));
      root.append(svgEl("text", { x: x(u), y: pad.top + plotH + 19, "text-anchor": "middle" }, String(u)));
    }
    root.append(svgEl("line", { class: "axis", x1: pad.left, x2: width - pad.right, y1: pad.top + plotH, y2: pad.top + plotH }));
    root.append(svgEl("line", { class: "axis", x1: pad.left, x2: pad.left, y1: pad.top, y2: pad.top + plotH }));

    if (decayAfter > 0 && decayAfter < n) {
      root.append(svgEl("line", { class: "decay", x1: x(decayAfter), x2: x(decayAfter), y1: pad.top, y2: pad.top + plotH }));
      root.append(svgEl("text", { x: x(decayAfter) - 4, y: pad.top - 8, "text-anchor": "end" }, "学習率1/10"));
    }
    const points = losses.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    root.append(svgEl("polyline", { class: "line", points }));

    root.append(svgEl("text", { class: "label", x: pad.left, y: 14 }, "ミニバッチ損失"));
    root.append(svgEl("text", { class: "label", x: pad.left + plotW / 2, y: height - 6, "text-anchor": "middle" }, "更新回数"));
    view.chart.replaceChildren(root);
  }

  // ---------------------------------------------------------------- actions

  function downloadSample() {
    const sample = state.current;
    if (!sample) return;
    const blob = new Blob([`${JSON.stringify(sample, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = el("a", { href: url, download: `train-llm-from-scratch-${sample.id}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    view.saveStatus.textContent = `${sample.id} の記録（JSON・0回更新と800回更新の両方）の保存を要求しました。保存できたかはブラウザーの表示で確かめてください。`;
  }

  function showFallback(text) {
    view.fallback.value = text;
    view.fallbackLabel.hidden = false;
    view.fallback.hidden = false;
    view.fallback.focus();
    view.fallback.select();
  }

  async function copyRequest() {
    view.copy.disabled = true;
    view.copyStatus.textContent = "依頼文を読み込んでいます…";
    try {
      let text;
      try {
        const response = await fetch(REQUEST_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        text = await response.text();
        if (!text.trim()) throw new Error("empty");
      } catch {
        view.copyStatus.textContent = "依頼文（request.txt）を読み込めませんでした。もう一度押してください。";
        return;
      }
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error("clipboard unavailable");
        await navigator.clipboard.writeText(text);
        view.fallback.hidden = true;
        view.fallbackLabel.hidden = true;
        view.copyStatus.textContent = "依頼文をコピーしました。";
      } catch {
        showFallback(text);
        let copied = false;
        try { copied = document.execCommand("copy"); } catch { copied = false; }
        view.copyStatus.textContent = copied
          ? "依頼文をコピーしました。"
          : "自動でコピーできませんでした。下の欄を長押しして全選択し、コピーしてください。";
      }
    } finally {
      view.copy.disabled = false;
    }
  }

  // ---------------------------------------------------------------- start

  view.retry.addEventListener("click", load);
  view.save.addEventListener("click", downloadSample);
  view.copy.addEventListener("click", copyRequest);
  for (const button of view.cases) {
    button.addEventListener("click", () => choose(button.dataset.id, { updateHash: true }));
  }
  for (const input of view.phaseInputs) {
    input.addEventListener("change", () => { if (input.checked) setPhase(input.value); });
  }
  window.addEventListener("hashchange", () => {
    const id = hashId();
    if (id && state.record) choose(id);
  });
  const redraw = () => { if (state.record) drawDiagram(); };
  if (wideQuery.addEventListener) wideQuery.addEventListener("change", redraw);
  else if (wideQuery.addListener) wideQuery.addListener(redraw);
  $("#fold-loss").addEventListener("toggle", drawChart);
  if ("ResizeObserver" in window) {
    let frame = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(drawChart);
    }).observe(view.chart);
  } else {
    window.addEventListener("resize", drawChart);
  }
  setPhase("after");
  load();
})();
