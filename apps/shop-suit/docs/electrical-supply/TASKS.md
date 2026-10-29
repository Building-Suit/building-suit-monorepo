# SS-ELECTRICAL-001 task ledger

Current tracker reconciliation: [readiness gates](READINESS-GATES-2026-10-29.md), [all55 reconciliation proof](TRACKER-RECONCILIATION-2026-10-29.json), [current scope](REMAINING-SCOPE-2026-10-29.md). #441 is merged; preserved current source checkpoint is11be3b3d. Historical evidence is explicitly labeled below; it is not current exact-head acceptance.

Previous independent evidence review: [2026-10-29 audit](AUDIT-2026-10-29.md) and [all55 task source/test mappings](AUDIT-2026-10-29.json). The per-task labels and dated evidence below retain their historical scope; they do not establish current combined acceptance. The unpublished recovery checkpoint is absent from this workspace.

Status authority for this initiative only. Source/test execution differs from deployment. Allowed states: NOT_STARTED, IN_PROGRESS, IMPLEMENTED, TESTED, VERIFIED, BLOCKED, DEFERRED, CANCELLED. The measured-retail child implements canonical precision and the first merchant workflow. SQL execution and UI qualification are tracked separately; physical reel and trade implementations are present in the merged Shop stack; final native, merchant/device and commercial qualification remain open.

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
- Historical evidence: AUDIT.md and PRECISION-AUDIT.md
- Evidence: All55 source/test mappings and applied-source identity are inventoried; local120-migration replay and scoped checks are recorded. Full semantic acceptance and unavailable hosted-history reconciliation remain separate. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete requirement-by-requirement current-source evidence audit; hosted history remains access-bound.
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
- Historical evidence: RELEASE-RECONCILIATION.md; production catalog503/config403/failed publisher
- Evidence: Protected staging97c1f50e review/verify passed; publisher alone stopped at production baseline acknowledgment. Recorded production baseline/existing receipt/operator binding remains unresolved; no denied read was retried. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Existing production baseline SHA/receipt and verified catalog binding; guarded catalog publication held.
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
- Historical evidence: README.md, REQUIREMENTS.md and this ledger
- Evidence: All55 tracker entries reconciled at11be3b3d source checkpoint, preserving prior evidence/PR references as historical. No task is promoted to VERIFIED by this documentation reconciliation. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Reconcile all55 tracker entries against integrated source and precise tests; historical statuses are not completion.
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
- Historical evidence: ARCHITECTURE.md, DECISIONS.md and MIGRATION-PLAN.md
- Evidence: ARCHITECTURE.md, DECISIONS.md and current public-command implementation are retained; no second measurement/financial authority was introduced. Full semantic traceability remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Finish design/requirement traceability; preserve established measurement/financial authorities.
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
- Historical evidence: RELEASE-PLAN.md; draft only
- Evidence: Curated release fragments/current-net-diff inventory and normal provenance checks are retained. Publication still waits for supported catalog baseline/receipt recovery; no versions/times are invented. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Curate actual net-diff release notes; preserve accepted fragments and wait for supported catalog publication.
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
- Historical evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- Evidence: 120-migration local schema replay passes foundation/registry/conversion and both merchant fixtures; the27-unit group includes measurement/quantity/cart/receipt checks. Final native/full-workspace evidence remains required. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Confirm complete registry taxonomy and inactive-unit denial in final native schema.
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
- Historical evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- Evidence: 120-migration local schema replay passes foundation/registry/conversion and both merchant fixtures; the27-unit group includes measurement/quantity/cart/receipt checks. Final native/full-workspace evidence remains required. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Confirm canonical units and locked/legacy-product behavior in final native schema.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local schema replay passes foundation/registry/conversion and both merchant fixtures; the27-unit group includes measurement/quantity/cart/receipt checks. Final native/full-workspace evidence remains required. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Audit exact quantity precision across all receipts, returns, imports, reporting and historical columns.
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
- Historical evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- Evidence: 120-migration local schema replay passes foundation/registry/conversion and both merchant fixtures; the27-unit group includes measurement/quantity/cart/receipt checks. Final native/full-workspace evidence remains required. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Qualify real-session conversions, invalid dimensions/precision and server-authoritative amounts.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local schema replay passes foundation/registry/conversion and both merchant fixtures; the27-unit group includes measurement/quantity/cart/receipt checks. Final native/full-workspace evidence remains required. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete measurement editor state matrix, keyboard/RTL and external native-Arabic review.
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
- Historical evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- Evidence: 120-migration local schema replay passes foundation/registry/conversion and both merchant fixtures; the27-unit group includes measurement/quantity/cart/receipt checks. Final native/full-workspace evidence remains required. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Verify upgrades against retained legacy transactions; never reinterpret historical quantities.
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
- Historical evidence: Forward migration20261022185512, app/utils/measurement.js, shop_measurement_foundation.sql and disposable schema runner. Core tests pass; full Supabase/provider/operational acceptance remains pending.
- Evidence: 120-migration local schema replay passes foundation/registry/conversion and both merchant fixtures; the27-unit group includes measurement/quantity/cart/receipt checks. Final native/full-workspace evidence remains required. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #441, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Close final role/tenant/location and direct-write/private-helper denial evidence.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Real Auth purchase-unit browser-to-RPC qualification; retain supplier cost/quantity invariants.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Packaging editor and versioned historical conversion qualification across roles.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Verify exact package/unit prices through actual sale/payment and refund authorities.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Real Auth POS financial browser flow; unpublished checkout recovery awaits original archive.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Final native FIFO/stock races and actual counter/fulfillment consistency.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete native count/correction/threshold browser and location-isolation evidence.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Verify immutable receipt snapshots, actual printer output and original values after catalog edits.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Final original-cost partial-return/refund qualification and genuine merchant recovery procedure.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete CSV/barcode browser integration and real scanner acceptance; no synthetic hardware claim.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Original unpublished offline/atomic recovery is missing; ETA live setup/acceptance is separate.
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
- Historical evidence: Measured-retail forward migrations, shared editor/POS/purchasing/sales/returns projections, shop_measured_retail.sql and measured-cart.test.mjs. Full task qualification remains pending.
- Evidence: 120-migration local measured merchant and new mixed/FIFO public-command companion pass;48-case synthetic browser group includes measured cart/settings. Two actual-Auth electrical browser cases are implemented/discovered, not executed. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #445, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Full reporting/margin regressions across quantity/tax/returns/partial fulfillment and RTL.
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
- Historical evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- Evidence: 120-migration physical reel merchant and actual-session reel race pass in provider-stand-in scope;48-case synthetic group covers count/cut/supplier-return controls. Device/merchant/native electrical-reel execution remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #450, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Current technical search/editor exact-head browser qualification and large catalog behavior.
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
- Historical evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- Evidence: 120-migration physical reel merchant and actual-session reel race pass in provider-stand-in scope;48-case synthetic group covers count/cut/supplier-return controls. Device/merchant/native electrical-reel execution remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #450, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Verify independently identified SKU/variant stock, imports and search; do not merge variant inventories.
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
- Historical evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- Evidence: 120-migration physical reel merchant and actual-session reel race pass in provider-stand-in scope;48-case synthetic group covers count/cut/supplier-return controls. Device/merchant/native electrical-reel execution remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #450, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Native reel lifecycle and merchant drum/reel identification acceptance.
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
- Historical evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- Evidence: 120-migration physical reel merchant and actual-session reel race pass in provider-stand-in scope;48-case synthetic group covers count/cut/supplier-return controls. Device/merchant/native electrical-reel execution remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #450, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Final real-session continuous length/allocation and partial physical reel qualification.
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
- Historical evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- Evidence: 120-migration physical reel merchant and actual-session reel race pass in provider-stand-in scope;48-case synthetic group covers count/cut/supplier-return controls. Device/merchant/native electrical-reel execution remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #450, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Current native cut/race/audit/role gates plus actual counter acceptance.
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
- Historical evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- Evidence: 120-migration physical reel merchant and actual-session reel race pass in provider-stand-in scope;48-case synthetic group covers count/cut/supplier-return controls. Device/merchant/native electrical-reel execution remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #450, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Remnant/scrap history and downstream report reconciliation in final merchant journey.
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
- Historical evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- Evidence: 120-migration physical reel merchant and actual-session reel race pass in provider-stand-in scope;48-case synthetic group covers count/cut/supplier-return controls. Device/merchant/native electrical-reel execution remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #450, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Returned/opened/damaged reel policy, permission and original-cost verification.
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
- Historical evidence: Local reel/catalog source and disposable SQL journey implemented. Full 107-migration replay, original-cost cuts/loss, supplier withdrawals, return approval policy and actual two-cashier serialization pass. Focused unit checks pass. Browser qualification and final current-head CI remain in progress; see VERIFICATION.md.
- Evidence: 120-migration physical reel merchant and actual-session reel race pass in provider-stand-in scope;48-case synthetic group covers count/cut/supplier-return controls. Device/merchant/native electrical-reel execution remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #450, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Reconcile reel-level reporting/stock counts with real measured merchant operations.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-401 — Customer groups

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-107.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Maintain tenant-scoped configurable customer groups without changing existing balances or privacy.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Maintain tenant-scoped configurable customer groups without changing existing balances or privacy. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: Forward migration20261023202711, TRADE-PRICING.md, public-command SQL scenarios and generated schema contract; local109-migration replay passes merchant/role/expiry/override/legacy/unit-reconfiguration cases and existing regressions. Shared editor, POS and sales adapters are implemented; final merged qualification and native CI remain pending.
- Evidence: 48-case synthetic group covers group/rule retry and quoted POS prices; inherited exact769 native qualification is historical. New exact-head native/full regression still required. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #460, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Local feature `codex/shop-suit/trade-customer-pricing`, initially based on published qualification checkpoint6bb408b5. Stacked PR pending final qualification.
- Blocker: Final native customer-group role, tenant and historical price snapshot verification.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-402 — Quantity-break and customer-specific pricing

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-401, SS-ELEC-203.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Resolve contract/group/quantity/package/base precedence server-side; freeze prices and authorized overrides.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Resolve contract/group/quantity/package/base precedence server-side; freeze prices and authorized overrides. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: Forward migration20261023202711, TRADE-PRICING.md, public-command SQL scenarios and generated schema contract; local109-migration replay passes merchant/role/expiry/override/legacy/unit-reconfiguration cases and existing regressions. Shared editor, POS and sales adapters are implemented; final merged qualification and native CI remain pending.
- Evidence: 48-case synthetic group covers group/rule retry and quoted POS prices; inherited exact769 native qualification is historical. New exact-head native/full regression still required. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #460, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Local feature `codex/shop-suit/trade-customer-pricing`, initially based on published qualification checkpoint6bb408b5. Stacked PR pending final qualification.
- Blocker: Real Auth customer/quantity-break pricing-to-sale flow and original agreed price preservation.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-403 — Quotations and revisions

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-402, SS-ELEC-207.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Version quotations with validity, taxes, agreed measurements, explicit transitions and immutable issued history.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Version quotations with validity, taxes, agreed measurements, explicit transitions and immutable issued history. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: Forward migration20261023215636, public-command quote/role/expiry SQL suite, generated schema types, shared quotation editor/history/print presentation and scoped adapter. Local110-migration replay and14-suite regression matrix passed; both bilingual version/retry/history/print journeys pass. Final combined-head checks and native CI remain pending.
- Evidence: 48-case synthetic group covers frozen quote versions/history/transition retry. Historical native769 evidence does not replace current exact-head verification. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #463, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Local `codex/shop-suit/formal-quotations`, based on published pricing PR460 and forward-merged parent8b951073. Draft [PR463](https://github.com/Building-Suit/building-suit-monorepo/pull/463), feature869d4df4; combined typecheck/build and repository suite pass.
- Blocker: Complete native quote versions/expiry/role guards and EN/AR browser state matrix.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-404 — Sales orders

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-403.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Convert accepted quote to order retaining agreed prices and preventing duplicate conversion.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Convert accepted quote to order retaining agreed prices and preventing duplicate conversion. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: Forward migration20261023222339, public-command shop_trade_orders.sql and shared order page. Local111-migration replay, quotation/order SQL cases, large exact-money transport and both bilingual conversion/retry browser cases pass. Reservation/fulfillment remain separate open tasks.
- Evidence: 48-case synthetic group covers accepted-quote/order flows; current actual-session order/reservation races pass with provider stand-ins. Exact-head native browser/financial execution remains pending. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #464, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#464](https://github.com/Building-Suit/building-suit-monorepo/pull/464); conversion commit `841ed28f`, published checkpoint `e70ec48c`.
- Blocker: Final native accepted-quote conversion/idempotency and immutable source evidence.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-405 — Stock reservation

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-404, SS-ELEC-304.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Reserve canonical location/reel stock atomically; release expiry/cancellation; concurrent orders cannot overallocate.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Reserve canonical location/reel stock atomically; release expiry/cancellation; concurrent orders cannot overallocate. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: 112-migration replay and reservation SQL pass, including repeated-SKU replacement, POS availability, expiry and deferred count/scrap capacity checks. Two actual order/stock races pass. Both EN/AR reservation/retry journeys, read-only controls and both inherited conversion cases pass (5/5); all12 existing measured/reel/pricing/quotation cases pass separately. Native combined-head and merchant/device qualification remain open; see VERIFICATION.md.
- Evidence: Current actual-session reservation/stock/collection races pass with provider stand-ins;48-case synthetic browser group covers EN/AR reservation/release/retry and denied controls. Current native browser execution remains pending. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #464, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#464](https://github.com/Building-Suit/building-suit-monorepo/pull/464); reservation implementation pending verified commit.
- Blocker: Native concurrency and location/reel reservation denial on final source; staged partial release recovery.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-406 — Deposits and partial fulfillment

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-405, SS-ELEC-208.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Reconcile deposits and partial deliveries with existing payment/invoice ledgers and no duplicate stock deduction.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Reconcile deposits and partial deliveries with existing payment/invoice ledgers and no duplicate stock deduction. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: Migration20261025164827 extends existing receipts/allocations and issues ordinary invoices for partial collections. Local113-migration replay,19 SQL suites, both merchant journeys, six real-session races, cash-drawer reconciliation and all22 distinct order/measured browser cases pass across recorded scoped runs. Root2032/2055 pass, zero fail,23 skip. See VERIFICATION.md for final label/consumer and native gates.
- Evidence: 48-case synthetic group covers deposits/refunds/partial collections/read-only/error states; current actual-session collection races pass in schema scope. Genuine Auth financial execution and merchant acceptance remain open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #464, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#464](https://github.com/Building-Suit/building-suit-monorepo/pull/464), targeting formal quotations #463; deposit/collection source7f532d73 published; final local consumer/browser checks pass.
- Blocker: Actual Auth deposit/collection/partial delivery financial browser journey; exact accounting/receipt assertions.
- Completion notes / release fragment: Local implementation tested. Public fragment `ss-electrical-order-deposits-collections-20261025`; internal support `ss-electrical-order-funding-qualification-20261025`. No production availability claim.

## SS-ELEC-407 — Supplier purchase orders

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-201.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Issue supplier purchase orders with measured/package lines; ordering alone never creates stock.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Issue supplier purchase orders with measured/package lines; ordering alone never creates stock. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: The114-migration combined fixture passes20 SQL suites, both merchant journeys and eight real-session races. New supplier cases prove original units/cost, six then four receipts, retry/conflict, closed-period/plan/role/location denial and no stock/debt on ordering. All five final built browser cases pass in one run; both strengthened viewport journeys also pass. Shop typecheck/build, scoped lint, strict boundaries and committed release coverage pass; final shared/native qualification remains pending. See PURCHASING.md and VERIFICATION.md.
- Evidence: 48-case synthetic group covers six-then-four supplier deliveries, stale retry and read-only guards; current actual-session receipt races pass in schema scope. Final native/merchant evidence remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #487, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Draft [#487](https://github.com/Building-Suit/building-suit-monorepo/pull/487), source1bcdcf22, targets contractor orders #464. Native measured-retail/review/website and full local root checks pass; final initiative gates remain separate.
- Blocker: Final supplier-order roles/tenant/closed-period and no-posting-before-receipt qualification.
- Completion notes / release fragment: Local implementation tested; public `ss-electrical-supplier-orders-receiving-20261025`, internal `ss-electrical-supplier-receiving-qualification-20261025`. Native, hosted and merchant/device gates remain separate.

## SS-ELEC-408 — Partial supplier deliveries

- Epic / priority / owner: E4 / P1 / Shop feature.
- Dependencies: SS-ELEC-407, SS-ELEC-205.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Receive6 of10 reels, retain4 outstanding; retry does not double receive or duplicate supplier debt.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Receive6 of10 reels, retain4 outstanding; retry does not double receive or duplicate supplier debt. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: The114-migration combined fixture passes20 SQL suites, both merchant journeys and eight real-session races. New supplier cases prove original units/cost, six then four receipts, retry/conflict, closed-period/plan/role/location denial and no stock/debt on ordering. All five final built browser cases pass in one run; both strengthened viewport journeys also pass. Shop typecheck/build, scoped lint, strict boundaries and committed release coverage pass; final shared/native qualification remains pending. See PURCHASING.md and VERIFICATION.md.
- Evidence: 48-case synthetic group covers six-then-four supplier deliveries, stale retry and read-only guards; current actual-session receipt races pass in schema scope. Final native/merchant evidence remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #487, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Draft [#487](https://github.com/Building-Suit/building-suit-monorepo/pull/487), source1bcdcf22, targets contractor orders #464. Native measured-retail/review/website and full local root checks pass; final initiative gates remain separate.
- Blocker: Actual partial supplier delivery/race/retry and original debt/cost reconciliation.
- Completion notes / release fragment: Local implementation tested; public `ss-electrical-supplier-orders-receiving-20261025`, internal `ss-electrical-supplier-receiving-qualification-20261025`. Native, hosted and merchant/device gates remain separate.

## SS-ELEC-501 — Bin/shelf location tracking

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-205.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Track tenant/location bin and shelf positions without disconnected inventory balances.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Track tenant/location bin and shelf positions without disconnected inventory balances. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: Final115-migration replay passes21 selected SQL suites, both merchant journeys and eight inherited races. All10 final planning/recovery/report-export and inherited reel browsers pass. Actual types, Shop typecheck/build, scoped lint,120-template boundaries/architecture and root2034/2057 (zero fail,23 skip) pass. See SUPPLY-PLANNING.md and VERIFICATION.md for scoped evidence and open native/final gates.
- Evidence: 48-case synthetic group covers supply-planning controls. Published implementation/migration is present; historical native769 evidence is retained separately. Exact-head native and merchant suitability remain open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #490, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Draft [#490](https://github.com/Building-Suit/building-suit-monorepo/pull/490), sourcec7bc466b, targets #487 at1bcdcf22. Exact-source native review, measured and website checks pass.
- Blocker: Bin/shelf counts, relocation and location-isolation browser/native qualification.
- Completion notes / release fragment: Local implementation tested. Public `ss-electrical-storage-supplier-planning-20261025`; internal `ss-electrical-supply-planning-qualification-20261025`. No hosted or merchant/device completion claim.

## SS-ELEC-502 — Supplier item codes and lead times

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-201.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Maintain supplier-specific item references, package choices and lead times with scoped access.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Maintain supplier-specific item references, package choices and lead times with scoped access. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: Final115-migration replay passes21 selected SQL suites, both merchant journeys and eight inherited races. All10 final planning/recovery/report-export and inherited reel browsers pass. Actual types, Shop typecheck/build, scoped lint,120-template boundaries/architecture and root2034/2057 (zero fail,23 skip) pass. See SUPPLY-PLANNING.md and VERIFICATION.md for scoped evidence and open native/final gates.
- Evidence: 48-case synthetic group covers supply-planning controls. Published implementation/migration is present; historical native769 evidence is retained separately. Exact-head native and merchant suitability remain open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #490, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Draft [#490](https://github.com/Building-Suit/building-suit-monorepo/pull/490), sourcec7bc466b, targets #487 at1bcdcf22. Exact-source native review, measured and website checks pass.
- Blocker: Supplier item codes/lead-time version/history and tenant/location validation.
- Completion notes / release fragment: Local implementation tested. Public `ss-electrical-storage-supplier-planning-20261025`; internal `ss-electrical-supply-planning-qualification-20261025`. No hosted or merchant/device completion claim.

## SS-ELEC-503 — Supplier price history

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-502.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Preserve historical supplier purchase unit/price/currency snapshots and paginated comparisons.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Preserve historical supplier purchase unit/price/currency snapshots and paginated comparisons. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: Final115-migration replay passes21 selected SQL suites, both merchant journeys and eight inherited races. All10 final planning/recovery/report-export and inherited reel browsers pass. Actual types, Shop typecheck/build, scoped lint,120-template boundaries/architecture and root2034/2057 (zero fail,23 skip) pass. See SUPPLY-PLANNING.md and VERIFICATION.md for scoped evidence and open native/final gates.
- Evidence: 48-case synthetic group covers supply-planning controls. Published implementation/migration is present; historical native769 evidence is retained separately. Exact-head native and merchant suitability remain open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #490, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Draft [#490](https://github.com/Building-Suit/building-suit-monorepo/pull/490), sourcec7bc466b, targets #487 at1bcdcf22. Exact-source native review, measured and website checks pass.
- Blocker: Original supplier price history retention and purchasing/report browser qualification.
- Completion notes / release fragment: Local implementation tested. Public `ss-electrical-storage-supplier-planning-20261025`; internal `ss-electrical-supply-planning-qualification-20261025`. No hosted or merchant/device completion claim.

## SS-ELEC-504 — Weight barcode compatibility

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-204, SS-ELEC-209.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Support only verified GS1/market variable-measure formats with checksums and bounded values; normal barcodes unchanged.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Support only verified GS1/market variable-measure formats with checksums and bounded values; normal barcodes unchanged. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: BARCODES.md. Full116-migration replay passes22 selected SQL suites, both merchant journeys and eight inherited races. Eight POS/barcode units, root2038/2061 (zero failures,23 skips), Shop build/typecheck, Docs typecheck, app/shared lint, strict120-template ownership and committed release coverage pass. All13 final built EN/AR barcode/retail/reel/trade cases pass, including stock shared with offers/manual lines and reachable mobile payment controls. Native/final consumer and external acceptance remain separate.
- Evidence: 48-case synthetic group covers verified/invalid weight labels and retained checkout requests. Real scanner/label-provider acceptance and current native financial execution remain open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #493, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Child `codex/shop-suit/weight-barcodes` starts from published #490 atc7bc466b; published [#493](https://github.com/Building-Suit/building-suit-monorepo/pull/493), sourceb0e467f1, includes implementatione14f4ab6 and mobile viewport fix8ebebaff. Stack and committed release checks pass; native review and measured checks pass, website qualification still running at this checkpoint.
- Blocker: GS1 parser/configuration native and real scanner-label acceptance.
- Completion notes / release fragment: Local implementation tested. Public `ss-electrical-verified-weight-barcodes-20261025`; internal `ss-electrical-weight-barcode-qualification-20261025`. No hosted or merchant/device completion claim.

## SS-ELEC-505 — Electronic scale integration

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-504.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Use an optional supported scale adapter with stable/tare/net readings, units, failures and staff confirmation.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Use an optional supported scale adapter with stable/tare/net readings, units, failures and staff confirmation. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: SCALES.md and VERIFICATION.md. Focused protocol/transport/conversion/malformed-reader units pass16/16; expanded117-migration scoped SQL and three new capture races pass with both merchant journeys and inherited races. All19 combined EN/AR scale/setup and inherited measured/reel/trade/GS1 browsers pass. Full117-migration replay,21 named regression suites plus foundation/both journeys and11 races pass; actual types match. Shop build/typecheck, scoped lint and121-template boundaries pass. Final root2054/2077 (zero fail,23 skip), Shop/Docs typechecks, committed release and separate final6-case built run pass. All three critical exact-source native jobs pass; physical hardware acceptance is separate.
- Evidence: 48-case synthetic group covers capture/factor/profile/retry/manual fallback; current actual-session capture races pass with provider stand-ins. Actual approved device, provider/native and merchant acceptance remain open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #496, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Child `codex/shop-suit/scale-and-mass-length` starts from published [#493](https://github.com/Building-Suit/building-suit-monorepo/pull/493) atb0e467f1; published [#496](https://github.com/Building-Suit/building-suit-monorepo/pull/496), sourceb02f38f6. Native review121554177623, measured121554177774 and website121554178377 pass.
- Blocker: Approved scale profile/native capture integration plus actual device/operator acceptance.
- Completion notes / release fragment: Locally tested implementation. Public `ss-electrical-approved-scale-sales-20261026`; internal `ss-electrical-scale-qualification-20261026`. No physical-hardware or commercial completion claim.

## SS-ELEC-506 — Optional weight-to-length conversions

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-104, SS-ELEC-505.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Require approved versioned product-specific mass/length relationship; reject universal cross-dimensional conversion.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Require approved versioned product-specific mass/length relationship; reject universal cross-dimensional conversion. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: SCALES.md and VERIFICATION.md. Focused protocol/transport/conversion/malformed-reader units pass16/16; expanded117-migration scoped SQL and three new capture races pass with both merchant journeys and inherited races. All19 combined EN/AR scale/setup and inherited measured/reel/trade/GS1 browsers pass. Full117-migration replay,21 named regression suites plus foundation/both journeys and11 races pass; actual types match. Shop build/typecheck, scoped lint and121-template boundaries pass. Final root2054/2077 (zero fail,23 skip), Shop/Docs typechecks, committed release and separate final6-case built run pass. All three critical exact-source native jobs pass; physical hardware acceptance is separate.
- Evidence: 48-case synthetic group covers capture/factor/profile/retry/manual fallback; current actual-session capture races pass with provider stand-ins. Actual approved device, provider/native and merchant acceptance remain open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #496, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Child `codex/shop-suit/scale-and-mass-length` starts from published [#493](https://github.com/Building-Suit/building-suit-monorepo/pull/493) atb0e467f1; published [#496](https://github.com/Building-Suit/building-suit-monorepo/pull/496), sourceb02f38f6. Native review121554177623, measured121554177774 and website121554178377 pass.
- Blocker: Validate optional mass/length profiles, captured source and original conversion history; no assumed physical equivalence.
- Completion notes / release fragment: Locally tested implementation. Public `ss-electrical-approved-scale-sales-20261026`; internal `ss-electrical-scale-qualification-20261026`. No physical-hardware or commercial completion claim.

## SS-ELEC-507 — Demand and reorder forecasting

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-211, SS-ELEC-502.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Derive explainable canonical reorder suggestions from scoped demand/lead times; no automatic stock writes.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Derive explainable canonical reorder suggestions from scoped demand/lead times; no automatic stock writes. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: Final115-migration replay passes21 selected SQL suites, both merchant journeys and eight inherited races. All10 final planning/recovery/report-export and inherited reel browsers pass. Actual types, Shop typecheck/build, scoped lint,120-template boundaries/architecture and root2034/2057 (zero fail,23 skip) pass. See SUPPLY-PLANNING.md and VERIFICATION.md for scoped evidence and open native/final gates.
- Evidence: 48-case synthetic group covers supply-planning controls. Published implementation/migration is present; historical native769 evidence is retained separately. Exact-head native and merchant suitability remain open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #490, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Draft [#490](https://github.com/Building-Suit/building-suit-monorepo/pull/490), sourcec7bc466b, targets #487 at1bcdcf22. Exact-source native review, measured and website checks pass.
- Blocker: Forecast/reorder sources, units, stock holds and EN/AR browser qualification; no automatic financial posting.
- Completion notes / release fragment: Local implementation tested. Public `ss-electrical-storage-supplier-planning-20261025`; internal `ss-electrical-supply-planning-qualification-20261025`. No hosted or merchant/device completion claim.

## SS-ELEC-508 — Optional commodity-based pricing

- Epic / priority / owner: E5 / P2 / Shop feature.
- Dependencies: SS-ELEC-402, SS-ELEC-503.
- Status: TESTED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Introduce commodity rules only with justified source, currency, effective time and frozen authoritative pricing.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Introduce commodity rules only with justified source, currency, effective time and frozen authoritative pricing. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: COMMODITY-PRICING.md and VERIFICATION.md. Full118-migration replay passes22 named regression suites, foundation, both merchant journeys and15 races. Fresh scoped replay passes source shape/time/expiry guards, original return cost and accepted frozen collection; actual types match. All23 combined browsers plus two extra recovery/blocking cases pass, including same-payload payment retry at quoted25 rather than catalog35. Root2054/2077 passes with zero failures/23 skips; final build, scoped lint and122-template boundaries pass. Final current Shop/Docs typechecks pass; committed release/native qualification remains pending.
- Evidence: 48-case synthetic group covers approved source/rule/retry/history/POS blockers; current real-session source/rule retirement/issuance races pass in schema scope. Native final-head and merchant qualification remain open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: Published source PR #500, incorporated through merged #441 into staging97c1f50e; current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: Uncommitted child `codex/shop-suit/commodity-pricing` of published [#496](https://github.com/Building-Suit/building-suit-monorepo/pull/496) atb02f38f6.
- Blocker: Final commodity source/time/expiry/retirement native gates and real sale original-price preservation.
- Completion notes / release fragment: Locally tested implementation. Public `ss-electrical-approved-commodity-pricing-20261026`; internal `ss-electrical-commodity-qualification-20261026`. No commercial or hosted completion claim.

## SS-ELEC-601 — Product limit and plan suitability review

- Epic / priority / owner: E6 / P2 / QA.
- Dependencies: SS-ELEC-000.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Review 1000s-SKU plan capacity and performance without changing approved commercial prices/entitlements.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Review 1000s-SKU plan capacity and performance without changing approved commercial prices/entitlements. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: CAPACITY-QUALIFICATION-2026-10-29.md: current integrated81cdcc60 replays120 migrations and passes approved-cap boundaries, rollback, archive/replacement, pagination, tenant denial and10000 retained/2000 active records. Ten synthetic capacity browser cases and12 existing EN/AR catalog editor regressions pass. Full active10000 suitability, native/performance and external acceptance remain open.
- Evidence: CAPACITY-QUALIFICATION-2026-10-29.md:120 migrations and approved250/500/1000/2000 boundaries pass;10 synthetic capacity cases and12 catalog regressions pass.10000 retained/2000 active is not10000-active suitability. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: `codex/shop-suit/electrical-capacity-qualification`, based on integrated staging81cdcc60; quota qualification sourceab82589b. Draft publication and native CI await coordinated validation order; #441 is merged.
- Blocker: Current120-migration SQL and10 synthetic browser cases pass; 10000 active SKU suitability and native/performance acceptance remain open.
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
- Historical evidence: Qualification child passes478 Shop units and the merged repository gate (2026 pass, zero fail,23 skip). Eight built public-site isolation scenarios, actual Pinia/Colada account-switch/cancelled-response cases, six EN/AR electrical browser cases and the108-migration replay with17 legacy suites/two races pass. Native parent15b52a32 measured-retail/media/accounts CI passes. Trade/reservation implementation and final combined qualification remain open; see VERIFICATION.md.
- Evidence: Current schema companions/races include role/tenant/location checks; native electrical cases include real-Auth tenant/location denials but are unexecuted. Full exact-head authorization coverage remains open. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Reconcile all feature grants/roles/tenant/location/private helper coverage at exact final head.
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
- Historical evidence: Qualification child passes478 Shop units and the merged repository gate (2026 pass, zero fail,23 skip). Eight built public-site isolation scenarios, actual Pinia/Colada account-switch/cancelled-response cases, six EN/AR electrical browser cases and the108-migration replay with17 legacy suites/two races pass. Native parent15b52a32 measured-retail/media/accounts CI passes. Trade/reservation implementation and final combined qualification remain open; see VERIFICATION.md.
- Evidence: Current provider-stand-in configuration/reel/order/supplier/scale/commodity session races pass; native SQL769 is historical. New native electrical replay/FIFO cases are prepared and awaiting the owned runner. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Current schema harness race groups pass; complete native all-command duplicate/conflict evidence on final head.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-604 — Full English/Arabic UI qualification

- Epic / priority / owner: E6 / P1 / QA.
- Dependencies: SS-ELEC-105, SS-ELEC-204, SS-ELEC-308, SS-ELEC-406.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Execute EN/AR RTL/LTR both themes desktop/mobile keyboard/screen-reader and all operation states.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Execute EN/AR RTL/LTR both themes desktop/mobile keyboard/screen-reader and all operation states. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- Evidence: All48 published electrical synthetic browser cases and12 EN/AR/theme/viewport catalog regressions pass in recorded scope. Full feature/theme/keyboard/screen-reader and native-speaker acceptance is not complete. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Complete feature-wide English/Arabic, both themes, screen-reader/keyboard and narrow/desktop matrix; native speaker acceptance external.
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
- Historical evidence: Qualification child passes478 Shop units and the merged repository gate (2026 pass, zero fail,23 skip). Eight built public-site isolation scenarios, actual Pinia/Colada account-switch/cancelled-response cases, six EN/AR electrical browser cases and the108-migration replay with17 legacy suites/two races pass. Native parent15b52a32 measured-retail/media/accounts CI passes. Trade/reservation implementation and final combined qualification remain open; see VERIFICATION.md.
- Evidence: Exact769 full CI and staging97 review/verify passed historically. Scoped current120-schema/48-browser/27-unit checks pass; all current combined/shared consumer/native checks must run on the reconciled candidate. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Run final combined existing business/shared consumer regressions after latest staging reconciliation; capacity scope is not full acceptance.
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
- Historical evidence: NATIVE-ELECTRICAL-JOURNEY-2026-10-29.md. Two real-Auth electrical browser cases are implemented/discovered but unexecuted. Companion120-migration schema scenario and inherited races pass;27 relevant units,2 synthetic driver regressions, strict TypeScript and scoped lint pass. The separate48-case synthetic electrical group passes. No native/provider/merchant acceptance is inferred.
- Evidence: NATIVE-ELECTRICAL-JOURNEY-2026-10-29.md:2 genuine-Auth cases implemented/discovered; matching120-migration SQL companion,27 units,2 synthetic driver cases and strict TypeScript pass. Actual native browser execution is pending. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: `codex/shop-suit/electrical-capacity-qualification`, based on integrated81cdcc60 with8fed6ad6 parent checkpoint; cohesive draft preparation and owned-runner workflow source ready. #441 is already merged.
- Blocker: Two real-Auth electrical measured/FIFO browser cases now implemented/discovered; companion120-migration public-command scenario passes. Execute on owned native backend via coordinated GitHub-hosted measured-retail job, then close exact-head native/full regression/role/location gates. Native execution is pending; original recovery and external acceptance remain separate.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-607 — Merchant pilot acceptance scenarios

- Epic / priority / owner: E6 / P2 / QA.
- Dependencies: SS-ELEC-606.
- Status: IN_PROGRESS.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Obtain real merchant review of cable, copper and piece journey including printed receipt and balances.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Obtain real merchant review of cable, copper and piece journey including printed receipt and balances. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- Evidence: Representative electrical scenario, SQL/browser procedures and exact assertions are prepared. No actual merchant/printer/scanner/approved-scale/native-Arabic acceptance evidence exists. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Execute available synthetic pilot procedures; actual merchant/printer/scanner/scale/native-Arabic signoff remains external.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.

## SS-ELEC-608 — Release-readiness review and handoff

- Epic / priority / owner: E6 / P0 / Release.
- Dependencies: SS-ELEC-607, SS-ELEC-601, SS-ELEC-001.
- Status: BLOCKED.
- Scope: apps/shop-suit; its public/shop_private schema and app contracts; packages/ui and packages/ux only where shared presentation/interaction requires extension.
- Objective / acceptance: Bind exact candidate SHA, migrations, security/regression/pilot and production evidence before release handoff.
- Security / compatibility: preserve tenant/location authorization, subscription checks, idempotency, original financial/FIFO/service history and legacy contracts; no direct browser financial writes.
- Automated tests: Bind exact candidate SHA, migrations, security/regression/pilot and production evidence before release handoff. See TEST-MATRIX.md for the applicable unit, full-schema SQL, concurrency and browser gates. Execution evidence: VERIFICATION.md; absent evidence means unrun.
- Manual tests: representative merchant steps for this feature, bilingual/accessible UI where applicable; provider/device/native-speaker acceptance separately recorded.
- Historical evidence: No completion evidence yet; inspect VERIFICATION.md for subsequent execution.
- Evidence: Exact source/checkpoint/merge provenance and remaining-gate records are prepared. Supported catalog receipt/baseline recovery and external acceptance remain pending; no main/production authorization is inferred. See READINESS-GATES-2026-10-29.md for acceptance limits.
- PR / commit: current follow-up checkpoints cfbbfe26 →9ec4eb87 →8fed6ad6 →11be3b3d on `codex/shop-suit/electrical-capacity-qualification`. New draft/native CI publication remains coordinated after Doctor/Ledger.
- Historical PR / commit: draft [#441](https://github.com/Building-Suit/building-suit-monorepo/pull/441); tracker/foundation commit `ce62100b`. NOT_STARTED tasks have no feature implementation commit.
- Blocker: Bind exact source/migrations/CI/pilot/provider receipt and supported catalog publication; no main/production authorization here.
- Completion notes / release fragment: no fully verified completion claim; new fragment will classify exact delivered scope. Draft release IDs are in RELEASE-PLAN.md.
