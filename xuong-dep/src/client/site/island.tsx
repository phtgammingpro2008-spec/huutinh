// Small script for the server-rendered public pages: header controls, login modal, poster dots, colour picker.
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { uiT, type UiKey } from '../../shared/i18n-ui';
import { LANGS, type Lang } from '../../shared/types';
import { LoginForm, RegisterForm } from '../customer/pages/Auth';
import { LangGlobe } from '../ui/LangGlobe';
import { ThemeToggle } from '../ui/ThemeToggle';
import { LANG_KEY } from '../ui/lang';

const pageLang = (): Lang => (LANGS.includes(document.documentElement.lang as Lang) ? (document.documentElement.lang as Lang) : 'vi');

/** Remembers the language for the server (cookie) and the account pages (localStorage), then reloads in it. */
function chooseLang(l: Lang) {
  document.cookie = `hl-lang=${l}; path=/; max-age=31536000; samesite=lax`;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* storage blocked */ }
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.replace(u.pathname + u.search + u.hash);
}

function Controls() {
  const lang = pageLang();
  const t = (k: UiKey) => uiT(lang, k);
  return (
    <>
      <LangGlobe value={lang} onChange={(l) => l !== lang && chooseLang(l)} label={t('ui.lang')} />
      <ThemeToggle labels={{ toDark: t('ui.to_dark'), toLight: t('ui.to_light') }} />
    </>
  );
}

function AuthModal({ next, onClose }: { next: string; onClose: () => void }) {
  const [lang, setLangState] = useState<Lang>(pageLang);
  const [tab, setTab] = useState<'login' | 'register'>('register');
  const t = (k: UiKey, v?: Record<string, string | number>) => uiT(lang, k, v);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    document.body.classList.add('modal-open');
    box.current?.querySelector<HTMLElement>('input, select')?.focus();
    return () => { document.removeEventListener('keydown', esc); document.body.classList.remove('modal-open'); };
  }, [tab]);
  const done = () => location.assign(next);
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" ref={box}>
        <button type="button" className="icon-btn modal-close" aria-label={t('pub.close')} onClick={onClose}><X size={20} aria-hidden="true" /></button>
        <p className="eyebrow eyebrow-dark">HLUXURY</p>
        <h2 id="auth-modal-title">{t('pub.login_needed')}</h2>
        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'login'} onClick={() => setTab('login')}>{t('auth.tab_login')}</button>
          <button type="button" role="tab" aria-selected={tab === 'register'} onClick={() => setTab('register')}>{t('auth.tab_register')}</button>
        </div>
        {tab === 'login'
          ? <LoginForm t={t} lang={lang} onDone={done} />
          : <RegisterForm t={t} lang={lang} setLang={setLangState} onDone={done} />}
        {tab === 'login' && <p className="auth-foot small"><a href="/quen-mat-khau">{t('auth.forgot_link')}</a></p>}
      </div>
    </div>
  );
}

function mountControls() {
  const el = document.getElementById('hl-controls');
  if (el) createRoot(el).render(<Controls />);
}

let modalRoot: ReturnType<typeof createRoot> | null = null;
function openAuth(next: string) {
  let host = document.getElementById('hl-modal');
  if (!host) { host = document.createElement('div'); host.id = 'hl-modal'; document.body.appendChild(host); }
  modalRoot ??= createRoot(host);
  const opener = document.activeElement as HTMLElement | null;
  modalRoot.render(<AuthModal next={next} onClose={() => { modalRoot!.render(null); opener?.focus(); }} />);
}

/** Buttons that need an account open the modal; "order" comes back to this page, others go where they point. */
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest<HTMLElement>('[data-need-login]');
  if (!a) return;
  e.preventDefault();
  const here = location.pathname + location.search;
  openAuth(a.dataset.needLogin === 'order' ? here : a.dataset.next || here);
});

function posterDots() {
  const strip = document.querySelector<HTMLElement>('.posters');
  const dots = document.querySelectorAll<HTMLElement>('.dots span');
  if (!strip || !dots.length) return;
  strip.addEventListener('scroll', () => {
    const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
    dots.forEach((d, j) => d.classList.toggle('on', j === i));
  }, { passive: true });
}

/** Logged-in product page: tapping a colour shows its picture; the order link carries the chosen colours. */
function colourPicker() {
  const img = document.getElementById('product-img') as HTMLImageElement | null;
  const order = document.querySelector<HTMLAnchorElement>('.product-info a.btn-cta:not([data-need-login])');
  const boxes = [...document.querySelectorAll<HTMLInputElement>('.swatch input[name="mau"]')];
  if (!boxes.length) return;
  const base = order?.getAttribute('href') ?? '';
  const sync = () => {
    const ids = boxes.filter((b) => b.checked).map((b) => b.value);
    if (order) order.href = base + (ids.length ? '&mau=' + ids.join(',') : '');
  };
  for (const b of boxes) {
    b.addEventListener('change', () => {
      const src = b.closest<HTMLElement>('.swatch')?.dataset.img;
      if (img && src && b.checked) img.src = src;
      sync();
    });
  }
  sync();
}

mountControls();
posterDots();
colourPicker();
