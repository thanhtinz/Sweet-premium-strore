"""Seed sample data for the digital product shop."""

from db import SessionLocal
from db.models import Category, Product, ProductPackage, StockItem, Review

def seed():
    db = SessionLocal()
    try:
        # Skip if data already exists
        if db.query(Category).first():
            print("⏭️  Data already exists, skipping seed.")
            return

        # ── Categories ────────────────────────────────────
        categories = [
            Category(name="Tài khoản Premium", slug="tai-khoan-premium", icon_url="https://img.icons8.com/fluency/96/user-shield.png", sort_order=1),
            Category(name="Phần mềm & Key bản quyền", slug="phan-mem-key", icon_url="https://img.icons8.com/fluency/96/key.png", sort_order=2),
            Category(name="Game & Nạp game", slug="game-nap-game", icon_url="https://img.icons8.com/fluency/96/controller.png", sort_order=3),
            Category(name="Khóa học Online", slug="khoa-hoc-online", icon_url="https://img.icons8.com/fluency/96/graduation-cap.png", sort_order=4),
            Category(name="Hosting & Domain", slug="hosting-domain", icon_url="https://img.icons8.com/fluency/96/cloud.png", sort_order=5),
            Category(name="Thiết kế & Đồ họa", slug="thiet-ke-do-hoa", icon_url="https://img.icons8.com/fluency/96/design.png", sort_order=6),
        ]
        db.add_all(categories)
        db.flush()

        cat_map = {c.slug: c.id for c in categories}

        # ── Products & Packages ───────────────────────────
        products_data = [
            # --- Tài khoản Premium ---
            {
                "category": "tai-khoan-premium",
                "name": "Netflix Premium 4K",
                "slug": "netflix-premium-4k",
                "description": "Tài khoản Netflix Premium hỗ trợ 4K Ultra HD, xem trên 4 thiết bị cùng lúc. Bảo hành 12 tháng.",
                "image_url": "https://images.unsplash.com/photo-1574375927938-d5a98e8d6f40?w=600&q=80",
                "is_featured": True,
                "packages": [
                    {"name": "1 tháng", "price": 59000, "original_price": 99000, "delivery_type": "auto"},
                    {"name": "3 tháng", "price": 149000, "original_price": 297000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 499000, "original_price": 1188000, "delivery_type": "auto"},
                ],
            },
            {
                "category": "tai-khoan-premium",
                "name": "Spotify Premium",
                "slug": "spotify-premium",
                "description": "Nghe nhạc không giới hạn, không quảng cáo, chất lượng cao. Hỗ trợ tải offline.",
                "image_url": "https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=600&q=80",
                "is_featured": True,
                "packages": [
                    {"name": "1 tháng", "price": 29000, "original_price": 59000, "delivery_type": "auto"},
                    {"name": "6 tháng", "price": 149000, "original_price": 354000, "delivery_type": "auto"},
                ],
            },
            {
                "category": "tai-khoan-premium",
                "name": "YouTube Premium",
                "slug": "youtube-premium",
                "description": "Xem YouTube không quảng cáo, phát nền, tải video offline. Bao gồm YouTube Music.",
                "image_url": "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=600&q=80",
                "packages": [
                    {"name": "1 tháng", "price": 35000, "original_price": 79000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 350000, "original_price": 948000, "delivery_type": "auto"},
                ],
            },
            {
                "category": "tai-khoan-premium",
                "name": "Canva Pro",
                "slug": "canva-pro",
                "description": "Thiết kế đồ họa chuyên nghiệp với hàng triệu template, ảnh stock và công cụ AI.",
                "image_url": "https://images.unsplash.com/photo-1626785774625-0b1c2c4eab67?w=600&q=80",
                "is_featured": True,
                "packages": [
                    {"name": "1 tháng", "price": 49000, "original_price": 120000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 450000, "original_price": 1440000, "delivery_type": "auto"},
                ],
            },
            # --- Phần mềm & Key ---
            {
                "category": "phan-mem-key",
                "name": "Windows 11 Pro Key",
                "slug": "windows-11-pro-key",
                "description": "Key bản quyền Windows 11 Professional vĩnh viễn. Kích hoạt online, hỗ trợ cài đặt.",
                "image_url": "https://images.unsplash.com/photo-1624571395775-ac440e69e109?w=600&q=80",
                "is_featured": True,
                "packages": [
                    {"name": "Key Retail", "price": 350000, "original_price": 4500000, "delivery_type": "auto"},
                ],
            },
            {
                "category": "phan-mem-key",
                "name": "Microsoft Office 365",
                "slug": "office-365",
                "description": "Bộ công cụ Office đầy đủ: Word, Excel, PowerPoint, OneDrive 1TB. Cập nhật trọn đời.",
                "image_url": "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=600&q=80",
                "packages": [
                    {"name": "1 năm – 1 user", "price": 250000, "original_price": 1500000, "delivery_type": "auto"},
                    {"name": "Trọn đời – 5 user", "price": 650000, "original_price": 5000000, "delivery_type": "auto"},
                ],
            },
            {
                "category": "phan-mem-key",
                "name": "Adobe Creative Cloud",
                "slug": "adobe-creative-cloud",
                "description": "Trọn bộ Adobe: Photoshop, Illustrator, Premiere Pro, After Effects và hơn 20 ứng dụng.",
                "image_url": "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=600&q=80",
                "packages": [
                    {"name": "1 tháng", "price": 120000, "original_price": 400000, "delivery_type": "manual"},
                    {"name": "12 tháng", "price": 990000, "original_price": 4800000, "delivery_type": "manual"},
                ],
            },
            # --- Game ---
            {
                "category": "game-nap-game",
                "name": "Nạp UC PUBG Mobile",
                "slug": "nap-uc-pubg-mobile",
                "description": "Nạp UC PUBG Mobile giá rẻ, giao ngay. Nhập ID game để nhận UC tự động.",
                "image_url": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80",
                "packages": [
                    {"name": "60 UC", "price": 22000, "original_price": 25000, "delivery_type": "manual"},
                    {"name": "325 UC", "price": 99000, "original_price": 119000, "delivery_type": "manual"},
                    {"name": "660 UC", "price": 189000, "original_price": 235000, "delivery_type": "manual"},
                ],
            },
            {
                "category": "game-nap-game",
                "name": "Steam Wallet Code",
                "slug": "steam-wallet-code",
                "description": "Thẻ nạp Steam Wallet chính hãng, mệnh giá đa dạng. Nhận code ngay sau thanh toán.",
                "image_url": "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=600&q=80",
                "is_featured": True,
                "packages": [
                    {"name": "100.000đ", "price": 105000, "delivery_type": "auto"},
                    {"name": "200.000đ", "price": 209000, "delivery_type": "auto"},
                    {"name": "500.000đ", "price": 519000, "delivery_type": "auto"},
                ],
            },
            # --- Khóa học ---
            {
                "category": "khoa-hoc-online",
                "name": "Khóa học Lập trình Python",
                "slug": "khoa-hoc-python",
                "description": "Từ zero đến hero: Python cơ bản đến nâng cao, bao gồm Django, Flask, Data Science. 120+ bài giảng video.",
                "image_url": "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=600&q=80",
                "packages": [
                    {"name": "Trọn đời", "price": 299000, "original_price": 1200000, "delivery_type": "auto"},
                ],
            },
            {
                "category": "khoa-hoc-online",
                "name": "Khóa học Marketing Online",
                "slug": "khoa-hoc-marketing",
                "description": "Facebook Ads, Google Ads, SEO, Email Marketing tất cả trong một khóa. Có chứng chỉ hoàn thành.",
                "image_url": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80",
                "packages": [
                    {"name": "Basic", "price": 199000, "original_price": 600000, "delivery_type": "auto"},
                    {"name": "Pro (kèm mentoring)", "price": 599000, "original_price": 2000000, "delivery_type": "manual"},
                ],
            },
            # --- Hosting & Domain ---
            {
                "category": "hosting-domain",
                "name": "Hosting SSD cao cấp",
                "slug": "hosting-ssd",
                "description": "Hosting NVMe SSD tốc độ cao, uptime 99.9%, free SSL, cPanel. Hỗ trợ WordPress 1-click.",
                "image_url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80",
                "packages": [
                    {"name": "Starter (5GB)", "price": 50000, "original_price": 100000, "delivery_type": "manual"},
                    {"name": "Business (20GB)", "price": 150000, "original_price": 300000, "delivery_type": "manual"},
                    {"name": "Enterprise (50GB)", "price": 350000, "original_price": 700000, "delivery_type": "manual"},
                ],
            },
            # --- Thiết kế ---
            {
                "category": "thiet-ke-do-hoa",
                "name": "Bộ Template Figma UI Kit",
                "slug": "figma-ui-kit",
                "description": "500+ component Figma cho Web & Mobile. Auto-layout, Dark mode, responsive. Cập nhật miễn phí.",
                "image_url": "https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=600&q=80",
                "packages": [
                    {"name": "Standard", "price": 199000, "original_price": 500000, "delivery_type": "auto"},
                    {"name": "Extended (source file)", "price": 399000, "original_price": 1200000, "delivery_type": "auto"},
                ],
            },
            {
                "category": "thiet-ke-do-hoa",
                "name": "Pack 1000+ Icon SVG",
                "slug": "icon-svg-pack",
                "description": "Bộ sưu tập 1000+ icon SVG đa phong cách: line, filled, duotone. Dùng cho web, app, print.",
                "image_url": "https://images.unsplash.com/photo-1558655146-d09347e92766?w=600&q=80",
                "packages": [
                    {"name": "Personal License", "price": 99000, "original_price": 250000, "delivery_type": "auto"},
                    {"name": "Commercial License", "price": 249000, "original_price": 600000, "delivery_type": "auto"},
                ],
            },
        ]

        for pdata in products_data:
            product = Product(
                category_id=cat_map[pdata["category"]],
                name=pdata["name"],
                slug=pdata["slug"],
                description=pdata["description"],
                image_url=pdata["image_url"],
                is_featured=pdata.get("is_featured", False),
            )
            db.add(product)
            db.flush()

            for i, pkg in enumerate(pdata["packages"]):
                package = ProductPackage(
                    product_id=product.id,
                    name=pkg["name"],
                    price=pkg["price"],
                    original_price=pkg.get("original_price"),
                    delivery_type=pkg["delivery_type"],
                    sort_order=i,
                )
                db.add(package)
                db.flush()

                # Add sample stock for auto-delivery packages
                if pkg["delivery_type"] == "auto":
                    for j in range(5):
                        db.add(StockItem(
                            package_id=package.id,
                            data=f"SAMPLE-{product.slug.upper()}-{pkg['name'].replace(' ', '')}-{j+1:04d}",
                        ))

        # ── Sample Reviews ────────────────────────────────
        # Get first few products for reviews
        products = db.query(Product).limit(6).all()
        review_data = [
            ("Nguyễn Văn A", 5, "Sản phẩm rất tốt, giao hàng nhanh chóng!"),
            ("Trần Thị B", 4, "Chất lượng ổn, giá hợp lý. Sẽ mua lại."),
            ("Lê Minh C", 5, "Tuyệt vời, hỗ trợ nhiệt tình. 10 điểm!"),
            ("Phạm Đức D", 4, "Dùng tốt, bảo hành nhanh. Recommend!"),
            ("Hoàng Thị E", 5, "Rẻ hơn nhiều so với mua trực tiếp, rất hài lòng."),
            ("Vũ Quang F", 3, "Tạm được, cần cải thiện tốc độ giao hàng."),
        ]
        for i, product in enumerate(products):
            for j in range(min(3, len(review_data))):
                idx = (i + j) % len(review_data)
                name, rating, comment = review_data[idx]
                db.add(Review(
                    product_id=product.id,
                    user_id=f"sample-user-{idx+1}",
                    user_name=name,
                    rating=rating,
                    comment=comment,
                    is_verified=True,
                ))

        db.commit()
        print(f"✅ Seeded {len(products_data)} products across {len(categories)} categories.")
        print(f"   + packages, stock items, and sample reviews.")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
