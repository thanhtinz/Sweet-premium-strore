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
    const email = currentUser.email || '';
    const name = email.split('@')[0];
    if (dropdownName) dropdownName.textContent = name;
    if (dropdownEmail) dropdownEmail.textContent = email;
    if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
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
  const existing = cart.find(i => i.pkg_id === pkg.id);
  if (existing) existing.quantity += quantity;
  else cart.push({ pkg_id: pkg.id, pkg_name: pkg.name, pkg_price: pkg.price, product_name: product.name, product_slug: product.slug, product_img: product.image_url, delivery_type: pkg.delivery_type, quantity, fields });
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
  '/category/:slug': renderCategory,
  '/product/:slug': renderProduct,
  '/cart': renderCart,
  '/checkout': renderCheckout,
  '/orders': renderOrders,
  '/orders/:code': renderOrderDetail,
  '/search': renderSearch,
  '/login': renderLogin,
  '/register': renderRegister,
  '/admin': renderAdmin,
  '/admin/categories': renderAdminCategories,
  '/admin/products': renderAdminProducts,
  '/admin/orders': renderAdminOrders,
  '/admin/stock': renderAdminStock,
  '/admin/settings': renderAdminSettings,
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
  // Hero
  const hero = el('div', 'hero');
  hero.innerHTML = `
    <h1>Mua sản phẩm số<br>uy tín, giá tốt</h1>
    <p>Tài khoản, key, gift card, phần mềm và hàng trăm sản phẩm số chất lượng cao</p>
    <div class="hero-tags">
      <span class="hero-tag"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Giao hàng tự động</span>
      <span class="hero-tag"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> An toàn & uy tín</span>
      <span class="hero-tag"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Thanh toán nhanh</span>
    </div>
  `;
  view.appendChild(hero);

  // Categories
  if (categories.length) {
    view.appendChild(el('div', 'fw-700 text-lg mb-12', 'Danh mục sản phẩm'));
    const grid = el('div', 'category-grid mb-24');
    categories.forEach(cat => {
      const card = el('div', 'category-card');
      const iconHtml = cat.icon_url ? `<img src="${cat.icon_url}" alt="${cat.name}" />` : `<span class="cat-emoji"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>`;
      card.innerHTML = `${iconHtml}<span class="category-card-name">${cat.name}</span>`;
      card.onclick = () => { location.hash = `/category/${cat.slug}`; };
      grid.appendChild(card);
    });
    view.appendChild(grid);
  }

  // Featured
  view.appendChild(el('div', 'fw-700 text-lg mb-12', '⭐ Sản phẩm nổi bật'));
  try {
    const data = await apiFetch('/products/featured?limit=12');
    if (!data.length) {
      view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><h3>Chưa có sản phẩm nổi bật</h3>'));
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
  view.innerHTML = `<div class="page-header"><div class="page-title">Tìm kiếm: "${q}"</div></div>`;
  if (!q) return;
  try {
    const data = await apiFetch(`/products/?search=${encodeURIComponent(q)}&limit=40`);
    if (!data.items.length) {
      view.innerHTML += '<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div><h3>Không tìm thấy kết quả</h3></div>';
    } else {
      const grid = el('div', 'product-grid');
      data.items.forEach(p => grid.appendChild(productCard(p)));
      view.appendChild(grid);
    }
  } catch (e) { view.innerHTML += `<p class="text-muted">${e.message}</p>`; }
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
      <div class="product-card-price">${p.min_price ? 'Từ ' + fmt(p.min_price) : 'Liên hệ'}</div>
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
          item.innerHTML = `
            <div><div class="pkg-name">${pkg.name}</div><div class="pkg-desc">${pkg.description || ''}</div>${stockInfo}</div>
            <div style="text-align:right"><div class="pkg-price">${fmt(pkg.price)}</div>${pkg.original_price ? `<div class="pkg-orig">${fmt(pkg.original_price)}</div>` : ''}</div>
          `;
          item.onclick = () => { selectedPkg = pkg; qsa('.package-item', pkgList).forEach(e => e.classList.remove('selected')); item.classList.add('selected'); renderFields(); };
          pkgList.appendChild(item);
        });
        pkgSection.appendChild(pkgList);
        info.appendChild(pkgSection);

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
    view.appendChild(el('div', 'page-header', '<div class="page-title">Chi tiết đơn hàng</div><a href="#/orders" class="btn btn-ghost btn-sm">← Quay lại</a>'));
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
      <div class="auth-footer">
        Chưa có tài khoản? <a href="#/register" class="auth-link">Tạo tài khoản mới →</a>
      </div>
    </div>
  `;
  view.appendChild(page);
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
      const neonAuthUrl = await getNeonAuthUrl();
      const res = await fetch(`${neonAuthUrl}/api/auth/callback/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: qs('#login-email', page).value, password: qs('#login-pwd', page).value }) });
      if (!res.ok) throw new Error('Email hoặc mật khẩu không đúng');
      const data = await res.json();
      const token = data.access_token || data.token || data.id_token;
      if (!token) throw new Error('Đăng nhập thất bại');
      saveToken(token); await fetchMe(); updateAuthUI();
      toast('Đăng nhập thành công!', 'success'); location.hash = '/';
    } catch (err) {
      errText.textContent = err.message;
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
      <div class="auth-footer">
        Đã có tài khoản? <a href="#/login" class="auth-link">Đăng nhập →</a>
      </div>
    </div>
  `;
  view.appendChild(page);

  qs('#register-form', page).onsubmit = async (e) => {
    e.preventDefault();
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
      const neonAuthUrl = await getNeonAuthUrl();
      const res = await fetch(`${neonAuthUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pwd })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Đăng ký thất bại'); }
      const data = await res.json();
      const token = data.access_token || data.token || data.id_token;
      if (token) { saveToken(token); await fetchMe(); updateAuthUI(); toast('Đăng ký thành công!', 'success'); location.hash = '/'; }
      else { toast('Đăng ký thành công! Vui lòng đăng nhập.', 'success'); location.hash = '/login'; }
    } catch (err) { errText.textContent = err.message; errEl.style.display = 'flex'; }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  };
}

let _neonAuthUrl = null;
async function getNeonAuthUrl() {
  if (_neonAuthUrl) return _neonAuthUrl;
  const info = await fetch('/api/health').then(r => r.json()).catch(() => ({}));
  _neonAuthUrl = info.neon_auth_url || '';
  return _neonAuthUrl;
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
          <div class="divider"></div>
          <button class="admin-nav-item" data-href="#/">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>← Storefront</span>
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
        <tbody>${products.map(p => `<tr><td class="td-bold">${p.name}</td><td class="text-muted">${p.category_name || '—'}</td><td>${(p.packages||[]).length}</td><td class="text-primary">${p.min_price ? fmt(p.min_price) : '—'}</td><td>${p.is_featured ? '⭐' : '—'}</td><td>${p.is_active ? '<span class="badge badge-green">Hiện</span>' : '<span class="badge badge-gray">Ẩn</span>'}</td><td><div class="tbl-actions"><button class="tbl-btn tbl-edit" data-edit="${p.id}">Sửa</button><button class="tbl-btn tbl-view" data-pkg="${p.id}" data-pname="${encodeURIComponent(p.name)}">Gói</button><button class="tbl-btn tbl-delete" data-del="${p.id}">Xóa</button></div></td></tr>`).join('')}</tbody>
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
        <div class="form-group"><label class="form-label">Tên website</label><input class="form-input" id="s-name" value="${settings.site_name || ''}" placeholder="ShopKey" /></div>
        <div class="form-group"><label class="form-label">Mô tả</label><input class="form-input" id="s-desc" value="${settings.site_description || ''}" /></div>
        <div class="form-group"><label class="form-label">URL Logo</label><input class="form-input" id="s-logo" value="${settings.site_logo || ''}" /></div>
        <div class="form-group"><label class="form-label">Tiền tệ</label><select class="form-select" id="s-currency"><option value="VND" ${settings.currency === 'VND' ? 'selected' : ''}>VND</option><option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD</option></select></div>
        <div class="divider"></div>
        <div class="fw-600 mb-12">Tạo Admin</div>
        <div class="form-row form-row-3">
          <div class="form-group"><label class="form-label">User ID</label><input class="form-input" id="admin-uid" placeholder="Neon Auth ID" /></div>
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
    try { await apiFetch('/admin/settings', { method: 'POST', body: JSON.stringify({ site_name: qs('#s-name', content).value, site_description: qs('#s-desc', content).value, site_logo: qs('#s-logo', content).value, currency: qs('#s-currency', content).value }) }); toast('Đã lưu', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  };
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
