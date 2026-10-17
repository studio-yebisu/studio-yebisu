# Ragas作例：同じ10問を、文字列指標3つで変更前後に比べる

架空の図書室FAQ「凪の図書室」の同じ10問について、変更前・変更後の固定回答20件を、[Ragas](https://github.com/vibrantlabsai/ragas/tree/298b68274234c060deacab3cf5fb52aa3a20e885) の `ExactMatch`・`NonLLMStringSimilarity`（Levenshtein）・`StringPresence` で採点します。結果はスマホで読めるページで、根拠資料と制作担当の照合メモ（入力）と並べて確かめられます。

LLM・埋め込み・APIキー・新しいアカウント・外部サービスは使いません。

## できること

- 自分の10問（資料・質問・参照文・2組の回答・照合メモ）を `input/faq-pairs.json` の形で用意し、`evaluate.py` で60回の実際の `ascore` 呼び出しを行って、丸めない値を `outputs/evaluation.json` に保存する。
- 閲覧ページで、3指標の平均（変更前→変更後）と完全一致の件数を見る。
- 10問を検索・絞り込みし、1問ずつ、根拠資料・参照文・2つの回答の全文・3指標の値・照合メモを並べて読む。
- 選んだ問いを、点数付きの行と根拠資料ごと JSON（例：`nagi-faq-Q07.json`）で保存する。
- 依頼文（`request.txt`）をコピーして、同じ評価を自分の入力で頼む。

## できないこと・範囲

- 3指標は文字列の比較です。回答が根拠に忠実か、事実として正しいか、意味が同じかは判定しません。完全一致の件数や平均は正答率ではありません。採用や合否の基準値はありません。
- 照合メモのラベル（grounded・contradiction・unsupported_addition）は制作担当が入力に書いたもので、Ragas の出力でも LLM judge でも人による承認でもありません。
- before/after は意図して誤り・言い換え・根拠にない追記を入れた固定の入力です。実際のRAGシステム・モデル・検索器を変更して動かした結果ではありません。10問の架空データで、代表的なベンチマークではありません。
- Ragas の LLM を使う指標（faithfulness・factual correctness など）、検索の評価、モデルの比較は行っていません。それらを使う場合は、評価用LLMや埋め込みの接続と、そのサービスの料金が別に必要です。
- 閲覧ページは保存済みの結果を読むだけです。ページを開いても Ragas も AI も動きません。

## 手順

### 1. 入力を用意する

`input/faq-pairs.json` を開きます。資料10件・問い10件で、各問の `reference` は根拠資料の `text` と完全に同じ文字列にします。`before`・`after` にはそれぞれ `response` と `annotation`（`label` と `note`）を書きます。自分の入力に差し替えるときも同じ形にしてください。

### 2. Python で採点する

Windows PowerShell の例です。この作例専用の通常の仮想環境（venv）に入れ、グローバル環境やほかのツール（ComfyUI など）の環境には入れません。環境変数は今のPowerShellの中だけで設定し、インストール後に消します。

```powershell
python -m venv .venv
$env:SETUPTOOLS_SCM_PRETEND_VERSION_FOR_RAGAS = "0.0.0+studio.298b68274234"
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
Remove-Item Env:SETUPTOOLS_SCM_PRETEND_VERSION_FOR_RAGAS
.\.venv\Scripts\python.exe evaluate.py --out outputs/evaluation-new.json
```

- `requirements.txt` は Ragas を固定コミットのソースZIPから入れ、`rapidfuzz` を足します。ソースZIPには Git の情報がないため、インストールの間だけ `SETUPTOOLS_SCM_PRETEND_VERSION_FOR_RAGAS` で手元の版名 `0.0.0+studio.298b68274234` を与えます。これは Ragas の正式なリリース番号ではありません。原典はコミット `298b68274234c060deacab3cf5fb52aa3a20e885` で特定します。
- 実行した93パッケージの版は requirements.lock.txt に固定しています。最新版の依存では固定RagasのVertexAI importが失敗したため、Ragas本体を変えずにLangChainの互換系列へ調整しました。requirements.txtにも互換系列を指定しましたが、同じ版を使うにはlockファイルを参照します。Python3.12.9でuv pip checkを通し、Ragasの全237Pythonソースが固定版と同じことを照合しました。
- インストールには通信が必要です。採点（`evaluate.py`）の間は、Ragas の利用状況の送信を `RAGAS_DO_NOT_TRACK=true` で止め、Python の socket 接続を拒否して記録します。試みが1件でもあれば結果を書かずに失敗します。
- 既定の入力は `input/faq-pairs.json`、出力は `outputs/evaluation.json` です。`--input`・`--out` で変えられます。出力先が既にあれば上書きしません。
- 成功すると、実際に成功した呼び出しの回数（60）と出力先を表示します。

### 3. 結果を開く

`outputs/evaluation.json`（形式 `studio-yebisu-ragas-result-v1`）には、入力のSHA-256、原典のコミット、Python・Ragas・rapidfuzz の版、3指標の定義、10問それぞれの `before.scores`・`after.scores`、平均と件数、入力の照合メモのラベル数、限界の説明が入ります。

### 4. ページで読む

`index.html` を HTTP サーバー経由で開きます（ファイルを直接開くと、ブラウザーが JSON の取得を止めることがあります）。例：

```powershell
.\.venv\Scripts\python.exe -m http.server 8000 --bind 127.0.0.1
```

ページは入力と結果の両方を取得し、20件の回答とメモが一致するか、値がそろっているかを確かめてから表示します。合わなければ理由と「もう一度読み込む」を出します。最初は、入力で退行例として用意した Q07 を表示します。

### 5. 原典と照らし合わせる

点数の意味は、同梱した原典の `vendor/ragas/src/ragas/metrics/collections/_string.py` と `vendor/ragas/docs/concepts/metrics/available_metrics/traditional.md` で確かめられます。評価の方法の詳細は `outputs/method.md` にあります。

### 6. 保存する

ページで問いを選び、「この問いをJSONで保存」を押すと、形式 `studio-yebisu-ragas-selection-v1` のファイル（点数付きの行・根拠資料・指標の定義・入力のSHA-256・照合メモの出所）のダウンロードを要求します。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `input/faq-pairs.json` | 架空の資料10件・問い10件・固定回答20件・照合メモ |
| `evaluate.py` | 採点スクリプト |
| `requirements.txt` | 固定コミットの Ragas と rapidfuzz |
| `outputs/evaluation.json` | 採点結果（制作側の実行で作成） |
| `outputs/method.md` | 評価の方法 |
| `index.html`・`style.css`・`app.js` | 閲覧ページ |
| `request.txt` | 同じ評価を頼む依頼文 |
| `brief.json` | 制作ブリーフ（brief-to-demo） |
| `vendor/ragas/` | 原典の8ファイル（未改変） |

## 制作について

この作例のスクリプト・ページ・文書は、Claude Opus 5.5（`claude-opus-5-5`）が制作時に書いたものです。AIによる制作は作る過程だけのことで、ページの中でAIは動きません。ブラウザー内のAI、LLM judge、実際のRAGシステム、本番環境での評価は使っていません。物理的なiPhone・Safari・VoiceOverでの確認や、人による承認もしていません。

元の公開版ではPythonの実採点・実ブラウザー・28秒の無音動画を制作担当が確認しました。今回の図と32秒の無音動画の確認はvisual-r1として分けて記録します。具体的な範囲は以下の掲載時の記録とverification.jsonを参照してください。

## ライセンス

- この作例のコード・文章・架空の入力：MIT License（Copyright (c) 2026 Studio Yebisu）。`LICENSE` を参照。
- `vendor/ragas/` の8ファイル（`LICENSE`・`README.md`・`pyproject.toml`・`docs/concepts/metrics/available_metrics/traditional.md`・`src/ragas/metrics/collections/_string.py`・`src/ragas/metrics/collections/base.py`・`src/ragas/metrics/result.py`・`src/ragas/_analytics.py`）は、vibrantlabsai/ragas の固定コミット `298b68274234c060deacab3cf5fb52aa3a20e885` のファイルを改変せずに置いたものです。Apache License 2.0、Copyright [2023] [Vibrant Labs]。原典の `LICENSE` はそのまま同梱しています。
- Ragas とその依存パッケージは同梱していません。インストールしたものはそれぞれのライセンスに従います。


## 掲載時の実行・確認

この配布版のスクリプトとビューアーは、10問・10資料・fictional=trueを検証する架空例専用です。実資料や別の件数を扱うには、検証条件と表示・公開範囲を調整してください。自分の資料を依頼文で渡す際も、その違いを明記します。

固定ソースを同じ私的venvへインストールし、evaluate.pyを実行しました。Ragas collectionsのExactMatch / NonLLMStringSimilarity(Levenshtein) / StringPresenceを20回答に各1回、計60回呼び、全数値を別実装のUnicode距離・一致・包含と照合しました。依存導入時のLangChain community0.4.2には固定RagasがimportするVertexAIモジュールがなく、Ragasを変えずに互換系列の依存へ調整しました。実行環境はrequirements.lock.txtとverification.jsonへ記録しています。ZIP由来の0.0.0+studio.298b68274234はビルド用ラベルで、公式リリース番号ではありません。

完全一致は4/10→7/10。この増加は、固定された2組の文字列が基準文と同じ件数の違いです。実RAGやモデルの性能改善・正答率ではありません。Q07の18時→19時は一文字違いでも期限の矛盾、Q08の追記は資料外、Q05の言い換えは完全一致0でも資料の条件を保ちます。これらの意味照合メモは入力時に制作担当が用意し、Ragasの判定や人による承認とは分けています。

元の公開版ではWindowsのIAB Chromiumで6幅の実画面、検索/AND/絞り込み/0件/選択/実JSON保存と再試行を確認しました。28秒720p30fps840フレーム無音の説明は、実計算結果と実画面を編集した動画で、連続操作の録画ではありません。代表・連続フレーム、同時刻の別順/新ページ一致、全デコードと実MP4終端を確認しています。物理iOS/Safari/VoiceOver・実支援技術・性能測定・人による内容/美術承認は未確認です。

改修版の配布ZIPはexamples/ragas-example/とmedia/を含みます。展開先ルートをHTTP配信し/examples/ragas-example/を開いてください。再描画は展開先ルートからnpm ci --ignore-scripts --no-audit --no-fund --prefix examples/ragas-example/tools/motion-reel、次にpython examples/ragas-example/render.py --out renders/ragas-firstを実行します。出力先はソース外の空フォルダーにします。私的統括スキル・保存一覧・認証・モデル履歴全文・venv/cache/node_modulesは含めません。


## 図中心の改修（2026-10-17）


架空の「凪の図書室」FAQ10問と、用意した2組の固定回答を、大きな図で読みます。根拠の本から参照文を取り出し、回答の紙を「同じ文字」「文字の近さ」「全文を含む」の3つの道具に通すと、保存済みの実際の値が現れます。ブラウザーでRagasやAIを動かす機能ではありません。

Q07では、回答の18時が19時へ変わります。文字列の近さは0.96875でも、期限は資料と異なります。Q08では、基準文が全文入っていても、その後に根拠のない文が付いています。Q05では、言い方が変わって完全一致が0になっても、予約なし・1回・7日間という条件が残ります。条件や意味についての照合メモは制作担当が入力時に記したもので、Ragasの判定や人による承認ではありません。

「前」「後」を切り替え、同じ紙の変化を見比べます。選んだ問いは、両方の回答・丸めない全指標・根拠資料・元入力のハッシュごとJSONで保存できます。全文と10問の一覧、集計は図の下から開けます。元の検索・絞り込み画面もcomparison.htmlに保持しています。点数を合否や正答率へ置き換えません。

元の実行では、固定版RagasのExactMatch・NonLLMStringSimilarity（Levenshtein）・StringPresenceを20回答へ計60回呼びました。原入力・実出力・実行器と原典8ファイルは変更せず、今回の図と映像の改修のために再実行していません。原典は298b68274234c060deacab3cf5fb52aa3a20e885、Apache-2.0です。0.0.0+studio.298b68274234はソースZIPからのローカルなビルド用ラベルで、公式リリース番号ではありません。

before/afterは意図して作った固定入力です。実際のRAGシステムの変更・検索・回答生成や、モデルの性能改善を示すものではありません。LLM judge・埋め込み・外部の評価APIは使っていません。

新しい図と32秒の縦横動画の編集コードはClaude Opus5.5が執筆し、制作側が受領後の修正・検証・書き出し・包装・掲載を担当しました。修正の内訳はverification.jsonへ記録します。音声ガイドと音声トラックはありません。自動検査やエージェントの視覚確認は、人による内容や見た目の承認、実機iPhoneでの確認とは区別します。

縦動画は../../media/ragas-example.mp4、横動画は../../media/ragas-example-wide.mp4、編集ソースはvideo/index.htmlです。旧版の確認はvideo/assets/original-verification.json、今回の確認はverification.jsonです。
