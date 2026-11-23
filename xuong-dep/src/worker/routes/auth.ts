import { COOKIE, createSession, hashPassword, requireAuth, sessionCookie, verifyPassword } from '../auth';
import { err, getCookie, json, newId, nowIso, readJson, str } from '../http';
import type { Router } from '../router';

export function authRoutes(r: Router) {
  r.on('GET', '/api/setup-status', async (_req, env) => {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
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
    // Insert only while the table is empty, so two racing setups cannot both win.
    await env.DB.prepare(
      "INSERT INTO users (id, name, password_hash, role, created_at) SELECT ?, ?, ?, 'admin', ? WHERE NOT EXISTS (SELECT 1 FROM users)",
    ).bind(id, name, hash, nowIso(env)).run();
    const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (!row) return err(409, 'Đã có tài khoản quản trị');
    const token = await createSession(env, id);
    return json({ id, name }, 200, { 'set-cookie': sessionCookie(token) });
  });

  r.on('POST', '/api/login', async (req, env) => {
    const b = await readJson(req);
    const name = str(b.name, 100);
    const password = typeof b.password === 'string' ? b.password : '';
    const u = await env.DB.prepare('SELECT id, name, password_hash FROM users WHERE name = ?')
      .bind(name).first<{ id: string; name: string; password_hash: string }>();
    if (!u || !(await verifyPassword(password, u.password_hash))) return err(401, 'Sai mật khẩu');
    const token = await createSession(env, u.id);
    return json({ id: u.id, name: u.name }, 200, { 'set-cookie': sessionCookie(token) });
  });

  r.on('POST', '/api/logout', async (req, env) => {
    const token = getCookie(req, COOKIE);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  });

  r.on('GET', '/api/me', requireAuth(async (_req, env, _p, ctx) => {
    const u = await env.DB.prepare('SELECT id, name, role FROM users WHERE id = ?').bind(ctx.userId).first();
    return u ? json(u) : err(401, 'Chưa đăng nhập');
  }));
}
