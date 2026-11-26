import { qtyPriceLocked } from '../../shared/status';
import type { OrderInput, OrderStatus } from '../../shared/types';
import { requireAdmin } from '../roles';
import type { Env } from '../env';
import { HttpError, err, json, nowIso, readJson } from '../http';
import { parseOrderInput } from '../order-input';
import { getCustomer } from '../repo/customers';
import { getDesignsByIds } from '../repo/designs';
import {
  dashboard, getOrderRow, itemsByOrder, listOrders, loadOrder, nextOrderCode, qtyPriceSignature,
  replaceContentStmts, totalsOf,
} from '../repo/orders';
import { buildSnapshot, quoteVersionStmts } from '../repo/quotes';
import type { Router } from '../router';
import { shippingSummary } from '../repo/kho';

export const LOCKED_MSG = 'Đơn đang sản xuất, không sửa số lượng/giá được';
export const lockedMessage = (s: OrderStatus) => (s === 'da_huy' ? 'Đơn đã hủy, không sửa số lượng/giá được' : LOCKED_MSG);

/** Items that reuse a library design take its crop; brand-new designs must bring their own. */
async function resolveDesigns(env: Env, o: OrderInput) {
  const existing = await getDesignsByIds(env, o.items.map((i) => i.designId));
  for (const i of o.items) {
    const d = existing.get(i.designId);
    if (d && !i.cropKey) i.cropKey = d.cropKey;
    if (!i.cropKey) throw new HttpError(400, `Mẫu số ${i.tagNo} chưa có ảnh cắt`);
  }
}

export type SaveOpts = { source?: 'admin' | 'customer' };

export async function saveOrder(env: Env, o: OrderInput, opts: SaveOpts = {}): Promise<Response> {
  const source = opts.source ?? 'admin';
  if (!(await getCustomer(env, o.customerId))) return err(400, 'Không tìm thấy khách');
  await resolveDesigns(env, o);
  const at = nowIso(env);
  const old = await getOrderRow(env, o.id);

  if (!old) {
    for (let attempt = 0; ; attempt++) {
      const code = await nextOrderCode(env);
      try {
        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO orders (id, code, customer_id, status, currency, needed_by, note, allow_public, created_at, updated_at,
               source, seen_by_admin, deliver_note)
             VALUES (?, ?, ?, 'cho_bao_gia', ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET customer_id = excluded.customer_id, currency = excluded.currency,
               needed_by = excluded.needed_by, note = excluded.note, allow_public = excluded.allow_public,
               updated_at = excluded.updated_at, deliver_note = excluded.deliver_note`,
          ).bind(o.id, code, o.customerId, o.currency, o.neededBy, o.note, o.allowPublic ? 1 : 0, at, at,
            source, source === 'customer' ? 0 : 1, o.deliverNote ?? ''),
          ...replaceContentStmts(env, o, at, source),
        ]);
        break;
      } catch (e) {
        // Another order took this code in the meantime: try the next one.
        if (attempt < 5 && /UNIQUE/i.test(String(e)) && /code/i.test(String(e))) continue;
        throw e;
      }
    }
    return json(await loadOrder(env, o.id));
  }

  const oldItems = (await itemsByOrder(env, [o.id])).get(o.id) ?? [];
  const changed = qtyPriceSignature(old.currency, oldItems) !== qtyPriceSignature(o.currency, o.items);
  if (changed && qtyPriceLocked(old.status)) return err(409, lockedMessage(old.status));
  if (o.currency !== old.currency && o.items.some((i) => i.lines.some((l) => l.unitPrice != null))) {
    return err(400, 'Đổi loại tiền thì phải xóa các đơn giá cũ trước');
  }

  let status = old.status;
  let requote = false;
  if (changed && old.quote_version > 0 && (old.status === 'da_bao_gia' || old.status === 'khach_dong_y')) {
    // A quote was sent: the customer must see (and accept) the new numbers.
    if (totalsOf(o.items).missingPrice) status = 'cho_bao_gia';
    else { status = 'da_bao_gia'; requote = true; }
  }
  // The new quote version is written in the same transaction as the new numbers: never one without the other.
  const requoteStmts = requote
    ? quoteVersionStmts(env, o.id, await buildSnapshot(env, { ...o, totals: totalsOf(o.items) }, old.quote_version + 1), at)
    : [];
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE orders SET customer_id = ?, currency = ?, needed_by = ?, note = ?, allow_public = ?, updated_at = ?,
         status = ?, accepted_at = CASE WHEN ? THEN NULL ELSE accepted_at END, deliver_note = ? WHERE id = ?`,
    ).bind(o.customerId, o.currency, o.neededBy, o.note, o.allowPublic ? 1 : 0, at, status, status !== old.status ? 1 : 0,
      o.deliverNote ?? old.deliver_note, o.id),
    ...replaceContentStmts(env, o, at, source),
    ...requoteStmts,
  ]);
  return json(await loadOrder(env, o.id));
}

export function orderRoutes(r: Router) {
  r.on('PUT', '/api/orders/:id', requireAdmin(async (req, env, p) => saveOrder(env, parseOrderInput(await readJson(req), p.id))));

  r.on('GET', '/api/orders/:id', requireAdmin(async (_req, env, p) => {
    const o = await loadOrder(env, p.id);
    if (o && !o.seenByAdmin) await env.DB.prepare('UPDATE orders SET seen_by_admin = 1 WHERE id = ?').bind(o.id).run();
    return o ? json({ ...o, shipping: await shippingSummary(env, o.id) }) : err(404, 'Không tìm thấy đơn');
  }));

  r.on('GET', '/api/orders', requireAdmin(async (req, env) => {
    const sp = new URL(req.url).searchParams;
    const g = (k: string) => sp.get(k) || undefined;
    return json(await listOrders(env, { status: g('status'), customerId: g('customerId'), q: g('q'), from: g('from'), to: g('to') }));
  }));

  r.on('GET', '/api/dashboard', requireAdmin(async (_req, env) => json(await dashboard(env))));
}
