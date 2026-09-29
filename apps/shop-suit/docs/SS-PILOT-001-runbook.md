# SS-PILOT-001 — Two-branch barber pilot qualification

Task qualification: **BLOCKED pending hosted monitoring evidence and real-owner UAT**. This package prepares repeatable qualification; it does not authorize a launch. Commercial approval and physical hardware validation are separate launch follow-ups, not additional SS-PILOT-001 acceptance criteria. Current execution results are in [the verification record](SS-PILOT-001-verification.md).

Scope is one paid barber business with two branches. The task payload's requirement meanings (SAFE-09, UX-01/08, VAL-01/02/03/04/09/11/13) govern this gate; older readiness tables reuse some IDs with different meanings. UX-D02 preserves the existing PrimeVue/Tailwind/Building foundation. The linked UX task is inherited, not a new redesign queue.

## Safe local execution

Shop's default `playwright.config.ts` selects the real-auth qualification suite, so the app-local verifier can use `pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/pilot-qualification.spec.ts`. Add `--list` to inspect all 20 cases without starting a server or accessing a database. Selecting this suite opts into synthetic writes on the prepared disposable backend described below: the configuration defaults `SHOP_PILOT_DISPOSABLE` to `1` for both the test server and workers. An explicit non-`1` value is preserved and blocks execution. The separate mocked usability suite uses the explicit `packages/testing/playwright.shop-pilot.config.ts` configuration.

Use the current worktree, its frozen lockfile and a synthetic disposable **Shop** backend (`building-suit-shop`, API `127.0.0.1:61321`). The standalone database/export/restore scripts still require an explicit `SHOP_PILOT_DISPOSABLE=1`; all pilot tooling pins Docker to the local Unix socket and accepts no hosted URL/ref. Never run this suite or set this acknowledgement for a local database containing customer copies. The tooling does not apply migrations or reset the source database. Prepare a disposable backend with the maintained [database workflow](../../../docs/shared/database.md) before qualification; a missing migration is a failed prerequisite.

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @building-suit/shop-suit prepare
node --test apps/shop-suit/tests/unit/*.test.mjs
pnpm --filter @building-suit/shop-suit typecheck
pnpm --filter @building-suit/shop-suit lint
APP_ENV=local NUXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:61321 NUXT_PUBLIC_SUPABASE_KEY=local-ui-test-key pnpm --filter @building-suit/shop-suit build
pnpm check
SHOP_PILOT_DISPOSABLE=1 node apps/shop-suit/tests/pilot/database.mjs
pnpm exec playwright test -c packages/testing/playwright.shop-pilot.config.ts
SHOP_PILOT_DISPOSABLE=1 pnpm exec playwright test -c apps/shop-suit/playwright.qualification.config.ts
# Stop browser/application writers before taking the consistent recovery sample.
SHOP_PILOT_DISPOSABLE=1 node apps/shop-suit/tests/pilot/restore.mjs
git diff --check
```

The real-auth configuration retrieves credentials from **local** Supabase status in memory. Only the local public key reaches the app. Admin credentials bootstrap random synthetic Auth users; all business setup and operations then use user JWTs and public RPCs. No API response is mocked. Trace/video recording is disabled to avoid retaining credentials. Browser screenshots contain synthetic data only. Fixtures intentionally remain for the restore drill; discard the entire explicitly disposable environment later through the maintained workflow. No cleanup script deletes arbitrary tenants.

The SQL runner runs 19 suites in separate rollback-only transactions: business modes, privileges, safe writes, locations, team, scheduling, appointments, sale issuance, customer payments, supplier purchases, expenses, stock correction, POS, cash, receipts, sale correction, owner reports, billing and platform administration. It includes the receipt/report suites missing from the older default runner. It stops on the first failure and does not print fixture SQL or database output. Inspect a failed fixture privately through local `psql` with `ON_ERROR_STOP=1`, wrapped in `BEGIN`/`ROLLBACK`.

The pilot gate uses the sale, payment, stock, cash and sale-correction independent-session checks on the designated disposable backend:

```sh
pnpm db:test:shop:sale
pnpm db:test:shop:payment
pnpm db:test:shop:stock
pnpm db:test:shop:cash
node tooling/database/test-shop-sale-correction-local.mjs --concurrency-only
```

These legacy runners create committed synthetic fixtures and have their own cleanup; inspect any failure/leftovers before rerunning. Do not run them concurrently with the restore drill. A passing serial retry does not establish concurrent idempotency. The supplier runner is outside this task's location/team/appointment/POS/cash/correction scope; its known concurrent-return deadlock belongs in a separate supplier-domain task and does not justify changing its regression fixture here.

## Acceptance and evidence matrix

Record pass/fail/blocked, date, operator, exact HEAD plus uncommitted diff, environment, command, case, and a sanitized evidence link for every row. A skip or missing prerequisite is not a pass.

| Gate | Required evidence | Automated coverage / remaining manual work |
| --- | --- | --- |
| SAFE-09 | No hosted writes, publication or provider changes without explicit operator authorization | Local-only scripts; release operator separately verifies environment registry refs. |
| Owner/manager/cashier day | Both branches: open with EGP 50 → walk-in / booked customer → EGP 100 service → cash checkout → immutable receipt/reload → close at EGP 150, variance zero → owner combined sales/collections EGP 200 | Real-auth matrix: 18 cases (3 roles × 2 languages × 3 widths). Physical print/share and owner approval remain UAT. |
| Barber boundary | Both branches: book walk-in, arrive, start, complete, hand off; cashier handles payment | Two real-auth cases verify barber sale issue/cash/report denial, branch revocation with existing JWT, and membership suspension. Do not silently grant cashier authority to barber. |
| Branch state | Selected branch persists across routes; changing branch with a POS draft disables checkout; returning restores the correct context; revoked branch disappears | Real-auth matrix plus existing synthetic branch-switch matrix; delayed-response/account-switch probes remain UAT. |
| UX-01/08, VAL-11 | English/LTR and Arabic/RTL at 360×900, 768×900, 1440×900; keyboard, touch, pending, empty, denied, retry, both themes | Real-auth journey + existing 26 synthetic usability cases. Real devices, light/dark visual inspection and assistive technology remain UAT. |
| VAL-02/03 | Product-only, service-only, mixed modes; mixed cart preserves product and service lines and stock | `shop_business_mode`, `shop_pos_checkout`, `shop_sale_issuance`; real browser matrix is service-only. Product/mixed browser checks remain UAT. |
| VAL-04 | Exact checkout replay produces one payment; simultaneous writes preserve money/stock; no duplicate purchases, expenses or movements | Real-auth exact request replay, safe command/domain suites and legacy concurrency runners above. |
| VAL-09 | Owner/staff capabilities, suspended user, outsider, another shop, branch denial | Location/team/privilege/command SQL suites plus live-JWT branch/suspension browser cases. Hidden controls are not authorization evidence. |
| Recovery/export | Recover synthetic business data with matching fingerprints and authorization regressions; export one tenant without another tenant's data | Procedures below; both must actually pass. |
| Monitoring/support | Staging and production health, safe errors, log visibility, alert receipt, support ownership | Operator checklist below; repository configuration alone cannot pass it. |
| VAL-01/13 | Every gate has measurable evidence; implementation, automated, manual, deployed and commercial states remain separate | Verification record; no automatic approval from inherited task status. |

## Export on customer request

The pilot offers **operator-assisted export**, not a self-service screen. Verify the requester's current ownership and requested scope using trusted membership records, record approval and recipient, and explicitly authorize the target product/environment before any hosted customer-data access. Use immutable refs from [the environment registry](../../../docs/architecture/environments.json), not a cached CLI link.

The local portability drill is:

```sh
SHOP_PILOT_DISPOSABLE=1 SHOP_PILOT_EXPORT_SHOP_ID='<synthetic-shop-uuid>' node apps/shop-suit/tests/pilot/export.mjs
```

It reads one repeatable-read, read-only snapshot and writes a private, ignored JSON package under `.local/ss-pilot-001/exports/`. It exports the selected shop, branches, customers, catalog, appointments, invoices/lines, payments/allocations/adjustments, receipts, sale corrections, shifts/drawer events, stock movements and expenses. Child invoice lines are scoped through their parent invoice. The console reports counts and a SHA-256 hash, never rows. Auth credentials/sessions, invitation codes, platform-admin records and billing proof files are excluded. This finite business-data package is not a full backup, staff-account transfer or file-store export.

Before delivery, independently reconcile row counts and receipt/payment totals against the source, inspect all tenant IDs/parent joins, and compare an export of a second synthetic tenant to prove isolation. For hosted requests, an authorized operator reviews and adapts the explicit queries in `tests/pilot/export.mjs` to the verified environment through a scoped read-only connection. Never change the local-only runner to accept remote URLs. Separately inventory requested attachments and obtain authorization for their export; SQL does not export Storage object bytes. Include field/amount semantics (decimal EGP, UTC timestamps, branch IDs), coverage/exclusions and checksums. Deliver through an authenticated encrypted channel to the approved owner; record acknowledgement and the agreed retention/deletion date. Do not attach customer exports to PRs or public support tickets. Hosted fulfillment remains unverified until this procedure is exercised by an authorized operator.

## Backup and restore

The disposable drill requires representative journey rows in shops, locations, appointments, invoices, payments, immutable receipts and cash sessions. It fingerprints every row in `public`, `shop_private` and `auth`, creates a custom-format `pg_dump` of the local database, restores to a uniquely named **new** local database, compares fingerprints, verifies the source remained stable, and reruns all 19 SQL suites on the restore. It preserves ownership/ACLs; restoring without grants is not acceptable authorization evidence. The destination database and temporary archive are removed in `finally`; source business data is never reset. Only hashes, counts, timing, HEAD and suite names are saved to `.local/ss-pilot-001/restore-evidence.json` after successful validation. A failed command/cleanup makes the drill fail. Failure output names only the generated local destination for private operator cleanup.

This tests recovery of local database contents in the same PostgreSQL cluster; it does **not** prove hosted disaster recovery, independent role/bootstrap reconstruction, Auth login after provider recovery, SMTP, keys, or Storage object recovery. Keep those limitations on the release gate.

Before an authorized pilot deployment, the operator must:

1. Verify production/staging refs, PostgreSQL/extension and migration versions, backup availability, source cutoff and approved recovery target. Agree and record numeric RPO/RTO with the owner; no targets are assumed here.
2. Inventory business schemas, private helpers, Auth identities, grants/RLS, migration history, Storage objects, and separately managed environment/provider configuration. Never keep secrets inside the customer export. Capture a recovery point using supported provider tooling and store encrypted artifacts in restricted storage with checksum, retention and restore instructions.
3. Restore into an explicitly authorized disposable target, never overwrite the live business database. Disable outbound notifications/integrations there. Verify constraints, policies/grants, schema/migration versions, counts, checksums, immutable receipts, payment allocations, stock, corrections and cash totals.
4. Run owner/manager/barber/cashier login and both-branch journey/denial checks in the restored environment, with real Storage objects where used. Record actual data loss interval and recovery duration against the agreed RPO/RTO.
5. Have the operator and owner review reconciliation. Any hosted cutover/rollback requires its own explicit authorization. Preserve the source and recovery point until sign-off; do not edit applied migration history to recover.

## Monitoring and support diagnostics

Complete separately for staging `jvvelvftpfnlogalgxgv` and production `fgdzjnsbcxfbiuogbmom`, reconfirming the registry at execution time.

Read-only repository/runtime inspection on 2026-09-29 established only the following:

- The environment registry identifies both Supabase projects, but describes production as awaiting app deployment/final cutover and staging as awaiting app deployment. It is not evidence of a live application, current commit, health, or logging.
- `apps/shop-suit/vercel.json` allows automatic Git deployments only for `stg` and `main`; no linked local Vercel project, telemetry integration, log drain, alert route, or provider retention policy is present in this worktree. Repository configuration cannot prove that a provider dashboard applied the setting.
- The Shop runtime config uses only the public Supabase URL/key in the browser. The checked-in environment template leaves the key blank. The platform-admin UI provides authorized read-only shop detail, privileged audit and support-note views; production hides raw platform-admin session errors, while product pages map known domain failures to translated messages.
- No request/correlation ID is exposed by the Shop UI, and this authorized shell has no Vercel, Supabase management, Sentry, OpenTelemetry, or alerting credential/configuration available for a hosted read-only check. Provider log contents, redaction, retention, alert delivery and operator access therefore remain unverified.

Accordingly, the monitoring/support acceptance item is **BLOCKED — operator verification required** for both environments. An authorized operator must collect the evidence below without copying secrets or customer payloads.

| Check | Evidence required for each environment |
| --- | --- |
| Correct deployment | URL, environment, commit, migration versions, operator and UTC timestamp; no keys/cookies. |
| Availability | Login page, real authenticated calendar/POS/report read; uptime observation and named support owner. |
| Error visibility | Correlate a known benign denied read with browser status and existing Auth/API/Postgres or application logs; confirm operator can locate time, route/RPC, error code and request ID if available. Never manufacture a customer financial write. |
| Safe failures | Permission/network failure gives translated actionable UI, retry works, no SQL/internal exception or credentials displayed; inspect server output privately for payload leakage. |
| Alert delivery | Existing alert destination, responsible operator, retention and escalation policy; authorized safe staging probe actually reaches that destination. Missing alerting remains a blocker, not an inferred capability. |
| Support rehearsal | Owner can report timestamp, branch, page/action, sanitized transaction reference and browser version; operator traces it and records resolution. Never request password, OTP, JWT, full HAR, raw SQL payloads or billing proof in an ordinary ticket. |

Use existing provider observability; this task does not install a new monitoring service. Do not send a test notification to another person without explicit authorization. Production probes are read-only; a deliberate error/alert injection requires separate operator authorization. Record missing logs, alert routes or retention as blockers.

## Owner UAT

Record the real two-branch owner's name privately, verifier, date, build/diff, device/browser, branch and locale, result and evidence for each item. Leave boxes empty until performed with the owner:

- [ ] Create/configure the barber business, two branches, staff assignments, service price/duration/cleanup and hours; explain the six onboarding links, trial, manual InstaPay billing and separate admin workflow.
- [ ] Owner and manager complete the day in both branches; barber books/arrives/serves/completes; cashier completes payment. Owner accepts the role handoff and tests denied actions.
- [ ] Walk-in and saved-customer booking reach the correct branch/staff/service in POS; cash/card examples and on-screen receipts reconcile.
- [ ] Count and close both tills, including a known nonzero variance; owner reconciles combined and per-branch sales, collections, outstanding balances and reports to source records.
- [ ] Retry/double-click, interrupted payment, branch switch with a draft, slow old-branch response, logout/account switch, suspension, outsider and other-shop access do not duplicate writes or reveal stale data.
- [ ] Product-only, service-only and mixed business checks; one stocked product + service sale decrements only product stock. Correction/full return preserves audit, payment and stock links.
- [ ] Arabic/RTL and English/LTR at the qualified viewport classes, both themes, keyboard/focus and touch, loading/empty/error/denied/recovery. Confirm terminology with the owner.
- [ ] Operator-assisted tenant export delivered to the approved owner; recovery rehearsal, monitoring/alert visibility and support contact/escalation accepted.

The checklist is created and ready. No real-owner UAT has been executed or signed in this task.

### Separate launch/operator follow-ups

- Validate the actual phone/tablet/desktop models, thermal printer, reprint workflow and sharing destination selected for launch.
- Record commercial price/support approval separately from technical task verification and deployment authorization.

Known pilot limitations: no Egypt ETA compliance claim unless **SS-EGY-ETA-001** is later complete and separately qualified; a printed receipt is proof of sale, not evidence of ETA integration. Operating reports are not accounting profit/statements. Default barber lacks sale-issue/cash/report rights. Billing is manual InstaPay review; no automatic payment-provider integration is claimed. The automated full-day matrix is service-only. Real-owner UAT and provider monitoring evidence remain task blockers; hosted restore, physical hardware and commercial approval remain separate launch/operator follow-ups. This is not the broad Egypt retail launch.
