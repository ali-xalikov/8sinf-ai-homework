from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from .. import auth, db, pdfingest, retriever, storage

router = APIRouter(prefix="/api", tags=["pages"])


def _open_book(bid: str):
    print("=" * 60)
    print(">>> OPEN_BOOK chaqirildi")
    print(">>> bid =", bid)
    
    b = db.get_book(bid)
    print(">>> db.get_book =", b)
    
    if not b:
        try:
            all_books = db.list_books()
            print(">>> Bazadagi kitoblar:")
            for x in all_books:
                print("    ", x.get("id"), "→", x.get("title"))
        except Exception as e:
            print(">>> list_books xato:", e)
        raise HTTPException(404, "Kitob topilmadi")
    
    print(">>> exists =", b.get("exists"))
    print(">>> pdf_path =", b.get("pdf_path"))
    
    if not b.get("exists"):
        raise HTTPException(404, f"PDF fayl topilmadi: {b['pdf_path']}")
    return b

@router.get("/books/{bid}/info")
def book_info(bid: str, req: Request):
    auth.current_user(req)
    b = _open_book(bid)
    doc = pdfingest.open_document(b["pdf_path"])
    try:
        num = doc.page_count
    finally:
        doc.close()
    if b["num_pages"] != num:
        db.update_book_info(bid, num_pages=num)
        b["num_pages"] = num
    return b


@router.get("/books/{bid}/pages/{page_no}/render")
def render_page(bid: str, page_no: int, scale: float = Query(1.5, ge=0.4, le=4.0)):
    """PDF sahifasini rasm qilib qaytaradi. Auth yo'q — img src uchun."""
    b = _open_book(bid)
    doc = pdfingest.open_document(b["pdf_path"])
    try:
        if not (1 <= page_no <= doc.page_count):
            raise HTTPException(404, "Sahifa mavjud emas")
        png = pdfingest.render_page_png(doc, page_no - 1, scale)
    finally:
        doc.close()
    return Response(content=png, media_type="image/png")


@router.get("/books/{bid}/pages/{page_no}/text")
def page_text(bid: str, page_no: int, req: Request):
    auth.current_user(req)
    b = _open_book(bid)
    row = storage.exec_one(
        "SELECT text, printed_page FROM pages WHERE book_id=:i AND page_no=:n", i=b["id"], n=page_no,
    )
    if not row:
        doc = pdfingest.open_document(b["pdf_path"])
        try:
            if not (1 <= page_no <= doc.page_count):
                raise HTTPException(404, "Sahifa mavjud emas")
            text, _ = pdfingest.extract_page_text(doc, page_no - 1)
        finally:
            doc.close()
        return {"page_no": page_no, "printed_page": page_no + (b.get("page_offset") or 0), "text": text}
    return {"page_no": page_no, "printed_page": row["printed_page"], "text": row["text"]}


@router.get("/books/{bid}/page-index")
def page_map(bid: str, req: Request):
    auth.current_user(req)
    b = _open_book(bid)
    rows = storage.exec_all(
        "SELECT page_no, printed_page, chars FROM pages WHERE book_id=:i ORDER BY page_no", i=b["id"],
    )
    return {
        "book_id": b["id"], "num_pages": b["num_pages"],
        "page_offset": b.get("page_offset") or 0,
        "pages": [{"page": r["page_no"], "printed": r["printed_page"], "chars": r["chars"]} for r in rows],
    }


@router.get("/books/{bid}/print/{printed}")
def resolve_printed(bid: str, printed: int, req: Request):
    auth.current_user(req)
    b = _open_book(bid)
    pdf = retriever.resolve_page_pdf(b, printed)
    if pdf is None:
        raise HTTPException(404, f"Bosma {printed}-sahifa topilmadi")
    return {"page_pdf": pdf, "printed": printed, "offset": b.get("page_offset") or 0}


@router.get("/books/{bid}/search")
def search(bid: str, q: str = Query(...), limit: int = Query(8, le=50), req: Request = None):
    auth.current_user(req)
    b = _open_book(bid)
    return retriever.search_book_keywords(q, b["id"], limit)


@router.get("/books/{bid}/exercise/{page_no}/{ex_no}")
def locate_ex(bid: str, page_no: int, ex_no: int, req: Request):
    auth.current_user(req)
    b = _open_book(bid)
    row = storage.exec_one(
        "SELECT text, printed_page FROM pages WHERE book_id=:i AND page_no=:n", i=b["id"], n=page_no,
    )
    text = row["text"] if row else ""
    found = retriever.locate_exercise(text, ex_no)
    if not row:
        raise HTTPException(404, "Sahifa indekslanmagan")
    if not found:
        return {"found": False, "page_no": page_no,
                "numbers_on_page": retriever._page_mark_numbers(text)}
    return {"found": True, **found, "page_printed": row["printed_page"], "book_id": b["id"]}