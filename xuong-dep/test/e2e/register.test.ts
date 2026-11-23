import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Page } from 'playwright';
import { ADMIN, closeBrowser, phone, startApp, type App } from './helpers';

let app: App;
beforeAll(async () => {
  app = await startApp();
  await fetch(app.url + '/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ADMIN) });
});
afterAll(async () => { await closeBrowser(); await app.stop(); });

type Mail = { to: string; subject: string; html: string };
const outbox = async (): Promise<Mail[]> => (await fetch(app.url + '/__dev/outbox')).json();
const linkIn = (m: Mail) => m.html.match(/href="([^"]+)"/)![1].replace(/&amp;/g, '&');

async function fillRegister(page: Page, f: { name: string; phone: string; email: string; password: string; confirm?: string }) {
  await page.getByLabel('Họ tên').fill(f.name);
  await page.getByLabel('Số điện thoại').fill(f.phone);
  await page.getByLabel('Email').fill(f.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password);
  await page.getByLabel('Nhập lại mật khẩu').fill(f.confirm ?? f.password);
  await page.getByLabel('Quốc gia').selectOption('VN');
}

test('register with phone written with spaces then log out and log in by email', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/dang-ky');
  await page.getByRole('heading', { name: 'Tạo tài khoản' }).waitFor();
  await fillRegister(page, { name: 'Chị Lan', phone: '090 123 4567', email: 'Lan@Example.com', password: 'mat-khau-lan-1' });
  await page.getByText('Độ mạnh mật khẩu: Mạnh').waitFor();
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).first().click();
  expect(await page.getByLabel('Mật khẩu', { exact: true }).getAttribute('type')).toBe('text');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.waitForURL(/\/tai-khoan/);
  await page.getByText('Xin chào, Chị Lan').waitFor();

  await page.getByRole('link', { name: 'Hồ sơ' }).click();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.waitForURL(/\/dang-nhap/);
  await page.getByLabel('Số điện thoại hoặc email').fill('lan@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-lan-1');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL(/\/tai-khoan/);
  await page.getByText('Xin chào, Chị Lan').waitFor();
  await ctx.close();
});

test("duplicate phone shows 'đã có tài khoản' under the phone field", async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/dang-ky');
  await fillRegister(page, { name: 'Người khác', phone: '+84901234567', email: 'khac@example.com', password: 'mat-khau-khac-1' });
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  const err = page.locator('#reg-phone-err');
  await err.waitFor();
  expect(await err.textContent()).toContain('đã có tài khoản');
  expect(await page.getByLabel('Số điện thoại').getAttribute('aria-invalid')).toBe('true');
  expect(page.url()).toContain('/dang-ky');
  await ctx.close();
});

test('password mismatch shows error, no request sent', async () => {
  const { ctx, page } = await phone();
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });
  await page.goto(app.url + '/dang-ky');
  await fillRegister(page, { name: 'An', phone: '0912345678', email: 'an@example.com', password: 'mat-khau-an-1', confirm: 'mat-khau-an-2' });
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByText('Mật khẩu nhập lại không khớp').waitFor();
  expect(posts).toEqual([]);
  await ctx.close();
});

test('admin logs in on /dang-nhap and lands on /quan-ly', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/quan-ly#/orders');
  await page.waitForURL(/\/dang-nhap\?next=/);
  await page.getByLabel('Số điện thoại hoặc email').fill(ADMIN.name);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('sai-roi-nhe');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByText('Sai thông tin đăng nhập hoặc mật khẩu').waitFor();
  await page.getByLabel('Mật khẩu', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL(/\/quan-ly#\/orders$/);
  await page.getByRole('navigation').waitFor();
  await ctx.close();
});

test('customer visiting /quan-ly is sent to /tai-khoan', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/dang-nhap');
  await page.getByLabel('Số điện thoại hoặc email').fill('0901234567');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-lan-1');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL(/\/tai-khoan/);
  await page.goto(app.url + '/quan-ly');
  await page.waitForURL(/\/tai-khoan/);
  await page.getByText('Xin chào, Chị Lan').waitFor();
  await ctx.close();
});

test('a ?next= link to another site is ignored', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/dang-nhap?next=//evil.example/x');
  await page.getByLabel('Số điện thoại hoặc email').fill('lan@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-lan-1');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL(/\/tai-khoan/);
  expect(new URL(page.url()).origin).toBe(app.url);
  await ctx.close();
});

test('forgot password page says to check email (and email arrives in dev outbox endpoint)', async () => {
  // the reset mail goes only to a confirmed email: confirm it through the link sent at registration
  const verify = (await outbox()).find((m) => m.to === 'lan@example.com' && /email/i.test(m.subject))!;
  expect(verify).toBeTruthy();
  const v = await fetch(linkIn(verify), { redirect: 'manual' });
  expect(v.headers.get('location')).toContain('verified=1');
  const { ctx, page } = await phone();

  await page.goto(app.url + '/dang-nhap');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await page.waitForURL(/\/quen-mat-khau/);
  await page.getByLabel('Email').fill('lan@example.com');
  await page.getByRole('button', { name: 'Gửi link' }).click();
  await page.getByText('kiểm tra hộp thư').waitFor();

  const reset = (await outbox()).find((m) => m.to === 'lan@example.com' && /mật khẩu/i.test(m.subject))!;
  expect(reset).toBeTruthy();
  await page.goto(linkIn(reset));
  await page.getByRole('heading', { name: 'Đặt mật khẩu mới' }).waitFor();
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('mat-khau-moi-99');
  await page.getByLabel('Nhập lại mật khẩu').fill('mat-khau-moi-99');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await page.waitForURL(/\/dang-nhap/);
  await page.getByText('Đã đổi mật khẩu').waitFor();
  await page.getByLabel('Số điện thoại hoặc email').fill('lan@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-moi-99');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL(/\/tai-khoan/);
  await ctx.close();
});

test('auth pages follow the chosen language', async () => {
  const { ctx, page } = await phone();
  await page.goto(app.url + '/dang-nhap');
  await page.getByRole('button', { name: 'Ngôn ngữ' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Log in', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Log in', exact: true }).waitFor();
  expect(await page.locator('html').getAttribute('lang')).toBe('en');
  await ctx.close();
});
