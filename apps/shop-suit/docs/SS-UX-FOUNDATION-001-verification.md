# SS-UX-FOUNDATION-001 verification

Status: implemented locally; browser acceptance remains blocked by the execution sandbox.

Workstream/branch: `shop-suit` / `codex/shop-suit/ss-ux-foundation-001`.
Starting HEAD: `02eef76a721a315de9466488e1dbff76ad5052e7`. The worktree was clean before implementation. No commit, push, merge, deployment or database operation was performed.

## Implementation and acceptance

| Area | Changes and evidence |
| --- | --- |
| UI-D01, UX-02 | PrimeVue 4.5.5/Tailwind 4 retained. Shared `BsButton`, `BsSelect`, `BsForm`; component-selection guidance and `pnpm check` enforcement. No new runtime dependency or UI system. |
| UX-01, UX-08, VAL-11 | Shared English/Arabic labels and safe errors, logical select spacing, native settings radio navigation, 44px minimum button targets. Bilingual server-rendered component assertions pass. Browser RTL/LTR, responsive, keyboard/focus and actual target geometry remain unverified. |
| UX-03, UX-09 | Forms announce pending state, disable controls and focus linked error summaries. Inventory distinguishes permission denial from empty/loading/error. Settings handles unavailable/loading shop state. Success toasts and semantic statuses include text. Text uses the canonical foreground for contrast. |
| UX-04, UX-05 | Existing sale/payment confirmation wording retained. Manual receipt, FIFO write-off and physical count confirmations describe their stock/value effects. Shared confirmation defaults focus to Cancel. Business RPCs and financial units remain unchanged. |
| UX-06 | Inventory movements/counts and customer receivables use server pages of 20 instead of a fixed first 100. Statements use the shared lazy paginator. Sales/customer/stock pickers use PrimeVue virtualization. Inventory overview renders pages of 20. |
| UX-07 | Receipt selections survive pagination, validated against retained invoice snapshots before the existing authorized RPC; affected cached receivable/statement pages refresh. Inventory mutations refresh and report success. Sale issuance refreshes the actual inventory-overview key. |
| UX-10 | No schema-only feature, navigation entry or new business workflow added. |

Changed files are confined to six Shop page files (sales list/detail, customer list/detail, inventory and settings), the receipt-allocation helper/test, shared UI wrappers/feedback/styles, canonical focus tokens and generated outputs, the component catalogue, focused tests, boundary checks and this task's guidance.

The light focus token now uses Building Navy (14.85:1 against the light surface, previously 2.42:1). Dark controls and always-dark brand panels retain Highlight Gold. Tests assert at least 4.5:1 for pattern text and 3:1 for focus against relevant canonical surfaces. This is a token-pair review, not a claim of complete WCAG conformance or a substitute for rendered browser review.

## Checks actually run

- `pnpm agent:preflight`: failed with exit 255; fetched/live GitHub state could not be verified. A direct `gh pr list` also failed to connect. Local branch/worktree/status/history were inspected; no branch or publication decision was made from stale remote state.
- Dependencies installed with the frozen lockfile from the local cache. The initial empty-store offline attempt failed; the subsequent cached installation succeeded. No manifest/lockfile changes.
- `node --test packages/ui/tests/foundation.test.mjs apps/shop-suit/tests/unit/receipt-allocations.test.mjs`: passed. Six assertions groups cover actual PrimeVue button/select rendering, bilingual form/toast labels and pending/error semantics, canonical text/focus contrast, retained cross-page allocations and invalid/stale allocations.
- `pnpm --filter @building-suit/shop-suit typecheck` and `lint`: passed. An initial incorrect settings property was caught and fixed. Final app lint has no warnings.
- Typechecks for `@building-suit/docs`, `@building-suit/ledger-suit` and `@building-suit/inventory-suit`: passed for shared consumers. Supabase-enabled apps warn about absent local URL/key configuration; no backend was contacted by these checks.
- Targeted ESLint for changed shared Vue components, shared component tests, focused Playwright files, the boundary checker and catalogue: passed. An initial root-invoked app lint used the wrong Nuxt scope; rerunning from the owning app passed.
- Shop and documentation production builds: passed locally. Build output includes the existing missing-Supabase-configuration warnings. No server was deployed.
- `pnpm check`: passed; generated tokens match the source, workspace boundaries pass, 80 historical migrations remain unchanged.
- `git diff --check`: passed.
- `pnpm exec playwright test -c packages/testing/playwright.shop-ui.config.ts --list`: passed, discovering eight focused tests.
- `pnpm exec playwright test -c packages/testing/playwright.shop-ui.config.ts`: blocked before tests ran. Both local servers fail to bind with `listen EPERM` (`127.0.0.1:4421` and `:4422`). Browser/keyboard/RTL/theme/responsive tests are **not passing evidence** from this session.

## Independent verification

In an environment permitted to bind localhost and launch Chromium, run:

```sh
pnpm --filter @building-suit/shop-suit build
pnpm --filter @building-suit/docs build
pnpm exec playwright test -c packages/testing/playwright.shop-ui.config.ts
```

The focused suite supplies synthetic browser responses for Shop's local API; it needs no database or hosted credentials. It covers English/Arabic and light/dark shared patterns at mobile width, virtualized selection/filtering, dirty-close/focus return, form pending/error states, notification targets, inventory history beyond 100, receipt allocations across pages, settings save, permission denial and loading/error recovery. Review actual responsive screenshots and keyboard paths in all shared consumers before closing VAL-11.

Remaining limitations: browser acceptance and live GitHub state are unverified. Existing `sale_catalog` and `list_inventory` APIs still return complete catalogs; virtualization/pagination bounds rendered controls, not response payload size. Backend authorization, stock/financial invariants and database tests were not rerun because no backend command/schema changed and no database was authorized for this task.
