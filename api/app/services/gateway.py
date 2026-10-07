"""Payment gateway client used by OUR backend.

Our backend only ever handles: amount, gateway order id, TOKEN, gateway payment id.
To go live, write a RazorpayGateway / StripeGateway class with the same 4 methods
and return it from get_gateway(). Nothing else in the code changes.
"""
import hmac
from decimal import Decimal

from ..config import settings
from .. import mock_gateway

# Only these keys from a gateway response are ever saved in payment_transactions.
# Anything else (and certainly any card data) is dropped before it reaches the DB.
_SAFE_KEYS = {"id", "status", "amount", "currency", "method", "order_id", "error_code",
              "error_description", "vpa", "payment_id"}
_SAFE_CARD_KEYS = {"network", "last4"}


def sanitize(resp: dict) -> dict:
    """CVV RULE - LAYER 8: whitelist what we store from gateway responses / webhooks."""
    clean = {k: v for k, v in resp.items() if k in _SAFE_KEYS and not isinstance(v, (dict, list))}
    if isinstance(resp.get("card"), dict):
        clean["card"] = {k: v for k, v in resp["card"].items() if k in _SAFE_CARD_KEYS}
    if isinstance(resp.get("payload"), dict):
        clean["payload"] = {k: v for k, v in resp["payload"].items() if k in _SAFE_KEYS}
    if "event" in resp:
        clean["event"] = resp["event"]
    return clean


def to_paise(amount: Decimal) -> int:
    return int((Decimal(amount) * 100).quantize(Decimal("1")))


class MockPayGateway:
    code = "MOCKPAY"

    def create_order(self, amount: Decimal, receipt: str) -> dict:
        return mock_gateway.create_order(to_paise(amount), receipt)

    def charge(self, token: str, gateway_order_ref: str, amount: Decimal) -> dict:
        return mock_gateway.charge(token, gateway_order_ref, to_paise(amount))

    def refund(self, gateway_payment_ref: str, amount: Decimal) -> dict:
        return mock_gateway.refund(gateway_payment_ref, to_paise(amount))

    def verify_webhook(self, body: bytes, signature: str) -> bool:
        return hmac.compare_digest(mock_gateway.sign_webhook(body), signature or "")


def get_gateway(code: str = "MOCKPAY"):
    if code == "MOCKPAY" and settings.enable_mock_gateway:
        return MockPayGateway()
    raise RuntimeError(f"Gateway {code} is not configured. Add its client class in services/gateway.py")
