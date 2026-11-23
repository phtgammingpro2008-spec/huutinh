import { requireAdmin } from '../roles';
import { err, json, nowIso, readJson, str } from '../http';
import { parseImages, parseItems } from '../order-input';
import { designOrders, getDesign, insertDesignsStmt, insertImagesStmt, listDesigns, updateDesignStmt, type DesignLabel } from '../repo/designs';
import type { Router } from '../router';
import { optId } from '../validate';

const LABELS: DesignLabel[] = ['co_dinh', 'dat_rieng'];

export function designRoutes(r: Router) {
  /** "Chỉ lưu vào thư viện": designs (and their source photos) without an order. */
  r.on('POST', '/api/library', requireAdmin(async (req, env) => {
    const b = await readJson(req);
    const images = parseImages(b.images);
    const items = parseItems(b.items, { requireLines: false });
    const missing = items.find((i) => !i.cropKey);
    if (missing) return err(400, `Mẫu số ${missing.tagNo} chưa có ảnh cắt`);
    const at = nowIso(env);
    await env.DB.batch([insertImagesStmt(env, null, images), insertDesignsStmt(env, items, 'admin', at)]);
    return json({ designIds: items.map((i) => i.designId) });
  }));

  r.on('GET', '/api/designs', requireAdmin(async (req, env) => {
    const sp = new URL(req.url).searchParams;
    const g = (k: string) => sp.get(k) || undefined;
    return json(await listDesigns(env, { label: g('label'), soleId: g('soleId'), strapId: g('strapId'), styleId: g('styleId'), q: g('q') }));
  }));

  r.on('GET', '/api/designs/:id', requireAdmin(async (_req, env, p) => {
    const d = await getDesign(env, p.id);
    if (!d) return err(404, 'Không tìm thấy mẫu');
    return json({ ...d, orders: await designOrders(env, d.id) });
  }));

  r.on('PUT', '/api/designs/:id', requireAdmin(async (req, env, p) => {
    const d = await getDesign(env, p.id);
    if (!d) return err(404, 'Không tìm thấy mẫu');
    const b = await readJson(req);
    const label = b.label ?? d.label;
    if (!LABELS.includes(label)) return err(400, 'Nhãn chỉ nhận Mẫu cố định hoặc Mẫu đặt riêng');
    const next = {
      ...d, label,
      note: b.note !== undefined ? str(b.note, 2000) : d.note,
      allowPublic: b.allowPublic !== undefined ? b.allowPublic === true : d.allowPublic,
      soleId: 'soleId' in b ? optId(b.soleId) : d.soleId,
      strapId: 'strapId' in b ? optId(b.strapId) : d.strapId,
      styleId: 'styleId' in b ? optId(b.styleId) : d.styleId,
    };
    await updateDesignStmt(env, next).run();
    return json(next);
  }));
}
