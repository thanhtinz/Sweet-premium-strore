
// ── Router ─────────────────────────────────────────────────────
const routes = {
  '/': renderHome,
  '/all': renderAllProducts,
  '/category/:slug': (view, { slug }) => { location.hash = `/all?cat=${slug}`; },
  '/product/:slug': renderProduct,
  '/cart': renderCart,
  '/offers': renderOffers,
  '/wishlist': renderWishlist,
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
  '/admin/announcements': renderAdminAnnouncements,
  '/admin/tickets': renderAdminTickets,
  '/admin/bot-config': renderAdminBotConfig,
  '/admin/payments': renderAdminPayments,
  '/admin/balance': renderAdminBalance,
  '/blog': renderBlogList,
  '/blog/:slug': renderBlogPost,
  '/profile': renderProfile,
  '/affiliate': renderUserAffiliates,
  '/support': renderSupportHome,
  '/support/tickets': renderUserTickets,
  '/support/tickets/:ticketId': (view, { ticketId }) => renderTicketDetail(ticketId),
  '/support/:slug': (view, { slug }) => renderSupportPage(slug),
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
  
  // Safety: if #app-view was destroyed (e.g. by a bad render), recreate it
  if (!view) {
    const main = qs('.main-content');
    if (main) {
      main.innerHTML = '<div id="app-view"></div>';
      view = qs('#app-view');
    } else return;
  }
  
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

  // Feature gate: check if route's feature is disabled
  const featureRouteMap = {
    '/blog': 'blog', '/blog/': 'blog',
    '/offers': 'offers',
    '/affiliate': 'affiliate',
    '/support': 'support', '/support/': 'support',
    '/wishlist': 'wishlist',
  };
  const path = hash.replace(/^#/, '').split('?')[0] || '/';
  const matchedFeature = Object.entries(featureRouteMap).find(([r]) => path === r || path.startsWith(r + '/'))?.[1];
  if (matchedFeature && appSettings.features?.[matchedFeature] === false) {
    view.innerHTML = '<div class="empty-state" style="padding:60px 20px;"><div class="empty-state-icon"><i class="fa-solid fa-toggle-off" style="font-size:48px;color:var(--text-muted);opacity:0.3;"></i></div><h3>Chức năng tạm ngưng</h3><p class="text-muted">Chức năng này hiện đang tắt. Vui lòng quay lại sau.</p><a href="#/" class="btn btn-primary mt-12">Về trang chủ</a></div>';
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
    if (currentUser && appSettings.features?.wishlist !== false) {
      const wlItem = el('a', 'nav-item' + (location.hash === '#/wishlist' ? ' active' : ''));
      wlItem.href = '#/wishlist';
      wlItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-heart" style="color:#ef4444;font-size:16px;"></i></div><span>Yêu thích</span>';
      nav.appendChild(wlItem);
    }
    categories.forEach(cat => {
      const item = el('a', 'nav-item');
      item.href = `#/all?cat=${cat.slug}`;
      const iconUrl = cat.image_url || cat.icon_url;
      const icon = iconUrl ? `<img src="${iconUrl}" alt="" style="width:18px;height:18px;object-fit:contain;border-radius:2px;" />` : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
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
    if (appSettings.features?.offers !== false) nav.appendChild(offersItem);

    const supportItem = el('a', 'nav-item' + (location.hash.startsWith('#/support') ? ' active' : ''));
    supportItem.href = '#/support';
    supportItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-headset"></i></div><span>Hỗ trợ</span>';
    if (appSettings.features?.support !== false) nav.appendChild(supportItem);

    const blogItem = el('a', 'nav-item' + (location.hash === '#/blog' ? ' active' : ''));
    blogItem.href = '#/blog';
    blogItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-newspaper"></i></div><span>Blog</span>';
    if (appSettings.features?.blog !== false) nav.appendChild(blogItem);

    if (currentUser) {
      if (appSettings.features?.affiliate !== false) {
        const affItem = el('a', 'nav-item' + (location.hash === '#/affiliate' ? ' active' : ''));
        affItem.href = '#/affiliate';
        affItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-user-group"></i></div><span>Giới thiệu bạn bè</span>';
        nav.appendChild(affItem);
      }
    }
  } catch (_) {}
}


// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
async function init() {
  loadToken();

  // Capture affiliate ref code from URL (?ref=CODE)
  try {
    const urlParams = new URLSearchParams(location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('aff_ref_code', refCode);
      // Clean URL without reloading
      const cleanUrl = new URL(location);
      cleanUrl.searchParams.delete('ref');
      history.replaceState(null, '', cleanUrl);
    }
  } catch (_) {}
  await fetchMe();
  updateAuthUI();
  updateCartCount();

  // Load wishlist IDs for logged-in user
  if (currentUser) {
    try {
      const ids = await apiFetch('/wishlist/ids');
      window._wishlistIds = new Set(ids);
    } catch (_) { window._wishlistIds = new Set(); }
  } else {
    window._wishlistIds = new Set();
  }
  
  // Set current year in footer
  const yearEl = document.getElementById('f-current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  try {
    appSettings = await apiFetch('/admin/settings/public').catch(() => ({}));
    
    // Update site name / logo in header and footer
    const logoUrl = appSettings.logo_url || appSettings.site_logo;
    if (appSettings.site_name) {
      document.title = appSettings.site_name;
    }
    // Header logo-link: show logo image or site name text
    const logoLink = qs('#logo-link');
    if (logoLink) {
      if (logoUrl) {
        logoLink.innerHTML = `<img src="${logoUrl}" alt="${appSettings.site_name || 'Logo'}" style="height: 28px; width: auto; object-fit: contain;">`;
      } else if (appSettings.site_name) {
        const logoText = logoLink.querySelector('.logo-text');
        if (logoText) logoText.textContent = appSettings.site_name;
      }
    }
    // Footer site name: show logo image or text
    const fSiteName = qs('#f-site-name');
    if (fSiteName) {
      if (logoUrl) {
        fSiteName.innerHTML = `<img src="${logoUrl}" alt="${appSettings.site_name || 'Logo'}" style="height: 24px; width: auto; object-fit: contain; vertical-align: middle;">`;
      } else {
        fSiteName.textContent = appSettings.site_name || 'ShopKey';
      }
    }
    // Footer copyright text
    const fSiteCopy = qs('#f-site-copy');
    if (fSiteCopy) {
      fSiteCopy.innerHTML = appSettings.copyright_text || `Copyright © ${new Date().getFullYear()} ${appSettings.site_name || 'ShopKey'}. All rights reserved.`;
    }
    // Footer description
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
