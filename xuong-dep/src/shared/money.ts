import type { Currency, Lang } from './types';

const group = (digits: string, sep: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

/** Minor units → display. VND: "66.270.000 ₫"; USD: "$18.90" — same shape in every language. */
export function formatMoney(minor: number, c: Currency, _lang: Lang): string {
  const neg = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  if (c === 'VND') return `${neg}${group(String(abs), '.')} ₫`;
  const whole = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  return `${neg}$${group(String(whole), ',')}.${cents}`;
}

/** User input → minor units, or null when unreadable. */
export function parseMoney(input: string, c: Currency): number | null {
  let s = input.trim().toLowerCase().replace(/vnd|usd/g, '').replace(/[₫đ$\s]/g, '');
  if (!s) return null;
  if (c === 'VND') {
    let mult = 1;
    if (s.endsWith('tr')) { mult = 1_000_000; s = s.slice(0, -2); }
    else if (s.endsWith('k')) { mult = 1_000; s = s.slice(0, -1); }
    if (mult > 1) {
      if (!/^\d+([.,]\d+)?$/.test(s)) return null;
      return Math.round(parseFloat(s.replace(',', '.')) * mult);
    }
    if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(s)) return null;
    return parseInt(s.replace(/[.,]/g, ''), 10);
  }
  if (!/^\d{1,3}(,\d{3})*(\.\d{0,2})?$|^\d+(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s.replace(/,/g, '')) * 100);
}

/** Pair counts: 1410 → "1.410". */
export const formatQty = (n: number) => group(String(Math.round(n)), '.');
