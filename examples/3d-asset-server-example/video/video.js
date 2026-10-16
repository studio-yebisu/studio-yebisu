/*
 * Studio Yebisu — 3D Asset Server 作例・解説動画（28秒・無音・1280×720）
 * Copyright (c) 2026 Studio Yebisu. MIT License.
 *
 * Every frame is drawn on one 2D canvas from absolute time only. Candidate titles, provider states,
 * the 1k and 8k totals, the budget, the original budget error, the five file paths, byte counts and
 * MD5 matches, glTF counts, the credit and all check counts are read from the eight frozen assets
 * after assets/data-hashes.json and every listed file match the SHA-256 and byte lengths fixed below,
 * and after the run record agrees with the frozen input, the pinned upstream, the vendor lock, the
 * independent checks, the offline replay check and the screenshot provenance.
 * There is no built-in fallback: on any mismatch window.motionReady rejects, the canvas is cleared
 * and hidden, controls are disabled, and #retry fetches everything again.
 * The two screenshots are drawn from the verified bytes, cropped and scaled only (FRAMING below).
 * Page text is written with textContent only; record strings are painted as canvas text.
 */
(() => {
  "use strict";

  // --- Composition contract -------------------------------------------------------------------

  const RENDER = window.__MOTION_RENDER__ === true;
  const requested = window.renderConfig && typeof window.renderConfig === "object" ? window.renderConfig : {};
  const positiveInt = (value, fallback) => (Number.isInteger(value) && value > 0 ? value : fallback);
  const W = positiveInt(requested.width, 1280);
  const H = positiveInt(requested.height, 720);
  const FPS = positiveInt(requested.fps, 30);
  const DURATION = 28;
  const POSTER_TIME = 19.5;
  window.motionConfig = { duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER_TIME, audioEvents: [] };

  // --- Frozen expectations --------------------------------------------------------------------

  const MANIFEST = {
    path: "assets/data-hashes.json",
    sha256: "e17aa95ce0f6e65ba4f140bf4435e26d1b18e8995efab569977a2f5239b2ec69",
    format: "studio-yebisu-assetserver-film-assets-v1",
  };
  // Same order as the manifest. Paths are relative to video/assets/.
  const ASSETS = [
    { path: "asset-runs.json", sha256: "2c8ebb0df73290a6cf4effbd1774790d495e31c700b32da6f94440e87df92d54", bytes: 94805 },
    { path: "independent-checks.json", sha256: "013a796893aabe1803cd9b40e417b7acf7400421be62d17f752e8037687d2af4", bytes: 24531 },
    { path: "reproduction-checks.json", sha256: "0b69bb1c9018dd46c41b3e12507fd07787e79dd280501beddbd23cd104550879", bytes: 3396 },
    { path: "asset-requests.json", sha256: "cced85c1dc314fb7c516bac22c3c8f23fe6caf95df6c4a854acbc0e1cd7bc019", bytes: 2401 },
    { path: "vendor-lock.json", sha256: "67f280672c4268d5a06b401e9e91b2c3010968c1e78211b29724b132b9266973", bytes: 29590 },
    { path: "screens.json", sha256: "1489ee57487401c66505f5a452bdff953910efa049f394dc458446f671c78682", bytes: 1481 },
    { path: "phone.jpg", sha256: "6a1c5813580df92f34b5fa3ef353887a2c68a1546265c4d6c3d70ca7a4f9ba8e", bytes: 38625 },
    { path: "desktop.jpg", sha256: "b5f3bba7d2eec2ff6e8bafa6010e3d91f50978e5a6ad96e1dca259c7617c67d7", bytes: 74828 },
  ];
  const SHA = Object.fromEntries(ASSETS.map((a) => [a.path, a.sha256]));
  const PIN = {
    repository: "arielshad/3d-asset-server",
    commit: "f605df3425011bae55ade114c9e7b276f5b1297b",
    version: "0.1.0",
    license: "Apache-2.0",
    vendorFiles: 115,
    vendorKinds: { original: 58, "original-tsc-output": 50, "npm-original": 7 },
    three: "0.180.0",
    checks: 39,
    independent: 212,
    replay: 29,
    replayedResponses: 8,
  };
  const FORMAT = {
    runs: "studio-yebisu-3d-asset-runs-v1",
    requests: "studio-yebisu-3d-asset-input-v1",
    screens: "studio-yebisu-assetserver-screens-v1",
  };
  const IDS = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08"];
  const OPERATIONS = { A01: "search", A02: "details", A03: "select", A04: "budget", A05: "invalid-id", A06: "unknown-provider", A07: "search", A08: "download" };
  // Fixed before execution (input/asset-requests.json and input/expected.json); the film only checks that the record agrees.
  const ASSET_ID = "polyhaven:wooden_crate_01";
  const PROVIDERS = ["polyhaven", "fab"];
  const HOSTS = ["api.polyhaven.com", "dl.polyhaven.org"];
  const BUDGET = 4194304;
  const NETWORK = { total: 8, api: 3, files: 5 };
  const ERRORS = { A05: "InvalidAssetIdError", A06: "UnknownProviderError" };
  const SCREENS = {
    phone: { image: "phone.jpg", case_id: "A08", width: 360, height: 780, source: "Phone default angle" },
    desktop: { image: "desktop.jpg", case_id: "A08", width: 1265, height: 889, source: "desktop rotated twice by native Right button" },
  };
  // Crops of the verified screenshots, in their own pixels: the 3D panel of each viewer around the crate.
  // Scaled only; the files and their pixels are untouched. Adjust here if the framing needs to change.
  const FRAMING = {
    phoneCrate: { image: "phone", x: 30, y: 376, w: 290, h: 218 },
    desktopCrate: { image: "desktop", x: 250, y: 500, w: 360, h: 300 },
  };
  const MIB = 1048576;
  const FILE_MESSAGE = "このページをファイルとして直接開くと、素材を読み込んで照合できません。作例のフォルダー（index.html のある場所）で python -m http.server を実行し、http://localhost:8000/video/ を開いてください。";

  // --- Scenes ---------------------------------------------------------------------------------

  // read: a settled moment inside the reading hold, used by the scene buttons (data-time).
  const SCENES = [
    { n: 1, in: 0, out: 4, read: 2.6, title: "Web用の木箱がほしい（取得した実物）", draw: sceneAsk },
    { n: 2, in: 4, out: 8, read: 6.6, title: "探す：候補3件と配信元の状態（A01）", draw: sceneSearch },
    { n: 3, in: 8, out: 12, read: 10.8, title: "取得の前に容量を見る：1k と 8k（A03・A04）", draw: sceneBudget },
    { n: 4, in: 12, out: 17, read: 14, title: "1k の5ファイルを取得して照合（A08）", draw: sceneFiles },
    { n: 5, in: 17, out: 23, read: 19.5, title: "取得した実物を3Dで見る（閲覧ページの実画面）", draw: sceneModel },
    { n: 6, in: 23, out: 28, read: 26, title: "探す → 容量 → 取得 → 3D", draw: sceneEnd, last: true },
  ];
  const RAIL = ["探す", "容量", "取得", "3D"];

  // --- Page ------------------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const ui = {
    editor: $("editor"),
    status: $("status"),
    loading: $("loading"),
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
    assetSummary: $("asset-summary"),
    assetChecks: $("asset-checks"),
  };

  if (RENDER) {
    document.documentElement.classList.add("is-render");
    ui.canvas.style.width = `${W}px`;
    ui.canvas.style.height = `${H}px`;
  }
  ui.canvas.width = W;
  ui.canvas.height = H;
  const ctx = ui.canvas.getContext("2d", { willReadFrequently: true });
  // The content block is authored at 1280×720. The logical frame grows to the requested aspect
  // (taller or wider), so the masthead and footer sit on the real edges and the content is centred,
  // drawn at the native backing-store size. Portrait or square layouts are not separately authored.
  const LW = Math.max(1280, (720 * W) / H);
  const LH = Math.max(720, (1280 * H) / W);
  const SCALE = W / LW;
  const CX = (LW - 1280) / 2;
  const CY = (LH - 720) / 2;

  // --- Loading and checks ---------------------------------------------------------------------

  class CheckError extends Error {}

  function check(condition, message) {
    if (!condition) throw new CheckError(message);
  }

  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const isString = (value) => typeof value === "string";
  const own = (object, key) => isObject(object) && Object.prototype.hasOwnProperty.call(object, key);
  const short = (commit) => String(commit).slice(0, 7);
  const int = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const mibLabel = (bytes) => {
    const value = bytes / MIB;
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  };
  const hostOf = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  };

  function deepEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
    if (isObject(a) && isObject(b)) {
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((key) => own(b, key) && deepEqual(a[key], b[key]));
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
      throw new CheckError(`${relative} を読み込めませんでした。作例のフォルダーをローカルの HTTP サーバーで開いてください（例：python -m http.server）。`);
    }
    check(response.ok, `${relative} を読み込めませんでした（HTTP ${response.status}）。`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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

  const assetState = new Map();
  let manifestDigest = null;

  function showAssets() {
    const rows = ASSETS.map((asset) => {
      const item = assetState.get(asset.path) || { ok: null, actual: null, size: null };
      const li = document.createElement("li");
      li.dataset.state = item.ok === true ? "match" : item.ok === false ? "mismatch" : "pending";
      const name = document.createElement("code");
      name.className = "asset-name";
      name.textContent = asset.path;
      const verdict = document.createElement("span");
      verdict.className = item.ok === true ? "verdict is-ok" : item.ok === false ? "verdict is-ng" : "verdict";
      verdict.textContent = item.ok === true ? "一致" : item.ok === false ? "不一致" : "照合前";
      const size = document.createElement("span");
      size.className = "bytes";
      size.textContent = item.ok === false && item.size !== asset.bytes
        ? `固定値 ${int(asset.bytes)} バイト／読み込んだ値 ${int(Number(item.size))} バイト`
        : `${int(asset.bytes)} バイト`;
      const digest = document.createElement("code");
      digest.className = "digest";
      digest.textContent = `SHA-256 ${asset.sha256}`;
      li.append(name, " ", verdict, " ", size, document.createElement("br"), digest);
      if (item.ok === false && item.actual && item.actual !== asset.sha256) {
        const actual = document.createElement("code");
        actual.className = "digest is-ng";
        actual.textContent = `読み込んだ値 ${item.actual}`;
        li.append(document.createElement("br"), actual);
      }
      return li;
    });
    ui.assetChecks.replaceChildren(...rows);
    const ok = [...assetState.values()].filter((item) => item.ok === true).length;
    ui.assetSummary.textContent = manifestDigest
      ? `video/assets/data-hashes.json（SHA-256 ${manifestDigest}）は固定値と一致。素材${ASSETS.length}件のうち${ok}件の SHA-256 とバイト数が一致しました。`
      : `video/assets/data-hashes.json（固定値 SHA-256 ${MANIFEST.sha256}）の照合はまだ終わっていません。下は固定した素材${ASSETS.length}件の値です。`;
  }

  // Width and height from the first SOF segment, read from the original bytes.
  function jpegSize(bytes) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      if (marker === 0xff) { i += 1; continue; }
      if (marker === 0xd9 || marker === 0xda) return null;
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + length;
    }
    return null;
  }

  let objectUrls = [];

  async function decodeJpeg(bytes, name, expected) {
    const n = bytes.length;
    check(n > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[n - 2] === 0xff && bytes[n - 1] === 0xd9,
      `${name} が JPEG の開始・終了の印を持っていません。`);
    const header = jpegSize(bytes);
    check(header && header.width === expected.width && header.height === expected.height,
      `${name} の JPEG ヘッダーの大きさが screens.json（${expected.width}×${expected.height}）と一致しません。`);
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
    objectUrls.push(url);
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new CheckError(`${name} を画像として読み込めませんでした。`);
    }
    check(image.naturalWidth === expected.width && image.naturalHeight === expected.height,
      `${name} を読み込んだ大きさ（${image.naturalWidth}×${image.naturalHeight}）が screens.json と一致しません。`);
    return image;
  }

  // Japanese label for each file of the glTF set, from the Poly Haven map name in the path (explanatory).
  function roleOf(path) {
    if (path.endsWith(".gltf")) return "本体（部品と参照の一覧）";
    if (path.endsWith(".bin")) return "形（頂点と面）";
    if (path.includes("_diff_")) return "画像：色";
    if (path.includes("_nor_gl_")) return "画像：凹凸（法線）";
    if (path.includes("_arm_")) return "画像：陰・粗さ・金属";
    return "画像";
  }
  const kindOf = (path) => (path.endsWith(".gltf") ? "glTF" : path.endsWith(".bin") ? "BIN" : "JPG");
  const KIND_ORDER = { glTF: 0, BIN: 1, JPG: 2 };

  function verify(j) {
    const runs = j["asset-runs.json"];
    const indep = j["independent-checks.json"];
    const replay = j["reproduction-checks.json"];
    const requests = j["asset-requests.json"];
    const lock = j["vendor-lock.json"];
    const screens = j["screens.json"];
    [runs, indep, replay, requests, lock, screens].forEach((value, i) => check(isObject(value), `${ASSETS[i].path} の形が想定と違います。`));

    // Pinned upstream, lock, three, inputs and runtime.
    const up = runs.upstream;
    const pinned = (o) => isObject(o) && o.repository === PIN.repository && o.commit === PIN.commit && o.version === PIN.version && o.license === PIN.license;
    check(runs.format === FORMAT.runs, "asset-runs.json の形式が想定と違います。");
    check(pinned(up), `実行記録の固定版（${PIN.repository} ${short(PIN.commit)}・${PIN.version}・${PIN.license}）が一致しません。`);
    check(pinned(lock), "vendor-lock.json の固定版が一致しません。");
    check(up.vendor_files_verified === PIN.vendorFiles && deepEqual(up.vendor_file_kinds, PIN.vendorKinds),
      `実行記録の原典ファイル数（${PIN.vendorFiles}件）と種類の内訳が想定と違います。`);
    check(Array.isArray(lock.files) && lock.files.length === PIN.vendorFiles
      && lock.files.every((f) => isObject(f) && isString(f.path) && f.path.startsWith("vendor/") && /^[0-9a-f]{64}$/.test(f.sha256 || "") && Number.isInteger(f.bytes)),
      `vendor-lock.json が${PIN.vendorFiles}ファイルの SHA-256 になっていません。`);
    const kinds = {};
    for (const f of lock.files) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
    check(deepEqual(kinds, PIN.vendorKinds), "vendor-lock.json の種類の内訳（原典58・build:server の出力50・three 7）が一致しません。");
    check(new Set(lock.files.map((f) => f.path)).size === lock.files.length, "vendor-lock.json に同じパスが重なっています。");
    check(up.vendor_lock_sha256 === SHA["vendor-lock.json"] && isObject(runs.input_sha256)
      && runs.input_sha256["vendor-lock.json"] === SHA["vendor-lock.json"]
      && runs.input_sha256["input/asset-requests.json"] === SHA["asset-requests.json"],
      "実行記録が参照する入力・ロックの SHA-256 が素材と一致しません。");
    check(isObject(runs.three) && runs.three.version === PIN.three && runs.three.license === "MIT"
      && isObject(lock.three) && lock.three.version === PIN.three && lock.three.archive_sha256 === runs.three.archive_sha256,
      `three ${PIN.three} の固定が実行記録と vendor-lock.json で一致しません。`);
    const rt = runs.runtime;
    check(requests.format === FORMAT.requests && deepEqual(requests.providers, PROVIDERS) && requests.max_bytes === BUDGET && isString(requests.user_agent),
      "asset-requests.json の配信元・予算・User-Agent が想定と違います。");
    check(isObject(rt) && deepEqual(rt.providers, PROVIDERS) && rt.user_agent === requests.user_agent && isString(rt.node),
      "実行環境の配信元・User-Agent が入力と一致しません。");

    // Eight operations against the frozen input.
    const results = runs.results;
    check(Array.isArray(results) && results.length === IDS.length && results.every((r, i) => isObject(r) && r.id === IDS[i]), "実行記録が A01〜A08 の8件ではありません。");
    check(Array.isArray(requests.cases) && requests.cases.length === IDS.length && requests.cases.every((c, i) => isObject(c) && c.id === IDS[i]), "入力が A01〜A08 の8件ではありません。");
    const byId = {};
    results.forEach((r, i) => {
      const c = requests.cases[i];
      check(r.operation === OPERATIONS[r.id] && c.operation === r.operation && r.label === c.label && deepEqual(r.input, c),
        `${r.id} の入力が、固定した入力（asset-requests.json）と一致しません。`);
      byId[r.id] = r;
    });

    // Network: only the two Poly Haven hosts, 3 API + 5 file requests, nothing to Fab.
    const netOf = (r) => {
      const n = isObject(r.observations) ? r.observations.network : null;
      check(isObject(n) && Array.isArray(n.calls) && n.requests === n.calls.length, `${r.id} の通信の記録が想定と違います。`);
      return n;
    };
    const allCalls = IDS.flatMap((id) => netOf(byId[id]).calls);
    check(allCalls.every((c) => isObject(c) && c.status === 200 && HOSTS.includes(hostOf(c.url)) && c.user_agent === rt.user_agent && /^[0-9a-f]{64}$/.test(c.sha256 || "")),
      "通信が Poly Haven の2つのホスト以外へ出ているか、通信の記録の形が違います。");
    const apiCalls = allCalls.filter((c) => hostOf(c.url) === HOSTS[0]).length;
    const fileCalls = allCalls.filter((c) => hostOf(c.url) === HOSTS[1]).length;
    const net = runs.network;
    check(isObject(net) && net.requests === allCalls.length && net.api_requests === apiCalls && net.file_requests === fileCalls && deepEqual(net.hosts, HOSTS)
      && allCalls.length === NETWORK.total && apiCalls === NETWORK.api && fileCalls === NETWORK.files,
      `実際の通信が${NETWORK.total}件（API ${NETWORK.api}・ファイル ${NETWORK.files}）として記録されていません。`);

    // The chosen asset and its licence.
    const asset = runs.asset;
    check(isObject(asset) && asset.id === ASSET_ID && isString(asset.title) && isString(asset.author) && isString(asset.provider)
      && isObject(asset.license) && asset.license.name === "CC0" && asset.license.commercialUse === true && asset.license.attributionRequired === false
      && hostOf(asset.source_url) === "polyhaven.com"
      && asset.credit === `${asset.title} by ${asset.author} / ${asset.provider} / ${asset.license.name}`,
      "選んだ素材・CC0・作者・出典の記録が想定と違います。");

    // A01: three candidates, Poly Haven ok, Fab link only.
    const a01 = byId.A01;
    const out1 = a01.output;
    check(isObject(out1) && Array.isArray(out1.results) && out1.results.length === 3 && out1.results.length <= a01.input.request.limit,
      "A01 の候補が3件ではありません。");
    const candidates = out1.results.map((x) => {
      check(isObject(x) && isString(x.id) && isString(x.title) && isString(x.author) && isObject(x.license) && isString(x.license.name)
        && x.provider === "polyhaven" && x.type === "model" && isObject(x.price) && x.price.free === true && x.downloadable === true,
        "A01 の候補が、Poly Haven の無料のモデルとして記録されていません。");
      return { id: x.id, title: x.title, author: x.author, license: x.license.name };
    });
    check(candidates[0].id === ASSET_ID && candidates[0].title === asset.title && candidates[0].author === asset.author && deepEqual(out1.results[0].license, asset.license),
      "A01 の先頭の候補が、選んだ素材と一致しません。");
    const provider = (list, id) => (Array.isArray(list) ? list.find((p) => isObject(p) && p.provider === id) : null);
    const ph = provider(out1.providers, "polyhaven");
    const fab = provider(out1.providers, "fab");
    check(out1.providers.length === 2 && ph && ph.status === "ok" && ph.count === candidates.length && isString(ph.name)
      && fab && fab.status === "link" && fab.count === 0 && isString(fab.name) && hostOf(fab.searchUrl) === "www.fab.com"
      && deepEqual(a01.observations.provider_status, { polyhaven: "ok", fab: "link" }),
      "A01 の配信元の状態が、Poly Haven は ok・Fab は link になっていません。");

    // A02: details agree with the chosen asset; glTF is offered.
    const out2 = byId.A02.output;
    check(isObject(out2) && out2.id === ASSET_ID && out2.title === asset.title && out2.author === asset.author && deepEqual(out2.license, asset.license)
      && Array.isArray(out2.formats) && out2.formats.includes("gltf"),
      "A02 の詳細が、選んだ素材・CC0・glTF として記録されていません。");

    // A03: the 1k selection and its total, before any download.
    const okList = (list) => Array.isArray(list) && list.length > 0 && list.every((f) => isObject(f) && isString(f.path) && Number.isInteger(f.sizeBytes) && f.sizeBytes > 0);
    const sumSizes = (list) => list.reduce((s, f) => s + f.sizeBytes, 0);
    const a03 = byId.A03;
    const out3 = a03.output;
    check(isObject(out3) && okList(out3.expanded) && out3.expanded.length === 5 && out3.totalBytes === sumSizes(out3.expanded) && out3.totalBytes <= BUDGET
      && a03.observations.within_budget === true && a03.observations.max_bytes === BUDGET && a03.observations.sizes_known === true && netOf(a03).requests === 0,
      "A03 が、取得の前に分かった1kの5ファイルと予算内の合計として記録されていません。");

    // A04: the 8k selection exceeds the budget; the original stopped before any request.
    const a04 = byId.A04;
    const out4 = a04.output;
    check(isObject(out4) && okList(out4.expanded) && out4.totalBytes === sumSizes(out4.expanded) && out4.maxBytes === BUDGET && a04.input.max_bytes === BUDGET
      && out4.totalBytes > BUDGET && a04.observations.exceeds_by_bytes === out4.totalBytes - BUDGET
      && a04.observations.download_requests === 0 && a04.observations.budget_dir_created === false && netOf(a04).requests === 0,
      "A04 が、予算を超えて取得の通信0件・保存フォルダーなしで止まった記録になっていません。");
    const budgetError = isObject(a04.error) ? a04.error.message : null;
    // The original formats sizes in base 1024 and labels them MB; the film states both.
    check(isString(budgetError) && /^Selection is [0-9.]+ MB, above the [0-9.]+ MB limit\./.test(budgetError)
      && budgetError.includes(`${(out4.totalBytes / MIB).toFixed(1)} MB`) && budgetError.includes(`${(BUDGET / MIB).toFixed(1)} MB limit`),
      "A04 の原典の例外の文が、記録の合計と予算に合いません。");

    // A05–A07: original errors and the skipped provider.
    for (const id of ["A05", "A06"]) {
      const r = byId[id];
      check(r.output === null && isObject(r.error) && r.error.name === ERRORS[id] && isString(r.error.message) && netOf(r).requests === 0,
        `${id} が、原典の ${ERRORS[id]} で止まった記録になっていません。`);
    }
    const a07 = byId.A07;
    const fab7 = provider(a07.output && a07.output.providers, "fab");
    check(a07.input.request.downloadableOnly === true && deepEqual(a07.input.request.providers, ["fab"]) && !a07.error
      && Array.isArray(a07.output.results) && a07.output.results.length === 0 && a07.output.providers.length === 1
      && fab7 && fab7.status === "skipped" && netOf(a07).requests === 0,
      "A07 が、Fab は skipped（エラーではない）・通信なしとして記録されていません。");

    // A08: the five actual files.
    const a08 = byId.A08;
    const out8 = a08.output;
    check(isObject(out8) && out8.asset_id === ASSET_ID && a08.input.max_bytes === BUDGET && deepEqual(a08.input.selection, a03.input.selection) && deepEqual(out8.asset, asset),
      "A08 の入力・素材が A03 と同じ選択になっていません。");
    const manifest = out8.manifest;
    check(Array.isArray(manifest) && manifest.length === 5 && isString(out8.folder)
      && manifest.every((f) => isObject(f) && isString(f.path) && f.public_path === `outputs/assets/${out8.folder}/${f.path}` && isString(f.url) && hostOf(f.url) === HOSTS[1]
        && Number.isInteger(f.bytes) && f.bytes > 0 && f.bytes === f.api_size && f.bytes === f.selection_size
        && /^[0-9a-f]{32}$/.test(f.md5 || "") && f.md5 === f.api_md5 && /^[0-9a-f]{64}$/.test(f.sha256 || "")
        && isObject(f.network) && f.network.status === 200 && f.network.bytes === f.bytes && f.network.sha256 === f.sha256),
      "A08 の5ファイルのバイト数・MD5・SHA-256 が、Poly Haven の値と通信の記録に一致しません。");
    const total = manifest.reduce((s, f) => s + f.bytes, 0);
    const paths = manifest.map((f) => f.path).sort();
    check(total === out3.totalBytes && isObject(out8.download) && total === out8.download.bytes && Array.isArray(out8.download.files)
      && deepEqual([...out8.download.files].sort(), paths) && deepEqual(out3.expanded.map((f) => f.path).sort(), paths)
      && manifest.every((f) => out3.expanded.find((e) => e.path === f.path).sizeBytes === f.bytes)
      && isObject(out8.bundle) && out8.bundle.file_count === manifest.length && out8.bundle.total_bytes === total,
      "A08 で取得した5ファイルが、A03 で取得の前に見た選択と一致しません。");
    const calls8 = netOf(a08).calls;
    check(calls8.length === manifest.length && a08.observations.download_requests === manifest.length
      && deepEqual(calls8.map((c) => c.url).sort(), manifest.map((f) => f.url).sort())
      && calls8.every((c) => { const f = manifest.find((x) => x.url === c.url); return f && c.sha256 === f.sha256 && c.bytes === f.bytes; }),
      "A08 の取得の通信が、5ファイルそのものになっていません。");
    const gltf = out8.gltf;
    const entry = manifest.find((f) => f.path.endsWith(".gltf"));
    check(isObject(gltf) && gltf.version === "2.0" && entry && gltf.entry === entry.path && isObject(gltf.counts)
      && ["meshes", "triangles", "vertices"].every((k) => Number.isInteger(gltf.counts[k]) && gltf.counts[k] > 0)
      && Array.isArray(gltf.buffers) && gltf.buffers.length > 0 && gltf.buffers.every((b) => isObject(b) && b.local === true && b.byteLength === b.file_bytes)
      && Array.isArray(gltf.images) && gltf.images.every((im) => isObject(im) && im.local === true)
      && Array.isArray(gltf.unreferenced_files) && gltf.unreferenced_files.length === 0
      && Array.isArray(gltf.accessors_outside_buffers) && gltf.accessors_outside_buffers.length === 0,
      "A08 の glTF 2.0 の参照・構造の記録が想定と違います。");

    // Runner checks and summary.
    const v = runs.verification;
    const s = runs.summary;
    check(isObject(v) && v.status === "passed" && v.total === PIN.checks && v.passed === PIN.checks && Array.isArray(v.checks) && v.checks.length === PIN.checks
      && v.checks.every((x) => isObject(x) && isString(x.name) && x.passed === true), `実行時の${PIN.checks}件の確認がすべて通った記録になっていません。`);
    check(isObject(s) && s.operations === IDS.length && s.downloaded_models === 1 && s.files === manifest.length && s.bytes === total
      && s.checks_total === PIN.checks && s.checks_passed === PIN.checks,
      "実行記録の集計（8操作・1モデル・5ファイル・合計バイト数・確認数）が一致しません。");

    // Independent production-side checks of the same bytes.
    const ia = indep.actual_asset;
    check(indep.status === "passed" && indep.total === PIN.independent && Array.isArray(indep.checks) && indep.checks.length === PIN.independent
      && indep.checks.every((x) => isObject(x) && x.passed === true) && indep.source_commit === PIN.commit && indep.source_sha256 === SHA["vendor-lock.json"]
      && indep.human_approval === false,
      `independent-checks.json の${PIN.independent}件が、この固定版に対してすべて通った記録になっていません。`);
    check(isObject(ia) && ia.title === asset.title && ia.author === asset.author && ia.license === asset.license.name && ia.bytes === total
      && ia.meshes === gltf.counts.meshes && ia.triangles === gltf.counts.triangles && ia.vertices === gltf.counts.vertices
      && Array.isArray(ia.files) && ia.files.length === manifest.length
      && ia.files.every((x) => { const f = manifest.find((y) => isObject(x) && y.path === x.path); return f && x.sha256 === f.sha256 && x.md5 === f.md5 && x.bytes === f.bytes; }),
      "独立した確認の実ファイル（バイト数・MD5・SHA-256・メッシュ・三角形・頂点）が、実行記録と一致しません。");

    // Offline replay of the captured responses in a new Node process.
    const rc = Array.isArray(replay.checks) ? replay.checks : [];
    const replayedFiles = rc.filter((x) => isObject(x) && isString(x.name) && x.name.startsWith("A08 entire downloaded bytes ")).length;
    check(replay.status === "passed" && replay.total === PIN.replay && rc.length === PIN.replay && rc.every((x) => isObject(x) && x.passed === true)
      && replay.source_commit === PIN.commit && replay.actual_record_sha256 === SHA["asset-runs.json"]
      && replay.replayed_responses === PIN.replayedResponses && replay.external_network_calls === 0
      && replay.all_five_downloaded_files_byte_identical === true && replay.human_approval === false
      && isString(replay.method) && replay.method.includes("Offline replay") && replayedFiles === manifest.length,
      "reproduction-checks.json が、通信なしの再生29件と5ファイルのバイト一致として記録されていません。");

    // Screenshot provenance.
    check(screens.format === FORMAT.screens && screens.no_image_editing === true && screens.actual_outputs_unchanged === true && screens.physical_ios_tested === false
      && Array.isArray(screens.screens) && screens.screens.length === 2, "screens.json の形が想定と違います。");
    for (const [id, expected] of Object.entries(SCREENS)) {
      const sc = screens.screens.find((x) => isObject(x) && x.id === id);
      check(sc && sc.image === expected.image && sc.case_id === expected.case_id && sc.width === expected.width && sc.height === expected.height
        && sc.image_format === "JPEG" && sc.file_sha256 === SHA[expected.image] && sc.run_sha256 === SHA["asset-runs.json"]
        && /^[0-9a-f]{64}$/.test(sc.rgb_sha256 || "") && isString(sc.source) && sc.source.includes("GLTFLoader") && sc.source.includes(expected.source),
        `screens.json の ${expected.image} の記録が素材と一致しません。`);
    }

    const files = manifest
      .map((f, i) => ({ path: f.path, bytes: f.bytes, md5: f.md5, kind: kindOf(f.path), role: roleOf(f.path), i }))
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.i - b.i);
    return {
      repository: up.repository,
      commit: up.commit,
      version: up.version,
      three: runs.three.version,
      checks: v.total,
      independent: indep.total,
      replay: replay.total,
      replayedFiles,
      network: { total: allCalls.length, api: apiCalls, files: fileCalls },
      operations: results.length,
      models: s.downloaded_models,
      query: a01.input.request.query,
      types: a01.input.request.types,
      limit: a01.input.request.limit,
      candidates,
      ph: { name: ph.name, status: ph.status, count: ph.count },
      fab: { name: fab.name, status: fab.status, count: fab.count },
      a07: fab7.status,
      budget: BUDGET,
      oneK: { res: a03.input.selection.resolution, bytes: out3.totalBytes, files: out3.expanded.length },
      eightK: { res: a04.input.selection.resolution, bytes: out4.totalBytes, requests: a04.observations.download_requests, error: budgetError, errorName: a04.error.name },
      files,
      total,
      matched: manifest.filter((f) => f.md5 === f.api_md5 && f.bytes === f.api_size).length,
      gltf: { version: gltf.version, meshes: gltf.counts.meshes, triangles: gltf.counts.triangles, vertices: gltf.counts.vertices },
      asset: { title: asset.title, author: asset.author, provider: asset.provider, license: asset.license.name },
    };
  }

  const SERIF = '"Yu Mincho", YuMincho, "Hiragino Mincho ProN", "Noto Serif JP", serif';
  const SANS = '"Yu Gothic UI", "Yu Gothic", YuGothic, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, system-ui, sans-serif';
  const MONO = 'Consolas, "Cascadia Mono", Menlo, ui-monospace, monospace';
  const font = (size, weight = 500, family = SANS) => `${weight} ${size}px ${family}`;

  async function loadFonts() {
    if (!document.fonts || typeof document.fonts.load !== "function") return;
    const sample = "Web用の木箱がほしい探す候補件容量取得前見る予算内超過止まった5ファイル照合一致実物を3Dで確かめるスマホパソコン右へ回す最初の向き 0123456789 MiB → wooden_crate_01";
    const specs = [font(88, 700, SERIF), font(72, 700, SERIF), font(52, 700), font(52, 800), font(48, 700), font(24, 500), font(18, 500), font(22, 700, MONO), font(20, 500, MONO)];
    await Promise.all(specs.map((spec) => document.fonts.load(spec, sample).catch(() => [])));
    await document.fonts.ready;
  }

  async function load() {
    check(location.protocol !== "file:", FILE_MESSAGE);
    check(globalThis.crypto && crypto.subtle, "このブラウザーでは SHA-256 を計算できません。https か http://localhost で開いてください。");
    const manifestBytes = await fetchBytes(MANIFEST.path);
    const digest = await sha256Hex(manifestBytes);
    check(digest === MANIFEST.sha256, `data-hashes.json の SHA-256 が固定値と一致しません（読み込んだ値 ${digest}）。`);
    const manifest = parseJson(manifestBytes, "data-hashes.json");
    check(isObject(manifest) && manifest.format === MANIFEST.format && manifest.source_commit === PIN.commit && Array.isArray(manifest.files)
      && manifest.files.length === ASSETS.length && ASSETS.every((a, i) => isObject(manifest.files[i]) && manifest.files[i].path === a.path
        && manifest.files[i].sha256 === a.sha256 && manifest.files[i].bytes === a.bytes),
      "data-hashes.json の8件の対象・SHA-256・バイト数が、この映像ソースに固定した値と一致しません。");
    manifestDigest = digest;
    showAssets();

    const bytes = {};
    const outcomes = await Promise.allSettled(ASSETS.map(async (asset) => {
      const data = await fetchBytes(`assets/${asset.path}`);
      const actual = await sha256Hex(data);
      const ok = actual === asset.sha256 && data.byteLength === asset.bytes;
      assetState.set(asset.path, { ok, actual, size: data.byteLength });
      showAssets();
      check(ok, `${asset.path} の SHA-256 またはバイト数が data-hashes.json と一致しません（読み込んだ値 ${actual}・${int(data.byteLength)} バイト）。`);
      bytes[asset.path] = data;
    }));
    const failed = outcomes.find((o) => o.status === "rejected");
    if (failed) throw failed.reason;

    const json = {};
    for (const asset of ASSETS) if (asset.path.endsWith(".json")) json[asset.path] = parseJson(bytes[asset.path], asset.path);
    let data;
    try {
      data = verify(json);
    } catch (error) {
      if (error instanceof CheckError) throw error;
      throw new CheckError(`素材の形が想定と違います（${error && error.message ? error.message : "不明"}）。`);
    }
    data.images = {
      phone: await decodeJpeg(bytes["phone.jpg"], "phone.jpg", SCREENS.phone),
      desktop: await decodeJpeg(bytes["desktop.jpg"], "desktop.jpg", SCREENS.desktop),
    };
    for (const [name, rect] of Object.entries(FRAMING)) {
      const s = SCREENS[rect.image];
      check(rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0 && rect.x + rect.w <= s.width && rect.y + rect.h <= s.height,
        `切り抜き ${name} が ${s.image}（${s.width}×${s.height}）の外に出ています。`);
    }
    await loadFonts();
    return data;
  }

  // --- Time helpers (all values derive from t) ------------------------------------------------

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const enter = (t, at, d = 0.45) => ease(ramp(t, at, at + d));

  function sceneAlpha(t, s) {
    if (t < s.in || (t >= s.out && !s.last)) return 0;
    const fadeIn = s.n === 1 ? 1 : ease(ramp(t, s.in, s.in + 0.35));
    const fadeOut = s.last ? 1 : 1 - ramp(t, s.out - 0.35, s.out);
    return Math.min(fadeIn, fadeOut);
  }

  // --- Drawing helpers ------------------------------------------------------------------------

  // The viewer's palette: warm paper, charcoal ink, burnt orange and ochre accents, green for a match.
  const C = {
    paper: "#f6f1e8",
    paper2: "#efe7d9",
    raised: "#fffcf6",
    ink: "#221e1a",
    ink2: "#574e45",
    rule: "#d8ccb9",
    orange: "#c2410c",
    orangeDeep: "#9a3412",
    ochre: "#a86a12",
    ochreBg: "#f6ead2",
    stopBg: "#fae6da",
    green: "#2c7046",
    greenBg: "#e3eee4",
  };

  let film = null;

  function layer(alpha, dy, fn) {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (dy) ctx.translate(0, dy);
    fn();
    ctx.restore();
  }

  // Draws one line; shrinks to fit `max` down to `min`, then compresses as a last resort.
  function text(str, x, y, o = {}) {
    const family = o.family || SANS;
    const weight = o.weight || 500;
    let size = o.size || 24;
    ctx.font = font(size, weight, family);
    if (o.max) {
      const min = o.min || size;
      while (size > min && ctx.measureText(str).width > o.max) {
        size -= 1;
        ctx.font = font(size, weight, family);
      }
    }
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = "alphabetic";
    if (o.max) ctx.fillText(str, x, y, o.max);
    else ctx.fillText(str, x, y);
    return Math.min(ctx.measureText(str).width, o.max || Infinity);
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function box(x, y, w, h, o = {}) {
    rr(x, y, w, h, o.r === undefined ? 10 : o.r);
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    if (o.stroke) {
      ctx.lineWidth = o.lw || 2;
      ctx.strokeStyle = o.stroke;
      ctx.setLineDash(o.dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function pill(label, x, y, o) {
    const size = o.size || 16;
    ctx.font = font(size, 700);
    const w = ctx.measureText(label).width + size * 1.3;
    const h = size + 16;
    const left = o.align === "right" ? x - w : x;
    box(left, y - h / 2, w, h, { fill: o.bg, stroke: o.stroke, lw: 2, r: h / 2 });
    text(label, left + w / 2, y + size * 0.36, { size, weight: 700, color: o.color, align: "center" });
    return w;
  }

  function tick(cx, cy, r, color) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = r * 0.22;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.36);
    ctx.lineTo(cx + r * 0.48, cy - r * 0.34);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }

  // A file-format tag drawn as a small paper sheet with a folded corner (explanatory graphic).
  function fileTag(kind, x, y) {
    const w = 58;
    const h = 46;
    const f = 12;
    const tone = kind === "glTF" ? { bg: C.stopBg, ink: C.orangeDeep } : kind === "BIN" ? { bg: C.paper2, ink: C.ink } : { bg: C.ochreBg, ink: C.ochre };
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - f, y);
    ctx.lineTo(x + w, y + f);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = tone.bg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = tone.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - f, y);
    ctx.lineTo(x + w - f, y + f);
    ctx.lineTo(x + w, y + f);
    ctx.stroke();
    text(kind, x + w / 2, y + h - 13, { size: 17, weight: 700, family: MONO, color: tone.ink, align: "center" });
  }

  // Draws a crop of a verified screenshot at scale s with a thin paper frame. Pixels are not filtered.
  function crop(image, rect, x, y, s) {
    const w = rect.w * s;
    const h = rect.h * s;
    ctx.save();
    ctx.shadowColor = "rgba(34, 30, 26, 0.18)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = C.raised;
    ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, x, y, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.rule;
    ctx.strokeRect(x - 8, y - 8, w + 16, h + 16);
    return { x, y, w, h };
  }

  function headline(line, x, y, lt, o = {}) {
    const e = enter(lt, o.at || 0, 0.55);
    layer(e, (1 - e) * 16, () => text(line, x, y, { size: o.size || 72, weight: 700, family: SERIF, color: C.ink, max: o.max || 1136, min: 68 }));
  }

  function drawChrome(t) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, LW, 6);
    const x0 = CX + 72;
    const x1 = CX + 1208;
    text("3D Asset Server ・ Web用の3D素材を探して取得する", x0, 46, { size: 20, weight: 700, color: C.ink2, max: 640, min: 16 });
    ctx.fillStyle = C.rule;
    ctx.fillRect(x0, 66, 1136, 1);
    const sceneIndex = t >= DURATION ? SCENES.length - 1 : SCENES.findIndex((s) => t >= s.in && t < s.out);
    const scene = SCENES[sceneIndex];
    ctx.font = font(20, 700);
    const gap = 30;
    const widths = RAIL.map((label) => ctx.measureText(label).width);
    let x = x1 - widths.reduce((sum, w) => sum + w, 0) - gap * (RAIL.length - 1);
    RAIL.forEach((label, i) => {
      // Scene 1 is the request; scenes 2–5 map to the four steps; the last scene lights all four.
      const on = scene && (scene.last || i === sceneIndex - 1);
      text(label, x, 46, { size: 20, weight: 700, color: on ? C.ink : C.ink2 });
      if (on) {
        ctx.fillStyle = C.orange;
        ctx.fillRect(x, 54, widths[i], 4);
      }
      x += widths[i] + gap;
    });
    text("保存した実行記録と閲覧ページの実画面から描いた映像 ・ 無音", x0, LH - 20, { size: 16, color: C.ink2, max: 760, min: 12 });
    text(`${film.repository} ${short(film.commit)}`, x1, LH - 20, { size: 15, family: MONO, color: C.ink2, align: "right" });
  }

  // --- Scenes ----------------------------------------------------------------------------------

  // 0–4 s. Visible at frame 0: the request and the actual crate.
  function sceneAsk(lt) {
    const a = film.asset;
    ctx.fillStyle = C.orange;
    ctx.fillRect(72, 186, 6, 304);
    text("Web用の", 100, 262, { size: 88, weight: 700, family: SERIF, color: C.ink, max: 560, min: 72 });
    text("木箱がほしい", 100, 366, { size: 88, weight: 700, family: SERIF, color: C.ink, max: 560, min: 72 });
    const r = crop(film.images.desktop, FRAMING.desktopCrate, 690, 112, 1.44);
    const e = enter(lt, 0.3);
    layer(e, (1 - e) * 12, () => text(`${a.license}・容量を見てから`, 100, 466, { size: 52, weight: 700, color: C.orangeDeep, max: 560, min: 48 }));
    layer(enter(lt, 0.5), 0, () => {
      text("固定版 3D Asset Server の原典コードで", 72, 552, { size: 24, color: C.ink2, max: 580, min: 18 });
      text(`${film.ph.name} を実際に検索・取得した記録`, 72, 586, { size: 24, color: C.ink2, max: 580, min: 18 });
    });
    layer(enter(lt, 0.6), 0, () => {
      text(`取得した実物 ${a.title} ・ 閲覧ページの実画面（3D表示部を切り抜き）`, r.x - 8, r.y + r.h + 40, { size: 17, color: C.ink2, max: r.w + 16, min: 13 });
      text(`${a.author} / ${a.provider} / ${a.license}`, r.x - 8, r.y + r.h + 66, { size: 17, weight: 700, color: C.ink2, max: r.w + 16, min: 13 });
    });
  }

  // 4–8 s. A01: three candidates, provider states.
  function sceneSearch(lt) {
    const d = film;
    headline(`探す：候補は${d.candidates.length}件`, 72, 146, lt);
    layer(enter(lt, 0.3), 0, () => {
      text("検索語", 72, 212, { size: 22, weight: 700, color: C.ink2 });
      ctx.font = font(30, 700, MONO);
      const qw = ctx.measureText(d.query).width + 32;
      box(150, 182, qw, 44, { fill: C.raised, stroke: C.ink, lw: 2, r: 8 });
      text(d.query, 166, 214, { size: 30, weight: 700, family: MONO, color: C.ink });
      text(`${d.types.join("・")} ・ 無料 ・ ${d.limit}件まで ・ 配信元2つ`, 150 + qw + 18, 212, { size: 22, color: C.ink2, max: 1058 - qw - 18, min: 16 });
    });
    d.candidates.forEach((c, i) => {
      const y = 248 + i * 112;
      const chosen = i === 0;
      const e = enter(lt, 0.45 + i * 0.12, 0.45);
      layer(e, 0, () => {
        ctx.translate((1 - e) * 24, 0);
        box(72, y, 690, 98, { fill: chosen ? C.raised : C.paper2, stroke: chosen ? C.orange : C.rule, lw: chosen ? 3 : 1.5, r: 12 });
        text(String(i + 1), 104, y + 62, { size: 40, weight: 800, color: chosen ? C.orange : C.ink2, align: "center" });
        text(c.title, 140, y + 54, { size: 48, weight: 700, color: C.ink, max: chosen ? 460 : 600, min: 38 });
        text(`${c.author} ・ ${c.license} ・ 無料`, 140, y + 84, { size: 20, color: C.ink2, max: 600, min: 15 });
      });
      if (chosen) layer(enter(lt, 0.95, 0.4), 0, () => pill("選んだ", 744, y + 40, { align: "right", size: 22, bg: C.orange, color: "#fff" }));
    });
    layer(enter(lt, 0.7), 0, () => text("配信元ごとの状態", 800, 272, { size: 22, weight: 700, color: C.ink2 }));
    const card = (y, p, tone, detail, at) => {
      const e = enter(lt, at, 0.45);
      layer(e, (1 - e) * 14, () => {
        box(800, y, 408, 128, { fill: tone.bg, stroke: tone.ink, lw: 2, r: 12 });
        text(p.name, 824, y + 52, { size: 36, weight: 700, color: C.ink, max: 230, min: 26 });
        text(p.status, 1184, y + 56, { size: 52, weight: 800, family: MONO, color: tone.ink, align: "right" });
        text(detail, 824, y + 102, { size: 22, color: C.ink, max: 360, min: 15 });
      });
    };
    card(290, d.ph, { bg: C.greenBg, ink: C.green }, `${d.ph.count}件 ・ API で検索`, 0.8);
    card(440, d.fab, { bg: C.ochreBg, ink: C.ochre }, `${d.fab.count}件 ・ リンクだけ（通信なし）`, 0.95);
    layer(enter(lt, 1.2), 0, () => {
      text(`A01 の保存記録。候補の画像は使っていません。順位と件数は再実行で変わりえます。`, 72, 622, { size: 18, color: C.ink2, max: 1136, min: 13 });
      text(`A07：${d.fab.name} を直接取得できるものだけに絞ると ${d.a07}（エラーではなく、通信もしません）`, 72, 650, { size: 18, color: C.ink2, max: 1136, min: 13 });
    });
  }

  // 8–12 s. A03/A04: 1k fits the budget; 8k exceeds it and the original stops before any request.
  function sceneBudget(lt) {
    const d = film;
    headline("取得の前に、容量を見る", 72, 146, lt);
    const X0 = 470;
    const PER = 400 / d.budget; // the 4 MiB budget is 400 px wide
    const budgetX = X0 + d.budget * PER;
    const END = 1208;
    const BREAK = 1086;
    const rows = [
      { y: 290, r: d.oneK, color: C.green, at: 0.35 },
      { y: 438, r: d.eightK, color: C.orange, at: 0.7 },
    ];
    layer(enter(lt, 0.25), 0, () => {
      text(`予算 ${mibLabel(d.budget)} MiB`, budgetX, 236, { size: 30, weight: 800, color: C.ink, align: "center" });
      text(`${int(d.budget)} バイト`, budgetX + 92, 236, { size: 18, color: C.ink2 });
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(budgetX, 252);
      ctx.lineTo(budgetX, 500);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    rows.forEach((row, i) => {
      const e = enter(lt, row.at, 0.4);
      layer(e, 0, () => {
        text(row.r.res, 72, row.y + 40, { size: 56, weight: 800, family: SERIF, color: C.ink });
        text(`${mibLabel(row.r.bytes)} MiB`, 158, row.y + 40, { size: 52, weight: 800, color: row.color, max: 300, min: 44 });
        const full = Math.min(END, X0 + row.r.bytes * PER) - X0;
        const grow = inOut(ramp(lt, row.at + 0.1, row.at + (i === 0 ? 0.45 : 0.75)));
        const w = Math.max(2, full * grow);
        box(X0, row.y, w, 52, { fill: row.color, r: 6 });
        if (X0 + row.r.bytes * PER > END && X0 + w > BREAK + 24) {
          // Scale break: the true length would be far off the frame.
          ctx.fillStyle = C.paper;
          for (const dx of [0, 16]) {
            ctx.beginPath();
            ctx.moveTo(BREAK + dx, row.y - 4);
            ctx.lineTo(BREAK + dx + 8, row.y - 4);
            ctx.lineTo(BREAK + dx - 2, row.y + 56);
            ctx.lineTo(BREAK + dx - 10, row.y + 56);
            ctx.closePath();
            ctx.fill();
          }
        }
      });
    });
    layer(enter(lt, 0.8), 0, () => text(`予算内 ・ ${d.oneK.files}ファイルの大きさが取得の前に分かる（A03）`, 158, 380, { size: 24, color: C.ink, max: 1050, min: 17 }));
    layer(enter(lt, 1.45, 0.35), 0, () => {
      const times = Math.round(d.eightK.bytes / d.budget);
      text(`予算の約${times}倍`, 1066, 438 + 36, { size: 26, weight: 800, color: "#fff", align: "right" });
      ctx.beginPath();
      ctx.arc(budgetX, 438 + 26, 24, 0, Math.PI * 2);
      ctx.fillStyle = C.ink;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(budgetX - 9, 438 + 17);
      ctx.lineTo(budgetX + 9, 438 + 35);
      ctx.moveTo(budgetX + 9, 438 + 17);
      ctx.lineTo(budgetX - 9, 438 + 35);
      ctx.stroke();
      ctx.lineCap = "butt";
      text(`予算超過 → 原典が取得の前に止めた ・ 取得の通信 ${d.eightK.requests}件 ・ 保存フォルダーなし（A04）`, 158, 528, { size: 24, weight: 700, color: C.orangeDeep, max: 1050, min: 17 });
    });
    layer(enter(lt, 1.6), 0, () => {
      box(72, 562, 1136, 58, { fill: C.raised, stroke: C.rule, lw: 1.5, r: 8 });
      ctx.fillStyle = C.orange;
      ctx.fillRect(72, 562, 6, 58);
      text(`${d.eightK.errorName}: ${d.eightK.error}`, 96, 599, { size: 21, weight: 700, family: MONO, color: C.ink, max: 1092, min: 14 });
      text(`原典の例外の文（そのまま）。原典は1024進の値を MB と表記（${(d.eightK.bytes / MIB).toFixed(1)} MB ＝ ${mibLabel(d.eightK.bytes)} MiB）。棒は合計バイト数の説明図で、取得の進み具合ではありません。`,
        72, 652, { size: 17, color: C.ink2, max: 1136, min: 12 });
    });
  }

  // 12–17 s. A08: the five actual files, sizes and MD5 against Poly Haven's files API.
  function sceneFiles(lt) {
    const d = film;
    headline(`${d.oneK.res} の${d.files.length}ファイルを取得`, 72, 146, lt);
    d.files.forEach((f, i) => {
      const y = 182 + i * 78;
      const e = enter(lt, 0.3 + i * 0.1, 0.4);
      layer(e, 0, () => {
        ctx.translate((1 - e) * 20, 0);
        box(72, y, 728, 66, { fill: C.raised, stroke: C.rule, lw: 1.5, r: 10 });
        fileTag(f.kind, 88, y + 10);
        text(f.path, 162, y + 30, { size: 22, weight: 700, family: MONO, color: C.ink, max: 436, min: 14 });
        text(f.role, 162, y + 56, { size: 18, color: C.ink2, max: 436 });
        text(int(f.bytes), 694, y + 32, { size: 24, weight: 700, color: C.ink, align: "right" });
        text("バイト", 694, y + 56, { size: 15, color: C.ink2, align: "right" });
      });
      layer(enter(lt, 1.0 + i * 0.08, 0.3), 0, () => {
        tick(732, y + 28, 15, C.green);
        text("一致", 732, y + 60, { size: 15, weight: 700, color: C.green, align: "center" });
      });
    });
    const e = enter(lt, 0.6);
    layer(e, (1 - e) * 14, () => {
      const w = text(String(d.files.length), 840, 290, { size: 112, weight: 800, family: SERIF, color: C.orange });
      text("ファイル", 840 + w + 12, 284, { size: 52, weight: 700, color: C.ink });
      text(`${mibLabel(d.total)} MiB`, 840, 360, { size: 52, weight: 800, color: C.ink });
      text(`${int(d.total)} バイト ・ ${d.models}モデル`, 840, 396, { size: 22, color: C.ink2 });
    });
    layer(enter(lt, 1.15), 0, () => {
      text("MD5・大きさ", 840, 462, { size: 26, weight: 700, color: C.ink2 });
      text(`${d.matched}/${d.files.length} 一致`, 840, 520, { size: 52, weight: 800, color: C.green });
      text(`${d.ph.name} の files API の値と照合`, 840, 554, { size: 20, color: C.ink2, max: 368, min: 15 });
    });
    layer(enter(lt, 1.35), 0, () => {
      text(`独立した確認 ${d.independent}件すべて通過 ・ 保存した応答を別の Node で通信なしに再生した確認 ${d.replay}件（${d.replayedFiles}ファイルともバイト一致。新しい検索ではありません）`,
        72, 622, { size: 18, color: C.ink2, max: 1136, min: 12 });
      text(`取得の通信は ${d.network.files}件でこの${d.files.length}ファイルだけ ・ glTF ${d.gltf.version} の参照はすべて同じフォルダーの実ファイル`, 72, 650, { size: 18, color: C.ink2, max: 1136, min: 12 });
    });
  }

  // 17–23 s. The actual crate in the viewer: phone default angle, desktop after two native Right presses.
  function sceneModel(lt) {
    const d = film;
    headline("取得した実物を、3Dで見る", 72, 136, lt);
    const HEIGHT = 392;
    const P = FRAMING.phoneCrate;
    const D = FRAMING.desktopCrate;
    const sP = HEIGHT / P.h;
    const sD = HEIGHT / D.h;
    const xP = 72;
    const xD = xP + P.w * sP + 40;
    const top = 164;
    const ep = enter(lt, 0.15, 0.6);
    layer(ep, (1 - ep) * 18, () => crop(d.images.phone, P, xP, top, sP));
    const ed = enter(lt, 0.45, 0.6);
    layer(ed, (1 - ed) * 18, () => crop(d.images.desktop, D, xD, top, sD));
    layer(enter(lt, 0.8), 0, () => {
      text("スマホ・最初の向き", xP, 618, { size: 48, weight: 700, color: C.ink, max: P.w * sP, min: 40 });
      text("パソコン・右へ回す2回", xD, 618, { size: 48, weight: 700, color: C.ink, max: D.w * sD, min: 40 });
    });
    layer(enter(lt, 1.0), 0, () => text(`glTF ${d.gltf.version} ・ メッシュ ${d.gltf.meshes} ・ 三角形 ${int(d.gltf.triangles)} ・ 頂点 ${int(d.gltf.vertices)}（実ファイルから数えた値）`,
      72, 652, { size: 22, color: C.ink, max: 1136, min: 15 }));
    layer(enter(lt, 1.1), 0, () => text(`閲覧ページの実画面2枚から3D表示部を切り抜き、拡大だけ。three ${d.three} の GLTFLoader が照合済みの${d.files.length}ファイルを描いた画面で、自動回転や生成した映像ではありません`,
      72, 678, { size: 15, color: C.ink2, max: 1136, min: 11 }));
  }

  // 23–28 s. Close: the flow and this case's results; holds for 4 s.
  function sceneEnd(lt) {
    const d = film;
    const e0 = enter(lt, 0.05, 0.5);
    layer(e0, (1 - e0) * 16, () => {
      let x = 72;
      RAIL.forEach((word, i) => {
        x += text(word, x, 178, { size: 76, weight: 700, family: SERIF, color: C.ink });
        if (i < RAIL.length - 1) x += 22 + text("→", x + 22, 172, { size: 60, weight: 700, color: C.orange }) + 22;
      });
    });
    layer(enter(lt, 0.2), 0, () => text(`${d.models}モデル ・ ${d.files.length}ファイル ・ ${mibLabel(d.total)} MiB`, 72, 280, { size: 52, weight: 800, color: C.ink, max: 790, min: 46 }));
    layer(enter(lt, 0.3), 0, () => {
      const w = pill(d.asset.license, 72, 350, { size: 40, bg: C.green, color: "#fff" });
      text(d.asset.title, 72 + w + 20, 366, { size: 44, weight: 700, color: C.ink, max: 790 - w - 20, min: 34 });
      text(`${d.asset.author} ・ ${d.asset.provider}`, 72, 420, { size: 30, weight: 700, color: C.ink2, max: 790, min: 22 });
    });
    layer(enter(lt, 0.4), 0, () => {
      text(`${d.operations}つの操作 ・ 実際の通信 ${d.network.total}件（API ${d.network.api}・ファイル ${d.network.files}） ・ ${d.eightK.res} は取得 ${d.eightK.requests}件で停止`, 72, 484, { size: 21, color: C.ink, max: 790, min: 14 });
      text(`実行時の確認 ${d.checks}件すべて通過 ・ 独立した確認 ${d.independent}件 ・ 通信なしの再生 ${d.replay}件`, 72, 516, { size: 21, color: C.ink, max: 790, min: 14 });
      text(`試した配信元は ${d.ph.name} と ${d.fab.name} の2つ（${d.fab.name} はリンクだけで通信なし）`, 72, 548, { size: 21, color: C.ink, max: 790, min: 14 });
    });
    const ei = enter(lt, 0.3, 0.5);
    layer(ei, (1 - ei) * 14, () => {
      const P = FRAMING.phoneCrate;
      const r = crop(d.images.phone, P, 900, 236, 308 / P.w);
      text("取得した実物（スマホの実画面）", r.x + r.w / 2, r.y + r.h + 36, { size: 17, color: C.ink2, align: "center", max: r.w });
    });
    layer(enter(lt, 0.5), 0, () => {
      text(`映像の編集：Claude Opus 5.5 ／ 3Dモデル：${d.asset.author}（${d.asset.provider}）。AI が作ったモデルではありません`, 72, 614, { size: 18, color: C.ink2, max: 1136, min: 12 });
      text(`値は原典 ${d.repository} ${short(d.commit)}（${d.version}）の関数と ${d.ph.name} の実データ。この映像の中で検索や取得はしていません`, 72, 642, { size: 18, color: C.ink2, max: 1136, min: 12 });
    });
  }

  function drawFrame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    drawChrome(t);
    ctx.translate(CX, CY);
    for (const s of SCENES) {
      const alpha = sceneAlpha(t, s);
      if (alpha > 0.001) layer(alpha, 0, () => s.draw(t - s.in));
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- Seek, preview and editor state -------------------------------------------------------

  let current = 0;  // time on the canvas
  let selected = 0; // last time chosen by the range, a scene button or window.seek; #reset returns here
  let playing = false;
  let loading = false;
  let raf = 0;
  let startNow = 0;
  let startTime = 0;

  const clampTime = (seconds) => {
    const value = Number(seconds);
    return Number.isFinite(value) ? Math.min(DURATION, Math.max(0, value)) : 0;
  };

  function showTime() {
    if (loading) {
      ui.clock.textContent = "照合中 ・ 時刻はまだありません";
    } else if (!film) {
      ui.clock.textContent = "停止（照合失敗）・ 映像なし";
    } else {
      ui.clock.textContent = `${current.toFixed(1)} / ${DURATION.toFixed(1)} 秒 ・ ${playing ? "再生中" : "停止中"}`;
    }
    ui.reset.textContent = `${selected.toFixed(1)}秒に戻す`;
  }

  function paint(t) {
    if (!film) throw new Error("素材の照合が済んでいないため描けません。");
    current = t;
    drawFrame(t);
    ui.time.value = String(t);
    showTime();
  }

  window.seek = (seconds) => {
    const t = clampTime(seconds);
    selected = t;
    stop();
    return window.motionReady.then(() => paint(t));
  };

  function setPlaying(on) {
    playing = on;
    ui.play.setAttribute("aria-pressed", on ? "true" : "false");
    ui.play.textContent = on ? "一時停止" : "再生";
    showTime();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (playing) setPlaying(false);
  }

  function previewFrame(now) {
    if (!playing) return;
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

  // Editor preview only; the renderer never plays. Each preview frame is still drawn from its own time.
  function play() {
    if (RENDER || !film || loading) return;
    startTime = current >= DURATION ? 0 : current;
    startNow = performance.now();
    setPlaying(true);
    raf = requestAnimationFrame(previewFrame);
  }

  function setControls(enabled) {
    for (const control of [ui.play, ui.reset, ui.time, ...ui.sceneList.querySelectorAll("button")]) control.disabled = !enabled;
  }

  function buildSceneList() {
    const items = SCENES.map((s) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = true;
      button.dataset.time = String(s.read);
      const time = document.createElement("span");
      time.className = "scene-time";
      time.textContent = `${s.in}–${s.out}秒`;
      const label = document.createElement("span");
      label.textContent = s.title;
      button.append(time, label);
      button.addEventListener("click", () => {
        window.seek(Number(button.dataset.time)).catch(fail);
      });
      li.append(button);
      return li;
    });
    ui.sceneList.replaceChildren(...items);
  }

  function setState(state, message) {
    ui.editor.dataset.state = state;
    ui.status.dataset.state = state;
    ui.status.textContent = message;
    ui.loading.hidden = state !== "loading";
  }

  function fail(error) {
    stop();
    loading = false;
    film = null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ui.stage.hidden = true;
    setControls(false);
    const reason = error && error.message ? error.message : String(error);
    setState("error", `照合に失敗したため、映像を描いていません。${reason}`);
    ui.errorText.textContent = reason;
    ui.errorBox.hidden = false;
    ui.retry.hidden = false;
    ui.retry.disabled = false;
    showAssets();
    showTime();
  }

  // One load at a time. Retry fetches the manifest and all eight files again; nothing is cached.
  // After any (re)load the editor is stopped at 0 s unless window.seek chose another time meanwhile.
  function start() {
    if (loading) return window.motionReady;
    stop();
    loading = true;
    film = null;
    manifestDigest = null;
    assetState.clear();
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ui.stage.hidden = true;
    ui.errorBox.hidden = true;
    ui.retry.disabled = true;
    setControls(false);
    selected = 0;
    current = 0;
    ui.time.value = "0";
    showAssets();
    setState("loading", `素材${ASSETS.length}件を読み込み、SHA-256 と実行記録を照合しています…`);
    showTime();
    const ready = load().then((data) => {
      loading = false;
      film = data;
      ui.stage.hidden = false;
      paint(selected);
      ui.retry.hidden = true;
      setControls(true);
      setState("ready", `${ASSETS.length}/${ASSETS.length} 一致。素材の SHA-256・バイト数と、固定版 ${short(PIN.commit)}・${IDS.length}操作の入力・実際の通信${NETWORK.total}件・確認${PIN.checks}件・独立した確認${PIN.independent}件・通信なしの再生${PIN.replay}件・5ファイルの MD5・実画面2枚の大きさの照合が通りました。この画面は保存済みの記録を描くだけで、検索・取得・AI は動きません。`);
      return true;
    });
    ready.catch(fail);
    window.motionReady = ready;
    return ready;
  }

  buildSceneList();
  ui.play.addEventListener("click", () => (playing ? stop() : play()));
  ui.reset.addEventListener("click", () => {
    window.seek(selected).catch(fail);
  });
  ui.time.addEventListener("input", () => {
    window.seek(ui.time.value).catch(fail);
  });
  ui.time.addEventListener("change", () => {
    window.seek(ui.time.value).catch(fail);
  });
  ui.time.addEventListener("keydown", (event) => {
    if (event.key === "Enter") window.seek(ui.time.value).catch(fail);
  });
  ui.retry.addEventListener("click", () => {
    start();
  });
  start();
})();
