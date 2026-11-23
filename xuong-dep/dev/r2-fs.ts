// Dev/test only: an R2-shaped bucket backed by a directory. Never imported by src/worker.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Bucket } from '../src/worker/env';

export function fsBucket(dir: string): Bucket {
  const root = resolve(dir);
  const pathOf = (key: string) => {
    const p = resolve(root, key);
    if (!p.startsWith(root + '/')) throw new Error('bad key');
    return p;
  };
  return {
    async put(key, body, opts) {
      const p = pathOf(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, new Uint8Array(body));
      await writeFile(p + '.meta.json', JSON.stringify(opts?.httpMetadata ?? {}));
    },
    async get(key) {
      const p = pathOf(key);
      let data: Buffer;
      try { data = await readFile(p); } catch { return null; }
      let meta: { contentType?: string } = {};
      try { meta = JSON.parse(await readFile(p + '.meta.json', 'utf8')); } catch { /* none */ }
      const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      return { arrayBuffer: async () => ab, httpMetadata: meta };
    },
    async delete(key) {
      const p = pathOf(key);
      await rm(p, { force: true });
      await rm(p + '.meta.json', { force: true });
    },
  };
}
