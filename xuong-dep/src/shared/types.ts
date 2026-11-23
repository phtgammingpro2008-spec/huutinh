export type Currency = 'VND' | 'USD';
export type Lang = 'vi' | 'en' | 'km';
export type OrderStatus =
  | 'cho_bao_gia' | 'da_bao_gia' | 'khach_dong_y' | 'dang_san_xuat' | 'da_giao' | 'hoan_tat' | 'da_huy';
export type LineMode = 'even' | 'per_size' | 'total';

/** Fractions 0..1 of the source image. */
export type Box = { x: number; y: number; w: number; h: number };

export type Line = {
  id: string;
  lineKey: string;
  sizeFrom: number;
  sizeTo: number;
  mode: LineMode;
  qtyEach: number;
  perSize: Record<string, number>;
  /** Minor units (VND đồng, USD cents). */
  unitPrice: number | null;
};

export type Item = {
  id: string;
  designId: string;
  imageId: string | null;
  tagNo: number;
  tapX: number | null;
  tapY: number | null;
  crop: Box | null;
  cropKey: string;
  soleId: string | null;
  strapId: string | null;
  styleId: string | null;
  colorNote: string;
  lines: Line[];
};

export type OrderImage = { id: string; key: string; width: number; height: number };

export type OrderInput = {
  id: string;
  customerId: string;
  currency: Currency;
  neededBy: string | null;
  note: string;
  allowPublic: boolean;
  images: OrderImage[];
  items: Item[];
};

export type LineSetting = { key: string; label: Record<Lang, string>; sizeFrom: number; sizeTo: number };

export const LANGS: Lang[] = ['vi', 'en', 'km'];
export const CURRENCIES: Currency[] = ['VND', 'USD'];
