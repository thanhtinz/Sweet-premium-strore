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
            ${withAvatarFallback(u.avatar_url) ? `<img src="${esc(withAvatarFallback(u.avatar_url))}" alt="" onerror="${onImgFallback('avatar')}" />` : `<div class="profile-avatar-placeholder">${esc((u.display_name || u.email || 'U').charAt(0).toUpperCase())}</div>`}
          </div>
          <div class="profile-info">
            <div class="profile-name">${esc(u.display_name || u.email?.split('@')[0] || 'User')}</div>
            <div class="profile-email">${esc(u.email || '—')}</div>
            <div class="profile-provider">${u.provider && u.provider !== 'local' ? `<span class="badge badge-blue">${esc(u.provider)}</span>` : '<span class="badge badge-gray">Tài khoản cửa hàng</span>'}</div>
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
          <div class="form-group"><label class="form-label">Tên hiển thị</label><input type="text" class="form-input" id="pf-name" value="${esc(u.display_name || '')}" /></div>
          <div class="form-group"><label class="form-label">Avatar URL</label><input type="text" class="form-input" id="pf-avatar" value="${esc(u.avatar_url || '')}" placeholder="https://..." /></div>
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
    // ── Balance Card (only if feature enabled) ──
    const balanceEnabled = appSettings.features?.balance !== false;
    let myBalance = 0;
    if (balanceEnabled) {
      let balanceData = { balance: 0 };
      try { balanceData = await apiFetch('/balance'); } catch(e) {}
      myBalance = balanceData.balance || 0;

      // Check affiliate earnings
      let affAvailable = 0;
      try {
        const affData = await apiFetch('/affiliate/me');
        affAvailable = Math.max(0, (affData.total_earnings || 0) - (affData.total_paid || 0));
      } catch(e) {}

      let historyItems = [];
      try { const hData = await apiFetch('/balance/history?limit=5'); historyItems = hData.items || []; } catch(e) {}

      const balanceCard = el('div', 'mb-24');
      balanceCard.innerHTML = `
        <div class="wallet-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; padding: 24px; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid rgba(255,255,255,0.05); margin-bottom: 24px;">
          <!-- Decorative background circles -->
          <div style="position: absolute; top: -50px; right: -20px; width: 150px; height: 150px; background: rgba(255,255,255,0.03); border-radius: 50%; pointer-events: none;"></div>
          <div style="position: absolute; bottom: -30px; right: 80px; width: 100px; height: 100px; background: rgba(255,255,255,0.02); border-radius: 50%; pointer-events: none;"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1;">
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Số dư khả dụng</div>
              <div style="font-size: 32px; font-weight: 800; color: #fff; letter-spacing: -0.5px; display: flex; align-items: baseline; gap: 4px;">
                ${fmt(myBalance)}
              </div>
            </div>
            <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.08); border-radius: 14px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px);">
              <i class="fa-solid fa-wallet" style="font-size: 20px; color: #38bdf8;"></i>
            </div>
          </div>

          <div style="margin-top: 28px; display: flex; gap: 12px; position: relative; z-index: 1; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btn-topup" style="background: #38bdf8; color: #0f172a; border: none; font-weight: 700; border-radius: 8px; padding: 10px 20px;">
              <i class="fa-solid fa-plus" style="margin-right: 6px;"></i> Nạp tiền ngay
            </button>
            ${affAvailable >= 1000 ? `<button class="btn btn-outline" id="btn-aff-withdraw" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); color: #fff; border-radius: 8px; padding: 10px 20px; font-weight: 600;">
              <i class="fa-solid fa-arrow-right-from-bracket" style="margin-right: 6px;"></i> Rút hoa hồng (${fmt(affAvailable)})
            </button>` : ''}
          </div>
        </div>
      `;
      view.appendChild(balanceCard);

      // Topup modal
      qs('#btn-topup', balanceCard).onclick = () => {
      openModal(`
        <h3 class="modal-title mb-16"><i class="fa-solid fa-plus-circle"></i> Nạp tiền vào tài khoản</h3>
        <div class="form-group">
          <label class="form-label">Số tiền nạp</label>
          <input type="number" class="form-input" id="topup-amount" min="10000" max="10000000" step="1000" placeholder="Nhập số tiền..." style="font-size:18px;font-weight:700;" />
          <div class="form-hint">Tối thiểu 10,000 candy — Tối đa 10,000,000 candy</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
          ${[50000,100000,200000,500000,1000000].map(v => `<button class="btn btn-ghost btn-sm topup-preset" data-amount="${v}">${fmt(v)}</button>`).join('')}
        </div>
        <div id="topup-err" class="form-error mb-12" style="display:none"></div>
        <button class="btn btn-primary btn-full" id="btn-topup-submit"><i class="fa-solid fa-qrcode"></i> Nạp qua PayOS</button>
      `);
      qsa('.topup-preset').forEach(btn => {
        btn.onclick = () => { qs('#topup-amount').value = btn.dataset.amount; };
      });
      qs('#btn-topup-submit').onclick = async () => {
        const amount = parseInt(qs('#topup-amount').value);
        const errEl = qs('#topup-err');
        if (!amount || amount < 10000 || amount > 10000000) {
          errEl.textContent = 'Số tiền không hợp lệ'; errEl.style.display = 'block'; return;
        }
        const btn = qs('#btn-topup-submit');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...';
        try {
          const res = await apiFetch('/balance/topup', { method: 'POST', body: JSON.stringify({ amount }) });
          closeModal();
          window.open(res.payment_url, '_blank');
          toast('Đã tạo lệnh nạp! Chuyển đến thanh toán...', 'success', 5000);
        } catch (err) {
          errEl.textContent = err.message; errEl.style.display = 'block';
          btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-qrcode"></i> Nạp qua PayOS';
        }
      };
    };

    // Affiliate withdraw
    if (qs('#btn-aff-withdraw', balanceCard)) {
      qs('#btn-aff-withdraw', balanceCard).onclick = async () => {
        if (!confirm(`Rút ${fmt(affAvailable)} hoa hồng vào số dư?`)) return;
        try {
          const res = await apiFetch('/balance/affiliate-withdraw', { method: 'POST', body: JSON.stringify({}) });
          toast(`Đã rút ${fmt(res.amount)} vào số dư`, 'success');
          renderProfile(view);
        } catch (err) { toast(err.message, 'error'); }
      };
    }
    } // end if (balanceEnabled)

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

    let botLinks = null;
    let authCfg = {};
    let botLinksError = '';
    try { botLinks = await apiFetch('/bot-links'); } catch (e) { botLinksError = e?.message || 'Không tải được dữ liệu bot'; }
    try { authCfg = await apiFetch('/auth/config'); } catch (e) {}
    {
      const discord = botLinks?.platforms?.discord || {};
      const telegram = botLinks?.platforms?.telegram || {};
      const commands = Array.isArray(botLinks?.commands) ? botLinks.commands : [];
      const discordOauthEnabled = !!authCfg.discord_enabled;
      const formatBotDate = (value) => value ? fmtDate(value) : '—';
      const formatExpiryText = (value) => value ? `Hết hạn: ${fmtDate(value)}` : 'Chưa có mã đang hoạt động';
      const botCard = el('div', 'info-card');
      botCard.innerHTML = `
        <div class="info-card-head"><div class="info-card-title"><i class="fa-solid fa-robot"></i> Liên kết bot hỗ trợ</div></div>
        <div class="info-card-body">
          ${botLinksError ? `<div class="form-error mb-12" style="display:block">${esc(botLinksError)}</div>` : ''}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;align-items:start;">
            <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-page);">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <div style="width:40px;height:40px;border-radius:50%;background:#5865F2;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;">
                  <i class="fa-brands fa-discord"></i>
                </div>
                <div class="fw-600">Discord DM Bot</div>
              </div>
              <div class="text-sm text-muted mb-8">${discord.linked ? `Đã liên kết UID: ${esc(discord.platform_user_id || '')}` : 'Chưa liên kết Discord.'}</div>
              <div class="text-sm text-muted mb-8">${discord.platform_username ? `Username: ${esc(discord.platform_username)}` : ''}${discord.last_seen_at ? `${discord.platform_username ? '<br>' : ''}Hoạt động gần nhất: ${esc(formatBotDate(discord.last_seen_at))}` : ''}${discord.linked_at ? `${(discord.platform_username || discord.last_seen_at) ? '<br>' : ''}Liên kết lúc: ${esc(formatBotDate(discord.linked_at))}` : ''}</div>
              <div style="padding:12px;background:var(--bg-card);border:1px dashed var(--border-dark);border-radius:var(--radius-xs);margin-bottom:12px;">
                <div class="fw-600 mb-6">3 cách liên kết Discord</div>
                <div class="text-sm text-muted">1. Tạo mã rồi DM bot: <code>/link CODE</code></div>
                <div class="text-sm text-muted">2. Đăng nhập bằng Discord để auto-link</div>
                <div class="text-sm text-muted">3. Nhập Discord UID thủ công nếu cần fallback</div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-outline btn-sm" id="discord-code-btn">Tạo mã /link</button>
                <button class="btn btn-ghost btn-sm" id="discord-copy-code-btn">Copy mã</button>
                <button class="btn btn-ghost btn-sm" id="discord-manual-btn">Nhập Discord UID</button>
                <button class="btn btn-ghost btn-sm" id="discord-status-btn">Xem trạng thái</button>
                <button class="btn btn-ghost btn-sm" id="discord-unlink-btn">Gỡ liên kết</button>
                ${botLinks?.discord_invite ? `<a class="btn btn-ghost btn-sm" href="${esc(botLinks.discord_invite)}" target="_blank" rel="noopener">Mở Discord bot</a>` : ''}
                ${discordOauthEnabled ? `<a class="btn btn-ghost btn-sm" href="/api/auth/discord">Đăng nhập bằng Discord</a>` : ''}
              </div>
              <div class="text-sm text-muted mt-8" id="discord-link-code">${discord.link_code ? `Dùng trong DM: /link ${esc(discord.link_code)}` : 'Tạo mã rồi gửi trong DM với bot Discord.'}</div>
              <div class="text-xs text-muted mt-4" id="discord-link-expiry">${formatExpiryText(discord.link_code_expires_at)}</div>
            </div>
            <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-page);">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <div style="width:40px;height:40px;border-radius:50%;background:#229ED9;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;">
                  <i class="fa-brands fa-telegram"></i>
                </div>
                <div class="fw-600">Telegram Bot</div>
              </div>
              <div class="text-sm text-muted mb-8">${telegram.linked ? `Đã liên kết ID: ${esc(telegram.platform_user_id || '')}` : 'Chưa liên kết Telegram.'}</div>
              <div class="text-sm text-muted mb-8">${telegram.platform_username ? `Username: ${esc(telegram.platform_username)}` : ''}${telegram.last_seen_at ? `${telegram.platform_username ? '<br>' : ''}Hoạt động gần nhất: ${esc(formatBotDate(telegram.last_seen_at))}` : ''}${telegram.linked_at ? `${(telegram.platform_username || telegram.last_seen_at) ? '<br>' : ''}Liên kết lúc: ${esc(formatBotDate(telegram.linked_at))}` : ''}</div>
              <div style="padding:12px;background:var(--bg-card);border:1px dashed var(--border-dark);border-radius:var(--radius-xs);margin-bottom:12px;">
                <div class="fw-600 mb-6">Cách liên kết Telegram</div>
                <div class="text-sm text-muted">1. Tạo mã rồi mở bot Telegram</div>
                <div class="text-sm text-muted">2. Gửi lệnh <code>/link CODE</code> trong chat bot</div>
                <div class="text-sm text-muted">3. Dùng /status để kiểm tra sau khi liên kết</div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-outline btn-sm" id="telegram-code-btn">Tạo mã /link</button>
                <button class="btn btn-ghost btn-sm" id="telegram-status-btn">Xem trạng thái</button>
                <button class="btn btn-ghost btn-sm" id="telegram-unlink-btn">Gỡ liên kết</button>
                ${botLinks?.telegram_bot_username ? `<a class="btn btn-ghost btn-sm" href="https://t.me/${esc(botLinks.telegram_bot_username)}" target="_blank" rel="noopener">Mở bot Telegram</a>` : ''}
              </div>
              <div class="text-sm text-muted mt-8" id="telegram-link-code">${telegram.link_code ? `Dùng trong chat bot: /link ${esc(telegram.link_code)}` : 'Tạo mã rồi gửi trong chat bot Telegram.'}</div>
            </div>
          </div>
          <div class="mt-16">
            <div class="fw-600 mb-8">Lệnh hỗ trợ đơn giản</div>
            <div class="text-sm text-muted">${commands.length ? commands.map(item => `${esc(item.command)} — ${esc(item.description)}`).join('<br>') : 'Chưa tải được danh sách lệnh bot.'}</div>
          </div>
        </div>
      `;
      view.appendChild(botCard);

      const refreshBotLinks = async () => {
        try { renderProfile(view); } catch (e) {}
      };

      const createCode = async (platform) => {
        if (!botLinks) {
          toast(botLinksError || 'Chưa tải được dữ liệu bot', 'error');
          return;
        }
        try {
          const res = await apiFetch(`/bot-links/${platform}/code`, { method: 'POST' });
          toast(`Mã liên kết ${platform} đã tạo`, 'success');
          if (platform === 'discord') {
            qs('#discord-link-code', botCard).textContent = `Dùng trong DM: /link ${res.link_code}`;
            const expiryEl = qs('#discord-link-expiry', botCard);
            if (expiryEl) expiryEl.textContent = formatExpiryText(res.expires_at);
          }
          if (platform === 'telegram') qs('#telegram-link-code', botCard).textContent = `Dùng trong chat bot: /link ${res.link_code}`;
        } catch (err) { toast(err.message, 'error'); }
      };

      const copyDiscordCode = async () => {
        const code = discord.link_code || qs('#discord-link-code', botCard)?.textContent?.replace('Dùng trong DM: /link ', '').trim();
        if (!code) {
          toast('Chưa có mã Discord để copy', 'info');
          return;
        }
        try {
          await navigator.clipboard.writeText(`/link ${code}`);
          toast('Đã copy mã Discord', 'success');
        } catch (_) {
          toast('Không thể copy tự động. Hãy copy thủ công.', 'error');
        }
      };

      const showStatus = async (platform) => {
        try {
          const res = await apiFetch(`/bot-links/${platform}/status`);
          openModal(`
            <h3 class="modal-title mb-16">Trạng thái ${platform}</h3>
            <div class="text-sm text-muted" style="line-height:1.8;">
              <div>Đã liên kết: ${res.linked ? 'Có' : 'Không'}</div>
              <div>ID nền tảng: ${esc(res.platform_user_id || '—')}</div>
              <div>Username: ${esc(res.platform_username || '—')}</div>
              <div>Linked at: ${esc(res.linked_at || '—')}</div>
              <div>Last seen: ${esc(res.last_seen_at || '—')}</div>
              <div>Mã đang hoạt động: ${res.has_active_code ? esc(res.link_code || 'Có') : 'Không'}</div>
            </div>
          `);
        } catch (err) { toast(err.message, 'error'); }
      };

      const unlinkPlatform = async (platform) => {
        if (!confirm(`Gỡ liên kết ${platform}?`)) return;
        try {
          await apiFetch(`/bot-links/${platform}`, { method: 'DELETE' });
          toast(`Đã gỡ liên kết ${platform}`, 'success');
          refreshBotLinks();
        } catch (err) { toast(err.message, 'error'); }
      };

      qs('#discord-code-btn', botCard).onclick = () => createCode('discord');
      qs('#discord-copy-code-btn', botCard).onclick = () => copyDiscordCode();
      qs('#telegram-code-btn', botCard).onclick = () => createCode('telegram');
      qs('#discord-status-btn', botCard).onclick = () => showStatus('discord');
      qs('#telegram-status-btn', botCard).onclick = () => showStatus('telegram');
      qs('#discord-unlink-btn', botCard).onclick = () => unlinkPlatform('discord');
      qs('#telegram-unlink-btn', botCard).onclick = () => unlinkPlatform('telegram');
      qs('#discord-manual-btn', botCard).onclick = () => {
        openModal(`
          <h3 class="modal-title mb-16">Liên kết Discord bằng UID</h3>
          <div class="form-group"><label class="form-label">Discord UID</label><input type="text" class="form-input" id="discord-manual-uid" placeholder="Nhập Discord user ID" /></div>
          <div class="text-sm text-muted mb-12">Bật Developer Mode trong Discord, mở profile của bạn, copy User ID rồi nhập vào đây nếu không dùng OAuth hoặc mã /link.</div>
          <div id="discord-manual-err" class="form-error mb-12" style="display:none"></div>
          <button class="btn btn-primary btn-full" id="discord-manual-submit">Liên kết</button>
        `);
        qs('#discord-manual-submit').onclick = async () => {
          try {
            await apiFetch('/bot-links/discord/manual', {
              method: 'POST',
              body: JSON.stringify({ discord_user_id: qs('#discord-manual-uid').value.trim() })
            });
            closeModal();
            toast('Đã liên kết Discord UID', 'success');
            refreshBotLinks();
          } catch (err) {
            const elErr = qs('#discord-manual-err');
            elErr.textContent = err.message;
            elErr.style.display = 'block';
          }
        };
      };
    }

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

    // Legacy bot card removed: replaced by detailed Discord DM / Telegram linking card above.

    // ── API Keys Section (requires api_docs feature) ──
    if (appSettings.features?.api_docs === true) {
    const apiKeysCard = el('div', 'info-card');
    apiKeysCard.innerHTML = `
      <div class="info-card-head" style="display:flex;justify-content:space-between;align-items:center;">
        <div class="info-card-title"><i class="fa-solid fa-key"></i> API Keys</div>
        <button class="btn btn-outline btn-sm" id="btn-create-apikey" style="background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.3); color:#fff;">+ Tạo key mới</button>
      </div>
      <div class="info-card-body" id="apikeys-list" style="padding-bottom:16px"><div class="page-loading"><div class="spinner"></div></div></div>
    `;
    view.appendChild(apiKeysCard);

    // Load & render API keys
    const renderApiKeys = async () => {
      const listEl = qs('#apikeys-list', view);
      try {
        const keys = await apiFetch('/api-keys/');
        if (!keys.length) {
          listEl.innerHTML = '<div class="text-center text-muted py-16">Chưa có API key nào. Tạo key để bắt đầu tích hợp API.</div>';
          return;
        }
        listEl.innerHTML = keys.map(k => `
          <div class="apikey-row" style="display:flex;align-items:flex-start;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);gap:12px;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:14px;">${esc(k.name)}</div>
              <div style="font-size:12px;color:var(--text-muted);font-family:monospace;margin-top:2px;">${esc(k.key_prefix)}</div>
              <div style="font-size:11px;margin-top:4px;">
                <span style="color:var(--primary);">🌐 ${k.allowed_domains.length ? esc(k.allowed_domains.join(', ')) : '<em>Không giới hạn</em>'}</span>
                ${k.callback_url ? `<br><span style="color:var(--text-muted);">↩ ${esc(k.callback_url)}</span>` : ''}
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                Tạo: ${k.created_at ? new Date(k.created_at).toLocaleDateString('vi') : '—'}
                ${k.last_used_at ? ' · Dùng lần cuối: ' + new Date(k.last_used_at).toLocaleDateString('vi') : ''}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              ${k.is_active
                ? `<span class="badge badge-green">Active</span>
                   <button class="btn btn-ghost btn-sm" data-edit-key="${k.id}" style="font-size:12px;">Sửa</button>
                   <button class="btn btn-ghost btn-sm" data-revoke="${k.id}" style="color:var(--danger);font-size:12px;">Thu hồi</button>`
                : '<span class="badge badge-gray">Revoked</span>'
              }
            </div>
          </div>
        `).join('');

        // Bind revoke
        qsa('[data-revoke]', listEl).forEach(btn => {
          btn.onclick = async () => {
            if (!confirm('Thu hồi key này? Hành động không thể hoàn tác.')) return;
            try {
              await apiFetch('/api-keys/' + btn.dataset.revoke, { method: 'DELETE' });
              toast('Đã thu hồi key', 'success');
              renderApiKeys();
            } catch (err) { toast(err.message, 'error'); }
          };
        });

        // Bind edit
        qsa('[data-edit-key]', listEl).forEach(btn => {
          btn.onclick = () => {
            const k = keys.find(x => x.id === Number(btn.dataset.editKey));
            if (!k) return;
            openModal(`
              <div class="form-group">
                <label class="form-label">Tên key</label>
                <input class="form-input" id="edit-key-name" value="${esc(k.name)}" />
              </div>
              <div class="form-group">
                <label class="form-label">Domain được phép <span class="req">*</span></label>
                <input class="form-input" id="edit-key-domains" value="${esc(k.allowed_domains.join(', '))}" placeholder="example.com, app.example.com" />
                <div class="form-hint">Phân cách bằng dấu phẩy. Chỉ request từ các domain này mới dùng được key.</div>
              </div>
              <div class="form-group">
                <label class="form-label">Callback URL</label>
                <input class="form-input" id="edit-key-callback" value="${esc(k.callback_url)}" placeholder="https://example.com/api/callback" />
                <div class="form-hint">URL nhận webhook/callback. Domain phải nằm trong danh sách trên.</div>
              </div>
              <button class="btn btn-primary w-full mt-8" id="btn-save-edit-key">Lưu thay đổi</button>
            `, 'Chỉnh sửa API Key');
            qs('#btn-save-edit-key').onclick = async () => {
              try {
                await apiFetch('/api-keys/' + k.id, {
                  method: 'PUT',
                  body: JSON.stringify({
                    name: qs('#edit-key-name').value,
                    allowed_domains: qs('#edit-key-domains').value,
                    callback_url: qs('#edit-key-callback').value,
                  }),
                });
                closeModal();
                toast('Đã cập nhật', 'success');
                renderApiKeys();
              } catch (err) { toast(err.message, 'error'); }
            };
          };
        });
      } catch (err) {
        listEl.innerHTML = `<div class="text-muted py-8">${err.message}</div>`;
      }
    };
    renderApiKeys();

    // Create key button
    qs('#btn-create-apikey', view).onclick = () => {
      openModal(`
        <div class="form-group">
          <label class="form-label">Tên key</label>
          <input class="form-input" id="new-key-name" placeholder="VD: Production, Test, My App..." autofocus />
          <div class="form-hint">Đặt tên để phân biệt các key với nhau</div>
        </div>
        <div class="form-group">
          <label class="form-label">Domain được phép <span class="req">*</span></label>
          <input class="form-input" id="new-key-domains" placeholder="example.com, app.example.com" />
          <div class="form-hint">Phân cách bằng dấu phẩy. Chỉ request từ domain này mới được phép dùng key. Bắt buộc.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Callback URL</label>
          <input class="form-input" id="new-key-callback" placeholder="https://example.com/api/callback" />
          <div class="form-hint">URL nhận webhook/callback (không bắt buộc). Domain phải nằm trong danh sách trên.</div>
        </div>
        <button class="btn btn-primary w-full mt-8" id="btn-confirm-create-key">Tạo API Key</button>
      `, 'Tạo API Key mới');

      qs('#btn-confirm-create-key').onclick = async () => {
        const name = qs('#new-key-name').value.trim();
        const domains = qs('#new-key-domains').value.trim();
        const callback = qs('#new-key-callback').value.trim();
        if (!name) { toast('Nhập tên key', 'error'); return; }
        if (!domains) { toast('Nhập ít nhất 1 domain', 'error'); return; }
        try {
          const res = await apiFetch('/api-keys/', {
            method: 'POST',
            body: JSON.stringify({ name, allowed_domains: domains, callback_url: callback }),
          });
          closeModal();
          // Show the key in a special modal
          openModal(`
            <div style="text-align:center;padding:8px 0;">
              <div style="font-size:40px;margin-bottom:8px;">🔑</div>
              <h3 style="margin-bottom:12px;">API Key đã tạo thành công!</h3>
              <div class="form-group">
                <input class="form-input" value="${esc(res.key)}" id="created-key-value" readonly style="font-family:monospace;font-size:13px;text-align:center;background:var(--bg-page);letter-spacing:0.5px;" />
              </div>
              <button class="btn btn-primary btn-sm" id="btn-copy-key"><i class="fa-solid fa-copy"></i> Copy</button>
              <div style="margin-top:12px;padding:10px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:8px;font-size:12px;color:#b45309;">
                <strong>⚠️ Quan trọng:</strong> Lưu lại key này ngay! Bạn sẽ không thể xem lại sau khi đóng.
              </div>
              <button class="btn btn-ghost mt-12" onclick="closeModal()">Đã lưu, đóng</button>
            </div>
          `, 'API Key');
          qs('#btn-copy-key').onclick = () => {
            qs('#created-key-value').select();
            navigator.clipboard?.writeText(res.key);
            toast('Đã copy key', 'success');
          };
          renderApiKeys();
        } catch (err) { toast(err.message, 'error'); }
      };
    };

    } // end api_docs feature check

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

    // ── Transaction History Card ──
    const txCard = el('div', 'info-card');
    txCard.innerHTML = `
      <div class="info-card-head" style="display:flex;justify-content:space-between;align-items:center;">
        <div class="info-card-title"><i class="fa-solid fa-receipt"></i> Lịch sử giao dịch</div>
      </div>
      <div class="info-card-body" id="profile-tx-list">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>
    `;
    view.appendChild(txCard);

    try {
      const txData = await apiFetch('/balance/history?limit=20');
      const txItems = txData.items || [];
      const txWrap = qs('#profile-tx-list', view);
      if (!txItems.length) {
        txWrap.innerHTML = '<div class="text-center text-muted py-16">Chưa có giao dịch</div>';
      } else {
        const typeLabels = { topup:'Nạp tiền', purchase:'Mua hàng', affiliate_withdraw:'Rút hoa hồng', admin_adjust:'Admin điều chỉnh', refund:'Hoàn tiền' };
        const typeIcons = { topup:'fa-plus-circle', purchase:'fa-shopping-cart', affiliate_withdraw:'fa-arrow-right-from-bracket', admin_adjust:'fa-sliders', refund:'fa-rotate-left' };
        txWrap.innerHTML = txItems.map(t => {
          const isPositive = t.amount > 0;
          return `<div class="order-card" style="margin-bottom:8px">
            <div class="order-card-top">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'};">
                  <i class="fa-solid ${typeIcons[t.type] || 'fa-circle'}" style="color:${isPositive ? '#10b981' : '#ef4444'};font-size:14px;"></i>
                </div>
                <div>
                  <div class="fw-600">${typeLabels[t.type] || t.type}</div>
                  <div class="text-muted text-xs">${fmtDate(t.created_at)}</div>
                </div>
              </div>
              <div style="font-weight:700;font-size:15px;color:${isPositive ? '#10b981' : '#ef4444'};">${isPositive ? '+' : ''}${fmt(t.amount)}</div>
            </div>
            ${t.note ? `<div class="text-muted text-xs mt-4">${esc(t.note)}</div>` : ''}
          </div>`;
        }).join('');
      }
    } catch (_) { qs('#profile-tx-list', view).innerHTML = '<div class="text-muted">Không thể tải giao dịch</div>'; }

  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`;
  }
}

// ═══════════════════════════════════════════════════════════════
//  AFFILIATES – Giới thiệu bạn bè
// ═══════════════════════════════════════════════════════════════

async function renderUserAffiliates(view) {
  if (!currentUser) return location.hash = '/login';
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const data = await apiFetch('/affiliate/me');
    const siteBase = location.origin;
    view.innerHTML = '';

    // Hero
    const heroHead = el('div', 'products-hero');
    heroHead.innerHTML = `
      <div class="breadcrumb mb-8"><a href="#/">Trang chủ</a> <span>›</span> <a href="#/profile">Tài khoản</a> <span>›</span> <strong>Giới thiệu bạn bè</strong></div>
      <h1 class="products-hero-title"><i class="fa-solid fa-user-group"></i> Giới thiệu bạn bè</h1>
      <p class="products-hero-desc">Chia sẻ link giới thiệu và nhận hoa hồng từ mỗi đơn hàng thành công</p>
    `;
    view.appendChild(heroHead);

    if (!data.registered) {
      // Not yet an affiliate – show registration card
      const regCard = el('div', 'info-card');
      regCard.innerHTML = `
        <div class="info-card-head"><div class="info-card-title"><i class="fa-solid fa-rocket"></i> Đăng ký Affiliate</div></div>
        <div class="info-card-body" style="text-align:center; padding:40px 20px;">
          <div style="font-size:48px; margin-bottom:16px; opacity:0.3;"><i class="fa-solid fa-handshake"></i></div>
          <h3 style="margin:0 0 8px;">Tham gia chương trình Affiliate</h3>
          <p class="text-muted" style="margin:0 0 20px;">Đăng ký để nhận mã giới thiệu và bắt đầu kiếm hoa hồng từ đơn hàng của bạn bè.</p>
          <button class="btn btn-primary" id="aff-register-btn"><i class="fa-solid fa-user-plus"></i> Đăng ký ngay</button>
        </div>
      `;
      view.appendChild(regCard);

      qs('#aff-register-btn', view).onclick = async () => {
        try {
          qs('#aff-register-btn').disabled = true;
          qs('#aff-register-btn').innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div> Đang đăng ký...';
          await apiFetch('/affiliate/register', { method: 'POST' });
          toast('Đăng ký thành công!', 'success');
          renderUserAffiliates(view);
        } catch (err) {
          toast(err.message, 'error');
          qs('#aff-register-btn').disabled = false;
          qs('#aff-register-btn').innerHTML = '<i class="fa-solid fa-user-plus"></i> Đăng ký ngay';
        }
      };
      return;
    }

    // Registered affiliate – show dashboard
    const aff = data;
    const refLink = `${siteBase}/?ref=${aff.ref_code}`;
    const totalReferrals = (data.referrals || []).length;
    const pendingCommission = (data.referrals || []).filter(r => r.status === 'pending').reduce((s, r) => s + parseFloat(r.commission), 0);
    const availableBalance = Math.max(0, (aff.total_earnings || 0) - (aff.total_paid || 0));

    // Stats row
    const statsRow = el('div', '');
    statsRow.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:16px; margin-bottom:24px;';
    statsRow.innerHTML = `
      <div class="info-card" style="margin-bottom:0;">
        <div class="info-card-body" style="text-align:center; padding:20px;">
          <div style="font-size:28px; font-weight:800; color:var(--primary);">${totalReferrals}</div>
          <div class="text-muted text-sm">Số người đã giới thiệu</div>
        </div>
      </div>
      <div class="info-card" style="margin-bottom:0;">
        <div class="info-card-body" style="text-align:center; padding:20px;">
          <div style="font-size:28px; font-weight:800; color:#D97706;">${fmt(pendingCommission)}</div>
          <div class="text-muted text-sm">Hoa hồng chờ duyệt</div>
        </div>
      </div>
      <div class="info-card" style="margin-bottom:0;">
        <div class="info-card-body" style="text-align:center; padding:20px;">
          <div style="font-size:28px; font-weight:800; color:var(--success, #22c55e);">${fmt(availableBalance)}</div>
          <div class="text-muted text-sm">Số dư khả dụng</div>
        </div>
      </div>
      <div class="info-card" style="margin-bottom:0;">
        <div class="info-card-body" style="text-align:center; padding:20px;">
          <div style="font-size:28px; font-weight:800; color:var(--info, #3b82f6);">${fmt(aff.total_paid)}</div>
          <div class="text-muted text-sm">Đã thanh toán</div>
        </div>
      </div>
    `;
    view.appendChild(statsRow);

    // Referral link card
    const linkCard = el('div', 'info-card');
    linkCard.innerHTML = `
      <div class="info-card-head"><div class="info-card-title"><i class="fa-solid fa-link"></i> Link giới thiệu của bạn</div></div>
      <div class="info-card-body">
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" class="form-input" id="aff-ref-link" value="${refLink}" readonly style="flex:1; font-family:monospace; font-size:14px; background:var(--bg-secondary, #f5f5f5);" />
          <button class="btn btn-primary" id="aff-copy-btn" title="Sao chép"><i class="fa-solid fa-copy"></i> Sao chép</button>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <span class="text-muted text-sm">Mã giới thiệu:</span>
          <code style="background:var(--bg-secondary, #f5f5f5); padding:2px 8px; border-radius:4px; font-weight:700; letter-spacing:1px;">${aff.ref_code}</code>
          <span class="text-muted text-sm" style="margin-left:8px;">Hoa hồng:</span>
          <strong style="color:var(--primary);">${aff.commission_rate}%</strong>
          <span class="text-muted text-sm">/ đơn hàng</span>
        </div>
      </div>
    `;
    view.appendChild(linkCard);

    qs('#aff-copy-btn', view).onclick = () => {
      const input = qs('#aff-ref-link', view);
      input.select();
      navigator.clipboard.writeText(refLink).then(() => {
        toast('Đã sao chép link giới thiệu!', 'success');
      }).catch(() => {
        document.execCommand('copy');
        toast('Đã sao chép!', 'success');
      });
    };

    // Withdraw card
    const withdrawCard = el('div', 'info-card');
    withdrawCard.innerHTML = `
      <div class="info-card-head"><div class="info-card-title"><i class="fa-solid fa-money-bill-transfer"></i> Rút tiền</div></div>
      <div class="info-card-body">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <div class="text-muted text-sm">Số dư khả dụng</div>
            <div style="font-size:28px; font-weight:800; color:var(--primary);">${fmt(availableBalance)}</div>
          </div>
          <button class="btn btn-primary" id="aff-withdraw-btn" ${availableBalance <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            <i class="fa-solid fa-arrow-right-from-bracket"></i> Rút tiền
          </button>
        </div>
        ${availableBalance <= 0 ? '<p class="text-sm text-muted" style="margin-top:8px;">Bạn chưa có số dư khả dụng để rút.</p>' : ''}
      </div>
    `;
    view.appendChild(withdrawCard);

    if (availableBalance > 0) {
      qs('#aff-withdraw-btn', view).onclick = () => {
        openModal(`
          <h3 class="modal-title mb-16">Yêu cầu rút tiền</h3>
          <p class="mb-12">Số dư khả dụng: <strong>${fmt(availableBalance)}</strong></p>
          <div class="form-group">
            <label class="form-label">Số tiền muốn rút</label>
            <input type="number" class="form-input" id="wd-amount" value="${availableBalance}" min="1" max="${availableBalance}" />
          </div>
          <div class="form-group">
            <label class="form-label">Phương thức nhận tiền</label>
            <select class="form-select" id="wd-method">
              <option value="bank">Chuyển khoản ngân hàng</option>
              <option value="momo">Ví MoMo</option>
              <option value="zalopay">ZaloPay</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Thông tin tài khoản nhận</label>
            <input type="text" class="form-input" id="wd-info" placeholder="Số tài khoản / Số điện thoại" />
          </div>
          <div id="wd-err" class="form-error mb-12" style="display:none"></div>
          <div class="flex gap-8">
            <button type="button" class="btn btn-primary flex-1" id="wd-submit">Gửi yêu cầu</button>
            <button type="button" class="btn btn-ghost" id="wd-cancel">Hủy</button>
          </div>
        `);
        qs('#wd-cancel').onclick = closeModal;
        qs('#wd-submit').onclick = async () => {
          const amount = parseFloat(qs('#wd-amount').value);
          const info = qs('#wd-info').value.trim();
          if (!amount || amount <= 0) {
            const e = qs('#wd-err'); e.textContent = 'Nhập số tiền hợp lệ'; e.style.display = 'block'; return;
          }
          if (amount > availableBalance) {
            const e = qs('#wd-err'); e.textContent = 'Số tiền vượt quá số dư khả dụng'; e.style.display = 'block'; return;
          }
          if (!info) {
            const e = qs('#wd-err'); e.textContent = 'Nhập thông tin tài khoản nhận'; e.style.display = 'block'; return;
          }
          try {
            qs('#wd-submit').disabled = true;
            qs('#wd-submit').textContent = 'Đang gửi...';
            await apiFetch('/balance/affiliate-withdraw', { method: 'POST', body: JSON.stringify({ amount: Math.floor(amount) }) });
            closeModal();
            toast('Yêu cầu rút tiền đã được gửi! Vui lòng chờ admin duyệt.', 'success');
            renderUserAffiliates(view);
          } catch (err) {
            const e = qs('#wd-err'); e.textContent = err.message; e.style.display = 'block';
            qs('#wd-submit').disabled = false;
            qs('#wd-submit').textContent = 'Gửi yêu cầu';
          }
        };
      };
    }

    // Commission history
    const histCard = el('div', 'info-card');
    const refs = data.referrals || [];
    histCard.innerHTML = `
      <div class="info-card-head"><div class="info-card-title"><i class="fa-solid fa-clock-rotate-left"></i> Lịch sử hoa hồng</div></div>
      <div class="info-card-body" style="padding:0;">
        ${refs.length ? `
          <div style="overflow-x:auto;">
            <table class="data-table" style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg-secondary, #f5f5f5);">
                  <th style="padding:10px 12px; text-align:left; font-size:13px;">Đơn hàng</th>
                  <th style="padding:10px 12px; text-align:right; font-size:13px;">Giá trị</th>
                  <th style="padding:10px 12px; text-align:right; font-size:13px;">Hoa hồng</th>
                  <th style="padding:10px 12px; text-align:center; font-size:13px;">Trạng thái</th>
                  <th style="padding:10px 12px; text-align:right; font-size:13px;">Ngày</th>
                </tr>
              </thead>
              <tbody>
                ${refs.map(r => {
                  const statusMap = {
                    pending: { label: 'Chờ duyệt', cls: 'badge-yellow' },
                    approved: { label: 'Đã duyệt', cls: 'badge-green' },
                    paid: { label: 'Đã thanh toán', cls: 'badge-blue' },
                  };
                  const st = statusMap[r.status] || { label: r.status, cls: 'badge-gray' };
                  return `<tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:10px 12px; font-size:13px;">#${r.order_id || '—'}</td>
                    <td style="padding:10px 12px; text-align:right; font-size:13px;">${fmt(r.order_amount)}</td>
                    <td style="padding:10px 12px; text-align:right; font-size:13px; font-weight:600; color:var(--primary);">${fmt(r.commission)}</td>
                    <td style="padding:10px 12px; text-align:center;"><span class="badge ${st.cls}">${st.label}</span></td>
                    <td style="padding:10px 12px; text-align:right; font-size:12px; color:var(--text-3);">${fmtDate(r.created_at)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; padding:40px 20px; color:var(--text-3);">
            <div style="font-size:36px; margin-bottom:12px; opacity:0.3;"><i class="fa-solid fa-receipt"></i></div>
            <p style="margin:0;">Chưa có hoa hồng nào. Hãy chia sẻ link giới thiệu để bắt đầu!</p>
          </div>
        `}
      </div>
    `;
    view.appendChild(histCard);

    // How it works
    const howCard = el('div', 'info-card');
    howCard.innerHTML = `
      <div class="info-card-head"><div class="info-card-title"><i class="fa-solid fa-circle-info"></i> Hướng dẫn</div></div>
      <div class="info-card-body">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:20px;">
          <div style="text-align:center;">
            <div style="width:48px; height:48px; border-radius:50%; background:var(--primary-light, rgba(99,102,241,0.1)); display:inline-flex; align-items:center; justify-content:center; margin-bottom:8px;"><i class="fa-solid fa-share-nodes" style="color:var(--primary); font-size:20px;"></i></div>
            <div style="font-weight:600; margin-bottom:4px;">1. Chia sẻ link</div>
            <div class="text-sm text-muted">Gửi link giới thiệu cho bạn bè qua mạng xã hội, tin nhắn...</div>
          </div>
          <div style="text-align:center;">
            <div style="width:48px; height:48px; border-radius:50%; background:var(--primary-light, rgba(99,102,241,0.1)); display:inline-flex; align-items:center; justify-content:center; margin-bottom:8px;"><i class="fa-solid fa-cart-shopping" style="color:var(--primary); font-size:20px;"></i></div>
            <div style="font-weight:600; margin-bottom:4px;">2. Bạn bè mua hàng</div>
            <div class="text-sm text-muted">Khi họ mua hàng qua link của bạn, hệ thống tự động ghi nhận.</div>
          </div>
          <div style="text-align:center;">
            <div style="width:48px; height:48px; border-radius:50%; background:var(--primary-light, rgba(99,102,241,0.1)); display:inline-flex; align-items:center; justify-content:center; margin-bottom:8px;"><i class="fa-solid fa-coins" style="color:var(--primary); font-size:20px;"></i></div>
            <div style="font-weight:600; margin-bottom:4px;">3. Nhận hoa hồng</div>
            <div class="text-sm text-muted">Bạn nhận ${aff.commission_rate}% giá trị đơn hàng. Hoa hồng được thanh toán định kỳ.</div>
          </div>
        </div>
      </div>
    `;
    view.appendChild(howCard);

  } catch (e) {
    view.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>${e.message}</h3></div>`;
  }
}

