# SS-WEB-LAUNCH-001 qualification

Status: **WEBSITE STACK NOT DEPLOYED; combined integration candidate pending parent merge.** Changelog readiness is cleared by the parent-confirmed public EN/AR verification of staging `c6774d47907f7b09aa0a0e9aa2c45c5687a71c50` (PR340). Website wildcard/provider smoke remains unverified. This qualification does not authorize real customer publication or environment promotion.

Candidate: PR325 is the single combined Shop integration root targeting `stg`. It contains reviewed PR341 (`a12f43d5445926959a8f6263c4adb74b7e87aba2`) and the full website stack, plus current reviewed staging `c6774d47907f7b09aa0a0e9aa2c45c5687a71c50` (PR340), incorporated with merge commits. All source heads and branch histories are preserved. Parent owns the final single merge into staging; no staging/main merge, provider change, hosted write, direct deployment or branch deletion is performed by this task.

## Acceptance matrix

| Requirement | Code evidence | Qualification boundary |
| --- | --- | --- |
| Two-tenant host, slug, content, inquiries and portal isolation | Combined built HTTP test uses Alpha/Beta with distinct capabilities, hostile forwarded host, forged body scope and cross-tenant cookies/codes; all seven SQL suites exercise actual database authority | Synthetic loopback HTTP plus disposable SQL; actual ingress unverified |
| Slug collisions, aliases, reserved hosts and takeover | Slug SQL suite includes two concurrent claims and permanent ownership; combined HTTP verifies reserved/unknown denial and canonical alias redirect | DNS/TLS configuration unverified |
| Data minimization | Public projection SQL plus combined SSR/API deny markers for costs, FIFO, suppliers, notes, financial/customer/staff private identifiers; public adapters never forward product auth/cookies | No real customer records queried |
| Access brute force, limits, expiry, rotation, revocation and enumeration | Appointment-access SQL and HTTP suites; customer portal suite; booking row-lock races cover expiry/revocation after waits | No external channel delivery |
| Inquiry abuse and tenant isolation | Inquiry SQL quotas, honeypot, bounded validation and audit; two-tenant HTTP routes to host-resolved shop | No real inquiry submitted |
| Publication, unpublish, suspension and cache | Profile readiness/assets/permissions SQL; combined HTTP hides root/book/portal/robots/sitemap immediately, retains logout, rejects old session after republish and preserves other tenant | Actual CDN behavior requires provider smoke |
| Canonical, robots and Open Graph | Combined production-build HTTP verifies canonical URLs, host Vary/no-store, robots/sitemap, noindex private journeys and unknown/unpublished 404 | Public hostname transport uses loopback |
| EN/AR, RTL, keyboard, responsive and themes | Launch browser matrix: 390/820/1440 px × EN/AR × light/dark; one main/h1, exact lang/dir, no overflow, keyboard service/time choice and focus, booking, portal and changelog | Focused semantic/keyboard checks, not a claim of exhaustive WCAG certification |
| Product scope | No cart, checkout or payments public routes; denied by combined HTTP | Historical snapshot prohibition on public booking is superseded by explicitly authorized/reviewed SS-APPT-002; ecommerce remains excluded |
| Provider/deployment prerequisites | Existing [address foundation](website-address-foundation.md); statuses below | No infrastructure/deployment authorization implied |
| Full regression | Dedicated GitHub-hosted disposable launch workflow runs maintained full Shop suite unchanged, seven website SQL suites, Shop type/lint/build, six built HTTP suites and maintained feature/launch browsers; root review runs units, architecture and release checks | Thin local SQL fixture explicitly cannot substitute for full provider replay |

## Evidence commands

- `SHOP_WEBSITE_TEST_CONTAINER=shop_website_disposable node tooling/database/test-shop-website-launch-local.mjs`: seven actual PostgreSQL feature suites and concurrency; synthetic fixtures rolled back/cleaned. The command explicitly reports that full provider replay is not run locally.
- CI only: `LAUNCH_FULL_SHOP_DB=1 node tooling/database/test-shop-website-launch-local.mjs` on the GitHub-hosted disposable Supabase container. Reuses the maintained account-provisioning CI-only legacy catalog upgrade fixture and permission seed, then includes unchanged `test-shop-local.mjs` financial/operational regressions before the website matrix.
- `node --test apps/shop-suit/tests/integration/ss-web-launch-001-built.test.mjs`: actual built Nitro with a loopback typed RPC fixture; production handlers, cookies and host routing run unchanged. The private changelog endpoint fails safely when the provider is absent.
- `pnpm exec playwright test -c apps/shop-suit/tests/e2e/ss-web-launch-001.config.ts`: 12 end-to-end browser journeys, no assertion/mutation retries. Changelog UI uses a synthetic public release contract; actual reader contract and disposable SAS catalog replay remain separate checks. The strict SAS origin allowlist is unchanged.
- `pnpm test`, `pnpm docs:generate`, `pnpm exec turbo run typecheck --concurrency=1`, `pnpm --filter @building-suit/shop-suit lint`, `pnpm check`, `pnpm --filter @building-suit/shop-suit build`, `pnpm release:check`, `git diff --check`.

Reviewed PR341 exact-head evidence: 12 successful checks and three expected skips, including 41 maintained Shop SQL suites, three operational race gates, seven website SQL suites, six built HTTP suites and 96 browser cases. PR325 must pass its own exact combined-head checks; source-head success is not a substitute. Consult the integration PR checks for final executed results; command inclusion alone is not a passing result.

## Launch prerequisite ledger

| Stage | Status | Required evidence/action |
| --- | --- | --- |
| Website/portal/booking implementation | Implemented in reviewed stack | Preserve exact reviewed parents and merge history |
| Synthetic application/database qualification | Reviewed PR341 passed; combined PR325 is separately requalified | Exact combined-head CI success is required before the parent merge |
| BS-CHANGELOG-VERSION-001 hosted baseline | **CLEARED: parent-confirmed public EN/AR verification** | Reviewed PR340 is merged at `c6774d47907f7b09aa0a0e9aa2c45c5687a71c50`. Its qualified singleton UPDATE repair preserves the safeupdate guard and affected-row checks. Parent reports the public bilingual changelog working. This task performs no hosted inspection/write and does not alter separately owned changelog tabs/UI work |
| Wildcard DNS, TLS and trusted host ingress | **UNVERIFIED** | Separately authorized provider owner verifies wildcard binding, delegation, private/public origin separation and forwarded-host trust |
| Feature deployment flags/provider branching | **UNVERIFIED** | Authorized owner checks actual provider state; repository configuration does not prove dashboard settings |
| Website forward migrations / environment deployment | **NOT DEPLOYED BY THIS TASK** | Parent owns final staging merge and normal approved CI/provider migration path; no direct deployment or hosted write. Separately verified changelog deployment is not evidence that this website stack is deployed |
| Actual CDN/cache and public hostname smoke | **NOT RUN** | Separately authorized deployed-candidate host/tenant/unpublish/robots tests |
| Real customer publication / messages | **NOT PERFORMED** | No customer opt-in, real publication or delivery is part of this qualification |
| Production promotion | **NOT AUTHORIZED** | No main merge or production promotion |

Passing the integration candidate establishes combined code evidence. The changelog baseline blocker is cleared; unverified website provider/deployment/smoke stages still prevent a website go-live conclusion. Parent controls the final staging merge and further authorization. See [integration record](../../../docs/work-packages/shop-website-integration.md).
