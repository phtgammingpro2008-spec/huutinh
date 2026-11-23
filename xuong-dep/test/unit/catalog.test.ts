import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, loginCookie } from '../helpers/http';
import type { Env } from '../../src/worker/env';

let env: Env;
let c: string;
beforeEach(async () => { env = await createTestEnv(); c = await loginCookie(env); });

test('catalog endpoints require auth', async () => {
  for (const p of ['/api/customers', '/api/materials', '/api/settings']) expect((await call(env, 'GET', p)).status).toBe(401);
});

test('create customer with name only uses vi + VND defaults', async () => {
  const r = await call(env, 'POST', '/api/customers', { name: 'chị Nga' }, c);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ name: 'chị Nga', lang: 'vi', currency: 'VND', zalo: '', messenger: '', note: '' });
  expect(typeof r.body.id).toBe('string');
});

test('customer name is required', async () => {
  const r = await call(env, 'POST', '/api/customers', { name: '  ' }, c);
  expect(r.status).toBe(400);
  expect(r.body.error).toBe('Cần nhập tên khách');
});

test("reject currency EUR with 400 'Chỉ nhận VND hoặc USD'", async () => {
  const r = await call(env, 'POST', '/api/customers', { name: 'A', currency: 'EUR' }, c);
  expect(r.status).toBe(400);
  expect(r.body.error).toBe('Chỉ nhận VND hoặc USD');
  expect((await call(env, 'POST', '/api/customers', { name: 'A', lang: 'fr' }, c)).status).toBe(400);
});

test('search customers by name or zalo, update, get with orders', async () => {
  const a = (await call(env, 'POST', '/api/customers', { name: 'chị Nga', zalo: '0901234567' }, c)).body;
  await call(env, 'POST', '/api/customers', { name: 'Sokha', lang: 'km', currency: 'USD', country: 'KH' }, c);
  expect((await call(env, 'GET', '/api/customers?q=nga', undefined, c)).body.map((x: any) => x.name)).toEqual(['chị Nga']);
  expect((await call(env, 'GET', '/api/customers?q=0901', undefined, c)).body).toHaveLength(1);
  expect((await call(env, 'GET', '/api/customers', undefined, c)).body).toHaveLength(2);
  const u = await call(env, 'PUT', `/api/customers/${a.id}`, { ...a, note: 'khách quen', currency: 'USD' }, c);
  expect(u.body).toMatchObject({ note: 'khách quen', currency: 'USD', name: 'chị Nga' });
  const g = await call(env, 'GET', `/api/customers/${a.id}`, undefined, c);
  expect(g.body.orders).toEqual([]);
  expect((await call(env, 'GET', '/api/customers/khong-co', undefined, c)).status).toBe(404);
});

test('hidden material excluded from default list', async () => {
  const m = (await call(env, 'POST', '/api/materials', { kind: 'sole', nameVi: 'VIP 1' }, c)).body;
  expect(m).toMatchObject({ kind: 'sole', nameVi: 'VIP 1', nameEn: '', nameKm: '', hidden: false });
  await call(env, 'POST', '/api/materials', { kind: 'strap', nameVi: '15L', nameEn: '15L strap' }, c);
  await call(env, 'PUT', `/api/materials/${m.id}`, { ...m, hidden: true }, c);
  expect((await call(env, 'GET', '/api/materials', undefined, c)).body.map((x: any) => x.nameVi)).toEqual(['15L']);
  expect((await call(env, 'GET', '/api/materials?all=1', undefined, c)).body).toHaveLength(2);
  expect((await call(env, 'GET', '/api/materials?kind=sole&all=1', undefined, c)).body.map((x: any) => x.nameVi)).toEqual(['VIP 1']);
});

test('material kind is validated', async () => {
  const r = await call(env, 'POST', '/api/materials', { kind: 'color', nameVi: 'Đỏ' }, c);
  expect(r.status).toBe(400);
  expect((await call(env, 'POST', '/api/materials', { kind: 'sole', nameVi: '' }, c)).status).toBe(400);
});

test('settings round-trip keeps Nam 39–44', async () => {
  const s = (await call(env, 'GET', '/api/settings', undefined, c)).body;
  expect(s.lines[0]).toMatchObject({ key: 'nam', sizeFrom: 39, sizeTo: 44 });
  expect(Object.keys(s.quoteMessage).sort()).toEqual(['en', 'km', 'vi']);
  const lines = [...s.lines, { key: 'tre_em', label: { vi: 'Trẻ em', en: 'Kids', km: 'កុមារ' }, sizeFrom: 28, sizeTo: 34 }];
  const p = await call(env, 'PUT', '/api/settings', { lines, quoteMessage: { ...s.quoteMessage, vi: 'Đơn {code}: {url}' } }, c);
  expect(p.status).toBe(200);
  const s2 = (await call(env, 'GET', '/api/settings', undefined, c)).body;
  expect(s2.lines).toHaveLength(3);
  expect(s2.lines[0]).toMatchObject({ key: 'nam', sizeFrom: 39, sizeTo: 44 });
  expect(s2.quoteMessage.vi).toBe('Đơn {code}: {url}');
});

test('settings rejects bad size line', async () => {
  const r = await call(env, 'PUT', '/api/settings', { lines: [{ key: 'nam', label: { vi: 'Nam' }, sizeFrom: 44, sizeTo: 39 }] }, c);
  expect(r.status).toBe(400);
  expect((await call(env, 'PUT', '/api/settings', { lines: [] }, c)).status).toBe(400);
});
