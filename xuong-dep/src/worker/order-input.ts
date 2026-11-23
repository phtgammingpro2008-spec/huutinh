import { resizeLine } from '../shared/totals';
import type { Box, Item, Line, LineMode, OrderImage, OrderInput } from '../shared/types';
import { isDate } from '../shared/dates';
import { HttpError, str } from './http';
import { currency, optId } from './validate';

const MODES: LineMode[] = ['even', 'per_size', 'total'];
const MAX_QTY = 1_000_000;
const MAX_PRICE = 1_000_000_000_000;

const bad = (msg: string): never => { throw new HttpError(400, msg); };
const id = (v: unknown, what: string) => (typeof v === 'string' && v && v.length <= 100 ? v : bad(`Thiếu mã ${what}`));
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const frac = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

function box(v: unknown): Box | null {
  if (v == null) return null;
  const b = v as Box;
  if (!frac(b.x) || !frac(b.y) || !frac(b.w) || !frac(b.h) || b.w <= 0 || b.h <= 0) bad('Khung cắt không hợp lệ');
  return { x: b.x, y: b.y, w: b.w, h: b.h };
}

function line(v: any, tagNo: number): Line {
  const where = `mẫu số ${tagNo}`;
  if (!MODES.includes(v?.mode)) bad(`Chế độ số lượng không hợp lệ (${where})`);
  if (!isInt(v.sizeFrom, 1, 60) || !isInt(v.sizeTo, 1, 60) || v.sizeFrom > v.sizeTo) bad(`Dải size không hợp lệ (${where})`);
  if (!isInt(v.qtyEach ?? 0, 0, MAX_QTY)) bad(`Số đôi không hợp lệ (${where})`);
  const perSize: Record<string, number> = {};
  for (const [k, n] of Object.entries(v.perSize ?? {})) {
    if (!isInt(n, 0, MAX_QTY)) bad(`Số đôi theo size không hợp lệ (${where})`);
    perSize[k] = n as number;
  }
  const unitPrice = v.unitPrice ?? null;
  if (unitPrice !== null && !isInt(unitPrice, 0, MAX_PRICE)) bad(`Đơn giá không hợp lệ (${where})`);
  const l: Line = {
    id: id(v.id, 'dòng'), lineKey: str(v.lineKey, 40) || bad(`Thiếu dòng size (${where})`),
    sizeFrom: v.sizeFrom, sizeTo: v.sizeTo, mode: v.mode, qtyEach: v.qtyEach ?? 0, perSize, unitPrice,
  };
  return resizeLine(l, l.sizeFrom, l.sizeTo); // keep only sizes in range
}

export function parseItems(raw: unknown, opts: { requireLines: boolean }): Item[] {
  if (!Array.isArray(raw) || raw.length === 0) bad('Đơn cần ít nhất một mẫu');
  if ((raw as unknown[]).length > 300) bad('Quá nhiều mẫu trong một đơn');
  return (raw as any[]).map((v) => {
    const tagNo = isInt(v?.tagNo, 0, 10_000) ? v.tagNo : bad('Số nhãn không hợp lệ');
    const lines = Array.isArray(v.lines) ? v.lines.map((l: unknown) => line(l, tagNo)) : [];
    if (opts.requireLines && lines.length === 0) bad(`Mẫu số ${tagNo} chưa có dòng số lượng`);
    if (lines.length > 20) bad(`Mẫu số ${tagNo} có quá nhiều dòng`);
    return {
      id: id(v.id, 'mẫu'), designId: id(v.designId, 'thiết kế'), imageId: optId(v.imageId), tagNo,
      tapX: frac(v.tapX) ? v.tapX : null, tapY: frac(v.tapY) ? v.tapY : null, crop: box(v.crop),
      cropKey: str(v.cropKey, 200), soleId: optId(v.soleId), strapId: optId(v.strapId), styleId: optId(v.styleId),
      colorNote: str(v.colorNote, 1000), lines,
      isPrivate: v.isPrivate === true, productId: optId(v.productId), colorId: optId(v.colorId),
    } satisfies Item;
  });
}

export function parseImages(raw: unknown): OrderImage[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) bad('Danh sách ảnh không hợp lệ');
  return (raw as any[]).map((v) => {
    const key = str(v?.key, 200);
    if (!key.startsWith('img/')) bad('Ảnh không hợp lệ');
    if (!isInt(v.width, 1, 100_000) || !isInt(v.height, 1, 100_000)) bad('Kích thước ảnh không hợp lệ');
    return { id: id(v.id, 'ảnh'), key, width: v.width, height: v.height };
  });
}

export function parseOrderInput(b: any, orderId: string): OrderInput {
  const neededBy = b.neededBy ? (isDate(b.neededBy) ? b.neededBy : bad('Ngày cần hàng không hợp lệ')) : null;
  return {
    id: orderId,
    customerId: id(b.customerId, 'khách'),
    currency: currency(b.currency),
    neededBy,
    note: str(b.note, 4000),
    allowPublic: b.allowPublic === true,
    deliverNote: str(b.deliverNote, 1000),
    images: parseImages(b.images),
    items: parseItems(b.items, { requireLines: true }),
  };
}
