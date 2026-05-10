
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
  '/admin/api-keys': renderAdminApiKeys,
  '/blog': renderBlogList,
  '/blog/:slug': renderBlogPost,
  '/profile': renderProfile,
  '/api-docs': renderApiDocs,
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

let currentNavMode = null;
const STAFF_ALLOWED_ADMIN_ROUTES = new Set(['/admin', '/admin/orders', '/admin/blog', '/admin/tickets', '/admin/announcements']);

const adminHeaderMeta = {
  '/admin': { title: 'Dashboard', subtitle: 'Tổng quan vận hành cửa hàng' },
  '/admin/orders': { title: 'Đơn hàng', subtitle: 'Theo dõi và xử lý đơn mua hàng' },
  '/admin/payments': { title: 'Thanh toán', subtitle: 'Kiểm tra giao dịch và cấu hình thanh toán' },
  '/admin/balance': { title: 'Quản lý user', subtitle: 'Quản lý tài khoản, vai trò và số dư người dùng' },
  '/admin/categories': { title: 'Danh mục', subtitle: 'Tổ chức nhóm sản phẩm và điều hướng' },
  '/admin/products': { title: 'Sản phẩm', subtitle: 'Quản lý sản phẩm, gói bán và nội dung hiển thị' },
  '/admin/stock': { title: 'Kho hàng', subtitle: 'Theo dõi tồn kho và dữ liệu giao tự động' },
  '/admin/banners': { title: 'Banners', subtitle: 'Điều phối banner và điểm nhấn marketing' },
  '/admin/flash-sales': { title: 'Flash Sales', subtitle: 'Thiết lập chiến dịch giảm giá nhanh' },
  '/admin/gift-codes': { title: 'Mã quà tặng', subtitle: 'Quản lý gift code và phân phối ưu đãi' },
  '/admin/affiliates': { title: 'Affiliates', subtitle: 'Theo dõi cộng tác viên và hoa hồng' },
  '/admin/blog': { title: 'Blog', subtitle: 'Biên tập bài viết và danh mục nội dung' },
  '/admin/tickets': { title: 'Hỗ trợ', subtitle: 'Xử lý ticket và phản hồi khách hàng' },
  '/admin/support-pages': { title: 'Trang thông tin', subtitle: 'Quản lý FAQ, chính sách và nội dung hỗ trợ' },
  '/admin/announcements': { title: 'Thông báo', subtitle: 'Đăng và quản lý thông báo hệ thống' },
  '/admin/oauth-settings': { title: 'Đăng nhập MXH', subtitle: 'Cấu hình OAuth và nhà cung cấp đăng nhập' },
  '/admin/settings': { title: 'Cài đặt chung', subtitle: 'Thiết lập hệ thống, giao diện và tính năng' },
      '/admin/bot-config': { title: 'Quản lý bot', subtitle: 'Cấu hình Telegram, Discord và mail hệ thống' },
};

function updateHeaderMode(hash, isAdmin) {
  const header = qs('#header');
  const store = qs('#header-store');
  const storeActions = qs('#header-store-actions');
  const admin = qs('#header-admin');
  const adminActions = qs('#header-admin-actions');
  const bcCurrent = qs('#admin-header-bc-current');
  const hamburger = qs('#hamburger');
  if (!header) return;

  header.classList.toggle('admin-mode', isAdmin);
  document.body.classList.toggle('admin-mode', isAdmin);
  qs('.main-content')?.classList.toggle('admin-main', isAdmin);
  if (store) store.style.display = isAdmin ? 'none' : '';
  if (storeActions) storeActions.style.display = isAdmin ? 'none' : 'flex';
  if (admin) admin.style.display = isAdmin ? 'flex' : 'none';
  if (adminActions) adminActions.style.display = isAdmin ? 'flex' : 'none';
  if (hamburger) hamburger.style.display = window.innerWidth <= 1024 ? 'flex' : 'none';

  if (isAdmin) {
    const path = hash.replace(/^#/, '').split('?')[0] || '/admin';
    const meta = adminHeaderMeta[path] || adminHeaderMeta['/admin'];
    if (bcCurrent) bcCurrent.textContent = meta.title;
  }
}

function setActiveSidebarItem(hash) {
  qsa('#sidebar-nav .nav-item').forEach((n) => {
    const href = n.getAttribute('href');
    const isActive = href === hash || (href !== '#/' && hash.startsWith(`${href}/`));
    n.classList.toggle('active', !!isActive);
  });
}

async function navigate() {
  const hash = location.hash || '#/';
  const route = parseRoute(hash);
  let view = qs('#app-view');
  if (!view) return;

  const isAdmin = hash.startsWith('#/admin');
  updateHeaderMode(hash, isAdmin);

  const footer = qs('#site-footer');
  if (footer) footer.style.display = isAdmin ? 'none' : 'block';

  view.style.minHeight = '60vh';

  if (!route) {
    // Full-page 404 — hide header, sidebar, footer
    const header = qs('.header'); if (header) header.style.display = 'none';
    const sidebar = qs('.sidebar'); if (sidebar) sidebar.style.display = 'none';
    const footer = qs('#site-footer'); if (footer) footer.style.display = 'none';
    const appShell = qs('.app-shell'); if (appShell) appShell.style.marginLeft = '0';
    view.style.minHeight = '100vh';
    view.innerHTML = `
      <div class="page-404">
        <div class="page-404-inner">
          <div class="page-404-visual">
            <span class="page-404-num">404</span>
            <img src="/static/404-rem.gif" alt="404" class="page-404-gif" />
          </div>
          <h1 class="page-404-title">Oops! Lạc đường rồi~</h1>
          <p class="page-404-desc">Rem đã tìm khắp nơi nhưng không thấy trang này đâu...<br>Có thể trang đã bị xóa hoặc bạn nhập sai đường dẫn.</p>
          <a href="#/" class="page-404-btn" onclick="location.reload()"><i class="fa-solid fa-house"></i> Về trang chủ</a>
        </div>
      </div>`;
    // anime.js entrance animations
    if (typeof anime !== 'undefined' && anime.animate) {
      anime.animate('.page-404-num', { opacity: [0, 1], scale: [0.5, 1], duration: 800, ease: 'outExpo' });
      anime.animate('.page-404-gif', { opacity: [0, 1], translateY: [40, 0], duration: 900, ease: 'outElastic(1, 0.6)', delay: 200,
        onComplete: () => { anime.animate('.page-404-gif', { translateY: [-8, 8], duration: 2000, ease: 'inOutSine', loop: true, alternate: true }); }
      });
      anime.animate('.page-404-title', { opacity: [0, 1], translateY: [30, 0], duration: 700, ease: 'outExpo', delay: 400 });
      anime.animate('.page-404-desc', { opacity: [0, 1], translateY: [20, 0], duration: 700, ease: 'outExpo', delay: 550 });
      anime.animate('.page-404-btn', { opacity: [0, 1], translateY: [20, 0], scale: [0.9, 1], duration: 600, ease: 'outExpo', delay: 700 });
    }
    return;
  }

  if (isAdmin && (!currentUser || !currentUser.is_admin)) {
    view.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-3)">Bạn không có quyền truy cập Admin Panel.<br><a href="#/" style="color:var(--primary)">Quay về trang chủ</a></div>';
    return;
  }

  const adminPath = hash.replace(/^#/, '').split('?')[0] || '/admin';
  if (isAdmin && currentUser?.role === 'staff' && !STAFF_ALLOWED_ADMIN_ROUTES.has(adminPath)) {
    view.innerHTML = '<div class="empty-state" style="padding:60px 20px;"><div class="empty-state-icon"><i class="fa-solid fa-lock"></i></div><h3>Không có quyền truy cập</h3><p class="text-muted">Tài khoản nhân viên không được phép vào khu vực này.</p></div>';
    return;
  }

  const newNavMode = isAdmin ? 'admin' : 'store';
  if (currentNavMode !== newNavMode) {
    currentNavMode = newNavMode;
    await loadSidebar();
  }

  setActiveSidebarItem(hash);
  closeSidebar();

  const featureRouteMap = {
    '/blog': 'blog', '/blog/': 'blog',
    '/offers': 'offers',
    '/affiliate': 'affiliate',
    '/support': 'support', '/support/': 'support',
    '/wishlist': 'wishlist',
    '/api-docs': 'api_docs',
    '/admin/api-keys': 'api_docs',
  };
  const featureLabels = {
    blog: 'Blog', offers: 'Ưu đãi / Gift Code', affiliate: 'Affiliate / Giới thiệu',
    support: 'Hỗ trợ', wishlist: 'Yêu thích', balance: 'Số dư / Nạp tiền',
    flash_sales: 'Flash Sale', reviews: 'Đánh giá sản phẩm', announcements: 'Thông báo',
    api_docs: 'Tài liệu API',
  };
  const path = hash.replace(/^#/, '').split('?')[0] || '/';
  const matchedFeature = Object.entries(featureRouteMap).find(([r]) => path === r || path.startsWith(r + '/'))?.[1];
  // Features that default to OFF (must be explicitly enabled)
  const optInFeatures = new Set(['api_docs']);
  const featureDisabled = matchedFeature && (
    optInFeatures.has(matchedFeature)
      ? appSettings.features?.[matchedFeature] !== true
      : appSettings.features?.[matchedFeature] === false
  );
  if (featureDisabled) {
    const label = featureLabels[matchedFeature] || matchedFeature;
    view.innerHTML = `<div class="empty-state" style="padding:60px 20px;text-align:center;">
      <div class="empty-state-icon"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.25;color:var(--text-muted)"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
      <h3 style="margin-top:16px;">Tính năng "${esc(label)}" hiện đang tắt</h3>
      <p class="text-muted" style="max-width:360px;margin:8px auto 0;">Tính năng này tạm thời không khả dụng. Vui lòng quay lại sau hoặc liên hệ quản trị viên nếu cần hỗ trợ.</p>
      <a href="#/" class="btn btn-primary mt-16">Về trang chủ</a>
    </div>`;
    return;
  }

  try {
    await Promise.resolve(route.handler(view, route.params));
    animateEntrance(view);
    // Inject AI assist buttons on admin pages
    if (path.startsWith('/admin') && typeof initAiButtons === 'function') initAiButtons(view);
  } catch (e) {
    console.error('Router execution error:', e);
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>Lỗi tải trang</h3><p class="text-muted">${e.message}</p></div>`;
  }
}

// ── Sidebar ─────────────────────────────────────────────────────
async function loadSidebar() {
  const nav = qs('#sidebar-nav');
  const sidebar = qs('#sidebar');
  if (!nav) return;
  nav.innerHTML = '';
  try {
    if (currentNavMode === 'admin') {
      sidebar?.classList.add('sidebar-dark');
      const links = [
        { href: '#/admin', icon: '<i class="fa-solid fa-chart-pie"></i>', text: 'Dashboard' },
        { href: '#/admin/orders', icon: '<i class="fa-solid fa-receipt"></i>', text: 'Đơn hàng' },
        { href: '#/admin/payments', icon: '<i class="fa-solid fa-credit-card"></i>', text: 'Thanh toán' },
        { href: '#/admin/balance', icon: '<i class="fa-solid fa-users"></i>', text: 'Quản lý user' },
        { divider: 'Sản phẩm' },
        { href: '#/admin/categories', icon: '<i class="fa-solid fa-folder-tree"></i>', text: 'Danh mục' },
        { href: '#/admin/products', icon: '<i class="fa-solid fa-bag-shopping"></i>', text: 'Sản phẩm' },
        { href: '#/admin/stock', icon: '<i class="fa-solid fa-boxes-stacked"></i>', text: 'Kho tài khoản' },
        { divider: 'Tính năng' },
        { href: '#/admin/banners', icon: '<i class="fa-solid fa-image"></i>', text: 'Banners' },
        { href: '#/admin/flash-sales', icon: '<i class="fa-solid fa-bolt"></i>', text: 'Flash Sales' },
        { href: '#/admin/gift-codes', icon: '<i class="fa-solid fa-gift"></i>', text: 'Mã quà tặng' },
        { href: '#/admin/affiliates', icon: '<i class="fa-solid fa-user-group"></i>', text: 'Affiliates' },
        { href: '#/admin/blog', icon: '<i class="fa-solid fa-newspaper"></i>', text: 'Blog' },
        { divider: 'Hỗ trợ & Cài đặt' },
        { href: '#/admin/tickets', icon: '<i class="fa-solid fa-headset"></i>', text: 'Hỗ trợ' },
        { href: '#/admin/bot-config', icon: '<i class="fa-solid fa-robot"></i>', text: 'Quản lý bot' },
        { href: '#/admin/support-pages', icon: '<i class="fa-solid fa-file-lines"></i>', text: 'Trang thông tin' },
        { href: '#/admin/announcements', icon: '<i class="fa-solid fa-bullhorn"></i>', text: 'Thông báo' },
        { href: '#/admin/oauth-settings', icon: '<i class="fa-brands fa-github"></i>', text: 'Đăng nhập MXH' },
        { href: '#/admin/api-keys', icon: '<i class="fa-solid fa-key"></i>', text: 'API Keys', feature: 'api_docs' },
        { href: '#/admin/settings', icon: '<i class="fa-solid fa-gear"></i>', text: 'Cài đặt chung' },
        { divider: '' },
        { href: '#/', icon: '<i class="fa-solid fa-arrow-left"></i>', text: 'Về trang chủ' }
      ];

      const visibleLinks = (currentUser?.role === 'staff'
        ? links.filter(l => l.divider !== undefined || STAFF_ALLOWED_ADMIN_ROUTES.has((l.href || '').replace(/^#/, '')) || l.href === '#/')
        : links
      ).filter(l => {
        if (!l.feature) return true;
        // api_docs is opt-in (default OFF)
        if (l.feature === 'api_docs') return appSettings.features?.api_docs === true;
        return appSettings.features?.[l.feature] !== false;
      });

      visibleLinks.forEach(l => {
        if (l.divider !== undefined) {
          if (l.divider !== '') {
            nav.appendChild(el('div', 'sidebar-divider'));
            nav.appendChild(el('div', 'sidebar-section-title', l.divider));
          } else {
            nav.appendChild(el('div', 'sidebar-divider'));
          }
        } else {
          const item = el('a', 'nav-item' + (location.hash === l.href ? ' active' : ''));
          item.href = l.href;
          item.innerHTML = `<div class="nav-icon">${l.icon}</div><span>${l.text}</span>`;
          nav.appendChild(item);
        }
      });
      return;
    }

    sidebar?.classList.remove('sidebar-dark');
    categories = await apiFetch('/categories/');

    // ── Trang chủ ──
    const homeItem = el('a', 'nav-item' + (location.hash === '#/' || !location.hash ? ' active' : ''));
    homeItem.href = '#/';
    homeItem.innerHTML = '<div class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div><span>Trang chủ</span>';
    nav.appendChild(homeItem);

    // ── Danh mục ──
    nav.innerHTML += '<div class="sidebar-section-title">Danh mục</div>';
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

    if (currentUser && appSettings.features?.wishlist !== false) {
      const wlItem = el('a', 'nav-item' + (location.hash === '#/wishlist' ? ' active' : ''));
      wlItem.href = '#/wishlist';
      wlItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-heart" style="color:#ef4444;font-size:16px;"></i></div><span>Yêu thích</span>';
      nav.appendChild(wlItem);
    }

    const supportItem = el('a', 'nav-item' + (location.hash.startsWith('#/support') ? ' active' : ''));
    supportItem.href = '#/support';
    supportItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-headset"></i></div><span>Hỗ trợ</span>';
    if (appSettings.features?.support !== false) nav.appendChild(supportItem);

    const blogItem = el('a', 'nav-item' + (location.pathname.startsWith('/blog') || location.hash === '#/blog' ? ' active' : ''));
    blogItem.href = '/blog';
    blogItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-newspaper"></i></div><span>Blog</span>';
    if (appSettings.features?.blog !== false) nav.appendChild(blogItem);

    if (appSettings.features?.api_docs === true) {
      const apiItem = el('a', 'nav-item' + (location.hash === '#/api-docs' ? ' active' : ''));
      apiItem.href = '#/api-docs';
      apiItem.innerHTML = '<div class="nav-icon"><i class="fa-solid fa-code"></i></div><span>Tài liệu API</span>';
      nav.appendChild(apiItem);
    }

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
  try {
  loadToken();
  lockViewportZoom();

  try {
    const urlParams = new URLSearchParams(location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('aff_ref_code', refCode);
      const cleanUrl = new URL(location);
      cleanUrl.searchParams.delete('ref');
      history.replaceState(null, '', cleanUrl);
    }
  } catch (_) {}

  await fetchMe();
  updateAuthUI();
  updateCartCount();

  if (currentUser) {
    try {
      const ids = await apiFetch('/wishlist/ids');
      window._wishlistIds = new Set(ids);
    } catch (_) { window._wishlistIds = new Set(); }
  } else {
    window._wishlistIds = new Set();
  }

  const yearEl = document.getElementById('f-current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  try {
    appSettings = await apiFetch('/admin/settings/public').catch(() => ({}));
    appSettings.features = appSettings.features || {};
    window.appSettings = appSettings;

    const logoUrl = appSettings.logo_url || appSettings.site_logo;
    const faviconUrl = appSettings.favicon_url || getFaviconUrl();
    const defaultImageUrl = appSettings.seo_image_url || appSettings.default_image_url;
    const defaultAvatarUrl = appSettings.default_avatar_url;
    const siteName = appSettings.site_name || 'ShopKey';
    const siteDescription = appSettings.seo_description || appSettings.site_description || 'Mua tài khoản, key, gift card và các sản phẩm số uy tín';
    const seoTitle = appSettings.seo_title || appSettings.site_name || 'ShopKey';
    const seoKeywords = appSettings.seo_keywords || appSettings.keywords || '';
    const seoAuthor = appSettings.seo_author || appSettings.author || '';
    const twitterCard = appSettings.twitter_card || 'summary_large_image';
    const canonicalUrl = (appSettings.site_url ? appSettings.site_url.replace(/\/$/, '') + location.pathname : location.origin + location.pathname);
    if (seoTitle) {
      document.title = seoTitle;
    }
    const setMeta = (selector, attr, value) => {
      const node = document.querySelector(selector);
      if (node && value) node.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', siteDescription);
    setMeta('meta[name="keywords"]', 'content', seoKeywords);
    setMeta('meta[name="author"]', 'content', seoAuthor);
    setMeta('link[rel="canonical"]', 'href', canonicalUrl);
    setMeta('meta[property="og:title"]', 'content', seoTitle);
    setMeta('meta[property="og:description"]', 'content', siteDescription);
    setMeta('meta[property="og:site_name"]', 'content', siteName);
    setMeta('meta[property="og:url"]', 'content', canonicalUrl);
    setMeta('meta[property="og:image"]', 'content', defaultImageUrl || logoUrl || '');
    setMeta('meta[name="twitter:card"]', 'content', twitterCard);
    setMeta('meta[name="twitter:title"]', 'content', seoTitle);
    setMeta('meta[name="twitter:description"]', 'content', siteDescription);
    setMeta('meta[name="twitter:image"]', 'content', defaultImageUrl || logoUrl || '');
    if (faviconUrl) {
      applyFavicon(faviconUrl);
    }
    if (defaultImageUrl) window.defaultImageUrl = defaultImageUrl;
    if (defaultAvatarUrl) {
      window.defaultAvatarUrl = defaultAvatarUrl;
      if (typeof updateAuthUI === 'function') updateAuthUI();
    }

    const logoLink = qs('#logo-link');
    if (logoLink) {
      if (logoUrl) {
        logoLink.innerHTML = `<img src="${logoUrl}" alt="${appSettings.site_name || 'Logo'}" style="height: 92px; width: auto; max-width: 100%; object-fit: contain;">`;
      } else if (appSettings.site_name) {
        const logoText = logoLink.querySelector('.logo-text');
        if (logoText) logoText.textContent = appSettings.site_name;
      }
    }

    const fSiteName = qs('#f-site-name');
    if (fSiteName) {
      fSiteName.textContent = appSettings.site_name || 'ShopKey';
    }

    const fSiteDesc = qs('#f-site-desc');
    if (fSiteDesc && appSettings.site_description) {
      fSiteDesc.textContent = appSettings.site_description;
    }

    const fSocials = qs('#f-socials');
    if (fSocials) {
      let socialHtml = '';
      if (appSettings.social_fb) socialHtml += `<a href="${appSettings.social_fb}" target="_blank" title="Facebook"><i class="fa-brands fa-facebook"></i></a>`;
      if (appSettings.social_tele) socialHtml += `<a href="${appSettings.social_tele}" target="_blank" title="Telegram"><i class="fa-brands fa-telegram"></i></a>`;
      if (appSettings.social_discord) socialHtml += `<a href="${appSettings.social_discord}" target="_blank" title="Discord"><i class="fa-brands fa-discord"></i></a>`;
      fSocials.innerHTML = socialHtml;
    }

    const fSiteCopy = qs('#f-site-copy');
    if (fSiteCopy) {
      fSiteCopy.innerHTML = appSettings.copyright_text || `Copyright © ${new Date().getFullYear()} ${appSettings.site_name || 'ShopKey'}. All rights reserved.`;
    }
  } catch (_) {
    appSettings = {};
    window.appSettings = appSettings;
  }

  await loadSidebar();
  window.addEventListener('hashchange', navigate);
  await navigate();

  const userMenuBtn = qs('#user-menu-btn');
  const dropdown = qs('#user-dropdown');
  if (userMenuBtn && dropdown) {
    userMenuBtn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }

  qs('#btn-logout')?.addEventListener('click', () => {
    saveToken(null); currentUser = null; updateAuthUI();
    toast('Đã đăng xuất', 'info'); location.hash = '/';
  });

  const doSearch = () => { const q = (qs('#search-input')?.value || '').trim(); if (q) location.hash = `/all?q=${encodeURIComponent(q)}`; };
  qs('#search-btn')?.addEventListener('click', doSearch);
  qs('#search-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

  qs('#hamburger')?.addEventListener('click', toggleSidebar);
  qs('#sidebar-overlay')?.addEventListener('click', closeSidebar);
  window.addEventListener('resize', () => updateHeaderMode(location.hash || '#/', location.hash.startsWith('#/admin')));

  qs('#modal-close')?.addEventListener('click', closeModal);
  qs('#modal-overlay')?.addEventListener('click', (e) => { if (e.target === qs('#modal-overlay')) closeModal(); });

  if (typeof ADMIN_DEBUG !== 'undefined' && ADMIN_DEBUG) {
    document.addEventListener('click', (e) => {
      if (!location.hash.startsWith('#/admin')) return;
      const target = e.target.closest('button, a, [data-del], [data-del-banner], [data-del-fs], [data-del-gc], [data-del-page], [data-del-ann], [data-del-post], [data-del-cat], [data-cancel-order], [data-delpkg]');
      if (!target) return;
      adminDebugLog('click captured', {
        text: target.textContent?.trim() || '',
        id: target.id || null,
        className: target.className || null,
        dataset: { ...target.dataset },
      });
    }, true);

    document.addEventListener('click', (e) => {
      if (!location.hash.startsWith('#/admin')) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      adminDebugLog('click top element', {
        tag: el?.tagName || null,
        id: el?.id || null,
        className: el?.className || null,
      });
    }, true);

    window.addEventListener('error', (e) => {
      if (!location.hash.startsWith('#/admin')) return;
      adminDebugLog('window error', { message: e.message, source: e.filename, line: e.lineno, column: e.colno });
    });

    window.addEventListener('unhandledrejection', (e) => {
      if (!location.hash.startsWith('#/admin')) return;
      adminDebugLog('unhandled rejection', String(e.reason));
    });
  }
  } catch (err) {
    console.error('App init failed:', err);
    window.__appInitError = String(err?.stack || err?.message || err);
  }
}

init();
