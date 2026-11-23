import { useEffect, useMemo, useRef, useState } from 'react';
import { formatQty } from '../../../shared/money';
import { qtyPriceLocked, STATUS_LABEL_VI } from '../../../shared/status';
import { orderQty } from '../../../shared/totals';
import type { Box, Currency, Item, OrderStatus } from '../../../shared/types';
import { cropToBlob, decodeImage } from '../../lib/image';
import { clearDraft, debounce, loadDraft, pendingNewOrderId, saveDraft } from '../../lib/draft';
import { FULL_BOX, nextTagNo } from '../../lib/tagger-geometry';
import { api, ApiError, imgUrl, uploadImage } from '../api';
import { useMaterials, useSettings, type Design, type Settings } from '../catalog';
import { CustomerPicker, type CustomerLite } from '../components/CustomerPicker';
import { DesignPicker } from '../components/DesignPicker';
import { ImageTagger } from '../components/ImageTagger';
import { ItemForm, newLine } from '../components/ItemForm';
import { PhotoPicker, type EditorImage } from '../components/PhotoPicker';
import { go } from '../router';

type State = {
  id: string;
  isNew: boolean;
  libraryOnly: boolean;
  customer: CustomerLite | null;
  currency: Currency;
  neededBy: string;
  note: string;
  allowPublic: boolean;
  images: EditorImage[];
  items: Item[];
  /** item id → [imageId, crop] the stored crop was made from; skip re-uploading unchanged crops. */
  cropSigs: Record<string, string>;
  status?: OrderStatus;
};

const sig = (i: Item) => JSON.stringify([i.imageId, i.crop]);

function emptyState(id: string): State {
  return { id, isNew: true, libraryOnly: false, customer: null, currency: 'VND', neededBy: '', note: '', allowPublic: false, images: [], items: [], cropSigs: {} };
}

/** What goes to localStorage: no blobs; photos not yet stored can't survive a reload. */
function toDraft(s: State): State {
  const images = s.images.filter((i) => i.key).map(({ blob: _b, ...i }) => ({ ...i, url: imgUrl(i.key!) }));
  const ids = new Set(images.map((i) => i.id));
  return { ...s, images, items: s.items.filter((i) => !i.imageId || ids.has(i.imageId)) };
}

/** A new tag copies the previous design's materials and line layout, with counts at 0. */
function itemFor(prev: Item | undefined, settings: Settings | null, base: Partial<Item>, tagNo: number): Item {
  const lines = prev?.lines.length
    ? prev.lines.map((l) => ({ ...l, id: crypto.randomUUID(), qtyEach: 0, perSize: {}, unitPrice: null }))
    : [newLine(settings, settings?.lines[0]?.key ?? 'nam')];
  return {
    id: crypto.randomUUID(), designId: crypto.randomUUID(), imageId: null, tagNo, tapX: null, tapY: null, crop: null, cropKey: '',
    soleId: prev?.soleId ?? null, strapId: prev?.strapId ?? null, styleId: prev?.styleId ?? null, colorNote: '', lines, ...base,
  };
}

export function OrderEditor({ orderId, designId, libraryOnly }: { orderId?: string; designId?: string | null; libraryOnly?: boolean }) {
  const settings = useSettings();
  const [materials, reloadMaterials] = useMaterials();
  const [s, setS] = useState<State | null>(orderId ? null : { ...emptyState(crypto.randomUUID()), libraryOnly: !!libraryOnly });
  const [offer, setOffer] = useState<State | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const uploads = useRef(new Map<string, Promise<string>>());
  const touched = useRef(false);

  // Load the order (edit) or look for an unfinished new order (draft).
  useEffect(() => {
    if (orderId) {
      api<any>('GET', `/api/orders/${orderId}`).then((o) => {
        const fromServer: State = {
          id: o.id, isNew: false, libraryOnly: false, customer: o.customer, currency: o.currency, neededBy: o.neededBy ?? '',
          note: o.note, allowPublic: o.allowPublic, status: o.status,
          images: o.images.map((i: any) => ({ ...i, name: '', url: imgUrl(i.key) })),
          items: o.items, cropSigs: Object.fromEntries(o.items.filter((i: Item) => i.cropKey && i.crop).map((i: Item) => [i.id, sig(i)])),
        };
        setS(fromServer);
        const d = loadDraft<State>(orderId);
        if (d) setOffer(d);
      }).catch((e) => setError(e instanceof ApiError ? e.message : 'Không tải được đơn'));
    } else {
      const pending = pendingNewOrderId();
      const d = pending ? loadDraft<State>(pending) : null;
      if (d && (d.items.length || d.images.length || d.customer)) setOffer(d);
    }
  }, [orderId]);

  // "Tạo đơn từ mẫu này"
  useEffect(() => {
    if (!designId || orderId) return;
    api<Design>('GET', `/api/designs/${designId}`).then((d) => addFromLibrary(d)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId, settings]);

  const persist = useMemo(() => debounce((st: State) => saveDraft(st.id, toDraft(st), st.isNew), 500), []);
  useEffect(() => { if (s && touched.current) persist(s); }, [s, persist]);

  const update = (fn: (st: State) => State) => { touched.current = true; setS((st) => (st ? fn(st) : st)); };

  function startUpload(img: EditorImage) {
    if (!img.blob) return;
    const p = uploadImage(img.blob, img.width, img.height, img.id).then((r) => {
      update((st) => ({ ...st, images: st.images.map((x) => (x.id === img.id ? { ...x, key: r.key, uploadError: undefined } : x)) }));
      return r.key;
    });
    p.catch((e) => update((st) => ({ ...st, images: st.images.map((x) => (x.id === img.id ? { ...x, uploadError: e.message } : x)) })));
    uploads.current.set(img.id, p);
  }

  function addTag(imageId: string, tap: { x: number; y: number } | null, crop: Box) {
    update((st) => {
      const tagNo = nextTagNo(st.items);
      setSelected(tagNo);
      const item = itemFor(st.items[st.items.length - 1], settings, { imageId, tapX: tap?.x ?? null, tapY: tap?.y ?? null, crop }, tagNo);
      return { ...st, items: [...st.items, item] };
    });
  }

  function addFromLibrary(d: Design) {
    setPicking(false);
    update((st) => {
      const tagNo = nextTagNo(st.items);
      const item = itemFor(undefined, settings, {
        designId: d.id, cropKey: d.cropKey, soleId: d.soleId, strapId: d.strapId, styleId: d.styleId,
      }, tagNo);
      if (st.items.some((i) => i.designId === d.id)) return st;
      setSelected(tagNo);
      return { ...st, items: [...st.items, item] };
    });
  }

  if (!s) {
    return <main className="page"><h1>Sửa đơn</h1>{error ? <p className="error">{error}</p> : <p className="muted">Đang tải…</p>}</main>;
  }

  const locked = !!s.status && qtyPriceLocked(s.status);
  const total = orderQty(s.items);
  const imageOf = (id: string | null) => s.images.find((i) => i.id === id) ?? null;

  async function keyOf(img: EditorImage): Promise<string> {
    if (img.key) return img.key;
    const pending = uploads.current.get(img.id);
    if (pending) { try { return await pending; } catch { /* retry below */ } }
    if (!img.blob) throw new ApiError(0, 'Ảnh chưa tải lên được, vui lòng chọn lại ảnh');
    return (await uploadImage(img.blob, img.width, img.height, img.id)).key;
  }

  async function save() {
    if (!s) return;
    setError('');
    if (!s.libraryOnly && !s.customer) return setError('Chọn khách trước khi lưu');
    if (s.items.length === 0) return setError('Chưa có mẫu nào: chọn ảnh rồi chạm vào từng đôi dép');
    setSaving(true);
    try {
      const images = [];
      for (const img of s.images) images.push({ id: img.id, key: await keyOf(img), width: img.width, height: img.height });
      const sources = new Map<string, Promise<Awaited<ReturnType<typeof decodeImage>>>>();
      const cropSigs = { ...s.cropSigs };
      const items: Item[] = [];
      for (const it of s.items) {
        const img = imageOf(it.imageId);
        if (img && it.crop && (!it.cropKey || cropSigs[it.id] !== sig(it))) {
          if (!sources.has(img.id)) {
            const blob = img.blob ?? await (await fetch(imgUrl(images.find((x) => x.id === img.id)!.key))).blob();
            sources.set(img.id, decodeImage(blob));
          }
          const crop = await cropToBlob(await sources.get(img.id)!, it.crop);
          const up = await uploadImage(crop, Math.round(it.crop.w * img.width), Math.round(it.crop.h * img.height));
          items.push({ ...it, cropKey: up.key });
          cropSigs[it.id] = sig(it);
        } else {
          items.push(it);
        }
      }
      update((st) => ({ ...st, items, cropSigs })); // keep uploaded crops if the order save fails
      if (s.libraryOnly) {
        await api('POST', '/api/library', { images, items });
        clearDraft(s.id);
        go('/library');
      } else {
        await api('PUT', `/api/orders/${s.id}`, {
          customerId: s.customer!.id, currency: s.currency, neededBy: s.neededBy || null, note: s.note,
          allowPublic: s.allowPublic, images, items,
        });
        clearDraft(s.id);
        go(`/orders/${s.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lưu không được, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page with-bar">
      <div className="topbar">
        <h1>{s.isNew ? 'Đơn mới' : 'Sửa đơn'}</h1>
        {s.status && <span className={`badge s-${s.status}`}>{STATUS_LABEL_VI[s.status]}</span>}
      </div>

      {offer && (
        <div className="notice" role="alert" style={{ marginBottom: 12 }}>
          <p style={{ marginTop: 0 }}><strong>Tiếp tục đơn đang nhập dở?</strong></p>
          <div className="row">
            <button type="button" className="btn-primary btn-sm" onClick={() => { setS({ ...offer, isNew: s.isNew }); setOffer(null); touched.current = true; }}>Tiếp tục</button>
            <button type="button" className="btn-sm" onClick={() => { clearDraft(offer.id); setOffer(null); }}>Bỏ bản nháp</button>
          </div>
        </div>
      )}

      {locked && <p className="notice">{s.status === 'da_huy' ? 'Đơn đã hủy, không sửa số lượng/giá được' : 'Đơn đang sản xuất, không sửa số lượng/giá được'}. Vẫn sửa được ghi chú và ngày cần hàng.</p>}

      {s.isNew && (
        <label className="check">
          <input type="checkbox" checked={s.libraryOnly} onChange={(e) => update((st) => ({ ...st, libraryOnly: e.target.checked }))} />
          Chỉ lưu vào thư viện (không tạo đơn)
        </label>
      )}

      {!s.libraryOnly && (
        <CustomerPicker value={s.customer} disabled={locked}
          onChange={(c) => update((st) => ({ ...st, customer: c, currency: c && st.isNew && !st.items.some((i) => i.lines.some((l) => l.unitPrice != null)) ? c.currency : st.currency }))} />
      )}

      {!locked && (
        <div className="stack" style={{ marginTop: 12 }}>
          <PhotoPicker onAdded={(img) => { update((st) => ({ ...st, images: [...st.images, img] })); startUpload(img); }} />
          {!s.libraryOnly && <button type="button" className="btn-block" onClick={() => setPicking(true)}>+ Mẫu từ thư viện</button>}
        </div>
      )}

      {s.images.map((img) => (
        <section key={img.id} style={{ marginTop: 16 }} aria-label={`Ảnh ${img.name}`}>
          <ImageTagger image={img} readOnly={locked}
            tags={s.items.filter((i) => i.imageId === img.id)} selected={selected}
            onAdd={(tap, box) => addTag(img.id, tap, box)} onSelect={setSelected}
            onBoxChange={(tagNo, crop) => update((st) => ({ ...st, items: st.items.map((i) => (i.tagNo === tagNo ? { ...i, crop } : i)) }))}
            onWholeImage={() => addTag(img.id, null, FULL_BOX)} />
          {img.uploadError && <p className="error">{img.uploadError} — ảnh sẽ được tải lại khi bấm Lưu.</p>}
          {!locked && s.items.every((i) => i.imageId !== img.id) && (
            <button type="button" className="btn-sm btn-ghost" onClick={() => update((st) => ({ ...st, images: st.images.filter((x) => x.id !== img.id) }))}>Bỏ ảnh này</button>
          )}
        </section>
      ))}

      {s.items.map((it) => (
        <ItemForm key={it.id} item={it} image={imageOf(it.imageId)} settings={settings} materials={materials} reloadMaterials={reloadMaterials}
          selected={selected === it.tagNo} onSelect={() => setSelected(it.tagNo)} locked={locked} libraryOnly={s.libraryOnly}
          onChange={(ni) => update((st) => ({ ...st, items: st.items.map((x) => (x.id === ni.id ? ni : x)) }))}
          onRemove={() => update((st) => ({ ...st, items: st.items.filter((x) => x.id !== it.id) }))} />
      ))}

      {!s.libraryOnly && (
        <section className="card stack" style={{ marginTop: 16 }} aria-label="Thông tin đơn">
          <h2 style={{ margin: 0 }}>Thông tin đơn</h2>
          <div className="row">
            <div className="grow">
              <label htmlFor="ord-cur">Loại tiền</label>
              <select id="ord-cur" value={s.currency} disabled={locked} onChange={(e) => update((st) => ({ ...st, currency: e.target.value as Currency }))}>
                <option value="VND">VND (₫)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div className="grow">
              <label htmlFor="ord-date">Ngày cần hàng</label>
              <input id="ord-date" type="date" value={s.neededBy} onChange={(e) => update((st) => ({ ...st, neededBy: e.target.value }))} />
            </div>
          </div>
          <div>
            <label htmlFor="ord-note">Ghi chú chung</label>
            <textarea id="ord-note" value={s.note} onChange={(e) => update((st) => ({ ...st, note: e.target.value }))} />
          </div>
          <label className="check">
            <input type="checkbox" checked={s.allowPublic} onChange={(e) => update((st) => ({ ...st, allowPublic: e.target.checked }))} />
            Cho khách xem mẫu này (thư viện cho khách, giai đoạn 2)
          </label>
        </section>
      )}

      {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      {picking && <DesignPicker onPick={addFromLibrary} onClose={() => setPicking(false)} />}

      <div className="totals-bar">
        <span className="sum num">{s.libraryOnly ? `${s.items.length} mẫu` : `Tổng: ${formatQty(total)} đôi`}</span>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Đang lưu…' : s.libraryOnly ? 'Lưu vào thư viện' : 'Lưu'}
        </button>
      </div>
    </main>
  );
}
