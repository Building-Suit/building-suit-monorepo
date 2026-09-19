# Ledger Suit

Ledger Suit is the financial application in the Building Suit workspace. Routes, organization/capability adapters and financial rules remain product-owned. The Nuxt layer supplies shared Building branding, landing/auth templates, signup navigation, application shell, tables and interaction behavior.

The Accounting menu opens Transactions, Accounts and Reports. Transactions combines all transaction types with search, type/status/date/account filters, optional category/amount filters, pagination, creation and CSV import. Filters survive reloads through the URL; former transaction-type `/records/:kind` bookmarks redirect to this workspace. Accounts opens an expanded hierarchy with visible accounting headings, subtotals, search that preserves ancestors, account statements and subaccount creation. The sortable Table view remains available at `/accounts?view=table`. Tree headings organize existing subtypes for navigation; dated financial-statement classifications remain separate.

Run commands from the monorepo root:

```sh
pnpm install
pnpm run setup
cp apps/ledger-suit/.env.example apps/ledger-suit/.env
pnpm dev:ledger
pnpm --filter @building-suit/ledger-suit build
pnpm --filter @building-suit/ledger-suit typecheck
```

Use the root [database runbook](../../docs/shared/database.md) and [environment registry](../../docs/architecture/environments.json). This app’s `supabase/` directory owns its SQL, functions, templates and fixtures. Run `pnpm db ledger-suit start` to initialize the isolated local API on port 60321 (database 60322; email inbox 60324). Production and staging are separate Ledger projects; business objects remain in `public`. Follow the [manual key setup](../../docs/shared/supabase-manual-setup.md) for hosted configuration.

The isolated local seed has Alpha Trading and Beta Supplies to exercise tenant isolation. Local fixture accounts are `owner@alpha.test`, `accountant@alpha.test`, `viewer@alpha.test`, and `owner@beta.test`, with the disposable seed password `ledgersuit`. Never use these fixtures against a hosted business database.

After building and starting the designated local backend, `pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/core-finance.spec.ts` verifies core browser flows. The copied test configuration pins the monorepo local API and rejects other `SUPABASE_URL` values. Run relevant SQL tests through root tooling and record unrun suites.

Product documentation is under `docs/`. Original standalone setup instructions are preserved in `docs/migration/source-readmes/ledger-suit.md` at the repository root as historical reference; root instructions and scoped `AGENTS.md` govern this workspace. Current integration limitations are tracked in the root implementation status, separately from future development rules.

Current product planning lives in [the accountant-system plan](docs/accountant-system/README.md), including the Arabic review document and acceptance scenarios. Older launch/accounting-v2 documents redirect there. Imported Accounts-table work uses the shared monorepo table and dialog components; see [the integration record](../../docs/integrations/ledger-latest.md).
