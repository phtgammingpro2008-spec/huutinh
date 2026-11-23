import type { OrderStatus } from '../../shared/types';
import type { Env } from '../env';

export type OrderSummary = { id: string; code: string; status: OrderStatus; createdAt: string; totalQty: number };

/** Orders of one customer, newest first. Task 5 replaces totalQty with real totals. */
export async function customerOrders(env: Env, customerId: string): Promise<OrderSummary[]> {
  const r = await env.DB.prepare('SELECT id, code, status, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC')
    .bind(customerId).all<{ id: string; code: string; status: OrderStatus; created_at: string }>();
  return r.results.map((o) => ({ id: o.id, code: o.code, status: o.status, createdAt: o.created_at, totalQty: 0 }));
}
