import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { BrowserContext, Page } from 'playwright';
import { t } from '../../src/shared/i18n';
import { closeBrowser, getBrowser, pageApi, phone, seedSampleOrder, setupAdmin, startApp, type App } from './helpers';

let app: App;
let admin: Page;
let done: () => Promise<void>;
beforeAll(async () => {
  app = await startApp();
  const p = await phone();
  admin = p.page;
  done = () => p.ctx.close();
  await setupAdmin(admin, app);
});
afterAll(async () => { await done(); await closeBrowser(); await app.stop(); });

/** A quoted order and a fresh (logged-out) customer browser on its link. */
async function quoted(opts: Parameters<typeof seedSampleOrder>[1]) {
  const o = await seedSampleOrder(admin, opts);
  const sent = await pageApi(admin, 'POST', `/api/orders/${o.id}/send-quote`, {});
  const ctx: BrowserContext = await (await getBrowser()).newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(sent.url.replace('https://xuong.test', app.url).replace(/^https?:\/\/[^/]+/, app.url));
  return { o, page, ctx, url: sent.url as string };
}

test('customer with lang km sees Khmer accept button and Khmer font', async () => {
  const { page, ctx } = await quoted({ customer: 'Sokha', lang: 'km', price: 47000 });
  const btn = page.getByRole('button', { name: t('km', 'accept') });
  await btn.waitFor();
  expect(await page.locator('link[href*="Noto+Sans+Khmer"]').count()).toBe(1);
  const family = await btn.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toContain('Noto Sans Khmer');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('km');
  await ctx.close();
});

test("switching to English shows 'Accept quote' and USD formatted $18.90", async () => {
  const { page, ctx } = await quoted({ customer: 'John', lang: 'vi', currency: 'USD', price: 1890, counts: [1] });
  await page.getByRole('button', { name: 'Đồng ý báo giá' }).waitFor();
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Accept quote' }).waitFor();
  expect(await page.getByText('$18.90').count()).toBeGreaterThan(0);
  expect(await page.getByText('$113.40').count()).toBeGreaterThan(0); // 6 pairs × $18.90
  // remembered on reload
  await page.reload();
  await page.getByRole('button', { name: 'Accept quote' }).waitFor();
  await ctx.close();
});

test('accept → admin order shows Khách đã đồng ý', async () => {
  const { o, page, ctx } = await quoted({ customer: 'chị Nga', price: 47000 });
  await page.getByText('66.270.000 ₫').first().waitFor();
  expect(await page.locator('img[src*="/img/1/0"]').count()).toBe(1);
  await page.getByRole('button', { name: 'Đồng ý báo giá' }).click();
  await page.getByText(t('vi', 'accepted')).waitFor();
  expect(await page.getByRole('button', { name: 'Đồng ý báo giá' }).count()).toBe(0);
  await admin.goto(app.url + `/quan-ly#/orders/${o.id}`);
  await admin.reload();
  await admin.locator('.order-detail .badge', { hasText: 'Khách đã đồng ý' }).waitFor();
  await ctx.close();
});

test("after admin edits, the open page's accept shows the changed message", async () => {
  const { o, page, ctx } = await quoted({ customer: 'Dara', lang: 'en', price: 47000 });
  await page.getByRole('button', { name: 'Accept quote' }).waitFor();
  const view = await pageApi(admin, 'GET', `/api/orders/${o.id}`);
  view.items[0].lines[0].qtyEach = 99;
  await pageApi(admin, 'PUT', `/api/orders/${o.id}`, view);
  await page.getByRole('button', { name: 'Accept quote' }).click();
  await page.getByText('This quote has changed, please reload').waitFor();
  await page.getByRole('button', { name: 'Reload' }).click();
  await page.getByText('Version 2').waitFor();
  await ctx.close();
});

test('cancelled order hides the button', async () => {
  const { o, page, ctx } = await quoted({ customer: 'chị Hà', price: 47000 });
  await pageApi(admin, 'POST', `/api/orders/${o.id}/status`, { to: 'da_huy' });
  await page.reload();
  await page.getByText(t('vi', 'cancelled')).waitFor();
  expect(await page.getByRole('button', { name: 'Đồng ý báo giá' }).count()).toBe(0);
  await ctx.close();
});

test('page has robots noindex meta and header', async () => {
  const { page, ctx, url } = await quoted({ customer: 'chị Xuân', price: 47000 });
  expect(await page.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex');
  const res = await page.request.get(page.url());
  expect(res.headers()['x-robots-tag']).toBe('noindex');
  expect(url).toContain('/q/');
  await ctx.close();
});
