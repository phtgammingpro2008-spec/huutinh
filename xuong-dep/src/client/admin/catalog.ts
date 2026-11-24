import { useEffect, useState } from 'react';
import type { Currency, Lang, LineSetting } from '../../shared/types';
import { api } from './api';

export type Settings = { lines: LineSetting[]; quoteMessage: Record<Lang, string>; minOrderPairs: number };
export type MaterialKind = 'sole' | 'strap' | 'style';
export type Material = { id: string; kind: MaterialKind; nameVi: string; nameEn: string; nameKm: string; hidden: boolean };
export type Customer = {
  id: string; name: string; zalo: string; messenger: string; country: string; lang: Lang; currency: Currency; note: string;
};
export type Design = {
  id: string; cropKey: string; imageId: string | null; imageKey: string | null; label: 'co_dinh' | 'dat_rieng';
  soleId: string | null; strapId: string | null; styleId: string | null; note: string; allowPublic: boolean; createdAt: string;
  /** Phase 2a: who besides the workshop sees it. */
  isPrivate?: boolean; hidden?: boolean; hasBrandLogo?: boolean;
};

export const KIND_LABEL: Record<MaterialKind, string> = { sole: 'Đế', strap: 'Quai', style: 'Kiểu' };

let settingsCache: Promise<Settings> | null = null;
let materialsCache: Promise<Material[]> | null = null;

export const invalidateSettings = () => { settingsCache = null; };
export const invalidateMaterials = () => { materialsCache = null; };

export function useSettings(): Settings | null {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    settingsCache ??= api<Settings>('GET', '/api/settings').catch((e) => { settingsCache = null; throw e; });
    let live = true;
    settingsCache.then((v) => live && setS(v)).catch(() => {});
    return () => { live = false; };
  }, []);
  return s;
}

/** Visible materials (hidden ones excluded). `reload` refetches after a change. */
export function useMaterials(): [Material[], () => Promise<void>] {
  const [list, setList] = useState<Material[]>([]);
  const load = async (force = false) => {
    if (force) materialsCache = null;
    materialsCache ??= api<Material[]>('GET', '/api/materials').catch((e) => { materialsCache = null; throw e; });
    setList(await materialsCache.catch(() => []));
  };
  useEffect(() => { load(); }, []);
  return [list, () => load(true)];
}

export const lineLabel = (settings: Settings | null, key: string) =>
  settings?.lines.find((l) => l.key === key)?.label.vi ?? key;
