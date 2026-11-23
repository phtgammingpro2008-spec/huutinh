import { useEffect, useState } from 'react';
import { STATUSES, STATUS_LABEL_VI } from '../../../shared/status';
import { api } from '../api';
import { OrderList, type OrderSummary } from '../components/OrderRow';

export function Orders() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (q.trim()) qs.set('q', q.trim());
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      api<OrderSummary[]>('GET', `/api/orders?${qs}`).then((x) => { setOrders(x); setError(''); }).catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [status, q, from, to]);

  return (
    <main className="page">
      <div className="topbar"><h1>Đơn hàng</h1><a className="btn btn-sm" href="#/customers">Khách hàng</a></div>
      <input aria-label="Tìm mã đơn hoặc tên khách" placeholder="Tìm mã đơn hoặc tên khách" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ margin: '10px 0' }}>
        <button type="button" className="chip" aria-pressed={status === ''} onClick={() => setStatus('')}>Tất cả</button>
        {STATUSES.map((s) => <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>{STATUS_LABEL_VI[s]}</button>)}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow"><label htmlFor="o-from" className="small">Từ ngày</label><input id="o-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="grow"><label htmlFor="o-to" className="small">Đến ngày</label><input id="o-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {error && <p className="error">{error}</p>}
      <OrderList orders={orders} empty="Không có đơn nào." />
    </main>
  );
}
