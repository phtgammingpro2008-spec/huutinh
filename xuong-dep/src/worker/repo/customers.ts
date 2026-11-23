import type { Currency, Lang } from '../../shared/types';
import { foldSearch } from '../../shared/search';
import type { Env } from '../env';

export type Customer = {
  id: string; name: string; zalo: string; messenger: string; country: string;
  lang: Lang; currency: Currency; note: string; createdAt: string;
};

type Row = { id: string; name: string; zalo: string; messenger: string; country: string; lang: Lang; currency: Currency; note: string; created_at: string };

const map = (r: Row): Customer => ({
  id: r.id, name: r.name, zalo: r.zalo, messenger: r.messenger, country: r.country,
  lang: r.lang, currency: r.currency, note: r.note, createdAt: r.created_at,
});

export async function listCustomers(env: Env, q = ''): Promise<Customer[]> {
  const folded = foldSearch(q);
  const r = await env.DB.prepare(
    "SELECT * FROM customers WHERE (?1 = '' OR name_search LIKE '%' || ?1 || '%' OR zalo LIKE '%' || ?2 || '%') ORDER BY name_search LIMIT 500",
  ).bind(folded, q.trim()).all<Row>();
  return r.results.map(map);
}

export async function getCustomer(env: Env, id: string): Promise<Customer | null> {
  const r = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first<Row>();
  return r ? map(r) : null;
}

export async function insertCustomer(env: Env, c: Customer): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO customers (id, name, name_search, zalo, messenger, country, lang, currency, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(c.id, c.name, foldSearch(c.name), c.zalo, c.messenger, c.country, c.lang, c.currency, c.note, c.createdAt).run();
}

export async function updateCustomer(env: Env, c: Customer): Promise<void> {
  await env.DB.prepare(
    'UPDATE customers SET name = ?, name_search = ?, zalo = ?, messenger = ?, country = ?, lang = ?, currency = ?, note = ? WHERE id = ?',
  ).bind(c.name, foldSearch(c.name), c.zalo, c.messenger, c.country, c.lang, c.currency, c.note, c.id).run();
}
