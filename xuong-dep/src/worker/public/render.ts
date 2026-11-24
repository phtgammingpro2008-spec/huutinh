// Server-rendered public pages: tiny escaping template + the page frame (head, header, footer, sticky CTA).
import { THEME_BOOT } from '../../client/ui/theme';
import { uiT, type UiKey } from '../../shared/i18n-ui';
import type { Lang } from '../../shared/types';
import { PATHS } from '../assets.gen';
import type { Shop } from '../repo/products';
import type { SessionUser } from '../roles';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Markup that is already safe. Only `html` and `raw` make one. */
export class Html { constructor(readonly s: string) {} toString() { return this.s; } }
export const raw = (s: string) => new Html(s);
type Val = Html | string | number | null | undefined | false | Val[];

function out(v: Val): string {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Html) return v.s;
  if (Array.isArray(v)) return v.map(out).join('');
  return escapeHtml(String(v));
}

/** Template tag: every interpolated value is escaped unless it is Html. */
export function html(strings: TemplateStringsArray, ...vals: Val[]): Html {
  let s = strings[0];
  for (let i = 0; i < vals.length; i++) s += out(vals[i]) + strings[i + 1];
  return new Html(s);
}

export type Names = Record<Lang, string>;
/** Text in the page language, Vietnamese when that language is empty. */
export const pick = (n: Names, lang: Lang) => (n[lang] || n.vi || '').trim();

export const mediaUrl = (key: string) => '/media/' + key;

// thin line icons (lucide shapes), drawn inline so the page needs no script for them
const ICON: Record<string, string> = {
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  factory: '<path d="M2 20h20"/><path d="M4 20V9l5 3V9l5 3V9l5 3v8"/><path d="M8 16h1M12 16h1M16 16h1"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
};
export const icon = (name: keyof typeof ICON | string, size = 20) =>
  raw(`<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name] ?? ''}</svg>`);

/** Drawn sandal used where a product has no picture yet. */
export const sandal = (fill = '#e8f3a3', strap = '#1b3b2c', size = 64) =>
  raw(`<svg aria-hidden="true" width="${size / 2}" height="${size}" viewBox="0 0 60 120"><path d="M30 4c14 0 22 12 22 30 0 16-5 25-7 39-2 12-7 19-15 19s-13-7-15-19C13 59 8 50 8 34 8 16 16 4 30 4z" fill="${fill}"/><path d="M30 22C27 36 17 46 10 52M30 22c3 14 13 24 20 30" stroke="${strap}" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`);

export type PageCtx = { lang: Lang; user: SessionUser | null; origin: string; path: string; shop: Shop };
export const tr = (c: PageCtx, k: UiKey, vars?: Record<string, string | number>) => uiT(c.lang, k, vars);

/** Where an order starts: the customer area, or the login modal (with that page as `next`) for guests. */
export function orderLink(c: PageCtx, label: Val, cls: string, next = '/tai-khoan#/dat-hang', kind = 'cta'): Html {
  if (c.user?.role === 'admin') return html`<a class="${cls}" href="/quan-ly#/orders/new">${label}</a>`;
  if (c.user) return html`<a class="${cls}" href="${next}">${label}</a>`;
  return html`<a class="${cls}" href="${'/dang-ky?next=' + encodeURIComponent(next)}" data-need-login="${kind}" data-next="${next}">${label}</a>`;
}

const zaloHref = (z: string) => (z.replace(/\D/g, '') ? 'https://zalo.me/' + z.replace(/\D/g, '') : '');
const messengerHref = (m: string) => {
  const v = m.trim();
  if (!v) return '';
  const u = /^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, '');
  try { return new URL(u).protocol === 'https:' || new URL(u).protocol === 'http:' ? u : ''; } catch { return ''; }
};

function header(c: PageCtx): Html {
  const next = encodeURIComponent(c.path);
  const account = c.user
    ? html`<a class="btn btn-sm head-account" href="${c.user.role === 'admin' ? '/quan-ly' : '/tai-khoan'}" aria-label="${tr(c, 'pub.account')}">${icon('user', 18)}<span class="hide-xs">${tr(c, 'pub.account')}</span></a>`
    : html`<a class="btn btn-sm btn-primary head-account" href="${'/dang-nhap?next=' + next}">${tr(c, 'pub.login')}</a>`;
  return html`<header class="site-header"><div class="site-header-in">
<a class="brand" href="/" aria-label="HLUXURY – ${tr(c, 'pub.home')}"><span class="brand-mark" aria-hidden="true">H</span><span class="brand-name">HLUXURY</span></a>
<div id="hl-controls" class="head-controls"></div>
${account}
</div></header>`;
}

const telHref = (p: string) => (p.replace(/[^\d+]/g, '') ? 'tel:' + p.replace(/[^\d+]/g, '') : '');
/** Who answers on Zalo: the sales manager, else the CEO. */
const zaloOf = (s: PageCtx['shop']) => zaloHref(s.sales.phone || s.ceo.phone);

function footer(c: PageCtx): Html {
  const s = c.shop;
  const m = messengerHref(s.messenger);
  const person = (role: UiKey, p: { name: string; phone: string }) => (p.name || p.phone ? html`<li class="contact">${icon('user', 16)}<span>
<strong>${tr(c, role)}</strong>${p.name ? html`<br>${p.name}` : ''}
${p.phone ? html`<br><a href="${telHref(p.phone)}">${p.phone}</a>${zaloHref(p.phone) ? html` · <a href="${zaloHref(p.phone)}" rel="noopener" target="_blank">Zalo</a>` : ''}` : ''}
</span></li>` : '');
  return html`<footer class="site-footer"><div class="site-footer-in">
<p class="site-footer-brand">HLUXURY</p>
<p class="muted-on-dark">${tr(c, 'ui.tagline')}</p>
<ul class="footer-list">
${person('pub.ceo', s.ceo)}
${person('pub.sales', s.sales)}
<li>${icon('pin', 16)}<span><strong>${tr(c, 'pub.address')}:</strong> ${s.address || tr(c, 'pub.default_address')}</span></li>
${m ? html`<li>${icon('chat', 16)}<a href="${m}" rel="noopener" target="_blank">Messenger</a></li>` : ''}
</ul>
<p class="small muted-on-dark">© ${new Date().getUTCFullYear()} HLUXURY</p>
</div></footer>`;
}

/** The bar at the bottom of the screen: "send a photo" by default, the page's own main action when it has one. */
export type StickyAction = { label: string; next: string; kind: string };
function stickyCta(c: PageCtx, action?: StickyAction): Html {
  const z = zaloOf(c.shop);
  const main = action
    ? orderLink(c, html`<span>${action.label}</span>`, 'cta-main', action.next, action.kind)
    : orderLink(c, html`${icon('camera', 18)}<span>${tr(c, 'pub.cta')}</span>`, 'cta-main');
  return html`<div class="sticky-cta" role="region" aria-label="${action?.label ?? tr(c, 'pub.cta')}">
${main}
${z ? html`<a class="cta-zalo" href="${z}" rel="noopener" target="_blank" aria-label="${tr(c, 'pub.zalo')}">${icon('chat', 22)}</a>` : ''}
</div>`;
}

const LANG_TAGS: Record<Lang, string> = { vi: 'vi', en: 'en', km: 'km' };

/** Full HTML document for a public page. `indexable` pages get index,follow; the rest stay noindex. */
export function renderPage(c: PageCtx, o: {
  title: string; description: string; ogImage?: string | null; body: Html; indexable?: boolean; headExtra?: Html; cta?: boolean; action?: StickyAction;
}): string {
  const url = c.origin + c.path;
  const canonical = c.origin + c.path.split('?')[0];
  const og = o.ogImage ? c.origin + mediaUrl(o.ogImage) : '';
  const alt = (l: Lang) => canonical + (canonical.includes('?') ? '&' : '?') + 'lang=' + l;
  return '<!doctype html>' + html`<html lang="${LANG_TAGS[c.lang]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="${o.indexable === false ? 'noindex' : 'index,follow'}">
<meta name="theme-color" content="#1b3b2c">
<title>${o.title}</title>
<meta name="description" content="${o.description}">
<link rel="canonical" href="${canonical}">
${(['vi', 'en', 'km'] as Lang[]).map((l) => html`<link rel="alternate" hreflang="${l}" href="${alt(l)}">`)}
<meta property="og:type" content="website">
<meta property="og:site_name" content="HLUXURY">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.description}">
<meta property="og:url" content="${url}">
${og ? html`<meta property="og:image" content="${og}">` : ''}
<link rel="icon" href="/icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<script>${raw(THEME_BOOT)}</script>
${o.headExtra ?? ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900${c.lang === 'km' ? '&family=Noto+Sans+Khmer:wght@400;600;700' : ''}&amp;display=swap">
<link rel="stylesheet" href="${PATHS.css}">
</head>
<body class="site${o.cta === false ? '' : ' has-cta'}">
${header(c)}
<main id="main">${o.body}</main>
${footer(c)}
${o.cta === false ? '' : stickyCta(c, o.action)}
<script type="module" src="${PATHS.island}"></script>
</body>
</html>`.s;
}
