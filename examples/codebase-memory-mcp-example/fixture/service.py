"""注文の受付。確認 → 料金計算 → 領収の保存 の順に呼ぶ。"""

from pricing import calculate_total
from storage import save_receipt
from validation import validate_order


def submit_order(order, out_dir):
    validate_order(order)
    total = calculate_total(order["seat_count"], order["seat_price_jpy"])
    receipt = {
        "order_id": order["order_id"],
        "workshop": order["workshop"],
        "seat_count": order["seat_count"],
        "seat_price_jpy": order["seat_price_jpy"],
        "total_jpy": total,
    }
    save_receipt(receipt, out_dir)
    return receipt
