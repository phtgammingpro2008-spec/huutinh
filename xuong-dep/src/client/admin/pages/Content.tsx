import { useEffect, useId, useState, type ReactNode } from 'react';
import type { Lang, LineSetting } from '../../../shared/types';
import { compressImage } from '../../lib/image';
import { api, ApiError, imgUrl } from '../api';
import { useMaterials, useSettings, type Design } from '../catalog';
import { DesignPicker } from '../components/DesignPicker';
import { MaterialPicker } from '../components/MaterialPicker';
import { isOwner } from '../me';

type Names = Record<Lang, string>;
const N0 = (): Names => ({ vi: '', en: '', km: '' });
const LANG_TAG: Record<Lang, string> = { vi: 'VI', en: 'EN', km: 'KM' };

type Color = { id?: string; name: Names; imageKey: string; designId: string | null };
type Product = {
  id?: string; slug?: string; name: Names; desc: Names; styleId: string | null; soleId: string | null; strapId: string | null;
  lines: LineSetting[]; isNew: boolean; published: boolean; hasBrandLogo: boolean; position: number; colors: Color[];
};
type Collection = { id?: string; title: Names; subtitle: Names; coverKey: string | null; color: string; published: boolean; position: number; productIds: string[] };
type Poster = {
  id?: string; tag: Names; title: Names; body: Names; imageKey: string | null; ctaLabel: Names; ctaHref: string; published: boolean; position: number;
  layout: 'classic' | 'promo'; productId: string | null; accent: string; highlight: Names; badge: Names;
};
type Section = 'strip' | 'xuong' | 'giao';
type GalleryItem = { id?: string; imageKey: string; caption: Names; href: string; published: boolean; position: number; section: Section };
type Contact = { name: string; phone: string };
type Stat = { value: string; label: Names };
type Shop = { address: string; messenger: string; ceo: Contact; sales: Contact; stats: Stat[] };

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
function Crud<T extends { id?: string; published: boolean }>({ path, noun, blank, title, form, after, thumb, filter }: {
  path: string; noun: string; blank: () => T; title: (x: T) => string; form: (x: T, set: (p: Partial<T>) => void) => ReactNode; after?: (x: T) => ReactNode;
  thumb?: (x: T) => string | null | undefined;
  /** Shows only part of what `path` lists (the three picture sections share one list). */
  filter?: (x: T) => boolean;
}) {
  const [list, setList] = useState<T[] | null>(null);
  const [edit, setEdit] = useState<T | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api<T[]>('GET', path).then((xs) => setList(filter ? xs.filter(filter) : xs)).catch((e) => setError(e.message));
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
              {thumb && (thumb(x) ? <img className="thumb" src={imgUrl(thumb(x)!)} alt="" loading="lazy" /> : <span className="thumb" />)}
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

const ACCENTS = [['#E2B65B', 'Vàng đồng'], ['#E0453A', 'Đỏ'], ['#E8F3A3', 'Xanh chanh'], ['#F2EEE5', 'Kem']] as const;

function PosterForm({ p, set, products }: { p: Poster; set: (x: Partial<Poster>) => void; products: Product[] }) {
  const promo = p.layout === 'promo';
  return (
    <>
      <div className="seg" role="group" aria-label="Kiểu poster">
        <button type="button" aria-pressed={promo} onClick={() => set({ layout: 'promo' })}>Quảng cáo sản phẩm</button>
        <button type="button" aria-pressed={!promo} onClick={() => set({ layout: 'classic' })}>Đơn giản</button>
      </div>
      {promo && (
        <div className="card stack">
          <p className="small muted" style={{ margin: 0 }}>Kiểu poster in: nền tối, chữ lớn, số màu, dải size và lưới ảnh các màu lấy từ sản phẩm. Ảnh sản phẩm đổi thì poster tự đổi theo.</p>
          <div>
            <label htmlFor="poster-product">Sản phẩm của poster</label>
            <select id="poster-product" value={p.productId ?? ''} onChange={(e) => set({ productId: e.target.value || null })}>
              <option value="">Chưa chọn</option>
              {products.map((x) => <option key={x.id} value={x.id}>{x.name.vi}{x.published ? '' : ' (đang ẩn)'}</option>)}
            </select>
          </div>
          <div className="row wrap" role="group" aria-label="Màu nhấn">
            <span className="grow">Màu nhấn</span>
            {ACCENTS.map(([hex, name]) => (
              <button key={hex} type="button" className="accent-dot" aria-pressed={p.accent.toLowerCase() === hex.toLowerCase()} aria-label={name} title={name}
                style={{ background: hex }} onClick={() => set({ accent: hex })} />
            ))}
          </div>
        </div>
      )}
      <div className="card stack"><p className="legend" style={{ margin: 0 }}>{promo ? 'Ảnh lớn (trống = ảnh màu đầu tiên của sản phẩm)' : 'Ảnh poster'}</p><ImageInput label="Ảnh poster" value={p.imageKey} onChange={(imageKey) => set({ imageKey })} /></div>
      <NamesInput label="Nhãn nhỏ (ví dụ HÀNG MỚI VỀ)" value={p.tag} onChange={(tag) => set({ tag })} />
      <NamesInput label="Tiêu đề" value={p.title} onChange={(title) => set({ title })} />
      {promo && <NamesInput label="Dòng nổi bật dưới tiêu đề (màu nhấn, ví dụ NAM)" value={p.highlight} onChange={(highlight) => set({ highlight })} />}
      {promo && <NamesInput label="Nhãn trên ảnh (ví dụ Mẫu hot · Đỏ)" value={p.badge} onChange={(badge) => set({ badge })} />}
      <NamesInput label="Mô tả" value={p.body} onChange={(body) => set({ body })} multiline />
      <NamesInput label="Chữ trên nút" value={p.ctaLabel} onChange={(ctaLabel) => set({ ctaLabel })} />
      <div className="card stack">
        <label htmlFor="poster-href">Nút dẫn tới (ví dụ /san-pham hoặc /bo-suu-tap/…){promo ? ' — trống = trang sản phẩm' : ''}</label>
        <input id="poster-href" value={p.ctaHref} placeholder="/san-pham" onChange={(e) => set({ ctaHref: e.target.value })} />
        <Check label="Hiện trên trang web" checked={p.published} onChange={(published) => set({ published })} />
        <div className="row"><span className="grow">Thứ tự</span><Num label="Thứ tự" value={p.position} onChange={(position) => set({ position })} /></div>
      </div>
    </>
  );
}

/** mode "stats": a manager edits only the number band; the owner edits contacts and figures together. */
function ShopForm({ mode = 'all' }: { mode?: 'all' | 'stats' }) {
  const [s, setS] = useState<Shop | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  // four slots for the number band; empty ones are dropped when saved
  const pad = (x: Shop): Shop => ({ ...x, stats: [...(x.stats ?? []), ...Array.from({ length: 4 }, () => ({ value: '', label: N0() }))].slice(0, 4) });
  useEffect(() => { api<Shop>('GET', '/api/shop').then((x) => setS(pad(x))).catch((e) => setError(e.message)); }, []);
  if (!s) return error ? <p className="error">{error}</p> : <div className="skeleton" style={{ height: 120 }} />;
  const setStat = (i: number, patch: Partial<Stat>) => edit({ stats: s.stats.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const edit = (patch: Partial<Shop>) => { setMsg(''); setS({ ...s, ...patch }); };
  const person = (key: 'ceo' | 'sales', title: string, hint: string) => (
    <fieldset className="card stack">
      <legend>{title}</legend>
      <p className="small muted" style={{ margin: 0 }}>{hint}</p>
      <div><label htmlFor={`shop-${key}-name`}>Tên</label>
        <input id={`shop-${key}-name`} value={s[key].name} placeholder="Để trống nếu chưa muốn hiện tên" onChange={(e) => edit({ [key]: { ...s[key], name: e.target.value } } as Partial<Shop>)} /></div>
      <div><label htmlFor={`shop-${key}-phone`}>Số điện thoại / Zalo</label>
        <input id={`shop-${key}-phone`} type="tel" inputMode="tel" value={s[key].phone} placeholder="012 345 678" onChange={(e) => edit({ [key]: { ...s[key], phone: e.target.value } } as Partial<Shop>)} /></div>
    </fieldset>
  );
  async function save() {
    setError('');
    try { setS(pad(await api<Shop>('PUT', mode === 'stats' ? '/api/shop/stats' : '/api/shop', mode === 'stats' ? { stats: s!.stats } : s))); setMsg('Đã lưu'); } catch (e) { setError(e instanceof ApiError ? e.message : 'Không lưu được'); }
  }
  return (
    <section className="stack">
      {mode === 'all' && <>
      <p className="small muted" style={{ margin: 0 }}>Hiện ở chân trang web. Nút Zalo ở cuối màn hình gọi tới Quản lý bán hàng (chưa có thì Tổng giám đốc).</p>
      {person('ceo', 'Tổng giám đốc', 'Liên hệ cho đối tác, đơn lớn.')}
      {person('sales', 'Quản lý bán hàng', 'Khách hỏi giá, đặt hàng, nhắn Zalo.')}
      <div className="card stack">
        <div><label htmlFor="shop-address">Địa chỉ</label>
          <input id="shop-address" value={s.address} placeholder="Để trống = Phnom Penh, Campuchia" onChange={(e) => edit({ address: e.target.value })} /></div>
        <div><label htmlFor="shop-messenger">Link Messenger (nếu có)</label>
          <input id="shop-messenger" value={s.messenger} placeholder="m.me/hluxury" onChange={(e) => edit({ messenger: e.target.value })} /></div>
      </div>
      </>}
      <fieldset className="card stack">
        <legend>Con số của xưởng</legend>
        <p className="small muted" style={{ margin: 0 }}>Hiện thành dải số vàng trên trang chủ, số tự chạy lên khi khách cuộn tới. Chỉ ghi số thật. Để trống thì dải số tự ẩn.</p>
        {s.stats.map((st, i) => (
          <div key={i} className="stat-row stack">
            <div><label htmlFor={`stat-${i}`}>Số {i + 1}</label>
              <input id={`stat-${i}`} value={st.value} placeholder={['50.000+', '200+', '120', '8 năm'][i]} onChange={(e) => setStat(i, { value: e.target.value })} /></div>
            <NamesInput label={`Ý nghĩa số ${i + 1}, ví dụ "${['đôi mỗi tháng', 'khách sỉ', 'mẫu đang bán', 'kinh nghiệm'][i]}"`} value={st.label} onChange={(label) => setStat(i, { label })} />
          </div>
        ))}
      </fieldset>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success" role="status">{msg}</p>}
      <button type="button" className="btn-primary" onClick={save}>{mode === 'stats' ? 'Lưu con số' : 'Lưu liên hệ và con số'}</button>
    </section>
  );
}

const SECTION_HELP: Record<Section, { hint: string; image: string; caption: string }> = {
  strip: { hint: 'Ảnh chạy vòng từ trái qua phải trên trang chủ. Ảnh dọc (4:5) đẹp nhất.', image: 'Ảnh chạy', caption: 'Chú thích trên ảnh (không bắt buộc)' },
  xuong: { hint: 'Ảnh thật trong xưởng: máy in đế, thợ làm quai, kho dép, đóng gói. Ảnh đầu tiên (thứ tự nhỏ nhất) hiện to nhất. Ảnh ngang đẹp nhất.', image: 'Ảnh xưởng', caption: 'Chú thích, ví dụ "Máy in đế" (không bắt buộc)' },
  giao: { hint: 'Ảnh bao hàng, thùng dép đã đóng gói hoặc xe hàng đi giao. Ghi số đôi và nơi giao để khách sỉ thấy xưởng làm số lượng lớn.', image: 'Ảnh đơn đã giao', caption: 'Chú thích, ví dụ "500 đôi · Siem Reap"' },
};

function GalleryForm({ g, set }: { g: GalleryItem; set: (x: Partial<GalleryItem>) => void }) {
  const help = SECTION_HELP[g.section];
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>{help.hint}</p>
      <div className="card stack"><p className="legend" style={{ margin: 0 }}>Ảnh</p><ImageInput label={help.image} value={g.imageKey || null} onChange={(k) => set({ imageKey: k ?? '' })} /></div>
      <NamesInput label={help.caption} value={g.caption} onChange={(caption) => set({ caption })} />
      <div className="card stack">
        {g.section === 'strip' && <>
          <label htmlFor="gallery-href">Bấm vào ảnh thì mở (không bắt buộc, ví dụ /san-pham/…)</label>
          <input id="gallery-href" value={g.href} placeholder="/san-pham" onChange={(e) => set({ href: e.target.value })} />
        </>}
        <Check label="Hiện trên trang web" checked={g.published} onChange={(published) => set({ published })} />
        <div className="row"><span className="grow">Thứ tự</span><Num label="Thứ tự" value={g.position} onChange={(position) => set({ position })} /></div>
      </div>
    </>
  );
}

const TABS = [['products', 'Sản phẩm'], ['gallery', 'Ảnh chạy'], ['xuong', 'Ảnh xưởng'], ['giao', 'Đơn đã giao'], ['collections', 'Bộ sưu tập'], ['posters', 'Poster'], ['shop', 'Liên hệ & con số']] as const;
const SECTION_OF = { gallery: 'strip', xuong: 'xuong', giao: 'giao' } as const;
type Tab = (typeof TABS)[number][0];

/** Everything the public site shows: products, collections, posters, workshop info. */
export function Content() {
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { if (tab === 'collections' || tab === 'posters') api<Product[]>('GET', '/api/products').then(setProducts).catch(() => {}); }, [tab]);
  return (
    <main className="page">
      <div className="topbar"><h1>Trang web</h1><a className="btn btn-sm" href="/" target="_blank" rel="noreferrer">Xem trang web</a></div>
      <a className="btn-gold publish-entry" href="#/dang-mau">Đăng mẫu mới lên web (ảnh + sản phẩm + poster một lần)</a>
      <div className="seg seg-wrap" role="tablist" aria-label="Nội dung trang web" style={{ marginBottom: 14 }}>
        {TABS.map(([k, label]) => [k, k === 'shop' && !isOwner() ? 'Con số' : label] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'products' && (
        <Crud<Product> key="p" path="/api/products" noun="sản phẩm" title={(x) => x.name.vi} thumb={(x) => x.colors[0]?.imageKey}
          blank={() => ({ name: N0(), desc: N0(), styleId: null, soleId: null, strapId: null, lines: [], isNew: true, published: false, hasBrandLogo: false, position: 0, colors: [] })}
          form={(x, set) => <ProductForm p={x} set={set} />}
          after={(x) => x.published && x.slug ? <a className="btn btn-block" href={`/san-pham/${x.slug}`} target="_blank" rel="noreferrer">Xem trên trang web</a> : null} />
      )}
      {tab === 'collections' && (
        <Crud<Collection> key="c" path="/api/collections" noun="bộ sưu tập" title={(x) => x.title.vi} thumb={(x) => x.coverKey}
          blank={() => ({ title: N0(), subtitle: N0(), coverKey: null, color: '#1b3b2c', published: false, position: 0, productIds: [] })}
          form={(x, set) => <CollectionForm c={x} set={set} products={products} />} />
      )}
      {tab === 'posters' && (
        <Crud<Poster> key="o" path="/api/posters" noun="poster" title={(x) => x.title.vi} thumb={(x) => x.imageKey}
          blank={() => ({ tag: N0(), title: N0(), body: N0(), imageKey: null, ctaLabel: N0(), ctaHref: '', published: false, position: 0,
            layout: 'promo', productId: null, accent: '#E2B65B', highlight: N0(), badge: N0() })}
          form={(x, set) => <PosterForm p={x} set={set} products={products} />} />
      )}
      {(tab === 'gallery' || tab === 'xuong' || tab === 'giao') && (() => {
        const section = SECTION_OF[tab];
        return (
          <Crud<GalleryItem> key={tab} path="/api/gallery" noun="ảnh" title={(x) => x.caption.vi || 'Ảnh không chú thích'} thumb={(x) => x.imageKey}
            filter={(x) => (x.section ?? 'strip') === section}
            blank={() => ({ imageKey: '', caption: N0(), href: '', published: true, position: 0, section })}
            form={(x, set) => <GalleryForm g={x} set={set} />} />
        );
      })()}
      {tab === 'shop' && <ShopForm mode={isOwner() ? 'all' : 'stats'} />}
    </main>
  );
}
