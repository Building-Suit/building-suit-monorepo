# Task-by-task delivery

Complete, verify, document, and locally commit each task before starting the next.
Large rows below may be split into smaller commits/tasks as evidence warrants.
No GitHub push, frontend deployment, or local Supabase instance.

| Task | Status | Work | Acceptance criteria |
|---|---|---|---|
| 01 — Audit and documentation | Complete | Compare source, hosted metadata, Ledger plans; capture baseline | Evidence saved, failures recorded, ordered backlog committed locally |
| 02 — Database target and contract | Complete; transferred to dedicated projects | Preserve the historical `shop_crm` baseline, then maintain the dedicated-project `public` migration chain | Dedicated production/staging refs and app-owned migration history documented; final restore/cutover drill belongs to Task 13 |
| 03 — Tenant and permission foundation | Read boundary and Data API exposure complete; write constraints pending | Replace recursive read policies, narrow grants, protect views, repair period triggers; expose only after security review | Rollback isolation fixtures and catalog checks pass; same-shop write constraints remain |
| 04 — Supabase-client-only app | Partial: shell, pricing, shop selection, dashboard, Products, Services, Inventory, Purchases and Expenses repaired; missing feature pages pending | Use the Supabase Client against the dedicated `public` contract and replace legacy page contracts/types | Build and typecheck pass; authenticated browser journeys remain pending |
| 05 — Auth and shop onboarding | Partial: first-shop RPC and login routing verified; full browser journey pending | Signup, confirmation, reset, profile provisioning, atomic owner/shop setup, logout/cache reset | Rollback fixture and live setup transaction pass; email/reset and full owner journey remain to verify |
| 06 — Plans and access | Pending | Confirm Shop commercial matrix; catalog/trial/access/usage foundation; offline activation boundary | Database prevents self-upgrades and expired writes; history readable; preview unpurchasable |
| 07 — Employees and seats | Pending | Shareable invitation tokens, acceptance, roles, suspension, owner protection, seat quota | Email-bound single-use acceptance; parallel invites respect quota; employee escalation denied |
| 08 — Catalog and counterparties | Partial: owner products/services and supplier creation for purchases work; customers and complete vendor management pending | Align products/services/customers/vendors; archive/search; quotas | Product/service fixtures and supplier selection pass; remaining catalogs and browser journeys pending |
| 09 — Purchases and inventory | Partial: Task 09a manual Pro stock and Task 09b supplier posting complete | Atomic supplier posting, FIFO batches, stock adjustments/write-offs | Hosted supplier fixture passes; sale integration and authenticated browser journey remain pending |
| 10 — Sales and payments | Pending | Atomic issue, invoice numbering, discounts, receipt printing, payment balances, reversals | Totals reconcile; unauthorized item edits denied; posting/quota retries safe |
| 11 — Expenses and reports | Partial: paid expenses, categories and voiding; reports and other income pending | Categories, expenses, cash flow, profit/COGS, date filters, CSV export | Expense fixture passes; report totals and exports remain pending |
| 12 — Shop-owner usability | Pending | Activate navigation; Arabic/English/RTL/mobile flows; loading/empty/error states | Owner and employee complete daily workflows without technical instructions |
| 13 — Release qualification | Pending | Cloud migration verification, browser journeys, operations guide, restore procedure, honest marketing | All preceding acceptance criteria pass; local release commit; no claimed unsupported features |

## Per-task record template

Record the task ID, behavior changed, database objects affected, cloud migration
version (if any), exact verification commands/results, known limitations, and next
task. Update capability status only when the workflow is verified. Never mark a
failed or unrun check as passing.

## Release journeys

1. Owner signs up, confirms email, creates one shop and receives the documented trial.
2. Owner adds products/services and records a purchase; stock and FIFO cost agree.
3. Owner invites an employee within the seat limit; employee accepts and sees only
   allowed operations for that shop.
4. Employee sells stock/services, records payment and prints a receipt; duplicate
   clicks do not duplicate sales, payments, stock deductions, or quota usage.
5. Owner records an expense and verifies daily cash/profit reports and export totals.
6. Owner suspends the employee; further access is denied even from an open session.
7. Trial expires: permitted history remains readable and new writes fail in Postgres.
8. Operator records offline payment and activates the chosen plan through the
   documented privileged Supabase procedure; the customer cannot grant this access.
9. Two independent shops cannot read, reference, update, or export each other's data.
10. Quota boundaries remain correct under concurrent writes, reactivation and downgrade.

Run fixture-based database tests only in an identified safe cloud test scope with
rollback/cleanup. The current Docker-oriented smoke test is not suitable for
unmodified execution in the shared cloud project.

The historical Task 03/04c records describe the old shared `shop_crm` source.
Current development targets the dedicated Shop projects and `public` schema.
Task 09b supplier posting passed its rollback-only Staging fixture; authenticated
owner/employee browser journeys remain unverified. The next bounded step is
sales. Do not grant direct browser writes as a shortcut: each later write
workflow needs its own same-shop, permission, subscription and concurrency checks.
