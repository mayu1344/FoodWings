"""
================================================================================
🍗 FOODWINGS (Swiggy Clone) - FASTAPI SINGLE-FILE BACKEND
================================================================================
This file contains the complete backend API for FoodWings.
All endpoints for all 4 roles (Customer, Restaurant Owner, Delivery Partner, Admin)
are organized here in clean, easy-to-follow sections.

TABLE OF CONTENTS:
  1. Setup, Database, and Logging
  2. Security, JWT Tokens & Role Checking
  3. Authentication & User Profile Endpoints (/auth/*)
  4. Customer Endpoints (/restaurants, /menu, /me/addresses, /cart)
  5. Order & Checkout Endpoints (/orders/*, /me/orders)
  6. Payment & Webhook Endpoints (/payments/*)
  7. Restaurant Owner Endpoints (/restaurants/onboard, /restaurant/*)
  8. Delivery Partner / Rider Endpoints (/partners/onboard, /partner/*)
  9. Admin Approval Endpoints (/admin/*)
  10. Mock Payment Gateway Endpoints (/mock-gateway/*)
  11. Health Check & Frontend Static Serving
================================================================================
"""

import json
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import FastAPI, Depends, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import pool, open_pool, close_pool, get_conn, transaction
from .errors import install_error_handlers
from .logging_setup import setup_logging
from .schemas import (
    AddressIn, CancelIn, CartItemIn, CheckPhoneIn, DeliverIn, ItemUpdateIn,
    LocationIn, LoginIn, OnlineIn, OpenToggleIn, OtpRequest, OtpVerify,
    PartnerOnboardIn, PayIn, RatingIn, RegisterIn, RestaurantOnboardIn,
    SavePaymentMethodIn, CheckoutIn
)
from .security import (
    CurrentUser, create_token, current_user, hash_otp, require_roles
)
from .services.gateway import get_gateway, sanitize
from .services.order_flow import change_status, offer_to_nearest_partner, compute_coupon_discount

# ==============================================================================
# 1. SETUP, LOGGING, AND LIFECYCLE
# ==============================================================================

# Setup logging filter to prevent card numbers and CVVs from ever being printed
setup_logging(settings.log_file)
log = logging.getLogger("api.main")

# Role definitions for endpoint security
Customer = require_roles("CUSTOMER")
Staff = require_roles("RESTAURANT_OWNER", "RESTAURANT_STAFF")
Partner = require_roles("DELIVERY_PARTNER")
Admin = require_roles("ADMIN")

# Haversine SQL formula to compute distance in kilometers
HAVERSINE_KM = """
  6371 * acos(least(1.0, cos(radians(%(lat)s)) * cos(radians(r.latitude))
       * cos(radians(r.longitude) - radians(%(lng)s)) + sin(radians(%(lat)s)) * sin(radians(r.latitude))))
"""

def money(x) -> Decimal:
    """Format decimal money amounts to 2 decimal places."""
    return Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def _json(obj) -> str:
    """Safely serialize objects to JSON string."""
    return json.dumps(obj, default=str)


# Database lifecycle: open on startup, close on shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    open_pool()
    if settings.enable_mock_gateway:
        # Load mock card gateway tokens
        from .mock_gateway import init_mock_gateway
        init_mock_gateway()
    yield
    close_pool()


# Create FastAPI application
app = FastAPI(
    title="FoodWings Food Delivery API",
    description="Unified backend supporting Customer, Restaurant Owner, Delivery Partner, and Admin apps.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for browser frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# Install secure error handlers
install_error_handlers(app)


# ==============================================================================
# 2. HELPER FUNCTIONS
# ==============================================================================

def roles_of(conn, user_id: int) -> list[str]:
    """Fetch all assigned role names for a given user."""
    rows = conn.execute(
        "SELECT r.role_name FROM user_roles ur JOIN roles r USING (role_id) WHERE ur.user_id = %s ORDER BY r.role_id",
        (user_id,),
    ).fetchall()
    return [r["role_name"] for r in rows]

def mask_name(name: str | None) -> str | None:
    """Mask a user's name for privacy (e.g. 'Ravi Kumar' -> 'Ra********')."""
    if not name:
        return None
    name = name.strip()
    if len(name) <= 2:
        return name[0] + "*" * (len(name) - 1) if len(name) > 1 else name + "*"
    return name[:2] + "*" * (len(name) - 2)

def consume_otp(conn, phone: str, otp: str) -> None:
    """Validate and consume an OTP in a single-use manner."""
    wrong_otp = False
    with transaction(conn):
        req = conn.execute(
            """SELECT * FROM otp_requests WHERE phone = %s AND NOT verified
               ORDER BY created_at DESC LIMIT 1 FOR UPDATE""",
            (phone,),
        ).fetchone()
        if not req or req["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(400, "OTP expired, request a new one")
        if req["attempts"] >= 5:
            raise HTTPException(429, "Too many attempts")
        if req["otp_hash"] != hash_otp(phone, otp):
            conn.execute("UPDATE otp_requests SET attempts = attempts + 1 WHERE otp_id = %s", (req["otp_id"],))
            wrong_otp = True
        else:
            conn.execute("UPDATE otp_requests SET verified = TRUE WHERE otp_id = %s", (req["otp_id"],))
    if wrong_otp:
        raise HTTPException(400, "Wrong OTP")

def assert_staff(conn, restaurant_id: int, user_id: int) -> None:
    """Verify that the user is authorized staff for this restaurant."""
    if not conn.execute("SELECT 1 FROM restaurant_staff WHERE restaurant_id = %s AND user_id = %s",
                        (restaurant_id, user_id)).fetchone():
        raise HTTPException(403, "You are not staff of this restaurant")

def _partner(conn, user_id: int) -> dict:
    """Fetch delivery partner details for a user."""
    p = conn.execute("SELECT * FROM delivery_partners WHERE partner_id = %s", (user_id,)).fetchone()
    if not p:
        raise HTTPException(404, "Not registered as a partner")
    return p

def _can_view_order(conn, user: CurrentUser, order: dict) -> bool:
    """Verify if user is allowed to view tracking details of this order."""
    if order["customer_id"] == user.user_id or order["partner_id"] == user.user_id or "ADMIN" in user.roles:
        return True
    return conn.execute("SELECT 1 FROM restaurant_staff WHERE restaurant_id = %s AND user_id = %s",
                        (order["restaurant_id"], user.user_id)).fetchone() is not None


# ==============================================================================
# 3. AUTHENTICATION ENDPOINTS (/auth/*)
# ==============================================================================

@app.post("/auth/otp/request", tags=["1. Auth"])
def request_otp(body: OtpRequest, conn=Depends(get_conn)):
    """Generate a 6-digit OTP, store its SHA-256 hash, and enforce rate limits."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    recent_cnt = conn.execute(
        "SELECT COUNT(*) AS cnt FROM otp_requests WHERE phone = %s AND created_at >= %s",
        (body.phone, cutoff),
    ).fetchone()["cnt"]
    if recent_cnt >= 5:
        raise HTTPException(429, "Too many OTP requests. Please wait a few minutes.")

    masked_phone = f"...{body.phone[-4:]}" if len(body.phone) >= 4 else "..."
    log.info("OTP requested for %s app=%s purpose=%s", masked_phone, body.app, body.purpose)

    otp = f"{secrets.randbelow(1_000_000):06d}"
    conn.execute(
        "INSERT INTO otp_requests (phone, otp_hash, expires_at) VALUES (%s, %s, %s)",
        (body.phone, hash_otp(body.phone, otp), datetime.now(timezone.utc) + timedelta(minutes=5)),
    )
    resp = {"message": "OTP sent", "expires_in_seconds": 300}
    if settings.otp_dev_mode:
        resp["dev_otp"] = otp
    return resp


@app.post("/auth/check-phone", tags=["1. Auth"])
def check_phone(body: CheckPhoneIn, conn=Depends(get_conn)):
    """Check if a phone number is registered and whether it has access to the specified app."""
    user = conn.execute("SELECT user_id, name, is_active FROM users WHERE phone = %s", (body.phone,)).fetchone()
    if not user:
        return {"exists": False, "has_app_role": False, "name": None}

    roles = roles_of(conn, user["user_id"])
    if body.app == "customer":
        has_role = "CUSTOMER" in roles
    elif body.app == "restaurant":
        has_role = "RESTAURANT_OWNER" in roles or "RESTAURANT_STAFF" in roles
    elif body.app == "rider":
        has_role = "DELIVERY_PARTNER" in roles
    elif body.app == "admin":
        has_role = "ADMIN" in roles
    else:
        has_role = False

    return {"exists": True, "has_app_role": has_role, "name": mask_name(user["name"])}


@app.post("/auth/register", tags=["1. Auth"])
def register(body: RegisterIn, conn=Depends(get_conn)):
    """Register a new user account with phone + OTP verification."""
    consume_otp(conn, body.phone, body.otp)

    with transaction(conn):
        user = conn.execute("SELECT * FROM users WHERE phone = %s FOR UPDATE", (body.phone,)).fetchone()
        if user:
            if not user["is_active"]:
                raise HTTPException(403, "Account blocked")
            current_roles = roles_of(conn, user["user_id"])
            if body.app == "customer" and "CUSTOMER" in current_roles:
                raise HTTPException(409, "Already registered for this app. Please log in.")
            if body.app == "restaurant" and ("RESTAURANT_OWNER" in current_roles or "RESTAURANT_STAFF" in current_roles):
                raise HTTPException(409, "Already registered for this app. Please log in.")
            if body.app == "rider" and "DELIVERY_PARTNER" in current_roles:
                raise HTTPException(409, "Already registered for this app. Please log in.")

            if body.email and not user["email"]:
                email_exists = conn.execute(
                    "SELECT user_id FROM users WHERE email = %s AND user_id != %s",
                    (body.email, user["user_id"]),
                ).fetchone()
                if email_exists:
                    raise HTTPException(409, "Email already in use")

            new_name = user["name"] or body.name
            new_email = user["email"] or body.email
            conn.execute(
                "UPDATE users SET name = %s, email = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
                (new_name, new_email, user["user_id"]),
            )
            user_id = user["user_id"]
            final_name = new_name
        else:
            if body.email:
                email_exists = conn.execute("SELECT user_id FROM users WHERE email = %s", (body.email,)).fetchone()
                if email_exists:
                    raise HTTPException(409, "Email already in use")

            user_row = conn.execute(
                "INSERT INTO users (phone, name, email) VALUES (%s, %s, %s) RETURNING user_id",
                (body.phone, body.name, body.email),
            ).fetchone()
            user_id = user_row["user_id"]
            final_name = body.name

        if body.app == "customer":
            conn.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, 1) ON CONFLICT DO NOTHING", (user_id,))
            current_roles = roles_of(conn, user_id)
            next_step = "ADD_ADDRESS"
        elif body.app == "restaurant":
            current_roles = roles_of(conn, user_id)
            next_step = "RESTAURANT_DETAILS"
        elif body.app == "rider":
            current_roles = roles_of(conn, user_id)
            next_step = "RIDER_DETAILS"

        token = create_token(user_id, current_roles)
        return {
            "token": token,
            "user_id": user_id,
            "name": final_name,
            "roles": current_roles,
            "app": body.app,
            "next_step": next_step,
        }


@app.post("/auth/login", tags=["1. Auth"])
def login(body: LoginIn, conn=Depends(get_conn)):
    """Log into an existing account with phone + OTP."""
    consume_otp(conn, body.phone, body.otp)

    user = conn.execute("SELECT * FROM users WHERE phone = %s", (body.phone,)).fetchone()
    if not user:
        raise HTTPException(404, detail={"code": "USER_NOT_FOUND", "message": "No account for this number. Please register first."})
    if not user["is_active"]:
        raise HTTPException(403, "Account blocked")

    user_id = user["user_id"]
    name = user["name"]
    roles = roles_of(conn, user_id)

    if body.app == "customer":
        if "CUSTOMER" not in roles:
            raise HTTPException(403, detail={"code": "ROLE_MISSING", "message": "This account is not registered for the customer app"})
        status = "ACTIVE"
        next_step = "HOME"

    elif body.app == "restaurant":
        staff = conn.execute(
            """SELECT rs.staff_role, r.restaurant_id, r.status
               FROM restaurant_staff rs
               JOIN restaurants r USING (restaurant_id)
               WHERE rs.user_id = %s
               ORDER BY rs.assigned_at DESC LIMIT 1""",
            (user_id,),
        ).fetchone()
        if not staff:
            return {
                "token": create_token(user_id, roles),
                "user_id": user_id,
                "name": name,
                "roles": roles,
                "app": body.app,
                "next_step": "RESTAURANT_DETAILS",
                "status": None,
            }
        if "RESTAURANT_OWNER" not in roles and "RESTAURANT_STAFF" not in roles:
            raise HTTPException(403, detail={"code": "ROLE_MISSING", "message": "This account is not registered for the restaurant app"})
        status = staff["status"]
        if status == "PENDING":
            next_step = "WAIT_FOR_APPROVAL"
        elif status == "ACTIVE":
            next_step = "HOME"
        elif status in ("SUSPENDED", "CLOSED"):
            next_step = "REJECTED"
        else:
            next_step = "HOME"

    elif body.app == "rider":
        partner = conn.execute("SELECT * FROM delivery_partners WHERE partner_id = %s", (user_id,)).fetchone()
        if not partner:
            return {
                "token": create_token(user_id, roles),
                "user_id": user_id,
                "name": name,
                "roles": roles,
                "app": body.app,
                "next_step": "RIDER_DETAILS",
                "status": None,
            }
        if "DELIVERY_PARTNER" not in roles:
            raise HTTPException(403, detail={"code": "ROLE_MISSING", "message": "This account is not registered for the rider app"})
        status = partner["kyc_status"]
        if status == "PENDING_KYC":
            next_step = "WAIT_FOR_APPROVAL"
        elif status == "VERIFIED":
            next_step = "HOME"
        elif status == "REJECTED":
            next_step = "REJECTED"
        else:
            next_step = "HOME"

    elif body.app == "admin":
        if "ADMIN" not in roles:
            raise HTTPException(403, detail={"code": "ROLE_MISSING", "message": "This account is not registered for the admin app"})
        status = "ACTIVE"
        next_step = "HOME"
    else:
        raise HTTPException(400, "Invalid app")

    token = create_token(user_id, roles)
    return {
        "token": token,
        "user_id": user_id,
        "name": name,
        "roles": roles,
        "app": body.app,
        "next_step": next_step,
        "status": status,
    }


@app.post("/auth/refresh", tags=["1. Auth"])
def refresh_token(user: CurrentUser = Depends(current_user), conn=Depends(get_conn)):
    """Refresh JWT token with updated database roles after onboarding or admin approvals."""
    u = conn.execute("SELECT user_id, name FROM users WHERE user_id = %s", (user.user_id,)).fetchone()
    if not u:
        raise HTTPException(404, "User not found")
    roles = roles_of(conn, user.user_id)
    token = create_token(user.user_id, roles)
    return {"token": token, "user_id": user.user_id, "name": u["name"], "roles": roles}


@app.post("/auth/otp/verify", tags=["1. Auth"])
def verify_otp(body: OtpVerify, conn=Depends(get_conn)):
    """Legacy OTP verify endpoint maintained for backward compatibility."""
    consume_otp(conn, body.phone, body.otp)

    with transaction(conn):
        user = conn.execute("SELECT * FROM users WHERE phone = %s", (body.phone,)).fetchone()
        is_new = user is None
        if is_new:
            user = conn.execute(
                "INSERT INTO users (phone, name, email) VALUES (%s, %s, %s) RETURNING *",
                (body.phone, body.name or "New User", body.email),
            ).fetchone()
        elif body.name or body.email:
            conn.execute(
                "UPDATE users SET name = COALESCE(%s, name), email = COALESCE(%s, email) WHERE user_id = %s",
                (body.name, body.email, user["user_id"]),
            )
            user = conn.execute("SELECT * FROM users WHERE user_id = %s", (user["user_id"],)).fetchone()

        if not user["is_active"]:
            raise HTTPException(403, "Account blocked")

        target_role = body.role or "CUSTOMER"
        role_map = {"CUSTOMER": 1, "RESTAURANT_OWNER": 2, "RESTAURANT_STAFF": 3, "DELIVERY_PARTNER": 4, "ADMIN": 5}
        target_role_id = role_map.get(target_role, 1)
        conn.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (user["user_id"], target_role_id))
        conn.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, 1) ON CONFLICT DO NOTHING", (user["user_id"],))

        roles = roles_of(conn, user["user_id"])
    return {
        "token": create_token(user["user_id"], roles),
        "user_id": user["user_id"],
        "name": user["name"],
        "roles": roles,
        "new_user": is_new,
    }


@app.get("/auth/me", tags=["1. Auth"])
def me(user: CurrentUser = Depends(current_user), conn=Depends(get_conn)):
    """Return current logged-in user profile and roles."""
    u = conn.execute("SELECT user_id, name, phone, email FROM users WHERE user_id = %s", (user.user_id,)).fetchone()
    if not u:
        raise HTTPException(404, "User not found")
    return {**u, "roles": roles_of(conn, user.user_id)}


# ==============================================================================
# 4. CUSTOMER ENDPOINTS (Browse, Addresses, Cart)
# ==============================================================================

@app.get("/restaurants", tags=["2. Customer"])
def list_restaurants(address_id: int, user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """List open, active restaurants within search radius of the given address."""
    addr = conn.execute("SELECT * FROM addresses WHERE address_id = %s AND user_id = %s",
                        (address_id, user.user_id)).fetchone()
    if not addr:
        raise HTTPException(404, "Address not found")
    rows = conn.execute(
        f"""SELECT r.restaurant_id, r.name, r.cuisines, r.avg_rating, r.avg_prep_mins,
                   round(({HAVERSINE_KM})::numeric, 2) AS distance_km
            FROM restaurants r
            WHERE r.status = 'ACTIVE' AND r.is_open AND r.city = %(city)s
              AND ({HAVERSINE_KM}) <= %(radius)s
            ORDER BY distance_km""",
        {"lat": addr["latitude"], "lng": addr["longitude"], "city": addr["city"], "radius": settings.search_radius_km},
    ).fetchall()
    for r in rows:
        r["eta_mins"] = int(r["avg_prep_mins"] + float(r["distance_km"]) * 4 + 5)
    return rows


@app.get("/restaurants/{restaurant_id}/menu", tags=["2. Customer"])
def get_restaurant_menu(restaurant_id: int, conn=Depends(get_conn)):
    """Get full menu structure (categories, dishes, addons) for a restaurant."""
    rest = conn.execute("SELECT restaurant_id, name, is_open, status FROM restaurants WHERE restaurant_id = %s",
                        (restaurant_id,)).fetchone()
    if not rest or rest["status"] != "ACTIVE":
        raise HTTPException(404, "Restaurant not found")
    items = conn.execute(
        """SELECT c.category_id, c.name AS category, i.item_id, i.name, i.description, i.price, i.is_veg, i.in_stock,
                  COALESCE(jsonb_agg(jsonb_build_object('addon_id', a.addon_id, 'name', a.name, 'price', a.price))
                           FILTER (WHERE a.addon_id IS NOT NULL AND a.in_stock), '[]') AS addons
           FROM menu_items i
           JOIN menu_categories c ON c.category_id = i.category_id
           LEFT JOIN item_addons a ON a.item_id = i.item_id
           WHERE i.restaurant_id = %s
           GROUP BY c.category_id, c.name, c.sort_order, i.item_id
           ORDER BY c.sort_order, i.name""",
        (restaurant_id,),
    ).fetchall()
    categories: dict = {}
    for it in items:
        cat = categories.setdefault(it["category_id"], {"category": it.pop("category"), "items": []})
        it.pop("category_id")
        cat["items"].append(it)
    return {"restaurant": rest, "menu": list(categories.values())}


@app.get("/me/addresses", tags=["2. Customer"])
def list_addresses(user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """List saved delivery addresses for the logged-in customer."""
    return conn.execute("SELECT * FROM addresses WHERE user_id = %s ORDER BY is_default DESC, address_id DESC",
                        (user.user_id,)).fetchall()


@app.post("/me/addresses", status_code=201, tags=["2. Customer"])
def add_address(body: AddressIn, user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """Save a new delivery address."""
    with transaction(conn):
        if body.is_default:
            conn.execute("UPDATE addresses SET is_default = FALSE WHERE user_id = %s", (user.user_id,))
        row = conn.execute(
            """INSERT INTO addresses (user_id, label, address_line, landmark, city, latitude, longitude, is_default)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            (user.user_id, body.label, body.address_line, body.landmark, body.city,
             body.latitude, body.longitude, body.is_default),
        ).fetchone()
    return row


# ---------------- cart ----------------
def _cart(conn, user_id: int) -> dict:
    cart = conn.execute("SELECT * FROM carts WHERE user_id = %s", (user_id,)).fetchone()
    if not cart:
        return {"cart_id": None, "restaurant_id": None, "items": [], "item_total": 0}
    items = conn.execute(
        """SELECT ci.cart_item_id, ci.item_id, i.name, i.price, ci.quantity, ci.selected_addons, i.in_stock,
                  ci.quantity * (i.price + COALESCE((SELECT sum(a.price) FROM item_addons a
                       WHERE a.addon_id IN (SELECT jsonb_array_elements_text(ci.selected_addons)::bigint)), 0)) AS line_total
           FROM cart_items ci JOIN menu_items i USING (item_id)
           WHERE ci.cart_id = %s ORDER BY ci.cart_item_id""",
        (cart["cart_id"],),
    ).fetchall()
    return {"cart_id": cart["cart_id"], "restaurant_id": cart["restaurant_id"], "items": items,
            "item_total": float(sum(i["line_total"] for i in items))}


@app.get("/cart", tags=["2. Customer"])
def get_cart(user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """Fetch customer's active shopping cart and calculate real-time totals."""
    return _cart(conn, user.user_id)


@app.post("/cart/items", status_code=201, tags=["2. Customer"])
def add_to_cart(body: CartItemIn, user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """Add a menu item to cart, enforcing single-restaurant rules."""
    item = conn.execute(
        """SELECT i.*, r.status AS r_status, r.is_open FROM menu_items i
           JOIN restaurants r USING (restaurant_id) WHERE i.item_id = %s""", (body.item_id,)
    ).fetchone()
    if not item or item["r_status"] != "ACTIVE":
        raise HTTPException(404, "Item not found")
    if not item["in_stock"]:
        raise HTTPException(409, "Item is sold out")
    if body.addon_ids:
        n = conn.execute("SELECT count(*) AS n FROM item_addons WHERE item_id = %s AND addon_id = ANY(%s) AND in_stock",
                         (body.item_id, body.addon_ids)).fetchone()["n"]
        if n != len(set(body.addon_ids)):
            raise HTTPException(400, "Invalid add-on for this item")

    with transaction(conn):
        cart = conn.execute("SELECT * FROM carts WHERE user_id = %s FOR UPDATE", (user.user_id,)).fetchone()
        if cart and cart["restaurant_id"] not in (None, item["restaurant_id"]):
            has_items = conn.execute("SELECT 1 FROM cart_items WHERE cart_id = %s LIMIT 1", (cart["cart_id"],)).fetchone()
            if has_items and not body.replace_cart:
                raise HTTPException(409, "Cart has items from another restaurant. Send replace_cart=true to start a new cart.")
            conn.execute("DELETE FROM cart_items WHERE cart_id = %s", (cart["cart_id"],))
        cart = conn.execute(
            """INSERT INTO carts (user_id, restaurant_id) VALUES (%s, %s)
               ON CONFLICT (user_id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, updated_at = now()
               RETURNING *""",
            (user.user_id, item["restaurant_id"]),
        ).fetchone()
        addons = sorted(set(body.addon_ids))
        conn.execute(
            """INSERT INTO cart_items (cart_id, item_id, quantity, selected_addons)
               VALUES (%s, %s, %s, to_jsonb(%s::bigint[]))
               ON CONFLICT (cart_id, item_id, selected_addons) DO UPDATE SET quantity = EXCLUDED.quantity""",
            (cart["cart_id"], body.item_id, body.quantity, addons),
        )
    return _cart(conn, user.user_id)


@app.delete("/cart/items/{cart_item_id}", tags=["2. Customer"])
def remove_from_cart(cart_item_id: int, user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """Remove a dish from cart."""
    conn.execute(
        "DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.cart_id AND c.user_id = %s AND ci.cart_item_id = %s",
        (user.user_id, cart_item_id),
    )
    return _cart(conn, user.user_id)


@app.get("/me/payment-methods", tags=["2. Customer"])
def list_payment_methods(user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """List saved cards / tokens for the user (only token, brand, last 4 digits stored)."""
    return conn.execute(
        """SELECT method_id, method_type, card_network, card_last4, card_expiry_month, card_expiry_year,
                  upi_vpa_masked, is_default
           FROM saved_payment_methods WHERE user_id = %s ORDER BY is_default DESC, method_id DESC""",
        (user.user_id,),
    ).fetchall()


# ==============================================================================
# 5. ORDER & CHECKOUT ENDPOINTS (/orders/*)
# ==============================================================================

@app.post("/orders/checkout", status_code=201, tags=["3. Orders"])
def checkout(body: CheckoutIn, user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """Place an order from the active cart in ONE atomic transaction."""
    # Check idempotency
    existing = conn.execute(
        "SELECT p.*, o.status AS order_status FROM payments p JOIN orders o USING (order_id) WHERE p.idempotency_key = %s",
        (body.idempotency_key,),
    ).fetchone()
    if existing:
        if existing["user_id"] != user.user_id:
            raise HTTPException(409, "Idempotency key already used")
        return {"order_id": existing["order_id"], "payment_id": existing["payment_id"],
                "order_status": existing["order_status"], "amount": existing["amount"], "duplicate": True}

    with transaction(conn):
        addr = conn.execute("SELECT * FROM addresses WHERE address_id = %s AND user_id = %s",
                            (body.address_id, user.user_id)).fetchone()
        if not addr:
            raise HTTPException(404, "Address not found")
        cart = conn.execute("SELECT * FROM carts WHERE user_id = %s FOR UPDATE", (user.user_id,)).fetchone()
        if not cart:
            raise HTTPException(400, "Cart is empty")
        lines = conn.execute(
            """SELECT ci.item_id, ci.quantity, ci.selected_addons, i.name, i.price, i.in_stock, i.restaurant_id
               FROM cart_items ci JOIN menu_items i USING (item_id) WHERE ci.cart_id = %s""",
            (cart["cart_id"],),
        ).fetchall()
        if not lines:
            raise HTTPException(400, "Cart is empty")
        rest = conn.execute("SELECT * FROM restaurants WHERE restaurant_id = %s", (cart["restaurant_id"],)).fetchone()
        if rest["status"] != "ACTIVE" or not rest["is_open"]:
            raise HTTPException(409, "Restaurant is closed right now")
        sold_out = [l["name"] for l in lines if not l["in_stock"]]
        if sold_out:
            raise HTTPException(409, f"Sold out: {', '.join(sold_out)}")

        order_lines, item_total = [], Decimal("0")
        for l in lines:
            ids = [int(a) for a in l["selected_addons"]]
            addons = conn.execute("SELECT addon_id, name, price FROM item_addons WHERE addon_id = ANY(%s)", (ids,)).fetchall() if ids else []
            unit = Decimal(l["price"]) + sum(Decimal(a["price"]) for a in addons)
            line_total = unit * l["quantity"]
            item_total += line_total
            order_lines.append((l, addons, line_total))

        coupon = None
        if body.coupon_code:
            coupon = conn.execute(
                "SELECT * FROM coupons WHERE code = %s AND is_active AND now() BETWEEN valid_from AND valid_till",
                (body.coupon_code.upper(),),
            ).fetchone()
            if not coupon:
                raise HTTPException(400, "Coupon is invalid or expired")
        discount = money(compute_coupon_discount(coupon, item_total))
        delivery_fee = money(settings.delivery_fee)
        platform_fee = money(settings.platform_fee)
        taxes = money(item_total * Decimal(settings.tax_pct) / 100)
        total = money(item_total + delivery_fee + platform_fee + taxes - discount)

        is_cod = body.payment_mode == "COD"
        order = conn.execute(
            """INSERT INTO orders (customer_id, restaurant_id, address_id, coupon_id, item_total, delivery_fee,
                   platform_fee, taxes, discount, total_amount, payment_mode, status, special_instructions)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            (user.user_id, rest["restaurant_id"], addr["address_id"], coupon["coupon_id"] if coupon else None,
             item_total, delivery_fee, platform_fee, taxes, discount, total, body.payment_mode,
             "PLACED" if is_cod else "PAYMENT_PENDING", body.special_instructions),
        ).fetchone()
        for l, addons, line_total in order_lines:
            conn.execute(
                """INSERT INTO order_items (order_id, item_id, item_name, quantity, price_at_order, addons, line_total)
                   VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s)""",
                (order["order_id"], l["item_id"], l["name"], l["quantity"], l["price"],
                 _json([{"addon_id": a["addon_id"], "name": a["name"], "price": float(a["price"])} for a in addons]),
                 line_total),
            )
        conn.execute("INSERT INTO order_status_history (order_id, status, changed_by) VALUES (%s,%s,%s)",
                     (order["order_id"], order["status"], user.user_id))

        if is_cod:
            payment = conn.execute(
                """INSERT INTO payments (order_id, user_id, method_type, amount, status, idempotency_key)
                   VALUES (%s,%s,'COD',%s,'COD_PENDING',%s) RETURNING *""",
                (order["order_id"], user.user_id, total, body.idempotency_key),
            ).fetchone()
            conn.execute("DELETE FROM cart_items WHERE cart_id = %s", (cart["cart_id"],))
            gateway_order = None
        else:
            gw_row = conn.execute("SELECT * FROM payment_gateways WHERE is_active ORDER BY priority LIMIT 1").fetchone()
            gw = get_gateway(gw_row["code"])
            gateway_order = gw.create_order(total, receipt=f"order_{order['order_id']}")
            payment = conn.execute(
                """INSERT INTO payments (order_id, user_id, gateway_id, method_type, amount, status,
                       idempotency_key, gateway_order_ref)
                   VALUES (%s,%s,%s,%s,%s,'CREATED',%s,%s) RETURNING *""",
                (order["order_id"], user.user_id, gw_row["gateway_id"], body.payment_mode, total,
                 body.idempotency_key, gateway_order["id"]),
            ).fetchone()
            conn.execute(
                """INSERT INTO payment_transactions (payment_id, txn_type, amount, status, gateway_txn_ref, gateway_response)
                   VALUES (%s,'CREATE_ORDER',%s,'SUCCESS',%s,%s::jsonb)""",
                (payment["payment_id"], total, gateway_order["id"], _json(sanitize(gateway_order))),
            )

    return {
        "order_id": order["order_id"], "payment_id": payment["payment_id"], "order_status": order["status"],
        "bill": {"item_total": item_total, "delivery_fee": delivery_fee, "platform_fee": platform_fee,
                 "taxes": taxes, "discount": discount, "total": total},
        "gateway_order_ref": gateway_order["id"] if gateway_order else None,
        "next_step": "COD: wait for restaurant" if is_cod else
                     f"Collect card/UPI in gateway SDK, then POST /payments/{payment['payment_id']}/pay",
    }


@app.get("/orders/{order_id}", tags=["3. Orders"])
def track_order(order_id: int, user: CurrentUser = Depends(current_user), conn=Depends(get_conn)):
    """Track an order: items, timeline, payment, and real-time rider GPS coordinates."""
    order = conn.execute(
        """SELECT o.*, r.name AS restaurant_name, u.name AS partner_name
           FROM orders o JOIN restaurants r USING (restaurant_id)
           LEFT JOIN users u ON u.user_id = o.partner_id WHERE o.order_id = %s""", (order_id,)
    ).fetchone()
    if not order or not _can_view_order(conn, user, order):
        raise HTTPException(404, "Order not found")
    order["items"] = conn.execute(
        "SELECT item_name, quantity, price_at_order, addons, line_total FROM order_items WHERE order_id = %s", (order_id,)
    ).fetchall()
    order["timeline"] = conn.execute(
        "SELECT status, changed_at, note FROM order_status_history WHERE order_id = %s ORDER BY changed_at, history_id",
        (order_id,),
    ).fetchall()
    order["payment"] = conn.execute(
        """SELECT payment_id, method_type, status, amount, card_network, card_last4
           FROM payments WHERE order_id = %s ORDER BY payment_id DESC LIMIT 1""", (order_id,)
    ).fetchone()
    order["partner_location"] = conn.execute(
        "SELECT latitude, longitude, updated_at FROM partner_locations WHERE partner_id = %s", (order["partner_id"],)
    ).fetchone() if order["partner_id"] and order["status"] == "PICKED_UP" else None
    return order


@app.get("/me/orders", tags=["3. Orders"])
def my_orders(user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """List previous orders for the logged-in customer."""
    return conn.execute(
        """SELECT o.order_id, r.name AS restaurant, o.total_amount, o.status, o.payment_mode, o.placed_at
           FROM orders o JOIN restaurants r USING (restaurant_id)
           WHERE o.customer_id = %s ORDER BY o.placed_at DESC""", (user.user_id,)
    ).fetchall()


@app.post("/orders/{order_id}/cancel", tags=["3. Orders"])
def cancel_order(order_id: int, body: CancelIn, user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """Cancel order before restaurant acceptance; automatically issues full refund."""
    with transaction(conn):
        order = conn.execute("SELECT * FROM orders WHERE order_id = %s AND customer_id = %s FOR UPDATE",
                             (order_id, user.user_id)).fetchone()
        if not order:
            raise HTTPException(404, "Order not found")
        if order["status"] not in ("PAYMENT_PENDING", "PAYMENT_FAILED", "PLACED"):
            raise HTTPException(409, "Order can no longer be cancelled")
        change_status(conn, order_id, "CANCELLED", user.user_id, body.reason)
        pay = conn.execute("SELECT p.*, g.code FROM payments p LEFT JOIN payment_gateways g USING (gateway_id) "
                           "WHERE p.order_id = %s ORDER BY payment_id DESC LIMIT 1", (order_id,)).fetchone()
        refund = None
        if pay and pay["status"] == "CAPTURED":
            resp = get_gateway(pay["code"]).refund(pay["gateway_payment_ref"], pay["amount"])
            refund = conn.execute(
                """INSERT INTO refunds (payment_id, amount, reason, status, gateway_refund_ref, initiated_by)
                   VALUES (%s,%s,%s,'PROCESSED',%s,%s) RETURNING refund_id, amount, status""",
                (pay["payment_id"], pay["amount"], body.reason, resp["id"], user.user_id),
            ).fetchone()
            conn.execute(
                """INSERT INTO payment_transactions (payment_id, txn_type, amount, status, gateway_txn_ref, gateway_response)
                   VALUES (%s,'REFUND',%s,'SUCCESS',%s,%s::jsonb)""",
                (pay["payment_id"], pay["amount"], resp["id"], _json(sanitize(resp))),
            )
            conn.execute("UPDATE payments SET status = 'REFUNDED' WHERE payment_id = %s", (pay["payment_id"],))
    return {"order_id": order_id, "status": "CANCELLED", "refund": refund}


@app.post("/orders/{order_id}/rate", status_code=201, tags=["3. Orders"])
def rate_order(order_id: int, body: RatingIn, user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """Submit ratings and feedback for food and delivery."""
    with transaction(conn):
        order = conn.execute("SELECT * FROM orders WHERE order_id = %s AND customer_id = %s",
                             (order_id, user.user_id)).fetchone()
        if not order or order["status"] != "DELIVERED":
            raise HTTPException(409, "You can rate only delivered orders")
        if conn.execute("SELECT 1 FROM ratings WHERE order_id = %s", (order_id,)).fetchone():
            raise HTTPException(409, "Already rated")
        conn.execute(
            "INSERT INTO ratings (order_id, user_id, food_rating, delivery_rating, comment) VALUES (%s,%s,%s,%s,%s)",
            (order_id, user.user_id, body.food_rating, body.delivery_rating, body.comment),
        )
        conn.execute(
            """UPDATE restaurants SET
                 avg_rating = round(((avg_rating * rating_count) + %s) / (rating_count + 1), 1),
                 rating_count = rating_count + 1
               WHERE restaurant_id = %s""",
            (body.food_rating, order["restaurant_id"]),
        )
        if body.delivery_rating and order["partner_id"]:
            conn.execute(
                """UPDATE delivery_partners SET rating = (
                     SELECT round(avg(r.delivery_rating), 1) FROM ratings r JOIN orders o USING (order_id)
                     WHERE o.partner_id = %s AND r.delivery_rating IS NOT NULL)
                   WHERE partner_id = %s""",
                (order["partner_id"], order["partner_id"]),
            )
    return {"message": "Thanks for rating!"}


# ==============================================================================
# 6. PAYMENT & WEBHOOK ENDPOINTS (/payments/*)
# ==============================================================================

@app.post("/payments/{payment_id}/pay", tags=["4. Payments"])
def pay(payment_id: int, body: PayIn, user: CurrentUser = Depends(Customer), conn=Depends(get_conn)):
    """Charge a payment using a client gateway token or a saved method."""
    if not (body.saved_method_id or body.gateway_token):
        raise HTTPException(400, "Send saved_method_id or gateway_token")

    pay_row = conn.execute(
        """SELECT p.*, g.code AS gateway_code, o.status AS order_status
           FROM payments p JOIN orders o USING (order_id) JOIN payment_gateways g USING (gateway_id)
           WHERE p.payment_id = %s AND p.user_id = %s""",
        (payment_id, user.user_id),
    ).fetchone()
    if not pay_row:
        raise HTTPException(404, "Payment not found")
    if pay_row["status"] == "CAPTURED":
        return {"payment_id": payment_id, "status": "CAPTURED", "order_id": pay_row["order_id"], "duplicate": True}
    if pay_row["status"] not in ("CREATED", "FAILED") or pay_row["order_status"] not in ("PAYMENT_PENDING", "PAYMENT_FAILED"):
        raise HTTPException(409, f"Payment is {pay_row['status']}, order is {pay_row['order_status']}")

    card_network, card_last4, saved_id = body.card_network, body.card_last4, body.saved_method_id
    if body.saved_method_id:
        m = conn.execute("SELECT * FROM saved_payment_methods WHERE method_id = %s AND user_id = %s",
                         (body.saved_method_id, user.user_id)).fetchone()
        if not m:
            raise HTTPException(404, "Saved method not found")
        token, card_network, card_last4 = m["gateway_token"], m["card_network"], m["card_last4"]
    else:
        token = body.gateway_token

    gw = get_gateway(pay_row["gateway_code"])
    resp = gw.charge(token, pay_row["gateway_order_ref"], pay_row["amount"])
    ok = resp.get("status") == "captured"
    if ok and "card" in resp:
        card_network, card_last4 = resp["card"]["network"], resp["card"]["last4"]
    log.info("payment %s result=%s", payment_id, resp.get("status"))

    with transaction(conn):
        conn.execute(
            """INSERT INTO payment_transactions (payment_id, txn_type, amount, status, gateway_txn_ref, gateway_response)
               VALUES (%s,'CAPTURE',%s,%s,%s,%s::jsonb)""",
            (payment_id, pay_row["amount"], "SUCCESS" if ok else "FAILED", resp.get("id"), json.dumps(sanitize(resp))),
        )
        if ok:
            if body.save_method and body.gateway_token and pay_row["method_type"] == "CARD" and card_last4:
                saved_id = conn.execute(
                    """INSERT INTO saved_payment_methods (user_id, gateway_id, method_type, gateway_token, card_network,
                           card_last4, card_expiry_month, card_expiry_year)
                       VALUES (%s,%s,'CARD',%s,%s,%s,%s,%s)
                       ON CONFLICT (gateway_token) DO UPDATE SET card_last4 = EXCLUDED.card_last4
                       RETURNING method_id""",
                    (user.user_id, pay_row["gateway_id"], token, card_network, card_last4,
                     body.card_expiry_month, body.card_expiry_year),
                ).fetchone()["method_id"]
            conn.execute(
                """UPDATE payments SET status = 'CAPTURED', gateway_payment_ref = %s, card_network = %s,
                       card_last4 = %s, saved_method_id = %s, failure_code = NULL, failure_reason = NULL
                   WHERE payment_id = %s""",
                (resp["id"], card_network if pay_row["method_type"] == "CARD" else None,
                 card_last4 if pay_row["method_type"] == "CARD" else None, saved_id, payment_id),
            )
            change_status(conn, pay_row["order_id"], "PLACED", None, "payment captured")
            conn.execute("DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.cart_id AND c.user_id = %s",
                         (user.user_id,))
        else:
            conn.execute(
                "UPDATE payments SET status = 'FAILED', failure_code = %s, failure_reason = %s WHERE payment_id = %s",
                (resp.get("error_code"), resp.get("error_description"), payment_id),
            )
            if pay_row["order_status"] == "PAYMENT_PENDING":
                change_status(conn, pay_row["order_id"], "PAYMENT_FAILED", None, resp.get("error_code"))

    if not ok:
        raise HTTPException(402, {"payment_id": payment_id, "status": "FAILED", "reason": resp.get("error_description"),
                                  "hint": "You can retry with another card/UPI on the same payment_id"})
    return {"payment_id": payment_id, "status": "CAPTURED", "order_id": pay_row["order_id"],
            "receipt": f"{card_network} **** {card_last4}" if card_last4 else pay_row["method_type"]}


@app.post("/payments/webhooks/{gateway_code}", tags=["4. Payments"])
async def gateway_webhook(gateway_code: str, request: Request, x_gateway_signature: str = Header(default=""),
                          conn=Depends(get_conn)):
    """Receive asynchronous webhook notifications from the payment gateway."""
    body = await request.body()
    gw_row = conn.execute("SELECT * FROM payment_gateways WHERE code = %s", (gateway_code.upper(),)).fetchone()
    if not gw_row:
        raise HTTPException(404, "Unknown gateway")
    valid = get_gateway(gw_row["code"]).verify_webhook(body, x_gateway_signature)
    event = json.loads(body)
    payload = event.get("payload", {})
    pay_row = conn.execute("SELECT * FROM payments WHERE gateway_order_ref = %s", (payload.get("order_id"),)).fetchone()

    insert_sql = """INSERT INTO payment_webhook_events (gateway_id, gateway_event_id, event_type, payment_id, signature_valid, payload)
               VALUES (%s,%s,%s,%s,%s,%s::jsonb)
               ON CONFLICT (gateway_id, gateway_event_id) DO NOTHING RETURNING event_id"""
    params = (gw_row["gateway_id"], event.get("id"), event.get("event"), pay_row["payment_id"] if pay_row else None,
              valid, json.dumps(sanitize(event)))
    if not valid:
        conn.execute(insert_sql, params)
        raise HTTPException(401, "Bad signature")

    with transaction(conn):
        inserted = conn.execute(insert_sql, params).fetchone()
        if not inserted:
            return {"status": "duplicate ignored"}
        if pay_row and event.get("event") == "payment.captured" and pay_row["status"] != "CAPTURED":
            conn.execute("UPDATE payments SET status = 'CAPTURED', gateway_payment_ref = %s WHERE payment_id = %s",
                         (payload.get("payment_id"), pay_row["payment_id"]))
            order = conn.execute("SELECT status FROM orders WHERE order_id = %s", (pay_row["order_id"],)).fetchone()
            if order["status"] in ("PAYMENT_PENDING", "PAYMENT_FAILED"):
                change_status(conn, pay_row["order_id"], "PLACED", None, "captured via webhook")
        conn.execute("UPDATE payment_webhook_events SET processed_at = now() WHERE event_id = %s", (inserted["event_id"],))
    return {"status": "ok"}


# ==============================================================================
# 7. RESTAURANT OWNER ENDPOINTS (/restaurants/onboard, /restaurant/*)
# ==============================================================================

@app.post("/restaurants/onboard", status_code=201, tags=["5. Restaurant"])
def onboard_restaurant(body: RestaurantOnboardIn, user: CurrentUser = Depends(current_user), conn=Depends(get_conn)):
    """Register a new restaurant; created in PENDING status until approved by admin."""
    with transaction(conn):
        r = conn.execute(
            """INSERT INTO restaurants (name, address_line, city, latitude, longitude, cuisines, fssai_no, gst_no)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING restaurant_id, name, status""",
            (body.name, body.address_line, body.city, body.latitude, body.longitude, body.cuisines,
             body.fssai_no, body.gst_no),
        ).fetchone()
        conn.execute("INSERT INTO restaurant_staff (restaurant_id, user_id, staff_role) VALUES (%s,%s,'OWNER')",
                     (r["restaurant_id"], user.user_id))
        conn.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, 2) ON CONFLICT DO NOTHING", (user.user_id,))
        roles = roles_of(conn, user.user_id)
        token = create_token(user.user_id, roles)
    return {**r, "token": token, "roles": roles, "status": "PENDING"}


@app.get("/restaurant/mine", tags=["5. Restaurant"])
def my_restaurants(user: CurrentUser = Depends(Staff), conn=Depends(get_conn)):
    """List all restaurants managed by the logged-in owner/staff."""
    return conn.execute(
        """SELECT r.restaurant_id, r.name, r.status, r.is_open, r.avg_rating, rs.staff_role
           FROM restaurant_staff rs
           JOIN restaurants r USING (restaurant_id)
           WHERE rs.user_id = %s
           ORDER BY r.restaurant_id""",
        (user.user_id,),
    ).fetchall()


@app.get("/restaurant/{restaurant_id}/orders", tags=["5. Restaurant"])
def live_orders(restaurant_id: int, status: str = "PLACED", user: CurrentUser = Depends(Staff), conn=Depends(get_conn)):
    """View active orders for the restaurant filtered by status."""
    assert_staff(conn, restaurant_id, user.user_id)
    orders = conn.execute(
        """SELECT o.order_id, o.status, o.total_amount, o.payment_mode, o.special_instructions, o.placed_at,
                  json_agg(json_build_object('item', oi.item_name, 'qty', oi.quantity, 'addons', oi.addons)) AS items
           FROM orders o JOIN order_items oi USING (order_id)
           WHERE o.restaurant_id = %s AND o.status = %s
           GROUP BY o.order_id ORDER BY o.placed_at""",
        (restaurant_id, status.upper()),
    ).fetchall()
    return orders


@app.post("/restaurant/{restaurant_id}/orders/{order_id}/accept", tags=["5. Restaurant"])
def accept_order(restaurant_id: int, order_id: int, user: CurrentUser = Depends(Staff), conn=Depends(get_conn)):
    """Accept order and automatically offer it to the nearest online delivery partner."""
    assert_staff(conn, restaurant_id, user.user_id)
    with transaction(conn):
        change_status(conn, order_id, "ACCEPTED", user.user_id)
        assignment = offer_to_nearest_partner(conn, order_id)
    return {"order_id": order_id, "status": "ACCEPTED",
            "offered_to_partner": assignment["partner_id"] if assignment else None}


@app.post("/restaurant/{restaurant_id}/orders/{order_id}/ready", tags=["5. Restaurant"])
def order_ready(restaurant_id: int, order_id: int, user: CurrentUser = Depends(Staff), conn=Depends(get_conn)):
    """Mark food as cooked and ready for rider pickup."""
    assert_staff(conn, restaurant_id, user.user_id)
    with transaction(conn):
        change_status(conn, order_id, "READY", user.user_id)
    return {"order_id": order_id, "status": "READY"}


@app.patch("/restaurant/{restaurant_id}/items/{item_id}", tags=["5. Restaurant"])
def update_item_stock(restaurant_id: int, item_id: int, body: ItemUpdateIn, user: CurrentUser = Depends(Staff),
                      conn=Depends(get_conn)):
    """Update dish price or stock status in the menu."""
    assert_staff(conn, restaurant_id, user.user_id)
    with transaction(conn):
        row = conn.execute(
            """UPDATE menu_items SET
                 price = COALESCE(%s, price),
                 in_stock = COALESCE(%s, in_stock)
               WHERE item_id = %s AND restaurant_id = %s
               RETURNING item_id, name, price, in_stock""",
            (body.price, body.in_stock, item_id, restaurant_id),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Item not found in this restaurant")
    return row


@app.post("/restaurant/{restaurant_id}/open", tags=["5. Restaurant"])
def set_restaurant_open(restaurant_id: int, body: OpenToggleIn, user: CurrentUser = Depends(Staff), conn=Depends(get_conn)):
    """Open or close the restaurant for incoming orders."""
    assert_staff(conn, restaurant_id, user.user_id)
    with transaction(conn):
        row = conn.execute("UPDATE restaurants SET is_open = %s WHERE restaurant_id = %s RETURNING restaurant_id, is_open",
                           (body.is_open, restaurant_id)).fetchone()
    return row


@app.get("/restaurant/{restaurant_id}/payouts", tags=["5. Restaurant"])
def restaurant_payouts(restaurant_id: int, user: CurrentUser = Depends(Staff), conn=Depends(get_conn)):
    """View payout ledger and settlements for the restaurant."""
    assert_staff(conn, restaurant_id, user.user_id)
    return conn.execute(
        """SELECT payout_id, period_start, period_end, order_count, gross_sales, commission_amount,
                  net_payout, status, paid_at
           FROM restaurant_payouts WHERE restaurant_id = %s ORDER BY period_end DESC""",
        (restaurant_id,),
    ).fetchall()


# ==============================================================================
# 8. DELIVERY PARTNER / RIDER ENDPOINTS (/partners/onboard, /partner/*)
# ==============================================================================

@app.post("/partners/onboard", status_code=201, tags=["6. Delivery Partner"])
def onboard_partner(body: PartnerOnboardIn, user: CurrentUser = Depends(current_user), conn=Depends(get_conn)):
    """Register as a delivery partner; starts in PENDING_KYC status."""
    with transaction(conn):
        conn.execute(
            """INSERT INTO delivery_partners (partner_id, vehicle_type, vehicle_no, licence_no, city)
               VALUES (%s,%s,%s,%s,%s)""",
            (user.user_id, body.vehicle_type, body.vehicle_no, body.licence_no, body.city),
        )
        conn.execute("INSERT INTO user_roles (user_id, role_id) VALUES (%s, 4) ON CONFLICT DO NOTHING", (user.user_id,))
        roles = roles_of(conn, user.user_id)
        token = create_token(user.user_id, roles)
    return {
        "partner_id": user.user_id,
        "kyc_status": "PENDING_KYC",
        "token": token,
        "roles": roles,
        "next_step": "Upload documents; an admin verifies KYC.",
    }


@app.get("/partner/me", tags=["6. Delivery Partner"])
def partner_me(user: CurrentUser = Depends(Partner), conn=Depends(get_conn)):
    """Return partner's current status, rating, active delivery, and location."""
    p = _partner(conn, user.user_id)
    current = None
    if p.get("current_order_id"):
        current = conn.execute(
            """SELECT o.order_id, o.status, o.total_amount, o.payment_mode, r.name AS restaurant,
                      r.address_line AS pickup, r.latitude AS pickup_lat, r.longitude AS pickup_lng,
                      a.address_line AS drop_address, a.landmark AS drop_landmark, a.latitude AS drop_lat, a.longitude AS drop_lng,
                      u.name AS customer
               FROM orders o
               JOIN restaurants r USING (restaurant_id)
               JOIN addresses a USING (address_id)
               JOIN users u ON u.user_id = o.customer_id
               WHERE o.order_id = %s""",
            (p["current_order_id"],),
        ).fetchone()

    loc = conn.execute("SELECT latitude, longitude, updated_at FROM partner_locations WHERE partner_id = %s", (user.user_id,)).fetchone()
    return {
        "partner_id": p["partner_id"],
        "vehicle_type": p["vehicle_type"],
        "kyc_status": p["kyc_status"],
        "is_online": p["is_online"],
        "rating": float(p["rating"] or 0),
        "location": loc,
        "current_order": current,
    }


@app.post("/partner/status", tags=["6. Delivery Partner"])
def set_online_status(body: OnlineIn, user: CurrentUser = Depends(Partner), conn=Depends(get_conn)):
    """Toggle online/offline duty status."""
    p = _partner(conn, user.user_id)
    if body.is_online and p["kyc_status"] != "VERIFIED":
        raise HTTPException(409, "KYC must be verified before going online")
    with transaction(conn):
        conn.execute("UPDATE delivery_partners SET is_online = %s WHERE partner_id = %s",
                     (body.is_online, user.user_id))
    return {"partner_id": user.user_id, "is_online": body.is_online}


@app.post("/partner/location", tags=["6. Delivery Partner"])
def update_location(body: LocationIn, user: CurrentUser = Depends(Partner), conn=Depends(get_conn)):
    """Update live GPS location coordinates."""
    with transaction(conn):
        conn.execute(
            """INSERT INTO partner_locations (partner_id, latitude, longitude)
               VALUES (%s, %s, %s)
               ON CONFLICT (partner_id) DO UPDATE SET latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, updated_at=now()""",
            (user.user_id, body.latitude, body.longitude),
        )
    return {"ok": True}


@app.get("/partner/offers", tags=["6. Delivery Partner"])
def list_offers(user: CurrentUser = Depends(Partner), conn=Depends(get_conn)):
    """List pending delivery assignments offered to this rider."""
    return conn.execute(
        """SELECT da.assignment_id, da.order_id, da.offered_at, o.total_amount, o.payment_mode,
                  r.name AS restaurant_name, r.address_line AS pickup_address,
                  a.address_line AS drop_address
           FROM delivery_assignments da
           JOIN orders o USING (order_id)
           JOIN restaurants r USING (restaurant_id)
           JOIN addresses a USING (address_id)
           WHERE da.partner_id = %s AND da.status = 'OFFERED'
           ORDER BY da.offered_at DESC""",
        (user.user_id,),
    ).fetchall()


@app.post("/partner/offers/{assignment_id}/accept", tags=["6. Delivery Partner"])
def accept_offer(assignment_id: int, user: CurrentUser = Depends(Partner), conn=Depends(get_conn)):
    """Accept an offered delivery job."""
    with transaction(conn):
        a = conn.execute("SELECT * FROM delivery_assignments WHERE assignment_id = %s AND partner_id = %s FOR UPDATE",
                         (assignment_id, user.user_id)).fetchone()
        if not a or a["status"] != "OFFERED":
            raise HTTPException(409, "Offer not available")
        p = conn.execute("SELECT * FROM delivery_partners WHERE partner_id = %s FOR UPDATE", (user.user_id,)).fetchone()
        if p["current_order_id"]:
            raise HTTPException(409, "Finish your current order first")
        conn.execute("UPDATE delivery_assignments SET status = 'ACCEPTED', responded_at = now() WHERE assignment_id = %s",
                     (assignment_id,))
        conn.execute("UPDATE orders SET partner_id = %s WHERE order_id = %s AND partner_id IS NULL",
                     (user.user_id, a["order_id"]))
        conn.execute("UPDATE delivery_partners SET current_order_id = %s WHERE partner_id = %s",
                     (a["order_id"], user.user_id))
    return {"order_id": a["order_id"], "message": "Head to the restaurant"}


@app.post("/partner/offers/{assignment_id}/reject", tags=["6. Delivery Partner"])
def reject_offer(assignment_id: int, user: CurrentUser = Depends(Partner), conn=Depends(get_conn)):
    """Reject offer; dispatch automatically re-offers the order to the next closest rider."""
    with transaction(conn):
        a = conn.execute(
            """UPDATE delivery_assignments SET status = 'REJECTED', responded_at = now()
               WHERE assignment_id = %s AND partner_id = %s AND status = 'OFFERED' RETURNING order_id""",
            (assignment_id, user.user_id),
        ).fetchone()
        if not a:
            raise HTTPException(409, "Offer not available")
        nxt = offer_to_nearest_partner(conn, a["order_id"])
    return {"rejected": True, "re_offered_to": nxt["partner_id"] if nxt else None}


@app.post("/partner/orders/{order_id}/pickup", tags=["6. Delivery Partner"])
def pickup_order(order_id: int, user: CurrentUser = Depends(Partner), conn=Depends(get_conn)):
    """Mark food picked up from restaurant."""
    with transaction(conn):
        o = conn.execute("SELECT partner_id FROM orders WHERE order_id = %s", (order_id,)).fetchone()
        if not o or o["partner_id"] != user.user_id:
            raise HTTPException(404, "Not your order")
        change_status(conn, order_id, "PICKED_UP", user.user_id)
    return {"order_id": order_id, "status": "PICKED_UP"}


@app.post("/partner/orders/{order_id}/deliver", tags=["6. Delivery Partner"])
def deliver_order(order_id: int, body: DeliverIn | None = None, user: CurrentUser = Depends(Partner), conn=Depends(get_conn)):
    """Complete delivery, process cash collection (if COD), and credit rider earnings."""
    body = body or DeliverIn()
    with transaction(conn):
        o = conn.execute("SELECT o.*, r.commission_pct FROM orders o JOIN restaurants r USING (restaurant_id) "
                         "WHERE o.order_id = %s", (order_id,)).fetchone()
        if not o or o["partner_id"] != user.user_id:
            raise HTTPException(404, "Not your order")
        if o["payment_mode"] == "COD" and not body.cash_collected:
            raise HTTPException(409, f"Collect Rs {o['total_amount']} cash from the customer first")
        change_status(conn, order_id, "DELIVERED", user.user_id)
        conn.execute("UPDATE delivery_partners SET current_order_id = NULL WHERE partner_id = %s", (user.user_id,))
        conn.execute("INSERT INTO partner_earnings (partner_id, order_id, base_pay, distance_pay) VALUES (%s,%s,25,10)",
                     (user.user_id, order_id))
        conn.execute(
            """INSERT INTO restaurant_payouts (restaurant_id, order_id, order_amount, commission, payout_amount)
               VALUES (%s, %s, %s, round(%s * %s / 100, 2), %s - round(%s * %s / 100, 2))""",
            (o["restaurant_id"], order_id, o["item_total"], o["item_total"], o["commission_pct"],
             o["item_total"], o["item_total"], o["commission_pct"]),
        )
        if o["payment_mode"] == "COD":
            conn.execute("UPDATE payments SET status = 'COD_COLLECTED' WHERE order_id = %s AND status = 'COD_PENDING'",
                         (order_id,))
    return {"order_id": order_id, "status": "DELIVERED"}


@app.get("/partner/earnings", tags=["6. Delivery Partner"])
def partner_earnings(user: CurrentUser = Depends(Partner), conn=Depends(get_conn)):
    """List completed delivery earnings for the rider."""
    rows = conn.execute("SELECT * FROM partner_earnings WHERE partner_id = %s ORDER BY created_at DESC",
                        (user.user_id,)).fetchall()
    total = sum(float(r["base_pay"] + r["distance_pay"] + r["tip"]) for r in rows)
    return {"total": round(total, 2), "deliveries": rows}


# ==============================================================================
# 9. ADMIN APPROVAL ENDPOINTS (/admin/*)
# ==============================================================================

@app.post("/admin/restaurants/{restaurant_id}/approve", tags=["7. Admin"])
def approve_restaurant(restaurant_id: int, user: CurrentUser = Depends(Admin), conn=Depends(get_conn)):
    """Approve a pending restaurant to go active on the platform."""
    row = conn.execute(
        "UPDATE restaurants SET status = 'ACTIVE' WHERE restaurant_id = %s AND status = 'PENDING' "
        "RETURNING restaurant_id, name, status", (restaurant_id,)
    ).fetchone()
    if not row:
        raise HTTPException(409, "Restaurant not found or not pending")
    return row


@app.post("/admin/partners/{partner_id}/verify", tags=["7. Admin"])
def verify_partner(partner_id: int, user: CurrentUser = Depends(Admin), conn=Depends(get_conn)):
    """Verify delivery partner KYC documents and activate rider."""
    with transaction(conn):
        row = conn.execute(
            "UPDATE delivery_partners SET kyc_status = 'VERIFIED' WHERE partner_id = %s RETURNING partner_id, kyc_status",
            (partner_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Partner not found")
        conn.execute("UPDATE partner_documents SET verified = TRUE, verified_at = now() WHERE partner_id = %s",
                     (partner_id,))
    return row


# ==============================================================================
# 10. MOCK PAYMENT GATEWAY ENDPOINTS (/mock-gateway/*)
# ==============================================================================

if settings.enable_mock_gateway:
    from . import mock_gateway
    app.include_router(mock_gateway.router)


# ==============================================================================
# 11. HEALTH CHECK & FRONTEND STATIC SERVING
# ==============================================================================

@app.get("/health", tags=["0. Health"])
def health(conn = Depends(get_conn)):
    """Verify PostgreSQL database connectivity."""
    conn.execute("SELECT 1")
    return {"status": "ok"}


_FRONTEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
if os.path.isdir(_FRONTEND):
    app.mount("/app", StaticFiles(directory=_FRONTEND, html=True), name="frontend")


@app.get("/", include_in_schema=False)
def index():
    """Redirect root to the frontend application."""
    return RedirectResponse(url="/app/")
