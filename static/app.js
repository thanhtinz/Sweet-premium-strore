
// ── Router ─────────────────────────────────────────────────────
const routes = {
  '/': renderHome,
  '/all': renderAllProducts,
  '/category/:slug': (view, { slug }) => { location.hash = `/all?cat=${slug}`; },
  '/product/:slug': renderProduct,
  '/cart': renderCart,
  '/offers': renderOffers,
  '/checkout': renderCheckout,
  '/orders': renderOrders,
  '/orders/:code': renderOrderDetail,
  '/search': (view, params) => {
    const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
    location.hash = `/all?q=${encodeURIComponent(q)}`;
  },
  '/login': renderLogin,
  '/register': renderRegister,
  '/auth-callback': renderAuthCallback,
  '/admin': renderAdmin,
  '/admin/categories': renderAdminCategories,
  '/admin/products': renderAdminProducts,
  '/admin/orders': renderAdminOrders,
  '/admin/stock': renderAdminStock,
  '/admin/settings': renderAdminSettings,
  '/admin/oauth-settings': renderAdminOAuthSettings,
  '/admin/banners': renderAdminBanners,
  '/admin/flash-sales': renderAdminFlashSales,
  '/admin/gift-codes': renderAdminGiftCodes,
  '/admin/affiliates': renderAdminAffiliates,
  '/admin/blog': renderAdminBlog,
  '/admin/support-pages': renderAdminSupportPages,
  '/admin/tickets': renderAdminTickets,
  '/blog': renderBlogList,
  '/blog/:slug': renderBlogPost,
  '/profile': renderProfile,
  '/support': renderSupportHome,
  '/support/:slug': (view, { slug }) => renderSupportPage(slug),
  '/support/tickets/:ticketId': (view, { ticketId }) => renderTicketDetail(ticketId),
  '/support/tickets': renderUserTickets,
};

function parseRoute(hash) {
  const path = hash.replace(/^#/, '').split('?')[0] || '/';
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
  let view = qs('#app-view');
  
  // Clone to detach any pending async appends from previous route
  const newView = view.cloneNode(false);
  view.parentNode.replaceChild(newView, view);
  view = newView;

  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  closeSidebar();

  // Update sidebar active
  qsa('#sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
  const route = parseRoute(hash);

  // Admin layout switch
  const isAdmin = hash.startsWith('#/admin');
  const appShell = qs('#app-shell');
  const sidebar = qs('#sidebar');
  const footer = qs('#site-footer');
  
  if (footer) footer.style.display = isAdmin ? 'none' : 'block';
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
    nav.innerHTML = '<div class="sidebar-section-title">Danh mục</div>';
    const allItem = el('a', 'nav-item' + (location.hash === '#/' || !location.hash ? ' active' : ''));
    allItem.href = '#/';
    allItem.innerHTML = '<div class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div><span>Tất cả</span>';
    nav.appendChild(allItem);
    categories.forEach(cat => {
      const item = el('a', 'nav-item');
      item.href = `#/all?cat=${cat.slug}`;
      const icon = cat.icon_url ? `<img src="${cat.icon_url}" alt="" style="width:18px;height:18px;object-fit:contain" />` : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
      item.innerHTML = `<div class="nav-icon">${icon}</div><span>${cat.name}</span>`;
      nav.appendChild(item);
    });

    // ── Offers & Blog link ──
    const divider = el('div', 'sidebar-divider');
    nav.appendChild(divider);
    nav.appendChild(el('div', 'sidebar-section-title', 'Khác'));
    
    const offersItem = el('a', 'nav-item' + (location.hash === '#/offers' ? ' active' : ''));
    offersItem.href = '#/offers';
    offersItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-gift"></i></div><span>Ưu đãi</span>';
    nav.appendChild(offersItem);

    const supportItem = el('a', 'nav-item' + (location.hash.startsWith('#/support') ? ' active' : ''));
    supportItem.href = '#/support';
    supportItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-headset"></i></div><span>Hỗ trợ</span>';
    nav.appendChild(supportItem);

    const blogItem = el('a', 'nav-item' + (location.hash === '#/blog' ? ' active' : ''));
    blogItem.href = '#/blog';
    blogItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-newspaper"></i></div><span>Blog</span>';
    nav.appendChild(blogItem);
  } catch (_) {}
}


// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
async function init() {
  loadToken();
  await fetchMe();
  updateAuthUI();
  updateCartCount();
  
  // Set current year in footer
  const yearEl = document.getElementById('f-current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  try {
    appSettings = await apiFetch('/admin/settings/public').catch(() => ({}));
    
    // Update footer with settings
    if (appSettings.site_name) {
      document.title = appSettings.site_name;
      const n1 = qs('#f-site-name'); if (n1) n1.textContent = appSettings.site_name;
      const n2 = qs('#f-site-copy'); if (n2) n2.textContent = appSettings.site_name;
    }
    if (appSettings.site_description) {
      const desc = qs('#f-site-desc');
      if (desc) desc.textContent = appSettings.site_description;
    }
  } catch (e) {}

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
  const doSearch = () => { const q = (qs('#search-input')?.value || '').trim(); if (q) location.hash = `/all?q=${encodeURIComponent(q)}`; };
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
