import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Customer } from '../catalog';

export type CustomerLite = Pick<Customer, 'id' | 'name' | 'lang' | 'currency'>;

/** Search existing customers or add one with just a name. */
export function CustomerPicker({ value, onChange, disabled }: { value: CustomerLite | null; onChange: (c: CustomerLite | null) => void; disabled?: boolean }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Customer[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (value) return;
    const t = setTimeout(() => {
      api<Customer[]>('GET', `/api/customers?q=${encodeURIComponent(q)}`).then(setList).catch(() => setList([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, value]);

  if (value) {
    return (
      <div className="row card">
        <strong className="grow">Khách: {value.name}</strong>
        {!disabled && <button type="button" className="btn-sm" onClick={() => onChange(null)}>Đổi</button>}
      </div>
    );
  }

  async function create() {
    setError('');
    try {
      const c = await api<Customer>('POST', '/api/customers', { name });
      onChange(c);
      setAdding(false);
      setName('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không thêm được khách');
    }
  }

  return (
    <div className="card">
      <div className="row">
        <input className="grow" aria-label="Tìm khách" placeholder="Tìm khách (tên hoặc số Zalo)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn-sm" onClick={() => setAdding((a) => !a)}>+ Khách mới</button>
      </div>
      {adding && (
        <div className="row" style={{ marginTop: 8 }}>
          <input className="grow" aria-label="Tên khách mới" placeholder="Tên khách, ví dụ chị Nga" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} autoFocus />
          <button type="button" className="btn-sm btn-primary" disabled={!name.trim()} onClick={create}>Thêm khách</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {list.length > 0 && (
        <ul className="list" style={{ marginTop: 8 }}>
          {list.slice(0, 8).map((c) => (
            <li key={c.id}>
              <button type="button" className="btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => onChange(c)}>
                {c.name}{c.zalo ? <span className="muted small">&nbsp;· {c.zalo}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
