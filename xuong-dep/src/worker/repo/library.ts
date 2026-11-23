/** A library design other customers may see (alias `d` = designs). */
export const LIBRARY_VISIBLE = 'd.is_private = 0 AND d.hidden = 0';

import type { Env } from '../env';
import { foldSearch } from '../../shared/search';

export type LibraryItem = { id: string; cropKey: string; styleId: string | null; soleId: string | null; strapId: string | null; note: string; orderCount: number };
export type LibraryFilter = { styleId?: string; soleId?: string; strapId?: string; q?: string; sort?: 'new' | 'popular'; offset?: number };
export const LIBRARY_PAGE = 40;

/** The shared library as other customers see it: crops and materials only — no original photo, orderer, quantities or prices. */
export async function listLibrary(env: Env, f: LibraryFilter): Promise<{ items: LibraryItem[]; next: number | null }> {
  const offset = Math.max(0, f.offset ?? 0);
  const order = f.sort === 'popular' ? 'order_count DESC, d.created_at DESC' : 'd.created_at DESC';
  const rows = (await env.DB.prepare(
    `SELECT d.id, d.crop_key, d.style_id, d.sole_id, d.strap_id, d.note,
       (SELECT COUNT(DISTINCT it.order_id) FROM order_items it WHERE it.design_id = d.id) AS order_count
     FROM designs d
     WHERE ${LIBRARY_VISIBLE} AND (?1 IS NULL OR d.style_id = ?1) AND (?2 IS NULL OR d.sole_id = ?2) AND (?3 IS NULL OR d.strap_id = ?3)
       AND (?4 = '' OR d.note_search LIKE '%' || ?4 || '%')
     ORDER BY ${order}, d.id LIMIT ?5 OFFSET ?6`,
  ).bind(f.styleId || null, f.soleId || null, f.strapId || null, foldSearch(f.q ?? ''), LIBRARY_PAGE + 1, offset)
    .all<{ id: string; crop_key: string; style_id: string | null; sole_id: string | null; strap_id: string | null; note: string; order_count: number }>()).results;
  const items = rows.slice(0, LIBRARY_PAGE).map((r) => ({
    id: r.id, cropKey: r.crop_key, styleId: r.style_id, soleId: r.sole_id, strapId: r.strap_id, note: r.note, orderCount: r.order_count,
  }));
  return { items, next: rows.length > LIBRARY_PAGE ? offset + LIBRARY_PAGE : null };
}
