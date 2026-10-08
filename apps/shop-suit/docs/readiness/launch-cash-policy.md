# SS-LAUNCH-CASH-POLICY-001 — cashier shift sale policy

Implements SS-LAUNCH-R04 and approved decision SS-LAUNCH-D02. Business settings exposes an opt-in requirement, defaulting to OFF for existing and new Shops. Active owners and delegated `settings.manage` members can change it through `set_shop_cash_policy`; `shop_cash_policy` allows active members to read it. Changes record the previous/new value, actor profile and timestamp in immutable, tenant-scoped `shop_cash_policy_changes`. Identical retries do not add audit entries.

The current POS/Cashier shifts flow uses the `main` register. When enabled, issuance and completed inbound customer payments require an open main shift at the authoritative sale/payment location. Invoice and payment triggers cover POS, Sales issue, customerless issue-and-take-payment, and legacy/location receipt RPCs. A shift in another location does not qualify. Checks lock the policy and shift until commit, so a concurrent policy update or shift closure cannot invalidate an accepted write. Any failure rolls back the atomic command. Saving/editing drafts and replaying completed idempotent commands remain available. Refund/reversal rules and exactly-once cash drawer capture are preserved; non-cash payments never create drawer cash events.

POS and Sales translate `SALE_OPEN_CASH_SHIFT_REQUIRED` into EN/AR guidance to open Cashier shifts for the selected location and retry. This checkout currently uses the existing POS and customerless issue-and-take-payment commands; there is no separate Fast Pay RPC in this checkout.

## Verification

- `pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit`: passed (17 lint warnings).
- `git diff --check`: passed.
- `pnpm db:test:shop`: executed, failed before tests because Docker socket access was denied.
- From `apps/shop-suit`, `pnpm exec supabase test db --local supabase/tests/ss-launch-cash-policy-001-1.test.sql`: executed with telemetry disabled, failed to connect to local Shop Postgres at `127.0.0.1:61322`.
- `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-cash-policy-001-2.config.ts --workers=1 --retries=0`: executed, failed before tests because sandbox localhost access was denied (`EPERM`) and the web server exited.
- Playwright `--list` loads the task config and discovers 14 cases. This is discovery evidence, not browser validation.
- `pnpm agent:preflight`: failed; fetch/live GitHub state is unverified. No branch/base/publication action was taken.

The SQL matrix covers eight authoritative command paths with policy OFF/ON, cash/card, missing/wrong-location/open/closed shifts, draft edits, request retries, refund drawer totals, direct-write denial, outsider/cashier/suspended-manager denial, delegated-manager success and immutable audit evidence. Browser cases cover settings ON/OFF and refresh, error/readonly states, keyboard use, EN/AR desktop/mobile light/dark screenshots, POS rejection/shift opening/retry, Sales draft saving and issuance/payment errors. These scenarios remain unverified until executable runs succeed. No rendered states or screenshots were reviewed in this sandbox.

No hosted database changes, deployments, commits, pushes or merges were performed. Required DB and browser gates remain blockers to acceptance.
