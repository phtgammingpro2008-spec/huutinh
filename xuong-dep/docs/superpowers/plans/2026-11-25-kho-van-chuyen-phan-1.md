# Kho và vận chuyển, phần 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track every bag of an order (toa) from packing at the workshop, over a truck trip to Cambodia, into the Cambodia warehouse and to the customer, with a random QR code per bag, counting in ri, so anyone can see what was sent and what is still missing.

**Architecture:** Same Worker + D1. New tables `trips`, `bags`, `bag_events` (append-only, enforced by triggers) in migration 0006. A new role `worker` (tài khoản Xưởng). A new React bundle `/kho` (bilingual vi + km, big buttons) for packing, loading, receiving and delivering, shared by worker/staff/admin. Order detail (admin) and customer order view get a shipping summary. Ri maths lives in `src/shared/ri.ts`.

**Tech Stack:** TypeScript, Bun, React 19, Cloudflare Workers/D1, Playwright. New npm deps: `qrcode-generator` (QR SVG for labels), `jsqr` (camera decode fallback when `BarcodeDetector` is missing).

**Spec:** `docs/superpowers/specs/2026-11-25-kho-van-chuyen-phan-1-design.md` (approved 25/11/2026)

## Global Constraints

- Ri: one ri of a size line = one pair of each size in it; pairs per ri = `sizeTo - sizeFrom + 1` (Nam 39–44 → 6, Nữ 36–40 → 5). Bags record whole ri per `lineKey`; ordered ri may be fractional, shown with 1 decimal plus pairs.
- One bag belongs to exactly one order; an order has many bags. Bags do not record designs.
- Bag code: `HLX-XXXXX-XXXXX`, the 10 X from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0/O/1/I/L). The QR payload is exactly that code string, never a URL.
- Label shows: QR, code, `Bao số N`, ri per line (e.g. `12 ri Nam · 8 ri Nữ`), `Gửi kèm` text if any. Never: customer name, order code, phone, address, price.
- Bag statuses: `da_dong`, `tren_xe`, `da_toi`, `thieu`, `trong_kho`, `da_giao`, `that_lac`, `hu_hong`, `da_huy`.
- Trip statuses: `dang_xep` → `dang_chay` → `da_toi`. Trip code `C` + `DDMMYY` + `-` + n of the day (e.g. `C251125-1`).
- Packing allowed only for orders `khach_dong_y` or `dang_san_xuat`. First bag on a `khach_dong_y` order moves it to `dang_san_xuat`. Delivered pairs ≥ ordered pairs moves the order to `da_giao`.
- `bag_events` rows are never updated or deleted (DB triggers abort UPDATE/DELETE). Every bag change writes one event.
- Roles: worker = pack, reprint, open trip, load/remove (before departure), depart, look up bag (without customer data). staff = also receive, close receipt, stock, deliver, see customer data. **Every correction is admin-only** (owner, 25/11): edit ri, flag lost/damaged, cancel bag, reopen a delivered order; admin also creates/locks worker accounts.
- Worker never receives customer name/phone/address/notes, prices, payments; `/api/*` outside `/api/kho/*`, `/api/me`, `/api/logout`, `/media/*` (allowed keys only) answers 404 to a worker.
- `/kho` UI: every label in Vietnamese and Khmer at once (`Đóng bao · ខ្ចប់បាវ`). Admin `/quan-ly` stays Vietnamese only.
- Telegram (owner only, via `notifyOwner`): trip departs, trip closed with missing bags, order fully delivered.
- No cash collection, no warehouse zones, no ready-stock, no offline queue (spec §9, §4c, §11, wifi reliable).

## Review Focus

1. **A bag scanned in the wrong place:** loading a bag already on another open/running trip, receiving a bag that belongs to a different trip, delivering a bag not yet arrived, packing for a cancelled order → each refused with a clear bilingual reason and no state change. Tests in Task 3 and Task 4.
2. **Two people scanning the same bag at once / double tap:** loading or receiving the same code twice writes one event and returns the same result. Tests in Task 3 and Task 4.
3. **Worker data leak:** a worker session calling `/api/orders/:id`, `/api/customers`, `/media/<original photo key>`, or reading a bag/toa payload never sees customer name, phone, deliver note or prices. Test in Task 2 and Task 3.
4. **Late bag after closing receipt:** a `thieu` bag scanned later becomes `da_toi` and the trip's missing list shrinks; history keeps both. Test in Task 4.
5. **Over-packing and odd quantities:** an order entered per size (not even) gives fractional ri; packing beyond it needs `confirmOver: true` and flags the bag `du`. Test in Task 1 and Task 3.

---

## File Structure

```
migrations/0006_kho.sql                 trips, bags, bag_events, triggers, indexes
src/shared/ri.ts                        ri maths + bag code alphabet/format (shared by worker and clients)
src/worker/repo/kho.ts                  bag/trip/event queries, shipping summary per order
src/worker/routes/kho.ts                /api/kho/* routes
src/worker/roles.ts                     + 'worker' role, requireKho(level)
src/worker/routes/users.ts              /api/staff accepts role 'staff' | 'worker'
src/worker/media.ts                     worker may view crop keys of packable orders
src/worker/index.ts                     mount khoRoutes; serve /kho → kho.html
src/worker/routes/customer.ts           customerView + shipping summary (no codes, problems shown as "đang kiểm tra")
src/worker/routes/orders.ts             GET /api/orders/:id includes shipping summary for admin/staff
src/client/kho/{main.tsx,App.tsx,i18n.ts,scan.ts,label.ts,pages/*.tsx}
src/client/public/kho.html
scripts/build.ts                        + kho bundle (%KHO_JS%)
src/client/admin/pages/OrderDetail.tsx  "Vận chuyển" section
src/client/admin/pages/Home.tsx         "Kho" card (running trips, trips with missing bags, bags in Cam)
src/client/admin/pages/Users.tsx        role picker Quản lý / Xưởng
src/client/customer/pages/OrderView.tsx "Hàng của bạn" section
src/client/customer/App.tsx, admin/App.tsx  worker → /kho
test/unit/ri.test.ts, test/unit/kho.test.ts, test/unit/kho-worker.test.ts
test/e2e/kho.test.ts
```

---

### Task 1: Schema and ri maths

**Files:**
- Create: `migrations/0006_kho.sql`, `src/shared/ri.ts`, `test/unit/ri.test.ts`
- Test: `test/unit/migrations.test.ts` (existing; must still pass)

**Interfaces:**
- Produces:
  - `type RiCount = Record<string, number>` (lineKey → ri)
  - `type LineInfo = { key: string; label: Names; perRi: number }`
  - `orderedRi(items: Item[]): Record<string, { pairs: number; perRi: number; ri: number }>` (ri rounded to 1 decimal)
  - `pairsOf(ri: RiCount, perRi: Record<string, number>): number`
  - `BAG_ALPHABET`, `newBagCode(): string` (`HLX-XXXXX-XXXXX`), `normalizeBagCode(input: string): string | null` (uppercases, strips spaces, accepts missing dashes / prefix, returns canonical or null)

- [ ] **Step 1: Write `test/unit/ri.test.ts`**

```ts
test('even Nam line 10 per size = 10 ri, 60 pairs', () => {
  expect(orderedRi([item(1, { lines: [line({ lineKey: 'nam', sizeFrom: 39, sizeTo: 44, qtyEach: 10 })] })]).nam)
    .toEqual({ pairs: 60, perRi: 6, ri: 10 });
});
test('two items on the same line add up; per-size entry gives fractional ri', () => {
  const r = orderedRi([
    item(1, { lines: [line({ lineKey: 'nu', sizeFrom: 36, sizeTo: 40, qtyEach: 4 })] }),
    item(2, { lines: [line({ lineKey: 'nu', sizeFrom: 36, sizeTo: 40, mode: 'per_size', perSize: { 36: 3, 37: 3, 38: 2 } })] }),
  ]);
  expect(r.nu).toEqual({ pairs: 28, perRi: 5, ri: 5.6 });
});
test('pairsOf', () => expect(pairsOf({ nam: 12, nu: 8 }, { nam: 6, nu: 5 })).toBe(112));
test('bag codes', () => {
  const c = newBagCode();
  expect(c).toMatch(/^HLX-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
  expect(normalizeBagCode(' hlx 7k2q9 4xmab ')).toBe('HLX-7K2Q9-4XMAB');
  expect(normalizeBagCode('7K2Q94XMAB')).toBe('HLX-7K2Q9-4XMAB');
  expect(normalizeBagCode('HLX-7K2Q9-4XMA0')).toBeNull(); // 0 is not in the alphabet
});
```
(Check the real `LineMode` value for per-size entry in `src/shared/types.ts` and use it.)

- [ ] **Step 2: Run** `bun test test/unit/ri.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement `src/shared/ri.ts`.** Pairs of a line via existing `lineQty` from `src/shared/totals.ts`; `newBagCode` uses `crypto.getRandomValues` with rejection sampling over the 31-char alphabet.
- [ ] **Step 4: Write `migrations/0006_kho.sql`:**
  - `trips(id TEXT PK, code TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'dang_xep', note TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL, departed_at TEXT, departed_by TEXT, closed_at TEXT, closed_by TEXT)`
  - `bags(id TEXT PK, code TEXT UNIQUE NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), seq INTEGER NOT NULL, ri TEXT NOT NULL DEFAULT '{}', pairs INTEGER NOT NULL DEFAULT 0, extra_note TEXT NOT NULL DEFAULT '', extra_pairs INTEGER NOT NULL DEFAULT 0, over INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'da_dong', trip_id TEXT REFERENCES trips(id), created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(order_id, seq))`
  - `bag_events(id TEXT PK, bag_id TEXT NOT NULL REFERENCES bags(id), trip_id TEXT, kind TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', user_id TEXT NOT NULL, at TEXT NOT NULL)`
  - triggers `bag_events_no_update` / `bag_events_no_delete`: `BEFORE UPDATE|DELETE ON bag_events BEGIN SELECT RAISE(ABORT, 'bag_events is append-only'); END;`
  - indexes on `bags(order_id)`, `bags(trip_id)`, `bags(status)`, `bag_events(bag_id)`.
- [ ] **Step 5: Add to `ri.test.ts`** a test that opens `createTestEnv()`, inserts a bag + event, and expects `UPDATE bag_events …` and `DELETE FROM bag_events …` to throw.
- [ ] **Step 6: Run** `bun test test/unit` → all pass.
- [ ] **Step 7: Commit** `feat(kho): schema and ri maths`.

### Task 2: Worker role and access

**Files:**
- Modify: `src/worker/roles.ts`, `src/worker/routes/users.ts`, `src/worker/repo/users.ts`, `src/worker/routes/auth.ts`, `src/worker/media.ts`, `src/worker/public/render.ts`, `src/client/customer/App.tsx`, `src/client/customer/api.ts`, `src/client/admin/App.tsx`, `src/client/admin/pages/Login.tsx`, `src/client/admin/pages/Users.tsx`
- Test: `test/unit/kho-worker.test.ts`

**Interfaces:**
- Produces: `Role = 'admin' | 'staff' | 'worker' | 'customer'`; `requireKho(level: 'worker' | 'staff' | 'admin', h)` (worker level admits admin/staff/worker; staff level admits admin/staff; admin level admits admin only; customers 404; others below the level 403 `Chỉ tài khoản chủ xưởng làm được việc này · …` or `Tài khoản Xưởng không làm được việc này · …`). `requireAdmin` keeps admitting only admin/staff (so workers get 404 on all existing admin routes).
- `POST /api/staff` takes `role: 'staff' | 'worker'` (default `staff`); `GET /api/staff` returns `role` per row; lock/password routes accept both roles.

- [ ] **Step 1: Tests** in `kho-worker.test.ts`: owner creates `{ name: 'tho1', password: 'mat-khau-tho-1', role: 'worker' }` → 200, row role `worker`; worker logs in by name; `/api/me` role `worker`; worker gets 404 on `/api/orders`, `/api/customers`, `/api/settings`, `/api/staff`; staff creating a worker → 403; worker on `/media/<order original image key>` → 404.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Name lookup on login includes `worker`. `homeOf`/redirects: worker → `/kho`; admin app on `/quan-ly` sends a worker to `/kho`. Public header account link: worker → `/kho`. Users page: the create form gets a two-option picker "Quản lý · Xưởng (công nhân)" and the list shows a badge per role. Media: a worker may view `order_items.crop_key` of orders whose status is `khach_dong_y` or `dang_san_xuat`, nothing else.
- [ ] **Step 4: Run** `bun test test/unit` → pass.
- [ ] **Step 5: Commit** `feat(kho): worker accounts`.

### Task 3: Bags and loading trips (workshop side)

**Files:**
- Create: `src/worker/repo/kho.ts`, `src/worker/routes/kho.ts`
- Modify: `src/worker/index.ts` (mount), `src/worker/telegram.ts` (no change in API; used)
- Test: `test/unit/kho.test.ts`

**Interfaces:**
- Consumes: `orderedRi`, `pairsOf`, `newBagCode`, `normalizeBagCode` (Task 1); `requireKho` (Task 2); `notifyOwner`, `adminOrderUrl`.
- Produces (all JSON; `level` in brackets):
  - `GET /api/kho/toa` [worker] → `ToaCard[]` = `{ id, code, status, thumbs: string[] (crop keys, max 6), lines: { key, label: Names, perRi, orderedRi, orderedPairs, packedRi, sentRi }[], bags: number }` for orders `khach_dong_y`/`dang_san_xuat`, newest first. No customer fields.
  - `POST /api/kho/bags` [worker] body `{ orderId, ri: RiCount, extraNote?, extraPairs?, confirmOver? }` → `BagView`. Errors: 409 `not_packable`, 400 `empty` (all ri 0 and no extraNote), 409 `over` with `{ overRi: RiCount }` unless `confirmOver`.
  - `GET /api/kho/bags/:code` [worker] → `BagView` = `{ code, seq, ri, pairs, extraNote, extraPairs, over, status, trip: { id, code, status } | null, order: { id, code, totalBags } , events: { kind, at, by, tripCode, data }[] }` plus, for staff/admin only, `order.customerName` and `order.deliverNote`.
  - `POST /api/kho/bags/:code/reprint` [worker] → event `reprint`.
  - `POST /api/kho/trips` [worker] → `TripView` (`dang_xep`, new code).
  - `GET /api/kho/trips?status=` [worker] → `TripView[]`; `GET /api/kho/trips/:id` [worker] → `TripView` = `{ id, code, status, createdAt, departedAt, closedAt, bags: { code, seq, orderCode, pairs, status }[], counts: { total, received, missing } }`.
  - `POST /api/kho/trips/:id/load` [worker] `{ code }` → `TripView`; `POST /api/kho/trips/:id/unload` [worker] `{ code }` (only `dang_xep`); `POST /api/kho/trips/:id/depart` [worker] → bags `tren_xe`, Telegram `🚚 Chuyến C251125-1 chạy: 40 bao, 6 toa`.
- Event kinds used across tasks: `pack`, `reprint`, `load`, `unload`, `depart`, `receive`, `missing`, `stock`, `deliver`, `edit_ri`, `flag`, `cancel`.

- [ ] **Step 1: Tests** (`kho.test.ts`, owner + one worker cookie, an accepted order of 10 ri Nam + 12 ri Nữ):
  - pack 6 Nam + 4 Nữ → `seq 1`, `pairs 56`, order becomes `dang_san_xuat`, one `pack` event.
  - `GET /api/kho/toa` as worker shows `packedRi { nam: 6, nu: 4 }` and contains no `customer`/`name`/`deliverNote`/`price` keys anywhere (stringify and check).
  - pack 5 Nam → 409 `over` `{ overRi: { nam: 1 } }`; with `confirmOver` → 200, `over: true`.
  - empty bag → 400; bag with only `extraNote: '2 đôi mẫu'` → 200, `pairs 0`.
  - packing for `cho_bao_gia` or `da_huy` order → 409 `not_packable`.
  - trip: open, load bag 1 twice → one `load` event; load the same bag on a second open trip → 409 `on_other_trip`; unload works while `dang_xep`; depart → bag `tren_xe`; load after depart → 409 `trip_closed`; Telegram fake received the departure message.
  - `GET /api/kho/bags/HLX7K…` with spaces/lowercase resolves via `normalizeBagCode`; unknown code → 404 `Không có bao này · មិនមានបាវនេះ`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** repo + routes. Wrap each state change and its event in one `env.DB.batch`. Use conditional UPDATEs (`WHERE status = ?`) and check `changes` to make concurrent double scans no-ops. Error bodies carry `{ error: '<vi> · <km>', code }`.
- [ ] **Step 4: Run** `bun test test/unit` → pass.
- [ ] **Step 5: Commit** `feat(kho): bags, labels data and loading trips`.

### Task 4: Receiving in Cambodia, warehouse, delivery, corrections

**Files:**
- Modify: `src/worker/repo/kho.ts`, `src/worker/routes/kho.ts`
- Test: `test/unit/kho.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/kho/trips/:id/receive` [staff] `{ code }` → `TripView` (bag `tren_xe`/`thieu` → `da_toi`; wrong trip → 409 `other_trip` naming that trip's code).
  - `POST /api/kho/trips/:id/close` [staff] → trip `da_toi`; unscanned bags → `thieu` with `missing` events; Telegram `⚠️ Chuyến … tới Cam: nhận 38/40, thiếu HLX-…, HLX-…` (or `✅ … đủ 40/40`).
  - `POST /api/kho/bags/:code/stock` [staff] (`da_toi` → `trong_kho`).
  - `POST /api/kho/deliver` [staff] `{ codes: string[], note? }` (each `da_toi`|`trong_kho` → `da_giao`); all-or-nothing; response lists orders touched; order whose delivered pairs ≥ ordered pairs → `da_giao`, Telegram `📦 Toa … đã giao đủ`.
  - `POST /api/kho/bags/:code/ri` [admin] `{ ri }` → event `edit_ri { from, to }`.
  - `POST /api/kho/bags/:code/flag` [admin] `{ kind: 'that_lac' | 'hu_hong', note }`; `POST /api/kho/bags/:code/cancel` [admin] (only `da_dong`).
  - `shippingSummary(env, orderId): Promise<{ bags: number; lines: { key, label, perRi, orderedRi, packedRi, sentRi, deliveredRi }[]; byStatus: Record<BagStatus, number>; extra: string[]; list: BagRow[] }>` exported from `repo/kho.ts` for Task 6.

- [ ] **Step 1: Tests:** worker calling receive/close/deliver → 403; staff calling ri/flag/cancel → 403; receive bag from another trip → 409 `other_trip`; close with 1 of 2 received → that bag `thieu`, counts `{ total 2, received 1, missing 1 }`, Telegram lists its code; later receive of the `thieu` bag → `da_toi`, missing 0, both events kept; deliver a `tren_xe` bag → 409, nothing changed even if other codes in the list were valid; deliver all bags of the order → order `da_giao` + Telegram; `edit_ri` changes pairs and keeps the old value in the event; cancel a loaded bag → 409.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `bun test test/unit` → pass.
- [ ] **Step 5: Commit** `feat(kho): receiving, warehouse and delivery`.

### Task 5: The /kho app

**Files:**
- Create: `src/client/public/kho.html` (copy of `account.html` with `%KHO_JS%`, title `HLUXURY · Kho`), `src/client/kho/main.tsx`, `App.tsx`, `i18n.ts`, `scan.ts`, `label.ts`, `pages/{Scan,Pack,Trips,TripLoad,TripReceive,Stock,Deliver,Bag,Labels}.tsx`
- Modify: `scripts/build.ts` (bundle `src/client/kho/main.tsx`, `%KHO_JS%`), `src/worker/index.ts` (`/kho` → `/kho.html`), `package.json` (+ `qrcode-generator`, `jsqr`), `src/client/public/styles.css` (`.kho-*` rules)
- Test: `test/e2e/kho.test.ts`

**Interfaces:**
- Consumes: Task 3/4 APIs.
- `i18n.ts`: `K: Record<string, [vi: string, km: string]>` and `<B k="pack" />` rendering `vi · km` (Khmer in `lang="km"` span). Khmer strings need native review: mark the file with `// TODO-REVIEW-KM` like `email.ts`.
- `scan.ts`: `useScanner(onCode: (code: string) => void)` — always-focused text input (USB scanner = keyboard + Enter, also hand typing) + "Mở camera" button using `BarcodeDetector({ formats: ['qr_code'] })` when present, else `jsqr` on canvas frames; feeds `normalizeBagCode`; ignores the same code repeated within 2 s; success beep (WebAudio 880 Hz 80 ms) + green flash, failure low beep + red message.
- `label.ts`: `labelSvg(code: string, size: number): string` via `qrcode-generator` (error level M).
- Routes (hash): `#/` home tiles (Quét mã, Đóng bao, Chuyến xe, and for staff/admin Nhận chuyến, Kho Cam, Giao khách), `#/dong-bao[/:orderId]`, `#/chuyen`, `#/chuyen/:id` (load or receive depending on status and role), `#/kho-cam`, `#/giao`, `#/bao/:code`, `#/in?codes=…`.
- Labels page: A4, 3 × 7 grid of 70 × 42.3 mm cells, `@page { size: A4; margin: 0 }`, auto `window.print()` after render; prints the bags just packed (or one reprinted).
- Pack page: pick toa card (code, thumbnails, per line `đã đóng / đặt` ri), stepper per line (− / number / +), `Gửi kèm` text + pairs, buttons `Tạo bao và in tem` and `Đóng tiếp bao nữa` (keeps the toa, clears counts); over-pack shows the 409 `overRi` and a confirm button.
- Trip load page: big counter `24 bao · 5 toa`, last scans list with undo (unload), `Cho xe chạy` with a confirm step built into the page.
- Trip receive page: `đã nhận 38 / 40`, list of not-yet-received codes, `Chốt nhận chuyến` with confirm.
- Kho Cam: bags `da_toi` + `trong_kho` grouped by order code (staff sees customer name), button `Nhập kho` for `da_toi`, `Giao` opens the deliver page prefilled with that order's bags.

- [ ] **Step 1: e2e test** `kho.test.ts` (phone viewport, `locale: 'vi-VN'`): owner creates worker + accepted order (via API); worker logs in → lands on `/kho`; packs 2 bags (labels page opens with 2 labels, each with an `<svg>` and code text, no order code text on the page); opens trip, types both codes into the scan box + Enter, departs; owner opens `/kho` → trip → receives one code, closes → page shows 1 missing code; receives the other; Kho Cam → Nhập kho both; Giao → delivers → order status via API is `da_giao`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `bun run build && bun test test/e2e/kho.test.ts --timeout 60000` → pass; screenshot phone light/dark of Pack, Trip load, Labels and look at them.
- [ ] **Step 5: Commit** `feat(kho): /kho app with scanning and labels`.

### Task 6: Shipping on order pages

**Files:**
- Modify: `src/worker/routes/orders.ts` (`GET /api/orders/:id` adds `shipping: shippingSummary`), `src/worker/routes/customer.ts` (`customerView` adds `shipping` without `list[].code`, mapping `thieu|that_lac|hu_hong` to `kiem_tra`), `src/client/admin/pages/OrderDetail.tsx`, `src/client/admin/pages/Home.tsx`, `src/worker/routes/orders.ts` dashboard (`kho: { running, missingTrips, inCam }`), `src/client/customer/pages/OrderView.tsx`, `src/shared/i18n-ui.ts` (customer strings vi/en/km)
- Test: `test/unit/kho.test.ts`, `test/e2e/kho.test.ts`

**Interfaces:**
- Consumes: `shippingSummary` (Task 4).
- Customer section title `Hàng của bạn` / `Your goods` / `ទំនិញរបស់អ្នក`; rows `Đã gửi`, `Còn thiếu`, `Đang trên xe`, `Đã tới Cam`, `Đã giao`, `Đang kiểm tra`, `Gửi kèm`.
- Admin section `Vận chuyển`: per line `đặt / đã đóng / đã gửi / đã giao / còn thiếu` ri, bag list (code, ri, status, trip code, date) linking to `/kho#/bao/<code>`, event history.

- [ ] **Step 0: Reopen a delivered order:** in `src/shared/status.ts` `canTransition('da_giao', 'dang_san_xuat')` becomes true (spec §4: the owner or a manager reopens a delivered toa by hand to pack more). Add the case to `test/unit/status.test.ts`. In `POST /api/orders/:id/status`, that reopening is admin-only (staff → 403).
- [ ] **Step 1: Unit tests:** customer view has `shipping.lines[].deliveredRi`, no `code` key anywhere in `shipping`, a `thieu` bag counted under `kiem_tra`; admin order view has codes; dashboard counts.
- [ ] **Step 2: e2e:** extend `kho.test.ts`: customer opens the order and sees `Hàng của bạn` with `Còn thiếu`.
- [ ] **Step 3–4: Implement, run all unit + e2e** → pass.
- [ ] **Step 5: Commit** `feat(kho): shipping on order pages`.

### Task 7: Release

- [ ] Run `bunx tsc --noEmit -p .`, `bun test test/unit`, `bun run build`, `bun test test/e2e --timeout 40000` → all pass.
- [ ] Update `docs/NHAT-KY-THUC-HIEN.md` with a short entry (what shipped, migration 0006).
- [ ] Push, PR, merge, watch the Cloudflare build (poll every 75 s; on code 971 rate limit wait 90 s and trigger a rebuild of `main`).
