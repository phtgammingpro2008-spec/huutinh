// /kho is used on both sides of the border: every label in Vietnamese and Khmer at once.
// TODO-REVIEW-KM: Khmer wording needs review by a native speaker.
import type { ReactNode } from 'react';

export const K = {
  title: ['Kho HLUXURY', 'ឃ្លាំង HLUXURY'],
  scan: ['Quét mã', 'ស្កេនកូដ'],
  pack: ['Đóng bao', 'ខ្ចប់បាវ'],
  trips: ['Chuyến xe', 'ដំណើរឡាន'],
  receive: ['Nhận chuyến', 'ទទួលឡាន'],
  cam: ['Kho Cam', 'ឃ្លាំងកម្ពុជា'],
  deliver: ['Giao khách', 'ប្រគល់អតិថិជន'],
  logout: ['Đăng xuất', 'ចាកចេញ'],
  home: ['Trang đầu', 'ទំព័រដើម'],
  code: ['Mã bao', 'កូដបាវ'],
  camera: ['Mở camera', 'បើកកាមេរ៉ា'],
  cameraOff: ['Tắt camera', 'បិទកាមេរ៉ា'],
  pickToa: ['Chọn toa cần đóng', 'ជ្រើសការបញ្ជាទិញ'],
  noToa: ['Chưa có toa nào cần đóng', 'មិនមានការបញ្ជាទិញត្រូវខ្ចប់'],
  ordered: ['đặt', 'បញ្ជា'],
  packed: ['đã đóng', 'បានខ្ចប់'],
  sent: ['đã gửi', 'បានផ្ញើ'],
  left: ['còn', 'នៅសល់'],
  riOf: ['Số ri', 'ចំនួនរី'],
  extra: ['Gửi kèm (mẫu, vài đôi thêm…)', 'ផ្ញើបន្ថែម'],
  extraPairs: ['Số đôi gửi kèm', 'ចំនួនគូបន្ថែម'],
  makeBag: ['Tạo bao và in tem', 'បង្កើតបាវ និងបោះពុម្ព'],
  packMore: ['Đóng tiếp bao nữa', 'ខ្ចប់បាវបន្ទាប់'],
  over: ['Bao này làm dư so với số đặt', 'លើសចំនួនបញ្ជាទិញ'],
  overOk: ['Vẫn đóng', 'នៅតែខ្ចប់'],
  labels: ['Tem dán bao', 'ស្លាកបាវ'],
  print: ['In tem', 'បោះពុម្ព'],
  bagNo: ['Bao số', 'បាវទី'],
  newTrip: ['Mở chuyến mới', 'បើកដំណើរថ្មី'],
  loading: ['Đang xếp', 'កំពុងផ្ទុក'],
  running: ['Đang chạy', 'កំពុងធ្វើដំណើរ'],
  arrived: ['Đã tới Cam', 'បានមកដល់'],
  depart: ['Cho xe chạy', 'ឲ្យឡានចេញ'],
  departSure: ['Đúng, cho xe chạy', 'បាទ/ចាស ឲ្យឡានចេញ'],
  cancel: ['Thôi', 'បោះបង់'],
  remove: ['Bỏ khỏi chuyến', 'ដកចេញ'],
  bags: ['bao', 'បាវ'],
  orders: ['toa', 'ការបញ្ជាទិញ'],
  received: ['Đã nhận', 'បានទទួល'],
  notYet: ['Chưa quét', 'មិនទាន់ស្កេន'],
  missing: ['Thiếu', 'ខ្វះ'],
  close: ['Chốt nhận chuyến', 'បញ្ចប់ការទទួល'],
  closeSure: ['Đúng, chốt', 'បាទ/ចាស បញ្ចប់'],
  closeWarn: ['Bao chưa quét sẽ bị ghi là thiếu', 'បាវមិនទាន់ស្កេននឹងកត់ថាខ្វះ'],
  stock: ['Nhập kho', 'ដាក់ឃ្លាំង'],
  inStock: ['Trong kho', 'ក្នុងឃ្លាំង'],
  waiting: ['Chờ nhập kho', 'រង់ចាំដាក់ឃ្លាំង'],
  give: ['Giao', 'ប្រគល់'],
  confirmDeliver: ['Xác nhận đã giao', 'បញ្ជាក់ថាបានប្រគល់'],
  deliverNote: ['Ghi chú giao (nơi giao, người nhận)', 'កំណត់ចំណាំ'],
  delivered: ['Đã giao', 'បានប្រគល់'],
  empty: ['Chưa có gì', 'មិនទាន់មាន'],
  history: ['Lịch sử', 'ប្រវត្តិ'],
  reprint: ['In lại tem', 'បោះពុម្ពម្តងទៀត'],
  scanned: ['Đã quét', 'បានស្កេន'],
  trip: ['Chuyến', 'ដំណើរ'],
  toa: ['Toa', 'ការបញ្ជាទិញ'],
  pairs: ['đôi', 'គូ'],
  ri: ['ri', 'រី'],
  customer: ['Khách', 'អតិថិជន'],
  status: ['Trạng thái', 'ស្ថានភាព'],
  noCamera: ['Máy này không mở được camera. Gõ mã hoặc dùng súng quét.', 'មិនអាចបើកកាមេរ៉ា'],
  wrong: ['Không đọc được mã bao', 'មិនអាចអានកូដ'],
} as const satisfies Record<string, readonly [string, string]>;
export type KKey = keyof typeof K;

/** "Đóng bao · ខ្ចប់បាវ" as plain text (aria labels, titles). */
export const t2 = (k: KKey) => `${K[k][0]} · ${K[k][1]}`;

/** The two languages side by side; Khmer smaller, in its own font. */
export function B({ k, children }: { k: KKey; children?: ReactNode }) {
  return <span className="bi">{K[k][0]}{children}<span className="km" lang="km"> · {K[k][1]}</span></span>;
}

export const STATUS_K: Record<string, KKey> = {
  da_dong: 'packed', tren_xe: 'running', da_toi: 'arrived', thieu: 'missing', trong_kho: 'inStock', da_giao: 'delivered',
};
