// 保存済みの実行結果（outputs/runs.json）を読んで表示するだけのビューア。
// ここでは Crawl4AI もブラウザー操作も AI も動かない。データ由来の文字列は textContent でだけ差し込む。
// 通信は同じ場所の outputs/runs.json と request.txt の読み込みだけ。保存・計測はしない。

const PANEL_IDS = ["start", "review", "export", "missing"];
const RUNS_PATH = "outputs/runs.json";
const RAW_LINKS = [
  ["outputs/runs.json", "outputs/runs.json"],
  ["outputs/result.md", "outputs/result.md"],
  ["samples.json", "samples.json"],
];

const tablist = document.querySelector('[role="tablist"]');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];
const loadStatus = document.getElementById("load-status");
const retryButton = document.getElementById("retry");
const facts = Object.fromEntries([...document.querySelectorAll("[data-fact]")].map((node) => [node.dataset.fact, node]));
let objectUrls = [];

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

// fixture/ の中の相対パスだけをリンクにする。それ以外は文字だけで出す。
function fixtureHref(path) {
  if (typeof path !== "string") return null;
  if (!/^fixture\/[A-Za-z0-9._\-/]+$/.test(path) || path.includes("..") || path.includes("//")) return null;
  return path;
}

function hashPanel() {
  let id = "";
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return null;
  }
  return PANEL_IDS.includes(id) ? id : null;
}

/* ---------- タブ ---------- */

function selectPanel(id, { focusTab = false, focusPanel = false, updateHash = false } = {}) {
  for (const tab of tabs) {
    const on = tab.dataset.panel === id;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focusTab) tab.focus();
  }
  for (const panelId of PANEL_IDS) document.getElementById(panelId).hidden = panelId !== id;
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
  if (tab) selectPanel(tab.dataset.panel, { updateHash: true });
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
  selectPanel(tabs[moves[event.key]].dataset.panel, { focusTab: true, updateHash: true });
});

window.addEventListener("hashchange", () => {
  const id = hashPanel();
  if (id) selectPanel(id, { focusPanel: true });
});

/* ---------- 表示部品 ---------- */

function codeBlock(text, label, { wrapText = false } = {}) {
  return el(
    "pre",
    { tabindex: "0", role: "region", "aria-label": label, className: wrapText ? "wrap-text" : null },
    el("code", { text: text ?? "" }),
  );
}

function rawBlock(summary, value, extra = []) {
  const text = typeof value === "string" ? value : pretty(value);
  return el("details", { className: "raw" }, el("summary", { text: summary }), ...extra, codeBlock(text, summary));
}

function flag(value) {
  if (value === true) return "true";
  if (value === false) return "false";
  return value === null || value === undefined ? "記録なし" : String(value);
}

function statusGrid(response, accepted) {
  const ok200 = response.status_code === 200;
  return el(
    "dl",
    { className: "status-grid" },
    el("div", { className: ok200 ? "is-good" : "is-bad" }, el("dt", { text: "HTTP ステータス" }), el("dd", { text: response.status_code ?? "記録なし" })),
    el("div", {}, el("dt", { text: "ライブラリの success" }), el("dd", { text: flag(response.success) })),
    el("div", { className: accepted ? "is-good" : "is-bad" }, el("dt", { text: "受理（success かつ 200）" }), el("dd", { text: accepted ? "受理" : "受理しない" })),
  );
}

function downloadLink(text, filename, label) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  objectUrls.push(url);
  return el("a", { className: "button button--quiet", href: url, download: filename, text: label });
}

function sectionList(doc) {
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  const origins = Array.isArray(doc.section_origins) ? doc.section_origins : [];
  return el(
    "ol",
    { className: "sections" },
    sections.map((section, i) => {
      const script = origins[i] === "script";
      return el(
        "li",
        { className: `section-card${script ? " is-script" : ""}` },
        el("p", { className: "section-origin", text: `節 ${i + 1} · ${script ? "JavaScript が追加した節" : "元のHTMLにある節"}` }),
        el("p", { className: "section-heading", text: String(section.heading ?? "") }),
        el("p", { className: "section-keypoint", text: String(section.keypoint ?? "") }),
        el("p", { className: "field-map" }, "heading ← ", el("code", { text: "h2" }), " ／ keypoint ← ", el("code", { text: "p.keypoint" })),
      );
    }),
  );
}

function sourceLink(file, label) {
  const href = fixtureHref(file?.path);
  return href ? el("a", { href, text: label }) : el("span", { text: label });
}

/* ---------- 1ページ分のパネル ---------- */

function renderDocument(panel, doc) {
  const response = doc.response || {};
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  const origins = Array.isArray(doc.section_origins) ? doc.section_origins : [];
  const children = [
    el("h3", { tabindex: "-1", text: doc.title.split("｜")[0] }),
    el("p", { className: "meta" }, el("code", { text: doc.path }), " · ", sourceLink(doc.input_html, "元のページを開く")),
    el("details", { className: "response-status" }, el("summary", { text: "HTTPと受理の判定を見る" }), statusGrid(response, doc.accepted === true)),
    el("h4", { text: `取り出した節（${sections.length}）` }),
    el("p", { className: "note", text: "extracted_content をそのまま JSON として読んだ結果です。要点は元の段落をそのまま取り出したもので、AIの要約ではありません。" }),
    sectionList(doc),
  ];
  if (doc.parse_error) children.push(el("p", { className: "note is-error", text: `extracted_content を JSON として読めませんでした（${doc.parse_error}）。` }));

  if (doc.input_script) {
    const scriptHeadings = sections.filter((_, i) => origins[i] === "script").map((s) => `「${s.heading}」`);
    const htmlCount = origins.filter((origin) => origin === "html").length;
    children.push(
      el(
        "div",
        { className: "callout" },
        el("p", {}, el("strong", { text: "JavaScript の前と後" })),
        el(
          "p",
          {},
          `元の export.html に書かれている節は ${htmlCount}。取得結果の ${sections.length} 節のうち ${scriptHeadings.join("・") || "（なし）"} は、HTML のソースになく、`,
          sourceLink(doc.input_script, "dynamic-export.js"),
          " が読み込み後に追加した節です。",
        ),
        el("p", { className: "note", text: "どの節がどちらにあるかは、workflow.py が取得前にソースと照合した記録です。取得結果はすべて wait_for で印を待った後のページから取り出しています。" }),
      ),
    );
  }

  const markdown = typeof response.markdown === "string" ? response.markdown : "";
  children.push(
    el("h4", { text: "Markdown（raw_markdown）" }),
    el("p", { className: "note", text: "css_selector で絞った main#guide の中から、Crawl4AI の DefaultMarkdownGenerator が作った文字列そのままです（リンクは除く設定）。" }),
    codeBlock(markdown, `${doc.label} の Markdown`, { wrapText: true }),
    el("p", { className: "actions" }, downloadLink(markdown, `${doc.id}.md`, "この Markdown を保存")),
  );

  const htmlFile = doc.input_html || {};
  children.push(
    rawBlock("元のHTML（JavaScript 実行前のソース）", htmlFile.text ?? "", [
      el("p", { className: "note" }, el("code", { text: htmlFile.path || "" }), " · sha256 ", el("code", { text: htmlFile.sha256 || "" })),
    ]),
  );
  if (doc.input_script) {
    children.push(
      rawBlock("dynamic-export.js（元のスクリプト）", doc.input_script.text ?? "", [
        el("p", { className: "note" }, el("code", { text: doc.input_script.path || "" }), " · ", sourceLink(doc.input_script, "ファイルを開く")),
      ]),
    );
  }
  children.push(
    rawBlock("extracted_content（ライブラリが返した文字列そのまま）", response.extracted_content ?? "（なし）"),
    rawBlock("リクエスト（URL と workflow.py が渡した設定）", { url: doc.request?.url, config: doc.request?.config }),
    rawBlock("設定の dump（CrawlerRunConfig.dump() の出力）", doc.request?.config_dump ?? null),
    rawBlock("レスポンス（url・status_code・success・error_message）", {
      url: response.url,
      status_code: response.status_code,
      success: response.success,
      error_message: response.error_message,
    }),
  );
  panel.replaceChildren(...children);
}

function renderDiagnostic(panel, diag) {
  const response = diag.response || {};
  const accepted = diag.accepted === true;
  const message = typeof response.error_message === "string" ? response.error_message : "";
  const children = [
    el("h3", { tabindex: "-1", text: `取得エラー：${diag.path}` }),
    el("p", { className: "meta", text: "fixture に置いていないページへの、診断用のリクエストです。3ページの成功件数には数えません。" }),
    statusGrid(response, accepted),
    el(
      "div",
      { className: "callout callout--teal" },
      el("p", {}, el("strong", { text: "success と HTTP ステータスは別のもの" })),
      el("p", {
        text: `今回の記録では、ライブラリの success は ${flag(response.success)}、HTTP ステータスは ${response.status_code ?? "記録なし"} でした。`,
      }),
      el("p", {
        text: "Crawl4AI の success はライブラリが返す旗で、HTTP の成否とは別に決まります（固定版のソースでは、本文を受け取れたかや、ボット対策の判定で決まります）。この作例は success と HTTP 200 の両方を満たしたときだけ受理し、それ以外は取得エラーとして分けています。",
      }),
    ),
  ];
  if (message) {
    children.push(el("h4", { text: "error_message（そのまま）" }), codeBlock(message, "error_message", { wrapText: true }));
    if (/anti-bot/i.test(message)) {
      children.push(el("p", { className: "note", text: "この文はライブラリの判定文です。この作例のローカルサーバーにボット対策はありません。短い 404 のページをライブラリがそう分類したことを示しています。" }));
    }
  } else {
    children.push(el("p", { className: "note", text: "error_message は空でした。" }));
  }
  const markdown = typeof response.markdown === "string" ? response.markdown : "";
  children.push(
    el("p", { className: "note", text: "/docs/missing.html は fixture に無いため、リンクは置いていません。" }),
    rawBlock("404 のページから作られた Markdown", markdown || "（なし）"),
    rawBlock("リクエスト（URL と workflow.py が渡した設定）", { url: diag.request?.url, config: diag.request?.config }),
    rawBlock("設定の dump（CrawlerRunConfig.dump() の出力）", diag.request?.config_dump ?? null),
    rawBlock("レスポンス（url・status_code・success・error_message）", {
      url: response.url,
      status_code: response.status_code,
      success: response.success,
      error_message: response.error_message,
    }),
  );
  panel.replaceChildren(...children);
}

function renderChecks(checks) {
  const list = el(
    "ul",
    { className: "checks" },
    checks.map((check) =>
      el(
        "li",
        { className: `check${check.passed ? "" : " is-failed"}` },
        el("span", { className: "check-mark", text: check.passed ? "通過" : "不合格" }),
        el("p", { className: "check-label", text: check.label }),
        el("p", { className: "check-detail", text: check.detail }),
      ),
    ),
  );
  const passed = checks.filter((check) => check.passed).length;
  document.getElementById("check-list").replaceChildren(el("p", { className: "note", text: `${checks.length} 項目のうち ${passed} 項目が通過（保存された記録）。` }), list);
}

function renderAccessLog(log) {
  const table = el(
    "table",
    {},
    el("caption", { className: "note", text: `${log.length} 件` }),
    el("thead", {}, el("tr", {}, ["#", "メソッド", "パス", "ステータス"].map((h) => el("th", { scope: "col", text: h })))),
    el(
      "tbody",
      {},
      log.map((item, i) =>
        el(
          "tr",
          {},
          el("td", { text: String(i + 1) }),
          el("td", { text: String(item.method ?? "") }),
          el("td", {}, el("code", { text: String(item.path ?? "") })),
          el("td", { className: item.status === 200 ? null : "status-404", text: String(item.status ?? "") }),
        ),
      ),
    ),
  );
  document.getElementById("access-log").replaceChildren(el("div", { className: "table-wrap", tabindex: "0", role: "region", "aria-label": "サーバーに届いたリクエストの表" }, table));
}

/* ---------- 読み込み ---------- */

function resetView() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
  retryButton.hidden = true;
  loadStatus.className = "load-status";
  loadStatus.textContent = "保存済みの実行結果（outputs/runs.json）を読み込んでいます。";
  for (const node of Object.values(facts)) node.textContent = "読み込み中";
  for (const tab of tabs) tab.querySelector(".tab-result").textContent = "読み込み中";
}

function showError(message) {
  loadStatus.className = "load-status is-error";
  loadStatus.replaceChildren(
    message,
    " 生のファイル：",
    ...RAW_LINKS.flatMap(([href, label], i) => [i ? " · " : "", el("a", { href, text: label })]),
  );
  retryButton.hidden = false;
  for (const node of Object.values(facts)) node.textContent = "表示できません";
  for (const tab of tabs) tab.querySelector(".tab-result").textContent = "表示できません";
  for (const id of PANEL_IDS) {
    document.getElementById(id).replaceChildren(el("p", { className: "panel-wait is-error", text: "実行結果を読み込めなかったため、表示していません。" }));
  }
  for (const id of ["check-list", "access-log"]) {
    document.getElementById(id).replaceChildren(el("p", { className: "panel-wait is-error", text: "実行結果を読み込めなかったため、表示していません。" }));
  }
}

async function getRuns() {
  if (location.protocol === "file:") {
    throw new Error("file:// で開いているため、JSONを読み込めません。README の手順で python -m http.server 8000 を起動し、http://127.0.0.1:8000/ を開いてください。");
  }
  let response;
  try {
    response = await fetch(RUNS_PATH, { cache: "no-store" });
  } catch {
    throw new Error(`${RUNS_PATH} を読み込めませんでした（通信できませんでした）。`);
  }
  if (!response.ok) throw new Error(`${RUNS_PATH} を読み込めませんでした（HTTP ${response.status}）。`);
  let runs;
  try {
    runs = await response.json();
  } catch {
    throw new Error(`${RUNS_PATH} をJSONとして読めませんでした。`);
  }
  if (!runs || !Array.isArray(runs.documents) || !runs.diagnostic || !Array.isArray(runs.checks) || !Array.isArray(runs.access_log)) {
    throw new Error(`${RUNS_PATH} に documents・diagnostic・checks・access_log がそろっていません。`);
  }
  return runs;
}

async function load() {
  resetView();
  const runs = await getRuns();
  const docs = runs.documents;
  let shown = 0;

  for (const id of PANEL_IDS.slice(0, 3)) {
    const panel = document.getElementById(id);
    const tab = document.getElementById(`tab-${id}`);
    const doc = docs.find((item) => item.id === id);
    if (!doc) {
      panel.replaceChildren(el("p", { className: "panel-wait is-error", text: "outputs/runs.json にこのページの結果がありません。" }));
      tab.querySelector(".tab-result").textContent = "結果なし";
      continue;
    }
    const count = Array.isArray(doc.sections) ? doc.sections.length : 0;
    tab.querySelector(".tab-label").textContent = doc.label;
    tab.querySelector(".tab-result").textContent = `HTTP ${doc.response?.status_code ?? "?"} · ${count}節`;
    try {
      renderDocument(panel, doc);
      shown += 1;
    } catch (error) {
      panel.replaceChildren(el("p", { className: "panel-wait is-error", text: `このページの表示に失敗しました：${error.message}` }));
    }
  }

  const diag = runs.diagnostic;
  document.getElementById("tab-missing").querySelector(".tab-result").textContent = `HTTP ${diag.response?.status_code ?? "?"} · 受理${diag.accepted ? "" : "しない"}`;
  renderDiagnostic(document.getElementById("missing"), diag);
  renderChecks(runs.checks);
  renderAccessLog(runs.access_log);

  const accepted = docs.filter((doc) => doc.accepted === true).length;
  const sectionTotal = docs.reduce((sum, doc) => sum + (Array.isArray(doc.sections) ? doc.sections.length : 0), 0);
  facts.accepted.textContent = `${accepted}/${docs.length}`;
  facts.sections.textContent = `${sectionTotal}`;
  facts.diagnostic.textContent = `${diag.response?.status_code ?? "?"}`;

  const lib = runs.library || {};
  loadStatus.className = "load-status";
  loadStatus.textContent = `保存済みの ${shown} ページを表示中。`;
}

function start() {
  load()
    .then(() => {
      const id = hashPanel();
      if (id) selectPanel(id, { focusPanel: true });
    })
    .catch((error) => showError(error.message));
}

retryButton.addEventListener("click", start);
selectPanel(hashPanel() || "start");
loadRequestText();
start();

/* ---------- 依頼文 ---------- */

async function loadRequestText() {
  const area = document.getElementById("request-text");
  try {
    const response = await fetch("request.txt", { cache: "no-store" });
    if (response.ok) area.value = await response.text();
  } catch {
    // 読めないときは HTML に書いた同じ文面をそのまま使う
  }
}

const copyButton = document.getElementById("copy-request");
const copyStatus = document.getElementById("copy-status");

function selectRequest(area) {
  area.focus();
  area.select();
  area.setSelectionRange(0, area.value.length);
}

copyButton.addEventListener("click", async () => {
  const area = document.getElementById("request-text");
  copyStatus.className = "copy-status";
  copyStatus.textContent = "";
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(area.value);
    } else {
      selectRequest(area);
      if (!document.execCommand || !document.execCommand("copy")) throw new Error("この環境ではクリップボードを使えません");
    }
    copyStatus.textContent = "コピーしました。";
  } catch (error) {
    selectRequest(area);
    copyStatus.className = "copy-status is-error";
    copyStatus.textContent = `自動でコピーできませんでした（${error.message}）。依頼文を選択したので、長押しするか Ctrl+C（Mac は ⌘C）でコピーしてください。`;
  }
});
