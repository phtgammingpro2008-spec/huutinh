import type { Env } from '../env';

/**
 * Creates the next quote version for an order and returns its number.
 * Task 6 extends this to store the snapshot.
 */
export async function createQuoteVersion(env: Env, orderId: string): Promise<number> {
  await env.DB.prepare('UPDATE orders SET quote_version = quote_version + 1 WHERE id = ?').bind(orderId).run();
  const r = await env.DB.prepare('SELECT quote_version FROM orders WHERE id = ?').bind(orderId).first<{ quote_version: number }>();
  return r?.quote_version ?? 0;
}
