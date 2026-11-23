import { addDays, localDate, localDayStartIso } from '../../shared/dates';
import { rank } from '../../shared/status';
import { lineQty, orderAmount, orderQty } from '../../shared/totals';
import type { Currency, Item, OrderInput, OrderStatus } from '../../shared/types';
import type { Env, Stmt } from '../env';
import { now } from '../http';
import { getCustomer, type Customer } from './customers';
import { insertDesignsStmt, insertImagesStmt } from './designs';
import { groupBy, mapImage, mapItem, mapLine, type ImageRow, type ItemRow, type LineRow } from './rows';

export type OrderRow = {
  id: string; code: string; customer_id: string; status: OrderStatus; currency: Currency; needed_by: string | null;
  note: string; allow_public: number; quote_token: string | null; quote_version: number; created_at: string;
  quoted_at: string | null; accepted_at: string | null; updated_at: string;
};

export type Totals = { qty: number; amount: number; missingPrice: boolean };

export type OrderView = OrderInput & {
  code: string; status: OrderStatus; quoteVersion: number; quoteToken: string | null; customer: Customer;
  totals: Totals; paid: number; due: number; createdAt: string; quotedAt: string | null; acceptedAt: string | null;
};

export type OrderSummary = {
  id: string; code: string; status: OrderStatus; customerId: string; customerName: string; currency: Currency;
  createdAt: string; neededBy: string | null; acceptedAt: string | null; totalQty: number; amount: number;
  missingPrice: boolean; paid: number; due: number; thumbKey: string | null;
};

export const totalsOf = (items: Item[]): Totals => ({ qty: orderQty(items), ...orderAmount(items) });

export async function getOrderRow(env: Env, id: string): Promise<OrderRow | null> {
  return env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
}

/** Items (with lines) for several orders, keyed by order id. */
export async function itemsByOrder(env: Env, orderIds: string[]): Promise<Map<string, Item[]>> {
  const ids = JSON.stringify(orderIds);
  const items = (await env.DB.prepare(
    'SELECT * FROM order_items WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY position',
  ).bind(ids).all<ItemRow>()).results;
  const lines = (await env.DB.prepare(
    `SELECT l.* FROM item_lines l JOIN order_items i ON i.id = l.item_id
     WHERE i.order_id IN (SELECT value FROM json_each(?)) ORDER BY l.position`,
  ).bind(ids).all<LineRow>()).results;
  const linesByItem = groupBy(lines, 'item_id');
  const out = new Map<string, Item[]>();
  for (const [orderId, rows] of groupBy(items, 'order_id')) {
    out.set(orderId, rows.map((r) => mapItem(r, (linesByItem.get(r.id) ?? []).map(mapLine))));
  }
  return out;
}

export async function paidByOrder(env: Env, orderIds: string[]): Promise<Map<string, number>> {
  const r = await env.DB.prepare(
    'SELECT order_id, SUM(amount) AS paid FROM payments WHERE order_id IN (SELECT value FROM json_each(?)) GROUP BY order_id',
  ).bind(JSON.stringify(orderIds)).all<{ order_id: string; paid: number }>();
  return new Map(r.results.map((x) => [x.order_id, x.paid]));
}

export async function loadOrder(env: Env, id: string): Promise<OrderView | null> {
  const o = await getOrderRow(env, id);
  if (!o) return null;
  const customer = (await getCustomer(env, o.customer_id))!;
  const images = (await env.DB.prepare('SELECT * FROM order_images WHERE order_id = ? ORDER BY position').bind(id).all<ImageRow>()).results.map(mapImage);
  const items = (await itemsByOrder(env, [id])).get(id) ?? [];
  const paid = (await paidByOrder(env, [id])).get(id) ?? 0;
  const totals = totalsOf(items);
  return {
    id: o.id, customerId: o.customer_id, currency: o.currency, neededBy: o.needed_by, note: o.note,
    allowPublic: !!o.allow_public, images, items, code: o.code, status: o.status, quoteVersion: o.quote_version,
    quoteToken: o.quote_token, customer, totals, paid, due: Math.max(0, totals.amount - paid),
    createdAt: o.created_at, quotedAt: o.quoted_at, acceptedAt: o.accepted_at,
  };
}

/** Canonical form of everything that affects quantities or money; used to detect qty/price edits. */
export function qtyPriceSignature(currency: Currency, items: Item[]): string {
  const norm = [...items].sort((a, b) => a.id.localeCompare(b.id)).map((i) => [
    i.id, [...i.lines].sort((a, b) => a.id.localeCompare(b.id)).map((l) => [
      l.id, l.lineKey, l.sizeFrom, l.sizeTo, l.mode, lineQty(l),
      l.mode === 'per_size' ? Object.entries(l.perSize).sort() : l.qtyEach, l.unitPrice,
    ]),
  ]);
  return JSON.stringify([currency, norm]);
}

/** Next order code for the local day: DH + yyMMdd + '-' + 3-digit sequence. */
export async function nextOrderCode(env: Env): Promise<string> {
  const d = localDate(now(env)); // yyyy-mm-dd
  const prefix = `DH${d.slice(2, 4)}${d.slice(5, 7)}${d.slice(8, 10)}-`;
  const r = await env.DB.prepare('SELECT code FROM orders WHERE code LIKE ? ORDER BY code DESC LIMIT 1')
    .bind(prefix + '%').first<{ code: string }>();
  const n = r ? parseInt(r.code.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}

/** Statements replacing an order's images, items and lines (and adding new designs). */
export function replaceContentStmts(env: Env, o: OrderInput, at: string): Stmt[] {
  const items = o.items.map((i, position) => ({ ...i, orderId: o.id, position }));
  const lines = o.items.flatMap((i) => i.lines.map((l, position) => ({ ...l, itemId: i.id, position })));
  return [
    env.DB.prepare('DELETE FROM item_lines WHERE item_id IN (SELECT id FROM order_items WHERE order_id = ?)').bind(o.id),
    env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(o.id),
    env.DB.prepare('DELETE FROM order_images WHERE order_id = ?').bind(o.id),
    insertImagesStmt(env, o.id, o.images),
    insertDesignsStmt(env, o.items, o.allowPublic, at),
    env.DB.prepare(
      `INSERT INTO order_items (id, order_id, design_id, image_id, tag_no, tap_x, tap_y, crop, crop_key, sole_id, strap_id, style_id, color_note, position)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.orderId'), json_extract(value, '$.designId'),
              json_extract(value, '$.imageId'), json_extract(value, '$.tagNo'), json_extract(value, '$.tapX'),
              json_extract(value, '$.tapY'), json_extract(value, '$.crop'), json_extract(value, '$.cropKey'),
              json_extract(value, '$.soleId'), json_extract(value, '$.strapId'), json_extract(value, '$.styleId'),
              json_extract(value, '$.colorNote'), json_extract(value, '$.position')
       FROM json_each(?)`,
    ).bind(JSON.stringify(items)),
    env.DB.prepare(
      `INSERT INTO item_lines (id, item_id, line_key, size_from, size_to, mode, qty_each, per_size, unit_price, position)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.itemId'), json_extract(value, '$.lineKey'),
              json_extract(value, '$.sizeFrom'), json_extract(value, '$.sizeTo'), json_extract(value, '$.mode'),
              json_extract(value, '$.qtyEach'), json_extract(value, '$.perSize'), json_extract(value, '$.unitPrice'),
              json_extract(value, '$.position')
       FROM json_each(?)`,
    ).bind(JSON.stringify(lines)),
  ];
}

export type OrderFilter = { status?: string; customerId?: string; q?: string; from?: string; to?: string };

export async function listOrders(env: Env, f: OrderFilter = {}): Promise<OrderSummary[]> {
  const q = f.q?.trim().toLowerCase() ?? '';
  const fromIso = f.from ? localDayStartIso(f.from) : null;
  const toIso = f.to ? localDayStartIso(addDays(f.to, 1)) : null;
  const rows = (await env.DB.prepare(
    `SELECT o.*, c.name AS customer_name FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE (?1 IS NULL OR o.status = ?1) AND (?2 IS NULL OR o.customer_id = ?2)
       AND (?3 = '' OR lower(o.code) LIKE '%' || ?3 || '%' OR lower(c.name) LIKE '%' || ?3 || '%')
       AND (?4 IS NULL OR o.created_at >= ?4) AND (?5 IS NULL OR o.created_at < ?5)
     ORDER BY o.created_at DESC, o.code DESC LIMIT 500`,
  ).bind(f.status || null, f.customerId || null, q, fromIso, toIso).all<OrderRow & { customer_name: string }>()).results;
  return summarize(env, rows);
}

async function summarize(env: Env, rows: (OrderRow & { customer_name: string })[]): Promise<OrderSummary[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const items = await itemsByOrder(env, ids);
  const paid = await paidByOrder(env, ids);
  return rows.map((o) => {
    const its = items.get(o.id) ?? [];
    const t = totalsOf(its);
    const p = paid.get(o.id) ?? 0;
    return {
      id: o.id, code: o.code, status: o.status, customerId: o.customer_id, customerName: o.customer_name,
      currency: o.currency, createdAt: o.created_at, neededBy: o.needed_by, acceptedAt: o.accepted_at,
      totalQty: t.qty, amount: t.amount, missingPrice: t.missingPrice, paid: p, due: Math.max(0, t.amount - p),
      thumbKey: its[0]?.cropKey || null,
    };
  });
}

export async function customerOrders(env: Env, customerId: string): Promise<OrderSummary[]> {
  return listOrders(env, { customerId });
}

export async function dashboard(env: Env) {
  const all = await listOrders(env);
  const t = now(env);
  const today = localDate(t);
  const weekAgo = new Date(t.getTime() - 7 * 86400_000).toISOString();
  const soon = addDays(today, 7);
  const open = (s: OrderStatus) => !['da_giao', 'hoan_tat', 'da_huy'].includes(s);
  return {
    waitingQuote: all.filter((o) => o.status === 'cho_bao_gia'),
    justAccepted: all.filter((o) => o.status === 'khach_dong_y' && (o.acceptedAt ?? '') >= weekAgo),
    dueSoon: all.filter((o) => o.neededBy && o.neededBy <= soon && open(o.status))
      .sort((a, b) => (a.neededBy! < b.neededBy! ? -1 : 1)),
    unpaid: all.filter((o) => o.status !== 'da_huy' && rank(o.status) >= rank('khach_dong_y') && o.due > 0),
  };
}
