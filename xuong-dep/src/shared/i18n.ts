import type { Lang } from './types';

export const QUOTE_KEYS = [
  'page.title', 'order', 'customer', 'design', 'material.sole', 'material.strap', 'material.style', 'color',
  'size', 'pairs', 'unitPrice', 'amount', 'total.pairs', 'total.amount', 'neededBy', 'sizeSplit',
  'accept', 'accepting', 'accepted', 'acceptedAt', 'cancelled', 'updating', 'quote.changed', 'reload',
  'notFound', 'error', 'version', 'language', 'lang.vi', 'lang.en', 'lang.km', 'pairsUnit',
] as const;
export type QuoteKey = (typeof QUOTE_KEYS)[number];

const vi: Record<QuoteKey, string> = {
  'page.title': 'Báo giá',
  order: 'Đơn hàng',
  customer: 'Khách hàng',
  design: 'Mẫu',
  'material.sole': 'Đế',
  'material.strap': 'Quai',
  'material.style': 'Kiểu',
  color: 'Màu / ghi chú',
  size: 'Size',
  pairs: 'Số đôi',
  unitPrice: 'Đơn giá',
  amount: 'Thành tiền',
  'total.pairs': 'Tổng số đôi',
  'total.amount': 'Tổng tiền',
  neededBy: 'Ngày cần hàng',
  sizeSplit: 'Chia size theo chuẩn xưởng',
  accept: 'Đồng ý báo giá',
  accepting: 'Đang gửi…',
  accepted: 'Bạn đã đồng ý báo giá này. Cảm ơn bạn!',
  acceptedAt: 'Đã đồng ý lúc {time}',
  cancelled: 'Đơn hàng này đã bị hủy.',
  updating: 'Báo giá đang được cập nhật, vui lòng quay lại sau.',
  'quote.changed': 'Báo giá đã thay đổi, vui lòng tải lại trang',
  reload: 'Tải lại',
  notFound: 'Không tìm thấy báo giá.',
  error: 'Có lỗi xảy ra, vui lòng thử lại.',
  version: 'Phiên bản {n}',
  language: 'Ngôn ngữ',
  'lang.vi': 'Tiếng Việt',
  'lang.en': 'English',
  'lang.km': 'ខ្មែរ',
  pairsUnit: 'đôi',
};

const en: Record<QuoteKey, string> = {
  'page.title': 'Quotation',
  order: 'Order',
  customer: 'Customer',
  design: 'Design',
  'material.sole': 'Sole',
  'material.strap': 'Strap',
  'material.style': 'Style',
  color: 'Color / note',
  size: 'Size',
  pairs: 'Pairs',
  unitPrice: 'Unit price',
  amount: 'Amount',
  'total.pairs': 'Total pairs',
  'total.amount': 'Total amount',
  neededBy: 'Needed by',
  sizeSplit: 'Sizes split by workshop standard',
  accept: 'Accept quote',
  accepting: 'Sending…',
  accepted: 'You have accepted this quote. Thank you!',
  acceptedAt: 'Accepted at {time}',
  cancelled: 'This order has been cancelled.',
  updating: 'This quote is being updated, please check back later.',
  'quote.changed': 'This quote has changed, please reload',
  reload: 'Reload',
  notFound: 'Quote not found.',
  error: 'Something went wrong, please try again.',
  version: 'Version {n}',
  language: 'Language',
  'lang.vi': 'Tiếng Việt',
  'lang.en': 'English',
  'lang.km': 'ខ្មែរ',
  pairsUnit: 'pairs',
};

// TODO-REVIEW-KM: Khmer strings need review by a native speaker.
const km: Record<QuoteKey, string> = {
  'page.title': 'តារាងតម្លៃ',
  order: 'ការបញ្ជាទិញ',
  customer: 'អតិថិជន',
  design: 'ម៉ូដ',
  'material.sole': 'បាតស្បែកជើង',
  'material.strap': 'ខ្សែស្បែកជើង',
  'material.style': 'ប្រភេទ',
  color: 'ពណ៌ / កំណត់សម្គាល់',
  size: 'ទំហំ',
  pairs: 'ចំនួនគូ',
  unitPrice: 'តម្លៃរាយ',
  amount: 'ទឹកប្រាក់',
  'total.pairs': 'ចំនួនគូសរុប',
  'total.amount': 'ទឹកប្រាក់សរុប',
  neededBy: 'ថ្ងៃត្រូវការទំនិញ',
  sizeSplit: 'បែងចែកទំហំតាមស្តង់ដាររោងចក្រ',
  accept: 'យល់ព្រមតារាងតម្លៃ',
  accepting: 'កំពុងផ្ញើ…',
  accepted: 'អ្នកបានយល់ព្រមតារាងតម្លៃនេះហើយ។ សូមអរគុណ!',
  acceptedAt: 'បានយល់ព្រមនៅ {time}',
  cancelled: 'ការបញ្ជាទិញនេះត្រូវបានលុបចោល។',
  updating: 'តារាងតម្លៃកំពុងធ្វើបច្ចុប្បន្នភាព សូមត្រឡប់មកវិញពេលក្រោយ។',
  'quote.changed': 'តារាងតម្លៃបានផ្លាស់ប្តូរ សូមផ្ទុកទំព័រឡើងវិញ',
  reload: 'ផ្ទុកឡើងវិញ',
  notFound: 'រកមិនឃើញតារាងតម្លៃ។',
  error: 'មានបញ្ហា សូមព្យាយាមម្តងទៀត។',
  version: 'កំណែ {n}',
  language: 'ភាសា',
  'lang.vi': 'Tiếng Việt',
  'lang.en': 'English',
  'lang.km': 'ខ្មែរ',
  pairsUnit: 'គូ',
};

export const dict: Record<Lang, Record<QuoteKey, string>> = { vi, en, km };

export function t(lang: Lang, key: QuoteKey, vars: Record<string, string | number> = {}): string {
  const s = (dict[lang] ?? vi)[key] ?? vi[key];
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Must stay equal to the seed in schema/schema.sql (checked by a test). */
export const DEFAULT_QUOTE_MESSAGE: Record<Lang, string> = {
  vi: 'HLUXURY gửi báo giá đơn {code}, tổng {total}. Mời anh/chị xem và bấm Đồng ý tại: {url}',
  en: 'HLUXURY: here is the quote for order {code}, total {total}. Please review and tap Accept here: {url}',
  // TODO-REVIEW-KM
  km: 'HLUXURY៖ នេះជាតារាងតម្លៃសម្រាប់ការបញ្ជាទិញ {code} សរុប {total}។ សូមពិនិត្យ ហើយចុចយល់ព្រមនៅទីនេះ៖ {url}',
};

export function fillMessage(template: string, vars: { code: string; url: string; total: string }): string {
  return template.replace(/\{(code|url|total)\}/g, (_m, k: 'code' | 'url' | 'total') => vars[k]);
}
