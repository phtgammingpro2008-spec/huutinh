import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, loginCookie } from '../helpers/http';
import type { Env } from '../../src/worker/env';

let env: Env;
let admin: string;
const jpeg = new Uint8Array([0xff, 0xd8, 4, 4, 0xff, 0xd9]);
const upPub = async () => (await call(env, 'POST', '/api/content/images?w=1&h=1', jpeg, admin, { 'content-type': 'image/jpeg' })).body.key as string;
beforeEach(async () => { env = await createTestEnv(); admin = await loginCookie(env); });

test('product CRUD round-trip with 3 languages, lines and colours; slugs de-duplicated', async () => {
  const img = await upPub();
  const body = { name: { vi: 'Dép kẹp', en: 'Flip-flop', km: 'ស្បែកជើងផ្ទាត់' }, desc: { vi: 'Đế êm' }, isNew: true, published: true,
    lines: [{ key: 'nam', label: { vi: 'Nam', en: 'Men', km: 'បុរស' }, sizeFrom: 39, sizeTo: 44 }], colors: [{ name: { vi: 'Đen', en: 'Black' }, imageKey: img }] };
  const a = (await call(env, 'POST', '/api/products', body, admin)).body;
  expect(a).toMatchObject({ slug: 'dep-kep', name: { vi: 'Dép kẹp', en: 'Flip-flop', km: 'ស្បែកជើងផ្ទាត់' }, isNew: true, published: true });
  expect(a.colors[0]).toMatchObject({ name: { vi: 'Đen', en: 'Black', km: '' }, imageKey: img });
  const b = (await call(env, 'POST', '/api/products', body, admin)).body;
  expect(b.slug).toBe('dep-kep-2');
  const u = (await call(env, 'PUT', `/api/products/${a.id}`, { ...a, colors: [...a.colors, { name: { vi: 'Kem' }, imageKey: img }] }, admin)).body;
  expect(u.colors.map((c: any) => c.name.vi)).toEqual(['Đen', 'Kem']);
  expect(u.slug).toBe('dep-kep');
  expect((await call(env, 'DELETE', `/api/products/${b.id}`, undefined, admin)).status).toBe(200);
  expect((await call(env, 'GET', '/api/products', undefined, admin)).body).toHaveLength(1);
  expect((await call(env, 'POST', '/api/products', { name: { vi: '' } }, admin)).status).toBe(400);
});

test('collection keeps product order; poster order and publish; shop info', async () => {
  const img = await upPub();
  const p1 = (await call(env, 'POST', '/api/products', { name: { vi: 'A' }, published: true, colors: [{ name: { vi: 'x' }, imageKey: img }] }, admin)).body;
  const p2 = (await call(env, 'POST', '/api/products', { name: { vi: 'B' }, published: true, colors: [{ name: { vi: 'x' }, imageKey: img }] }, admin)).body;
  const col = (await call(env, 'POST', '/api/collections', { title: { vi: 'Đi biển cuối tuần' }, color: '#c96a3a', published: true, productIds: [p2.id, p1.id] }, admin)).body;
  expect(col.productIds).toEqual([p2.id, p1.id]);
  const posterA = (await call(env, 'POST', '/api/posters', { title: { vi: 'Mùa hè' }, published: true, position: 2, imageKey: img }, admin)).body;
  await call(env, 'POST', '/api/posters', { title: { vi: 'Tết' }, published: true, position: 1 }, admin);
  await call(env, 'POST', '/api/posters', { title: { vi: 'Nháp' }, published: false, position: 0 }, admin);
  expect((await call(env, 'PUT', '/api/shop', { zalo: '0901234567', messenger: 'm.me/hl', workshopAddress: 'Q.12', warehouseAddress: 'Phnom Penh' }, admin)).status).toBe(200);
  const { getPublicHome } = await import('../../src/worker/repo/products');
  const home = await getPublicHome(env);
  expect(home.posters.map((p) => p.title.vi)).toEqual(['Tết', 'Mùa hè']);
  expect(home.collections[0]).toMatchObject({ title: { vi: 'Đi biển cuối tuần' }, productIds: [p2.id, p1.id] });
  expect(home.shop).toEqual({ zalo: '0901234567', messenger: 'm.me/hl', workshopAddress: 'Q.12', warehouseAddress: 'Phnom Penh' });
  expect((await call(env, 'PUT', `/api/posters/${posterA.id}`, { ...posterA, published: false }, admin)).body.published).toBe(false);
  expect((await call(env, 'DELETE', `/api/collections/${col.id}`, undefined, admin)).status).toBe(200);
});
