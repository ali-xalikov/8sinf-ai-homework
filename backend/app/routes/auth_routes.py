from __future__ import annotations

import secrets

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .. import auth, db, storage

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    first_name: str = ""
    last_name: str = ""
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register")
def register(req: RegisterRequest):
    username = (req.username or "").strip()
    password = req.password or ""
    if not username or len(username) < 3:
        raise HTTPException(400, "Username kamida 3 ta belgi bo'lishi kerak")
    if len(password) < 4:
        raise HTTPException(400, "Parol kamida 4 ta belgi bo'lishi kerak")
    if len(password) > 128:
        raise HTTPException(400, "Parol juda uzun")
    existing = storage.exec_one("SELECT id FROM users WHERE username=:u", u=username.lower())
    if existing:
        raise HTTPException(409, "Bu username band")
    uid = secrets.token_hex(12)
    storage.exec_write(
        """INSERT INTO users(id, username, password_hash, first_name, last_name, role, is_active, created_at)
           VALUES(:id,:u,:h,:f,:l,'student',1,:c)""",
        id=uid, u=username.lower(), h=auth.hash_password(password),
        f=(req.first_name or "").strip()[:80], l=(req.last_name or "").strip()[:80], c=db.utcnow(),
    )
    token = auth.create_session(uid)
    user = storage.exec_one("SELECT * FROM users WHERE id=:i", i=uid)
    return {"token": token, "user": auth.public_user(user)}


@router.post("/login")
def login(req: LoginRequest):
    username = (req.username or "").strip().lower()
    user = storage.exec_one("SELECT * FROM users WHERE username=:u", u=username)
    if not user:
        raise HTTPException(401, "Username yoki parol noto'g'ri")
    if not auth.verify_password(req.password or "", user["password_hash"]):
        raise HTTPException(401, "Username yoki parol noto'g'ri")
    if not user["is_active"]:
        raise HTTPException(403, "Hisob bloklangan")
    token = auth.create_session(user["id"])
    return {"token": token, "user": auth.public_user(user)}


def _logout(req: Request):
    token = auth.token_from_request(req)
    if token:
        auth.delete_session(token)
    return {"ok": True}


router.add_api_route("/logout", _logout, methods=["POST"])


@router.get("/me")
def me(req: Request):
    user = auth.current_user(req)
    return {"user": auth.public_user(user)}