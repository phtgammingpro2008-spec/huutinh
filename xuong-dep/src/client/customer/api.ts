export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string, readonly field?: string) { super(message); }
}

export type Me = {
  id: string; role: 'admin' | 'staff' | 'worker' | 'customer'; name: string; customerId: string | null; lang: 'vi' | 'en' | 'km';
  email: string | null; phone: string | null; emailVerified: boolean;
};

/** JSON fetch for the customer side. Errors carry the server's machine code and form field. */
export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, '', 'network');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (res.status === 401 && !/^\/api\/(login|register|me|password|email)\b/.test(path)) {
    // the session ended (logged out elsewhere, or the workshop locked the account)
    location.assign('/dang-nhap?next=' + encodeURIComponent(location.pathname + location.hash));
  }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`, data?.code, data?.field);
  return data as T;
}

/** Same-origin path from ?next=, or null. Rejects "//host", "/\host" and absolute URLs. */
export function safeNext(raw: string | null): string | null {
  if (!raw || raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return null;
  try {
    const u = new URL(raw, location.origin);
    return u.origin === location.origin ? u.pathname + u.search + u.hash : null;
  } catch { return null; }
}

/** Uploads one of the customer's photos (or a crop of it). Retries twice on network trouble. */
export async function uploadImage(blob: Blob, width: number, height: number, id?: string): Promise<{ id: string; key: string }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`/api/c/images?w=${width}&h=${height}${id ? `&id=${id}` : ''}`, {
        method: 'POST', body: blob, headers: { 'content-type': blob.type || 'image/jpeg' }, credentials: 'same-origin',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`, data?.code);
      return data;
    } catch (e) {
      if (attempt >= 2 || (e instanceof ApiError && e.status > 0 && e.status < 500)) throw e instanceof ApiError ? e : new ApiError(0, '', 'network');
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}
