/**
 * Support System JS
 * - Support pages (warranty, FAQ, policies, etc)
 * - Create tickets
 * - View tickets and messages
 */

// ─── SUPPORT PAGES ──────────────────────────────────

async function renderSupportPage(slug) {
  try {
    const res = await apiFetch(`/support/pages/${slug}`);
    const page = res;

    const content = `
      <div class="page-wrapper">
        <div class="page-header" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);">
          <div class="container">
            <h1 style="color: white; margin: 0;">${page.title}</h1>
          </div>
        </div>

        <div class="container" style="max-width: 900px; margin: 40px auto; padding: 0 24px;">
          <article class="support-article">
            ${page.content}
          </article>
        </div>
      </div>
    `;

    const main = qs(".main-content");
    main.innerHTML = content;
    window.scrollTo(0, 0);
  } catch (err) {
    showError("Không thể tải trang này");
  }
}

// ─── SUPPORT HOME (Contact + Create Ticket) ─────────

async function renderSupportHome() {
  const config = await apiFetch("/support/config");

  const html = `
    <div class="page-wrapper">
      <div class="page-header" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);">
        <div class="container">
          <h1 style="color: white; margin: 0;">Hỗ trợ & Liên hệ</h1>
        </div>
      </div>

      <div class="container" style="max-width: 1200px; margin: 40px auto; padding: 0 24px;">
        <div class="support-grid">
          <!-- Contact Info -->
          <div class="contact-card">
            <h2>${ico.mail} Thông tin liên hệ</h2>
            <div class="contact-info">
              <div class="info-item">
                <i class="fa-solid fa-envelope"></i>
                <div>
                  <strong>Email</strong>
                  <p><a href="mailto:${config.contact_email}">${config.contact_email}</a></p>
                </div>
              </div>
              <div class="info-item">
                <i class="fa-solid fa-phone"></i>
                <div>
                  <strong>Điện thoại</strong>
                  <p><a href="tel:${config.contact_phone}">${config.contact_phone}</a></p>
                </div>
              </div>
              <div class="info-item">
                <i class="fa-solid fa-location-dot"></i>
                <div>
                  <strong>Địa chỉ</strong>
                  <p>${config.contact_address}</p>
                </div>
              </div>
              <div class="info-item">
                <i class="fa-solid fa-clock"></i>
                <div>
                  <strong>Giờ làm việc</strong>
                  <p>${config.working_hours}</p>
                </div>
              </div>
            </div>
            <div style="margin-top: 24px;">
              <a href="${config.contact_facebook}" target="_blank" class="btn btn-primary">
                <i class="fa-brands fa-facebook-f"></i> Theo dõi Facebook
              </a>
            </div>
          </div>

          <!-- Create Ticket Form -->
          <div class="ticket-form-card">
            <h2>${ico.flag} Tạo yêu cầu hỗ trợ</h2>
            <form id="create-ticket-form">
              <div class="form-group">
                <label>Họ tên <span class="required">*</span></label>
                <input type="text" name="name" required class="form-control">
              </div>
              <div class="form-group">
                <label>Email <span class="required">*</span></label>
                <input type="email" name="email" required class="form-control">
              </div>
              <div class="form-group">
                <label>Danh mục <span class="required">*</span></label>
                <select name="category" required class="form-control">
                  <option value="">-- Chọn danh mục --</option>
                  <option value="order">Vấn đề đơn hàng</option>
                  <option value="product">Vấn đề sản phẩm</option>
                  <option value="payment">Vấn đề thanh toán</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div class="form-group">
                <label>Độ ưu tiên <span class="required">*</span></label>
                <select name="priority" required class="form-control">
                  <option value="normal">Bình thường</option>
                  <option value="high">Cao</option>
                  <option value="urgent">Khẩn cấp</option>
                </select>
              </div>
              <div class="form-group">
                <label>Tiêu đề <span class="required">*</span></label>
                <input type="text" name="subject" required class="form-control" placeholder="Mô tả ngắn vấn đề">
              </div>
              <div class="form-group">
                <label>Mô tả chi tiết <span class="required">*</span></label>
                <textarea name="description" required class="form-control" rows="5" placeholder="Mô tả chi tiết vấn đề của bạn..."></textarea>
              </div>
              <button type="submit" class="btn btn-primary">Gửi yêu cầu</button>
            </form>
          </div>
        </div>

        <!-- Quick Links -->
        <div class="support-links" style="margin-top: 60px;">
          <h2>Các trang hữu ích</h2>
          <div class="links-grid">
            <a href="#/support/warranty" class="link-card">
              <i class="fa-solid fa-shield"></i>
              <h3>Chính sách bảo hành</h3>
              <p>Tìm hiểu về chính sách bảo hành của chúng tôi</p>
            </a>
            <a href="#/support/purchase-guide" class="link-card">
              <i class="fa-solid fa-book"></i>
              <h3>Hướng dẫn mua hàng</h3>
              <p>Các bước mua hàng dễ dàng trên ShopKey</p>
            </a>
            <a href="#/support/faq" class="link-card">
              <i class="fa-solid fa-circle-question"></i>
              <h3>Câu hỏi thường gặp</h3>
              <p>Trả lời các câu hỏi phổ biến</p>
            </a>
            <a href="#/support/privacy" class="link-card">
              <i class="fa-solid fa-lock"></i>
              <h3>Chính sách bảo mật</h3>
              <p>Bảo vệ thông tin của bạn</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  const main = qs(".main-content");
  main.innerHTML = html;
  window.scrollTo(0, 0);

  // Handle form submission
  const form = qs("#create-ticket-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
      const res = await apiFetch("/support/tickets", {
        method: "POST",
        body: JSON.stringify(data)
      });
      toast(`Tạo yêu cầu thành công! Mã: ${res.ticket_number}`, "success");
      form.reset();
      setTimeout(() => {
        window.location.hash = `#/support/tickets/${res.ticket_id}`;
      }, 1500);
    } catch (err) {
      toast("Lỗi tạo yêu cầu", "error");
    }
  };
}

// ─── USER TICKETS ───────────────────────────────────

async function renderUserTickets() {
  try {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      showError("Vui lòng đăng nhập để xem yêu cầu hỗ trợ");
      window.location.hash = "#/login";
      return;
    }

    const tickets = await apiFetch(`/support/tickets?user_id=${userId}`);

    const html = `
      <div class="page-wrapper">
        <div class="page-header">
          <h1>Yêu cầu hỗ trợ của bạn</h1>
        </div>

        <div class="container" style="max-width: 1000px; margin: 40px auto; padding: 0 24px;">
          ${tickets.length === 0 ? `
            <div class="empty-state">
              <i class="fa-solid fa-inbox" style="font-size: 48px; color: var(--text-muted); margin-bottom: 16px;"></i>
              <p>Chưa có yêu cầu hỗ trợ nào</p>
              <a href="#/support" class="btn btn-primary">Tạo yêu cầu mới</a>
            </div>
          ` : `
            <div class="tickets-list">
              ${tickets.map(t => `
                <div class="ticket-item">
                  <div class="ticket-header">
                    <div class="ticket-info">
                      <a href="#/support/tickets/${t.id}" class="ticket-number">${t.ticket_number}</a>
                      <div class="ticket-subject">${t.subject}</div>
                      <div class="ticket-meta">
                        <span class="badge status-${t.status}">${statusLabel(t.status)}</span>
                        <span class="badge priority-${t.priority}">${priorityLabel(t.priority)}</span>
                        <span style="color: var(--text-muted); font-size: 13px;">Tạo: ${new Date(t.created_at).toLocaleDateString("vi-VN")}</span>
                      </div>
                    </div>
                    <div class="ticket-actions">
                      <a href="#/support/tickets/${t.id}" class="btn btn-sm btn-ghost">Xem chi tiết</a>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          `}
        </div>
      </div>
    `;

    const main = qs(".main-content");
    main.innerHTML = html;
    window.scrollTo(0, 0);
  } catch (err) {
    showError("Không thể tải danh sách yêu cầu");
  }
}

// ─── TICKET DETAIL + MESSAGES ──────────────────────

async function renderTicketDetail(ticketId) {
  try {
    const userId = localStorage.getItem("userId");
    const res = await apiFetch(`/support/tickets/${ticketId}?user_id=${userId}`);
    const { ticket, messages } = res;

    const html = `
      <div class="page-wrapper">
        <div class="container" style="max-width: 900px; margin: 40px auto; padding: 0 24px;">
          <div style="margin-bottom: 24px;">
            <a href="#/support/tickets" class="back-link">${ico.arrow} Quay lại danh sách</a>
          </div>

          <!-- Ticket Header -->
          <div class="ticket-detail-header">
            <div>
              <h1>${ticket.subject}</h1>
              <div class="ticket-meta">
                <span class="meta-item">Mã: <strong>${ticket.ticket_number}</strong></span>
                <span class="badge status-${ticket.status}">${statusLabel(ticket.status)}</span>
                <span class="badge priority-${ticket.priority}">${priorityLabel(ticket.priority)}</span>
              </div>
            </div>
          </div>

          <!-- Messages -->
          <div class="messages-container" id="messages-list">
            ${messages.map(msg => `
              <div class="message-item ${msg.sender_type}">
                <div class="message-header">
                  <strong>${msg.sender_name}</strong>
                  <span class="message-type">${msg.sender_type === 'admin' ? 'Phòng hỗ trợ' : 'Bạn'}</span>
                  <span class="message-time">${new Date(msg.created_at).toLocaleString("vi-VN")}</span>
                </div>
                <div class="message-body">${msg.message}</div>
              </div>
            `).join("")}
          </div>

          <!-- Add Reply -->
          ${ticket.status !== "closed" ? `
            <div class="reply-form">
              <h3>Phản hồi</h3>
              <form id="reply-form">
                <textarea name="message" required class="form-control" rows="4" placeholder="Nhập tin nhắn của bạn..."></textarea>
                <button type="submit" class="btn btn-primary" style="margin-top: 12px;">Gửi phản hồi</button>
              </form>
            </div>
          ` : `
            <div class="alert alert-info">Yêu cầu này đã được đóng</div>
          `}
        </div>
      </div>
    `;

    const main = qs(".main-content");
    main.innerHTML = html;
    window.scrollTo(0, 0);

    // Handle reply
    if (ticket.status !== "closed") {
      const form = qs("#reply-form");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const message = form.querySelector('[name="message"]').value;
        try {
          await apiFetch(`/support/tickets/${ticketId}/messages`, {
            method: "POST",
            body: JSON.stringify({
              sender_name: localStorage.getItem("userName") || "Khách hàng",
              sender_type: "user",
              message: message
            })
          });
          toast("Gửi phản hồi thành công", "success");
          form.reset();
          // Reload messages
          renderTicketDetail(ticketId);
        } catch (err) {
          toast("Lỗi gửi phản hồi", "error");
        }
      };
    }
  } catch (err) {
    showError("Không thể tải chi tiết yêu cầu");
  }
}

// ─── HELPER FUNCTIONS ──────────────────────────────

function statusLabel(status) {
  const labels = {
    open: "Đang mở",
    in_progress: "Đang xử lý",
    resolved: "Đã giải quyết",
    closed: "Đã đóng"
  };
  return labels[status] || status;
}

function priorityLabel(priority) {
  const labels = {
    low: "Thấp",
    normal: "Bình thường",
    high: "Cao",
    urgent: "Khẩn cấp"
  };
  return labels[priority] || priority;
}

function showError(msg) {
  const main = qs(".main-content");
  main.innerHTML = `
    <div class="container" style="text-align: center; padding: 60px 24px;">
      <i class="fa-solid fa-exclamation-triangle" style="font-size: 48px; color: var(--red); margin-bottom: 16px;"></i>
      <p>${msg}</p>
    </div>
  `;
}
