import { beforeEach, expect, test } from 'bun:test';
import { createTestEnv } from '../helpers/env';
import { call, cookieFrom, loginCookie } from '../helpers/http';
import { item, line, sampleOrder, uid } from '../helpers/orders';
import type { Env } from '../../src/worker/env';

let env: Env;
let admin: string;
const jpeg = new Uint8Array([0xff, 0xd8, 3, 3, 0xff, 0xd9]);
async function customer(n: number) {
  const c = cookieFrom(await call(env, 'POST', '/api/register', { name: `K${n}`, phone: `09012345${10 + n}`, email: `k${n}@k.vn`, password: 'mat-khau-123', country: 'VN', lang: 'vi' }));
  return { c, customerId: (await call(env, 'GET', '/api/me', undefined, c)).body.customerId as string };
}
const upAdmin = async () => (await call(env, 'POST', '/api/images?w=1&h=1', jpeg, admin, { 'content-type': 'image/jpeg' })).body.key as string;
const upPub = async () => (await call(env, 'POST', '/api/content/images?w=1&h=1', jpeg, admin, { 'content-type': 'image/jpeg' })).body.key as string;

beforeEach(async () => {
  env = await createTestEnv(); admin = await loginCookie(env);
  // these tests are about who sees which design, not about order size: no wholesale minimum here
  await call(env, 'PUT', '/api/settings', { minOrderPairs: 0 }, admin);
});

async function customerPhotoOrder(c: string, isPrivate: boolean) {
  const up = async () => (await call(env, 'POST', '/api/c/images?w=1&h=1', jpeg, c, { 'content-type': 'image/jpeg' })).body;
  const photo = await up(), crop = await up();
  const o = { id: uid('order'), neededBy: null, note: '', deliverNote: '', isPrivate, images: [{ id: photo.id, key: photo.key, width: 1, height: 1 }],
    items: [item(1, { imageId: photo.id, cropKey: crop.key, colorNote: 'đỏ đô', lines: [line({ qtyEach: 1 })] })] };
  expect((await call(env, 'PUT', `/api/c/orders/${o.id}`, o, c)).status).toBe(200);
  return o;
}

test('private-ticked design absent from another customer\'s library; visible one present without original image', async () => {
  const a = await customer(1), b = await customer(2);
  const priv = await customerPhotoOrder(a.c, true);
  const pub = await customerPhotoOrder(a.c, false);
  const lib = (await call(env, 'GET', '/api/c/library', undefined, b.c)).body;
  const ids = lib.items.map((x: any) => x.id);
  expect(ids).toContain(pub.items[0].designId);
  expect(ids).not.toContain(priv.items[0].designId);
  const entry = lib.items.find((x: any) => x.id === pub.items[0].designId);
  expect(entry).toMatchObject({ cropKey: pub.items[0].cropKey, note: 'đỏ đô', orderCount: 1 });
  expect(JSON.stringify(lib)).not.toContain(pub.images[0].key);
  expect(Object.keys(entry).sort()).toEqual(['cropKey', 'id', 'note', 'orderCount', 'soleId', 'strapId', 'styleId']);
  expect((await call(env, 'GET', '/api/c/library')).status).toBe(401);
});

test('hidden design absent; popular sort by orderCount', async () => {
  const a = await customer(1), b = await customer(2);
  const o1 = await customerPhotoOrder(a.c, false);
  const o2 = await customerPhotoOrder(a.c, false);
  // reorder o2's design twice → most ordered
  for (let i = 0; i < 2; i++) {
    const ob = { id: uid('order'), neededBy: null, note: '', deliverNote: '', isPrivate: false, images: [],
      items: [{ ...item(1), designId: o2.items[0].designId, imageId: null, crop: null, cropKey: '', lines: [line({ qtyEach: 1 })] }] };
    expect((await call(env, 'PUT', `/api/c/orders/${ob.id}`, ob, b.c)).status).toBe(200);
  }
  const pop = (await call(env, 'GET', '/api/c/library?sort=popular', undefined, b.c)).body.items;
  expect(pop[0]).toMatchObject({ id: o2.items[0].designId, orderCount: 3 });
  expect((await call(env, 'PUT', `/api/designs/${o1.items[0].designId}`, { hidden: true }, admin)).status).toBe(200);
  const ids = (await call(env, 'GET', '/api/c/library', undefined, b.c)).body.items.map((x: any) => x.id);
  expect(ids).not.toContain(o1.items[0].designId);
  const d = (await call(env, 'GET', `/api/designs/${o1.items[0].designId}`, undefined, admin)).body;
  expect(d).toMatchObject({ hidden: true, isPrivate: false, hasBrandLogo: false, source: 'customer' });
});

test('brand-logo product absent from public home, present for admin', async () => {
  const img = await upPub();
  const mk = (name: string, hasBrandLogo: boolean) => call(env, 'POST', '/api/products',
    { name: { vi: name }, published: true, hasBrandLogo, lines: [{ key: 'nam', label: { vi: 'Nam', en: 'Men', km: 'បុរស' }, sizeFrom: 39, sizeTo: 44 }], colors: [{ name: { vi: 'Đen' }, imageKey: img }] }, admin);
  expect((await mk('Kẹp HLUXURY', false)).status).toBe(200);
  expect((await mk('Kẹp logo hãng', true)).status).toBe(200);
  const { getPublicHome } = await import('../../src/worker/repo/products');
  const home = await getPublicHome(env);
  expect(home.products.map((p) => p.name.vi)).toEqual(['Kẹp HLUXURY']);
  expect((await call(env, 'GET', '/api/products', undefined, admin)).body).toHaveLength(2);
});

test('colour pointing at a customer-sourced crop → 400; admin crop and pub image ok', async () => {
  const a = await customer(1);
  const o = await customerPhotoOrder(a.c, false);
  const r = await call(env, 'POST', '/api/products', { name: { vi: 'X' }, colors: [{ name: { vi: 'Đỏ' }, imageKey: o.items[0].cropKey }] }, admin);
  expect(r.status).toBe(400);
  expect(r.body.code).toBe('customer_photo_not_allowed');
  const c = await call(env, 'GET', '/api/customers', undefined, admin);
  const so = sampleOrder(c.body[0].id, { items: [item(1, { cropKey: await upAdmin() })] });
  await call(env, 'PUT', `/api/orders/${so.id}`, so, admin);
  expect((await call(env, 'POST', '/api/products', { name: { vi: 'Y' }, colors: [{ name: { vi: 'Đỏ' }, imageKey: so.items[0].cropKey, designId: so.items[0].designId }] }, admin)).status).toBe(200);
});

test('guest sees first colour only and no size lines; logged-in sees everything', async () => {
  const [i1, i2] = [await upPub(), await upPub()];
  const p = (await call(env, 'POST', '/api/products', { name: { vi: 'Kẹp quai mảnh', en: 'Thin strap' }, published: true,
    lines: [{ key: 'nu', label: { vi: 'Nữ', en: 'Women', km: 'នារី' }, sizeFrom: 35, sizeTo: 40 }],
    colors: [{ name: { vi: 'Kem' }, imageKey: i1 }, { name: { vi: 'Đen' }, imageKey: i2 }] }, admin)).body;
  expect(p.slug).toBe('kep-quai-manh');
  const { getPublicProduct } = await import('../../src/worker/repo/products');
  const guest = await getPublicProduct(env, p.slug, null);
  expect(guest!.colors).toHaveLength(1);
  expect(guest!.lines).toEqual([]);
  const a = await customer(1);
  const full = (await call(env, 'GET', `/api/c/products/${p.slug}`, undefined, a.c)).body;
  expect(full.colors).toHaveLength(2);
  expect(full.lines[0]).toMatchObject({ key: 'nu', sizeFrom: 35, sizeTo: 40 });
});
