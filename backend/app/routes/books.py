from __future__ import annotations

import shutil
import socket
from pathlib import Path

import fitz
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response

from .. import auth, config, db, indexer

router = APIRouter(prefix="/api", tags=["books"])


@router.get("/subjects")
def subjects(req: Request):
    auth.current_user(req)
    return db.list_subjects()


@router.get("/books/{bid}/pages/{page}/render")
def render_page(bid: str, page: int, scale: float = 1.5):
    b = db.get_book(bid)
    if not b or not b.get("exists"):
        raise HTTPException(404, f"Kitob topilmadi. bid={bid}")

    try:
        doc = fitz.open(b["pdf_path"])
        total = len(doc)
        if page < 1 or page > total:
            doc.close()
            raise HTTPException(404, f"Sahifa topilmadi (1-{total})")

        p = doc.load_page(page - 1)
        mat = fitz.Matrix(scale, scale)
        pix = p.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")
        doc.close()
        return Response(content=img_bytes, media_type="image/png")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Render xatosi: {str(e)}")


@router.get("/books/{bid}/file")
def book_file(bid: str):
    """Xom PDF faylni qaytaradi — brauzerda <embed>/<iframe> orqali ochish uchun.

    Render endpoint singari auth talab qilmaydi (img/embed src uchun).
    """
    b = db.get_book(bid)
    if not b or not b.get("exists"):
        raise HTTPException(404, f"PDF fayl topilmadi: {b['pdf_path'] if b else bid}")
    from fastapi.responses import FileResponse
    return FileResponse(b["pdf_path"], media_type="application/pdf")


@router.get("/books")
def books(req: Request, subject_id: str | None = None):
    auth.current_user(req)
    return db.list_books(subject_id)


@router.get("/books/{bid}")
def book_detail(bid: str, req: Request):
    auth.current_user(req)
    b = db.get_book(bid)
    if not b:
        raise HTTPException(404, "Kitob topilmadi")
    return b


@router.post("/books/{bid}/index")
def index_one(bid: str, req: Request, background: int = 0):
    auth.require_admin(req)
    b = db.get_book(bid)
    if not b:
        raise HTTPException(404, "Kitob topilmadi")
    if not b["exists"]:
        raise HTTPException(400, f"PDF fayl topilmadi: {b['pdf_path']}")
    if not b["indexed"]:
        db.update_book_info(bid, page_offset=b.get("page_offset") or 0)
    if background:
        from .. import jobs
        job_id = jobs.start_job(bid)
        return {"async": True, "job_id": job_id, "status": "started"}
    try:
        result = indexer.index_book(b, force=True)
    except Exception as e:
        raise HTTPException(500, f"Indekslash xatosi: {e}")
    vec = indexer.refresh_vector()
    result["vector"] = vec
    return result


@router.post("/books/reindex-all")
def reindex_all(req: Request):
    auth.require_admin(req)
    return indexer.index_all()


@router.get("/index/status")
def index_status(req: Request):
    auth.current_user(req)
    try:
        vec = indexer.refresh_vector()
    except Exception:
        vec = {"chunks": 0, "books": 0, "ready": False}
    vec["books"] = len(db.list_books())
    return vec


@router.post("/books/{bid}/offset")
def set_offset(bid: str, offset: int, req: Request):
    auth.require_admin(req)
    b = db.get_book(bid)
    if not b:
        raise HTTPException(404, "Kitob topilmadi")
    if not isinstance(offset, int):
        raise HTTPException(400, "offset butun son bo'lishi kerak")
    db.update_book_info(bid, page_offset=offset)
    rows = storage_exec_pages(bid)
    for r in rows:
        storage_write_printed(bid, r["page_no"], r["page_no"] + offset)
    return {"ok": True, "offset": offset}


def storage_exec_pages(bid: str):
    from .. import storage
    return storage.exec_all("SELECT page_no FROM pages WHERE book_id=:i", i=bid)


def storage_write_printed(bid: str, page_no: int, printed: int):
    from .. import storage
    storage.exec_write(
        "UPDATE pages SET printed_page=:p WHERE book_id=:i AND page_no=:n",
        p=printed, i=bid, n=page_no,
    )


@router.get("/books/folder-scan")
def folder_scan(req: Request):
    auth.require_admin(req)
    return {"found": db.scan_books_folder()}


@router.post("/books/add")
async def add_book(
    req: Request,
    file: UploadFile = File(...),
    subject_id: str = Form("algebra"),
    title: str = Form(""),
    author: str = Form(""),
    edition: str = Form(""),
    publisher: str = Form(""),
    year: str = Form(""),
    language: str = Form("uz"),
    auto_index: int = Form(1),
):
    auth.require_admin(req)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Faqat PDF fayllar qabul qilinadi")
    if subject_id not in [s["id"] for s in db.DEFAULT_SUBJECTS]:
        subject_id = db.match_subject_id(subject_id) or "algebra"

    safe = Path(file.filename).name
    subj_dir = config.BOOKS_DIR / db.slugify(subject_id)
    subj_dir.mkdir(parents=True, exist_ok=True)
    dest = subj_dir / safe
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)

    rel = dest.relative_to(config.PROJECT_ROOT).as_posix()
    title = title or Path(safe).stem
    bid = db.book_id(subject_id, safe)
    db.merge_book_into_metadata(
        subject_id=subject_id,
        subject_name=db.SUBJECT_NAMES.get(subject_id, subject_id),
        bid=bid,
        title=title,
        author=author,
        edition=edition,
        publisher=publisher,
        year=year,
        pdf_rel=rel,
        language=language,
    )
    b = db.get_book(bid)
    if auto_index:
        try:
            from .. import jobs
            job_id = jobs.start_job(bid)
            return {**{"async": True, "job_id": job_id}, "book": b, "added": True}
        except Exception as e:
            return {"added": True, "book": b, "index_error": str(e)}
    return {"added": True, "book": b}


@router.delete("/books/{bid}")
def remove_book(bid: str, req: Request):
    auth.require_admin(req)
    b = db.get_book(bid)
    if not b:
        raise HTTPException(404, "Kitob topilmadi")
    p = Path(b["pdf_path"])
    try:
        if p.exists():
            p.unlink()
    except Exception:
        pass
    db.delete_book_row_and_meta(bid)
    try:
        indexer.refresh_vector()
    except Exception:
        pass
    return {"ok": True}


@router.get("/books/{bid}/pdf")
def download_pdf(bid: str, req: Request):
    auth.current_user(req)
    b = db.get_book(bid)
    if not b or not b["exists"]:
        raise HTTPException(404, "Fayl topilmadi")
    from fastapi.responses import FileResponse
    return FileResponse(
        b["pdf_path"],
        media_type="application/pdf",
        filename=f"{Path(b['pdf_path']).name}",
    )


@router.get("/server/info")
def server_info(req: Request):
    auth.current_user(req)
    try:
        host = socket.gethostname()
    except Exception:
        host = "?"
    return {"hostname": host, "base_url": str(req.base_url)}