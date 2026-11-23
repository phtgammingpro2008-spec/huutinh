import { requireAdmin } from '../roles';
import { err, json, newId, now } from '../http';
import type { Router } from '../router';
import type { Env } from '../env';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function serveImage(env: Env, key: string, cache = 'private, max-age=31536000, immutable'): Promise<Response> {
  const obj = await env.IMAGES.get(key);
  if (!obj) return err(404, 'Không tìm thấy ảnh');
  return new Response(await obj.arrayBuffer(), {
    headers: { 'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'cache-control': cache },
  });
}

export function imageRoutes(r: Router) {
  r.on('POST', '/api/images', requireAdmin(async (req, env) => {
    const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = EXT[type];
    if (!ext) return err(415, 'Chỉ nhận ảnh JPEG, PNG hoặc WebP');
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > MAX_IMAGE_BYTES) return err(413, 'Ảnh quá lớn (tối đa 8 MB)');
    const body = await req.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_BYTES) return err(413, 'Ảnh quá lớn (tối đa 8 MB)');
    if (body.byteLength === 0) return err(400, 'Ảnh trống');
    const d = now(env);
    const wanted = new URL(req.url).searchParams.get('id');
    if (wanted && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(wanted)) return err(400, 'Mã ảnh không hợp lệ');
    const id = wanted ?? newId();
    const key = `img/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${id}.${ext}`;
    await env.IMAGES.put(key, body, { httpMetadata: { contentType: type } });
    return json({ id, key });
  }));

  r.on('GET', '/img/*', requireAdmin(async (_req, env, p) => serveImage(env, 'img/' + p['*'])));
}
