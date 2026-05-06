from db import SessionLocal
from db.models import SupportPage

db = SessionLocal()

pages = [
    {"slug": "warranty", "title": "Chính sách bảo hành", "content": "<p>Nội dung chính sách bảo hành...</p>", "page_type": "warranty"},
    {"slug": "purchase-guide", "title": "Hướng dẫn mua hàng", "content": "<p>Nội dung hướng dẫn mua hàng...</p>", "page_type": "purchase_guide"},
    {"slug": "faq", "title": "Câu hỏi thường gặp", "content": "<p>Nội dung câu hỏi thường gặp...</p>", "page_type": "faq"},
    {"slug": "privacy", "title": "Chính sách bảo mật", "content": "<p>Nội dung chính sách bảo mật...</p>", "page_type": "privacy"}
]

for p in pages:
    exists = db.query(SupportPage).filter_by(slug=p["slug"]).first()
    if not exists:
        page = SupportPage(**p)
        db.add(page)

db.commit()
db.close()
print("Seeded default pages")
