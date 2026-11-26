import { useEffect, useMemo, useState } from 'react';
import { formatMoney, formatQty, parseMoney } from '../../../shared/money';
import { STATUSES, STATUS_LABEL_VI, canTransition, printable, qtyPriceLocked, rank } from '../../../shared/status';
import { itemQty, lineQty, lineSizes } from '../../../shared/totals';
import type { Currency, Item, Line, OrderInput, OrderStatus } from '../../../shared/types';
import { localDate } from '../../../shared/dates';
import { api, ApiError } from '../api';
import { lineLabel, useSettings, type Customer, type Material } from '../catalog';
import { CropThumb } from '../components/CropThumb';
import { StatusBadge, viDate } from '../components/OrderRow';
import { PriceHistory, clearPriceHistoryCache } from '../components/PriceHistory';

export type Payment = { id: string; amount: number; paidOn: string; note: string };
export type OrderView = OrderInput & {
  code: string; status: OrderStatus; quoteVersion: number; quoteToken: string | null; customer: Customer;
  totals: { qty: number; amount: number; missingPrice: boolean }; paid: number; due: number; payments: Payment[];
  createdAt: string; quotedAt: string | null; acceptedAt: string | null;
  source?: 'admin' | 'customer'; cancelReason?: string; cancelledBy?: string | null;
  productTitles?: Record<string, { product: { vi: string }; color: { vi: string } }>;
  shipping?: Shipping;
};
type ShipLine = { key: string; label: { vi: string }; perRi: number; orderedRi: number; packedRi: number; sentRi: number; deliveredRi: number };
type Shipping = {
  bags: number; lines: ShipLine[]; extra: string[];
  list: { code: string; seq: number; ri: Record<string, number>; pairs: number; extraNote: string; status: string; tripCode: string | null; updatedAt: string }[];
};
const BAG_STATUS: Record<string, string> = {
  da_dong: 'Ở xưởng', tren_xe: 'Trên xe', da_toi: 'Đã tới Cam', thieu: 'Thiếu khi tới', trong_kho: 'Trong kho Cam', da_giao: 'Đã giao', that_lac: 'Thất lạc', hu_hong: 'Hư hỏng',
};
const r1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Bags of the order: ri per size line from ordered to delivered, then each bag with where it is. */
function ShippingSection({ s }: { s: Shipping }) {
  return (
    <section className="card stack" style={{ marginTop: 16 }} aria-label="Vận chuyển">
      <div className="row"><h2 className="grow" style={{ margin: 0 }}>Vận chuyển</h2><a className="btn-sm" href="/kho">Mở Kho</a></div>
      <div className="tbl-wrap"><table className="ship-table">
        <thead><tr><th scope="col">Dòng</th><th scope="col">Đặt</th><th scope="col">Đã đóng</th><th scope="col">Đã gửi</th><th scope="col">Đã giao</th><th scope="col">Còn thiếu</th></tr></thead>
        <tbody>{s.lines.map((l) => (
          <tr key={l.key}><th scope="row">{l.label.vi} <span className="small muted">(ri {l.perRi} đôi)</span></th>
            <td className="num">{r1(l.orderedRi)}</td><td className="num">{r1(l.packedRi)}</td><td className="num">{r1(l.sentRi)}</td><td className="num">{r1(l.deliveredRi)}</td>
            <td className="num"><strong>{r1(Math.max(0, l.orderedRi - l.deliveredRi))}</strong></td></tr>
        ))}</tbody>
      </table></div>
      {s.bags === 0 ? <p className="small muted" style={{ margin: 0 }}>Chưa có bao nào. Xưởng đóng bao trong khu Kho.</p> : (
        <ul className="list">
          {s.list.map((b) => (
            <li key={b.code} className="bag-row card">
              <a href={`/kho#/bao/${b.code}`}><code>{b.code}</code> <span className="small muted">Bao {b.seq} · {b.pairs} đôi{b.extraNote ? ` · + ${b.extraNote}` : ''}</span></a>
              <span className={`badge ${b.status === 'thieu' || b.status === 'that_lac' || b.status === 'hu_hong' ? 's-da_huy' : ''}`}>{BAG_STATUS[b.status] ?? b.status}</span>
              {b.tripCode && <span className="small muted">{b.tripCode}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type SendResult = { url: string; message: string; zaloUrl: string | null; messengerUrl: string | null; version: number };

export function describeLine(l: Line, label: string): string {
  if (l.mode === 'total') return `${label} ${l.sizeFrom}–${l.sizeTo}: ${formatQty(lineQty(l))} đôi (chia size theo chuẩn xưởng)`;
  if (l.mode === 'even') return `${label} ${l.sizeFrom}–${l.sizeTo}: ${l.qtyEach}/size × ${l.sizeTo - l.sizeFrom + 1} = ${formatQty(lineQty(l))} đôi`;
  const sizes = Object.entries(lineSizes(l)).map(([s, n]) => `${s}:${n}`).join(' ');
  return `${label} ${sizes} = ${formatQty(lineQty(l))} đôi`;
}

const fmt = (v: number | null, c: Currency) => (v == null ? '' : formatMoney(v, c, 'vi'));

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok;
}

export function OrderDetail({ id }: { id: string }) {
  const settings = useSettings();
  const [o, setO] = useState<OrderView | null>(null);
  const [mats, setMats] = useState<Map<string, Material>>(new Map());
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [allPrice, setAllPrice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<SendResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pay, setPay] = useState({ amount: '', paidOn: localDate(new Date()), note: '' });

  const take = (v: OrderView) => {
    setO(v);
    setPrices(Object.fromEntries(v.items.flatMap((i) => i.lines.map((l) => [l.id, fmt(l.unitPrice, v.currency)]))));
  };
  const load = () => api<OrderView>('GET', `/api/orders/${id}`).then(take).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api<Material[]>('GET', '/api/materials?all=1').then((ms) => setMats(new Map(ms.map((m) => [m.id, m])))).catch(() => {});
  }, [id]);

  const parsed = useMemo(() => {
    const out: Record<string, number | null | undefined> = {}; // undefined = unreadable
    if (!o) return out;
    for (const [k, t] of Object.entries(prices)) out[k] = t.trim() === '' ? null : parseMoney(t, o.currency) ?? undefined;
    return out;
  }, [prices, o]);

  if (!o) return <main className="page">{error ? <p className="error">{error}</p> : <p className="muted">Đang tải…</p>}</main>;

  const locked = qtyPriceLocked(o.status);
  const allLines = o.items.flatMap((i) => i.lines);
  const dirty = allLines.filter((l) => parsed[l.id] !== l.unitPrice);
  const previewAmount = allLines.reduce((s, l) => s + (parsed[l.id] ?? 0) * lineQty(l), 0);
  const missing = allLines.filter((l) => parsed[l.id] == null).length;
  const nextStatuses = STATUSES.filter((s) => s !== 'da_bao_gia' && s !== 'da_huy' && canTransition(o.status, s)
    && (rank(s) < rank('khach_dong_y') || o.quoteVersion > 0));

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true); setError('');
    try { return await fn(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Có lỗi, vui lòng thử lại'); } finally { setBusy(false); }
  }

  const savePrices = () => run(async () => {
    const bad = allLines.find((l) => parsed[l.id] === undefined);
    if (bad) throw new ApiError(400, `Giá không đọc được: "${prices[bad.id]}"`);
    take(await api<OrderView>('PUT', `/api/orders/${id}/prices`, { prices: dirty.map((l) => ({ lineId: l.id, unitPrice: parsed[l.id] })) }));
    clearPriceHistoryCache();
  });
  const sendQuote = () => run(async () => {
    setCopied(false);
    setSent(await api<SendResult>('POST', `/api/orders/${id}/send-quote`, {}));
  });
  const move = (to: OrderStatus) => run(async () => take(await api<OrderView>('POST', `/api/orders/${id}/status`, { to })));
  const addPayment = () => run(async () => {
    const amount = parseMoney(pay.amount, o.currency);
    if (!amount) throw new ApiError(400, 'Số tiền không hợp lệ');
    take(await api<OrderView>('POST', `/api/orders/${id}/payments`, { amount, paidOn: pay.paidOn, note: pay.note }));
    setPay({ amount: '', paidOn: localDate(new Date()), note: '' });
  });
  const delPayment = (pid: string) => run(async () => {
    if (!window.confirm('Xóa khoản nhận này?')) return;
    take(await api<OrderView>('DELETE', `/api/orders/${id}/payments/${pid}`));
  });

  const matName = (mid: string | null) => (mid ? mats.get(mid)?.nameVi ?? '' : '');
  const materialsText = (i: Item) => [['Đế', i.soleId], ['Quai', i.strapId], ['Kiểu', i.styleId]]
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${matName(v)}`).join(' · ');
  const imageOf = (imgId: string | null) => {
    const im = o.images.find((x) => x.id === imgId);
    return im ? { url: '/' + im.key, width: im.width, height: im.height } : null;
  };

  return (
    <main className="page order-detail">
      <div className="topbar">
        <h1 className="code-title">{o.code}</h1>
        {o.source === 'customer' && <span className="badge src-customer">Khách tự đặt</span>}
        <StatusBadge s={o.status} />
      </div>
      <p><a href={`#/customers/${o.customer.id}`}>{o.customer.name}</a>
        {o.neededBy && <> · Cần hàng: <strong>{viDate(o.neededBy)}</strong></>}</p>
      {o.deliverNote && <p>Nơi nhận hàng: <strong>{o.deliverNote}</strong></p>}
      {o.note && <p className="muted">{o.note}</p>}
      {o.status === 'da_huy' && o.cancelledBy === 'customer' && (
        <p className="notice">Khách đã hủy đơn{o.cancelReason ? <>. Lý do: <strong>{o.cancelReason}</strong></> : ' (không ghi lý do)'}.</p>
      )}

      <div className="row wrap" style={{ margin: '12px 0' }}>
        <a className="btn btn-sm" href={`#/orders/${id}/edit`}>Sửa đơn</a>
        {printable(o.status)
          ? <a className="btn btn-sm" href={`#/orders/${id}/sheet`}>Phiếu làm hàng</a>
          : <span className="small muted">Phiếu làm hàng có khi khách đã đồng ý</span>}
      </div>

      {locked && <p className="notice">{o.status === 'da_huy' ? 'Đơn đã hủy' : 'Đơn đang sản xuất'}: không sửa số lượng/giá được.</p>}

      {o.items.map((it) => (
        <section key={it.id} aria-label={`Mẫu ${it.tagNo}`} className="card" style={{ marginTop: 10 }}>
          <div className="row">
            <CropThumb image={imageOf(it.imageId)} crop={it.crop} cropKey={it.cropKey} size={72} />
            <div className="grow">
              <h3 style={{ margin: 0 }}>Mẫu {it.tagNo}</h3>
              {o.productTitles?.[it.id] && <div className="small"><strong>{o.productTitles[it.id].product.vi} · {o.productTitles[it.id].color.vi}</strong></div>}
              <div className="small">{materialsText(it) || (!o.productTitles?.[it.id] && <span className="muted">Chưa chọn vật liệu</span>)}</div>
              {it.colorNote && <div className="small muted">{it.colorNote}</div>}
            </div>
            <strong className="num small">{formatQty(itemQty(it))} đôi</strong>
          </div>
          {it.lines.map((l) => {
            const label = lineLabel(settings, l.lineKey);
            const p = parsed[l.id];
            return (
              <div key={l.id} style={{ marginTop: 10 }}>
                <div className="small">{describeLine(l, label)}</div>
                <div className="row" style={{ marginTop: 4 }}>
                  <input aria-label={`Đơn giá – Mẫu ${it.tagNo} ${label}`} className="grow num" inputMode="decimal" disabled={locked}
                    placeholder={o.currency === 'VND' ? 'Đơn giá, ví dụ 47k' : 'Unit price, e.g. 18.9'} value={prices[l.id] ?? ''}
                    onChange={(e) => setPrices((x) => ({ ...x, [l.id]: e.target.value }))}
                    onBlur={() => { if (p != null) setPrices((x) => ({ ...x, [l.id]: fmt(p, o.currency) })); }} />
                  <span className="num small right" style={{ minWidth: 110 }}>
                    {p === undefined ? <span className="error">Giá sai</span> : p == null ? '—' : fmt(p * lineQty(l), o.currency)}
                  </span>
                </div>
                {!locked && <PriceHistory soleId={it.soleId} strapId={it.strapId} styleId={it.styleId} excludeOrderId={o.id}
                  currency={o.currency} onPick={(v) => setPrices((x) => ({ ...x, [l.id]: fmt(v, o.currency) }))} />}
              </div>
            );
          })}
        </section>
      ))}

      <section className="card stack" style={{ marginTop: 16 }} aria-label="Báo giá">
        {!locked && (
          <div className="row">
            <input aria-label="Giá cho mọi dòng" className="grow" inputMode="decimal" placeholder="Giá chung" value={allPrice} onChange={(e) => setAllPrice(e.target.value)} />
            <button type="button" className="btn-sm" onClick={() => {
              const v = parseMoney(allPrice, o.currency);
              if (v == null) return setError('Giá không đọc được');
              setPrices(Object.fromEntries(allLines.map((l) => [l.id, fmt(v, o.currency)])));
            }}>Áp dụng cho mọi dòng</button>
          </div>
        )}
        <div>
          <div>Tổng số đôi: <strong className="num">{formatQty(o.totals.qty)}</strong></div>
          <div style={{ fontSize: '1.15rem' }}><strong className="num">Tổng tiền: {fmt(previewAmount, o.currency)}</strong></div>
          {missing > 0 && <div className="small muted">Còn {missing} dòng chưa có giá</div>}
        </div>
        {!locked && (
          <div className="row wrap">
            <button type="button" className="btn-primary grow" disabled={busy || dirty.length === 0} onClick={savePrices}>Lưu giá</button>
            <button type="button" className="grow" disabled={busy || dirty.length > 0 || missing > 0 || o.status === 'da_huy'} onClick={sendQuote}>Gửi báo giá</button>
          </div>
        )}
        {o.quoteToken && (
          <p className="small muted">
            Báo giá phiên bản {o.quoteVersion}{o.quotedAt && ` · gửi ${viDate(o.quotedAt)}`}{o.acceptedAt && ` · khách đồng ý ${viDate(o.acceptedAt)}`} ·{' '}
            <a href={`/q/${o.quoteToken}`} target="_blank" rel="noreferrer">Mở trang báo giá</a>
          </p>
        )}
      </section>

      {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}

      <section className="card stack" style={{ marginTop: 16 }} aria-label="Trạng thái">
        <h2 style={{ margin: 0 }}>Trạng thái</h2>
        <div className="row wrap">
          {nextStatuses.map((s) => <button key={s} type="button" className="btn-sm" disabled={busy} onClick={() => move(s)}>→ {STATUS_LABEL_VI[s]}</button>)}
          {canTransition(o.status, 'da_huy') && (
            <button type="button" className="btn-sm btn-danger" disabled={busy}
              onClick={() => { if (window.confirm(`Hủy đơn ${o.code}?`)) move('da_huy'); }}>Hủy đơn</button>
          )}
        </div>
      </section>

      {o.shipping && o.status !== 'cho_bao_gia' && o.status !== 'da_bao_gia' && <ShippingSection s={o.shipping} />}

      <section className="card stack" style={{ marginTop: 16 }} aria-label="Tiền nhận">
        <h2 style={{ margin: 0 }}>Tiền nhận</h2>
        {o.payments.length > 0 && (
          <table>
            <tbody>
              {o.payments.map((p) => (
                <tr key={p.id}>
                  <td className="small">{viDate(p.paidOn)}</td>
                  <td className="num">{fmt(p.amount, o.currency)}</td>
                  <td className="small">{p.note}</td>
                  <td className="right"><button type="button" className="btn-sm btn-ghost" aria-label="Xóa khoản nhận" onClick={() => delPayment(p.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="small">Đã nhận: <span className="num">{fmt(o.paid, o.currency)}</span> · <strong><span className="num">Còn lại: {fmt(o.due, o.currency)}</span></strong></div>
        <div className="row wrap">
          <input aria-label="Số tiền nhận" className="grow" inputMode="decimal" placeholder={o.currency === 'VND' ? 'Số tiền, ví dụ 20tr' : 'Amount'} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          <input aria-label="Ngày nhận" type="date" style={{ width: 160 }} value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} />
        </div>
        <input aria-label="Ghi chú khoản nhận" placeholder="Ghi chú: cọc, thanh toán đủ…" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
        <button type="button" disabled={busy || !pay.amount} onClick={addPayment}>Thêm khoản nhận</button>
      </section>

      {sent && (
        <div className="sheet-backdrop">
          <div className="sheet stack" role="dialog" aria-label="Gửi báo giá">
            <h2 style={{ margin: 0 }}>Gửi báo giá cho {o.customer.name}</h2>
            <label htmlFor="quote-msg">Tin nhắn gửi khách</label>
            <textarea id="quote-msg" readOnly value={sent.message} rows={5} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn-primary" onClick={async () => setCopied(await copy(sent.message))}>
              {copied ? 'Đã chép ✓' : 'Sao chép tin nhắn'}
            </button>
            <div className="row">
              {sent.zaloUrl ? <a className="btn grow" href={sent.zaloUrl} target="_blank" rel="noreferrer">Mở Zalo</a>
                : <span className="small muted grow">Khách chưa có số Zalo</span>}
              {sent.messengerUrl && <a className="btn grow" href={sent.messengerUrl} target="_blank" rel="noreferrer">Mở Messenger</a>}
            </div>
            <p className="small muted">Dán tin nhắn vào khung chat rồi gửi. Báo giá phiên bản {sent.version}.</p>
            <button type="button" onClick={() => { setSent(null); load(); }}>Xong</button>
          </div>
        </div>
      )}
    </main>
  );
}
