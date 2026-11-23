import { useId } from 'react';
import { formatQty } from '../../../shared/money';
import { itemQty } from '../../../shared/totals';
import type { Item, Line } from '../../../shared/types';
import { lineLabel, type Material, type Settings } from '../catalog';
import { CropThumb } from './CropThumb';
import { LineEditor } from './LineEditor';
import { MaterialPicker } from './MaterialPicker';

export function newLine(settings: Settings | null, key: string): Line {
  const s = settings?.lines.find((l) => l.key === key) ?? settings?.lines[0];
  return {
    id: crypto.randomUUID(), lineKey: s?.key ?? key, sizeFrom: s?.sizeFrom ?? 39, sizeTo: s?.sizeTo ?? 44,
    mode: 'even', qtyEach: 0, perSize: {}, unitPrice: null,
  };
}

/** One design in the order: crop, quantity lines, materials and colour note. */
export function ItemForm({ item, image, settings, materials, reloadMaterials, onChange, onRemove, selected, onSelect, locked, libraryOnly }: {
  item: Item; image: { url: string; width: number; height: number } | null; settings: Settings | null;
  materials: Material[]; reloadMaterials: () => Promise<void>; onChange: (i: Item) => void; onRemove: () => void;
  selected: boolean; onSelect: () => void; locked?: boolean; libraryOnly?: boolean;
}) {
  const noteId = useId();
  const usedKeys = new Set(item.lines.map((l) => l.lineKey));
  const setLine = (idx: number, l: Line) => onChange({ ...item, lines: item.lines.map((x, i) => (i === idx ? l : x)) });

  return (
    <section aria-label={`Mẫu ${item.tagNo}`} className="card" onFocusCapture={onSelect}
      style={{ marginTop: 10, borderColor: selected ? 'var(--accent)' : undefined, borderWidth: selected ? 2 : 1 }}>
      <div className="row">
        <CropThumb image={image} crop={item.crop} cropKey={item.cropKey} />
        <div className="grow">
          <h3 style={{ margin: 0 }}>Mẫu {item.tagNo}</h3>
          {!libraryOnly && <p className="small muted num" style={{ margin: 0 }}>{formatQty(itemQty(item))} đôi</p>}
        </div>
        {!locked && <button type="button" className="btn-sm btn-danger" onClick={onRemove}>Xóa mẫu</button>}
      </div>

      {!libraryOnly && (
        <div className="stack" style={{ marginTop: 10 }}>
          {item.lines.map((l, idx) => (
            <LineEditor key={l.id} line={l} label={lineLabel(settings, l.lineKey)} locked={locked}
              onChange={(nl) => setLine(idx, nl)}
              onRemove={item.lines.length > 1 ? () => onChange({ ...item, lines: item.lines.filter((_, i) => i !== idx) }) : undefined} />
          ))}
          {!locked && (
            <div className="row wrap">
              {settings?.lines.filter((s) => !usedKeys.has(s.key)).map((s) => (
                <button key={s.key} type="button" className="btn-sm" onClick={() => onChange({ ...item, lines: [...item.lines, newLine(settings, s.key)] })}>
                  + Dòng {s.label.vi}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="row wrap" style={{ marginTop: 10 }}>
        <MaterialPicker kind="sole" value={item.soleId} materials={materials} onCreated={reloadMaterials} onChange={(v) => onChange({ ...item, soleId: v })} />
        <MaterialPicker kind="strap" value={item.strapId} materials={materials} onCreated={reloadMaterials} onChange={(v) => onChange({ ...item, strapId: v })} />
        <MaterialPicker kind="style" value={item.styleId} materials={materials} onCreated={reloadMaterials} onChange={(v) => onChange({ ...item, styleId: v })} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label htmlFor={noteId} className="small">Màu / ghi chú</label>
        <input id={noteId} value={item.colorNote} onChange={(e) => onChange({ ...item, colorNote: e.target.value })} placeholder="ví dụ: đen, quai bạc" />
      </div>
    </section>
  );
}
