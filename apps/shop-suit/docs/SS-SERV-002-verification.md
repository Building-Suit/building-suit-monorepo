# SS-SERV-002 verification

Recovery is isolated in `/workspace/service-material-recovery`, branch `codex/shop-suit/service-material-recovery`, draft PR #315, child of tax PR #314. Staging baseline: `4c1ac6cc9652e3fedfc3e9a7368962baeb7c7290`. First durable scope checkpoint: `4de0d3a1`; first implementation checkpoint: `793c90f9`. Inaccessible prior workspaces remain untouched.

## Passing local evidence

- Complete Shop migration replay in a fresh disposable PostgreSQL 17 database (`shop_material_test_6`). Auth, Storage, Cron/network provider infrastructure was explicitly stubbed; this does not verify actual Supabase provider integration.
- `SHOP_MATERIAL_TEST_CONTAINER=shop_material_disposable SHOP_MATERIAL_TEST_DATABASE=shop_material_test_6 node tooling/database/test-shop-service-materials-local.mjs`: optional no-recipe, cumulative/excess quantity, same-key replay/conflicts, compatible units, FIFO 20 + 10, shortage rollback, recipe history, manager actual usage, unsupported precision rejection, unpaid completion, full payment plus fulfillment, multi-unit walk-ins, immutable pre-tax commission basis, appointment-before-sale linking/duplicate guard, refund without stock restoration, audited correction replay/limits, offline cancellation blocking late replay, cross-location/tenant and direct-table denials. All synthetic fixture changes roll back.
- `SHOP_MATERIAL_TEST_DATABASE=shop_material_test_6 node tooling/database/test-shop-service-material-concurrency.mjs`: two PostgreSQL sessions request 30 against 40; exactly one succeeds, one rejects atomically, 10 remains, replay returns the original fulfillment. Synthetic append-only concurrency fixtures are retained locally.
- Original `shop_commissions.sql`, `shop_commission_corrections_locations.sql`, `shop_tax_calculation.sql`, `shop_tax_issuance.sql` and `shop_appointments.sql` passed against that same local database. The correction suite now asserts that a corrected sale rejects late new fulfillment while retaining its no-new-earning assertion.
- 322 Shop unit tests passed.
- Six bilingual browser tests passed using `PLAYWRIGHT_BROWSERS_PATH=/tmp/material-playwright node_modules/.bin/playwright test -c packages/testing/playwright.shared-regressions.config.ts service-materials.spec.ts`: EN desktop/AR mobile recipe configuration, queued walk-in completion, visible material shortage retained across reload, and retry with the identical request payload. Browser tests use synthetic transport, complementary to the SQL fixtures.
- Shop typecheck, production build, focused app/shared/tooling lint, workspace boundaries, strict Suit UI boundaries and atomic template registry passed.
- Public database types regenerated with the pinned Supabase CLI against that disposable local database; output is unchanged outside the new service-material tables and RPCs (493 generated lines added). Final newline normalized.
- Tax parent incorporated through `0ab1aac7d5689c9cdc7ba5b0b2f54675012aacf2`; its updated calculation and existing tax/commission/appointment suites passed again in the fresh combined database.

The browser suite caught and verified the fix for a forbidden cache key. The supported vault now allowlists one bounded service-line cache (IDs/names/quantities only), including its scope-clear path. Audit history and reasons are not cached. Completed historical appointments cannot be newly consumed through the public RPC; only the private current-transition hook can enter the completed-status path.

## Real provider CI

The corrected [materials job](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/38669327045/job/116208445927) passed on `3abac458`: real disposable Supabase migration startup, materials SQL suite, two-session stock concurrency and original commission regressions. The first attempt exposed an incorrect workflow runner filename, which was fixed in that checkpoint. Branch policy, review, commission, media and payment CI also passed. A later tax job passed its database tests but failed its public-type generation image pull with `toomanyrequests: Data limit exceeded`; this is a provider limitation, not a SQL failure. Parent must obtain green combined checks before merge.

Client query-cache keys include product/project URL, authenticated user, tenant, location, sale and page. Session changes clear editor/pending state; offline scope remains bound to the captured authenticated user.

## Limits and required integration gates

Actual Supabase image extraction exceeded available Docker disk capacity. No existing data, images or workspaces were deleted. The dedicated `.github/workflows/shop-service-materials-disposable.yml` runs against real disposable Supabase and includes the original commission regression suite. Its result and the staging candidate's required checks must pass before merge; local provider stubs do not replace them.

The broad repository unit run reported 1,457 passing, 23 skipped and two unrelated control-plane browser failures because Playwright binaries were absent. The task-specific browser installation uses `/tmp/material-playwright`, without changing the home workspace.

Current stored stock quantities are two decimal places. The exact requested 29.999-on-hand case cannot be represented by that schema. We preserve existing precision: 29.999 material input is explicitly rejected, and the near-boundary stock case uses 29.99, which rejects 30 with no completion/stock effects. No migration silently rounds, converts units or backfills quantities. See [service policy](service-materials.md).

No hosted database writes or deployments, credential changes, main promotion, staging merge or manual acceptance testing were performed. Parent owns combined staging merge; user tests afterward.
