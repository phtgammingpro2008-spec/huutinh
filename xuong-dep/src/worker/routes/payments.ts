import { isDate, localDate } from '../../shared/dates';
import { STATUSES, canTransition, rank } from '../../shared/status';
import type { OrderStatus } from '../../shared/types';
import { requireAdmin } from '../roles';
import { err, json, newId, now, nowIso, readJson, str } from '../http';
import { getOrderRow, loadOrder } from '../repo/orders';
import { addPayment, deletePayment } from '../repo/payments';
import { latestQuote } from '../repo/quotes';
import type { Router } from '../router';

const TABLES = ['customers', 'materials', 'settings', 'orders', 'order_images', 'designs', 'order_items', 'item_lines', 'quotes', 'payments'];

export function paymentRoutes(r: Router) {
  r.on('POST', '/api/orders/:id/status', requireAdmin(async (req, env, p) => {
    const o = await getOrderRow(env, p.id);
    if (!o) return err(404, 'Không tìm thấy đơn');
    const to = (await readJson(req)).to as OrderStatus;
    if (!STATUSES.includes(to)) return err(400, 'Trạng thái không hợp lệ');
    if (to === 'da_bao_gia') return err(409, 'Dùng nút "Gửi báo giá" để chuyển sang Đã báo giá');
    if (!canTransition(o.status, to)) return err(409, 'Không chuyển được sang trạng thái này');
    if (to !== 'da_huy' && rank(to) >= rank('khach_dong_y') && o.quote_version === 0) return err(409, 'Đơn chưa gửi báo giá');
    const at = nowIso(env);
    const stmts = [env.DB.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(to, at, o.id)];
    if (to === 'khach_dong_y') {
      // The owner records an acceptance received by chat.
      const q = await latestQuote(env, o.id);
      stmts.push(env.DB.prepare('UPDATE orders SET accepted_at = ? WHERE id = ?').bind(at, o.id));
      if (q) stmts.push(env.DB.prepare('UPDATE quotes SET accepted_at = ? WHERE id = ? AND accepted_at IS NULL').bind(at, q.id));
    }
    await env.DB.batch(stmts);
    return json(await loadOrder(env, o.id));
  }));

  r.on('POST', '/api/orders/:id/payments', requireAdmin(async (req, env, p) => {
    if (!(await getOrderRow(env, p.id))) return err(404, 'Không tìm thấy đơn');
    const b = await readJson(req);
    if (!Number.isInteger(b.amount) || b.amount <= 0 || b.amount > 1e13) return err(400, 'Số tiền không hợp lệ');
    const paidOn = b.paidOn ? (isDate(b.paidOn) ? b.paidOn : null) : localDate(now(env));
    if (!paidOn) return err(400, 'Ngày nhận tiền không hợp lệ');
    await addPayment(env, p.id, { id: newId(), amount: b.amount, paidOn, note: str(b.note, 500) });
    return json(await loadOrder(env, p.id));
  }));

  r.on('DELETE', '/api/orders/:id/payments/:pid', requireAdmin(async (_req, env, p) => {
    if (!(await getOrderRow(env, p.id))) return err(404, 'Không tìm thấy đơn');
    await deletePayment(env, p.id, p.pid);
    return json(await loadOrder(env, p.id));
  }));

  r.on('GET', '/api/export', requireAdmin(async (_req, env) => {
    const out: Record<string, unknown[]> = {};
    out.users = (await env.DB.prepare('SELECT id, name, role, created_at FROM users').all()).results;
    for (const t of TABLES) out[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results;
    const body = { exportedAt: nowIso(env), app: 'xuong-dep', ...out };
    return json(body, 200, { 'content-disposition': `attachment; filename="xuong-dep-backup-${localDate(now(env))}.json"` });
  }));
}
