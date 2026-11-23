import { useEffect, useState } from 'react';
import { t } from '../../shared/i18n';
import { formatMoney, formatQty } from '../../shared/money';
import type { Names, PublicQuote, SnapshotItem } from '../../shared/snapshot';
import { LANGS, type Lang } from '../../shared/types';

const LANG_KEY = 'quote-lang';
const ACCEPTED_STATES = ['khach_dong_y', 'dang_san_xuat', 'da_giao', 'hoan_tat'];

function readLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY) as Lang | null;
    return v && LANGS.includes(v) ? v : null;
  } catch { return null; }
}
function writeLang(l: Lang) {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* private mode */ }
}

const dmy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const nameIn = (n: Names | null, lang: Lang) => (n ? n[lang] || n.vi : '');

function Item({ item, index, token, lang, q }: { item: SnapshotItem; index: number; token: string; lang: Lang; q: PublicQuote }) {
  const c = q.snapshot.currency;
  const mats = ([['material.sole', item.materials.sole], ['material.strap', item.materials.strap], ['material.style', item.materials.style]] as const)
    .filter(([, v]) => v);
  return (
    <article className="card" style={{ marginTop: 12 }}>
      <div className="item">
        <img src={`/q/${token}/img/${index}`} alt={`${t(lang, 'design')} ${item.tagNo}`} loading="lazy" />
        <div>
          <h3 style={{ marginTop: 0 }}>{t(lang, 'design')} {item.tagNo}</h3>
          {mats.map(([k, v]) => <div key={k} className="small">{t(lang, k)}: <strong>{nameIn(v, lang)}</strong></div>)}
          {item.colorNote && <div className="small">{t(lang, 'color')}: {item.colorNote}</div>}
        </div>
      </div>
      {item.lines.map((l, i) => (
        <div key={i} style={{ marginTop: 10 }}>
          <div className="row"><strong className="grow">{nameIn(l.label, lang)} · {t(lang, 'size')} {l.sizeFrom}–{l.sizeTo}</strong></div>
          {l.mode === 'total' ? (
            <p className="small muted" style={{ margin: '4px 0' }}>{t(lang, 'sizeSplit')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="small num">
                <thead><tr><th>{t(lang, 'size')}</th>{Object.keys(l.sizes).map((s) => <th key={s}>{s}</th>)}</tr></thead>
                <tbody><tr><td>{t(lang, 'pairs')}</td>{Object.values(l.sizes).map((n, k) => <td key={k}>{n}</td>)}</tr></tbody>
              </table>
            </div>
          )}
          <div className="row small num" style={{ marginTop: 4 }}>
            <span className="grow">{formatQty(l.qty)} {t(lang, 'pairsUnit')} × {formatMoney(l.unitPrice, c, lang)}</span>
            <strong>{formatMoney(l.amount, c, lang)}</strong>
          </div>
        </div>
      ))}
    </article>
  );
}

export function QuotePage({ token }: { token: string }) {
  const [q, setQ] = useState<PublicQuote | null>(null);
  const [lang, setLang] = useState<Lang>(readLang() ?? 'vi');
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ msg: string; reload: boolean } | null>(null);

  async function load() {
    setProblem(null);
    try {
      const r = await fetch(`/api/public/quote/${token}`);
      if (r.status === 404) return setState('notfound');
      if (!r.ok) return setState('error');
      const data = (await r.json()) as PublicQuote;
      setQ(data);
      if (!readLang()) setLang(data.lang);
      setState('ready');
    } catch {
      setState('error');
    }
  }
  useEffect(() => { load(); }, [token]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t(lang, 'page.title')}${q ? ' ' + q.code : ''}`;
  }, [lang, q]);

  const choose = (l: Lang) => { setLang(l); writeLang(l); };

  async function accept() {
    if (!q) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await fetch(`/api/public/quote/${token}/accept`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: q.snapshot.version, lang }),
      });
      if (r.ok) return await load();
      const body = await r.json().catch(() => ({}));
      setProblem({ msg: body.error ?? t(lang, 'error'), reload: r.status === 409 && q.status !== 'da_huy' });
    } catch {
      setProblem({ msg: t(lang, 'error'), reload: false });
    } finally {
      setBusy(false);
    }
  }

  const switcher = (
    <div className="lang-switch" role="group" aria-label={t(lang, 'language')}>
      {LANGS.map((l) => (
        <button key={l} type="button" className="chip" lang={l} aria-pressed={lang === l} onClick={() => choose(l)}>{t(l, `lang.${l}`)}</button>
      ))}
    </div>
  );

  if (state !== 'ready' || !q) {
    return (
      <main className="quote" lang={lang}>
        {switcher}
        <p className={state === 'loading' ? 'muted' : 'error'}>
          {state === 'loading' ? '…' : state === 'notfound' ? t(lang, 'notFound') : t(lang, 'error')}
        </p>
      </main>
    );
  }

  const s = q.snapshot;
  const accepted = q.acceptedVersion === s.version && ACCEPTED_STATES.includes(q.status);
  return (
    <main className="quote" lang={lang}>
      {switcher}
      <h1 style={{ marginBottom: 4 }}>{t(lang, 'page.title')} {q.code}</h1>
      <p className="muted small" style={{ marginTop: 0 }}>{q.customerName} · {t(lang, 'version', { n: s.version })}</p>

      {s.items.map((it, i) => <Item key={i} item={it} index={i} token={token} lang={lang} q={q} />)}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="row"><span className="grow">{t(lang, 'total.pairs')}</span><strong className="num">{formatQty(s.totalQty)}</strong></div>
        <div className="row total"><span className="grow">{t(lang, 'total.amount')}</span><span className="num">{formatMoney(s.totalAmount, s.currency, lang)}</span></div>
        {s.neededBy && <div className="row small"><span className="grow">{t(lang, 'neededBy')}</span><span>{dmy(s.neededBy)}</span></div>}
      </section>

      <div className="accept-bar">
        {problem && (
          <div className="error" role="alert" style={{ marginBottom: 10 }}>
            {problem.msg}
            {problem.reload && <div style={{ marginTop: 8 }}><button type="button" className="btn-sm" onClick={load}>{t(lang, 'reload')}</button></div>}
          </div>
        )}
        {q.status === 'da_huy' ? (
          <p className="notice">{t(lang, 'cancelled')}</p>
        ) : accepted ? (
          <div className="success">
            <strong>{t(lang, 'accepted')}</strong>
            {q.acceptedAt && <div className="small">{t(lang, 'acceptedAt', { time: dmy(q.acceptedAt) })}</div>}
          </div>
        ) : q.status === 'cho_bao_gia' ? (
          <p className="notice">{t(lang, 'updating')}</p>
        ) : (
          <button type="button" className="btn-primary btn-block btn-lg" disabled={busy} onClick={accept}>
            {busy ? t(lang, 'accepting') : t(lang, 'accept')}
          </button>
        )}
      </div>
    </main>
  );
}
