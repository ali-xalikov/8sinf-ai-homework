from __future__ import annotations

import asyncio
import secrets
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .. import auth, config, db, llm, ratelimit, retriever, solver, storage

router = APIRouter(prefix="/api/chat", tags=["chat"])

_sem: asyncio.Semaphore | None = None
_QUEUE_WAIT_S = 8.0

MAX_HISTORY_MESSAGES = 30

CHAT_SYSTEM = (
    "Siz «8-sinf AI Homework» chat-assistantisiz. O'quvchiga barcha fanlardan uy "
    "vazifasini bajarishda yordam berasiz. Suhbat davomida avvalgi savollar va "
    "javoblarni eslab qolasiz: ular o'sha bitta uy vazifasining konteksti. "
    "Javoblar aniq, qisqa va o'quvchiga tushunarli bo'lsin. Formulalarni matn "
    "ko'rinishida yozing: x^2, sqrt(x), 5/2."
)


def _queue_ready() -> asyncio.Semaphore:
    global _sem
    if _sem is None or _sem._value != config.MAX_CONCURRENT_AI_REQUESTS:
        _sem = asyncio.Semaphore(config.MAX_CONCURRENT_AI_REQUESTS)
    return _sem


class SendRequest(BaseModel):
    message: str


class CreateRequest(BaseModel):
    message: str = ""


def _conv_payload(row: Dict) -> Dict:
    return {
        "id": row["id"], "title": row["title"], "subject": row["subject"],
        "created_at": row["created_at"], "updated_at": row["updated_at"],
    }


def _msg(row: Dict) -> Dict:
    return {
        "id": row["id"], "role": row["role"], "content": row["content"],
        "created_at": row["created_at"],
    }


def _get_conv(cid: str, uid: str) -> Dict:
    row = storage.exec_one(
        "SELECT * FROM conversations WHERE id=:c AND user_id=:u", c=cid, u=uid,
    )
    if not row:
        raise HTTPException(404, "Suhbat topilmadi")
    return row


def _title_of(msg: str) -> str:
    t = " ".join(msg.split())
    return t[:60] + ("…" if len(t) > 60 else "")


def _recent_history(cid: str) -> List[Dict]:
    rows = storage.exec_all(
        """SELECT * FROM conversation_messages WHERE conversation_id=:c
           ORDER BY created_at, rowid DESC LIMIT :l""", c=cid, l=MAX_HISTORY_MESSAGES,
    )
    rows.reverse()
    return rows


def _get_messages(cid: str) -> List[Dict]:
    rows = storage.exec_all(
        """SELECT * FROM conversation_messages WHERE conversation_id=:c
           ORDER BY created_at, rowid""", c=cid,
    )
    return [_msg(r) for r in rows]


@router.post("")
def create(req: CreateRequest, req_: Request):
    """Yangi suhbat ochadi. Ixtiyoriy birinchi habar va javob."""
    user = auth.current_user(req_)
    cid = secrets.token_hex(12)
    msg = req.message.strip()
    subject = ""
    if msg:
        subject = solver.detect_subject(msg, retriever.parse_question(msg))
    storage.exec_write(
        """INSERT INTO conversations(id, user_id, title, subject, created_at, updated_at)
           VALUES(:id,:u,:t,:s,:c,:c)""",
        id=cid, u=user["id"], t=_title_of(msg) if msg else "Yangi suhbat",
        s=subject, c=db.utcnow(),
    )
    conv = _conv_payload(_get_conv(cid, user["id"]))
    if not msg:
        return {"conversation": conv, "messages": []}
    return send(user, cid, msg)


@router.get("")
def list_chats(req_: Request):
    user = auth.current_user(req_)
    rows = storage.exec_all(
        """SELECT * FROM conversations WHERE user_id=:u
           ORDER BY updated_at DESC LIMIT 100""", u=user["id"],
    )
    return [_conv_payload(r) for r in rows]


@router.get("/{cid}")
def detail(cid: str, req_: Request):
    user = auth.current_user(req_)
    conv = _get_conv(cid, user["id"])
    return {"conversation": _conv_payload(conv), "messages": _get_messages(cid)}


@router.post("/{cid}/send")
def send_raw(cid: str, req: SendRequest, req_: Request):
    user = auth.current_user(req_)
    _get_conv(cid, user["id"])
    return send(user, cid, req.message.strip())


def send(user: Dict, cid: str, msg: str) -> Dict:
    if not msg:
        raise HTTPException(400, "Habarni yozing")
    conv = _get_conv(cid, user["id"])
    limit = 0 if user["role"] == "admin" else config.MAX_AI_REQUESTS_PER_MINUTE
    ok, remaining = ratelimit.check(f"chat:{user['id']}", limit)
    if not ok:
        raise HTTPException(429, "AI hozir band. Birozdan keyin qayta urinib ko'ring.")

    storage.exec_write(
        """INSERT INTO conversation_messages(id, conversation_id, role, content, created_at)
           VALUES(:id,:c,'user',:content,:t)""",
        id=secrets.token_hex(12), c=cid, content=msg, t=db.utcnow(),
    )

    history = _recent_history(cid)
    llm_messages: List[Dict[str, str]] = [{"role": "system", "content": CHAT_SYSTEM}]
    for r in history:
        llm_messages.append({"role": r["role"], "content": r["content"]})

    if llm.provider() == "none":
        reply = "AI yechim tayyor emas: serverda LLM sozlanmagan. Administratorga murojaat qiling."
    else:
        try:
            reply = llm.chat(llm_messages, temperature=0.4)
        except Exception as e:
            reply = f"AI chaqiruvida muammo yuz berdi: {e}"

    storage.exec_write(
        """INSERT INTO conversation_messages(id, conversation_id, role, content, created_at)
           VALUES(:id,:c,'assistant',:content,:t)""",
        id=secrets.token_hex(12), c=cid, content=reply, t=db.utcnow(),
    )

    subject = conv["subject"] or solver.detect_subject(msg, retriever.parse_question(msg))
    storage.exec_write(
        """UPDATE conversations SET title=:t, subject=:s, updated_at=:u WHERE id=:c""",
        t=_title_of(msg) if conv["title"] in ("", "Yangi suhbat") else conv["title"],
        s=subject, u=db.utcnow(), c=cid,
    )

    return {
        "conversation": _conv_payload(_get_conv(cid, user["id"])),
        "messages": _get_messages(cid),
        "reply": reply,
        "remaining": remaining,
    }


@router.delete("/{cid}")
def delete_chat(cid: str, req_: Request):
    user = auth.current_user(req_)
    _get_conv(cid, user["id"])
    storage.exec_write("DELETE FROM conversation_messages WHERE conversation_id=:c", c=cid)
    storage.exec_write("DELETE FROM conversations WHERE id=:c", c=cid)
    return {"ok": True}