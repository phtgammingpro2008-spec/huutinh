// The customer's unfinished order, kept in localStorage so pages (product, library) can add to it
// and a reload keeps it. Every access is guarded: storage can be missing or full.
import type { Item, Line, LineSetting } from '../../shared/types';
import type { EditorImage } from '../admin/components/PhotoPicker';
import type { Names } from './common';

export type CDraft = {
  id: string;
  /** Code of the order being edited; null for a new order. */
  editCode: string | null;
  neededBy: string;
  note: string;
  deliverNote: string;
  privateAll: boolean;
  images: EditorImage[];
  items: Item[];
  /** item id → caption shown on its card ("Kẹp đế êm · Kem"). */
  titles: Record<string, string>;
  /** Size line labels of product lines the workshop settings may not have. */
  labels: Record<string, Names>;
  cropSigs: Record<string, string>;
};

const PTR = 'cdraft:new';
const key = (id: string) => `cdraft:${id}`;

export const emptyDraft = (id = crypto.randomUUID()): CDraft => ({
  id, editCode: null, neededBy: '', note: '', deliverNote: '', privateAll: false, images: [], items: [], titles: {}, labels: {}, cropSigs: {},
});

export function loadDraft(id: string): CDraft | null {
  try { const raw = localStorage.getItem(key(id)); return raw ? (JSON.parse(raw) as CDraft) : null; } catch { return null; }
}
/** The unfinished new order, if there is one. */
export function currentDraft(): CDraft | null {
  try { const id = localStorage.getItem(PTR); return id ? loadDraft(id) : null; } catch { return null; }
}
export function saveDraft(d: CDraft): void {
  // photos not uploaded yet (no key) cannot survive a reload; their designs go with them
  const images = d.images.filter((i) => i.key).map(({ blob: _b, uploadError: _e, ...i }) => ({ ...i, url: '/media/' + i.key }));
  const kept = new Set(images.map((i) => i.id));
  const data: CDraft = { ...d, images, items: d.items.filter((i) => !i.imageId || kept.has(i.imageId)) };
  try {
    localStorage.setItem(key(d.id), JSON.stringify(data));
    if (!d.editCode) localStorage.setItem(PTR, d.id);
  } catch { /* storage unavailable */ }
}
export function clearDraft(id: string): void {
  try {
    localStorage.removeItem(key(id));
    if (localStorage.getItem(PTR) === id) localStorage.removeItem(PTR);
  } catch { /* ignore */ }
}

export function newLine(s: Pick<LineSetting, 'key' | 'sizeFrom' | 'sizeTo'>): Line {
  return { id: crypto.randomUUID(), lineKey: s.key, sizeFrom: s.sizeFrom, sizeTo: s.sizeTo, mode: 'even', qtyEach: 0, perSize: {}, unitPrice: null };
}
export const nextTag = (items: Item[]) => items.reduce((m, i) => Math.max(m, i.tagNo), 0) + 1;

export function blankItem(tagNo: number, lines: Line[], base: Partial<Item>): Item {
  return {
    id: crypto.randomUUID(), designId: crypto.randomUUID(), imageId: null, tagNo, tapX: null, tapY: null, crop: null, cropKey: '',
    soleId: null, strapId: null, styleId: null, colorNote: '', lines, isPrivate: false, productId: null, colorId: null, ...base,
  };
}

/** Adds a library design to the unfinished order (creating it) — used by "Đặt lại mẫu này". */
export function addDesignToDraft(d: { id: string; cropKey: string; styleId: string | null; soleId: string | null; strapId: string | null }, firstLine: LineSetting | undefined): void {
  const draft = currentDraft() ?? emptyDraft();
  if (!draft.items.some((i) => i.designId === d.id)) {
    draft.items.push(blankItem(nextTag(draft.items), firstLine ? [newLine(firstLine)] : [], {
      designId: d.id, cropKey: d.cropKey, styleId: d.styleId, soleId: d.soleId, strapId: d.strapId,
    }));
  }
  saveDraft(draft);
}
