# SS-ELECTRICAL-001 requirements

The owner-supplied implementation brief is retained verbatim below. Its staged implementation order and definition of done apply. TASKS.md is the initiative status authority, linked from the existing Shop tracker. Nothing in this requirements document establishes implementation or release status.

# CODEX MASTER IMPLEMENTATION PROMPT
# Shop Suit — Electrical Supply Store Support, Measurement Engine, Release Reconciliation, Task Tracking, and Complete Implementation

## ROLE AND PRIMARY OBJECTIVE

You are acting as a Principal Software Architect, Senior Full-Stack Engineer, PostgreSQL/Supabase Database Engineer, Retail POS Domain Expert, QA Automation Engineer, and Technical Product Lead working inside the **Building Suit monorepo**.

**Repository:** `Building-Suit/building-suit-monorepo`

**Target application:** `apps/shop-suit`

**Primary integration branch:** `stg`

**Technology:** Use the actual current repository architecture, dependencies, contracts, tooling, and existing implementation. Do not substitute a different framework, database, UI architecture, or application design.

Your assignment is to extend **Shop Suit** into a robust, production-quality retail and wholesale management system suitable for:

- Electrical supply stores.
- Electrical cable and wire retailers.
- Electrical wholesalers and distributors.
- Electrical installation material suppliers.
- Hardware stores.
- Plumbing and construction-material stores.
- Merchants selling by piece, length, weight, volume, area, or packaging.
- Businesses that purchase stock in one unit and sell it in another.

The main goal is **not to build a separate application for electrical stores**.

Instead, extend Shop Suit's existing product, inventory, purchasing, sales, POS, pricing, and reporting foundations with a reusable **Units of Measure, Packaging, and Variable-Quantity Inventory Engine**.

The solution must preserve all existing Shop Suit capabilities, maintain backwards compatibility, and avoid introducing electrical-industry-specific restrictions on unrelated businesses.

A normal retail store selling items individually must continue behaving exactly as it did before these changes.

---

# MANDATORY EXECUTION ORDER

You must execute the work in the following order:

**Step 1 — Repository and architecture audit.**

Inspect the real current implementation, the active branch, pending worktrees/PRs, deployed schema history, product contracts, and relevant tests.

**Step 2 — Existing changelog release reconciliation.**

Before beginning Electrical Supply Store feature implementation, investigate the existing `Coming Soon` changelog entries on staging and determine which features are already released.

For entries that have genuinely shipped, reconcile them into `Released` using the repository's supported versioned release-publication workflow.

**Step 3 — Establish detailed task tracking.**

Create an implementation tracker with task IDs, dependencies, priorities, current status, acceptance criteria, tests, and evidence.

**Step 4 — Prepare the Electrical Supply Store changelog.**

Prepare a new bilingual changelog announcement for this initiative, using the correct existing release-publication architecture. Do not falsely claim that unfinished functionality is available.

**Step 5 — Implement all required features incrementally.**

Begin actual source-code implementation, database migrations, frontend integration, tests, and verification immediately after completing the preceding steps.

**Step 6 — Track every completed task.**

Update the tracker and changelog evidence as implementation progresses.

**Step 7 — Deliver verified, reviewable work.**

Use the repository's existing feature-branch, PR, migration, and deployment policies. Do not bypass security checks or fabricate evidence.

**IMPORTANT: Do not stop at research, planning, architecture diagrams, or task creation. Start implementing the real features in this execution. Continue through the ordered backlog as far as the available execution environment and authorized repository workflow permit.**

If an external deployment or approval gate is blocked, record the blocker precisely and continue with independent local implementation tasks wherever safe.

---

# PART 1 — REPOSITORY AUDIT AND SAFETY

## 1.1 Mandatory preliminary reading

Before modifying anything, read:

- `AGENTS.md`
- `apps/shop-suit/AGENTS.md`
- `apps/shop-suit/supabase/AGENTS.md`
- `packages/ui/AGENTS.md`
- `README.md`
- `apps/shop-suit/README.md`
- `docs/agent-workflows.md`
- `docs/shared/git-workflow.md`
- `docs/shared/database.md`
- `docs/shared/changelog-versioning.md`
- `docs/shared/release-publication-runbook.md`
- `docs/shared/changelog-history-audit.md`
- `docs/shared/retrospective-shop-history.md`
- `apps/shop-suit/docs/readiness/README.md`
- `apps/shop-suit/docs/readiness/tasks.md`
- `apps/shop-suit/docs/SS-VAL-001-verification.md`

Also inspect relevant current architecture decisions, environment registry, UI ownership manifests, and existing release tooling.

Historical documentation is supporting context, not automatically authoritative current implementation.

## 1.2 Git and worktree verification

Run:

```bash
pnpm agent:preflight
```

Inspect:

- Current checkout branch.
- Current HEAD and upstream.
- Latest `origin/stg` and `origin/main`.
- Pending GitHub PRs.
- Existing Shop Suit feature stacks.
- Active worktrees and dirty files.
- Recently merged PRs.
- Staging and production deployment status where available.
- Relevant current migrations and CI results.

Follow the existing `codex/shop-suit/*` feature-stack rules.

Do not commit directly to `stg` or `main`.

Do not reset, stash, delete, overwrite, or rewrite another task's work.

Do not assume an older feature branch is active simply because it still exists locally.

If a same-stack parent PR exists, base new work on the appropriate verified committed parent as defined by the repository's workflow.

Keep changes reviewable, with focused commits and PRs where authorized.

Never use a production database to trial destructive schema changes.

## 1.3 Audit the existing capabilities

Inspect the actual implementation of:

### Products and catalog

- Product creation and editing.
- Product archival.
- SKU and barcode uniqueness.
- Categories.
- Catalog imports.
- Product suppliers.
- Product images.
- Product quotas.
- Website catalog integration.
- Product bundles and offers.

### Inventory

- Inventory batches.
- FIFO costing.
- Inventory movements.
- Manual stock adjustments.
- Physical stock counts.
- Low-stock thresholds.
- Inventory valuation.
- Location-specific inventory.
- Inventory correction history.
- Returned inventory.

### Purchasing

- Suppliers.
- Supplier invoices.
- Purchase lines.
- Purchase receiving.
- Supplier payments.
- Supplier returns.
- Supplier credits.
- Purchase reports.

### Sales

- POS.
- Cart quantity handling.
- Barcode search.
- Draft sales.
- Server-authoritative issuance.
- Invoice lines.
- Discounts.
- Customer payments.
- Partial returns.
- Sales corrections.
- Receipts.
- Offline POS replay.
- Cash shifts.

### Reporting and integrations

- Operational reports.
- Sales and margin reports.
- Customer balances.
- Stock reports.
- CSV exports.
- ETA eReceipt/eInvoice integration.
- Public website catalog.
- Team permissions.
- Plan entitlements.
- Multi-location behavior.

Inspect important source paths including:

```text
apps/shop-suit/app/pages/products/index.vue
apps/shop-suit/app/pages/inventory/index.vue
apps/shop-suit/app/pages/purchases/index.vue
apps/shop-suit/app/pages/pos.vue
apps/shop-suit/app/pages/catalog-import.vue
apps/shop-suit/app/pages/reports/index.vue
apps/shop-suit/app/pages/service-materials.vue

apps/shop-suit/app/utils/pos.js
apps/shop-suit/app/utils/catalogImport.js
apps/shop-suit/app/types/shopCrmRpc.ts

packages/ui/src/types/cataloguePresentation.ts
packages/ui/src/types/pointOfSalePresentation.ts
packages/ui/src/types/inventoryPresentation.ts
packages/ui/src/types/purchasingPresentation.ts
```

Inspect relevant active migrations under:

```text
apps/shop-suit/supabase/migrations/
```

Pay particular attention to the existing FIFO, product catalog, stock count, POS, purchasing, sale issuance, tax, and return functions.

### Previously identified findings

Earlier source inspection identified:

1. Products do not have a general-purpose measurement unit.
2. Existing unit prices and inventory quantities do not explicitly distinguish pieces, meters, kilograms, and other dimensions.
3. Certain stock columns use `NUMERIC(12,2)`.
4. Some purchase and sale validation paths accept three-decimal quantities, while other paths enforce two-decimal precision.
5. Product stock is aggregated through FIFO batches without first-class physical cable-reel identification.
6. POS quantity controls are not measurement-aware.
7. The existing service-material implementation supports `each`, `mL`, and `g`, but is intentionally not a general conversion engine.
8. Existing server-side sale issuance recalculates product prices from the authoritative catalog.
9. Existing partial-return functionality has quantity-precision and original-snapshot restrictions.
10. Existing plan resource limits may be too low for large electrical catalogs.
11. ETA item configuration already has a unit-code concept, but it is not yet a fully integrated product-measurement model.

These are audit hypotheses based on an earlier repository snapshot. **Verify every one against the current working tree and current effective migration history.**

Also check more recent staging features carefully. In particular, the repository has introduced storefront and fixed-price bundle-offer work; do not mistake an existing bundle-offer system for an absent capability or duplicate it unnecessarily.

Classify each requirement as:

- Already implemented and verified.
- Implemented but needing extension.
- Partially implemented.
- Missing.
- Implemented but unverified.
- Blocked by an external dependency.
- Not applicable.

For every classification, record specific code paths, tests, schema objects, and evidence.

---

# PART 2 — FIRST PRIORITY: FIX THE EXISTING STAGING CHANGELOG

**Do this before beginning Electrical Supply Store implementation.**

The owner believes the existing Shop Suit features currently appearing as `Coming Soon` have already been released.

Your job is to investigate this claim against authoritative evidence and reconcile the changelog correctly.

Do not merely change frontend copy or hardcode a different status.

## 2.1 Understand the existing changelog architecture

Inspect:

```text
apps/shop-suit/app/composables/usePublicChangelog.ts
apps/shop-suit/app/pages/changelog.vue

release-changes/items.json
release-fragments/

docs/shared/changelog-versioning.md
docs/shared/release-publication-runbook.md
docs/shared/retrospective-shop-history.md

tooling/releases/
packages/contracts/src/changelog.ts
```

Inspect the actual current publishing workflow and its associated tests.

The existing design distinguishes:

**Coming Soon**

A validated, staging-ready upcoming candidate derived from the current production-to-staging tree difference.

**Released**

A production-published, immutable release with a valid version, release timestamp, and authoritative production evidence.

The owner previously chose one evolving upcoming release per Suit rather than one release per PR.

Preserve this rule unless a newer authoritative repository policy supersedes it.

Retrospective historical versions and already published release records must remain immutable.

## 2.2 Reconcile actual staging and production

Determine:

1. Which Shop Suit features currently appear under `Coming Soon`.
2. The current production release baseline/version.
3. The actual production source commit and deployment receipt.
4. Which currently upcoming feature changes are already included in production.
5. Which changes are present only in staging.
6. Whether a successful release promotion was not acknowledged or was not reflected in the current environment-specific catalog.
7. Whether the public changelog is reading the expected backend/environment.
8. Whether any displayed entries are stale candidates or legitimate unreleased work.

Inspect the staging and production release catalogs through supported, authorized read paths.

Compare actual source trees, release manifests, publication receipts, deployment evidence, and the existing status transitions.

Do not infer successful production deployment from a green CI check, a staging merge, an old PR, a branch label, or a repository file being present.

## 2.3 Correct already released entries

For features with sufficient production evidence:

- Reconcile their release status using the existing trusted publisher.
- Preserve the correct version and immutable timestamps.
- Use only supported idempotent recovery/publication paths.
- Never rewrite an immutable release.
- Never invent a version or release date.
- Never directly modify hosted release tables as a shortcut.
- Preserve all historical changelog entries.
- Avoid duplicated announcements.
- Ensure the public projection returns the correct released status.

If a release was published but staging acknowledgment failed, use the existing recovery process rather than performing a duplicate release.

If a feature is still staging-only, retain its legitimate `Coming Soon` status.

If the evidence is inconclusive, mark its reconciliation blocked in the task tracker. Do not falsely announce it as released.

**The owner's belief is the reason for the audit, not a substitute for deployment evidence.**

## 2.4 Required changelog verification

Verify:

- Existing released items appear in the Released tab.
- Genuine unreleased items remain in Coming Soon.
- Entries are not duplicated.
- Versions follow the existing policy.
- English and Arabic titles, summaries, and details remain valid.
- Historical retrospective labels remain correct.
- The 48-hour `New` badge uses the authoritative release timestamp.
- Upcoming candidates never appear as `New`.
- Landing teaser and full changelog remain consistent.
- Loading, empty, permission, transport-error, and retry behavior remain correct.
- Environment isolation is preserved.
- No internal task metadata is exposed to public users.

Run relevant release publisher, contract, database, and UI tests.

Deliver a release-reconciliation report containing an evidence table:

| Changelog item | Prior state | Verified state | Evidence | Action | Result |
|---|---|---|---|---|---|

Do not proceed with any live status claims until this reconciliation is completed or accurately marked blocked.

---

# PART 3 — CREATE A FORMAL TASK-TRACKING SYSTEM

After the changelog audit, create a detailed implementation tracker for the Electrical Supply Store initiative.

Use the repository's existing task conventions wherever applicable.

Suggested canonical initiative ID:

`SS-ELECTRICAL-001`

Suggested task namespace:

`SS-ELEC-*`

Suggested documentation location:

```text
apps/shop-suit/docs/electrical-supply/
```

Create or appropriately integrate:

```text
README.md
REQUIREMENTS.md
ARCHITECTURE.md
TASKS.md
MIGRATION-PLAN.md
TEST-MATRIX.md
RELEASE-PLAN.md
DECISIONS.md
```

If an existing maintained project/task registry is the authoritative home for these records, register the work there as well. Do not create a conflicting parallel source of truth.

Link this initiative from the Shop Suit canonical tracker without rewriting unrelated historical status.

## 3.1 Task tracking requirements

Every task must have:

- Unique stable ID.
- Descriptive title.
- Epic or feature group.
- Priority: P0/P1/P2/P3.
- Dependency IDs.
- Owner or responsible workstream.
- Current status.
- Affected application/package/schema.
- Specific implementation objectives.
- Explicit acceptance criteria.
- Security and compatibility considerations.
- Required automated tests.
- Required manual tests.
- Evidence paths and command results.
- PR/commit references, when available.
- Blockers, if any.
- Completion notes.
- Relevant release-fragment IDs.

Allowed implementation states:

```text
NOT_STARTED
IN_PROGRESS
IMPLEMENTED
TESTED
VERIFIED
BLOCKED
DEFERRED
CANCELLED
```

Distinguish implemented code from verified behavior.

A task cannot be considered fully complete merely because the source file exists or a PR was created.

Track actual test execution and distinguish skipped, blocked, and passing results.

## 3.2 Mandatory milestone tracker

Create the following initial epics.

### EPIC E0 — Repository, release, and architecture readiness

- `SS-ELEC-000` — Initial source and database audit.
- `SS-ELEC-001` — Existing changelog reconciliation.
- `SS-ELEC-002` — Requirements and implementation tracker.
- `SS-ELEC-003` — Measurement architecture and design decisions.
- `SS-ELEC-004` — Electrical initiative changelog preparation.

### EPIC E1 — Units of Measure foundation

- `SS-ELEC-101` — Unit taxonomy and validated registry.
- `SS-ELEC-102` — Canonical product stock units.
- `SS-ELEC-103` — Quantity precision schema audit and migration.
- `SS-ELEC-104` — Server-authoritative unit conversion.
- `SS-ELEC-105` — Product measurement settings UI.
- `SS-ELEC-106` — Existing-product and historical-data compatibility.
- `SS-ELEC-107` — UoM permissions, validation, and regression tests.

### EPIC E2 — Purchase, sale, and inventory integration

- `SS-ELEC-201` — Purchase-unit conversion.
- `SS-ELEC-202` — Packaging definitions.
- `SS-ELEC-203` — Selling-unit and package pricing.
- `SS-ELEC-204` — Measurement-aware POS.
- `SS-ELEC-205` — FIFO and physical stock integration.
- `SS-ELEC-206` — Inventory counts, corrections, and thresholds.
- `SS-ELEC-207` — Receipts and immutable line snapshots.
- `SS-ELEC-208` — Measurement-aware returns and refunds.
- `SS-ELEC-209` — CSV import/export and barcode integration.
- `SS-ELEC-210` — Tax/ETA and offline compatibility.
- `SS-ELEC-211` — Reporting and margin compatibility.

### EPIC E3 — Electrical catalog and cable handling

- `SS-ELEC-301` — Electrical technical attributes.
- `SS-ELEC-302` — Product variants and SKU strategy.
- `SS-ELEC-303` — First-class cable reels/drums.
- `SS-ELEC-304` — Continuous cable-length allocation.
- `SS-ELEC-305` — Cutting operations and audit trail.
- `SS-ELEC-306` — Cable remnants and scrap.
- `SS-ELEC-307` — Cable return and damage policies.
- `SS-ELEC-308` — Reel-level inventory and reports.

### EPIC E4 — Contractor and wholesale management

- `SS-ELEC-401` — Customer groups.
- `SS-ELEC-402` — Quantity-break and customer-specific pricing.
- `SS-ELEC-403` — Quotations and revisions.
- `SS-ELEC-404` — Sales orders.
- `SS-ELEC-405` — Stock reservation.
- `SS-ELEC-406` — Deposits and partial fulfillment.
- `SS-ELEC-407` — Supplier purchase orders.
- `SS-ELEC-408` — Partial supplier deliveries.

### EPIC E5 — Advanced inventory and distribution

- `SS-ELEC-501` — Bin/shelf location tracking.
- `SS-ELEC-502` — Supplier item codes and lead times.
- `SS-ELEC-503` — Supplier price history.
- `SS-ELEC-504` — Weight barcode compatibility.
- `SS-ELEC-505` — Electronic scale integration.
- `SS-ELEC-506` — Optional weight-to-length conversions.
- `SS-ELEC-507` — Demand and reorder forecasting.
- `SS-ELEC-508` — Optional commodity-based pricing.

### EPIC E6 — Commercial and production qualification

- `SS-ELEC-601` — Product limit and plan suitability review.
- `SS-ELEC-602` — Authorization and tenant-isolation verification.
- `SS-ELEC-603` — Database concurrency and idempotency verification.
- `SS-ELEC-604` — Full English/Arabic UI qualification.
- `SS-ELEC-605` — Existing Shop regression qualification.
- `SS-ELEC-606` — Disposable database and E2E integration tests.
- `SS-ELEC-607` — Merchant pilot acceptance scenarios.
- `SS-ELEC-608` — Release-readiness review and handoff.

Do not assume every task is missing.

If current source already provides the functionality, record the implementation evidence and verify it before marking it complete.

## 3.3 Update rules

Update task status after each coherent implementation and verification step.

Maintain an overall progress summary.

Each completed milestone must record:

```text
Task ID:
Implementation status:
Verification status:
Files changed:
Database migrations:
Tests executed:
Tests passed:
Tests failed:
Tests skipped:
PR / commit:
Release evidence:
Remaining blockers:
```

Do not report an entire epic as complete if dependent tasks remain unfinished.

---

# PART 4 — PREPARE THE NEW ELECTRICAL SUPPLY CHANGELOG

Before implementing new product functionality, draft the public release announcement for the initiative.

Important: distinguish **preparing release copy** from **publishing an upcoming candidate**.

Shop Suit's current release system expects current-code evidence against the real `main` to `stg` difference. Documentation-only future plans must not be advertised as completed customer-facing software.

Therefore:

1. Draft the complete bilingual announcement and individual milestone notes as part of the task/release plan.
2. Define the release item IDs, expected impact classification, and planned semantic evidence probes.
3. As soon as the first real customer-visible implementation is present in the applicable staging tree, connect the corresponding actual release fragments and reviewed `release-changes/items.json` entries.
4. Let the trusted publisher create/update the appropriate evolving `Coming Soon` candidate only after its normal staging-readiness requirements are satisfied.
5. Move implemented items to `Released` only through a later authorized production publication.

Do not manually invent a `targetVersion`. Let the maintained publisher resolve versioning.

Do not create a separate upcoming release for each task if current policy calls for one evolving release per Suit.

## 4.1 Suggested initial announcement

**English title**

`Flexible units and measurement-based inventory`

**Arabic title**

`وحدات قياس مرنة وإدارة المخزون بالكميات`

**English summary**

`Manage products sold by piece, meter, kilogram, and other measurements, with purchasing, sales, and inventory designed to keep quantities accurate.`

**Arabic summary**

`إدارة المنتجات التي تُباع بالقطعة أو المتر أو الكيلو جرام ووحدات قياس أخرى، مع ربط المشتريات والمبيعات والمخزون للحفاظ على دقة الكميات.`

Treat this as proposed copy.

The eventual live announcement must be restricted to functionality genuinely implemented and verified in the relevant candidate.

Do not claim reel tracking, wholesale pricing, quotations, or other later capabilities in the first milestone unless those capabilities are actually delivered.

Create additional clear milestone announcement items when customer-visible capabilities land, such as:

- Cable reel tracking and cutting.
- Electrical product specifications.
- Bulk and contractor pricing.
- Quotations and sales orders.
- Supplier ordering and partial receiving.
- Advanced measurement and warehouse features.

Provide meaningful Arabic and English title, summary, and detailed descriptions.

Follow the release-fragment and public inventory contracts exactly.

All release evidence must refer to actual current code.

---

# PART 5 — CORE DOMAIN DESIGN

## 5.1 Never use a generic product `type` field for measurements

The new product field should be called:

**Unit of Measure (UoM)**

Arabic:

**وحدة القياس**

Reason: Shop Suit already distinguishes products and services, so measurement should not overload the meaning of `itemType`.

The default product measurement must be:

**Piece / Unit**

Internal canonical code:

`ea`

Display:

- EN: `Piece`
- AR: `قطعة`

Existing products must retain their previous operational meaning unless explicitly migrated.

## 5.2 Measurement dimensions

Implement a dimension-aware unit registry.

Required families:

### Count

- Piece / Each.
- Pair.
- Set.
- Dozen.

### Length

- Millimeter.
- Centimeter.
- Meter.
- Kilometer.
- Foot.

### Mass

- Milligram.
- Gram.
- Kilogram.
- Metric tonne.

### Volume

- Milliliter.
- Liter.

### Area

- Square centimeter.
- Square meter.

### Packaging

- Pack.
- Box.
- Carton.
- Bag.
- Roll.
- Reel.

**Important distinction:** Packaging is not inherently a physical unit of length, mass, or volume.

A roll may contain 100 meters, 50 meters, or another quantity.

A box may contain 10 pieces, 12 pieces, or another quantity.

Package conversions must be product-specific.

Do not implement a universal mapping such as:

`1 roll = 100 meters`

That would be incorrect.

## 5.3 Canonical inventory unit

Every stock-tracked product must have one authoritative inventory unit.

Examples:

```text
Circuit breaker:
  Stock unit: piece

Electrical wire:
  Stock unit: meter

Copper material:
  Stock unit: kilogram

Liquid material:
  Stock unit: liter
```

All purchasing, sales, stock counts, returns, and adjustments must resolve their stock effects into this canonical unit.

Alternative measurement units must not create disconnected inventory balances.

## 5.4 Three unit roles

Model:

1. Inventory/base unit.
2. Purchase unit.
3. Sale unit.

These may be the same or different.

Example:

```text
Product: Copper Cable 2.5 mm² Blue

Inventory unit:
  meter

Purchase unit:
  reel

Purchase package:
  100 meters per reel

Default sale unit:
  meter

Additional sale unit:
  centimeter

Additional sale package:
  full 100-meter reel
```

A customer purchasing 12.5 meters must subtract exactly 12.5 meters from authoritative stock.

A supplier delivering two 100-meter reels must increase stock by 200 meters.

## 5.5 Unit conversion rules

Represent units with:

```text
code
name_en
name_ar
symbol
dimension
canonical_conversion_factor
allowed_precision
is_active
```

Use exact decimal representations.

Do not use binary floating-point arithmetic for authoritative quantities or money.

Conversions must be dimension-safe.

Examples:

```text
100 cm = 1 m
1000 mm = 1 m
1000 g = 1 kg
1000 mL = 1 L
```

Reject invalid conversions such as:

```text
kg -> meter
liter -> piece
square meter -> meter
```

unless a separately authorized, product-specific conversion mechanism supplies the necessary physical relationship.

Units and conversions referenced by posted transactions should be immutable or versioned.

Do not allow historical quantities to change meaning when someone edits a current configuration.

## 5.6 Precision

Perform a complete precision audit before changing the database.

Inspect:

```text
inventory_batches
inventory_movements
invoice_items
vendor_invoice_items
stock_counts
sale_return_lines
sale_return_stock
supplier return quantities
stock adjustment requests
tax snapshots
service material consumptions
offline replay payloads
report projections
```

Some existing columns use `NUMERIC(12,2)` and some validation functions have different decimal rules.

Correct this systematically.

A suitable candidate stock representation is:

```sql
NUMERIC(18,6)
```

However, the final precision must be chosen after inspecting all related constraints, scale requirements, indexes, functions, and conversion arithmetic.

Do not blindly change all numeric columns.

Money, unit prices, quantities, and conversion factors have different precision requirements.

Suggested distinctions:

```text
Quantity:
  exact decimal, potentially 6 places

Unit price:
  exact decimal, potentially 4-6 places

Internal cost:
  sufficient precision for allocation and valuation

Financial totals:
  rounded according to currency precision

Conversion factor:
  exact rational or safe decimal representation
```

Avoid floating-point rounding errors.

Enforce product-specific increments.

Example:

```text
Circuit breaker:
  increment = 1

Ordinary cable:
  increment = 0.01 meter

Precision-cut cable:
  increment = 0.001 meter

Copper:
  increment = 0.001 kilogram
```

Do not permit fractional circuit breakers unless a clearly valid business model calls for them.

Do not round a quantity silently when conversion results are unrepresentable.

Return a clear validation error instead.

## 5.7 Existing service-material compatibility

Shop Suit already has a limited service-material unit mechanism.

Review:

```text
20261015013509_service_material_fulfillment.sql
```

It uses immutable material declarations and currently restricts stock precision and supported units.

Do not create conflicting unit definitions that allow the same stock to mean two different physical quantities.

Design a compatibility strategy:

- Preserve existing service history.
- Reconcile new product units with service material declarations.
- Reject incompatible reassignment.
- Migrate safely where possible.
- Preserve old fulfillment snapshots.
- Add forward-looking general measurement support without corrupting prior service consumption.

---

# PART 6 — DATABASE IMPLEMENTATION

## 6.1 Recommended conceptual schema

Validate against the real current database before implementation.

Potential tables:

```text
units_of_measure
product_packagings
product_sale_units
product_price_rules
product_attribute_definitions
product_attribute_values
inventory_reels
inventory_reel_movements
inventory_reel_allocations
```

Potential extensions:

```text
products:
  base_unit_code
  default_sale_unit_code
  allowed_quantity_increment
  measurement_policy

vendor_invoice_items:
  entered_quantity
  entered_unit_code
  base_quantity
  conversion_snapshot
  entered_unit_cost

invoice_items:
  entered_quantity
  entered_unit_code
  base_quantity
  conversion_snapshot
  price_rule_snapshot
  package_snapshot
```

These are conceptual names, not mandatory exact migrations.

Reuse current tables and contracts wherever appropriate.

Avoid unnecessary duplication.

## 6.2 Migration requirements

Use new forward-only migrations.

Never rewrite an already-applied migration.

Respect the Shop-owned Supabase schema and the existing product/environment separation.

Use:

```bash
pnpm db shop-suit migration new <name>
```

after verifying the command against current tooling.

Create an explicit migration plan that includes:

- Existing table and function dependencies.
- Data migration of existing products.
- Defaults and nullability.
- Constraints.
- Unique indexes.
- Foreign keys.
- RLS.
- Tenant isolation.
- Privileged function permissions.
- New RPC signatures.
- Old RPC compatibility.
- View updates.
- Function replacement ordering.
- Trigger updates.
- Rollback/recovery strategy.
- Type generation.
- Test updates.

Do not drop or recreate tables containing production financial history merely to simplify migration.

## 6.3 Existing product compatibility

Default legacy products to piece-based inventory semantics.

But carefully distinguish products with no stock history from products already having historical inventory movements.

If a legacy product was previously used to represent meters without a unit field, do not silently relabel its historical balance.

Provide an explicit reviewed migration path.

For products with stock or transaction history:

- Require a controlled unit migration.
- Preserve old historical snapshots.
- Validate source and destination dimensions.
- Convert current stock and relevant open state safely if authorized.
- Preserve monetary valuation.
- Require an audit reason.
- Reject unsupported conversions.
- Prevent partial migration.

If the system cannot prove a safe conversion, fail closed and request a separately approved migration decision.

## 6.4 Authorization and data integrity

All important business writes must remain server-authoritative.

Never trust:

- Client-computed totals.
- Client-computed converted quantities.
- User-submitted package conversion factors without validation.
- User-submitted inventory balances.
- Client-supplied price overrides without authorization.

Every write must enforce:

- Correct shop.
- Correct location.
- Correct active product.
- Appropriate membership.
- Appropriate permission.
- Subscription entitlement.
- Closed-period rules.
- Stock availability.
- Allowed precision.
- Compatible dimensions.
- Idempotency.

Retain immutability and append-only audit guarantees.

---

# PART 7 — PRODUCT CATALOG UI

Extend the current product editor.

Do not create an unrelated catalog management interface.

## 7.1 Basic product fields

Preserve existing fields and add:

```text
Product name
SKU
Barcode
Category
Image
Sale price
Unit of Measure
```

The default should be:

```text
Unit of Measure: Piece
```

If the product is sold by length:

```text
Unit of Measure: Meter
Sale Price: EGP per meter
```

If sold by weight:

```text
Unit of Measure: Kilogram
Sale Price: EGP per kilogram
```

## 7.2 Advanced measurement settings

Optional expandable section:

```text
Inventory Unit
Default Sale Unit
Allowed Sale Units
Default Purchase Unit
Quantity Increment
Packaging Definitions
```

Only show relevant controls.

An ordinary product sold per piece should not be forced through a complicated configuration wizard.

## 7.3 Example product

```text
Name:
  Electrical Cable 2.5 mm² - Blue

SKU:
  CABLE-2.5-BLU

Unit of Measure:
  Meter

Sale Price:
  35 EGP / meter

Purchase Packaging:
  Reel

Reel Length:
  100 meters

Alternative Sale Units:
  Meter
  Centimeter
  Full Reel
```

Ensure English/Arabic labels, validation messages, and formatted quantities work correctly.

## 7.4 Shared UI architecture

Follow the repository's strict UI ownership.

Shop routes must render complete page-level templates from `packages/ui`.

Do not add app-local Vue components or new forbidden native controls.

Presentation belongs in:

```text
packages/ui/
```

Reusable UI interaction controllers belong in:

```text
packages/ux/
```

Shop-specific data, business calculations, queries, permissions, and orchestration belong in:

```text
apps/shop-suit/
```

Extend existing typed contracts.

Do not create a separate design system.

Respect current tokens, PrimeVue wrappers, dark/light themes, RTL/LTR, responsive layouts, accessibility, and existing design conventions.

---

# PART 8 — PACKAGING ENGINE

## 8.1 Purpose

Support purchasing or selling the same product in different packages without duplicating stock.

Examples:

```text
1 box = 12 switches
1 pack = 10 sockets
1 reel = 100 meters
1 carton = 24 lamps
```

Conversions belong to specific product packaging definitions.

## 8.2 Packaging data

Each package should define:

```text
Product
Package name
Package code
Contained quantity
Contained unit
Optional barcode
Can purchase
Can sell
Default purchase package
Default sale package
Optional fixed selling price
Active/archived state
```

Define uniqueness and lifecycle rules.

Preserve historical package snapshots.

## 8.3 Package pricing

Example:

```text
Product: Cable

Base price:
  35 EGP per meter

Full reel:
  100 meters

Reel price:
  3200 EGP
```

Selling one full reel must:

- Charge the valid reel price.
- Deduct 100 meters from inventory.
- Preserve the package selection on the document.
- Record the correct base-unit quantity.
- Preserve a frozen price snapshot.

Do not simply compute `100 * 35` when a valid package-specific price exists.

The server must resolve the correct pricing rule.

## 8.4 Existing bundle-offer compatibility

Audit current storefront and bundle-offer code before implementing package pricing.

A bundle consisting of different products is not the same as a package containing multiple units of the same product.

Examples:

**Package**

```text
Box of 12 switches
```

**Bundle**

```text
2 switches + 1 socket + 1 faceplate
```

Preserve existing bundle pricing and receipts.

Ensure packaging and bundles can coexist without:

- Duplicated stock deductions.
- Incorrect discounts.
- Double application of price rules.
- Ambiguous barcode resolution.
- Inconsistent POS totals.

---

# PART 9 — PURCHASING IN DIFFERENT UNITS

Allow the merchant to purchase in a unit different from the inventory unit.

Example:

```text
Supplier:
  ABC Cables

Product:
  Copper Cable 2.5 mm²

Purchase Quantity:
  2 reels

Package:
  100 meters per reel

Cost:
  2500 EGP per reel
```

Expected result:

```text
Inventory received:
  200 meters

Purchase total:
  5000 EGP

Effective acquisition cost:
  25 EGP per meter
```

The purchase line must preserve both the entered supplier unit and its canonical inventory equivalent.

Ensure the posted purchase, FIFO batch, inventory movement, supplier balance, and purchase reporting reconcile.

Handle conversions without artificial fractional-currency losses.

Preserve idempotent purchase posting.

Handle supplier returns in valid measured quantities.

Reject incompatible or ambiguous package definitions.

---

# PART 10 — MEASUREMENT-AWARE POS

The POS is one of the highest-priority implementation areas.

## 10.1 Product selection

When a product is added to the cart, show its measurement unit.

Examples:

```text
Cable:
  EGP 35 / meter

Copper:
  EGP 200 / kilogram

Circuit Breaker:
  EGP 150 / piece
```

## 10.2 Quantity input

Allow decimal quantities only when permitted.

Examples:

```text
Cable:
  12.5 m

Copper:
  0.750 kg

Switch:
  2 pcs
```

Quantity increments must be product-aware.

The `+` and `-` buttons must behave sensibly for measured goods.

A meter-based product should not be restricted to whole numbers.

A piece-based product should not accidentally allow 0.3 pieces.

## 10.3 Sales-unit switching

Support alternative valid sale units.

Example:

```text
Quantity: 250
Unit: cm
```

Display:

```text
Equivalent:
  2.5 m
```

The server must revalidate and convert the quantity.

## 10.4 Barcode behavior

A barcode may identify:

- A product.
- A product package.
- An individual cable reel, where reel tracking exists.
- A supported variable-measure item.

Avoid ambiguity.

Do not allow two active barcodes in the same shop to resolve to conflicting sellable identities without explicit handling.

## 10.5 Authoritative checkout

Never trust cart-preview totals as final authority.

The server must re-evaluate:

- Selected product.
- Selected package.
- Allowed unit.
- Converted quantity.
- Available stock.
- Relevant price rule.
- Discount.
- Tax.
- Final amount.

Preserve current sale issuance and receipt guarantees.

## 10.6 Offline POS

Inspect the current offline replay format.

Version offline payloads if required.

Preserve:

- Original selected unit.
- Original entered quantity.
- Canonical quantity or conversion evidence.
- Selected package.
- Pricing context.
- Idempotency key.
- Recovery state.

Never silently replay a stale sale with changed conversion rules.

If the authoritative server can no longer fulfill the transaction, return a recoverable conflict according to the existing offline reconciliation architecture.

---

# PART 11 — INVENTORY AND FIFO

The existing Shop Suit FIFO engine is an important foundation.

Extend it rather than replacing it.

## 11.1 Canonical stock

Store stock in a single canonical quantity.

Examples:

```text
Cable:
  187.5 m

Copper:
  4.75 kg

Switches:
  24 pcs
```

All movements must be auditable.

## 11.2 FIFO costing

When a sale consumes quantity across multiple acquisition batches, preserve the appropriate costs.

Example:

```text
Batch A:
  30 m at 20 EGP/m

Batch B:
  100 m at 25 EGP/m
```

A sale of 40 meters should consume:

```text
30 m from A
10 m from B
```

Cost:

```text
(30 * 20) + (10 * 25)
```

Ensure conversion does not change the value of the underlying FIFO allocation.

## 11.3 Stock counts

When counting a measured product, show the base unit.

Example:

```text
Expected:
  85.5 m

Counted:
  83.0 m

Variance:
  -2.5 m
```

Do not interpret the number as pieces.

Retain audit reason, reference, actor, date, and movement trail.

## 11.4 Reorder thresholds

Store thresholds in the product's canonical unit.

Example:

```text
Reorder threshold:
  50 meters

Current stock:
  43.5 meters
```

Trigger the existing low-stock behavior correctly.

---

# PART 12 — CABLE REEL MANAGEMENT

This is the main electrical-industry-specific inventory capability.

Treat it as a distinct feature layered on top of canonical measured inventory.

## 12.1 Physical reel identities

Track individual reels/drums.

Each record should include:

```text
Reel ID
Reel barcode
Product
Location
Storage position
Acquisition batch
Original length
Remaining length
Reserved length
Cost allocation reference
Status
Created timestamp
Last movement timestamp
```

Possible statuses:

```text
SEALED
OPEN
EMPTY
DAMAGED
ARCHIVED
```

Use the actual domain naming conventions.

## 12.2 Continuous-length availability

This requirement is critical.

Suppose stock consists of:

```text
Reel A:
  50 meters

Reel B:
  50 meters
```

Aggregate stock:

```text
100 meters
```

A customer requests one continuous 80-meter cable.

**This sale cannot be fulfilled from these two reels.**

The system must distinguish:

```text
80 meters as one continuous piece
```

from:

```text
Two pieces totaling 80 meters
```

Aggregate quantity alone is insufficient.

Do not treat every length-based product as requiring reel tracking; this is an optional product capability.

## 12.3 Cutting

When a cut occurs, record:

```text
Reel ID
Requested length
Actual cut length
Cutting loss, if any
Resulting remaining length
Staff member
Location
Timestamp
Related sale/order
```

Example:

```text
Reel:
  100 m

Sold:
  12.5 m

Remaining:
  87.5 m
```

Ensure reel changes and aggregate inventory changes commit atomically.

Never maintain a second independent stock balance that can drift from FIFO inventory.

## 12.4 Cutting waste

Support separately identified cutting waste.

Example:

```text
Requested:
  12.5 m

Physical loss:
  0.02 m

Total consumed:
  12.52 m
```

The final system must clearly distinguish sale quantity, physical consumed quantity, and recorded scrap.

Do not charge a customer for cutting waste unless the business's explicit pricing policy requires it.

## 12.5 Remnants

Support short leftover pieces.

Example:

```text
Remaining reel length:
  1.25 m
```

The owner should be able to classify it as:

```text
Sellable
Discounted remnant
Damaged
Scrap
```

All stock and valuation effects must remain traceable.

## 12.6 Returns

Cut cable may have different return eligibility from an unopened reel.

Allow an explicit shop return policy such as:

```text
Unopened reel:
  Resellable return

Cut cable:
  Manager approval required

Damaged cable:
  Non-resellable
```

These are product policy options, not fixed legal claims.

Preserve existing financial refunds and their original document snapshots.

---

# PART 13 — ELECTRICAL PRODUCT SPECIFICATIONS

Add structured technical product attributes.

Do not put every electrical attribute directly on the base `products` table.

Use reusable typed attributes.

## 13.1 Cable attributes

Examples:

```text
Brand
Conductor material
Conductor cross-section (mm²)
Core count
Insulation material
Voltage rating
Color
Cable type
Flexible/solid
Manufacturer reference
```

Remember:

`2.5 mm²` is a technical cross-section specification, not the product's selling unit.

## 13.2 Circuit breaker attributes

Examples:

```text
Brand
Current rating (A)
Pole count
Trip curve
Breaking capacity
Rated voltage
Series
Manufacturer part number
```

## 13.3 Lamps and accessories

Examples:

```text
Wattage
Lumens
Color temperature
Base type
Voltage
Color
Dimensions
Brand
```

## 13.4 Variants

Separate independently stocked variants into distinct SKUs.

Example:

```text
Cable 2.5 mm² Blue
Cable 2.5 mm² Red
Cable 2.5 mm² Black
```

These may share a parent product family but must not share an undifferentiated physical stock balance.

## 13.5 Search

Improve product search and filters with technical attributes.

A cashier should be able to locate products using:

```text
Schneider 20A 1P
Cable 2.5 blue
PVC conduit 25mm
LED 12W
```

Maintain existing barcode/SKU search behavior.

---

# PART 14 — CUSTOMER AND WHOLESALE PRICING

Electrical supply stores often have different retail and contractor pricing.

Build this on Shop Suit's existing customer/payment infrastructure.

## 14.1 Customer groups

Examples:

```text
Retail
Electrician
Contractor
Wholesale
VIP
```

Groups should be shop-specific and configurable.

## 14.2 Quantity-break pricing

Example:

```text
Cable retail:
  35 EGP/m

100+ meters:
  33 EGP/m

500+ meters:
  30 EGP/m
```

Do not rely on client-calculated pricing.

## 14.3 Customer-specific pricing

Support negotiated pricing where appropriate.

For each rule, consider:

```text
Product
Customer or customer group
Unit/package
Minimum quantity
Price
Effective date
Expiry date
Priority
```

Define deterministic precedence when multiple rules match.

For example:

1. Valid customer contract.
2. Valid customer-group price.
3. Applicable quantity break.
4. Eligible package price.
5. Base catalog price.

This is a suggested precedence. Review and document it before implementation.

Ensure existing bundle offers cannot stack incorrectly with these prices.

## 14.4 Price overrides

If authorized staff can change a selling price:

- Enforce permissions.
- Validate minimum margin policies if enabled.
- Record the original price.
- Record the override price.
- Record the actor.
- Record the reason when required.
- Preserve the final issued price snapshot.

---

# PART 15 — QUOTATIONS AND SALES ORDERS

Electrical contractors often request a full materials quotation.

Do not confuse ordinary sale drafts with formal quotations.

## 15.1 Quotations

Support:

```text
Quotation number
Customer
Project reference
Items
Quantities
Units
Prices
Discounts
Taxes
Validity date
Notes
Status
Version history
```

Suggested states:

```text
DRAFT
ISSUED
ACCEPTED
REJECTED
EXPIRED
CANCELLED
```

Define exact transitions and permissions.

## 15.2 Convert quotation to sales order

Allow accepted quotations to become orders without re-entering products.

Preserve the original quotation as immutable history.

Do not silently replace the agreed prices with newly changed catalog prices.

Define an explicit policy for expired or changed quotes.

## 15.3 Stock reservation

Support reserved quantities.

Example:

```text
On hand:
  200 m

Reserved:
  80 m

Available to sell:
  120 m
```

Reservations must be server-authoritative and location-scoped.

Reel-tracked cable reservations may need to reserve specific physical reels or continuous lengths.

Prevent double allocation.

## 15.4 Partial fulfillment

A contractor may collect materials in multiple visits.

Example:

```text
Order:
  500 meters

First delivery:
  200 meters

Remaining:
  300 meters
```

Preserve order, inventory, payments, and delivery history.

Do not double-issue sales or double-deduct inventory.

## 15.5 Deposits and customer balances

Integrate with existing payment infrastructure.

Ensure deposits, invoice obligations, and refunds are reconciled correctly.

Do not introduce a competing financial ledger.

---

# PART 16 — ADVANCED SUPPLIER PURCHASING

Extend existing supplier purchasing when the prerequisite measurement architecture is stable.

Support:

- Supplier purchase orders.
- Ordered quantities.
- Supplier purchase units.
- Partial receiving.
- Remaining undelivered quantities.
- Supplier product codes.
- Supplier price history.
- Supplier lead times.
- Supplier-specific packaging.
- Purchase return reconciliation.

Example:

```text
Purchase order:
  10 reels

First delivery:
  6 reels

Remaining:
  4 reels
```

Receiving must update stock only for quantities physically accepted.

A purchase order itself must not automatically create sellable inventory.

Preserve supplier balances and original purchase documents.

---

# PART 17 — WEIGHT-BASED SALES

Support businesses selling materials by mass.

## 17.1 Basic behavior

Example:

```text
Inventory:
  5 kg

Sale:
  250 g

Remaining:
  4.75 kg
```

The conversion must be exact within the approved product precision.

## 17.2 Variable-measure barcodes

Research current applicable barcode standards, including GS1 and the relevant retail/POS market conventions.

Implement support only for verified barcode formats.

Do not interpret arbitrary barcode digits as a trusted weight or price.

Preserve normal fixed-product barcodes.

## 17.3 Electronic scales

Design optional scale integration as an adapter.

Consider:

- Supported device protocol.
- Stable weight readings.
- Tare weight.
- Gross/net weight.
- Unit precision.
- Connection failure.
- Staff confirmation.
- Device-specific configuration.

Do not block ordinary manual weight sales if no scale is connected.

## 17.4 Product-specific length/weight conversion

Some cable businesses may price or manage certain materials using both length and mass.

Such conversion requires a verified product-specific relationship.

Example:

```text
Product-specific:
  1 meter = X kilograms
```

Do not introduce a universal meter-to-kilogram conversion.

Store approved conversion factors with versioned provenance and the appropriate precision.

---

# PART 18 — REPORTING

Extend existing reports instead of creating a second reporting system.

Required measurement-aware reporting:

- Product quantities sold by unit.
- Product quantities purchased by unit.
- Inventory valuation.
- FIFO COGS.
- Gross margin.
- Package sales.
- Meter-based sales.
- Kilogram-based sales.
- Low-stock reports.
- Reel balances.
- Cutting loss and scrap.
- Stock reservations.
- Supplier purchase quantities.
- Customer-specific price performance.

Never sum heterogeneous product quantities and present them as if they were one physical unit.

For example:

```text
10 pieces + 20 meters + 5 kilograms
```

must not be displayed as:

```text
Total quantity: 35 units
```

unless it is explicitly labeled as a line/item-count metric rather than physical quantity.

Aggregations should group compatible dimensions/units or provide financial totals.

Preserve existing permissions for cost and margin visibility.

---

# PART 19 — CSV IMPORT, EXPORT, AND PUBLIC CATALOG

## 19.1 Product CSV import

Extend the existing product template.

Candidate additional fields:

```text
base_unit
sale_unit
purchase_unit
quantity_increment
package_name
package_quantity
package_price
brand
manufacturer_part_number
technical_attributes
```

Determine a safe, maintainable input format for multiple packages and structured attributes.

Do not force complex JSON strings into a simple CSV if a separate import template or related sheet is more reliable.

Continue supporting legacy CSV templates.

Validate imports before writing.

## 19.2 Opening stock

Opening balances must be converted to canonical stock units.

Never create stock through unchecked direct table inserts from the browser.

Preserve request idempotency.

## 19.3 Barcode labels

Include relevant unit/package information where appropriate.

Support package and reel barcodes without ambiguously overlapping product barcode identities.

## 19.4 Public catalog

For products where public prices are enabled, show meaningful measurement pricing.

Example:

```text
Copper Cable
35 EGP / meter
```

Do not display:

```text
35 EGP
```

when that could mislead a buyer about the selling basis.

Support relevant specifications and package information while respecting the existing selective publication policy.

Do not expose private costs, stock-layer information, supplier agreements, or internal reel history.

---

# PART 20 — EGYPTIAN TAX AND ETA INTEGRATION

Shop Suit has optional Egyptian tax integration code.

Preserve its existing activation and authorization restrictions.

Verify current ETA documentation and actual supported unit codes before using them.

Potential mappings include:

```text
Each: EA
Meter: M
Centimeter: CMT
Millimeter: MMT
Kilogram: KGM
Gram: GRM
Box: BOX
Reel: RL
Roll: RO
```

Treat these as candidates to verify against current official documentation and the correct electronic document schema.

Ensure:

- Quantity is correct.
- Unit code is correct.
- Unit price matches the reported basis.
- Discounts remain correct.
- Tax totals reconcile.
- Historical snapshots remain immutable.
- Unsupported conversions fail safely.
- Existing eReceipt/eInvoice behavior remains intact.

Do not claim live ETA compliance from local tests alone.

Do not create actual production electronic invoices without the necessary authorization and approved provider configuration.

---

# PART 21 — PLANS, LIMITS, AND COMMERCIAL SUITABILITY

Review current Shop Suit plan limits and product-resource enforcement.

Electrical businesses may have hundreds or thousands of SKUs.

Variants can increase SKU counts substantially.

Review whether:

- Solo supports small electrical stores.
- Team supports medium retailers.
- Multi supports larger merchants.
- Product limits are adequate.
- New packaging records count as products or as child records.
- Variant records count as active products.
- Plan entitlements accidentally block core measurement functionality.

**Recommended product direction:**

Basic UoM and measurement-aware selling should be foundational product capabilities, not an unnecessarily expensive electrical-industry-only feature.

Advanced reel tracking, complex warehouse features, and wholesale workflow capabilities may later be subject to commercial plan decisions.

However, do not independently change approved subscription pricing, active entitlements, or protected plan terms without the repository's required authorization.

Document commercially important constraints separately from core technical work.

---

# PART 22 — TESTING AND VERIFICATION

Testing is mandatory, not optional.

## 22.1 Unit conversion tests

Verify:

```text
100 cm = 1 m
1000 mm = 1 m
1000 g = 1 kg
250 g = 0.25 kg
```

Reject incompatible dimensions.

Test precision boundaries and invalid quantities.

## 22.2 Purchase tests

Test:

```text
Purchase:
  2 reels × 100 m

Expected inventory increase:
  200 m
```

Verify FIFO unit costs and supplier totals.

## 22.3 Sales tests

Test:

```text
Starting stock:
  100 m

Sale:
  12.5 m

Expected:
  87.5 m
```

Test a 250 cm sale and exact base-unit conversion.

## 22.4 Weighted sales

Test:

```text
Starting:
  5 kg

Sale:
  250 g

Expected:
  4.75 kg
```

## 22.5 Piece products

Test that ordinary products still work.

Example:

```text
Stock:
  10 circuit breakers

Sale:
  2 pieces

Remaining:
  8 pieces
```

Reject invalid fractional quantities.

## 22.6 Packaging tests

Test:

```text
1 reel = 100 m
```

Verify package pricing and canonical stock deduction.

Also test:

```text
1 box = 12 pieces
```

Ensure no extra product stocks are created.

## 22.7 Reel continuity tests

Given:

```text
Reel A: 50 m
Reel B: 50 m
```

Reject a single continuous 80 m cut.

Allow a compatible explicitly split order if supported.

## 22.8 Concurrency tests

Test two simultaneous cashiers attempting to sell the last available stock.

Test concurrent reel allocation/cutting.

Test purchase replay with the same request UUID.

Test duplicate sale replay.

Test interrupted transactions.

No over-allocation, duplicate movement, or negative authoritative inventory may occur.

## 22.9 Return tests

Verify:

- Correct original sale reference.
- Partial quantity validation.
- Accurate financial adjustment.
- Appropriate restocking/damage policy.
- Original FIFO cost treatment.
- Historical measurement snapshot.
- No over-return.
- No duplicate refund obligation.

## 22.10 Offline tests

Test quantity and package snapshots during replay.

Test network interruption after server commit.

Test retries with identical request identities.

Test stale conversion and insufficient stock conflicts.

## 22.11 Security tests

Verify:

- Tenant isolation.
- Location isolation.
- Staff role restrictions.
- Plan checks.
- Product ownership checks.
- No unauthorized unit mutation.
- No direct browser financial/inventory writes.
- RLS and RPC grants.
- No cross-shop barcode/package/reel access.
- No mutation of immutable historical records.

## 22.12 UI tests

Test:

- English.
- Arabic.
- LTR.
- RTL.
- Light theme.
- Dark theme.
- Desktop.
- Mobile.
- Keyboard accessibility.
- Screen-reader labels.
- Loading states.
- Empty states.
- Validation errors.
- Retry states.
- Permission states.
- Plan restrictions.
- Dirty-form protection.

## 22.13 Required representative merchant journey

Create a realistic test merchant.

Products:

```text
1. Circuit Breaker 20A — Piece
2. Cable 2.5 mm² Blue — Meter
3. Copper Material — Kilogram
4. Electrical Socket — Piece
5. PVC Conduit — Meter
```

Perform:

1. Create products.
2. Configure measurements.
3. Receive two cable reels.
4. Receive 5 kg of copper.
5. Sell 12.5 m of cable.
6. Sell 250 g of copper.
7. Sell two circuit breakers.
8. Print the receipt.
9. Inspect inventory.
10. Check FIFO value.
11. Perform a stock count.
12. Return an eligible item.
13. Inspect customer and supplier balances.
14. Check reporting.
15. Verify bilingual screens.
16. Verify no historical or unrelated product regression.

Expand this journey as advanced features become available.

---

# PART 23 — PERFORMANCE AND SCALABILITY

Design for realistic electrical-store catalogs.

Consider:

- Thousands of SKUs.
- Multiple variants.
- Many barcode identities.
- Many purchase records.
- Large movement histories.
- Reels with long cutting histories.
- Multiple cashiers.
- Multiple branches.
- Large suppliers/customers lists.

Use server-side pagination for large histories.

Add necessary indexes based on real query patterns.

Avoid unbounded joins or loading entire inventories into browser memory.

Maintain predictable transaction-lock ordering.

Do not create avoidable deadlocks between product locks, reel locks, FIFO batch locks, and reservations.

Test relevant performance scenarios with representative synthetic datasets.

---

# PART 24 — IMPLEMENTATION ORDER AND DEPENDENCIES

Execute the tasks in this dependency order:

### Milestone M0

- Complete source audit.
- Reconcile old changelog.
- Create tracker.
- Prepare new announcement draft.
- Finalize UoM architecture.

### Milestone M1

- Unit registry.
- Product base unit.
- Precision migration.
- Conversion functions.
- Legacy compatibility.
- Product editor.
- Core unit tests.

### Milestone M2

- Purchase units.
- Packaging.
- POS integration.
- FIFO integration.
- Inventory UI.
- Receipt snapshots.
- Returns.
- Import/report/tax/offline compatibility.
- End-to-end measured sales.

### Milestone M3

- Electrical attributes.
- Product variants.
- Reel tracking.
- Reel cutting.
- Remnants.
- Scrap.
- Reel-aware returns.
- Industry-specific acceptance tests.

### Milestone M4

- Customer groups.
- Tier pricing.
- Quotations.
- Sales orders.
- Reservations.
- Deposits.
- Partial fulfillment.
- Purchase orders.

### Milestone M5

- Bin locations.
- Scale/barcode integrations.
- Supplier intelligence.
- Forecasting.
- Commodity-linked pricing where justified.

### Milestone M6

- Full regression.
- Security validation.
- Multi-location verification.
- Commercial constraints review.
- Merchant pilot.
- Release qualification.

Implementation does not have to put every milestone into one enormous PR.

Use focused, reviewable changes compatible with the current feature-stack workflow.

However, preserve the complete tracker and continue through the backlog rather than abandoning the work after the first milestone.

---

# PART 25 — REQUIRED DOCUMENTATION AND DELIVERABLES

Maintain:

```text
Electrical requirements
Current capability audit
Architecture decisions
UoM conversion contract
Migration strategy
Detailed implementation tasks
Dependency graph
Testing matrix
Release notes
Verification results
Known limitations
```

Update the tracker after every meaningful implementation and verification step.

Document decisions regarding:

- Canonical units.
- Quantity precision.
- Packaging conversions.
- Historical compatibility.
- Unit immutability.
- Server-side pricing.
- FIFO cost representation.
- Reel allocation.
- Cutting loss.
- Reservation behavior.
- Return eligibility.
- ETA unit mappings.
- Plan limits.

Record any chosen assumptions rather than leaving contradictory behavior implicit.

---

# PART 26 — MANDATORY QUALITY GATES

Use current repository commands and verify they exist before execution.

Relevant commands are likely to include:

```bash
pnpm agent:preflight
pnpm check
pnpm --filter @building-suit/shop-suit typecheck
pnpm --filter @building-suit/shop-suit lint
pnpm --filter @building-suit/shop-suit build
pnpm db shop-suit <supported-test-command>
pnpm release:check
```

Use actual package scripts, current test runners, and documented release arguments.

Run focused tests after each task.

Run broader regression tests before considering a milestone verified.

For shared UI changes, run the strict UI ownership checks and affected consumer tests.

For database changes, use a disposable local database or expressly authorized safe test environment.

Never reset a hosted merchant database.

Never expose credentials, private keys, or production customer data.

Do not suppress failing tests or weaken constraints to produce a green status.

If testing is blocked, preserve the actual failure and mark the verification incomplete.

---

# PART 27 — DEFINITION OF DONE

A feature is fully complete only when:

1. The code is implemented.
2. The schema is safely migrated where necessary.
3. Relevant domain validation exists.
4. Server-side authorization is enforced.
5. Historical compatibility is preserved.
6. Unit tests pass.
7. Required database integration tests pass.
8. Required E2E tests pass.
9. Existing affected workflows pass regression checks.
10. English and Arabic UI behavior is verified.
11. Relevant documentation is updated.
12. The task tracker contains the actual results.
13. Release evidence and candidate notes are correctly updated.
14. Any external acceptance conditions are clearly distinguished from source implementation.

A PR merge is not itself evidence of successful deployment.

An implemented UI is not sufficient evidence that a database migration is active in production.

A staging candidate is not a released production version.

---

# PART 28 — REQUIRED PROGRESS REPORTS

At meaningful checkpoints, provide a concise execution report.

Use this format:

## Milestone
Name and ID.

## Status
Current implementation/verification state.

## Completed tasks
Task IDs with evidence.

## In-progress tasks
Task IDs and current implementation focus.

## Remaining tasks
Task IDs and dependencies.

## Changes made
Relevant files, migrations, and interfaces.

## Validation
Exact commands and results.

## Changelog
Which existing release entries were reconciled, and which new Electrical Supply Store notes were prepared or published as legitimate upcoming candidates.

## Blockers
Specific external or technical constraints.

## Next implementation step
The next actionable task.

Do not present planned work as completed.

Do not hide skipped tests.

Do not claim production readiness while required external acceptance is missing.

---

# PART 29 — FINAL SUCCESS CRITERIA

The central business test is:

> An electrical merchant creates a cable product measured in meters, purchases a reel containing 100 meters, sells 12.5 meters through Shop Suit's POS, charges the correct amount, preserves the correct FIFO cost, prints the correct unit on the receipt, and sees exactly 87.5 meters remaining in inventory.

The next level is:

> That same merchant can track individual physical reels, distinguish available continuous cable lengths from aggregate stock, cut cable, record scrap, handle returns, and serve contractor/wholesale customers without losing financial or stock integrity.

The broader goal is:

> Any supported Shop Suit merchant can use ordinary pieces or appropriate physical measurements without needing a separate application, while all old product, payment, tax, inventory, service, and reporting behavior remains correct.

---

# PART 30 — IMMEDIATE EXECUTION INSTRUCTIONS

Start now.

Follow this exact sequence:

**FIRST**

Read the repository rules, run preflight, inspect the current staging and production state, and reconcile the existing Shop Suit changelog.

**SECOND**

Create the complete Electrical Supply Store task backlog with current evidence-backed statuses.

**THIRD**

Prepare the new bilingual Electrical Supply Store release copy and integrate its eventual publication with the existing versioned changelog system.

**FOURTH**

Begin actual implementation with the measurement engine and product catalog foundation.

**FIFTH**

Continue into purchasing, POS, FIFO, packaging, stock counts, receipts, returns, and related integrations.

**SIXTH**

Continue to electrical-specific features, prioritizing cable reels, cutting, and technical specifications.

**SEVENTH**

Continue to wholesale and advanced requirements according to the documented dependencies.

**EIGHTH**

Verify, document, commit, and submit reviewable changes using the current authorized Git workflow.

Do not generate placeholder implementations or fake completion statuses.

Do not create a separate Electrical Supply Store application.

Do not redesign unrelated features.

Do not introduce conflicting inventory balances or duplicate financial ledgers.

Do not bypass the existing release-publication lifecycle.

Do not stop merely because the implementation plan is complete.

**The expected result is working, tested code plus maintained task progress, not just an architectural proposal.**

If an external permission, production deployment, or approval prevents a specific operation, report that blocker and continue safe, independent implementation work.

The implementation should remain compatible with the existing Building Suit architecture, styling, security model, staging workflow, and production release rules.

**BEGIN EXECUTION.**
