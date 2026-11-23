// Unit tests import the worker, which imports the build-generated assets module.
// When no build has run yet, write an empty stub so the import resolves.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const gen = join(import.meta.dir, '../src/worker/assets.gen.ts');
if (!existsSync(gen)) {
  writeFileSync(gen, '// stub written by test/preload.ts; `bun run build` replaces it\nexport type Asset = { type: string; body: string; b64?: boolean; immutable?: boolean };\nexport const ASSETS: Record<string, Asset> = {};\n');
}
