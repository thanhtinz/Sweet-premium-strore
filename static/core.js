/* ═══════════════════════════════════════════════════════════════
   ShopKey — Main SPA Application
   Stack: Vanilla JS, FastAPI backend, Neon Auth
   DashStack-inspired UI
═══════════════════════════════════════════════════════════════ */

// ── Config ─────────────────────────────────────────────────────
const API = '/api';
const ADMIN_DEBUG = true;
window.ADMIN_DEBUG = ADMIN_DEBUG;

// ── State ──────────────────────────────────────────────────────
let currentUser = null;
let authToken = null;
let categories = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let cartCoupon = JSON.parse(localStorage.getItem('cart_coupon') || 'null');

let appSettings = {};

// ── Utilities ──────────────────────────────────────────────────
const fmt = (n) => {
  const icon = window.appSettings?.currency_icon;
  const name = window.appSettings?.currency_name;
  let currencySuffix = '';
  
  if (icon) {
    currencySuffix = ` <img src="${icon}" class="currency-icon" alt="currency" />`;
  } else if (name) {
    currencySuffix = ` ${name}`;
  } else {
    // Default fallback
    currencySuffix = ` <img src="/static/candy-icon.png" class="currency-icon" alt="candy" />`;
  }
  
  return new Intl.NumberFormat('vi-VN').format(n) + currencySuffix;
};
const fmtDate = (s) => s ? new Date(s).toLocaleString('vi-VN') : '—';
const esc = (s) => { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
const qs = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => [...el.querySelectorAll(s)];
const el = (tag, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const getDefaultImageUrl = () => window.defaultImageUrl || window.appSettings?.default_image_url || '';
const getDefaultAvatarUrl = () => window.defaultAvatarUrl || window.appSettings?.default_avatar_url || '';
const withImageFallback = (url) => url || getDefaultImageUrl() || '';
const withAvatarFallback = (url) => url || getDefaultAvatarUrl() || '';
const onImgFallback = (type = 'image') => {
  const fallback = type === 'avatar' ? getDefaultAvatarUrl() : getDefaultImageUrl();
  if (!fallback) return "this.onerror=null;this.style.display='none';";
  const safeFallback = String(fallback)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '');
  return `this.onerror=null;this.src='${safeFallback}';`;
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
  const isGET = (!options.method || options.method === 'GET');

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  // Proxy blocks DELETE/PUT — convert DELETE to POST {path}/delete
  let actualPath = path;
  let actualOptions = { ...options, headers };
  if ((options.method || '').toUpperCase() === 'DELETE') {
    actualPath = path + '/delete';
    actualOptions.method = 'POST';
  }

  if (ADMIN_DEBUG && location.hash.startsWith('#/admin') && !isGET) {
    adminDebugLog('apiFetch request', { path, actualPath, method: actualOptions.method || 'GET' });
  }
  
  const res = await fetch(`${API}${actualPath}`, actualOptions);
  if (!res.ok) {
    let err = `HTTP ${res.status}`;
    try { const j = await res.json(); err = j.detail || err; } catch (_) {}
    if (ADMIN_DEBUG && location.hash.startsWith('#/admin')) {
      adminDebugLog('apiFetch error', { path, actualPath, method: actualOptions.method || 'GET', error: err });
    }
    throw new Error(err);
  }
  
  const data = await res.json();
  if (ADMIN_DEBUG && location.hash.startsWith('#/admin') && !isGET) {
    adminDebugLog('apiFetch success', { path, actualPath, method: actualOptions.method || 'GET' });
  }
  return data;
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
  const dropdownBalance = qs('#dropdown-balance');
  const userAvatar = qs('#user-avatar');
  const renderAvatar = () => {
    if (!userAvatar) return;
    if (currentUser) {
      const name = currentUser.display_name || currentUser.email?.split('@')[0] || 'User';
      const avatarUrl = withAvatarFallback(currentUser.avatar_url);
      if (avatarUrl) {
        userAvatar.parentElement?.classList.add('has-image');
        userAvatar.innerHTML = `<img src="${avatarUrl}" alt="" onerror="${onImgFallback('avatar')}" style="width:100%;height:100%;border-radius:10px;object-fit:cover" />`;
      } else {
        userAvatar.parentElement?.classList.remove('has-image');
        userAvatar.textContent = name.charAt(0).toUpperCase();
      }
    } else {
      userAvatar.parentElement?.classList.remove('has-image');
      userAvatar.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c1.8-4 4.4-6 8-6s6.2 2 8 6"/><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>';
    }
  };

  if (currentUser) {
    if (loggedIn) loggedIn.style.display = '';
    if (loggedOut) loggedOut.style.display = 'none';
    const name = currentUser.display_name || currentUser.email?.split('@')[0] || 'User';
    const email = currentUser.email || '';
    if (dropdownName) dropdownName.textContent = name;
    if (dropdownEmail) dropdownEmail.textContent = email;
    if (dropdownBalance) {
      const bal = currentUser.balance || 0;
      dropdownBalance.innerHTML = `Số dư: ${bal.toLocaleString('vi-VN')} <img src="/static/candy-icon.png" class="currency-icon" alt="candy" />`;
    }
    renderAvatar();
    if (dropdownAdmin) dropdownAdmin.style.display = currentUser.is_admin ? 'flex' : 'none';
  } else {
    if (loggedIn) loggedIn.style.display = 'none';
    if (loggedOut) loggedOut.style.display = '';
    renderAvatar();
  }
}

// ── Cart ───────────────────────────────────────────────────────
function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  if (cartCoupon) localStorage.setItem('cart_coupon', JSON.stringify(cartCoupon));
  else localStorage.removeItem('cart_coupon');
  updateCartCount();
}
function updateCartCount() {
  const badge = qs('#cart-count');
  if (!badge) return;
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}
function addToCart(product, pkg, quantity = 1, fields = {}, coupon = null) {
  const price = pkg.flash_sale ? pkg.flash_sale.sale_price : pkg.price;
  const existing = cart.find(i => i.pkg_id === pkg.id);
  if (existing) {
    existing.quantity += quantity;
    existing.fields = fields || existing.fields || {};
  } else {
    cart.push({ pkg_id: pkg.id, pkg_name: pkg.name, pkg_price: price, product_name: product.name, product_slug: product.slug, product_img: product.image_url, delivery_type: pkg.delivery_type, quantity, fields });
  }
  if (coupon?.code) cartCoupon = { code: coupon.code, discount: coupon.discount, final_amount: coupon.final_amount };
  saveCart();
  toast(`Đã thêm <b>${esc(product.name)}</b> — ${esc(pkg.name)} vào giỏ hàng`, 'success');
}
function clearCart() {
  cart.length = 0;
  cartCoupon = null;
  saveCart();
}

function removeFromCart(pkg_id) {
  const newCart = cart.filter(i => i.pkg_id !== pkg_id);
  cart.length = 0;
  cart.push(...newCart);
  saveCart();
}
function cartTotal() { return cart.reduce((s, i) => s + i.pkg_price * i.quantity, 0); }
function cartDiscountTotal() {
  return cartCoupon?.discount || 0;
}
function cartGrandTotal() {
  const subtotal = cartTotal();
  const discount = Math.min(cartDiscountTotal(), subtotal);
  const taxRate = parseFloat(appSettings.tax_rate) || 0;
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round((taxable * taxRate) / 100);
  return { subtotal, discount, taxRate, taxAmount, grandTotal: taxable + taxAmount };
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(html, title = '') {
  if (window.syncRichTextEditors) window.syncRichTextEditors();
  const overlay = qs('#modal-overlay');
  const content = qs('#modal-content');
  const titleEl = qs('#modal-title');
  if (titleEl) titleEl.textContent = title;
  content.innerHTML = html;
  overlay.style.display = 'flex';
}
function closeModal() {
  if (window.syncRichTextEditors) window.syncRichTextEditors();
  const overlay = qs('#modal-overlay');
  if (!overlay) return;
  overlay.style.display = 'none';
  const content = qs('#modal-content');
  if (content) content.innerHTML = '';
}

function adminDebugLog(label, payload = null) {
  if (!ADMIN_DEBUG) return;
  const prefix = `[admin-debug] ${label}`;
  if (payload === null || payload === undefined) {
    console.log(prefix);
    return;
  }
  console.log(prefix, payload);
  try {
    window.__adminDebugEvents = window.__adminDebugEvents || [];
    window.__adminDebugEvents.push({
      ts: new Date().toISOString(),
      label,
      payload,
    });
    if (window.__adminDebugEvents.length > 200) {
      window.__adminDebugEvents.shift();
    }
  } catch (_) {}
}

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
