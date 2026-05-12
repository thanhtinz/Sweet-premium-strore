// ═══════════════════════════════════════════════════════════════
//  SMM PANEL — Storefront Pages
// ═══════════════════════════════════════════════════════════════

function smmStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    pending:        { label: 'Chờ xử lý',   cls: 'badge-yellow' },
    processing:     { label: 'Đang xử lý',  cls: 'badge-blue' },
    in_progress:    { label: 'Đang chạy',   cls: 'badge-blue' },
    completed:      { label: 'Hoàn thành',  cls: 'badge-green' },
    partial:        { label: 'Hoàn một phần', cls: 'badge-orange' },
    canceled:       { label: 'Đã hủy',      cls: 'badge-red' },
    cancelled:      { label: 'Đã hủy',      cls: 'badge-red' },
  };
  const info = map[s] || { label: status || '—', cls: 'badge-gray' };
  return `<span class="badge ${info.cls}">${esc(info.label)}</span>`;
}

function smmRefillBadge(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    pending:    { label: 'Bảo hành: Chờ',   cls: 'badge-yellow' },
    processing: { label: 'Bảo hành: Xử lý', cls: 'badge-blue' },
    completed:  { label: 'Bảo hành: Xong',  cls: 'badge-green' },
    rejected:   { label: 'Bảo hành: Từ chối', cls: 'badge-red' },
    canceled:   { label: 'Bảo hành: Hủy',   cls: 'badge-red' },
  };
  const info = map[s] || { label: `Bảo hành: ${status || '—'}`, cls: 'badge-gray' };
  return `<span class="badge ${info.cls}">${esc(info.label)}</span>`;
}

// ── Page 1: Services Catalog ────────────────────────────────
async function renderSmmServices(view) {
  if (!currentUser) return navigateTo('/login');
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const catalog = await apiFetch('/smm/catalog');
    if (!catalog || !catalog.length) {
      view.innerHTML = `
        <div class="empty-state" style="padding:60px 20px;">
          <div class="empty-state-icon"><i class="fa-solid fa-hashtag"></i></div>
          <h3>Chưa có dịch vụ SMM</h3>
          <p class="text-muted">Hiện chưa có dịch vụ nào khả dụng.</p>
        </div>`;
      return;
    }
    view.innerHTML = '';

    // Header
    view.innerHTML += `
      <div class="card mb-16" style="padding:20px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
          <div style="width:48px;height:48px;background:var(--primary);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;">
            <i class="fa-solid fa-hashtag"></i>
          </div>
          <div>
            <h1 style="margin:0;font-size:22px;color:var(--text-heading);">Dịch vụ SMM</h1>
            <p class="text-muted" style="margin:4px 0 0 0;font-size:14px;">Tìm và chọn dịch vụ phù hợp</p>
          </div>
        </div>
        <div style="position:relative;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--text-muted);"></i>
          <input type="text" id="smm-svc-search" class="form-input" placeholder="Tìm dịch vụ..." style="padding-left:42px;width:100%;border-radius:10px;">
        </div>
      </div>`;

    const listWrap = el('div');
    view.appendChild(listWrap);

    function renderCatalog(filter) {
      listWrap.innerHTML = '';
      const q = (filter || '').toLowerCase().trim();

      catalog.forEach(platform => {
        let hasMatch = false;
        let platformHtml = '';

        platform.categories.forEach(cat => {
          const matched = cat.services.filter(svc =>
            !q || svc.name.toLowerCase().includes(q) || String(svc.id).includes(q)
          );
          if (!matched.length) return;
          hasMatch = true;

          platformHtml += `
            <div style="margin-bottom:16px;">
              <div style="font-weight:600;font-size:14px;color:var(--text-heading);margin-bottom:8px;padding-left:4px;">${esc(cat.name)}</div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style="width:60px;">ID</th>
                      <th>Dịch vụ</th>
                      <th style="width:100px;">Giá/1000</th>
                      <th style="width:70px;">Min</th>
                      <th style="width:70px;">Max</th>
                      <th style="width:70px;">Bảo hành</th>
                      <th style="width:90px;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${matched.map(svc => `
                      <tr>
                        <td class="text-muted text-sm">${svc.id}</td>
                        <td style="font-weight:500;">${esc(svc.name)}</td>
                        <td style="font-weight:600;color:var(--primary);">${fmt(svc.rate)}</td>
                        <td class="text-sm">${svc.min_quantity}</td>
                        <td class="text-sm">${svc.max_quantity}</td>
                        <td>${svc.can_refill ? '<span class="badge badge-green">✓</span>' : '<span class="text-muted">—</span>'}</td>
                        <td><button class="btn btn-primary btn-sm" style="border-radius:8px;width:100%;" onclick="navigateTo('/smm/order?service=${svc.id}')">Đặt đơn</button></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        });

        if (!hasMatch) return;

        const card = el('div', 'info-card mb-16');
        const iconHtml = platform.icon_url
          ? `<img src="${platform.icon_url}" alt="" style="width:24px;height:24px;object-fit:contain;border-radius:4px;" />`
          : '<i class="fa-solid fa-hashtag" style="font-size:20px;color:var(--primary);"></i>';
        card.innerHTML = `
          <div class="info-card-head" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:16px 20px;">
            ${iconHtml}
            <span style="font-weight:700;font-size:16px;color:var(--text-heading);flex:1;">${esc(platform.name)}</span>
            <i class="fa-solid fa-chevron-down" style="color:var(--text-muted);font-size:12px;transition:transform 0.2s;"></i>
          </div>
          <div class="info-card-body" style="padding:0 20px 20px;">${platformHtml}</div>`;

        // Collapsible toggle
        const head = card.querySelector('.info-card-head');
        const body = card.querySelector('.info-card-body');
        const chevron = head.querySelector('.fa-chevron-down');
        head.addEventListener('click', () => {
          const open = body.style.display !== 'none';
          body.style.display = open ? 'none' : 'block';
          if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
        });

        listWrap.appendChild(card);
      });

      if (!listWrap.children.length) {
        listWrap.innerHTML = `
          <div class="empty-state" style="padding:40px 20px;">
            <div class="empty-state-icon"><i class="fa-solid fa-search"></i></div>
            <h3>Không tìm thấy dịch vụ</h3>
            <p class="text-muted">Thử từ khóa khác.</p>
          </div>`;
      }
    }

    renderCatalog('');

    const searchInput = qs('#smm-svc-search');
    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderCatalog(searchInput.value), 250);
    });

  } catch (err) {
    view.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;">
        <div class="empty-state-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
        <h3>Lỗi tải dịch vụ</h3>
        <p class="text-muted">${esc(err.message || 'Không thể kết nối máy chủ.')}</p>
      </div>`;
  }
}

// ── Page 2: Place Order ─────────────────────────────────────
async function renderSmmOrder(view) {
  if (!currentUser) return navigateTo('/login');
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const catalog = await apiFetch('/smm/catalog');
    if (!catalog || !catalog.length) {
      view.innerHTML = `
        <div class="empty-state" style="padding:60px 20px;">
          <div class="empty-state-icon"><i class="fa-solid fa-hashtag"></i></div>
          <h3>Chưa có dịch vụ SMM</h3>
          <p class="text-muted">Hiện chưa có dịch vụ nào để đặt đơn.</p>
        </div>`;
      return;
    }

    const urlParams = new URLSearchParams(location.search || '');
    const preselectedServiceId = urlParams.get('service');

    // Flatten services for lookup
    const allServices = [];
    catalog.forEach(p => p.categories.forEach(c => c.services.forEach(s => {
      allServices.push({ ...s, platform_name: p.name, category_name: c.name, platform_id: p.id, category_id: c.id });
    })));

    view.innerHTML = '';

    // Header
    view.innerHTML += `
      <div style="margin-bottom:16px;">
        <button onclick="navigateTo('/smm/services')" class="btn btn-outline" style="background:#fff;border-radius:12px;padding:10px 20px;font-weight:600;border-color:var(--border);color:var(--text-heading);"><i class="fa-solid fa-arrow-left"></i> Danh sách dịch vụ</button>
      </div>
      <div class="card mb-16" style="padding:20px;">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="width:48px;height:48px;background:var(--primary);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;">
            <i class="fa-solid fa-cart-plus"></i>
          </div>
          <div>
            <h1 style="margin:0;font-size:22px;color:var(--text-heading);">Đặt đơn SMM</h1>
            <p class="text-muted" style="margin:4px 0 0 0;font-size:14px;">Chọn dịch vụ và nhập thông tin</p>
          </div>
        </div>
      </div>`;

    const formCard = el('div', 'card mb-16');
    formCard.style.padding = '24px';
    formCard.innerHTML = `
      <div class="form-group mb-16">
        <label class="form-label">Nền tảng</label>
        <select id="smm-platform" class="form-select" style="border-radius:10px;">
          <option value="">— Chọn nền tảng —</option>
          ${catalog.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group mb-16">
        <label class="form-label">Danh mục</label>
        <select id="smm-category" class="form-select" style="border-radius:10px;" disabled>
          <option value="">— Chọn danh mục —</option>
        </select>
      </div>
      <div class="form-group mb-16">
        <label class="form-label">Dịch vụ</label>
        <select id="smm-service" class="form-select" style="border-radius:10px;" disabled>
          <option value="">— Chọn dịch vụ —</option>
        </select>
      </div>
      <div id="smm-service-info" style="display:none;margin-bottom:16px;padding:12px 16px;background:var(--bg-page);border-radius:10px;border:1px solid var(--border);"></div>
      <div class="form-group mb-16">
        <label class="form-label">Link</label>
        <input type="text" id="smm-link" class="form-input" placeholder="https://..." style="border-radius:10px;">
      </div>
      <div class="form-group mb-16">
        <label class="form-label">Số lượng</label>
        <input type="number" id="smm-quantity" class="form-input" placeholder="Nhập số lượng" style="border-radius:10px;" min="1">
        <div id="smm-qty-hint" class="text-sm text-muted" style="margin-top:4px;"></div>
      </div>
      <div id="smm-price-preview" style="display:none;padding:16px;background:var(--bg-page);border-radius:10px;border:1px solid var(--border);margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="fw-600">Thành tiền:</span>
          <span id="smm-price-value" style="font-size:20px;font-weight:700;color:var(--primary);"></span>
        </div>
      </div>
      <button id="smm-submit-btn" class="btn btn-primary" style="width:100%;border-radius:12px;padding:14px;font-weight:700;font-size:16px;" disabled>Đặt đơn</button>
    `;
    view.appendChild(formCard);

    const resultWrap = el('div');
    view.appendChild(resultWrap);

    // Cascading dropdown logic
    const platformSel = qs('#smm-platform', formCard);
    const categorySel = qs('#smm-category', formCard);
    const serviceSel  = qs('#smm-service', formCard);
    const serviceInfo = qs('#smm-service-info', formCard);
    const linkInput   = qs('#smm-link', formCard);
    const qtyInput    = qs('#smm-quantity', formCard);
    const qtyHint     = qs('#smm-qty-hint', formCard);
    const pricePreview = qs('#smm-price-preview', formCard);
    const priceValue  = qs('#smm-price-value', formCard);
    const submitBtn   = qs('#smm-submit-btn', formCard);

    let selectedService = null;

    function updatePrice() {
      if (!selectedService) { pricePreview.style.display = 'none'; return; }
      const qty = parseInt(qtyInput.value) || 0;
      if (qty <= 0) { pricePreview.style.display = 'none'; return; }
      const cost = selectedService.rate * qty / 1000;
      priceValue.textContent = fmt(cost);
      pricePreview.style.display = 'block';
    }

    function validateForm() {
      const ok = selectedService && linkInput.value.trim() && parseInt(qtyInput.value) >= (selectedService.min_quantity || 1);
      submitBtn.disabled = !ok;
    }

    platformSel.addEventListener('change', () => {
      const pid = parseInt(platformSel.value);
      const platform = catalog.find(p => p.id === pid);
      categorySel.innerHTML = '<option value="">— Chọn danh mục —</option>';
      serviceSel.innerHTML = '<option value="">— Chọn dịch vụ —</option>';
      serviceInfo.style.display = 'none';
      selectedService = null;
      pricePreview.style.display = 'none';
      if (!platform) { categorySel.disabled = true; serviceSel.disabled = true; validateForm(); return; }
      categorySel.disabled = false;
      platform.categories.forEach(c => {
        categorySel.innerHTML += `<option value="${c.id}">${esc(c.name)}</option>`;
      });
      validateForm();
    });

    categorySel.addEventListener('change', () => {
      const pid = parseInt(platformSel.value);
      const cid = parseInt(categorySel.value);
      const platform = catalog.find(p => p.id === pid);
      serviceSel.innerHTML = '<option value="">— Chọn dịch vụ —</option>';
      serviceInfo.style.display = 'none';
      selectedService = null;
      pricePreview.style.display = 'none';
      if (!platform) { serviceSel.disabled = true; validateForm(); return; }
      const cat = platform.categories.find(c => c.id === cid);
      if (!cat) { serviceSel.disabled = true; validateForm(); return; }
      serviceSel.disabled = false;
      cat.services.forEach(s => {
        serviceSel.innerHTML += `<option value="${s.id}">${esc(s.name)} (${fmt(s.rate)}/1000)</option>`;
      });
      validateForm();
    });

    serviceSel.addEventListener('change', () => {
      const sid = parseInt(serviceSel.value);
      selectedService = allServices.find(s => s.id === sid) || null;
      if (selectedService) {
        serviceInfo.style.display = 'block';
        serviceInfo.innerHTML = `
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px;">
            <span><strong>ID:</strong> ${selectedService.id}</span>
            <span><strong>Giá/1000:</strong> <span style="color:var(--primary);font-weight:600;">${fmt(selectedService.rate)}</span></span>
            <span><strong>Min:</strong> ${selectedService.min_quantity}</span>
            <span><strong>Max:</strong> ${selectedService.max_quantity}</span>
            ${selectedService.can_refill ? '<span class="badge badge-green">Bảo hành</span>' : ''}
          </div>
          ${selectedService.description ? `<div class="text-muted text-sm" style="margin-top:8px;">${esc(selectedService.description)}</div>` : ''}`;
        qtyInput.min = selectedService.min_quantity;
        qtyInput.max = selectedService.max_quantity;
        qtyHint.textContent = `Tối thiểu: ${selectedService.min_quantity} — Tối đa: ${selectedService.max_quantity}`;
      } else {
        serviceInfo.style.display = 'none';
        qtyHint.textContent = '';
      }
      updatePrice();
      validateForm();
    });

    qtyInput.addEventListener('input', () => { updatePrice(); validateForm(); });
    linkInput.addEventListener('input', validateForm);

    // Pre-select service if ?service=ID
    if (preselectedServiceId) {
      const svc = allServices.find(s => String(s.id) === String(preselectedServiceId));
      if (svc) {
        platformSel.value = svc.platform_id;
        platformSel.dispatchEvent(new Event('change'));
        // Need a small delay for cascading dropdowns to populate
        setTimeout(() => {
          categorySel.value = svc.category_id;
          categorySel.dispatchEvent(new Event('change'));
          setTimeout(() => {
            serviceSel.value = svc.id;
            serviceSel.dispatchEvent(new Event('change'));
          }, 0);
        }, 0);
      }
    }

    // Submit
    submitBtn.addEventListener('click', async () => {
      if (!selectedService || !linkInput.value.trim()) return;
      const qty = parseInt(qtyInput.value);
      if (qty < (selectedService.min_quantity || 1)) {
        toast(`Số lượng tối thiểu: ${selectedService.min_quantity}`, 'error');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang đặt đơn...';
      resultWrap.innerHTML = '';

      try {
        const result = await apiFetch('/smm/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: selectedService.id,
            link: linkInput.value.trim(),
            quantity: qty
          })
        });

        resultWrap.innerHTML = `
          <div class="card" style="padding:24px;border-top:4px solid #10b981;">
            <div style="text-align:center;margin-bottom:16px;">
              <div style="width:56px;height:56px;background:#ecfdf5;color:#10b981;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;">
                <i class="fa-solid fa-check"></i>
              </div>
              <h2 style="margin:0;font-size:20px;color:var(--text-heading);">Đặt đơn thành công!</h2>
            </div>
            <div style="background:var(--bg-page);border-radius:10px;padding:16px;margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span class="text-muted">Mã đơn:</span>
                <span class="fw-600">${esc(result.order_code || result.id)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span class="text-muted">Trạng thái:</span>
                ${smmStatusBadge(result.status)}
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span class="text-muted">Phí:</span>
                <span class="fw-600" style="color:var(--primary);">${fmt(result.charge)}</span>
              </div>
            </div>
            <div style="display:flex;gap:12px;">
              <button class="btn btn-primary" style="flex:1;border-radius:10px;" onclick="navigateTo('/smm/history')">Xem lịch sử</button>
              <button class="btn btn-outline" style="flex:1;border-radius:10px;" onclick="navigateTo('/smm/order')">Đặt đơn mới</button>
            </div>
          </div>`;
      } catch (err) {
        toast(err.message || 'Đặt đơn thất bại', 'error');
        resultWrap.innerHTML = `
          <div class="card" style="padding:24px;border-top:4px solid #ef4444;">
            <div style="text-align:center;">
              <div style="width:56px;height:56px;background:#fee2e2;color:#ef4444;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;">
                <i class="fa-solid fa-xmark"></i>
              </div>
              <h3 style="color:var(--text-heading);">Đặt đơn thất bại</h3>
              <p class="text-muted">${esc(err.message || 'Vui lòng thử lại.')}</p>
            </div>
          </div>`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đặt đơn';
        validateForm();
      }
    });

  } catch (err) {
    view.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;">
        <div class="empty-state-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
        <h3>Lỗi tải dịch vụ</h3>
        <p class="text-muted">${esc(err.message || 'Không thể kết nối máy chủ.')}</p>
      </div>`;
  }
}

// ── Page 3: Order History ───────────────────────────────────
async function renderSmmHistory(view) {
  if (!currentUser) return navigateTo('/login');
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  const urlParams = new URLSearchParams(location.search || '');
  let currentPage = parseInt(urlParams.get('page')) || 1;

  try {
    await renderSmmHistoryPage(view, currentPage);
  } catch (err) {
    view.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;">
        <div class="empty-state-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
        <h3>Lỗi tải đơn hàng</h3>
        <p class="text-muted">${esc(err.message || 'Không thể kết nối máy chủ.')}</p>
      </div>`;
  }
}

async function renderSmmHistoryPage(view, page) {
  const limit = 20;
  const data = await apiFetch(`/smm/orders?page=${page}&limit=${limit}`);

  view.innerHTML = '';

  // Header
  view.innerHTML += `
    <div class="card mb-16" style="padding:20px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:48px;height:48px;background:var(--primary);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;">
          <i class="fa-solid fa-clock-rotate-left"></i>
        </div>
        <div>
          <h1 style="margin:0;font-size:22px;color:var(--text-heading);">Lịch sử đơn SMM</h1>
          <p class="text-muted" style="margin:4px 0 0 0;font-size:14px;">Tổng cộng ${data.total || 0} đơn hàng</p>
        </div>
      </div>
    </div>`;

  if (!data.orders || !data.orders.length) {
    view.innerHTML += `
      <div class="empty-state" style="padding:60px 20px;">
        <div class="empty-state-icon"><i class="fa-solid fa-inbox"></i></div>
        <h3>Chưa có đơn hàng</h3>
        <p class="text-muted">Bạn chưa đặt đơn SMM nào.</p>
        <button class="btn btn-primary" style="margin-top:12px;border-radius:10px;" onclick="navigateTo('/smm/order')">Đặt đơn ngay</button>
      </div>`;
    return;
  }

  const tableWrap = el('div', 'card mb-16');
  tableWrap.style.overflow = 'hidden';
  tableWrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Dịch vụ</th>
            <th>Link</th>
            <th>SL</th>
            <th>Phí</th>
            <th>Trạng thái</th>
            <th>Ngày</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${data.orders.map(o => {
            const linkShort = o.link && o.link.length > 40 ? o.link.substring(0, 40) + '…' : (o.link || '—');
            const actionHtml = (o.can_refill && o.status === 'completed' && !o.refill_id)
              ? `<button class="btn btn-outline btn-sm" style="border-radius:8px;white-space:nowrap;" onclick="navigateTo('/smm/refill?code=${encodeURIComponent(o.order_code || o.id)}')">Bảo hành</button>`
              : o.refill_id ? smmRefillBadge(o.refill_status) : '';
            return `
              <tr>
                <td class="fw-600" style="white-space:nowrap;">${esc(o.order_code || o.id)}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(o.service_name)}">${esc(o.service_name)}</td>
                <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(o.link)}">${esc(linkShort)}</td>
                <td>${o.quantity}</td>
                <td style="font-weight:600;color:var(--primary);">${fmt(o.charge)}</td>
                <td>${smmStatusBadge(o.status)}</td>
                <td class="text-sm text-muted" style="white-space:nowrap;">${fmtDate(o.created_at)}</td>
                <td style="white-space:nowrap;">${actionHtml}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  view.appendChild(tableWrap);

  // Pagination
  const totalPages = Math.ceil((data.total || 0) / limit);
  if (totalPages > 1) {
    const pagWrap = el('div', 'flex gap-8');
    pagWrap.style.justifyContent = 'center';
    pagWrap.style.marginTop = '16px';

    for (let p = 1; p <= totalPages; p++) {
      const btn = el('button', p === page ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm');
      btn.style.borderRadius = '8px';
      btn.style.minWidth = '36px';
      btn.textContent = p;
      btn.addEventListener('click', () => {
        navigateTo(`/smm/history?page=${p}`);
      });
      pagWrap.appendChild(btn);
    }
    view.appendChild(pagWrap);
  }
}

// ── Page 4: Refill / Warranty ───────────────────────────────
async function renderSmmRefill(view) {
  if (!currentUser) return navigateTo('/login');
  view.innerHTML = '';

  const urlParams = new URLSearchParams(location.search || '');
  const preCode = urlParams.get('code') || '';

  // Header
  view.innerHTML += `
    <div class="card mb-16" style="padding:20px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:48px;height:48px;background:var(--primary);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <div>
          <h1 style="margin:0;font-size:22px;color:var(--text-heading);">Bảo hành SMM</h1>
          <p class="text-muted" style="margin:4px 0 0 0;font-size:14px;">Yêu cầu bảo hành cho đơn hàng đã hoàn thành</p>
        </div>
      </div>
    </div>`;

  // Search form
  const searchCard = el('div', 'card mb-16');
  searchCard.style.padding = '24px';
  searchCard.innerHTML = `
    <div class="form-group mb-16">
      <label class="form-label">Mã đơn hàng</label>
      <div style="display:flex;gap:12px;">
        <input type="text" id="smm-refill-code" class="form-input" placeholder="Nhập mã đơn hàng..." style="border-radius:10px;flex:1;" value="${esc(preCode)}">
        <button id="smm-refill-lookup" class="btn btn-primary" style="border-radius:10px;padding:0 24px;white-space:nowrap;">Kiểm tra</button>
      </div>
    </div>`;
  view.appendChild(searchCard);

  const resultWrap = el('div');
  view.appendChild(resultWrap);

  const codeInput = qs('#smm-refill-code', searchCard);
  const lookupBtn = qs('#smm-refill-lookup', searchCard);

  async function doLookup() {
    const code = codeInput.value.trim();
    if (!code) { toast('Vui lòng nhập mã đơn hàng', 'error'); return; }

    resultWrap.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    try {
      // Fetch user's orders to find the one matching the code
      const data = await apiFetch('/smm/orders?page=1&limit=100');
      const order = (data.orders || []).find(o =>
        String(o.order_code) === code || String(o.id) === code
      );

      if (!order) {
        resultWrap.innerHTML = `
          <div class="card" style="padding:24px;text-align:center;">
            <div style="width:56px;height:56px;background:#fee2e2;color:#ef4444;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;">
              <i class="fa-solid fa-xmark"></i>
            </div>
            <h3 style="color:var(--text-heading);">Không tìm thấy đơn hàng</h3>
            <p class="text-muted">Mã đơn hàng không hợp lệ hoặc không thuộc tài khoản của bạn.</p>
          </div>`;
        return;
      }

      // Show order details
      let detailHtml = `
        <div class="card" style="padding:24px;">
          <div style="background:var(--bg-page);border-radius:10px;padding:16px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span class="text-muted">Mã đơn:</span>
              <span class="fw-600">${esc(order.order_code || order.id)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span class="text-muted">Dịch vụ:</span>
              <span class="fw-600">${esc(order.service_name)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span class="text-muted">Link:</span>
              <span style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(order.link)}">${esc(order.link || '—')}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span class="text-muted">Số lượng:</span>
              <span>${order.quantity}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span class="text-muted">Phí:</span>
              <span style="font-weight:600;color:var(--primary);">${fmt(order.charge)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span class="text-muted">Trạng thái:</span>
              ${smmStatusBadge(order.status)}
            </div>
          </div>`;

      // Eligibility check
      if (order.status !== 'completed') {
        detailHtml += `
          <div style="text-align:center;padding:12px;background:#fef3c7;border-radius:10px;color:#92400e;">
            <i class="fa-solid fa-triangle-exclamation"></i> Chỉ có thể yêu cầu bảo hành cho đơn hàng đã hoàn thành.
          </div>`;
      } else if (!order.can_refill) {
        detailHtml += `
          <div style="text-align:center;padding:12px;background:#fef3c7;border-radius:10px;color:#92400e;">
            <i class="fa-solid fa-triangle-exclamation"></i> Dịch vụ này không hỗ trợ bảo hành.
          </div>`;
      } else if (order.refill_id) {
        // Already has a refill request
        detailHtml += `
          <div style="background:#eff6ff;border-radius:10px;padding:16px;margin-bottom:16px;">
            <div style="font-weight:600;margin-bottom:8px;color:var(--text-heading);">Yêu cầu bảo hành đã tồn tại</div>
            <div style="margin-bottom:8px;">${smmRefillBadge(order.refill_status)}</div>
            <button id="smm-check-refill" class="btn btn-outline btn-sm" style="border-radius:8px;" data-order-id="${order.id}">Kiểm tra lại</button>
          </div>`;
      } else {
        // Can request refill
        detailHtml += `
          <div style="text-align:center;">
            <div style="margin-bottom:12px;padding:12px;background:#ecfdf5;border-radius:10px;color:#065f46;">
              <i class="fa-solid fa-shield-halved"></i> Đơn hàng đủ điều kiện bảo hành
            </div>
            <button id="smm-request-refill" class="btn btn-primary" style="border-radius:10px;padding:12px 32px;font-weight:600;" data-order-id="${order.id}">Yêu cầu bảo hành</button>
          </div>`;
      }

      detailHtml += '</div>';
      resultWrap.innerHTML = detailHtml;

      // Bind refill request button
      const requestBtn = qs('#smm-request-refill', resultWrap);
      if (requestBtn) {
        requestBtn.addEventListener('click', async () => {
          requestBtn.disabled = true;
          requestBtn.textContent = 'Đang gửi...';
          try {
            const res = await apiFetch(`/smm/orders/${order.id}/refill`, { method: 'POST' });
            toast('Yêu cầu bảo hành đã được gửi!', 'success');
            // Re-lookup to refresh state
            doLookup();
          } catch (err) {
            toast(err.message || 'Gửi yêu cầu thất bại', 'error');
            requestBtn.disabled = false;
            requestBtn.textContent = 'Yêu cầu bảo hành';
          }
        });
      }

      // Bind check refill status button
      const checkBtn = qs('#smm-check-refill', resultWrap);
      if (checkBtn) {
        checkBtn.addEventListener('click', async () => {
          checkBtn.disabled = true;
          checkBtn.textContent = 'Đang kiểm tra...';
          try {
            const res = await apiFetch(`/smm/orders/${order.id}/refill-status`);
            toast(`Trạng thái bảo hành: ${res.refill_status || 'đang xử lý'}`, 'info');
            // Re-lookup to refresh
            doLookup();
          } catch (err) {
            toast(err.message || 'Kiểm tra thất bại', 'error');
            checkBtn.disabled = false;
            checkBtn.textContent = 'Kiểm tra lại';
          }
        });
      }

    } catch (err) {
      resultWrap.innerHTML = `
        <div class="card" style="padding:24px;text-align:center;">
          <div style="width:56px;height:56px;background:#fee2e2;color:#ef4444;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;">
            <i class="fa-solid fa-circle-exclamation"></i>
          </div>
          <h3 style="color:var(--text-heading);">Lỗi</h3>
          <p class="text-muted">${esc(err.message || 'Không thể kiểm tra đơn hàng.')}</p>
        </div>`;
    }
  }

  lookupBtn.addEventListener('click', doLookup);
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLookup(); });

  // Auto-lookup if code provided in URL
  if (preCode) doLookup();
}
