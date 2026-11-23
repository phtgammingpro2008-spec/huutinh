# Thiết kế: Hệ thống nhận đơn và báo giá dép theo ảnh (Giai đoạn 1)

Ngày: 22/11/2026 · Trạng thái: **anh đã duyệt (22/11/2026)**

Quy ước: "anh" là chủ xưởng và cũng là người dùng duy nhất ở giai đoạn 1. Những chỗ ghi **(em quyết)** là em tự chọn, anh chưa duyệt, anh sửa thoải mái.

---

## 1. Mục đích và lý do

Anh là xưởng sản xuất dép thời trang, bán sỉ cho khách ở Việt Nam và Campuchia. Hiện giờ khách đặt hàng qua Zalo và Messenger theo kiểu rất lộn xộn:

- Khách gửi một **ảnh tổng** chụp nhiều đôi, rồi dán số lên từng đôi (ví dụ 85, 25, 18...) hoặc viết tay lên ảnh (ví dụ "30 30" nghĩa là 30 đôi nam và 30 đôi nữ).
- Phần tóm tắt nằm rời trong tin nhắn, ví dụ "Man 235x6=1,410 / 39-44=47k VIP 1".
- Cộng tay rất dễ sai. Đã có đơn ghi "5 hình 150 đôi" rồi ngay sau lại ghi "tổng 180 đôi".
- Ảnh mẫu cũ bị trôi mất trong đoạn chat, không tìm lại được.

**Mục đích giai đoạn 1:** anh có một công cụ trên điện thoại để biến mỗi lần khách gửi ảnh thành một đơn hàng rõ ràng: từng mẫu, từng dải size, số đôi, vật liệu, tự cộng đúng. Anh báo giá rồi gửi link cho khách bấm đồng ý. Mọi ảnh mẫu được lưu vào thư viện để tìm lại và để khách sau tham khảo.

**Về lâu dài:** khách tự vào web đặt hàng bằng ba thứ tiếng (Việt, Anh, Khmer). Giai đoạn 1 phải xây sao cho lên giai đoạn 2 không phải làm lại.

## 2. Người dùng

- **Anh, giai đoạn 1:** người duy nhất nhập đơn, báo giá và quản lý. Anh dùng iPhone là chính. Ảnh khách gửi thường nằm sẵn trong máy, dạng ảnh chụp màn hình đoạn chat hoặc ảnh tải về.
- **Khách hàng:** khách sỉ ở Việt Nam và Campuchia, liên lạc chủ yếu qua Zalo, có cả nhóm Messenger. Ở giai đoạn 1, khách chỉ mở **trang xem báo giá** từ đường link anh gửi.
- **Nhân viên xưởng:** không rành công nghệ nên không dùng hệ thống ở giai đoạn 1. Dữ liệu vẫn để sẵn chỗ cho nhiều tài khoản về sau.

## 3. Mục tiêu, phần chưa làm, và thế nào là thất bại

**Mục tiêu**

1. Nhập một đơn điển hình trên điện thoại trong khoảng 2 đến 3 phút. Đơn điển hình ví dụ là ảnh 9 màu, size 39 đến 44, mỗi màu một số lượng.
2. Tổng số đôi luôn đúng, vì máy tự cộng chứ không cộng tay.
3. Báo giá bằng VND hoặc USD, gửi link qua Zalo hoặc Messenger, khách bấm "Đồng ý" là đơn được chốt và có lưu vết.
4. Mỗi mẫu dép được cắt thành ảnh riêng và lưu vào thư viện, lọc được theo kiểu và vật liệu.
5. Khi báo giá, thấy được giá các lần trước của cùng loại vật liệu.
6. Đơn đã chốt xuất được phiếu làm hàng cho thợ, in giấy hoặc gửi ảnh qua Zalo.

**Chưa làm ở giai đoạn 1** (để giai đoạn 2, xem mục 9)

- Khách tự đặt hàng trên web, tài khoản cho khách, thư viện mẫu mở cho khách.
- Thanh toán online (MoMo, VNPay, thẻ).
- Tin nhắn Zalo tự động (ZNS).
- AI tự đọc số và chữ viết trên ảnh.
- Tài khoản nhân viên, phân quyền.
- Kết nối đơn vị vận chuyển, báo cáo nâng cao.

**Thất bại nếu** (kể cả khi phần mềm vẫn "chạy được")

- Nhập đơn trên web lâu và phiền hơn ghi chú trong chat, khiến anh bỏ không dùng.
- Mất ảnh hoặc mất dữ liệu đơn.
- Mẫu có logo hoặc hình thương hiệu (Havaianas, Marvel, hoa văn monogram...) bị công khai trên mạng, dẫn đến bị báo cáo vi phạm và web bị khóa.
- Số liệu trên báo giá sai so với đơn.

## 4. Ràng buộc

- **Chi phí ban đầu gần như bằng 0.** Chỉ tốn tiền tên miền. Hạ tầng dùng gói miễn phí của Cloudflare.
- **Dùng tốt trên iPhone:** nút to, thao tác chạm, ảnh tải nhanh. Thêm được vào màn hình chính như một ứng dụng (PWA).
- **Chạy được trên mọi nền tảng:** iPhone, Android, Windows, Mac, mở bằng trình duyệt thường như Safari, Chrome, Edge. Không cần cài từ kho ứng dụng. Phiếu làm hàng in được từ cả điện thoại lẫn máy tính.
- **Chỉ hai loại tiền: VND và USD.** Mỗi đơn dùng một loại tiền.
- **Ngôn ngữ:** trang quản lý của anh bằng tiếng Việt. Trang báo giá cho khách có tiếng Việt, tiếng Anh và tiếng Khmer, và cần phông chữ hiển thị được tiếng Khmer.
- **Dung lượng ảnh:** gói miễn phí lưu được 10 GB, nên ảnh phải được nén ngay trên điện thoại trước khi tải lên.
- **Mọi đơn đều phải báo giá.** Không có giá niêm yết.

## 5. Các cách đã cân nhắc

| Cách | Ưu điểm | Nhược điểm | Kết luận |
|---|---|---|---|
| **1. Tự viết web app, chạy trên Cloudflare** | Làm đúng mọi chức năng cần (chạm gắn số, dải size, thư viện). Giai đoạn 2 xây tiếp trên nền này. Chi phí gần như 0. | Mất thời gian hơn mới có bản đầu. Muốn đổi chức năng thì phải sửa code. | **Anh đã chọn** |
| 2. AppSheet và Google Sheets | Có bản chạy nhanh, anh tự sửa được vài chỗ. | Không làm được chạm gắn số lên ảnh. Thư viện cho khách và giao diện ba thứ tiếng rất khó. Tốn 5 đến 10 USD mỗi người mỗi tháng. Lên giai đoạn 2 phải làm lại. | Loại |
| 3. Phần mềm bán hàng có sẵn (Sapo, KiotViet...) | Có sẵn, dùng được ngay. | Dựa trên mã hàng và giá cố định, không hợp với kiểu báo giá theo ảnh. | Loại |

## 6. Chức năng giai đoạn 1

### 6.1 Khách hàng

- Thông tin lưu: tên (ví dụ "chị Nga"), số Zalo, link Messenger nếu có, quốc gia, **ngôn ngữ báo giá** (Việt, Anh hoặc Khmer), **loại tiền mặc định** (VND hoặc USD), ghi chú.
- Tạo nhanh ngay trong lúc nhập đơn, chỉ cần điền tên là đủ.
- Xem được lịch sử đơn của từng khách.

### 6.2 Nhập đơn từ ảnh (màn hình quan trọng nhất)

**Các bước**

1. Bấm "Đơn mới", chọn khách, rồi **chọn một hay nhiều ảnh** từ thư viện ảnh của điện thoại.
2. Trên từng ảnh, **chạm vào một đôi dép**. Một nhãn số hiện ra (1, 2, 3...), kèm một **khung cắt mặc định** bao quanh chỗ vừa chạm. Kéo các góc để chỉnh khung. Mỗi nhãn là **một mẫu** trong đơn.
3. Một ảnh chỉ có một mẫu thì bấm "Cả ảnh là 1 mẫu" cho nhanh.
4. Với mỗi mẫu, nhập các thông tin sau:
   - **Số lượng theo từng dòng.** Mỗi mẫu có thể có một hoặc nhiều dòng, ví dụ một dòng Nam và một dòng Nữ. Mỗi dòng gồm:
     - Dải size (ví dụ 39 đến 44), lấy theo mặc định của dòng đó.
     - Chế độ **"Đều mỗi size"**: nhập một con số, ví dụ 235, máy tự nhân ra 1.410 đôi.
     - Hoặc chế độ **"Từng size"**: mỗi size nhập một số riêng.
     - Hoặc chế độ **"Tổng số đôi"** **(em quyết)**: chỉ nhập tổng, ví dụ khách ghi "30 30" nghĩa là 30 đôi Nam và 30 đôi Nữ cho mẫu đó. Xưởng tự chia size theo tỉ lệ chuẩn, và trên phiếu làm hàng sẽ ghi "chia size theo chuẩn xưởng".
   - **Vật liệu:** chọn đế, quai và kiểu dép trong danh mục (mục 6.7).
   - **Màu và ghi chú:** chữ tự do.
5. Máy **tự cộng** số đôi của từng mẫu, từng dòng và cả đơn, và hiện tổng ở thanh dưới cùng màn hình.
6. Điền thêm: ngày khách cần hàng, ghi chú chung, có cho đưa mẫu vào thư viện khách xem hay không (mặc định là **không**).
7. Bấm Lưu. Đơn ở trạng thái "Chờ báo giá".

**Thêm mẫu từ thư viện:** trong lúc nhập đơn, anh chọn được mẫu có sẵn trong thư viện thay vì tải ảnh mới. Khi đó chỉ cần nhập số lượng.

**Yêu cầu khác**

- Ảnh gốc được giữ nguyên, kể cả chữ khách viết tay lên, để đối chiếu về sau. Ảnh cắt của từng mẫu được lưu riêng.
- Đang nhập dở mà thoát ra thì không mất dữ liệu (tự lưu nháp).
- Sửa được đơn sau khi đã lưu.

### 6.3 Báo giá và gửi cho khách

1. Trong đơn, với mỗi dòng số lượng, anh nhập **đơn giá cho mỗi đôi**, tính bằng loại tiền của đơn.
2. Bên cạnh ô nhập giá có **lịch sử giá**: các đơn giá anh từng báo cho cùng tổ hợp vật liệu (đế, quai, kiểu), kèm ngày và tên khách. Bấm vào một mức giá là điền luôn giá đó vào ô.
3. Máy tự tính thành tiền và tổng đơn.
4. Bấm "Gửi báo giá". Hệ thống tạo một **đường link riêng, khó đoán**, rồi:
   - Chép sẵn một tin nhắn ngắn kèm link, viết bằng ngôn ngữ của khách.
   - Nút "Mở Zalo" mở khung chat với số Zalo của khách. Nút "Mở Messenger" dùng link của khách nếu có. Anh dán tin nhắn vào và gửi.
   - Đơn chuyển sang trạng thái "Đã báo giá".
5. **Trang báo giá khách xem** hiển thị bằng tiếng Việt, Anh hoặc Khmer theo cài đặt của khách. Khách đổi được ngôn ngữ ngay trên trang. Trang gồm:
   - Ảnh từng mẫu, vật liệu, dải size, số đôi, đơn giá, thành tiền, tổng đơn, ngày cần hàng.
   - Nút **"Đồng ý báo giá"**. Khách bấm xong, đơn chuyển sang "Khách đã đồng ý" và lưu lại thời điểm bấm. Anh xem được trạng thái này trong trang quản lý.
   - Không bắt khách đăng nhập. Trang không cho tìm thấy qua Google.
6. Nếu anh **sửa giá hoặc số lượng sau khi khách đã đồng ý**, đơn quay về "Đã báo giá" và khách phải bấm đồng ý lại. Lịch sử các lần báo giá vẫn được giữ.

### 6.4 Trạng thái đơn và tiền

- Các trạng thái lần lượt: **Chờ báo giá → Đã báo giá → Khách đã đồng ý → Đang sản xuất → Đã giao → Hoàn tất**. Ngoài ra có trạng thái **Đã hủy**.
- Tiền nhận: ghi các khoản đã nhận gồm số tiền, ngày, ghi chú như "cọc" hay "thanh toán đủ". Hệ thống hiện số còn lại phải thu.
- Trang chủ của anh: đơn đang chờ báo giá, đơn khách vừa đồng ý, đơn sắp đến ngày giao, đơn còn nợ tiền.
- Tìm đơn theo mã đơn, tên khách, hoặc trong một khoảng ngày.

### 6.5 Phiếu làm hàng cho xưởng

Thợ trong xưởng không dùng hệ thống, nên khi đơn đã chốt, anh xuất ra **phiếu làm hàng** để giao cho thợ. Có hai cách xuất, đều có từ giai đoạn 1 (anh đã chọn cả hai):

- **In giấy:** khổ A4 dọc, chữ to, in thẳng từ điện thoại hoặc máy tính.
- **Xuất ảnh:** tạo file ảnh để anh gửi qua Zalo cho thợ. Đơn nhiều mẫu thì tách thành nhiều ảnh, sao cho mỗi ảnh vẫn đọc rõ trên màn hình điện thoại.

Nội dung phiếu:

- Phần đầu: mã đơn, tên khách, ngày cần hàng.
- Từng mẫu: ảnh cắt cỡ lớn kèm số nhãn, vật liệu (đế, quai, kiểu) ghi bằng tiếng Việt, màu và ghi chú, bảng size và số đôi của từng dòng (Nam, Nữ), tổng số đôi của mẫu.
- Cuối phiếu: tổng số đôi của cả đơn.
- **Không ghi giá** **(em quyết)**, vì thợ không cần biết giá.

Xuất được phiếu khi đơn đã ở trạng thái "Khách đã đồng ý" trở đi.

### 6.6 Thư viện mẫu

- Mỗi mẫu cắt ra từ một đơn **tự động vào thư viện nội bộ**: lưu ảnh cắt, ảnh gốc, vật liệu, đơn nguồn, ngày.
- Gắn nhãn được **"Mẫu cố định"** (mẫu có sẵn của xưởng) hoặc **"Mẫu đặt riêng"** (mẫu khách gửi).
- Lọc theo kiểu dép, vật liệu và nhãn. Tìm theo ghi chú.
- Từ một mẫu trong thư viện: xem lại các đơn đã dùng mẫu đó, hoặc bấm "Tạo đơn từ mẫu này".
- **Nhập ảnh cũ:** anh dùng chính màn hình nhập đơn ở mục 6.2 để đưa ảnh tổng cũ trong Zalo vào thư viện, có chế độ "chỉ lưu vào thư viện, không tạo đơn".
- Giai đoạn 1 **chỉ anh xem được thư viện**. Lưu sẵn cờ "khách cho phép hiện mẫu" để giai đoạn 2 dùng.

### 6.7 Danh mục vật liệu

- Ba nhóm: **Đế** (ví dụ VIP 1), **Quai** (ví dụ 15L), **Kiểu** (ví dụ mút hình, kẹp, quai ngang).
- Anh tự thêm, sửa, ẩn mục. Mỗi mục có tên tiếng Việt, kèm tên tiếng Anh và tiếng Khmer để hiện trên trang báo giá. Nếu thiếu tên tiếng Anh hoặc Khmer thì hiện tên tiếng Việt.
- **Dải size mặc định** cho từng dòng chỉnh trong phần Cài đặt. Mặc định ban đầu (anh đã xác nhận): **Nam 39 đến 44, Nữ 35 đến 40**. Anh thêm được dòng khác.

### 6.8 Đăng nhập

- Một tài khoản quản trị, đăng nhập bằng mật khẩu, có phiên đăng nhập lâu để anh không phải đăng nhập lại liên tục trên điện thoại.
- Cấu trúc dữ liệu có sẵn bảng người dùng và vai trò, để thêm nhân viên sau này.

## 7. Mô hình dữ liệu (dự kiến)

- `customers`: id, tên, số Zalo, link Messenger, quốc gia, ngôn ngữ (vi, en, km), loại tiền (VND, USD), ghi chú.
- `orders`: id, mã đơn, customer_id, trạng thái, loại tiền, ngày cần hàng, ghi chú, cho_phep_hien_mau, quote_token, các mốc thời gian (tạo, báo giá, đồng ý...).
- `order_images`: id, order_id, khóa ảnh gốc trên R2, rộng, cao, thứ tự.
- `designs` (thư viện): id, khóa ảnh cắt, image_id gốc, khung cắt (tỉ lệ 0 đến 1), nhãn (cố định hoặc đặt riêng), vật liệu mặc định, ghi chú, cho_phep_hien.
- `order_items` (mẫu trong đơn): id, order_id, design_id, số nhãn, điểm chạm x/y, đế, quai, kiểu, màu và ghi chú.
- `item_lines` (dòng số lượng): id, item_id, dòng (nam, nữ...), size từ, size đến, chế độ (đều mỗi size hoặc từng size), số đôi mỗi size, chi tiết từng size dạng JSON, đơn giá.
- `quotes`: id, order_id, số phiên bản, bản chụp các đơn giá và tổng, thời điểm gửi, thời điểm khách đồng ý.
- `payments`: id, order_id, số tiền, ngày, ghi chú.
- `materials`: id, nhóm (đế, quai, kiểu), tên vi/en/km, trạng thái ẩn hay hiện.
- `settings`: dải size mặc định theo dòng, mẫu tin nhắn gửi báo giá theo từng ngôn ngữ.
- `users`: id, tên, mật khẩu đã băm, vai trò.

Tổng số đôi và tổng tiền **luôn tính từ `item_lines`**, không lưu tay. Riêng mỗi phiên báo giá thì chụp lại một bản để giữ nguyên lịch sử.

## 8. Kỹ thuật (em quyết)

- **Giao diện:** React và TypeScript, đóng gói bằng Bun, ưu tiên màn hình điện thoại, có PWA.
- **Máy chủ:** Cloudflare Workers, dùng bộ định tuyến tự viết. Không dùng thư viện ngoài, vì máy làm việc hiện không cài thêm được gói npm.
- **Cơ sở dữ liệu:** Cloudflare D1 (SQLite), viết câu lệnh SQL trực tiếp.
- **Đóng gói để đưa lên mạng:** toàn bộ web (máy chủ và giao diện) gói gọn vào **một file `worker.js`**, kèm một file `schema.sql`. Như vậy có thể đưa lên Cloudflare bằng lệnh `wrangler`, hoặc dán thẳng vào trang quản trị Cloudflare trên trình duyệt. Địa chỉ ban đầu dùng tên miền phụ miễn phí `*.workers.dev`, tên miền riêng mua sau.
- **Chạy thử ở máy làm việc:** dùng Bun, giả lập D1 bằng SQLite và giả lập R2 bằng thư mục ảnh. Kiểm thử bằng `bun test` và Playwright (trình duyệt Chromium, màn hình cỡ iPhone).
- **Lưu ảnh:** Cloudflare R2. Ảnh được nén trên điện thoại trước khi tải lên: cạnh dài tối đa khoảng 2000px, JPEG hoặc WebP chất lượng khoảng 80%. Ảnh cắt của từng mẫu được tạo trên điện thoại rồi tải lên riêng.
- **Nhiều ngôn ngữ trên trang báo giá:** các file từ điển vi, en, km. Phông Noto Sans Khmer.
- **Bảo mật:** cookie phiên đăng nhập, quote_token ngẫu nhiên đủ dài. Trang báo giá và ảnh có gắn noindex.
- **Sao lưu:** bật tính năng khôi phục của D1, thêm nút xuất toàn bộ dữ liệu ra file.
- **Mã nguồn:** quản lý bằng git. Mỗi khi xong một phần, em đóng gói thành file zip gửi anh để không mất code. Khi nào có mạng thì đưa lên GitHub.

## 9. Giai đoạn 2 (đã ghi nhận, chưa làm)

- Cổng đặt hàng cho khách bằng ba thứ tiếng, chạm gắn số y như màn hình của anh, kèm tài khoản khách.
- Thư viện mẫu cho khách xem, chỉ những mẫu được phép và phải đăng nhập.
- AI gợi ý sẵn khung và số lượng từ ảnh (đọc "30 30", nhãn số...), anh chỉ cần kiểm tra lại.
- Tự dịch ghi chú của khách sang tiếng Việt.
- Zalo ZNS gửi báo giá tự động, thanh toán online, kết nối đơn vị vận chuyển, tài khoản nhân viên.

## 10. Phần để người code tự quyết

Định dạng mã đơn, bố cục chi tiết từng màn hình, thư viện cắt ảnh và nén ảnh, cấu trúc thư mục code, cách viết kiểm thử, tên miền phụ cho trang báo giá.

## 11. Đã chốt với anh (22/11/2026)

- Khách đặt hàng qua ảnh. Đơn nào cũng báo giá, không có giá niêm yết.
- Chỉ dùng VND và USD. Khách nói tiếng Việt, tiếng Anh và tiếng Khmer.
- Kênh liên lạc chủ yếu là Zalo, có cả Messenger.
- "VIP 1" là loại vật liệu (đế hoặc quai), không phải hạng khách. Danh sách vật liệu đầy đủ anh sẽ gửi sau.
- Giai đoạn đầu chỉ anh vận hành hệ thống.
- Code thuần (cách 1).
- Có phiếu làm hàng cho xưởng, cả bản in giấy lẫn bản ảnh gửi Zalo.
- Dải size mặc định: Nam 39 đến 44, Nữ 35 đến 40.
- Web phải chạy được trên mọi nền tảng.
- Anh đã duyệt toàn bộ bản thiết kế này.
