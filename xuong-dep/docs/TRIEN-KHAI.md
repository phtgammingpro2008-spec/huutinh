# Triển khai HLUXURY (Xưởng dép) lên Cloudflare

Tài liệu này hướng dẫn đưa web lên mạng bằng gói miễn phí của Cloudflare, gắn tên miền, bật gửi email, cài lên iPhone và sao lưu dữ liệu.

## Các địa chỉ của web

| Địa chỉ | Dành cho |
|---|---|
| `/` | Trang chủ công khai HLUXURY (poster, bộ sưu tập, sản phẩm). Google tìm thấy được. |
| `/san-pham`, `/san-pham/<tên>`, `/bo-suu-tap/<mã>` | Trang sản phẩm và bộ sưu tập công khai. |
| `/dang-nhap`, `/dang-ky`, `/quen-mat-khau` | Đăng nhập (chung cho anh và khách), đăng ký, lấy lại mật khẩu. |
| `/tai-khoan` | Khu của khách: đơn của tôi, đặt hàng, thư viện mẫu, hồ sơ. |
| `/quan-ly` | Khu quản lý của anh (trước đây là `/`). Link cũ dạng `/#/orders/...` tự chuyển sang. |
| `/q/<mã>` | Link báo giá gửi qua Zalo (vẫn dùng được cho khách chưa có tài khoản). |

## Tự động đưa lên khi gộp code (đang dùng)

Worker `huutinh` trên Cloudflare đã nối với GitHub (Workers Builds). Mỗi lần gộp vào nhánh `main`, Cloudflare tự build và chạy lệnh triển khai:

```bash
npx wrangler d1 migrations apply xuong-dep --remote && npx wrangler deploy
```

Lệnh đầu cập nhật cơ sở dữ liệu theo các file trong `migrations/` (chỉ chạy file chưa chạy), lệnh sau đưa code mới lên. Xem nhật ký build ở Workers & Pages → `huutinh` → Deployments.

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
npx wrangler d1 migrations apply xuong-dep --remote
```

```bash
bun run deploy
```

Lệnh cuối build lại và đưa web lên. Wrangler in ra địa chỉ dạng `https://xuong-dep.<tên-tài-khoản>.workers.dev`.

Lần sau sửa code: chạy `npx wrangler d1 migrations apply xuong-dep --remote` (nếu có file mới trong `migrations/`) rồi `bun run deploy`. Dữ liệu (D1) và ảnh (R2) không bị mất.

## Cách 2: dán tay trong trang quản trị Cloudflare (không cần cài gì)

1. **Tạo cơ sở dữ liệu:** Workers & Pages → D1 SQL Database → Create → tên `xuong-dep`. Mở database vừa tạo → tab **Console** → dán toàn bộ nội dung `dist/schema.sql` → Execute. Sau đó dán lần lượt từng file trong thư mục `migrations/` (theo số thứ tự) → Execute.
2. **Tạo nơi lưu ảnh:** R2 Object Storage → Create bucket → tên `xuong-dep-anh`.
3. **Tạo Worker:** Workers & Pages → Create → Create Worker → đặt tên `xuong-dep` → Deploy → **Edit code**. Xóa code mẫu, dán toàn bộ nội dung `dist/worker.js` → Deploy.
4. **Gắn dữ liệu vào Worker:** vào Worker `xuong-dep` → Settings → **Bindings** → Add:
   - D1 database: tên biến `DB`, chọn `xuong-dep`.
   - R2 bucket: tên biến `IMAGES`, chọn `xuong-dep-anh`.
5. (Không bắt buộc) Settings → Variables → thêm `APP_URL` = địa chỉ web, ví dụ `https://xuong-dep.ten-cua-anh.workers.dev`. Link báo giá sẽ dùng địa chỉ này.
6. Mở địa chỉ `https://xuong-dep.<tên>.workers.dev`.

## Lần đầu mở web

- Mở `/quan-ly`. Trang hiện **"Tạo tài khoản quản trị"**: nhập tên đăng nhập và mật khẩu (ít nhất 8 ký tự). Chỉ tạo được một lần; ai mở sau đó sẽ chỉ thấy màn đăng nhập.
- Nên mở web và tạo tài khoản **ngay sau khi triển khai**, để không ai khác kịp tạo trước.
- Vào **Cài đặt** để thêm vật liệu (Đế, Quai, Kiểu) và kiểm tra dải size mặc định (Nam 39–44, Nữ 35–40).
- Vào **Cài đặt → Trang web** để thêm sản phẩm (màu, dòng size, ảnh), bộ sưu tập, poster và thông tin xưởng (Zalo, Messenger, địa chỉ). Trang chủ chỉ hiện những gì đã tick "Đang bán" hoặc "Hiện trên trang web".
- Vào **Cài đặt → Người dùng** để xem khách tự đăng ký, khóa/mở khóa, tạo link đặt lại mật khẩu gửi qua Zalo.

## Tên miền đang dùng

- **https://hluxurystore.com** (mua ở Cloudflare ngày 24/11/2026, tự gia hạn). Gắn vào Worker `xuong-dep` ở Settings → Domains & Routes, cùng `www.hluxurystore.com`.
- `APP_URL` nằm trong `wrangler.toml` (`[vars]`). Trang mở ở `www.…` hoặc địa chỉ cũ `…workers.dev` tự chuyển về `hluxurystore.com` (giữ nguyên đường dẫn), nên link báo giá cũ vẫn mở được. API và form không bị chuyển.
- Khu quản lý chỉ dùng tiếng Việt (anh chốt 24/11/2026); trang khách vẫn 3 thứ tiếng.

## Gắn tên miền riêng (khi anh đã mua tên miền)

1. Trên Cloudflare: **Websites → Add a site** → nhập tên miền (ví dụ `hluxury.com`) → chọn gói Free → đổi 2 nameserver ở nơi mua tên miền theo hướng dẫn của Cloudflare. Chờ đến khi trang báo **Active**.
2. Workers & Pages → `huutinh` → Settings → **Domains & Routes → Add → Custom domain** → nhập `xuongdep.hluxury.com` (hoặc `hluxury.com`).
3. Settings → Variables → thêm `APP_URL` = `https://xuongdep.hluxury.com` (link báo giá, link xác nhận email và link đặt lại mật khẩu dùng địa chỉ này).

## Bật gửi email (xác nhận email, quên mật khẩu)

Web gửi mail qua **Resend** (miễn phí 3.000 email/tháng). Chưa cài thì web vẫn chạy, chỉ là không gửi được mail; anh vẫn tạo link đặt lại mật khẩu trong mục Người dùng được.

1. Tạo tài khoản ở <https://resend.com> → **Domains → Add domain** → nhập tên miền (ví dụ `hluxury.com`).
2. Resend đưa ra vài bản ghi DNS (MX, TXT). Thêm đúng các bản ghi đó trong Cloudflare → tên miền → **DNS**. Bấm **Verify** bên Resend.
3. Resend → **API Keys → Create** → chép khóa (chỉ hiện một lần).
4. Lưu khóa và địa chỉ gửi vào Worker (không ghi vào code):

```bash
npx wrangler secret put RESEND_API_KEY
```

```bash
npx wrangler secret put MAIL_FROM
```

`MAIL_FROM` ví dụ: `HLUXURY <no-reply@hluxury.com>`. Thử bằng cách bấm "Quên mật khẩu" với một email đã xác nhận.

## Cài lên màn hình iPhone

1. Mở địa chỉ web **kèm `/quan-ly`** bằng **Safari** (ví dụ `https://xuongdep.hluxury.com/quan-ly`). Biểu tượng cũ (trỏ vào `/`) nên xóa và thêm lại.
2. Bấm nút **Chia sẻ** (hình vuông có mũi tên) → **Thêm vào MH chính**.
3. Biểu tượng chiếc dép xuất hiện trên màn hình chính, mở ra như một ứng dụng. Phiên đăng nhập giữ 90 ngày.

Android (Chrome): menu ⋮ → **Thêm vào màn hình chính**.

## Sao lưu dữ liệu

- **Trong web:** Cài đặt → **Tải bản sao lưu**. File JSON chứa toàn bộ khách, đơn, báo giá, tiền nhận, thư viện mẫu (không chứa mật khẩu). Tài khoản khách, sản phẩm, poster nằm trong D1 và được giữ bởi Time Travel bên dưới. Nên tải mỗi tuần và cất vào Google Drive.
- **D1 tự khôi phục được** về một thời điểm trước đó (Time Travel, có sẵn): gói miễn phí giữ 7 ngày, gói trả phí giữ 30 ngày. Vì vậy vẫn nên tải bản sao lưu hằng tuần. Khi lỡ xóa nhầm: `npx wrangler d1 time-travel restore xuong-dep --timestamp=<thời điểm>`.
- **Ảnh** nằm trong R2 `xuong-dep-anh`. Muốn tải hết ảnh về máy có thể dùng `rclone` hoặc trang quản trị R2.

## Chạy thử trên máy (cho người code)

```bash
bun install
```

```bash
bun run dev
```

Mở `http://127.0.0.1:8787` (trang chủ) hoặc `http://127.0.0.1:8787/quan-ly`. Dữ liệu thử nằm trong thư mục `dev-data/`. Email khi chạy thử không gửi đi mà nằm ở `http://127.0.0.1:8787/__dev/outbox`.

Kiểm thử:

```bash
bun run test
```

```bash
bun run e2e
```

Chạy thử trên chính môi trường của Cloudflare (workerd) ở máy:

```bash
bun run build && npx wrangler d1 execute xuong-dep --local --file=schema/schema.sql && npx wrangler d1 migrations apply xuong-dep --local && npx wrangler dev --local
```

Bộ test e2e chạy được với một địa chỉ có sẵn, ví dụ bản vừa triển khai (dùng dữ liệu thật, nên chỉ chạy trên bản thử):

```bash
E2E_BASE_URL=http://127.0.0.1:8787 bun test test/e2e/dist-smoke.test.ts --timeout 30000
```
