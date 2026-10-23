# SS-ELECTRICAL-001 task ledger

Status authority for this initiative only. Source/test execution differs from deployment. Allowed states: NOT_STARTED, IN_PROGRESS, IMPLEMENTED, TESTED, VERIFIED, BLOCKED, DEFERRED, CANCELLED. The measured-retail child implements canonical precision and the first merchant workflow. SQL execution and UI qualification are tracked separately; physical reels, trade ordering and final commercial qualification remain open.

Dependencies on blocked hosted SS-ELEC-001 are waived only for independent local work, as explicitly authorized by the owner brief. Public release claims remain blocked.

## SS-ELEC-000 — Initial source and database audit

- Epic / priority / owner: E0 / P0 / Shop domain/database.
- Dependencies: None.
- Status: BLOCKED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Audit current source, all listed workflows, effective local schema and tests; distinguish unavailable hosted history.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Audit current source, all listed workflows, effective local schema and tests; distinguish unavailable hosted history. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: AUDIT.md and PRECISION-AUDIT.md
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-001 — Existing changelog reconciliation

- Epic / priority / owner: E0 / P0 / Release.
- Dependencies: SS-ELEC-000.
- Status: BLOCKED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Match each live upcoming item to production receipt and frozen version; recover through trusted publisher without rewriting history.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Match each live upcoming item to production receipt and frozen version; recover through trusted publisher without rewriting history. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: RELEASE-RECONCILIATION.md; production catalog503/config403/failed publisher
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Production catalog503, failed publisher; environment config and archived logs denied. No bypass or live relabeling.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-002 — Requirements and implementation tracker

- Epic / priority / owner: E0 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-000, SS-ELEC-001.
- Status: IMPLEMENTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Register all mandatory tasks, dependencies, ownership, acceptance and actual evidence in the existing Shop tracker.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Register all mandatory tasks, dependencies, ownership, acceptance and actual evidence in the existing Shop tracker. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: README.md, REQUIREMENTS.md and this ledger
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-003 — Measurement architecture and design decisions

- Epic / priority / owner: E0 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-002.
- Status: IMPLEMENTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Document canonical units, precision, legacy/service compatibility, immutable snapshots and operational activation sequencing.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Document canonical units, precision, legacy/service compatibility, immutable snapshots and operational activation sequencing. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: ARCHITECTURE.md, DECISIONS.md and MIGRATION-PLAN.md
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-004 — Electrical initiative changelog preparation

- Epic / priority / owner: E0 / P0 / Release.
- Dependencies: SS-ELEC-002, SS-ELEC-003.
- Status: IMPLEMENTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Prepare meaningful EN/AR milestone copy; activate inventory probes only for genuinely delivered staging behavior.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Prepare meaningful EN/AR milestone copy; activate inventory probes only for genuinely delivered staging behavior. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: RELEASE-PLAN.md; draft only
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-101 — Unit taxonomy and validated registry

- Epic / priority / owner: E1 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-003, SS-ELEC-004.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Seal bilingual dimension registry; pair/dozen exact; no universal package/set factors; reject invalid dimension/precision.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Seal bilingual dimension registry; pair/dozen exact; no universal package/set factors; reject invalid dimension/precision. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Full Supabase startup exceeds workspace storage; operational precision/snapshots and product editor pending. No measured transaction activation.
- Completion notes / release fragment: tested internal preparation; fragment ss-electrical-measurement-foundation-20261022. No operational completion claim. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-102 — Canonical product stock units

- Epic / priority / owner: E1 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-101.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Persist canonical product unit/increment and legacy distinction; only authorized unused-product configuration.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Persist canonical product unit/increment and legacy distinction; only authorized unused-product configuration. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Full Supabase startup exceeds workspace storage; operational precision/snapshots and product editor pending. No measured transaction activation.
- Completion notes / release fragment: tested internal preparation; fragment ss-electrical-measurement-foundation-20261022. No operational completion claim. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-103 — Quantity precision schema audit and migration

- Epic / priority / owner: E1 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-102.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Audit every quantity/cost/price dependency; migrate quantities consistently without rounding or weakening constraints.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Audit every quantity/cost/price dependency; migrate quantities consistently without rounding or weakening constraints. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-104 — Server-authoritative unit conversion

- Epic / priority / owner: E1 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-101, SS-ELEC-102.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Resolve compatible units on the server using exact ratios and product increment; never trust client conversion factors.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Resolve compatible units on the server using exact ratios and product increment; never trust client conversion factors. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Full Supabase startup exceeds workspace storage; operational precision/snapshots and product editor pending. No measured transaction activation.
- Completion notes / release fragment: tested internal preparation; fragment ss-electrical-measurement-foundation-20261022. No operational completion claim. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-105 — Product measurement settings UI

- Epic / priority / owner: E1 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-102, SS-ELEC-103, SS-ELEC-104.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Extend existing shared product editor with translated measurement/increment fields and locked historical settings.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Extend existing shared product editor with translated measurement/increment fields and locked historical settings. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-106 — Existing-product and historical-data compatibility

- Epic / priority / owner: E1 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-102.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Preserve old stock/financial meaning and each/mL/g declarations; block unsupported used-product reassignment.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Preserve old stock/financial meaning and each/mL/g declarations; block unsupported used-product reassignment. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Full Supabase startup exceeds workspace storage; operational precision/snapshots and product editor pending. No measured transaction activation.
- Completion notes / release fragment: tested internal preparation; fragment ss-electrical-measurement-foundation-20261022. No operational completion claim. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-107 — UoM permissions, validation, and regression tests

- Epic / priority / owner: E1 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-101, SS-ELEC-102, SS-ELEC-104, SS-ELEC-106.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Prove role/tenant/subscription denial, immutable definitions, configured piece validation and legacy regressions.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Prove role/tenant/subscription denial, immutable definitions, configured piece validation and legacy regressions. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Full Supabase startup exceeds workspace storage; operational precision/snapshots and product editor pending. No measured transaction activation.
- Completion notes / release fragment: tested internal preparation; fragment ss-electrical-measurement-foundation-20261022. No operational completion claim. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-201 — Purchase-unit conversion

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-103, SS-ELEC-104, SS-ELEC-202.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Receive 2 reels of 100m at 2500 each into 200m at25/m; supplier total5000; preserve idempotency and snapshots.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Receive 2 reels of 100m at 2500 each into 200m at25/m; supplier total5000; preserve idempotency and snapshots. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-202 — Packaging definitions

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-102, SS-ELEC-104.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Version product-specific package definitions, barcode uniqueness, sale/purchase eligibility and archive lifecycle.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Version product-specific package definitions, barcode uniqueness, sale/purchase eligibility and archive lifecycle. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-203 — Selling-unit and package pricing

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-202.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Apply fixed package price and canonical deduction server-side with deterministic bundle precedence.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Apply fixed package price and canonical deduction server-side with deterministic bundle precedence. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-204 — Measurement-aware POS

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-103, SS-ELEC-104, SS-ELEC-203.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Show valid units and product increments in POS; server revalidate 250cm/12.5m; preserve ordinary piece behavior.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Show valid units and product increments in POS; server revalidate 250cm/12.5m; preserve ordinary piece behavior. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-205 — FIFO and physical stock integration

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-103, SS-ELEC-201, SS-ELEC-204.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Use one canonical FIFO stock balance and original acquisition costs across converted transactions.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Use one canonical FIFO stock balance and original acquisition costs across converted transactions. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-206 — Inventory counts, corrections, and thresholds

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-205.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Count/correct/set thresholds in base units with audit reason and exact increments; preserve closed periods.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Count/correct/set thresholds in base units with audit reason and exact increments; preserve closed periods. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-207 — Receipts and immutable line snapshots

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-204, SS-ELEC-205.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Freeze entered and base quantities, unit/conversion/package/price snapshots and display units on printed receipts.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Freeze entered and base quantities, unit/conversion/package/price snapshots and display units on printed receipts. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-208 — Measurement-aware returns and refunds

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-207.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Return only original eligible quantity/cost/tax snapshots; no over-return, duplicate refund or false restock.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Return only original eligible quantity/cost/tax snapshots; no over-return, duplicate refund or false restock. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-209 — CSV import/export and barcode integration

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-202, SS-ELEC-205.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Extend legacy-compatible CSV templates and exports; validate unit/package barcode identity without formula injection.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Extend legacy-compatible CSV templates and exports; validate unit/package barcode identity without formula injection. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-210 — Tax/ETA and offline compatibility

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-207, SS-ELEC-208.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Version offline unit/package payloads; stale rules conflict; preserve request retries and frozen ETA mapping.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Version offline unit/package payloads; stale rules conflict; preserve request retries and frozen ETA mapping. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-211 — Reporting and margin compatibility

- Epic / priority / owner: E2 / P0 / Shop domain/database.
- Dependencies: SS-ELEC-205, SS-ELEC-207, SS-ELEC-208.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Group quantities by compatible units; preserve authorized FIFO COGS, margin, supplier and customer reports.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Group quantities by compatible units; preserve authorized FIFO COGS, margin, supplier and customer reports. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-301 — Electrical technical attributes

- Epic / priority / owner: E3 / P1 / Shop feature.
- Dependencies: SS-ELEC-102.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Store reusable typed technical attributes; distinguish cable cross-section from stock unit and support search.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Store reusable typed technical attributes; distinguish cable cross-section from stock unit and support search. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete bilingual browser coverage, full current-head regression qualification and external merchant/device acceptance remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-302 — Product variants and SKU strategy

- Epic / priority / owner: E3 / P1 / Shop feature.
- Dependencies: SS-ELEC-301.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Give each stocked color/size its own SKU and stock; optional family does not merge balances.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Give each stocked color/size its own SKU and stock; optional family does not merge balances. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete bilingual browser coverage, full current-head regression qualification and external merchant/device acceptance remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-303 — First-class cable reels/drums

- Epic / priority / owner: E3 / P1 / Shop feature.
- Dependencies: SS-ELEC-205, SS-ELEC-202.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Identify physical reels by product/location/batch/barcode with original and remaining length tied to FIFO.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Identify physical reels by product/location/batch/barcode with original and remaining length tied to FIFO. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete bilingual browser coverage, full current-head regression qualification and external merchant/device acceptance remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-304 — Continuous cable-length allocation

- Epic / priority / owner: E3 / P1 / Shop feature.
- Dependencies: SS-ELEC-303.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Reject continuous80m from two50m reels; allow explicit split allocation only when requested and valid.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Reject continuous80m from two50m reels; allow explicit split allocation only when requested and valid. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete bilingual browser coverage, full current-head regression qualification and external merchant/device acceptance remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-305 — Cutting operations and audit trail

- Epic / priority / owner: E3 / P1 / Shop feature.
- Dependencies: SS-ELEC-304, SS-ELEC-204.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Atomically record reel cut, actor, sale/order, requested/actual/loss and resulting FIFO stock.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Atomically record reel cut, actor, sale/order, requested/actual/loss and resulting FIFO stock. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete bilingual browser coverage, full current-head regression qualification and external merchant/device acceptance remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-306 — Cable remnants and scrap

- Epic / priority / owner: E3 / P1 / Shop feature.
- Dependencies: SS-ELEC-305.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Track sellable/discounted/damaged/scrap remnants with auditable quantity and valuation effects.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Track sellable/discounted/damaged/scrap remnants with auditable quantity and valuation effects. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete bilingual browser coverage, full current-head regression qualification and external merchant/device acceptance remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-307 — Cable return and damage policies

- Epic / priority / owner: E3 / P1 / Shop feature.
- Dependencies: SS-ELEC-306, SS-ELEC-208.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Apply configurable unopened/cut/damaged return policies and approvals using original sale lineage.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Apply configurable unopened/cut/damaged return policies and approvals using original sale lineage. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete bilingual browser coverage, full current-head regression qualification and external merchant/device acceptance remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-308 — Reel-level inventory and reports

- Epic / priority / owner: E3 / P1 / Shop feature.
- Dependencies: SS-ELEC-305, SS-ELEC-306.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Paginate reel movements and report remaining/reserved/continuous lengths, scrap and valuation.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Paginate reel movements and report remaining/reserved/continuous lengths, scrap and valuation. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete bilingual browser coverage, full current-head regression qualification and external merchant/device acceptance remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-401 — Customer groups

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-107.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Maintain tenant-scoped configurable customer groups without changing existing balances or privacy.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Maintain tenant-scoped configurable customer groups without changing existing balances or privacy. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Forward migration20261023202711, TRADE-PRICING.md, public-command SQL scenarios and generated schema contract; local109-migration replay passes merchant/role/expiry/override/legacy/unit-reconfiguration cases and existing regressions. Shared editor, POS and sales adapters are implemented; final merged qualification and native CI remain pending.
- PR / commit: Local feature `codex/shop-suit/trade-customer-pricing`, initially based on published qualification checkpoint6bb408b5. Stacked PR pending final qualification.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-402 — Quantity-break and customer-specific pricing

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-401, SS-ELEC-203.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Resolve contract/group/quantity/package/base precedence server-side; freeze prices and authorized overrides.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Resolve contract/group/quantity/package/base precedence server-side; freeze prices and authorized overrides. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Forward migration20261023202711, TRADE-PRICING.md, public-command SQL scenarios and generated schema contract; local109-migration replay passes merchant/role/expiry/override/legacy/unit-reconfiguration cases and existing regressions. Shared editor, POS and sales adapters are implemented; final merged qualification and native CI remain pending.
- PR / commit: Local feature `codex/shop-suit/trade-customer-pricing`, initially based on published qualification checkpoint6bb408b5. Stacked PR pending final qualification.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-403 — Quotations and revisions

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-402, SS-ELEC-207.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Version quotations with validity, taxes, agreed measurements, explicit transitions and immutable issued history.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Version quotations with validity, taxes, agreed measurements, explicit transitions and immutable issued history. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-404 — Sales orders

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-403.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Convert accepted quote to order retaining agreed prices and preventing duplicate conversion.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Convert accepted quote to order retaining agreed prices and preventing duplicate conversion. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-405 — Stock reservation

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-404, SS-ELEC-304.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Reserve canonical location/reel stock atomically; release expiry/cancellation; concurrent orders cannot overallocate.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Reserve canonical location/reel stock atomically; release expiry/cancellation; concurrent orders cannot overallocate. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-406 — Deposits and partial fulfillment

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-405, SS-ELEC-208.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Reconcile deposits and partial deliveries with existing payment/invoice ledgers and no duplicate stock deduction.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Reconcile deposits and partial deliveries with existing payment/invoice ledgers and no duplicate stock deduction. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-407 — Supplier purchase orders

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-201.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Issue supplier purchase orders with measured/package lines; ordering alone never creates stock.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Issue supplier purchase orders with measured/package lines; ordering alone never creates stock. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-408 — Partial supplier deliveries

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-407, SS-ELEC-205.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Receive6 of10 reels, retain4 outstanding; retry does not double receive or duplicate supplier debt.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Receive6 of10 reels, retain4 outstanding; retry does not double receive or duplicate supplier debt. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-501 — Bin/shelf location tracking

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-205.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Track tenant/location bin and shelf positions without disconnected inventory balances.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Track tenant/location bin and shelf positions without disconnected inventory balances. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-502 — Supplier item codes and lead times

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-201.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Maintain supplier-specific item references, package choices and lead times with scoped access.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Maintain supplier-specific item references, package choices and lead times with scoped access. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-503 — Supplier price history

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-502.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Preserve historical supplier purchase unit/price/currency snapshots and paginated comparisons.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Preserve historical supplier purchase unit/price/currency snapshots and paginated comparisons. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-504 — Weight barcode compatibility

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-204, SS-ELEC-209.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Support only verified GS1/market variable-measure formats with checksums and bounded values; normal barcodes unchanged.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Support only verified GS1/market variable-measure formats with checksums and bounded values; normal barcodes unchanged. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-505 — Electronic scale integration

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-504.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Use an optional supported scale adapter with stable/tare/net readings, units, failures and staff confirmation.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Use an optional supported scale adapter with stable/tare/net readings, units, failures and staff confirmation. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-506 — Optional weight-to-length conversions

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-104, SS-ELEC-505.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Require approved versioned product-specific mass/length relationship; reject universal cross-dimensional conversion.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Require approved versioned product-specific mass/length relationship; reject universal cross-dimensional conversion. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-507 — Demand and reorder forecasting

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-211, SS-ELEC-502.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Derive explainable canonical reorder suggestions from scoped demand/lead times; no automatic stock writes.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Derive explainable canonical reorder suggestions from scoped demand/lead times; no automatic stock writes. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-508 — Optional commodity-based pricing

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-402, SS-ELEC-503.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Introduce commodity rules only with justified source, currency, effective time and frozen authoritative pricing.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Introduce commodity rules only with justified source, currency, effective time and frozen authoritative pricing. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-601 — Product limit and plan suitability review

- Epic / priority / owner: E6 / P2 / QA.
- Dependencies: SS-ELEC-000.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Review 1000s-SKU plan capacity and performance without changing approved commercial prices/entitlements.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Review 1000s-SKU plan capacity and performance without changing approved commercial prices/entitlements. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-602 — Authorization and tenant-isolation verification

- Epic / priority / owner: E6 / P0 / QA.
- Dependencies: SS-ELEC-107, SS-ELEC-210, SS-ELEC-405.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Verify all new RPC/table grants, roles, RLS, cross-tenant/location denial and immutable historical objects.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Verify all new RPC/table grants, roles, RLS, cross-tenant/location denial and immutable historical objects. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Qualification child passes478 Shop units and the merged repository gate (2026 pass, zero fail,23 skip). Eight built public-site isolation scenarios, actual Pinia/Colada account-switch/cancelled-response cases, six EN/AR electrical browser cases and the108-migration replay with17 legacy suites/two races pass. Native parent15b52a32 measured-retail/media/accounts CI passes. Trade/reservation implementation and final combined qualification remain open; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-603 — Database concurrency and idempotency verification

- Epic / priority / owner: E6 / P0 / QA.
- Dependencies: SS-ELEC-205, SS-ELEC-305, SS-ELEC-405, SS-ELEC-408.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Run real concurrent cashiers/reels/reservations and duplicate purchase/sale UUIDs; no oversell/duplicate movements.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Run real concurrent cashiers/reels/reservations and duplicate purchase/sale UUIDs; no oversell/duplicate movements. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Qualification child passes478 Shop units and the merged repository gate (2026 pass, zero fail,23 skip). Eight built public-site isolation scenarios, actual Pinia/Colada account-switch/cancelled-response cases, six EN/AR electrical browser cases and the108-migration replay with17 legacy suites/two races pass. Native parent15b52a32 measured-retail/media/accounts CI passes. Trade/reservation implementation and final combined qualification remain open; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-604 — Full English/Arabic UI qualification

- Epic / priority / owner: E6 / P1 / QA.
- Dependencies: SS-ELEC-105, SS-ELEC-204, SS-ELEC-308, SS-ELEC-406.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Execute EN/AR RTL/LTR both themes desktop/mobile keyboard/screen-reader and all operation states.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Execute EN/AR RTL/LTR both themes desktop/mobile keyboard/screen-reader and all operation states. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-605 — Existing Shop regression qualification

- Epic / priority / owner: E6 / P0 / QA.
- Dependencies: SS-ELEC-210, SS-ELEC-211, SS-ELEC-406.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Run affected original product/service/payment/tax/bundle/return/reporting regressions without weakening assertions.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Run affected original product/service/payment/tax/bundle/return/reporting regressions without weakening assertions. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Qualification child passes478 Shop units and the merged repository gate (2026 pass, zero fail,23 skip). Eight built public-site isolation scenarios, actual Pinia/Colada account-switch/cancelled-response cases, six EN/AR electrical browser cases and the108-migration replay with17 legacy suites/two races pass. Native parent15b52a32 measured-retail/media/accounts CI passes. Trade/reservation implementation and final combined qualification remain open; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-606 — Disposable database and E2E integration tests

- Epic / priority / owner: E6 / P0 / QA.
- Dependencies: SS-ELEC-602, SS-ELEC-603, SS-ELEC-604, SS-ELEC-605.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Run full migrated disposable DB plus browser merchant journey; record every pass/failure/skipped gate.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Run full migrated disposable DB plus browser merchant journey; record every pass/failure/skipped gate. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: Qualification child passes478 Shop units and the merged repository gate (2026 pass, zero fail,23 skip). Eight built public-site isolation scenarios, actual Pinia/Colada account-switch/cancelled-response cases, six EN/AR electrical browser cases and the108-migration replay with17 legacy suites/two races pass. Native parent15b52a32 measured-retail/media/accounts CI passes. Trade/reservation implementation and final combined qualification remain open; see VERIFICATION.md.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-607 — Merchant pilot acceptance scenarios

- Epic / priority / owner: E6 / P2 / QA.
- Dependencies: SS-ELEC-606.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Obtain real merchant review of cable, copper and piece journey including printed receipt and balances.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Obtain real merchant review of cable, copper and piece journey including printed receipt and balances. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-608 — Release-readiness review and handoff

- Epic / priority / owner: E6 / P0 / Release.
- Dependencies: SS-ELEC-607, SS-ELEC-601, SS-ELEC-001.
- Status: NOT_STARTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Bind exact candidate SHA, migrations, security/regression/pilot and production evidence before release handoff.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Bind exact candidate SHA, migrations, security/regression/pilot and production evidence before release handoff. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Dependent implementations and required gates above remain pending.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.
