import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeBrowser, pageApi, phone, seedSampleOrder, setupAdmin, startApp, type App } from './helpers';

let app: App;
let page: Page;
let done: () => Promise<void>;
let acceptedId = '';
beforeAll(async () => {
  app = await startApp();
  const p = await phone();
  page = p.page;
  done = () => p.ctx.close();
  await setupAdmin(page, app);
  const sole = await pageApi(page, 'POST', '/api/materials', { kind: 'sole', nameVi: 'VIP 1' });
  const o = await seedSampleOrder(page, { customer: 'chị Nga', price: 47000, soleId: sole.id });
  const sent = await pageApi(page, 'POST', `/api/orders/${o.id}/send-quote`, {});
  await pageApi(page, 'POST', `/api/public/quote/${sent.url.split('/q/')[1]}/accept`, { version: 1 });
  acceptedId = o.id;
});
afterAll(async () => { await done(); await closeBrowser(); await app.stop(); });

async function openSheet(id: string) {
  await page.goto(app.url + `/quan-ly#/orders/${id}/sheet`);
  await page.reload();
  await page.locator('.production-sheet').waitFor();
}

test("sheet for accepted sample order shows 1.410 đôi and contains no '₫' or '$'", async () => {
  await openSheet(acceptedId);
  const text = await page.locator('.production-sheet').innerText();
  expect(text).toContain('1.410 đôi');
  expect(text).toContain('chị Nga');
  expect(text).toContain('Đế: VIP 1');
  expect(text).toContain('Mẫu 9');
  expect(text).not.toContain('₫');
  expect(text).not.toContain('$');
  expect(text).not.toContain('47');
  expect(await page.locator('.sheet-page').count()).toBe(3);
});

test("sheet route for a Chờ báo giá order shows 'Đơn chưa chốt'", async () => {
  const o = await seedSampleOrder(page, { customer: 'anh Minh' });
  await page.goto(app.url + `/quan-ly#/orders/${o.id}/sheet`);
  await page.getByText('Đơn chưa chốt').waitFor();
  expect(await page.getByRole('button', { name: 'In phiếu' }).count()).toBe(0);
});

test('PNG export produces 3 images 1080 px wide', async () => {
  await openSheet(acceptedId);
  await page.getByRole('button', { name: 'Lưu ảnh để gửi Zalo' }).click();
  await page.waitForFunction(() => document.querySelectorAll('img.sheet-png').length === 3, null, { timeout: 15000 });
  const sizes = await page.$$eval('img.sheet-png', async (imgs) => {
    await Promise.all((imgs as HTMLImageElement[]).map((i) => i.decode()));
    return (imgs as HTMLImageElement[]).map((i) => [i.naturalWidth, i.naturalHeight]);
  });
  expect(sizes.map((s) => s[0])).toEqual([1080, 1080, 1080]);
  for (const [, h] of sizes) expect(h).toBeGreaterThan(1000);
});

test('print media emulation fits each page within A4', async () => {
  await openSheet(acceptedId);
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('.tabbar').isVisible()).toBe(false);
  await page.locator('.production-sheet img').first().evaluate((i: HTMLImageElement) => i.decode().catch(() => {}));
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  const counts = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/g)]
    .map((m) => Number(m[1] ?? m[2]));
  expect(Math.max(...counts)).toBe(3);
  await page.emulateMedia({ media: 'screen' });
});

test('Nam+Nữ per-size items with materials and notes are never clipped in print', async () => {
  const mk = async (kind: string, nameVi: string) => (await pageApi(page, 'POST', '/api/materials', { kind, nameVi })).id;
  const o = await seedSampleOrder(page, {
    customer: 'chị Lan', price: 47000, twoLines: true, counts: [30, 20, 10, 12, 14],
    soleId: await mk('sole', 'VIP 2'), strapId: await mk('strap', '15L'), styleId: await mk('style', 'Kẹp'), note: 'đen, quai bạc, in logo nhỏ',
  });
  const sent = await pageApi(page, 'POST', `/api/orders/${o.id}/send-quote`, {});
  await pageApi(page, 'POST', `/api/public/quote/${sent.url.split('/q/')[1]}/accept`, { version: 1 });
  await openSheet(o.id);
  await page.emulateMedia({ media: 'print' });
  const clipped = await page.$$eval('.sheet-item, .sheet-page', (els) => els.filter((e) => e.scrollHeight > e.clientHeight + 1).length);
  expect(clipped).toBe(0);
  const text = await page.locator('.production-sheet').innerText();
  for (let n = 1; n <= 5; n++) expect(text).toContain(`Mẫu ${n}`);
  const sheetPages = await page.locator('.sheet-page').count();
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  const counts = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/g)]
    .map((m) => Number(m[1] ?? m[2]));
  expect(Math.max(...counts)).toBe(sheetPages);
  await page.emulateMedia({ media: 'screen' });
});
