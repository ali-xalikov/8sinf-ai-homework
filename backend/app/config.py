from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------
# Loyiha yo'llari
# ---------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]          # "8-sinf AI Homework/"
BACKEND_DIR = PROJECT_ROOT / "backend"
BOOKS_DIR = PROJECT_ROOT / "books"
INDEX_DIR = PROJECT_ROOT / "index"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
LEGACY_DIR = FRONTEND_DIR / "legacy"
DIST_DIR = FRONTEND_DIR / "dist"
DB_PATH = INDEX_DIR / "library.db"
METADATA_FILE = BOOKS_DIR / "metadata.json"


def web_root() -> Path:
    """React build (dist) mavjud bo'lsa o'shani, aks holda legacy frontend'ni xizmat qiladi."""
    if (DIST_DIR / "index.html").exists():
        return DIST_DIR
    if (LEGACY_DIR / "index.html").exists():
        return LEGACY_DIR
    return FRONTEND_DIR


def resolve_path(p: str) -> Path:
    """Kitob PDF yo'lini CWD'dan qat'i nazar absolyut qiladi.

    metadata.json'da 'books/...' ko'rinishida saqlanadi. Server qaysi
    papkadan ishga tushishidan qat'i nazar to'g'ri faylni topish uchun
    nisbiy yo'llar PROJECT_ROOT'ga bog'lanadi.
    """
    path = Path(p)
    if path.is_absolute():
        return path
    return (PROJECT_ROOT / path).resolve()


for _d in (BOOKS_DIR, INDEX_DIR, FRONTEND_DIR):
    _d.mkdir(parents=True, exist_ok=True)


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        pass


_load_dotenv(PROJECT_ROOT / ".env")


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def env_int(key: str, default: int) -> int:
    try:
        return int(env(key, str(default)))
    except Exception:
        return default


def env_bool(key: str, default: bool) -> bool:
    v = env(key, "").strip().lower()
    if not v:
        return default
    return v in ("1", "true", "yes", "on")

# ---------------------------------------------------------------
# Qurilma / Tarmoq
# ---------------------------------------------------------------
# 0.0.0.0 -> LAN/Wi-Fi ichidagi barcha qurilmalar kiradi. Internet uchun Reverse Proxy.
HOST = env("HOST", "0.0.0.0")
PORT = env_int("PORT", 3000)

# Umumiy (panjara) URL: ulashilgan havola va brauzer manzillari uchun
PUBLIC_BASE_URL = env("PUBLIC_BASE_URL", "").rstrip("/")

# ---------------------------------------------------------------
# Ma'lumotlar bazasi
# ---------------------------------------------------------------
# Bo'sh bo'lsa -> SQLite (mahalliy). PostgreSQL uchun:
#   DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname
DATABASE_URL = env("DATABASE_URL", "").strip()

# ---------------------------------------------------------------
# AI (LLM) sozlamalari
# ---------------------------------------------------------------
# LLM_PROVIDER: "gemini" | "groq" | "cerebras" | "openrouter" | "mistral"
#               | "openai" | "ollama" | "auto" | "none"
# Bepul provayderlar OpenAI-mos endpoint ishlatadi, shuning uchun faqat
# LLM_PROVIDER + OPENAI_API_KEY berish yetarli (base_url/model presetdan olinadi).
PROVIDER_PRESETS: Dict[str, Dict[str, str]] = {
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.5-flash",
        "label": "Google Gemini",
        "keys_url": "https://aistudio.google.com/apikey",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "openai/gpt-oss-120b",
        "label": "Groq",
        "keys_url": "https://console.groq.com/keys",
    },
    "cerebras": {
        "base_url": "https://api.cerebras.ai/v1",
        "model": "llama-3.3-70b",
        "label": "Cerebras",
        "keys_url": "https://cloud.cerebras.ai",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "model": "meta-llama/llama-3.3-70b-instruct:free",
        "label": "OpenRouter",
        "keys_url": "https://openrouter.ai/keys",
    },
    "mistral": {
        "base_url": "https://api.mistral.ai/v1",
        "model": "mistral-small-latest",
        "label": "Mistral",
        "keys_url": "https://console.mistral.ai/api-keys",
    },
}

LLM_PROVIDER = env("LLM_PROVIDER", "auto").strip().lower()
_preset = PROVIDER_PRESETS.get(LLM_PROVIDER)


def _env_or(key: str, default: str) -> str:
    """Bo'sh qiymat ham default'ni ishlatadi (presetga qaytish uchun)."""
    v = env(key, "").strip()
    return v or default


def _parse_keys(*vals: str) -> List[str]:
    """Kalitlarni vergul/nuqta-vergul bilan ajratib, takrorlanmaydigan ro'yxat qaytaradi."""
    out: List[str] = []
    for v in vals:
        for part in (v or "").replace(";", ",").split(","):
            k = part.strip()
            if k and k not in out:
                out.append(k)
    return out


# Bir nechta kalit: asosiy OPENAI_API_KEY + qo'shimcha AI_API_KEYS / AI_API_KEY.
# Limit tugasa (429) keyingi kalitga avtomatik o'tiladi (llm.py).
OPENAI_API_KEYS = _parse_keys(
    env("OPENAI_API_KEY", ""), env("AI_API_KEY", ""), env("AI_API_KEYS", "")
)
OPENAI_API_KEY = OPENAI_API_KEYS[0] if OPENAI_API_KEYS else ""
OPENAI_BASE_URL = _env_or(
    "OPENAI_BASE_URL",
    _preset["base_url"] if _preset else "https://api.openai.com/v1",
).rstrip("/")
OPENAI_MODEL = _env_or("OPENAI_MODEL", _preset["model"] if _preset else "gpt-4o-mini")
# Rasm/tasvir tushuntirish uchun vision model. Bo'lsa (multimodal) ishlatiladi;
# bo'lmasa OCR + matn modeli bilan ishlaydi.
VISION_MODEL = env("VISION_MODEL", "").strip() or OPENAI_MODEL

OLLAMA_BASE_URL = env("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = env("OLLAMA_MODEL", "qwen2.5:7b")

# ---------------------------------------------------------------
# AI navbati va chegara
# ---------------------------------------------------------------
MAX_CONCURRENT_AI_REQUESTS = env_int("MAX_CONCURRENT_AI_REQUESTS", 3)
MAX_AI_REQUESTS_PER_MINUTE = env_int("MAX_AI_REQUESTS_PER_MINUTE", 10)
AI_REQUEST_TIMEOUT_S = env_int("AI_REQUEST_TIMEOUT_S", 240)

# ---------------------------------------------------------------
# Admin (birinchi ishga tushirishda yaratiladi)
# ---------------------------------------------------------------
ADMIN_USERNAME = env("ADMIN_USERNAME", "admin")
# Bo'sh bo'lsa: tasodifiy parol generatsiya qilinadi va konsolga chiqariladi
ADMIN_PASSWORD = env("ADMIN_PASSWORD", "")

# ---------------------------------------------------------------
# Sessiya / xavfsizlik
# ---------------------------------------------------------------
SESSION_DAYS = env_int("SESSION_DAYS", 30)

# ---------------------------------------------------------------
# OCR va indekslash
# ---------------------------------------------------------------
OCR_ENABLED = env_bool("OCR_ENABLED", True)
TESSDATA_PREFIX = env("TESSDATA_PREFIX", "")

MIN_TEXT_CHARS_PER_PAGE = env_int("MIN_TEXT_CHARS_PER_PAGE", 40)
CHUNK_SIZE = env_int("CHUNK_SIZE", 600)
CHUNK_OVERLAP = env_int("CHUNK_OVERLAP", 100)
MAX_PAGE_TEXT_FOR_LLM = env_int("MAX_PAGE_TEXT_FOR_LLM", 5000)
RENDER_DPI = env_int("RENDER_DPI", 150)


def to_dict() -> Dict[str, Any]:
    return {
        "llm_provider": LLM_PROVIDER,
        "provider_label": provider_label(),
        "llm_configured": bool(OPENAI_API_KEY) or LLM_PROVIDER in ("ollama", "auto"),
        "openai": {"base_url": OPENAI_BASE_URL, "model": OPENAI_MODEL,
                   "key_set": bool(OPENAI_API_KEYS), "keys": len(OPENAI_API_KEYS)},
        "ollama": {"url": OLLAMA_BASE_URL, "model": OLLAMA_MODEL},
        "ocr_enabled": OCR_ENABLED,
        "rate_limit_per_minute": MAX_AI_REQUESTS_PER_MINUTE,
        "concurrency": MAX_CONCURRENT_AI_REQUESTS,
        "database": "postgresql" if DATABASE_URL else "sqlite",
    }


def provider_label() -> str:
    """Foydalanuvchiga ko'rsatiladigan provayder nomi (masalan 'gemini')."""
    transport = effective_provider()
    if transport == "none":
        return "none"
    if transport == "ollama":
        return "ollama"
    if LLM_PROVIDER in PROVIDER_PRESETS:
        return LLM_PROVIDER
    return LLM_PROVIDER or "openai"


def effective_provider() -> str:
    """Transport: 'openai' (OpenAI-mos) | 'ollama' | 'none'."""
    from . import checkers
    if LLM_PROVIDER == "none":
        return "none"
    if LLM_PROVIDER == "ollama":
        return "ollama"
    if LLM_PROVIDER in PROVIDER_PRESETS or LLM_PROVIDER == "openai":
        return "openai" if OPENAI_API_KEY else "none"
    if OPENAI_API_KEY:
        return "openai"
    if checkers.ollama_ping():
        return "ollama"
    return "none"