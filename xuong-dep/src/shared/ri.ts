// Ri: the workshop packs and counts by size runs. One ri of a size line is one pair of each size in it
// (Nam 39–44 → 6 pairs, Nữ 36–40 → 5 pairs). Orders are counted in ri per line; bags record whole ri per line.
import { lineQty, sizesOf } from './totals';
import type { Item } from './types';

/** lineKey → whole ri in a bag. */
export type RiCount = Record<string, number>;
export type OrderedLine = { pairs: number; perRi: number; ri: number };

const round1 = (x: number) => Math.round(x * 10) / 10;

/** What an order asks for, per size line: pairs, pairs per ri, and ri (1 decimal when the counts are uneven). */
export function orderedRi(items: Item[]): Record<string, OrderedLine> {
  const out: Record<string, OrderedLine> = {};
  for (const it of items) {
    for (const l of it.lines) {
      const perRi = Math.max(1, sizesOf(l).length);
      const cur = out[l.lineKey] ?? { pairs: 0, perRi, ri: 0 };
      cur.pairs += lineQty(l);
      cur.ri = round1(cur.pairs / cur.perRi);
      out[l.lineKey] = cur;
    }
  }
  return out;
}

export function pairsOf(ri: RiCount, perRi: Record<string, number>): number {
  return Object.entries(ri).reduce((s, [k, n]) => s + n * (perRi[k] ?? 0), 0);
}

/** Bag codes: HLX- + 10 characters without look-alikes (no 0/O/1/I/L). */
export const BAG_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newBagCode(): string {
  const chars: string[] = [];
  const buf = new Uint8Array(32);
  while (chars.length < 10) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (chars.length === 10) break;
      if (b < 248) chars.push(BAG_ALPHABET[b % 31]); // 248 = 8 × 31: no bias
    }
  }
  return `HLX-${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
}

/** Accepts what a scanner or a person types (lower case, spaces, missing dashes or prefix); null when it cannot be a bag code. */
export function normalizeBagCode(input: string): string | null {
  let s = input.toUpperCase().replace(/[\s-]/g, '');
  if (s.startsWith('HLX')) s = s.slice(3);
  if (s.length !== 10 || [...s].some((ch) => !BAG_ALPHABET.includes(ch))) return null;
  return `HLX-${s.slice(0, 5)}-${s.slice(5)}`;
}
