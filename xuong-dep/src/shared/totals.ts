import type { Item, Line } from './types';

export function sizesOf(l: Pick<Line, 'sizeFrom' | 'sizeTo'>): number[] {
  const out: number[] = [];
  for (let s = l.sizeFrom; s <= l.sizeTo; s++) out.push(s);
  return out;
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function lineQty(l: Line): number {
  if (l.mode === 'total') return n(l.qtyEach);
  if (l.mode === 'even') return n(l.qtyEach) * sizesOf(l).length;
  return sizesOf(l).reduce((sum, s) => sum + n(l.perSize[String(s)]), 0);
}

export const itemQty = (i: Item): number => i.lines.reduce((s, l) => s + lineQty(l), 0);
export const orderQty = (items: Item[]): number => items.reduce((s, i) => s + itemQty(i), 0);

export function lineAmount(l: Line): number | null {
  return l.unitPrice == null ? null : lineQty(l) * l.unitPrice;
}

export function orderAmount(items: Item[]): { amount: number; missingPrice: boolean } {
  let amount = 0;
  let missingPrice = false;
  for (const i of items) for (const l of i.lines) {
    const a = lineAmount(l);
    if (a == null) missingPrice = true; else amount += a;
  }
  return { amount, missingPrice };
}

/** Change a line's size range: per-size counts still in range are kept, new sizes start at 0. */
export function resizeLine(l: Line, from: number, to: number): Line {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const perSize: Record<string, number> = {};
  for (let s = a; s <= b; s++) perSize[String(s)] = n(l.perSize[String(s)]);
  return { ...l, sizeFrom: a, sizeTo: b, perSize };
}

/** Size → pair count for display (even/per_size). `total` lines return {}. */
export function lineSizes(l: Line): Record<string, number> {
  if (l.mode === 'total') return {};
  const out: Record<string, number> = {};
  for (const s of sizesOf(l)) out[String(s)] = l.mode === 'even' ? n(l.qtyEach) : n(l.perSize[String(s)]);
  return out;
}
