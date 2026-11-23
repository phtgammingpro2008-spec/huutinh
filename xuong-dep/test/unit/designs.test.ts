import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, loginCookie } from '../helpers/http';
import { item, line, newCustomer, sampleOrder, saveOrder } from '../helpers/orders';
import type { Env } from '../../src/worker/env';

let env: Env;
let c: string;
let cust: { id: string };
beforeEach(async () => {
  env = await createTestEnv();
  c = await loginCookie(env);
  cust = await newCustomer(env, c);
});

test('saving creates designs with label dat_rieng and allow_public false by default', async () => {
  const sole = (await call(env, 'POST', '/api/materials', { kind: 'sole', nameVi: 'VIP 1' }, c)).body;
  const o = sampleOrder(cust.id);
  o.items[0].soleId = sole.id;
  await saveOrder(env, c, o);
  const ds = (await call(env, 'GET', '/api/designs', undefined, c)).body;
  expect(ds).toHaveLength(9);
  expect(ds.every((d: any) => d.label === 'dat_rieng' && d.allowPublic === false)).toBe(true);
  const d0 = ds.find((d: any) => d.id === o.items[0].designId);
  expect(d0).toMatchObject({ soleId: sole.id, cropKey: 'img/2026/11/crop-1.jpg', imageKey: 'img/2026/11/tong.jpg' });
  // saving again does not duplicate designs
  await saveOrder(env, c, o);
  expect((await call(env, 'GET', '/api/designs', undefined, c)).body).toHaveLength(9);
});

test('order with allowPublic true marks its new designs allowPublic', async () => {
  await saveOrder(env, c, sampleOrder(cust.id, { allowPublic: true }));
  const ds = (await call(env, 'GET', '/api/designs', undefined, c)).body;
  expect(ds.every((d: any) => d.allowPublic === true)).toBe(true);
});

test('library-only save creates designs and no order', async () => {
  const o = sampleOrder(cust.id);
  const r = await call(env, 'POST', '/api/library', { images: o.images, items: o.items.slice(0, 3) }, c);
  expect(r.status).toBe(200);
  expect(r.body.designIds).toHaveLength(3);
  expect((await call(env, 'GET', '/api/designs', undefined, c)).body).toHaveLength(3);
  expect((await call(env, 'GET', '/api/orders', undefined, c)).body).toHaveLength(0);
  const img = await env.DB.prepare('SELECT order_id FROM order_images').first<{ order_id: string | null }>();
  expect(img!.order_id).toBeNull();
});

test('filters, detail with orders, and update', async () => {
  const style = (await call(env, 'POST', '/api/materials', { kind: 'style', nameVi: 'Kẹp' }, c)).body;
  const o = sampleOrder(cust.id, { items: [item(1, { styleId: style.id, colorNote: 'đỏ đô' }), item(2)] });
  const saved = (await saveOrder(env, c, o)).body;
  const d1 = o.items[0].designId;
  const u = await call(env, 'PUT', `/api/designs/${d1}`, { label: 'co_dinh', note: 'mẫu kẹp đỏ', allowPublic: true, soleId: null, strapId: null, styleId: style.id }, c);
  expect(u.status).toBe(200);
  expect(u.body).toMatchObject({ label: 'co_dinh', note: 'mẫu kẹp đỏ', allowPublic: true });
  const ids = async (qs: string) => (await call(env, 'GET', '/api/designs' + qs, undefined, c)).body.map((x: any) => x.id);
  expect(await ids('?label=co_dinh')).toEqual([d1]);
  expect(await ids(`?styleId=${style.id}`)).toEqual([d1]);
  expect(await ids('?q=kẹp')).toEqual([d1]);
  const det = (await call(env, 'GET', `/api/designs/${d1}`, undefined, c)).body;
  expect(det.orders).toEqual([expect.objectContaining({ id: o.id, code: saved.code, customerName: 'chị Nga' })]);
  expect((await call(env, 'PUT', `/api/designs/${d1}`, { label: 'xyz' }, c)).status).toBe(400);
  expect((await call(env, 'GET', '/api/designs/khong-co', undefined, c)).status).toBe(404);
});

test('item from an existing library design reuses it (no new design, crop from library)', async () => {
  const o = sampleOrder(cust.id);
  await saveOrder(env, c, o);
  const d = o.items[0];
  const o2 = sampleOrder(cust.id, {
    images: [],
    items: [{ ...item(1), designId: d.designId, imageId: null, crop: null, tapX: null, tapY: null, cropKey: '', lines: [line({ qtyEach: 5 })] }],
  });
  const r = await saveOrder(env, c, o2);
  expect(r.status).toBe(200);
  expect(r.body.items[0].cropKey).toBe(d.cropKey);
  expect((await call(env, 'GET', '/api/designs', undefined, c)).body).toHaveLength(9);
  const det = (await call(env, 'GET', `/api/designs/${d.designId}`, undefined, c)).body;
  expect(det.orders).toHaveLength(2);
});

test('new design without a crop is rejected', async () => {
  const o = sampleOrder(cust.id, { items: [item(1, { cropKey: '' })] });
  const r = await saveOrder(env, c, o);
  expect(r.status).toBe(400);
});
