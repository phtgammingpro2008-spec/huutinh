import { afterAll, beforeAll, expect, test } from 'bun:test';
import { ADMIN, closeBrowser, phone, startApp, type App } from './helpers';

let app: App;
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('first visit shows setup form, creating admin lands on Trang chủ', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/quan-ly');
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

test("wrong password shows an error on the shared login page, right password returns to /quan-ly", async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/quan-ly');
  await page.waitForURL(/\/dang-nhap\?next=%2Fquan-ly/);
  await page.getByLabel('Số điện thoại hoặc email').fill(ADMIN.name);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('sai-roi-nhe');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByText('Sai thông tin đăng nhập hoặc mật khẩu').waitFor();
  await page.getByLabel('Mật khẩu', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('heading', { name: 'Trang chủ' }).waitFor();
  expect(new URL(page.url()).pathname).toBe('/quan-ly');
  await ctx.close();
});

test('manifest is served and linked; pages are noindex', async () => {
  const { ctx, page } = await phone();
  const res = await page.request.get(app.url + '/quan-ly');
  expect(res.headers()['x-robots-tag']).toBe('noindex');
  const html = await res.text();
  expect(html).toContain('<meta name="robots" content="noindex">');
  const href = html.match(/<link rel="manifest" href="([^"]+)"/)![1];
  expect(href).toBe('/manifest.webmanifest');
  const m = await (await page.request.get(app.url + href)).json();
  expect(m.display).toBe('standalone');
  expect(m.icons.map((i: any) => i.sizes)).toEqual(['192x192', '512x512']);
  const icon = await page.request.get(app.url + m.icons[0].src);
  expect(icon.headers()['content-type']).toBe('image/png');
  expect((await page.request.get(app.url + '/sw.js')).status()).toBe(200);
  await ctx.close();
});
