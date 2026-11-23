import { ClipboardList, Home as HomeIcon, Images, Plus, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { api, AUTH_LOST } from './api';
import { Login, type Me } from './pages/Login';
import { ProductionSheet } from './components/ProductionSheet';
import { CustomerDetail, Customers } from './pages/Customers';
import { Home } from './pages/Home';
import { DesignDetail, Library } from './pages/Library';
import { OrderDetail } from './pages/OrderDetail';
import { OrderEditor } from './pages/OrderEditor';
import { Orders } from './pages/Orders';
import { Settings } from './pages/Settings';
import { Content } from './pages/Content';
import { Users } from './pages/Users';
import { useRoute, type Route } from './router';

type Auth = { state: 'loading' } | { state: 'out'; needsSetup: boolean } | { state: 'in'; me: Me };

const TABS = [
  { href: '#/', label: 'Trang chủ', ico: <HomeIcon size={22} />, match: (r: Route) => r.parts.length === 0 },
  { href: '#/orders', label: 'Đơn hàng', ico: <ClipboardList size={22} />, match: (r: Route) => r.parts[0] === 'orders' && r.parts[1] !== 'new' },
  { href: '#/orders/new', label: 'Đơn mới', ico: <Plus size={24} />, match: (r: Route) => r.path === '/orders/new', plus: true },
  { href: '#/library', label: 'Thư viện', ico: <Images size={22} />, match: (r: Route) => r.parts[0] === 'library' },
  { href: '#/settings', label: 'Cài đặt', ico: <SettingsIcon size={22} />, match: (r: Route) => ['settings', 'customers', 'users', 'content'].includes(r.parts[0]) },
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
  if (!a) return <Home />;
  if (a === 'orders' && b === 'new') return <OrderEditor key={route.path + route.query} designId={route.query.get('design')} libraryOnly={route.query.get('library') === '1'} />;
  if (a === 'orders' && b && route.parts[2] === 'sheet') return <ProductionSheet key={b} id={b} />;
  if (a === 'orders' && b && route.parts[2] === 'edit') return <OrderEditor key={route.path} orderId={b} />;
  if (a === 'orders' && b) return <OrderDetail key={b} id={b} />;
  if (a === 'orders') return <Orders />;
  if (a === 'library' && b) return <DesignDetail key={b} id={b} />;
  if (a === 'library') return <Library />;
  if (a === 'customers' && b) return <CustomerDetail key={b} id={b} />;
  if (a === 'customers') return <Customers />;
  if (a === 'settings') return <Settings />;
  if (a === 'users') return <Users />;
  if (a === 'content') return <Content />;
  return <Placeholder title="Không tìm thấy trang" />;
}

export function App() {
  const route = useRoute();
  const [auth, setAuth] = useState<Auth>({ state: 'loading' });

  async function check() {
    try {
      const me = await api<Me>('GET', '/api/me');
      // customers have their own area; the admin pages would only answer them with 404s
      if (me.role === 'customer') { location.replace('/tai-khoan'); return; }
      setAuth({ state: 'in', me });
    } catch {
      const s = await api<{ needsSetup: boolean }>('GET', '/api/setup-status').catch(() => ({ needsSetup: false }));
      // first run creates the admin here; after that everyone signs in on the shared login page
      if (!s.needsSetup) { location.replace('/dang-nhap?next=' + encodeURIComponent('/quan-ly' + location.hash)); return; }
      setAuth({ state: 'out', needsSetup: true });
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
      <header className="app-header">
        <a className="brand" href="#/" aria-label="HLUXURY – quản lý">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span><span className="brand-name">HLUXURY</span><span className="small muted" style={{ display: 'block' }}>Quản lý xưởng</span></span>
        </a>
        <ThemeToggle />
      </header>
      <Screen route={route} />
      <TabBar route={route} />
    </div>
  );
}
