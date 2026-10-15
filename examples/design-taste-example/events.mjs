// 余白図書室（架空）の催し一覧：DOMに触れない純粋な処理だけを置く。
// 入力の配列や各催しのオブジェクトは変更しない。

export const AUDIENCE_LABELS = Object.freeze({
  all: "すべて",
  children: "子ども",
  adults: "おとな",
  everyone: "どなたでも",
});

// 検索の対象は題名・説明・会場の三つだけ。日付・時刻・対象は含めない。
export const SEARCH_FIELDS = Object.freeze(["title", "description", "place"]);

// 合図（URLの #all / #children / #reading）で欄に入れる条件。
export const PRESETS = Object.freeze({
  all: Object.freeze({ audience: "all", query: "", label: "すべての催し" }),
  children: Object.freeze({ audience: "children", query: "", label: "子ども向けの催し" }),
  reading: Object.freeze({ audience: "all", query: "短編", label: "「短編」を含む催し" }),
});

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

// 対象は all 以外なら完全一致。検索語は各項目への文字どおりの部分一致で、
// 空白で区切った語ごとの AND にはしない。二つの条件は AND。順序は入力のまま。
export function filterEvents(events, { audience = "all", query = "" } = {}) {
  const needle = normalizeText(query);
  return events.filter((event) => {
    if (audience !== "all" && event.audience !== audience) return false;
    if (needle === "") return true;
    return SEARCH_FIELDS.some((field) => normalizeText(event[field]).includes(needle));
  });
}

// ISO の日付（YYYY-MM-DD）は暦の日付として扱い、端末のタイムゾーンに依存させない。
export function parseIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!match) throw new RangeError(`日付の形式が YYYY-MM-DD ではありません: ${iso}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function weekdayJa(iso) {
  const { year, month, day } = parseIsoDate(iso);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function formatDateJa(iso) {
  const { month, day } = parseIsoDate(iso);
  return `${month}月${day}日`;
}

export function presetFromHash(hash) {
  const name = String(hash ?? "").replace(/^#/, "");
  return Object.hasOwn(PRESETS, name) ? name : null;
}
