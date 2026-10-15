# SS-WEB-PROFILE-001

Branch/worktree: `codex/shop-suit/ss-web-profile-001`, `/workspace/shop-profile`.
Parent: PR325, `codex/shop-suit/ss-web-slug-001`; original requested parent `4cc7b1de929132474622eb7f6bb4cde9940280c5`, then incorporated its authorized marketing fixture-origin fix `ae1505b12e8389de634ec738c03669be0e115922`. PR324/release machinery is excluded. Parent handles combined staging integration; no merge/deployment is performed here.

Implementation contract: [public profile](../../apps/shop-suit/docs/website-public-profile.md).

Design direction: extend the registered `BsBusinessSettingsPage` with one shared organism, preserving its responsive grid, section navigation and existing flat panels. Use canonical background `#FAFAFA`, surface `#FFFFFF`, text `#0B0B0D`, muted `#52525B`, navy `#16293B`, gold `#D89B42` and corresponding dark semantic tokens. Latin uses Manrope Variable; Arabic uses IBM Plex Sans Arabic. The primary distinction is explicit draft/readiness/publication information, not new decoration or typography. Existing template/record-dialog hierarchy and focus/dirty controls suit this settings task; no page palette or token fork is warranted. The requested official frontend-design skill and root/app/UI/database instructions were read. Supabase and Postgres skills were read; current changelog/storage access docs and the WebP container specification were checked.

Verification (2026-10-15):

- Workspace `pnpm check`, strict template check (98 adapters, zero violations), release fragment check, Shop build and all six app typechecks pass. Changed shared files lint clean; app lint has only two pre-existing attribute-order warnings in owner-invitation. `git diff --check` passes.
- Focused unit tests: 8 passed (existing slug/host tests plus independent public defaults, SVG/MIME/byte rejection, dimensions and shared image normalization).
- Full workspace unit suite with pinned Playwright Chromium: 1,543 passed, 23 skipped, zero failures.
- Local disposable SQL suite checks owner/manager authority, cross-tenant read/write/asset/unpublish isolation, independent private defaults, hidden/foreign/archived locations, contact validation, raster PNG/JPEG/WebP acceptance, SVG/false MIME/oversize rejection, browser-count rejection, zero-item refusal, explicit owner opt-in, snapshot independence, suspension, canonical aliases, unpublish retention and audit/grants. Its ready catalog seam exists only inside the rolled-back test transaction.
- All Shop migrations replay in disposable PostgreSQL 17 with synthetic Auth/Storage fixtures, omitting only the existing unrelated pg_cron/pg_net extension installation statements. The full local Supabase image could not unpack (`failed to register layer: no space left on device`); no hosted fallback was attempted. GitHub's dedicated disposable Supabase workflow supplies full provider integration coverage.
- Generated public database types came from the pinned CLI against this disposable replay; 108 added lines for the three new private tables and six RPCs, without unrelated schema changes.
- All eight profile browser cases passed with pinned Playwright Chromium. Coverage includes EN/AR, light/dark, mobile/desktop, empty independent values/hidden locations, saved draft reload, zero-item Publish disabled even after consent, denial, safe failed-save recovery, unpublish and decoded logo format/size rejection. Screenshots were inspected for mobile Arabic dark layout; no horizontal overflow.
- Parent fixture-origin fix: 9 marketing privacy browser cases passed with pinned Chromium; built host-isolation regression passed. Classifier unchanged. Fix committed/pushed on PR325 separately and incorporated here.

No personal network/computer, Arch, n8n, self-hosted Penpot, hosted product DB writes, manual deployment, provider/secret/security changes, staging/main merge or branch deletion. CATALOG remains the next task and publication stays refused until its server readiness integration exists.

CI regression follow-up: the first profile head passed its full disposable Supabase/profile browser job but exposed an unknown-RPC array in the older address fixture after profile refresh. Profile RPC responses now receive runtime shape/URL/asset validation; malformed responses show a retryable panel error instead of removing the settings page. Existing address tests remain intact, with an additional malformed-response recovery case in the profile suite. Owner consent resets when editing profile details or replacing a logo.
