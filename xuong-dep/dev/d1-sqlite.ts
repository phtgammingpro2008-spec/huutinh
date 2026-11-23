// Dev/test only: a D1-shaped wrapper around bun:sqlite. Never imported by src/worker.
import { Database } from 'bun:sqlite';
import type { Db, Stmt } from '../src/worker/env';

type SqlValue = string | number | bigint | boolean | null | Uint8Array;

class SqliteStmt implements Stmt {
  constructor(private db: Database, readonly sql: string, readonly values: SqlValue[] = []) {}
  bind(...values: unknown[]): Stmt {
    return new SqliteStmt(this.db, this.sql, values.map((v) => (v === undefined ? null : (v as SqlValue))));
  }
  async first<T>(): Promise<T | null> {
    return (this.db.query(this.sql).get(...this.values) as T | null) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.query(this.sql).all(...this.values) as T[] };
  }
  async run(): Promise<unknown> {
    return this.db.query(this.sql).run(...this.values);
  }
  runSync() {
    return this.db.query(this.sql).run(...this.values);
  }
}

export function sqliteDb(path: string): Db & { exec(sql: string): void } {
  const db = new Database(path, { create: true });
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;'); // D1 enforces foreign keys
  return {
    prepare: (sql: string) => new SqliteStmt(db, sql),
    async batch(statements: Stmt[]) {
      const tx = db.transaction(() => statements.map((s) => (s as SqliteStmt).runSync()));
      return tx();
    },
    exec: (sql: string) => db.exec(sql),
  };
}
