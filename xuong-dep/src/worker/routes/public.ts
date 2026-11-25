import { t } from '../../shared/i18n';
import type { PublicQuote, QuoteSnapshot } from '../../shared/snapshot';
import { LANGS, type Lang } from '../../shared/types';
import type { Env } from '../env';
import { err, json, nowIso } from '../http';
import { getCustomer } from '../repo/customers';
import type { OrderRow } from '../repo/orders';
import { latestQuote, type QuoteRow } from '../repo/quotes';
import type { Router } from '../router';
import { serveImage } from './images';
import { adminOrderUrl, notifyOwner } from '../telegram';

async function byToken(env: Env, token: string) {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) return null;
  const o = await env.DB.prepare('SELECT * FROM orders WHERE quote_token = ?').bind(token).first<OrderRow>();
  if (!o) return null;
  const q = await latestQuote(env, o.id);
  if (!q) return null;
  const customer = (await getCustomer(env, o.customer_id))!;
  return { o, q, customer };
}

/** Customer accepts quote `version` (link page or account). Same rules everywhere: latest version only, idempotent. */
export async function acceptQuote(env: Env, o: OrderRow, q: QuoteRow, version: unknown, lang: Lang): Promise<Response> {
  if (o.status === 'da_huy') return err(409, t(lang, 'cancelled'));
  if (version !== o.quote_version || q.version !== o.quote_version) return err(409, t(lang, 'quote.changed'));
  if (q.accepted_at) return json({ ok: true, version: q.version, acceptedAt: q.accepted_at }); // already accepted
  if (o.status !== 'da_bao_gia') return err(409, t(lang, 'quote.changed'));
  const at = nowIso(env);
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET status = 'khach_dong_y', accepted_at = ?, updated_at = ? WHERE id = ? AND quote_version = ?")
      .bind(at, at, o.id, q.version),
    env.DB.prepare('UPDATE quotes SET accepted_at = ? WHERE id = ? AND accepted_at IS NULL').bind(at, q.id),
  ]);
  const cust = await getCustomer(env, o.customer_id);
  await notifyOwner(env, `✅ Khách đồng ý báo giá ${o.code} (bản ${q.version})\n👤 ${cust?.name ?? ''}${cust?.zalo ? ' · ' + cust.zalo : ''}\nĐơn chuyển sang "Khách đồng ý", anh cho vào làm nhé.\n${adminOrderUrl(env, o.id)}`);
  return json({ ok: true, version: q.version, acceptedAt: at });
}

export function publicRoutes(r: Router) {
  r.on('GET', '/api/public/quote/:token', async (_req, env, p) => {
    const f = await byToken(env, p.token);
    if (!f) return err(404, t('vi', 'notFound'));
    const acc = await env.DB.prepare(
      'SELECT version, accepted_at FROM quotes WHERE order_id = ? AND accepted_at IS NOT NULL ORDER BY version DESC LIMIT 1',
    ).bind(f.o.id).first<{ version: number; accepted_at: string }>();
    const body: PublicQuote = {
      code: f.o.code, status: f.o.status, lang: f.customer.lang, customerName: f.customer.name,
      snapshot: f.q.data, acceptedVersion: acc?.version ?? null, acceptedAt: acc?.accepted_at ?? null,
    };
    return json(body);
  });

  r.on('POST', '/api/public/quote/:token/accept', async (req, env, p) => {
    const f = await byToken(env, p.token);
    let b: { version?: unknown; lang?: unknown } = {};
    try { b = await req.json(); } catch { /* empty body */ }
    const lang: Lang = LANGS.includes(b.lang as Lang) ? (b.lang as Lang) : (f?.customer.lang ?? 'vi');
    if (!f) return err(404, t(lang, 'notFound'));
    return acceptQuote(env, f.o, f.q, b.version, lang);
  });

  // Addressed by quote version: a version's photos never change, so they can be cached for good.
  r.on('GET', '/q/:token/img/:version/:index', async (_req, env, p) => {
    if (!/^\d+$/.test(p.version) || !/^\d+$/.test(p.index)) return err(404, 'Không tìm thấy ảnh');
    const f = await byToken(env, p.token);
    if (!f) return err(404, 'Không tìm thấy ảnh');
    const row = await env.DB.prepare('SELECT snapshot FROM quotes WHERE order_id = ? AND version = ?')
      .bind(f.o.id, Number(p.version)).first<{ snapshot: string }>();
    const item = row ? (JSON.parse(row.snapshot) as QuoteSnapshot).items[Number(p.index)] : undefined;
    if (!item?.cropKey) return err(404, 'Không tìm thấy ảnh');
    return serveImage(env, item.cropKey, 'private, max-age=31536000, immutable');
  });
}
