import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, devices, type Browser, type BrowserContext, type Page } from 'playwright';

const ROOT = join(import.meta.dir, '../..');
let built = false;

export function buildOnce() {
  if (built || process.env.E2E_SKIP_BUILD) return;
  const r = Bun.spawnSync(['bun', 'scripts/build.ts'], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode !== 0) throw new Error('build failed:\n' + r.stderr.toString() + r.stdout.toString());
  built = true;
}

export type App = { url: string; dataDir: string; stop(): Promise<void> };

/** Starts the dev server on a free port with a fresh data dir. */
export async function startApp(opts: { dist?: boolean } = {}): Promise<App> {
  // E2E_BASE_URL points the tests at an already running server (wrangler dev, or a fresh deployment).
  if (process.env.E2E_BASE_URL) return { url: process.env.E2E_BASE_URL.replace(/\/$/, ''), dataDir: '', stop: async () => {} };
  buildOnce();
  const dataDir = await mkdtemp(join(tmpdir(), 'xuong-dep-e2e-'));
  const args = ['bun', 'dev/server.ts', '--port', '0', '--data', dataDir];
  if (opts.dist) args.push('--dist');
  const proc = Bun.spawn(args, { cwd: ROOT, stdout: 'pipe', stderr: 'inherit' });
  const reader = proc.stdout.getReader();
  let buf = '';
  const deadline = Date.now() + 20_000;
  while (!/READY (\S+)/.test(buf)) {
    if (Date.now() > deadline) throw new Error('server did not start: ' + buf);
    const { value, done } = await reader.read();
    if (done) throw new Error('server exited: ' + buf);
    buf += new TextDecoder().decode(value);
  }
  reader.releaseLock();
  const url = buf.match(/READY (\S+)/)![1];
  return { url, dataDir, stop: async () => { proc.kill(); await proc.exited; } };
}

let browser: Browser | null = null;
export async function getBrowser(): Promise<Browser> {
  browser ??= await chromium.launch();
  return browser;
}
export async function closeBrowser() {
  await browser?.close();
  browser = null;
}

export async function phone(): Promise<{ ctx: BrowserContext; page: Page }> {
  const b = await getBrowser();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  return { ctx, page };
}

export const ADMIN = { name: 'anh', password: 'mat-khau-123' };

/** Creates the admin through the API (inside the page's context, so the session cookie is set). */
export async function setupAdmin(page: Page, app: App) {
  await page.goto(app.url + '/');
  await page.evaluate(async (a) => {
    await fetch('/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) });
    await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) });
  }, ADMIN);
  await page.reload();
  await page.getByRole('navigation').waitFor();
}

/** JSON API call from inside the page (uses its session cookie). */
export async function pageApi<T = any>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  return page.evaluate(async ({ method, path, body }) => {
    const r = await fetch(path, {
      method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
    });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return t; }
  }, { method, path, body });
}

export const SAMPLE_COUNTS = [85, 25, 18, 20, 17, 13, 25, 14, 18];

/** Seeds a customer + the 9-design sample order through the API (one real uploaded crop image). */
export async function seedSampleOrder(page: Page, opts: { customer?: string; lang?: string; currency?: string; zalo?: string; soleId?: string | null; strapId?: string | null; styleId?: string | null; price?: number | null; counts?: number[]; twoLines?: boolean; note?: string } = {}) {
  return page.evaluate(async (o) => {
    const j = async (method: string, path: string, body?: unknown) => {
      const r = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = await r.json();
      if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + JSON.stringify(data));
      return data;
    };
    const c = document.createElement('canvas');
    c.width = 60; c.height = 60;
    const g = c.getContext('2d')!; g.fillStyle = '#d94841'; g.fillRect(0, 0, 60, 60);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg'));
    const up = await (await fetch('/api/images?w=60&h=60', { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg' } })).json();
    const cust = await j('POST', '/api/customers', { name: o.customer ?? 'chị Nga', lang: o.lang ?? 'vi', currency: o.currency ?? 'VND', zalo: o.zalo ?? '' });
    const id = crypto.randomUUID();
    const counts = o.counts ?? [85, 25, 18, 20, 17, 13, 25, 14, 18];
    const order = {
      customerId: cust.id, currency: o.currency ?? 'VND', neededBy: null, note: '', allowPublic: false,
      images: [{ id: up.id, key: up.key, width: 60, height: 60 }],
      items: counts.map((n, i) => ({
        id: crypto.randomUUID(), designId: crypto.randomUUID(), imageId: up.id, tagNo: i + 1, tapX: 0.5, tapY: 0.5,
        crop: { x: 0, y: 0, w: 1, h: 1 }, cropKey: up.key, soleId: o.soleId ?? null, strapId: o.strapId ?? null, styleId: o.styleId ?? null, colorNote: o.note ?? '',
        lines: [{ id: crypto.randomUUID(), lineKey: 'nam', sizeFrom: 39, sizeTo: 44, mode: o.twoLines ? 'per_size' : 'even', qtyEach: n,
          perSize: o.twoLines ? { '39': n, '40': n, '41': n, '42': n, '43': n, '44': n } : {}, unitPrice: o.price ?? null },
          ...(o.twoLines ? [{ id: crypto.randomUUID(), lineKey: 'nu', sizeFrom: 35, sizeTo: 40, mode: 'per_size', qtyEach: 0,
            perSize: { '35': 5, '36': 6, '37': 7, '38': 8, '39': 9, '40': 10 }, unitPrice: o.price ?? null }] : [])],
      })),
    };
    return j('PUT', `/api/orders/${id}`, order);
  }, opts);
}
