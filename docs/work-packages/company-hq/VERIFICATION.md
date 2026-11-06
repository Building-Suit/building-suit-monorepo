# Verified monorepo office — 3 November 2026

Trusted runtime status confirmed managed cloud before company work and HR involvement: provider cloud, running, connected, observations current, enforced network policy. HQ now lives in `apps/company-hq`, branch `codex/company-hq/office-design`; completed standalone checkpoint `4a6d6a146747d48fb0410de00f1d827d17db8b11` remains preserved as rollback evidence.

The actual production browser capture [office-built-1440x1000.png](office-built-1440x1000.png) matches the founder-attached acceptance screenshot exactly: **zero changed pixels out of 1,440,000**. Both PNG SHA-256 hashes are `7526b8a1067a372d71a2b65bbbf8c59e4e64fb7e19b21d005ab825a0423f72a4`. See [machine-readable visual evidence](visual-verification.json). This comparison used Chromium, 1440×1000, dark theme, 100% zoom and the actual unconfigured/read-only production server. The scene loaded at its natural width 1672; API returned configured:false/authenticated:false/state:null; there were no page JavaScript errors. This is a verified still-layout match, not a claim of an interactive 3D renderer.

Passing checks on the final implementation:

- HQ Nuxt production build, strict typecheck, app lint and new shared UI/UX/checker lint.
- Sixteen HQ domain/auth/SQLite/Postgres/adapter/composable regressions: founder-only approval, CEO/HR isolation, no spending, idempotent atomic writes, sessions/rate limits, server-only migration grants/RLS/CAS, exact hosted-ref/scope/cost guards, draft retention after transport failure, genuine session-loss clearing, newer-response ordering and logout/disposal fencing.
- Five production-build browser scenarios: exact approved screenshot with zero allowed differences; login, durable founder messages and proposal approval, genuine synthetic CEO→HR bridge updates and polling; Arabic/RTL, theme, mobile directory/no overflow, keyboard zoom, dirty-dialog protection and failed-save recovery; HTTP role/origin/size/split-UTF8 guards; fixed-role MCP tool access. These actions used explicit synthetic credentials and records, not real model execution.
- Full repository tests: 2,789 tests, 2,766 passed, zero failed, 23 existing skips. The initial four browser failures were caused by missing Playwright Chromium; installing the required browser and rerunning the suite resolved them.
- Canonical token generation check; workspace architecture: six operational Suits, eight applications, 151 full route templates, zero migration debt. Strict boundary scan: 175 Vue files, zero violations. HQ is explicitly included without becoming an operational Suit.
- Eighteen discovery/dev-launcher regressions; documentation app typecheck and production build with a synthetic, read-only office/access catalogue.
- Pinned pnpm 10.33.0 frozen install. Valid isolated HQ local Supabase ports 5832x were checked against all existing product configurations. No local Supabase stack was started. Hosted environment refs remain unverified requested metadata.

The founder’s return-to-monorepo instruction and preview-evidence correction are recorded in the live Company Brain. Prior standalone reports remain historical under `history/standalone-20261103`.

Hosted limitations remain explicit. The old ChatGPT Site version 1 was not updated; cloud localhost is not reachable as localhost from the founder’s own computer. No hosted database migration, deployment, paid service or genuine model reply occurred. Both requested Supabase refs denied this connection; the staging ref also conflicts with the existing Super Admin mapping. Dedicated project access/scope, zero-cost hosted capacity and an authorized model executor must be verified before operational activation. No paid fallback is enabled. Founder approval and the $0 budget remain enforced.
