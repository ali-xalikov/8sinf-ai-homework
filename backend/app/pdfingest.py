from __future__ import annotations

import io
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Tuple

from . import config
from .db import norm_text

try:
    import pymupdf as fitz  # PyMuPDF >= 1.24
except ImportError:  # pragma: no cover
    import fitz

# ---------------------------------------------------------------------------
# Pytesseract (ixtiyoriy — skan qilingan PDF'lar uchun OCR)
# ---------------------------------------------------------------------------
_tesseract_ok: Optional[bool] = None
_ocr = None


def _tesseract_cmd() -> str:
    found = shutil.which("tesseract")
    if found:
        return found
    for cand in (
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Users\Rudy\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
    ):
        if cand.exists():
            return str(cand)
    return "tesseract"


def _get_tesseract() -> bool:
    global _tesseract_ok, _ocr
    if _tesseract_ok is not None:
        return _tesseract_ok
    try:
        import pytesseract
    except ImportError:
        _tesseract_ok = False
        return False
    try:
        pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd()
        if config.TESSDATA_PREFIX:
            pytesseract.pytesseract.tessdata_dir = config.TESSDATA_PREFIX
        pytesseract.get_tesseract_version()
        _ocr = pytesseract
        _tesseract_ok = True
    except Exception:
        _tesseract_ok = False
    return _tesseract_ok


def tesseract_available() -> bool:
    return _get_tesseract()


def ocr_image_bytes(image_bytes: bytes) -> str:
    """Yuklangan rasm (surat)dan matn chiqaradi. OCR yo'q bo'lsa bo'sh qaytaradi."""
    if not (config.OCR_ENABLED and _get_tesseract()):
        return ""
    try:
        from PIL import Image, ImageOps
        import io as _io
        img = Image.open(_io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img).convert("RGB")
        otext = _ocr.image_to_string(img, lang=ocr_langs(), config="--psm 3")
        return " ".join(otext.split())
    except Exception:
        return ""


def ocr_langs() -> str:
    """Avval o'zbekcha, bo'lmasa rus/inglizcha (oson o'rtashmasdan)."""
    if _get_tesseract():
        try:
            langs = (_ocr.get_languages(config="/usr/share/tesseract-ocr/5/tessdata")
                     if False else _ocr.pytesseract.get_languages(config=""))
        except Exception:
            langs = []
        have = set(l.split("\\")[-1] for l in langs)
        for candidate in ("uzb", "uzb+eng", "rus", "eng"):
            if candidate.split("+")[0] in have:
                return candidate
    return "eng"


def open_document(pdf_path: str) -> "fitz.Document":
    return fitz.open(str(config.resolve_path(pdf_path)))


def page_count(doc) -> int:
    return doc.page_count


def extract_page_text(doc, page_index: int) -> Tuple[str, bool]:
    """Sahifa matnini chiqaradi. (matn, OCR ishlatilganmi)."""
    try:
        page = doc.load_page(page_index)
        text = page.get_text("text") or ""
    except Exception:
        text = ""
    text = " ".join(text.split())
    if len(text) < config.MIN_TEXT_CHARS_PER_PAGE and config.OCR_ENABLED and _get_tesseract():
        try:
            pix = render_page_pixmap(doc, page_index, scale=2.0)
            png = pix.tobytes("png")
            from PIL import Image
            import io as _io
            img = Image.open(_io.BytesIO(png))
            otext = _ocr.image_to_string(img, lang=ocr_langs(), config="--psm 3")
            otext = " ".join(otext.split())
            if len(otext) > len(text):
                return otext, True
        except Exception:
            pass
    return text, False


def render_page_pixmap(doc, page_index: int, scale: float = float(config.RENDER_DPI) / 72.0):
    page = doc.load_page(page_index)
    matrix = fitz.Matrix(scale, scale)
    return page.get_pixmap(matrix=matrix, alpha=False)


def render_page_png(doc, page_index: int, scale: float = 1.5) -> bytes:
    scale = max(0.4, min(4.0, scale))
    pix = render_page_pixmap(doc, page_index, scale)
    return pix.tobytes("png")


def get_page_size(doc, page_index: int) -> Tuple[int, int]:
    r = doc.load_page(page_index).rect
    return int(r.width), int(r.height)


def detect_page_offset(doc, sample: int = 40) -> int:
    """
    PDF sahifa raqami bilan kitobning bosma sahifa raqami orasidagi farqni
    avtomatik aniqlab beradi (hech bo'lmasa birinchi sahifalardagi raqamlardan).
    """
    from collections import Counter
    candidates: Counter = Counter()
    for i in range(min(sample, doc.page_count)):
        text = (doc.load_page(i).get_text("text") or "").strip().splitlines()
        if not text:
            continue
        first = text[0].strip()
        import re
        m = re.match(r"^\s*(\d{1,3})\s*$", first)
        if not m:
            m = re.search(r"(\d{1,3})\s*$", first)
        if m:
            printed = int(m.group(1))
            if 200 < printed < 900:
                continue
            candidates[printed - (i + 1)] += 1
    if candidates:
        return candidates.most_common(1)[0][0]
    return 0


def prints_to_pdf(printed: int, offset: int) -> int:
    return printed - offset


def pdf_to_prints(pdf_page_no: int, offset: int) -> int:
    return pdf_page_no + offset