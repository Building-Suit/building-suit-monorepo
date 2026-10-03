# SS-MARKET-VAL-001 — General small-shop marketing gate

**Gate: BLOCKED. General small-shop marketing is not approved.** The executable qualification package is implemented; passing results and sign-off are separate. See [current execution evidence](SS-MARKET-VAL-001-verification.md). Dependency task status is not verification of this candidate.

Scope is the task payload's VAL-01–09 and VAL-11–13, with UX-D02 retaining the existing PrimeVue/Tailwind/Building UI. The historical readiness tables reuse these IDs with different meanings; the supplied task definitions govern this gate. No feature redesign, hosted operation or release is included.

## Repeatable local verification

Use this worktree and its frozen lockfile. Only a prepared, **synthetic disposable Shop** backend is eligible: project `building-suit-shop`, API `http://127.0.0.1:61321`, container `supabase_db_building-suit-shop`, local Unix Docker socket. Never use a customer-data copy. Follow the maintained [local database workflow](../../../docs/shared/database.md) to prepare the migration chain separately. The market SQL runner neither migrates nor resets a database and accepts no target URL/ref. It refuses execution without the existing `SHOP_PILOT_DISPOSABLE=1` acknowledgement.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @building-suit/shop-suit prepare
node --test apps/shop-suit/tests/unit/*.test.mjs
pnpm check
pnpm --filter @building-suit/shop-suit typecheck
pnpm --filter @building-suit/shop-suit lint
APP_ENV=local NUXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:61321 NUXT_PUBLIC_SUPABASE_KEY=local-ui-test-key pnpm --filter @building-suit/shop-suit build
SHOP_PILOT_DISPOSABLE=1 node apps/shop-suit/tests/market/database.mjs
pnpm exec playwright test -c apps/shop-suit/playwright.market.config.ts --list
SHOP_PILOT_DISPOSABLE=1 pnpm exec playwright test -c apps/shop-suit/playwright.market.config.ts
pnpm exec playwright test -c packages/testing/playwright.shop-ux.config.ts
git diff --check
```

The dedicated market configuration selects **37 real-backend cases**, with one worker and no retries: 3 modes × 3 roles × 2 languages × 2 widths = 36 daily loops, plus an authority-revocation case. It inherits the pilot's local credential guard and trace/video suppression. Selecting this configuration defaults the disposable acknowledgement to `1`, preserving an explicit opt-out. `--list` requires Playwright, but no Docker or server. The app-local entry point also selects this configuration when given `tests/e2e/market-qualification.spec.ts`; without a spec selection it defaults to the separate service pilot suite.

Owners import customers, and in retail/mixed cells import products and suppliers and post a purchase through the browser. The chosen owner/manager/cashier then signs in independently, opens a cash shift, scans a barcode/adds a service, selects the imported customer, pays, reloads the immutable receipt and closes the shift. Replaying the exact checkout must not duplicate its payment. Owner RPC reports reconcile the results and the owner report screen must render. Setup uses real local Auth admin creation only for random synthetic identities; business setup and all transactions use public RPCs with user JWTs. Business responses are never intercepted. Fixtures intentionally remain in the disposable backend; no tenant-deletion/reset cleanup runs automatically.

The SQL runner executes **27 suites**, each in its own rollback-only transaction: the 19 pilot domain suites plus owner bootstrap, product/service catalogs, manual inventory, customers, supplier payables/returns, catalog import, and the new three-mode reconciliation loop. This explicitly includes reports, receipts and retail coverage absent from the default DB command. It stops on the first failure. No skipped or unexecuted case may count as passing.

After the rollback suites, run the existing independent-session probes serially on the same explicitly disposable local backend, with Docker pinned locally:

```sh
DOCKER_HOST=unix:///var/run/docker.sock DOCKER_CONTEXT=default pnpm db:test:shop:sale
DOCKER_HOST=unix:///var/run/docker.sock DOCKER_CONTEXT=default pnpm db:test:shop:payment
DOCKER_HOST=unix:///var/run/docker.sock DOCKER_CONTEXT=default pnpm db:test:shop:supplier
DOCKER_HOST=unix:///var/run/docker.sock DOCKER_CONTEXT=default pnpm db:test:shop:stock
DOCKER_HOST=unix:///var/run/docker.sock DOCKER_CONTEXT=default pnpm db:test:shop:cash
DOCKER_HOST=unix:///var/run/docker.sock DOCKER_CONTEXT=default node tooling/database/test-shop-sale-correction-local.mjs --concurrency-only
```

These older probes create committed synthetic rows and have their own cleanup; some apply pending **local** migrations. Inspect them before execution and retain failures as gate blockers. The pilot runbook records a previous supplier concurrent-return deadlock: it is an unresolved risk for this broader gate, not a waived test or proof of a current failure. Do not replace a failed simultaneous-write test with a serial replay and call it concurrency coverage.

## Measurable acceptance matrix

Record date, operator, exact HEAD plus uncommitted diff, environment, command/case, result and sanitized evidence for each row. A source-code assertion, mocked browser response or successful build cannot prove authenticated authorization or persisted reconciliation.

| Requirement | Pass criterion | Evidence |
| --- | --- | --- |
| VAL-01 | Every row has an actual result; no unknown/skip is converted to pass | This matrix and verification record |
| VAL-02 | Product-only, service-only and mixed daily loops finish for owner, manager and cashier | All 36 real-auth browser cells and three SQL mode loops |
| VAL-03 | Mixed POS receipt has one product + one service, total EGP 50; only product stock moves 10 → 9 | Real-auth mixed cells; SQL mixed loop uses two products + service, EGP 70 |
| VAL-04 | Sale/purchase/payment/expense/stock retries have one financial/stock effect; request conflicts rejected | Market checkout/import replay; market SQL purchase/draft/issue/payments/correction/return replay; safe-command, expense, inventory and import suites; independent-session probes |
| VAL-05 | Purchased 10 units at EGP 10 → sell 2 → 8 remain → full correction restores 10 → supplier return 2 leaves 8 worth EGP 80 | `shop_market_reconciliation.sql` in product and mixed modes; correction/supplier suites |
| VAL-06 | Customer pays EGP 10 against EGP 40/30/70 sale: outstanding 30/20/60; correction refunds only 10 and clears balance. Supplier purchase 100, paid 40, return credit 20: payable 40 | Market SQL plus customer-payment/supplier-payables suites |
| VAL-07 | Insufficient stock leaves draft/money/movements unchanged; competing sales/count/returns serialize without overselling | Sale/stock/supplier independent-session probes and domain rollback suites |
| VAL-08 | Archived product retains 8 units, value 80 and original sale history; barcode lookup no longer offers it | Market SQL; catalog and stock suites. Archive is the implemented retirement mechanism; no separate discontinued lifecycle is claimed |
| VAL-09 | Staff can execute only granted actions; a signed-in suspended cashier loses RPC read/write access; outsider and other-shop owner are denied | Real-auth boundary case; team/location/public-privilege/supplier/customer/correction suites. Existing pilot barber-revocation matrix remains complementary |
| VAL-11 | English/LTR and Arabic/RTL at 360 and 1440 px complete the real workflows without overflow/errors; synthetic suite covers 768 px, themes, empty/error/loading/retry/denied states | Market matrix + `playwright.shop-ux.config.ts`; manual touch, keyboard/focus and assistive-technology checks below |
| VAL-12 | Sales, collections, receivables, supplier payable, stock/FIFO margin and exports reconcile to source records | Market SQL + `shop_operating_reports.sql`; browser receipt/report/shift assertions and existing report export UX tests |
| VAL-13 | Code, automated, manual, deployed and commercial evidence remain distinct | Verification record and capability checklist below |

Browser daily-loop expected totals (decimal EGP): product 20, service 30, mixed 50. Starting cash 50; closing cash 70/80/100 with zero variance. Fully-paid customer outstanding is zero. Retail/mixed purchase payable is 100 and stock is 9 after checkout. The separate SQL correction loop retains original sale records while excluding corrected revenue from net sales; collections show 10 in, 10 refunded, zero net. Receipts represent fully paid sales; partial payment is not receipt qualification.

## Marketing capability checklist

All rows below describe **implemented candidates awaiting this gate**, not commercially approved promises.

| Capability | Required evidence and permitted scope |
| --- | --- |
| General product/service/mixed shop operations | All real-auth daily loops pass; disclose plan/role restrictions |
| Purchasing and supplier balances | Partial payment, stock return, credit/reversal, isolation and concurrent-return checks pass |
| Inventory | Purchase, FIFO sale/correction, count race, insufficient stock and archived-stock history reconcile |
| Barcode and import | Browser keyboard-wedge scan; customer/product/supplier CSV dry-run/apply; duplicate/conflicting retry. CSV import is not native XLSX import; label-data export is not printer integration |
| Receipts and cash | Immutable paid receipt/reload, checkout replay and shift zero/nonzero-variance checks; verify selected physical scanner/printer separately before making hardware claims |
| Reports/export | Full source-record reconciliation and filtered export parity; these are operational reports, not accounting profit/statements |
| Arabic/mobile/staff | Actual matrix plus manual device/keyboard/RTL checks, server-side role/revocation evidence |
| Corrections | Implemented full-sale correction/return and supplier stock return; do not promise partial line-level customer returns |
| Egypt ETA | **Excluded.** No completion/qualification evidence for **SS-EGY-ETA-001** is supplied. Printed receipts do not establish ETA compliance |
| Offline | **Excluded.** No completion/qualification evidence for **SS-OFFLINE-001** is supplied. Do not promise offline checkout, offline stock writes or later synchronization |

Required customer-facing limitation copy before any approved marketing:

> Internet access is required. Offline operation is not qualified. Receipts are operational proof of sale; Egypt ETA electronic invoice/receipt compliance is not qualified.

> يلزم الاتصال بالإنترنت. التشغيل دون اتصال غير معتمد. الإيصالات إثبات تشغيلي للبيع؛ لم يتم اعتماد التوافق مع منظومة الفاتورة أو الإيصال الإلكتروني لهيئة الضرائب المصرية.

Remove either exclusion only after its named task is complete **and** the capability has its own passing evidence and approval. This task does not infer legal compliance from a feature name or deploy any marketing copy.

Manual verification remains unchecked:

- [ ] Owner and representative staff complete product/service/mixed days on selected real devices in both languages and themes; inspect terminology, touch targets, focus order, dialogs, empty/loading/failed/denied states and recovery.
- [ ] Reconcile purchase, customer/supplier partial payments, full correction and remaining stock against source records and downloaded reports; inspect date/location filters and Arabic spreadsheet rendering.
- [ ] Exercise the chosen scanner and printer, reprint and receipt-sharing destination before advertising those specific integrations.
- [ ] Record the exact capability claims and exclusions accepted by the commercial owner. Technical checks do not confer commercial approval.

Deployment, hosted database changes, publication, commits and merges require their own authorization and were excluded by this task. Passing this local gate is not evidence of deployment.
