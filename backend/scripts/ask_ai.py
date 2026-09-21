from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import storage

storage.init_schema()
from app import llm, retriever, solver, db


def main():
    import argparse

    p = argparse.ArgumentParser(description="AI mashq yechuvchi — terminal orqali sinash")
    p.add_argument("question", nargs="*", help='Masalan: "Algebra 8-sinf 100-bet №2"')
    args = p.parse_args()
    q = " ".join(args.question)
    if not q:
        q = input("Savo l 'yozing: ").strip()

    status = llm.status()
    print(f"AI provayder: {status['provider']}  (model: {status['model']})")

    parsed = retriever.parse_question(q)
    print(f"Tahlil: fan={parsed.subject_id}, sinf={parsed.grade}, "
          f"bet={parsed.page_printed}, mashq={parsed.exercise_no}, kitoblar={parsed.book_ids}")

    result = solver.solve(q)
    print("\n" + "=" * 60)
    if result["status"] == "blocked":
        print(result["message"])
    else:
        if result.get("sections"):
            for sec in result["sections"]:
                print(f"\n[{sec['label']}]\n{sec['text']}")
        if result.get("message"):
            print("\n" + result["message"])
        manba = result.get("manba") or {}
        if manba.get("book_id"):
            print("\nManba: " + ", ".join(
                str(x) for x in [manba.get("title"), f"{manba.get('printed_page')}-bet",
                                 manba.get("year")] if x))


if __name__ == "__main__":
    main()