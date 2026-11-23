import type { Lang } from '../../shared/types';
import { LangGlobe } from '../ui/LangGlobe';
import { ThemeToggle } from '../ui/ThemeToggle';
import type { T } from '../ui/lang';

/** Header controls shared by every customer page: language globe + light/dark. */
export function Controls({ t, lang, setLang }: { t: T; lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="row">
      <LangGlobe value={lang} onChange={setLang} label={t('ui.lang')} />
      <ThemeToggle labels={{ toDark: t('ui.to_dark'), toLight: t('ui.to_light') }} />
    </div>
  );
}
