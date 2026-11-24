import { ArrowDown, ArrowUp, Check, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState, type ChangeEvent } from 'react';
import type { LineSetting } from '../../../shared/types';
import { ImageError, sitePhoto } from '../../lib/image';
import { api, ApiError, imgUrl } from '../api';
import { useMaterials, useSettings } from '../catalog';

type Names = { vi: string; en: string; km: string };
const N = (vi = ''): Names => ({ vi, en: '', km: '' });
type Photo = { id: string; name: string; preview: string; key: string | null; error: string; colour: Names };
type Done = { slug: string; published: boolean };

/** Stores one prepared photo as a site picture (pub/…). */
async function uploadPub(blob: Blob, width: number, height: number): Promise<string> {
  const r = await fetch(`/api/content/images?w=${width}&h=${height}`, { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg' } });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error ?? 'Tải ảnh thất bại');
  return data.key;
}

/**
 * "Đăng mẫu lên web": one screen for what used to take three (product, picture strip, poster).
 * Pick several photos at once; each photo becomes one colour of the product.
 */
export function Publish() {
  const settings = useSettings();
  const [materials] = useMaterials();
  const ids = { name: useId(), desc: useId(), style: useId(), tag: useId(), title: useId(), hl: useId() };
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [hero, setHero] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(true);
  const [name, setName] = useState<Names>(N());
  const [desc, setDesc] = useState('');
  const [styleId, setStyleId] = useState('');
  const [lines, setLines] = useState<LineSetting[] | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [logo, setLogo] = useState(false);
  const [toStrip, setToStrip] = useState(true);
  const [poster, setPoster] = useState(true);
  const [tag, setTag] = useState('HÀNG MỚI VỀ');
  const [title, setTitle] = useState('');
  const [highlight, setHighlight] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => { if (settings && lines === null) setLines(settings.lines.map((l) => ({ ...l }))); }, [settings, lines]);

  const update = (id: string, patch: Partial<Photo>) => setPhotos((xs) => xs.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      const id = crypto.randomUUID();
      setPhotos((xs) => [...xs, { id, name: file.name, preview: '', key: null, error: '', colour: N() }]);
      try {
        const { blob, width, height } = await sitePhoto(file, { portrait });
        update(id, { preview: URL.createObjectURL(blob) });
        update(id, { key: await uploadPub(blob, width, height) });
        setHero((h) => h ?? id);
      } catch (err) {
        update(id, { error: err instanceof ImageError ? err.message : err instanceof Error ? err.message : 'Không đọc được ảnh này' });
      }
    }
  }
  const move = (i: number, d: -1 | 1) => setPhotos((xs) => {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const ys = [...xs]; [ys[i], ys[j]] = [ys[j], ys[i]]; return ys;
  });
  const remove = (id: string) => { setPhotos((xs) => xs.filter((p) => p.id !== id)); if (hero === id) setHero(null); };

  const ready = photos.filter((p) => p.key);
  const uploading = photos.some((p) => !p.key && !p.error);

  async function publish() {
    setError('');
    if (!name.vi.trim()) return setError('Nhập tên sản phẩm (tiếng Việt).');
    if (!ready.length) return setError('Chọn ít nhất một ảnh.');
    const unnamed = ready.find((p) => !p.colour.vi.trim());
    if (unnamed) return setError(`Ghi tên màu cho ảnh số ${photos.indexOf(unnamed) + 1}.`);
    if (uploading) return setError('Ảnh đang tải lên, đợi một chút rồi bấm lại.');
    setBusy(true);
    try {
      const heroKey = (ready.find((p) => p.id === hero) ?? ready[0]).key!;
      const product = await api<{ id: string; slug: string }>('POST', '/api/products', {
        name, desc: N(desc.trim()), styleId: styleId || null, soleId: null, strapId: null, lines: (lines ?? []).filter((l) => l.sizeFrom > 0),
        isNew, published: true, hasBrandLogo: logo, position: 0,
        colors: ready.map((p) => ({ name: p.colour, imageKey: p.key, designId: null })),
      });
      // pictures with another brand's logo never go to the public site
      if (!logo && toStrip) {
        for (const [i, p] of ready.entries()) {
          await api('POST', '/api/gallery', { imageKey: p.key, caption: p.colour, href: `/san-pham/${product.slug}`, published: true, position: i });
        }
      }
      if (!logo && poster) {
        await api('POST', '/api/posters', {
          layout: 'promo', productId: product.id, accent: '#E2B65B', published: true, position: 0, imageKey: heroKey,
          tag: N(tag.trim()), title: N((title || name.vi).trim()), highlight: N(highlight.trim()), body: N(desc.trim()),
          badge: N(''), ctaLabel: N('Nhận báo giá'), ctaHref: '',
        });
      }
      setDone({ slug: product.slug, published: !logo });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Đăng không được, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="page">
        <section className="home-hero">
          <p className="home-hero-brand">HLUXURY</p>
          <h1>Đã đăng lên web</h1>
          <p className="home-hero-lead">{done.published ? 'Sản phẩm, ảnh chạy và poster đã hiện trên trang chủ.' : 'Mẫu có logo hãng khác: đã lưu, chỉ khách đã đăng nhập thấy trong thư viện, không lên trang công khai.'}</p>
          <div className="row wrap" style={{ gap: 10 }}>
            {done.published && <a className="btn-gold" href={`/san-pham/${done.slug}`} target="_blank" rel="noreferrer">Xem trên web</a>}
            <button type="button" className="btn-line" onClick={() => window.location.reload()}>Đăng mẫu khác</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page publish with-bar">
      <div className="topbar"><h1>Đăng mẫu lên web</h1><a className="btn btn-sm" href="#/content">Trang web</a></div>
      <p className="small muted" style={{ marginTop: -4 }}>Chọn ảnh, ghi tên màu, bấm Đăng. Mỗi ảnh là một màu của sản phẩm.</p>

      <section className="card stack" aria-label="Ảnh">
        <label className="btn-gold publish-pick" htmlFor="publish-photos"><ImagePlus size={20} aria-hidden="true" /> Chọn ảnh (chọn nhiều ảnh một lần)</label>
        <input id="publish-photos" type="file" accept="image/*" multiple className="visually-hidden" aria-label="Chọn ảnh mẫu" onChange={pick} />
        <label className="check"><input type="checkbox" checked={portrait} onChange={(e) => setPortrait(e.target.checked)} />Tự cắt khung dọc 4:5 và làm ảnh tươi hơn</label>
        {photos.length > 0 && (
          <ol className="publish-photos">
            {photos.map((p, i) => (
              <li key={p.id} className={hero === p.id ? 'is-hero' : ''}>
                <div className="publish-thumb">
                  {p.preview ? <img src={p.preview} alt="" /> : p.key ? <img src={imgUrl(p.key)} alt="" /> : <span className="skeleton" />}
                  {p.key && <span className="publish-ok" aria-label="Đã tải lên"><Check size={14} aria-hidden="true" /></span>}
                </div>
                <div className="stack grow">
                  <label htmlFor={`colour-${p.id}`} className="small">Tên màu – ảnh {i + 1}</label>
                  <input id={`colour-${p.id}`} value={p.colour.vi} placeholder="ví dụ: Xám khuy tán" onChange={(e) => update(p.id, { colour: { ...p.colour, vi: e.target.value } })} />
                  {p.error && <p className="error small" role="alert">{p.error}</p>}
                  <div className="row wrap">
                    <label className="check small"><input type="radio" name="hero" checked={hero === p.id} onChange={() => setHero(p.id)} />Ảnh chính</label>
                    <button type="button" className="icon-btn" aria-label={`Đưa ảnh ${i + 1} lên trước`} onClick={() => move(i, -1)}><ArrowUp size={18} aria-hidden="true" /></button>
                    <button type="button" className="icon-btn" aria-label={`Đưa ảnh ${i + 1} ra sau`} onClick={() => move(i, 1)}><ArrowDown size={18} aria-hidden="true" /></button>
                    <button type="button" className="icon-btn" aria-label={`Bỏ ảnh ${i + 1}`} onClick={() => remove(p.id)}><Trash2 size={18} aria-hidden="true" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card stack" aria-label="Sản phẩm">
        <h2 style={{ margin: 0 }}>Sản phẩm</h2>
        <div><label htmlFor={ids.name}>Tên sản phẩm</label>
          <input id={ids.name} value={name.vi} placeholder="ví dụ: Dép kẹp nam quai da" onChange={(e) => setName({ ...name, vi: e.target.value })} /></div>
        <details>
          <summary className="small">Tên tiếng Anh, tiếng Khmer (không bắt buộc)</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            <input aria-label="Tên sản phẩm (EN)" placeholder="English name" value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} />
            <input aria-label="Tên sản phẩm (KM)" placeholder="ឈ្មោះខ្មែរ" lang="km" value={name.km} onChange={(e) => setName({ ...name, km: e.target.value })} />
          </div>
        </details>
        <div><label htmlFor={ids.desc}>Mô tả ngắn</label>
          <textarea id={ids.desc} value={desc} placeholder="ví dụ: Quai da mềm, đế êm, đi làm đi chơi đều hợp." onChange={(e) => setDesc(e.target.value)} /></div>
        {materials.some((m) => m.kind === 'style' && !m.hidden) && (
          <div><label htmlFor={ids.style}>Kiểu dép</label>
            <select id={ids.style} value={styleId} onChange={(e) => setStyleId(e.target.value)}>
              <option value="">—</option>
              {materials.filter((m) => m.kind === 'style' && !m.hidden).map((m) => <option key={m.id} value={m.id}>{m.nameVi}</option>)}
            </select></div>
        )}
        <fieldset className="flags">
          <legend>Dòng size khách được chọn</legend>
          {lines?.map((l, i) => {
            const on = l.sizeFrom > 0;
            return (
              <div key={l.key} className="row wrap">
                <label className="check grow"><input type="checkbox" checked={on}
                  onChange={(e) => setLines((xs) => xs!.map((x, j) => (j !== i ? x : e.target.checked ? { ...settings!.lines.find((s) => s.key === x.key)! } : { ...x, sizeFrom: 0 })))} />{l.label.vi}</label>
                {on && <>
                  <input aria-label={`Size từ – ${l.label.vi}`} inputMode="numeric" className="num size-box" value={l.sizeFrom}
                    onChange={(e) => setLines((xs) => xs!.map((x, j) => (j === i ? { ...x, sizeFrom: parseInt(e.target.value, 10) || 1 } : x)))} />
                  <span className="small muted">đến</span>
                  <input aria-label={`Size đến – ${l.label.vi}`} inputMode="numeric" className="num size-box" value={l.sizeTo}
                    onChange={(e) => setLines((xs) => xs!.map((x, j) => (j === i ? { ...x, sizeTo: parseInt(e.target.value, 10) || 1 } : x)))} />
                </>}
              </div>
            );
          })}
        </fieldset>
        <label className="check"><input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} />Gắn nhãn MỚI</label>
        <label className="check"><input type="checkbox" checked={logo} onChange={(e) => setLogo(e.target.checked)} />Ảnh có logo hãng khác (chỉ khách đã đăng nhập thấy, không lên trang công khai)</label>
      </section>

      {!logo && (
        <section className="card stack" aria-label="Trang chủ">
          <h2 style={{ margin: 0 }}>Trang chủ</h2>
          <label className="check"><input type="checkbox" checked={toStrip} onChange={(e) => setToStrip(e.target.checked)} />Thêm các ảnh vào dải ảnh chạy</label>
          <label className="check"><input type="checkbox" checked={poster} onChange={(e) => setPoster(e.target.checked)} />Tạo poster quảng cáo</label>
          {poster && (
            <div className="stack publish-poster">
              <div><label htmlFor={ids.tag}>Nhãn nhỏ</label><input id={ids.tag} value={tag} onChange={(e) => setTag(e.target.value)} /></div>
              <div className="row wrap">
                <div className="grow"><label htmlFor={ids.title}>Tiêu đề lớn</label><input id={ids.title} value={title} placeholder="ví dụ: Dép kẹp" onChange={(e) => setTitle(e.target.value)} /></div>
                <div className="grow"><label htmlFor={ids.hl}>Dòng nổi bật (màu vàng)</label><input id={ids.hl} value={highlight} placeholder="ví dụ: Nam" onChange={(e) => setHighlight(e.target.value)} /></div>
              </div>
              <p className="small muted" style={{ margin: 0 }}>Poster tự lấy ảnh chính, số màu, dải size và lưới ảnh các màu.</p>
            </div>
          )}
        </section>
      )}

      {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      <div className="totals-bar">
        <span className="sum">{ready.length} ảnh{uploading ? ' · đang tải…' : ''}</span>
        <button type="button" className="btn-primary" disabled={busy || uploading || !ready.length} onClick={publish}>{busy ? 'Đang đăng…' : 'Đăng lên web'}</button>
      </div>
    </main>
  );
}
