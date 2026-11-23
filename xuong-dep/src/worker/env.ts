/**
 * The minimal slice of the D1 / R2 binding APIs the worker uses.
 * The same code runs on Cloudflare and under the Bun shims in dev/.
 */
export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface Db {
  prepare(sql: string): Stmt;
  /** Runs all statements in one transaction. */
  batch(statements: Stmt[]): Promise<unknown[]>;
}

export interface StoredObject {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}

export interface Bucket {
  put(key: string, body: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

export type Env = {
  DB: Db;
  IMAGES: Bucket;
  APP_URL?: string;
  /** Test hook: fixed clock. */
  NOW?: () => Date;
  /** Resend API key and sender ("HLUXURY <no-reply@domain>"); email is off until both are set. */
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  /** Test/dev hook: emails are collected here instead of being sent. */
  EMAIL_OUTBOX?: { to: string; subject: string; html: string }[];
};
