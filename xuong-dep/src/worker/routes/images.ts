import type { Env } from '../env';
import { HttpError, err, json, newId, now, nowIso } from '../http';
import { hitLimit } from '../ratelimit';
import { requireAdmin, requireCustomer } from '../roles';
import type { Router } from '../router';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CUSTOMER_UPLOADS_PER_DAY = 60;

export async function serveImage(env: Env, key: string, cache = 'private, max-age=31536000, immutable'): Promise<Response> {
  const obj = await env.IMAGES.get(key);
  if (!obj) return err(404, 'Không tìm thấy ảnh');
  return new Response(await obj.arrayBuffer(), {
    headers: { 'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'cache-control': cache },
  });
}

/** Validates the request body as an image and stores it under `<prefix>/yyyy/mm/<id>.<ext>`; records who uploaded it. */
async function storeUpload(req: Request, env: Env, prefix: 'img' | 'pub', userId: string): Promise<{ id: string; key: string }> {
  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) throw new HttpError(415, 'Chỉ nhận ảnh JPEG, PNG hoặc WebP');
  if (Number(req.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) throw new HttpError(413, 'Ảnh quá lớn (tối đa 8 MB)');
  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, 'Ảnh quá lớn (tối đa 8 MB)');
  if (body.byteLength === 0) throw new HttpError(400, 'Ảnh trống');
  const wanted = new URL(req.url).searchParams.get('id');
  if (wanted && !UUID.test(wanted)) throw new HttpError(400, 'Mã ảnh không hợp lệ');
  const id = wanted ?? newId();
  const d = now(env);
  const key = `${prefix}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${id}.${ext}`;
  await env.IMAGES.put(key, body, { httpMetadata: { contentType: type } });
  await env.DB.prepare('INSERT OR IGNORE INTO uploads (id, key, user_id, created_at) VALUES (?, ?, ?, ?)').bind(newId(), key, userId, nowIso(env)).run();
  return { id, key };
}

export function imageRoutes(r: Router) {
  r.on('POST', '/api/images', requireAdmin(async (req, env, _p, ctx) => json(await storeUpload(req, env, 'img', ctx.user!.id))));

  /** Pictures for the public site (posters, product colours, collection covers). */
  r.on('POST', '/api/content/images', requireAdmin(async (req, env, _p, ctx) => json(await storeUpload(req, env, 'pub', ctx.user!.id))));

  r.on('POST', '/api/c/images', requireCustomer(async (req, env, _p, ctx) => {
    if (await hitLimit(env, `upload:${ctx.user!.id}`, CUSTOMER_UPLOADS_PER_DAY, 86400)) return err(429, 'Tải quá nhiều ảnh trong ngày, vui lòng thử lại ngày mai');
    return json(await storeUpload(req, env, 'img', ctx.user!.id));
  }));

  r.on('GET', '/img/*', requireAdmin(async (_req, env, p) => serveImage(env, 'img/' + p['*'])));
}
