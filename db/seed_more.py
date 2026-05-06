"""Add more sample products to fill out the shop."""

from db import SessionLocal
from db.models import Product, ProductPackage, StockItem, Review

def seed_more():
    db = SessionLocal()
    try:
        # ── Fix products with no packages ─────────────────
        adobe = db.query(Product).filter(Product.slug == "adobe-cc").first()
        if adobe and not adobe.packages:
            for i, pkg in enumerate([
                {"name": "1 tháng", "price": 150000, "original_price": 400000, "delivery_type": "manual"},
                {"name": "12 tháng", "price": 1290000, "original_price": 4800000, "delivery_type": "manual"},
            ]):
                db.add(ProductPackage(product_id=adobe.id, name=pkg["name"], price=pkg["price"],
                    original_price=pkg["original_price"], delivery_type=pkg["delivery_type"], sort_order=i))
            print("  + Added packages for Adobe CC")

        win11 = db.query(Product).filter(Product.slug == "win11-pro").first()
        if win11 and not win11.packages:
            pkg = ProductPackage(product_id=win11.id, name="Key Retail", price=350000,
                original_price=4500000, delivery_type="auto", sort_order=0)
            db.add(pkg)
            db.flush()
            for j in range(5):
                db.add(StockItem(package_id=pkg.id, data=f"WIN11-PRO-RETAIL-{j+1:04d}"))
            print("  + Added package + stock for Windows 11 Pro")

        # ── New products ──────────────────────────────────
        new_products = [
            # VPN
            {
                "category_id": 11, "name": "Surfshark VPN", "slug": "surfshark-vpn",
                "description": "VPN không giới hạn thiết bị, bảo mật AES-256, CleanWeb chặn quảng cáo. 3200+ server tại 100 quốc gia.",
                "image_url": "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=80",
                "packages": [
                    {"name": "1 tháng", "price": 55000, "original_price": 120000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 399000, "original_price": 1440000, "delivery_type": "auto"},
                    {"name": "24 tháng", "price": 599000, "original_price": 2880000, "delivery_type": "auto"},
                ],
            },
            # AI Tools
            {
                "category_id": 15, "name": "Copilot Pro", "slug": "copilot-pro",
                "description": "Microsoft Copilot Pro - AI assistant tích hợp Word, Excel, PowerPoint. GPT-4 Turbo ưu tiên, tạo ảnh DALL-E 3.",
                "image_url": "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=80",
                "is_featured": True,
                "packages": [
                    {"name": "1 tháng", "price": 89000, "original_price": 200000, "delivery_type": "auto"},
                    {"name": "6 tháng", "price": 449000, "original_price": 1200000, "delivery_type": "auto"},
                ],
            },
            {
                "category_id": 16, "name": "Perplexity Pro", "slug": "perplexity-pro",
                "description": "Công cụ tìm kiếm AI thông minh với trả lời chính xác, trích dẫn nguồn. GPT-4, Claude, tải file không giới hạn.",
                "image_url": "https://images.unsplash.com/photo-1655720828018-edd2daec9349?w=600&q=80",
                "packages": [
                    {"name": "1 tháng", "price": 79000, "original_price": 200000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 790000, "original_price": 2400000, "delivery_type": "auto"},
                ],
            },
            # Steam
            {
                "category_id": 19, "name": "GTA V - Steam Offline", "slug": "gta-v-steam-offline",
                "description": "Grand Theft Auto V bản Steam Offline. Chơi story mode đầy đủ, không cần kết nối mạng.",
                "image_url": "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&q=80",
                "packages": [
                    {"name": "Tài khoản Steam Offline", "price": 49000, "original_price": 300000, "delivery_type": "auto"},
                ],
            },
            {
                "category_id": 20, "name": "Steam Gift Card 50$", "slug": "steam-gift-card-50",
                "description": "Thẻ quà tặng Steam $50 USD. Dùng để mua game, DLC, in-game items trên Steam Store.",
                "image_url": "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=600&q=80",
                "packages": [
                    {"name": "$50 Gift Card", "price": 1290000, "original_price": 1350000, "delivery_type": "auto"},
                ],
            },
            # Design
            {
                "category_id": 24, "name": "Figma Pro", "slug": "figma-pro",
                "description": "Tài khoản Figma Professional. Unlimited projects, version history, team libraries. Thiết kế UI/UX chuyên nghiệp.",
                "image_url": "https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=600&q=80",
                "packages": [
                    {"name": "1 tháng", "price": 89000, "original_price": 250000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 890000, "original_price": 3000000, "delivery_type": "auto"},
                ],
            },
            # Office
            {
                "category_id": 27, "name": "Microsoft Visio Pro", "slug": "visio-pro",
                "description": "Microsoft Visio Professional 2021 key bản quyền vĩnh viễn. Tạo sơ đồ, flowchart, diagram chuyên nghiệp.",
                "image_url": "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=600&q=80",
                "packages": [
                    {"name": "Key vĩnh viễn", "price": 290000, "original_price": 3500000, "delivery_type": "auto"},
                ],
            },
            # eSIM
            {
                "category_id": 28, "name": "eSIM Nhật Bản 7 ngày", "slug": "esim-japan-7d",
                "description": "eSIM du lịch Nhật Bản 7 ngày, 5GB data 4G/LTE. Kích hoạt qua QR code, không cần đổi SIM.",
                "image_url": "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=600&q=80",
                "packages": [
                    {"name": "5GB / 7 ngày", "price": 119000, "original_price": 200000, "delivery_type": "auto"},
                    {"name": "10GB / 15 ngày", "price": 199000, "original_price": 350000, "delivery_type": "auto"},
                ],
            },
            {
                "category_id": 28, "name": "eSIM Hàn Quốc", "slug": "esim-korea",
                "description": "eSIM Hàn Quốc unlimited data, tốc độ cao. Phủ sóng SKT/KT/LGU+. QR code nhận ngay.",
                "image_url": "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=600&q=80",
                "packages": [
                    {"name": "5 ngày unlimited", "price": 149000, "original_price": 250000, "delivery_type": "auto"},
                    {"name": "10 ngày unlimited", "price": 249000, "original_price": 400000, "delivery_type": "auto"},
                ],
            },
            {
                "category_id": 29, "name": "eSIM Châu Âu 30 ngày", "slug": "esim-europe-30d",
                "description": "eSIM du lịch 42 nước Châu Âu (EU + UK). 10GB data 4G, gọi nội mạng miễn phí.",
                "image_url": "https://images.unsplash.com/photo-1491557345352-5929e343eb89?w=600&q=80",
                "packages": [
                    {"name": "10GB / 30 ngày", "price": 299000, "original_price": 500000, "delivery_type": "auto"},
                    {"name": "20GB / 30 ngày", "price": 449000, "original_price": 750000, "delivery_type": "auto"},
                ],
            },
            {
                "category_id": 30, "name": "eSIM Mỹ T-Mobile", "slug": "esim-us-tmobile",
                "description": "eSIM Mỹ mạng T-Mobile, unlimited data + call. Phủ sóng toàn nước Mỹ, kích hoạt tức thì.",
                "image_url": "https://images.unsplash.com/photo-1485738422979-f5c462d49f04?w=600&q=80",
                "packages": [
                    {"name": "7 ngày unlimited", "price": 199000, "original_price": 350000, "delivery_type": "auto"},
                    {"name": "15 ngày unlimited", "price": 349000, "original_price": 600000, "delivery_type": "auto"},
                    {"name": "30 ngày unlimited", "price": 549000, "original_price": 900000, "delivery_type": "auto"},
                ],
            },
            # Education
            {
                "category_id": 31, "name": "Duolingo Plus", "slug": "duolingo-plus",
                "description": "Học ngoại ngữ không quảng cáo, luyện tập không giới hạn, theo dõi tiến trình. 40+ ngôn ngữ.",
                "image_url": "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=600&q=80",
                "packages": [
                    {"name": "1 tháng", "price": 49000, "original_price": 120000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 399000, "original_price": 1440000, "delivery_type": "auto"},
                ],
            },
            {
                "category_id": 32, "name": "Coursera Plus", "slug": "coursera-plus",
                "description": "Truy cập 7000+ khóa học từ Google, IBM, Stanford. Lấy chứng chỉ không giới hạn.",
                "image_url": "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=600&q=80",
                "is_featured": True,
                "packages": [
                    {"name": "1 tháng", "price": 199000, "original_price": 500000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 1490000, "original_price": 6000000, "delivery_type": "auto"},
                ],
            },
            {
                "category_id": 33, "name": "Grammarly Premium", "slug": "grammarly-premium",
                "description": "Kiểm tra ngữ pháp, chính tả, văn phong tiếng Anh nâng cao. AI viết lại câu, plagiarism checker.",
                "image_url": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&q=80",
                "packages": [
                    {"name": "1 tháng", "price": 69000, "original_price": 200000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 590000, "original_price": 2400000, "delivery_type": "auto"},
                ],
            },
            # Streaming
            {
                "category_id": 37, "name": "Disney+ Premium", "slug": "disney-plus-premium",
                "description": "Xem phim Disney, Marvel, Star Wars, Pixar, National Geographic. 4K HDR, 4 thiết bị cùng lúc.",
                "image_url": "https://images.unsplash.com/photo-1640499900704-b00dd6a1103a?w=600&q=80",
                "packages": [
                    {"name": "1 tháng", "price": 45000, "original_price": 99000, "delivery_type": "auto"},
                    {"name": "12 tháng", "price": 399000, "original_price": 1188000, "delivery_type": "auto"},
                ],
            },
        ]

        added = 0
        for pdata in new_products:
            # Skip if product slug already exists
            existing = db.query(Product).filter(Product.slug == pdata["slug"]).first()
            if existing:
                continue

            product = Product(
                category_id=pdata["category_id"],
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

                if pkg["delivery_type"] == "auto":
                    for j in range(5):
                        db.add(StockItem(
                            package_id=package.id,
                            data=f"SAMPLE-{product.slug.upper()}-{j+1:04d}",
                        ))

            added += 1

        # ── Add reviews for new products ──────────────────
        review_templates = [
            ("Nguyễn Minh Tuấn", 5, "Dịch vụ tuyệt vời, nhận hàng nhanh chóng. Sẽ quay lại!"),
            ("Trần Thu Hà", 4, "Giá tốt hơn mua trực tiếp rất nhiều. Hài lòng."),
            ("Lê Quốc Bảo", 5, "Shop uy tín, hỗ trợ nhanh. 5 sao!"),
            ("Phạm Thị Mai", 4, "Sản phẩm chất lượng, giao hàng tự động rất tiện."),
            ("Hoàng Đức Anh", 5, "Đã mua nhiều lần, lần nào cũng OK. Recommend cho mọi người!"),
        ]
        all_products = db.query(Product).all()
        for i, product in enumerate(all_products):
            existing_reviews = len(product.reviews) if product.reviews else 0
            if existing_reviews == 0:
                for j in range(min(3, len(review_templates))):
                    idx = (i + j) % len(review_templates)
                    name, rating, comment = review_templates[idx]
                    db.add(Review(
                        product_id=product.id,
                        user_id=f"sample-user-{idx+100}",
                        user_name=name,
                        rating=rating,
                        comment=comment,
                        is_verified=True,
                    ))

        db.commit()
        total_products = db.query(Product).count()
        total_packages = db.query(ProductPackage).count()
        print(f"✅ Added {added} new products.")
        print(f"   Total: {total_products} products, {total_packages} packages")

    except Exception as e:
        db.rollback()
        print(f"❌ Failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_more()
