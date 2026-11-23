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
