import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db, storage

storage.init_schema()


def main():
    import argparse

    p = argparse.ArgumentParser(description="Barcha yoki tanlangan kitoblarni indekslash")
    p.add_argument("--book", action="append", default=[], help="Faqat shu kitob id(lari)ni indekslash")
    p.add_argument("--status", action="store_true", help="Faqat holatni ko'rsatish")
    args = p.parse_args()

    if args.status:
        for b in db.list_books():
            print(f"{b['subject_name']:20s} | {b['title'][:40]:40s} | "
                  f"{'✓ indexed' if b['indexed'] else '— tekshirilmagan':14s} | {b['num_pages']} sahifa")
        return

    from app import indexer

    result = indexer.index_all(only_ids=args.book or None)
    print("Indekslash tugadi:")
    vec = result["vector"]
    print(f"  kitoblar (chunk): {vec['books']}, matn bo'laklari: {vec['chunks']}")
    for item in result["indexed"]:
        if "error" in item:
            print(f"  ✗ {item['book_id']}: {item['error']}")
        else:
            print(f"  ✓ {item['book_id']}: {item['pages']} sahifa, "
                  f"{item['text_chars']} belgi, {item['chunks']} chunk, OCR {item['ocr_pages']} sahifa")


if __name__ == "__main__":
    main()