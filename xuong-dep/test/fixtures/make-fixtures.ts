// Generates e2e fixture images. Run: bun test/fixtures/make-fixtures.ts
import sharp from 'sharp';
import { join } from 'node:path';

const dir = import.meta.dir;
const colours = ['#d94841', '#e8a23a', '#4a9a5b', '#3a72c4', '#8a4fbf', '#2f2f2f'];
const blocks = colours.map((c, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  return `<rect x="${100 + col * 1000}" y="${100 + row * 1000}" width="800" height="800" rx="120" fill="${c}"/>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000"><rect width="3000" height="2000" fill="#f2efe9"/>${blocks}</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(join(dir, 'grid-3000x2000.jpg'));
await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ff0000' } }).png().toFile(join(dir, 'tiny-1x1.png'));
await Bun.write(join(dir, 'corrupt.jpg'), new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
console.log('fixtures written to', dir);
