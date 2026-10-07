"""End-to-end test: user enters the app -> ... -> payment -> delivery -> rating.
Also proves the CVV / card number never reaches the database or the log file.

Run (from the project root, after ./db/reset_db.sh):
    cd api && pytest -q ../tests
"""
import json
import logging
import os
import sys
import uuid

import psycopg
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
from fastapi.testclient import TestClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app import mock_gateway  # noqa: E402

TEST_CARD = "4111 1111 1111 1111"
DECLINE_CARD = "4000 0000 0000 0002"
TEST_CVV = "739"


@pytest.fixture(scope="module")
def client():
    with psycopg.connect(settings.database_url, autocommit=True) as db:
        db.execute("UPDATE delivery_partners SET is_online = FALSE WHERE partner_id NOT IN (301, 302, 303)")
        db.execute("UPDATE delivery_partners SET is_online = TRUE, current_order_id = NULL WHERE partner_id = 301")
        db.execute("DELETE FROM otp_requests WHERE phone IN ('9845011111', '9845011112', '9845022221', '9845033331')")
    with TestClient(app) as c:
        yield c


def login(client, phone, name=None):
    otp = client.post("/auth/otp/request", json={"phone": phone}).json()["dev_otp"]
    r = client.post("/auth/otp/verify", json={"phone": phone, "otp": otp, "name": name})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()


def test_full_order_flow(client):
    # ---------- 1. new customer signs up with OTP ----------
    fresh_phone = f"99{uuid.uuid4().int % 100000000:08d}"
    cust, info = login(client, fresh_phone, "Pradeep Test")
    assert info["new_user"] and info["roles"] == ["CUSTOMER"]

    # wrong OTP is rejected and counted
    wrong_phone = f"99{uuid.uuid4().int % 100000000:08d}"
    client.post("/auth/otp/request", json={"phone": wrong_phone})
    assert client.post("/auth/otp/verify", json={"phone": wrong_phone, "otp": "000000"}).status_code == 400

    # ---------- 2. address + browse ----------
    addr = client.post("/me/addresses", headers=cust, json={
        "label": "Home", "address_line": "5th Cross, Jayanagar", "city": "Bengaluru",
        "latitude": 12.9280, "longitude": 77.5840, "is_default": True}).json()
    rests = client.get(f"/restaurants?address_id={addr['address_id']}", headers=cust).json()
    assert rests[0]["name"] == "Spice Route Biryani House"
    menu = client.get("/restaurants/1/menu").json()
    assert any(i["name"] == "Chicken Dum Biryani" for c in menu["menu"] for i in c["items"])

    # ---------- 3. cart ----------
    client.post("/cart/items", headers=cust, json={"item_id": 501, "quantity": 2, "addon_ids": [801]})
    cart = client.post("/cart/items", headers=cust, json={"item_id": 506, "quantity": 1}).json()
    assert cart["item_total"] == 790.0
    # sold-out item is refused
    assert client.post("/cart/items", headers=cust, json={"item_id": 505, "quantity": 1}).status_code == 409
    # item from another restaurant needs replace_cart
    assert client.post("/cart/items", headers=cust, json={"item_id": 511, "quantity": 1}).status_code == 409

    # ---------- 4. checkout (card) with coupon ----------
    idem = str(uuid.uuid4())
    co = client.post("/orders/checkout", headers=cust, json={
        "address_id": addr["address_id"], "payment_mode": "CARD", "coupon_code": "welcome50", "idempotency_key": idem})
    assert co.status_code == 201, co.text
    co = co.json()
    assert co["order_status"] == "PAYMENT_PENDING"
    assert float(co["bill"]["total"]) == 790 + 30 + 5 + 39.50 - 100        # 764.50
    # double tap -> same order, no duplicate
    again = client.post("/orders/checkout", headers=cust, json={
        "address_id": addr["address_id"], "payment_mode": "CARD", "idempotency_key": idem}).json()
    assert again["duplicate"] and again["order_id"] == co["order_id"]

    # ---------- 5. payment: card goes to GATEWAY, our API only gets a token ----------
    bad = client.post("/mock-gateway/v1/tokenize", json={
        "card_number": DECLINE_CARD, "expiry_month": 12, "expiry_year": 2030, "cvv": TEST_CVV}).json()
    r = client.post(f"/payments/{co['payment_id']}/pay", headers=cust, json={"gateway_token": bad["token"]})
    assert r.status_code == 402                                      # declined
    assert client.get(f"/orders/{co['order_id']}", headers=cust).json()["status"] == "PAYMENT_FAILED"

    # someone tries to send the CVV to OUR API -> rejected, and the value is not echoed back
    r = client.post(f"/payments/{co['payment_id']}/pay", headers=cust,
                    json={"gateway_token": "tok_x12345", "cvv": TEST_CVV, "card_number": TEST_CARD})
    assert r.status_code == 422
    assert TEST_CVV not in r.text and "4111" not in r.text

    tok = client.post("/mock-gateway/v1/tokenize", json={
        "card_number": TEST_CARD, "expiry_month": 12, "expiry_year": 2030, "cvv": TEST_CVV}).json()
    assert set(tok) == {"token", "network", "last4", "expiry_month", "expiry_year"}    # no cvv, no number
    r = client.post(f"/payments/{co['payment_id']}/pay", headers=cust, json={
        "gateway_token": tok["token"], "save_method": True, "card_network": tok["network"],
        "card_last4": tok["last4"], "card_expiry_month": 12, "card_expiry_year": 2030})
    assert r.status_code == 200, r.text
    assert r.json()["receipt"] == "VISA **** 1111"
    saved = client.get("/me/payment-methods", headers=cust).json()
    assert saved[0]["card_last4"] == "1111" and "gateway_token" not in saved[0]

    order_id = co["order_id"]
    assert client.get(f"/orders/{order_id}", headers=cust).json()["status"] == "PLACED"
    assert client.get("/cart", headers=cust).json()["items"] == []

    # ---------- 6. webhook arrives (and is delivered twice) ----------
    with psycopg.connect(settings.database_url) as db:
        refs = db.execute("SELECT gateway_order_ref, gateway_payment_ref FROM payments WHERE payment_id = %s",
                          (co["payment_id"],)).fetchone()
    body, sig = mock_gateway.build_webhook("payment.captured", refs[1], refs[0])
    hdr = {"X-Gateway-Signature": sig, "Content-Type": "application/json"}
    assert client.post("/payments/webhooks/mockpay", content=body, headers=hdr).json()["status"] == "ok"
    assert client.post("/payments/webhooks/mockpay", content=body, headers=hdr).json()["status"] == "duplicate ignored"
    forged, _ = mock_gateway.build_webhook("payment.captured", refs[1], refs[0])
    assert client.post("/payments/webhooks/mockpay", content=forged,
                       headers={"X-Gateway-Signature": "bad", "Content-Type": "application/json"}).status_code == 401

    # ---------- 7. restaurant accepts -> dispatch offers nearest partner ----------
    owner, _ = login(client, "9845022221")
    live = client.get("/restaurant/1/orders?status=PLACED", headers=owner).json()
    assert order_id in [o["order_id"] for o in live]
    acc = client.post(f"/restaurant/1/orders/{order_id}/accept", headers=owner).json()
    assert acc["offered_to_partner"] == 301

    # ---------- 8. partner accepts, restaurant marks ready, pickup, track, deliver ----------
    partner, pinfo = login(client, "9845033331")
    offers = client.get("/partner/offers", headers=partner).json()
    offer = next(o for o in offers if o["order_id"] == order_id)
    assert client.post(f"/partner/offers/{offer['assignment_id']}/accept", headers=partner).status_code == 200
    assert client.post(f"/restaurant/1/orders/{order_id}/ready", headers=owner).status_code == 200
    assert client.post(f"/partner/orders/{order_id}/pickup", headers=partner).status_code == 200
    client.post("/partner/location", headers=partner, json={"latitude": 12.9270, "longitude": 77.5835})
    track = client.get(f"/orders/{order_id}", headers=cust).json()
    assert track["status"] == "PICKED_UP" and track["partner_location"] is not None
    assert client.post(f"/partner/orders/{order_id}/deliver", headers=partner).status_code == 200

    # ---------- 9. rating ----------
    assert client.post(f"/orders/{order_id}/rate", headers=cust,
                       json={"food_rating": 5, "delivery_rating": 5, "comment": "Great"}).status_code == 201
    final = client.get(f"/orders/{order_id}", headers=cust).json()
    assert [t["status"] for t in final["timeline"]] == [
        "PAYMENT_PENDING", "PAYMENT_FAILED", "PLACED", "ACCEPTED", "READY", "PICKED_UP", "DELIVERED"]
    assert client.get("/partner/earnings", headers=partner).json()["total"] > 0

    # role checks: customer cannot use restaurant endpoints
    assert client.get("/restaurant/1/orders", headers=cust).status_code == 403


def test_cod_flow_and_cancel_refund(client):
    ananya, _ = login(client, "9845011112")                 # seeded user with a cart at Udupi Grand
    client.post("/cart/items", headers=ananya, json={"item_id": 511, "quantity": 2, "replace_cart": True})
    co = client.post("/orders/checkout", headers=ananya, json={
        "address_id": 13, "payment_mode": "COD", "idempotency_key": str(uuid.uuid4())}).json()
    assert co["order_status"] == "PLACED"

    # card order then cancel -> refund
    client.post("/cart/items", headers=ananya, json={"item_id": 512, "quantity": 1})
    co2 = client.post("/orders/checkout", headers=ananya, json={
        "address_id": 13, "payment_mode": "CARD", "idempotency_key": str(uuid.uuid4())}).json()
    assert client.post(f"/payments/{co2['payment_id']}/pay", headers=ananya, json={"saved_method_id": 3}).status_code == 200
    r = client.post(f"/orders/{co2['order_id']}/cancel", headers=ananya, json={"reason": "Ordered by mistake"}).json()
    assert r["status"] == "CANCELLED" and r["refund"]["status"] == "PROCESSED"


def test_cvv_never_stored_or_logged(client):
    # a careless log line, to prove the redaction filter works
    logging.getLogger("api.test").warning('debug body={"card_number": "%s", "cvv": "%s"}', TEST_CARD, TEST_CVV)
    for h in logging.getLogger().handlers:
        h.flush()

    with psycopg.connect(settings.database_url) as db:
        # 1. no column anywhere looks like cvv / card number
        cols = db.execute("""SELECT table_name, column_name FROM information_schema.columns
                             WHERE table_schema = 'public'
                               AND column_name ~* '(^|_)(cvv2?|cvc2?|security_?code|card_?number|pan)($|_)'""").fetchall()
        assert cols == []
        # 2. full-text scan of every table: the card number never appears
        tables = [r[0] for r in db.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")]
        everything = ""
        for t in tables:
            for (row,) in db.execute(f'SELECT row_to_json(x)::text FROM "{t}" x'):
                everything += row + "\n"
        assert "4111111111111111" not in everything and TEST_CARD not in everything
        assert '"cvv"' not in everything.lower()

    # 3. the log file never contains the card number or the CVV value next to a cvv key
    log_text = open(settings.log_file).read()
    assert "4111111111111111" not in log_text and TEST_CARD not in log_text
    assert "1111 1111 1111" not in log_text                 # not even part of it
    assert f'"cvv": "{TEST_CVV}"' not in log_text
    assert "[CARD-REDACTED]" in log_text or "[REDACTED]" in log_text
