import type { OrderStatus } from './types';

export const STATUSES: OrderStatus[] = [
  'cho_bao_gia', 'da_bao_gia', 'khach_dong_y', 'dang_san_xuat', 'da_giao', 'hoan_tat', 'da_huy',
];

export const STATUS_LABEL_VI: Record<OrderStatus, string> = {
  cho_bao_gia: 'Chờ báo giá',
  da_bao_gia: 'Đã báo giá',
  khach_dong_y: 'Khách đã đồng ý',
  dang_san_xuat: 'Đang sản xuất',
  da_giao: 'Đã giao',
  hoan_tat: 'Hoàn tất',
  da_huy: 'Đã hủy',
};

const FLOW: OrderStatus[] = STATUSES.slice(0, 6);
/** Position in the normal flow; da_huy is -1. */
export const rank = (s: OrderStatus) => FLOW.indexOf(s);

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === 'da_huy') return false;
  if (to === 'da_huy') return from !== 'hoan_tat';
  if (from === 'khach_dong_y' && to === 'da_bao_gia') return true;
  // the owner reopens a delivered order to pack more bags
  if (from === 'da_giao' && to === 'dang_san_xuat') return true;
  return rank(to) > rank(from);
}

/** Quantities and prices may not change from production onward, nor on cancelled orders. */
export const qtyPriceLocked = (s: OrderStatus) => s === 'da_huy' || rank(s) >= rank('dang_san_xuat');

/** Production sheet available once the customer has accepted. */
export const printable = (s: OrderStatus) => s !== 'da_huy' && rank(s) >= rank('khach_dong_y');
