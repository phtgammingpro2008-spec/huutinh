import { imgUrl } from '../api';
import type { Design } from '../catalog';

export const LABEL_VI = { co_dinh: 'Mẫu cố định', dat_rieng: 'Mẫu đặt riêng' } as const;

export function DesignCard({ d }: { d: Design }) {
  return (
    <a className="design-card card" data-design-id={d.id} href={`#/library/${d.id}`}
      style={{ padding: 0, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <img src={imgUrl(d.cropKey)} alt={d.note || 'Mẫu'} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', background: 'var(--surface-2)' }} />
      <div style={{ padding: 6 }}>
        <span className={`badge ${d.label === 'co_dinh' ? 's-khach_dong_y' : ''}`}>{LABEL_VI[d.label]}</span>
        {d.isPrivate && <span className="badge flag" title="Không hiện cho khách khác">Riêng</span>}
        {d.hidden && <span className="badge flag" title="Ẩn khỏi thư viện của khách">Ẩn</span>}
        {d.hasBrandLogo && <span className="badge flag s-da_huy" title="Có logo thương hiệu">Logo</span>}
        {d.note && <div className="small" style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.note}</div>}
      </div>
    </a>
  );
}
