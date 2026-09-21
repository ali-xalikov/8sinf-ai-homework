from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response

from .. import config, storage

router = APIRouter(prefix="/api/share", tags=["share"])


@router.get("/{token}")
def get_shared(token: str):
    row = storage.exec_one(
        "SELECT question, answer, source, created_at FROM shared_solutions WHERE id=:t", t=token,
    )
    if not row:
        raise HTTPException(404, "Bunday yechim mavjud emas")
    try:
        answer = json.loads(row["answer"])
        source = json.loads(row["source"] or "{}")
    except Exception:
        answer, source = {}, {}
    # Hech qanday foydalanuvchi ma'lumoti (username, id) qaytarilmaydi
    return {
        "question": row["question"],
        "answer": answer,
        "source": source,
        "created_at": row["created_at"],
    }


# Ulashilgan yechimni chiroyli sahifa sifatida ham ochish
@router.get("/page/{token}", include_in_schema=False)
def shared_page(token: str):
    row = storage.exec_one(
        "SELECT question FROM shared_solutions WHERE id=:t", t=token,
    )
    if not row:
        raise HTTPException(404, "Yechim topilmadi")
    html = _page_html(token, row["question"])
    return Response(content=html, media_type="text/html")


def _page_html(token: str, question: str) -> str:
    safe_q = (question or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ulashilgan yechim — 8-sinf AI Homework</title>
<link rel="stylesheet" href="/static/css/style.css">
</head>
<body class="share-body">
  <div class="share-card">
    <h2>🔗 Ulashilgan yechim</h2>
    <p class="share-q"><b>Savol:</b> {safe_q}</p>
    <div id="sharedContent">Yuklanmoqda…</div>
    <p class="hint">Manba: 8-sinf darsliklari</p>
  </div>
<script src="/static/js/share.js"></script>
<script>loadShared({json.dumps(token)})</script>
</body></html>"""