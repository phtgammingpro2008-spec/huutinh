import { beforeEach, expect, test } from 'bun:test';
import type { Env } from '../../src/worker/env';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';

let env: Env;
let admin: string;
let cust: string;
beforeEach(async () => {
  env = await createTestEnv();
  admin = await loginCookie(env);
  cust = cookieFrom(await call(env, 'POST', '/api/register', { name: 'Chị Lan', phone: '0901234567', email: 'lan@x.vn', password: 'mat-khau-123', country: 'KH', lang: 'vi' }));
});

test('customer catalog lists size lines and visible materials only', async () => {
  await call(env, 'PUT', '/api/settings', { lines: [{ key: 'nam', label: { vi: 'Nam', en: 'Men', km: 'បុរស' }, sizeFrom: 39, sizeTo: 44 }], quoteMessage: { vi: '{url}', en: '{url}', km: '{url}' } }, admin);
  const a = (await call(env, 'POST', '/api/materials', { kind: 'sole', nameVi: 'Đế xốp', nameEn: 'Foam', nameKm: '' }, admin)).body;
  const b = (await call(env, 'POST', '/api/materials', { kind: 'strap', nameVi: 'Quai ẩn', nameEn: '', nameKm: '' }, admin)).body;
  await call(env, 'PUT', `/api/materials/${b.id}`, { ...b, hidden: true }, admin);
  const r = await call(env, 'GET', '/api/c/catalog', undefined, cust);
  expect(r.status).toBe(200);
  expect(r.body.lines[0]).toMatchObject({ key: 'nam', sizeFrom: 39, sizeTo: 44 });
  expect(r.body.materials).toEqual([{ id: a.id, kind: 'sole', name: { vi: 'Đế xốp', en: 'Foam', km: '' } }]);
  expect((await call(env, 'GET', '/api/c/catalog')).status).toBe(401);
});

test('customer updates own name and language; /api/me follows', async () => {
  const r = await call(env, 'PUT', '/api/c/profile', { name: '  Lan Nguyễn ', lang: 'km' }, cust);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ name: 'Lan Nguyễn', lang: 'km' });
  expect((await call(env, 'GET', '/api/me', undefined, cust)).body).toMatchObject({ name: 'Lan Nguyễn', lang: 'km' });
  expect((await call(env, 'PUT', '/api/c/profile', { name: '' }, cust)).status).toBe(400);
  expect((await call(env, 'PUT', '/api/c/profile', { lang: 'fr' }, cust)).status).toBe(400);
  // the admin's customer record shows the same name
  const list = (await call(env, 'GET', '/api/customers', undefined, admin)).body;
  expect(list.map((c: any) => c.name)).toContain('Lan Nguyễn');
});
