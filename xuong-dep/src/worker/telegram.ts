// Telegram alerts for the owner: a new order, an edit, an accepted quote, a cancellation or a new sign-up
// reaches his phone at once. He connects his own bot in Cài đặt; the bot token is kept server side and never sent back.
import type { Env } from './env';
import { err, json, readJson, str } from './http';
import { requireOwner } from './roles';
import type { Router } from './router';
import { getSetting, setSettingStmt } from './repo/settings';

type TgConfig = { token: string; chatId: string; bot: string };
type TgResult = { ok: boolean; result?: any; description?: string };

const KEY = 'telegram';
const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/;

async function call(env: Env, token: string, method: string, body: Record<string, unknown> = {}): Promise<TgResult> {
  if (env.TELEGRAM_FAKE) return env.TELEGRAM_FAKE(token, method, body);
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return r.json() as Promise<TgResult>;
}

const getConfig = (env: Env) => getSetting<TgConfig | null>(env, KEY, null);

/** Sends `text` to the owner if Telegram is connected. Never throws: an alert must not break the order it reports. */
export async function notifyOwner(env: Env, text: string): Promise<void> {
  try {
    const cfg = await getConfig(env);
    if (!cfg) return;
    await call(env, cfg.token, 'sendMessage', { chat_id: cfg.chatId, text, disable_web_page_preview: true });
  } catch { /* alert lost; the order itself is saved */ }
}

/** Link to an order in the admin app. */
export const adminOrderUrl = (env: Env, id: string) => `${(env.APP_URL ?? '').replace(/\/+$/, '')}/quan-ly#/orders/${id}`;

export function telegramRoutes(r: Router) {
  r.on('GET', '/api/telegram', requireOwner(async (_req, env) => {
    const cfg = await getConfig(env);
    return json({ connected: !!cfg, bot: cfg?.bot ?? '' });
  }));

  // The owner pastes the token from @BotFather after pressing Start in his bot; the chat comes from that message.
  r.on('POST', '/api/telegram/connect', requireOwner(async (req, env) => {
    const token = str((await readJson(req)).token, 100).replace(/\s+/g, '');
    if (!TOKEN_RE.test(token)) return json({ error: 'Mã bot không đúng dạng. Chép nguyên dòng mã BotFather gửi, ví dụ 123456789:ABC…', code: 'bad_token' }, 400);
    const me = await call(env, token, 'getMe').catch(() => null);
    if (!me?.ok) return json({ error: 'Telegram không nhận mã bot này. Kiểm tra lại mã trong BotFather.', code: 'bad_token' }, 400);
    const up = await call(env, token, 'getUpdates', { limit: 50, allowed_updates: ['message'] }).catch(() => null);
    const chats = (up?.result ?? []).map((u: any) => u.message?.chat).filter((c: any) => c && c.type === 'private');
    const chat = chats[chats.length - 1];
    if (!chat) return json({ error: `Anh mở bot @${me.result.username} trên Telegram, bấm Start (hoặc gửi một tin bất kỳ) rồi bấm Kết nối lại.`, code: 'no_chat' }, 409);
    const cfg: TgConfig = { token, chatId: String(chat.id), bot: String(me.result.username ?? '') };
    const sent = await call(env, token, 'sendMessage', { chat_id: cfg.chatId, text: '✅ HLUXURY đã kết nối. Có đơn mới, khách sửa đơn, đồng ý báo giá hay hủy đơn, em sẽ báo anh ở đây.' }).catch(() => null);
    if (!sent?.ok) return json({ error: 'Không gửi được tin thử. Anh bấm Start trong bot rồi thử lại.', code: 'send_failed' }, 409);
    await setSettingStmt(env, KEY, cfg).run();
    return json({ connected: true, bot: cfg.bot });
  }));

  r.on('POST', '/api/telegram/test', requireOwner(async (_req, env) => {
    const cfg = await getConfig(env);
    if (!cfg) return err(409, 'Chưa kết nối Telegram');
    const sent = await call(env, cfg.token, 'sendMessage', { chat_id: cfg.chatId, text: '🔔 Tin thử từ HLUXURY: báo đơn đang hoạt động.' }).catch(() => null);
    if (!sent?.ok) return err(502, 'Telegram không nhận tin. Có thể anh đã chặn bot hoặc xóa bot.');
    return json({ ok: true });
  }));

  r.on('DELETE', '/api/telegram', requireOwner(async (_req, env) => {
    await env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(KEY).run();
    return json({ connected: false, bot: '' });
  }));
}
