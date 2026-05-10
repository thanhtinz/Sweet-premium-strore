// ═══════════════════════════════════════════════════════════════
//  API DOCUMENTATION PAGE
// ═══════════════════════════════════════════════════════════════

async function renderApiDocs(view) {
  const baseUrl = location.origin;

  view.innerHTML = `
    <div class="api-docs-container">
      <div class="api-docs-sidebar">
        <div class="api-docs-sidebar-header">
          <i class="fa-solid fa-book" style="color:var(--primary); margin-right:8px;"></i>
          API Reference
        </div>
        
        <div class="api-docs-nav-group">Bắt đầu</div>
        <a href="/api-docs" data-doc-section="auth" class="api-docs-nav-item active"><i class="fa-solid fa-key" style="width:16px;text-align:center;margin-right:6px;opacity:0.6;"></i>Xác thực</a>
        <a href="/api-docs" data-doc-section="errors" class="api-docs-nav-item"><i class="fa-solid fa-circle-exclamation" style="width:16px;text-align:center;margin-right:6px;opacity:0.6;"></i>Mã lỗi</a>
        
        <div class="api-docs-nav-group">Endpoints</div>
        <a href="/api-docs" data-doc-section="products" class="api-docs-nav-item"><i class="fa-solid fa-box" style="width:16px;text-align:center;margin-right:6px;opacity:0.6;"></i>Sản phẩm</a>
        <a href="/api-docs" data-doc-section="categories" class="api-docs-nav-item"><i class="fa-solid fa-tags" style="width:16px;text-align:center;margin-right:6px;opacity:0.6;"></i>Danh mục</a>
        <a href="/api-docs" data-doc-section="orders" class="api-docs-nav-item"><i class="fa-solid fa-cart-shopping" style="width:16px;text-align:center;margin-right:6px;opacity:0.6;"></i>Đơn hàng</a>
        <a href="/api-docs" data-doc-section="search" class="api-docs-nav-item"><i class="fa-solid fa-magnifying-glass" style="width:16px;text-align:center;margin-right:6px;opacity:0.6;"></i>Tìm kiếm</a>
      </div>

      <div class="api-docs-main">
        <div class="api-docs-header">
          <h1>Tài liệu REST API</h1>
          <p>Tích hợp hệ thống với các ứng dụng bên thứ ba. Tất cả endpoints đều trả về dữ liệu định dạng JSON.</p>
        </div>

        <!-- Auth Section -->
        <div class="api-docs-section active" data-doc="auth">
          <h2>Xác thực (Authentication)</h2>
          <p>Sử dụng API Key để xác thực các request. Bạn có thể tạo key mới tại <a href="/profile">trang Profile → API Keys</a>.</p>

          <h3>Header</h3>
          <div class="api-code-block">
            <div class="api-code-label">Request Header</div>
            <pre><code>X-API-Key: sk_live_your_api_key_here</code></pre>
          </div>

          <h3>Ví dụ cURL</h3>
          <div class="api-code-block">
            <div class="api-code-label">cURL</div>
            <pre><code>curl -H "X-API-Key: sk_live_abc123..." \\
    ${esc(baseUrl)}/api/products/</code></pre>
          </div>

          <h3>Ví dụ Python</h3>
          <div class="api-code-block">
            <div class="api-code-label">Python</div>
            <pre><code>import requests

API_KEY = "sk_live_your_key"
BASE = "${esc(baseUrl)}/api"

headers = {"X-API-Key": API_KEY}
products = requests.get(f"{BASE}/products/", headers=headers)
print(products.json())</code></pre>
          </div>

          <h3>Ví dụ JavaScript</h3>
          <div class="api-code-block">
            <div class="api-code-label">JavaScript (fetch)</div>
            <pre><code>const API_KEY = "sk_live_your_key";
const BASE = "${esc(baseUrl)}/api";

const res = await fetch(\`\${BASE}/products/\`, {
  headers: { "X-API-Key": API_KEY }
});
const data = await res.json();</code></pre>
        </div>

        <div class="api-note">
          <strong>Lưu ý bảo mật:</strong> Không chia sẻ API key. Nếu key bị lộ, hãy thu hồi ngay tại Profile và tạo key mới.
        </div>
      </div>

      <!-- Products Section -->
      <div class="api-docs-section" data-doc="products">
        <h2>Sản phẩm (Products)</h2>

        <div class="api-endpoint">
          <div class="api-method get">GET</div>
          <code>/api/products/</code>
          <span class="api-badge">Public</span>
        </div>
        <p>Lấy danh sách sản phẩm. Hỗ trợ phân trang và lọc.</p>
        <h4>Query Parameters</h4>
        <table class="api-params-table">
          <tr><th>Param</th><th>Type</th><th>Mô tả</th></tr>
          <tr><td><code>page</code></td><td>int</td><td>Trang (mặc định: 1)</td></tr>
          <tr><td><code>limit</code></td><td>int</td><td>Số item/trang (mặc định: 20, max: 100)</td></tr>
          <tr><td><code>category_id</code></td><td>int</td><td>Lọc theo danh mục</td></tr>
          <tr><td><code>sort</code></td><td>string</td><td>Sắp xếp: newest, price_asc, price_desc, popular</td></tr>
        </table>
        <div class="api-code-block">
          <div class="api-code-label">Response 200</div>
          <pre><code>{
  "items": [
    {
      "id": 1,
      "name": "Premium Account",
      "slug": "premium-account",
      "description": "Mô tả sản phẩm...",
      "price": 50000,
      "original_price": 80000,
      "image_url": "https://...",
      "category_id": 3,
      "in_stock": true,
      "stock_count": 15,
      "sold_count": 230
    }
  ],
  "total": 45,
  "page": 1,
  "pages": 3
}</code></pre>
        </div>

        <div class="api-endpoint">
          <div class="api-method get">GET</div>
          <code>/api/products/{id}</code>
          <span class="api-badge">Public</span>
        </div>
        <p>Chi tiết sản phẩm theo ID. Bao gồm danh sách gói (packages).</p>
        <div class="api-code-block">
          <div class="api-code-label">Response 200</div>
          <pre><code>{
  "id": 1,
  "name": "Premium Account",
  "description": "...",
  "price": 50000,
  "packages": [
    {
      "id": 10,
      "name": "1 tháng",
      "price": 50000,
      "stock_count": 15
    }
  ]
}</code></pre>
        </div>

        <div class="api-endpoint">
          <div class="api-method get">GET</div>
          <code>/api/products/featured?limit=12</code>
          <span class="api-badge">Public</span>
        </div>
        <p>Sản phẩm nổi bật trên trang chủ.</p>
      </div>

      <!-- Categories Section -->
      <div class="api-docs-section" data-doc="categories">
        <h2>Danh mục (Categories)</h2>

        <div class="api-endpoint">
          <div class="api-method get">GET</div>
          <code>/api/categories/</code>
          <span class="api-badge">Public</span>
        </div>
        <p>Danh sách tất cả danh mục sản phẩm.</p>
        <div class="api-code-block">
          <div class="api-code-label">Response 200</div>
          <pre><code>[
  {
    "id": 1,
    "name": "Game Keys",
    "slug": "game-keys",
    "description": "Key game bản quyền",
    "image_url": "https://...",
    "product_count": 12,
    "parent_id": null
  }
]</code></pre>
        </div>
      </div>

      <!-- Orders Section -->
      <div class="api-docs-section" data-doc="orders">
        <h2>Đơn hàng (Orders)</h2>
        <div class="api-note">Các endpoint đơn hàng yêu cầu xác thực bằng API Key hoặc JWT token.</div>

        <div class="api-endpoint">
          <div class="api-method get">GET</div>
          <code>/api/orders/my</code>
          <span class="api-badge auth">Auth Required</span>
        </div>
        <p>Danh sách đơn hàng của user hiện tại.</p>
        <div class="api-code-block">
          <div class="api-code-label">Response 200</div>
          <pre><code>{
  "items": [
    {
      "id": 42,
      "order_code": "ORD-20260509-ABCD",
      "status": "completed",
      "total_amount": 150000,
      "created_at": "2026-05-09T10:30:00Z",
      "items": [
        {
          "product_name": "Premium Account",
          "package_name": "1 tháng",
          "quantity": 1,
          "price": 150000
        }
      ]
    }
  ],
  "total": 5
}</code></pre>
        </div>

        <div class="api-endpoint">
          <div class="api-method get">GET</div>
          <code>/api/orders/{order_code}</code>
          <span class="api-badge auth">Auth Required</span>
        </div>
        <p>Chi tiết đơn hàng. Bao gồm thông tin giao hàng nếu đã hoàn thành.</p>

        <div class="api-endpoint">
          <div class="api-method post">POST</div>
          <code>/api/orders/</code>
          <span class="api-badge auth">Auth Required</span>
        </div>
        <p>Tạo đơn hàng mới.</p>
        <div class="api-code-block">
          <div class="api-code-label">Request Body</div>
          <pre><code>{
  "items": [
    {
      "package_id": 10,
      "quantity": 1
    }
  ],
  "payment_method": "balance",
  "coupon_code": "SALE20"
}</code></pre>
        </div>
        <h4>Payment Methods</h4>
        <div class="api-table-wrapper">
        <table class="api-params-table">
          <tr><th>Value</th><th>Mô tả</th></tr>
          <tr><td><code>balance</code></td><td>Thanh toán bằng số dư tài khoản</td></tr>
        </table>
        </div>
      </div>

      <!-- Search Section -->
      <div class="api-docs-section" data-doc="search">
        <h2>Tìm kiếm (Search)</h2>

        <div class="api-endpoint">
          <div class="api-method get">GET</div>
          <code>/api/search?q={keyword}</code>
          <span class="api-badge">Public</span>
        </div>
        <p>Tìm kiếm sản phẩm theo từ khoá.</p>
        <div class="api-table-wrapper">
        <table class="api-params-table">
          <tr><th>Param</th><th>Type</th><th>Mô tả</th></tr>
          <tr><td><code>q</code></td><td>string</td><td>Từ khoá tìm kiếm (bắt buộc)</td></tr>
          <tr><td><code>limit</code></td><td>int</td><td>Số kết quả (mặc định: 20)</td></tr>
        </table>
        </div>
      </div>

      <!-- Errors Section -->
      <div class="api-docs-section" data-doc="errors">
        <h2>Mã lỗi (Error Codes)</h2>
        <p>API trả về JSON với field <code>detail</code> khi có lỗi.</p>
        <div class="api-code-block">
          <div class="api-code-label">Error Response</div>
          <pre><code>{
  "detail": "Mô tả lỗi"
}</code></pre>
        </div>
        <div class="api-table-wrapper">
        <table class="api-params-table">
          <tr><th>HTTP Code</th><th>Ý nghĩa</th></tr>
          <tr><td><code>200</code></td><td>Thành công</td></tr>
          <tr><td><code>400</code></td><td>Request không hợp lệ (thiếu field, giá trị sai...)</td></tr>
          <tr><td><code>401</code></td><td>Chưa xác thực hoặc API key không hợp lệ</td></tr>
          <tr><td><code>403</code></td><td>Không có quyền truy cập</td></tr>
          <tr><td><code>404</code></td><td>Không tìm thấy resource</td></tr>
          <tr><td><code>429</code></td><td>Rate limit exceeded</td></tr>
          <tr><td><code>500</code></td><td>Lỗi server</td></tr>
        </table>
        </div>

        <h3>Rate Limiting</h3>
        <p>API giới hạn <strong>60 request/phút</strong> mỗi API key. Vượt quá sẽ trả về <code>429 Too Many Requests</code>.</p>
      </div>
      
      </div> <!-- End api-docs-main -->
    </div> <!-- End api-docs-container -->
  `;

  // Tab switching
  qsa('.api-docs-nav-item', view).forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      const section = item.dataset.docSection;
      qsa('.api-docs-nav-item', view).forEach(i => i.classList.remove('active'));
      qsa('.api-docs-section', view).forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      const target = qs(`[data-doc="${section}"]`, view);
      if (target) target.classList.add('active');
    };
  });
}
