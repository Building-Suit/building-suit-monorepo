# SS-OFFLINE-001 acceptance tracker

Status: local implementation checkpoint; cloud infrastructure stopped server verification; **publication blocked** until authenticated real phone/tablet network-loss and replay evidence exists. No PR, hosted migration, deployment or task completion claimed.

Branch: `codex/shop-suit/ss-offline-001`; worktree: `/workspace/ss-offline-001`. Base: verified live `stg` `547005b263e1a2eedaa6f09a3fc9837d059d6d05`, explicitly requested by the user. Billing PRs #305/#307 are owned separately and untouched. Before future publication, refresh live Shop stack topology and reconcile a review target without modifying billing. UI PRO tasks, home devices/network, tunnels, Penpot and n8n are excluded.

## Acceptance and implementation

| Original acceptance | Implemented cloud behavior | Verification status |
| --- | --- | --- |
| POS records allowed sales/payments and manages an open cash shift during an outage | Loaded authenticated POS uses bounded cached catalog/staff/active drawer; encrypted sale/payment envelopes; cash movements and close queued against the existing drawer; opening a new shift stays online | Browser queue mechanics pass; authenticated product flow pending |
| Stable local/request IDs; visible unsynced/syncing/failed/synced states | UUID envelope/request IDs persist before cart reset; shared status/retry/receipt presentation; crash resumes identical envelope | Chromium queue/reload/lost-response tests pass; full product UI pending |
| Reconnect through existing server idempotency; no duplicate invoice/payment/stock effects | Atomic wrapper composes existing save/checkout requests, locks captured drawer, persists full payload and actor, returns committed replay even after drawer close | SQL replay/financial-effect tests blocked by local backend startup/disk exhaustion |
| Visible recoverable conflicts/rejections; nothing silently dropped | Rejection retained with same signed payload; localized recovery instructions/retry; failed record blocks FIFO including close; no automatic discard or rewritten request IDs | Chromium conflict barrier/retry passes; server recovery pending |
| Minimize/protect sensitive local data | AES-GCM encrypted IndexedDB; non-extractable local AES/HMAC keys; HMAC envelope verification; environment/user/shop/location scope; no cached customer contacts, appointment lists, media, auth tokens or history; 12-hour cache expiry; cache cleared on identity/scope change; up to 3,000 viewed items and 200 pending transactions | Chromium isolation/encryption/key/expiry tests pass; physical browser storage behavior pending |
| Back-office purchases/reports/settings may stay online | Only POS and existing cash-shift commands use the queue | Code boundaries inspected; workspace check passes |

## Required verification

- [x] Cloud Chromium offline/online transitions for local queue mechanics.
- [x] Cloud Chromium durable reload and ambiguous-response replay with identical IDs.
- [x] Cloud Chromium failure barrier/recovery, real two-tab Web Lock serialization, scope isolation, ID reuse rejection, encryption and cache expiry.
- [x] Existing SSR appointment/customer lock regression and report-format regression (6 tests).
- [x] Workspace ownership/boundaries; `git diff --check`.
- [ ] Authenticated disposable SQL duplicate/price/shift conflict tests.
- [ ] Authenticated loaded POS and drawer outage/replay in cloud browser.
- [ ] Independent server-session/device duplicate replay and concurrent shift-close safety.
- [x] All six consumers typecheck, lint and build. Serial build retry passed after internal Rolldown failure. Lint has zero errors and two pre-existing owner-invitation ordering warnings.
- [x] Complete regression suite: 1,461 tests, 1,438 passed, 23 intentionally skipped, zero failures (with installed Playwright binaries).
- [ ] **Authenticated physical phone/tablet network-loss and replay evidence**: external mandatory publication gate. Cloud emulation is not this evidence. User devices must not be used.

## Evidence and limitations

Task-owned reproducible commands:

```sh
node apps/shop-suit/tests/browser/offline-counter.mjs
node apps/shop-suit/tests/browser/offline-counter-db.mjs
node --test apps/shop-suit/tests/unit/pos-customer-ssr.test.mjs apps/ledger-suit/tests/unit/report-formats.test.mjs
pnpm exec turbo run typecheck --concurrency=1
pnpm exec turbo run build --concurrency=2
pnpm lint
pnpm test
pnpm check
```

Use the pinned pnpm 10.33.0. Browser harness defaults to `/usr/bin/chromium`; `CHROMIUM_PATH` can select an installed browser. It uses real browser IndexedDB/WebCrypto/Web Locks, but an isolated test document and simulated server outcome, **not authenticated product/server evidence**. The database runner is fixed to the disposable `supabase_db_building-suit-shop` container and rolls back synthetic fixtures.

Offline availability requires a previously loaded authenticated counter and unexpired local cache. Only previously viewed catalog items are available. Customer/appointment search, media and new shift opening stay online. Fresh navigation from a closed browser or a hard reload while disconnected is unsupported; persisted transactions resume after authenticated online reload. Browser eviction/private-mode storage loss cannot be made durable by JavaScript. Storage/Web Locks failure blocks local recording; queued transactions are never automatically dropped. A successful local record is provisional, not a server-issued receipt.

Local signatures detect accidental payload alteration and AES-GCM protects plaintext at rest. Keys remain available to this origin for authorized replay; this is not protection against malicious same-origin script, a compromised browser profile or a server-attested device signature. Server auth, permissions, payload equality, stock/price rules and drawer locks remain authoritative.

Recovery currently retries an immutable rejected envelope after an operator resolves its stock/permissions/drawer condition. Price or irrecoverably closed-shift conflicts require a documented operator reconciliation path before qualification; there is no automatic repricing, discard or reassignment to another drawer.

A new forward migration is prepared locally. Hosted application must use the repository's GitHub CI workflow only; no direct hosted SQL or production/main deployment is authorized. Physical qualification and unresolved cloud checks prevent publication, including a draft PR.

## Cloud checkpoint results (2026-10-14)

Passing: queue Chromium harness; focused six SSR/report-format regressions; complete regression suite (1,438 passes, 23 skips); all six consumers typecheck/lint/build; ownership checker and whitespace checks. Full build completed with `--concurrency=1` after the parallel retry failed inside Rolldown. Original full regression failures from missing browser binaries were resolved by installing Playwright Chromium in `/tmp/ss-offline-browsers`; no source workaround was used for those checks.

**Blocked action:** start the disposable Shop Supabase backend and run `shop_offline_counter.sql` plus authenticated loaded-POS outage/replay. **Target:** local `building-suit-shop` only. **Reason:** image pulls encountered registry throttling; required `supabase/postgres:17.6.1.165` download/startup filled the 32 GB root filesystem before any backend container became available. Sandbox commands then failed with `No space left on device`. Startup processes were stopped, and only unused service images downloaded by this task were removed. No containers, volumes, product data, source or branches were deleted. Disk recovered to 24 GB free; no local backend is running. **Outcome:** startup not completed; server tests unrun, not denied or passed. Retrying the same oversized startup is deferred to an adequately provisioned disposable backend.

Publication remains **pending and blocked**, not denied: required physical phone/tablet evidence has not been supplied. No cloud simulation or queue fixture substitutes for it. Cloud financial-effect and authenticated product verification must also pass before claiming PR readiness. Irrecoverable price/closed-drawer rejection reconciliation remains an explicit acceptance gap; current retry does not reassign a sale to another drawer or discard it.
