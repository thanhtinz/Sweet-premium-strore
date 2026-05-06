# Plan: 3 Features — Product UI, Feature Toggles, Wishlist

## Context
User requests 3 changes:
1. Remove quantity stepper from order card, move stock display into package pills with icons
2. Admin feature toggles — enable/disable site features, hide routes + block API when off
3. Wishlist (favorites) — heart button on products, home section, dedicated page with search/pagination

## Scope & Non-Goals
**In scope:** All 3 features fully implemented
**Non-goals:** Product-level qty in cart (keep existing), no email notifications for wishlist

---

## Feature 1: Product Detail — Remove Qty, Enhance Package Pills

### Changes
**`static/storefront.js`** — `renderOrderForm()` (~line 773):
- Remove the `pd-qty-row` block (A section, lines 784-793)
- Remove the stock info banner (E section, lines 857-876) — stock now shown in pills
- Hardcode `quantity = 1` (already default)
- Update price summary to use `price * 1` instead of `price * quantity`
- Remove qty +/- button event wiring (lines 907-910)

**`static/storefront.js`** — Package pills (~line 720):
- Add icon to each pill based on `delivery_type`:
  - `auto` → `fa-solid fa-bolt` (auto delivery)
  - manual → `fa-solid fa-hand-holding-box` or `fa-solid fa-truck`
- Move stock count display into the pill:
  - For `auto`: show "⚡ Tự động • Còn X" next to badge
  - For `is_stock_managed`: show "📦 Còn X sản phẩm"
  - Keep existing `getStockBadge()` for out-of-stock/low-stock states

**`static/styles.css`** — Minor tweaks for new pill icon layout

---

## Feature 2: Admin Feature Toggles

### Design
Store as `settings_features` key in `SiteConfig` (JSON object). Each feature is a boolean:
```json
{
  "blog": true,
  "offers": true,
  "affiliate": true,
  "support": true,
  "flash_sales": true,
  "reviews": true,
  "announcements": true,
  "balance": true
}
```
Default: all true (enabled).

### Changes

**`api/admin.py`**:
- Add `"settings_features"` to `SETTINGS_KEYS`
- In `get_public_settings()`: also read `settings_features` and include in response as `features`

**`static/core.js`**:
- Store `appSettings.features` on load
- Add helper `isFeatureEnabled(name)` → checks `appSettings.features?.[name] !== false`

**`static/app.js`** — Router:
- In `loadSidebar()`: conditionally render sidebar items based on `isFeatureEnabled()`
  - Blog link: `isFeatureEnabled('blog')`
  - Offers: `isFeatureEnabled('offers')`
  - Affiliate: `isFeatureEnabled('affiliate')`
  - Support: `isFeatureEnabled('support')`
- In route handler: if feature disabled, show "Chức năng tạm ngưng" message instead of rendering

**`static/storefront.js`** — Home page:
- Flash sale section: check `isFeatureEnabled('flash_sales')`
- Announcements: check `isFeatureEnabled('announcements')`

**`static/admin.js`** — Settings:
- Add new tab "Chức năng" to `renderAdminSettings()`
- Show toggle switches for each feature
- Save as `settings_features` key

**Backend API middleware** (optional but recommended):
- In each feature router (blog, support, affiliate, etc.), check feature flag
- Return 403 "Chức năng đã tắt" if disabled
- Implementation: create `api/feature_guard.py` with `Depends()` that reads SiteConfig

### Feature → Route mapping:
| Feature | Routes hidden | API prefix blocked |
|---------|--------------|-------------------|
| blog | `/blog`, `/blog/:slug` | `/blog/` |
| offers | `/offers` | `/gift-codes/public` |
| affiliate | `/affiliate` | `/affiliate/` |
| support | `/support`, `/support/*` | `/support/` |
| flash_sales | (home section only) | `/flash-sales/` |
| reviews | (product detail section) | `/reviews/` |
| announcements | (home section only) | `/announcements/` |
| balance | (profile section) | `/balance/` |

---

## Feature 3: Wishlist / Favorites

### Database
**`db/models.py`** — New model:
```python
class Wishlist(Base):
    __tablename__ = "wishlists"
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    __table_args__ = (UniqueConstraint('user_id', 'product_id'),)
```

### API
**`api/wishlist.py`** — New router `/wishlist`:
- `GET /` — list user's wishlist (paginated, search by product name)
- `POST /{product_id}` — add to wishlist (toggle: add if not exists, remove if exists)
- `DELETE /{product_id}` — remove from wishlist
- `GET /check/{product_id}` — check if product is in wishlist
- `GET /ids` — return list of product_ids in user's wishlist (for bulk check on home/listing pages)

### Frontend

**`static/core.js`**:
- `let wishlistIds = new Set()` — cached set of product IDs
- `async function loadWishlist()` — fetch `/wishlist/ids`, populate set
- `function isWishlisted(productId)` → checks set
- `async function toggleWishlist(productId)` → POST toggle, update set, return new state

**`static/storefront.js`** — Product detail (`renderProduct`):
- Add heart button in `pd-name-row` (next to product name)
- Filled heart if wishlisted, outline if not
- Click toggles wishlist

**`static/storefront.js`** — `productCard()`:
- Add small heart icon overlay on card image (top-right)
- Click stops propagation + toggles wishlist

**`static/storefront.js`** — Home (`renderHome`):
- After featured products section, before category sections:
- If user is logged in AND has wishlist items:
  - Section head: "❤️ Sản phẩm yêu thích" + "Xem tất cả →"
  - Show first 4-6 products in `product-grid`
  - Fetch via `GET /wishlist/?limit=6`

**`static/storefront.js`** — New `renderWishlist(view)`:
- Full page with breadcrumb, search input, product grid
- Pagination (load more or page numbers)
- Search filters products by name
- Empty state when no favorites

**`static/app.js`**:
- Add route: `'/wishlist': renderWishlist`
- Add sidebar link "Yêu thích" with heart icon (after "Tất cả", before categories) — only if logged in
- Call `loadWishlist()` in `init()` if user is logged in

**`static/styles.css`**:
- Heart button styles (`.wishlist-btn`)
- Heart overlay on product card (`.product-card-heart`)

### DB Migration
```sql
CREATE TABLE IF NOT EXISTS wishlists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);
CREATE INDEX idx_wishlists_user ON wishlists(user_id);
```

---

## Implementation Order
1. **Feature 1** (smallest) — Remove qty, enhance pills
2. **Feature 3** (wishlist) — DB → API → frontend
3. **Feature 2** (feature toggles) — Settings key → admin UI → frontend guards → API guards

## Verification
- Feature 1: Open product detail, verify no qty stepper, stock info in pills with icons
- Feature 2: Toggle blog off in admin → verify `/blog` shows disabled message, sidebar hides blog
- Feature 3: Click heart on product → verify in wishlist, home shows section, `/wishlist` page works with search
