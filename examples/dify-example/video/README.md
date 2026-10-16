# 解説動画の編集ソース — 問い合わせを、3つの担当へ。

Dify 作例（`../README.md`）の実行記録を、28秒・無音・1280×720・30fps（840フレーム）の映像に描く編集ソースです。

```text
問い合わせを入力 → ルールで担当へ → 引き継ぎメモ → JSON/DSL を持ち帰る
```

連続した画面録画ではありません。保存した実行記録と、閲覧ページを撮影した画像2枚から、コードで組み立てた映像です。映像の中で AI は動いておらず、振り分けを判断する演出もしていません。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` | 編集・確認用のページ。映像、再生・時刻の操作、場面一覧、素材8件の照合結果、原典とライセンス |
| `video.css` | ページの見た目（端末のフォントだけを使用） |
| `video.js` | 素材の照合と、任意の時刻の1枚を描く処理（`window.seek`） |
| `storyboard.json` | 場面ごとの時刻・伝えること・使う記録・切り替え・確認の状況 |
| `assets/` | 素材の一覧 `data-hashes.json`、実画面2枚とその由来 `screens.json`（制作側が固定。変更しません） |

## 映像の中身

| 秒 | 見出し | 使う記録 |
| --- | --- | --- |
| 0–4 | 問い合わせを、3つの担当へ。 | 8件の入力と、実際のメモ1行目の担当名 |
| 4–8 | ルールで、担当のメモへ。 | 7ノード・8本の線（説明図）と、D02 が実際に通った道・メモ |
| 8–12 | 請求でも、至急を先に。 | D06 の入力と結果、workflow.yml に書いた判定順 |
| 12–18 | 100人以上は、優先対応へ。 | D04（99人→通常窓口）、15秒で D05（100人→優先対応）へ |
| 18–22 | 入力は、そのままメモに。 | D07 の `{{ 7 * 7 }}` と `<script>` の行がメモに文字のまま入った結果 |
| 22–28 | 8件の入力と結果を、持ち帰る。 | 優先対応3・請求窓口1・通常窓口4、workflow.yml と実行記録、閲覧ページの実画面（D02・D05） |

- 担当名・件数・メモの行・ノード名・線は、照合した記録から読みます。判定順の文と「100人以上」は `workflow.yml` の説明文からそのまま写し、条件の `≥` と `'100'` も確かめます。
- D04 と D05 は、両方の入力と結果が同時に画面に出ないよう、14.7〜15.3秒でいったん消してから入れ替えます。99と100の違いはルールの境目で、品質の差ではありません。
- D07 は小さな1例です。文字がそのまま入ったことを示すだけで、安全性の検証ではありません。映像も文字を描くだけで、実行や評価はしません。
- 図は「説明図」、画面写真は「閲覧ページの実画面」と書き分けます。実画面は照合した画像をそのまま縮小して描き、描き直していません。Dify 公式の画面やロゴは使っていません。
- 音はありません（`audioEvents: []`）。最後の約5秒は止まった画面です。

## 素材（8件・固定）

`video.js` は `assets/data-hashes.json` を読み、その8件の対象とハッシュが `video.js` に固定した値と同じかを確かめてから、各ファイルを `../` + パスで読み、SHA-256 を照合します。

| ファイル | SHA-256 |
| --- | --- |
| `outputs/workflow-runs.json` | `692cc2f8b07ca77a8b3ccdae0a8abc4359e8a8804985bc4b75db1b56241e6694` |
| `outputs/independent-checks.json` | `efc466ec2dbd4845a35277225faf419e471872892d08d747130248973f25d2f4` |
| `input/tickets.json` | `b752f26d73d9fc3f48f8a3389fe876b88d273f2780bc316fdd15232a4d0cdc83` |
| `workflow.yml` | `d36f345c08705992f654571d35676a211bcae62abcfb6171c8655b308ab0776f` |
| `vendor-lock.json` | `e454e2189985857c0ac82258dc23b01f0010deecc1cc7bf737ff214d685696ff` |
| `video/assets/screens.json` | `1f8b5b062368be2ed1e5ff5c7f9a4922140e3b1a016ee2daac289aeb62c2b4fb` |
| `video/assets/phone.png` | `b5f1194cfc1ecc55f52f72ec4d3e114e3b0cf37bdede2cc1492a65fe745024cd` |
| `video/assets/desktop.png` | `6404ee75a61253f330febb4a0a46ab855f5ac62458501f05d540f6ef7b0f23b0` |

さらに、原典の固定版（langgenius/dify 1.17.1・`f77facf`）、graphon 0.7.0 と wheel の SHA-256、原典292ファイル、196の自動確認の合格、独立した照合の合格、通信・子プロセス・LLM の記録が0件であること、実行の入力が `input/tickets.json` と同じであること、担当ごとの件数が独立した照合と同じであることを確かめます。1つでも違えば `window.motionReady` は失敗し、ページは理由を表示して映像を描きません。代わりのデータは持っていません。

実画面2枚（`phone.png`・`desktop.png`）は、制作側が閲覧ページを IAB Chromium で撮影した画像をそのまま写したものです。

## 原典と版

- Dify：[langgenius/dify](https://github.com/langgenius/dify/tree/f77facfe6520ed379d723288aed0b4806ad76143) 1.17.1（コミット `f77facfe6520ed379d723288aed0b4806ad76143`）。
- 実行に使ったのは graphon 0.7.0 の公式 wheel（SHA-256 `6f7608aaaa65607c4935735137ed4b7029b1e6ca80202cbe829af3370cf4404e`）です。Dify 1.17.1 の `api/pyproject.toml` が `graphon==0.7.0` を宣言し、`api/uv.lock` が同じ wheel を固定しているため、これを使いました。
- 実行は `graphon.dsl.inspect`・`graphon.dsl.loads`（内部で `SlimDslNodeFactory`）・`GraphEngine.run` で、つながりは Dify 本体の `WorkflowGraphTopology` を改変せずに使いました。
- 使っていないもの：Dify のサーバー・管理画面（console）・API・Docker、difyctl、Dify の画面（`web/`）への取り込み、モデル（LLM）・意味による分類・要約、ナレッジ検索・ツール・プラグイン。

## 作った人と動かしたもの

`workflow.yml`・`run.py`・閲覧ページ、およびこのフォルダーの5ファイル（`index.html`・`video.css`・`video.js`・`storyboard.json`・この README）は Claude Opus 5.5 が書きました。架空の問い合わせ8件は、制作側が実行の前に作って固定しました。公式の API で実行し、独立した照合と閲覧ページの撮影を行ったのは制作側です。担当の比較とメモの差し込みはライブラリが行ったもので、Opus が書いたのはソースであり、記録に残ったメモそのものではありません。

## 書き出し（再現の手順）

素材は固定です。入力を変える場合は、返ってきた JSON を手で直さず、公式 API での実行・独立した照合・閲覧ページの撮影をやり直し、新しいハッシュで固定し直してから映像を書き出してください。

公開されている site フォルダーを直接使わず、コピーした別のフォルダーで行います。

1. 実行記録の再現（任意）：`../README.md` の手順どおり、コピー内の `outputs/workflow-runs.json` を別名で保存してから行います。

   ```text
   python -m venv <非公開の仮想環境>
   <非公開の仮想環境>/bin/python -m pip install -r requirements-runtime.txt   # Windows は Scripts\python
   <非公開の仮想環境>/bin/python run.py --artifact-dir <site の外の、新しい空のフォルダー>
   ```

2. 映像の書き出し：Node.js 20 以上、Google Chrome、FFmpeg と ffprobe が必要です。

   ```text
   npm ci --ignore-scripts --prefix tools/motion-reel
   python render.py --out <site の外の、新しい空のフォルダー> --work-root <site の外のフォルダー> --strip-at 11.85
   ```

   `render.py` は site を使い捨てのフォルダーへ写し、同梱の Motion Reel レンダラー（`tools/motion-reel/render.mjs`）で代表フレーム・連続フレーム・ポスター（13.5秒）・`video.mp4` を書き出します。出力先は空でなければ止まり、既存の書き出しを上書きしません。

ページで確認するときは、site フォルダーで `python -m http.server` を実行し、`http://localhost:8000/video/` を開きます。`file://` で直接開くと素材を照合できないため、理由だけを表示します。

## 確かめたこと・まだのこと

- 確かめ済み（この編集ソースを書く前に制作側が実施）：公式 API での8件の実行と196の自動確認、独立した照合、閲覧ページのネイティブブラウザーでの確認と撮影。
- 制作側が確認：書き出し・代表/連続フレーム・同時刻の別順序/新ページPNG一致・MP4全デコードと実再生。公開は、対象を限定した反映の後にPagesと実URLを確かめて別途記録します。
- `index.html` の MP4 リンク（`../../../media/dify-example.mp4`）は、書き出しと公開のあとに置かれる場所です。それまでは開けません。
- 実機の iPhone Safari、VoiceOver、人による承認は確かめていません。

## 利用条件

- この映像ソース・作例のコード・文章・架空の入力：MIT License（Copyright (c) 2026 Studio Yebisu、`../LICENSE`）。
- Dify：Dify Open Source License（Apache License 2.0 を基に、マルチテナントでの運用と、フロントエンドのロゴ・著作権表示に関する追加条件あり）。全文は `../vendor/dify/LICENSE`。この作例は `web/` を使わず、ロゴや画面も使っていません。
- graphon 0.7.0：Apache License 2.0。全文は `../vendor/graphon-wheel/graphon-0.7.0.dist-info/licenses/LICENSE`。
- Motion Reel のレンダラー：MIT License（`../tools/motion-reel/LICENSE`）。

## 作例ページで見るには

作例ページで問い合わせを選ぶと、入力・実際のメモ・通った道筋を読め、JSON と `workflow.yml` を開いて保存できます。この動画はその流れの要約です。

## 制作側による完成後の確認

1280×720・30fps・840フレーム・28秒の無音MP4を書き出しました。8素材のハッシュ・任意時刻へのシーク・別順序と新しいページでの同時刻PNG一致・代表14フレームと5つの連続フレーム列・360pxの主な文字・最後のフレームを確認。MP4は全デコードとネイティブ再生が終了まで通りました。編集画面の初期停止・14秒シーク・再生/一時停止、スマホの44px操作部・16px入力も確認しています。元の実API結果は変更していません。

人による承認・実機iOS/Safari/VoiceOverの確認は行っていません。サイトの反映は、対象を限定した公開の後にPagesと実URLを確かめて別途記録します。
