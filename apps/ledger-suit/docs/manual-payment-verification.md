# LS-BILL-002 — InstaPay/manual payment

Implements BILL-MAN-01–04 and approved decision LS-D-MANUAL-PAYMENT. Changes are local and uncommitted; no hosted database, deployment or publication was performed.

Customers select an approved launch plan and monthly/yearly interval in the existing checkout, then choose manual transfer. `prepare_manual_payment` resolves the existing catalog on the server and stores an immutable purchase quote, including customer-facing instructions. No amount, currency, price ID or entitlement target is accepted from the browser. One unfinished request per organization prevents competing quotes; cancel it to change plans. Unconfigured instructions fail closed.

`manual-payment` authenticates the customer and checks current billing permission before accepting a receipt. It bounds the actual streamed body, checks JPEG/PNG/PDF signatures and MIME, enforces 5 MiB, computes SHA-256 and uploads a fresh object with overwrite disabled. The private `manual-payment-receipts` bucket has no browser write/delete policies. Database constraints independently check recorded size and MIME. Tenant billing managers and eligible operators can read linked receipts; unlinked uploads remain inaccessible to customers. These checks validate format signatures, not malware scanning.

The state flow is `draft → submitted → under_review → approved/rejected`, with direct submitted-to-approved/rejected decisions allowed. Draft is the pre-submission quote. Rejected requests accept new evidence and return to submitted; previous files and evidence records remain. Non-approved requests can be cancelled with a reason. Evidence and history rows reject UPDATE/DELETE. An interrupted upload can retry its evidence ID with the same bytes; ambiguous failures retain objects rather than risking deletion of submitted evidence. Unlinked failed uploads require a separately reviewed retention/cleanup operation.

Approval is a database command using the authenticated operator's identity. `app.manual_payment_operators` is a private allowlist, inaccessible to customers and service-role API writes. Tenant membership, request creation or evidence submission disqualifies an operator from reviewing that request. Browser service-role credentials are never used. Review requires the current evidence ID and a nonempty reason. A stale evidence decision fails.

Approval locks the organization, request and subscription and commits the subscription, purchased dates, request state and audit history together. Replays return the existing result without another period or history row. The plan and price come from the original server quote. Manual periods are UTC calendar months/years starting at approval (or after an existing active same-plan manual period), with provider `manual` and the request UUID as source identity. There is no automatic renewal. Existing active card/other-plan subscriptions cause a conflict rather than being replaced; an in-flight Paymob success cannot overwrite an active manual period. Existing Paymob checkout signatures, cadence and webhook handling remain in place.

## Configuration and operator use

These are instructions for a separately authorized environment setup, not changes performed by this task. Verify the product/environment against `docs/architecture/environments.json` first. Apply the migration and deploy the Edge Function using the maintained database runbook. Through a trusted database administrator connection, configure ONLY public recipient instructions:

```sql
insert into app.manual_payment_configuration(singleton,instructions)
values (true,'InstaPay recipient: YOUR_PUBLIC_RECIPIENT. Include the request reference in the transfer.')
on conflict(singleton) do update set instructions=excluded.instructions;
-- Use a real verified operator Auth user belonging to this Ledger environment.
insert into app.manual_payment_operators(user_id) values ('OPERATOR_USER_UUID');
```

Do not put passwords, API keys or privileged payment credentials in instructions. The operator uses a short-lived authenticated user access token via `MANUAL_PAYMENT_OPERATOR_ACCESS_TOKEN`, plus the matching `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Obtain the pending request/evidence IDs through the operator's RLS-protected `manual_payment_requests` and `manual_payment_evidence` read APIs. Run from `apps/ledger-suit`:

```sh
deno run --allow-env=SUPABASE_URL,SUPABASE_ANON_KEY,MANUAL_PAYMENT_OPERATOR_ACCESS_TOKEN --allow-net scripts/review-manual-payment.ts REQUEST_UUID EVIDENCE_UUID inspect
deno run --allow-env=SUPABASE_URL,SUPABASE_ANON_KEY,MANUAL_PAYMENT_OPERATOR_ACCESS_TOKEN --allow-net scripts/review-manual-payment.ts REQUEST_UUID EVIDENCE_UUID under_review 'Checking bank transfer'
deno run --allow-env=SUPABASE_URL,SUPABASE_ANON_KEY,MANUAL_PAYMENT_OPERATOR_ACCESS_TOKEN --allow-net scripts/review-manual-payment.ts REQUEST_UUID EVIDENCE_UUID approved 'Transfer verified against bank record'
# Alternatively use rejected with a customer-readable reason.
```

Inspect outputs include a 60-second receipt URL; do not publish or retain these in shared logs. Approval/rejection reasons appear in customer history. Resolve a subscription conflict through reviewed billing support; do not edit audited requests or remove paid periods to force approval.

## Verification

The optional embedded runner uses isolated `@electric-sql/pglite@0.3.16` in `.local/manual-validation` (outside the workspace dependency graph). Install it locally with `pnpm --dir .local/manual-validation add @electric-sql/pglite@0.3.16 --ignore-workspace` after creating a private package.json there. It applies the entire migration history to an in-memory database. Auth/Storage/cron provider schemas are shims, and assertion functions execute the pgTAP SQL cases without requiring the pgTAP extension. This validates SQL behavior, not live provider APIs or concurrent sessions.

```sh
node apps/ledger-suit/scripts/test-manual-payment-embedded.mjs
# Regenerates the product contract from the migrated PostgreSQL catalog:
node apps/ledger-suit/scripts/test-manual-payment-embedded.mjs --generate-contract
```

For an explicitly disposable local Ledger Supabase instance, apply the migration, run `77_manual_payment_test.sql` and existing `24_plan_aware_paymob_checkout_test.sql` through the normal local SQL suite. Then run:

```sh
node apps/ledger-suit/scripts/test-manual-payment-concurrency.mjs --disposable-local
```

The concurrency runner permits only loopback port 60322, optionally using `MANUAL_PAYMENT_TEST_DATABASE_URL`. It commits synthetic test identities/receipts and leaves them in that disposable database. Two independent psql sessions contend on approval; the runner observes a real database lock wait, then asserts one approval event, one purchased month and unchanged replay. It never resets a database.

Independent backend/browser verification still required: upload/download through real Storage; valid/oversized/spoofed files; cross-tenant reads and upload rejection; refresh and tenant/session switching; reject/re-upload/approve; two-session concurrency; Arabic/RTL and mobile/keyboard dialog behavior; approved entitlements after refresh. Use synthetic receipts only.

Actual local results:

- `pnpm agent:preflight`: failed (exit 255 internally); live GitHub/fetch state remains unverified. No branch/publication decisions were made.
- Workspace dependencies installed offline from the existing cache using a writable temporary pnpm project registry; no manifest/lockfile changes.
- Embedded full migration application and SQL assertions: 40 manual-payment checks and 26 unchanged Paymob checks passed. Contract regenerated from that migrated catalog.
- `deno test --no-config --no-lock --allow-env` on manual-payment, Paymob checkout contract and Paymob security tests: 10 passed. Deno check of the upload endpoint and operator command passed.
- `pnpm --filter @building-suit/ledger-suit typecheck`: passed; expected warnings for missing local Supabase URL/key.
- ESLint run from the Ledger workspace on all changed Vue/TypeScript/scripts and the updated security test: passed. Edge Functions were checked by Deno, as required by the app lint configuration.
- `node --test apps/ledger-suit/tests/unit/*.test.mjs`: all 29 test files passed.
- `pnpm check`, JSON locale validation, concurrency-runner syntax check and `git diff --check`: passed.
- Local Supabase CLI could not create the migration before dependency setup and later failed writing its home-directory telemetry file; the forward migration was authored directly and its full application verified in embedded PostgreSQL. Docker socket access is denied.
- Real Supabase Storage API, browser acceptance and two-session PostgreSQL concurrency tests were not run. The local frontend has no configured backend credentials. No hosted verification or deployment is claimed.

The implementation and runnable verification assets are ready for independent verification. These backend/browser checks remain acceptance limitations, not passing results.
