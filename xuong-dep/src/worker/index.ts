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
import { publicSiteRoutes } from './public/pages';
import { telegramRoutes } from './telegram';

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
telegramRoutes(router);
publicSiteRoutes(router);

function decodeB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Login, sign-up, password pages and the customer area share one shell (src/client/customer). */
const ACCOUNT_PAGES = /^\/(dang-nhap|dang-ky|quen-mat-khau|dat-lai-mat-khau|tai-khoan)\/?$/;

/** Embedded client files: `/` → admin app, `/q/<token>` → quote page, plus /assets, icons, manifest, sw. */
function serveAsset(req: Request): Response | null {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  const path = new URL(req.url).pathname;
  let name = path;
  if (path === '/quan-ly' || path === '/quan-ly/' || path === '/index.html') name = '/index.html';
  else if (/^\/q\/[A-Za-z0-9_-]+\/?$/.test(path)) name = '/quote.html';
  else if (ACCOUNT_PAGES.test(path)) name = '/account.html';
  const a = ASSETS[name];
  if (!a) return null;
  const cache = a.immutable ? 'public, max-age=31536000, immutable'
    : name.startsWith('/icons/') ? 'public, max-age=86400' : 'no-cache';
  const body = a.b64 ? decodeB64(a.body) : a.body;
  return new Response(req.method === 'HEAD' ? null : (body as BodyInit), { headers: { 'content-type': a.type, 'cache-control': cache } });
}

async function route(req: Request, env: Env): Promise<Response> {
  try {
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
  // only the public site pages (marked by src/worker/public) may be indexed; everything else stays out of search
  if (out.headers.has('x-indexable')) out.headers.delete('x-indexable');
  else out.headers.set('X-Robots-Tag', 'noindex');
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Referrer-Policy', 'no-referrer'); // quote links must not leak through Referer
  out.headers.set('X-Frame-Options', 'DENY');
  return out;
}

/**
 * One address for the site: www.… and the old …workers.dev address send pages to APP_URL (same path and query),
 * so old quote links keep working and Google sees one site. API calls and form posts are left alone.
 */
function toMainDomain(req: Request, env: Env): Response | null {
  if (!env.APP_URL || (req.method !== 'GET' && req.method !== 'HEAD')) return null;
  const main = new URL(env.APP_URL);
  const url = new URL(req.url);
  if (url.host === main.host || url.pathname.startsWith('/api/')) return null;
  if (url.host !== 'www.' + main.host && !url.host.endsWith('.workers.dev')) return null;
  return new Response(null, { status: 301, headers: { location: main.origin + url.pathname + url.search } });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return secure(toMainDomain(req, env) ?? await route(req, env));
  },
};
