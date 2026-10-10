# SS-LAUNCH-LEGAL-AUDIT-001 — policy reconciliation

Requirement SS-LAUNCH-R13; decision SS-LAUNCH-D08. Reviewed the committed launch
implementation at parent `fcdd98788ad70061d4cc720f3d94f73b841f15f3` on 10 October
2026. Only Terms and Privacy claims incomplete after launch work were amended,
in English and Arabic. Their revision dates changed together. Delivery & Shipping
and Refund & Cancellation retain their wording and original dates.

Evidence below describes repository implementation, not deployment or provider
configuration. Paths are relative to `apps/shop-suit/` unless stated otherwise.

| Policy / material claim | Implementation evidence | Disposition / limit |
| --- | --- | --- |
| Terms §1, §4: plan-dependent features; Solo 1/2 members, Team 8, Multi 16/25 for 2/3 branches | `supabase/migrations/20261009170000_solo_member_variants.sql`; `20260930210000_commercial_plan_catalog_v2.sql`; `app/components/ShopPlanCards.vue`; `app/pages/billing.vue` | Add current families/member limits; price and resource limits remain governed by selected terms, avoiding a duplicate price schedule. |
| Terms §4: owner counts; pending invitations reserve seats; historical terms preserved; over-limit plan changes do not delete records | `supabase/migrations/20260928213000_team_roles_invitations_suspension.sql`; `20260930210100_catalog_v2_dynamic_plan_terms.sql`; `20261009170000_solo_member_variants.sql`; `20261009180000_preserve_operator_renewal_terms.sql` | Add seat accounting and preservation boundary. |
| Terms §2: separate member accounts, invitation acceptance, permission/location authority, delegation cannot exceed actor permissions | `app/pages/auth/team-invitation.vue`; `supabase/migrations/20261007010000_launch_team_controls.sql` (`assert_assignable_team_role`, `save_shop_team_role`, permission checks); `app/pages/team.vue` | Add authority detail. Do not promise automatic invitation email; current invitation delivery is a shared link. |
| Terms §2: intended one-device/session account rule; newest sign-in at refresh where enabled; no immediate revocation; current-session logout | `app/plugins/session-loss.client.ts`; `app/layouts/default.vue`; `app/layouts/platform-admin.vue`; `app/pages/auth/team-invitation.vue`; `docs/single-session.md` | Add conditional wording. Hosted enforcement is explicitly not verified as enabled. Provider eligibility/configuration and real-provider two-device evidence remain a launch gate. |
| Terms §3, §8: responsibility for lawful, accurate business records, decisions and credentials | Product inputs/RPCs in `app/pages/pos.vue`, `app/pages/team.vue`, `app/pages/billing.vue` cannot establish truth or legal authority of submitted business data | Retain responsibility wording; no new legal advice or accounting guarantee. |
| Terms §4; Privacy §3; Delivery activation; Refund manual review: owner notice, external verification, operator approval | `app/pages/billing.vue`; `supabase/migrations/20260928200000_manual_instapay_billing.sql` (`submit_shop_billing_notice`, operator review); `20260929210001_plan_aware_billing_renewals.sql` | Retain manual payment boundary. Submission is not payment verification or activation. |
| Terms §4; Delivery: eligible signup trial | `supabase/migrations/20260930180000_seven_day_shop_trials.sql`; `20260930120000_plan_neutral_trial_onboarding.sql`; signup copy in `i18n/locales/` | Retain reference to trial displayed during signup, preserving existing deadlines rather than imposing a retroactive duration. |
| Terms §7: restricted new operations after expiry; authorized history retained | `supabase/migrations/20260929220000_platform_plan_catalog_subscription_controls.sql`; `20260930210100_catalog_v2_dynamic_plan_terms.sql`; `app/pages/billing.vue` | Retain access/record boundary; no automatic deletion promise. |
| Privacy §1, §4: support fields, consent, account context, queued payload, provider ID/status | `app/pages/contact.vue`; `supabase/migrations/20260930200000_public_support_requests.sql`; `20261008160000_support_notification_delivery.sql`; `supabase/functions/_shared/support-notifications.mjs` | Add Resend disclosure: reply email, subject, message, category, priority, request reference go to support; stored payload and status enable tracking/retries. Recorded request does not guarantee delivery or response time. Worker configuration/deployment/delivery are not established by this review. |
| Privacy §2: session context and scoped realtime refresh | `app/composables/useShopRealtime.ts`; `app/utils/shopRealtime.ts`; `supabase/migrations/20261010110000_shop_scoped_realtime.sql`; shared `packages/data-access/src/realtime.ts` | Add session/account/workspace scope and local cleanup. Signals refresh authorized data; do not promise instantaneous updates, cross-product sessions or absolute security. |
| Privacy §5–§9: security, retention, rights requests, children, changes, contact | Existing bounded policy wording and support contact | Retain; no new retention duration, deletion automation, service-level or security guarantee. These are policy statements, not assertions that a local test proves legal compliance. |
| Delivery: digital SaaS, no physical goods/shipping fee; activation may be delayed | Hosted web-app delivery; manual billing review above; no fulfillment integration | Retain all clauses; no activation deadline. |
| Refund: cancellation/refund via support, operator eligibility review, available refund method, no automated refund or fixed timing | `app/pages/contact.vue`; manual billing review above; no self-service refund/payment-cancellation integration | Retain all clauses. Operator handling is an existing policy process, not an executable automated workflow; actual refund execution/timing cannot be established locally. |
| All policies: EN/AR routes, titles/descriptions, footer links; relevant billing acknowledgement | `app/pages/{terms,privacy,delivery-shipping,refund-cancellation}.vue`; `app/components/PublicLegalPage.vue`; `app/layouts/landing.vue`; `app/pages/contact.vue`; `app/pages/billing.vue` | Existing links retained. Contact/legal/landing footer includes all policies; billing acknowledgement links Terms, Privacy and Refund. Task browser spec runs the existing full public-legal suite plus bilingual updated-claim/footer assertions. |

## Verification

No hosted database/provider changes,
commits, pushes, merges or deployments are part of this task. No schema, migration,
database tests or database runner were changed; database write tests are not needed
for these content/test changes.

Executed locally on 10 October 2026:

- PASS: `node --test apps/shop-suit/tests/unit/ss-launch-legal-audit-001-1.test.mjs`.
  Direct execution of the same file also passed its nine checks, including the
  existing public/legal unit regression. It evaluates the typed legal content
  and compares bilingual structure and launch disclosures against Shop evidence.
- PASS: `pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit`.
  All three tasks succeeded. Lint reported 17 existing attribute-order warnings;
  build reported absent local Supabase credentials and shared-cache filesystem
  warnings, without changing its successful result.
- FAIL: full Shop regression `node --test apps/shop-suit/tests/unit/*.test.mjs`,
  rerun after build: 41 files passed, 2 failed. `plan-ui.test.mjs` expects the
  unchanged billing source to contain `p_requested_catalog_terms_id: plan.catalogTermsId`,
  while it uses `selectedPlan.value!.catalogTermsId`. `pos-customer-ssr.test.mjs`
  renders `<!---->` rather than its expected disabled customer field in both
  fixtures. Direct execution reproduced both failures. These tests and their
  product sources were not modified by this audit. The initial concurrent
  pre-build run also failed the brand artifact test; after build that test passed.
- FAIL / browser assertions UNVERIFIED:
  `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-legal-audit-001-1.config.ts --workers=1 --retries=0`.
  The configured server exited before tests. Direct execution of that server with
  the same local environment revealed `listen EPERM` on `127.0.0.1:4421`.
  The exact command with `--list` succeeded and discovered eight tests, including
  the full existing public/legal suite. Discovery does not prove route/link/meta,
  billing or contact browser behavior. Independent verification requires local
  socket permission and rerunning the exact command against the completed build.
- PASS: `git diff --check`.
- FAIL: `pnpm agent:preflight` could not verify GitHub/fetch state. Branch/base
  freshness is unverified; no publication or reconciliation was attempted.

Implementation and task-owned outputs are ready for independent verification.
Acceptance is not fully verified while the required browser run is blocked.
The two unrelated full-regression failures remain recorded, and the existing
single-session provider eligibility/configuration and real-provider evidence
launch gate remains open. No local PASS replaces that external evidence.

## Recorded-failure repair — 10 October 2026

The independent verification summary identifies an anonymous-rendering defect in
`app/app.vue`: its `canRenderPage` guard permits only `/`, `/auth/*` and signed-in
users. The six existing public About, Contact and policy routes are therefore
blank for anonymous visitors. A focused regression was added to
`tests/unit/signup-session-transition.test.mjs`, retaining its signup/provisioning,
context-change and protected-page session-loss assertions. Direct execution
reproduces the defect at `/about` (`5 !== 6` page mounts).

The logo assertions in `tests/e2e/public-legal.spec.ts` now select the visible
canonical logo rather than the hidden desktop-width mobile slot. The expected
asset also respects the desktop auth showcase's explicit light logo tone in both
themes. Visibility, exact asset and absence-of-fallback assertions remain required.

The route-guard fix is pending permission to include `app/app.vue`, which is absent
from the persisted task's allowed paths. The proposed change adds only `/about`,
`/contact`, `/terms`, `/privacy`, `/delivery-shipping` and `/refund-cancellation`
to the existing anonymous render allowlist. Operational route suppression and
account/tenant remount behavior must remain intact.

Repair validation:

- PASS: `node apps/shop-suit/tests/unit/ss-launch-legal-audit-001-1.test.mjs`
  (nine checks).
- PASS: `pnpm --filter @building-suit/shop-suit lint` (17 existing warnings,
  zero errors) and `git diff --check`.
- FAIL: `node --test apps/shop-suit/tests/unit/signup-session-transition.test.mjs`;
  direct execution identifies the anonymous `/about` render assertion above.
- FAIL before test execution, on both exact reruns:
  `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-legal-audit-001-1.config.ts --workers=1 --retries=0`.
  The configured server exits early. Running that same server directly with the
  config's local-only environment reports `listen EPERM` on `127.0.0.1:4421`.
  A runtime permitting that local socket is required; no check was skipped or
  weakened to bypass it.
- FAIL: `pnpm agent:preflight`; GitHub/fetch state remains unverified.

Repair remains incomplete pending the narrow route-guard scope addition and a
successful exact browser-suite run. Independent acceptance belongs to the control
plane. No commit, push, merge, deployment or hosted database change was performed.

### Retry-3 repair investigation

Read the retry-3 failure summary and current source. The anonymous render guard
remains the cause; the visible-logo locator correction is already present and
was preserved. Requested explicit permission to include `app/app.vue`, which
remains outside the persisted allowed paths. No product change was made while
that permission was pending.

- `pnpm agent:preflight`: FAIL; GitHub/fetch state could not be verified.
- `node --test apps/shop-suit/tests/unit/ss-launch-legal-audit-001-1.test.mjs`:
  PASS.
- `node --test apps/shop-suit/tests/unit/signup-session-transition.test.mjs`:
  FAIL. Direct execution shows the existing `/about` anonymous-render assertion
  fails with five page mounts instead of six.
- Exact required browser rerun:
  `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-legal-audit-001-1.config.ts --workers=1 --retries=0`:
  FAIL before test execution (`Process from config.webServer exited early`).
  Starting the configured built server with the same local-only environment
  reports `listen EPERM: operation not permitted 127.0.0.1:4421`.
- `git diff --check`: PASS.

The required browser command and existing regression assertions remain intact.
Repair is incomplete until the minimal root render-guard change is authorized
and the exact browser command passes in a runtime permitting its local server.
Independent final verification remains with the control plane.

### Retry-4 repair investigation

The retry-4 failure summary and current source still identify the same anonymous
rendering defect. Existing policy work, the visible-logo correction and the
anonymous-route regression were preserved. The minimal proposed product change
in `app/app.vue` is to replace the render condition with:

```ts
const publicPaths = ['/', '/about', '/contact', '/terms', '/privacy', '/delivery-shipping', '/refund-cancellation']
const canRenderPage = computed(() => !!user.value || route.path.startsWith('/auth/') || publicPaths.includes(route.path))
```

This retains protected-page suppression and the existing signup/context keys.
It has not been applied: `app/app.vue` is outside the task's listed allowed paths,
and explicit permission for that narrow addition was requested in this repair.

Local results on 10 October 2026:

- Exact required command
  `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-legal-audit-001-1.config.ts --workers=1 --retries=0`:
  FAIL, exit 1, before tests (`Process from config.webServer exited early`).
  Direct startup with the config's local environment reports
  `listen EPERM: operation not permitted 127.0.0.1:4421`.
- `node --test apps/shop-suit/tests/unit/signup-session-transition.test.mjs`:
  FAIL, exit 1. Direct diagnostic execution reports
  `anonymous visitors must render /about`, with five mounts instead of six.
- `pnpm agent:preflight`: FAIL; GitHub/fetch state remains unverified.

Repair remains incomplete. It requires the narrow source-path authorization and
a runtime permitting the required local browser server. No required assertion or
verifier command was weakened. Independent final verification remains with the
control plane; no commit, push, merge, deployment or hosted database change occurred.

### Retry-5 authorized repair

The supplied verification-384 review explicitly authorizes the isolated
`app/app.vue` allowlist repair, superseding the earlier pending-path permission
noted above. Applied the proposed `publicPaths` condition exactly: anonymous
visitors can render About, Contact and all four policy routes. Signup keys,
account/tenant remounts and protected-page suppression remain intact. Existing
policy content, tests and the visible-logo correction were preserved.

Local results on 10 October 2026:

- PASS: `node --test apps/shop-suit/tests/unit/signup-session-transition.test.mjs apps/shop-suit/tests/unit/ss-launch-legal-audit-001-1.test.mjs`
  (both files passed, zero skips). This includes anonymous public rendering,
  protected-page removal, signup continuity and policy evidence assertions.
- PASS: `pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit`
  (three successful tasks, none cached). Lint retains 17 existing warnings;
  missing local Supabase credentials and shared-cache filesystem warnings did
  not fail the command.
- FAIL before tests, exit 1: the exact required command
  `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-legal-audit-001-1.config.ts --workers=1 --retries=0`
  reports `Process from config.webServer exited early`. Direct startup of the
  rebuilt server with the configured local environment reports
  `listen EPERM: operation not permitted 127.0.0.1:4421`.
- PASS: `git diff --check`.
- FAIL: `pnpm agent:preflight`. Fetch cannot write the read-only `FETCH_HEAD`,
  GitHub API access is unavailable, and this branch has no configured upstream.

The source repair is applied, but repair verification remains incomplete: the
required browser command needs a runtime permitting its local server socket.
No required check or assertion was skipped or weakened. Independent final
verification remains with the control plane. No commit, push, merge, deployment
or hosted database change occurred.
