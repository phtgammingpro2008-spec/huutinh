import type { Lang, LineSetting } from '../../shared/types';
import { LANGS } from '../../shared/types';
import { requireAdmin } from '../roles';
import { err, json, newId, nowIso, readJson, str } from '../http';
import { getCustomer, insertCustomer, listCustomers, updateCustomer, type Customer } from '../repo/customers';
import { MATERIAL_KINDS, getMaterial, listMaterials, saveMaterial, type Material, type MaterialKind } from '../repo/materials';
import { customerOrders } from '../repo/orders';
import { getSettings, setSettingStmt } from '../repo/settings';
import type { Router } from '../router';
import * as v from '../validate';

function customerFrom(b: any, base: Partial<Customer>): Customer | Response {
  const name = str(b.name, 200);
  if (!name) return err(400, 'Cần nhập tên khách');
  return {
    id: base.id!, createdAt: base.createdAt!, name,
    zalo: str(b.zalo, 50), messenger: str(b.messenger, 500), country: str(b.country, 50),
    lang: v.lang(b.lang, base.lang), currency: v.currency(b.currency, base.currency), note: str(b.note),
  };
}

function materialFrom(b: any, id: string): Material | Response {
  if (!MATERIAL_KINDS.includes(b.kind)) return err(400, 'Nhóm vật liệu chỉ nhận Đế, Quai hoặc Kiểu');
  const nameVi = str(b.nameVi, 200);
  if (!nameVi) return err(400, 'Cần nhập tên tiếng Việt');
  return { id, kind: b.kind as MaterialKind, nameVi, nameEn: str(b.nameEn, 200), nameKm: str(b.nameKm, 200), hidden: !!b.hidden };
}

function linesFrom(raw: unknown): LineSetting[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return 'Cần ít nhất một dòng size';
  const seen = new Set<string>();
  const out: LineSetting[] = [];
  for (const l of raw) {
    const key = str(l?.key, 40);
    const from = l?.sizeFrom, to = l?.sizeTo;
    if (!key || seen.has(key)) return 'Mã dòng size bị trống hoặc trùng';
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 60 || from > to) return 'Dải size không hợp lệ';
    const vi = str(l?.label?.vi, 60);
    if (!vi) return 'Cần nhập tên dòng size';
    seen.add(key);
    out.push({ key, sizeFrom: from, sizeTo: to, label: { vi, en: str(l.label.en, 60) || vi, km: str(l.label.km, 60) || vi } });
  }
  return out;
}

export function catalogRoutes(r: Router) {
  r.on('GET', '/api/customers', requireAdmin(async (req, env) => {
    return json(await listCustomers(env, new URL(req.url).searchParams.get('q') ?? ''));
  }));
  r.on('POST', '/api/customers', requireAdmin(async (req, env) => {
    const c = customerFrom(await readJson(req), { id: newId(), createdAt: nowIso(env), lang: 'vi', currency: 'VND' });
    if (c instanceof Response) return c;
    await insertCustomer(env, c);
    return json(c);
  }));
  r.on('GET', '/api/customers/:id', requireAdmin(async (_req, env, p) => {
    const c = await getCustomer(env, p.id);
    if (!c) return err(404, 'Không tìm thấy khách');
    return json({ ...c, orders: await customerOrders(env, c.id) });
  }));
  r.on('PUT', '/api/customers/:id', requireAdmin(async (req, env, p) => {
    const old = await getCustomer(env, p.id);
    if (!old) return err(404, 'Không tìm thấy khách');
    const c = customerFrom(await readJson(req), old);
    if (c instanceof Response) return c;
    await updateCustomer(env, c);
    return json(c);
  }));

  r.on('GET', '/api/materials', requireAdmin(async (req, env) => {
    const sp = new URL(req.url).searchParams;
    return json(await listMaterials(env, { kind: sp.get('kind') || undefined, all: sp.get('all') === '1' }));
  }));
  r.on('POST', '/api/materials', requireAdmin(async (req, env) => {
    const m = materialFrom(await readJson(req), newId());
    if (m instanceof Response) return m;
    await saveMaterial(env, m, true);
    return json(m);
  }));
  r.on('PUT', '/api/materials/:id', requireAdmin(async (req, env, p) => {
    if (!(await getMaterial(env, p.id))) return err(404, 'Không tìm thấy vật liệu');
    const m = materialFrom(await readJson(req), p.id);
    if (m instanceof Response) return m;
    await saveMaterial(env, m, false);
    return json(m);
  }));

  r.on('GET', '/api/settings', requireAdmin(async (_req, env) => json(await getSettings(env))));
  r.on('PUT', '/api/settings', requireAdmin(async (req, env) => {
    const b = await readJson(req);
    const stmts = [];
    if (b.lines !== undefined) {
      const lines = linesFrom(b.lines);
      if (typeof lines === 'string') return err(400, lines);
      stmts.push(setSettingStmt(env, 'lines', lines));
    }
    if (b.quoteMessage !== undefined) {
      const qm = {} as Record<Lang, string>;
      for (const l of LANGS) {
        qm[l] = str(b.quoteMessage?.[l], 1000);
        if (!qm[l].includes('{url}')) return err(400, 'Tin nhắn báo giá phải có {url}');
      }
      stmts.push(setSettingStmt(env, 'quote_message', qm));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json(await getSettings(env));
  }));
}
