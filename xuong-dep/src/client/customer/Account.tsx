import { BookImage, ClipboardList, House, Plus, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Lang } from '../../shared/types';
import { useRoute, type Route } from '../admin/router';
import type { T } from '../ui/lang';
import type { Me } from './api';
import { Controls } from './Controls';
import { Library } from './pages/Library';
import { NewOrder } from './pages/NewOrder';
import { OrderView } from './pages/OrderView';
import { Orders } from './pages/Orders';
import { Profile } from './pages/Profile';

/** The signed-in customer's area at /tai-khoan: #/ orders, #/don/:id, #/dat-hang, #/thu-vien, #/ho-so. */
export function Account({ me, t, lang, setLang, onMe }: { me: Me; t: T; lang: Lang; setLang: (l: Lang) => void; onMe: (m: Me) => void }) {
  const route = useRoute();
  const [a, b] = route.parts;
  const tabs = [
    { href: '/', label: t('pub.home'), ico: <House size={22} />, on: false },
    { href: '#/', label: t('c.nav_orders'), ico: <ClipboardList size={22} />, on: !a || a === 'don' },
    { href: '#/dat-hang', label: t('c.nav_new'), ico: <Plus size={24} />, on: a === 'dat-hang', plus: true },
    { href: '#/thu-vien', label: t('c.nav_library'), ico: <BookImage size={22} />, on: a === 'thu-vien' },
    { href: '#/ho-so', label: t('c.nav_profile'), ico: <UserRound size={22} />, on: a === 'ho-so' },
  ];
  return (
    <div className="app">
      <header className="app-header">
        <a className="brand" href="/" aria-label="HLUXURY">
          <span className="brand-logo" aria-hidden="true" />
          <span className="visually-hidden">HLUXURY</span>
        </a>
        <Controls t={t} lang={lang} setLang={setLang} />
      </header>
      <Screen route={route} a={a} b={b} me={me} t={t} lang={lang} setLang={setLang} onMe={onMe} />
      <nav className="tabbar" aria-label={t('c.nav_orders')}>
        {tabs.map((x) => (
          <a key={x.href} href={x.href} className={`${x.on ? 'active' : ''} ${x.plus ? 'plus' : ''}`} aria-current={x.on ? 'page' : undefined}>
            <span className="ico" aria-hidden="true">{x.ico}</span><span>{x.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

function Screen({ route, a, b, me, t, lang, setLang, onMe }: {
  route: Route; a?: string; b?: string; me: Me; t: T; lang: Lang; setLang: (l: Lang) => void; onMe: (m: Me) => void;
}): ReactNode {
  if (a === 'don' && b) return <OrderView key={b} id={b} t={t} lang={lang} />;
  if (a === 'dat-hang') return <NewOrder key={route.path + (route.query.get('don') ?? '')} route={route} t={t} lang={lang} />;
  if (a === 'thu-vien') return <Library t={t} lang={lang} />;
  if (a === 'ho-so') return <Profile me={me} t={t} lang={lang} setLang={setLang} verified={route.query.get('verified')} onMe={onMe} />;
  return <Orders t={t} name={me.name} />;
}
