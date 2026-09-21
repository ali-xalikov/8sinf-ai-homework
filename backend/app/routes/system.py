from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .. import checkers, config, llm

router = APIRouter(tags=["system"])


@router.get("/api/health")
def health():
    return {"status": "ok"}


@router.get("/api/health/ai")
def health_ai():
    provider = llm.provider()
    return {
        "status": "ok" if provider in ("openai", "ollama") else "degraded",
        "provider": provider or "none",
        "model": config.OPENAI_MODEL if provider == "openai" else config.OLLAMA_MODEL,
        "ollama_online": checkers.ollama_ping() if provider == "ollama" else None,
    }


@router.get("/api/health/database")
def health_database():
    from .. import storage

    engine = "postgresql" if config.DATABASE_URL else "sqlite"
    try:
        storage.exec_one("SELECT 1 AS ok")
        status = "ok"
    except Exception:
        status = "error"
    return {"status": status, "engine": engine}


@router.get("/api/server/info")
def server_info_public(req: Request):
    """Serverdagi ommaviy (sing-in talab qilmaydigan) ma'lumot."""
    return {"app": "8-sinf AI Homework", "version": "3.0.0", "base_url": str(req.base_url)}