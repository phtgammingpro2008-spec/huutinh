import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeBrowser, pageApi, phone, seedSampleOrder, setupAdmin, startApp, type App } from './helpers';

let app: App;
let page: Page;
let done: () => Promise<void>;
let order: any;
beforeAll(async () => {
  app = await startApp();
  const p = await phone();
  page = p.page;
  done = () => p.ctx.close();
  await setupAdmin(page, app);
  order = await seedSampleOrder(page, { customer: 'chị Nga' });
});
afterAll(async () => { await done(); await closeBrowser(); await app.stop(); });

async function openLibrary() {
  await page.goto(app.url + '/quan-ly#/library');
  await page.reload();
  await page.getByRole('heading', { name: 'Thư viện mẫu' }).waitFor();
}

test('designs from the sample order appear (9 cards)', async () => {
  await openLibrary();
  await page.waitForFunction(() => document.querySelectorAll('.design-card').length === 9);
  expect(await page.locator('.design-card .badge', { hasText: 'Mẫu đặt riêng' }).count()).toBe(9);
});

test('filter by label Mẫu cố định after relabelling one shows 1', async () => {
  const designId = order.items[2].designId;
  await openLibrary();
  await page.locator(`.design-card[data-design-id="${designId}"]`).click();
  await page.getByLabel('Nhãn').selectOption('co_dinh');
  await page.getByLabel('Ghi chú mẫu').fill('mẫu kẹp đỏ bán chạy');
  // phase 2a flags: shown to logged-in customers unless marked private or hidden
  expect(await page.getByLabel('Mẫu đặt riêng (không hiện cho khách khác)').isChecked()).toBe(false);
  expect(await page.getByLabel('Ẩn khỏi thư viện').isChecked()).toBe(false);
  expect(await page.getByLabel('Có logo thương hiệu').isChecked()).toBe(false);
  await page.getByRole('button', { name: 'Lưu mẫu' }).click();
  await page.getByText('Đã lưu mẫu').waitFor();
  await page.getByText(order.code).waitFor(); // orders that used it
  await openLibrary();
  await page.getByRole('button', { name: 'Mẫu cố định' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.design-card').length === 1);
  expect(await page.locator('.design-card').getAttribute('data-design-id')).toBe(designId);
  await page.getByRole('button', { name: 'Tất cả' }).click();
  await page.getByLabel('Tìm theo ghi chú').fill('bán chạy');
  await page.waitForFunction(() => document.querySelectorAll('.design-card').length === 1);
});

test("'Tạo đơn từ mẫu này' opens editor with that item and no photo upload", async () => {
  const designId = order.items[4].designId;
  await page.goto(app.url + `/quan-ly#/library/${designId}`);
  await page.reload();
  let uploads = 0;
  const count = (r: any) => { if (r.url().includes('/api/images')) uploads++; };
  page.on('request', count);
  await page.getByRole('button', { name: 'Tạo đơn từ mẫu này' }).click();
  await page.getByRole('heading', { name: 'Đơn mới' }).waitFor();
  const item = page.getByRole('region', { name: 'Mẫu 1', exact: true });
  await item.waitFor();
  expect(await page.locator('.tagger').count()).toBe(0);
  await page.getByRole('button', { name: '+ Khách mới' }).click();
  await page.getByLabel('Tên khách mới').fill('anh Phúc');
  await page.getByRole('button', { name: 'Thêm khách' }).click();
  await item.getByLabel('Số đôi mỗi size – Nam').fill('20');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForURL(/#\/orders\/[0-9a-f-]{36}$/);
  page.off('request', count);
  expect(uploads).toBe(0);
  const o = await pageApi(page, 'GET', `/api/orders/${page.url().split('/').pop()}`);
  expect(o.items.map((i: any) => i.designId)).toEqual([designId]);
  expect(o.totals.qty).toBe(120);
});
