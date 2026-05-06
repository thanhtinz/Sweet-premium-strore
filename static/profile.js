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
    
    const heroHead = el('div', 'products-hero');
    heroHead.innerHTML = `
      <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <strong>Tài khoản</strong></div>
      <h1 class="products-hero-title"><i class="fa-solid fa-user-circle"></i> Tài khoản của tôi</h1>
      <p class="products-hero-desc">Quản lý thông tin cá nhân và cài đặt bảo mật</p>
    `;
    view.appendChild(heroHead);

    // Profile card
    const profileCard = el('div', 'info-card');
    profileCard.innerHTML = `
      <div class="info-card-head"><div class="info-card-title"><i class="fa-solid fa-address-card"></i> Thông tin hồ sơ</div></div>
      <div class="info-card-body">
        <div class="profile-card-inner" style="background: none; border: none; padding: 0;">
          <div class="profile-avatar">
            ${u.avatar_url ? `<img src="${u.avatar_url}" alt="" />` : `<div class="profile-avatar-placeholder">${(u.display_name || u.email || 'U').charAt(0).toUpperCase()}</div>`}
          </div>
          <div class="profile-info">
            <div class="profile-name">${u.display_name || u.email?.split('@')[0] || 'User'}</div>
            <div class="profile-email">${u.email || '—'}</div>
            <div class="profile-provider">${u.provider ? `<span class="badge badge-blue">${u.provider}</span>` : '<span class="badge badge-gray">Tài khoản cửa hàng</span>'}</div>
          </div>
          <button class="btn btn-outline btn-sm" id="profile-edit-btn"><i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa</button>
        </div>
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

    // Security Settings
    const securityCard = el('div', 'info-card');
    let pwFormHtml = '';
    
    if (!u.provider || u.provider === 'local') {
      pwFormHtml = `
        <form id="pw-form" class="mb-24">
          <h4 class="fw-600 mb-12">Đổi mật khẩu</h4>
          <div class="form-row form-row-2">
            <div class="form-group"><label class="form-label">Mật khẩu hiện tại</label><input type="password" class="form-input" id="pw-current" placeholder="Nhập mật khẩu hiện tại" /></div>
            <div class="form-group"><label class="form-label">Mật khẩu mới</label><input type="password" class="form-input" id="pw-new" placeholder="Nhập mật khẩu mới" /></div>
          </div>
          <div id="pw-form-err" class="form-error mb-12" style="display:none"></div>
          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-key"></i> Đổi mật khẩu</button>
        </form>
        <div class="divider mb-24"></div>
      `;
    }

    securityCard.innerHTML = `
      <div class="info-card-head"><div class="info-card-title"><i class="fa-solid fa-shield-halved"></i> Bảo mật tài khoản</div></div>
      <div class="info-card-body">
        ${pwFormHtml}
        
        
        <h4 class="fw-600 mb-12">Xác thực 2 bước (2FA)</h4>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-page); margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: ${u['2fa_enabled'] ? 'var(--primary-light)' : 'var(--bg-card)'}; color: ${u['2fa_enabled'] ? 'var(--primary)' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: var(--shadow-sm);">
              <i class="fa-solid fa-mobile-screen-button"></i>
            </div>
            <div>
              <div class="fw-600">Bảo mật bằng ứng dụng Authenticator</div>
              <div class="text-sm ${u['2fa_enabled'] ? 'text-primary fw-600' : 'text-muted'}">${u['2fa_enabled'] ? 'Đang bật' : 'Đang tắt'}</div>
            </div>
          </div>
          <button class="btn ${u['2fa_enabled'] ? 'btn-outline text-red' : 'btn-outline text-primary'}" id="btn-2fa-toggle" style="border-color: ${u['2fa_enabled'] ? 'var(--red-bg)' : 'var(--primary-light)'};">
            ${u['2fa_enabled'] ? 'Tắt 2FA' : 'Cài đặt'}
          </button>
        </div>
        
        <h4 class="fw-600 mb-12">Quản lý phiên đăng nhập</h4>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-page);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--green-bg); color: var(--green); display: flex; align-items: center; justify-content: center; font-size: 20px;">
              <i class="fa-solid fa-desktop"></i>
            </div>
            <div>
              <div class="fw-600">Thiết bị hiện tại</div>
              <div class="text-sm text-muted">Đang hoạt động trên trình duyệt này</div>
            </div>
          </div>
          <button class="btn btn-outline text-red" style="border-color: var(--red-bg);" id="profile-logout-btn"><i class="fa-solid fa-arrow-right-from-bracket"></i> Đăng xuất</button>
        </div>
      </div>
    `;
    view.appendChild(securityCard);

    if (!u.provider || u.provider === 'local') {
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
    
    qs('#btn-2fa-toggle', view).onclick = async () => {
      if (u['2fa_enabled']) {
        if (!confirm('Bạn có chắc chắn muốn tắt xác thực 2 bước?')) return;
        try {
          await apiFetch('/auth/2fa/disable', { method: 'POST' });
          toast('Đã tắt xác thực 2 bước', 'success');
          renderProfile(view);
        } catch (e) { toast(e.message, 'error'); }
      } else {
        try {
          const data = await apiFetch('/auth/2fa/setup');
          openModal(`
            <h3 class="modal-title mb-16">Cài đặt xác thực 2 bước</h3>
            <div style="text-align: center; margin-bottom: 24px;">
              <p class="mb-12">Quét mã QR dưới đây bằng Google Authenticator hoặc Authy</p>
              <img src="${data.qr_code}" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid var(--border); border-radius: 8px; margin: 0 auto;" />
              <p class="text-sm text-muted mt-12" style="font-family: monospace; letter-spacing: 2px; padding: 8px; background: var(--bg-page); border-radius: 4px; user-select: all;">${data.secret}</p>
            </div>
            <form id="2fa-verify-form">
              <div class="form-group">
                <label class="form-label">Nhập mã xác thực gồm 6 chữ số</label>
                <input type="text" class="form-input" id="totp-code" placeholder="123456" maxlength="6" style="font-size: 20px; letter-spacing: 4px; text-align: center;" />
              </div>
              <div id="2fa-err" class="form-error mb-12" style="display:none"></div>
              <button type="submit" class="btn btn-primary btn-full"><i class="fa-solid fa-check"></i> Xác nhận</button>
            </form>
          `);
          
          qs('#2fa-verify-form').onsubmit = async (e) => {
            e.preventDefault();
            const code = qs('#totp-code').value.trim();
            if (!code || code.length !== 6) { toast('Vui lòng nhập mã 6 chữ số', 'error'); return; }
            try {
              await apiFetch('/auth/2fa/verify', { 
                method: 'POST', 
                body: JSON.stringify({ secret: data.secret, code }) 
              });
              closeModal();
              toast('Đã bật xác thực 2 bước', 'success');
              renderProfile(view);
            } catch (err) { 
              const errEl = qs('#2fa-err'); 
              errEl.textContent = err.message; 
              errEl.style.display = 'block'; 
            }
          };
        } catch (e) { toast(e.message, 'error'); }
      }
    };

    qs('#profile-logout-btn', view).onclick = () => {
      saveToken(null); currentUser = null; updateAuthUI();
      toast('Đã đăng xuất', 'info'); location.hash = '/';
    };

    // Order history
    const ordersCard = el('div', 'info-card');
    ordersCard.innerHTML = `<div class="info-card-head" style="display:flex; justify-content:space-between; align-items:center;"><div class="info-card-title"><i class="fa-solid fa-clock-rotate-left"></i> Lịch sử đơn hàng gần đây</div><a href="#/orders" class="btn btn-outline btn-sm" style="background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.3); color:#fff;">Xem tất cả đơn</a></div><div class="info-card-body" id="profile-orders"><div class="page-loading"><div class="spinner"></div></div></div>`;
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

