import hashlib
import os

from fastapi import FastAPI, APIRouter, Request
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


def get_file_hash(filepath: str) -> str:
    try:
        with open(filepath, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()[:8]
    except FileNotFoundError:
        return "0"


def create_app(static_dir: str) -> FastAPI:
    app = FastAPI(title="Digital Product Shop", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
        css_hash = get_file_hash(os.path.join(static_dir, "styles.css"))
        js_hash = get_file_hash(os.path.join(static_dir, "app.js"))
        return templates.TemplateResponse(
            request, "index.html", {"css_hash": css_hash, "js_hash": js_hash}
        )

    return app
