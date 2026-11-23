import { useEffect, useState } from 'react';
import { formatQty } from '../../../shared/money';
import { printable } from '../../../shared/status';
import { itemQty, lineQty, lineSizes } from '../../../shared/totals';
import type { Item } from '../../../shared/types';
import { paginateByHeight, renderSheetPngs, type SheetData, type SheetItem } from '../../lib/sheet-png';
import { api, imgUrl } from '../api';
import { lineLabel, useSettings, type Material, type Settings } from '../catalog';
import type { OrderView } from '../pages/OrderDetail';
import { viDate } from './OrderRow';

function toSheet(o: OrderView, mats: Map<string, Material>, settings: Settings | null): SheetData {
  const name = (id: string | null) => (id ? mats.get(id)?.nameVi ?? '' : '');
  const item = (i: Item): SheetItem => ({
    tagNo: i.tagNo,
    cropUrl: imgUrl(i.cropKey),
    materials: [['Đế', i.soleId], ['Quai', i.strapId], ['Kiểu', i.styleId]].filter(([, v]) => v).map(([k, v]) => `${k}: ${name(v)}`),
    note: i.colorNote,
    qty: itemQty(i),
    lines: i.lines.map((l) => ({
      label: lineLabel(settings, l.lineKey), range: `${l.sizeFrom}–${l.sizeTo}`, total: l.mode === 'total',
      sizes: Object.entries(lineSizes(l)), qty: lineQty(l),
    })),
  });
  return { code: o.code, customer: o.customer.name, neededBy: o.neededBy ? viDate(o.neededBy) : '', totalQty: o.totals.qty, items: o.items.map(item) };
}

/** Phiếu làm hàng: A4 print + PNG pages for Zalo. Shows no prices. */
export function ProductionSheet({ id }: { id: string }) {
  const settings = useSettings();
  const [o, setO] = useState<OrderView | null>(null);
  const [mats, setMats] = useState<Map<string, Material>>(new Map());
  const [pngs, setPngs] = useState<{ blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<OrderView>('GET', `/api/orders/${id}`).then(setO).catch((e) => setError(e.message));
    api<Material[]>('GET', '/api/materials?all=1').then((ms) => setMats(new Map(ms.map((m) => [m.id, m])))).catch(() => {});
  }, [id]);
  useEffect(() => () => pngs.forEach((p) => URL.revokeObjectURL(p.url)), [pngs]);

  if (!o) return <main className="page">{error ? <p className="error">{error}</p> : <p className="muted">Đang tải…</p>}</main>;
  if (!printable(o.status)) {
    return (
      <main className="page">
        <h1>Phiếu làm hàng {o.code}</h1>
        <p className="notice"><strong>Đơn chưa chốt.</strong> Phiếu làm hàng có khi khách đã đồng ý báo giá.</p>
        <a className="btn" href={`#/orders/${id}`}>Về đơn hàng</a>
      </main>
    );
  }

  const data = toSheet(o, mats, settings);
  const pages = paginateByHeight(data.items);
  const files = () => pngs.map((p, i) => new File([p.blob], `${o.code}-trang-${i + 1}.png`, { type: 'image/png' }));

  async function makePngs() {
    setBusy(true); setError('');
    try {
      const blobs = await renderSheetPngs(data);
      setPngs(blobs.map((blob) => ({ blob, url: URL.createObjectURL(blob) })));
    } catch {
      setError('Không tạo được ảnh, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const fs = files();
    if (navigator.canShare?.({ files: fs })) {
      try { await navigator.share({ files: fs, title: `Phiếu làm hàng ${o!.code}` }); return; } catch { /* cancelled */ return; }
    }
    for (const [i, p] of pngs.entries()) {
      const a = document.createElement('a');
      a.href = p.url; a.download = fs[i].name; a.click();
    }
  }

  return (
    <main className="page">
      <div className="no-print">
        <div className="topbar"><h1>Phiếu làm hàng</h1><a className="btn btn-sm" href={`#/orders/${id}`}>Về đơn</a></div>
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <button type="button" className="btn-primary grow" onClick={() => window.print()}>In phiếu</button>
          <button type="button" className="grow" disabled={busy} onClick={makePngs}>{busy ? 'Đang tạo ảnh…' : 'Lưu ảnh để gửi Zalo'}</button>
        </div>
        {error && <p className="error">{error}</p>}
        {pngs.length > 0 && (
          <section className="card stack" style={{ marginBottom: 16 }} aria-label="Ảnh phiếu làm hàng">
            <button type="button" className="btn-primary" onClick={share}>Gửi {pngs.length} ảnh (Zalo, lưu vào máy…)</button>
            <p className="small muted">Trên iPhone có thể nhấn giữ từng ảnh để lưu vào Ảnh.</p>
            {pngs.map((p, i) => <img key={p.url} className="sheet-png" src={p.url} alt={`Phiếu trang ${i + 1}`} style={{ border: '1px solid var(--line)' }} />)}
          </section>
        )}
      </div>

      <div className="production-sheet">
        {pages.map((items, p) => (
          <section key={p} className="sheet-page">
            <header className="sheet-head">
              <div className="sheet-title">PHIẾU LÀM HÀNG {data.code}</div>
              <div>Khách: <strong>{data.customer}</strong>{data.neededBy && <> · Cần hàng: <strong>{data.neededBy}</strong></>}</div>
              <div className="sheet-sub">Trang {p + 1}/{pages.length} · Cả đơn: {formatQty(data.totalQty)} đôi</div>
            </header>
            {items.map((it) => (
              <article key={it.tagNo} className="sheet-item">
                <div className="sheet-img">
                  <img src={it.cropUrl} alt={`Mẫu ${it.tagNo}`} />
                  <span className="sheet-tag">{it.tagNo}</span>
                </div>
                <div className="sheet-info">
                  <div className="sheet-name">Mẫu {it.tagNo}</div>
                  {it.materials.map((m) => <div key={m}>{m}</div>)}
                  {it.note && <div>Màu/ghi chú: {it.note}</div>}
                  {it.lines.map((l, k) => (
                    <div key={k} className="sheet-line">
                      <strong>{l.label} {l.range}: {formatQty(l.qty)} đôi</strong>
                      {l.total ? <div>Chia size theo chuẩn xưởng</div> : (
                        <table><tbody>
                          <tr>{l.sizes.map(([s]) => <th key={s}>{s}</th>)}</tr>
                          <tr>{l.sizes.map(([s, n]) => <td key={s}>{n}</td>)}</tr>
                        </tbody></table>
                      )}
                    </div>
                  ))}
                  <div className="sheet-total">Tổng mẫu: {formatQty(it.qty)} đôi</div>
                </div>
              </article>
            ))}
            {p === pages.length - 1 && <footer className="sheet-foot">TỔNG CẢ ĐƠN: {formatQty(data.totalQty)} ĐÔI</footer>}
          </section>
        ))}
      </div>
    </main>
  );
}
