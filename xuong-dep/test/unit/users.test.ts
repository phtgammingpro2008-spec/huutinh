import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';
import type { Env } from '../../src/worker/env';

let env: Env;
let admin: string;
let clock = new Date('2026-11-23T03:00:00Z');
beforeEach(async () => {
  clock = new Date('2026-11-23T03:00:00Z');
  env = await createTestEnv({ now: () => clock });
  admin = await loginCookie(env);
});
const outbox = () => env.EMAIL_OUTBOX!;
const linkIn = (html: string) => html.match(/href="([^"]+)"/)![1].replace(/&amp;/g, '&');
const register = async (n = 1, lang = 'vi') => cookieFrom(await call(env, 'POST', '/api/register',
  { name: `K${n}`, phone: `09012345${10 + n}`, email: `k${n}@mail.vn`, password: 'mat-khau-123', country: 'VN', lang }));

test('register queues a verify email with a working link', async () => {
  const c = await register(1, 'en');
  expect(outbox()).toHaveLength(1);
  expect(outbox()[0]).toMatchObject({ to: 'k1@mail.vn' });
  expect(outbox()[0].subject).toContain('HLUXURY');
  const link = linkIn(outbox()[0].html);
  expect(link).toStartWith('https://xuong.test/api/email/verify?token=');
  const r = await call(env, 'GET', link.replace('https://xuong.test', ''));
  expect(r.status).toBe(302);
  expect(r.headers.get('location')).toBe('/tai-khoan#/ho-so?verified=1');
  expect((await call(env, 'GET', '/api/me', undefined, c)).body.emailVerified).toBe(true);
  expect((await call(env, 'GET', link.replace('https://xuong.test', ''))).headers.get('location')).toBe('/tai-khoan#/ho-so?verified=0');
});

test('forgot for unverified or unknown email returns 200 and sends nothing', async () => {
  await register(1);
  outbox().length = 0;
  for (const email of ['k1@mail.vn', 'nobody@mail.vn']) {
    const r = await call(env, 'POST', '/api/password/forgot', { email, lang: 'vi' });
    expect(r.status).toBe(200);
  }
  expect(outbox()).toHaveLength(0);
});

async function verified(n = 1) {
  const c = await register(n);
  await call(env, 'GET', linkIn(outbox().at(-1)!.html).replace('https://xuong.test', ''));
  outbox().length = 0;
  return c;
}

test('forgot+reset changes password and logs out other sessions', async () => {
  const c = await verified();
  await call(env, 'POST', '/api/password/forgot', { email: 'K1@Mail.vn', lang: 'vi' });
  expect(outbox()).toHaveLength(1);
  const link = linkIn(outbox()[0].html);
  expect(link).toStartWith('https://xuong.test/dat-lai-mat-khau?token=');
  const token = new URL(link).searchParams.get('token');
  expect((await call(env, 'POST', '/api/password/reset', { token, password: 'mat-khau-moi-456' })).status).toBe(200);
  expect((await call(env, 'GET', '/api/me', undefined, c)).status).toBe(401);
  expect((await call(env, 'POST', '/api/login', { id: 'k1@mail.vn', password: 'mat-khau-moi-456' })).status).toBe(200);
  const again = await call(env, 'POST', '/api/password/reset', { token, password: 'x-y-z-12345' });
  expect(again.status).toBe(400);
  expect(again.body.code).toBe('bad_token');
});

test('reset token expires after 1h', async () => {
  await verified();
  await call(env, 'POST', '/api/password/forgot', { email: 'k1@mail.vn' });
  const token = new URL(linkIn(outbox()[0].html)).searchParams.get('token');
  clock = new Date(clock.getTime() + 61 * 60_000);
  expect((await call(env, 'POST', '/api/password/reset', { token, password: 'mat-khau-moi-456' })).status).toBe(400);
});

test('admin lists, locks (revoking sessions) and unlocks users; customers cannot call /api/users', async () => {
  const c = await register(1);
  const list = (await call(env, 'GET', '/api/users?q=K1', undefined, admin)).body;
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ name: 'K1', phone: '+84901234511', email: 'k1@mail.vn', emailVerified: false, locked: false, orderCount: 0 });
  expect((await call(env, 'GET', '/api/users', undefined, c)).status).toBe(404);
  expect((await call(env, 'POST', `/api/users/${list[0].id}/lock`, {}, admin)).status).toBe(200);
  expect((await call(env, 'GET', '/api/me', undefined, c)).status).toBe(401);
  expect((await call(env, 'POST', '/api/login', { id: 'k1@mail.vn', password: 'mat-khau-123' })).status).toBe(403);
  await call(env, 'POST', `/api/users/${list[0].id}/unlock`, {}, admin);
  expect((await call(env, 'POST', '/api/login', { id: 'k1@mail.vn', password: 'mat-khau-123' })).status).toBe(200);
});

test('admin reset-link works for 24h', async () => {
  await register(1);
  const id = (await call(env, 'GET', '/api/users', undefined, admin)).body[0].id;
  const { url } = (await call(env, 'POST', `/api/users/${id}/reset-link`, {}, admin)).body;
  expect(url).toStartWith('https://xuong.test/dat-lai-mat-khau?token=');
  clock = new Date(clock.getTime() + 23 * 3600_000);
  expect((await call(env, 'POST', '/api/password/reset', { token: new URL(url).searchParams.get('token'), password: 'mat-khau-moi-456' })).status).toBe(200);
});

test('change password from profile needs the current password', async () => {
  const c = await register(1);
  expect((await call(env, 'POST', '/api/password/change', { current: 'sai', password: 'mat-khau-moi-456' }, c)).status).toBe(400);
  expect((await call(env, 'POST', '/api/password/change', { current: 'mat-khau-123', password: 'mat-khau-moi-456' }, c)).status).toBe(200);
  expect((await call(env, 'POST', '/api/login', { id: 'k1@mail.vn', password: 'mat-khau-moi-456' })).status).toBe(200);
});

test('sendEmail disabled when not configured', async () => {
  const { sendEmail } = await import('../../src/worker/email');
  const bare = { ...env, EMAIL_OUTBOX: undefined };
  expect(await sendEmail(bare, 'a@b.vn', 's', '<p>x</p>')).toBe('disabled');
});
