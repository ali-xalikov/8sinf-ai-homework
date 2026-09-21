"""Standart API xato format va exception handlerlar."""
from __future__ import annotations

from typing import Dict

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def _code_for(status: int, detail: str, path: str) -> str:
    if status == 401:
        return "AUTH_REQUIRED"
    if status == 403:
        return "AUTH_INVALID"
    if status == 429:
        return "RATE_LIMITED"
    low = (detail or "").lower()
    if status == 404:
        if "sahifa" in low:
            return "PAGE_NOT_FOUND"
        if "mashq" in low or "yozuv" in low or "topilmadi" in low and "kitob" not in low:
            return "EXERCISE_NOT_FOUND"
        if "pdf" in low or "fayl" in low:
            return "PDF_NOT_FOUND"
        return "BOOK_NOT_FOUND"
    if status == 500:
        return "SERVER_ERROR"
    return "SERVER_ERROR"


def _envelope(status: int, detail: str, path: str) -> Dict:
    code = _code_for(status, detail, path)
    return {
        "success": False,
        "error": {"code": code, "message": detail},
        "detail": detail,
    }


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def _http_exc(req: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.status_code, str(exc.detail), req.url.path),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_exc(req: Request, exc: RequestValidationError):
        msg = "So‘rov ma'lumotlari noto‘g‘ri"
        try:
            first = exc.errors()[0]
            loc = ".".join(str(x) for x in first.get("loc", []))
            msg = f"{first.get('msg', msg)} ({loc})"
        except Exception:
            pass
        return JSONResponse(status_code=422, content=_envelope(422, msg, req.url.path))

    @app.middleware("http")
    async def _server_errors(req: Request, call_next):
        try:
            return await call_next(req)
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            import logging

            logging.getLogger("app").exception("Unhandled error on %s", req.url.path)
            return JSONResponse(
                status_code=500,
                content=_envelope(500, "Serverda kutilmagan xatolik yuz berdi", req.url.path),
            )