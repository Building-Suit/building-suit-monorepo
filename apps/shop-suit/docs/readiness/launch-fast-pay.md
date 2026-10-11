# SS-LAUNCH-FAST-PAY-001 — New Sale Fast Pay

Implements SS-LAUNCH-R04/R10 and SS-LAUNCH-D09. New Sale and draft editing expose Fast Pay alongside Save draft and normal issuance. Payment method/reference are available for customer and customerless sales before confirmation. The action reuses shared record dialog, form, button, select and confirmation behavior, with EN/AR copy.

`fast_pay_location_sale` is one authorized database transaction: save/update the location draft, issue using existing authoritative pricing/stock/FIFO rules, receive and allocate the full confirmed amount, and materialize the existing immutable receipt. Any failure rolls back the entire command, including draft changes and request rows. Customerless sales reuse the supported full-payment checkout; customer sales use issuance plus customer receipt allocation. Both routes retain the existing cash-shift and closed-period guards.

Private request rows bind shop, actor and the complete payload, serialize concurrent replay, and store independent server-generated inner command keys. Changed payload/actor replays fail. Completed retries return the same invoice before touching its issued state or requiring its former shift to remain open. The browser preserves its confirmed request key/payload/timestamp on errors, locks editing until retry or cancellation, and navigates directly to `/sales/{id}/receipt`. Refresh failures cannot block that handoff.

## Local verification

- `pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit`: passed on the final UI source (3 successful tasks; 17 existing lint warnings, no lint errors).
- `git diff --check`: passed.
- `pnpm db:test:shop`: executed; failed before tests because Docker socket access is denied.
- From `apps/shop-suit`, `pnpm exec supabase test db --local supabase/tests/ss-launch-fast-pay-001-1.test.sql`: executed; failed before tests because Supabase telemetry writes outside the writable sandbox.
- `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-fast-pay-001-2.config.ts --workers=1 --retries=0`: executed; failed before tests. The fixture server cannot listen on `127.0.0.1:46421` (`EPERM`). Config discovery found 16 cases; discovery is not browser acceptance.
- `pnpm agent:preflight`: executed; fetch/live GitHub state could not be verified.

The task-owned SQL suite covers customer/customerless create/update, every payment method, policy OFF/ON, closed-shift completed replay, insufficient stock, payment-stage rollback, immutable receipt/allocation/FIFO counts, changed-payload replay, independent issue/receive permission denial and outsider denial. Browser coverage includes new/edit actions, confirmation cancellation, pending lock, identical retries after a lost response, receipt handoff, denied actions and cash-shift errors, with EN/AR desktop/mobile light/dark screenshot capture planned. No rendered states or screenshots have been reviewed in this sandbox.

Required database and rendered browser gates remain unverified and block acceptance. The migration has not been applied locally or remotely. CLI migration scaffolding failed on telemetry access, so the forward file was authored in the app-owned migration directory. The app's maintained handwritten RPC contract was extended; no generated database output was edited. No hosted changes, deployments, commits, pushes or merges were performed.
