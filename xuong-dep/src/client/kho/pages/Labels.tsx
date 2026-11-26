import { useEffect, useState } from 'react';
import { kapi } from '../api';
import { B, K } from '../i18n';
import { labelSvg } from '../label';

type Bag = { code: string; seq: number; ri: Record<string, number>; lineLabels: Record<string, string>; extraNote: string };

/** Labels for an A4 sheet of 3 × 7 stickers (70 × 42.3 mm). Never the customer, the order code, the address or a price. */
export function Labels({ codes, toa }: { codes: string[]; toa: string | null }) {
  const [bags, setBags] = useState<Bag[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all(codes.map((c) => kapi<Bag>('GET', `/api/kho/bags/${encodeURIComponent(c)}`))).then(setBags).catch((e) => setError(e.message));
  }, [codes.join(',')]);
  useEffect(() => {
    // print straight away on a real device; automated browsers skip the dialog
    if (bags?.length && !navigator.webdriver) setTimeout(() => window.print(), 400);
  }, [bags]);
  return (
    <main className="page kho-page">
      <div className="no-print stack">
        <h1><B k="labels" /></h1>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row wrap">
          <button type="button" className="btn-primary" onClick={() => window.print()}><B k="print" /></button>
          {toa && <a className="btn" href={`#/dong-bao/${toa}`}><B k="packMore" /></a>}
          <a className="btn" href="#/"><B k="home" /></a>
        </div>
      </div>
      <div className="label-sheet">
        {bags?.map((b) => (
          <div key={b.code} className="kho-label">
            <div className="kho-label-qr" dangerouslySetInnerHTML={{ __html: labelSvg(b.code) }} />
            <div className="kho-label-text">
              <strong className="kho-label-code">{b.code}</strong>
              <span>{K.bagNo[0]} {b.seq} · {K.bagNo[1]} {b.seq}</span>
              <span>{Object.entries(b.ri).map(([k, n]) => `${n} ri ${b.lineLabels[k] ?? k}`).join(' · ')}</span>
              {b.extraNote && <span>+ {b.extraNote}</span>}
              <span className="kho-label-brand">HLUXURY</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
