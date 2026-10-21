# Motion2Code：動画の動きを日本語のコードアニメーションへ

作者配布のThink Big元動画を観察し、SVG＋GSAPへ独自に再構成した日本語作例です。比較は左が作者の元動画、右が今回の日本語版です。完成ギャラリーのアニメーション実装はコピーしていません。

## 保存した実出力

- assets/source.mp4：作者配布の元動画、854×480、24fps、10.125秒、266,662B。
- assets/japanese.html：日本語の自己完結SVG＋GSAP、10秒ループ、86,436B。
- assets/japanese.mp4：1920×1080、24fps、10秒、835,061B、無音。
- assets/comparison-ja.mp4：1940×636、30fps、10秒、5,367,967B、無音。

KB=1,000B、MB=1,000,000Bです。HTMLとMP4は異なる形式で、同等品質での圧縮率比較ではありません。サイトの記事用20秒動画は、同じ10秒比較を2周する版です。

## 何を試したか

原典のSKILLと解析・実行検査・フレーム描画スクリプトを使用。日本語表示、逆順シーク、ループ、1080p動画、4K静止画を確認しました。新規ページの文字AAには最大1/255の差があり、完全な画素一致は主張しません。元動画の字形の揺れ・重なり・加速は近似です。任意動画の変換精度、32K動画、商用品質は未検証。

今回のSVG/GSAPと比較動画はCodexによる制作。掲載用のUI・日本語解説・依頼文は別のClaude Opus 5.5実行です。H3やfalの新規生成はしていません。公開デモは保存済み出力を閲覧するだけで、外部モデルを呼びません。

## 手元で再生・書き出す

原典の固定版のSKILLに従い、Python、FFmpeg、Chrome/Chromium、Playwrightを用意します。既存HTMLの描画例：

```text
python vendor/motion2code/scripts/check_anim.py assets/japanese.html --runtime
python vendor/motion2code/scripts/render_anim.py assets/japanese.html -o rebuilt-japanese.mp4 --size 1920x1080 --fps 24
python -m http.server 8000 --bind 127.0.0.1
```

最後のコマンドで配信し、index.htmlを開くと比較と日本語HTMLの表示を切り替えられます。日本語HTML単体は直接開くこともできます。新しい日本語へ変更する場合は、フォントサブセットと字形情報の再生成が必要です。掲載ページの依頼文をAIへ渡して原典の作業を進めます。

## 原典・条件

https://github.com/lovisdotio/motion2code/tree/0f003288997604487df04c1b7a0586900d3e36bb

vendor/motion2code は同コミットのスキル本文・参照資料・補助スクリプト・テンプレートとMIT LICENSEを保持しています。本文を変更していません。日本語フォントはNoto Sans JP（OFL）、GSAPは埋め込みヘッダーと公式利用条件に従います。元動画の配布条件は原典リポジトリを参照してください。スキル一式は motion2code-skill.zip でも取得できます。
