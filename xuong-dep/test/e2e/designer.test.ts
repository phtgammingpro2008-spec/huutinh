import { afterAll, beforeAll, expect, test } from 'bun:test';
import { closeBrowser, phone, startApp, type App } from './helpers';

let app: App;
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('a customer designs a pair, adds it to the order with its colours written down, and sends it', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/api/setup-status');
  await page.evaluate(async () => fetch('/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Chị Ngọc', phone: '0908765499', email: 'ngoc@example.com', password: 'mat-khau-123', country: 'VN', lang: 'vi' }),
  }));
  await page.goto(app.url + '/tai-khoan#/dat-hang');
  await page.getByRole('link', { name: 'Tự phối mẫu' }).click();
  await page.getByRole('heading', { name: 'Tự phối mẫu' }).waitFor();
  await page.getByRole('radiogroup', { name: /^Quai/ }).getByRole('radio', { name: 'Xanh dương' }).click();
  await page.getByRole('radio', { name: 'Chấm bi' }).click();
  await page.getByLabel('Chữ in trên đế').fill('SHOP AN');
  const preview = page.getByRole('img', { name: /Quai: Xanh dương/ });
  expect(await preview.innerHTML()).toContain('SHOP AN');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
  await page.getByRole('button', { name: 'Thêm vào đơn' }).click();
  await page.waitForFunction(() => location.hash.startsWith('#/dat-hang'));
  const item = page.getByRole('region', { name: 'Mẫu 1', exact: true });
  expect(await item.getByLabel('Màu / ghi chú').inputValue()).toBe('Mẫu tự phối · Mặt đế: Kem · Viền đế: Đen · Quai: Xanh dương · Họa tiết: Chấm bi (Đen) · Chữ in trên đế: "SHOP AN"');
  await item.getByLabel('Số đôi mỗi size – Nam').fill('5');
  await page.getByRole('button', { name: 'Gửi đơn' }).click();
  await page.waitForFunction(() => location.hash.startsWith('#/don/'));
  const list = await page.evaluate(async () => (await fetch('/api/c/orders')).json());
  expect(list).toHaveLength(1);
  const o = await page.evaluate(async (id) => (await fetch('/api/c/orders/' + id)).json(), list[0].id);
  expect(o.items[0].cropKey).toMatch(/^img\//);
  expect(o.items[0].colorNote).toContain('SHOP AN');
  await ctx.close();
});
