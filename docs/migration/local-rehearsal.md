> Historical verification checkpoint before ADR 0002. Current independent-project evidence is recorded in `independent-project-verification.md`.

# Local baseline rehearsal — 2026-09-19

Only the disposable `supabase_db_building-suit-monorepo` database was written. API/DB/mail ports are 59321/59322/59324. Original projects and their local databases were not modified. This is a recovery rehearsal, not the target private-schema migration or a proof of hosted restore.

The recovery procedure is captured in `docs/migration/rehearse-shop-local.py`, which refuses existing function collisions and can address only the named local container.

1. The root's unchanged 66 Ledger migrations and seed initialized the local database. All 678 assertions in 27 pgTAP files passed.
2. The copied `apps/shop-suit/docs/readiness/shop_crm_schema_baseline.sql` recovery artifact was inspected. It contains an earlier, schema-only snapshot with no customer data and documents its own limitations. Function names and enum types were checked for collisions with the local Ledger baseline.
3. In one transaction, that snapshot and all nine unchanged `supabase/legacy/shop-suit/shop_crm_migrations` files were applied to the local database. The recovery artifact's outer COMMIT was delayed until after the nine migrations; no source SQL file was edited. PostgreSQL executed the whole transaction successfully.
4. A synthetic local `shop-crm` portal and Basic/Pro plan configuration were inserted. Public plan configuration was compared read-only with the Shop source project. No hosted users, customer records, payment data or credentials were copied.
5. The current owner-bootstrap, product, inventory, service and expense SQL suites executed with `ON_ERROR_STOP` and transaction rollback. All five passed. Their assertions cover permissions, quotas, atomic commands and relevant business invariants.

The older `shop_crm_read_isolation.sql` is a historical Task-03 check, superseded by later RPC/view changes. It reaches a service-role schema grant failure in this recovery snapshot and also expects all report views to be denied, whereas a later migration intentionally exposes the authorized inventory view. It is retained unchanged as evidence and is not included in the current `db:test:shop` runner. The legacy `db_smoke_test.sql` targets the retired public-schema product and is also excluded. Live grant/default-privilege reconciliation remains necessary before a hosted transfer.

`pnpm db:test:ledger` runs the 27 Ledger files. `pnpm db:test:shop` runs the five current Shop SQL suites against the fixed disposable container. `pnpm db:test` runs both. A fresh clone must initialize the respective baselines first; the Shop snapshot is deliberately not inserted into the automatic Ledger production migration chain.

The local apps still use Ledger `public` and Shop `shop_crm` contracts. Target private/API namespaces, unified hosted identity, Storage/Realtime/service transfer, and cross-origin SSO remain unverified and unapplied. Use the remote-prerequisite record to resume those finite work packages once access is available.

Ledger's copied pgTAP fixtures assume a pristine seed. Browser account/signup tests add disposable records; running those before SQL tests changes quota/count assumptions. The final SQL run used a fresh local reset before replaying Shop and before browser writes. No hosted reset was performed.
