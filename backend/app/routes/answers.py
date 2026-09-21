from __future__ import annotations

import secrets
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .. import auth, db, storage

router = APIRouter(prefix="/api", tags=["answers"])

KINDS = ("bsb", "chsb", "other")
VALID_SUBJECTS = {s["id"] for s in db.DEFAULT_SUBJECTS}


def _clean_kind(kind: str) -> str:
    k = (kind or "").strip().lower()
    return k if k in KINDS else "other"


def _clean_subject(subject_id: str) -> str:
    sid = (subject_id or "").strip()
    return sid if sid in VALID_SUBJECTS else ""


def _public(row: Dict[str, Any]) -> Dict[str, Any]:
    sid = row.get("subject_id") or ""
    return {
        "id": row["id"],
        "subject_id": sid,
        "subject_name": db.subject_name(sid) if sid else "",
        "kind": row.get("kind") or "other",
        "title": row.get("title") or "",
        "content": row.get("content") or "",
        "created_by": row.get("created_by") or "",
        "created_at": row.get("created_at") or "",
        "updated_at": row.get("updated_at") or "",
    }


# ---------------------------------------------------------------------------
# Foydalanuvchilar uchun (o'quvchi/admin ko'ra oladi)
# ---------------------------------------------------------------------------
@router.get("/answers")
def list_answers(req: Request, subject_id: str = "", kind: str = ""):
    auth.current_user(req)
    where: List[str] = []
    params: Dict[str, Any] = {}
    if subject_id.strip():
        where.append("subject_id=:sid")
        params["sid"] = subject_id.strip()
    if kind.strip():
        where.append("kind=:k")
        params["k"] = _clean_kind(kind)
    sql = "SELECT * FROM answers"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC"
    return [_public(r) for r in storage.exec_all(sql, **params)]


@router.get("/answers/{aid}")
def answer_detail(aid: str, req: Request):
    auth.current_user(req)
    row = storage.exec_one("SELECT * FROM answers WHERE id=:id", id=aid)
    if not row:
        raise HTTPException(404, "Javob topilmadi")
    return _public(row)


# ---------------------------------------------------------------------------
# Admin boshqaruvi
# ---------------------------------------------------------------------------
class AnswerIn(BaseModel):
    subject_id: str = ""
    kind: str = "bsb"
    title: str
    content: str = ""


@router.get("/admin/answers")
def admin_list(req: Request):
    auth.require_admin(req)
    return [_public(r) for r in storage.exec_all("SELECT * FROM answers ORDER BY created_at DESC")]


@router.post("/admin/answers")
def create_answer(body: AnswerIn, req: Request):
    user = auth.require_admin(req)
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(400, "Sarlavha bo'sh bo'lishi mumkin emas")
    aid = secrets.token_hex(12)
    now = db.utcnow()
    storage.exec_write(
        """INSERT INTO answers(id, subject_id, kind, title, content, created_by, created_at, updated_at)
           VALUES(:id,:sid,:k,:t,:c,:u,:n,:n)""",
        id=aid, sid=_clean_subject(body.subject_id), k=_clean_kind(body.kind),
        t=title[:300], c=body.content or "", u=user["id"], n=now,
    )
    row = storage.exec_one("SELECT * FROM answers WHERE id=:id", id=aid)
    return _public(row)


@router.put("/admin/answers/{aid}")
def update_answer(aid: str, body: AnswerIn, req: Request):
    auth.require_admin(req)
    existing = storage.exec_one("SELECT id FROM answers WHERE id=:id", id=aid)
    if not existing:
        raise HTTPException(404, "Javob topilmadi")
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(400, "Sarlavha bo'sh bo'lishi mumkin emas")
    storage.exec_write(
        """UPDATE answers SET subject_id=:sid, kind=:k, title=:t, content=:c, updated_at=:n
           WHERE id=:id""",
        id=aid, sid=_clean_subject(body.subject_id), k=_clean_kind(body.kind),
        t=title[:300], c=body.content or "", n=db.utcnow(),
    )
    row = storage.exec_one("SELECT * FROM answers WHERE id=:id", id=aid)
    return _public(row)


@router.delete("/admin/answers/{aid}")
def delete_answer(aid: str, req: Request):
    auth.require_admin(req)
    storage.exec_write("DELETE FROM answers WHERE id=:id", id=aid)
    return {"ok": True}
