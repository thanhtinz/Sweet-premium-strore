"""Seed SMM platforms, categories, and services."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from db import SessionLocal
from db.models import SmmPlatform, SmmCategory, SmmService

SEED = [
    {
        "name": "Facebook",
        "slug": "facebook",
        "icon_url": "https://cdn-icons-png.flaticon.com/512/733/733547.png",
        "sort_order": 1,
        "categories": [
            {
                "name": "Like", "slug": "fb-like", "sort_order": 1,
                "services": [
                    {"name": "Facebook Like - Việt Nam 🇻🇳", "rate": 35000, "min_quantity": 100, "max_quantity": 50000, "can_refill": True, "description": "Like từ tài khoản Việt Nam, bảo hành 30 ngày"},
                    {"name": "Facebook Like - Mix Quốc Tế 🌐", "rate": 20000, "min_quantity": 50, "max_quantity": 100000, "can_refill": False, "description": "Like từ tài khoản quốc tế, tốc độ nhanh"},
                ],
            },
            {
                "name": "Follow", "slug": "fb-follow", "sort_order": 2,
                "services": [
                    {"name": "Facebook Follow - Việt Nam 🇻🇳", "rate": 50000, "min_quantity": 100, "max_quantity": 30000, "can_refill": True, "description": "Follow profile, bảo hành 30 ngày"},
                    {"name": "Facebook Follow - Quốc Tế 🌐", "rate": 25000, "min_quantity": 100, "max_quantity": 100000, "can_refill": False},
                ],
            },
            {
                "name": "Comment", "slug": "fb-comment", "sort_order": 3,
                "services": [
                    {"name": "Facebook Comment Random Tiếng Việt", "rate": 80000, "min_quantity": 10, "max_quantity": 5000, "can_refill": False, "description": "Comment nội dung ngẫu nhiên bằng tiếng Việt"},
                ],
            },
            {
                "name": "View", "slug": "fb-view", "sort_order": 4,
                "services": [
                    {"name": "Facebook Video View", "rate": 5000, "min_quantity": 500, "max_quantity": 1000000, "can_refill": False, "description": "Tăng view video Facebook"},
                    {"name": "Facebook Reel View", "rate": 8000, "min_quantity": 100, "max_quantity": 500000, "can_refill": False},
                ],
            },
        ],
    },
    {
        "name": "Instagram",
        "slug": "instagram",
        "icon_url": "https://cdn-icons-png.flaticon.com/512/2111/2111463.png",
        "sort_order": 2,
        "categories": [
            {
                "name": "Follower", "slug": "ig-follower", "sort_order": 1,
                "services": [
                    {"name": "Instagram Follower - Mix Quốc Tế", "rate": 30000, "min_quantity": 50, "max_quantity": 100000, "can_refill": True, "description": "Follower quốc tế, bảo hành 30 ngày"},
                    {"name": "Instagram Follower - Real Active", "rate": 80000, "min_quantity": 100, "max_quantity": 20000, "can_refill": True, "description": "Follower thật, hoạt động, bảo hành 60 ngày"},
                ],
            },
            {
                "name": "Like", "slug": "ig-like", "sort_order": 2,
                "services": [
                    {"name": "Instagram Like - Giá Rẻ", "rate": 12000, "min_quantity": 50, "max_quantity": 200000, "can_refill": False},
                    {"name": "Instagram Like - Chất Lượng Cao", "rate": 40000, "min_quantity": 50, "max_quantity": 50000, "can_refill": True},
                ],
            },
            {
                "name": "View", "slug": "ig-view", "sort_order": 3,
                "services": [
                    {"name": "Instagram Reel View", "rate": 3000, "min_quantity": 100, "max_quantity": 5000000, "can_refill": False},
                    {"name": "Instagram Story View", "rate": 5000, "min_quantity": 100, "max_quantity": 500000, "can_refill": False},
                ],
            },
            {
                "name": "Comment", "slug": "ig-comment", "sort_order": 4,
                "services": [
                    {"name": "Instagram Comment Custom", "rate": 100000, "min_quantity": 5, "max_quantity": 2000, "can_refill": False, "description": "Bạn gửi nội dung comment kèm link"},
                ],
            },
        ],
    },
    {
        "name": "TikTok",
        "slug": "tiktok",
        "icon_url": "https://cdn-icons-png.flaticon.com/512/3046/3046121.png",
        "sort_order": 3,
        "categories": [
            {
                "name": "Follower", "slug": "tt-follower", "sort_order": 1,
                "services": [
                    {"name": "TikTok Follower - Mix Quốc Tế", "rate": 40000, "min_quantity": 50, "max_quantity": 100000, "can_refill": True},
                    {"name": "TikTok Follower - Việt Nam", "rate": 70000, "min_quantity": 100, "max_quantity": 20000, "can_refill": True, "description": "Follower Việt, bảo hành 30 ngày"},
                ],
            },
            {
                "name": "Like", "slug": "tt-like", "sort_order": 2,
                "services": [
                    {"name": "TikTok Like - Giá Rẻ", "rate": 15000, "min_quantity": 50, "max_quantity": 200000, "can_refill": False},
                    {"name": "TikTok Like - Chất Lượng", "rate": 35000, "min_quantity": 50, "max_quantity": 50000, "can_refill": True},
                ],
            },
            {
                "name": "View", "slug": "tt-view", "sort_order": 3,
                "services": [
                    {"name": "TikTok Video View", "rate": 2000, "min_quantity": 500, "max_quantity": 10000000, "can_refill": False, "description": "View video TikTok, tốc độ rất nhanh"},
                ],
            },
            {
                "name": "Share", "slug": "tt-share", "sort_order": 4,
                "services": [
                    {"name": "TikTok Share Video", "rate": 25000, "min_quantity": 100, "max_quantity": 100000, "can_refill": False},
                ],
            },
        ],
    },
    {
        "name": "YouTube",
        "slug": "youtube",
        "icon_url": "https://cdn-icons-png.flaticon.com/512/1384/1384060.png",
        "sort_order": 4,
        "categories": [
            {
                "name": "Subscriber", "slug": "yt-subscriber", "sort_order": 1,
                "services": [
                    {"name": "YouTube Subscriber - Quốc Tế", "rate": 80000, "min_quantity": 50, "max_quantity": 50000, "can_refill": True, "description": "Subscriber quốc tế, bảo hành 30 ngày"},
                ],
            },
            {
                "name": "View", "slug": "yt-view", "sort_order": 2,
                "services": [
                    {"name": "YouTube View - Giá Rẻ", "rate": 10000, "min_quantity": 500, "max_quantity": 1000000, "can_refill": False},
                    {"name": "YouTube View - High Retention", "rate": 30000, "min_quantity": 100, "max_quantity": 100000, "can_refill": False, "description": "View với thời gian xem lâu, tốt cho SEO"},
                ],
            },
            {
                "name": "Like", "slug": "yt-like", "sort_order": 3,
                "services": [
                    {"name": "YouTube Like", "rate": 25000, "min_quantity": 50, "max_quantity": 100000, "can_refill": True},
                ],
            },
        ],
    },
    {
        "name": "Telegram",
        "slug": "telegram",
        "icon_url": "https://cdn-icons-png.flaticon.com/512/2111/2111646.png",
        "sort_order": 5,
        "categories": [
            {
                "name": "Member", "slug": "tg-member", "sort_order": 1,
                "services": [
                    {"name": "Telegram Group/Channel Member", "rate": 20000, "min_quantity": 100, "max_quantity": 100000, "can_refill": False, "description": "Thêm member vào group hoặc channel"},
                ],
            },
            {
                "name": "View", "slug": "tg-view", "sort_order": 2,
                "services": [
                    {"name": "Telegram Post View", "rate": 3000, "min_quantity": 100, "max_quantity": 1000000, "can_refill": False},
                ],
            },
        ],
    },
]


def seed():
    db = SessionLocal()
    try:
        existing = db.query(SmmPlatform).count()
        if existing > 0:
            print(f"Already {existing} platforms exist. Skipping seed.")
            return

        for p_data in SEED:
            platform = SmmPlatform(
                name=p_data["name"],
                slug=p_data["slug"],
                icon_url=p_data.get("icon_url"),
                sort_order=p_data.get("sort_order", 0),
                is_active=True,
            )
            db.add(platform)
            db.flush()

            for c_data in p_data["categories"]:
                cat = SmmCategory(
                    platform_id=platform.id,
                    name=c_data["name"],
                    slug=c_data["slug"],
                    sort_order=c_data.get("sort_order", 0),
                    is_active=True,
                )
                db.add(cat)
                db.flush()

                for s_data in c_data["services"]:
                    svc = SmmService(
                        category_id=cat.id,
                        name=s_data["name"],
                        description=s_data.get("description"),
                        rate=s_data.get("rate", 0),
                        min_quantity=s_data.get("min_quantity", 1),
                        max_quantity=s_data.get("max_quantity", 10000),
                        delivery_type="manual",
                        can_refill=s_data.get("can_refill", False),
                        can_cancel=False,
                        is_active=True,
                    )
                    db.add(svc)

            print(f"  ✓ {p_data['name']}: {len(p_data['categories'])} categories, {sum(len(c['services']) for c in p_data['categories'])} services")

        db.commit()
        total_svc = db.query(SmmService).count()
        print(f"\n✅ Seed complete: {len(SEED)} platforms, {total_svc} services total")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
