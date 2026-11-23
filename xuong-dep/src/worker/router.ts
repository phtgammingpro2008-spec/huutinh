import type { Env } from './env';

export type Ctx = { userId?: string };
export type Handler = (req: Request, env: Env, p: Record<string, string>, ctx: Ctx) => Promise<Response>;

type Route = { method: string; parts: string[]; h: Handler };

export class Router {
  private routes: Route[] = [];

  on(method: string, pattern: string, h: Handler): this {
    this.routes.push({ method, parts: pattern.split('/').filter(Boolean), h });
    return this;
  }

  /** Returns null when no route matches the path; 405 json when the path matches another method. */
  async handle(req: Request, env: Env, ctx: Ctx): Promise<Response | null> {
    const segs = new URL(req.url).pathname.split('/').filter(Boolean).map(safeDecode);
    let pathMatched = false;
    for (const r of this.routes) {
      const p = match(r.parts, segs);
      if (!p) continue;
      pathMatched = true;
      if (r.method === req.method || (req.method === 'HEAD' && r.method === 'GET')) return r.h(req, env, p, ctx);
    }
    if (pathMatched) {
      return new Response(JSON.stringify({ error: 'Phương thức không hỗ trợ' }), {
        status: 405, headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    return null;
  }
}

function safeDecode(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function match(parts: string[], segs: string[]): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '*') { out['*'] = segs.slice(i).join('/'); return segs.length > i ? out : null; }
    if (i >= segs.length) return null;
    if (part.startsWith(':')) out[part.slice(1)] = segs[i];
    else if (part !== segs[i]) return null;
  }
  return parts.length === segs.length ? out : null;
}
