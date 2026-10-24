# HatchZip 作例：展開しながらアーカイブを縮める実測トレース

ケース `hatchzip-example`／カタログ `resource-hatchzip`

## これは何か

**HatchZip**（[xevrion/hatchzip](https://github.com/xevrion/hatchzip)、MIT OR Apache-2.0）は、ZIP・7z・tarを展開しながら元アーカイブを段階的に削り、保存場所の使用量を抑える解凍ツールです。元アーカイブは**消費されます**。

この作例では、新規作成した架空ファイルの**使い捨てコピー**だけに対して3回実行し、展開中のアーカイブ残量・出力の成長・ハッシュ照合の実測を記録しました。原本アーカイブには一切実行していません。

## 実際の入出力（2026-10-24・Windows）

| サンプル | 元アーカイブ | 出力 | 照合 |
| --- | --- | --- | --- |
| ZIP・stored・4,096ファイル | 67,549,058 B | 67,108,864 B（4,096件） | すべてSHA-256一致 |
| ZIP・deflate・16ファイル | 22,774 B | 8,388,608 B（16件） | すべてSHA-256一致 |
| tar・1,024ファイル | 35,133,440 B | 33,554,432 B（1,024件） | すべてSHA-256一致 |

- 出力は計 **5,136件**、そのSHA-256が**すべて一致**しました。
- 検証コピーは消費され、参照用の原本アーカイブは保持されました。
- いずれも `list` → `test` → `check` を先に済ませてから展開しています。

## 版と出所

| 項目 | 値 |
| --- | --- |
| 実行した版 | HatchZip **v0.1.2**（公式Windowsバイナリ。バイナリのSHA-256 `402d8efe…76247` を検証済み） |
| ソース／タグのコミット | [2b754c85b9322da64186e5e199ed22b1e45a5cce](https://github.com/xevrion/hatchzip/tree/2b754c85b9322da64186e5e199ed22b1e45a5cce) |
| ライセンス | [MIT原文](https://github.com/xevrion/hatchzip/blob/2b754c85b9322da64186e5e199ed22b1e45a5cce/LICENSE-MIT)（[同梱のコピー](third-party/hatchzip-LICENSE)）。コードはMITまたはApache-2.0を選択可。展開素材の権利は別 |

## 再現手順

再現用コードは [`reproduce.py`](reproduce.py) です。**このツールはアーカイブを消費するため、実データの原本に対して実行しないでください。**

```text
python reproduce.py    # HatchZip CLI が必要（HATCHZIP_EXE でバイナリを指定可）
```

中身の流れ：

1. 新規フォルダーに架空のファイルを作り、通常のZIP／tarでアーカイブ（原本）。
2. 原本のコピーを別の検証フォルダーへ置く（原本は手を付けない）。
3. `hatchzip list`・`test`・`check` で内容・整合性・必要容量を確認。
4. コピーに対して `hatchzip extract --verify-first --keep-free 2GB` を実行（コピーは段階的に削られ、完了時に消える）。
5. 出力を原本側のファイルとSHA-256で照合。

実行のたびに `out/<日時>/` に新しい検証セットが作られ、公開物には含まれません。

## 測り方（比較の読み方）

- 「観測最大」は、検証フォルダー内にあるアーカイブ・出力・進捗ファイルの**ファイルサイズ合計**を約1ms間隔で不等間隔サンプリングした**観測値の最大**です。瞬間最大や物理ディスクの使用量を保証しません。
- 従来の展開（アーカイブと出力が最後まで共存）と比べると、最大サンプルで約4割小さく抑えられました（ZIP・4,096ファイルの例：観測最大 75,978,043 B／従来の共存 134,657,922 B）。
- トレースの時間はこのPCの実行記録で、速度のベンチマークではありません。

## 条件と、していないこと

- メイン3件は既定の空き確保（2GB）のまま、十分に余裕のあるディスクで実行しました。追加の容量枠約8.5MiBの試験では途中停止し、予約容量を通常の2GBへ戻すと再開して24件すべてが一致しました（[`additional-probe.json`](additional-probe.json)）。容量逼迫時の完走、物理使用量の瞬間最大、ディスクを満たす試験、クラッシュ・強制中断からの復旧は未確認です。
- 圧縮ZIPでは削れる量が小さくなることがあります。追加容量が**常にゼロになるわけではありません**。
- 別ドライブへの展開では、元アーカイブの削除で展開先の容量は増えません。
- 試したのは3件の小さな使い捨てデータです。7zのsolidブロックや大きな実データでの挙動はこの作例の範囲外です。

## ファイル

- `reproduce.py` — 再現用の実行コード
- `samples.json` — 公開用の実測記録（サンプルしたトレース：archive/output/sidecar/totalバイトとファイル数）
- `runtime-results.json` — 照合結果の要約（バイナリ・リリースのハッシュなど）
- `index.html` / `style.css` / `app.js` — トレース再生ページ
- `video/` — 26秒・無音の説明映像の編集ソース（Motion Reelの時間契約に従う）

小さい実入力は [`assets/sample.zip`](assets/sample.zip)、実出力の先頭ファイルは [`assets/extracted-fixture-01.bin`](assets/extracted-fixture-01.bin)。SHA-256は [`assets/files-manifest.json`](assets/files-manifest.json) で照合できます。

## 説明動画と編集ソース

26秒・30fps・音声なしの[縦動画](../../media/hatchzip-example.mp4)と[横動画](../../media/hatchzip-example-wide.mp4)、[編集ソース](video/index.html)を掲載しています。動画の再利用条件は[サイトのメディア利用条件](../../media-rights.html)を参照してください。
