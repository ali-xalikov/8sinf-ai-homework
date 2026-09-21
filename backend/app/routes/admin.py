from __future__ import annotations

import platform
import time
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .. import auth, checkers, config, db, indexer, llm, pdfingest, storage

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
def stats(req: Request):
    auth.require_admin(req)
    users = storage.exec_one("SELECT COUNT(*) n FROM users")["n"]
    active = storage.exec_one("SELECT COUNT(*) n FROM users WHERE is_active=1")["n"]
    books = storage.exec_one("SELECT COUNT(*) n FROM books WHERE class_no=8")["n"]
    pages = storage.exec_one("SELECT COUNT(*) n FROM pages")["n"]
    chunks = storage.exec_one("SELECT COUNT(*) n FROM chunks")["n"]
    indexed_books = storage.exec_one("SELECT COUNT(*) n FROM books WHERE indexed=1")["n"]
    chats = storage.exec_one("SELECT COUNT(*) n FROM chat_messages")["n"]
    provider = llm.provider()
    try:
        state = indexer.refresh_vector()
    except Exception:
        state = {}
    q = {
        "users": users, "active_users": active, "books": books,
        "indexed_books": indexed_books, "pages": pages, "chunks": chunks,
        "chat_messages": chats, "ai_provider": provider,
        "vector_ready": bool(state.get("ready")),
        "server_online": True,
        "hostname": platform.node(), "python": platform.python_version(),
        "started_at": _started_at(),
    }
    return q


_START = time.time()


def _started_at() -> str:
    import datetime
    return datetime.datetime.fromtimestamp(_START).isoformat(timespec="seconds")


@router.get("/status")
def status_all(req: Request):
    auth.require_admin(req)
    out = {
        "ollama": checkers.ollama_ping(),
        "db": "postgres" if config.DATABASE_URL else "sqlite",
        "books_dir": str(config.BOOKS_DIR),
        "uptime_s": int(time.time() - _START),
    }
    return out


@router.get("/books")
def admin_books(req: Request):
    auth.require_admin(req)
    return db.list_books()


@router.get("/users")
def users(req: Request):
    auth.require_admin(req)
    rows = storage.exec_all(
        "SELECT id, username, first_name, last_name, role, is_active, created_at FROM users ORDER BY created_at"
    )
    for r in rows:
        r["is_active"] = bool(r["is_active"])
    return rows


class UserPatch(BaseModel):
    is_active: bool | None = None


@router.patch("/users/{uid}")
def patch_user(uid: str, body: UserPatch, req: Request):
    admin = auth.require_admin(req)
    if uid == admin["id"] and body.is_active is False:
        raise HTTPException(400, "O'zingizni bloklay olmaysiz")
    if body.is_active is not None:
        storage.exec_write("UPDATE users SET is_active=:v WHERE id=:i", v=1 if body.is_active else 0, i=uid)
    return {"ok": True}


@router.get("/user/{uid}")
def user_detail(uid: str, req: Request):
    auth.require_admin(req)
    row = storage.exec_one(
        "SELECT id, username, first_name, last_name, role, is_active, created_at FROM users WHERE id=:i", i=uid,
    )
    if not row:
        raise HTTPException(404)
    row["is_active"] = bool(row["is_active"])
    return row


@router.get("/ai")
def ai_settings(req: Request):
    auth.require_admin(req)
    return {
        "provider": config.LLM_PROVIDER,
        "effective_provider": llm.provider(),
        "openai_model": config.OPENAI_MODEL,
        "openai_base": config.OPENAI_BASE_URL,
        "ollama_url": config.OLLAMA_BASE_URL,
        "ollama_model": config.OLLAMA_MODEL,
        "ollama_online": checkers.ollama_ping(),
        "concurrency": config.MAX_CONCURRENT_AI_REQUESTS,
        "rate_per_minute": config.MAX_AI_REQUESTS_PER_MINUTE,
        "note": "Ushbu qiymatlar serverdagi .env faylidan o'qiladi va 'asror/yozgich' emas — ",
    }


@router.get("/index")
def index_info(req: Request):
    auth.require_admin(req)
    vec = indexer.refresh_vector()
    books = db.list_books()
    return {"vector": vec, "books": [{**b, "exists": b["exists"]} for b in books]}


@router.get("/indexing/{job_id}")
def indexing_job(job_id: str, req: Request):
    auth.require_admin(req)
    from .. import jobs
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(404, "Job topilmadi")
    return job