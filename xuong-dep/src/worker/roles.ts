import { COOKIE } from './auth';
import type { Env } from './env';
import { err, getCookie, now } from './http';
import type { Handler } from './router';

export type Role = 'admin' | 'customer';
export type SessionUser = { id: string; role: Role; customerId: string | null; name: string };

/** The logged-in, unlocked user of this request, or null. */
export async function currentUser(req: Request, env: Env): Promise<SessionUser | null> {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  const r = await env.DB.prepare(
    `SELECT u.id, u.role, u.customer_id, u.name, u.locked, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
  ).bind(token).first<{ id: string; role: Role; customer_id: string | null; name: string; locked: number; expires_at: string }>();
  if (!r || r.locked || r.expires_at <= now(env).toISOString()) return null;
  return { id: r.id, role: r.role, customerId: r.customer_id, name: r.name };
}

export const ADMIN_ONLY = Symbol.for('xuong-dep.adminOnly');
export type MarkedHandler = Handler & { [ADMIN_ONLY]?: true };

/** Admin only. A customer gets the same 404 as an unknown route, so admin endpoints are not revealed. */
export function requireAdmin(h: Handler): Handler {
  const wrapped: MarkedHandler = async (req, env, p, ctx) => {
    const user = await currentUser(req, env);
    if (!user) return err(401, 'Chưa đăng nhập');
    if (user.role !== 'admin') return err(404, 'Không tìm thấy');
    return h(req, env, p, { ...ctx, userId: user.id, user });
  };
  wrapped[ADMIN_ONLY] = true;
  return wrapped;
}

/** Customer only (an account linked to a customer profile). */
export function requireCustomer(h: Handler): Handler {
  return async (req, env, p, ctx) => {
    const user = await currentUser(req, env);
    if (!user) return err(401, 'Chưa đăng nhập');
    if (user.role !== 'customer' || !user.customerId) return err(403, 'Chỉ dành cho tài khoản khách');
    return h(req, env, p, { ...ctx, userId: user.id, user });
  };
}
