export type Country = 'VN' | 'KH';
export const COUNTRIES: Country[] = ['VN', 'KH'];

/**
 * Phone in international form: "+84901234567" (VN, 9 digits after 0) or "+85512345678" (KH, 8–9 digits after 0).
 * A number already carrying +84/84 or +855/855 keeps its country; a local "0…" number uses `country`.
 */
export function normalizePhone(input: string, country: Country): string | null {
  if (typeof input !== 'string' || /[a-z]/i.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  let cc: '84' | '855';
  let national: string;
  if (digits.startsWith('855') && (digits.length === 11 || digits.length === 12)) { cc = '855'; national = digits.slice(3); }
  else if (digits.startsWith('84') && digits.length === 11) { cc = '84'; national = digits.slice(2); }
  else if (digits.startsWith('0')) { cc = country === 'KH' ? '855' : '84'; national = digits.slice(1); }
  else return null;
  if (cc === '84' && national.length !== 9) return null;
  if (cc === '855' && (national.length < 8 || national.length > 9)) return null;
  if (national.startsWith('0')) return null;
  return `+${cc}${national}`;
}

/** Every reading of a login identifier as a phone (local numbers may be VN or KH). */
export const phoneCandidates = (input: string): string[] =>
  [...new Set([normalizePhone(input, 'VN'), normalizePhone(input, 'KH')].filter((x): x is string => !!x))];

export function normalizeEmail(input: string): string | null {
  const e = typeof input === 'string' ? input.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? e : null;
}
