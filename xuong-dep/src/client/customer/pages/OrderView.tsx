import { ArrowLeft, Check, Pencil, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t as qt } from '../../../shared/i18n';
import { formatMoney, formatQty } from '../../../shared/money';
import type { QuoteSnapshot } from '../../../shared/snapshot';
import { lineQty, sizesOf } from '../../../shared/totals';
import type { Currency, Item, Lang, OrderStatus } from '../../../shared/types';
import type { T } from '../../ui/lang';
import { api, ApiError } from '../api';
import { dmy, media, nameIn, statusText, useCatalog, useFlash } from '../common';
import { errorText } from './Auth';
import { FLASH_SENT } from './NewOrder';

type COrder = {
  id: string; code: string; status: OrderStatus; createdAt: string; neededBy: string | null; note: string; deliverNote: string;
  currency: Currency; cancelReason: string | null; items: Item[]; totals: { qty: number }; quote: QuoteSnapshot | null;
  acceptedVersion: number | null; paid: number; due: number; canEdit: boolean; canCancel: boolean; cancelledBy?: string | null;
  productTitles?: Record<string, { product: Record<Lang, string>; color: Record<Lang, string> }>;
};

const FLOW: OrderStatus[] = ['cho_bao_gia', 'da_bao_gia', 'khach_dong_y', 'dang_san_xuat', 'da_giao', 'hoan_tat'];

function Timeline({ status, t }: { status: OrderStatus; t: T }) {
  const at = FLOW.indexOf(status);
  return (
    <ol className="timeline" aria-label={t('c.timeline')}>
      {FLOW.map((s, i) => (
        <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="dot" aria-hidden="true">{i < at ? <Check size={12} /> : null}</span>
          <span>{statusText(t, s)}</span>
        </li>
      ))}
    </ol>
  );
}

function CancelDialog({ t, onConfirm, onClose, busy }: { t: T; onConfirm: (reason: string) => void; onClose: () => void; busy: boolean }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
        <button type="button" className="icon-btn modal-close" aria-label={t('c.close')} onClick={onClose}><X size={20} aria-hidden="true" /></button>
        <h2 id="cancel-title">{t('c.cancel_title')}</h2>
        <label htmlFor="cancel-reason">{t('c.cancel_reason')}</label>
        <textarea id="cancel-reason" value={reason} maxLength={500} autoFocus onChange={(e) => setReason(e.target.value)} />
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn grow" onClick={onClose}>{t('c.keep')}</button>
          <button type="button" className="btn btn-danger grow" disabled={busy} onClick={() => onConfirm(reason.trim())}>{t('c.cancel_confirm')}</button>
        </div>
      </div>
    </div>
  );
}

/** One design: picture, size lines with counts; with a quote, the price lines from the quote the workshop sent. */
function Design({ item, quoted, currency, lang, t, labelOf, title }: {
  item: Item; quoted: QuoteSnapshot['items'][number] | null; currency: Currency; lang: Lang; t: T; labelOf: (k: string) => string; title?: string;
}) {
  return (
    <article className="card citem-view">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {item.cropKey ? <img className="thumb" src={media(item.cropKey)} alt="" loading="lazy" style={{ width: 84, height: 84 }} /> : <div className="thumb" style={{ width: 84, height: 84 }} />}
        <div className="grow">
          <h3 style={{ margin: 0 }}>{t('c.design_n', { n: item.tagNo })}</h3>
          {title && <p className="small" style={{ margin: 0 }}><strong>{title}</strong></p>}
          {item.colorNote && <p className="small" style={{ margin: 0 }}>{item.colorNote}</p>}
          {item.isPrivate && <span className="badge">{t('c.private')}</span>}
        </div>
      </div>
      {(quoted ? quoted.lines : item.lines).map((l: any, i: number) => {
        const label = quoted ? nameIn(l.label, lang) : labelOf(l.lineKey);
        const qty = quoted ? l.qty : lineQty(l);
        const sizes: [string, number][] = quoted ? Object.entries(l.sizes as Record<string, number>)
          : l.mode === 'total' ? [] : sizesOf(l).map((s) => [String(s), l.mode === 'even' ? l.qtyEach : l.perSize[String(s)] ?? 0]);
        return (
          <div key={i} className="vline">
            <div className="row"><strong className="grow">{label} · {t('le.size')} {l.sizeFrom}–{l.sizeTo}</strong><span className="num">{t('c.pairs', { n: formatQty(qty) })}</span></div>
            {sizes.length > 0 && (
              <div className="sizes num" aria-label={t('le.size')}>
                {sizes.map(([s, n]) => <span key={s}><small>{s}</small>{n}</span>)}
              </div>
            )}
            {quoted && (
              <div className="row small num"><span className="grow">{formatQty(l.qty)} × {formatMoney(l.unitPrice, currency, lang)}</span><strong>{formatMoney(l.amount, currency, lang)}</strong></div>
            )}
          </div>
        );
      })}
    </article>
  );
}

export function OrderView({ id, t, lang }: { id: string; t: T; lang: Lang }) {
  const catalog = useCatalog();
  const [o, setO] = useState<COrder | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [flash, setFlash] = useFlash();

  async function load() {
    try {
      setO(await api<COrder>('GET', `/api/c/orders/${id}`));
      setState('ready');
    } catch (e) {
      setState(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error');
    }
  }
  useEffect(() => {
    load();
    try {
      if (sessionStorage.getItem(FLASH_SENT) === id) { setFlash(t('c.sent_ok')); sessionStorage.removeItem(FLASH_SENT); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state === 'loading') return <main className="page"><div className="skeleton" style={{ height: 260 }} /></main>;
  if (state !== 'ready' || !o) {
    return (
      <main className="page">
        <a className="back" href="#/"><ArrowLeft size={18} aria-hidden="true" /> {t('c.back')}</a>
        <p className={state === 'notfound' ? 'empty-note' : 'error'}>{state === 'notfound' ? t('c.not_found') : t('err.generic')}</p>
      </main>
    );
  }

  const labelOf = (key: string) => nameIn(catalog?.lines.find((l) => l.key === key)?.label, lang) || key;
  const q = o.quote;
  const accepted = !!q && o.acceptedVersion === q.version && o.status !== 'da_bao_gia' && o.status !== 'da_huy';
  const quotedItem = (it: Item) => (q ? q.items.find((x) => x.tagNo === it.tagNo) ?? null : null);

  async function accept() {
    if (!q) return;
    setBusy(true); setError('');
    try { await api('POST', `/api/c/orders/${id}/accept`, { version: q.version }); await load(); }
    catch (e) { setError(errorText(t, e)); await load(); }
    finally { setBusy(false); }
  }
  async function cancel(reason: string) {
    setBusy(true); setError('');
    try { setO(await api<COrder>('POST', `/api/c/orders/${id}/cancel`, { reason })); setCancelling(false); }
    catch (e) { setError(errorText(t, e)); setCancelling(false); await load(); }
    finally { setBusy(false); }
  }

  return (
    <main className="page">
      <a className="back" href="#/"><ArrowLeft size={18} aria-hidden="true" /> {t('c.nav_orders')}</a>
      <div className="topbar">
        <h1 className="code-title">{t('c.order_code', { code: o.code })}</h1>
        <span className={`badge s-${o.status}`}>{statusText(t, o.status)}</span>
      </div>
      <p className="small muted" style={{ marginTop: -6 }}>{t('c.created', { date: dmy(o.createdAt) })}</p>
      {flash && <div className="success" role="status">{flash}</div>}

      {o.status === 'da_huy' ? (
        <div className="notice">
          <strong>{o.cancelledBy === 'customer' ? t('c.cancelled_by_you') : t('c.cancelled')}</strong>
          {o.cancelReason && <div>{t('c.reason', { r: o.cancelReason })}</div>}
        </div>
      ) : <Timeline status={o.status} t={t} />}

      <section className="card stack info-card">
        <div className="row"><span className="grow muted">{t('c.deliver')}</span><strong>{o.deliverNote || '—'}</strong></div>
        {o.neededBy && <div className="row"><span className="grow muted">{t('c.needed_by')}</span><strong>{dmy(o.neededBy)}</strong></div>}
        {o.note && <div><span className="muted">{t('c.note')}:</span> {o.note}</div>}
      </section>

      <h2>{t('c.designs')}</h2>
      {o.items.map((it) => <Design key={it.id} item={it} quoted={quotedItem(it)} currency={o.currency} lang={lang} t={t} labelOf={labelOf}
        title={o.productTitles?.[it.id] ? `${nameIn(o.productTitles[it.id].product, lang)} · ${nameIn(o.productTitles[it.id].color, lang)}` : undefined} />)}

      <section className="card stack" style={{ marginTop: 16 }} aria-label={t('c.quote')}>
        <div className="row"><span className="grow">{qt(lang, 'total.pairs')}</span><strong className="num">{formatQty(q ? q.totalQty : o.totals.qty)}</strong></div>
        {q ? (
          <>
            <div className="row total"><span className="grow">{qt(lang, 'total.amount')}</span><strong className="num">{formatMoney(q.totalAmount, q.currency, lang)}</strong></div>
            {accepted && (
              <>
                <div className="row"><span className="grow muted">{t('c.paid')}</span><span className="num">{formatMoney(o.paid, q.currency, lang)}</span></div>
                <div className="row"><span className="grow muted">{t('c.due')}</span><strong className="num">{formatMoney(o.due, q.currency, lang)}</strong></div>
              </>
            )}
          </>
        ) : o.status !== 'da_huy' && <p className="small muted" style={{ margin: 0 }}>{t('c.waiting_quote')}</p>}
      </section>

      {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      <div className="stack" style={{ marginTop: 16 }}>
        {accepted && <div className="success"><strong>{qt(lang, 'accepted')}</strong></div>}
        {q && o.status === 'da_bao_gia' && (
          <button type="button" className="btn-primary btn-block btn-lg" disabled={busy} onClick={accept}>{busy ? qt(lang, 'accepting') : qt(lang, 'accept')}</button>
        )}
        {o.canEdit && <a className="btn btn-block" href={`#/dat-hang?don=${o.id}`}><Pencil size={16} aria-hidden="true" /> {t('c.edit')}</a>}
        {o.items.length > 0 && <a className="btn btn-block btn-reorder" href={`#/dat-hang?dat-lai=${o.id}`}><RotateCcw size={16} aria-hidden="true" /> {t('c.reorder_order')}</a>}
        {o.canCancel && <button type="button" className="btn btn-block btn-danger" onClick={() => setCancelling(true)}>{t('c.cancel')}</button>}
        {!o.canCancel && o.status !== 'da_huy' && o.status !== 'hoan_tat' && <p className="small muted">{t('c.in_production_note')}</p>}
      </div>
      {cancelling && <CancelDialog t={t} busy={busy} onClose={() => setCancelling(false)} onConfirm={cancel} />}
    </main>
  );
}
