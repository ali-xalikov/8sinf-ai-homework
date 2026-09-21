from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config, db, storage

_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Parol xeshlash (PBKDF2, keyingi versiyalarda Argon2/passlib bilan almashtirish mumkin)
# ---------------------------------------------------------------------------
_ITERATIONS = 240_000


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations))
        return hmac.compare_digest(dk.hex(), digest_hex)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Sessiyalar
# ---------------------------------------------------------------------------
def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    import datetime
    now = datetime.datetime.now(datetime.UTC)
    expires = now + datetime.timedelta(days=config.SESSION_DAYS)
    storage.exec_write(
        "INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES(:t,:u,:c,:e)",
        t=token, u=user_id,
        c=now.isoformat(timespec="seconds"), e=expires.isoformat(timespec="seconds"),
    )
    return token


def delete_session(token: str) -> None:
    storage.exec_write("DELETE FROM sessions WHERE token=:t", t=token)


def get_user_by_token(token: str) -> Optional[dict]:
    row = storage.exec_one(
        """SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token=:t AND s.expires_at >= :now AND u.is_active=1""",
        t=token, now=db.utcnow(),
    )
    return row


def token_from_request(req: Request) -> Optional[str]:
    auth = req.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def current_user(req: Request) -> dict:
    token = token_from_request(req)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kirish kerak")
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessiya yaroqsiz")
    user["is_active"] = bool(user["is_active"])
    return user


def require_user(req: Request) -> dict:
    return current_user(req)


def require_admin(req: Request) -> dict:
    user = current_user(req)
    if user["role"] != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Faqat admin")
    return user


def public_user(user: dict) -> dict:
    return {
        "id": user["id"], "username": user["username"],
        "first_name": user["first_name"], "last_name": user["last_name"],
        "role": user["role"], "is_active": bool(user["is_active"]),
        "created_at": user["created_at"],
    }


def bootstrap_admin() -> dict:
    """Birinchi ishga tushirishda admin yaratadi (mavjud bo'lmasa)."""
    existing = storage.exec_one("SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1")
    if existing:
        return {"created": False, "username": config.ADMIN_USERNAME}
    username = config.ADMIN_USERNAME.strip() or "admin"
    if config.ADMIN_PASSWORD:
        password = config.ADMIN_PASSWORD
    else:
        password = secrets.token_urlsafe(6)
    storage.exec_write(
        """INSERT INTO users(id, username, password_hash, first_name, last_name, role, is_active, created_at)
           VALUES(:id,:u,:h,:f,:l,'admin',1,:c)""",
        id=secrets.token_hex(12), u=username, h=hash_password(password),
        f="Administrator", l="", c=db.utcnow(),
    )
    return {"created": True, "username": username, "password": password}