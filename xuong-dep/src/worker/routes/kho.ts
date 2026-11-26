// /api/kho: packing bags, loading trucks (workshop accounts and up), receiving and delivering in Cambodia (managers and up).
import { normalizeBagCode } from '../../shared/ri';
import type { Env } from '../env';
import { HttpError, json, nowIso, readJson, str } from '../http';
import { pairsOf, type RiCount } from '../../shared/ri';
import { bagView, eventStmt, fullyDelivered, getBagByCode, getTrip, openTrip, packBag, perRiOf, refuse, riOf, toaCards, tripView, type BagRow } from '../repo/kho';
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

  // ---- Cambodia: receive, close the receipt, stock, deliver (managers and the owner) ----
  r.on('POST', '/api/kho/trips/:id/receive', kho('staff', async (req, env, p, user) => {
    const t = await getTrip(env, p.id);
    if (!t) refuse(404, 'no_trip', 'Không có chuyến này', 'មិនមានដំណើរនេះ');
    if (t!.status === 'dang_xep') refuse(409, 'not_departed', 'Chuyến này chưa chạy', 'ឡានមិនទាន់ចេញ');
    const b = await bagByCode(env, String((await readJson(req)).code ?? ''));
    if (b.trip_id !== t!.id) {
      const other = b.trip_id ? await getTrip(env, b.trip_id) : null;
      if (other) refuse(409, 'other_trip', `Bao này thuộc chuyến ${other.code}`, `បាវនេះជារបស់ដំណើរ ${other.code}`);
      refuse(409, 'not_on_trip', 'Bao này chưa lên chuyến xe nào', 'បាវនេះមិនទាន់ឡើងឡាន');
    }
    if (b.status === 'tren_xe' || b.status === 'thieu') {
      const at = nowIso(env);
      const res = await env.DB.prepare("UPDATE bags SET status = 'da_toi', updated_at = ? WHERE id = ? AND status IN ('tren_xe', 'thieu')").bind(at, b.id).run();
      if (changed(res) === 1) await eventStmt(env, b.id, 'receive', user.id, t!.id, {}, at).run();
    }
    return json(await tripView(env, t!.id));
  }));

  r.on('POST', '/api/kho/trips/:id/close', kho('staff', async (_req, env, p, user) => {
    const t = await getTrip(env, p.id);
    if (!t) refuse(404, 'no_trip', 'Không có chuyến này', 'មិនមានដំណើរនេះ');
    if (t!.status === 'dang_xep') refuse(409, 'not_departed', 'Chuyến này chưa chạy', 'ឡានមិនទាន់ចេញ');
    const at = nowIso(env);
    const res = await env.DB.prepare("UPDATE trips SET status = 'da_toi', closed_at = ?, closed_by = ? WHERE id = ? AND status = 'dang_chay'").bind(at, user.id, t!.id).run();
    if (changed(res) === 1) {
      const missing = (await env.DB.prepare("SELECT id, code FROM bags WHERE trip_id = ? AND status = 'tren_xe' ORDER BY code").bind(t!.id).all<{ id: string; code: string }>()).results;
      if (missing.length) {
        await env.DB.batch([
          env.DB.prepare("UPDATE bags SET status = 'thieu', updated_at = ? WHERE trip_id = ? AND status = 'tren_xe'").bind(at, t!.id),
          ...missing.map((b) => eventStmt(env, b.id, 'missing', user.id, t!.id, {}, at)),
        ]);
      }
      const v = await tripView(env, t!.id);
      await notifyOwner(env, missing.length
        ? `⚠️ Chuyến ${t!.code} tới Cam: nhận ${v.counts.received}/${v.counts.total}, thiếu ${missing.map((b) => b.code).join(', ')}`
        : `✅ Chuyến ${t!.code} tới Cam: đủ ${v.counts.total}/${v.counts.total} bao`);
      return json(v);
    }
    return json(await tripView(env, t!.id));
  }));

  r.on('POST', '/api/kho/bags/:code/stock', kho('staff', async (_req, env, p, user) => {
    const b = await bagByCode(env, p.code);
    if (b.status !== 'trong_kho') {
      if (b.status !== 'da_toi') refuse(409, 'bad_status', 'Bao này chưa tới Cam hoặc đã giao', 'បាវនេះមិនទាន់មកដល់ ឬបានប្រគល់ហើយ');
      const at = nowIso(env);
      const res = await env.DB.prepare("UPDATE bags SET status = 'trong_kho', updated_at = ? WHERE id = ? AND status = 'da_toi'").bind(at, b.id).run();
      if (changed(res) === 1) await eventStmt(env, b.id, 'stock', user.id, b.trip_id, {}, at).run();
    }
    return json(await bagView(env, (await getBagByCode(env, b.code))!, true));
  }));

  r.on('POST', '/api/kho/deliver', kho('staff', async (req, env, _p, user) => {
    const body = await readJson(req);
    const raw: unknown[] = Array.isArray(body.codes) ? body.codes.slice(0, 500) : [];
    if (!raw.length) refuse(400, 'empty', 'Chưa quét bao nào để giao', 'មិនទាន់ស្កេនបាវ');
    const bags: BagRow[] = [];
    for (const c of raw) {
      const b = await bagByCode(env, String(c));
      if (!bags.some((x) => x.id === b.id)) bags.push(b);
    }
    const bad = bags.filter((b) => b.status !== 'da_toi' && b.status !== 'trong_kho' && b.status !== 'da_giao');
    if (bad.length) refuse(409, 'not_arrived', `Các bao này chưa tới Cam: ${bad.map((b) => b.code).join(', ')}`, 'បាវទាំងនេះមិនទាន់មកដល់', { codes: bad.map((b) => b.code) });
    const todo = bags.filter((b) => b.status !== 'da_giao');
    const at = nowIso(env);
    const note = str(body.note, 300);
    if (todo.length) {
      await env.DB.batch(todo.flatMap((b) => [
        env.DB.prepare("UPDATE bags SET status = 'da_giao', updated_at = ? WHERE id = ? AND status IN ('da_toi', 'trong_kho')").bind(at, b.id),
        eventStmt(env, b.id, 'deliver', user.id, b.trip_id, note ? { note } : {}, at),
      ]));
    }
    const orders = [];
    for (const oid of new Set(bags.map((b) => b.order_id))) {
      const o = (await env.DB.prepare('SELECT id, code, status FROM orders WHERE id = ?').bind(oid).first<{ id: string; code: string; status: string }>())!;
      if ((o.status === 'khach_dong_y' || o.status === 'dang_san_xuat') && await fullyDelivered(env, oid)) {
        const res = await env.DB.prepare("UPDATE orders SET status = 'da_giao', updated_at = ? WHERE id = ? AND status IN ('khach_dong_y', 'dang_san_xuat')").bind(at, oid).run();
        if (changed(res) === 1) { o.status = 'da_giao'; await notifyOwner(env, `📦 Toa ${o.code} đã giao đủ`); }
      }
      orders.push(o);
    }
    return json({ delivered: todo.length, orders });
  }));

  // ---- corrections: the owner only, every one kept in the history ----
  r.on('POST', '/api/kho/bags/:code/ri', kho('admin', async (req, env, p, user) => {
    const b = await bagByCode(env, p.code);
    const ri: RiCount = (await readJson(req)).ri ?? {};
    const perRi = await perRiOf(env, b.order_id);
    for (const [k, n] of Object.entries(ri)) {
      if (!(k in perRi)) refuse(400, 'bad_line', `Toa này không có dòng size "${k}"`, 'គ្មានជួរទំហំនេះទេ');
      if (!Number.isInteger(n) || n < 0 || n > 999) refuse(400, 'bad_ri', 'Số ri phải là số nguyên từ 0 tới 999', 'ចំនួនត្រូវតែជាលេខគត់');
    }
    const to = Object.fromEntries(Object.entries(ri).filter(([, n]) => n > 0));
    const at = nowIso(env);
    await env.DB.batch([
      env.DB.prepare('UPDATE bags SET ri = ?, pairs = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(to), pairsOf(to, perRi), at, b.id),
      eventStmt(env, b.id, 'edit_ri', user.id, b.trip_id, { from: riOf(b), to }, at),
    ]);
    return json(await bagView(env, (await getBagByCode(env, b.code))!, true));
  }));

  r.on('POST', '/api/kho/bags/:code/flag', kho('admin', async (req, env, p, user) => {
    const b = await bagByCode(env, p.code);
    const body = await readJson(req);
    if (body.kind !== 'that_lac' && body.kind !== 'hu_hong') refuse(400, 'bad_kind', 'Chọn Thất lạc hoặc Hư hỏng', 'ជ្រើសបាត់ ឬខូច');
    const at = nowIso(env);
    await env.DB.batch([
      env.DB.prepare('UPDATE bags SET status = ?, updated_at = ? WHERE id = ?').bind(body.kind, at, b.id),
      eventStmt(env, b.id, 'flag', user.id, b.trip_id, { kind: body.kind, note: str(body.note, 300), from: b.status }, at),
    ]);
    return json(await bagView(env, (await getBagByCode(env, b.code))!, true));
  }));

  r.on('POST', '/api/kho/bags/:code/cancel', kho('admin', async (_req, env, p, user) => {
    const b = await bagByCode(env, p.code);
    if (b.status !== 'da_dong' || b.trip_id) refuse(409, 'cannot_cancel', 'Chỉ hủy được bao còn ở xưởng và chưa lên xe', 'អាចលុបបានតែបាវដែលនៅរោងចក្រ');
    const at = nowIso(env);
    await env.DB.batch([
      env.DB.prepare("UPDATE bags SET status = 'da_huy', updated_at = ? WHERE id = ? AND status = 'da_dong' AND trip_id IS NULL").bind(at, b.id),
      eventStmt(env, b.id, 'cancel', user.id, null, {}, at),
    ]);
    return json(await bagView(env, (await getBagByCode(env, b.code))!, true));
  }));
}
