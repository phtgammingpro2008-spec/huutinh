import { afterAll, beforeAll, expect, test } from 'bun:test';
import { ADMIN, closeBrowser, getBrowser, phone, seedSampleOrder, startApp, type App } from './helpers';

let app: App;
beforeAll(async () => { app = await startApp({ dist: true }); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('dist smoke: server running dist/worker.js completes setup → create order → send quote → accept on quote page', async () => {
  expect(app.url).toBeTruthy();
  const { ctx, page } = await phone();
  await page.goto(app.url + '/');
  await page.getByLabel('Tên đăng nhập').fill(ADMIN.name);
  await page.getByLabel('Mật khẩu').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByRole('heading', { name: 'Trang chủ' }).waitFor();

  const o = await seedSampleOrder(page, { customer: 'chị Nga', price: 47000 });
  await page.goto(app.url + `/#/orders/${o.id}`);
  await page.getByRole('button', { name: 'Gửi báo giá' }).click();
  const message = await page.getByLabel('Tin nhắn gửi khách').inputValue();
  const url = message.match(/https?:\/\/\S+\/q\/[A-Za-z0-9_-]+/)![0];

  const customer = await (await getBrowser()).newContext({ viewport: { width: 390, height: 844 } });
  const q = await customer.newPage();
  await q.goto(url);
  await q.getByText('66.270.000 ₫').first().waitFor();
  await q.getByRole('button', { name: 'Đồng ý báo giá' }).click();
  await q.getByText('Bạn đã đồng ý báo giá này').waitFor();
  await customer.close();

  await page.getByRole('button', { name: 'Xong' }).click();
  await page.locator('.order-detail .badge', { hasText: 'Khách đã đồng ý' }).waitFor();
  await ctx.close();
});
