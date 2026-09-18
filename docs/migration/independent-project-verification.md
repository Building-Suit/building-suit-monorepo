# Independent Supabase project verification — 2026-09-19

This records the finite architecture revision in ADR 0002. Hosted projects remain unconfigured; this is local evidence only.

## Passing checks

| Check | Result |
|---|---|
| Fresh Ledger local initialization | All 66 unchanged Ledger migrations and local seed applied to `building-suit-ledger`, API 60321 / DB 60322 / mail 60324. |
| Fresh Shop local initialization | New dedicated baseline plus public-schema relocation and seed applied to `building-suit-shop`, API 61321 / DB 61322 / mail 61324. |
| Populated Shop relocation | Reset the disposable Shop instance to the baseline only, inserted synthetic Auth/shop/product/plan fixtures, then applied the forward relocation. All 25 business tables had identical row values/IDs, column/default/type metadata, table OIDs, grants and RLS flags afterward. Old schema removed without CASCADE. Instance was subsequently reset to its normal fresh seed. |
| Historical SQL preservation | `pnpm check`: all 80 original migration hashes match the copy manifest. |
| Source preservation | All 502 imported source hashes unchanged; original Ledger, Shop and Building Git trees clean. |
| Shared invariants/environment validation | `pnpm test`: 10 tests pass, including duplicate/crossed refs, organization isolation, frontend privileged-key rejection, runtime/cookie/origin mismatches and missing deployment credentials. |
| Workspace setup | `pnpm run setup` passes; explicit `run` is required because `pnpm setup` is a different pnpm built-in command. |
| App verification | `pnpm build`, `pnpm typecheck`, `pnpm lint`: all three apps pass. |
| Ledger SQL | 678 assertions across 27 suites pass against its separate local instance before browser writes. |
| Shop SQL | Five current suites pass against `public`: onboarding, products, inventory, services and expenses. Preserved test source input only receives the schema-name substitution. |
| Shared/Shop browser suite | Five pass, including Shop OTP signup, shop provisioning, persistent product creation and absence of a Ledger login in the same browser context. |
| Ledger core browser suite | Eight pass, covering shell/navigation, account creation, reports, roles and organization limits. |
| Ledger acquisition browser suite | Ten pass: invitations, OTP signup, resumable onboarding, account switching, entitlement routing, read-only history and billing navigation. Total browser tests this revision: 23. |
| Ledger database lint | No schema errors. |
| Unconfigured hosted preflight | Correctly rejects missing project refs without contacting a hosted project. |

## Existing source limitation

Shop database lint reports a pre-existing invalid expression `invoice_id - _invoice_id` in `public.issue_invoice_and_deduct_inventory(uuid,uuid)`. The exact expression is present in the preserved source snapshot; this revision does not change its business logic. The source’s later hardening migration revokes execution, and the relocated function remains non-executable for both `anon` and `authenticated` (verified). Current implemented Shop RPCs and five SQL suites pass. This is not a claim that the source product’s unfinished invoicing feature works.

## Reproduce the one-time preservation check

Only the disposable task-created Shop instance may be reset. Stop app/browser writes first:

```sh
pnpm db shop-suit db reset --local --version 20260918213353 --no-seed
python3 docs/migration/verify-shop-relocation.py
pnpm db shop-suit db reset --local
pnpm db:test:shop
```

The script refuses to proceed without the baseline source schema and invokes only the fixed local container. It does not accept a hosted connection. Never run this reset sequence against real data.

## Limits and hosted acceptance

The two local stacks were started without optional Studio, Storage API, Realtime, Edge runtime, analytics and pooler containers. Their database objects/configuration remain preserved; those services and external Paymob/Resend delivery were not integration-tested by this revision.

No account invitations, organizations/projects, paid plans, hosted schema/data/Auth transfers or deployments were performed. Four refs/origins/credentials and the Free/shared-Owner arrangement require manual setup. Follow `docs/shared/supabase-manual-setup.md` and the bounded Shop transfer procedure. Global Auth is deferred, not an outstanding acceptance item.

The former combined local rehearsal was stopped with its volume retained. Original source repositories and their local containers were not modified.
