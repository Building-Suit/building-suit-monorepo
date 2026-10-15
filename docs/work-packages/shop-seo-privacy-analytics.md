# SS-SEO-PRIVACY-001 — Shop public SEO, consent and optional analytics

Status: implemented and locally verified; draft review and external deployment/account handoff remain separate. No deployment performed.

Requested scope: environment-aware public SEO, crawlable staging noindex, genuine-public sitemap, non-disruptive language/canonical strategy, factual sharing/schema, basic consent-gated GA4, bilingual reusable consent, truthful disclosure and exact owner account handoff.

Worktree: `.local/worktrees/shop-privacy` on `codex/shop-suit/seo-consent-analytics`.
Draft PR: [#320](https://github.com/Building-Suit/building-suit-monorepo/pull/320).
Stack/parent: Shop, [#319](https://github.com/Building-Suit/building-suit-monorepo/pull/319), following #317/#316. Originally branched from #317 at `aec85784af064e67faf312e2c7b97d698a3e183a`; incorporated newly published #319 checkpoint `85e962566cc76a1229ba87a348da66ccc90a9a48` before publication to preserve newest-leaf stack ordering. Those feature implementations are inherited, not owned by this PR.
Verified staging: `4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c` (fetched before implementation and publication). No merges/pushes to staging or main.
Early checkpoints: `486d2e90` (SEO foundations), `25ab350d` (consent and analytics), followed by parent-checkpoint merge.

Owning code: Shop app/composables, `shared/publicSeo.ts` and `shared/marketingAnalytics.ts`, Nitro middleware/routes, `packages/ui` and `packages/ux`; documentation catalogue is an affected consumer. The full behavior, storage inventory, primary sources, tradeoffs and exact external setup are in [the runbook](../../apps/shop-suit/docs/seo-privacy-analytics.md).

## Verification record

- `pnpm check`: passed; canonical tokens match, strict Suit UI boundaries and atomic route ownership pass, historical migration sources unchanged.
- `pnpm typecheck`: all six workspace app tasks passed after generating maintained documentation inputs and declaring the catalogue's direct UX dependency.
- `pnpm lint`: passed; one existing unrelated attribute-order warning remains in `BsAdministrationEntryPage.vue`.
- `pnpm test`: latest full run 1,496 passed, 23 skipped, zero failures (1,519 tests). Skipped tests require optional disposable PostgreSQL/receipt fixtures or are existing skips; no hosted data tests were run.
- New policy/provisioning tests: six passed, including failure/replay cases and browser-restricted cookie cleanup.
- Local production Node/Nitro Shop build: passed. The build uses the maintained lockfile and pnpm 10.33.0; the environment's initial pnpm 11 mismatch was corrected using an isolated `/tmp` Corepack installation, without changing project engine requirements.
- Final completed-build browser suite: **8 passed** (`pnpm exec playwright test -c apps/shop-suit/tests/e2e/marketing-privacy.config.ts`). Includes safe signup transport, real pricing-link activation, settings draft/save, stale/expired preferences and blocked-storage focus/reload behavior.
- Final public/auth regression: **10 passed** (`pnpm exec playwright test -c apps/shop-suit/tests/e2e/cloud-public-auth.config.ts`), including OTP response-loss/retry, Arabic signup and Arabic mobile sign-in.
- Final billing/checkout regression: **12 passed** (`pnpm exec playwright test -c apps/shop-suit/tests/e2e/scheduled-billing.config.ts`), including explicit cash/credit review, deferred changes, expired quotes and private-offer recovery.
- All final output logs are saved under `.local/seo-privacy-evidence/`; screenshots `consent-en.png` and `consent-ar-dark-mobile.png` show the controls in this saved worktree. Google requests are stubbed using an explicitly synthetic test ID; actual Google ingestion is not verified.
- Earlier runs exposed and fixed auth-screen banner obstruction. A superseded checkout regression run was interrupted after a rebuild replaced its served artifact; it is not acceptance evidence. All final browser runs use a completed immutable build.
- Initial remote GitHub `branch-policy` and `review` checks passed on PR #320; stacked full `verify` is correctly skipped. A new `marketing-privacy` workflow adds the focused production-build browser acceptance to relevant PR changes.

## Release fragments

`release-fragments/ss-seo-privacy-analytics.json` classifies the Shop-only compatible capability as minor and supplies curated English/Arabic public notes without private task references. `ss-seo-privacy-shared-support.json` classifies shared support and root CI/lockfile changes internally for all affected registered Suits. Paths are exact owned files, so this task does not accidentally classify ETA/returns work.

The release tooling is not yet in this branch (it belongs to #318). Its actual `fragments.mjs` and `check.mjs` were read from fetched commit `479524c316b6e303b07f6743b7e0a2955d5d11b6`, materialized under `/tmp/shop-release-validator` solely for read-only validation, and run against the committed fragment tree:

`RELEASE_BASE_SHA=85e962566cc76a1229ba87a348da66ccc90a9a48 node /tmp/shop-release-validator/check.mjs`

Result: classification, translations, exact-path/affected-consumer coverage and public boundary checks passed. No release code was copied into this feature branch and no release publication was attempted. Parent should run maintained `pnpm release:check` on the combined candidate after #318 supplies it.

## Handoff / blockers

No actual GA4 measurement ID was provided or invented. Production analytics therefore stays disabled. The parent/owner must resolve the GA account preference modal, review stream privacy/enhanced-measurement and retention settings, supply the real public production ID, and verify consented synthetic delivery. Paid subscription conversion is explicitly disabled.

Search Console domain property ownership is already verified. Parent submits the production sitemap only after a separately authorized production release, and requests staging recrawl once the new noindex is actually deployed. A previously indexed staging page needs a visible noindex; robots remains crawlable. No DNS credentials or account changes are needed for this code.

Vercel quota currently prevents staging builds. No deployment retry, provider workaround, purchase, credential provisioning or hosted DB operation was attempted. Parent owns staging integration/deployment and the user performs manual staging acceptance. Index removal and GA delivery are not claimed as deployed/verified.

#318 owns the public changelog route and landing section. This PR detects the actual route file at build time before including it in sitemap/SEO/analytics. Preserve that PR's public route/auth updates while integrating; its backend feed is not copied into this stack.
