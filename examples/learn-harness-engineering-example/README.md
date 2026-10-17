# 1件だけ進めて、続きはファイルへ。

Harness Creatorが作った5ファイルを、大きな図の中で使います。作業の決まり、1件に絞る機能一覧、今の進捗、検証の入口、次へ渡す引き継ぎが、作業中の1枚のカードと保存フォルダーにつながります。架空の書店メモ8件を探すCLIを例に、実装した後も未検証なら作業中のまま残し、制作担当が実行した検証の根拠を、新しいセッションが読む流れです。

最初の実装セッションはCLIと検証コードを書きましたが、シェルを使わずfeat-001をin-progressに残しました。制作担当が実際に./init.sh、build、searchを実行し、検索8問と不正入力11件の拒否を確認しました。別の新しいOpus5.5セッションはその保存ファイルを読んで、状態3ファイルだけを更新しています。検証を実行したのは制作担当で、2つの執筆セッションが実行したものではありません。次のfeat-002（引用付き回答）は未着手のままです。

検索の結果も元の実出力です。Q03の全角空白で区切った読書会と土曜はN02だけ。Q06の存在しない星の棚は0件が正しい結果です。不正入力11件の終了コード1は正しく断った記録で、11回の偶発的な失敗を表しません。構造点検の点数は実テストとも効果測定とも別です。

上の図は保存済みの実行を説明し、選んだCLI記録を元の全項目ごとJSONで保存できます。下の詳しい記録や元の閲覧画面から、8問の全文、実メモ、生成した雛形、2つのセッションの状態と検証の記録を開けます。ブラウザー内で試す検索と、保存されたNode CLIの結果は別に扱います。ページ内でNodeやAIは実行しません。

原典はwalkinglabs/learn-harness-engineering固定版38ddcd2bf8d65271f668b94e7c875ca1d629d622、MIT、Copyright (c) 2025 WalkingLabです。Harness CreatorのSKILL.mdと無改変の生成・構造点検CLIを元の実入力へ適用した記録、25原典ファイル、73個の実装・入力・出力・状態ファイルを保持しました。今回、CLIも元のエージェントセッションも再実行していません。

32秒の無音縦横動画では、同じ書類と作業カードが、検証の門、保存フォルダー、新しいセッションへ動きます。動きは概念の説明で、実際の操作や会話記憶の録画ではありません。モデルの有効性・信頼性・開発速度の向上を実証した比較でもありません。講座Project01/02、Electron課題、LLMによる回答は範囲外です。

新しい図と動画の編集コードはClaude Opus5.5が執筆しました。制作担当の受領後の変更、描画、技術検証、包装と掲載は分けて記録しています。音声ガイド・原稿・音源・音声ストリームはありません。エージェントによる確認と自動検査は、人による内容や見た目の承認、実機iPhoneでの確認とは区別します。

縦動画は../../media/learn-harness-engineering-example.mp4、横動画は../../media/learn-harness-engineering-example-wide.mp4、編集ソースはvideo/index.htmlです。29実ファイルの一覧はdata-manifest.json、10動画素材はvideo/assets/manifest.jsonへ記録しています。今回の確認はverification.json、旧28秒動画の確認はvideo/assets/original-verification.jsonです。

## 原実行と旧画面の制作記録（改修前の記述）

旧閲覧画面はcomparison.htmlに保持しています。以下の28秒動画・旧UIの確認は原制作時の記録です。今回の映像・画面の確認とは区別してください。

# メモを探す。続きも残す。— Harness Creator で小さな CLI 練習を引き継ぐ

架空の書店メモ8件を語とタグで探す Node.js の CLI を、Learn Harness Engineering の Harness Creator スキルが作る5ファイル（指示・状態・検証・範囲・引き継ぎ）で1機能だけ進め、次の新しいセッションへ引き継ぐ作例です。結果は `index.html` で読みます。

- 使う原典：walkinglabs/learn-harness-engineering 固定コミット `38ddcd2bf8d65271f668b94e7c875ca1d629d622`（MIT License、Copyright (c) 2025 WalkingLab）
- 使うスキル：`vendor/learn-harness-engineering/skills/harness-creator/SKILL.md`（改変なし）

これは書き下ろしの小さな CLI 練習に Harness Creator を当てはめた記録です。講座の Project 01・02（ハーネスなしとの比較実験、Electron アプリ、模擬Q&A）ではありません。制作環境には別の指示ファイル（AGENTS.md）があり、ハーネスなしの公平な比較はできないため、効果や信頼性の向上は測っていません。

## 流れ

1. **入力**：架空の書店メモ8件（`project/input/notes/`）と、実装の前に固定した8問の期待ID（`project/input/queries.json`）
2. **上流の CLI で5ファイル**：固定版の `create-harness.mjs` を改変せずに実行し、`AGENTS.md`・`feature_list.json`・`progress.md`・`session-handoff.md`・`init.sh` を作る。記録は `outputs/harness-created.json`、原本は `outputs/scaffold/`
3. **Opus による実装**：Claude Opus 5.5 の実装セッションが、4ファイルをこの練習用に書き換え、`project/src/notes.mjs`・`project/scripts/verify.mjs` を書く。feat-001 は作業中・未検証のまま残す
4. **実際の実行**：制作担当が `./init.sh` と `build`・`search` を実行し、標準出力を記録する
5. **次の新しいセッション**：別の新しいセッションが、引き継ぎファイルと検証の記録だけを読み、条件を満たすときだけ feat-001 を完了にする
6. **静的な閲覧ページ**：記録を取得して一致を確かめ、索引をブラウザーで探しながら、保存した CLI の結果と状態を読む
7. **解説動画**：実入力・実 CLI 結果・引き継ぎの状態から、約28秒の無音動画を作る

## 実行と引き継ぎの記録

固定版の原典CLIが5ファイルを生成したあと、Opus5.5が検索CLIと検証を書きました。制作側が、生成されたままの `./init.sh` をGit Bashで実行し、メモ8件・検索8条件・意図的な不正入力11件の確認を実行しました。実際の `build` と8条件の `search` の標準出力も保持し、入力9ファイルのSHA-256と全結果の項目を独立して照合しました。

新しいOpus5.5セッションは、保存済みのプロジェクト指示・引き継ぎ・実検証記録を読み、3つの状態ファイルだけを更新しました。feat-001は未検証のin-progressから、実行根拠付きのdoneへ移り、feat-002はnot-startedのままです。コードと入力は再開前後で変わっていません。`outputs/sessions/implementation/` と `outputs/sessions/resume/` で状態を比較できます。モデルの会話履歴全文ではありません。

原典の構造点検の実際の結果は `outputs/harness-assessment.json` と `outputs/harness-assessment-execution.json` にあります。英語の見出しや語句を含む静的な点検で、実テストの成功率やハーネスの有効性とは別です。

実出力と実画面を用いた28秒・720p・30fpsの無音動画と、6幅のスマホ向け画面を制作担当が確認しました。代表/連続フレーム、同時刻の別順/新ページ描画の厳密一致、全デコード、実MP4の終端を確認しています。最終的な確認範囲は配布版の `verification.json` に記録しました。実機iOS/Safari/VoiceOverと人による承認は未確認です。

## 必要なもの

- Node.js 20 以上。`npm install` は要りません（Node の組み込みモジュールだけ）
- `./init.sh` を動かす bash。Windows では Git Bash から実行します
- 外部API・キー・アカウント・通信は使いません

## コマンド

作例フォルダ（この README がある場所）から：

```bash
# 2. 5ファイルの生成（既に実行済み。既存ファイルは上書きされずスキップされる）
#    試すときは空のフォルダを --target に指定する
node vendor/learn-harness-engineering/skills/harness-creator/scripts/create-harness.mjs --target project --commands "node scripts/verify.mjs"

# 4. 実行（project/ に移って）
cd project
bash ./init.sh
node src/notes.mjs build --input input/notes --out outputs/index-reproduced.json
node src/notes.mjs search --index outputs/index-reproduced.json --query "読書会 土曜" --tag ""

# 構造の点検（テストではない。70点未満では終了コード1）
node ../vendor/learn-harness-engineering/skills/harness-creator/scripts/validate-harness.mjs --target . --json
```

- `build` は `--out` が既にあれば止まり、上書きしません。作り直すときは別の出力先を指定します
- `search` の `--query` と `--tag` は省略でき、空なら8件すべてを返します
- 入出力の形と確認の範囲は `project/docs/project.md` にあります

## ファイル

| ファイル | 役割 |
| --- | --- |
| `project/input/` | 固定の入力（メモ8件・8問） |
| `project/src/notes.mjs` | CLI（`build`・`search`） |
| `project/scripts/verify.mjs` | CLI を子プロセスで実行する検証。8問と意図的な失敗11件 |
| `project/init.sh` | 生成されたままの標準の検証 |
| `project/AGENTS.md`・`feature_list.json`・`progress.md`・`session-handoff.md` | 状態ファイル |
| `project/docs/project.md` | CLI の入出力 |
| `outputs/harness-created.json`・`outputs/scaffold/` | 5ファイルの生成記録と原本 |
| `outputs/method.md` | 入力・処理・状態・出力・失敗の分け方 |
| `index.html`・`app.js`・`style.css` | 閲覧ページ |
| `request.txt` | 同じ練習を頼む依頼文 |
| `brief.json` | 制作ブリーフ |
| `vendor/learn-harness-engineering/` | 原典の一部（改変なし）と LICENSE |

## 閲覧ページ

`index.html` は `project/outputs/index.json`・`outputs/exercise-run.json`・`project/outputs/verification.json`・`outputs/harness-created.json` と入力9件を取得し、形・固定コミット・入力の SHA-256（ブラウザーの WebCrypto で再計算）・中身の一致を確かめてから表示します。合わなければ理由と「もう一度読み込む」を出し、内蔵の代わりのデータは使いません。上の検索はブラウザー内で索引を探すもので、下の保存記録は Node CLI の実行結果です。ページを開いても Node・CLI・AI は動きません。HTTP で配信して開いてください（`file://` では取得できません）。

## 範囲と未確認の点

- 書き下ろしの小さな CLI 練習1件です。講座全体を終えたこと、Project 01・02 の比較、Electron アプリ、模擬Q&A、LLM の繰り返し実行は扱っていません
- 構造の点検の点数は、ハーネスの効果の証拠ではありません
- feat-002（引用付き回答）は次の候補として残し、LLM の回答は実装していません
- 物理 iOS/Safari/VoiceOver と人による承認は未確認です

## ライセンス

作例のコード・文章・架空のメモは MIT License（Copyright (c) 2026 Studio Yebisu、`LICENSE`）。`vendor/learn-harness-engineering/` は walkinglabs/learn-harness-engineering 固定コミットのファイルを改変せずに置いたもので、MIT License（Copyright (c) 2025 WalkingLab、`vendor/learn-harness-engineering/LICENSE`）です。講座全体・画像などの素材は同梱していません。


## 静的デモと編集用動画を開く

配布ZIPは展開先ルートをHTTPで配信し、`examples/learn-harness-engineering-example/index.html` を開きます。閲覧画面は入力9件の実バイト列を再取得してSHA-256を確認します。独立して実行するNode CLIにはパッケージ導入は不要です。

動画の再描画だけはNode20+・既存Chrome・FFmpeg・Pythonと同梱Motion Reel依存が必要です。展開先ルートで `npm ci --ignore-scripts --no-audit --no-fund --prefix examples/learn-harness-engineering-example/tools/motion-reel`、次に `python examples/learn-harness-engineering-example/render.py --out renders/learn-harness-first` を実行します。出力先は作例ソース外の空フォルダーにします。入力・結果・状態・実画面・編集ソース・動画を同梱し、私的統括スキル・X保存一覧・認証・モデル履歴全文・キャッシュ・node_modulesは含みません。


原典の構造点検は92/100（指示5・状態5・検証3・範囲5・ライフサイクル5、各5点満点）でした。検証の2項目は、AGENTS.mdとinit.shから英語のtest/build等の語句を検出できないためです。実際にはverify.mjsがCLIを子プロセスとして実行しています。最低領域は候補の指標で、失敗の原因とは断定しません。次の機能の受入条件と検証コマンドを結び付けること、実装に必要になった時点で本物のビルドや型検査を追加することを候補に残し、点数だけのための文言や不要な工程は足していません。

状態ファイルは制作時の実際の記録です。履歴中のruntime/への参照は制作側だけの実行・受領記録で、公開配布には含めません。公開側で確認できる根拠はoutputs/exercise-run.json、project/outputs/verification.json、outputs/init.stdout.txtとverification.jsonです。開始に必要なCLI・入力・init.shは同梱しています。モデル名の実行根拠全文は私的に保持し、公開制作記録には要点と受領ハッシュを残します。


## 記事から個別の検索記録を開く

URL末尾の#Q01〜#Q08で、その検索記録を初期選択します。記事の各サンプルの「デモで開く」もこの指定を使います。不明な指定では通常のQ03を開きます。検索の規則や入力・実CLI結果は変えていません。
