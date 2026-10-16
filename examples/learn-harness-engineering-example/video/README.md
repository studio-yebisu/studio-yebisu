# 解説映像の編集元 — 架空の書店メモ（Learn Harness Engineering 作例）

固定版 Harness Creator が作った5ファイルで、架空の書店メモを探す小さな Node.js CLI を1機能だけ進め、実際の検証のあとに新しいセッションへ引き継いだ記録を、28秒・無音の映像に編集する元ページです。`index.html` を開くと、照合したファイルから描いた映像を、再生位置を選んで確かめられます。

主なメッセージは「検証してから、続きを渡す。」です。

この映像は、保存した実出力・状態ファイル・実画面の静止画を編集したものです。操作や実行の連続録画ではありません。講座の Project 01・02（ハーネスなしとの比較実験）でもありません。ページでも映像でも、Node・CLI・AI は動きません。

## 制作の区別

| 何を | 誰が | 根拠 |
| --- | --- | --- |
| 5ファイルの生成 | 改変なしの上流 `create-harness.mjs`（終了コード0） | `../outputs/harness-created.json` |
| CLI・検証スクリプト・状態ファイルの執筆 | 1回目の Claude Opus 5.5 実装セッション | `../outputs/sessions/implementation/` |
| `./init.sh`（Git Bash）・`build`・8問の `search` の実行 | 制作担当 | `../project/outputs/verification.json`・`../outputs/exercise-run.json` |
| 状態ファイル3つだけの更新（feat-001 を done） | 2回目の、新しい Claude Opus 5.5 再開セッション | `../outputs/sessions/resume/`・`../project/session-handoff.md` |
| この映像の編集元 | 3回目の Claude Opus 5.5 による執筆 | このフォルダ |

モデルの会話履歴は公開していません。執筆したセッションと、CLI を実際に実行した制作担当は別です。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 編集元のページ。キャンバス・再生ボタン・再生位置・照合したファイルの一覧・関連ページへのリンク |
| `video.js` | 映像の本体。素材の照合、時刻 t の画面を描く `window.seek`、編集用のプレビュー |
| `video.css` | ページの見た目（スマホ優先）と、書き出し時にキャンバスだけを置く指定 |
| `storyboard.json` | 制作ブリーフと場面ごとの絵コンテ（入る状態→出る状態・素材・切り抜き・範囲・動き・読む時間） |
| `README.md` | この説明 |
| `assets/` | 実画面2枚・その記録・照合表（制作側で用意したもの。この編集元では変更しない） |

## 使う素材（12ファイル。すべて照合してから使う）

`video.js` は、まず照合表 `assets/data-hashes.json` 自体の SHA-256 を、制作側の記録（公開配布には含まれない `runtime/frozen-reviewed-source.json` の `files_sha256`）の値 `3796bdd73b59b7fca32c39355f3b8af4104e3443c5abf2cd7a2a17f1e5076134` と比べます。次に、照合表に書かれた12ファイルの生のバイト列を SHA-256 で確かめます。画像は照合済みのバイト列から作ります。一つでも欠けたり合わなかったりすれば、理由を出して `window.motionReady` を拒否します。代わりの映像は描きません。

| ファイル | 映像での使い方 |
| --- | --- |
| `outputs/exercise-run.json` | 原典の固定コミット、生成した5ファイルの名前、検証のコマンドと終了コード、2つのセッションの状態、8問の保存出力（Q03・Q06 を映像に出す） |
| `project/outputs/index.json` | CLI の `build` が作った索引。メモ8件のIDと題名、結果の全項目の照合 |
| `project/outputs/verification.json` | `./init.sh` の検証の記録。8問の結果（8/8）と、意図的な不正入力11件 |
| `outputs/harness-created.json` | `create-harness.mjs` の実行記録。5ファイルの名前・終了コード0 |
| `outputs/harness-assessment.json` | 形の照合だけ。構造の点検の点数は映像に出さない |
| `outputs/sessions/implementation/feature_list.json` | 1回目のセッション後の状態：feat-001 `in-progress`（未検証）、feat-002 `not-started` |
| `outputs/sessions/resume/feature_list.json` | 再開セッション後の状態：feat-001 `done`（根拠つき）、feat-002 `not-started` |
| `project/session-handoff.md` | 引き継ぎ。状態と、feat-002 を始める前に条件の承認が要ること |
| `project/input/queries.json` | 実装前に固定した8問と期待ID |
| `video/assets/screen-manifest.json` | 実画面2枚の大きさと SHA-256 |
| `video/assets/workbench-phone.png` | スマホ幅（375×812）の閲覧ページ。Q03 を選んだ状態 |
| `video/assets/workbench-desktop.png` | 広い幅（1265×889）の閲覧ページ。Q03 を選んだ状態 |

件数・ID・題名・本文・状態・コマンド・終了コードは、すべて読み込んだファイルから取り出します。コードに書いた期待値は照合にだけ使い、合わなければ描きません。期待値は、固定コミット、5ファイルの名前、N01〜N08、Q01〜Q08 の期待ID、不正入力11件、状態の並び（in-progress・not-started → done・not-started）です。8問の結果は、CLI（`project/src/notes.mjs` の `search`）と同じ規則で索引から求め直した結果とも照合します。規則は NFKC・小文字・空白区切りの全語AND（id・title・tags・body）とタグの完全一致です。

## 場面（28秒・840フレーム・無音）

| 時刻 | 見出し | 伝えること | 素材 |
| --- | --- | --- | --- |
| 0〜4秒 | 次の作業、どこから？ | 副題「始め方と、続き方をファイルに。」改変なしの `create-harness.mjs` が作った5ファイルが1つの束にそろう。終了コード0 | 生成記録 |
| 4〜8秒 | 8件のメモを、検索課題に。 | CLI で作った索引の架空の書店メモ N01〜N08。実在のお店ではない。問い8つは実装前に固定 | 索引・問い |
| 8〜12秒 | 読書会 ＋ 土曜 → 1件 | 全角空白を含む問い「　読書会　土曜　」→ 区切った語「読書会」「土曜」→ N02「土曜の読書会」だけ。CLI の保存出力で、AI の回答ではない | Q03 の保存出力・スマホの実画面 |
| 12〜18秒 | 検証してから、続きを渡す。 | `./init.sh`（終了コード0）で8問すべて期待どおり（8/8）。feat-001：in-progress（作業中・未検証）→ `./init.sh` → done（完了・根拠つき） | 検証の記録・2つの状態・広い幅の実画面 |
| 18〜22秒 | 0件も、正しい結果。 | Q06「存在しない星の棚」は入力に一致するメモなし（期待も0件）。わざと壊した入力11件は CLI が拒否（終了コード1・成功の出力なし）。この確認は別に記録した | Q06 の保存出力・不正入力の記録・実画面 |
| 22〜28秒 | 続きを、ファイルで渡す。 | 新しい Opus 5.5 セッションが記録を読み、状態ファイル3つだけを更新。コードと入力は変更なし。feat-001 done、feat-002 not-started。次のfeat-002は未着手。ここまでを引き継ぐ。25秒以降は案内「メモを試す → 実行記録を見る」で静止 | 再開後の状態・引き継ぎ |

足元にはいつも「架空メモの実作例・実出力を編集・無音」と「独自の小課題／比較実験ではありません」を表示します。場面の見出しは重ねず、0.3秒で消えてから次が0.3秒で現れます。

ポスター（13.5秒）は、主なメッセージ、8/8、in-progress → `./init.sh` → done の3段がすべて着地して止まった状態です（全要素が13.4秒までに着地）。

「コードと入力は変更なし」は、制作担当の確認（公開配布には含まれない制作側の記録 `runtime/data-checks.json` の `input_hashes_unchanged`・`resume_only_state_files_changed`）に基づく表示です。照合表の12ファイルには含まれないため、映像のコードでは照合していません。

## 実画面の切り抜き

実画面は縦横同じ倍率で置きます。画素を伸ばさず、消したり描き直したりせず、上に文字を重ねません。見出し・数・記録カード・強調は、画像の外に編集で置いたものです。記録カードは保存した JSON の値を読みやすく描き直したもので、アプリ画面や端末の様子ではありません。

| 名前 | 画像 | 切り抜き（x, y, 幅, 高さ） | 置き場所・倍率 | 内容 |
| --- | --- | --- | --- | --- |
| phoneResult | workbench-phone.png | 6, 572, 352, 232 | x852 y226・1.07 | スマホ幅のブラウザー検索「1件／全8件」と N02 のカード |
| queryGrid | workbench-desktop.png | 754, 288, 438, 282 | x880 y180・0.8 | 保存したCLIの検索記録 Q01〜Q08 の8つ |
| q06Card | workbench-desktop.png | 972, 428, 220, 68 | x672 y228・1.5 | Q06「該当なしを確かめる」0件 |

`video.js` は、切り抜きが画像の内側にあることと、置き場所が本文の範囲（1280×720 の論理座標で y164〜652）に収まることを確かめます。切り抜きの座標は実画面を見て決めた値です。端の数画素の収まりは、書き出したフレームで確かめる必要があります。

## 時間の契約

- `window.motionConfig = {duration: 28, fps: 30, width: 1280, height: 720, posterTime: 13.5, audioEvents: []}`。840フレーム、**無音**です。
- `window.renderConfig` の幅・高さ・FPS を初期化時に反映します。1280×720 の論理座標を等倍率で収め、余りは紙の色で埋めます（1280×720 以外は未確認）。
- Canvas は `getContext('2d', {willReadFrequently: true})` で作ります。
- `window.motionReady` は、フォントの準備、12ファイルの照合、画像の復号、記録の照合が済むと解決します。失敗すると理由つきで拒否されます。
- `window.seek(seconds)` は、時刻だけから完成した1フレームを描きます。毎回キャンバスの状態（変換・透明度・クリップ）を捨ててから描き、壁時計・乱数・前のフレームには依存しません。動きは閉形式の減速曲線です。日本語は測った幅で折り返し、行頭・行末の禁則を守ります。
- 編集用のプレビューは停止から始まります（動きを減らす設定でも同じ）。「再生」を押したときだけ requestAnimationFrame で進みます。書き出し時（`window.__MOTION_RENDER__`）は動かしません。CSS のアニメーションは使いません。
- 再生ボタンの `aria-pressed` は再生中かどうかを表します。再生位置のスライダーは0〜28秒・0.1秒刻みです。Home・End は先頭・末尾、PageUp・PageDown は2秒ずつ動きます（Home から PageUp 7回で14秒）。操作部品は44px以上、文字は16pxです。

## 開いて確かめる

照合に WebCrypto と fetch を使うため、`file://` ではなくローカルサーバーで開きます。作例フォルダ（`video/` の1つ上）で次を実行し、`http://127.0.0.1:8865/video/` を開きます。

```powershell
python -m http.server 8865 --bind 127.0.0.1 --directory .
```

## 書き出しの再現

必要なもの：Node.js 20以上、インストール済みの Google Chrome、FFmpeg と ffprobe、Python 3。外部のフォント・CDN・画像は取得しません。作例フォルダで次を実行します。依存はレンダラーの隣にだけ入れ、パッケージのスクリプトは実行しません。

```powershell
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render.py --out <作例フォルダの外の空のフォルダ>
```

`render.py` は作例フォルダを一時フォルダへ写し、`video/index.html` に `<base href="video/">` を入れた写しを入口にして `tools/motion-reel/render.mjs` を呼びます。`video.js` は自分の位置（`import.meta.url`）の1つ上を基準に素材を取得するため、写しでも同じファイルを指します。出力先は作例フォルダの外の空のフォルダだけを受け付け、既存の書き出しは上書きしません。`--stills-only` で静止画とコンタクトシートだけを作れます。`--strip-at` では連続フレームの位置を変えられます（既定 8.1秒）。

レンダラーは同じ時刻を別の順序と新しいページで描き、PNG の一致を確かめます。これは同じ環境内での再現性を示すものです。書体は環境のものを使うため（Windows では Yu Gothic UI・Yu Mincho、macOS では Hiragino）、OS が違えば文字の幅や見た目が変わります。

## 制作担当による確認

28秒・720p・30fps・840フレーム・無音で書き出しました。12ファイルの照合、代表/連続フレームと360px表示、同時刻の別順/新ページの厳密なPNG一致、全デコード、実MP4の先頭から終端までの再生を確認しています。初回の終盤で未着手ラベルが機能名に触れたため、小さくして再描画し、最終フレームで解消を確認しました。元のOpus納品と初回の書き出しは制作側で保持しています。終盤の案内は「次のfeat-002は未着手。ここまでを引き継ぐ。」です。

物理iOS/Safari/VoiceOverと人による見た目の承認は未確認です。最終的な範囲は../verification.jsonを参照してください。公開先の実動作は制作側で別に確認します。

## ライセンス

映像の構成・コード・文章は MIT License（Copyright (c) 2026 Studio Yebisu、作例フォルダの `LICENSE`）。Learn Harness Engineering は MIT License（Copyright (c) 2025 WalkingLab、`../vendor/learn-harness-engineering/LICENSE`）です。実画面は、この作例の閲覧ページ（架空の書店メモ）を撮影したものです。
