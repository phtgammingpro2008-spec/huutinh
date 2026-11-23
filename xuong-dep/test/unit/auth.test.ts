import { expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom } from '../helpers/http';
import { hashPassword, verifyPassword } from '../../src/worker/auth';
import { newToken } from '../../src/worker/http';

test('hashPassword round-trips and uses pbkdf2 format', async () => {
  const h = await hashPassword('bí mật');
  expect(h).toMatch(/^pbkdf2\$100000\$[^$]+\$[^$]+$/);
  expect(await verifyPassword('bí mật', h)).toBe(true);
  expect(await verifyPassword('sai', h)).toBe(false);
});

test('newToken is URL-safe and long', () => {
  const t = newToken();
  expect(t.length).toBeGreaterThanOrEqual(40);
  expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
});

test('setup creates first admin then refuses a second', async () => {
  const env = await createTestEnv();
  expect((await call(env, 'POST', '/api/setup', { name: 'anh', password: 'mat-khau-123' })).status).toBe(200);
  const r = await call(env, 'POST', '/api/setup', { name: 'khac', password: 'mat-khau-456' });
  expect(r.status).toBe(409);
  expect(typeof r.body.error).toBe('string');
});

test('setup rejects short password', async () => {
  const env = await createTestEnv();
  expect((await call(env, 'POST', '/api/setup', { name: 'anh', password: '123' })).status).toBe(400);
});

test('login with wrong password → 401 Sai mật khẩu', async () => {
  const env = await createTestEnv();
  await call(env, 'POST', '/api/setup', { name: 'anh', password: 'mat-khau-123' });
  const r = await call(env, 'POST', '/api/login', { name: 'anh', password: 'nope' });
  expect(r.status).toBe(401);
  expect(r.body.error).toBe('Sai mật khẩu');
});

test('login sets sid cookie with HttpOnly and 90-day Max-Age', async () => {
  const env = await createTestEnv();
  await call(env, 'POST', '/api/setup', { name: 'anh', password: 'mat-khau-123' });
  const r = await call(env, 'POST', '/api/login', { name: 'anh', password: 'mat-khau-123' });
  const sc = r.headers.get('set-cookie')!;
  expect(sc).toMatch(/^sid=[A-Za-z0-9_-]{40,};/);
  expect(sc).toContain('HttpOnly');
  expect(sc).toContain('Secure');
  expect(sc).toContain('SameSite=Lax');
  expect(sc).toContain(`Max-Age=${90 * 24 * 3600}`);
});

test('GET /api/me without cookie → 401, with cookie → user name', async () => {
  const env = await createTestEnv();
  const r0 = await call(env, 'GET', '/api/me');
  expect(r0.status).toBe(401);
  expect(r0.body).toEqual({ error: 'Chưa đăng nhập' });
  await call(env, 'POST', '/api/setup', { name: 'anh', password: 'mat-khau-123' });
  const c = cookieFrom(await call(env, 'POST', '/api/login', { name: 'anh', password: 'mat-khau-123' }));
  const r = await call(env, 'GET', '/api/me', undefined, c);
  expect(r.status).toBe(200);
  expect(r.body.name).toBe('anh');
});

test('GET /api/setup-status tells whether an admin exists', async () => {
  const env = await createTestEnv();
  expect((await call(env, 'GET', '/api/setup-status')).body).toEqual({ needsSetup: true });
  await call(env, 'POST', '/api/setup', { name: 'anh', password: 'mat-khau-123' });
  expect((await call(env, 'GET', '/api/setup-status')).body).toEqual({ needsSetup: false });
});

test('logout invalidates session', async () => {
  const env = await createTestEnv();
  await call(env, 'POST', '/api/setup', { name: 'anh', password: 'mat-khau-123' });
  const c = cookieFrom(await call(env, 'POST', '/api/login', { name: 'anh', password: 'mat-khau-123' }));
  expect((await call(env, 'POST', '/api/logout', undefined, c)).status).toBe(200);
  expect((await call(env, 'GET', '/api/me', undefined, c)).status).toBe(401);
});

test('expired session → 401', async () => {
  let now = new Date('2026-11-22T00:00:00Z');
  const env = await createTestEnv({ now: () => now });
  await call(env, 'POST', '/api/setup', { name: 'anh', password: 'mat-khau-123' });
  const c = cookieFrom(await call(env, 'POST', '/api/login', { name: 'anh', password: 'mat-khau-123' }));
  now = new Date('2027-03-01T00:00:00Z');
  expect((await call(env, 'GET', '/api/me', undefined, c)).status).toBe(401);
});

test('unknown route → 404 json', async () => {
  const env = await createTestEnv();
  const r = await call(env, 'GET', '/api/khong-co');
  expect(r.status).toBe(404);
  expect(typeof r.body.error).toBe('string');
});

test('every response has X-Robots-Tag noindex', async () => {
  const env = await createTestEnv();
  for (const [m, p] of [['GET', '/api/me'], ['GET', '/api/khong-co'], ['POST', '/api/login']] as const) {
    const r = await call(env, m, p, m === 'POST' ? {} : undefined);
    expect(r.headers.get('x-robots-tag')).toBe('noindex');
  }
});

test('router passes :params', async () => {
  const { Router } = await import('../../src/worker/router');
  const r = new Router();
  r.on('GET', '/a/:id/b/:x', async (_req, _env, p) => new Response(p.id + '-' + p.x));
  const env = await createTestEnv();
  const res = await r.handle(new Request('https://x/a/12/b/ok'), env, {});
  expect(await res!.text()).toBe('12-ok');
  expect(await r.handle(new Request('https://x/a/12'), env, {})).toBeNull();
});
