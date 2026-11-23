import { expect, test } from 'bun:test';
import { formatMoney, parseMoney } from '../../src/shared/money';

test('formatMoney VND vi', () => expect(formatMoney(66270000, 'VND', 'vi')).toBe('66.270.000 ₫'));
test('formatMoney USD en', () => expect(formatMoney(1890, 'USD', 'en')).toBe('$18.90'));
test('formatMoney USD vi keeps $ and 2 decimals', () => expect(formatMoney(1890, 'USD', 'vi')).toBe('$18.90'));
test('formatMoney VND km uses dot grouping', () => expect(formatMoney(47000, 'VND', 'km')).toBe('47.000 ₫'));
test('parseMoney 47k VND', () => expect(parseMoney('47k', 'VND')).toBe(47000));
test('parseMoney 1.5tr VND', () => expect(parseMoney('1,5tr', 'VND')).toBe(1_500_000));
test('parseMoney thousands separators VND', () => {
  expect(parseMoney('47.000', 'VND')).toBe(47000);
  expect(parseMoney('1,410,000', 'VND')).toBe(1410000);
  expect(parseMoney('47.000 ₫', 'VND')).toBe(47000);
});
test('parseMoney 18.9 USD', () => expect(parseMoney('18.9', 'USD')).toBe(1890));
test('parseMoney $1,234.5 USD', () => expect(parseMoney('$1,234.5', 'USD')).toBe(123450));
test('parseMoney abc → null', () => {
  expect(parseMoney('abc', 'VND')).toBeNull();
  expect(parseMoney('', 'USD')).toBeNull();
  expect(parseMoney('-5', 'VND')).toBeNull();
});
test('formatQty groups thousands with dots', async () => {
  const { formatQty } = await import('../../src/shared/money');
  expect(formatQty(1410)).toBe('1.410');
  expect(formatQty(60)).toBe('60');
  expect(formatQty(1234567)).toBe('1.234.567');
});
