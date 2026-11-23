import { formatMoney, formatQty } from '../../../shared/money';
import { STATUS_LABEL_VI } from '../../../shared/status';
import type { Currency, OrderStatus } from '../../../shared/types';
import { imgUrl } from '../api';

export type OrderSummary = {
  id: string; code: string; status: OrderStatus; customerId: string; customerName: string; currency: Currency;
  createdAt: string; neededBy: string | null; acceptedAt: string | null; totalQty: number; amount: number;
  missingPrice: boolean; paid: number; due: number; thumbKey: string | null;
};

export const StatusBadge = ({ s }: { s: OrderStatus }) => <span className={`badge s-${s}`}>{STATUS_LABEL_VI[s]}</span>;

export const viDate = (iso: string | null) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export function OrderRow({ o, extra }: { o: OrderSummary; extra?: string }) {
  return (
    <a className="list-item order-row" href={`#/orders/${o.id}`}>
      {o.thumbKey ? <img className="thumb" src={imgUrl(o.thumbKey)} alt="" loading="lazy" /> : <div className="thumb" />}
      <div className="grow">
        <div className="row"><strong className="grow">{o.code}</strong><StatusBadge s={o.status} /></div>
        <div className="small">{o.customerName} · <span className="num">{formatQty(o.totalQty)} đôi</span>
          {o.amount > 0 && <> · <span className="num">{formatMoney(o.amount, o.currency, 'vi')}</span></>}</div>
        {extra && <div className="small muted">{extra}</div>}
      </div>
    </a>
  );
}

export function OrderList({ orders, empty, extra }: { orders: OrderSummary[] | null; empty: string; extra?: (o: OrderSummary) => string | undefined }) {
  if (!orders) return <p className="muted">Đang tải…</p>;
  if (!orders.length) return <p className="muted">{empty}</p>;
  return <ul className="list">{orders.map((o) => <li key={o.id}><OrderRow o={o} extra={extra?.(o)} /></li>)}</ul>;
}
