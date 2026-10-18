# 図解動画「AIに、開発の手順を渡す」の元ページ

Matt Pocock Skills 作例の、32秒・無音の図解動画を描く編集できるソースです。作例ページ（`../index.html`）と同じ概念図を `../concept.js` から読み込み、同じ形（4冊の手順書・依頼と旧コードの紙・AIが執筆する場所・用語集と仕様の紙・1つの入口を持つ検索モジュール・制作担当のNode・テストとコードの紙・固定差分と2つの目・6件の掲載項目・結果の紙・保存したJSON・元の検索台）を時刻に合わせて動かします。

## Matt Pocock Skills とは

[mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336) は、AIエージェントが読む開発手順のMarkdown集です。検索ライブラリやAPI、モデル、品質の判定器ではなく、4つのエージェントが自動で動く仕組みでもありません。この作例では、その中から domain-modeling・codebase-design・tdd・code-review の4つを選び、架空の依頼と合成データ6件の検索の修正に、手順の一部として使いました。原典の tdd が求める「テストの前に入口（seam）を利用者と確認する」は行っていません。

## 映像の要点

- 縦 720×1280（主）と、配置を作り直した横 1280×720。30fps・960フレーム。横は縦を縮めたものではなく、横長の図の配置（2×2の棚・4列）で描きます。
- 7場面：0・4・8・13・18・23・29秒。最後の動きは28.9秒で終わり、29〜32秒は静止。ポスターは31秒。
- 例は「全角UI」（`wide-ui`）。検索語「ＵＩ」・全分野で、原関数が返した3件と、旧コードの0件を描きます。
- 音はありません。`audioEvents` は空で、ナレーション・音声ガイド・読み上げ・原稿・音源・WebSpeech・WebAudio はありません。

## 何が実際の結果で、何が保存記録か

| 図の中のもの | 由来 |
|---|---|
| 結果の紙（黄色の帯）と「旧コード 0件」 | 読み込み時に `../search.mjs` と `../baseline/search.mjs` を実際に import して、`../entries.json` の6件と保存済みの入力で1回だけ呼んだ戻り値。3件すべてで、順序が `../results.json` と一致しなければ描きません。新しいNodeテストの記録ではありません |
| RED・GREEN の数（2→3→4件、各段の失敗1件） | 元の制作で制作担当が Node v24.18.0 で実行した7回の記録（`../tdd-history.json`）。ここでは再実行しません |
| 別の確認 18/18 | 元の制作の `../acceptance.json`。テスト4件と合算しません |
| 規約 0件・仕様 0件 | 元の制作で、原典 code-review の2軸を独立したAI2つが別々に照合した記録（`../review.md`）。この映像のレビューでも、人の承認でもありません |
| 用語集8語・仕様7条件 | `../GLOSSARY.md` と `../SPEC.md` から数えた値 |
| 「AIが執筆」 | 元の Opus 5.5 の別々の実行をまとめて表す1つの場所。1回の会話や、AIがNodeを動かしたことを示すものではありません |

フレームごとに関数を呼んだり、推論やテストを走らせたりはしません。

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | 元ページ。キャンバス `#film`、準備の状態 `#asset-status`、操作（再生・先頭へ・最初から再生・末尾へ・0〜32秒のスライダー `#time` と `#clock`・7場面へ移るボタン・縦／横） |
| `video.js` | 時刻 t の画面を描く。`window.motionConfig`・`window.renderConfig`・`window.motionReady`・`window.seek` |
| `video.css` | 元ページの見た目と、書き出し時にキャンバスだけを出す表示 |
| `storyboard.json` | 場面ごとの「伝わること・入る状態・出る状態・時刻」、使う素材、縦横の配置、範囲 |
| `scene.js`・`scene.css`・`legacy.html` | 以前の28秒の映像ソース。参照用に残しています |

## 時間の契約（Motion Reel）

- `window.motionConfig = {duration: 32, fps: 30, width, height, posterTime: 31, audioEvents: []}`。
- `window.renderConfig` の `width`・`height`・`fps` を初期化時に反映します。幅が高さより大きければ横の配置で描きます。大きさが渡されたときは、縦／横の切り替えボタンを使えなくします。
- `window.motionReady` は、フォントの準備、25件の素材の照合（大きさ・SHA-256・中身の対応）、原関数の実際の呼び出しと保存記録との一致がすべて済むと解決します。どれかが失敗すると拒否され、描画を止めます。
- `window.seek(seconds)` は、指定時刻を最も近いフレームにそろえ、その時刻の完成した画面を描いてから解決するPromiseを返します。呼んだ順番や壁時計、前のフレームには依存しません。乱数は使いません。
- `window.__MOTION_RENDER__` が真なら、プレビューのタイマーと操作を使わず、キャンバスだけを表示します。

## 開き方と書き出し

素材を `fetch` し、原関数をES modulesとして読み込むため、作例のフォルダ（`index.html` があるフォルダ）をローカルのHTTPサーバーで配信して開きます。`.mjs` を JavaScript の種類で返すサーバーを使ってください。ファイルを直接開くと読み込みが止まり、図は描かれず、もう一度読み込むボタンが出ます。

```bash
python -m http.server 8000 --bind 127.0.0.1   # http://127.0.0.1:8000/video/index.html
```

書き出しには、制作担当が作例のルートに置く `render-visual.py` を使う予定です。

```bash
python render-visual.py --out ../matt-pocock-skills-portrait --width 720 --height 1280
python render-visual.py --out ../matt-pocock-skills-wide --width 1280 --height 720
```

作例ルートで実行し、空の出力フォルダを使います。引数と必要な環境の詳細は、梱包時に付く `../visual-guide.md` を見てください。作例ページの動画は、縦が `../../media/matt-pocock-skills-example.mp4`（ポスター `../../media/matt-pocock-skills-example.webp`）、横が `../../media/matt-pocock-skills-example-wide.mp4` を参照します。

## 確認の状態

このソースは claude-opus-5-5 が執筆した時点で、次のどれも行っていません。

- ブラウザでの表示（作例ページ・この元ページとも）
- 25件の照合と、原関数の呼び出しが実ファイルで通るかの確認
- フレームの書き出し、MP4の作成、映像の目視確認
- 375×812・320px幅・横長での配置、キーボード操作、読み上げ、ライト／ダークの確認

実際の確認記録は、梱包時に `../visual-verification.json` へ制作担当が残します。原本の執筆と、後の描画・QAを分けて扱います。

## 元の作例の保全

- 元の作例の62件と、以前の表示の2件（`../desk.html`・`legacy.html`）、合わせて64件は、この改修で変更しません。`../search.mjs`・`../baseline/search.mjs` も元のバイトのままです。
- `../vendor/matt-pocock-skills/` の9件は、元の作例が保存したときの改行CRLFのバイトのままです。GitHubの公式のファイルは改行LFで、改行だけをそろえると中身が一致します。改行をそろえない生のバイトとしては、9件とも公式のファイルと同一ではありません。
- 元の3段のテストとコードの各ファイル（`../tdd/` の21件）のハッシュは、保存したNodeの記録と一致しています（`../tdd-history.json`）。ページと映像は読み込みのたびに、記録の中のハッシュのつながり（REDではテストだけ、GREENではコードだけが変わること）と、最後の記録が今の `search.mjs`・`search.test.mjs` と一致することを確かめます。`../tdd/` のフォルダの各ファイルそのものは、照合の25件に含みません。

## 出典と利用条件

- 原典：[mattpocock/skills](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336)、コミット `49dd158d1076134a641b33efb035946536778336`。バージョン番号はありません。MIT License、Copyright (c) 2026 Matt Pocock（`../vendor/matt-pocock-skills/LICENSE`）。
- この元ページ・図・文言：MIT License、Copyright (c) 2026 Studio Yebisu（`../LICENSE`）。

制作側の再現入口は作例ルートのrender-visual.pyです。空の出力フォルダを使い、`python render-visual.py --out ../matt-review-portrait --width 720 --height 1280 --strip-at 10.2`。横長は1280×720。詳細は../visual-guide.md、実際のQAは../visual-verification.json。原本の未検査と後の制作側QAを区別します。
