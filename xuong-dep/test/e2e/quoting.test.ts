import { afterAll, beforeAll, expect, test } from 'bun:test';
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

const openOrder = async (id: string) => {
  await page.goto(app.url + `/#/orders/${id}`);
  await page.locator('.order-detail').waitFor();
};

test('price the sample order at 47k → total 66.270.000 ₫', async () => {
  const o = await seedSampleOrder(page);
  await openOrder(o.id);
  await page.getByRole('heading', { name: o.code }).waitFor();
  await page.getByLabel('Đơn giá – Mẫu 1 Nam').fill('47k');
  await page.getByLabel('Giá cho mọi dòng').fill('47k');
  await page.getByRole('button', { name: 'Áp dụng cho mọi dòng' }).click();
  await page.getByRole('button', { name: 'Lưu giá' }).click();
  await page.getByText('Tổng tiền: 66.270.000 ₫').waitFor();
  const v = await pageApi(page, 'GET', `/api/orders/${o.id}`);
  expect(v.totals.amount).toBe(66_270_000);
  expect(await page.getByLabel('Đơn giá – Mẫu 1 Nam').inputValue()).toBe('47.000 ₫');
});

test('price history chip shows 47.000 ₫ on a second order with same materials and fills on tap', async () => {
  const sole = await pageApi(page, 'POST', '/api/materials', { kind: 'sole', nameVi: 'VIP 1' });
  const a = await seedSampleOrder(page, { customer: 'chị Hoa', soleId: sole.id, price: 47000 });
  await pageApi(page, 'POST', `/api/orders/${a.id}/send-quote`, {});
  const b = await seedSampleOrder(page, { customer: 'anh Bảo', soleId: sole.id });
  await openOrder(b.id);
  const item1 = page.getByRole('region', { name: 'Mẫu 1', exact: true });
  const chip = item1.getByRole('button', { name: /47\.000 ₫/ }).first();
  await chip.waitFor();
  expect(await chip.textContent()).toContain('chị Hoa');
  await chip.click();
  expect(await page.getByLabel('Đơn giá – Mẫu 1 Nam').inputValue()).toBe('47.000 ₫');
});

test('send quote shows message containing the order code and a /q/ link', async () => {
  const o = await seedSampleOrder(page, { customer: 'chị Mai', zalo: '0901 234 567', price: 47000 });
  await openOrder(o.id);
  await page.getByRole('button', { name: 'Gửi báo giá' }).click();
  const msg = page.getByLabel('Tin nhắn gửi khách');
  await msg.waitFor();
  const text = await msg.inputValue();
  expect(text).toContain(o.code);
  expect(text).toMatch(/\/q\/[A-Za-z0-9_-]{32,}/);
  expect(await page.getByRole('link', { name: 'Mở Zalo' }).getAttribute('href')).toBe('https://zalo.me/0901234567');
  await page.getByRole('button', { name: 'Sao chép tin nhắn' }).waitFor();
  await page.getByRole('button', { name: 'Xong' }).click();
  await page.locator('.order-detail .badge', { hasText: 'Đã báo giá' }).waitFor();
});

test('editing qty after customer accepted shows status Đã báo giá again', async () => {
  const o = await seedSampleOrder(page, { customer: 'chị Thu', price: 47000 });
  const sent = await pageApi(page, 'POST', `/api/orders/${o.id}/send-quote`, {});
  const token = sent.url.split('/q/')[1];
  await pageApi(page, 'POST', `/api/public/quote/${token}/accept`, { version: 1 });
  await openOrder(o.id);
  await page.locator('.order-detail .badge', { hasText: 'Khách đã đồng ý' }).waitFor();
  await page.getByRole('link', { name: 'Sửa đơn' }).click();
  await page.getByRole('region', { name: 'Mẫu 1', exact: true }).getByLabel('Số đôi mỗi size – Nam').fill('90');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.locator('.order-detail .badge', { hasText: 'Đã báo giá' }).waitFor();
  expect((await pageApi(page, 'GET', `/api/orders/${o.id}`)).quoteVersion).toBe(2);
});

test('add payment 20.000.000 ₫ shows còn lại 46.270.000 ₫', async () => {
  const o = await seedSampleOrder(page, { customer: 'chị Yến', price: 47000 });
  await openOrder(o.id);
  await page.getByLabel('Số tiền nhận').fill('20tr');
  await page.getByLabel('Ghi chú khoản nhận').fill('cọc');
  await page.getByRole('button', { name: 'Thêm khoản nhận' }).click();
  await page.getByText('Còn lại: 46.270.000 ₫').waitFor();
  await page.getByText('cọc').waitFor();
});

test('status buttons move the order forward and cancel asks first', async () => {
  const o = await seedSampleOrder(page, { customer: 'chị Hằng', price: 47000 });
  await pageApi(page, 'POST', `/api/orders/${o.id}/send-quote`, {});
  await openOrder(o.id);
  await page.getByRole('button', { name: '→ Khách đã đồng ý' }).click();
  await page.locator('.order-detail .badge', { hasText: 'Khách đã đồng ý' }).waitFor();
  await page.getByRole('button', { name: '→ Đang sản xuất' }).click();
  await page.locator('.order-detail .badge', { hasText: 'Đang sản xuất' }).waitFor();
  expect(await page.getByLabel('Đơn giá – Mẫu 1 Nam').isDisabled()).toBe(true);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Hủy đơn' }).click();
  await page.locator('.order-detail .badge', { hasText: 'Đã hủy' }).waitFor();
});
