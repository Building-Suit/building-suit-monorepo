# SS-APPT-EMAIL-001 — opt-in appointment email reminders

Separate Shop task branch `codex/shop-suit/appointment-email-reminders`, committed parent `origin/stg` at `1d0108f85fb8d468f8ad6380c9c6bf60a435ca4d` (merged PR343). Before editing, live GitHub/remote/worktree checks found no existing reminder PR, reminder branch or reminder worktree. The old `ss-launch-auth-email-001` branch concerns account/auth email and is preserved. Existing website stack PRs remain preserved; their exact heads are already ancestors of this staging parent. The separate shared changelog task is untouched except the required new release-inventory item and private task fragments.

Read root/Shop/Supabase/UI agent rules, root README, ongoing Git/database/UI workflow references, official frontend-design skill and Supabase/email reliability/template skills. The frontend keeps registered complete page templates and existing tokens; app code supplies business/auth/data/typed props only. A pure typed email renderer belongs to `packages/ui`; no new interaction controller was necessary because existing record-action/session/overlay controllers cover the interactions.

## Result

- New forward migration, generated schema contracts, explicit owner policy opt-in, separate phone-verified customer consent for each saved-email appointment, no guest enrollment or public contact projection.
- Private tenant-bound consent/audit/outbox records; fenced two-minute leases, eligibility recheck at prepare, exact frozen payload and deterministic provider key, five-attempt/23-hour retry bounds, conservative atomic global/day/month/tenant/rate budgets.
- Cancellation, rescheduling, contact change, reassignment, unpublish and policy disable prevent later authorization. A cancelled possible send cannot restart; only a zero-attempt, unfrozen intent can be requested again before due time. A late acceptance receipt can be retained without reviving a cancelled queue.
- Private AR/EN email includes Shop name and appointment instant in the schedule IANA timezone, without notes/customer identity/codes/links/tracking assets. Scope verification does not independently verify an email inbox.
- New Edge entry point passes Deno checking; default platform JWT verification stays enabled, plus a dedicated worker token. Only explicit test mode and exact allowlisted recipients can send. No live mode, installed scheduler, provider/credential/settings change or actual outbound email.
- [Activation and scheduling handoff](../../apps/shop-suit/docs/appointment-email-reminders.md) names every key and destination, budgets, free-account shared-usage review, dormant `pg_cron`/`pg_net`/Vault scheduling design and cancellation/in-flight limits. Approval/configuration and separately reviewed CI-only scheduling activation remain external prerequisites, not actions performed here.

## Local evidence

On 2026-10-16, disposable local PostgreSQL only (no hosted database):

- Full root unit suite: 1,603 passed, 23 skipped, zero failures, using pinned Chromium. Six new mocked-provider/privacy/configuration/DST/retry tests included.
- Reminder SQL runner passes transactional authorization/privacy/consent/allowlist/lease/retry/receipt/tenant-budget checks and actual competing SQL transactions: worker/worker, cancellation, reschedule, email change and cross-tenant final global allowance. No provider calls. Full Supabase replay belongs to the dedicated GitHub-hosted job; local thin disposable PostgreSQL is not represented as a full provider-stack replay.
- Five built HTTP suites pass, including reminder host/cookie/same-origin validation, strict payload rejection, customer-only consent and cross-tenant denial.
- Public booking browser suite: 17 passed across EN/AR, responsive widths and themes, including consent/withdrawal. Owner settings browser suite: 3 passed, including explicit opt-in and ordinary-staff denial.
- Shop typecheck/build pass. Shop lint has zero errors and two pre-existing owner-invitation attribute-order warnings. Shared changed-file lint and strict workspace/token/template checks pass.
- Generated types come from CLI introspection of the disposable migration, normalized only with the maintained schema-contract evidence tool. Deno 2.9.7 checks the actual worker entry point. Supabase security advisor reports no issues at error level.

A first reminder browser attempt exposed a missing explicit host-route registration; registration was fixed and the full suite passes. Early SQL iterations found ambiguous PL/pgSQL names and were corrected before final migration replay. Tests never weaken authorization/readiness/provider bounds to pass.

Draft PR/exact-head checks are reported in the final handoff. Parent owns integration; no `stg`/`main` merge or manual deploy occurs here.
