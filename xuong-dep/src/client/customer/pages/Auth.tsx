import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { uiDict, type UiKey } from '../../../shared/i18n-ui';
import type { Country } from '../../../shared/phone';
import type { Lang } from '../../../shared/types';
import type { T } from '../../ui/lang';
import { api, ApiError, type Me } from '../api';

/** Error text in the page language: known codes are translated here, the rest use the server's message. */
export function errorText(t: T, e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'network') return t('err.network');
    const key = `err.${e.code}` as UiKey;
    if (e.code && key in uiDict.vi) return t(key);
    return e.message || t('err.generic');
  }
  return t('err.generic');
}

export type Strength = 'weak' | 'medium' | 'strong';
export function passwordStrength(pw: string): Strength {
  if (pw.length < 8) return 'weak';
  return pw.length >= 12 && /\d/.test(pw) && /\p{L}/u.test(pw) ? 'strong' : 'medium';
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="muted small field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${id}-err`} role="alert">{error}</p>}
    </div>
  );
}

const described = (id: string, error?: string, hint?: string) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined,
});

function PasswordInput({ id, value, onChange, autoComplete, t, error }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; t: T; error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value}
        onChange={(e) => onChange(e.target.value)} {...described(id, error)} />
      <button type="button" className="pw-eye" aria-label={show ? t('auth.hide_password') : t('auth.show_password')}
        aria-pressed={show} onClick={() => setShow((s) => !s)}>
        {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}

function StrengthMeter({ pw, t }: { pw: string; t: T }) {
  if (!pw) return null;
  const s = passwordStrength(pw);
  const level = s === 'weak' ? 1 : s === 'medium' ? 2 : 3;
  return (
    <div className={`strength s-${s}`} aria-live="polite">
      <div className="strength-bars" aria-hidden="true">{[1, 2, 3].map((i) => <span key={i} className={i <= level ? 'on' : ''} />)}</div>
      <span className="small">{t('auth.strength', { level: t(`auth.${s}`) })}</span>
    </div>
  );
}

type Errors = Partial<Record<string, string>>;

/** Puts a field error under its field; anything else becomes the form's general error. */
function errorsFrom(t: T, e: unknown, fields: string[]): Errors {
  const msg = errorText(t, e);
  return e instanceof ApiError && e.field && fields.includes(e.field) ? { [e.field]: msg } : { form: msg };
}

export function LoginForm({ t, lang, onDone, notice }: { t: T; lang: Lang; onDone: (me: Pick<Me, 'id' | 'name' | 'role'>) => void; notice?: string }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      onDone(await api('POST', '/api/login', { id: id.trim(), password, lang }));
    } catch (err) {
      setErrors(errorsFrom(t, err, []));
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {notice && <div className="notice" role="status">{notice}</div>}
      <Field id="login-id" label={t('auth.id')}>
        <input id="login-id" autoComplete="username" autoCapitalize="none" inputMode="email" value={id} onChange={(e) => setId(e.target.value)} />
      </Field>
      <Field id="login-pw" label={t('auth.password')}>
        <PasswordInput id="login-pw" value={password} onChange={setPassword} autoComplete="current-password" t={t} />
      </Field>
      <div className="auth-aside"><a href="/quen-mat-khau">{t('auth.forgot_link')}</a></div>
      {errors.form && <div className="error" role="alert">{errors.form}</div>}
      <button className="btn-primary btn-block btn-lg" type="submit" disabled={busy || !id.trim() || !password}>{t('auth.login')}</button>
    </form>
  );
}

const REG_FIELDS = ['name', 'phone', 'email', 'password', 'confirm', 'country'];

export function RegisterForm({ t, lang, setLang, onDone }: {
  t: T; lang: Lang; setLang: (l: Lang) => void; onDone: (me: Pick<Me, 'id' | 'name' | 'role'>) => void;
}) {
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '', confirm: '', country: (lang === 'vi' ? 'VN' : 'KH') as Country });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) { setErrors({ confirm: t('err.password_mismatch') }); return; }
    if (f.password.length < 8) { setErrors({ password: t('err.weak_password') }); return; }
    setBusy(true);
    setErrors({});
    try {
      onDone(await api('POST', '/api/register', {
        name: f.name.trim(), phone: f.phone, email: f.email.trim(), password: f.password, country: f.country, lang,
      }));
    } catch (err) {
      setErrors(errorsFrom(t, err, REG_FIELDS));
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <Field id="reg-name" label={t('auth.name')} error={errors.name}>
        <input id="reg-name" autoComplete="name" value={f.name} onChange={(e) => set('name')(e.target.value)} {...described('reg-name', errors.name)} />
      </Field>
      <div className="field-row">
        <Field id="reg-country" label={t('auth.country')} error={errors.country}>
          <select id="reg-country" value={f.country} onChange={(e) => set('country')(e.target.value)}>
            <option value="KH">{t('auth.country_KH')}</option>
            <option value="VN">{t('auth.country_VN')}</option>
          </select>
        </Field>
        <Field id="reg-lang" label={t('ui.lang')}>
          <select id="reg-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
            <option value="km">ខ្មែរ</option>
          </select>
        </Field>
      </div>
      <Field id="reg-phone" label={t('auth.phone')} hint={t('auth.phone_hint')} error={errors.phone}>
        <input id="reg-phone" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set('phone')(e.target.value)}
          {...described('reg-phone', errors.phone, t('auth.phone_hint'))} />
      </Field>
      <Field id="reg-email" label={t('auth.email')} hint={t('auth.email_hint')} error={errors.email}>
        <input id="reg-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={f.email}
          onChange={(e) => set('email')(e.target.value)} {...described('reg-email', errors.email, t('auth.email_hint'))} />
      </Field>
      <Field id="reg-pw" label={t('auth.password')} error={errors.password}>
        <PasswordInput id="reg-pw" value={f.password} onChange={set('password')} autoComplete="new-password" t={t} error={errors.password} />
        <StrengthMeter pw={f.password} t={t} />
      </Field>
      <Field id="reg-pw2" label={t('auth.confirm')} error={errors.confirm}>
        <PasswordInput id="reg-pw2" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" t={t} error={errors.confirm} />
      </Field>
      {errors.form && <div className="error" role="alert">{errors.form}</div>}
      <button className="btn-primary btn-block btn-lg" type="submit" disabled={busy}>{t('auth.register')}</button>
    </form>
  );
}

export function ForgotForm({ t, lang }: { t: T; lang: Lang }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('POST', '/api/password/forgot', { email: email.trim(), lang });
      setSent(true);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <div className="notice" role="status">{t('auth.forgot_sent')}</div>;
  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <Field id="forgot-email" label={t('auth.email')}>
        <input id="forgot-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn-primary btn-block btn-lg" type="submit" disabled={busy || !email.trim()}>{t('auth.send_link')}</button>
    </form>
  );
}

export function ResetForm({ t, lang, token, onDone }: { t: T; lang: Lang; token: string; onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { setErrors({ confirm: t('err.password_mismatch') }); return; }
    if (pw.length < 8) { setErrors({ password: t('err.weak_password') }); return; }
    setBusy(true);
    setErrors({});
    try {
      await api('POST', '/api/password/reset', { token, password: pw, lang });
      onDone();
    } catch (err) {
      setErrors(errorsFrom(t, err, ['password']));
      setBusy(false);
    }
  }

  if (!token) return <div className="error" role="alert">{t('auth.reset_no_token')}</div>;
  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <Field id="reset-pw" label={t('auth.new_password')} error={errors.password}>
        <PasswordInput id="reset-pw" value={pw} onChange={setPw} autoComplete="new-password" t={t} error={errors.password} />
        <StrengthMeter pw={pw} t={t} />
      </Field>
      <Field id="reset-pw2" label={t('auth.confirm')} error={errors.confirm}>
        <PasswordInput id="reset-pw2" value={pw2} onChange={setPw2} autoComplete="new-password" t={t} error={errors.confirm} />
      </Field>
      {errors.form && <div className="error" role="alert">{errors.form}</div>}
      <button className="btn-primary btn-block btn-lg" type="submit" disabled={busy}>{t('auth.save_password')}</button>
    </form>
  );
}
