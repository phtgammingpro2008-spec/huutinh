// Draws the app icon (a flip-flop on a warm tile) and writes 192/512 PNGs. Run: bun scripts/make-icons.ts
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="0" fill="#b4532a"/>
  <g transform="translate(256 262) rotate(-18)">
    <path d="M0-190c64 0 98 52 98 128 0 70-22 108-32 168-8 50-30 80-66 80s-58-30-66-80c-10-60-32-98-32-168 0-76 34-128 98-128z" fill="#fbe7d3"/>
    <path d="M0-118 C-10-60 -56-20 -86 10 M0-118 C10-60 56-20 86 10" stroke="#2f1d14" stroke-width="22" fill="none" stroke-linecap="round"/>
    <circle cx="0" cy="-118" r="14" fill="#2f1d14"/>
  </g>
</svg>`;

const out = join(import.meta.dir, '../src/client/public/icons');
await mkdir(out, { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(out, `icon-${size}.png`));
}
console.log('icons written to', out);
