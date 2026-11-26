import { useEffect, useState } from 'react';
import { go } from '../../admin/router';
import { kapi } from '../api';
import { B, K, STATUS_K } from '../i18n';
import { ScanBox } from '../scan';

type Bag = {
  code: string; seq: number; ri: Record<string, number>; lineLabels: Record<string, string>; pairs: number; extraNote: string; extraPairs: number;
  over: boolean; status: string; trip: { id: string; code: string; status: string } | null;
  order: { id: string; code: string; totalBags: number; customerName?: string; deliverNote?: string };
  events: { kind: string; at: string; by: string; tripCode: string | null; data: any }[];
};
const EVENT: Record<string, string> = {
  pack: 'Đóng bao', reprint: 'In lại tem', load: 'Lên xe', unload: 'Bỏ khỏi xe', depart: 'Xe chạy', receive: 'Nhận ở Cam', missing: 'Thiếu khi tới',
  stock: 'Nhập kho Cam', deliver: 'Giao khách', edit_ri: 'Sửa số ri', flag: 'Đánh dấu', cancel: 'Hủy bao',
};
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function ScanPage() {
  return (
    <main className="page kho-page">
      <h1><B k="scan" /></h1>
      <ScanBox onCode={async (code) => { await kapi('GET', `/api/kho/bags/${code}`); go(`/bao/${code}`); }} />
    </main>
  );
}

/** What is in a bag, where it is, and its full history. The owner can correct it here. */
export function BagPage({ code, role }: { code: string; role: string }) {
  const [b, setB] = useState<Bag | null>(null);
  const [error, setError] = useState('');
  const [fix, setFix] = useState<'ri' | 'that_lac' | 'hu_hong' | 'cancel' | null>(null);
  const [ri, setRi] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  useEffect(() => { kapi<Bag>('GET', `/api/kho/bags/${code}`).then((x) => { setB(x); setRi(Object.fromEntries(Object.entries(x.ri).map(([k, n]) => [k, String(n)]))); }).catch((e) => setError(e.message)); }, [code]);
  if (!b) return <main className="page kho-page">{error ? <p className="error">{error}</p> : <div className="skeleton" style={{ height: 160 }} />}</main>;
  const owner = role === 'admin';
  async function apply() {
    setError('');
    try {
      if (fix === 'ri') setB(await kapi('POST', `/api/kho/bags/${b!.code}/ri`, { ri: Object.fromEntries(Object.entries(ri).map(([k, v]) => [k, parseInt(v, 10) || 0])) }));
      else if (fix === 'cancel') setB(await kapi('POST', `/api/kho/bags/${b!.code}/cancel`, {}));
      else if (fix) setB(await kapi('POST', `/api/kho/bags/${b!.code}/flag`, { kind: fix, note }));
      setFix(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  return (
    <main className="page kho-page">
      <h1><code>{b.code}</code></h1>
      <div className="card stack">
        <p><strong>{K.toa[0]} {b.order.code}</strong> · {K.bagNo[0]} {b.seq} / {b.order.totalBags}{b.order.customerName ? ` · ${b.order.customerName}` : ''}</p>
        <p>{Object.entries(b.ri).map(([k, n]) => `${n} ri ${b.lineLabels[k] ?? k}`).join(' · ') || '—'} = {b.pairs} {K.pairs[0]}{b.over ? ' · gửi dư' : ''}</p>
        {b.extraNote && <p>+ {b.extraNote}{b.extraPairs ? ` (${b.extraPairs} ${K.pairs[0]})` : ''}</p>}
        <p><span className="badge"><B k={STATUS_K[b.status] ?? 'status'} />{STATUS_K[b.status] ? '' : `: ${b.status}`}</span>{b.trip && <> · <a href={`#/chuyen/${b.trip.id}`}>{K.trip[0]} {b.trip.code}</a></>}</p>
        {b.order.deliverNote && <p className="small muted">{b.order.deliverNote}</p>}
      </div>
      <div className="row wrap">
        <a className="btn" href={`#/in?codes=${b.code}`} onClick={() => kapi('POST', `/api/kho/bags/${b.code}/reprint`, {}).catch(() => {})}><B k="reprint" /></a>
      </div>
      {owner && (
        <section className="card stack">
          <strong>Chỉnh sửa (chỉ chủ xưởng)</strong>
          <div className="row wrap">
            <button type="button" className="btn-sm" onClick={() => setFix('ri')}>Sửa số ri</button>
            <button type="button" className="btn-sm" onClick={() => setFix('that_lac')}>Thất lạc</button>
            <button type="button" className="btn-sm" onClick={() => setFix('hu_hong')}>Hư hỏng</button>
            {b.status === 'da_dong' && !b.trip && <button type="button" className="btn-sm btn-danger" onClick={() => setFix('cancel')}>Hủy bao</button>}
          </div>
          {fix === 'ri' && Object.keys(b.lineLabels).map((k) => (
            <div key={k}><label htmlFor={`fix-${k}`}>Số ri {b.lineLabels[k]}</label>
              <input id={`fix-${k}`} inputMode="numeric" className="num" value={ri[k] ?? ''} onChange={(e) => setRi((r) => ({ ...r, [k]: e.target.value.replace(/\D/g, '') }))} /></div>
          ))}
          {(fix === 'that_lac' || fix === 'hu_hong') && <div><label htmlFor="fix-note">Lý do</label><input id="fix-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>}
          {fix && <div className="row"><button type="button" className="btn" onClick={() => setFix(null)}>Thôi</button><button type="button" className="btn-primary" onClick={apply}>Lưu (ghi vào lịch sử)</button></div>}
        </section>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <section className="stack">
        <h2 className="h-small"><B k="history" /></h2>
        <ol className="kho-history">
          {b.events.map((e, i) => (
            <li key={i}>
              <strong>{EVENT[e.kind] ?? e.kind}</strong>{e.tripCode ? ` · ${e.tripCode}` : ''}
              {e.kind === 'edit_ri' && ` · ${JSON.stringify(e.data.from)} → ${JSON.stringify(e.data.to)}`}
              {e.data?.note ? ` · ${e.data.note}` : ''}
              <span className="small muted"> · {e.by} · {when(e.at)}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
