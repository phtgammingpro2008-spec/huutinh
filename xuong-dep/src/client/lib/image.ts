import type { Box } from '../../shared/types';

export const MAX_EDGE = 2000;
export const QUALITY = 0.8;

export class ImageError extends Error {}

type Drawable = ImageBitmap | HTMLImageElement;
const sizeOf = (d: Drawable) => ('naturalWidth' in d ? { w: d.naturalWidth, h: d.naturalHeight } : { w: d.width, h: d.height });

function unreadable(name: string): ImageError {
  const heic = /\.hei[cf]$/i.test(name);
  return new ImageError(`Không đọc được ảnh này: ${name}` + (heic ? ' (ảnh HEIC: hãy mở bằng Safari hoặc chụp màn hình rồi chọn lại)' : ''));
}

/** Decodes a photo (EXIF orientation applied). Throws ImageError when the browser can't read it. */
export async function decodeImage(file: Blob, name = 'ảnh'): Promise<Drawable> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (bmp.width > 0 && bmp.height > 0) return bmp;
  } catch { /* fall back to <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error('empty');
    return img;
  } catch {
    throw unreadable(name);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function canvasBlob(c: HTMLCanvasElement, type: string, q: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new ImageError('Không nén được ảnh'))), type, q));
}

/** Long edge ≤ 2000 px, JPEG 0.8. */
export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await decodeImage(file, file.name);
  const { w, h } = sizeOf(img);
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; // PNG transparency → white, not black, in JPEG
  g.fillRect(0, 0, width, height);
  g.drawImage(img, 0, 0, width, height);
  if ('close' in img) img.close();
  return { blob: await canvasBlob(c, 'image/jpeg', QUALITY), width, height };
}

/** Cuts `box` (fractions) out of an image; long edge capped at `maxEdge`. */
export async function cropToBlob(src: Blob | Drawable, box: Box, maxEdge = 1200): Promise<Blob> {
  const img = src instanceof Blob ? await decodeImage(src) : src;
  const { w, h } = sizeOf(img);
  const sx = Math.round(box.x * w), sy = Math.round(box.y * h);
  const sw = Math.max(1, Math.round(box.w * w)), sh = Math.max(1, Math.round(box.h * h));
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return canvasBlob(c, 'image/jpeg', 0.85);
}

/**
 * A centred 4:5 (portrait) frame, zoomed in a little (`zoom` of the largest frame that fits) so the pair of
 * sandals fills more of the picture. Fractions of the photo, for cropToBlob.
 */
export function portraitBox(w: number, h: number, zoom = 0.92, ratio = 4 / 5): Box {
  let bw = w, bh = w / ratio;
  if (bh > h) { bh = h; bw = h * ratio; }
  bw *= zoom; bh *= zoom;
  return { x: (w - bw) / 2 / w, y: (h - bh) / 2 / h, w: bw / w, h: bh / h };
}

/** Photo ready for the site: optional 4:5 frame, a touch more contrast and colour where the browser can, long edge ≤ 1500. */
export async function sitePhoto(file: File, opts: { portrait: boolean }): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await decodeImage(file, file.name);
  const { w, h } = sizeOf(img);
  const box = opts.portrait ? portraitBox(w, h) : { x: 0, y: 0, w: 1, h: 1 };
  const sw = box.w * w, sh = box.h * h;
  const scale = Math.min(1, 1500 / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  if ('filter' in g) g.filter = 'contrast(1.06) saturate(1.12) brightness(1.02)'; // older Safari: plain copy
  g.drawImage(img, box.x * w, box.y * h, sw, sh, 0, 0, c.width, c.height);
  if ('close' in img) img.close();
  return { blob: await canvasBlob(c, 'image/jpeg', 0.85), width: c.width, height: c.height };
}
