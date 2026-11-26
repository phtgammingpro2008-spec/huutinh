import { normalizeEmail, phoneCandidates } from '../../shared/phone';
import type { Env } from '../env';

export type UserRow = {
  id: string; name: string; password_hash: string; role: 'admin' | 'staff' | 'worker' | 'customer'; phone: string | null; email: string | null;
  email_verified_at: string | null; customer_id: string | null; locked: number; created_at: string;
};

/** Finds a user by email, phone (any VN/KH reading) or admin name. */
export async function findByIdentifier(env: Env, id: string): Promise<UserRow | null> {
  const raw = id.trim();
  if (!raw) return null;
  if (raw.includes('@')) {
    const e = normalizeEmail(raw);
    return e ? env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(e).first<UserRow>() : null;
  }
  const phones = phoneCandidates(raw);
  if (phones.length) {
    const r = await env.DB.prepare('SELECT * FROM users WHERE phone IN (SELECT value FROM json_each(?)) LIMIT 1')
      .bind(JSON.stringify(phones)).first<UserRow>();
    if (r) return r;
  }
  return env.DB.prepare("SELECT * FROM users WHERE name = ? AND role IN ('admin', 'staff', 'worker')").bind(raw).first<UserRow>();
}

export const getUser = (env: Env, id: string) => env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();

export async function deleteSessionsOf(env: Env, userId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}
