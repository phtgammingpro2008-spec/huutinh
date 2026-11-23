import { afterAll, beforeAll, expect, test } from 'bun:test';
import { closeBrowser, getBrowser, phone, setupAdmin, startApp, type App } from './helpers';

let app: App;
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('admin lives at /quan-ly and an old /#/orders/<id> link redirects there', async () => {
  const { ctx, page } = await phone();
  await setupAdmin(page, app);
  expect(new URL(page.url()).pathname).toBe('/quan-ly');
  await page.goto(app.url + '/#/orders/abc-123');
  await page.waitForURL(/\/quan-ly#\/orders\/abc-123$/);
  await ctx.close();
});

test('theme toggle switches data-theme and persists after reload', async () => {
  const { ctx, page } = await phone();
  await setupAdmin(page, app);
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const before = await theme();
  await page.getByRole('button', { name: /Giao diện (tối|sáng)/ }).click();
  const after = await theme();
  expect(after).not.toBe(before);
  await page.reload();
  await page.getByRole('navigation').waitFor();
  expect(await theme()).toBe(after);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe(after === 'dark' ? 'rgb(15, 31, 24)' : 'rgb(246, 245, 239)');
  await ctx.close();
});

test('theme follows prefers-color-scheme dark by default', async () => {
  const ctx = await (await getBrowser()).newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // the login page: /quan-ly would move a logged-out visitor on while we measure
  await page.goto(app.url + '/dang-nhap');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(15, 31, 24)');
  await ctx.close();
});
