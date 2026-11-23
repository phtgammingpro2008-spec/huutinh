import { expect, test } from 'bun:test';
import { STATUSES, STATUS_LABEL_VI, canTransition, printable, qtyPriceLocked } from '../../src/shared/status';

test('statuses in order with Vietnamese labels', () => {
  expect(STATUSES).toEqual(['cho_bao_gia', 'da_bao_gia', 'khach_dong_y', 'dang_san_xuat', 'da_giao', 'hoan_tat', 'da_huy']);
  expect(STATUS_LABEL_VI.khach_dong_y).toBe('Khách đã đồng ý');
});
test('forward transitions', () => {
  expect(canTransition('cho_bao_gia', 'da_bao_gia')).toBe(true);
  expect(canTransition('khach_dong_y', 'da_giao')).toBe(true);
  expect(canTransition('da_giao', 'da_giao')).toBe(false);
});
test('backward only khach_dong_y → da_bao_gia', () => {
  expect(canTransition('hoan_tat', 'cho_bao_gia')).toBe(false);
  expect(canTransition('khach_dong_y', 'da_bao_gia')).toBe(true);
  expect(canTransition('dang_san_xuat', 'khach_dong_y')).toBe(false);
});
test('cancel from anything except hoan_tat', () => {
  for (const s of STATUSES) {
    if (s === 'da_huy') continue;
    expect(canTransition(s, 'da_huy')).toBe(s !== 'hoan_tat');
  }
  expect(canTransition('da_huy', 'cho_bao_gia')).toBe(false);
});
test('locks and printable', () => {
  expect(qtyPriceLocked('dang_san_xuat')).toBe(true);
  expect(qtyPriceLocked('khach_dong_y')).toBe(false);
  expect(qtyPriceLocked('da_huy')).toBe(true);
  expect(printable('da_bao_gia')).toBe(false);
  expect(printable('khach_dong_y')).toBe(true);
  expect(printable('hoan_tat')).toBe(true);
  expect(printable('da_huy')).toBe(false);
});
