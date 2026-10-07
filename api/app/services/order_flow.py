"""Shared order logic used by customer, restaurant and partner endpoints."""
from fastapi import HTTPException

# Which status can move to which. Anything else is rejected.
ALLOWED = {
    "PAYMENT_PENDING": {"PLACED", "PAYMENT_FAILED", "CANCELLED"},
    "PAYMENT_FAILED":  {"PLACED", "CANCELLED"},          # user can retry payment
    "PLACED":          {"ACCEPTED", "CANCELLED"},
    "ACCEPTED":        {"PREPARING", "READY", "CANCELLED"},
    "PREPARING":       {"READY"},
    "READY":           {"PICKED_UP"},
    "PICKED_UP":       {"DELIVERED"},
}


def change_status(conn, order_id: int, new_status: str, changed_by: int | None, note: str | None = None) -> dict:
    """Move an order to a new status and write the history row (same transaction)."""
    order = conn.execute("SELECT * FROM orders WHERE order_id = %s FOR UPDATE", (order_id,)).fetchone()
    if not order:
        raise HTTPException(404, "Order not found")
    if new_status not in ALLOWED.get(order["status"], set()):
        raise HTTPException(409, f"Cannot move order from {order['status']} to {new_status}")
    extra = ", delivered_at = now()" if new_status == "DELIVERED" else ""
    conn.execute(f"UPDATE orders SET status = %s{extra} WHERE order_id = %s", (new_status, order_id))
    conn.execute(
        "INSERT INTO order_status_history (order_id, status, changed_by, note) VALUES (%s, %s, %s, %s)",
        (order_id, new_status, changed_by, note),
    )
    order["status"] = new_status
    return order


def offer_to_nearest_partner(conn, order_id: int) -> dict | None:
    """Dispatch: offer the order to the nearest online, verified, free partner
    who has not already been offered this order."""
    partner = conn.execute(
        """
        SELECT dp.partner_id,
               (pl.latitude - r.latitude)^2 + (pl.longitude - r.longitude)^2 AS dist2
        FROM orders o
        JOIN restaurants r        ON r.restaurant_id = o.restaurant_id
        JOIN delivery_partners dp ON dp.city = r.city
        JOIN partner_locations pl ON pl.partner_id = dp.partner_id
        WHERE o.order_id = %s
          AND dp.is_online AND dp.kyc_status = 'VERIFIED' AND dp.current_order_id IS NULL
          AND dp.partner_id <> o.customer_id
          AND NOT EXISTS (SELECT 1 FROM delivery_assignments da
                          WHERE da.order_id = o.order_id AND da.partner_id = dp.partner_id)
          AND NOT EXISTS (SELECT 1 FROM delivery_assignments da2
                          WHERE da2.partner_id = dp.partner_id AND da2.status = 'OFFERED')
        ORDER BY dist2
        LIMIT 1
        """,
        (order_id,),
    ).fetchone()
    if not partner:
        return None
    return conn.execute(
        "INSERT INTO delivery_assignments (order_id, partner_id) VALUES (%s, %s) RETURNING *",
        (order_id, partner["partner_id"]),
    ).fetchone()


def compute_coupon_discount(coupon: dict | None, item_total) -> float:
    if not coupon:
        return 0.0
    item_total = float(item_total)
    if item_total < float(coupon["min_order_value"]):
        raise HTTPException(400, f"Coupon needs a minimum order of Rs {coupon['min_order_value']}")
    if coupon["discount_type"] == "FLAT":
        d = float(coupon["discount_value"])
    else:
        d = item_total * float(coupon["discount_value"]) / 100
        if coupon["max_discount"] is not None:
            d = min(d, float(coupon["max_discount"]))
    return round(min(d, item_total), 2)
