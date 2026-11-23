// Local server: runs the worker under Bun with SQLite (D1) and a folder (R2).
// Usage: bun dev/server.ts [--port 8787] [--data dev-data] [--dist]
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { sqliteDb } from './d1-sqlite';
import { fsBucket } from './r2-fs';
import type { Env } from '../src/worker/env';

const ROOT = join(import.meta.dir, '..');
const { values } = parseArgs({
  options: { port: { type: 'string', default: '8787' }, data: { type: 'string', default: 'dev-data' }, dist: { type: 'boolean', default: false } },
});

const dataDir = resolve(ROOT, values.data!);
await mkdir(join(dataDir, 'r2'), { recursive: true });
const db = sqliteDb(join(dataDir, 'd1.sqlite'));
db.exec(await Bun.file(join(ROOT, 'schema/schema.sql')).text());

const mod = values.dist ? await import(join(ROOT, 'dist/worker.js')) : await import('../src/worker/index');
const worker = mod.default as { fetch(req: Request, env: Env): Promise<Response> };
const env: Env = { DB: db, IMAGES: fsBucket(join(dataDir, 'r2')) };

const server = Bun.serve({
  port: Number(values.port),
  hostname: '127.0.0.1',
  maxRequestBodySize: 20 * 1024 * 1024,
  fetch: (req) => worker.fetch(req, env),
});
const url = `http://127.0.0.1:${server.port}`;
console.log(`READY ${url}${values.dist ? ' (dist/worker.js)' : ''}`);
