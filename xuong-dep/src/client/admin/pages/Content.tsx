import { useEffect, useId, useState, type ReactNode } from 'react';
import type { Lang, LineSetting } from '../../../shared/types';
import { compressImage } from '../../lib/image';
import { api, ApiError, imgUrl } from '../api';
import { useMaterials, useSettings, type Design } from '../catalog';
import { DesignPicker } from '../components/DesignPicker';
import { MaterialPicker } from '../components/MaterialPicker';

type Names = Record<Lang, string>;
const N0 = (): Names => ({ vi: '', en: '', km: '' });
const LANG_TAG: Record<Lang, string> = { vi: 'VI', en: 'EN', km: 'KM' };

type Color = { id?: string; name: Names; imageKey: string; designId: string | null };
type Product = {
  id?: string; slug?: string; name: Names; desc: Names; styleId: string | null; soleId: string | null; strapId: string | null;
  lines: LineSetting[]; isNew: boolean; published: boolean; hasBrandLogo: boolean; position: number; colors: Color[];
};
type Collection = { id?: string; title: Names; subtitle: Names; coverKey: string | null; color: string; published: boolean; position: number; productIds: string[] };
type Poster = { id?: string; tag: Names; title: Names; body: Names; imageKey: string | null; ctaLabel: Names; ctaHref: string; published: boolean; position: number };
type Shop = { zalo: string; messenger: string; workshopAddress: string; warehouseAddress: string };

/** One text in Vietnamese, English and Khmer. Empty languages fall back to Vietnamese on the site. */
function NamesInput({ label, value, onChange, multiline }: { label: string; value: Names; onChange: (v: Names) => void; multiline?: boolean }) {
  const id = useId();
  return (
    <fieldset className="names3">
      <legend>{label}</legend>
      {(['vi', 'en', 'km'] as Lang[]).map((l) => {
        const props = { id: id + l, lang: l, 'aria-label': `${label} (${LANG_TAG[l]})`, value: value[l] ?? '', placeholder: l === 'vi' ? '' : 'trống = dùng tiếng Việt',
          onChange: (e: { target: { value: string } }) => onChange({ ...value, [l]: e.target.value }) };
        return (
          <div key={l} className="names3-row">
            <span className="lang-tag" aria-hidden="true">{LANG_TAG[l]}</span>
            {multiline ? <textarea {...props} /> : <input {...props} />}
          </div>
        );
      })}
    </fieldset>
  );
}

/** Picks a photo, shrinks it on the phone and stores it as a site picture (pub/…). */
function ImageInput({ label, value, onChange, imgClass }: { label: string; value: string | null; onChange: (key: string | null) => void; imgClass?: string }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const { blob, width, height } = await compressImage(file);
      const r = await fetch(`/api/content/images?w=${width}&h=${height}`, { method: 'POST', body: blob, headers: { 'content-type': blob.type || 'image/jpeg' } });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? 'Tải ảnh thất bại');
      onChange(data.key);
    } catch (e) { setError(e instanceof Error ? e.message : 'Tải ảnh thất bại'); } finally { setBusy(false); }
  }
  return (
    <div className="image-input">
      {value ? <img className={imgClass ?? 'content-img'} src={imgUrl(value)} alt="" /> : <div className={`${imgClass ?? 'content-img'} empty`} />}
      <div className="stack grow">
        <label htmlFor={id} className="btn btn-sm">{busy ? 'Đang tải…' : value ? 'Đổi ảnh' : 'Chọn ảnh'}</label>
        <input id={id} type="file" accept="image/*" aria-label={label} className="visually-hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        {value && <button type="button" className="btn-sm btn-ghost" onClick={() => onChange(null)}>Bỏ ảnh</button>}
        {error && <p className="error small">{error}</p>}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}
function Num({ label, value, onChange, width = 90 }: { label: string; value: number; onChange: (n: number) => void; width?: number }) {
  return <input aria-label={label} inputMode="numeric" className="num" style={{ width }} value={String(value)}
    onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} />;
}

/** List + editor for one kind of site content. */
function Crud<T extends { id?: string; published: boolean }>({ path, noun, blank, title, form, after }: {
  path: string; noun: string; blank: () => T; title: (x: T) => string; form: (x: T, set: (p: Partial<T>) => void) => ReactNode; after?: (x: T) => ReactNode;
}) {
  const [list, setList] = useState<T[] | null>(null);
  const [edit, setEdit] = useState<T | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api<T[]>('GET', path).then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [path]);

  async function save() {
    if (!edit) return;
    setBusy(true); setError(''); setMsg('');
    try {
      const saved = await api<T>(edit.id ? 'PUT' : 'POST', edit.id ? `${path}/${edit.id}` : path, edit);
      setEdit(saved);
      setMsg(`Đã lưu ${noun}`);
      load();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Không lưu được'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!edit?.id || !window.confirm(`Xóa ${noun} "${title(edit)}"?`)) return;
    await api('DELETE', `${path}/${edit.id}`).catch(() => {});
    setEdit(null); load();
  }

  if (edit) {
    return (
      <section className="stack" aria-label={`Sửa ${noun}`}>
        <button type="button" className="btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => { setEdit(null); setMsg(''); }}>‹ Danh sách</button>
        {form(edit, (p) => { setMsg(''); setEdit({ ...edit, ...p }); })}
        {error && <p className="error" role="alert">{error}</p>}
        {msg && <p className="success" role="status">{msg}</p>}
        <div className="row">
          <button type="button" className="btn-primary grow" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : `Lưu ${noun}`}</button>
          {edit.id && <button type="button" className="btn btn-danger" onClick={remove}>Xóa</button>}
        </div>
        {edit.id && after?.(edit)}
      </section>
    );
  }
  return (
    <section className="stack">
      <button type="button" className="btn-primary btn-block" onClick={() => setEdit(blank())}>Thêm {noun}</button>
      {error && <p className="error">{error}</p>}
      {!list && <div className="skeleton" style={{ height: 100 }} />}
      {list && list.length === 0 && <p className="muted">Chưa có {noun} nào.</p>}
      <ul className="list">
        {list?.map((x) => (
          <li key={x.id}>
            <button type="button" className="list-item btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => setEdit(x)}>
              <span className="grow" style={{ textAlign: 'left' }}>{title(x) || '(chưa đặt tên)'}</span>
              <span className={`badge ${x.published ? 's-khach_dong_y' : ''}`}>{x.published ? 'Đang hiện' : 'Đang ẩn'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductForm({ p, set }: { p: Product; set: (x: Partial<Product>) => void }) {
  const settings = useSettings();
  const [materials, reloadMaterials] = useMaterials();
  const [picking, setPicking] = useState<number | null>(null);
  // a new product starts with every size line the workshop makes; untick what does not apply
  useEffect(() => { if (!p.id && p.lines.length === 0 && settings) set({ lines: settings.lines.map((l) => ({ ...l })) }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [settings]);
  const setColor = (i: number, c: Partial<Color>) => set({ colors: p.colors.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const lineOf = (key: string) => p.lines.find((l) => l.key === key);
  const setLine = (s: LineSetting, on: boolean, patch: Partial<LineSetting> = {}) => {
    const rest = p.lines.filter((l) => l.key !== s.key);
    if (!on) return set({ lines: rest });
    const cur = lineOf(s.key) ?? { key: s.key, label: s.label, sizeFrom: s.sizeFrom, sizeTo: s.sizeTo };
    set({ lines: [...rest, { ...cur, ...patch }].sort((a, b) => settings!.lines.findIndex((x) => x.key === a.key) - settings!.lines.findIndex((x) => x.key === b.key)) });
  };
  return (
    <>
      <NamesInput label="Tên sản phẩm" value={p.name} onChange={(name) => set({ name })} />
      <NamesInput label="Mô tả ngắn" value={p.desc} onChange={(desc) => set({ desc })} multiline />
      <div className="row wrap">
        <MaterialPicker kind="style" value={p.styleId} materials={materials} onCreated={reloadMaterials} onChange={(v) => set({ styleId: v })} />
        <MaterialPicker kind="sole" value={p.soleId} materials={materials} onCreated={reloadMaterials} onChange={(v) => set({ soleId: v })} />
        <MaterialPicker kind="strap" value={p.strapId} materials={materials} onCreated={reloadMaterials} onChange={(v) => set({ strapId: v })} />
      </div>
      <fieldset className="card">
        <legend>Dòng size khách được chọn</legend>
        {settings?.lines.map((s) => {
          const l = lineOf(s.key);
          return (
            <div key={s.key} className="row wrap">
              <Check label={s.label.vi} checked={!!l} onChange={(on) => setLine(s, on)} />
              {l && <>
                <Num label={`Size từ – ${s.label.vi}`} value={l.sizeFrom} width={64} onChange={(n) => setLine(s, true, { sizeFrom: n })} />
                <span className="small muted">đến</span>
                <Num label={`Size đến – ${s.label.vi}`} value={l.sizeTo} width={64} onChange={(n) => setLine(s, true, { sizeTo: n })} />
              </>}
            </div>
          );
        })}
      </fieldset>
      <fieldset className="card stack">
        <legend>Màu</legend>
        {p.colors.length === 0 && <p className="small muted" style={{ margin: 0 }}>Mỗi màu cần tên và ảnh. Ảnh tải lên, hoặc lấy ảnh cắt của một mẫu trong thư viện.</p>}
        {p.colors.map((c, i) => (
          <div key={c.id ?? i} className="color-row card">
            <NamesInput label="Tên màu" value={c.name} onChange={(name) => setColor(i, { name })} />
            <ImageInput label="Ảnh màu" value={c.imageKey || null} imgClass="color-img" onChange={(k) => setColor(i, { imageKey: k ?? '', designId: null })} />
            <div className="row wrap">
              <button type="button" className="btn-sm" onClick={() => setPicking(i)}>Lấy ảnh từ thư viện</button>
              {c.designId && <span className="small muted">Ảnh từ mẫu thư viện</span>}
              <button type="button" className="btn-sm btn-danger" onClick={() => set({ colors: p.colors.filter((_, j) => j !== i) })}>Xóa màu</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => set({ colors: [...p.colors, { name: N0(), imageKey: '', designId: null }] })}>Thêm màu</button>
      </fieldset>
      <div className="card stack">
        <Check label="Đang bán (hiện trên trang web)" checked={p.published} onChange={(published) => set({ published })} />
        <Check label="Nhãn MỚI" checked={p.isNew} onChange={(isNew) => set({ isNew })} />
        <Check label="Có logo thương hiệu (không bao giờ lên trang web)" checked={p.hasBrandLogo} onChange={(hasBrandLogo) => set({ hasBrandLogo })} />
        <div className="row"><span className="grow">Thứ tự (số nhỏ hiện trước)</span><Num label="Thứ tự" value={p.position} onChange={(position) => set({ position })} /></div>
      </div>
      {picking !== null && (
        <DesignPicker onClose={() => setPicking(null)}
          onPick={(d: Design) => { setColor(picking, { imageKey: d.cropKey, designId: d.id }); setPicking(null); }} />
      )}
    </>
  );
}

function CollectionForm({ c, set, products }: { c: Collection; set: (x: Partial<Collection>) => void; products: Product[] }) {
  const on = new Set(c.productIds);
  return (
    <>
      <NamesInput label="Tiêu đề" value={c.title} onChange={(title) => set({ title })} />
      <NamesInput label="Dòng phụ" value={c.subtitle} onChange={(subtitle) => set({ subtitle })} />
      <div className="card stack">
        <p className="legend" style={{ margin: 0 }}>Ảnh bìa (không có thì dùng màu nền)</p>
        <ImageInput label="Ảnh bìa" value={c.coverKey} onChange={(coverKey) => set({ coverKey })} />
        <label className="row"><span className="grow">Màu nền</span><input type="color" aria-label="Màu nền" value={c.color} onChange={(e) => set({ color: e.target.value })} style={{ width: 64, padding: 4 }} /></label>
      </div>
      <fieldset className="card">
        <legend>Sản phẩm trong bộ sưu tập (theo thứ tự chọn)</legend>
        {products.length === 0 && <p className="small muted">Chưa có sản phẩm. Tạo ở thẻ Sản phẩm trước.</p>}
        {products.map((p) => (
          <Check key={p.id} label={`${p.name.vi}${on.has(p.id!) ? ` (#${c.productIds.indexOf(p.id!) + 1})` : ''}`} checked={on.has(p.id!)}
            onChange={(v) => set({ productIds: v ? [...c.productIds, p.id!] : c.productIds.filter((x) => x !== p.id) })} />
        ))}
      </fieldset>
      <div className="card stack">
        <Check label="Hiện trên trang web" checked={c.published} onChange={(published) => set({ published })} />
        <div className="row"><span className="grow">Thứ tự</span><Num label="Thứ tự" value={c.position} onChange={(position) => set({ position })} /></div>
      </div>
    </>
  );
}

function PosterForm({ p, set }: { p: Poster; set: (x: Partial<Poster>) => void }) {
  return (
    <>
      <div className="card stack"><p className="legend" style={{ margin: 0 }}>Ảnh poster</p><ImageInput label="Ảnh poster" value={p.imageKey} onChange={(imageKey) => set({ imageKey })} /></div>
      <NamesInput label="Nhãn nhỏ (ví dụ MỚI · HÈ 2027)" value={p.tag} onChange={(tag) => set({ tag })} />
      <NamesInput label="Tiêu đề" value={p.title} onChange={(title) => set({ title })} />
      <NamesInput label="Mô tả" value={p.body} onChange={(body) => set({ body })} multiline />
      <NamesInput label="Chữ trên nút" value={p.ctaLabel} onChange={(ctaLabel) => set({ ctaLabel })} />
      <div className="card stack">
        <label htmlFor="poster-href">Nút dẫn tới (ví dụ /san-pham hoặc /bo-suu-tap/…)</label>
        <input id="poster-href" value={p.ctaHref} placeholder="/san-pham" onChange={(e) => set({ ctaHref: e.target.value })} />
        <Check label="Hiện trên trang web" checked={p.published} onChange={(published) => set({ published })} />
        <div className="row"><span className="grow">Thứ tự</span><Num label="Thứ tự" value={p.position} onChange={(position) => set({ position })} /></div>
      </div>
    </>
  );
}

function ShopForm() {
  const [s, setS] = useState<Shop | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api<Shop>('GET', '/api/shop').then(setS).catch((e) => setError(e.message)); }, []);
  if (!s) return error ? <p className="error">{error}</p> : <div className="skeleton" style={{ height: 120 }} />;
  const field = (k: keyof Shop, label: string, ph = '') => (
    <div><label htmlFor={`shop-${k}`}>{label}</label><input id={`shop-${k}`} value={s[k]} placeholder={ph} onChange={(e) => { setMsg(''); setS({ ...s, [k]: e.target.value }); }} /></div>
  );
  async function save() {
    setError('');
    try { setS(await api<Shop>('PUT', '/api/shop', s)); setMsg('Đã lưu thông tin xưởng'); } catch (e) { setError(e instanceof ApiError ? e.message : 'Không lưu được'); }
  }
  return (
    <section className="card stack">
      {field('zalo', 'Số Zalo', '0901 234 567')}
      {field('messenger', 'Link Messenger', 'm.me/hluxury')}
      {field('workshopAddress', 'Địa chỉ xưởng')}
      {field('warehouseAddress', 'Địa chỉ kho (Phnom Penh)')}
      {error && <p className="error">{error}</p>}
      {msg && <p className="success" role="status">{msg}</p>}
      <button type="button" className="btn-primary" onClick={save}>Lưu thông tin xưởng</button>
    </section>
  );
}

const TABS = [['products', 'Sản phẩm'], ['collections', 'Bộ sưu tập'], ['posters', 'Poster'], ['shop', 'Thông tin xưởng']] as const;
type Tab = (typeof TABS)[number][0];

/** Everything the public site shows: products, collections, posters, workshop info. */
export function Content() {
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { if (tab === 'collections') api<Product[]>('GET', '/api/products').then(setProducts).catch(() => {}); }, [tab]);
  return (
    <main className="page">
      <div className="topbar"><h1>Trang web</h1><a className="btn btn-sm" href="/" target="_blank" rel="noreferrer">Xem trang web</a></div>
      <div className="seg" role="tablist" aria-label="Nội dung trang web" style={{ marginBottom: 14 }}>
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'products' && (
        <Crud<Product> key="p" path="/api/products" noun="sản phẩm" title={(x) => x.name.vi}
          blank={() => ({ name: N0(), desc: N0(), styleId: null, soleId: null, strapId: null, lines: [], isNew: true, published: false, hasBrandLogo: false, position: 0, colors: [] })}
          form={(x, set) => <ProductForm p={x} set={set} />}
          after={(x) => x.published && x.slug ? <a className="btn btn-block" href={`/san-pham/${x.slug}`} target="_blank" rel="noreferrer">Xem trên trang web</a> : null} />
      )}
      {tab === 'collections' && (
        <Crud<Collection> key="c" path="/api/collections" noun="bộ sưu tập" title={(x) => x.title.vi}
          blank={() => ({ title: N0(), subtitle: N0(), coverKey: null, color: '#1b3b2c', published: false, position: 0, productIds: [] })}
          form={(x, set) => <CollectionForm c={x} set={set} products={products} />} />
      )}
      {tab === 'posters' && (
        <Crud<Poster> key="o" path="/api/posters" noun="poster" title={(x) => x.title.vi}
          blank={() => ({ tag: N0(), title: N0(), body: N0(), imageKey: null, ctaLabel: N0(), ctaHref: '/san-pham', published: false, position: 0 })}
          form={(x, set) => <PosterForm p={x} set={set} />} />
      )}
      {tab === 'shop' && <ShopForm />}
    </main>
  );
}
