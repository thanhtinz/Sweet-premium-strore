/* ═══════════════════════════════════════════════════════════════
   ShopKey — Main SPA Application
   Stack: Vanilla JS, FastAPI backend, Neon Auth
═══════════════════════════════════════════════════════════════ */

// ── Config ─────────────────────────────────────────────────────
const API = '/api';
const CURRENCY = 'VND';

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
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  t.innerHTML = `<div class="toast-icon">${icons[type] || 'ℹ'}</div><div class="toast-text">${msg}</div>`;
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

function loadToken() {
  authToken = localStorage.getItem('sk_token');
}

async function fetchMe() {
  if (!authToken) return;
  try {
    currentUser = await apiFetch('/auth/me');
  } catch (_) {
    currentUser = null;
    saveToken(null);
  }
}

function updateAuthUI() {
  const authBtns = qs('#auth-buttons');
  const userMenu = qs('#user-menu');
  const userMenuBtn = qs('#user-menu-btn');
  const dropdownInfo = qs('#dropdown-user-info');
  const dropdownAdmin = qs('#dropdown-admin');

  if (currentUser) {
    authBtns && (authBtns.style.display = 'none');
    userMenu && (userMenu.style.display = 'block');
    userMenuBtn && (userMenuBtn.style.display = 'flex');
    const email = currentUser.email || '';
    if (dropdownInfo) dropdownInfo.textContent = email;
    if (dropdownAdmin) dropdownAdmin.style.display = currentUser.is_admin ? 'block' : 'none';
  } else {
    authBtns && (authBtns.style.display = 'flex');
    userMenu && (userMenu.style.display = 'none');
    userMenuBtn && (userMenuBtn.style.display = 'none');
  }
}

// ── Cart ───────────────────────────────────────────────────────
function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const badge = qs('#cart-count');
  if (!badge) return;
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function addToCart(product, pkg, quantity = 1, fields = {}) {
  const existing = cart.find(i => i.pkg_id === pkg.id);
  if (existing) { existing.quantity += quantity; }
  else {
    cart.push({
      pkg_id: pkg.id,
      pkg_name: pkg.name,
      pkg_price: pkg.price,
      product_name: product.name,
      product_slug: product.slug,
      product_img: product.image_url,
      delivery_type: pkg.delivery_type,
      quantity,
      fields,
    });
  }
  saveCart();
  toast(`Đã thêm <b>${pkg.name}</b> vào giỏ hàng`, 'success');
}

function removeFromCart(pkg_id) {
  cart = cart.filter(i => i.pkg_id !== pkg_id);
  saveCart();
}

function cartTotal() {
  return cart.reduce((s, i) => s + i.pkg_price * i.quantity, 0);
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(html, title = '') {
  const overlay = qs('#modal-overlay');
  const content = qs('#modal-content');
  const titleEl = qs('#modal-title');
  if (titleEl) titleEl.textContent = title;
  content.innerHTML = html;
  overlay.style.display = 'flex';
}

function closeModal() {
  qs('#modal-overlay').style.display = 'none';
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

  // Update sidebar active
  qsa('#sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));
  const route = parseRoute(hash);

  // Admin layout switch
  const isAdmin = hash.startsWith('#/admin');
  const appShell = qs('#app-shell');
  let adminWrap = qs('#admin-wrap');

  if (isAdmin) {
    if (appShell) appShell.style.display = 'none';
    if (!adminWrap) {
      adminWrap = document.createElement('div');
      adminWrap.id = 'admin-wrap';
      adminWrap.className = 'admin-wrap';
      document.body.appendChild(adminWrap);
    }
    adminWrap.style.display = 'flex';
    if (!currentUser || !currentUser.is_admin) {
      adminWrap.innerHTML = '<div style="padding:60px;text-align:center;width:100%;color:var(--text-3)">Bạn không có quyền truy cập Admin Panel.<br><a href="#/" style="color:var(--primary)">Quay về trang chủ</a></div>';
      return;
    }
    renderAdminShell(adminWrap);
  } else {
    if (appShell) appShell.style.display = 'flex';
    if (adminWrap) adminWrap.style.display = 'none';
  }

  if (!route) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>Không tìm thấy trang</h3><a href="#/" class="btn btn-primary mt-12">Về trang chủ</a></div>`;
    return;
  }

  try {
    await route.handler(view, route.params);
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Lỗi tải trang</h3><p class="text-muted">${e.message}</p></div>`;
  }
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
    allItem.innerHTML = `<div class="nav-icon">🏠</div><span>Tất cả</span>`;
    nav.appendChild(allItem);
    categories.forEach(cat => {
      const item = el('a', 'nav-item');
      item.href = `#/category/${cat.slug}`;
      const icon = cat.icon_url
        ? `<img src="${cat.icon_url}" alt="" style="width:18px;height:18px;object-fit:contain" />`
        : '📦';
      item.innerHTML = `<div class="nav-icon">${icon}</div><span>${cat.name}</span>`;
      nav.appendChild(item);
    });
  } catch (_) {}
}

// ── Pages ──────────────────────────────────────────────────────

// HOME
async function renderHome(view) {
  view.innerHTML = '';

  // Hero
  const hero = el('div', 'hero mb-24');
  hero.innerHTML = `
    <h1>🔑 Mua sản phẩm số<br>uy tín, giá tốt</h1>
    <p>Tài khoản, key, gift card, phần mềm và hàng trăm sản phẩm số chất lượng cao</p>
    <div class="hero-tags">
      <span class="hero-tag">⚡ Giao hàng tự động</span>
      <span class="hero-tag">🔒 An toàn & uy tín</span>
      <span class="hero-tag">💳 Thanh toán nhanh</span>
    </div>
  `;
  view.appendChild(hero);

  // Categories
  if (categories.length) {
    const secTitle = el('div', 'fw-600 mb-8');
    secTitle.textContent = 'Danh mục sản phẩm';
    view.appendChild(secTitle);
    const grid = el('div', 'category-grid mb-24');
    categories.forEach(cat => {
      const card = el('div', 'category-card');
      const iconHtml = cat.icon_url
        ? `<img src="${cat.icon_url}" alt="${cat.name}" />`
        : `<span class="cat-emoji">📦</span>`;
      card.innerHTML = `${iconHtml}<span>${cat.name}</span>`;
      card.onclick = () => { location.hash = `/category/${cat.slug}`; };
      grid.appendChild(card);
    });
    view.appendChild(grid);
  }

  // Featured
  const title = el('div', 'fw-600 mb-8');
  title.textContent = '⭐ Sản phẩm nổi bật';
  view.appendChild(title);

  try {
    const data = await apiFetch('/products/featured?limit=12');
    if (!data.length) {
      view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon">📦</div><h3>Chưa có sản phẩm nổi bật</h3>'));
    } else {
      const grid = el('div', 'product-grid');
      data.forEach(p => grid.appendChild(productCard(p)));
      view.appendChild(grid);
    }
  } catch (_) {
    view.appendChild(el('p', 'text-muted', 'Không thể tải sản phẩm.'));
  }
}

// CATEGORY
async function renderCategory(view, { slug }) {
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const [cat, data] = await Promise.all([
      apiFetch(`/categories/${slug}`),
      apiFetch(`/products/?category_slug=${slug}&limit=40`)
    ]);
    view.innerHTML = '';
    const ph = el('div', 'page-header');
    ph.innerHTML = `<h2>${cat.name}</h2><span class="text-muted text-sm">${data.total} sản phẩm</span>`;
    view.appendChild(ph);
    if (!data.items.length) {
      view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon">📦</div><h3>Danh mục này chưa có sản phẩm</h3>'));
    } else {
      const grid = el('div', 'product-grid');
      data.items.forEach(p => grid.appendChild(productCard(p)));
      view.appendChild(grid);
    }
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

// SEARCH
async function renderSearch(view) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const q = params.get('q') || '';
  view.innerHTML = `
    <div class="page-header"><h2>Tìm kiếm: "${q}"</h2></div>
  `;
  if (!q) return;
  try {
    const data = await apiFetch(`/products/?search=${encodeURIComponent(q)}&limit=40`);
    if (!data.items.length) {
      view.innerHTML += `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>Không tìm thấy kết quả cho "${q}"</h3></div>`;
    } else {
      const grid = el('div', 'product-grid');
      data.items.forEach(p => grid.appendChild(productCard(p)));
      view.appendChild(grid);
    }
  } catch (e) {
    view.innerHTML += `<p class="text-muted">${e.message}</p>`;
  }
}

function productCard(p) {
  const card = el('div', 'product-card');
  const imgHtml = p.image_url
    ? `<img class="product-card-img" src="${p.image_url}" alt="${p.name}" loading="lazy" />`
    : `<div class="product-card-img-placeholder">📦</div>`;
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

      // Breadcrumb
      const bc = el('div', 'breadcrumb mb-16');
      bc.innerHTML = `<a href="#/">Trang chủ</a> <span>›</span> ${p.category_name ? `<a href="#/category/${p.category_id}">${p.category_name}</a> <span>›</span> ` : ''}${p.name}`;
      view.appendChild(bc);

      const detail = el('div', 'product-detail-grid');

      // Image
      const imgWrap = el('div', 'product-detail-img');
      imgWrap.innerHTML = p.image_url
        ? `<img src="${p.image_url}" alt="${p.name}" />`
        : `<div class="product-detail-img-ph">📦</div>`;

      // Info
      const info = el('div', 'product-detail-info');
      info.innerHTML = `
        ${p.category_name ? `<div class="product-detail-cat">${p.category_name}</div>` : ''}
        <div class="product-detail-name">${p.name}</div>
        <div class="product-detail-desc">${p.description || ''}</div>
      `;

      if (!p.packages.length) {
        info.innerHTML += `<p class="text-muted">Hiện chưa có gói sản phẩm.</p>`;
      } else {
        // Package list
        const pkgSection = el('div');
        pkgSection.innerHTML = `<div class="section-title" style="font-size:15px;margin-bottom:10px">Chọn gói</div>`;
        const pkgList = el('div', 'package-list');
        p.packages.forEach(pkg => {
          const item = el('div', 'package-item' + (selectedPkg?.id === pkg.id ? ' selected' : ''));
          const stockInfo = pkg.delivery_type === 'auto'
            ? `<div class="pkg-stock">✓ ${pkg.stock_count} có sẵn</div>`
            : `<div class="pkg-stock manual">Giao thủ công</div>`;
          item.innerHTML = `
            <div>
              <div class="pkg-name">${pkg.name}</div>
              <div class="pkg-desc">${pkg.description || ''}</div>
              ${stockInfo}
            </div>
            <div style="text-align:right">
              <div class="pkg-price">${fmt(pkg.price)}</div>
              ${pkg.original_price ? `<div class="pkg-orig">${fmt(pkg.original_price)}</div>` : ''}
            </div>
          `;
          item.onclick = () => {
            selectedPkg = pkg;
            qsa('.package-item', pkgList).forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            // Update custom fields
            renderFields();
          };
          pkgList.appendChild(item);
        });
        pkgSection.appendChild(pkgList);
        info.appendChild(pkgSection);

        // Custom fields
        const fieldsWrap = el('div', 'mt-16', '');
        fieldsWrap.id = 'pkg-fields';
        info.appendChild(fieldsWrap);

        const renderFields = () => {
          if (!selectedPkg?.fields?.length) { fieldsWrap.innerHTML = ''; return; }
          fieldsWrap.innerHTML = `<div class="section-title" style="font-size:15px;margin-bottom:10px">Thông tin yêu cầu</div>`;
          selectedPkg.fields.forEach(f => {
            const fg = el('div', 'form-group');
            fg.innerHTML = `<label class="form-label">${f.field_name}${f.is_required ? '<span class="required">*</span>' : ''}</label>`;
            let input;
            if (f.field_type === 'textarea') {
              input = el('textarea', 'form-textarea');
            } else if (f.field_type === 'select') {
              const opts = JSON.parse(f.options || '[]');
              input = el('select', 'form-select');
              opts.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o; opt.textContent = o;
                input.appendChild(opt);
              });
            } else {
              input = el('input', 'form-input');
              input.type = f.field_type === 'email' ? 'email' : 'text';
              input.placeholder = f.field_name;
            }
            input.dataset.field = f.field_name;
            input.required = f.is_required;
            fg.appendChild(input);
            fieldsWrap.appendChild(fg);
          });
        };
        renderFields();

        // Add to cart button
        const addBtn = el('button', 'btn btn-primary btn-lg btn-full mt-16');
        addBtn.innerHTML = '🛒 Thêm vào giỏ hàng';
        addBtn.onclick = () => {
          if (!selectedPkg) { toast('Vui lòng chọn gói sản phẩm', 'error'); return; }
          if (selectedPkg.delivery_type === 'auto' && selectedPkg.stock_count < 1) {
            toast('Hết hàng', 'error'); return;
          }
          // Collect fields
          const fieldVals = {};
          let valid = true;
          qsa('[data-field]', fieldsWrap).forEach(inp => {
            if (inp.required && !inp.value.trim()) { valid = false; toast(`Vui lòng nhập ${inp.dataset.field}`, 'error'); }
            else fieldVals[inp.dataset.field] = inp.value.trim();
          });
          if (!valid) return;
          addToCart(p, selectedPkg, 1, fieldVals);
        };
        info.appendChild(addBtn);

        const buyBtn = el('button', 'btn btn-ghost btn-lg btn-full mt-8');
        buyBtn.innerHTML = '⚡ Mua ngay';
        buyBtn.onclick = () => {
          if (!selectedPkg) { toast('Vui lòng chọn gói sản phẩm', 'error'); return; }
          if (!currentUser) { toast('Vui lòng đăng nhập để mua hàng', 'error'); location.hash = '/login'; return; }
          const fieldVals = {};
          let valid = true;
          qsa('[data-field]', fieldsWrap).forEach(inp => {
            if (inp.required && !inp.value.trim()) { valid = false; toast(`Vui lòng nhập ${inp.dataset.field}`, 'error'); }
            else fieldVals[inp.dataset.field] = inp.value.trim();
          });
          if (!valid) return;
          addToCart(p, selectedPkg, 1, fieldVals);
          location.hash = '/cart';
        };
        info.appendChild(buyBtn);
      }

      detail.appendChild(imgWrap);
      detail.appendChild(info);
      view.appendChild(detail);
    };

    render();
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

// CART
function renderCart(view) {
  view.innerHTML = '';
  const ph = el('div', 'page-header');
  ph.innerHTML = '<h2>🛒 Giỏ hàng</h2>';
  view.appendChild(ph);

  if (!cart.length) {
    view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon">🛒</div><h3>Giỏ hàng trống</h3><a href="#/" class="btn btn-primary mt-12">Tiếp tục mua sắm</a>'));
    return;
  }

  const grid = el('div', 'cart-layout');

  // Items
  const itemsCol = el('div', 'cart-items');
  cart.forEach(item => {
    const card = el('div', 'cart-item');
    const imgHtml = item.product_img
      ? `<div class="cart-item-img"><img src="${item.product_img}" alt="" /></div>`
      : `<div class="cart-item-img">📦</div>`;
    card.innerHTML = `
      ${imgHtml}
      <div class="cart-item-info">
        <div class="cart-item-name">${item.product_name}</div>
        <div class="cart-item-pkg">Gói: ${item.pkg_name}</div>
        <div class="cart-item-price">${fmt(item.pkg_price)}</div>
      </div>
      <button class="cart-item-remove" data-pkg="${item.pkg_id}" title="Xóa">✕</button>
    `;
    itemsCol.appendChild(card);
  });

  // Summary
  const summary = el('div', 'cart-summary-card');
  const total = cartTotal();
  summary.innerHTML = `
    <div class="cart-summary-head"><div class="cart-summary-title">Tóm tắt đơn hàng</div></div>
    <div class="cart-summary-body">
      ${cart.map(i => `
        <div class="summary-row">
          <span class="summary-label">${i.pkg_name} x${i.quantity}</span>
          <span class="summary-value">${fmt(i.pkg_price * i.quantity)}</span>
        </div>
      `).join('')}
      <div class="divider"></div>
      <div class="summary-row">
        <span class="summary-label fw-700">Tổng cộng</span>
        <span class="summary-total">${fmt(total)}</span>
      </div>
    </div>
    <div class="cart-summary-footer">
      <button class="btn btn-primary btn-lg btn-full" id="btn-checkout">Thanh toán</button>
      <a href="#/" class="btn btn-ghost btn-full mt-8">Tiếp tục mua sắm</a>
    </div>
  `;

  grid.appendChild(itemsCol);
  grid.appendChild(summary);
  view.appendChild(grid);

  // Events
  itemsCol.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pkg]');
    if (btn) { removeFromCart(parseInt(btn.dataset.pkg)); renderCart(view); }
  });

  qs('#btn-checkout', summary).onclick = () => {
    if (!currentUser) { toast('Vui lòng đăng nhập để thanh toán', 'error'); location.hash = '/login'; return; }
    location.hash = '/checkout';
  };
}

// CHECKOUT
async function renderCheckout(view) {
  if (!cart.length) { location.hash = '/cart'; return; }
  if (!currentUser) { toast('Vui lòng đăng nhập', 'error'); location.hash = '/login'; return; }

  view.innerHTML = '';
  const ph = el('div', 'page-header');
  ph.innerHTML = '<h2>💳 Thanh toán</h2>';
  view.appendChild(ph);

  const grid = el('div', 'checkout-grid');

  // Left: order details + fields
  const left = el('div');
  left.innerHTML = `
    <div class="card mb-16"><div class="card-body">
      <div class="fw-600 mb-6">Thông tin tài khoản</div>
      <p class="text-muted text-sm">${currentUser.email}</p>
    </div></div>
    <div class="card mb-16"><div class="card-body">
      <div class="fw-600 mb-12">Sản phẩm đặt mua</div>
      ${cart.map(i => `
        <div class="summary-row">
          <span class="summary-label">${i.product_name} — ${i.pkg_name} x${i.quantity}</span>
          <span class="summary-value text-primary">${fmt(i.pkg_price * i.quantity)}</span>
        </div>
      `).join('')}
      <div class="divider"></div>
      <div class="summary-row">
        <span class="fw-700">Tổng</span>
        <span class="fw-700 text-primary">${fmt(cartTotal())}</span>
      </div>
    </div></div>
    <div class="card"><div class="card-body">
      <div class="fw-600 mb-12">Phương thức thanh toán</div>
      <div class="payment-option selected" id="pm-payos">
        <div class="payment-option-icon">🏦</div>
        <div>
          <div class="payment-option-name">PayOS — Chuyển khoản ngân hàng</div>
          <div class="payment-option-desc">QR code, tất cả ngân hàng Việt Nam</div>
        </div>
      </div>
      <button class="btn btn-primary btn-lg btn-full mt-16" id="btn-pay">Tạo đơn & Thanh toán</button>
    </div></div>
  `;

  // Right: summary
  const right = el('div', 'cart-summary-card');
  right.innerHTML = `
    <div class="cart-summary-head"><div class="cart-summary-title">Đơn hàng</div></div>
    <div class="cart-summary-body">
      ${cart.map(i => `
        <div class="summary-row">
          <span class="summary-label text-sm">${i.pkg_name}</span>
          <span class="summary-value">${fmt(i.pkg_price)}</span>
        </div>
      `).join('')}
      <div class="divider"></div>
      <div class="summary-row">
        <span class="summary-label fw-700">Tổng thanh toán</span>
        <span class="summary-total">${fmt(cartTotal())}</span>
      </div>
      <p class="text-xs text-muted mt-12">Đơn hàng sẽ được giao ngay sau khi thanh toán thành công (nếu có sẵn hàng tự động).</p>
    </div>
  `;

  grid.appendChild(left);
  grid.appendChild(right);
  view.appendChild(grid);

  qs('#btn-pay', left).onclick = async () => {
    const btn = qs('#btn-pay', left);
    btn.disabled = true;
    btn.textContent = 'Đang xử lý...';
    try {
      // Create one order per cart item (simplified: first item)
      const item = cart[0];
      const order = await apiFetch('/orders/create', {
        method: 'POST',
        body: JSON.stringify({
          package_id: item.pkg_id,
          quantity: item.quantity,
          custom_fields_data: item.fields || {},
        })
      });
      // Create PayOS payment link
      const link = await apiFetch('/payment/create-link', {
        method: 'POST',
        body: JSON.stringify({ order_code: order.order_code })
      });
      // Clear cart and redirect
      cart = [];
      saveCart();
      window.open(link.payment_url, '_blank');
      toast('Đã tạo đơn hàng! Đang chuyển đến trang thanh toán...', 'success', 5000);
      location.hash = `/orders/${order.order_code}`;
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Tạo đơn & Thanh toán';
    }
  };
}

// ORDERS LIST
async function renderOrders(view) {
  if (!currentUser) { location.hash = '/login'; return; }
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const data = await apiFetch('/orders/my');
    view.innerHTML = '';
    const ph = el('div', 'page-header');
    ph.innerHTML = `<h2>📋 Đơn hàng của tôi</h2><span class="text-muted text-sm">${data.total} đơn</span>`;
    view.appendChild(ph);

    if (!data.items.length) {
      view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon">📋</div><h3>Chưa có đơn hàng nào</h3><a href="#/" class="btn btn-primary mt-12">Mua sắm ngay</a>'));
      return;
    }

    data.items.forEach(o => {
      const card = el('div', 'order-card');
      card.innerHTML = `
        <div class="order-card-top">
          <div>
            <div class="order-code">${o.order_code}</div>
            <div class="order-date">${fmtDate(o.created_at)}</div>
          </div>
          <div class="flex gap-8 items-center">
            ${statusBadge(o.status)}
            <a href="#/orders/${o.order_code}" class="btn btn-ghost btn-sm">Chi tiết</a>
          </div>
        </div>
        <div class="text-sm">${o.product_name || ''} — <span class="text-muted">${o.package_name || ''}</span></div>
        <div class="fw-700 text-primary mt-8">${fmt(o.total_amount)}</div>
        ${o.status === 'completed' && o.delivery_data ? `
          <div class="delivery-box">
            <div class="delivery-box-title">✅ Dữ liệu nhận hàng</div>
            <div class="delivery-data">${o.delivery_data}</div>
            <button class="btn-copy" onclick="navigator.clipboard.writeText(\`${o.delivery_data}\`).then(()=>toast('Đã sao chép','success'))">📋 Sao chép</button>
          </div>
        ` : ''}
      `;
      view.appendChild(card);
    });
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

// ORDER DETAIL
async function renderOrderDetail(view, { code }) {
  if (!currentUser) { location.hash = '/login'; return; }
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    // Poll payment status
    const o = await apiFetch(`/payment/status/${code}`);
    const detail = await apiFetch(`/orders/my/${code}`);
    view.innerHTML = '';

    const ph = el('div', 'page-header');
    ph.innerHTML = `<h2>Chi tiết đơn hàng</h2><a href="#/orders" class="btn btn-ghost btn-sm">← Quay lại</a>`;
    view.appendChild(ph);

    const card = el('div', 'order-card');
    card.innerHTML = `
      <div class="order-card-top">
        <div class="order-code">${detail.order_code}</div>
        ${statusBadge(detail.status)}
      </div>
      <div class="order-meta">
        <div class="order-meta-item"><div class="order-meta-label">Sản phẩm</div><div class="order-meta-value">${detail.product_name || '—'}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Gói</div><div class="order-meta-value">${detail.package_name || '—'}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Số lượng</div><div class="order-meta-value">${detail.quantity}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Tổng tiền</div><div class="order-meta-value text-primary">${fmt(detail.total_amount)}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Thanh toán</div><div class="order-meta-value">${detail.payment_method?.toUpperCase() || '—'}</div></div>
        <div class="order-meta-item"><div class="order-meta-label">Ngày tạo</div><div class="order-meta-value">${fmtDate(detail.created_at)}</div></div>
      </div>
      ${detail.status === 'completed' && detail.delivery_data ? `
        <div class="delivery-box">
          <div class="delivery-box-title">✅ Dữ liệu nhận hàng</div>
          <div class="delivery-data">${detail.delivery_data}</div>
          <button class="btn-copy" onclick="navigator.clipboard.writeText(\`${detail.delivery_data}\`).then(()=>toast('Đã sao chép','success'))">📋 Sao chép</button>
        </div>
      ` : detail.status === 'pending' ? `
        <div style="margin-top:12px;padding:14px;background:var(--yellow-light);border-radius:var(--r);border:1px solid var(--yellow)">
          <p class="text-sm" style="color:var(--yellow)">⏳ Đang chờ thanh toán. Nếu đã thanh toán, trạng thái sẽ tự cập nhật trong vài phút.</p>
          <button class="btn btn-sm btn-ghost mt-8" id="btn-check-status">🔄 Kiểm tra lại</button>
        </div>
      ` : ''}
    `;
    view.appendChild(card);

    const checkBtn = qs('#btn-check-status', card);
    if (checkBtn) {
      checkBtn.onclick = () => renderOrderDetail(view, { code });
    }
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

// LOGIN
function renderLogin(view) {
  if (currentUser) { location.hash = '/'; return; }
  view.innerHTML = '';
  const page = el('div', 'auth-page');
  page.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-icon">🔑</div>
        <div class="auth-logo-text">Shop<span>Key</span></div>
      </div>
      <div class="auth-title">Đăng nhập</div>
      <div class="auth-sub">Chào mừng trở lại!</div>
      <form id="login-form">
        <div class="form-group">
          <label class="form-label">Email<span class="req">*</span></label>
          <input type="email" class="form-input" id="login-email" placeholder="email@example.com" required />
        </div>
        <div class="form-group">
          <label class="form-label">Mật khẩu<span class="req">*</span></label>
          <input type="password" class="form-input" id="login-pwd" placeholder="••••••••" required />
        </div>
        <div id="login-error" class="form-error mb-12" style="display:none"></div>
        <button type="submit" class="btn btn-primary btn-full btn-lg">Đăng nhập</button>
      </form>
      <div class="auth-footer">
        Chưa có tài khoản? <a href="#/register" class="auth-link">Đăng ký ngay</a>
      </div>
    </div>
  `;
  view.appendChild(page);

  qs('#login-form', page).onsubmit = async (e) => {
    e.preventDefault();
    const btn = qs('[type=submit]', e.target);
    const errEl = qs('#login-error', page);
    btn.disabled = true;
    btn.textContent = 'Đang đăng nhập...';
    errEl.style.display = 'none';
    try {
      // Use Neon Auth REST API
      const neonAuthUrl = await getNeonAuthUrl();
      const res = await fetch(`${neonAuthUrl}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: qs('#login-email', page).value,
          password: qs('#login-pwd', page).value,
        })
      });
      if (!res.ok) throw new Error('Email hoặc mật khẩu không đúng');
      const data = await res.json();
      const token = data.access_token || data.token || data.id_token;
      if (!token) throw new Error('Đăng nhập thất bại');
      saveToken(token);
      await fetchMe();
      updateAuthUI();
      toast('Đăng nhập thành công!', 'success');
      location.hash = '/';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  };
}

// REGISTER
function renderRegister(view) {
  if (currentUser) { location.hash = '/'; return; }
  view.innerHTML = '';
  const page = el('div', 'auth-page');
  page.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <div class="auth-logo-icon">🔑</div>
        <div class="auth-logo-text">Shop<span>Key</span></div>
      </div>
      <div class="auth-title">Đăng ký</div>
      <div class="auth-sub">Tạo tài khoản miễn phí</div>
      <form id="register-form">
        <div class="form-group">
          <label class="form-label">Email<span class="req">*</span></label>
          <input type="email" class="form-input" id="reg-email" placeholder="email@example.com" required />
        </div>
        <div class="form-group">
          <label class="form-label">Mật khẩu<span class="req">*</span></label>
          <input type="password" class="form-input" id="reg-pwd" placeholder="Tối thiểu 8 ký tự" minlength="8" required />
        </div>
        <div class="form-group">
          <label class="form-label">Xác nhận mật khẩu<span class="req">*</span></label>
          <input type="password" class="form-input" id="reg-pwd2" placeholder="Nhập lại mật khẩu" required />
        </div>
        <div id="reg-error" class="form-error mb-12" style="display:none"></div>
        <button type="submit" class="btn btn-primary btn-full btn-lg">Đăng ký</button>
      </form>
      <div class="auth-footer">
        Đã có tài khoản? <a href="#/login" class="auth-link">Đăng nhập</a>
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
    const btn = qs('[type=submit]', e.target);
    errEl.style.display = 'none';
    if (pwd !== pwd2) { errEl.textContent = 'Mật khẩu không khớp'; errEl.style.display = 'block'; return; }
    btn.disabled = true;
    btn.textContent = 'Đang đăng ký...';
    try {
      const neonAuthUrl = await getNeonAuthUrl();
      const res = await fetch(`${neonAuthUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pwd })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Đăng ký thất bại. Email có thể đã tồn tại.');
      }
      const data = await res.json();
      const token = data.access_token || data.token || data.id_token;
      if (token) {
        saveToken(token);
        await fetchMe();
        updateAuthUI();
        toast('Đăng ký thành công!', 'success');
        location.hash = '/';
      } else {
        toast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
        location.hash = '/login';
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Đăng ký';
    }
  };
}

// Neon Auth URL helper
let _neonAuthUrl = null;
async function getNeonAuthUrl() {
  if (_neonAuthUrl) return _neonAuthUrl;
  const res = await apiFetch('/auth/me').catch(() => null);
  // Fallback — get from backend settings
  const info = await fetch('/api/health').then(r => r.json()).catch(() => ({}));
  _neonAuthUrl = info.neon_auth_url || '';
  return _neonAuthUrl;
}

// ── Admin Shell ─────────────────────────────────────────────────
function renderAdminShell(wrap) {
  const hash = location.hash;
  const activeSection = hash.replace('#/admin', '') || '';
  const SAME_SHELL = wrap.querySelector('.admin-sidebar');
  if (SAME_SHELL) {
    // Only update active state, don't re-render the whole shell
    qsa('.nav-item', wrap).forEach(btn => {
      const href = btn.dataset.href;
      if (!href) return;
      btn.classList.toggle('active', href === hash);
    });
    return;
  }
  wrap.innerHTML = `
    <aside class="admin-sidebar">
      <a href="#/" class="sidebar-logo">
        <div class="sidebar-logo-icon">🔑</div>
        <div class="sidebar-logo-text">Shop<span>Key</span></div>
      </a>
      <nav class="admin-nav" id="admin-nav">
        <div class="sidebar-section">Quản trị</div>
        <button class="nav-item ${hash === '#/admin' ? 'active' : ''}" data-href="#/admin">
          <div class="nav-icon">📊</div><span>Dashboard</span>
        </button>
        <button class="nav-item ${activeSection === '/categories' ? 'active' : ''}" data-href="#/admin/categories">
          <div class="nav-icon">📁</div><span>Danh mục</span>
        </button>
        <button class="nav-item ${activeSection === '/products' ? 'active' : ''}" data-href="#/admin/products">
          <div class="nav-icon">📦</div><span>Sản phẩm</span>
        </button>
        <button class="nav-item ${activeSection === '/orders' ? 'active' : ''}" data-href="#/admin/orders">
          <div class="nav-icon">📋</div><span>Đơn hàng</span>
        </button>
        <button class="nav-item ${activeSection === '/stock' ? 'active' : ''}" data-href="#/admin/stock">
          <div class="nav-icon">🗄️</div><span>Kho hàng</span>
        </button>
        <button class="nav-item ${activeSection === '/settings' ? 'active' : ''}" data-href="#/admin/settings">
          <div class="nav-icon">⚙️</div><span>Cài đặt</span>
        </button>
        <div class="divider"></div>
        <button class="nav-item" data-href="#/">
          <div class="nav-icon">🏠</div><span>← Storefront</span>
        </button>
      </nav>
    </aside>
    <div style="flex:1;display:flex;flex-direction:column;min-width:0">
      <header class="admin-header">
        <button class="hamburger-btn" id="admin-hamburger" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
        <div class="page-title">${!activeSection ? 'Dashboard' : activeSection.slice(1).charAt(0).toUpperCase() + activeSection.slice(2)}</div>
        <div class="header-actions" style="margin-left:auto">
          <div class="user-avatar-btn">
            <div class="user-avatar">${(currentUser?.email || '?').charAt(0).toUpperCase()}</div>
            <div class="user-info">
              <div class="user-name">${(currentUser?.email || '').split('@')[0]}</div>
              <div class="user-role">Admin</div>
            </div>
          </div>
        </div>
      </header>
      <main class="admin-content" id="admin-content">
        <div class="page-loading"><div class="spinner"></div></div>
      </main>
    </div>
  `;

  qsa('[data-href]', wrap).forEach(btn => {
    btn.onclick = () => { location.hash = btn.dataset.href; };
  });
}

// ── Admin Pages ─────────────────────────────────────────────────

async function renderAdmin(view) {
  // Admin pages render inside #admin-content
  const content = qs('#admin-content');
  if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const data = await apiFetch('/admin/dashboard');
    const s = data.stats;
    content.innerHTML = `
      <div class="page-header"><h1>Dashboard</h1></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon purple">📦</div><div class="stat-info"><div class="stat-label">Tổng đơn hàng</div><div class="stat-value">${s.total_orders}</div></div></div>
        <div class="stat-card"><div class="stat-icon yellow">⏳</div><div class="stat-info"><div class="stat-label">Chờ xử lý</div><div class="stat-value">${s.pending_orders}</div></div></div>
        <div class="stat-card"><div class="stat-icon green">✓</div><div class="stat-info"><div class="stat-label">Hoàn thành</div><div class="stat-value">${s.completed_orders}</div></div></div>
        <div class="stat-card"><div class="stat-icon blue">🏷️</div><div class="stat-info"><div class="stat-label">Sản phẩm</div><div class="stat-value">${s.total_products}</div></div></div>
        <div class="stat-card"><div class="stat-icon cyan">🗄️</div><div class="stat-info"><div class="stat-label">Kho hàng</div><div class="stat-value">${s.total_stock_available}</div></div></div>
        <div class="stat-card"><div class="stat-icon purple">💰</div><div class="stat-info"><div class="stat-label">Doanh thu</div><div class="stat-value">${fmt(s.total_revenue)}</div></div></div>
      </div>
      <div class="section-title">Đơn hàng gần đây</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead>
          <tbody>
            ${data.recent_orders.map(o => `
              <tr>
                <td class="font-mono">${o.order_code}</td>
                <td>${o.user_email || '—'}</td>
                <td>${o.product_name || '—'}</td>
                <td class="text-primary">${fmt(o.total_amount)}</td>
                <td>${statusBadge(o.status)}</td>
                <td class="text-sm text-muted">${fmtDate(o.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<p class="text-muted">${e.message}</p>`;
  }
}

async function renderAdminCategories(view) {
  const content = qs('#admin-content');
  if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const refresh = async () => {
    const cats = await apiFetch('/categories/all');
    content.innerHTML = `
      <div class="page-header">
        <h1>Danh mục</h1>
        <button class="btn btn-primary" id="btn-add-cat">+ Thêm danh mục</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Tên</th><th>Slug</th><th>Trạng thái</th><th>Thứ tự</th><th></th></tr></thead>
          <tbody>
            ${cats.map(c => `
              <tr>
                <td class="text-muted">#${c.id}</td>
                <td>${c.name}</td>
                <td class="font-mono text-sm text-muted">${c.slug}</td>
                <td>${c.is_active ? '<span class="badge badge-green">Hiện</span>' : '<span class="badge badge-gray">Ẩn</span>'}</td>
                <td>${c.sort_order}</td>
                <td>
                  <div class="tbl-actions">
                    <button class="tbl-btn tbl-edit" data-edit="${c.id}">Sửa</button>
                    <button class="tbl-btn tbl-delete" data-del="${c.id}">Xóa</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    qs('#btn-add-cat', content).onclick = () => showCatModal(null, refresh);
    qsa('[data-edit]', content).forEach(btn => {
      const id = parseInt(btn.dataset.edit);
      btn.onclick = () => showCatModal(cats.find(c => c.id === id), refresh);
    });
    qsa('[data-del]', content).forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Xóa danh mục này?')) return;
        await apiFetch(`/categories/${btn.dataset.del}`, { method: 'DELETE' });
        toast('Đã xóa', 'success');
        refresh();
      };
    });
  };

  await refresh();
}

function showCatModal(cat, refresh) {
  openModal(`
    <form id="cat-form">
      <div class="form-group">
        <label class="form-label">Tên<span class="required">*</span></label>
        <input class="form-input" id="cf-name" value="${cat?.name || ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Slug</label>
        <input class="form-input" id="cf-slug" value="${cat?.slug || ''}" placeholder="tự động từ tên" />
      </div>
      <div class="form-group">
        <label class="form-label">URL icon</label>
        <input class="form-input" id="cf-icon" value="${cat?.icon_url || ''}" placeholder="https://..." />
      </div>
      <div class="form-group">
        <label class="form-label">Thứ tự</label>
        <input type="number" class="form-input" id="cf-order" value="${cat?.sort_order ?? 0}" />
      </div>
      <div class="form-group">
        <label class="form-label">Hiển thị</label>
        <select class="form-select" id="cf-active">
          <option value="true" ${cat?.is_active !== false ? 'selected' : ''}>Hiện</option>
          <option value="false" ${cat?.is_active === false ? 'selected' : ''}>Ẩn</option>
        </select>
      </div>
      <div id="cat-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8">
        <button type="submit" class="btn btn-primary btn-full">${cat ? 'Cập nhật' : 'Tạo mới'}</button>
        <button type="button" class="btn btn-ghost" id="cat-cancel">Hủy</button>
      </div>
    </form>
  `, cat ? `Sửa danh mục: ${cat.name}` : 'Thêm danh mục');

  qs('#cat-cancel').onclick = closeModal;
  qs('#cat-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      name: qs('#cf-name').value,
      slug: qs('#cf-slug').value || undefined,
      icon_url: qs('#cf-icon').value || undefined,
      sort_order: parseInt(qs('#cf-order').value) || 0,
      is_active: qs('#cf-active').value === 'true',
    };
    try {
      if (cat) await apiFetch(`/categories/${cat.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/categories/', { method: 'POST', body: JSON.stringify(body) });
      closeModal();
      toast(cat ? 'Đã cập nhật' : 'Đã tạo mới', 'success');
      refresh();
    } catch (err) {
      const errEl = qs('#cat-form-err');
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  };
}

async function renderAdminProducts(view) {
  const content = qs('#admin-content');
  if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const refresh = async () => {
    const [products, cats] = await Promise.all([
      apiFetch('/products/admin/all'),
      apiFetch('/categories/all')
    ]);
    content.innerHTML = `
      <div class="page-header">
        <h1>Sản phẩm</h1>
        <button class="btn btn-primary" id="btn-add-prod">+ Thêm sản phẩm</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tên</th><th>Danh mục</th><th>Gói</th><th>Giá từ</th><th>Nổi bật</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td><b>${p.name}</b></td>
                <td class="text-muted">${p.category_name || '—'}</td>
                <td>${(p.packages || []).length} gói</td>
                <td class="text-primary">${p.min_price ? fmt(p.min_price) : '—'}</td>
                <td>${p.is_featured ? '⭐' : '—'}</td>
                <td>${p.is_active ? '<span class="badge badge-green">Hiện</span>' : '<span class="badge badge-gray">Ẩn</span>'}</td>
                <td>
                  <div class="tbl-actions">
                    <button class="tbl-btn tbl-edit" data-edit="${p.id}">Sửa</button>
                    <button class="tbl-btn tbl-view" data-pkg="${p.id}" data-pname="${encodeURIComponent(p.name)}">Gói</button>
                    <button class="tbl-btn tbl-delete" data-del="${p.id}">Xóa</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    qs('#btn-add-prod', content).onclick = () => showProductModal(null, cats, refresh);
    qsa('[data-edit]', content).forEach(btn => {
      const id = parseInt(btn.dataset.edit);
      btn.onclick = () => showProductModal(products.find(p => p.id === id), cats, refresh);
    });
    qsa('[data-pkg]', content).forEach(btn => {
      const id = parseInt(btn.dataset.pkg);
      const name = decodeURIComponent(btn.dataset.pname);
      btn.onclick = () => showPackagesModal(id, name);
    });
    qsa('[data-del]', content).forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Xóa sản phẩm này?')) return;
        await apiFetch(`/products/${btn.dataset.del}`, { method: 'DELETE' });
        toast('Đã xóa', 'success');
        refresh();
      };
    });
  };

  await refresh();
}

function showProductModal(prod, cats, refresh) {
  openModal(`
    <form id="prod-form">
      <div class="form-group">
        <label class="form-label">Tên sản phẩm<span class="required">*</span></label>
        <input class="form-input" id="pf-name" value="${prod?.name || ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Danh mục</label>
        <select class="form-select" id="pf-cat">
          <option value="">-- Không có --</option>
          ${cats.map(c => `<option value="${c.id}" ${prod?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Mô tả</label>
        <textarea class="form-textarea" id="pf-desc">${prod?.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">URL ảnh</label>
        <input class="form-input" id="pf-img" value="${prod?.image_url || ''}" placeholder="https://..." />
      </div>
      <div class="flex gap-12">
        <div class="form-group" style="flex:1">
          <label class="form-label">Thứ tự</label>
          <input type="number" class="form-input" id="pf-order" value="${prod?.sort_order ?? 0}" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Nổi bật</label>
          <select class="form-select" id="pf-featured">
            <option value="false" ${!prod?.is_featured ? 'selected' : ''}>Không</option>
            <option value="true" ${prod?.is_featured ? 'selected' : ''}>Có</option>
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Hiển thị</label>
          <select class="form-select" id="pf-active">
            <option value="true" ${prod?.is_active !== false ? 'selected' : ''}>Hiện</option>
            <option value="false" ${prod?.is_active === false ? 'selected' : ''}>Ẩn</option>
          </select>
        </div>
      </div>
      <div id="prod-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8">
        <button type="submit" class="btn btn-primary btn-full">${prod ? 'Cập nhật' : 'Tạo mới'}</button>
        <button type="button" class="btn btn-ghost" id="prod-cancel">Hủy</button>
      </div>
    </form>
  `, prod ? `Sửa: ${prod.name}` : 'Thêm sản phẩm');

  qs('#prod-cancel').onclick = closeModal;
  qs('#prod-form').onsubmit = async (e) => {
    e.preventDefault();
    const cat_id = qs('#pf-cat').value;
    const body = {
      name: qs('#pf-name').value,
      category_id: cat_id ? parseInt(cat_id) : null,
      description: qs('#pf-desc').value || null,
      image_url: qs('#pf-img').value || null,
      sort_order: parseInt(qs('#pf-order').value) || 0,
      is_featured: qs('#pf-featured').value === 'true',
      is_active: qs('#pf-active').value === 'true',
    };
    try {
      if (prod) await apiFetch(`/products/${prod.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/products/', { method: 'POST', body: JSON.stringify(body) });
      closeModal();
      toast(prod ? 'Đã cập nhật' : 'Đã tạo mới', 'success');
      refresh();
    } catch (err) {
      const errEl = qs('#prod-form-err');
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  };
}

async function showPackagesModal(productId, productName) {
  const prod = await apiFetch(`/products/admin/all`).then(ps => ps.find(p => p.id === productId));
  const packages = prod?.packages || [];

  const renderPkgList = () => packages.map(pkg => `
    <div class="package-item" style="margin-bottom:8px">
      <div class="package-item-left">
        <div class="package-item-name">${pkg.name}</div>
        <div class="package-item-desc">${pkg.delivery_type === 'auto' ? '⚡ Tự động' : '👤 Thủ công'} • Kho: ${pkg.stock_count}</div>
      </div>
      <div class="package-item-right">
        <div class="package-price">${fmt(pkg.price)}</div>
        <button class="tbl-btn tbl-delete mt-8" data-delpkg="${pkg.id}">Xóa</button>
      </div>
    </div>
  `).join('');

  openModal(`
    <div id="pkg-list">${renderPkgList()}</div>
    <div class="divider"></div>
    <div class="section-title" style="font-size:14px">Thêm gói mới</div>
    <form id="pkg-form">
      <div class="flex gap-8">
        <div class="form-group" style="flex:2">
          <label class="form-label">Tên gói</label>
          <input class="form-input" id="pkg-name" required placeholder="VD: 1 tháng, 1 năm..." />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Giá (đ)</label>
          <input type="number" class="form-input" id="pkg-price" required placeholder="50000" />
        </div>
      </div>
      <div class="flex gap-8">
        <div class="form-group" style="flex:1">
          <label class="form-label">Giao hàng</label>
          <select class="form-select" id="pkg-delivery">
            <option value="manual">Thủ công</option>
            <option value="auto">Tự động</option>
          </select>
        </div>
        <div class="form-group" style="flex:2">
          <label class="form-label">Mô tả gói</label>
          <input class="form-input" id="pkg-desc" placeholder="Mô tả ngắn..." />
        </div>
      </div>
      <button type="submit" class="btn btn-primary">+ Thêm gói</button>
    </form>
  `, `Gói sản phẩm: ${productName}`);

  const modal = qs('#modal-content');

  modal.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delpkg]');
    if (btn) {
      if (!confirm('Xóa gói này?')) return;
      await apiFetch(`/products/packages/${btn.dataset.delpkg}`, { method: 'DELETE' });
      toast('Đã xóa gói', 'success');
      const idx = packages.findIndex(p => p.id === parseInt(btn.dataset.delpkg));
      if (idx >= 0) packages.splice(idx, 1);
      qs('#pkg-list', modal).innerHTML = renderPkgList();
    }
  });

  qs('#pkg-form', modal).onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      name: qs('#pkg-name', modal).value,
      price: parseFloat(qs('#pkg-price', modal).value),
      delivery_type: qs('#pkg-delivery', modal).value,
      description: qs('#pkg-desc', modal).value || null,
    };
    try {
      const newPkg = await apiFetch(`/products/${productId}/packages`, { method: 'POST', body: JSON.stringify(body) });
      packages.push(newPkg);
      qs('#pkg-list', modal).innerHTML = renderPkgList();
      e.target.reset();
      toast('Đã thêm gói', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

async function renderAdminOrders(view) {
  const content = qs('#admin-content');
  if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const refresh = async (status = '') => {
    const data = await apiFetch(`/orders/admin/all${status ? '?status=' + status : ''}&limit=50`);
    content.innerHTML = `
      <div class="page-header"><h1>Đơn hàng</h1></div>
      <div class="flex gap-8 mb-16" style="flex-wrap:wrap">
        ${['', 'pending', 'paid', 'processing', 'completed', 'cancelled'].map(s => `
          <button class="btn btn-sm ${status === s ? 'btn-primary' : 'btn-ghost'}" data-filter="${s}">
            ${s || 'Tất cả'}
          </button>
        `).join('')}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead>
          <tbody>
            ${data.items.map(o => `
              <tr>
                <td class="font-mono">${o.order_code}</td>
                <td class="text-sm">${o.user_email || '—'}</td>
                <td class="text-sm">${o.product_name || '—'} — ${o.package_name || '—'}</td>
                <td class="text-primary">${fmt(o.total_amount)}</td>
                <td>${statusBadge(o.status)}</td>
                <td class="text-sm text-muted">${fmtDate(o.created_at)}</td>
                <td>
                  <div class="tbl-actions">
                    ${o.status !== 'completed' ? `<button class="tbl-btn tbl-edit" data-deliver="${o.id}">Giao hàng</button>` : ''}
                    <button class="tbl-btn tbl-view" data-view-order="${o.id}" data-order-data="${encodeURIComponent(JSON.stringify(o))}">Xem</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    qsa('[data-filter]', content).forEach(btn => {
      btn.onclick = () => refresh(btn.dataset.filter);
    });

    qsa('[data-deliver]', content).forEach(btn => {
      const id = parseInt(btn.dataset.deliver);
      btn.onclick = () => showDeliverModal(id, refresh.bind(null, status));
    });

    qsa('[data-view-order]', content).forEach(btn => {
      const order = JSON.parse(decodeURIComponent(btn.dataset.orderData));
      btn.onclick = () => openModal(`
        <div class="order-info" style="margin-top:0">
          ${Object.entries({
            'Mã đơn': order.order_code,
            'Khách hàng': order.user_email,
            'Sản phẩm': order.product_name,
            'Gói': order.package_name,
            'Số tiền': fmt(order.total_amount),
            'Trạng thái': order.status,
            'Ngày tạo': fmtDate(order.created_at),
          }).map(([k, v]) => `
            <div class="order-info-item">
              <div class="order-info-label">${k}</div>
              <div class="order-info-value">${v || '—'}</div>
            </div>
          `).join('')}
        </div>
        ${order.delivery_data ? `
          <div class="delivery-box mt-12">
            <div class="delivery-box-title">Dữ liệu giao</div>
            <div class="delivery-data">${order.delivery_data}</div>
          </div>
        ` : ''}
      `, `Chi tiết đơn: ${order.order_code}`);
    });
  };

  await refresh();
}

function showDeliverModal(orderId, refresh) {
  openModal(`
    <form id="deliver-form">
      <div class="form-group">
        <label class="form-label">Dữ liệu giao hàng<span class="required">*</span></label>
        <textarea class="form-textarea" id="deliver-data" rows="6" placeholder="username: ...\npassword: ...\n" required></textarea>
        <div class="form-hint">Nhập thông tin tài khoản, key hoặc dữ liệu cần giao cho khách</div>
      </div>
      <div class="form-group">
        <label class="form-label">Ghi chú (tùy chọn)</label>
        <input class="form-input" id="deliver-note" placeholder="Hướng dẫn sử dụng..." />
      </div>
      <div id="deliver-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8">
        <button type="submit" class="btn btn-green btn-full">✓ Xác nhận giao hàng</button>
        <button type="button" class="btn btn-ghost" id="deliver-cancel">Hủy</button>
      </div>
    </form>
  `, 'Giao hàng thủ công');

  qs('#deliver-cancel').onclick = closeModal;
  qs('#deliver-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/orders/admin/${orderId}/deliver`, {
        method: 'PUT',
        body: JSON.stringify({
          delivery_data: qs('#deliver-data').value,
          notes: qs('#deliver-note').value || null,
        })
      });
      closeModal();
      toast('Đã giao hàng thành công!', 'success');
      refresh();
    } catch (err) {
      const errEl = qs('#deliver-err');
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  };
}

async function renderAdminStock(view) {
  const content = qs('#admin-content');
  if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const products = await apiFetch('/products/admin/all');
  const autoProducts = products.filter(p => p.packages?.some(pkg => pkg.delivery_type === 'auto'));

  content.innerHTML = `
    <div class="page-header"><h1>Kho hàng tự động</h1></div>
    <div class="flex gap-16" style="align-items:flex-start;flex-wrap:wrap">
      <div style="flex:1;min-width:260px">
        <div class="section-title" style="font-size:15px">Chọn gói để xem / thêm kho</div>
        ${autoProducts.length ? autoProducts.map(p => `
          <div class="card mb-8" style="padding:14px">
            <div class="fw-bold mb-8">${p.name}</div>
            ${p.packages.filter(pkg => pkg.delivery_type === 'auto').map(pkg => `
              <button class="btn btn-ghost btn-sm mb-4 btn-full" data-viewstock="${pkg.id}" data-pkgname="${encodeURIComponent(pkg.name)}">
                ${pkg.name} — Kho: ${pkg.stock_count}
              </button>
            `).join('')}
          </div>
        `).join('') : '<p class="text-muted">Chưa có gói giao tự động nào.</p>'}
      </div>
      <div style="flex:2;min-width:300px" id="stock-detail">
        <div class="empty-state"><div class="empty-state-icon">📦</div><h3>Chọn gói để xem kho</h3></div>
      </div>
    </div>
  `;

  qsa('[data-viewstock]', content).forEach(btn => {
    const pkgId = parseInt(btn.dataset.viewstock);
    const pkgName = decodeURIComponent(btn.dataset.pkgname);
    btn.onclick = () => showStockDetail(pkgId, pkgName);
  });
}

async function showStockDetail(pkgId, pkgName) {
  const detail = qs('#stock-detail');
  detail.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const refresh = async () => {
    const items = await apiFetch(`/stock/package/${pkgId}?sold=false`);
    detail.innerHTML = `
      <div class="section-title" style="font-size:15px">${pkgName} — ${items.length} mục có sẵn</div>
      <div class="card" style="padding:16px;margin-bottom:16px">
        <div class="form-group">
          <label class="form-label">Thêm hàng loạt (mỗi dòng 1 item)</label>
          <textarea class="form-textarea" id="bulk-stock" rows="6" placeholder="account1@gmail.com:password1&#10;account2@gmail.com:password2&#10;..."></textarea>
        </div>
        <button class="btn btn-primary" id="btn-add-bulk">+ Thêm ${pkgName}</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Dữ liệu</th><th>Ngày thêm</th><th></th></tr></thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td class="font-mono text-sm">${i.data}</td>
                <td class="text-sm text-muted">${fmtDate(i.created_at)}</td>
                <td><button class="tbl-btn tbl-delete" data-del-stock="${i.id}">Xóa</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    qs('#btn-add-bulk', detail).onclick = async () => {
      const txt = qs('#bulk-stock', detail).value.trim();
      if (!txt) return;
      const res = await apiFetch('/stock/bulk', {
        method: 'POST',
        body: JSON.stringify({ package_id: pkgId, items: txt })
      });
      toast(`Đã thêm ${res.added} mục`, 'success');
      refresh();
    };

    qsa('[data-del-stock]', detail).forEach(btn => {
      btn.onclick = async () => {
        await apiFetch(`/stock/${btn.dataset.delStock}`, { method: 'DELETE' });
        toast('Đã xóa', 'success');
        refresh();
      };
    });
  };

  await refresh();
}

async function renderAdminSettings(view) {
  const content = qs('#admin-content');
  if (!content) return;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const settings = await apiFetch('/admin/settings');

  content.innerHTML = `
    <div class="page-header"><h1>Cài đặt</h1></div>
    <div class="card" style="padding:24px;max-width:600px">
      <form id="settings-form">
        <div class="form-group">
          <label class="form-label">Tên website</label>
          <input class="form-input" id="s-name" value="${settings.site_name || ''}" placeholder="ShopKey" />
        </div>
        <div class="form-group">
          <label class="form-label">Mô tả website</label>
          <input class="form-input" id="s-desc" value="${settings.site_description || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">URL Logo</label>
          <input class="form-input" id="s-logo" value="${settings.site_logo || ''}" placeholder="https://..." />
        </div>
        <div class="form-group">
          <label class="form-label">Đơn vị tiền tệ</label>
          <select class="form-select" id="s-currency">
            <option value="VND" ${settings.currency === 'VND' ? 'selected' : ''}>VND — Việt Nam Đồng</option>
            <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD — US Dollar</option>
          </select>
        </div>
        <div class="divider"></div>
        <div class="section-title" style="font-size:14px;margin-bottom:12px">Cấu hình Admin</div>
        <div class="form-group">
          <label class="form-label">Tạo tài khoản admin</label>
          <div class="flex gap-8">
            <input class="form-input" id="admin-uid" placeholder="User ID (từ Neon Auth)" />
            <input class="form-input" id="admin-email" placeholder="Email admin" />
            <input class="form-input" id="admin-secret" placeholder="Secret key" type="password" />
          </div>
          <button type="button" class="btn btn-ghost btn-sm mt-8" id="btn-make-admin">Cấp quyền Admin</button>
        </div>
        <div id="settings-msg" class="form-hint" style="display:none"></div>
        <button type="submit" class="btn btn-primary mt-16">Lưu cài đặt</button>
      </form>
    </div>
  `;

  qs('#btn-make-admin', content).onclick = async () => {
    const uid = qs('#admin-uid', content).value.trim();
    const email = qs('#admin-email', content).value.trim();
    const secret = qs('#admin-secret', content).value;
    if (!uid || !email || !secret) { toast('Điền đủ thông tin', 'error'); return; }
    try {
      const res = await apiFetch('/auth/make-admin', {
        method: 'POST',
        body: JSON.stringify({ user_id: uid, email, secret })
      });
      toast(res.message, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  qs('#settings-form', content).onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      site_name: qs('#s-name', content).value,
      site_description: qs('#s-desc', content).value,
      site_logo: qs('#s-logo', content).value,
      currency: qs('#s-currency', content).value,
    };
    try {
      await apiFetch('/admin/settings', { method: 'POST', body: JSON.stringify(body) });
      toast('Đã lưu cài đặt', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  loadToken();
  await fetchMe();
  updateAuthUI();
  updateCartCount();
  await loadSidebar();

  // Route
  window.addEventListener('hashchange', navigate);
  await navigate();

  // Header events
  const userMenuBtn = qs('#user-menu-btn');
  const dropdown = qs('#user-dropdown');
  if (userMenuBtn && dropdown) {
    userMenuBtn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }

  qs('#btn-logout')?.addEventListener('click', () => {
    saveToken(null);
    currentUser = null;
    updateAuthUI();
    toast('Đã đăng xuất', 'info');
    location.hash = '/';
  });

  // Search
  const doSearch = () => {
    const q = (qs('#search-input')?.value || '').trim();
    if (q) { location.hash = `/search?q=${encodeURIComponent(q)}`; }
  };
  qs('#search-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

  // Hamburger — toggle sidebar + overlay
  const sidebar = qs('#sidebar');
  const overlay = qs('#sidebar-overlay');
  qs('#hamburger')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  });

  // Modal close
  qs('#modal-close')?.addEventListener('click', closeModal);
  qs('#modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === qs('#modal-overlay')) closeModal();
  });
}

init();
