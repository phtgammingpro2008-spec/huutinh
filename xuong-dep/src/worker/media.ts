import type { Env } from './env';
import { err } from './http';
import { LIBRARY_VISIBLE } from './repo/library';
import { serveImage } from './routes/images';
import { currentUser, type SessionUser } from './roles';
import type { Router } from './router';

const KEY_RE = /^(img|pub)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Who may see a stored image. Original order photos never leave their order's customer and the admin. */
export async function canViewKey(env: Env, user: SessionUser | null, key: string): Promise<boolean> {
  if (!KEY_RE.test(key)) return false;
  if (key.startsWith('pub/')) return true;
  // pictures of published products are on the public site, even when the colour reuses a library crop
  const shown = await env.DB.prepare(
    'SELECT 1 FROM product_colors pc JOIN products p ON p.id = pc.product_id WHERE pc.image_key = ? AND p.published = 1 AND p.has_brand_logo = 0 LIMIT 1',
  ).bind(key).first();
  if (shown) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.customerId) return false;
  const hit = await env.DB.prepare(
    `SELECT 1 FROM uploads WHERE key = ?1 AND user_id = ?2
     UNION ALL SELECT 1 FROM order_images i JOIN orders o ON o.id = i.order_id WHERE i.key = ?1 AND o.customer_id = ?3
     UNION ALL SELECT 1 FROM order_items it JOIN orders o ON o.id = it.order_id WHERE it.crop_key = ?1 AND o.customer_id = ?3
     UNION ALL SELECT 1 FROM designs d WHERE d.crop_key = ?1 AND ${LIBRARY_VISIBLE}
     UNION ALL SELECT 1 FROM product_colors pc JOIN products p ON p.id = pc.product_id
       WHERE pc.image_key = ?1 AND p.published = 1
     LIMIT 1`,
  ).bind(key, user.id, user.customerId).first();
  return !!hit;
}

export function mediaRoutes(r: Router) {
  r.on('GET', '/media/*', async (req, env, p) => {
    const key = p['*'];
    if (!(await canViewKey(env, await currentUser(req, env), key))) return err(404, 'Không tìm thấy ảnh');
    return serveImage(env, key, key.startsWith('pub/') ? 'public, max-age=31536000, immutable' : 'private, max-age=31536000, immutable');
  });
}
