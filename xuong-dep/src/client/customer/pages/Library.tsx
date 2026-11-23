import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Lang } from '../../../shared/types';
import { go } from '../../admin/router';
import type { T } from '../../ui/lang';
import { api } from '../api';
import { media, nameIn, useCatalog } from '../common';
import { addDesignToDraft } from '../draft';
import { errorText } from './Auth';

type LibItem = { id: string; cropKey: string; styleId: string | null; soleId: string | null; strapId: string | null; note: string; orderCount: number };
type Filter = { q: string; styleId: string; soleId: string; strapId: string; sort: 'new' | 'popular' };

export function Library({ t, lang }: { t: T; lang: Lang }) {
  const catalog = useCatalog();
  const [f, setF] = useState<Filter>({ q: '', styleId: '', soleId: '', strapId: '', sort: 'new' });
  const [q, setQ] = useState('');
  const [items, setItems] = useState<LibItem[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState('');

  const url = (cursor: number) => {
    const sp = new URLSearchParams({ sort: f.sort, cursor: String(cursor) });
    for (const k of ['q', 'styleId', 'soleId', 'strapId'] as const) if (f[k]) sp.set(k, f[k]);
    return '/api/c/library?' + sp;
  };
  async function load(cursor = 0) {
    setError('');
    try {
      const r = await api<{ items: LibItem[]; next: number | null }>('GET', url(cursor));
      setItems((xs) => (cursor && xs ? [...xs, ...r.items] : r.items));
      setNext(r.next);
    } catch (e) { setError(errorText(t, e)); }
  }
  useEffect(() => { setItems(null); load(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [f]);
  useEffect(() => { const id = setTimeout(() => setF((x) => (x.q === q.trim() ? x : { ...x, q: q.trim() })), 350); return () => clearTimeout(id); }, [q]);

  const mats = catalog?.materials ?? [];
  const nameOf = (id: string | null) => nameIn(mats.find((m) => m.id === id)?.name, lang);
  const sel = (kind: 'style' | 'sole' | 'strap', key: 'styleId' | 'soleId' | 'strapId', label: string) => {
    const list = mats.filter((m) => m.kind === kind);
    if (!list.length) return null;
    return (
      <select aria-label={label} value={f[key]} onChange={(e) => setF((x) => ({ ...x, [key]: e.target.value }))}>
        <option value="">{label}: {t('c.all')}</option>
        {list.map((m) => <option key={m.id} value={m.id}>{nameIn(m.name, lang)}</option>)}
      </select>
    );
  };

  function reorder(d: LibItem) {
    addDesignToDraft(d, catalog?.lines[0]);
    go('/dat-hang');
  }

  return (
    <main className="page">
      <h1>{t('c.lib_title')}</h1>
      <p className="muted" style={{ marginTop: -4 }}>{t('c.lib_sub')}</p>
      <div className="lib-filters">
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label={t('c.search')} placeholder={t('c.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="row wrap">
          {sel('style', 'styleId', t('c.style'))}
          {sel('sole', 'soleId', t('c.sole'))}
          {sel('strap', 'strapId', t('c.strap'))}
        </div>
        <div className="seg" role="group" aria-label={t('c.sort')}>
          <button type="button" aria-pressed={f.sort === 'new'} onClick={() => setF((x) => ({ ...x, sort: 'new' }))}>{t('c.sort_new')}</button>
          <button type="button" aria-pressed={f.sort === 'popular'} onClick={() => setF((x) => ({ ...x, sort: 'popular' }))}>{t('c.sort_popular')}</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {!items && !error && <div className="lib-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ aspectRatio: '1' }} />)}</div>}
      {items && items.length === 0 && <p className="empty-note">{t('c.lib_empty')}</p>}
      {items && items.length > 0 && (
        <div className="lib-grid">
          {items.map((d) => (
            <article key={d.id} className="lib-card" data-design-id={d.id}>
              <img src={media(d.cropKey)} alt="" loading="lazy" />
              <div className="lib-card-body">
                {d.styleId && <strong className="small">{nameOf(d.styleId)}</strong>}
                {d.note && <p className="small muted">{d.note}</p>}
                {d.orderCount > 0 && <p className="small muted">{t('c.ordered_n', { n: d.orderCount })}</p>}
                <button type="button" className="btn-lime btn-sm btn-block" onClick={() => reorder(d)}>{t('c.reorder')}</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {next !== null && <button type="button" className="btn btn-block" style={{ marginTop: 12 }} onClick={() => load(next)}>{t('c.more')}</button>}
    </main>
  );
}
