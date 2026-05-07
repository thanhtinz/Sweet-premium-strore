import hashlib
import os

from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from db.init_db import init_db
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
        return templates.TemplateResponse(
            request, "index.html", {"css_hash": nocache, "js_hash": nocache}
        )

    return app
