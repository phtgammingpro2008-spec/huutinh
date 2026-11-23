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
