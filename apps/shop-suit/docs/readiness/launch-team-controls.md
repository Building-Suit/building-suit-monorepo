# SS-LAUNCH-TEAM-001 — local implementation and verification handoff

Status: implementation present; acceptance blocked by the missing shared access-management dependency and sandbox verification restrictions. No commit, push, merge, deployment or hosted database operation was performed.

## Behavior

`/team` composes shared `BsTabs`, `BsDataTable`, `BsRecordActionDialog`, confirmation and toast controls into Members, Roles & permissions and Invitations views. Members have name/email/job-title search, status filters, custom/system roles and assigned locations. The role view includes a read-only owner row, editable system capability sets and bilingual custom-role creation/edit/archive. Assigned roles and roles reserved by live invitations cannot be archived.

A forward migration adds membership-specific full name/job title, invitation job title, Arabic role names and role archival. Member detail/role/location edits use one authorized transaction. Role changes validate both the Shop portal catalog and the actor's current capabilities, retain owner invariants and record immutable audit events. Existing resource-limit triggers still count active members plus live pending invitations. Invitation creation and acceptance share the member-seat lock and recheck racing retries.

Both existing and new identities now receive an email-bound invitation and explicitly accept; existing users are no longer enrolled without consent. The legacy six-argument invitation RPC remains compatible but returns an invitation instead of immediately adding an existing identity. Existing SQL fixture callers are updated to accept. `/auth/team-invitation` allows invitees to create/verify their own account/password or sign in with an existing account; it never provisions a shop. Login and older unsigned `/team?invite=…` links preserve the invitation destination. An invitee can switch accounts. No owner form accepts another person's password.

Invitation delivery remains a manually shared link: SMTP was not configured or verified by this task.

## Missing dependency

The task record declares BS-LAUNCH-ACCESS-UI-001 complete, but this checkout at parent `7d248ff` contains no dedicated shared access-management presentation or exports. Changes remain within `apps/shop-suit/`; they use the existing shared primitives. Dedicated shared presentation parity cannot be accepted until that dependency is supplied. No Ledger app internals were imported or copied.

## Verification commands

Run against the disposable local Shop instance after the migration is applied:

```sh
pnpm db:test:shop
node apps/shop-suit/tests/run-team-concurrency.mjs
pnpm test
pnpm check
pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit
pnpm exec playwright test -c apps/shop-suit/playwright.team.config.ts --workers=1 --retries=0
git diff --check
```

The SQL suite covers existing/new-user acceptance, bilingual custom role CRUD and assignment, system-role permission edits, escalation denial, failed member-edit rollback, duplicate invitation/retry/revocation, suspension, tenant isolation, auditing and owner continuity. The additional fixed-container runner covers actual concurrent duplicate invitation creation, request retries, acceptance and replay. The full database runner retains its six-resource quota races. Browser specs provide EN/AR desktop/mobile light/dark screenshot capture, member search, custom-role creation, invitation details, readonly/denied/empty states and existing-account acceptance. Browser mocks establish presentation and request behavior only; they do not prove database authorization.

Executed evidence in this sandbox:

- Shop typecheck/lint/build passed; workspace boundaries/token checks passed; `git diff --check` passed.
- Full `pnpm test` failed in `batch-ssh-transport.test.mjs` and `dev-worktrees.test.mjs`; 75 other test files passed. Focused execution exposed sandbox `spawnSync` EPERM failures.
- `pnpm db:test:shop` and the concurrency runner failed on Docker socket permission denial. No SQL suite or new migration executed. Generated database inspection remains unverified; Shop uses maintained RPC response contracts in `app/types`.
- The task Playwright command was executed with one worker and retries disabled, but could not start the server. A direct server run exposed `listen EPERM` on `127.0.0.1:4421`. No rendered state or screenshot was reviewed.
- `pnpm agent:preflight` failed to verify fetch/GitHub state. Supabase migration scaffolding also failed because CLI telemetry attempted a write outside the sandbox; the forward migration was authored in the owning migration directory.

Require successful full Shop database regression and rendered browser review before marking this task complete.
