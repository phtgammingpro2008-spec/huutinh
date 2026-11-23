import { afterAll, beforeAll, expect, test } from 'bun:test';
import { ADMIN, closeBrowser, phone, startApp, type App } from './helpers';

let app: App;
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('first visit shows setup form, creating admin lands on Trang chủ', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/');
  await page.getByText('Tạo tài khoản quản trị').first().waitFor();
  await page.getByLabel('Tên đăng nhập').fill(ADMIN.name);
  await page.getByLabel('Mật khẩu').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByRole('heading', { name: 'Trang chủ' }).waitFor();
  // bottom tab bar
  for (const t of ['Trang chủ', 'Đơn hàng', 'Đơn mới', 'Thư viện', 'Cài đặt']) {
    expect(await page.getByRole('navigation').getByText(t, { exact: true }).count()).toBe(1);
  }

  // reload keeps session
  await page.reload();
  await page.getByRole('heading', { name: 'Trang chủ' }).waitFor();
  expect(page.url()).not.toContain('login');
  await ctx.close();
});

test("wrong password shows 'Sai mật khẩu', right password logs in", async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/');
  await page.getByRole('button', { name: 'Đăng nhập' }).waitFor();
  await page.getByLabel('Tên đăng nhập').fill(ADMIN.name);
  await page.getByLabel('Mật khẩu').fill('sai-roi-nhe');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByText('Sai mật khẩu').waitFor();
  await page.getByLabel('Mật khẩu').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('heading', { name: 'Trang chủ' }).waitFor();
  await ctx.close();
});

test('manifest is served and linked; pages are noindex', async () => {
  const { ctx, page } = await phone();
  const res = await page.goto(app.url + '/');
  expect(res!.headers()['x-robots-tag']).toBe('noindex');
  expect(await page.locator('meta[name="robots"]').getAttribute('content')).toBe('noindex');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  const m = await (await page.request.get(app.url + href)).json();
  expect(m.display).toBe('standalone');
  expect(m.icons.map((i: any) => i.sizes)).toEqual(['192x192', '512x512']);
  const icon = await page.request.get(app.url + m.icons[0].src);
  expect(icon.headers()['content-type']).toBe('image/png');
  expect((await page.request.get(app.url + '/sw.js')).status()).toBe(200);
  await ctx.close();
});
