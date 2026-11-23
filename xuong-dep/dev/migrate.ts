// Dev/test only: schema.sql, then every migrations/*.sql not yet applied (tracked like wrangler's d1_migrations).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from 'bun:sqlite';

const ROOT = join(import.meta.dir, '..');

export function migrate(db: { exec(sql: string): void; raw: Database }): string[] {
  db.exec(readFileSync(join(ROOT, 'schema/schema.sql'), 'utf8'));
  db.exec("CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)");
  const done = new Set(db.raw.query('SELECT name FROM d1_migrations').all().map((r: any) => r.name as string));
  const applied: string[] = [];
  for (const name of readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    const sql = readFileSync(join(ROOT, 'migrations', name), 'utf8');
    db.raw.transaction(() => {
      db.exec(sql);
      db.raw.query('INSERT INTO d1_migrations (name) VALUES (?)').run(name);
    })();
    applied.push(name);
  }
  return applied;
}
