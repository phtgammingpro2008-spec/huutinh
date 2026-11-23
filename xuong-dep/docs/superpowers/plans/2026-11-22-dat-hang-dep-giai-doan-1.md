# Xưởng dép — Phase 1 (order intake & quoting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first web app on Cloudflare Workers where the workshop owner turns customers' chat photos into structured sandal orders (tap-to-tag, size ranges, materials, auto totals), quotes them in VND/USD, sends a vi/en/km quote link the customer can accept, keeps a design library, and prints/exports production sheets.

**Architecture:** One Cloudflare Worker serves a JSON API, the public quote page and the embedded React SPA. Data in D1 (raw SQL through a minimal `Db` interface), images in R2. Pure business logic (totals, money, status rules, i18n) lives in `src/shared` and is used by both worker and client. Locally the worker runs under Bun with a SQLite-backed D1 shim and a filesystem R2 shim; the build emits a single `dist/worker.js` plus `dist/schema.sql`.

**Tech Stack:** TypeScript, Bun 1.4 (build, test, dev server, `bun:sqlite`), React 19 (from `/opt/npm-tools/node_modules`, symlinked), Playwright 1.63 library with Chromium at `/opt/pw-browsers`, Web Crypto, Canvas 2D. **No npm installs are possible in this environment**: no Hono, Drizzle, Vite, wrangler or @types/react.

**Spec:** `docs/superpowers/specs/2026-11-22-dat-hang-dep-giai-doan-1-design.md`

## Global Constraints

- Admin UI copy is Vietnamese. Quote page supports exactly `vi`, `en`, `km`, switchable on the page; Khmer text uses Noto Sans Khmer (Google Fonts link) with system fallback.
- Currencies are exactly `VND` and `USD`, one per order. Money is stored as integer minor units: VND = đồng, USD = cents.
- Every order is quoted; there are no list prices.
- Order statuses, in order: `cho_bao_gia` (Chờ báo giá) → `da_bao_gia` (Đã báo giá) → `khach_dong_y` (Khách đã đồng ý) → `dang_san_xuat` (Đang sản xuất) → `da_giao` (Đã giao) → `hoan_tat` (Hoàn tất), plus `da_huy` (Đã hủy).
- Pair counts and money totals are always computed from item lines (`src/shared/totals.ts`); never stored as hand-entered fields. Quote versions store a snapshot.
- Default size lines: `nam` Nam 39–44, `nu` Nữ 35–40 (editable in Settings; more lines can be added).
- "Allow showing design to customers" defaults to **false**. The library is admin-only in phase 1.
- Production sheet shows **no prices**. It is available from `khach_dong_y` onward. Print is A4 portrait, large type. Image export splits into several PNGs so each stays readable on a phone.
- Images are compressed client-side to a long edge ≤ 2000 px, JPEG quality 0.8, before upload. Each item crop is uploaded as its own image. Originals are kept untouched otherwise.
- Quote links use a random token of ≥ 32 URL-safe chars. Quote page, quote images and the admin app send `X-Robots-Tag: noindex` plus `<meta name="robots" content="noindex">`.
- Editing quantities or prices on a `khach_dong_y` order sets it back to `da_bao_gia` and creates a new quote version that must be accepted again. Quantities and prices are locked from `dang_san_xuat` onward.
- Works on iOS Safari, Android Chrome and desktop Chrome/Edge/Safari. Touch targets ≥ 44 px. Installable PWA.
- The worker uses only Web-standard APIs plus the D1/R2 binding methods listed in Task 2, so the same code runs on Cloudflare and under the Bun shims.

## Review Focus

1. **iPhone photos that the browser cannot decode (HEIC on non-Safari, corrupt files):** a clear Vietnamese error on that file; the other selected photos still load. Test in Task 9.
2. **Tapping on or near an existing tag:** a tap inside an existing tag's label circle selects that tag instead of creating a duplicate. Test in Task 9.
3. **Changing a line's size range after per-size counts were typed:** counts for sizes still in range are kept, new sizes start at 0, and the total updates. Test in Task 1.
4. **Double-tapping "Lưu" or a flaky network retry:** saving is idempotent on the client-generated order id, so it produces one order, not two. Test in Task 5.
5. **Customer opens an old or cancelled quote link:** they always see the latest version. Accepting a stale version is rejected with "báo giá đã thay đổi, vui lòng tải lại" in their language. A cancelled order shows no accept button. Test in Task 6.

---

## File Structure

```
package.json, tsconfig.json, bunfig.toml, .gitignore
node_modules/{react,react-dom,scheduler} -> /opt/npm-tools/node_modules/*   (symlinks, created by scripts/link-deps.sh)
schema/schema.sql                    D1 schema + default settings rows
src/shared/types.ts                  DTOs shared by API and client
src/shared/totals.ts                 sizes, qty, money math, line normalisation
src/shared/money.ts                  format/parse minor units per currency+lang
src/shared/status.ts                 statuses, labels, transitions, lock rules
src/shared/i18n.ts                   vi/en/km dictionaries for quote page + quote message templates
src/worker/env.ts                    Db/R2 minimal interfaces, Env type
src/worker/index.ts                  fetch entry: routing table, noindex, assets
src/worker/router.ts                 tiny method+pattern router
src/worker/http.ts                   json(), err(), readJson(), id/token generators
src/worker/auth.ts                   PBKDF2 hashing, sessions, requireAuth
src/worker/repo/*.ts                 SQL per aggregate (customers, materials, settings, orders, designs, quotes, payments)
src/worker/routes/*.ts               handlers per area (auth, customers, materials, settings, images, orders, designs, quotes, public, payments, export)
src/worker/assets.gen.ts             GENERATED by build: embedded client files
src/client/admin/main.tsx, App.tsx   admin SPA (hash routing)
src/client/admin/api.ts              typed fetch wrapper
src/client/admin/pages/*.tsx         Login, Home, Orders, OrderEditor, OrderDetail, Customers, Library, Settings
src/client/admin/components/*.tsx    ImageTagger, LineEditor, ItemForm, TotalsBar, PriceHistory, ProductionSheet
src/client/lib/image.ts              decode/compress/crop to Blob
src/client/lib/tagger-geometry.ts    pure geometry for taps/crop boxes
src/client/lib/draft.ts              localStorage autosave of the order being edited
src/client/lib/sheet-png.ts          production sheet → PNG pages (Canvas 2D)
src/client/quote/main.tsx            public quote page bundle
src/client/public/                   index.html, quote.html, styles.css, manifest.webmanifest, sw.js, icons
dev/d1-sqlite.ts, dev/r2-fs.ts       local shims
dev/server.ts                        Bun.serve around the worker
scripts/build.ts                     bundle client → generate assets.gen.ts → bundle dist/worker.js, copy schema
test/unit/*.test.ts                  shared + worker API tests (bun test)
test/e2e/*.test.ts                   Playwright (iPhone 13 viewport) against dev server
test/helpers/env.ts                  createTestEnv(), loginCookie()
test/fixtures/                       sample images generated with sharp in Task 9
docs/TRIEN-KHAI.md                   Vietnamese deploy + backup guide
```

## Shared types (defined in Task 1, used everywhere)

```ts
type Currency = 'VND' | 'USD'; type Lang = 'vi' | 'en' | 'km';
type OrderStatus = 'cho_bao_gia'|'da_bao_gia'|'khach_dong_y'|'dang_san_xuat'|'da_giao'|'hoan_tat'|'da_huy';
type Box = { x: number; y: number; w: number; h: number };          // fractions 0..1 of the source image
type Line = { id: string; lineKey: string; sizeFrom: number; sizeTo: number;
              mode: 'even' | 'per_size' | 'total'; qtyEach: number; perSize: Record<string, number>;
              unitPrice: number | null };                            // minor units
type Item = { id: string; designId: string; imageId: string | null; tagNo: number;
              tapX: number | null; tapY: number | null; crop: Box | null; cropKey: string;
              soleId: string | null; strapId: string | null; styleId: string | null;
              colorNote: string; lines: Line[] };
type OrderInput = { id: string; customerId: string; currency: Currency; neededBy: string | null;
              note: string; allowPublic: boolean; images: { id: string; key: string; width: number; height: number }[];
              items: Item[] };
type LineSetting = { key: string; label: Record<Lang, string>; sizeFrom: number; sizeTo: number };
```

---

### Task 1: Scaffold + shared business logic

**Files:**
- Create: `package.json` (scripts: `test` = `bun test test/unit`, `e2e` = `bun test test/e2e --timeout 60000`, `build` = `bun scripts/build.ts`, `dev` = `bun scripts/build.ts && bun dev/server.ts`), `tsconfig.json` (jsx `react-jsx`, strict), `.gitignore` (`node_modules`, `dist`, `dev-data`, `src/worker/assets.gen.ts`), `scripts/link-deps.sh`
- Create: `src/shared/types.ts`, `src/shared/totals.ts`, `src/shared/money.ts`, `src/shared/status.ts`
- Test: `test/unit/totals.test.ts`, `test/unit/money.test.ts`, `test/unit/status.test.ts`

**Interfaces:**
- Produces: the types above; `sizesOf(l: Line): number[]`; `lineQty(l: Line): number`; `itemQty(i: Item): number`; `orderQty(items: Item[]): number`; `lineAmount(l: Line): number | null`; `orderAmount(items: Item[]): { amount: number; missingPrice: boolean }`; `resizeLine(l: Line, from: number, to: number): Line`; `formatMoney(minor: number, c: Currency, lang: Lang): string`; `parseMoney(input: string, c: Currency): number | null`; `STATUSES: OrderStatus[]`; `STATUS_LABEL_VI: Record<OrderStatus,string>`; `canTransition(from, to): boolean`; `qtyPriceLocked(s: OrderStatus): boolean`; `printable(s: OrderStatus): boolean`.

- [ ] **Step 1:** Run `bash scripts/link-deps.sh` (symlinks react, react-dom, scheduler into `node_modules`). Verify `bun -e "import('react').then(r=>console.log(r.version))"` prints `19.2.8`.
- [ ] **Step 2: Write failing tests**
  - `even mode 39–44 × 235 = 1410` (the sample order: lineQty = 1410).
  - `per_size mode sums only sizes in range` ({39:10,40:20,41:5}, range 39–40 → 30).
  - `total mode ignores the range` (mode `total`, qtyEach 30, range 39–44 → 30). This is the "30 30" customer note: 30 Nam + 30 Nữ per design, size split left to the workshop.
  - `5 items × (30 nam + 30 nữ) in total mode → orderQty 300`.
  - `even mode nam 39–44 × 30 → 180`.
  - `resizeLine keeps counts and zero-fills` (per_size {39:5,40:6}, resize 38–40 → {38:0,39:5,40:6}, qty 11) **(Review Focus 3)**.
  - `orderAmount flags missing price` (one line unitPrice null → missingPrice true, amount sums the priced lines).
  - `lineAmount` = qty × unitPrice (47000 đ × 1410 = 66,270,000).
  - money: `formatMoney(66270000,'VND','vi') === '66.270.000 ₫'`; `formatMoney(1890,'USD','en') === '$18.90'`; `parseMoney('47k','VND') === 47000`; `parseMoney('18.9','USD') === 1890`; `parseMoney('abc','VND') === null`.
  - status: `canTransition('cho_bao_gia','da_bao_gia')` true; `('hoan_tat','cho_bao_gia')` false; any → `da_huy` true except from `hoan_tat`; `qtyPriceLocked('dang_san_xuat')` true, `('khach_dong_y')` false; `printable('da_bao_gia')` false, `('khach_dong_y')` true.
- [ ] **Step 3:** Run `bun test test/unit` → FAIL (modules missing).
- [ ] **Step 4:** Implement. `parseMoney` accepts `k` (×1,000) and `tr` (×1,000,000) suffixes for VND and `.`/`,` thousands separators for VND, decimal point for USD. Forward transitions may skip steps forward. Backward is only `khach_dong_y → da_bao_gia` (system-driven re-quote).
- [ ] **Step 5:** `bun test test/unit` → PASS. Commit `feat: shared totals, money, status`.

### Task 2: Schema, D1/R2 shims, test env

**Files:**
- Create: `schema/schema.sql`, `src/worker/env.ts`, `dev/d1-sqlite.ts`, `dev/r2-fs.ts`, `test/helpers/env.ts`
- Test: `test/unit/schema.test.ts`

**Interfaces:**
- Produces: `interface Db { prepare(sql: string): Stmt; batch(s: Stmt[]): Promise<unknown[]> }`, `interface Stmt { bind(...v: unknown[]): Stmt; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> }`, `interface Bucket { put(key: string, body: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>; get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>; delete(key: string): Promise<void> }`, `type Env = { DB: Db; IMAGES: Bucket; APP_URL?: string }`; `sqliteDb(path: string): Db` (batch runs in one transaction); `fsBucket(dir: string): Bucket`; `createTestEnv(): Promise<Env>` (in-memory DB with schema applied, temp dir bucket).
- Tables (snake_case, TEXT ids, ISO timestamps): `users`, `sessions(token, user_id, expires_at)`, `customers`, `materials(id, kind 'sole'|'strap'|'style', name_vi, name_en, name_km, hidden)`, `settings(key PRIMARY KEY, value JSON)`, `orders(id, code UNIQUE, customer_id, status, currency, needed_by, note, allow_public, quote_token UNIQUE, quote_version, created_at, quoted_at, accepted_at, updated_at)`, `order_images(id, order_id NULL, key, width, height, position)`, `designs(id, crop_key, image_id, crop JSON, label 'co_dinh'|'dat_rieng', sole_id, strap_id, style_id, note, allow_public, created_at)`, `order_items(id, order_id, design_id, image_id, tag_no, tap_x, tap_y, crop JSON, sole_id, strap_id, style_id, color_note, position)`, `item_lines(id, item_id, line_key, size_from, size_to, mode, qty_each, per_size JSON, unit_price, position)`, `quotes(id, order_id, version, snapshot JSON, sent_at, accepted_at)`, `payments(id, order_id, amount, paid_on, note)`. Seed `settings`: `lines` = the default size lines with labels vi `Nam`/`Nữ`, en `Men`/`Women`, km `បុរស`/`នារី`; `quote_message` per lang (Task 6 fills the text).

- [ ] **Step 1: Failing tests:** `schema applies to empty sqlite`, `default lines setting is Nam 39–44 and Nữ 35–40`, `batch rolls back on error` (second statement violates UNIQUE → first insert absent), `fsBucket put/get round-trips bytes and contentType`.
- [ ] **Step 2:** `bun test test/unit/schema.test.ts` → FAIL.
- [ ] **Step 3:** Implement shims with `bun:sqlite` and `node:fs/promises` (dev only; never imported by `src/worker`).
- [ ] **Step 4:** PASS. Commit `feat: schema and local D1/R2 shims`.

### Task 3: Worker core — router, HTTP helpers, auth

**Files:**
- Create: `src/worker/router.ts`, `src/worker/http.ts`, `src/worker/auth.ts`, `src/worker/routes/auth.ts`, `src/worker/index.ts`
- Test: `test/unit/auth.test.ts`

**Interfaces:**
- Produces: `class Router { on(method, pattern: string, h: Handler) }` with `:param` segments; `type Handler = (req: Request, env: Env, p: Record<string,string>, ctx: { userId?: string }) => Promise<Response>`; `json(data, status=200)`; `err(status, messageVi)` → `{ error: string }`; `newId()` (crypto.randomUUID); `newToken(len=40)` (URL-safe base64 of random bytes); `hashPassword(pw): Promise<string>` (PBKDF2-SHA256, 100k iterations, `pbkdf2$iter$salt$hash`); `verifyPassword(pw, stored): Promise<boolean>`; `requireAuth` wraps handlers; `export default { fetch(req, env) }` in index.ts.
- Endpoints: `POST /api/setup {name,password}` (only when `users` is empty, else 409); `POST /api/login` sets `sid` cookie (HttpOnly, Secure, SameSite=Lax, Max-Age 90 days); `POST /api/logout`; `GET /api/me`. All `/api/*` except setup, login and `/api/public/*` require auth (401 `{error:'Chưa đăng nhập'}`). Every response carries `X-Robots-Tag: noindex`.

- [ ] **Step 1: Failing tests:** `setup creates first admin then refuses a second`, `login with wrong password → 401`, `login sets sid cookie with HttpOnly and 90-day Max-Age`, `GET /api/me without cookie → 401, with cookie → user name`, `logout invalidates session`, `unknown route → 404 json`, `every response has X-Robots-Tag noindex`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit `feat: worker router and auth`.

### Task 4: Customers, materials, settings, image upload

**Files:**
- Create: `src/worker/repo/customers.ts`, `repo/materials.ts`, `repo/settings.ts`, `src/worker/routes/customers.ts`, `routes/materials.ts`, `routes/settings.ts`, `routes/images.ts`
- Test: `test/unit/catalog.test.ts`, `test/unit/images.test.ts`

**Interfaces:**
- Produces endpoints: `GET /api/customers?q=` (name/zalo contains), `POST /api/customers {name, zalo?, messenger?, country?, lang='vi', currency='VND', note?}` (only `name` required), `PUT /api/customers/:id`, `GET /api/customers/:id` (includes `orders: {id, code, status, createdAt, totalQty}[]`); `GET /api/materials?kind=` (hidden excluded unless `all=1`), `POST /api/materials {kind, nameVi, nameEn?, nameKm?}`, `PUT /api/materials/:id {..., hidden}`; `GET /api/settings` → `{ lines: LineSetting[], quoteMessage: Record<Lang,string> }`, `PUT /api/settings`; `POST /api/images?w=&h=` (raw body, `Content-Type: image/jpeg|image/png|image/webp`, ≤ 8 MB) → `{ id, key }` with key `img/<yyyy>/<mm>/<uuid>.jpg`; `GET /img/<key>` (auth) streams with `Cache-Control: private, max-age=31536000, immutable`.
- Validation: lang ∈ vi/en/km, currency ∈ VND/USD, kind ∈ sole/strap/style; errors are Vietnamese.

- [ ] **Step 1: Failing tests:** `create customer with name only uses vi + VND defaults`, `reject currency EUR with 400 'Chỉ nhận VND hoặc USD'`, `hidden material excluded from default list`, `settings round-trip keeps Nam 39–44`, `upload rejects text/plain with 415`, `upload > 8 MB → 413`, `uploaded image served back with same bytes and requires auth`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit `feat: customers, materials, settings, images API`.

### Task 5: Orders and designs API

**Files:**
- Create: `src/worker/repo/orders.ts`, `repo/designs.ts`, `src/worker/routes/orders.ts`, `routes/designs.ts`
- Test: `test/unit/orders.test.ts`, `test/unit/designs.test.ts`

**Interfaces:**
- Consumes: totals (Task 1), Db/Bucket (Task 2), auth (Task 3).
- Produces: `PUT /api/orders/:id` with body `OrderInput` → full `OrderView` (create if new, otherwise replace images/items/lines in one `batch`). Order `code` = `DH` + `yyMMdd` + `-` + 3-digit sequence per day (e.g. `DH261122-001`), assigned on create and never changed. `GET /api/orders/:id` → `OrderView = OrderInput & { code, status, quoteVersion, quoteToken|null, customer, totals: { qty, amount, missingPrice }, paid, due, createdAt, quotedAt, acceptedAt }`. `GET /api/orders?status=&customerId=&q=&from=&to=` (q matches code or customer name) → summaries. `GET /api/dashboard` → `{ waitingQuote, justAccepted (accepted in last 7 days, status khach_dong_y), dueSoon (neededBy within 7 days, not hoan_tat/da_huy), unpaid (due > 0 and status ≥ khach_dong_y) }`.
- Designs: on save, each item with `designId` not yet in `designs` creates a design row (label `dat_rieng`, materials copied, `allow_public` = order.allowPublic). `POST /api/library { images, items }` saves designs only (no order). `GET /api/designs?label=&soleId=&strapId=&styleId=&q=` (q in note), `GET /api/designs/:id` (includes orders that used it), `PUT /api/designs/:id { label, note, allowPublic, soleId, strapId, styleId }`.
- Rules: qty/price changes on `khach_dong_y` → status `da_bao_gia`, `quote_version + 1`, new `quotes` snapshot (Task 6 builds the snapshot: call `createQuoteVersion(env, orderId)` — Task 5 calls a stub that Task 6 fills). Saving with changed qty/price when `qtyPriceLocked(status)` → 409 `'Đơn đang sản xuất, không sửa số lượng/giá được'`. Note/neededBy edits are always allowed.

- [ ] **Step 1: Failing tests:** `create sample order (9 items, nam 39–44 even, counts 85,25,18,20,17,13,25,14,18) → totals.qty 1410`, `code format DH261122-001 then -002 same day` (inject clock), `PUT same id twice creates one order` **(Review Focus 4)**, `replace drops removed items and lines`, `saving creates designs with label dat_rieng and allow_public false by default`, `library-only save creates designs and no order`, `edit qty on khach_dong_y → status da_bao_gia, quoteVersion+1`, `edit qty on dang_san_xuat → 409`, `edit note on dang_san_xuat → 200`, `dashboard buckets`, `list filter by q matches customer name 'Nga'`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit `feat: orders and design library API`.

### Task 6: Quotes, price history, public quote

**Files:**
- Create: `src/shared/i18n.ts`, `src/worker/repo/quotes.ts`, `src/worker/routes/quotes.ts`, `src/worker/routes/public.ts`
- Test: `test/unit/quotes.test.ts`, `test/unit/i18n.test.ts`

**Interfaces:**
- Produces: `PUT /api/orders/:id/prices { prices: { lineId, unitPrice }[] }` (rejected when locked); `GET /api/price-history?soleId=&strapId=&styleId=` → up to 10 `{ unitPrice, currency, date, customerName, orderCode }`, newest first, only lines from orders whose status is at least `da_bao_gia`, matching all three ids (null matches null); `POST /api/orders/:id/send-quote` → requires every line priced (else 400 `'Còn dòng chưa có giá'`), creates token if missing, writes `quotes` snapshot version, sets `da_bao_gia` when currently `cho_bao_gia`, returns `{ url, message, zaloUrl|null, messengerUrl|null, version }`. `url` = `${APP_URL or request origin}/q/${token}`. `zaloUrl` = `https://zalo.me/` + digits of customer zalo. `message` = `quoteMessage[customer.lang]` with `{code}`, `{url}`, `{total}` replaced. `createQuoteVersion(env, orderId)` snapshot = `{ version, currency, neededBy, items: [{ tagNo, cropKey, materials:{sole,strap,style names in all 3 langs}, colorNote, lines:[{lineKey, label, sizeFrom, sizeTo, sizes:{size:qty}, qty, unitPrice, amount}] }], totalQty, totalAmount }`.
- Public: `GET /api/public/quote/:token` → `{ code, status, lang (customer default), snapshot (latest version), acceptedVersion|null }`, 404 for unknown token; `POST /api/public/quote/:token/accept { version }` → 200 sets `khach_dong_y`, `accepted_at`, `quotes.accepted_at`; 409 `{ error: t(lang,'quote.changed') }` if `version` ≠ latest; 409 if order `da_huy`; idempotent when already accepted at that version. `GET /q/:token/img/:itemIndex` serves that item's crop without auth (only for valid tokens).
- `i18n.ts`: `t(lang: Lang, key: QuoteKey, vars?)`; keys cover page title, column headers, size, pairs, unit price, amount, total, needed-by, accept button, accepted state, cancelled state, `quote.changed` ("Báo giá đã thay đổi, vui lòng tải lại trang" / "This quote has changed, please reload" / Khmer equivalent), language names, and default `quoteMessage` per lang. Khmer strings are marked `// TODO-REVIEW-KM` for a native speaker.

- [ ] **Step 1: Failing tests:** `every QuoteKey exists in vi, en and km`, `send-quote refuses when a line has no price`, `send-quote message is in customer's language and contains code and url`, `zaloUrl strips non-digits ('090 123-4567' → https://zalo.me/0901234567)`, `token length ≥ 32 and URL-safe`, `public quote shows latest version after edit` **(Review Focus 5)**, `accept stale version → 409 with localized message`, `accept on cancelled order → 409`, `accept twice same version → 200 both`, `price history returns previous 47000 for same sole/strap/style and ignores cho_bao_gia orders`, `public crop image served without auth for valid token, 404 for wrong token`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit `feat: quotes, price history, public quote API`.

### Task 7: Status, payments, export

**Files:**
- Create: `src/worker/repo/payments.ts`, `src/worker/routes/payments.ts`, `src/worker/routes/export.ts`; modify `routes/orders.ts`
- Test: `test/unit/payments.test.ts`

**Interfaces:**
- Produces: `POST /api/orders/:id/status { to }` (validated by `canTransition`, 409 Vietnamese error otherwise); `POST /api/orders/:id/payments { amount, paidOn, note }`, `DELETE /api/orders/:id/payments/:pid`; `OrderView.paid` / `.due` (due = totals.amount − paid, never negative in display); `GET /api/export` → JSON of all tables (`Content-Disposition: attachment; filename="xuong-dep-backup-<date>.json"`).

- [ ] **Step 1: Failing tests:** `illegal transition hoan_tat → cho_bao_gia rejected`, `cancel from da_bao_gia allowed`, `two payments reduce due`, `export contains orders and designs and is attachment`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: status changes, payments, export`.

### Task 8: Client foundation — build, dev server, shell, login, PWA

**Files:**
- Create: `scripts/build.ts`, `dev/server.ts`, `src/client/public/{index.html,quote.html,styles.css,manifest.webmanifest,sw.js}`, `src/client/public/icons/` (192/512 PNG generated with sharp from an SVG drawn in the script), `src/client/admin/{main.tsx,App.tsx,api.ts}`, `src/client/admin/pages/Login.tsx`
- Modify: `src/worker/index.ts` (serve embedded assets: `/` → index.html, `/q/:token` → quote.html, `/assets/*`)
- Test: `test/e2e/helpers.ts` (start dev server on a free port with fresh `dev-data`, launch Chromium with `devices['iPhone 13']`), `test/e2e/login.test.ts`

**Interfaces:**
- Produces: `api<T>(method, path, body?): Promise<T>` (throws `ApiError{status,message}`, redirects to `#/login` on 401); hash routes `#/`, `#/orders`, `#/orders/new`, `#/orders/:id`, `#/orders/:id/edit`, `#/customers`, `#/library`, `#/settings`; bottom tab bar (Trang chủ, Đơn hàng, + Đơn mới, Thư viện, Cài đặt). Build: `Bun.build` for `admin/main.tsx` and `quote/main.tsx` (minify, `define process.env.NODE_ENV="production"`), then writes `assets.gen.ts` (`export const ASSETS: Record<string, { type: string; body: string }>` with base64 for binaries), then bundles `src/worker/index.ts` to `dist/worker.js` (ESM), copies `schema/schema.sql` to `dist/`. Service worker caches the app shell only, never `/api` or `/img`.
- First run with no users shows a "Tạo tài khoản quản trị" form (setup), otherwise login.

- [ ] **Step 1: Failing e2e:** `first visit shows setup form, creating admin lands on Trang chủ`, `reload keeps session`, `wrong password shows 'Sai mật khẩu'`, `manifest is served and linked`.
- [ ] **Step 2:** `bun run build && bun test test/e2e/login.test.ts` → FAIL. **Step 3:** Implement. **Step 4:** PASS, and `dist/worker.js` exists and is < 1 MB gzipped. Commit `feat: client shell, build, PWA, login`.

### Task 9: Image tagging

**Files:**
- Create: `src/client/lib/image.ts`, `src/client/lib/tagger-geometry.ts`, `src/client/admin/components/ImageTagger.tsx`, `test/fixtures/make-fixtures.ts` (sharp: a 3000×2000 JPEG grid of 6 coloured blocks, a 1×1 PNG, a corrupt `.jpg`)
- Test: `test/unit/tagger-geometry.test.ts`, `test/e2e/tagger.test.ts`

**Interfaces:**
- Produces: `defaultBox(tapX, tapY, imgAspect): Box` (square-ish box of 22% image width centred on the tap, clamped inside 0..1); `clampBox(b: Box): Box`; `moveCorner(b: Box, corner: 'nw'|'ne'|'sw'|'se', x, y): Box` (min size 5%); `hitTag(tags: {tagNo,tapX,tapY}[], x, y, radius): number | null`; `compressImage(file: File): Promise<{ blob, width, height }>` (long edge ≤ 2000, JPEG 0.8; throws `ImageError('Không đọc được ảnh này: <tên file>')`); `cropToBlob(img, box): Promise<Blob>`. `<ImageTagger image tags onAdd(tap,box) onSelect(tagNo) onBoxChange(tagNo,box) onWholeImage() />` renders the image fitted to width, numbered circles (≥ 32 px) and draggable corner handles (≥ 44 px hit area), and supports pinch-zoom by not blocking native zoom.

- [ ] **Step 1: Failing tests:** `defaultBox near the right edge stays inside image`, `moveCorner never inverts or goes below 5%`, `hitTag returns existing tag within radius` **(Review Focus 2)**; e2e: `tap on image adds tag 1 with a box`, `tap on tag 1 label selects it, no tag 2 is created`, `'Cả ảnh là 1 mẫu' creates one tag with full box`, `selecting the corrupt file shows 'Không đọc được ảnh này' and the other photo still loads` **(Review Focus 1)**, `uploaded original long edge is 2000 px`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: image tagger with crops and compression`.

### Task 10: Order editor

**Files:**
- Create: `src/client/admin/pages/OrderEditor.tsx`, `components/ItemForm.tsx`, `components/LineEditor.tsx`, `components/TotalsBar.tsx`, `components/CustomerPicker.tsx`, `components/MaterialPicker.tsx`, `components/DesignPicker.tsx`, `src/client/lib/draft.ts`
- Test: `test/e2e/order-editor.test.ts`

**Interfaces:**
- Consumes: ImageTagger (Task 9), totals (Task 1), `PUT /api/orders/:id`, `POST /api/library`, customers/materials/settings/designs endpoints.
- Produces: the order editor at `#/orders/new` and `#/orders/:id/edit`. A client `id` (uuid) is generated when the editor opens. Flow: customer picker (search or "+ Khách mới" with name only) → "Chọn ảnh" (multiple) → per image tagger → per tag an `ItemForm` (lines with a three-way toggle "Đều mỗi size" / "Từng size" / "Tổng số đôi", size range defaulting from settings line, "+ Dòng Nữ" / "+ Dòng Nam"; sole/strap/style pickers; color note) → order fields (ngày cần hàng, ghi chú, "Cho khách xem mẫu này" default off) → sticky `TotalsBar` "Tổng: N đôi" → "Lưu". "+ Mẫu từ thư viện" adds an item from a design (no image). A "Chỉ lưu vào thư viện" toggle switches save to `POST /api/library`. Drafts autosave to `localStorage` key `draft:<orderId>` every change (debounced 500 ms) and are offered on reopen ("Tiếp tục đơn đang nhập dở?"); cleared after a successful save. The save button is disabled while saving.

- [ ] **Step 1: Failing e2e:** `enter the sample order (9 tags, Nam 39–44, counts 85…18) shows 'Tổng: 1.410 đôi' and saves with status Chờ báo giá`, `nam+nữ 30/30 'Đều mỗi size' on one item shows 360 đôi with default ranges`, `same item in 'Tổng số đôi' mode shows 60 đôi`, `reload mid-entry offers the draft and restores tags and counts`, `item from library adds without uploading a photo`, `library-only mode creates designs and no order`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: order editor`.

### Task 11: Order detail, quoting UI, dashboard, lists, customers, settings

**Files:**
- Create: `src/client/admin/pages/{Home,Orders,OrderDetail,Customers,Settings}.tsx`, `components/PriceHistory.tsx`, `components/StatusBar.tsx`, `components/Payments.tsx`
- Test: `test/e2e/quoting.test.ts`, `test/e2e/admin-pages.test.ts`

**Interfaces:**
- Consumes: Tasks 5–7 endpoints.
- Produces: OrderDetail shows items (crop, materials, lines, qty), per-line price input (`parseMoney`, shows formatted value) with a `PriceHistory` chip list (tap fills the price), totals, "Gửi báo giá" → sheet with the message text, "Sao chép tin nhắn" (Clipboard API), "Mở Zalo", "Mở Messenger", status buttons for allowed next statuses, "Hủy đơn" with confirm, payments list/add, "Phiếu làm hàng" button (Task 13), "Sửa đơn". When quantities are locked, editor opens read-only for qty/price with the lock message. Home shows the four dashboard buckets. Orders list has status chips, a search box (mã đơn or tên khách) and a from/to date filter. Customers page: list, edit, order history. Settings: materials by kind (add/edit/hide, names vi/en/km), size lines (add/edit), quote message per lang, "Tải bản sao lưu" (export), "Đăng xuất".

- [ ] **Step 1: Failing e2e:** `price the sample order at 47k → total 66.270.000 ₫`, `price history chip shows 47.000 ₫ on a second order with same materials and fills on tap`, `send quote shows message containing the order code and a /q/ link`, `editing qty after customer accepted shows status Đã báo giá again`, `add payment 20.000.000 ₫ shows còn lại 46.270.000 ₫`, `dashboard lists the order under Chờ báo giá before quoting`, `settings: hide a material removes it from the picker`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: quoting UI and admin pages`.

### Task 12: Public quote page

**Files:**
- Create: `src/client/quote/main.tsx`, `src/client/quote/QuotePage.tsx`; modify `src/client/public/quote.html` (Noto Sans Khmer link, noindex meta)
- Test: `test/e2e/quote-page.test.ts`

**Interfaces:**
- Consumes: public endpoints (Task 6), `t()` (Task 6), `formatMoney` (Task 1).
- Produces: page at `/q/:token` rendering the latest snapshot: per item crop image, material names in the chosen language (falls back to vi), size table, unit price, amount, total pairs, total amount, needed-by date; a language switcher (Tiếng Việt / English / ខ្មែរ) defaulting to the customer's lang and remembered in `localStorage`; a large "Đồng ý báo giá" button (localized) that posts the shown version and then shows the accepted state; cancelled orders show the cancelled notice and no button; a stale-version 409 shows the localized "changed" message and a reload button.

- [ ] **Step 1: Failing e2e:** `customer with lang km sees Khmer accept button and Khmer font loaded`, `switching to English shows 'Accept quote' and USD formatted $18.90`, `accept → admin order shows Khách đã đồng ý`, `after admin edits, the open page's accept shows the changed message`, `cancelled order hides the button`, `page has robots noindex meta`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: public quote page`.

### Task 13: Production sheet (print + PNG)

**Files:**
- Create: `src/client/admin/components/ProductionSheet.tsx`, `src/client/lib/sheet-png.ts`, print CSS in `styles.css` (`@page { size: A4 portrait; margin: 12mm }`)
- Test: `test/unit/sheet-layout.test.ts`, `test/e2e/production-sheet.test.ts`

**Interfaces:**
- Consumes: `OrderView` (Task 5), material names, `printable(status)`.
- Produces: route `#/orders/:id/sheet` showing the sheet (header: mã đơn, tên khách, ngày cần hàng; per item: crop ≥ 45% page width, tag number, Đế/Quai/Kiểu in Vietnamese, màu/ghi chú, size table per line with pair counts and item total, or for `total` lines "N đôi — chia size theo chuẩn xưởng"; footer: tổng số đôi). Body text ≥ 16 pt. No prices or money anywhere. Buttons "In phiếu" (`window.print()`) and "Lưu ảnh để gửi Zalo". `paginateItems(items, perPage=3): Item[][]` and `renderSheetPngs(order): Promise<Blob[]>` (1080 px wide, one PNG per page, shared via `navigator.share` with files when available, else downloads). Button hidden with a note when `!printable(status)`.

- [ ] **Step 1: Failing tests:** `paginateItems(9 items) → 3 pages`; e2e: `sheet for accepted sample order shows 1.410 đôi and contains no '₫' or '$'`, `sheet route for a Chờ báo giá order shows 'Đơn chưa chốt'`, `PNG export produces 3 images 1080 px wide`, `print media emulation fits each page within A4`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: production sheet print and image export`.

### Task 14: Library screen

**Files:**
- Create: `src/client/admin/pages/Library.tsx`, `components/DesignCard.tsx`
- Test: `test/e2e/library.test.ts`

**Interfaces:**
- Consumes: designs endpoints (Task 5), DesignPicker reuse (Task 10).
- Produces: grid of crops with label badge ("Mẫu cố định" / "Mẫu đặt riêng"), filters (label, kiểu, đế, quai) and note search; design detail with editable label/materials/note, "Cho khách xem" toggle (default off), list of orders that used it, "Tạo đơn từ mẫu này" (opens the editor with the item prefilled).

- [ ] **Step 1: Failing e2e:** `designs from the sample order appear (9 cards)`, `filter by label Mẫu cố định after relabelling one shows 1`, `'Tạo đơn từ mẫu này' opens editor with that item and no photo upload`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: design library screen`.

### Task 15: Release bundle, deploy guide, backup handoff

**Files:**
- Create: `docs/TRIEN-KHAI.md` (Vietnamese: create Cloudflare account; create D1 `xuong-dep` and run `schema.sql` in the D1 console; create R2 bucket `xuong-dep-anh`; create a Worker, paste `dist/worker.js`, bind `DB` and `IMAGES`, set `APP_URL`; open `https://<name>.workers.dev`, create the admin account; add to iPhone home screen; or run `wrangler deploy` with the included `wrangler.toml` when npm is available; how to download a backup from Cài đặt), `wrangler.toml`
- Test: `test/e2e/dist-smoke.test.ts`

**Interfaces:**
- Consumes: everything.
- Produces: `dist/worker.js`, `dist/schema.sql`, `xuong-dep-<date>.zip` (source without node_modules/dev-data, plus dist).

- [ ] **Step 1: Failing test:** `dist smoke: dev server importing dist/worker.js (not src) completes setup → create order → send quote → accept on quote page`.
- [ ] **Step 2:** FAIL until `dev/server.ts` accepts `--dist`. **Step 3:** Implement. **Step 4:** `bun test test/unit && bun test test/e2e` all PASS. Commit `chore: release bundle and deploy guide`. Then build the zip and hand it to the user.
