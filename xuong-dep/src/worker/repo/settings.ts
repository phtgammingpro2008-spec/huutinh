import type { Lang, LineSetting } from '../../shared/types';
import type { Env } from '../env';

export type Settings = { lines: LineSetting[]; quoteMessage: Record<Lang, string> };

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
  };
}
