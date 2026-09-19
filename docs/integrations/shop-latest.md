# Shop source integration — 2026-09-19

Shop's remote `dev` tip is `a218d15472ff9d0c1e5473052d98e7fa81a1d00c`. The original local repository is clean at `addc7827237152905b402e72d5eae44ab0eea10a`, twelve commits ahead of that remote tip. Those twelve feature/readiness commits were already included in the initial monorepo import. The remote has no open Shop PRs. Replacing the monorepo app with remote `dev` would therefore discard newer catalog/inventory/service/expense work.

This PR captures the newer Shop transfer work present in the monorepo workspace: the service-role grant preservation migration, updated environment/transfer records and navigation/status documentation. The migration restores the source's existing server-role privileges on 49 relations and 16 legacy functions in dedicated projects. It does not alter business columns or browser grants.

The transfer record describes the earlier hosted Production data/Auth copy and Staging schema verification. This source integration does not repeat that import, change remote Auth settings, send mail, deploy an app or cut over traffic. SMTP/application/cutover prerequisites remain in the transfer record. Ignored environment files, backups and customer payloads are excluded from the PR.

## Verification

- Applied the pending forward migration to the existing disposable `building-suit-shop` local database using explicit `--local` selection.
- Compared every browser table/function privilege plus RLS flags/policies before and after application: unchanged.
- Six SQL suites pass: original owner-bootstrap, product, inventory, service and expense suites plus the new dedicated-project privilege regression.
- The regression verifies service-role access, denied anonymous profile access, denied direct browser mutations, server-only legacy invoice execution, authenticated onboarding, all public-table RLS flags and the source's private-helper boundary.
- `shop_private` retains its source-approved authenticated usage for invoker RPCs and RLS. It remains unexposed through the Data API; anonymous access and direct execution of the internal write guard remain denied.
- Local security advisors report no warnings/errors.
- `pnpm check`, `pnpm test`, runner lint and diff checks pass. The original 80 migration hashes remain unchanged.

The original Shop repository and its branches were not changed or pushed. Continue development in `apps/shop-suit` using the shared monorepo components and product-specific Supabase history.
