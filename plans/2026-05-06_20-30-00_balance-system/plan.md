# Hệ thống Nạp Số Dư (Balance/Wallet)

## Context
Thêm hệ thống ví/số dư cho shop. User nạp tiền qua PayOS, thanh toán đơn hàng bằng số dư. Affiliate rút hoa hồng về số dư.

## Scope & Quyết định
- Checkout **chỉ 2 cổng**: PayOS (QR ngân hàng) + Số dư — **bỏ** "Chuyển khoản thủ công"
- Anti-cheat: row-level lock, server-side validate, audit trail
- Affiliate: thêm nút "Rút về số dư" — chuyển hoa hồng → balance
- Nạp tiền qua PayOS (tạo link riêng cho topup)

### Non-Goals
- Số dư âm / nợ
- Rút tiền ra ngoài (chỉ rút affiliate → số dư nội bộ)

---

## Implementation Plan

### Phase 1: Database
**File:** `db/models.py`

1. Thêm cột `balance` vào `User`:
   ```python
   balance = Column(Numeric(12, 2), default=0, server_default="0", nullable=False)
   ```

2. Thêm model `BalanceTransaction`:
   ```python
   class BalanceTransaction(Base):
       __tablename__ = "balance_transactions"
       id = Column(Integer, primary_key=True)
       user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
       amount = Column(Numeric(12, 2), nullable=False)  # +nạp, -trừ
       balance_after = Column(Numeric(12, 2), nullable=False)
       type = Column(String(30))  # topup | purchase | affiliate_withdraw | admin_adjust | refund
       status = Column(String(20), default="completed")  # pending | completed | failed
       reference = Column(String(255))  # order_code, payos txn, affiliate_id
       description = Column(Text)
       ip_address = Column(String(50))  # anti-cheat: log IP
       created_at = Column(DateTime(timezone=True), default=now_utc)
   ```

### Phase 2: Balance API (anti-cheat)
**File:** `api/balance.py` (mới)

**Anti-cheat measures:**
- **Row-level locking**: `SELECT ... FOR UPDATE` khi đọc/ghi balance — tránh race condition
- **Server-side amount validation**: chỉ accept topup 10K–10M VNĐ, step 1000
- **Balance audit**: mỗi transaction lưu `balance_after` = balance thực tế SAU giao dịch
- **Verify tổng**: sum(transactions) phải == user.balance (audit endpoint cho admin)
- **IP logging**: ghi IP vào mỗi transaction
- **Webhook signature verify**: PayOS webhook phải đúng checksum

Endpoints:
- `GET /balance` — Số dư hiện tại (auth required)
- `GET /balance/history?page=1&limit=20` — Lịch sử GD
- `POST /balance/topup` — Tạo link nạp qua PayOS `{amount}`
  - Validate: 10,000 ≤ amount ≤ 10,000,000, step 1000
  - Tạo BalanceTransaction(status="pending", type="topup")
  - Gọi PayOS createPaymentLink
  - Return `{payment_url, transaction_id}`
- `POST /balance/webhook` — PayOS callback nạp thành công
  - Verify signature
  - `SELECT user FOR UPDATE` → cộng balance → update transaction → commit
- `POST /balance/affiliate-withdraw` — Rút hoa hồng affiliate về số dư
  - Check affiliate earnings - total_paid > 0
  - `SELECT user FOR UPDATE` → cộng balance
  - Tạo BalanceTransaction(type="affiliate_withdraw")
  - Update affiliate.total_paid
- `GET /admin/balance/users` — Danh sách user + balance (admin)
- `POST /admin/balance/adjust` — Nạp/trừ thủ công `{user_id, amount, description}`
- `GET /admin/balance/audit` — Verify tổng transactions == balance

**File:** `routes.py` — include balance_router

### Phase 3: Order Integration
**File:** `api/orders.py` — sửa `create_order`

Khi `payment_method == "balance"`:
```python
# Row-level lock user
user = db.query(User).filter_by(id=user_id).with_for_update().first()
if user.balance < total:
    raise HTTPException(400, "Số dư không đủ")
user.balance -= total
# Tạo BalanceTransaction(type="purchase", amount=-total)
order.status = "paid"  # Đã thanh toán ngay
# Auto-deliver nếu auto package
```

Cũng bỏ `bank_transfer` option — `payment_method` chỉ accept: `payos` | `balance`

### Phase 4: Checkout UI
**File:** `static/storefront.js`

`renderStep2()`:
- **Bỏ** option "Chuyển khoản ngân hàng"
- **Thêm** option "Số dư" trước PayOS:
  ```
  [Số dư tài khoản]  ₫xxx,xxx  ✓
  [PayOS - QR Ngân hàng]           ○
  ```
  - Nếu balance < grandTotal: disable + "Số dư không đủ · Nạp thêm" link
  - Fetch balance từ `/balance` khi render

`renderStep3()`:
- Update methodLabel cho "balance": "Thanh toán bằng số dư"
- Khi pay bằng balance: không cần redirect PayOS, chỉ tạo order → done

### Phase 5: Profile UI
**File:** `static/profile.js`

Thêm card **"Số dư tài khoản"** ngay sau profile info card:
- Hiện số dư lớn + nút **"Nạp tiền"**
- Click nạp → modal: nhập số tiền (preset: 50K, 100K, 200K, 500K, 1M) → gọi topup API → mở PayOS
- Bảng 5 giao dịch gần nhất + link "Xem tất cả"
- Nếu user có affiliate: hiện **"Rút hoa hồng"** button → gọi affiliate-withdraw

### Phase 6: Admin Balance
**File:** `static/admin.js` + `static/app.js`

- Route `#/admin/balance` + sidebar nav item (nhóm Cửa hàng)
- Bảng user: email, số dư, tổng nạp, tổng chi
- Nút "Điều chỉnh" → modal nhập +/- amount + lý do
- Tab lịch sử GD toàn hệ thống

---

## Files to Modify/Create
| File | Action |
|------|--------|
| `db/models.py` | Add `balance` to User, add `BalanceTransaction` |
| `api/balance.py` | **NEW** — Balance + topup + withdraw + admin |
| `api/orders.py` | Add balance payment, remove bank_transfer |
| `routes.py` | Include balance_router |
| `static/storefront.js` | Checkout: 2 methods only (balance + payos) |
| `static/profile.js` | Balance card + topup + affiliate withdraw |
| `static/admin.js` | Admin balance management page |
| `static/app.js` | Add `#/admin/balance` route |
| `static/styles.css` | Balance card, topup modal styles |

## Anti-Cheat Summary
| Threat | Protection |
|--------|------------|
| Race condition (double spend) | `SELECT ... FOR UPDATE` row lock |
| Fake topup | PayOS webhook signature verify |
| Balance tampering | Server-side only, no client balance write |
| Audit trail | Every change = BalanceTransaction + IP log |
| Integrity check | Admin audit: sum(txn) == user.balance |
| Amount manipulation | Server validates amount range + step |

## Verification
1. **Nạp tiền**: Profile → Nạp 100K → PayOS → callback → balance +100K
2. **Mua bằng số dư**: Checkout → Số dư → tạo đơn → balance trừ → order paid
3. **Số dư không đủ**: Checkout → Số dư disabled + "Nạp thêm"
4. **Race condition**: 2 request đồng thời → chỉ 1 thành công
5. **Affiliate rút**: Profile → Rút hoa hồng → balance tăng, affiliate.total_paid tăng
6. **Admin adjust**: Admin → điều chỉnh → balance + transaction log
7. **Audit**: Admin audit → tổng transactions khớp balance
