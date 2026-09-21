"""
Soddaxon background indekslash ish joyi (in-memory registry).
Admin yoki book upload ishlab tushirsa, shu modul ichida ThreadPoolExecutor orqali
tekshiruv + indekslash amalga oshiriladi va /api/admin/indexing/{job_id} orqali progress tekshiriladi.
"""
from __future__ import annotations

import concurrent.futures
import datetime
import logging
import secrets
import threading
from typing import Any, Dict, Optional

log = logging.getLogger("jobs")

_executor: Optional[concurrent.futures.ThreadPoolExecutor] = None
_lock = threading.Lock()
_jobs: Dict[str, Dict[str, Any]] = {}


def _get_executor() -> concurrent.futures.ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="indexing")
    return _executor


def _run(job_id: str, bid: str) -> None:
    from app import indexer

    with _lock:
        _jobs[job_id]["status"] = "running"
        _jobs[job_id]["progress"] = 0

    try:
        from app import db

        book = db.get_book(bid)
        if not book:
            with _lock:
                _jobs[job_id].update(status="error", detail="Kitob topilmadi", progress=0)
            return

        with _lock:
            _jobs[job_id].update(progress=10, detail="Matn chiqarilmoqda…")

        result = indexer.index_book(book, force=True)

        with _lock:
            _jobs[job_id].update(progress=80, detail="Vektor indeks qurilmoqda…")

        vec = indexer.refresh_vector()

        with _lock:
            _jobs[job_id].update(
                status="done",
                progress=100,
                detail="Tayyor",
                result={**result, "vector": vec},
            )
    except Exception as e:
        log.exception("Indexing job %s failed for %s", job_id, bid)
        with _lock:
            _jobs[job_id].update(status="error", detail=str(e), progress=0)


def start_job(bid: str) -> str:
    job_id = secrets.token_hex(8)
    now = datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
    with _lock:
        _jobs[job_id] = {
            "id": job_id,
            "book_id": bid,
            "status": "pending",
            "progress": 0,
            "detail": "Navbatda kutilmoqda…",
            "created_at": now,
            "result": None,
        }
    _get_executor().submit(_run, job_id, bid)
    return job_id


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        return _jobs.get(job_id)