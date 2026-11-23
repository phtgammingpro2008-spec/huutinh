import type { QuoteSnapshot } from '../../shared/snapshot';
import type { Item, Lang, OrderInput } from '../../shared/types';
import type { Env } from '../env';
import { HttpError, err, json, nowIso, readJson, str } from '../http';
import { parseOrderInput } from '../order-input';
import { getCustomer } from '../repo/customers';
import { LIBRARY_VISIBLE } from '../repo/library';
import { getOrderRow, itemsByOrder, listOrders, loadOrder, type OrderRow, type OrderView } from '../repo/orders';
import { latestQuote } from '../repo/quotes';
import { requireCustomer, type SessionUser } from '../roles';
import type { Router } from '../router';
import { acceptQuote } from './public';
import { saveOrder } from './orders';

const notFound = () => err(404, 'Không tìm thấy đơn');
const fail = (status: number, code: string, message: string) => json({ error: message, code }, status);

/** The customer's own order row, or null (other people's orders look exactly like missing ones). */
async function ownOrder(env: Env, user: SessionUser, id: string): Promise<OrderRow | null> {
  const o = await getOrderRow(env, id);
  return o && o.customer_id === user.customerId ? o : null;
}

const canEdit = (o: OrderRow) => o.status === 'cho_bao_gia' && o.quote_version === 0;
const canCancel = (o: OrderRow) => o.status === 'cho_bao_gia' || o.status === 'da_bao_gia';

/** Checks every image and item a customer sends: only their own uploads, visible library designs, or published product colours. */
async function checkSources(env: Env, user: SessionUser, o: OrderInput, orderId: string): Promise<void> {
  const bad = (msg: string): never => { throw new HttpError(400, msg); };
  const keys = [...o.images.map((i) => i.key), ...o.items.map((i) => i.cropKey).filter(Boolean)];
  const mine = new Set((await env.DB.prepare(
    'SELECT key FROM uploads WHERE user_id = ? AND key IN (SELECT value FROM json_each(?))',
  ).bind(user.id, JSON.stringify(keys)).all<{ key: string }>()).results.map((r) => r.key));
  for (const im of o.images) if (!mine.has(im.key)) bad('Ảnh không thuộc tài khoản của bạn');

  const designIds = o.items.map((i) => i.designId);
  const designs = new Map((await env.DB.prepare(
    `SELECT d.id, d.crop_key, (${LIBRARY_VISIBLE}) AS visible,
       EXISTS (SELECT 1 FROM order_items it JOIN orders od ON od.id = it.order_id
               WHERE it.design_id = d.id AND od.customer_id = ?2) AS own
     FROM designs d WHERE d.id IN (SELECT value FROM json_each(?1))`,
  ).bind(JSON.stringify(designIds), user.customerId).all<{ id: string; crop_key: string; visible: number; own: number }>()).results.map((d) => [d.id, d]));

  for (const it of o.items) {
    const d = designs.get(it.designId);
    if (it.productId || it.colorId) {
      const c = await env.DB.prepare(
        'SELECT pc.image_key, pc.design_id FROM product_colors pc JOIN products p ON p.id = pc.product_id WHERE pc.id = ? AND p.id = ? AND p.published = 1',
      ).bind(it.colorId, it.productId).first<{ image_key: string; design_id: string | null }>();
      if (!c) bad(`Mẫu số ${it.tagNo}: sản phẩm không còn bán`);
      if (c!.design_id) it.designId = c!.design_id;
      it.cropKey = c!.image_key;
      it.imageId = null; it.crop = null;
    } else if (d) {
      if (!d.visible && !d.own) bad(`Mẫu số ${it.tagNo} không có trong thư viện`);
      it.cropKey = d.crop_key;
    } else {
      // a new design cut from the customer's own photo
      if (!it.cropKey || !mine.has(it.cropKey)) bad(`Mẫu số ${it.tagNo} chưa có ảnh cắt`);
      if (it.imageId && !o.images.some((im) => im.id === it.imageId)) bad('Ảnh không hợp lệ');
    }
  }
  void orderId;
}

/** Customer-facing view: no admin notes, prices only from the quote actually sent. */
async function customerView(env: Env, v: OrderView, row: OrderRow) {
  const q = row.quote_version > 0 ? await latestQuote(env, row.id) : null;
  const acc = q?.accepted_at ? q.version : null;
  const quoted = !!q && row.status !== 'cho_bao_gia';
  return {
    id: v.id, code: v.code, status: v.status, createdAt: v.createdAt, neededBy: v.neededBy, note: v.note,
    deliverNote: v.deliverNote ?? '', currency: v.currency, cancelReason: v.cancelReason, cancelledBy: v.cancelledBy,
    images: v.images, productTitles: v.productTitles,
    items: v.items.map((i: Item) => ({ ...i, lines: i.lines.map((l) => ({ ...l, unitPrice: null })) })),
    totals: { qty: v.totals.qty },
    quote: quoted ? (q!.data as QuoteSnapshot) : null,
    acceptedVersion: acc,
    paid: quoted ? v.paid : 0,
    due: quoted ? Math.max(0, (q!.data as QuoteSnapshot).totalAmount - v.paid) : 0,
    canEdit: canEdit(row), canCancel: canCancel(row),
  };
}

export function customerRoutes(r: Router) {
  r.on('GET', '/api/c/orders', requireCustomer(async (_req, env, _p, ctx) => {
    const list = await listOrders(env, { customerId: ctx.user!.customerId! });
    return json(list.map((o) => ({ id: o.id, code: o.code, status: o.status, createdAt: o.createdAt, neededBy: o.neededBy, totalQty: o.totalQty, thumbKey: o.thumbKey })));
  }));

  r.on('GET', '/api/c/orders/:id', requireCustomer(async (_req, env, p, ctx) => {
    const row = await ownOrder(env, ctx.user!, p.id);
    if (!row) return notFound();
    return json(await customerView(env, (await loadOrder(env, row.id))!, row));
  }));

  r.on('PUT', '/api/c/orders/:id', requireCustomer(async (req, env, p, ctx) => {
    const user = ctx.user!;
    const cust = (await getCustomer(env, user.customerId!))!;
    const b = await readJson(req);
    const input = parseOrderInput({ ...b, customerId: cust.id, currency: cust.currency, allowPublic: false }, p.id);
    const existing = await getOrderRow(env, p.id);
    if (existing && existing.customer_id !== user.customerId) return notFound();
    if (existing && !canEdit(existing)) return fail(409, 'locked_after_quote', 'Đơn đã có báo giá, vui lòng nhắn xưởng để thay đổi');
    if (b.isPrivate === true) for (const it of input.items) it.isPrivate = true;
    await checkSources(env, user, input, p.id);
    // Customers never set prices: keep whatever the workshop already typed for an existing line.
    const old = existing ? (await itemsByOrder(env, [existing.id])).get(existing.id) ?? [] : [];
    const oldPrice = new Map(old.flatMap((i) => i.lines.map((l) => [l.id, l.unitPrice] as const)));
    for (const it of input.items) for (const l of it.lines) l.unitPrice = oldPrice.get(l.id) ?? null;
    const res = await saveOrder(env, input, { source: 'customer' });
    if (!res.ok) return res;
    // the first order of a product colour gives it its library design; later orders reuse that one design
    const linked = input.items.filter((i) => i.colorId).map((i) => ({ c: i.colorId, d: i.designId }));
    if (linked.length) {
      await env.DB.prepare(
        "UPDATE product_colors SET design_id = json_extract(j.value, '$.d') FROM json_each(?) j WHERE product_colors.id = json_extract(j.value, '$.c') AND product_colors.design_id IS NULL",
      ).bind(JSON.stringify(linked)).run();
    }
    const row = (await getOrderRow(env, p.id))!;
    return json(await customerView(env, (await loadOrder(env, p.id))!, row));
  }));

  r.on('POST', '/api/c/orders/:id/accept', requireCustomer(async (req, env, p, ctx) => {
    const row = await ownOrder(env, ctx.user!, p.id);
    if (!row) return notFound();
    const q = await latestQuote(env, row.id);
    if (!q) return fail(409, 'not_quoted', 'Đơn chưa có báo giá');
    const b = await readJson(req).catch(() => ({} as Record<string, unknown>));
    const cust = await getCustomer(env, row.customer_id);
    return acceptQuote(env, row, q, b.version, (cust?.lang ?? 'vi') as Lang);
  }));

  r.on('POST', '/api/c/orders/:id/cancel', requireCustomer(async (req, env, p, ctx) => {
    const row = await ownOrder(env, ctx.user!, p.id);
    if (!row) return notFound();
    if (!canCancel(row)) return fail(409, 'cannot_cancel', 'Đơn đã được xưởng đưa vào làm, vui lòng nhắn xưởng nếu cần thay đổi');
    let reason = '';
    try { reason = str((await req.json() as { reason?: unknown }).reason, 500); } catch { /* no body */ }
    await env.DB.prepare(
      "UPDATE orders SET status = 'da_huy', cancel_reason = ?, cancelled_by = 'customer', updated_at = ? WHERE id = ? AND status IN ('cho_bao_gia', 'da_bao_gia')",
    ).bind(reason, nowIso(env), row.id).run();
    const fresh = (await getOrderRow(env, row.id))!;
    return json(await customerView(env, (await loadOrder(env, row.id))!, fresh));
  }));
}
