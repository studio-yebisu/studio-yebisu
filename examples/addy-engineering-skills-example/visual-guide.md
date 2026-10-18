# Addy Agent Skills：AIへ渡す、小さな開発手順

AIが読むMarkdownの工程別スキル集から7つを選びました。選び方、仕様、計画、小さな実装、TDD、レビュー、画面の手順を、依頼と旧TODO、6領域の仕様、2増分、AIの執筆と制作担当による別のNode実行、条件の反転、実関数と使えるTODOへつなぎます。説明用6部品と3群は原典の共通スキーマではありません。

元の6モデル受領・5Node実行・2RED/GREEN・36条件の3TZ確認・条件反転・別AIの親による5軸レビューは再実行していません。人の仕様・計画・段階承認と聞き取りはなく、画面は全増分後に確認しました。plan/の未チェック原本はそのまま保持し、後付けの合格印にはしません。元のレビューは元TODO差分と仕様・DOMの配線が対象で、紹介用guide・映像・新しい図は対象外です。

新しいページは元のbaseline/tasks.mjsとtasks.mjsのselectTasksを本当に呼び、3つの保存例のIDと入力順を照合します。due-openは4→2、due-allは6→4、no-cutoffは6→6。指定日を含む暦日文字列の比較と状態のANDで、期限なしは期限指定中だけ除きます。3つのJSONは元のresults.samplesの包装で新モデル出力ではありません。任意の日付、追加、完了、0件はdesk.htmlの元TODOで試せます。再読込すると合成6件に戻ります。

## 開く・描く

HTTPで配信しindex.htmlを開きます。図と動画編集は同じ32素材の大きさとSHAを照合し、破損時は止まって再読込を待ちます。32秒、30fps、縦720×1280と横1280×720の別配置、完全無音です。

```powershell
python -m http.server 8080
npm ci --ignore-scripts --no-audit --no-fund --prefix tools/motion-reel
python render-visual.py --out ../addy-review-portrait --width 720 --height 1280 --strip-at 10.2
python render-visual.py --out ../addy-review-wide --width 1280 --height 720 --strip-at 10.2
```

Python、Node20以上、Chrome、FFmpegが必要です。依存は未導入の場合だけ用意し、空の出力先を使います。--stills-onlyは代表・連続フレームだけ。根のrender-visual.pyが動画の入口を一時コピーへ置き、作例全体を配信します。元のNodeテストの再実行は、今回の動画再現には不要です。

## 固定版と確認の範囲

addyosmani/agent-skills@aeac41d4d005999432bb7312f7ff06383a91d59d、MIT、Copyright(c)2025 Addy Osmani。README・LICENSE・7つのSKILL・3参照、全12配布ファイルを公式Gitblobと全bytes一致で確認しました。元の66原本と私的履歴を保ち、旧HTMLはdesk.htmlとvideo/legacy.htmlへ残しています。旧READMEは28秒時点の再現手順で、新しい32秒の説明は本書です。source.zipとverification.jsonは今回の包装で新設しました。

新しい8原本のOpus5.5執筆と、親の事実構造・元JSON包装・補正・描画・検証・公開を分けて記録します。今回の確認はvisual-verification.jsonです。実機iOS/Safari/VoiceOver、200%ズーム、人の審美的承認、全入力や性能、クリップボードの再取得は未確認です。無音MP4と、音声ガイドのない編集ソースを配布します。

旧desk.htmlは28秒編集リンクの行先と表示名だけvideo/legacy.htmlへ補正しました。元HTMLは基準コミットと私的原本に保持し、ほかの65保護ファイルは同じバイトです。
