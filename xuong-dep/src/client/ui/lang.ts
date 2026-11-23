import { useState } from 'react';
import { uiT, type UiKey } from '../../shared/i18n-ui';
import { LANGS, type Lang } from '../../shared/types';

export const LANG_KEY = 'hl-lang';

/** Saved choice, else the browser's language (Khmer, Vietnamese, otherwise English). */
export function getLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved && LANGS.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  const nav = (navigator.language || 'vi').toLowerCase();
  return nav.startsWith('km') ? 'km' : nav.startsWith('vi') ? 'vi' : 'en';
}

export function saveLang(l: Lang): void {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* storage blocked: still switches for this page */ }
  document.documentElement.lang = l;
}

/** Current language plus a translator bound to it. */
export function useLang() {
  const [lang, set] = useState<Lang>(() => {
    const l = getLang();
    document.documentElement.lang = l;
    return l;
  });
  const t = (key: UiKey, vars?: Record<string, string | number>) => uiT(lang, key, vars);
  const setLang = (l: Lang) => { saveLang(l); set(l); };
  return { lang, setLang, t };
}

export type T = ReturnType<typeof useLang>['t'];
