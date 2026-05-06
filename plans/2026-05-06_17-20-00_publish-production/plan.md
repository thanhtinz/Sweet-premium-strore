# Context
Chuẩn bị project Digital Product Shop sẵn sàng để publish production trên Workshop. Mục tiêu là rà toàn bộ luồng khởi động, cấu hình deploy, phụ thuộc backend, kết nối database, static asset serving và các lỗi boot-time có thể làm app không chạy sau khi publish.

# Scope & Non-Goals
## Scope
- Xác nhận entrypoint publish và cấu hình `.workshop/deploy.json`
- Rà các điểm boot-time trong `app.py`, `routes.py`, `db/__init__.py`, `db/init_db.py` và các router import trực tiếp từ startup
- Kiểm tra các biến môi trường bắt buộc cho production boot
- Kiểm tra cách phục vụ frontend tĩnh từ FastAPI và các phụ thuộc liên quan
- Xác định các lỗi rõ ràng có thể làm deploy fail hoặc app crash ngay khi start

## Non-Goals
- Không thêm tính năng mới không liên quan đến publish
- Không tối ưu UI/UX ngoài phạm vi deploy readiness
- Không thay đổi kiến trúc lớn nếu chưa cần thiết

# Implementation Plan
1. Kiểm tra cấu hình publish hiện có trong `.workshop/deploy.json` và đối chiếu với entrypoint thật ở `app.py`.
2. Rà chuỗi khởi động backend qua `routes.py`, `db/init_db.py`, `db/__init__.py` để xác định các dependency bắt buộc khi import app.
3. Kiểm tra các router được import từ `routes.py` để tìm lỗi import/model/config có thể làm app crash ở boot-time.
4. Kiểm tra static serving trong `routes.py` và các file bắt buộc trong `static/` mà SPA fallback đang phụ thuộc.
5. Tổng hợp danh sách thay đổi cần thực hiện để app publish production ổn định, kèm cách verify sau khi build mode bắt đầu.

# Verification
- Import được ASGI entry `app:asgi` mà không lỗi cấu hình thiếu file/module
- Các biến môi trường bắt buộc cho boot được xác định rõ
- Static directory và template entry tồn tại, đủ để render SPA fallback
- Có checklist verify sau sửa: start app, gọi `/api/health`, tải trang chủ, kiểm tra asset chính và kết nối DB