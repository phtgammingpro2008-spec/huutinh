import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, loginCookie } from '../helpers/http';
import type { Env } from '../../src/worker/env';

let env: Env;
let c: string;
beforeEach(async () => { env = await createTestEnv(); c = await loginCookie(env); });

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

test('upload rejects text/plain with 415', async () => {
  const r = await call(env, 'POST', '/api/images?w=10&h=10', jpegBytes, c, { 'content-type': 'text/plain' });
  expect(r.status).toBe(415);
  expect(typeof r.body.error).toBe('string');
});

test('upload > 8 MB → 413', async () => {
  const big = new Uint8Array(8 * 1024 * 1024 + 1);
  const r = await call(env, 'POST', '/api/images?w=10&h=10', big, c, { 'content-type': 'image/jpeg' });
  expect(r.status).toBe(413);
});

test('upload requires auth', async () => {
  const r = await call(env, 'POST', '/api/images?w=10&h=10', jpegBytes, undefined, { 'content-type': 'image/jpeg' });
  expect(r.status).toBe(401);
});

test('uploaded image served back with same bytes and requires auth', async () => {
  const up = await call(env, 'POST', '/api/images?w=10&h=10', jpegBytes, c, { 'content-type': 'image/jpeg' });
  expect(up.status).toBe(200);
  expect(up.body.key).toMatch(/^img\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/);
  expect(typeof up.body.id).toBe('string');
  const got = await call(env, 'GET', '/' + up.body.key, undefined, c);
  expect(got.status).toBe(200);
  expect(new Uint8Array(await got.raw.arrayBuffer())).toEqual(jpegBytes);
  expect(got.headers.get('content-type')).toBe('image/jpeg');
  expect(got.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
  expect((await call(env, 'GET', '/' + up.body.key)).status).toBe(401);
  expect((await call(env, 'GET', '/img/2026/01/khong-co.jpg', undefined, c)).status).toBe(404);
});

test('client may choose the image id (uuid) so drafts can reference it before upload ends', async () => {
  const id = crypto.randomUUID();
  const up = await call(env, 'POST', `/api/images?w=10&h=10&id=${id}`, jpegBytes, c, { 'content-type': 'image/jpeg' });
  expect(up.body.id).toBe(id);
  expect(up.body.key).toContain(id);
  const bad = await call(env, 'POST', '/api/images?w=10&h=10&id=../../x', jpegBytes, c, { 'content-type': 'image/jpeg' });
  expect(bad.status).toBe(400);
});

test('png and webp get matching extensions', async () => {
  const png = await call(env, 'POST', '/api/images?w=1&h=1', jpegBytes, c, { 'content-type': 'image/png' });
  expect(png.body.key).toMatch(/\.png$/);
  const webp = await call(env, 'POST', '/api/images?w=1&h=1', jpegBytes, c, { 'content-type': 'image/webp' });
  expect(webp.body.key).toMatch(/\.webp$/);
});
