# Ming-Image-0.1-Design 実例：架空の読書会ポスター（実装メモ）

作成：Claude Opus 5.5（`claude-opus-5-5`）。このメモと 3 つのファイルは**作者が書いた入力とクライアント**です。作者はコードを実行しておらず、ネットワーク呼び出し・モデル実行・生成画像の確認は一切していません。実行はオペレーターが原本 4 ファイルを保管したあとに別途行います。

## 1. 何を使うか

- **Ming-Image-0.1-Design** は、UI・インフォグラフィック・ポスターなど文字の多いデザイン向けの text-to-image モデルと、そのローカル推論パイプラインです。Markdown で書かれた SKILL ではありません（README にある Design Skill / PPT Skill は別のエージェント用ワークフローで、今回は使いません）。
- 別モデルの **Ming-Image-0.1-Design-Layer**（平面画像を透明レイヤーに分解する）は今回**実行しません**。編集可能なベクターやレイヤーも出力しません。出力は 1 枚の平面ポスター PNG です。
- 原典参照：`inclusionAI/Ming-Image@3515cd7b1e3049fc517eed7d35020251cd06519a`（MIT）。固定のまま扱います。

## 2. 実行経路と境界

```
原典 README・request.json
  → 作者が inputs/ と run_example.py を書く
  → オペレーターが匿名・無料の公開 Space を 1 回だけ呼ぶ
  → raw prompt ＋ 256 個の learned query
  → thinker（BailingMoE-v2）→ 2 本の条件ストリーム
       query 側：proj_in → 双方向 Qwen2 connector → proj_out
       direct 側：prompt トークン自身の hidden states（3 層分）→ RMSNorm＋Linear
  → seed から作るノイズ → Z-Image flow-matching DiT を 12 ステップ、CFG 1.0
  → 4 チャンネル VAE（AutoencoderKLQwenImage）でデコード
  → 実際の PNG
  → 文字列・alpha・見た目の確認は別工程
```

- 呼び出し先は、原典 README の Demo リンク（`hugging-apps/ming-image-0-1-design-demo`）から移った **`inclusionAI/ming-image-0-1-design-demo@367085c6a006004b1658ad3b7edbd498581a33b3`** です。
- この Space は**独自の `MingImagePipeline`**（vLLM-Omni PR #8021 の参照実装に準拠）を使います。固定した GitHub の `infer.py` とは**別の実装**です。`infer.py` は HUMAN ロールのチャットテンプレートとプロセッサを通して `BailingMM2NativeForConditionalGeneration.generate` を呼び、text-to-image の既定解像度は 2048 です。Space はチャットテンプレートなしで raw prompt を thinker に渡し、今回は 1024 バケットを選びます。したがって、この実例は「公式 CLI を実行した」ものではありません。
- CFG 1.0 でも Space は `guidance_scale > 0` で CFG を有効にします。正の条件と、両ストリームを 0 にした負の条件で DiT を 1 バッチ 2 本ずつ回します。これはソースを読んで分かったことで、内部の活性・テンソル・attention 時間は測定しません。
- モデルの Hub メタデータは現時点で `inclusionAI/Ming-Image-0.1-Design@c57c49689d12ef7d4e24a170014f1dc43d3ce258`（公開・ゲートなし・MIT、LFS ファイル合計 52,883,400,075 バイト）です。ただし Space のローダーは revision を明示せず既定ブランチを読みます。API で revision を観測しても、**サーバーが実際にキャッシュから読んだ重みの SHA の証明にはなりません**。
- Space の説明文には「原典リポジトリは非公開」「RGBA トリガーフレーズは未公開」とありますが、固定した原典 README は読めて、フレーズも載っています。古い記述なので繰り返しません。今回は不透明なクリーム地が目的なので、透明化フレーズは使いません。
- 「6B」は公開されたモデル識別ラベルです。チェックポイントの総容量でも、測定したパラメータ数でもありません。

## 3. 入力

- `inputs/prompt.txt`：英語の自然文によるアートディレクションです。正方形、クリーム紙・深い森の緑・小さな黄土色のアクセント、開いた本と葉が一体になった大きなモチーフ、広い余白、読みやすい日本語見出しを指定します。必要な文字列は次の 4 つで、それぞれ 1 回だけ入れます：「こもれび読書会」「2026.11.08 SUN 14:00–16:00」「小箱図書室」「架空のイベント」。実在の住所、申込リンク、QR、価格、スポンサー、既存ロゴ、追加の主張は入れません。JSON のシステムプロンプトや外部のプロンプト拡張は使いません。
- `inputs/request.json`：`id=reading-club`、`synthetic=true`、上の 4 文字列（別配列）、`prompt_file`、設定 `1024 x 1024 (recommended)` / steps 12 / guidance_scale 1.0 / seed 20261020 を記録します。ジョブは 1 件のみです。自動リトライ、選び直し、2 枚目、seed 変更はしません。実行結果の欄はあらかじめ埋めていません。

## 4. クライアント `run_example.py`

```
python run_example.py --request inputs/request.json --output <空の公開用ディレクトリ> --private <空の非公開ディレクトリ>
```

- 標準ライブラリだけで動きます。ライブラリの自動インストール、ローカル GPU・モデル・ComfyUI は使いません。`gradio_client` も使わないので、トークンの自動探索は起きません。
- 匿名の urllib オープナーを使います。Authorization ヘッダー、Cookie、HF トークン、ブラウザセッション、`trust_remote_code`、アカウント照会はいずれもありません。接続先は `https://inclusionai-ming-image-0-1-design-demo.hf.space` と、`huggingface.co` の公開メタデータ GET だけです。リダイレクト先も同じ許可リストで検証します。
- 送信前に Space メタデータ・モデルメタデータ・`/gradio_api/info` を取得して保存します。Space の repo SHA と runtime SHA が `367085c6…` であること、状態が RUNNING であること、`/generate` の引数名と型と戻り値（Image＋Markdown）が保存済みの形と一致することを確認します。どれかが違えば、推測で合わせずに送信前で止まります。
- POST は `/gradio_api/call/v2/generate` に 1 回だけ送ります。引数名は prompt, resolution, steps, guidance_scale, seed です。返ってきた `event_id` を保存し、`/gradio_api/call/generate/{event_id}` の SSE を最大 15 分読みます。example やキャッシュのエンドポイントは呼びません。
- ネットワーク・キュー・クォータ・認証・HTTP の失敗では POST を再送せず、失敗結果を書いて終了します。仮の画像は作りません。クォータ・ログイン・アップグレード・クレジットの要求はブロッカーとして扱い、別のエンドポイントや別モデルに切り替える理由にはしません。タイムアウトしたら event id を残し、`--resume-event` で既存のストリームだけを読み直せます（再送はしません）。
- `complete` を受け取ったら、返された FileData の url/path から、許可した Space ホストだけを通して画像をダウンロードします。元のバイトのまま `outputs/reading-club.png` に保存し、PIL での再保存・alpha 処理・後編集はしません。PNG シグネチャと IHDR（幅・高さ・カラータイプ）を `struct` で読み、バイト数と SHA-256 を記録します。ヘッダーから文字や alpha の品質は判断しません。
- Space が返した Markdown は UTF-8 のまま `outputs/server-info.txt` に保存します。`outputs/run-summary.json` は**オペレーター側の計測をまとめたもので、モデルの出力そのものではありません**。中身は、元の依頼と設定、画像のバイト数とハッシュ、返された info、ローカルの経過時間、観測した Space とモデルのメタデータ revision、原典コミットです。経過時間はキュー・GPU 割り当て・通信を含むので、モデルの速度ではありません。
- POST 本文・応答・SSE の全イベント・エラー本文・HTTP ステータス・event id は `--private` 側にだけ保存します。公開側にはセッション識別子・非公開ログ・ローカルの絶対パスを入れません。
- 品質に不満があっても追加生成はしません。文字の正しさ・alpha・見た目は、実際の出力を見て別工程で確認します。そっと修正や再生成をして「正しく出た」とは言いません。

## 5. ローカル実行を選ばなかった理由

- 上流で検証された構成は、BF16 で 80 GiB 以上の GPU 1 枚です。これは「検証済みの構成」であって、CPU やオフロードでは動かないという証明ではありません。
- 今回は M ドライブの空きがチェックポイントの容量に足りず、ローカル GPU では別の作業が動いていて、そのまま触っていません。重みのダウンロードや環境構築はしていません。

## 6. 無料経路の前提

- 公式ドキュメント（https://huggingface.co/docs/hub/spaces-zerogpu）の現行記載では、既存の ZeroGPU Space は無料で使えます。匿名利用の目安は 1 日 2 分で、`xlarge` は 2 倍消費します。
- 認証付きのクレジット経路、PRO、課金は使いません。無制限に無料で使えるとは限りません。

## 7. 公開しないもの・ライセンス

- コーディネーターの非公開指示、認証情報、フルログ、重みは公開しません。
- モデルと原典リポジトリは MIT です。Space のソースは非公開で読んだだけで、一般の再配布ライセンスが表明されていないため、MIT として同梱しません。公開するのは自作クライアントと、MIT の原典から選んだ参照だけです。

## 8. まだ主張しないこと

公式 CLI・Layer・ローカルモデル・ComfyUI の実行、透明ピクセル、日本語の正しさ、人による承認、他の入力での挙動、性能、サーバー重みの SHA の検証、内部のテンソルや attention の時間。これらは実際の出力を確認するまで、またはこの経路では検証できないため、主張しません。

## 9. 次の段階

実際の出力が得られたあと、別フェーズでつながった 1 枚の動く図解と、無音のフィルム（32 秒・音声 0）を作ります。新しい UI やエディタも別フェーズです。
