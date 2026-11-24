import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { closeBrowser, phone, setupAdmin, startApp, type App } from './helpers';

const PHOTO = join(import.meta.dir, '../fixtures/grid-3000x2000.jpg');
let app: App;
let admin: Page;

beforeAll(async () => {
  app = await startApp();
  admin = (await phone()).page;
  await setupAdmin(admin, app);
});
afterAll(async () => { await closeBrowser(); await app.stop(); });

async function fill(page: Page, product: string, colours: string[]) {
  await page.goto(app.url + '/quan-ly#/');
  await page.getByRole('link', { name: 'Đăng mẫu lên web' }).click();
  await page.getByRole('heading', { name: 'Đăng mẫu lên web' }).waitFor();
  await page.getByLabel('Chọn ảnh mẫu').setInputFiles(colours.map(() => PHOTO));
  for (const [i, c] of colours.entries()) {
    await page.getByLabel(`Tên màu – ảnh ${i + 1}`).fill(c);
    await page.locator('.publish-ok').nth(i).waitFor(); // uploaded
  }
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill(product);
  await page.getByLabel('Mô tả ngắn').fill('Quai da mềm, đế êm.');
}

test('one screen publishes product, picture strip and promo poster; guests see them on the home page', async () => {
  await fill(admin, 'Dép kẹp nam quai da', ['Xám khuy tán', 'Xanh rêu khoá']);
  // photos are framed 4:5 for the site
  const ratio = await admin.locator('.publish-thumb img').first().evaluate((i: HTMLImageElement) => i.naturalWidth / i.naturalHeight);
  expect(ratio).toBeCloseTo(0.8, 2);
  await admin.getByLabel('Tiêu đề lớn').fill('Dép kẹp');
  await admin.getByLabel('Dòng nổi bật (màu vàng)').fill('Nam');
  await admin.getByRole('button', { name: 'Đăng lên web' }).click();
  await admin.getByRole('heading', { name: 'Đã đăng lên web' }).waitFor();

  const { ctx, page } = await phone();
  await page.goto(app.url + '/');
  await page.locator('.promo-title', { hasText: 'Dép kẹp' }).waitFor();
  expect(await page.locator('.promo-title .hl').textContent()).toBe('Nam');
  expect(await page.locator('.promo-swatch').count()).toBe(2);
  const strip = page.locator('.gallery-track').first();
  expect(await strip.locator('.gallery-item').count()).toBe(2);
  await page.getByText('Xám khuy tán').first().waitFor();
  await page.goto(app.url + '/san-pham');
  await page.getByRole('link', { name: 'Dép kẹp nam quai da' }).first().waitFor();
  await ctx.close();
});

test('photos with another brand\'s logo are kept off the public site', async () => {
  await fill(admin, 'Mẫu logo thử', ['Đen']);
  await admin.getByLabel(/Ảnh có logo hãng khác/).check();
  expect(await admin.getByLabel('Tạo poster quảng cáo').count()).toBe(0);
  await admin.getByRole('button', { name: 'Đăng lên web' }).click();
  await admin.getByText('chỉ khách đã đăng nhập thấy').waitFor();
  const { ctx, page } = await phone();
  await page.goto(app.url + '/san-pham');
  expect(await page.getByText('Mẫu logo thử').count()).toBe(0);
  await page.goto(app.url + '/');
  expect(await page.locator('.gallery-track').first().locator('.gallery-item').count()).toBe(2); // only the first product's pictures
  await ctx.close();
});
