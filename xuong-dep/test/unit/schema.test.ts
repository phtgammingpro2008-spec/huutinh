import { expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqliteDb } from '../../dev/d1-sqlite';
import { fsBucket } from '../../dev/r2-fs';
import { createTestEnv } from '../helpers/env';
import type { LineSetting } from '../../src/shared/types';

test('schema applies to empty sqlite', async () => {
  const env = await createTestEnv();
  const r = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all<{ name: string }>();
  const names = r.results.map((x) => x.name);
  for (const t of ['users', 'sessions', 'customers', 'materials', 'settings', 'orders', 'order_images',
    'designs', 'order_items', 'item_lines', 'quotes', 'payments']) expect(names).toContain(t);
});

test('default lines setting is Nam 39–44 and Nữ 35–40', async () => {
  const env = await createTestEnv();
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('lines').first<{ value: string }>();
  const lines = JSON.parse(row!.value) as LineSetting[];
  expect(lines).toEqual([
    { key: 'nam', label: { vi: 'Nam', en: 'Men', km: 'បុរស' }, sizeFrom: 39, sizeTo: 44 },
    { key: 'nu', label: { vi: 'Nữ', en: 'Women', km: 'នារី' }, sizeFrom: 35, sizeTo: 40 },
  ]);
  const msg = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('quote_message').first<{ value: string }>();
  const m = JSON.parse(msg!.value);
  expect(Object.keys(m).sort()).toEqual(['en', 'km', 'vi']);
  expect(m.vi).toContain('{url}');
});

test('batch rolls back on error', async () => {
  const env = await createTestEnv();
  const ins = (id: string) => env.DB.prepare("INSERT INTO users (id, name, password_hash, role) VALUES (?, ?, 'x', 'admin')").bind(id, 'a');
  await expect(env.DB.batch([ins('u1'), ins('u1')])).rejects.toThrow();
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  expect(row!.n).toBe(0);
});

test('first returns null when no row, all returns results array, bind accepts null', async () => {
  const db = sqliteDb(':memory:');
  await db.prepare('CREATE TABLE t (a TEXT, b INTEGER)').run();
  expect(await db.prepare('SELECT * FROM t').first()).toBeNull();
  await db.prepare('INSERT INTO t VALUES (?, ?)').bind(null, 2).run();
  const r = await db.prepare('SELECT * FROM t').all<{ a: string | null; b: number }>();
  expect(r.results).toEqual([{ a: null, b: 2 }]);
});

test('fsBucket put/get round-trips bytes and contentType', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'r2-'));
  const b = fsBucket(dir);
  const bytes = new Uint8Array([1, 2, 3, 250]);
  await b.put('img/2026/11/a.jpg', bytes.buffer, { httpMetadata: { contentType: 'image/jpeg' } });
  const got = await b.get('img/2026/11/a.jpg');
  expect(new Uint8Array(await got!.arrayBuffer())).toEqual(bytes);
  expect(got!.httpMetadata?.contentType).toBe('image/jpeg');
  expect(await b.get('missing')).toBeNull();
  await b.delete('img/2026/11/a.jpg');
  expect(await b.get('img/2026/11/a.jpg')).toBeNull();
});
