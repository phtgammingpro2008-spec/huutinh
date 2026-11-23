import type { Box, Item, Line, LineMode, OrderImage } from '../../shared/types';

export type ItemRow = {
  id: string; order_id: string; design_id: string; image_id: string | null; tag_no: number;
  tap_x: number | null; tap_y: number | null; crop: string | null; crop_key: string;
  sole_id: string | null; strap_id: string | null; style_id: string | null; color_note: string; position: number;
  is_private: number; product_id: string | null; color_id: string | null;
};
export type LineRow = {
  id: string; item_id: string; line_key: string; size_from: number; size_to: number; mode: LineMode;
  qty_each: number; per_size: string; unit_price: number | null; position: number;
};
export type ImageRow = { id: string; order_id: string | null; key: string; width: number; height: number; position: number };

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (s == null) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export const mapLine = (r: LineRow): Line => ({
  id: r.id, lineKey: r.line_key, sizeFrom: r.size_from, sizeTo: r.size_to, mode: r.mode,
  qtyEach: r.qty_each, perSize: parseJson(r.per_size, {}), unitPrice: r.unit_price,
});

export const mapItem = (r: ItemRow, lines: Line[]): Item => ({
  id: r.id, designId: r.design_id, imageId: r.image_id, tagNo: r.tag_no, tapX: r.tap_x, tapY: r.tap_y,
  crop: parseJson<Box | null>(r.crop, null), cropKey: r.crop_key, soleId: r.sole_id, strapId: r.strap_id,
  styleId: r.style_id, colorNote: r.color_note, lines,
  isPrivate: !!r.is_private, productId: r.product_id, colorId: r.color_id,
});

export const mapImage = (r: ImageRow): OrderImage => ({ id: r.id, key: r.key, width: r.width, height: r.height });

/** Groups child rows by a parent key, keeping order. */
export function groupBy<T, K extends keyof T>(rows: T[], key: K): Map<T[K], T[]> {
  const m = new Map<T[K], T[]>();
  for (const r of rows) {
    const k = r[key];
    const arr = m.get(k);
    if (arr) arr.push(r); else m.set(k, [r]);
  }
  return m;
}
