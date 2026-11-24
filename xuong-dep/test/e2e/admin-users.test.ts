import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { closeBrowser, pageApi, phone, seedSampleOrder, setupAdmin, startApp, type App } from './helpers';

const FIX = join(import.meta.dir, '../fixtures');
let app: App;
let admin: Page;

async function customer(n: number) {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/api/setup-status');
  await page.evaluate(async (n) => fetch('/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `Khách Tư ${n}`, phone: `09033344${10 + n}`, email: `tu${n}@example.com`, password: 'mat-khau-123', country: 'VN', lang: 'vi' }),
  }), n);
  return { ctx, page };
}

beforeAll(async () => {
  app = await startApp();
  admin = (await phone()).page;
  await setupAdmin(admin, app);
});
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('admin sees Đơn khách mới badge count', async () => {
  const { ctx, page } = await customer(1);
  const ok = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 20; c.height = 20;
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg'));
    const up = async () => (await fetch('/api/c/images?w=20&h=20', { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg' } })).json();
    const photo = await up(), crop = await up();
    const id = crypto.randomUUID();
    const r = await fetch(`/api/c/orders/${id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ neededBy: null, note: '', deliverNote: 'Bến xe Phnom Penh', images: [{ id: photo.id, key: photo.key, width: 20, height: 20 }],
        items: [{ id: crypto.randomUUID(), designId: crypto.randomUUID(), imageId: photo.id, tagNo: 1, tapX: null, tapY: null, crop: { x: 0, y: 0, w: 1, h: 1 },
          cropKey: crop.key, soleId: null, strapId: null, styleId: null, colorNote: '',
          lines: [{ id: crypto.randomUUID(), lineKey: 'nam', sizeFrom: 39, sizeTo: 44, mode: 'even', qtyEach: 2, perSize: {}, unitPrice: null }] }] }),
    });
    return r.status;
  });
  expect(ok).toBe(200);
  await ctx.close();

  await admin.goto(app.url + '/quan-ly#/');
  await admin.reload(); // same page as before: load the dashboard again
  const bucket = admin.getByRole('region', { name: 'Đơn khách mới' });
  await bucket.locator('.badge.count', { hasText: '1' }).waitFor();
  await bucket.getByText('Khách tự đặt').waitFor();
  await bucket.locator('a.order-row').click();
  await admin.getByText('Nơi nhận hàng: Bến xe Phnom Penh').waitFor();
  await admin.goto(app.url + '/quan-ly#/');
  await admin.getByRole('heading', { name: 'Chờ báo giá' }).waitFor();
  expect(await admin.getByRole('region', { name: 'Đơn khách mới' }).count()).toBe(0);
});

test("admin locks a customer → that customer's open page gets sent to login", async () => {
  const { ctx, page } = await customer(2);
  await page.goto(app.url + '/tai-khoan#/');
  await page.getByRole('heading', { name: 'Xin chào, Khách Tư 2' }).waitFor();

  await admin.goto(app.url + '/quan-ly#/settings');
  await admin.getByRole('link', { name: 'Người dùng' }).click();
  await admin.getByLabel('Tìm người dùng').fill('Tư 2');
  const row = admin.locator('.user-row', { hasText: 'Khách Tư 2' });
  admin.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'Khóa' }).click();
  await row.getByText('Đã khóa').waitFor();

  await page.getByRole('link', { name: 'Thư viện', exact: true }).click();
  await page.waitForURL(/\/dang-nhap/);
  await page.getByLabel('Số điện thoại hoặc email').fill('tu2@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByText('Tài khoản đã bị khóa').waitFor();

  await row.getByRole('button', { name: 'Mở khóa' }).click();
  await row.getByRole('button', { name: 'Khóa' }).waitFor();
  await row.getByRole('button', { name: 'Tạo link đặt lại mật khẩu' }).click();
  const link = await row.getByLabel('Link đặt lại mật khẩu').inputValue();
  expect(link).toContain('/dat-lai-mat-khau?token=');
  await ctx.close();
});

test('admin creates product with 2 colours and publishes → appears on / for guests', async () => {
  await admin.goto(app.url + '/quan-ly#/content');
  await admin.getByRole('tab', { name: 'Sản phẩm' }).click();
  await admin.getByRole('button', { name: 'Thêm sản phẩm' }).click();
  await admin.getByLabel('Tên sản phẩm (VI)').fill('Dép quai ngang da bò');
  await admin.getByLabel('Tên sản phẩm (EN)').fill('Leather slide');
  for (const [i, name] of ['Nâu', 'Đen'].entries()) {
    await admin.getByRole('button', { name: 'Thêm màu' }).click();
    const c = admin.locator('.color-row').nth(i);
    await c.getByLabel('Tên màu (VI)').fill(name);
    await c.getByLabel('Ảnh màu').setInputFiles(join(FIX, 'grid-3000x2000.jpg'));
    await c.locator('img.color-img').waitFor();
  }
  await admin.getByLabel('Đang bán (hiện trên trang web)').check();
  await admin.getByRole('button', { name: 'Lưu sản phẩm' }).click();
  await admin.getByText('Đã lưu sản phẩm').waitFor();

  const { ctx, page } = await phone();
  await page.goto(app.url + '/');
  await page.getByRole('link', { name: 'Dép quai ngang da bò' }).first().click();
  await page.getByRole('heading', { name: 'Dép quai ngang da bò' }).waitFor();
  expect(await page.locator('[data-color-id]').count()).toBe(1);
  await ctx.close();
});

test('admin marks design Có logo → product colour using it hidden from guest page', async () => {
  const o = await seedSampleOrder(admin, { customer: 'Khách logo' });
  const d = o.items[0];
  const p = await pageApi(admin, 'POST', '/api/products', {
    name: { vi: 'Mẫu có logo thử' }, published: true,
    colors: [{ name: { vi: 'Logo' }, imageKey: d.cropKey, designId: d.designId }],
  });
  const { ctx, page } = await phone();
  await page.goto(app.url + '/san-pham/' + p.slug);
  await page.locator('[data-color-id]').waitFor();

  await admin.goto(app.url + `/quan-ly#/library/${d.designId}`);
  await admin.getByLabel('Có logo thương hiệu').check();
  await admin.getByRole('button', { name: 'Lưu mẫu' }).click();
  await admin.getByText('Đã lưu mẫu').waitFor();

  await page.reload();
  expect(await page.locator('[data-color-id]').count()).toBe(0);
  expect(await page.content()).not.toContain(d.cropKey);
  await ctx.close();
});
