# Approved inventory accounting — V2-IMP-014

Status: implemented in the local worktree; verification is partial. No commit, push, merge, deployment, hosted database operation, live Inventory Suit connection, or accountant UAT was performed.

## Decision and boundary

The approved V2-D12 in `.local/agent-tasks/V2-IMP-014.json` is authoritative: when connected, Inventory Suit supplies versioned movement/valuation facts; Ledger must not calculate operational valuation. Negative stock is unacceptable; returns, backdating, corrections and revaluations are explicit versioned/compensating facts. Inventory Control and COGS mappings are configured in Ledger. Historical baseline references to an unresolved D12 do not supersede this approval.

This implementation is Ledger's authenticated ingress and accounting/reporting boundary. It does not import another app's internals or implement warehouse operations, purchasing, order management, manufacturing, costing algorithms, tax calculation, or dimension allocation. No Inventory Suit transport endpoint or credentials were supplied. An actual source must implement this contract and authenticate as the explicitly bound Ledger member; merely configuring a source does not establish a live connection.

## Configuration and source contract

`create_inventory_control_account` uses the existing atomic account/binding command, quotas and `controls.configure` permission. `configure_inventory_source` requires `inventory.configure` and binds an approved source identifier, active Ledger actor, effective date, base currency, an unused debit-normal Inventory Control account, unused debit-normal cost-of-sales posting account, and a distinct accounting offset account. Existing balances/accounts are never inferred or converted. Mappings and source identity are immutable; referenced account classifications cannot drift. A replacement source requires reviewed new configuration and explicit source transition facts, not rewriting history.

The offset represents accounting clearing/adjustments, not an automatically recognized supplier balance. AR/AP, tax and dimension workflows are not synthesized. Ordinary COGS postings remain visible as reconciliation differences. Generic inventory-control adjustments and reversals are blocked; Inventory Suit must supply compensating facts.

`ingest_inventory_fact(organization_id, source_id, fact)` requires the bound actor, active membership/subscription, `inventory.ingest`, and the ordinary journal create/post/adjust capabilities. Configuration alone does not grant capabilities. Organizations requiring adjustment approval reject this synchronous source path rather than bypass approval. Existing quotas, period checks and the common posting engine still apply.

Example first fact (all amounts are exact signed decimal strings in base-currency minor units):

```json
{
  "schema_version": 1,
  "currency": "EGP",
  "negative_stock": false,
  "sequence": "1",
  "movement_id": "MOVEMENT-1",
  "movement_version": 1,
  "valuation_id": "VALUATION-1",
  "valuation_version": 1,
  "costing_method": "method-declared-by-approved-source",
  "policy_version": "source-policy-1",
  "kind": "purchase",
  "effective_date": "2034-02-01",
  "accounting_date": "2034-02-01",
  "stock_quantity_after": "10.000",
  "inventory_delta_minor": "10000",
  "cogs_delta_minor": "0",
  "inventory_balance_after_minor": "10000",
  "cogs_balance_after_minor": "0",
  "related_fact_id": null,
  "reason": null
}
```

- A source is one complete valuation book/stream in a single base currency. Its sequence starts at 1 and increases without gaps. The stream starts from zero; any opening inventory is an explicit source increase. Do not republish a balance already recognized in the GL.
- Stock quantity is the source's remaining quantity for that movement's stock subject, not a Ledger stock ledger. Negative/nonfinite quantities and `negative_stock != false` are rejected. Ledger does not infer quantities, unit costs or cost layers.
- Each movement/valuation identity has a positive contiguous version. Reusing an existing identity/version, sequence, or valuation/version with identical JSON returns the original fact. Different content conflicts. Later versions require correction facts; later movement versions link the immediately previous movement version. A new compensating movement can instead have its own ID/version and link its target.
- Versions always contain **incremental accounting effects**, never replacement totals. Both cumulative source balances must equal the previous received snapshot plus supplied deltas. This arithmetic checks transmission completeness; it does not calculate stock valuation.
- Unknown fields, including undeclared tax, FX or dimension instructions, are rejected. This prevents silently dropping accounting instructions outside the contract.
- Positive inventory/COGS deltas are debits; negative deltas are credits. The balancing offset is `-(inventory delta + COGS delta)`. Zero lines are omitted. One nonzero fact creates exactly one balanced journal and immutable source row atomically. Zero-value/non-accounting movements are outside this ingress.

| Fact | Required source accounting effect |
|---|---|
| `purchase`, `increase` | Positive inventory, zero COGS; credit configured offset |
| `decrease` | Negative inventory, equal positive COGS |
| `customer_return` | Positive inventory, equal negative COGS; link original decrease |
| `supplier_return` | Negative inventory, zero COGS; link original purchase/increase |
| `adjustment`, `revaluation` | Explicit signed source deltas with reason, balance through configured offset |
| `correction` | Explicit signed compensating deltas, linked prior fact and reason; preserve original evidence |

Backdating changes neither earlier facts nor operational cost layers. The source must provide its effective and accounting dates; accounting date cannot precede source effective date or use a closed period. A source may explicitly supply a later open accounting date with a reason. Ledger never silently changes a date or regenerates historical costs. Failed requests consume neither sequence nor journal, so an approved corrected request can retry.

## Reconciliation and traceability

`read_inventory_workspace` returns as-of source deltas and independently summed posted GL amounts for each configured Inventory Control/COGS pair. It also compares the latest received source snapshots to **all** received deltas, including backdated facts. It reports each difference, not merely a Boolean. COGS operating activity excludes `year_end_close`; closing entries are returned separately, so the full COGS GL balance equals reported activity plus closing entries. These are latest-received-source results, not proof that a remote source has sent its newest facts.

The shared `reconcile_control_accounts` provider supports inventory alongside unchanged AR/AP providers. A configured source with no facts reports `awaiting_source`/provider unavailable, not reconciled zero. Historical unbound inventory posting accounts remain outside these mappings and retain their balances.

The bilingual `/inventory-accounting` page shows source balances, GL balances, differences and paginated movement/valuation/journal evidence. Journal references search the Journal Center; its source link opens the exact scoped fact. Source actor/tenant changes clear local state, drafts and stale responses. Posted journals cannot be generically reversed through the dialog; the source supplies compensation.

## Acceptance and evidence

| Requirements | Implementation / verification assets |
|---|---|
| INV-01–03 | Two forward migrations; source configuration, authenticated ingress, existing Control-account contract, shared posting engine |
| INV-04, INV-07 | Eight explicit source fact kinds; provenance method/policy/version; linked returns/corrections; no invented costing method |
| INV-05 | Source/GL/snapshot differences and shared Control provider; native fixture expects valuation 5,300 / COGS 3,000 after six facts, then valuation 6,000 after increase/adjustment; deliberate COGS variance is detected |
| INV-06 | Immutable source/version/valuation/journal links and bidirectional Journal Center navigation |
| INV-08 | Accounting-only schema, adapter and UI; no operational modules |
| VAL-05 | SQL authorization/integrity/period fixtures, concurrent retry runner, bilingual browser fixtures, exact reconciliation predicate unit coverage, migration snapshot query |

Migrations: `20260926110000_add_inventory_subledger_type.sql` commits the enum before `20260926110100_approved_inventory_accounting.sql` uses it. They add objects and capabilities without rewriting existing financial rows. The documented CLI migration-creation command was attempted but the Supabase executable was unavailable; the forward files were created locally. The focused RPC contract is product-owned, following the existing VAT/assets convention. Full catalog type regeneration must follow native migration validation; generated `database.types.ts` was not hand-edited.

For an owned disposable local database, apply the migration chain and run `pnpm db:test:ledger`. The focused fixture is `supabase/tests/46_inventory_accounting_test.sql`; it rolls back. Before and after migration-only application, run `scripts/inventory-migration-snapshot.sql` with the same synthetic `organization_id` and compare outputs: expected transaction/entry/count/balance variance is zero. **No actual pre/post snapshot comparison has run here.** Source snapshot variance assertions live separately in fixture 46.

The concurrency runner requires `LEDGER_INVENTORY_DISPOSABLE_TEST=1`, an explicitly prepared disposable Supabase copy under this worktree's `.local/verification/inventory-accounting`, project/container `ledger-inventory-014-disposable`, identical migration files and applied versions. It verifies container ownership before creating synthetic fixtures, holds the first ingestion transaction open, observes the second session waiting on a lock, and asserts one fact/one journal. It never resets or targets a hosted service. Run `node apps/ledger-suit/scripts/test-inventory-concurrency.mjs` only after that explicit disposable setup.

Browser verification after dependencies/build: `pnpm --filter @building-suit/ledger-suit test:e2e tests/e2e/inventory-accounting.spec.ts`. Mocked browser fixtures validate presentation, not database authorization. They cover English/Arabic, LTR/RTL, mobile, source/journal links, read-only actions, empty/error/denied states.

## Actual checks and blockers — 2026-09-26

Passed:

- `pnpm --filter @building-suit/ledger-suit test:unit`: all 14 unit test files, including inventory reconciliation and bilingual key coverage.
- `pnpm check`: canonical tokens, workspace boundaries and 80 preserved historical migrations.
- `node --check` on the inventory concurrency runner and browser fixture.
- `git diff --check`.

Blocked/failed prerequisites:

- `pnpm agent:preflight`: fetch/GitHub state not verified; local branch is `codex/ledger-suit/v2-imp-014`, starting HEAD `8156a43` and initially clean.
- Dependency installation: default store is read-only; worktree-local offline store lacks packages; online retry fails DNS (`EAI_AGAIN registry.npmjs.org`). No lockfile change.
- Ledger typecheck/lint: `nuxt`/`eslint` unavailable. Browser attempt: available `playwright` command does not provide `test`; project dependencies are absent. Build not run.
- `pnpm db:test:ledger` and migration CLI: `supabase` unavailable; local port 60322 has no responding DB; Docker socket access denied. Migration execution, pgTAP, concurrency execution, generated catalog types and pre/post/source snapshot evidence remain unverified.
- Real Inventory Suit producer integration and independent accountant-reviewed balances/UAT remain unverified. No live credentials or external changes were requested or used.

Recovery for future authorized application is forward-only: preserve immutable facts and posted entries; use explicitly supplied compensating facts. Do not delete history or infer opening/conversion entries from existing inventory classifications.
