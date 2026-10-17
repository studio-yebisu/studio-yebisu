// 保存済みの実行結果（outputs/runs.json）を読んで表示するだけのビューア。
// Codebase Memory MCP・Python・モデルはここでは動かない。データ由来の文字列は textContent でだけ差し込む。

const STEP_IDS = ["find", "trace", "update"];
const DEFAULT_STEP = "find";
const ENTRY = "submit_order";
const RAW_LINKS = [
  ["outputs/runs.json", "outputs/runs.json"],
  ["outputs/result.md", "outputs/result.md"],
  ["samples.json", "samples.json"],
];
const PHASES = [
  ["calls_before", "初回の索引", "変更前のファイルを索引した直後"],
  ["calls_stale", "変更後・再索引の前", "ファイルを差し替えた直後。索引はまだ古いまま"],
  ["calls_after", "手で再索引した後", "index_repository をやり直した後"],
];

const tablist = document.querySelector('[role="tablist"]');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];
const loadStatus = document.getElementById("load-status");
const loadActions = document.getElementById("load-actions");
const retryButton = document.getElementById("retry");
let ready = false;

const pretty = (value) => JSON.stringify(value, null, 2);
const sameName = (value, short) =>
  typeof value === "string" && (value === short || value.endsWith(`.${short}`) || value.endsWith(`::${short}`));
const hasEdge = (rows, caller, callee) => rows.some((row) => sameName(row.caller, caller) && sameName(row.callee, callee));

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function need(value, what) {
  if (value === undefined || value === null) throw new Error(`outputs/runs.json に ${what} がありません。`);
  return value;
}

function hashStep() {
  let id = "";
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return null;
  }
  return STEP_IDS.includes(id) ? id : null;
}

/* ---------- タブ ---------- */

function selectStep(id, { focusTab = false, focusPanel = false, updateHash = false } = {}) {
  for (const tab of tabs) {
    const on = tab.dataset.step === id;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focusTab) tab.focus();
  }
  for (const stepId of STEP_IDS) document.getElementById(stepId).hidden = stepId !== id;
  if (updateHash && location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
  if (focusPanel) {
    const panel = document.getElementById(id);
    const target = panel.querySelector("h3") || panel;
    if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    panel.scrollIntoView({ block: "start" });
  }
}

tablist.addEventListener("click", (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (tab) selectStep(tab.dataset.step, { updateHash: true });
});

tablist.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const index = tabs.indexOf(document.activeElement);
  if (index < 0) return;
  const last = tabs.length - 1;
  const moves = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowDown: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    ArrowUp: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  };
  if (!(event.key in moves)) return;
  event.preventDefault();
  selectStep(tabs[moves[event.key]].dataset.step, { focusTab: true, updateHash: true });
});

window.addEventListener("hashchange", () => {
  if (!ready) return; // 読み込みが終わってから、そのときの hash を処理する
  const id = hashStep();
  selectStep(id || DEFAULT_STEP, { focusPanel: Boolean(id) });
});

/* ---------- 表示部品 ---------- */

function code(text) {
  return el("code", { text: String(text) });
}

function definitionList(rows) {
  const dl = el("dl", { className: "facts-list" });
  for (const [term, value] of rows) dl.append(el("div", {}, el("dt", { text: term }), el("dd", {}, value)));
  return dl;
}

function rawBlock(summary, value) {
  return el(
    "details",
    { className: "raw" },
    el("summary", { text: summary }),
    el("pre", { tabindex: "0" }, el("code", { text: typeof value === "string" ? value : pretty(value) })),
  );
}

function evidence(kind, text) {
  return el("p", { className: `evidence evidence--${kind}` }, el("span", { className: "evidence-kind", text: kind === "index" ? "索引" : "実行" }), text);
}

function sourceList(text, marks = new Map(), label = "ソース") {
  const list = el("ol", { className: "src", "aria-label": label });
  String(text)
    .replace(/\n$/, "")
    .split("\n")
    .forEach((line, i) => {
      const number = i + 1;
      const mark = marks.get(number);
      list.append(
        el(
          "li",
          { className: mark ? `is-${mark.tone}` : null, "data-line": String(number) },
          el("code", { text: line || " " }),
          mark ? el("span", { className: "src-tag", text: mark.label }) : null,
        ),
      );
    });
  return el("div", { className: "src-wrap" }, list);
}

function snippetBlock(text, label) {
  return el("pre", { className: "snippet", tabindex: "0", "aria-label": label }, el("code", { text: String(text) }));
}

function edgesTable(rows, highlight) {
  const wrap = el("div", { className: "table-wrap", tabindex: "0", role: "region", "aria-label": "caller と callee の組" });
  wrap.append(
    el(
      "table",
      {},
      el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "caller（呼ぶ側）" }), el("th", { scope: "col", text: "callee（呼ばれる側）" }))),
      el(
        "tbody",
        {},
        rows.map((row) =>
          el("tr", { className: highlight && highlight(row) ? "is-hit" : null }, el("td", {}, code(row.caller)), el("td", {}, code(row.callee))),
        ),
      ),
    ),
  );
  return wrap;
}

function callRecords(step) {
  const requests = need(step.request, `${step.id}.request`);
  const responses = need(step.response, `${step.id}.response`);
  return el(
    "details",
    { className: "tech" },
    el("summary", { text: `ツールへの要求と実際の応答（${requests.length} 回分のJSON）` }),
    el("p", { className: "note", text: "workflow.py が CLI に渡した引数と、実行ファイルが返した JSON です。パスの fixture/ は実行用コピー、<private-cache> は専用キャッシュの置き換えです。" }),
    requests.map((request, i) =>
      el(
        "div",
        { className: "call" },
        el("h5", {}, code(request.tool), `（${request.phase}）`),
        rawBlock("要求の引数", request.args),
        rawBlock("応答", responses[i] ? responses[i].response : "（応答の記録なし）"),
      ),
    ),
  );
}

function receiptBox(title, run, intro) {
  const files = need(run && run.files, "fixture_execution の files");
  return el(
    "div",
    { className: "receipt" },
    evidence("run", title),
    el("p", { className: "note", text: intro }),
    el("p", { className: "note" }, "実行したコマンド：", code(need(run.command, "command").join(" ")), `（終了コード ${run.exit_code}）`),
    Object.entries(files).map(([name, data]) =>
      el(
        "div",
        { className: "receipt-file" },
        el("p", { className: "receipt-name" }, code(name), data && data.total_jpy !== undefined ? el("span", { className: "receipt-total", text: `合計 ${Number(data.total_jpy).toLocaleString("ja-JP")}円` }) : null),
        el("pre", { tabindex: "0" }, el("code", { text: pretty(data) })),
      ),
    ),
  );
}

/* ---------- 1. 探す ---------- */

function renderFind(panel, runs, step) {
  const f = need(step.facts, "find.facts");
  const search = need(need(step.request, "find.request")[0], "find.request[0]");
  const source = need(runs.source_snapshots?.base?.[f.file], `source_snapshots.base["${f.file}"]`);
  const marks = new Map([[f.source_def_line, { tone: "def", label: "定義" }]]);
  for (const call of need(f.call_expressions, "find.facts.call_expressions")) marks.set(call.line, { tone: "call", label: `${call.callee} を呼ぶ` });
  const matches = f.line === f.source_def_line;

  panel.replaceChildren(
    el("h3", { tabindex: "-1", text: "submit_order を名前で探す" }),
    el("p", { className: "lede" }, code(search.tool), " に名前の正規表現とラベルを渡し、返った定義の場所を実ソースと照合しました。"),
    definitionList([
      ["渡した引数", el("span", {}, "name_pattern ", code(search.args.name_pattern), " · label ", code(search.args.label))],
    ]),
    evidence("index", "search_graph が返した定義"),
    definitionList([
      ["qualified_name", el("code", { className: "break", text: f.qualified_name })],
      ["ファイル", code(f.file)],
      ["行（索引の値）", `${f.line} 行目`],
      ["実ソースの def 行", el("span", { className: matches ? "ok" : "is-error", text: `${f.source_def_line} 行目（${matches ? "一致" : "不一致"}）` })],
    ]),
    el(
      "div",
      { className: "compare" },
      el(
        "div",
        { className: "compare-col" },
        el("h4", {}, code("get_code_snippet"), " が返した本文"),
        snippetBlock(f.snippet_text, "get_code_snippet が返した本文"),
        el("p", { className: "note", text: `空行を除く ${f.snippet_lines} 行のうち ${f.snippet_lines_in_source} 行が、実ソースの行と同じ文字列です。` }),
      ),
      el(
        "div",
        { className: "compare-col" },
        el("h4", {}, "実ソース ", code(f.file), "（実行用コピーの写し）"),
        sourceList(source, marks, `${f.file} のソース`),
      ),
    ),
    el(
      "ul",
      { className: "call-list" },
      f.call_expressions.map((call) => el("li", {}, code(call.callee), `　${call.line} 行目 `, code(call.text))),
    ),
    callRecords(step),
  );
  return `${f.line}行目`;
}

/* ---------- 2. たどる ---------- */

function renderTrace(panel, runs, step) {
  const f = need(step.facts, "trace.facts");
  const table = need(runs.calls_before, "calls_before");
  const rows = need(table.rows, "calls_before.rows");
  const outgoing = rows.filter((row) => sameName(row.caller, ENTRY));
  const sources = Object.fromEntries(need(f.required_edges, "trace.facts.required_edges").map((edge) => [edge.callee, edge.source]));
  const trace = need(step.request, "trace.request").find((r) => r.tool === "trace_path");

  panel.replaceChildren(
    el("h3", { tabindex: "-1", text: "submit_order から呼び出しをたどる" }),
    el("p", { className: "lede" }, code("query_graph"), " に次の問い合わせを渡し、返った CALLS の組から submit_order が呼ぶ関数を取り出しました。"),
    el("pre", { className: "snippet", tabindex: "0" }, el("code", { text: table.query })),
    evidence("index", `query_graph が返した組 ${rows.length} 件のうち、submit_order から出るもの`),
    el(
      "ul",
      { className: "edge-list" },
      outgoing.map((row) => {
        const src = sources[row.callee] || Object.entries(sources).find(([name]) => sameName(row.callee, name))?.[1];
        return el(
          "li",
          { className: "edge" },
          el("p", { className: "edge-pair" }, code(row.caller), el("span", { className: "arrow", "aria-label": "が呼ぶ", text: "→" }), code(row.callee)),
          src ? el("p", { className: "edge-src" }, `${src.file} ${src.line} 行目 `, code(src.text)) : el("p", { className: "edge-src", text: "（実ソースの呼び出し式は記録なし）" }),
        );
      }),
    ),
    f.may_be_truncated
      ? el("p", { className: "note is-error", text: `返った組が上限の ${table.limit} 件に達しています。ほかの組が省かれている可能性があります。` })
      : el("p", { className: "note", text: `問い合わせの上限は ${table.limit} 件で、返った組はそれより少ない ${rows.length} 件です。` }),
    el(
      "p",
      {},
      code("trace_path"),
      trace ? `（direction ${trace.args.direction}・depth ${trace.args.depth}）` : "",
      " の応答に出た関数名：",
      (f.trace_reached || []).map((name, i) => [i ? "・" : "", code(name)]),
    ),
    el("p", { className: "note note--strong", text: "これは索引に記録された静的な呼び出し関係です。実行時に記録したトレースではありません。動的な呼び出しは出ないことがあり、辺がないことは呼ばれないことの証明ではありません。" }),
    el("details", { className: "raw" }, el("summary", { text: `query_graph が返した全ての組（${rows.length} 件）` }), edgesTable(rows, (row) => sameName(row.caller, ENTRY))),
    receiptBox(
      "別の証拠：架空の注文を実際に実行した",
      need(runs.fixture_execution?.base, "fixture_execution.base"),
      "変更前の実行用コピーで app.py を動かし、指定したディレクトリに書かれた領収JSONです。この実行は索引を使っていません。上の辺とは別に、2席×1,200円の注文が保存まで進むことを確かめています。",
    ),
    callRecords(step),
  );
  return `${outgoing.length}関数`;
}

/* ---------- 3. 変える ---------- */

function renderUpdate(panel, runs, step) {
  const f = need(step.facts, "update.facts");
  const edge = need(f.new_edge, "update.facts.new_edge");
  const baseText = need(runs.source_snapshots?.base?.[f.replaced_in_copy], `source_snapshots.base["${f.replaced_in_copy}"]`);
  const changedText = need(runs.source_snapshots?.changed?.[f.replaced_in_copy], `source_snapshots.changed["${f.replaced_in_copy}"]`);
  const marks = new Map();
  for (const line of f.added_lines || []) marks.set(line.line, { tone: "add", label: "追加" });
  if (f.call_expression) marks.set(f.call_expression.line, { tone: "call", label: "新しい呼び出し" });

  const phases = PHASES.map(([key, label, description]) => {
    const table = need(runs[key], key);
    const present = hasEdge(need(table.rows, `${key}.rows`), edge.caller, edge.callee);
    return { key, label, description, table, present };
  });
  const after = phases[2].present;

  panel.replaceChildren(
    el("h3", { tabindex: "-1", text: "storage.py を変えて、手で索引し直す" }),
    el("p", { className: "lede" }, "実行用コピーの ", code("storage.py"), " だけを ", code(f.revision_file), " に差し替えました。元の fixture/storage.py は変えていません。"),
    el("details", { className: "raw" }, el("summary", { text: "変更したソースを見る" }),
      el("h4", {}, "差し替え後の ", code("storage.py"), "（実行用コピーの写し）"),
      sourceList(changedText, marks, "差し替え後の storage.py"),
      el("details", { className: "raw" }, el("summary", { text: "変更前の storage.py" }), sourceList(baseText, new Map(), "変更前の storage.py"))),
    evidence("index", `query_graph の組に ${edge.caller} → ${edge.callee} があるか`),
    el(
      "ol",
      { className: "phases" },
      phases.map((phase) =>
        el(
          "li",
          { className: `phase${phase.present ? " is-yes" : ""}` },
          el("p", { className: "phase-label", text: phase.label }),
          el("p", { className: "phase-desc", text: phase.description }),
          el("p", { className: "phase-result" }, phase.present ? "あり" : "なし", el("span", { className: "phase-count", text: `組 ${phase.table.row_count} 件` })),
        ),
      ),
    ),
    el("p", { className: "note note--strong", text: "CLI で作った索引は監視されません。ファイルを変えただけでは索引は古いままで、index_repository を手でやり直して初めて新しい呼び出しが現れます。" }),
    f.audit_receipt
      ? definitionList([
          ["audit_receipt の定義", el("code", { className: "break", text: f.audit_receipt.qualified_name })],
          ["場所（索引の値）", el("span", {}, code(f.audit_receipt.file), ` ${f.audit_receipt.line} 行目`)],
          ["差し替え後の実ソースの def 行", `${f.audit_receipt.source_def_line} 行目`],
          ["trace_path の応答に出た関数名", el("span", {}, (f.trace_reached_after || []).map((name, i) => [i ? "・" : "", code(name)]))],
        ])
      : null,
    f.save_receipt_snippet_text
      ? el("div", {}, el("h4", {}, "再索引後の ", code("get_code_snippet"), "（save_receipt）"), snippetBlock(f.save_receipt_snippet_text, "再索引後の save_receipt の本文"))
      : null,
    f.watch_before_reindex !== undefined && f.watch_before_reindex !== null ? rawBlock("index_status の watch（再索引の前）", f.watch_before_reindex) : null,
    f.watch_after_reindex !== undefined && f.watch_after_reindex !== null ? rawBlock("index_status の watch（再索引の後）", f.watch_after_reindex) : null,
    el(
      "details",
      { className: "raw" },
      el("summary", { text: "再索引の前と後の、全ての組" }),
      el("h5", { text: `再索引の前（${phases[1].table.row_count} 件）` }),
      edgesTable(phases[1].table.rows, (row) => sameName(row.caller, edge.caller)),
      el("h5", { text: `再索引の後（${phases[2].table.row_count} 件）` }),
      edgesTable(phases[2].table.rows, (row) => sameName(row.caller, edge.caller) && sameName(row.callee, edge.callee)),
    ),
    receiptBox(
      "別の証拠：変更後の注文を実際に実行した",
      need(runs.fixture_execution?.revised, "fixture_execution.revised"),
      "差し替え後の実行用コピーで app.py を動かし、指定したディレクトリに書かれた領収と監査のJSONです。この実行は索引を使っていません。",
    ),
    callRecords(step),
  );
  return after ? "追加あり" : "追加なし";
}

/* ---------- 読み込み ---------- */

const RENDERERS = { find: renderFind, trace: renderTrace, update: renderUpdate };

function setFact(name, value) {
  const node = document.querySelector(`[data-fact="${name}"]`);
  if (node) node.replaceChildren(value);
}

function fillHero(runs) {
  const steps = Object.fromEntries(runs.steps.map((step) => [step.id, step]));
  const find = steps.find?.facts;
  setFact("where", find ? el("span", {}, code(find.file), ` の ${find.line} 行目`) : "記録なし");
  const outgoing = (runs.calls_before?.rows || []).filter((row) => sameName(row.caller, ENTRY));
  setFact("callees", outgoing.length ? el("span", {}, outgoing.map((row, i) => [i ? "・" : "", code(row.callee)])) : "記録なし");
  const edge = steps.update?.facts?.new_edge;
  const after = edge && runs.calls_after?.rows ? hasEdge(runs.calls_after.rows, edge.caller, edge.callee) : null;
  setFact("edge", after === null ? "記録なし" : el("span", {}, code(`${edge.caller} → ${edge.callee}`), after ? " が現れた" : " は見つからない"));
  setFact("version", runs.tool?.version ? code(runs.tool.version) : "記録なし");
}

async function getJSON(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} を読み込めませんでした（HTTP ${response.status}）。`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${path} をJSONとして読めませんでした。`);
  }
}

function showError(message) {
  loadStatus.className = "load-status is-error";
  loadStatus.replaceChildren(
    message,
    " 生のファイル：",
    ...RAW_LINKS.flatMap(([href, label], i) => [i ? " · " : "", el("a", { href, text: label })]),
  );
  loadActions.hidden = false;
  for (const tab of tabs) tab.querySelector(".tab-result").textContent = "表示できません";
  for (const id of STEP_IDS) {
    document.getElementById(id).replaceChildren(el("p", { className: "panel-wait", text: "実行結果を読み込めなかったため、表示していません。" }));
  }
  for (const node of document.querySelectorAll("[data-fact]")) node.textContent = "表示できません";
}

async function load() {
  if (location.protocol === "file:") {
    throw new Error("file:// で開いているため、JSONを読み込めません。README の手順で python -m http.server 8000 を起動し、http://127.0.0.1:8000/ を開いてください。");
  }
  const runs = await getJSON("outputs/runs.json");
  if (!runs || typeof runs !== "object" || !Array.isArray(runs.steps) || !runs.tool) {
    throw new Error("outputs/runs.json に tool と steps がありません。");
  }

  let shown = 0;
  for (const id of STEP_IDS) {
    const panel = document.getElementById(id);
    const tab = document.getElementById(`tab-${id}`);
    const step = runs.steps.find((item) => item.id === id);
    if (!step) {
      panel.replaceChildren(el("p", { className: "panel-wait is-error", text: "outputs/runs.json にこの操作の記録がありません。" }));
      tab.querySelector(".tab-result").textContent = "記録なし";
      continue;
    }
    try {
      tab.querySelector(".tab-result").textContent = RENDERERS[id](panel, runs, step);
      shown += 1;
    } catch (error) {
      panel.replaceChildren(el("p", { className: "panel-wait is-error", text: `この操作の表示に失敗しました：${error.message}` }));
      tab.querySelector(".tab-result").textContent = "表示できません";
    }
  }
  fillHero(runs);
  loadStatus.className = "load-status";
  loadStatus.textContent = `保存済みの実行結果 ${shown} / ${STEP_IDS.length} 件を表示中。ライブ検索ではありません。`;
}

function start() {
  loadActions.hidden = true;
  loadStatus.className = "load-status";
  loadStatus.textContent = "保存済みの実行結果（outputs/runs.json）を読み込んでいます。";
  load()
    .then(() => {
      ready = true;
      const id = hashStep();
      if (id) selectStep(id, { focusPanel: true });
    })
    .catch((error) => showError(error.message));
}

retryButton.addEventListener("click", start);

async function loadRequestText() {
  const area = document.getElementById("request-text");
  try {
    const response = await fetch("request.txt", { cache: "no-store" });
    if (response.ok) area.value = await response.text();
  } catch {
    // 読めないときは HTML に書いた同じ文面をそのまま使う
  }
}

selectStep(DEFAULT_STEP);
loadRequestText();
start();

/* ---------- 依頼文のコピー ---------- */

const copyButton = document.getElementById("copy-request");
const copyStatus = document.getElementById("copy-status");

function selectRequest(area) {
  area.focus();
  area.setSelectionRange(0, area.value.length);
}

copyButton.addEventListener("click", async () => {
  const area = document.getElementById("request-text");
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(area.value);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) {
    selectRequest(area);
    try {
      copied = document.execCommand("copy") === true;
    } catch {
      copied = false;
    }
  }
  if (copied) {
    copyStatus.className = "copy-status";
    copyStatus.textContent = "コピーしました。";
  } else {
    selectRequest(area);
    copyStatus.className = "copy-status is-error";
    copyStatus.textContent = "自動でコピーできませんでした。依頼文を選択したので、長押しして「コピー」を選ぶか、Ctrl+C（Mac は ⌘C）でコピーしてください。";
  }
});
