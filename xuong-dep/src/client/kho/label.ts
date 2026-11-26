import qrcode from 'qrcode-generator';

/** QR of the bag code alone (never a link), as an SVG string sized for a 70 × 42 mm label. */
export function labelSvg(code: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(code);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
