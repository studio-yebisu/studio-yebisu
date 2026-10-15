// 事前に生成したPDFとページ画像を outputs/manifest.json から表示する。
// ブラウザでは変換しない。manifest にない値は作らず、欠けや不整合はそのまま知らせる。

const MANIFEST_URL = "outputs/manifest.json";
const SOURCE_URL = "inputs/event.md";
const REQUEST_URL = "request.txt";
const DEFAULT_ID = "paper";

const VARIANTS = {
  paper: { label: "A4で配る", kind: "A4版" },
  phone: { label: "細いページで読む", kind: "細いページ版" },
};

const IMAGE_EXTENSIONS = [".png", ".webp", ".jpg", ".jpeg"];
const HEX64 = /^[0-9a-f]{64}$/i;

const $ = (id) => document.getElementById(id);

let selected = idFromHash() ?? DEFAULT_ID;
let manifest = null;

function idFromHash() {
  const id = location.hash.slice(1);
  return Object.hasOwn(VARIANTS, id) ? id : null;
}

// 例のルートからの相対パスだけを受け付ける（スキーム・絶対パス・".." は拒否）
function safePath(value, extensions) {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return null;
  if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(value)) return null;
  if (value.split("/").some((part) => part === "." || part === "..")) return null;
  if (extensions && !extensions.some((ext) => value.toLowerCase().endsWith(ext))) return null;
  return value;
}

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;
const nonEmpty = (s) => (typeof s === "string" && s.trim() ? s.trim() : null);

function formatBytes(bytes) {
  const kb = (bytes / 1024).toFixed(1);
  return `${kb} KB（${bytes.toLocaleString("ja-JP")}バイト）`;
}

async function loadManifest() {
  let response;
  try {
    response = await fetch(MANIFEST_URL, { cache: "no-store" });
  } catch {
    return { state: "unreachable" };
  }
  if (response.status === 404) return { state: "missing" };
  if (!response.ok) return { state: "http", status: response.status };
  let data;
  try {
    data = await response.json();
  } catch {
    return { state: "invalid", errors: ["JSONとして読み取れません"] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { state: "invalid", errors: ["記録の形式が想定と異なります"] };
  }
  if (data.generated !== true) return { state: "not-generated" };
  if (!Array.isArray(data.variants)) {
    return { state: "invalid", errors: ["版の一覧（variants）がありません"] };
  }
  return { state: "ok", data };
}

function checkVariant(raw, id) {
  const errors = [];
  const label = nonEmpty(raw.label);
  if (!label) errors.push("表示名（label）がありません");
  const file = safePath(raw.file, [".pdf"]);
  if (!file) errors.push("PDFのパス（file）が不正です");
  const theme = nonEmpty(raw.theme);
  if (!theme) errors.push("テーマ（theme）の記録がありません");
  const size = Array.isArray(raw.size_mm) && raw.size_mm.length === 2
    && raw.size_mm.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0)
    ? raw.size_mm : null;
  if (!size) errors.push("用紙サイズ（size_mm）が不正です");
  if (!isPositiveInt(raw.page_count)) errors.push("ページ数（page_count）が不正です");
  if (!isPositiveInt(raw.bytes)) errors.push("ファイルサイズ（bytes）が不正です");
  if (typeof raw.pdf_sha256 !== "string" || !HEX64.test(raw.pdf_sha256)) {
    errors.push("PDFのSHA-256（pdf_sha256）が不正です");
  }

  const pages = [];
  if (!Array.isArray(raw.pages) || raw.pages.length === 0) {
    errors.push("ページ画像の一覧（pages）がありません");
  } else {
    raw.pages.forEach((page, i) => {
      const ok = page && typeof page === "object"
        && page.number === i + 1
        && safePath(page.image, IMAGE_EXTENSIONS)
        && isPositiveInt(page.width)
        && isPositiveInt(page.height);
      if (ok) {
        pages.push({ number: page.number, image: page.image, width: page.width, height: page.height });
      } else {
        errors.push(`${i + 1}番目のページ画像の記録が不正です`);
      }
    });
    if (isPositiveInt(raw.page_count) && raw.pages.length !== raw.page_count) {
      errors.push(`ページ数（${raw.page_count}）とページ画像の数（${raw.pages.length}）が一致しません`);
    }
  }

  if (errors.length) return { errors };
  return {
    variant: {
      id,
      label,
      file,
      theme,
      size,
      pageCount: raw.page_count,
      bytes: raw.bytes,
      sha256: raw.pdf_sha256.toLowerCase(),
      pages,
    },
  };
}

function setStatus(text, state = "info") {
  const status = $("status");
  status.textContent = text;
  status.dataset.state = state;
}

function clearOutput() {
  $("actions").hidden = true;
  $("facts").hidden = true;
  $("facts").replaceChildren();
  $("pages").hidden = true;
  $("pages").replaceChildren();
  for (const id of ["download", "open-pdf"]) $(id).removeAttribute("href");
}

function updateNav() {
  for (const link of document.querySelectorAll("[data-variant-link]")) {
    if (link.dataset.variantLink === selected) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
}

function addFact(list, term, value, className) {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value;
  if (className) dd.className = className;
  list.append(dt, dd);
}

function renderPages(variant) {
  const list = $("pages");
  const kind = VARIANTS[variant.id].kind;
  const [w, h] = variant.size;
  list.dataset.variant = variant.id;

  for (const page of variant.pages) {
    const item = document.createElement("li");
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.src = page.image;
    img.width = page.width;
    img.height = page.height;
    img.decoding = "async";
    img.loading = page.number === 1 ? "eager" : "lazy";
    img.alt = `${kind}PDF（${w}×${h}mm）の${page.number}ページ目（全${variant.pageCount}ページ）。`
      + "架空のワークショップ案内「紙からはじめる、小さな展示」を書き出したページの画像。本文は下の「原稿」で読めます。";

    const caption = document.createElement("figcaption");
    caption.textContent = `${page.number} / ${variant.pageCount}ページ（${variant.label}）— ${page.image}`;

    img.addEventListener("error", () => {
      const missing = document.createElement("p");
      missing.className = "page-missing";
      missing.textContent = `${page.number}ページ目の画像（${page.image}）を読み込めませんでした。PDF本体はダウンロードから確認できます。`;
      img.replaceWith(missing);
    }, { once: true });

    figure.append(img, caption);
    item.append(figure);
    list.append(item);
  }
  list.hidden = false;
}

function render() {
  updateNav();
  clearOutput();
  $("variant-name").textContent = VARIANTS[selected].label;

  if (!manifest) return;

  switch (manifest.state) {
    case "missing":
      setStatus("outputs/manifest.json が見つかりません。PDFがまだ生成されていないか、ファイルが欠けているため、PDFとページ画像は表示できません。", "error");
      return;
    case "unreachable":
      setStatus("outputs/manifest.json を読み込めませんでした。file:// で開いている場合は、README の手順でローカルのHTTPサーバーから開いてください。", "error");
      return;
    case "http":
      setStatus(`outputs/manifest.json の読み込みに失敗しました（HTTP ${manifest.status}）。PDFとページ画像は表示できません。`, "error");
      return;
    case "not-generated":
      setStatus("outputs/manifest.json に生成済みの記録（generated: true）がありません。PDFとページ画像は表示できません。", "error");
      return;
    case "invalid":
      setStatus(`outputs/manifest.json の内容が不正なため表示できません：${manifest.errors.join("／")}`, "error");
      return;
    default:
      break;
  }

  const matches = manifest.data.variants.filter((v) => v && typeof v === "object" && v.id === selected);
  if (matches.length === 0) {
    setStatus(`outputs/manifest.json に「${VARIANTS[selected].label}」（${selected}）の記録がありません。この版のPDFとページ画像は表示できません。`, "error");
    return;
  }
  if (matches.length > 1) {
    setStatus(`outputs/manifest.json に「${selected}」の記録が複数あるため、どれを表示すべきか判断できません。`, "error");
    return;
  }

  const result = checkVariant(matches[0], selected);
  if (result.errors) {
    setStatus(`「${VARIANTS[selected].label}」の記録が不正なため表示できません：${result.errors.join("／")}`, "error");
    return;
  }

  const variant = result.variant;
  const [w, h] = variant.size;
  const fileName = variant.file.split("/").pop();
  $("variant-name").textContent = variant.label;

  const download = $("download");
  download.href = variant.file;
  download.setAttribute("download", fileName);
  download.textContent = `PDFをダウンロード（${fileName}・${(variant.bytes / 1024).toFixed(1)} KB）`;
  $("open-pdf").href = variant.file;
  $("actions").hidden = false;

  const facts = $("facts");
  addFact(facts, "用紙", `${w}×${h}mm`);
  addFact(facts, "テーマ", variant.theme);
  addFact(facts, "バックエンド", nonEmpty(manifest.data.backend) ?? "記録なし");
  addFact(facts, "ページ数", `${variant.pageCount}ページ`);
  addFact(facts, "ファイル", `${variant.file}・${formatBytes(variant.bytes)}`);
  addFact(facts, "PDFのSHA-256", variant.sha256, "hash");
  addFact(facts, "原稿", safePath(manifest.data.source) ?? "記録なし");
  facts.hidden = false;

  renderPages(variant);
  setStatus(`「${variant.label}」：${w}×${h}mm・全${variant.pageCount}ページ。manifest に記録された事前生成のPDFと、全ページの画像を表示しています。`);
}

async function loadSource() {
  try {
    const response = await fetch(SOURCE_URL, { cache: "no-store" });
    if (!response.ok) return { state: "error" };
    const bytes = await response.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(bytes);
    let sha256 = null;
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return { state: "ok", text, sha256 };
  } catch {
    return { state: "error" };
  }
}

function showSource(source) {
  $("source-text").textContent = source.state === "ok"
    ? source.text
    : "（原稿を読み込めませんでした。上のリンクから inputs/event.md を直接開いてください）";
}

function showSourceCheck(m, source) {
  const note = $("source-check");
  if (source.state !== "ok") {
    note.textContent = "原稿を読み込めなかったため、manifest の記録とは照合していません。";
    return;
  }
  if (m.state !== "ok") {
    note.textContent = "outputs/manifest.json を利用できないため、原稿のSHA-256を記録と照合していません。";
    return;
  }
  const recorded = m.data.source_sha256;
  if (typeof recorded !== "string" || !HEX64.test(recorded)) {
    note.textContent = "manifest に原稿のSHA-256（source_sha256）が正しく記録されていないため、照合していません。";
    return;
  }
  if (!source.sha256) {
    note.textContent = "このブラウザ環境ではSHA-256を計算できないため、原稿と記録を照合していません。";
    return;
  }
  const recordedPath = safePath(m.data.source);
  const pathNote = recordedPath === SOURCE_URL ? "" : `（manifest の原稿パスは「${recordedPath ?? "記録なし"}」です）`;
  note.textContent = source.sha256 === recorded.toLowerCase()
    ? `ブラウザで読み込んだ原稿のSHA-256は、manifest の記録（source_sha256）と一致しました${pathNote}。`
    : `ブラウザで読み込んだ原稿のSHA-256が manifest の記録と一致しません${pathNote}。生成後に原稿が変わったか、改行コードなどが変換された可能性があります。`;
}

function showVerificationLink(m) {
  const note = $("verification-link");
  if (m.state !== "ok") {
    note.textContent = "outputs/manifest.json を利用できないため、確認の記録の場所はまだ表示できません。";
    return;
  }
  const path = safePath(m.data.verification, [".json"]);
  if (!path) {
    note.textContent = "manifest に確認の記録（verification）の場所がありません。";
    return;
  }
  const link = document.createElement("a");
  link.href = path;
  link.textContent = path;
  note.replaceChildren("生成時の確認の記録：", link, "（確認した内容と結果は記録ファイルを参照してください）");
}

async function loadRequest() {
  try {
    const response = await fetch(REQUEST_URL, { cache: "no-store" });
    if (!response.ok) return;
    const text = await response.text();
    if (text.trim()) $("request-text").textContent = text.trimEnd();
  } catch {
    // 読み込めないときは、ページに書いてある同じ文面をそのまま残す
  }
}

window.addEventListener("hashchange", () => {
  selected = idFromHash() ?? selected;
  render();
});

render();

const manifestPromise = loadManifest().then((m) => {
  manifest = m;
  render();
  showVerificationLink(m);
  return m;
});

const sourcePromise = loadSource().then((source) => {
  showSource(source);
  return source;
});

Promise.all([manifestPromise, sourcePromise]).then(([m, source]) => showSourceCheck(m, source));

loadRequest();
