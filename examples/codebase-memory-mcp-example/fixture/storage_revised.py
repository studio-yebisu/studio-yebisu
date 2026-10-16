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
    audit_receipt(receipt, folder)
    return path


def audit_receipt(receipt, out_dir):
    recomputed = receipt["seat_count"] * receipt["seat_price_jpy"]
    audit = {
        "order_id": receipt["order_id"],
        "receipt_file": "receipt-" + receipt["order_id"] + ".json",
        "recomputed_total_jpy": recomputed,
        "saved_total_jpy": receipt["total_jpy"],
        "consistent": recomputed == receipt["total_jpy"],
    }
    path = Path(out_dir) / ("audit-" + receipt["order_id"] + ".json")
    with path.open("x", encoding="utf-8") as handle:
        json.dump(audit, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
    return audit
