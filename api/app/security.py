"""Login tokens and role checks.

Token = base64(payload) + "." + HMAC-SHA256 signature. (Same idea as a JWT, kept
dependency-free so it is easy to read. You can swap in PyJWT later.)
"""
import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

from typing import Optional
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

bearer_scheme = HTTPBearer(auto_error=False)


def hash_otp(phone: str, otp: str) -> str:
    return hmac.new(settings.token_secret.encode(), f"{phone}:{otp}".encode(), hashlib.sha256).hexdigest()


def _sign(data: bytes) -> str:
    return base64.urlsafe_b64encode(hmac.new(settings.token_secret.encode(), data, hashlib.sha256).digest()).decode()


def create_token(user_id: int, roles: list[str]) -> str:
    payload = {"uid": user_id, "roles": roles, "exp": int(time.time()) + settings.token_ttl_hours * 3600}
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"{body}.{_sign(body.encode())}"


@dataclass
class CurrentUser:
    user_id: int
    roles: list[str]


def current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    authorization: str = Header(default=""),
) -> CurrentUser:
    token = ""
    if credentials and credentials.credentials:
        token = credentials.credentials.strip()
    elif authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif authorization.strip():
        token = authorization.strip()

    if not token:
        raise HTTPException(401, "Missing token")
    try:
        body, sig = token.split(".")
        if not hmac.compare_digest(sig, _sign(body.encode())):
            raise ValueError
        payload = json.loads(base64.urlsafe_b64decode(body))
        if payload["exp"] < time.time():
            raise HTTPException(401, "Token expired")
        return CurrentUser(payload["uid"], payload["roles"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Invalid token")


def require_roles(*allowed: str):
    """Usage:  user = Depends(require_roles("CUSTOMER"))"""
    def checker(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if not set(allowed) & set(user.roles):
            raise HTTPException(403, f"This action needs one of these roles: {', '.join(allowed)}")
        return user
    return checker
