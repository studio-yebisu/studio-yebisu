# 手順と読み方

この作例は、固定版 3D Asset Server（arielshad/3d-asset-server f605df3425011bae55ade114c9e7b276f5b1297b・0.1.0・Apache-2.0）の原典の関数を、実際の Poly Haven API に使った記録です。依頼は「Webの小さなシーンに置くCC0の木箱を、容量を見てから取得し、実物を3Dで確かめる」。

## 原典のスキルをどう当てたか

原典の [`web/src/content/SKILL.md`](../vendor/3d-asset-server/web/src/content/SKILL.md) は、公開サーバー 3d.shep.bot の REST を curl で呼ぶ手順として書かれています。この作例では公開サーバーを使わず、その手順と規則を、同じ原典のライブラリの関数で行いました。

| SKILL.md・AGENTS.md の手順と規則 | この作例での操作 |
|---|---|
| 短く具体的な語で、`type` を付け、無料を優先して検索する | A01：`AssetService.search({ query: "wooden crate", types: ["model"], providers: ["polyhaven","fab"], freeOnly: true, limit: 3 })` |
| ライセンスを必ず伝え、商用には CC0 の配信元を優先する | A02：`getAsset("polyhaven:wooden_crate_01")` のライセンス・作者を記録し、ページに表示 |
| 形式は用途で選ぶ。three.js・Web には glb か gltf | A03・A08：`{ format: "gltf", resolution: "1k" }` |
| 大きな解像度を取る前に、ファイルと totalBytes を確かめる | A03：`selectFiles`・`totalBytes`・`expandFiles` で取得前に全ファイルと合計。A04：8k を予算付きで渡して止まることを確認 |
| 複数ファイルの素材（glTF + .bin + 画像）は一式で、読み込むコードの隣に置く | A08：`downloadFiles` が相対パスを保って5ファイルを保存。作り直しや圧縮し直しはしない |
| リンクだけの配信元（Fab など）は、その検索 URL を伝える | A01 の Fab は link と searchUrl、A07 は直接取得に絞ると skipped |

## 実行の流れ（run.mjs）

1. `input/asset-requests.json`・`input/expected.json`・`vendor-lock.json` の SHA-256 を、実行前に固定した値と照合する。
2. `vendor-lock.json` の115ファイル（原典58・原典の build:server が出力した dist/ の50・three の7）のバイト数と SHA-256 を照合する。原典が読み込む lru-cache と fflate の版が、原典の package-lock.json と同じことを確かめる。
3. 原典の既定値を変える環境変数が無いことを確かめ、`ASSET_SERVER_USER_AGENT` に識別できる User-Agent を入れる。
4. ここで初めて、`dist/core/service.js`・`dist/core/http.js`・`dist/core/download.js`・`dist/providers/polyhaven.js`・`dist/providers/linked.js` を読み込む。
5. 原典の `createHttpClient({ fetchImpl })` に、Node の fetch を包んだものを渡す。包みは本物のレスポンスを `clone()` して中身を非公開のフォルダーへ保存し、URL・状態・バイト数・SHA-256・User-Agent を記録するだけで、受け取ったレスポンスをそのまま返す。
6. `new AssetService({ providers: [polyhaven, fab], http })` で、A01〜A08 を順に行う。止まる操作も含め、原典が返した値・例外をそのまま記録する。
7. A08 の5ファイルについて、ディスク上のバイト数・SHA-256・MD5 を、Poly Haven の files API の `size`・`md5`、通信の記録、A03 の `sizeBytes` と照らす。glTF を JSON として読み、`asset.version`、buffer と画像の参照先、アクセサーの範囲、インデックスの最大値（bin から実際に読む）、メッシュ・三角形・頂点の数を数える。
8. 結果を得た後でだけ `input/expected.json` と照らし合わせ、確認の一覧を作る。
9. すべて合格のときだけ、取得した5ファイルを `outputs/assets/polyhaven-wooden_crate_01/` へ写し（写した後にもう一度 SHA-256 を照合）、`outputs/api-info.json`・`outputs/api-files.json`（info・files API の応答のバイト列そのまま）、`outputs/asset-runs.json` を1回だけ書く。どれかが既にあれば何も書かずに止まる。

## 記録の読み方（outputs/asset-runs.json）

- `results[]`：8件。各件に `id`・`label`・`operation`・`input`（`input/asset-requests.json` のその1件と同じ）・`output`（原典が返した値）・`error`（原典の例外の `name`・`message` と、その例外が持つ値）・`observations`（記録から読み取った要点と、その操作の通信の URL・状態・バイト数・SHA-256・User-Agent）。
- A01・A07 の `output` は `AssetService.search` の戻り値そのもの（`results` と配信元ごとの `providers`）。`tookMs` は実行時に測った時間で、再実行で変わります。
- A02 の `output` は `getAsset` の戻り値（全形式・全解像度のファイル一覧を含む）。
- A03 の `output` は `selectFiles` の結果・`totalBytes`・`expandFiles` の結果。
- A04 の `output` は選んだ解像度・合計・予算・ファイル一覧、`error` は `downloadFiles` が投げた例外。`observations.download_requests` は downloadFiles を呼んでいる間の通信の数、`budget_dir_created` は保存フォルダーが作られたか。
- A08 の `output` は、`downloadFiles` の戻り値の `files`（保存先からの相対パスに直したもの）と `bytes`、`model_entry`（ページが読む glTF）、`bundle`（形式・解像度・ファイル数・合計・中身の内訳）、`manifest`（各ファイルのバイト数・SHA-256・MD5・Poly Haven の size と md5・通信の記録）、`gltf`（参照と構造を実ファイルから数えた値）、`asset`（作者・配布元・ライセンス・出典・表示する出典の行）。
- `network`：通信の数と接続先。Fab への通信はありません。
- `summary`・`verification`：操作の数・取得したモデルの数・ファイル数・合計バイト数と、確認の名前と合否。数はすべて記録から数えた値です。

記録に時刻・絶対パス・計算機や利用者の情報・認証情報は入れていません。原典の `downloadFiles` が返す絶対パス入りの値、カタログ全体の応答、各通信の応答の全文は `--artifact-dir` にだけ残します。

## glTF の数え方

- 三角形は、各 primitive の `mode` が 4（TRIANGLES）なら「インデックスの数 ÷ 3」（インデックスが無ければ頂点数 ÷ 3）、5・6（STRIP・FAN）なら「数 − 2」で数えます。`gltf.counts.triangles` は mesh の定義ごとの合計、`gltf.scene.triangles` は既定のシーンが実際に描く分（ノードからたどった合計）です。
- Poly Haven のメタデータの `polycount`（`asset.poly_count_metadata`）とは別に記録し、同じ値だと決めつけていません。
- ページの3D表示では、GLTFLoader が読み込んだ結果から、メッシュの数と三角形の数をもう一度数え、`gltf.scene.primitive_instances` と `gltf.scene.triangles` と比べます。違えば表示を止めます。

## ページ（index.html）

- `outputs/asset-runs.json`・入力2ファイル・`vendor-lock.json`・`request.txt` を取得し、SHA-256・固定版・8件の入力・確認の合否・まとめの数・期待との一致を照合してから表示します。合わなければ理由と「もう一度読み込む」だけを出します。内蔵の代わりのデータはありません。
- 最初は A08 を表示します。A08 を開いたときだけ `model-view.js` を読み込み、記録にある5ファイルを取得してバイト数と SHA-256 を照合し、照合済みのバイトだけを原典の GLTFLoader に渡します。照合していない URL を読もうとしたら表示を止めます。
- 描画は読み込み・ボタン・大きさの変化のときだけです。自動で回しません。WebGL が使えないときや描画が中断されたときは、その旨を表示し、記録とファイルはそのまま使えます。


## 制作側による完成後の確認

原典の実APIで8操作・39確認、Poly Havenの実API/CDNへの8リクエストで、CC0の木箱1モデル・5ファイル・2,277,087bytesを取得しました。独立Python212照合では原典と各ファイルのMD5/容量・実BINの3メッシュ/6,576三角形を確認。新しいNodeの明示的なオフライン応答再生29確認で、全5ファイルが同じbytesになりました。再生は保存した実応答を使い、ライブAPIを再照会した結果とは区別しています。

IAB Chromiumの6幅×8件で横はみ出し・44px操作部/16pxフォーム、全入力/結果、実JSONと実5ファイルZIP保存・依頼文コピー、3種の記録エラーとglTFハッシュ異常からの再読込、実3Dの回転・リセット・線表示を確認しました。28秒・720p・30fps・840フレームの無音動画は代表/連続フレーム・360px文字・終端・任意時刻の別順/新ページPNG一致・全デコード・ネイティブ再生終了を確認。実機iOS/Safari/VoiceOver・人による承認や本番ゲームの画質/性能は未確認です。

実行記録・5ファイルは初回の実取得から無変更です。Opus5.5は実装・日本語解説・映像編集ソースを制作し、制作側が入力固定・実行・独立照合・スマホ向けの文面調整と検証・配布を担当しました。木箱そのものの作者はJames Ray Cock（Poly Haven）です。モデル実行履歴全文・認証・通信原本全文は配布しません。
