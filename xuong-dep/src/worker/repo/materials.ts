import type { Lang } from '../../shared/types';
import type { Env } from '../env';

export type MaterialKind = 'sole' | 'strap' | 'style';
export const MATERIAL_KINDS: MaterialKind[] = ['sole', 'strap', 'style'];

export type Material = { id: string; kind: MaterialKind; nameVi: string; nameEn: string; nameKm: string; hidden: boolean };
type Row = { id: string; kind: MaterialKind; name_vi: string; name_en: string; name_km: string; hidden: number };

const map = (r: Row): Material => ({ id: r.id, kind: r.kind, nameVi: r.name_vi, nameEn: r.name_en, nameKm: r.name_km, hidden: !!r.hidden });

export async function listMaterials(env: Env, opts: { kind?: string; all?: boolean } = {}): Promise<Material[]> {
  const r = await env.DB.prepare(
    'SELECT * FROM materials WHERE (? IS NULL OR kind = ?) AND (? = 1 OR hidden = 0) ORDER BY kind, name_vi COLLATE NOCASE',
  ).bind(opts.kind ?? null, opts.kind ?? null, opts.all ? 1 : 0).all<Row>();
  return r.results.map(map);
}

export async function getMaterial(env: Env, id: string): Promise<Material | null> {
  const r = await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first<Row>();
  return r ? map(r) : null;
}

export async function getMaterialsByIds(env: Env, ids: (string | null)[]): Promise<Map<string, Material>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, Material>();
  if (!want.length) return out;
  const r = await env.DB.prepare('SELECT * FROM materials WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(want)).all<Row>();
  for (const row of r.results) out.set(row.id, map(row));
  return out;
}

export async function saveMaterial(env: Env, m: Material, isNew: boolean): Promise<void> {
  if (isNew) {
    await env.DB.prepare('INSERT INTO materials (id, kind, name_vi, name_en, name_km, hidden) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(m.id, m.kind, m.nameVi, m.nameEn, m.nameKm, m.hidden ? 1 : 0).run();
  } else {
    await env.DB.prepare('UPDATE materials SET kind = ?, name_vi = ?, name_en = ?, name_km = ?, hidden = ? WHERE id = ?')
      .bind(m.kind, m.nameVi, m.nameEn, m.nameKm, m.hidden ? 1 : 0, m.id).run();
  }
}

/** Name in the given language, falling back to Vietnamese. */
export function materialName(m: Material | undefined, lang: Lang): string {
  if (!m) return '';
  const v = lang === 'en' ? m.nameEn : lang === 'km' ? m.nameKm : m.nameVi;
  return v || m.nameVi;
}
