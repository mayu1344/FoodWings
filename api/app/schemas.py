"""Request bodies.

CVV RULE - LAYER 6 (API input)
  Every request model inherits from Strict, which has extra="forbid".
  The payment models have NO cvv / card_number field, so if a client ever sends
  {"cvv": "123"} the request is rejected with 422 before any code runs - and our
  custom error handler (errors.py) makes sure the rejected value is not echoed back
  or logged.
"""
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------- auth ----------
class OtpRequest(Strict):
    phone: str = Field(pattern=r"^\+?[0-9]{10,14}$")
    app: Optional[Literal["customer", "restaurant", "rider", "admin"]] = None
    purpose: Optional[Literal["LOGIN", "REGISTER"]] = None


class CheckPhoneIn(Strict):
    phone: str = Field(pattern=r"^\+?[0-9]{10,14}$")
    app: Literal["customer", "restaurant", "rider", "admin"] = "customer"


class RegisterIn(Strict):
    phone: str = Field(pattern=r"^\+?[0-9]{10,14}$")
    otp: str = Field(pattern=r"^[0-9]{6}$")
    app: Literal["customer", "restaurant", "rider"]
    name: str = Field(min_length=2, max_length=100)
    email: Optional[str] = Field(default=None, max_length=150, pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class LoginIn(Strict):
    phone: str = Field(pattern=r"^\+?[0-9]{10,14}$")
    otp: str = Field(pattern=r"^[0-9]{6}$")
    app: Literal["customer", "restaurant", "rider", "admin"] = "customer"


class OtpVerify(Strict):
    phone: str = Field(pattern=r"^\+?[0-9]{10,14}$")
    otp: str = Field(pattern=r"^[0-9]{6}$")
    name: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, max_length=150)
    role: Optional[Literal["CUSTOMER", "RESTAURANT_OWNER", "DELIVERY_PARTNER"]] = None
    # Role-specific fields:
    restaurant_name: Optional[str] = Field(default=None, max_length=150)
    restaurant_address: Optional[str] = None
    cuisines: Optional[str] = Field(default=None, max_length=200)
    vehicle_type: Optional[Literal["BIKE", "SCOOTER", "CYCLE", "EV"]] = "BIKE"
    vehicle_no: Optional[str] = Field(default=None, max_length=20)
    licence_no: Optional[str] = Field(default=None, max_length=30)
    city: Optional[str] = Field(default="Bengaluru", max_length=60)


# ---------- customer ----------
class AddressIn(Strict):
    label: str = "Home"
    address_line: str
    landmark: Optional[str] = None
    city: str
    latitude: Decimal
    longitude: Decimal
    is_default: bool = False


class CartItemIn(Strict):
    item_id: int
    quantity: int = Field(ge=1, le=50)
    addon_ids: list[int] = []
    replace_cart: bool = False   # True = OK to empty a cart that has another restaurant's items


class CheckoutIn(Strict):
    address_id: int
    payment_mode: Literal["CARD", "UPI", "COD"]
    coupon_code: Optional[str] = None
    special_instructions: Optional[str] = Field(default=None, max_length=300)
    idempotency_key: str = Field(min_length=8, max_length=64)   # app generates a UUID per checkout tap


class SavePaymentMethodIn(Strict):
    """What the app sends AFTER the gateway SDK tokenised the card. No card number, no CVV."""
    gateway_code: str = "MOCKPAY"
    method_type: Literal["CARD", "UPI"]
    gateway_token: str = Field(min_length=6, max_length=100)
    card_network: Optional[str] = None
    card_last4: Optional[str] = Field(default=None, pattern=r"^[0-9]{4}$")
    card_expiry_month: Optional[int] = Field(default=None, ge=1, le=12)
    card_expiry_year: Optional[int] = Field(default=None, ge=2024, le=2100)
    upi_vpa_masked: Optional[str] = None
    is_default: bool = False


class PayIn(Strict):
    """Pay for an order. Either a saved method id OR a fresh gateway token. Never raw card data."""
    saved_method_id: Optional[int] = None
    gateway_token: Optional[str] = Field(default=None, min_length=6, max_length=100)
    save_method: bool = False
    # display info returned by the gateway SDK together with the token (safe to keep)
    card_network: Optional[str] = None
    card_last4: Optional[str] = Field(default=None, pattern=r"^[0-9]{4}$")
    card_expiry_month: Optional[int] = Field(default=None, ge=1, le=12)
    card_expiry_year: Optional[int] = Field(default=None, ge=2024, le=2100)


class RatingIn(Strict):
    food_rating: int = Field(ge=1, le=5)
    delivery_rating: Optional[int] = Field(default=None, ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=500)


class CancelIn(Strict):
    reason: str = Field(default="Changed my mind", max_length=200)


# ---------- restaurant ----------
class RestaurantOnboardIn(Strict):
    name: str
    address_line: str
    city: str
    latitude: Decimal
    longitude: Decimal
    cuisines: Optional[str] = None
    fssai_no: str
    gst_no: Optional[str] = None


class ItemUpdateIn(Strict):
    in_stock: Optional[bool] = None
    price: Optional[Decimal] = Field(default=None, gt=0)


class OpenToggleIn(Strict):
    is_open: bool


# ---------- delivery partner ----------
class PartnerOnboardIn(Strict):
    vehicle_type: Literal["BIKE", "SCOOTER", "CYCLE", "EV"]
    vehicle_no: str
    licence_no: str
    city: str


class OnlineIn(Strict):
    is_online: bool


class DeliverIn(Strict):
    cash_collected: bool = False     # must be true for cash-on-delivery orders


class LocationIn(Strict):
    latitude: Decimal
    longitude: Decimal
