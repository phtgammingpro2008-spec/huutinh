import type { Names, QuoteSnapshot } from '../../shared/snapshot';
import { itemQty, lineAmount, lineQty, lineSizes } from '../../shared/totals';
import type { Env, Stmt } from '../env';
import { newId, nowIso } from '../http';
import { getMaterialsByIds, type Material } from './materials';
import { loadOrder, type OrderView } from './orders';
import { parseJson } from './rows';
import { getSettings } from './settings';

const names = (m: Material | undefined): Names | null =>
  m ? { vi: m.nameVi, en: m.nameEn || m.nameVi, km: m.nameKm || m.nameVi } : null;

/** Builds the customer-facing snapshot of an order's current numbers. All lines must be priced. */
export async function buildSnapshot(env: Env, o: Pick<OrderView, 'items' | 'currency' | 'neededBy' | 'totals'>, version: number): Promise<QuoteSnapshot> {
  const mats = await getMaterialsByIds(env, o.items.flatMap((i) => [i.soleId, i.strapId, i.styleId]));
  const { lines: lineSettings } = await getSettings(env);
  const labelOf = (key: string): Names => {
    const s = lineSettings.find((l) => l.key === key);
    return s ? s.label : { vi: key, en: key, km: key };
  };
  return {
    version, currency: o.currency, neededBy: o.neededBy,
    items: o.items.map((i) => ({
      tagNo: i.tagNo, cropKey: i.cropKey, colorNote: i.colorNote, qty: itemQty(i),
      materials: {
        sole: names(mats.get(i.soleId ?? '')), strap: names(mats.get(i.strapId ?? '')), style: names(mats.get(i.styleId ?? '')),
      },
      lines: i.lines.map((l) => ({
        lineKey: l.lineKey, label: labelOf(l.lineKey), mode: l.mode, sizeFrom: l.sizeFrom, sizeTo: l.sizeTo,
        sizes: lineSizes(l), qty: lineQty(l), unitPrice: l.unitPrice ?? 0, amount: lineAmount(l) ?? 0,
      })),
    })),
    totalQty: o.totals.qty, totalAmount: o.totals.amount,
  };
}

export type QuoteRow = { id: string; order_id: string; version: number; snapshot: string; sent_at: string; accepted_at: string | null };

export async function latestQuote(env: Env, orderId: string): Promise<(QuoteRow & { data: QuoteSnapshot }) | null> {
  const r = await env.DB.prepare('SELECT * FROM quotes WHERE order_id = ? ORDER BY version DESC LIMIT 1').bind(orderId).first<QuoteRow>();
  return r ? { ...r, data: parseJson<QuoteSnapshot>(r.snapshot, null as never) } : null;
}

/** Creates the next quote version (snapshot of the current numbers) and returns its number. */
export async function createQuoteVersion(env: Env, orderId: string): Promise<number> {
  const o = await loadOrder(env, orderId);
  if (!o) throw new Error('order not found');
  const version = o.quoteVersion + 1;
  const snap = await buildSnapshot(env, o, version);
  await env.DB.batch(quoteVersionStmts(env, orderId, snap, nowIso(env)));
  return version;
}

/** Writes a quote version; meant to share a batch (transaction) with the change that caused it. */
export function quoteVersionStmts(env: Env, orderId: string, snap: QuoteSnapshot, at: string): Stmt[] {
  return [
    env.DB.prepare('INSERT INTO quotes (id, order_id, version, snapshot, sent_at) VALUES (?, ?, ?, ?, ?)')
      .bind(newId(), orderId, snap.version, JSON.stringify(snap), at),
    env.DB.prepare('UPDATE orders SET quote_version = ?, quoted_at = ?, updated_at = ? WHERE id = ?').bind(snap.version, at, at, orderId),
  ];
}
