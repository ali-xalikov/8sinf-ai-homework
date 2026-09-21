import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db, config, storage

storage.init_schema()

SUBJECT_HINT = """Fan id'lari:
  algebra, geometriya, fizika, kimyo, biologiya, ona-tili, adabiyot,
  uzbekiston-tarixi, jahon-tarixi, ingliz-tili, rus-tili, geografiya,
  informatika, texnologiya, chizmachilik, jismoniy-tarbiya, musiqa, huquq
"""


def main():
    import argparse

    p = argparse.ArgumentParser(description="books/ ichiga PDF tashlangan kitobni ro'yxatga qo'shadi")
    p.add_argument("pdf", help="PDF fayl yoki papka manzili")
    p.add_argument("--subject", default="", help=SUBJECT_HINT)
    p.add_argument("--title", default="", help="Kitob nomi (bo'sh bo'lsa fayl nomidan olinadi)")
    p.add_argument("--author", default="")
    p.add_argument("--edition", default="", help="Nashr (masalan: 2022-yil O'qituvchi nashriyoti uchun)")
    p.add_argument("--publisher", default="")
    p.add_argument("--year", default="")
    p.add_argument("--lang", default="uz")
    p.add_argument("--no-index", action="store_true", help="Indekslashni o'tkazib yuborish")
    args = p.parse_args()

    pdf = Path(args.pdf)
    if not pdf.exists():
        print(f"XATO: {pdf} topilmadi")
        sys.exit(1)

    if pdf.is_dir():
        files = sorted(pdf.glob("*.pdf"))
        if not files:
            print(f"XATO: {pdf} papkasida *.pdf yo'q")
            sys.exit(1)
    else:
        files = [pdf]

    subject = args.subject
    if not subject:
        hint = pdf.name if pdf.is_file() else pdf.name
        subject = db.match_subject_id(hint) or db.match_subject_id(str(pdf)) or ""
    if not subject:
        print(SUBJECT_HINT)
        subject = input("Fan id'ini kiriting: ").strip().lower() or "algebra"
    if subject not in [s["id"] for s in db.DEFAULT_SUBJECTS]:
        print(f"Ogohlantirish: '{subject}' standart fanlar ro'yxatida yo'q, baribir qo'shiladi.")

    for f in files:
        subj_dir = config.BOOKS_DIR / db.slugify(subject)
        subj_dir.mkdir(parents=True, exist_ok=True)
        dest = subj_dir / f.name
        if dest != f:
            import shutil
            shutil.copy2(f, dest)
        rel = dest.relative_to(config.PROJECT_ROOT).as_posix()
        title = args.title or (f.parent.name if not f.is_file() else f.stem)
        bid = db.book_id(subject, dest.name)
        db.merge_book_into_metadata(subject, db.SUBJECT_NAMES.get(subject, subject), bid,
                                    title, args.author, args.edition, args.publisher, args.year, rel, args.lang)
        print("Qo'shildi:", dest, "-> fan:", subject)

    if not args.no_index:
        from app import indexer
        print(indexer.index_all())


if __name__ == "__main__":
    main()