# Studio Yebisu の配色（この作例で使った図の見た目）

Diagram Design の `references/style-guide.md` は、色と文字を「役割」で決め、値を差し替えて自分の見た目にする仕組みです。この作例では、原典のファイルは書き換えず、Studio Yebisu のサイトのCSS（`src/styles.css`）にある色と書体を役割に当てはめ、図のSVGに直接書きました。

- 原典の `vendor/diagram-design/` は変更していません。
- 名前を付けて保存するプロファイルや、プロジェクトの印（`.diagram-design`）は作っていません。この図1枚だけの設定です。

## 色の役割

| 役割 | 値 | 元にしたサイトのCSS | 図での使い方 |
| --- | --- | --- | --- |
| paper | `#f2eee3` | `--paper` | 背景、ラベルの下地、箱の下地 |
| paper-2 | `#e7e1d0` | `--paper-deep` | 図では未使用（作例の画面の面） |
| ink | `#17150f` | `--ink` | 工程名、作業の箱の線 |
| muted / soft | `#4f4a3f` | `--ink-soft` | 矢印、補足の行、ラベル、顧客の箱の線 |
| rule | `rgba(23,21,15,0.22)` | `--rule-faint` | 段の区切り線（飾りの線） |
| accent | `#b83a00` | `--orange`（`#ff4f00`）を暗くした色 | 完了の工程R5と、完了へ進む矢印E09の2か所だけ |
| accent-tint | `rgba(184,58,0,0.08)` | accent の8% | R5の塗り |
| link | `#345d77` | 新しく決めた色 | 矢印の印を定義しただけで、図では未使用 |

サイトの橙 `#ff4f00` は紙の色の上では文字として薄すぎるため、同じ色相のまま暗くし、紙の色に対して約5:1になる `#b83a00` にしました（制作時に手で計算した値）。

## 書体

フォントはWebから読み込みません（原典の style-guide.md の Font source を `system` にした扱い）。OSに入っている書体を順に使うので、Windows と macOS では見え方が少し変わります。

| 役割 | 書体の並び |
| --- | --- |
| 題名 | Hiragino Mincho ProN, Yu Mincho, YuMincho, BIZ UDPMincho, Noto Serif JP, serif |
| 工程名・段の名前・ラベル | Hiragino Sans, Hiragino Kaku Gothic ProN, Yu Gothic UI, Yu Gothic, YuGothic, Meiryo, Noto Sans JP, sans-serif |
| 工程の番号（C1 など） | Geist Mono, ui-monospace, monospace |

原典の標準の Instrument Serif・Geist は日本語の字形を持たないため、読み込んでいません。日本語の文字は等幅の書体に入れていません。

## 大きさ

- 図の大きさ：doc-wide（viewBox 1280×720）。読む人：mixed。
- 工程名と段の名前は16px、補足の行・分かれ道のラベル・凡例は12px。日本語のラベルは原典の決まりに沿って、12pxのゴシック、下地の高さ16pxにしています。
- 箱の位置と大きさは4pxの方眼にそろえています。
