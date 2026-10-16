# SS-WEB-LAUNCH-001 qualification

Status: **NOT DEPLOYED; launch prerequisites remain blocked.** This is a synthetic code qualification, not permission to publish a customer website or promote an environment.

Candidate: reviewed website stack through PR339 (`e009102b448062602496e11978a2aad60717c2fd`), with a history-preserving merge of reviewed staging `ff568402698a1a79703d323db8b59f39e10bf0c0` (PR337/338). The launch draft targets PR339. Parent owns the eventual single combined staging merge; no parent branch, staging, main, provider or hosted data is changed here.

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
- CI only: `LAUNCH_FULL_SHOP_DB=1 node tooling/database/test-shop-website-launch-local.mjs` on the GitHub-hosted disposable Supabase container. Includes unchanged `test-shop-local.mjs` financial/operational regressions before the website matrix.
- `node --test apps/shop-suit/tests/integration/ss-web-launch-001-built.test.mjs`: actual built Nitro with a loopback typed RPC fixture; production handlers, cookies and host routing run unchanged. The private changelog endpoint fails safely when the provider is absent.
- `pnpm exec playwright test -c apps/shop-suit/tests/e2e/ss-web-launch-001.config.ts`: 12 end-to-end browser journeys, no assertion/mutation retries. Changelog UI uses a synthetic public release contract; actual reader contract and disposable SAS catalog replay remain separate checks. The strict SAS origin allowlist is unchanged.
- `pnpm test`, `pnpm docs:generate`, `pnpm exec turbo run typecheck --concurrency=1`, `pnpm --filter @building-suit/shop-suit lint`, `pnpm check`, `pnpm --filter @building-suit/shop-suit build`, `pnpm release:check`, `git diff --check`.

Consult the draft PR exact head/check links for the final executed CI result; command inclusion alone is not a passing result.

## Launch prerequisite ledger

| Stage | Status | Required evidence/action |
| --- | --- | --- |
| Website/portal/booking implementation | Implemented in reviewed stack | Preserve exact reviewed parents and merge history |
| Synthetic application/database qualification | Local evidence and exact-head CI recorded on PR | CI success is required before integration |
| BS-CHANGELOG-VERSION-001 hosted baseline | **BLOCKED, owned separately** | PR338 fixes diagnostics and PostgREST void success; its hosted BASELINE_PIN failure explicitly remains unresolved pending administrator read-only metadata inventory. Open draft PR340 narrows runtime evidence but explicitly does not repair the hosted cause. Do not bypass/reset controls or describe this as launch-ready |
| Wildcard DNS, TLS and trusted host ingress | **UNVERIFIED** | Separately authorized provider owner verifies wildcard binding, delegation, private/public origin separation and forwarded-host trust |
| Feature deployment flags/provider branching | **UNVERIFIED** | Authorized owner checks actual provider state; repository configuration does not prove dashboard settings |
| Forward migrations / environment deployment | **NOT DEPLOYED** | Only approved CI deployment path after prerequisites; never manual hosted writes |
| Actual CDN/cache and public hostname smoke | **NOT RUN** | Separately authorized deployed-candidate host/tenant/unpublish/robots tests |
| Real customer publication / messages | **NOT PERFORMED** | No customer opt-in, real publication or delivery is part of this qualification |
| Production promotion | **NOT AUTHORIZED** | No main merge or production promotion |

Passing this draft establishes code evidence only. The unresolved changelog baseline and provider/deployment/smoke stages prevent a go-live conclusion. Parent controls integration and any further authorization.
