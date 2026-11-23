import type { Env } from './env';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const err = (status: number, messageVi: string) => json({ error: messageVi }, status);

export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    const v = await req.json();
    if (v === null || typeof v !== 'object') throw new Error();
    return v as T;
  } catch {
    throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ');
  }
}

export const newId = () => crypto.randomUUID();

/** URL-safe base64 of random bytes; `len` is the output length in characters. */
export function newToken(len = 40): string {
  const bytes = new Uint8Array(Math.ceil((len * 3) / 4));
  crypto.getRandomValues(bytes);
  return b64url(bytes).slice(0, len);
}

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const now = (env: Env) => (env.NOW ? env.NOW() : new Date());
export const nowIso = (env: Env) => now(env).toISOString();

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/** String field helper: trims, caps length, returns '' for non-strings. */
export const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
