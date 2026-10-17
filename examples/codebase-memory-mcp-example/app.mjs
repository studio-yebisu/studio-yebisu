// 保存済みの実行結果を確かめてから、1枚の概念図と記録を表示するだけのビューア。
// Codebase Memory MCP・Python・モデルはここでは動かない。操作は保存済みの記録を選ぶだけで、索引・検索・再実行はしない。
// データ由来の文字列は textContent（SVG も同じ）でだけ差し込む。

const SVG_NS = "http://www.w3.org/2000/svg";
const MANIFEST = { path: "data-manifest.json", sha256: "2e6a270fc789a0a88a3e7228dad30461ea8d4ac6a39baad04d3c838c866c7b77" };
const MANIFEST_FORMAT = "studio-yebisu-codebase-visual-data-v1";
const TOOL = {
  name: "codebase-memory-mcp",
  version: "codebase-memory-mcp 0.12.0",
  release: "v0.12.0",
  commit: "ec6427c38176efcd37b28682e82f2491afda94be",
  transport: "official native CLI; MCP protocol not exercised",
};
const SOURCE_REPO = "DeusData/codebase-memory-mcp";
const PROJECT = "yebisu-workshop-proof";
const ALLOWED_PATHS = [
  "outputs/runs.json",
  "samples.json",
  "outputs/result.md",
  "request.txt",
  "fixture/app.py",
  "fixture/pricing.py",
  "fixture/sample_order.json",
  "fixture/service.py",
  "fixture/storage.py",
  "fixture/storage_revised.py",
  "fixture/validation.py",
];
const SOURCE_FILES = ["fixture/app.py", "fixture/service.py", "fixture/validation.py", "fixture/pricing.py", "fixture/storage.py"];
const STEP_IDS = ["find", "trace", "update"];
const DEFAULT_STEP = "trace";
const DEFAULT_PHASE = "after";
const PHASES = [
  { id: "before", key: "calls_before", label: "初回", rows: 6, internal: 4 },
  { id: "stale", key: "calls_stale", label: "変更後・未更新", rows: 6, internal: 4 },
  { id: "after", key: "calls_after", label: "手で更新後", rows: 7, internal: 5 },
];
const CALL_QUERY = "MATCH (f:Function)-[:CALLS]->(g) RETURN f.name AS caller, g.name AS callee LIMIT 100";
const QN_RULE = 'qn = qn_prefix == "" ? name : qn_prefix + "." + name';
const ENTRY = "submit_order";
const NODE_IDS = ["main", "submit_order", "validate_order", "calculate_total", "save_receipt", "audit_receipt"];
const ROLE = {
  main: "入口",
  submit_order: "注文をまとめる",
  validate_order: "確かめる",
  calculate_total: "合計を出す",
  save_receipt: "領収を保存",
  audit_receipt: "監査を追加",
};
const STEP_NAME = { find: "探す", trace: "たどる", update: "更新する" };
const downloadName = (id) => `codebase-memory-${id}.json`;

/* ---------- 小さな道具 ---------- */

class LoadError extends Error {}

function check(condition, message) {
  if (!condition) throw new LoadError(message);
}

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

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key === "className") node.setAttribute("class", value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child) node.append(child);
  return node;
}

const code = (text) => el("code", { text: String(text) });
const pretty = (value) => JSON.stringify(value, null, 2);
const shortFile = (path) => String(path).replace(/^fixture\//, "");

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((value, i) => deepEqual(value, b[i]));
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function parseJSON(text, path) {
  try {
    return JSON.parse(text);
  } catch {
    throw new LoadError(`${path} をJSONとして読めませんでした。`);
  }
}

/* ---------- 読み込みと固定値の照合 ---------- */

async function fetchBytes(path, signal) {
  check(path === MANIFEST.path || ALLOWED_PATHS.includes(path), `許可していないパス ${path} は読みません。`);
  let response;
  try {
    response = await fetch(path, { cache: "no-store", credentials: "same-origin", signal });
  } catch (error) {
    if (error && error.name === "AbortError") throw error;
    throw new LoadError(`${path} を取得できませんでした（${error && error.message ? error.message : "通信エラー"}）。`);
  }
  check(response.ok, `${path} を読み込めませんでした（HTTP ${response.status}）。`);
  return new Uint8Array(await response.arrayBuffer());
}

async function sha256Hex(bytes) {
  check(
    globalThis.crypto && crypto.subtle && typeof crypto.subtle.digest === "function",
    "この接続では SHA-256 を計算できないため、記録を確かめられません。https:// か http://127.0.0.1 で開いてください。",
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeUtf8(bytes, path) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new LoadError(`${path} を UTF-8 として読めませんでした。`);
  }
}

async function loadAll(signal) {
  check(location.protocol !== "file:", "file:// で開いているため記録を読めません。作例フォルダで python -m http.server 8000 を起動し、http://127.0.0.1:8000/ を開いてください。");
  const manifestBytes = await fetchBytes(MANIFEST.path, signal);
  const manifestHash = await sha256Hex(manifestBytes);
  check(manifestHash === MANIFEST.sha256, `data-manifest.json の SHA-256 が固定値と違います（${manifestHash.slice(0, 12)}…）。`);
  const manifest = parseJSON(decodeUtf8(manifestBytes, MANIFEST.path), MANIFEST.path);
  check(manifest && manifest.format === MANIFEST_FORMAT, "data-manifest.json の形式が違います。");
  check(manifest.source === SOURCE_REPO && manifest.commit === TOOL.commit, "data-manifest.json の原典か固定コミットが違います。");
  check(Array.isArray(manifest.files) && manifest.files.length === ALLOWED_PATHS.length, `data-manifest.json のファイル数が ${ALLOWED_PATHS.length} 件ではありません。`);
  const seen = new Set();
  for (const entry of manifest.files) {
    check(entry && ALLOWED_PATHS.includes(entry.path) && !seen.has(entry.path), `data-manifest.json に許可していないパスか重複があります（${entry && entry.path}）。`);
    check(Number.isInteger(entry.bytes) && entry.bytes > 0 && /^[0-9a-f]{64}$/.test(entry.sha256), `data-manifest.json の ${entry.path} の長さか SHA-256 の形が違います。`);
    seen.add(entry.path);
  }
  const texts = {};
  await Promise.all(
    manifest.files.map(async (entry) => {
      const bytes = await fetchBytes(entry.path, signal);
      check(bytes.byteLength === entry.bytes, `${entry.path} の長さが記録と違います（${bytes.byteLength} / ${entry.bytes} バイト）。`);
      const hash = await sha256Hex(bytes);
      check(hash === entry.sha256, `${entry.path} の SHA-256 が記録と違います（${hash.slice(0, 12)}…）。`);
      texts[entry.path] = decodeUtf8(bytes, entry.path);
    }),
  );
  return buildModel(texts);
}

/* ---------- v0.12 のまとめた応答（cols / groups / qn_rule）を読む ---------- */

function decodeGrouped(payload, where) {
  check(payload && typeof payload === "object", `${where} の応答がありません。`);
  check(payload.qn_rule === QN_RULE, `${where} の qn_rule が想定と違うため、名前を組み立てられません。`);
  check(Array.isArray(payload.cols) && payload.cols.includes("name"), `${where} の cols がありません。`);
  check(Array.isArray(payload.groups), `${where} の groups がありません。`);
  const out = [];
  for (const group of payload.groups) {
    check(group && typeof group.qn_prefix === "string" && Array.isArray(group.rows), `${where} の group の形が違います。`);
    for (const row of group.rows) {
      check(Array.isArray(row) && row.length === payload.cols.length, `${where} の行の列数が cols と違います。`);
      const record = Object.fromEntries(payload.cols.map((col, i) => [col, row[i]]));
      record.qualified_name = group.qn_prefix === "" ? record.name : `${group.qn_prefix}.${record.name}`;
      record.qn_prefix = group.qn_prefix;
      if (group.file !== undefined) record.file = group.file;
      out.push(record);
    }
  }
  return out;
}

function parseSpan(lines, where) {
  const match = /^(\d+)-(\d+)$/.exec(String(lines));
  check(match, `${where} の lines が「開始-終了」の形ではありません。`);
  return { start: Number(match[1]), end: Number(match[2]) };
}

function queryRows(payload, where) {
  check(payload && deepEqual(payload.columns, ["caller", "callee"]), `${where} の columns が caller・callee ではありません。`);
  check(Array.isArray(payload.rows) && payload.rows.every((row) => Array.isArray(row) && row.length === 2), `${where} の rows の形が違います。`);
  check(payload.returned === payload.rows.length && payload.total === payload.rows.length && payload.total_relation === "eq", `${where} の件数が rows と合いません。`);
  check(payload.has_more === false && payload.truncated === false, `${where} の応答が途中で切れています。`);
  return payload.rows.map(([caller, callee]) => ({ caller, callee }));
}

const hasEdge = (rows, caller, callee) => rows.some((row) => row.caller === caller && row.callee === callee);
const internalEdges = (rows) => rows.filter((row) => NODE_IDS.includes(row.caller) && NODE_IDS.includes(row.callee));

function pair(stage, index, where) {
  const request = stage.request[index];
  const response = stage.response[index];
  check(request && response, `${where} の要求か応答がありません。`);
  return { request, response: response.response };
}

function findPair(stage, tool, phase, test = () => true) {
  const index = stage.request.findIndex((request) => request.tool === tool && (phase === null || request.phase === phase) && test(request));
  check(index >= 0, `${stage.id || "index"} に ${tool}（${phase || "全段階"}）の記録がありません。`);
  return pair(stage, index, `${tool}（${phase || ""}）`);
}

function buildModel(texts) {
  const runs = deepFreeze(parseJSON(texts["outputs/runs.json"], "outputs/runs.json"));
  const samples = deepFreeze(parseJSON(texts["samples.json"], "samples.json"));
  const order = parseJSON(texts["fixture/sample_order.json"], "fixture/sample_order.json");

  // 版・呼び方
  check(runs && runs.tool, "outputs/runs.json に tool がありません。");
  for (const key of Object.keys(TOOL)) check(runs.tool[key] === TOOL[key], `outputs/runs.json の tool.${key} が固定版と違います。`);
  check(runs.project === PROJECT, "outputs/runs.json のプロジェクト名が違います。");
  check(Array.isArray(runs.steps) && runs.steps.map((step) => step && step.id).join() === STEP_IDS.join(), "outputs/runs.json の steps が find・trace・update の3件ではありません。");
  const steps = Object.fromEntries(runs.steps.map((step) => [step.id, step]));

  // 18 回の要求と応答が1対1で並んでいる
  let calls = 0;
  for (const [name, stage] of [["index", runs.index], ...runs.steps.map((step) => [step.id, step])]) {
    check(stage && Array.isArray(stage.request) && Array.isArray(stage.response) && stage.request.length > 0 && stage.request.length === stage.response.length, `${name} の要求と応答の数が合いません。`);
    stage.request.forEach((request, i) => {
      const response = stage.response[i];
      check(
        request && response && typeof request.tool === "string" && request.tool === response.tool && request.phase === response.phase && request.args && typeof request.args === "object" && response.response && typeof response.response === "object",
        `${name} の ${i + 1} 件目の要求と応答が対応していません。`,
      );
      if (request.args.project !== undefined) check(request.args.project === PROJECT, `${name} の ${i + 1} 件目のプロジェクト名が違います。`);
    });
    calls += stage.request.length;
  }
  check(calls === 18, `記録された公式CLIの呼び出しが ${calls} 回です（18 回のはず）。`);

  // samples.json は runs.json の要求・応答そのもの
  check(samples && samples.format === "input-output" && Array.isArray(samples.samples), "samples.json の形式が input-output ではありません。");
  check(samples.samples.map((sample) => sample && sample.id).join() === STEP_IDS.join(), "samples.json の3件が find・trace・update ではありません。");
  for (const sample of samples.samples) {
    const step = steps[sample.id];
    check(sample.label === step.label && deepEqual(sample.input, step.request) && deepEqual(sample.output, step.response), `samples.json の ${sample.id} が outputs/runs.json の要求・応答と一致しません。`);
  }

  // ソースの写しと、架空リポジトリの実ファイル
  const base = runs.source_snapshots && runs.source_snapshots.base;
  const changed = runs.source_snapshots && runs.source_snapshots.changed;
  check(base && changed && runs.fixture && Array.isArray(runs.fixture.files), "outputs/runs.json にソースの写しがありません。");
  check(deepEqual(Object.keys(base).sort(), [...runs.fixture.files].sort()), "ソースの写しのファイル一覧が fixture と違います。");
  for (const path of Object.keys(base)) check(texts[path] === base[path], `${path} が outputs/runs.json のソースの写しと一致しません。`);
  check(runs.fixture.revision && runs.fixture.revision.source === "fixture/storage_revised.py" && runs.fixture.revision.replaces === "fixture/storage.py", "変更の記録が storage_revised.py → storage.py ではありません。");
  check(deepEqual(Object.keys(changed), ["fixture/storage.py"]) && changed["fixture/storage.py"] === texts["fixture/storage_revised.py"], "変更後の storage.py の写しが storage_revised.py と一致しません。");
  const baseLines = (path) => base[path].split("\n");
  const changedStorage = changed["fixture/storage.py"].split("\n");

  // 1. 探す
  const find = steps.find;
  const search = findPair(find, "search_graph", "探す");
  const snippetPair = findPair(find, "get_code_snippet", "探す");
  const snippet = snippetPair.response;
  check(search.request.args.name_pattern === `^${ENTRY}$` && search.request.args.label === "Function", "探すの search_graph の引数が違います。");
  check(search.response.total === 1 && search.response.returned === 1 && search.response.has_more === false && search.response.truncated === false, "探すの search_graph が1件の完全な応答ではありません。");
  const hits = decodeGrouped(search.response, "search_graph（探す）");
  check(hits.length === 1, "探すの search_graph の行が1件ではありません。");
  const hit = hits[0];
  check(hit.name === ENTRY && hit.label === "Function", "探すの search_graph が submit_order の関数を返していません。");
  const span = parseSpan(hit.lines, "search_graph（探す）");
  check(hit.qualified_name === snippet.qualified_name && snippet.qualified_name === find.facts.qualified_name, "qualified_name が search_graph・get_code_snippet・照合結果で一致しません。");
  check(snippetPair.request.args.qualified_name === hit.qualified_name, "get_code_snippet に渡した名前が search_graph の結果と違います。");
  check(span.start === snippet.start_line && span.end === snippet.end_line, "search_graph と get_code_snippet の行範囲が一致しません。");
  check(snippet.file_path === `fixture/${hit.file}` && find.facts.file === snippet.file_path, "search_graph と get_code_snippet のファイルが一致しません。");
  check(hit.in === snippet.callers && hit.out === snippet.callees, "search_graph の in/out と get_code_snippet の callers/callees が一致しません。");
  const service = baseLines(snippet.file_path);
  check(service[span.start - 1].startsWith(`def ${ENTRY}(`), `実ソースの ${span.start} 行目が def ${ENTRY} ではありません。`);
  check(find.facts.line === span.start && find.facts.source_def_line === span.start && find.facts.line_matches_source === true, "探すの照合結果の行が応答と違います。");
  const body = service.slice(span.start - 1, span.end).join("\n") + "\n";
  check(snippet.source === body && find.facts.snippet_text === body, "get_code_snippet の本文が実ソースの行と一致しません。");
  const bodyLines = body.replace(/\n$/, "").split("\n").filter((line) => line.trim() !== "");
  check(bodyLines.length === find.facts.snippet_lines && bodyLines.length === find.facts.snippet_lines_in_source, "本文の行数が照合結果と合いません。");
  const callExpressions = find.facts.call_expressions;
  check(Array.isArray(callExpressions) && callExpressions.length === hit.out, "submit_order の呼び出し式の数が out と合いません。");
  for (const call of callExpressions) {
    check(call.file === snippet.file_path && service[call.line - 1] !== undefined && service[call.line - 1].trim() === call.text, `${call.callee} の呼び出し式が実ソースの ${call.line} 行目と一致しません。`);
    check(call.text.includes(`${call.callee}(`) && call.line > span.start && call.line <= span.end, `${call.callee} の呼び出し式が submit_order の中にありません。`);
  }
  const app = baseLines("fixture/app.py");
  const mainDef = app.findIndex((line) => line.startsWith("def main(")) + 1;
  const mainCall = app.findIndex((line) => line.includes(`${ENTRY}(`)) + 1;
  check(mainDef > 0 && mainCall > mainDef, "app.py の main から submit_order を呼ぶ行が見つかりません。");

  // 2. たどる
  const trace = steps.trace;
  const query = findPair(trace, "query_graph", "たどる");
  check(query.request.args.query === CALL_QUERY, "たどるの query_graph の問い合わせが違います。");
  const traceRows = queryRows(query.response, "query_graph（たどる）");
  check(runs.calls_before && deepEqual(traceRows, runs.calls_before.rows), "たどるの query_graph の応答と初回の組が一致しません。");
  check(hasEdge(traceRows, "main", ENTRY) && trace.facts.main_calls_submit_order === true, "main → submit_order の組がありません。");
  const outgoing = traceRows.filter((row) => row.caller === ENTRY).map((row) => row.callee);
  check(outgoing.length === 3 && deepEqual(outgoing, trace.facts.callees_in_rows), "submit_order から出る組が3件の照合結果と一致しません。");
  check(deepEqual([...outgoing].sort(), callExpressions.map((call) => call.callee).sort()), "submit_order の呼び出し先と実ソースの呼び出し式が一致しません。");
  check(Array.isArray(trace.facts.required_edges) && trace.facts.required_edges.length === 3, "たどるの照合した辺が3件ではありません。");
  for (const edge of trace.facts.required_edges) {
    check(edge.caller === ENTRY && outgoing.includes(edge.callee), "たどるの照合した辺が応答にありません。");
    check(edge.source && service[edge.source.line - 1] && service[edge.source.line - 1].trim() === edge.source.text, `${edge.callee} の呼び出し行が実ソースと一致しません。`);
  }
  const tracePath = findPair(trace, "trace_path", "たどる");
  check(tracePath.request.args.function_name === ENTRY && tracePath.request.args.direction === "outbound", "たどるの trace_path の引数が違います。");
  check(tracePath.response.function === ENTRY && tracePath.response.direction === "outbound", "trace_path の応答が submit_order の outbound ではありません。");
  const reached = decodeGrouped(tracePath.response.callees, "trace_path（たどる）");
  check(reached.length === tracePath.response.callees_total && tracePath.response.callees_total_relation === "eq", "trace_path の件数が callees_total と合いません。");
  const hop1 = reached.filter((row) => row.hop === 1).map((row) => row.name).sort();
  check(deepEqual(hop1, [...outgoing].sort()), "trace_path の1段目が query_graph の3件と一致しません。");
  check(reached.some((row) => row.name === "OrderError" && row.hop === 2), "trace_path の2段目に OrderError がありません。");
  check(deepEqual([...trace.facts.trace_reached].sort(), hop1), "trace_path の照合結果が応答と一致しません。");

  // 呼び出し先の定義ファイルと行（trace_path の qn_prefix → 実ソース）
  const nodes = {
    main: { file: "fixture/app.py", def: mainDef },
    submit_order: { file: snippet.file_path, def: span.start, end: span.end },
  };
  for (const row of reached.filter((item) => item.hop === 1)) {
    check(row.qn_prefix.startsWith(`${PROJECT}.`), `${row.name} の qn_prefix がプロジェクトと違います。`);
    const file = `fixture/${row.qn_prefix.slice(PROJECT.length + 1).replace(/\./g, "/")}.py`;
    check(base[file] !== undefined, `${row.name} の定義ファイル ${file} がソースの写しにありません。`);
    const def = baseLines(file).findIndex((line) => line.startsWith(`def ${row.name}(`)) + 1;
    check(def > 0, `${file} に def ${row.name} が見つかりません。`);
    const call = callExpressions.find((item) => item.callee === row.name);
    nodes[row.name] = { file, def, callLine: call.line };
  }

  // 3. 更新する（初回・変更後・手で更新後）
  const update = steps.update;
  const facts = update.facts;
  const phaseData = {};
  for (const phase of PHASES) {
    const table = runs[phase.key];
    check(table && Array.isArray(table.rows) && table.row_count === table.rows.length && table.query === CALL_QUERY && table.limit === 100, `${phase.key} の組の記録が欠けています。`);
    check(table.rows.every((row) => row && typeof row.caller === "string" && typeof row.callee === "string"), `${phase.key} の組の形が違います。`);
    check(table.rows.length === phase.rows, `${phase.label} の組が ${table.rows.length} 件です（${phase.rows} 件のはず）。`);
    const internal = internalEdges(table.rows);
    check(internal.length === phase.internal, `${phase.label} で図に描く線が ${internal.length} 本です（${phase.internal} 本のはず）。`);
    phaseData[phase.id] = { ...phase, table, rows: table.rows, internal };
  }
  const preQuery = findPair(update, "query_graph", "再索引の前");
  const postQuery = findPair(update, "query_graph", "再索引の後");
  check(deepEqual(queryRows(preQuery.response, "query_graph（再索引の前）"), runs.calls_stale.rows), "再索引の前の query_graph と変更後の組が一致しません。");
  check(deepEqual(queryRows(postQuery.response, "query_graph（再索引の後）"), runs.calls_after.rows), "再索引の後の query_graph と手で更新後の組が一致しません。");
  const edge = facts.new_edge;
  check(edge && edge.caller === "save_receipt" && edge.callee === "audit_receipt", "新しい辺の記録が save_receipt → audit_receipt ではありません。");
  const present = PHASES.map((phase) => hasEdge(phaseData[phase.id].rows, edge.caller, edge.callee));
  check(deepEqual(present, [false, false, true]), "save_receipt → audit_receipt が手で更新後だけに現れる記録ではありません。");
  check(facts.edge_in_before === false && facts.edge_in_stale === false && facts.edge_in_after === true && facts.manual_reindex === true, "更新の照合結果が応答と合いません。");
  PHASES.forEach((phase, i) => (phaseData[phase.id].hasNewEdge = present[i]));

  const reindex = findPair(update, "index_repository", "手で再索引");
  check(reindex.request.args.repo_path === "fixture" && reindex.request.args.name === PROJECT && reindex.request.args.mode === "full", "手で再索引の引数が違います。");
  check(reindex.response.status === "indexed", "手で再索引の応答が indexed ではありません。");
  const firstIndex = findPair(runs.index, "index_repository", "初回の索引");
  check(firstIndex.response.status === "indexed", "初回の索引の応答が indexed ではありません。");

  // CLI の索引は監視されない（前後とも watched:false）
  const watches = [
    findPair(runs.index, "index_status", "初回の索引").response.watch,
    findPair(update, "index_status", "再索引の前").response.watch,
    findPair(update, "index_status", "再索引の後").response.watch,
    runs.index.facts && runs.index.facts.watch,
    facts.watch_before_reindex,
    facts.watch_after_reindex,
  ];
  check(watches.every((watch) => watch && watch.watched === false), "index_status の watch.watched が false ではありません。");

  // 変更後のソース
  check(!base["fixture/storage.py"].includes("audit_receipt"), "変更前の storage.py に audit_receipt があります。");
  const callExpr = facts.call_expression;
  check(callExpr && callExpr.file === "fixture/storage.py" && changedStorage[callExpr.line - 1] && changedStorage[callExpr.line - 1].trim() === callExpr.text && callExpr.text.startsWith(`${edge.callee}(`), "変更後の storage.py の呼び出し行が記録と一致しません。");
  const auditDef = changedStorage.findIndex((line) => line.startsWith(`def ${edge.callee}(`)) + 1;
  check(auditDef > 0 && facts.audit_receipt && facts.audit_receipt.line === auditDef && facts.audit_receipt.source_def_line === auditDef, "audit_receipt の定義行が実ソースと一致しません。");
  check(Array.isArray(facts.added_lines) && facts.added_lines.every((line) => changedStorage[line.line - 1] === line.text), "追加した行の記録が変更後のソースと一致しません。");
  const auditSearch = findPair(update, "search_graph", "再索引の後", (request) => request.args.name_pattern === "^audit_receipt$");
  const auditHits = decodeGrouped(auditSearch.response, "search_graph（audit_receipt）");
  check(auditHits.length === 1 && auditHits[0].name === edge.callee && auditHits[0].file === "storage.py", "再索引後の search_graph が audit_receipt を1件返していません。");
  const auditSpan = parseSpan(auditHits[0].lines, "search_graph（audit_receipt）");
  check(auditSpan.start === auditDef && auditHits[0].qualified_name === facts.audit_receipt.qualified_name, "再索引後の audit_receipt の行か名前が実ソースと一致しません。");
  const saveSearch = findPair(update, "search_graph", "再索引の後", (request) => request.args.name_pattern === "^save_receipt$");
  const saveHits = decodeGrouped(saveSearch.response, "search_graph（save_receipt）");
  check(saveHits.length === 1 && saveHits[0].name === edge.caller, "再索引後の search_graph が save_receipt を1件返していません。");
  const saveSpan = parseSpan(saveHits[0].lines, "search_graph（save_receipt）");
  const saveSnippet = findPair(update, "get_code_snippet", "再索引の後").response;
  const saveBody = changedStorage.slice(saveSpan.start - 1, saveSpan.end).join("\n") + "\n";
  check(saveSnippet.start_line === saveSpan.start && saveSnippet.end_line === saveSpan.end && saveSnippet.source === saveBody && facts.save_receipt_snippet_text === saveBody, "再索引後の save_receipt の本文が変更後のソースと一致しません。");
  check(facts.save_receipt && facts.save_receipt.line === saveSpan.start && callExpr.line > saveSpan.start && callExpr.line <= saveSpan.end, "新しい呼び出し行が save_receipt の中にありません。");
  const traceAfter = findPair(update, "trace_path", "再索引の後").response;
  const reachedAfter = decodeGrouped(traceAfter.callees, "trace_path（再索引の後）");
  check(reachedAfter.length === traceAfter.callees_total && reachedAfter.some((row) => row.name === edge.callee && row.hop === 2), "再索引後の trace_path に audit_receipt（2段目）がありません。");
  check(facts.trace_reached_after.every((name) => reachedAfter.some((row) => row.name === name)), "再索引後の trace_path の照合結果が応答と一致しません。");
  nodes.audit_receipt = { file: "fixture/storage.py", def: auditDef, callLine: callExpr.line, changed: true };

  // 別の証拠：Python で架空の注文を実行した結果（索引とは別）
  const execution = runs.fixture_execution;
  check(order && order.order_id === "WS-0001" && Number.isInteger(order.seat_count) && Number.isInteger(order.seat_price_jpy), "sample_order.json の形が違います。");
  const total = order.seat_count * order.seat_price_jpy;
  check(total === 2400, `架空の注文の合計が ${total} 円です（2,400 円のはず）。`);
  const receiptName = `receipt-${order.order_id}.json`;
  const auditName = `audit-${order.order_id}.json`;
  for (const kind of ["base", "revised"]) {
    const run = execution && execution[kind];
    check(run && run.exit_code === 0 && run.files && run.files[receiptName], `fixture_execution.${kind} の領収JSONがありません。`);
    const receipt = run.files[receiptName];
    check(
      receipt.order_id === order.order_id && receipt.workshop === order.workshop && receipt.seat_count === order.seat_count && receipt.seat_price_jpy === order.seat_price_jpy && receipt.total_jpy === total && deepEqual(run.stdout, receipt),
      `fixture_execution.${kind} の領収が注文と合いません。`,
    );
  }
  check(!execution.base.files[auditName], "変更前の実行に監査JSONがあります。");
  const audit = execution.revised.files[auditName];
  check(audit && audit.consistent === true && audit.recomputed_total_jpy === total && audit.saved_total_jpy === total && audit.receipt_file === receiptName, "変更後の実行の監査JSONが一致していません。");

  check(texts["request.txt"].includes(TOOL.commit) && texts["request.txt"].includes("v0.12.0"), "request.txt に固定版がありません。");

  return {
    runs,
    samples,
    texts,
    steps,
    calls,
    nodes,
    phaseData,
    order,
    total,
    find: { hit, span, snippet, callExpressions, mainCall },
    trace: { rows: traceRows, outgoing, reached },
    update: { edge, callLine: callExpr.line, auditDef, saveSpan, reachedAfter },
    indexedAt: [findPair(runs.index, "index_status", "初回の索引").response.indexed_at, findPair(update, "index_status", "再索引の後").response.indexed_at],
  };
}

/* ---------- 図の配置（スマホ縦と横長で別に組む） ---------- */

const LAYOUTS = {
  tall: {
    view: [360, 452],
    fileSize: [60, 62],
    files: [[12, 22], [81, 22], [150, 22], [219, 22], [288, 22]],
    srcLabel: [12, 14],
    srcTag: [348, 14, "end"],
    bridge: { x: 12, y: 96, w: 296, h: 30, vertical: false, knob: [330, 111, 15] },
    map: { x: 4, y: 136, w: 352, h: 276 },
    mapTitle: [344, 156],
    mapSub: [344, 170],
    mapTag: [16, 384],
    count: [16, 401],
    nodes: {
      main: [180, 200, 150, 34],
      submit_order: [180, 256, 190, 40],
      validate_order: [64, 330, 108, 46],
      calculate_total: [180, 330, 108, 46],
      save_receipt: [296, 330, 108, 46],
      audit_receipt: [296, 388, 108, 34],
    },
    font: { role: 12.5, fn: 9.5, small: 9 },
    sheet: { w: 84, h: 30, before: [270, 6, -6], stale: [270, 46, -6], after: [222, 96, 0] },
    stop: [254, 104],
    pin: "M111 84 C111 132 22 140 22 196 S48 256 85 256",
    pinLabel: [30, 236],
    tray: { x: 196, y: 420, w: 160, h: 28 },
    trayLink: "M296 412 L296 420",
    bridgeLinks: ["M100 126 L100 136", "M180 126 L180 136", "M260 126 L260 136"],
  },
  wide: {
    view: [640, 360],
    fileSize: [92, 48],
    files: [[8, 34], [8, 96], [8, 158], [8, 220], [8, 282]],
    srcLabel: [8, 24],
    srcTag: [8, 350, "start"],
    bridge: { x: 112, y: 34, w: 30, h: 262, vertical: true, knob: [127, 316, 15] },
    map: { x: 154, y: 8, w: 340, h: 344 },
    mapTitle: [484, 28],
    mapSub: [484, 42],
    mapTag: [166, 324],
    count: [166, 341],
    nodes: {
      main: [324, 72, 150, 34],
      submit_order: [324, 132, 180, 38],
      validate_order: [216, 212, 100, 46],
      calculate_total: [324, 212, 100, 46],
      save_receipt: [432, 212, 100, 46],
      audit_receipt: [432, 292, 100, 34],
    },
    font: { role: 12.5, fn: 9, small: 9 },
    sheet: { w: 84, h: 28, before: [12, 262, -5], stale: [12, 300, -5], after: [86, 252, 0] },
    stop: [110, 276],
    pin: "M100 120 C150 120 170 132 234 132",
    pinLabel: [150, 116],
    tray: { x: 502, y: 160, w: 134, h: 60 },
    trayLink: "M494 190 L502 190",
    bridgeLinks: ["M142 80 L154 80", "M142 165 L154 165", "M142 250 L154 250"],
  },
};

const pickLayout = () => (window.matchMedia("(min-width: 560px)").matches ? "wide" : "tall");

function fileShape(x, y, w, h) {
  const ear = Math.min(14, w * 0.22);
  return `M${x} ${y + 4} Q${x} ${y} ${x + 4} ${y} L${x + w - ear} ${y} L${x + w} ${y + ear} L${x + w} ${y + h - 4} Q${x + w} ${y + h} ${x + w - 4} ${y + h} L${x + 4} ${y + h} Q${x} ${y + h} ${x} ${y + h - 4} Z`;
}

function codeBars(text, x, y, w, maxBars) {
  // 実ファイルの空でない行の長さを、そのまま細い線の長さにする
  const lines = text.split("\n").filter((line) => line.trim() !== "").slice(0, maxBars);
  const longest = Math.max(...lines.map((line) => line.length), 1);
  return lines.map((line, i) => {
    const indent = Math.min(line.length - line.trimStart().length, 8) / 8;
    const x0 = x + indent * w * 0.18;
    const len = Math.max(4, (line.trim().length / longest) * (w - (x0 - x)));
    return svg("line", { className: "bar", x1: x0, y1: y + i * 4, x2: x0 + len, y2: y + i * 4 });
  });
}

function buildDiagram(model, layoutId) {
  const L = LAYOUTS[layoutId];
  const root = document.getElementById("diagram");
  const [vw, vh] = L.view;
  root.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
  root.dataset.layout = layoutId;
  const keep = [document.getElementById("diagram-title"), document.getElementById("diagram-desc")];
  root.replaceChildren(...keep);

  const defs = svg(
    "defs",
    {},
    svg("pattern", { id: "dots", width: 12, height: 12, patternUnits: "userSpaceOnUse" }, svg("circle", { cx: 2, cy: 2, r: 0.9, className: "dot" })),
    svg("marker", { id: "arrow", viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, svg("path", { d: "M0 0 L8 4 L0 8 Z", className: "arrow-head" })),
    svg("marker", { id: "arrow-hot", viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, svg("path", { d: "M0 0 L8 4 L0 8 Z", className: "arrow-head arrow-head--hot" })),
  );
  root.append(defs);

  // コードの束
  const [fw, fh] = L.fileSize;
  root.append(svg("text", { className: "zone-label", x: L.srcLabel[0], y: L.srcLabel[1], text: "コード" }));
  root.append(svg("text", { id: "tag-source", className: "tag-text", x: L.srcTag[0], y: L.srcTag[1], "text-anchor": L.srcTag[2] }));
  const filesGroup = svg("g", { className: "files" });
  SOURCE_FILES.forEach((path, i) => {
    const [x, y] = L.files[i];
    const name = shortFile(path);
    const stem = name.replace(/\.py$/, "");
    const g = svg("g", { className: "file", "data-file": path });
    g.append(svg("path", { className: "file-body", d: fileShape(x, y, fw, fh) }));
    if (layoutId === "tall") {
      g.append(svg("g", { className: "bars" }, codeBars(model.texts[path], x + 7, y + 10, fw - 14, 7)));
      g.append(svg("text", { className: "file-name", x: x + fw / 2, y: y + fh - 8, "text-anchor": "middle", text: stem }));
    } else {
      g.append(svg("g", { className: "bars" }, codeBars(model.texts[path], x + 7, y + 9, 26, 7)));
      g.append(svg("text", { className: "file-name", x: x + 38, y: y + fh / 2 + 3, text: stem }));
    }
    g.append(svg("text", { className: "file-ext", x: x + fw - 4, y: y + fh - (layoutId === "tall" ? 20 : 8), "text-anchor": "end", text: ".py" }));
    filesGroup.append(g);
    // コード → 索引の橋
    const link = L.bridge.vertical ? `M${x + fw} ${y + fh / 2} L${L.bridge.x} ${y + fh / 2}` : `M${x + fw / 2} ${y + fh} L${x + fw / 2} ${L.bridge.y}`;
    filesGroup.append(svg("path", { className: "feed", "data-file": path, d: link }));
  });
  root.append(filesGroup);

  // 手で回す索引の橋
  const b = L.bridge;
  const bridge = svg("g", { className: "bridge", id: "bridge" });
  bridge.append(svg("rect", { className: "bridge-body", x: b.x, y: b.y, width: b.w, height: b.h, rx: (b.vertical ? b.w : b.h) / 2 }));
  if (b.vertical) {
    ["索", "引"].forEach((ch, i) => bridge.append(svg("text", { className: "bridge-label", x: b.x + b.w / 2, y: b.y + b.h / 2 - 6 + i * 16, "text-anchor": "middle", text: ch })));
  } else {
    bridge.append(svg("text", { className: "bridge-label", x: b.x + b.w / 2 - 62, y: b.y + b.h / 2 + 4.5, "text-anchor": "middle", text: "索引" }));
    bridge.append(svg("text", { className: "bridge-mono", x: b.x + b.w / 2 - 30, y: b.y + b.h / 2 + 3, text: "index_repository" }));
  }
  const [kx, ky, kr] = b.knob;
  bridge.append(svg("circle", { className: "knob", cx: kx, cy: ky, r: kr }));
  bridge.append(svg("path", { className: "knob-arm", d: `M${kx} ${ky} L${kx + kr * 0.62} ${ky - kr * 0.62}` }));
  bridge.append(svg("circle", { className: "knob-grip", cx: kx + kr * 0.62, cy: ky - kr * 0.62, r: 2.6 }));
  bridge.append(svg("text", { className: "knob-label", x: b.vertical ? kx + kr + 4 : kx, y: b.vertical ? ky + 3 : ky + kr + 10, "text-anchor": b.vertical ? "start" : "middle", text: "手で" }));
  for (const d of L.bridgeLinks) bridge.append(svg("path", { className: "feed feed--map", d }));
  root.append(bridge);

  // 呼び出しの地図
  const m = L.map;
  root.append(svg("rect", { className: "map-body", x: m.x, y: m.y, width: m.w, height: m.h, rx: 16 }));
  root.append(svg("rect", { className: "map-dots", x: m.x, y: m.y, width: m.w, height: m.h, rx: 16, fill: "url(#dots)" }));
  root.append(svg("text", { className: "map-title", x: L.mapTitle[0], y: L.mapTitle[1], "text-anchor": "end", text: "呼び出しの地図" }));
  root.append(svg("text", { className: "map-sub", x: L.mapSub[0], y: L.mapSub[1], "text-anchor": "end", text: "線＝静的な呼び出し（実行順ではない）" }));
  root.append(svg("text", { id: "tag-map", className: "tag-text", x: L.mapTag[0], y: L.mapTag[1] }));
  root.append(svg("text", { id: "count", className: "count-text", x: L.count[0], y: L.count[1] }));

  // 線（3時点の内部の組をすべて用意し、選んだ時点の組にあるものだけ表示する）
  const rect = (id) => {
    const [cx, cy, w, h] = L.nodes[id];
    return { cx, cy, w, h, top: cy - h / 2, bottom: cy + h / 2, left: cx - w / 2, right: cx + w / 2 };
  };
  const union = [];
  for (const phase of PHASES) for (const row of model.phaseData[phase.id].internal) if (!union.some((e) => e.caller === row.caller && e.callee === row.callee)) union.push(row);
  const edges = svg("g", { className: "edges" });
  const labels = svg("g", { className: "edge-labels" });
  for (const row of union) {
    const a = rect(row.caller);
    const z = rect(row.callee);
    const sameColumn = Math.abs(a.cx - z.cx) < 1;
    const d = sameColumn
      ? `M${a.cx} ${a.bottom} L${z.cx} ${z.top - 2}`
      : `M${a.cx} ${a.bottom} C${a.cx} ${a.bottom + (z.top - a.bottom) * 0.55} ${z.cx} ${z.top - (z.top - a.bottom) * 0.55} ${z.cx} ${z.top - 2}`;
    edges.append(svg("path", { className: "edge", "data-from": row.caller, "data-to": row.callee, d, "marker-end": "url(#arrow)" }));
    let label = "";
    let lx = z.cx;
    let ly = z.top - 5;
    let anchor = "middle";
    if (row.caller === "main") {
      label = `${shortFile(model.nodes.main.file)} ${model.find.mainCall}行`;
      lx = a.cx + 8;
      ly = (a.bottom + z.top) / 2 + 3;
      anchor = "start";
    } else if (row.caller === ENTRY) {
      label = `${model.nodes[row.callee].callLine}行`;
    } else if (row.callee === model.update.edge.callee) {
      label = `${model.update.callLine}行`;
      lx = a.cx - 8;
      ly = (a.bottom + z.top) / 2 + 3;
      anchor = "end";
    }
    if (label) labels.append(svg("text", { className: "edge-label", "data-from": row.caller, "data-to": row.callee, x: lx, y: ly, "text-anchor": anchor, text: label }));
  }
  root.append(edges, labels);

  // 関数のカード
  const nodeGroup = svg("g", { className: "nodes" });
  for (const id of NODE_IDS) {
    const r = rect(id);
    const g = svg("g", { className: "node", "data-node": id });
    g.append(svg("rect", { className: "node-body", x: r.left, y: r.top, width: r.w, height: r.h, rx: 9 }));
    g.append(svg("text", { className: "node-role", x: r.cx, y: r.cy - (r.h > 40 ? 3 : 1), "text-anchor": "middle", "font-size": L.font.role, text: ROLE[id] }));
    g.append(svg("text", { className: "node-fn", x: r.cx, y: r.cy + (r.h > 40 ? 12 : 11), "text-anchor": "middle", "font-size": L.font.fn, text: id }));
    nodeGroup.append(g);
  }
  root.append(nodeGroup);

  // 探す：見つけた場所（service.py の定義行）への印
  const def = model.find.span.start;
  root.append(svg("path", { className: "pin", d: L.pin }));
  root.append(svg("text", { className: "pin-label", x: L.pinLabel[0], y: L.pinLabel[1], text: `${def}行目` }));

  // 変更の印（変更した storage.py の写し）と、未反映の止め
  const s = L.sheet;
  const sheet = svg("g", { className: "sheet", id: "sheet" });
  sheet.append(svg("rect", { className: "sheet-body", x: 0, y: 0, width: s.w, height: s.h, rx: 4 }));
  sheet.append(svg("text", { className: "sheet-fn", x: s.w / 2, y: 12, "text-anchor": "middle", text: `+${model.update.edge.callee}` }));
  sheet.append(svg("text", { className: "sheet-line", x: s.w / 2, y: s.h - 6, "text-anchor": "middle", text: `${model.update.callLine}行に追加` }));
  root.append(sheet);
  const stop = svg("g", { className: "stop", id: "stop" });
  stop.append(svg("rect", { className: "stop-body", x: L.stop[0], y: L.stop[1], width: 44, height: 15, rx: 7.5 }));
  stop.append(svg("text", { className: "stop-text", x: L.stop[0] + 22, y: L.stop[1] + 11, "text-anchor": "middle", text: "未反映" }));
  root.append(stop);

  // 保存先
  const t = L.tray;
  const tray = svg("g", { className: "tray", id: "tray" });
  tray.append(svg("path", { className: "tray-link", d: L.trayLink }));
  tray.append(svg("rect", { className: "tray-body", x: t.x, y: t.y, width: t.w, height: t.h, rx: 8 }));
  const icon = layoutId === "tall" ? [t.x + 8, t.y + 5] : [t.x + 10, t.y + 10];
  tray.append(svg("path", { className: "tray-doc", d: fileShape(icon[0], icon[1], 14, 18) }));
  tray.append(svg("text", { className: "tray-title", x: icon[0] + 20, y: icon[1] + (layoutId === "tall" ? 8 : 9), text: "実際の記録" }));
  tray.append(svg("text", { id: "tray-name", className: "tray-name", x: layoutId === "tall" ? icon[0] + 20 : t.x + 10, y: layoutId === "tall" ? icon[1] + 18 : t.y + 46 }));
  root.append(tray);
}

/* ---------- 状態 ---------- */

const state = { model: null, step: DEFAULT_STEP, phase: DEFAULT_PHASE, layout: null, ready: false };
const ops = [...document.querySelectorAll(".op")];
const phaseButtons = [...document.querySelectorAll(".phase")];
const phasesGroup = document.getElementById("phases");
const phaseNote = document.getElementById("phase-note");
const capRole = document.getElementById("cap-role");
const capWhere = document.getElementById("cap-where");
const downloadButton = document.getElementById("download-record");
const downloadNameNode = document.getElementById("download-name");
const saveStatus = document.getElementById("save-status");
const diagramStatus = document.getElementById("diagram-status");
const diagram = document.getElementById("diagram");
const diagramDesc = document.getElementById("diagram-desc");
const loadErrorBox = document.getElementById("load-error");
const loadErrorText = document.getElementById("load-error-text");
const verified = document.getElementById("verified");
const copyButton = document.getElementById("copy-request");
const copyStatus = document.getElementById("copy-status");
const requestArea = document.getElementById("request-text");

function hashStep() {
  let id = "";
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return null;
  }
  return STEP_IDS.includes(id) ? id : null;
}

function currentPhase() {
  return state.step === "update" ? state.phase : "before";
}

function sourceTag(phase) {
  if (phase === "before") return { text: "コード：変更前", tone: "plain" };
  return { text: "コード：変更後（storage.py）", tone: "warn" };
}

function mapTag(phase) {
  if (phase === "before") return { text: "地図：初回の索引", tone: "plain" };
  if (phase === "stale") return { text: "地図：初回のまま（未更新）", tone: "warn" };
  return { text: "地図：手で更新後 ✓", tone: "ok" };
}

function setSheet(phase) {
  const L = LAYOUTS[state.layout];
  const [x, y, rot] = L.sheet[phase];
  const sheet = document.getElementById("sheet");
  if (sheet) sheet.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
}

function applyState() {
  const model = state.model;
  if (!model) return;
  const phase = currentPhase();
  const data = model.phaseData[phase];
  diagram.dataset.step = state.step;
  diagram.dataset.phase = phase;
  diagram.dataset.state = "ready";

  // 線と新しいカードは、選んだ時点の実際の組にあるものだけ
  for (const path of diagram.querySelectorAll(".edge, .edge-label")) {
    path.classList.toggle("is-indexed", hasEdge(data.internal, path.dataset.from, path.dataset.to));
  }
  for (const path of diagram.querySelectorAll(".edge")) {
    const hot = state.step === "trace" && path.dataset.from === ENTRY;
    path.setAttribute("marker-end", hot ? "url(#arrow-hot)" : "url(#arrow)");
  }
  const auditNode = diagram.querySelector('.node[data-node="audit_receipt"]');
  if (auditNode) auditNode.classList.toggle("is-indexed", data.internal.some((row) => row.callee === "audit_receipt" || row.caller === "audit_receipt"));

  const src = sourceTag(phase);
  const map = mapTag(phase);
  const tagSource = document.getElementById("tag-source");
  const tagMap = document.getElementById("tag-map");
  tagSource.textContent = src.text;
  tagSource.dataset.tone = src.tone;
  tagMap.textContent = map.text;
  tagMap.dataset.tone = map.tone;
  document.getElementById("count").textContent = `描いた線 ${data.internal.length}本 · 全${data.rows.length}件`;
  document.getElementById("tray-name").textContent = downloadName(state.step);
  setSheet(phase);

  for (const button of ops) {
    const on = button.dataset.step === state.step;
    button.setAttribute("aria-pressed", String(on));
  }
  phasesGroup.hidden = state.step !== "update";
  phaseNote.hidden = state.step === "update";
  for (const button of phaseButtons) button.setAttribute("aria-pressed", String(button.dataset.phase === state.phase));
  phaseNote.textContent = "地図：初回の索引（この操作は変更前の記録）";

  const caption = captionFor(model, state.step, phase);
  capRole.textContent = caption.role;
  capWhere.replaceChildren(...caption.where);
  diagramDesc.textContent = caption.desc;
  downloadNameNode.textContent = downloadName(state.step);
  downloadButton.setAttribute("aria-label", `この記録を保存：${downloadName(state.step)}（${STEP_NAME[state.step]}の保存済みの実行）`);
  renderRecord(model, state.step, phase);
}

function link(path, text) {
  return el("a", { href: path, text: text || shortFile(path) });
}

function captionFor(model, step, phase) {
  const f = model.find;
  const svc = model.nodes.submit_order;
  if (step === "find") {
    return {
      role: `「${ROLE[ENTRY]}」は ${ENTRY}`,
      where: [link(svc.file), ` ${f.span.start}–${f.span.end}行 · 定義 ${f.span.start}行目は実ソースと一致`],
      desc: `探す：search_graph が返した ${ENTRY} は ${shortFile(svc.file)} の ${f.span.start}〜${f.span.end} 行。実ソースの ${f.span.start} 行目の def と一致。`,
    };
  }
  if (step === "trace") {
    const lines = model.trace.outgoing.map((name) => model.nodes[name].callLine).join("・");
    return {
      role: `${ENTRY} から直接の呼び出し 3つ`,
      where: [link(svc.file), ` ${lines}行 · 静的な関係で、実行の順番ではない`],
      desc: `たどる：${ENTRY} は ${model.trace.outgoing.join("、")} の3つを直接呼ぶ（${shortFile(svc.file)} ${lines} 行）。並んだ3本は静的な呼び出しで、実行順ではない。main は app.py ${f.mainCall} 行で ${ENTRY} を呼ぶ。`,
    };
  }
  const e = model.update.edge;
  const data = model.phaseData[phase];
  if (phase === "before") {
    return {
      role: "初回の地図：保存の先は線なし",
      where: [link("fixture/storage.py"), ` 変更前 · CALLS 全${data.rows.length}件`],
      desc: `更新する・初回：変更前のコードで索引した地図。${e.caller} から先の線はない。CALLS は全 ${data.rows.length} 件。`,
    };
  }
  if (phase === "stale") {
    return {
      role: "コードは変わったが、地図は古いまま",
      where: [link("fixture/storage_revised.py", "storage.py（変更後）"), ` ${model.update.callLine}行に ${e.callee} · 地図は未反映（全${data.rows.length}件）`],
      desc: `更新する・変更後・未更新：storage.py の ${model.update.callLine} 行に ${e.callee} の呼び出しを加えたが、CLI の索引は監視されないため地図は初回のまま（全 ${data.rows.length} 件）。`,
    };
  }
  return {
    role: "手で索引し直すと、新しい線",
    where: [`${e.caller} → ${e.callee} · `, link("fixture/storage_revised.py", "storage.py"), ` ${model.update.callLine}行・定義 ${model.update.auditDef}行 · 全${data.rows.length}件`],
    desc: `更新する・手で更新後：index_repository を手でやり直した後、${e.caller} → ${e.callee} が地図に現れた（storage.py ${model.update.callLine} 行・定義 ${model.update.auditDef} 行）。CALLS は全 ${data.rows.length} 件。`,
  };
}

/* ---------- 折りたたみ：選んだ記録の中身 ---------- */

function rawPre(value, label) {
  return el("pre", { className: "raw-pre", tabindex: "0", "aria-label": label }, el("code", { text: typeof value === "string" ? value : pretty(value) }));
}

function sourceList(text, marks, label) {
  const list = el("ol", { className: "src", "aria-label": label });
  String(text)
    .replace(/\n$/, "")
    .split("\n")
    .forEach((line, i) => {
      const mark = marks.get(i + 1);
      list.append(el("li", { className: mark ? `is-${mark.tone}` : null }, el("code", { text: line || " " }), mark ? el("span", { className: "src-tag", text: mark.label }) : null));
    });
  return el("div", { className: "src-wrap", tabindex: "0", role: "region", "aria-label": label }, list);
}

function rowsList(rows, highlight) {
  return el(
    "ul",
    { className: "pairs" },
    rows.map((row) => el("li", { className: highlight(row) ? "is-hit" : null }, code(row.caller), el("span", { className: "pair-arrow", "aria-label": "が呼ぶ", text: "→" }), code(row.callee))),
  );
}

function callBlocks(step) {
  return step.request.map((request, i) =>
    el(
      "div",
      { className: "call" },
      el("h4", { className: "call-h" }, `${i + 1}. `, code(request.tool), `（${request.phase}）`),
      el("details", { className: "sub" }, el("summary", { text: "要求の引数" }), rawPre(request.args, `${request.tool} の要求`)),
      el("details", { className: "sub" }, el("summary", { text: "実際の応答" }), rawPre(step.response[i].response, `${request.tool} の応答`)),
    ),
  );
}

function renderRecord(model, stepId, phase) {
  const step = model.steps[stepId];
  const body = document.getElementById("record-body");
  const parts = [
    el("p", { className: "fold-lede" }, el("strong", { text: step.label }), `。公式CLIへの要求 ${step.request.length} 回と、実行ファイルが返した応答そのものです。保存ボタンはこの記録（runs.json の steps の1件）を加工せずに書き出します。`),
  ];
  if (stepId === "find") {
    const f = model.find;
    const marks = new Map([[f.span.start, { tone: "def", label: "定義" }]]);
    for (const call of f.callExpressions) marks.set(call.line, { tone: "call", label: `${call.callee} を呼ぶ` });
    parts.push(
      el("h3", { className: "fold-h", text: "まとめた応答を読み解いた結果（cols / groups / qn_rule）" }),
      el(
        "dl",
        { className: "kv" },
        el("div", {}, el("dt", { text: "qualified_name" }), el("dd", {}, el("code", { className: "break", text: f.hit.qualified_name }))),
        el("div", {}, el("dt", { text: "ファイル・行" }), el("dd", {}, link(model.nodes.submit_order.file), ` ${f.span.start}–${f.span.end}行（in ${f.hit.in} / out ${f.hit.out}）`)),
        el("div", {}, el("dt", { text: "実ソースとの照合" }), el("dd", { text: `def は ${f.span.start} 行目で一致。本文 ${step.facts.snippet_lines} 行のうち ${step.facts.snippet_lines_in_source} 行が実ソースと同じ` })),
      ),
      el("h3", { className: "fold-h" }, "実ソース ", link(model.nodes.submit_order.file)),
      sourceList(model.runs.source_snapshots.base[model.nodes.submit_order.file], marks, "service.py の実ソース"),
      el("h3", { className: "fold-h" }, code("get_code_snippet"), " が返した本文"),
      rawPre(f.snippet.source, "get_code_snippet の本文"),
    );
  } else if (stepId === "trace") {
    const rows = model.trace.rows;
    const marks = new Map(model.find.callExpressions.map((call) => [call.line, { tone: "call", label: `${call.callee} を呼ぶ` }]));
    parts.push(
      el("h3", { className: "fold-h", text: `query_graph が返した CALLS の組（全${rows.length}件）` }),
      el("p", { className: "note", text: `図には関数どうしの ${model.phaseData.before.internal.length} 本を描き、print と OrderError への組はここにだけ残しています。` }),
      rowsList(rows, (row) => row.caller === ENTRY),
      el("h3", { className: "fold-h", text: `trace_path（outbound・深さ ${step.request.find((request) => request.tool === "trace_path").args.depth}）が返した関数` }),
      el("ul", { className: "pairs" }, model.trace.reached.map((row) => el("li", {}, code(row.name), ` ${row.hop}段目 · `, el("code", { className: "break", text: row.qualified_name })))),
      el("p", { className: "note note--strong", text: "索引に記録された静的な呼び出し関係です。実行時に記録したトレースではありません。辺がないことは、呼ばれないことの証明ではありません。" }),
      el("h3", { className: "fold-h" }, "呼び出し式のある実ソース ", link(model.nodes.submit_order.file)),
      sourceList(model.runs.source_snapshots.base[model.nodes.submit_order.file], marks, "service.py の実ソース"),
    );
  } else {
    const data = model.phaseData[phase];
    const e = model.update.edge;
    const changedMarks = new Map(step.facts.added_lines.map((line) => [line.line, { tone: "add", label: "追加" }]));
    changedMarks.set(model.update.callLine, { tone: "call", label: "新しい呼び出し" });
    changedMarks.set(model.update.auditDef, { tone: "def", label: "定義" });
    parts.push(
      el("h3", { className: "fold-h", text: `いま図に出している時点：${data.label}（CALLS 全${data.rows.length}件）` }),
      el("p", { className: "note", text: `${e.caller} → ${e.callee}：${data.hasNewEdge ? "あり" : "なし"}。段階の切り替えは保存済みの3時点を見比べるだけで、新しいツール呼び出しはしていません。` }),
      rowsList(data.rows, (row) => row.caller === e.caller && row.callee === e.callee),
      el("h3", { className: "fold-h" }, "変更後の ", code("storage.py"), "（", link("fixture/storage_revised.py", "storage_revised.py"), " を実行用コピーにだけ差し替え）"),
      sourceList(model.runs.source_snapshots.changed["fixture/storage.py"], changedMarks, "変更後の storage.py"),
      el("details", { className: "sub" }, el("summary", { text: "変更前の storage.py" }), sourceList(model.runs.source_snapshots.base["fixture/storage.py"], new Map(), "変更前の storage.py")),
      el("p", { className: "note note--strong", text: "CLI で作った索引は監視されません（index_status の watch.watched は前後とも false）。ファイルを変えただけでは地図は古いままで、index_repository を手でやり直して初めて新しい線が現れます。" }),
    );
  }
  parts.push(el("h3", { className: "fold-h", text: `要求と応答（${step.request.length}回分・そのまま）` }), ...callBlocks(step));
  body.replaceChildren(...parts);
}

/* ---------- 折りたたみ：全データ・別の実行・原本・根拠 ---------- */

function renderStaticFolds(model) {
  const e = model.update.edge;
  document.getElementById("phases-body").replaceChildren(
    el("p", { className: "fold-lede", text: `同じ問い合わせ（${CALL_QUERY}）を3つの時点で実行した結果です。` }),
    ...PHASES.map((phase) => {
      const data = model.phaseData[phase.id];
      return el(
        "div",
        { className: "phase-block" },
        el("h3", { className: "fold-h" }, `${phase.label}（${data.table.phase}）`, el("span", { className: "pill", text: `全${data.rows.length}件 · ${e.callee} ${data.hasNewEdge ? "あり" : "なし"}` })),
        rowsList(data.rows, (row) => row.caller === e.caller && row.callee === e.callee),
      );
    }),
  );

  const fx = model.runs.fixture_execution;
  const block = (title, run) =>
    el(
      "div",
      { className: "python-block" },
      el("h3", { className: "fold-h", text: title }),
      el("p", { className: "note" }, "コマンド：", code(run.command.join(" ")), `（終了コード ${run.exit_code}）`),
      Object.entries(run.files).map(([name, data]) => el("div", { className: "py-file" }, el("p", { className: "py-name" }, code(name)), rawPre(data, name))),
    );
  document.getElementById("python-body").replaceChildren(
    el("p", { className: "fold-lede", text: `索引とは別に、実行用コピーの app.py を Python で実際に動かした記録です。架空の注文（${model.order.seat_count}席 × ${model.order.seat_price_jpy.toLocaleString("ja-JP")}円）で、領収の合計は変更前・変更後とも ${model.total.toLocaleString("ja-JP")}円、変更後の監査は consistent: true でした。図の線（静的な呼び出し）を実行の流れとして描いたものではありません。決済・予約・通知はしていません。` }),
    block("変更前のコピーで実行", fx.base),
    block("変更後のコピーで実行", fx.revised),
  );

  document.getElementById("samples-body").replaceChildren(
    el("p", { className: "fold-lede" }, link("samples.json"), " の原文です（", `${model.samples.samples.length}件`, "・runs.json の要求と応答に一致することを確かめ済み）。"),
    rawPre(model.texts["samples.json"], "samples.json の原文"),
  );

  const tool = model.runs.tool;
  const index = model.runs.index;
  document.getElementById("evidence-body").replaceChildren(
    el(
      "dl",
      { className: "kv" },
      el("div", {}, el("dt", { text: "使った版" }), el("dd", {}, code(tool.version), ` · ${tool.release} · `, el("code", { className: "break", text: tool.commit }))),
      el("div", {}, el("dt", { text: "呼び方" }), el("dd", {}, code(tool.transport), " · ", code(model.runs.cli.command))),
      el("div", {}, el("dt", { text: "呼び出し回数" }), el("dd", { text: `公式ネイティブCLIで ${model.calls} 回（索引 ${index.request.length}・探す ${model.steps.find.request.length}・たどる ${model.steps.trace.request.length}・更新 ${model.steps.update.request.length}）。各ツール1回ずつ` })),
      el("div", {}, el("dt", { text: "索引の時刻" }), el("dd", { text: `初回 ${model.indexedAt[0]} · 手で再索引 ${model.indexedAt[1]}（index_status の indexed_at）` })),
      el("div", {}, el("dt", { text: "範囲" }), el("dd", { text: model.runs.scope_note })),
      el("div", {}, el("dt", { text: "このページ" }), el("dd", { text: "保存済みの実行結果を読むだけです。いま索引・検索・再実行はしていません。MCPプロトコル、CBM Lens、ブラウザAI、意味検索、速さ・トークン量・品質は試していません。" })),
    ),
    el("h3", { className: "fold-h", text: `初回の索引（${index.request.length}回分・そのまま）` }),
    ...callBlocks(index),
    el("h3", { className: "fold-h", text: "CLI の環境（公開用に置き換え済み）" }),
    rawPre(model.runs.cli, "CLI の環境"),
    el("p", { className: "aside" }, "以前の確認記録（28秒版の画面と動画の確認・履歴）：", link("verification.json", "verification.json"), "。この新しい図と32秒の動画の確認ではありません。"),
  );

  requestArea.value = model.texts["request.txt"];
  document.getElementById("result-body").textContent = model.texts["outputs/result.md"];
}

function clearFolds(message) {
  for (const id of ["record-body", "phases-body", "python-body", "samples-body", "evidence-body"]) {
    document.getElementById(id).replaceChildren(el("p", { className: "fold-wait", text: message }));
  }
  document.getElementById("result-body").textContent = "";
  requestArea.value = "";
}

/* ---------- 選択 ---------- */

function setControlsEnabled(on) {
  for (const button of [...ops, ...phaseButtons, downloadButton, copyButton]) button.disabled = !on;
}

function selectStep(id, { updateHash = false, focus = null } = {}) {
  if (!state.ready) return;
  if (id !== state.step) {
    state.step = id;
    if (id === "update") state.phase = DEFAULT_PHASE;
    saveStatus.textContent = "";
  }
  if (updateHash && location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
  applyState();
  if (focus) focus.focus();
}

function selectPhase(id) {
  if (!state.ready || state.step !== "update") return;
  state.phase = id;
  applyState();
}

document.getElementById("ops").addEventListener("click", (event) => {
  const button = event.target.closest(".op");
  if (button && !button.disabled) selectStep(button.dataset.step, { updateHash: true });
});

function arrowNav(buttons, event, onPick) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const index = buttons.indexOf(document.activeElement);
  if (index < 0) return;
  const last = buttons.length - 1;
  const moves = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last };
  if (!(event.key in moves)) return;
  event.preventDefault();
  const target = buttons[moves[event.key]];
  if (target.disabled) return;
  target.focus();
  onPick(target);
}

document.getElementById("ops").addEventListener("keydown", (event) => arrowNav(ops, event, (button) => selectStep(button.dataset.step, { updateHash: true })));
phasesGroup.addEventListener("click", (event) => {
  const button = event.target.closest(".phase");
  if (button && !button.disabled) selectPhase(button.dataset.phase);
});
phasesGroup.addEventListener("keydown", (event) => arrowNav(phaseButtons, event, (button) => selectPhase(button.dataset.phase)));

window.addEventListener("hashchange", () => {
  if (!state.ready) return; // 読み込みが終わってから、そのときの hash を使う
  selectStep(hashStep() || DEFAULT_STEP);
});

const layoutQuery = window.matchMedia("(min-width: 560px)");
layoutQuery.addEventListener("change", () => {
  if (!state.ready) return;
  state.layout = pickLayout();
  buildDiagram(state.model, state.layout);
  applyState();
});

/* ---------- 保存 ---------- */

downloadButton.addEventListener("click", () => {
  if (!state.ready) return;
  const step = state.model.steps[state.step];
  const name = downloadName(state.step);
  const text = JSON.stringify(step, null, 2) + "\n";
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = el("a", { href: url, download: name, hidden: true });
  document.body.append(anchor);
  try {
    anchor.click();
    saveStatus.className = "save-status";
    saveStatus.textContent = `${name}（${blob.size.toLocaleString("ja-JP")} バイト）の保存をブラウザに依頼しました。保存されたかはブラウザのダウンロード表示で確かめてください。`;
  } catch {
    saveStatus.className = "save-status is-error";
    saveStatus.textContent = "保存を依頼できませんでした。下の「記録の原本」から outputs/runs.json を保存してください。";
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
});

/* ---------- 依頼文のコピー ---------- */

function selectRequest() {
  const fold = document.getElementById("fold-request");
  fold.open = true;
  requestArea.focus();
  requestArea.setSelectionRange(0, requestArea.value.length);
}

copyButton.addEventListener("click", async () => {
  if (!state.ready) return;
  const text = state.model.texts["request.txt"];
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) {
    selectRequest();
    try {
      copied = document.execCommand("copy") === true;
    } catch {
      copied = false;
    }
  }
  if (copied) {
    copyStatus.className = "copy-status";
    copyStatus.textContent = "コピーを依頼しました（ブラウザが完了を返しました）。";
  } else {
    selectRequest();
    copyStatus.className = "copy-status is-error";
    copyStatus.textContent = "自動でコピーできませんでした。依頼文を選択したので、長押しして「コピー」を選ぶか、Ctrl+C（Mac は ⌘C）でコピーしてください。";
  }
});

/* ---------- 読み込み（失敗したら閉じる） ---------- */

let generation = 0;
let controller = null;

function showLoading() {
  state.ready = false;
  state.model = null;
  setControlsEnabled(false);
  loadErrorBox.hidden = true;
  diagram.replaceChildren(document.getElementById("diagram-title"), diagramDesc);
  diagram.dataset.state = "loading";
  diagramDesc.textContent = "保存済みの記録を確かめています。";
  diagramStatus.hidden = false;
  diagramStatus.className = "diagram-status";
  diagramStatus.textContent = "保存済みの記録（11ファイル）を確かめています…";
  capRole.textContent = "読み込み中";
  capWhere.replaceChildren();
  verified.textContent = "";
  saveStatus.textContent = "";
  copyStatus.textContent = "";
  clearFolds("記録を確かめてから表示します。");
}

function showFailure(error) {
  state.ready = false;
  state.model = null;
  setControlsEnabled(false);
  diagram.replaceChildren(document.getElementById("diagram-title"), diagramDesc);
  diagram.dataset.state = "error";
  diagramDesc.textContent = "記録を確かめられなかったため、図を表示していません。";
  diagramStatus.hidden = false;
  diagramStatus.className = "diagram-status is-error";
  diagramStatus.textContent = "図を表示していません";
  capRole.textContent = "記録を確かめられませんでした";
  capWhere.replaceChildren();
  verified.textContent = "";
  phasesGroup.hidden = true;
  phaseNote.hidden = false;
  phaseNote.textContent = "操作は使えません";
  loadErrorText.textContent = error instanceof LoadError ? error.message : `記録の読み込み中に問題が起きました（${error && error.message ? error.message : String(error)}）。`;
  loadErrorBox.hidden = false;
  clearFolds("記録を確かめられなかったため、表示していません。");
}

function start() {
  const mine = ++generation;
  if (controller) controller.abort();
  controller = new AbortController();
  showLoading();
  loadAll(controller.signal)
    .then((model) => {
      if (mine !== generation) return;
      state.model = model;
      state.ready = true;
      state.layout = pickLayout();
      state.step = hashStep() || DEFAULT_STEP;
      state.phase = DEFAULT_PHASE;
      buildDiagram(model, state.layout);
      renderStaticFolds(model);
      setControlsEnabled(true);
      diagramStatus.hidden = true;
      verified.textContent = `11ファイルの長さと SHA-256、18回分の要求・応答の対応を確かめました · ${model.runs.tool.version}`;
      applyState();
    })
    .catch((error) => {
      if (mine !== generation || (error && error.name === "AbortError")) return;
      showFailure(error);
    });
}

document.getElementById("retry").addEventListener("click", start);
start();
