import type { Env } from '../env';

export type Payment = { id: string; amount: number; paidOn: string; note: string };

export async function listPayments(env: Env, orderId: string): Promise<Payment[]> {
  const r = await env.DB.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY paid_on, rowid').bind(orderId)
    .all<{ id: string; amount: number; paid_on: string; note: string }>();
  return r.results.map((p) => ({ id: p.id, amount: p.amount, paidOn: p.paid_on, note: p.note }));
}

export async function addPayment(env: Env, orderId: string, p: Payment): Promise<void> {
  await env.DB.prepare('INSERT INTO payments (id, order_id, amount, paid_on, note) VALUES (?, ?, ?, ?, ?)')
    .bind(p.id, orderId, p.amount, p.paidOn, p.note).run();
}

export async function deletePayment(env: Env, orderId: string, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM payments WHERE id = ? AND order_id = ?').bind(id, orderId).run();
}
