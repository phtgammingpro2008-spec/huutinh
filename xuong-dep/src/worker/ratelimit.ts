import type { Env } from './env';
import { now } from './http';

/** Fixed-window counter in D1. */
async function read(env: Env, key: string, windowSec: number): Promise<number> {
  const t = Math.floor(now(env).getTime() / 1000);
  const r = await env.DB.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?').bind(key).first<{ window_start: number; count: number }>();
  return r && t - r.window_start < windowSec ? r.count : 0;
}

/** True when `key` has already been hit `max` times in the current window (does not count this call). */
export async function isLimited(env: Env, key: string, max: number, windowSec: number): Promise<boolean> {
  return (await read(env, key, windowSec)) >= max;
}

/** Counts one hit. */
export async function bump(env: Env, key: string, windowSec: number): Promise<void> {
  const t = Math.floor(now(env).getTime() / 1000);
  await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN ?2 - window_start >= ?3 THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN ?2 - window_start >= ?3 THEN ?2 ELSE window_start END`,
  ).bind(key, t, windowSec).run();
}

/** Counts one hit and reports whether the limit is now exceeded. */
export async function hitLimit(env: Env, key: string, max: number, windowSec: number): Promise<boolean> {
  await bump(env, key, windowSec);
  return (await read(env, key, windowSec)) > max;
}

export const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') ?? 'local';
