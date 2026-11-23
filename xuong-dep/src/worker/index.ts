import { ASSETS } from './assets.gen';
import type { Env } from './env';
import { HttpError, err, json } from './http';
import { Router } from './router';
import { authRoutes } from './routes/auth';
import { catalogRoutes } from './routes/catalog';
import { designRoutes } from './routes/designs';
import { imageRoutes } from './routes/images';
import { mediaRoutes } from './media';
import { customerRoutes } from './routes/customer';
import { contentRoutes } from './routes/content';
import { userRoutes } from './routes/users';
import { orderRoutes } from './routes/orders';
import { paymentRoutes } from './routes/payments';
import { publicRoutes } from './routes/public';
import { quoteRoutes } from './routes/quotes';

export const router = new Router();
quoteRoutes(router);
paymentRoutes(router);
publicRoutes(router);
authRoutes(router);
catalogRoutes(router);
imageRoutes(router);
mediaRoutes(router);
customerRoutes(router);
contentRoutes(router);
userRoutes(router);
orderRoutes(router);
designRoutes(router);

function decodeB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Embedded client files: `/` → admin app, `/q/<token>` → quote page, plus /assets, icons, manifest, sw. */
function serveAsset(req: Request): Response | null {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  const path = new URL(req.url).pathname;
  let name = path;
  if (path === '/quan-ly' || path === '/quan-ly/' || path === '/index.html') name = '/index.html';
  else if (/^\/q\/[A-Za-z0-9_-]+\/?$/.test(path)) name = '/quote.html';
  const a = ASSETS[name];
  if (!a) return null;
  const cache = a.immutable ? 'public, max-age=31536000, immutable'
    : name.startsWith('/icons/') ? 'public, max-age=86400' : 'no-cache';
  const body = a.b64 ? decodeB64(a.body) : a.body;
  return new Response(req.method === 'HEAD' ? null : (body as BodyInit), { headers: { 'content-type': a.type, 'cache-control': cache } });
}

/** Public home placeholder (Task 9 replaces it with the real site). Sends phase-1 bookmarks (/#/orders/…) to /quan-ly. */
const LEGACY_REDIRECT = `<script>if(location.hash.indexOf('#/')===0)location.replace('/quan-ly'+location.hash)</script>`;
function homePlaceholder(): Response {
  return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${LEGACY_REDIRECT}<title>HLUXURY</title></head><body><h1>HLUXURY</h1><p><a href="/quan-ly">Quản lý</a></p></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
}

async function route(req: Request, env: Env): Promise<Response> {
  try {
    if (req.method === 'GET' && new URL(req.url).pathname === '/') return homePlaceholder();
    const res = await router.handle(req, env, {});
    if (res) return res;
    const asset = serveAsset(req);
    if (asset) return asset;
    return err(404, 'Không tìm thấy');
  } catch (e) {
    if (e instanceof HttpError) {
      const code = (e as HttpError & { code?: string }).code;
      return code ? json({ error: e.message, code }, e.status) : err(e.status, e.message);
    }
    console.error(e);
    return err(500, 'Lỗi máy chủ, vui lòng thử lại');
  }
}

function secure(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex');
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Referrer-Policy', 'no-referrer'); // quote links must not leak through Referer
  out.headers.set('X-Frame-Options', 'DENY');
  return out;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return secure(await route(req, env));
  },
};
