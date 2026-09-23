from __future__ import annotations

import logging
from typing import Any, Dict, List

import requests

from . import config

log = logging.getLogger(__name__)

MODEL_GUARD = "Faoliyat: faqat 8-sinf darsliklariga asoslanib javob berish."


def provider() -> str:
    return config.effective_provider()


_RETRY_STATUS = {401, 403, 429, 500, 502, 503, 504}


def _chat_openai(messages: List[Dict[str, str]], temperature: float) -> str:
    url = f"{config.OPENAI_BASE_URL}/chat/completions"
    payload = {"model": config.OPENAI_MODEL, "messages": messages, "temperature": temperature}
    keys = config.OPENAI_API_KEYS or [config.OPENAI_API_KEY]
    last_err: Exception | None = None
    for idx, key in enumerate(keys):
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=config.AI_REQUEST_TIMEOUT_S)
        except requests.RequestException as e:
            last_err = e
            continue
        if r.status_code in _RETRY_STATUS:
            last_err = requests.HTTPError(
                f"{r.status_code} Client Error for url: {url}", response=r
            )
            if idx + 1 < len(keys):
                log.warning("AI kalit %d/%d xato (%s), keyingisiga o'tilmoqda",
                            idx + 1, len(keys), r.status_code)
            continue
        r.raise_for_status()
        data = r.json()
        return (data["choices"][0]["message"]["content"] or "").strip()
    if last_err is not None:
        raise last_err
    raise RuntimeError("AI kaliti sozlanmagan")


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


def _chat_openai_vision(
    messages: List[Dict[str, str]], image_b64: str, mime: str, temperature: float
) -> str:
    """OpenAI-mos (Gemini/Groq/OpenRouter/Cerebras...) vision chat.

    Oxirgi user xabariga rasm `image_url` qismi sifatida qo'shiladi.
    Model vision'ni qo'llamasdan 400 qaytarsa xatolik ko'tariladi —
    chaqiruvchi OCR'ga qaytishi mumkin.
    """
    url = f"{config.OPENAI_BASE_URL}/chat/completions"
    model = config.VISION_MODEL or config.OPENAI_MODEL
    content_messages: List[Dict[str, Any]] = []
    for m in messages:
        content_messages.append({"role": m["role"], "content": m["content"]})
    last = content_messages[-1]
    last["content"] = [
        {"type": "text", "text": last["content"]},
        {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{image_b64}"},
        },
    ]
    payload = {"model": model, "messages": content_messages, "temperature": temperature}
    keys = config.OPENAI_API_KEYS or [config.OPENAI_API_KEY]
    last_err: Exception | None = None
    for idx, key in enumerate(keys):
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=config.AI_REQUEST_TIMEOUT_S)
        except requests.RequestException as e:
            last_err = e
            continue
        if r.status_code in _RETRY_STATUS:
            last_err = requests.HTTPError(
                f"{r.status_code} Client Error for url: {url}", response=r
            )
            if idx + 1 < len(keys):
                log.warning("AI vision kalit %d/%d xato (%s), keyingisiga o'tilmoqda",
                            idx + 1, len(keys), r.status_code)
            continue
        r.raise_for_status()
        data = r.json()
        return (data["choices"][0]["message"]["content"] or "").strip()
    if last_err is not None:
        raise last_err
    raise RuntimeError("AI kaliti sozlanmagan")


def _chat_ollama_vision(
    messages: List[Dict[str, str]], image_b64: str, mime: str, temperature: float
) -> str:
    url = f"{config.OLLAMA_BASE_URL}/api/chat"
    msgs: List[Dict[str, Any]] = []
    for i, m in enumerate(messages):
        entry: Dict[str, Any] = {"role": m["role"], "content": m["content"]}
        if i == len(messages) - 1:
            entry["images"] = [image_b64]
        msgs.append(entry)
    payload = {
        "model": config.OLLAMA_MODEL, "messages": msgs, "stream": False,
        "options": {"temperature": temperature},
    }
    r = requests.post(url, json=payload, timeout=config.AI_REQUEST_TIMEOUT_S)
    r.raise_for_status()
    data = r.json()
    return (data.get("message", {}).get("content") or "").strip()


def chat_vision(
    messages: List[Dict[str, str]],
    image_b64: str,
    mime: str = "image/jpeg",
    temperature: float = 0.2,
) -> str:
    """Rasmni ko'ra oladigan provayderga chat so'rovini yuboradi.

    Vision'ni qo'llamaydigan model/alomatda xatolik ko'tariladi (OCR fallback uchun).
    """
    p = provider()
    if p == "openai":
        return _chat_openai_vision(messages, image_b64, mime, temperature)
    if p == "ollama":
        return _chat_ollama_vision(messages, image_b64, mime, temperature)
    raise RuntimeError("AI provayder sozlanmagan")


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
        "provider": config.provider_label(),
        "transport": p,
        "configured": p in ("openai", "ollama"),
        "model": config.OPENAI_MODEL if p == "openai" else config.OLLAMA_MODEL,
        "endpoint": config.OPENAI_BASE_URL if p == "openai" else config.OLLAMA_BASE_URL,
        "keys": len(config.OPENAI_API_KEYS),
        "note": ("SERVER tomonidan sozlanadi: administrator .env faylida OPENAI_API_KEY "
                 "qo'ysin yoki Ollama'ni ishga tushirsin.")
        if p == "none"
        else "",
    }