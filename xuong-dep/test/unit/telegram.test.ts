import { beforeEach, expect, test } from 'bun:test';
import type { Env } from '../../src/worker/env';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';
import { item, line, uid } from '../helpers/orders';

let env: Env;
let admin: string;
let sent: { chat: unknown; text: string }[];
let updates: unknown[];
let failSend: boolean;
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';
const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9]);

beforeEach(async () => {
  env = await createTestEnv();
  admin = await loginCookie(env);
  sent = []; failSend = false;
  updates = [{ update_id: 1, message: { chat: { id: 555, type: 'private' }, text: '/start' } }];
  env.TELEGRAM_FAKE = async (token, method, body) => {
    if (token !== TOKEN) return { ok: false, description: 'Unauthorized' };
    if (method === 'getMe') return { ok: true, result: { username: 'hlx_bao_don_bot' } };
    if (method === 'getUpdates') return { ok: true, result: updates };
    if (method === 'sendMessage') {
      if (failSend) throw new Error('network down');
      sent.push({ chat: body.chat_id, text: String(body.text) }); return { ok: true, result: {} };
    }
    return { ok: false };
  };
});

const connect = (token = TOKEN) => call(env, 'POST', '/api/telegram/connect', { token }, admin);

async function customer() {
  const r = await call(env, 'POST', '/api/register', { name: 'Chị Lan', phone: '012345678', email: 'lan@k.vn', password: 'mat-khau-123', country: 'KH', lang: 'vi' });
  return cookieFrom(r);
}
async function photoOrder(c: string) {
  const up = async () => (await call(env, 'POST', '/api/c/images?w=1&h=1', jpeg, c, { 'content-type': 'image/jpeg' })).body as { id: string; key: string };
  const photo = await up(), crop = await up();
  return {
    id: uid('order'), neededBy: null, note: 'gấp', deliverNote: '', isPrivate: false,
    images: [{ id: photo.id, key: photo.key, width: 10, height: 10 }],
    items: [item(1, { imageId: photo.id, cropKey: crop.key, lines: [line({ qtyEach: 10 })] })],
  };
}

test('connect: checks the token, takes the chat from the Start message, sends a hello; the token never comes back', async () => {
  expect((await connect('not-a-token')).body.code).toBe('bad_token');
  expect((await connect('987654321:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsXX')).body.code).toBe('bad_token');
  updates = [];
  const none = await connect();
  expect(none.status).toBe(409);
  expect(none.body.error).toContain('@hlx_bao_don_bot');
  updates = [{ update_id: 1, message: { chat: { id: -100, type: 'group' } } }, { update_id: 2, message: { chat: { id: 555, type: 'private' } } }];
  const ok = await connect(' ' + TOKEN + ' ');
  expect(ok.body).toEqual({ connected: true, bot: 'hlx_bao_don_bot' });
  expect(sent).toHaveLength(1);
  expect(sent[0].chat).toBe('555');
  const st = await call(env, 'GET', '/api/telegram', undefined, admin);
  expect(st.body).toEqual({ connected: true, bot: 'hlx_bao_don_bot' });
  expect(JSON.stringify((await call(env, 'GET', '/api/settings', undefined, admin)).body)).not.toContain(TOKEN);
  expect((await call(env, 'GET', '/api/export', undefined, admin)).body.settings.some((s: { key: string }) => s.key === 'telegram')).toBe(false);
  // customers cannot touch it
  const c = await customer();
  expect((await call(env, 'GET', '/api/telegram', undefined, c)).status).toBe(404); // admin routes look missing to customers
  expect((await call(env, 'DELETE', '/api/telegram', undefined, admin)).body.connected).toBe(false);
});

test('alerts: sign-up, new order, edit, accepted quote, cancellation', async () => {
  // nothing is sent before connecting, and nothing breaks
  const c0 = await customer();
  expect(sent).toHaveLength(0);
  await connect(); sent = [];
  const o = await photoOrder(c0);
  expect((await call(env, 'PUT', `/api/c/orders/${o.id}`, o, c0)).status).toBe(200);
  expect(sent[0].text).toMatch(/^🆕 Đơn mới /);
  expect(sent[0].text).toContain('Chị Lan');
  expect(sent[0].text).toContain('60 đôi');
  expect(sent[0].text).toContain(`https://xuong.test/quan-ly#/orders/${o.id}`);
  await call(env, 'PUT', `/api/c/orders/${o.id}`, { ...o, note: 'đổi màu' }, c0);
  expect(sent[1].text).toMatch(/^✏️ Khách sửa đơn/);

  await call(env, 'PUT', `/api/orders/${o.id}/prices`, { prices: [{ lineId: o.items[0].lines[0].id, unitPrice: 1890 }] }, admin);
  await call(env, 'POST', `/api/orders/${o.id}/send-quote`, {}, admin);
  expect((await call(env, 'POST', `/api/c/orders/${o.id}/accept`, { version: 1 }, c0)).status).toBe(200);
  expect(sent[2].text).toMatch(/^✅ Khách đồng ý báo giá/);
  await call(env, 'POST', `/api/c/orders/${o.id}/accept`, { version: 1 }, c0); // repeat: no second alert
  expect(sent).toHaveLength(3);

  const o2 = await photoOrder(c0);
  await call(env, 'PUT', `/api/c/orders/${o2.id}`, o2, c0);
  await call(env, 'POST', `/api/c/orders/${o2.id}/cancel`, { reason: 'đặt nhầm' }, c0);
  expect(sent[sent.length - 1].text).toMatch(/^❌ Khách hủy đơn/);
  expect(sent[sent.length - 1].text).toContain('đặt nhầm');

  await call(env, 'POST', '/api/register', { name: 'Anh Minh', phone: '098765432', email: 'minh@k.vn', password: 'mat-khau-123', country: 'KH', lang: 'vi' });
  expect(sent[sent.length - 1].text).toContain('👋 Khách mới đăng ký: Anh Minh');
});

test('a Telegram outage never blocks the order', async () => {
  await connect();
  failSend = true;
  const c = await customer();
  const o = await photoOrder(c);
  expect((await call(env, 'PUT', `/api/c/orders/${o.id}`, o, c)).status).toBe(200);
});
