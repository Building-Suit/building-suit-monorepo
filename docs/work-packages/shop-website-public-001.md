# SS-WEB-PUBLIC-001

Parent: PR328 at `767ef435bf7a1ba6306e9229a106fc9bf23e2f6a`, branch `codex/shop-suit/ss-web-catalog-001`. Separate stacked draft; integration belongs to the parent batch. No release machinery changes, merges, customer publication, hosted database writes or manual deployments.

Acceptance retrieved before implementation from the canonical SS-WEB-PUBLIC-001 record in `docs/shared/upcoming-task-readiness.snapshot.json` and its amendment payload. Scope: bilingual responsive public showcase/contact/inquiry, server validation/honeypot/rate limits, private owner inquiry management, tenant/cache isolation and SEO/robots. V1 excludes public ecommerce, booking and account creation. Shared UI/UX ownership follows the amended scope and explicit user instructions.

Implementation and verification contracts: [public showcase](../../apps/shop-suit/docs/website-public-showcase.md). Public/profile/catalog/slug tests use disposable synthetic identities only. The full provider migration chain is exercised in GitHub, not against hosted product data. Local provider fallback uses the task-owned disposable PostgreSQL container with provider-schema stubs; two pre-existing pg_cron/pg_net extension installation statements are omitted only in that local bootstrap. This limitation does not replace provider CI.

Local verification: Shop production build; all six app typechecks; workspace/token/strict ownership and release checks; full unit suite (1550 passed, 23 skipped) plus six final PUBLIC unit cases; two built-host/API tests; four disposable website SQL suites (slug/profile/catalog/public); twelve public EN/AR × phone/tablet/desktop × light/dark browser cases; three private inbox/employee browser cases; ten PROFILE and six CATALOG browser regressions. Marketing/privacy regression coverage is also run against the preserved private-origin entry.

Exact-head provider CI and the draft PR are the handoff source of truth. No task records or release machinery are changed by this feature.
