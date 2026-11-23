import type { Lang } from '../shared/types';
import type { Env } from './env';

/** Sends through Resend when configured; tests/dev collect into env.EMAIL_OUTBOX. */
export async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<'sent' | 'disabled'> {
  if (env.EMAIL_OUTBOX) { env.EMAIL_OUTBOX.push({ to, subject, html }); return 'sent'; }
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return 'disabled';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html }),
  });
  if (!r.ok) throw new Error(`email failed: ${r.status} ${await r.text()}`);
  return 'sent';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(title: string, body: string, button: string, link: string, foot: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f5ef;font-family:Inter,Segoe UI,Arial,sans-serif;color:#212d23">
<div style="max-width:520px;margin:0 auto;padding:28px 18px">
<div style="background:#132f24;color:#fffdf6;border-radius:16px 16px 0 0;padding:20px 24px;font:700 22px Georgia,serif;letter-spacing:.04em">HLUXURY</div>
<div style="background:#fffcf5;border:1px solid #dfdfd3;border-top:0;border-radius:0 0 16px 16px;padding:24px">
<h1 style="margin:0 0 12px;font:700 24px Georgia,serif;color:#152e23">${esc(title)}</h1>
<p style="margin:0 0 20px;line-height:1.55">${esc(body)}</p>
<a href="${esc(link)}" style="display:inline-block;background:#e8f3a3;color:#132f24;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:10px">${esc(button)}</a>
<p style="margin:20px 0 0;font-size:13px;color:#535e51;line-height:1.5">${esc(foot)}</p>
</div></div></body></html>`;
}

// TODO-REVIEW-KM: Khmer email copy needs review by a native speaker.
const COPY = {
  verify: {
    vi: ['Xác nhận email của bạn', 'Bấm nút bên dưới để xác nhận email. Email này dùng để lấy lại mật khẩu khi bạn quên.', 'Xác nhận email', 'Nếu bạn không đăng ký tài khoản HLUXURY, hãy bỏ qua email này.'],
    en: ['Confirm your email', 'Tap the button below to confirm your email. We use it to reset your password if you forget it.', 'Confirm email', 'If you did not create a HLUXURY account, ignore this email.'],
    km: ['បញ្ជាក់អ៊ីមែលរបស់អ្នក', 'ចុចប៊ូតុងខាងក្រោមដើម្បីបញ្ជាក់អ៊ីមែល។ អ៊ីមែលនេះប្រើសម្រាប់កំណត់ពាក្យសម្ងាត់ឡើងវិញ។', 'បញ្ជាក់អ៊ីមែល', 'ប្រសិនបើអ្នកមិនបានបង្កើតគណនី HLUXURY សូមមិនអើពើអ៊ីមែលនេះ។'],
  },
  reset: {
    vi: ['Đặt lại mật khẩu', 'Bấm nút bên dưới để đặt mật khẩu mới. Link chỉ dùng một lần và hết hạn sau 1 giờ.', 'Đặt mật khẩu mới', 'Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu cũ vẫn giữ nguyên.'],
    en: ['Reset your password', 'Tap the button below to choose a new password. The link works once and expires in 1 hour.', 'Choose a new password', 'If you did not ask for this, ignore this email; your password stays the same.'],
    km: ['កំណត់ពាក្យសម្ងាត់ឡើងវិញ', 'ចុចប៊ូតុងខាងក្រោមដើម្បីជ្រើសពាក្យសម្ងាត់ថ្មី។ តំណប្រើបានតែម្តង ហើយផុតកំណត់ក្នុង 1 ម៉ោង។', 'ជ្រើសពាក្យសម្ងាត់ថ្មី', 'ប្រសិនបើអ្នកមិនបានស្នើ សូមមិនអើពើអ៊ីមែលនេះ។'],
  },
} as const;

export function emailFor(kind: 'verify' | 'reset', lang: Lang, link: string): { subject: string; html: string } {
  const [title, body, button, foot] = COPY[kind][lang] ?? COPY[kind].vi;
  return { subject: `HLUXURY · ${title}`, html: layout(title, body, button, link, foot) };
}
