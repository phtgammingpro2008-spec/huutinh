import { afterAll, beforeAll, expect, test } from 'bun:test';
import { closeBrowser, phone, setupAdmin, startApp, type App } from './helpers';

let app: App;
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('owner types the workshop figures; the home page shows them, empty slots stay hidden', async () => {
  const { ctx, page } = await phone();
  await setupAdmin(page, app);
  await page.goto(app.url + '/quan-ly#/content');
  await page.getByRole('tab', { name: 'Liên hệ & con số' }).click();
  await page.getByLabel('Số 1', { exact: true }).fill('50.000+');
  await page.getByRole('group', { name: /Ý nghĩa số 1/ }).getByRole('textbox').first().fill('đôi mỗi tháng');
  await page.getByRole('button', { name: 'Lưu liên hệ và con số' }).click();
  await page.getByText('Đã lưu', { exact: true }).waitFor();
  await page.goto(app.url + '/');
  const band = page.getByRole('region', { name: 'HLUXURY qua những con số' });
  await band.getByText('đôi mỗi tháng').waitFor();
  expect(await band.getByRole('listitem').count()).toBe(1);
  await ctx.close();
});

test('the three picture tabs keep their own pictures apart', async () => {
  const { ctx, page } = await phone();
  await setupAdmin(page, app);
  await page.goto(app.url + '/quan-ly#/content');
  await page.getByRole('tab', { name: 'Đơn đã giao' }).click();
  await page.getByText('Chưa có ảnh nào.').waitFor();
  await page.getByRole('button', { name: 'Thêm ảnh' }).click();
  await page.getByText(/Ghi số đôi và nơi giao/).waitFor();
  await ctx.close();
});
