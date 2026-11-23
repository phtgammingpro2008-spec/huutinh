# Xưởng dép — nhận đơn và báo giá dép theo ảnh (giai đoạn 1)

Web app chạy trên Cloudflare Workers + D1 + R2. Chủ xưởng biến ảnh khách gửi qua Zalo/Messenger thành đơn hàng rõ ràng (chạm gắn số từng mẫu, dải size, vật liệu, máy tự cộng), báo giá VND/USD, gửi link cho khách đồng ý (Việt, Anh, Khmer), lưu thư viện mẫu và in phiếu làm hàng.

- Thiết kế: `docs/superpowers/specs/2026-11-22-dat-hang-dep-giai-doan-1-design.md`
- Kế hoạch: `docs/superpowers/plans/2026-11-22-dat-hang-dep-giai-doan-1.md`
- Triển khai, cài lên iPhone, sao lưu: `docs/TRIEN-KHAI.md`

## Lệnh

| Lệnh | Việc |
|---|---|
| `bun install` | cài thư viện |
| `bun run dev` | build rồi chạy thử ở `http://127.0.0.1:8787` |
| `bun run test` | kiểm thử nghiệp vụ và API |
| `bun run e2e` | kiểm thử giao diện bằng Chromium cỡ iPhone |
| `bun run build` | tạo `dist/worker.js` + `dist/schema.sql` |
| `bun run deploy` | build và đưa lên Cloudflare bằng wrangler |
| `bun run release` | đóng gói zip (mã nguồn + dist) để cất giữ |

## Cấu trúc

- `src/shared` — nghiệp vụ dùng chung (tính tổng đôi/tiền, tiền tệ, trạng thái, từ điển vi/en/km).
- `src/worker` — máy chủ (router, đăng nhập, SQL cho D1, ảnh trên R2, trang báo giá công khai).
- `src/client/admin` — app quản lý cho chủ xưởng (React). `src/client/quote` — trang báo giá cho khách.
- `dev/` — chạy thử bằng Bun với SQLite (thay D1) và thư mục (thay R2).
- `test/unit`, `test/e2e` — kiểm thử.
