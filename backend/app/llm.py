from __future__ import annotations

from typing import Any, Dict, List

import requests

from . import config

MODEL_GUARD = "Faoliyat: faqat 8-sinf darsliklariga asoslanib javob berish."


def provider() -> str:
    return config.effective_provider()


def _chat_openai(messages: List[Dict[str, str]], temperature: float) -> str:
    url = f"{config.OPENAI_BASE_URL}/chat/completions"
    headers = {"Authorization": f"Bearer {config.OPENAI_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": config.OPENAI_MODEL, "messages": messages, "temperature": temperature}
    r = requests.post(url, headers=headers, json=payload, timeout=config.AI_REQUEST_TIMEOUT_S)
    r.raise_for_status()
    data = r.json()
    return (data["choices"][0]["message"]["content"] or "").strip()


def _chat_ollama(messages: List[Dict[str, str]], temperature: float) -> str:
    url = f"{config.OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": config.OLLAMA_MODEL, "messages": messages, "stream": False,
        "options": {"temperature": temperature},
    }
    r = requests.post(url, json=payload, timeout=config.AI_REQUEST_TIMEOUT_S)
    r.raise_for_status()
    data = r.json()
    return (data.get("message", {}).get("content") or "").strip()


def chat(messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
    p = provider()
    if p == "openai":
        return _chat_openai(messages, temperature)
    if p == "ollama":
        return _chat_ollama(messages, temperature)
    raise RuntimeError("AI provayder sozlanmagan")


def status() -> Dict[str, Any]:
    p = provider()
    return {
        "provider": p,
        "configured": p in ("openai", "ollama"),
        "model": config.OPENAI_MODEL if p == "openai" else config.OLLAMA_MODEL,
        "endpoint": config.OPENAI_BASE_URL if p == "openai" else config.OLLAMA_BASE_URL,
        "note": ("SERVER tomonidan sozlanadi: administrator .env faylida OPENAI_API_KEY "
                 "qo'ysin yoki Ollama'ni ishga tushirsin.")
        if p == "none"
        else "",
    }