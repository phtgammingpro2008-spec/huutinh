import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { closeBrowser, pageApi, phone, setupAdmin, startApp, type App } from './helpers';

const FIX = join(import.meta.dir, '../fixtures');
const COUNTS = [85, 25, 18, 20, 17, 13, 25, 14, 18];
const SPOTS: [number, number][] = [
  [0.15, 0.15], [0.5, 0.15], [0.85, 0.15], [0.15, 0.5], [0.5, 0.5], [0.85, 0.5], [0.15, 0.85], [0.5, 0.85], [0.85, 0.85],
];

let app: App;
let page: Page;
let ctxClose: () => Promise<void>;
beforeAll(async () => {
  app = await startApp();
  const p = await phone();
  page = p.page;
  ctxClose = () => p.ctx.close();
  await setupAdmin(page, app);
});
afterAll(async () => { await ctxClose(); await closeBrowser(); await app.stop(); });

async function openNew(qs = '') {
  await page.goto(app.url + '/#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(app.url + '/#/orders/new' + qs);
  await page.getByRole('heading', { name: 'Đơn mới' }).waitFor();
}

async function newCustomer(name: string) {
  await page.getByRole('button', { name: '+ Khách mới' }).click();
  await page.getByLabel('Tên khách mới').fill(name);
  await page.getByRole('button', { name: 'Thêm khách' }).click();
  await page.getByText(`Khách: ${name}`).waitFor();
}

async function addPhoto() {
  await page.getByLabel('Chọn ảnh').setInputFiles(join(FIX, 'grid-3000x2000.jpg'));
  await page.locator('.tagger img').first().waitFor();
}

async function tap(fx: number, fy: number) {
  const img = page.locator('.tagger img').first();
  await img.scrollIntoViewIfNeeded();
  const b = (await img.boundingBox())!;
  await page.touchscreen.tap(b.x + b.width * fx, b.y + b.height * fy);
}

const item = (n: number) => page.getByRole('region', { name: `Mẫu ${n}`, exact: true });
const totals = () => page.locator('.totals-bar .sum').textContent();

test("enter the sample order (9 tags, Nam 39–44, counts 85…18) shows 'Tổng: 1.410 đôi' and saves with status Chờ báo giá", async () => {
  await openNew();
  await newCustomer('chị Nga');
  await addPhoto();
  for (let i = 0; i < 9; i++) {
    await tap(...SPOTS[i]);
    await item(i + 1).getByLabel('Số đôi mỗi size – Nam').fill(String(COUNTS[i]));
  }
  expect(await page.locator('.tagger .tag').count()).toBe(9);
  expect(await totals()).toBe('Tổng: 1.410 đôi');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForURL(/#\/orders\/[0-9a-f-]{36}$/);
  const id = page.url().split('/').pop()!;
  const o = await pageApi(page, 'GET', `/api/orders/${id}`);
  expect(o.status).toBe('cho_bao_gia');
  expect(o.totals.qty).toBe(1410);
  expect(o.customer.name).toBe('chị Nga');
  expect(o.items).toHaveLength(9);
  expect(o.images).toHaveLength(1);
  expect(o.items.every((i: any) => i.cropKey.startsWith('img/'))).toBe(true);
  expect(o.items[0].lines[0]).toMatchObject({ lineKey: 'nam', sizeFrom: 39, sizeTo: 44, mode: 'even', qtyEach: 85 });
  // the draft is cleared after a successful save
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('draft:')))).toEqual([]);
});

test("nam+nữ 30/30 'Đều mỗi size' on one item shows 360 đôi with default ranges; 'Tổng số đôi' mode shows 60 đôi", async () => {
  await openNew();
  await addPhoto();
  await page.getByRole('button', { name: 'Cả ảnh là 1 mẫu' }).click();
  await item(1).getByLabel('Số đôi mỗi size – Nam').fill('30');
  await item(1).getByRole('button', { name: '+ Dòng Nữ' }).click();
  await item(1).getByLabel('Số đôi mỗi size – Nữ').fill('30');
  expect(await item(1).getByLabel('Size từ – Nữ').inputValue()).toBe('35');
  expect(await item(1).getByLabel('Size đến – Nữ').inputValue()).toBe('40');
  expect(await totals()).toBe('Tổng: 360 đôi');
  for (const l of ['Nam', 'Nữ']) {
    await item(1).getByRole('group', { name: `Cách nhập – ${l}` }).getByRole('button', { name: 'Tổng số đôi' }).click();
  }
  expect(await item(1).getByLabel('Tổng số đôi – Nam').inputValue()).toBe('30');
  expect(await totals()).toBe('Tổng: 60 đôi');
});

test('per-size mode keeps typed counts when the range changes', async () => {
  await openNew();
  await addPhoto();
  await page.getByRole('button', { name: 'Cả ảnh là 1 mẫu' }).click();
  await item(1).getByRole('group', { name: 'Cách nhập – Nam' }).getByRole('button', { name: 'Từng size' }).click();
  await item(1).getByLabel('Size 39 – Nam').fill('5');
  await item(1).getByLabel('Size 40 – Nam').fill('6');
  expect(await totals()).toBe('Tổng: 11 đôi');
  await item(1).getByLabel('Size từ – Nam').fill('38');
  await item(1).getByLabel('Size từ – Nam').blur();
  expect(await item(1).getByLabel('Size 38 – Nam').inputValue()).toBe('0');
  expect(await item(1).getByLabel('Size 39 – Nam').inputValue()).toBe('5');
  expect(await totals()).toBe('Tổng: 11 đôi');
});

test('reload mid-entry offers the draft and restores tags and counts', async () => {
  await openNew();
  await newCustomer('anh Tuấn');
  await addPhoto();
  await page.locator('.tagger[data-key]').waitFor({ timeout: 20000 });
  await tap(0.15, 0.15);
  await item(1).getByLabel('Số đôi mỗi size – Nam').fill('12');
  await tap(0.5, 0.15);
  await item(2).getByLabel('Số đôi mỗi size – Nam').fill('7');
  await page.waitForTimeout(900);
  await page.reload();
  await page.getByText('Tiếp tục đơn đang nhập dở?').waitFor();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.locator('.tagger img').first().waitFor();
  expect(await page.locator('.tagger .tag').count()).toBe(2);
  expect(await item(1).getByLabel('Số đôi mỗi size – Nam').inputValue()).toBe('12');
  expect(await item(2).getByLabel('Số đôi mỗi size – Nam').inputValue()).toBe('7');
  await page.getByText('Khách: anh Tuấn').waitFor();
  expect(await totals()).toBe('Tổng: 114 đôi');
});

async function makeLibraryDesign(): Promise<string> {
  return page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 40; c.height = 40;
    const g = c.getContext('2d')!; g.fillStyle = '#3a72c4'; g.fillRect(0, 0, 40, 40);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg'));
    const up = await (await fetch('/api/images?w=40&h=40', { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg' } })).json();
    const designId = crypto.randomUUID();
    await fetch('/api/library', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ images: [], items: [{ id: crypto.randomUUID(), designId, imageId: null, tagNo: 1, tapX: null, tapY: null, crop: null, cropKey: up.key, soleId: null, strapId: null, styleId: null, colorNote: 'mẫu xanh', lines: [] }] }),
    });
    return designId;
  });
}

test('item from library adds without uploading a photo', async () => {
  const designId = await makeLibraryDesign();
  await openNew();
  await newCustomer('chị Lan');
  let uploads = 0;
  const count = (r: any) => { if (r.url().includes('/api/images')) uploads++; };
  page.on('request', count);
  await page.getByRole('button', { name: '+ Mẫu từ thư viện' }).click();
  await page.locator(`[data-design-id="${designId}"]`).click();
  await item(1).getByLabel('Số đôi mỗi size – Nam').fill('10');
  expect(await totals()).toBe('Tổng: 60 đôi');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForURL(/#\/orders\/[0-9a-f-]{36}$/);
  page.off('request', count);
  expect(uploads).toBe(0);
  const o = await pageApi(page, 'GET', `/api/orders/${page.url().split('/').pop()}`);
  expect(o.items[0].designId).toBe(designId);
  expect(o.images).toEqual([]);
});

test('library-only mode creates designs and no order', async () => {
  const before = (await pageApi(page, 'GET', '/api/orders')).length;
  const designsBefore = (await pageApi(page, 'GET', '/api/designs')).length;
  await openNew();
  await page.getByLabel('Chỉ lưu vào thư viện (không tạo đơn)').check();
  await addPhoto();
  await tap(0.15, 0.15);
  await tap(0.5, 0.5);
  await page.getByRole('button', { name: 'Lưu vào thư viện' }).click();
  await page.waitForURL(/#\/library$/);
  expect((await pageApi(page, 'GET', '/api/designs')).length).toBe(designsBefore + 2);
  expect((await pageApi(page, 'GET', '/api/orders')).length).toBe(before);
});

test('save without a customer shows a clear message', async () => {
  await openNew();
  await addPhoto();
  await page.getByRole('button', { name: 'Cả ảnh là 1 mẫu' }).click();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.getByText('Chọn khách trước khi lưu').waitFor();
});
