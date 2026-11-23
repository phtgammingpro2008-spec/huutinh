# Thiết kế: Web đặt hàng cho khách (giai đoạn 2a)

Ngày: 23/11/2026 · Trạng thái: **chờ anh duyệt**

Quy ước: "anh" là chủ xưởng. Mục ghi **(em quyết)** là em tự chọn, anh chưa duyệt. Bản này nối tiếp `2026-11-22-dat-hang-dep-giai-doan-1-design.md` (giai đoạn 1, đã chạy thật tại `https://xuong-dep.phtgammingpro2008.workers.dev`).

---

## 1. Mục đích và lý do

Anh muốn một hệ thống khép kín: **chào hàng → báo giá → khách đặt hàng → sản xuất → vận chuyển → giao thẳng hoặc nhập kho → tồn kho và xuất kho ở Campuchia**. Giai đoạn 1 đã có phần báo giá do anh tự nhập đơn. Giai đoạn 2a làm **phần khách hàng**:

- Một **trang chủ công khai thật bắt mắt** (poster, bộ sưu tập theo chủ đề, mẫu nổi bật) để người ta muốn tìm hiểu. Anh nói: "vậy thì người ta không thèm tìm hiểu đâu".
- Khách **tự đăng ký, tự đặt hàng bằng ảnh** (chạm gắn số như màn hình của anh), nhận báo giá, đồng ý và theo dõi đơn.
- Toàn bộ web (cả phần quản lý của anh) **khoác giao diện phong cách Kho Việt**: tối giản nhưng không chán. Anh thích giao diện này từ bài thi `kho-viet.vercel.app`.

Phần kho, vận chuyển và mã QR trên bao là **giai đoạn sau**. Các quyết định anh đã chốt cho phần đó được ghi ở mục 10 để không mất.

## 2. Người dùng

- **Anh (admin):** báo giá, quản lý đơn, khách, thư viện, nội dung trang chủ. Dùng iPhone là chính.
- **Khách (customer):** khách sỉ ở Việt Nam và Campuchia, nói tiếng Việt, Anh hoặc Khmer, quen nhắn Zalo, dùng điện thoại là chính.
- **Khách chưa đăng nhập:** chỉ xem **một phần thông tin** (anh chốt). Bấm "Đặt hàng" hoặc bất kỳ nút cần tài khoản thì **hiện cửa sổ Đăng ký / Đăng nhập** ngay tại chỗ, đăng nhập xong quay lại đúng chỗ đang xem.

**Khách chưa đăng nhập thấy gì (em quyết):** trang chủ (poster, bộ sưu tập), danh sách sản phẩm với ảnh, tên và kiểu dép. **Phải đăng nhập mới thấy:** đủ các màu và ảnh từng màu, dải size, trang chi tiết đầy đủ, đặt hàng, báo giá, đơn của mình.

**Ba khu tách riêng (anh chốt):** trang công khai `/`, khu khách `/tai-khoan`, khu quản lý của anh `/quan-ly`. Khách không bao giờ vào được khu quản lý.

## 3. Mục tiêu, phần chưa làm, và thế nào là thất bại

**Mục tiêu**

1. Trang chủ công khai theo mẫu **A2** đã duyệt (xem mục 6.1), Google tìm thấy được, tải nhanh trên 4G.
2. Khách tự đăng ký bằng **số điện thoại + mật khẩu**, đăng ký xong **đặt hàng được ngay**. Anh khóa được tài khoản lạ hoặc phá phách.
3. Khách đặt hàng bằng ảnh với đúng trải nghiệm chạm gắn số, dải size, tự cộng như màn hình của anh.
4. Đơn khách gửi hiện ngay ở phần quản lý trong nhóm "Chờ báo giá". Anh báo giá như cũ. Khách xem báo giá và bấm đồng ý ngay trong tài khoản.
5. Khách xem lịch sử đơn, trạng thái, báo giá, số tiền đã trả và còn lại.
6. Anh tự thay nội dung trang chủ (poster, bộ sưu tập, thông tin xưởng) mà không cần sửa code.
7. Toàn bộ giao diện theo phong cách Kho Việt (mục 7).

**Chưa làm ở giai đoạn này**

- Kho Campuchia, chuyến hàng, mã QR trên bao, tài khoản quản lý kho, hàng bán sẵn (giai đoạn kế tiếp, mục 10).
- Theo dõi nhiều xưởng gia công.
- Thanh toán online, Zalo ZNS, gửi mã xác thực qua SMS.
- Tài khoản nhân viên trong xưởng.

**Thất bại nếu** (kể cả khi phần mềm "chạy được")

- Một khách **thấy được đơn, ảnh, giá hoặc thông tin của khách khác**.
- **Mẫu lộ ra ngoài người chưa đăng nhập hoặc Google** (đặc biệt mẫu có logo thương hiệu như Havaianas, Marvel…). Lý do: bị báo cáo thì Cloudflare có thể khóa cả tài khoản và mất dữ liệu.
- **Ảnh gốc khách gửi** (thường là ảnh chụp đoạn chat, có tên, số điện thoại, chữ viết tay) lọt sang khách khác.
- Mẫu khách đã tick **"Mẫu đặt riêng"** hiện cho khách khác.
- Đặt hàng trên web **phiền hơn nhắn Zalo**, khách bỏ không dùng.
- Trang chủ chậm hoặc trông "như bài thi", không gây ấn tượng.
- Phần quản lý của anh bị hỏng hoặc chậm đi vì thêm phần khách.

## 4. Ràng buộc

- Giữ nền hiện tại: một Cloudflare Worker, D1, R2, gói miễn phí, tự build khi code trên `main` thay đổi. Dữ liệu đang chạy thật phải được giữ nguyên: thay đổi cơ sở dữ liệu là **migration cộng thêm**, không xóa bảng.
- Giới hạn gói miễn phí: D1 100 tham số mỗi câu lệnh và giới hạn số truy vấn mỗi lần gọi (giai đoạn 1 đã xử lý bằng `json_each`), Worker 10 ms CPU mỗi lần gọi (đăng nhập PBKDF2 đã đo được trên bản thật).
- Chỉ VND và USD. Ba thứ tiếng vi, en, km cho mọi phần khách thấy.
- Mọi đơn đều được báo giá, không có giá niêm yết. Thẻ sản phẩm ghi "Nhận báo giá".
- Chạy tốt trên iPhone Safari, Android Chrome và máy tính.
- **Gửi email** (xác nhận email, lấy lại mật khẩu) cần một dịch vụ gửi mail. Địa chỉ `*.workers.dev` không dùng làm địa chỉ gửi được, nên cần **một tên miền riêng** — xem câu hỏi còn mở ở cuối bản.

## 5. Các cách đã cân nhắc

| Cách | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **A. Mở rộng chính web hiện tại** (trang công khai, khu khách, khu quản lý chung một Worker và cơ sở dữ liệu) | Dùng lại màn gắn số, tính tổng, báo giá 3 thứ tiếng. Đơn khách hiện ngay bên anh. Miễn phí, một nơi để sửa. | Phải tách quyền rất cẩn thận để khách chỉ thấy dữ liệu của mình. | **Anh chọn** ("ưu tiên tự làm hết") |
| B. Web khách riêng (kiểu Vercel) gọi API web quản lý | Tự do giao diện | Hai web, hai chỗ đăng nhập, sửa hai nơi, dễ lệch | Loại |
| C. Web bán hàng có sẵn (Shopify, Haravan) làm trang chủ | Có trang đẹp nhanh | Không có màn gắn số theo ảnh, nhập mẫu hai lần, tốn phí, hợp giá niêm yết chứ không hợp báo giá | Loại |

## 6. Chức năng

### 6.1 Trang chủ công khai (mẫu A2)

Mẫu duyệt: artboard **A2** trong `https://claude.ai/artifact/3q4Py98W9xpu1tdFmQVaKa`. Các khối từ trên xuống:

1. **Đầu trang:** logo, nút tìm, nút mẫu đã lưu, **nút quả cầu chọn ngôn ngữ**, **nút sáng/tối**, nút Đăng nhập hoặc Tài khoản.
2. **Poster lớn vuốt được**, có nhiều poster: ảnh, nhãn nhỏ (ví dụ "MỚI · HÈ 2027"), tiêu đề chữ có chân, mô tả, 1–2 nút.
3. **Thanh chọn kiểu dép** (lấy từ danh mục "Kiểu" trong vật liệu).
4. **Theo chủ đề:** thẻ poster vuốt ngang, mỗi thẻ mở một bộ sưu tập.
5. **Sản phẩm nổi bật:** lưới thẻ **sản phẩm** gồm ảnh, tên, dải size, chấm các màu có, nhãn MỚI và nút "Nhận báo giá".
6. **Khối kho Phnom Penh:** hiển thị khi đã có dữ liệu tồn kho. Giai đoạn này **ẩn đi** và sẽ bật ở giai đoạn kho.
7. **Đặt hàng trong 3 bước.**
8. **Chân trang:** địa chỉ xưởng, Zalo, Messenger.
9. **Thanh nút cố định cuối màn hình:** "Gửi ảnh nhận báo giá" và nút Zalo.

Yêu cầu:

- **Anh tự quản lý nội dung** trong khu quản lý: poster (ảnh, nhãn, tiêu đề, mô tả, nút, thứ tự, bật hoặc tắt), bộ sưu tập (tiêu đề, ảnh bìa, màu nền, danh sách sản phẩm), sản phẩm nổi bật, thông tin xưởng (Zalo, Messenger, địa chỉ xưởng, địa chỉ kho). Văn bản có 3 thứ tiếng; thiếu thứ tiếng nào thì hiện tiếng Việt.
- **Google tìm thấy được:** trang chủ, trang bộ sưu tập và trang mẫu công khai phải có nội dung chữ thật ngay trong HTML trả về (tiêu đề, mô tả, ảnh chia sẻ khi gửi link qua Zalo/Facebook), không chỉ một khung trống chờ JavaScript. Khu khách, khu quản lý, link báo giá và ảnh riêng **vẫn noindex** như giai đoạn 1.
- Ảnh trên trang công khai là ảnh nén, có kích thước hợp lý để tải nhanh trên 4G.

### 6.2 Thư viện mẫu dùng chung và sản phẩm

**Mục đích (anh chốt):** web là nơi **lưu mọi mẫu dép khách đã đặt**, để **khách khác tham khảo và đặt lại**. Vì vậy thư viện **không để riêng tư mặc định**.

**Thư viện mẫu dùng chung**
- Mỗi mẫu trong đơn (khách tự đặt hoặc anh nhập từ Zalo) **tự vào thư viện** như giai đoạn 1, và **hiện cho mọi khách đã đăng nhập**, trừ khi:
  - khách tick ô **"Mẫu đặt riêng (không hiện cho khách khác)"** khi đặt hàng (có thể tick cho cả đơn hoặc từng mẫu), hoặc
  - anh tick "Mẫu đặt riêng" khi nhập đơn hộ khách, hoặc bấm **"Ẩn khỏi thư viện"** cho một mẫu bất kỳ.
- Khách khác chỉ thấy **ảnh cắt của đôi dép** (kèm kiểu, đế, quai, màu/ghi chú). **Không bao giờ thấy ảnh gốc** (thường là ảnh chụp đoạn chat có tên, số điện thoại, chữ viết tay), không thấy tên người đặt, số lượng hay giá của đơn gốc. **(em quyết)**
- Khách bấm **"Đặt lại mẫu này"** → mở màn đặt hàng với mẫu đó, chọn dòng size (Nam/Nữ…) và nhập số đôi. Anh báo giá như mọi đơn.
- Thư viện **chỉ người đã đăng nhập mới xem được**, Google không thấy. Người chưa đăng nhập chỉ thấy vài mẫu tiêu biểu do anh chọn trên trang chủ.
- Lọc theo kiểu dép, đế, quai; tìm theo ghi chú; sắp xếp "mới nhất" / "đặt nhiều nhất". **(em quyết: "đặt nhiều nhất" = số đơn đã dùng mẫu)**
- Ô **"Mẫu có logo thương hiệu"** trong khu quản lý vẫn giữ (em đề xuất): mẫu đã đánh dấu thì không bao giờ ra trang chủ công khai; còn có hiện trong thư viện cho khách đăng nhập hay không là anh chọn khi đánh dấu (anh đã chấp nhận rủi ro cho khách đăng nhập). **(em quyết)**

**Sản phẩm (cho trang chủ, để khách chọn màu và size)**
- Anh tạo **sản phẩm** để trưng trên trang chủ: tên (3 thứ tiếng), mô tả ngắn, kiểu, đế, quai, **các dòng size khách được chọn**, nhãn MỚI, bật/tắt.
- **Màu của sản phẩm**: tên màu (3 thứ tiếng) và ảnh. Ảnh do anh tải lên **hoặc lấy ảnh cắt của một mẫu trong thư viện**.
- Trang chi tiết sản phẩm: ảnh theo màu đang chọn, chấm chọn màu, dòng size, nút **"Đặt sản phẩm này"**. Khách chọn một hoặc nhiều màu; mỗi màu thành một mẫu trong đơn.
- Người chưa đăng nhập thấy ảnh, tên, kiểu; phải đăng nhập mới thấy đủ màu, size và đặt hàng (mục 2).

### 6.3 Tài khoản khách

- **Đăng ký (bản "cao cấp", anh chốt):** họ tên, **số điện thoại**, **email**, mật khẩu và nhập lại mật khẩu (có nút hiện/ẩn và thanh báo độ mạnh), quốc gia, ngôn ngữ. Form đẹp theo phong cách Kho Việt (thẻ có ảnh, tiêu đề chữ có chân), báo lỗi ngay dưới từng ô bằng ngôn ngữ của khách.
- **Một người chỉ một tài khoản:** số điện thoại **và** email đều không được trùng với tài khoản khác. Số điện thoại được chuẩn hóa (bỏ khoảng trắng, dấu; `+84`/`0` và `+855`/`0` quy về một dạng) trước khi so. Đăng ký trùng thì báo "Số điện thoại (hoặc email) này đã có tài khoản, vui lòng đăng nhập hoặc lấy lại mật khẩu".
- **Xác nhận email (em quyết):** sau khi đăng ký, máy gửi link xác nhận vào email. Khách đặt hàng được ngay, nhưng **phải xác nhận email thì mới lấy lại mật khẩu bằng email được**. Như vậy email lấy lại mật khẩu chắc chắn là của chính khách.
- **Đăng nhập** bằng số điện thoại **hoặc** email, kèm mật khẩu. Có ô "Ghi nhớ đăng nhập". Anh (admin) dùng chung màn này (anh đồng ý).
- **Quên mật khẩu (anh chốt: ưu tiên email):** khách nhập email, máy gửi **link đặt lại mật khẩu** (dùng một lần, hết hạn sau 1 giờ). Đặt lại xong thì mọi phiên đăng nhập cũ bị đăng xuất. Dự phòng: anh vẫn tạo được link đặt lại trong khu quản lý cho khách nhắn qua Zalo.
- **Gửi email** cần một dịch vụ gửi mail và một tên miền riêng (mục 4).
- **Loại tiền mặc định** theo quốc gia: Việt Nam dùng VND, Campuchia dùng USD. Anh đổi được trong hồ sơ khách. **(em quyết)**
- Mỗi tài khoản khách có **một hồ sơ khách** (bảng `customers` hiện có) để đơn, báo giá và tiền nhận dùng chung cấu trúc với giai đoạn 1.
- **Khóa / mở khóa** tài khoản. Tài khoản bị khóa không đăng nhập được và mọi phiên đang mở bị đăng xuất.
- **Chống phá:** giới hạn số lần đăng nhập sai và số lần đăng ký theo số điện thoại và địa chỉ IP, giới hạn số ảnh tải lên mỗi ngày cho mỗi tài khoản. Có thể dùng Cloudflare Turnstile (miễn phí) ở màn đăng ký nếu thấy cần. Con số cụ thể để người code chọn.

### 6.4 Khách đặt hàng

Màn "Đặt hàng mới" của khách dùng lại màn nhập đơn của giai đoạn 1, gọn lại:

- Hai cách bắt đầu, dùng chung trong một đơn:
  - **Từ sản phẩm** ("Đặt sản phẩm này"): khách chọn **một hoặc nhiều màu**. Mỗi màu thành một mẫu trong đơn, có sẵn các dòng size của sản phẩm, khách chỉ nhập số đôi. Không cần ảnh.
  - **Từ ảnh riêng**: chọn ảnh, chạm gắn số từng đôi hoặc "Cả ảnh là 1 mẫu", như màn hình của anh.
- Mỗi mẫu: dòng số lượng (Nam / Nữ / dòng khác theo cài đặt), ba cách nhập (Đều mỗi size, Từng size, Tổng số đôi), màu và ghi chú. **Vật liệu** chọn được nếu khách biết, không bắt buộc.
- Thông tin đơn: ngày cần hàng, ghi chú, và **nơi nhận hàng bên Campuchia** (địa chỉ hoặc bến xe, chữ tự do). Anh chốt: **100% hàng đi Campuchia**, nên không có lựa chọn giao trong Việt Nam.
- Khách **không thấy và không sửa được giá** khi đặt. Không có "lịch sử giá".
- Tự lưu nháp. Bấm Gửi một lần chỉ tạo một đơn, giống giai đoạn 1.
- Đơn khách gửi có trạng thái **Chờ báo giá**, ghi rõ **"Khách tự đặt"** ở khu quản lý, và đếm trong nhóm **"Đơn khách mới"** ở trang chủ quản lý.
- Khách **sửa** được đơn khi còn "Chờ báo giá".
- Khách **hủy** được đơn khi còn "Chờ báo giá" **hoặc đã báo giá mà chưa đồng ý** (anh chốt: "báo giá rồi mà khách không chịu thì vẫn có thể hủy"). Khi khách bấm hủy, máy hỏi lý do (không bắt buộc) để anh xem.
- **Khách đã đồng ý thì xưởng mới đưa vào làm**, nên sau khi đồng ý khách không tự hủy được; muốn đổi thì nhắn xưởng, anh sửa theo luật giai đoạn 1 (sửa số thì ra báo giá phiên bản mới, khách đồng ý lại).
- Có ô **"Mẫu đặt riêng (không hiện cho khách khác)"** cho cả đơn và từng mẫu, mặc định **không tick** (anh chốt). Ngay cạnh ô có dòng giải thích: "Mẫu không tick sẽ hiện trong thư viện để khách khác tham khảo (chỉ ảnh đôi dép, không có ảnh gốc hay thông tin của bạn)."
- **Ảnh gốc** khách gửi chỉ khách đó và anh xem được. Ảnh cắt của mẫu không tick "đặt riêng" vào thư viện dùng chung (6.2).

### 6.5 Khu tài khoản của khách

- **Đơn của tôi:** danh sách đơn kèm trạng thái và ngày; chi tiết đơn gồm ảnh từng mẫu, số đôi, báo giá (đơn giá, thành tiền, tổng), nút **"Đồng ý báo giá"** (dùng cùng luật phiên bản như link báo giá), tiền đã trả và còn lại, ngày cần hàng.
- Link báo giá gửi qua Zalo (giai đoạn 1) **vẫn dùng được** như cũ cho khách chưa có tài khoản.
- **Hồ sơ:** tên, ngôn ngữ, đổi mật khẩu, đăng xuất.
- Toàn bộ khu khách theo 3 thứ tiếng, mặc định theo ngôn ngữ của khách. Tiếng Khmer vẫn đánh dấu chờ người bản xứ duyệt.

### 6.6 Khu quản lý của anh (thay đổi so với giai đoạn 1)

- Đường dẫn: khu quản lý chuyển sang `/quan-ly` vì `/` giờ là trang chủ công khai. Anh cài lại web lên màn hình chính iPhone với đường dẫn mới. **(em quyết)**
- Trang chủ quản lý thêm nhóm **"Đơn khách mới"** (khách tự đặt, chưa xem).
- Mục **Người dùng** riêng (anh chốt): danh sách tài khoản (tên, số điện thoại, email, đã xác nhận email chưa, ngày đăng ký, số đơn), tìm kiếm, **khóa / mở khóa**, "Tạo link đặt lại mật khẩu", mở hồ sơ khách và đơn của người đó.
- Mục **Sản phẩm** để tạo và sửa sản phẩm, màu, dòng size, ảnh (6.2).
- Mục **Trang chủ công khai** để quản lý poster, bộ sưu tập, sản phẩm nổi bật, thông tin xưởng (6.1).
- Mỗi mẫu trong thư viện thêm: **Mẫu đặt riêng**, **Ẩn khỏi thư viện**, **có logo thương hiệu**. Màn nhập đơn của anh thay ô "Cho khách xem" cũ bằng ô **"Mẫu đặt riêng"** (mặc định không tick).
- Đăng nhập của anh và của khách **dùng chung một màn đăng nhập** (anh đồng ý), làm thật đẹp theo phong cách Kho Việt. Máy tự đưa về đúng khu theo vai trò. Admin đăng nhập bằng tên như cũ.
- Dữ liệu thử giai đoạn 1 (khách Nga, Sola, đơn, thư viện, ảnh) **đã được xóa sạch** trên web thật ngày 23/11/2026 theo yêu cầu của anh; chỉ giữ tài khoản quản trị và cài đặt.

## 7. Giao diện (phong cách Kho Việt)

- **Màu:** nền `#f6f5ef`, giấy `#fffcf5`, chữ `#212d23`, chữ phụ `#535e51`, viền `#dfdfd3`, xanh rêu `#1b3b2c` / `#132f24`, xanh bạc hà `#e7efdb`, xanh chanh nhấn `#e8f3a3`, đỏ cảnh báo `#a43c30`. Thêm cam đất `#c96a3a` cho poster (em thêm).
- **Chữ:** tiêu đề Playfair Display (có chân, đậm), chữ thường Inter. Tiếng Khmer dùng Noto Sans Khmer. Có phông dự phòng của hệ thống khi mạng chậm.
- **Khối:** bo góc lớn (12–22 px), viền mảnh, bóng rất nhẹ. Khối nổi bật nền xanh rêu với nút xanh chanh. Biểu tượng dạng nét mảnh (không dùng emoji, không dùng ký hiệu chữ như hiện nay).
- **Hiện đại hơn bài thi:** chuyển trang có hiệu ứng nhẹ, khung tải dạng khối xám thay cho chữ "Đang tải…", thông báo nhỏ khi lưu xong, nút "+ Đơn mới" nổi.
- Áp dụng cho: trang chủ công khai, thư viện công khai, khu khách, **toàn bộ khu quản lý** (đăng nhập, trang chủ, đơn, nhập đơn, chi tiết và báo giá, khách, thư viện, cài đặt), trang báo giá cho khách. **Phiếu làm hàng in ra giữ trắng đen** để in rõ.
- **Nút quả cầu chọn ngôn ngữ** (anh chốt) ở đầu trang mọi khu: bấm mở danh sách Tiếng Việt / English / ខ្មែរ. Lựa chọn được nhớ (tài khoản thì lưu vào hồ sơ).
- **Nút sáng/tối** (anh chốt) ở đầu trang mọi khu, biểu tượng mặt trời/mặt trăng. Mặc định theo cài đặt của điện thoại, bấm thì nhớ lựa chọn. **Giao diện tối** giữ tinh thần Kho Việt: nền xanh rêu rất đậm `#0f1f18`, thẻ `#162a21`, chữ kem `#f3f1e7`, viền `#2a4034`, nút nhấn vẫn xanh chanh `#e8f3a3` chữ xanh đậm. Ảnh sản phẩm không bị đổi màu. **(em quyết các mã màu tối)**
- Phiếu làm hàng in ra luôn trắng đen, không theo chế độ tối.
- Chạm ≥ 44 px, độ tương phản chữ đạt chuẩn đọc được ở **cả hai chế độ**.

## 8. Dữ liệu (dự kiến, migration cộng thêm)

- `users`: thêm `role` (`admin` | `customer`, cột đã có), `phone` (duy nhất), `email` (duy nhất), `email_verified_at`, `customer_id`, `locked`, `created_at`.
- `customers`: thêm `country` đã có; tài khoản trỏ tới hồ sơ qua `users.customer_id`.
- `orders`: thêm `source` (`admin` | `customer`), `seen_by_admin`, `deliver_note` (nơi nhận bên Campuchia), `cancel_reason`.
- `designs`: thêm `is_private` (mẫu đặt riêng), `hidden` (anh ẩn), `has_brand_logo`, `source` (`admin` | `customer`), và số đơn đã dùng (tính khi hiển thị). Cột `allow_public` cũ được thay bằng quy tắc mới.
- Bảng mới `products` (tên 3 thứ tiếng, mô tả, kiểu, đế, quai, dòng size, nhãn MỚI, công khai, có logo, thứ tự) và `product_colors` (sản phẩm, tên màu 3 thứ tiếng, ảnh, mẫu thư viện nối tới nếu có, thứ tự).
- `order_items`: ghi sản phẩm và màu mà khách chọn (nếu đặt từ sản phẩm).
- `order_images` hoặc bảng ảnh: thêm người tải lên, để kiểm soát ai được xem ảnh.
- Bảng mới: `posters`, `collections`, `collection_products`, `password_resets`, `email_verifications`, bộ đếm giới hạn (đăng nhập sai, đăng ký, tải ảnh).
- `settings`: thêm thông tin xưởng (Zalo, Messenger, địa chỉ xưởng, địa chỉ kho).

Tên bảng và cột để người code quyết, miễn là dữ liệu đang chạy thật không mất.

**Lên bản mới (em quyết):**
- Migration chạy **tự động trong bước build của Cloudflare, trước khi đưa code mới lên** (`wrangler d1 migrations apply --remote` rồi `wrangler deploy`), để khu quản lý không bao giờ chạy code mới trên cơ sở dữ liệu cũ. Trước mỗi migration ghi lại mốc khôi phục D1 (Time Travel). Nếu khóa build thiếu quyền D1 thì báo anh thêm quyền.
- Dữ liệu thử đã xóa sạch, nên không có mẫu cũ nào cần chuyển đổi.

## 9. Bảo mật và phân quyền

- Mọi API khu khách kiểm tra **vai trò và quyền sở hữu** ở máy chủ: khách chỉ đọc và sửa đơn, ảnh, báo giá, tiền nhận **của chính hồ sơ khách gắn với tài khoản**. Gọi vào đơn của người khác phải trả về "không tìm thấy" như đơn không tồn tại.
- Khách **không gọi được** bất kỳ API nào của khu quản lý: giá, lịch sử giá, danh sách khách, xuất dữ liệu, cài đặt, thư viện nội bộ.
- Ảnh: ảnh công khai (mẫu được phép, poster) xem không cần đăng nhập; ảnh đơn chỉ chủ đơn và anh xem được; ảnh nội bộ chỉ anh xem.
- **Có bộ test riêng cho phân quyền**: với mỗi API, một khách gọi vào dữ liệu của khách khác và vào API quản lý đều phải bị chặn.
- Giữ các biện pháp giai đoạn 1: cookie HttpOnly/Secure, chặn Google ở trang riêng, không lộ link báo giá qua Referer.

## 10. Đã chốt cho giai đoạn kho và vận chuyển (ghi lại, chưa làm)

- **Đường đi của hàng:** nguyên liệu nhập về VN → nhiều xưởng gia công → xưởng của mình gom và đóng hàng → xe trung chuyển → chành → qua Campuchia → quản lý kho Cam nhận hàng → (1) nhập kho rồi xuất sau, hoặc (2) giao thẳng cho khách tại bến xe.
- **Bao hàng không ghi thông tin.** Mỗi bao có một mã ngẫu nhiên kèm QR; **QR chỉ chứa mã**, không chứa link web. Chỉ người đăng nhập (anh, xưởng đóng hàng, quản lý kho) quét bằng nút "Quét mã" trong web mới xem được nội dung bao. Quét bằng camera điện thoại là được, súng quét USB là tùy chọn. Có số thứ tự bao để đếm đủ.
- **Kho Cam có hai loại hàng:** hàng giữ hộ (thuộc đơn một khách) và hàng bán sẵn (bán dần cho bất kỳ khách nào). Chuyển giữ hộ sang bán sẵn cần anh duyệt. Trang chủ chỉ hiện hàng bán sẵn.
- **Quản lý kho Cam** dùng máy tính cơ bản, biết cả tiếng Việt và tiếng Khmer → màn hình song ngữ, đơn giản, nút to, chủ yếu quét và xác nhận.
- **Giá do anh quyết.** Quản lý kho không sửa giá, chỉ xuất hàng; tiền mặt thu tại kho ghi là **"thu hộ, chờ anh xác nhận"**.
- Tồn kho đếm theo **mẫu × màu × size × số đôi**.

## 11. Phần để người code tự quyết

Cách render trang công khai cho Google đọc được; cấu trúc thư mục và tên route chi tiết (trừ `/`, `/quan-ly`, khu khách); thư viện biểu tượng nét mảnh; cách nén và cắt ảnh poster; con số giới hạn chống phá; cách viết migration; hiệu ứng chuyển trang; bố cục chi tiết khu quản lý (theo phong cách mục 7).

## 12. Câu hỏi còn mở

- **Tên miền để gửi email:** chờ anh quyết (mua tên miền và dùng dịch vụ gửi mail miễn phí, hay cách khác).
