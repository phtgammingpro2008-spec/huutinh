import { expect, test } from 'bun:test';
import { clampBox, defaultBox, FULL_BOX, hitTag, moveCorner, nextTagNo } from '../../src/client/lib/tagger-geometry';

const inside = (b: { x: number; y: number; w: number; h: number }) =>
  b.x >= 0 && b.y >= 0 && b.x + b.w <= 1 + 1e-9 && b.y + b.h <= 1 + 1e-9;

test('defaultBox is 22% wide, square in pixels, centred on the tap', () => {
  const b = defaultBox(0.5, 0.5, 1.5); // 3:2 photo
  expect(b.w).toBeCloseTo(0.22);
  expect(b.h).toBeCloseTo(0.33); // 0.22 × 1.5 → square in pixels
  expect(b.x + b.w / 2).toBeCloseTo(0.5);
  expect(b.y + b.h / 2).toBeCloseTo(0.5);
});

test('defaultBox near the right edge stays inside image', () => {
  const b = defaultBox(0.99, 0.02, 1.5);
  expect(inside(b)).toBe(true);
  expect(b.w).toBeCloseTo(0.22);
  expect(b.x + b.w).toBeCloseTo(1);
  expect(b.y).toBe(0);
});

test('defaultBox on a very tall photo caps the height at the image', () => {
  const b = defaultBox(0.5, 0.5, 6);
  expect(inside(b)).toBe(true);
  expect(b.h).toBe(1);
});

test('clampBox pulls a box back inside and enforces 5% minimum', () => {
  expect(clampBox({ x: 0.9, y: -0.1, w: 0.3, h: 0.2 })).toEqual({ x: 0.7, y: 0, w: 0.3, h: 0.2 });
  const small = clampBox({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 });
  expect(small.w).toBeCloseTo(0.05);
  expect(small.h).toBeCloseTo(0.05);
});

test('moveCorner moves one corner and keeps the opposite fixed', () => {
  const b = moveCorner({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 'se', 0.8, 0.9);
  expect(b.x).toBeCloseTo(0.2);
  expect(b.y).toBeCloseTo(0.2);
  expect(b.w).toBeCloseTo(0.6);
  expect(b.h).toBeCloseTo(0.7);
  const nw = moveCorner({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 'nw', 0.1, 0.05);
  expect(nw.x).toBeCloseTo(0.1);
  expect(nw.y).toBeCloseTo(0.05);
  expect(nw.x + nw.w).toBeCloseTo(0.6);
  expect(nw.y + nw.h).toBeCloseTo(0.6);
});

test('moveCorner never inverts or goes below 5%', () => {
  const start = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
  for (const [corner, x, y] of [['nw', 0.9, 0.9], ['ne', -0.5, 0.95], ['sw', 0.95, -1], ['se', 0, 0]] as const) {
    const b = moveCorner(start, corner, x, y);
    expect(b.w).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(b.h).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(inside(b)).toBe(true);
  }
  const out = moveCorner(start, 'se', 1.4, 1.7);
  expect(out.x + out.w).toBeCloseTo(1);
  expect(out.y + out.h).toBeCloseTo(1);
});

test('hitTag returns existing tag within radius', () => {
  const tags = [{ tagNo: 1, tapX: 100, tapY: 100 }, { tagNo: 2, tapX: 130, tapY: 100 }];
  expect(hitTag(tags, 104, 98, 24)).toBe(1);
  expect(hitTag(tags, 120, 100, 24)).toBe(2); // nearest wins
  expect(hitTag(tags, 300, 300, 24)).toBeNull();
  expect(hitTag([{ tagNo: 3, tapX: null, tapY: null }], 0, 0, 24)).toBeNull();
});

test('FULL_BOX covers the image and nextTagNo counts on', () => {
  expect(FULL_BOX).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  expect(nextTagNo([])).toBe(1);
  expect(nextTagNo([{ tagNo: 1 }, { tagNo: 4 }])).toBe(5);
});
