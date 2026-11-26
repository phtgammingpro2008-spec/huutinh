import { beforeEach, expect, test } from 'bun:test';
import type { Env } from '../../src/worker/env';
import { setSettingStmt } from '../../src/worker/repo/settings';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';
import { item, line, sampleOrder } from '../helpers/orders';

let env: Env;
let owner: string, worker: string, staff: string;
let tg: string[];

/** An accepted order: 10 ri Nam (60 pairs) + 12 ri Nữ (60 pairs). */
async function acceptedOrder(status = 'khach_dong_y') {
  const cust = (await call(env, 'POST', '/api/customers', { name: 'Chị Lan', zalo: '012345678' }, owner)).body;
  const o = sampleOrder(cust.id, {
    items: [
      item(1, { lines: [line({ lineKey: 'nam', sizeFrom: 39, sizeTo: 44, qtyEach: 10 })] }),
      item(2, { lines: [line({ lineKey: 'nu', sizeFrom: 36, sizeTo: 40, qtyEach: 12 })] }),
    ],
  });
  await call(env, 'PUT', `/api/orders/${o.id}`, o, owner);
  await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, o.id).run();
  return o.id;
}
const pack = (orderId: string, ri: Record<string, number>, extra: Record<string, unknown> = {}, who = worker) =>
  call(env, 'POST', '/api/kho/bags', { orderId, ri, ...extra }, who);

beforeEach(async () => {
  env = await createTestEnv();
  owner = await loginCookie(env);
  for (const [name, role] of [['tho1', 'worker'], ['hao', 'staff']]) {
    await call(env, 'POST', '/api/staff', { name, password: 'mat-khau-123456', role }, owner);
  }
  worker = cookieFrom(await call(env, 'POST', '/api/login', { id: 'tho1', password: 'mat-khau-123456' }));
  staff = cookieFrom(await call(env, 'POST', '/api/login', { id: 'hao', password: 'mat-khau-123456' }));
  tg = [];
  env.TELEGRAM_FAKE = async (_t, method, body) => { if (method === 'sendMessage') tg.push(String(body.text)); return { ok: true, result: {} }; };
  await setSettingStmt(env, 'telegram', { token: '1:x', chatId: '9', bot: 'b' }).run();
});

test('packing a bag: seq, pairs, order moves to production, one pack event', async () => {
  const id = await acceptedOrder();
  const r = await pack(id, { nam: 6, nu: 4 });
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ seq: 1, ri: { nam: 6, nu: 4 }, pairs: 56, status: 'da_dong', over: false });
  expect(r.body.code).toMatch(/^HLX-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
  expect(r.body.events.map((e: { kind: string }) => e.kind)).toEqual(['pack']);
  expect((await call(env, 'GET', `/api/orders/${id}`, undefined, owner)).body.status).toBe('dang_san_xuat');
  expect((await pack(id, { nam: 1 })).body.seq).toBe(2);
});

test('the toa list for a worker carries progress but no customer data', async () => {
  const id = await acceptedOrder();
  await pack(id, { nam: 6, nu: 4 });
  const r = await call(env, 'GET', '/api/kho/toa', undefined, worker);
  expect(r.status).toBe(200);
  const t = r.body.find((x: { id: string }) => x.id === id);
  expect(t.bags).toBe(1);
  const nam = t.lines.find((l: { key: string }) => l.key === 'nam');
  expect(nam).toMatchObject({ perRi: 6, orderedRi: 10, orderedPairs: 60, packedRi: 6 });
  const raw = JSON.stringify(r.body);
  for (const leak of ['Chị Lan', '012345678', 'customer', 'deliverNote', 'unitPrice', 'price']) expect(raw).not.toContain(leak);
});

test('over-packing needs confirmation and is flagged', async () => {
  const id = await acceptedOrder();
  await pack(id, { nam: 6 });
  const r = await pack(id, { nam: 5 });
  expect(r.status).toBe(409);
  expect(r.body).toMatchObject({ code: 'over', overRi: { nam: 1 } });
  const ok = await pack(id, { nam: 5 }, { confirmOver: true });
  expect(ok.status).toBe(200);
  expect(ok.body.over).toBe(true);
});

test('empty bags are refused; a bag of only accompanying goods is fine', async () => {
  const id = await acceptedOrder();
  expect((await pack(id, { nam: 0 })).status).toBe(400);
  const r = await pack(id, {}, { extraNote: '2 đôi mẫu quai mới', extraPairs: 2 });
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ pairs: 0, extraNote: '2 đôi mẫu quai mới', extraPairs: 2 });
  expect((await pack(id, { nam: -1 })).status).toBe(400);
  expect((await pack(id, { khac: 2 })).status).toBe(400); // not a line of this order
});

test('only accepted or in-production orders can be packed', async () => {
  for (const s of ['cho_bao_gia', 'da_huy', 'hoan_tat', 'da_giao']) {
    const id = await acceptedOrder(s);
    const r = await pack(id, { nam: 1 });
    expect([s, r.status, r.body.code]).toEqual([s, 409, 'not_packable']);
  }
});

test('loading a trip: double scans are one event, other trips refused, unload before departure, depart', async () => {
  const id = await acceptedOrder();
  const a = (await pack(id, { nam: 6 })).body, b = (await pack(id, { nu: 4 })).body;
  const t1 = (await call(env, 'POST', '/api/kho/trips', {}, worker)).body;
  expect(t1).toMatchObject({ status: 'dang_xep' });
  expect(t1.code).toMatch(/^C\d{6}-\d+$/);
  const t2 = (await call(env, 'POST', '/api/kho/trips', {}, worker)).body;
  expect(t2.code).not.toBe(t1.code);
  await call(env, 'POST', `/api/kho/trips/${t1.id}/load`, { code: a.code }, worker);
  const again = await call(env, 'POST', `/api/kho/trips/${t1.id}/load`, { code: a.code.toLowerCase().replace(/-/g, ' ') }, worker);
  expect(again.status).toBe(200);
  expect(again.body.counts.total).toBe(1);
  const bag = (await call(env, 'GET', `/api/kho/bags/${a.code}`, undefined, worker)).body;
  expect(bag.events.filter((e: { kind: string }) => e.kind === 'load')).toHaveLength(1);
  const other = await call(env, 'POST', `/api/kho/trips/${t2.id}/load`, { code: a.code }, worker);
  expect([other.status, other.body.code]).toEqual([409, 'on_other_trip']);
  await call(env, 'POST', `/api/kho/trips/${t1.id}/load`, { code: b.code }, worker);
  expect((await call(env, 'POST', `/api/kho/trips/${t1.id}/unload`, { code: b.code }, worker)).body.counts.total).toBe(1);
  await call(env, 'POST', `/api/kho/trips/${t1.id}/load`, { code: b.code }, worker);
  const dep = await call(env, 'POST', `/api/kho/trips/${t1.id}/depart`, {}, worker);
  expect(dep.body.status).toBe('dang_chay');
  expect(dep.body.bags.map((x: { status: string }) => x.status)).toEqual(['tren_xe', 'tren_xe']);
  expect(tg.at(-1)).toContain(`Chuyến ${t1.code} chạy: 2 bao, 1 toa`);
  const c = (await pack(id, { nam: 1 })).body;
  expect((await call(env, 'POST', `/api/kho/trips/${t1.id}/load`, { code: c.code }, worker)).body.code).toBe('trip_closed');
  expect((await call(env, 'POST', `/api/kho/trips/${t1.id}/unload`, { code: a.code }, worker)).body.code).toBe('trip_closed');
});

test('bag lookup forgives typing, hides the customer from workers, shows it to managers', async () => {
  const id = await acceptedOrder();
  const a = (await pack(id, { nam: 6 })).body;
  const typed = a.code.slice(4).replace('-', ' ').toLowerCase();
  const w = await call(env, 'GET', `/api/kho/bags/${encodeURIComponent(typed)}`, undefined, worker);
  expect(w.status).toBe(200);
  expect(w.body.order.customerName).toBeUndefined();
  expect(JSON.stringify(w.body)).not.toContain('Chị Lan');
  const s = await call(env, 'GET', `/api/kho/bags/${a.code}`, undefined, staff);
  expect(s.body.order.customerName).toBe('Chị Lan');
  const none = await call(env, 'GET', '/api/kho/bags/HLX-22222-22222', undefined, worker);
  expect(none.status).toBe(404);
  expect(none.body.error).toContain('Không có bao này');
  expect((await call(env, 'POST', `/api/kho/bags/${a.code}/reprint`, {}, worker)).body.events.map((e: { kind: string }) => e.kind)).toEqual(['pack', 'reprint']);
});

/** Two bags of one order on one departed trip. */
async function onTheRoad() {
  const id = await acceptedOrder();
  const a = (await pack(id, { nam: 10, nu: 6 })).body, b = (await pack(id, { nu: 6 })).body;
  const t = (await call(env, 'POST', '/api/kho/trips', {}, worker)).body;
  for (const x of [a, b]) await call(env, 'POST', `/api/kho/trips/${t.id}/load`, { code: x.code }, worker);
  await call(env, 'POST', `/api/kho/trips/${t.id}/depart`, {}, worker);
  return { id, a, b, t };
}

test('receiving needs a manager; a bag of another trip is refused with that trip named', async () => {
  const { a, t } = await onTheRoad();
  for (const [m, path, body] of [['POST', `/api/kho/trips/${t.id}/receive`, { code: a.code }], ['POST', `/api/kho/trips/${t.id}/close`, {}], ['POST', '/api/kho/deliver', { codes: [a.code] }]] as const) {
    expect([path, (await call(env, m, path, body, worker)).status]).toEqual([path, 403]);
  }
  const id2 = await acceptedOrder();
  const c = (await pack(id2, { nam: 1 })).body;
  const t2 = (await call(env, 'POST', '/api/kho/trips', {}, worker)).body;
  await call(env, 'POST', `/api/kho/trips/${t2.id}/load`, { code: c.code }, worker);
  await call(env, 'POST', `/api/kho/trips/${t2.id}/depart`, {}, worker);
  const wrong = await call(env, 'POST', `/api/kho/trips/${t.id}/receive`, { code: c.code }, staff);
  expect([wrong.status, wrong.body.code]).toEqual([409, 'other_trip']);
  expect(wrong.body.error).toContain(t2.code);
});

test('closing a receipt marks unscanned bags missing; a late scan brings one back', async () => {
  const { a, b, t } = await onTheRoad();
  const r1 = await call(env, 'POST', `/api/kho/trips/${t.id}/receive`, { code: a.code }, staff);
  expect(r1.body.counts).toMatchObject({ total: 2, received: 1, missing: 0 });
  await call(env, 'POST', `/api/kho/trips/${t.id}/receive`, { code: a.code }, staff); // twice
  const closed = await call(env, 'POST', `/api/kho/trips/${t.id}/close`, {}, staff);
  expect(closed.body.status).toBe('da_toi');
  expect(closed.body.counts).toMatchObject({ total: 2, received: 1, missing: 1 });
  expect(tg.at(-1)).toContain(`nhận 1/2, thiếu ${b.code}`);
  const late = await call(env, 'POST', `/api/kho/trips/${t.id}/receive`, { code: b.code }, staff);
  expect(late.body.counts).toMatchObject({ received: 2, missing: 0 });
  const kinds = (await call(env, 'GET', `/api/kho/bags/${b.code}`, undefined, staff)).body.events.map((e: { kind: string }) => e.kind);
  expect(kinds).toEqual(['pack', 'load', 'depart', 'missing', 'receive']);
  const aEvents = (await call(env, 'GET', `/api/kho/bags/${a.code}`, undefined, staff)).body.events;
  expect(aEvents.filter((e: { kind: string }) => e.kind === 'receive')).toHaveLength(1);
});

test('stock and delivery: all-or-nothing, a fully delivered order becomes da_giao', async () => {
  const { id, a, b, t } = await onTheRoad();
  await call(env, 'POST', `/api/kho/trips/${t.id}/receive`, { code: a.code }, staff);
  expect((await call(env, 'POST', `/api/kho/bags/${a.code}/stock`, {}, staff)).body.status).toBe('trong_kho');
  // b is still on the truck: nothing is delivered
  const bad = await call(env, 'POST', '/api/kho/deliver', { codes: [a.code, b.code] }, staff);
  expect([bad.status, bad.body.code]).toEqual([409, 'not_arrived']);
  expect((await call(env, 'GET', `/api/kho/bags/${a.code}`, undefined, staff)).body.status).toBe('trong_kho');
  await call(env, 'POST', `/api/kho/trips/${t.id}/receive`, { code: b.code }, staff);
  const ok = await call(env, 'POST', '/api/kho/deliver', { codes: [a.code, b.code], note: 'giao bến xe Siem Reap' }, staff);
  expect(ok.status).toBe(200);
  expect((await call(env, 'GET', `/api/orders/${id}`, undefined, owner)).body.status).toBe('da_giao');
  expect(tg.at(-1)).toContain('đã giao đủ');
});

test('corrections are the owner\'s alone and keep the old values in history', async () => {
  const id = await acceptedOrder();
  const a = (await pack(id, { nam: 6 })).body;
  for (const [path, body] of [[`/api/kho/bags/${a.code}/ri`, { ri: { nam: 5 } }], [`/api/kho/bags/${a.code}/flag`, { kind: 'hu_hong', note: 'ướt' }], [`/api/kho/bags/${a.code}/cancel`, {}]] as const) {
    expect([path, (await call(env, 'POST', path, body, staff)).status]).toEqual([path, 403]);
  }
  const e = await call(env, 'POST', `/api/kho/bags/${a.code}/ri`, { ri: { nam: 5 } }, owner);
  expect(e.body).toMatchObject({ ri: { nam: 5 }, pairs: 30 });
  expect(e.body.events.at(-1)).toMatchObject({ kind: 'edit_ri', data: { from: { nam: 6 }, to: { nam: 5 } } });
  const f = await call(env, 'POST', `/api/kho/bags/${a.code}/flag`, { kind: 'hu_hong', note: 'ướt' }, owner);
  expect(f.body.status).toBe('hu_hong');
  const b = (await pack(id, { nam: 1 })).body;
  expect((await call(env, 'POST', `/api/kho/bags/${b.code}/cancel`, {}, owner)).body.status).toBe('da_huy');
  const c = (await pack(id, { nam: 1 })).body;
  expect(c.seq).toBe(3); // numbers are never reused
  const t = (await call(env, 'POST', '/api/kho/trips', {}, worker)).body;
  await call(env, 'POST', `/api/kho/trips/${t.id}/load`, { code: c.code }, worker);
  expect((await call(env, 'POST', `/api/kho/bags/${c.code}/cancel`, {}, owner)).status).toBe(409);
});

test('order pages: the owner sees bag codes, the customer sees progress without codes and problems as "kiem_tra"', async () => {
  // a customer-placed order so the customer can read it
  const reg = await call(env, 'POST', '/api/register', { name: 'Khách Ngọc', phone: '0908765499', email: 'ngoc@k.vn', password: 'mat-khau-123', country: 'KH', lang: 'vi' });
  const cust = cookieFrom(reg);
  const customerId = (await call(env, 'GET', '/api/me', undefined, cust)).body.customerId;
  const o = sampleOrder(customerId, { items: [item(1, { lines: [line({ lineKey: 'nam', sizeFrom: 39, sizeTo: 44, qtyEach: 10 })] })] });
  await call(env, 'PUT', `/api/orders/${o.id}`, o, owner);
  await env.DB.prepare("UPDATE orders SET status = 'khach_dong_y' WHERE id = ?").bind(o.id).run();
  const a = (await pack(o.id, { nam: 6 })).body, b = (await pack(o.id, { nam: 4 }, { extraNote: '2 đôi mẫu' })).body;
  const t = (await call(env, 'POST', '/api/kho/trips', {}, worker)).body;
  for (const x of [a, b]) await call(env, 'POST', `/api/kho/trips/${t.id}/load`, { code: x.code }, worker);
  await call(env, 'POST', `/api/kho/trips/${t.id}/depart`, {}, worker);
  await call(env, 'POST', `/api/kho/trips/${t.id}/receive`, { code: a.code }, staff);
  await call(env, 'POST', `/api/kho/trips/${t.id}/close`, {}, staff);

  const adm = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, owner)).body.shipping;
  expect(adm.list.map((x: { code: string }) => x.code)).toEqual([a.code, b.code]);
  expect(adm.lines[0]).toMatchObject({ key: 'nam', orderedRi: 10, packedRi: 10, sentRi: 10, deliveredRi: 0 });

  const mine = (await call(env, 'GET', `/api/c/orders/${o.id}`, undefined, cust)).body.shipping;
  expect(JSON.stringify(mine)).not.toContain(a.code);
  expect(mine.byStatus).toEqual({ da_toi: 1, kiem_tra: 1 });
  expect(mine.extra).toEqual(['2 đôi mẫu']);
  expect(mine.lines[0]).toMatchObject({ orderedRi: 10, sentRi: 10, deliveredRi: 0 });

  const dash = (await call(env, 'GET', '/api/dashboard', undefined, owner)).body.kho;
  expect(dash).toEqual({ running: 0, missingTrips: 1, inCam: 1 });
});

test('reopening a delivered order is the owner\'s call', async () => {
  const id = await acceptedOrder('da_giao');
  expect((await call(env, 'POST', `/api/orders/${id}/status`, { to: 'dang_san_xuat' }, staff)).status).toBe(403);
  await env.DB.prepare('UPDATE orders SET quote_version = 1 WHERE id = ?').bind(id).run();
  expect((await call(env, 'POST', `/api/orders/${id}/status`, { to: 'dang_san_xuat' }, owner)).body.status).toBe('dang_san_xuat');
});
