import type { Box } from '../../shared/types';

export const MIN = 0.05;
export const FULL_BOX: Box = { x: 0, y: 0, w: 1, h: 1 };
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Keeps a box inside 0..1 with sides ≥ 5%. */
export function clampBox(b: Box): Box {
  const w = clamp(b.w, MIN, 1);
  const h = clamp(b.h, MIN, 1);
  return { x: clamp(b.x, 0, 1 - w), y: clamp(b.y, 0, 1 - h), w, h };
}

/**
 * Box of 22% image width centred on the tap, square in pixels.
 * `imgAspect` = image width / image height.
 */
export function defaultBox(tapX: number, tapY: number, imgAspect: number): Box {
  const w = 0.22;
  const h = Math.min(1, w * imgAspect);
  return clampBox({ x: tapX - w / 2, y: tapY - h / 2, w, h });
}

/** Drags one corner to (x, y); the opposite corner stays put. Never inverts, never < 5%. */
export function moveCorner(b: Box, corner: Corner, x: number, y: number): Box {
  let left = b.x, top = b.y, right = b.x + b.w, bottom = b.y + b.h;
  x = clamp(x, 0, 1);
  y = clamp(y, 0, 1);
  if (corner === 'nw' || corner === 'sw') left = Math.min(x, right - MIN);
  else right = Math.max(x, left + MIN);
  if (corner === 'nw' || corner === 'ne') top = Math.min(y, bottom - MIN);
  else bottom = Math.max(y, top + MIN);
  return clampBox({ x: left, y: top, w: right - left, h: bottom - top });
}

/** The tag whose label is nearest to (x, y) within `radius` (all in the same units), or null. */
export function hitTag(tags: { tagNo: number; tapX: number | null; tapY: number | null }[], x: number, y: number, radius: number): number | null {
  let best: number | null = null;
  let bestD = radius;
  for (const t of tags) {
    if (t.tapX == null || t.tapY == null) continue;
    const d = Math.hypot(t.tapX - x, t.tapY - y);
    if (d <= bestD) { bestD = d; best = t.tagNo; }
  }
  return best;
}

export const nextTagNo = (tags: { tagNo: number }[]) => tags.reduce((m, t) => Math.max(m, t.tagNo), 0) + 1;

/** Where to draw a tag label for a box without a tap point (e.g. whole image): its centre. */
export const boxCentre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
