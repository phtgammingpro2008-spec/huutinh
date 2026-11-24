import { useEffect, useState } from 'react';
import type { UiKey } from '../../shared/i18n-ui';
import type { Lang, LineSetting, OrderStatus } from '../../shared/types';
import type { LineText } from '../admin/components/LineEditor';
import type { T } from '../ui/lang';
import { api } from './api';

export type Names = Record<Lang, string>;
export type CMaterial = { id: string; kind: 'sole' | 'strap' | 'style'; name: Names };
export type Catalog = { lines: LineSetting[]; materials: CMaterial[]; minOrderPairs?: number };

/** Stored pictures the customer may see are served under /media. */
export const media = (key: string) => '/media/' + key;
export const nameIn = (n: Names | null | undefined, lang: Lang) => (n ? n[lang] || n.vi : '');
export const dmy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
export const statusText = (t: T, s: OrderStatus) => t(`st.${s}` as UiKey);

let catalogCache: Promise<Catalog> | null = null;
export function useCatalog(): Catalog | null {
  const [c, setC] = useState<Catalog | null>(null);
  useEffect(() => {
    catalogCache ??= api<Catalog>('GET', '/api/c/catalog').catch((e) => { catalogCache = null; throw e; });
    let live = true;
    catalogCache.then((v) => live && setC(v)).catch(() => {});
    return () => { live = false; };
  }, []);
  return c;
}

export function lineText(t: T): LineText {
  return {
    even: t('le.even'), perSize: t('le.per_size'), total: t('le.total'), size: t('le.size'), to: t('le.to'),
    sizeFrom: (l) => t('le.size_from', { l }), sizeTo: (l) => t('le.size_to', { l }), each: (l) => t('le.each', { l }),
    totalOf: (l) => t('le.total_l', { l }), sizeOf: (s, l) => t('le.size_l', { s, l }), xSizes: (n) => t('le.x_sizes', { n }),
    split: t('le.split'), eq: (n) => t('le.eq', { n }), remove: (l) => t('le.remove', { l }), mode: (l) => t('le.mode', { l }),
  };
}

/** Short message that fades out (saved, added…). */
export function useFlash(): [string, (m: string) => void] {
  const [m, setM] = useState('');
  useEffect(() => {
    if (!m) return;
    const id = setTimeout(() => setM(''), 3500);
    return () => clearTimeout(id);
  }, [m]);
  return [m, setM];
}
