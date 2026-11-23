import { describe, expect, test } from 'bun:test';
import type { Item, Line } from '../../src/shared/types';
import { itemQty, lineAmount, lineQty, orderAmount, orderQty, resizeLine, sizesOf } from '../../src/shared/totals';

const line = (p: Partial<Line>): Line => ({
  id: 'l', lineKey: 'nam', sizeFrom: 39, sizeTo: 44, mode: 'even', qtyEach: 0, perSize: {}, unitPrice: null, ...p,
});
const item = (lines: Line[]): Item => ({
  id: 'i', designId: 'd', imageId: null, tagNo: 1, tapX: null, tapY: null, crop: null, cropKey: '',
  soleId: null, strapId: null, styleId: null, colorNote: '', lines,
});

describe('totals', () => {
  test('sizesOf lists the inclusive range', () => {
    expect(sizesOf(line({ sizeFrom: 39, sizeTo: 44 }))).toEqual([39, 40, 41, 42, 43, 44]);
  });
  test('even mode 39–44 × 235 = 1410', () => {
    expect(lineQty(line({ qtyEach: 235 }))).toBe(1410);
  });
  test('per_size mode sums only sizes in range', () => {
    expect(lineQty(line({ mode: 'per_size', sizeFrom: 39, sizeTo: 40, perSize: { '39': 10, '40': 20, '41': 5 } }))).toBe(30);
  });
  test('total mode ignores the range', () => {
    expect(lineQty(line({ mode: 'total', qtyEach: 30 }))).toBe(30);
  });
  test('5 items × (30 nam + 30 nữ) in total mode → orderQty 300', () => {
    const items = Array.from({ length: 5 }, () =>
      item([line({ mode: 'total', qtyEach: 30 }), line({ lineKey: 'nu', sizeFrom: 35, sizeTo: 40, mode: 'total', qtyEach: 30 })]));
    expect(orderQty(items)).toBe(300);
  });
  test('even mode nam 39–44 × 30 → 180', () => {
    expect(itemQty(item([line({ qtyEach: 30 })]))).toBe(180);
  });
  test('resizeLine keeps counts and zero-fills', () => {
    const r = resizeLine(line({ mode: 'per_size', sizeFrom: 39, sizeTo: 40, perSize: { '39': 5, '40': 6 } }), 38, 40);
    expect(r.perSize).toEqual({ '38': 0, '39': 5, '40': 6 });
    expect(r.sizeFrom).toBe(38);
    expect(lineQty(r)).toBe(11);
  });
  test('resizeLine drops sizes that left the range', () => {
    const r = resizeLine(line({ mode: 'per_size', sizeFrom: 39, sizeTo: 41, perSize: { '39': 5, '40': 6, '41': 7 } }), 40, 41);
    expect(r.perSize).toEqual({ '40': 6, '41': 7 });
    expect(lineQty(r)).toBe(13);
  });
  test('resizeLine swaps an inverted range', () => {
    const r = resizeLine(line({}), 44, 39);
    expect([r.sizeFrom, r.sizeTo]).toEqual([39, 44]);
  });
  test('lineAmount = qty × unitPrice', () => {
    expect(lineAmount(line({ qtyEach: 235, unitPrice: 47000 }))).toBe(66_270_000);
    expect(lineAmount(line({ qtyEach: 235 }))).toBeNull();
  });
  test('orderAmount flags missing price', () => {
    const r = orderAmount([item([line({ qtyEach: 10, unitPrice: 1000 }), line({ qtyEach: 10, unitPrice: null })])]);
    expect(r).toEqual({ amount: 60000, missingPrice: true });
    expect(orderAmount([item([line({ qtyEach: 1, unitPrice: 5 })])])).toEqual({ amount: 30, missingPrice: false });
  });
});
