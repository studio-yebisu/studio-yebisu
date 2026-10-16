"""架空のワークショップ受付の入口。注文ファイルを読み、受付処理に渡す。"""

import argparse
import json
from pathlib import Path

from service import submit_order


def main(argv=None):
    parser = argparse.ArgumentParser(description="架空のワークショップ注文を受け付け、領収JSONを書き出します。")
    parser.add_argument("--order", required=True, help="注文JSONのパス")
    parser.add_argument("--out", required=True, help="領収JSONを書き出す既存のディレクトリ")
    args = parser.parse_args(argv)

    order = json.loads(Path(args.order).read_text(encoding="utf-8"))
    receipt = submit_order(order, Path(args.out))
    print(json.dumps(receipt, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
