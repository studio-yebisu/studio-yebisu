# Quartz の構造図と無音32秒を描く

Quartzは、AIが読むMarkdown指針・トークンCSS・React部品・lint規則を持つデザインシステムです。指示書と依頼を同じ作者へ、コードを制作担当の別工程へ、共通の範囲/トークン/部品からAppの選択と詳細へつなぐ構造を説明します。新しいCanvasは構造の説明で、実物のReact部品はdesk.htmlです。3件のfixtureは架空の静的サンプルで、AI/ツール/404通信/下書き保存を実行しません。

元の1Opus受領と54追跡ファイル、元のlint/ビルド/ブラウザー確認を保持し、元の推論・ビルド・検査スイートは再実行していません。入力待ちfixtureを元の制作担当が承認待ちから原典URL待ちへ置き換えた履歴と、新しいOpusの8原本、制作担当の事実整理/補正/描画/QA/包装を分けています。元の28秒編集はvideo/legacy.htmlとscene.js、動画はvideo/legacy.mp4です。

## 新しい32秒の図解

Node.js20以上、Python3、Chrome、FFmpeg/ffprobeが必要です。初回はtools/motion-reelでnpm install --ignore-scriptsを行います。作例の外に新しい空の出力先を指定します。

```text
python render-visual.py --out ../renders/portrait --width 720 --height 1280 --strip-at 14.4
python render-visual.py --out ../renders/wide --width 1280 --height 720 --strip-at 14.4
```

--stills-onlyは代表/連続/contactの出力です。公開された5ファイルのMotion Reelランタイムを使い、30素材の全bytes/SHA-256と2PNGのdecodeを待ち、seek(秒)で描きます。32秒/30fps/縦720×1280・横1280×720、両方とも音声トラックなしです。同じ環境のPNG一致を別OS/フォントや人の承認へ一般化しません。

## 元のReact画面

desk.html#completed、#tool-failed、#waiting-inputから同じ3件を開きます。5/3/4段の選択で同じ段のJsonViewが変わり、Home/End/上下/Enter、明示的なライト/ダークを使えます。OS配色への自動追随、ログ取込、失敗再実行、URLへの回答と再開はありません。保存は同じfixture全体をJSON.stringify(fixture,null,2)と改行でブラウザーへ渡す操作です。新しい3JSON4076/2645/2723Bも同じobject/serializerの包装です。

元のReactを再ビルドする場合は、この配布物を別の作業用コピーへ展開し、npm ci --ignore-scripts、npm run lint、npm run buildを使います。tools/publish.mjsはビルド結果でindex.htmlを上書きします。そのコピーのindex.htmlが元Reactの入口になり、新しい構造図の入口は失われます。現在の紹介ページ上で実行せず、元ファイルの再現と新32秒の描画を分けてください。原典shadcn CLI導入は今回未使用です。

## 固定版と条件

arla6ka/skills@1aaaa1b47ba5a18b47b0ebcac684ade460c6823f、systems/quartz。MIT、Copyright(c)2026ArlanMaratとFontAwesomeFreeの通知を保持します。同梱33ソースとLICENSEの34CRLFは公式LFとrawbytesが違い、CRLFだけ正規化した内容/Gitblobが一致します。UPSTREAM.jsonは元の包装メタデータです。8部品だけを使い、Panelは資料のみ。他の部品/Blocks/仮想スクロール性能は未検証です。巨大な依存/cacheは配布しません。

新しい確認はvisual-verification.jsonです。実機iOS/Safari/VoiceOver/200%zoom、人の審美的承認、全入力/意味/使いやすさ/性能、クリップボード再取得は未確認です。保存要求、公開原本のbytes、返却されたファイルの有無を区別します。
