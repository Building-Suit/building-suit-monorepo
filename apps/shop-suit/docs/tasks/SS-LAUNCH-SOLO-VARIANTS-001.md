# SS-LAUNCH-SOLO-VARIANTS-001

Implements SS-LAUNCH-R07 and approved SS-LAUNCH-D05 in Shop only.

Solo remains one of three public families. New selections offer Solo 1 member
at EGP 349/month or EGP 2,847.84/year, and Solo 2 members at EGP 499/month or
EGP 4,071.84/year. Each includes one location, 250 products, 50 services,
500 customers and 50 suppliers. Member capacity includes the owner and live
pending invitations.

The forward migration appends generation-three Solo terms. Generation-two
Solo terms and all pinned subscriptions, billing notices and commercial periods
remain intact. The existing current-offer resolver excludes superseded generations;
legacy selections default deterministically to Solo 1 monthly. Mutable family
metadata follows the Solo 1 headline; exact-term offers govern entitlement.
No table shape or RPC signature changes require regenerated database types.

The Shop adapter supplies translated Solo options to the existing shared pricing
radio group and keeps the selected term synchronized across billing intervals.
Prices continue to come from server quotes. InstaPay submission and operator
approval remain the activation path.

Verification commands:

- `pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit`
- `node --test apps/shop-suit/tests/unit/plan-catalog.test.mjs apps/shop-suit/tests/unit/plan-ui.test.mjs`
- `pnpm db:test:shop`
- From `apps/shop-suit`: `pnpm exec supabase test db --local supabase/tests/ss-launch-solo-variants-001-1.test.sql`
- `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-solo-variants-001-2.config.ts --workers=1 --retries=0`
- `git diff --check`

The SQL suite checks exact appended terms, historical preservation, rejection of
superseded terms, Solo 1 quota enforcement, operator-approved Solo 2 selection,
invitation reservations, acceptance and downgrade blockers. Existing catalog and
quota regressions now expect the Solo 1 default. Browser tests cover English and
Arabic, desktop/mobile, system light/dark, keyboard radio selection, accessible
names, exact yearly pricing, and manual billing submission; screenshots are
written to the Playwright output directory when execution succeeds.

This sandbox passed Shop quality and focused unit checks. Database verification
is blocked by Docker socket access and the CLI's attempt to write telemetry
outside writable paths. Browser execution is blocked by localhost connection
permission (`EPERM`). Rendered screenshots and visual acceptance are unverified.
Repository preflight also failed to verify fetch/GitHub state. Required database
and browser gates must pass in an environment with those local capabilities
before this task is accepted. No commit, push, merge or deployment was performed.

Retry-2 repair adds a forward migration for operator renewal. It resolves the
subscription's pinned catalog term before checking quotas and extending its
period, preserving Solo 2 capacity and historical pricing/intervals. The existing
lifecycle fixture still retains two active members; added assertions require
unchanged commercial snapshots and exactly one monthly extension on reactivation.
The CLI migration generator was attempted but failed on its telemetry write, so
the forward file was created locally. Both required database commands were
attempted again and remain blocked by Docker socket access and CLI telemetry
permissions. Database execution and control-plane final verification remain pending.
