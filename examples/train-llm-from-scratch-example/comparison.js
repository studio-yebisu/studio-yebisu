/* Train LLM From Scratch 作例. Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * Reads the saved run record (outputs/training-run.json) and the three frozen inputs, checks
 * that they belong together, and shows them. Nothing here runs Python, trains a model or
 * calls an AI. There is no built-in fallback data: if the record is missing or does not
 * match, the page says so and offers a retry.
 */
"use strict";

(() => {
  const RECORD_URL = "outputs/training-run.json";
  const REQUEST_URL = "request.txt";
  const EXPECTED = {
    format: "studio-yebisu-tiny-lm-run-v1",
    repository: "FareedKhan-dev/train-llm-from-scratch",
    commit: "bdd480a518094ca834e05ab32131dc126b522d3d",
    storyLines: 96,
    ids: ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08"],
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

  const $ = (selector) => document.querySelector(selector);
  const view = {
    status: $("#status"),
    retry: $("#retry"),
    results: $("#results"),
    list: $("#sample-list"),
    title: $("#sample-title"),
    prompt: $("#prompt"),
    before: $("#before-output"),
    after: $("#after-output"),
    beforeMeta: $("#before-meta"),
    afterMeta: $("#after-meta"),
    download: $("#download-record"),
    actionStatus: $("#action-status"),
    chart: $("#loss-chart"),
    copy: $("#copy-request"),
    copyStatus: $("#copy-status"),
    fallback: $("#request-fallback"),
    fallbackLabel: $("#request-fallback-label"),
  };
  const state = { record: null, current: null, controller: null, token: 0, chartWidth: 0 };

  class RecordError extends Error {}
  const fail = (message) => { throw new RecordError(message); };

  // ---------------------------------------------------------------- small helpers

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    for (const child of children) node.append(child);
    return node;
  }

  function svg(tag, attrs = {}, text) {
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
        fail("学習の記録（outputs/training-run.json）はまだありません。制作側で run.py を実行したあと、もう一度読み込んでください。");
      }
      fail(`${url} を読み込めませんでした（HTTP ${response.status}）。`);
    }
    return response;
  }

  // ---------------------------------------------------------------- loading

  function setState(name, message) {
    view.status.dataset.state = name;
    view.status.textContent = message;
    view.results.hidden = name !== "ready";
    view.retry.hidden = name !== "error";
    view.download.disabled = name !== "ready";
  }

  function clearView() {
    state.record = null;
    state.current = null;
    state.chartWidth = 0;
    for (const node of [view.list, view.before, view.after, view.chart, $("#loss-table"), $("#facts-list"),
      $("#checkpoint-table"), $("#command-list"), $("#check-list")]) {
      node.replaceChildren();
    }
    for (const node of [view.title, view.prompt, view.beforeMeta, view.afterMeta, view.actionStatus,
      $("#params"), $("#before-loss"), $("#after-loss"), $("#steps"), $("#uniform-note"), $("#loss-summary")]) {
      node.textContent = "";
    }
  }

  async function load() {
    if (state.controller) state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    const token = ++state.token;
    clearView();
    setState("loading", "保存済みの実行記録を読み込んでいます…");
    try {
      if (!window.crypto || !crypto.subtle) {
        fail("入力のSHA-256を確かめるには、安全な接続（HTTPS または localhost）で開く必要があります。");
      }
      const paths = Object.keys(INPUTS);
      const [recordResponse, ...inputResponses] = await Promise.all([
        fetchOk(RECORD_URL, controller.signal),
        ...paths.map((path) => fetchOk(path, controller.signal)),
      ]);
      let record;
      try {
        record = await recordResponse.json();
      } catch (error) {
        if (error.name === "AbortError") throw error;
        fail("実行記録をJSONとして読めませんでした。");
      }
      const buffers = await Promise.all(inputResponses.map((r) => r.arrayBuffer()));
      const hashes = await Promise.all(buffers.map(sha256Hex));
      const decoder = new TextDecoder("utf-8", { fatal: true });
      const texts = {};
      paths.forEach((path, i) => {
        if (hashes[i] !== INPUTS[path]) fail(`${path} のSHA-256が固定値と一致しません。`);
        texts[path] = decoder.decode(buffers[i]);
      });
      const promptsDoc = JSON.parse(texts["input/prompts.json"]);
      const config = JSON.parse(texts["input/run-config.json"]);
      validate(record, promptsDoc, config, texts["input/stories.txt"]);
      if (token !== state.token) return;
      render(record);
      setState("ready", `実学習の記録を確認しました。`);
      drawChart();
      const fromHash = hashId();
      choose(fromHash || EXPECTED.ids[0]);
      if (fromHash) $("#sample-viewer").scrollIntoView({ block: "start" });
    } catch (error) {
      if (token !== state.token || error.name === "AbortError") return;
      clearView();
      const message = error instanceof RecordError
        ? error.message
        : error instanceof SyntaxError
          ? "入力ファイルをJSONとして読めませんでした。"
          : "記録を読み込めませんでした。接続を確かめて、もう一度読み込んでください。";
      setState("error", message);
    } finally {
      if (token === state.token) state.controller = null;
    }
  }

  // ---------------------------------------------------------------- validation

  function validate(rec, promptsDoc, config, stories) {
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
  }

  // ---------------------------------------------------------------- rendering

  function render(rec) {
    state.record = rec;
    const t = rec.training;
    const m = rec.model;
    const d = rec.dataset;

    view.list.replaceChildren(...rec.samples.map((s) => {
      const button = el("button", { type: "button", "aria-pressed": "false", "data-id": s.id },
        el("span", { class: "sample-id" }, s.id), el("span", { class: "sample-label" }, s.label));
      button.addEventListener("click", () => choose(s.id, { updateHash: true }));
      return button;
    }));

    $("#params").textContent = fmtInt(m.parameters);
    $("#before-loss").textContent = fmtLoss(t.before.dev_loss);
    $("#after-loss").textContent = fmtLoss(t.after.dev_loss);
    $("#steps").textContent = `${t.optimizer_steps}回`;
    $("#uniform-note").textContent = `参考：出力の${fmtInt(m.vocab_rows)}通りに均等に賭けた場合の損失は ln(${m.vocab_rows}) ≈ ${Math.log(m.vocab_rows).toFixed(3)} です。`;

    const seconds = (id) => {
      const c = rec.commands.find((x) => x.id === id);
      return c ? `${c.seconds.toFixed(1)}秒` : "記録なし";
    };
    const env = isObj(rec.environment) ? rec.environment : {};
    const pkgs = isObj(env.packages) ? env.packages : {};
    const leak = d.val_lines_identical_to_a_train_line;
    const facts = [
      ["データ", `独自の英文${d.story_lines}行。学習側${d.train_lines}行・検証側${d.val_lines}行（原典の split_text で末尾を分割）。検証側${d.val_lines}行のうち${leak}行は、学習側にも同じ行があります。`],
      ["トークン", `学習側${fmtInt(d.train_tokens)}・検証側${fmtInt(d.val_tokens)}（区切り記号を含む）。${m.context_length}トークンの窓は学習側${d.train_windows}個・検証側${d.val_windows}個。`],
      ["BPE語彙", `${d.vocab_size}（指定${d.vocab_size_requested}・統合${d.merges}回・学習側だけで学習）。${d.bpe_merges_identical_if_trained_on_whole_file ? "96行全体で学んでも同じ語彙になります。" : "96行全体で学ぶと語彙が変わります。"}`],
      ["モデル", `${m.arch}・${m.n_embed}次元・${m.n_head}ヘッド・${m.n_blocks}ブロック・文脈${m.context_length}トークン・出力${m.vocab_rows}行（うち語彙の外の余り${m.padding_rows}行）。事前学習済みの重みは使っていません。`],
      ["学習", `AdamW・バッチ${t.batch_size}・学習率${t.learning_rate}（${t.lr_decay_at_zero_based_step + 1}回目の更新のあと${t.learning_rate_decayed}）・seed ${t.seed}・CPU ${t.threads}スレッド。`],
      ["重みのSHA-256", `学習前 ${t.before.state_sha256.slice(0, 12)}…／学習後 ${t.after.state_sha256.slice(0, 12)}…（変わったテンソル ${m.changed_tensors}／${m.tensors.length}）`],
      ["所要時間", `学習${t.optimizer_steps}回 ${seconds(`train-${t.optimizer_steps}`)}・学習前の保存 ${seconds("train-baseline-0")}（この1台で測った経過時間）`],
      ["実行環境", `Python ${env.python || "?"}・PyTorch ${pkgs.torch || "?"}・${env.os || "?"} ${env.machine || ""}`.trim()],
    ];
    $("#facts-list").replaceChildren(...facts.map(([k, v]) => el("div", {}, el("dt", {}, k), el("dd", {}, v))));

    const rows = [];
    for (const c of t.checkpoints) {
      if (c.completed_steps === 0) {
        rows.push([fmtInt(0), `最後の評価（${t.final_estimate_batches_per_split}バッチ）`,
          fmtLoss(c.final_estimate.train_loss), fmtLoss(c.final_estimate.dev_loss), "—"]);
      } else {
        const e = c.periodic_eval;
        rows.push([fmtInt(c.completed_steps), `定期評価（${e.after_updates}回目の更新後・${e.batches_per_split}バッチ）`,
          fmtLoss(e.train_loss), fmtLoss(e.dev_loss), fmtLoss(c.minibatch_loss)]);
      }
    }
    rows.push([fmtInt(t.optimizer_steps), `最後の評価（${t.final_estimate_batches_per_split}バッチ）`,
      fmtLoss(t.after.train_loss), fmtLoss(t.after.dev_loss), "—"]);
    $("#checkpoint-table").replaceChildren(...rows.map(([steps, ...cells]) =>
      el("tr", {}, el("th", { scope: "row" }, steps), ...cells.map((v) => el("td", {}, v)))));

    const marks = [1];
    for (let u = 50; u <= t.losses.length; u += 50) marks.push(u);
    $("#loss-table").replaceChildren(...marks.map((u) =>
      el("tr", {}, el("th", { scope: "row" }, `${u}回目`), el("td", {}, fmtLoss(t.losses[u - 1])))));

    $("#command-list").replaceChildren(...rec.commands.map((c) => el("li", {},
      `${c.id}：終了コード ${c.exit_code}・${c.seconds.toFixed(1)}秒`,
      el("code", {}, c.args.map(shellWord).join(" ")))));

    $("#check-list").replaceChildren(...Object.keys(rec.checks).map((name) =>
      el("li", {}, CHECK_LABELS[name] || name)));
  }

  function shellWord(arg) {
    const s = String(arg);
    return /^[\w@%+=:,./<>-]+$/.test(s) ? s : JSON.stringify(s);
  }

  function hashId() {
    const id = decodeURIComponent(location.hash.slice(1));
    return EXPECTED.ids.includes(id) ? id : null;
  }

  function metaText(o) {
    const parts = [`入力${o.prompt_tokens}トークン＋新しく${o.new_tokens}トークン`];
    if (o.ids_skipped_in_text > 0) parts.push(`語彙の外のID（埋め込みの余り行）${o.ids_skipped_in_text}個は文字に出ません`);
    if (o.endoftext_tokens > 0) parts.push(`区切り記号 <|endoftext|> を${o.endoftext_tokens}個含みます`);
    if (o.replacement_chars > 0) parts.push(`置換文字（�）${o.replacement_chars}個`);
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

  function choose(id, options = {}) {
    const rec = state.record;
    if (!rec) return;
    const sample = rec.samples.find((s) => s.id === id) || rec.samples[0];
    state.current = sample;
    for (const button of view.list.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.id === sample.id));
    }
    view.title.textContent = `${sample.id}　${sample.label}`;
    view.prompt.textContent = sample.input.text;
    renderOutput(view.before, sample.before.text, sample.input.text);
    renderOutput(view.after, sample.after.text, sample.input.text);
    view.beforeMeta.textContent = metaText(sample.before);
    view.afterMeta.textContent = metaText(sample.after);
    view.actionStatus.textContent = "";
    if (options.updateHash && location.hash !== `#${sample.id}`) history.replaceState(null, "", `#${sample.id}`);
  }

  // ---------------------------------------------------------------- loss chart

  function drawChart() {
    const rec = state.record;
    if (!rec || view.results.hidden) return;
    const width = Math.max(280, Math.round(view.chart.clientWidth || 600));
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
    const summary = `更新1回目の損失は${fmtLoss(losses[0])}、最小は${fmtLoss(losses[minIndex])}（${minIndex + 1}回目）、${n}回目は${fmtLoss(losses[n - 1])}。各点はその回の更新に使った${t.batch_size}本の学習ミニバッチの損失で、検証損失ではありません。点線は学習率を1/10にした位置（${decayAfter}回目の更新のあと）です。`;
    $("#loss-summary").textContent = summary;

    const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-labelledby": "loss-chart-title loss-chart-desc" });
    root.append(svg("title", { id: "loss-chart-title" }, "学習ミニバッチの損失の推移"), svg("desc", { id: "loss-chart-desc" }, summary));

    for (let v = 0; v <= yMax + 1e-9; v += yStep) {
      root.append(svg("line", { class: "grid", x1: pad.left, x2: width - pad.right, y1: y(v), y2: y(v) }));
      root.append(svg("text", { x: pad.left - 8, y: y(v) + 4, "text-anchor": "end" }, String(v)));
    }
    const xStep = n >= 800 ? 200 : Math.max(1, Math.round(n / 4));
    for (let u = 0; u <= n; u += xStep) {
      root.append(svg("line", { class: "axis", x1: x(u), x2: x(u), y1: pad.top + plotH, y2: pad.top + plotH + 5 }));
      root.append(svg("text", { x: x(u), y: pad.top + plotH + 19, "text-anchor": "middle" }, String(u)));
    }
    root.append(svg("line", { class: "axis", x1: pad.left, x2: width - pad.right, y1: pad.top + plotH, y2: pad.top + plotH }));
    root.append(svg("line", { class: "axis", x1: pad.left, x2: pad.left, y1: pad.top, y2: pad.top + plotH }));

    if (decayAfter > 0 && decayAfter < n) {
      root.append(svg("line", { class: "decay", x1: x(decayAfter), x2: x(decayAfter), y1: pad.top, y2: pad.top + plotH }));
      root.append(svg("text", { x: x(decayAfter) - 4, y: pad.top - 8, "text-anchor": "end" }, "学習率1/10"));
    }
    const points = losses.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    root.append(svg("polyline", { class: "line", points }));

    root.append(svg("text", { class: "label", x: pad.left, y: 14 }, "損失"));
    root.append(svg("text", { class: "label", x: pad.left + plotW / 2, y: height - 6, "text-anchor": "middle" }, "更新回数"));
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
    view.actionStatus.textContent = `${sample.id} の記録（JSON）の保存を要求しました。保存できたかはブラウザーの表示で確かめてください。`;
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
  view.download.addEventListener("click", downloadSample);
  view.copy.addEventListener("click", copyRequest);
  window.addEventListener("hashchange", () => {
    const id = hashId();
    if (id && state.record) {
      choose(id);
      $("#sample-viewer").scrollIntoView({ block: "start" });
    }
  });
  if ("ResizeObserver" in window) {
    let frame = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(drawChart);
    }).observe(view.chart);
  } else {
    window.addEventListener("resize", drawChart);
  }
  load();
})();
