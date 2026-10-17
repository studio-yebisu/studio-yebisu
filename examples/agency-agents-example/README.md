# 役割をつなぎ、使える予定へ。

6企画の入力が、UX設計の引継ぎ書とCSSの土台、Frontend実装を通り、触って選べる時間の図と保存できる予定になります。午前と午後の帯の位置と長さが実際の開始・終了を表し、重なる部分と14時に接する境界を一枚の図で比べられます。帯を押して企画に注目し、「入れる」で予定を作り、「JSONで保存」で持ち帰れます。

これはAgency Agentsの固定版にあるUX ArchitectとFrontend Developerの役割ファイルを、同じClaude Opus5.5が別々の実行で順に読んで使った成果です。最初に架空イベントの実入力から引継ぎ書とfoundation.cssを作り、次にその成果を読んで画面を実装しました。READMEのOption3 Use as Referenceに沿う参照利用で、独立した複数エージェントの協調、インストールや自動振り分けではありません。画面を開いてもAIは動きません。

元のUX提案A09「重なる企画を入れ替える」は、元のFrontend実装で採用しませんでした。S01（10:00–10:45）のあとS02（10:30–11:00）を入れようとしても、S02を追加せずS01を残します。S04（13:00–13:30）とS05（13:15–14:00）も同じです。S05の終了とS06の開始はともに14:00で、両方選べます。移動時間は含めず、予約不要の企画も開始から終了までの枠全体を使います。

保存済みのS01・S03・S05・S06は4件1000円、S01・S03・S04・S06は4件500円です。新しい図のページで保存したJSONは元の実保存と同じ全項目・バイト列になりました。絞り込みは表示だけを変え、予定を消しません。再読み込みでは予定が空になり、表示テーマだけが残ります。定員は企画上の設定で残席ではなく、S06のnullは「設定なし」です。

入力のイベント・会場・6企画は架空です。実際の受付・支払い・地図・連絡先・空き状況はありません。日付は入力の2026-11-07だけを使い、入力にない曜日を足していません。原典はmsitarzewski/agency-agents、bd956db032d907387e6b9ddebff3e18f1de8c679、MIT（2025 AgentLand Contributors）。4つの公式Gitblobを再照合しました。コミュニティの定義集で、Anthropic公式ではありません。役割ファイルが参照するai/agents/architect.mdは固定版になく、内容を補っていません。

今回の図と32秒の無音縦横動画の8編集原本は、別のOpus5.5実行で制作しました。元の2段階・入力・出力・foundation.cssは保持し、推論をやり直していません。制作担当はスマホで主操作が収まる寸法を調整し、再生部品、解説、検証と配布を担当しました。7実ファイルと8映像素材のバイト数・SHA256を固定しています。音声ガイド・原稿・音源・MP4音声トラックはありません。S04の題名は架空の企画名で、実音声は含みません。

元28秒動画の確認はvideo/assets/original-verification.json、新しい図と32秒動画の確認はverification.jsonです。8幅のライト・ダーク、6企画、2組の衝突、14時の境界、検索と絞り込み、実保存、失敗からの復旧、代表・連続フレームと実MP4の終了を確認しました。自動検査やエージェント確認は、人の内容・見た目の承認ではありません。実機iOS/Safari/VoiceOver、200%ズーム、OSテーマ変化中の追従、storage拒否とクリップボードの内容再取得は未確認です。

縦動画は../../media/agency-agents-example.mp4、横動画は../../media/agency-agents-example-wide.mp4、編集ソースはvideo/index.html?format=portrait。原実装はcomparison.htmlです。

## 原制作の記録（履歴）

以下の旧UIと28秒映像の記録は原制作時のものです。今回の確認と区別してください。

# Agency Agents作例：UX Architect と Frontend Developer を順に当てた企画ガイド

架空の地域イベント「こもれび つくる日」（2026-11-07、6企画）の企画ガイドです。スマホで企画の時間・費用・対象年齢・定員・予約の要否を比べ、時間が重ならない「回る予定」を作って、JSONで保存できます。

> **架空のイベントです。** 実在の開催・会場・予約受付はありません。予約・支払い・住所・地図・連絡先・最新の空き状況は扱いません。定員は企画上の設定で、残席ではありません。

## 使い方

1. **比べる:** 企画一覧のカードで、開始–終了と所要時間、種類、費用（0円は「無料」）、対象年齢、定員、予約の要否、部屋、説明、メモを見ます。
2. **絞り込む:** 「企画を探す」で 種類（ワークショップ／トーク／相談）・時間帯（午前／午後に始まる）・費用（無料／費用あり）・キーワードを選びます。キーワードは 企画名・内容・部屋・対象年齢・メモ から探し、空白で区切るとすべての語を含む企画に絞ります。「条件をクリア」は絞り込みだけを戻し、回る予定はそのまま残ります。
3. **選ぶ:** カードの「回る予定に入れる」を押すと、「回る予定」に時間順で並び、件数と費用の合計が出ます。もう一度押すか、回る予定の「外す」で外せます。
4. **重なりで止まる:** 時間が重なる企画は入りません。押すと、どの企画と重なるかが出て、回る予定は変わりません。入れたいときは、先に今の企画を外してください。終了と開始が同時刻なら重なりません（例: 小さな糸の織りもの 13:15–14:00 と ほつれの直し方 相談室 14:00–15:00 は両方入ります）。予約不要の企画も、開始から終了までの枠全体を使うものとして判定します。
5. **JSONで保存する:** 「回る予定をJSONで保存」で `komorebi-making-day-2026-11-07-itinerary.json` のダウンロードを要求します。中身は、選んだ企画の入力データそのもの（時刻順）と件数・費用の合計で、`fictional: true`・`reserved: false` です。予約や参加確定にはなりません。

回る予定はブラウザーに保存されず、再読み込みすると空に戻ります。保存されるのは表示テーマ（システム／ライト／ダーク）だけです。

## 見るとき

静的なファイルだけなので、このフォルダーで HTTP サーバーを立てて開きます。

```
python -m http.server 8863 --bind 127.0.0.1
```

ブラウザーで `http://127.0.0.1:8863/` を開きます。ファイルを直接開く（`file://`）と、データを読み込めないことがあります。ページは同じフォルダーの `input/event.json`・`outputs/ux-handoff.json`・`request.txt` だけを読み、外部への通信はありません。**ページを開いてもAIは動きません。** インストール、エージェントの自動読み込み、複数エージェントの連携はありません。

## どう作ったか（2段階の役割の適用）

固定版の役割ファイル2つを、同じ Claude Opus 5.5（`claude-opus-5-5`）が**別々の実行で順に**当てはめました。独立したエージェント同士の協調や自動の受け渡しではありません。README の Quick Start「Option 3: Use as Reference」（読んで、写して、調整して使う）の使い方です。

| 段階 | 役割ファイル | 入力 | 成果物 |
|---|---|---|---|
| 1 | `vendor/agency-agents/design/design-ux-architect.md` | `input/event.json` | `outputs/ux-handoff.json`、`outputs/ux-handoff.md`、`foundation.css` |
| 2 | `vendor/agency-agents/engineering/engineering-frontend-developer.md` | `input/event.json`、`outputs/ux-handoff.json`、`outputs/ux-handoff.md`、`foundation.css` | `index.html`、`style.css`、`app.js`、`outputs/implementation.md` |

2段階目では、引き継ぎ書の提案のうち、重なる企画の「入れ替える」（受け入れ条件 A09）を採用せず、追加を止めて今の選択を残す形にしました。そのほかの違いと理由は `outputs/implementation.md` にあります。ページ下部の「この作例の作り方」でも、引き継ぎ書から読んだ2つの役割の入力・成果物・確認項目を見られます。

制作ブリーフは `brief.json` です。

## 自分のイベントで繰り返す

`request.txt` が、同じ2段階を別のイベント情報で行う依頼文です（ページ下部の「この作例の依頼文」からもコピーできます）。

1. UX Architect の役割ファイルと新しいイベント情報を AI に読ませ、引き継ぎ書と foundation.css を作らせる。
2. 続けて Frontend Developer の役割ファイルと、1 の引き継ぎ書・foundation.css・イベント情報を読ませ、ページと実装の記録を作らせる。
3. 実装の記録にある「確かめていない点」を、自分でブラウザーで確かめる。

すでに使っている Claude などの AI の認証で使えます。この作例のために新しいアカウントは要りませんが、AI サービスの利用条件と料金は別です。出力の質は保証されません。

## 確認の状態

2つの固定役割の実適用、実ページの絞り込み・重複拒否・同時刻の境界・JSON保存と再試行、6幅×ライト/ダークの12画面を確認しました。28秒・720p30fps・無音の動画も代表/連続フレーム・全デコード・実MP4終端を確認しています。現在の確認範囲はverification.jsonと末尾の掲載時の記録を参照してください。

実機iOS/Safari/VoiceOver・実支援技術・性能測定・人による承認は未確認です。原典の設計案は受領当時のまま、未採用の提案や当時の未確認項目を残しています。

## ライセンスと出典

- この作例のコード・文章・データ: MIT License（Copyright (c) 2026 Studio Yebisu）。`LICENSE` を参照。
- 役割ファイルの原典: [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents/tree/bd956db032d907387e6b9ddebff3e18f1de8c679)、固定コミット `bd956db032d907387e6b9ddebff3e18f1de8c679`。MIT License（Copyright (c) 2025 AgentLand Contributors）。コミュニティ作成のプロジェクトで、Anthropic 公式ではなく、Anthropic による承認や推奨を示すものではありません。
- `vendor/agency-agents/` に、原典の `README.md`・`LICENSE`・`design/design-ux-architect.md`・`engineering/engineering-frontend-developer.md` の4ファイルを改変せずに置いています。
- `design-ux-architect.md` が参照する `ai/agents/architect.md` は、固定コミットにありません。使っていません。


## 掲載時の確認と配布物

以下とverification.jsonが掲載時の確認範囲です。outputs/ux-handoff.*は実際に受領した設計案で、提案・未実施のチェック項目をそのまま保管しています。設計案のA09（自動的な入れ替え操作）は採用せず、重なる追加を拒否して既存を残す実装にしました。ローカル通信もevent・役割の引き継ぎ・依頼文の3ファイルへ変更しています。未採用の設計項目を検査合格とは扱いません。

実ブラウザーで6企画の全フィールド、絞り込み/AND検索/0件、S01とS02およびS04とS05の重なり、S05終了14:00とS06開始14:00の許可、絞り込み後の選択保持・解除、実JSON保存を確認しました。outputs/browser-itinerary.jsonは実保存ファイルで、S01/S03/S05/S06の4件・材料費1000円、元の企画オブジェクトと同一です。これは予約ではありません。テーマ3種・テーマ保存・再読込時に予定が空になること、6幅×ライト/ダークの12画面で主要操作44px以上/入力16px以上/横overflowなし、実503/JSON不正/不正時刻からの再試行を確認しています。

原典4ファイルはMIT表記ごと改変せずvendor/agency-agents/に保持しています。ai/agents/architect.mdは固定アーカイブに存在せず、内容を補っていません。元資料・CSS土台・実装ソース・実保存JSON・samples.json・verification.json・28秒無音動画と編集ソース/実画面を配布します。私的な統括スキル・候補/保存一覧・認証・モデル履歴全文・cache/node_modulesは含めません。

物理iOS/Safari/VoiceOverや実支援技術、OSテーマ変更時の追従、storage拒否、通信切断、Lighthouse/CWV、人による内容・見た目の承認は未確認です。自動検査や制作担当の確認は製品の正式採用・実利用の品質保証ではありません。

ZIPはexamples/agency-agents-example/、media/、公開brief-to-demoとMIT表記を含みます。展開先ルートをHTTP配信し/examples/agency-agents-example/を開けます。再レンダリングは以下を展開先ルートから実行してください。出力先はソースの外の空フォルダーを指定します。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/agency-agents-example/tools/motion-reel
python examples/agency-agents-example/render.py --out renders/agency-first
```
