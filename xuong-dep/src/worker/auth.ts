import type { Env } from './env';
import { b64url, err, fromB64url, getCookie, newToken, now } from './http';
import type { Handler } from './router';

const ITER = 100_000; // Cloudflare Workers caps PBKDF2 at 100k iterations
export const SESSION_DAYS = 90;
export const COOKIE = 'sid';

async function derive(pw: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64url(salt)}$${b64url(await derive(pw, salt, ITER))}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, iterS, saltS, hashS] = stored.split('$');
  if (alg !== 'pbkdf2' || !iterS || !saltS || !hashS) return false;
  const got = await derive(pw, fromB64url(saltS), Number(iterS));
  const want = fromB64url(hashS);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

export async function createSession(env: Env, userId: string): Promise<string> {
  const token = newToken(40);
  const expires = new Date(now(env).getTime() + SESSION_DAYS * 86400_000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, expires).run();
  return token;
}

export function sessionCookie(token: string, maxAge = SESSION_DAYS * 86400): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function userIdFromRequest(req: Request, env: Env): Promise<string | null> {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
    .bind(token).first<{ user_id: string; expires_at: string }>();
  if (!row || row.expires_at <= now(env).toISOString()) return null;
  return row.user_id;
}

/** Wraps a handler so it only runs for a logged-in user. */
export function requireAuth(h: Handler): Handler {
  return async (req, env, p, ctx) => {
    const userId = await userIdFromRequest(req, env);
    if (!userId) return err(401, 'Chưa đăng nhập');
    return h(req, env, p, { ...ctx, userId });
  };
}
