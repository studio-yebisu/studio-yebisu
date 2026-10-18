# Humanizer：指示書と原文を、同じAIへ

HumanizerはAIに文章の推敲手順を渡すMarkdownスキルです。SKILL.mdの6系統26型と4手順、原文・読み手・残す条件を同じAIへ渡し、印→初稿→点検→最終稿を受け取ります。図の6部品と入力の3欄は作例の説明用の整理です。

元のOpus5.5が固定版を読んで推敲した架空Mado Notesの3件（英語2・日本語1）を、そのまま使います。13の印、11の変更、17条件の引用を保存しています。サポート返信だけ、初稿に残ったA workspace ownerの1文をAs a workspace owner, youの形へ直しました。§26への割り当ては元の制作AIの解釈で、原典の明示例ではありません。ほかの2件は初稿が最終稿です。既知と明記された背景2か所だけを省き、cannot reopen、Large workspaces may take a few minutes、日付・対象・除外を保持しています。

実メモoutputs/revisions.mdは13919B、結果JSONは21807Bです。17条件は文字列の引用対応で、意味の同一性の保証や品質点数ではありません。点検は読み返しだけで、音読や人による校閲をしていません。日本語全般の効果も未確認です。今回は元の推敲を再実行していません。全文比較はdesk.html/desk.cssと元app.mjsに保持し、旧ビューアの動画欄だけ現在32秒へのリンクへ直しています。

## 開く・再現する

HTTPで配信しindex.htmlを開きます。図とvideo/index.htmlは同じ11素材の大きさ・SHA-256・内容を照合します。ブラウザーではAIを動かしません。動画は32秒・30fps・縦720×1280と横1280×720の別配置で、完全無音です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../humanizer-review-portrait --width 720 --height 1280 --strip-at 20.8
python render-visual.py --out ../humanizer-review-wide --width 1280 --height 720 --strip-at 20.8
```

Python、Node20以上、Chrome、FFmpegとMotion Reelの依存が必要です。依存は未導入の場合だけ用意します。出力は空の専用フォルダへ。--stills-onlyは代表・連続フレームだけを描きます。元のREADME.md/render.py/verification.jsonと旧28秒フレームは履歴として保持し、今回の入口はrender-visual.py、確認記録はvisual-verification.jsonです。

## 原典と制作範囲

blader/humanizer @225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8、3.1.0。MIT License、Copyright (c) 2025 Siqi Chen。14同梱ファイルを公式Gitblobと照合しました。型の出典はSKILL.mdが示すWikipediaですが、その本文は転載していません。独自作例・図・映像はMIT、Copyright(c)2026 Studio Yebisu。

新しいOpusの8原本を保存し、制作側の複数文の引用照合補正、事実構造、説明、描画、確認、包装とは区別しています。自動照合やエージェントの画面確認は、人による審美的承認や意味の保証ではありません。実機iOS/Safari/VoiceOver、200%ズーム、クリップボード内容の再取得は未確認です。
