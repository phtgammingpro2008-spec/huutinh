import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, loginCookie } from '../helpers/http';
import { item, line, newCustomer, sampleOrder, saveOrder } from '../helpers/orders';
import type { Env, Stmt } from '../../src/worker/env';
import { foldSearch } from '../../src/shared/search';

let env: Env;
let c: string;
beforeEach(async () => { env = await createTestEnv(); c = await loginCookie(env); });

test('foldSearch lowercases and strips Vietnamese accents', () => {
  expect(foldSearch('Đức')).toBe('duc');
  expect(foldSearch('Ánh ĐỎ')).toBe('anh do');
  expect(foldSearch('chị Nga')).toBe('chi nga');
});

test('search finds Vietnamese names that start with capital accented letters', async () => {
  const duc = await newCustomer(env, c, { name: 'Đức' });
  await newCustomer(env, c, { name: 'Ánh' });
  for (const q of ['Đức', 'đức', 'duc', 'ĐỨC']) {
    expect((await call(env, 'GET', `/api/customers?q=${encodeURIComponent(q)}`, undefined, c)).body.map((x: any) => x.name)).toEqual(['Đức']);
  }
  const o = sampleOrder(duc.id);
  await saveOrder(env, c, o);
  expect((await call(env, 'GET', `/api/orders?q=${encodeURIComponent('Đức')}`, undefined, c)).body.map((x: any) => x.id)).toEqual([o.id]);
  // renamed customer stays searchable
  await call(env, 'PUT', `/api/customers/${duc.id}`, { name: 'Ông Đạt' }, c);
  expect((await call(env, 'GET', '/api/customers?q=dat', undefined, c)).body.map((x: any) => x.name)).toEqual(['Ông Đạt']);
});

test('design note search is accent and case insensitive', async () => {
  const cust = await newCustomer(env, c);
  const o = sampleOrder(cust.id, { items: [item(1)] });
  await saveOrder(env, c, o);
  await call(env, 'PUT', `/api/designs/${o.items[0].designId}`, { note: 'Kẹp ĐỎ bán chạy' }, c);
  for (const q of ['đỏ', 'ĐỎ', 'do ban']) {
    expect((await call(env, 'GET', `/api/designs?q=${encodeURIComponent(q)}`, undefined, c)).body).toHaveLength(1);
  }
});

/** Wraps the DB so batches containing an INSERT INTO quotes fail while `failQuotes` is on. */
function flakyQuotes(e: Env) {
  const state = { failQuotes: false };
  const db = e.DB;
  e.DB = {
    prepare: (sql: string) => db.prepare(sql),
    batch: async (stmts: Stmt[]) => {
      if (state.failQuotes && stmts.some((s) => String((s as any).sql).includes('INSERT INTO quotes'))) throw new Error('D1 error (simulated)');
      return db.batch(stmts);
    },
  };
  return state;
}

test('re-quote is atomic: a failed version write leaves the order untouched and a retry re-quotes', async () => {
  const cust = await newCustomer(env, c);
  const o = sampleOrder(cust.id);
  for (const i of o.items) i.lines[0].unitPrice = 47000;
  await saveOrder(env, c, o);
  await call(env, 'POST', `/api/orders/${o.id}/send-quote`, {}, c);
  const state = flakyQuotes(env);
  state.failQuotes = true;
  const edited = { ...o, items: o.items.map((i, k) => (k === 0 ? { ...i, lines: [{ ...i.lines[0], qtyEach: 90 }] } : i)) };
  const failed = await saveOrder(env, c, edited);
  expect(failed.status).toBe(500);
  const mid = (await call(env, 'GET', `/api/orders/${o.id}`, undefined, c)).body;
  expect(mid.items[0].lines[0].qtyEach).toBe(85); // nothing half-written
  expect(mid.quoteVersion).toBe(1);
  state.failQuotes = false;
  const ok = await saveOrder(env, c, edited);
  expect(ok.body.quoteVersion).toBe(2);
  expect(ok.body.status).toBe('da_bao_gia');
});

test('quote images are addressed by version, so a re-quote never shows a stale photo', async () => {
  const cust = await newCustomer(env, c);
  const up = async (b: number) => (await call(env, 'POST', '/api/images?w=1&h=1', new Uint8Array([0xff, 0xd8, b, 0xff, 0xd9]), c, { 'content-type': 'image/jpeg' })).body.key;
  const k1 = await up(1), k2 = await up(2);
  const o = sampleOrder(cust.id, { items: [item(1, { cropKey: k1, lines: [line({ qtyEach: 1, unitPrice: 1 })] }), item(2, { cropKey: k2, lines: [line({ qtyEach: 1, unitPrice: 1 })] })] });
  await saveOrder(env, c, o);
  const token = (await call(env, 'POST', `/api/orders/${o.id}/send-quote`, {}, c)).body.url.split('/q/')[1];
  await saveOrder(env, c, { ...o, items: [o.items[1]] }); // drop design 1 → version 2
  const bytes = async (p: string) => new Uint8Array(await (await call(env, 'GET', p)).raw.arrayBuffer())[2];
  expect(await bytes(`/q/${token}/img/1/0`)).toBe(1);
  expect(await bytes(`/q/${token}/img/2/0`)).toBe(2);
  const r = await call(env, 'GET', `/q/${token}/img/2/0`);
  expect(r.headers.get('cache-control')).toContain('immutable');
  expect((await call(env, 'GET', `/q/${token}/img/9/0`)).status).toBe(404);
});

test('changing currency while prices are set is refused', async () => {
  const cust = await newCustomer(env, c);
  const o = sampleOrder(cust.id);
  o.items[0].lines[0].unitPrice = 47000;
  await saveOrder(env, c, o);
  const r = await saveOrder(env, c, { ...o, currency: 'USD' });
  expect(r.status).toBe(400);
  expect(r.body.error).toBe('Đổi loại tiền thì phải xóa các đơn giá cũ trước');
  const cleared = { ...o, currency: 'USD' as const, items: o.items.map((i) => ({ ...i, lines: i.lines.map((l) => ({ ...l, unitPrice: null })) })) };
  expect((await saveOrder(env, c, cleared)).body.currency).toBe('USD');
});

test('dashboard still lists an old unpaid order after 500 newer orders', async () => {
  let t = Date.parse('2026-01-01T03:00:00Z');
  env = await createTestEnv({ now: () => new Date(t) });
  c = await loginCookie(env);
  const cust = await newCustomer(env, c);
  const old = sampleOrder(cust.id, { items: [item(1, { lines: [line({ qtyEach: 1, unitPrice: 1000 })] })] });
  await saveOrder(env, c, old);
  await env.DB.prepare("UPDATE orders SET status = 'dang_san_xuat', quote_version = 1 WHERE id = ?").bind(old.id).run();
  for (let i = 0; i < 501; i++) {
    t += 60_000;
    await saveOrder(env, c, sampleOrder(cust.id, { items: [item(1, { lines: [line({ qtyEach: 1 })] })] }));
  }
  const d = (await call(env, 'GET', '/api/dashboard', undefined, c)).body;
  expect(d.unpaid.map((x: any) => x.id)).toEqual([old.id]);
  expect(d.unpaid[0].due).toBe(6000);
  expect(d.waitingQuote.length).toBe(501);
}, 60_000);
