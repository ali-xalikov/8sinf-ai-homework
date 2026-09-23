from __future__ import annotations

import re
from typing import Any, Dict, List

from . import config, db, llm, retriever
from .retriever import ParsedQuery

NO_LLM_HINT = (
    "AI yechim tayyor emas: serverda LLM sozlanmagan.\n"
    "Administratorga murojaat qiling: .env faylida OPENAI_API_KEY qo'yish yoki "
    "Ollama'ni ishga tushirish kerak (README ga qarang)."
)

SECTIONS = [
    "Masala sharti", "Berilganlari", "Formula / qoida", "Yechim", "Javob",
    "Izoh", "Tushuntirish", "Batafsil tushuntirish", "Xulosa", "Xulosa / Javob",
]

# ---------------------------------------------------------------------------
# Markdown belgilarini olib tashlab, toza matn qaytarish
# ---------------------------------------------------------------------------
_MD_BOLD = re.compile(r"(\*\*|__)(.+?)\1", re.S)
_MD_ITALIC = re.compile(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", re.S)
_MD_CODE = re.compile(r"`([^`]*)`")
_MD_HEAD = re.compile(r"^\s*#{1,6}\s*", re.M)
_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_TABLE_SEP = re.compile(r"^\s*\|?[\s:|-]+\|[\s:|-]*$")
_EMOJI = re.compile(
    "["
    "\U0001F000-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U00002190-\U000021FF"
    "\U00002B00-\U00002BFF"
    "\U0000FE00-\U0000FE0F"
    "\U0001F1E6-\U0001F1FF"
    "]+",
    flags=re.UNICODE,
)


def clean_plain_text(text: str) -> str:
    """Javobni toza, o'qiladigan matnga aylantiradi.

    ##, **, __, `, markdown havolalar, jadvallar (|) va emojilarni olib tashlaydi.
    """
    out_lines: List[str] = []
    for line in (text or "").splitlines():
        s = line.rstrip()
        if _TABLE_SEP.match(s):
            continue
        if s.lstrip().startswith("|"):
            cells = [c.strip() for c in s.strip().strip("|").split("|")]
            cells = [c for c in cells if c]
            if cells:
                s = " — ".join(cells)
        s = _MD_LINK.sub(r"\1", s)
        s = _MD_BOLD.sub(r"\2", s)
        s = _MD_CODE.sub(r"\1", s)
        s = _MD_ITALIC.sub(r"\1", s)
        s = _MD_HEAD.sub("", s)
        s = s.replace("`", "")
        s = _EMOJI.sub("", s)
        out_lines.append(s)
    joined = "\n".join(out_lines)
    joined = re.sub(r"[ \t]+\n", "\n", joined)
    joined = re.sub(r"\n{3,}", "\n\n", joined)
    return joined.strip()


def parse_sections(raw: str) -> List[Dict[str, str]]:
    label_map = {l.lower(): l for l in SECTIONS}
    label_map["shart"] = "Masala sharti"
    label_map["berilgan"] = "Berilganlari"
    label_map["formula"] = "Formula / qoida"
    label_map["qoida"] = "Formula / qoida"
    label_map["yechish"] = "Yechim"
    label_map["batafsil"] = "Batafsil tushuntirish"
    label_map["xulosa"] = "Xulosa / Javob"
    sections: List[Dict[str, str]] = []
    cur_label, cur_buf = "", []

    def flush():
        if cur_label and "".join(cur_buf).strip():
            sections.append({"label": cur_label, "text": clean_plain_text("\n".join(cur_buf))})

    for ln in (raw or "").splitlines():
        m = re.match(r"^\s*#{1,6}\s*(.+?)\s*[:.]?\s*$", ln)
        matched = None
        if m:
            low = " ".join(m.group(1).lower().split())
            matched = label_map.get(low)
            if not matched:
                matched = next((v for k, v in label_map.items() if low.startswith(k)), None)
        if matched:
            flush()
            cur_label, cur_buf = matched, []
        else:
            cur_buf.append(ln)
    flush()
    if not sections and (raw or "").strip():
        sections = [{"label": "Yechim", "text": clean_plain_text(raw)}]
    return sections


def _book_display(ctx: Dict[str, Any]) -> str:
    parts = [ctx.get("title", "")]
    if ctx.get("author"):
        parts.append(ctx["author"])
    if ctx.get("year"):
        parts.append(str(ctx["year"]) + "-yil nashri")
    return " · ".join(p for p in parts if p) or "(kitob)"


def build_prompt(question: str, ctx: Dict[str, Any], plan: str) -> str:
    role = ("Siz «8-sinf AI Homework» o'qituvchi-yordamchisisiz. Siz faqat 8-sinf "
            "darsliklari mazmuniga asoslanib, o'zbek tilida javob berasiz.")
    if plan == "exact_exercise":
        inp = (
            f"KITOB: {_book_display(ctx)}\n"
            f"Bosma sahifa: {ctx['page_printed']} (PDF sahifa {ctx['page_pdf']})\n"
            f"BOB/MAVZU:{' ' + '; '.join(ctx['headings']) if ctx.get('headings') else ' aniqlanmadi'}\n\n"
            f"SAHIFADAGI MATN:\n{ctx['page_text']}\n"
        )
        task = (
            f"Foydalanuvchi «{question}» degan so'rov yubordi. "
            f"Yuqoridagi sahifadan №{ctx['exercise']['number']} mashq/misol/masalani topib, "
            f"to'liq yechimini bering."
        )
    else:
        inp = (
            f"TOPILGAN PARCHA: {_book_display(ctx)}, bosma sahifa {ctx['page_printed']}\n\n"
            f"{ctx['page_text']}\n"
        )
        task = f"Foydalanuvchi savoli: «{question}»\nYuqoridagi darslik parchasiga asoslanib aniq javob bering."

    rules = (
        "QOIDALAR:\n"
        "- FAQAT Yuqorida berilgan kitob matniga asoslaning; internetdan olgan umumiy ma'lumotni yozmang.\n"
        "- Mashq shartini kitobdan ko'chiring, so'ng bosqichma-bosqich yeching.\n"
        "- Mashq yoki javob matnda aniq bo'lmasa: «Ma'lumot topilmadi — aniqroq savol bering» deb yozing. Hech qachon taxmin qilmang.\n"
        "- Formulalarni matn ko'rinishida yozing: x^2, sqrt(x), 5/2 va h.k.\n"
    )
    return (
        role + "\n\n" + inp + "\n" + task + "\n\n" + rules +
        "\nJavobni quyidagi bo'limlarga «## » prefiksi bilan bering:\n"
        "## Masala sharti\n## Berilganlari\n## Formula / qoida\n## Yechim\n## Javob\n"
    )


def _manba(ctx: Dict[str, Any]) -> Dict[str, Any]:
    ex = ctx.get("exercise") or {}
    return {
        "book_id": ctx.get("book_id"),
        "subject": ctx.get("subject_name", ""),
        "title": ctx.get("title", ""),
        "edition": ctx.get("edition", ""),
        "publisher": ctx.get("publisher", ""),
        "year": ctx.get("year", ""),
        "author": ctx.get("author", ""),
        "printed_page": ctx.get("page_printed"),
        "page_pdf": ctx.get("page_pdf"),
        "headings": ctx.get("headings", []),
        "exercise_no": ex.get("number"),
        "exercise_text": ex.get("text"),
        "has_pdf": bool(ctx.get("page_pdf")),
    }


# ---------------------------------------------------------------------------
# Rejim aniqlash: "kitobdan top" (kitob) yoki "o'zi yozib bersin" (umumiy)
# ---------------------------------------------------------------------------
_BOOK_PHRASES = (
    "kitobdan top", "kitobdan qidir", "kitobdan topib", "kitobdan qidirib",
    "kitobdan topib ber", "kitobdan topib chiq", "qidirib topib chiq",
    "darslikdan top", "darslikdan qidir", "darslikdan topib", "darslikdan izla",
    "kitob ichidan", "kitobda qidir", "kitobdan izla", "kitobdan chiqar",
    "darslikdan olib", "kitobdan olib", "kitobdan javob",
)

GENERAL_HINTS = ("ma'lumot", "ma`lumot", "internetdan", "internet orqali")


def detect_mode(question: str, parsed: ParsedQuery) -> str:
    """'book' -> darslikdan qidiradi, 'general' -> AI o'zi (tez) javob beradi."""
    t = db.norm_text(question)
    if any(h in t for h in GENERAL_HINTS):
        return "general"
    if any(p in t for p in _BOOK_PHRASES):
        return "book"
    if parsed.exercise_no is not None or parsed.page_printed is not None:
        return "book"
    if "kitob" in t or "darslik" in t:
        return "book"
    if parsed.subject_name:
        return "book"
    return "general"


def build_general_prompt(question: str) -> str:
    return (
        f"Foydalanuvchi savoli: «{question}»\n\n"
        "QOIDALAR:\n"
        "- Darslikdan qidirish shart emas — umumiy bilim va mantiqqa asoslanib, o'zbek tilida javob bering.\n"
        "- Javob aniq, to'liq va o'quvchiga tushunarli bo'lsin; kerak bo'lsa bosqichma-bosqich yozing.\n"
        "- Formulalarni oddiy matn ko'rinishida yozing: x^2, sqrt(x), 5/2 va h.k.\n"
        "Javobni quyidagi bo'limlarga «## » prefiksi bilan bering:\n"
        "## Izoh\n## Batafsil tushuntirish\n## Xulosa / Javob\n"
    )


def detect_subject(question: str, parsed: ParsedQuery) -> str:
    """Savoldan/matndan fan nomini aniqlaydi (smart subject detection)."""
    if parsed.subject_name:
        return parsed.subject_name
    sid = db.match_subject_id(question)
    if sid:
        return db.subject_name(sid)
    return ""


def _solve_general(question: str) -> Dict[str, Any]:
    if llm.provider() == "none":
        return {"status": "no_llm", "message": NO_LLM_HINT, "plan": "general"}
    messages = [
        {"role": "system", "content": (
            "Siz 8-sinf o'quvchilariga barcha fanlardan yordam beruvchi bilimdon "
            "o'qituvchi-assistantsiz. Kitobdan qidirmasdan, o'z bilimingiz asosida "
            "aniq va tushunarli javob berasiz."
        )},
        {"role": "user", "content": build_general_prompt(question)},
    ]
    try:
        raw = llm.chat(messages, temperature=0.4)
    except Exception as e:
        return {"status": "error", "message": f"AI chaqiruvida muammo: {e}", "plan": "general"}
    return {"status": "ok", "message": "Javob tayyor",
            "sections": parse_sections(raw), "raw": clean_plain_text(raw),
            "plan": "general", "subject": detect_subject(question, retriever.parse_question(question))}


def solve(question: str) -> Dict[str, Any]:
    q = question.strip()
    parsed: ParsedQuery = retriever.parse_question(q)

    if parsed.grade is not None and parsed.grade != 8:
        return {"status": "blocked", "message": retriever.grade_block_message()}

    if not q:
        return {"status": "clarify", "message": "Savolingizni yozib yuboring.", "suggestions": retriever.ask_probe()}

    # "kitobdan top" deb yozilmagan bo'lsa — kitobni qidirmasdan AI o'zi yozadi
    if detect_mode(q, parsed) == "general":
        return _solve_general(q)

    ctx = retriever.build_target_context(parsed)
    plan = None
    if ctx.get("type") == "book_page" and ctx.get("exercise"):
        plan = "exact_exercise"
    elif ctx.get("type") == "book_page" and parsed.exercise_no and not ctx.get("exercise"):
        marks = retriever._page_mark_numbers(ctx.get("page_text", ""))
        msg = (f"{ctx['title']}, {ctx['page_printed']}-betda №{parsed.exercise_no} topilmadi. "
               f"Bu sahifadagi raqamlar: {', '.join('№' + str(n) for n in marks) if marks else '(raqamlar aniqlanmadi)'}. "
               "Raqamni tekshiring yoki boshqa sahifani so'rang.")
        return {"status": "clarify", "message": msg, "manba": _manba(ctx),
                "suggestions": [f"{ctx['subject_name']} 8-sinf {ctx['page_printed']}-bet №{n}" for n in marks[:5]]}

    if plan is None and not ctx.get("page_text") and parsed.subject_id and parsed.page_printed:
        return {"status": "clarify",
                "message": f"{db.subject_name(parsed.subject_id)} 8-sinfda {parsed.page_printed}-bet topilmadi. "
                           "Sahifa raqamini tekshirib qayta so'rang."}

    if plan is None:
        if parsed.subject_id and not parsed.book_ids:
            return {"status": "clarify",
                    "message": f"«{db.subject_name(parsed.subject_id)}» fanidan 8-sinf kitobi hali qo'shilmagan.",
                    "suggestions": retriever.ask_probe()}
        results = retriever.semantic_search(q, top_k=6, subject_id=parsed.subject_id)
        if not results or results[0]["score"] < 0.045:
            return {"status": "clarify", "message": "Kitoblardan aniq ma'lumot topilmadi.",
                    "suggestions": retriever.ask_probe()}
        top = results[0]
        book = db.get_book(top["book_id"])
        # Bir sahifa yetarli bo'lmasa — eng mos 3 sahifa matnini birlashtiramiz
        extra = [r for r in results[1:3] if r.get("text")]
        page_text = top["text"]
        if extra:
            page_text = page_text + "\n\n---\n\n" + "\n\n---\n\n".join(r["text"] for r in extra)
        page_text = page_text[: config.MAX_PAGE_TEXT_FOR_LLM * 2]
        ctx = {
            "type": "semantic", "book_id": top["book_id"], "subject_name": top["subject_name"],
            "title": top["title"], "page_printed": top["printed_page"], "page_pdf": top["page_no"],
            "page_text": page_text,
            "headings": retriever.chapter_heading(book["id"], top["page_no"]) if book else [],
            "edition": book["edition"] if book else "", "year": book["year"] if book else "",
            "author": book["author"] if book else "", "publisher": book["publisher"] if book else "",
        }
        plan = "semantic"

    p = llm.provider()
    if p == "none":
        ex_text = (ctx.get("exercise") or {}).get("text", ctx.get("page_text", "")[:600])
        return {"status": "no_llm", "message": NO_LLM_HINT,
                "sections": [{"label": "Mashq sharti (topilgan)", "text": ex_text}],
                "manba": _manba(ctx)}

    prompt = build_prompt(q, ctx, plan)
    messages = [
        {"role": "system", "content": "Siz 8-sinf o'quvchilariga faqat o'z darsliklari asosida yordam beruvchi yordamchisiz."},
        {"role": "user", "content": prompt},
    ]
    try:
        raw = llm.chat(messages, temperature=0.3)
    except Exception as e:
        return {"status": "error", "message": f"AI chaqiruvida muammo: {e}",
                "manba": _manba(ctx)}

    return {"status": "ok", "message": "Yechim tayyor (kitob matnidan olingan)" if plan == "exact_exercise" else "Yechim tayyor",
            "sections": parse_sections(raw), "raw": clean_plain_text(raw), "manba": _manba(ctx),
            "plan": plan, "subject": detect_subject(q, parsed)}


# ---------------------------------------------------------------------------
# Rasm / yozma (handwriting) uy vazifasi
# ---------------------------------------------------------------------------
def recognize_image_text(image_bytes: bytes) -> str:
    """OCR va (mumkin bo'lsa) vision model yordamida rasm matnini taniydi."""
    from . import pdfingest

    ocr = pdfingest.ocr_image_bytes(image_bytes)
    if llm.provider() == "none":
        return ocr

    import base64
    try:
        from PIL import Image
        import io as _io
        img = Image.open(_io.BytesIO(image_bytes))
        mime, fmt = "image/png", "PNG"
        if img.format == "JPEG":
            mime, fmt = "image/jpeg", "JPEG"
        img = img.convert("RGB")
        buf = _io.BytesIO()
        max_side = 1600
        img.thumbnail((max_side, max_side))
        img.save(buf, format=fmt)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return ocr
    try:
        vision_raw = llm.chat_vision([
            {"role": "system", "content": (
                "Siz uy vazifasi suratlarini taniydigan OCR-assistantsiz. "
                "Rasmdagi barcha matn, masala va topshiriqlarni aniq ko'chiring. "
                "Formulalarni matn ko'rinishida yozing (x^2, sqrt(x), 5/2)."
            )},
            {"role": "user", "content": "Rasmdagi matnni to'liq ko'chirib bering."},
        ], b64, mime, temperature=0.1)
    except Exception:
        return ocr
    vision = " ".join(vision_raw.split())
    if len(vision) > len(ocr):
        return vision
    return ocr


def solve_image(
    image_bytes: bytes,
    mode: str = "homework",
    question: str = "",
) -> Dict[str, Any]:
    """Rasmdan (surat yoki qo'l yozuvidan) uy vazifasini taniydi va yechadi.

    mode: 'homework'  — darslik surati, topshiriqni tani va yech
          'handwriting' — qo'l yozuvi, xatolarni tuzatib variantini tayyorla
    """
    combined = recognize_image_text(image_bytes)
    combined = " ".join(combined.split())
    if not combined:
        return {"status": "clarify",
                "message": "Rasmdan matn topilmadi. Yorug'likka va ravshanlikka e'tibor berib qayta suratga oling.",
                "plan": "image"}

    prompt_q = question.strip()
    subject = detect_subject(prompt_q or combined, retriever.parse_question(prompt_q or combined))
    if llm.provider() == "none":
        return {"status": "no_llm", "message": NO_LLM_HINT,
                "sections": [{"label": "Rasmdagi matn", "text": combined}],
                "image_text": combined, "subject": subject, "plan": "image"}

    if mode == "handwriting":
        task = (
            "Bu qo'l yozilgan daftar sahifasi. Rasmdagi yozmani taniy oling, "
            "imlo/hisob xatolarini tuzating va to'g'rilangan, daftarga ko'chirishga "
            "tayyor ko'rinishini tayyorlab bering. Xatolar ro'yxatini ham qo'shing."
        )
    else:
        task = (
            "Bu uy vazifasi surati. Har bir topshiriqni alohida belgilab, fanini aniqlab, "
            "to'liq yechimini bering. Javobni o'qituvchiga topshirishga mos formatda yozing."
        )

    user_prompt = (
        f"RASMDAGI MATN:\n{combined}\n\n"
        f"{task}\n"
    )
    if prompt_q:
        user_prompt = (
            f"O'QUVCHI SAVOLI: «{prompt_q}»\n\n"
            f"RASMDAGI MATN:\n{combined}\n\n"
            f"{task}\n"
        )

    messages = [
        {"role": "system", "content": (
            "Siz 8-sinf o'quvchilariga barcha fanlardan uy vazifasini bajarishda "
            "yordam beruvchi o'qituvchi-assistantsiz. Qisqa, aniq va o'quvchiga "
            "tushunarli javob berasiz."
        )},
        {"role": "user", "content": user_prompt},
    ]
    try:
        raw = llm.chat(messages, temperature=0.3)
    except Exception as e:
        return {"status": "error", "message": f"AI chaqiruvida muammo: {e}",
                "sections": [{"label": "Rasmdagi matn", "text": combined}],
                "image_text": combined, "subject": subject, "plan": "image"}
    sections = parse_sections(raw)
    sections.insert(0, {"label": "Topshiriq (rasmdan taniqandi)", "text": combined})
    return {
        "status": "ok",
        "message": "Yechim tayyor (rasmdan)",
        "sections": sections,
        "raw": clean_plain_text(raw),
        "image_text": combined,
        "subject": subject,
        "plan": "image",
    }