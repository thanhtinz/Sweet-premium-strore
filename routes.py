import hashlib
import os
import json
from html import escape
from urllib.parse import urljoin

from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from db.init_db import init_db
from db.models import BlogPost, Product, SiteConfig, SiteSetting
from db import SessionLocal
from api.auth import router as auth_router
from api.categories import router as cat_router
from api.products import router as prod_router
from api.stock import router as stock_router
from api.orders import router as orders_router
from api.payment import router as payment_router
from api.admin import router as admin_router
from api.banners import router as banner_router
from api.flash_sales import router as flash_router
from api.gift_codes import router as gift_router
from api.affiliates import router as aff_router
from api.blog import router as blog_router
from api.search import router as search_router
from api.reviews import router as reviews_router
from api.support import router as support_router
from api.bot_config import router as bot_router
from api.bot_links_routes import router as bot_links_router
from api.oauth import router as oauth_router
from api.announcements import router as announcements_router
from api.balance import router as balance_router
from api.wishlist import router as wishlist_router


def get_file_hash(filepath: str) -> str:
    try:
        with open(filepath, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()[:8]
    except FileNotFoundError:
        return "0"


def load_public_settings(db) -> dict:
    public_keys = ["site_name", "site_logo", "site_description", "site_banner", "currency", "tax_rate", "home_categories"]
    settings = db.query(SiteSetting).filter(SiteSetting.key.in_(public_keys)).all()
    result = {s.key: s.value for s in settings}
    config_keys = ["settings_general", "settings_images", "settings_features", "settings_appearance"]
    rows = db.query(SiteConfig).filter(SiteConfig.key.in_(config_keys)).all()
    for row in rows:
        try:
            data = json.loads(row.value) if row.value else {}
        except (json.JSONDecodeError, TypeError):
            data = {}
        if row.key == "settings_general":
            if data.get("title") and not result.get("site_name"):
                result["site_name"] = data["title"]
            if data.get("site_description") and not result.get("site_description"):
                result["site_description"] = data["site_description"]
            if data.get("copyright_text"):
                result["copyright_text"] = data["copyright_text"]
            for field in ["currency_name", "currency_icon", "tax_rate", "contact_email", "contact_phone", "contact_hours", "social_fb", "social_tele", "social_discord", "seo_title", "seo_description", "seo_keywords", "seo_author", "site_url", "twitter_card", "keywords", "author"]:
                if field in data and data[field] is not None:
                    result[field] = data[field]
        elif row.key == "settings_images":
            for field in ["logo_url", "favicon_url", "default_image_url", "default_avatar_url", "seo_image_url"]:
                if data.get(field):
                    result[field] = data[field]
        elif row.key == "settings_features":
            result["features"] = data
        elif row.key == "settings_appearance":
            if data.get("home_categories"):
                result["home_categories"] = data["home_categories"]
    return result


def absolute_url(url: str, request: Request) -> str:
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url
    return urljoin(str(request.base_url), url.lstrip("/"))


def build_share_product_html(product: Product, settings: dict, request: Request, ref: str | None = None) -> str:
    site_name = settings.get("site_name") or "ShopKey"
    site_description = settings.get("seo_description") or settings.get("site_description") or "Mua tài khoản, key, gift card và các sản phẩm số uy tín"
    title = settings.get("seo_title") or f"{product.name} | {site_name}"
    raw_desc = product.description or product.notes or site_description
    description = " ".join(str(raw_desc).replace("<", " ").replace(">", " ").split())[:220]
    share_image = settings.get("seo_image_url") or settings.get("default_image_url") or settings.get("logo_url") or settings.get("site_logo") or ""
    image_url = absolute_url(share_image, request)
    favicon_url = absolute_url(settings.get("favicon_url") or settings.get("logo_url") or settings.get("site_logo") or "", request)
    canonical_base = (settings.get("site_url") or str(request.base_url)).rstrip("/") + "/"
    target_hash = f"#/product/{product.slug}"
    if ref:
        target_hash += f"?ref={escape(ref)}"
    target_url = f"{canonical_base}{target_hash.lstrip('#/')}" if settings.get("site_url") else f"{request.base_url}{target_hash}".replace("//#", "/#")
    redirect_url = f"{canonical_base}{target_hash.lstrip('#/')}" if settings.get("site_url") else f"{request.base_url}#/product/{product.slug}"
    if ref:
        redirect_url += f"?ref={escape(ref)}"
    return f"""<!DOCTYPE html>
<html lang=\"vi\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
  <title>{escape(title)}</title>
  <meta name=\"description\" content=\"{escape(description)}\" />
  {f'<meta name=\"keywords\" content=\"{escape(settings.get("seo_keywords") or settings.get("keywords") or "")}\" />' if (settings.get("seo_keywords") or settings.get("keywords")) else ''}
  {f'<meta name=\"author\" content=\"{escape(settings.get("seo_author") or settings.get("author") or site_name)}\" />' if (settings.get("seo_author") or settings.get("author") or site_name) else ''}
  <link rel=\"canonical\" href=\"{escape(target_url)}\" />
  <meta property=\"og:type\" content=\"product\" />
  <meta property=\"og:title\" content=\"{escape(title)}\" />
  <meta property=\"og:description\" content=\"{escape(description)}\" />
  <meta property=\"og:url\" content=\"{escape(target_url)}\" />
  <meta property=\"og:site_name\" content=\"{escape(site_name)}\" />
  <meta property=\"og:image\" content=\"{escape(image_url)}\" />
  <meta name=\"twitter:card\" content=\"{escape(settings.get('twitter_card') or 'summary_large_image')}\" />
  <meta name=\"twitter:title\" content=\"{escape(title)}\" />
  <meta name=\"twitter:description\" content=\"{escape(description)}\" />
  <meta name=\"twitter:image\" content=\"{escape(image_url)}\" />
  {f'<link rel=\"icon\" href=\"{escape(favicon_url)}\" />' if favicon_url else ''}
  <meta http-equiv=\"refresh\" content=\"0; url={escape(redirect_url)}\" />
  <script>window.location.replace({json.dumps(redirect_url)});</script>
</head>
<body>
  <p>Đang chuyển hướng tới <a href=\"{escape(redirect_url)}\">{escape(product.name)}</a>...</p>
</body>
</html>"""


def build_blog_meta(post: BlogPost | None, settings: dict, request: Request) -> dict:
    site_name = settings.get("site_name") or "ShopKey"
    site_description = settings.get("seo_description") or settings.get("site_description") or "Cập nhật tin tức, hướng dẫn và mẹo hay mỗi ngày"
    logo_url = absolute_url(settings.get("logo_url") or settings.get("site_logo") or "", request)
    favicon_url = absolute_url(settings.get("favicon_url") or settings.get("logo_url") or settings.get("site_logo") or "/static/candy-icon.png", request)
    twitter_card = settings.get("twitter_card") or "summary_large_image"
    seo_author = settings.get("seo_author") or settings.get("author") or site_name
    seo_keywords = settings.get("seo_keywords") or settings.get("keywords") or site_name
    canonical_url = str(request.url)
    if settings.get("site_url"):
        base = settings.get("site_url").rstrip("/")
        canonical_url = f"{base}{request.url.path}"

    if post:
        title = post.meta_title or post.title or settings.get("seo_title") or f"Blog | {site_name}"
        raw_desc = post.meta_description or post.excerpt or site_description
        description = " ".join(str(raw_desc).replace("<", " ").replace(">", " ").split())[:220]
        image_url = absolute_url(post.thumbnail_url or settings.get("seo_image_url") or settings.get("default_image_url") or settings.get("logo_url") or settings.get("site_logo") or "/static/candy-icon.png", request)
    else:
        title = settings.get("seo_title") or f"Blog | {site_name}"
        description = site_description
        image_url = absolute_url(settings.get("seo_image_url") or settings.get("default_image_url") or settings.get("logo_url") or settings.get("site_logo") or "/static/candy-icon.png", request)

    return {
        "site_name": site_name,
        "title": title,
        "description": description,
        "image_url": image_url,
        "favicon_url": favicon_url,
        "logo_url": logo_url,
        "canonical_url": canonical_url,
        "copyright_text": settings.get("copyright_text") or f"Copyright © 2026 {site_name}. All rights reserved.",
        "twitter_card": twitter_card,
        "seo_author": seo_author,
        "seo_keywords": seo_keywords,
    }



def create_app(static_dir: str) -> FastAPI:
    app = FastAPI(title="Digital Product Shop", version="1.0.0")

    # CORS — restrict in production via ALLOWED_ORIGINS env var
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
    origins = [o.strip() for o in allowed_origins.split(",") if o.strip()] if allowed_origins else []

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins else ["*"],
        allow_credentials=bool(origins),
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Init DB on startup
    init_db()

    # API routes
    api = APIRouter(prefix="/api")
    api.include_router(auth_router)
    api.include_router(cat_router)
    api.include_router(prod_router)
    api.include_router(stock_router)
    api.include_router(orders_router)
    api.include_router(payment_router)
    api.include_router(admin_router)
    api.include_router(banner_router)
    api.include_router(flash_router)
    api.include_router(gift_router)
    api.include_router(aff_router)
    api.include_router(blog_router)
    api.include_router(search_router)
    api.include_router(reviews_router)
    api.include_router(support_router)
    api.include_router(bot_router)
    api.include_router(bot_links_router)
    api.include_router(oauth_router)
    api.include_router(announcements_router)
    api.include_router(balance_router)
    api.include_router(wishlist_router)

    @api.get("/health")
    def health():
        return {"ok": True, "service": "digital-product-shop"}

    app.include_router(api)

    # Static files
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    templates = Jinja2Templates(directory=static_dir)

    @app.get("/share/product/{slug}", response_class=HTMLResponse)
    def share_product_page(request: Request, slug: str, ref: str | None = None):
        db = SessionLocal()
        try:
            product = db.query(Product).filter(Product.slug == slug, Product.is_active == True).first()
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            settings = load_public_settings(db)
            return HTMLResponse(build_share_product_html(product, settings, request, ref=ref))
        finally:
            db.close()

    @app.get("/blog", response_class=HTMLResponse)
    def blog_index_page(request: Request):
        db = SessionLocal()
        try:
            settings = load_public_settings(db)
            meta = build_blog_meta(None, settings, request)
        finally:
            db.close()

        import time
        nocache = str(int(time.time() * 1000))
        return templates.TemplateResponse(
            request,
            "blog.html",
            {"css_hash": nocache, "js_hash": nocache, **meta},
        )

    @app.get("/blog/{slug}", response_class=HTMLResponse)
    def blog_post_page(request: Request, slug: str):
        db = SessionLocal()
        try:
            post = db.query(BlogPost).filter(BlogPost.slug == slug, BlogPost.is_published == True).first()
            if not post:
                raise HTTPException(status_code=404, detail="Post not found")
            settings = load_public_settings(db)
            meta = build_blog_meta(post, settings, request)
        finally:
            db.close()

        import time
        nocache = str(int(time.time() * 1000))
        return templates.TemplateResponse(
            request,
            "blog.html",
            {"css_hash": nocache, "js_hash": nocache, "blog_slug": slug, **meta},
        )

    # SPA fallback — all non-API routes serve index.html
    @app.get("/{full_path:path}", response_class=HTMLResponse)
    def spa_fallback(request: Request, full_path: str):
        # API paths that hit the catch-all need trailing slash redirect
        if full_path.startswith("api/") or full_path == "api":
            from fastapi.responses import RedirectResponse, JSONResponse
            # Only redirect if path doesn't already end with /
            path = request.url.path
            if not path.endswith("/"):
                target = str(request.url).replace(path, path + "/", 1)
                return RedirectResponse(url=target, status_code=307)
            # Already has slash but still no route matched — return 404
            return JSONResponse({"detail": "Not found"}, status_code=404)
        
        import time
        nocache = str(int(time.time() * 1000))
        db = SessionLocal()
        try:
            settings = load_public_settings(db)
        finally:
            db.close()
        canonical_base = (settings.get("site_url") or str(request.base_url)).rstrip("/")
        return templates.TemplateResponse(
            request,
            "index.html",
            {
                "css_hash": nocache,
                "js_hash": nocache,
                "site_name": settings.get("site_name") or "ShopKey",
                "site_description": settings.get("seo_description") or settings.get("site_description") or "Mua tài khoản, key, gift card và các sản phẩm số uy tín",
                "seo_title": settings.get("seo_title") or settings.get("site_name") or "ShopKey — Sản phẩm số",
                "seo_description": settings.get("seo_description") or settings.get("site_description") or "Mua tài khoản, key, gift card và các sản phẩm số uy tín",
                "seo_keywords": settings.get("seo_keywords") or settings.get("keywords") or (settings.get("site_name") or "ShopKey"),
                "seo_author": settings.get("seo_author") or settings.get("author") or (settings.get("site_name") or "ShopKey"),
                "twitter_card": settings.get("twitter_card") or "summary_large_image",
                "canonical_url": f"{canonical_base}{request.url.path}",
                "seo_image_url": settings.get("seo_image_url") or settings.get("default_image_url") or settings.get("logo_url") or settings.get("site_logo") or "",
                "default_image_url": settings.get("default_image_url") or settings.get("logo_url") or settings.get("site_logo") or "",
            },
        )

    return app
