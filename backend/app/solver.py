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
            sections.append({"label": cur_label, "text": "\n".join(cur_buf).strip()})

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
        sections = [{"label": "Yechim", "text": raw.strip()}]
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
            "sections": parse_sections(raw), "raw": raw, "plan": "general"}


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
        ctx = {
            "type": "semantic", "book_id": top["book_id"], "subject_name": top["subject_name"],
            "title": top["title"], "page_printed": top["printed_page"], "page_pdf": top["page_no"],
            "page_text": top["text"],
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
            "sections": parse_sections(raw), "raw": raw, "manba": _manba(ctx), "plan": plan}