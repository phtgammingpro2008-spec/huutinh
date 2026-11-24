// Public HLUXURY site: home (mockup A2), products, product detail, collections, robots.txt, sitemap.xml.
import { LANGS, type Lang } from '../../shared/types';
import type { Env } from '../env';
import { getCookie } from '../http';
import { getPublicHome, getPublicProduct, getShop, listCollections, listProducts, type Collection, type Poster, type Product } from '../repo/products';
import { currentUser } from '../roles';
import type { Router } from '../router';
import { html, icon, mediaUrl, orderLink, pick, raw, renderPage, sandal, tr, type Html, type PageCtx } from './render';

const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** ?lang= → cookie hl-lang → Accept-Language → Vietnamese. */
export function pageLang(req: Request): Lang {
  const q = new URL(req.url).searchParams.get('lang');
  if (isLang(q)) return q;
  const c = getCookie(req, 'hl-lang');
  if (isLang(c)) return c;
  for (const part of (req.headers.get('accept-language') ?? '').toLowerCase().split(',')) {
    const tag = part.trim().slice(0, 2);
    if (isLang(tag)) return tag;
  }
  return 'vi';
}

const originOf = (env: Env, req: Request) => (env.APP_URL || new URL(req.url).origin).replace(/\/+$/, '');

async function ctxOf(req: Request, env: Env): Promise<PageCtx> {
  const u = new URL(req.url);
  u.searchParams.delete('lang');
  return { lang: pageLang(req), user: await currentUser(req, env), origin: originOf(env, req), path: u.pathname + u.search, shop: await getShop(env) };
}

/** Marks a page indexable; index.ts drops the default noindex header for it. */
function send(body: string, status = 200, indexable = true): Response {
  const h: Record<string, string> = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', vary: 'Cookie, Accept-Language' };
  if (indexable && status === 200) h['x-indexable'] = '1';
  return new Response(body, { status, headers: h });
}

// ---- building blocks ----
const sizeRange = (p: Product) => {
  if (!p.lines.length) return '';
  return `${Math.min(...p.lines.map((l) => l.sizeFrom))}–${Math.max(...p.lines.map((l) => l.sizeTo))}`;
};

function productCard(c: PageCtx, p: Product): Html {
  const img = p.colors[0]?.imageKey;
  const range = c.user ? sizeRange(p) : '';
  return html`<article class="pcard">
<a class="pcard-img" href="/san-pham/${p.slug}" tabindex="-1" aria-hidden="true">${img ? html`<img src="${mediaUrl(img)}" alt="" loading="lazy" decoding="async">` : sandal()}${p.isNew ? html`<span class="badge-new">${tr(c, 'pub.new')}</span>` : ''}</a>
<div class="pcard-body">
<h3 class="pcard-name"><a href="/san-pham/${p.slug}">${pick(p.name, c.lang)}</a></h3>
<p class="pcard-meta">${tr(c, 'pub.n_colors', { n: p.colors.length })}${range ? ' · Size ' + range : ''}</p>
<a class="pcard-cta" href="/san-pham/${p.slug}">${tr(c, 'pub.get_quote')}</a>
</div></article>`;
}

const grid = (c: PageCtx, ps: Product[]) => html`<div class="pgrid">${ps.map((p) => productCard(c, p))}</div>`;

/** A poster in the printed-poster look: copy + photo, stats and the colour grid of its product, brand bar. */
function promoPoster(c: PageCtx, p: Poster, i: number, total: number, byId: Map<string, Product>): Html {
  const prod = p.productId ? byId.get(p.productId) : undefined; // hidden or logo products drop out of the public list
  const title = pick(p.title, c.lang), hl = pick(p.highlight, c.lang), badge = pick(p.badge, c.lang), body = pick(p.body, c.lang);
  const photo = p.imageKey ?? prod?.colors[0]?.imageKey ?? null;
  const href = p.ctaHref || (prod ? `/san-pham/${prod.slug}` : '/san-pham');
  const cta = pick(p.ctaLabel, c.lang) || tr(c, 'pub.get_quote');
  const range = prod ? sizeRange(prod) : '';
  const heading = html`${title}${hl ? html`<br><span class="hl">${hl}</span>` : ''}`;
  const host = new URL(c.origin).host;
  return html`<article class="poster promo" style="--accent:${p.accent}" aria-roledescription="slide" aria-label="${i + 1} / ${total}">
<div class="promo-top">
<div class="promo-copy">
${pick(p.tag, c.lang) ? html`<span class="promo-tag">${pick(p.tag, c.lang)}</span>` : ''}
<h2 class="promo-title">${heading}</h2>
${body ? html`<p class="promo-body">${body}</p>` : ''}
${prod ? html`<div class="promo-stats"><div class="promo-stat"><strong>${prod.colors.length}</strong><span>${tr(c, 'pub.stat_colors')}</span></div>${range ? html`<div class="promo-sep" aria-hidden="true"></div><div class="promo-stat"><strong>${range}</strong><span>${tr(c, 'pub.stat_size')}</span></div>` : ''}</div>` : ''}
<a class="promo-cta" href="${href}">${cta} ${icon('arrow', 18)}</a>
</div>
<div class="promo-photo">${photo ? html`<img src="${mediaUrl(photo)}" alt="" ${i === 0 ? raw('fetchpriority="high"') : raw('loading="lazy"')} decoding="async">` : html`<div class="hero-art" aria-hidden="true">${sandal('#E2B65B', '#0C110E', 150)}${sandal('#c96a3a', '#0C110E', 150)}</div>`}
${badge ? html`<span class="promo-badge">${badge}</span>` : ''}</div>
</div>
${prod && prod.colors.length > 1 ? html`<div class="promo-palette"><div class="promo-palette-head"><span>${tr(c, 'pub.palette')}</span>${prod.colors.length ? html`<span>${tr(c, 'pub.real_photos')}</span>` : ''}</div>
<div class="promo-grid">${prod.colors.slice(0, 8).map((col) => html`<div class="promo-swatch"><img src="${mediaUrl(col.imageKey)}" alt="" loading="lazy" decoding="async"><span>${pick(col.name, c.lang)}</span></div>`)}</div></div>` : ''}
<div class="promo-bar"><span>${tr(c, 'pub.order_at')} <strong>${host}</strong></span><strong class="promo-brand">HLUXURY</strong></div>
</article>`;
}

/** Two sandals drawn as gold lines; they draw themselves once when the page opens (still for reduced motion). */
const lineSandals = () => raw(`<svg viewBox="0 0 320 300" fill="none" stroke-linecap="round" stroke-linejoin="round">
<g transform="rotate(-16 105 150)"><path class="draw" pathLength="1" d="M105 22c40 0 62 34 62 84 0 44-14 70-20 108-6 34-20 52-42 52s-36-18-42-52c-6-38-20-64-20-108 0-50 22-84 62-84z" stroke="#E2B65B" stroke-width="5"/>
<path class="draw d2" pathLength="1" d="M105 72c-8 38-36 66-56 82M105 72c8 38 36 66 56 82" stroke="#F2EEE5" stroke-width="7"/></g>
<g transform="rotate(12 225 160)"><path class="draw d3" pathLength="1" d="M225 34c40 0 62 34 62 84 0 44-14 70-20 108-6 34-20 52-42 52s-36-18-42-52c-6-38-20-64-20-108 0-50 22-84 62-84z" stroke="#c96a3a" stroke-width="5"/>
<path class="draw d4" pathLength="1" d="M190 120h70" stroke="#F2EEE5" stroke-width="12"/></g></svg>`);

/** Owner's pictures drifting left to right in a loop; drawn twice so the loop has no gap. Pauses on hover/focus. */
function gallery(c: PageCtx, items: { imageKey: string; caption: Record<Lang, string>; href: string }[]): Html {
  if (!items.length) return html``;
  const one = (hidden: boolean) => html`<div class="gallery-track"${hidden ? raw(' aria-hidden="true"') : ''}>${items.map((g) => {
    const cap = pick(g.caption, c.lang);
    const inner = html`<img src="${mediaUrl(g.imageKey)}" alt="${cap}" loading="lazy" decoding="async">${cap ? html`<span>${cap}</span>` : ''}`;
    return g.href && !hidden ? html`<a class="gallery-item" href="${g.href}">${inner}</a>` : html`<div class="gallery-item">${inner}</div>`;
  })}</div>`;
  // few pictures: repeat them so the strip is always wider than the screen
  const reps = Math.max(1, Math.ceil(8 / items.length));
  const row = (hidden: boolean) => html`${Array.from({ length: reps }, (_, k) => one(hidden || k > 0))}`;
  return html`<section class="gallery" aria-label="HLUXURY" style="--dur:${Math.max(30, items.length * reps * 6)}s"><div class="gallery-belt">${row(false)}${row(true)}</div></section>`;
}

function why(c: PageCtx): Html {
  const items = [['factory', 'pub.why1_t', 'pub.why1_d'], ['image', 'pub.why2_t', 'pub.why2_d'], ['truck', 'pub.why3_t', 'pub.why3_d']] as const;
  return html`<section class="why" aria-label="HLUXURY"><ul>${items.map(([ic, t, d]) =>
    html`<li><span class="why-ico">${icon(ic, 26)}</span><div><strong>${tr(c, t)}</strong><p>${tr(c, d)}</p></div></li>`)}</ul></section>`;
}

function band(c: PageCtx): Html {
  return html`<section class="band"><div><h2>${tr(c, 'pub.band_title')}</h2><p>${tr(c, 'pub.band_body')}</p></div>
${orderLink(c, html`${icon('camera', 18)}<span>${tr(c, 'pub.cta')}</span>`, 'btn-gold')}</section>`;
}

function posterBlock(c: PageCtx, posters: Poster[], products: Product[] = []): Html {
  const byId = new Map(products.map((x) => [x.id, x]));
  const hero = html`<section class="hero-night">
<div class="hero-night-copy"><p class="hero-brand">HLUXURY</p><h1>${tr(c, 'pub.default_title')}</h1><p class="hero-lead">${tr(c, 'pub.default_body')}</p>
<div class="hero-actions"><a class="btn-gold" href="/san-pham">${tr(c, 'pub.see_products')}</a>${orderLink(c, tr(c, 'pub.cta'), 'btn-line')}</div></div>
<div class="hero-night-art" aria-hidden="true">${lineSandals()}</div></section>`;
  if (!posters.length) return hero;
  return html`${hero}<section class="posters-wrap" aria-roledescription="carousel" aria-label="HLUXURY">
<div class="posters" tabindex="0">${posters.map((p, i) => {
    if (p.layout === 'promo') return promoPoster(c, p, i, posters.length, byId);
    const title = pick(p.title, c.lang), cta = pick(p.ctaLabel, c.lang);
    return html`<article class="poster" aria-roledescription="slide" aria-label="${i + 1} / ${posters.length}">
<div class="poster-img">${p.imageKey ? html`<img src="${mediaUrl(p.imageKey)}" alt="" ${i === 0 ? raw('fetchpriority="high"') : raw('loading="lazy"')} decoding="async">` : html`<div class="hero-art" aria-hidden="true">${sandal('#c96a3a', '#1b3b2c', 150)}${sandal('#f2d7a6', '#1b3b2c', 150)}</div>`}
${pick(p.tag, c.lang) ? html`<span class="chip-lime poster-tag">${pick(p.tag, c.lang)}</span>` : ''}</div>
<div class="hero-copy"><h2 class="h1-like">${title}</h2>
${pick(p.body, c.lang) ? html`<p>${pick(p.body, c.lang)}</p>` : ''}
${cta && p.ctaHref ? html`<div class="hero-actions"><a class="btn-cta" href="${p.ctaHref}">${cta} ${icon('arrow', 18)}</a></div>` : ''}</div>
</article>`;
  })}</div>
${posters.length > 1 ? html`<div class="dots" aria-hidden="true">${posters.map((_, i) => html`<span class="${i === 0 ? 'on' : ''}"></span>`)}</div>` : ''}
</section>`;
}

function styleChips(c: PageCtx, styles: { id: string; name: Record<Lang, string> }[], active: string | null): Html {
  if (!styles.length) return html``;
  return html`<nav class="chips" aria-label="${tr(c, 'pub.styles')}">
<a href="/san-pham" ${!active ? raw('aria-current="page"') : ''}>${tr(c, 'pub.all')}</a>
${styles.map((s) => html`<a href="/san-pham?kieu=${encodeURIComponent(s.id)}" ${active === s.id ? raw('aria-current="page"') : ''}>${pick(s.name, c.lang)}</a>`)}
</nav>`;
}

function collectionCard(c: PageCtx, col: Collection): Html {
  return html`<a class="ccard" href="/bo-suu-tap/${col.id}" style="--c:${col.color}">
${col.coverKey ? html`<img src="${mediaUrl(col.coverKey)}" alt="" loading="lazy" decoding="async">` : html`<span class="ccard-art" aria-hidden="true">${sandal('#f2d7a6', '#132f24', 190)}</span>`}
<span class="ccard-copy"><strong>${pick(col.title, c.lang)}</strong><span>${pick(col.subtitle, c.lang) || tr(c, 'pub.n_items', { n: col.productIds.length })} →</span></span>
</a>`;
}

function steps(c: PageCtx): Html {
  const s = [['pub.step1', 'pub.step1_sub'], ['pub.step2', 'pub.step2_sub'], ['pub.step3', 'pub.step3_sub']] as const;
  return html`<section class="steps-band"><h2>${tr(c, 'pub.steps_title')}</h2><ol class="steps">${s.map(([a, b], i) =>
    html`<li><span class="step-n">${i + 1}</span><strong>${tr(c, a)}</strong><span>${tr(c, b)}</span></li>`)}</ol></section>`;
}

// ---- pages ----
async function home(req: Request, env: Env): Promise<Response> {
  const c = await ctxOf(req, env);
  const h = await getPublicHome(env);
  const cols = h.collections.filter((x) => x.productIds.length);
  const body = html`
${posterBlock(c, h.posters, h.products)}
${gallery(c, h.gallery)}
${why(c)}
${h.products.length ? styleChips(c, h.styles, null) : ''}
${cols.length ? html`<section class="section" id="chu-de"><div class="section-head"><h2>${tr(c, 'pub.collections')}</h2></div>
<div class="hscroll">${cols.map((col) => collectionCard(c, col))}</div></section>` : ''}
${h.products.length ? html`<section class="section" id="noi-bat"><div class="section-head"><h2>${tr(c, 'pub.featured')}</h2><a href="/san-pham">${tr(c, 'pub.see_all')} →</a></div>
${grid(c, h.products.slice(0, 12))}</section>` : ''}
${steps(c)}
${band(c)}`;
  const legacy = raw(`<script>if(location.hash.indexOf('#/')===0)location.replace('/quan-ly'+location.hash)</script>`);
  const og = h.posters.find((p) => p.imageKey)?.imageKey ?? h.products[0]?.colors[0]?.imageKey;
  return send(renderPage(c, { title: 'HLUXURY · ' + tr(c, 'pub.default_title'), description: tr(c, 'pub.meta_desc'), ogImage: og, body, headExtra: legacy }));
}

async function products(req: Request, env: Env): Promise<Response> {
  const c = await ctxOf(req, env);
  const h = await getPublicHome(env);
  const kieu = new URL(req.url).searchParams.get('kieu');
  const list = kieu ? h.products.filter((p) => p.styleId === kieu) : h.products;
  const body = html`<section class="section page-top"><h1>${tr(c, 'pub.all_products')}</h1>
${styleChips(c, h.styles, kieu)}
${list.length ? grid(c, list) : html`<p class="muted">${tr(c, 'pub.no_products')}</p>`}</section>`;
  return send(renderPage(c, { title: tr(c, 'pub.all_products') + ' · HLUXURY', description: tr(c, 'pub.meta_desc'), ogImage: list[0]?.colors[0]?.imageKey, body }));
}

async function materialNames(env: Env, ids: (string | null)[]): Promise<Map<string, Record<Lang, string>>> {
  const want = ids.filter((x): x is string => !!x);
  const m = new Map<string, Record<Lang, string>>();
  if (!want.length) return m;
  const rows = (await env.DB.prepare(`SELECT id, name_vi, name_en, name_km FROM materials WHERE id IN (${want.map(() => '?').join(',')})`).bind(...want).all<any>()).results;
  for (const r of rows) m.set(r.id, { vi: r.name_vi ?? '', en: r.name_en ?? '', km: r.name_km ?? '' });
  return m;
}

async function productPage(req: Request, env: Env, p: Record<string, string>): Promise<Response> {
  const c = await ctxOf(req, env);
  const prod = await getPublicProduct(env, p.slug, c.user);
  if (!prod) return notFound(c);
  const mats = await materialNames(env, [prod.styleId, prod.soleId, prod.strapId]);
  const spec = ([['pub.style', prod.styleId], ['pub.sole', prod.soleId], ['pub.strap', prod.strapId]] as const)
    .filter(([, id]) => id && mats.get(id!)).map(([k, id]) => html`<div><dt>${tr(c, k)}</dt><dd>${pick(mats.get(id!)!, c.lang)}</dd></div>`);
  const first = prod.colors[0];
  const name = pick(prod.name, c.lang), desc = pick(prod.desc, c.lang);
  const orderUrl = `/tai-khoan#/dat-hang?san-pham=${encodeURIComponent(prod.slug)}`;
  const colors = c.user
    ? html`<fieldset class="swatches"><legend>${tr(c, 'pub.colors')}</legend><p class="small muted">${tr(c, 'pub.pick_colors')}</p>
${prod.colors.map((col, i) => html`<label class="swatch" data-color-id="${col.id}" data-img="${mediaUrl(col.imageKey)}"><input type="checkbox" name="mau" value="${col.id}" ${i === 0 ? raw('checked') : ''}><img src="${mediaUrl(col.imageKey)}" alt="" loading="lazy"><span>${pick(col.name, c.lang)}</span></label>`)}
</fieldset>`
    : first ? html`<div class="swatches"><p class="legend">${tr(c, 'pub.colors')}</p><span class="swatch" data-color-id="${first.id}"><img src="${mediaUrl(first.imageKey)}" alt="" loading="lazy"><span>${pick(first.name, c.lang)}</span></span></div>` : '';
  const lines = c.user && prod.lines.length
    ? html`<div class="lines"><p class="legend">${tr(c, 'pub.size_lines')}</p><ul>${prod.lines.map((l) => html`<li><strong>${pick(l.label, c.lang)}</strong> <span>${l.sizeFrom}–${l.sizeTo}</span></li>`)}</ul></div>`
    : '';
  const body = html`<article class="product page-top">
<div class="product-media">${first ? html`<img id="product-img" src="${mediaUrl(first.imageKey)}" alt="${name}" fetchpriority="high">` : sandal('#f2d7a6', '#1b3b2c', 220)}
${prod.isNew ? html`<span class="badge-new">${tr(c, 'pub.new')}</span>` : ''}</div>
<div class="product-info">
<nav class="crumbs" aria-label="breadcrumb"><a href="/">${tr(c, 'pub.home')}</a> / <a href="/san-pham">${tr(c, 'pub.all_products')}</a></nav>
<h1>${name}</h1>
${desc ? html`<p class="lead">${desc}</p>` : ''}
${spec.length ? html`<dl class="spec">${spec}</dl>` : ''}
${colors}
${lines}
${c.user ? '' : html`<p class="locked">${icon('lock', 16)} ${tr(c, 'pub.login_to_see')}</p>`}
</div></article>`;
  const product = { '@context': 'https://schema.org', '@type': 'Product', name, description: desc || undefined, brand: { '@type': 'Brand', name: 'HLUXURY' },
    image: first ? c.origin + mediaUrl(first.imageKey) : undefined };
  const ld = raw(`<script type="application/ld+json">${JSON.stringify(product).replace(/</g, '\\u003c')}</script>`);
  return send(renderPage(c, { title: `${name} · HLUXURY`, description: desc || tr(c, 'pub.meta_desc'), ogImage: first?.imageKey, body, headExtra: ld,
    action: { label: tr(c, 'pub.order_this'), next: orderUrl, kind: 'order' } }));
}

async function collectionPage(req: Request, env: Env, p: Record<string, string>): Promise<Response> {
  const c = await ctxOf(req, env);
  const col = (await listCollections(env, true)).find((x) => x.id === p.id);
  if (!col) return notFound(c);
  const all = await listProducts(env, { publicOnly: true });
  const byId = new Map(all.map((x) => [x.id, x]));
  const list = col.productIds.map((id) => byId.get(id)).filter((x): x is Product => !!x);
  const title = pick(col.title, c.lang), sub = pick(col.subtitle, c.lang);
  const body = html`<section class="col-hero" style="--c:${col.color}">${col.coverKey ? html`<img src="${mediaUrl(col.coverKey)}" alt="" fetchpriority="high">` : ''}
<div class="col-hero-copy"><span class="eyebrow">${tr(c, 'pub.collections')}</span><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div></section>
<section class="section">${list.length ? grid(c, list) : html`<p class="muted">${tr(c, 'pub.no_products')}</p>`}</section>`;
  return send(renderPage(c, { title: `${title} · HLUXURY`, description: sub || tr(c, 'pub.meta_desc'), ogImage: col.coverKey ?? list[0]?.colors[0]?.imageKey, body }));
}

function notFound(c: PageCtx): Response {
  const body = html`<section class="section page-top empty-state"><h1>${tr(c, 'pub.not_found')}</h1><p><a class="btn-cta" href="/">${tr(c, 'pub.back_home')}</a></p></section>`;
  return send(renderPage(c, { title: tr(c, 'pub.not_found') + ' · HLUXURY', description: tr(c, 'pub.meta_desc'), body, indexable: false, cta: false }), 404, false);
}

export function publicSiteRoutes(r: Router) {
  r.on('GET', '/', home);
  r.on('GET', '/san-pham', products);
  r.on('GET', '/san-pham/:slug', productPage);
  r.on('GET', '/bo-suu-tap/:id', collectionPage);

  r.on('GET', '/robots.txt', async (req, env) => {
    const o = originOf(env, req);
    const lines = ['User-agent: *', 'Allow: /', ...['/quan-ly', '/tai-khoan', '/dang-nhap', '/dang-ky', '/quen-mat-khau', '/dat-lai-mat-khau', '/q/', '/api/', '/img/']
      .map((p) => `Disallow: ${p}`), `Sitemap: ${o}/sitemap.xml`, ''];
    return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600', 'x-indexable': '1' } });
  });

  r.on('GET', '/sitemap.xml', async (req, env) => {
    const o = originOf(env, req);
    const [ps, cols] = await Promise.all([listProducts(env, { publicOnly: true }), listCollections(env, true)]);
    const urls = ['/', '/san-pham', ...ps.map((p) => `/san-pham/${p.slug}`), ...cols.map((x) => `/bo-suu-tap/${x.id}`)];
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(o + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
    return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600', 'x-indexable': '1' } });
  });
}
