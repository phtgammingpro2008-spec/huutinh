import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import { ADMIN, closeBrowser, phone, startApp, type App } from './helpers';

let app: App;
let slug = '';

async function adminApi(cookie: string, method: string, path: string, body?: unknown, type = 'application/json') {
  const r = await fetch(app.url + path, {
    method, headers: { cookie, 'content-type': type }, body: body instanceof Uint8Array ? (body as unknown as BodyInit) : JSON.stringify(body),
  });
  return r.json();
}

beforeAll(async () => {
  app = await startApp();
  const j = { 'content-type': 'application/json' };
  await fetch(app.url + '/api/setup', { method: 'POST', headers: j, body: JSON.stringify(ADMIN) });
  const login = await fetch(app.url + '/api/login', { method: 'POST', headers: j, body: JSON.stringify(ADMIN) });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  const png = new Uint8Array(await Bun.file(join(import.meta.dir, '../fixtures/tiny-1x1.png')).arrayBuffer());
  const up = async () => (await adminApi(cookie, 'POST', '/api/content/images?w=1&h=1', png, 'image/png')).key;
  const p = await adminApi(cookie, 'POST', '/api/products', {
    name: { vi: 'Kẹp đế êm', en: 'Soft flip-flop', km: 'ស្បែកជើងផ្ទាត់' }, isNew: true, published: true,
    lines: [{ key: 'nam', label: { vi: 'Nam', en: 'Men', km: 'បុរស' }, sizeFrom: 39, sizeTo: 44 }],
    colors: [{ name: { vi: 'Đen' }, imageKey: await up() }, { name: { vi: 'Kem' }, imageKey: await up() }, { name: { vi: 'Rêu' }, imageKey: await up() }],
  });
  slug = p.slug;
  await adminApi(cookie, 'POST', '/api/posters', { title: { vi: 'Hè rực rỡ' }, tag: { vi: 'MỚI · HÈ 2027' }, published: true, ctaLabel: { vi: 'Xem sản phẩm' }, ctaHref: '/san-pham' });
  await adminApi(cookie, 'PUT', '/api/shop', { zalo: '0901234567', messenger: '', workshopAddress: 'TP.HCM', warehouseAddress: 'Phnom Penh' });
});
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('guest taps Đặt sản phẩm này → modal → registers → returns to the product page with all colours', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/');
  await page.getByRole('heading', { name: 'Hè rực rỡ' }).waitFor();
  await page.getByRole('link', { name: 'Kẹp đế êm' }).first().click();
  await page.waitForURL(new RegExp(`/san-pham/${slug}$`));
  expect(await page.locator('[data-color-id]').count()).toBe(1);
  await page.getByText('Đăng nhập để xem đủ màu và size').waitFor();

  await page.getByRole('link', { name: 'Đặt sản phẩm này' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByLabel('Họ tên').fill('Chị Mai');
  await dialog.getByLabel('Quốc gia').selectOption('KH');
  await dialog.getByLabel('Số điện thoại').fill('012 345 678');
  await dialog.getByLabel('Email').fill('mai@example.com');
  await dialog.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-mai-1');
  await dialog.getByLabel('Nhập lại mật khẩu').fill('mat-khau-mai-1');
  await dialog.getByRole('button', { name: 'Tạo tài khoản' }).click();

  await page.waitForURL(new RegExp(`/san-pham/${slug}$`));
  await page.locator('.swatch input[name="mau"]').nth(2).waitFor();
  expect(await page.locator('[data-color-id]').count()).toBe(3);
  await page.getByText('39–44').waitFor();
  // picking a second colour puts both on the order link
  await page.locator('.swatch', { hasText: 'Rêu' }).click();
  const href = await page.getByRole('link', { name: 'Đặt sản phẩm này' }).getAttribute('href');
  expect(href).toContain(`/tai-khoan#/dat-hang?san-pham=${slug}&mau=`);
  expect(href!.split('mau=')[1].split(',')).toHaveLength(2);
  await page.getByRole('link', { name: 'Tài khoản' }).waitFor();
  await ctx.close();
});

test('the modal closes with Escape and the page stays put', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/san-pham/' + slug);
  await page.getByRole('link', { name: 'Đặt sản phẩm này' }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  expect(new URL(page.url()).pathname).toBe('/san-pham/' + slug);
  await ctx.close();
});

test('sticky CTA visible on phone', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/');
  const cta = page.getByRole('link', { name: 'Gửi ảnh nhận báo giá' });
  await cta.waitFor();
  const box = (await cta.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.y + box.height).toBeLessThanOrEqual(vh);
  expect(box.y).toBeGreaterThan(vh - 120);
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(200);
  const after = (await cta.boundingBox())!;
  expect(Math.round(after.y)).toBe(Math.round(box.y));
  expect(await page.getByRole('link', { name: 'Nhắn Zalo cho xưởng' }).getAttribute('href')).toBe('https://zalo.me/0901234567');
  await ctx.close();
});

test('km language renders Khmer font', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/?lang=km');
  expect(await page.locator('html').getAttribute('lang')).toBe('km');
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font).toContain('Noto Sans Khmer');
  await page.getByText('ស្បែកជើងផ្ទាត់').first().waitFor();
  await ctx.close();
});

test('globe switches the public site to English and remembers it', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/');
  await page.getByRole('button', { name: 'Ngôn ngữ' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await page.getByRole('link', { name: 'Soft flip-flop' }).first().waitFor();
  await page.goto(app.url + '/san-pham/' + slug);
  await page.getByRole('heading', { name: 'Soft flip-flop' }).waitFor();
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  // the account pages follow the same choice
  await page.goto(app.url + '/dang-nhap');
  await page.getByRole('button', { name: 'Log in', exact: true }).waitFor();
  await ctx.close();
});
