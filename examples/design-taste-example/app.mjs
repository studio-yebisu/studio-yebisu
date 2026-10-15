// 余白図書室（架空）の催し一覧：events.json を一度だけ読み、ネイティブの欄で絞り込む。
// 画面の文字はすべて textContent で入れ、HTMLとして解釈しない。保存・送信はしない。

import {
  AUDIENCE_LABELS,
  PRESETS,
  filterEvents,
  formatDateJa,
  normalizeText,
  presetFromHash,
  weekdayJa,
} from "./events.mjs";

const $ = (id) => document.getElementById(id);

const ui = {
  form: $("finder-form"),
  fields: $("finder-fields"),
  query: $("q"),
  audience: $("aud"),
  reset: $("reset"),
  status: $("status"),
  finderTitle: $("finder-title"),
  listingTitle: $("listing-title"),
  list: $("event-list"),
  empty: $("empty"),
  emptyReason: $("empty-reason"),
  emptyReset: $("empty-reset"),
  loadError: $("load-error"),
  reload: $("reload"),
  requestText: $("request-text"),
  copyRow: $("copy-row"),
  copyButton: $("copy-request"),
  copyStatus: $("copy-status"),
};

let events = [];
let activePreset = null;
const rows = new Map();

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeTime(text, datetime, className) {
  const node = make("time", className, text);
  node.dateTime = datetime;
  return node;
}

function buildRow(event) {
  const row = make("li", "event");

  const when = make("p", "event-when");
  const day = make("span", "event-day");
  day.append(
    makeTime(formatDateJa(event.date), event.date, "event-date"),
    make("span", "event-weekday", `（${weekdayJa(event.date)}）`),
  );
  const time = make("span", "event-time");
  time.append(
    makeTime(event.start, `${event.date}T${event.start}`),
    "〜",
    makeTime(event.end, `${event.date}T${event.end}`),
  );
  when.append(day, time);

  const body = make("div", "event-body");
  const meta = make("dl", "event-meta");
  for (const [label, value] of [["対象", event.audience_label], ["会場", event.place]]) {
    const pair = make("div");
    pair.append(make("dt", "", label), make("dd", "", value));
    meta.append(pair);
  }

  const details = make("details", "event-details");
  details.append(
    make("summary", "", `参加方法：${event.participation}`),
    make("p", "", event.registration),
  );

  body.append(
    make("h3", "event-title", event.title),
    meta,
    make("p", "event-description", event.description),
    details,
  );

  row.append(when, body);
  return row;
}

function readConditions() {
  return { audience: ui.audience.value, query: ui.query.value };
}

function describeConditions({ audience, query }) {
  const audienceText = `対象「${AUDIENCE_LABELS[audience] ?? audience}」`;
  const queryText = normalizeText(query) === "" ? "検索語なし" : `検索「${query.trim()}」`;
  return `${audienceText}、${queryText}`;
}

function describeEmpty({ audience, query }) {
  const hasQuery = normalizeText(query) !== "";
  const label = AUDIENCE_LABELS[audience] ?? audience;
  let what;
  if (hasQuery && audience !== "all") {
    what = `「${query.trim()}」を含む、対象が「${label}」の催しは、十一月の一覧にありません。`;
  } else if (hasQuery) {
    what = `「${query.trim()}」を含む催しは、十一月の一覧にありません。`;
  } else {
    what = `対象が「${label}」の催しは、十一月の一覧にありません。`;
  }
  const scope = hasQuery ? "検索は催しの名前・説明・会場の文字だけを見ていて、日付や時刻は含みません。" : "";
  return what + scope;
}

function render() {
  const conditions = readConditions();
  const matched = filterEvents(events, conditions);
  const shown = new Set(matched.map((event) => event.id));

  for (const [id, row] of rows) row.hidden = !shown.has(id);
  ui.list.hidden = matched.length === 0;
  ui.empty.hidden = matched.length !== 0;
  if (matched.length === 0) ui.emptyReason.textContent = describeEmpty(conditions);

  const count = `${events.length}件中${matched.length}件を表示しています。`;
  const preset = activePreset ? PRESETS[activePreset] : null;
  ui.status.textContent = preset
    ? `例「${preset.label}」の条件（${describeConditions(conditions)}）で、${count}`
    : `現在の条件（${describeConditions(conditions)}）で、${count}`;
}

function controlsMatchPreset(name) {
  const preset = PRESETS[name];
  return ui.audience.value === preset.audience && ui.query.value === preset.query;
}

function applyPreset(name, { moveFocus = false } = {}) {
  const preset = PRESETS[name];
  ui.audience.value = preset.audience;
  ui.query.value = preset.query;
  activePreset = name;
  render();
  if (moveFocus) ui.finderTitle.focus();
}

function clearConditions() {
  ui.audience.value = "all";
  ui.query.value = "";
  activePreset = null;
  render();
}

function onUserEdit() {
  activePreset = null;
  render();
}

function bindControls() {
  ui.form.addEventListener("submit", (event) => event.preventDefault());
  ui.query.addEventListener("input", onUserEdit);
  ui.query.addEventListener("search", onUserEdit);
  ui.audience.addEventListener("change", onUserEdit);
  ui.reset.addEventListener("click", clearConditions);
  ui.emptyReset.addEventListener("click", () => {
    clearConditions();
    ui.listingTitle.focus();
  });

  // 例のリンク：押したときに欄へ入れる。同じリンクをもう一度押しても入れ直す。
  for (const link of document.querySelectorAll('a[href^="#"]')) {
    const name = presetFromHash(link.getAttribute("href"));
    if (!name) continue;
    link.addEventListener("click", () => applyPreset(name, { moveFocus: true }));
  }

  // 戻る・進むで合図が変わったとき。知らない合図（#main など）では欄を変えない。
  window.addEventListener("hashchange", () => {
    const name = presetFromHash(location.hash);
    if (!name) return;
    if (activePreset === name && controlsMatchPreset(name)) return;
    applyPreset(name, { moveFocus: true });
  });
}

function showLoadError() {
  ui.list.hidden = true;
  ui.empty.hidden = true;
  ui.loadError.hidden = false;
  ui.status.textContent = "催しのデータを読み込めませんでした。ページを再読み込みしてください。";
}

async function loadEvents() {
  try {
    const response = await fetch(new URL("./events.json", import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data?.events) || data.events.length === 0) {
      throw new Error("events.json に催しがありません");
    }
    const built = data.events.map((event) => [event.id, buildRow(event)]);
    events = data.events;
    for (const [id, row] of built) {
      rows.set(id, row);
      ui.list.append(row);
    }
  } catch (error) {
    console.error(error);
    showLoadError();
    return;
  }

  ui.emptyReset.textContent = `条件を解除して${events.length}件を表示`;
  bindControls();
  ui.fields.disabled = false;

  const name = presetFromHash(location.hash);
  if (name) applyPreset(name);
  else render();
}

// 依頼文のコピー：利用者の操作のときだけ。成功したときだけ成功と書く。
async function copyRequest() {
  const area = ui.requestText;
  area.focus();
  area.select();
  area.setSelectionRange(0, area.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  if (!copied && window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(area.value);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (copied) {
    ui.copyStatus.textContent = "依頼文をコピーしました。AIとの会話に貼り付けて、【】の部分を書き換えてください。";
    ui.copyButton.focus();
  } else {
    area.focus();
    area.select();
    ui.copyStatus.textContent = "自動ではコピーできませんでした。依頼文を選択した状態にしたので、Ctrl+C（Mac は Command+C）でコピーしてください。";
  }
}

ui.reload.addEventListener("click", () => location.reload());
ui.copyButton.addEventListener("click", copyRequest);
ui.copyRow.hidden = false;

loadEvents();
