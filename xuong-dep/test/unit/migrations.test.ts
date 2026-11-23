import { expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';

const cols = async (env: Awaited<ReturnType<typeof createTestEnv>>, table: string) =>
  (await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()).results.map((c) => c.name);

test('migrations apply on top of schema.sql', async () => {
  const env = await createTestEnv();
  expect(await cols(env, 'users')).toEqual(expect.arrayContaining(['phone', 'email', 'email_verified_at', 'customer_id', 'locked']));
  expect(await cols(env, 'orders')).toEqual(expect.arrayContaining(['source', 'seen_by_admin', 'deliver_note', 'cancel_reason', 'cancelled_by']));
  expect(await cols(env, 'designs')).toEqual(expect.arrayContaining(['is_private', 'hidden', 'has_brand_logo', 'source']));
  expect(await cols(env, 'order_items')).toEqual(expect.arrayContaining(['product_id', 'color_id', 'is_private']));
  for (const t of ['products', 'product_colors', 'collections', 'collection_products', 'posters', 'uploads', 'user_tokens', 'rate_limits']) {
    expect((await cols(env, t)).length).toBeGreaterThan(1);
  }
});

test('users.phone and users.email are unique when set, multiple NULLs allowed', async () => {
  const env = await createTestEnv();
  const ins = (id: string, name: string, phone: string | null, email: string | null) =>
    env.DB.prepare("INSERT INTO users (id, name, password_hash, role, phone, email) VALUES (?, ?, 'x', 'customer', ?, ?)").bind(id, name, phone, email).run();
  await ins('a', 'a', null, null);
  await ins('b', 'b', null, null);
  await ins('c', 'c', '0901234567', 'c@x.vn');
  await expect(ins('d', 'd', '0901234567', null)).rejects.toThrow();
  await expect(ins('e', 'e', null, 'c@x.vn')).rejects.toThrow();
});

test('shop setting seeded', async () => {
  const env = await createTestEnv();
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'shop'").first<{ value: string }>();
  expect(JSON.parse(r!.value)).toEqual({ zalo: '', messenger: '', workshopAddress: '', warehouseAddress: '' });
});

test('products slug unique', async () => {
  const env = await createTestEnv();
  const ins = (id: string) => env.DB.prepare("INSERT INTO products (id, slug, name_vi, created_at) VALUES (?, 'dep-kep', 'Dép kẹp', '2026-01-01')").bind(id).run();
  await ins('p1');
  await expect(ins('p2')).rejects.toThrow();
});
