import type { Box, Item, OrderImage } from '../../shared/types';
import type { Env, Stmt } from '../env';
import { parseJson } from './rows';

export type DesignLabel = 'co_dinh' | 'dat_rieng';
export type Design = {
  id: string; cropKey: string; imageId: string | null; imageKey: string | null; crop: Box | null;
  label: DesignLabel; soleId: string | null; strapId: string | null; styleId: string | null;
  note: string; allowPublic: boolean; createdAt: string;
};
type Row = {
  id: string; crop_key: string; image_id: string | null; image_key: string | null; crop: string | null; label: DesignLabel;
  sole_id: string | null; strap_id: string | null; style_id: string | null; note: string; allow_public: number; created_at: string;
};

const SELECT = 'SELECT d.*, i.key AS image_key FROM designs d LEFT JOIN order_images i ON i.id = d.image_id';

const map = (r: Row): Design => ({
  id: r.id, cropKey: r.crop_key, imageId: r.image_id, imageKey: r.image_key, crop: parseJson(r.crop, null),
  label: r.label, soleId: r.sole_id, strapId: r.strap_id, styleId: r.style_id, note: r.note,
  allowPublic: !!r.allow_public, createdAt: r.created_at,
});

export async function getDesign(env: Env, id: string): Promise<Design | null> {
  const r = await env.DB.prepare(`${SELECT} WHERE d.id = ?`).bind(id).first<Row>();
  return r ? map(r) : null;
}

export async function getDesignsByIds(env: Env, ids: string[]): Promise<Map<string, Design>> {
  const r = await env.DB.prepare(`${SELECT} WHERE d.id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).all<Row>();
  return new Map(r.results.map((x) => [x.id, map(x)]));
}

export type DesignFilter = { label?: string; soleId?: string; strapId?: string; styleId?: string; q?: string };

export async function listDesigns(env: Env, f: DesignFilter): Promise<Design[]> {
  const q = f.q?.trim().toLowerCase() ?? '';
  const r = await env.DB.prepare(
    `${SELECT} WHERE (?1 IS NULL OR d.label = ?1) AND (?2 IS NULL OR d.sole_id = ?2) AND (?3 IS NULL OR d.strap_id = ?3)
       AND (?4 IS NULL OR d.style_id = ?4) AND (?5 = '' OR lower(d.note) LIKE '%' || ?5 || '%')
     ORDER BY d.created_at DESC, d.id LIMIT 1000`,
  ).bind(f.label || null, f.soleId || null, f.strapId || null, f.styleId || null, q).all<Row>();
  return r.results.map(map);
}

export function updateDesignStmt(env: Env, d: Design): Stmt {
  return env.DB.prepare(
    'UPDATE designs SET label = ?, note = ?, allow_public = ?, sole_id = ?, strap_id = ?, style_id = ? WHERE id = ?',
  ).bind(d.label, d.note, d.allowPublic ? 1 : 0, d.soleId, d.strapId, d.styleId, d.id);
}

/** One statement for any number of designs (D1 caps bound parameters at 100). Existing ids are left as they are. */
export function insertDesignsStmt(env: Env, items: Item[], allowPublic: boolean, createdAt: string): Stmt {
  const rows = items.map((i) => ({
    id: i.designId, cropKey: i.cropKey, imageId: i.imageId, crop: i.crop, soleId: i.soleId, strapId: i.strapId,
    styleId: i.styleId, note: i.colorNote,
  }));
  return env.DB.prepare(
    `INSERT OR IGNORE INTO designs (id, crop_key, image_id, crop, label, sole_id, strap_id, style_id, note, allow_public, created_at)
     SELECT json_extract(value, '$.id'), json_extract(value, '$.cropKey'), json_extract(value, '$.imageId'),
            json_extract(value, '$.crop'), 'dat_rieng', json_extract(value, '$.soleId'), json_extract(value, '$.strapId'),
            json_extract(value, '$.styleId'), json_extract(value, '$.note'), ?, ?
     FROM json_each(?)`,
  ).bind(allowPublic ? 1 : 0, createdAt, JSON.stringify(rows));
}

export function insertImagesStmt(env: Env, orderId: string | null, images: OrderImage[]): Stmt {
  const rows = images.map((im, position) => ({ ...im, position }));
  return env.DB.prepare(
    `INSERT INTO order_images (id, order_id, key, width, height, position)
     SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.key'), json_extract(value, '$.width'),
            json_extract(value, '$.height'), json_extract(value, '$.position')
     FROM json_each(?) WHERE true
     ON CONFLICT(id) DO UPDATE SET order_id = excluded.order_id, key = excluded.key, width = excluded.width,
       height = excluded.height, position = excluded.position`,
  ).bind(orderId, JSON.stringify(rows));
}

export type DesignUse = { id: string; code: string; status: string; customerName: string; createdAt: string };

export async function designOrders(env: Env, designId: string): Promise<DesignUse[]> {
  const r = await env.DB.prepare(
    `SELECT DISTINCT o.id, o.code, o.status, o.created_at, c.name AS customer_name
     FROM order_items it JOIN orders o ON o.id = it.order_id JOIN customers c ON c.id = o.customer_id
     WHERE it.design_id = ? ORDER BY o.created_at DESC`,
  ).bind(designId).all<{ id: string; code: string; status: string; created_at: string; customer_name: string }>();
  return r.results.map((o) => ({ id: o.id, code: o.code, status: o.status, customerName: o.customer_name, createdAt: o.created_at }));
}
