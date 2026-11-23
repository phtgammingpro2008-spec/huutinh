import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { closeBrowser, pageApi, phone, seedSampleOrder, setupAdmin, startApp, type App } from './helpers';

let app: App;
let page: Page;
let done: () => Promise<void>;
beforeAll(async () => {
  app = await startApp();
  const p = await phone();
  page = p.page;
  done = () => p.ctx.close();
  await setupAdmin(page, app);
});
afterAll(async () => { await done(); await closeBrowser(); await app.stop(); });

test('dashboard lists the order under Chờ báo giá before quoting', async () => {
  const o = await seedSampleOrder(page, { customer: 'chị Nga' });
  await page.goto(app.url + '/quan-ly#/');
  await page.reload();
  const waiting = page.getByRole('region', { name: 'Chờ báo giá' });
  await waiting.getByText(o.code).waitFor();
  expect(await waiting.getByText('chị Nga').count()).toBeGreaterThan(0);
  await waiting.getByText(o.code).click();
  await page.getByRole('heading', { name: o.code }).waitFor();
});

test('orders list searches by customer name and filters by status', async () => {
  const a = await seedSampleOrder(page, { customer: 'Sokha' });
  await page.goto(app.url + '/quan-ly#/orders');
  await page.getByLabel('Tìm mã đơn hoặc tên khách').fill('sokha');
  await page.locator('.order-row', { hasText: a.code }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.order-row').length === 1);
  await page.getByLabel('Tìm mã đơn hoặc tên khách').fill('');
  await page.getByRole('button', { name: 'Đã hủy' }).click();
  await page.getByText('Không có đơn nào').waitFor();
});

test('customers page edits a customer and shows their orders', async () => {
  const o = await seedSampleOrder(page, { customer: 'chị Lan' });
  await page.goto(app.url + '/quan-ly#/customers');
  await page.getByRole('link', { name: /chị Lan/ }).click();
  await page.getByLabel('Số Zalo').fill('0912 345 678');
  await page.getByLabel('Ngôn ngữ báo giá').selectOption('km');
  await page.getByRole('button', { name: 'Lưu khách' }).click();
  await page.getByText('Đã lưu').waitFor();
  await page.getByText(o.code).waitFor();
  const c = await pageApi(page, 'GET', `/api/customers/${o.customerId}`);
  expect(c).toMatchObject({ zalo: '0912 345 678', lang: 'km' });
});

test('settings: hide a material removes it from the picker', async () => {
  await page.goto(app.url + '/quan-ly#/settings');
  await page.getByLabel('Nhóm vật liệu').selectOption('sole');
  await page.getByLabel('Tên vật liệu mới').fill('Đế Ẩn Thử');
  await page.getByRole('button', { name: 'Thêm vật liệu' }).click();
  const row = page.locator('.material-row', { hasText: 'Đế Ẩn Thử' });
  await row.waitFor();
  await page.getByLabel('Tên vật liệu mới').fill('Đế Hiện');
  await page.getByRole('button', { name: 'Thêm vật liệu' }).click();
  await page.locator('.material-row', { hasText: 'Đế Hiện' }).waitFor();
  await row.getByRole('button', { name: 'Ẩn' }).click();
  await row.getByRole('button', { name: 'Hiện lại' }).waitFor();

  await page.goto(app.url + '/quan-ly#/orders/new');
  await page.getByLabel('Chọn ảnh').setInputFiles(join(import.meta.dir, '../fixtures/grid-3000x2000.jpg'));
  await page.getByRole('button', { name: 'Cả ảnh là 1 mẫu' }).click();
  const sole = page.getByRole('region', { name: 'Mẫu 1', exact: true }).getByLabel('Đế');
  const options = await sole.locator('option').allTextContents();
  expect(options).toContain('Đế Hiện');
  expect(options).not.toContain('Đế Ẩn Thử');
});

test('settings: size lines and quote message are saved', async () => {
  await page.goto(app.url + '/quan-ly#/settings');
  await page.getByLabel('Size đến – Nam').fill('45');
  await page.getByLabel('Tin nhắn báo giá – Tiếng Việt').fill('Đơn {code} tổng {total}: {url}');
  await page.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await page.getByText('Đã lưu cài đặt').waitFor();
  const s = await pageApi(page, 'GET', '/api/settings');
  expect(s.lines[0]).toMatchObject({ key: 'nam', sizeTo: 45 });
  expect(s.quoteMessage.vi).toBe('Đơn {code} tổng {total}: {url}');
  expect(await page.getByRole('link', { name: 'Tải bản sao lưu' }).getAttribute('href')).toBe('/api/export');
});
