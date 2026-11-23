# HLUXURY · Xưởng dép — trang bán hàng, đặt hàng và báo giá

Web app chạy trên Cloudflare Workers + D1 + R2.

- **Trang chủ công khai** (`/`): poster, bộ sưu tập, sản phẩm, 3 thứ tiếng (Việt, Anh, Khmer), sáng/tối. Khách chưa đăng nhập xem được một phần; bấm đặt hàng thì mở cửa sổ đăng ký/đăng nhập.
- **Khu khách** (`/tai-khoan`): tự đăng ký (số điện thoại và email không trùng), đặt hàng từ sản phẩm (chọn màu, size), từ thư viện mẫu dùng chung hoặc từ ảnh riêng; xem báo giá, đồng ý, hủy khi chưa đồng ý; hồ sơ, đổi mật khẩu, lấy lại mật khẩu qua email.
- **Khu quản lý** (`/quan-ly`): biến ảnh khách gửi thành đơn (chạm gắn số từng mẫu, dải size, vật liệu, máy tự cộng), báo giá VND/USD, link báo giá cho khách, thư viện mẫu, phiếu làm hàng; quản lý người dùng và nội dung trang web.

Tài liệu:
- Giai đoạn 2a: thiết kế `docs/superpowers/specs/2026-11-23-web-dat-hang-khach-design.md`, kế hoạch `docs/superpowers/plans/2026-11-23-web-dat-hang-khach.md`
- Giai đoạn 1: `docs/superpowers/specs/2026-11-22-dat-hang-dep-giai-doan-1-design.md`
- Triển khai, tên miền, email, cài lên iPhone, sao lưu: `docs/TRIEN-KHAI.md`

## Lệnh

| Lệnh | Việc |
|---|---|
| `bun install` | cài thư viện |
| `bun run dev` | build rồi chạy thử ở `http://127.0.0.1:8787` |
| `bun run test` | kiểm thử nghiệp vụ và API |
| `bun run e2e` | kiểm thử giao diện bằng Chromium cỡ iPhone |
| `bun run typecheck` | kiểm tra kiểu TypeScript |
| `bun run build` | tạo `dist/worker.js` + `dist/schema.sql` |
| `bun run deploy` | build và đưa lên Cloudflare bằng wrangler |
| `bun run release` | đóng gói zip (mã nguồn + dist) để cất giữ |

## Cấu trúc

- `src/shared` — nghiệp vụ dùng chung (tổng đôi/tiền, tiền tệ, trạng thái, số điện thoại, từ điển vi/en/km).
- `src/worker` — máy chủ: router, phân quyền (admin/khách), SQL cho D1, ảnh trên R2, email (Resend), giới hạn chống phá.
- `src/worker/public` — trang công khai dựng sẵn HTML phía máy chủ (để Google đọc được), `robots.txt`, `sitemap.xml`.
- `src/client/admin` — app quản lý. `src/client/customer` — đăng nhập/đăng ký và khu khách. `src/client/site` — phần tương tác nhỏ của trang công khai. `src/client/quote` — trang báo giá.
- `schema/schema.sql` + `migrations/` — cấu trúc cơ sở dữ liệu (file migration mới chạy tự động khi triển khai).
- `dev/` — chạy thử bằng Bun với SQLite (thay D1) và thư mục (thay R2).
- `test/unit`, `test/e2e` — kiểm thử.
