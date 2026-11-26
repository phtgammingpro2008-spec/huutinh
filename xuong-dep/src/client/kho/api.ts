/** JSON fetch for /kho. Errors keep the whole body (code, overRi, codes…). */
export class KhoError extends Error {
  constructor(readonly status: number, message: string, readonly body: any) { super(message); }
}

export async function kapi<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new KhoError(0, 'Mất kết nối, thử lại · គ្មានអ៊ីនធឺណិត', null);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401) location.assign('/dang-nhap?next=' + encodeURIComponent('/kho' + location.hash));
  if (!res.ok) throw new KhoError(res.status, data?.error ?? `HTTP ${res.status}`, data);
  return data as T;
}
