# Matt Pocock Skills：AIへ渡す、開発の手順

Markdownの開発手順から4つを選ぶスキル集です。domain-modelingは用語、codebase-designは小さなinterface、tddは新しいテストを1つ足し失敗を見てから通す反復、code-reviewは独立したStandardsとSpecの照合を扱います。4つの自動エージェントや検索APIではありません。6部品の図は説明用整理で、原典の共通スキーマではありません。

元の架空依頼と合成6項目、用語8・仕様7条件、同じsearchEntries入口、AIの執筆と制作担当の別工程のNode実行、保存された独立AI2軸の結果をつなぎます。元の推論やNodeテスト、独立レビューをやり直していません。利用者への聞き取りやseam合意はなく、原典の限定適用です。原レビューは検索コードと仕様に対するもので、新しい図や映像を審査したものではありません。

新しいページは元baseline/search.mjsとsearch.mjsを本当に呼びます。ＵＩ/allは0→3、UI全角空白設計/allは0→1、空語/slidesは6→2。原結果とIDと掲載順が一致した6枚の紙を描きます。出力3JSONは元の保存sampleobjectをUTF8/LFで包装したもので、新モデル出力や新テストの記録ではありません。元の任意検索はdesk.html、旧映像のソースはvideo/legacy.htmlへ保全しています。

## 開く・描く

HTTPで配信しindex.htmlを開きます。概念図と動画編集は同じ25素材の大きさ/SHAと内容を照合し、破損時は止まって再読込を待ちます。32秒・30fps・縦720×1280と横1280×720の別配置で、完全無音です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../matt-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../matt-review-wide --width 1280 --height 720 --strip-at 10.2
```

Python、Node20以上、Chrome、FFmpegが必要です。依存は未導入の場合だけ用意し、空の出力フォルダを使います。--stills-onlyは代表・連続フレームだけ。根のrender-visual.pyが動画の入口を一時コピーへ置き、作例全体を配信するためvideo/だけをprojectに指定する必要はありません。元のNodeテストの再実行は今回の動画の再現には不要です。

## 原典・制作の区別

mattpocock/skills @49dd158d1076134a641b33efb035946536778336、MIT、Copyright(c)2026 Matt Pocock。公式9Gitblobを確認し、元配布9ファイルのCRLFを保全しました。公式LFとはrawbytesが異なり、CRLFだけ正規化した内容とGitblobが一致します。元の固定checkout一致の記載は、公式Gitblobのrawbytes一致の主張とは分けます。元の21TDD phasefileのSHAは実記録と完全一致します。

元の62casefileとHTML別名2つ、原9資料、実装・入力・出力・テスト・レビュー記録を保持。旧README.mdは原作例の28秒時点の再現手順として保全しています。原作例にはsource.zip/visual-verification.jsonはなく今回包装しました。新しいOpus5.5の8原本を、制作側の事実構造・既存JSON包装・描画・QA・公開と分けて記録します。今回の確認記録はvisual-verification.jsonです。実機iOS/Safari/VoiceOver、200%ズーム、人の審美的承認、全入力・速度・大規模データ・クリップボード内容再取得は未確認です。

旧desk.htmlは28秒の編集リンクだけvideo/legacy.htmlへ向けました。元HTMLは基準コミットと私的な原本に保持し、ほかの63保護ファイルは同じバイトです。新しい画面の依頼文は、元のrequest.txtどおり執筆用の3冊に渡す説明へ補正しました。code-reviewは別工程の4冊目です。
