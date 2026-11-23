import { useEffect, useState } from 'react';
import { formatMoney } from '../../../shared/money';
import type { Currency } from '../../../shared/types';
import { api } from '../api';
import { viDate } from './OrderRow';

export type PricePoint = { unitPrice: number; currency: Currency; date: string; customerName: string; orderCode: string; lineKey: string };

const cache = new Map<string, Promise<PricePoint[]>>();
export const clearPriceHistoryCache = () => cache.clear();

/** Earlier prices for the same sole/strap/style; tapping a chip fills the price. */
export function PriceHistory({ soleId, strapId, styleId, excludeOrderId, currency, onPick }: {
  soleId: string | null; strapId: string | null; styleId: string | null; excludeOrderId: string; currency: Currency;
  onPick: (minor: number) => void;
}) {
  const [points, setPoints] = useState<PricePoint[]>([]);
  useEffect(() => {
    const qs = new URLSearchParams({ excludeOrderId });
    if (soleId) qs.set('soleId', soleId);
    if (strapId) qs.set('strapId', strapId);
    if (styleId) qs.set('styleId', styleId);
    const key = qs.toString();
    if (!cache.has(key)) cache.set(key, api<PricePoint[]>('GET', `/api/price-history?${key}`).catch(() => []));
    let live = true;
    cache.get(key)!.then((p) => live && setPoints(p));
    return () => { live = false; };
  }, [soleId, strapId, styleId, excludeOrderId]);

  const usable = points.filter((p) => p.currency === currency);
  if (!usable.length) return null;
  return (
    <div className="chips" aria-label="Giá đã báo trước đây" style={{ marginTop: 6 }}>
      {usable.map((p) => (
        <button key={p.orderCode + p.unitPrice + p.lineKey} type="button" className="chip" onClick={() => onPick(p.unitPrice)}
          title={`${p.orderCode} · ${viDate(p.date)}`}>
          {formatMoney(p.unitPrice, p.currency, 'vi')} · {p.customerName} · {viDate(p.date).slice(0, 5)}
        </button>
      ))}
    </div>
  );
}
