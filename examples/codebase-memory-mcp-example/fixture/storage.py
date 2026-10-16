"""領収JSONの保存。呼び出し側が渡した既存のディレクトリにだけ書く。"""

import json
from pathlib import Path


def save_receipt(receipt, out_dir):
    folder = Path(out_dir)
    if not folder.is_dir():
        raise FileNotFoundError("output directory does not exist")
    path = folder / ("receipt-" + receipt["order_id"] + ".json")
    with path.open("x", encoding="utf-8") as handle:
        json.dump(receipt, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
    return path
