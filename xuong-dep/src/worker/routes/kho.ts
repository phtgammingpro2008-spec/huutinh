// /api/kho: packing bags, loading trucks (workshop accounts and up), receiving and delivering in Cambodia (managers and up).
import { normalizeBagCode } from '../../shared/ri';
import type { Env } from '../env';
import { HttpError, json, nowIso, readJson, str } from '../http';
import { bagView, eventStmt, getBagByCode, getTrip, openTrip, packBag, refuse, toaCards, tripView, type BagRow } from '../repo/kho';
import { requireKho, type SessionUser } from '../roles';
import type { Router } from '../router';
import { notifyOwner } from '../telegram';

const changed = (r: any) => (r?.meta?.changes ?? r?.changes ?? 0) as number;

/** Runs a handler and turns a bilingual refusal into `{ error, code, ...extra }`. */
const kho = (level: 'worker' | 'staff' | 'admin', h: (req: Request, env: Env, p: Record<string, string>, user: SessionUser) => Promise<Response>) =>
  requireKho(level, async (req, env, p, ctx) => {
    try { return await h(req, env, p, ctx.user!); } catch (e) {
      if (e instanceof HttpError && (e as any).code) return json({ error: e.message, code: (e as any).code, ...((e as any).extra ?? {}) }, e.status);
      throw e;
    }
  });

async function bagByCode(env: Env, raw: string): Promise<BagRow> {
  const code = normalizeBagCode(decodeURIComponent(raw));
  const b = code ? await getBagByCode(env, code) : null;
  if (!b) refuse(404, 'no_bag', 'Không có bao này', 'មិនមានបាវនេះ');
  return b!;
}
const seesCustomer = (u: SessionUser) => u.role === 'admin' || u.role === 'staff';

export function khoRoutes(r: Router) {
  r.on('GET', '/api/kho/toa', kho('worker', async (_req, env) => json(await toaCards(env))));

  r.on('POST', '/api/kho/bags', kho('worker', async (req, env, _p, user) => {
    const b = await readJson(req);
    const ri = b.ri && typeof b.ri === 'object' ? b.ri : {};
    const extraPairs = Number.isInteger(b.extraPairs) && b.extraPairs >= 0 && b.extraPairs <= 999 ? b.extraPairs : 0;
    const code = await packBag(env, user.id, { orderId: str(b.orderId, 100), ri, extraNote: str(b.extraNote, 200), extraPairs, confirmOver: b.confirmOver === true });
    return json(await bagView(env, (await getBagByCode(env, code))!, seesCustomer(user)));
  }));

  r.on('GET', '/api/kho/bags/:code', kho('worker', async (_req, env, p, user) => json(await bagView(env, await bagByCode(env, p.code), seesCustomer(user)))));

  r.on('POST', '/api/kho/bags/:code/reprint', kho('worker', async (_req, env, p, user) => {
    const b = await bagByCode(env, p.code);
    await eventStmt(env, b.id, 'reprint', user.id, b.trip_id).run();
    return json(await bagView(env, b, seesCustomer(user)));
  }));

  // ---- trips: open, load, unload, depart ----
  r.on('POST', '/api/kho/trips', kho('worker', async (_req, env, _p, user) => json(await tripView(env, await openTrip(env, user.id)))));
  r.on('GET', '/api/kho/trips', kho('worker', async (req, env) => {
    const st = new URL(req.url).searchParams.get('status');
    const rows = (await env.DB.prepare(
      'SELECT id FROM trips WHERE (?1 IS NULL OR status = ?1) ORDER BY created_at DESC LIMIT 60',
    ).bind(st || null).all<{ id: string }>()).results;
    return json(await Promise.all(rows.map((t) => tripView(env, t.id))));
  }));
  r.on('GET', '/api/kho/trips/:id', kho('worker', async (_req, env, p) => json(await tripView(env, p.id))));

  const loading = async (env: Env, id: string) => {
    const t = await getTrip(env, id);
    if (!t) refuse(404, 'no_trip', 'Không có chuyến này', 'មិនមានដំណើរនេះ');
    if (t!.status !== 'dang_xep') refuse(409, 'trip_closed', 'Chuyến này đã chạy, không xếp thêm hay bỏ bao được', 'ឡានបានចេញហើយ');
    return t!;
  };

  r.on('POST', '/api/kho/trips/:id/load', kho('worker', async (req, env, p, user) => {
    const t = await loading(env, p.id);
    const b = await bagByCode(env, String((await readJson(req)).code ?? ''));
    if (b.trip_id === t.id) return json(await tripView(env, t.id)); // scanned twice: nothing new
    if (b.trip_id) refuse(409, 'on_other_trip', 'Bao này đang nằm trong chuyến khác', 'បាវនេះនៅក្នុងដំណើរផ្សេង');
    if (b.status !== 'da_dong') refuse(409, 'bad_status', 'Bao này không còn ở xưởng', 'បាវនេះមិននៅរោងចក្រទេ');
    const at = nowIso(env);
    const res = await env.DB.prepare("UPDATE bags SET trip_id = ?, updated_at = ? WHERE id = ? AND trip_id IS NULL AND status = 'da_dong'").bind(t.id, at, b.id).run();
    if (changed(res) === 1) await eventStmt(env, b.id, 'load', user.id, t.id, {}, at).run();
    else {
      const now = (await getBagByCode(env, b.code))!;
      if (now.trip_id !== t.id) refuse(409, 'on_other_trip', 'Bao này đang nằm trong chuyến khác', 'បាវនេះនៅក្នុងដំណើរផ្សេង');
    }
    return json(await tripView(env, t.id));
  }));

  r.on('POST', '/api/kho/trips/:id/unload', kho('worker', async (req, env, p, user) => {
    const t = await loading(env, p.id);
    const b = await bagByCode(env, String((await readJson(req)).code ?? ''));
    if (b.trip_id !== t.id) refuse(409, 'not_on_trip', 'Bao này không nằm trong chuyến này', 'បាវនេះមិននៅក្នុងដំណើរនេះ');
    const at = nowIso(env);
    const res = await env.DB.prepare('UPDATE bags SET trip_id = NULL, updated_at = ? WHERE id = ? AND trip_id = ?').bind(at, b.id, t.id).run();
    if (changed(res) === 1) await eventStmt(env, b.id, 'unload', user.id, t.id, {}, at).run();
    return json(await tripView(env, t.id));
  }));

  r.on('POST', '/api/kho/trips/:id/depart', kho('worker', async (_req, env, p, user) => {
    const t = await loading(env, p.id);
    const bags = (await env.DB.prepare("SELECT id, order_id FROM bags WHERE trip_id = ? AND status = 'da_dong'").bind(t.id).all<{ id: string; order_id: string }>()).results;
    if (!bags.length) refuse(409, 'empty_trip', 'Chuyến chưa có bao nào', 'ដំណើរនេះមិនទាន់មានបាវ');
    const at = nowIso(env);
    const res = await env.DB.prepare("UPDATE trips SET status = 'dang_chay', departed_at = ?, departed_by = ? WHERE id = ? AND status = 'dang_xep'").bind(at, user.id, t.id).run();
    if (changed(res) === 1) {
      await env.DB.batch([
        env.DB.prepare("UPDATE bags SET status = 'tren_xe', updated_at = ? WHERE trip_id = ? AND status = 'da_dong'").bind(at, t.id),
        ...bags.map((b) => eventStmt(env, b.id, 'depart', user.id, t.id, {}, at)),
      ]);
      await notifyOwner(env, `🚚 Chuyến ${t.code} chạy: ${bags.length} bao, ${new Set(bags.map((b) => b.order_id)).size} toa`);
    }
    return json(await tripView(env, t.id));
  }));
}
