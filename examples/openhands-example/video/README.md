# 解説動画の編集ソース — 自動化の設定を、持ち運ぶ前に点検する

OpenHands Agent Canvas 作例の、28秒・無音・1280×720 の解説動画を描く編集ソースです。保存した実行記録と、閲覧ページを撮影した無加工の JPEG から、1枚の canvas に時刻だけで描きます。連続した画面録画ではありません。

```text
設定を書き出す → 時刻の無い O03 が原典の読み込みで止まる → 理由の文を読む
  → schedule だけ足した別の入力 O04 は形が通り、ファイルを保存できる
  → O06 の not-a-cron も形は通る（cron は未検証）・O07 は先頭の参照先だけ → 8設定の結果
```

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` | 編集画面（プレビュー・時刻・場面・素材の照合・範囲の説明） |
| `video.css` | 編集画面の見た目。書き出し時は canvas だけを正確な大きさで出す |
| `video.js` | 素材の照合と、全場面の描画。`window.seek`・`window.motionConfig`・`window.motionReady` を持つ |
| `storyboard.json` | 場面ごとの伝えること・入る／出る時刻・使うデータ・素材のハッシュ・確認の状態 |
| `assets/` | 制作側が固定した素材8件と `data-hashes.json`（この工程では変更していない） |

## 場面

| 時刻 | 主な文字 | 伝えること | 使う実データ |
| --- | --- | --- | --- |
| 0–4秒 | 自動化の設定を、／持ち運ぶ前に点検する | 持ち運べる自動化ファイルを、架空の設定と原典APIで点検した作例であること | O01 の書き出しファイル名と JSON の行、固定版 |
| 4–8秒 | 時刻がないと？ | O03 は cron で timezone はあるが schedule が無い | O03 の入力の各項目、O03→O04 の差の位置（説明図。Agent Canvas の画面ではない） |
| 8–12秒 | 足りない項目を、／理由から見つける | 原典の誤りは1件で、足りない項目を名指しする。ファイルは作られない | O03 の `AutomationFileValidationError` と issues の文そのまま、スマホの実画面 |
| 12–18秒 | 時刻を足して、／もう一度点検 | schedule `0 9 * * 6` だけを足した別の呼び出し O04 は形が通り、実ファイルを保存できる。AI の自動修復でも予定の登録でもない | O03/O04 の trigger の比較、O04 のファイル・ファイル名・パス・バイト数・SHA-256 |
| 18–22秒 | 形が通っても、／時刻は未検証 | O06 の `not-a-cron` も通る（空でない文字列かだけを見る）。O07 は先頭の参照先だけが入る | O06 の schedule と観察、O07 の参照先2件・書き出した repository/branch |
| 22–28秒 | 設定を選ぶ → 理由 → 保存 | 形が通った6件・止まった2件（8ファイル）。6はファイルの形の数で、動く自動化の数ではない | 集計、確認107件・独立した確認155件・別プロセスでの6ファイルのバイト一致、パソコンの実画面 |

各場面の入りと出の秒、読み取りの保持時間は `storyboard.json` にあります。最後の場面は約4.5秒止まります。ポスターは13.5秒（場面4の描き終わり）です。

## 素材と出典

`video.js` は最初に `assets/data-hashes.json` の SHA-256 を固定値と比べ、次に8件の SHA-256 とバイト数を確かめてから、記録の中身を照合します。合わなければ描かず、理由を出し、「素材をもう一度読み込む」で全部を取り直します。埋め込みの代替データはありません。

| ファイル | バイト数 | SHA-256 |
| --- | ---: | --- |
| `assets/data-hashes.json` | — | `03326022147ec1c0402c10c89a021c5e2f6a5c58f6a18cd6086f35c3fedac99a` |
| `assets/automation-runs.json` | 74,735 | `bc347cc3246fa36a9e4e7d5849e48ecf8119e67e2d6afcd166211e67f453c7b0` |
| `assets/independent-checks.json` | 18,287 | `0210a265e0eadf9aa8382fde0fe8b54e529d9c7cc518d9304e3624e1e24376d5` |
| `assets/reproduction-checks.json` | 1,418 | `c14352c2848f466e5f152fadbd2886020053071c4d7787990619c7177673bb65` |
| `assets/automation-settings.json` | 8,430 | `e982b4ca83fd92d9f012a44e98f35dc58b9dfc48a95eede6bb7daff57ce0be6b` |
| `assets/vendor-lock.json` | 12,441 | `34149d29d4d4cb0181f41f0b8ac998a5c8baa0c3e13e0af341338eae1dddea02` |
| `assets/screens.json` | 1,431 | `83651387a40da36b3333feb968fd38aaa860c9217b825c0825bce5cae91f04f5` |
| `assets/phone.jpg` | 49,727 | `17f2ac189a3b088aa79086b6d888c56d85e01b2a2bf0dff69c6a57ce7d015a4c` |
| `assets/desktop.jpg` | 95,074 | `7baf46f6ac483c9a47f9dbb597afd0d241197ac1dfbef7e7ce9c2fbd0da695d5` |

照合する内容：

- 固定版 OpenHands/OpenHands `e4775b4ba61a83ba80af5f7b0b826201b8e8ea05`・1.27.1・MIT。原典12ファイル（Git blob つき）と @openhands/extensions 0.30.0 の29ファイル（npm の中の位置つき）が、記録と `vendor-lock.json` で一致。依存の integrity、Node v24.18.0・npm の導入なし・通信なし、呼んだ原典の関数6つ、審査を通った封筒（version 1・kind `automation`・`.automation.json`）。
- 入力は架空（参照先はすべて `example.invalid`）で、記録の8件の入力が `automation-settings.json` と一致。O01〜O08 の順、形が通った O01・O02・O04・O06・O07・O08、止まった O03・O05、実行前の期待との照合、確認107件がすべて通過。
- O03 の誤りが `spec.trigger.schedule: required for a scheduled trigger` の1件だけ。O03 と O04 の入力の差が `spec.trigger.schedule`（`0 9 * * 6` を追加）の1か所だけ。O05 の誤りが6件。O06 の `not-a-cron` が通り、cron の文法は検査されていない。O07 のファイルは先頭の参照先だけで、2件目は入らない。O08 の文字がそのまま。形が通った件はすべて `enabled: false`。
- 形が通った6件は、記録の `file` から書き出しの bytes（整形 JSON と末尾の改行）を作り直し、`file_sha256` と一致すること。
- 独立した確認155件と、別プロセスでの再現9件がこの記録に対してすべて通過。
- 画面の2枚は JPEG の開始・終了の印、ヘッダーの大きさ、読み込んだ大きさが `screens.json`（スマホ O03 375×812・パソコン O07 1265×889）と一致。`rgb_sha256` は JPEG の読み込み方で変わりうるため、ブラウザーでは計算し直さず出典として記載するだけです。画像は縮小して全体を表示（contain）するだけで、加工しません。

原典：<https://github.com/OpenHands/OpenHands/tree/e4775b4ba61a83ba80af5f7b0b826201b8e8ea05>（入出力API `src/utils/automation-export.ts`、封筒 `src/manifests/automation-interface.ts`）。

## 編集画面で見る

作例のフォルダー（`render.py` のある場所）で次を実行し、<http://localhost:8000/video/> を開きます。`file://` では照合できません。

```text
python -m http.server 8000
```

- 最初は0秒で止まっています。自動再生はしません。
- 「再生」は押すと「一時停止」に変わります（`aria-pressed`）。時刻のスライダーは0〜28秒・0.1秒刻みです。
- 場面のボタンは、その場面の読みやすい時刻で止めます。「◯秒に戻す」は最後に選んだ時刻（スライダー・場面のボタン・`window.seek`）へ戻します。14秒を選んだ後なら14秒のままです。
- 照合に失敗すると映像を消して隠し、操作を止めます。「素材をもう一度読み込む」は全部を取り直し（同時に1回だけ）、通れば最後に選んだ時刻で止まった状態に戻ります。
- 素材8件の SHA-256（64文字すべて）とバイト数は「素材8件の SHA-256 照合」に常に表示します。

## 書き出し

書き出しは制作側が行います。作例のフォルダーで、`render.py` が `tools/motion-reel/render.mjs`（Motion Reel）を使います。Node.js 20 以上、Chrome、FFmpeg と ffprobe が要ります。初回だけ `tools/motion-reel/` で依存を入れます。作例の実行（`run.mjs`）にはこれらは要りません。

```text
cd tools/motion-reel
npm install --ignore-scripts
cd ../..
python render.py --out <このフォルダーの外の、空のフォルダー>
python render.py --out <別の空のフォルダー> --stills-only
```

- `render.py` は作例を一時フォルダーへ写し、写しの `index.html` をこの `video/index.html`（`<base href="video/">` つき）にしてから、`--step 2 --strip-at 8.1` で代表フレーム・連続フレーム・ポスター・確認用HTML、`--stills-only` でなければ MP4 を出します。出力先は空のフォルダーだけで、上書きしません。
- レンダラーは `window.__MOTION_RENDER__` と `window.renderConfig` を渡し、`window.motionReady` を待ってから `window.seek` で各時刻を描きます。同じ時刻を別の順序と新しいページで描いた PNG の一致を記録します。これは同じ環境での再現性で、別の OS やフォントで同じ画になる保証ではありません。
- 文字はこの環境のシステムフォント（游明朝・游ゴシック・Consolas など）で描きます。フォントが違う環境では字幅が変わります。

## 作った人・動いたもの

- この5ファイル（`index.html`・`video.css`・`video.js`・`storyboard.json`・`README.md`）は Claude Opus 5.5 が書きました。映像の文字・構成・照合の書き方がこの工程の成果です。
- 記録の値（書き出したファイル、原典の誤り、観察、件数）はモデルではなく、改変していない原典の関数が Node v24.18.0 で返したものです。架空の入力と期待は制作側が実行前に固定しました。実行・独立した確認・再現・閲覧ページの撮影は制作側が行いました。
- この映像の中でも編集画面の中でも、OpenHands・エージェント・モデルは動きません。予定の登録・Webhook・リポジトリの取得・Cloud も使っていません。

## 確認の状況

- 制作側がフレーム・コンタクトシート・MP4を書き出し、同時刻の別順序/新ページの一致、フレーム/MP4、360px、編集画面の操作を確認しました。[確認記録](../verification.json) と末尾に実際の範囲を記載しています。
- 実機の iPhone Safari・VoiceOver は確かめていません。
- 人による承認と公開は行っていません。

## 利用条件

- OpenHands（`../vendor/openhands/`）：OpenHands/OpenHands 固定コミット `e4775b4ba61a83ba80af5f7b0b826201b8e8ea05` の無改変ファイル。MIT License（`../vendor/openhands/LICENSE`・Copyright © 2025 OpenHands contributors）。
- @openhands/extensions 0.30.0（`../vendor/extensions/`）：無改変ファイル。MIT License（`../vendor/extensions/LICENSE`）。
- 作例のコード・文章・架空の入力・閲覧ページ・この映像ソース：MIT License（`../LICENSE`・Copyright (c) 2026 Studio Yebisu）。
- Motion Reel のレンダラー（`../tools/motion-reel/`）：MIT License（`../tools/motion-reel/LICENSE`・Copyright (c) 2026 StudioYebisu）。
- 映像には上流のロゴや画像を使っていません。

## 制作側による完成後の確認

28秒・1280×720・30fps・840フレームの無音MP4を実際に書き出しました。代表フレーム・5つの連続フレーム列・360pxの主要文字・終端・別順序/新ページの同時刻PNG一致・8素材の全ハッシュ・全デコード・MP4のネイティブ再生終了、編集画面の0秒停止・14秒シーク・再生/停止/14秒リセットと小画面の操作部を確認しました。これ以前のpending/未確認の制作記録は初稿時点の計画で、この段落とverification.jsonが完成後の記録です。実機iOS/Safari/VoiceOver・人による承認は未確認です。Pagesと実公開URLは対象を限定した公開後に別途確認します。
