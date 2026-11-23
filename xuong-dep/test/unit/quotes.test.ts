import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, loginCookie } from '../helpers/http';
import { item, line, newCustomer, sampleOrder, saveOrder } from '../helpers/orders';
import type { Env } from '../../src/worker/env';
import type { OrderInput } from '../../src/shared/types';

let env: Env;
let c: string;
let clock = new Date('2026-11-22T03:00:00Z');
beforeEach(async () => {
  clock = new Date('2026-11-22T03:00:00Z');
  env = await createTestEnv({ now: () => clock });
  c = await loginCookie(env);
});

async function pricedOrder(custBody: Record<string, unknown> = { name: 'chị Nga', zalo: '090 123-4567' }, price = 47000) {
  const cust = await newCustomer(env, c, custBody);
  const o = sampleOrder(cust.id);
  await saveOrder(env, c, o);
  const prices = o.items.map((i) => ({ lineId: i.lines[0].id, unitPrice: price }));
  const r = await call(env, 'PUT', `/api/orders/${o.id}/prices`, { prices }, c);
  expect(r.status).toBe(200);
  return { o, cust, view: r.body };
}

async function send(o: OrderInput) {
  return call(env, 'POST', `/api/orders/${o.id}/send-quote`, {}, c);
}

test('prices endpoint sets unit prices and totals', async () => {
  const { view } = await pricedOrder();
  expect(view.totals).toEqual({ qty: 1410, amount: 66_270_000, missingPrice: false });
});

test('prices endpoint rejects unknown line and locked order', async () => {
  const { o } = await pricedOrder();
  expect((await call(env, 'PUT', `/api/orders/${o.id}/prices`, { prices: [{ lineId: 'nope', unitPrice: 1 }] }, c)).status).toBe(400);
  await env.DB.prepare("UPDATE orders SET status = 'dang_san_xuat' WHERE id = ?").bind(o.id).run();
  const r = await call(env, 'PUT', `/api/orders/${o.id}/prices`, { prices: [{ lineId: o.items[0].lines[0].id, unitPrice: 1 }] }, c);
  expect(r.status).toBe(409);
});

test('send-quote refuses when a line has no price', async () => {
  const cust = await newCustomer(env, c);
  const o = sampleOrder(cust.id);
  await saveOrder(env, c, o);
  const r = await send(o);
  expect(r.status).toBe(400);
  expect(r.body.error).toBe('Còn dòng chưa có giá');
});

test("send-quote message is in customer's language and contains code and url", async () => {
  const { o } = await pricedOrder({ name: 'John', lang: 'en', messenger: 'https://m.me/john' });
  const r = await send(o);
  expect(r.status).toBe(200);
  expect(r.body.version).toBe(1);
  expect(r.body.url).toMatch(/^https:\/\/xuong\.test\/q\/[A-Za-z0-9_-]{32,}$/);
  expect(r.body.message).toContain('DH261122-001');
  expect(r.body.message).toContain(r.body.url);
  expect(r.body.message).toContain('66.270.000 ₫');
  expect(r.body.message).toContain('Please review');
  expect(r.body.messengerUrl).toBe('https://m.me/john');
  expect(r.body.zaloUrl).toBeNull();
  const g = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, c)).body;
  expect(g.status).toBe('da_bao_gia');
  expect(g.quotedAt).not.toBeNull();
});

test("zaloUrl strips non-digits ('090 123-4567' → https://zalo.me/0901234567)", async () => {
  const { o } = await pricedOrder();
  expect((await send(o)).body.zaloUrl).toBe('https://zalo.me/0901234567');
});

test('token length ≥ 32 and URL-safe; re-sending unchanged quote keeps token and version', async () => {
  const { o } = await pricedOrder();
  const a = (await send(o)).body;
  const b = (await send(o)).body;
  const token = a.url.split('/q/')[1];
  expect(token.length).toBeGreaterThanOrEqual(32);
  expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(b.url).toBe(a.url);
  expect(b.version).toBe(1);
});

test('public quote shows latest version after edit', async () => {
  const { o } = await pricedOrder();
  const token = (await send(o)).body.url.split('/q/')[1];
  const p1 = (await call(env, 'GET', `/api/public/quote/${token}`)).body;
  expect(p1).toMatchObject({ code: 'DH261122-001', status: 'da_bao_gia', lang: 'vi', acceptedVersion: null });
  expect(p1.snapshot.version).toBe(1);
  expect(p1.snapshot.totalQty).toBe(1410);
  expect(p1.snapshot.totalAmount).toBe(66_270_000);
  expect(p1.snapshot.items[0].lines[0]).toMatchObject({ lineKey: 'nam', label: { vi: 'Nam', en: 'Men', km: 'បុរស' }, qty: 510, unitPrice: 47000, amount: 23_970_000 });
  expect(p1.snapshot.items[0].lines[0].sizes).toEqual({ '39': 85, '40': 85, '41': 85, '42': 85, '43': 85, '44': 85 });
  // edit qty on the quoted order → new version visible
  const view = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, c)).body;
  view.items[0].lines[0].qtyEach = 100;
  await saveOrder(env, c, view);
  const p2 = (await call(env, 'GET', `/api/public/quote/${token}`)).body;
  expect(p2.snapshot.version).toBe(2);
  expect(p2.snapshot.totalQty).toBe(1410 + 15 * 6);
  expect((await call(env, 'GET', '/api/public/quote/khong-co-token-nay-dau-nhe-123456789')).status).toBe(404);
});

test('snapshot carries material names in all three languages', async () => {
  const cust = await newCustomer(env, c);
  const sole = (await call(env, 'POST', '/api/materials', { kind: 'sole', nameVi: 'Đế VIP 1', nameEn: 'VIP 1 sole' }, c)).body;
  const o = sampleOrder(cust.id, { items: [item(1, { soleId: sole.id, colorNote: 'đen', lines: [line({ qtyEach: 1, unitPrice: 5 })] })] });
  await saveOrder(env, c, o);
  const token = (await send(o)).body.url.split('/q/')[1];
  const s = (await call(env, 'GET', `/api/public/quote/${token}`)).body.snapshot;
  expect(s.items[0].materials.sole).toEqual({ vi: 'Đế VIP 1', en: 'VIP 1 sole', km: 'Đế VIP 1' });
  expect(s.items[0].materials.strap).toBeNull();
  expect(s.items[0].colorNote).toBe('đen');
});

test('accept → khach_dong_y; stale version → 409 with localized message', async () => {
  const { o } = await pricedOrder({ name: 'Sokha', lang: 'km' });
  const token = (await send(o)).body.url.split('/q/')[1];
  const view = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, c)).body;
  view.items[0].lines[0].qtyEach = 90;
  await saveOrder(env, c, view); // → version 2
  const stale = await call(env, 'POST', `/api/public/quote/${token}/accept`, { version: 1 });
  expect(stale.status).toBe(409);
  const { t } = await import('../../src/shared/i18n');
  expect(stale.body.error).toBe(t('km', 'quote.changed'));
  const staleEn = await call(env, 'POST', `/api/public/quote/${token}/accept`, { version: 1, lang: 'en' });
  expect(staleEn.body.error).toBe('This quote has changed, please reload');
  const ok = await call(env, 'POST', `/api/public/quote/${token}/accept`, { version: 2 });
  expect(ok.status).toBe(200);
  const g = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, c)).body;
  expect(g.status).toBe('khach_dong_y');
  expect(g.acceptedAt).toBe(clock.toISOString());
  const p = (await call(env, 'GET', `/api/public/quote/${token}`)).body;
  expect(p.acceptedVersion).toBe(2);
});

test('accept on cancelled order → 409', async () => {
  const { o } = await pricedOrder();
  const token = (await send(o)).body.url.split('/q/')[1];
  await env.DB.prepare("UPDATE orders SET status = 'da_huy' WHERE id = ?").bind(o.id).run();
  const r = await call(env, 'POST', `/api/public/quote/${token}/accept`, { version: 1 });
  expect(r.status).toBe(409);
  expect((await call(env, 'GET', `/api/public/quote/${token}`)).body.status).toBe('da_huy');
});

test('accept twice same version → 200 both', async () => {
  const { o } = await pricedOrder();
  const token = (await send(o)).body.url.split('/q/')[1];
  expect((await call(env, 'POST', `/api/public/quote/${token}/accept`, { version: 1 })).status).toBe(200);
  const first = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, c)).body.acceptedAt;
  clock = new Date('2026-11-22T05:00:00Z');
  expect((await call(env, 'POST', `/api/public/quote/${token}/accept`, { version: 1 })).status).toBe(200);
  expect((await call(env, 'GET', `/api/orders/${o.id}`, undefined, c)).body.acceptedAt).toBe(first);
});

test('price history returns previous 47000 for same sole/strap/style and ignores cho_bao_gia orders', async () => {
  const sole = (await call(env, 'POST', '/api/materials', { kind: 'sole', nameVi: 'VIP 1' }, c)).body;
  const cust = await newCustomer(env, c, { name: 'chị Nga' });
  const quoted = sampleOrder(cust.id, { items: [item(1, { soleId: sole.id, lines: [line({ qtyEach: 10, unitPrice: 47000 })] })] });
  await saveOrder(env, c, quoted);
  await send(quoted);
  const draft = sampleOrder(cust.id, { items: [item(1, { soleId: sole.id, lines: [line({ qtyEach: 10, unitPrice: 99000 })] })] });
  await saveOrder(env, c, draft); // cho_bao_gia → ignored
  const other = sampleOrder(cust.id, { items: [item(1, { lines: [line({ qtyEach: 10, unitPrice: 11000 })] })] });
  await saveOrder(env, c, other);
  await send(other); // different sole (null) → not matched
  const h = (await call(env, 'GET', `/api/price-history?soleId=${sole.id}`, undefined, c)).body;
  expect(h).toEqual([{ unitPrice: 47000, currency: 'VND', date: '2026-11-22', customerName: 'chị Nga', orderCode: 'DH261122-001', lineKey: 'nam' }]);
  const hNull = (await call(env, 'GET', '/api/price-history', undefined, c)).body;
  expect(hNull.map((x: any) => x.unitPrice)).toEqual([11000]);
});

test('public crop image served without auth for valid token, 404 for wrong token', async () => {
  const cust = await newCustomer(env, c);
  const bytes = new Uint8Array([0xff, 0xd8, 9, 9, 0xff, 0xd9]);
  const up = (await call(env, 'POST', '/api/images?w=1&h=1', bytes, c, { 'content-type': 'image/jpeg' })).body;
  const o = sampleOrder(cust.id, { items: [item(1, { cropKey: up.key, lines: [line({ qtyEach: 1, unitPrice: 1 })] })] });
  await saveOrder(env, c, o);
  const token = (await send(o)).body.url.split('/q/')[1];
  const img = await call(env, 'GET', `/q/${token}/img/1/0`);
  expect(img.status).toBe(200);
  expect(new Uint8Array(await img.raw.arrayBuffer())).toEqual(bytes);
  expect(img.headers.get('x-robots-tag')).toBe('noindex');
  expect((await call(env, 'GET', `/q/sai-token-123456789012345678901234567890/img/1/0`)).status).toBe(404);
  expect((await call(env, 'GET', `/q/${token}/img/1/5`)).status).toBe(404);
});
