import { useEffect, useState } from 'react';
import { kapi } from '../api';
import { B, K } from '../i18n';
import { ScanBox } from '../scan';

type CamBag = { code: string; seq: number; pairs: number; status: 'da_toi' | 'trong_kho'; extraNote: string };
type CamOrder = { orderId: string; orderCode: string; customerName: string; bags: CamBag[] };

/** Bags waiting in Cambodia, by order: put arrived ones into the warehouse, open delivery for an order. */
export function Cam() {
  const [list, setList] = useState<CamOrder[] | null>(null);
  const [error, setError] = useState('');
  const load = () => kapi<CamOrder[]>('GET', '/api/kho/cam').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const stock = async (code: string) => { setError(''); await kapi('POST', `/api/kho/bags/${code}/stock`, {}); await load(); };
  return (
    <main className="page kho-page">
      <h1><B k="cam" /></h1>
      <p className="small muted"><B k="stock" />: </p>
      <ScanBox onCode={stock} />
      {error && <p className="error" role="alert">{error}</p>}
      {!list && <div className="skeleton" style={{ height: 120 }} />}
      {list && !list.length && <p className="muted"><B k="empty" /></p>}
      {list?.map((o) => (
        <section key={o.orderId} className="card stack cam-order">
          <div className="row wrap">
            <strong className="grow">{o.orderCode} · {o.customerName}</strong>
            <a className="btn-primary btn-sm" href={`#/giao/${o.orderId}`}><B k="give" /></a>
          </div>
          <ul className="list">
            {o.bags.map((b) => (
              <li key={b.code} className="bag-row">
                <a href={`#/bao/${b.code}`} className="grow"><code>{b.code}</code> <span className="small muted">{K.bagNo[0]} {b.seq} · {b.pairs} {K.pairs[0]}{b.extraNote ? ` · + ${b.extraNote}` : ''}</span></a>
                {b.status === 'da_toi'
                  ? <button type="button" className="btn-sm" onClick={() => stock(b.code).catch((e) => setError(e.message))}><B k="stock" /></button>
                  : <span className="badge"><B k="inStock" /></span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

/** Delivery: the order's bags in Cambodia are ticked; scanning adds more; one confirmation delivers them all. */
export function Deliver({ orderId }: { orderId?: string }) {
  const [codes, setCodes] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!orderId) return;
    kapi<CamOrder[]>('GET', '/api/kho/cam').then((l) => setCodes(l.find((o) => o.orderId === orderId)?.bags.map((b) => b.code) ?? [])).catch((e) => setError(e.message));
  }, [orderId]);
  async function confirm() {
    setBusy(true); setError('');
    try { setDone((await kapi<{ delivered: number }>('POST', '/api/kho/deliver', { codes, note })).delivered); setCodes([]); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <main className="page kho-page">
      <h1><B k="deliver" /></h1>
      {done !== null && <p className="success" role="status">{K.delivered[0]} {done} {K.bags[0]} · {K.delivered[1]} {done} {K.bags[1]}</p>}
      <ScanBox onCode={(c) => setCodes((xs) => (xs.includes(c) ? xs : [...xs, c]))} />
      <ul className="code-list">
        {codes.map((c) => <li key={c}><code>{c}</code> <button type="button" className="btn-sm btn-ghost" aria-label={`− ${c}`} onClick={() => setCodes((xs) => xs.filter((x) => x !== c))}>✕</button></li>)}
      </ul>
      <div><label htmlFor="deliver-note"><B k="deliverNote" /></label>
        <input id="deliver-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn-primary btn-block btn-lg kho-main" disabled={busy || !codes.length} onClick={confirm}>
        <B k="confirmDeliver" /> ({codes.length})
      </button>
    </main>
  );
}
