import { beforeEach, expect, test } from 'bun:test';
import type { Env } from '../../src/worker/env';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';
import { sampleOrder } from '../helpers/orders';

let env: Env;
let owner: string;
beforeEach(async () => { env = await createTestEnv(); owner = await loginCookie(env); });

const login = async (name: string, password: string) => cookieFrom(await call(env, 'POST', '/api/login', { id: name, password }));

test('the owner creates a workshop (Xưởng) account; it signs in by name', async () => {
  const r = await call(env, 'POST', '/api/staff', { name: 'tho1', password: 'mat-khau-tho-1', role: 'worker' }, owner);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ name: 'tho1', role: 'worker' });
  expect((await call(env, 'POST', '/api/staff', { name: 'hao', password: 'mat-khau-hao-1' }, owner)).body.role).toBe('staff');
  expect((await call(env, 'POST', '/api/staff', { name: 'x1', password: 'mat-khau-xx-1', role: 'admin' }, owner)).status).toBe(400);
  const list = (await call(env, 'GET', '/api/staff', undefined, owner)).body;
  expect(list.map((s: { name: string; role: string }) => [s.name, s.role])).toEqual([['tho1', 'worker'], ['hao', 'staff']]);
  const w = await login('tho1', 'mat-khau-tho-1');
  expect((await call(env, 'GET', '/api/me', undefined, w)).body.role).toBe('worker');
  // the owner can lock it like a manager
  await call(env, 'POST', `/api/staff/${r.body.id}/lock`, undefined, owner);
  expect((await call(env, 'GET', '/api/me', undefined, w)).status).toBe(401);
});

test('a workshop account sees nothing of the admin area; a manager cannot create one', async () => {
  await call(env, 'POST', '/api/staff', { name: 'tho1', password: 'mat-khau-tho-1', role: 'worker' }, owner);
  await call(env, 'POST', '/api/staff', { name: 'hao', password: 'mat-khau-hao-1' }, owner);
  const w = await login('tho1', 'mat-khau-tho-1');
  for (const path of ['/api/orders', '/api/customers', '/api/settings', '/api/staff', '/api/dashboard', '/api/designs']) {
    expect([path, (await call(env, 'GET', path, undefined, w)).status]).toEqual([path, 404]);
  }
  const staff = await login('hao', 'mat-khau-hao-1');
  expect((await call(env, 'POST', '/api/staff', { name: 'tho2', password: 'mat-khau-tho-2', role: 'worker' }, staff)).status).toBe(403);
});

test('a workshop account sees only the design crops of orders it may pack, never the original photo', async () => {
  const cust = (await call(env, 'POST', '/api/customers', { name: 'Chị Lan', zalo: '012345678' }, owner)).body;
  const o = sampleOrder(cust.id);
  // real stored-key shape (the media route accepts nothing else)
  o.images[0].key = `img/2026/11/${crypto.randomUUID()}.jpg`;
  o.items[0].cropKey = `img/2026/11/${crypto.randomUUID()}.jpg`;
  await call(env, 'PUT', `/api/orders/${o.id}`, o, owner);
  await env.IMAGES.put(o.images[0].key, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer, { httpMetadata: { contentType: 'image/jpeg' } });
  await call(env, 'POST', '/api/staff', { name: 'tho1', password: 'mat-khau-tho-1', role: 'worker' }, owner);
  const w = await login('tho1', 'mat-khau-tho-1');
  const crop = o.items[0].cropKey;
  await env.IMAGES.put(crop, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer, { httpMetadata: { contentType: 'image/jpeg' } });
  // not accepted yet: nothing
  expect((await call(env, 'GET', '/media/' + crop, undefined, w)).status).toBe(404);
  await env.DB.prepare("UPDATE orders SET status = 'khach_dong_y' WHERE id = ?").bind(o.id).run();
  expect((await call(env, 'GET', '/media/' + crop, undefined, w)).status).toBe(200);
  expect((await call(env, 'GET', '/media/' + o.images[0].key, undefined, w)).status).toBe(404);
});
