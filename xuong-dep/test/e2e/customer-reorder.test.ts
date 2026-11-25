import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { closeBrowser, phone, startApp, type App } from './helpers';

let app: App;

async function register(page: Page, n: number) {
  await page.goto(app.url + '/api/setup-status');
  await page.evaluate(async (n) => fetch('/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `Chị Hoa ${n}`, phone: `09087654${10 + n}`, email: `hoa${n}@example.com`, password: 'mat-khau-123', country: 'VN', lang: 'vi' }),
  }), n);
}

beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

test('Đặt lại đơn này copies the designs and pairs into a new order that is sent as its own order', async () => {
  const { ctx, page } = await phone();
  await register(page, 6);
  await page.goto(app.url + '/tai-khoan#/dat-hang');
  await page.getByLabel('Chọn ảnh của bạn').setInputFiles(join(import.meta.dir, '../fixtures/grid-3000x2000.jpg'));
  await page.getByRole('button', { name: 'Cả ảnh là 1 mẫu' }).click();
  await page.getByRole('region', { name: 'Mẫu 1', exact: true }).getByLabel('Số đôi mỗi size – Nam').fill('4');
  await page.getByRole('button', { name: 'Gửi đơn' }).click();
  await page.waitForURL(/#\/don\//);
  const first = page.url().split('#/don/')[1];

  await page.getByRole('link', { name: 'Đặt lại đơn này' }).click();
  await page.getByText(/^Đã chép 1 mẫu từ đơn /).waitFor();
  await page.getByText('Tổng: 24 đôi').waitFor();
  await page.getByRole('button', { name: 'Gửi đơn' }).click();
  await page.waitForFunction((f) => location.hash.startsWith('#/don/') && !location.hash.endsWith(f), first); // hash change: no load event
  const list = await page.evaluate(async () => (await fetch('/api/c/orders')).json());
  expect(list).toHaveLength(2);
  expect(list.map((o: { totalQty: number }) => o.totalQty)).toEqual([24, 24]);
  const [a, b] = await Promise.all(list.map(async (o: { id: string }) => page.evaluate(async (id) => (await fetch('/api/c/orders/' + id)).json(), o.id)));
  expect(a.items[0].designId).toBe(b.items[0].designId); // the same design, not a new copy
  expect(a.items[0].id).not.toBe(b.items[0].id);
  await ctx.close();
});
