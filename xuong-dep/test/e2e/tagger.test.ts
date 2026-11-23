import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { closeBrowser, phone, setupAdmin, startApp, type App } from './helpers';

const FIX = join(import.meta.dir, '../fixtures');
let app: App;
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await closeBrowser(); await app.stop(); });

async function openWithPhoto(files: string[]) {
  const { ctx, page } = await phone();
  await setupAdmin(page, app);
  await page.goto(app.url + '/quan-ly#/orders/new');
  await page.getByLabel('Chọn ảnh').setInputFiles(files.map((f) => join(FIX, f)));
  return { ctx, page };
}

/** Taps at a fraction of the first photo. */
async function tapAt(page: Page, fx: number, fy: number, index = 0) {
  const img = page.locator('.tagger img').nth(index);
  await img.waitFor();
  const b = (await img.boundingBox())!;
  await page.touchscreen.tap(b.x + b.width * fx, b.y + b.height * fy);
}

test('tap on image adds tag 1 with a box', async () => {
  const { ctx, page } = await openWithPhoto(['grid-3000x2000.jpg']);
  await tapAt(page, 0.15, 0.25);
  await expect(page.locator('.tagger .tag').count()).resolves.toBe(1);
  expect(await page.locator('.tagger .tag').first().textContent()).toBe('1');
  expect(await page.locator('.tagger .box').count()).toBe(1);
  await ctx.close();
});

test('tap on tag 1 label selects it, no duplicate tag is created', async () => {
  const { ctx, page } = await openWithPhoto(['grid-3000x2000.jpg']);
  await tapAt(page, 0.15, 0.25);
  await tapAt(page, 0.5, 0.25);
  expect(await page.locator('.tagger .tag').count()).toBe(2);
  expect(await page.locator('.tagger .tag.sel').textContent()).toBe('2');
  await tapAt(page, 0.152, 0.255); // on (near) the label of tag 1
  expect(await page.locator('.tagger .tag').count()).toBe(2);
  expect(await page.locator('.tagger .tag.sel').textContent()).toBe('1');
  await ctx.close();
});

test("'Cả ảnh là 1 mẫu' creates one tag with full box", async () => {
  const { ctx, page } = await openWithPhoto(['grid-3000x2000.jpg']);
  await page.locator('.tagger img').waitFor();
  await page.getByRole('button', { name: 'Cả ảnh là 1 mẫu' }).click();
  expect(await page.locator('.tagger .tag').count()).toBe(1);
  const style = await page.locator('.tagger .box').getAttribute('style');
  expect(style).toContain('left: 0%');
  expect(style).toContain('top: 0%');
  expect(style).toContain('width: 100%');
  expect(style).toContain('height: 100%');
  await ctx.close();
});

test('dragging a corner handle resizes the box', async () => {
  const { ctx, page } = await openWithPhoto(['grid-3000x2000.jpg']);
  await tapAt(page, 0.5, 0.5);
  // like a person would: bring the corner into the clear middle of the screen (fixed bars cover the edges)
  await page.locator('.tagger .handle[data-corner="se"]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const before = (await page.locator('.tagger .box').boundingBox())!;
  const h = (await page.locator('.tagger .handle[data-corner="se"]').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 40, h.y + h.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  const after = (await page.locator('.tagger .box').boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 30);
  expect(after.height).toBeGreaterThan(before.height + 20);
  expect(await page.locator('.tagger .tag').count()).toBe(1);
  await ctx.close();
});

test("selecting the corrupt file shows 'Không đọc được ảnh này' and the other photo still loads", async () => {
  const { ctx, page } = await openWithPhoto(['corrupt.jpg', 'grid-3000x2000.jpg']);
  await page.getByText('Không đọc được ảnh này: corrupt.jpg').waitFor();
  await page.locator('.tagger img').waitFor();
  expect(await page.locator('.tagger').count()).toBe(1);
  await ctx.close();
});

test('uploaded original long edge is 2000 px', async () => {
  const { ctx, page } = await openWithPhoto(['grid-3000x2000.jpg']);
  const tagger = page.locator('.tagger[data-key]');
  await tagger.waitFor({ timeout: 20000 });
  const key = await tagger.getAttribute('data-key');
  const size = await page.evaluate(async (k) => {
    const blob = await (await fetch('/' + k)).blob();
    const bmp = await createImageBitmap(blob);
    return [bmp.width, bmp.height, blob.type];
  }, key);
  expect(size).toEqual([2000, 1333, 'image/jpeg']);
  await ctx.close();
});
