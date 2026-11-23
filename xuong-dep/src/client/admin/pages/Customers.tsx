import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Customer } from '../catalog';
import { OrderList, type OrderSummary } from '../components/OrderRow';
import { go } from '../router';

export function Customers() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Customer[] | null>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    const t = setTimeout(() => api<Customer[]>('GET', `/api/customers?q=${encodeURIComponent(q)}`).then(setList).catch(() => setList([])), 200);
    return () => clearTimeout(t);
  }, [q]);

  async function add() {
    const c = await api<Customer>('POST', '/api/customers', { name });
    go(`/customers/${c.id}`);
  }

  return (
    <main className="page">
      <h1>Khách hàng</h1>
      <input aria-label="Tìm khách" placeholder="Tìm theo tên hoặc số Zalo" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row" style={{ margin: '10px 0' }}>
        <input className="grow" aria-label="Tên khách mới" placeholder="Tên khách mới" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn-sm" disabled={!name.trim()} onClick={add}>+ Thêm khách</button>
      </div>
      {list === null ? <p className="muted">Đang tải…</p> : list.length === 0 ? <p className="muted">Chưa có khách nào.</p> : (
        <ul className="list">
          {list.map((c) => (
            <li key={c.id}>
              <a className="list-item" href={`#/customers/${c.id}`}>
                <div className="grow"><strong>{c.name}</strong><div className="small muted">{[c.zalo, c.country, c.lang.toUpperCase(), c.currency].filter(Boolean).join(' · ')}</div></div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

type CustomerDetailData = Customer & { orders: OrderSummary[] };

export function CustomerDetail({ id }: { id: string }) {
  const [c, setC] = useState<CustomerDetailData | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api<CustomerDetailData>('GET', `/api/customers/${id}`).then(setC).catch((e) => setError(e.message)); }, [id]);
  if (!c) return <main className="page">{error ? <p className="error">{error}</p> : <p className="muted">Đang tải…</p>}</main>;

  const set = (k: keyof Customer, v: string) => { setMsg(''); setC({ ...c, [k]: v } as CustomerDetailData); };
  const current = c;
  async function save() {
    setError('');
    try {
      const u = await api<Customer>('PUT', `/api/customers/${id}`, current);
      setC({ ...current, ...u, orders: current.orders });
      setMsg('Đã lưu');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không lưu được');
    }
  }
  const field = (k: keyof Customer, label: string, props: Record<string, unknown> = {}) => (
    <div className="field">
      <label htmlFor={`c-${k}`}>{label}</label>
      <input id={`c-${k}`} value={String(c[k] ?? '')} onChange={(e) => set(k, e.target.value)} {...props} />
    </div>
  );

  return (
    <main className="page">
      <div className="topbar"><h1>{c.name}</h1><a className="btn btn-sm" href="#/customers">Danh sách</a></div>
      <section className="card">
        {field('name', 'Tên khách')}
        {field('zalo', 'Số Zalo', { inputMode: 'tel' })}
        {field('messenger', 'Link Messenger')}
        {field('country', 'Quốc gia')}
        <div className="row">
          <div className="grow field">
            <label htmlFor="c-lang">Ngôn ngữ báo giá</label>
            <select id="c-lang" value={c.lang} onChange={(e) => set('lang', e.target.value)}>
              <option value="vi">Tiếng Việt</option><option value="en">English</option><option value="km">ខ្មែរ (Khmer)</option>
            </select>
          </div>
          <div className="grow field">
            <label htmlFor="c-cur">Loại tiền mặc định</label>
            <select id="c-cur" value={c.currency} onChange={(e) => set('currency', e.target.value)}>
              <option value="VND">VND</option><option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="c-note">Ghi chú</label>
          <textarea id="c-note" value={c.note} onChange={(e) => set('note', e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="button" className="btn-primary grow" onClick={save}>Lưu khách</button>
          {msg && <span className="success">{msg}</span>}
        </div>
      </section>
      <h2>Lịch sử đơn</h2>
      <OrderList orders={c.orders} empty="Khách chưa có đơn nào." />
    </main>
  );
}
