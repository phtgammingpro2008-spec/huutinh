import { afterAll, beforeAll, expect, test } from 'bun:test';
import { ADMIN, closeBrowser, getBrowser, startApp, type App } from './helpers';

let app: App;
let owner = '';
let orderId = '';
const j = { 'content-type': 'application/json' };
const api = async (cookie: string, method: string, path: string, body?: unknown) =>
  (await fetch(app.url + path, { method, headers: { ...j, cookie }, body: body === undefined ? undefined : JSON.stringify(body) })).json();

beforeAll(async () => {
  app = await startApp();
  await fetch(app.url + '/api/setup', { method: 'POST', headers: j, body: JSON.stringify(ADMIN) });
  const login = await fetch(app.url + '/api/login', { method: 'POST', headers: j, body: JSON.stringify(ADMIN) });
  owner = (login.headers.get('set-cookie') ?? '').split(';')[0];
  await api(owner, 'POST', '/api/staff', { name: 'tho1', password: 'mat-khau-tho-1', role: 'worker' });
  const cust = await api(owner, 'POST', '/api/customers', { name: 'Chị Lan', zalo: '012345678' });
  orderId = crypto.randomUUID();
  const line = (lineKey: string, sizeFrom: number, sizeTo: number, qtyEach: number) => ({ id: crypto.randomUUID(), lineKey, sizeFrom, sizeTo, mode: 'even', qtyEach, perSize: {}, unitPrice: 500 });
  await api(owner, 'PUT', `/api/orders/${orderId}`, {
    id: orderId, customerId: cust.id, currency: 'USD', neededBy: null, note: '', allowPublic: false, images: [],
    items: [{ id: crypto.randomUUID(), designId: crypto.randomUUID(), imageId: null, tagNo: 1, tapX: null, tapY: null, crop: null, cropKey: `img/2026/11/${crypto.randomUUID()}.jpg`,
      soleId: null, strapId: null, styleId: null, colorNote: '', lines: [line('nam', 39, 44, 4)] }],
  });
  // accepted by chat: the owner records it (quote sent first)
  await api(owner, 'POST', `/api/orders/${orderId}/send-quote`, {});
  await api(owner, 'POST', `/api/orders/${orderId}/status`, { to: 'khach_dong_y' });
});
afterAll(async () => { await closeBrowser(); await app.stop(); });

const ctxOf = async () => (await getBrowser()).newContext({ viewport: { width: 390, height: 844 }, locale: 'vi-VN' });

test('a bag goes from the workshop to the customer, scanned at every step', async () => {
  // ---- workshop hand: pack two bags, labels, load, depart
  const wctx = await ctxOf();
  const w = await wctx.newPage();
  await w.goto(app.url + '/dang-nhap');
  await w.getByLabel('Số điện thoại hoặc email').fill('tho1');
  await w.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-tho-1');
  await w.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await w.waitForURL(/\/kho/);
  await w.getByRole('link', { name: /Đóng bao/ }).click();
  const toa = await (await fetch(app.url + `/api/orders/${orderId}`, { headers: { cookie: owner } })).json();
  await w.getByRole('button', { name: new RegExp(toa.code) }).click();
  await w.getByLabel(/^Số ri Nam/).fill('3');
  await w.getByRole('button', { name: /Tạo bao và in tem/ }).click();
  await w.getByText(/Bao số 1/).first().waitFor();
  expect(await w.locator('.kho-label svg').count()).toBe(1);
  expect(await w.locator('.kho-label').first().textContent()).not.toContain(toa.code);
  // printing shows the labels only
  await w.emulateMedia({ media: 'print' });
  expect(await w.locator('.kho-label').first().isVisible()).toBe(true);
  expect(await w.getByRole('button', { name: /In tem/ }).isVisible()).toBe(false);
  await w.emulateMedia({ media: 'screen' });
  await w.getByRole('link', { name: /Đóng tiếp/ }).click();
  await w.getByLabel(/^Số ri Nam/).fill('1');
  await w.getByRole('button', { name: /Tạo bao và in tem/ }).click();
  await w.getByText(/Bao số 2/).first().waitFor();
  const codes = (await (await fetch(app.url + `/api/orders/${orderId}`, { headers: { cookie: owner } })).json()).shipping.list.map((b: { code: string }) => b.code);
  expect(codes).toHaveLength(2);

  await w.goto(app.url + '/kho#/chuyen');
  await w.getByRole('button', { name: /Mở chuyến mới/ }).click();
  for (const c of codes) {
    await w.getByLabel(/Mã bao/).fill(c);
    await w.getByLabel(/Mã bao/).press('Enter');
  }
  await w.getByText(/2 bao/).first().waitFor();
  await w.getByRole('button', { name: /Cho xe chạy/ }).click();
  await w.getByRole('button', { name: /Đúng, cho xe chạy/ }).click();
  await w.getByText(/Đang chạy/).first().waitFor();
  await wctx.close();

  // ---- owner in Cambodia: receive one, close, receive the late one, stock, deliver
  const octx = await ctxOf();
  await octx.addCookies([{ name: owner.split('=')[0], value: owner.split('=')[1], url: app.url }]);
  const o = await octx.newPage();
  await o.goto(app.url + '/kho#/chuyen');
  await o.getByRole('link', { name: /Đang chạy/ }).first().click();
  await o.getByLabel(/Mã bao/).fill(codes[0]);
  await o.getByLabel(/Mã bao/).press('Enter');
  await o.getByText(/1 \/ 2/).waitFor();
  await o.getByRole('button', { name: /Chốt nhận chuyến/ }).click();
  await o.getByRole('button', { name: /Đúng, chốt/ }).click();
  await o.getByText(codes[1]).first().waitFor(); // listed as missing
  await o.getByLabel(/Mã bao/).fill(codes[1]);
  await o.getByLabel(/Mã bao/).press('Enter');
  await o.getByText(/2 \/ 2/).waitFor();

  await o.goto(app.url + '/kho#/kho-cam');
  await o.getByRole('button', { name: /Nhập kho/ }).first().click();
  await o.getByRole('button', { name: /Nhập kho/ }).first().click();
  await o.getByText(/Trong kho/).first().waitFor();
  await o.getByRole('link', { name: /Giao/ }).first().click();
  await o.getByRole('button', { name: /Xác nhận đã giao/ }).click();
  await o.getByText(/Đã giao 2 bao/).waitFor();
  const after = await (await fetch(app.url + `/api/orders/${orderId}`, { headers: { cookie: owner } })).json();
  expect(after.status).toBe('da_giao');
  // the owner's order page keeps its shipping section after a status change
  await o.goto(app.url + `/quan-ly#/orders/${orderId}`);
  await o.getByRole('region', { name: 'Vận chuyển' }).waitFor();
  await o.getByRole('button', { name: /Hoàn tất/ }).click();
  await o.getByText('Hoàn tất').first().waitFor();
  await o.waitForTimeout(300);
  expect(await o.getByRole('region', { name: 'Vận chuyển' }).count()).toBe(1);
  await octx.close();
});

test('the customer sees how much of the toa was sent and what is still missing', async () => {
  const reg = await fetch(app.url + '/api/register', { method: 'POST', headers: j, body: JSON.stringify({ name: 'Chị Ngọc', phone: '0908765411', email: 'ngoc@example.com', password: 'mat-khau-ngoc-1', country: 'KH', lang: 'vi' }) });
  const cust = (reg.headers.get('set-cookie') ?? '').split(';')[0];
  const me = await api(cust, 'GET', '/api/me');
  const id = crypto.randomUUID();
  await api(owner, 'PUT', `/api/orders/${id}`, {
    id, customerId: me.customerId, currency: 'USD', neededBy: null, note: '', allowPublic: false, images: [],
    items: [{ id: crypto.randomUUID(), designId: crypto.randomUUID(), imageId: null, tagNo: 1, tapX: null, tapY: null, crop: null, cropKey: `img/2026/11/${crypto.randomUUID()}.jpg`,
      soleId: null, strapId: null, styleId: null, colorNote: '', lines: [{ id: crypto.randomUUID(), lineKey: 'nam', sizeFrom: 39, sizeTo: 44, mode: 'even', qtyEach: 10, perSize: {}, unitPrice: 500 }] }],
  });
  await api(owner, 'POST', `/api/orders/${id}/send-quote`, {});
  await api(owner, 'POST', `/api/orders/${id}/status`, { to: 'khach_dong_y' });
  const bag = await api(owner, 'POST', '/api/kho/bags', { orderId: id, ri: { nam: 4 } });
  const trip = await api(owner, 'POST', '/api/kho/trips', {});
  await api(owner, 'POST', `/api/kho/trips/${trip.id}/load`, { code: bag.code });
  await api(owner, 'POST', `/api/kho/trips/${trip.id}/depart`, {});

  const ctx = await ctxOf();
  await ctx.addCookies([{ name: cust.split('=')[0], value: cust.split('=')[1], url: app.url }]);
  const p = await ctx.newPage();
  await p.goto(app.url + `/tai-khoan#/don/${id}`);
  const goods = p.getByRole('region', { name: 'Hàng của bạn' });
  await goods.waitFor();
  expect(await goods.textContent()).toContain('Đã gửi 4 / 10 ri');
  expect(await goods.textContent()).toContain('Còn thiếu 10 ri');
  expect(await goods.textContent()).toContain('1 đang trên xe');
  expect(await goods.textContent()).not.toContain(bag.code);
  await ctx.close();
});
