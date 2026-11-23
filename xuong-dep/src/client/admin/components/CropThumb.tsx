import type { Box } from '../../../shared/types';
import { imgUrl } from '../api';

/** Shows the crop of a photo with CSS only (no extra download), or a stored crop image. */
export function CropThumb({ image, crop, cropKey, size = 64 }: {
  image?: { url: string; width: number; height: number } | null; crop?: Box | null; cropKey?: string; size?: number;
}) {
  if (image && crop) {
    const ratio = (crop.w * image.width) / (crop.h * image.height);
    const w = ratio >= 1 ? size : size * ratio;
    const h = ratio >= 1 ? size / ratio : size;
    const pos = (start: number, len: number) => (len >= 1 ? 0 : (start / (1 - len)) * 100);
    return (
      <div aria-hidden="true" className="thumb" style={{
        width: w, height: h, backgroundImage: `url("${image.url}")`, backgroundRepeat: 'no-repeat',
        backgroundSize: `${100 / crop.w}% ${100 / crop.h}%`, backgroundPosition: `${pos(crop.x, crop.w)}% ${pos(crop.y, crop.h)}%`,
      }} />
    );
  }
  if (cropKey) return <img className="thumb" src={imgUrl(cropKey)} alt="" style={{ width: size, height: size }} loading="lazy" />;
  return <div className="thumb" style={{ width: size, height: size }} />;
}
