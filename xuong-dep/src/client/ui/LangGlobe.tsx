import { Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../../shared/types';

const NAMES: Record<Lang, string> = { vi: 'Tiếng Việt', en: 'English', km: 'ខ្មែរ' };

/** Globe button opening a menu of the three languages. */
export function LangGlobe({ value, onChange, label = 'Ngôn ngữ' }: { value: Lang; onChange: (l: Lang) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="icon-btn" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Globe size={20} aria-hidden="true" />
      </button>
      {open && (
        <div className="menu" role="menu" aria-label={label}>
          {(Object.keys(NAMES) as Lang[]).map((l) => (
            <button key={l} type="button" role="menuitemradio" aria-checked={l === value} lang={l}
              onClick={() => { setOpen(false); onChange(l); }}>{NAMES[l]}</button>
          ))}
        </div>
      )}
    </div>
  );
}
