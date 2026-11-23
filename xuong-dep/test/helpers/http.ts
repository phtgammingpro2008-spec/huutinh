import worker from '../../src/worker/index';
import type { Env } from '../../src/worker/env';

export type Res = { status: number; body: any; headers: Headers; raw: Response };

export async function call(env: Env, method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}): Promise<Res> {
  const h: Record<string, string> = { ...headers };
  let payload: BodyInit | undefined;
  if (body instanceof ArrayBuffer || body instanceof Uint8Array) payload = body as BodyInit;
  else if (body !== undefined) { payload = JSON.stringify(body); h['content-type'] ??= 'application/json'; }
  if (cookie) h.cookie = cookie;
  const raw = await worker.fetch(new Request('https://xuong.test' + path, { method, body: payload, headers: h }), env);
  const text = await raw.clone().text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: raw.status, body: parsed, headers: raw.headers, raw };
}

export function cookieFrom(res: Res): string {
  const sc = res.headers.get('set-cookie') ?? '';
  return sc.split(';')[0];
}

/** Creates the admin (if needed) and returns a `sid=...` cookie. */
export async function loginCookie(env: Env, name = 'anh', password = 'mat-khau-123'): Promise<string> {
  await call(env, 'POST', '/api/setup', { name, password });
  const r = await call(env, 'POST', '/api/login', { name, password });
  if (r.status !== 200) throw new Error('login failed ' + r.status);
  return cookieFrom(r);
}
