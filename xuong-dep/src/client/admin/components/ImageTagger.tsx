import { useRef, type MouseEvent, type PointerEvent } from 'react';
import type { Box } from '../../../shared/types';
import { boxCentre, defaultBox, hitTag, moveCorner, type Corner } from '../../lib/tagger-geometry';

export type TaggerTag = { tagNo: number; tapX: number | null; tapY: number | null; crop: Box | null };
export type TaggerImage = { url: string; width: number; height: number; key?: string | null };

const LABEL_HIT_PX = 26; // a tap this close to a label selects it instead of adding a new tag
const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];
const pct = (v: number) => `${+(v * 100).toFixed(3)}%`;

export function ImageTagger(props: {
  image: TaggerImage;
  tags: TaggerTag[];
  selected: number | null;
  onAdd: (tap: { x: number; y: number }, box: Box) => void;
  onSelect: (tagNo: number) => void;
  onBoxChange: (tagNo: number, box: Box) => void;
  onWholeImage: () => void;
  readOnly?: boolean;
}) {
  const { image, tags, selected } = props;
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ corner: Corner; tagNo: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const labelPos = (t: TaggerTag) => (t.tapX != null && t.tapY != null ? { x: t.tapX, y: t.tapY } : t.crop ? boxCentre(t.crop) : { x: 0.5, y: 0.5 });

  function frac(clientX: number, clientY: number) {
    const r = ref.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height, r };
  }

  function onClick(e: MouseEvent) {
    if (props.readOnly) return;
    if (suppressClick.current) { suppressClick.current = false; return; }
    const { x, y, r } = frac(e.clientX, e.clientY);
    if (x < 0 || y < 0 || x > 1 || y > 1) return;
    const px = tags.map((t) => { const p = labelPos(t); return { tagNo: t.tagNo, tapX: p.x * r.width, tapY: p.y * r.height }; });
    const hit = hitTag(px, x * r.width, y * r.height, LABEL_HIT_PX);
    if (hit != null) props.onSelect(hit);
    else props.onAdd({ x, y }, defaultBox(x, y, image.width / image.height));
  }

  function onHandleDown(e: PointerEvent, tagNo: number, corner: Corner) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { corner, tagNo, moved: false };
  }
  function onHandleMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const t = tags.find((x) => x.tagNo === d.tagNo);
    if (!t?.crop) return;
    const { x, y } = frac(e.clientX, e.clientY);
    d.moved = true;
    props.onBoxChange(d.tagNo, moveCorner(t.crop, d.corner, x, y));
  }
  function onHandleUp(e: PointerEvent) {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* already released */ }
    setTimeout(() => { suppressClick.current = false; }, 50);
  }

  const sel = tags.find((t) => t.tagNo === selected);
  return (
    <div className="tagger-wrap">
    <div className="tagger" ref={ref} onClick={onClick} data-key={image.key || undefined}
      style={{ aspectRatio: `${image.width} / ${image.height}` }}>
      <img src={image.url} alt="Ảnh khách gửi" draggable={false} />
      {tags.map((t) => t.crop && (
        <div key={'b' + t.tagNo} className={`box ${t.tagNo === selected ? 'sel' : ''}`}
          style={{ left: pct(t.crop.x), top: pct(t.crop.y), width: pct(t.crop.w), height: pct(t.crop.h) }} />
      ))}
      {tags.map((t) => {
        const p = labelPos(t);
        return <div key={'t' + t.tagNo} className={`tag ${t.tagNo === selected ? 'sel' : ''}`} style={{ left: pct(p.x), top: pct(p.y) }}>{t.tagNo}</div>;
      })}
      {!props.readOnly && sel?.crop && CORNERS.map((c) => {
        const b = sel.crop!;
        const x = c.endsWith('w') ? b.x : b.x + b.w;
        const y = c.startsWith('n') ? b.y : b.y + b.h;
        return (
          <div key={c} className="handle" data-corner={c} style={{ left: pct(x), top: pct(y) }}
            onPointerDown={(e) => onHandleDown(e, sel.tagNo, c)} onPointerMove={onHandleMove}
            onPointerUp={onHandleUp} onPointerCancel={onHandleUp} onClick={(e) => e.stopPropagation()} />
        );
      })}
    </div>
    {!props.readOnly && (
      <div className="row" style={{ marginTop: 8 }}>
        <p className="muted small grow">Chạm vào từng đôi dép để gắn số.</p>
        <button type="button" className="btn-sm" onClick={props.onWholeImage}>Cả ảnh là 1 mẫu</button>
      </div>
    )}
    </div>
  );
}
