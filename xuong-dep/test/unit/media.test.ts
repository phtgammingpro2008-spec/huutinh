import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';
import { item, line, sampleOrder } from '../helpers/orders';
import type { Env } from '../../src/worker/env';

let env: Env;
let admin: string;
const jpeg = (b: number) => new Uint8Array([0xff, 0xd8, b, b, 0xff, 0xd9]);

async function customer(n: number) {
  const r = await call(env, 'POST', '/api/register', { name: `Khách ${n}`, phone: `09012345${10 + n}`, email: `k${n}@k.vn`, password: 'mat-khau-123', country: 'VN', lang: 'vi' });
  const c = cookieFrom(r);
  const me = (await call(env, 'GET', '/api/me', undefined, c)).body;
  return { c, customerId: me.customerId as string };
}
const upAdmin = async (b: number) => (await call(env, 'POST', '/api/images?w=1&h=1', jpeg(b), admin, { 'content-type': 'image/jpeg' })).body.key as string;
const media = (key: string, c?: string) => call(env, 'GET', '/media/' + key, undefined, c);

beforeEach(async () => {
  env = await createTestEnv();
  admin = await loginCookie(env);
});

test('customer sees own upload, not another customer\'s (404)', async () => {
  const a = await customer(1), b = await customer(2);
  const up = await call(env, 'POST', '/api/c/images?w=1&h=1', jpeg(7), a.c, { 'content-type': 'image/jpeg' });
  expect(up.status).toBe(200);
  expect((await media(up.body.key, a.c)).status).toBe(200);
  expect((await media(up.body.key, b.c)).status).toBe(404);
  expect((await media(up.body.key)).status).toBe(404);
  expect((await call(env, 'POST', '/api/c/images?w=1&h=1', jpeg(7), undefined, { 'content-type': 'image/jpeg' })).status).toBe(401);
});

test('customer sees crop of a visible library design but never its original image', async () => {
  const a = await customer(1), b = await customer(2);
  const original = await upAdmin(1), crop = await upAdmin(2), privCrop = await upAdmin(3);
  const o = sampleOrder(a.customerId, {
    images: [{ id: 'img-1', key: original, width: 10, height: 10 }],
    items: [item(1, { cropKey: crop, lines: [line({ qtyEach: 1 })] }), item(2, { cropKey: privCrop, lines: [line({ qtyEach: 1 })] })],
  });
  expect((await call(env, 'PUT', `/api/orders/${o.id}`, o, admin)).status).toBe(200);
  await env.DB.prepare('UPDATE designs SET is_private = 1 WHERE crop_key = ?').bind(privCrop).run();
  expect((await media(original, a.c)).status).toBe(200); // own order photo
  expect((await media(crop, b.c)).status).toBe(200); // shared library crop
  expect((await media(original, b.c)).status).toBe(404); // never another customer's original
  expect((await media(privCrop, b.c)).status).toBe(404); // private design
  expect((await media(privCrop, a.c)).status).toBe(200); // but the owner still sees it
  expect((await media(crop)).status).toBe(404); // guests see no library crops
});

test('pub key served to guest with public cache header', async () => {
  const up = await call(env, 'POST', '/api/content/images?w=1&h=1', jpeg(9), admin, { 'content-type': 'image/jpeg' });
  expect(up.body.key).toMatch(/^pub\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/);
  const r = await media(up.body.key);
  expect(r.status).toBe(200);
  expect(r.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  const a = await customer(1);
  expect((await call(env, 'POST', '/api/content/images?w=1&h=1', jpeg(9), a.c, { 'content-type': 'image/jpeg' })).status).toBe(404);
});

test('admin sees everything; bad keys are 404', async () => {
  const a = await customer(1);
  const up = (await call(env, 'POST', '/api/c/images?w=1&h=1', jpeg(5), a.c, { 'content-type': 'image/jpeg' })).body.key;
  expect((await media(up, admin)).status).toBe(200);
  expect((await media('img/../schema.sql', admin)).status).toBe(404);
  expect((await media('etc/passwd', admin)).status).toBe(404);
});

test('customer upload limit per day', async () => {
  const a = await customer(1);
  let last = 0;
  for (let i = 0; i < 61; i++) last = (await call(env, 'POST', '/api/c/images?w=1&h=1', jpeg(1), a.c, { 'content-type': 'image/jpeg' })).status;
  expect(last).toBe(429);
});
