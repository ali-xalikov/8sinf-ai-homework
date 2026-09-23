from __future__ import annotations

import asyncio
import json
import secrets
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel

from .. import auth, config, db, llm, ratelimit, solver, storage

router = APIRouter(prefix="/api/ai", tags=["ai"])

_sem: asyncio.Semaphore | None = None
_QUEUE_WAIT_S = 8.0


def _queue_ready() -> asyncio.Semaphore:
    global _sem
    if _sem is None or _sem._value != config.MAX_CONCURRENT_AI_REQUESTS:
        _sem = asyncio.Semaphore(config.MAX_CONCURRENT_AI_REQUESTS)
    return _sem


class SolveRequest(BaseModel):
    question: str


BUSY_MSG = ("AI hozir band yoki so'rovlar chegarasiga yetdingiz. "
            "Birozdan keyin qayta urinib ko'ring.")


@router.post("/solve")
async def solve(req: SolveRequest, req_: Request):
    user = auth.current_user(req_)
    q = req.question.strip()
    if not q:
        raise HTTPException(400, "Savol bo'sh bo'lishi mumkin emas")

    if req_.client and req_.client.host:
        ip = req_.client.host
    else:
        ip = "?"
    limit = 0 if user["role"] == "admin" else config.MAX_AI_REQUESTS_PER_MINUTE
    ok, remaining = ratelimit.check(f"ai:{user['id']}", limit)
    if not ok:
        raise HTTPException(429, BUSY_MSG)

    # Navbat: bir vaqtda MAX_CONCURRENT_AI_REQUESTS ta so'rov
    sem = _queue_ready()
    try:
        await asyncio.wait_for(sem.acquire(), timeout=_QUEUE_WAIT_S)
    except asyncio.TimeoutError:
        raise HTTPException(429, BUSY_MSG)
    try:
        result = await asyncio.to_thread(solver.solve, q)
    finally:
        sem.release()

    # Foydalanuvchi tarixiga saqlash
    msg_id = secrets.token_hex(12)
    storage.exec_write(
        """INSERT INTO chat_messages(id, user_id, question, answer, source, created_at)
           VALUES(:id,:uid,:q,:a,:s,:c)""",
        id=msg_id, uid=user["id"], q=q,
        a=json.dumps(result, ensure_ascii=False),
        s=json.dumps(result.get("manba") or {}, ensure_ascii=False),
        c=db.utcnow(),
    )
    storage.exec_write(
        "INSERT INTO search_history(id, user_id, query, created_at) VALUES(:id,:uid,:q,:c)",
        id=secrets.token_hex(12), uid=user["id"], q=q[:500], c=db.utcnow(),
    )
    return {"result": result, "message_id": msg_id, "remaining": remaining}


@router.post("/solve-image")
async def solve_image(
    req_: Request,
    file: UploadFile = File(...),
    question: str = Form(""),
    mode: str = Form("homework"),
):
    """Rasm (yoki qo'l yozuvi)dan uy vazifasini taniydi va yechadi."""
    user = auth.current_user(req_)

    if req_.client and req_.client.host:
        ip = req_.client.host
    else:
        ip = "?"
    limit = 0 if user["role"] == "admin" else config.MAX_AI_REQUESTS_PER_MINUTE
    ok, remaining = ratelimit.check(f"ai:{user['id']}", limit)
    if not ok:
        raise HTTPException(429, BUSY_MSG)

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Rasm fayli bo'sh")
    if mode not in ("homework", "handwriting"):
        mode = "homework"

    sem = _queue_ready()
    try:
        await asyncio.wait_for(sem.acquire(), timeout=_QUEUE_WAIT_S)
    except asyncio.TimeoutError:
        raise HTTPException(429, BUSY_MSG)
    try:
        result = await asyncio.to_thread(solver.solve_image, raw, mode, question.strip())
    finally:
        sem.release()

    q = question.strip() or result.get("image_text") or "Rasm orqali so'ralgan uy vazifasi"
    msg_id = secrets.token_hex(12)
    storage.exec_write(
        """INSERT INTO chat_messages(id, user_id, question, answer, source, created_at)
           VALUES(:id,:uid,:q,:a,:s,:c)""",
        id=msg_id, uid=user["id"], q=q[:500],
        a=json.dumps(result, ensure_ascii=False),
        s=json.dumps({}, ensure_ascii=False),
        c=db.utcnow(),
    )
    return {"result": result, "message_id": msg_id, "remaining": remaining, "recognized": result.get("image_text", "")}


@router.get("/dashboard")
def dashboard(req_: Request):
    """Dashboard uchun statistika: jami, saqlanganlar va fanlar bo'yicha taqsimot."""
    user = auth.current_user(req_)
    rows = storage.exec_all(
        """SELECT id, question, answer, created_at FROM chat_messages
           WHERE user_id=:u ORDER BY created_at DESC LIMIT 500""", u=user["id"],
    )
    saved_rows = storage.exec_all(
        "SELECT COUNT(*) AS n FROM saved_solutions WHERE user_id=:u", u=user["id"],
    )
    total = len(rows)
    by_subject: Dict[str, int] = {}
    for r in rows:
        try:
            answer = json.loads(r["answer"] or "{}")
            subj = answer.get("subject") or ""
        except Exception:
            subj = ""
        if subj:
            by_subject[subj] = by_subject.get(subj, 0) + 1
    recent = [{"id": r["id"], "question": r["question"], "created_at": r["created_at"]} for r in rows[:8]]
    return {
        "total": total,
        "saved": saved_rows[0]["n"] if saved_rows else 0,
        "by_subject": [{"subject": k, "count": v} for k, v in sorted(by_subject.items(), key=lambda kv: -kv[1])],
        "recent": recent,
    }


@router.get("/status")
def status():
    return llm.status()


@router.get("/rate")
def rate(req_: Request):
    user = auth.current_user(req_)
    return {"limit_per_minute": config.MAX_AI_REQUESTS_PER_MINUTE, "concurrency": config.MAX_CONCURRENT_AI_REQUESTS}


@router.get("/history")
def history(req_: Request, limit: int = 50):
    user = auth.current_user(req_)
    rows = storage.exec_all(
        """SELECT id, question, created_at FROM chat_messages
           WHERE user_id=:u ORDER BY created_at DESC LIMIT :l""", u=user["id"], l=min(limit, 100),
    )
    return rows


@router.get("/history/{mid}")
def history_detail(mid: str, req_: Request):
    user = auth.current_user(req_)
    row = storage.exec_one(
        "SELECT * FROM chat_messages WHERE id=:m AND user_id=:u", m=mid, u=user["id"],
    )
    if not row:
        raise HTTPException(404, "Yozuv topilmadi")
    try:
        answer = json.loads(row["answer"])
        source = json.loads(row["source"] or "{}")
    except Exception:
        answer, source = {}, {}
    return {"id": row["id"], "question": row["question"], "answer": answer,
            "source": source, "created_at": row["created_at"]}


@router.delete("/history/{mid}")
def history_delete(mid: str, req_: Request):
    user = auth.current_user(req_)
    storage.exec_write(
        "DELETE FROM chat_messages WHERE id=:m AND user_id=:u", m=mid, u=user["id"],
    )
    storage.exec_write(
        "DELETE FROM saved_solutions WHERE user_id=:u AND message_id=:m", u=user["id"], m=mid,
    )
    return {"ok": True}


@router.post("/save/{mid}")
def save(mid: str, req_: Request):
    user = auth.current_user(req_)
    row = storage.exec_one(
        "SELECT * FROM chat_messages WHERE id=:m AND user_id=:u", m=mid, u=user["id"],
    )
    if not row:
        raise HTTPException(404, "Yozuv topilmadi")
    existing = storage.exec_one(
        "SELECT id FROM saved_solutions WHERE user_id=:u AND message_id=:m", u=user["id"], m=mid,
    )
    if existing:
        return {"ok": True, "already": True}
    storage.exec_write(
        """INSERT INTO saved_solutions(id, user_id, message_id, question, answer, source, created_at)
           VALUES(:id,:u,:m,:q,:a,:s,:c)""",
        id=secrets.token_hex(12), u=user["id"], m=mid,
        q=row["question"], a=row["answer"], s=row["source"], c=db.utcnow(),
    )
    return {"ok": True}


@router.get("/saved")
def saved(req_: Request):
    user = auth.current_user(req_)
    rows = storage.exec_all(
        """SELECT id, message_id, question, source, created_at FROM saved_solutions
           WHERE user_id=:u ORDER BY created_at DESC LIMIT 100""", u=user["id"],
    )
    out = []
    for r in rows:
        try:
            src = json.loads(r["source"] or "{}")
        except Exception:
            src = {}
        out.append({**r, "source": src})
    return out


@router.get("/saved/{sid}")
def saved_detail(sid: str, req_: Request):
    user = auth.current_user(req_)
    row = storage.exec_one(
        "SELECT * FROM saved_solutions WHERE id=:s AND user_id=:u", s=sid, u=user["id"],
    )
    if not row:
        raise HTTPException(404, "Topilmadi")
    try:
        answer = json.loads(row["answer"])
        source = json.loads(row["source"] or "{}")
    except Exception:
        answer, source = {}, {}
    return {"id": row["id"], "question": row["question"], "answer": answer,
            "source": source, "created_at": row["created_at"]}


@router.delete("/saved/{sid}")
def saved_delete(sid: str, req_: Request):
    user = auth.current_user(req_)
    storage.exec_write("DELETE FROM saved_solutions WHERE id=:s AND user_id=:u", s=sid, u=user["id"])
    return {"ok": True}


@router.post("/share/{mid}")
def share(mid: str, req_: Request):
    """Ro'yxatdan o'tmagan kishi ko'rishi mumkin bo'lgan ulashish havolasi yaratadi."""
    user = auth.current_user(req_)
    row = storage.exec_one(
        "SELECT * FROM chat_messages WHERE id=:m AND user_id=:u", m=mid, u=user["id"],
    )
    if not row:
        raise HTTPException(404, "Yozuv topilmadi")
    existing = storage.exec_one(
        "SELECT id FROM shared_solutions WHERE message_id=:m", m=mid,
    )
    if existing:
        token = existing["id"]
    else:
        token = secrets.token_urlsafe(10)
        storage.exec_write(
            """INSERT INTO shared_solutions(id, message_id, owner_id, question, answer, source, created_at)
               VALUES(:id,:m,:o,:q,:a,:s,:c)""",
            id=token, m=mid, o=user["id"], q=row["question"], a=row["answer"],
            s=row["source"], c=db.utcnow(),
        )
    base = config.PUBLIC_BASE_URL or f"{req.base_url}".rstrip("/")
    return {"ok": True, "url": f"{base}/#/share/{token}"}