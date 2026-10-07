"""Mock payment gateway pretending to be Razorpay / Stripe."""
import hashlib
import hmac
import json
import secrets
import time
import uuid
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, SecretStr

from .config import settings

router = APIRouter(prefix="/mock-gateway/v1", tags=["Mock payment gateway"])

_VAULT: dict[str, dict] = {}
_ORDERS: dict[str, dict] = {}
DECLINE_CARDS = {"4000000000000002"}


class CardIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    card_number: SecretStr
    expiry_month: int = Field(ge=1, le=12)
    expiry_year: int = Field(ge=2024, le=2100)
    cvv: SecretStr
    name_on_card: str = ""


class UpiIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vpa: str = Field(pattern=r"^[\w.\-]{2,}@[a-zA-Z]{2,}$")


def _luhn(num: str) -> bool:
    total, dbl = 0, False
    for ch in reversed(num):
        d = int(ch)
        if dbl:
            d = d * 2 - 9 if d * 2 > 9 else d * 2
        total += d
        dbl = not dbl
    return total % 10 == 0


def _network(num: str) -> str:
    if num.startswith("4"):
        return "VISA"
    if num[:2] in {"51", "52", "53", "54", "55"} or num[:4].isdigit() and 2221 <= int(num[:4]) <= 2720:
        return "MASTERCARD"
    if num[:2] in {"34", "37"}:
        return "AMEX"
    if num[:2] in {"60", "65", "81", "82"}:
        return "RUPAY"
    return "OTHER"


@router.post("/tokenize")
def tokenize_card(card: CardIn):
    number = card.card_number.get_secret_value().replace(" ", "").replace("-", "")
    cvv = card.cvv.get_secret_value()
    if not (number.isdigit() and 13 <= len(number) <= 19 and _luhn(number)):
        raise HTTPException(400, "Invalid card number")
    if not (cvv.isdigit() and len(cvv) in (3, 4)):
        raise HTTPException(400, "Invalid CVV")
    if date(card.expiry_year, card.expiry_month, 1) < date.today().replace(day=1):
        raise HTTPException(400, "Card expired")
    del cvv
    token = "tok_mock_" + secrets.token_hex(6)
    _VAULT[token] = {
        "type": "CARD", "network": _network(number), "last4": number[-4:],
        "exp_month": card.expiry_month, "exp_year": card.expiry_year,
        "decline": number in DECLINE_CARDS,
    }
    del number
    v = _VAULT[token]
    return {"token": token, "network": v["network"], "last4": v["last4"],
            "expiry_month": v["exp_month"], "expiry_year": v["exp_year"]}


@router.post("/upi/tokenize")
def tokenize_upi(body: UpiIn):
    token = "tok_mock_upi_" + secrets.token_hex(4)
    name, bank = body.vpa.split("@")
    _VAULT[token] = {"type": "UPI", "vpa_masked": f"{name[:2]}****@{bank}", "decline": name.startswith("fail")}
    return {"token": token, "vpa_masked": _VAULT[token]["vpa_masked"]}


def create_order(amount_paise: int, receipt: str) -> dict:
    ref = "mock_order_" + uuid.uuid4().hex[:12]
    _ORDERS[ref] = {"amount": amount_paise, "receipt": receipt, "status": "created"}
    return {"id": ref, "status": "created", "amount": amount_paise, "currency": "INR"}


def register_seed_token(token: str, info: dict) -> None:
    _VAULT.setdefault(token, info)


def init_mock_gateway() -> None:
    register_seed_token("tok_mock_7f3a9c1e2b4d",
        {"type": "CARD", "network": "VISA", "last4": "1111", "exp_month": 12, "exp_year": 2029, "decline": False})
    register_seed_token("tok_mock_88d1e0f4a6c2",
        {"type": "CARD", "network": "MASTERCARD", "last4": "4444", "exp_month": 8, "exp_year": 2028, "decline": False})
    register_seed_token("tok_mock_upi_51ac0e9d",
        {"type": "UPI", "vpa_masked": "ra****@okaxis", "decline": False})


def charge(token: str, gateway_order_ref: str, amount_paise: int) -> dict:
    v = _VAULT.get(token)
    order = _ORDERS.get(gateway_order_ref)
    if v is None:
        return {"status": "failed", "error_code": "INVALID_TOKEN", "error_description": "Unknown payment token"}
    if order is None or order["amount"] != amount_paise:
        return {"status": "failed", "error_code": "ORDER_MISMATCH", "error_description": "Order/amount mismatch"}
    if v["decline"]:
        return {"status": "failed", "error_code": "CARD_DECLINED" if v["type"] == "CARD" else "UPI_DECLINED",
                "error_description": "Declined by issuer"}
    order["status"] = "paid"
    resp = {"id": "mock_pay_" + uuid.uuid4().hex[:12], "status": "captured", "amount": amount_paise,
            "currency": "INR", "method": v["type"].lower(), "order_id": gateway_order_ref}
    if v["type"] == "CARD":
        resp["card"] = {"network": v["network"], "last4": v["last4"]}
    else:
        resp["vpa"] = v["vpa_masked"]
    return resp


def refund(gateway_payment_ref: str, amount_paise: int) -> dict:
    return {"id": "mock_rfnd_" + uuid.uuid4().hex[:10], "status": "processed",
            "payment_id": gateway_payment_ref, "amount": amount_paise}


def sign_webhook(body: bytes) -> str:
    return hmac.new(settings.mockpay_webhook_secret.encode(), body, hashlib.sha256).hexdigest()


def build_webhook(event_type: str, gateway_payment_ref: str, gateway_order_ref: str) -> tuple[bytes, str]:
    body = json.dumps({"id": "evt_" + uuid.uuid4().hex[:12], "event": event_type, "created_at": int(time.time()),
                       "payload": {"payment_id": gateway_payment_ref, "order_id": gateway_order_ref}}).encode()
    return body, sign_webhook(body)
