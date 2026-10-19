# 探して、ひとつ開く。— 28秒の解説動画の元ページ

しおり工房 検索ヘルプ（Motion Primitives 作例）の流れを、28秒・無音で見せる映像の、編集できるソースです。`index.html` を開くとブラウザーの中で同じ映像を描き、好きな秒へ移動できます。

- 使っているのは、実際の画面のキャプチャ4枚と、実際の入力・操作記録・保存した JSON だけです。
- 実画面を切り抜いて編集でつないだ映像で、操作を続けて録画したものではありません。画面の入れ替えは編集上のつなぎで、Accordion の実際の開閉時間や表示速度を写したものではありません。
- 手順書と「しおり工房」は作例用の架空のものです。PDF や画像を書き出す機能が実在するわけではありません。実際に動くのは、ブラウザー内の検索と開閉だけです。
- 映像の足元には、常に「架空の手順書・実画面からの編集・無音」と出します。

## 伝える流れ

依頼 → 実際の部品 → 実際の結果、の順です。

1. **依頼**：検索結果を開いた場所が分かる小さな動き。検索や操作の邪魔をせず、動きを減らしても読める（`brief.json`）。
2. **実際の部品**：原典 ibelick/motion-primitives（固定コミット `120f64f6ca60348e251f929e9c81f11ccbe45eda`）の `Accordion`・`AccordionItem`・`AccordionTrigger`・`AccordionContent` を写し、id と aria 属性の受け渡しだけを加えたもの。React 18.3.1・Motion 11.12.0。開く1件はアプリ側の状態（`expandedValue` と `onValueChange`）で持ちます。
3. **実際の結果**：6件 →「書き出し」で2件 → PDF を開く → 画像へ切り替え → 動きを抑えても同じ2段落 → 状態を JSON で保存（`outputs/operations.json`・`outputs/downloaded-state.json`）。

## 場面

| 時刻 | 伝えること | 使う素材 |
| --- | --- | --- |
| 0〜4秒 | 探して、ひとつ開く。依頼の要旨と6件の手順書 | `brief.json`、`input/articles.json`、`assets/phone.png` |
| 4〜8秒 | 「書き出し」で、6件が2件に | `assets/search.png`、記録 `search-two` |
| 8〜14秒 | 原典の Accordion で、1件だけ開く（`expandedValue = "export-pdf"`） | `assets/pdf.png`、記録 `open-pdf` |
| 14〜18秒 | もう1件を押すと切り替わる（`export-images`）。同じ見出しで閉じる | `assets/images.png`、記録 `switch-images`・`close-images` |
| 18〜23秒 | 動きを抑えても、本文は同じ。開閉は 0.18 秒と 0 秒（どちらも設定値） | `assets/pdf.png`、記録 `open-pdf`・`manual-reduced`・`os-reduced` |
| 23〜28秒 | いまの表示を JSON で保存。検索 → 開閉 → JSON保存 | `outputs/downloaded-state.json`、`assets/phone.png` |

左の6枚の手順書カードは、最初から最後まで同じ位置と形で残します。検索の後は PDF と画像の2枚に「一致」、開いている1枚に「開いた」を重ねるだけです。

18〜23秒の画面は「通常の動きで開いた」実画面です。動きを抑えた状態の画面ではありません。3つの状態で本文が同じことは、操作記録の段落を読み込み時に比べて示しています。OS の設定は、Chromium の DevTools Protocol（CDP）で模擬したもので、実機の iPhone の設定ではありません。0.18 秒は見た目の設定値で、測った応答時間ではありません。

詳しい入りと出、つなぎの理由は `storyboard.json` にあります。

## 素材と出典

| ファイル | SHA-256 | 使い方 |
| --- | --- | --- |
| `assets/phone.png`（375×812） | `cd55ec9d08ee2d789f33728b24892742eae3d3247952b41e4f6c9fc426f02461` | 最初の表示。上から675pxを切り抜き |
| `assets/search.png`（1265×889） | `dadfdc3cf639896c7d2722fa6535a1f212e3838845f5ac6b4541bffd041bd095` | 検索欄と結果2行 |
| `assets/pdf.png`（1265×2023） | `a58aeb709a8bc507d1a89201a2eef8da3c7bcf6cd857a451d808d42e79333995` | PDF を開いた結果2行、PDF の行 |
| `assets/images.png`（1265×2023） | `872d021f27e7ee8dbbd9a9316ef35d63fc49f42726c1d58a9e6512320897de7d` | 画像を開いた結果2行 |
| `assets/screen-manifest.json` | `9ec0e70758aefd8cf614fadc8012beeb123db1805bfcde4090df0f510d3407d2` | 画素の大きさと行の DOM 矩形 |
| `../input/articles.json` | `de566f099b82a5bf7e192d913e76d140fbc46564a1a386c185845f5880104771` | 手順書6件 |
| `../outputs/operations.json` | `d324ae5005c14b97ac140d1c19fee3576ac5ca51b06aa5cee17b0a4974e89bed` | 実際の操作の記録 |
| `../outputs/downloaded-state.json` | `d4e218264c3e346ba769d42082f13b9c104bb86ca008442759ee529f92fdd95b` | 保存した JSON |
| `../brief.json` | `be4b51e24a920c9492106a684bf59edc095a179daa38b1d66eed8b1da13fc1be` | 依頼の要旨、0.18 秒の扱い |

- 画面のキャプチャは、ローカルで動かした React の作例を Windows 上の Chromium で撮ったものです（同じ画素のまま RGB の PNG に変換）。画像は縮小だけして、画素の描き足しや合成はしません。説明の線・カード・文字は、画面の外側に描きます。
- 切り抜きは `screen-manifest.json` の行の矩形を16px以上の余白で含むようにしています。キャプチャの範囲やスクロールバーで横位置が数px ずれることがあるためです。読み込み時にこの余白を確かめ、足りなければ描きません。
- 映像のコードと文章：MIT License, Copyright (c) 2026 Studio Yebisu。画面に写る部品は Motion Primitives（MIT License, Copyright (c) 2024 ibelick）を写して改変したもので、ライセンス文は `../vendor/motion-primitives/LICENCE.md` にあります。
- 外部のフォント・画像・スクリプトは読み込みません。文字はその環境に入っている日本語フォントで描きます。

## 時刻の契約

- `window.motionConfig = {duration: 28, fps: 30, width: 1280, height: 720, posterTime: 12, audioEvents: []}`。`window.renderConfig` に幅・高さ・FPS があればそれを使い、1280×720 の配置を等倍率で収めます。
- `window.motionReady` は、上の9ファイルを同じフォルダーの中から読み、SHA-256 を記録と比べ、件数・id・本文・保存 JSON が操作記録と一致することを確かめ、`document.fonts.ready` を待ってから解決します。どれかが違えば理由を出して止まり、代わりの映像は出しません。
- `window.seek(秒)` は0〜28秒にそろえ、毎回 canvas を初期化してから、その時刻の完成した画面を描きます。前のフレーム、呼んだ順番、壁時計、乱数には依存しません。読み込み前に呼ばれたときは、読み込み後に描いてから解決する Promise を返します。
- `window.__MOTION_RENDER__` が真のときは canvas だけを表示し、プレビュー用の再生（requestAnimationFrame）を動かしません。CSS のアニメーションは使っていません。

## 編集用ページの操作

`index.html` は `file://` では素材を読めません。作例のフォルダー（`index.html` と `video/` がある場所）でローカルサーバーを起動して開きます。

```sh
python -m http.server 8861 --bind 127.0.0.1
```

`http://127.0.0.1:8861/video/` を開きます。

- 「再生」ボタン：再生と一時停止。再生中は押された状態（`aria-pressed="true"`）になります。
- 再生位置のスライダー：0〜28秒を0.1秒刻み。← → で0.1秒、PageUp・PageDown で2秒ずつ動きます。
- 画面か本文にフォーカスがあるとき：Space で再生／一時停止、Home・End で先頭・末尾、PageUp・PageDown で2秒移動。修飾キー付きの操作と、入力欄での操作は奪いません。

## 書き出しの再現

配布 ZIP を展開したフォルダーで実行します。Node.js 20 以上、Chrome、FFmpeg と ffprobe が必要です。出力先は作例のフォルダーの外にある、空のフォルダーにしてください（既存の書き出しは上書きしません）。

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix examples/motion-primitives-example/tools/motion-reel
python examples/motion-primitives-example/render.py --out renders/motion-primitives-first
```

`render.py` は作例を一時フォルダーへ写し、`video/index.html` を入口にして、同梱のレンダラーで 1280×720・30fps・28秒・無音の MP4、静止画、コンタクトシート、ポスター、同じ時刻の描き直しの一致を書き出します。

## 確認の状況

- この5ファイル（`index.html`・`video.css`・`video.js`・`storyboard.json`・`README.md`）は Claude Opus 5.5（`claude-opus-5-5`）が素材と記録を読んで書いたもので、作者が担当したのはこの5ファイルだけです。書いた時点では、描画・フレームの確認・MP4 の書き出しはまだ実行していません。これらは制作側が別に行い、結果を別に記録します。
- 実機の iPhone Safari、VoiceOver などの読み上げソフト、人による見た目の承認は、この映像の範囲に含めていません。
- 文字はその環境のフォントで描くため、別の OS やフォントでは字形や折り返しが変わることがあります。
