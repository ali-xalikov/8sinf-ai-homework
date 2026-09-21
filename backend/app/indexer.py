from __future__ import annotations

import datetime as _dt
from typing import Dict, List, Optional

from sqlalchemy import text

from . import config, db, pdfingest, storage, vector_index


# "ON CONFLICT ... DO UPDATE" SQLite (>=3.24) va PostgreSQL'da bir xil ishlaydi,
# shuning uchun alohida dialekt shoxobchasi kerak emas.
def _upsert_pages_sql() -> str:
    return (
        "INSERT INTO pages(book_id, page_no, printed_page, text, chars) "
        "VALUES(:book_id,:page_no,:printed,:text,:chars) "
        "ON CONFLICT(book_id, page_no) DO UPDATE SET "
        "printed_page=EXCLUDED.printed_page, text=EXCLUDED.text, chars=EXCLUDED.chars"
    )


def _upsert_chunks_sql() -> str:
    return (
        "INSERT INTO chunks(book_id, page_no, chunk_idx, text) "
        "VALUES(:book_id,:page_no,:ci,:text) "
        "ON CONFLICT(book_id, page_no, chunk_idx) DO UPDATE SET text=EXCLUDED.text"
    )


def chunk_text(text: str, size: Optional[int] = None, overlap: Optional[int] = None) -> List[str]:
    size = size or config.CHUNK_SIZE
    overlap = overlap or config.CHUNK_OVERLAP
    text = text.strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]
    chunks: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + size)
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk)
        if end >= n:
            break
        start = max(start + size - overlap, start + 1)
    return chunks


def index_book(book: Dict, force: bool = True) -> Dict:
    doc = pdfingest.open_document(book["pdf_path"])
    try:
        num_pages = doc.page_count
        offset = book.get("page_offset") or 0
        det_offset = pdfingest.detect_page_offset(doc)
        offset = offset or det_offset or 0

        def _work(conn):
            conn.execute(text("DELETE FROM pages WHERE book_id=:id"), {"id": book["id"]})
            conn.execute(text("DELETE FROM chunks WHERE book_id=:id"), {"id": book["id"]})

        stats = {"book_id": book["id"], "pages": 0, "ocr_pages": 0, "text_chars": 0, "chunks": 0}
        page_rows = []
        chunk_rows = []
        for i in range(num_pages):
            raw, used_ocr = pdfingest.extract_page_text(doc, i)
            raw = " ".join(" ".join(raw.split()).split())
            printed = i + 1 + offset
            page_rows.append({
                "book_id": book["id"], "page_no": i + 1, "printed": printed,
                "text": raw, "chars": len(raw),
            })
            for ci, ch in enumerate(chunk_text(raw)):
                chunk_rows.append({"book_id": book["id"], "page_no": i + 1, "ci": ci, "text": ch})
                stats["chunks"] += 1
            stats["pages"] += 1
            stats["text_chars"] += len(raw)
            if used_ocr:
                stats["ocr_pages"] += 1

        storage.exec_commit(_work)
        storage.exec_many(_upsert_pages_sql(), page_rows)
        storage.exec_many(_upsert_chunks_sql(), chunk_rows)
        now = _dt.datetime.now(_dt.UTC).isoformat(timespec="seconds")
        db.update_book_info(
            book["id"], num_pages=num_pages, detected_offset=det_offset,
            page_offset=offset, indexed=1, indexed_at=now,
        )
        stats["indexed_at"] = now
        return stats
    finally:
        doc.close()


_index_lock = __import__("threading").Lock()


def index_all(only_ids: Optional[List[str]] = None) -> Dict:
    with _index_lock:
        results = []
        for b in db.list_books():
            if not b["exists"]:
                continue
            if only_ids and b["id"] not in only_ids:
                continue
            try:
                results.append(index_book(b))
            except Exception as e:
                results.append({"book_id": b["id"], "error": str(e)})
        info = vector_index.rebuild_global_indexes()
        return {"indexed": results, "vector": info}


def refresh_vector() -> Dict:
    return vector_index.rebuild_global_indexes()