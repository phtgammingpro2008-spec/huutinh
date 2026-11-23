import { useEffect, useState, type ReactNode } from 'react';
import { api, AUTH_LOST } from './api';
import { Login, type Me } from './pages/Login';
import { OrderEditor } from './pages/OrderEditor';
import { useRoute, type Route } from './router';

type Auth = { state: 'loading' } | { state: 'out'; needsSetup: boolean } | { state: 'in'; me: Me };

const TABS = [
  { href: '#/', label: 'Trang chủ', ico: '⌂', match: (r: Route) => r.parts.length === 0 },
  { href: '#/orders', label: 'Đơn hàng', ico: '☰', match: (r: Route) => r.parts[0] === 'orders' && r.parts[1] !== 'new' },
  { href: '#/orders/new', label: 'Đơn mới', ico: '+', match: (r: Route) => r.path === '/orders/new', plus: true },
  { href: '#/library', label: 'Thư viện', ico: '▦', match: (r: Route) => r.parts[0] === 'library' },
  { href: '#/settings', label: 'Cài đặt', ico: '⚙', match: (r: Route) => r.parts[0] === 'settings' || r.parts[0] === 'customers' },
];

function TabBar({ route }: { route: Route }) {
  return (
    <nav className="tabbar" aria-label="Điều hướng chính">
      {TABS.map((t) => (
        <a key={t.href} href={t.href} className={`${t.match(route) ? 'active' : ''} ${t.plus ? 'plus' : ''}`}
          aria-current={t.match(route) ? 'page' : undefined}>
          <span className="ico" aria-hidden="true">{t.ico}</span>
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

function Placeholder({ title }: { title: string }) {
  return <main className="page"><h1>{title}</h1><p className="muted">Đang xây dựng.</p></main>;
}

function Screen({ route }: { route: Route }): ReactNode {
  const [a, b] = route.parts;
  if (!a) return <Placeholder title="Trang chủ" />;
  if (a === 'orders' && b === 'new') return <OrderEditor key={route.path + route.query} designId={route.query.get('design')} />;
  if (a === 'orders' && b && route.parts[2] === 'edit') return <OrderEditor key={route.path} orderId={b} />;
  if (a === 'orders') return <Placeholder title="Đơn hàng" />;
  if (a === 'library') return <Placeholder title="Thư viện mẫu" />;
  if (a === 'customers') return <Placeholder title="Khách hàng" />;
  if (a === 'settings') return <Placeholder title="Cài đặt" />;
  return <Placeholder title="Không tìm thấy trang" />;
}

export function App() {
  const route = useRoute();
  const [auth, setAuth] = useState<Auth>({ state: 'loading' });

  async function check() {
    try {
      setAuth({ state: 'in', me: await api<Me>('GET', '/api/me') });
    } catch {
      const s = await api<{ needsSetup: boolean }>('GET', '/api/setup-status').catch(() => ({ needsSetup: false }));
      setAuth({ state: 'out', needsSetup: s.needsSetup });
    }
  }

  useEffect(() => {
    check();
    const lost = () => check();
    window.addEventListener(AUTH_LOST, lost);
    return () => window.removeEventListener(AUTH_LOST, lost);
  }, []);

  if (auth.state === 'loading') return <main className="page muted">Đang tải…</main>;
  if (auth.state === 'out') {
    return <Login needsSetup={auth.needsSetup} onDone={(me) => { setAuth({ state: 'in', me }); if (route.path === '/login') window.location.hash = '#/'; }} />;
  }
  return (
    <div className="app">
      <Screen route={route} />
      <TabBar route={route} />
    </div>
  );
}
