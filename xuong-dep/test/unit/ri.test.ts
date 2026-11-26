import { expect, test } from 'bun:test';
import { newBagCode, normalizeBagCode, orderedRi, pairsOf } from '../../src/shared/ri';
import { createTestEnv } from '../helpers/env';
import { item, line } from '../helpers/orders';

test('even Nam line 10 per size = 10 ri, 60 pairs', () => {
  expect(orderedRi([item(1, { lines: [line({ lineKey: 'nam', sizeFrom: 39, sizeTo: 44, qtyEach: 10 })] })]).nam)
    .toEqual({ pairs: 60, perRi: 6, ri: 10 });
});

test('two items on the same line add up; per-size entry gives fractional ri', () => {
  const r = orderedRi([
    item(1, { lines: [line({ lineKey: 'nu', sizeFrom: 36, sizeTo: 40, qtyEach: 4 })] }),
    item(2, { lines: [line({ lineKey: 'nu', sizeFrom: 36, sizeTo: 40, mode: 'per_size', perSize: { 36: 3, 37: 3, 38: 2 } })] }),
  ]);
  expect(r.nu).toEqual({ pairs: 28, perRi: 5, ri: 5.6 });
});

test('pairsOf multiplies each ri by the pairs of its line', () => {
  expect(pairsOf({ nam: 12, nu: 8 }, { nam: 6, nu: 5 })).toBe(112);
});

test('bag codes are random, readable and forgiving when typed', () => {
  const c = newBagCode();
  expect(c).toMatch(/^HLX-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
  expect(new Set(Array.from({ length: 200 }, newBagCode)).size).toBe(200);
  expect(normalizeBagCode(' hlx 7k2q9 4xmab ')).toBe('HLX-7K2Q9-4XMAB');
  expect(normalizeBagCode('7K2Q94XMAB')).toBe('HLX-7K2Q9-4XMAB');
  expect(normalizeBagCode('HLX-7K2Q9-4XMA0')).toBeNull(); // 0 is not in the alphabet
  expect(normalizeBagCode('HLX-7K2Q9')).toBeNull();
});

test('bag history cannot be edited or deleted', async () => {
  const env = await createTestEnv();
  const at = new Date().toISOString();
  await env.DB.prepare("INSERT INTO users (id, name, password_hash, role, created_at) VALUES ('u1', 'tho', 'x', 'worker', ?)").bind(at).run();
  await env.DB.prepare("INSERT INTO customers (id, name, name_search, zalo, messenger, country, lang, currency, note, created_at) VALUES ('c1', 'K', 'k', '', '', 'KH', 'vi', 'USD', '', ?)").bind(at).run();
  await env.DB.prepare("INSERT INTO orders (id, code, customer_id, status, currency, created_at, updated_at) VALUES ('o1', 'DH1', 'c1', 'dang_san_xuat', 'USD', ?, ?)").bind(at, at).run();
  await env.DB.prepare("INSERT INTO bags (id, code, order_id, seq, created_by, created_at, updated_at) VALUES ('b1', 'HLX-22222-22222', 'o1', 1, 'u1', ?, ?)").bind(at, at).run();
  await env.DB.prepare("INSERT INTO bag_events (id, bag_id, kind, user_id, at) VALUES ('e1', 'b1', 'pack', 'u1', ?)").bind(at).run();
  expect(env.DB.prepare("UPDATE bag_events SET kind = 'x' WHERE id = 'e1'").run()).rejects.toThrow(/append-only/);
  expect(env.DB.prepare("DELETE FROM bag_events WHERE id = 'e1'").run()).rejects.toThrow(/append-only/);
});
