export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export const AUTH_LOST = 'xuong-dep:auth-lost';

/** JSON fetch wrapper. Throws ApiError; on 401 sends the app back to login. */
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
    throw new ApiError(0, 'Không kết nối được máy chủ, kiểm tra mạng rồi thử lại');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    if (res.status === 401 && !/^\/api\/(login|setup|me)\b/.test(path)) {
      window.dispatchEvent(new Event(AUTH_LOST));
    }
    throw new ApiError(res.status, data?.error ?? `Lỗi ${res.status}`);
  }
  return data as T;
}

/** Uploads a binary image, returns its id and storage key. */
export async function uploadImage(blob: Blob, width: number, height: number, id?: string): Promise<{ id: string; key: string }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`/api/images?w=${width}&h=${height}${id ? `&id=${id}` : ''}`, {
        method: 'POST', body: blob, headers: { 'content-type': blob.type || 'image/jpeg' }, credentials: 'same-origin',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data?.error ?? `Lỗi ${res.status}`);
      return data;
    } catch (e) {
      if (attempt >= 2 || (e instanceof ApiError && e.status > 0 && e.status < 500)) {
        throw e instanceof ApiError ? e : new ApiError(0, 'Tải ảnh lên thất bại, kiểm tra mạng rồi thử lại');
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

/** Order photos and crops are served at /img/…; site pictures (pub/…, e.g. product colours) at /media/…. */
export const imgUrl = (key: string) => (key.startsWith('img/') ? '/' + key : '/media/' + key);
