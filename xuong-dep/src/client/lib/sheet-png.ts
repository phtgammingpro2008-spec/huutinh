// Production sheet: shared page model + PNG rendering (Canvas 2D). No prices anywhere.

export const PER_PAGE = 3;

export function paginateItems<T>(items: T[], perPage = PER_PAGE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
}

// Print layout (A4, 12 mm margins → 273 mm usable). Heights in mm at 16 pt body text.
const ROW = 6.8;           // one 16 pt text line
const ITEM_MIN = 76;       // photo box 72 mm + padding
const PAGE_BODY = 236;     // 273 − page header (≈ 27) − room for the order total footer (≈ 10)

/** Conservative height estimate of one design on the printed sheet. */
export function estimateItemMm(it: SheetItem): number {
  const noteRows = it.note ? Math.ceil(it.note.length / 26) : 0;
  const lines = it.lines.reduce((s, l) => s + ROW + (l.total ? ROW : 2 * 8 * Math.ceil(l.sizes.length / 8) + 2), 0);
  const text = 8 + ROW * it.materials.length + ROW * noteRows + lines + ROW + 6;
  return Math.max(ITEM_MIN, text + 4);
}

/** Fills each printed page with as many designs as fit; a design taller than a page gets a page of its own. */
export function paginateByHeight(items: SheetItem[], body = PAGE_BODY): SheetItem[][] {
  const pages: SheetItem[][] = [];
  let cur: SheetItem[] = [];
  let used = 0;
  for (const it of items) {
    const h = estimateItemMm(it);
    if (cur.length && used + h > body) { pages.push(cur); cur = []; used = 0; }
    cur.push(it);
    used += h;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

export type SheetLine = { label: string; range: string; total: boolean; sizes: [string, number][]; qty: number };
export type SheetItem = { tagNo: number; cropUrl: string; materials: string[]; note: string; lines: SheetLine[]; qty: number };
export type SheetData = { code: string; customer: string; neededBy: string; totalQty: number; items: SheetItem[] };

const W = 1080;
const PAD = 40;
const IMG = 500; // ≥ 45% of the page width
const INK = '#1d140f';
const MUTED = '#6b5a4e';
const LINE = '#d8cabb';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif';
const qtyText = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (g.measureText(next).width > maxW && cur) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

type Op = (g: CanvasRenderingContext2D) => void;

/** Lays out one item at y; returns draw ops and the height used. */
function layoutItem(g: CanvasRenderingContext2D, it: SheetItem, img: HTMLImageElement | null, y: number): { ops: Op[]; h: number } {
  const ops: Op[] = [];
  const x2 = PAD + IMG + 30;
  const maxW = W - x2 - PAD;
  // image, contained in a square box
  ops.push((c) => {
    c.fillStyle = '#f3ebe1';
    c.fillRect(PAD, y, IMG, IMG);
    if (img) {
      const s = Math.min(IMG / img.naturalWidth, IMG / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      c.drawImage(img, PAD + (IMG - w) / 2, y + (IMG - h) / 2, w, h);
    }
    c.fillStyle = '#b4532a';
    c.beginPath(); c.arc(PAD + 44, y + 44, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.font = `800 38px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(it.tagNo), PAD + 44, y + 46);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  });
  let ty = y + 40;
  const text = (s: string, font: string, color = INK, gap = 44) => {
    g.font = font;
    for (const ln of wrap(g, s, maxW)) {
      const yy = ty;
      ops.push((c) => { c.font = font; c.fillStyle = color; c.fillText(ln, x2, yy); });
      ty += gap;
    }
  };
  text(`Mẫu ${it.tagNo}`, `800 40px ${FONT}`, INK, 52);
  for (const m of it.materials) text(m, `500 32px ${FONT}`);
  if (it.note) text(`Màu/ghi chú: ${it.note}`, `500 32px ${FONT}`, MUTED);
  ty += 8;
  for (const l of it.lines) {
    text(`${l.label} ${l.range}: ${qtyText(l.qty)} đôi`, `700 32px ${FONT}`);
    if (l.total) {
      text('Chia size theo chuẩn xưởng', `500 28px ${FONT}`, MUTED, 40);
    } else {
      // size grid: rows of up to 4 "size: qty" cells
      const cells = l.sizes.map(([s, n]) => `${s}: ${n}`);
      for (let i = 0; i < cells.length; i += 4) {
        const row = cells.slice(i, i + 4);
        const yy = ty;
        ops.push((c) => {
          c.font = `600 30px ${FONT}`; c.fillStyle = INK;
          row.forEach((cell, k) => c.fillText(cell, x2 + k * (maxW / 4), yy));
        });
        ty += 42;
      }
    }
    ty += 6;
  }
  text(`Tổng mẫu: ${qtyText(it.qty)} đôi`, `800 34px ${FONT}`, '#b4532a');
  const h = Math.max(IMG, ty - y) + 30;
  ops.push((c) => { c.strokeStyle = LINE; c.lineWidth = 2; c.beginPath(); c.moveTo(PAD, y + h - 15); c.lineTo(W - PAD, y + h - 15); c.stroke(); });
  return { ops, h };
}

/** One 1080-px-wide PNG per page (3 designs each), readable on a phone. */
export async function renderSheetPngs(data: SheetData, perPage = PER_PAGE): Promise<Blob[]> {
  const pages = paginateItems(data.items, perPage);
  const imgs = await Promise.all(data.items.map((i) => loadImage(i.cropUrl)));
  const byTag = new Map(data.items.map((it, k) => [it.tagNo, imgs[k]]));
  const blobs: Blob[] = [];
  const measure = document.createElement('canvas').getContext('2d')!;
  for (let p = 0; p < pages.length; p++) {
    const ops: Op[] = [];
    let y = 190;
    for (const it of pages[p]) {
      const r = layoutItem(measure, it, byTag.get(it.tagNo) ?? null, y);
      ops.push(...r.ops);
      y += r.h;
    }
    const last = p === pages.length - 1;
    const height = y + (last ? 110 : 40);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = height;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, height);
    g.fillStyle = INK;
    g.font = `800 48px ${FONT}`;
    g.fillText(`PHIẾU LÀM HÀNG ${data.code}`, PAD, 70);
    g.font = `500 32px ${FONT}`;
    g.fillText(`Khách: ${data.customer}${data.neededBy ? `   ·   Cần hàng: ${data.neededBy}` : ''}`, PAD, 120);
    g.fillStyle = MUTED;
    g.fillText(`Trang ${p + 1}/${pages.length}   ·   Cả đơn: ${qtyText(data.totalQty)} đôi`, PAD, 162);
    for (const op of ops) op(g);
    if (last) {
      g.fillStyle = INK;
      g.font = `800 44px ${FONT}`;
      g.fillText(`TỔNG CẢ ĐƠN: ${qtyText(data.totalQty)} ĐÔI`, PAD, y + 60);
    }
    blobs.push(await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png')));
  }
  return blobs;
}
