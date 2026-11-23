import { useEffect, useState } from 'react';
import { formatQty } from '../../../shared/money';
import { lineQty, resizeLine, sizesOf } from '../../../shared/totals';
import type { Line, LineMode } from '../../../shared/types';

/** Every word the line editor shows; the admin uses Vietnamese, the customer area passes its language. */
export type LineText = {
  even: string; perSize: string; total: string; size: string; to: string;
  sizeFrom: (l: string) => string; sizeTo: (l: string) => string; each: (l: string) => string; totalOf: (l: string) => string;
  sizeOf: (s: number, l: string) => string; xSizes: (n: number) => string; split: string; eq: (n: string) => string;
  remove: (l: string) => string; mode: (l: string) => string;
};
export const LINE_TEXT_VI: LineText = {
  even: 'Đều mỗi size', perSize: 'Từng size', total: 'Tổng số đôi', size: 'Size', to: 'đến',
  sizeFrom: (l) => `Size từ – ${l}`, sizeTo: (l) => `Size đến – ${l}`, each: (l) => `Số đôi mỗi size – ${l}`, totalOf: (l) => `Tổng số đôi – ${l}`,
  sizeOf: (s, l) => `Size ${s} – ${l}`, xSizes: (n) => `× ${n} size`, split: 'Chia size theo chuẩn xưởng · ', eq: (n) => `= ${n} đôi`,
  remove: (l) => `Xóa dòng ${l}`, mode: (l) => `Cách nhập – ${l}`,
};
const MODES: { mode: LineMode; key: 'even' | 'perSize' | 'total' }[] = [
  { mode: 'even', key: 'even' },
  { mode: 'per_size', key: 'perSize' },
  { mode: 'total', key: 'total' },
];

const toInt = (s: string) => {
  const n = parseInt(s.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

function QtyInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <input aria-label={label} inputMode="numeric" pattern="[0-9]*" className="num" disabled={disabled}
      value={String(value)} onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange(toInt(e.target.value))} />
  );
}

function SizeInput({ label, value, onCommit, disabled }: { label: string; value: number; onCommit: (n: number) => void; disabled?: boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = toInt(text);
    if (n >= 1 && n <= 60) onCommit(n); else setText(String(value));
  };
  return (
    <input aria-label={label} inputMode="numeric" pattern="[0-9]*" className="num" style={{ width: 64 }} disabled={disabled}
      value={text} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
}

/** One quantity line (e.g. Nam 39–44): range, entry mode and counts. */
export function LineEditor({ line, label, onChange, onRemove, locked, text: x = LINE_TEXT_VI }: {
  line: Line; label: string; onChange: (l: Line) => void; onRemove?: () => void; locked?: boolean; text?: LineText;
}) {
  const setMode = (mode: LineMode) => {
    if (mode === line.mode) return;
    let next: Line = { ...line, mode };
    if (mode === 'per_size' && sizesOf(line).every((s) => !line.perSize[String(s)])) {
      // start per-size entry from the even count so nothing typed is lost
      next = { ...next, perSize: Object.fromEntries(sizesOf(line).map((s) => [String(s), line.mode === 'even' ? line.qtyEach : 0])) };
    }
    onChange(next);
  };
  const qty = lineQty(line);

  return (
    <div className="card" style={{ padding: 10, background: 'var(--surface-2)', border: 0 }}>
      <div className="row wrap">
        <strong className="grow">{label}</strong>
        <span className="small muted">{x.size}</span>
        <SizeInput label={x.sizeFrom(label)} value={line.sizeFrom} disabled={locked}
          onCommit={(n) => onChange(resizeLine(line, n, line.sizeTo))} />
        <span className="small muted">{x.to}</span>
        <SizeInput label={x.sizeTo(label)} value={line.sizeTo} disabled={locked}
          onCommit={(n) => onChange(resizeLine(line, line.sizeFrom, n))} />
        {onRemove && !locked && <button type="button" className="btn-sm btn-ghost" aria-label={x.remove(label)} onClick={onRemove}>✕</button>}
      </div>
      <div className="seg" role="group" aria-label={x.mode(label)} style={{ margin: '8px 0' }}>
        {MODES.map((m) => (
          <button key={m.mode} type="button" aria-pressed={line.mode === m.mode} disabled={locked} onClick={() => setMode(m.mode)}>{x[m.key]}</button>
        ))}
      </div>
      {line.mode === 'even' && (
        <div className="row">
          <div className="grow"><QtyInput label={x.each(label)} value={line.qtyEach} disabled={locked} onChange={(n) => onChange({ ...line, qtyEach: n })} /></div>
          <span className="muted small">{x.xSizes(sizesOf(line).length)}</span>
        </div>
      )}
      {line.mode === 'total' && (
        <QtyInput label={x.totalOf(label)} value={line.qtyEach} disabled={locked} onChange={(n) => onChange({ ...line, qtyEach: n })} />
      )}
      {line.mode === 'per_size' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 6 }}>
          {sizesOf(line).map((s) => (
            <div key={s}>
              <div className="small muted" style={{ textAlign: 'center' }}>{s}</div>
              <QtyInput label={x.sizeOf(s, label)} value={line.perSize[String(s)] ?? 0} disabled={locked}
                onChange={(n) => onChange({ ...line, perSize: { ...line.perSize, [String(s)]: n } })} />
            </div>
          ))}
        </div>
      )}
      <p className="small right" style={{ margin: '6px 0 0' }}>
        {line.mode === 'total' ? x.split : ''}<strong className="num">{x.eq(formatQty(qty))}</strong>
      </p>
    </div>
  );
}
