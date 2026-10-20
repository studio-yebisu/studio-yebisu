# LiveTalking 作例：解説動画の編集用ソース

32秒・30fps・無音の解説動画のソースです。縦 720×1280 と横 1280×720 を、同じ時刻表から別々の配置で描きます。ナレーション・読み上げ・効果音・音声トラックはありません（`audioEvents: []`）。

作例ページと同じ `../app.js` を読み込み、同じ照合（`verifyAll`・`loadMedia`）と同じ構造図の描画（`drawMap`）を使います。照合が合わなければ描かずに止め、`window.motionReady` と `window.seek` は失敗を返します。ファイルを元に戻して「もう一度確かめる」を押すと、元のファイルを読み直して同じ照合からやり直します。実際の MP4 と WAV はバイトを照合するだけで、このページでは再生しません。

## ファイル

- `index.html`：プレビューと操作（再生・一時停止・最初から再生・最初へ・最後へ、0.1秒刻みのスライダー、時刻の入力と Enter、縦横の切り替え、7場面、照合した素材の一覧と件数）。
- `main.js`：Motion Reel の時刻の契約と操作。
- `draw.js`：時刻 t から1コマを描く。場面の状態は場面の中の進みだけで決まります。
- `storyboard.json`：7場面の「伝えること・入る状態・出る状態・動き・使うデータ」と時刻。

## 時刻の契約（Motion Reel）

- `window.motionConfig = { duration: 32, fps: 30, width: 720, height: 1280, posterTime: 31, audioEvents: [] }`。`window.renderConfig` に幅・高さ・fps があれば初期化時に使い、幅が高さより大きければ横の配置で描きます。
- `window.motionReady`：フォントの準備、63ファイルの照合、画像のデコードが終わると解決します。失敗すれば失敗で終わります。
- `await window.seek(秒)`：その時刻の完成した画を描きます。乱数・タイマー・前のコマの積算は使わないので、呼ぶ順番に関係なく同じ画になります。
- `window.__MOTION_RENDER__` が真なら自動再生せず、操作の画面を隠してキャンバスだけを全面に出します。
- 29.5秒以降は静止します（30秒と31秒は同じ画）。

## 7場面

| 秒 | 場面 | 内容 |
|---|---|---|
| 0–4.5 | 何か | 0秒から全体の図が読める。README → 作者AI ×1 → 制作担当 → LiveTalking エンジン。 |
| 4.5–9 | 入力 | 同じ肖像1枚（手動の枠）と既存の英語WAV（実測の波形）が、顔と声の箱へ。 |
| 9–13.5 | 顔の準備 | 下半分を黒くした顔と全体の顔が、1つの共有の潜在へ合流（以後ずっと強調）。 |
| 13.5–18 | 声の分岐 | 20ms片 → Whisper 符号器の特徴。生の音の印3つが別の道をはっきり進み、組の箱へ。 |
| 18–22.5 | 合流 | 潜在と特徴が U-Net で1回合流し、顔の部分の印が組の箱へ。 |
| 22.5–27 | 組と貼り戻し | 顔の部分＋生の音2片が1組に。元画像が別の道で貼り戻しへ。待機の #0 と貼り戻しの #31 が出ていく。 |
| 27–32 | 実ファイル | 代表5枚・コマの帯・MP4 から保存へ。29.5秒から静止。 |

使う画像は、照合した肖像・顔256・下半分を黒くした顔（保存名は `face256-upper-half-masked.png` のままですが、画素は下半分が黒）・マスク320・保存済みの「戸締まりの声」の代表5枚だけです。待機のコマは元の画像と透かしで、ニューラルの出力ではありません。波形・回数・コマの帯は `concept/facts.json` の実測値です。片・格子・タイル・動く印は説明のための形で、ネットワークの内部の値でも、実際の処理時間でもありません。

## プレビュー

リポジトリのルートで `python -m http.server 8000` を実行し、<http://localhost:8000/examples/livetalking-example/video/index.html> を開きます（`?orient=wide` で横から始まります）。照合に `fetch` と SHA-256 を使うので、`file://` では開けません。

## 書き出し（制作担当の後の工程）

書き出しは、作者がこのソースを書いた後に、制作担当が行います。この README を書いた時点では、描画・コンタクトシート・MP4 の書き出し・再生の確認はどれもまだです。

`render_visual.py` と `tools/motion-reel/` の MIT の5ファイルは制作担当が用意したものです。依存（Playwright など）と Chrome は同梱していないので、使う人が `tools/motion-reel` で npm の依存を入れます。出力先は毎回、新しい空のフォルダーにします（既存の出力は上書きしません）。

```text
npm ci --prefix examples/livetalking-example/tools/motion-reel
python examples/livetalking-example/render_visual.py --out <新しい空のフォルダー>/portrait --width 720 --height 1280 --strip-at 15.2
python examples/livetalking-example/render_visual.py --out <新しい空のフォルダー>/wide --width 1280 --height 720 --strip-at 15.2
```

音の指定（`--synth`・`--audio`）は使いません。`--strip-at 15.2` は、生の音が別の道を進むところの連続コマです。

この解説動画（32秒・無音）と、原典の経路が返した実際の MP4（`outputs/default/default.mp4`・`outputs/second/second.mp4`、どちらも AAC の音つき）は別のものです。

## ライセンス

このソースは Studio Yebisu の制作で MIT です。作者AI（Claude Opus 5.5）が書きました。描く画像の出所とライセンスは `../README.md` と `../THIRD_PARTY_NOTICES.md` を参照してください。


## 制作担当による後工程の追記

作者の執筆時点の記述と、その後の実検証は別です。制作担当が320/375pxの2例×3段階12状態、6部品8引用、16表示条件、3破損停止/復旧、実MP4と入力/出力WAVの6自然終端、10保存要求と返却10ファイル（9種類）の全バイト一致、編集63素材/7場面/任意7.2秒/向き保持/ネイティブrange0.1秒/通常32秒、代表/連続/contact、縦横32秒960f無音MP4の全デコードと自然終端、出荷ソース62PNG一致と30/31秒静止を新しく確認しました。人の音声聴取・同期精度・審美的承認、実機iOS/Safari/VoiceOver、200%拡大、全入力/品質/性能は未確認です。 詳細は visual-verification.json（映像側からは ../visual-verification.json）です。新11原本とexactモデル受領は非公開に保全し、後工程の補正・描画・検査とは区別しました。実機能のMP4/WAVは音声を維持し、紹介映像と編集ソースは無音です。

編集のエラー表示では、並列読込の進捗が失敗理由を上書きする場合を制作担当が補正し、3種の停止と復旧を新しく検証しました。IABで1回、再読込が照合開始前に止まったため、そのSHA破損検査は新しいタブで確認しました。これは全ブラウザーの保証ではありません。

source.zip は examples/livetalking-example と media の3ファイル、MIT LICENSE を含むリポジトリのルート配置です。空のフォルダーに展開し、そのルートで python -m http.server 8000 を実行して、http://localhost:8000/examples/livetalking-example/index.html または video/index.html を開きます。共通記事サイトは含みません。重み・依存・全checkout・私的ログは含みません。

描画は、別に用意した npm 依存と Chrome/FFmpeg で、npm ci --prefix examples/livetalking-example/tools/motion-reel の後に、展開ルートで python examples/livetalking-example/render_visual.py --out ../fresh-portrait --width 720 --height 1280 --strip-at 16.0 を実行します。横は別の出力先と --width 1280 --height 720、PNGだけは --stills-only を使います。今回の検査は、この公開するルート用wrapperに、同じbytesの固定5rendererfilesと既存の依存を明示指定し、縦横62PNGを動画正本のPNGと照合しました。別OSやフォントの一致を保証しません。元のモデル実行とは別の、紹介図の再描画です。
