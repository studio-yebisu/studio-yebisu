/*
 * Studio Yebisu — Mem0 作例・動く概念図（32秒・無音）
 * Copyright (c) 2026 Studio Yebisu. MIT License. Diagram and film authored by Claude Opus 5.5.
 *
 * One connected drawing: two fictional people → preference tokens → one persistent store with two scoped
 * sections → a query/filter route → the actually retrieved tokens. Every token, count, ID and change is
 * read from the saved original run (assets/memory-run.json) after the manifest and all seven assets
 * match their pinned SHA-256 and byte counts. No audio, no narration, no live inference.
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
  const POSTER_TIME = 16;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: [] };

  // --- Frozen expectations --------------------------------------------------------------------

  const MANIFEST = {
    path: "assets/manifest.json",
    sha256: "10c7aed7d3f649f2522823957529e8f7a45c3e2b36777a2a3d1cf352d1c9fdca",
    format: "studio-yebisu-visual-assets-v1",
  };
  // Same order and values as the manifest. Paths are relative to video/assets/.
  const ASSETS = [
    { file: "memory-run.json", sha256: "a2ef19d1461611c28b56824a21f30839dd45210fe285c40695624ee4447750dc", bytes: 54026, source: "outputs/memory-run.json" },
    { file: "memories.json", sha256: "ef9f585026e5cb4e5c0f32fa02af0117ede2dd2d7b0b5d9a4fb6fe87386c161c", bytes: 2107, source: "input/memories.json" },
    { file: "scenarios.json", sha256: "ec089d59c70d1442313fe797349acbbbb9999e7ec6ba2c04131df02bf8a2acdb", bytes: 2263, source: "input/scenarios.json" },
    { file: "model-source.json", sha256: "4e51d6fc32c2b93c5c5dfdad32bc870ebeb379548ea87e90cd50bd10f5fcd9af", bytes: 2255, source: "input/model-source.json" },
    { file: "vendor-lock.json", sha256: "5d9c8621c664d589a4be8d9b13cadd25370811ad1e5967409cd1e9feb83a1e94", bytes: 16677, source: "vendor-lock.json" },
    { file: "samples.json", sha256: "4beebb4570b6266bebf29f1c12c96b3e1a02d36e3cdb1b51feac3c19d6be9e6c", bytes: 57929, source: "samples.json" },
    { file: "timeline.json", sha256: "6f7fe7e5d9bb10728a5a31c86a80587561179163ecde3bddab0f044a0dc1ed4e", bytes: 1979, source: "independent visual timeline based on saved runtime" },
  ];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.file, a.sha256]));
  const PIN = {
    format: "studio-yebisu-mem0-run-v1",
    repository: "mem0ai/mem0",
    commit: "0724291bd864cf807e88ee8981c8226644e8fb42",
    version: "2.2.1",
    license: "Apache-2.0",
    sourceFiles: 156,
    modelRepository: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    modelCommit: "e8f8c211226b894fcb81acc59f3b34ba3efd5f42",
    dimensions: 384,
    modelFiles: 11,
    ids: ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"],
    timelineFormat: "studio-yebisu-mem0-visual-timeline-v1",
  };
  // Scene timing is fixed in timeline.json; `read` is where the scene buttons land.
  const SCENE_PLAN = [
    { id: "store", in: 0, out: 5, case: "M01", headline: "好みを、別々に保存", read: 4.2 },
    { id: "search", in: 5, out: 11, case: "M02", compare: "M03", headline: "同じ問い、違う好み", read: 7.6 },
    { id: "update", in: 11, out: 17, case: "M05", headline: "20秒から、30秒へ", read: 16.0 },
    { id: "delete", in: 17, out: 22, case: "M06", headline: "仮の予定を、一覧から外す", read: 21.2 },
    { id: "reopen", in: 22, out: 28, case: "M07", headline: "開き直しても、30秒", read: 27.2 },
    { id: "finish", in: 28, out: 32, case: "M07", headline: "覚えて、引き出す", read: 31.5, last: true },
  ];
  const COMPARE_AT = 8.1; // inside the search scene: the same query, now for ken (record M03)
  const FILE_MESSAGE = "このページをファイルとして直接開くと、素材を読み込んで照合できません。作例のフォルダー（index.html のある場所）で python -m http.server を実行し、http://localhost:8000/video/ を開いてください。";

  const USERS = { aya: "あや", ken: "けん" };
  const KEYS = { aya: ["A01", "A02", "A03", "A04"], ken: ["K01", "K02", "K03"] };
  // Picture headings for the stored sentences; each must match the actual stored text.
  const SHORT = {
    A01: { mark: "短い段落", text: "短い段落" },
    A02: { mark: "音声なし", prefix: "無音", suffix: "秒" },
    A03: { mark: "JSON", text: "JSON保存" },
    A04: { mark: "仮の打ち合わせ", text: "仮の予定" },
    K01: { mark: "図と詳しい説明", text: "図と詳細" },
    K02: { mark: "ナレーション付き", prefix: "語り", suffix: "秒" },
    K03: { mark: "実装コード", text: "コード取得" },
  };
  const QUERY_SHORT = { "説明を見せるとき、どんな見せ方が好み？": "見せ方は？", "作例動画の長さと音声は？": "動画は？" };
  const TOPIC_SHORT = { video: "動画" };
  const EVENT_JA = { ADD: "追加", UPDATE: "更新", DELETE: "削除" };

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

  // --- Layouts (authored natively for each orientation) ------------------------------------

  function portraitLayout() {
    const sec = { aya: { x: 54, y: 426, w: 298, h: 420 }, ken: { x: 368, y: 426, w: 298, h: 420 } };
    return {
      DW: 720, DH: 1280, tall: true,
      eyebrow: { x: 48, y: 64, size: 22 },
      badge: { x: 672, y: 64, size: 24 },
      title: { x: 48, y: 142, size: 56, min: 40, max: 624 },
      person: { aya: { x: 96, y: 236, lx: 140, ly: 251, align: "left" }, ken: { x: 624, y: 236, lx: 580, ly: 251, align: "right" }, size: 42, k: 1.8 },
      inflow: { aya: [[96, 282], [26, 322], [26, 610], [48, 610]], ken: [[624, 282], [694, 322], [694, 610], [672, 610]] },
      bubble: { cx: 360, cy: 236, w: 260, h: 76, size: 36 },
      connector: [[360, 274], [360, 303]],
      funnel: { cx: 360, cy: 324, k: 1.6, lx: 396, ly: 340, size: 38, max: 280 },
      route: { aya: [[360, 346], [360, 370], [300, 398], [300, 424]], ken: [[360, 346], [360, 370], [460, 398], [460, 424]] },
      tab: { x: 40, y: 370, h: 42, size: 32 },
      store: { x: 40, y: 412, w: 640, h: 448 },
      sec,
      token: { w: 282, h: 80, size: 40, min: 26, stack: false },
      slot: (user, i) => ({ x: sec[user].x + 8, y: sec[user].y + 14 + i * 94 }),
      count: { w: 96, h: 44, size: 28, at: (user) => ({ cx: sec[user].x + sec[user].w - 56, cy: sec[user].y + sec[user].h }) },
      drawer: { x: 40, y: 878, w: 640, h: 92, tx: 60, ty: 936, size: 30, slot: { x: 136, y: 884, k: 1 }, lx: 438, ly: [916, 952], lsize: 24, lmax: 236 },
      tray: { tx: 48, ty: 1016, size: 36, slots: [{ x: 40, y: 1030 }, { x: 262, y: 1030 }, { x: 484, y: 1030 }], w: 196, h: 92, label: 36, min: 24, msg: { x: 48, y: 1094, size: 40, max: 624 } },
      overlay: { x: 360, y: 650, size: 44 },
      cta: { cx: 360, cy: 1166, w: 520, h: 64, size: 30 },
      foot: { y: 1246, size: 20, x1: 48, x2: 672 },
    };
  }

  function landscapeLayout() {
    const sec = { aya: { x: 242, y: 240, w: 676, h: 116 }, ken: { x: 242, y: 364, w: 676, h: 116 } };
    return {
      DW: 1280, DH: 720, tall: false,
      eyebrow: { x: 64, y: 52, size: 19 },
      badge: { x: 1216, y: 52, size: 22 },
      title: { x: 64, y: 114, size: 50, min: 34, max: 860 },
      person: { aya: { x: 160, y: 292, lx: 118, ly: 306, align: "right" }, ken: { x: 160, y: 416, lx: 118, ly: 430, align: "right" }, size: 36, k: 1.6 },
      inflow: { aya: [[194, 298], [230, 298]], ken: [[194, 422], [230, 422]] },
      bubble: { cx: 600, cy: 176, w: 260, h: 64, size: 32 },
      connector: [[730, 176], [770, 176]],
      funnel: { cx: 780, cy: 176, k: 1.4, lx: 810, ly: 188, size: 34, max: 170 },
      route: { aya: [[780, 196], [780, 238]], ken: [[780, 196], [780, 212], [955, 212], [955, 422], [932, 422]] },
      tab: { x: 230, y: 190, h: 40, size: 30 },
      store: { x: 230, y: 230, w: 700, h: 260 },
      sec,
      token: { w: 158, h: 88, size: 34, min: 24, stack: true },
      slot: (user, i) => ({ x: sec[user].x + 10 + i * 166, y: sec[user].y + 12 }),
      count: { w: 72, h: 36, size: 24, at: (user) => ({ cx: sec[user].x + sec[user].w - 40, cy: sec[user].y + sec[user].h }) },
      drawer: { x: 230, y: 504, w: 700, h: 80, tx: 250, ty: 554, size: 30, slot: { x: 330, y: 510, k: 0.75 }, lx: 470, ly: [536, 568], lsize: 24, lmax: 440 },
      tray: { tx: 1000, ty: 262, size: 32, slots: [{ x: 1000, y: 280 }, { x: 1000, y: 384 }, { x: 1000, y: 488 }], w: 224, h: 88, label: 34, min: 24, msg: { x: 1000, y: 330, size: 30, max: 240 } },
      overlay: { x: 580, y: 372, size: 44 },
      cta: { cx: 1112, cy: 630, w: 240, h: 60, size: 24 },
      foot: { y: 698, size: 18, x1: 64, x2: 1216 },
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
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const HEX64 = /^[0-9a-f]{64}$/;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const int = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    if (isObject(a) && isObject(b)) {
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((k) => own(b, k) && deepEqual(a[k], b[k]));
    }
    return false;
  }

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
    ui.assetList.replaceChildren(...ASSETS.map((asset) => {
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
      size.textContent = `${int(asset.bytes)} バイト ・ ${asset.source}`;
      li.append(name, " ", verdict, " ", size);
      return li;
    }));
  }

  // The original run record: the same pins and checks the example page enforces.
  function verifyRecord(run) {
    check(run.format === PIN.format, "memory-run.json の形式が違います。");
    const src = isObject(run.source) ? run.source : {};
    check(src.repository === PIN.repository && src.commit === PIN.commit && src.version === PIN.version && src.license === PIN.license
      && src.files_verified === PIN.sourceFiles && src.vendor_lock_sha256 === SHA["vendor-lock.json"],
    "memory-run.json の Mem0 の固定版・原典156ファイル・ロックが一致しません。");
    const model = isObject(run.model) ? run.model : {};
    check(model.repository === PIN.modelRepository && model.commit === PIN.modelCommit && model.dimensions === PIN.dimensions
      && model.device === "cpu" && model.files_verified === PIN.modelFiles && model.weights_published === false,
    "memory-run.json の埋め込みモデルの固定版（384次元・CPU）が一致しません。");
    const config = isObject(run.config) ? run.config : {};
    check(config.infer === false && config.telemetry === false && config.network_blocked === true, "memory-run.json の設定（infer=False・通信拒否）が一致しません。");
    const net = isObject(run.network) ? run.network : {};
    check(net.total_attempts === 0 && Array.isArray(net.parent_attempts) && net.parent_attempts.length === 0
      && Array.isArray(net.worker_attempts) && net.worker_attempts.length === 0, "実行中の通信の試みが0件ではありません。");
    const checks = isObject(run.checks) ? run.checks : {};
    check(checks.passed === true && checks.network_attempts === 0 && checks.llm_calls === 0 && checks.source_files_verified === PIN.sourceFiles
      && checks.inputs_verified === 3 && checks.model_files_verified === PIN.modelFiles, "memory-run.json の確認（合格・通信0・LLM 0回）がそろっていません。");
    check(isObject(run.worker) && run.worker.exit_code === 0 && run.worker.fresh_process === true, "別プロセスでの読み直しの記録がありません。");
    const sums = isObject(run.input_sha256) ? run.input_sha256 : {};
    check(sums["input/memories.json"] === SHA["memories.json"] && sums["input/scenarios.json"] === SHA["scenarios.json"]
      && sums["input/model-source.json"] === SHA["model-source.json"], "記録が参照する入力3件の SHA-256 が素材と一致しません。");
    const samples = run.samples;
    check(Array.isArray(samples) && samples.length === PIN.ids.length && samples.every((s, i) => isObject(s) && s.id === PIN.ids[i])
      && new Set(samples.map((s) => s.id)).size === PIN.ids.length, "memory-run.json が M01〜M08 の8件（重複なし）ではありません。");
    return Object.fromEntries(samples.map((s) => [s.id, s]));
  }

  function durationOf(text, key) {
    const found = typeof text === "string" ? text.match(/(\d+)秒/) : null;
    check(found, `${key} の本文に秒数がありません。`);
    return found[1];
  }

  function headingOf(key, text) {
    const spec = SHORT[key];
    check(spec && typeof text === "string" && text.includes(spec.mark), `${key} の本文が図の見出しと対応しません。`);
    return spec.text || `${spec.prefix}${durationOf(text, key)}${spec.suffix}`;
  }

  function keyOf(item, ids, what) {
    check(isObject(item) && isObject(item.metadata) && own(ids, item.metadata.source_key) && ids[item.metadata.source_key] === item.id,
      `${what} の ID が M01 で保存した ID と一致しません。`);
    return item.metadata.source_key;
  }

  function activeFrom(getAll, ids, what) {
    check(isObject(getAll), `${what} の一覧がありません。`);
    const active = {};
    for (const user of ["aya", "ken"]) {
      const rows = getAll[user] && getAll[user].response && getAll[user].response.results;
      check(Array.isArray(rows), `${what} の ${user} の一覧がありません。`);
      for (const item of rows) {
        const key = keyOf(item, ids, what);
        check(item.user_id === user && KEYS[user].includes(key) && !own(active, key), `${what} の一覧の利用者または重複が想定と違います。`);
        active[key] = item.memory;
      }
    }
    return active;
  }

  const countsOf = (active) => ({ aya: KEYS.aya.filter((k) => own(active, k)).length, ken: KEYS.ken.filter((k) => own(active, k)).length });

  function resultsFrom(response, ids, filters, what) {
    check(isObject(response) && Array.isArray(response.results), `${what} の results がありません。`);
    return response.results.map((item) => {
      const key = keyOf(item, ids, what);
      check(item.user_id === filters.user_id && (!filters.topic || item.metadata.topic === filters.topic), `${what} の結果が絞り込みの外です。`);
      return { key, text: item.memory };
    });
  }

  function eventsOf(rows, id, expected, what) {
    check(Array.isArray(rows) && rows.every((r) => isObject(r) && r.memory_id === id) && deepEqual(rows.map((r) => r.event), expected),
      `${what} の履歴が ${expected.join("・")} になっていません。`);
    return rows.map((r) => r.event);
  }

  function filterLabel(filters) {
    check(isObject(filters) && own(USERS, filters.user_id), "絞り込みの利用者が想定と違います。");
    if (!filters.topic) return `${USERS[filters.user_id]}だけ`;
    check(own(TOPIC_SHORT, filters.topic), "絞り込みの topic が想定と違います。");
    return `${USERS[filters.user_id]}＋${TOPIC_SHORT[filters.topic]}`;
  }

  function shortQuery(query) {
    check(own(QUERY_SHORT, query), "検索の問いが想定と違います。");
    return QUERY_SHORT[query];
  }

  // What the film draws, all taken from the verified record. Anything unexpected stops the film.
  function sceneFacts(s) {
    const ids = s.M01.output && s.M01.output.memory_ids;
    check(isObject(ids) && Object.keys(ids).length === 7 && Object.values(ids).every((v) => UUID.test(v)), "M01 の ID の対応がありません。");
    const stored = activeFrom(s.M01.output.get_all, ids, "M01");
    const storedCounts = countsOf(stored);
    check(deepEqual(storedCounts, { aya: 4, ken: 3 }), "M01 が aya 4件・ken 3件になっていません。");
    const labels = {};
    for (const key of [...KEYS.aya, ...KEYS.ken]) labels[key] = headingOf(key, stored[key]);

    const search = (id) => {
      const call = s[id].input && s[id].input.call;
      check(isObject(call), `${id} の検索条件がありません。`);
      const out = resultsFrom(s[id].output.response, ids, call.filters, id);
      check(out.length > 0 && out.every((o) => stored[o.key] === o.text) && deepEqual(out.map((o) => o.key), s[id].output.result_keys),
        `${id} の結果が保存した本文と一致しません。`);
      return { query: shortQuery(call.query), filter: filterLabel(call.filters), user: call.filters.user_id, hits: out.map((o) => ({ key: o.key, label: labels[o.key] })) };
    };
    const m02 = search("M02");
    const m03 = search("M03");
    check(m02.query === m03.query && m02.user === "aya" && m03.user === "ken", "M02 と M03 が同じ問いの aya と ken になっていません。");
    const ayaIds = new Set(m02.hits.map((h) => ids[h.key]));
    check(m03.hits.every((h) => !ayaIds.has(ids[h.key])), "M02 と M03 の結果に同じ ID があります。");

    const m05 = s.M05;
    const before = m05.output.before;
    const after = m05.output.after;
    check(m05.input.memory_id === ids.A02 && before.id === ids.A02 && after.id === ids.A02 && before.memory === stored.A02
      && after.memory === m05.input.update_call.text && after.memory !== before.memory, "M05 が「同じ ID のまま本文の置き換え」になっていません。");
    const h05 = eventsOf(m05.output.history, ids.A02, ["ADD", "UPDATE"], "M05");
    const out05 = resultsFrom(m05.output.search_response, ids, m05.input.search_call.filters, "M05");
    check(out05.length === 1 && out05[0].key === "A02" && out05[0].text === after.memory, "M05 の検索が更新後の本文を返していません。");

    const m06 = s.M06;
    check(m06.input.memory_id === ids.A04 && m06.output.before.memory === stored.A04 && m06.output.after === null, "M06 の削除の前後が想定と違います。");
    const active06 = activeFrom(m06.output.get_all, ids, "M06");
    check(!own(active06, "A04") && active06.A02 === after.memory, "M06 の一覧に A04 が残っているか、A02 が更新後になっていません。");
    const h06 = eventsOf(m06.output.history, ids.A04, ["ADD", "DELETE"], "M06");
    check(m06.output.history[1].old_memory === stored.A04, "M06 の履歴に削除前の本文が残っていません。");

    const m07 = s.M07;
    check(m07.output.worker && m07.output.worker.exit_code === 0 && m07.output.worker.process_is_new === true, "M07 が新しいプロセスの記録になっていません。");
    const active07 = activeFrom(m07.output.get_all, ids, "M07");
    check(!own(active07, "A04") && active07.A02 === after.memory && m07.output.get_updated.id === ids.A02
      && m07.output.get_updated.memory === after.memory && m07.output.get_deleted === null, "M07 の開き直しで更新・削除が残っていません。");
    check(deepEqual(eventsOf(m07.output.history_updated, ids.A02, ["ADD", "UPDATE"], "M07 A02"), h05)
      && deepEqual(eventsOf(m07.output.history_deleted, ids.A04, ["ADD", "DELETE"], "M07 A04"), h06), "M07 の履歴が M05・M06 と一致しません。");
    const out07 = resultsFrom(m07.output.search_response, ids, m07.input.search_call.filters, "M07");
    check(out07.length === 1 && out07[0].key === "A02" && out07[0].text === after.memory, "M07 の検索が30秒の本文を返していません。");

    const spec = SHORT.A02;
    const from = durationOf(before.memory, "A02");
    const to = durationOf(after.memory, "A02");
    return {
      labels,
      m02, m03,
      update: {
        id: ids.A02, idShort: `${ids.A02.slice(0, 8)}…`, from, to, prefix: spec.prefix, suffix: spec.suffix,
        afterLabel: headingOf("A02", after.memory), query: shortQuery(m05.input.search_call.query), filter: filterLabel(m05.input.search_call.filters),
      },
      reopen: { query: shortQuery(m07.input.search_call.query), filter: filterLabel(m07.input.search_call.filters) },
      removed: "A04",
      counts: { stored: storedCounts, deleted: countsOf(active06), reopened: countsOf(active07) },
      history: { A02: h05, A04: h06 },
    };
  }

  function verify(j) {
    const run = j["memory-run.json"];
    const mem = j["memories.json"];
    const sc = j["scenarios.json"];
    const ms = j["model-source.json"];
    const lock = j["vendor-lock.json"];
    const samples = j["samples.json"];
    const timeline = j["timeline.json"];
    [run, mem, sc, ms, lock, samples, timeline].forEach((value) => check(isObject(value), "素材の JSON の形が想定と違います。"));

    const s = verifyRecord(run);

    // Inputs frozen before the run.
    check(mem.fictional === true && Array.isArray(mem.memories) && mem.memories.length === 7 && Array.isArray(s.M01.input.calls)
      && mem.memories.every((row, i) => {
        const call = s.M01.input.calls[i];
        return isObject(call) && call.key === row.key && call.messages === row.text && call.user_id === row.user_id
          && deepEqual(call.metadata, row.metadata) && call.infer === false;
      }), "memories.json の架空の7件が、記録の保存の呼び出しと一致しません。");
    check(Array.isArray(sc.scenarios) && sc.scenarios.length === PIN.ids.length && sc.scenarios.every((x, i) => isObject(x) && x.id === PIN.ids[i]
      && x.label === s[x.id].label && x.operation === s[x.id].operation), "scenarios.json の8場面が記録と一致しません。");
    check(ms.repository === PIN.modelRepository && ms.commit === PIN.modelCommit, "model-source.json の固定版が一致しません。");

    // The lock the record verified: same commit, 156 files.
    const files = isObject(lock.files_sha256) ? Object.entries(lock.files_sha256) : [];
    check(lock.repository === PIN.repository && lock.commit === PIN.commit && lock.license === PIN.license
      && files.length === PIN.sourceFiles && files.every(([path, sum]) => path.length > 0 && HEX64.test(sum)),
    "vendor-lock.json の固定版・156ファイルが一致しません。");

    // samples.json carries the same original records, byte-for-byte as values.
    check(samples.format === "input-output" && Array.isArray(samples.samples) && samples.samples.length === PIN.ids.length
      && samples.samples.every((x, i) => isObject(x) && x.id === PIN.ids[i] && x.label === s[x.id].label && x.demo_hash === `#${x.id}`
        && deepEqual(x.record, run.samples[i])), "samples.json の8件が実行記録と一致しません。");

    // Timeline frozen for this film.
    check(timeline.format === PIN.timelineFormat && timeline.silent === true && timeline.duration === DURATION && timeline.fps === 30
      && timeline.frames === DURATION * 30 && Array.isArray(timeline.scenes) && timeline.scenes.length === SCENE_PLAN.length,
    "timeline.json（32秒・30fps・960フレーム・無音・6場面）が一致しません。");
    SCENE_PLAN.forEach((plan, i) => {
      const x = timeline.scenes[i];
      check(isObject(x) && x.id === plan.id && x.in === plan.in && x.out === plan.out && x.case === plan.case && x.headline === plan.headline
        && (plan.compare ? x.compare_case === plan.compare : !own(x, "compare_case")), `timeline.json の場面 ${plan.id} が一致しません。`);
    });

    return sceneFacts(s);
  }

  // --- Fonts -----------------------------------------------------------------------------------

  const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", YuGothic, "Noto Sans JP", Meiryo, system-ui, sans-serif';
  const font = (size, weight = 700) => `${weight} ${size}px ${SANS}`;

  async function loadFonts() {
    if (!document.fonts || typeof document.fonts.load !== "function") return;
    const sample = "MEM0 OSS ・ 架空の2人の好み 記録 好みを、別々に保存 同じ問い、違う好み 20秒から、30秒へ 仮の予定を、一覧から外す 開き直しても、30秒 覚えて、引き出す あや けん 保存先 同じ保存先 履歴 引き出した 7件を保存 見せ方は？ 動画は？ IDで更新 IDで削除 別プロセス だけ ＋ 短い段落 無音 語り 秒 JSON保存 仮の予定 図と詳細 コード取得 一覧の外 のまま 追加 更新 削除 → 件 閉じる 別プロセスで開く get なし 記録をJSONで保存 保存済みの実行結果をもとにした図 無音 STUDIO YEBISU A01 K03 0123456789 c29f6400… ×";
    const specs = [font(56, 800), font(50, 800), font(44, 800), font(42, 800), font(36, 800), font(34, 800), font(32, 800), font(30, 800), font(28, 800), font(24, 700), font(22, 700), font(20, 600), font(17, 800), font(16, 700)];
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
    check(isObject(manifest) && manifest.format === MANIFEST.format && Array.isArray(manifest.assets) && manifest.assets.length === ASSETS.length
      && ASSETS.every((a, i) => isObject(manifest.assets[i]) && manifest.assets[i].file === a.file && manifest.assets[i].sha256 === a.sha256
        && manifest.assets[i].bytes === a.bytes && manifest.assets[i].source === a.source),
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
    for (const asset of ASSETS) json[asset.file] = parseJson(bytes[asset.file], asset.file);
    let facts;
    try {
      facts = verify(json);
    } catch (error) {
      if (error instanceof CheckError) throw error;
      throw new CheckError(`素材の形が想定と違います（${error && error.message ? error.message : "不明"}）。`);
    }
    await loadFonts();
    return facts;
  }

  // --- Time helpers (every value derives from t) ----------------------------------------------

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const fadeIn = (t, a, b) => ease(ramp(t, a, b));
  const fadeOut = (t, a, b) => 1 - ramp(t, a, b);
  const pulse = (t, at, len = 0.5) => Math.sin(Math.PI * ramp(t, at, at + len));
  const window01 = (t, a, b, f = 0.3) => fadeIn(t, a, a + f) * (b === Infinity ? 1 : fadeOut(t, b, b + f));

  // Picture beats inside the frozen scenes.
  const FLY = { A01: 0.5, A02: 1.05, A03: 1.6, A04: 2.15, K01: 0.75, K02: 1.3, K03: 1.85 };
  const FLY_LEN = 0.9;
  const T = {
    storedMsgA: 3.4, storedMsgB: 5.0,
    updLift: 11.5, updMorphA: 12.6, updMorphB: 13.3, updHist: 13.6,
    delMark: 17.4, delMoveA: 18.0, delMoveB: 19.3, delCount: 19.1, delHist: 19.4, delMsgA: 19.8, delMsgB: 22.0,
    closeA: 22.3, closeB: 22.9, spinA: 22.9, spinB: 24.0, openA: 23.8, openB: 24.4, sameTab: 23.3, keepTag: 26.2, countPulse: 26.2,
    ctaA: 28.5,
  };

  // --- Drawing helpers ------------------------------------------------------------------------

  const C = {
    ivory: "#f7f3ea", paper: "#fffdf8", ink: "#1f2430", muted: "#5b6070", rule: "#ddd5c4",
    aya: "#0f7a70", ayaWash: "#dcefea", ken: "#6a4fc6", kenWash: "#ebe5fa",
    warm: "#d9692a", warmWash: "#fbe2cf", warmDeep: "#9c4416",
  };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  function mix(a, b, k) {
    const A = rgb(a);
    const B = rgb(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp01(k)))).join(",")})`;
  }

  let film = null;

  function rr(x, y, w, h, r) {
    const q = Math.max(0, Math.min(r, w / 2, h / 2));
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

  function fitSize(str, max, size, min, weight) {
    let s = size;
    ctx.font = font(s, weight);
    while (s > min && ctx.measureText(str).width > max) {
      s -= 1;
      ctx.font = font(s, weight);
    }
    return s;
  }

  // One line of text; shrinks to fit `max` down to `min`.
  function text(str, x, y, o = {}) {
    const weight = o.weight || 700;
    const size = o.max ? fitSize(str, o.max, o.size || 24, o.min || o.size || 24, weight) : o.size || 24;
    ctx.font = font(size, weight);
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = "alphabetic";
    if (o.spacing && "letterSpacing" in ctx) ctx.letterSpacing = o.spacing;
    ctx.fillStyle = o.color || C.ink;
    ctx.fillText(str, x, y);
    const width = ctx.measureText(str).width;
    if (o.spacing && "letterSpacing" in ctx) ctx.letterSpacing = "0px";
    return width;
  }

  function withAlpha(alpha, fn) {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, alpha);
    fn();
    ctx.restore();
  }

  function polyline(points, progress = 1) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      segs.push(len);
      total += len;
    }
    let left = total * clamp01(progress);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    let end = points[0];
    let dir = [0, 1];
    for (let i = 1; i < points.length && left > 0; i++) {
      const k = Math.min(1, left / segs[i - 1]);
      const a = points[i - 1];
      const b = points[i];
      end = [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
      dir = [b[0] - a[0], b[1] - a[1]];
      ctx.lineTo(end[0], end[1]);
      left -= segs[i - 1];
    }
    return { end, dir };
  }

  function arrow(points, color, width, progress = 1, alpha = 1) {
    withAlpha(alpha, () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const { end, dir } = polyline(points, progress);
      ctx.stroke();
      if (progress > 0.05) {
        const a = Math.atan2(dir[1], dir[0]);
        const s = width * 3.4;
        ctx.beginPath();
        ctx.moveTo(end[0] - s * Math.cos(a - 0.5), end[1] - s * Math.sin(a - 0.5));
        ctx.lineTo(end[0], end[1]);
        ctx.lineTo(end[0] - s * Math.cos(a + 0.5), end[1] - s * Math.sin(a + 0.5));
        ctx.stroke();
      }
    });
  }

  function personIcon(x, y, k, color) {
    ctx.fillStyle = color;
    circle(x, y - 9 * k, 10 * k);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 17 * k, y + 20 * k);
    ctx.quadraticCurveTo(x - 17 * k, y + 3 * k, x, y + 3 * k);
    ctx.quadraticCurveTo(x + 17 * k, y + 3 * k, x + 17 * k, y + 20 * k);
    ctx.closePath();
    ctx.fill();
  }

  function restartIcon(x, y, r, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.22);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, -Math.PI * 0.35, Math.PI * 1.35);
    ctx.stroke();
    const ex = r * 0.62 * Math.cos(-Math.PI * 0.35);
    const ey = r * 0.62 * Math.sin(-Math.PI * 0.35);
    ctx.beginPath();
    ctx.moveTo(ex - r * 0.36, ey - r * 0.06);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex + r * 0.04, ey + r * 0.38);
    ctx.stroke();
    ctx.restore();
  }

  function opIcon(kind, x, y, s) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = Math.max(2.5, s * 0.16);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (kind === "search") {
      ctx.arc(x - s * 0.12, y - s * 0.12, s * 0.42, 0, Math.PI * 2);
      ctx.moveTo(x + s * 0.2, y + s * 0.2);
      ctx.lineTo(x + s * 0.52, y + s * 0.52);
    } else if (kind === "add") {
      ctx.moveTo(x, y - s * 0.5);
      ctx.lineTo(x, y + s * 0.5);
      ctx.moveTo(x - s * 0.5, y);
      ctx.lineTo(x + s * 0.5, y);
    } else if (kind === "delete") {
      ctx.moveTo(x - s * 0.4, y - s * 0.4);
      ctx.lineTo(x + s * 0.4, y + s * 0.4);
      ctx.moveTo(x + s * 0.4, y - s * 0.4);
      ctx.lineTo(x - s * 0.4, y + s * 0.4);
    } else if (kind === "update") {
      // A pencil: body and tip.
      ctx.moveTo(x - s * 0.45, y + s * 0.45);
      ctx.lineTo(x - s * 0.3, y + s * 0.05);
      ctx.lineTo(x + s * 0.3, y - s * 0.55);
      ctx.lineTo(x + s * 0.55, y - s * 0.3);
      ctx.lineTo(x - s * 0.05, y + s * 0.3);
      ctx.closePath();
    }
    ctx.stroke();
    if (kind === "restart") restartIcon(x, y, s * 0.9, 0, C.ink);
  }

  function pill(cx, cy, str, o) {
    ctx.font = font(o.size, 800);
    const w = o.w || ctx.measureText(str).width + o.size * 1.2;
    const h = o.h || o.size * 1.6;
    rr(cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = o.fill;
    ctx.fill();
    text(str, cx, cy + o.size * 0.36, { size: o.size, weight: 800, color: o.color || C.paper, align: "center", max: w - o.size, min: o.min || o.size });
  }

  // --- Tokens ----------------------------------------------------------------------------------

  // o: key, user, label | morph{prefix,from,to,suffix,p}, w, h, size, min, stack, fill, stroke, lw, dashed, rank, tag, tagFill, id
  function drawToken(cx, cy, k, alpha, o) {
    withAlpha(alpha, () => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.translate(-o.w / 2, -o.h / 2);
      const { w, h } = o;
      rr(3, 6, w, h, 14);
      ctx.fillStyle = "rgba(31,36,48,0.08)";
      ctx.fill();
      rr(0, 0, w, h, 14);
      ctx.fillStyle = o.fill;
      ctx.fill();
      ctx.lineWidth = o.lw;
      ctx.strokeStyle = o.stroke;
      if (o.dashed) ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
      const color = C[o.user];
      let lx;
      let ly;
      let room;
      if (o.stack) {
        rr(10, 10, 52, 26, 8);
        ctx.fillStyle = color;
        ctx.fill();
        text(o.key, 36, 29, { size: 17, weight: 800, color: C.paper, align: "center" });
        if (o.id) text(o.id, 70, 29, { size: 16, weight: 700, color: C.muted, max: w - 78, min: 11 });
        lx = 12;
        ly = h - 16;
        room = w - 24;
      } else {
        rr(10, h / 2 - 16, 56, 32, 8);
        ctx.fillStyle = color;
        ctx.fill();
        text(o.key, 38, h / 2 + 6, { size: 17, weight: 800, color: C.paper, align: "center" });
        lx = 78;
        ly = h / 2 + o.size * 0.36 - (o.id ? 8 : 0);
        room = w - 88;
        if (o.id) text(o.id, lx, h - 9, { size: 16, weight: 700, color: C.muted, max: room, min: 11 });
      }
      drawLabel(o, lx, ly, room);
      if (o.tag) {
        ctx.font = font(20, 800);
        const tw = ctx.measureText(o.tag).width + 28;
        rr(-10, -20, tw, 34, 17);
        ctx.fillStyle = o.tagFill || C.warm;
        ctx.fill();
        text(o.tag, -10 + tw / 2, 4, { size: 20, weight: 800, color: C.paper, align: "center" });
      }
      if (o.rank) {
        ctx.fillStyle = C.ink;
        circle(w - 4, 4, 20);
        ctx.fill();
        text(String(o.rank), w - 4, 12.5, { size: 24, weight: 800, color: C.paper, align: "center" });
      }
      ctx.restore();
    });
  }

  function drawLabel(o, x, y, room) {
    if (!o.morph) {
      text(o.label, x, y, { size: o.size, weight: 800, color: C.ink, max: room, min: o.min });
      return;
    }
    // Digits roll from the old value to the new one inside the same tile.
    const m = o.morph;
    const size = fitSize(`${m.prefix}${m.to}${m.suffix}`, room, o.size, o.min, 800);
    ctx.font = font(size, 800);
    const pw = ctx.measureText(m.prefix).width;
    const dw = Math.max(ctx.measureText(m.from).width, ctx.measureText(m.to).width);
    text(m.prefix, x, y, { size, weight: 800 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + pw - 2, y - size * 1.05, dw + 4, size * 1.35);
    ctx.clip();
    const p = inOut(m.p);
    withAlpha(1 - p, () => text(m.from, x + pw, y - p * size * 0.9, { size, weight: 800 }));
    withAlpha(p, () => text(m.to, x + pw, y + (1 - p) * size * 0.9, { size, weight: 800, color: C.warmDeep }));
    ctx.restore();
    text(m.suffix, x + pw + dw, y, { size, weight: 800 });
  }

  // --- State at time t ------------------------------------------------------------------------

  function caseAt(t) {
    for (const s of SCENE_PLAN) {
      if (t >= s.in && (t < s.out || s.last)) return s.compare && t >= COMPARE_AT ? s.compare : s.case;
    }
    return SCENE_PLAN[0].case;
  }

  // Search windows: route, funnel label, hits and copies in the tray.
  function searches(f) {
    return [
      { user: f.m02.user, filter: f.m02.filter, in: 5.4, out: 8.0, hits: f.m02.hits, copyIn: 6.3 },
      { user: f.m03.user, filter: f.m03.filter, in: 8.2, out: 11.0, hits: f.m03.hits, copyIn: 8.7 },
      { user: "aya", filter: f.update.filter, in: 14.2, out: 17.0, hits: [{ key: "A02", label: f.update.afterLabel }], copyIn: 14.7 },
      { user: "aya", filter: f.reopen.filter, in: 24.8, out: Infinity, hits: [{ key: "A02", label: f.update.afterLabel }], copyIn: 25.3 },
    ];
  }

  function bubbleAt(t, f) {
    const list = [
      { at: 0, str: "7件を保存", kind: "add" },
      { at: 5.0, str: f.m02.query, kind: "search" },
      { at: 11.2, str: "IDで更新", kind: "update" },
      { at: 14.0, str: f.update.query, kind: "search" },
      { at: 17.1, str: "IDで削除", kind: "delete" },
      { at: 22.2, str: "別プロセス", kind: "restart" },
      { at: 24.6, str: f.reopen.query, kind: "search" },
    ];
    let i = 0;
    while (i + 1 < list.length && t >= list[i + 1].at) i++;
    return { cur: list[i], prev: i > 0 ? list[i - 1] : null, k: i > 0 ? ramp(t, list[i].at, list[i].at + 0.3) : 1 };
  }

  function countsAt(t, f) {
    if (t < 5) {
      const landed = (user) => KEYS[user].filter((key) => t >= FLY[key] + FLY_LEN).length;
      return { aya: landed("aya"), ken: landed("ken") };
    }
    if (t < T.delCount) return f.counts.stored;
    if (t < T.openB) return f.counts.deleted;
    return f.counts.reopened;
  }

  const userOf = (key) => (KEYS.aya.includes(key) ? "aya" : "ken");
  const slotCenter = (key) => {
    const user = userOf(key);
    const s = L.slot(user, KEYS[user].indexOf(key));
    return { x: s.x + L.token.w / 2, y: s.y + L.token.h / 2 };
  };
  const drawerCenter = () => ({ x: L.drawer.slot.x + (L.token.w * L.drawer.slot.k) / 2, y: L.drawer.slot.y + (L.token.h * L.drawer.slot.k) / 2 });
  const personCenter = (user) => ({ x: L.person[user].x, y: L.person[user].y });

  // --- Scene parts ------------------------------------------------------------------------------

  function drawChrome(t) {
    text("MEM0 OSS ・ 架空の2人の好み", L.eyebrow.x, L.eyebrow.y, { size: L.eyebrow.size, weight: 700, color: C.muted, spacing: "2px" });
    const id = caseAt(t);
    const str = `記録 ${id}`;
    const b = L.badge;
    ctx.font = font(b.size, 800);
    const w = ctx.measureText(str).width + 32;
    const h = b.size * 1.7;
    rr(b.x - w, b.y - h * 0.68, w, h, h / 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    text(str, b.x - w / 2, b.y, { size: b.size, weight: 800, align: "center" });
    text("保存済みの実行結果をもとにした図 ・ 無音", L.foot.x1, L.foot.y, { size: L.foot.size, weight: 600, color: C.muted });
    text("STUDIO YEBISU", L.foot.x2, L.foot.y, { size: L.foot.size - 2, weight: 800, color: C.muted, align: "right", spacing: "3px" });
  }

  function drawTitle(t) {
    for (const s of SCENE_PLAN) {
      if (t < s.in - 0.001 || (t >= s.out && !s.last)) continue;
      const fin = s.in === 0 ? 1 : ease(ramp(t, s.in, s.in + 0.35));
      const fout = s.last ? 1 : 1 - ramp(t, s.out - 0.25, s.out);
      withAlpha(Math.min(fin, fout), () => {
        text(s.headline, L.title.x, L.title.y + (1 - fin) * 12, { size: L.title.size, weight: 800, max: L.title.max, min: L.title.min });
      });
    }
  }

  function drawPeople(t) {
    const strong = window01(t, 0.2, 3.6, 0.6);
    for (const user of ["aya", "ken"]) {
      const p = L.person[user];
      arrow(L.inflow[user], C[user], 4, 1, 0.3 + 0.7 * strong);
      personIcon(p.x, p.y, L.person.k, C[user]);
      text(USERS[user], p.lx, p.ly, { size: L.person.size, weight: 800, color: C[user], align: p.align });
    }
  }

  function drawBubble(t, f) {
    const B = L.bubble;
    rr(B.cx - B.w / 2, B.cy - B.h / 2, B.w, B.h, B.h / 2);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    const { cur, prev, k } = bubbleAt(t, f);
    const icon = B.cx - B.w / 2 + B.h * 0.5;
    const draw = (b, a) => withAlpha(a, () => {
      opIcon(b.kind, icon, B.cy, B.size * 0.62);
      text(b.str, B.cx + B.h * 0.25, B.cy + B.size * 0.36, { size: B.size, weight: 800, align: "center", max: B.w - B.h * 1.1, min: 20 });
    });
    if (prev && k < 1) draw(prev, 1 - k);
    draw(cur, k);
    // Connector to the funnel.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(L.connector[0][0], L.connector[0][1]);
    ctx.lineTo(L.connector[1][0], L.connector[1][1]);
    ctx.stroke();
  }

  function drawFunnelAndRoute(t, f) {
    const F = L.funnel;
    // Idle funnel outline keeps the drawing connected between searches.
    const shape = () => {
      const k = F.k;
      ctx.beginPath();
      ctx.moveTo(F.cx - 16 * k, F.cy - 13 * k);
      ctx.lineTo(F.cx + 16 * k, F.cy - 13 * k);
      ctx.lineTo(F.cx + 4 * k, F.cy + 3 * k);
      ctx.lineTo(F.cx + 4 * k, F.cy + 13 * k);
      ctx.lineTo(F.cx - 4 * k, F.cy + 13 * k);
      ctx.lineTo(F.cx - 4 * k, F.cy + 3 * k);
      ctx.closePath();
    };
    shape();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.muted;
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.stroke();
    for (const w of searches(f)) {
      const a = window01(t, w.in, w.out);
      if (a <= 0.002) continue;
      withAlpha(a, () => {
        shape();
        ctx.fillStyle = C[w.user];
        ctx.fill();
        text(w.filter, F.lx, F.ly, { size: F.size, weight: 800, color: C[w.user], max: F.max, min: 20 });
      });
      arrow(L.route[w.user], C[w.user], 5, ease(ramp(t, w.in + 0.1, w.in + 0.6)), a);
    }
  }

  function tabWidth(label, withIcon) {
    ctx.font = font(L.tab.size, 800);
    return ctx.measureText(label).width + 30 + (withIcon ? L.tab.h : 0);
  }

  function drawStore(t, f) {
    const st = L.store;
    const Tb = L.tab;
    const same = ramp(t, T.sameTab, T.sameTab + 0.3);
    const icon = t >= T.spinA;
    const wNow = lerp(tabWidth("保存先", false), tabWidth("同じ保存先", true), icon ? ease(ramp(t, T.spinA, T.spinA + 0.4)) : 0);
    ctx.beginPath();
    ctx.moveTo(Tb.x, Tb.y + Tb.h);
    ctx.lineTo(Tb.x, Tb.y + 10);
    ctx.quadraticCurveTo(Tb.x, Tb.y, Tb.x + 10, Tb.y);
    ctx.lineTo(Tb.x + wNow - 14, Tb.y);
    ctx.lineTo(Tb.x + wNow, Tb.y + Tb.h);
    ctx.closePath();
    ctx.fillStyle = t >= T.spinA ? mix(C.ink, C.warmDeep, ramp(t, T.spinA, T.spinA + 0.4)) : C.ink;
    ctx.fill();
    let tx = Tb.x + 12;
    if (icon) {
      const spin = inOut(ramp(t, T.spinA, T.spinB)) * Math.PI * 2;
      withAlpha(ramp(t, T.spinA, T.spinA + 0.3), () => restartIcon(Tb.x + 12 + Tb.h * 0.4, Tb.y + Tb.h / 2, Tb.h * 0.42, spin, C.paper));
      tx += Tb.h * ramp(t, T.spinA, T.spinA + 0.4);
    }
    withAlpha(1 - same, () => text("保存先", tx, Tb.y + Tb.h / 2 + Tb.size * 0.38, { size: Tb.size, weight: 800, color: C.paper }));
    withAlpha(same, () => text("同じ保存先", tx, Tb.y + Tb.h / 2 + Tb.size * 0.38, { size: Tb.size, weight: 800, color: C.paper }));

    rr(st.x, st.y, st.w, st.h, 22);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = t >= T.spinA ? mix(C.ink, C.warm, ramp(t, T.spinA, T.spinA + 0.4)) : C.ink;
    ctx.stroke();

    // Scoped sections; the one outside the current filter steps back.
    for (const user of ["aya", "ken"]) {
      const s = L.sec[user];
      let dim = 0;
      for (const w of searches(f)) if (w.user !== user) dim = Math.max(dim, window01(t, w.in, w.out));
      withAlpha(1 - 0.55 * dim, () => {
        rr(s.x, s.y, s.w, s.h, 16);
        ctx.fillStyle = C[`${user}Wash`];
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = C[user];
        ctx.stroke();
      });
    }
  }

  function drawCounts(t, f) {
    const c = countsAt(t, f);
    const K = L.count;
    for (const user of ["aya", "ken"]) {
      const at = K.at(user);
      const k = 1 + 0.12 * Math.max(user === "aya" ? pulse(t, T.delCount) : 0, pulse(t, T.countPulse));
      ctx.save();
      ctx.translate(at.cx, at.cy);
      ctx.scale(k, k);
      rr(-K.w / 2, -K.h / 2, K.w, K.h, K.h / 2);
      ctx.fillStyle = C[user];
      ctx.fill();
      text(`${c[user]}件`, 0, K.size * 0.36, { size: K.size, weight: 800, color: C.paper, align: "center" });
      ctx.restore();
    }
  }

  function tokenStyle(key, t, f) {
    const user = userOf(key);
    const tk = L.token;
    const o = {
      key, user, w: tk.w, h: tk.h, size: tk.size, min: tk.min, stack: tk.stack, label: f.labels[key],
      fill: C.paper, stroke: C[user], lw: 3, dashed: false, rank: 0, tag: "", tagFill: C.warm, id: "",
    };
    // Rank marks and dimming during searches.
    let dim = 0;
    for (const w of searches(f)) {
      const a = window01(t, w.in + 0.4, w.out);
      const idx = w.hits.findIndex((h) => h.key === key);
      if (idx >= 0 && a > 0.5) {
        o.rank = idx + 1;
        o.lw = 5;
        o.stroke = C.ink;
      }
      if (idx < 0) dim = Math.max(dim, a);
    }
    if (key === "A02") {
      const warm = ramp(t, T.updLift, T.updLift + 0.4);
      if (warm > 0) {
        o.fill = mix(C.paper, C.warmWash, warm);
        if (!o.rank) o.stroke = mix(C[user], C.warm, warm);
        o.id = t >= T.updLift ? `ID ${f.update.idShort}` : "";
      }
      if (t >= T.updMorphA && t < T.updMorphB) {
        o.morph = { prefix: f.update.prefix, from: f.update.from, to: f.update.to, suffix: f.update.suffix, p: ramp(t, T.updMorphA, T.updMorphB) };
      } else if (t >= T.updMorphB) {
        o.label = f.update.afterLabel;
      }
      if (t >= T.updMorphB && t < 22.0) o.tag = `${f.update.from}→${f.update.to}`;
      if (t >= T.keepTag) o.tag = `${f.update.to}秒のまま`;
    }
    if (key === f.removed) {
      if (t >= T.delMark && t < T.delMoveA + 0.6) {
        o.tag = "削除";
        o.stroke = C.warm;
      }
      if (t >= T.delMoveA + 0.7) {
        o.dashed = true;
        o.fill = C.ivory;
        o.stroke = C.muted;
      }
      if (t >= T.delMoveB) {
        o.tag = "一覧の外";
        o.tagFill = C.muted;
      }
    }
    return { o, dim };
  }

  function drawTokens(t, f) {
    for (const user of ["aya", "ken"]) {
      for (const key of KEYS[user]) {
        const p = ramp(t, FLY[key], FLY[key] + FLY_LEN);
        if (p <= 0) continue;
        const { o, dim } = tokenStyle(key, t, f);
        const home = slotCenter(key);
        let c = home;
        let k = 1;
        let alpha = 1 - 0.6 * dim;
        if (p < 1) {
          const e = inOut(p);
          const from = personCenter(user);
          c = { x: lerp(from.x, home.x, e), y: lerp(from.y, home.y, e) };
          k = lerp(0.3, 1, e);
          alpha = ramp(p, 0, 0.25);
        }
        if (key === "A02") k *= 1 + 0.06 * Math.sin(Math.PI * ramp(t, T.updLift, T.updHist));
        if (key === f.removed && t >= T.delMoveA) {
          const e = inOut(ramp(t, T.delMoveA, T.delMoveB));
          const to = drawerCenter();
          c = { x: lerp(home.x, to.x, e), y: lerp(home.y, to.y, e) };
          k = lerp(1, L.drawer.slot.k, e);
          alpha = 1;
        }
        drawToken(c.x, c.y, k, alpha, o);
      }
    }
  }

  function drawClosing(t) {
    const a = 0.62 * (ramp(t, T.closeA, T.closeB) - ramp(t, T.openA, T.openB));
    const st = L.store;
    withAlpha(a, () => {
      rr(st.x, st.y, st.w, st.h, 22);
      ctx.fillStyle = C.ivory;
      ctx.fill();
    });
    const O = L.overlay;
    const lab1 = window01(t, T.closeA + 0.1, T.openA - 0.25, 0.2);
    const lab2 = window01(t, T.openA - 0.2, T.openB + 0.2, 0.2);
    withAlpha(lab1, () => pill(O.x, O.y, "閉じる", { size: O.size, fill: C.ink }));
    withAlpha(lab2, () => pill(O.x, O.y, "別プロセスで開く", { size: O.size, fill: C.warmDeep }));
  }

  function drawDrawer(t, f) {
    const D = L.drawer;
    rr(D.x, D.y, D.w, D.h, 16);
    ctx.fillStyle = C.ivory;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.muted;
    ctx.setLineDash([10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    text("履歴", D.tx, D.ty, { size: D.size, weight: 800, color: C.muted });
    const lines = [
      { key: "A02", events: f.history.A02, at: T.updHist },
      { key: f.removed, events: f.history[f.removed], at: T.delHist },
    ];
    lines.forEach((line, i) => {
      withAlpha(fadeIn(t, line.at, line.at + 0.35), () => {
        text(`${line.key} ${line.events.map((e) => EVENT_JA[e] || e).join("→")}`, D.lx, D.ly[i], { size: D.lsize, weight: 800, color: C[userOf(line.key)], max: D.lmax, min: 14 });
      });
    });
  }

  function drawTray(t, f) {
    const O = L.tray;
    text("引き出した", O.tx, O.ty, { size: O.size, weight: 800 });
    const M = O.msg;
    const c = f.counts.stored;
    withAlpha(window01(t, T.storedMsgA, T.storedMsgB), () => text(`あや${c.aya}件・けん${c.ken}件を保存`, M.x, M.y, { size: M.size, weight: 800, max: M.max, min: 18 }));
    withAlpha(window01(t, T.delMsgA, T.delMsgB), () => text(`get ${f.removed} → なし`, M.x, M.y, { size: M.size, weight: 800, max: M.max, min: 18 }));

    // Copies of the retrieved tokens travel from their stored tile to the tray.
    for (const w of searches(f)) {
      w.hits.forEach((hit, i) => {
        const tin = w.copyIn + i * 0.22;
        const p = ramp(t, tin, tin + 0.85);
        if (p <= 0) return;
        const a = w.out === Infinity ? 1 : fadeOut(t, w.out, w.out + 0.3);
        if (a <= 0.002) return;
        const slot = O.slots[i];
        const to = { x: slot.x + O.w / 2, y: slot.y + O.h / 2 };
        const from = slotCenter(hit.key);
        const e = inOut(p);
        const user = userOf(hit.key);
        const changed = hit.key === "A02" && t >= T.updLift;
        drawToken(lerp(from.x, to.x, e), lerp(from.y, to.y, e), lerp(0.8, 1, e), a * ramp(p, 0, 0.2), {
          key: hit.key, user, w: O.w, h: O.h, size: O.label, min: O.min, stack: true, label: hit.label,
          fill: changed ? C.warmWash : C.paper, stroke: changed ? C.warm : C[user], lw: 3, rank: i + 1, tag: "", id: "",
        });
      });
    }
  }

  function drawCta(t) {
    const a = fadeIn(t, T.ctaA, T.ctaA + 0.4);
    if (a <= 0.002) return;
    const Cc = L.cta;
    withAlpha(a, () => {
      const dy = (1 - a) * 10;
      rr(Cc.cx - Cc.w / 2, Cc.cy - Cc.h / 2 + dy, Cc.w, Cc.h, Cc.h / 2);
      ctx.fillStyle = C.ink;
      ctx.fill();
      // Handmade download mark.
      const ix = Cc.cx - Cc.w / 2 + Cc.h * 0.55;
      const iy = Cc.cy + dy;
      const s = Cc.size * 0.5;
      ctx.strokeStyle = C.paper;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(ix, iy - s);
      ctx.lineTo(ix, iy + s * 0.5);
      ctx.moveTo(ix - s * 0.55, iy);
      ctx.lineTo(ix, iy + s * 0.55);
      ctx.lineTo(ix + s * 0.55, iy);
      ctx.moveTo(ix - s * 0.7, iy + s);
      ctx.lineTo(ix + s * 0.7, iy + s);
      ctx.stroke();
      text("記録をJSONで保存", Cc.cx + Cc.h * 0.3, Cc.cy + dy + Cc.size * 0.36, { size: Cc.size, weight: 800, color: C.paper, align: "center", max: Cc.w - Cc.h * 1.3, min: 16 });
    });
  }

  // --- Frame ------------------------------------------------------------------------------------

  function drawFrame(t) {
    const f = film;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = C.ivory;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(S, 0, 0, S, OX, OY);
    drawChrome(t);
    drawTitle(t);
    drawPeople(t);
    drawBubble(t, f);
    drawFunnelAndRoute(t, f);
    drawStore(t, f);
    drawDrawer(t, f);
    drawTokens(t, f);
    drawCounts(t, f);
    drawClosing(t);
    drawTray(t, f);
    drawCta(t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- Silent preview: the picture follows elapsed time; export seeks are pure. ----------------

  let current = 0;
  let isPlaying = false;
  let loading = false;
  let raf = 0;
  let startNow = 0;
  let startTime = 0;
  const clampTime = (seconds) => {
    const v = Number(seconds);
    return Number.isFinite(v) ? Math.max(0, Math.min(DURATION, v)) : 0;
  };

  function showTime() {
    ui.clock.textContent = loading ? "照合中" : !film ? "映像なし（照合失敗）" : `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
  }

  function playLabel() {
    ui.play.textContent = isPlaying ? "一時停止" : current >= DURATION - 0.001 ? "もう一度再生" : "再生";
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

  function buildSceneList() {
    ui.sceneList.replaceChildren(...SCENE_PLAN.map((s) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.disabled = true;
      const time = document.createElement("span");
      time.className = "scene-time";
      time.textContent = `${s.in}–${s.out}秒`;
      b.append(time, `${s.headline}（記録 ${s.compare ? `${s.case}・${s.compare}` : s.case}）`);
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
    current = 0;
    ui.time.value = "0";
    showAssets();
    setState("loading", `manifest と素材${ASSETS.length}件の SHA-256、元の実行記録を照合しています…`);
    showTime();
    const ready = load().then((data) => {
      loading = false;
      film = data;
      ui.stage.hidden = false;
      paint(current);
      setControls(true);
      setState("ready", "照合済み（7 / 7素材）。無音の動く概念図です。再生は操作したときだけ始まります。");
      return true;
    });
    ready.catch(fail);
    window.motionReady = ready;
    return ready;
  }

  buildSceneList();
  ui.play.addEventListener("click", () => (isPlaying ? stop() : play()));
  ui.reset.addEventListener("click", () => window.seek(0).catch(fail));
  ui.time.addEventListener("input", () => window.seek(ui.time.value).catch(fail));
  ui.retry.addEventListener("click", start);
  start();
})();
