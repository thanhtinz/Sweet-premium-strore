// ─── ADMIN BOT & SMTP CONFIG ─────────────────────────────────────
async function renderAdminBotConfig(view) {
  if (!view) return; const content = view; 
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const config = await apiFetch('/admin/bot-config/settings');
    content.innerHTML = `
      <div class="page-header"><div class="page-title">Cấu hình Bot & SMTP</div></div>
      <form id="bot-config-form" class="bot-config-grid">

        <!-- Telegram Admin -->
        <div class="config-card">
          <div class="config-card-header telegram">
            <div class="config-card-icon"><i class="fa-brands fa-telegram"></i></div>
            <div>
              <div class="config-card-title">Telegram — Admin</div>
              <div class="config-card-desc">Nhận thông báo đơn hàng, ticket mới cho Admin</div>
            </div>
          </div>
          <div class="config-card-body">
            <div class="form-group">
              <label class="form-label">Bot Token</label>
              <input type="text" class="form-input" id="tg_admin_token" value="${config.telegram_token || ''}" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11">
              <div class="form-hint">Tạo bot qua <strong>@BotFather</strong> trên Telegram</div>
            </div>
            <div class="form-group">
              <label class="form-label">Bot Username</label>
              <input type="text" class="form-input" id="tg_bot_username" value="${config.telegram_bot_username || ''}" placeholder="MyShopBot (không có @)">
              <div class="form-hint">Username bot để tạo link t.me/username cho user</div>
            </div>
            <div class="form-group">
              <label class="form-label">Admin Chat ID</label>
              <input type="text" class="form-input" id="tg_admin_chat" value="${config.telegram_admin_id || ''}" placeholder="ID admin hoặc group chat">
              <div class="form-hint">Lấy ID qua <strong>@userinfobot</strong></div>
            </div>
          </div>
        </div>

        <!-- Telegram User -->
        <div class="config-card">
          <div class="config-card-header telegram">
            <div class="config-card-icon"><i class="fa-brands fa-telegram"></i></div>
            <div>
              <div class="config-card-title">Telegram — User</div>
              <div class="config-card-desc">Bot hỗ trợ khách hàng, tra cứu đơn hàng</div>
            </div>
          </div>
          <div class="config-card-body">
            <div class="form-group">
              <label class="form-label">Bot Token</label>
              <input type="text" class="form-input" id="tg_user_token" value="${config.telegram_user_token || ''}" placeholder="Bot riêng cho khách hàng">
              <div class="form-hint">Có thể dùng chung hoặc tạo bot riêng cho user</div>
            </div>
            <div class="form-group">
              <label class="form-label">Welcome Message</label>
              <textarea class="form-textarea" id="tg_user_welcome" rows="2" placeholder="Chào mừng bạn đến với hỗ trợ...">${config.telegram_user_welcome || ''}</textarea>
            </div>
          </div>
        </div>

        <!-- Discord User -->
        <div class="config-card">
          <div class="config-card-header discord">
            <div class="config-card-icon"><i class="fa-brands fa-discord"></i></div>
            <div>
              <div class="config-card-title">Discord — User</div>
              <div class="config-card-desc">Bot hỗ trợ khách hàng qua Discord server</div>
            </div>
          </div>
          <div class="config-card-body">
            <div class="form-group">
              <label class="form-label">Bot Token</label>
              <input type="text" class="form-input" id="discord_token" value="${config.discord_token || ''}">
              <div class="form-hint">Tạo bot trong <strong>Discord Developer Portal</strong></div>
            </div>
            <div class="form-group">
              <label class="form-label">Support Channel ID</label>
              <input type="text" class="form-input" id="discord_channel" value="${config.discord_admin_id || ''}" placeholder="ID kênh hỗ trợ">
            </div>
            <div class="form-group">
              <label class="form-label">Server Invite Link</label>
              <input type="text" class="form-input" id="discord_invite" value="${config.discord_invite || ''}" placeholder="https://discord.gg/...">
              <div class="form-hint">Link mời khách vào server hỗ trợ</div>
            </div>
          </div>
        </div>

        <!-- SMTP -->
        <div class="config-card">
          <div class="config-card-header smtp">
            <div class="config-card-icon"><i class="fa-solid fa-envelope"></i></div>
            <div>
              <div class="config-card-title">SMTP Mail</div>
              <div class="config-card-desc">Gửi email xác nhận đơn, thông báo tự động</div>
            </div>
          </div>
          <div class="config-card-body">
            <div class="config-row-2">
              <div class="form-group">
                <label class="form-label">SMTP Server</label>
                <input type="text" class="form-input" id="smtp_server" value="${config.smtp_server || ''}" placeholder="smtp.gmail.com">
              </div>
              <div class="form-group">
                <label class="form-label">Port</label>
                <input type="number" class="form-input" id="smtp_port" value="${config.smtp_port || '587'}" placeholder="587">
              </div>
            </div>
            <div class="config-row-2">
              <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" class="form-input" id="smtp_user" value="${config.smtp_user || ''}" placeholder="email@gmail.com">
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-input" id="smtp_pass" value="${config.smtp_pass || ''}" placeholder="App Password">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">From Email</label>
              <input type="text" class="form-input" id="smtp_from" value="${config.smtp_from || ''}" placeholder="noreply@yourshop.com">
            </div>
          </div>
        </div>

        <div class="config-save-bar">
          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Lưu tất cả cấu hình</button>
        </div>
      </form>
    `;

    qs('#bot-config-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = qs('#bot-config-form button[type="submit"]');
      btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
      try {
        await apiFetch('/admin/bot-config/settings', {
          method: 'PUT',
          body: JSON.stringify({
            telegram_token: qs('#tg_admin_token').value,
            telegram_bot_username: qs('#tg_bot_username').value.replace(/^@/, ''),
            telegram_admin_id: qs('#tg_admin_chat').value,
            telegram_user_token: qs('#tg_user_token').value,
            telegram_user_welcome: qs('#tg_user_welcome').value,
            discord_token: qs('#discord_token').value,
            discord_admin_id: qs('#discord_channel').value,
            discord_invite: qs('#discord_invite').value,
            smtp_server: qs('#smtp_server').value,
            smtp_port: qs('#smtp_port').value,
            smtp_user: qs('#smtp_user').value,
            smtp_pass: qs('#smtp_pass').value,
            smtp_from: qs('#smtp_from').value
          })
        });
        toast('Đã lưu cấu hình', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu tất cả cấu hình';
    };
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Lỗi tải cấu hình</h3><p class="text-muted">${err.message}</p></div>`;
  }
}
