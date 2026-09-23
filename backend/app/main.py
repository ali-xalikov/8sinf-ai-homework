from __future__ import annotations

import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import auth, config, db, errors, indexer, llm, storage
from .routes import admin, ai, answers, auth_routes, books, chat, pages, share, system

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")

ALLOWED_ORIGINS = [
    o.strip() for o in (config.env("ALLOWED_ORIGINS", "").split(",") if config.env("ALLOWED_ORIGINS") else [])
    if o.strip()
]
ALLOWED_ORIGIN_REGEX = config.env("ALLOWED_ORIGIN_REGEX", "").strip()


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.init_schema()
    added = db.sync_from_metadata()
    if added:
        log.info("metadata -> DB: %d yangi kitob", added)
    info = indexer.refresh_vector()
    log.info("vektor indeks: %s chunk, %s kitob", info.get("chunks"), info.get("books"))
    admin_result = auth.bootstrap_admin()
    if admin_result["created"]:
        log.warning("Yangi ADMIN yaratildi: username=%s password=%s",
                    admin_result["username"], admin_result["password"])
        log.warning("Iltimos, parolni o'zgartiring yoki .env da ADMIN_PASSWORD bilan belgilang.")
    else:
        log.info("Admin mavjud: %s", admin_result.get("username"))
    log.info("AI provayder: %s (transport: %s)", config.provider_label(), llm.provider())
    log.info("Web root: %s", config.web_root())
    yield


app = FastAPI(title="8-sinf AI Homework", version="3.0.0", lifespan=lifespan)

# CORS har doim qo'shiladi. Bo'sh ro'yxat -> cross-origin so'rov yo'q (xavfsiz default).
# "*" -> barcha origin'lar, lekin credentials'siz (Bearer token ishlatilgani uchun yetarli).
if "*" in ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_origin_regex=ALLOWED_ORIGIN_REGEX or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth_routes.router)
app.include_router(books.router)
app.include_router(pages.router)
app.include_router(ai.router)
app.include_router(chat.router)
app.include_router(answers.router)
app.include_router(admin.router)
app.include_router(share.router)
app.include_router(system.router)

errors.register_error_handlers(app)

WEB_ROOT = config.web_root()


@app.get("/health")
def health_root():
    """Hosting healthcheck uchun yengil endpoint (DB'ga murojaat qilmaydi)."""
    return {"status": "ok"}


@app.get("/")
def index():
    return FileResponse(WEB_ROOT / "index.html")


@app.get("/admin")
def admin_page():
    return RedirectResponse("/#/admin")


@app.get("/legacy")
def legacy_page():
    return RedirectResponse("/legacy/")


@app.get("/s/{token}")
def shared_link(token: str):
    base = config.PUBLIC_BASE_URL
    target = f"{base}/#/share/{token}" if base else f"/#/share/{token}"
    return RedirectResponse(target)


def _mount_static():
    """React dist statik fayllari (assets) hamda eski frontend uchun /static va /legacy."""
    if (config.DIST_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=config.DIST_DIR / "assets"), name="assets")
    if config.LEGACY_DIR.exists():
        # Eski app va share.js/css foydalanuvchilari uchun saqlanadi
        app.mount("/legacy", StaticFiles(directory=config.LEGACY_DIR, html=True), name="legacy")
        app.mount("/static", StaticFiles(directory=config.LEGACY_DIR), name="static")


_mount_static()

# SPA fallback: /api dan boshqa barcha route'larda index.html yoki real faylni qaytaradi
@app.get("/{full_path:path}")
def spa(full_path: str):
    from fastapi.responses import JSONResponse

    def _json(status: int, msg: str):
        return JSONResponse(status_code=status, content={
            "success": False, "error": {"code": "SERVER_ERROR", "message": msg}, "detail": msg,
        })

    if full_path.startswith("api/"):
        return _json(404, "Topilmadi")
    if ".." in full_path or full_path.startswith(".") or (full_path and "." in full_path.split("/")[0]):
        return _json(400, "Noto'g'ri so'rov")
    root = WEB_ROOT
    candidate = Path(root) / (full_path or "")
    try:
        resolved = candidate.resolve()
        root_resolved = Path(root).resolve()
        if root_resolved in resolved.parents and resolved.is_file():
            return FileResponse(resolved)
    except Exception:
        pass
    # Fayl ko'rinishidagi (kengaytmali) yo'l topilmasa 404 qaytaramiz,
    # aks holda SPA routing uchun index.html.
    if re.search(r"\.(?:js|css|html?|json|png|jpe?g|svg|ico|webp|gif|woff2?|ttf|txt|log|env|map)$", full_path, re.I):
        return _json(404, "Topilmadi")
    return FileResponse(root / "index.html")