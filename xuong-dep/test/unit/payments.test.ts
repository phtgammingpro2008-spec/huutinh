import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, loginCookie } from '../helpers/http';
import { newCustomer, sampleOrder, saveOrder } from '../helpers/orders';
import type { Env } from '../../src/worker/env';
import type { OrderInput } from '../../src/shared/types';

let env: Env;
let c: string;
let o: OrderInput;
beforeEach(async () => {
  env = await createTestEnv({ now: () => new Date('2026-11-22T03:00:00Z') });
  c = await loginCookie(env);
  const cust = await newCustomer(env, c);
  o = sampleOrder(cust.id);
  for (const i of o.items) i.lines[0].unitPrice = 47000;
  await saveOrder(env, c, o);
});

const status = (to: string) => call(env, 'POST', `/api/orders/${o.id}/status`, { to }, c);
const quoteAndAccept = async () => {
  const url = (await call(env, 'POST', `/api/orders/${o.id}/send-quote`, {}, c)).body.url as string;
  await call(env, 'POST', `/api/public/quote/${url.split('/q/')[1]}/accept`, { version: 1 });
};

test('illegal transition hoan_tat → cho_bao_gia rejected', async () => {
  await quoteAndAccept();
  for (const s of ['dang_san_xuat', 'da_giao', 'hoan_tat']) expect((await status(s)).status).toBe(200);
  const r = await status('cho_bao_gia');
  expect(r.status).toBe(409);
  expect(typeof r.body.error).toBe('string');
  expect((await status('da_huy')).status).toBe(409);
});

test('cancel from da_bao_gia allowed', async () => {
  await call(env, 'POST', `/api/orders/${o.id}/send-quote`, {}, c);
  const r = await status('da_huy');
  expect(r.status).toBe(200);
  expect(r.body.status).toBe('da_huy');
});

test('cannot skip the quote or set da_bao_gia by hand', async () => {
  expect((await status('dang_san_xuat')).status).toBe(409); // never quoted
  expect((await status('da_bao_gia')).status).toBe(409); // use send-quote
  expect((await status('bogus')).status).toBe(400);
});

test('manual "customer agreed" on a sent quote marks it accepted', async () => {
  await call(env, 'POST', `/api/orders/${o.id}/send-quote`, {}, c);
  const r = await status('khach_dong_y');
  expect(r.status).toBe(200);
  expect(r.body.acceptedAt).toBe('2026-11-22T03:00:00.000Z');
  const q = await env.DB.prepare('SELECT accepted_at FROM quotes WHERE order_id = ?').bind(o.id).first<{ accepted_at: string }>();
  expect(q!.accepted_at).toBe('2026-11-22T03:00:00.000Z');
});

test('two payments reduce due', async () => {
  const p1 = await call(env, 'POST', `/api/orders/${o.id}/payments`, { amount: 20_000_000, paidOn: '2026-11-22', note: 'cọc' }, c);
  expect(p1.status).toBe(200);
  expect(p1.body.paid).toBe(20_000_000);
  expect(p1.body.due).toBe(46_270_000);
  const p2 = await call(env, 'POST', `/api/orders/${o.id}/payments`, { amount: 50_000_000, note: 'thanh toán đủ' }, c);
  expect(p2.body.paid).toBe(70_000_000);
  expect(p2.body.due).toBe(0);
  expect(p2.body.payments.map((p: any) => p.note)).toEqual(['cọc', 'thanh toán đủ']);
  expect(p2.body.payments[1].paidOn).toBe('2026-11-22');
  const del = await call(env, 'DELETE', `/api/orders/${o.id}/payments/${p2.body.payments[1].id}`, undefined, c);
  expect(del.body.due).toBe(46_270_000);
});

test('payment validation', async () => {
  expect((await call(env, 'POST', `/api/orders/${o.id}/payments`, { amount: 0 }, c)).status).toBe(400);
  expect((await call(env, 'POST', `/api/orders/${o.id}/payments`, { amount: 5, paidOn: '22/11' }, c)).status).toBe(400);
  expect((await call(env, 'POST', `/api/orders/nope/payments`, { amount: 5 }, c)).status).toBe(404);
});

test('export contains orders and designs and is attachment', async () => {
  await call(env, 'POST', `/api/orders/${o.id}/payments`, { amount: 1 }, c);
  const r = await call(env, 'GET', '/api/export', undefined, c);
  expect(r.status).toBe(200);
  expect(r.headers.get('content-disposition')).toBe('attachment; filename="xuong-dep-backup-2026-11-22.json"');
  expect(r.body.orders).toHaveLength(1);
  expect(r.body.designs).toHaveLength(9);
  expect(r.body.item_lines).toHaveLength(9);
  expect(r.body.payments).toHaveLength(1);
  expect(r.body.sessions).toBeUndefined();
  expect(r.body.users[0].password_hash).toBeUndefined();
  expect((await call(env, 'GET', '/api/export')).status).toBe(401);
});
