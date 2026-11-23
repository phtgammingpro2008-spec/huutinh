import { CURRENCIES, LANGS, type Currency, type Lang } from '../shared/types';
import { HttpError } from './http';

export function lang(v: unknown, fallback: Lang = 'vi'): Lang {
  if (v === undefined || v === null || v === '') return fallback;
  if (!LANGS.includes(v as Lang)) throw new HttpError(400, 'Ngôn ngữ chỉ nhận vi, en hoặc km');
  return v as Lang;
}

export function currency(v: unknown, fallback: Currency = 'VND'): Currency {
  if (v === undefined || v === null || v === '') return fallback;
  if (!CURRENCIES.includes(v as Currency)) throw new HttpError(400, 'Chỉ nhận VND hoặc USD');
  return v as Currency;
}

export function int(v: unknown, msg: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new HttpError(400, msg);
  return v;
}

export const optId = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 100) : null);
