import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { closeBrowser, phone, startApp, type App } from './helpers';

let app: App;
type Mail = { to: string; subject: string; html: string };
const outbox = async (): Promise<Mail[]> => (await fetch(app.url + '/__dev/outbox')).json();

async function register(page: Page, n: number) {
  await page.goto(app.url + '/api/setup-status');
  await page.evaluate(async (n) => fetch('/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `Chị Hoa ${n}`, phone: `09087654${10 + n}`, email: `hoa${n}@example.com`, password: 'mat-khau-123', country: 'VN', lang: 'vi' }),
  }), n);
}

beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('profile: rename, switch to English (kept after reload), change password', async () => {
  const { ctx, page } = await phone();
  await register(page, 1);
  await page.goto(app.url + '/tai-khoan#/ho-so');
  await page.getByLabel('Họ tên').fill('Hoa Trần');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.getByText('Đã lưu.').waitFor();

  await page.getByRole('combobox', { name: 'Ngôn ngữ' }).selectOption('en');
  await page.getByRole('heading', { name: 'Profile' }).waitFor();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Saved.').waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Profile' }).waitFor();
  await page.goto(app.url + '/tai-khoan#/');
  await page.getByRole('heading', { name: 'Hello, Hoa Trần' }).waitFor();

  await page.goto(app.url + '/tai-khoan#/ho-so');
  await page.getByLabel('Current password').fill('mat-khau-123');
  await page.getByLabel('New password').fill('mat-khau-moi-456');
  await page.getByLabel('Repeat password').fill('mat-khau-moi-456');
  await page.getByRole('button', { name: 'Change password' }).click();
  await page.getByText('Password changed.').waitFor();
  const ok = await page.evaluate(async () => (await fetch('/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'hoa1@example.com', password: 'mat-khau-moi-456' }),
  })).status);
  expect(ok).toBe(200);
  await ctx.close();
});

test('email confirmation: link shows a thank-you on the profile; resend sends another mail', async () => {
  const { ctx, page } = await phone();
  await register(page, 2);
  await page.goto(app.url + '/tai-khoan#/ho-so');
  await page.getByText('Chưa xác nhận').waitFor();
  const before = (await outbox()).filter((m) => m.to === 'hoa2@example.com').length;
  await page.getByRole('button', { name: 'Gửi lại email xác nhận' }).click();
  await page.getByText('Đã gửi email xác nhận').waitFor();
  const mails = (await outbox()).filter((m) => m.to === 'hoa2@example.com');
  expect(mails.length).toBe(before + 1);
  const link = mails[mails.length - 1].html.match(/href="([^"]+)"/)![1].replace(/&amp;/g, '&');
  await page.goto(link);
  await page.getByText('Email đã được xác nhận').waitFor();
  await page.getByText('Đã xác nhận', { exact: true }).waitFor();
  await ctx.close();
});

test('an order waiting for a quote can be edited; the change is saved on the same order', async () => {
  const { ctx, page } = await phone();
  await register(page, 3);
  await page.goto(app.url + '/tai-khoan#/dat-hang');
  await page.getByLabel('Chọn ảnh của bạn').setInputFiles(join(import.meta.dir, '../fixtures/grid-3000x2000.jpg'));
  await page.getByRole('button', { name: 'Cả ảnh là 1 mẫu' }).click();
  await page.getByRole('region', { name: 'Mẫu 1', exact: true }).getByLabel('Số đôi mỗi size – Nam').fill('4');
  await page.getByRole('button', { name: 'Gửi đơn' }).click();
  await page.waitForURL(/#\/don\//);
  const id = page.url().split('#/don/')[1];
  await page.getByRole('link', { name: 'Sửa đơn' }).click();
  await page.getByRole('heading', { name: /^Sửa đơn / }).waitFor();
  await page.getByRole('region', { name: 'Mẫu 1', exact: true }).getByLabel('Số đôi mỗi size – Nam').fill('6');
  await page.getByText('Tổng: 36 đôi').waitFor();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.waitForURL(new RegExp(`#/don/${id}$`));
  await page.getByText('36 đôi').first().waitFor();
  const list = await page.evaluate(async () => (await fetch('/api/c/orders')).json());
  expect(list).toHaveLength(1);
  expect(list[0].totalQty).toBe(36);
  await ctx.close();
});

test('the customer bar has a Trang chủ button back to the shop home page', async () => {
  const { ctx, page } = await phone();
  await register(page, 4);
  await page.goto(app.url + '/tai-khoan#/');
  const bar = page.getByRole('navigation');
  await bar.getByRole('link', { name: 'Đơn của tôi' }).waitFor(); // the bar is drawn after /api/me answers
  const names = await bar.getByRole('link').allTextContents();
  expect(names.slice(0, 2)).toEqual(['Trang chủ', 'Đơn của tôi']);
  await bar.getByRole('link', { name: 'Trang chủ' }).click();
  await page.waitForURL(new RegExp(app.url.replace(/[.]/g, '\\.') + '/$'));
  await page.getByRole('link', { name: 'Tài khoản' }).waitFor();
  await ctx.close();
});
