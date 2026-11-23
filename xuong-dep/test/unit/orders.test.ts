import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, loginCookie } from '../helpers/http';
import { forceStatus, item, line, newCustomer, sampleOrder, saveOrder } from '../helpers/orders';
import type { Env } from '../../src/worker/env';

let clock = new Date('2026-11-22T03:00:00Z');
let env: Env;
let c: string;
let cust: { id: string; name: string };
beforeEach(async () => {
  clock = new Date('2026-11-22T03:00:00Z');
  env = await createTestEnv({ now: () => clock });
  c = await loginCookie(env);
  cust = await newCustomer(env, c);
});

test('create sample order (9 items, nam 39–44 even) → totals.qty 1410', async () => {
  const r = await saveOrder(env, c, sampleOrder(cust.id));
  expect(r.status).toBe(200);
  expect(r.body.totals).toEqual({ qty: 1410, amount: 0, missingPrice: true });
  expect(r.body.status).toBe('cho_bao_gia');
  expect(r.body.items).toHaveLength(9);
  expect(r.body.customer.name).toBe('chị Nga');
  expect(r.body.paid).toBe(0);
  expect(r.body.quoteToken).toBeNull();
  const g = await call(env, 'GET', `/api/orders/${r.body.id}`, undefined, c);
  expect(g.body.items.map((i: any) => i.lines[0].qtyEach)).toEqual([85, 25, 18, 20, 17, 13, 25, 14, 18]);
  expect(g.body.items[0].crop).toEqual({ x: 0.05, y: 0.4, w: 0.1, h: 0.2 });
  expect(g.body.images).toEqual([{ id: 'img-1', key: 'img/2026/11/tong.jpg', width: 2000, height: 1333 }]);
});

test('orders require auth and unknown order → 404', async () => {
  expect((await call(env, 'GET', '/api/orders')).status).toBe(401);
  expect((await call(env, 'GET', '/api/orders/nope', undefined, c)).status).toBe(404);
});

test('code format DH261122-001 then -002 same day, next day restarts', async () => {
  const a = await saveOrder(env, c, sampleOrder(cust.id));
  const b = await saveOrder(env, c, sampleOrder(cust.id));
  expect(a.body.code).toBe('DH261122-001');
  expect(b.body.code).toBe('DH261122-002');
  clock = new Date('2026-11-22T18:00:00Z'); // 01:00 on 23/11 in Vietnam
  expect((await saveOrder(env, c, sampleOrder(cust.id))).body.code).toBe('DH261123-001');
});

test('PUT same id twice creates one order and keeps its code', async () => {
  const o = sampleOrder(cust.id);
  const [a, b] = await Promise.all([saveOrder(env, c, o), saveOrder(env, c, o)]);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  const again = await saveOrder(env, c, { ...o, note: 'sửa' });
  expect(again.body.code).toBe(a.body.code);
  const list = await call(env, 'GET', '/api/orders', undefined, c);
  expect(list.body).toHaveLength(1);
});

test('replace drops removed items and lines', async () => {
  const o = sampleOrder(cust.id);
  await saveOrder(env, c, o);
  const it = { ...o.items[0], lines: [line({ qtyEach: 10 }), line({ lineKey: 'nu', sizeFrom: 35, sizeTo: 40, qtyEach: 5 })] };
  const r = await saveOrder(env, c, { ...o, items: [it] });
  expect(r.body.items).toHaveLength(1);
  expect(r.body.totals.qty).toBe(90);
  const r2 = await saveOrder(env, c, { ...o, items: [{ ...it, lines: [it.lines[1]] }] });
  expect(r2.body.items[0].lines).toHaveLength(1);
  expect(r2.body.totals.qty).toBe(30);
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM item_lines').first<{ n: number }>();
  expect(n!.n).toBe(1);
});

test('validation: unknown customer, no items, bad line', async () => {
  expect((await saveOrder(env, c, sampleOrder('khong-co'))).status).toBe(400);
  const r = await saveOrder(env, c, sampleOrder(cust.id, { items: [] }));
  expect(r.status).toBe(400);
  expect(r.body.error).toBe('Đơn cần ít nhất một mẫu');
  const bad = sampleOrder(cust.id, { items: [item(1, { lines: [line({ sizeFrom: 44, sizeTo: 39 })] })] });
  expect((await saveOrder(env, c, bad)).status).toBe(400);
  const neg = sampleOrder(cust.id, { items: [item(1, { lines: [line({ qtyEach: -3 })] })] });
  expect((await saveOrder(env, c, neg)).status).toBe(400);
  expect((await saveOrder(env, c, sampleOrder(cust.id, { currency: 'EUR' as any }))).status).toBe(400);
});

test('per_size and total modes round-trip', async () => {
  const o = sampleOrder(cust.id, {
    items: [item(1, { lines: [
      line({ mode: 'per_size', sizeFrom: 39, sizeTo: 41, perSize: { '39': 3, '40': 4, '41': 5 } }),
      line({ lineKey: 'nu', mode: 'total', sizeFrom: 35, sizeTo: 40, qtyEach: 30 }),
    ] })],
  });
  const r = await saveOrder(env, c, o);
  expect(r.body.totals.qty).toBe(42);
  expect(r.body.items[0].lines[0].perSize).toEqual({ '39': 3, '40': 4, '41': 5 });
  expect(r.body.items[0].lines[1].mode).toBe('total');
});

test('edit qty on khach_dong_y with an unpriced new line → back to cho_bao_gia, no new version', async () => {
  const o = sampleOrder(cust.id);
  for (const i of o.items) i.lines[0].unitPrice = 47000;
  await saveOrder(env, c, o);
  await env.DB.prepare("UPDATE orders SET status = 'khach_dong_y', quote_version = 1 WHERE id = ?").bind(o.id).run();
  const extra = { ...o.items[0], lines: [...o.items[0].lines, line({ lineKey: 'nu', sizeFrom: 35, sizeTo: 40, qtyEach: 5 })] };
  const r = await saveOrder(env, c, { ...o, items: [extra, ...o.items.slice(1)] });
  expect(r.body.status).toBe('cho_bao_gia');
  expect(r.body.quoteVersion).toBe(1);
});

test('edit qty on khach_dong_y → status da_bao_gia, quoteVersion+1', async () => {
  const o = sampleOrder(cust.id);
  for (const i of o.items) i.lines[0].unitPrice = 47000;
  await saveOrder(env, c, o);
  await env.DB.prepare("UPDATE orders SET status = 'khach_dong_y', quote_version = 1, accepted_at = '2026-11-22T04:00:00Z' WHERE id = ?").bind(o.id).run();
  const r = await saveOrder(env, c, { ...o, items: o.items.map((i, k) => (k === 0 ? { ...i, lines: [{ ...i.lines[0], qtyEach: 86 }] } : i)) });
  expect(r.status).toBe(200);
  expect(r.body.status).toBe('da_bao_gia');
  expect(r.body.quoteVersion).toBe(2);
  expect(r.body.acceptedAt).toBeNull();
});

test('edit note only on khach_dong_y keeps status and version', async () => {
  const o = sampleOrder(cust.id);
  await saveOrder(env, c, o);
  await env.DB.prepare("UPDATE orders SET status = 'khach_dong_y', quote_version = 1 WHERE id = ?").bind(o.id).run();
  const r = await saveOrder(env, c, { ...o, note: 'giao sớm', neededBy: '2026-12-01' });
  expect(r.body.status).toBe('khach_dong_y');
  expect(r.body.quoteVersion).toBe(1);
  expect(r.body.neededBy).toBe('2026-12-01');
});

test('edit qty on dang_san_xuat → 409', async () => {
  const o = sampleOrder(cust.id);
  await saveOrder(env, c, o);
  await forceStatus(env, o.id, 'dang_san_xuat');
  const r = await saveOrder(env, c, { ...o, items: o.items.slice(1) });
  expect(r.status).toBe(409);
  expect(r.body.error).toBe('Đơn đang sản xuất, không sửa số lượng/giá được');
});

test('edit note on dang_san_xuat → 200', async () => {
  const o = sampleOrder(cust.id);
  await saveOrder(env, c, o);
  await forceStatus(env, o.id, 'dang_san_xuat');
  const r = await saveOrder(env, c, { ...o, note: 'gấp' });
  expect(r.status).toBe(200);
  expect(r.body.note).toBe('gấp');
  expect(r.body.status).toBe('dang_san_xuat');
});

test('dashboard buckets', async () => {
  const waiting = sampleOrder(cust.id);
  const accepted = sampleOrder(cust.id);
  const due = sampleOrder(cust.id, { neededBy: '2026-11-25' });
  const late = sampleOrder(cust.id, { neededBy: '2026-12-30' });
  for (const o of [waiting, accepted, due, late]) await saveOrder(env, c, o);
  await env.DB.prepare("UPDATE orders SET status = 'khach_dong_y', accepted_at = '2026-11-21T00:00:00Z' WHERE id = ?").bind(accepted.id).run();
  await env.DB.prepare('UPDATE item_lines SET unit_price = 1000 WHERE item_id IN (SELECT id FROM order_items WHERE order_id = ?)').bind(accepted.id).run();
  const d = (await call(env, 'GET', '/api/dashboard', undefined, c)).body;
  const ids = (xs: any[]) => xs.map((x) => x.id).sort();
  expect(ids(d.waitingQuote)).toEqual([waiting.id, due.id, late.id].sort());
  expect(ids(d.justAccepted)).toEqual([accepted.id]);
  expect(ids(d.dueSoon)).toEqual([due.id]);
  expect(ids(d.unpaid)).toEqual([accepted.id]);
  expect(d.unpaid[0].due).toBe(1410 * 1000);
});

test("list filter by q matches customer name 'Nga', code, status and dates", async () => {
  const other = await newCustomer(env, c, { name: 'Sokha' });
  const a = (await saveOrder(env, c, sampleOrder(cust.id))).body;
  clock = new Date('2026-11-25T03:00:00Z');
  const b = (await saveOrder(env, c, sampleOrder(other.id))).body;
  const ids = async (qs: string) => (await call(env, 'GET', '/api/orders' + qs, undefined, c)).body.map((x: any) => x.id);
  expect(await ids('?q=nga')).toEqual([a.id]);
  expect(await ids('?q=DH261125')).toEqual([b.id]);
  expect(await ids(`?customerId=${other.id}`)).toEqual([b.id]);
  expect(await ids('?status=cho_bao_gia')).toEqual([b.id, a.id]);
  expect(await ids('?status=da_huy')).toEqual([]);
  expect(await ids('?from=2026-11-23&to=2026-11-30')).toEqual([b.id]);
  expect(await ids('?to=2026-11-22')).toEqual([a.id]);
  const s = (await call(env, 'GET', '/api/orders', undefined, c)).body[0];
  expect(s).toMatchObject({ code: 'DH261125-001', customerName: 'Sokha', totalQty: 1410, status: 'cho_bao_gia' });
});

test('customer detail lists orders with totalQty', async () => {
  await saveOrder(env, c, sampleOrder(cust.id));
  const g = await call(env, 'GET', `/api/customers/${cust.id}`, undefined, c);
  expect(g.body.orders).toHaveLength(1);
  expect(g.body.orders[0].totalQty).toBe(1410);
});
