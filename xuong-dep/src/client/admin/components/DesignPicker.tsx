import { useEffect, useState } from 'react';
import { api, imgUrl } from '../api';
import type { Design } from '../catalog';

/** Bottom sheet listing library designs; tapping one picks it. */
export function DesignPicker({ onPick, onClose }: { onPick: (d: Design) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Design[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<Design[]>('GET', `/api/designs?q=${encodeURIComponent(q)}`).then(setList).catch(() => setList([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Chọn mẫu từ thư viện" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="grow" style={{ margin: 0 }}>Chọn mẫu từ thư viện</h2>
          <button type="button" className="btn-sm" onClick={onClose}>Đóng</button>
        </div>
        <input aria-label="Tìm theo ghi chú" placeholder="Tìm theo ghi chú" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: '10px 0' }} />
        {list === null && <p className="muted">Đang tải…</p>}
        {list?.length === 0 && <p className="muted">Thư viện chưa có mẫu nào.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
          {list?.map((d) => (
            <button key={d.id} type="button" data-design-id={d.id} onClick={() => onPick(d)}
              style={{ padding: 0, height: 'auto', flexDirection: 'column', overflow: 'hidden' }}>
              <img src={imgUrl(d.cropKey)} alt={d.note || 'Mẫu'} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
              <span className="small" style={{ padding: 4 }}>{d.label === 'co_dinh' ? 'Mẫu cố định' : d.note || 'Mẫu đặt riêng'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
