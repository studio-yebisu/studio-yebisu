# Agent Reach：手順書と点検、道具と材料のつながり

入口のindex.htmlは、Agent Reachがどういう仕組みかを図解します。経路表と分野別手順はAIへ渡す文書です。doctorはCLIで、接続状態を別に点検します。下層の読み取りはghやtwitter-cliなど、既存の道具を直接使います。

図の「中身・読む・まとめる」とGitHub・Xの経路、3つの部品を選べます。3部品は説明用の整理で、共通の機械スキーマではありません。部品の補足から原典の該当箇所を読めます。図は保存済みの流れで、新しい取得やAIは実行しません。

元の作例では、制作担当が固定版の手順を適用し、doctor、8回のgh API、1回のtwitter-cliを実行しました。原典6ファイルと公開投稿1件が対象です。doctorのGitHub・Xはwarn／active_backend:nullのまま。実取得の成功とは分けて残しています。その保存結果を読んだOpusが根拠を整理し、日本語メモを作りました。整理は取得の後の別工程です。

「実際の根拠メモを保存」は元と同じ7453バイトのMarkdownを保存します。desk.htmlとapp.mjs・desk.cssは元の8枚の根拠ビューアです。原入力・実行記録・比較・メモ・原典54ファイルを保全しました。元の推論や取得を再実行せず、新しい図と映像をOpus5.5で制作しています。原制作の確認はverification.json、新しい図と映像の確認はvisual-verification.jsonです。

## 再現

このディレクトリをHTTPで配信してindex.htmlを開いてください。編集ソースはvideo/index.html。13固定素材をconcept/manifest.jsonのバイト数・SHA-256で照合し、不一致なら図と操作を止めて実際の再取得を案内します。

```powershell
python -m http.server 8080
python render-visual.py --out reviews/portrait --width 720 --height 1280
python render-visual.py --out reviews/wide --width 1280 --height 720
```

書き出しはMotion Reel、Node・FFmpeg・Chromeとその既存依存を使います。初回だけtools/motion-reelのpackage-lock.jsonに従って依存を用意してください。出力は空の専用フォルダーへ。32秒・30fps・音声なし。詳細はvideo/README.mdに記しています。

原典：Panniantong/Agent-Reach @94f06c1969dfc1834001269d79d3ad0972d9dee6、MIT、Copyright (c)2025 Agent Eyes。MITは原典のコードと文書の条件で、接続先サービスの規約・別CLIのライセンス・第三者投稿へ及ぶものではありません。投稿本文・認証・返信・メディアは同梱していません。実機iOS／VoiceOver、200%ズーム、人による審美的承認、クリップボード内容の再取得は未確認です。
