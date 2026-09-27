# Inventory Suit V1 authoritative requirements

Source: the embedded original authoritative specification supplied for Inventory Suit continuation.

This file preserves the complete product, architecture, security, workflow, verification and acceptance specification through its Product Principle. Historical conversation-control sections (including the first-response and first-continue protocol) are retained as source record only; the accepted continuation state superseded them, and `IS-BASE-001` is already complete. Stable requirement IDs and substantive rules remain authoritative.

# 20. EMBEDDED ORIGINAL AUTHORITATIVE INVENTORY SUIT SPECIFICATION

The following is the original full authoritative Inventory Suit specification from the orchestration session.

Remember: its original first-response / first-continue orchestration instructions are historical and superseded by Sections 0–19 above. Its substantive product requirements, IDs, boundaries, Git safety rules, and acceptance philosophy remain authoritative.

---

You are the implementation orchestrator for **Inventory Suit**, the next standalone Building Suit product.

Your job is NOT to implement code yourself.

Your job is to control a long-running Codex implementation session against:

`Building-Suit/building-suit-monorepo`

Inventory Suit must follow the same evidence-driven workflow used for the existing Ledger Suit Accounting V2 and Shop Suit requirements implementations.

---

# 0. FIRST RESPONSE

The complete Inventory Suit requirements are embedded in this prompt.

Therefore your first response to this message must be exactly:

`Requirements received. Send \`continue\` to begin.\`

Do not add explanation.

After that, follow the orchestration protocol below.

---

# 1. ORCHESTRATION PROTOCOL

## Explicit `continue`

Each explicit user message containing:

`continue`

authorizes exactly **one** bounded Codex task.

Return exactly one copy-ready Codex implementation prompt for that task.

Do not batch multiple implementation tasks.

Do not skip ahead.

Choose the next task using:

1. requirement dependencies,
2. current repository evidence,
3. current Inventory Suit stack state,
4. unresolved decisions,
5. safety/integrity risk,
6. the canonical Inventory Suit tracker once it exists.

One task should be a coherent reviewable capability, not an arbitrary split by file.

Do not count scaffolding, empty tables, mock UI, unexecuted tests or placeholders as completed product behavior.

---

# 2. REVIEWING CODEX RESULTS

When the user pastes a Codex handoff/result without saying `continue`, review that result against:

- the assigned task;
- requirement IDs;
- repository state;
- acceptance criteria;
- actual verification evidence;
- branch/PR requirements;
- migration status;
- tracker status.

Return only one of:

`PASS`

`FIX REQUIRED`

`BLOCKED`

`NOT VERIFIED`

Do not automatically issue the next implementation task.

If the verdict is `FIX REQUIRED` or `BLOCKED`, the next explicit `continue` must remain on the same task and generate a correction/unblocking prompt rather than advancing.

Only a `PASS` permits the next `continue` to advance.

Never mark a requirement complete merely because code exists.

Completion requires evidence that the requested behavior is implemented and appropriately verified.

---

# 3. REPOSITORY AND GIT WORKFLOW

Repository:

`Building-Suit/building-suit-monorepo`

The authoritative integration branch is:

`stg`

Production release flow:

`stg -> main`

Do not use `main` as the development base.

Before every new or resumed task Codex must:

1. fetch/prune origin;
2. run `pnpm agent:preflight` when available;
3. inspect the current worktree;
4. inspect live GitHub PR state;
5. read the current `origin/stg` repository rules;
6. read applicable `AGENTS.md` files;
7. inspect the Inventory Suit stack specifically;
8. preserve unrelated worktrees and dirty files.

Inventory Suit uses an independent stack key:

`inventory-suit`

Branch namespace:

`codex/inventory-suit/*`

### Root rule

If Inventory Suit has no active root PR, the first Inventory implementation branch must be created from freshly verified:

`origin/stg`

Recommended initial root branch:

`codex/inventory-suit/requirements-v1`

That root Draft PR targets:

`stg`

### Child rule

Every subsequent Inventory task must:

- branch from the newest verified active Inventory Suit leaf;
- use a new `codex/inventory-suit/<task>` branch/worktree;
- open its PR against the immediately previous Inventory Suit branch;
- never target a Ledger or Shop branch.

Inventory work must NEVER be stacked onto:

`codex/ledger-suit/*`

or:

`codex/shop-suit/*`

Likewise, Ledger and Shop work must never be moved into the Inventory stack.

Run:

`pnpm agent:pr-check <PR-number>`

after opening or retargeting an Inventory PR.

Prefer merge commits while dependent Inventory children exist, but Codex is NOT authorized to merge.

---

# 4. REQUIRED GIT BEHAVIOR PER IMPLEMENTATION TASK

Except for the initial discovery-only baseline task defined later, every completed task must:

1. update the canonical Inventory Suit tracker;
2. make a coherent commit;
3. push the task branch;
4. open or update the correct Draft PR;
5. update Inventory root/stack metadata when needed so cumulative task status is visible;
6. report exact branch, parent branch, commit SHA and PR number.

Do NOT:

- merge a PR;
- deploy;
- push directly to `stg`;
- push directly to `main`;
- apply a hosted database migration;
- mutate production/staging business data;
- create paid provider resources;
- modify Ledger or Shop merely to integrate Inventory;
- force-push another task's branch;
- discard unrelated dirty work.

---

# 5. VERIFICATION POLICY

Use targeted verification by default.

Do NOT routinely run every broad suite after every small task.

Prefer:

- focused SQL tests;
- focused unit tests;
- focused type checking;
- changed-scope lint;
- focused Playwright/browser tests where UI behavior changed;
- relevant security/RLS scenarios;
- `git diff --check`.

Broader build/lint/typecheck/E2E/database suites are reserved for:

- milestones;
- shared-package changes with broad consumers;
- staging-root readiness;
- failures that indicate wider impact;
- explicit acceptance requirements.

Always distinguish:

- PASSING;
- FAILING;
- NOT RUN.

Never claim an unrun test passed.

---

# 6. MONOREPO ARCHITECTURE TO PRESERVE

Inventory Suit is a new first-class product inside the existing pnpm/Turbo/Nuxt monorepo.

Expected app slug:

`inventory-suit`

Expected package:

`@building-suit/inventory-suit`

Expected path:

`apps/inventory-suit`

Use the existing maintained platform generator where appropriate:

`pnpm new:platform inventory-suit "Inventory Suit"`

Always inspect with `--dry-run` first.

Do not invent a parallel framework.

The current ecosystem includes shared:

- Nuxt layer;
- Building Suit design tokens;
- brand package;
- UI package;
- UX/interaction controllers;
- auth infrastructure;
- data-access infrastructure;
- typed contracts;
- i18n infrastructure;
- testing infrastructure.

Apps may import shared packages.

Shared packages must never import an application.

One application must never import another application's internals.

Inventory-specific business rules, queries, RPCs and database contracts belong to Inventory Suit.

Shared capabilities should only move into shared packages when they are genuinely generic and have real consumers.

---

# 7. CURRENT REPOSITORY REGISTRATION GAP

Inventory Suit does not currently exist.

The current `stg` repository also has product lists/registries that know about Ledger Suit and Shop Suit but not Inventory Suit.

The baseline audit must inspect all such registration points before implementation.

At minimum inspect:

- root `package.json`;
- `tooling/new-platform/*`;
- `tooling/git/dev.mjs`;
- `tooling/git/dev-worktrees.mjs`;
- database CLI/preflight tooling;
- `docs/architecture/environments.json`;
- Supabase environment templates;
- workspace boundary checks;
- root DB/test scripts;
- Playwright/E2E configuration;
- CI workflows;
- Vercel/project configuration;
- documentation navigation;
- root README;
- agent guidance.

Do not assume this list is exhaustive.

The implementation must make Inventory Suit a first-class product rather than merely creating `apps/inventory-suit`.

A likely local development port family is the next non-conflicting range after existing Ledger and Shop ranges, but Codex must inspect the current repository before locking exact ports.

Do not invent hosted Supabase project refs.

Remote Inventory production/staging provisioning requires separate authorization.

---

# 8. PRODUCT DEFINITION

Inventory Suit is a standalone multi-tenant inventory and warehouse management SaaS.

Its purpose is to provide an authoritative system for:

- inventory item identities;
- warehouses and locations;
- physical stock;
- stock movement history;
- receipts;
- issues;
- transfers;
- reservations;
- lots/batches;
- serial numbers;
- expiration;
- physical counts;
- stock adjustments;
- stock availability;
- inventory valuation;
- replenishment;
- traceability;
- inventory reporting.

Inventory Suit must work completely without Shop Suit or Ledger Suit.

Future integration must remain optional and failure-tolerant.

---

# 9. DOMAIN OWNERSHIP

## Inventory Suit owns

- inventory-specific item master;
- internal SKU/barcodes;
- inventory units and conversions;
- warehouses;
- locations/bins/zones;
- physical quantities;
- stock movement history;
- lot/batch tracking;
- serial tracking;
- manufacture/best-before/expiry data;
- stock status;
- reservations;
- physical/cycle counts;
- adjustments;
- transfers/transit;
- operational cost layers;
- inventory valuation;
- replenishment policies/suggestions;
- stock reports;
- inventory audit trail.

## Shop Suit owns

- commercial product/service workflows;
- sales;
- customer workflows;
- supplier commercial workflows;
- purchase orders;
- commercial pricing;
- payments;
- POS/shop operations;
- standalone Shop stock when Inventory integration is disabled.

Do not implement Shop features inside Inventory Suit.

## Ledger Suit owns

- chart of accounts;
- GL;
- journal entries;
- account balances;
- accounting periods;
- financial statements;
- inventory control accounts;
- COGS accounts;
- formal accounting entries for write-downs/losses/revaluations.

Inventory Suit must not create a duplicate accounting ledger.

---

# 10. FUTURE SHOP + INVENTORY INTEGRATION INVARIANT

When integration is eventually enabled, exactly one application must own operational stock for a business.

Conceptually:

`Shop standalone -> Shop stock is authoritative`

`Shop + Inventory -> Inventory Suit stock is authoritative`

Never perform independently authoritative dual writes such as:

`Shop quantity -= X`

and separately:

`Inventory quantity -= X`

for the same business event.

Future Shop integration should use versioned commands/events, stable external IDs and idempotency.

Do not change Shop Suit as part of Inventory Suit V1 unless a future explicitly authorized integration task requires it.

---

# 11. FUTURE LEDGER INTEGRATION INVARIANT

Inventory Suit may calculate:

- inventory quantity;
- inventory unit cost;
- cost layers;
- movement cost;
- inventory valuation;
- write-down facts.

Inventory Suit does not decide or post GL journals.

Future integration emits reliable valuation/business events.

Ledger Suit determines accounting accounts and journals.

A future reconciliation can compare:

`Inventory Suit valuation`

against:

`Ledger Suit inventory control-account balance`

without either application importing the other's database or code.

---

# 12. CORE STOCK MODEL

The authoritative physical-stock source must be an append-only stock ledger.

Do not make a mutable `current_quantity` field the authoritative history.

A finalized stock operation creates immutable stock movement records/legs.

Balances may be cached/materialized for performance only when they are deterministic, auditable and rebuildable from the stock ledger.

Conceptually:

`stock document -> document lines -> stock movement -> movement legs -> derived balances`

Every movement must identify where quantity came from and where it went.

Examples:

Receipt:
`external -> receiving/internal`

Issue:
`internal -> external/consumption`

Internal move:
`location A -> location B`

Inter-warehouse shipment:
`warehouse A -> transit`

Inter-warehouse receipt:
`transit -> warehouse B`

Adjustment gain/loss:
`inventory variance virtual location <-> internal location`

This is a quantity-control ledger, NOT financial double-entry accounting.

---

# 13. STOCK QUANTITY DEFINITIONS

The product must explicitly distinguish at least:

`on_hand`

`pickable`

`reserved`

`available`

`incoming/expected`

where appropriate.

Core rule:

`available = pickable - active reservations`

Quarantined, damaged, expired or otherwise blocked stock must not silently count as pickable stock.

Reservations must not mutate physical `on_hand`.

All authoritative availability checks must happen server/database-side inside the write transaction.

---

# 14. CONCURRENCY AND IDEMPOTENCY

Inventory commands must be safe under concurrent use.

Two simultaneous users or integrations must never both consume the same final available unit.

Important writes must:

- be atomic;
- authorize tenant/user/capability server-side;
- validate same-tenant references;
- validate source/destination constraints;
- validate stock availability at commit time;
- use stable idempotency keys where retry is possible;
- prevent duplicate business effects;
- leave no partial side effects on failure.

The exact PostgreSQL locking strategy must be chosen from actual implementation constraints, but concurrency correctness is mandatory.

---

# 15. QUANTITY AND MONEY PRECISION

Do not use floating-point storage for inventory quantities or costs.

Use appropriate exact decimal/numeric representations.

Support fractional quantities.

UOM conversion must have explicit precision/rounding behavior.

The app must prevent silent rounding drift.

---

# 16. REQUIREMENTS — SCOPE

### SCOPE-01

Inventory Suit must function independently from every other Suit.

### SCOPE-02

Inventory Suit must be multi-tenant.

### SCOPE-03

Each Inventory tenant's data must be isolated through database authorization/RLS, not client filtering.

### SCOPE-04

Inventory Suit must have its own independent Supabase/Auth environment architecture.

### SCOPE-05

Inventory Suit must not read/write Ledger or Shop databases directly.

### SCOPE-06

Inventory Suit must not import Ledger or Shop application internals.

### SCOPE-07

Future cross-Suit integration must use explicit contracts/events/commands.

### SCOPE-08

Manufacturing/MRP is not part of V1.

### SCOPE-09

Sales/POS/customer invoicing is not part of V1.

### SCOPE-10

Full purchasing/AP is not part of V1.

### SCOPE-11

GL/accounting journals are not part of V1.

### SCOPE-12

Advanced forecasting/AI, robotics and RFID are not V1 blockers.

---

# 17. REQUIREMENTS — TENANT, IDENTITY AND AUTHORIZATION

### TEN-01

A user may belong only to tenants allowed by authoritative membership data.

### TEN-02

Every business record must be tenant-scoped.

### TEN-03

Cross-tenant references must fail server-side.

### TEN-04

Ownership/authority must never come from editable user metadata.

### TEN-05

The application must support organization/workspace onboarding.

### TEN-06

Membership state must support active and disabled/suspended access.

### TEN-07

Capabilities must be authoritative server-side.

### TEN-08

Warehouse-level scope must be possible in addition to tenant-wide roles.

### TEN-09

Session/account/tenant switching must clear sensitive cached state.

### TEN-10

Inventory Auth/cookies/project configuration must remain isolated from other Suits.

---

# 18. REQUIREMENTS — DEFAULT ROLE/CAPABILITY MODEL

The permission system must be capability-driven.

Default role templates may include:

- Owner;
- Inventory Admin;
- Inventory Manager;
- Warehouse Manager;
- Receiver;
- Issuer/Picker;
- Counter;
- Auditor/Viewer.

Capabilities must independently control actions such as:

- view inventory;
- manage items;
- manage warehouses;
- receive;
- issue;
- transfer;
- reserve;
- count;
- approve counts;
- adjust;
- approve adjustments;
- write off/scrap;
- release quarantine;
- backdate;
- manage cost configuration;
- manage inventory locks;
- view valuation;
- manage integrations;
- manage members/settings.

Role names must not substitute for authoritative capability checks.

---

# 19. REQUIREMENTS — ITEM MASTER

### ITEM-01

Inventory Suit must maintain its own inventory item master.

### ITEM-02

An item must have an immutable/stable internal identity independent of display name.

### ITEM-03

Support active/archive lifecycle.

### ITEM-04

Historical items with stock/movement history must not be destructively deleted.

### ITEM-05

Support English and Arabic names/descriptions.

### ITEM-06

Support internal SKU.

### ITEM-07

Support one or more barcode identifiers where valid.

### ITEM-08

Support item categories/grouping without coupling category to accounting.

### ITEM-09

Support optional brand/manufacturer/manufacturer-part-number metadata.

### ITEM-10

Support optional country-of-origin metadata.

### ITEM-11

Support optional customs/HS metadata for future trade/import use.

### ITEM-12

Each stock-tracked item must have a base UOM.

### ITEM-13

Each item must explicitly define its tracking mode.

### ITEM-14

Each item must define valuation method.

### ITEM-15

Each item/category/location may define operational picking/removal strategy separately from valuation method.

### ITEM-16

Unsafe structural settings such as tracking mode, base UOM and valuation method cannot silently reinterpret existing movement history.

---

# 20. REQUIREMENTS — UNITS OF MEASURE

### UOM-01

Support a canonical base UOM per item.

### UOM-02

Support alternate UOMs.

### UOM-03

Support deterministic conversion factors.

### UOM-04

Store authoritative quantities normalized to the base UOM while preserving transaction-entered UOM/quantity for audit.

### UOM-05

Conversions must use exact decimal arithmetic.

### UOM-06

Invalid cross-dimension conversions must be prevented.

### UOM-07

Conversion changes must not silently rewrite historical transactions.

### UOM-08

Support mapping an Inventory UOM to the relevant Egyptian ETA unit-type code when configured.

---

# 21. REQUIREMENTS — EGYPT / ETA ITEM CODING

Inventory Suit must be Egypt-ready without becoming Egypt-only.

### ETA-01

Support `GS1` and `EGS` item-code schemes as optional compliance metadata.

### ETA-02

Support ETA item code.

### ETA-03

Support internal SKU independently of ETA/GS1 code.

### ETA-04

Support GTIN/GS1 identifiers.

### ETA-05

Support optional GPC classification required by relevant EGS workflows.

### ETA-06

Support ETA UOM mapping.

### ETA-07

Do not make Egyptian tax-registration-specific metadata mandatory for tenants operating elsewhere.

### ETA-08

Inventory Suit does not calculate or file Egyptian tax documents merely because it stores item coding metadata.

### ETA-09

ETA/compliance metadata must be exportable through future integration contracts.

---

# 22. REQUIREMENTS — WAREHOUSES

### WH-01

Support multiple warehouses per tenant.

### WH-02

Warehouse identity must be stable.

### WH-03

Support warehouse code/name/address/timezone metadata.

### WH-04

Support warehouse active/archive state.

### WH-05

A warehouse containing stock/open operations cannot be silently deleted.

### WH-06

Authorization may be scoped to selected warehouses.

### WH-07

Warehouse status and configuration changes must preserve history.

---

# 23. REQUIREMENTS — LOCATIONS

### LOC-01

Warehouses must contain hierarchical locations.

### LOC-02

Locations must support parent/child hierarchy.

### LOC-03

Support internal storage locations such as zone/aisle/shelf/bin.

### LOC-04

Support receiving location.

### LOC-05

Support dispatch/picking/packing locations.

### LOC-06

Support returns location.

### LOC-07

Support quarantine location/status handling.

### LOC-08

Support damaged/scrap handling.

### LOC-09

Support transit locations for staged inter-warehouse movement.

### LOC-10

Support virtual/system locations for external stock movement and inventory variance.

### LOC-11

Locations containing stock cannot be removed or reparented in a way that silently changes historical location meaning.

### LOC-12

A location may define an operational removal strategy.

### LOC-13

A location may define cycle-count frequency.

### LOC-14

Location/barcode identification should be supported.

---

# 24. REQUIREMENTS — TRACKING

Each item has an explicit tracking mode.

At minimum support:

`none`

`lot`

`serial`

`expiry`

`lot_and_expiry`

### TRACK-01

Lot tracking must identify batch-level quantity.

### TRACK-02

Serial tracking must identify individual units.

### TRACK-03

Serial identity must be unique within an appropriate tenant/item scope.

### TRACK-04

A serialized unit cannot simultaneously exist in two owned locations.

### TRACK-05

Lot records may include internal lot and manufacturer lot identifiers.

### TRACK-06

Track receipt date where relevant.

### TRACK-07

Track manufacture date where provided.

### TRACK-08

Track best-before date where provided.

### TRACK-09

Track expiry date where provided.

### TRACK-10

Track removal/alert date where configured.

### TRACK-11

Expired stock must not silently remain pickable when policy blocks it.

### TRACK-12

Support end-to-end lot/serial movement history.

### TRACK-13

Support traceability suitable for recall investigation.

### TRACK-14

Finalized historical lot/serial assignments must not be destructively rewritten.

---

# 25. REQUIREMENTS — OPERATIONAL REMOVAL STRATEGIES

V1 must distinguish physical selection from accounting valuation.

Support at least:

- manual;
- FIFO picking;
- FEFO;
- closest/location-priority where repository design permits.

Do not implement LIFO as an accounting valuation method.

FEFO must use expiry/removal metadata.

A picking strategy is not a cost formula.

---

# 26. REQUIREMENTS — STOCK DOCUMENTS AND MOVEMENTS

### MOV-01

Every finalized stock-changing operation must create an immutable document/reference and movement history.

### MOV-02

Movements must be tenant-scoped.

### MOV-03

Each movement must identify item, quantity, UOM normalization and source/destination.

### MOV-04

Lot/serial dimensions must be included when required.

### MOV-05

Movements must retain business source/reference metadata.

### MOV-06

Finalized movements cannot be destructively edited.

### MOV-07

Corrections must use reversal/compensating movements plus corrected replacement when appropriate.

### MOV-08

A reversal must retain explicit relationship to the original movement.

### MOV-09

Movement commands must be atomic.

### MOV-10

Retries must be idempotent.

### MOV-11

Movement sequence/order must be deterministic.

### MOV-12

Store created timestamp.

### MOV-13

Store effective/business timestamp.

### MOV-14

Store finalized/posting timestamp.

### MOV-15

Store actor/source metadata.

### MOV-16

Store reason/reference where appropriate.

### MOV-17

Current balances must be reconstructable from finalized ledger history.

### MOV-18

Derived balance projections must be reconcilable against the immutable ledger.

---

# 27. REQUIREMENTS — NEGATIVE STOCK

### NEG-01

Negative available stock is blocked by default.

### NEG-02

Finalization must revalidate availability server-side.

### NEG-03

Serialised and lot-controlled inventory must never become logically negative through normal issue/reservation commands.

### NEG-04

Any future negative-stock exception would require an explicit product decision and separate authorization; it must not be silently introduced.

---

# 28. REQUIREMENTS — RECEIPTS / إذن إضافة

### RECV-01

Support manual warehouse receipt documents independently of Purchase.

### RECV-02

A receipt may reference an external supplier/purchase/source document without owning that commercial document.

### RECV-03

Support partial receipt.

### RECV-04

Require lot/serial/expiry data according to item tracking configuration.

### RECV-05

Support received UOM and normalize to base UOM.

### RECV-06

Capture unit cost required for valuation where appropriate.

### RECV-07

Finalizing a receipt creates immutable stock movement/cost effects atomically.

### RECV-08

Receipt retries must not duplicate inventory.

### RECV-09

Rejected/failing receipts must leave no partial stock/cost effects.

### RECV-10

Finalized receipt correction uses reversal/corrective flows rather than destructive mutation.

---

# 29. REQUIREMENTS — ISSUES / إذن صرف

### ISSUE-01

Support manual warehouse issue independently of Sales.

### ISSUE-02

An issue may reference an external sale/consumption/source document.

### ISSUE-03

Require location and tracking dimensions as appropriate.

### ISSUE-04

Server-side finalization must validate pickable/available quantity.

### ISSUE-05

Support partial issue.

### ISSUE-06

Finalization creates stock and valuation effects atomically.

### ISSUE-07

Retries must not duplicate consumption.

### ISSUE-08

Failure must not leave partial stock/cost effects.

### ISSUE-09

Correction uses reversal/corrective movement.

### ISSUE-10

Cost calculation must use the item's configured valuation method.

---

# 30. REQUIREMENTS — TRANSFERS

### TRF-01

Support location-to-location transfer inside one warehouse.

### TRF-02

Support warehouse-to-warehouse transfer.

### TRF-03

Support direct transfer where business policy permits.

### TRF-04

Support shipped/in-transit/received flow.

### TRF-05

Support partial receipt.

### TRF-06

Support tracked lots/serials through transfer.

### TRF-07

Internal movement must preserve organizational ownership.

### TRF-08

Internal transfer must not create revenue/expense/accounting activity by itself.

### TRF-09

In-transit quantity must remain visible and traceable.

### TRF-10

Transfer shortage/damage requires explicit disposition, not silent disappearance.

### TRF-11

Retries and partial receipts must be idempotent.

### TRF-12

Finalized transfers are corrected through explicit movement history.

---

# 31. REQUIREMENTS — RESERVATIONS

### RES-01

Reservations must be first-class records.

### RES-02

Reservation must not change physical on-hand.

### RES-03

Active reservation decreases available quantity.

### RES-04

Support reservation release.

### RES-05

Support reservation consumption.

### RES-06

Support reservation expiry/cancellation where configured.

### RES-07

Reservations may reference an external Shop/order/source record.

### RES-08

Server-side reservation must validate availability atomically.

### RES-09

Concurrent requests cannot over-reserve the same stock.

### RES-10

Reservation retries must be idempotent.

### RES-11

Lot/serial-specific reservation must be possible where required.

### RES-12

Reservation history must remain auditable.

---

# 32. REQUIREMENTS — STOCK STATUS / QUALITY HOLD

V1 is not a full Quality Management System.

It must still support basic stock usability state.

At minimum model behavior equivalent to:

- available/released;
- quarantine/hold;
- damaged;
- expired;
- blocked;
- scrap/disposed where applicable.

### STATUS-01

Non-pickable status must be excluded from available inventory.

### STATUS-02

Status changes require authorization and audit.

### STATUS-03

Status transitions must not silently alter quantity.

### STATUS-04

Movement/status history must remain traceable.

### STATUS-05

Release from quarantine must be separately permissioned.

---

# 33. REQUIREMENTS — PHYSICAL INVENTORY / الجرد

### COUNT-01

Support full physical count.

### COUNT-02

Support cycle counts.

### COUNT-03

Count scope may be warehouse, location, item subset or appropriate combination.

### COUNT-04

Support count assignments.

### COUNT-05

Support scheduled count date/time.

### COUNT-06

Support blind count where expected quantity is hidden.

### COUNT-07

Expected-quantity visibility must be permission/policy controlled.

### COUNT-08

Support barcode-assisted entry.

### COUNT-09

Support lot/serial/expiry-aware counting.

### COUNT-10

Support multiple count passes/recount.

### COUNT-11

Count session must establish an auditable snapshot/cutoff basis.

### COUNT-12

Movements occurring during the count must not silently invalidate variance calculation.

### COUNT-13

Support draft/in-progress/submitted/review/approved/applied/closed lifecycle or equivalent evidence-backed state machine.

### COUNT-14

Applying an approved variance must create explicit stock adjustment movements.

### COUNT-15

Count variance must have reason/audit data.

### COUNT-16

Count sessions and finalized adjustments cannot be destructively erased.

### COUNT-17

Location-level cycle count frequency must be supported.

---

# 34. REQUIREMENTS — ADJUSTMENTS, WRITE-OFF AND SCRAP

### ADJ-01

Stock adjustment must be a controlled document, not direct balance editing.

### ADJ-02

Adjustment requires reason code.

### ADJ-03

Support gain and loss.

### ADJ-04

Support damaged/write-off/scrap disposition.

### ADJ-05

Approval may be required based on capability/policy/threshold.

### ADJ-06

Finalization creates immutable movement history.

### ADJ-07

Adjustment retries must be idempotent.

### ADJ-08

Adjustment failure leaves no partial effects.

### ADJ-09

Finalized adjustment corrections use reversal/corrective entries.

### ADJ-10

Valuation impact must remain traceable for future Ledger integration.

---

# 35. REQUIREMENTS — VALUATION METHODS

V1 valuation methods:

- FIFO;
- weighted/moving average;
- specific identification.

Do not expose LIFO as a V1 accounting valuation method.

### COST-01

Valuation method is explicitly configured.

### COST-02

Valuation method must not be confused with warehouse removal strategy.

### COST-03

FIFO must maintain deterministic cost-layer consumption.

### COST-04

Weighted/moving-average calculations must use exact numeric arithmetic.

### COST-05

Specific identification must support individually identifiable inventory.

### COST-06

Receipt creates appropriate valuation/cost layer effects.

### COST-07

Issue consumes/calculates appropriate inventory cost.

### COST-08

Internal transfer must not invent or lose inventory value.

### COST-09

Partial transfer/receipt preserves traceable value.

### COST-10

Cost adjustments must be explicit and auditable.

### COST-11

Changing valuation method after stock history exists requires controlled policy/migration and cannot be casual UI editing.

### COST-12

Historical valuation must be reproducible.

### COST-13

Inventory valuation at a past effective date must be supportable.

### COST-14

Quantity and monetary rounding behavior must be deterministic.

### COST-15

Cost layers/valuation records must remain tenant-isolated.

### COST-16

Inventory valuation logic must not post Ledger journals.

---

# 36. REQUIREMENTS — EAS/IAS-COMPATIBLE VALUATION FACTS

Inventory Suit must support operational facts needed for appropriate inventory accounting.

### NRV-01

Support recording inventory NRV/write-down assessment facts.

### NRV-02

Support quantity/value affected, reason, effective date and evidence/reference.

### NRV-03

Write-down/reversal facts must remain auditable.

### NRV-04

Inventory Suit must not invent financial-account mappings.

### NRV-05

Future Ledger integration will determine the formal accounting journal.

### NRV-06

Accountant approval/UAT is required before claiming final Egyptian statutory accounting acceptance.

---

# 37. REQUIREMENTS — BACKDATED MOVEMENTS AND INVENTORY LOCKS

### LOCK-01

Every finalized movement has a clear effective timestamp.

### LOCK-02

Backdated movement permission must be explicit.

### LOCK-03

Support an Inventory lock date/period concept protecting closed history.

### LOCK-04

A user without override authority cannot insert stock movements into locked history.

### LOCK-05

Authorized backdated changes must trigger deterministic affected valuation recomputation where required.

### LOCK-06

Recomputation must never silently alter source business quantities/documents.

### LOCK-07

Recomputed valuation changes must remain auditable.

### LOCK-08

A failed recomputation cannot leave partially updated cost state.

### LOCK-09

Inventory operational lock does not replace Ledger accounting-period ownership.

---

# 38. REQUIREMENTS — REPLENISHMENT

Inventory Suit V1 owns replenishment policy and suggestions, not supplier purchase orders.

### REP-01

Support reorder point/minimum.

### REP-02

Support target/maximum.

### REP-03

Support configurable reorder quantity/multiple where required.

### REP-04

Support lead-time metadata.

### REP-05

Support optional safety stock.

### REP-06

Replenishment evaluates appropriate available/projected stock.

### REP-07

Generate reviewable replenishment suggestions.

### REP-08

Suggestion must explain why quantity is recommended.

### REP-09

Do not silently create Shop/Purchase commercial records.

### REP-10

Future integration may emit a purchase/replenishment request externally.

---

# 39. REQUIREMENTS — OPENING INVENTORY

### OPEN-01

Opening stock must not be implemented by directly setting current balances.

### OPEN-02

Opening stock creates explicit opening inventory movement history.

### OPEN-03

Opening stock captures quantity/location/tracking dimensions.

### OPEN-04

Opening stock captures required initial cost/valuation information.

### OPEN-05

Opening import must validate tenant/item/location/UOM/tracking data before finalization.

### OPEN-06

Repeated import/finalization must not duplicate opening inventory.

### OPEN-07

Opening stock after ordinary inventory activity begins requires controlled policy and must not silently rewrite history.

---

# 40. REQUIREMENTS — IMPORT / EXPORT

### IMP-01

Support structured item import.

### IMP-02

Support opening inventory import.

### IMP-03

Support count import/export where appropriate.

### IMP-04

Validate complete file before creating partial business effects where practical.

### IMP-05

Provide row-level validation feedback.

### IMP-06

Do not silently create duplicate SKUs/barcodes/serials.

### IMP-07

Imports must respect tenant authorization.

### IMP-08

Import retries/finalization must be safe.

### IMP-09

Exports must respect permissions and tenant boundaries.

### IMP-10

Arabic and English text must round-trip correctly.

---

# 41. REQUIREMENTS — BARCODES / GS1

### BAR-01

Support ordinary internal barcode lookup.

### BAR-02

Support GTIN identifiers.

### BAR-03

Architecture must permit future GS1 Application Identifier parsing.

### BAR-04

Barcode-assisted receipts/issues/counts should work with common keyboard-wedge scanners.

### BAR-05

Lot/serial/expiry scans must resolve to explicit structured dimensions rather than opaque text where parsed.

### BAR-06

Duplicate barcode ambiguity must be prevented or surfaced.

### BAR-07

Advanced SSCC/logistics-unit management is not a V1 blocker but must not be architecturally impossible.

### BAR-08

Camera/PWA/offline scanning is deferred unless separately approved.

---

# 42. REQUIREMENTS — REPORTING

At minimum plan for:

### RPT-01

Current stock balance by item.

### RPT-02

Stock by warehouse/location.

### RPT-03

Stock card / Kardex movement history.

### RPT-04

Inventory valuation as of date.

### RPT-05

Lot/serial traceability.

### RPT-06

Expiry/near-expiry report.

### RPT-07

Inventory aging.

### RPT-08

Low/out-of-stock.

### RPT-09

Reserved vs available.

### RPT-10

In-transit stock.

### RPT-11

Physical count variance.

### RPT-12

Adjustment/write-off history.

### RPT-13

Replenishment needs.

### RPT-14

Slow/non-moving inventory where evidence supports the calculation.

### RPT-15

Reports must support tenant and warehouse authorization.

### RPT-16

Financial valuation reports must use authoritative valuation records, not client-side approximations.

---

# 43. REQUIREMENTS — DASHBOARD

Dashboard must be operationally useful without becoming a second reporting engine.

Candidate indicators include:

- inventory value;
- units/items on hand;
- low stock;
- out of stock;
- near expiry;
- quarantined/blocked stock;
- pending transfers;
- open counts;
- recent count variance;
- replenishment alerts.

Every number must come from authoritative queries and respect tenant/warehouse permissions.

Avoid vanity metrics with unclear meaning.

---

# 44. REQUIREMENTS — INTEGRATION ARCHITECTURE

### INT-01

Cross-Suit integration must be optional.

### INT-02

Core Inventory commands must work without external integrations.

### INT-03

Use stable external source identifiers.

### INT-04

Store source system/type/id/line references where relevant.

### INT-05

Inbound integration commands must be idempotent.

### INT-06

Outbound business events must use a transactional outbox or equivalently reliable local transaction pattern.

### INT-07

Do not mark an external delivery successful before reliable persistence.

### INT-08

Retry must not duplicate stock effects.

### INT-09

Integration failure must not corrupt core inventory.

### INT-10

Events/contracts must be versioned.

### INT-11

Do not share Supabase databases between Suits.

### INT-12

Do not link authorization merely by matching email addresses.

### INT-13

Future Shop integration must choose one stock source of truth.

### INT-14

Future Ledger integration consumes valuation/business events but owns journals.

---

# 45. REQUIREMENTS — AUDIT AND SECURITY

### SAFE-01

All critical writes must authorize server/database-side.

### SAFE-02

RLS must cover tenant-owned business tables.

### SAFE-03

Cross-tenant references must fail even if IDs are guessed.

### SAFE-04

Privileged SQL helpers must not be directly browser-executable unless explicitly designed as authorized public RPCs.

### SAFE-05

Use safe function search paths and qualified references.

### SAFE-06

Direct table writes must not bypass authoritative command invariants.

### SAFE-07

Finalized stock history must be immutable.

### SAFE-08

Sensitive corrections must use auditable reversal/correction flows.

### SAFE-09

Critical commands must be idempotent.

### SAFE-10

Critical commands must be failure-atomic.

### SAFE-11

Authorization must consider membership state and warehouse scope.

### SAFE-12

No client-selected role, tenant or warehouse context grants authority by itself.

### SAFE-13

Historical records referenced by movements cannot be destructively deleted.

### SAFE-14

Secrets must never enter browser bundles/source/logs.

### SAFE-15

Hosted production data must never be reset for tests.

### SAFE-16

Security verification must include same-tenant, cross-tenant, unauthorized and suspended-user scenarios.

---

# 46. REQUIREMENTS — UI / UX / LOCALIZATION

Inventory Suit must reuse the Building Suit design system.

Use:

- shared Building Suit tokens;
- PrimeVue through the shared UI system;
- `BsDataTable`;
- shared overlay/record-action controllers;
- shared authenticated shell;
- Manrope;
- IBM Plex Sans Arabic;
- Hugeicons Stroke Rounded.

### UI-01

Full English support.

### UI-02

Full Arabic support.

### UI-03

Correct LTR.

### UI-04

Correct RTL.

### UI-05

Light mode.

### UI-06

Dark mode.

### UI-07

Responsive desktop/tablet/mobile behavior.

### UI-08

Keyboard-accessible workflows.

### UI-09

Appropriate focus management.

### UI-10

Loading state.

### UI-11

Empty state.

### UI-12

Error state.

### UI-13

Permission-denied state.

### UI-14

Dirty-form protection.

### UI-15

Long warehouse/item tables must use shared table/query patterns rather than custom ad-hoc grids.

### UI-16

Actions should use modals/drawers/overlays consistently with shared Building Suit UX.

---

# 47. EGYPTIAN UX TERMINOLOGY

Arabic copy should use established inventory terminology where appropriate, for example:

Inventory:
`المخزون`

Warehouse:
`المخزن`

Warehouses:
`المخازن`

Warehouse Receipt / Stock Addition:
`إذن إضافة`

Warehouse Issue:
`إذن صرف`

Transfer:
`تحويل مخزني`

Physical Inventory:
`الجرد`

Inventory Adjustment:
`تسوية المخزون`

Batch/Lot:
`دفعة / تشغيلة` according to final terminology review

Serial Number:
`الرقم التسلسلي`

Expiry Date:
`تاريخ الانتهاء`

Do not mechanically translate technical copy when Egyptian business terminology has an established term.

Maintain one consistent glossary.

---

# 48. COMMERCIAL / SUBSCRIPTION REQUIREMENTS

Inventory Suit must be commercially independent.

However:

- plan names are NOT locked;
- prices are NOT locked;
- exact quotas are NOT locked.

Do not invent commercial values.

Architecture should allow configurable entitlements/quotas such as:

- users;
- warehouses;
- active SKUs;
- monthly operations;
- advanced traceability;
- integrations;
- reports.

Commercial entitlement checks must never replace authorization checks.

If subscriptions are not in the current implementation milestone, do not block core inventory architecture on guessed pricing.

---

# 49. REQUIREMENTS — NUMBERING / DOCUMENT IDENTITY

Operational documents such as:

- receipt;
- issue;
- transfer;
- adjustment;
- count;

need stable immutable internal IDs.

Human-readable references should also be supported.

Do not allow document-number reuse that makes audit history ambiguous.

If sequential numbering policy becomes legally/accountingly material and evidence is incomplete, create a stable decision ID rather than inventing policy.

---

# 50. REQUIREMENTS — ARCHIVING AND DELETION

Master/config records may be archived when appropriate.

Do not destructively delete:

- finalized stock documents;
- movements;
- movement legs;
- used lots/serials;
- cost history;
- applied counts;
- finalized adjustments;
- integration/audit references required to explain business history.

Historical references must remain understandable after related master records are archived.

---

# 51. REQUIREMENTS — SOURCE-OF-TRUTH RULES

The following are authoritative:

Physical quantity:
`finalized stock ledger`

Current balance:
`derived projection of finalized stock ledger`

Reservations:
`reservation domain records`

Available:
`authoritative stock projection minus active reservations/policy exclusions`

Valuation:
`authoritative cost/valuation ledger derived from finalized stock operations`

User authorization:
`server-side tenant membership/capabilities/warehouse scope`

The following are NOT authoritative:

- UI state;
- hidden buttons;
- client-computed balances;
- cached totals without reconciliation;
- another Suit's database;
- editable user metadata.

---

# 52. REQUIREMENTS — HISTORY AND CORRECTION

Finalized business history is append-only in meaning.

If a finalized receipt/issue/transfer/adjustment/count result is wrong:

1. preserve original record;
2. create explicit reversal/correction relationship;
3. produce compensating stock/value effects;
4. preserve actor/time/reason;
5. create corrected replacement when required.

Never implement “edit finalized record and recalculate everything silently”.

---

# 53. REQUIREMENTS — PERFORMANCE

Design for ordinary SME inventory scale first, while preventing obvious architectural dead ends.

### PERF-01

Balance lookup must not require scanning the entire stock ledger on every request.

### PERF-02

Use rebuildable balance/valuation projections or suitable indexed queries.

### PERF-03

Indexes must support common tenant/item/location/lot/serial/date queries.

### PERF-04

Pagination/filtering/sorting belongs server-side for large tables.

### PERF-05

No N+1 warehouse/item query patterns.

### PERF-06

Concurrency safety takes precedence over unsafe caching.

### PERF-07

Derived state must have reconciliation/rebuild strategy.

---

# 54. REQUIREMENTS — OBSERVABILITY AND RECONCILIATION

### VAL-01

Provide a way to reconcile stock balance projections to authoritative movement history.

### VAL-02

Provide a way to detect orphaned/invalid movement references.

### VAL-03

Provide a way to detect impossible serial state.

### VAL-04

Provide a way to detect negative/inconsistent derived availability.

### VAL-05

Provide a way to reconcile valuation totals to valuation/cost-layer history.

### VAL-06

Critical operations should carry correlation/source/idempotency information.

### VAL-07

Failures must be diagnosable without exposing secrets.

### VAL-08

Future cross-Suit reconciliation must be possible without shared databases.

---

# 55. PROPOSED PAGE SURFACE

Use this as product scope guidance, not a command to build all pages at once.

Potential routes:

`/dashboard`

`/items`
`/items/:id`

`/warehouses`
`/warehouses/:id`
`/locations`

`/stock`

`/receipts`
`/receipts/:id`

`/issues`
`/issues/:id`

`/transfers`
`/transfers/:id`

`/reservations`

`/lots`
`/serials`
`/expiry`

`/counts`
`/counts/:id`

`/adjustments`

`/replenishment`

`/reports/stock-balance`
`/reports/stock-card`
`/reports/valuation`
`/reports/aging`
`/reports/expiry`
`/reports/count-variance`
`/reports/movements`

`/settings`
`/settings/inventory`
`/settings/numbering`
`/settings/permissions`
`/settings/integrations`

Actual routes must follow current repository conventions discovered during implementation.

---

# 56. LIKELY DATA CONCEPTS

These are conceptual requirements, not mandatory premature table names.

Expect domain concepts equivalent to:

- organizations/tenants;
- profiles;
- memberships;
- roles/capabilities;
- items;
- item codes;
- units of measure;
- item/UOM conversions;
- warehouses;
- locations;
- lots;
- serial units;
- stock documents;
- stock document lines;
- stock movements;
- movement legs;
- derived stock balances;
- cost layers;
- valuation entries;
- reservations;
- physical count sessions;
- count lines/recounts;
- replenishment policies;
- inventory locks;
- external references;
- idempotency records;
- audit events;
- transactional outbox events.

Codex must choose concrete schema after inspecting repository standards.

Do not prematurely create unnecessary tables merely because they appear in this conceptual list.

---

# 57. DEFERRED FEATURES / OUT OF V1

Do not silently add:

- full MRP/manufacturing;
- BOM production;
- advanced demand forecasting;
- AI replenishment;
- RFID;
- robotics;
- full 3PL billing;
- transport/fleet management;
- sales/POS;
- AP;
- customer invoicing;
- full supplier purchasing;
- accounting journals;
- warranty management;
- loyalty;
- e-commerce;
- advanced offline warehouse application;
- camera scanning unless separately approved.

Basic architecture may preserve extension points.

Do not implement speculative abstractions solely for deferred features.

---

# 58. DECISION MANAGEMENT

Whenever a material requirement cannot be implemented safely without a product/accounting decision:

1. create a stable decision ID such as `IS-D01`;
2. state the exact question;
3. state why it blocks or affects requirements;
4. provide evidence/options without choosing policy for the user;
5. mark affected tasks blocked where necessary.

Do not silently invent:

- Egyptian accounting policy;
- sequential numbering policy;
- negative-stock exceptions;
- valuation-method migration rules;
- commercial pricing;
- subscription quotas;
- remote project refs;
- integration ownership changes;
- manufacturing behavior.

---

# 59. ACCOUNTING COMPLIANCE POSITION

Inventory Suit should be designed around Egypt-first operational usability and globally recognized inventory controls.

Do not claim that Egypt directly uses IFRS.

Treat Egyptian Accounting Standards as the local statutory accounting context.

Use IAS 2-compatible inventory concepts as an international baseline where they do not conflict with Egyptian requirements.

V1 valuation methods are locked to:

- FIFO;
- weighted/moving average;
- specific identification.

Inventory Suit must support lower-of-cost/NRV-related operational facts/reporting but Ledger remains the financial posting system.

Final claim of Egyptian statutory accounting compliance requires accountant review/UAT; implementation tests alone are not accountant acceptance.

---

# 60. FIRST CONTINUE — MANDATORY DISCOVERY-ONLY BASELINE

The first `continue` MUST produce a Codex prompt for:

`IS-BASE-001 — Inventory Suit repository and requirements baseline`

This task is discovery-only.

It is the one exception to the normal commit/push/Draft-PR requirement because the Inventory app does not yet exist and the maintained platform generator refuses to overwrite an existing target folder.

Codex must NOT:

- generate `apps/inventory-suit`;
- change runtime code;
- create migrations;
- modify schema;
- create a feature branch for implementation;
- push;
- create a PR;
- deploy.

Codex MAY run read-only/dry-run commands such as:

`pnpm new:platform inventory-suit "Inventory Suit" --dry-run`

when dependencies/current checkout make it appropriate.

The baseline must inspect at least:

- current `origin/stg`;
- root `AGENTS.md`;
- applicable scoped `AGENTS.md`;
- README;
- architecture docs;
- Git workflow;
- `docs/agent-workflows.md`;
- open Ledger/Shop/staging PR state;
- current worktrees;
- platform generator;
- app manifests;
- shared packages;
- UI/UX patterns;
- auth infrastructure;
- Supabase architecture;
- database tooling;
- local environment registry;
- tests;
- E2E config;
- CI;
- workspace boundary checks;
- Ledger accounting boundaries;
- Shop inventory overlap;
- current Shop stock behavior;
- current Ledger inventory-related concepts;
- documentation structure.

It must classify every requirement group and relevant requirement ID as:

- IMPLEMENTED;
- PARTIALLY IMPLEMENTED;
- MISSING;
- UNVERIFIED;
- BLOCKED BY DECISION;

with repository evidence.

Shared infrastructure can count as existing shared capability, but must not be misreported as working Inventory Suit behavior.

It must identify:

- reusable shared capabilities;
- current hard-coded two-product assumptions;
- required first-class platform registration changes;
- Inventory/Shop overlap risks;
- Inventory/Ledger accounting-boundary risks;
- security risks;
- data-model risks;
- unresolved decisions;
- dependency-ordered implementation sequence.

It must propose the exact next task.

Do not implement that next task yet.

The handoff must contain enough detail for the orchestrator to issue `IS-BOOT-001` without repeating discovery.

---

# 61. CANONICAL TRACKER AFTER BOOTSTRAP

Once `apps/inventory-suit` exists, create and maintain:

`apps/inventory-suit/docs/readiness/requirements-v1.md`

and:

`apps/inventory-suit/docs/readiness/tasks.md`

and, when decisions exist:

`apps/inventory-suit/docs/readiness/decisions.md`

The requirements document preserves the authoritative Inventory Suit requirements.

The task tracker must include:

- every stable requirement ID;
- current status;
- implementation evidence;
- test evidence;
- dependency/blocker;
- relevant decision;
- verification history;
- owning task;
- exact next task.

Never remove a requirement to make progress look better.

Never mark it done because a table/component exists.

---

# 62. EXPECTED INITIAL TASK SEQUENCE

The baseline may refine boundaries based on actual repository evidence, but it must preserve full requirement coverage.

Expected dependency direction:

`IS-BASE-001`
Discovery-only baseline

`IS-BOOT-001`
Inventory app scaffold + first-class monorepo/product registration + canonical docs/tracker + Inventory stack root Draft PR

`IS-TEN-001`
Tenant/auth/membership/RLS foundation

`IS-ITEM-001`
Item/UOM/coding foundation

`IS-WH-001`
Warehouse/location model

`IS-STOCK-001`
Immutable stock movement/balance engine

`IS-TRACK-001`
Lot/serial/expiry traceability

`IS-RECV-001`
Warehouse receipts

`IS-ISSUE-001`
Warehouse issues

`IS-TRF-001`
Direct/transit transfers

`IS-RES-001`
Reservations and authoritative available stock

`IS-COUNT-001`
Physical/cycle counting

`IS-ADJ-001`
Adjustments/quarantine/write-off

`IS-COST-001`
FIFO/weighted-average/specific-identification valuation

`IS-LOCK-001`
Backdating, locks and deterministic valuation recomputation

`IS-REP-001`
Replenishment policies/suggestions

`IS-RPT-001`
Inventory reporting

`IS-IMP-001`
Imports/opening inventory

`IS-INT-001`
Integration contracts/transactional outbox

`IS-SAFE-001`
Cross-cutting tenant/reference/command/security hardening

`IS-VER-001`
Bilingual/browser/invariant acceptance milestone

Do not blindly execute this list.

At every step choose the next unblocked dependency-correct task from repository evidence and the tracker.

---

# 63. IS-BOOT-001 EXPECTED PURPOSE

The first implementation task after baseline should normally establish Inventory Suit as a genuine first-class monorepo app.

It should likely include only the coherent platform foundation needed to make subsequent Inventory development possible, such as:

- generate the maintained app scaffold;
- package registration;
- shared Nuxt/design/i18n shell;
- scoped `AGENTS.md`;
- Inventory readiness docs/tracker;
- root development script;
- Inventory registration in worktree/dev selection;
- relevant workspace boundary checks;
- local app/environment skeleton;
- safe Supabase CLI root/config skeleton where appropriate;
- local test/build integration;
- documentation updates;
- independent Inventory stack root branch/PR.

Do not provision hosted production/staging projects merely to finish this task.

Do not build stock features in the platform-scaffold task.

---

# 64. CODEX TASK PROMPT TEMPLATE

Every Codex prompt generated after the baseline should explicitly include:

## Task identity

- stable task ID;
- title;
- owning Suit;
- requirement IDs.

## Current Git state

- expected Inventory parent PR/branch;
- expected parent SHA when known;
- required new branch;
- required worktree;
- required PR base.

Codex must re-verify these live before editing.

## Objective

One bounded end-to-end capability.

## Requirements

Quote or accurately restate only the requirement IDs needed for the task.

## Required discovery

Tell Codex which existing files/contracts/schema/tests must be inspected before editing.

## Invariants

Include the relevant stock, tenant, accounting, history, idempotency and integration invariants.

## Scope

Explicitly say what to implement.

## Non-scope

Explicitly say what not to implement.

## Database behavior

When relevant:

- migration rules;
- RLS;
- grants;
- RPC authorization;
- atomicity;
- idempotency;
- same-tenant validation;
- no hosted application.

## Acceptance criteria

Observable behavior, not vague code-completion language.

## Verification

Only targeted tests required for this capability, plus relevant regression tests and `git diff --check`.

## Tracker

Update requirement/task evidence accurately.

## Git/PR

Commit, push, open/update correct Draft PR, run PR check, synchronize cumulative Inventory stack/root metadata.

## Handback

Require exact evidence.

## Stop

Stop after this task. Do not start the next task.

---

# 65. REQUIRED CODEX HANDBACK FORMAT

Every implementation handoff must report:

1. Task ID and verdict.
2. Requirement IDs addressed.
3. Inventory parent PR/branch.
4. Parent SHA actually used.
5. New branch.
6. Worktree path.
7. Final commit SHA.
8. PR number and base/head.
9. Files changed.
10. Database objects/migrations changed.
11. Whether migration was applied locally.
12. Whether any hosted database was touched.
13. Exact verification commands.
14. Exact pass/fail/unrun results.
15. Security/invariant scenarios verified.
16. Tracker requirements changed and new statuses.
17. Decisions/blockers.
18. Known remaining scope.
19. Explicit statement of non-actions:

- no merge;
- no deploy;
- no remote migration;
- no unauthorized provider changes.

20. Exact recommended next unblocked task, without implementing it.

---

# 66. ACCEPTANCE PHILOSOPHY

A task is not complete because:

- files compile;
- a page renders;
- a table exists;
- an RPC exists;
- a migration exists;
- tests were written but not executed;
- a button is hidden;
- a value appears correct once.

Acceptance must prove relevant behavior such as:

- successful authorized path;
- unauthorized denial;
- cross-tenant denial;
- suspended-user denial where relevant;
- same-tenant cross-warehouse/reference validation;
- idempotent retry;
- failure atomicity;
- concurrency correctness where applicable;
- refresh/reload persistence;
- English/LTR;
- Arabic/RTL where UI changed;
- dark/light where UI changed;
- correction/reversal behavior where finalized history exists;
- no unintended impact on Ledger/Shop/shared consumers.

---

# 67. PRODUCT PRINCIPLE

Inventory Suit should be easy enough for an Egyptian small/medium business to operate but internally rigorous enough to become the Inventory module of a larger Building Suit ERP later.

Do not sacrifice:

- auditability;
- stock correctness;
- tenant isolation;
- idempotency;
- traceability;
- valuation reproducibility;

for superficial implementation speed.

At the same time, do not turn V1 into SAP.

Implement one coherent capability at a time.

---
