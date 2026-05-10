// ═══════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════

// Admin shell has been removed, admin view uses the exact same layout as the main storefront.
// The sidebar has already been reconfigured for admin mode in app.js.
function renderAdminShell(wrap) {
  // no-op - layout is now handled globally
}

// CoreUI-style page header helper
function cuiPageHeader(title, subtitle, actionsHtml = '') {
  return `<div class="cui-page-header">
    <div class="cui-page-header-left">
      <div class="cui-page-title">${title}</div>
      ${subtitle ? `<div class="cui-page-subtitle">${subtitle}</div>` : ''}
    </div>
    ${actionsHtml ? `<div class="cui-page-actions">${actionsHtml}</div>` : ''}
  </div>`;
}

async function uploadAdminImage(file, { input = null, preview = null } = {}) {
  if (!file) return null;
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/banners/admin/upload-image', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Upload failed');
  const imageUrl = data.url;
  if (input) {
    input.value = imageUrl;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (preview) renderAdminImagePreview(preview, imageUrl);
  return data;
}

function renderAdminImagePreview(preview, url, emptyText = 'Chưa có ảnh') {
  if (!preview) return;
  if (!url) {
    preview.innerHTML = `<span>${emptyText}</span>`;
    return;
  }
  preview.innerHTML = `<img src="${url}" alt="Preview" />`;
}

function imageUploadControl(inputId, uploadId, label = 'Upload', previewId = '') {
  return `<label class="btn btn-ghost btn-sm admin-image-upload-btn" style="white-space:nowrap;cursor:pointer;"><i class="fa-solid fa-upload"></i> ${label}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" id="${uploadId}" data-image-target="${inputId}" ${previewId ? `data-image-preview="${previewId}"` : ''} style="display:none" /></label>`;
}

function bindImageUpload(uploadId, inputId, { previewId = null } = {}) {
  const upload = qs(`#${uploadId}`);
  const input = qs(`#${inputId}`);
  const preview = previewId ? qs(`#${previewId}`) : null;
  if (!upload || !input) return;
  upload.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAdminImage(file, { input, preview });
      toast('Upload thành công', 'success');
    } catch (err) {
      toast('Upload thất bại: ' + err.message, 'error');
    } finally {
      upload.value = '';
    }
  };
}

function bindImageUploads(root = document) {
  qsa('input[type="file"][data-image-target]', root).forEach(upload => {
    const input = qs(`#${upload.dataset.imageTarget}`, root) || qs(`#${upload.dataset.imageTarget}`);
    const preview = upload.dataset.imagePreview ? (qs(`#${upload.dataset.imagePreview}`, root) || qs(`#${upload.dataset.imagePreview}`)) : null;
    if (!input || upload.dataset.boundUpload === '1') return;
    upload.dataset.boundUpload = '1';
    upload.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await uploadAdminImage(file, { input, preview });
        toast('Upload thành công', 'success');
      } catch (err) {
        toast('Upload thất bại: ' + err.message, 'error');
      } finally {
        upload.value = '';
      }
    };
  });
}

// ADMIN DASHBOARD
async function renderAdmin(view) {
  if (!view) return;
  const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const data = await apiFetch('/admin/dashboard');
    const s = data.stats;
    content.innerHTML = `
      ${cuiPageHeader('Dashboard', 'Tổng quan vận hành cửa hàng')}
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon purple"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-info"><div class="stat-label">Tổng đơn</div><div class="stat-value">${s.total_orders}</div></div></div>
        <div class="stat-card"><div class="stat-icon yellow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="stat-info"><div class="stat-label">Chờ xử lý</div><div class="stat-value">${s.pending_orders}</div></div></div>
        <div class="stat-card"><div class="stat-icon green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><div class="stat-info"><div class="stat-label">Hoàn thành</div><div class="stat-value">${s.completed_orders}</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div><div class="stat-info"><div class="stat-label">Sản phẩm</div><div class="stat-value">${s.total_products}</div></div></div>
        <div class="stat-card"><div class="stat-icon cyan"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></div><div class="stat-info"><div class="stat-label">Kho hàng</div><div class="stat-value">${s.total_stock_available}</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-info"><div class="stat-label">Doanh thu</div><div class="stat-value">${fmt(s.total_revenue)}</div></div></div>
      </div>
      <div class="card"><div class="card-header"><div class="card-title">Đơn hàng gần đây</div></div>
      <div class="table-wrap">
        <table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead>
        <tbody>${data.recent_orders.map(o => `<tr><td class="td-mono">${o.order_code}</td><td>${o.user_email || '—'}</td><td>${o.product_name || '—'}</td><td class="text-primary">${fmt(o.total_amount)}</td><td>${statusBadge(o.status)}</td><td class="text-sm text-muted">${fmtDate(o.created_at)}</td></tr>`).join('')}</tbody>
        </table></div></div>
    `;
  } catch (e) { content.innerHTML = `<p class="text-muted">${e.message}</p>`; }
}

// ADMIN CATEGORIES
async function renderAdminCategories(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  
  let catMap = {};
  
  // Event delegation — bound once
  content.onclick = async (e) => {
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      e.preventDefault();
      const row = delBtn.closest('tr');
      const catName = row?.querySelector('.td-bold')?.textContent?.trim() || 'danh mục này';
      if (!confirm(`Xóa ${catName}? Các sản phẩm đang thuộc danh mục này sẽ bị gỡ khỏi danh mục.`)) return;
      try {
        await apiFetch(`/categories/${delBtn.dataset.del}`, { method: 'DELETE' });
        toast('Đã xóa danh mục', 'success');
        await refresh();
      }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) { showCatModal(catMap[parseInt(editBtn.dataset.edit)], refresh, Object.values(catMap)); return; }
    const addBtn = e.target.closest('#btn-add-cat');
    if (addBtn) { showCatModal(null, refresh, Object.values(catMap)); return; }
  };

  const refresh = async () => {
    const [cats, tree] = await Promise.all([apiFetch('/categories/all'), apiFetch('/categories/')]);
    catMap = {};
    cats.forEach(c => { catMap[c.id] = c; });
    const renderRows = (items, depth = 0) => items.map(c => {
      const indent = depth > 0 ? `padding-left:${depth * 24}px;` : '';
      const prefix = depth > 0 ? '<span style="color:var(--text-muted);margin-right:6px;">↳</span>' : '';
      const iconImg = c.icon_url ? `<img src="${c.icon_url}" style="width:18px;height:18px;border-radius:4px;vertical-align:middle;margin-right:6px;object-fit:cover;" alt="" />` : '';
      let row = `<tr><td class="text-muted">#${c.id}</td><td class="td-bold" style="${indent}">${prefix}${iconImg}${esc(c.name)}</td><td class="td-mono">${esc(c.slug)}</td><td>${c.is_active ? '<span class="badge badge-green">Hiện</span>' : '<span class="badge badge-gray">Ẩn</span>'}</td><td>${c.sort_order}</td><td><div class="tbl-actions"><button class="tbl-btn tbl-edit" data-edit="${c.id}">Sửa</button><button class="tbl-btn tbl-delete" data-del="${c.id}">Xóa</button></div></td></tr>`;
      if (c.children?.length) row += renderRows(c.children, depth + 1);
      return row;
    }).join('');
    content.innerHTML = `
      ${cuiPageHeader('Danh mục', 'Tổ chức nhóm sản phẩm và điều hướng', '<button class="btn btn-primary" id="btn-add-cat"><i class="fa-solid fa-plus"></i> Thêm danh mục</button>')}
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Tên</th><th>Slug</th><th>Trạng thái</th><th>Thứ tự</th><th></th></tr></thead>
        <tbody>${renderRows(tree)}</tbody>
      </table></div>
    `;
  };
  await refresh();
}

function showCatModal(cat, refresh, allCats = []) {
  const excludeId = cat?.id;
  const topLevelCats = allCats.filter(c => !c.parent_id && c.id !== excludeId);
  const parentOptions = topLevelCats
    .map(c => `<option value="${c.id}" ${cat?.parent_id === c.id ? 'selected' : ''}>${c.name}</option>`)
    .join('');

  openModal(`
    <form id="cat-form">
      <div class="form-group"><label class="form-label">Tên<span class="req">*</span></label><input class="form-input" id="cf-name" value="${cat?.name || ''}" required /></div>
      <div class="form-group"><label class="form-label">Slug</label><input class="form-input" id="cf-slug" value="${cat?.slug || ''}" placeholder="tự động" /></div>
      <div class="form-group"><label class="form-label">Danh mục cha</label><select class="form-select" id="cf-parent"><option value="">Không có (danh mục gốc)</option>${parentOptions}</select></div>
      <div class="form-group">
        <label class="form-label">URL icon</label>
        <div class="flex gap-8 items-center">
          <input class="form-input flex-1" id="cf-icon" value="${cat?.icon_url || ''}" placeholder="https://..." />
          ${imageUploadControl('cf-icon', 'cf-icon-upload', 'Upload', 'cf-icon-preview')}
        </div>
        <div class="admin-upload-preview admin-upload-preview-sm" id="cf-icon-preview">${cat?.icon_url ? `<img src="${cat.icon_url}" alt="Icon preview" />` : '<span>Chưa có icon</span>'}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Hình ảnh (URL)</label>
        <div class="flex gap-8 items-center">
          <input class="form-input flex-1" id="cf-image" value="${cat?.image_url || ''}" placeholder="https://..." />
          ${imageUploadControl('cf-image', 'cf-image-upload', 'Upload', 'cf-image-preview')}
        </div>
        <div class="admin-upload-preview" id="cf-image-preview">${cat?.image_url ? `<img src="${cat.image_url}" alt="Image preview" />` : '<span>Chưa có ảnh</span>'}</div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Thứ tự</label><input type="number" class="form-input" id="cf-order" value="${cat?.sort_order ?? 0}" /></div>
        <div class="form-group"><label class="form-label">Hiển thị</label><select class="form-select" id="cf-active"><option value="true" ${cat?.is_active !== false ? 'selected' : ''}>Hiện</option><option value="false" ${cat?.is_active === false ? 'selected' : ''}>Ẩn</option></select></div>
      </div>
      <div id="cat-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">${cat ? 'Cập nhật' : 'Tạo mới'}</button><button type="button" class="btn btn-ghost" id="cat-cancel">Hủy</button></div>
    </form>
  `, cat ? `Sửa: ${cat.name}` : 'Thêm danh mục');
  qs('#cat-cancel').onclick = closeModal;

  bindImageUploads(qs('#modal-content'));

  qs('#cat-form').onsubmit = async (e) => {
    e.preventDefault();
    const parentId = qs('#cf-parent').value;
    const body = { name: qs('#cf-name').value, slug: qs('#cf-slug').value || undefined, icon_url: qs('#cf-icon').value || undefined, image_url: qs('#cf-image').value || undefined, parent_id: parentId ? parseInt(parentId) : null, sort_order: parseInt(qs('#cf-order').value) || 0, is_active: qs('#cf-active').value === 'true' };
    try { if (cat) await apiFetch(`/categories/${cat.id}`, { method: 'PUT', body: JSON.stringify(body) }); else await apiFetch('/categories/', { method: 'POST', body: JSON.stringify(body) }); closeModal(); toast(cat ? 'Cập nhật!' : 'Tạo mới!', 'success'); refresh(); }
    catch (err) { const e = qs('#cat-form-err'); e.textContent = err.message; e.style.display = 'block'; }
  };
}

// ADMIN PRODUCTS
async function renderAdminProducts(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  
  let currentProducts = [], currentCats = [];
  
  // Event delegation — bound once, survives innerHTML refreshes
  content.onclick = async (e) => {
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      e.preventDefault();
      const row = delBtn.closest('tr');
      const productName = row?.querySelector('.td-bold')?.textContent?.trim() || 'sản phẩm này';
      if (!confirm(`Xóa ${productName}? Nếu sản phẩm đã có đơn, hệ thống sẽ tự ẩn thay vì xóa hẳn dữ liệu.`)) return;
      try {
        await apiFetch(`/products/${delBtn.dataset.del}`, { method: 'DELETE' });
        toast('Đã xử lý xóa sản phẩm', 'success');
        await refresh();
      }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) { showProductModal(currentProducts.find(p => p.id === parseInt(editBtn.dataset.edit)), currentCats, refresh); return; }
    const pkgBtn = e.target.closest('[data-pkg]');
    if (pkgBtn) {
      const product = currentProducts.find(p => p.id === parseInt(pkgBtn.dataset.pkg));
      showPackagesModal(parseInt(pkgBtn.dataset.pkg), decodeURIComponent(pkgBtn.dataset.pname), product);
      return;
    }
    const addBtn = e.target.closest('#btn-add-prod');
    if (addBtn) { showProductModal(null, currentCats, refresh); return; }
  };

  const refresh = async () => {
    const [products, cats] = await Promise.all([apiFetch('/products/admin/all'), apiFetch('/categories/all')]);
    currentProducts = products; currentCats = cats;
    content.innerHTML = `
      ${cuiPageHeader('Sản phẩm', 'Quản lý sản phẩm, gói bán và nội dung hiển thị', '<button class="btn btn-primary" id="btn-add-prod"><i class="fa-solid fa-plus"></i> Thêm</button>')}
      <div class="table-wrap"><table>
        <thead><tr><th>Tên</th><th>Danh mục</th><th>Gói</th><th>Giá từ</th><th>Nổi bật</th><th>TT</th><th></th></tr></thead>
        <tbody>${products.map(p => `<tr><td class="td-bold">${p.name}</td><td class="text-muted">${p.category_name || '—'}</td><td>${(p.packages||[]).length}</td><td class="text-primary">${p.min_price ? fmt(p.min_price) : '—'}</td><td>${p.is_featured ? ico.starFill : '—'}</td><td>${p.is_active ? '<span class="badge badge-green">Hiện</span>' : '<span class="badge badge-gray">Ẩn</span>'}</td><td><div class="tbl-actions"><button class="tbl-btn tbl-edit" data-edit="${p.id}">Sửa</button><button class="tbl-btn tbl-view" data-pkg="${p.id}" data-pname="${encodeURIComponent(p.name)}">Gói</button><button class="tbl-btn tbl-delete" data-del="${p.id}">Xóa</button></div></td></tr>`).join('')}</tbody>
      </table></div>
    `;
  };
  await refresh();
}

function showProductModal(prod, cats, refresh) {
  const catMap = {};
  cats.forEach(c => { catMap[c.id] = c; });
  const parents = cats.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const children = cats.filter(c => c.parent_id).sort((a, b) => a.sort_order - b.sort_order);

  // Determine which parent and child should be pre-selected
  let selectedParentId = '';
  let selectedChildId = '';
  if (prod?.category_id) {
    const prodCat = catMap[prod.category_id];
    if (prodCat) {
      if (prodCat.parent_id) {
        selectedParentId = prodCat.parent_id;
        selectedChildId = prodCat.id;
      } else {
        selectedParentId = prodCat.id;
      }
    }
  }

  const parentOptions = parents.map(p =>
    `<option value="${p.id}" ${selectedParentId == p.id ? 'selected' : ''}>${p.name}</option>`
  ).join('');

  const childOptionsForParent = (parentId) => {
    const kids = children.filter(c => c.parent_id == parentId);
    if (!kids.length) return '<option value="">-- Không có --</option>';
    return '<option value="">-- Chọn danh mục con --</option>' + kids.map(c =>
      `<option value="${c.id}" ${selectedChildId == c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');
  };

  openModal(`
    <form id="prod-form">
      <div class="form-group"><label class="form-label">Tên<span class="req">*</span></label><input class="form-input" id="pf-name" value="${prod?.name || ''}" required /></div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Danh mục lớn</label><select class="form-select" id="pf-cat-parent"><option value="">-- Chọn danh mục lớn --</option>${parentOptions}</select></div>
        <div class="form-group"><label class="form-label">Danh mục con</label><select class="form-select" id="pf-cat-child">${childOptionsForParent(selectedParentId)}</select></div>
      </div>
      <div class="form-group">
        <label class="form-label">Mô tả</label>
        <div class="editor-toolbar" id="pf-desc-toolbar">
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="bold"><b>B</b></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="italic"><i>I</i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="underline"><u>U</u></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="link"><i class="fa-solid fa-link"></i> Link</button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="image"><i class="fa-regular fa-image"></i> Ảnh</button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="ul"><i class="fa-solid fa-list-ul"></i> List</button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="ol"><i class="fa-solid fa-list-ol"></i> Số</button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="h2">H2</button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="quote"><i class="fa-solid fa-quote-left"></i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="html"><i class="fa-solid fa-code"></i> HTML</button>
        </div>
        <textarea class="form-textarea rich-textarea" id="pf-desc" rows="10" placeholder="Hỗ trợ HTML: link, ảnh, bảng, heading, list...">${prod?.description || ''}</textarea>
        <div class="form-hint">Bạn có thể nhập HTML trực tiếp hoặc dùng các nút chèn nhanh phía trên.</div>
      </div>
      <div class="form-group">
        <label class="form-label">Ảnh sản phẩm</label>
        <div class="flex gap-8 items-center">
          <input class="form-input flex-1" id="pf-img" value="${prod?.image_url || ''}" placeholder="https://... hoặc upload ảnh" />
          ${imageUploadControl('pf-img', 'pf-img-upload', 'Upload', 'pf-img-preview')}
        </div>
        <div class="admin-upload-preview" id="pf-img-preview">${prod?.image_url ? `<img src="${prod.image_url}" alt="Product image preview" />` : '<span>Chưa có ảnh</span>'}</div>
      </div>
      <div class="form-row form-row-3">
        <div class="form-group"><label class="form-label">Thứ tự</label><input type="number" class="form-input" id="pf-order" value="${prod?.sort_order ?? 0}" /></div>
        <div class="form-group"><label class="form-label">Nổi bật</label><select class="form-select" id="pf-featured"><option value="false" ${!prod?.is_featured ? 'selected' : ''}>Không</option><option value="true" ${prod?.is_featured ? 'selected' : ''}>Có</option></select></div>
        <div class="form-group"><label class="form-label">Hiển thị</label><select class="form-select" id="pf-active"><option value="true" ${prod?.is_active !== false ? 'selected' : ''}>Hiện</option><option value="false" ${prod?.is_active === false ? 'selected' : ''}>Ẩn</option></select></div>
      </div>
      <div id="prod-form-err" class="form-error mb-12" style="display:none"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">${prod ? 'Cập nhật' : 'Tạo mới'}</button><button type="button" class="btn btn-ghost" id="prod-cancel">Hủy</button></div>
    </form>
  `, prod ? `Sửa: ${prod.name}` : 'Thêm sản phẩm');

  // When parent changes, refresh child options
  qs('#pf-cat-parent').onchange = function() {
    const childSelect = qs('#pf-cat-child');
    childSelect.innerHTML = childOptionsForParent(this.value);
  };

  qs('#prod-cancel').onclick = closeModal;
  bindImageUploads(qs('#modal-content'));

  createRichTextEditor({
    textarea: qs('#pf-desc'),
    toolbarId: 'pf-desc-toolbar',
    placeholder: 'Nhập mô tả sản phẩm...',
    minHeight: 380,
  });
  qs('#prod-form').onsubmit = async (e) => {
    e.preventDefault();
    if (window.syncRichTextEditors) window.syncRichTextEditors();
    const cat_id = qs('#pf-cat-child').value || qs('#pf-cat-parent').value;
    const body = { name: qs('#pf-name').value, category_id: cat_id ? parseInt(cat_id) : null, description: qs('#pf-desc').value || null, image_url: qs('#pf-img').value || null, sort_order: parseInt(qs('#pf-order').value) || 0, is_featured: qs('#pf-featured').value === 'true', is_active: qs('#pf-active').value === 'true' };
    try { if (prod) await apiFetch(`/products/${prod.id}`, { method: 'PUT', body: JSON.stringify(body) }); else await apiFetch('/products/', { method: 'POST', body: JSON.stringify(body) }); closeModal(); toast(prod ? 'Cập nhật!' : 'Tạo mới!', 'success'); refresh(); }
    catch (err) { const e = qs('#prod-form-err'); e.textContent = err.message; e.style.display = 'block'; }
  };
}

async function showPackagesModal(productId, productName, prefetchedProduct = null) {
  const prod = prefetchedProduct || await apiFetch('/products/admin/all').then(ps => ps.find(p => p.id === productId));
  const packages = prod?.packages || [];

  const renderFieldRows = (fields) => fields.map(f => `
    <div class="flex gap-8 items-center mb-4" data-field-id="${f.id}">
      <input class="form-input flex-1" value="${f.field_name}" data-fname disabled style="flex:2" />
      <select class="form-select" data-ftype disabled style="flex:1">
        <option value="text" ${f.field_type==='text'?'selected':''}>Text</option>
        <option value="number" ${f.field_type==='number'?'selected':''}>Number</option>
        <option value="textarea" ${f.field_type==='textarea'?'selected':''}>Textarea</option>
        <option value="email" ${f.field_type==='email'?'selected':''}>Email</option>
        <option value="select" ${f.field_type==='select'?'selected':''}>Select</option>
      </select>
      <label class="toggle-switch" style="flex-shrink:0"><input type="checkbox" data-freq ${f.is_required?'checked':''} disabled /><span class="toggle-slider"></span></label>
      <button type="button" class="tbl-btn tbl-delete" data-delfield="${f.id}">Xóa</button>
    </div>
  `).join('');

  const renderPkgList = () => packages.map(pkg => {
    const stockInfo = pkg.delivery_type === 'auto'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Tự động • Kho: ${pkg.stock_count}`
      : pkg.is_stock_managed
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Thủ công • Kho: ${pkg.stock_quantity}`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Thủ công`;
    const fieldsHtml = (pkg.fields && pkg.fields.length)
      ? `<div class="mt-8" style="padding:8px 12px;background:var(--bg-page);border-radius:var(--radius);font-size:12px;color:var(--text-muted);">
          <i class="fa-solid fa-list-check"></i> Trường tùy chỉnh: ${pkg.fields.map(f => f.field_name + (f.is_required ? ' *' : '')).join(', ')}
        </div>`
      : '';
    return `
    <div class="package-item mb-8"><div><div class="pkg-name">${pkg.name}</div><div class="pkg-desc">${stockInfo}</div>${fieldsHtml}</div>
    <div style="text-align:right"><div class="pkg-price">${fmt(pkg.price)}</div>
      <button class="tbl-btn tbl-edit mt-4" data-editpkg="${pkg.id}">Sửa gói</button>
      <button class="tbl-btn mt-4" style="background:var(--bg-page);color:var(--text-secondary);" data-editfield="${pkg.id}">Form đặt hàng</button>
      <button class="tbl-btn tbl-delete mt-4" data-delpkg="${pkg.id}">Xóa</button>
    </div></div>
  `;}).join('');

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
      <div class="form-group"><label class="form-label">Chú ý (hiển thị khi chọn gói)</label>
        <div class="editor-toolbar" id="pkg-notes-toolbar">
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="bold"><b>B</b></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="italic"><i>I</i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="link"><i class="fa-solid fa-link"></i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="ul"><i class="fa-solid fa-list-ul"></i></button>
        </div>
        <textarea class="form-textarea" id="pkg-notes" rows="4" placeholder="Lưu ý riêng cho gói này..."></textarea>
      </div>
      <div class="form-row form-row-2" id="pkg-stock-row">
        <div class="form-group">
          <label class="form-label">Quản lý kho</label>
          <label class="toggle-switch"><input type="checkbox" id="pkg-stock-toggle" /><span class="toggle-slider"></span></label>
        </div>
        <div class="form-group" id="pkg-stock-qty-group" style="display:none">
          <label class="form-label">Số lượng tồn kho</label>
          <input type="number" class="form-input" id="pkg-stock-qty" min="0" value="0" placeholder="0" />
        </div>
      </div>
      <div class="divider mt-12 mb-12"></div>
      <div class="fw-600 mb-8"><i class="fa-solid fa-list-check"></i> Trường tùy chỉnh</div>
      <div id="pkg-fields-list"></div>
      <button type="button" class="btn btn-ghost btn-sm mb-8" id="pkg-add-field">+ Thêm trường</button>
      <div class="divider mt-4 mb-12"></div>
      <button type="submit" class="btn btn-primary">+ Thêm gói</button>
    </form>
  `, `Gói: ${productName}`);

  const modal = qs('#modal-content');

  // Toggle stock quantity visibility
  const deliverySelect = qs('#pkg-delivery', modal);
  const stockToggle = qs('#pkg-stock-toggle', modal);
  const stockQtyGroup = qs('#pkg-stock-qty-group', modal);
  const stockRow = qs('#pkg-stock-row', modal);

  const updateStockVisibility = () => {
    const isAuto = deliverySelect.value === 'auto';
    if (isAuto) {
      stockRow.style.display = 'none';
    } else {
      stockRow.style.display = '';
      stockQtyGroup.style.display = stockToggle.checked ? '' : 'none';
    }
  };
  deliverySelect.onchange = updateStockVisibility;
  stockToggle.onchange = updateStockVisibility;
  updateStockVisibility();

  // Dynamic field rows for new package
  let fieldCounter = 0;
  qs('#pkg-add-field', modal).onclick = () => {
    const idx = fieldCounter++;
    const row = document.createElement('div');
    row.className = 'mb-4';
    row.dataset.newField = idx;
    row.innerHTML = `
      <div class="flex gap-8 items-center">
        <input class="form-input" data-new-fname placeholder="Tên trường" style="flex:2" />
        <select class="form-select" data-new-ftype style="flex:1">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="textarea">Textarea</option>
          <option value="email">Email</option>
          <option value="select">Select</option>
        </select>
        <label class="toggle-switch" style="flex-shrink:0"><input type="checkbox" data-new-freq checked /><span class="toggle-slider"></span></label>
        <button type="button" class="tbl-btn tbl-delete" data-remove-field>Xóa</button>
      </div>
      <div class="new-field-opts" style="display:none;margin-top:4px;"><input class="form-input" data-new-fopts placeholder='Options: ["Option 1","Option 2"]' /></div>
    `;
    qs('#pkg-fields-list', modal).appendChild(row);
    row.querySelector('[data-remove-field]').onclick = () => row.remove();
    // Show/hide options input based on type
    row.querySelector('[data-new-ftype]').onchange = (e) => {
      row.querySelector('.new-field-opts').style.display = e.target.value === 'select' ? '' : 'none';
    };
  };

  // Delete package
  modal.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delpkg]');
    if (!btn) return;
    if (!confirm('Xóa?')) return;
    try {
      await apiFetch(`/products/packages/${btn.dataset.delpkg}`, { method: 'DELETE' });
      toast('Đã xóa', 'success');
      const idx = packages.findIndex(p => p.id === parseInt(btn.dataset.delpkg));
      if (idx >= 0) packages.splice(idx, 1);
      qs('#pkg-list', modal).innerHTML = renderPkgList();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Edit package info (opens sub-modal)
  modal.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-editpkg]');
    if (!btn) return;
    const pkgId = parseInt(btn.dataset.editpkg);
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return;
    showPackageFormModal(pkg, () => {
      // Re-open the packages modal since the sub-modal overwrote #modal-content
      showPackagesModal(productId, productName);
    });
  });

  // Edit package fields (opens sub-modal for custom fields)
  modal.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-editfield]');
    if (!btn) return;
    const pkgId = parseInt(btn.dataset.editfield);
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return;
    showPackageFieldModal(pkg, () => {
      // Re-open the packages modal since the sub-modal overwrote #modal-content
      showPackagesModal(productId, productName);
    });
  });

  createRichTextEditor({
    textareaId: 'pkg-notes',
    toolbarId: 'pkg-notes-toolbar',
    placeholder: 'Nhập lưu ý cho gói...',
  });

  qs('#pkg-form', modal).onsubmit = async (e) => {
    e.preventDefault();
    if (window.syncRichTextEditors) window.syncRichTextEditors();
    const isStockManaged = qs('#pkg-stock-toggle', modal).checked;
    const body = {
      name: qs('#pkg-name', modal).value,
      price: parseFloat(qs('#pkg-price', modal).value),
      delivery_type: qs('#pkg-delivery', modal).value,
      description: qs('#pkg-desc', modal).value || null,
      notes: qs('#pkg-notes', modal).value || null,
      is_stock_managed: isStockManaged,
      stock_quantity: isStockManaged ? parseInt(qs('#pkg-stock-qty', modal).value) || 0 : 0,
    };
    try {
      const np = await apiFetch(`/products/${productId}/packages`, { method: 'POST', body: JSON.stringify(body) });
      // Create fields for the new package
      const newFieldRows = qsa('[data-new-field]', modal);
      for (const row of newFieldRows) {
        const fnameInput = row.querySelector('[data-new-fname]');
        const ftypeInput = row.querySelector('[data-new-ftype]');
        const freqInput = row.querySelector('[data-new-freq]');
        if (!fnameInput || !ftypeInput || !freqInput) continue;

        const fname = fnameInput.value.trim();
        if (!fname) continue;
        const ftype = ftypeInput.value;
        const freq = freqInput.checked;
        const fieldData = { field_name: fname, field_type: ftype, is_required: freq };
        if (ftype === 'select') {
          const optsInput = row.querySelector('[data-new-fopts]');
          if (optsInput?.value.trim()) fieldData.options = optsInput.value.trim();
        }
        await apiFetch(`/products/packages/${np.id}/fields`, {
          method: 'POST',
          body: JSON.stringify(fieldData)
        });
      }
      // Re-fetch to get fields included
      const refreshed = await apiFetch('/products/admin/all').then(ps => ps.find(p => p.id === productId));
      packages.length = 0;
      packages.push(...(refreshed?.packages || []));
      qs('#pkg-list', modal).innerHTML = renderPkgList();
      e.target.reset();
      qs('#pkg-fields-list', modal).innerHTML = '';
      fieldCounter = 0;
      updateStockVisibility();
      toast('Đã thêm gói', 'success');
    }
    catch (err) { toast(err.message, 'error'); }
  };
}

function showPackageFormModal(pkg, refresh) {
  openModal(`
    <div class="fw-600 mb-12"><i class="fa-solid fa-box-open"></i> Sửa gói: ${pkg.name}</div>
    <form id="edit-pkg-form">
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Tên gói</label><input class="form-input" id="epkg-name" required value="${pkg.name}" /></div>
        <div class="form-group"><label class="form-label">Giá (đ)</label><input type="number" class="form-input" id="epkg-price" required value="${pkg.price}" /></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group"><label class="form-label">Giao hàng</label><select class="form-select" id="epkg-delivery"><option value="manual" ${pkg.delivery_type==='manual'?'selected':''}>Thủ công</option><option value="auto" ${pkg.delivery_type==='auto'?'selected':''}>Tự động</option></select></div>
        <div class="form-group"><label class="form-label">Mô tả</label><input class="form-input" id="epkg-desc" value="${pkg.description || ''}" placeholder="Mô tả..." /></div>
      </div>
      <div class="form-group"><label class="form-label">Chú ý (hiển thị khi chọn gói)</label>
        <div class="editor-toolbar" id="epkg-notes-toolbar">
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="bold"><b>B</b></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="italic"><i>I</i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="link"><i class="fa-solid fa-link"></i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="ul"><i class="fa-solid fa-list-ul"></i></button>
        </div>
        <textarea class="form-textarea" id="epkg-notes" rows="4" placeholder="Lưu ý riêng cho gói này...">${pkg.notes || ''}</textarea>
      </div>
      <div class="form-row form-row-2" id="epkg-stock-row">
        <div class="form-group">
          <label class="form-label">Quản lý kho</label>
          <label class="toggle-switch"><input type="checkbox" id="epkg-stock-toggle" ${pkg.is_stock_managed?'checked':''} /><span class="toggle-slider"></span></label>
        </div>
        <div class="form-group" id="epkg-stock-qty-group" style="display:${pkg.is_stock_managed?'':'none'}">
          <label class="form-label">Số lượng tồn kho</label>
          <input type="number" class="form-input" id="epkg-stock-qty" min="0" value="${pkg.stock_quantity || 0}" placeholder="0" />
        </div>
      </div>
      <div class="divider mt-12 mb-12"></div>
      <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">Lưu</button><button type="button" class="btn btn-ghost" id="epkg-cancel">Hủy</button></div>
    </form>
  `, `Sửa gói`);

  const emodal = qs('#modal-content');
  const deliverySelect = qs('#epkg-delivery', emodal);
  const stockToggle = qs('#epkg-stock-toggle', emodal);
  const stockQtyGroup = qs('#epkg-stock-qty-group', emodal);
  const stockRow = qs('#epkg-stock-row', emodal);

  const updateStockVisibility = () => {
    const isAuto = deliverySelect.value === 'auto';
    if (isAuto) {
      stockRow.style.display = 'none';
    } else {
      stockRow.style.display = '';
      stockQtyGroup.style.display = stockToggle.checked ? '' : 'none';
    }
  };
  deliverySelect.onchange = updateStockVisibility;
  stockToggle.onchange = updateStockVisibility;
  updateStockVisibility();

  qs('#epkg-cancel', emodal).onclick = closeModal;

  createRichTextEditor({
    textareaId: 'epkg-notes',
    toolbarId: 'epkg-notes-toolbar',
    placeholder: 'Nhập lưu ý cho gói...',
  });

  qs('#edit-pkg-form', emodal).onsubmit = async (e) => {
    e.preventDefault();
    if (window.syncRichTextEditors) window.syncRichTextEditors();
    const isStockManaged = qs('#epkg-stock-toggle', emodal).checked;
    const body = {
      name: qs('#epkg-name', emodal).value,
      price: parseFloat(qs('#epkg-price', emodal).value),
      delivery_type: qs('#epkg-delivery', emodal).value,
      description: qs('#epkg-desc', emodal).value || null,
      notes: qs('#epkg-notes', emodal).value || null,
      is_stock_managed: isStockManaged,
      stock_quantity: isStockManaged ? parseInt(qs('#epkg-stock-qty', emodal).value) || 0 : 0,
    };
    try {
      await apiFetch(`/products/packages/${pkg.id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Đã lưu gói', 'success');
      closeModal();
      if (refresh) refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

function showPackageFieldModal(pkg, refresh) {
  const fields = [...(pkg.fields || [])];
  const renderFields = () => fields.map((f, i) => {
    const isSelect = f.field_type === 'select';
    const optsVal = f.options ? (typeof f.options === 'string' ? f.options : JSON.stringify(f.options)) : '';
    return `
    <div class="flex gap-8 items-center mb-4" data-fidx="${i}">
      <input class="form-input flex-1" value="${f.field_name}" data-efname style="flex:2" />
      <select class="form-select" data-eftype style="flex:1">
        <option value="text" ${f.field_type==='text'?'selected':''}>Text</option>
        <option value="number" ${f.field_type==='number'?'selected':''}>Number</option>
        <option value="textarea" ${f.field_type==='textarea'?'selected':''}>Textarea</option>
        <option value="email" ${f.field_type==='email'?'selected':''}>Email</option>
        <option value="select" ${f.field_type==='select'?'selected':''}>Select</option>
      </select>
      <label class="toggle-switch" style="flex-shrink:0"><input type="checkbox" data-efreq ${f.is_required?'checked':''} /><span class="toggle-slider"></span></label>
      <button type="button" class="tbl-btn tbl-delete" data-rmefield="${i}">Xóa</button>
    </div>
    ${isSelect ? `<div class="mb-4" style="margin-left:0"><input class="form-input" data-efopts value="${optsVal}" placeholder='Options: ["Option 1","Option 2"]' style="flex:1" /></div>` : ''}
  `;}).join('');

  openModal(`
    <div class="fw-600 mb-12"><i class="fa-solid fa-list-check"></i> Trường tùy chỉnh: ${pkg.name}</div>
    <div style="display:flex;gap:8px;margin-bottom:8px;font-size:12px;color:var(--text-muted);font-weight:600;">
      <span style="flex:2">Tên trường</span><span style="flex:1">Loại</span><span>Bắt buộc</span><span></span>
    </div>
    <div id="efields-list">${renderFields()}</div>
    <button type="button" class="btn btn-ghost btn-sm mb-12" id="ef-add-field">+ Thêm trường</button>
    <div class="divider mb-12"></div>
    <div class="flex gap-8"><button type="button" class="btn btn-primary flex-1" id="ef-save">Lưu</button><button type="button" class="btn btn-ghost" id="ef-cancel">Hủy</button></div>
  `, `Trường tùy chỉnh`);

  const emodal = qs('#modal-content');

  // Add new field row
  qs('#ef-add-field', emodal).onclick = () => {
    fields.push({ field_name: '', field_type: 'text', is_required: true, _new: true });
    qs('#efields-list', emodal).innerHTML = renderFields();
  };

  // Remove field row
  emodal.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rmefield]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.rmefield);
    fields.splice(idx, 1);
    qs('#efields-list', emodal).innerHTML = renderFields();
  });

  // Toggle options input visibility when type changes
  emodal.addEventListener('change', (e) => {
    if (!e.target.matches('[data-eftype]')) return;
    const row = e.target.closest('[data-fidx]');
    if (!row) return;
    const nextDiv = row.nextElementSibling;
    if (e.target.value === 'select') {
      if (!nextDiv || !nextDiv.querySelector('[data-efopts]')) {
        const optsDiv = document.createElement('div');
        optsDiv.className = 'mb-4';
        optsDiv.innerHTML = `<input class="form-input" data-efopts placeholder='Options: ["Option 1","Option 2"]' />`;
        row.after(optsDiv);
      }
    } else {
      if (nextDiv && nextDiv.querySelector('[data-efopts]')) {
        nextDiv.remove();
      }
    }
  });

  qs('#ef-cancel', emodal).onclick = closeModal;

  qs('#ef-save', emodal).onclick = async () => {
    try {
      const existingFieldIds = (pkg.fields || []).map(f => f.id);
      const rows = qsa('[data-fidx]', emodal);
      const nextFields = rows.map((row, idx) => {
        const fname = row.querySelector('[data-efname]').value.trim();
        const ftype = row.querySelector('[data-eftype]').value;
        const freq = row.querySelector('[data-efreq]').checked;
        const field = fields[idx] || {};
        const fieldData = {
          id: field.id,
          field_name: fname,
          field_type: ftype,
          is_required: freq,
        };
        if (ftype === 'select') {
          const optsInput = row.nextElementSibling?.querySelector('[data-efopts]');
          if (optsInput?.value.trim()) fieldData.options = optsInput.value.trim();
        }
        return fieldData;
      }).filter(field => field.field_name);

      const nextFieldIds = nextFields.filter(f => f.id).map(f => f.id);
      const removedIds = existingFieldIds.filter(id => !nextFieldIds.includes(id));

      for (const id of removedIds) {
        await apiFetch(`/products/fields/${id}`, { method: 'DELETE' });
      }

      for (const field of nextFields) {
        const payload = {
          field_name: field.field_name,
          field_type: field.field_type,
          is_required: field.is_required,
        };
        if (field.options) payload.options = field.options;

        if (field.id) {
          await apiFetch(`/products/fields/${field.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await apiFetch(`/products/packages/${pkg.id}/fields`, { method: 'POST', body: JSON.stringify(payload) });
        }
      }

      toast('Đã lưu trường tùy chỉnh', 'success');
      closeModal();
      if (refresh) refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

function adminOrderPrimaryItem(order) {
  return Array.isArray(order?.items) && order.items.length ? order.items[0] : null;
}

function adminOrderSummary(order) {
  const primary = adminOrderPrimaryItem(order);
  if (!primary) return esc(order.product_name || '—');
  const extra = (order.items?.length || 0) - 1;
  const base = `${esc(primary.product_name || '—')} — ${esc(primary.package_name || '—')}`;
  return extra > 0 ? `${base} <span class="text-muted">+${extra} sản phẩm</span>` : base;
}

function adminOrderItemsHtml(order) {
  const items = Array.isArray(order?.items) && order.items.length ? order.items : [{ product_name: order.product_name, package_name: order.package_name, quantity: order.quantity, line_total: order.total_amount, custom_fields_data: order.custom_fields_data, delivery_data: order.delivery_data }];
  return items.map((item, idx) => `
    <div class="order-item-card" style="padding:${idx < items.length - 1 ? '0 0 12px 0' : '0'}; margin:${idx < items.length - 1 ? '0 0 12px 0' : '0'}; border-bottom:${idx < items.length - 1 ? '1px dashed var(--border)' : 'none'};">
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
        <div>
          <div style="font-weight:700; color:var(--text-heading);">${esc(item.product_name || '—')}</div>
          <div class="text-sm text-muted" style="margin-top:4px;">${esc(item.package_name || '—')} · SL ${item.quantity || 1}</div>
        </div>
        <div class="text-sm" style="font-weight:700; color:var(--primary);">${fmt(item.line_total || 0)}</div>
      </div>
      ${item.custom_fields_data && Object.keys(item.custom_fields_data).length ? `<div class="mt-8 text-sm">${Object.entries(item.custom_fields_data).map(([k,v]) => `<div><strong>${esc(k)}:</strong> ${esc(v)}</div>`).join('')}</div>` : ''}
      ${item.delivery_data ? `<div class="delivery-box mt-12"><div class="delivery-box-title">Dữ liệu giao</div><div class="delivery-data">${esc(item.delivery_data)}</div></div>` : ''}
    </div>
  `).join('');
}

// ADMIN ORDERS
async function renderAdminOrders(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const refresh = async (status = '') => {
    try {
    const data = await apiFetch(`/orders/admin/all?limit=50${status ? '&status=' + status : ''}`);
    const actionButtons = (o) => {
      const buttons = [];
      if (o.status === 'paid') {
        buttons.push(`<button class="tbl-btn tbl-edit" data-mark-processing="${o.id}">Xử lý</button>`);
        buttons.push(`<button class="tbl-btn tbl-success" data-deliver="${o.id}">Giao</button>`);
        buttons.push(`<button class="tbl-btn tbl-delete" data-cancel-order="${o.id}">Hủy</button>`);
      } else if (o.status === 'processing') {
        buttons.push(`<button class="tbl-btn tbl-success" data-deliver="${o.id}">Giao</button>`);
        buttons.push(`<button class="tbl-btn tbl-delete" data-cancel-order="${o.id}">Hủy</button>`);
      } else if (o.status === 'pending') {
        buttons.push(`<button class="tbl-btn tbl-delete" data-cancel-order="${o.id}">Hủy</button>`);
      }
      buttons.push(`<button class="tbl-btn tbl-view" data-view-order="${o.id}" data-od="${encodeURIComponent(JSON.stringify(o))}">Xem</button>`);
      return `<div class="tbl-actions">${buttons.join('')}</div>`;
    };
    content.innerHTML = `
      <div class="filter-pills">${['', 'pending', 'paid', 'processing', 'completed', 'cancelled'].map(s => `<button class="filter-pill ${status === s ? 'active' : ''}" data-filter="${s}">${s || 'Tất cả'}</button>`).join('')}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Mã đơn</th><th>Khách</th><th>SP</th><th>Tiền</th><th>PTTT</th><th>TT</th><th>Ngày</th><th></th></tr></thead>
        <tbody>${data.items.map(o => `<tr><td class="td-mono">${o.order_code}</td><td class="text-sm">${esc(o.user_email) || '—'}</td><td class="text-sm">${adminOrderSummary(o)}</td><td class="text-primary">${fmt(o.total_amount)}</td><td class="text-sm">${o.payment_method || 'payos'}</td><td>${statusBadge(o.status)}</td><td class="text-sm text-muted">${fmtDate(o.created_at)}</td><td>${actionButtons(o)}</td></tr>`).join('')}</tbody>
      </table></div>
    `;

    content.onclick = async (e) => {
      const filterBtn = e.target.closest('[data-filter]');
      if (filterBtn) {
        refresh(filterBtn.dataset.filter);
        return;
      }

      const deliverBtn = e.target.closest('[data-deliver]');
      if (deliverBtn) {
        showDeliverModal(parseInt(deliverBtn.dataset.deliver), refresh.bind(null, status));
        return;
      }

      const processingBtn = e.target.closest('[data-mark-processing]');
      if (processingBtn) {
        try {
          await apiFetch(`/orders/admin/${processingBtn.dataset.markProcessing}/status`, { method: 'PUT', body: JSON.stringify({ status: 'processing' }) });
          toast('Đã chuyển sang đang xử lý', 'success');
          await refresh(status);
        } catch (err) {
          toast(err.message, 'error');
        }
        return;
      }

      const cancelBtn = e.target.closest('[data-cancel-order]');
      if (cancelBtn) {
        if (!confirm('Hủy đơn này và hoàn tiền về số dư nội bộ nếu đã thanh toán?')) return;
        try {
          await apiFetch(`/orders/admin/${cancelBtn.dataset.cancelOrder}/cancel`, { method: 'POST', body: JSON.stringify({}) });
          toast('Đã hủy đơn', 'success');
          await refresh(status);
        } catch (err) {
          toast(err.message, 'error');
        }
        return;
      }

      const viewBtn = e.target.closest('[data-view-order]');
      if (viewBtn) {
        const o = JSON.parse(decodeURIComponent(viewBtn.dataset.od));
        openModal(`
          <div class="order-meta">${Object.entries({ 'Mã đơn': o.order_code, 'Khách': esc(o.user_email), 'Tóm tắt': adminOrderSummary(o), 'Tiền': fmt(o.total_amount), 'PTTT': o.payment_method || 'payos', 'TT': o.status, 'Ngày': fmtDate(o.created_at), 'Coupon': o.coupon_code || '—' }).map(([k, v]) => `<div class="order-meta-item"><div class="order-meta-label">${k}</div><div class="order-meta-value">${v || '—'}</div></div>`).join('')}</div>
          <div class="delivery-box mt-12"><div class="delivery-box-title">Danh sách sản phẩm</div><div>${adminOrderItemsHtml(o)}</div></div>
          ${o.delivery_data ? `<div class="delivery-box mt-12"><div class="delivery-box-title">Tổng dữ liệu giao</div><div class="delivery-data">${esc(o.delivery_data)}</div></div>` : ''}
        `, `Đơn: ${o.order_code}`);
      }
    };
    } catch (err) { content.innerHTML = `<div class="empty-state"><h3>Lỗi tải đơn hàng</h3><p class="text-muted">${err.message}</p></div>`; }
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
  if (!view) return;
  const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const products = await apiFetch('/products/admin/all');
    const autoProducts = products.filter(p => p.packages?.some(pkg => pkg.delivery_type === 'auto'));
    
    let html = `
      ${cuiPageHeader('Kho hàng', 'Theo dõi tồn kho và dữ liệu giao tự động')}
      
      <div class="card">
        <div class="card-header"><div class="card-title">Gói giao tự động</div></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>ID</th><th>Sản phẩm</th><th>Tên gói</th><th>Trong kho</th><th></th></tr></thead>
            <tbody>
    `;
    
    if (autoProducts.length) {
      autoProducts.forEach(p => {
        p.packages.filter(pk => pk.delivery_type === 'auto').forEach(pk => {
          html += `
            <tr>
              <td class="text-muted">#${pk.id}</td>
              <td class="fw-600">${esc(p.name)}</td>
              <td><span class="badge badge-blue">${esc(pk.name)}</span></td>
              <td><span class="badge ${pk.stock_count > 0 ? 'badge-green' : 'badge-red'}">${pk.stock_count}</span></td>
              <td><button class="btn btn-sm btn-primary" data-viewstock="${pk.id}" data-pkgname="${encodeURIComponent(p.name + ' - ' + pk.name)}">Quản lý kho</button></td>
            </tr>
          `;
        });
      });
    } else {
      html += `<tr><td colspan="5" class="text-center text-muted">Chưa có gói giao tự động nào. Tạo gói với kiểu giao hàng "Tự động" trong trang Sản phẩm.</td></tr>`;
    }
    html += `</tbody></table></div></div>`;
    
    content.innerHTML = html;

    content.onclick = (e) => {
      const viewBtn = e.target.closest('[data-viewstock]');
      if (viewBtn) {
        showStockDetail(parseInt(viewBtn.dataset.viewstock), decodeURIComponent(viewBtn.dataset.pkgname), view);
        return;
      }
    };
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Lỗi tải kho hàng</h3><p class="text-muted">${err.message}</p></div>`;
  }
}

async function showStockDetail(pkgId, pkgName, view) {
  const content = view || qs('#app-view');
  if (!content) return;
  
  let currentStatus = 'all';
  let currentPage = 1;
  let itemsPerPage = 20;
  let searchQuery = '';
  let allItems = [];

  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const refresh = async () => {
    try {
      const items = await apiFetch(`/stock/package/${pkgId}`);
      allItems = items;
      renderDetailView();
    } catch (e) {
      content.innerHTML = `<div class="empty-state"><h3>Lỗi tải dữ liệu</h3><p>${e.message}</p></div>`;
    }
  };

  const renderDetailView = () => {
    let filtered = allItems;
    if (searchQuery) filtered = filtered.filter(i => i.data.toLowerCase().includes(searchQuery.toLowerCase()));
    if (currentStatus !== 'all') filtered = filtered.filter(i => i.is_sold === (currentStatus === 'sold'));

    const totalStats = allItems.length;
    const soldStats = allItems.filter(i => i.is_sold).length;
    const availableStats = totalStats - soldStats;
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    content.innerHTML = `
      ${cuiPageHeader('Quản lý kho hàng <span class="text-danger-600">' + esc(pkgName) + '</span>', '', `
        <button class="btn btn-sm btn-ghost" id="btn-back"><i class="fa-solid fa-arrow-left"></i> Quay lại</button>
      `)}
      <div class="cui-page-actions-bar">
        <button class="btn btn-sm btn-success" id="btn-add-bulk"><i class="fa-solid fa-arrow-right-to-bracket"></i> Nhập hàng loạt</button>
        <label class="btn btn-sm btn-purple">
          <i class="fa-solid fa-file-csv"></i> Nhập từ CSV
          <input type="file" id="file-csv" accept=".csv" style="display:none;">
        </label>
        <label class="btn btn-sm btn-info">
          <i class="fa-solid fa-file-lines"></i> Nhập từ TXT
          <input type="file" id="file-txt" accept=".txt" style="display:none;">
        </label>
        <button class="btn btn-sm btn-warning" id="btn-export"><i class="fa-solid fa-file-export"></i> Xuất kho hàng</button>
        <button class="btn btn-sm btn-outline-danger" id="btn-delete-all"><i class="fa-solid fa-trash-can"></i> Xóa toàn bộ</button>
      </div>
      <div class="stats-grid mb-16">
        <div class="stat-card"><div class="stat-icon green"><i class="fa-solid fa-boxes-stacked"></i></div><div class="stat-info"><div class="stat-label">Tổng số lượng</div><div class="stat-value">${totalStats}</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><i class="fa-solid fa-check"></i></div><div class="stat-info"><div class="stat-label">Còn hàng</div><div class="stat-value">${availableStats}</div></div></div>
        <div class="stat-card"><div class="stat-icon red"><i class="fa-solid fa-xmark"></i></div><div class="stat-info"><div class="stat-label">Đã bán</div><div class="stat-value">${soldStats}</div></div></div>
      </div>
      <div class="stock-detail-layout">
        <div class="card stock-filter-card">
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Tìm kiếm</label>
              <input type="text" class="form-input" id="f-stock-search" placeholder="Nhập giá trị kho hàng..." value="${esc(searchQuery)}">
            </div>
            <div class="form-group">
              <label class="form-label">Trạng thái</label>
              <select class="form-select" id="f-stock-status"><option value="all" ${currentStatus==='all'?'selected':''}>Tất cả</option><option value="available" ${currentStatus==='available'?'selected':''}>Còn hàng</option><option value="sold" ${currentStatus==='sold'?'selected':''}>Đã bán</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">Số lượng/trang</label>
              <select class="form-select" id="f-stock-limit"><option value="20" ${itemsPerPage===20?'selected':''}>20</option><option value="50" ${itemsPerPage===50?'selected':''}>50</option><option value="100" ${itemsPerPage===100?'selected':''}>100</option></select>
            </div>
            <div class="stock-filter-btns">
              <button class="btn btn-sm btn-primary" id="btn-stock-filter"><i class="fa-solid fa-filter"></i> Lọc</button>
              <button class="btn btn-sm btn-ghost" id="btn-stock-reset"><i class="fa-solid fa-xmark"></i> Bỏ lọc</button>
            </div>
          </div>
        </div>
        <div class="card stock-table-card">
          <div class="table-wrap"><table><thead><tr><th style="width:40px;"><input type="checkbox" id="cb-all-stock"></th><th style="width:80px;">ID</th><th>Giá trị kho hàng</th><th style="width:120px;">Trạng thái</th><th style="width:160px;">Ngày tạo</th></tr></thead><tbody>${paginated.length ? paginated.map(i => `<tr><td><input type="checkbox" class="cb-stock" value="${i.id}"></td><td class="fw-700 text-danger-600">${i.id}</td><td><code class="stock-data-cell">${esc(i.data)}</code></td><td>${i.is_sold ? '<span class="badge badge-red">Đã bán</span>' : '<span class="badge badge-green">Còn hàng</span>'}</td><td class="text-muted text-sm">${fmtDate(i.created_at)}</td></tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted" style="padding:40px;">Không tìm thấy dữ liệu phù hợp.</td></tr>'}</tbody></table></div>
          ${totalPages > 1 ? `<div class="stock-pagination"><button class="btn btn-sm btn-outline" id="btn-prev" ${currentPage === 1 ? 'disabled' : ''}>Trước</button><span class="stock-page-info">${currentPage} / ${totalPages}</span><button class="btn btn-sm btn-outline" id="btn-next" ${currentPage === totalPages ? 'disabled' : ''}>Sau</button></div>` : ''}
        </div>
      </div>
    `;

    qs('#btn-back', content).onclick = () => renderAdminStock(content);
    qs('#btn-stock-filter', content).onclick = () => { searchQuery = qs('#f-stock-search', content).value.trim(); currentStatus = qs('#f-stock-status', content).value; itemsPerPage = parseInt(qs('#f-stock-limit', content).value) || 20; currentPage = 1; renderDetailView(); };
    qs('#btn-stock-reset', content).onclick = () => { searchQuery = ''; currentStatus = 'all'; itemsPerPage = 20; currentPage = 1; renderDetailView(); };
    const btnPrev = qs('#btn-prev', content); if (btnPrev) btnPrev.onclick = () => { if (currentPage > 1) { currentPage--; renderDetailView(); } };
    const btnNext = qs('#btn-next', content); if (btnNext) btnNext.onclick = () => { if (currentPage < totalPages) { currentPage++; renderDetailView(); } };

    const cbAll = qs('#cb-all-stock', content);
    const cbList = qsa('.cb-stock', content);
    if (cbAll) {
      cbAll.onchange = (e) => { cbList.forEach(cb => cb.checked = e.target.checked); };
      cbList.forEach(cb => { cb.onchange = () => { if (!cb.checked) cbAll.checked = false; }; });
    }

    qs('#btn-add-bulk', content).onclick = () => {
      openModal(`<div class="form-group"><label class="form-label" style="margin-bottom:6px">Nhập thủ công (1 dòng / 1 item)</label><textarea class="form-textarea" id="bulk-stock-input" rows="10" placeholder="account1@gmail.com:pass1
account2@gmail.com:pass2"></textarea></div><div class="flex gap-8"><button class="btn btn-primary flex-1" id="btn-submit-bulk">+ Lưu vào kho</button><button class="btn btn-ghost" onclick="closeModal()">Hủy</button></div>`, 'Nhập hàng loạt');
      qs('#btn-submit-bulk').onclick = async () => {
        const txt = qs('#bulk-stock-input').value.trim();
        if (!txt) return;
        try {
          const res = await apiFetch('/stock/bulk', { method: 'POST', body: JSON.stringify({ package_id: pkgId, items: txt }) });
          toast(`Đã thêm ${res.added} mục`, 'success');
          closeModal();
          refresh();
        } catch (err) { toast(err.message, 'error'); }
      };
    };

    const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const txt = ev.target.result.trim();
        if (!txt) return toast('File rỗng', 'error');
        try {
          const res = await apiFetch('/stock/bulk', { method: 'POST', body: JSON.stringify({ package_id: pkgId, items: txt }) });
          toast(`Đã nạp ${res.added} mục từ file`, 'success');
          refresh();
        } catch (err) { toast(err.message, 'error'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    };

    qs('#file-csv', content).onchange = handleFileUpload;
    qs('#file-txt', content).onchange = handleFileUpload;

    qs('#btn-export', content).onclick = () => {
      if (!allItems.length) return toast('Kho trống', 'warning');
      const lines = allItems.map(i => i.data).join('\\n');
      const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `export-stock-${pkgId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    qs('#btn-delete-all', content).onclick = async () => {
      const selected = [...qsa('.cb-stock:checked', content)].map(cb => parseInt(cb.value)).filter(Boolean);
      if (!selected.length) {
        toast('Chọn ít nhất một mục để xóa', 'warning');
        return;
      }
      if (!confirm(`Xóa ${selected.length} mục đã chọn?`)) return;
      try {
        await Promise.all(selected.map(id => apiFetch(`/stock/${id}`, { method: 'DELETE' })));
        toast(`Đã xóa ${selected.length} mục`, 'success');
        refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  };

  await refresh();
}

async function showManagedStockDetail(pkgId, pkgName, currentQty) {
  const detail = qs('#stock-detail');
  if (!detail) return;

  const refresh = async () => {
    const products = await apiFetch('/products/admin/all');
    let pkg = null;
    for (const p of products) {
      pkg = p.packages?.find(pk => pk.id === pkgId);
      if (pkg) break;
    }

    const qty = pkg?.stock_quantity ?? currentQty;
    const badge = qty <= 0 ? '🔴 Hết hàng' : qty <= 5 ? '🟠 Sắp hết' : '🟢 Còn hàng';
    detail.innerHTML = `
      <div class="fw-600 mb-8">${pkgName} — Quản lý kho</div>
      <div class="card p-16 mb-16">
        <div class="flex items-center gap-12 mb-12">
          <div class="text-2xl fw-700">${qty}</div>
          <div>${badge}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Cập nhật số lượng tồn kho</label>
          <div class="flex gap-8">
            <input type="number" class="form-input" id="managed-stock-qty" min="0" value="${qty}" style="max-width:160px" />
            <button class="btn btn-primary" id="btn-update-managed-stock">Cập nhật</button>
          </div>
        </div>
      </div>
    `;

    qs('#btn-update-managed-stock', detail).onclick = async () => {
      const newQty = parseInt(qs('#managed-stock-qty', detail).value) || 0;
      try {
        await apiFetch(`/products/packages/${pkgId}`, { method: 'PUT', body: JSON.stringify({ stock_quantity: newQty }) });
        toast('Đã cập nhật số lượng', 'success');
        await refresh();
        await renderAdminStock(qs('#app-view'));
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  };

  await refresh();
}

// ADMIN SETTINGS
async function renderAdminSettings(view) {
  if (!view) return;
  const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const [legacy, unified, dbSettings] = await Promise.all([
      apiFetch('/admin/settings'),
      apiFetch('/admin/settings/unified').catch(() => ({})),
      apiFetch('/admin/settings/database').catch(() => ({}))
    ]);

    const g = unified.settings_general || {};
    const ap = unified.settings_appearance || {};
    const sc = unified.settings_scripts || {};
    const im = unified.settings_images || {};
    const se = unified.settings_security || {};
    const ca = unified.settings_captcha || {};
    const fe = unified.settings_features || {};
    const dbCfg = dbSettings.providers || {};

  // Helper: escape HTML
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Helper: toggle row HTML
  const toggleRow = (id, label, desc, checked) => `
    <div class="settings-toggle-row">
      <div><div class="settings-toggle-label">${label}</div>${desc ? `<div class="settings-toggle-desc">${desc}</div>` : ''}</div>
      <label class="toggle-switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="toggle-slider"></span></label>
    </div>`;

  // Helper: form field
  const field = (id, label, val, opts = {}) => `
    <div class="form-group">
      <label class="form-label" for="${id}">${label}</label>
      ${opts.type === 'textarea'
        ? `<textarea class="form-input form-textarea" id="${id}" placeholder="${esc(opts.placeholder || '')}" rows="${opts.rows || 4}">${esc(val)}</textarea>`
        : opts.type === 'select'
          ? `<select class="form-select" id="${id}">${(opts.options || []).map(o => `<option value="${o.value}" ${String(val) === String(o.value) ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`
          : `<input class="form-input" id="${id}" type="${opts.type || 'text'}" value="${esc(val)}" placeholder="${esc(opts.placeholder || '')}" ${opts.step ? `step="${opts.step}"` : ''} />`
      }
    </div>`;

  const tabs = [
    { id: 'general', label: 'Chung', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
    { id: 'appearance', label: 'Giao diện', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>' },
    { id: 'scripts', label: 'Scripts', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
    { id: 'images', label: 'Hình ảnh', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' },
    { id: 'security', label: 'Bảo mật', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' },
    { id: 'captcha', label: 'Captcha', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' },
    { id: 'features', label: 'Chức năng', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
    { id: 'database', label: 'Database', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>' },
    { id: 'ai', label: 'AI', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.09 3.26L16.36 6.4l-2.63 2.09.64 3.51L12 10.24 9.63 12l.64-3.51L7.64 6.4l3.27-1.14z"/><path d="M5 19l1.5-4.5L2 12l4.5-1.5L5 5l1.5 4.5L12 8l-1.5 4.5L12 19l-1.5-4.5L5 19z"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/></svg>' },
  ];

  content.innerHTML = `
    ${cuiPageHeader('Cài đặt hệ thống', 'Thiết lập hệ thống, giao diện và tính năng')}
    <div class="settings-tabs" role="tablist">
      ${tabs.map((t, i) => `<button class="settings-tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${i === 0}">${t.icon} ${t.label}</button>`).join('')}
    </div>

    <form id="settings-unified-form">
      <!-- ═══ General ═══ -->
      <div class="settings-section active" data-section="general">
        <div class="settings-card">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Cài đặt chung
          </div>
          ${field('g-title', 'Tiêu đề trang', g.title, { placeholder: 'Tên website của bạn' })}
          ${field('g-description', 'Mô tả trang', g.description, { placeholder: 'Mô tả ngắn gọn về website' })}
          ${field('g-site-description', 'Mô tả chân trang (Footer)', g.site_description, { type: 'textarea', rows: 3, placeholder: 'Mô tả hiển thị ở chân trang, ví dụ: Chúng tôi tự hào cung cấp...' })}
          ${field('g-seo-title', 'SEO title mặc định', g.seo_title, { placeholder: 'Tên hiển thị trên tab trình duyệt và chia sẻ mặc định' })}
          ${field('g-seo-description', 'SEO description mặc định', g.seo_description, { type: 'textarea', rows: 3, placeholder: 'Mô tả mặc định cho meta description và social preview' })}
          ${field('g-seo-keywords', 'SEO keywords', g.seo_keywords || g.keywords, { placeholder: 'shop, digital, key, game' })}
          ${field('g-seo-author', 'SEO author', g.seo_author || g.author, { placeholder: 'Tên thương hiệu hoặc tác giả' })}
          ${field('g-site-url', 'URL website chuẩn', g.site_url, { placeholder: 'https://example.com' })}
          ${field('g-twitter-card', 'Twitter card', g.twitter_card || 'summary_large_image', {
            type: 'select',
            options: [
              { value: 'summary_large_image', label: 'summary_large_image' },
              { value: 'summary', label: 'summary' },
            ]
          })}
          ${field('g-copyright', 'Copyright Text', g.copyright_text, { placeholder: 'Copyright © 2024 ShopKey. All rights reserved.' })}
          ${field('g-keywords', 'Từ khóa (legacy)', g.keywords, { placeholder: 'shop, digital, key, game' })}
          ${field('g-author', 'Tác giả (legacy)', g.author, { placeholder: 'Tên tác giả' })}
          ${field('g-timezone', 'Múi giờ (Timezone)', g.timezone, {
            type: 'select',
            options: [
              { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (UTC+7)' },
              { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+7)' },
              { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
              { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
              { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
              { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
              { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
              { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
              { value: 'UTC', label: 'UTC' },
            ]
          })}
        </div>
        
        <div class="settings-card mt-16">
          <div class="settings-section-title"><i class="fa-solid fa-address-book"></i> Thông tin liên hệ (Hỗ trợ)</div>
          ${field('g-contact-email', 'Email hỗ trợ', g.contact_email, { placeholder: 'support@example.com' })}
          ${field('g-contact-phone', 'Hotline', g.contact_phone, { placeholder: '1900 xxxx' })}
          ${field('g-contact-hours', 'Giờ làm việc', g.contact_hours, { placeholder: '8:00 - 22:00' })}
          ${field('g-social-fb', 'Facebook Link', g.social_fb, { placeholder: 'https://facebook.com/...' })}
          ${field('g-social-tele', 'Telegram Link', g.social_tele, { placeholder: 'https://t.me/...' })}
          ${field('g-social-discord', 'Discord Link', g.social_discord, { placeholder: 'https://discord.gg/...' })}
        </div>

        <div class="settings-card mt-16">
          <div class="settings-section-title"><i class="fa-solid fa-coins"></i> Tiền tệ & Thuế</div>
          ${field('g-currency-name', 'Tên tiền tệ', g.currency_name, { placeholder: 'Ví dụ: VNĐ, Candy, Coin...' })}
          ${field('g-currency-icon', 'URL Icon tiền tệ (nếu dùng hình ảnh)', g.currency_icon, { placeholder: '/static/candy-icon.png' })}
          ${field('g-tax-rate', 'Thuế VAT (%)', g.tax_rate, { type: 'number', placeholder: 'Ví dụ: 8 hoặc 10 (để 0 nếu không thu thuế)' })}
        </div>
      </div>

      <!-- ═══ Appearance ═══ -->
      <div class="settings-section" data-section="appearance">
        <div class="settings-card">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            Giao diện & Hiển thị
          </div>
          ${toggleRow('ap-show-slider', 'Hiển thị Slider', 'Bật/tắt slider trên trang chủ', ap.show_slider !== false)}
          ${toggleRow('ap-show-banner', 'Hiển thị Banner', 'Bật/tắt banner quảng cáo', ap.show_banner !== false)}
          ${toggleRow('ap-show-viewed', 'Hiển thị Sản phẩm đã xem', 'Hiển thị section sản phẩm đã xem gần đây', ap.show_viewed !== false)}
        </div>
        <div class="settings-card mt-16">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Danh mục hiển thị trên Trang chủ
          </div>
          <p class="text-muted text-sm mb-16">Chọn các danh mục sẽ hiển thị sản phẩm trên trang chủ. Kéo để sắp xếp thứ tự.</p>
          <div class="home-cat-picker" id="home-cat-picker">
            ${categories.map(c => {
              const checked = (ap.home_categories || '').split(',').map(s => s.trim()).includes(c.slug);
              const iconUrl = c.image_url || c.icon_url;
              const iconHtml = iconUrl ? `<img src="${iconUrl}" style="width:20px;height:20px;object-fit:contain;border-radius:4px;" />` : '<i class="fa-solid fa-folder" style="font-size:16px;color:var(--text-muted)"></i>';
              return `<label class="home-cat-item${checked ? ' selected' : ''}"><input type="checkbox" value="${c.slug}" ${checked ? 'checked' : ''} />${iconHtml}<span>${esc(c.name)}</span></label>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- ═══ Scripts ═══ -->
      <div class="settings-section" data-section="scripts">
        <div class="settings-card">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Scripts & HTML tùy chỉnh
          </div>
          ${field('sc-header', 'Script/HTML Header (Trang Khách)', sc.header_script, { type: 'textarea', rows: 6, placeholder: '<script>...</script> hoặc HTML chèn vào <head>' })}
          ${field('sc-footer', 'Script/HTML Footer (Trang Khách)', sc.footer_script, { type: 'textarea', rows: 6, placeholder: '<script>...</script> hoặc HTML chèn trước </body>' })}
        </div>
      </div>

      <!-- ═══ Images ═══ -->
      <div class="settings-section" data-section="images">
        <div class="settings-card">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Hình ảnh
          </div>
          <div class="settings-image-grid">
            <div class="settings-image-field">
              <div class="image-field-row">
                ${field('im-logo', 'Logo URL', im.logo_url, { placeholder: 'https://example.com/logo.png' })}
                ${imageUploadControl('im-logo', 'im-logo-upload', 'Upload', 'im-logo-preview')}
              </div>
              <div class="settings-image-preview-wrap">
                <div class="settings-image-preview-label">Xem trước logo</div>
                <div class="settings-image-preview" id="im-logo-preview">${im.logo_url ? `<img src="${esc(im.logo_url)}" alt="Logo preview" />` : '<span>Chưa có ảnh</span>'}</div>
              </div>
            </div>
            <div class="settings-image-field">
              <div class="image-field-row">
                ${field('im-favicon', 'Favicon URL', im.favicon_url, { placeholder: 'https://example.com/favicon.ico' })}
                ${imageUploadControl('im-favicon', 'im-favicon-upload', 'Upload', 'im-favicon-preview')}
              </div>
              <div class="settings-image-preview-wrap">
                <div class="settings-image-preview-label">Xem trước favicon</div>
                <div class="settings-image-preview settings-image-preview-favicon" id="im-favicon-preview">${im.favicon_url ? `<img src="${esc(im.favicon_url)}" alt="Favicon preview" />` : '<span>Chưa có ảnh</span>'}</div>
              </div>
            </div>
            <div class="settings-image-field">
              <div class="image-field-row">
                ${field('im-default', 'Default Image URL', im.default_image_url, { placeholder: 'https://example.com/default.png' })}
                ${imageUploadControl('im-default', 'im-default-upload', 'Upload', 'im-default-preview')}
              </div>
              <div class="settings-image-preview-wrap">
                <div class="settings-image-preview-label">Xem trước ảnh mặc định</div>
                <div class="settings-image-preview" id="im-default-preview">${im.default_image_url ? `<img src="${esc(im.default_image_url)}" alt="Default image preview" />` : '<span>Chưa có ảnh</span>'}</div>
              </div>
            </div>
            <div class="settings-image-field">
              <div class="image-field-row">
                ${field('im-seo', 'SEO / Social Image URL', im.seo_image_url || im.default_image_url, { placeholder: 'https://example.com/seo-share.png' })}
                ${imageUploadControl('im-seo', 'im-seo-upload', 'Upload', 'im-seo-preview')}
              </div>
              <div class="settings-image-preview-wrap">
                <div class="settings-image-preview-label">Xem trước ảnh SEO / chia sẻ</div>
                <div class="settings-image-preview" id="im-seo-preview">${(im.seo_image_url || im.default_image_url) ? `<img src="${esc(im.seo_image_url || im.default_image_url)}" alt="SEO image preview" />` : '<span>Chưa có ảnh</span>'}</div>
              </div>
            </div>
            <div class="settings-image-field">
              <div class="image-field-row">
                ${field('im-avatar', 'Default Avatar URL', im.default_avatar_url, { placeholder: 'https://example.com/avatar.png' })}
                ${imageUploadControl('im-avatar', 'im-avatar-upload', 'Upload', 'im-avatar-preview')}
              </div>
              <div class="settings-image-preview-wrap">
                <div class="settings-image-preview-label">Xem trước avatar</div>
                <div class="settings-image-preview settings-image-preview-avatar" id="im-avatar-preview">${im.default_avatar_url ? `<img src="${esc(im.default_avatar_url)}" alt="Avatar preview" />` : '<span>Chưa có ảnh</span>'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ Security ═══ -->
      <div class="settings-section" data-section="security">
        <div class="settings-card">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Bảo mật & Khóa IP
          </div>
          <p class="text-muted text-sm mb-16">Cấu hình các giới hạn bảo mật. Đặt 0 để vô hiệu hóa.</p>
          <div class="settings-row">
            ${field('se-lock-login', 'Khóa IP nếu đăng nhập sai (lần)', se.lock_ip_login_fail, { type: 'number', placeholder: '5' })}
            ${field('se-lock-pass', 'Khóa tài khoản nếu sai pass (lần)', se.lock_account_pass_fail, { type: 'number', placeholder: '5' })}
          </div>
          <div class="settings-row">
            ${field('se-lock-api', 'Khóa IP nếu sai API KEY (lần)', se.lock_ip_api_fail, { type: 'number', placeholder: '5' })}
            ${field('se-lock-2fa', 'Khóa IP nếu sai 2FA/OTP (lần)', se.lock_ip_2fa_fail, { type: 'number', placeholder: '5' })}
          </div>
          <div class="settings-row">
            ${field('se-lock-invoice', 'Khóa IP nếu tạo hóa đơn spam (lần)', se.lock_ip_invoice_spam, { type: 'number', placeholder: '5' })}
            ${field('se-lock-forgot', 'Khóa IP nếu spam quên mật khẩu (lần)', se.lock_ip_forgot_spam, { type: 'number', placeholder: '5' })}
          </div>
          <div class="settings-row">
            ${field('se-lock-admin', 'Khóa IP truy cập Admin trái phép (lần)', se.lock_ip_admin_illegal, { type: 'number', placeholder: '5' })}
            ${field('se-max-accounts', 'Số tài khoản tối đa trên 1 IP', se.max_accounts_per_ip, { type: 'number', placeholder: '3' })}
          </div>
          <div class="settings-row">
            ${field('se-login-duration', 'Thời gian lưu đăng nhập (giây)', se.login_duration, { type: 'number', placeholder: '2592000' })}
            ${field('se-cron-secret', 'Mã bí mật Cron Job', se.cron_secret, { placeholder: 'Nhập mã bí mật' })}
          </div>
          ${field('se-admin-path', 'Đường dẫn Admin Panel', se.admin_path, { placeholder: 'admin' })}
        </div>
        <div class="settings-card">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Bảo mật nâng cao
          </div>
          ${toggleRow('se-admin-one-ip', 'Chỉ cho phép Admin từ 1 IP', 'Giới hạn truy cập admin chỉ từ 1 IP duy nhất', se.admin_one_ip === true)}
          ${toggleRow('se-admin-one-device', 'Chỉ cho phép Admin từ 1 thiết bị', 'Mỗi tài khoản admin chỉ đăng nhập trên 1 thiết bị', se.admin_one_device === true)}
          ${toggleRow('se-client-one-device', 'Chỉ cho phép Client từ 1 thiết bị', 'Mỗi tài khoản client chỉ đăng nhập trên 1 thiết bị', se.client_one_device === true)}
          ${toggleRow('se-hide-admin-btn', 'Ẩn nút truy cập Admin Panel', 'Ẩn nút Admin trên giao diện trang khách', se.hide_admin_button === true)}
          ${toggleRow('se-strong-pass', 'Bắt buộc mật khẩu phức tạp', 'Yêu cầu mật khẩu có chữ hoa, chữ thường, số và ký tự đặc biệt', se.strong_password === true)}
        </div>
      </div>

      <!-- ═══ Captcha ═══ -->
      <div class="settings-section" data-section="captcha">
        <div class="settings-card">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Cấu hình Captcha
          </div>
          ${toggleRow('ca-enabled', 'Bật Captcha', 'Kích hoạt xác minh Captcha trên các form', ca.enabled === true)}
          <div class="divider"></div>
          ${field('ca-type', 'Loại Captcha', ca.type, {
            type: 'select',
            options: [
              { value: '', label: '— Chọn loại Captcha —' },
              { value: 'recaptcha_v2', label: 'reCAPTCHA v2' },
              { value: 'recaptcha_v3', label: 'reCAPTCHA v3' },
              { value: 'turnstile', label: 'Cloudflare Turnstile' },
              { value: 'hcaptcha', label: 'hCaptcha' },
            ]
          })}
          ${field('ca-site-key', 'Site Key', ca.site_key, { placeholder: 'Nhập Site Key' })}
          ${field('ca-secret-key', 'Secret Key', ca.secret_key, { type: 'password', placeholder: 'Nhập Secret Key' })}
        </div>
      </div>

      <!-- ═══ Features ═══ -->
      <div class="settings-section" data-section="features">
        <div class="settings-card">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Bật / Tắt chức năng
          </div>
          <p class="text-muted text-sm mb-16">Tắt chức năng sẽ ẩn trên giao diện và chặn truy cập API tương ứng.</p>
          ${toggleRow('fe-blog', 'Blog', 'Trang blog và bài viết', fe.blog !== false)}
          ${toggleRow('fe-offers', 'Ưu đãi / Gift Code', 'Trang ưu đãi và mã giảm giá công khai', fe.offers !== false)}
          ${toggleRow('fe-affiliate', 'Affiliate / Giới thiệu', 'Chương trình giới thiệu bạn bè & hoa hồng', fe.affiliate !== false)}
          ${toggleRow('fe-support', 'Hỗ trợ / Tickets', 'Trang hỗ trợ, tạo ticket và support pages', fe.support !== false)}
          ${toggleRow('fe-flash_sales', 'Flash Sale', 'Flash sale trên trang chủ', fe.flash_sales !== false)}
          ${toggleRow('fe-reviews', 'Đánh giá sản phẩm', 'Đánh giá & nhận xét trên chi tiết sản phẩm', fe.reviews !== false)}
          ${toggleRow('fe-announcements', 'Thông báo', 'Mục thông báo trên trang chủ', fe.announcements !== false)}
          ${toggleRow('fe-balance', 'Số dư / Nạp tiền', 'Hệ thống số dư và nạp tiền', fe.balance !== false)}
          ${toggleRow('fe-api_docs', 'Tài liệu API / API Keys', 'Cho phép dev tạo API key & xem tài liệu (yêu cầu bật Số dư)', fe.api_docs === true && fe.balance !== false)}
          ${toggleRow('fe-wishlist', 'Yêu thích', 'Tính năng yêu thích sản phẩm', fe.wishlist !== false)}
        </div>
      </div>

      <!-- ═══ Database ═══ -->
      <div class="settings-section" data-section="database">
        <div class="settings-card">
          <div class="settings-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            Database provider
          </div>
          <div class="form-group">
            <label class="form-label" for="db-active-provider">Provider đang active</label>
            <select class="form-select" id="db-active-provider">
              <option value="postgres" ${dbSettings.active_provider === 'postgres' ? 'selected' : ''}>Neon/Postgres</option>
              <option value="mysql" ${dbSettings.active_provider === 'mysql' ? 'selected' : ''}>MySQL</option>
              <option value="supabase_postgres" ${dbSettings.active_provider === 'supabase_postgres' ? 'selected' : ''}>Supabase Postgres</option>
            </select>
            <div class="form-hint">Phase hiện tại chỉ hỗ trợ 1 SQL provider active tại một thời điểm.</div>
          </div>
        </div>

        ${['postgres', 'mysql', 'supabase_postgres'].map((provider) => {
          const item = dbCfg[provider] || {};
          const title = item.label || provider;
          const statusBadge = item.has_env_override
            ? '<span class="badge badge-green">ENV override</span>'
            : item.has_stored_url
              ? '<span class="badge badge-gray">Stored config</span>'
              : '<span class="badge badge-gray">Chưa cấu hình</span>';
          return `
            <div class="settings-card mt-16">
              <div class="settings-section-title">
                <span>${title}</span>
                <span>${statusBadge}</span>
              </div>
              <div class="settings-row">
                <div class="form-group">
                  <label class="form-label" for="db-${provider}-enabled">Bật provider</label>
                  <select class="form-select" id="db-${provider}-enabled">
                    <option value="true" ${item.enabled ? 'selected' : ''}>Bật</option>
                    <option value="false" ${!item.enabled ? 'selected' : ''}>Tắt</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Nguồn hiện tại</label>
                  <input class="form-input" value="${esc(item.env_source || (item.has_stored_url ? 'stored_config' : ''))}" disabled />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="db-${provider}-url">Database URL</label>
                <input class="form-input" id="db-${provider}-url" type="password" value="" placeholder="${esc(item.masked_url || 'Nhập connection string nếu muốn lưu fallback')}" />
                <div class="form-hint">URL thật không được trả về UI. Để trống nếu không muốn thay đổi giá trị đã lưu.</div>
              </div>
              <div class="settings-row">
                <div class="form-group">
                  <label class="form-label">Host</label>
                  <input class="form-input" value="${esc(item.host || '')}" disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Database</label>
                  <input class="form-input" value="${esc(item.database_name || '')}" disabled />
                </div>
              </div>
              <div class="settings-row">
                <button type="button" class="btn btn-ghost" data-db-test="${provider}">Test connection</button>
                <div class="form-hint" id="db-${provider}-test-result">${item.masked_url ? `Current: ${esc(item.masked_url)}` : 'Chưa có URL hiệu lực'}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Save bar -->
      <div class="settings-save-bar">
        <button type="button" class="btn btn-ghost" id="btn-reset-settings">Hoàn tác</button>
        <button type="submit" class="btn btn-primary btn-lg">Lưu cài đặt</button>
      </div>
    </form>

    <!-- ═══ AI Config (outside main form) ═══ -->
    <div class="settings-section" data-section="ai">
      <div class="settings-card">
        <div class="settings-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.09 3.26L16.36 6.4l-2.63 2.09.64 3.51L12 10.24 9.63 12l.64-3.51L7.64 6.4l3.27-1.14z"/><path d="M5 19l1.5-4.5L2 12l4.5-1.5L5 5l1.5 4.5L12 8l-1.5 4.5L12 19l-1.5-4.5L5 19z"/></svg>
          Cấu hình AI tự động viết nội dung
        </div>
        <div id="ai-config-area">Đang tải...</div>
      </div>
    </div>
  `;

  // ── Tab switching ──
  qsa('.settings-tab', content).forEach(tab => {
    tab.onclick = () => {
      qsa('.settings-tab', content).forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      qsa('.settings-section', content).forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const section = qs(`.settings-section[data-section="${tab.dataset.tab}"]`, content);
      if (section) section.classList.add('active');
    };
  });

  // ── Home category picker toggle ──
  const picker = qs('#home-cat-picker', content);
  if (picker) {
    picker.addEventListener('change', (e) => {
      const label = e.target.closest('.home-cat-item');
      if (label) label.classList.toggle('selected', e.target.checked);
    });
  }

  // ── Balance → API Docs dependency ──
  const feBalanceCb = qs('#fe-balance', content);
  const feApiDocsCb = qs('#fe-api_docs', content);
  if (feBalanceCb && feApiDocsCb) {
    feApiDocsCb.addEventListener('change', (e) => {
      if (e.target.checked && !feBalanceCb.checked) {
        feBalanceCb.checked = true;
        toast('Đã tự động bật Số dư vì Tài liệu API yêu cầu tính năng này', 'info');
      }
    });
    feBalanceCb.addEventListener('change', (e) => {
      if (!e.target.checked && feApiDocsCb.checked) {
        feApiDocsCb.checked = false;
      }
    });
  }

  // ── Reset button ──
  qs('#btn-reset-settings', content).onclick = () => {
    renderAdminSettings(view);
  };

  // ── Save handler ──
  const bindImagePreview = (inputId, previewId, emptyText = 'Chưa có ảnh', mode = 'contain') => {
    const input = qs(`#${inputId}`, content);
    const preview = qs(`#${previewId}`, content);
    if (!input || !preview) return;
    const renderPreview = () => {
      const url = input.value.trim();
      if (!url) {
        preview.innerHTML = `<span>${emptyText}</span>`;
        return;
      }
      const img = new Image();
      img.alt = 'preview';
      img.onload = () => {
        img.style.display = 'block';
        img.style.maxWidth = '100%';
        img.style.maxHeight = mode === 'favicon' ? '48px' : '180px';
        img.style.objectFit = mode === 'avatar' ? 'cover' : 'contain';
        if (mode === 'avatar') {
          img.style.width = '96px';
          img.style.height = '96px';
          img.style.borderRadius = '999px';
        } else if (mode === 'favicon') {
          img.style.width = '48px';
          img.style.height = '48px';
        }
        preview.innerHTML = '';
        preview.appendChild(img);
      };
      img.onerror = () => {
        preview.innerHTML = `<span>Không tải được ảnh</span>`;
      };
      img.src = url;
    };
    input.addEventListener('input', renderPreview);
    input.addEventListener('change', renderPreview);
    renderPreview();
  };

  bindImagePreview('im-logo', 'im-logo-preview', 'Chưa có logo');
  bindImagePreview('im-favicon', 'im-favicon-preview', 'Chưa có favicon', 'favicon');
  bindImagePreview('im-default', 'im-default-preview', 'Chưa có ảnh mặc định');
  bindImagePreview('im-seo', 'im-seo-preview', 'Chưa có ảnh SEO / chia sẻ');
  bindImagePreview('im-avatar', 'im-avatar-preview', 'Chưa có avatar', 'avatar');
  bindImageUploads(content);

  const collectDatabasePayload = () => {
    const providers = ['postgres', 'mysql', 'supabase_postgres'];
    const currentProviders = dbCfg || {};
    return {
      active_provider: val('db-active-provider'),
      providers: Object.fromEntries(providers.map((provider) => {
        const current = currentProviders[provider] || {};
        const nextUrl = val(`db-${provider}-url`).trim();
        const payload = {
          enabled: val(`db-${provider}-enabled`) === 'true',
          label: current.label || provider,
        };
        if (nextUrl) payload.database_url = nextUrl;
        return [provider, payload];
      })),
    };
  };

  qsa('[data-db-test]', content).forEach((btn) => {
    btn.onclick = async () => {
      const provider = btn.dataset.dbTest;
      const resultEl = qs(`#db-${provider}-test-result`, content);
      const url = val(`db-${provider}-url`).trim();
      btn.disabled = true;
      if (resultEl) resultEl.textContent = 'Đang kiểm tra kết nối...';
      try {
        const res = await apiFetch('/admin/settings/database/test-connection', {
          method: 'POST',
          body: JSON.stringify({ provider, database_url: url || undefined }),
        });
        if (resultEl) resultEl.textContent = res.ok
          ? `Kết nối thành công: ${res.masked_url || provider}`
          : `Kết nối thất bại: ${res.error || 'unknown_error'}`;
        toast(res.ok ? 'Test connection thành công' : 'Test connection thất bại', res.ok ? 'success' : 'error');
      } catch (err) {
        if (resultEl) resultEl.textContent = `Kết nối thất bại: ${err.message}`;
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    };
  });

  qs('#settings-unified-form', content).onsubmit = async (e) => {
    e.preventDefault();
    const val = (id) => qs(`#${id}`, content)?.value ?? '';
    const chk = (id) => qs(`#${id}`, content)?.checked ?? false;
    const num = (id) => { const v = val(id); return v === '' ? '' : Number(v); };

    const payload = {
      settings_general: {
        title: val('g-title'),
        description: val('g-description'),
        site_description: val('g-site-description'),
        copyright_text: val('g-copyright'),
        keywords: val('g-keywords'),
        author: val('g-author'),
        seo_title: val('g-seo-title'),
        seo_description: val('g-seo-description'),
        seo_keywords: val('g-seo-keywords'),
        seo_author: val('g-seo-author'),
        site_url: val('g-site-url'),
        twitter_card: val('g-twitter-card'),
        timezone: val('g-timezone'),
        contact_email: val('g-contact-email'),
        contact_phone: val('g-contact-phone'),
        contact_hours: val('g-contact-hours'),
        social_fb: val('g-social-fb'),
        social_tele: val('g-social-tele'),
        social_discord: val('g-social-discord'),
        currency_name: val('g-currency-name'),
        currency_icon: val('g-currency-icon'),
        tax_rate: num('g-tax-rate'),
      },
      settings_appearance: {
        show_slider: chk('ap-show-slider'),
        show_banner: chk('ap-show-banner'),
        show_viewed: chk('ap-show-viewed'),
        home_categories: [...qsa('#home-cat-picker input:checked', content)].map(i => i.value).join(','),
      },
      settings_scripts: {
        header_script: val('sc-header'),
        footer_script: val('sc-footer'),
      },
      settings_images: {
        logo_url: val('im-logo'),
        favicon_url: val('im-favicon'),
        default_image_url: val('im-default'),
        seo_image_url: val('im-seo'),
        default_avatar_url: val('im-avatar'),
      },
      settings_security: {
        lock_ip_login_fail: num('se-lock-login'),
        lock_account_pass_fail: num('se-lock-pass'),
        lock_ip_api_fail: num('se-lock-api'),
        lock_ip_2fa_fail: num('se-lock-2fa'),
        lock_ip_invoice_spam: num('se-lock-invoice'),
        lock_ip_forgot_spam: num('se-lock-forgot'),
        lock_ip_admin_illegal: num('se-lock-admin'),
        max_accounts_per_ip: num('se-max-accounts'),
        login_duration: num('se-login-duration'),
        cron_secret: val('se-cron-secret'),
        admin_path: val('se-admin-path'),
        admin_one_ip: chk('se-admin-one-ip'),
        admin_one_device: chk('se-admin-one-device'),
        client_one_device: chk('se-client-one-device'),
        hide_admin_button: chk('se-hide-admin-btn'),
        strong_password: chk('se-strong-pass'),
      },
      settings_captcha: {
        enabled: chk('ca-enabled'),
        type: val('ca-type'),
        site_key: val('ca-site-key'),
        secret_key: val('ca-secret-key'),
      },
      settings_features: {
        blog: chk('fe-blog'),
        offers: chk('fe-offers'),
        affiliate: chk('fe-affiliate'),
        support: chk('fe-support'),
        flash_sales: chk('fe-flash_sales'),
        reviews: chk('fe-reviews'),
        announcements: chk('fe-announcements'),
        balance: chk('fe-balance'),
        api_docs: chk('fe-balance') && chk('fe-api_docs'),
        wishlist: chk('fe-wishlist'),
      },
    };

    try {
      await apiFetch('/admin/settings/unified', { method: 'PUT', body: JSON.stringify(payload) });
      await apiFetch('/admin/settings/database', { method: 'PUT', body: JSON.stringify(collectDatabasePayload()) });
      
      // Cũng lưu luôn config AI chung
      const aiProvider = qs('#ai-provider', content)?.value;
      if (aiProvider) {
         const aiBody = {
          provider: aiProvider,
          model: qs('#ai-model', content)?.value || null,
          api_key: qs('#ai-apikey', content)?.value || null,
          custom_base_url: qs('#ai-baseurl', content)?.value || null,
        };
        const res = await apiFetch('/admin/ai/config', { method: 'PUT', body: JSON.stringify(aiBody) });
        if (res.api_key_masked) {
          const hint = qs('#ai-apikey', content)?.parentElement?.querySelector('.form-hint');
          if (hint) hint.textContent = 'Key hiện tại: ' + res.api_key_masked;
        }
      }

      toast('Đã lưu cài đặt', 'success');
      // Tải lại setting mới và update giao diện lập tức
      appSettings = await apiFetch('/admin/settings/public').catch(() => ({}));
      appSettings.features = appSettings.features || {};
      window.appSettings = appSettings;
      if (typeof loadSidebar === 'function') loadSidebar();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // ── AI Config Panel ──
  (async () => {
    const area = qs('#ai-config-area', content);
    if (!area) return;
    try {
      const cfg = await apiFetch('/admin/ai/config');
      const providers = cfg.providers || {};
      const currentProvider = cfg.provider || '';
      const currentModel = cfg.model || '';
      const masked = cfg.api_key_masked || '';

      area.innerHTML = `
        <div class="form-group">
          <label class="form-label" for="ai-provider">Provider</label>
          <select class="form-select" id="ai-provider">
            <option value="">— Chọn provider —</option>
            ${Object.entries(providers).map(([pid, p]) =>
              `<option value="${pid}" ${pid === currentProvider ? 'selected' : ''}>${p.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ai-model">Model</label>
          <select class="form-select" id="ai-model">
            <option value="">— Chọn model —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ai-apikey">API Key</label>
          <input class="form-input" id="ai-apikey" type="password" placeholder="${masked || 'Nhập API key của provider'}" />
          ${masked ? `<div class="form-hint">Key hiện tại: ${masked}</div>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label" for="ai-baseurl">Custom Base URL (tuỳ chọn)</label>
          <input class="form-input" id="ai-baseurl" type="text" value="${cfg.custom_base_url || ''}" placeholder="Để trống để dùng URL mặc định" />
        </div>
        <div class="settings-row" style="gap:8px;margin-top:12px">
          <button type="button" class="btn btn-ghost" id="btn-ai-test">Test kết nối</button>
          <span id="ai-test-result" class="form-hint" style="margin-left:8px"></span>
        </div>
      `;

      // Populate models dropdown
      const populateModels = (pid) => {
        const sel = qs('#ai-model', content);
        const p = providers[pid];
        if (!p || !sel) return;
        sel.innerHTML = p.models.map(m =>
          `<option value="${m}" ${m === currentModel || m === p.default_model ? 'selected' : ''}>${m}</option>`
        ).join('');
      };
      if (currentProvider) populateModels(currentProvider);

      qs('#ai-provider', content).onchange = (e) => populateModels(e.target.value);

      // Test
      qs('#btn-ai-test', content).onclick = async () => {
        const resultEl = qs('#ai-test-result', content);
        resultEl.textContent = 'Đang kiểm tra...';
        try {
          const res = await apiFetch('/admin/ai/test', { method: 'POST' });
          resultEl.textContent = '✓ ' + (res.response || 'Kết nối thành công');
          resultEl.style.color = 'var(--success)';
          toast('AI hoạt động bình thường', 'success');
        } catch (err) {
          resultEl.textContent = '✗ ' + err.message;
          resultEl.style.color = 'var(--danger)';
          toast(err.message, 'error');
        }
      };
    } catch (err) {
      area.innerHTML = `<div class="form-hint" style="color:var(--danger)">Lỗi tải cấu hình AI: ${err.message}</div>`;
    }
  })();

  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Lỗi tải cài đặt</h3><p class="text-muted">${err.message}</p></div>`;
  }
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN BANNERS
// ═══════════════════════════════════════════════════════════════
async function renderAdminBanners(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  let currentBanners = [];

  content.onclick = async (e) => {
    const addBtn = e.target.closest('#btn-add-banner');
    if (addBtn) {
      showBannerModal(null, refresh);
      return;
    }

    const editBtn = e.target.closest('[data-edit-banner]');
    if (editBtn) {
      const banner = currentBanners.find(x => x.id === +editBtn.dataset.editBanner);
      if (banner) showBannerModal(banner, refresh);
      return;
    }

    const delBtn = e.target.closest('[data-del-banner]');
    if (delBtn) {
      e.preventDefault();
      if (!confirm('Xóa banner này?')) return;
      try {
        await apiFetch(`/banners/admin/${delBtn.dataset.delBanner}`, { method: 'DELETE' });
        toast('Đã xóa', 'success');
        await refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
  };

  const refresh = async () => {
    try {
      const banners = await apiFetch('/banners/admin/list');
      currentBanners = banners;
      content.innerHTML = `
        ${cuiPageHeader('Quản lý Banners', 'Điều phối banner và điểm nhấn marketing', '<button class="btn btn-primary" id="btn-add-banner"><i class="fa-solid fa-plus"></i> Thêm banner</button>')}
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
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><h3>Lỗi tải banners</h3><p class="text-muted">${err.message}</p></div>`;
    }
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
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  let currentSales = [];

  content.onclick = async (e) => {
    const addBtn = e.target.closest('#btn-add-fs');
    if (addBtn) {
      showFlashSaleModal(null, refresh);
      return;
    }

    const editBtn = e.target.closest('[data-edit-fs]');
    if (editBtn) {
      const sale = currentSales.find(x => x.id === +editBtn.dataset.editFs);
      if (sale) showFlashSaleModal(sale, refresh);
      return;
    }

    const delBtn = e.target.closest('[data-del-fs]');
    if (delBtn) {
      e.preventDefault();
      if (!confirm('Xóa flash sale này?')) return;
      try {
        await apiFetch(`/flash-sales/admin/${delBtn.dataset.delFs}`, { method: 'DELETE' });
        toast('Đã xóa', 'success');
        await refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
  };

  const refresh = async () => {
    try {
      const sales = await apiFetch('/flash-sales/admin/list');
      currentSales = sales;
      content.innerHTML = `
        ${cuiPageHeader('Flash Sales', 'Thiết lập chiến dịch giảm giá nhanh', '<button class="btn btn-primary" id="btn-add-fs"><i class="fa-solid fa-plus"></i> Thêm Flash Sale</button>')}
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
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><h3>Lỗi tải flash sale</h3><p class="text-muted">${err.message}</p></div>`;
    }
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
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  let currentCodes = [];

  content.onclick = async (e) => {
    const addBtn = e.target.closest('#btn-add-gc');
    if (addBtn) {
      showGiftCodeModal(null, refresh);
      return;
    }

    const editBtn = e.target.closest('[data-edit-gc]');
    if (editBtn) {
      const code = currentCodes.find(x => x.id === +editBtn.dataset.editGc);
      if (code) showGiftCodeModal(code, refresh);
      return;
    }

    const delBtn = e.target.closest('[data-del-gc]');
    if (delBtn) {
      e.preventDefault();
      if (!confirm('Xóa gift code này?')) return;
      try {
        await apiFetch(`/gift-codes/admin/${delBtn.dataset.delGc}`, { method: 'DELETE' });
        toast('Đã xóa', 'success');
        await refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
  };

  const refresh = async () => {
    try {
      const codes = await apiFetch('/gift-codes/admin/list');
      currentCodes = codes;
      content.innerHTML = `
        ${cuiPageHeader('Gift Codes', 'Quản lý gift code và phân phối ưu đãi', '<button class="btn btn-primary" id="btn-add-gc"><i class="fa-solid fa-plus"></i> Thêm mã</button>')}
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Mã</th><th>Loại</th><th>Giá trị</th><th>Đơn tối thiểu</th><th>Giảm tối đa</th><th>Đã dùng/Giới hạn</th><th>Hết hạn</th><th>Trạng thái</th><th>Ưu đãi</th><th></th></tr></thead>
          <tbody>${codes.length ? codes.map(c => `<tr>
            <td class="td-bold td-mono">${c.code}</td>
            <td><span class="badge ${c.discount_type === 'percent' ? 'badge-blue' : 'badge-purple'}">${c.discount_type === 'percent' ? '%' : 'Fixed'}</span></td>
            <td>${c.discount_type === 'percent' ? c.discount_value + '%' : fmt(c.discount_value)}</td>
            <td>${c.min_order ? fmt(c.min_order) : '—'}</td>
            <td>${c.max_discount ? fmt(c.max_discount) : '—'}</td>
            <td>${c.used_count || 0}/${c.usage_limit || '∞'}</td>
            <td class="text-sm">${fmtDate(c.expires_at)}</td>
            <td>${c.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Off</span>'}</td>
            <td>${c.is_public ? '<span class="badge badge-blue">Hiện</span>' : '<span class="badge badge-gray">Ẩn</span>'}</td>
            <td><div class="tbl-actions"><button class="tbl-btn tbl-edit" data-edit-gc="${c.id}">Sửa</button><button class="tbl-btn tbl-delete" data-del-gc="${c.id}">Xóa</button></div></td>
          </tr>`).join('') : '<tr><td colspan="10" class="text-center text-muted">Chưa có gift code nào</td></tr>'}</tbody>
        </table></div></div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><h3>Lỗi tải gift code</h3><p class="text-muted">${err.message}</p></div>`;
    }
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
      <div class="form-group"><label class="form-label"><input type="checkbox" id="gc-public" ${gc?.is_public ? 'checked' : ''} /> Hiện trên trang Ưu đãi</label></div>
      <div class="form-group"><label class="form-label">Mô tả (hiện trên trang ưu đãi)</label><textarea class="form-input" id="gc-desc" rows="2" placeholder="VD: Áp dụng cho tất cả sản phẩm...">${gc?.description || ''}</textarea></div>
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
      is_public: qs('#gc-public').checked,
      description: qs('#gc-desc').value.trim() || null,
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
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  const refresh = async () => {
    const affiliates = await apiFetch('/affiliate/admin/list');
    content.innerHTML = `
      ${cuiPageHeader('Affiliates', 'Theo dõi cộng tác viên và hoa hồng')}
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
    content.onclick = async (e) => {
      const editBtn = e.target.closest('[data-edit-aff]');
      if (editBtn) {
        const a = affiliates.find(x => x.id === +editBtn.dataset.editAff);
        if (a) showAffiliateModal(a, refresh);
        return;
      }

      const viewBtn = e.target.closest('[data-view-aff]');
      if (viewBtn) {
        try {
          const refs = await apiFetch(`/affiliate/admin/${viewBtn.dataset.viewAff}/referrals`);
          let html = '<h3 class="modal-title mb-16">Referrals</h3>';
          if (!refs.length) {
            html += '<div class="text-center text-muted py-16">Chưa có referral nào</div>';
          } else {
            html += `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Ngày đăng ký</th><th>Tổng chi tiêu</th><th>Hoa hồng tạo ra</th></tr></thead><tbody>${refs.map(r => `<tr><td>${r.email || '—'}</td><td>${fmtDate(r.created_at)}</td><td>${fmt(r.total_spent || 0)}</td><td>${fmt(r.commission_generated || 0)}</td></tr>`).join('')}</tbody></table></div>`;
          }
          html += '<div class="mt-16 text-right"><button class="btn btn-ghost" id="aff-close">Đóng</button></div>';
          openModal(html);
          qs('#aff-close').onclick = closeModal;
        } catch (err) { toast(err.message, 'error'); }
      }
    };
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

// ── ADMIN SUPPORT PAGES ────────────────────────────────────────

async function renderAdminSupportPages(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  let currentPages = [];

  content.onclick = async (e) => {
    const addBtn = e.target.closest('#btn-add-page');
    if (addBtn) {
      showSupportPageModal(null, refresh);
      return;
    }

    const editBtn = e.target.closest('[data-edit-page]');
    if (editBtn) {
      const page = currentPages.find(p => p.id === parseInt(editBtn.dataset.editPage));
      if (page) showSupportPageModal(page, refresh);
      return;
    }

    const delBtn = e.target.closest('[data-del-page]');
    if (delBtn) {
      e.preventDefault();
      if (!confirm('Xóa trang này?')) return;
      try {
        await apiFetch(`/support/pages/${delBtn.dataset.delPage}`, { method: 'DELETE' });
        toast('Đã xóa', 'success');
        await refresh();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
  };
  
  const refresh = async () => {
    try {
      const pages = await apiFetch('/support/pages');
      currentPages = pages;
      const html = `
        ${cuiPageHeader('Quản lý trang hỗ trợ', 'Quản lý FAQ, chính sách và nội dung hỗ trợ', '<button class="btn btn-primary" id="btn-add-page"><i class="fa-solid fa-plus"></i> Thêm trang</button>')}
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Tiêu đề</th><th>Slug</th><th>Loại</th><th>Trạng thái</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              ${pages.length ? pages.map(p => `
                <tr>
                  <td>${p.title}</td>
                  <td><code>${p.slug}</code></td>
                  <td><span class="badge">${p.page_type}</span></td>
                  <td>${p.is_published ? '<span class="text-success">Xuất bản</span>' : '<span class="text-muted">Nháp</span>'}</td>
                  <td>
                    <button class="btn btn-sm btn-ghost" data-edit-page="${p.id}">Sửa</button>
                    <button class="btn btn-sm btn-ghost text-danger" data-del-page="${p.id}">Xóa</button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="text-center text-muted">Chưa có trang nào</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
      
      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><h3>Lỗi tải trang hỗ trợ</h3><p class="text-muted">${err.message}</p></div>`;
    }
  };
  await refresh();
}

function showSupportPageModal(page, onDone) {
  const isEdit = !!page;
  openModal(`
    <h3 class="modal-title mb-16">${isEdit ? 'Sửa trang' : 'Thêm trang'}</h3>
    <form id="page-form">
      <div class="form-group">
        <label class="form-label">Tiêu đề</label>
        <input type="text" class="form-input" id="page-title" value="${page?.title || ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Slug</label>
        <input type="text" class="form-input" id="page-slug" value="${page?.slug || ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Loại</label>
        <select class="form-select" id="page-type" required>
          <option value="warranty" ${page?.page_type === 'warranty' ? 'selected' : ''}>Chính sách bảo hành</option>
          <option value="purchase_guide" ${page?.page_type === 'purchase_guide' ? 'selected' : ''}>Hướng dẫn mua hàng</option>
          <option value="faq" ${page?.page_type === 'faq' ? 'selected' : ''}>Câu hỏi thường gặp</option>
          <option value="privacy" ${page?.page_type === 'privacy' ? 'selected' : ''}>Chính sách bảo mật</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nội dung (HTML)</label>
        <div class="editor-toolbar" id="page-content-toolbar">
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="bold"><b>B</b></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="italic"><i>I</i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="link"><i class="fa-solid fa-link"></i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="image"><i class="fa-regular fa-image"></i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="ul"><i class="fa-solid fa-list-ul"></i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="h2">H2</button>
        </div>
        <textarea class="form-input" id="page-content" rows="10">${page?.content || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Mô tả SEO</label>
        <textarea class="form-input" id="page-desc" rows="2">${page?.meta_description || ''}</textarea>
      </div>
      <div class="form-group">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="page-published" ${page?.is_published ? 'checked' : ''} />
          <span>Xuất bản</span>
        </label>
      </div>
      <div class="flex gap-8">
        <button type="submit" class="btn btn-primary flex-1">Lưu</button>
        <button type="button" class="btn btn-ghost" id="page-cancel">Hủy</button>
      </div>
    </form>
  `);
  
  createRichTextEditor({
    textareaId: 'page-content',
    toolbarId: 'page-content-toolbar',
    placeholder: 'Nhập nội dung trang hỗ trợ...',
  });

  qs('#page-cancel').onclick = closeModal;
  createRichTextEditor({ textarea: qs('#page-desc'), placeholder: 'Nhập mô tả SEO...', minHeight: 160 });
  qs('#page-form').onsubmit = async (e) => {
    e.preventDefault();
    if (window.syncRichTextEditors) window.syncRichTextEditors();
    const body = {
      slug: qs('#page-slug').value,
      title: qs('#page-title').value,
      content: qs('#page-content').value,
      page_type: qs('#page-type').value,
      meta_description: qs('#page-desc').value,
      is_published: qs('#page-published').checked,
    };
    try {
      if (isEdit) {
        await apiFetch(`/support/pages/${page.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/support/pages', { method: 'POST', body: JSON.stringify(body) });
      }
      closeModal();
      toast('Đã lưu', 'success');
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

// ── ADMIN SUPPORT TICKETS ──────────────────────────────────────

async function renderAdminTickets(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  
  // Check if we have a ticketId in the hash
  const hashParts = location.hash.split('?');
  const params = new URLSearchParams(hashParts[1] || '');
  const ticketId = params.get('id');
  
  if (ticketId) {
    await renderAdminTicketDetail(content, ticketId);
    return;
  }

  const refresh = async () => {
    try {
      const tickets = await apiFetch('/support/tickets?user_id=admin');
      const html = `
        ${cuiPageHeader('Quản lý yêu cầu hỗ trợ', `Xử lý ticket và phản hồi khách hàng · ${tickets.length} ticket`)}
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Mã</th><th>Khách hàng</th><th>Tiêu đề</th><th>Danh mục</th><th>Trạng thái</th><th>Ưu tiên</th><th>Cập nhật</th><th></th></tr>
            </thead>
            <tbody>
              ${tickets.length ? tickets.map(t => `
                <tr>
                  <td class="td-mono"><strong>${t.ticket_number}</strong></td>
                  <td class="text-sm">${t.user_name || t.user_email || '—'}</td>
                  <td>${t.subject}</td>
                  <td><span class="badge">${t.category}</span></td>
                  <td><span class="badge status-${t.status}">${statusLabel(t.status)}</span></td>
                  <td><span class="badge priority-${t.priority}">${priorityLabel(t.priority)}</span></td>
                  <td class="text-sm text-muted">${fmtDate(t.updated_at || t.created_at)}</td>
                  <td><button class="tbl-btn tbl-view" data-open-ticket="${t.id}">Xem</button></td>
                </tr>
              `).join('') : '<tr><td colspan="8" class="text-center text-muted">Không có yêu cầu nào</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
      content.innerHTML = html;
      content.onclick = (e) => {
        const openBtn = e.target.closest('[data-open-ticket]');
        if (!openBtn) return;
        location.hash = `#/admin/tickets?id=${openBtn.dataset.openTicket}`;
      };
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><h3>Lỗi tải tickets</h3><p class="text-muted">${err.message}</p></div>`;
    }
  };
  await refresh();
}

async function renderAdminTicketDetail(content, ticketId) {
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const data = await apiFetch(`/support/tickets/${ticketId}`);
    const ticket = data.ticket;
    const messages = data.messages || [];

    content.innerHTML = `
      <div class="cui-page-header" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-ghost btn-sm" id="btn-back-tickets"><i class="fa-solid fa-arrow-left"></i></button>
          <div class="cui-page-header-left">
            <div class="cui-page-title" style="font-size:18px">${ticket.subject}</div>
            <div class="cui-page-subtitle">${ticket.ticket_number} · ${ticket.user_name || ticket.user_email}</div>
          </div>
        </div>
      </div>
      <div class="ticket-detail-layout">
        <div class="ticket-chat-panel">
          <div class="ticket-chat-header">
            <h3><i class="fa-solid fa-comments"></i> Cuộc trò chuyện</h3>
            <span class="badge status-${ticket.status}">${statusLabel(ticket.status)}</span>
          </div>
          <div class="ticket-chat-messages" id="ticket-messages">
            <!-- Initial description as first message -->
            ${ticket.description ? `
              <div class="ticket-msg user">
                <div>${ticket.description.replace(/\n/g, '<br>')}</div>
                <div class="ticket-msg-meta">${ticket.user_name || 'Khách'} · ${fmtDate(ticket.created_at)}</div>
              </div>
            ` : ''}
            ${messages.length ? messages.map(m => `
              <div class="ticket-msg ${m.sender_type}">
                <div>${m.message.replace(/\n/g, '<br>')}</div>
                <div class="ticket-msg-meta">${m.sender_name} · ${fmtDate(m.created_at)}</div>
              </div>
            `).join('') : (!ticket.description ? '<div class="ticket-msg-empty">Chưa có tin nhắn</div>' : '')}
          </div>
          ${ticket.status !== 'closed' ? `
            <div class="ticket-reply-bar">
              <textarea id="admin-reply-input" placeholder="Nhập phản hồi cho khách..." rows="1"></textarea>
              <button class="ticket-reply-btn" id="btn-send-reply" title="Gửi"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
          ` : '<div style="padding:12px 16px;text-align:center;color:var(--text-3);font-size:13px;border-top:1px solid var(--border)">Ticket đã đóng</div>'}
        </div>
        <div class="ticket-info-panel">
          <h4><i class="fa-solid fa-circle-info"></i> Thông tin</h4>
          <div class="ticket-info-row"><span class="ticket-info-label">Khách hàng</span><span class="ticket-info-value">${ticket.user_name || '—'}</span></div>
          <div class="ticket-info-row"><span class="ticket-info-label">Email</span><span class="ticket-info-value">${ticket.user_email || '—'}</span></div>
          <div class="ticket-info-row"><span class="ticket-info-label">Danh mục</span><span class="ticket-info-value"><span class="badge">${ticket.category}</span></span></div>
          <div class="ticket-info-row"><span class="ticket-info-label">Ưu tiên</span><span class="ticket-info-value"><span class="badge priority-${ticket.priority}">${priorityLabel(ticket.priority)}</span></span></div>
          <div class="ticket-info-row"><span class="ticket-info-label">Tạo lúc</span><span class="ticket-info-value">${fmtDate(ticket.created_at)}</span></div>
          <div class="ticket-status-form">
            <label class="form-label">Trạng thái</label>
            <select class="form-select" id="ticket-status-select">
              <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Đang mở</option>
              <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>Đang xử lý</option>
              <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Đã giải quyết</option>
              <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>Đã đóng</option>
            </select>
            <button class="btn btn-primary btn-sm btn-full" id="btn-update-status" style="margin-top:8px">Cập nhật</button>
          </div>
        </div>
      </div>
    `;

    // Back button
    qs('#btn-back-tickets').onclick = () => { location.hash = '#/admin/tickets'; };

    // Scroll messages to bottom
    const msgBox = qs('#ticket-messages');
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;

    // Auto-resize textarea
    const textarea = qs('#admin-reply-input');
    if (textarea) {
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      });
      // Send on Enter (Shift+Enter for newline)
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          qs('#btn-send-reply')?.click();
        }
      });
    }

    // Send reply
    const sendBtn = qs('#btn-send-reply');
    if (sendBtn) {
      sendBtn.onclick = async () => {
        const msg = textarea.value.trim();
        if (!msg) return;
        sendBtn.disabled = true;
        try {
          await apiFetch(`/support/tickets/${ticketId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
              sender_name: currentUser?.name || 'Admin',
              sender_type: 'admin',
              message: msg
            })
          });
          // Append message to chat without full reload
          const msgEl = document.createElement('div');
          msgEl.className = 'ticket-msg admin';
          msgEl.innerHTML = `<div>${msg.replace(/\n/g, '<br>')}</div><div class="ticket-msg-meta">Admin · vừa xong</div>`;
          msgBox.appendChild(msgEl);
          msgBox.scrollTop = msgBox.scrollHeight;
          textarea.value = '';
          textarea.style.height = 'auto';
        } catch (err) {
          toast('Lỗi gửi tin nhắn: ' + err.message, 'error');
        }
        sendBtn.disabled = false;
      };
    }

    // Update status
    qs('#btn-update-status').onclick = async () => {
      const status = qs('#ticket-status-select').value;
      try {
        await apiFetch(`/support/tickets/${ticketId}/status?status=${status}`, { method: 'PUT' });
        toast('Đã cập nhật trạng thái', 'success');
        renderAdminTicketDetail(content, ticketId);
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Không tải được ticket</h3><p class="text-muted">${err.message}</p><button class="btn btn-primary mt-12" onclick="location.hash='#/admin/tickets'">Quay lại</button></div>`;
  }
}

function showAdminTicketModal(ticket, onDone) {
  // Legacy — redirect to detail view
  location.hash = `#/admin/tickets?id=${ticket.id}`;
}


// ─── ADMIN BOT CONFIG ─────────────────────────────────────
async function renderAdminBotConfig(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const config = await apiFetch('/admin/bot-config/settings');
    const defaultCommands = [
      { command: '/start', description: 'Chào mừng và hướng dẫn liên kết' },
      { command: '/help', description: 'Xem danh sách lệnh' },
      { command: '/link CODE', description: 'Liên kết tài khoản' },
      { command: '/status', description: 'Xem trạng thái liên kết' },
      { command: '/account', description: 'Xem thông tin tài khoản' },
      { command: '/orders', description: 'Xem đơn hàng gần đây' },
      { command: '/support', description: 'Xem hướng dẫn hỗ trợ' },
      { command: '/unlink', description: 'Gỡ liên kết bot' },
    ];
    const commands = Array.isArray(config.bot_commands) && config.bot_commands.length ? config.bot_commands : defaultCommands;
    content.innerHTML = `
      ${cuiPageHeader('Quản lý bot', 'Cấu hình bot Telegram, bot Discord và email hệ thống')}

      <div class="bot-admin-layout">
        <form id="bot-config-form" class="bot-admin-form-shell">
          <section class="bot-admin-section-card">
            <div class="bot-admin-section-head telegram">
              <div class="bot-admin-section-icon"><i class="fa-brands fa-telegram"></i></div>
              <div>
                <h3>Telegram</h3>
                <p>2 bot riêng cho admin và người dùng.</p>
              </div>
            </div>
            <div class="bot-admin-grid two-col">
              <div class="form-group">
                <label class="form-label">Bot token admin</label>
                <input type="text" class="form-input" id="telegram_token" value="${config.telegram_token || ''}" placeholder="Token bot Telegram cho admin">
                <div class="help-text">Dùng để gửi thông báo nội bộ cho admin.</div>
              </div>
              <div class="form-group">
                <label class="form-label">Bot token người dùng</label>
                <input type="text" class="form-input" id="telegram_user_token" value="${config.telegram_user_token || ''}" placeholder="Token bot Telegram cho người dùng">
                <div class="help-text">Dùng cho bot hỗ trợ người dùng cuối.</div>
              </div>
              <div class="form-group">
                <label class="form-label">Tên bot Telegram</label>
                <input type="text" class="form-input" id="telegram_bot_username" value="${config.telegram_bot_username || ''}" placeholder="MyShopBot">
                <div class="help-text">Dùng để tạo link mở bot Telegram cho người dùng.</div>
              </div>
              <div class="form-group">
                <label class="form-label">Admin chat ID</label>
                <input type="text" class="form-input" id="telegram_admin_id" value="${config.telegram_admin_id || ''}" placeholder="ID admin hoặc group chat">
                <div class="help-text">Nhận thông báo nội bộ cho admin.</div>
              </div>
              <div class="form-group form-group-full">
                <label class="form-label">Tin nhắn chào người dùng</label>
                <textarea class="form-textarea" id="telegram_user_welcome" rows="4" placeholder="Chào mừng bạn đến với bot hỗ trợ...">${config.telegram_user_welcome || ''}</textarea>
                <div class="help-text">Hiển thị khi người dùng bắt đầu dùng bot Telegram.</div>
              </div>
            </div>
          </section>

          <section class="bot-admin-section-card">
            <div class="bot-admin-section-head discord">
              <div class="bot-admin-section-icon"><i class="fa-brands fa-discord"></i></div>
              <div>
                <h3>Discord</h3>
                <p>Bot người dùng qua tin nhắn riêng.</p>
              </div>
            </div>
            <div class="bot-admin-grid two-col">
              <div class="form-group">
                <label class="form-label">Bot token Discord</label>
                <input type="text" class="form-input" id="discord_token" value="${config.discord_token || ''}">
                <div class="help-text">Tạo bot trong Discord Developer Portal.</div>
              </div>
              <div class="form-group">
                <label class="form-label">Link mở bot / server Discord</label>
                <input type="text" class="form-input" id="discord_invite" value="${config.discord_invite || ''}" placeholder="https://discord.gg/... hoặc link invite bot/server">
                <div class="help-text">Dùng để dẫn người dùng tới bot hoặc server Discord.</div>
              </div>
              <div class="form-group form-group-full">
                <label class="form-label">Legacy admin channel ID</label>
                <input type="text" class="form-input" id="discord_admin_id" value="${config.discord_admin_id || ''}" placeholder="Để trống nếu không dùng nữa">
                <div class="help-text">Trường cũ giữ lại để tương thích. Không còn là cấu hình chính cho Discord bot.</div>
              </div>
            </div>
          </section>

          <section class="bot-admin-section-card">
            <div class="bot-admin-section-head smtp">
              <div class="bot-admin-section-icon"><i class="fa-solid fa-envelope"></i></div>
              <div>
                <h3>Email hệ thống</h3>
                <p>Dùng để gửi email đơn hàng, reset mật khẩu và các thông báo tự động.</p>
              </div>
            </div>
            <div class="bot-admin-grid two-col">
              <div class="form-group">
                <label class="form-label">SMTP server</label>
                <input type="text" class="form-input" id="smtp_server" value="${config.smtp_server || ''}" placeholder="smtp.gmail.com">
              </div>
              <div class="form-group">
                <label class="form-label">Cổng SMTP</label>
                <input type="number" class="form-input" id="smtp_port" value="${config.smtp_port || '587'}" placeholder="587">
              </div>
              <div class="form-group">
                <label class="form-label">Tài khoản SMTP</label>
                <input type="text" class="form-input" id="smtp_user" value="${config.smtp_user || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Mật khẩu SMTP</label>
                <input type="password" class="form-input" id="smtp_pass" value="${config.smtp_pass || ''}">
              </div>
              <div class="form-group form-group-full">
                <label class="form-label">Email gửi đi</label>
                <input type="text" class="form-input" id="smtp_from" value="${config.smtp_from || ''}" placeholder="noreply@yourshop.com">
              </div>
            </div>
          </section>

          <section class="bot-admin-section-card">
            <div class="bot-admin-section-head neutral">
              <div class="bot-admin-section-icon"><i class="fa-solid fa-terminal"></i></div>
              <div>
                <h3>Lệnh bot đang hỗ trợ</h3>
                <p>Các lệnh này đang dùng chung cho bot Telegram người dùng và bot Discord.</p>
              </div>
            </div>
            <div class="bot-admin-command-list">
              ${commands.map(item => `
                <div class="bot-admin-command-item">
                  <code>${esc(item.command)}</code>
                  <span>${esc(item.description)}</span>
                </div>
              `).join('')}
            </div>
          </section>

          <div class="bot-admin-savebar">
            <button type="submit" class="btn btn-primary bot-admin-savebtn"><i class="fa-solid fa-floppy-disk"></i> Lưu cấu hình quản lý bot</button>
          </div>
        </form>
      </div>
    `;

    qs('#bot-config-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await apiFetch('/admin/bot-config/settings', {
          method: 'PUT',
          body: JSON.stringify({
            telegram_token: qs('#telegram_token').value,
            telegram_user_token: qs('#telegram_user_token').value,
            telegram_bot_username: qs('#telegram_bot_username').value.replace(/^@/, ''),
            telegram_admin_id: qs('#telegram_admin_id').value,
            telegram_user_welcome: qs('#telegram_user_welcome').value,
            discord_token: qs('#discord_token').value,
            discord_invite: qs('#discord_invite').value,
            discord_admin_id: qs('#discord_admin_id').value,
            smtp_server: qs('#smtp_server').value,
            smtp_port: qs('#smtp_port').value,
            smtp_user: qs('#smtp_user').value,
            smtp_pass: qs('#smtp_pass').value,
            smtp_from: qs('#smtp_from').value
          })
        });
        toast('Đã lưu cấu hình quản lý bot', 'success');
      } catch (err) {
        showError(err.message);
      }
    };
  } catch (err) {
    showError(err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN PAYMENTS (PayOS Config + Payment History)
// ═══════════════════════════════════════════════════════════════

async function renderAdminPayments(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const [config, historyData] = await Promise.all([
    apiFetch('/admin/payment/config').catch(() => ({})),
    apiFetch('/admin/payment/history?limit=50').catch(() => ({ items: [], stats: {} }))
  ]);

  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const st = historyData.stats || {};

  content.innerHTML = `
    ${cuiPageHeader('Thanh toán', 'Kiểm tra giao dịch và cấu hình thanh toán')}

    <!-- Tabs -->
    <div class="settings-tabs" role="tablist">
      <button class="settings-tab active" data-paytab="config" role="tab" aria-selected="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Cấu hình PayOS
      </button>
      <button class="settings-tab" data-paytab="history" role="tab" aria-selected="false">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Lịch sử giao dịch
      </button>
    </div>

    <!-- ═══ Tab: PayOS Config ═══ -->
    <div class="settings-section active" data-paysection="config">
      ${config.has_env_override ? `
        <div class="card cui-alert-warn">
          <div class="fw-600 mb-4"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Cấu hình từ biến môi trường</div>
          <div class="text-sm text-muted">Một số giá trị đang được ghi đè bởi biến môi trường (env vars). Các giá trị đó không thể chỉnh sửa tại đây.</div>
        </div>
      ` : ''}
      <div class="settings-card">
        <div class="settings-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Cấu hình PayOS
        </div>
        <form id="payos-config-form">
          <div class="form-group">
            <label class="form-label" for="payos-client-id">Client ID</label>
            <input class="form-input" id="payos-client-id" type="text" value="${esc(config.payos_client_id)}" placeholder="PayOS Client ID" ${config.has_env_override ? 'disabled' : ''} />
          </div>
          <div class="form-group">
            <label class="form-label" for="payos-api-key">API Key</label>
            <input class="form-input" id="payos-api-key" type="password" value="${esc(config.payos_api_key)}" placeholder="Nhập API Key mới hoặc để trống để giữ nguyên" ${config.has_env_override ? 'disabled' : ''} />
            <div class="form-hint">Giá trị hiện tại: ${esc(config.payos_api_key) || 'chưa cấu hình'}</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="payos-checksum-key">Checksum Key</label>
            <input class="form-input" id="payos-checksum-key" type="password" value="${esc(config.payos_checksum_key)}" placeholder="Nhập Checksum Key mới hoặc để trống để giữ nguyên" ${config.has_env_override ? 'disabled' : ''} />
            <div class="form-hint">Giá trị hiện tại: ${esc(config.payos_checksum_key) || 'chưa cấu hình'}</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="payos-base-url">App Base URL</label>
            <input class="form-input" id="payos-base-url" type="text" value="${esc(config.app_base_url)}" placeholder="https://yourdomain.com" ${config.has_env_override ? 'disabled' : ''} />
            <div class="form-hint">URL gốc của website, dùng để tạo return/cancel URL cho PayOS</div>
          </div>
          <div id="payos-config-err" class="form-error mb-12" style="display:none"></div>
          <button type="submit" class="btn btn-primary" ${config.has_env_override ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Lưu cấu hình
          </button>
        </form>
      </div>
    </div>

    <!-- ═══ Tab: Payment History ═══ -->
    <div class="settings-section" data-paysection="history">
      <!-- Stats row -->
      <div class="stats-grid mb-16">
        <div class="stat-card"><div class="stat-icon green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><div class="stat-info"><div class="stat-label">Doanh thu</div><div class="stat-value">${fmt(st.total_revenue || 0)}</div></div></div>
        <div class="stat-card"><div class="stat-icon yellow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="stat-info"><div class="stat-label">Chờ TT</div><div class="stat-value">${st.pending || 0}</div></div></div>
        <div class="stat-card"><div class="stat-icon blue"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div><div class="stat-info"><div class="stat-label">Đã TT</div><div class="stat-value">${st.paid || 0}</div></div></div>
        <div class="stat-card"><div class="stat-icon purple"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><div class="stat-info"><div class="stat-label">Hoàn thành</div><div class="stat-value">${st.completed || 0}</div></div></div>
      </div>

      <!-- Filter -->
      <div class="filter-pills" id="payment-status-filters">
        ${['', 'pending', 'paid', 'completed', 'cancelled'].map(s => `<button class="filter-pill ${s === '' ? 'active' : ''}" data-pfilter="${s}">${s || 'Tất cả'}</button>`).join('')}
      </div>

      <!-- Table -->
      <div class="table-wrap" id="payment-history-table">
        ${_renderPaymentTable(historyData.items)}
      </div>
    </div>
  `;

  // ── Tab switching ──
  qsa('[data-paytab]', content).forEach(tab => {
    tab.onclick = () => {
      qsa('[data-paytab]', content).forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      qsa('[data-paysection]', content).forEach(s => s.classList.remove('active'));
      qs(`[data-paysection="${tab.dataset.paytab}"]`, content)?.classList.add('active');
    };
  });

  // ── PayOS config form ──
  qs('#payos-config-form', content)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = qs('#payos-config-err', content);
    errEl.style.display = 'none';
    try {
      const payload = {
        payos_client_id: qs('#payos-client-id', content).value,
        payos_api_key: qs('#payos-api-key', content).value,
        payos_checksum_key: qs('#payos-checksum-key', content).value,
        app_base_url: qs('#payos-base-url', content).value,
      };
      await apiFetch('/admin/payment/config', { method: 'POST', body: JSON.stringify(payload) });
      toast('Đã lưu cấu hình PayOS', 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });

  // ── Payment history filter ──
  qsa('[data-pfilter]', content).forEach(btn => {
    btn.onclick = async () => {
      qsa('[data-pfilter]', content).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const status = btn.dataset.pfilter;
      const tableEl = qs('#payment-history-table', content);
      tableEl.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
      try {
        const data = await apiFetch(`/admin/payment/history${status ? '?status=' + status : ''}&limit=50`);
        tableEl.innerHTML = _renderPaymentTable(data.items || []);
      } catch (err) {
        tableEl.innerHTML = `<div class="empty-state"><h3>Lỗi tải dữ liệu</h3></div>`;
      }
    };
  });
}

function _renderPaymentTable(items) {
  if (!items || !items.length) {
    return '<div class="empty-state"><div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div><h3>Chưa có giao dịch nào</h3></div>';
  }
  return `<table>
    <thead><tr><th>Mã đơn</th><th>Khách</th><th>Sản phẩm</th><th>Số tiền</th><th>PTTT</th><th>Trạng thái</th><th>Ngày tạo</th><th>Cập nhật</th></tr></thead>
    <tbody>${items.map(o => `<tr>
      <td class="td-mono">${o.order_code}</td>
      <td class="text-sm">${o.user_email || '—'}</td>
      <td class="text-sm">${o.product_name || '—'}</td>
      <td class="text-primary">${fmt(o.total_amount)}</td>
      <td class="text-sm">${o.payment_method || 'payos'}</td>
      <td>${statusBadge(o.status)}</td>
      <td class="text-sm text-muted">${fmtDate(o.created_at)}</td>
      <td class="text-sm text-muted">${fmtDate(o.updated_at)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// ── ADMIN ANNOUNCEMENTS ──────────────────────────────────────

async function renderAdminAnnouncements(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  let currentItems = [];

  content.onclick = async (e) => {
    const addBtn = e.target.closest('#btn-add-ann');
    if (addBtn) {
      showAnnouncementModal(null, refresh);
      return;
    }

    const editBtn = e.target.closest('[data-edit-ann]');
    if (editBtn) {
      const ann = currentItems.find(a => a.id === parseInt(editBtn.dataset.editAnn));
      if (ann) showAnnouncementModal(ann, refresh);
      return;
    }

    const delBtn = e.target.closest('[data-del-ann]');
    if (delBtn) {
      e.preventDefault();
      if (!confirm('Xóa thông báo này?')) return;
      try {
        await apiFetch(`/announcements/admin/${delBtn.dataset.delAnn}`, { method: 'DELETE' });
        toast('Đã xóa', 'success');
        await refresh();
      }
      catch (e) { toast(e.message, 'error'); }
      return;
    }
  };

  const refresh = async () => {
    const items = await apiFetch('/announcements/admin/all');
    currentItems = items;
    const typeLabels = { info: 'Thông tin', warning: 'Cảnh báo', promo: 'Khuyến mãi', update: 'Cập nhật' };
    const typeBadge = (t) => {
      const colors = { info: 'badge-blue', warning: 'badge-yellow', promo: 'badge-green', update: 'badge-blue' };
      return `<span class="badge ${colors[t] || 'badge-gray'}">${typeLabels[t] || t}</span>`;
    };
    content.innerHTML = `
      ${cuiPageHeader('Thông báo', 'Đăng và quản lý thông báo hệ thống', '<button class="btn btn-primary" id="btn-add-ann"><i class="fa-solid fa-plus"></i> Thêm thông báo</button>')}
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Tiêu đề</th><th>Loại</th><th>Trạng thái</th><th>Thứ tự</th><th>Ngày tạo</th><th></th></tr></thead>
        <tbody>${items.length ? items.map(a => `<tr>
          <td class="text-muted">#${a.id}</td>
          <td class="td-bold">${a.title}</td>
          <td>${typeBadge(a.type)}</td>
          <td>${a.is_active ? '<span class="badge badge-green">Hiện</span>' : '<span class="badge badge-gray">Ẩn</span>'}</td>
          <td>${a.sort_order}</td>
          <td class="text-sm text-muted">${fmtDate(a.created_at)}</td>
          <td><div class="tbl-actions">
            <button class="tbl-btn tbl-edit" data-edit-ann="${a.id}">Sửa</button>
            <button class="tbl-btn tbl-delete" data-del-ann="${a.id}">Xóa</button>
          </div></td>
        </tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted">Chưa có thông báo nào</td></tr>'}</tbody>
      </table></div>
    `;
  };
  await refresh();
}

function showAnnouncementModal(ann, onDone) {
  const isEdit = !!ann;
  openModal(`
    <h3 class="modal-title mb-16">${isEdit ? 'Sửa thông báo' : 'Thêm thông báo'}</h3>
    <form id="ann-form">
      <div class="form-group">
        <label class="form-label">Tiêu đề</label>
        <input type="text" class="form-input" id="ann-title" value="${ann?.title || ''}" required placeholder="Tiêu đề thông báo..." />
      </div>
      <div class="form-group">
        <label class="form-label">Nội dung <span class="text-muted text-sm">(hỗ trợ HTML)</span></label>
        <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;" id="ann-toolbar">
          <button type="button" class="btn btn-ghost btn-sm" data-insert="bold" title="In đậm"><b>B</b></button>
          <button type="button" class="btn btn-ghost btn-sm" data-insert="italic" title="In nghiêng"><i>I</i></button>
          <button type="button" class="btn btn-ghost btn-sm" data-insert="link" title="Chèn link">🔗</button>
          <button type="button" class="btn btn-ghost btn-sm" data-insert="img" title="Chèn ảnh">🖼️</button>
          <button type="button" class="btn btn-ghost btn-sm" data-insert="ul" title="Danh sách">• List</button>
          <button type="button" class="btn btn-ghost btn-sm" data-insert="h3" title="Heading">H3</button>
          <button type="button" class="btn btn-ghost btn-sm" data-insert="quote" title="Trích dẫn">❝</button>
          <button type="button" class="btn btn-ghost btn-sm" data-insert="br" title="Xuống dòng">↵</button>
        </div>
        <textarea class="form-textarea" id="ann-content" rows="8" required placeholder="Nội dung thông báo... Hỗ trợ HTML: <b>, <i>, <a>, <img>, <ul>, <h3>, <blockquote>...">${ann?.content || ''}</textarea>
        <div class="text-sm text-muted" style="margin-top:4px;">Preview:</div>
        <div id="ann-preview" style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;min-height:40px;font-size:13px;line-height:1.6;margin-top:4px;background:var(--bg-page);"></div>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group">
          <label class="form-label">Loại</label>
          <select class="form-select" id="ann-type">
            <option value="info" ${ann?.type === 'info' ? 'selected' : ''}>Thông tin</option>
            <option value="warning" ${ann?.type === 'warning' ? 'selected' : ''}>Cảnh báo</option>
            <option value="promo" ${ann?.type === 'promo' ? 'selected' : ''}>Khuyến mãi</option>
            <option value="update" ${ann?.type === 'update' ? 'selected' : ''}>Cập nhật</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Thứ tự</label>
          <input type="number" class="form-input" id="ann-sort" value="${ann?.sort_order || 0}" min="0" />
        </div>
      </div>
      <div class="form-group">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="ann-active" ${ann ? (ann.is_active ? 'checked' : '') : 'checked'} />
          <span>Hiển thị</span>
        </label>
      </div>
      <div class="flex gap-8">
        <button type="submit" class="btn btn-primary flex-1">Lưu</button>
        <button type="button" class="btn btn-ghost" id="ann-cancel">Hủy</button>
      </div>
    </form>
  `);

  createRichTextEditor({
    textareaId: 'ann-content',
    toolbarId: 'ann-content-toolbar',
    previewId: 'ann-preview',
    placeholder: 'Nhập nội dung thông báo...',
  });

  const ta = qs('#ann-content');
  const preview = qs('#ann-preview');
  const updatePreview = () => { if (window.syncRichTextEditors) window.syncRichTextEditors(); preview.innerHTML = ta.value; };
  ta.oninput = updatePreview;
  updatePreview();

  qs('#ann-cancel').onclick = closeModal;
  qs('#ann-form').onsubmit = async (e) => {
    e.preventDefault();
    if (window.syncRichTextEditors) window.syncRichTextEditors();
    const body = {
      title: qs('#ann-title').value.trim(),
      content: qs('#ann-content').value.trim(),
      type: qs('#ann-type').value,
      sort_order: parseInt(qs('#ann-sort').value) || 0,
      is_active: qs('#ann-active').checked,
    };
    try {
      if (isEdit) {
        await apiFetch(`/announcements/admin/${ann.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/announcements/admin/', { method: 'POST', body: JSON.stringify(body) });
      }
      closeModal();
      toast('Đã lưu', 'success');
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN BALANCE
// ═══════════════════════════════════════════════════════════════

async function renderAdminBalance(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const [usersData, txnData, auditData, withdrawData] = await Promise.all([
      apiFetch('/auth/admin/users'),
      apiFetch('/balance/admin/transactions?limit=30'),
      apiFetch('/balance/admin/audit').catch(() => ({ ok: true, mismatches: [] })),
      apiFetch('/balance/admin/withdrawals?status=pending'),
    ]);
    const pendingCount = withdrawData.total || 0;
    const activeTab = content.dataset.tab || 'users';

    content.innerHTML = `
      ${cuiPageHeader('Quản lý user', 'Quản lý tài khoản, vai trò và số dư người dùng', `
          ${!auditData.ok ? '<span class="badge badge-red">⚠ ' + auditData.mismatches.length + ' bất thường</span>' : '<span class="badge badge-green">✓ Hệ thống OK</span>'}
          <button class="btn btn-primary btn-sm" id="admin-create-user-btn">Thêm user</button>
      `)}

      <div class="settings-tabs" role="tablist">
        <button class="settings-tab ${activeTab === 'users' ? 'active' : ''}" data-tab-btn="users" role="tab" aria-selected="${activeTab === 'users'}">Người dùng</button>
        <button class="settings-tab ${activeTab === 'txn' ? 'active' : ''}" data-tab-btn="txn" role="tab" aria-selected="${activeTab === 'txn'}">Giao dịch</button>
        <button class="settings-tab ${activeTab === 'withdraw' ? 'active' : ''}" data-tab-btn="withdraw" role="tab" aria-selected="${activeTab === 'withdraw'}">
          Yêu cầu rút ${pendingCount > 0 ? `<span class="badge badge-red" style="margin-left:4px">${pendingCount}</span>` : ''}
        </button>
      </div>

      <div id="balance-tab-users" style="${activeTab !== 'users' ? 'display:none' : ''}">
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Email</th><th>Tên</th><th>Role</th><th>Số dư</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            ${usersData.items.map(u => `
              <tr>
                <td>${u.id}</td>
                <td class="text-sm">${u.email}</td>
                <td class="text-sm">${u.display_name || '—'}</td>
                <td class="text-sm">${u.role || 'user'}</td>
                <td class="fw-700 text-success-600">${fmt(u.balance)}</td>
                <td class="text-sm">${u.is_active ? 'Hoạt động' : 'Khóa'}</td>
                <td>
                  <div class="tbl-actions">
                    <button class="tbl-btn tbl-view" data-edit-user='${JSON.stringify(u).replace(/'/g, '&apos;')}'>Sửa</button>
                    <button class="tbl-btn tbl-view" data-adjust-user="${u.id}" data-adjust-email="${u.email}" data-adjust-bal="${u.balance}">Số dư</button>
                    <button class="tbl-btn tbl-view" data-reset-user="${u.id}">Reset MK</button>
                    <button class="tbl-btn tbl-delete" data-delete-user="${u.id}">Xóa</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
      </div>

      <div id="balance-tab-txn" style="${activeTab !== 'txn' ? 'display:none' : ''}">
        <div class="table-wrap"><table>
          <thead><tr><th>Thời gian</th><th>User</th><th>Loại</th><th>Số tiền</th><th>Sau GD</th><th>Mô tả</th></tr></thead>
          <tbody>
            ${txnData.items.map(t => {
              const isPos = t.amount > 0;
              const typeLabels = { topup:'Nạp', purchase:'Mua', affiliate_withdraw:'Rút HH', admin_adjust:'Admin', refund:'Hoàn' };
              return `<tr>
                <td class="text-sm text-muted">${fmtDate(t.created_at)}</td>
                <td class="text-sm">${t.user_email || t.user_id}</td>
                <td><span class="badge">${typeLabels[t.type] || t.type}</span></td>
                <td class="fw-700 ${isPos ? 'text-success-600' : 'text-danger-600'}">${isPos ? '+' : ''}${fmt(t.amount)}</td>
                <td class="text-sm">${fmt(t.balance_after)}</td>
                <td class="text-sm text-muted">${t.description || t.reference || '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>

      <div id="balance-tab-withdraw" style="${activeTab !== 'withdraw' ? 'display:none' : ''}">
        ${pendingCount === 0 ? '<div class="empty-state" style="padding:32px 0;"><p class="text-muted">Không có yêu cầu rút nào đang chờ duyệt</p></div>' : `
        <div class="table-wrap"><table>
          <thead><tr><th>Thời gian</th><th>User</th><th>Số tiền</th><th>Trạng thái</th><th>Mô tả</th><th style="width:140px"></th></tr></thead>
          <tbody>
            ${withdrawData.items.map(w => `
              <tr id="wd-row-${w.id}">
                <td class="text-sm text-muted">${fmtDate(w.created_at)}</td>
                <td class="text-sm">${w.user_email || w.user_name || w.user_id}</td>
                <td class="fw-700 text-warn-600">${fmt(w.amount)}</td>
                <td><span class="badge badge-yellow">Chờ duyệt</span></td>
                <td class="text-sm text-muted">${w.description || '—'}</td>
                <td>
                  <div class="tbl-actions">
                    <button class="tbl-btn tbl-success" data-approve-wd="${w.id}" title="Duyệt">✓ Duyệt</button>
                    <button class="tbl-btn tbl-delete" data-reject-wd="${w.id}" title="Từ chối">✗ Từ chối</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
        `}
      </div>
    `;

    // Create user
    qs('#admin-create-user-btn', content).onclick = () => {
      openModal(`
        <h3 class="modal-title mb-16">Thêm user</h3>
        <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="new-user-email" /></div>
        <div class="form-group"><label class="form-label">Tên hiển thị</label><input type="text" class="form-input" id="new-user-name" /></div>
        <div class="form-group"><label class="form-label">Role</label><select class="form-input" id="new-user-role"><option value="">user</option><option value="staff">staff</option><option value="admin">admin</option></select></div>
        <div id="new-user-err" class="form-error mb-12" style="display:none"></div>
        <button class="btn btn-primary btn-full" id="new-user-submit">Tạo user</button>
      `);
      qs('#new-user-submit').onclick = async () => {
        try {
          await apiFetch('/auth/admin/users', {
            method: 'POST',
            body: JSON.stringify({
              email: qs('#new-user-email').value.trim(),
              display_name: qs('#new-user-name').value.trim(),
              role: qs('#new-user-role').value
            })
          });
          closeModal();
          toast('Đã tạo user', 'success');
          renderAdminBalance(view);
        } catch (err) {
          const elErr = qs('#new-user-err');
          elErr.textContent = err.message;
          elErr.style.display = 'block';
        }
      };
    };

    qsa('[data-edit-user]', content).forEach(btn => {
      btn.onclick = () => {
        const user = JSON.parse(btn.dataset.editUser.replace(/&apos;/g, "'"));
        openModal(`
          <h3 class="modal-title mb-16">Chỉnh sửa user</h3>
          <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="edit-user-email" value="${esc(user.email || '')}" /></div>
          <div class="form-group"><label class="form-label">Tên hiển thị</label><input type="text" class="form-input" id="edit-user-name" value="${esc(user.display_name || '')}" /></div>
          <div class="form-group"><label class="form-label">Avatar URL</label><input type="text" class="form-input" id="edit-user-avatar" value="${esc(user.avatar_url || '')}" /></div>
          <div class="form-group"><label class="form-label">Role</label><select class="form-input" id="edit-user-role"><option value="" ${!user.role ? 'selected' : ''}>user</option><option value="staff" ${user.role === 'staff' ? 'selected' : ''}>staff</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option></select></div>
          <div class="form-group"><label class="form-label"><input type="checkbox" id="edit-user-active" ${user.is_active ? 'checked' : ''} /> Tài khoản hoạt động</label></div>
          <div id="edit-user-err" class="form-error mb-12" style="display:none"></div>
          <button class="btn btn-primary btn-full" id="edit-user-submit">Lưu thay đổi</button>
        `);
        qs('#edit-user-submit').onclick = async () => {
          try {
            await apiFetch(`/auth/admin/users/${user.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                email: qs('#edit-user-email').value.trim(),
                display_name: qs('#edit-user-name').value.trim(),
                avatar_url: qs('#edit-user-avatar').value.trim(),
                role: qs('#edit-user-role').value,
                is_active: qs('#edit-user-active').checked,
              })
            });
            closeModal();
            toast('Đã cập nhật user', 'success');
            renderAdminBalance(view);
          } catch (err) {
            const elErr = qs('#edit-user-err');
            elErr.textContent = err.message;
            elErr.style.display = 'block';
          }
        };
      };
    });

    qsa('[data-reset-user]', content).forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Reset mật khẩu user này và gửi mật khẩu mới qua email?')) return;
        try {
          await apiFetch(`/auth/admin/users/${btn.dataset.resetUser}/reset-password`, { method: 'POST' });
          toast('Đã reset mật khẩu và gửi email', 'success');
        } catch (err) { toast(err.message, 'error'); }
      };
    });

    qsa('[data-delete-user]', content).forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Xóa user này?')) return;
        try {
          await apiFetch(`/auth/admin/users/${btn.dataset.deleteUser}`, { method: 'DELETE' });
          toast('Đã xóa user', 'success');
          renderAdminBalance(view);
        } catch (err) { toast(err.message, 'error'); }
      };
    });

    // Tab switching
    const tabs = ['users', 'txn', 'withdraw'];
    qsa('[data-tab-btn]', content).forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.tabBtn;
        content.dataset.tab = tab;
        tabs.forEach(t => {
          const el = qs(`#balance-tab-${t}`, content);
          if (el) el.style.display = t === tab ? '' : 'none';
        });
        qsa('[data-tab-btn]', content).forEach(b => {
          b.classList.toggle('active', b.dataset.tabBtn === tab);
          b.setAttribute('aria-selected', b.dataset.tabBtn === tab);
        });
      };
    });

    // Approve withdrawal
    qsa('[data-approve-wd]', content).forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Duyệt yêu cầu rút hoa hồng này? Số tiền sẽ được cộng vào số dư người dùng.')) return;
        try {
          btn.disabled = true;
          await apiFetch(`/balance/admin/withdrawals/${btn.dataset.approveWd}/approve`, { method: 'POST' });
          toast('Đã duyệt yêu cầu rút', 'success');
          content.dataset.tab = 'withdraw';
          renderAdminBalance(view);
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      };
    });

    // Reject withdrawal
    qsa('[data-reject-wd]', content).forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Từ chối yêu cầu rút hoa hồng này?')) return;
        try {
          btn.disabled = true;
          await apiFetch(`/balance/admin/withdrawals/${btn.dataset.rejectWd}/reject`, { method: 'POST' });
          toast('Đã từ chối yêu cầu', 'success');
          content.dataset.tab = 'withdraw';
          renderAdminBalance(view);
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      };
    });

    // Adjust balance modal
    qsa('[data-adjust-user]', content).forEach(btn => {
      btn.onclick = () => {
        const userId = btn.dataset.adjustUser;
        const email = btn.dataset.adjustEmail;
        const bal = btn.dataset.adjustBal;
        openModal(`
          <h3 class="modal-title mb-16">Điều chỉnh số dư</h3>
          <div class="text-sm text-muted mb-16">${email} — Hiện tại: <strong style="color:#10b981">${fmt(parseFloat(bal))}</strong></div>
          <div class="form-group">
            <label class="form-label">Số tiền (+ nạp, - trừ)</label>
            <input type="number" class="form-input" id="adj-amount" placeholder="VD: 100000 hoặc -50000" />
          </div>
          <div class="form-group">
            <label class="form-label">Lý do</label>
            <input type="text" class="form-input" id="adj-desc" placeholder="Nạp thưởng, hoàn tiền..." />
          </div>
          <div id="adj-err" class="form-error mb-12" style="display:none"></div>
          <div class="flex gap-8">
            <button class="btn btn-primary flex-1" id="adj-submit">Xác nhận</button>
            <button class="btn btn-ghost" id="adj-cancel">Hủy</button>
          </div>
        `);
        qs('#adj-cancel').onclick = closeModal;
        qs('#adj-submit').onclick = async () => {
          const amount = parseInt(qs('#adj-amount').value);
          if (!amount) { qs('#adj-err').textContent = 'Nhập số tiền'; qs('#adj-err').style.display = 'block'; return; }
          try {
            await apiFetch('/balance/admin/adjust', { method: 'POST', body: JSON.stringify({ user_id: parseInt(userId), amount, description: qs('#adj-desc').value }) });
            closeModal();
            toast('Đã điều chỉnh', 'success');
            renderAdminBalance(view);
          } catch (err) { qs('#adj-err').textContent = err.message; qs('#adj-err').style.display = 'block'; }
        };
      };
    });
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Lỗi tải dữ liệu</h3><p class="text-muted">${err.message}</p></div>`;
  }
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN API KEYS
// ═══════════════════════════════════════════════════════════════
async function renderAdminApiKeys(view) {
  if (!view) return; const content = view;
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const keys = await apiFetch('/api-keys/admin/all');

    content.innerHTML = `
      ${cuiPageHeader('Quản lý API Keys', `${keys.length} key đã tạo`)}
      <div class="table-wrap">
        <table class="table" style="min-width: 800px;">
          <thead><tr>
            <th>User</th><th>Tên key</th><th>Prefix</th><th>Domain</th><th>Callback</th><th>Trạng thái</th><th>Tạo lúc</th><th>Dùng lần cuối</th><th></th>
          </tr></thead>
          <tbody id="admin-apikeys-body">
            ${keys.length ? keys.map(k => `<tr data-kid="${k.id}">
              <td><span style="font-size:12px;">${esc(k.user_email)}</span><br><span class="text-muted" style="font-size:11px;">ID: ${esc(k.user_id)}</span></td>
              <td style="font-weight:600;">${esc(k.name)}</td>
              <td><code style="font-size:12px;">${esc(k.key_prefix)}</code></td>
              <td style="font-size:12px;">${k.allowed_domains.length ? esc(k.allowed_domains.join(', ')) : '<em class="text-muted">Không giới hạn</em>'}</td>
              <td style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${k.callback_url ? esc(k.callback_url) : '—'}</td>
              <td>${k.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Revoked</span>'}</td>
              <td style="font-size:12px;">${k.created_at ? new Date(k.created_at).toLocaleDateString('vi') : '—'}</td>
              <td style="font-size:12px;">${k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('vi') : '—'}</td>
              <td>
                <button class="btn btn-ghost btn-sm" data-toggle-key="${k.id}" style="font-size:12px;">${k.is_active ? 'Tắt' : 'Bật'}</button>
                <button class="btn btn-ghost btn-sm" data-del-key="${k.id}" style="color:var(--danger);font-size:12px;">Xoá</button>
              </td>
            </tr>`).join('') : '<tr><td colspan="9" class="text-center text-muted py-16">Chưa có API key nào</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    // Toggle active
    qsa('[data-toggle-key]', content).forEach(btn => {
      btn.onclick = async () => {
        try {
          await apiFetch('/api-keys/admin/' + btn.dataset.toggleKey + '/toggle', { method: 'PUT' });
          toast('Đã cập nhật', 'success');
          renderAdminApiKeys(view);
        } catch (err) { toast(err.message, 'error'); }
      };
    });

    // Delete
    qsa('[data-del-key]', content).forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Xoá vĩnh viễn key này?')) return;
        try {
          await apiFetch('/api-keys/admin/' + btn.dataset.delKey, { method: 'DELETE' });
          toast('Đã xoá', 'success');
          renderAdminApiKeys(view);
        } catch (err) { toast(err.message, 'error'); }
      };
    });
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Lỗi</h3><p class="text-muted">${err.message}</p></div>`;
  }
}
