# Digital Product Shop - Project Context

## Current Status
**Last Session:** Fixed support API routing & refactored code for maintainability
- Server running at port 3071 (Vite with hot reload)
- All support pages accessible via footer and sidebar navigation
- OAuth multi-platform support configured (Google, Facebook, GitHub, Discord, TikTok)

## Recent Fixes (This Session)
1. **Support Router Prefix Bug:** Changed `/api/support` → `/support` in api/support.py
   - Was creating `/api/api/support` unreachable endpoints
   - Footer links now work correctly
   - Verified: `curl http://localhost:3071/api/support/config` returns valid JSON

2. **Code Refactoring:** Extracted auth functions into separate module
   - Created `static/auth-pages.js` (249 lines)
   - Extracted: renderLogin, renderRegister, renderAuthCallback from storefront.js
   - Reduced storefront.js from 1,850 → 1,613 lines

3. **Navigation Enhancement:** Added support page link to sidebar
   - Menu item "Hỗ trợ" with headset icon
   - Located in "Khác" section with Offers and Blog
   - Active state highlighting for support pages

## File Organization
**JavaScript Modules (static/):**
- `core.js` (173 lines) - Utility functions, global state, API calls
- `app.js` (208 lines) - SPA router, initialization, sidebar navigation
- `storefront.js` (1,613 lines) - Home, product listing, cart, checkout, offers
- `auth-pages.js` (249 lines) - Login, registration, OAuth callback
- `admin.js` (1,008 lines) - Admin panel (products, orders, settings, OAuth config, support, banners, flash sales, gift codes, affiliates)
- `blog.js` (402 lines) - Blog list and single post pages
- `profile.js` (225 lines) - User profile and account management
- `support.js` (374 lines) - Support home, ticket creation/viewing, support pages
- `oauth-login.js` (58 lines) - OAuth button rendering on login page
- `oauth-settings.js` (190 lines) - OAuth configuration panel for admins

**Python Backend (api/):**
- `auth.py` - User auth (email, OAuth, 2FA)
- `categories.py` - Product categories
- `products.py` - Product CRUD and listing
- `orders.py` - Order management
- `payments.py` - Payment processing
- `admin.py` - Admin endpoints
- `support.py` - Support tickets, pages, config
- `oauth.py` - OAuth provider configuration
- `blog.py` - Blog articles
- `banners.py` - Marketing banners
- `flash_sales.py` - Flash sale management
- `gift_codes.py` - Gift code distribution
- `affiliates.py` - Affiliate system
- `reviews.py` - Product reviews
- `search.py` - Product search

**Database Models (db/models.py):**
- User, Category, Product, ProductVariant
- Order, OrderItem, OrderPayment
- SupportTicket, TicketMessage, SupportPage
- SiteConfig (for OAuth credentials, contact info, settings)
- Banner, FlashSale, GiftCode, Affiliate, Blog, Review

## Architecture Notes
- **SPA:** Hash-based routing (#/) with client-side navigation
- **Database:** SQLAlchemy ORM with SQLite/PostgreSQL support
- **Auth:** JWT tokens stored in localStorage, with 2FA and OAuth support
- **State Management:** Global variables (cart, currentUser, appSettings, categories)
- **Styling:** Responsive CSS with flexbox/grid, dark theme compatible
- **Build:** Vite dev server with hot module reload

## Common Tasks

### Adding New Page/Feature
1. Create render function in appropriate module (or new module)
2. Add route to `routes` object in app.js
3. Optional: Add sidebar navigation link in loadSidebar()
4. Update HTML structure, call from routes

### API Integration Pattern
```javascript
try {
  const data = await apiFetch('/endpoint');
  // Process data
} catch (err) {
  showError(err.message);
}
```

### Modal/Toast Notifications
```javascript
toast('Message', 'success|error|info');
showError('Error message');
```

## Next Steps for Optimization
1. **Admin.js refactoring:** (1,008 lines) consider splitting:
   - `admin-products.js` - Product/category management
   - `admin-orders.js` - Order management
   - `admin-settings.js` - General settings and site config
   - `admin-features.js` - Banners, flash sales, gift codes, affiliates

2. **Storefront.js further refactoring:** (1,613 lines)
   - `products-listing.js` - renderAllProducts, renderCategory
   - `product-detail.js` - renderProduct with variants/reviews
   - `checkout.js` - cart, checkout, orders

3. **CSS optimization:** Consider splitting monolithic styles.css by feature

## Troubleshooting
- **Router prefix issues:** Always check if prefix is duplicated in include_router()
- **API returning HTML:** SPA fallback may be catching the request (check router ordering)
- **Large files:** Module size >1000 lines is a signal to refactor
- **React/Vue:** Project uses vanilla JS - template patterns are DOM manipulation based