import type { Env } from './env';
import { HttpError, err } from './http';
import { Router } from './router';
import { authRoutes } from './routes/auth';
import { catalogRoutes } from './routes/catalog';
import { designRoutes } from './routes/designs';
import { imageRoutes } from './routes/images';
import { orderRoutes } from './routes/orders';
import { paymentRoutes } from './routes/payments';
import { publicRoutes } from './routes/public';
import { quoteRoutes } from './routes/quotes';

const router = new Router();
quoteRoutes(router);
paymentRoutes(router);
publicRoutes(router);
authRoutes(router);
catalogRoutes(router);
imageRoutes(router);
orderRoutes(router);
designRoutes(router);

function withNoindex(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex');
  return out;
}

async function route(req: Request, env: Env): Promise<Response> {
  try {
    const res = await router.handle(req, env, {});
    if (res) return res;
    return err(404, 'Không tìm thấy');
  } catch (e) {
    if (e instanceof HttpError) return err(e.status, e.message);
    console.error(e);
    return err(500, 'Lỗi máy chủ, vui lòng thử lại');
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return withNoindex(await route(req, env));
  },
};
