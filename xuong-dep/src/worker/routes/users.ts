import { uiT } from '../../shared/i18n-ui';
import { normalizeEmail } from '../../shared/phone';
import { foldSearch } from '../../shared/search';
import { LANGS, type Lang } from '../../shared/types';
import { hashPassword, verifyPassword } from '../auth';
import { emailFor, sendEmail } from '../email';
import type { Env } from '../env';
import { err, json, newId, newToken, now, nowIso, readJson, str } from '../http';
import { hitLimit } from '../ratelimit';
import { deleteSessionsOf, getUser } from '../repo/users';
import { requireCustomer, requireOwner } from '../roles';
import type { Router } from '../router';

const baseUrl = (env: Env, req: Request) => (env.APP_URL || new URL(req.url).origin).replace(/\/+$/, '');

export async function createToken(env: Env, userId: string, kind: 'reset' | 'verify', ttlMs: number): Promise<string> {
  const token = newToken(43);
  await env.DB.prepare('INSERT INTO user_tokens (token, user_id, kind, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, kind, new Date(now(env).getTime() + ttlMs).toISOString()).run();
  return token;
}

/** Marks a valid, unused, unexpired token used and returns its user id (atomic: a token works once). */
async function consumeToken(env: Env, token: unknown, kind: 'reset' | 'verify'): Promise<string | null> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{30,}$/.test(token)) return null;
  const at = nowIso(env);
  const res = await env.DB.prepare('UPDATE user_tokens SET used_at = ? WHERE token = ? AND kind = ? AND used_at IS NULL AND expires_at > ?')
    .bind(at, token, kind, at).run() as { meta?: { changes?: number }; changes?: number };
  // Only the call whose UPDATE actually changed the row may use the token (D1: meta.changes; bun:sqlite: changes).
  if ((res.meta?.changes ?? res.changes ?? 0) !== 1) return null;
  const r = await env.DB.prepare('SELECT user_id FROM user_tokens WHERE token = ?').bind(token).first<{ user_id: string }>();
  return r?.user_id ?? null;
}

export async function sendVerifyEmail(env: Env, req: Request, userId: string, email: string, lang: Lang): Promise<void> {
  const token = await createToken(env, userId, 'verify', 7 * 86400_000);
  const m = emailFor('verify', lang, `${baseUrl(env, req)}/api/email/verify?token=${token}`);
  await sendEmail(env, email, m.subject, m.html).catch((e) => console.error(e));
}

const langOf = (v: unknown): Lang => (LANGS.includes(v as Lang) ? (v as Lang) : 'vi');

export function userRoutes(r: Router) {
  r.on('GET', '/api/email/verify', async (req, env) => {
    const userId = await consumeToken(env, new URL(req.url).searchParams.get('token'), 'verify');
    if (userId) await env.DB.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').bind(nowIso(env), userId).run();
    return new Response(null, { status: 302, headers: { location: `/tai-khoan#/ho-so?verified=${userId ? 1 : 0}` } });
  });

  r.on('POST', '/api/email/resend', requireCustomer(async (req, env, _p, ctx) => {
    const u = (await getUser(env, ctx.user!.id))!;
    if (u.email_verified_at || !u.email) return json({ ok: true });
    if (await hitLimit(env, `verify:${u.id}`, 3, 3600)) return err(429, uiT('vi', 'err.too_many'));
    const c = await env.DB.prepare('SELECT lang FROM customers WHERE id = ?').bind(u.customer_id).first<{ lang: Lang }>();
    await sendVerifyEmail(env, req, u.id, u.email, c?.lang ?? 'vi');
    return json({ ok: true });
  }));

  r.on('POST', '/api/password/forgot', async (req, env) => {
    const b = await readJson(req);
    const email = normalizeEmail(String(b.email ?? ''));
    // Always the same answer, so nobody can probe which emails have accounts.
    if (email && !(await hitLimit(env, `forgot:${email}`, 3, 3600))) {
      const u = await env.DB.prepare('SELECT id, email_verified_at, locked FROM users WHERE email = ?').bind(email)
        .first<{ id: string; email_verified_at: string | null; locked: number }>();
      if (u?.email_verified_at && !u.locked) {
        const token = await createToken(env, u.id, 'reset', 3600_000);
        const m = emailFor('reset', langOf(b.lang), `${baseUrl(env, req)}/dat-lai-mat-khau?token=${token}`);
        await sendEmail(env, email, m.subject, m.html).catch((e) => console.error(e));
      }
    }
    return json({ ok: true });
  });

  r.on('POST', '/api/password/reset', async (req, env) => {
    const b = await readJson(req);
    const lang = langOf(b.lang);
    const password = typeof b.password === 'string' ? b.password : '';
    if (password.length < 8 || password.length > 200) return json({ error: uiT(lang, 'err.weak_password'), code: 'weak_password', field: 'password' }, 400);
    const userId = await consumeToken(env, b.token, 'reset');
    if (!userId) return json({ error: uiT(lang, 'err.bad_token'), code: 'bad_token' }, 400);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), userId).run();
    await deleteSessionsOf(env, userId);
    return json({ ok: true });
  });

  r.on('POST', '/api/password/change', requireCustomer(async (req, env, _p, ctx) => {
    const b = await readJson(req);
    const u = (await getUser(env, ctx.user!.id))!;
    if (!(await verifyPassword(String(b.current ?? ''), u.password_hash))) return json({ error: uiT('vi', 'err.wrong_password'), code: 'wrong_password', field: 'current' }, 400);
    const password = typeof b.password === 'string' ? b.password : '';
    if (password.length < 8) return json({ error: uiT('vi', 'err.weak_password'), code: 'weak_password', field: 'password' }, 400);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), u.id).run();
    return json({ ok: true });
  }));

  /** Name and language of the signed-in customer (the customer record the workshop also sees). */
  r.on('PUT', '/api/c/profile', requireCustomer(async (req, env, _p, ctx) => {
    const b = await readJson(req);
    const c = (await env.DB.prepare('SELECT name, lang FROM customers WHERE id = ?').bind(ctx.user!.customerId).first<{ name: string; lang: Lang }>())!;
    const name = b.name === undefined ? c.name : str(b.name, 100);
    if (!name) return json({ error: uiT(c.lang, 'err.bad_name'), code: 'bad_name', field: 'name' }, 400);
    if (b.lang !== undefined && !LANGS.includes(b.lang)) return err(400, 'Ngôn ngữ không hợp lệ');
    const lang: Lang = b.lang ?? c.lang;
    await env.DB.prepare('UPDATE customers SET name = ?, name_search = ?, lang = ? WHERE id = ?')
      .bind(name, foldSearch(name), lang, ctx.user!.customerId).run();
    return json({ name, lang });
  }));

  // ---- admin: user management ----
  r.on('GET', '/api/users', requireOwner(async (req, env) => {
    const q = foldSearch(new URL(req.url).searchParams.get('q') ?? '');
    const rows = (await env.DB.prepare(
      `SELECT u.id, u.phone, u.email, u.email_verified_at, u.locked, u.created_at, u.customer_id, c.name,
         (SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.customer_id) AS order_count
       FROM users u JOIN customers c ON c.id = u.customer_id
       WHERE u.role = 'customer' AND (?1 = '' OR c.name_search LIKE '%' || ?1 || '%' OR u.phone LIKE '%' || ?1 || '%' OR u.email LIKE '%' || ?1 || '%')
       ORDER BY u.created_at DESC LIMIT 500`,
    ).bind(q).all<any>()).results;
    return json(rows.map((r) => ({
      id: r.id, name: r.name, phone: r.phone, email: r.email, emailVerified: !!r.email_verified_at, locked: !!r.locked,
      createdAt: r.created_at, customerId: r.customer_id, orderCount: r.order_count,
    })));
  }));

  const setLocked = (locked: boolean) => requireOwner(async (_req, env, p) => {
    const u = await getUser(env, p.id);
    if (!u || u.role !== 'customer') return err(404, 'Không tìm thấy người dùng');
    await env.DB.prepare('UPDATE users SET locked = ? WHERE id = ?').bind(locked ? 1 : 0, u.id).run();
    if (locked) await deleteSessionsOf(env, u.id);
    return json({ ok: true, locked });
  });
  r.on('POST', '/api/users/:id/lock', setLocked(true));
  r.on('POST', '/api/users/:id/unlock', setLocked(false));

  // ---- owner: manager accounts (role staff), signed in with a login name like the owner's ----
  const STAFF_NAME = /^(?=.*[a-z])[a-z0-9._-]{3,30}$/;
  const staffRow = (r: any) => ({ id: r.id, name: r.name, locked: !!r.locked, createdAt: r.created_at });
  const getStaff = async (env: Env, id: string) => {
    const u = await getUser(env, id);
    return u && u.role === 'staff' ? u : null;
  };
  r.on('GET', '/api/staff', requireOwner(async (_req, env) => {
    const rows = (await env.DB.prepare("SELECT id, name, locked, created_at FROM users WHERE role = 'staff' ORDER BY created_at").all<any>()).results;
    return json(rows.map(staffRow));
  }));
  r.on('POST', '/api/staff', requireOwner(async (req, env) => {
    const b = await readJson(req);
    const name = str(b.name, 40).toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    if (!STAFF_NAME.test(name)) return json({ error: 'Tên đăng nhập 3–30 ký tự, chữ thường không dấu, số, dấu . _ - (ví dụ hao hoặc hao.sales)', code: 'bad_name' }, 400);
    if (password.length < 8) return json({ error: 'Mật khẩu ít nhất 8 ký tự', code: 'weak_password' }, 400);
    if (await env.DB.prepare('SELECT 1 FROM users WHERE name = ?').bind(name).first()) return json({ error: 'Tên đăng nhập này đã có người dùng', code: 'name_taken' }, 409);
    const id = newId(), at = nowIso(env);
    await env.DB.prepare("INSERT INTO users (id, name, password_hash, role, created_at) VALUES (?, ?, ?, 'staff', ?)")
      .bind(id, name, await hashPassword(password), at).run();
    return json(staffRow({ id, name, locked: 0, created_at: at }));
  }));
  r.on('POST', '/api/staff/:id/password', requireOwner(async (req, env, p) => {
    const u = await getStaff(env, p.id);
    if (!u) return err(404, 'Không tìm thấy tài khoản quản lý');
    const password = (await readJson(req)).password;
    if (typeof password !== 'string' || password.length < 8) return json({ error: 'Mật khẩu ít nhất 8 ký tự', code: 'weak_password' }, 400);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), u.id).run();
    await deleteSessionsOf(env, u.id); // signed out everywhere; logs in again with the new password
    return json({ ok: true });
  }));
  const setStaffLocked = (locked: boolean) => requireOwner(async (_req, env, p) => {
    const u = await getStaff(env, p.id);
    if (!u) return err(404, 'Không tìm thấy tài khoản quản lý');
    await env.DB.prepare('UPDATE users SET locked = ? WHERE id = ?').bind(locked ? 1 : 0, u.id).run();
    if (locked) await deleteSessionsOf(env, u.id);
    return json({ ok: true, locked });
  });
  r.on('POST', '/api/staff/:id/lock', setStaffLocked(true));
  r.on('POST', '/api/staff/:id/unlock', setStaffLocked(false));

  r.on('POST', '/api/users/:id/reset-link', requireOwner(async (req, env, p) => {
    const u = await getUser(env, p.id);
    if (!u || u.role !== 'customer') return err(404, 'Không tìm thấy người dùng');
    const token = await createToken(env, u.id, 'reset', 24 * 3600_000);
    return json({ url: `${baseUrl(env, req)}/dat-lai-mat-khau?token=${token}` });
  }));
}
