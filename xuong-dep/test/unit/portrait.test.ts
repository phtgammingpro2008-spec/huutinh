import { expect, test } from 'bun:test';
import { portraitBox } from '../../src/client/lib/image';

const ratio = (b: { w: number; h: number }, w: number, h: number) => (b.w * w) / (b.h * h);

test('portrait frame is 4:5, centred, inside the photo, for square, wide and tall photos', () => {
  for (const [w, h] of [[2556, 2554], [4000, 3000], [3000, 4000], [1200, 1500]]) {
    const b = portraitBox(w, h);
    expect(ratio(b, w, h)).toBeCloseTo(0.8, 5);
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(1 + 1e-9); expect(b.y + b.h).toBeLessThanOrEqual(1 + 1e-9);
    expect(b.x + b.w / 2).toBeCloseTo(0.5, 5); expect(b.y + b.h / 2).toBeCloseTo(0.5, 5);
  }
  // zoom 1 on a 4:5 photo is the whole photo
  expect(portraitBox(1200, 1500, 1)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
});
