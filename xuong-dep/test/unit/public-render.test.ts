import { beforeEach, expect, test } from 'bun:test';
import type { Env } from '../../src/worker/env';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';

let env: Env;
let admin: string;
const jpeg = new Uint8Array([0xff, 0xd8, 4, 4, 0xff, 0xd9]);
const upPub = async () => (await call(env, 'POST', '/api/content/images?w=1&h=1', jpeg, admin, { 'content-type': 'image/jpeg' })).body.key as string;
const LINES = [{ key: 'nam', label: { vi: 'Nam', en: 'Men', km: 'បុរស' }, sizeFrom: 39, sizeTo: 44 }];

async function product(name: string, extra: Record<string, unknown> = {}) {
  const img = await upPub();
  return (await call(env, 'POST', '/api/products', {
    name: { vi: name, en: name + ' EN' }, published: true, lines: LINES,
    colors: [{ name: { vi: 'Đen' }, imageKey: img }, { name: { vi: 'Kem' }, imageKey: await upPub() }], ...extra,
  }, admin)).body;
}
async function customer() {
  return cookieFrom(await call(env, 'POST', '/api/register', { name: 'Khách', phone: '0901234567', email: 'k@k.vn', password: 'mat-khau-123', country: 'VN', lang: 'vi' }));
}

beforeEach(async () => { env = await createTestEnv(); admin = await loginCookie(env); });

test('home HTML contains poster title and product names server-side', async () => {
  await call(env, 'POST', '/api/posters', { title: { vi: 'Mùa hè rực rỡ', en: 'Bright summer' }, tag: { vi: 'MỚI · HÈ 2027' }, published: true, imageKey: await upPub() }, admin);
  await product('Kẹp đế êm');
  await call(env, 'PUT', '/api/shop', { address: '', messenger: '', ceo: { name: 'Anh Tình', phone: '0901 234 567' }, sales: { name: 'Chị Hoa', phone: '012 345 678' } }, admin);
  const r = await call(env, 'GET', '/');
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toContain('text/html');
  expect(r.headers.get('x-robots-tag')).toBeNull();
  const html = r.body as string;
  expect(html).toContain('<meta name="robots" content="index,follow">');
  expect(html).toContain('Mùa hè rực rỡ');
  expect(html).toContain('MỚI · HÈ 2027');
  expect(html).toContain('Kẹp đế êm');
  // no address typed: the capital of Cambodia
  expect(html).toContain('Phnom Penh, Campuchia');
  expect(html).toContain('Tổng giám đốc');
  expect(html).toContain('Anh Tình');
  expect(html).toContain('Quản lý bán hàng');
  expect(html).toContain('href="tel:012345678"');
  expect(html).toContain('Gửi ảnh nhận báo giá');
  // the Zalo button reaches the sales manager
  expect(html).toContain('href="https://zalo.me/012345678"');
  expect(html).toContain('href="https://zalo.me/0901234567"');
  // English by ?lang=
  const en = (await call(env, 'GET', '/?lang=en')).body as string;
  expect(en).toContain('<html lang="en"');
  expect(en).toContain('Bright summer');
  expect(en).toContain('Kẹp đế êm EN');
});

test('empty site shows the default HLUXURY hero and hides empty sections', async () => {
  const html = (await call(env, 'GET', '/')).body as string;
  expect(html).toContain('Dép đẹp, làm theo ý bạn.');
  expect(html).not.toContain('id="noi-bat"');
  expect(html).not.toContain('id="chu-de"');
});

test('brand-logo product absent', async () => {
  await product('Mẫu thường');
  await product('Mẫu có logo', { hasBrandLogo: true });
  const home = (await call(env, 'GET', '/')).body as string;
  expect(home).toContain('Mẫu thường');
  expect(home).not.toContain('Mẫu có logo');
  expect((await call(env, 'GET', '/san-pham/mau-co-logo')).status).toBe(404);
  expect((await call(env, 'GET', '/san-pham')).body).not.toContain('Mẫu có logo');
});

test("guest product page has one colour and no size lines; logged-in has all", async () => {
  const p = await product('Quai ngang');
  const guest = await call(env, 'GET', `/san-pham/${p.slug}`);
  expect(guest.status).toBe(200);
  const g = guest.body as string;
  expect(g).toContain('<h1');
  expect(g).toContain('Quai ngang');
  expect((g.match(/data-color-id=/g) ?? []).length).toBe(1);
  expect(g).not.toContain('39–44');
  expect(g).toContain('Đăng nhập để xem đủ màu và size');
  expect(g).toContain('data-need-login');
  // the guest can actually load the picture it is shown
  const key = p.colors[0].imageKey as string;
  expect((await call(env, 'GET', '/media/' + key)).status).toBe(200);

  const cust = await customer();
  const c = (await call(env, 'GET', `/san-pham/${p.slug}`, undefined, cust)).body as string;
  expect((c.match(/data-color-id=/g) ?? []).length).toBe(2);
  expect(c).toContain('39–44');
  expect(c).not.toContain('data-need-login="order"');
});

test("HTML escapes '<script>' in product names", async () => {
  await product('<script>alert(1)</script> & "x"');
  const html = (await call(env, 'GET', '/')).body as string;
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;');
});

test('collection page lists its products; unknown pages are 404 and noindex', async () => {
  const a = await product('Đi biển A');
  const col = (await call(env, 'POST', '/api/collections', { title: { vi: 'Đi biển cuối tuần' }, color: '#c96a3a', published: true, productIds: [a.id] }, admin)).body;
  const html = (await call(env, 'GET', `/bo-suu-tap/${col.id}`)).body as string;
  expect(html).toContain('Đi biển cuối tuần');
  expect(html).toContain('Đi biển A');
  const miss = await call(env, 'GET', '/san-pham/khong-co');
  expect(miss.status).toBe(404);
  expect(miss.headers.get('x-robots-tag')).toBe('noindex');
});

test('robots.txt allows / and disallows /quan-ly /tai-khoan /q/', async () => {
  const r = await call(env, 'GET', '/robots.txt');
  expect(r.status).toBe(200);
  const t = r.body as string;
  expect(t).toContain('Allow: /\n');
  for (const p of ['/quan-ly', '/tai-khoan', '/q/', '/api/']) expect(t).toContain(`Disallow: ${p}\n`);
  expect(t).toContain('Sitemap: https://xuong.test/sitemap.xml');
});

test('sitemap lists home, products and collections', async () => {
  const p = await product('Dép sitemap');
  const col = (await call(env, 'POST', '/api/collections', { title: { vi: 'BST' }, published: true, productIds: [p.id] }, admin)).body;
  const x = (await call(env, 'GET', '/sitemap.xml')).body as string;
  expect(x).toContain('<loc>https://xuong.test/</loc>');
  expect(x).toContain(`<loc>https://xuong.test/san-pham/${p.slug}</loc>`);
  expect(x).toContain(`<loc>https://xuong.test/bo-suu-tap/${col.id}</loc>`);
});

test('legacy phase-1 admin bookmarks (/#/orders/…) still reach /quan-ly', async () => {
  const html = (await call(env, 'GET', '/')).body as string;
  expect(html).toContain("location.replace('/quan-ly'+location.hash)");
});

test('promo poster: highlight line, badge, accent, stats and colour grid come from its product', async () => {
  const p = await product('Dép kẹp nam quai bản to');
  const r = await call(env, 'POST', '/api/posters', {
    layout: 'promo', productId: p.id, accent: '#E2B65B', published: true,
    tag: { vi: 'HÀNG MỚI VỀ' }, title: { vi: 'DÉP KẸP' }, highlight: { vi: 'NAM' }, body: { vi: 'Quai bản to, lót êm chân.' },
    badge: { vi: 'Mẫu hot · Đen' }, ctaLabel: { vi: 'Nhận báo giá' },
  }, admin);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ layout: 'promo', productId: p.id, accent: '#E2B65B', highlight: { vi: 'NAM', en: '', km: '' } });
  const html = (await call(env, 'GET', '/')).body as string;
  expect(html).toContain('class="poster promo"');
  expect(html).toContain('--accent:#E2B65B');
  expect(html).toContain('DÉP KẸP');
  expect(html).toContain('<span class="hl">NAM</span>');
  expect(html).toContain('Mẫu hot · Đen');
  // stats and swatches from the product: 2 colours, size 39–44, each colour picture + name
  expect(html).toMatch(/class="promo-stat"><strong>2<\/strong>/);
  expect(html).toContain('39–44');
  expect((html.match(/class="promo-swatch"/g) ?? []).length).toBe(2);
  // no button link given: the button opens the product
  expect(html).toContain(`href="/san-pham/${p.slug}"`);
  expect(html).toContain('class="promo-bar"');
});

test('promo poster rejects a colour that is not #rrggbb and falls back when its product is hidden', async () => {
  const p = await product('Mẫu sẽ ẩn');
  expect((await call(env, 'POST', '/api/posters', { layout: 'promo', title: { vi: 'X' }, accent: 'red;background:url(x)' }, admin)).body.accent).toBe('#E2B65B');
  await call(env, 'POST', '/api/posters', { layout: 'promo', productId: p.id, title: { vi: 'Poster còn lại' }, published: true }, admin);
  await call(env, 'PUT', `/api/products/${p.id}`, { ...p, published: false }, admin);
  const html = (await call(env, 'GET', '/')).body as string;
  expect(html).toContain('Poster còn lại');
  expect(html).not.toContain('class="promo-swatch"');
  expect(html).not.toContain(`/san-pham/${p.slug}`);
});
