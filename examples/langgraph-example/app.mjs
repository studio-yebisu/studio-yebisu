// 保存済みの実行結果（outputs/runs.json）と入力（inputs/requests.json）を読んで表示するだけのビューア。
// Python・LangGraph・モデルはここでは動かない。入力由来の文字列は textContent でだけ差し込む。

const CASE_IDS = ["approved", "missing", "rejected"];
const RAW_LINKS = [
  ["outputs/runs.json", "outputs/runs.json"],
  ["inputs/requests.json", "inputs/requests.json"],
  ["outputs/result.md", "outputs/result.md"],
];
const NODE_LABELS = {
  validate: "入力確認",
  needs_input: "追加入力を求める",
  estimate: "見積",
  review: "確認待ち",
  finalize: "要約",
};
const FIELD_LABELS = {
  applicant: "申請者",
  event: "催し",
  start_date: "貸出日",
  end_date: "返却日",
  items: "品目",
};
const STATUS = {
  approved: { label: "承認", tone: "approved" },
  rejected: { label: "差し戻し", tone: "rejected" },
  needs_input: { label: "追加入力が必要", tone: "needs-input" },
};

const tablist = document.querySelector('[role="tablist"]');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];
const loadStatus = document.getElementById("load-status");

const yen = (value) => `${Number(value).toLocaleString("ja-JP")}円`;
const pretty = (value) => JSON.stringify(value, null, 2);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function sameJSON(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => sameJSON(a[key], b[key]));
}

function hashCase() {
  let id = "";
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return null;
  }
  return CASE_IDS.includes(id) ? id : null;
}

/* ---------- タブ ---------- */

function selectCase(id, { focusTab = false, focusPanel = false, updateHash = false } = {}) {
  for (const tab of tabs) {
    const on = tab.dataset.case === id;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focusTab) tab.focus();
  }
  for (const caseId of CASE_IDS) document.getElementById(caseId).hidden = caseId !== id;
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
  if (tab) selectCase(tab.dataset.case, { updateHash: true });
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
  selectCase(tabs[moves[event.key]].dataset.case, { focusTab: true, updateHash: true });
});

window.addEventListener("hashchange", () => {
  const id = hashCase();
  if (id) selectCase(id, { focusPanel: true });
});

/* ---------- 表示部品 ---------- */

function definitionList(rows, className = "facts-list") {
  const dl = el("dl", { className });
  for (const [term, value, extra] of rows) {
    dl.append(el("div", { className: extra || null }, el("dt", { text: term }), el("dd", {}, value)));
  }
  return dl;
}

function code(text) {
  return el("code", { text });
}

function rawBlock(summary, value) {
  return el(
    "details",
    { className: "raw" },
    el("summary", { text: summary }),
    el("pre", { tabindex: "0" }, el("code", { text: pretty(value) })),
  );
}

function routeFrom(checkpoints, endedNext) {
  const route = [];
  for (const point of checkpoints) {
    for (const node of point.next || []) {
      if (node !== "__start__" && route[route.length - 1] !== node) route.push(node);
    }
  }
  if (endedNext && endedNext.length === 0) route.push("__end__");
  return route;
}

function itemsTable(job, catalog) {
  const lines = job.final.line_items;
  const wrap = el("div", { className: "table-wrap", tabindex: "0", role: "region", "aria-label": "品目の表" });
  const table = el("table");
  if (lines) {
    table.append(
      el("thead", {}, el("tr", {}, ["品目", "数量", "単価", "小計"].map((h) => el("th", { scope: "col", text: h })))),
      el(
        "tbody",
        {},
        lines.map((line) =>
          el(
            "tr",
            {},
            el("th", { scope: "row" }, line.name, el("span", { className: "sku", text: line.sku })),
            el("td", { text: String(line.quantity) }),
            el("td", { text: yen(line.unit_yen) }),
            el("td", { text: yen(line.subtotal_yen) }),
          ),
        ),
      ),
      el(
        "tfoot",
        {},
        el("tr", {}, el("th", { scope: "row", colspan: "3", text: "合計（estimate ノードの出力）" }), el("td", { text: yen(job.final.total_yen) })),
      ),
    );
  } else {
    const names = Object.fromEntries(catalog.map((entry) => [entry.sku, entry.name]));
    table.append(
      el("thead", {}, el("tr", {}, ["品目", "数量"].map((h) => el("th", { scope: "col", text: h })))),
      el(
        "tbody",
        {},
        (job.input.items || []).map((item) =>
          el(
            "tr",
            {},
            el("th", { scope: "row" }, names[item.sku] || "単価表にない品目", el("span", { className: "sku", text: String(item.sku) })),
            el("td", { text: String(item.quantity) }),
          ),
        ),
      ),
    );
  }
  wrap.append(table);
  return wrap;
}

function step(number, title, tone, ...body) {
  return el(
    "li",
    { className: `step${tone ? ` step--${tone}` : ""}` },
    el("h4", {}, el("span", { className: "step-no", text: String(number) }), title),
    ...body,
  );
}

/* ---------- 1件分のパネル ---------- */

function renderPanel(panel, job, source, rules) {
  const final = job.final;
  const status = STATUS[final.status] || { label: final.status, tone: "needs-input" };
  const paused = Boolean(job.pause);
  const inputMatches = source ? sameJSON(source.request, job.input) && sameJSON(source.test_resume, job.test_resume) : false;

  const verdict = el(
    "div",
    { className: `verdict verdict--${status.tone}` },
    el("p", { className: "verdict-status" }, status.label, paused ? el("span", { className: "verdict-tag", text: "テスト値で再開" }) : null),
    el("p", { className: "verdict-total", text: final.total_yen !== undefined ? `見積合計 ${yen(final.total_yen)}` : "見積なし（入力確認で終了）" }),
  );

  const summary = el(
    "div",
    { className: "summary" },
    el("p", { className: "summary-label", text: `グラフが書いた要約（${paused ? "finalize" : "needs_input"} ノード・決まった規則で作成）` }),
    el("p", { className: "summary-text", text: final.summary || "" }),
  );

  // 1. 申請内容
  const fieldRows = ["applicant", "event", "start_date", "end_date"].map((field) => {
    const value = job.input[field];
    const empty = value === undefined || value === null || String(value).trim() === "";
    return [`${FIELD_LABELS[field]}（${field}）`, empty ? el("span", { className: "empty", text: "（空）" }) : String(value), empty ? "is-empty" : null];
  });
  const inputStep = step(
    1,
    "申請内容（入力）",
    null,
    definitionList(fieldRows),
    itemsTable(job, rules.catalog),
    source
      ? el("p", { className: inputMatches ? "note" : "note is-error", text: inputMatches ? "inputs/requests.json の内容と一致しています。" : "注意：inputs/requests.json と保存結果の入力が一致しません。workflow.py を実行し直してください。" })
      : el("p", { className: "note is-error", text: "inputs/requests.json にこの申請が見つかりません。" }),
  );

  // 2. 経路
  const route = routeFrom(job.checkpoints, job.end_state?.next);
  const routeList = el(
    "ol",
    { className: "route" },
    route.map((node) =>
      el(
        "li",
        { className: node === "review" && paused ? "is-paused" : node === "__end__" ? "is-end" : null },
        el("span", { className: "route-name", text: node === "__end__" ? "終了" : NODE_LABELS[node] || node }),
        node === "__end__" ? null : el("code", { text: node }),
        node === "review" && paused ? el("span", { className: "route-tag", text: "ここで停止→再開" }) : null,
      ),
    ),
  );
  const routeStep = step(
    2,
    "通った経路",
    null,
    routeList,
    el("p", { className: "note", text: "保存されたチェックポイントの next を古い順に並べた経路です。ノード内部の処理を逐一記録したトレースではありません。" }),
    el("p", { className: "note" }, `チェックポイント ${job.checkpoints.length} 件（get_state_history の件数）。処理の速さや品質の指標ではありません。`),
  );

  // 3. 停止、4. 再開
  let pauseStep;
  let resumeStep;
  if (paused) {
    const first = job.pause.interrupts[0];
    const payload = first.value || {};
    pauseStep = step(
      3,
      "確認待ちで止まる",
      "review",
      el("p", {}, `最初の invoke の戻り値に __interrupt__ が ${job.pause.interrupts.length} 件。止まった時点の get_state の next は `, code((job.pause.state.next || []).join(", ")), " です。"),
      definitionList([
        ["問い（payload.question）", String(payload.question ?? "")],
        ["見積合計", payload.total_yen !== undefined ? yen(payload.total_yen) : "—"],
        ["budget_flag", payload.budget_flag ? `true（${yen(payload.budget_review_from_yen)} 以上）` : `false（${yen(payload.budget_review_from_yen)} 未満）`],
        ["interrupt の id", el("code", { className: "break", text: first.id })],
      ]),
      rawBlock("interrupt の中身（payload と再開値の型）", job.pause.interrupts),
    );
    resumeStep = step(
      4,
      "テスト回答で再開",
      null,
      el("p", {}, "同じ thread_id のまま、", code("Command(resume=…)"), " に次の値を渡して続きを実行しました。"),
      definitionList([
        ["approved", String(job.test_resume.approved)],
        ["comment", String(job.test_resume.comment)],
      ]),
      el("p", { className: "note note--strong", text: "これはスクリプトが入力ファイルから渡したテスト値です。人がボタンを押した承認ではありません。" }),
    );
  } else {
    const missing = final.missing_fields || [];
    const errors = final.input_errors || [];
    const reasons = [
      missing.length ? `${missing.map((f) => `${FIELD_LABELS[f] || f}（${f}）`).join("、")}の空欄` : "",
      errors.length ? `入力の誤り（${errors.join(" / ")}）` : "",
    ].filter(Boolean).join("と");
    pauseStep = step(
      3,
      "止まらずに終了",
      null,
      el("p", {}, `interrupt は ${job.checks.interrupt_count} 件。validate が${reasons}を見つけ、条件付きエッジが `, code("needs_input"), " へ進んで終了しました。見積と確認待ちには進んでいません。"),
    );
    resumeStep = step(4, "再開", null, el("p", { text: "止まっていないので、再開していません（test_resume は null）。" }));
  }

  // 5. 最終状態
  const finalRows = [
    ["status", el("span", { className: `pill pill--${status.tone}`, text: `${final.status}（${status.label}）` })],
  ];
  if (final.total_yen !== undefined) finalRows.push(["total_yen", yen(final.total_yen)], ["budget_flag", String(final.budget_flag)]);
  if (final.missing_fields?.length) finalRows.push(["missing_fields", final.missing_fields.join(", ")]);
  if (final.review) finalRows.push(["review.comment", String(final.review.comment)]);
  const finalStep = step(
    5,
    "最終状態",
    null,
    definitionList(finalRows),
    el(
      "p",
      { className: "note" },
      job.checks.expected_values_match
        ? `期待値（${job.checks.expected_status}）との照合：一致。workflow.py 内の確認で、品質の評価ではありません。`
        : "期待値との照合：記録なし",
    ),
  );

  // 技術的な詳細
  const tech = el(
    "details",
    { className: "tech" },
    el("summary", { text: "技術的な詳細（get_state とチェックポイントの実データ）" }),
    el("p", { className: "note" }, "thread_id：", el("code", { className: "break", text: job.thread_id || "—" })),
    paused ? rawBlock("再開前の get_state（values・next）", job.pause.state) : null,
    job.after_resume ? rawBlock("再開後の get_state（values・next）", job.after_resume) : null,
    rawBlock("終了時の get_state（values・next）", job.end_state),
    el("h5", { text: `get_state_history（古い順・${job.checkpoints.length} 件）` }),
    el(
      "ol",
      { className: "checkpoints" },
      job.checkpoints.map((point) =>
        el(
          "li",
          {},
          rawBlock(`step ${point.step ?? "?"} · ${point.source ?? "?"} · next: ${(point.next || []).join(", ") || "（なし＝終了）"}`, point),
        ),
      ),
    ),
  );

  const heading = el("h3", { tabindex: "-1", text: job.label });
  panel.replaceChildren(
    heading,
    verdict,
    summary,
    el("ol", { className: "steps" }, inputStep, routeStep, pauseStep, resumeStep, finalStep),
    tech,
  );
}

function tabResult(job) {
  const final = job.final;
  if (final.status === "needs_input") {
    const fields = (final.missing_fields || []).map((f) => FIELD_LABELS[f] || f).join("・");
    return fields ? `${fields}なし → 追加入力` : "入力の誤り → 追加入力";
  }
  const label = STATUS[final.status]?.label || final.status;
  return `${yen(final.total_yen)} → ${label}`;
}

/* ---------- 読み込み ---------- */

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
  for (const tab of tabs) tab.querySelector(".tab-result").textContent = "表示できません";
  for (const id of CASE_IDS) {
    document.getElementById(id).replaceChildren(el("p", { className: "panel-wait", text: "実行結果を読み込めなかったため、表示していません。" }));
  }
}

async function loadRequestText() {
  const area = document.getElementById("request-text");
  try {
    const response = await fetch("request.txt", { cache: "no-store" });
    if (response.ok) area.value = await response.text();
  } catch {
    // 読めないときは HTML に書いた同じ文面をそのまま使う
  }
}

async function load() {
  if (location.protocol === "file:") {
    throw new Error("file:// で開いているため、JSONを読み込めません。README の手順で python -m http.server 8000 を起動し、http://127.0.0.1:8000/ を開いてください。");
  }
  const [runs, requests] = await Promise.all([getJSON("outputs/runs.json"), getJSON("inputs/requests.json")]);
  if (!runs || !Array.isArray(runs.jobs)) throw new Error("outputs/runs.json に jobs がありません。");

  const sources = Object.fromEntries((requests.jobs || []).map((job) => [job.id, job]));
  const rules = runs.rules || requests.rules || { catalog: [] };
  let shown = 0;
  for (const id of CASE_IDS) {
    const panel = document.getElementById(id);
    const tab = document.getElementById(`tab-${id}`);
    const job = runs.jobs.find((item) => item.id === id);
    if (!job) {
      panel.replaceChildren(el("p", { className: "panel-wait", text: "outputs/runs.json にこの申請の結果がありません。" }));
      tab.querySelector(".tab-result").textContent = "結果なし";
      continue;
    }
    tab.querySelector(".tab-label").textContent = job.label;
    tab.querySelector(".tab-result").textContent = tabResult(job);
    try {
      renderPanel(panel, job, sources[id], rules);
      shown += 1;
    } catch (error) {
      panel.replaceChildren(el("p", { className: "panel-wait is-error", text: `この申請の表示に失敗しました：${error.message}` }));
    }
  }

  const fw = runs.framework || {};
  loadStatus.className = "load-status";
  loadStatus.textContent = `保存済みの実行結果 ${shown} 件を表示中（${fw.name || "LangGraph"} ${fw.version || ""}・承認はテスト値・入力は架空）。`;
}

const initial = hashCase();
selectCase(initial || "approved");
loadRequestText();
load()
  .then(() => {
    const id = hashCase();
    if (id) selectCase(id, { focusPanel: true });
  })
  .catch((error) => showError(error.message));

/* ---------- 依頼文のコピー ---------- */

const copyButton = document.getElementById("copy-request");
const copyStatus = document.getElementById("copy-status");
copyButton.addEventListener("click", async () => {
  const area = document.getElementById("request-text");
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error("この環境ではクリップボードを使えません");
    await navigator.clipboard.writeText(area.value);
    copyStatus.className = "copy-status";
    copyStatus.textContent = "コピーしました。";
  } catch (error) {
    area.focus();
    area.setSelectionRange(0, area.value.length);
    copyStatus.className = "copy-status is-error";
    copyStatus.textContent = `自動でコピーできませんでした（${error.message}）。依頼文を選択したので、Ctrl+C（Mac は ⌘C）でコピーしてください。`;
  }
});
