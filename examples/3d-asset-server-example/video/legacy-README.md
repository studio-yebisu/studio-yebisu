# 解説動画の編集ソース — 木箱を探して、実物まで持ってくる

3D Asset Server 作例の、28秒・無音・1280×720 の解説動画を描く編集ソースです。保存した実行記録と、閲覧ページを撮影した無加工の JPEG 2枚から、1枚の canvas に時刻だけで描きます。連続した画面録画ではありません。

```text
Web用の木箱がほしい → 探す（候補3件・Poly Haven は ok、Fab はリンクだけ）
  → 取得の前に容量を見る（1k 2.17MiB は予算 4MiB 内、8k 113.14MiB は超過で取得0件）
  → 1k の5ファイルを取得し、大きさと MD5 を照合 → 取得した実物を3Dで見る
  → 探す → 容量 → 取得 → 3D
```

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` | 編集画面（プレビュー・時刻・場面・素材の照合・キューシート・範囲の説明） |
| `video.css` | 編集画面の見た目。書き出し時は canvas だけを正確な大きさで出す |
| `video.js` | 素材の照合と、全場面の描画。`window.seek`・`window.motionConfig`・`window.motionReady` を持つ |
| `storyboard.json` | 場面ごとの伝えること・入る／出る時刻・保持・使うデータ・素材のハッシュ・確認の状態 |
| `assets/` | 制作側が固定した素材8件と `data-hashes.json`（この工程では変更していない） |

## 場面

| 時刻 | 主な文字 | 伝えること | 使う実データ | 読む保持 |
| --- | --- | --- | --- | --- |
| 0–4秒 | Web用の／木箱がほしい | 依頼と、取得した実物。0秒から見出しと木箱が見える | desktop.jpg の3D表示部、CC0・作者・配布元 | 1.05–3.65秒 |
| 4–8秒 | 探す：候補は3件 | 短い語で探し、無料の CC0 の候補が3件。Poly Haven は ok、Fab は link で通信なし | A01 の検索語・候補・配信元の状態、A07 の skipped（注記） | 5.65–7.65秒 |
| 8–12秒 | 取得の前に、容量を見る | 1k の全5ファイルの合計は取得の前に分かり予算内。8k は約28倍で、原典が取得の通信を出す前に止める | A03・A04 の合計、予算 4,194,304 バイト、原典の例外の文そのまま | 10.05–11.65秒 |
| 12–17秒 | 1k の5ファイルを取得 | 取得したのは取得前に見た5ファイルそのもので、大きさと MD5 が Poly Haven の値と5件とも一致 | A08 のパス・バイト数・MD5、独立した確認212件、通信なしの再生29件 | 13.8–16.65秒 |
| 17–23秒 | 取得した実物を、3Dで見る | 5ファイルは実際に3Dモデルとして読める。スマホは最初の向き、パソコンは右へ回す2回 | phone.jpg・desktop.jpg の3D表示部、glTF の数 | 18.55–22.65秒 |
| 23–28秒 | 探す → 容量 → 取得 → 3D | 1モデル・5ファイル・2.17MiB・CC0 と出典、この作例の範囲 | 集計、実際の通信8件（API 3・ファイル 5）、確認39件 | 23.95–28秒（約4.05秒） |

ポスターは19.5秒（場面5の描き終わり）。各場面の入りと出の秒は `storyboard.json` にあります。

構成の理由：最初の場面で依頼と実物を同時に見せ、何の映像かを0秒で伝えます。そのあと原典のスキルの順序（探す → 利用条件と全ファイルの容量を見る → 取得）どおりに、原因（容量を見た）と結果（8k は通信0件で止まり、1k は5ファイルが一致）を1場面ずつ置き、最後に取得したファイルが本当に3Dとして読めることを実画面で示します。終わりの場面は流れと出典を約4秒止めます。

## 素材と出典

`video.js` は最初に `assets/data-hashes.json` の SHA-256 を固定値と比べ、次に8件の SHA-256 とバイト数を確かめてから、記録の中身を照合します。合わなければ描かず、理由を出し、「素材をもう一度読み込む」で全部を取り直します。埋め込みの代替データや代わりの画像はありません。

| ファイル | バイト数 | SHA-256 |
| --- | ---: | --- |
| `assets/data-hashes.json` | — | `e17aa95ce0f6e65ba4f140bf4435e26d1b18e8995efab569977a2f5239b2ec69` |
| `assets/asset-runs.json` | 94,805 | `2c8ebb0df73290a6cf4effbd1774790d495e31c700b32da6f94440e87df92d54` |
| `assets/independent-checks.json` | 24,531 | `013a796893aabe1803cd9b40e417b7acf7400421be62d17f752e8037687d2af4` |
| `assets/reproduction-checks.json` | 3,396 | `0b69bb1c9018dd46c41b3e12507fd07787e79dd280501beddbd23cd104550879` |
| `assets/asset-requests.json` | 2,401 | `cced85c1dc314fb7c516bac22c3c8f23fe6caf95df6c4a854acbc0e1cd7bc019` |
| `assets/vendor-lock.json` | 29,590 | `67f280672c4268d5a06b401e9e91b2c3010968c1e78211b29724b132b9266973` |
| `assets/screens.json` | 1,481 | `1489ee57487401c66505f5a452bdff953910efa049f394dc458446f671c78682` |
| `assets/phone.jpg` | 38,625 | `6a1c5813580df92f34b5fa3ef353887a2c68a1546265c4d6c3d70ca7a4f9ba8e` |
| `assets/desktop.jpg` | 74,828 | `b5f3bba7d2eec2ff6e8bafa6010e3d91f50978e5a6ad96e1dca259c7617c67d7` |

照合する内容：

- 固定版 arielshad/3d-asset-server `f605df3425011bae55ade114c9e7b276f5b1297b`・0.1.0・Apache-2.0。`vendor-lock.json` の115ファイル（原典58・原典の build:server の出力50・three 0.180.0 の7）と、記録の固定・入力とロックの SHA-256・three の固定が一致。
- 記録の8件の入力が `asset-requests.json` の A01〜A08 と一致。配信元は polyhaven と fab、予算 4,194,304 バイト、User-Agent が入力と同じ。
- 実際の通信は Poly Haven の2つのホストだけで計8件（API 3・ファイル 5）。Fab へは0件。
- A01 の候補3件（先頭が選んだ Wooden Crate 01）・Poly Haven は ok・Fab は link。A02 の CC0・作者・glTF。A03 の1kの5ファイルと合計 2,277,087 バイトが予算内で、通信0件。A04 の8kの合計 118,636,175 バイトが予算を超え、取得の通信0件・保存フォルダーなし、原典の例外の文が記録の合計と予算を1024進の小数1桁で含むこと。A05 `InvalidAssetIdError`、A06 `UnknownProviderError`、A07 の Fab が skipped。
- A08 の5ファイルの大きさ・MD5 が Poly Haven の files API の値と、SHA-256 とバイト数が通信の記録と一致し、A03 の選択と同じ5ファイル。glTF 2.0 の参照がすべて同じフォルダーの実ファイルで、メッシュ・三角形・頂点の数が独立した確認と一致。
- 実行時の確認39件・独立した確認212件・通信なしの再生29件（実際の応答8件・外部通信0件・5ファイルのバイト一致）がすべて通過。集計は8操作・1モデル・5ファイル・2,277,087 バイト。
- 画面の2枚は JPEG の開始・終了の印、ヘッダーの大きさ、読み込んだ大きさが `screens.json`（スマホ 360×780・パソコン 1265×889。撮影時に指定した画面の大きさではなく、実際の JPEG の画素数）と一致。`rgb_sha256` は JPEG の読み込み方で変わりうるため、ブラウザーでは計算し直さず出典として記載するだけです。

画面の使い方：2枚とも閲覧ページの3D表示部を `video.js` の `FRAMING` の矩形で切り抜き、拡大だけして描きます（色・質感を変えるフィルターや加工はしません）。矩形は読み込んだ画像の内側にあることも確かめます。形式のタグ（glTF・BIN・JPG）と容量の棒は説明図で、棒は取得の進み具合ではありません。候補の画像（Poly Haven のサムネイル）は使っていません。

原典：<https://github.com/arielshad/3d-asset-server/tree/f605df3425011bae55ade114c9e7b276f5b1297b>（スキル `web/src/content/SKILL.md`、検索と詳細 `src/core/service.ts`、選択と取得 `src/core/download.ts`）。素材：<https://polyhaven.com/a/wooden_crate_01>。

## 編集画面で見る

作例のフォルダー（`index.html` のある場所）で次を実行し、<http://localhost:8000/video/> を開きます。`file://` では照合できません。

```text
python -m http.server 8000 --bind 127.0.0.1
```

- 最初は0秒で止まっています。自動再生はしません。照合が終わるまで映像（`#stage`）は隠れ、`#status` と `#loading` が状態を示します。
- 「再生」（`#play`）は押すと「一時停止」に変わります（`aria-pressed`）。時刻のスライダー（`#time`）は0〜28秒・0.1秒刻みで、動かす・値を入れる・Enter のどれでもその時刻を描きます。`#clock` が今の時刻と状態を示します。
- 場面のボタンは `data-time` の時刻で止めます（場面4は14秒）。「◯秒に戻す」（`#reset`）は最後に選んだ時刻（スライダー・場面のボタン・`window.seek`）へ戻します。14秒を選んだ後なら14秒のままです。
- 照合に失敗すると映像を消して隠し、再生・スライダー・戻す・場面のボタンを止めます。「素材をもう一度読み込む」（`#retry`）は全部を取り直し（同時に1回だけ）、通れば0秒で止まった状態に戻ります。
- 素材8件の SHA-256（64文字すべて）とバイト数は「素材8件の SHA-256 照合」（`#asset-checks`）に、一致・不一致・照合前で常に表示します。
- 編集画面は記録を描くだけで、検索・取得・AI の呼び出し・外部への通信はしません。認証情報も要りません。

## 書き出し

書き出しは制作側が行います。作例のフォルダーの `render.py` が、同梱の `tools/motion-reel/render.mjs`（Motion Reel）を使います。Node.js 20 以上、Chrome、FFmpeg と ffprobe が要ります。初回だけ、同梱のレンダラーの依存を `package-lock.json` どおりに入れます。作例の実行（`run.mjs`）にはこれらは要りません。

```text
cd <作例のフォルダー>
npm --prefix tools/motion-reel ci --ignore-scripts
cd video
python ../render.py --out <作例のフォルダーの外の、新しい空のフォルダー>
python ../render.py --out <別の新しい空のフォルダー> --stills-only
```

- 出力先は毎回、作例のフォルダーの外の新しい空のフォルダーにします。既にある書き出しは上書きしません。
- レンダラーは `window.__MOTION_RENDER__` と `window.renderConfig` を渡し、`window.motionReady` を待ってから `window.seek` で各時刻を描きます。同じ時刻を別の順序と新しいページで描いた PNG の一致を記録します。これは同じ環境での再現性で、別の OS やフォントで同じ画になる保証ではありません。
- 文字はこの環境のシステムフォント（游明朝・游ゴシック・Consolas など）で描きます。フォントが違う環境では字幅が変わります。

## 作った人・動いたもの

- この5ファイル（`index.html`・`video.css`・`video.js`・`storyboard.json`・`README.md`）は Claude Opus 5.5 が書きました。映像の文字・構成・照合の書き方がこの工程の成果です。書いている間にコードは実行していません。
- 記録の値（候補、利用条件、容量、原典の例外、取得したファイル、件数）はモデルではなく、改変していない原典の関数が Node 24.18.0 で実際の Poly Haven API に対して返したものです。入力と期待は制作側が実行前に固定しました。実行・独立した確認・通信なしの再生・閲覧ページの撮影は制作側が行いました。
- 木箱の3Dモデル Wooden Crate 01 は James Ray Cock の作品で、Poly Haven が CC0 で配布しています。3D Asset Server は既にある素材を探して取得するもので、モデルを作ってはいません。Claude Opus 5.5 も作っていません。
- この映像の中でも編集画面の中でも、3D Asset Server・エージェント・モデルは動きません。公開サーバー 3d.shep.bot・HTTP API・MCP の通信路・原典の Web 画面・Blender・ゲームエンジンも使っていません。

## 確認の状況

- IAB Chromiumの6幅×8件で横はみ出し・44px操作部/16pxフォーム、全入力/結果、実JSONと実5ファイルZIP保存・依頼文コピー、3種の記録エラーとglTFハッシュ異常からの再読込、実3Dの回転・リセット・線表示を確認しました。28秒・720p・30fps・840フレームの無音動画は代表/連続フレーム・360px文字・終端・任意時刻の別順/新ページPNG一致・全デコード・ネイティブ再生終了を確認。実機iOS/Safari/VoiceOver・人による承認や本番ゲームの画質/性能は未確認です。
- 実機の iPhone Safari・VoiceOver は確かめていません。
- 人による承認と公開は行っていません。

## 利用条件

- 3D Asset Server（`../vendor/3d-asset-server/`）：arielshad/3d-asset-server 固定コミット `f605df3425011bae55ade114c9e7b276f5b1297b` の無改変ファイルと、その build:server が出力した dist/。Apache-2.0（`../vendor/3d-asset-server/LICENSE`）。
- three 0.180.0（`../vendor/three/`）：無改変ファイル。MIT License（`../vendor/three/LICENSE`）。
- 取得した3Dモデル：Wooden Crate 01・James Ray Cock・Poly Haven・CC0（<https://polyhaven.com/license>）。帰属表示は不要ですが、映像と編集画面に作者と配布元を表示しています。Studio Yebisu は Poly Haven の公式の製品・提携先ではありません。
- 作例のコード・文章・入力・閲覧ページ・この映像ソース：MIT License（`../LICENSE`・Copyright (c) 2026 Studio Yebisu）。
- Motion Reel のレンダラー（`../tools/motion-reel/`）：MIT License（`../tools/motion-reel/LICENSE`）。
- 映像には上流のロゴ、Poly Haven のサイトの画像やサムネイルを使っていません。

## 制作側による完成後の確認

IAB Chromiumの6幅×8件で横はみ出し・44px操作部/16pxフォーム、全入力/結果、実JSONと実5ファイルZIP保存・依頼文コピー、3種の記録エラーとglTFハッシュ異常からの再読込、実3Dの回転・リセット・線表示を確認しました。28秒・720p・30fps・840フレームの無音動画は代表/連続フレーム・360px文字・終端・任意時刻の別順/新ページPNG一致・全デコード・ネイティブ再生終了を確認。実機iOS/Safari/VoiceOver・人による承認や本番ゲームの画質/性能は未確認です。

この段落とverification.jsonが完成後の記録で、Pagesと実公開URLは限定公開後に別途確認します。
