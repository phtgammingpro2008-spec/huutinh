import { uiT, type UiKey } from '../../shared/i18n-ui';
import { foldSearch } from '../../shared/search';
import { COUNTRIES, normalizeEmail, normalizePhone, type Country } from '../../shared/phone';
import { LANGS, type Lang } from '../../shared/types';
import { COOKIE, createSession, hashPassword, sessionCookie, verifyPassword } from '../auth';
import type { Env } from '../env';
import { err, getCookie, json, newId, nowIso, readJson, str } from '../http';
import { bump, clientIp, isLimited } from '../ratelimit';
import { findByIdentifier } from '../repo/users';
import { currentUser } from '../roles';
import type { Router } from '../router';
import { sendVerifyEmail } from './users';
import { notifyOwner } from '../telegram';

const langOf = (v: unknown): Lang => (LANGS.includes(v as Lang) ? (v as Lang) : 'vi');

/** Localized error with a machine code and the form field it belongs to. */
const fail = (status: number, lang: Lang, code: string, field?: string) =>
  json({ error: uiT(lang, `err.${code}` as UiKey), code, field }, status);

const LOGIN_FAILS = 10, IP_FAILS = 30, LOGIN_WINDOW = 15 * 60;
const REGISTERS_PER_IP = 5, REGISTER_WINDOW = 3600;

async function displayName(env: Env, u: { name: string; role: string; customer_id: string | null }) {
  if (u.role !== 'customer' || !u.customer_id) return u.name;
  const c = await env.DB.prepare('SELECT name FROM customers WHERE id = ?').bind(u.customer_id).first<{ name: string }>();
  return c?.name ?? u.name;
}

export function authRoutes(r: Router) {
  r.on('GET', '/api/setup-status', async (_req, env) => {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first<{ n: number }>();
    return json({ needsSetup: (row?.n ?? 0) === 0 });
  });

  r.on('POST', '/api/setup', async (req, env) => {
    const b = await readJson(req);
    const name = str(b.name, 100);
    const password = typeof b.password === 'string' ? b.password : '';
    if (!name) return err(400, 'Cần nhập tên');
    if (password.length < 8) return err(400, 'Mật khẩu cần ít nhất 8 ký tự');
    const id = newId();
    const hash = await hashPassword(password);
    await env.DB.prepare(
      "INSERT INTO users (id, name, password_hash, role, created_at) SELECT ?, ?, ?, 'admin', ? WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')",
    ).bind(id, name, hash, nowIso(env)).run();
    const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (!row) return err(409, 'Đã có tài khoản quản trị');
    const token = await createSession(env, id);
    return json({ id, name, role: 'admin' }, 200, { 'set-cookie': sessionCookie(req, token) });
  });

  r.on('POST', '/api/register', async (req, env) => {
    const b = await readJson(req);
    const lang = langOf(b.lang);
    const ipKey = `register:ip:${clientIp(req)}`;
    if (await isLimited(env, ipKey, REGISTERS_PER_IP, REGISTER_WINDOW)) return fail(429, lang, 'too_many');
    const name = str(b.name, 100);
    if (!name) return fail(400, lang, 'bad_name', 'name');
    if (!COUNTRIES.includes(b.country)) return fail(400, lang, 'bad_country', 'country');
    const country = b.country as Country;
    const phone = normalizePhone(String(b.phone ?? ''), country);
    if (!phone) return fail(400, lang, 'bad_phone', 'phone');
    const email = normalizeEmail(String(b.email ?? ''));
    if (!email) return fail(400, lang, 'bad_email', 'email');
    const password = typeof b.password === 'string' ? b.password : '';
    if (password.length < 8 || password.length > 200) return fail(400, lang, 'weak_password', 'password');
    if (await env.DB.prepare('SELECT 1 FROM users WHERE phone = ?').bind(phone).first()) return fail(409, lang, 'phone_taken', 'phone');
    if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) return fail(409, lang, 'email_taken', 'email');

    const at = nowIso(env);
    const userId = newId(), customerId = newId();
    const currency = country === 'KH' ? 'USD' : 'VND';
    try {
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO customers (id, name, name_search, zalo, messenger, country, lang, currency, note, created_at) VALUES (?, ?, ?, ?, \'\', ?, ?, ?, \'\', ?)',
        ).bind(customerId, name, foldSearch(name), phone, country, lang, currency, at),
        env.DB.prepare(
          "INSERT INTO users (id, name, password_hash, role, phone, email, customer_id, created_at) VALUES (?, ?, ?, 'customer', ?, ?, ?, ?)",
        ).bind(userId, phone, await hashPassword(password), phone, email, customerId, at),
      ]);
    } catch (e) {
      // lost a race with an identical registration
      const msg = String(e);
      if (/email/i.test(msg)) return fail(409, lang, 'email_taken', 'email');
      if (/phone|name/i.test(msg)) return fail(409, lang, 'phone_taken', 'phone');
      throw e;
    }
    await bump(env, ipKey, REGISTER_WINDOW);
    await sendVerifyEmail(env, req, userId, email, lang);
    await notifyOwner(env, `👋 Khách mới đăng ký: ${name}\n📞 ${phone} · ${country}`);
    const token = await createSession(env, userId);
    return json({ id: userId, name, role: 'customer' }, 200, { 'set-cookie': sessionCookie(req, token) });
  });

  r.on('POST', '/api/login', async (req, env) => {
    const b = await readJson(req);
    const lang = langOf(b.lang);
    const id = str(b.id ?? b.name, 254);
    const password = typeof b.password === 'string' ? b.password : '';
    const idKey = `login:id:${id.toLowerCase().replace(/\D/g, '') || id.toLowerCase()}`;
    const ipKey = `login:ip:${clientIp(req)}`;
    if (await isLimited(env, idKey, LOGIN_FAILS, LOGIN_WINDOW) || await isLimited(env, ipKey, IP_FAILS, LOGIN_WINDOW)) {
      return fail(429, lang, 'too_many');
    }
    const u = await findByIdentifier(env, id);
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      await bump(env, idKey, LOGIN_WINDOW);
      await bump(env, ipKey, LOGIN_WINDOW);
      return json({ error: u?.role === 'admin' || u?.role === 'staff' || !u ? 'Sai mật khẩu' : uiT(lang, 'err.wrong_password'), code: 'wrong_password' }, 401);
    }
    if (u.locked) return fail(403, lang, 'account_locked');
    const token = await createSession(env, u.id);
    return json({ id: u.id, name: await displayName(env, u), role: u.role }, 200, { 'set-cookie': sessionCookie(req, token) });
  });

  r.on('POST', '/api/logout', async (req, env) => {
    const token = getCookie(req, COOKIE);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(req, '', 0) });
  });

  r.on('GET', '/api/me', async (req, env) => {
    const user = await currentUser(req, env);
    if (!user) return err(401, 'Chưa đăng nhập');
    const u = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<any>())!;
    const c = u.customer_id ? await env.DB.prepare('SELECT name, lang FROM customers WHERE id = ?').bind(u.customer_id).first<{ name: string; lang: Lang }>() : null;
    return json({
      id: u.id, role: u.role, name: c?.name ?? u.name, customerId: u.customer_id, lang: c?.lang ?? 'vi',
      email: u.email, phone: u.phone, emailVerified: !!u.email_verified_at,
    });
  });
}
