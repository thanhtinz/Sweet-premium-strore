// ─── ADMIN BOT & SMTP CONFIG ─────────────────────────────────────
async function renderAdminBotConfig(view) {
  view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
  try {
    const config = await apiFetch('/bot-config/settings');
    view.innerHTML = `
      <div class="page-header"><div class="page-title">Cấu hình Bot & SMTP</div></div>
      <div style="max-width: 800px">
        <form id="bot-config-form" class="form-container" style="background:#fff; padding:24px; border-radius:8px; border:1px solid var(--border);">
          <h3 style="margin-top:0">🤖 Telegram Bot</h3>
          <div class="form-group">
            <label>Bot Token</label>
            <input type="text" class="input" id="telegram_token" value="${config.telegram_token || ''}" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11">
            <div class="help-text">Tạo bot qua @BotFather trên Telegram</div>
          </div>
          <div class="form-group">
            <label>Admin Chat ID</label>
            <input type="text" class="input" id="telegram_admin_id" value="${config.telegram_admin_id || ''}" placeholder="ID của admin hoặc group chat">
            <div class="help-text">Gửi tin nhắn cho bot và lấy ID qua @userinfobot</div>
          </div>

          <hr style="margin:24px 0; border:none; border-top:1px solid var(--border)">

          <h3 style="margin-top:0">💬 Discord Bot</h3>
          <div class="form-group">
            <label>Bot Token</label>
            <input type="text" class="input" id="discord_token" value="${config.discord_token || ''}">
            <div class="help-text">Tạo bot trong Discord Developer Portal</div>
          </div>
          <div class="form-group">
            <label>Admin Channel ID</label>
            <input type="text" class="input" id="discord_admin_id" value="${config.discord_admin_id || ''}" placeholder="ID kênh nhận thông báo admin">
          </div>

          <hr style="margin:24px 0; border:none; border-top:1px solid var(--border)">

          <h3 style="margin-top:0">📧 SMTP Mail (Gửi email tự động)</h3>
          <div class="form-group">
            <label>SMTP Server</label>
            <input type="text" class="input" id="smtp_server" value="${config.smtp_server || ''}" placeholder="smtp.gmail.com">
          </div>
          <div class="form-group">
            <label>SMTP Port</label>
            <input type="number" class="input" id="smtp_port" value="${config.smtp_port || '587'}" placeholder="587">
          </div>
          <div class="form-group">
            <label>SMTP Username (Email)</label>
            <input type="text" class="input" id="smtp_user" value="${config.smtp_user || ''}">
          </div>
          <div class="form-group">
            <label>SMTP Password (App Password)</label>
            <input type="password" class="input" id="smtp_pass" value="${config.smtp_pass || ''}">
          </div>
          <div class="form-group">
            <label>From Email</label>
            <input type="text" class="input" id="smtp_from" value="${config.smtp_from || ''}" placeholder="noreply@yourshop.com">
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top:16px">Lưu Cấu Hình</button>
        </form>
      </div>
    `;

    qs('#bot-config-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await apiFetch('/bot-config/settings', {
          method: 'PUT',
          body: JSON.stringify({
            telegram_token: qs('#telegram_token').value,
            telegram_admin_id: qs('#telegram_admin_id').value,
            discord_token: qs('#discord_token').value,
            discord_admin_id: qs('#discord_admin_id').value,
            smtp_server: qs('#smtp_server').value,
            smtp_port: qs('#smtp_port').value,
            smtp_user: qs('#smtp_user').value,
            smtp_pass: qs('#smtp_pass').value,
            smtp_from: qs('#smtp_from').value
          })
        });
        toast('Đã lưu cấu hình Bot & SMTP', 'success');
      } catch (err) {
        showError(err.message);
      }
    };
  } catch (err) {
    showError(err.message);
  }
}
