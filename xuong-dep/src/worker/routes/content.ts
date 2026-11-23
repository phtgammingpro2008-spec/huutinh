import { err, json, readJson } from '../http';
import { listLibrary } from '../repo/library';
import { listMaterials } from '../repo/materials';
import { getSettings } from '../repo/settings';
import {
  deleteCollection, deletePoster, deleteProduct, getProduct, getShop, listCollections, listPosters, listProducts,
  saveCollection, savePoster, saveProduct, saveShop,
} from '../repo/products';
import { requireAdmin, requireCustomer } from '../roles';
import type { Router } from '../router';

export function contentRoutes(r: Router) {
  // ---- admin: products, collections, posters, shop info ----
  r.on('GET', '/api/products', requireAdmin(async (_req, env) => json(await listProducts(env))));
  r.on('POST', '/api/products', requireAdmin(async (req, env) => json(await saveProduct(env, await readJson(req), null))));
  r.on('PUT', '/api/products/:id', requireAdmin(async (req, env, p) => {
    if (!(await getProduct(env, p.id))) return err(404, 'Không tìm thấy sản phẩm');
    return json(await saveProduct(env, await readJson(req), p.id));
  }));
  r.on('DELETE', '/api/products/:id', requireAdmin(async (_req, env, p) => { await deleteProduct(env, p.id); return json({ ok: true }); }));

  r.on('GET', '/api/collections', requireAdmin(async (_req, env) => json(await listCollections(env))));
  r.on('POST', '/api/collections', requireAdmin(async (req, env) => json(await saveCollection(env, await readJson(req), null))));
  r.on('PUT', '/api/collections/:id', requireAdmin(async (req, env, p) => json(await saveCollection(env, await readJson(req), p.id))));
  r.on('DELETE', '/api/collections/:id', requireAdmin(async (_req, env, p) => { await deleteCollection(env, p.id); return json({ ok: true }); }));

  r.on('GET', '/api/posters', requireAdmin(async (_req, env) => json(await listPosters(env))));
  r.on('POST', '/api/posters', requireAdmin(async (req, env) => json(await savePoster(env, await readJson(req), null))));
  r.on('PUT', '/api/posters/:id', requireAdmin(async (req, env, p) => json(await savePoster(env, await readJson(req), p.id))));
  r.on('DELETE', '/api/posters/:id', requireAdmin(async (_req, env, p) => { await deletePoster(env, p.id); return json({ ok: true }); }));

  r.on('GET', '/api/shop', requireAdmin(async (_req, env) => json(await getShop(env))));
  r.on('PUT', '/api/shop', requireAdmin(async (req, env) => json(await saveShop(env, await readJson(req)))));

  // ---- customers: shared library and full product data ----
  r.on('GET', '/api/c/library', requireCustomer(async (req, env) => {
    const sp = new URL(req.url).searchParams;
    const g = (k: string) => sp.get(k) || undefined;
    return json(await listLibrary(env, {
      styleId: g('styleId'), soleId: g('soleId'), strapId: g('strapId'), q: g('q'),
      sort: sp.get('sort') === 'popular' ? 'popular' : 'new', offset: Number(sp.get('cursor') ?? 0) || 0,
    }));
  }));
  /** Size lines and visible materials, for the customer's order form and library filters. */
  r.on('GET', '/api/c/catalog', requireCustomer(async (_req, env) => {
    const [settings, mats] = await Promise.all([getSettings(env), listMaterials(env)]);
    return json({
      lines: settings.lines,
      materials: mats.map((m) => ({ id: m.id, kind: m.kind, name: { vi: m.nameVi, en: m.nameEn, km: m.nameKm } })),
    });
  }));
  r.on('GET', '/api/c/products', requireCustomer(async (_req, env) => json(await listProducts(env, { publicOnly: true }))));
  r.on('GET', '/api/c/products/:slug', requireCustomer(async (_req, env, p) => {
    const prod = (await listProducts(env, { publicOnly: true })).find((x) => x.slug === p.slug);
    return prod ? json(prod) : err(404, 'Không tìm thấy sản phẩm');
  }));
}
