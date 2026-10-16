"""注文の形を確かめる。外部への問い合わせはしない。"""

import re

REQUIRED_FIELDS = ("order_id", "workshop", "seat_count", "seat_price_jpy")
ORDER_ID = re.compile(r"[A-Z0-9-]{1,32}")


class OrderError(ValueError):
    """注文の形が合わない。"""


def validate_order(order):
    missing = [field for field in REQUIRED_FIELDS if field not in order]
    if missing:
        raise OrderError("missing fields: " + ", ".join(missing))
    if not isinstance(order["order_id"], str) or not ORDER_ID.fullmatch(order["order_id"]):
        raise OrderError("order_id must use A-Z, 0-9 and hyphens")
    for field in ("seat_count", "seat_price_jpy"):
        value = order[field]
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise OrderError(field + " must be a positive integer")
