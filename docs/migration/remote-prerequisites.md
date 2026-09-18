# Hosted migration prerequisites

This document records the remaining work for this one-time consolidation. It is not a future agent workflow.

The connector exposes Finance Suit (`kedjrbwnznvfqlzszawa`) and the current Shop source named Building Suit (`jkdncdexqcymwbihwdhp`). It does not expose the requested Ledger Suit production or Ledger Suit STG destinations. The Ledger source configuration points to `yqculoltqsyfastmihmu`; this is evidence of its configured backend, not verification of the intended production/staging pair. Do not substitute either accessible project as a destination.

Required inputs:

1. Immutable refs and working access for Ledger production and Ledger STG.
2. The production/staging origins for both apps and, if applicable, the Building account domain.
3. Verified backup/restore points and a bounded staging test scope, obtained through the authorized services once access exists.

With access, complete the already planned sequence:

1. Capture source/destination schemas, ownership, table counts, object dependencies, Auth users/identities/hooks, functions, buckets/policies and Realtime/job configuration. Compare live deployed histories with the preserved copies.
2. Obtain the current Shop baseline. Its current `shop_crm` migrations depend on pre-existing objects. An older schema-only recovery snapshot plus nine migrations now runs locally, but its complete live grant/service/data equivalence has not been certified. The legacy public-schema dump is not a substitute for the current source.
3. Classify overlapping users/identities and profile references. Preserve IDs and account associations. Surface any conflict that would require changing the user's protected column/ID constraints before attempting it.
4. Prepare forward-only, reviewable schema relocation and scoped cross-project transfer artifacts. Preserve all original migration files, columns, constraints and data. `ALTER TABLE SET SCHEMA` relocates within one project; it does not transfer Shop records between projects.
5. Rehearse the private `ledger_suit` / `shop_suit` and API/private-helper boundaries in staging. Rewrite schema-qualified dependencies without changing business semantics, recheck privileges/RLS and validate existing callers before cutover.
6. Implement and verify one shared-account/session strategy for the actual origins, including callbacks, logout, signup recovery, existing-user enrollment into the other portal and negative access tests.
7. Reconcile counts/checksums and financial/inventory/audit invariants, verify rollback, then perform the authorized production sequence and final agent-guidance review.

Nothing has been applied to a hosted database. `pnpm db:lint` and `pnpm db:test` are explicitly local commands; they do not validate staging or production by implication.
