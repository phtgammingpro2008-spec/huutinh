import { BadgeCheck, LogOut, MailWarning } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LANGS, type Lang } from '../../../shared/types';
import type { T } from '../../ui/lang';
import { api, type Me } from '../api';
import { useFlash } from '../common';
import { errorText, passwordStrength } from './Auth';

const LANG_NAMES: Record<Lang, string> = { vi: 'Tiếng Việt', en: 'English', km: 'ខ្មែរ' };

export function Profile({ me, t, lang, setLang, verified, onMe }: {
  me: Me; t: T; lang: Lang; setLang: (l: Lang) => void; verified: string | null; onMe: (m: Me) => void;
}) {
  const [name, setName] = useState(me.name);
  const [flash, setFlash] = useFlash();
  const [error, setError] = useState('');
  const [pw, setPw] = useState({ current: '', password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [resent, setResent] = useState('');

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ name: string; lang: Lang }>('PUT', '/api/c/profile', { name, lang });
      onMe({ ...me, ...r });
      setFlash(t('c.saved'));
    } catch (err) { setError(errorText(t, err)); }
  }
  async function changePw(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.password !== pw.confirm) return setPwMsg({ ok: false, text: t('err.password_mismatch') });
    if (passwordStrength(pw.password) === 'weak') return setPwMsg({ ok: false, text: t('err.weak_password') });
    try {
      await api('POST', '/api/password/change', { current: pw.current, password: pw.password });
      setPw({ current: '', password: '', confirm: '' });
      setPwMsg({ ok: true, text: t('c.pw_changed') });
    } catch (err) { setPwMsg({ ok: false, text: errorText(t, err) }); }
  }
  async function resend() {
    try { await api('POST', '/api/email/resend'); setResent(t('c.resent')); } catch (err) { setResent(errorText(t, err)); }
  }
  async function logout() {
    await api('POST', '/api/logout').catch(() => {});
    location.assign('/dang-nhap');
  }

  return (
    <main className="page">
      <h1>{t('c.profile')}</h1>
      {verified === '1' && <div className="success" role="status">{t('c.verified_ok')}</div>}
      {verified === '0' && <div className="error" role="alert">{t('c.verified_bad')}</div>}

      <form className="card stack" onSubmit={saveProfile} noValidate>
        <div>
          <label htmlFor="pf-name">{t('auth.name')}</label>
          <input id="pf-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pf-lang">{t('ui.lang')}</label>
          <select id="pf-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
          </select>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {flash && <p className="success" role="status">{flash}</p>}
        <button type="submit" className="btn-primary">{t('c.save_profile')}</button>
      </form>

      <section className="card stack" style={{ marginTop: 14 }}>
        <div className="row"><span className="grow muted">{t('auth.phone')}</span><strong className="num">{me.phone}</strong></div>
        <div className="row wrap">
          <span className="grow muted">{t('auth.email')}</span>
          <strong>{me.email}</strong>
          {me.emailVerified
            ? <span className="badge s-khach_dong_y"><BadgeCheck size={14} aria-hidden="true" /> {t('c.email_verified')}</span>
            : <span className="badge s-cho_bao_gia"><MailWarning size={14} aria-hidden="true" /> {t('c.email_unverified')}</span>}
        </div>
        {!me.emailVerified && (
          <>
            <p className="small muted" style={{ margin: 0 }}>{t('c.verify_needed')}</p>
            <button type="button" className="btn btn-sm" onClick={resend}>{t('c.resend')}</button>
            {resent && <p className="small" role="status">{resent}</p>}
          </>
        )}
      </section>

      <form className="card stack" style={{ marginTop: 14 }} onSubmit={changePw} noValidate>
        <h2 style={{ margin: 0 }}>{t('c.change_pw')}</h2>
        <div><label htmlFor="pf-cur">{t('c.current_pw')}</label><input id="pf-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
        <div><label htmlFor="pf-new">{t('auth.new_password')}</label><input id="pf-new" type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></div>
        <div><label htmlFor="pf-new2">{t('auth.confirm')}</label><input id="pf-new2" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
        {pwMsg && <p className={pwMsg.ok ? 'success' : 'error'} role={pwMsg.ok ? 'status' : 'alert'}>{pwMsg.text}</p>}
        <button type="submit" className="btn" disabled={!pw.current || !pw.password}>{t('c.change_pw')}</button>
      </form>

      <button type="button" className="btn btn-block btn-danger" style={{ marginTop: 16 }} onClick={logout}><LogOut size={18} aria-hidden="true" /> {t('acc.logout')}</button>
    </main>
  );
}
