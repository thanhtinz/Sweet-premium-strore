import asyncio
import hashlib
import logging
import os
import json
from contextlib import asynccontextmanager
from html import escape
from re import sub
from urllib.parse import urljoin

from fastapi import FastAPI, APIRouter, HTTPException, Request

logger = logging.getLogger("routes")
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from db.init_db import init_db
from db.models import BlogPost, Category, Product, SupportPage
from db.repositories import SiteConfigRepository
from db import session_scope
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
from api.ai_generate import router as ai_router
from api.api_keys import router as apikeys_router


def get_file_hash(filepath: str) -> str:
    try:
        with open(filepath, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()[:8]
    except FileNotFoundError:
        return "0"


def load_public_settings(db) -> dict:
    public_keys = ["site_name", "site_logo", "site_description", "site_banner", "currency", "tax_rate", "home_categories"]
    repo = SiteConfigRepository(db)
    result = {}
    for key in public_keys:
        value = repo.get_value(key)
        if value is not None:
            result[key] = value
    config_keys = ["settings_general", "settings_images", "settings_features", "settings_appearance"]
    rows = repo.get_many_json(config_keys)
    for key, data in rows.items():
        if not isinstance(data, dict):
            data = {}
        if key == "settings_general":
            if data.get("title") and not result.get("site_name"):
                result["site_name"] = data["title"]
            if data.get("site_description") and not result.get("site_description"):
                result["site_description"] = data["site_description"]
            if data.get("copyright_text"):
                result["copyright_text"] = data["copyright_text"]
            for field in ["currency_name", "currency_icon", "tax_rate", "contact_email", "contact_phone", "contact_hours", "social_fb", "social_tele", "social_discord", "seo_title", "seo_description", "seo_keywords", "seo_author", "site_url", "twitter_card", "keywords", "author"]:
                if field in data and data[field] is not None:
                    result[field] = data[field]
        elif key == "settings_images":
            for field in ["logo_url", "favicon_url", "default_image_url", "default_avatar_url", "seo_image_url"]:
                if data.get(field):
                    result[field] = data[field]
        elif key == "settings_features":
            result["features"] = data
        elif key == "settings_appearance":
            if data.get("home_categories"):
                result["home_categories"] = data["home_categories"]
    return result


def public_base_url(settings: dict, request: Request) -> str:
    return (settings.get("site_url") or str(request.base_url)).rstrip("/") + "/"


def absolute_url(url: str, request: Request, base_url: str | None = None) -> str:
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url
    return urljoin(base_url or str(request.base_url), url.lstrip("/"))


def clean_meta_text(value: str | None, fallback: str = "", limit: int = 220) -> str:
    raw = str(value or fallback or "")
    raw = sub(r"<[^>]*>", " ", raw)
    return " ".join(raw.split())[:limit]


def canonical_url(settings: dict, request: Request, path: str | None = None, include_query: bool = False) -> str:
    base = public_base_url(settings, request).rstrip("/")
    target_path = path if path is not None else request.url.path
    if not target_path.startswith("/"):
        target_path = f"/{target_path}"
    query = f"?{request.url.query}" if include_query and request.url.query else ""
    return f"{base}{target_path}{query}"


def default_meta_image(settings: dict, request: Request) -> str:
    base = public_base_url(settings, request)
    image = settings.get("seo_image_url") or settings.get("default_image_url") or settings.get("logo_url") or settings.get("site_logo") or "/static/candy-icon.png"
    return absolute_url(image, request, base)


def build_spa_meta(settings: dict, request: Request, **overrides) -> dict:
    site_name = settings.get("site_name") or "ShopKey"
    site_description = settings.get("seo_description") or settings.get("site_description") or "Mua tài khoản, key, gift card và các sản phẩm số uy tín"
    title = overrides.get("title") or settings.get("seo_title") or site_name or "ShopKey — Sản phẩm số"
    description = clean_meta_text(overrides.get("description"), site_description, 220)
    canonical = overrides.get("canonical_url") or canonical_url(settings, request, overrides.get("path"), overrides.get("include_query", False))
    image_url = overrides.get("image_url") or default_meta_image(settings, request)
    favicon_url = absolute_url(settings.get("favicon_url") or settings.get("logo_url") or settings.get("site_logo") or "/static/candy-icon.png", request, public_base_url(settings, request))
    return {
        "site_name": site_name,
        "site_description": site_description,
        "seo_title": title,
        "seo_description": description,
        "seo_keywords": overrides.get("keywords") or settings.get("seo_keywords") or settings.get("keywords") or site_name,
        "seo_author": overrides.get("author") or settings.get("seo_author") or settings.get("author") or site_name,
        "twitter_card": settings.get("twitter_card") or "summary_large_image",
        "canonical_url": canonical,
        "social_url": overrides.get("social_url") or canonical,
        "favicon_url": favicon_url,
        "seo_image_url": image_url,
        "default_image_url": image_url,
        "og_type": overrides.get("og_type") or "website",
        "og_image_alt": overrides.get("image_alt") or title,
        "robots": overrides.get("robots") or "index,follow",
    }


def product_meta(product: Product, settings: dict, request: Request, include_query: bool = False) -> dict:
    site_name = settings.get("site_name") or "ShopKey"
    site_description = settings.get("seo_description") or settings.get("site_description") or "Mua tài khoản, key, gift card và các sản phẩm số uy tín"
    title = f"{product.name} | {site_name}"
    description = clean_meta_text(product.description or product.notes, site_description, 220)
    image_url = absolute_url(product.image_url or default_meta_image(settings, request), request, public_base_url(settings, request))
    clean_url = canonical_url(settings, request, f"/product/{product.slug}")
    social_url = canonical_url(settings, request, f"/product/{product.slug}", include_query=include_query)
    return build_spa_meta(
        settings,
        request,
        title=title,
        description=description,
        image_url=image_url,
        path=f"/product/{product.slug}",
        og_type="product",
        image_alt=product.name,
        canonical_url=clean_url,
        social_url=social_url,
    )


def build_share_product_html(product: Product, settings: dict, request: Request, ref: str | None = None) -> str:
    meta = product_meta(product, settings, request, include_query=bool(ref))
    clean_target = canonical_url(settings, request, f"/product/{product.slug}")
    redirect_url = meta["social_url"] if ref else clean_target
    return f"""<!DOCTYPE html>
<html lang=\"vi\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
  <title>{escape(meta['seo_title'])}</title>
  <meta name=\"description\" content=\"{escape(meta['seo_description'])}\" />
  {f'<meta name=\"keywords\" content=\"{escape(meta["seo_keywords"])}\" />' if meta.get("seo_keywords") else ''}
  {f'<meta name=\"author\" content=\"{escape(meta["seo_author"])}\" />' if meta.get("seo_author") else ''}
  <link rel=\"canonical\" href=\"{escape(clean_target)}\" />
  <meta property=\"og:locale\" content=\"vi_VN\" />
  <meta property=\"og:type\" content=\"product\" />
  <meta property=\"og:title\" content=\"{escape(meta['seo_title'])}\" />
  <meta property=\"og:description\" content=\"{escape(meta['seo_description'])}\" />
  <meta property=\"og:url\" content=\"{escape(meta['social_url'])}\" />
  <meta property=\"og:site_name\" content=\"{escape(meta['site_name'])}\" />
  <meta property=\"og:image\" content=\"{escape(meta['seo_image_url'])}\" />
  <meta property=\"og:image:secure_url\" content=\"{escape(meta['seo_image_url'])}\" />
  <meta property=\"og:image:alt\" content=\"{escape(meta['og_image_alt'])}\" />
  <meta name=\"twitter:card\" content=\"{escape(meta['twitter_card'])}\" />
  <meta name=\"twitter:title\" content=\"{escape(meta['seo_title'])}\" />
  <meta name=\"twitter:description\" content=\"{escape(meta['seo_description'])}\" />
  <meta name=\"twitter:image\" content=\"{escape(meta['seo_image_url'])}\" />
  <meta name=\"twitter:url\" content=\"{escape(meta['social_url'])}\" />
  {f'<link rel=\"icon\" href=\"{escape(meta["favicon_url"])}\" />' if meta.get("favicon_url") else ''}
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
    public_base = public_base_url(settings, request)
    logo_url = absolute_url(settings.get("logo_url") or settings.get("site_logo") or "", request, public_base)
    favicon_url = absolute_url(settings.get("favicon_url") or settings.get("logo_url") or settings.get("site_logo") or "/static/candy-icon.png", request, public_base)
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
        image_url = absolute_url(post.thumbnail_url or settings.get("seo_image_url") or settings.get("default_image_url") or settings.get("logo_url") or settings.get("site_logo") or "/static/candy-icon.png", request, public_base)
    else:
        title = settings.get("seo_title") or f"Blog | {site_name}"
        description = site_description
        image_url = absolute_url(settings.get("seo_image_url") or settings.get("default_image_url") or settings.get("logo_url") or settings.get("site_logo") or "/static/candy-icon.png", request, public_base)

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



@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Start bot runner alongside the web server."""
    from bot.run_bots import main as run_bots_main

    async def _bot_wrapper():
        try:
            await run_bots_main()
        except Exception as exc:
            logger.error("Bot runner crashed: %s", exc, exc_info=True)

    bot_task = asyncio.create_task(_bot_wrapper())

    yield

    bot_task.cancel()
    try:
        await bot_task
    except (asyncio.CancelledError, Exception):
        pass


def create_app(static_dir: str) -> FastAPI:
    app = FastAPI(title="Digital Product Shop", version="1.0.0", lifespan=_lifespan)

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
    api.include_router(ai_router)
    api.include_router(apikeys_router)

    @api.get("/health")
    def health():
        return {"ok": True, "service": "digital-product-shop"}

    app.include_router(api)

    # Static files
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    templates = Jinja2Templates(directory=static_dir)

    @app.get("/share/product/{slug}", response_class=HTMLResponse)
    def share_product_page(request: Request, slug: str, ref: str | None = None):
        with session_scope() as db:
            product = db.query(Product).filter(Product.slug == slug, Product.is_active == True).first()
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            settings = load_public_settings(db)
            return HTMLResponse(build_share_product_html(product, settings, request, ref=ref))

    @app.get("/blog", response_class=HTMLResponse)
    def blog_index_page(request: Request):
        with session_scope() as db:
            settings = load_public_settings(db)
            meta = build_blog_meta(None, settings, request)

        import time
        nocache = str(int(time.time() * 1000))
        return templates.TemplateResponse(
            request,
            "blog.html",
            {"css_hash": nocache, "js_hash": nocache, **meta},
        )

    @app.get("/blog/{slug}", response_class=HTMLResponse)
    def blog_post_page(request: Request, slug: str):
        with session_scope() as db:
            post = db.query(BlogPost).filter(BlogPost.slug == slug, BlogPost.is_published == True).first()
            if not post:
                raise HTTPException(status_code=404, detail="Post not found")
            settings = load_public_settings(db)
            meta = build_blog_meta(post, settings, request)

        import time
        nocache = str(int(time.time() * 1000))
        return templates.TemplateResponse(
            request,
            "blog.html",
            {"css_hash": nocache, "js_hash": nocache, "blog_slug": slug, **meta},
        )

    # SPA fallback — all non-API routes serve index.html
    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], response_class=HTMLResponse)
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
        with session_scope() as db:
            settings = load_public_settings(db)
            path = request.url.path
            meta = build_spa_meta(settings, request)

            if path.startswith("/product/"):
                slug = path.removeprefix("/product/").strip("/")
                product = db.query(Product).filter(Product.slug == slug, Product.is_active == True).first()
                if not product:
                    raise HTTPException(status_code=404, detail="Product not found")
                meta = product_meta(product, settings, request, include_query=bool(request.url.query))
            elif path.startswith("/support/"):
                slug = path.removeprefix("/support/").strip("/")
                page = db.query(SupportPage).filter(SupportPage.slug == slug, SupportPage.is_published == True).first()
                if page:
                    title = f"{page.title} | {settings.get('site_name') or 'ShopKey'}"
                    meta = build_spa_meta(
                        settings,
                        request,
                        title=title,
                        description=page.meta_description or page.content,
                        path=f"/support/{page.slug}",
                        og_type="article",
                    )
            elif path.startswith("/category/"):
                slug = path.removeprefix("/category/").strip("/")
                category = db.query(Category).filter(Category.slug == slug, Category.is_active == True).first()
                if category:
                    title = f"{category.name} | {settings.get('site_name') or 'ShopKey'}"
                    image_url = absolute_url(category.image_url or category.icon_url or default_meta_image(settings, request), request, public_base_url(settings, request))
                    meta = build_spa_meta(settings, request, title=title, description=f"Khám phá sản phẩm trong danh mục {category.name}", image_url=image_url, path=f"/category/{category.slug}")
            elif path == "/all":
                cat_slug = request.query_params.get("cat") or request.query_params.get("category")
                if cat_slug:
                    category = db.query(Category).filter(Category.slug == cat_slug, Category.is_active == True).first()
                    if category:
                        title = f"{category.name} | {settings.get('site_name') or 'ShopKey'}"
                        image_url = absolute_url(category.image_url or category.icon_url or default_meta_image(settings, request), request, public_base_url(settings, request))
                        meta = build_spa_meta(settings, request, title=title, description=f"Khám phá sản phẩm trong danh mục {category.name}", image_url=image_url, include_query=True)
            elif path in {"/admin", "/login", "/register", "/profile", "/cart", "/checkout", "/orders"} or path.startswith(("/admin/", "/orders/", "/payos-checkout/")):
                meta = build_spa_meta(settings, request, robots="noindex,nofollow")

        return templates.TemplateResponse(
            request,
            "index.html",
            {"css_hash": nocache, "js_hash": nocache, **meta},
        )

    return app
