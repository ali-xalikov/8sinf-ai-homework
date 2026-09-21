from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import config, storage

# ---------------------------------------------------------------
# Uzbekcha matn normallashtirish
# ---------------------------------------------------------------
def norm_text(text: str) -> str:
    s = unicodedata.normalize("NFKC", text or "")
    s = s.replace("\u02bb", "'").replace("\u2018", "'").replace("\u2019", "'")
    s = s.replace("\u02c0", "'").replace("\u2019", "'").replace("`", "'")
    s = s.lower()
    return s


def slugify(name: str) -> str:
    s = norm_text(name)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:40] or "book"


def book_id(subject: str, filename: str) -> str:
    raw = f"{subject}--{Path(filename).stem}"
    return slugify(raw)


def utcnow() -> str:
    import datetime
    return datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")


# ---------------------------------------------------------------
# metadata.json <-> DB sinxronlash
# ---------------------------------------------------------------
def load_metadata() -> Dict[str, Any]:
    if config.METADATA_FILE.exists():
        try:
            return json.loads(config.METADATA_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"subjects": []}


def save_metadata(data: Dict[str, Any]) -> None:
    config.BOOKS_DIR.mkdir(parents=True, exist_ok=True)
    config.METADATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def sync_from_metadata() -> int:
    meta = load_metadata()
    added = 0
    for subject in meta.get("subjects", []):
        subj_id = subject.get("id", slugify(subject.get("name", "")))
        if int(subject.get("class", 8) or 8) != 8:
            continue
        for b in subject.get("books", []):
            pdf_path = b.get("pdf_path", "")
            bid = b.get("id") or book_id(subj_id, Path(pdf_path).name)
            row = storage.exec_one("SELECT id FROM books WHERE id=:id", id=bid)
            if row is None:
                storage.exec_write(
                    """INSERT INTO books(id, subject_id, title, author, edition, publisher, year,
                        class_no, language, pdf_path) VALUES(:id,:sid,:title,:author,:edition,:publisher,:year,8,:lang,:pdf)""",
                    id=bid, sid=subj_id, title=b.get("title", ""), author=b.get("author", ""),
                    edition=b.get("edition", ""), publisher=b.get("publisher", ""),
                    year=str(b.get("year", "")), lang=b.get("language", "uz"), pdf=pdf_path,
                )
                added += 1
            else:
                storage.exec_write(
                    """UPDATE books SET subject_id=:sid, title=:title, author=:author, edition=:edition,
                       publisher=:publisher, year=:year, language=:lang, pdf_path=:pdf WHERE id=:id""",
                    sid=subj_id, title=b.get("title", ""), author=b.get("author", ""),
                    edition=b.get("edition", ""), publisher=b.get("publisher", ""),
                    year=str(b.get("year", "")), lang=b.get("language", "uz"), pdf=pdf_path, id=bid,
                )
    return added


def merge_book_into_metadata(
    subject_id, subject_name, bid, title, author, edition, publisher, year,
    pdf_rel, language="uz",
) -> None:
    meta = load_metadata()
    subjects = meta.setdefault("subjects", [])
    subject = next((s for s in subjects if s.get("id") == subject_id), None)
    if subject is None:
        subject = {"id": subject_id, "name": subject_name, "class": 8, "books": []}
        subjects.append(subject)
    books = subject.setdefault("books", [])
    data = {
        "id": bid, "title": title, "author": author, "edition": edition,
        "publisher": publisher, "year": str(year), "language": language, "pdf_path": pdf_rel,
    }
    entry = next((b for b in books if (b.get("id") or "").lower() == bid.lower()), None)
    if entry is not None:
        entry.update(data)
    else:
        books.append(data)
    save_metadata(meta)
    sync_from_metadata()


def delete_book_row_and_meta(bid: str) -> None:
    book = get_book(bid)
    if book is None:
        return
    storage.exec_write("DELETE FROM pages WHERE book_id=:book_id", book_id=bid)
    storage.exec_write("DELETE FROM chunks WHERE book_id=:book_id", book_id=bid)
    storage.exec_write("DELETE FROM books WHERE id=:id", id=bid)
    # metadata.json'dan ham olib tashlash
    meta = load_metadata()
    for subject in meta.get("subjects", []):
        books = subject.get("books", [])
        subject["books"] = [b for b in books if (b.get("id") or "").lower() != bid.lower()]
        if not subject["books"] and (subject.get("id") or "").lower() == book["subject_id"].lower():
            meta["subjects"] = [s for s in meta.get("subjects", []) if s is not subject]
    save_metadata(meta)
    sync_from_metadata()


# ---------------------------------------------------------------
# Kitoblar
# ---------------------------------------------------------------
def list_subjects() -> List[Dict[str, Any]]:
    rows = storage.exec_all(
        "SELECT subject_id AS id, COUNT(*) AS n FROM books WHERE class_no=8 GROUP BY subject_id ORDER BY subject_id"
    )
    for r in rows:
        r["name"] = display_subject(r["id"])
    return rows


def list_books(subject_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if subject_id:
        rows = storage.exec_all(
            "SELECT * FROM books WHERE class_no=8 AND subject_id=:sid ORDER BY title", sid=subject_id
        )
    else:
        rows = storage.exec_all("SELECT * FROM books WHERE class_no=8 ORDER BY subject_id, title")
    out = []
    for r in rows:
        p = Path(r["pdf_path"])
        out.append({
            "id": r["id"], "subject_id": r["subject_id"], "subject_name": display_subject(r["subject_id"]),
            "title": r["title"] or p.stem, "author": r["author"], "edition": r["edition"],
            "publisher": r["publisher"], "year": r["year"], "class_no": r["class_no"],
            "pdf_path": str(p), "exists": p.exists(), "num_pages": r["num_pages"],
            "page_offset": r["page_offset"], "detected_offset": r["detected_offset"],
            "indexed": bool(r["indexed"]), "indexed_at": r["indexed_at"],
        })
    return out


def get_book(bid: str) -> Optional[Dict[str, Any]]:
    for b in list_books():
        if b["id"] == bid:
            return b
    return None


def update_book_info(bid: str, **fields) -> None:
    allowed = {"num_pages", "page_offset", "detected_offset", "indexed", "indexed_at",
               "title", "author", "edition", "publisher", "year", "language"}
    sets = ", ".join(f"{k}=:{k}" for k in fields if k in allowed)
    if not sets:
        return
    storage.exec_write(f"UPDATE books SET {sets} WHERE id=:id", **fields, id=bid)


SUBJECT_ICONS = {
    "algebra": "📐", "geometriya": "📏", "fizika": "🔬", "kimyo": "⚗️",
    "biologiya": "🧬", "ona-tili": "✍️", "adabiyot": "📖", "uzbekiston-tarixi": "🏛️",
    "jahon-tarixi": "🌍", "ingliz-tili": "🇬🇧", "rus-tili": "🗣️", "geografiya": "🗺️",
    "informatika": "💻", "texnologiya": "🛠️", "jismoniy-tarbiya": "🏃", "musiqa": "🎵",
    "chizmachilik": "📐", "huquq": "⚖️", "matematika": "✖️", "dunyo-fani": "🌏",
}

SUBJECT_NAMES = {
    "algebra": "Algebra", "geometriya": "Geometriya", "fizika": "Fizika", "kimyo": "Kimyo",
    "biologiya": "Biologiya", "ona-tili": "Ona tili", "adabiyot": "Adabiyot",
    "uzbekiston-tarixi": "O'zbekiston tarixi", "jahon-tarixi": "Jahon tarixi",
    "ingliz-tili": "Ingliz tili", "rus-tili": "Rus tili", "geografiya": "Geografiya",
    "informatika": "Informatika", "texnologiya": "Texnologiya",
    "jismoniy-tarbiya": "Jismoniy tarbiya", "musiqa": "Musiqa",
    "chizmachilik": "Chizmachilik", "huquq": "Huquq", "matematika": "Matematika",
}


def subject_name(subject_id: str) -> str:
    return SUBJECT_NAMES.get(subject_id, subject_id.replace("-", " ").title())


def display_subject(subject_id: str) -> str:
    return f"{SUBJECT_ICONS.get(subject_id, '📚')} {subject_name(subject_id)}"


DEFAULT_SUBJECTS = [
    {"id": "algebra", "name": "Algebra"},
    {"id": "geometriya", "name": "Geometriya"},
    {"id": "fizika", "name": "Fizika"},
    {"id": "kimyo", "name": "Kimyo"},
    {"id": "biologiya", "name": "Biologiya"},
    {"id": "ona-tili", "name": "Ona tili"},
    {"id": "adabiyot", "name": "Adabiyot"},
    {"id": "uzbekiston-tarixi", "name": "O'zbekiston tarixi"},
    {"id": "jahon-tarixi", "name": "Jahon tarixi"},
    {"id": "ingliz-tili", "name": "Ingliz tili"},
    {"id": "rus-tili", "name": "Rus tili"},
    {"id": "geografiya", "name": "Geografiya"},
    {"id": "informatika", "name": "Informatika"},
    {"id": "texnologiya", "name": "Texnologiya"},
    {"id": "chizmachilik", "name": "Chizmachilik"},
    {"id": "jismoniy-tarbiya", "name": "Jismoniy tarbiya"},
    {"id": "musiqa", "name": "Musiqa"},
    {"id": "huquq", "name": "Huquq"},
]


def match_subject_id(text: str) -> Optional[str]:
    t = norm_text(text or "")
    aliases = {
        "algebra": ["algebra"],
        "geometriya": ["geometriya"],
        "fizika": ["fizika"],
        "kimyo": ["kimyo"],
        "biologiya": ["biologiya"],
        "ona-tili": ["ona tili", "ona til", "ozbek tili", "o?zbek tili", "uzbek tili"],
        "adabiyot": ["adabiyot"],
        "uzbekiston-tarixi": ["ozbekiston tarixi", "o?zbekiston tarixi", "uzbekiston tarixi"],
        "jahon-tarixi": ["jahon tarixi", "dunyo tarixi"],
        "ingliz-tili": ["ingliz tili", "english", "ingliz"],
        "rus-tili": ["rus tili", "russian"],
        "geografiya": ["geografiya"],
        "informatika": ["informatika"],
        "texnologiya": ["texnologiya"],
        "chizmachilik": ["chizmachilik"],
        "musiqa": ["musiqa"],
        "huquq": ["huquq"],
        "matematika": ["matematika"],
    }
    for sid, keys in aliases.items():
        for k in keys:
            if k in t:
                return sid
    return None


def scan_books_folder() -> List[Dict[str, str]]:
    found: List[Dict[str, str]] = []
    if not config.BOOKS_DIR.exists():
        return found
    meta = load_metadata()
    existing = set()
    for s in meta.get("subjects", []):
        for b in s.get("books", []):
            existing.add(b.get("pdf_path", ""))
    for pdf in sorted(config.BOOKS_DIR.rglob("*.pdf")):
        rel = pdf.relative_to(config.PROJECT_ROOT).as_posix()
        if rel in existing:
            continue
        parts = pdf.parts
        subject_hint = ""
        if len(parts) >= 2:
            for i in range(len(parts) - 1, -1, -1):
                if parts[i].lower() == "books":
                    folder = parts[i + 1] if i + 1 < len(parts) else ""
                    subject_hint = match_subject_id(folder) or ""
                    break
        if not subject_hint:
            subject_hint = match_subject_id(pdf.name) or ""
        found.append({"path": rel, "subject_hint": subject_hint, "filename": pdf.name})
    return found