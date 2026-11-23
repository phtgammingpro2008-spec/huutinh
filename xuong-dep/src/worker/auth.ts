import type { Env } from './env';
import { b64url, fromB64url, newToken, now } from './http';

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

/** Secure is dropped only for plain-http local dev (browsers refuse Secure cookies there). */
export function sessionCookie(req: Request, token: string, maxAge = SESSION_DAYS * 86400): string {
  const secure = new URL(req.url).protocol === 'https:' ? ' Secure;' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`;
}
