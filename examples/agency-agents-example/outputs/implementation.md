# こもれび つくる日 企画ガイド — 実装記録（Frontend Developer 段階）

> **架空のイベントです。** 「こもれび つくる日」は作例のための設定で、実在の開催・会場・予約受付はありません。

この記録は2段階のうち2段目、Frontend Developer の役割を適用した実装の記録です。1段目（UX Architect）は別の実行ですでに終わっており、その成果 `outputs/ux-handoff.json`・`outputs/ux-handoff.md`・`foundation.css` を読んでから実装しました。同じ指定モデル Claude Opus 5.5（`claude-opus-5-5`）が、2つの役割ファイルを**順番に**当てはめた作業で、独立した2つのエージェントの協調・自動の受け渡し・インストールしたエージェントやアプリ・自動の振り分け・MCP・ブラウザー内のAIはありません。

**この段階で行ったのはファイルの読み書きだけです。** ページをブラウザーで開いておらず、JavaScript も実行していません。表示・操作・保存・画面幅・動画の確認は、このあと制作側（親の工程）が実際のブラウザーで行います（「12. 確認の範囲」）。

---

## 1. 選んだ2つの役割と出典

| 段階 | 役割ファイル（固定版・改変なし） | 入力 | 成果物 |
|---|---|---|---|
| 1（実行済み・別の実行） | `vendor/agency-agents/design/design-ux-architect.md` | `input/event.json` | `outputs/ux-handoff.json`、`outputs/ux-handoff.md`、`foundation.css` |
| 2（この記録） | `vendor/agency-agents/engineering/engineering-frontend-developer.md` | `input/event.json`、`outputs/ux-handoff.json`、`outputs/ux-handoff.md`、`foundation.css` | `index.html`、`style.css`、`app.js`、`outputs/implementation.md` |

- 出典: `msitarzewski/agency-agents`、固定コミット `bd956db032d907387e6b9ddebff3e18f1de8c679`。MIT License（Copyright (c) 2025 AgentLand Contributors）。**コミュニティ作成のもので、Anthropic 公式ではありません。**
- 使い方: README の Quick Start「Option 3: Use as Reference」（役割ファイルを読み、写して、調整して使う）。Option 1 のアプリ、Option 2 の `install.sh` や `~/.claude/agents/` への配置、Option 4 の他ツール連携は使っていません。
- 同梱した原典は `vendor/agency-agents/` の4ファイル（`README.md`、`LICENSE`、`design/design-ux-architect.md`、`engineering/engineering-frontend-developer.md`）で、変更していません。

## 2. 引き継ぎ書から適用したこと（UX Architect 段階の成果）

| 引き継ぎ書の項目 | 実装 |
|---|---|
| foundation.css を先に読み、style.css は色を直書きしない | `index.html` で `foundation.css` → `style.css` の順に読み込む。`style.css` の色・余白・文字はすべて `--color-*`・`--space-*`・`--text-*` などのトークン。foundation.css は編集していない |
| 層と命名（`l-` / `c-` / `u-`、状態は `data-state`・`aria-pressed`・`disabled`・`hidden`） | 企画カードは `data-state="available|selected|conflict"`、トグルは `aria-pressed`、保存は `disabled`、表示切替は `hidden`。状態用のクラスは作っていない |
| 情報の順番（h1 → 架空の表示 → 開催情報 → 企画を探す → 企画一覧 → 回る予定 → つくり方） | そのまま。h1 は1つ、h2 は「企画を探す」「企画一覧」「回る予定」と下部の2つの details、h3 は企画名と役割名 |
| 全画面ヒーローを使わない | 導入は 題名・1文の説明・架空の表示・開催情報（4項目）だけ。高さの指定はしていない |
| テーマ（light/dark/system、system は CSS が追従、`<head>` の inline script で初回描画前に適用） | そのまま実装。保存名だけ変更（4 章） |
| 部品（skip-link、site-header、theme-toggle、event-intro、fiction-notice、load-state、filter-toolbar、result-status、session-list、session-card、selection-store、app-status、itinerary、export-button、making-guide、site-footer） | 5 章の対応表のとおり、すべて置いた。jump-bar は追従させない形で置いた（4 章） |
| データ契約（入力の検証規則、表示の規則、重なりの式、書き出しの形、4種類の失敗） | 8 章・6 章・9 章。書き出しの形は引き継ぎ書の `data_contract.export` と同じ |
| 表示の規則（0円は「無料」、定員は「8人（企画上の設定。残席ではありません）」、null は「設定なし」、予約は「必要（この作例では受付しません）」／「不要」、曜日は出さない） | そのまま |
| 予約不要の企画の注記「…{start}–{end}の枠全体を使うものとして重なりを判定します。」 | S02・S04・S06 のカードに入力の時刻から作って出す。S06 は 14:00–15:00 |
| 回る予定から外したあとのフォーカス（次の「外す」→ 前の「外す」→ 見出し） | そのまま。すべて外したときは見出し「回る予定」（`tabindex="-1"`） |
| 書き出しの理由文（読み込み中／失敗／0件）を `aria-describedby` で結ぶ | そのまま |
| 保存の文言は「保存しました」ではなく、完了を確かめられないことを前提にする | 「JSONのダウンロードを要求しました（ファイル名）。保存できたかは、ブラウザーのダウンロード表示で確かめてください。」 |

## 3. Frontend Developer の役割ファイルから適用したこと

| 役割ファイルの記述 | この作例での当て方 |
|---|---|
| Default requirement: accessibility compliance and mobile-first responsive design | 320px を基準に書き、48rem・64rem で広げる。操作部品は 44px 以上・16px 以上（foundation のトークン）。準拠の判定はしていない（12 章） |
| Implement proper ARIA labels and semantic HTML structure | `header`・`main`・`section aria-labelledby`・`article aria-labelledby`・`ol`・`dl`・`time`・`label`・`fieldset/legend`・`form role="search"`。ボタン名に視覚的に隠した企画名を含める（例「回る予定に入れる：押し花のしおり」「外す：押し花のしおり」） |
| Ensure keyboard navigation | すべてネイティブの `a`・`button`・`input`・`select`・`details`。独自のキー操作は作っていない。フォーカスは foundation の 3px の線 |
| Implement proper error handling and user feedback systems | 3つのファイルの取得それぞれに、通信・HTTP・JSON・形の4種類の失敗の文言、「もう一度読み込む」、重ねて読み込まない目印を置いた（8・9 章） |
| Integrate with backend APIs and manage application state effectively | API はない。同じフォルダーの静的ファイルを `fetch` で読む。状態は `app.js` の `state` の1か所（読み込みの状態・イベント・引き継ぎ書・依頼文・絞り込み・選択・テーマ） |
| Create maintainable component architectures with clear separation of concerns | 取得 → 検証 → 描画 → 選択 → 書き出し → テーマ を関数で分け、選択の変更は `addSession` / `removeSession` と、まとめて描き直す `renderSelection` だけを通す |
| Ensure cross-browser compatibility and graceful degradation | `word-break: auto-phrase`・`text-wrap: balance`・`content: "…" / ""` は、未対応でも表示が崩れないところだけで使う。`matchMedia` の `addEventListener` がなければ `addListener` を使う |
| Inclusive Design: Motion preferences | アニメーションを足していない。foundation の `prefers-reduced-motion` で遷移とスムーズスクロールを止める |

役割ファイルのうち、次は入力に合わないため使っていません。

- **Editor Integration Engineering**（openAt・reveal・peek、WebSocket/RPC のブリッジ、エディターの URI、150ms の往復）: エディターとの連携はこのページにありません。
- **React / Vue / Angular / Svelte、TypeScript、仮想スクロールの React 例（`@tanstack/react-virtual`）**: 6企画の静的ページなので、ビルドなしの vanilla JS 1ファイルにしました。フレームワーク風の仕組みも作っていません。
- **Core Web Vitals・Lighthouse 90 以上・3G で3秒以内・コード分割・遅延読み込み・画像の最適化・PWA・Service Worker・RUM**: 画像・外部依存・Webフォントはなく、読み込むのは HTML・CSS 2つ・JS 1つ・JSON 2つ（＋開いたときの依頼文）だけです。性能は測っておらず、数値を成果として書きません。
- **単体・結合テスト、CI/CD、E2E テスト、実際の支援技術での試験**: この段階では作っても実行してもいません。
- **テンプレート末尾の「Optimized for Core Web Vitals excellence」「WCAG 2.1 AA compliant」**: 測っていないので書きません。

## 4. 引き継ぎ書と違えた点（採用しなかった提案を含む）

| 引き継ぎ書の提案 | 実装 | 理由 |
|---|---|---|
| 重なる企画のボタンを「入れ替える」にし、押すと重なる企画を外してこちらを入れる（flow 7、session-card、selection-store の `swap`、**受け入れ条件 A09**） | **採用しない。** 重なる企画のボタンは「回る予定に入れる」のまま押せる。押しても回る予定は変えず、カードの注記と `role="status"` で「どの企画と重なるか」「回る予定は n 件のまま」を知らせ、入れたいときは先に今の企画を外すよう案内する。`swap` は作っていない | 依頼の中心の判断として、重なる追加は止めて今の選択を残すことにした。押しただけで選んだ企画が外れる操作を置かない。**A09 は「合格」でも「未確認」でもなく、採用しなかった項目**。ページ下部の「この作例の作り方」に、引き継ぎ書の A09 の原文と並べて書いている |
| 受け入れ条件 A06「S02 は入れ替えを押さない限り回る予定に入らない」 | S02 は S01 がある限り入らない（入れ替えはない） | 上と同じ |
| 「回る予定 n件を見る」の jump-bar をスマホ縦で一覧の下端に追従させる | 追従させない。同じリンクを件数文の横（64rem 未満）と一覧の末尾に置く。foundation の `.c-jump-bar` は style.css で `position: static` に上書きした | 追従する帯が企画カードやフォーカス中のボタンを覆わないようにする依頼の指定。`#itinerary` への通常のリンクである点（A12）は同じ |
| A23「通信は input/event.json の取得だけ」 | `input/event.json` に加えて、下部の欄のために `outputs/ux-handoff.json`（起動時）と `request.txt`（依頼文の欄を開いたとき）を同じフォルダーから読む | 依頼で、引き継ぎ書と依頼文も実ファイルから読むことになったため。外部への通信・AIの呼び出しはない |
| 絞り込みは 検索・種類・時間帯 | 検索・種類・時間帯に **費用（すべて／無料／費用あり）** を足した。375px 以上は 検索が全幅、その下に 種類・時間帯／費用・「条件をクリア」の2列。48rem 以上は 検索が全幅、その下に4列 | 費用で選びたい場合に使える。foundation の `.l-filter-grid` は4項目を想定していないため、48rem 以上の列の数だけ style.css で変えた |
| 検索の対象は title・description・note・room の部分一致 | title・description・room・**age**・note。NFKC と小文字化のあと、空白で区切った**すべての語**を含む企画だけを残す | 依頼の指定 |
| 状態でボタンの文言を変える（「回る予定に入れる」→「回る予定から外す」） | 文言は「回る予定に入れる」のまま `aria-pressed` で入っている状態を示し、入っているときは ✓ とカードの注記「回る予定に入っています。外すときは、もう一度このボタンを押すか…」を出す | 押した状態を `aria-pressed` で示すボタンは、名前を変えないほうが状態と名前が食い違わない。外す方法は注記と回る予定の「外す」で示す |
| テーマの保存キー `komorebi-theme` | `studio-yebisu.agency-agents-example.theme` | この作例専用の名前にする依頼の指定。値は light・dark・system の3つだけ |
| 入力の検証で sessions は1件以上 | **ちょうど6件**、timezone は **Asia/Tokyo**、id は英数字・ハイフン・下線（書き出しのファイル名に使うため）、date は実在する日付 | 依頼の指定。このページは6企画を日本時間で示す前提で、別の件数やタイムゾーンを黙って描かない |
| 上限6件の確認 | 作っていない | 選択は6つの企画 ID の集合で、6件を超えることがない。重なりのため実際に同時に選べるのは最大4件 |
| 再読み込みボタンを `disabled` にする | 読み込み中は `aria-disabled="true"` と「読み込み中…」にし、押されても何もしない | 押したボタンからフォーカスが外れないようにするため。重ねて読み込まない目印（`inflight`）でも止める |
| 引き継ぎ書の読み込み失敗 | 下部の欄にだけ理由と「もう一度読み込む」を出し、企画ガイドの操作は止めない | 引き継ぎ書は制作の記録で、イベントの内容には使わないため。引き継ぎ書の値でイベントの表示や重なりの判定を変えることはしない |
| 説明文はメタ情報の後 | 企画名の直後に説明、その後に 部屋・費用・対象・定員・予約・メモ | 何の企画かを先に読めるようにした |
| 下部の見出し「この作例のつくり方」 | 「この作例の作り方」 | 依頼の表記 |
| 書き出しの `source` のキー | 引き継ぎ書どおり `source.event_file`・`source.role_source`（= source_repository に当たる `msitarzewski/agency-agents`）・`source.role_source_commit`（= source_commit） | 親の確認で、引き継ぎ書の詳しい形を使うことになったため |

## 5. ファイルと部品の対応

| ファイル | 中身 |
|---|---|
| `index.html` | 骨組み、テーマの inline script、静的な見出しと「架空のイベントです」、絞り込みのフォーム（選択肢の表示名だけ静的）、回る予定の枠、下部の details 2つ。企画の内容は書いていない |
| `foundation.css` | 1段目の成果（トークン・3テーマ・リセット・フォーム・レイアウト・共通部品・補助）。変更していない |
| `style.css` | このページ固有の配置: `.c-topbar`、`.c-intro`、`.c-facts`、`.c-filters`、`.c-results`、`.c-session`、`.c-itinerary`、`.c-making`・`.c-role`・`.c-decision`、`.c-linklist`、`.c-request`、`.c-footer`。最後に `[hidden] { display: none !important; }` |
| `app.js` | 取得・検証・状態・描画・選択・絞り込み・書き出し・テーマ・下部の欄。取得したデータは `textContent` と DOM API だけで描く（`innerHTML` を使わない） |
| `input/event.json` | 入力。変更していない |
| `outputs/ux-handoff.json`・`outputs/ux-handoff.md` | 1段目の成果。変更していない |

| 引き継ぎ書の部品 | 実装の場所 |
|---|---|
| theme-init | `index.html` の `<head>` の inline script |
| skip-link | `.c-skip-link`（「企画一覧へ移動」→ `#sessions`） |
| site-header・theme-toggle | `.c-site-header` 内の戻るリンク（`../../case.html?id=agency-agents-example`）と `role="group"` の3ボタン、`#theme-note`（`role="status"`） |
| event-intro・fiction-notice | `.c-intro`（`#event-title`・`#event-subtitle`・`.c-intro__notice`・`#event-facts`・`#event-more`） |
| load-state | `#load-status`（`role="status"`）、`#load-error`（`role="alert"`）と `#load-retry` |
| filter-toolbar・result-status | `#filter-form`（`fieldset` で読み込み前は無効）、`#result-status`（`role="status"`）、`#no-results` |
| session-list・session-card | `#session-list` と `buildCard()`／`updateCards()` |
| selection-store | `state.selected`、`addSession()`・`removeSession()`・`onClearAll()` |
| app-status | `#app-status`（視覚的に隠した `role="status"`。一度空にしてから入れる） |
| jump-bar | `#jump-top`・`#jump-bottom`（追従しない） |
| itinerary・export-button | `#itinerary`、`renderItinerary()`、`#export-button` と `onExport()`、`#clear-button` |
| making-guide | `#making`（`renderRoles()` が引き継ぎ書の roles から描く）、`#request-details`（依頼文） |
| site-footer | `.c-footer` |

## 6. 重なりの判定

時刻は同じ日・同じタイムゾーン（Asia/Tokyo）の「時×60＋分」として比べ、開始から終了までを半開区間 `[start, end)` として扱います。

```
overlaps(A, B) = A.start < B.end && B.start < A.end
```

| 組 | 分に直した値 | 判定 |
|---|---|---|
| S01 押し花のしおり 10:00–10:45 × S02 街角の種を知る 10:30–11:00 | 600 < 660 かつ 630 < 645 | 重なる。後から押したほうは入らない |
| S04 音のさんぽを聞く 13:00–13:30 × S05 小さな糸の織りもの 13:15–14:00 | 780 < 840 かつ 795 < 810 | 重なる。部屋が違っても重なりとして扱う |
| S05 13:15–14:00 → S06 ほつれの直し方 相談室 14:00–15:00 | 795 < 900 は真、840 < 840 は偽 | 重ならない（接するだけ）。両方入る |
| S01 10:00–10:45 → S03 紙でつくる小さな町 11:15–12:00 | 600 < 720 は真、675 < 645 は偽 | 重ならない |

- 予約不要の企画（S02・S04・S06）も、開始から終了までの枠全体を使うものとして判定します。相談の S06 も 14:00–15:00 の全体です。予約不要の企画を途中から自由に出入りできるものとして扱うと、時間の融通がきくように見えてしまうためで、カードと回る予定にもそう書いています。
- 追加は `addSession()` だけを通り、重なる選択が1件でもあれば理由（重なる企画の一覧）を返して何も変えません。
- 絞り込みは表示（`li` の `hidden`）だけを変え、`state.selected` には触れません。隠れた選択済みの企画は回る予定に残り、件数文に「回る予定のうちn件は、今の条件では一覧に出ていません。」と出ます。回る予定の「外す」は絞り込みに関係なく使えます。
- 選べる組の例: S01・S03・S04・S06 は合計 500円、S01・S03・S05・S06 は合計 1000円。合計は選んだ企画の `price_yen` を足した値で、ページに決まった値は書いていません。

## 7. CSS 変数とテーマ

- 色は foundation.css の役割名のトークン（`--color-bg`・`-surface`・`-surface-sunk`・`-text`・`-text-muted`・`-border`・`-border-strong`・`-accent`（テラコッタ）・`-action`（緑）・`-alert`・`-notice-soft`・`-focus` など）だけを使います。紙と墨の地、ワークショップと区切りの点はテラコッタ、主操作と選択済みは緑です。
- テーマは `<html data-theme="system|light|dark">`。`system` は foundation の `prefers-color-scheme` で CSS が追従し、JS は補足文（「端末の設定に合わせています（いまはダーク）。」）と `<meta name="theme-color">` だけを更新します。`matchMedia` の `change` は system を選んでいるときだけ反映します。
- 保存キーは `studio-yebisu.agency-agents-example.theme`、値は `system`・`light`・`dark` だけ。読み出しの失敗や不正値は `system`。保存（`setItem`）に失敗しても見た目は切り替え、補足文に「表示テーマを保存できませんでした。この画面を開いている間だけ反映します。」と出します。テーマを変えてもスクロールやフォーカスは動かしません。
- `color-scheme` は foundation がテーマごとに設定するので、select・検索欄・textarea もダーク配色になります。無効の select・input・`aria-disabled` のボタン、重なりの注記、回る予定、エラーの枠もトークンで描くので、ダークでも同じ規則で色が変わります。
- 保存するのはテーマだけです。回る予定は保存せず、再読み込みで空に戻ります（回る予定の説明文に明記）。

## 8. データの検証

`fetch(path, { cache: 'no-store' })` で読み、失敗を4種類に分けます。

| 種類 | 文言 |
|---|---|
| network | 通信に失敗しました。（本文の途中で切れたときは「通信が途中で切れました。」） |
| http | サーバーが {status} を返しました。 |
| parse | JSONとして読めませんでした。 |
| validation | {path} の形式が正しくありません（{理由}）。 例: `sessions[3].end の形式が正しくありません（開始より後の時刻が必要です）。` |

**input/event.json:** 最上位がオブジェクト。`id`（英数字・ハイフン・下線）・`title`・`subtitle`・`venue`・`area`・`admission`・`reservation_note`・`access`・`weather` が空でない文字列。`fictional === true`。`date` が実在する YYYY-MM-DD。`timezone === "Asia/Tokyo"`。`opening`・`closing` が HH:MM で opening < closing。`sessions` がちょうど6件の配列。各企画は、`id` が空でない一意の文字列、`kind` が workshop・talk・consultation のどれか、`title`・`room`・`age`・`description`・`note` が空でない文字列、`start`・`end` が HH:MM で start < end、`price_yen` が0以上の整数、`capacity` が1以上の整数か `null`、`reservation_required` が boolean。

**outputs/ux-handoff.json:** `meta.fictional === true`、`meta.event_id` が文字列、`meta.source_commit` が固定コミットと一致、`roles` が `ux-architect`・`frontend-developer` の順の2件で、`name`・`source_path`（このフォルダー内の相対パス。`..` やスキームを含まない）・`inputs`・`deliverables`（同じく相対パスの配列）・`checks`（文字列の配列）・`applied_instructions`（指示と適用の組の配列）を持つ、`acceptance` が id と criterion の組の配列、`data_contract.conflict_rule` が文字列。`meta.event_id` と読み込んだイベントの `id` が違えば、下部の欄にその旨を出します。

**request.txt:** HTTP の状態を確かめ、空なら失敗にします。

どの失敗でも、内蔵の代わりのデータは使わず、一部だけ描くこともしません。企画データが失敗したときは一覧を描かず、絞り込み（`fieldset disabled`）と保存を無効にし、回る予定も作れない旨を出します。

## 9. 操作と失敗時の動き

| 操作 | 動き | 失敗・無効のとき |
|---|---|---|
| 回る予定に入れる（カード） | 重ならなければ入れて「「…」（10:00–10:45）を回る予定に入れました。いま1件です。」、新しく入れられなくなった企画名も添える。入っていれば外す | 重なれば入れず、「「街角の種を知る」（10:30–11:00）は入れていません。回る予定の「押し花のしおり」（10:00–10:45）と時間が重なります。回る予定は1件のまま変わっていません。」。カードの注記を強める |
| 外す（回る予定） | 外して件数を知らせ、フォーカスを 次の「外す」→ 前の「外す」→ 見出し に移す | — |
| 回る予定をすべて外す（n件） | 1件以上のときだけ出す。押すとすべて外して件数を知らせ、見出しへフォーカス。確認のダイアログは出さず、ボタン名で何件外すかを示す | — |
| 条件をクリア | 検索・種類・時間帯・費用を戻す。回る予定は残す。0件の案内の中のボタンからは「企画一覧」の見出しへフォーカス | — |
| 回る予定をJSONで保存 | `Blob`（`application/json`、2スペース整形、末尾改行）を作り、`download` 属性付きの `a` を押して、60秒後に URL を解放。ファイル名は `${event.id}-${event.date}-itinerary.json`（= `komorebi-making-day-2026-11-07-itinerary.json`）。「JSONのダウンロードを要求しました…」と出す | 読み込み中・失敗・0件は `disabled` と理由文。Blob を作れなければ「JSONファイルを作れませんでした。回る予定はそのまま残っています。もう一度お試しください。」 |
| もう一度読み込む | 同じファイルを再取得。読み込み中は「読み込み中…」で押しても何もしない | 再び失敗すれば理由を出し直し、ボタンにフォーカスを戻す |
| 依頼文をコピー | `navigator.clipboard.writeText` の Promise を待ち、成功したら「依頼文をクリップボードにコピーしました。」 | 使えない・拒否されたときは、16px・高さ 12rem の読み取り専用の欄に同じ文を入れて選択し、「この環境では自動でコピーできませんでした。…」 |

**書き出す JSON の形**（引き継ぎ書の `data_contract.export` と同じ）:

```json
{
  "format": "komorebi-itinerary/v1",
  "fictional": true,
  "reserved": false,
  "notice": "架空のイベントの予定メモです。予約・支払い・参加確定ではありません。",
  "event": { "id": "…", "title": "…", "date": "…", "timezone": "…", "venue": "…" },
  "source": { "event_file": "input/event.json", "role_source": "msitarzewski/agency-agents", "role_source_commit": "bd956db032d907387e6b9ddebff3e18f1de8c679" },
  "selection_rule": "開始が相手の終了より前で、…",
  "selected_ids": ["時刻順のID"],
  "sessions": ["選んだ企画の入力オブジェクトを全フィールドそのまま、時刻順で"],
  "derived": { "count": 0, "total_price_yen": 0 }
}
```

`event` の値と `sessions` の各要素は、読み込んだ入力のオブジェクトをそのまま使い、書き換えません。`derived` は計算した値です。名前・連絡先・端末情報・日時のスタンプは入れず、予約の確定を表す値もありません。

## 10. 画面幅ごとの振る舞い（設計。まだ表示して確かめていない）

| 幅 | 振る舞い |
|---|---|
| 320 | 1列。上端は 戻るリンク と テーマの3ボタン が折り返す。開催情報は「項目名｜値」の4行。絞り込みは縦積み。カードは 時刻 → タグ → 企画名 → 説明 → 項目 → 注記 → 全幅ボタン。回る予定は一覧の後ろ |
| 375・390・430 | 絞り込みが 検索（全幅）＋ 種類・時間帯／費用・条件をクリア の2列。それ以外は 320 と同じ |
| 844（横向き） | 48rem 以上。開催情報が4列、絞り込みが 検索（全幅）＋4列、カードは 時刻列＋内容。回る予定はまだ一覧の後ろ。左右の余白は `env(safe-area-inset-*)` を下回らない |
| 1280 | 64rem 以上。本体と右列の回る予定。企画カードは2列（中は縦積み）。高さが 48rem 以上なら回る予定の列が上に追従（foundation の設定）。「回る予定を見る」リンクは出さない |

`100vw`・`100vh`・`html`/`body` の `overflow: hidden`・画面の高さいっぱいの導入部は使っていません。viewport は `width=device-width, initial-scale=1, viewport-fit=cover` で、拡大を禁止していません。

## 11. テンプレートからの調整

- **フレームワークは使わない:** 6企画の静的ページなので、React などの例や TypeScript・ビルドは使わず、ネイティブの要素と vanilla JS で書きました。仮想スクロールやメモ化の例は、件数が6件なので当てていません。
- **外部 API はない:** 「backend APIs」は、同じフォルダーの静的な JSON とテキストに置き換えました。サーバー側の処理、予約・決済・地図・連絡先の連携はありません。
- **エディター連携（Editor Integration Engineering）はない:** エディターとの橋渡しはこの作例に関係しません。
- **`ai/agents/architect.md` はない:** UX Architect の役割ファイルが参照するこのファイルは、固定コミットのアーカイブにありません。1段目でも2段目でも、中身を推測で補っていません。Frontend Developer の役割ファイルの末尾「core training を参照」も、具体的な資料はありません。
- **LuxuryDeveloper への引き継ぎ:** UX Architect の役割ファイルの引き継ぎ先は、この作業では Frontend Developer の役割ファイルです。

## 12. 確認の範囲

**この段階で行ったこと**

- 役割ファイル2つ、README の Quick Start（Option 3）、`input/event.json`、`outputs/ux-handoff.json`・`ux-handoff.md`、`foundation.css` を読んだ。
- 自分で書いた `index.html`・`style.css`・`app.js` を、書きながら読み直した（静的な見直しだけ）。

**まだ行っていないこと（このあと制作側がブラウザーで確かめる）**

- ページを開いての表示と操作。JavaScript の実行そのもの。
- 引き継ぎ書の受け入れ条件 A01〜A26 のうち、採用しなかった A09 を除くすべて。特に、6企画の表示値、絞り込みと件数、S01×S02・S04×S05 の追加停止と S05→S06 の両立、合計 500円／1000円、実際に保存された JSON の中身とファイル名、4種類の読み込み失敗と再読み込み、テーマの保存と storage が使えないときの動き、system 中の OS の切り替えへの追従。
- 320・375・390・430・844（横向き）・1280 の各幅での横スクロール・折り返し・44px の大きさ。
- 解説動画（予定。まだ作っていない）。

**このページについて主張しないこと**

- Lighthouse の点数、Core Web Vitals、読み込み時間などの性能の数値。
- WCAG 2.1 AA などの基準への準拠。コントラストは foundation の設計上の狙い（手計算の概算）のままで、測っていない。
- VoiceOver・NVDA などの支援技術での動作、実機の iPhone Safari での表示、ダウンロードの挙動（ブラウザーによっては JSON が新しいタブで開くだけの場合がある）。
- 第三者のレビューや人による承認。

---
**Frontend Developer:** 役割ファイル `engineering/engineering-frontend-developer.md` を Claude Opus 5.5（`claude-opus-5-5`）が適用
**Implementation Date:** 2026-10-16
**入力:** `input/event.json`、`outputs/ux-handoff.json`、`outputs/ux-handoff.md`、`foundation.css`
**Next Steps:** 制作側がブラウザーで 12 章の未確認の項目を確かめ、確かめた範囲だけを記録する


## 掲載前の実画面に基づく調整
制作担当がスマホの初期表示を読み、検索欄を最初の画面に入れるため、導入文と戻るリンクを短くし、テーマを一行へ、開催の注意全文と時刻の基準を「開催情報の補足」へ移しました。架空・予約受付なしは常時表示し、原文はnative detailsを開いて読めます。日付と開場/閉場はスマホで2列にしました。UX案A03の注意全文を常時出す配置は、この目的に合わせて変更しています。foundation.cssとUX受領原本は変更していません。
選択済みのボタンは次の動作を示す「回る予定から外す」へ変え、予定の時間をイベントの開場・閉場と区別するラベルにしました。追加拒否や時間・費用・保存データのロジックは変更していません。実ブラウザーで6企画の全フィールド・絞り込み・全角AND・重複拒否・接する時刻・実JSON保存1000円/別500円・テーマ保存/再読込・実503/JSON不正/時刻不正の再試行を確認し、6幅×ライト/ダーク12画面で44px/16px/横overflowなしを確認しました。詳細な現在の範囲は掲載時のverification.jsonを参照してください。物理iOS/Safari/VoiceOverや人による承認、性能測定は未確認です。
