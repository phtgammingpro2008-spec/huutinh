// Warehouse and shipping: bags (one order each, counted in ri), truck trips to Cambodia, append-only bag history.
import { newBagCode, orderedRi, pairsOf, type RiCount } from '../../shared/ri';
import type { Item, Lang } from '../../shared/types';
import type { Env, Stmt } from '../env';
import { HttpError, newId, now, nowIso } from '../http';
import { itemsByOrder } from './orders';
import { getSettings } from './settings';

export type BagStatus = 'da_dong' | 'tren_xe' | 'da_toi' | 'thieu' | 'trong_kho' | 'da_giao' | 'that_lac' | 'hu_hong' | 'da_huy';
export type TripStatus = 'dang_xep' | 'dang_chay' | 'da_toi';
export type BagRow = {
  id: string; code: string; order_id: string; seq: number; ri: string; pairs: number; extra_note: string; extra_pairs: number;
  over: number; status: BagStatus; trip_id: string | null; created_by: string; created_at: string; updated_at: string;
};
export type TripRow = {
  id: string; code: string; status: TripStatus; note: string; created_by: string; created_at: string;
  departed_at: string | null; departed_by: string | null; closed_at: string | null; closed_by: string | null;
};
type Names = Record<Lang, string>;
export type KhoLine = { key: string; label: Names; perRi: number; orderedRi: number; orderedPairs: number; packedRi: number; sentRi: number; deliveredRi: number };

export const PACKABLE = ['khach_dong_y', 'dang_san_xuat'];
/** Bags that have left the workshop (counted as sent). */
const SENT: BagStatus[] = ['tren_xe', 'da_toi', 'thieu', 'trong_kho', 'da_giao', 'that_lac', 'hu_hong'];

/** Bilingual refusal with a machine code; the routes turn it into a JSON error. */
export const refuse = (status: number, code: string, vi: string, km: string, extra: Record<string, unknown> = {}): never => {
  throw Object.assign(new HttpError(status, `${vi} · ${km}`), { code, extra });
};

export const riOf = (b: BagRow): RiCount => { try { return JSON.parse(b.ri) as RiCount; } catch { return {}; } };

export function eventStmt(env: Env, bagId: string, kind: string, userId: string, tripId: string | null = null, data: Record<string, unknown> = {}, at = nowIso(env)): Stmt {
  return env.DB.prepare('INSERT INTO bag_events (id, bag_id, trip_id, kind, data, user_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId(), bagId, tripId, kind, JSON.stringify(data), userId, at);
}

export const getBagByCode = (env: Env, code: string) => env.DB.prepare('SELECT * FROM bags WHERE code = ?').bind(code).first<BagRow>();
export const getTrip = (env: Env, id: string) => env.DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first<TripRow>();
export const bagsOfOrders = async (env: Env, ids: string[]) => (await env.DB.prepare(
  "SELECT * FROM bags WHERE order_id IN (SELECT value FROM json_each(?)) AND status <> 'da_huy' ORDER BY seq",
).bind(JSON.stringify(ids)).all<BagRow>()).results;

/** Ordered, packed, sent and delivered ri per size line of one order. */
export async function linesOf(env: Env, items: Item[], bags: BagRow[]): Promise<KhoLine[]> {
  const ordered = orderedRi(items);
  const labels = new Map((await getSettings(env)).lines.map((l) => [l.key, l.label]));
  const sum = (pick: (b: BagRow) => boolean, key: string) => bags.filter(pick).reduce((s, b) => s + (riOf(b)[key] ?? 0), 0);
  return Object.entries(ordered).map(([key, o]) => ({
    key, label: labels.get(key) ?? { vi: key, en: key, km: key }, perRi: o.perRi, orderedRi: o.ri, orderedPairs: o.pairs,
    packedRi: sum(() => true, key), sentRi: sum((b) => SENT.includes(b.status), key), deliveredRi: sum((b) => b.status === 'da_giao', key),
  }));
}

/** Orders a workshop hand may pack, newest first: code, design crops and progress, never who the customer is. */
export async function toaCards(env: Env) {
  const orders = (await env.DB.prepare(
    "SELECT id, code, status FROM orders WHERE status IN ('khach_dong_y', 'dang_san_xuat') ORDER BY created_at DESC LIMIT 100",
  ).all<{ id: string; code: string; status: string }>()).results;
  const ids = orders.map((o) => o.id);
  const items = await itemsByOrder(env, ids);
  const bags = await bagsOfOrders(env, ids);
  return Promise.all(orders.map(async (o) => {
    const its = items.get(o.id) ?? [];
    const mine = bags.filter((b) => b.order_id === o.id);
    return {
      id: o.id, code: o.code, status: o.status, thumbs: its.map((i) => i.cropKey).filter(Boolean).slice(0, 6),
      lines: (await linesOf(env, its, mine)).map(({ deliveredRi: _d, ...l }) => l), bags: mine.length,
    };
  }));
}

/** Creates one bag; moves an accepted order into production. */
export async function packBag(env: Env, userId: string, b: { orderId: string; ri: RiCount; extraNote: string; extraPairs: number; confirmOver: boolean }) {
  const o = await env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(b.orderId).first<{ id: string; status: string }>();
  if (!o) refuse(404, 'no_order', 'Không có toa này', 'មិនមានការបញ្ជាទិញនេះ');
  if (!PACKABLE.includes(o!.status)) refuse(409, 'not_packable', 'Toa này chưa được đóng bao (chưa đồng ý, đã giao, đã xong hoặc đã hủy)', 'ការបញ្ជាទិញនេះមិនអាចខ្ចប់បានទេ');
  const items = (await itemsByOrder(env, [o!.id])).get(o!.id) ?? [];
  const bags = await bagsOfOrders(env, [o!.id]);
  const lines = await linesOf(env, items, bags);
  const perRi = Object.fromEntries(lines.map((l) => [l.key, l.perRi]));
  for (const [k, n] of Object.entries(b.ri)) {
    if (!(k in perRi)) refuse(400, 'bad_line', `Toa này không có dòng size "${k}"`, 'គ្មានជួរទំហំនេះទេ');
    if (!Number.isInteger(n) || n < 0 || n > 999) refuse(400, 'bad_ri', 'Số ri phải là số nguyên từ 0 tới 999', 'ចំនួនត្រូវតែជាលេខគត់');
  }
  const ri = Object.fromEntries(Object.entries(b.ri).filter(([, n]) => n > 0));
  if (!Object.keys(ri).length && !b.extraNote) refuse(400, 'empty', 'Bao trống: nhập số ri hoặc ghi hàng gửi kèm', 'បាវទទេ');
  const overRi: RiCount = {};
  for (const l of lines) {
    const after = l.packedRi + (ri[l.key] ?? 0);
    if ((ri[l.key] ?? 0) > 0 && after > l.orderedRi) overRi[l.key] = Math.round((after - l.orderedRi) * 10) / 10;
  }
  const over = Object.keys(overRi).length > 0;
  if (over && !b.confirmOver) refuse(409, 'over', 'Bao này làm dư so với số ri đặt', 'លើសពីចំនួនបញ្ជាទិញ', { overRi });
  const at = nowIso(env);
  for (let attempt = 0; ; attempt++) {
    // numbered over every bag of the order, cancelled ones included, so a number is never reused
    const seq = (await env.DB.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM bags WHERE order_id = ?').bind(o!.id).first<{ m: number }>())!.m + 1;
    const id = newId(), code = newBagCode();
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO bags (id, code, order_id, seq, ri, pairs, extra_note, extra_pairs, over, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'da_dong', ?, ?, ?)`)
          .bind(id, code, o!.id, seq, JSON.stringify(ri), pairsOf(ri, perRi), b.extraNote, b.extraPairs, over ? 1 : 0, userId, at, at),
        eventStmt(env, id, 'pack', userId, null, { ri, extraNote: b.extraNote, extraPairs: b.extraPairs, over }, at),
        env.DB.prepare("UPDATE orders SET status = 'dang_san_xuat', updated_at = ? WHERE id = ? AND status = 'khach_dong_y'").bind(at, o!.id),
      ]);
      return code;
    } catch (e) {
      if (attempt >= 3 || !/UNIQUE/i.test(String(e))) throw e; // another bag took this number (or code) a moment ago
    }
  }
}

/** Trip code C + DDMMYY + n of the day, e.g. C251125-1. */
export async function openTrip(env: Env, userId: string): Promise<string> {
  const d = now(env);
  const p = (n: number) => String(n).padStart(2, '0');
  const prefix = `C${p(d.getUTCDate())}${p(d.getUTCMonth() + 1)}${p(d.getUTCFullYear() % 100)}-`;
  for (let attempt = 0; ; attempt++) {
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM trips WHERE code LIKE ?').bind(prefix + '%').first<{ n: number }>())!.n + 1 + attempt;
    const id = newId();
    try {
      await env.DB.prepare('INSERT INTO trips (id, code, status, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, prefix + n, 'dang_xep', userId, nowIso(env)).run();
      return id;
    } catch (e) {
      if (attempt >= 5 || !/UNIQUE/i.test(String(e))) throw e;
    }
  }
}

export async function tripView(env: Env, id: string) {
  const t = await getTrip(env, id);
  if (!t) refuse(404, 'no_trip', 'Không có chuyến này', 'មិនមានដំណើរនេះ');
  const bags = (await env.DB.prepare(
    `SELECT b.code, b.seq, b.pairs, b.status, b.ri, b.extra_note, o.code AS order_code, o.id AS order_id
     FROM bags b JOIN orders o ON o.id = b.order_id WHERE b.trip_id = ? ORDER BY o.code, b.seq`,
  ).bind(id).all<any>()).results;
  const received = bags.filter((b) => b.status !== 'tren_xe' && b.status !== 'thieu' && b.status !== 'da_dong').length;
  return {
    id: t!.id, code: t!.code, status: t!.status, createdAt: t!.created_at, departedAt: t!.departed_at, closedAt: t!.closed_at,
    bags: bags.map((b) => ({ code: b.code, seq: b.seq, orderCode: b.order_code, orderId: b.order_id, pairs: b.pairs, ri: JSON.parse(b.ri), extraNote: b.extra_note, status: b.status })),
    counts: { total: bags.length, received, missing: bags.filter((b) => b.status === 'thieu').length, orders: new Set(bags.map((b) => b.order_id)).size },
  };
}

/** A bag as the scanner shows it. Customer name and delivery note only for managers and the owner. */
export async function bagView(env: Env, b: BagRow, withCustomer: boolean) {
  const o = (await env.DB.prepare(
    `SELECT o.id, o.code, o.status, o.deliver_note, c.name AS customer_name, (SELECT COUNT(*) FROM bags x WHERE x.order_id = o.id AND x.status <> 'da_huy') AS total
     FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
  ).bind(b.order_id).first<any>())!;
  const trip = b.trip_id ? await getTrip(env, b.trip_id) : null;
  const lineLabels = Object.fromEntries((await getSettings(env)).lines.map((l) => [l.key, l.label.vi]));
  const events = (await env.DB.prepare(
    `SELECT e.kind, e.at, e.data, u.name AS by_name, t.code AS trip_code FROM bag_events e
     LEFT JOIN users u ON u.id = e.user_id LEFT JOIN trips t ON t.id = e.trip_id WHERE e.bag_id = ? ORDER BY e.at, e.rowid`,
  ).bind(b.id).all<any>()).results;
  return {
    code: b.code, seq: b.seq, ri: riOf(b), lineLabels, pairs: b.pairs, extraNote: b.extra_note, extraPairs: b.extra_pairs, over: !!b.over, status: b.status,
    createdAt: b.created_at,
    trip: trip ? { id: trip.id, code: trip.code, status: trip.status } : null,
    order: {
      id: o.id, code: o.code, status: o.status, totalBags: o.total,
      ...(withCustomer ? { customerName: o.customer_name, deliverNote: o.deliver_note } : {}),
    },
    events: events.map((e) => ({ kind: e.kind, at: e.at, by: e.by_name ?? '', tripCode: e.trip_code ?? null, data: JSON.parse(e.data || '{}') })),
  };
}

/** Pairs per ri of each size line of one order (to price a bag in pairs). */
export async function perRiOf(env: Env, orderId: string): Promise<Record<string, number>> {
  const items = (await itemsByOrder(env, [orderId])).get(orderId) ?? [];
  return Object.fromEntries(Object.entries(orderedRi(items)).map(([k, v]) => [k, v.perRi]));
}

/** Everything an order page shows about its bags. */
export async function shippingSummary(env: Env, orderId: string) {
  const items = (await itemsByOrder(env, [orderId])).get(orderId) ?? [];
  const bags = (await env.DB.prepare(
    `SELECT b.*, t.code AS trip_code FROM bags b LEFT JOIN trips t ON t.id = b.trip_id
     WHERE b.order_id = ? AND b.status <> 'da_huy' ORDER BY b.seq`,
  ).bind(orderId).all<BagRow & { trip_code: string | null }>()).results;
  const byStatus: Partial<Record<BagStatus, number>> = {};
  for (const b of bags) byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
  return {
    bags: bags.length,
    lines: await linesOf(env, items, bags),
    byStatus,
    extra: bags.filter((b) => b.extra_note).map((b) => b.extra_note),
    list: bags.map((b) => ({
      code: b.code, seq: b.seq, ri: riOf(b), pairs: b.pairs, extraNote: b.extra_note, status: b.status, tripCode: b.trip_code, updatedAt: b.updated_at,
    })),
  };
}

/** Delivered pairs reached the ordered pairs: the order is delivered. */
export async function fullyDelivered(env: Env, orderId: string): Promise<boolean> {
  const items = (await itemsByOrder(env, [orderId])).get(orderId) ?? [];
  const ordered = Object.values(orderedRi(items)).reduce((s, l) => s + l.pairs, 0);
  const got = (await env.DB.prepare("SELECT COALESCE(SUM(pairs), 0) AS n FROM bags WHERE order_id = ? AND status = 'da_giao'").bind(orderId).first<{ n: number }>())!.n;
  return ordered > 0 && got >= ordered;
}

/** Bags waiting in Cambodia (arrived or in the warehouse), grouped by order, for managers. */
export async function camBags(env: Env) {
  const rows = (await env.DB.prepare(
    `SELECT b.code, b.seq, b.pairs, b.ri, b.status, b.extra_note, o.id AS order_id, o.code AS order_code, c.name AS customer_name
     FROM bags b JOIN orders o ON o.id = b.order_id JOIN customers c ON c.id = o.customer_id
     WHERE b.status IN ('da_toi', 'trong_kho') ORDER BY o.code, b.seq`,
  ).all<any>()).results;
  type CamBag = { code: string; seq: number; pairs: number; ri: RiCount; status: string; extraNote: string };
  type CamOrder = { orderId: string; orderCode: string; customerName: string; bags: CamBag[] };
  const out = new Map<string, CamOrder>();
  for (const r of rows) {
    const g: CamOrder = out.get(r.order_id) ?? { orderId: r.order_id, orderCode: r.order_code, customerName: r.customer_name, bags: [] };
    g.bags.push({ code: r.code, seq: r.seq, pairs: r.pairs, ri: JSON.parse(r.ri), status: r.status, extraNote: r.extra_note });
    out.set(r.order_id, g);
  }
  return [...out.values()];
}
