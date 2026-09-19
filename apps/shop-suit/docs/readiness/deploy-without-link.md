# Deploy Shop migrations without linking a checkout

The earlier procedure in this file targeted the retired shared source project
`jkdncdexqcymwbihwdhp` and its `shop_crm` schema. It is historical only and must
not be used for current development or deployment.

Current Shop database work uses the app-owned migration chain under
`apps/shop-suit/supabase/migrations`, the dedicated-project `public` schema and
the immutable refs in `docs/architecture/environments.json`:

- Staging: `jvvelvftpfnlogalgxgv`
- Production: `fgdzjnsbcxfbiuogbmom`

Keep the populated ignored credentials in
`supabase/environments/shop-suit/.env.<environment>`. From a checkout that has
those files, validate the selected configuration first:

```bash
pnpm db:preflight shop-suit staging
```

An isolated worktree does not contain ignored files. Do not copy credentials
into it merely to satisfy the preflight. Run the preflight from the configured
checkout, then export the intended environment privately and pass the verified
project ref explicitly to the app-owned CLI command. Discover the installed
flags with `pnpm db shop-suit db push --help`, inspect the hosted migration ledger
and run a dry run before any apply. Never include a database password in command
arguments, logs, documentation or chat; supply it through the environment.

The normal sequence is:

1. Verify the product/environment/ref with `pnpm db:preflight` and
   `docs/architecture/environments.json`.
2. Inspect the remote migration ledger.
3. Run `pnpm db shop-suit db push --project-ref <verified-ref> --dry-run --skip-vault`.
4. Review the exact pending versions.
5. Apply the same command without `--dry-run` only within current authorization.
6. Run rollback-safe fixtures and remote security advisors, then record the
   hosted versions and actual results.

Do not link the CLI to infer an environment, start a local Supabase instance,
deploy Edge Functions, replay `supabase/legacy/shop-suit`, or target the shared
source project. Production apply remains a separately authorized release action.
