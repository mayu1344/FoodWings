import os
import sys
import uuid
import psycopg
from psycopg.rows import dict_row
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from app.config import settings
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def random_phone():
    return f"99{uuid.uuid4().int % 100000000:08d}"


def get_otp(client, phone, app_kind="customer", purpose="LOGIN"):
    r = client.post("/auth/otp/request", json={"phone": phone, "app": app_kind, "purpose": purpose})
    assert r.status_code == 200
    return r.json()["dev_otp"]


def test_register_new_customer(client):
    phone = random_phone()
    otp = get_otp(client, phone, "customer", "REGISTER")

    # Check phone before register
    check = client.post("/auth/check-phone", json={"phone": phone, "app": "customer"}).json()
    assert check["exists"] is False
    assert check["has_app_role"] is False
    assert check["name"] is None

    # Register
    reg = client.post(
        "/auth/register",
        json={"phone": phone, "otp": otp, "app": "customer", "name": "Aarav Sharma", "email": f"aarav_{phone}@example.com"},
    )
    assert reg.status_code == 200, reg.text
    data = reg.json()
    assert data["name"] == "Aarav Sharma"
    assert data["roles"] == ["CUSTOMER"]
    assert data["app"] == "customer"
    assert data["next_step"] == "ADD_ADDRESS"
    assert "token" in data

    # Verify user row & user_roles in db
    with psycopg.connect(settings.database_url, autocommit=True, row_factory=dict_row) as conn:
        u = conn.execute("SELECT * FROM users WHERE phone = %s", (phone,)).fetchone()
        assert u is not None
        assert u["name"] == "Aarav Sharma"
        roles = [r["role_name"] for r in conn.execute(
            "SELECT r.role_name FROM user_roles ur JOIN roles r USING(role_id) WHERE ur.user_id = %s",
            (u["user_id"],)
        ).fetchall()]
        assert "CUSTOMER" in roles

    # Verify token works on /auth/me
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {data['token']}"})
    assert me.status_code == 200
    assert me.json()["phone"] == phone
    assert me.json()["name"] == "Aarav Sharma"

    # Check phone after register (name masked)
    check2 = client.post("/auth/check-phone", json={"phone": phone, "app": "customer"}).json()
    assert check2["exists"] is True
    assert check2["has_app_role"] is True
    assert check2["name"].startswith("Aa")
    assert "*" in check2["name"]


def test_register_duplicate_phone_conflict(client):
    phone = random_phone()
    otp1 = get_otp(client, phone, "customer", "REGISTER")
    r1 = client.post("/auth/register", json={"phone": phone, "otp": otp1, "app": "customer", "name": "User One"})
    assert r1.status_code == 200

    otp2 = get_otp(client, phone, "customer", "REGISTER")
    r2 = client.post("/auth/register", json={"phone": phone, "otp": otp2, "app": "customer", "name": "User One"})
    assert r2.status_code == 409
    assert "Already registered" in r2.text


def test_login_unknown_phone_404(client):
    phone = random_phone()
    otp = get_otp(client, phone, "customer", "LOGIN")
    r = client.post("/auth/login", json={"phone": phone, "otp": otp, "app": "customer"})
    assert r.status_code == 404
    assert "USER_NOT_FOUND" in r.text or "No account" in r.text


def test_login_rider_with_customer_account_role_missing(client):
    # Customer registered but rider not onboarded
    phone = random_phone()
    otp1 = get_otp(client, phone, "customer", "REGISTER")
    client.post("/auth/register", json={"phone": phone, "otp": otp1, "app": "customer", "name": "Cust Only"})

    otp2 = get_otp(client, phone, "rider", "LOGIN")
    # For rider app, if user is in users but not in delivery_partners, login returns 200 with RIDER_DETAILS (to resume wizard)
    r = client.post("/auth/login", json={"phone": phone, "otp": otp2, "app": "rider"})
    assert r.status_code == 200
    assert r.json()["next_step"] == "RIDER_DETAILS"


def test_existing_customer_registers_as_rider_same_user_id(client):
    phone = random_phone()
    otp1 = get_otp(client, phone, "customer", "REGISTER")
    reg1 = client.post("/auth/register", json={"phone": phone, "otp": otp1, "app": "customer", "name": "Dual User"}).json()
    cust_uid = reg1["user_id"]

    # Now register as rider with same phone
    otp2 = get_otp(client, phone, "rider", "REGISTER")
    reg2 = client.post("/auth/register", json={"phone": phone, "otp": otp2, "app": "rider", "name": "Dual User"}).json()
    rider_uid = reg2["user_id"]

    assert cust_uid == rider_uid
    assert reg2["next_step"] == "RIDER_DETAILS"

    # Ensure single row in users table
    with psycopg.connect(settings.database_url, autocommit=True, row_factory=dict_row) as conn:
        user_rows = conn.execute("SELECT * FROM users WHERE phone = %s", (phone,)).fetchall()
        assert len(user_rows) == 1


def test_wrong_otp_and_otp_reuse(client):
    phone = random_phone()
    otp = get_otp(client, phone, "customer", "REGISTER")

    # 1. Wrong OTP attempts
    for _ in range(5):
        r = client.post("/auth/register", json={"phone": phone, "otp": "000000", "app": "customer", "name": "Test OTP"})
        assert r.status_code in (400, 429)

    # 6th attempt should be blocked with 429
    r6 = client.post("/auth/register", json={"phone": phone, "otp": otp, "app": "customer", "name": "Test OTP"})
    assert r6.status_code == 429

    # 2. OTP reuse on a new request
    phone2 = random_phone()
    otp2 = get_otp(client, phone2, "customer", "REGISTER")
    # First use succeeds
    r_succ = client.post("/auth/register", json={"phone": phone2, "otp": otp2, "app": "customer", "name": "Reuse Test"})
    assert r_succ.status_code == 200

    # Second use of same OTP fails with 400
    r_reuse = client.post("/auth/register", json={"phone": phone2, "otp": otp2, "app": "customer", "name": "Reuse Test"})
    assert r_reuse.status_code == 400


def test_raw_otp_never_in_database(client):
    phone = random_phone()
    otp = get_otp(client, phone, "customer", "REGISTER")

    with psycopg.connect(settings.database_url, autocommit=True, row_factory=dict_row) as conn:
        row = conn.execute(
            "SELECT * FROM otp_requests WHERE phone = %s ORDER BY created_at DESC LIMIT 1",
            (phone,),
        ).fetchone()
        assert row is not None
        # Hash is stored, not raw OTP
        assert row["otp_hash"] != otp
        assert len(row["otp_hash"]) == 64  # SHA256 hex string


def test_token_refresh(client):
    phone = random_phone()
    otp = get_otp(client, phone, "customer", "REGISTER")
    reg = client.post("/auth/register", json={"phone": phone, "otp": otp, "app": "customer", "name": "Refresh User"}).json()
    token = reg["token"]

    r = client.post("/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["roles"] == ["CUSTOMER"]
    assert data["user_id"] == reg["user_id"]


def test_rate_limiting_otp_requests(client):
    phone = random_phone()
    for _ in range(5):
        r = client.post("/auth/otp/request", json={"phone": phone, "app": "customer", "purpose": "LOGIN"})
        assert r.status_code == 200

    # 6th request within 15 minutes fails with 429
    r6 = client.post("/auth/otp/request", json={"phone": phone, "app": "customer", "purpose": "LOGIN"})
    assert r6.status_code == 429
