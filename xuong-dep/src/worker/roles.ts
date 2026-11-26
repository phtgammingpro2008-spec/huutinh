import { COOKIE } from './auth';
import type { Env } from './env';
import { err, getCookie, now } from './http';
import type { Handler } from './router';

/** admin: the owner (first account). staff: a manager with the daily work but not the owner's settings.
 * worker: a workshop hand (tài khoản Xưởng) who only packs bags and loads trucks in /kho. */
export type Role = 'admin' | 'staff' | 'worker' | 'customer';
export const isWorkshop = (role: string | undefined) => role === 'admin' || role === 'staff';
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

/** Workshop accounts (owner and managers). A customer gets the same 404 as an unknown route, so these endpoints are not revealed. */
export function requireAdmin(h: Handler): Handler {
  const wrapped: MarkedHandler = async (req, env, p, ctx) => {
    const user = await currentUser(req, env);
    if (!user) return err(401, 'Chưa đăng nhập');
    if (!isWorkshop(user.role)) return err(404, 'Không tìm thấy');
    return h(req, env, p, { ...ctx, userId: user.id, user });
  };
  wrapped[ADMIN_ONLY] = true;
  return wrapped;
}

/** The owner only: settings, accounts, Telegram, contact info, backups. A manager is told so; a customer still sees 404. */
export function requireOwner(h: Handler): Handler {
  return requireAdmin(async (req, env, p, ctx) => {
    if (ctx.user!.role !== 'admin') return err(403, 'Chỉ tài khoản chủ xưởng làm được việc này');
    return h(req, env, p, ctx);
  });
}

const KHO_RANK: Record<string, number> = { worker: 1, staff: 2, admin: 3 };
const BELOW: Record<'staff' | 'admin', string> = {
  staff: 'Tài khoản Xưởng không làm được việc này · គណនីរោងចក្រមិនអាចធ្វើការនេះបានទេ',
  admin: 'Chỉ tài khoản chủ xưởng làm được việc này · មានតែម្ចាស់ទេដែលអាចធ្វើការនេះបាន',
};
/** Warehouse routes (/api/kho): worker level admits workers, managers and the owner; staff level managers and the owner; admin level the owner.
 * Customers get the 404 of an unknown route; a workshop account below the level is told why. */
export function requireKho(level: 'worker' | 'staff' | 'admin', h: Handler): Handler {
  return async (req, env, p, ctx) => {
    const user = await currentUser(req, env);
    if (!user) return err(401, 'Chưa đăng nhập');
    const rank = KHO_RANK[user.role] ?? 0;
    if (!rank) return err(404, 'Không tìm thấy');
    if (rank < KHO_RANK[level]) return err(403, BELOW[level as 'staff' | 'admin']);
    return h(req, env, p, { ...ctx, userId: user.id, user });
  };
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
