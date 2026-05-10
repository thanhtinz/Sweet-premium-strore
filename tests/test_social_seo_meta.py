from pathlib import Path
import sys

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import routes
from db.models import Category, Product, SiteConfig, SupportPage


def _settings():
    return {
        "site_name": "Meta Shop",
        "site_description": "Site description fallback",
        "seo_title": "Meta Shop SEO Title",
        "seo_description": "Meta Shop SEO Description",
        "site_url": "https://example.com",
        "seo_image_url": "/static/seo.png",
        "twitter_card": "summary_large_image",
    }


def _client(monkeypatch, product=None, category=None, support_page=None):
    class Query:
        def __init__(self, model):
            self.model = model

        def filter(self, *args, **kwargs):
            return self

        def first(self):
            if self.model is Product:
                return product
            if self.model is Category:
                return category
            if self.model is SupportPage:
                return support_page
            return None

    class Session:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def query(self, model):
            return Query(model)

        def commit(self):
            pass

        def rollback(self):
            pass

        def close(self):
            pass

    monkeypatch.setattr(routes, "init_db", lambda: None)
    monkeypatch.setattr(routes, "session_scope", lambda: Session())
    monkeypatch.setattr(routes, "load_public_settings", lambda db: _settings())
    monkeypatch.setattr("bot.run_bots.main", lambda: None)
    app = routes.create_app(str(PROJECT_ROOT / "static"))
    app.router.lifespan_context = None
    return TestClient(app)


def test_home_renders_site_social_meta(monkeypatch):
    client = _client(monkeypatch)
    html = client.get("/").text
    assert '<meta property="og:title" content="Meta Shop SEO Title"' in html
    assert '<meta property="og:description" content="Meta Shop SEO Description"' in html
    assert '<meta property="og:image" content="https://example.com/static/seo.png"' in html
    assert '<link rel="canonical" href="https://example.com/"' in html


def test_product_route_renders_product_social_meta(monkeypatch):
    product = Product(id=7, name="Premium Key", slug="premium-key", description="<p>Product desc</p>", image_url="/static/premium.png", is_active=True)
    client = _client(monkeypatch, product=product)
    html = client.get("/product/premium-key?ref=abc").text
    assert '<meta property="og:type" content="product"' in html
    assert '<meta property="og:title" content="Premium Key | Meta Shop"' in html
    assert '<meta property="og:description" content="Product desc"' in html
    assert '<meta property="og:image" content="https://example.com/static/premium.png"' in html
    assert '<meta name="twitter:url" content="https://example.com/product/premium-key?ref=abc"' in html
    assert '<link rel="canonical" href="https://example.com/product/premium-key"' in html


def test_support_route_renders_page_social_meta(monkeypatch):
    page = SupportPage(slug="privacy", title="Privacy Policy", meta_description="Privacy details", content="body", is_published=True)
    client = _client(monkeypatch, support_page=page)
    html = client.get("/support/privacy").text
    assert '<meta property="og:type" content="article"' in html
    assert '<meta property="og:title" content="Privacy Policy | Meta Shop"' in html
    assert '<meta property="og:description" content="Privacy details"' in html


def test_private_routes_are_noindex(monkeypatch):
    client = _client(monkeypatch)
    html = client.get("/admin").text
    assert '<meta name="robots" content="noindex,nofollow"' in html
