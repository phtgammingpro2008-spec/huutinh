import type { Lang } from './types';

// UI strings for the public site and the customer area. Phase-1 quote page keys live in i18n.ts.
// TODO-REVIEW-KM: Khmer strings need review by a native speaker.
const vi = {
  'err.phone_taken': 'Số điện thoại này đã có tài khoản. Vui lòng đăng nhập hoặc lấy lại mật khẩu.',
  'err.email_taken': 'Email này đã có tài khoản. Vui lòng đăng nhập hoặc lấy lại mật khẩu.',
  'err.weak_password': 'Mật khẩu cần ít nhất 8 ký tự.',
  'err.bad_phone': 'Số điện thoại không hợp lệ.',
  'err.bad_email': 'Email không hợp lệ.',
  'err.bad_name': 'Vui lòng nhập họ tên.',
  'err.bad_country': 'Vui lòng chọn quốc gia.',
  'err.wrong_password': 'Sai thông tin đăng nhập hoặc mật khẩu.',
  'err.account_locked': 'Tài khoản đã bị khóa. Vui lòng liên hệ xưởng.',
  'err.too_many': 'Thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.',
  'err.bad_token': 'Link đã hết hạn hoặc đã được dùng. Vui lòng yêu cầu link mới.',
} as const;

export type UiKey = keyof typeof vi;

const en: Record<UiKey, string> = {
  'err.phone_taken': 'This phone number already has an account. Please log in or reset your password.',
  'err.email_taken': 'This email already has an account. Please log in or reset your password.',
  'err.weak_password': 'Password needs at least 8 characters.',
  'err.bad_phone': 'Invalid phone number.',
  'err.bad_email': 'Invalid email.',
  'err.bad_name': 'Please enter your name.',
  'err.bad_country': 'Please choose a country.',
  'err.wrong_password': 'Wrong login or password.',
  'err.account_locked': 'This account is locked. Please contact the workshop.',
  'err.too_many': 'Too many attempts. Please wait a few minutes and try again.',
  'err.bad_token': 'This link has expired or was already used. Please request a new one.',
};

const km: Record<UiKey, string> = {
  'err.phone_taken': 'លេខទូរស័ព្ទនេះមានគណនីរួចហើយ។ សូមចូល ឬកំណត់ពាក្យសម្ងាត់ឡើងវិញ។',
  'err.email_taken': 'អ៊ីមែលនេះមានគណនីរួចហើយ។ សូមចូល ឬកំណត់ពាក្យសម្ងាត់ឡើងវិញ។',
  'err.weak_password': 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ 8 តួអក្សរ។',
  'err.bad_phone': 'លេខទូរស័ព្ទមិនត្រឹមត្រូវ។',
  'err.bad_email': 'អ៊ីមែលមិនត្រឹមត្រូវ។',
  'err.bad_name': 'សូមបញ្ចូលឈ្មោះ។',
  'err.bad_country': 'សូមជ្រើសរើសប្រទេស។',
  'err.wrong_password': 'ព័ត៌មានចូល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។',
  'err.account_locked': 'គណនីនេះត្រូវបានចាក់សោ។ សូមទាក់ទងរោងចក្រ។',
  'err.too_many': 'ព្យាយាមច្រើនដងពេក។ សូមរង់ចាំបន្តិចហើយព្យាយាមម្តងទៀត។',
  'err.bad_token': 'តំណនេះផុតកំណត់ ឬត្រូវបានប្រើរួចហើយ។ សូមស្នើតំណថ្មី។',
};

export const uiDict: Record<Lang, Record<UiKey, string>> = { vi, en, km };

export function uiT(lang: Lang, key: UiKey, vars: Record<string, string | number> = {}): string {
  const s = (uiDict[lang] ?? vi)[key] ?? vi[key];
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
