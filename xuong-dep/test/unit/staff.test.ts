import { beforeEach, expect, test } from 'bun:test';
import type { Env } from '../../src/worker/env';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';

let env: Env;
let owner: string;
beforeEach(async () => { env = await createTestEnv(); owner = await loginCookie(env); });

const login = async (name: string, password: string) => call(env, 'POST', '/api/login', { id: name, password });

test('the owner creates a manager account; names and passwords are checked', async () => {
  expect((await call(env, 'POST', '/api/staff', { name: 'Hào', password: 'mat-khau-hao-1' }, owner)).body.code).toBe('bad_name');
  expect((await call(env, 'POST', '/api/staff', { name: '0883219569', password: 'mat-khau-hao-1' }, owner)).body.code).toBe('bad_name');
  expect((await call(env, 'POST', '/api/staff', { name: 'hao', password: 'ngan' }, owner)).body.code).toBe('weak_password');
  const r = await call(env, 'POST', '/api/staff', { name: ' Hao ', password: 'mat-khau-hao-1' }, owner);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ name: 'hao', locked: false });
  expect((await call(env, 'POST', '/api/staff', { name: 'hao', password: 'mat-khau-khac-2' }, owner)).status).toBe(409);
  expect((await call(env, 'POST', '/api/staff', { name: 'anh', password: 'mat-khau-khac-2' }, owner)).status).toBe(409); // the owner's own name
  expect((await call(env, 'GET', '/api/staff', undefined, owner)).body.map((s: { name: string }) => s.name)).toEqual(['hao']);
  const me = await call(env, 'GET', '/api/me', undefined, cookieFrom(await login('hao', 'mat-khau-hao-1')));
  expect(me.body).toMatchObject({ role: 'staff', name: 'hao' });
});

test('a manager does the daily work but not the owner settings', async () => {
  await call(env, 'POST', '/api/staff', { name: 'hao', password: 'mat-khau-hao-1' }, owner);
  const staff = cookieFrom(await login('hao', 'mat-khau-hao-1'));
  for (const path of ['/api/orders', '/api/dashboard', '/api/customers', '/api/designs', '/api/products', '/api/gallery', '/api/settings', '/api/materials']) {
    expect([path, (await call(env, 'GET', path, undefined, staff)).status]).toEqual([path, 200]);
  }
  expect((await call(env, 'POST', '/api/materials', { kind: 'sole', nameVi: 'EVA mềm' }, staff)).status).toBe(200);
  const owned: [string, string, unknown?][] = [
    ['PUT', '/api/settings', { lines: [], quoteMessage: { vi: '{url}', en: '{url}', km: '{url}' }, minOrderPairs: 1 }],
    ['PUT', '/api/shop', { address: '', messenger: '', ceo: { name: '', phone: '' }, sales: { name: 'X', phone: '1' } }],
    ['GET', '/api/export'], ['GET', '/api/users'], ['GET', '/api/staff'], ['POST', '/api/staff', { name: 'khac', password: 'mat-khau-khac-2' }],
    ['GET', '/api/telegram'], ['POST', '/api/telegram/connect', { token: 'x' }], ['DELETE', '/api/telegram'],
  ];
  for (const [m, path, body] of owned) expect([m, path, (await call(env, m, path, body, staff)).status]).toEqual([m, path, 403]);
  // the settings stayed as they were
  expect((await call(env, 'GET', '/api/settings', undefined, owner)).body.minOrderPairs).toBe(10);
});

test('locking or a new password signs the manager out; customers still see nothing', async () => {
  const s = (await call(env, 'POST', '/api/staff', { name: 'hao', password: 'mat-khau-hao-1' }, owner)).body;
  const staff = cookieFrom(await login('hao', 'mat-khau-hao-1'));
  await call(env, 'POST', `/api/staff/${s.id}/lock`, undefined, owner);
  expect((await call(env, 'GET', '/api/orders', undefined, staff)).status).toBe(401);
  expect((await login('hao', 'mat-khau-hao-1')).status).not.toBe(200);
  await call(env, 'POST', `/api/staff/${s.id}/unlock`, undefined, owner);
  const again = cookieFrom(await login('hao', 'mat-khau-hao-1'));
  expect((await call(env, 'POST', `/api/staff/${s.id}/password`, { password: 'mat-khau-moi-9' }, owner)).status).toBe(200);
  expect((await call(env, 'GET', '/api/orders', undefined, again)).status).toBe(401);
  expect((await login('hao', 'mat-khau-hao-1')).status).toBe(401);
  expect((await login('hao', 'mat-khau-moi-9')).status).toBe(200);

  const cust = cookieFrom(await call(env, 'POST', '/api/register', { name: 'Khách', phone: '0901234567', email: 'k@k.vn', password: 'mat-khau-123', country: 'VN', lang: 'vi' }));
  expect((await call(env, 'GET', '/api/staff', undefined, cust)).status).toBe(404);
  expect((await call(env, 'GET', '/api/export', undefined, cust)).status).toBe(404);
});
