// ═══════════════════════════════════════════════════════════════
//  STOREFRONT PAGES
// ═══════════════════════════════════════════════════════════════

async function renderHome(view) {
  view.innerHTML = '';

  // ── Parallel API calls ───────────────────────────────────
  const [banners, flashSales, featuredData, announcementsData] = await Promise.all([
    apiFetch('/banners/').catch(() => []),
    apiFetch('/flash-sales/active').catch(() => []),
    apiFetch('/products/featured?limit=12').catch(() => []),
    apiFetch('/announcements/').catch(() => ({ items: [] }))
  ]);

  // Also fetch home category products in parallel
  let homeCatProducts = {};
  if (appSettings.home_categories) {
    const slugs = appSettings.home_categories.split(',').map(s => s.trim()).filter(Boolean);
    const catFetches = slugs.map(slug =>
      apiFetch(`/products/?category_slug=${slug}&limit=8`)
        .then(data => ({ slug, data }))
        .catch(() => ({ slug, data: null }))
    );
    const catResults = await Promise.all(catFetches);
    catResults.forEach(r => { if (r.data) homeCatProducts[r.slug] = r.data; });
  }

  const heroBanners = banners.filter(b => b.banner_type === 'hero');
  const catBanners = banners.filter(b => b.banner_type === 'category');

  // ── Build all DOM in a fragment to minimize reflows ──────
  const frag = document.createDocumentFragment();

  // ── Banner Slider ────────────────────────────────────────
  if (heroBanners.length) {
    const slider = el('div', 'banner-slider');
    const track = el('div', 'banner-track');
    heroBanners.forEach((b, i) => {
      const slide = el('div', `banner-slide${i === 0 ? ' active' : ''}`);
      const inner = b.link
        ? `<a href="${b.link}"><img src="${b.image_url}" alt="${b.title}" loading="lazy" decoding="async" /></a>`
        : `<img src="${b.image_url}" alt="${b.title}" loading="lazy" decoding="async" />`;
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
    frag.appendChild(slider);
  }

  // ── Category Banners Grid ────────────────────────────────
  if (catBanners.length) {
    const grid = el('div', 'banner-grid');
    catBanners.forEach(b => {
      const card = el('div', 'banner-card');
      const inner = b.link
        ? `<a href="${b.link}"><img src="${b.image_url}" alt="${b.title}" loading="lazy" decoding="async" /></a>`
        : `<img src="${b.image_url}" alt="${b.title}" loading="lazy" decoding="async" />`;
      card.innerHTML = inner;
      grid.appendChild(card);
    });
    frag.appendChild(grid);
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
    frag.appendChild(hero);
  }

  // ── Announcements ────────────────────────────────────────
  const announcements = announcementsData?.items || [];
  if (announcements.length && appSettings.features?.announcements !== false) {
    const annSection = el('div', 'ann-section');
    const hasMore = announcements.length > 1;
    annSection.innerHTML = `
      <div class="ann-header">
        <div class="ann-title"><i class="fa-solid fa-bullhorn"></i> Thông báo</div>
        ${hasMore ? `<button class="ann-toggle-btn" id="ann-toggle"><span class="ann-toggle-count">${announcements.length - 1} thông báo khác</span> <i class="fa-solid fa-chevron-down"></i></button>` : ''}
      </div>
      <div class="ann-scroll ${hasMore ? 'ann-collapsed' : ''}" id="ann-list">
        ${announcements.map((a, i) => `
          <div class="ann-card-v2 ${hasMore && i > 0 ? 'ann-hidden-card' : ''}">
            <div class="ann-card-header">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=e2e8f0" class="ann-avatar" alt="Admin" />
              <div class="ann-author-info">
                <div class="ann-author-name">Quản Trị Viên <i class="fa-solid fa-circle-check" style="color: #1d9bf0;"></i></div>
                <div class="ann-date">${new Date(a.created_at).toLocaleString('vi-VN')}</div>
              </div>
            </div>
            <div class="ann-card-content">
              ${a.title ? `<div class="ann-content-title">${a.title}</div>` : ''}
              <div class="ann-content-body">${a.content}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    frag.appendChild(annSection);

    if (hasMore) {
      const toggleBtn = annSection.querySelector('#ann-toggle');
      const list = annSection.querySelector('#ann-list');
      let expanded = false;
      toggleBtn.onclick = () => {
        expanded = !expanded;
        list.classList.toggle('ann-collapsed', !expanded);
        list.querySelectorAll('.ann-hidden-card').forEach(c => c.style.display = expanded ? '' : 'none');
        toggleBtn.querySelector('i').className = expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
        toggleBtn.querySelector('.ann-toggle-count').textContent = expanded ? 'Thu gọn' : `${announcements.length - 1} thông báo khác`;
      };
      // Initially hide extra cards
      annSection.querySelectorAll('.ann-hidden-card').forEach(c => c.style.display = 'none');
    }
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
      const iconUrl = cat.image_url || cat.icon_url;
      const iconHtml = iconUrl ? `<img src="${iconUrl}" alt="" loading="lazy" decoding="async" style="width:16px;height:16px;object-fit:contain;border-radius:2px;margin-right:4px;" />` : ico.box;
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
            ? `<img src="${sub.icon_url}" alt="${sub.name}" loading="lazy" decoding="async" />`
            : `<div class="subcat-icon">${ico.box}</div>`;
          card.innerHTML = `${iconHtml}<span class="subcat-name">${sub.name}</span>`;
          card.onclick = () => {
            const p = categories.find(c => c.children?.some(s => s.slug === sub.slug));
            location.hash = `/all?cat=${p ? p.slug : ''}&sub=${sub.slug}`;
          };
          grid.appendChild(card);
        });
        subGrid.appendChild(grid);
      }
    };

    // Pill click handler
    pills.addEventListener('click', (e) => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;
      location.hash = `/all?cat=${pill.dataset.slug}`;
    });

    // Initial render — show all
    renderSubcats('');

    frag.appendChild(catSection);
  }

  // ── Flash Sale ───────────────────────────────────────────
  if (flashSales.length && appSettings.features?.flash_sales !== false) {
    const section = el('div', 'flash-sale-section');
    section.innerHTML = `<div class="section-title">${ico.zap} Flash Sale</div>`;
    const row = el('div', 'flash-sale-row');
    flashSales.forEach(fs => {
      const card = el('div', 'flash-card');
      const discount = fs.original_price ? Math.round((1 - fs.sale_price / fs.original_price) * 100) : 0;
      const sold = fs.sold_count || 0;
      const total = fs.quantity_limit || 0;
      const progressPct = total > 0 ? Math.min((sold / total) * 100, 100) : 0;
      const cardHtml = `
        ${fs.product_image ? `<img class="flash-card-img" src="${fs.product_image}" alt="${fs.product_name || ''}" loading="lazy" decoding="async" />` : '<div class="flash-card-img flash-card-img-ph">' + ico.box + '</div>'}
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
    frag.appendChild(section);

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

  // ── Featured Products ────────────────────────────────────
  const featuredHead = el('div', 'section-head');
  featuredHead.innerHTML = `<div class="section-title mb-0">${ico.star} Sản phẩm nổi bật</div><a href="#/all" class="btn btn-primary btn-sm" style="font-weight: 600;">Xem tất cả <i class="fa-solid fa-arrow-right"></i></a>`;
  frag.appendChild(featuredHead);
  
  if (!featuredData.length) {
    frag.appendChild(el('div', 'empty-state', `<div class="empty-state-icon">${ico.inbox}</div><h3>Chưa có sản phẩm nổi bật</h3>`));
  } else {
    const grid = el('div', 'product-grid');
    featuredData.forEach(p => grid.appendChild(productCard(p)));
    frag.appendChild(grid);
  }

  // ── Wishlist / Favorites on Home ──────────────────────────
  if (currentUser && window._wishlistIds?.size > 0 && appSettings.features?.wishlist !== false) {
    try {
      const wlData = await apiFetch('/wishlist/?limit=6');
      if (wlData.items?.length) {
        const wlHead = el('div', 'section-head mt-32');
        wlHead.innerHTML = `<div class="section-title mb-0"><i class="fa-solid fa-heart" style="color:#ef4444"></i> Sản phẩm yêu thích</div><a href="#/wishlist" class="btn btn-primary btn-sm" style="font-weight: 600;">Xem tất cả <i class="fa-solid fa-arrow-right"></i></a>`;
        frag.appendChild(wlHead);
        const wlGrid = el('div', 'product-grid');
        wlData.items.forEach(p => wlGrid.appendChild(productCard(p)));
        frag.appendChild(wlGrid);
      }
    } catch (_) {}
  }

  // ── Selected Categories on Home ──────────────────────────
  if (appSettings.home_categories) {
    const slugs = appSettings.home_categories.split(',').map(s => s.trim()).filter(Boolean);
    for (const slug of slugs) {
      const cat = categories.find(c => c.slug === slug);
      if (!cat) continue;
      
      const catHead = el('div', 'section-head mt-32');
      catHead.innerHTML = `<div class="section-title mb-0">${cat.icon_url ? `<img src="${cat.icon_url}" loading="lazy" decoding="async" style="width:24px;height:24px;object-fit:contain;vertical-align:middle"/>` : ico.box} ${cat.name}</div><a href="#/all?cat=${cat.slug}" class="btn btn-primary btn-sm" style="font-weight: 600;">Xem tất cả <i class="fa-solid fa-arrow-right"></i></a>`;
      frag.appendChild(catHead);
      
      const catData = homeCatProducts[slug];
      if (catData && catData.items && catData.items.length) {
        const grid = el('div', 'product-grid');
        catData.items.forEach(p => grid.appendChild(productCard(p)));
        frag.appendChild(grid);
      } else {
        frag.appendChild(el('p', 'text-muted mb-32', 'Đang cập nhật sản phẩm...'));
      }
    }
  }

  // ── Single DOM write ─────────────────────────────────────
  view.appendChild(frag);
}

async function renderCategory(view, { slug }) {
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const [cat, data] = await Promise.all([apiFetch(`/categories/${slug}`), apiFetch(`/products/?category_slug=${slug}&limit=40`)]);
    view.innerHTML = '';
    const heroHead = el('div', 'products-hero');
    heroHead.innerHTML = `
      <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <strong>${cat.name}</strong></div>
      <h1 class="products-hero-title"><i class="fa-solid fa-folder-open"></i> ${cat.name}</h1>
      <p class="products-hero-desc">${data.total} sản phẩm trong danh mục này</p>
    `;
    view.appendChild(heroHead);
    if (!data.items.length) {
      view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><h3>Danh mục này chưa có sản phẩm</h3>'));
    } else {
      const grid = el('div', 'product-grid');
      data.items.forEach(p => grid.appendChild(productCard(p)));
      view.appendChild(grid);
    }
  } catch (e) { view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`; }
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
    <div class="breadcrumb mb-8" id="ph-bc"><a href="#/">Trang chủ</a> <span>›</span> <strong>Sản phẩm</strong></div>
    <h1 class="products-hero-title" id="ph-title">${ico.shield} Tất cả sản phẩm</h1>
    <p class="products-hero-desc" id="ph-desc">Khám phá bộ sưu tập sản phẩm chất lượng cao được chọn lọc dành riêng cho bạn</p>
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

    // Update Hero Title
    let pageTitle = 'Tất cả sản phẩm';
    let pageDesc = 'Khám phá bộ sưu tập sản phẩm chất lượng cao được chọn lọc dành riêng cho bạn';
    let bcHtml = `<a href="#/">Trang chủ</a> <span>›</span> <strong>Sản phẩm</strong>`;

    if (catSlug) {
      const c = categories.find(x => x.slug === catSlug);
      if (c) {
        pageTitle = c.name;
        pageDesc = `Khám phá các sản phẩm thuộc danh mục ${c.name}`;
        bcHtml = `<a href="#/">Trang chủ</a> <span>›</span> <a href="#/all">Sản phẩm</a> <span>›</span> <strong>${c.name}</strong>`;
        if (subSlug) {
          const s = c.children?.find(x => x.slug === subSlug);
          if (s) {
            pageTitle = s.name;
            pageDesc = `Khám phá các sản phẩm thuộc thể loại ${s.name}`;
            bcHtml = `<a href="#/">Trang chủ</a> <span>›</span> <a href="#/all">Sản phẩm</a> <span>›</span> <a href="#/all?cat=${c.slug}">${c.name}</a> <span>›</span> <strong>${s.name}</strong>`;
          }
        }
      }
    }
    const titleEl = qs('#ph-title', heroHead);
    const descEl = qs('#ph-desc', heroHead);
    const bcEl = qs('#ph-bc', heroHead);
    if (titleEl) titleEl.innerHTML = `${ico.shield} ${pageTitle}`;
    if (descEl) descEl.innerHTML = pageDesc;
    if (bcEl) bcEl.innerHTML = bcHtml;

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
    ? `<img class="product-card-img" src="${p.image_url}" alt="${p.name}" loading="lazy" decoding="async" />`
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
    let selectedPkg = p.packages?.[0] || null;
    let quantity = 1;
    let reviewPage = 1;
    let reviewData = null;

    // ── Helpers ──
    const isOutOfStock = (pkg) => {
      if (pkg.delivery_type === 'auto') return pkg.stock_count < 1;
      if (pkg.is_stock_managed) return pkg.stock_quantity < 1;
      return false;
    };
    const getStockBadge = (pkg) => {
      if (pkg.delivery_type === 'auto') {
        return pkg.stock_count > 0
          ? `<span class="pd-badge pd-badge-green">Còn hàng (${pkg.stock_count})</span>`
          : `<span class="pd-badge pd-badge-red">Hết hàng</span>`;
      }
      if (pkg.is_stock_managed) {
        const qty = pkg.stock_quantity || 0;
        if (qty <= 0) return `<span class="pd-badge pd-badge-red">Hết hàng</span>`;
        if (qty <= 5) return `<span class="pd-badge pd-badge-orange">Sắp hết (${qty})</span>`;
        return `<span class="pd-badge pd-badge-green">Còn hàng (${qty})</span>`;
      }
      return `<span class="pd-badge pd-badge-blue">Giao thủ công</span>`;
    };
    const getDisplayPrice = (pkg) => pkg.flash_sale ? pkg.flash_sale.sale_price : pkg.price;
    const getStrikePrice = (pkg) => pkg.flash_sale ? pkg.price : pkg.original_price;
    const starsHtml = (rating, size = 16) => {
      let h = '';
      for (let i = 1; i <= 5; i++) {
        h += i <= Math.round(rating)
          ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="var(--amber)" stroke="var(--amber)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
          : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      }
      return h;
    };

    // ── Load reviews ──
    const loadReviews = async (page = 1) => {
      try {
        reviewData = await apiFetch(`/reviews/product/${p.id}?page=${page}&limit=3`);
        reviewPage = page;
      } catch { reviewData = null; }
    };
    await loadReviews(1);

    // ── Timers cleanup ──
    const intervals = [];
    const cleanupTimers = () => intervals.forEach(id => clearInterval(id));
    const timerObs = new MutationObserver(() => {
      if (!document.contains(view)) { cleanupTimers(); timerObs.disconnect(); }
    });
    timerObs.observe(document.body, { childList: true, subtree: true });

    // ── Main render ──
    const render = () => {
      view.innerHTML = '';
      cleanupTimers();

      // Breadcrumb
      let bcCatHref = '';
      if (p.category_slug) {
        const pCat = categories.find(c => c.children?.some(s => s.slug === p.category_slug || s.id === p.category_id));
        if (pCat) {
          bcCatHref = `#/all?cat=${pCat.slug}&sub=${p.category_slug || p.category_id}`;
        } else {
          bcCatHref = `#/all?cat=${p.category_slug || p.category_id}`;
        }
      }
      view.appendChild(el('div', 'breadcrumb mb-16', `<a href="#/">Trang chủ</a> <span>›</span> ${p.category_name ? `<a href="${bcCatHref}">${p.category_name}</a> <span>›</span> ` : ''}${p.name}`));

      // ── Top section: stacked layout ──
      const topSection = el('div', 'pd-top-section');

      // Image with overlay badges
      const imgWrap = el('div', 'pd-hero-img');
      if (p.image_url) {
        imgWrap.innerHTML = `<img src="${p.image_url}" alt="${p.name}" loading="lazy" decoding="async" />`;
      } else {
        imgWrap.innerHTML = `<div class="pd-top-img-ph">${ico.box}</div>`;
      }
      // Discount badge overlay
      const maxDiscount = Math.max(0, ...(p.packages || []).map(pkg => {
        const op = pkg.flash_sale ? pkg.price : pkg.original_price;
        const cp = pkg.flash_sale ? pkg.flash_sale.sale_price : pkg.price;
        return (op && op > cp) ? Math.round((1 - cp / op) * 100) : 0;
      }));
      if (maxDiscount > 0) {
        imgWrap.innerHTML += `<span class="pd-hero-discount">GIẢM ĐẾN ${maxDiscount}%</span>`;
      }
      topSection.appendChild(imgWrap);

      // Product name + action icons (share & wishlist)
      const nameRow = el('div', 'pd-name-row');
      nameRow.innerHTML = `
        <h1 class="pd-name">${p.name}</h1>
        <div class="pd-name-actions">
          ${currentUser && appSettings.features?.affiliate !== false ? `<button class="pd-action-icon pd-share-icon" id="pd-share-btn" title="Chia sẻ kiếm tiền"><i class="fa-solid fa-hand-holding-dollar"></i><span class="pd-action-badge" id="pd-share-badge" style="display:none"></span></button>` : ''}
          ${appSettings.features?.wishlist !== false ? `<button class="pd-action-icon pd-heart-icon ${currentUser && window._wishlistIds?.has(p.id) ? 'active' : ''} ${currentUser ? '' : 'disabled'}" id="pd-heart-btn" title="${currentUser ? 'Yêu thích' : 'Đăng nhập để yêu thích'}"><i class="fa-${currentUser && window._wishlistIds?.has(p.id) ? 'solid' : 'regular'} fa-heart"></i></button>` : ''}
        </div>
      `;
      topSection.appendChild(nameRow);

      // Wire share button
      const shareBtn = qs('#pd-share-btn', nameRow);
      if (shareBtn) {
        // Load commission rate for badge
        apiFetch('/affiliate/me').then(aff => {
          if (aff.registered || aff.commission_rate) {
            const badge = qs('#pd-share-badge', nameRow);
            if (badge) { badge.textContent = `${aff.commission_rate || 5}%`; badge.style.display = ''; }
          }
        }).catch(() => {});

        shareBtn.onclick = async () => {
          try {
            let aff = await apiFetch('/affiliate/me');
            if (!aff.registered) {
              aff = await apiFetch('/affiliate/register', { method: 'POST' });
              aff.registered = true;
              aff.commission_rate = aff.commission_rate || 5;
            }
            const rate = aff.commission_rate || 5;
            const refCode = aff.ref_code;
            const siteBase = location.origin;
            const refLink = `${siteBase}/#/product/${p.slug}?ref=${refCode}`;
            const shareText = encodeURIComponent(`${p.name} - Xem ngay!`);
            const shareUrl = encodeURIComponent(refLink);

            let pkgCommHtml = '';
            if (p.packages?.length) {
              pkgCommHtml = p.packages.map(pkg => {
                const price = pkg.flash_sale ? pkg.flash_sale.sale_price : pkg.price;
                const comm = Math.round(price * rate / 100);
                const name = pkg.name.length > 22 ? pkg.name.slice(0, 22) + '…' : pkg.name;
                return `<div class="share-comm-row"><span class="share-comm-name">${name}</span><span class="share-comm-price">${fmt(price)}</span><span class="share-comm-arrow">→</span><span class="share-comm-value">+${fmt(comm)}</span></div>`;
              }).join('');
            }

            openModal(`
              <div class="share-modal">
                <div class="share-hero">
                  <button class="share-close-btn" onclick="closeModal()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  <div class="share-hero-glow"></div>
                  <div class="share-hero-icon"><i class="fa-solid fa-hand-holding-dollar"></i></div>
                  <div class="share-hero-rate">${rate}%</div>
                  <div class="share-hero-label">hoa hồng mỗi đơn hàng</div>
                </div>

                <div class="share-body">
                  <div class="share-link-box">
                    <input type="text" class="share-link-input" id="share-ref-link" value="${refLink}" readonly />
                    <button class="share-copy-btn" id="share-copy-btn"><i class="fa-regular fa-copy"></i> Sao chép</button>
                  </div>

                  <div class="share-socials">
                    <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" class="share-social-item share-s-fb"><i class="fa-brands fa-facebook-f"></i><span>Facebook</span></a>
                    <a href="https://zalo.me/share?url=${shareUrl}" target="_blank" class="share-social-item share-s-zalo"><span class="share-zalo-z">Z</span><span>Zalo</span></a>
                    <a href="https://t.me/share/url?url=${shareUrl}&text=${shareText}" target="_blank" class="share-social-item share-s-tg"><i class="fa-brands fa-telegram"></i><span>Telegram</span></a>
                    <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" class="share-social-item share-s-x"><i class="fa-brands fa-x-twitter"></i><span>X</span></a>
                    <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" class="share-social-item share-s-wa"><i class="fa-brands fa-whatsapp"></i><span>WhatsApp</span></a>
                    <a href="https://www.facebook.com/dialog/send?link=${shareUrl}&app_id=0&redirect_uri=${shareUrl}" target="_blank" class="share-social-item share-s-msg"><i class="fa-brands fa-facebook-messenger"></i><span>Messenger</span></a>
                  </div>

                  ${pkgCommHtml ? `
                  <details class="share-comm-details">
                    <summary class="share-comm-summary"><i class="fa-solid fa-calculator"></i> Xem hoa hồng dự kiến <i class="fa-solid fa-chevron-down share-chev"></i></summary>
                    <div class="share-comm-list">${pkgCommHtml}</div>
                  </details>` : ''}

                  <a href="#/affiliate" class="share-stats-link" onclick="closeModal()"><i class="fa-solid fa-chart-line"></i> Xem thống kê hoa hồng</a>
                </div>
              </div>
            `);
            qs('#share-copy-btn').onclick = () => {
              navigator.clipboard.writeText(refLink).then(() => toast('Đã sao chép link', 'success')).catch(() => { qs('#share-ref-link').select(); document.execCommand('copy'); toast('Đã sao chép link', 'success'); });
            };
          } catch (err) { toast(err.message || 'Lỗi', 'error'); }
        };
      }

      // Wire heart/wishlist button
      const heartBtn = qs('#pd-heart-btn', nameRow);
      if (heartBtn) {
        heartBtn.onclick = async () => {
          if (!currentUser) { toast('Đăng nhập để yêu thích', 'error'); return location.hash = '/login'; }
          try {
            const res = await apiFetch(`/wishlist/toggle/${p.id}`, { method: 'POST' });
            const icon = heartBtn.querySelector('i');
            if (res.wishlisted) {
              icon.className = 'fa-solid fa-heart';
              heartBtn.classList.add('active');
              window._wishlistIds?.add(p.id);
              toast('Đã thêm vào yêu thích', 'success');
            } else {
              icon.className = 'fa-regular fa-heart';
              heartBtn.classList.remove('active');
              window._wishlistIds?.delete(p.id);
              toast('Đã bỏ yêu thích', 'info');
            }
          } catch (err) { toast(err.message || 'Lỗi', 'error'); }
        };
        // Set initial active state
        if (currentUser && window._wishlistIds?.has(p.id)) heartBtn.classList.add('active');
      }

      // Rating row
      const ratingRow = el('div', 'pd-rating-row');
      ratingRow.innerHTML = `
        <span class="pd-rating-stars">${starsHtml(p.review_avg || 0)}</span>
        <span class="pd-rating-avg">${p.review_avg ? p.review_avg.toFixed(1) : '—'}</span>
        <span class="pd-rating-count">(${p.review_count || 0} đánh giá)</span>
      `;
      topSection.appendChild(ratingRow);

      // Info pills: category + sold count
      const pillsRow = el('div', 'pd-info-pills');
      if (p.category_name) {
        const catIcon = p.category_icon ? `<img src="${p.category_icon}" class="pd-pill-icon" alt="" loading="lazy" decoding="async" />` : '';
        let pdCatHref = '';
        if (p.category_slug) {
            const pCat = categories.find(c => c.children?.some(s => s.slug === p.category_slug || s.id === p.category_id));
            if (pCat) pdCatHref = `#/all?cat=${pCat.slug}&sub=${p.category_slug || p.category_id}`;
            else pdCatHref = `#/all?cat=${p.category_slug || p.category_id}`;
        }
        
        pillsRow.innerHTML += `<a href="${pdCatHref}" class="pd-pill pd-pill-cat">${catIcon}${p.category_name}</a>`;
      }
      if (p.sold_count > 0) {
        pillsRow.innerHTML += `<span class="pd-pill pd-pill-sold">🔥 Đã bán ${p.sold_count}</span>`;
      }
      topSection.appendChild(pillsRow);

      view.appendChild(topSection);

      // ── Cards section ──
      const cards = el('div', 'pd-cards');

      // ── Card: Mô tả sản phẩm ──
      if (p.description) {
        const descCard = el('div', 'pd-card');
        descCard.innerHTML = '<div class="pd-card-title">Mô tả sản phẩm</div>';
        const descBody = el('div', 'pd-desc-body');
        descBody.innerHTML = p.description;
        descCard.appendChild(descBody);
        cards.appendChild(descCard);

        requestAnimationFrame(() => {
          if (descBody.scrollHeight > 300) {
            descBody.classList.add('collapsed');
            const toggleBtn = el('button', 'pd-desc-toggle', 'Xem thêm');
            toggleBtn.onclick = () => {
              const isCollapsed = descBody.classList.toggle('collapsed');
              toggleBtn.textContent = isCollapsed ? 'Xem thêm' : 'Thu gọn';
            };
            descCard.appendChild(toggleBtn);
          }
        });
      }

      // ── Card: Chọn gói sản phẩm ──
      if (p.packages?.length) {
        const pkgCard = el('div', 'pd-card');
        pkgCard.innerHTML = '<div class="pd-card-title">Chọn gói sản phẩm</div>';
        const pkgGrid = el('div', 'pd-pkg-grid');

        p.packages.forEach(pkg => {
          const oos = isOutOfStock(pkg);
          const fs = pkg.flash_sale;
          const displayPrice = getDisplayPrice(pkg);
          const strikePrice = getStrikePrice(pkg);
          const discountPct = (fs && pkg.price > 0) ? Math.round((1 - fs.sale_price / pkg.price) * 100) : 0;

          const pill = el('div', 'pd-pkg-pill' + (selectedPkg?.id === pkg.id ? ' selected' : '') + (oos ? ' oos' : '') + (fs ? ' flash' : ''));
          const deliveryIcon = pkg.delivery_type === 'auto' ? '<i class="fa-solid fa-bolt pd-pkg-dtype-icon" title="Giao tự động"></i>' : '<i class="fa-solid fa-truck pd-pkg-dtype-icon" title="Giao thủ công"></i>';
          const stockInfo = (() => {
            const boxIcon = '<i class="fa-solid fa-box"></i>';
            if (pkg.delivery_type === 'auto') {
              if (pkg.stock_count <= 0) return `<span class="pd-pkg-stock pd-stock-red">${boxIcon} Hết hàng</span>`;
              if (pkg.stock_count <= 5) return `<span class="pd-pkg-stock pd-stock-orange">${boxIcon} Còn ${pkg.stock_count}</span>`;
              return `<span class="pd-pkg-stock pd-stock-green">${boxIcon} Còn ${pkg.stock_count}</span>`;
            }
            if (pkg.is_stock_managed) {
              const sq = pkg.stock_quantity || 0;
              if (sq <= 0) return `<span class="pd-pkg-stock pd-stock-red">${boxIcon} Hết hàng</span>`;
              if (sq <= 5) return `<span class="pd-pkg-stock pd-stock-orange">${boxIcon} Còn ${sq}</span>`;
              return `<span class="pd-pkg-stock pd-stock-green">${boxIcon} Còn ${sq}</span>`;
            }
            return `<span class="pd-pkg-stock pd-stock-green">${deliveryIcon} Sẵn hàng</span>`;
          })();
          pill.innerHTML = `
            <div class="pd-pkg-main">
              <div class="pd-pkg-name${oos ? ' oos-text' : ''}">${pkg.name}</div>
              ${pkg.description ? `<div class="pd-pkg-desc">${pkg.description}</div>` : ''}
              <div class="pd-pkg-badges">
                ${stockInfo}
                ${fs ? `<span class="pd-badge pd-badge-flash">${ico.zap} -${discountPct}%</span>` : ''}
              </div>
              ${fs?.ends_at ? `<div class="pd-pkg-timer" data-end="${fs.ends_at}">⏳ --:--:--</div>` : ''}
            </div>
            <div class="pd-pkg-pricing">
              <div class="pd-pkg-price${fs ? ' flash-price' : ''}">${fmt(displayPrice)}</div>
              ${strikePrice ? `<div class="pd-pkg-strike">${fmt(strikePrice)}</div>` : ''}
            </div>
          `;
          if (!oos) {
            pill.onclick = () => {
              selectedPkg = pkg;
              quantity = 1;
              qsa('.pd-pkg-pill', pkgGrid).forEach(e => e.classList.remove('selected'));
              pill.classList.add('selected');
              renderOrderForm();
              if (typeof updateNotesCard === 'function') updateNotesCard();
            };
          }
          pkgGrid.appendChild(pill);
        });

        pkgCard.appendChild(pkgGrid);
        cards.appendChild(pkgCard);

        // Flash sale timers
        const updateTimers = () => {
          qsa('.pd-pkg-timer', pkgGrid).forEach(t => {
            const end = new Date(t.dataset.end).getTime();
            const diff = end - Date.now();
            if (diff <= 0) { t.textContent = 'Hết hạn'; return; }
            const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
            const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
            t.textContent = `⏳ ${h}:${m}:${s}`;
          });
        };
        updateTimers();
        intervals.push(setInterval(updateTimers, 1000));

        // ── Card 2: Đặt hàng ──
        const orderCard = el('div', 'pd-card');
        orderCard.innerHTML = '<div class="pd-card-title">Đặt hàng</div>';
        const orderBody = el('div', 'pd-order-body');
        orderCard.appendChild(orderBody);
        cards.appendChild(orderCard);

        const renderOrderForm = () => {
          orderBody.innerHTML = '';
          if (!selectedPkg) {
            orderBody.innerHTML = '<p class="text-muted">Vui lòng chọn gói sản phẩm</p>';
            return;
          }
          const oos = isOutOfStock(selectedPkg);
          const price = getDisplayPrice(selectedPkg);

          // B) Thông tin Order section
          const infoSection = el('div', 'pd-order-info');
          const infoTitle = el('div', 'pd-order-info-title', 'Thông tin Order');
          infoSection.appendChild(infoTitle);
          if (selectedPkg.fields?.length) {
            selectedPkg.fields.forEach(f => {
              const fg = el('div', 'form-group');
              const label = el('label', 'form-label', f.field_name + (f.is_required ? ' *' : ''));
              fg.appendChild(label);
              let input;
              if (f.field_type === 'textarea') { input = el('textarea', 'form-textarea pd-order-input'); input.placeholder = f.field_name; }
              else if (f.field_type === 'select') {
                const opts = JSON.parse(f.options || '[]');
                input = el('select', 'form-select pd-order-input');
                const defaultOpt = document.createElement('option'); defaultOpt.value = ''; defaultOpt.textContent = `-- Chọn ${f.field_name} --`; input.appendChild(defaultOpt);
                opts.forEach(o => { const opt = document.createElement('option'); opt.value = o; opt.textContent = o; input.appendChild(opt); });
              } else if (f.field_type === 'number') { input = el('input', 'form-input pd-order-input'); input.type = 'number'; input.placeholder = f.field_name; }
              else if (f.field_type === 'email') { input = el('input', 'form-input pd-order-input'); input.type = 'email'; input.placeholder = f.field_name; }
              else { input = el('input', 'form-input pd-order-input'); input.type = 'text'; input.placeholder = f.field_name; }
              input.dataset.field = f.field_name;
              input.required = f.is_required;
              fg.appendChild(input);
              infoSection.appendChild(fg);
            });
          } else {
            const noFields = el('div', 'pd-order-no-fields', 'Không có trường thông tin nào cần điền');
            infoSection.appendChild(noFields);
          }
          orderBody.appendChild(infoSection);

          // C) Coupon/Discount accordion
          const couponWrap = el('div', 'pd-coupon-wrap');
          couponWrap.innerHTML = `
            <div class="pd-coupon-toggle" id="pd-coupon-toggle">
              <span class="pd-coupon-toggle-label"><i class="fa-solid fa-ticket"></i> Bạn có mã giảm giá?</span>
              <span class="pd-coupon-chevron" id="pd-coupon-chevron"><i class="fa-solid fa-chevron-down"></i></span>
            </div>
            <div class="pd-coupon-body" id="pd-coupon-body" style="display:none">
              <div class="pd-coupon-row">
                <input class="pd-coupon-input" id="pd-coupon-code" type="text" placeholder="Nhập mã giảm giá" />
                <button class="pd-coupon-btn" id="pd-coupon-apply">Áp dụng</button>
              </div>
            </div>
          `;
          orderBody.appendChild(couponWrap);

          // D) Price summary
          const priceSummary = el('div', 'pd-price-summary');
          priceSummary.innerHTML = `
            <div class="pd-price-row">
              <span class="pd-price-label">Tạm tính</span>
              <span class="pd-price-value" id="pd-subtotal-price">${fmt(price)}</span>
            </div>
            <div class="pd-price-divider"></div>
            <div class="pd-price-row pd-price-total-row">
              <span class="pd-price-label pd-price-total-label">Tổng cộng</span>
              <span class="pd-price-value pd-price-total-value" id="pd-total-price">${fmt(price)}</span>
            </div>
          `;
          orderBody.appendChild(priceSummary);

          // F) Action buttons row
          const btnRow = el('div', 'pd-btn-row');
          if (oos) {
            btnRow.innerHTML = '<button class="btn pd-btn-buy" disabled>Hết hàng</button>';
          } else if (!currentUser) {
            btnRow.innerHTML = `
              <button class="btn pd-btn-buy pd-btn-login" id="pd-buy-now"><i class="fa-solid fa-arrow-right-to-bracket"></i> Đăng nhập để mua</button>
              <button class="btn pd-btn-cart-icon" id="pd-add-cart" title="Thêm vào giỏ">
                <i class="fa-solid fa-cart-plus"></i>
              </button>
            `;
          } else {
            btnRow.innerHTML = `
              <button class="btn pd-btn-buy" id="pd-buy-now"><i class="fa-solid fa-cart-shopping"></i> Đặt hàng ngay</button>
              <button class="btn pd-btn-cart-icon" id="pd-add-cart" title="Thêm vào giỏ">
                <i class="fa-solid fa-cart-plus"></i>
              </button>
            `;
          }
          orderBody.appendChild(btnRow);

          // Wire up events
          const collectFields = () => {
            const fieldVals = {}; let valid = true;
            qsa('[data-field]', orderBody).forEach(inp => {
              if (inp.required && !inp.value.trim()) { valid = false; toast(`Vui lòng nhập ${inp.dataset.field}`, 'error'); }
              else fieldVals[inp.dataset.field] = inp.value.trim();
            });
            return valid ? fieldVals : null;
          };

          // Coupon toggle
          const couponToggle = qs('#pd-coupon-toggle', orderBody);
          const couponBody = qs('#pd-coupon-body', orderBody);
          const couponChevron = qs('#pd-coupon-chevron', orderBody);
          if (couponToggle) couponToggle.onclick = () => {
            const open = couponBody.style.display !== 'none';
            couponBody.style.display = open ? 'none' : 'block';
            couponChevron.style.transform = open ? '' : 'rotate(180deg)';
            if (open) {
              couponWrap.classList.remove('is-open');
            } else {
              couponWrap.classList.add('is-open');
            }
          };
          const couponApply = qs('#pd-coupon-apply', orderBody);
          if (couponApply) couponApply.onclick = () => {
            const code = qs('#pd-coupon-code', orderBody)?.value.trim();
            if (!code) return toast('Nhập mã giảm giá', 'error');
            toast('Mã giảm giá không hợp lệ', 'error');
          };

          const addCartBtn = qs('#pd-add-cart', orderBody);
          const buyNowBtn = qs('#pd-buy-now', orderBody);
          if (addCartBtn) addCartBtn.onclick = () => {
            if (!selectedPkg) return toast('Chọn gói', 'error');
            if (isOutOfStock(selectedPkg)) return toast('Hết hàng', 'error');
            if (!currentUser) { toast('Đăng nhập để mua', 'error'); return location.hash = '/login'; }
            const f = collectFields();
            if (f) addToCart(p, selectedPkg, quantity, f);
          };
          if (buyNowBtn) buyNowBtn.onclick = () => {
            if (!selectedPkg) return toast('Chọn gói', 'error');
            if (isOutOfStock(selectedPkg)) return toast('Hết hàng', 'error');
            if (!currentUser) { toast('Đăng nhập để mua', 'error'); return location.hash = '/login'; }
            const f = collectFields();
            if (f) { addToCart(p, selectedPkg, quantity, f); location.hash = '/cart'; }
          };
        };
        renderOrderForm();
      } else {
        const noPkgCard = el('div', 'pd-card');
        noPkgCard.innerHTML = '<div class="pd-card-title">Chọn gói sản phẩm</div><p class="text-muted">Hiện chưa có gói sản phẩm.</p>';
        cards.appendChild(noPkgCard);
      }

      // ── Card: Lưu ý ──
      const notesCard = el('div', 'pd-card pd-card-notes');
      notesCard.id = 'pd-notes-card';
      notesCard.style.display = 'none';
      cards.appendChild(notesCard);

      const updateNotesCard = () => {
        const productNotes = p.notes || '';
        const pkgNotes = selectedPkg?.notes || '';
        if (!productNotes && !pkgNotes) {
          notesCard.style.display = 'none';
          return;
        }
        notesCard.style.display = '';
        notesCard.innerHTML = `
          <div class="pd-card-title pd-notes-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Lưu ý quan trọng
          </div>
          <div class="pd-notes-body">
            ${productNotes ? `<div>${productNotes}</div>` : ''}
            ${pkgNotes ? `<div class="pd-pkg-notes-section">${selectedPkg ? `<strong>${selectedPkg.name}:</strong> ` : ''}${pkgNotes}</div>` : ''}
          </div>
        `;
      };
      updateNotesCard();

      // ── Card 5: Đánh giá ──
      if (appSettings.features?.reviews !== false) {
      const reviewCard = el('div', 'pd-card');
      reviewCard.innerHTML = `<div class="pd-card-title pd-review-card-header"><span class="pd-review-card-title-left">${ico.starFill} Đánh giá sản phẩm</span><span class="pd-review-card-badge" id="pd-review-badge">0 đánh giá</span></div>`;
      const reviewBody = el('div', 'pd-review-body');
      reviewCard.appendChild(reviewBody);
      cards.appendChild(reviewCard);

      const renderReviews = () => {
        reviewBody.innerHTML = '';
        // Update badge
        const badge = qs('#pd-review-badge', reviewCard);
        if (badge) badge.textContent = `${reviewData?.total_reviews || 0} đánh giá`;

        if (!reviewData || reviewData.total_reviews === 0) {
          // No reviews — show empty state
          reviewBody.innerHTML = `
            <div class="pd-review-empty">
              <div class="pd-review-empty-icon">${ico.inbox}</div>
              <div class="pd-review-empty-text">Chưa có đánh giá nào cho sản phẩm này</div>
            </div>
          `;
        } else {
          // Summary block — centered layout
          const dist = reviewData.distribution || {};
          const maxCount = Math.max(...Object.values(dist), 1);
          reviewBody.innerHTML = `
            <div class="pd-review-summary">
              <div class="pd-review-big">
                <div class="pd-review-big-num">${reviewData.avg_rating?.toFixed(1) || '—'}</div>
                <div class="pd-review-big-stars">${starsHtml(reviewData.avg_rating || 0, 20)}</div>
                <div class="pd-review-big-count">${reviewData.total_reviews} đánh giá</div>
              </div>
              <div class="pd-review-divider-h"></div>
              <div class="pd-review-bars">
                ${[5,4,3,2,1].map(n => {
                  const count = dist[n] || 0;
                  const pct = reviewData.total_reviews > 0 ? Math.round((count / reviewData.total_reviews) * 100) : 0;
                  return `<div class="pd-bar-row">
                    <span class="pd-bar-label">${n} ${ico.starFill}</span>
                    <div class="pd-bar-track"><div class="pd-bar-fill" style="width:${pct}%"></div></div>
                    <span class="pd-bar-count">${count}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>
          `;

          // Review list
          if (reviewData.items?.length) {
            const list = el('div', 'pd-review-list');
            reviewData.items.forEach(r => {
              const item = el('div', 'pd-review-item');
              item.innerHTML = `
                <div class="pd-review-head">
                  <span class="pd-review-user">${esc(r.user_name)}</span>
                  ${r.is_verified ? '<span class="pd-badge pd-badge-green pd-badge-sm">Đã mua hàng</span>' : ''}
                </div>
                <div class="pd-review-stars">${starsHtml(r.rating, 14)}</div>
                <div class="pd-review-comment">${esc(r.comment)}</div>
                <div class="pd-review-date">${r.created_at ? fmtDate(r.created_at) : ''}</div>
              `;
              list.appendChild(item);
            });
            reviewBody.appendChild(list);
          }

          // Pagination
          if (reviewData.pages > 1) {
            const pag = el('div', 'pd-review-pag');
            for (let i = 1; i <= reviewData.pages; i++) {
              const btn = el('button', 'pd-pag-btn' + (i === reviewPage ? ' active' : ''), String(i));
              btn.onclick = async () => { await loadReviews(i); renderReviews(); };
              pag.appendChild(btn);
            }
            reviewBody.appendChild(pag);
          }
        }

        // Login prompt / Review form area
        const reviewAction = el('div', 'pd-review-action');
        if (!currentUser) {
          reviewAction.innerHTML = `
            <div class="pd-review-login-prompt">
              <div class="pd-review-login-icon">
                <i class="fa-solid fa-arrow-right-to-bracket"></i>
              </div>
              <div class="pd-review-login-text">
                Vui lòng <a href="#/login">đăng nhập</a> và mua hàng để đánh giá sản phẩm
              </div>
            </div>
          `;
        } else {
          const writeBtn = el('button', 'btn btn-primary pd-review-write-btn', 'Viết đánh giá');
          writeBtn.onclick = () => {
            let modalRating = 0;
            const modalHtml = `
              <div class="pd-review-modal">
                <div class="pd-review-modal-title">Viết đánh giá</div>
                <div class="pd-review-modal-stars" id="modal-star-select">
                  ${[1,2,3,4,5].map(i => `<span class="pd-modal-star" data-val="${i}">${ico.star}</span>`).join('')}
                </div>
                <textarea class="form-textarea" id="modal-review-comment" placeholder="Nhập nhận xét của bạn..." rows="4"></textarea>
                <button class="btn btn-primary btn-lg btn-full mt-16" id="modal-review-submit" disabled>Gửi đánh giá</button>
              </div>
            `;
            openModal(modalHtml, 'Viết đánh giá');

            // Wire star selector
            requestAnimationFrame(() => {
              const starSelect = qs('#modal-star-select');
              const submitBtn = qs('#modal-review-submit');
              qsa('.pd-modal-star', starSelect).forEach(s => {
                s.onclick = () => {
                  modalRating = parseInt(s.dataset.val);
                  qsa('.pd-modal-star', starSelect).forEach((ss, idx) => {
                    ss.innerHTML = idx < modalRating ? ico.starFill : ico.star;
                  });
                  submitBtn.disabled = false;
                };
              });
              submitBtn.onclick = async () => {
                const comment = qs('#modal-review-comment').value.trim();
                if (!modalRating) return toast('Chọn số sao', 'error');
                try {
                  await apiFetch('/reviews/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: p.id, rating: modalRating, comment })
                  });
                  toast('Đã gửi đánh giá', 'success');
                  closeModal();
                  await loadReviews(1);
                  renderReviews();
                } catch (e) { toast(e.message || 'Lỗi gửi đánh giá', 'error'); }
              };
            });
          };
          reviewAction.appendChild(writeBtn);
        }
        reviewBody.appendChild(reviewAction);
      };
      renderReviews();
      } // end reviews feature check

      // ── Card 6: Sản phẩm liên quan ──
      if (p.related?.length) {
        const relCard = el('div', 'pd-card');
        relCard.innerHTML = '<div class="pd-card-title">Sản phẩm liên quan</div>';
        const relScroll = el('div', 'pd-rel-scroll');
        p.related.forEach(r => relScroll.appendChild(productCard(r)));
        relCard.appendChild(relScroll);
        cards.appendChild(relCard);
      }

      view.appendChild(cards);
    };

    render();
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`;
  }
}

// CART
window.updateCartQty = function(pkg_id, diff) {
  const item = cart.find(i => i.pkg_id === pkg_id);
  if (item) {
    item.quantity += diff;
    if (item.quantity <= 0) {
      removeFromCart(pkg_id);
    } else {
      saveCart();
      updateAuthUI(); // update header badge
    }
    const view = document.getElementById('app-view');
    if (view && location.hash === '#/cart') renderCart(view);
  }
};

function renderCart(view) {
  view.innerHTML = '';
  
  const heroHead = el('div', 'products-hero');
  heroHead.innerHTML = `
    <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <strong>Giỏ hàng</strong></div>
    <h1 class="products-hero-title"><i class="fa-solid fa-cart-shopping"></i> Giỏ hàng của bạn</h1>
    <p class="products-hero-desc">Kiểm tra lại sản phẩm và tiến hành thanh toán</p>
  `;
  view.appendChild(heroHead);

  // 3 Steps
  view.innerHTML += `
    <div class="checkout-steps-card">
      <div class="checkout-steps">
        <div class="checkout-step active">
          <div class="step-icon"><i class="fa-solid fa-cart-shopping"></i></div>
          <div class="step-label">GIỎ HÀNG</div>
        </div>
        <div class="step-line"></div>
        <div class="checkout-step">
          <div class="step-icon"><i class="fa-solid fa-credit-card"></i></div>
          <div class="step-label">THANH TOÁN</div>
        </div>
        <div class="step-line"></div>
        <div class="checkout-step">
          <div class="step-icon"><i class="fa-solid fa-check"></i></div>
          <div class="step-label">HOÀN TẤT</div>
        </div>
      </div>
    </div>
  `;

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  if (!cart.length) {
    const emptyState = el('div', 'checkout-steps-card', `
      <div style="padding: 40px 20px; text-align: center;">
        <div class="empty-state-icon" style="margin-bottom: 20px;">
          <div style="width: 80px; height: 80px; background: var(--primary); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 32px;">
            <i class="fa-solid fa-cart-shopping"></i>
          </div>
        </div>
        <h3 style="font-size: 22px; font-weight: 700; color: var(--text-heading); margin-bottom: 12px;">Giỏ hàng trống</h3>
        <p style="color: var(--text-muted); margin-bottom: 24px;">Hãy thêm sản phẩm vào giỏ hàng để mua sắm</p>
        <a href="#/" class="btn btn-primary btn-lg" style="width: 100%; max-width: 300px;"><i class="fa-solid fa-bag-shopping"></i> Xem sản phẩm</a>
      </div>
    `);
    view.appendChild(emptyState);
    return;
  }

  // Cart Header Card
  const contentWrapper = el('div');
  
  // Unified card for the items list
  const listCard = el('div', 'info-card');
  
  // Card Header
  const listHeader = el('div', 'info-card-head');
  listHeader.innerHTML = `<div class="info-card-title"><i class="fa-solid fa-list-ul"></i> Danh sách sản phẩm (${totalItems})</div>`;
  listCard.appendChild(listHeader);

  // Card Body
  const listBody = el('div');
  listBody.style.padding = '16px';

  cart.forEach((item, index) => {
    const itemEl = el('div');
    if (index > 0) {
      itemEl.style.borderTop = '1px dashed var(--border)';
      itemEl.style.paddingTop = '16px';
      itemEl.style.marginTop = '16px';
    }
    
    let fieldsHtml = '';
    if (item.fields && Object.keys(item.fields).length > 0) {
      fieldsHtml = `
        <div style="background: var(--bg-body); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin: 16px 0;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-clipboard-list"></i> THÔNG TIN ĐƠN HÀNG
          </div>
          ${Object.entries(item.fields).map(([k,v]) => `
            <div style="margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
              <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">${k}</div>
              <div style="font-weight: 600;">${v}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    itemEl.innerHTML = `
      <div style="position: relative;">
        <div style="display: flex; gap: 16px; align-items: flex-start;">
          ${item.product_img ? `<img src="${item.product_img}" loading="lazy" decoding="async" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border);" />` : `<div style="width: 80px; height: 80px; background: var(--bg-body); border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border);"><i class="fa-solid fa-image text-muted"></i></div>`}
          
          <div style="flex: 1; padding-right: 40px;">
            <div style="font-weight: 700; font-size: 16px; margin-bottom: 6px; color: var(--text-heading);">${item.product_name}</div>
            <div style="color: var(--text-muted); font-size: 14px; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-cube"></i> ${item.pkg_name}</div>
          </div>
          
          <button class="cart-item-remove" data-pkg="${item.pkg_id}" style="position: absolute; top: 0; right: 0; background: #fee2e2; color: #ef4444; border: none; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        ${fieldsHtml}
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
          <div style="color: #ef4444; font-size: 20px; font-weight: 700;">${fmt(item.pkg_price)}</div>
          
          <div style="display: flex; align-items: center; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <button class="qty-btn" onclick="updateCartQty(${item.pkg_id}, -1)" style="width: 36px; height: 36px; border: none; background: transparent; cursor: pointer; color: var(--text-muted);"><i class="fa-solid fa-minus"></i></button>
            <div style="width: 40px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: 600; border-left: 1px solid var(--border); border-right: 1px solid var(--border); background: #fafafa;">${item.quantity}</div>
            <button class="qty-btn" onclick="updateCartQty(${item.pkg_id}, 1)" style="width: 36px; height: 36px; border: none; background: transparent; cursor: pointer; color: var(--text-muted);"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
      </div>
    `;
    listBody.appendChild(itemEl);
  });
  
  listCard.appendChild(listBody);
  contentWrapper.appendChild(listCard);
  const subtotal = cartTotal();
  const taxRate = parseFloat(appSettings.tax_rate) || 0;
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const grandTotal = subtotal + taxAmount;

  const summary = el('div', 'cart-summary-card');
  summary.innerHTML = `
    <div class="cart-summary-head">
      <div class="cart-summary-title"><i class="fa-solid fa-receipt"></i> Tóm tắt đơn hàng</div>
    </div>
    <div class="cart-summary-body">
      <div class="summary-row">
        <span class="summary-label">Tạm tính (${totalItems} sản phẩm)</span>
        <span class="summary-value">${fmt(subtotal)}</span>
      </div>
      ${taxRate > 0 ? `
      <div class="summary-row">
        <span class="summary-label">Thuế (${taxRate}%)</span>
        <span class="summary-value">${fmt(taxAmount)}</span>
      </div>
      ` : ''}
      <div class="divider" style="margin: 16px 0; border-top: 1px dashed var(--border-dark);"></div>
      <div class="summary-row">
        <span class="summary-label fw-700" style="font-size: 16px;">Tổng cộng</span>
        <span class="summary-total" style="font-size: 22px; color: #ef4444;">${fmt(grandTotal)}</span>
      </div>
    </div>
  `;
  
  const couponCard = el('div', 'info-card');
  couponCard.style.marginBottom = '16px';
  couponCard.style.overflow = 'hidden';
  couponCard.innerHTML = `
    <div class="info-card-head" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between;" onclick="const body = this.nextElementSibling; const icon = this.querySelector('.fa-chevron-down'); if(body.style.display==='none'){body.style.display='block';icon.style.transform='rotate(180deg)';}else{body.style.display='none';icon.style.transform='rotate(0)';}">
      <div class="info-card-title"><i class="fa-solid fa-ticket"></i> Mã giảm giá</div>
      <i class="fa-solid fa-chevron-down" style="transition: transform 0.2s; color: #fff;"></i>
    </div>
    <div class="info-card-body" style="display: none;">
      <input type="text" class="form-input" placeholder="Nhập mã giảm giá" style="margin-bottom: 12px; background: #fff; border: 1px solid var(--border); border-radius: 8px; height: 44px;">
      <button class="btn btn-primary btn-full" style="background: #3b5998; border-color: #3b5998; border-radius: 8px; font-weight: 600; box-shadow: 0 2px 4px rgba(59, 89, 152, 0.2);">Áp dụng</button>
    </div>
  `;
  
  const actionsWrap = el('div');
  actionsWrap.innerHTML = `
    <button class="btn btn-primary btn-lg btn-full" id="btn-checkout" style="background: #10b981; border-color: #10b981; border-radius: 12px; margin-bottom: 16px; font-weight: 600; color: #fff; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);"><i class="fa-solid fa-wallet"></i> Thanh toán đơn hàng</button>
    
    <div style="border: 1px solid var(--border); border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden;">
      <button class="btn btn-ghost btn-full" onclick="location.hash='/orders'" style="border-bottom: 1px solid var(--border); border-radius: 0; color: #64748b; font-weight: 500;"><i class="fa-solid fa-receipt"></i> Xem đơn hàng đã đặt</button>
      <button class="btn btn-ghost btn-full" onclick="location.reload()" style="color: #10b981; border-bottom: 1px solid var(--border); border-radius: 0; font-weight: 500;"><i class="fa-solid fa-arrows-rotate"></i> Cập nhật giá</button>
      <button class="btn btn-ghost btn-full" id="btn-clear-cart" style="color: #94a3b8; border-radius: 0; font-weight: 500;"><i class="fa-solid fa-trash-can"></i> Xóa tất cả</button>
    </div>
  `;
  
  contentWrapper.appendChild(summary);
  contentWrapper.appendChild(couponCard);
  contentWrapper.appendChild(actionsWrap);
  view.appendChild(contentWrapper);
  
  contentWrapper.addEventListener('click', e => { const btn = e.target.closest('[data-pkg]'); if (btn) { removeFromCart(parseInt(btn.dataset.pkg)); renderCart(view); } });
  qs('#btn-checkout', actionsWrap).addEventListener('click', () => { if (!currentUser) { toast('Đăng nhập để thanh toán', 'error'); return location.hash = '/login'; } location.hash = '/checkout'; });
  qs('#btn-clear-cart', actionsWrap).addEventListener('click', () => { 
    if (confirm('Bạn muốn xóa tất cả sản phẩm khỏi giỏ?')) { 
      clearCart();
      renderCart(view);
    } 
  });
}

// CHECKOUT
// OFFERS
async function renderOffers(view) {
  view.innerHTML = '';
  
  const heroHead = el('div', 'products-hero');
  heroHead.innerHTML = `
    <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <strong>Ưu đãi</strong></div>
    <h1 class="products-hero-title"><i class="fa-solid fa-gift"></i> Ưu đãi đặc biệt</h1>
    <p class="products-hero-desc">Mã giảm giá và khuyến mãi dành riêng cho bạn</p>
  `;
  view.appendChild(heroHead);

  try {
    const codes = await apiFetch('/gift-codes/public');
    
    if (!codes || codes.length === 0) {
      view.appendChild(el('div', 'empty-state', '<div class="empty-state-icon"><i class="fa-solid fa-box-open" style="color: var(--border-dark);"></i></div><h3>Chưa có ưu đãi nào</h3><p class="text-muted">Các mã giảm giá sẽ xuất hiện tại đây khi có chương trình khuyến mãi.</p>'));
      return;
    }

    const grid = el('div', 'offers-grid');
    grid.innerHTML = codes.map(gc => {
      const discountText = gc.discount_type === 'percent' 
        ? `Giảm ${gc.discount_value}%` 
        : `Giảm ${fmt(gc.discount_value)}`;
      
      const details = [];
      if (gc.description) details.push(gc.description);
      if (gc.min_order > 0) details.push(`Đơn tối thiểu ${fmt(gc.min_order)}`);
      if (gc.max_discount && gc.discount_type === 'percent') details.push(`Giảm tối đa ${fmt(gc.max_discount)}`);
      if (gc.expires_at) details.push(`HSD: ${fmtDate(gc.expires_at)}`);

      return `
        <div class="offer-card">
          <div class="offer-left">
            <div class="offer-icon"><i class="fa-solid fa-ticket"></i></div>
          </div>
          <div class="offer-main">
            <div class="offer-title">${discountText}</div>
            <div class="offer-desc">${details.length > 0 ? details.join(' • ') : 'Áp dụng cho mọi đơn hàng'}</div>
            <div class="offer-bottom">
              <span class="offer-code" onclick="navigator.clipboard.writeText('${gc.code}'); toast('Đã sao chép mã', 'success')">${gc.code}</span>
              <button class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${gc.code}'); toast('Đã sao chép mã', 'success')">Sao chép</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    view.appendChild(grid);
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><h3>Lỗi tải ưu đãi</h3><p>${e.message}</p></div>`;
  }
}

async function renderWishlist(view) {
  if (!currentUser) { location.hash = '/login'; return; }
  view.innerHTML = '';
  const heroHead = el('div', 'products-hero');
  heroHead.innerHTML = `
    <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <strong>Yêu thích</strong></div>
    <h1 class="products-hero-title"><i class="fa-solid fa-heart" style="color:#ef4444"></i> Sản phẩm yêu thích</h1>
    <p class="products-hero-desc">Danh sách sản phẩm bạn đã lưu</p>
  `;
  view.appendChild(heroHead);

  // Search bar
  const searchWrap = el('div', 'wl-search-wrap');
  searchWrap.innerHTML = `<div class="wl-search-bar"><i class="fa-solid fa-search"></i><input type="text" class="wl-search-input" id="wl-search" placeholder="Tìm trong yêu thích..." /></div>`;
  view.appendChild(searchWrap);

  const container = el('div', 'wl-container');
  view.appendChild(container);

  let curPage = 1;
  let searchQ = '';
  let debounceTimer = null;

  const loadPage = async (page) => {
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    try {
      const data = await apiFetch(`/wishlist/?page=${page}&limit=12&q=${encodeURIComponent(searchQ)}`);
      container.innerHTML = '';
      if (!data.items?.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-regular fa-heart" style="font-size:48px;color:var(--text-muted);opacity:0.3;"></i></div><h3>${searchQ ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm yêu thích'}</h3><p class="text-muted">${searchQ ? 'Thử từ khóa khác' : 'Bấm nút ❤️ trên sản phẩm để thêm vào đây'}</p></div>`;
        return;
      }
      const grid = el('div', 'product-grid');
      data.items.forEach(p => grid.appendChild(productCard(p)));
      container.appendChild(grid);

      // Pagination
      if (data.pages > 1) {
        const pager = el('div', 'wl-pager');
        for (let i = 1; i <= data.pages; i++) {
          const btn = el('button', `wl-page-btn ${i === data.page ? 'active' : ''}`);
          btn.textContent = i;
          btn.onclick = () => { curPage = i; loadPage(i); window.scrollTo({ top: 0, behavior: 'smooth' }); };
          pager.appendChild(btn);
        }
        container.appendChild(pager);
      }
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><h3>Lỗi tải danh sách</h3><p>${e.message}</p></div>`;
    }
  };

  qs('#wl-search', view).oninput = (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { searchQ = e.target.value.trim(); curPage = 1; loadPage(1); }, 300);
  };

  await loadPage(1);
}

async function renderCheckout(view) {
  if (!cart.length) return location.hash = '/cart';
  if (!currentUser) { toast('Đăng nhập', 'error'); return location.hash = '/login'; }
  view.innerHTML = '';

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cartTotal();
  const taxRate = parseFloat(appSettings.tax_rate) || 0;
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const grandTotal = subtotal + taxAmount;

  // ── Step 2: Payment Method Selection ──
  let userBalance = 0;
  try { const bData = await apiFetch('/balance'); userBalance = bData.balance || 0; } catch(e) {}

  function renderStep2() {
    view.innerHTML = '';
    const heroHead = el('div', 'products-hero');
    heroHead.innerHTML = `
      <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <a href="#/cart">Giỏ hàng</a> <span>›</span> <strong>Thanh toán</strong></div>
      <h1 class="products-hero-title"><i class="fa-solid fa-credit-card"></i> Chọn phương thức thanh toán</h1>
      <p class="products-hero-desc">Chọn cổng thanh toán và xác nhận đơn hàng</p>
    `;
    view.appendChild(heroHead);

    view.innerHTML += `
      <div class="checkout-steps-card">
        <div class="checkout-steps">
          <div class="checkout-step completed" onclick="location.hash='/cart'" style="cursor:pointer">
            <div class="step-icon"><i class="fa-solid fa-cart-shopping"></i></div>
            <div class="step-label">GIỎ HÀNG</div>
          </div>
          <div class="step-line active"></div>
          <div class="checkout-step active">
            <div class="step-icon"><i class="fa-solid fa-credit-card"></i></div>
            <div class="step-label">THANH TOÁN</div>
          </div>
          <div class="step-line"></div>
          <div class="checkout-step">
            <div class="step-icon"><i class="fa-solid fa-check"></i></div>
            <div class="step-label">HOÀN TẤT</div>
          </div>
        </div>
      </div>
    `;

    const grid = el('div', 'checkout-grid');
    const left = el('div');
    left.innerHTML = `
      <div class="card mb-16">
        <div class="card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
            <div class="fw-700" style="font-size: 16px;"><i class="fa-solid fa-bag-shopping text-primary"></i> Sản phẩm đặt mua</div>
            <div style="background: var(--primary); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">${totalItems} sản phẩm</div>
          </div>
          <div style="border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
            ${cart.map(i => `
              <div style="display: flex; gap: 16px; margin-bottom: ${cart.length > 1 ? '16px' : '0'};">
                ${i.product_img ? `<img src="${i.product_img}" loading="lazy" decoding="async" style="width:60px; height:60px; border-radius:8px; object-fit:cover" />` : `<div style="width:60px; height:60px; border-radius:8px; background:var(--bg-body); display:flex; align-items:center; justify-content:center"><i class="fa-solid fa-image text-muted"></i></div>`}
                <div style="flex:1">
                  <div class="fw-600" style="margin-bottom: 4px;">${i.product_name} <span class="text-primary">x${i.quantity}</span></div>
                  <div class="text-muted text-sm"><i class="fa-solid fa-cube"></i> ${i.pkg_name}</div>
                </div>
                <div class="fw-700" style="color:var(--text-heading)">${fmt(i.pkg_price * i.quantity)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card mb-16">
        <div class="card-body">
          <div class="fw-700 mb-12" style="font-size: 16px;"><i class="fa-solid fa-credit-card text-primary"></i> Phương thức thanh toán</div>
          ${userBalance >= grandTotal ? `
          <div class="payment-option selected" data-method="balance" style="border-color: var(--primary); background: var(--primary-light); cursor: pointer;">
            <div class="payment-option-icon" style="background: #10b981; color: #fff;"><i class="fa-solid fa-wallet"></i></div>
            <div style="flex:1">
              <div class="payment-option-name">Số dư tài khoản</div>
              <div class="payment-option-desc">Số dư hiện tại: <strong style="color:#10b981">${fmt(userBalance)}</strong></div>
            </div>
            <div style="color: var(--primary); font-size: 20px;"><i class="fa-solid fa-circle-check"></i></div>
          </div>` : `
          <div class="payment-option" data-method="balance" style="cursor: not-allowed; opacity: .6; margin-bottom: 0;">
            <div class="payment-option-icon" style="background: #94a3b8; color: #fff;"><i class="fa-solid fa-wallet"></i></div>
            <div style="flex:1">
              <div class="payment-option-name">Số dư tài khoản</div>
              <div class="payment-option-desc">Số dư: <strong style="color:#ef4444">${fmt(userBalance)}</strong> — <a href="#/profile" style="color:var(--primary)">Nạp thêm</a></div>
            </div>
            <div style="color: var(--border); font-size: 20px;"><i class="fa-regular fa-circle"></i></div>
          </div>`}
          <div class="payment-option ${userBalance >= grandTotal ? '' : 'selected'}" data-method="payos" style="${userBalance >= grandTotal ? '' : 'border-color: var(--primary); background: var(--primary-light);'} cursor: pointer; margin-top: 12px;">
            <div class="payment-option-icon" style="background: var(--primary); color: #fff;"><i class="fa-solid fa-qrcode"></i></div>
            <div style="flex:1">
              <div class="payment-option-name">PayOS — QR Ngân hàng</div>
              <div class="payment-option-desc">Chuyển khoản QR, áp dụng mọi ngân hàng VN</div>
            </div>
            <div style="color: ${userBalance >= grandTotal ? 'var(--border)' : 'var(--primary)'}; font-size: 20px;"><i class="${userBalance >= grandTotal ? 'fa-regular fa-circle' : 'fa-solid fa-circle-check'}"></i></div>
          </div>
        </div>
      </div>
    `;

    const right = el('div', 'cart-summary-card');
    right.innerHTML = `
      <div class="cart-summary-head"><div class="cart-summary-title"><i class="fa-solid fa-receipt"></i> Tóm tắt đơn hàng</div></div>
      <div class="cart-summary-body">
        <div class="summary-row"><span class="summary-label">Tạm tính</span><span class="summary-value">${fmt(subtotal)}</span></div>
        ${taxRate > 0 ? `
        <div class="summary-row"><span class="summary-label">Thuế (${taxRate}%)</span><span class="summary-value">${fmt(taxAmount)}</span></div>
        ` : ''}
        <div class="divider" style="margin: 16px 0; border-top: 1px dashed var(--border-dark);"></div>
        <div class="summary-row" style="background: var(--primary-light); padding: 16px; border-radius: 8px; margin: 0 -8px;">
          <span class="summary-label fw-700" style="color: var(--primary); font-size: 16px;">Tổng cộng</span>
          <span class="summary-total" style="font-size: 22px; color: #ef4444;">${fmt(grandTotal)}</span>
        </div>
        <button class="btn btn-primary btn-lg btn-full mt-16" id="btn-continue" style="background: #10b981; border-color: #10b981;"><i class="fa-solid fa-arrow-right"></i> Tiếp tục thanh toán</button>
        <a href="#/cart" class="btn btn-ghost btn-full mt-8" style="text-align: center;"><i class="fa-solid fa-arrow-left"></i> Quay lại giỏ hàng</a>
      </div>
    `;
    grid.appendChild(left); grid.appendChild(right); view.appendChild(grid);

    // Payment method selection
    let selectedMethod = userBalance >= grandTotal ? 'balance' : 'payos';
    qsa('.payment-option', left).forEach(opt => {
      opt.onclick = () => {
        if (opt.dataset.method === 'balance' && userBalance < grandTotal) return; // can't select insufficient
        selectedMethod = opt.dataset.method;
        qsa('.payment-option', left).forEach(o => {
          const isSelected = o.dataset.method === selectedMethod;
          o.style.borderColor = isSelected ? 'var(--primary)' : 'var(--border)';
          o.style.background = isSelected ? 'var(--primary-light)' : 'transparent';
          const icon = o.querySelector('div:last-child i');
          if (icon) {
            icon.className = isSelected ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
            icon.parentElement.style.color = isSelected ? 'var(--primary)' : 'var(--border)';
          }
        });
      };
    });

    // Continue to Step 3
    qs('#btn-continue', right).onclick = () => {
      renderStep3(selectedMethod);
    };
  }

  // ── Step 3: Order Confirmation & Payment ──
  function renderStep3(paymentMethod) {
    view.innerHTML = '';
    const heroHead = el('div', 'products-hero');
    heroHead.innerHTML = `
      <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <a href="#/cart">Giỏ hàng</a> <span>›</span> <strong>Hoàn tất</strong></div>
      <h1 class="products-hero-title"><i class="fa-solid fa-check"></i> Xác nhận & Thanh toán</h1>
      <p class="products-hero-desc">Xác nhận đơn hàng và tiến hành thanh toán</p>
    `;
    view.appendChild(heroHead);

    view.innerHTML += `
      <div class="checkout-steps-card">
        <div class="checkout-steps">
          <div class="checkout-step completed" onclick="location.hash='/cart'" style="cursor:pointer">
            <div class="step-icon"><i class="fa-solid fa-cart-shopping"></i></div>
            <div class="step-label">GIỎ HÀNG</div>
          </div>
          <div class="step-line active"></div>
          <div class="checkout-step completed" style="cursor:pointer" id="step2-back">
            <div class="step-icon"><i class="fa-solid fa-credit-card"></i></div>
            <div class="step-label">THANH TOÁN</div>
          </div>
          <div class="step-line active"></div>
          <div class="checkout-step active">
            <div class="step-icon"><i class="fa-solid fa-check"></i></div>
            <div class="step-label">HOÀN TẤT</div>
          </div>
        </div>
      </div>
    `;

    const methodLabel = paymentMethod === 'balance' ? 'Số dư tài khoản' : 'PayOS — QR Ngân hàng';
    const methodDesc = paymentMethod === 'balance' ? `Trừ trực tiếp từ số dư (${fmt(userBalance)})` : 'Chuyển khoản QR, áp dụng mọi ngân hàng VN';
    const methodIcon = paymentMethod === 'balance' ? 'fa-wallet' : 'fa-qrcode';

    const grid = el('div', 'checkout-grid');
    const left = el('div');
    left.innerHTML = `
      <div class="card mb-16">
        <div class="card-body">
          <div class="fw-700 mb-12" style="font-size: 16px;"><i class="fa-solid fa-bag-shopping text-primary"></i> Xác nhận đơn hàng</div>
          <div style="border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
            ${cart.map(i => `
              <div style="display: flex; gap: 16px; margin-bottom: ${cart.length > 1 ? '16px' : '0'};">
                ${i.product_img ? `<img src="${i.product_img}" loading="lazy" decoding="async" style="width:60px; height:60px; border-radius:8px; object-fit:cover" />` : `<div style="width:60px; height:60px; border-radius:8px; background:var(--bg-body); display:flex; align-items:center; justify-content:center"><i class="fa-solid fa-image text-muted"></i></div>`}
                <div style="flex:1">
                  <div class="fw-600" style="margin-bottom: 4px;">${i.product_name} <span class="text-primary">x${i.quantity}</span></div>
                  <div class="text-muted text-sm"><i class="fa-solid fa-cube"></i> ${i.pkg_name}</div>
                </div>
                <div class="fw-700" style="color:var(--text-heading)">${fmt(i.pkg_price * i.quantity)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card mb-16">
        <div class="card-body">
          <div class="fw-700 mb-12" style="font-size: 16px;"><i class="fa-solid fa-credit-card text-primary"></i> Phương thức thanh toán</div>
          <div class="payment-option selected" style="border-color: var(--primary); background: var(--primary-light);">
            <div class="payment-option-icon" style="background: var(--primary); color: #fff;"><i class="fa-solid ${methodIcon}"></i></div>
            <div style="flex:1">
              <div class="payment-option-name">${methodLabel}</div>
              <div class="payment-option-desc">${methodDesc}</div>
            </div>
            <div style="color: var(--primary); font-size: 20px;"><i class="fa-solid fa-circle-check"></i></div>
          </div>
        </div>
      </div>
    `;

    const right = el('div', 'cart-summary-card');
    right.innerHTML = `
      <div class="cart-summary-head"><div class="cart-summary-title"><i class="fa-solid fa-receipt"></i> Tóm tắt đơn hàng</div></div>
      <div class="cart-summary-body">
        <div class="summary-row"><span class="summary-label">Tạm tính</span><span class="summary-value">${fmt(subtotal)}</span></div>
        ${taxRate > 0 ? `
        <div class="summary-row"><span class="summary-label">Thuế (${taxRate}%)</span><span class="summary-value">${fmt(taxAmount)}</span></div>
        ` : ''}
        <div class="divider" style="margin: 16px 0; border-top: 1px dashed var(--border-dark);"></div>
        <div class="summary-row" style="background: var(--primary-light); padding: 16px; border-radius: 8px; margin: 0 -8px;">
          <span class="summary-label fw-700" style="color: var(--primary); font-size: 16px;">Tổng cộng</span>
          <span class="summary-total" style="font-size: 22px; color: #ef4444;">${fmt(grandTotal)}</span>
        </div>
        <button class="btn btn-primary btn-lg btn-full mt-16" id="btn-pay" style="background: #10b981; border-color: #10b981;"><i class="fa-solid fa-wallet"></i> Tạo đơn & Thanh toán</button>
        <button class="btn btn-ghost btn-full mt-8" id="btn-back-step2" style="text-align: center;"><i class="fa-solid fa-arrow-left"></i> Quay lại chọn phương thức</button>
      </div>
    `;
    grid.appendChild(left); grid.appendChild(right); view.appendChild(grid);

    // Back to Step 2
    qs('#btn-back-step2', right).onclick = () => renderStep2();
    const step2Back = qs('#step2-back');
    if (step2Back) step2Back.onclick = () => renderStep2();

    // Pay button
    qs('#btn-pay', right).onclick = async () => {
      const btn = qs('#btn-pay', right); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
      try {
        const item = cart[0];
        const order = await apiFetch('/orders/create', { method: 'POST', body: JSON.stringify({ package_id: item.pkg_id, quantity: item.quantity, custom_fields_data: item.fields || {}, payment_method: paymentMethod }) });
        if (paymentMethod === 'payos') {
          const link = await apiFetch('/payment/create-link', { method: 'POST', body: JSON.stringify({ order_code: order.order_code }) });
          cart.length = 0; saveCart(); updateCartCount();
          window.open(link.payment_url, '_blank');
          toast('Đã tạo đơn! Chuyển đến thanh toán...', 'success', 5000);
          location.hash = `/orders/${order.order_code}`;
        } else {
          // Balance payment — already paid
          cart.length = 0; saveCart(); updateCartCount();
          toast('Thanh toán thành công!', 'success');
          location.hash = `/orders/${order.order_code}`;
        }
      } catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wallet"></i> Tạo đơn & Thanh toán'; }
    };
  }

  // Start at Step 2
  renderStep2();
}

// ORDERS
async function renderOrders(view) {
  if (!currentUser) return location.hash = '/login';
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const data = await apiFetch('/orders/my');
    view.innerHTML = '';
    
    const heroHead = el('div', 'products-hero');
    heroHead.innerHTML = `
      <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <strong>Đơn hàng</strong></div>
      <h1 class="products-hero-title"><i class="fa-solid fa-receipt"></i> Đơn hàng của tôi</h1>
      <p class="products-hero-desc">Quản lý các sản phẩm bạn đã mua và theo dõi trạng thái (${data.total} đơn)</p>
    `;
    view.appendChild(heroHead);
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
    
    // 3 Steps (Hoàn tất is active here)
    if (d.status === 'completed' || d.status === 'pending_payment') {
      view.innerHTML += `
        <div class="checkout-steps-card">
          <div class="checkout-steps">
            <div class="checkout-step completed" onclick="location.hash='/cart'" style="cursor:pointer">
              <div class="step-icon"><i class="fa-solid fa-cart-shopping"></i></div>
              <div class="step-label">GIỎ HÀNG</div>
            </div>
            <div class="step-line active"></div>
            <div class="checkout-step completed" onclick="location.hash='/checkout'" style="cursor:pointer">
              <div class="step-icon"><i class="fa-solid fa-credit-card"></i></div>
              <div class="step-label">THANH TOÁN</div>
            </div>
            <div class="step-line active"></div>
            <div class="checkout-step active">
              <div class="step-icon"><i class="fa-solid fa-check"></i></div>
              <div class="step-label">HOÀN TẤT</div>
            </div>
          </div>
        </div>
      `;
    }

    const heroHead = el('div', 'products-hero');
    heroHead.innerHTML = `
      <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <a href="#/orders">Đơn hàng</a> <span>›</span> <strong>#${d.order_code}</strong></div>
      <h1 class="products-hero-title"><i class="fa-solid fa-file-invoice"></i> Chi tiết đơn hàng</h1>
      <p class="products-hero-desc">Đơn hàng #${d.order_code} — ${fmtDate(d.created_at)}</p>
    `;
    view.appendChild(heroHead);

    // Determine status badge classes
    let statusClass = 'badge-gray';
    let statusText = 'Không xác định';
    let statusIcon = '<i class="fa-solid fa-circle-question"></i>';
    
    if (d.status === 'completed') {
      statusClass = 'badge-green'; statusText = 'Hoàn thành'; statusIcon = '<i class="fa-solid fa-circle-check"></i>';
    } else if (d.status === 'pending') {
      statusClass = 'badge-yellow'; statusText = 'Chờ xử lý'; statusIcon = '<i class="fa-solid fa-clock"></i>';
    } else if (d.status === 'pending_payment') {
      statusClass = 'badge-yellow'; statusText = 'Chờ thanh toán'; statusIcon = '<i class="fa-solid fa-wallet"></i>';
    } else if (d.status === 'cancelled') {
      statusClass = 'badge-red'; statusText = 'Đã hủy'; statusIcon = '<i class="fa-solid fa-circle-xmark"></i>';
    }

    const grid = el('div', 'checkout-grid'); // reuse checkout layout
    
    // LEFT COL: Order details
    const leftCol = el('div');
    
    // Order info card
    leftCol.innerHTML += `
      <div class="card mb-16">
        <div class="card-body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div>
              <div class="fw-700" style="font-size: 16px; margin-bottom: 4px;">Đơn hàng #${d.order_code}</div>
              <div class="text-muted text-sm"><i class="fa-solid fa-calendar"></i> ${fmtDate(d.created_at)}</div>
            </div>
            <div class="badge ${statusClass}" style="font-size: 13px; padding: 6px 12px;">${statusIcon} ${statusText}</div>
          </div>
          
          <div class="fw-600 mb-12" style="font-size: 15px;"><i class="fa-solid fa-box"></i> Sản phẩm</div>
          <div style="border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
            <div style="display: flex; gap: 16px;">
              <div style="flex:1">
                <div class="fw-600" style="margin-bottom: 4px;">${d.product_name || 'Sản phẩm'}</div>
                <div class="text-muted text-sm"><i class="fa-solid fa-cube"></i> ${d.package_name || 'Gói'} x${d.quantity}</div>
              </div>
              <div class="fw-700" style="color:var(--text-heading)">${fmt(d.total_amount)}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Custom Fields Data (if exists)
    if (d.custom_fields_data && Object.keys(d.custom_fields_data).length > 0) {
      leftCol.innerHTML += `
        <div class="card mb-16">
          <div class="card-body">
            <div class="fw-600 mb-12" style="font-size: 15px;"><i class="fa-solid fa-clipboard-list"></i> Thông tin bạn đã cung cấp</div>
            <div style="background: var(--bg-body); border-radius: 8px; padding: 16px;">
              ${Object.entries(d.custom_fields_data).map(([k,v]) => `
                <div style="margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
                  <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">${k}</div>
                  <div style="font-weight: 600;">${v}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // Delivery Data (if completed)
    if (d.status === 'completed' && d.delivery_data) {
      leftCol.innerHTML += `
        <div class="card mb-16" style="border-color: #10b981;">
          <div class="card-body">
            <div class="fw-700 mb-12" style="font-size: 16px; color: #10b981;"><i class="fa-solid fa-gift"></i> Thông tin nhận hàng</div>
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; position: relative;">
              <pre style="white-space: pre-wrap; word-break: break-all; margin: 0; font-family: monospace; font-size: 14px; line-height: 1.5; color: #065f46;">${d.delivery_data}</pre>
              <button class="btn btn-sm btn-primary" onclick="navigator.clipboard.writeText(\`${d.delivery_data.replace(/`/g, '\\`')}\`).then(()=>toast('Đã sao chép','success'))" style="position: absolute; top: 12px; right: 12px; background: #10b981; border: none;"><i class="fa-solid fa-copy"></i> Copy</button>
            </div>
          </div>
        </div>
      `;
    }

    // RIGHT COL: Payment & Summary
    const rightCol = el('div');
    
    let paymentActionHtml = '';
    if (d.status === 'pending' || d.status === 'pending_payment') {
      paymentActionHtml = `
        <div class="card mt-16" style="border-color:var(--yellow); background:var(--yellow-light)">
          <div class="card-body">
            <div class="fw-600 mb-8" style="color:var(--yellow)"><i class="fa-solid fa-circle-info"></i> Chờ thanh toán</div>
            <p class="text-sm mb-16" style="color:#B45309">Đơn hàng của bạn đang chờ được thanh toán. Vui lòng thanh toán để nhận hàng.</p>
            <button class="btn btn-primary btn-full" onclick="location.href='/api/payment/pay/${d.order_code}'" style="background: #D97706; border-color: #D97706;"><i class="fa-solid fa-money-bill"></i> Thanh toán ngay</button>
            <button class="btn btn-ghost btn-full mt-8" id="btn-check-status"><i class="fa-solid fa-rotate"></i> Cập nhật trạng thái</button>
          </div>
        </div>
      `;
    }

    const taxRate = parseFloat(appSettings.tax_rate) || 0;
    const subtotalCalc = taxRate > 0 ? Math.round(d.total_amount / (1 + taxRate/100)) : d.total_amount;
    const taxAmountCalc = d.total_amount - subtotalCalc;

    rightCol.innerHTML = `
      <div class="cart-summary-card">
        <div class="cart-summary-head"><div class="cart-summary-title"><i class="fa-solid fa-receipt"></i> Tóm tắt đơn hàng</div></div>
        <div class="cart-summary-body">
          <div class="summary-row"><span class="summary-label">Tạm tính</span><span class="summary-value">${fmt(subtotalCalc)}</span></div>
          ${taxRate > 0 ? `
          <div class="summary-row"><span class="summary-label">Thuế (${taxRate}%)</span><span class="summary-value">${fmt(taxAmountCalc)}</span></div>
          ` : ''}
          <div class="divider" style="margin: 16px 0; border-top: 1px dashed var(--border-dark);"></div>
          <div class="summary-row"><span class="summary-label fw-700" style="font-size: 16px;">Tổng cộng</span><span class="summary-total" style="color: #ef4444; font-size: 22px;">${fmt(d.total_amount)}</span></div>
          
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-dark);">
            <div class="fw-600 mb-12" style="font-size: 14px;">Phương thức thanh toán</div>
            <div style="display: flex; align-items: center; gap: 12px; background: var(--bg-body); padding: 12px; border-radius: 8px;">
              <div style="width: 32px; height: 32px; background: #fff; border-radius: 6px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: var(--primary);"><i class="fa-solid fa-wallet"></i></div>
              <div class="fw-600 text-sm">${d.payment_method?.toUpperCase() || 'Chuyển khoản'}</div>
            </div>
          </div>
        </div>
      </div>
      ${paymentActionHtml}
    `;

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    view.appendChild(grid);
    
    qs('#btn-check-status', rightCol)?.addEventListener('click', () => renderOrderDetail(view, { code }));
  } catch (e) { view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`; }
}

// LOGIN
let _authConfig = null;
async function getAuthConfig() {
  if (_authConfig) return _authConfig;
  _authConfig = await apiFetch('/auth/config').catch(() => ({}));
  return _authConfig;
}


