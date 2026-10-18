# Design Taste：方針の本から、使える画面へ

AIが読むMarkdownの指針です。共通コア、表現を1つ、操作・文字・文言の補助を、依頼・利用者・催し6件とともに同じAIへ渡します。方針一行の計画を先に書き、次の執筆で実装へ。制作担当が別工程で実行確認し、使える一覧を受け取ります。5冊は自動AIやAPIではありません。3群と6部品は説明用整理です。

元の計画・実装・旧26秒映像のOpus3受領、Node21条件、旧ブラウザーを保全し再実行していません。新図の8原本のOpus5.5受領と、制作側の事実整理・元結果の包装・補正・描画・QA・公開は別です。原典にある薄い灰の文字や10–11pxラベル等は、元の計画で用途に合わせ調整しました。実行した前後比較や自動改善ではありません。

新図は同じevents.mjsのfilterEventsをブラウザーで呼び、3保存例のIDと順序を全一致照合します。対象と検索はAND、検索は名前・説明・会場の文字列部分一致で語ごとのANDではありません。短編1件、読書4件。実JSON176/142/131Bは元results.presetsの同じオブジェクトをUTF8/LFで包んだものです。旧一覧はdesk.htmlで任意の入力と参加方法を試せます。催しは架空で予約・送信・保存・AI呼出しはありません。

## 開く・描く

HTTPでindex.htmlを開きます。図と映像は同じ23素材のサイズとSHAを照合し、破損時は止まって再読込を待ちます。32秒・30fps、縦720×1280と横1280×720の別配置、完全無音です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../taste-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../taste-review-wide --width 1280 --height 720 --strip-at 10.2
```

Python、Node20以上、Chrome、FFmpegが必要です。依存は未導入の場合だけ用意し、空の出力先を使います。--stills-onlyは代表と連続フレームだけ。再現入口は一時コピーへ動画HTMLを置き、作例全体を配信します。元の推論やNode検査は動画再現には不要です。

## 原典と確認の範囲

madebymustafa/design-taste@c4a6bff0871eb4b15371b0e7d2751628b0ed4608、MIT、Copyright(c)2026Mustafa。固定24冊のうち5冊とREADME/LICENSEの7件は公式Gitblobと生バイトが一致します。利用条件はvendor/design-taste/LICENSEに保持。元41公開ファイルと旧動画/sourceZIPを履歴へ保全し、旧一覧と旧動画HTMLをdesk.html/video/legacy.htmlへ残します。旧READMEや検査は元制作の説明で、新しい図と映像の確認はvisual-verification.jsonです。

原の文字200%測定とブラウザー全体のズームを区別します。新図の実機iOS/Safari/VoiceOver、200%ズーム、人の審美的承認、意味/全入力/使いやすさの保証、クリップボード内容の再取得は未確認です。新図の動きや配色切替を元の一覧に追加したものではありません。音声ガイド・原稿・音源は作っていません。
