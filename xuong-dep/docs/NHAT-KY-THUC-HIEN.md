# Nhật ký thực hiện giai đoạn 1 (sổ theo dõi gốc, tiếng Anh)

Ghi lại mọi quyết định (Ruling) em tự đưa ra khi làm theo kế hoạch, kết quả kiểm thử từng task và kết quả rà soát cuối.

```text
# SDD ledger — plan: /home/user/huutinh/xuong-dep/docs/superpowers/plans/2026-11-22-dat-hang-dep-giai-doan-1.md
Spec: /home/user/huutinh/xuong-dep/docs/superpowers/specs/2026-11-22-dat-hang-dep-giai-doan-1-design.md

Setup: Ruling: project lives in subdirectory `xuong-dep/` of repo huutinh (repo root already holds an unrelated Express blog) — keeps the blog intact — cost if wrong: one `git mv` to root.
Setup: Ruling: network now available → install deps from npm (react, react-dom, @types/*, typescript, playwright@1.63.0 using preinstalled /opt/pw-browsers, sharp for fixtures, wrangler for deploy) instead of scripts/link-deps.sh symlinks; keep the plan's hand-written router and raw SQL (no Hono/Drizzle: no gain for this size, design unchanged) — cost if wrong: swap later, small.

Pre-flight:
- T2 seeds settings.quote_message; T6 owns the text → Ruling: T2 seeds final vi/en/km default text in schema.sql; T6 i18n default messages must equal them (test) — cost if wrong: text drift, cosmetic.
- T5 calls createQuoteVersion stub; T6 fills it → consistent, no conflict.
- T1 Line/Item types consumed by T5 (OrderInput), T10 (editor), T13 (sheet) → consistent.
- T10 DesignPicker reused by T14 → consistent.
- T6 i18n t() + T1 formatMoney consumed by T12 → consistent.
Task 1: Ruling: qtyPriceLocked('da_huy') = true and printable('da_huy') = false — a cancelled order should not be re-priced or sent to the workshop — cost if wrong: owner can't edit a cancelled order's qty (can un-cancel? no: da_huy is terminal).
Task 1: Ruling: formatMoney ignores lang (VND always "1.234 ₫", USD always "$1,234.56") — the spec's examples fix both formats; Khmer customers read the same digits — cost if wrong: cosmetic.
Task 1: Ruling: scripts/link-deps.sh dropped (npm install instead, see Setup) — Step 1 verified react 19.3.1 instead of 19.2.8.
Task 1: complete (commits 224fb24..00a7bd4, tests: bun test test/unit → Ran 26 tests across 3 files. [6.00ms])
Task 2: Ruling: order_items gets a crop_key column and Env gets an optional NOW() clock — Item.cropKey and the "inject clock" test in Task 5 need them; plan's table list omitted them — cost if wrong: none (additive).
Task 2: Ruling: D1 shim turns on PRAGMA foreign_keys (D1 enforces FKs) so local tests catch FK-order bugs before Cloudflare does.
Task 2: complete (commits 00a7bd4..bb9c19f, tests: bun test test/unit → Ran 31 tests across 4 files. [17.00ms])
Task 3: Ruling: added GET /api/setup-status (public) and setup also logs the new admin in — Task 8 needs to choose setup-vs-login on first visit and "creating admin lands on Trang chủ" — cost if wrong: one extra public endpoint revealing only whether an admin exists.
Task 3: Ruling: password minimum 8 chars, login error is always 'Sai mật khẩu' (unknown name too) — avoids user enumeration — cost if wrong: none.
Task 3: complete (commits bb9c19f..1fa957d, tests: bun test test/unit → Ran 44 tests across 5 files. [234.00ms])
Task 4: Ruling: images served at `/<key>` (key = `img/yyyy/mm/uuid.ext`, so URL `/img/yyyy/mm/uuid.ext`) instead of `/img/<key>` (which would read `/img/img/...`); extension follows content type (jpg/png/webp) — cost if wrong: URL shape only.
Task 4: Ruling: routes for customers/materials/settings live in one routes/catalog.ts (plan listed three files) — less boilerplate, same endpoints — cost if wrong: none.
Task 4: Ruling: settings PUT requires each quote message to contain {url} and size range 1..60 — prevents a quote message without link — cost if wrong: minor.
Task 4: complete (commits 1fa957d..2064ed6, tests: bun test test/unit → Ran 58 tests across 7 files. [614.00ms])
Task 5: Ruling: bulk writes and IN-lists use a single JSON parameter with json_each() — D1 free plan caps bound parameters at 100/query and queries per invocation, which a 30-item order would exceed with per-row INSERTs — cost if wrong: none (works on bun:sqlite and D1).
Task 5: Ruling: order code date uses UTC+7 (VN/KH local day), not UTC — "DH261122" must match the owner's calendar day — cost if wrong: codes near midnight shift a day.
Task 5: Ruling: qty/price edits re-quote whenever a quote was sent (status da_bao_gia OR khach_dong_y, quote_version>0), not only khach_dong_y — otherwise an open quote link would show stale numbers (Review Focus 5). If the edited order has an unpriced line it drops to cho_bao_gia with no new version (can't snapshot without prices); test changed accordingly (priced lines in the khach_dong_y test + new unpriced test) — cost if wrong: owner must re-press "Gửi báo giá" after adding unpriced lines.
Task 5: Ruling: orders.accepted_at cleared when an edit moves status back (history stays in quotes.accepted_at); dashboard dueSoon includes overdue and excludes da_giao/hoan_tat/da_huy; new design without cropKey → 400; items reusing a library design inherit its cropKey — cost if wrong: minor.
Task 5: Ruling: qtyPriceLocked also blocks qty/price edits on da_huy ("Đơn đã hủy, không sửa số lượng/giá được").
Task 5: complete (commits 2064ed6..04d425e, tests: bun test test/unit → Ran 79 tests across 9 files. [1237.00ms])
Task 6: Ruling: send-quote creates a new version only when status is cho_bao_gia, or da_bao_gia and the snapshot changed; re-sending an unchanged/accepted quote returns the same link+version — so resending a link never silently resets an acceptance — cost if wrong: none.
Task 6: Ruling: PUT /prices reuses saveOrder, so pricing a quoted order goes through the same re-quote rules as qty edits.
Task 6: Ruling: price history = priced lines of orders with quoted_at set and status ≠ cho_bao_gia (includes later-cancelled orders that were quoted), deduped by order+price+line, optional excludeOrderId — cost if wrong: one extra chip.
Task 6: Ruling: snapshot lines also carry `mode` and item `qty` (quote page + total-mode display need them); public GET also returns customerName and acceptedAt; accept body may carry `lang` for the error language (falls back to customer's lang).
Task 6: Ruling: messenger field without http(s) becomes https://m.me/<name>.
Task 6: complete (commits 04d425e..d130f61, tests: bun test test/unit → Ran 95 tests across 11 files. [1.61s])
Task 7: Ruling: manual status endpoint refuses `da_bao_gia` (only "Gửi báo giá" creates a version) and refuses khach_dong_y+ before any quote was sent ("Mọi đơn đều phải báo giá"); manual → khach_dong_y records acceptance on order and latest quote (owner got "OK" via Zalo) — cost if wrong: owner can't fast-forward an unquoted order.
Task 7: Ruling: export omits sessions and users.password_hash (backup files get forwarded on Zalo) — cost if wrong: restoring needs a fresh admin setup.
Task 7: Ruling: status endpoint lives in routes/payments.ts, OrderView gains `payments: Payment[]` for the UI list.
Task 7: complete (commits d130f61..f309412, tests: bun test test/unit → Ran 102 tests across 12 files. [1.90s])
Task 8: Ruling: session cookie drops `Secure` only when the request itself is plain http (local dev on 127.0.0.1, where Chromium refuses Secure cookies); Cloudflare is always https so production keeps Secure — test added — cost if wrong: none in production.
Task 8: Ruling: icons generated once by scripts/make-icons.ts (sharp) and committed, not regenerated per build; assets get content-hashed names; all responses add Referrer-Policy: no-referrer (quote token must not leak to Google Fonts via Referer), nosniff, X-Frame-Options DENY.
Task 8: Ruling: bunfig.toml preloads test/preload.ts, which writes an empty assets.gen.ts stub when no build has run, so `bun test test/unit` works on a fresh clone.
Task 8: Ruling: dev server listens on 127.0.0.1 and prints `READY <url>`; `--port 0` picks a free port for e2e.
Task 8: complete (commits f309412..ae28365, tests: bash -c 'bun test test/unit && bun test test/e2e/login.test.ts --timeout 60000' → Ran 3 tests across 1 file. [880.00ms])
Task 9: Ruling: POST /api/images accepts an optional client uuid `id` so photos and tags reference the final image id before the background upload finishes (drafts survive) — non-uuid → 400 — cost if wrong: none.
Task 9: Ruling: the tagger is exercised through a first cut of OrderEditor at #/orders/new (PhotoPicker + ImageTagger); Task 10 grows it. hitTag works in pixel space (26 px label radius) so "near the label" means the same on any screen.
Task 9: Ruling: HEIC files that the browser can't decode get the required message plus a hint (open in Safari / screenshot) — cost if wrong: longer message.
Task 9: Ruling: e2e setupAdmin reloads after API setup (hash-only navigation doesn't re-check auth).
Task 9: complete (commits ae28365..2d7fa1b, tests: bash -c 'bun test test/unit && bun test test/e2e/tagger.test.ts test/e2e/login.test.ts --timeout 30000' → Ran 9 tests across 2 files. [3.28s])
Task 10: Ruling: a new tag copies the previous design's materials and line layout (keys/ranges/modes) with counts reset to 0 — speeds up "9 colours, same sole" entry (spec goal 2–3 min) — cost if wrong: owner clears a copied material.
Task 10: Ruling: photos upload in the background right after compression; crops are cut and uploaded at save time, skipped when the crop is unchanged (cropSigs); the draft keeps only stored photos (blobs can't go to localStorage), so a photo still uploading when the page reloads is dropped with its tags — cost if wrong: owner re-picks that photo.
Task 10: Ruling: unsaved new order is found through localStorage pointer `draft:new` → `draft:<id>`; edit drafts use `draft:<id>` and are offered too. Material pickers have "+ Thêm mới…" (prompt) because the material list "anh sẽ gửi sau".
Task 10: Ruling: switching even→per-size pre-fills each size with the even count; switching even↔total keeps the typed number (30 → "Tổng 30"), as the e2e expects. Locked (sản xuất/hủy) orders open read-only for qty/tags with the lock message.
Task 10: Ruling: added shared formatQty (1.410) with a unit test; e2e tap helper scrolls the photo into view first.
Task 10: complete (commits 2d7fa1b..8165361, tests: bash -c 'bun test test/unit && bun test test/e2e/order-editor.test.ts test/e2e/tagger.test.ts --timeout 20000' → Ran 13 tests across 2 files. [7.97s])
Task 11: Ruling: prices are typed locally and saved with one "Lưu giá" (single PUT) — saving per field would create one quote version per keystroke on a quoted order; plus "Giá cho mọi dòng → Áp dụng cho mọi dòng" for the common one-price order. "Gửi báo giá" is disabled while prices are unsaved or missing.
Task 11: Ruling: status buttons show only allowed forward moves (never da_bao_gia, never khach_dong_y+ before a quote); "Hủy đơn" asks for confirmation. Customers live under Cài đặt/Đơn hàng links (no extra tab), customer detail route #/customers/:id.
Task 11: Ruling: e2e tests seed orders through the API (seedSampleOrder) instead of the editor, so each UI test checks one thing.
Task 11: complete (commits 8165361..a2fe3e8, tests: bash -c 'bun test test/unit && bun test test/e2e/quoting.test.ts test/e2e/admin-pages.test.ts --timeout 20000' → Ran 11 tests across 2 files. [3.88s])
Task 12: Ruling: "Khmer font loaded" is asserted as: Noto Sans Khmer stylesheet linked + computed font-family of the button + html lang=km (a hard network-dependent font-load check would make CI flaky); a manual run confirmed document.fonts.check(...) = true here.
Task 12: Ruling: an order back in cho_bao_gia (edited with unpriced lines) shows "Báo giá đang được cập nhật" with no button; accepted state shows for khach_dong_y and later statuses when the accepted version is the latest.
Task 12: complete (commits a2fe3e8..36871be, tests: bash -c 'bun test test/unit && bun test test/e2e/quote-page.test.ts --timeout 20000' → Ran 6 tests across 1 file. [2.10s])
Task 13: Ruling: "Lưu ảnh để gửi Zalo" first renders the PNG pages and shows them (iPhone: long-press to save), then a second button shares them with navigator.share (falls back to downloads) — iOS drops the user gesture during async rendering, so a one-tap render+share would fail there — cost if wrong: one extra tap.
Task 13: Ruling: print layout uses fixed 76 mm item rows (overflow hidden) and a 272 mm page box, 3 designs per page; the "fits A4" e2e checks that Chromium's PDF of the print view has exactly paginateItems() pages (3) — an item with many lines (e.g. Nam+Nữ per-size with long notes) could be clipped in print; the PNG export grows to fit instead.
Task 13: Ruling: e2e count PDF pages via the /Pages /Count entry and render in print media (screen media made page.pdf ignore print CSS).
Task 13: complete (commits 36871be..686e33e, tests: bash -c 'bun test test/unit && bun test test/e2e/production-sheet.test.ts --timeout 20000' → Ran 4 tests across 1 file. [960.00ms])
Task 14: Ruling: library adds "+ Nhập ảnh cũ" → #/orders/new?library=1 (editor opens in "chỉ lưu vào thư viện" mode) per spec 6.6; design detail route #/library/:id with label/materials/note/"Cho khách xem" (default off, with a brand-logo warning).
Task 14: complete (commits 686e33e..c162d17, tests: bash -c 'bun test test/unit && bun test test/e2e/library.test.ts --timeout 20000' → Ran 3 tests across 1 file. [1.95s])
Task 15: Ruling: dev/server.ts already accepted --dist since Task 8, so the smoke test was RED only without a dist/ build (verified by moving dist away), GREEN after build.
Task 15: Ruling: beyond the plan, verified on Cloudflare's own runtime: `wrangler dev --local` (workerd + local D1/R2) ran dist-smoke, order-editor and quoting e2e via new E2E_BASE_URL (13/13 + 1/1) — confirms json_each bulk SQL, PBKDF2 100k and R2 calls work on workerd; `wrangler deploy --dry-run` bundles 191 KiB gzip.
Task 15: Ruling: added `bun run release` (scripts/release.ts: tracked files + dist → xuong-dep-<date>.zip) and README.md.
Task 15: complete (commits c162d17..9b8da22, tests: bash -c 'bun test test/unit && bun test test/e2e --timeout 30000' → Ran 41 tests across 9 files. [17.36s])
Final review: fresh reviewer subagent (opus), verdict "With fixes": 2 Critical, 6 Important, 12 Minor.
Final: fixed draft resurrected after save (could overwrite a saved order) — order-editor e2e "a saved order leaves no draft behind…" RED→GREEN, suite unit 123/123 + e2e 44/44
Final: fixed printed sheet clipping Nam+Nữ/material-heavy items — production-sheet e2e "…never clipped in print" + unit paginateByHeight RED→GREEN, suite 123/123 + 44/44
Final: fixed search missing Vietnamese accented capitals (Đức, Ánh) via folded name_search/note_search columns — unit "search finds Vietnamese names…", "design note search…" RED→GREEN, suite 123/123 + 44/44
Final: fixed non-atomic re-quote (numbers committed without the new version) — unit "re-quote is atomic…" RED→GREEN, suite 123/123 + 44/44
Final: fixed stale quote photos cached by position — images now /q/:token/img/:version/:index, immutable — unit "quote images are addressed by version…" RED→GREEN, suite 123/123 + 44/44
Final: fixed currency switch keeping raw prices — server 400 + editor confirm clears prices — unit "changing currency while prices are set is refused" + quoting e2e RED→GREEN, suite 123/123 + 44/44
Final: fixed dashboard dropping orders past the newest 500 — per-bucket SQL — unit "dashboard still lists an old unpaid order after 500 newer orders" RED→GREEN, suite 123/123 + 44/44
Final: fixed doc error (D1 Time Travel: 7 days on Free, 30 on Paid) — re-graded Important: wrong backup expectations for the owner; doc-only, no test.
Final: Ruling: PBKDF2 100k CPU time on the Free plan (10 ms) — not changed blind; verified on the real deployment instead (see deploy notes) — cost if wrong: login fails with error 1102.
Final: Ruling: send-quote's token/version/status writes stay separate batches — version is written before status, so a failure leaves cho_bao_gia and a retry simply makes another version; no wrong numbers can be accepted — cost if wrong: an extra unused version number.
Final: Ruling: schema changed in place (name_search, note_search) instead of a migration — nothing is deployed yet; an old local dev-data DB needs deleting — cost if wrong: dev only.
Final: minor (deferred): accept write not guarded by status (cancel racing accept)
Final: minor (deferred): saveOrder rewrites status even when unchanged (note-only save racing an accept)
Final: minor (deferred): replacing an order deletes order_images rows that library designs still point to ("Xem ảnh gốc" disappears)
Final: minor (deferred): library designs never update from later order edits; old crop objects stay in R2
Final: minor (deferred): manual → Khách đã đồng ý allowed from cho_bao_gia after an unpriced edit
Final: minor (deferred): owner skipping da_bao_gia → dang_san_xuat leaves the customer page showing Accept that always fails
Final: minor (deferred): neededBy / colour-note edits don't reach the customer's quote snapshot
Final: minor (deferred): JSON backup includes quote_token (a forwarded backup can open/accept quotes)
Final: minor (deferred): no login rate limiting; setup claimable by whoever opens the URL first (guide warns)
Final: minor (deferred): 26 px tag hit radius makes very dense photos hard to tag
```

## 26/11/2026 · Kho và vận chuyển, phần 1

Thiết kế: `docs/superpowers/specs/2026-11-25-kho-van-chuyen-phan-1-design.md` · Kế hoạch: `docs/superpowers/plans/2026-11-25-kho-van-chuyen-phan-1.md`

- Migration `0006_kho.sql`: bảng `trips`, `bags`, `bag_events`. Lịch sử quét bị trigger khóa, không sửa hay xóa được.
- Tài khoản **Xưởng** (role `worker`): chủ tạo ở Cài đặt → Người dùng. Chỉ vào được `/kho`, không thấy khách, giá hay ảnh gốc.
- Khu **`/kho`** (Việt + Khmer):
  - đóng bao theo ri, ghi hàng gửi kèm
  - in tem decal A4 3 × 7, QR chỉ chứa mã bao
  - chuyến xe: xếp, bỏ khỏi xe, cho xe chạy
  - nhận chuyến và chốt thiếu bao
  - kho Cam, giao khách
  - trang bao có lịch sử quét; chỉ chủ chỉnh sửa
- Trang đơn quản lý có phần "Vận chuyển". Khách có phần "Hàng của bạn". Trang chủ quản lý có ô Kho. Telegram báo xe chạy, chuyến thiếu bao, toa giao đủ.
- Tự chuyển trạng thái đơn: bao đầu tiên chuyển đơn sang Đang sản xuất, giao đủ đôi chuyển sang Đã giao. Mở lại đơn đã giao: chỉ chủ.
- File sao lưu có thêm bao, chuyến xe và lịch sử quét.
