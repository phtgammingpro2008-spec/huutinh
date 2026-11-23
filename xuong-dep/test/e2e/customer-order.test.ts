import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import { ADMIN, closeBrowser, phone, startApp, type App } from './helpers';

const FIX = join(import.meta.dir, '../fixtures');
let app: App;
let adminCookie = '';
let slug = '';
const ids: Record<string, string> = {};

async function admin(method: string, path: string, body?: unknown, type = 'application/json') {
  const r = await fetch(app.url + path, {
    method, headers: { cookie: adminCookie, 'content-type': type },
    body: body === undefined ? undefined : body instanceof Uint8Array ? (body as unknown as BodyInit) : JSON.stringify(body),
  });
  return r.json();
}

/** A signed-in customer in a fresh phone browser. */
async function customer(n: number): Promise<{ ctx: BrowserContext; page: Page }> {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/api/setup-status');
  const r = await page.evaluate(async (n) => (await fetch('/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `Khách ${n}`, phone: `09012345${10 + n}`, email: `khach${n}@example.com`, password: 'mat-khau-123', country: 'VN', lang: 'vi' }),
  })).status, n);
  expect(r).toBe(200);
  return { ctx, page };
}
const ctxs: Record<string, { ctx: BrowserContext; page: Page }> = {};

/** Fills "Đều mỗi size" for the Nam line of one design card. */
async function pairs(page: Page, tagNo: number, n: number) {
  await page.getByRole('region', { name: `Mẫu ${tagNo}`, exact: true }).getByLabel('Số đôi mỗi size – Nam').fill(String(n));
}

async function sendOrder(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Gửi đơn' }).click();
  await page.waitForURL(/#\/don\//);
  await page.getByText('Đã gửi đơn').waitFor();
  return page.url().split('#/don/')[1];
}

async function quote(orderId: string, price: number) {
  const o = await admin('GET', `/api/orders/${orderId}`);
  await admin('PUT', `/api/orders/${orderId}/prices`, { prices: o.items.flatMap((i: any) => i.lines.map((l: any) => ({ lineId: l.id, unitPrice: price }))) });
  const s = await admin('POST', `/api/orders/${orderId}/send-quote`, {});
  expect(s.url).toBeTruthy();
}

beforeAll(async () => {
  app = await startApp();
  const j = { 'content-type': 'application/json' };
  await fetch(app.url + '/api/setup', { method: 'POST', headers: j, body: JSON.stringify(ADMIN) });
  adminCookie = ((await fetch(app.url + '/api/login', { method: 'POST', headers: j, body: JSON.stringify(ADMIN) })).headers.get('set-cookie') ?? '').split(';')[0];
  const png = new Uint8Array(await Bun.file(join(FIX, 'tiny-1x1.png')).arrayBuffer());
  const up = async () => (await admin('POST', '/api/content/images?w=1&h=1', png, 'image/png')).key;
  const p = await admin('POST', '/api/products', {
    name: { vi: 'Kẹp đế êm' }, published: true,
    lines: [{ key: 'nam', label: { vi: 'Nam', en: 'Men', km: 'បុរស' }, sizeFrom: 39, sizeTo: 44 }],
    colors: [{ name: { vi: 'Đen' }, imageKey: await up() }, { name: { vi: 'Kem' }, imageKey: await up() }],
  });
  slug = p.slug;
});
afterAll(async () => {
  for (const c of Object.values(ctxs)) await c.ctx.close();
  await closeBrowser();
  await app.stop();
});

test('customer orders 2 colours of a product with Nam 39–44 even 10 → Tổng 120 đôi, admin sees it under Đơn khách mới', async () => {
  const a = ctxs.a = await customer(1);
  const { page } = a;
  await page.goto(app.url + '/san-pham/' + slug);
  await page.locator('.swatch', { hasText: 'Kem' }).click();
  await page.getByRole('link', { name: 'Đặt sản phẩm này' }).click();
  await page.waitForURL(/\/tai-khoan#\/dat-hang/);
  await page.getByRole('region', { name: 'Mẫu 2', exact: true }).waitFor();
  expect(await page.getByRole('region', { name: /^Mẫu \d+$/ }).count()).toBe(2);
  await page.getByText('Kẹp đế êm · Kem').waitFor();
  await pairs(page, 1, 10);
  await pairs(page, 2, 10);
  await page.getByLabel('Nơi nhận hàng bên Campuchia').fill('Bến xe Phnom Penh');
  await page.getByText('Tổng: 120 đôi').waitFor();
  ids.a1 = await sendOrder(page);
  await page.getByText('Chờ báo giá').first().waitFor();

  const dash = await admin('GET', '/api/dashboard');
  expect(dash.newFromCustomers.map((o: any) => o.id)).toContain(ids.a1);
  const o = await admin('GET', `/api/orders/${ids.a1}`);
  expect(o).toMatchObject({ source: 'customer', deliverNote: 'Bến xe Phnom Penh', status: 'cho_bao_gia' });
  expect(o.totals.qty).toBe(120);
});

test('customer orders from own photo with Mẫu đặt riêng → design absent from a second customer\'s library', async () => {
  const { page } = ctxs.a;
  for (const priv of [true, false]) {
    await page.goto(app.url + '/tai-khoan#/dat-hang');
    await page.getByLabel('Chọn ảnh của bạn').setInputFiles(join(FIX, 'grid-3000x2000.jpg'));
    await page.getByRole('button', { name: 'Cả ảnh là 1 mẫu' }).click();
    await pairs(page, 1, 5);
    if (priv) await page.getByRole('region', { name: 'Mẫu 1', exact: true }).getByLabel('Mẫu đặt riêng (không hiện cho khách khác)').check();
    await page.getByText('Tổng: 30 đôi').waitFor();
    ids[priv ? 'aPrivate' : 'aPublic'] = await sendOrder(page);
  }
  const designOf = async (orderId: string) => (await admin('GET', `/api/orders/${orderId}`)).items[0].designId as string;
  const privateDesign = await designOf(ids.aPrivate), publicDesign = await designOf(ids.aPublic);
  ids.publicDesign = publicDesign;

  const b = ctxs.b = await customer(2);
  await b.page.goto(app.url + '/tai-khoan#/thu-vien');
  await b.page.locator(`[data-design-id="${publicDesign}"]`).waitFor();
  expect(await b.page.locator(`[data-design-id="${privateDesign}"]`).count()).toBe(0);
  // the original photo is never reachable for another customer
  const original = (await admin('GET', `/api/orders/${ids.aPublic}`)).images[0].key;
  expect((await b.page.request.get(app.url + '/media/' + original)).status()).toBe(404);
});

test('second customer reorders a visible library design', async () => {
  const { page } = ctxs.b;
  await page.locator(`[data-design-id="${ids.publicDesign}"]`).getByRole('button', { name: 'Đặt lại mẫu này' }).click();
  await page.waitForURL(/#\/dat-hang/);
  await page.getByRole('region', { name: 'Mẫu 1', exact: true }).waitFor();
  await pairs(page, 1, 10);
  ids.b1 = await sendOrder(page);
  const o = await admin('GET', `/api/orders/${ids.b1}`);
  expect(o.items[0].designId).toBe(ids.publicDesign);
  expect(o.images).toEqual([]);
});

test('admin quotes, customer accepts in account → Khách đã đồng ý', async () => {
  await quote(ids.a1, 50000);
  const { page } = ctxs.a;
  await page.goto(app.url + '/tai-khoan#/don/' + ids.a1);
  await page.getByText('Đã báo giá').first().waitFor();
  await page.getByText('6.000.000 ₫').first().waitFor();
  await page.getByRole('button', { name: 'Đồng ý báo giá' }).click();
  await page.getByText('Bạn đã đồng ý báo giá này').waitFor();
  await page.getByText('Còn lại').waitFor();
  expect(await page.getByRole('button', { name: 'Hủy đơn' }).count()).toBe(0);

  const { ctx, page: ad } = await phone();
  await ad.goto(app.url + '/dang-nhap');
  await ad.getByLabel('Số điện thoại hoặc email').fill(ADMIN.name);
  await ad.getByLabel('Mật khẩu', { exact: true }).fill(ADMIN.password);
  await ad.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await ad.waitForURL(/\/quan-ly/);
  await ad.goto(app.url + '/quan-ly#/orders/' + ids.a1);
  await ad.locator('.order-detail .badge', { hasText: 'Khách đã đồng ý' }).waitFor();
  await ctx.close();
});

test('customer cancels a quoted order with reason; admin sees reason', async () => {
  await quote(ids.b1, 40000);
  const { page } = ctxs.b;
  await page.goto(app.url + '/tai-khoan#/don/' + ids.b1);
  await page.getByRole('button', { name: 'Hủy đơn' }).click();
  const dlg = page.getByRole('dialog', { name: 'Hủy đơn này?' });
  await dlg.getByLabel('Lý do (không bắt buộc)').fill('Giá cao quá');
  await dlg.getByRole('button', { name: 'Xác nhận hủy' }).click();
  await page.getByText('Bạn đã hủy đơn này.').waitFor();
  await page.getByText('Lý do: Giá cao quá').waitFor();
  const o = await admin('GET', `/api/orders/${ids.b1}`);
  expect(o).toMatchObject({ status: 'da_huy', cancelReason: 'Giá cao quá', cancelledBy: 'customer' });
});

test("customer cannot open another customer's order URL (not-found screen)", async () => {
  const { page } = ctxs.a;
  await page.goto(app.url + '/tai-khoan#/don/' + ids.b1);
  await page.getByText('Không tìm thấy đơn này.').waitFor();
  expect(await page.getByText('Giá cao quá').count()).toBe(0);
});

test('an unfinished order survives a reload and can be discarded', async () => {
  const { page } = ctxs.b;
  await page.goto(app.url + '/san-pham/' + slug);
  await page.getByRole('link', { name: 'Đặt sản phẩm này' }).click();
  await page.waitForURL(/#\/dat-hang/);
  await pairs(page, 1, 3);
  await page.getByText('Tổng: 18 đôi').waitFor();
  await page.waitForTimeout(700); // autosave
  await page.reload();
  await page.getByText('Tổng: 18 đôi').waitFor();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Bỏ đơn nháp' }).click();
  await page.getByText('Chưa có mẫu nào').waitFor();
});
