import { beforeEach, expect, test } from 'bun:test';
import { normalizeEmail, normalizePhone } from '../../src/shared/phone';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';
import type { Env } from '../../src/worker/env';

let env: Env;
beforeEach(async () => { env = await createTestEnv(); });

const reg = (body: Record<string, unknown>) =>
  call(env, 'POST', '/api/register', { name: 'Sokha', phone: '012 345 678', email: 'sokha@mail.com', password: 'mat-khau-123', country: 'KH', lang: 'km', ...body });

test('normalizePhone variants are equal', () => {
  for (const v of ['0901 234 567', '+84 901234567', '84-901-234-567', '(+84) 901.234.567']) expect(normalizePhone(v, 'VN')).toBe('+84901234567');
  expect(normalizePhone('+855 12 345 678', 'VN')).toBe('+85512345678');
  expect(normalizePhone('012 345 678', 'KH')).toBe('+85512345678');
  expect(normalizePhone('096 123 4567', 'KH')).toBe('+855961234567');
  expect(normalizePhone('abc', 'VN')).toBeNull();
  expect(normalizePhone('0123', 'VN')).toBeNull();
  expect(normalizeEmail(' An@Mail.COM ')).toBe('an@mail.com');
  expect(normalizeEmail('khong-phai-email')).toBeNull();
});

test('register creates customer+user and logs in', async () => {
  const r = await reg({});
  expect(r.status).toBe(200);
  const c = cookieFrom(r);
  const me = (await call(env, 'GET', '/api/me', undefined, c)).body;
  expect(me).toMatchObject({ role: 'customer', name: 'Sokha', lang: 'km', emailVerified: false });
  const cust = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(me.customerId).first<any>();
  expect(cust).toMatchObject({ name: 'Sokha', country: 'KH', lang: 'km', currency: 'USD', zalo: '+85512345678' });
});

test('currency VND for VN customers', async () => {
  const r = await reg({ phone: '0901234567', email: 'a@b.vn', country: 'VN', lang: 'vi' });
  const me = (await call(env, 'GET', '/api/me', undefined, cookieFrom(r))).body;
  const cust = await env.DB.prepare('SELECT currency FROM customers WHERE id = ?').bind(me.customerId).first<any>();
  expect(cust.currency).toBe('VND');
});

test('second register with same phone written differently → 409 phone_taken', async () => {
  await reg({});
  const r = await reg({ phone: '+855-12-345-678', email: 'other@mail.com', lang: 'vi' });
  expect(r.status).toBe(409);
  expect(r.body).toMatchObject({ code: 'phone_taken', field: 'phone' });
  expect(r.body.error).toContain('đã có tài khoản');
});

test('same email different case → 409 email_taken', async () => {
  await reg({});
  const r = await reg({ phone: '0901234567', country: 'VN', email: 'SOKHA@Mail.com', lang: 'en' });
  expect(r.status).toBe(409);
  expect(r.body).toMatchObject({ code: 'email_taken', field: 'email' });
});

test('register validation', async () => {
  expect((await reg({ password: 'ngan' })).body).toMatchObject({ code: 'weak_password', field: 'password' });
  expect((await reg({ phone: '12' })).body).toMatchObject({ code: 'bad_phone', field: 'phone' });
  expect((await reg({ email: 'x' })).body).toMatchObject({ code: 'bad_email', field: 'email' });
  expect((await reg({ name: ' ' })).body).toMatchObject({ code: 'bad_name', field: 'name' });
  expect((await reg({ country: 'TH' })).status).toBe(400);
});

test('login by phone, by email, admin by name', async () => {
  await reg({});
  for (const id of ['012345678', '+855 12 345 678', 'SOKHA@mail.com']) {
    const r = await call(env, 'POST', '/api/login', { id, password: 'mat-khau-123' });
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('customer');
  }
  const admin = await loginCookie(env); // admin "anh" via name
  expect((await call(env, 'GET', '/api/me', undefined, admin)).body.role).toBe('admin');
  // phase-1 body {name} still accepted
  expect((await call(env, 'POST', '/api/login', { name: 'anh', password: 'mat-khau-123' })).status).toBe(200);
});

test('wrong password 11 times → 429', async () => {
  await reg({});
  for (let i = 0; i < 10; i++) expect((await call(env, 'POST', '/api/login', { id: '012345678', password: 'sai' })).status).toBe(401);
  const r = await call(env, 'POST', '/api/login', { id: '012345678', password: 'mat-khau-123' });
  expect(r.status).toBe(429);
});

test('locked user login → 403 account_locked and open sessions stop working', async () => {
  const c = cookieFrom(await reg({}));
  await env.DB.prepare("UPDATE users SET locked = 1 WHERE role = 'customer'").run();
  expect((await call(env, 'GET', '/api/me', undefined, c)).status).toBe(401);
  const r = await call(env, 'POST', '/api/login', { id: '012345678', password: 'mat-khau-123' });
  expect(r.status).toBe(403);
  expect(r.body.code).toBe('account_locked');
});

test('register rate limit per IP', async () => {
  const h = { 'cf-connecting-ip': '1.2.3.4' };
  for (let i = 0; i < 5; i++) {
    await call(env, 'POST', '/api/register', { name: 'A', phone: `09012345${10 + i}`, email: `a${i}@b.vn`, password: 'mat-khau-123', country: 'VN', lang: 'vi' }, undefined, h);
  }
  const r = await call(env, 'POST', '/api/register', { name: 'A', phone: '0901234599', email: 'z@b.vn', password: 'mat-khau-123', country: 'VN', lang: 'vi' }, undefined, h);
  expect(r.status).toBe(429);
});
