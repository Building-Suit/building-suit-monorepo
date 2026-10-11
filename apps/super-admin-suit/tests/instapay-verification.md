# SAS-M1-INSTAPAY-001 verification handoff

Status: Super Admin implementation present; end-to-end acceptance blocked.
All edits are inside this task's Super Admin workstream. No commit, push, merge,
deployment, hosted database operation or Shop internal change was performed.
Base: `9ae77b10af7d27754e2ab321c01ed416a7ee2d46`; branch:
`codex/super-admin-suit/sas-m1-instapay-001`.

## Scope

Changed the existing index page and registry parser, added product-owned
manual-transfer validation/orchestration, and added English/Arabic UI copy.
The settings archetype composes existing shared fields, form, select, record
modal, state surfaces and record-action/dirty-state policy. No new visual
component or shared package was introduced. The page retains the existing
shell and adds a constrained working form with no decorative dashboard cards.

The forward migration extends the authorized registry projection and checks
signed manual-transfer response evidence before recording immutable audit.
It seeds no business configuration, target binding or navigation rows.
All four required task-owned test outputs and the browser config exist at their
registered paths. See the app README for the explicit target wire contract.

## Executed checks

- `pnpm agent:preflight`: failed, exit 1; fetch/GitHub state not verified.
- `node --test apps/super-admin-suit/tests/unit/sas-m1-instapay-001-1.test.mjs`: passed.
- `node --test apps/super-admin-suit/tests/unit/sas-m1-instapay-001-4.test.mjs`: passed.
- `node --test apps/super-admin-suit/tests/unit/*.test.mjs`: passed, all seven test files.
- `pnpm check`: passed; tokens and dynamically discovered workspace boundaries.
- `git diff --check`: passed.
- `pnpm exec supabase test db --local supabase/tests/sas-m1-instapay-001-2.test.sql`
  from `apps/super-admin-suit`: failed before SQL execution, exit 1. CLI tried
  to write `/home/tareq/.supabase/telemetry.json.tmp.*` on a read-only filesystem.
- `pnpm exec playwright test --config apps/super-admin-suit/tests/e2e/sas-m1-instapay-001-3.config.ts --workers=1 --retries=0`:
  failed, exit 1; configured web server exited early. Direct execution of the
  same production server confirmed `listen EPERM` at `127.0.0.1:4324`.
  No browser scenarios or screenshots ran. Rendered review is NOT VERIFIED.

The production quality command was run repeatedly while implementing. A later
run found excessive TypeScript inference depth in the new confirmation helper;
explicit fetch result typing repaired it. Final execution status is recorded
below after rerunning the entire required command.

## Remaining gates

The inherited published Shop bridge contract does not declare the manual-transfer
resource/action. Real target persistence, target audit and Shop runtime reading
must be confirmed against a target-owned implementation of the documented
contract. Fixture tests cannot establish those behaviors. This task's app-only
scope prevents adding a competing Shop storage or billing implementation.

Apply the forward migration and execute the registered SQL test (plus the full
local Admin SQL regression suite) on an explicitly disposable local backend.
The SQL test signs synthetic responses to exercise actual verification/audit,
outsider denial, lost outcomes, exact enqueue retries, and audit immutability.
It has not executed in this sandbox; no database PASS is asserted.

Run the registered browser command after the quality build in an environment
that permits a local listener. It covers English/Arabic, LTR/RTL, narrow desktop
light/mobile dark, configured preview/edit, exact retry, empty, disabled,
incomplete, error recovery and denial. Inspect its `/tmp/sas-instapay-*` images
for the mandatory rendered review; their expected paths are not screenshot
evidence until the suite runs. No real cross-project/browser flow is claimed
from endpoint fixtures.

Final quality execution:
`pnpm exec turbo run typecheck lint build --filter=@building-suit/super-admin-suit`
passed, exit 0 (3 successful tasks). The final full app unit suite and
`git diff --check` also passed after source review.
