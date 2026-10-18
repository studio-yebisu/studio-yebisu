# Agency Agents：指示書の中身と成果の受け渡し

入口index.htmlは大きな概念図です。UX設計・画面実装の2役と、各役の6つの構成要素を選べます。guide.htmlは、元の役割適用で作った架空イベントの操作できる案内です。comparison.htmlはさらに前の実装の比較用記録です。原入力・実出力・固定役割の内容は保っています。

## 再現

このディレクトリをHTTPで配信してindex.htmlを開いてください。AIの新規実行・外部API・音声は使いません。固定11素材をバイト数とSHA-256で確認してから図を開き、確認できなければ図と操作を止めて再取得を案内します。

```powershell
python -m http.server 8080
python render-visual.py --out reviews/portrait --width 720 --height 1280
python render-visual.py --out reviews/wide --width 1280 --height 720
```

Motion Reelの既存依存が必要です。初回だけtools/motion-reelのpackage-lock.jsonに従って依存を用意してください。出力先は空の専用フォルダーを指定します。動画は32秒、30fps、無音。video/README.mdに編集と時間の契約を記しています。

## 出典と範囲

msitarzewski/agency-agents固定bd956db032d907387e6b9ddebff3e18f1de8c679、MIT、Copyright2025 AgentLand Contributors。コミュニティの役割定義集です。READMEのOption3 Use as Referenceとして2役を読み、同じOpus5.5の別実行に順に当てた元の成果を図解しています。独立agent協調・自動振り分け・役割の品質保証を検証していません。役割が参照するai/agents/architect.mdは固定アーカイブに存在しません。

新図と映像は新しいOpus5.5実行が執筆しました。親の修正・包装・技術検証は制作記録で区別します。実行済みの検査はverification.jsonに記録し、原制作・前回の検査はdata/productionの履歴と保全した素材に残しています。実機iOSや人による審美的承認は未確認です。
