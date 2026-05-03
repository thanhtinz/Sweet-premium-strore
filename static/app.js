/* ═══════════════════════════════════════════════════════════════
   ShopKey — Main SPA Application
   Stack: Vanilla JS, FastAPI backend, Neon Auth
   DashStack-inspired UI
═══════════════════════════════════════════════════════════════ */

// ── Config ─────────────────────────────────────────────────────
const API = '/api';

// ── State ──────────────────────────────────────────────────────
let currentUser = null;
let authToken = null;
let categories = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

// ── Utilities ──────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
const fmtDate = (s) => s ? new Date(s).toLocaleString('vi-VN') : '—';
const qs = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => [...el.querySelectorAll(s)];
const el = (tag, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

// ── SVG Icons ──────────────────────────────────────────────────
const ico = {
  zap:        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  shield:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
  card:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  box:        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  star:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starFill:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--amber)" stroke="var(--amber)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  settings:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  arrowLeft:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  inbox:      `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  grid:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
};

function statusBadge(status) {
  const map = {
    pending: ['badge-yellow', 'Chờ thanh toán'],
    paid: ['badge-blue', 'Đã thanh toán'],
    processing: ['badge-blue', 'Đang xử lý'],
    completed: ['badge-green', 'Hoàn thành'],
    cancelled: ['badge-red', 'Đã hủy'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── Toast ──────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3000) {
  const box = qs('#toast-container');
  const t = el('div', `toast toast-${type}`);
  const icons = { success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>', error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>', warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' };
  t.innerHTML = `<div class="toast-icon">${icons[type] || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'}</div><div class="toast-text">${msg}</div>`;
  box.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ── API Client ─────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    let err = `HTTP ${res.status}`;
    try { const j = await res.json(); err = j.detail || err; } catch (_) {}
    throw new Error(err);
  }
  return res.json();
}

// ── Auth ───────────────────────────────────────────────────────
function saveToken(token) {
  authToken = token;
  if (token) localStorage.setItem('sk_token', token);
  else localStorage.removeItem('sk_token');
}
function loadToken() { authToken = localStorage.getItem('sk_token'); }

async function fetchMe() {
  if (!authToken) return;
  try { currentUser = await apiFetch('/auth/me'); }
  catch (_) { currentUser = null; saveToken(null); }
}

function updateAuthUI() {
  const loggedIn = qs('#dropdown-logged-in');
  const loggedOut = qs('#dropdown-logged-out');
  const dropdownAdmin = qs('#dropdown-admin');
  const dropdownName = qs('#dropdown-name');
  const dropdownEmail = qs('#dropdown-email');
  const userAvatar = qs('#user-avatar');

  if (currentUser) {
    if (loggedIn) loggedIn.style.display = '';
    if (loggedOut) loggedOut.style.display = 'none';
    const name = currentUser.display_name || currentUser.email?.split('@')[0] || 'User';
    const email = currentUser.email || '';
    if (dropdownName) dropdownName.textContent = name;
    if (dropdownEmail) dropdownEmail.textContent = email;
    if (userAvatar) {
      if (currentUser.avatar_url) {
        userAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
      } else {
        userAvatar.textContent = name.charAt(0).toUpperCase();
      }
    }
    if (dropdownAdmin) dropdownAdmin.style.display = currentUser.is_admin ? 'flex' : 'none';
  } else {
    if (loggedIn) loggedIn.style.display = 'none';
    if (loggedOut) loggedOut.style.display = '';
    if (userAvatar) userAvatar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  }
}

// ── Cart ───────────────────────────────────────────────────────
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); updateCartCount(); }
function updateCartCount() {
  const badge = qs('#cart-count');
  if (!badge) return;
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}
function addToCart(product, pkg, quantity = 1, fields = {}) {
  const price = pkg.flash_sale ? pkg.flash_sale.sale_price : pkg.price;
  const existing = cart.find(i => i.pkg_id === pkg.id);
  if (existing) existing.quantity += quantity;
  else cart.push({ pkg_id: pkg.id, pkg_name: pkg.name, pkg_price: price, product_name: product.name, product_slug: product.slug, product_img: product.image_url, delivery_type: pkg.delivery_type, quantity, fields });
  saveCart();
  toast(`Đã thêm <b>${pkg.name}</b> vào giỏ hàng`, 'success');
}
function removeFromCart(pkg_id) { cart = cart.filter(i => i.pkg_id !== pkg_id); saveCart(); }
function cartTotal() { return cart.reduce((s, i) => s + i.pkg_price * i.quantity, 0); }

// ── Modal ──────────────────────────────────────────────────────
function openModal(html, title = '') {
  const overlay = qs('#modal-overlay');
  const content = qs('#modal-content');
  const titleEl = qs('#modal-title');
  if (titleEl) titleEl.textContent = title;
  content.innerHTML = html;
  overlay.style.display = 'flex';
}
function closeModal() { qs('#modal-overlay').style.display = 'none'; }

// ── Sidebar Toggle (mobile) ───────────────────────────────────
function closeSidebar() {
  qs('#sidebar')?.classList.remove('open');
  qs('#sidebar-overlay')?.classList.remove('open');
}
function toggleSidebar() {
  const sb = qs('#sidebar');
  const ov = qs('#sidebar-overlay');
  if (sb) { sb.classList.toggle('open'); ov?.classList.toggle('open'); }
}

// ── Router ─────────────────────────────────────────────────────
const routes = {
  '/': renderHome,
  '/products': renderAllProducts,
  '/category/:slug': renderCategory,
  '/product/:slug': renderProduct,
  '/cart': renderCart,
  '/checkout': renderCheckout,
  '/orders': renderOrders,
  '/orders/:code': renderOrderDetail,
  '/search': renderSearch,
  '/login': renderLogin,
  '/register': renderRegister,
  '/auth-callback': renderAuthCallback,
  '/admin': renderAdmin,
  '/admin/categories': renderAdminCategories,
  '/admin/products': renderAdminProducts,
  '/admin/orders': renderAdminOrders,
  '/admin/stock': renderAdminStock,
  '/admin/settings': renderAdminSettings,
  '/admin/banners': renderAdminBanners,
  '/admin/flash-sales': renderAdminFlashSales,
  '/admin/gift-codes': renderAdminGiftCodes,
  '/admin/affiliates': renderAdminAffiliates,
  '/blog': renderBlogList,
  '/blog/:slug': renderBlogPost,
  '/admin/blog': renderAdminBlog,
  '/profile': renderProfile,
};

function parseRoute(hash) {
  const path = hash.replace(/^#/, '') || '/';
  for (const pattern of Object.keys(routes)) {
    const regex = new RegExp('^' + pattern.replace(/:([^/]+)/g, '([^/]+)') + '$');
    const match = path.match(regex);
    if (match) {
      const keys = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1]);
      const params = {};
      keys.forEach((k, i) => { params[k] = match[i + 1]; });
      return { handler: routes[pattern], params };
    }
  }
  return null;
}

async function navigate() {
  const hash = location.hash || '#/';
  const view = qs('#app-view');
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  closeSidebar();

  // Update sidebar active
  qsa('#sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
  const route = parseRoute(hash);

  // Admin layout switch
  const isAdmin = hash.startsWith('#/admin');
  const appShell = qs('#app-shell');
  const sidebar = qs('#sidebar');
  const sidebarOverlay = qs('#sidebar-overlay');
  const adminWrap = qs('#admin-wrap');

  if (isAdmin) {
    if (appShell) appShell.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (sidebarOverlay) sidebarOverlay.style.display = 'none';
    if (adminWrap) adminWrap.style.display = 'flex';
    if (!currentUser || !currentUser.is_admin) {
      adminWrap.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-3)">Bạn không có quyền truy cập Admin Panel.<br><a href="#/" style="color:var(--primary)">Quay về trang chủ</a></div>';
      return;
    }
    renderAdminShell(adminWrap);
  } else {
    if (appShell) appShell.style.display = '';
    if (sidebar) sidebar.style.display = '';
    if (sidebarOverlay) sidebarOverlay.style.display = '';
    if (adminWrap) adminWrap.style.display = 'none';
  }

  if (!route) {
    view.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div><h3>Không tìm thấy trang</h3><a href="#/" class="btn btn-primary mt-12">Về trang chủ</a></div>';
    return;
  }

  try { await route.handler(view, route.params); }
  catch (e) { view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>Lỗi tải trang</h3><p class="text-muted">${e.message}</p></div>`; }
}

// ── Sidebar ─────────────────────────────────────────────────────
async function loadSidebar() {
  const nav = qs('#sidebar-nav');
  if (!nav) return;
  try {
    categories = await apiFetch('/categories/');
    nav.innerHTML = '<div class="sidebar-section">Danh mục</div>';
    const allItem = el('a', 'nav-item' + (location.hash === '#/' || !location.hash ? ' active' : ''));
    allItem.href = '#/';
    allItem.innerHTML = '<div class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div><span>Tất cả</span>';
    nav.appendChild(allItem);
    categories.forEach(cat => {
      const item = el('a', 'nav-item');
      item.href = `#/category/${cat.slug}`;
      const icon = cat.icon_url ? `<img src="${cat.icon_url}" alt="" style="width:18px;height:18px;object-fit:contain" />` : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
      item.innerHTML = `<div class="nav-icon">${icon}</div><span>${cat.name}</span>`;
      nav.appendChild(item);
    });
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  STOREFRONT PAGES
// ═══════════════════════════════════════════════════════════════

async function renderHome(view) {
  view.innerHTML = '';

  // ── Banner Slider ────────────────────────────────────────
  let banners = [];
  try { banners = await apiFetch('/banners/'); } catch (_) {}
  const heroBanners = banners.filter(b => b.banner_type === 'hero');
  const catBanners = banners.filter(b => b.banner_type === 'category');

  if (heroBanners.length) {
    const slider = el('div', 'banner-slider');
    const track = el('div', 'banner-track');
    heroBanners.forEach((b, i) => {
      const slide = el('div', `banner-slide${i === 0 ? ' active' : ''}`);
      const inner = b.link
        ? `<a href="${b.link}"><img src="${b.image_url}" alt="${b.title}" /></a>`
        : `<img src="${b.image_url}" alt="${b.title}" />`;
      slide.innerHTML = inner;
      track.appendChild(slide);
    });
    slider.appendChild(track);

    if (heroBanners.length > 1) {
      const dots = el('div', 'banner-dots');
      heroBanners.forEach((_, i) => {
        const dot = el('button', `banner-dot${i === 0 ? ' active' : ''}`);
        dot.dataset.idx = i;
        dots.appendChild(dot);
      });
      slider.appendChild(dots);

      // Nav arrows
      slider.innerHTML += `<button class="banner-arrow banner-prev" aria-label="Previous">‹</button><button class="banner-arrow banner-next" aria-label="Next">›</button>`;

      // Slider logic
      let cur = 0;
      const total = heroBanners.length;
      const go = (n) => {
        cur = ((n % total) + total) % total;
        slider.querySelectorAll('.banner-slide').forEach((s, i) => s.classList.toggle('active', i === cur));
        slider.querySelectorAll('.banner-dot').forEach((d, i) => d.classList.toggle('active', i === cur));
      };
      slider.querySelector('.banner-prev').onclick = () => go(cur - 1);
      slider.querySelector('.banner-next').onclick = () => go(cur + 1);
      dots.onclick = e => { if (e.target.classList.contains('banner-dot')) go(+e.target.dataset.idx); };
      // Auto-rotate
      let autoTimer = setInterval(() => go(cur + 1), 5000);
      slider.onmouseenter = () => clearInterval(autoTimer);
      slider.onmouseleave = () => { autoTimer = setInterval(() => go(cur + 1), 5000); };
    }
    view.appendChild(slider);
  }

  // ── Category Banners Grid ────────────────────────────────
  if (catBanners.length) {
    const grid = el('div', 'banner-grid');
    catBanners.forEach(b => {
      const card = el('div', 'banner-card');
      const inner = b.link
        ? `<a href="${b.link}"><img src="${b.image_url}" alt="${b.title}" /></a>`
        : `<img src="${b.image_url}" alt="${b.title}" />`;
      card.innerHTML = inner;
      grid.appendChild(card);
    });
    view.appendChild(grid);
  }

  // ── Fallback hero if no banners ──────────────────────────
  if (!heroBanners.length && !catBanners.length) {
    const hero = el('div', 'hero');
    hero.innerHTML = `
      <h1>Mua sản phẩm số<br>uy tín, giá tốt</h1>
      <p>Tài khoản, key, gift card, phần mềm và hàng trăm sản phẩm số chất lượng cao</p>
      <div class="hero-tags">
        <span class="hero-tag">${ico.zap} Giao hàng tự động</span>
        <span class="hero-tag">${ico.shield} An toàn & uy tín</span>
        <span class="hero-tag">${ico.card} Thanh toán nhanh</span>
      </div>
    `;
    view.appendChild(hero);
  }

  // ── Category Tabs + Subcategory Grid ──────────────────────
  if (categories.length) {
    const catSection = el('div', 'cat-section');

    // Parent category pills
    const pills = el('div', 'cat-pills');
    const allPill = el('button', 'cat-pill active', `${ico.grid} <span>Tất cả</span>`);
    allPill.dataset.slug = '';
    pills.appendChild(allPill);
    categories.forEach(cat => {
      const pill = el('button', 'cat-pill');
      const iconHtml = cat.icon_url ? `<img src="${cat.icon_url}" alt="" />` : ico.box;
      pill.innerHTML = `${iconHtml} <span>${cat.name}</span>`;
      pill.dataset.slug = cat.slug;
      pills.appendChild(pill);
    });
    catSection.appendChild(pills);

    // Subcategory cards container
    const subGrid = el('div', 'subcat-wrap');
    catSection.appendChild(subGrid);

    // Render subcategories for selected parent
    const renderSubcats = (parentSlug) => {
      subGrid.innerHTML = '';
      let children = [];
      if (!parentSlug) {
        // "Tất cả" — show all children from all parents
        categories.forEach(c => { if (c.children?.length) children.push(...c.children); });
      } else {
        const parent = categories.find(c => c.slug === parentSlug);
        if (parent?.children?.length) children = parent.children;
      }
      if (children.length) {
        const grid = el('div', 'subcat-grid');
        children.forEach(sub => {
          const card = el('div', 'subcat-card');
          const iconHtml = sub.icon_url
            ? `<img src="${sub.icon_url}" alt="${sub.name}" />`
            : `<div class="subcat-icon">${ico.box}</div>`;
          card.innerHTML = `${iconHtml}<span class="subcat-name">${sub.name}</span>`;
          card.onclick = () => { location.hash = `/category/${sub.slug}`; };
          grid.appendChild(card);
        });
        subGrid.appendChild(grid);
      }
    };

    // Pill click handler
    pills.addEventListener('click', (e) => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;
      qsa('.cat-pill', pills).forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderSubcats(pill.dataset.slug);
    });

    // Initial render — show all
    renderSubcats('');
    view.appendChild(catSection);
  }

  // ── Flash Sale ───────────────────────────────────────────
  try {
    const flashSales = await apiFetch('/flash-sales/active');
    if (flashSales.length) {
      const section = el('div', 'flash-sale-section');
      section.innerHTML = `<div class="section-title">${ico.zap} Flash Sale</div>`;
      const row = el('div', 'flash-sale-row');
      flashSales.forEach(fs => {
        const card = el('div', 'flash-card');
        const discount = fs.original_price ? Math.round((1 - fs.sale_price / fs.original_price) * 100) : 0;
        const sold = fs.sold_count || 0;
        const total = fs.quantity_limit || 0;
        const progressPct = total > 0 ? Math.min((sold / total) * 100, 100) : 0;
        const endMs = new Date(fs.ends_at).getTime();
        const cardHtml = `
          ${fs.product_image ? `<img class="flash-card-img" src="${fs.product_image}" alt="${fs.product_name || ''}" />` : '<div class="flash-card-img flash-card-img-ph">' + ico.box + '</div>'}
          <div class="flash-card-body">
            <div class="flash-card-name">${fs.product_name || 'Sản phẩm'}</div>
            <div class="flash-card-prices">
              <span class="flash-price-sale">${fmt(fs.sale_price)}</span>
              ${fs.original_price ? `<span class="flash-price-original">${fmt(fs.original_price)}</span>` : ''}
            </div>
            ${discount ? `<span class="flash-badge">-${discount}%</span>` : ''}
            <div class="flash-countdown" data-end="${fs.ends_at}">--:--:--</div>
            ${total > 0 ? `<div class="flash-progress"><div class="flash-progress-bar" style="width:${progressPct}%"></div></div><div class="flash-progress-text">Đã bán ${sold}/${total}</div>` : ''}
          </div>
        `;
        card.innerHTML = cardHtml;
        card.onclick = () => { if (fs.product_slug) location.hash = `/product/${fs.product_slug}`; };
        row.appendChild(card);
      });
      section.appendChild(row);
      view.appendChild(section);

      // Countdown timers
      const updateCountdowns = () => {
        qsa('.flash-countdown', section).forEach(el => {
          const end = new Date(el.dataset.end).getTime();
          const diff = end - Date.now();
          if (diff <= 0) { el.textContent = 'Hết hạn'; return; }
          const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
          const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
          const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
          el.textContent = `${h}:${m}:${s}`;
        });
      };
      updateCountdowns();
      const cdInterval = setInterval(updateCountdowns, 1000);
      // Clean up interval when navigating away
      const origClear = view._clearFlashInterval;
      if (!origClear) {
        const observer = new MutationObserver(() => {
          if (!document.contains(view)) { clearInterval(cdInterval); observer.disconnect(); }
        });
        observer.observe(view.parentNode, { childList: true });
      }
    }
  } catch (_) {}

  // ── Featured Products ────────────────────────────────────
  view.appendChild(el('div', 'section-title', `${ico.star} Sản phẩm nổi bật`));
  try {
    const data = await apiFetch('/products/featured?limit=12');
    if (!data.length) {
      view.appendChild(el('div', 'empty-state', `<div class="empty-state-icon">${ico.inbox}</div><h3>Chưa có sản phẩm nổi bật</h3>`));
    } else {
      const grid = el('div', 'product-grid');
      data.forEach(p => grid.appendChild(productCard(p)));
      view.appendChild(grid);
    }
  } catch (_) { view.appendChild(el('p', 'text-muted', 'Không thể tải sản phẩm.')); }
}

async function renderCategory(view, { slug }) {
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const [cat, data] = await Promise.all([apiFetch(`/categories/${slug}`), apiFetch(`/products/?category_slug=${slug}&limit=40`)]);
    view.innerHTML = '';
    view.appendChild(el('div', 'page-header', `<div class="page-title">${cat.name}</div><div class="page-subtitle">${data.total} sản phẩm</div>`));
    if (!data.items.length) {
      view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><h3>Danh mục này chưa có sản phẩm</h3>'));
    } else {
      const grid = el('div', 'product-grid');
      data.items.forEach(p => grid.appendChild(productCard(p)));
      view.appendChild(grid);
    }
  } catch (e) { view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`; }
}

async function renderSearch(view) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const q = params.get('q') || '';

  view.innerHTML = '';
  view.appendChild(el('div', 'breadcrumb mb-16', `<a href="#/">Trang chủ</a> <span>›</span> <strong>Tìm kiếm</strong>`));

  // Search input at top
  const searchBox = el('div', 'search-page-box');
  searchBox.innerHTML = `
    <div class="search-page-input-wrap">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" class="form-input" id="search-page-input" placeholder="Tìm sản phẩm, bài viết..." value="${q}" />
    </div>
  `;
  view.appendChild(searchBox);

  const doSearch = () => {
    const val = (qs('#search-page-input')?.value || '').trim();
    if (val) location.hash = `/search?q=${encodeURIComponent(val)}`;
  };
  qs('#search-page-input', searchBox)?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

  if (!q) {
    view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div><h3>Nhập từ khóa để tìm kiếm</h3>'));
    return;
  }

  view.appendChild(el('div', 'page-loading', '<div class="spinner"></div>'));

  try {
    const data = await apiFetch(`/search/?q=${encodeURIComponent(q)}`);
    view.innerHTML = '';
    view.appendChild(el('div', 'breadcrumb mb-16', `<a href="#/">Trang chủ</a> <span>›</span> <strong>Tìm kiếm: ${q}</strong>`));

    // Re-add search box
    const sb2 = el('div', 'search-page-box');
    sb2.innerHTML = `
      <div class="search-page-input-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" class="form-input" id="search-page-input" placeholder="Tìm sản phẩm, bài viết..." value="${q}" />
      </div>
    `;
    view.appendChild(sb2);
    qs('#search-page-input', sb2)?.addEventListener('keypress', e => {
      if (e.key === 'Enter') { const val = e.target.value.trim(); if (val) location.hash = `/search?q=${encodeURIComponent(val)}`; }
    });

    const products = data.products || [];
    const blog = data.blog || [];

    if (!products.length && !blog.length) {
      view.appendChild(el('div', 'empty-state', `<div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div><h3>Không tìm thấy kết quả cho "${q}"</h3>`));
      return;
    }

    // Products section
    if (products.length) {
      view.appendChild(el('div', 'search-section-title', `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Sản phẩm <span class="search-count">${products.length}</span>`));
      const grid = el('div', 'product-grid');
      products.forEach(p => grid.appendChild(productCard(p)));
      view.appendChild(grid);
    }

    // Blog section
    if (blog.length) {
      view.appendChild(el('div', 'search-section-title', `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Bài viết <span class="search-count">${blog.length}</span>`));
      const blogGrid = el('div', 'blog-grid');
      blog.forEach(post => {
        const card = el('div', 'blog-card');
        card.innerHTML = `
          ${post.thumbnail_url ? `<div class="blog-card-img"><img src="${post.thumbnail_url}" alt="${post.title}" loading="lazy" /></div>` : ''}
          <div class="blog-card-body">
            ${post.category_name ? `<span class="badge badge-blue mb-4">${post.category_name}</span>` : ''}
            <div class="blog-card-title">${post.title}</div>
            ${post.excerpt ? `<div class="blog-card-excerpt">${post.excerpt}</div>` : ''}
            <div class="blog-card-meta">${fmtDate(post.published_at || post.created_at)}</div>
          </div>
        `;
        card.onclick = () => { location.hash = `/blog/${post.slug}`; };
        blogGrid.appendChild(card);
      });
      view.appendChild(blogGrid);
    }
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`;
  }
}

async function renderAllProducts(view) {
  view.innerHTML = '';

  // Parse URL params
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const initQ = params.get('q') || '';
  const initCat = params.get('cat') || '';
  const initSub = params.get('sub') || '';

  // Hero header
  const heroHead = el('div', 'products-hero');
  heroHead.innerHTML = `
    <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <strong>Sản phẩm</strong></div>
    <h1 class="products-hero-title">${ico.shield} Tất cả sản phẩm</h1>
    <p class="products-hero-desc">Khám phá bộ sưu tập sản phẩm chất lượng cao được chọn lọc dành riêng cho bạn</p>
  `;
  view.appendChild(heroHead);

  // Filter card
  const filterCard = el('div', 'filter-card');
  // Build parent category options
  let catOptions = '<option value="">Tất cả</option>';
  categories.forEach(c => { catOptions += `<option value="${c.slug}" ${c.slug === initCat ? 'selected' : ''}>${c.name}</option>`; });

  // Build subcategory options (dynamic)
  let subOptions = '<option value="">Tất cả</option>';
  if (initCat) {
    const parent = categories.find(c => c.slug === initCat);
    if (parent?.children?.length) {
      parent.children.forEach(s => { subOptions += `<option value="${s.slug}" ${s.slug === initSub ? 'selected' : ''}>${s.name}</option>`; });
    }
  }

  filterCard.innerHTML = `
    <div class="filter-row">
      <div class="filter-group">
        <label class="filter-label">DANH MỤC</label>
        <select class="form-select" id="f-category">${catOptions}</select>
      </div>
      <div class="filter-group">
        <label class="filter-label">THỂ LOẠI</label>
        <select class="form-select" id="f-subcategory">${subOptions}</select>
      </div>
    </div>
    <div class="filter-row">
      <div class="filter-group">
        <label class="filter-label">MỨC GIÁ</label>
        <div class="filter-price-range">
          <input type="number" class="form-input" id="f-price-min" placeholder="Mức giá từ" />
          <span class="filter-price-sep">–</span>
          <input type="number" class="form-input" id="f-price-max" placeholder="Mức giá đến" />
        </div>
      </div>
    </div>
    <div class="filter-row">
      <div class="filter-group">
        <label class="filter-label">TÌM KIẾM</label>
        <input type="text" class="form-input" id="f-search" placeholder="Tên sản phẩm..." value="${initQ}" />
      </div>
      <div class="filter-group">
        <label class="filter-label">SẮP XẾP</label>
        <select class="form-select" id="f-sort">
          <option value="">Mặc định</option>
          <option value="price_asc">Giá thấp → cao</option>
          <option value="price_desc">Giá cao → thấp</option>
          <option value="newest">Mới nhất</option>
          <option value="name">Tên A → Z</option>
        </select>
      </div>
    </div>
    <div class="filter-actions">
      <button class="btn btn-primary" id="f-apply">${ico.shield} Lọc</button>
      <button class="btn btn-ghost" id="f-reset">${ico.arrowLeft} Đặt lại</button>
    </div>
  `;
  view.appendChild(filterCard);

  // Results area
  const resultsInfo = el('div', 'results-info');
  const resultsGrid = el('div', 'product-grid');
  const pagination = el('div', 'pagination');
  view.appendChild(resultsInfo);
  view.appendChild(resultsGrid);
  view.appendChild(pagination);

  let currentPage = 1;

  // Dynamic subcategory update when parent changes
  qs('#f-category', filterCard).addEventListener('change', () => {
    const slug = qs('#f-category', filterCard).value;
    const subEl = qs('#f-subcategory', filterCard);
    let opts = '<option value="">Tất cả</option>';
    if (slug) {
      const parent = categories.find(c => c.slug === slug);
      if (parent?.children?.length) {
        parent.children.forEach(s => { opts += `<option value="${s.slug}">${s.name}</option>`; });
      }
    }
    subEl.innerHTML = opts;
  });

  // Fetch & render
  const doFilter = async (page = 1) => {
    currentPage = page;
    const catSlug = qs('#f-category', filterCard).value;
    const subSlug = qs('#f-subcategory', filterCard).value;
    const search = qs('#f-search', filterCard).value.trim();
    const priceMin = qs('#f-price-min', filterCard).value;
    const priceMax = qs('#f-price-max', filterCard).value;
    const sortBy = qs('#f-sort', filterCard).value;

    let qs_parts = [`page=${page}`, `limit=20`];
    const filterSlug = subSlug || catSlug;
    if (filterSlug) qs_parts.push(`category_slug=${encodeURIComponent(filterSlug)}`);
    if (search) qs_parts.push(`search=${encodeURIComponent(search)}`);
    if (priceMin) qs_parts.push(`price_min=${priceMin}`);
    if (priceMax) qs_parts.push(`price_max=${priceMax}`);
    if (sortBy) qs_parts.push(`sort_by=${sortBy}`);

    resultsGrid.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    resultsInfo.innerHTML = '';
    pagination.innerHTML = '';

    try {
      const data = await apiFetch(`/products/?${qs_parts.join('&')}`);
      resultsInfo.innerHTML = `<span class="results-count"><strong>${data.total}</strong> sản phẩm</span>`;
      resultsGrid.innerHTML = '';
      if (!data.items.length) {
        resultsGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${ico.inbox}<h3>Không tìm thấy sản phẩm</h3></div>`;
      } else {
        data.items.forEach(p => resultsGrid.appendChild(productCard(p)));
      }
      // Pagination
      const totalPages = Math.ceil(data.total / data.limit);
      if (totalPages > 1) {
        let pHtml = '';
        for (let i = 1; i <= totalPages; i++) {
          pHtml += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        pagination.innerHTML = pHtml;
        qsa('.page-btn', pagination).forEach(btn => {
          btn.onclick = () => doFilter(+btn.dataset.page);
        });
      }
    } catch (e) {
      resultsGrid.innerHTML = `<p class="text-muted">${e.message}</p>`;
    }
  };

  qs('#f-apply', filterCard).onclick = () => doFilter(1);
  qs('#f-reset', filterCard).onclick = () => {
    qs('#f-category', filterCard).value = '';
    qs('#f-subcategory', filterCard).innerHTML = '<option value="">Tất cả</option>';
    qs('#f-search', filterCard).value = '';
    qs('#f-price-min', filterCard).value = '';
    qs('#f-price-max', filterCard).value = '';
    qs('#f-sort', filterCard).value = '';
    doFilter(1);
  };
  // Enter key in search
  qs('#f-search', filterCard).addEventListener('keypress', e => { if (e.key === 'Enter') doFilter(1); });

  // Initial load
  await doFilter(1);
}

function productCard(p) {
  const card = el('div', 'product-card');
  const imgHtml = p.image_url
    ? `<img class="product-card-img" src="${p.image_url}" alt="${p.name}" loading="lazy" />`
    : `<div class="product-card-img-placeholder"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>`;
  card.innerHTML = `
    ${imgHtml}
    <div class="product-card-body">
      ${p.category_name ? `<div class="product-card-cat">${p.category_name}</div>` : ''}
      <div class="product-card-name">${p.name}</div>
      <div class="product-card-price">${p.min_price ? 'Từ ' + fmt(p.min_price) : '<span class="price-contact">Liên hệ</span>'}</div>
    </div>
  `;
  card.onclick = () => { location.hash = `/product/${p.slug}`; };
  return card;
}

// PRODUCT DETAIL
async function renderProduct(view, { slug }) {
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const p = await apiFetch(`/products/${slug}`);
    let selectedPkg = p.packages[0] || null;

    const render = () => {
      view.innerHTML = '';
      view.appendChild(el('div', 'breadcrumb mb-16', `<a href="#/">Trang chủ</a> <span>›</span> ${p.category_name ? `<a href="#/category/${p.category_id}">${p.category_name}</a> <span>›</span> ` : ''}${p.name}`));

      const detail = el('div', 'product-detail-grid');
      // Image
      const imgWrap = el('div', 'product-detail-img');
      imgWrap.innerHTML = p.image_url ? `<img src="${p.image_url}" alt="${p.name}" />` : '<div class="product-detail-img-ph"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>';
      // Info
      const info = el('div', 'product-detail-info');
      info.innerHTML = `
        ${p.category_name ? `<div class="product-detail-cat">${p.category_name}</div>` : ''}
        <div class="product-detail-name">${p.name}</div>
        <div class="product-detail-desc">${p.description || ''}</div>
      `;

      if (p.packages.length) {
        const pkgSection = el('div');
        pkgSection.innerHTML = '<div class="fw-600 mb-8">Chọn gói</div>';
        const pkgList = el('div', 'package-list');
        p.packages.forEach(pkg => {
          const item = el('div', 'package-item' + (selectedPkg?.id === pkg.id ? ' selected' : ''));
          const stockInfo = pkg.delivery_type === 'auto'
            ? `<div class="pkg-stock"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${pkg.stock_count} có sẵn</div>`
            : `<div class="pkg-stock manual">Giao thủ công</div>`;
          const fs = pkg.flash_sale;
          const displayPrice = fs ? fs.sale_price : pkg.price;
          const strikePrice = fs ? pkg.price : pkg.original_price;
          const discountPct = (fs && pkg.price > 0) ? Math.round((1 - fs.sale_price / pkg.price) * 100) : 0;
          item.innerHTML = `
            <div><div class="pkg-name">${pkg.name}</div><div class="pkg-desc">${pkg.description || ''}</div>${stockInfo}</div>
            <div style="text-align:right">
              ${fs ? `<div class="pkg-flash-tag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> -${discountPct}%</div>` : ''}
              <div class="pkg-price${fs ? ' pkg-price-flash' : ''}">${fmt(displayPrice)}</div>
              ${strikePrice ? `<div class="pkg-orig">${fmt(strikePrice)}</div>` : ''}
              ${fs && fs.ends_at ? `<div class="pkg-flash-timer" data-end="${fs.ends_at}">⏳ --:--:--</div>` : ''}
            </div>
          `;
          if (fs) item.classList.add('package-item-flash');
          item.onclick = () => { selectedPkg = pkg; qsa('.package-item', pkgList).forEach(e => e.classList.remove('selected')); item.classList.add('selected'); renderFields(); };
          pkgList.appendChild(item);
        });
        pkgSection.appendChild(pkgList);
        info.appendChild(pkgSection);

        // Flash sale countdown in packages
        const updatePkgTimers = () => {
          qsa('.pkg-flash-timer', pkgList).forEach(t => {
            const end = new Date(t.dataset.end).getTime();
            const diff = end - Date.now();
            if (diff <= 0) { t.textContent = 'Hết hạn'; return; }
            const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
            const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
            t.textContent = `⏳ ${h}:${m}:${s}`;
          });
        };
        updatePkgTimers();
        const pkgTimerInterval = setInterval(updatePkgTimers, 1000);
        const timerObs = new MutationObserver(() => {
          if (!document.contains(view)) { clearInterval(pkgTimerInterval); timerObs.disconnect(); }
        });
        timerObs.observe(document.body, { childList: true, subtree: true });

        // Custom fields
        const fieldsWrap = el('div', 'mt-16'); fieldsWrap.id = 'pkg-fields';
        info.appendChild(fieldsWrap);
        const renderFields = () => {
          if (!selectedPkg?.fields?.length) { fieldsWrap.innerHTML = ''; return; }
          fieldsWrap.innerHTML = '<div class="fw-600 mb-8">Thông tin yêu cầu</div>';
          selectedPkg.fields.forEach(f => {
            const fg = el('div', 'form-group');
            fg.innerHTML = `<label class="form-label">${f.field_name}${f.is_required ? '<span class="req">*</span>' : ''}</label>`;
            let input;
            if (f.field_type === 'textarea') { input = el('textarea', 'form-textarea'); }
            else if (f.field_type === 'select') {
              const opts = JSON.parse(f.options || '[]');
              input = el('select', 'form-select');
              opts.forEach(o => { const opt = document.createElement('option'); opt.value = o; opt.textContent = o; input.appendChild(opt); });
            } else { input = el('input', 'form-input'); input.type = f.field_type === 'email' ? 'email' : 'text'; input.placeholder = f.field_name; }
            input.dataset.field = f.field_name; input.required = f.is_required;
            fg.appendChild(input); fieldsWrap.appendChild(fg);
          });
        };
        renderFields();

        // Buttons
        const collectFields = () => {
          const fieldVals = {}; let valid = true;
          qsa('[data-field]', fieldsWrap).forEach(inp => {
            if (inp.required && !inp.value.trim()) { valid = false; toast(`Vui lòng nhập ${inp.dataset.field}`, 'error'); }
            else fieldVals[inp.dataset.field] = inp.value.trim();
          });
          return valid ? fieldVals : null;
        };
        const addBtn = el('button', 'btn btn-primary btn-lg btn-full mt-16', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Thêm vào giỏ hàng');
        addBtn.onclick = () => { if (!selectedPkg) return toast('Chọn gói', 'error'); if (selectedPkg.delivery_type === 'auto' && selectedPkg.stock_count < 1) return toast('Hết hàng', 'error'); const f = collectFields(); if (f) addToCart(p, selectedPkg, 1, f); };
        info.appendChild(addBtn);
        const buyBtn = el('button', 'btn btn-outline btn-lg btn-full mt-8', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Mua ngay');
        buyBtn.onclick = () => { if (!selectedPkg) return toast('Chọn gói', 'error'); if (!currentUser) { toast('Đăng nhập để mua', 'error'); return location.hash = '/login'; } const f = collectFields(); if (f) { addToCart(p, selectedPkg, 1, f); location.hash = '/cart'; } };
        info.appendChild(buyBtn);
      } else {
        info.appendChild(el('p', 'text-muted mt-16', 'Hiện chưa có gói sản phẩm.'));
      }

      detail.appendChild(imgWrap);
      detail.appendChild(info);
      view.appendChild(detail);
    };
    render();
  } catch (e) { view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`; }
}

// CART
function renderCart(view) {
  view.innerHTML = '';
  view.appendChild(el('div', 'page-header', '<div class="page-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Giỏ hàng</div>'));
  if (!cart.length) {
    view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div><h3>Giỏ hàng trống</h3><a href="#/" class="btn btn-primary mt-12">Tiếp tục mua sắm</a>'));
    return;
  }
  const grid = el('div', 'cart-layout');
  const itemsCol = el('div', 'cart-items');
  cart.forEach(item => {
    const card = el('div', 'cart-item');
    card.innerHTML = `
      ${item.product_img ? `<div class="cart-item-img"><img src="${item.product_img}" alt="" /></div>` : `<div class="cart-item-img"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>`}
      <div class="cart-item-info">
        <div class="cart-item-name">${item.product_name}</div>
        <div class="cart-item-pkg">Gói: ${item.pkg_name}</div>
        <div class="cart-item-price">${fmt(item.pkg_price)}</div>
      </div>
      <button class="cart-item-remove" data-pkg="${item.pkg_id}" title="Xóa"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    `;
    itemsCol.appendChild(card);
  });
  const summary = el('div', 'cart-summary-card');
  summary.innerHTML = `
    <div class="cart-summary-head"><div class="cart-summary-title">Tóm tắt đơn hàng</div></div>
    <div class="cart-summary-body">
      ${cart.map(i => `<div class="summary-row"><span class="summary-label">${i.pkg_name} x${i.quantity}</span><span class="summary-value">${fmt(i.pkg_price * i.quantity)}</span></div>`).join('')}
      <div class="divider"></div>
      <div class="summary-row"><span class="summary-label fw-700">Tổng cộng</span><span class="summary-total">${fmt(cartTotal())}</span></div>
    </div>
    <div class="cart-summary-footer">
      <button class="btn btn-primary btn-lg btn-full" id="btn-checkout">Thanh toán</button>
      <a href="#/" class="btn btn-ghost btn-full mt-8">Tiếp tục mua sắm</a>
    </div>
  `;
  grid.appendChild(itemsCol); grid.appendChild(summary); view.appendChild(grid);
  itemsCol.addEventListener('click', e => { const btn = e.target.closest('[data-pkg]'); if (btn) { removeFromCart(parseInt(btn.dataset.pkg)); renderCart(view); } });
  qs('#btn-checkout', summary).onclick = () => { if (!currentUser) { toast('Đăng nhập để thanh toán', 'error'); return location.hash = '/login'; } location.hash = '/checkout'; };
}

// CHECKOUT
async function renderCheckout(view) {
  if (!cart.length) return location.hash = '/cart';
  if (!currentUser) { toast('Đăng nhập', 'error'); return location.hash = '/login'; }
  view.innerHTML = '';
  view.appendChild(el('div', 'page-header', '<div class="page-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Thanh toán</div>'));
  const grid = el('div', 'checkout-grid');
  const left = el('div');
  left.innerHTML = `
    <div class="card mb-16"><div class="card-body"><div class="fw-600 mb-6">Tài khoản</div><p class="text-muted text-sm">${currentUser.email}</p></div></div>
    <div class="card mb-16"><div class="card-body">
      <div class="fw-600 mb-12">Sản phẩm</div>
      ${cart.map(i => `<div class="summary-row"><span class="summary-label">${i.product_name} — ${i.pkg_name} x${i.quantity}</span><span class="summary-value text-primary">${fmt(i.pkg_price * i.quantity)}</span></div>`).join('')}
      <div class="divider"></div>
      <div class="summary-row"><span class="fw-700">Tổng</span><span class="fw-700 text-primary">${fmt(cartTotal())}</span></div>
    </div></div>
    <div class="card"><div class="card-body">
      <div class="fw-600 mb-12">Phương thức thanh toán</div>
      <div class="payment-option selected">
        <div class="payment-option-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg></div>
        <div><div class="payment-option-name">PayOS — Chuyển khoản</div><div class="payment-option-desc">QR code, tất cả ngân hàng VN</div></div>
      </div>
      <button class="btn btn-primary btn-lg btn-full mt-16" id="btn-pay">Tạo đơn & Thanh toán</button>
    </div></div>
  `;
  const right = el('div', 'cart-summary-card');
  right.innerHTML = `
    <div class="cart-summary-head"><div class="cart-summary-title">Đơn hàng</div></div>
    <div class="cart-summary-body">
      ${cart.map(i => `<div class="summary-row"><span class="summary-label text-sm">${i.pkg_name}</span><span class="summary-value">${fmt(i.pkg_price)}</span></div>`).join('')}
      <div class="divider"></div>
      <div class="summary-row"><span class="summary-label fw-700">Tổng</span><span class="summary-total">${fmt(cartTotal())}</span></div>
      <p class="text-xs text-muted mt-12">Giao ngay sau khi thanh toán (nếu tự động).</p>
    </div>
  `;
  grid.appendChild(left); grid.appendChild(right); view.appendChild(grid);

  qs('#btn-pay', left).onclick = async () => {
    const btn = qs('#btn-pay', left); btn.disabled = true; btn.textContent = 'Đang xử lý...';
    try {
      const item = cart[0];
      const order = await apiFetch('/orders/create', { method: 'POST', body: JSON.stringify({ package_id: item.pkg_id, quantity: item.quantity, custom_fields_data: item.fields || {} }) });
      const link = await apiFetch('/payment/create-link', { method: 'POST', body: JSON.stringify({ order_code: order.order_code }) });
      cart = []; saveCart();
      window.open(link.payment_url, '_blank');
      toast('Đã tạo đơn! Chuyển đến thanh toán...', 'success', 5000);
      location.hash = `/orders/${order.order_code}`;
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Tạo đơn & Thanh toán'; }
  };
}

// ORDERS
async function renderOrders(view) {
  if (!currentUser) return location.hash = '/login';
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const data = await apiFetch('/orders/my');
    view.innerHTML = '';
    view.appendChild(el('div', 'page-header', `<div class="page-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Đơn hàng của tôi</div><div class="page-subtitle">${data.total} đơn</div>`));
    if (!data.items.length) { view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h3>Chưa có đơn hàng</h3><a href="#/" class="btn btn-primary mt-12">Mua sắm ngay</a>')); return; }
    data.items.forEach(o => {
      const card = el('div', 'order-card');
      card.innerHTML = `
        <div class="order-card-top">
          <div><div class="order-code">${o.order_code}</div><div class="order-date">${fmtDate(o.created_at)}</div></div>
          <div class="flex gap-8 items-center">${statusBadge(o.status)}<a href="#/orders/${o.order_code}" class="btn btn-ghost btn-sm">Chi tiết</a></div>
        </div>
        <div class="text-sm">${o.product_name || ''} — <span class="text-muted">${o.package_name || ''}</span></div>
        <div class="fw-700 text-primary mt-8">${fmt(o.total_amount)}</div>
        ${o.status === 'completed' && o.delivery_data ? `<div class="delivery-box"><div class="delivery-box-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Dữ liệu nhận hàng</div><div class="delivery-data">${o.delivery_data}</div><button class="btn-copy" onclick="navigator.clipboard.writeText(\`${o.delivery_data}\`).then(()=>toast('Đã sao chép','success'))"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button></div>` : ''}
      `;
      view.appendChild(card);
    });
  } catch (e) { view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`; }
}

// ORDER DETAIL
async function renderOrderDetail(view, { code }) {
  if (!currentUser) return location.hash = '/login';
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    await apiFetch(`/payment/status/${code}`).catch(() => null);
    const d = await apiFetch(`/orders/my/${code}`);
    view.innerHTML = '';
    view.appendChild(el('div', 'page-header', `<div class="page-title">Chi tiết đơn hàng</div><a href="#/orders" class="btn btn-ghost btn-sm">${ico.arrowLeft} Quay lại</a>`));
    const card = el('div', 'order-card');
    card.innerHTML = `
      <div class="order-card-top"><div class="order-code">${d.order_code}</div>${statusBadge(d.status)}</div>
      <div class="order-meta">
        <div class="order-meta-item"><div class="order-meta-label">Sản phẩm</div><div class="order-meta-value">${d.product_name || '—'}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Gói</div><div class="order-meta-value">${d.package_name || '—'}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Số lượng</div><div class="order-meta-value">${d.quantity}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Tổng tiền</div><div class="order-meta-value text-primary">${fmt(d.total_amount)}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Thanh toán</div><div class="order-meta-value">${d.payment_method?.toUpperCase() || '—'}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Ngày tạo</div><div class="order-meta-value">${fmtDate(d.created_at)}</div></div>
      </div>
      ${d.status === 'completed' && d.delivery_data ? `<div class="delivery-box"><div class="delivery-box-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Dữ liệu nhận hàng</div><div class="delivery-data">${d.delivery_data}</div><button class="btn-copy" onclick="navigator.clipboard.writeText(\`${d.delivery_data}\`).then(()=>toast('Đã sao chép','success'))"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button></div>` : ''}
      ${d.status === 'pending' ? `<div class="card mt-12 p-16" style="border-color:var(--yellow);background:var(--yellow-light)"><p class="text-sm" style="color:var(--yellow)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Đang chờ thanh toán. Trạng thái sẽ tự cập nhật.</p><button class="btn btn-sm btn-ghost mt-8" id="btn-check-status"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Kiểm tra lại</button></div>` : ''}
    `;
    view.appendChild(card);
    qs('#btn-check-status', card)?.addEventListener('click', () => renderOrderDetail(view, { code }));
  } catch (e) { view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`; }
}

// LOGIN
let _authConfig = null;
async function getAuthConfig() {
  if (_authConfig) return _authConfig;
  _authConfig = await apiFetch('/auth/config').catch(() => ({}));
  return _authConfig;
}

function renderLogin(view) {
  if (currentUser) return location.hash = '/';
  view.innerHTML = '';
  const page = el('div', 'auth-page');
  page.innerHTML = `
    <div class="auth-card">
      <div class="auth-card-header">
        <div class="auth-logo-mark">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
        </div>
        <h1 class="auth-title">Đăng nhập</h1>
        <p class="auth-subtitle">Chào mừng trở lại! Nhập thông tin để tiếp tục.</p>
      </div>
      <form id="login-form" class="auth-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <div class="input-icon-wrap">
            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <input type="email" class="form-input has-icon" id="login-email" placeholder="email@example.com" required autocomplete="email" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Mật khẩu</label>
          <div class="input-icon-wrap">
            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input type="password" class="form-input has-icon" id="login-pwd" placeholder="••••••••" required autocomplete="current-password" />
          </div>
        </div>
        <div id="login-error" class="auth-error" style="display:none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span id="login-error-text"></span>
        </div>
        <button type="submit" class="btn btn-primary btn-full btn-lg auth-submit">
          <span class="auth-submit-text">Đăng nhập</span>
          <svg class="auth-submit-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </form>
      <div class="auth-divider"><span>hoặc</span></div>
      <div id="social-buttons" class="social-buttons"></div>
      <div class="auth-footer">
        Chưa có tài khoản? <a href="#/register" class="auth-link">Tạo tài khoản mới →</a>
      </div>
    </div>
  `;
  view.appendChild(page);

  // Social buttons
  getAuthConfig().then(cfg => {
    const wrap = qs('#social-buttons', page);
    if (!wrap) return;
    let html = '';
    if (cfg.google_enabled) html += `<a href="/api/auth/google" class="btn-social btn-social-google"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Google</a>`;
    if (cfg.discord_enabled) html += `<a href="/api/auth/discord" class="btn-social btn-social-discord"><svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg> Discord</a>`;
    if (!html) html = '';
    wrap.innerHTML = html;
  });

  qs('#login-form', page).onsubmit = async (e) => {
    e.preventDefault();
    const btn = qs('.auth-submit', page);
    const errEl = qs('#login-error', page);
    const errText = qs('#login-error-text', page);
    btn.disabled = true;
    btn.querySelector('.auth-submit-text').textContent = 'Đang đăng nhập...';
    btn.classList.add('loading');
    errEl.style.display = 'none';
    try {
      const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: qs('#login-email', page).value, password: qs('#login-pwd', page).value }) });
      if (!data.token) throw new Error('Đăng nhập thất bại');
      saveToken(data.token); await fetchMe(); updateAuthUI();
      toast('Đăng nhập thành công!', 'success'); location.hash = '/';
    } catch (err) {
      errText.textContent = err.message || 'Email hoặc mật khẩu không đúng';
      errEl.style.display = 'flex';
    } finally {
      btn.disabled = false;
      btn.querySelector('.auth-submit-text').textContent = 'Đăng nhập';
      btn.classList.remove('loading');
    }
  };
}


function renderRegister(view) {
  if (currentUser) { location.hash = '/'; return; }
  view.innerHTML = '';
  const page = el('div', 'auth-page');
  page.innerHTML = `
    <div class="auth-card">
      <div class="auth-card-header">
        <div class="auth-logo-mark">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </div>
        <h1 class="auth-title">Tạo tài khoản</h1>
        <p class="auth-subtitle">Đăng ký miễn phí, chỉ mất 30 giây.</p>
      </div>
      <form id="register-form" class="auth-form">
        <div class="form-group">
          <label class="form-label" for="reg-name">Tên hiển thị</label>
          <div class="input-icon-wrap">
            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <input type="text" class="form-input has-icon" id="reg-name" placeholder="Tên của bạn" autocomplete="name" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-email">Email</label>
          <div class="input-icon-wrap">
            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <input type="email" class="form-input has-icon" id="reg-email" placeholder="you@example.com" required autocomplete="email" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-pwd">Mật khẩu</label>
          <div class="input-icon-wrap">
            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input type="password" class="form-input has-icon" id="reg-pwd" placeholder="Tối thiểu 8 ký tự" minlength="8" required autocomplete="new-password" />
          </div>
          <div class="form-hint">Ít nhất 8 ký tự</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="reg-pwd2">Xác nhận mật khẩu</label>
          <div class="input-icon-wrap">
            <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <input type="password" class="form-input has-icon" id="reg-pwd2" placeholder="Nhập lại mật khẩu" required autocomplete="new-password" />
          </div>
        </div>
        <div id="reg-error" class="auth-error" style="display:none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span id="reg-error-text"></span>
        </div>
        <button type="submit" class="btn btn-primary btn-full btn-lg auth-submit">
          <span class="btn-label">Tạo tài khoản</span>
          <svg class="btn-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="40" stroke-dashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite"/></circle></svg>
        </button>
      </form>
      <div class="auth-divider"><span>hoặc</span></div>
      <div id="social-buttons-reg" class="social-buttons"></div>
      <div class="auth-footer">
        Đã có tài khoản? <a href="#/login" class="auth-link">Đăng nhập →</a>
      </div>
    </div>
  `;
  view.appendChild(page);

  // Social buttons
  getAuthConfig().then(cfg => {
    const wrap = qs('#social-buttons-reg', page);
    if (!wrap) return;
    let html = '';
    if (cfg.google_enabled) html += `<a href="/api/auth/google" class="btn-social btn-social-google"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Google</a>`;
    if (cfg.discord_enabled) html += `<a href="/api/auth/discord" class="btn-social btn-social-discord"><svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg> Discord</a>`;
    wrap.innerHTML = html;
  });

  qs('#register-form', page).onsubmit = async (e) => {
    e.preventDefault();
    const name = qs('#reg-name', page).value;
    const email = qs('#reg-email', page).value;
    const pwd = qs('#reg-pwd', page).value;
    const pwd2 = qs('#reg-pwd2', page).value;
    const errEl = qs('#reg-error', page);
    const errText = qs('#reg-error-text', page);
    const btn = qs('.auth-submit', page);
    errEl.style.display = 'none';
    if (pwd !== pwd2) { errText.textContent = 'Mật khẩu không khớp'; errEl.style.display = 'flex'; return; }
    btn.classList.add('loading');
    btn.disabled = true;
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: pwd, display_name: name })
      });
      if (data.token) { saveToken(data.token); await fetchMe(); updateAuthUI(); toast('Đăng ký thành công!', 'success'); location.hash = '/'; }
      else { toast('Đăng ký thành công! Vui lòng đăng nhập.', 'success'); location.hash = '/login'; }
    } catch (err) { errText.textContent = err.message || 'Đăng ký thất bại'; errEl.style.display = 'flex'; }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  };
}

// Social login callback handler
function renderAuthCallback(view) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const token = params.get('token');
  const error = params.get('error');
  if (error) {
    toast('Đăng nhập thất bại: ' + error, 'error');
    location.hash = '/login';
    return;
  }
  if (token) {
    saveToken(token);
    fetchMe().then(() => { updateAuthUI(); toast('Đăng nhập thành công!', 'success'); location.hash = '/'; });
  } else {
    location.hash = '/login';
  }
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════

function renderAdminShell(wrap) {
  const hash = location.hash;
  const activeSection = hash.replace('#/admin', '') || '';

  // If shell already rendered, just update active nav
  if (wrap.querySelector('.admin-layout')) {
    qsa('.admin-nav-item', wrap).forEach(btn => {
      const href = btn.dataset.href;
      if (!href) return;
      btn.classList.toggle('active', href === hash);
    });
    return;
  }

  wrap.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="sidebar-logo">
          <a href="#/admin">
            <div class="sidebar-logo-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg></div>
            <div class="sidebar-logo-text">Admin <span>Panel</span></div>
          </a>
        </div>
        <nav class="admin-nav">
          <button class="admin-nav-item ${hash === '#/admin' ? 'active' : ''}" data-href="#/admin">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Dashboard</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/categories' ? 'active' : ''}" data-href="#/admin/categories">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <span>Danh mục</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/products' ? 'active' : ''}" data-href="#/admin/products">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span>Sản phẩm</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/orders' ? 'active' : ''}" data-href="#/admin/orders">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>Đơn hàng</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/stock' ? 'active' : ''}" data-href="#/admin/stock">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            <span>Kho hàng</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/settings' ? 'active' : ''}" data-href="#/admin/settings">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Cài đặt</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/banners' ? 'active' : ''}" data-href="#/admin/banners">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>Banners</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/flash-sales' ? 'active' : ''}" data-href="#/admin/flash-sales">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>Flash Sales</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/gift-codes' ? 'active' : ''}" data-href="#/admin/gift-codes">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
            <span>Gift Codes</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/affiliates' ? 'active' : ''}" data-href="#/admin/affiliates">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Affiliates</span>
          </button>
          <button class="admin-nav-item ${activeSection === '/blog' ? 'active' : ''}" data-href="#/admin/blog">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Blog</span>
          </button>
          <div class="divider"></div>
          <button class="admin-nav-item" data-href="#/">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>${ico.arrowLeft} Storefront</span>
          </button>
        </nav>
      </aside>
      <main class="admin-content" id="admin-content"><div class="page-loading"><div class="spinner"></div></div></main>
    </div>
  `;

  qsa('[data-href]', wrap).forEach(btn => { btn.onclick = () => { location.hash = btn.dataset.href; }; });
  // Admin hamburger (mobile)
  qs('#admin-hamburger', wrap)?.addEventListener('click', () => {
    qs('#admin-sidebar', wrap)?.classList.toggle('open');
  });
}

// ADMIN DASHBOARD
async function renderAdmin(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const data = await apiFetch('/admin/dashboard');
    const s = data.stats;
    content.innerHTML = `
      <div class="page-header"><div class="page-title">Dashboard</div></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon purple"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-info"><div class="stat-label">Tổng đơn</div><div class="stat-value">${s.total_orders}</div></div></div>
        <div class="stat-card"><div class="stat-icon yellow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="stat-info"><div class="stat-label">Chờ xử lý</div><div class="stat-value">${s.pending_orders}</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><div class="stat-info"><div class="stat-label">Hoàn thành</div><div class="stat-value">${s.completed_orders}</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div><div class="stat-info"><div class="stat-label">Sản phẩm</div><div class="stat-value">${s.total_products}</div></div></div>
        <div class="stat-card"><div class="stat-icon cyan"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></div><div class="stat-info"><div class="stat-label">Kho hàng</div><div class="stat-value">${s.total_stock_available}</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-info"><div class="stat-label">Doanh thu</div><div class="stat-value">${fmt(s.total_revenue)}</div></div></div>
      </div>
      <div class="card"><div class="card-header"><div class="card-title">Đơn hàng gần đây</div></div>
      <div class="table-wrap" style="border:none;box-shadow:none;border-radius:0">
        <table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead>
        <tbody>${data.recent_orders.map(o => `<tr><td class="td-mono">${o.order_code}</td><td>${o.user_email || '—'}</td><td>${o.product_name || '—'}</td><td class="text-primary">${fmt(o.total_amount)}</td><td>${statusBadge(o.status)}</td><td class="text-sm text-muted">${fmtDate(o.created_at)}</td></tr>`).join('')}</tbody>
        </table></div></div>
    `;
  } catch (e) { content.innerHTML = `<p class="text-muted">${e.message}</p>`; }
}

// ADMIN CATEGORIES
async function renderAdminCategories(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const refresh = async () => {
    const cats = await apiFetch('/categories/all');
    content.innerHTML = `
      <div class="page-header"><div class="page-title">Danh mục</div><button class="btn btn-primary" id="btn-add-cat">+ Thêm</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Tên</th><th>Slug</th><th>Trạng thái</th><th>Thứ tự</th><th></th></tr></thead>
        <tbody>${cats.map(c => `<tr><td class="text-muted">#${c.id}</td><td class="td-bold">${c.name}</td><td class="td-mono">${c.slug}</td><td>${c.is_active ? '<span class="badge badge-green">Hiện</span>' : '<span class="badge badge-gray">Ẩn</span>'}</td><td>${c.sort_order}</td><td><div class="tbl-actions"><button class="tbl-btn tbl-edit" data-edit="${c.id}">Sửa</button><button class="tbl-btn tbl-delete" data-del="${c.id}">Xóa</button></div></td></tr>`).join('')}</tbody>
      </table></div>
    `;
    qs('#btn-add-cat', content).onclick = () => showCatModal(null, refresh);
    qsa('[data-edit]', content).forEach(btn => { btn.onclick = () => showCatModal(cats.find(c => c.id === parseInt(btn.dataset.edit)), refresh); });
    qsa('[data-del]', content).forEach(btn => { btn.onclick = async () => { if (!confirm('Xóa?')) return; await apiFetch(`/categories/${btn.dataset.del}`, { method: 'DELETE' }); toast('Đã xóa', 'success'); refresh(); }; });
  };
  await refresh();
}

function showCatModal(cat, refresh) {
  openModal(`
    <form id="cat-form">
      <div class="form-group"><label class="form-label">Tên<span class="req">*</span></label><input class="form-input" id="cf-name" value="${cat?.name || ''}" required /></div>
      <div class="form-group"><label class="form-label">Slug</label><input class="form-input" id="cf-slug" value="${cat?.slug || ''}" placeholder="tự động" /></div>
      <div class="form-group"><label class="form-label">URL icon</label><input class="form-input" id="cf-icon" value="${cat?.icon_url || ''}" placeholder="https://..." /></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Thứ tự</label><input type="number" class="form-input" id="cf-order" value="${cat?.sort_order ?? 0}" /></div>
        <div class="form-group"><label class="form-label">Hiển thị</label><select class="form-select" id="cf-active"><option value="true" ${cat?.is_active !== false ? 'selected' : ''}>Hiện</option><option value="false" ${cat?.is_active === false ? 'selected' : ''}>Ẩn</option></select></div>
      </div>
      <div id="cat-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">${cat ? 'Cập nhật' : 'Tạo mới'}</button><button type="button" class="btn btn-ghost" id="cat-cancel">Hủy</button></div>
    </form>
  `, cat ? `Sửa: ${cat.name}` : 'Thêm danh mục');
  qs('#cat-cancel').onclick = closeModal;
  qs('#cat-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = { name: qs('#cf-name').value, slug: qs('#cf-slug').value || undefined, icon_url: qs('#cf-icon').value || undefined, sort_order: parseInt(qs('#cf-order').value) || 0, is_active: qs('#cf-active').value === 'true' };
    try { if (cat) await apiFetch(`/categories/${cat.id}`, { method: 'PUT', body: JSON.stringify(body) }); else await apiFetch('/categories/', { method: 'POST', body: JSON.stringify(body) }); closeModal(); toast(cat ? 'Cập nhật!' : 'Tạo mới!', 'success'); refresh(); }
    catch (err) { const e = qs('#cat-form-err'); e.textContent = err.message; e.style.display = 'block'; }
  };
}

// ADMIN PRODUCTS
async function renderAdminProducts(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const refresh = async () => {
    const [products, cats] = await Promise.all([apiFetch('/products/admin/all'), apiFetch('/categories/all')]);
    content.innerHTML = `
      <div class="page-header"><div class="page-title">Sản phẩm</div><button class="btn btn-primary" id="btn-add-prod">+ Thêm</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Tên</th><th>Danh mục</th><th>Gói</th><th>Giá từ</th><th>Nổi bật</th><th>TT</th><th></th></tr></thead>
        <tbody>${products.map(p => `<tr><td class="td-bold">${p.name}</td><td class="text-muted">${p.category_name || '—'}</td><td>${(p.packages||[]).length}</td><td class="text-primary">${p.min_price ? fmt(p.min_price) : '—'}</td><td>${p.is_featured ? ico.starFill : '—'}</td><td>${p.is_active ? '<span class="badge badge-green">Hiện</span>' : '<span class="badge badge-gray">Ẩn</span>'}</td><td><div class="tbl-actions"><button class="tbl-btn tbl-edit" data-edit="${p.id}">Sửa</button><button class="tbl-btn tbl-view" data-pkg="${p.id}" data-pname="${encodeURIComponent(p.name)}">Gói</button><button class="tbl-btn tbl-delete" data-del="${p.id}">Xóa</button></div></td></tr>`).join('')}</tbody>
      </table></div>
    `;
    qs('#btn-add-prod', content).onclick = () => showProductModal(null, cats, refresh);
    qsa('[data-edit]', content).forEach(btn => { btn.onclick = () => showProductModal(products.find(p => p.id === parseInt(btn.dataset.edit)), cats, refresh); });
    qsa('[data-pkg]', content).forEach(btn => { btn.onclick = () => showPackagesModal(parseInt(btn.dataset.pkg), decodeURIComponent(btn.dataset.pname)); });
    qsa('[data-del]', content).forEach(btn => { btn.onclick = async () => { if (!confirm('Xóa?')) return; await apiFetch(`/products/${btn.dataset.del}`, { method: 'DELETE' }); toast('Đã xóa', 'success'); refresh(); }; });
  };
  await refresh();
}

function showProductModal(prod, cats, refresh) {
  openModal(`
    <form id="prod-form">
      <div class="form-group"><label class="form-label">Tên<span class="req">*</span></label><input class="form-input" id="pf-name" value="${prod?.name || ''}" required /></div>
      <div class="form-group"><label class="form-label">Danh mục</label><select class="form-select" id="pf-cat"><option value="">--</option>${cats.map(c => `<option value="${c.id}" ${prod?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Mô tả</label><textarea class="form-textarea" id="pf-desc">${prod?.description || ''}</textarea></div>
      <div class="form-group"><label class="form-label">URL ảnh</label><input class="form-input" id="pf-img" value="${prod?.image_url || ''}" /></div>
      <div class="form-row form-row-3">
        <div class="form-group"><label class="form-label">Thứ tự</label><input type="number" class="form-input" id="pf-order" value="${prod?.sort_order ?? 0}" /></div>
        <div class="form-group"><label class="form-label">Nổi bật</label><select class="form-select" id="pf-featured"><option value="false" ${!prod?.is_featured ? 'selected' : ''}>Không</option><option value="true" ${prod?.is_featured ? 'selected' : ''}>Có</option></select></div>
        <div class="form-group"><label class="form-label">Hiển thị</label><select class="form-select" id="pf-active"><option value="true" ${prod?.is_active !== false ? 'selected' : ''}>Hiện</option><option value="false" ${prod?.is_active === false ? 'selected' : ''}>Ẩn</option></select></div>
      </div>
      <div id="prod-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">${prod ? 'Cập nhật' : 'Tạo mới'}</button><button type="button" class="btn btn-ghost" id="prod-cancel">Hủy</button></div>
    </form>
  `, prod ? `Sửa: ${prod.name}` : 'Thêm sản phẩm');
  qs('#prod-cancel').onclick = closeModal;
  qs('#prod-form').onsubmit = async (e) => {
    e.preventDefault();
    const cat_id = qs('#pf-cat').value;
    const body = { name: qs('#pf-name').value, category_id: cat_id ? parseInt(cat_id) : null, description: qs('#pf-desc').value || null, image_url: qs('#pf-img').value || null, sort_order: parseInt(qs('#pf-order').value) || 0, is_featured: qs('#pf-featured').value === 'true', is_active: qs('#pf-active').value === 'true' };
    try { if (prod) await apiFetch(`/products/${prod.id}`, { method: 'PUT', body: JSON.stringify(body) }); else await apiFetch('/products/', { method: 'POST', body: JSON.stringify(body) }); closeModal(); toast(prod ? 'Cập nhật!' : 'Tạo mới!', 'success'); refresh(); }
    catch (err) { const e = qs('#prod-form-err'); e.textContent = err.message; e.style.display = 'block'; }
  };
}

async function showPackagesModal(productId, productName) {
  const prod = await apiFetch('/products/admin/all').then(ps => ps.find(p => p.id === productId));
  const packages = prod?.packages || [];
  const renderPkgList = () => packages.map(pkg => `
    <div class="package-item mb-8"><div><div class="pkg-name">${pkg.name}</div><div class="pkg-desc">${pkg.delivery_type === 'auto' ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Tự động' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Thủ công'} • Kho: ${pkg.stock_count}</div></div>
    <div style="text-align:right"><div class="pkg-price">${fmt(pkg.price)}</div><button class="tbl-btn tbl-delete mt-4" data-delpkg="${pkg.id}">Xóa</button></div></div>
  `).join('');

  openModal(`
    <div id="pkg-list">${renderPkgList()}</div><div class="divider"></div>
    <div class="fw-600 mb-8">Thêm gói mới</div>
    <form id="pkg-form">
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Tên gói</label><input class="form-input" id="pkg-name" required placeholder="1 tháng, 1 năm..." /></div>
        <div class="form-group"><label class="form-label">Giá (đ)</label><input type="number" class="form-input" id="pkg-price" required placeholder="50000" /></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Giao hàng</label><select class="form-select" id="pkg-delivery"><option value="manual">Thủ công</option><option value="auto">Tự động</option></select></div>
        <div class="form-group"><label class="form-label">Mô tả</label><input class="form-input" id="pkg-desc" placeholder="Mô tả..." /></div>
      </div>
      <button type="submit" class="btn btn-primary">+ Thêm gói</button>
    </form>
  `, `Gói: ${productName}`);

  const modal = qs('#modal-content');
  modal.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delpkg]');
    if (btn) { if (!confirm('Xóa?')) return; await apiFetch(`/products/packages/${btn.dataset.delpkg}`, { method: 'DELETE' }); toast('Đã xóa', 'success'); const idx = packages.findIndex(p => p.id === parseInt(btn.dataset.delpkg)); if (idx >= 0) packages.splice(idx, 1); qs('#pkg-list', modal).innerHTML = renderPkgList(); }
  });
  qs('#pkg-form', modal).onsubmit = async (e) => {
    e.preventDefault();
    const body = { name: qs('#pkg-name', modal).value, price: parseFloat(qs('#pkg-price', modal).value), delivery_type: qs('#pkg-delivery', modal).value, description: qs('#pkg-desc', modal).value || null };
    try { const np = await apiFetch(`/products/${productId}/packages`, { method: 'POST', body: JSON.stringify(body) }); packages.push(np); qs('#pkg-list', modal).innerHTML = renderPkgList(); e.target.reset(); toast('Đã thêm gói', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  };
}

// ADMIN ORDERS
async function renderAdminOrders(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const refresh = async (status = '') => {
    const data = await apiFetch(`/orders/admin/all${status ? '?status=' + status : ''}&limit=50`);
    content.innerHTML = `
      <div class="page-header"><div class="page-title">Đơn hàng</div></div>
      <div class="flex gap-6 mb-16 flex-wrap">${['', 'pending', 'paid', 'processing', 'completed', 'cancelled'].map(s => `<button class="btn btn-sm ${status === s ? 'btn-primary' : 'btn-ghost'}" data-filter="${s}">${s || 'Tất cả'}</button>`).join('')}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Mã đơn</th><th>Khách</th><th>SP</th><th>Tiền</th><th>TT</th><th>Ngày</th><th></th></tr></thead>
        <tbody>${data.items.map(o => `<tr><td class="td-mono">${o.order_code}</td><td class="text-sm">${o.user_email || '—'}</td><td class="text-sm">${o.product_name || '—'}</td><td class="text-primary">${fmt(o.total_amount)}</td><td>${statusBadge(o.status)}</td><td class="text-sm text-muted">${fmtDate(o.created_at)}</td><td><div class="tbl-actions">${o.status !== 'completed' ? `<button class="tbl-btn tbl-success" data-deliver="${o.id}">Giao</button>` : ''}<button class="tbl-btn tbl-view" data-view-order="${o.id}" data-od="${encodeURIComponent(JSON.stringify(o))}">Xem</button></div></td></tr>`).join('')}</tbody>
      </table></div>
    `;
    qsa('[data-filter]', content).forEach(btn => { btn.onclick = () => refresh(btn.dataset.filter); });
    qsa('[data-deliver]', content).forEach(btn => { btn.onclick = () => showDeliverModal(parseInt(btn.dataset.deliver), refresh.bind(null, status)); });
    qsa('[data-view-order]', content).forEach(btn => {
      const o = JSON.parse(decodeURIComponent(btn.dataset.od));
      btn.onclick = () => openModal(`
        <div class="order-meta">${Object.entries({ 'Mã đơn': o.order_code, 'Khách': o.user_email, 'SP': o.product_name, 'Gói': o.package_name, 'Tiền': fmt(o.total_amount), 'TT': o.status, 'Ngày': fmtDate(o.created_at) }).map(([k, v]) => `<div class="order-meta-item"><div class="order-meta-label">${k}</div><div class="order-meta-value">${v || '—'}</div></div>`).join('')}</div>
        ${o.delivery_data ? `<div class="delivery-box mt-12"><div class="delivery-box-title">Dữ liệu giao</div><div class="delivery-data">${o.delivery_data}</div></div>` : ''}
      `, `Đơn: ${o.order_code}`);
    });
  };
  await refresh();
}

function showDeliverModal(orderId, refresh) {
  openModal(`
    <form id="deliver-form">
      <div class="form-group"><label class="form-label">Dữ liệu giao hàng<span class="req">*</span></label><textarea class="form-textarea" id="deliver-data" rows="6" placeholder="username: ...\npassword: ..." required></textarea><div class="form-hint">Thông tin giao cho khách</div></div>
      <div class="form-group"><label class="form-label">Ghi chú</label><input class="form-input" id="deliver-note" placeholder="Hướng dẫn..." /></div>
      <div id="deliver-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-success flex-1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Xác nhận giao</button><button type="button" class="btn btn-ghost" id="deliver-cancel">Hủy</button></div>
    </form>
  `, 'Giao hàng thủ công');
  qs('#deliver-cancel').onclick = closeModal;
  qs('#deliver-form').onsubmit = async (e) => {
    e.preventDefault();
    try { await apiFetch(`/orders/admin/${orderId}/deliver`, { method: 'PUT', body: JSON.stringify({ delivery_data: qs('#deliver-data').value, notes: qs('#deliver-note').value || null }) }); closeModal(); toast('Giao thành công!', 'success'); refresh(); }
    catch (err) { const e = qs('#deliver-err'); e.textContent = err.message; e.style.display = 'block'; }
  };
}

// ADMIN STOCK
async function renderAdminStock(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const products = await apiFetch('/products/admin/all');
  const autoProducts = products.filter(p => p.packages?.some(pkg => pkg.delivery_type === 'auto'));
  content.innerHTML = `
    <div class="page-header"><div class="page-title">Kho hàng tự động</div></div>
    <div class="flex gap-16 items-start flex-wrap">
      <div style="flex:1;min-width:260px">
        <div class="fw-600 mb-8">Chọn gói</div>
        ${autoProducts.length ? autoProducts.map(p => `<div class="card mb-8 p-16"><div class="fw-600 mb-8">${p.name}</div>${p.packages.filter(pk => pk.delivery_type === 'auto').map(pk => `<button class="btn btn-ghost btn-sm btn-full mb-4" data-viewstock="${pk.id}" data-pkgname="${encodeURIComponent(pk.name)}">${pk.name} — Kho: ${pk.stock_count}</button>`).join('')}</div>`).join('') : '<p class="text-muted">Chưa có gói tự động.</p>'}
      </div>
      <div style="flex:2;min-width:300px" id="stock-detail"><div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><h3>Chọn gói để xem kho</h3></div></div>
    </div>
  `;
  qsa('[data-viewstock]', content).forEach(btn => { btn.onclick = () => showStockDetail(parseInt(btn.dataset.viewstock), decodeURIComponent(btn.dataset.pkgname)); });
}

async function showStockDetail(pkgId, pkgName) {
  const detail = qs('#stock-detail');
  detail.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const refresh = async () => {
    const items = await apiFetch(`/stock/package/${pkgId}?sold=false`);
    detail.innerHTML = `
      <div class="fw-600 mb-8">${pkgName} — ${items.length} có sẵn</div>
      <div class="card p-16 mb-16">
        <div class="form-group"><label class="form-label">Thêm hàng loạt (1 dòng/item)</label><textarea class="form-textarea" id="bulk-stock" rows="5" placeholder="account1@gmail.com:pass1&#10;account2@gmail.com:pass2"></textarea></div>
        <button class="btn btn-primary" id="btn-add-bulk">+ Thêm</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Dữ liệu</th><th>Ngày thêm</th><th></th></tr></thead>
      <tbody>${items.map(i => `<tr><td class="td-mono text-sm">${i.data}</td><td class="text-sm text-muted">${fmtDate(i.created_at)}</td><td><button class="tbl-btn tbl-delete" data-del-stock="${i.id}">Xóa</button></td></tr>`).join('')}</tbody></table></div>
    `;
    qs('#btn-add-bulk', detail).onclick = async () => { const txt = qs('#bulk-stock', detail).value.trim(); if (!txt) return; const res = await apiFetch('/stock/bulk', { method: 'POST', body: JSON.stringify({ package_id: pkgId, items: txt }) }); toast(`Đã thêm ${res.added} mục`, 'success'); refresh(); };
    qsa('[data-del-stock]', detail).forEach(btn => { btn.onclick = async () => { await apiFetch(`/stock/${btn.dataset.delStock}`, { method: 'DELETE' }); toast('Đã xóa', 'success'); refresh(); }; });
  };
  await refresh();
}

// ADMIN SETTINGS
async function renderAdminSettings(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const settings = await apiFetch('/admin/settings');
  content.innerHTML = `
    <div class="page-header"><div class="page-title">Cài đặt</div></div>
    <div class="card p-24" style="max-width:600px">
      <form id="settings-form">
        <div class="fw-600 mb-12">Thông tin website</div>
        <div class="form-group"><label class="form-label">Tên website</label><input class="form-input" id="s-name" value="${settings.site_name || ''}" placeholder="ShopKey" /></div>
        <div class="form-group"><label class="form-label">Mô tả</label><input class="form-input" id="s-desc" value="${settings.site_description || ''}" /></div>
        <div class="form-group"><label class="form-label">URL Logo</label><input class="form-input" id="s-logo" value="${settings.site_logo || ''}" /></div>
        <div class="form-group"><label class="form-label">Tiền tệ</label><select class="form-select" id="s-currency"><option value="VND" ${settings.currency === 'VND' ? 'selected' : ''}>VND</option><option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD</option></select></div>
        <div class="form-group"><label class="form-label">URL Website (cho PayOS redirect)</label><input class="form-input" id="s-baseurl" value="${settings.app_base_url || ''}" placeholder="https://yourdomain.com" /></div>

        <div class="divider"></div>
        <div class="fw-600 mb-12">💳 Cấu hình PayOS</div>
        <p class="text-muted text-sm mb-12">Lấy từ <a href="https://my.payos.vn" target="_blank" style="color:var(--primary)">my.payos.vn</a> → Kênh thanh toán → API Keys</p>
        <div class="form-group"><label class="form-label">Client ID</label><input class="form-input" id="s-payos-client" value="${settings.payos_client_id || ''}" placeholder="PayOS Client ID" /></div>
        <div class="form-group"><label class="form-label">API Key</label><input class="form-input" id="s-payos-api" value="${settings.payos_api_key ? '••••••••' : ''}" placeholder="PayOS API Key" type="password" /></div>
        <div class="form-group"><label class="form-label">Checksum Key</label><input class="form-input" id="s-payos-checksum" value="${settings.payos_checksum_key ? '••••••••' : ''}" placeholder="PayOS Checksum Key" type="password" /></div>

        <div class="divider"></div>
        <div class="fw-600 mb-12">🔐 Cấu hình OAuth (Đăng nhập MXH)</div>
        <p class="text-muted text-sm mb-12">Để trống nếu không dùng</p>
        <div class="form-group"><label class="form-label">Google Client ID</label><input class="form-input" id="s-google-id" value="${settings.google_client_id || ''}" placeholder="xxxxxxx.apps.googleusercontent.com" /></div>
        <div class="form-group"><label class="form-label">Google Client Secret</label><input class="form-input" id="s-google-secret" value="${settings.google_client_secret ? '••••••••' : ''}" placeholder="Google Client Secret" type="password" /></div>
        <div class="form-group"><label class="form-label">Discord Client ID</label><input class="form-input" id="s-discord-id" value="${settings.discord_client_id || ''}" placeholder="Discord Application ID" /></div>
        <div class="form-group"><label class="form-label">Discord Client Secret</label><input class="form-input" id="s-discord-secret" value="${settings.discord_client_secret ? '••••••••' : ''}" placeholder="Discord Client Secret" type="password" /></div>

        <div class="divider"></div>
        <div class="fw-600 mb-12">Tạo Admin</div>
        <div class="form-row form-row-3">
          <div class="form-group"><label class="form-label">User ID</label><input class="form-input" id="admin-uid" placeholder="ID user" /></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="admin-email" placeholder="admin@..." /></div>
          <div class="form-group"><label class="form-label">Secret</label><input class="form-input" id="admin-secret" type="password" /></div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm mb-16" id="btn-make-admin">Cấp quyền Admin</button>
        <button type="submit" class="btn btn-primary btn-lg btn-full">Lưu cài đặt</button>
      </form>
    </div>
  `;
  qs('#btn-make-admin', content).onclick = async () => {
    const uid = qs('#admin-uid', content).value.trim(), email = qs('#admin-email', content).value.trim(), secret = qs('#admin-secret', content).value;
    if (!uid || !email || !secret) return toast('Điền đủ thông tin', 'error');
    try { const r = await apiFetch('/auth/make-admin', { method: 'POST', body: JSON.stringify({ user_id: uid, email, secret }) }); toast(r.message, 'success'); }
    catch (err) { toast(err.message, 'error'); }
  };
  qs('#settings-form', content).onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      site_name: qs('#s-name', content).value,
      site_description: qs('#s-desc', content).value,
      site_logo: qs('#s-logo', content).value,
      currency: qs('#s-currency', content).value,
      app_base_url: qs('#s-baseurl', content).value,
      payos_client_id: qs('#s-payos-client', content).value,
      google_client_id: qs('#s-google-id', content).value,
      discord_client_id: qs('#s-discord-id', content).value,
    };
    // Only send secret fields if user actually typed (not the masked ••••)
    const payosApi = qs('#s-payos-api', content).value;
    const payosCheck = qs('#s-payos-checksum', content).value;
    const googleSec = qs('#s-google-secret', content).value;
    const discordSec = qs('#s-discord-secret', content).value;
    if (payosApi && !payosApi.startsWith('••')) payload.payos_api_key = payosApi;
    if (payosCheck && !payosCheck.startsWith('••')) payload.payos_checksum_key = payosCheck;
    if (googleSec && !googleSec.startsWith('••')) payload.google_client_secret = googleSec;
    if (discordSec && !discordSec.startsWith('••')) payload.discord_client_secret = discordSec;
    try { await apiFetch('/admin/settings', { method: 'POST', body: JSON.stringify(payload) }); toast('Đã lưu', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  };
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN BANNERS
// ═══════════════════════════════════════════════════════════════
async function renderAdminBanners(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const refresh = async () => {
    const banners = await apiFetch('/banners/admin/list');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-title">Quản lý Banners</div>
        <button class="btn btn-primary" id="btn-add-banner">+ Thêm banner</button>
      </div>
      <div class="card">
        <div class="table-wrap"><table>
          <thead><tr><th>Ảnh</th><th>Tiêu đề</th><th>Loại</th><th>Link</th><th>Thứ tự</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${banners.length ? banners.map(b => `<tr>
            <td><img src="${b.image_url}" style="height:48px;border-radius:6px;object-fit:cover" /></td>
            <td class="fw-600">${b.title}</td>
            <td><span class="badge ${b.banner_type === 'hero' ? 'badge-primary' : 'badge-info'}">${b.banner_type}</span></td>
            <td class="text-sm text-muted">${b.link || '—'}</td>
            <td>${b.sort_order}</td>
            <td><span class="badge ${b.is_active ? 'badge-success' : 'badge-muted'}">${b.is_active ? 'Hiện' : 'Ẩn'}</span></td>
            <td>
              <button class="tbl-btn tbl-edit" data-edit-banner="${b.id}">Sửa</button>
              <button class="tbl-btn tbl-delete" data-del-banner="${b.id}">Xóa</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted">Chưa có banner nào</td></tr>'}</tbody>
        </table></div>
      </div>
    `;

    qs('#btn-add-banner', content).onclick = () => showBannerModal(null, refresh);
    qsa('[data-edit-banner]', content).forEach(btn => {
      btn.onclick = () => {
        const b = banners.find(x => x.id === +btn.dataset.editBanner);
        if (b) showBannerModal(b, refresh);
      };
    });
    qsa('[data-del-banner]', content).forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Xóa banner này?')) return;
        await apiFetch(`/banners/admin/${btn.dataset.delBanner}`, { method: 'DELETE' });
        toast('Đã xóa', 'success'); refresh();
      };
    });
  };
  await refresh();
}

function showBannerModal(banner, onDone) {
  const isEdit = !!banner;
  const html = `
    <h3 class="modal-title mb-16">${isEdit ? 'Sửa banner' : 'Thêm banner mới'}</h3>
    <form id="banner-form">
      <div class="form-group">
        <label class="form-label">Tiêu đề</label>
        <input class="form-input" id="bn-title" value="${banner?.title || ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Ảnh banner</label>
        <div class="banner-upload-area" id="bn-upload-area">
          ${banner?.image_url ? `<img src="${banner.image_url}" class="banner-upload-preview" id="bn-preview" />` : '<div class="banner-upload-placeholder" id="bn-preview-placeholder">Click để upload hoặc kéo thả ảnh</div>'}
          <input type="file" id="bn-file" accept="image/*" style="display:none" />
        </div>
        <input class="form-input mt-8" id="bn-image-url" value="${banner?.image_url || ''}" placeholder="Hoặc nhập URL ảnh" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Loại</label>
          <select class="form-select" id="bn-type">
            <option value="hero" ${banner?.banner_type === 'hero' ? 'selected' : ''}>Hero (banner lớn)</option>
            <option value="category" ${banner?.banner_type === 'category' ? 'selected' : ''}>Category (banner nhỏ)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Thứ tự</label>
          <input type="number" class="form-input" id="bn-order" value="${banner?.sort_order ?? 0}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Link (hash route hoặc URL)</label>
        <input class="form-input" id="bn-link" value="${banner?.link || ''}" placeholder="#/category/vpn hoặc https://..." />
      </div>
      <div class="form-group">
        <label class="form-label"><input type="checkbox" id="bn-active" ${banner?.is_active !== false ? 'checked' : ''} /> Hiển thị</label>
      </div>
      <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Cập nhật' : 'Tạo banner'}</button>
    </form>
  `;
  openModal(html);

  const mc = qs('#modal-content');
  // File upload
  const uploadArea = qs('#bn-upload-area', mc);
  const fileInput = qs('#bn-file', mc);
  const imageUrlInput = qs('#bn-image-url', mc);

  uploadArea.onclick = (e) => { if (e.target.tagName !== 'INPUT') fileInput.click(); };
  uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); };
  uploadArea.ondragleave = () => uploadArea.classList.remove('dragover');
  uploadArea.ondrop = async (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); if (e.dataTransfer.files.length) await uploadBannerFile(e.dataTransfer.files[0], uploadArea, imageUrlInput); };
  fileInput.onchange = async () => { if (fileInput.files.length) await uploadBannerFile(fileInput.files[0], uploadArea, imageUrlInput); };

  // Submit
  qs('#banner-form', mc).onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      title: qs('#bn-title', mc).value,
      image_url: qs('#bn-image-url', mc).value,
      link: qs('#bn-link', mc).value,
      banner_type: qs('#bn-type', mc).value,
      sort_order: parseInt(qs('#bn-order', mc).value) || 0,
      is_active: qs('#bn-active', mc).checked,
    };
    if (!body.image_url) return toast('Cần có ảnh banner', 'error');
    try {
      if (isEdit) {
        await apiFetch(`/banners/admin/${banner.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/banners/admin', { method: 'POST', body: JSON.stringify(body) });
      }
      closeModal(); toast(isEdit ? 'Đã cập nhật' : 'Đã tạo', 'success'); onDone();
    } catch (err) { toast(err.message, 'error'); }
  };
}

async function uploadBannerFile(file, area, urlInput) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    area.classList.add('uploading');
    const res = await fetch('/api/banners/admin/upload-image', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: fd,
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    urlInput.value = data.url;
    // Update preview
    const existing = area.querySelector('.banner-upload-preview');
    const placeholder = area.querySelector('.banner-upload-placeholder');
    if (existing) { existing.src = data.url; }
    else {
      if (placeholder) placeholder.remove();
      const img = document.createElement('img');
      img.src = data.url;
      img.className = 'banner-upload-preview';
      area.insertBefore(img, area.querySelector('input'));
    }
    toast('Upload thành công', 'success');
  } catch (err) { toast('Upload thất bại: ' + err.message, 'error'); }
  finally { area.classList.remove('uploading'); }
}

// ── ADMIN FLASH SALES ──────────────────────────────────────────
async function renderAdminFlashSales(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const refresh = async () => {
    const sales = await apiFetch('/flash-sales/admin/list');
    content.innerHTML = `
      <div class="page-header"><div class="page-title">Flash Sales</div><button class="btn btn-primary" id="btn-add-fs">+ Thêm Flash Sale</button></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Sản phẩm</th><th>Gói</th><th>Giá gốc</th><th>Giá sale</th><th>Giới hạn</th><th>Đã bán</th><th>Bắt đầu</th><th>Kết thúc</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>${sales.length ? sales.map(s => `<tr>
          <td class="td-bold">${s.product_name || '—'}</td>
          <td class="text-muted">${s.package_name || '#' + s.package_id}</td>
          <td>${fmt(s.original_price)}</td>
          <td class="text-primary fw-600">${fmt(s.sale_price)}</td>
          <td>${s.quantity_limit || '∞'}</td>
          <td>${s.sold_count || 0}</td>
          <td class="text-sm">${fmtDate(s.starts_at)}</td>
          <td class="text-sm">${fmtDate(s.ends_at)}</td>
          <td>${s.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Off</span>'}</td>
          <td><div class="tbl-actions"><button class="tbl-btn tbl-edit" data-edit-fs="${s.id}">Sửa</button><button class="tbl-btn tbl-delete" data-del-fs="${s.id}">Xóa</button></div></td>
        </tr>`).join('') : '<tr><td colspan="10" class="text-center text-muted">Chưa có flash sale nào</td></tr>'}</tbody>
      </table></div></div>
    `;
    qs('#btn-add-fs', content).onclick = () => showFlashSaleModal(null, refresh);
    qsa('[data-edit-fs]', content).forEach(btn => {
      btn.onclick = () => { const s = sales.find(x => x.id === +btn.dataset.editFs); if (s) showFlashSaleModal(s, refresh); };
    });
    qsa('[data-del-fs]', content).forEach(btn => {
      btn.onclick = async () => { if (!confirm('Xóa flash sale này?')) return; await apiFetch(`/flash-sales/admin/${btn.dataset.delFs}`, { method: 'DELETE' }); toast('Đã xóa', 'success'); refresh(); };
    });
  };
  await refresh();
}

function showFlashSaleModal(fs, onDone) {
  const isEdit = !!fs;
  openModal(`
    <h3 class="modal-title mb-16">${isEdit ? 'Sửa Flash Sale' : 'Thêm Flash Sale'}</h3>
    <form id="fs-form">
      <div class="form-group"><label class="form-label">Package ID<span class="req">*</span></label><input type="number" class="form-input" id="fs-pkg" value="${fs?.package_id || ''}" required /></div>
      <div class="form-group"><label class="form-label">Giá sale<span class="req">*</span></label><input type="number" class="form-input" id="fs-price" value="${fs?.sale_price || ''}" required /></div>
      <div class="form-group"><label class="form-label">Giới hạn SL (0 = không giới hạn)</label><input type="number" class="form-input" id="fs-limit" value="${fs?.quantity_limit ?? 0}" /></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Bắt đầu</label><input type="datetime-local" class="form-input" id="fs-start" value="${fs?.starts_at ? fs.starts_at.slice(0,16) : ''}" /></div>
        <div class="form-group"><label class="form-label">Kết thúc</label><input type="datetime-local" class="form-input" id="fs-end" value="${fs?.ends_at ? fs.ends_at.slice(0,16) : ''}" /></div>
      </div>
      <div class="form-group"><label class="form-label"><input type="checkbox" id="fs-active" ${fs?.is_active !== false ? 'checked' : ''} /> Active</label></div>
      <div id="fs-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">${isEdit ? 'Cập nhật' : 'Tạo mới'}</button><button type="button" class="btn btn-ghost" id="fs-cancel">Hủy</button></div>
    </form>
  `);
  qs('#fs-cancel').onclick = closeModal;
  qs('#fs-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      package_id: parseInt(qs('#fs-pkg').value),
      sale_price: parseInt(qs('#fs-price').value),
      quantity_limit: parseInt(qs('#fs-limit').value) || 0,
      starts_at: qs('#fs-start').value || null,
      ends_at: qs('#fs-end').value || null,
      is_active: qs('#fs-active').checked,
    };
    try {
      if (isEdit) await apiFetch(`/flash-sales/admin/${fs.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/flash-sales/admin', { method: 'POST', body: JSON.stringify(body) });
      closeModal(); toast(isEdit ? 'Đã cập nhật' : 'Đã tạo', 'success'); onDone();
    } catch (err) { const e = qs('#fs-form-err'); e.textContent = err.message; e.style.display = 'block'; }
  };
}

// ── ADMIN GIFT CODES ───────────────────────────────────────────
async function renderAdminGiftCodes(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const refresh = async () => {
    const codes = await apiFetch('/gift-codes/admin/list');
    content.innerHTML = `
      <div class="page-header"><div class="page-title">Gift Codes</div><button class="btn btn-primary" id="btn-add-gc">+ Thêm mã</button></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Mã</th><th>Loại</th><th>Giá trị</th><th>Đơn tối thiểu</th><th>Giảm tối đa</th><th>Đã dùng/Giới hạn</th><th>Hết hạn</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>${codes.length ? codes.map(c => `<tr>
          <td class="td-bold td-mono">${c.code}</td>
          <td><span class="badge ${c.discount_type === 'percent' ? 'badge-blue' : 'badge-purple'}">${c.discount_type === 'percent' ? '%' : 'Fixed'}</span></td>
          <td>${c.discount_type === 'percent' ? c.discount_value + '%' : fmt(c.discount_value)}</td>
          <td>${c.min_order ? fmt(c.min_order) : '—'}</td>
          <td>${c.max_discount ? fmt(c.max_discount) : '—'}</td>
          <td>${c.used_count || 0}/${c.usage_limit || '∞'}</td>
          <td class="text-sm">${fmtDate(c.expires_at)}</td>
          <td>${c.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Off</span>'}</td>
          <td><div class="tbl-actions"><button class="tbl-btn tbl-edit" data-edit-gc="${c.id}">Sửa</button><button class="tbl-btn tbl-delete" data-del-gc="${c.id}">Xóa</button></div></td>
        </tr>`).join('') : '<tr><td colspan="9" class="text-center text-muted">Chưa có gift code nào</td></tr>'}</tbody>
      </table></div></div>
    `;
    qs('#btn-add-gc', content).onclick = () => showGiftCodeModal(null, refresh);
    qsa('[data-edit-gc]', content).forEach(btn => {
      btn.onclick = () => { const c = codes.find(x => x.id === +btn.dataset.editGc); if (c) showGiftCodeModal(c, refresh); };
    });
    qsa('[data-del-gc]', content).forEach(btn => {
      btn.onclick = async () => { if (!confirm('Xóa gift code này?')) return; await apiFetch(`/gift-codes/admin/${btn.dataset.delGc}`, { method: 'DELETE' }); toast('Đã xóa', 'success'); refresh(); };
    });
  };
  await refresh();
}

function showGiftCodeModal(gc, onDone) {
  const isEdit = !!gc;
  openModal(`
    <h3 class="modal-title mb-16">${isEdit ? 'Sửa Gift Code' : 'Thêm Gift Code'}</h3>
    <form id="gc-form">
      <div class="form-group"><label class="form-label">Mã<span class="req">*</span></label><input class="form-input" id="gc-code" value="${gc?.code || ''}" required /></div>
      <div class="form-group"><label class="form-label">Loại giảm</label><select class="form-select" id="gc-type"><option value="percent" ${gc?.discount_type === 'percent' ? 'selected' : ''}>Phần trăm (%)</option><option value="fixed" ${gc?.discount_type === 'fixed' ? 'selected' : ''}>Cố định (đ)</option></select></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Giá trị<span class="req">*</span></label><input type="number" class="form-input" id="gc-value" value="${gc?.discount_value || ''}" required /></div>
        <div class="form-group"><label class="form-label">Giới hạn sử dụng</label><input type="number" class="form-input" id="gc-limit" value="${gc?.usage_limit ?? 0}" /></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Đơn tối thiểu</label><input type="number" class="form-input" id="gc-min" value="${gc?.min_order || 0}" /></div>
        <div class="form-group"><label class="form-label">Giảm tối đa</label><input type="number" class="form-input" id="gc-max" value="${gc?.max_discount || 0}" /></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Bắt đầu</label><input type="datetime-local" class="form-input" id="gc-start" value="${gc?.starts_at ? gc.starts_at.slice(0,16) : ''}" /></div>
        <div class="form-group"><label class="form-label">Hết hạn</label><input type="datetime-local" class="form-input" id="gc-exp" value="${gc?.expires_at ? gc.expires_at.slice(0,16) : ''}" /></div>
      </div>
      <div class="form-group"><label class="form-label"><input type="checkbox" id="gc-active" ${gc?.is_active !== false ? 'checked' : ''} /> Active</label></div>
      <div id="gc-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">${isEdit ? 'Cập nhật' : 'Tạo mới'}</button><button type="button" class="btn btn-ghost" id="gc-cancel">Hủy</button></div>
    </form>
  `);
  qs('#gc-cancel').onclick = closeModal;
  qs('#gc-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      code: qs('#gc-code').value,
      discount_type: qs('#gc-type').value,
      discount_value: parseInt(qs('#gc-value').value),
      usage_limit: parseInt(qs('#gc-limit').value) || 0,
      min_order: parseInt(qs('#gc-min').value) || 0,
      max_discount: parseInt(qs('#gc-max').value) || 0,
      starts_at: qs('#gc-start').value || null,
      expires_at: qs('#gc-exp').value || null,
      is_active: qs('#gc-active').checked,
    };
    try {
      if (isEdit) await apiFetch(`/gift-codes/admin/${gc.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/gift-codes/admin', { method: 'POST', body: JSON.stringify(body) });
      closeModal(); toast(isEdit ? 'Đã cập nhật' : 'Đã tạo', 'success'); onDone();
    } catch (err) { const e = qs('#gc-form-err'); e.textContent = err.message; e.style.display = 'block'; }
  };
}

// ── ADMIN AFFILIATES ───────────────────────────────────────────
async function renderAdminAffiliates(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const refresh = async () => {
    const affiliates = await apiFetch('/affiliate/admin/list');
    content.innerHTML = `
      <div class="page-header"><div class="page-title">Affiliates</div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Email</th><th>Mã giới thiệu</th><th>Hoa hồng (%)</th><th>Tổng thu</th><th>Đã trả</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>${affiliates.length ? affiliates.map(a => `<tr>
          <td class="td-bold">${a.email || '—'}</td>
          <td class="td-mono">${a.referral_code}</td>
          <td>${a.commission_rate}%</td>
          <td>${fmt(a.total_earnings || 0)}</td>
          <td>${fmt(a.total_paid || 0)}</td>
          <td>${a.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Off</span>'}</td>
          <td><div class="tbl-actions"><button class="tbl-btn tbl-edit" data-edit-aff="${a.id}">Sửa</button><button class="tbl-btn tbl-view" data-view-aff="${a.id}">Referrals</button></div></td>
        </tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted">Chưa có affiliate nào</td></tr>'}</tbody>
      </table></div></div>
    `;
    qsa('[data-edit-aff]', content).forEach(btn => {
      btn.onclick = () => { const a = affiliates.find(x => x.id === +btn.dataset.editAff); if (a) showAffiliateModal(a, refresh); };
    });
    qsa('[data-view-aff]', content).forEach(btn => {
      btn.onclick = async () => {
        try {
          const refs = await apiFetch(`/affiliate/admin/${btn.dataset.viewAff}/referrals`);
          let html = '<h3 class="modal-title mb-16">Referrals</h3>';
          if (!refs.length) {
            html += '<div class="text-center text-muted py-16">Chưa có referral nào</div>';
          } else {
            html += '<div class="table-wrap"><table><thead><tr><th>Email</th><th>Ngày</th><th>Trạng thái</th></tr></thead><tbody>';
            refs.forEach(r => {
              html += `<tr><td>${r.email || '—'}</td><td class="text-sm">${fmtDate(r.created_at)}</td><td>${r.status || '—'}</td></tr>`;
            });
            html += '</tbody></table></div>';
          }
          html += '<div class="mt-16 text-right"><button class="btn btn-ghost" id="aff-close">Đóng</button></div>';
          openModal(html);
          qs('#aff-close').onclick = closeModal;
        } catch (err) { toast(err.message, 'error'); }
      };
    });
  };
  await refresh();
}

function showAffiliateModal(aff, onDone) {
  openModal(`
    <h3 class="modal-title mb-16">Sửa Affiliate: ${aff.email || aff.referral_code}</h3>
    <form id="aff-form">
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Hoa hồng (%)</label><input type="number" class="form-input" id="aff-rate" value="${aff.commission_rate}" min="0" max="100" /></div>
        <div class="form-group"><label class="form-label">Trạng thái</label><select class="form-select" id="aff-active"><option value="true" ${aff.is_active ? 'selected' : ''}>Active</option><option value="false" ${!aff.is_active ? 'selected' : ''}>Off</option></select></div>
      </div>
      <div id="aff-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">Cập nhật</button><button type="button" class="btn btn-ghost" id="aff-cancel">Hủy</button></div>
    </form>
  `);
  qs('#aff-cancel').onclick = closeModal;
  qs('#aff-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      commission_rate: parseFloat(qs('#aff-rate').value),
      is_active: qs('#aff-active').value === 'true',
    };
    try {
      await apiFetch(`/affiliate/admin/${aff.id}`, { method: 'PUT', body: JSON.stringify(body) });
      closeModal(); toast('Đã cập nhật', 'success'); onDone();
    } catch (err) { const e = qs('#aff-form-err'); e.textContent = err.message; e.style.display = 'block'; }
  };
}

// ═══════════════════════════════════════════════════════════════
//  BLOG — STOREFRONT
// ═══════════════════════════════════════════════════════════════

async function renderBlogList(view) {
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const page = parseInt(params.get('page') || '1');
  const catSlug = params.get('category') || '';

  try {
    const [catData, postData] = await Promise.all([
      apiFetch('/blog/categories').catch(() => []),
      apiFetch(`/blog/posts?category=${catSlug}&page=${page}&limit=12`)
    ]);
    const categories = Array.isArray(catData) ? catData : [];
    const { items, total, pages } = postData;

    view.innerHTML = '';
    view.appendChild(el('div', 'breadcrumb mb-16', `<a href="#/">Trang chủ</a> <span>›</span> <strong>Blog</strong>`));

    // Category filter chips
    if (categories.length) {
      const chips = el('div', 'blog-cat-chips mb-16');
      const allChip = el('button', `blog-cat-chip${!catSlug ? ' active' : ''}`);
      allChip.textContent = 'Tất cả';
      allChip.onclick = () => { location.hash = '/blog'; };
      chips.appendChild(allChip);
      categories.forEach(c => {
        const chip = el('button', `blog-cat-chip${catSlug === c.slug ? ' active' : ''}`);
        chip.textContent = `${c.name} (${c.post_count || 0})`;
        chip.onclick = () => { location.hash = `/blog?category=${c.slug}`; };
        chips.appendChild(chip);
      });
      view.appendChild(chips);
    }

    view.appendChild(el('div', 'page-header', `<div class="page-title">Blog</div><div class="page-subtitle">${total} bài viết</div>`));

    if (!items.length) {
      view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div><h3>Chưa có bài viết nào</h3>'));
      return;
    }

    const grid = el('div', 'blog-grid');
    items.forEach(post => {
      const card = el('div', 'blog-card');
      card.innerHTML = `
        ${post.thumbnail_url ? `<div class="blog-card-img"><img src="${post.thumbnail_url}" alt="${post.title}" loading="lazy" /></div>` : '<div class="blog-card-img blog-card-img-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>'}
        <div class="blog-card-body">
          ${post.category_name ? `<span class="badge badge-blue mb-4">${post.category_name}</span>` : ''}
          <div class="blog-card-title">${post.title}</div>
          ${post.excerpt ? `<div class="blog-card-excerpt">${post.excerpt}</div>` : ''}
          <div class="blog-card-meta">
            <span>${fmtDate(post.published_at || post.created_at)}</span>
            ${post.view_count != null ? `<span>· ${post.view_count} lượt xem</span>` : ''}
          </div>
        </div>
      `;
      card.onclick = () => { location.hash = `/blog/${post.slug}`; };
      grid.appendChild(card);
    });
    view.appendChild(grid);

    // Pagination
    if (pages > 1) {
      const pag = el('div', 'pagination mt-24');
      for (let i = 1; i <= pages; i++) {
        const btn = el('button', `pagination-btn${i === page ? ' active' : ''}`);
        btn.textContent = i;
        btn.onclick = () => { location.hash = `/blog?category=${catSlug}&page=${i}`; };
        pag.appendChild(btn);
      }
      view.appendChild(pag);
    }
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`;
  }
}

async function renderBlogPost(view, { slug }) {
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const post = await apiFetch(`/blog/posts/${slug}`);
    view.innerHTML = '';
    view.appendChild(el('div', 'breadcrumb mb-16', `<a href="#/">Trang chủ</a> <span>›</span> <a href="#/blog">Blog</a> <span>›</span> <strong>${post.title}</strong>`));

    const article = el('div', 'blog-article');
    article.innerHTML = `
      <div class="blog-article-header">
        ${post.category_name ? `<span class="badge badge-blue mb-8">${post.category_name}</span>` : ''}
        <h1 class="blog-article-title">${post.title}</h1>
        <div class="blog-article-meta">
          <span>${fmtDate(post.published_at || post.created_at)}</span>
          ${post.view_count != null ? `<span>· ${post.view_count} lượt xem</span>` : ''}
        </div>
      </div>
      ${post.thumbnail_url ? `<div class="blog-article-thumbnail"><img src="${post.thumbnail_url}" alt="${post.title}" /></div>` : ''}
      <div class="blog-article-content">${post.content || ''}</div>
    `;
    view.appendChild(article);
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`;
  }
}

// ═══════════════════════════════════════════════════════════════
//  BLOG — ADMIN
// ═══════════════════════════════════════════════════════════════

async function renderAdminBlog(view) {
  const content = qs('#admin-content'); if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  let activeTab = 'posts'; // 'posts' or 'categories'
  let editingPost = null;  // null or post id for full-page form

  const render = async () => {
    if (editingPost !== null) {
      await renderPostForm();
      return;
    }
    content.innerHTML = `
      <div class="page-header">
        <div class="page-title">Blog</div>
      </div>
      <div class="admin-tabs mb-16">
        <button class="admin-tab${activeTab === 'posts' ? ' active' : ''}" data-tab="posts">Bài viết</button>
        <button class="admin-tab${activeTab === 'categories' ? ' active' : ''}" data-tab="categories">Danh mục</button>
      </div>
      <div id="admin-blog-content"></div>
    `;
    qsa('.admin-tab', content).forEach(btn => {
      btn.onclick = () => { activeTab = btn.dataset.tab; render(); };
    });
    if (activeTab === 'posts') await renderPostsTab();
    else await renderCategoriesTab();
  };

  // ── Posts Tab ──
  const renderPostsTab = async () => {
    const wrap = qs('#admin-blog-content', content);
    wrap.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const data = await apiFetch('/blog/admin/posts?page=1&limit=50');
      wrap.innerHTML = `
        <div class="d-flex align-center gap-8 mb-16" style="justify-content:space-between">
          <div class="text-muted text-sm">${data.total} bài viết</div>
          <button class="btn btn-primary btn-sm" id="blog-add-post">+ Thêm bài viết</button>
        </div>
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Tiêu đề</th><th>Danh mục</th><th>Trạng thái</th><th>Lượt xem</th><th>Ngày</th><th></th></tr></thead>
          <tbody>${data.items.length ? data.items.map(p => `<tr>
            <td class="td-bold">${p.title}</td>
            <td>${p.category_name || '—'}</td>
            <td>${p.is_published ? '<span class="badge badge-green">Published</span>' : '<span class="badge badge-yellow">Draft</span>'}</td>
            <td>${p.view_count || 0}</td>
            <td class="text-sm text-muted">${fmtDate(p.created_at)}</td>
            <td><div class="table-actions">
              <button class="action-btn action-btn-edit" data-edit-post="${p.id}">Sửa</button>
              <button class="action-btn action-btn-delete" data-del-post="${p.id}">Xóa</button>
            </div></td>
          </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">Chưa có bài viết nào</td></tr>'}</tbody>
        </table></div></div>
      `;
      qs('#blog-add-post', wrap).onclick = () => { editingPost = 'new'; render(); };
      qsa('[data-edit-post]', wrap).forEach(btn => {
        btn.onclick = () => { editingPost = +btn.dataset.editPost; render(); };
      });
      qsa('[data-del-post]', wrap).forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Xóa bài viết này?')) return;
          try { await apiFetch(`/blog/admin/posts/${btn.dataset.delPost}`, { method: 'DELETE' }); toast('Đã xóa', 'success'); render(); }
          catch (e) { toast(e.message, 'error'); }
        };
      });
    } catch (e) { wrap.innerHTML = `<p class="text-muted">${e.message}</p>`; }
  };

  // ── Categories Tab ──
  const renderCategoriesTab = async () => {
    const wrap = qs('#admin-blog-content', content);
    wrap.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const cats = await apiFetch('/blog/admin/categories');
      wrap.innerHTML = `
        <div class="d-flex align-center gap-8 mb-16" style="justify-content:space-between">
          <div class="text-muted text-sm">${cats.length} danh mục</div>
          <button class="btn btn-primary btn-sm" id="blog-add-cat">+ Thêm danh mục</button>
        </div>
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Tên</th><th>Slug</th><th>Mô tả</th><th>Thứ tự</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${cats.length ? cats.map(c => `<tr>
            <td class="td-bold">${c.name}</td>
            <td class="text-sm font-mono">${c.slug || '—'}</td>
            <td class="text-sm text-muted">${c.description || '—'}</td>
            <td>${c.sort_order || 0}</td>
            <td>${c.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Off</span>'}</td>
            <td><div class="table-actions">
              <button class="action-btn action-btn-edit" data-edit-cat="${c.id}">Sửa</button>
              <button class="action-btn action-btn-delete" data-del-cat="${c.id}">Xóa</button>
            </div></td>
          </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">Chưa có danh mục nào</td></tr>'}</tbody>
        </table></div></div>
      `;
      qs('#blog-add-cat', wrap).onclick = () => showBlogCatModal(null, renderCategoriesTab);
      qsa('[data-edit-cat]', wrap).forEach(btn => {
        btn.onclick = () => { const c = cats.find(x => x.id === +btn.dataset.editCat); if (c) showBlogCatModal(c, renderCategoriesTab); };
      });
      qsa('[data-del-cat]', wrap).forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Xóa danh mục này?')) return;
          try { await apiFetch(`/blog/admin/categories/${btn.dataset.delCat}`, { method: 'DELETE' }); toast('Đã xóa', 'success'); renderCategoriesTab(); }
          catch (e) { toast(e.message, 'error'); }
        };
      });
    } catch (e) { wrap.innerHTML = `<p class="text-muted">${e.message}</p>`; }
  };

  // ── Post Form (full-page) ──
  const renderPostForm = async () => {
    let post = null;
    let cats = [];
    try { cats = await apiFetch('/blog/admin/categories'); } catch (_) {}
    if (editingPost !== 'new') {
      try { post = await apiFetch(`/blog/admin/posts/${editingPost}`); } catch (e) { toast(e.message, 'error'); editingPost = null; render(); return; }
    }

    const slugVal = post?.slug || '';
    const titleVal = post?.title || '';
    const excerptVal = post?.excerpt || '';
    const contentVal = post?.content || '';
    const thumbVal = post?.thumbnail_url || '';
    const metaTitleVal = post?.meta_title || '';
    const metaDescVal = post?.meta_description || '';
    const catIdVal = post?.category_id || '';
    const isPubVal = post?.is_published ? true : false;

    content.innerHTML = `
      <div class="page-header">
        <div class="page-title">${post ? 'Sửa bài viết' : 'Thêm bài viết'}</div>
        <button class="btn btn-ghost btn-sm" id="blog-back">${ico.arrowLeft} Quay lại</button>
      </div>
      <div class="blog-post-form">
        <div class="form-group">
          <label class="form-label">Tiêu đề <span class="req">*</span></label>
          <input type="text" class="form-input" id="bp-title" value="${titleVal}" placeholder="Nhập tiêu đề bài viết" />
        </div>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="form-label">Slug</label>
            <input type="text" class="form-input" id="bp-slug" value="${slugVal}" placeholder="Tự động từ tiêu đề" />
          </div>
          <div class="form-group">
            <label class="form-label">Danh mục</label>
            <select class="form-select" id="bp-category">
              <option value="">— Chọn danh mục —</option>
              ${cats.map(c => `<option value="${c.id}" ${+catIdVal === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Tóm tắt</label>
          <textarea class="form-textarea" id="bp-excerpt" rows="3" placeholder="Tóm tắt ngắn gọn">${excerptVal}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Nội dung (HTML)</label>
          <textarea class="form-textarea" id="bp-content" rows="16" placeholder="Nội dung bài viết (hỗ trợ HTML)">${contentVal}</textarea>
        </div>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="form-label">Thumbnail URL</label>
            <input type="text" class="form-input" id="bp-thumb" value="${thumbVal}" placeholder="https://..." />
          </div>
          <div class="form-group">
            <label class="form-label">Trạng thái</label>
            <div class="toggle-wrap">
              <label class="toggle-label">
                <input type="checkbox" id="bp-published" ${isPubVal ? 'checked' : ''} />
                <span class="toggle-switch"></span>
                <span class="toggle-text">${isPubVal ? 'Published' : 'Draft'}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="form-label">Meta Title</label>
            <input type="text" class="form-input" id="bp-meta-title" value="${metaTitleVal}" placeholder="SEO title" />
          </div>
          <div class="form-group">
            <label class="form-label">Meta Description</label>
            <input type="text" class="form-input" id="bp-meta-desc" value="${metaDescVal}" placeholder="SEO description" />
          </div>
        </div>
        <div id="bp-form-err" class="form-error mb-12" style="display:none"></div>
        <div class="d-flex gap-8 mt-16">
          <button class="btn btn-primary" id="bp-save">${post ? 'Cập nhật' : 'Tạo bài viết'}</button>
          <button class="btn btn-ghost" id="bp-cancel">Hủy</button>
        </div>
      </div>
    `;

    // Auto-generate slug from title
    qs('#bp-title', content).oninput = (e) => {
      const slug = e.target.value.toLowerCase()
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      qs('#bp-slug', content).value = slug;
    };

    // Toggle published text
    qs('#bp-published', content).onchange = (e) => {
      qs('.toggle-text', content).textContent = e.target.checked ? 'Published' : 'Draft';
    };

    qs('#bp-cancel', content).onclick = () => { editingPost = null; render(); };
    qs('#bp-back', content).onclick = () => { editingPost = null; render(); };

    qs('#bp-save', content).onclick = async () => {
      const body = {
        title: qs('#bp-title', content).value.trim(),
        slug: qs('#bp-slug', content).value.trim() || undefined,
        category_id: qs('#bp-category', content).value ? +qs('#bp-category', content).value : null,
        excerpt: qs('#bp-excerpt', content).value.trim(),
        content: qs('#bp-content', content).value.trim(),
        thumbnail_url: qs('#bp-thumb', content).value.trim(),
        meta_title: qs('#bp-meta-title', content).value.trim(),
        meta_description: qs('#bp-meta-desc', content).value.trim(),
        is_published: qs('#bp-published', content).checked,
      };
      if (!body.title) { toast('Nhập tiêu đề', 'error'); return; }
      try {
        if (editingPost === 'new') {
          await apiFetch('/blog/admin/posts', { method: 'POST', body: JSON.stringify(body) });
          toast('Đã tạo bài viết', 'success');
        } else {
          await apiFetch(`/blog/admin/posts/${editingPost}`, { method: 'PUT', body: JSON.stringify(body) });
          toast('Đã cập nhật', 'success');
        }
        editingPost = null;
        render();
      } catch (e) {
        const err = qs('#bp-form-err', content);
        err.textContent = e.message;
        err.style.display = 'block';
      }
    };
  };

  await render();
}

function showBlogCatModal(cat, onDone) {
  const isEdit = !!cat;
  openModal(`
    <h3 class="modal-title mb-16">${isEdit ? 'Sửa danh mục' : 'Thêm danh mục'}</h3>
    <form id="blog-cat-form">
      <div class="form-group"><label class="form-label">Tên <span class="req">*</span></label><input type="text" class="form-input" id="bc-name" value="${cat?.name || ''}" /></div>
      <div class="form-group"><label class="form-label">Slug</label><input type="text" class="form-input" id="bc-slug" value="${cat?.slug || ''}" placeholder="Tự động từ tên" /></div>
      <div class="form-group"><label class="form-label">Mô tả</label><textarea class="form-textarea" id="bc-desc" rows="2">${cat?.description || ''}</textarea></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Thứ tự</label><input type="number" class="form-input" id="bc-sort" value="${cat?.sort_order || 0}" /></div>
        <div class="form-group"><label class="form-label">Trạng thái</label><select class="form-select" id="bc-active"><option value="true" ${cat?.is_active !== false ? 'selected' : ''}>Active</option><option value="false" ${cat?.is_active === false ? 'selected' : ''}>Off</option></select></div>
      </div>
      <div id="bc-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">${isEdit ? 'Cập nhật' : 'Tạo'}</button><button type="button" class="btn btn-ghost" id="bc-cancel">Hủy</button></div>
    </form>
  `);
  qs('#bc-cancel').onclick = closeModal;
  // Auto slug from name
  qs('#bc-name').oninput = (e) => {
    const slug = e.target.value.toLowerCase().replace(/[đĐ]/g, 'd').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    qs('#bc-slug').value = slug;
  };
  qs('#blog-cat-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      name: qs('#bc-name').value.trim(),
      slug: qs('#bc-slug').value.trim() || undefined,
      description: qs('#bc-desc').value.trim(),
      sort_order: parseInt(qs('#bc-sort').value) || 0,
      is_active: qs('#bc-active').value === 'true',
    };
    if (!body.name) { toast('Nhập tên danh mục', 'error'); return; }
    try {
      if (isEdit) await apiFetch(`/blog/admin/categories/${cat.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/blog/admin/categories', { method: 'POST', body: JSON.stringify(body) });
      closeModal(); toast(isEdit ? 'Đã cập nhật' : 'Đã tạo', 'success'); onDone();
    } catch (err) { const e = qs('#bc-form-err'); e.textContent = err.message; e.style.display = 'block'; }
  };
}

// ═══════════════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════════════

async function renderProfile(view) {
  if (!currentUser) return location.hash = '/login';
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    // Refresh user data
    await fetchMe();
    const u = currentUser;
    view.innerHTML = '';
    view.appendChild(el('div', 'breadcrumb mb-16', `<a href="#/">Trang chủ</a> <span>›</span> <strong>Tài khoản</strong>`));
    view.appendChild(el('div', 'page-header', '<div class="page-title">Tài khoản của tôi</div>'));

    // Profile card
    const profileCard = el('div', 'card profile-card mb-24');
    profileCard.innerHTML = `
      <div class="profile-card-inner">
        <div class="profile-avatar">
          ${u.avatar_url ? `<img src="${u.avatar_url}" alt="" />` : `<div class="profile-avatar-placeholder">${(u.display_name || u.email || 'U').charAt(0).toUpperCase()}</div>`}
        </div>
        <div class="profile-info">
          <div class="profile-name">${u.display_name || u.email?.split('@')[0] || 'User'}</div>
          <div class="profile-email">${u.email || '—'}</div>
          <div class="profile-provider">${u.provider ? `<span class="badge badge-purple">${u.provider}</span>` : '<span class="badge badge-gray">local</span>'}</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="profile-edit-btn">Chỉnh sửa</button>
      </div>
    `;
    view.appendChild(profileCard);

    qs('#profile-edit-btn', view).onclick = () => {
      openModal(`
        <h3 class="modal-title mb-16">Chỉnh sửa hồ sơ</h3>
        <form id="profile-form">
          <div class="form-group"><label class="form-label">Tên hiển thị</label><input type="text" class="form-input" id="pf-name" value="${u.display_name || ''}" /></div>
          <div class="form-group"><label class="form-label">Avatar URL</label><input type="text" class="form-input" id="pf-avatar" value="${u.avatar_url || ''}" placeholder="https://..." /></div>
          <div id="pf-form-err" class="form-error mb-12" style="display:none"></div>
          <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">Cập nhật</button><button type="button" class="btn btn-ghost" id="pf-cancel">Hủy</button></div>
        </form>
      `);
      qs('#pf-cancel').onclick = closeModal;
      qs('#profile-form').onsubmit = async (e) => {
        e.preventDefault();
        const body = {
          display_name: qs('#pf-name').value.trim(),
          avatar_url: qs('#pf-avatar').value.trim(),
        };
        try {
          await apiFetch('/auth/me', { method: 'PUT', body: JSON.stringify(body) });
          closeModal(); toast('Đã cập nhật', 'success'); renderProfile(view);
        } catch (err) { const e = qs('#pf-form-err'); e.textContent = err.message; e.style.display = 'block'; }
      };
    };

    // Change password (only for local provider)
    if (!u.provider || u.provider === 'local') {
      const pwCard = el('div', 'card mb-24');
      pwCard.innerHTML = `
        <div class="card-header"><div class="card-title">Đổi mật khẩu</div></div>
        <div style="padding:16px">
          <form id="pw-form">
            <div class="form-group"><label class="form-label">Mật khẩu hiện tại</label><input type="password" class="form-input" id="pw-current" /></div>
            <div class="form-group"><label class="form-label">Mật khẩu mới</label><input type="password" class="form-input" id="pw-new" /></div>
            <div id="pw-form-err" class="form-error mb-12" style="display:none"></div>
            <button type="submit" class="btn btn-primary">Đổi mật khẩu</button>
          </form>
        </div>
      `;
      view.appendChild(pwCard);
      qs('#pw-form', view).onsubmit = async (e) => {
        e.preventDefault();
        const body = {
          current_password: qs('#pw-current').value,
          new_password: qs('#pw-new').value,
        };
        if (!body.current_password || !body.new_password) { toast('Nhập đầy đủ thông tin', 'error'); return; }
        try {
          await apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(body) });
          toast('Đã đổi mật khẩu', 'success');
          qs('#pw-current').value = '';
          qs('#pw-new').value = '';
        } catch (err) { const e = qs('#pw-form-err'); e.textContent = err.message; e.style.display = 'block'; }
      };
    }

    // Order history
    const ordersCard = el('div', 'card');
    ordersCard.innerHTML = `<div class="card-header"><div class="card-title">Lịch sử đơn hàng</div><a href="#/orders" class="btn btn-ghost btn-sm">Xem tất cả</a></div><div id="profile-orders" style="padding:16px"><div class="page-loading"><div class="spinner"></div></div></div>`;
    view.appendChild(ordersCard);

    try {
      const data = await apiFetch('/orders/my');
      const wrap = qs('#profile-orders', view);
      if (!data.items.length) {
        wrap.innerHTML = '<div class="text-center text-muted py-16">Chưa có đơn hàng</div>';
      } else {
        const recent = data.items.slice(0, 5);
        wrap.innerHTML = recent.map(o => `
          <div class="order-card" style="margin-bottom:8px">
            <div class="order-card-top">
              <div><div class="order-code">${o.order_code}</div><div class="order-date">${fmtDate(o.created_at)}</div></div>
              <div class="d-flex align-center gap-8">${statusBadge(o.status)}<a href="#/orders/${o.order_code}" class="btn btn-ghost btn-sm">Chi tiết</a></div>
            </div>
            <div class="text-sm">${o.product_name || ''} — <span class="text-muted">${o.package_name || ''}</span></div>
            <div class="fw-700 text-primary mt-4">${fmt(o.total_amount)}</div>
          </div>
        `).join('');
      }
    } catch (_) { qs('#profile-orders', view).innerHTML = '<div class="text-muted">Không thể tải đơn hàng</div>'; }
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`;
  }
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
async function init() {
  loadToken();
  await fetchMe();
  updateAuthUI();
  updateCartCount();
  await loadSidebar();

  window.addEventListener('hashchange', navigate);
  await navigate();

  // User dropdown
  const userMenuBtn = qs('#user-menu-btn');
  const dropdown = qs('#user-dropdown');
  if (userMenuBtn && dropdown) {
    userMenuBtn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }

  // Logout
  qs('#btn-logout')?.addEventListener('click', () => {
    saveToken(null); currentUser = null; updateAuthUI();
    toast('Đã đăng xuất', 'info'); location.hash = '/';
  });

  // Search
  const doSearch = () => { const q = (qs('#search-input')?.value || '').trim(); if (q) location.hash = `/search?q=${encodeURIComponent(q)}`; };
  qs('#search-btn')?.addEventListener('click', doSearch);
  qs('#search-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

  // Hamburger (storefront)
  qs('#hamburger')?.addEventListener('click', toggleSidebar);
  qs('#sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Modal
  qs('#modal-close')?.addEventListener('click', closeModal);
  qs('#modal-overlay')?.addEventListener('click', (e) => { if (e.target === qs('#modal-overlay')) closeModal(); });
}

init();
