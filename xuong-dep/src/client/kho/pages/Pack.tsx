import { useEffect, useState } from 'react';
import { go } from '../../admin/router';
import { kapi, KhoError } from '../api';
import { B, K, t2 } from '../i18n';

type Line = { key: string; label: { vi: string; km: string }; perRi: number; orderedRi: number; orderedPairs: number; packedRi: number; sentRi: number };
type Toa = { id: string; code: string; status: string; thumbs: string[]; lines: Line[]; bags: number };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Progress({ lines }: { lines: Line[] }) {
  return (
    <ul className="toa-lines">
      {lines.map((l) => (
        <li key={l.key}>
          <strong>{l.label.vi}</strong>{' '}
          <span>{K.ordered[0]} {fmt(l.orderedRi)} · {K.packed[0]} {fmt(l.packedRi)} · {K.left[0]} {fmt(Math.max(0, l.orderedRi - l.packedRi))} {K.ri[0]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Pick an order (by code and design photos only), count ri per size line, make the bag and print its label. */
export function Pack({ orderId }: { orderId?: string }) {
  const [list, setList] = useState<Toa[] | null>(null);
  const [ri, setRi] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState('');
  const [extraPairs, setExtraPairs] = useState('');
  const [over, setOver] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { kapi<Toa[]>('GET', '/api/kho/toa').then(setList).catch((e) => setError(e.message)); }, [orderId]);
  const toa = list?.find((x) => x.id === orderId);

  async function make(confirmOver = false) {
    if (!toa) return;
    setBusy(true); setError('');
    try {
      const body = {
        orderId: toa.id, confirmOver, extraNote: extra.trim(), extraPairs: parseInt(extraPairs, 10) || 0,
        ri: Object.fromEntries(toa.lines.map((l) => [l.key, parseInt(ri[l.key] ?? '', 10) || 0])),
      };
      const bag = await kapi<{ code: string }>('POST', '/api/kho/bags', body);
      go(`/in?codes=${bag.code}&toa=${toa.id}`);
    } catch (e) {
      if (e instanceof KhoError && e.body?.code === 'over') setOver(e.body.overRi);
      else setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (!orderId) {
    return (
      <main className="page kho-page">
        <h1><B k="pickToa" /></h1>
        {error && <p className="error" role="alert">{error}</p>}
        {!list && <div className="skeleton" style={{ height: 160 }} />}
        {list && !list.length && <p className="muted"><B k="noToa" /></p>}
        <div className="toa-list">
          {list?.map((x) => (
            <button key={x.id} type="button" className="toa-card" onClick={() => go(`/dong-bao/${x.id}`)}>
              <span className="toa-code">{x.code}</span>
              <span className="toa-thumbs">{x.thumbs.map((k) => <img key={k} src={'/media/' + k} alt="" loading="lazy" />)}</span>
              <Progress lines={x.lines} />
              <span className="small muted">{x.bags} {K.bags[0]}</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="page kho-page">
      <a className="btn-sm btn-ghost" href="#/dong-bao">‹ <B k="pickToa" /></a>
      {!toa && !error && <div className="skeleton" style={{ height: 160 }} />}
      {error && !toa && <p className="error" role="alert">{error}</p>}
      {toa && (
        <>
          <h1><B k="pack" /> · {toa.code}</h1>
          <div className="toa-thumbs big">{toa.thumbs.map((k) => <img key={k} src={'/media/' + k} alt="" />)}</div>
          <Progress lines={toa.lines} />
          <div className="card stack">
            {toa.lines.map((l) => (
              <div key={l.key} className="ri-row">
                <label htmlFor={`ri-${l.key}`}>{K.riOf[0]} {l.label.vi} <span className="km" lang="km">· {K.riOf[1]} {l.label.km || l.label.vi}</span><span className="small muted"> (1 {K.ri[0]} = {l.perRi} {K.pairs[0]})</span></label>
                <div className="stepper">
                  <button type="button" aria-label={`− ${l.label.vi}`} onClick={() => setRi((r) => ({ ...r, [l.key]: String(Math.max(0, (parseInt(r[l.key] ?? '', 10) || 0) - 1)) }))}>−</button>
                  <input id={`ri-${l.key}`} inputMode="numeric" className="num" value={ri[l.key] ?? ''} placeholder="0"
                    onChange={(e) => { setOver(null); setRi((r) => ({ ...r, [l.key]: e.target.value.replace(/\D/g, '') })); }} />
                  <button type="button" aria-label={`+ ${l.label.vi}`} onClick={() => setRi((r) => ({ ...r, [l.key]: String((parseInt(r[l.key] ?? '', 10) || 0) + 1) }))}>+</button>
                </div>
              </div>
            ))}
            <div><label htmlFor="extra"><B k="extra" /></label>
              <input id="extra" maxLength={200} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="2 đôi mẫu quai mới" /></div>
            <div><label htmlFor="extra-pairs"><B k="extraPairs" /></label>
              <input id="extra-pairs" inputMode="numeric" className="num" style={{ maxWidth: 120 }} value={extraPairs} onChange={(e) => setExtraPairs(e.target.value.replace(/\D/g, ''))} /></div>
          </div>
          {over && (
            <div className="kho-warn" role="alert">
              <p><B k="over" />: {Object.entries(over).map(([k, n]) => `${toa.lines.find((l) => l.key === k)?.label.vi ?? k} +${fmt(n)} ${K.ri[0]}`).join(', ')}</p>
              <div className="row">
                <button type="button" className="btn" onClick={() => setOver(null)}><B k="cancel" /></button>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => make(true)}><B k="overOk" /></button>
              </div>
            </div>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button type="button" className="btn-primary btn-block btn-lg kho-main" disabled={busy || !!over} onClick={() => make(false)} aria-label={t2('makeBag')}><B k="makeBag" /></button>
        </>
      )}
    </main>
  );
}
