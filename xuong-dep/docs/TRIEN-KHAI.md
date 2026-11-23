# Triển khai Xưởng dép lên Cloudflare

Tài liệu này hướng dẫn đưa web lên mạng bằng gói miễn phí của Cloudflare, cách cài lên iPhone, và cách sao lưu dữ liệu.

## Cần chuẩn bị

- Một tài khoản Cloudflare (miễn phí): <https://dash.cloudflare.com/sign-up>.
- **Bật R2** một lần trong trang quản trị: mục **R2 Object Storage → Purchase R2 Plan / Enable**. Cloudflare yêu cầu thêm thẻ thanh toán để bật R2, nhưng gói miễn phí có 10 GB, dưới mức đó không bị tính tiền.
- Hai file đã build sẵn trong thư mục `dist/`: `worker.js` và `schema.sql` (chạy `bun run build` để tạo lại).

## Cách 1: dùng lệnh `wrangler` (nhanh nhất)

Chạy trong thư mục `xuong-dep`, máy đã cài Bun:

```bash
bun install
```

```bash
npx wrangler login
```

```bash
npx wrangler d1 create xuong-dep
```

Lệnh trên in ra `database_id`. Mở `wrangler.toml`, dán id đó vào dòng `database_id = "..."`.

```bash
npx wrangler r2 bucket create xuong-dep-anh
```

```bash
npx wrangler d1 execute xuong-dep --remote --file=schema/schema.sql
```

```bash
bun run deploy
```

Lệnh cuối build lại và đưa web lên. Wrangler in ra địa chỉ dạng `https://xuong-dep.<tên-tài-khoản>.workers.dev`.

Lần sau sửa code chỉ cần chạy lại `bun run deploy`. Dữ liệu (D1) và ảnh (R2) không bị ảnh hưởng.

## Cách 2: dán tay trong trang quản trị Cloudflare (không cần cài gì)

1. **Tạo cơ sở dữ liệu:** Workers & Pages → D1 SQL Database → Create → tên `xuong-dep`. Mở database vừa tạo → tab **Console** → dán toàn bộ nội dung `dist/schema.sql` → Execute.
2. **Tạo nơi lưu ảnh:** R2 Object Storage → Create bucket → tên `xuong-dep-anh`.
3. **Tạo Worker:** Workers & Pages → Create → Create Worker → đặt tên `xuong-dep` → Deploy → **Edit code**. Xóa code mẫu, dán toàn bộ nội dung `dist/worker.js` → Deploy.
4. **Gắn dữ liệu vào Worker:** vào Worker `xuong-dep` → Settings → **Bindings** → Add:
   - D1 database: tên biến `DB`, chọn `xuong-dep`.
   - R2 bucket: tên biến `IMAGES`, chọn `xuong-dep-anh`.
5. (Không bắt buộc) Settings → Variables → thêm `APP_URL` = địa chỉ web, ví dụ `https://xuong-dep.ten-cua-anh.workers.dev`. Link báo giá sẽ dùng địa chỉ này.
6. Mở địa chỉ `https://xuong-dep.<tên>.workers.dev`.

## Lần đầu mở web

- Trang hiện **"Tạo tài khoản quản trị"**: nhập tên đăng nhập và mật khẩu (ít nhất 8 ký tự). Chỉ tạo được một lần; ai mở sau đó sẽ chỉ thấy màn đăng nhập.
- Nên mở web và tạo tài khoản **ngay sau khi triển khai**, để không ai khác kịp tạo trước.
- Vào **Cài đặt** để thêm vật liệu (Đế, Quai, Kiểu) và kiểm tra dải size mặc định (Nam 39–44, Nữ 35–40).

## Cài lên màn hình iPhone

1. Mở địa chỉ web bằng **Safari**.
2. Bấm nút **Chia sẻ** (hình vuông có mũi tên) → **Thêm vào MH chính**.
3. Biểu tượng chiếc dép xuất hiện trên màn hình chính, mở ra như một ứng dụng. Phiên đăng nhập giữ 90 ngày.

Android (Chrome): menu ⋮ → **Thêm vào màn hình chính**.

## Sao lưu dữ liệu

- **Trong web:** Cài đặt → **Tải bản sao lưu**. File JSON chứa toàn bộ khách, đơn, báo giá, tiền nhận, thư viện mẫu (không chứa mật khẩu). Nên tải mỗi tuần và cất vào Google Drive.
- **D1 tự khôi phục được 30 ngày** (Time Travel, có sẵn). Khi lỡ xóa nhầm: `npx wrangler d1 time-travel restore xuong-dep --timestamp=<thời điểm>`.
- **Ảnh** nằm trong R2 `xuong-dep-anh`. Muốn tải hết ảnh về máy có thể dùng `rclone` hoặc trang quản trị R2.

## Chạy thử trên máy (cho người code)

```bash
bun install
```

```bash
bun run dev
```

Mở `http://127.0.0.1:8787`. Dữ liệu thử nằm trong thư mục `dev-data/`.

Kiểm thử:

```bash
bun run test
```

```bash
bun run e2e
```

Chạy thử trên chính môi trường của Cloudflare (workerd) ở máy:

```bash
bun run build && npx wrangler d1 execute xuong-dep --local --file=schema/schema.sql && npx wrangler dev --local
```

Bộ test e2e chạy được với một địa chỉ có sẵn, ví dụ bản vừa triển khai (dùng dữ liệu thật, nên chỉ chạy trên bản thử):

```bash
E2E_BASE_URL=http://127.0.0.1:8787 bun test test/e2e/dist-smoke.test.ts --timeout 30000
```
