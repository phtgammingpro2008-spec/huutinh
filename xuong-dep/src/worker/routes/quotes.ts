import { localDate } from '../../shared/dates';
import { fillMessage } from '../../shared/i18n';
import { formatMoney } from '../../shared/money';
import { qtyPriceLocked } from '../../shared/status';
import { requireAdmin } from '../roles';
import type { Env } from '../env';
import { err, json, newToken, nowIso, readJson } from '../http';
import { loadOrder } from '../repo/orders';
import { buildSnapshot, createQuoteVersion, latestQuote } from '../repo/quotes';
import { getSettings } from '../repo/settings';
import type { Router } from '../router';
import { lockedMessage, saveOrder } from './orders';

export function zaloUrl(zalo: string): string | null {
  const digits = zalo.replace(/\D/g, '');
  return digits ? `https://zalo.me/${digits}` : null;
}

export function messengerUrl(m: string): string | null {
  const v = m.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://m.me/${encodeURIComponent(v.replace(/^@/, ''))}`;
}

const sameNumbers = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function sendQuote(env: Env, req: Request, orderId: string): Promise<Response> {
  const o = await loadOrder(env, orderId);
  if (!o) return err(404, 'Không tìm thấy đơn');
  if (o.status === 'da_huy') return err(409, 'Đơn đã hủy, không gửi báo giá được');
  if (o.totals.missingPrice) return err(400, 'Còn dòng chưa có giá');

  let token = o.quoteToken;
  if (!token) {
    token = newToken(40);
    await env.DB.prepare('UPDATE orders SET quote_token = ? WHERE id = ?').bind(token, o.id).run();
  }

  let version = o.quoteVersion;
  if (o.status === 'cho_bao_gia' || o.status === 'da_bao_gia') {
    const latest = version > 0 ? await latestQuote(env, o.id) : null;
    const current = await buildSnapshot(env, o, version);
    if (!latest || o.status === 'cho_bao_gia' || !sameNumbers(latest.data, current)) version = await createQuoteVersion(env, o.id);
    if (o.status === 'cho_bao_gia') {
      await env.DB.prepare("UPDATE orders SET status = 'da_bao_gia', updated_at = ? WHERE id = ?").bind(nowIso(env), o.id).run();
    }
  }

  const base = (env.APP_URL || new URL(req.url).origin).replace(/\/+$/, '');
  const url = `${base}/q/${token}`;
  const { quoteMessage } = await getSettings(env);
  const lang = o.customer.lang;
  const message = fillMessage(quoteMessage[lang] ?? quoteMessage.vi, {
    code: o.code, url, total: formatMoney(o.totals.amount, o.currency, lang),
  });
  return json({ url, message, version, zaloUrl: zaloUrl(o.customer.zalo), messengerUrl: messengerUrl(o.customer.messenger) });
}

export function quoteRoutes(r: Router) {
  r.on('PUT', '/api/orders/:id/prices', requireAdmin(async (req, env, p) => {
    const o = await loadOrder(env, p.id);
    if (!o) return err(404, 'Không tìm thấy đơn');
    if (qtyPriceLocked(o.status)) return err(409, lockedMessage(o.status));
    const b = await readJson(req);
    if (!Array.isArray(b.prices)) return err(400, 'Thiếu danh sách giá');
    const byLine = new Map<string, number | null>();
    for (const x of b.prices) {
      const v = x?.unitPrice ?? null;
      if (v !== null && !(Number.isInteger(v) && v >= 0 && v <= 1e12)) return err(400, 'Đơn giá không hợp lệ');
      byLine.set(String(x?.lineId), v);
    }
    const lineIds = new Set(o.items.flatMap((i) => i.lines.map((l) => l.id)));
    for (const id of byLine.keys()) if (!lineIds.has(id)) return err(400, 'Dòng không thuộc đơn này');
    const items = o.items.map((i) => ({
      ...i, lines: i.lines.map((l) => (byLine.has(l.id) ? { ...l, unitPrice: byLine.get(l.id)! } : l)),
    }));
    return saveOrder(env, { ...o, items });
  }));

  r.on('POST', '/api/orders/:id/send-quote', requireAdmin(async (req, env, p) => sendQuote(env, req, p.id)));

  r.on('GET', '/api/price-history', requireAdmin(async (req, env) => {
    const sp = new URL(req.url).searchParams;
    const g = (k: string) => sp.get(k) || null;
    const rows = (await env.DB.prepare(
      `SELECT l.unit_price, l.line_key, o.currency, o.quoted_at, o.code, c.name AS customer_name
       FROM item_lines l JOIN order_items i ON i.id = l.item_id JOIN orders o ON o.id = i.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE l.unit_price IS NOT NULL AND o.status != 'cho_bao_gia' AND o.quoted_at IS NOT NULL
         AND i.sole_id IS ? AND i.strap_id IS ? AND i.style_id IS ? AND (? IS NULL OR o.id != ?)
       ORDER BY o.quoted_at DESC, o.code DESC LIMIT 200`,
    ).bind(g('soleId'), g('strapId'), g('styleId'), g('excludeOrderId'), g('excludeOrderId'))
      .all<{ unit_price: number; line_key: string; currency: string; quoted_at: string; code: string; customer_name: string }>()).results;
    const seen = new Set<string>();
    const out = [];
    for (const x of rows) {
      const k = `${x.code}|${x.unit_price}|${x.line_key}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        unitPrice: x.unit_price, currency: x.currency, date: localDate(new Date(x.quoted_at)),
        customerName: x.customer_name, orderCode: x.code, lineKey: x.line_key,
      });
      if (out.length === 10) break;
    }
    return json(out);
  }));
}
