import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { getTheme, setTheme, type Theme } from './theme';

/** Sun/moon button. Labels are the action ("switch to dark"), localizable by the caller. */
export function ThemeToggle({ labels = { toDark: 'Giao diện tối', toLight: 'Giao diện sáng' } }: { labels?: { toDark: string; toLight: string } }) {
  const [t, setT] = useState<Theme>(getTheme);
  const next: Theme = t === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? labels.toDark : labels.toLight;
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={() => { setTheme(next); setT(next); }}>
      {t === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
    </button>
  );
}
