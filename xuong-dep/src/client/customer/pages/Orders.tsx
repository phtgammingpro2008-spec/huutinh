import { ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatQty } from '../../../shared/money';
import type { OrderStatus } from '../../../shared/types';
import type { T } from '../../ui/lang';
import { api } from '../api';
import { dmy, media, statusText } from '../common';
import { errorText } from './Auth';

type Row = { id: string; code: string; status: OrderStatus; createdAt: string; neededBy: string | null; totalQty: number; thumbKey: string | null };

export function Orders({ t, name }: { t: T; name: string }) {
  const [list, setList] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<Row[]>('GET', '/api/c/orders').then(setList, (e) => setError(errorText(t, e))); }, []);
  return (
    <main className="page">
      <section className="home-hero">
        <p className="home-hero-brand">HLUXURY</p>
        <h1>{t('acc.hello', { name })}</h1>
        <p className="home-hero-lead">{t('c.home_lead')}</p>
        <div className="row wrap" style={{ gap: 10 }}>
          <a className="btn-gold" href="#/dat-hang"><Plus size={18} aria-hidden="true" /> {t('c.nav_new')}</a>
          <a className="btn-line" href="#/thu-vien">{t('c.browse_library')}</a>
        </div>
      </section>
      <h2>{t('c.nav_orders')}</h2>
      {error && <p className="error">{error}</p>}
      {!list && !error && <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 76 }} />)}</div>}
      {list && list.length === 0 && (
        <div className="empty-card">
          <p>{t('c.orders_empty')}</p>
          <a className="btn-cta" href="#/dat-hang">{t('c.start_order')}</a>
        </div>
      )}
      {list && list.length > 0 && (
        <ul className="list">
          {list.map((o) => (
            <li key={o.id}>
              <a className="list-item" href={`#/don/${o.id}`}>
                {o.thumbKey ? <img className="thumb" src={media(o.thumbKey)} alt="" loading="lazy" /> : <div className="thumb" />}
                <div className="grow">
                  <strong>{t('c.order_code', { code: o.code })}</strong>
                  <div className="small muted">{t('c.created', { date: dmy(o.createdAt) })} · {t('c.pairs', { n: formatQty(o.totalQty) })}</div>
                </div>
                <span className={`badge s-${o.status}`}>{statusText(t, o.status)}</span>
                <ChevronRight size={18} aria-hidden="true" className="muted" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
