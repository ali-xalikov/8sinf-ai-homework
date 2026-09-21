from __future__ import annotations

import requests


def ollama_ping() -> bool:
    from . import config
    try:
        r = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False