import { useEffect, useState } from 'react';
import { go } from '../../admin/router';
import { kapi } from '../api';
import { B, K, STATUS_K, t2, type KKey } from '../i18n';
import { ScanBox } from '../scan';

type TripBag = { code: string; seq: number; orderCode: string; pairs: number; status: string; extraNote: string };
export type Trip = {
  id: string; code: string; status: 'dang_xep' | 'dang_chay' | 'da_toi'; createdAt: string; departedAt: string | null; closedAt: string | null;
  bags: TripBag[]; counts: { total: number; received: number; missing: number; orders: number };
};
const TRIP_K: Record<Trip['status'], KKey> = { dang_xep: 'loading', dang_chay: 'running', da_toi: 'arrived' };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export function TripList() {
  const [list, setList] = useState<Trip[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { kapi<Trip[]>('GET', '/api/kho/trips').then(setList).catch((e) => setError(e.message)); }, []);
  async function open() {
    try { go(`/chuyen/${(await kapi<Trip>('POST', '/api/kho/trips', {})).id}`); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  return (
    <main className="page kho-page">
      <h1><B k="trips" /></h1>
      <button type="button" className="btn-primary btn-block btn-lg kho-main" onClick={open}><B k="newTrip" /></button>
      {error && <p className="error" role="alert">{error}</p>}
      {!list && <div className="skeleton" style={{ height: 120 }} />}
      <ul className="list">
        {list?.map((t) => (
          <li key={t.id}>
            <a className="list-item trip-item" href={`#/chuyen/${t.id}`}>
              <strong className="grow">{t.code}</strong>
              <span className="small">{t.counts.total} {K.bags[0]} · {t.counts.orders} {K.orders[0]}</span>
              <span className={`badge trip-${t.status}`}>{K[TRIP_K[t.status]][0]}{t.counts.missing ? ` · ${K.missing[0]} ${t.counts.missing}` : ''}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** One trip: loading at the workshop (scan in, remove, depart) or receiving in Cambodia (scan, close the receipt). */
export function TripPage({ id, role }: { id: string; role: string }) {
  const [t, setT] = useState<Trip | null>(null);
  const [ask, setAsk] = useState<'depart' | 'close' | null>(null);
  const [error, setError] = useState('');
  const load = () => kapi<Trip>('GET', `/api/kho/trips/${id}`).then(setT).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);
  const manager = role === 'admin' || role === 'staff';
  const act = async (path: string, body: unknown = {}) => { setError(''); setT(await kapi<Trip>('POST', `/api/kho/trips/${id}/${path}`, body)); };
  if (!t) return <main className="page kho-page">{error ? <p className="error">{error}</p> : <div className="skeleton" style={{ height: 160 }} />}</main>;
  const loadingNow = t.status === 'dang_xep';
  const receiving = !loadingNow && manager;
  const waiting = t.bags.filter((b) => b.status === 'tren_xe' || b.status === 'thieu');
  return (
    <main className="page kho-page">
      <a className="btn-sm btn-ghost" href="#/chuyen">‹ <B k="trips" /></a>
      <h1>{K.trip[0]} {t.code}</h1>
      <p><span className={`badge trip-${t.status}`}><B k={TRIP_K[t.status]} /></span> <span className="small muted">{day(t.departedAt ?? t.createdAt)}</span></p>

      {loadingNow && (
        <>
          <div className="big-count" aria-live="polite">{t.counts.total} {K.bags[0]} · {t.counts.orders} {K.orders[0]}</div>
          <ScanBox onCode={(code) => act('load', { code })} />
          {ask === 'depart' ? (
            <div className="kho-warn" role="alert">
              <p>{K.depart[0]}: {t.counts.total} {K.bags[0]}?</p>
              <div className="row">
                <button type="button" className="btn" onClick={() => setAsk(null)}><B k="cancel" /></button>
                <button type="button" className="btn-primary" onClick={async () => { setAsk(null); try { await act('depart'); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}><B k="departSure" /></button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-primary btn-block btn-lg kho-main" disabled={!t.counts.total} onClick={() => setAsk('depart')}><B k="depart" /></button>
          )}
        </>
      )}

      {receiving && (
        <>
          <div className="big-count" aria-live="polite">{K.received[0]} {t.counts.received} / {t.counts.total}</div>
          <ScanBox onCode={(code) => act('receive', { code })} />
          {waiting.length > 0 && (
            <section className="stack">
              <h2 className="h-small"><B k={t.status === 'da_toi' ? 'missing' : 'notYet'} /> ({waiting.length})</h2>
              <ul className="code-list">{waiting.map((b) => <li key={b.code}><code>{b.code}</code> <span className="small muted">{b.orderCode} · {K.bagNo[0]} {b.seq}</span></li>)}</ul>
            </section>
          )}
          {t.status === 'dang_chay' && (ask === 'close' ? (
            <div className="kho-warn" role="alert">
              <p><B k="closeWarn" /> ({waiting.length})</p>
              <div className="row">
                <button type="button" className="btn" onClick={() => setAsk(null)}><B k="cancel" /></button>
                <button type="button" className="btn-primary" onClick={async () => { setAsk(null); try { await act('close'); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}><B k="closeSure" /></button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-primary btn-block btn-lg kho-main" onClick={() => setAsk('close')}><B k="close" /></button>
          ))}
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <section className="stack">
        <h2 className="h-small"><B k="bags" /> ({t.bags.length})</h2>
        <ul className="list">
          {t.bags.map((b) => (
            <li key={b.code} className="card bag-row">
              <a href={`#/bao/${b.code}`} className="grow"><code>{b.code}</code> <span className="small muted">{b.orderCode} · {K.bagNo[0]} {b.seq} · {b.pairs} {K.pairs[0]}</span></a>
              <span className="badge">{K[STATUS_K[b.status] ?? 'status'][0]}</span>
              {loadingNow && <button type="button" className="btn-sm" aria-label={`${t2('remove')} ${b.code}`} onClick={() => act('unload', { code: b.code }).catch((e) => setError(e.message))}><B k="remove" /></button>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
