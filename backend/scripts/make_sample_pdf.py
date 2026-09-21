"""8-sinf sinov kitobi PDF-generatori.
SUN'IY NAMUNA kitob — faqat PHASE 6/7 (PDF/indekslash/RAG) zanjirini tekshirish uchun.
Real kitoblar bilan almashtirish mumkin.
"""
from pathlib import Path

import fitz  # PyMuPDF

OUT = Path(__file__).resolve().parents[2] / "books" / "algebra" / "Algebra_8-sinf_NAMUNA.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

doc = fitz.open()

EX = []
i = 0
exs = [
    "2x + 5 = 17 tenglamani yeching",
    "5(x - 3) = 20 tenglamani yeching",
    "x/4 = 9 bo'lsa, x qiymatini toping",
    "2x - 7 = x + 3 tenglamani yeching",
    "Uchta ketma-ket butun son yig'indisi 72. Sonlarni toping",
    "3x + 4 = 2x + 9 tenglamani yeching",
    "Piyoda 5 km/h tezlikda 3 soat yurdi. U qancha yo'l bosdi?",
    "Bir do'konda 12 ta olma va 18 ta nok bor. Mevalar qancha?",
    "7 - 2x = 1 tenglamani yeching",
    "Kvadratning perimetri 48 sm. Tomoni necha sm?",
    "4x - 3 = 3x + 5 tenglamani yeching",
    "Birinchi son 6, ikkinchisi undan 3 ga katta. Yig'indini toping",
    "x/5 + 2 = 7 tenglamani yeching",
    "To'g'ri to'rtburchakning yuzi 42, tomonlari 6 va x. x toping",
    "2(x + 1) = 3x - 2 tenglamani yeching",
    "Sayyoh 1-kuni 12 km, 2-kuni 8 km yurdi. Jami qancha?",
    "3x - 5 = 2x + 4 tenglamani yeching",
    "Bir sonning 3 baravari 21. Son nechi?",
    "x + 7 = 15 tenglamani yeching",
    "Ikki son yig'indisi 30, ayirmasi 10. Sonlarni toping",
]
Y = 90
EX2 = []
for idx, ex in enumerate(exs, start=1):
    tag = f"{idx}."
    EX2.append((tag, ex))

for page_no in range(1, 9 + 1):
    page = doc.new_page(width=600, height=800)
    page.insert_text((40, 45), "ALGEBRA 8-SINF - SINOV (NAMUNA)  |  matematika majmuasi", fontsize=14)
    page.insert_text((40, 70), f"{page_no}-bet", fontsize=18)
    y = 110
    for tag, ex in EX2[(page_no - 1) * 2 : (page_no - 1) * 2 + 2]:
        page.insert_text((40, y), f"{tag} {ex}", fontsize=13)
        y += 40
    page.insert_text((40, 750), f"Sahifa {page_no} / 9", fontsize=10)

doc.save(OUT)
print("Yaratildi:", OUT, "sahifalar:", doc.page_count)