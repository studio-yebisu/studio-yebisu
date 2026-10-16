# まちの作業席 — Browser Use の操作APIで、条件で探す手順を残す

架空の作業席12件を探す静的な検索画面（`fixture.html`）を、Browser Use の Actor API（Browser・Page・Element の直接操作）で、事前に決めた6状態の手順どおりに操作し、各状態の条件・結果・画面を保存する作例です。保存した記録は `index.html` で読みます。

- 使う原典：browser-use/browser-use 固定コミット `c75e8476e26d18b7617643bc2ae082fae8eae431`（配布版 0.13.11、MIT License、Copyright (c) 2024 Gregor Zunic）
- 使う API：`Browser`（`BrowserSession`）・`Browser.start`・`Browser.new_page`・`Page.set_viewport_size`・`Page.get_elements_by_css_selector`・`Element.fill`・`Element.select_option`・`Element.check`・`Element.click`・読み取り専用の `Page.evaluate`・`Page.screenshot`・`Browser.stop`
- 上流の文書（`vendor/browser-use/skills/open-source/references/actor.md`）では、Actor API は「Legacy Direct Browser Control」と書かれています。

## やること・やらないこと

この作例でやること：

- 手元の `127.0.0.1` で配った架空の検索画面だけを開く
- `input/scenarios.json` に書いた6状態の手順を、その順に1回ずつ実行する
- 各状態のあとに、画面の DOM から条件・結果の全項目・件数・該当なしの表示を読み取り、入力の架空データと1項目ずつ照合する
- 各状態の画面を 1280×900 の PNG で保存し、照合がすべて通ったときだけ JSON を書く

やらないこと：

- `Agent` や `Agent.run`、LLM による次の操作の判断、`ChatBrowserUse`、`get_element_by_prompt`・`extract_content` などの LLM を使う機能
- Browser Use Cloud、API キー、アカウント接続、有料 API
- 既存の Chrome プロファイル（ログイン情報）の利用、拡張機能の自動ダウンロード、Chromium の自動ダウンロード
- 実在の施設の検索・料金・予約

Browser Use の中心である自律エージェントとしての能力は、この作例では使っておらず、確かめていません。

## 6つの状態

| ID | 手順 | 期待するID |
| --- | --- | --- |
| S01 | 操作なし（読み込みの完了を待つ） | 12件すべて |
| S02 | `#search` に「電源」を `fill`、`#apply` を `click` | 12件すべて |
| S03 | `#area` で「恵比寿」、`#budget` で「800」を `select_option`、`#apply` を `click` | W01・W02・W04・W11 |
| S04 | `#saturday`・`#power` を `check`、`#apply` を `click` | W01・W11 |
| S05 | `#search` に「存在しない条件」を `fill`、`#apply` を `click` | 0件 |
| S06 | `#reset` を `click` | 12件すべて |

条件は前の状態から引き継ぎます。キーワードは名前・エリア・説明文を NFKC 正規化・小文字化し、空白で区切った語がすべて含まれるかで探す**文字の一致**です。S02 では説明文に「電源なし」とある W04・W08 も「電源」に一致して残ります。キーワードは設備の分類ではなく、電源の有無で絞るのは「電源あり」のチェック（S04）です。並び順は入力の順のままです。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `input/workspaces.json` | 架空の作業席12件（固定の入力） |
| `input/scenarios.json` | 6状態の手順と期待するID（固定の入力） |
| `fixture.html`・`fixture.js`・`fixture.css` | 操作する検索画面。`input/workspaces.json` だけを読み、出力には依存しない |
| `run_browser.py` | Browser Use の Actor API で操作し、照合して記録する Python スクリプト |
| `requirements.txt` | 固定コミットの browser-use のソースZIP |
| `outputs/browser-run.json` | 実行で作る記録（この配布版に実際の出力を同梱） |
| `outputs/captures/S01.png`〜`S06.png` | 実行で作る各状態の画面（この配布版に実際の出力を同梱） |
| `outputs/method.md` | 操作と照合の方法 |
| `index.html`・`app.js`・`style.css` | 保存した記録を読む閲覧ページ |
| `request.txt` | 同じ作りを頼む依頼文 |
| `brief.json` | 制作ブリーフ |
| `vendor/browser-use/` | 原典の一部（改変なし）と LICENSE |

## 実行の手順（Windows・PowerShell）

必要なもの：[uv](https://docs.astral.sh/uv/)、Python 3.12、インストール済みの Google Chrome。依存の取得には通信が必要です。実行時の通信範囲は下記の設定と制約を参照してください。仮想環境は、公開する作例フォルダの外に、この作例専用で作ります（他のプロジェクトやグローバルの Python 環境は使いません）。

```powershell
# 作例フォルダで
$venv = Join-Path $HOME '.venvs\studio-yebisu-browser-use'
uv venv --python 3.12.9 $venv
uv pip install --python "$venv\Scripts\python.exe" -r requirements.lock.txt

# 1つ目の PowerShell：作例フォルダを 127.0.0.1 だけで配る
& "$venv\Scripts\python.exe" -m http.server 8864 --bind 127.0.0.1 --directory .

# 2つ目の PowerShell：操作して記録する
& "$venv\Scripts\python.exe" run_browser.py --base-url http://127.0.0.1:8864
```

上流のスキルは `uvx browser-use install` での Chromium の導入も案内していますが、この作例では使いません。`--chrome`（既定 `C:/Program Files/Google/Chrome/Application/chrome.exe`）で既存の Chrome を指定し、見つからなければ止まります。

### `run_browser.py` の引数

| 引数 | 既定 | 内容 |
| --- | --- | --- |
| `--base-url` | `http://127.0.0.1:8864` | `http://127.0.0.1:<port>` か `http://localhost:<port>` だけ。認証情報・パス・クエリ・他のホストは拒否 |
| `--out` | `outputs/browser-run.json` | 書き出す JSON。既にあれば止まる。画像は同じフォルダの `captures/` に書き、S01〜S06.png のどれかがあれば起動前に止まる |
| `--chrome` | `C:/Program Files/Google/Chrome/Application/chrome.exe` | 既存の Chrome。自動ダウンロードはしない |
| `--work-dir` | 一時フォルダを作る | 設定置き場と専用プロファイルを置く場所。指定した場合は削除しない。作例フォルダの中は指定できない |

作り直すときは、空の出力先を指定します（例：`--out outputs/run-2/browser-run.json`）。

### 起動前に設定すること

`run_browser.py` は browser_use を読み込む前に、次の環境変数を自分のプロセスに設定します：`ANONYMIZED_TELEMETRY=false`、`BROWSER_USE_CLOUD_SYNC=false`、`BROWSER_USE_DISABLE_EXTENSIONS=true`、`BROWSER_USE_SETUP_LOGGING=false`、`BROWSER_USE_CONFIG_DIR=<作業フォルダ内>`。あわせて python-dotenv 1.2 系の `load_dotenv()` を無効にする `PYTHON_DOTENV_DISABLED=1` も設定します（スクリプト自身は `.env` も API キーも読みません）。

ブラウザーは `Browser(headless=True, executable_path=…, user_data_dir=<作業フォルダ内の新しいプロファイル>, enable_default_extensions=False, allowed_domains=[配信元], permissions=[], accept_downloads=False, auto_download_pdfs=False, window_size={'width': 1280, 'height': 900}, viewport={'width': 1280, 'height': 900}, keep_alive=False)` で起動し、エラーのときも最後に `Browser.stop()` を呼びます。

`allowed_domains` はブラウザーの移動先を配信元に限る設定で、OS 全体の通信を遮断するものではありません。オフラインでの実行は保証しません。

## 出力

`outputs/browser-run.json`（形式 `studio-yebisu-browser-run-v1`）には、原典のリポジトリとコミット、入力2件の SHA-256、範囲（Actor API・事前の手順・Agent と LLM なし）、実際の Python と browser-use の版、成功した操作の回数、6状態それぞれの操作・読み取った条件・結果の全項目・件数・画像の SHA-256 と大きさが入ります。期待するIDは照合にだけ使い、結果は実際に DOM から読んだ値です。時刻・手元のパス・ポート番号は書きません。照合が一つでも外れたら JSON は書かず、途中までの画像だけが残ることがあります。

## 閲覧ページ

`index.html` は入力2件と `outputs/browser-run.json` を取得し、形・固定コミット・入力の SHA-256（ブラウザーの WebCrypto で再計算）・操作と結果の一致を確かめてから表示します。合わなければ理由と「もう一度読み込む」を出し、内蔵の代わりのデータは使いません。公開した閲覧ページを開いても Python・Browser Use・AI は動きません。

## 制作と確認の記録

固定版の実行、依存の記録、実ブラウザー、28秒の無音動画、ソースZIPの確認を制作担当が行いました。下の「掲載時の実行・確認」とverification.jsonに範囲を記録しています。物理iOS/Safari/VoiceOverと人による承認は未確認です。

## ライセンス

作例のコード・文章・架空データは MIT License（Copyright (c) 2026 Studio Yebisu、`LICENSE`）。`vendor/browser-use/` は browser-use/browser-use 固定コミットのファイルを改変せずに置いたもので、MIT License（Copyright (c) 2024 Gregor Zunic、`vendor/browser-use/LICENSE`）です。依存パッケージと Chrome は同梱していません。


## 掲載時の実行・確認

固定コミットのBrowser Use0.13.11を私的なPython3.12.9環境へ導入し、実行に含まれる168個のPythonソースの原典一致、106個の依存の整合を確認しました。配布用wheelが除外する7個のテストモジュールを、実行ソースの改変とは扱っていません。導入時の依存はrequirements.lock.txtに記録しています。

run_browser.pyを実行し、Browser/BrowserSession、Page、Elementの実APIでローカル検索画面を開き、入力・選択・チェック・クリックを行いました。実DOMから6状態の結果を読み、全件・12件・4件・2件・0件・リセット12件を入力と照合しました。「電源」の文字検索には「電源なし」の説明も含まれ、「電源あり」のチェック条件とは異なります。これはデータ上の語句と設備条件の違いで、AIによる意味判定ではありません。

LLMが次の操作を判断するAgent.run、クラウドブラウザー、実ユーザーの認証済みプロファイル、実在施設の調査・予約は実行していません。Opus5.5によるソース制作と、Pythonでの定型操作実行を分けています。許可ドメインはナビゲーションの制約であり、OS全体の外向き通信を遮断した保証ではありません。

WindowsのIAB Chromiumで6幅、実際の検索・絞り込み・0件・リセット・保存結果の選択とJSONダウンロード、データ取得失敗からの再試行を確認しました。28秒720p30fps840フレームの動画は無音で、実画面と実結果を編集しています。連続操作の録画ではありません。代表/連続フレーム・同時刻の別順/新ページ描画・全デコード・実MP4終端を確認しました。物理iOS/Safari/VoiceOver・実支援技術・性能測定・人による内容/美術承認は未確認です。

配布ZIPのexamples/browser-use-example/README.mdを参照し、展開先をHTTPで配信してください。再描画は展開先ルートからnpm ci --ignore-scripts --no-audit --no-fund --prefix examples/browser-use-example/tools/motion-reel、次にpython examples/browser-use-example/render.py --out renders/browser-use-firstを実行します。出力先はソース外の空フォルダーです。私的統括スキル・X保存一覧・認証・モデル履歴全文・venv/cache/node_modulesは含みません。
