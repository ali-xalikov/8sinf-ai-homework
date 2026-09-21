from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from . import config, db, pdfingest, storage, vector_index
from .db import norm_text

# ---------------------------------------------------------------------------
# So'rov tahlili
# ---------------------------------------------------------------------------

SUBJECT_ALIASES: List[Tuple[str, List[str]]] = [
    ("uzbekiston-tarixi", [
        "ozbekiston tarixi", "o?zbekiston tarixi", "o`zbekiston tarixi", "uzbekiston tarixi",
        "ozbeklar tarixi", "o'zbeklar tarixi", "o?zbeklar tarixi", "ozbeklar", "o'zbeklar", "o?zbeklar",
    ]),
    ("jahon-tarixi", ["jahon tarixi", "dunyo tarixi"]),
    ("ona-tili", ["ona tili", "ona tilidan", "ozbek tili", "o?zbek tili", "uzbek tili"]),
    ("ingliz-tili", ["ingliz tili", "ingliz tilidan", "inglizcha", "ingliz"]),
    ("rus-tili", ["rus tili", "rus tilidan"]),
    ("jismoniy-tarbiya", ["jismoniy tarbiya"]),
    ("geometriya", ["geometriya"]),
    ("informatika", ["informatika"]),
    ("texnologiya", ["texnologiya"]),
    ("chizmachilik", ["chizmachilik"]),
    ("biologiya", ["biologiya"]),
    ("adabiyot", ["adabiyot"]),
    ("geografiya", ["geografiya"]),
    ("algebra", ["algebra"]),
    ("fizika", ["fizika"]),
    ("kimyo", ["kimyo"]),
    ("musiqa", ["musiqa"]),
    ("huquq", ["huquq"]),
]

GRADE_RE = re.compile(r"(\d{1,2})\s*[-]?\s*(?:sinf|класс|class)", re.IGNORECASE)
PAGE_RE = re.compile(r"(\d{1,3})\s*[-]?\s*(?:bet|b\.|sahifa|page|бет)\b", re.IGNORECASE)
EX_RE = re.compile(
    r"№\s*(\d{1,3})"
    r"|#\s*(\d{1,3})"
    r"|(\d{1,3})\s*[-]?\s*(?:mashq|masala|misol|topshiriq)\b"
    r"|(?:mashq|masala|misol|topshiriq)\s*(?:№|#)?\s*(\d{1,3})\b",
    re.IGNORECASE,
)


@dataclass
class ParsedQuery:
    grade: Optional[int] = None
    subject_id: Optional[str] = None
    subject_name: str = ""
    page_printed: Optional[int] = None
    page_pdf: Optional[int] = None
    exercise_no: Optional[int] = None
    book_ids: List[str] = field(default_factory=list)
    keywords: str = ""
    raw: str = ""


def match_subject(text: str) -> Optional[str]:
    t = norm_text(text)
    for sid, aliases in SUBJECT_ALIASES:
        for a in aliases:
            if norm_text(a) in t:
                return sid
    # Yakka "tarix" so'zi aytilsa — O'zbekiston tarixi kitobidan qidiramiz
    if "tarix" in t and "jahon" not in t and "dunyo" not in t:
        return "uzbekiston-tarixi"
    return None


def parse_question(q: str) -> ParsedQuery:
    p = ParsedQuery(raw=q.strip(), keywords=q.strip())
    t = q.strip()

    m = GRADE_RE.search(t)
    p.grade = int(m.group(1)) if m else None

    p.subject_id = match_subject(t)
    if p.subject_id:
        p.subject_name = db.subject_name(p.subject_id)

    mp = PAGE_RE.search(t)
    p.page_printed = int(mp.group(1)) if mp else None

    mex = EX_RE.search(t)
    if mex:
        num = next((int(g) for g in mex.groups() if g), None)
        p.exercise_no = num

    for b in db.list_books(p.subject_id):
        if b["exists"]:
            p.book_ids.append(b["id"])

    kw = re.sub(r"№\s*\d+", " ", t)
    kw = re.sub(r"\d{1,3}\s*bet\b", " ", kw, flags=re.IGNORECASE)
    kw = re.sub(r"8\s*[-]?\s*sinf", " ", kw, flags=re.IGNORECASE)
    kw = norm_text(kw)
    kw = re.sub(r"[^a-z0-9']+", " ", kw)
    p.keywords = " ".join(kw.split())
    return p


def grade_block_message() -> str:
    return ("Bu loyiha faqat 8-sinf darsliklari bilan ishlaydi. "
            "Iltimos, 8-sinf kitoblari va mashqlaridan so'rang.")


# ---------------------------------------------------------------------------
# Kitob / sahifa / mashq
# ---------------------------------------------------------------------------

def resolve_page_pdf(book: Dict, printed: int) -> Optional[int]:
    row = storage.exec_one(
        "SELECT page_no FROM pages WHERE book_id=:id AND printed_page=:p ORDER BY page_no LIMIT 1",
        id=book["id"], p=printed,
    )
    if row:
        return int(row["page_no"])
    offset = book.get("page_offset") or 0
    pdf = printed - offset
    num = book.get("num_pages") or 0
    if 1 <= pdf <= num:
        return pdf
    return None


def get_page_row(book_id: str, pdf_page: int) -> Optional[Dict]:
    return storage.exec_one(
        "SELECT page_no, printed_page, text FROM pages WHERE book_id=:id AND page_no=:p",
        id=book_id, p=pdf_page,
    )


HEADING_RE = re.compile(r"(?i)(mavzu|bob|§|paragraf|lesson|theme|dars\s*\d)")


def chapter_heading(book_id: str, pdf_page: int, window: int = 1) -> List[str]:
    out: List[str] = []
    for pp in range(max(1, pdf_page - window), pdf_page + 1):
        row = get_page_row(book_id, pp)
        if not row or not row["text"]:
            continue
        for line in row["text"].splitlines():
            s = line.strip()
            if not s or len(s) > 110:
                continue
            if HEADING_RE.search(s):
                if s not in out:
                    out.append(s)
        if out:
            break
    return out


_START_RE = re.compile(
    r"(?:(?:mashq|masala|misol|topshiriq|zadacha|primer)\b\s*[-№#:.]?\s*)?"
    r"(?:№|#|\bno\b\.?)?\s*(\d{1,3})\s*[.)-]\s*",
    re.IGNORECASE,
)
_SKIP_RE = re.compile(r"(?i)(^(bob|mavzu|dars)\b|sahifa|sayt|www|http|url)")


def _markers(page_text: str) -> List[Tuple[int, int, int]]:
    out: List[Tuple[int, int, int]] = []
    for m in _START_RE.finditer(page_text):
        num = int(m.group(1))
        if num < 1 or num > 3000:
            continue
        pre = page_text[max(0, m.start() - 30) : m.start()]
        if _SKIP_RE.search(pre):
            continue
        out.append((m.start(), m.end(), num))
    return out


def _page_mark_numbers(page_text: str) -> List[int]:
    return [n for _, _, n in _markers(page_text or "")]


def locate_exercise(page_text: str, ex_no: int, context_len: int = 2500) -> Optional[Dict]:
    if not page_text:
        return None
    markers = _markers(page_text)
    exact = [mk for mk in markers if mk[2] == ex_no]
    if not exact:
        return None
    start = exact[0][1]
    after = page_text[start : start + context_len]
    end = start + context_len
    nxt = sorted((mk for mk in markers if mk[0] > start), key=lambda x: x[0])
    if nxt:
        nxt_start = nxt[0][0]
        if nxt_start - start > 20:
            end = min(end, nxt_start)
    text = after[: end - start].strip()
    if len(text) < 8:
        return None
    return {"number": ex_no, "start": start, "text": text, "snippet": text[:400]}


def locate_exercise_across_book(book: Dict, pdf_page: int, ex_no: int) -> Optional[Dict]:
    rows = []
    base = get_page_row(book["id"], pdf_page)
    if base:
        rows.append(base)
    for dp in (1, 2, -1, -2):
        r = get_page_row(book["id"], pdf_page + dp)
        if r and r["text"]:
            rows.append(r)
    for row in rows:
        found = locate_exercise(row["text"], ex_no)
        if found:
            found["page_pdf"] = row["page_no"]
            found["page_printed"] = row["printed_page"]
            return found
    return None


# ---------------------------------------------------------------------------
# Qidiruv
# ---------------------------------------------------------------------------

def search_book_keywords(query: str, book_id: str, limit: int = 8) -> List[Dict]:
    book = db.get_book(book_id)
    if not book:
        return []
    q = norm_text(query)
    words = [w for w in re.split(r"[^a-z0-9']+", q) if len(w) > 2]
    if not words:
        return []
    rows = storage.exec_all(
        "SELECT page_no, printed_page, text FROM pages WHERE book_id=:id ORDER BY page_no", id=book_id
    )
    results = []
    for r in rows:
        text = r["text"] or ""
        low = norm_text(text)
        score = 0
        for w in words:
            score += low.count(w)
        if score == 0:
            continue
        idx = -1
        for w in words:
            i = low.find(w)
            if i >= 0:
                idx = i
                break
        snippet = text[max(0, idx - 60) : idx + 220] if idx >= 0 else text[:240]
        results.append({
            "page_no": r["page_no"], "printed_page": r["printed_page"],
            "score": score, "snippet": snippet,
        })
    results.sort(key=lambda x: -x["score"])
    return results[:limit]


def semantic_search(query: str, top_k: int = 8, subject_id: Optional[str] = None) -> List[Dict]:
    index = vector_index.get_global_index()
    matches = index.search(query, top_k=top_k * 3)
    out = []
    for m in matches:
        book = db.get_book(m.book_id)
        if not book:
            continue
        if subject_id and book["subject_id"] != subject_id:
            continue
        row = get_page_row(book["id"], m.page_no)
        out.append({
            "book_id": book["id"], "subject_name": book["subject_name"], "title": book["title"],
            "page_no": m.page_no, "printed_page": row["printed_page"] if row else m.page_no,
            "score": m.score, "text": m.text, "snippet": m.text[:300],
        })
    out.sort(key=lambda x: -x["score"])
    return out[:top_k]


# ---------------------------------------------------------------------------
# Kontekst yig'ish
# ---------------------------------------------------------------------------

def build_target_context(parsed: ParsedQuery) -> Dict:
    if not parsed.subject_id or not parsed.page_printed:
        return {"type": "none"}
    for bid in parsed.book_ids:
        book = db.get_book(bid)
        if not book:
            continue
        pdf_page = resolve_page_pdf(book, parsed.page_printed)
        if pdf_page is None:
            continue
        row = get_page_row(book["id"], pdf_page)
        ex = None
        if parsed.exercise_no:
            ex = locate_exercise(row["text"] if row else "", parsed.exercise_no)
            if ex and row:
                ex["page_pdf"] = pdf_page
                ex["page_printed"] = row["printed_page"]
            if not ex:
                ex = locate_exercise_across_book(book, pdf_page, parsed.exercise_no)
        return {
            "type": "book_page",
            "book_id": book["id"], "subject_id": book["subject_id"],
            "subject_name": book["subject_name"], "title": book["title"],
            "edition": book["edition"], "publisher": book["publisher"],
            "year": book["year"], "author": book["author"],
            "page_printed": parsed.page_printed, "page_pdf": pdf_page,
            "headings": chapter_heading(book["id"], pdf_page),
            "page_text": row["text"][: config.MAX_PAGE_TEXT_FOR_LLM] if row else "",
            "exercise": ex, "exercise_requested": parsed.exercise_no,
        }
    return {"type": "no_book"}


def ask_probe(q: str = "") -> str:
    return ("Iltimos, quyidagi ko'rinishda so'rang:\n"
            "• «Algebra 8-sinf 100-bet №2»\n"
            "• «Fizika 8-sinf 32-bet 4-masala»\n"
            "• «Geometriya 8-sinf 54-bet №7»\n"
            "yoki istalgan mavzu bo'yicha savol (masalan: «Kvadrat tenglamani qanday yechish kerak?»).")