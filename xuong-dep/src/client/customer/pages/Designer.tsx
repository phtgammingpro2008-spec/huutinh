import { Check, ImagePlus, Shuffle } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import type { Lang } from '../../../shared/types';
import { go } from '../../admin/router';
import type { T } from '../../ui/lang';
import { uploadImage } from '../api';
import { nameIn, useCatalog, type Names } from '../common';
import { blankItem, currentDraft, emptyDraft, newLine, nextTag, saveDraft } from '../draft';
import { errorText } from './Auth';

/** Named colours, so the workshop reads "quai Đỏ" rather than a hex code. */
export const PALETTE: { hex: string; name: Names }[] = [
  { hex: '#111111', name: { vi: 'Đen', en: 'Black', km: 'ខ្មៅ' } },
  { hex: '#F7F5EF', name: { vi: 'Trắng', en: 'White', km: 'ស' } },
  { hex: '#E9DCC3', name: { vi: 'Kem', en: 'Cream', km: 'ក្រែម' } },
  { hex: '#8A8D91', name: { vi: 'Xám', en: 'Grey', km: 'ប្រផេះ' } },
  { hex: '#6B4A2E', name: { vi: 'Nâu', en: 'Brown', km: 'ត្នោត' } },
  { hex: '#D7262E', name: { vi: 'Đỏ', en: 'Red', km: 'ក្រហម' } },
  { hex: '#F08A24', name: { vi: 'Cam', en: 'Orange', km: 'ទឹកក្រូច' } },
  { hex: '#F4C430', name: { vi: 'Vàng', en: 'Yellow', km: 'លឿង' } },
  { hex: '#E2B65B', name: { vi: 'Vàng đồng', en: 'Gold', km: 'មាស' } },
  { hex: '#4E6B3A', name: { vi: 'Xanh rêu', en: 'Olive', km: 'បៃតងអូលីវ' } },
  { hex: '#2FA45A', name: { vi: 'Xanh lá', en: 'Green', km: 'បៃតង' } },
  { hex: '#3FA7D6', name: { vi: 'Xanh da trời', en: 'Sky blue', km: 'ខៀវផ្ទៃមេឃ' } },
  { hex: '#1F4FA8', name: { vi: 'Xanh dương', en: 'Blue', km: 'ខៀវ' } },
  { hex: '#1B2A4A', name: { vi: 'Xanh navy', en: 'Navy', km: 'ខៀវចាស់' } },
  { hex: '#F28DB2', name: { vi: 'Hồng', en: 'Pink', km: 'ផ្កាឈូក' } },
  { hex: '#7A4FB5', name: { vi: 'Tím', en: 'Purple', km: 'ស្វាយ' } },
];
const colourName = (hex: string, lang: Lang) => nameIn(PALETTE.find((c) => c.hex === hex)?.name, lang) || hex;

export const PATTERNS = ['none', 'stripes', 'dots', 'checks', 'waves', 'photo'] as const;
type Pattern = (typeof PATTERNS)[number];

export type Design = {
  top: string; edge: string; strap: string; pattern: Pattern; patternColour: string; photo: string | null; text: string;
};
const START: Design = { top: '#E9DCC3', edge: '#111111', strap: '#D7262E', pattern: 'none', patternColour: '#111111', photo: null, text: '' };

/** Black or white, whichever reads better on `hex`. */
function ink(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#111111' : '#F7F5EF';
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SOLE = 'M0 -128c40 0 62 34 62 84 0 44-14 70-20 108-6 34-20 52-42 52s-36-18-42-52c-6-38-20-64-20-108 0-50 22-84 62-84z';

function patternDef(d: Design): string {
  const c = d.patternColour;
  switch (d.pattern) {
    case 'stripes': return `<pattern id="pt" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="8" height="18" fill="${c}"/></pattern>`;
    case 'dots': return `<pattern id="pt" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="4" fill="${c}"/><circle cx="15" cy="15" r="4" fill="${c}"/></pattern>`;
    case 'checks': return `<pattern id="pt" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${c}" opacity=".55"/><rect x="12" y="12" width="12" height="12" fill="${c}" opacity=".55"/></pattern>`;
    case 'waves': return `<pattern id="pt" width="28" height="14" patternUnits="userSpaceOnUse"><path d="M0 7q7-7 14 0t14 0" fill="none" stroke="${c}" stroke-width="3"/></pattern>`;
    default: return '';
  }
}

/** The pair as an SVG string: used for the live preview and, rasterised, as the order picture. */
export function designSvg(d: Design, w = 360, h = 320): string {
  const fill = d.pattern === 'photo' && d.photo
    ? `<image href="${d.photo}" x="-62" y="-128" width="124" height="264" preserveAspectRatio="xMidYMid slice" clip-path="url(#cl)"/>`
    : d.pattern !== 'none' && d.pattern !== 'photo' ? `<path d="${SOLE}" fill="url(#pt)"/>` : '';
  const text = d.text.trim().slice(0, 18);
  const size = Math.min(15, Math.max(8, 120 / Math.max(1, text.length)));
  const sole = (x: number) => `<g transform="translate(${x} 160)">
<path d="${SOLE}" fill="${d.edge}" stroke="${d.edge}" stroke-width="12" stroke-linejoin="round"/>
<path d="${SOLE}" fill="${d.top}"/>${fill}
${text ? `<text x="0" y="96" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${size}" letter-spacing="1" fill="${ink(d.top)}" stroke="${d.top}" stroke-width="3" paint-order="stroke">${esc(text)}</text>` : ''}
<path d="M0 -78c-8 38-36 66-56 82M0 -78c8 38 36 66 56 82" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="17" stroke-linecap="round" transform="translate(0 3)"/>
<path d="M0 -78c-8 38-36 66-56 82M0 -78c8 38 36 66 56 82" fill="none" stroke="${d.strap}" stroke-width="13" stroke-linecap="round"/>
<circle cx="0" cy="-78" r="8" fill="${d.strap}" stroke="rgba(0,0,0,.3)" stroke-width="2"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 320" width="${w}" height="${h}">
<defs><clipPath id="cl"><path d="${SOLE}"/></clipPath>${patternDef(d)}</defs>
<rect width="360" height="320" fill="#F2EEE5"/>${sole(105)}${sole(255)}</svg>`;
}

/** Draws the SVG onto a canvas and returns a JPEG for upload. */
async function rasterise(svg: string, w: number, h: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('canvas'))), 'image/jpeg', 0.9));
  } finally { URL.revokeObjectURL(url); }
}

/** A customer photo shrunk to a small JPEG data URL, so it can sit inside the SVG. */
async function photoData(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 700 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

/** What the workshop reads under the picture. */
export function designNote(d: Design, t: T, lang: Lang): string {
  const parts = [
    `${t('d.top')}: ${colourName(d.top, lang)}`, `${t('d.edge')}: ${colourName(d.edge, lang)}`, `${t('d.strap_colour')}: ${colourName(d.strap, lang)}`,
  ];
  if (d.pattern !== 'none') parts.push(`${t('d.pattern')}: ${t(`d.p_${d.pattern}` as never)}${d.pattern !== 'photo' ? ` (${colourName(d.patternColour, lang)})` : ''}`);
  if (d.text.trim()) parts.push(`${t('d.text')}: "${d.text.trim().slice(0, 18)}"`);
  return `${t('d.note_prefix')} · ${parts.join(' · ')}`;
}

function Swatches({ label, value, onChange, lang }: { label: string; value: string; onChange: (hex: string) => void; lang: Lang }) {
  const id = useId();
  return (
    <fieldset className="d-field">
      <legend id={id}>{label}: <strong>{colourName(value, lang)}</strong></legend>
      <div className="d-swatches" role="radiogroup" aria-labelledby={id}>
        {PALETTE.map((c) => (
          <button key={c.hex} type="button" role="radio" aria-checked={value === c.hex} aria-label={nameIn(c.name, lang)} title={nameIn(c.name, lang)}
            className="d-swatch" style={{ background: c.hex }} onClick={() => onChange(c.hex)}>
            {value === c.hex && <Check size={16} color={ink(c.hex)} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** "Tự phối mẫu": the customer picks sole, edge and strap colours, a pattern or own picture and a print, sees the pair live,
 * and adds it to the order as a new design the workshop prices like any other. */
export function Designer({ t, lang }: { t: T; lang: Lang }) {
  const catalog = useCatalog();
  const [d, setD] = useState<Design>(START);
  const [soleId, setSoleId] = useState<string | null>(null);
  const [strapId, setStrapId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const svg = useMemo(() => designSvg(d), [d]);
  const set = (p: Partial<Design>) => { setError(''); setD((x) => ({ ...x, ...p })); };

  function shuffle() {
    const pick = () => PALETTE[Math.floor(Math.random() * PALETTE.length)].hex;
    const pats = PATTERNS.filter((p) => p !== 'photo');
    set({ top: pick(), edge: pick(), strap: pick(), patternColour: pick(), pattern: pats[Math.floor(Math.random() * pats.length)] });
  }

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    try { set({ photo: await photoData(f), pattern: 'photo' }); } catch { setError(t('d.photo_bad')); }
  }

  async function add() {
    setBusy(true); setError('');
    try {
      const blob = await rasterise(designSvg(d, 1080, 960), 1080, 960);
      const up = await uploadImage(blob, 1080, 960);
      const draft = currentDraft() ?? emptyDraft();
      const first = catalog?.lines[0];
      draft.items.push(blankItem(nextTag(draft.items), first ? [newLine(first)] : [], {
        cropKey: up.key, soleId, strapId, colorNote: designNote(d, t, lang),
      }));
      saveDraft(draft);
      go('/dat-hang');
    } catch (e) { setError(errorText(t, e)); } finally { setBusy(false); }
  }

  const mats = (kind: 'sole' | 'strap') => (catalog?.materials ?? []).filter((m) => m.kind === kind);
  return (
    <main className="page designer">
      <h1>{t('d.title')}</h1>
      <p className="muted" style={{ marginTop: -4 }}>{t('d.lead')}</p>
      <div className="d-layout">
        <div className="d-preview" role="img" aria-label={designNote(d, t, lang)} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="d-controls stack">
          <button type="button" className="btn btn-sm d-shuffle" onClick={shuffle}><Shuffle size={16} aria-hidden="true" /> {t('d.shuffle')}</button>
          <Swatches label={t('d.top')} value={d.top} onChange={(top) => set({ top })} lang={lang} />
          <Swatches label={t('d.edge')} value={d.edge} onChange={(edge) => set({ edge })} lang={lang} />
          <Swatches label={t('d.strap_colour')} value={d.strap} onChange={(strap) => set({ strap })} lang={lang} />
          <fieldset className="d-field">
            <legend>{t('d.pattern')}</legend>
            <div className="seg seg-wrap" role="radiogroup" aria-label={t('d.pattern')}>
              {PATTERNS.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={d.pattern === p} aria-pressed={d.pattern === p}
                  onClick={() => (p === 'photo' && !d.photo ? fileRef.current?.click() : set({ pattern: p }))}>{t(`d.p_${p}` as never)}</button>
              ))}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden aria-label={t('d.p_photo')} onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            {d.pattern === 'photo' && (
              <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}><ImagePlus size={16} aria-hidden="true" /> {t('d.photo_change')}</button>
            )}
          </fieldset>
          {d.pattern !== 'none' && d.pattern !== 'photo' && (
            <Swatches label={t('d.pattern_colour')} value={d.patternColour} onChange={(patternColour) => set({ patternColour })} lang={lang} />
          )}
          <div className="d-field">
            <label htmlFor="d-text">{t('d.text')}</label>
            <input id="d-text" maxLength={18} value={d.text} placeholder={t('d.text_ph')} onChange={(e) => set({ text: e.target.value })} />
            <p className="small muted" style={{ margin: '4px 0 0' }}>{t('d.text_help')}</p>
          </div>
          {(mats('sole').length > 0 || mats('strap').length > 0) && (
            <div className="row wrap">
              {(['sole', 'strap'] as const).filter((k) => mats(k).length).map((k) => (
                <div key={k} className="grow">
                  <label htmlFor={`d-${k}`} className="small">{t(k === 'sole' ? 'c.sole' : 'c.strap')}</label>
                  <select id={`d-${k}`} value={(k === 'sole' ? soleId : strapId) ?? ''} onChange={(e) => (k === 'sole' ? setSoleId : setStrapId)(e.target.value || null)}>
                    <option value="">{t('c.any')}</option>
                    {mats(k).map((m) => <option key={m.id} value={m.id}>{nameIn(m.name, lang)}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="small muted d-note">{t('d.bar_note')}</p>
      <div className="d-bar">
        <button type="button" className="btn-primary btn-block" disabled={busy} onClick={add}>{busy ? t('d.adding') : t('d.add')}</button>
      </div>
    </main>
  );
}
