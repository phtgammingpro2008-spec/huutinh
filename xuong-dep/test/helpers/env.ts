import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqliteDb } from '../../dev/d1-sqlite';
import { fsBucket } from '../../dev/r2-fs';
import { migrate } from '../../dev/migrate';
import type { Env } from '../../src/worker/env';

export async function createTestEnv(opts: { now?: () => Date } = {}): Promise<Env> {
  const db = sqliteDb(':memory:');
  migrate(db);
  const dir = await mkdtemp(join(tmpdir(), 'xuong-dep-r2-'));
  return { DB: db, IMAGES: fsBucket(dir), APP_URL: 'https://xuong.test', NOW: opts.now, EMAIL_OUTBOX: [] };
}
