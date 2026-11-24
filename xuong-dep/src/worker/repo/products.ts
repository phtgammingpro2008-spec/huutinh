import { foldSearch } from '../../shared/search';
import type { Lang, LineSetting } from '../../shared/types';
import type { Env, Stmt } from '../env';
import { HttpError, newId, nowIso, str } from '../http';
import type { SessionUser } from '../roles';
import { parseJson } from './rows';

export type Names = Record<Lang, string>;
export type Color = { id: string; name: Names; imageKey: string; designId: string | null };
export type Product = {
  id: string; slug: string; name: Names; desc: Names; styleId: string | null; soleId: string | null; strapId: string | null;
  lines: LineSetting[]; isNew: boolean; published: boolean; hasBrandLogo: boolean; position: number; colors: Color[];
};
export type Collection = { id: string; title: Names; subtitle: Names; coverKey: string | null; color: string; published: boolean; position: number; productIds: string[] };
export type Poster = {
  id: string; tag: Names; title: Names; body: Names; imageKey: string | null; ctaLabel: Names; ctaHref: string; published: boolean; position: number;
  /** 'promo' = the printed-poster look: stats and colour grid from `productId`, `highlight` line in `accent`, `badge` on the photo. */
  layout: 'classic' | 'promo'; productId: string | null; accent: string; highlight: Names; badge: Names;
};
export type Contact = { name: string; phone: string };
/** Contact block of the site: one address (empty = Phnom Penh), the CEO and the sales manager (phone = Zalo). */
export type Shop = { address: string; messenger: string; ceo: Contact; sales: Contact };

const bad = (msg: string, code?: string): never => { throw Object.assign(new HttpError(400, msg), { code }); };
const names = (v: any, max = 200, required = false, what = 'tên'): Names => {
  const out = { vi: str(v?.vi, max), en: str(v?.en, max), km: str(v?.km, max) };
  if (required && !out.vi) bad(`Cần nhập ${what} tiếng Việt`);
  return out;
};
const row3 = (r: any, f: string): Names => ({ vi: r[`${f}_vi`] ?? '', en: r[`${f}_en`] ?? '', km: r[`${f}_km`] ?? '' });
const flag = (v: unknown) => (v === true ? 1 : 0);
const pos = (v: unknown) => (Number.isInteger(v) ? (v as number) : 0);
const IMAGE_KEY = /^(img|pub)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

function parseLines(v: unknown): LineSetting[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 10).map((l: any) => {
    if (!Number.isInteger(l?.sizeFrom) || !Number.isInteger(l?.sizeTo) || l.sizeFrom < 1 || l.sizeTo > 60 || l.sizeFrom > l.sizeTo) bad('Dải size không hợp lệ');
    const key = str(l.key, 40) || bad('Thiếu mã dòng size');
    return { key, label: names(l.label, 60, true, 'tên dòng size'), sizeFrom: l.sizeFrom, sizeTo: l.sizeTo };
  });
}

/** Product images must be the workshop's own: a public upload, or the crop of a design the workshop entered. */
async function checkColorImage(env: Env, key: string): Promise<void> {
  if (!IMAGE_KEY.test(key)) bad('Ảnh màu không hợp lệ');
  if (key.startsWith('pub/')) return;
  const d = await env.DB.prepare("SELECT 1 FROM designs WHERE crop_key = ? AND source = 'admin'").bind(key).first();
  if (!d) bad('Không dùng ảnh khách gửi cho trang công khai', 'customer_photo_not_allowed');
}

async function uniqueSlug(env: Env, name: string, selfId: string): Promise<string> {
  const base = foldSearch(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'san-pham';
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const hit = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first<{ id: string }>();
    if (!hit || hit.id === selfId) return slug;
  }
}

async function colorsOf(env: Env, productIds: string[]): Promise<Map<string, (Color & { brand: boolean })[]>> {
  const rows = (await env.DB.prepare(
    `SELECT pc.*, COALESCE(d.has_brand_logo, 0) AS brand FROM product_colors pc LEFT JOIN designs d ON d.id = pc.design_id
     WHERE pc.product_id IN (SELECT value FROM json_each(?)) ORDER BY pc.position`,
  ).bind(JSON.stringify(productIds)).all<any>()).results;
  const out = new Map<string, (Color & { brand: boolean })[]>();
  for (const r of rows) {
    const list = out.get(r.product_id) ?? [];
    list.push({ id: r.id, name: row3(r, 'name'), imageKey: r.image_key, designId: r.design_id, brand: !!r.brand });
    out.set(r.product_id, list);
  }
  return out;
}

const mapProduct = (r: any, colors: Color[]): Product => ({
  id: r.id, slug: r.slug, name: row3(r, 'name'), desc: row3(r, 'desc'), styleId: r.style_id, soleId: r.sole_id, strapId: r.strap_id,
  lines: parseJson(r.lines, []), isNew: !!r.is_new, published: !!r.published, hasBrandLogo: !!r.has_brand_logo, position: r.position, colors,
});

export async function listProducts(env: Env, opts: { publicOnly?: boolean } = {}): Promise<Product[]> {
  const rows = (await env.DB.prepare(
    `SELECT * FROM products ${opts.publicOnly ? 'WHERE published = 1 AND has_brand_logo = 0' : ''} ORDER BY position, created_at DESC`,
  ).all<any>()).results;
  const colors = await colorsOf(env, rows.map((r) => r.id));
  return rows.map((r) => {
    const cs = colors.get(r.id) ?? [];
    return mapProduct(r, (opts.publicOnly ? cs.filter((c) => !c.brand) : cs).map(({ brand: _b, ...c }) => c));
  });
}

export async function getProduct(env: Env, idOrSlug: string): Promise<Product | null> {
  const r = await env.DB.prepare('SELECT * FROM products WHERE id = ?1 OR slug = ?1').bind(idOrSlug).first<any>();
  if (!r) return null;
  return mapProduct(r, ((await colorsOf(env, [r.id])).get(r.id) ?? []).map(({ brand: _b, ...c }) => c));
}

export async function saveProduct(env: Env, b: any, id: string | null): Promise<Product> {
  const name = names(b.name, 120, true);
  const colorsIn: any[] = Array.isArray(b.colors) ? b.colors.slice(0, 40) : [];
  for (const c of colorsIn) await checkColorImage(env, str(c?.imageKey, 200));
  const productId = id ?? newId();
  const slug = await uniqueSlug(env, name.vi, productId);
  const desc = names(b.desc, 1000);
  const colors = colorsIn.map((c, i) => ({
    id: str(c.id, 60) || newId(), productId, position: i, imageKey: str(c.imageKey, 200),
    designId: str(c.designId, 100) || null, ...Object.fromEntries(Object.entries(names(c.name, 60, true, 'tên màu')).map(([k, v]) => [`name_${k}`, v])),
  }));
  const vals = [slug, name.vi, name.en, name.km, desc.vi, desc.en, desc.km, str(b.styleId, 100) || null, str(b.soleId, 100) || null,
    str(b.strapId, 100) || null, JSON.stringify(parseLines(b.lines)), flag(b.isNew), flag(b.published), flag(b.hasBrandLogo), pos(b.position)];
  const head: Stmt = id
    ? env.DB.prepare(`UPDATE products SET slug=?, name_vi=?, name_en=?, name_km=?, desc_vi=?, desc_en=?, desc_km=?, style_id=?, sole_id=?, strap_id=?,
        lines=?, is_new=?, published=?, has_brand_logo=?, position=? WHERE id=?`).bind(...vals, productId)
    : env.DB.prepare(`INSERT INTO products (slug, name_vi, name_en, name_km, desc_vi, desc_en, desc_km, style_id, sole_id, strap_id,
        lines, is_new, published, has_brand_logo, position, id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...vals, productId, nowIso(env));
  await env.DB.batch([
    head,
    env.DB.prepare('DELETE FROM product_colors WHERE product_id = ?').bind(productId),
    env.DB.prepare(
      `INSERT INTO product_colors (id, product_id, name_vi, name_en, name_km, image_key, design_id, position)
       SELECT json_extract(value,'$.id'), json_extract(value,'$.productId'), json_extract(value,'$.name_vi'), json_extract(value,'$.name_en'),
              json_extract(value,'$.name_km'), json_extract(value,'$.imageKey'), json_extract(value,'$.designId'), json_extract(value,'$.position')
       FROM json_each(?)`,
    ).bind(JSON.stringify(colors)),
  ]);
  return (await getProduct(env, productId))!;
}

export async function deleteProduct(env: Env, id: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM collection_products WHERE product_id = ?').bind(id),
    env.DB.prepare('DELETE FROM product_colors WHERE product_id = ?').bind(id),
    env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id),
  ]);
}

// ---- collections ----
async function mapCollections(env: Env, rows: any[]): Promise<Collection[]> {
  const links = (await env.DB.prepare(
    'SELECT collection_id, product_id FROM collection_products WHERE collection_id IN (SELECT value FROM json_each(?)) ORDER BY position',
  ).bind(JSON.stringify(rows.map((r) => r.id))).all<{ collection_id: string; product_id: string }>()).results;
  return rows.map((r) => ({
    id: r.id, title: row3(r, 'title'), subtitle: row3(r, 'subtitle'), coverKey: r.cover_key, color: r.color,
    published: !!r.published, position: r.position, productIds: links.filter((l) => l.collection_id === r.id).map((l) => l.product_id),
  }));
}
export async function listCollections(env: Env, publicOnly = false): Promise<Collection[]> {
  return mapCollections(env, (await env.DB.prepare(`SELECT * FROM collections ${publicOnly ? 'WHERE published = 1' : ''} ORDER BY position`).all<any>()).results);
}
export async function saveCollection(env: Env, b: any, id: string | null): Promise<Collection> {
  const cid = id ?? newId();
  const title = names(b.title, 120, true, 'tiêu đề'), sub = names(b.subtitle, 200);
  const cover = str(b.coverKey, 200) || null;
  if (cover && !cover.startsWith('pub/')) bad('Ảnh bìa phải tải lên ở mục Trang web');
  const color = /^#[0-9a-f]{6}$/i.test(String(b.color ?? '')) ? b.color : '#1b3b2c';
  const productIds: string[] = Array.isArray(b.productIds) ? b.productIds.map((x: unknown) => str(x, 100)).filter(Boolean).slice(0, 200) : [];
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO collections (id, title_vi, title_en, title_km, subtitle_vi, subtitle_en, subtitle_km, cover_key, color, published, position)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title_vi=excluded.title_vi, title_en=excluded.title_en, title_km=excluded.title_km,
      subtitle_vi=excluded.subtitle_vi, subtitle_en=excluded.subtitle_en, subtitle_km=excluded.subtitle_km, cover_key=excluded.cover_key,
      color=excluded.color, published=excluded.published, position=excluded.position`)
      .bind(cid, title.vi, title.en, title.km, sub.vi, sub.en, sub.km, cover, color, flag(b.published), pos(b.position)),
    env.DB.prepare('DELETE FROM collection_products WHERE collection_id = ?').bind(cid),
    env.DB.prepare(`INSERT INTO collection_products (collection_id, product_id, position)
      SELECT ?, p.id, j.key FROM json_each(?) j JOIN products p ON p.id = j.value`).bind(cid, JSON.stringify(productIds)),
  ]);
  return (await mapCollections(env, [await env.DB.prepare('SELECT * FROM collections WHERE id = ?').bind(cid).first<any>()]))[0];
}
export async function deleteCollection(env: Env, id: string) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM collection_products WHERE collection_id = ?').bind(id),
    env.DB.prepare('DELETE FROM collections WHERE id = ?').bind(id),
  ]);
}

// ---- posters ----
const mapPoster = (r: any): Poster => ({
  id: r.id, tag: row3(r, 'tag'), title: row3(r, 'title'), body: row3(r, 'body'), imageKey: r.image_key, ctaLabel: row3(r, 'cta_label'),
  ctaHref: r.cta_href, published: !!r.published, position: r.position,
  layout: r.layout === 'promo' ? 'promo' : 'classic', productId: r.product_id ?? null, accent: r.accent || '#E2B65B',
  highlight: row3(r, 'highlight'), badge: row3(r, 'badge'),
});
export async function listPosters(env: Env, publicOnly = false): Promise<Poster[]> {
  return (await env.DB.prepare(`SELECT * FROM posters ${publicOnly ? 'WHERE published = 1' : ''} ORDER BY position`).all<any>()).results.map(mapPoster);
}
export async function savePoster(env: Env, b: any, id: string | null): Promise<Poster> {
  const pid = id ?? newId();
  const tag = names(b.tag, 60), title = names(b.title, 160, true, 'tiêu đề'), body = names(b.body, 600), cta = names(b.ctaLabel, 60);
  const hl = names(b.highlight, 80), badge = names(b.badge, 80);
  const layout = b.layout === 'promo' ? 'promo' : 'classic';
  const accent = /^#[0-9a-f]{6}$/i.test(String(b.accent ?? '')) ? String(b.accent) : '#E2B65B';
  const productId = str(b.productId, 100) || null;
  const img = str(b.imageKey, 200) || null;
  if (img && !img.startsWith('pub/')) bad('Ảnh poster phải tải lên ở mục Trang web');
  const href = str(b.ctaHref, 300);
  if (href && !/^(\/|https:\/\/)/.test(href)) bad('Link nút phải bắt đầu bằng / hoặc https://');
  await env.DB.prepare(`INSERT INTO posters (id, tag_vi, tag_en, tag_km, title_vi, title_en, title_km, body_vi, body_en, body_km, image_key,
      cta_label_vi, cta_label_en, cta_label_km, cta_href, published, position,
      layout, product_id, accent, highlight_vi, highlight_en, highlight_km, badge_vi, badge_en, badge_km) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET tag_vi=excluded.tag_vi, tag_en=excluded.tag_en, tag_km=excluded.tag_km, title_vi=excluded.title_vi,
      title_en=excluded.title_en, title_km=excluded.title_km, body_vi=excluded.body_vi, body_en=excluded.body_en, body_km=excluded.body_km,
      image_key=excluded.image_key, cta_label_vi=excluded.cta_label_vi, cta_label_en=excluded.cta_label_en, cta_label_km=excluded.cta_label_km,
      cta_href=excluded.cta_href, published=excluded.published, position=excluded.position, layout=excluded.layout,
      product_id=excluded.product_id, accent=excluded.accent, highlight_vi=excluded.highlight_vi, highlight_en=excluded.highlight_en,
      highlight_km=excluded.highlight_km, badge_vi=excluded.badge_vi, badge_en=excluded.badge_en, badge_km=excluded.badge_km`)
    .bind(pid, tag.vi, tag.en, tag.km, title.vi, title.en, title.km, body.vi, body.en, body.km, img, cta.vi, cta.en, cta.km, href, flag(b.published), pos(b.position),
      layout, productId, accent, hl.vi, hl.en, hl.km, badge.vi, badge.en, badge.km).run();
  return mapPoster(await env.DB.prepare('SELECT * FROM posters WHERE id = ?').bind(pid).first<any>());
}
export async function deletePoster(env: Env, id: string) {
  await env.DB.prepare('DELETE FROM posters WHERE id = ?').bind(id).run();
}

// ---- home page picture strip ----
export type GalleryItem = { id: string; imageKey: string; caption: Names; href: string; published: boolean; position: number };
const mapGallery = (r: any): GalleryItem => ({
  id: r.id, imageKey: r.image_key, caption: row3(r, 'caption'), href: r.href, published: !!r.published, position: r.position,
});
export async function listGallery(env: Env, publicOnly = false): Promise<GalleryItem[]> {
  return (await env.DB.prepare(`SELECT * FROM gallery ${publicOnly ? 'WHERE published = 1' : ''} ORDER BY position, id`).all<any>()).results.map(mapGallery);
}
export async function saveGallery(env: Env, b: any, id: string | null): Promise<GalleryItem> {
  const gid = id ?? newId();
  const img = str(b.imageKey, 200);
  if (!img.startsWith('pub/')) bad('Ảnh phải tải lên ở mục Trang web');
  const href = str(b.href, 300);
  if (href && !/^(\/|https:\/\/)/.test(href)) bad('Link phải bắt đầu bằng / hoặc https://');
  const cap = names(b.caption, 120);
  await env.DB.prepare(`INSERT INTO gallery (id, image_key, caption_vi, caption_en, caption_km, href, published, position) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET image_key=excluded.image_key, caption_vi=excluded.caption_vi, caption_en=excluded.caption_en,
      caption_km=excluded.caption_km, href=excluded.href, published=excluded.published, position=excluded.position`)
    .bind(gid, img, cap.vi, cap.en, cap.km, href, b.published === false ? 0 : 1, pos(b.position)).run();
  return mapGallery(await env.DB.prepare('SELECT * FROM gallery WHERE id = ?').bind(gid).first<any>());
}
export async function deleteGallery(env: Env, id: string) {
  await env.DB.prepare('DELETE FROM gallery WHERE id = ?').bind(id).run();
}

// ---- shop info ----
export async function getShop(env: Env): Promise<Shop> {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'shop'").first<{ value: string }>();
  const v = parseJson<any>(r?.value, {});
  const contact = (c: any): Contact => ({ name: str(c?.name, 100), phone: str(c?.phone, 40) });
  // before 2a.1 the block was one Zalo and two addresses: Zalo became the sales contact, the warehouse the address
  return {
    address: str(v.address ?? (v.warehouseAddress || v.workshopAddress), 300),
    messenger: str(v.messenger, 200),
    ceo: contact(v.ceo),
    sales: v.sales ? contact(v.sales) : { name: '', phone: str(v.zalo, 40) },
  };
}
export async function saveShop(env: Env, b: any): Promise<Shop> {
  const contact = (c: any): Contact => ({ name: str(c?.name, 100), phone: str(c?.phone, 40) });
  const shop: Shop = { address: str(b.address, 300), messenger: str(b.messenger, 200), ceo: contact(b.ceo), sales: contact(b.sales) };
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('shop', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(shop)).run();
  return shop;
}

// ---- what the public site shows ----
export async function getPublicHome(env: Env) {
  const products = await listProducts(env, { publicOnly: true });
  const ids = new Set(products.map((p) => p.id));
  const collections = (await listCollections(env, true)).map((c) => ({ ...c, productIds: c.productIds.filter((id) => ids.has(id)) }));
  const styles = (await env.DB.prepare("SELECT id, name_vi, name_en, name_km FROM materials WHERE kind = 'style' AND hidden = 0 ORDER BY name_vi").all<any>()).results
    .map((m) => ({ id: m.id as string, name: row3(m, 'name') }));
  return { posters: await listPosters(env, true), collections, products, styles, shop: await getShop(env), gallery: await listGallery(env, true) };
}

/** Guests see the first colour and no size lines; logged-in users see everything. Brand-logo products never. */
export async function getPublicProduct(env: Env, slug: string, user: SessionUser | null): Promise<Product | null> {
  const p = (await listProducts(env, { publicOnly: true })).find((x) => x.slug === slug);
  if (!p) return null;
  return user ? p : { ...p, colors: p.colors.slice(0, 1), lines: [] };
}
