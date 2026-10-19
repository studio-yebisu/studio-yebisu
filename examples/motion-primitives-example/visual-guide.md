# Motion Primitives：部品を写して、状態から開閉を作る

ReactのアニメーションUI部品集です。元の依頼と固定ソースを同じ作者AIへ渡す制作経路と、Appの状態→Accordion/Provider→Item→Trigger/Content→状態の戻り道を図にします。新しい図は保存済みの実操作記録を読む説明で、連続操作の録画や実描画速度の測定ではありません。

- `index.html`: 新しい構造図。`desk.html`: 原典から写した実Accordionを使う元のReact画面。
- `outputs/downloaded-state.json`: 元日時を含む2529Bの実保存原本。図で選んだ状態を新しく生成したJSONではありません。
- `video/index.html`: 新32秒の編集ソース。`video/legacy.html`: 元28秒の編集ソース。
- `verification.json`: 元の実行確認。`visual-verification.json`: 今回の新しい図と映像の確認。

## 再現

ルート形式ZIPを展開し、このフォルダーをHTTPで配信してindex.htmlまたはdesk.htmlを開きます。元のReact画面は固定済みassets/app.jsで動きます。再ビルドする場合だけ、このフォルダーで元package-lockを使いnpm ci、npm run typecheck、npm run build。原典adapterの改変と依存通知はREADME/vendor/dependency-versionsに保持しています。

新しい映像はNode20以上、Chrome、FFmpeg/ffprobe、同梱tools/motion-reelの固定依存が必要です。初回のみtools/motion-reelでnpm ci --ignore-scripts。次の出力先は空の専用フォルダーを指定します。

```text
python render-visual.py --out <empty-portrait-dir> --width 720 --height 1280 --strip-at 14.4
python render-visual.py --out <empty-wide-dir> --width 1280 --height 720 --strip-at 14.4
```

32秒/30fpsで縦横を別配置に描き、音声指定をしません。window.seek(seconds)は呼出順に依存せず完成した時刻を描きます。元28秒の再現入口render.pyはlegacyを参照します。

## 制作と確認の区別

原典ibelick/motion-primitives@120f64f6ca60348e251f929e9c81f11ccbe45eda、MIT2024ibelick。7同梱原典は公式Gitblobと生bytes一致。元実装/旧映像2受領、元の型検査/ビルド/15操作状態/12例と保存JSONは保全し、その検査スイートを再実行していません。新UI/映像8原本は別のOpus5.5受領で保持し、制作担当の事実整理/技術補正/描画/確認/包装とは分けます。

0.18秒/0秒はアプリの設定です。OS reduceの元検証はCDP模擬。実機iOS/Safari/VoiceOver、200%ズーム、人の審美的承認、意味/全入力/性能の保証は未確認です。音声ガイド、TTS、ナレーション原稿/音源、MP4音声トラックはありません。
