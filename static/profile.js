// ═══════════════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════════════

async function renderProfile(view) {
  if (!currentUser) return location.hash = '/login';
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    // Refresh user data
    await fetchMe();
    const u = currentUser;
    view.innerHTML = '';
    view.appendChild(el('div', 'breadcrumb mb-16', `<a href="#/">Trang chủ</a> <span>›</span> <strong>Tài khoản</strong>`));
    view.appendChild(el('div', 'page-header', '<div class="page-title">Tài khoản của tôi</div>'));

    // Profile card
    const profileCard = el('div', 'card profile-card mb-24');
    profileCard.innerHTML = `
      <div class="profile-card-inner">
        <div class="profile-avatar">
          ${u.avatar_url ? `<img src="${u.avatar_url}" alt="" />` : `<div class="profile-avatar-placeholder">${(u.display_name || u.email || 'U').charAt(0).toUpperCase()}</div>`}
        </div>
        <div class="profile-info">
          <div class="profile-name">${u.display_name || u.email?.split('@')[0] || 'User'}</div>
          <div class="profile-email">${u.email || '—'}</div>
          <div class="profile-provider">${u.provider ? `<span class="badge badge-purple">${u.provider}</span>` : '<span class="badge badge-gray">local</span>'}</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="profile-edit-btn">Chỉnh sửa</button>
      </div>
    `;
    view.appendChild(profileCard);

    qs('#profile-edit-btn', view).onclick = () => {
      openModal(`
        <h3 class="modal-title mb-16">Chỉnh sửa hồ sơ</h3>
        <form id="profile-form">
          <div class="form-group"><label class="form-label">Tên hiển thị</label><input type="text" class="form-input" id="pf-name" value="${u.display_name || ''}" /></div>
          <div class="form-group"><label class="form-label">Avatar URL</label><input type="text" class="form-input" id="pf-avatar" value="${u.avatar_url || ''}" placeholder="https://..." /></div>
          <div id="pf-form-err" class="form-error mb-12" style="display:none"></div>
          <div class="flex gap-8"><button type="submit" class="btn btn-primary flex-1">Cập nhật</button><button type="button" class="btn btn-ghost" id="pf-cancel">Hủy</button></div>
        </form>
      `);
      qs('#pf-cancel').onclick = closeModal;
      qs('#profile-form').onsubmit = async (e) => {
        e.preventDefault();
        const body = {
          display_name: qs('#pf-name').value.trim(),
          avatar_url: qs('#pf-avatar').value.trim(),
        };
        try {
          await apiFetch('/auth/me', { method: 'PUT', body: JSON.stringify(body) });
          closeModal(); toast('Đã cập nhật', 'success'); renderProfile(view);
        } catch (err) { const e = qs('#pf-form-err'); e.textContent = err.message; e.style.display = 'block'; }
      };
    };

    // Change password (only for local provider)
    if (!u.provider || u.provider === 'local') {
      const pwCard = el('div', 'card mb-24');
      pwCard.innerHTML = `
        <div class="card-header"><div class="card-title">Đổi mật khẩu</div></div>
        <div style="padding:16px">
          <form id="pw-form">
            <div class="form-group"><label class="form-label">Mật khẩu hiện tại</label><input type="password" class="form-input" id="pw-current" /></div>
            <div class="form-group"><label class="form-label">Mật khẩu mới</label><input type="password" class="form-input" id="pw-new" /></div>
            <div id="pw-form-err" class="form-error mb-12" style="display:none"></div>
            <button type="submit" class="btn btn-primary">Đổi mật khẩu</button>
          </form>
        </div>
      `;
      view.appendChild(pwCard);
      qs('#pw-form', view).onsubmit = async (e) => {
        e.preventDefault();
        const body = {
          current_password: qs('#pw-current').value,
          new_password: qs('#pw-new').value,
        };
        if (!body.current_password || !body.new_password) { toast('Nhập đầy đủ thông tin', 'error'); return; }
        try {
          await apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(body) });
          toast('Đã đổi mật khẩu', 'success');
          qs('#pw-current').value = '';
          qs('#pw-new').value = '';
        } catch (err) { const e = qs('#pw-form-err'); e.textContent = err.message; e.style.display = 'block'; }
      };
    }

    // Order history
    const ordersCard = el('div', 'card');
    ordersCard.innerHTML = `<div class="card-header"><div class="card-title">Lịch sử đơn hàng</div><a href="#/orders" class="btn btn-ghost btn-sm">Xem tất cả</a></div><div id="profile-orders" style="padding:16px"><div class="page-loading"><div class="spinner"></div></div></div>`;
    view.appendChild(ordersCard);

    try {
      const data = await apiFetch('/orders/my');
      const wrap = qs('#profile-orders', view);
      if (!data.items.length) {
        wrap.innerHTML = '<div class="text-center text-muted py-16">Chưa có đơn hàng</div>';
      } else {
        const recent = data.items.slice(0, 5);
        wrap.innerHTML = recent.map(o => `
          <div class="order-card" style="margin-bottom:8px">
            <div class="order-card-top">
              <div><div class="order-code">${o.order_code}</div><div class="order-date">${fmtDate(o.created_at)}</div></div>
              <div class="d-flex align-center gap-8">${statusBadge(o.status)}<a href="#/orders/${o.order_code}" class="btn btn-ghost btn-sm">Chi tiết</a></div>
            </div>
            <div class="text-sm">${o.product_name || ''} — <span class="text-muted">${o.package_name || ''}</span></div>
            <div class="fw-700 text-primary mt-4">${fmt(o.total_amount)}</div>
          </div>
        `).join('');
      }
    } catch (_) { qs('#profile-orders', view).innerHTML = '<div class="text-muted">Không thể tải đơn hàng</div>'; }
  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`;
  }
}

