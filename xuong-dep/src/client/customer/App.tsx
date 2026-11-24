import { useEffect, useState, type ReactNode } from 'react';
import type { Lang } from '../../shared/types';
import { saveLang, useLang, type T } from '../ui/lang';
import { Account } from './Account';
import { Controls } from './Controls';
import { api, safeNext, type Me } from './api';
import { ForgotForm, LoginForm, RegisterForm, ResetForm } from './pages/Auth';

const homeOf = (role: string) => (role === 'admin' ? '/quan-ly' : '/tai-khoan');

/** Premium two-part screen: dark brand band (left on wide screens) + the form card. */
function AuthShell({ t, lang, setLang, title, sub, tabs, children, foot }: {
  t: T; lang: Lang; setLang: (l: Lang) => void; title: string; sub: string; tabs?: 'login' | 'register'; children: ReactNode; foot?: ReactNode;
}) {
  const next = new URLSearchParams(location.search).get('next');
  const keep = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="auth-hero-top">
          <a className="brand brand-light" href="/" aria-label="HLUXURY">
            <span className="brand-logo" aria-hidden="true" />
            <span className="visually-hidden">HLUXURY</span>
          </a>
          <Controls t={t} lang={lang} setLang={setLang} />
        </div>
        <div className="auth-hero-copy">
          <p className="eyebrow">{t('ui.tagline')}</p>
          <p className="auth-hero-title">{t('ui.hero_title')}</p>
          <ul className="auth-points">{t('ui.hero_points').split(' · ').map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </section>
      <main className="auth-card">
        {tabs && (
          <nav className="auth-tabs" aria-label={t('auth.tab_login') + ' / ' + t('auth.tab_register')}>
            <a href={'/dang-nhap' + keep} aria-current={tabs === 'login' ? 'page' : undefined}>{t('auth.tab_login')}</a>
            <a href={'/dang-ky' + keep} aria-current={tabs === 'register' ? 'page' : undefined}>{t('auth.tab_register')}</a>
          </nav>
        )}
        <h1>{title}</h1>
        <p className="muted auth-sub">{sub}</p>
        {children}
        {foot && <div className="auth-foot">{foot}</div>}
      </main>
    </div>
  );
}

const go = (url: string) => location.assign(url);
const afterLogin = (role: string) => go(safeNext(new URLSearchParams(location.search).get('next')) ?? homeOf(role));

export function App() {
  const { lang, setLang, t } = useLang();
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(location.search);
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    api<Me>('GET', '/api/me').then((m) => {
      if (m.role === 'customer' && m.lang && m.lang !== lang && path === '/tai-khoan') { saveLang(m.lang); setLang(m.lang); }
      setMe(m);
    }, () => setMe(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // signed-in people never see the login/register pages; the account needs a signed-in customer
  useEffect(() => {
    if (me === undefined) return;
    const authPage = path === '/dang-nhap' || path === '/dang-ky';
    if (me && authPage) afterLogin(me.role);
    else if (path === '/tai-khoan' && !me) location.replace('/dang-nhap?next=' + encodeURIComponent('/tai-khoan' + location.hash));
    else if (path === '/tai-khoan' && me?.role === 'admin') location.replace('/quan-ly');
  }, [me, path]);

  const shell = { t, lang, setLang };
  if (path === '/dang-nhap') {
    return (
      <AuthShell {...shell} tabs="login" title={t('auth.login_title')} sub={t('auth.login_sub')}
        foot={<>{t('auth.no_account')} <a href="/dang-ky">{t('auth.tab_register')}</a></>}>
        <LoginForm t={t} lang={lang} onDone={(m) => afterLogin(m.role)} notice={q.get('reset') === '1' ? t('auth.reset_done') : undefined} />
      </AuthShell>
    );
  }
  if (path === '/dang-ky') {
    return (
      <AuthShell {...shell} tabs="register" title={t('auth.register_title')} sub={t('auth.register_sub')}
        foot={<>{t('auth.have_account')} <a href="/dang-nhap">{t('auth.tab_login')}</a></>}>
        <RegisterForm t={t} lang={lang} setLang={setLang} onDone={(m) => afterLogin(m.role)} />
      </AuthShell>
    );
  }
  if (path === '/quen-mat-khau') {
    return (
      <AuthShell {...shell} title={t('auth.forgot_title')} sub={t('auth.forgot_sub')} foot={<a href="/dang-nhap">{t('auth.back_login')}</a>}>
        <ForgotForm t={t} lang={lang} />
      </AuthShell>
    );
  }
  if (path === '/dat-lai-mat-khau') {
    return (
      <AuthShell {...shell} title={t('auth.reset_title')} sub="" foot={<a href="/dang-nhap">{t('auth.back_login')}</a>}>
        <ResetForm t={t} lang={lang} token={q.get('token') ?? ''} onDone={() => location.replace('/dang-nhap?reset=1')} />
      </AuthShell>
    );
  }
  if (!me || me.role !== 'customer') return <main className="page"><div className="skeleton" style={{ height: 200 }} /></main>;
  // a signed-in customer's language lives in their profile: the globe saves it there too
  const setAccountLang = (l: Lang) => {
    setLang(l);
    document.cookie = `hl-lang=${l}; path=/; max-age=31536000; samesite=lax`;
    setMe({ ...me, lang: l });
    api('PUT', '/api/c/profile', { lang: l }).catch(() => {});
  };
  return <Account me={me} t={t} lang={lang} setLang={setAccountLang} onMe={setMe} />;
}
