import type { Lang, LineSetting } from '../../shared/types';
import type { Env } from '../env';

/** minOrderPairs: the wholesale minimum for orders customers place themselves (the workshop's own orders are free). */
export type Settings = { lines: LineSetting[]; quoteMessage: Record<Lang, string>; minOrderPairs: number };
export const DEFAULT_MIN_ORDER_PAIRS = 10;

export async function getSetting<T>(env: Env, key: string, fallback: T): Promise<T> {
  const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  if (!r) return fallback;
  try { return JSON.parse(r.value) as T; } catch { return fallback; }
}

export function setSettingStmt(env: Env, key: string, value: unknown) {
  return env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, JSON.stringify(value));
}

export async function getSettings(env: Env): Promise<Settings> {
  return {
    lines: await getSetting<LineSetting[]>(env, 'lines', []),
    quoteMessage: await getSetting<Record<Lang, string>>(env, 'quote_message', { vi: '{url}', en: '{url}', km: '{url}' }),
    minOrderPairs: await getSetting<number>(env, 'min_order_pairs', DEFAULT_MIN_ORDER_PAIRS),
  };
}
