import type { Currency, Lang, LineMode } from './types';

export type Names = Record<Lang, string>;

export type SnapshotLine = {
  lineKey: string; label: Names; mode: LineMode; sizeFrom: number; sizeTo: number;
  sizes: Record<string, number>; qty: number; unitPrice: number; amount: number;
};

export type SnapshotItem = {
  tagNo: number; cropKey: string;
  materials: { sole: Names | null; strap: Names | null; style: Names | null };
  colorNote: string; qty: number; lines: SnapshotLine[];
};

export type QuoteSnapshot = {
  version: number; currency: Currency; neededBy: string | null;
  items: SnapshotItem[]; totalQty: number; totalAmount: number;
};

export type PublicQuote = {
  code: string; status: string; lang: Lang; customerName: string;
  snapshot: QuoteSnapshot; acceptedVersion: number | null; acceptedAt: string | null;
};
