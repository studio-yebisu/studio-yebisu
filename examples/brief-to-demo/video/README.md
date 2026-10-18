# 図解動画「ひと言を、制作の設計図へ」の元ページ

brief-to-demo 作例の32秒・無音の図解動画を描く、編集できるソースです。作例ページ（`../index.html`）と同じ概念図を `../concept.js` から読み込み、同じ形（指示書の本・受け取ったもの・依頼の紙・1つのAI・11項目のブリーフの袋・仮の条件のポケット・分野と読むスキル・JSON・引き継ぎ文・次の制作の点線の枠）を時刻に合わせて動かします。

- 縦 720×1280（主）と、配置を作り直した横 1280×720。30fps・960フレーム。
- 7場面：0・4・8・13・18・23・29秒。29〜32秒は静止（入りは28.9秒まで、ポスターは31秒）。黒への暗転はありません。
- 例はUI画面の依頼（`ui`）。依頼文・分野・読むスキル・「日時・会場・定員は未提供」の言い回し・`outputs/ui.json`（2,733 B）と `outputs/ui-handoff.txt`（3,156 B）の名前と大きさは、照合済みの素材から読みます。
- 音はありません。`audioEvents` は空で、ナレーション・音声ガイド・読み上げ・音源の読み込みはありません。
- ここではAIを実行しません。brief-to-demo はAIが読むMarkdownの指示書で、それ自体は動きません。3件のブリーフは元の制作で Opus 5.5 が書いた保存済みの出力で、スライドの件だけ、元の統合担当が読むスキルを sol-editorial-ja と原典MckEngine へ変えています。今回の改修でブリーフは書き直していません。
- ブリーフに沿った次の制作（受付画面・PPTX・20秒の製品動画）は行っていません。この32秒の解説は、`outputs/motion.json` が計画する20秒の製品動画とは別のものです。

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | 元ページ。キャンバス `#film`、場面の見出し、操作（再生・先頭へ・最初から再生・末尾へ・0〜32秒のスライダー・7場面へ移るボタン・縦／横） |
| `video.js` | 時刻 t の画面を描く。`window.motionConfig`・`window.renderConfig`・`window.motionReady`・`window.seek` |
| `video.css` | 元ページの見た目と、書き出し時にキャンバスだけを出す表示 |
| `storyboard.json` | 場面ごとの「伝わること・入る状態・出る状態・時刻」 |
| `scene.js`・`legacy.html` | 以前の28秒の映像ソース。参照用に残しています |

## 時間の契約（Motion Reel）

- `window.motionConfig = {duration: 32, fps: 30, width, height, posterTime: 31, audioEvents: []}`。
- `window.renderConfig` の `width`・`height`・`fps` を初期化時に反映します。幅が高さより大きければ横の配置で描きます。大きさが渡されたときは、縦／横の切り替えボタンを使えなくします。
- `window.motionReady` は、フォントの準備と12件の素材の照合（大きさ・SHA-256・中身の対応）が済むと解決します。照合に失敗すると拒否され、描画は止まります。
- `window.seek(seconds)` は、指定時刻を最も近いフレームにそろえ、その時刻の完成した画面を描いてから解決するPromiseを返します。呼んだ順番や壁時計、前のフレームには依存しません。描画のたびにキャンバスの状態を初期化します。
- `window.__MOTION_RENDER__` が真なら、プレビューのタイマーと操作の処理を使わず、キャンバスだけを表示します。乱数、外部通信、ネットワークのフォント、画面の撮影は使いません。

## 開き方と書き出し

素材を `fetch` で読むため、作例のフォルダ（`index.html` があるフォルダ）をローカルのHTTPサーバーで配信して開きます。

```bash
python -m http.server 8000   # http://127.0.0.1:8000/video/index.html
```

書き出しには、制作担当が作例のルートに置く `render-visual.py` を使う予定です。フォルダ全体を一時コピーし、素材を同じ配信範囲から読める形で編集ページを開きます。

```bash
python render-visual.py --out ../brief-to-demo-portrait --width 720 --height 1280
python render-visual.py --out ../brief-to-demo-wide --width 1280 --height 720
```

作例ルートで実行します。Python・Node20以上・Chrome・FFmpegと、`tools/motion-reel` の依存が必要です。空の出力フォルダを使います。引数の詳細は、梱包時に付く `../visual-guide.md` を見てください。

作例ページの動画は、縦が `../../media/brief-to-demo.mp4`（ポスター `../../media/brief-to-demo.webp`）、横が `../../media/brief-to-demo-wide.mp4` を参照します。

## 確認の状態

このソースは claude-opus-5-5 が執筆した時点で、次のどれも行っていません。

- ブラウザでの表示（作例ページ・この元ページとも）
- 12件の照合が実ファイルで通るかの確認
- フレームの書き出し、MP4の作成、映像の目視確認
- 375×812・320px幅・横長での配置、キーボード操作、読み上げ、配色の確認

後で制作担当が確かめる点：

- 引き継ぎ文3件が、以前のビューアの文と同じ前置きと同じブリーフJSONで終わるという照合が通ること（制作側で実ファイルと旧handoffTextを照合し、WindowsのCRLFだけLFへそろえ、前置きもJSONも空白を含めて同一内容で比べます）
- 縦の図で、ポケットの「未指定・仮の条件」と未提供の言い回し、区画の名前が小さすぎないこと
- 8〜13秒で袋が開く境目（紙が消え、袋の帯の依頼文が現れる）で文字が途切れないこと
- 28.9秒以降に変化がないこと（同じ時刻を別の順番で描いた一致を含む）
- MP4に音声トラックがないこと

実際の確認記録は、梱包時に `../visual-verification.json` に残します。原本の執筆と後の描画・QAを分けて扱います。

## 出典と利用条件

- 原典：[studio-yebisu/studio-yebisu の skills/brief-to-demo/SKILL.md](https://github.com/studio-yebisu/studio-yebisu/blob/bc2984ab4208e349aded79b3694cc2cb98b8a4a6/skills/brief-to-demo/SKILL.md)、コミット `bc2984ab4208e349aded79b3694cc2cb98b8a4a6`。バージョン番号はありません。MIT License、Copyright (c) 2026 Studio Yebisu（`../vendor/brief-to-demo/LICENSE`）。
- この元ページ・図・文言：MIT License、Copyright (c) 2026 Studio Yebisu（`../LICENSE`）。

制作側の再現入口：作例ルートのrender-visual.pyを使います。`python render-visual.py --out ../brief-review-portrait --width 720 --height 1280 --strip-at 10.2`。横長は1280×720を指定し、空の出力フォルダを使います。詳細は../visual-guide.md、実際の確認記録は../visual-verification.json。原本執筆時点の未実施と、その後の描画・QAは分けて扱います。
