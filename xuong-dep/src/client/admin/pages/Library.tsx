import { ImagePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError, imgUrl } from '../api';
import { KIND_LABEL, useMaterials, type Design, type MaterialKind } from '../catalog';
import { DesignCard, LABEL_VI } from '../components/DesignCard';
import { MaterialPicker } from '../components/MaterialPicker';
import { OrderList, viDate, type OrderSummary } from '../components/OrderRow';
import { go } from '../router';

const KEY: Record<MaterialKind, 'soleId' | 'strapId' | 'styleId'> = { sole: 'soleId', strap: 'strapId', style: 'styleId' };

export function Library() {
  const [materials] = useMaterials();
  const [label, setLabel] = useState('');
  const [mat, setMat] = useState<Record<MaterialKind, string>>({ sole: '', strap: '', style: '' });
  const [q, setQ] = useState('');
  const [list, setList] = useState<Design[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (label) qs.set('label', label);
      for (const k of Object.keys(mat) as MaterialKind[]) if (mat[k]) qs.set(KEY[k], mat[k]);
      if (q.trim()) qs.set('q', q.trim());
      api<Design[]>('GET', `/api/designs?${qs}`).then(setList).catch(() => setList([]));
    }, 200);
    return () => clearTimeout(t);
  }, [label, mat, q]);

  return (
    <main className="page">
      <div className="topbar"><h1>Thư viện mẫu</h1></div>
      <a className="btn-gold library-upload" href="#/orders/new?library=1"><ImagePlus size={20} aria-hidden="true" /> Đăng ảnh lên thư viện</a>
      <p className="small muted" style={{ margin: '6px 0 12px' }}>Chọn ảnh, chạm vào từng đôi dép để cắt thành mẫu. Mẫu hiện cho khách đã đăng nhập tham khảo và đặt lại; mẫu có logo hãng khác thì mở mẫu và tick "Có logo thương hiệu".</p>
      <div className="chips">
        <button type="button" className="chip" aria-pressed={label === ''} onClick={() => setLabel('')}>Tất cả</button>
        <button type="button" className="chip" aria-pressed={label === 'co_dinh'} onClick={() => setLabel('co_dinh')}>Mẫu cố định</button>
        <button type="button" className="chip" aria-pressed={label === 'dat_rieng'} onClick={() => setLabel('dat_rieng')}>Mẫu theo đơn</button>
      </div>
      <div className="row" style={{ margin: '8px 0' }}>
        {(['style', 'sole', 'strap'] as MaterialKind[]).map((k) => (
          <select key={k} aria-label={`Lọc theo ${KIND_LABEL[k].toLowerCase()}`} className="grow" value={mat[k]} onChange={(e) => setMat({ ...mat, [k]: e.target.value })}>
            <option value="">{KIND_LABEL[k]}: tất cả</option>
            {materials.filter((m) => m.kind === k).map((m) => <option key={m.id} value={m.id}>{m.nameVi}</option>)}
          </select>
        ))}
      </div>
      <input aria-label="Tìm theo ghi chú" placeholder="Tìm theo ghi chú" value={q} onChange={(e) => setQ(e.target.value)} />
      {list === null && <p className="muted">Đang tải…</p>}
      {list?.length === 0 && <p className="muted">Không có mẫu nào.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8, marginTop: 12 }}>
        {list?.map((d) => <DesignCard key={d.id} d={d} />)}
      </div>
    </main>
  );
}

type DesignDetailData = Design & { orders: (Pick<OrderSummary, 'id' | 'code' | 'status' | 'customerName' | 'createdAt'>)[] };

export function DesignDetail({ id }: { id: string }) {
  const [materials, reloadMaterials] = useMaterials();
  const [d, setD] = useState<DesignDetailData | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api<DesignDetailData>('GET', `/api/designs/${id}`).then(setD).catch((e) => setError(e.message)); }, [id]);
  if (!d) return <main className="page">{error ? <p className="error">{error}</p> : <p className="muted">Đang tải…</p>}</main>;

  const set = (patch: Partial<Design>) => { setMsg(''); setD({ ...d, ...patch }); };
  const current = d;
  async function save() {
    setError('');
    try {
      const u = await api<Design>('PUT', `/api/designs/${id}`, {
        label: current.label, note: current.note,
        isPrivate: !!current.isPrivate, hidden: !!current.hidden, hasBrandLogo: !!current.hasBrandLogo,
        soleId: current.soleId, strapId: current.strapId, styleId: current.styleId,
      });
      setD({ ...current, ...u, orders: current.orders });
      setMsg('Đã lưu mẫu');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Không lưu được'); }
  }
  const orders = d.orders.map((o) => ({ ...o, customerId: '', currency: 'VND' as const, neededBy: null, acceptedAt: null, totalQty: 0, amount: 0, missingPrice: false, paid: 0, due: 0, thumbKey: null }));

  return (
    <main className="page">
      <div className="topbar"><h1>Mẫu trong thư viện</h1><a className="btn btn-sm" href="#/library">Thư viện</a></div>
      <img src={imgUrl(d.cropKey)} alt="Mẫu" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', background: 'var(--surface-2)', borderRadius: 12 }} />
      {d.imageKey && <p className="small"><a href={imgUrl(d.imageKey)} target="_blank" rel="noreferrer">Xem ảnh gốc khách gửi</a> · lưu ngày {viDate(d.createdAt)}</p>}
      <button type="button" className="btn-primary btn-block" style={{ margin: '8px 0 16px' }} onClick={() => go(`/orders/new?design=${d.id}`)}>Tạo đơn từ mẫu này</button>

      <section className="card stack">
        <div>
          <label htmlFor="d-label">Nhãn</label>
          <select id="d-label" value={d.label} onChange={(e) => set({ label: e.target.value as Design['label'] })}>
            <option value="dat_rieng">{LABEL_VI.dat_rieng}</option>
            <option value="co_dinh">{LABEL_VI.co_dinh}</option>
          </select>
        </div>
        <div className="row wrap">
          <MaterialPicker kind="sole" value={d.soleId} materials={materials} onCreated={reloadMaterials} onChange={(v) => set({ soleId: v })} />
          <MaterialPicker kind="strap" value={d.strapId} materials={materials} onCreated={reloadMaterials} onChange={(v) => set({ strapId: v })} />
          <MaterialPicker kind="style" value={d.styleId} materials={materials} onCreated={reloadMaterials} onChange={(v) => set({ styleId: v })} />
        </div>
        <div>
          <label htmlFor="d-note">Ghi chú mẫu</label>
          <textarea id="d-note" value={d.note} onChange={(e) => set({ note: e.target.value })} />
        </div>
        <fieldset className="flags">
          <legend>Khách đã đăng nhập có thấy mẫu này không</legend>
          <label className="check">
            <input type="checkbox" checked={!!d.isPrivate} onChange={(e) => set({ isPrivate: e.target.checked })} />
            Mẫu đặt riêng (không hiện cho khách khác)
          </label>
          <label className="check">
            <input type="checkbox" checked={!!d.hidden} onChange={(e) => set({ hidden: e.target.checked })} />
            Ẩn khỏi thư viện
          </label>
          <label className="check">
            <input type="checkbox" checked={!!d.hasBrandLogo} onChange={(e) => set({ hasBrandLogo: e.target.checked })} />
            Có logo thương hiệu
          </label>
          <p className="small muted" style={{ margin: 0 }}>Mẫu có logo không bao giờ lên trang web công khai (kể cả màu sản phẩm dùng ảnh này). Muốn khách đăng nhập cũng không thấy thì tick thêm "Ẩn khỏi thư viện".</p>
        </fieldset>
        {error && <p className="error">{error}</p>}
        <div className="row"><button type="button" className="btn-primary grow" onClick={save}>Lưu mẫu</button>{msg && <span className="success">{msg}</span>}</div>
      </section>

      <h2>Các đơn đã dùng mẫu này</h2>
      <OrderList orders={orders} empty="Chưa có đơn nào dùng mẫu này." />
    </main>
  );
}
