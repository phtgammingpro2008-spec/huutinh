import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';
import { item, line, uid } from '../helpers/orders';
import type { Env } from '../../src/worker/env';

let env: Env;
let admin: string;
const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9]);

async function customer(n: number) {
  const r = await call(env, 'POST', '/api/register', { name: `Khách ${n}`, phone: `09012345${10 + n}`, email: `k${n}@k.vn`, password: 'mat-khau-123', country: 'KH', lang: 'vi' });
  const c = cookieFrom(r);
  return { c, customerId: (await call(env, 'GET', '/api/me', undefined, c)).body.customerId as string };
}
const upload = async (c: string) => (await call(env, 'POST', '/api/c/images?w=1&h=1', jpeg, c, { 'content-type': 'image/jpeg' })).body as { id: string; key: string };

/** A customer order from their own photo: one design, Nam 39–44 even 10. */
async function photoOrder(c: string, extra: Record<string, unknown> = {}) {
  const photo = await upload(c), crop = await upload(c);
  return {
    id: uid('order'), neededBy: null, note: 'gấp', deliverNote: 'Bến xe Phnom Penh', isPrivate: false,
    images: [{ id: photo.id, key: photo.key, width: 10, height: 10 }],
    items: [item(1, { imageId: photo.id, cropKey: crop.key, lines: [line({ qtyEach: 10, unitPrice: 999 })] })],
    ...extra,
  };
}

beforeEach(async () => {
  env = await createTestEnv();
  admin = await loginCookie(env);
});

test('customer creates order from own photo → cho_bao_gia, source customer, unseen', async () => {
  const a = await customer(1);
  const o = await photoOrder(a.c);
  const r = await call(env, 'PUT', `/api/c/orders/${o.id}`, o, a.c);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ status: 'cho_bao_gia', deliverNote: 'Bến xe Phnom Penh', totals: { qty: 60 } });
  const v = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, admin)).body;
  expect(v).toMatchObject({ source: 'customer', currency: 'USD', customerId: a.customerId });
});

test('prices sent by customer are ignored', async () => {
  const a = await customer(1);
  const o = await photoOrder(a.c);
  await call(env, 'PUT', `/api/c/orders/${o.id}`, o, a.c);
  const v = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, admin)).body;
  expect(v.items[0].lines[0].unitPrice).toBeNull();
  // admin prices a line (no quote sent yet); a customer re-save keeps the admin price
  await call(env, 'PUT', `/api/orders/${o.id}/prices`, { prices: [{ lineId: o.items[0].lines[0].id, unitPrice: 500 }] }, admin);
  const r2 = await call(env, 'PUT', `/api/c/orders/${o.id}`, { ...o, note: 'sửa' }, a.c);
  expect(r2.status).toBe(200);
  expect((await call(env, 'GET', `/api/orders/${o.id}`, undefined, admin)).body.items[0].lines[0].unitPrice).toBe(500);
  expect(JSON.stringify(r2.body)).not.toContain('"unitPrice":500');
});

test('PUT twice same id → one order', async () => {
  const a = await customer(1);
  const o = await photoOrder(a.c);
  const [x, y] = await Promise.all([call(env, 'PUT', `/api/c/orders/${o.id}`, o, a.c), call(env, 'PUT', `/api/c/orders/${o.id}`, o, a.c)]);
  expect([x.status, y.status]).toEqual([200, 200]);
  expect((await call(env, 'GET', '/api/c/orders', undefined, a.c)).body).toHaveLength(1);
});

test("customer cannot reference another customer's upload or a private design (400)", async () => {
  const a = await customer(1), b = await customer(2);
  const oa = await photoOrder(a.c, { isPrivate: true });
  await call(env, 'PUT', `/api/c/orders/${oa.id}`, oa, a.c);
  // B reuses A's private design id
  const stolen = { ...(await photoOrder(b.c)), items: [{ ...oa.items[0], id: uid('item'), imageId: null, cropKey: '' }] , images: [] };
  expect((await call(env, 'PUT', `/api/c/orders/${stolen.id}`, stolen, b.c)).status).toBe(400);
  // B uses A's uploaded photo as a new design crop
  const stolen2 = await photoOrder(b.c);
  stolen2.items[0].cropKey = oa.items[0].cropKey;
  stolen2.items[0].designId = uid('design');
  expect((await call(env, 'PUT', `/api/c/orders/${stolen2.id}`, stolen2, b.c)).status).toBe(400);
  stolen2.images = oa.images;
  stolen2.items[0].cropKey = (await upload(b.c)).key;
  expect((await call(env, 'PUT', `/api/c/orders/${stolen2.id}`, stolen2, b.c)).status).toBe(400);
});

test("customer B GET/PUT/accept/cancel on A's order → 404", async () => {
  const a = await customer(1), b = await customer(2);
  const o = await photoOrder(a.c);
  await call(env, 'PUT', `/api/c/orders/${o.id}`, o, a.c);
  expect((await call(env, 'GET', `/api/c/orders/${o.id}`, undefined, b.c)).status).toBe(404);
  expect((await call(env, 'PUT', `/api/c/orders/${o.id}`, await photoOrder(b.c, { id: o.id }), b.c)).status).toBe(404);
  expect((await call(env, 'POST', `/api/c/orders/${o.id}/accept`, { version: 1 }, b.c)).status).toBe(404);
  expect((await call(env, 'POST', `/api/c/orders/${o.id}/cancel`, {}, b.c)).status).toBe(404);
  expect((await call(env, 'GET', '/api/c/orders', undefined, b.c)).body).toEqual([]);
  // admin sessions are not customers
  expect((await call(env, 'GET', '/api/c/orders', undefined, admin)).status).toBe(403);
});

async function quoted(a: { c: string }) {
  const o = await photoOrder(a.c);
  await call(env, 'PUT', `/api/c/orders/${o.id}`, o, a.c);
  await call(env, 'PUT', `/api/orders/${o.id}/prices`, { prices: [{ lineId: o.items[0].lines[0].id, unitPrice: 1890 }] }, admin);
  await call(env, 'POST', `/api/orders/${o.id}/send-quote`, {}, admin);
  return o;
}

test('edit after quote → 409; customer view shows the quote', async () => {
  const a = await customer(1);
  const o = await quoted(a);
  const r = await call(env, 'PUT', `/api/c/orders/${o.id}`, { ...o, note: 'đổi' }, a.c);
  expect(r.status).toBe(409);
  expect(r.body.code).toBe('locked_after_quote');
  const v = (await call(env, 'GET', `/api/c/orders/${o.id}`, undefined, a.c)).body;
  expect(v.status).toBe('da_bao_gia');
  expect(v.quote).toMatchObject({ version: 1, currency: 'USD', totalAmount: 1890 * 60 });
  expect(v).toMatchObject({ canEdit: false, canCancel: true });
});

test('cancel in da_bao_gia ok, in khach_dong_y → 409', async () => {
  const a = await customer(1);
  const o1 = await quoted(a);
  const c1 = await call(env, 'POST', `/api/c/orders/${o1.id}/cancel`, { reason: 'giá cao' }, a.c);
  expect(c1.status).toBe(200);
  const adminView = (await call(env, 'GET', `/api/orders/${o1.id}`, undefined, admin)).body;
  expect(adminView).toMatchObject({ status: 'da_huy', cancelReason: 'giá cao', cancelledBy: 'customer' });
  const o2 = await quoted(a);
  expect((await call(env, 'POST', `/api/c/orders/${o2.id}/accept`, { version: 1 }, a.c)).status).toBe(200);
  const c2 = await call(env, 'POST', `/api/c/orders/${o2.id}/cancel`, {}, a.c);
  expect(c2.status).toBe(409);
  expect(c2.body.code).toBe('cannot_cancel');
});

test('accept via account moves to khach_dong_y; stale version rejected', async () => {
  const a = await customer(1);
  const o = await quoted(a);
  expect((await call(env, 'POST', `/api/c/orders/${o.id}/accept`, { version: 7 }, a.c)).status).toBe(409);
  expect((await call(env, 'POST', `/api/c/orders/${o.id}/accept`, { version: 1 }, a.c)).status).toBe(200);
  expect((await call(env, 'GET', `/api/c/orders/${o.id}`, undefined, a.c)).body.status).toBe('khach_dong_y');
});

test('admin dashboard lists newFromCustomers until admin opens the order', async () => {
  const a = await customer(1);
  const o = await photoOrder(a.c);
  await call(env, 'PUT', `/api/c/orders/${o.id}`, o, a.c);
  let d = (await call(env, 'GET', '/api/dashboard', undefined, admin)).body;
  expect(d.newFromCustomers.map((x: any) => x.id)).toEqual([o.id]);
  expect(d.newFromCustomers[0].source).toBe('customer');
  await call(env, 'GET', `/api/orders/${o.id}`, undefined, admin);
  d = (await call(env, 'GET', '/api/dashboard', undefined, admin)).body;
  expect(d.newFromCustomers).toEqual([]);
});

test('reorder a visible library design without a photo', async () => {
  const a = await customer(1), b = await customer(2);
  const oa = await photoOrder(a.c);
  await call(env, 'PUT', `/api/c/orders/${oa.id}`, oa, a.c);
  const ob = { id: uid('order'), neededBy: null, note: '', deliverNote: '', isPrivate: false, images: [],
    items: [{ ...item(1), designId: oa.items[0].designId, imageId: null, crop: null, cropKey: '', lines: [line({ qtyEach: 5 })] }] };
  const r = await call(env, 'PUT', `/api/c/orders/${ob.id}`, ob, b.c);
  expect(r.status).toBe(200);
  expect(r.body.items[0].cropKey).toBe(oa.items[0].cropKey);
  expect(r.body.images).toEqual([]);
});

test('ordering a product colour twice reuses one library design (the colour gets linked on first order)', async () => {
  const pub = (await call(env, 'POST', '/api/content/images?w=1&h=1', jpeg, admin, { 'content-type': 'image/jpeg' })).body.key as string;
  const p = (await call(env, 'POST', '/api/products', { name: { vi: 'Kẹp' }, published: true, colors: [{ name: { vi: 'Đen' }, imageKey: pub }] }, admin)).body;
  const colorId = p.colors[0].id as string;
  const fromProduct = () => ({
    id: uid('order'), neededBy: null, note: '', deliverNote: '', images: [],
    items: [item(1, { designId: uid('d'), imageId: null, crop: null, cropKey: '', productId: p.id, colorId, lines: [line({ qtyEach: 5 })] })],
  });
  const a = await customer(1), b = await customer(2);
  const o1 = fromProduct(), o2 = fromProduct();
  expect((await call(env, 'PUT', `/api/c/orders/${o1.id}`, o1, a.c)).status).toBe(200);
  expect((await call(env, 'PUT', `/api/c/orders/${o2.id}`, o2, b.c)).status).toBe(200);
  const d1 = (await call(env, 'GET', `/api/c/orders/${o1.id}`, undefined, a.c)).body.items[0].designId;
  const d2 = (await call(env, 'GET', `/api/c/orders/${o2.id}`, undefined, b.c)).body.items[0].designId;
  expect(d2).toBe(d1);
  const lib = (await call(env, 'GET', '/api/c/library', undefined, a.c)).body.items.filter((x: any) => x.id === d1);
  expect(lib).toHaveLength(1);
  expect(lib[0].orderCount).toBe(2);
});

test("an admin edit that doesn't send deliverNote keeps the customer's delivery place", async () => {
  const a = await customer(1);
  const o = await photoOrder(a.c);
  expect((await call(env, 'PUT', `/api/c/orders/${o.id}`, o, a.c)).status).toBe(200);
  const v = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, admin)).body;
  const { deliverNote: _drop, ...rest } = v;
  const r = await call(env, 'PUT', `/api/orders/${o.id}`, { ...rest, note: 'anh sửa' }, admin);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ note: 'anh sửa', deliverNote: 'Bến xe Phnom Penh', source: 'customer' });
});

test('orders show which product and colour each design came from', async () => {
  const pub = (await call(env, 'POST', '/api/content/images?w=1&h=1', jpeg, admin, { 'content-type': 'image/jpeg' })).body.key as string;
  const p = (await call(env, 'POST', '/api/products', { name: { vi: 'Kẹp đế êm', en: 'Soft flip-flop' }, published: true, colors: [{ name: { vi: 'Đen', en: 'Black' }, imageKey: pub }] }, admin)).body;
  const a = await customer(1);
  const it = item(1, { designId: uid('d'), imageId: null, crop: null, cropKey: '', productId: p.id, colorId: p.colors[0].id, lines: [line({ qtyEach: 2 })] });
  const o = { id: uid('order'), neededBy: null, note: '', deliverNote: '', images: [], items: [it] };
  expect((await call(env, 'PUT', `/api/c/orders/${o.id}`, o, a.c)).status).toBe(200);
  const want = { product: { vi: 'Kẹp đế êm', en: 'Soft flip-flop', km: '' }, color: { vi: 'Đen', en: 'Black', km: '' } };
  expect((await call(env, 'GET', `/api/c/orders/${o.id}`, undefined, a.c)).body.productTitles).toEqual({ [it.id]: want });
  expect((await call(env, 'GET', `/api/orders/${o.id}`, undefined, admin)).body.productTitles).toEqual({ [it.id]: want });
});
