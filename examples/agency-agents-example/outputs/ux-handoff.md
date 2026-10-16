# こもれび つくる日 企画ガイド — 技術構成とUXの土台（UX Architect 段階）

> **架空のイベントです。** 「こもれび つくる日」（2026-11-07、木かげ交流室）は作例のための設定で、実在の開催・会場・予約受付はありません。

このページで作るもの: **スマホで6企画の時間・費用・対象年齢・予約の要否を比べ、時間が重ならない「回る予定」を選び、JSONで保存できる企画ガイド。**

本書は2段階のうち1段目、UX Architect の役割を適用した引き継ぎ書です。機械が読む正本は `outputs/ux-handoff.json`、CSSの土台は `foundation.css` です。2段目の Frontend Developer は、指定モデル Claude Opus 5.5 による**別の実行**でこの3つを読んで実装します。2つの役割を順番に当てはめる作業で、独立したエージェント同士の協調や自動ルーティングではありません。

---

## 0. 2つの役割と受け渡し

| 段階 | 役割ファイル | 入力 | 成果物 | 確認すること |
|---|---|---|---|---|
| 1（本書） | `vendor/agency-agents/design/design-ux-architect.md` | `input/event.json` | `outputs/ux-handoff.json`、`outputs/ux-handoff.md`、`foundation.css` | トークンが3テーマでそろっている、禁止事項（100vw・100vh・overflow:hidden・全画面ヒーロー）がない、6企画の表示規則と重なりの例が入力と一致する、受け入れ条件を合格済みと書いていない |
| 2（未実行） | `vendor/agency-agents/engineering/engineering-frontend-developer.md` | `input/event.json`、`outputs/ux-handoff.json`、`foundation.css` | `index.html`、`style.css`、`app.js`、`outputs/implementation.md` | 本書の受け入れ条件 A01〜A26。実行した確認と、実行していない確認を分けて記録する |

1段目の確認は、ファイルを読んで行う静的な確認だけです。ブラウザ表示・テスト・測定は行っていません。

## 1. 出典と適用範囲

- 出典: `msitarzewski/agency-agents`、固定コミット `bd956db032d907387e6b9ddebff3e18f1de8c679`。MIT（Copyright (c) 2025 AgentLand Contributors）。**コミュニティ作成のもので、Anthropic 公式ではありません。**
- README の「Option 3: Use as Reference」（読んで写し、調整して使う）に沿い、役割ファイルを読んで適用しました。アプリ、`install.sh`、サブエージェント機構、自動起動は使っていません。
- **参照先の欠落:** `design-ux-architect.md` の末尾には「詳しい手法は `ai/agents/architect.md` にある」と書かれていますが、このファイルは固定アーカイブにありません。中身は推測で補わず、渡された `design-ux-architect.md` だけを適用しました。
- 役割ファイルの Step 1 にある `ai/memory-bank/site-setup.md` などもありません。入力は `input/event.json` と依頼文だけです。

---

## 🏗️ CSS Architecture

### Design System Variables

**ファイル:** `foundation.css`（テンプレートの `css/design-system.css` と `layout.css` と `components.css` を1つにまとめたもの。理由は「テンプレートからの変更点」を参照）

**色の考え方:** 紙と墨のあたたかい地に、テラコッタ（ワークショップ・強調）と緑（主操作・選択済み）。重なりと失敗はテラコッタより深い赤茶で、必ず文言と組で示します。フォーカスはどの状態色とも重ならない藍色にしました。

| トークン | ライト | ダーク | 用途 |
|---|---|---|---|
| `--color-bg` | `#f7f1e6` | `#1b1815` | 紙の地 |
| `--color-surface` | `#fffaf2` | `#24201c` | カード・入力欄 |
| `--color-surface-sunk` | `#efe6d6` | `#14120f` | くぼみ・無効のボタン |
| `--color-text` | `#2a2420` | `#f2eadf` | 墨の本文 |
| `--color-text-muted` | `#5c5148` | `#c4b8a8` | 補足・項目名 |
| `--color-border` | `#ddd0bc` | `#3f3831` | 飾りの線 |
| `--color-border-strong` | `#857565` | `#8f8274` | 入力欄・ボタンの枠 |
| `--color-accent` / `-soft` | `#a8462a` / `#f6e6dc` | `#e3906f` / `#3b2820` | テラコッタ: ワークショップのタグ・架空表示の縦線 |
| `--color-action` / `-soft` | `#3f6b4a` / `#e3ecdf` | `#8dc79b` / `#213027` | 緑: 主ボタン・選択済み・トークのタグ |
| `--color-on-action` | `#ffffff` | `#10201a` | 緑の上の文字 |
| `--color-alert` / `-soft` | `#962f1c` / `#f8e3da` | `#f4a58e` / `#3a211a` | 重なり・読み込み失敗 |
| `--color-notice-soft` | `#f0e4c6` | `#332b1f` | 架空イベントの注記 |
| `--color-focus` | `#24477a` | `#9fc2f0` | フォーカスの線 |

コントラストの狙いは、本文とタグの文字が 4.5:1 以上、入力欄の枠が 3:1 以上です。上の値はこの狙いで**手計算で概算**したもので、測定ツールでは確かめていません（受け入れ前の確認項目）。

**文字:** 端末にある日本語書体だけを使います（ヒラギノ角ゴ → BIZ UDPゴシック → Noto Sans JP → 游ゴシック → メイリオ）。h1 だけ明朝（ヒラギノ明朝 → 游明朝 → BIZ UDP明朝 → Noto Serif JP）で、誌面の題字のように見せます。行間は 1.6、時刻と金額は `tabular-nums` で桁をそろえます。

| トークン | 値 | 使う場所 |
|---|---|---|
| `--text-sm` | 14px | 項目名・タグだけ。操作部品には使わない |
| `--text-base` | 16px | 本文・すべての操作部品 |
| `--text-lg` | 18px | カードの時刻・費用 |
| `--text-xl` | 20px | 企画名（h3） |
| `--text-2xl` | 24px | 区切り見出し（h2） |
| `--text-3xl` | 26–34px（clamp） | h1 |

**余白:** 4px 単位の `--space-1`（4px）〜`--space-16`（64px）。カード内は `--space-3`〜`--space-4`、区切りの間は `--space-8`。

**部品の寸法:** `--control-min: 2.75rem`（44px）、`--control-font-size: max(1rem, 16px)`、`--focus-width: 3px`、`--focus-offset: 2px`、選択・重なりの縦線 `--mark-width: 4px`。

### Theme（ライト／ダーク／システム）

- `<html data-theme="light|dark|system">`。`system` と属性なしは `prefers-color-scheme` に追従し、CSS だけで切り替わります。
- `color-scheme` もテーマごとに設定するので、ネイティブの select や検索欄も同じ配色になります。
- 保存キーは `komorebi-theme`、値は `light`・`dark`・`system` の3つだけです。それ以外の値や読み出しの失敗は `system` として扱います。
- 保存（`setItem`）が失敗しても、見た目はその場で切り替えます。テーマ切替のそばの role=status に「表示テーマを保存できませんでした。この画面を開いている間だけ反映します。」と出します。
- `system` を選んでいる間は `matchMedia('(prefers-color-scheme: dark)')` の `change` を拾い、`<meta name="theme-color">` の値（`--theme-color-meta`）と補足「いまはダーク」を更新します。配色そのものは CSS が追従します。
- 最初の描画前に `<head>` の小さな inline script でテーマを適用し、明示選択の利用者に画面のちらつきが出ないようにします。

### Layout Framework

| クラス | 振る舞い |
|---|---|
| `.l-container` | 最大 72rem の中央寄せ。左右余白は `max(16px, env(safe-area-inset-*))` |
| `.l-stack` / `.l-cluster` | 縦積み / 折り返す横並び。間隔は `--stack-gap` / `--cluster-gap` で上書き |
| `.l-page` | 1列。64rem 以上で `本体 | 回る予定（18–22rem）`。高さ 48rem 以上なら右列が追従 |
| `.l-filter-grid` | 320: 1列 → 375: 検索全幅＋2列 → 48rem: 1行（2fr・1fr・1fr） |
| `.l-session-grid` | 1列 → 48rem: 時刻列 7.5rem ＋ 内容 |

### 共通コンポーネント（foundation.css に入っているもの）

`.c-skip-link`、`.c-site-header`、`.c-button`（`--primary` / `--quiet` / `--block`、`:disabled`）、`.c-theme-toggle`、`.c-field` ＋ `.c-input` / `.c-select`、`.c-card`（`data-state="selected|conflict"`）、`.c-notice`（`--fiction` / `--alert`）、`.c-tag`（`--workshop` / `--talk` / `--consultation` / `--required`）、`.c-meta`（項目名と値の対）、`.c-jump-bar`。補助は `.u-visually-hidden`、`.u-list-reset`（`role="list"` と併用）、`.u-tabular`、`.u-muted`、`.u-small`、`.u-measure`。

`[hidden]` は `display: none !important` なので、flex の `.c-button` や `.l-cluster` に付けても必ず消えます。

**style.css の担当:** `.c-session`（カードの中の時刻・タグ・本文・注記・ボタンの配置）、`.c-itinerary`（回る予定の一覧・合計・書き出し欄）など、このページ固有の配置だけです。色は直書きせず、トークンを使います。

---

## 🎨 UX Structure

### Information Architecture

**ページの流れ:** 短い導入 → 架空の注記 → 絞り込み → 企画一覧 → 回る予定 → つくり方（閉じた details）。役割テンプレートの「画面の高さいっぱいのヒーロー」は使わず、企画を早く見せます。

```
skip-link「企画一覧へ移動」
header   「架空イベントの作例」  [システム][ライト][ダーク]
h1       こもれび つくる日 企画ガイド
         6つの企画の時間・費用・対象年齢・予約の要否を比べ、
         時間が重ならない「回る予定」を作ってJSONで保存できます。
         ちいさく作って、まちを知る。（subtitle、小さく）
notice   架空のイベントです ／ area と reservation_note の原文
meta     日付 2026年11月7日 ／ 開場 09:45–15:30 ／ 会場 木かげ交流室（架空の会場） ／ 入場
details  開催情報の補足（access・weather の原文）
main
  h2 企画を探す      [企画名・内容で探す][種類][時間帯]  件数（role=status）
  h2 企画一覧 #sessions
     h3 ×6（session-card）
  jump-bar  [回る予定 n件を見る] → #itinerary
  h2 回る予定 #itinerary（64rem 以上は右列）
details  h2 この作例のつくり方
footer   出典の1行
```

**見出し:** h1 は1つ。h2 は「企画を探す」「企画一覧」「回る予定」「この作例のつくり方」。h3 は企画名だけ。曜日は入力にないので出しません。

**ナビゲーション:** メニューは置きません。移動は スキップリンク と 「回る予定 n件を見る」（`href="#itinerary"` の通常のリンク）だけです。

### 企画カード（session-card）

```
10:00–10:45  45分              ← <time datetime="10:00"> など、--text-lg
[ワークショップ] [予約が必要]   ← .c-tag
押し花のしおり                  ← h3
部屋  工作の間
費用  300円                     ← 0円は「無料」
対象  6歳以上（小学生は保護者と参加）
定員  8人（企画上の設定。残席ではありません）   ← null は「設定なし」
予約  必要（この作例では受付しません）          ← false は「不要」
草花の色を並べ、透明なしおりに仕立てます。
メモ  はさみを使います。…
[ 回る予定に入れる ]            ← 状態でラベルが変わる1つのボタン
```

| data-state | ボタンの文言 | 添えるもの |
|---|---|---|
| `available` | 回る予定に入れる（primary） | — |
| `selected` | 回る予定から外す | バッジ「回る予定に入っています」、緑の縦線 |
| `conflict` | 入れ替える | 注記「「押し花のしおり」（10:00–10:45）と時間が重なっています」、赤茶の縦線 |

- ボタンは**同じ要素のまま**文言と動作を変えます。フォーカス中のボタンを消さないためです。
- ボタンの名前には、視覚的に隠した企画名を含めます（例: 「回る予定に入れる<span class="u-visually-hidden">：押し花のしおり</span>」）。「入れ替える」の隠し文言は「：「押し花のしおり」を外して「街角の種を知る」を入れる」です。
- 予約不要の企画（S02・S04・S06）には「予約不要の企画も、回る予定では{start}–{end}の枠全体を使うものとして重なりを判定します。」と出します。**S06 を選ぶと 14:00–15:00 の枠全体を使います。** 席の確保や予約ではありません。

### 状態と部品の境界

状態を持つのは app の1か所だけです。各部品は状態から描くだけにします。

```
state = {
  status: 'loading' | 'ready' | 'error',
  error:  null | { kind: 'network'|'http'|'parse'|'validation', detail },
  event:  null | 入力そのまま（変更しない）,
  filters: { kind: 'all'|kind, time: 'all'|'morning'|'afternoon', query: '' },
  selected: string[],          // 常に時刻順、最大6件、保存しない
  theme: 'system'|'light'|'dark', themePersisted: boolean
}
```

選択の変更は `add(id)` / `swap(id)` / `remove(id)` / `clear()` だけを通します。`add` は 重なり・上限6件・存在しないID を確かめ、だめなら理由を返して何も変えません。`swap` は重なる選択をすべて外してから入れます。

部品の一覧と優先度は `ux-handoff.json` の `components` にあります。

### 操作の流れ

1. 開く → テーマ適用 → 「企画データを読み込んでいます…」（絞り込みと書き出しは無効）
2. 取得・検証に成功 → 一覧を表示。失敗 → 理由と「もう一度読み込む」
3. 架空の注記と開催情報を見る
4. 種類・時間帯・検索で絞る → 「6件中3件を表示しています。」
5. カードで比べ、「回る予定に入れる」
6. 重なる企画のカードが `conflict` になる → role=status「「押し花のしおり」を回る予定に入れました。「街角の種を知る」とは時間が重なります。」
7. 入れ替えたいときは「入れ替える」 → 「「押し花のしおり」を外し、「街角の種を知る」を入れました。」
8. 「回る予定 n件を見る」で移動 → 時刻順の一覧と費用の合計を確認、不要なものを「外す」
9. 「回る予定をJSONで保存」
10. 再読み込みすると回る予定は空（画面に明記）。テーマだけが残る

### 重なりの規則と例

判定式: **`startA < endB` かつ `startB < endA` なら重なり。** 開始から終了までの枠全体で判定し、終了と開始が同時刻なら重なりではありません。部屋が違っても、同じ会場内でも、重なりは重なりとして扱います。

| 組 | 時刻 | 判定 |
|---|---|---|
| S01 押し花のしおり × S02 街角の種を知る | 10:00–10:45 / 10:30–11:00 | 600<660 かつ 630<645 → **重なる** |
| S04 音のさんぽを聞く × S05 小さな糸の織りもの | 13:00–13:30 / 13:15–14:00 | 780<840 かつ 795<810 → **重なる** |
| S05 小さな糸の織りもの → S06 ほつれの直し方 相談室 | 13:15–14:00 / 14:00–15:00 | 840<840 が偽 → **接するだけで選べる** |
| S01 → S03 紙でつくる小さな町 | 10:00–10:45 / 11:15–12:00 | 重ならない |

同時に選べるのは最大4件です（例: S01・S03・S04・S06、費用の合計 500円）。上限6件の確認は、データが変わったときの安全策として実装します。

### データ契約

**入力:** `fetch('input/event.json', { cache: 'no-store' })`。入力は変更しません。検証の内容:

- 最上位: `id`・`title`・`subtitle`・`date`（YYYY-MM-DD）・`timezone`・`venue`・`area`・`opening`/`closing`（HH:MM、opening < closing）・`admission`・`reservation_note`・`access`・`weather` が文字列であること。`fictional === true`。`sessions` が1件以上の配列であること
- 各企画: `id` は空でない一意の文字列。`kind` は `workshop`/`talk`/`consultation` のどれか。`title`・`room`・`age`・`description`・`note` は文字列。`start`/`end` は HH:MM で start < end。`price_yen` は0以上の整数。`capacity` は1以上の整数か null。`reservation_required` は boolean

**読み込み中と失敗:**

| 種類 | 文言 |
|---|---|
| network | 通信に失敗しました。 |
| http | サーバーが {status} を返しました。 |
| parse | JSONとして読めませんでした。 |
| validation | {path}（例: sessions[3].end）の形式が正しくありません。 |

どの失敗でも、role=alert の `.c-notice--alert` に「企画データを読み込めませんでした。」と理由、「もう一度読み込む」、「ファイルを直接開いた場合は読み込めないことがあります。HTTPで配信して開いてください。」を出します。一部だけ描く、内蔵データで代用する、黙って空の一覧を出す、のどれもしません。

**書き出し:** ファイル名は `komorebi-making-day-2026-11-07-itinerary.json`（`${event.id}-${event.date}-itinerary.json`）。Blob（`application/json`、2スペース整形、末尾改行）を作り、`download` 属性付きの a で保存させてから URL を revoke します。

```json
{
  "format": "komorebi-itinerary/v1",
  "fictional": true,
  "reserved": false,
  "notice": "架空のイベントの予定メモです。予約・支払い・参加確定ではありません。",
  "event": { "id": "komorebi-making-day", "title": "こもれび つくる日", "date": "2026-11-07", "timezone": "Asia/Tokyo", "venue": "木かげ交流室（架空の会場）" },
  "source": { "event_file": "input/event.json", "role_source": "msitarzewski/agency-agents", "role_source_commit": "bd956db032d907387e6b9ddebff3e18f1de8c679" },
  "selection_rule": "開始が相手の終了より前で、相手の開始が終了より前なら重なりとし、重なる企画は同時に選ばない。終了と開始が同時刻なら重ならない。予約不要の企画も開始から終了までの枠全体を使う。",
  "selected_ids": ["S01", "S03", "S04", "S06"],
  "sessions": [ "…選んだ企画の入力オブジェクトを全フィールドそのまま、時刻順で…" ],
  "derived": { "count": 4, "total_price_yen": 500 }
}
```

`sessions` の各要素は入力の企画オブジェクトをそのまま写します。`derived` は計算した値なので、入力の値と分けています。利用者の名前・連絡先・端末情報・日時スタンプは入れません。`source.role_source_commit` は制作方法の参照元を示す値で、イベント内容の出典ではありません。

### 状態の文言

| 場面 | 文言（role=status） |
|---|---|
| 追加 | 「押し花のしおり」（10:00–10:45）を回る予定に入れました。いま1件です。 |
| 追加で重なりが発生 | …入れました。「街角の種を知る」とは時間が重なります。 |
| 入れ替え | 「押し花のしおり」を外し、「街角の種を知る」を入れました。 |
| 削除 | 「押し花のしおり」を外しました。いま0件です。 |
| 全削除 | 回る予定をすべて外しました。 |
| 上限 | 回る予定は6件までです。 |
| 書き出し成功 | JSONファイル（komorebi-making-day-2026-11-07-itinerary.json）の保存を開始しました。 |
| 書き出し失敗 | JSONファイルを作れませんでした。回る予定はそのまま残っています。もう一度お試しください。 |
| 絞り込み | 6件中3件を表示しています。回る予定のうち1件は今の条件では一覧に出ていません。 |
| 0件 | 条件に合う企画はありません。 ＋「条件をクリア」 |

書き出し成功の文言を「保存しました」ではなく「保存を開始しました」にしているのは、ダウンロードが完了したかどうかをページ側では確かめられないためです。

書き出しボタンが無効な理由（aria-describedby で結ぶ）: 読み込み中「企画データの読み込み後に保存できます。」／失敗「企画データを読み込めなかったため保存できません。」／0件「企画を1件以上選ぶと保存できます。」

### Responsive Strategy

| 幅 | 振る舞い |
|---|---|
| **320**（基準） | 1列。絞り込みは縦積み、カードは全幅ボタンまで縦積み。一覧の下端に「回る予定 n件を見る」が追従する。ページ全体の横スクロールを出さない |
| **375 / 390 / 430** | 23.4375rem 以上で、絞り込みが 検索全幅 ＋ 種類・時間帯の2列になる。それ以外は 320 と同じ。テーマ切替は収まらなければ折り返す |
| **844 横**（高さ約390） | 48rem 以上で絞り込みが1行、カードは 時刻列 ＋ 内容。高さが低いので jump-bar は追従させない。ノッチ側の余白はセーフエリアを下回らない |
| **1280** | 64rem 以上で 本体 ＋ 右列（回る予定）。高さ 48rem 以上なら右列が追従し、jump-bar は出さない |

全体の約束: `width=device-width, initial-scale=1, viewport-fit=cover`。拡大は禁止しません。100vw・100vh・`html`/`body` の `overflow:hidden` は使いません。上下左右のセーフエリアは `env(safe-area-inset-*)` で確保します。

### Accessibility Foundation

- **キーボード:** スキップリンク → テーマ → 絞り込み → 各カードのボタン → 回る予定へ → 回る予定の操作 → 書き出し → つくり方。フォーカスは 3px の藍色の線と 2px の間隔で示し、forced-colors では Highlight にします。
- **フォーカスの行き先:** カードのボタンは同じ要素のまま変えます。回る予定で「外す」を押したあとは 次の項目 → 前の項目 → 見出し「回る予定」（tabindex=-1）の順に移し、すべて外したときは見出しへ移します。
- **読み上げ:** 意味のある要素（`ol`・`article`・`section aria-labelledby`・`label`・`time`）を使います。通知用の role=status は「件数」「選択の変化」「テーマ保存」の3つで、読み込み失敗だけ role=alert です。
- **色に頼らない:** 選択済み・重なり・予約の要否は、すべて文言のバッジや注記と組で示します。
- **コントラスト:** WCAG 2.1 AA の水準（文字 4.5:1、部品の枠 3:1）を設計の狙いにしています。測定はまだで、準拠しているとは書きません。
- **動き:** `prefers-reduced-motion: reduce` で遷移を止めます。なめらかなスクロールは、動きを減らす設定がないときだけ使います。

---

## 💻 Developer Implementation Guide

### Priority Order

1. **P0 土台:** `index.html` の骨組み、viewport、`foundation.css` → `style.css` の読み込み、テーマの inline script、スキップリンク、読み込み・検証・エラーと再読み込み
2. **P1 比べて選ぶ:** 導入と架空の注記、絞り込みと件数、企画カード（3つの状態）、選択の関数（add / swap / remove / clear）、role=status、jump-bar
3. **P2 まとめて保存:** 回る予定（空の状態・合計・外す・すべて外す・フォーカスの移し方）、JSON書き出し、テーマ切替のボタンと system への追従、保存失敗時の表示
4. **P3 補足と仕上げ:** つくり方の details、フッターの出典、hover などの小さな仕上げ

依存関係: P1 の選択の関数は P0 の検証済みデータに依存し、P2 の書き出しは P1 の `selected` に依存します。

### Theme Toggle HTML Template（テンプレートを調整したもの）

```html
<div class="c-theme-toggle" role="group" aria-label="表示テーマ">
  <button type="button" class="c-theme-toggle__option" data-theme-choice="system" aria-pressed="true">システム</button>
  <button type="button" class="c-theme-toggle__option" data-theme-choice="light" aria-pressed="false">ライト</button>
  <button type="button" class="c-theme-toggle__option" data-theme-choice="dark" aria-pressed="false">ダーク</button>
</div>
<p class="u-small u-muted" id="theme-note" role="status"></p>
```

### File Structure

```
index.html            骨組み・静的な架空の注記・テーマの inline script
foundation.css        本段階の成果（トークン・土台・共通部品）。Frontend 段階では編集しない
style.css             ページ固有の配置（.c-session, .c-itinerary など）
app.js                取得・検証・状態・描画・選択・書き出し・テーマ（vanilla JS、defer）
input/event.json      入力（変更しない）
outputs/implementation.md
```

### Implementation Notes

- **CSS の書き方:** `l-` / `c-`（BEM風の `__要素` と `--変種`）/ `u-` の接頭辞。状態は `data-state`・`aria-pressed`・`disabled`・`hidden` で表し、状態用のクラスは作りません。
- **JS:** 6企画の静的ページなので、ビルドなしの vanilla JS 1ファイルで足ります。フレームワーク・TypeScript・仮想スクロール・コード分割・PWA・Service Worker は使いません。
- **対応ブラウザ:** 現行の主要ブラウザ。`text-wrap: balance` などに未対応でも表示は崩れません。
- **性能:** 外部依存・画像・Webフォントはなく、読み込むのは HTML・CSS 2つ・JS 1つ・JSON 1つです。性能の数値目標は入力にないので作っていません。測定もしていません。

### テンプレートからの変更点

| 役割ファイルの記述 | この作例での扱い | 理由 |
|---|---|---|
| Hero Section: Full viewport height | 使わない。短い導入にする | 企画を早く見せるのが目的で、全画面の導入は邪魔になる |
| css/ 5ファイル ＋ js/ 2ファイル | foundation.css ＋ style.css ＋ app.js | 6企画の静的ページには分けすぎ。成果物の指定に合わせた |
| テーマ切替 role=radiogroup / radio、絵文字 | role=group ＋ aria-pressed の button、文字だけ | radio は矢印キーでの移動の実装が必要で、ボタンのほうが確実に作れる |
| 保存は light/dark だけ、system は削除 | light/dark/system の3値を保存し、OS の変化に追従する | 依頼の指定どおり。保存失敗を吸収する try/catch の方針は引き継いだ |
| `.theme-toggle-option` の font-size 14px・padding 8px | 16px・44px 以上 | 操作部品は 16px・44px 以上という指定に合わせた |
| `ai/memory-bank/*` を読む | ない。input/event.json と依頼文を使う | 固定アーカイブにも作業場所にもない |
| 性能予算・SLA の検証 | 数値を作らない | 入力に条件がない |
| LuxuryDeveloper へ引き継ぐ | Frontend Developer の役割ファイルへ引き継ぐ | この作業で渡された2つ目の役割 |
| `ai/agents/architect.md` を参照 | 参照しない（ない） | 固定アーカイブにない。中身を推測で補わない |

**Frontend Developer 段階への注意:** その役割ファイルにある Editor Integration、React の例、Lighthouse 90 以上・3G で3秒以内などの成功指標、テンプレート末尾の「Core Web Vitals excellence」「WCAG 2.1 AA compliant」という定型文は、測っていなければ成果として書かないでください。実施したことと実施していないことを分けて `implementation.md` に残してください。

---

## 受け入れ条件（将来の確認項目。どれもまだ確認していません）

すべて Frontend Developer の段階が担当します。一覧の全文は `ux-handoff.json` の `acceptance` にあります。

| ID | 確認すること |
|---|---|
| A01 | viewport が `width=device-width, initial-scale=1, viewport-fit=cover` で、拡大を禁止していない |
| A02 | 6つの幅でページ全体の横スクロールが出ない。100vw・100vh・overflow:hidden・全画面の導入部がない |
| A03 | h1 の直後、絞り込みより前に架空イベントの注記がある |
| A04 | 6企画が時刻順に並び、すべての表示値が入力と一致する |
| A05 | 絞り込みで件数文が更新され、0件では「条件をクリア」が動く |
| A06 | S01 を入れると S02 が重なりの状態になり、読み上げられる |
| A07 | S04 と S05 が重なる。部屋の違いを理由に許していない |
| A08 | S05 と S06 を両方入れられる。S06 が 14:00–15:00 の枠全体を使う旨が出る |
| A09 | 入れ替えると、外した企画と入れた企画の両方が告げられ、フォーカスが残る |
| A10 | 絞り込みで隠れた選択が消えず、件数文に出る |
| A11 | 空の説明があり、再読み込みで空に戻ること、保存されないことが明記されている |
| A12 | 「回る予定 n件を見る」は `#itinerary` への通常のリンク |
| A13 | 「外す」のあとフォーカスが行方不明にならない |
| A14 | 書き出しは 読み込み中・失敗・0件 で無効になり、理由が見える |
| A15 | S01・S03・S04・S06 の書き出しが契約どおり（`selected_ids` の順、`fictional`・`reserved` の値、合計 500） |
| A16 | 書き出しに利用者の情報や日時スタンプがない |
| A17 | 4種類の失敗で理由と再読み込みが出て、一覧は描かれない |
| A18 | テーマの保存値・不正値・storage 失敗時の動作 |
| A19 | system 選択中だけ OS の変化に追従する |
| A20 | 操作部品が 44px 以上・16px 以上 |
| A21 | キーボードの移動順と 3px のフォーカス |
| A22 | hidden 属性が flex の部品にも効く |
| A23 | 通信が input/event.json の取得だけ |
| A24 | 予約・支払い・残席・地図・連絡先の操作や、押しても何も起きないボタンがない |
| A25 | つくり方の details に出典・ライセンス・欠落している参照・AIが動かないことが書かれている |
| A26 | implementation.md が実施していない確認を成果として書いていない |

## 制約と未実施

- イベントは架空です。実在の開催・会場・予約受付はありません。
- `ai/agents/architect.md` は固定アーカイブにないため、適用していません。
- この段階で行ったのはファイルの読み書きだけです。ブラウザ表示、テスト、コントラストの測定、支援技術での確認はしていません。コントラストの値は手計算の概算です。
- 第三者のレビューや人の承認はありません。
- 回る予定は保存しません。ダウンロードの挙動はブラウザによって違い、JSONが新しいタブで開くだけの場合もありえます（未確認）。
- ページを表示しているときにAIは動きません。役割の適用は制作時の作業で、ページ上の表示はライブ実行ではありません。

---
**UX Architect:** 役割ファイル `design/design-ux-architect.md` を Claude Opus 5.5（`claude-opus-5-5`）が適用
**Foundation Date:** 2026-10-16
**Developer Handoff:** Frontend Developer 段階（別の実行）への引き渡し用。実装はまだありません
**Next Steps:** foundation.css をそのまま読み込み、P0 → P3 の順に実装し、受け入れ条件を実際に確かめた範囲だけを記録する
