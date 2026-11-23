// Builds, then zips the source (tracked files) plus dist/ into xuong-dep-<yyyy-mm-dd>.zip.
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from './build';

const ROOT = join(import.meta.dir, '..');
await build();
const date = new Date().toISOString().slice(0, 10);
const out = join(ROOT, `xuong-dep-${date}.zip`);
const files = Bun.spawnSync(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT }).stdout.toString()
  .split('\n').filter(Boolean);
await rm(out, { force: true });
const r = Bun.spawnSync(['zip', '-q', '-X', out, ...files, 'dist/worker.js', 'dist/schema.sql'], { cwd: ROOT, stderr: 'pipe' });
if (r.exitCode !== 0) throw new Error(r.stderr.toString());
console.log(`wrote ${out} (${(Bun.file(out).size / 1024).toFixed(0)} KB, ${files.length + 2} files)`);
