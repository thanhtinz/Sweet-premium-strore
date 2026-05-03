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

