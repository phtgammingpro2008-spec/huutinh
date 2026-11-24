import { useEffect, useState } from 'react';
import { formatMoney } from '../../../shared/money';
import { api } from '../api';
import { OrderList, viDate, type OrderSummary } from '../components/OrderRow';

type Dashboard = { newFromCustomers: OrderSummary[]; waitingQuote: OrderSummary[]; justAccepted: OrderSummary[]; dueSoon: OrderSummary[]; unpaid: OrderSummary[] };

function Bucket({ title, orders, empty, extra }: { title: string; orders: OrderSummary[] | undefined; empty: string; extra?: (o: OrderSummary) => string | undefined }) {
  return (
    <section aria-label={title} style={{ marginTop: 20 }}>
      <h2>{title}{orders && orders.length > 0 && <span className="badge count" style={{ marginLeft: 8 }}>{orders.length}</span>}</h2>
      <OrderList orders={orders ?? null} empty={empty} extra={extra} />
    </section>
  );
}

export function Home() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<Dashboard>('GET', '/api/dashboard').then(setD).catch((e) => setError(e.message)); }, []);
  return (
    <main className="page">
      <section className="home-hero">
        <p className="home-hero-brand">HLUXURY</p>
        <h1>Trang chủ</h1>
        <dl className="home-stats">
          <div><dt>Đơn khách mới</dt><dd>{d ? d.newFromCustomers.length : '–'}</dd></div>
          <div><dt>Chờ báo giá</dt><dd>{d ? d.waitingQuote.length : '–'}</dd></div>
          <div><dt>Còn nợ tiền</dt><dd>{d ? d.unpaid.length : '–'}</dd></div>
        </dl>
        <a className="btn-gold" href="#/orders/new">+ Đơn mới</a>
      </section>
      {error && <p className="error">{error}</p>}
      {d && d.newFromCustomers.length > 0 && (
        <div className="highlight-bucket">
          <Bucket title="Đơn khách mới" orders={d.newFromCustomers} empty="" extra={(o) => `Đặt ${viDate(o.createdAt)} · chưa xem`} />
        </div>
      )}
      <Bucket title="Chờ báo giá" orders={d?.waitingQuote} empty="Không có đơn chờ báo giá." />
      <Bucket title="Khách vừa đồng ý" orders={d?.justAccepted} empty="Chưa có khách đồng ý trong 7 ngày qua."
        extra={(o) => (o.acceptedAt ? `Đồng ý ${viDate(o.acceptedAt)}` : undefined)} />
      <Bucket title="Sắp đến ngày giao" orders={d?.dueSoon} empty="Không có đơn nào cần giao trong 7 ngày tới."
        extra={(o) => (o.neededBy ? `Cần hàng ${viDate(o.neededBy)}` : undefined)} />
      <Bucket title="Còn nợ tiền" orders={d?.unpaid} empty="Không có đơn còn nợ."
        extra={(o) => `Còn lại ${formatMoney(o.due, o.currency, 'vi')}`} />
    </main>
  );
}
