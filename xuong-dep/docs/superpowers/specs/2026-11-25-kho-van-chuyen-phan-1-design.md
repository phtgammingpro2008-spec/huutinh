# Thiết kế: Kho và vận chuyển, phần 1 (bao hàng, chuyến xe, kho Cam)

Ngày: 25/11/2026 · Trạng thái: **anh đã duyệt 25/11/2026**

Quy ước: "anh" là chủ xưởng (tài khoản admin001). Mục ghi **(em quyết)** là em tự chọn, anh chưa duyệt. Bản này nối tiếp `2026-11-23-web-dat-hang-khach-design.md`. Mục 10 của bản đó ghi các quyết định anh chốt cho phần kho từ 23/11. Bản này dùng lại những quyết định đó, chỗ nào khác thì ghi rõ ở mục 11.

Sơ đồ tổng thể đã gửi anh: https://claude.ai/artifact/SzHMLr5n41yWAZQ4ZAFhd9

---

## 1. Mục đích và lý do

Anh muốn **một vòng khép kín từ nguyên liệu tới tay khách, cả bên mình lẫn bên Cam**, chặt chẽ và bảo mật, chạy trên cơ sở dữ liệu của web và mã QR.

Vấn đề thật hiện nay (anh kể 25/11):
- Một toa giao cho xưởng làm. Giữa chừng xưởng **hết nguyên liệu đột ngột** nên chuyển sang làm toa khác.
- Vì vậy một toa bị làm rải rác, **gửi qua Cam nhiều chuyến, nhiều ngày**. Rất lộn xộn: không ai nắm toa nào đã đi bao nhiêu, còn thiếu bao nhiêu.
- Chưa có hệ thống gì: không giấy tờ đi kèm chuyến, kho hai bên không chia khu hay kệ.
- Dạo này bị phá giá, bị cướp khách, số chuyến giảm (trước đây mỗi ngày 1 xe, nhiều thì 2 xe).

Vòng khép kín chia 3 phần, làm lần lượt (anh đồng ý 25/11):
1. **Phần 1 (bản này):** bao hàng, tem QR, chuyến xe, nhận hàng bên Cam, kho Cam, giao khách.
2. Phần 2: nguyên liệu (nhập, xuất, tồn, báo sắp hết). Làm khi xưởng thống kê xong tồn ban đầu.
3. Phần 3: sản xuất theo toa, nối phần 2 với phần 1.

**Thành công nghĩa là:**
- Mở một toa bất kỳ là thấy ngay: đã gửi bao nhiêu bao, bao nhiêu ri Nam, bao nhiêu ri Nữ, **còn thiếu bao nhiêu**, từng bao đang ở đâu.
- Xe tới Cam mà thiếu bao thì web chỉ ra **đúng mã bao thiếu** trong vài phút, không phải đợi tới lúc khách kêu.
- Khách sỉ mở đơn trên web thấy toa của mình đi tới đâu. Đây là điểm cộng giữ khách mà bên phá giá khó có (em đề xuất, anh đồng ý khi chọn cách A).

## 2. Mục tiêu, không làm, không được xảy ra

**Mục tiêu:** như mục 1, phần "thành công".

**Không làm trong phần 1:** nguyên liệu, sản xuất, hàng bán sẵn ở kho Cam (xem mục 11), chia khu trong kho (mục 4c), giấy tờ hải quan, phí vận chuyển, chọn nhà xe hay chành, lưu lần quét khi mất mạng (wifi ở xưởng và kho Cam ổn, anh cho biết 25/11).

**Không được xảy ra:**
- Người ngoài nhặt được bao, quét tem mà đọc ra được tên, số điện thoại, địa chỉ hay giá của khách.
- Công nhân xưởng xem được giá, công nợ hay thông tin liên lạc của khách.
- Ai đó, kể cả anh, sửa hoặc xóa lịch sử quét để che một bao bị mất.
- Quy trình rườm rà tới mức công nhân bỏ không quét. Mỗi lần quét phải nhanh hơn ghi sổ tay.

## 3. Đơn vị đếm: ri

- Xưởng đóng bao **theo ri**, không đếm từng size (anh chốt 25/11).
- **1 ri Nam = 6 đôi (size 39 tới 44). 1 ri Nữ hay số nhỏ = 5 đôi (size 36 tới 40).** Ri lấy theo các dòng size trong Cài đặt: mỗi dòng size là một loại ri, số đôi một ri bằng số size của dòng đó. Anh thêm dòng size mới thì tự có thêm loại ri mới.
- Lúc đóng bao, công nhân chỉ nhập **số ri của mỗi loại**. Web tự tính số đôi.
- **Toa đặt bao nhiêu ri:** cộng các mẫu trong đơn theo từng dòng size, lấy số đôi chia cho số size của dòng. Khách nhập "10 đôi mỗi size" ở dòng Nam thì ra đúng 10 ri. Nếu chia không chẵn (khách nhập lệch từng size), web hiện số ri lẻ một chữ số thập phân, kèm số đôi **(em quyết)**.
- Một bao chỉ chứa hàng của **một toa**. Một toa có **nhiều bao** (anh chốt 25/11).
- Không ghi bao chứa mẫu nào (anh chốt: chỉ ghi tổng theo ri).

## 4. Đường đi và trạng thái của một bao

```
Đã đóng → Trên xe → Đã tới Cam → Trong kho Cam → Đã giao
                └→ (chốt nhận mà không quét được) Thiếu khi tới
Bất kỳ lúc nào (chỉ Chủ): Thất lạc · Hư hỏng (kèm lý do, có thể kèm ảnh)
```

- **Đã đóng:** công nhân tạo bao tại xưởng, in tem, dán lên bao.
- **Trên xe:** bao được quét vào một chuyến xe đang xếp, rồi chuyến được "Cho xe chạy".
- **Đã tới Cam:** Hào quét bao lúc dỡ xe.
- **Thiếu khi tới:** Hào bấm "Chốt nhận chuyến" mà bao này chưa được quét. Nếu sau đó quét được (tới muộn, nằm lẫn xe khác) thì tự về "Đã tới Cam", lịch sử vẫn giữ.
- **Trong kho Cam:** Hào nhập kho chờ giao.
- **Đã giao:** Hào quét lúc giao cho khách, ở kho hay ở bến xe. **Khách không bắt buộc quét (em quyết, anh không phản đối).**
- Từ "Đã tới Cam", Hào có thể giao thẳng mà không cần qua kho.

**Toa đủ hàng:** khi tổng số đôi các bao "Đã giao" bằng hoặc vượt số đôi đặt, toa tự chuyển sang trạng thái **Đã giao** **(em quyết)**. Khi toa "Khách đồng ý" có bao đầu tiên được đóng, toa tự chuyển sang **Đang sản xuất** **(em quyết)**. Anh vẫn đổi trạng thái tay được như hiện nay.

**Toa nào được đóng bao:** chỉ toa đang "Khách đồng ý" hoặc "Đang sản xuất". Toa "Đã giao" muốn đóng thêm thì Chủ phải mở lại bằng tay trước. Toa chờ báo giá, đã hủy hoặc hoàn tất thì không đóng được **(em quyết)**.

**Sửa sai:**
- Bao quét nhầm lên xe thì bỏ khỏi chuyến được, nhưng chỉ khi xe chưa chạy.
- Bao tạo nhầm (chưa lên xe) thì Chủ bấm "Hủy bao". Bao không bị xóa mà chuyển sang trạng thái Đã hủy, có ghi lịch sử.
- Toa bị hủy khi đã có bao: các bao vẫn giữ nguyên để Quản lý xử lý tay **(em quyết)**.

**Đóng dư:** nếu một bao làm tổng số ri gửi vượt số đặt, web hỏi lại "Toa này chỉ đặt X ri, bao này làm dư Y ri, vẫn đóng?" và đánh dấu "gửi dư" **(em quyết)**.

## 4b. Hàng gửi kèm

Toa hay gửi kèm hàng mẫu hoặc vài đôi thêm (anh cho biết 25/11, "phần phụ thôi").
- Lúc đóng bao có ô **"Gửi kèm"** (không bắt buộc): ghi chữ tự do, ví dụ "2 đôi mẫu quai mới", và số đôi nếu muốn.
- Hàng gửi kèm **không tính vào số ri đặt hay còn thiếu** của toa, và không tự tính tiền. Muốn tính tiền thì anh sửa đơn như hiện nay **(em quyết)**.
- Một bao có thể chỉ chứa hàng gửi kèm, tức 0 ri nhưng có ghi gửi kèm. Bao này vẫn có tem QR và đi qua các chặng như mọi bao khác.
- Hào và khách thấy dòng "Gửi kèm: …" ở bao đó và ở toa.

## 4c. Chia khu trong kho (để sau, chưa làm trong phần 1)

**Anh muốn để từ từ, bàn lại với mẹ trước (25/11).** Phần 1 không làm chia khu, chỉ ghi bao "trong kho bên mình" hoặc "trong kho Cam". Cách làm nhẹ em đã đề xuất, giữ lại để bàn tiếp:
- Chủ hoặc Quản lý đặt tên các khu trong web, ví dụ Khu A, Khu B, Góc cửa, Kệ 1. Mỗi khu thuộc một kho: **kho bên mình** hoặc **kho Cam**.
- Web in **một tờ A4 có QR cho mỗi khu** để dán lên tường hoặc cột.
- Lúc nhập kho: quét bao rồi quét tờ khu. **Quét khu không bắt buộc.** Quên quét thì bao vẫn vào kho, ghi "chưa rõ khu".
- Chuyển bao sang khu khác: quét bao rồi quét tờ khu mới, có ghi lịch sử.
- Mở một toa là thấy "3 bao ở Khu B, 1 bao ở Khu C".
- Bên mình: bao đóng xong chờ lên xe cũng quét khu được. Không bắt buộc.

## 5. Tem QR

- **QR chỉ chứa mã bao, không chứa đường link web** (anh chốt 23/11). Người ngoài quét bằng camera thường chỉ thấy một chuỗi ký tự, không mở được gì.
- Mã bao ngẫu nhiên, không đoán được, dạng `HLX-7K2Q-94XM` (10 ký tự chữ và số, bỏ các ký tự dễ nhầm như O/0, I/1).
- Chỉ người **đã đăng nhập** (Xưởng, Quản lý, Chủ) quét bằng nút **"Quét mã"** trong web mới xem được nội dung bao.
- **Trên tem in:** mã QR, mã bao dạng chữ, "Bao số 3" (thứ tự trong toa), số ri trong bao. **Không in** tên khách, mã toa, số điện thoại, địa chỉ, giá. Không in mã toa cũng là theo ý "bao hàng không ghi thông tin" của anh **(em quyết)**.
- **In tem:** máy in thường, giấy decal A4 chia sẵn ô (loại 3 × 7 = 21 tem mỗi tờ, tem 70 × 42 mm, bán sẵn ở nhà sách). Có in lại tem nếu tem rách, và mọi lần in lại đều được ghi vào lịch sử **(em quyết)**.

## 6. Quét mã

- Có hai cách quét, trên cùng một màn hình **(em quyết)**:
  - **Camera:** dùng camera điện thoại hoặc webcam ngay trong web, không cần cài app.
  - **Súng quét USB:** cắm vào máy tính là dùng (anh chốt 23/11 là tùy chọn). Ô nhập mã luôn sẵn sàng, súng quét "gõ" mã vào rồi tự nhấn Enter.
- Gõ tay mã in trên tem cũng được, dùng khi tem bị nhòe.
- Quét xong có tiếng "bíp" và màu xanh nếu đúng, màu đỏ kèm lý do nếu sai, ví dụ "Bao này thuộc chuyến khác". Quét liên tục được, không phải bấm thêm gì.

## 7. Tài khoản và quyền

Thêm loại tài khoản mới **Xưởng** cho công nhân. Chủ tạo và khóa tài khoản này trong Cài đặt → Người dùng, giống tài khoản Quản lý.

| Việc | Xưởng (công nhân) | Quản lý (Hào) | Chủ (admin001) |
|---|---|---|---|
| Tạo bao, in tem, in lại tem | Được | Được | Được |
| Mở chuyến, quét bao lên xe, cho xe chạy | Được | Được | Được |
| Nhận chuyến, chốt nhận, nhập kho Cam, giao khách | Không | Được | Được |
| Sửa số ri của bao đã đóng (có ghi lịch sử) | Không | Không | Được |
| Đánh dấu Thất lạc, Hư hỏng | Không | Không | Được |
| Hủy bao tạo nhầm, mở lại toa đã giao | Không | Không | Được |
| Xem tên, số điện thoại, địa chỉ khách, giá, công nợ | Không | Được | Được |
| Tạo, khóa tài khoản Xưởng | Không | Không | Được |

- **Mọi việc chỉnh sửa chỉ admin001 làm được** (anh chốt 25/11). Quản lý và Xưởng chỉ làm các bước của quy trình.
- Công nhân chọn toa để đóng bao bằng **mã toa và ảnh các mẫu** trong toa, kèm số ri đặt, đã đóng, còn thiếu. Không thấy tên khách hay giá.
- **Lịch sử quét không ai sửa hay xóa được, kể cả Chủ.** Mỗi dòng ghi: bao nào, việc gì, ai làm, lúc nào, thuộc chuyến nào, ghi chú. Sửa số ri là thêm một dòng mới "đổi từ X thành Y", không ghi đè **(em quyết)**.
- Tài khoản Xưởng đăng nhập ở trang đăng nhập chung, xong vào thẳng khu Kho.
- Ảnh công nhân được xem: chỉ ảnh cắt của các mẫu thuộc toa đang mở để đóng bao. Không xem được ảnh gốc khách gửi **(em quyết)**.

## 8. Màn hình

**Khu Kho `/kho`** dùng chung cho Xưởng, Quản lý và Chủ:
- Thiết kế cho cả điện thoại lẫn máy tính cơ bản ở kho Cam: nút to, chữ to, ít bước.
- **Song ngữ Việt và Khmer** cho mọi nút và thông báo, hiện cả hai thứ tiếng cùng lúc (anh chốt 23/11 cho quản lý kho Cam).
- Các màn hình:
  1. **Quét mã:** quét một bao bất kỳ để xem bao đó và làm việc tiếp theo được phép.
  2. **Đóng bao:** chọn toa, nhập số ri từng loại, bấm "Tạo bao và in tem". Có nút "Đóng tiếp bao nữa" cho toa đang làm.
  3. **Chuyến xe:** mở chuyến mới, quét các bao lên xe (thấy đếm số bao và số toa), bấm "Cho xe chạy".
  4. **Nhận chuyến (bên Cam):** chọn chuyến đang chạy, quét từng bao, thấy "đã nhận 38 / 40", bấm "Chốt nhận chuyến". Bao còn thiếu hiện ra bằng mã.
  5. **Kho Cam:** danh sách bao đang trong kho, gom theo toa, mỗi toa có nút "Giao".
  6. **Giao khách:** quét các bao giao cho khách, bấm "Xác nhận đã giao".

**Khu quản lý `/quan-ly`:**
- Trang chi tiết đơn có thêm phần **"Vận chuyển"**: danh sách bao (mã, ri, trạng thái, chuyến, ngày), tổng đặt, đã đóng, đã giao, còn thiếu theo từng loại ri, lịch sử quét.
- Thêm mục **"Kho"** trong thanh dưới hoặc trang chủ quản lý: các chuyến đang chạy, chuyến có bao thiếu, số bao đang trong kho Cam. Bấm vào mở khu `/kho`.

**Khu khách `/tai-khoan`:** trang chi tiết đơn có thêm phần **"Hàng của bạn"**:
- Đã gửi bao nhiêu bao, bao nhiêu ri; còn thiếu bao nhiêu ri; số bao đang trên xe, đã tới Cam, đã giao.
- Không hiện mã bao, không hiện ghi chú nội bộ, không hiện bao "Thất lạc" hay "Hư hỏng" cho tới khi Quản lý xử lý xong. Bao đang có vấn đề hiện chung là "đang kiểm tra" **(em quyết)**.

## 9. Tiền (không làm trong phần 1)

Ngày 23/11 có ý ghi tiền mặt thu tại kho Cam là "thu hộ, chờ anh xác nhận". Ngày 25/11 anh cho biết **tiền đa số là chuyển khoản**, nên phần 1 không làm thu hộ. Tiền khách trả anh vẫn ghi ở mục "Tiền nhận" trong đơn như hiện nay. Màn hình kho không có gì liên quan tới tiền.

## 10. Báo qua Telegram

Dùng Telegram đã kết nối (chỉ chủ nhận):
- Xe chạy: "Chuyến C251125-1 chạy: 40 bao, 6 toa".
- Chốt nhận có thiếu: "Chuyến C251125-1 tới Cam: nhận 38/40, thiếu HLX-7K2Q-94XM, HLX-3PZ8-1QRA".
- Toa đủ hàng: "Toa DH261125-001 đã giao đủ".

## 11. Chỗ khác với ghi chú ngày 23/11 (cần anh xác nhận)

1. **Gia công bên ngoài:** ngày 23/11 anh tả đường đi là "nguyên liệu → nhiều xưởng gia công → xưởng của mình gom và đóng hàng → xe trung chuyển → chành → qua Cam". Hôm nay anh nói "100% xưởng của mình". Phần 1 bắt đầu từ lúc đóng bao nên không bị ảnh hưởng. Nhưng phần 3 (sản xuất) sẽ khác hẳn tùy câu trả lời.
2. **Hàng bán sẵn ở kho Cam:** ngày 23/11 anh chốt kho Cam có hai loại hàng, hàng giữ hộ theo toa và hàng bán sẵn bán dần cho ai cũng được, tồn kho đếm theo mẫu × màu × size × số đôi. Nhưng hôm nay anh chốt bao chỉ ghi tổng số ri, không ghi mẫu. Hai điều này không đi chung được: muốn bán sẵn thì phải biết trong kho có mẫu nào, size nào. **Em để hàng bán sẵn sang phần sau.** Phần 1 chỉ có hàng giữ hộ theo toa.
3. **Chặng trung chuyển và chành:** ngày 23/11 có "xe trung chuyển → chành". Phần 1 gộp thành một "chuyến xe" từ xưởng tới Cam. Nếu cần biết bao đang ở chành thì thêm một lần quét giữa đường.

## 12. Phần để người lập trình tự quyết

- Thư viện tạo mã QR và đọc QR từ camera (ưu tiên thư viện nhỏ đóng gói chung với web, dùng tính năng đọc mã sẵn của trình duyệt nếu có).
- Cách in tem từ trình duyệt.
- Mã chuyến xe (ví dụ `C251125-1`).
- Cấu trúc bảng dữ liệu và cách khóa không cho sửa lịch sử (ví dụ trigger chặn UPDATE và DELETE trên bảng lịch sử).
- Tên đường dẫn API.
- Âm thanh bíp.
- Bố cục chi tiết khu `/kho`, theo phong cách đêm và vàng hiện có.

## 13. Câu hỏi còn mở

Không còn. Ba điểm ở mục 11 em làm theo hướng đã nói với anh ngày 25/11, anh không phản đối:
- hàng bán sẵn để phần sau;
- một chuyến xe thẳng từ xưởng tới Cam, không có chặng chành;
- chuyện gia công bên ngoài để tới phần sản xuất.
