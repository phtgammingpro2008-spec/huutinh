import { expect, test } from 'bun:test';
import { router } from '../../src/worker/index';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';

async function customerCookie(env: Awaited<ReturnType<typeof createTestEnv>>) {
  const r = await call(env, 'POST', '/api/register', { name: 'Khách', phone: '0901234567', email: 'k@k.vn', password: 'mat-khau-123', country: 'VN', lang: 'vi' });
  return cookieFrom(r);
}

test('every admin route answers a customer with 404 and a guest with 401', async () => {
  const env = await createTestEnv();
  const cust = await customerCookie(env);
  const admin = await loginCookie(env);
  const routes = router.list().filter((r) => r.adminOnly);
  expect(routes.length).toBeGreaterThanOrEqual(26);
  for (const r of routes) {
    const path = r.pattern.replace(/:[a-z]+/gi, 'x').replace('*', 'img/2026/01/x.jpg');
    const body = r.method === 'GET' || r.method === 'DELETE' ? undefined : {};
    const asCustomer = await call(env, r.method, path, body, cust);
    expect([r.method, r.pattern, asCustomer.status]).toEqual([r.method, r.pattern, 404]);
    const asGuest = await call(env, r.method, path, body);
    expect([r.method, r.pattern, asGuest.status]).toEqual([r.method, r.pattern, 401]);
  }
  expect((await call(env, 'GET', '/api/customers', undefined, admin)).status).toBe(200);
  expect((await call(env, 'GET', '/api/dashboard', undefined, admin)).status).toBe(200);
});
