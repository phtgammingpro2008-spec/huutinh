# Web đặt hàng cho khách (giai đoạn 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the running phase-1 workshop app into the HLUXURY site: a public SEO homepage + product pages, self-service customer accounts (unique phone+email), customer ordering from photos/products/shared library, a customer account area, admin user/product/homepage management, all in the Kho Việt look with light/dark mode and a globe language switch.

**Architecture:** Same single Cloudflare Worker, D1, R2. Three areas: public pages `/` (server-rendered HTML strings in the worker, plus a small React "island" bundle for header controls and the login modal), customer SPA `/tai-khoan` (new React bundle), admin SPA `/quan-ly` (existing admin bundle, moved and restyled). Auth pages `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau` live in the customer bundle. Schema changes are additive D1 migrations in `migrations/`, applied by the Cloudflare build before `wrangler deploy`.

**Tech Stack:** TypeScript, Bun (build/test/dev), React 19, Playwright 1.63 (Chromium), Cloudflare Workers/D1/R2, wrangler 4, `lucide-react` (stroke icons), Resend HTTP API for email (enabled only when `RESEND_API_KEY` + `MAIL_FROM` are configured).

**Spec:** `docs/superpowers/specs/2026-11-23-web-dat-hang-khach-design.md` (phase 1: `2026-11-22-dat-hang-dep-giai-doan-1-design.md`)

## Global Constraints

- Brand name **HLUXURY** everywhere customer-facing (logo text, `<title>`, quote message signature, email sender name).
- Areas: public `/`, customer `/tai-khoan`, admin `/quan-ly`. A customer session never reaches any admin API or page.
- Kho Việt palette — light: bg `#f6f5ef`, paper `#fffcf5`, ink `#212d23`, muted `#535e51`, line `#dfdfd3`, forest `#1b3b2c`, forest-dark `#132f24`, mint `#e7efdb`, lime `#e8f3a3`, danger `#a43c30`, clay `#c96a3a`. Dark: bg `#0f1f18`, card `#162a21`, ink `#f3f1e7`, line `#2a4034`, accent stays lime `#e8f3a3` with forest-dark text. Fonts: Playfair Display (headings), Inter (body), Noto Sans Khmer (km). Production sheet print stays black on white.
- Globe language button (vi/en/km) and sun/moon theme button in the header of every area; theme default follows `prefers-color-scheme`, choice remembered.
- Guests see: homepage, collections, product list (photo, name, style). Login required for: all colours, size lines, product detail ordering, library, orders, quotes.
- Registration: display name, phone, email, password ≥ 8 + confirm, country (`VN`|`KH`), language. Phone (normalised) and email (lowercased) each unique across users. Currency default VND for VN, USD for KH.
- Login by phone, email, or (admin) name. Password reset by emailed one-time link, 1 hour expiry; admin can also generate a reset link (24 h). Locked accounts cannot log in; locking revokes sessions.
- Library: every order design is visible to logged-in customers unless `is_private` (ticked "Mẫu đặt riêng") or `hidden` (admin). Other customers see only the crop + style/sole/strap/colour note — never the original photo, orderer, quantities or prices. `has_brand_logo` designs never appear on guest-visible pages.
- Customer cancels when status is `cho_bao_gia` or `da_bao_gia`; edits only when `cho_bao_gia` and `quote_version = 0`. Customer never sees or sends prices except their own quote.
- All goods ship to Cambodia: order has `deliver_note` (free text), no VN/KH choice.
- Migrations are additive; prod data (admin user `Admin001`, settings) must survive.

## Review Focus

1. **Cross-customer access by id guessing:** customer B calling any `/api/c/*` route or `/media/*` with customer A's order/image ids gets 404 (not 403, not data). Test in Task 2 and Task 4.
2. **Phone/email written differently:** `0901 234 567`, `+84901234567`, `84-901-234-567` are the same phone; `An@Mail.com` equals `an@mail.com`; second registration is refused with the localized "đã có tài khoản" message. Test in Task 2.
3. **Library leaks:** a design from an order ticked "Mẫu đặt riêng", a hidden design, and any original photo never appear in another customer's library/API; a brand-logo design never appears in guest HTML. Test in Task 5.
4. **Customer double-tap / retries on "Gửi đơn":** idempotent on client order id like phase 1 — one order. Test in Task 4.
5. **Moved admin URL:** an old bookmark `/#/orders/<id>` (phase-1 home-screen icon) lands the admin on `/quan-ly#/orders/<id>`. Test in Task 7.

---

## File Structure

```
migrations/0001_phase2a.sql              additive schema (users cols, designs/orders cols, products, colours, collections, posters, uploads, tokens, rate limits)
src/shared/phone.ts                      normalizePhone, isEmail, normalizeEmail
src/shared/i18n-ui.ts                    vi/en/km UI strings for public + customer areas (keys listed in Task 7)
src/worker/roles.ts                      currentUser(), requireAdmin(), requireCustomer(), optionalUser()
src/worker/ratelimit.ts                  hitLimit()
src/worker/email.ts                      sendEmail() (Resend) + templates
src/worker/media.ts                      canViewKey(), media route
src/worker/repo/users.ts                 user CRUD, register, lock, tokens
src/worker/repo/products.ts              products, colours, collections, posters, shop info
src/worker/repo/library.ts               customer-visible library queries
src/worker/routes/account.ts             /api/register, /api/login (modified), /api/password/*, /api/email/verify
src/worker/routes/customer.ts            /api/c/* (orders, library, products, images, profile)
src/worker/routes/users.ts               /api/users/* (admin)
src/worker/routes/content.ts             /api/products|collections|posters|shop (admin CRUD)
src/worker/public/render.ts              page shell, escape(), header/footer, theme+lang bootstrap
src/worker/public/pages.ts               home, products list/detail, collection HTML
src/client/ui/                           shared: theme.ts, LangGlobe.tsx, ThemeToggle.tsx, icons.ts, tokens in styles.css
src/client/public/island.tsx             public header controls + login modal + guest gating
src/client/customer/                     main.tsx, App.tsx, api.ts, pages/{Auth,Orders,OrderView,NewOrder,Library,Profile}.tsx
src/client/admin/pages/{Users,Content}.tsx new admin pages (+ edits to existing)
test/unit/{migrations,accounts,authz,customer-orders,library,content,users}.test.ts
test/e2e/{guest,register,customer-order,customer-account,admin-users,theme-lang}.test.ts
```

---

### Task 1: Migrations + build pipeline

**Files:**
- Create: `migrations/0001_phase2a.sql`, `test/unit/migrations.test.ts`
- Modify: `test/helpers/env.ts` (apply schema then every `migrations/*.sql` in name order), `dev/server.ts` (same), `wrangler.toml` (`migrations_dir = "migrations"` under the D1 binding)

**Interfaces:**
- Produces tables/columns (snake_case): `users.phone TEXT`, `users.email TEXT`, `users.email_verified_at TEXT`, `users.customer_id TEXT`, `users.locked INTEGER DEFAULT 0` + partial unique indexes on phone and email (`WHERE … IS NOT NULL`); `customers.country` exists; `orders.source TEXT DEFAULT 'admin'`, `orders.seen_by_admin INTEGER DEFAULT 1`, `orders.deliver_note TEXT DEFAULT ''`, `orders.cancel_reason TEXT DEFAULT ''`, `orders.cancelled_by TEXT`; `designs.is_private INTEGER DEFAULT 0`, `designs.hidden INTEGER DEFAULT 0`, `designs.has_brand_logo INTEGER DEFAULT 0`, `designs.source TEXT DEFAULT 'admin'`; `order_items.product_id TEXT`, `order_items.color_id TEXT`, `order_items.is_private INTEGER DEFAULT 0`; new tables `products(id, slug UNIQUE, name_vi, name_en, name_km, desc_vi, desc_en, desc_km, style_id, sole_id, strap_id, lines JSON, is_new, published, has_brand_logo, position, created_at)`, `product_colors(id, product_id, name_vi, name_en, name_km, image_key, design_id, position)`, `collections(id, title_vi/en/km, subtitle_vi/en/km, cover_key, color, published, position)`, `collection_products(collection_id, product_id, position)`, `posters(id, tag_vi/en/km, title_vi/en/km, body_vi/en/km, image_key, cta_label_vi/en/km, cta_href, published, position)`, `uploads(id, key UNIQUE, user_id, created_at)`, `user_tokens(token PRIMARY KEY, user_id, kind 'reset'|'verify', expires_at, used_at)`, `rate_limits(key PRIMARY KEY, window_start INTEGER, count INTEGER)`; settings row `shop` = `{"zalo":"","messenger":"","workshopAddress":"","warehouseAddress":""}`. Phase-1 `designs.allow_public` stays but is no longer read.
- Users: for customers `users.name` = their normalized phone (keeps the existing UNIQUE NOT NULL), display name lives in `customers.name`.

- [ ] **Step 1: Failing tests:** `migrations apply on top of schema.sql`, `users.phone and users.email are unique when set, multiple NULLs allowed`, `shop setting seeded`, `products slug unique`.
- [ ] **Step 2:** `bun test test/unit/migrations.test.ts` → FAIL (file missing).
- [ ] **Step 3:** Write the SQL and helper changes. Prod-safety: only `ALTER TABLE … ADD COLUMN`, `CREATE TABLE/INDEX IF NOT EXISTS`, `INSERT OR IGNORE`.
- [ ] **Step 4:** `bun test test/unit` → all PASS (phase-1 suite included).
- [ ] **Step 5:** Verify against real D1 locally: `npx wrangler d1 migrations apply xuong-dep --local` on a DB created from `schema.sql` succeeds. Update the Workers Build trigger deploy command (API `PATCH /builds/triggers/16d4acf7-…`) to `npx wrangler d1 migrations apply xuong-dep --remote && npx wrangler deploy`; if the build token lacks D1 edit, tell the owner which permission to add. Before the first remote apply, record the D1 Time Travel bookmark. Commit `feat: phase 2a migrations`.

### Task 2: Accounts, roles, rate limits

**Files:**
- Create: `src/shared/phone.ts`, `src/worker/roles.ts`, `src/worker/ratelimit.ts`, `src/worker/repo/users.ts`, `src/worker/routes/account.ts`, `test/unit/accounts.test.ts`, `test/unit/authz.test.ts`
- Modify: `src/worker/auth.ts` (session lookup returns `{userId, role, customerId, locked}`), every admin route (`requireAuth` → `requireAdmin`), `src/worker/routes/auth.ts` (login identifier, `/api/me` returns role), `src/worker/index.ts`

**Interfaces:**
- Produces: `normalizePhone(input: string): string | null` (digits only; `+84`/`84`/`0` VN → `0XXXXXXXXX`; `+855`/`855`/`0` KH → `0XXXXXXXX`; returns null when < 8 or > 11 digits after normalising); `normalizeEmail(s): string | null`; `type SessionUser = { id: string; role: 'admin'|'customer'; customerId: string|null; name: string }`; `currentUser(req, env): Promise<SessionUser|null>`; `requireAdmin(h)`, `requireCustomer(h)` (handler ctx gets `user: SessionUser`); `hitLimit(env, key: string, max: number, windowSec: number): Promise<boolean>` (true = over limit).
- Endpoints: `POST /api/register {name, phone, email, password, country:'VN'|'KH', lang}` → creates `customers` row (`name`, `zalo` = phone, `country`, `lang`, `currency` VND/USD by country) + `users` row (`role 'customer'`, `name` = normalized phone) + session cookie; errors (localized by body `lang`): `phone_taken`, `email_taken`, `weak_password`, `bad_phone`, `bad_email`. `POST /api/login {id, password}` → id is email if it contains `@`, phone if it normalizes, else admin name; locked → 403 `account_locked`. Limits: login 10 fails / 15 min per identifier and 30 / 15 min per IP (`cf-connecting-ip`); register 5 / hour per IP. `GET /api/me` → `{id, role, name, customerId, lang, emailVerified}`.
- Admin APIs answer a customer session with 404 json (same as unknown route) so they don't reveal admin endpoints. **(plan's call)**

- [ ] **Step 1: Failing tests (accounts):** `normalizePhone variants are equal` (`0901 234 567`, `+84 901234567`, `84-901-234-567` → `0901234567`; `+855 12 345 678` → `012345678`; `abc` → null), `register creates customer+user and logs in`, `second register with same phone written differently → 409 phone_taken`, `same email different case → 409 email_taken`, `currency USD for KH`, `login by phone, by email, admin by name`, `wrong password 11 times → 429`, `locked user login → 403 account_locked`.
- [ ] **Step 2: Failing tests (authz):** for every admin route registered in the router (iterate a list exported by `index.ts` as `ADMIN_ROUTES`), a customer cookie gets 404 and no data; a guest gets 401; admin still 200 on representative routes.
- [ ] **Step 3:** FAIL. **Step 4:** Implement. **Step 5:** `bun test test/unit` PASS. Commit `feat: customer accounts and roles`.

### Task 3: Media ownership

**Files:**
- Create: `src/worker/media.ts`, `test/unit/media.test.ts`
- Modify: `src/worker/routes/images.ts` (admin upload keeps `img/…`; records `uploads`), add `POST /api/c/images` (customer, ≤ 8 MB, 60 uploads/day/user via `hitLimit`), `POST /api/content/images` (admin, keys under `pub/yyyy/mm/uuid.ext`)

**Interfaces:**
- Produces: `canViewKey(env, user: SessionUser|null, key: string): Promise<boolean>` — `pub/…` → everyone; admin → all; customer → key in `uploads` with their user id, OR crop/image of an item in one of their orders, OR crop of a library-visible design (Task 5's `libraryVisibleSql`), OR a `product_colors.image_key` of a published product. Route `GET /media/*` → `serveImage` with `private, max-age=31536000, immutable` (public `pub/` gets `public, max-age=31536000, immutable`); denied → 404.
- Phase-1 `GET /img/*` stays admin-only (admin UI) — customer UI uses `/media/…`.

- [ ] **Step 1: Failing tests:** `customer sees own upload, not another customer's (404)`, `customer sees crop of a visible library design but never its original image`, `pub key served to guest with public cache header`, `admin sees everything`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: media access rules`.

### Task 4: Customer orders API

**Files:**
- Create: `src/worker/routes/customer.ts`, `test/unit/customer-orders.test.ts`
- Modify: `src/worker/order-input.ts` (optional `isPrivate`, `productId`, `colorId` per item; `deliverNote`), `src/worker/repo/orders.ts` (persist new columns; `OrderView` gains `source`, `seenByAdmin`, `deliverNote`, `cancelReason`), `src/worker/routes/orders.ts` (admin GET marks `seen_by_admin = 1`; dashboard adds `newFromCustomers`), `src/worker/repo/designs.ts` (insert `is_private`, `source`)

**Interfaces:**
- Consumes: `requireCustomer`, `canViewKey`, phase-1 `saveOrder` rules.
- Produces: `PUT /api/c/orders/:id` body `{currency?: ignored, neededBy, note, deliverNote, isPrivate: boolean, images, items}` → server sets `customerId` from session, `currency` from customer profile, `source 'customer'`, `seen_by_admin 0`; every `unitPrice` forced to the existing line's price (by line id) or null; designs created with `source 'customer'`, `is_private` = item.isPrivate || order isPrivate; an item may reference (a) a new design with a crop of the customer's own upload, (b) an existing library-visible design id, (c) `productId`+`colorId` of a published product (cropKey = colour image) — anything else 400. Allowed only when the order is new, or theirs with status `cho_bao_gia` and `quote_version = 0`, else 409 `locked_after_quote`.
- `GET /api/c/orders` → own summaries; `GET /api/c/orders/:id` → own `CustomerOrderView` (OrderView minus `customer.note`, `payments[].note` kept, prices only from the latest sent quote snapshot when status ≥ `da_bao_gia`, else none); `POST /api/c/orders/:id/accept {version}` → same rules as public accept; `POST /api/c/orders/:id/cancel {reason}` → allowed in `cho_bao_gia`/`da_bao_gia`, sets `da_huy`, `cancel_reason`, `cancelled_by 'customer'`; otherwise 409 `cannot_cancel`.
- Admin `GET /api/dashboard` adds `newFromCustomers: OrderSummary[]` (`source='customer' AND seen_by_admin=0`); `OrderSummary` gains `source`.

- [ ] **Step 1: Failing tests:** `customer creates order from own photo → cho_bao_gia, source customer, unseen`, `PUT twice same id → one order` (Review Focus 4), `prices sent by customer are ignored`, `customer cannot reference another customer's upload or a private design (400)`, `customer B GET/PUT/accept/cancel on A's order → 404` (Review Focus 1), `edit after quote → 409`, `cancel in da_bao_gia ok, in khach_dong_y → 409`, `accept via account moves to khach_dong_y`, `admin dashboard lists newFromCustomers until admin opens the order`.
- [ ] **Step 2–4:** FAIL → implement → PASS (whole unit suite). Commit `feat: customer orders API`.

### Task 5: Library, products, collections, posters, shop info

**Files:**
- Create: `src/worker/repo/library.ts`, `src/worker/repo/products.ts`, `src/worker/routes/content.ts`, `test/unit/library.test.ts`, `test/unit/content.test.ts`
- Modify: `src/worker/routes/designs.ts` (admin PUT accepts `isPrivate`, `hidden`, `hasBrandLogo`), `src/worker/routes/customer.ts` (library + product reads)

**Interfaces:**
- Produces: `libraryVisibleSql` (SQL fragment `d.is_private = 0 AND d.hidden = 0`) used by Task 3; `GET /api/c/library?styleId=&soleId=&strapId=&q=&sort=new|popular&cursor=` → `{items: {id, cropKey, styleId, soleId, strapId, note, orderCount}[], next}` (no image_id/imageKey/order data); `GET /api/c/products`, `GET /api/c/products/:slug` (full: colours, lines); public JSON for SSR `getPublicHome(env, lang)` / `getPublicProduct(env, slug, user)` (guest: no colours beyond the first, no lines; excludes `has_brand_logo` products and colours whose design has a logo).
- Admin CRUD (all `requireAdmin`): `GET/POST /api/products`, `PUT/DELETE /api/products/:id`, colours nested in the product body; `GET/POST /api/collections`, `PUT/DELETE /api/collections/:id` (with `productIds`); `GET/POST /api/posters`, `PUT/DELETE /api/posters/:id`; `GET/PUT /api/shop`. A colour `image_key` must be `pub/…` or the crop of an admin-sourced design → else 400 `customer_photo_not_allowed`.
- Slugs: from `name_vi` with Vietnamese accents folded (`foldSearch`), spaces → `-`, de-duplicated with `-2`… **(plan's call)**

- [ ] **Step 1: Failing tests (library, Review Focus 3):** `private-ticked design absent from another customer's library`, `hidden design absent`, `library item has no original image key`, `popular sort by orderCount`, `brand-logo product absent from public home, present for admin`, `colour pointing at a customer-sourced crop → 400`.
- [ ] **Step 2: Failing tests (content):** CRUD round-trips for product (3 languages, lines, colours), collection with product order, poster order/publish, shop info.
- [ ] **Step 3–5:** FAIL → implement → PASS. Commit `feat: library rules and site content API`.

### Task 6: User management, reset & verification tokens, email

**Files:**
- Create: `src/worker/email.ts`, `src/worker/routes/users.ts`, `test/unit/users.test.ts`
- Modify: `src/worker/routes/account.ts`, `src/worker/env.ts` (`RESEND_API_KEY?`, `MAIL_FROM?`, `EMAIL_OUTBOX?: {to,subject,html}[]` test hook)

**Interfaces:**
- Produces: `sendEmail(env, to, subject, html): Promise<'sent'|'disabled'>` — pushes to `env.EMAIL_OUTBOX` when present (tests), else POST `https://api.resend.com/emails` when key+from set, else `'disabled'`; templates `verifyEmail(lang, link)`, `resetPassword(lang, link)` (vi/en/km, HLUXURY branded, plain inline styles).
- Endpoints: on register, a `verify` token (7 days) is mailed; `GET /api/email/verify?token=` sets `email_verified_at`, then redirects to `/tai-khoan#/ho-so?verified=1`; `POST /api/password/forgot {email, lang}` → always 200 (no account enumeration); mails a `reset` token (1 h) only to verified emails, 3 / hour / email; `POST /api/password/reset {token, password}` → sets hash, marks used, deletes all sessions of that user; `GET /api/users?q=` (admin) → `{id, name, phone, email, emailVerified, locked, createdAt, customerId, orderCount}[]`; `POST /api/users/:id/lock`, `/unlock` (lock deletes sessions); `POST /api/users/:id/reset-link` → `{url}` (24 h).

- [ ] **Step 1: Failing tests:** `register queues a verify email with a working link`, `forgot for unverified or unknown email returns 200 and sends nothing`, `forgot+reset changes password and logs out other sessions`, `reset token single use and expires after 1h (clock)`, `admin lock revokes sessions; customer cannot call /api/users (404)`, `admin reset-link works for 24h`, `sendEmail disabled when not configured`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: user management, password reset, email`.

### Task 7: Design system, theme, language, admin moved to /quan-ly

**Files:**
- Create: `src/client/ui/theme.ts`, `src/client/ui/ThemeToggle.tsx`, `src/client/ui/LangGlobe.tsx`, `src/shared/i18n-ui.ts`, `test/e2e/theme-lang.test.ts`
- Modify: `src/client/public/styles.css` (tokens per Global Constraints as CSS variables under `:root` and `[data-theme="dark"]`; restyle all existing classes), `src/client/public/index.html` (served at `/quan-ly`, fonts link, inline pre-paint theme script), `src/client/public/manifest.webmanifest` (`start_url` and `scope` `/quan-ly`), `src/client/public/sw.js` (scope `/quan-ly`), `src/client/admin/App.tsx` (header with logo HLUXURY + LangGlobe + ThemeToggle; lucide icons in tab bar), `src/worker/index.ts` (routes: `/quan-ly` → admin index; `/` → public SSR (Task 9; until then a placeholder); legacy: `/` with an admin session and a hash is handled by the public island script redirecting `#/…` to `/quan-ly#/…`), all `test/e2e/*` helpers (`/#/` → `/quan-ly#/`)
- Package: add `lucide-react`.

**Interfaces:**
- Produces: `getTheme(): 'light'|'dark'`, `setTheme(t)` (stores `localStorage['hl-theme']`, sets `document.documentElement.dataset.theme`), pre-paint script string `THEME_BOOT` exported from `theme.ts` for HTML heads; `<ThemeToggle/>`, `<LangGlobe value lang onChange/>` (button with `aria-label="Ngôn ngữ"`, menu of `Tiếng Việt`, `English`, `ខ្មែរ`); `uiT(lang, key, vars?)` in `i18n-ui.ts` with keys for header, auth forms, account area, ordering, library, errors (every key present in vi/en/km; km marked TODO-REVIEW-KM).

- [ ] **Step 1: Failing e2e:** `admin lives at /quan-ly and old /#/orders/<id> link redirects there` (Review Focus 5), `theme toggle switches data-theme and persists after reload`, `theme follows prefers-color-scheme dark by default`, `globe switches public header language`, and unit `every uiT key exists in vi/en/km`.
- [ ] **Step 2:** Update existing e2e paths; run full e2e → only the new tests fail.
- [ ] **Step 3–4:** Implement → whole unit + e2e suites PASS; screenshot admin home light/dark for self-check. Commit `feat: Kho Việt design system, theme, language, admin at /quan-ly`.

### Task 8: Auth pages and login modal

**Files:**
- Create: `src/client/customer/main.tsx`, `src/client/customer/App.tsx`, `src/client/customer/api.ts`, `src/client/customer/pages/Auth.tsx` (`LoginForm`, `RegisterForm`, `ForgotForm`, `ResetForm` exported for reuse), `src/client/public/account.html` (shell for `/tai-khoan` and auth paths), `test/e2e/register.test.ts`
- Modify: `scripts/build.ts` (third bundle `customer` + `island`), `src/worker/index.ts` (`/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/tai-khoan` → account shell; admin login now `/dang-nhap` and `/quan-ly` redirects there when logged out)

**Interfaces:**
- Produces: forms post to Task 2/6 endpoints; on success redirect to `?next=` (only same-origin paths) else `/tai-khoan` (customer) or `/quan-ly` (admin). Register form: fields `Họ tên`, `Số điện thoại`, `Email`, `Mật khẩu`, `Nhập lại mật khẩu`, `Quốc gia`, `Ngôn ngữ`; show/hide password button `aria-label="Hiện mật khẩu"`; strength meter (weak < 8, medium, strong ≥ 12 with digit+letter); inline field errors in the chosen language. Login card with image band + Playfair title like the Kho Việt login screenshot.

- [ ] **Step 1: Failing e2e:** `register with phone written with spaces then log out and log in by email`, `duplicate phone shows 'đã có tài khoản' under the phone field`, `password mismatch shows error, no request sent`, `admin logs in on /dang-nhap and lands on /quan-ly`, `customer visiting /quan-ly is sent to /tai-khoan`, `forgot password page says to check email (and email arrives in dev outbox endpoint)`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: auth pages`.

### Task 9: Public site (SSR) with guest limits

**Files:**
- Create: `src/worker/public/render.ts`, `src/worker/public/pages.ts`, `src/client/public/island.tsx`, `test/unit/public-render.test.ts`, `test/e2e/guest.test.ts`
- Modify: `src/worker/index.ts` (`/`, `/san-pham`, `/san-pham/:slug`, `/bo-suu-tap/:id`, `robots.txt`, `sitemap.xml`; these pages are indexable — no `X-Robots-Tag` and `<meta robots>` = `index,follow`; everything else keeps noindex)

**Interfaces:**
- Consumes: Task 5 `getPublicHome`, `getPublicProduct`; Task 2 `currentUser`; Task 7 tokens/theme boot.
- Produces: `renderPage({lang, title, description, ogImage, body, user}): string` (escapes every interpolated string via `escapeHtml`); homepage blocks in A2 order (header with globe+theme+login/account; poster carousel (CSS scroll-snap); style chips; theme collections; featured products; 3-step block; footer with shop info; sticky bottom CTA "Gửi ảnh nhận báo giá" + Zalo). Language from `?lang=` → cookie `hl-lang` → `Accept-Language` → vi. Guest product detail shows first colour only + "Đăng nhập để xem đủ màu và size"; buttons needing login carry `data-need-login` and the island opens a modal with `LoginForm`/`RegisterForm` tabs, `next` = current URL.
- Empty content states: no posters → default HLUXURY hero with copy "Dép đẹp, làm theo ý bạn."; no products → section hidden.

- [ ] **Step 1: Failing unit:** `home HTML contains poster title and product names server-side`, `brand-logo product absent`, `guest product page has one colour and no size lines; logged-in has all`, `HTML escapes '<script>' in product names`, `robots.txt allows / and disallows /quan-ly /tai-khoan /q/`.
- [ ] **Step 2: Failing e2e:** `guest taps Đặt sản phẩm này → modal → registers → returns to the product page with all colours`, `sticky CTA visible on phone`, `km language renders Khmer font`.
- [ ] **Step 3–5:** FAIL → implement → PASS. Commit `feat: public HLUXURY site`.

### Task 10: Customer area

**Files:**
- Create: `src/client/customer/pages/{Orders,OrderView,NewOrder,Library,Profile}.tsx`, `test/e2e/customer-order.test.ts`, `test/e2e/customer-account.test.ts`
- Modify: reuse `ImageTagger`, `LineEditor`, `PhotoPicker`, `CropThumb`, `draft.ts`, image lib (move shared ones to `src/client/ui/` if imports cross bundles awkwardly)

**Interfaces:**
- Consumes: Task 4/5 `/api/c/*`, `/media/*`.
- Produces: hash routes under `/tai-khoan`: `#/` (orders list), `#/don/:id`, `#/dat-hang` (`?product=slug&colors=a,b` or `?design=id`), `#/thu-vien`, `#/ho-so`. NewOrder: start from product colours (multi-select), library design ("Đặt lại mẫu này"), or own photos (tagger); per-item and per-order checkbox `Mẫu đặt riêng (không hiện cho khách khác)` with the helper text from spec 6.4; delivery field `Nơi nhận hàng bên Campuchia`; sticky totals bar; "Gửi đơn" idempotent; draft autosave under `cdraft:<id>`. OrderView: status timeline, crops, lines, quote table when quoted, `Đồng ý báo giá`, `Hủy đơn` (confirm + optional reason) when allowed, paid/due. Library: grid, filters, sort, `Đặt lại mẫu này`. Profile: name, language, change password, email verified badge + resend link, logout.

- [ ] **Step 1: Failing e2e:** `customer orders 2 colours of a product with Nam 39–44 even 10 → Tổng 120 đôi, admin sees it under Đơn khách mới`, `customer orders from own photo with Mẫu đặt riêng → design absent from a second customer's library`, `second customer reorders a visible library design`, `admin quotes, customer accepts in account → Khách đã đồng ý`, `customer cancels a quoted order with reason; admin sees reason`, `customer cannot open another customer's order URL (not-found screen)`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: customer account area`.

### Task 11: Admin additions

**Files:**
- Create: `src/client/admin/pages/Users.tsx`, `src/client/admin/pages/Content.tsx` (tabs: Sản phẩm, Bộ sưu tập, Poster, Thông tin xưởng), `test/e2e/admin-users.test.ts`
- Modify: `Home.tsx` (bucket "Đơn khách mới" first), `OrderRow.tsx` (badge "Khách tự đặt"), `OrderDetail.tsx` (deliver note, cancel reason), `OrderEditor.tsx` (replace "Cho khách xem" with "Mẫu đặt riêng"), `Library.tsx` (flags: Mẫu đặt riêng, Ẩn khỏi thư viện, Có logo thương hiệu), `App.tsx` (nav: Người dùng, Trang web)

**Interfaces:**
- Consumes: Tasks 4–6 admin endpoints; image upload `POST /api/content/images` for posters/colours/covers (client compression reused).

- [ ] **Step 1: Failing e2e:** `admin locks a customer → that customer's open page gets sent to login`, `admin creates product with 2 colours and publishes → appears on / for guests`, `admin marks design Có logo → product colour using it hidden from guest page`, `admin sees Đơn khách mới badge count`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: admin users and site content`.

### Task 12: Restyle remaining screens, release

**Files:**
- Modify: remaining admin pages and components, `src/client/quote/QuotePage.tsx` (HLUXURY header, theme + globe), `src/shared/i18n.ts` + schema default `quote_message` texts (sign as HLUXURY), `docs/TRIEN-KHAI.md` (new URLs, migrations, email setup), `README.md`

- [ ] **Step 1:** Full suites: `bun test test/unit`, `bun test test/e2e --timeout 60000` → PASS; screenshots light/dark of public home, product, register, customer order, admin home for self-check.
- [ ] **Step 2:** `bun run build`; `npx wrangler deploy --dry-run` bundles; open PR, merge after owner OK; confirm the Cloudflare build ran the migration then deploy (build log); smoke on production: `/` 200 indexable, `/quan-ly` admin login works with Admin001, `/api/register` → create and delete a throwaway customer.
- [ ] **Step 3:** When the owner's domain exists: attach custom domain (`xuongdep.hluxury.com` or apex), set `APP_URL`, add Resend DNS records, `wrangler secret put RESEND_API_KEY` and `MAIL_FROM`, send a real reset email to the owner. Commit `chore: phase 2a release`.
