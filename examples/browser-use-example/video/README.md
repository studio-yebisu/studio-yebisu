# 解説映像の編集元 — まちの作業席（Browser Use 作例）

架空の検索画面「まちの作業席」を、固定版 Browser Use の操作API（Actor API）で事前に決めた6状態の手順どおりに操作した**実結果**を、28秒・無音の映像に編集する元ページです。`index.html` を開くと、照合したファイルから描いた映像を、再生位置を選んで確かめられます。

この映像は保存した記録と実画面の静止画を編集したもので、操作の連続録画ではありません。ページでも映像でも、Browser Use・Python・AI は動きません。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 編集元のページ。キャンバス・再生ボタン・再生位置・照合したファイルの一覧・関連ページへのリンク |
| `video.js` | 映像の本体。素材の照合、時刻 t の画面を描く `window.seek`、編集用のプレビュー |
| `video.css` | ページの見た目（スマホ優先）と、書き出し時にキャンバスだけを置く指定 |
| `storyboard.json` | 制作ブリーフと場面ごとの絵コンテ（入る状態→出る状態・素材・切り抜き・範囲・動き・読む時間） |
| `README.md` | この説明 |
| `assets/` | 実画面7枚・その記録・照合表（制作側で用意。この編集元では変更しない） |

## 使う素材（14ファイル、すべて照合してから使う）

`video.js` は、照合表 `assets/data-hashes.json` 自体の SHA-256 を、制作記録（`runtime/frozen-reviewed-source.json` の `files_sha256`）の値 `48950d5de1fee5032f1c465efa96199a36f0de2a0425389fe636d6a24b7dc336` と比べてから、照合表に書かれた14ファイルの生のバイト列を SHA-256 で確かめます。画像は照合済みのバイト列から作ります。一つでも合わなければ理由を出して止まり、代わりの映像は描きません。

| ファイル | 映像での使い方 |
| --- | --- |
| `input/workspaces.json` | 架空の作業席12件。件数・作例名・結果の全項目の照合 |
| `input/scenarios.json` | 6状態の手順。操作の数と、条件を手順から求め直す照合 |
| `outputs/browser-run.json` | 実行記録。各場面の件数・条件・操作の行・W04の説明文・S04の名前と料金・原典の版 |
| `outputs/method.md` | 原典のコミット・操作11回・件数の並びが書かれていることの照合 |
| `outputs/browser-selection.json` | 実操作で保存したJSON（3,012 bytes）。最後の場面の値 |
| `outputs/browser-record.json` | 実操作の記録。保存JSONの SHA-256、初期表示の S04、検索画面の S04 の照合 |
| `video/assets/screen-manifest.json` | 実画面7枚の大きさ・SHA-256・元のスクリーンショットとの対応 |
| `video/assets/api-S02.png`〜`api-S05.png` | Browser Use の `Page.screenshot` で保存した 1280×900 の実画面（RGB の PNG へ符号化し直しただけ） |
| `video/assets/phone-fixture-top.png` | スマホ幅（375×812）の検索画面、S04の状態 |
| `video/assets/phone-fixture-full.png` | スマホ幅の検索画面の全体（375×1157）。照合のみで、現在の構成では描いていない |
| `video/assets/phone-record-S04.png` | スマホ幅（375×812）の記録ページ、S04 の結果と保存ボタン |

件数・条件・名前・料金・ID・バイト数は、すべて読み込んだファイルから取り出します。コードに書いた期待値（件数 12・12・4・2・0・12、操作の数、S04 の W01・W11、3,012 bytes など）は照合にだけ使い、合わなければ描きません。

## 実画面の切り抜き

実画面は縦横同じ倍率で置き、画素を伸ばさず、消したり描き直したりせず、上に文字を重ねません。見出し・件数・引用・強調は、画像の外に編集で置いたものです。

| 名前 | 画像 | 切り抜き（x, y, 幅, 高さ） | 置き場所・倍率 | 内容 |
| --- | --- | --- | --- | --- |
| phoneTop | phone-fixture-top.png | 0, 62, 360, 432 | x840 y214・1 | キーワード〜ボタン（S04の状態） |
| s02W04 | api-S02.png | 37, 612, 401, 176 | x600 y422・0.9 | S02 の W04 カード（電源：なし） |
| s03Cards | api-S03.png | 44, 442, 1192, 347 | x330 y316・0.755 | S03 の結果4件 |
| s04Cards | api-S04.png | 44, 442, 797, 176 | x462 y476・0.966 | S04 の結果2件 |
| s05Empty | api-S05.png | 44, 448, 570, 76 | x48 y524・0.98 | S05 の該当なしの案内 |
| recResults | phone-record-S04.png | 0, 144, 360, 240 | x48 y222・1.15 | 記録ページの結果2件 |
| recSave | phone-record-S04.png | 0, 760, 220, 52 | x48 y512・1.15 | 「この状態をJSONで保存」 |

`video.js` は、切り抜きが画像の内側にあり、置き場所が本文の範囲（1280×720 の論理座標で y164〜652）に収まることを確かめます。

## 時間の契約

- `window.motionConfig = {duration: 28, fps: 30, width: 1280, height: 720, posterTime: 13.5, audioEvents: []}`。840フレーム、**無音**。
- `window.renderConfig` の幅・高さ・FPS を初期化時に反映します。1280×720 の論理座標を等倍率で収め、余りは紙の色で埋めます（1280×720 以外は未確認）。
- `window.motionReady` は、フォントの準備と14ファイルの照合・画像の復号・記録の照合が済むと解決し、失敗すると理由つきで拒否されます。
- `window.seek(seconds)` は、時刻だけから完成した1フレームを描きます。毎回キャンバスの状態（変換・透明度・クリップ）を捨ててから描き、壁時計・乱数・前のフレームには依存しません。動きは閉形式の減速曲線です。
- ポスター（13.5秒）は、S04 の2件・条件・見出しがすべて着地して止まった状態です。
- 最後の3秒（25〜28秒）は、案内「検索画面を試す → 記録を保存」と「操作APIの作例・LLM判断なし」を止めて表示します。
- 編集用のプレビューは停止から始まり、「再生」を押したときだけ requestAnimationFrame で進みます。書き出し時（`window.__MOTION_RENDER__`）は動かしません。CSS のアニメーションは使いません。
- 再生位置のスライダーは0〜28秒・0.1秒刻み。Home・End は先頭・末尾、PageUp・PageDown は2秒ずつ（Home から PageUp 7回で14秒）。

場面の時刻・伝えること・素材は `storyboard.json` にあります。

## 開いて確かめる

照合に WebCrypto と fetch を使うため、`file://` ではなくローカルサーバーで開きます。作例フォルダ（`video/` の1つ上）で次を実行し、`http://127.0.0.1:8865/video/` を開きます。

```powershell
python -m http.server 8865 --bind 127.0.0.1 --directory .
```

## 書き出しの再現

必要なもの：Node.js 20以上、Google Chrome、FFmpeg と ffprobe、Python 3。作例フォルダで次を実行します。依存はレンダラーの隣にだけ入れ、スクリプトは実行しません。

```powershell
npm ci --ignore-scripts --prefix tools/motion-reel
python render.py --out <作例フォルダの外の空のフォルダ>
```

`render.py` は作例フォルダを一時フォルダへ写し、`video/index.html` に `<base href="video/">` を入れた写しを入口にして `tools/motion-reel/render.mjs` を呼びます。出力先は作例フォルダの外の空のフォルダだけを受け付け、既存の書き出しは上書きしません。`--stills-only` で静止画とコンタクトシートだけ、`--strip-at` で連続フレームの位置（既定 8.1秒）を変えられます。

レンダラーは同じ時刻を別の順序と新しいページで描いてPNGの一致を確かめますが、これは同じ環境内の再現性です。書体は環境のものを使うため（Windows では Yu Gothic UI・Yu Mincho、macOS では Hiragino）、OS が違えば文字の幅や見た目が変わります。

## 掲載時の確認

1280×720・30fps・840フレーム・28秒の無音MP4を書き出しました。14枚の代表フレーム、5箇所の連続フレーム、13.5秒のポスター、360px幅での主要文字、最終フレームを制作担当のエージェントが確認しています。別順と新しいページの16.8秒PNGが完全一致し、全デコードと実ブラウザーでの28秒終端も確認しました。初期の新ページ描画では大きな数字の輪郭7画素に1段階の差が出たため、Canvas2DにwillReadFrequentlyを指定し、元の厳密な一致検査を保ったまま修正しています。

[MP4を開く](../../../media/browser-use-example.mp4)、[確認の範囲](../verification.json)。この確認は人による見た目の承認ではありません。1280×720以外の書き出し、物理iOS/Safari/VoiceOverは未確認です。実データ14ファイルと動画の描画内容は固定しています。

## ライセンス

映像の構成・コード・文章は MIT License（Copyright (c) 2026 Studio Yebisu、作例フォルダの `LICENSE`）。Browser Use は MIT License（Copyright (c) 2024 Gregor Zunic、`../vendor/browser-use/LICENSE`）。実画面は、この作例の架空の検索画面と記録ページを撮影したものです。
