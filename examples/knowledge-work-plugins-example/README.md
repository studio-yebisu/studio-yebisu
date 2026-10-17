# 発言を束ねても、違いは残す。

3冊のメモ、15枚の発言、5つのまとまり、次に調べることを一枚の図でつなぎます。発見を選び、引用した原文、整理者の解釈、反する発言と次の提案へたどれます。選んだ発見は元と同じMarkdown、整理全体は元の全項目のJSONで保存できます。画面は保存済みの整理結果を読むもので、新しいAI整理や顧客調査は行いません。

貸し道具の予約について、制作担当が書いた架空の3人の自己申告15行を、固定版のSynthesize Researchスキルへ実際に入力して整理した結果を使っています。スキルの手順で1行ごとの引用にコードを付け、関連する観察をまとめ、人数、影響、確からしさ、異なる声と次に確かめることを記録しました。今回の改修で再整理や推論はしていません。実在の顧客の調査、観察した行動、分析ログ、アンケート、実装や効果測定は含みません。

F01は送信後の確認や控えに関わる3人の申告です。P01とP03は完了が分かりにくく、P02は完了画面を閉じた後に予約番号を探し直しています。同じ経験とは限りません。F02は取消料・取消期限・受け取り時間の変更など、送信前に知りたい条件です。実際のお店の規定は入力にありません。

F03では、控えをメールに残したいP01、当日の変更はSMSで知りたいP02、まだ選んでいないP03を別々に残します。3人という人数を一つの通知手段の支持票にはしません。F04の写真や前回の道具名という良い点も、困りごとと一緒に残します。

F05の月表示を望む発言はP03-L02の1人だけです。P02-L04は今の方法で困っていないという異なる声で、支持の人数に加えません。P01-L02は一日ずつ確かめるという手順だけで、不便とも困らないとも言っていません。支持にも反証にも加えません。次の提案R05は月表示を実装することではなく、借り方の違う人に今の画面で空きを探してもらう観察です。提案や確かめ方は未実施です。

支持する参加者での絞り込みと、空白区切りのすべての語を含む検索を使えます。P02で絞るとF05は出ず、「SMS メール」で探すとF03が残ります。人数は架空の3人のうち何人かで、利用者全体の割合ではありません。確からしさは中3件・低2件、順位と影響は定性的な暫定判断です。人による内容の承認や、効果の保証にはしません。

原典はanthropics/knowledge-work-plugins、固定コミットf652327d4e953d7957d99e735c3c7f9964e9d2e5、product-management1.2.0、Apache-2.0です。7つの公式ファイルを固定Gitblobと再照合し、手元の文章を渡す手順を使いました。プラグインのインストール、自動発動、MCP接続、外部の業務システムやライブの調査は範囲外です。

新しい図と32秒の無音縦横動画の8編集原本はClaude Opus5.5が執筆しました。制作担当の調整・描画・検証・包装と掲載は別に記録しています。4実データをdata-manifest.json、7動画素材をvideo/assets/manifest.jsonに固定しています。元28秒動画の確認はvideo/assets/original-verification.json、今回の確認はverification.jsonです。音声ガイド、原稿、音源、音声ストリームはありません。エージェントの確認と自動検査は、人の審美的承認や実機iPhoneの確認とは区別します。

縦動画は../../media/knowledge-work-plugins-example.mp4、横動画は../../media/knowledge-work-plugins-example-wide.mp4です。編集ソースはvideo/index.html。元の閲覧画面はcomparison.htmlです。

## 原実行と旧画面の記録

以下の28秒動画・旧UIの記録は原制作時のものです。新しい図と映像の確認とは区別してください。

# 声から、次の試作へ — Synthesize Research 作例

架空の貸し道具店「こもれび道具室」のスマホ予約について書いた**架空のヒアリングメモ3件（15行）**を、Anthropic の Knowledge Work Plugins に含まれる product-management プラグインの **synthesize-research** スキル（固定版 SKILL.md）で整理し、その保存済みの結果を読むための静的なビューアです。

- 整理は制作時に **Claude Opus 5.5** が固定版の SKILL.md と手元の入力ファイルを読んで1回行い、`outputs/` に保存しました。人によるレビューは受けていません。
- ページを開いてもAIは動きません。新しいメモを整理する機能はなく、表示・絞り込み・保存はすべて保存済みのデータから行います。
- メモは制作担当がこの作例のために書いた架空のものです。すべて架空の参加者の自己申告で、実在の顧客・店舗の調査、操作の観察、分析ログ、アンケート、売上、効果の測定は含みません。
- プラグインのインストール、スラッシュコマンド、MCPコネクター、外部の業務システムは使っていません。SKILL.md が対応している「テキストを手で渡す」形で適用しています。Anthropic による承認や推奨を示すものではありません。

## 使い方

1. **発見を選ぶ**　開くと最初の発見（F01）が選ばれています。一覧のボタンで別の発見を選ぶと、人数（3人中）、確からしさ、影響、整理者の解釈が出ます。
2. **絞り込む**　「P01」「P02」「P03」で、その参加者の発言が**支持**に入っている発見だけを表示します（反する発言は支持に数えません）。検索欄は発見の題・要約・根拠の引用・コード・解釈・反する発言を対象に、全角半角や大文字小文字の違いをそろえて探します。空白で区切ると、すべての語を含む発見だけが残ります。「絞り込みを解除」で両方を戻し、最初の発見を選び直します。
3. **根拠を読む**　「支持する発言」は原文の行そのまま、「反する発言」は別の欄に分けています。点線の枠は整理者（Claude Opus 5.5）の解釈です。
4. **原文に戻る**　引用の「原文 P01-L01 を見る」を押すと、ページ下部の該当する参加者のメモが開き、その行へ移ります。URL の末尾（`#line-P01-L01`）を共有すれば、同じ行を開けます。メモは JavaScript なしでも開けます。
5. **持ち帰る**　「選んだ発見をMarkdownで保存」は、選んでいる発見1件分（引用・行ID・反する発言・3人中の人数・架空である旨・固定原典・次の一歩・関わる提案）を書き出します。「整理全体をJSONで保存」は `outputs/synthesis.json` と同じ内容です。下部の「同じ手順を別のメモで使う依頼文」では `request.txt` をコピーできます。

## 整理の中身

- **観察**：15行それぞれを1つの観察とし、種類（自己申告の行動・希望・良い点・未定）とコードを付けました。
- **発見（5件・優先順は暫定）**
  - F01 送信後の確認の手がかりが残りにくい（3/3人・確からしさ中）
  - F02 取消・変更の条件を送信前に知りたい（3/3人・中）
  - F03 通知手段の希望はそろわない（3/3人・低。P01メール／P02 SMS／P03未定、用途も違う）
  - F04 写真と前回の道具名は、保ちたい良い点（3/3人・中。写真2人、前回の道具名1人）
  - F05 月単位の空き表示は、1人の希望（1/3人・低。P02-L04 は反する発言）
- **提案**：R01〜R05。試作と追加調査で、実装や正式採用は決めていません。「確かめ方」はこれからのテストの計画で、結果はありません。
- 人数は「この3人のうち何人か」で、利用者全体の割合や市場規模ではありません。影響と確からしさは定性的な判断で、点数の式は使っていません。

全文は `outputs/synthesis.md`、データは `outputs/synthesis.json` です。

## 手元で開く

`fetch` でファイルを読むため、HTML を直接開く（file://）のではなく HTTP で開いてください。このフォルダーで次を実行し、ブラウザーで `http://127.0.0.1:8863/` を開きます。

```
python -m http.server 8863 --bind 127.0.0.1
```

読み込みに失敗したときは理由と「もう一度読み込む」が出て、保存のボタンは押せなくなります。保存済みデータの代わりの内容を表示することはありません。

## 同じ手順を自分のメモで使う

`request.txt` の「問い」「決めること」「資料の種類と人数」「メモ」の欄を自分の資料に置き換え、固定版の SKILL.md を読めるAI（Claude など）に渡します。メモは手で貼る前提で、コネクターの設定は要りません。

- 固定版 SKILL.md：https://github.com/anthropics/knowledge-work-plugins/blob/f652327d4e953d7957d99e735c3c7f9964e9d2e5/product-management/skills/synthesize-research/SKILL.md
- この作例の再現：上の SKILL.md（または同梱の `vendor/knowledge-work-plugins/product-management/skills/synthesize-research/SKILL.md`）と `input/interviews.json` を Claude に読ませ、`request.txt` の手順で整理します。同じモデルでも出力の言い回しや発見の切り方は毎回同じにはなりません。

Claude や接続サービスの利用条件・料金は、それぞれのサービスのものに従います。この作例はそれらを含みません。

## 確認の状況

固定版スキルの実適用、15引用と参加者の人数・相反する希望の照合、実ブラウザーでの絞り込み・原文移動・実Markdown/JSON保存を確認しました。320/375/390/430/844/1280pxの12状態で横overflowなし・入力欄16px以上・主要操作44px以上。28秒の無音動画も、代表/連続フレーム、全デコード、実MP4終端を確認しています。

実顧客の調査、プラグインinstall/MCP、実機iOS/Safari/VoiceOver、人による内容・見た目の承認は未確認です。詳しくはverification.jsonと末尾の掲載時の記録を参照してください。

## ファイル

| パス | 内容 |
|---|---|
| `index.html`・`style.css`・`app.js` | 保存済みの整理を読むビューア |
| `input/interviews.json` | 架空のヒアリングメモ（原文・変更なし） |
| `outputs/synthesis.json` | 観察・発見・利用の文脈・提案・未解決の問い・限界 |
| `outputs/synthesis.md` | 同じ内容の日本語レポート |
| `request.txt` | 別のメモで同じ手順を使う依頼文 |
| `brief.json` | 制作ブリーフ（brief-to-demo を適用） |
| `vendor/knowledge-work-plugins/` | 読んだ原典7ファイル（改変なし） |
| `LICENSE` | 作例の MIT License |

## ライセンス

- 作例の文章・データ・コード：MIT License（Copyright (c) 2026 Studio Yebisu）。`LICENSE` を参照。
- 原典：anthropics/knowledge-work-plugins（固定コミット `f652327d4e953d7957d99e735c3c7f9964e9d2e5`、product-management プラグイン v1.2.0）は Apache-2.0 です。`vendor/knowledge-work-plugins/` に LICENSE・README.md・product-management/LICENSE・README.md・CONNECTORS.md・.claude-plugin/plugin.json・skills/synthesize-research/SKILL.md の7ファイルを改変せずに置いています。選んだ範囲に NOTICE ファイルはありません。

## 掲載時の確認と配布物

制作段階の記述より、この追記とverification.jsonを現在の確認範囲として参照してください。固定スキルをOpus5.5へ実入力付きで適用し、15発言の引用と人数・根拠の参照、相反する希望、ブラウザーの絞り込み・原文への移動と実Markdown/JSON保存を照合しました。実顧客の調査、プラグインのインストール・MCP・ブラウザーAIは実行していません。物理iOS/Safari/VoiceOverと人による承認は未確認です。

入力はinput/interviews.json、実際の整理結果はoutputs/synthesis.jsonとsynthesis.md、実ブラウザーの保存例はoutputs/browser-selected.mdとbrowser-complete.jsonです。実行メモoutputs/result.md、入出力samples.json、確認verification.jsonを同梱します。動画は実データ・実画面を編集した28秒720p30fps・無音で、video/storyboard.jsonは制作時の設計、現在の確認はverification.jsonです。

ZIPにはexamples/knowledge-work-plugins-example/、media/、公開brief-to-demoの本文とMIT表記を含みます。認証、私的な統括スキル、モデル履歴全文、巨大モデル・cache・node_modulesは含めません。展開先ルートをHTTP配信して /examples/knowledge-work-plugins-example/ を開けます。原典7ファイルは改変せずApache-2.0とともに保存しています。原典全体やコネクター設定一式の配布ではありません。その他の機能は固定版GitHubを参照してください。

```text
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/knowledge-work-plugins-example/tools/motion-reel
python examples/knowledge-work-plugins-example/render.py --out renders/knowledge-work-first
```

動画の出力先はソースの外の空フォルダにしてください。掲載結果を上書きせず、別の空の作業先で新しい資料へスキルを適用してください。
