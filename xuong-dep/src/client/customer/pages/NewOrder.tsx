import { BookImage, Package, Palette, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatQty } from '../../../shared/money';
import { itemQty, orderQty } from '../../../shared/totals';
import type { Box, Item, Lang, Line } from '../../../shared/types';
import { CropThumb } from '../../admin/components/CropThumb';
import { ImageTagger } from '../../admin/components/ImageTagger';
import { LineEditor } from '../../admin/components/LineEditor';
import { PhotoPicker, type EditorImage } from '../../admin/components/PhotoPicker';
import { go, type Route } from '../../admin/router';
import { cropToBlob, decodeImage } from '../../lib/image';
import { debounce } from '../../lib/draft';
import { FULL_BOX } from '../../lib/tagger-geometry';
import type { T } from '../../ui/lang';
import { api, ApiError, uploadImage } from '../api';
import { lineText, media, nameIn, useCatalog, type Catalog, type CMaterial, type Names } from '../common';
import { blankItem, clearDraft, currentDraft, emptyDraft, newLine, nextTag, saveDraft, type CDraft } from '../draft';
import { errorText } from './Auth';

type Product = {
  id: string; slug: string; name: Names; lines: { key: string; label: Names; sizeFrom: number; sizeTo: number }[];
  colors: { id: string; name: Names; imageKey: string; designId: string | null }[];
};

const sig = (i: Item) => JSON.stringify([i.imageId, i.crop]);
export const FLASH_SENT = 'c-flash-sent';

/** Items for the chosen colours of a product: one design per colour, the product's size lines ready for counts. */
function productItems(d: CDraft, p: Product, colorIds: string[], lang: Lang): CDraft {
  const next = { ...d, items: [...d.items], titles: { ...d.titles }, labels: { ...d.labels } };
  for (const l of p.lines) next.labels[l.key] ??= l.label;
  for (const cid of colorIds) {
    const c = p.colors.find((x) => x.id === cid);
    if (!c || next.items.some((i) => i.colorId === c.id)) continue;
    const it = blankItem(nextTag(next.items), p.lines.map(newLine), { productId: p.id, colorId: c.id, cropKey: c.imageKey });
    next.items.push(it);
    next.titles[it.id] = `${nameIn(p.name, lang)} · ${nameIn(c.name, lang)}`;
  }
  return next;
}

/** "Đặt lại đơn này": the designs and pair counts of a past order, copied as fresh items (new ids, no prices).
 * The library designs and product colours are reused as they are; the server checks they are still the customer's or still on sale. */
export function reorderItems(d: CDraft, o: { items: Item[]; productTitles?: Record<string, { product: Names; color: Names }> }, lang: Lang): CDraft {
  const next = { ...d, items: [...d.items], titles: { ...d.titles } };
  for (const it of o.items) {
    if (next.items.some((x) => x.designId === it.designId)) continue; // already in this order
    const copy: Item = {
      ...it, id: crypto.randomUUID(), tagNo: nextTag(next.items), imageId: null, crop: null, tapX: null, tapY: null,
      lines: it.lines.map((l) => ({ ...l, id: crypto.randomUUID(), unitPrice: null, perSize: { ...l.perSize } })),
    };
    next.items.push(copy);
    const pt = o.productTitles?.[it.id];
    if (pt) next.titles[copy.id] = `${nameIn(pt.product, lang)} · ${nameIn(pt.color, lang)}`;
  }
  return next;
}

function MaterialSelect({ kind, label, value, materials, lang, any, onChange }: {
  kind: CMaterial['kind']; label: string; value: string | null; materials: CMaterial[]; lang: Lang; any: string; onChange: (v: string | null) => void;
}) {
  const id = useId();
  const list = materials.filter((m) => m.kind === kind);
  return (
    <div className="grow">
      <label htmlFor={id} className="small">{label}</label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{any}</option>
        {list.map((m) => <option key={m.id} value={m.id}>{nameIn(m.name, lang)}</option>)}
      </select>
    </div>
  );
}

function ItemCard({ item, title, image, catalog, labels, t, lang, privateAll, helpId, onChange, onRemove, selected, onSelect }: {
  item: Item; title?: string; image: EditorImage | null; catalog: Catalog | null; labels: Record<string, Names>; t: T; lang: Lang;
  privateAll: boolean; helpId: string; onChange: (i: Item) => void; onRemove: () => void; selected: boolean; onSelect: () => void;
}) {
  const noteId = useId();
  const used = new Set(item.lines.map((l) => l.lineKey));
  const labelOf = (key: string) => nameIn(labels[key] ?? catalog?.lines.find((l) => l.key === key)?.label, lang) || key;
  const setLine = (idx: number, l: Line) => onChange({ ...item, lines: item.lines.map((x, i) => (i === idx ? l : x)) });
  const text = lineText(t);
  return (
    <section aria-label={t('c.design_n', { n: item.tagNo })} className={`card citem${selected ? ' is-selected' : ''}`} onFocusCapture={onSelect}>
      <div className="row">
        <CropThumb image={image} crop={item.crop} cropKey={item.cropKey} urlOf={media} size={72} />
        <div className="grow">
          <h3 style={{ margin: 0 }}>{t('c.design_n', { n: item.tagNo })}</h3>
          {title && <p className="small" style={{ margin: 0 }}>{title}</p>}
          <p className="small muted num" style={{ margin: 0 }}>{t('c.pairs', { n: formatQty(itemQty(item)) })}</p>
        </div>
        <button type="button" className="btn-sm btn-danger" onClick={onRemove}>{t('c.remove_design')}</button>
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        {item.lines.map((l, idx) => (
          <LineEditor key={l.id} line={l} label={labelOf(l.lineKey)} text={text} onChange={(nl) => setLine(idx, nl)}
            onRemove={item.lines.length > 1 ? () => onChange({ ...item, lines: item.lines.filter((_, i) => i !== idx) }) : undefined} />
        ))}
        <div className="row wrap">
          {catalog?.lines.filter((s) => !used.has(s.key)).map((s) => (
            <button key={s.key} type="button" className="btn-sm" onClick={() => onChange({ ...item, lines: [...item.lines, newLine(s)] })}>
              {t('c.add_line', { label: nameIn(s.label, lang) })}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <label htmlFor={noteId} className="small">{t('c.color_note')}</label>
        <input id={noteId} value={item.colorNote} placeholder={t('c.color_ph')} onChange={(e) => onChange({ ...item, colorNote: e.target.value })} />
      </div>
      {!item.productId && catalog && catalog.materials.length > 0 && (
        <details className="mats">
          <summary>{t('c.materials_opt')}</summary>
          <div className="row wrap" style={{ marginTop: 6 }}>
            <MaterialSelect kind="style" label={t('c.style')} value={item.styleId} materials={catalog.materials} lang={lang} any={t('c.any')} onChange={(v) => onChange({ ...item, styleId: v })} />
            <MaterialSelect kind="sole" label={t('c.sole')} value={item.soleId} materials={catalog.materials} lang={lang} any={t('c.any')} onChange={(v) => onChange({ ...item, soleId: v })} />
            <MaterialSelect kind="strap" label={t('c.strap')} value={item.strapId} materials={catalog.materials} lang={lang} any={t('c.any')} onChange={(v) => onChange({ ...item, strapId: v })} />
          </div>
        </details>
      )}
      <label className="check">
        <input type="checkbox" checked={privateAll || !!item.isPrivate} disabled={privateAll} aria-describedby={helpId}
          onChange={(e) => onChange({ ...item, isPrivate: e.target.checked })} />
        {t('c.private_item')}
      </label>
    </section>
  );
}

function ProductSheet({ t, lang, onAdd, onClose }: { t: T; lang: Lang; onAdd: (p: Product, colorIds: string[]) => void; onClose: () => void }) {
  const [list, setList] = useState<Product[] | null>(null);
  const [pick, setPick] = useState<Product | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => { api<Product[]>('GET', '/api/c/products').then(setList, () => setList([])); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t('c.products_title')}>
        <button type="button" className="icon-btn modal-close" aria-label={t('c.close')} onClick={onClose}><X size={20} aria-hidden="true" /></button>
        <h2>{pick ? nameIn(pick.name, lang) : t('c.products_title')}</h2>
        {!list && <div className="skeleton" style={{ height: 160 }} />}
        {list && !pick && (
          <div className="pick-grid">
            {list.map((p) => (
              <button key={p.id} type="button" className="pick-card" onClick={() => { setPick(p); setColors(p.colors[0] ? [p.colors[0].id] : []); }}>
                {p.colors[0] && <img src={media(p.colors[0].imageKey)} alt="" loading="lazy" />}
                <span>{nameIn(p.name, lang)}</span>
              </button>
            ))}
          </div>
        )}
        {pick && (
          <>
            <p className="small muted">{t('pub.pick_colors')}</p>
            <div className="swatches">
              {pick.colors.map((c) => (
                <label key={c.id} className="swatch">
                  <input type="checkbox" checked={colors.includes(c.id)}
                    onChange={(e) => setColors((xs) => (e.target.checked ? [...xs, c.id] : xs.filter((x) => x !== c.id)))} />
                  <img src={media(c.imageKey)} alt="" /><span>{nameIn(c.name, lang)}</span>
                </label>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => setPick(null)}>{t('c.back')}</button>
              <button type="button" className="btn-primary grow" disabled={!colors.length} onClick={() => onAdd(pick, colors)}>
                {t('c.add_n', { n: colors.length })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function NewOrder({ route, t, lang }: { route: Route; t: T; lang: Lang }) {
  const catalog = useCatalog();
  const editId = route.query.get('don');
  const [d, setD] = useState<CDraft | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const uploads = useRef(new Map<string, Promise<string>>());
  const saved = useRef(false);
  const helpId = useId();

  // Start: the order being edited, or the unfinished new order; then whatever the link asks to add.
  useEffect(() => {
    let live = true;
    (async () => {
      if (editId) {
        try {
          const o = await api<any>('GET', `/api/c/orders/${editId}`);
          if (!o.canEdit) { go(`/don/${editId}`); return; }
          const base: CDraft = {
            ...emptyDraft(o.id), editCode: o.code, neededBy: o.neededBy ?? '', note: o.note ?? '', deliverNote: o.deliverNote ?? '',
            images: o.images.map((i: any) => ({ ...i, name: '', url: media(i.key) })), items: o.items,
            cropSigs: Object.fromEntries(o.items.filter((i: Item) => i.cropKey && i.crop).map((i: Item) => [i.id, sig(i)])),
          };
          if (live) setD(base);
        } catch (e) { if (live) setError(errorText(t, e)); }
        return;
      }
      let base = currentDraft() ?? emptyDraft();
      const slug = route.query.get('san-pham');
      if (slug) {
        try {
          const p = await api<Product>('GET', `/api/c/products/${encodeURIComponent(slug)}`);
          const wanted = (route.query.get('mau') ?? '').split(',').filter(Boolean);
          base = productItems(base, p, wanted.length ? wanted : p.colors.slice(0, 1).map((c) => c.id), lang);
          saveDraft(base);
        } catch { /* product gone: keep the draft as it is */ }
        history.replaceState(null, '', '#/dat-hang'); // a reload must not add the colours twice
      }
      const again = route.query.get('dat-lai');
      if (again) {
        try {
          const o = await api<any>('GET', `/api/c/orders/${encodeURIComponent(again)}`);
          const before = base.items.length;
          base = reorderItems(base, o, lang);
          saveDraft(base);
          if (live) setNotice(t('c.reordered', { n: base.items.length - before, code: o.code }));
        } catch (e) { if (live) setError(errorText(t, e)); }
        history.replaceState(null, '', '#/dat-hang'); // a reload must not copy the order twice
      }
      if (live) setD(base);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const persist = useMemo(() => debounce((st: CDraft) => { if (!saved.current) saveDraft(st); }, 400), []);
  useEffect(() => { if (d && !saved.current && (d.items.length || d.images.length || d.editCode)) persist(d); }, [d, persist]);
  const latest = useRef<CDraft | null>(null);
  latest.current = d;
  // leaving the page (e.g. to the library) writes the pending changes right away
  useEffect(() => () => {
    persist.cancel();
    const st = latest.current;
    if (st && !saved.current && (st.items.length || st.images.length || st.editCode)) saveDraft(st);
  }, [persist]);

  const update = (fn: (s: CDraft) => CDraft) => setD((s) => (s ? fn(s) : s));

  if (!d) return <main className="page"><div className="skeleton" style={{ height: 220 }} />{error && <p className="error">{error}</p>}</main>;

  function startUpload(img: EditorImage) {
    if (!img.blob) return;
    const p = uploadImage(img.blob, img.width, img.height, img.id).then((r) => {
      update((s) => ({ ...s, images: s.images.map((x) => (x.id === img.id ? { ...x, key: r.key, uploadError: undefined } : x)) }));
      return r.key;
    });
    p.catch(() => update((s) => ({ ...s, images: s.images.map((x) => (x.id === img.id ? { ...x, uploadError: t('c.upload_fail') } : x)) })));
    uploads.current.set(img.id, p);
  }

  function addTag(imageId: string, tap: { x: number; y: number } | null, crop: Box) {
    update((s) => {
      const tagNo = nextTag(s.items);
      setSelected(tagNo);
      const prev = s.items[s.items.length - 1];
      const lines = prev?.lines.length
        ? prev.lines.map((l) => ({ ...l, id: crypto.randomUUID(), qtyEach: 0, perSize: {}, unitPrice: null }))
        : catalog?.lines[0] ? [newLine(catalog.lines[0])] : [];
      return { ...s, items: [...s.items, blankItem(tagNo, lines, { imageId, tapX: tap?.x ?? null, tapY: tap?.y ?? null, crop })] };
    });
  }

  const imageOf = (id: string | null) => d.images.find((i) => i.id === id) ?? null;
  const total = orderQty(d.items);

  async function keyOf(img: EditorImage): Promise<string> {
    if (img.key) return img.key;
    const pending = uploads.current.get(img.id);
    if (pending) { try { return await pending; } catch { /* retry below */ } }
    if (!img.blob) throw new ApiError(0, t('c.upload_fail'));
    return (await uploadImage(img.blob, img.width, img.height, img.id)).key;
  }

  async function send() {
    if (!d) return;
    setError('');
    if (!d.items.length) return setError(t('c.empty_order'));
    const min = catalog?.minOrderPairs ?? 0;
    if (orderQty(d.items) < min) return setError(t('c.need_more', { n: formatQty(min - orderQty(d.items)), min: formatQty(min) }));
    const empty = d.items.find((i) => itemQty(i) === 0);
    if (empty) { setSelected(empty.tagNo); return setError(t('c.no_pairs', { n: empty.tagNo })); }
    setSaving(true);
    try {
      const images = [];
      for (const img of d.images) images.push({ id: img.id, key: await keyOf(img), width: img.width, height: img.height });
      const sources = new Map<string, ReturnType<typeof decodeImage>>();
      const cropSigs = { ...d.cropSigs };
      const items: Item[] = [];
      for (const it of d.items) {
        const img = imageOf(it.imageId);
        if (img && it.crop && (!it.cropKey || cropSigs[it.id] !== sig(it))) {
          if (!sources.has(img.id)) {
            const blob = img.blob ?? await (await fetch(media(images.find((x) => x.id === img.id)!.key))).blob();
            sources.set(img.id, decodeImage(blob));
          }
          const crop = await cropToBlob(await sources.get(img.id)!, it.crop);
          const up = await uploadImage(crop, Math.max(1, Math.round(it.crop.w * img.width)), Math.max(1, Math.round(it.crop.h * img.height)));
          items.push({ ...it, cropKey: up.key });
          cropSigs[it.id] = sig(it);
        } else {
          items.push(it);
        }
      }
      update((s) => ({ ...s, items, cropSigs }));
      await api('PUT', `/api/c/orders/${d.id}`, {
        neededBy: d.neededBy || null, note: d.note, deliverNote: d.deliverNote, isPrivate: d.privateAll, images, items,
      });
      saved.current = true;
      persist.cancel();
      clearDraft(d.id);
      try { sessionStorage.setItem(FLASH_SENT, d.id); } catch { /* flash is optional */ }
      go(`/don/${d.id}`);
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!d || !window.confirm(t('c.discard_q'))) return;
    persist.cancel();
    clearDraft(d.id);
    setD(emptyDraft());
  }

  return (
    <main className="page with-bar">
      <div className="topbar">
        <h1>{d.editCode ? t('c.edit_title', { code: d.editCode }) : t('c.new_title')}</h1>
        {!d.editCode && (d.items.length > 0 || d.images.length > 0) && (
          <button type="button" className="btn-sm btn-ghost" onClick={discard}>{t('c.discard')}</button>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>{t('c.no_price_note')}</p>
      {notice && <p className="success" role="status">{notice}</p>}

      <section className="card stack" aria-label={t('c.add_designs')}>
        <h2 style={{ margin: 0 }}>{t('c.add_designs')}</h2>
        <PhotoPicker label={t('c.add_photo')} busyText={(n) => t('c.photo_busy', { n })} badText={(name) => t('c.photo_bad', { name })}
          onAdded={(img) => { update((s) => ({ ...s, images: [...s.images, img] })); startUpload(img); }} />
        <div className="row">
          <button type="button" className="btn grow" onClick={() => setSheet(true)}><Package size={18} aria-hidden="true" /> {t('c.add_product')}</button>
          <a className="btn grow" href="#/thu-vien"><BookImage size={18} aria-hidden="true" /> {t('c.add_library')}</a>
        </div>
        <a className="btn btn-gold-soft" href="#/tu-phoi"><Palette size={18} aria-hidden="true" /> {t('d.entry')}</a>
      </section>

      {d.images.map((img) => (
        <section key={img.id} style={{ marginTop: 16 }} aria-label={img.name || 'photo'}>
          <ImageTagger image={img} tags={d.items.filter((i) => i.imageId === img.id)} selected={selected}
            text={{ hint: t('c.tag_hint'), whole: t('c.whole') }}
            onAdd={(tap, box) => addTag(img.id, tap, box)} onSelect={setSelected}
            onBoxChange={(tagNo, crop) => update((s) => ({ ...s, items: s.items.map((i) => (i.tagNo === tagNo ? { ...i, crop } : i)) }))}
            onWholeImage={() => addTag(img.id, null, FULL_BOX)} />
          {img.uploadError && <p className="error">{img.uploadError}</p>}
          {d.items.every((i) => i.imageId !== img.id) && (
            <button type="button" className="btn-sm btn-ghost" onClick={() => update((s) => ({ ...s, images: s.images.filter((x) => x.id !== img.id) }))}>{t('c.remove_photo')}</button>
          )}
        </section>
      ))}

      {d.items.length === 0 && <p className="empty-note">{t('c.empty_order')}</p>}
      {d.items.map((it) => (
        <ItemCard key={it.id} item={it} title={d.titles[it.id]} image={imageOf(it.imageId)} catalog={catalog} labels={d.labels} t={t} lang={lang}
          privateAll={d.privateAll} helpId={helpId} selected={selected === it.tagNo} onSelect={() => setSelected(it.tagNo)}
          onChange={(ni) => update((s) => ({ ...s, items: s.items.map((x) => (x.id === ni.id ? ni : x)) }))}
          onRemove={() => update((s) => ({ ...s, items: s.items.filter((x) => x.id !== it.id) }))} />
      ))}

      <section className="card stack" style={{ marginTop: 16 }} aria-label={t('c.order_info')}>
        <h2 style={{ margin: 0 }}>{t('c.order_info')}</h2>
        <div>
          <label htmlFor="co-deliver">{t('c.deliver')}</label>
          <input id="co-deliver" value={d.deliverNote} placeholder={t('c.deliver_ph')} onChange={(e) => update((s) => ({ ...s, deliverNote: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="co-date">{t('c.needed_by')}</label>
          <input id="co-date" type="date" value={d.neededBy} onChange={(e) => update((s) => ({ ...s, neededBy: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="co-note">{t('c.note')}</label>
          <textarea id="co-note" value={d.note} onChange={(e) => update((s) => ({ ...s, note: e.target.value }))} />
        </div>
        <div>
          <label className="check">
            <input type="checkbox" checked={d.privateAll} aria-describedby={helpId} onChange={(e) => update((s) => ({ ...s, privateAll: e.target.checked }))} />
            {t('c.private_all')}
          </label>
          <p id={helpId} className="small muted" style={{ margin: 0 }}>{t('c.private_help')}</p>
        </div>
      </section>

      {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      {sheet && <ProductSheet t={t} lang={lang} onClose={() => setSheet(false)}
        onAdd={(p, ids) => { setSheet(false); update((s) => productItems(s, p, ids, lang)); }} />}

      <div className="totals-bar">
        <span className="sum num">{t('c.total', { n: formatQty(total) })}
          {!!catalog?.minOrderPairs && <small className={`min-note${total < catalog.minOrderPairs ? ' short' : ''}`}>{t('c.min_note', { min: formatQty(catalog.minOrderPairs) })}</small>}
        </span>
        <button type="button" className="btn-lime" disabled={saving} onClick={send}>
          {saving ? t('c.sending') : d.editCode ? t('c.save') : t('c.send')}
        </button>
      </div>
    </main>
  );
}
