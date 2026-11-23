import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqliteDb } from '../../dev/d1-sqlite';
import { fsBucket } from '../../dev/r2-fs';
import type { Env } from '../../src/worker/env';

const SCHEMA = await Bun.file(join(import.meta.dir, '../../schema/schema.sql')).text();

export async function createTestEnv(opts: { now?: () => Date } = {}): Promise<Env> {
  const db = sqliteDb(':memory:');
  db.exec(SCHEMA);
  const dir = await mkdtemp(join(tmpdir(), 'xuong-dep-r2-'));
  return { DB: db, IMAGES: fsBucket(dir), APP_URL: 'https://xuong.test', NOW: opts.now };
}
