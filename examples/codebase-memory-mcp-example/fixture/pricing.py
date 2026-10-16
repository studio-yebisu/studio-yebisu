"""料金の計算。席数 × 1席の料金（円）。割引や税は扱わない。"""


def calculate_total(seat_count, seat_price_jpy):
    return seat_count * seat_price_jpy
