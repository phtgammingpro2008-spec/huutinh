import { expect, test } from 'bun:test';
import { paginateItems } from '../../src/client/lib/sheet-png';

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ tagNo: i + 1 }));

test('paginateItems(9 items) → 3 pages', () => {
  const pages = paginateItems(items(9));
  expect(pages.map((p) => p.map((i) => i.tagNo))).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
});

test('paginateItems keeps a short last page and handles small orders', () => {
  expect(paginateItems(items(4)).map((p) => p.length)).toEqual([3, 1]);
  expect(paginateItems(items(1)).map((p) => p.length)).toEqual([1]);
  expect(paginateItems(items(5), 2).map((p) => p.length)).toEqual([2, 2, 1]);
  expect(paginateItems([])).toEqual([]);
});

test('paginateByHeight keeps three simple designs per page but fewer tall ones', async () => {
  const { paginateByHeight, estimateItemMm } = await import('../../src/client/lib/sheet-png');
  const simple = (n: number) => ({ tagNo: n, cropUrl: '', materials: ['Đế: VIP 1'], note: '', qty: 6,
    lines: [{ label: 'Nam', range: '39–44', total: false, sizes: [['39', 1]] as [string, number][], qty: 6 }] });
  const tall = (n: number) => ({ ...simple(n), materials: ['Đế: VIP 1', 'Quai: 15L', 'Kiểu: Kẹp'], note: 'đen, quai bạc, in logo nhỏ',
    lines: [simple(n).lines[0], { label: 'Nữ', range: '35–40', total: false, sizes: [['35', 1]] as [string, number][], qty: 6 }] });
  expect(estimateItemMm(simple(1))).toBeLessThan(80);
  expect(estimateItemMm(tall(1))).toBeGreaterThan(90);
  expect(paginateByHeight(Array.from({ length: 9 }, (_, i) => simple(i + 1))).map((p) => p.length)).toEqual([3, 3, 3]);
  expect(paginateByHeight(Array.from({ length: 5 }, (_, i) => tall(i + 1))).map((p) => p.length)).toEqual([2, 2, 1]);
  const huge = { ...tall(1), note: 'x '.repeat(400) };
  expect(paginateByHeight([huge, simple(2)]).map((p) => p.length)).toEqual([1, 1]);
});
