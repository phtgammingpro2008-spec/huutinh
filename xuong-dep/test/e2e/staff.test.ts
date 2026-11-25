import { afterAll, beforeAll, expect, test } from 'bun:test';
import { closeBrowser, getBrowser, setupAdmin, startApp, type App } from './helpers';

let app: App;
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('owner creates a manager in Người dùng; the manager signs in and does not see the owner settings', async () => {
  const b = await getBrowser();
  const opts = { viewport: { width: 390, height: 844 }, locale: 'vi-VN' };
  const ownerCtx = await b.newContext(opts);
  const page = await ownerCtx.newPage();
  await setupAdmin(page, app);
  await page.goto(app.url + '/quan-ly#/users');
  await page.getByLabel('Tên đăng nhập').fill('hao');
  await page.getByLabel('Mật khẩu (ít nhất 8 ký tự)').fill('mat-khau-hao-1');
  await page.getByRole('button', { name: 'Tạo tài khoản quản lý' }).click();
  await page.getByText('Đã tạo tài khoản hao.', { exact: false }).waitFor();
  await ownerCtx.close();

  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  await p.goto(app.url + '/dang-nhap');
  await p.getByLabel('Số điện thoại hoặc email').fill('hao');
  await p.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-hao-1');
  await p.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await p.waitForURL(/\/quan-ly/);
  await p.goto(app.url + '/quan-ly#/settings');
  await p.getByRole('heading', { name: 'Vật liệu' }).waitFor();
  await p.getByRole('note').waitFor();
  expect(await p.getByRole('link', { name: /Người dùng/ }).count()).toBe(0);
  expect(await p.getByRole('heading', { name: 'Báo đơn qua Telegram' }).count()).toBe(0);
  expect(await p.getByRole('link', { name: 'Tải bản sao lưu' }).count()).toBe(0);
  await p.goto(app.url + '/quan-ly#/content');
  await p.getByRole('tab', { name: 'Ảnh xưởng' }).waitFor();
  expect(await p.getByRole('tab', { name: 'Liên hệ & con số' }).count()).toBe(0);
  await p.getByRole('tab', { name: 'Con số' }).click();
  await p.getByLabel('Số 1', { exact: true }).fill('200+');
  await p.getByRole('group', { name: /Ý nghĩa số 1/ }).getByRole('textbox').first().fill('khách sỉ');
  expect(await p.getByLabel('Địa chỉ').count()).toBe(0);
  await p.getByRole('button', { name: 'Lưu con số' }).click();
  await p.getByText('Đã lưu', { exact: true }).waitFor();
  await ctx.close();
});
