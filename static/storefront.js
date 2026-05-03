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
    let selectedPkg = p.packages?.[0] || null;
    let quantity = 1;
    let reviewPage = 1;
    let reviewData = null;

    // ── Helpers ──
    const isOutOfStock = (pkg) => pkg.delivery_type === 'auto' && pkg.stock_count < 1;
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
        reviewData = await apiFetch(`/reviews/product/${p.id}?page=${page}&limit=10`);
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
      view.appendChild(el('div', 'breadcrumb mb-16', `<a href="#/">Trang chủ</a> <span>›</span> ${p.category_name ? `<a href="#/category/${p.category_slug || p.category_id}">${p.category_name}</a> <span>›</span> ` : ''}${p.name}`));

      // ── Top section: 2-col grid ──
      const topGrid = el('div', 'pd-top-grid');

      // Left: Image
      const imgWrap = el('div', 'pd-top-img');
      imgWrap.innerHTML = p.image_url
        ? `<img src="${p.image_url}" alt="${p.name}" />`
        : `<div class="pd-top-img-ph">${ico.box}</div>`;

      // Right: Info
      const infoWrap = el('div', 'pd-top-info');
      infoWrap.innerHTML = `
        ${p.category_name ? `<span class="pd-cat-badge">${p.category_name}</span>` : ''}
        <h1 class="pd-name">${p.name}</h1>
        <div class="pd-rating-row">
          <span class="pd-rating-stars">${starsHtml(p.review_avg || 0)}</span>
          <span class="pd-rating-avg">${p.review_avg ? p.review_avg.toFixed(1) : '—'}</span>
          <span class="pd-rating-count">(${p.review_count || 0} đánh giá)</span>
        </div>
        <div class="pd-short-desc">${p.description || ''}</div>
      `;

      topGrid.appendChild(imgWrap);
      topGrid.appendChild(infoWrap);
      view.appendChild(topGrid);

      // ── Cards section ──
      const cards = el('div', 'pd-cards');

      // ── Card 1: Chọn gói sản phẩm ──
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
          pill.innerHTML = `
            <div class="pd-pkg-main">
              <div class="pd-pkg-name${oos ? ' oos-text' : ''}">${pkg.name}</div>
              ${pkg.description ? `<div class="pd-pkg-desc">${pkg.description}</div>` : ''}
              <div class="pd-pkg-badges">
                ${pkg.delivery_type === 'auto'
                  ? (pkg.stock_count > 0
                    ? `<span class="pd-badge pd-badge-green">Còn hàng (${pkg.stock_count})</span>`
                    : `<span class="pd-badge pd-badge-red">Hết hàng</span>`)
                  : `<span class="pd-badge pd-badge-blue">Giao thủ công</span>`
                }
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

          // Package summary
          orderBody.innerHTML = `
            <div class="pd-order-summary">
              <span class="pd-order-pkg-name">${selectedPkg.name}</span>
              <span class="pd-order-pkg-price">${fmt(price)}</span>
            </div>
          `;

          // Custom fields
          if (selectedPkg.fields?.length) {
            const fieldsSection = el('div', 'pd-order-fields');
            fieldsSection.innerHTML = '<div class="pd-order-fields-title">Thông tin yêu cầu</div>';
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
              input.dataset.field = f.field_name;
              input.required = f.is_required;
              fg.appendChild(input);
              fieldsSection.appendChild(fg);
            });
            orderBody.appendChild(fieldsSection);
          }

          // Quantity
          const qtyRow = el('div', 'pd-qty-row');
          qtyRow.innerHTML = `
            <span class="pd-qty-label">Số lượng</span>
            <div class="pd-qty-controls">
              <button class="pd-qty-btn" id="pd-qty-minus">−</button>
              <span class="pd-qty-val" id="pd-qty-val">${quantity}</span>
              <button class="pd-qty-btn" id="pd-qty-plus">+</button>
            </div>
          `;
          orderBody.appendChild(qtyRow);

          // Total
          const totalRow = el('div', 'pd-total-row');
          totalRow.innerHTML = `
            <span>Tổng cộng</span>
            <span class="pd-total-price" id="pd-total-price">${fmt(price * quantity)}</span>
          `;
          orderBody.appendChild(totalRow);

          // Buttons
          const btnRow = el('div', 'pd-btn-row');
          if (oos) {
            btnRow.innerHTML = '<button class="btn btn-lg btn-full" disabled>Hết hàng</button>';
          } else {
            btnRow.innerHTML = `
              <button class="btn btn-outline btn-lg" id="pd-add-cart">Thêm vào giỏ</button>
              <button class="btn btn-primary btn-lg btn-full" id="pd-buy-now">Mua ngay</button>
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

          const minusBtn = qs('#pd-qty-minus', orderBody);
          const plusBtn = qs('#pd-qty-plus', orderBody);
          if (minusBtn) minusBtn.onclick = () => {
            if (quantity > 1) { quantity--; qs('#pd-qty-val', orderBody).textContent = quantity; qs('#pd-total-price', orderBody).textContent = fmt(price * quantity); }
          };
          if (plusBtn) plusBtn.onclick = () => {
            quantity++; qs('#pd-qty-val', orderBody).textContent = quantity; qs('#pd-total-price', orderBody).textContent = fmt(price * quantity);
          };

          const addCartBtn = qs('#pd-add-cart', orderBody);
          const buyNowBtn = qs('#pd-buy-now', orderBody);
          if (addCartBtn) addCartBtn.onclick = () => {
            if (!selectedPkg) return toast('Chọn gói', 'error');
            if (isOutOfStock(selectedPkg)) return toast('Hết hàng', 'error');
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

      // ── Card 3: Mô tả sản phẩm ──
      if (p.description) {
        const descCard = el('div', 'pd-card');
        descCard.innerHTML = '<div class="pd-card-title">Mô tả sản phẩm</div>';
        const descBody = el('div', 'pd-desc-body');
        descBody.innerHTML = p.description;
        descCard.appendChild(descBody);
        cards.appendChild(descCard);

        // Collapsible logic
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

      // ── Card 4: Lưu ý ──
      if (p.notes) {
        const notesCard = el('div', 'pd-card pd-card-notes');
        notesCard.innerHTML = `
          <div class="pd-card-title pd-notes-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Lưu ý quan trọng
          </div>
          <div class="pd-notes-body">${p.notes}</div>
        `;
        cards.appendChild(notesCard);
      }

      // ── Card 5: Đánh giá ──
      const reviewCard = el('div', 'pd-card');
      reviewCard.innerHTML = '<div class="pd-card-title">Đánh giá</div>';
      const reviewBody = el('div', 'pd-review-body');
      reviewCard.appendChild(reviewBody);
      cards.appendChild(reviewCard);

      const renderReviews = () => {
        reviewBody.innerHTML = '';
        if (!reviewData || reviewData.total_reviews === 0) {
          reviewBody.innerHTML = '<p class="text-muted">Chưa có đánh giá nào.</p>';
        } else {
          // Summary
          const dist = reviewData.distribution || {};
          const maxCount = Math.max(...Object.values(dist), 1);
          reviewBody.innerHTML = `
            <div class="pd-review-summary">
              <div class="pd-review-big">
                <div class="pd-review-big-num">${reviewData.avg_rating?.toFixed(1) || '—'}</div>
                <div class="pd-review-big-stars">${starsHtml(reviewData.avg_rating || 0)}</div>
                <div class="pd-review-big-count">${reviewData.total_reviews} đánh giá</div>
              </div>
              <div class="pd-review-bars">
                ${[5,4,3,2,1].map(n => {
                  const count = dist[n] || 0;
                  const pct = reviewData.total_reviews > 0 ? Math.round((count / reviewData.total_reviews) * 100) : 0;
                  return `<div class="pd-bar-row">
                    <span class="pd-bar-label">${n}★</span>
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
                  <span class="pd-review-user">${r.user_name}</span>
                  ${r.is_verified ? '<span class="pd-badge pd-badge-green pd-badge-sm">Đã mua hàng</span>' : ''}
                </div>
                <div class="pd-review-stars">${starsHtml(r.rating, 14)}</div>
                <div class="pd-review-comment">${r.comment || ''}</div>
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

        // Write review button
        if (currentUser) {
          const writeBtn = el('button', 'btn btn-outline mt-16', 'Viết đánh giá');
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
          reviewBody.appendChild(writeBtn);
        }
      };
      renderReviews();

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

