import type { Item, Line, OrderInput } from '../../src/shared/types';
import type { Env } from '../../src/worker/env';
import { call } from './http';

export const SAMPLE_COUNTS = [85, 25, 18, 20, 17, 13, 25, 14, 18]; // Σ 235 per size → ×6 sizes = 1410

let seq = 0;
export const uid = (p = 'x') => `${p}-${(++seq).toString().padStart(6, '0')}-${crypto.randomUUID().slice(0, 8)}`;

export function line(p: Partial<Line> = {}): Line {
  return { id: uid('line'), lineKey: 'nam', sizeFrom: 39, sizeTo: 44, mode: 'even', qtyEach: 0, perSize: {}, unitPrice: null, ...p };
}

export function item(tagNo: number, p: Partial<Item> = {}): Item {
  return {
    id: uid('item'), designId: uid('design'), imageId: 'img-1', tagNo, tapX: 0.1 * tagNo, tapY: 0.5,
    crop: { x: 0.05, y: 0.4, w: 0.1, h: 0.2 }, cropKey: `img/2026/11/crop-${tagNo}.jpg`,
    soleId: null, strapId: null, styleId: null, colorNote: '', lines: [line()], ...p,
  };
}

export function sampleOrder(customerId: string, p: Partial<OrderInput> = {}): OrderInput {
  return {
    id: uid('order'), customerId, currency: 'VND', neededBy: null, note: '', allowPublic: false,
    images: [{ id: 'img-1', key: 'img/2026/11/tong.jpg', width: 2000, height: 1333 }],
    items: SAMPLE_COUNTS.map((n, i) => item(i + 1, { lines: [line({ qtyEach: n })] })),
    ...p,
  };
}

export async function newCustomer(env: Env, c: string, body: Record<string, unknown> = { name: 'chị Nga' }) {
  return (await call(env, 'POST', '/api/customers', body, c)).body as { id: string; name: string };
}

export async function saveOrder(env: Env, c: string, o: OrderInput) {
  return call(env, 'PUT', `/api/orders/${o.id}`, o, c);
}

/** Sets status directly in the DB (status endpoints come in Task 7). */
export async function forceStatus(env: Env, orderId: string, status: string) {
  await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, orderId).run();
}
