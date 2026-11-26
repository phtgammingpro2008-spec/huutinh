import { Boxes, LogOut, PackagePlus, ScanLine, Truck, Warehouse, HandPlatter } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useRoute } from '../admin/router';
import { ThemeToggle } from '../ui/ThemeToggle';
import { kapi } from './api';
import { B, type KKey } from './i18n';
import { BagPage, ScanPage } from './pages/Bag';
import { Cam, Deliver } from './pages/Cam';
import { Labels } from './pages/Labels';
import { Pack } from './pages/Pack';
import { TripList, TripPage } from './pages/Trips';

type Me = { id: string; name: string; role: 'admin' | 'staff' | 'worker' | 'customer' };

function Home({ me }: { me: Me }) {
  const manager = me.role !== 'worker';
  const tiles: [string, KKey, ReactNode][] = [
    ['#/quet', 'scan', <ScanLine key="s" size={30} />],
    ['#/dong-bao', 'pack', <PackagePlus key="p" size={30} />],
    ['#/chuyen', 'trips', <Truck key="t" size={30} />],
    ...(manager ? [['#/kho-cam', 'cam', <Warehouse key="c" size={30} />], ['#/giao', 'deliver', <HandPlatter key="d" size={30} />]] as [string, KKey, ReactNode][] : []),
  ];
  return (
    <main className="page kho-page">
      <h1><B k="title" /></h1>
      <p className="muted">{me.name}</p>
      <nav className="kho-tiles">
        {tiles.map(([href, k, ico]) => <a key={href} href={href} className="kho-tile"><span aria-hidden="true">{ico}</span><B k={k} /></a>)}
      </nav>
    </main>
  );
}

/** /kho: packing, loading, receiving and delivering bags. Workshop hands, managers and the owner. */
export function App() {
  const route = useRoute();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    kapi<Me>('GET', '/api/me').then((m) => {
      if (m.role === 'customer') location.replace('/tai-khoan');
      else setMe(m);
    }).catch(() => location.assign('/dang-nhap?next=' + encodeURIComponent('/kho' + location.hash)));
  }, []);
  if (!me) return <main className="page muted">…</main>;
  const [a, b] = route.parts;
  let screen: ReactNode;
  if (a === 'quet') screen = <ScanPage />;
  else if (a === 'dong-bao') screen = <Pack key={b ?? ''} orderId={b} />;
  else if (a === 'in') screen = <Labels codes={(route.query.get('codes') ?? '').split(',').filter(Boolean)} toa={route.query.get('toa')} />;
  else if (a === 'chuyen' && b) screen = <TripPage key={b} id={b} role={me.role} />;
  else if (a === 'chuyen') screen = <TripList />;
  else if (a === 'kho-cam') screen = <Cam />;
  else if (a === 'giao') screen = <Deliver key={b ?? ''} orderId={b} />;
  else if (a === 'bao' && b) screen = <BagPage key={b} code={decodeURIComponent(b)} role={me.role} />;
  else screen = <Home me={me} />;
  const logout = async () => { await kapi('POST', '/api/logout').catch(() => {}); location.assign('/dang-nhap'); };
  return (
    <div className="app kho-app">
      <header className="app-header no-print">
        <a className="brand" href="#/" aria-label="HLUXURY Kho">
          <span className="brand-logo" aria-hidden="true" />
          <span className="visually-hidden">HLUXURY</span>
          <span className="small muted brand-sub"><Boxes size={14} aria-hidden="true" /> Kho · ឃ្លាំង</span>
        </a>
        {me.role !== 'worker' && <a className="btn-sm btn-ghost" href="/quan-ly">Quản lý</a>}
        <ThemeToggle />
        <button type="button" className="icon-btn" aria-label="Đăng xuất · ចាកចេញ" onClick={logout}><LogOut size={18} aria-hidden="true" /></button>
      </header>
      {screen}
    </div>
  );
}
