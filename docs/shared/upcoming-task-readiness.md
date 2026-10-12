# Upcoming Shared and Shop task readiness repair

Prepared on 2026-10-12 in isolated branch `codex/shared/upcoming-task-readiness` at `/workspace/task-readiness`, based on verified `origin/stg` `3c16c81c3f65d25bcfa82794441b0ee7d2a21588` (PR #248). No additional AI workers, batches, task runs, pushes, PRs, merges, deployments, product migrations or runtime installations were performed. The primary cloud checkout and the inaccessible local PC worktree were not edited. `/workspace/.agents` is empty and this repository has no maintained `.agents/skills`; worker skill/browser readiness remains an operator prerequisite.

Repository repairs are implemented and locally verified. Live metadata is **applied under audit receipt 10148**: 24 still-planned task packets, two verification registries and 24 current publication contracts. The exact reviewed before/after manifest is [upcoming-task-readiness.reconciliation.json](upcoming-task-readiness.reconciliation.json), with complete original rows in [snapshot](upcoming-task-readiness.snapshot.json), current live registries in [configuration](upcoming-task-readiness.configuration.json), contracts/decisions in [audit](upcoming-task-readiness.audit.json), and preservation evidence in [recheck](upcoming-task-readiness.recheck.json) and [configuration recheck](upcoming-task-readiness.config-recheck.json).

A dedicated pre-run amendment RPC was absent, but schema/trigger inspection established a safe guarded transaction within the existing authorization. The applied transaction locked only the exact target tasks and two registries, required exact old values plus zero target executions/admissions/frozen plans/authority claims, compared live trigger-function fingerprints and admission generations, preserved all dependency/decision/approval/runtime/retry/history rows by before/after checksums, and appended 27 audits. Existing invalidation triggers and `refresh_publication_readiness_contract` handled generation/contract reconciliation. No migration, permission, security or runtime change occurred. [Applied readback and receipt](upcoming-task-readiness.applied.json), [reviewed payload](upcoming-task-readiness.amendment-payload.json) and [exact guarded apply](upcoming-task-readiness.amendment-apply.sql) are durable evidence. A rollback rehearsal and mismatched-task/registry negative tests passed; exact replay created no additional audit or state change. Shared/protected publication authority still requires its existing operator path.

## Repository behavior

- Replaced maintained Ledger/Inventory/Super Admin local-component guidance, Shop native-control recipes, product composition workflows, partial starter auth/wizard ownership and the two-consumer verification rule.
- Normal `pnpm test` includes `tooling/checks/*.test.mjs`. Normal workspace enforcement requires `requireStrict: true`; regressions reject both an empty migration-mode downgrade and exact recorded native debt.
- Preflight explicitly refreshes the `stg` tracking ref even in a main-only saved checkout. Paginated GitHub observations work with the installed older `gh` without losing later pages. Publication crash/replay fixtures retain commit/push/PR identity assertions.
- Atomic inventory and PR #248 product fixes are untouched: 76 routes, nine layouts, five roots, zero Suit-local components. No product source changed.

## Before/after task matrix

Every row below is an applied metadata change to a still-planned, never-executed task. IDs, acceptance criteria, status, hard dependencies, model/retry policies and completed/cancelled history are preserved. E = existing executable; T = mandatory task-owned test/output; X = required external/operator evidence. Counts classify obligations, not PASS results.

| Task ID | Priority before → applied | Scope change | E / T / X | Remaining stop |
|---|---|---|---|---|
| BS-SA-FUTURE-SUIT-M4-VALIDATION-001 | 40 → 900 | Retain existing scope | 0 / 1 / 1 | Completed SAS-M4-EVENTS-001 and separate bounded integration authorization. |
| SHOP-CAS-M1-INT-001 | 100 → 900 | Add candidate shared presentation/controller scope S; align source app scope; DB authority pending | 2 / 2 / 2 | Completed CAS-M1-INT-001, exact protected database publication authority and signup/event contract evidence. |
| SS-OFFLINE-001 | 150 → 150 | Add candidate shared presentation/controller scope S | 0 / 3 / 3 | Real phone/tablet/network/replay evidence |
| SS-EGY-ETA-001 | 151 → 153 | Add candidate shared presentation/controller scope S | 0 / 3 / 2 | TAX-D01 |
| SS-SET-001 | 153 → 151 | Add candidate shared presentation/controller scope S | 0 / 3 / 0 | TAX-D01 |
| SS-APPT-002 | 154 → 901 | Add candidate shared presentation/controller scope S | 0 / 4 / 2 | Separate phase/product approval for public self-booking; public-site V1 continues to prohibit booking.; Approved reminder channel and delivery/retention policy. |
| SS-BARBER-COMP-001 | 155 → 155 | Add candidate shared presentation/controller scope S | 0 / 3 / 0 | BARBER-D01 |
| SS-SERV-002 | 156 → 156 | Add candidate shared presentation/controller scope S | 0 / 3 / 1 | Concrete approved material units, rounding, effective dates and version/snapshot policy; generic approval text is insufficient. |
| SS-SALE-002 | 157 → 157 | Add candidate shared presentation/controller scope S | 0 / 4 / 1 | Concrete approved partial return, refund allocation and stock reconciliation policy; generic approval text is insufficient. |
| SS-WEB-SLUG-001 | 170 → 170 | Add candidate shared presentation/controller scope S | 0 / 3 / 0 | WEB-TAIL-D01 + preceding chain |
| SS-WEB-PROFILE-001 | 180 → 180 | Add candidate shared presentation/controller scope S | 0 / 4 / 0 | WEB-TAIL-D01 + preceding chain |
| SS-WEB-CATALOG-001 | 190 → 190 | Add candidate shared presentation/controller scope S | 0 / 3 / 0 | WEB-TAIL-D01 + preceding chain |
| SS-WEB-PUBLIC-001 | 200 → 200 | Add candidate shared presentation/controller scope S | 0 / 4 / 0 | WEB-TAIL-D01 + preceding chain |
| SS-WEB-APPT-ACCESS-001 | 210 → 210 | Add candidate shared presentation/controller scope S | 0 / 4 / 0 | WEB-TAIL-D01 + preceding chain |
| SS-WEB-CUSTOMER-PORTAL-001 | 220 → 220 | Add candidate shared presentation/controller scope S | 0 / 4 / 0 | WEB-TAIL-D01 + preceding chain |
| SS-WEB-LAUNCH-001 | 240 → 240 | Add candidate shared presentation/controller scope S | 1 / 3 / 1 | WEB-TAIL-D01 + preceding chain |
| BS-UI-PRO-001 | 340 → 340 | Retain existing scope | 1 / 0 / 3 | Readiness/visual/pilot gates |
| BS-UI-PRO-002 | 340 → 340 | Retain existing scope | 1 / 1 / 2 | Readiness/visual/pilot gates |
| BS-UI-PRO-003 | 340 → 340 | Retain existing scope | 1 / 2 / 1 | Readiness/visual/pilot gates |
| BS-UI-PRO-004 | 340 → 340 | Retain existing scope | 1 / 1 / 2 | Readiness/visual/pilot gates |
| BS-UI-PRO-005 | 340 → 340 | Retain existing scope | 1 / 3 / 0 | Readiness/visual/pilot gates |
| BS-UI-PRO-006 | 340 → 340 | Retain existing scope | 1 / 1 / 2 | Readiness/visual/pilot gates |
| BS-UI-PRO-008 | 340 → 340 | Retain existing scope | 1 / 1 / 2 | Readiness/visual/pilot gates |
| BS-UI-PRO-010 | 340 → 340 | Evidence only: docs/shared/ + apps/building-suit-docs/ | 1 / 0 / 4 | Readiness/visual/pilot gates |

Scope S is the exact declared addition to both task and source scopes: `packages/ui/src/templates/`, `packages/ui/src/types/`, `packages/ui/tests/`, `packages/ui/package.json`, `packages/ux/src/`, `packages/ux/tests/`, `packages/ux/package.json`, `docs/shared/atomic-template-route-inventory.json`, `docs/shared/ui-ownership-manifest.json`. These additions cover complete templates, neutral contracts, tests and explicit exports. Existing atoms/organisms remain reusable; changes beyond these declarations require exact scope authority or a preceding Shared task. No glob is marked resolved by this amendment; exact shared/protected publication authority remains mandatory.

BS-UI-PRO-003 is gap-based refinement of existing complete templates. UI006/008 refine shared templates/controllers while Shop retains business adapters. UI010 cannot edit application UI. UI007 (Ledger) and UI009 (Inventory) are inspected but not changed because they are outside the Shared/Shop target set. SS-APPT-002 is moved to a deferred tail with an explicit pre-implementation decision gate; the public-site V1 prohibition is preserved rather than replaced. SS-WEB-CHANGELOG-001 remains cancelled; WEB LAUNCH retains its hard dependency on completed BS-CHANGELOG-VERSION-001.

CAS gains mandatory signup/reference/policy-acceptance, lifecycle/payment replay/version/retry and payment database obligations, beyond its existing diff/typecheck. Its source scope now includes the signup app paths alongside shared ownership paths and retains the existing `apps/shop-suit/supabase/**` declaration; `apps/shop-suit/supabase/**` remains separately protected/unresolved. No future feature is implemented here.

The applied registry amendment extends the captured **live** command registry and retains every existing command/mapping. It did not replay the stale stored batch-readiness proposal. Its all-consumer quality command uses unfiltered Turbo typecheck/lint/build, including Super Admin, Automation and Docs. All 100 obligations are structurally classified using the existing bounded verification planner; future test paths are mandatory outputs and external evidence is never an approval. Draft configurations are deduplicated by project/workstream reference. These drafts are not frozen executable admissions and cannot be passed directly to the live freeze function.

## Safe ordering and counts

The live freezer selects the first N unfinished tasks ordered by priority, sequence, created_at and task_id. It does not choose any N ready tasks. Before repair, first Shared was the deferred SAS M4 integration and first Shop was CAS integration. After repair, first Shared is UI001 and first Shop is Offline; all contract snapshots are current, while real authority/readiness gates remain pending. Shared has zero dependency-ready tasks; Shop has four (Offline, APPT002, SERV002, SALE002), but no safe current executable batch is admitted even after metadata reconciliation. **Current authorized executable counts: Shared 0, Shop 0.**

After publication/scope reconciliation, worker/browser readiness and actual runtime verification, the conditional first UI segment is **Shared 5 (UI001–005), then Shop 1 (UI006 pilot)**. This additionally requires BS-UI-READY-001 and prior backlog reconciliation. Stop for mandatory BS-UI-PILOT-001 rendered visual approval before Ledger UI007 → Shop UI008 → Inventory UI009 → Shared UI010. Shared 6 would incorrectly include final evidence gate UI010, whose external predecessors remain unfinished.

For the current amended Shop queue, first-N 1 is Offline. First-N 2 includes SS-SET-001, still blocked by TAX-D01; ETA follows SET rather than preceding it. There is no safe four-task batch merely because four tasks appear in ready_tasks. Offline remains conditional on task-owned tests, publication authority and real mobile/tablet/network evidence. SERV002 requires concrete units/rounding/version policy; SALE002 requires concrete refund/stock reconciliation policy. Generic approved SERV text remains insufficient. Booking requires its own real phase decision and reminder channel.

Deferred SAS M4 and CAS integrations move to priority 900 while preserving IDs and hard parents; APPT002 moves to 901. Existing UI dependency edges and the public web chain SLUG → PROFILE → CATALOG → PUBLIC → APPT-ACCESS → CUSTOMER-PORTAL → LAUNCH remain unchanged. No bypass selector or dependency removal was introduced. Shared changes must be reviewed/integrated first, then dependent Shop bases reconciled; different streams do not authorize concurrent contract edits. max_run_tasks=20/max_parallel=3/serialized workstreams are limits, not readiness guarantees.

## Guarded application and required start-time protocol

1. Completed: inspect audit schema, constraints and live triggers; compare the 24 task and two registry snapshots, exact dependencies, current generations and trigger-function hashes. Require planned status with zero target executions/admissions/plans/authority claims and no active Shared/Shop run. Completed/cancelled/active tasks were excluded.
2. Completed: rollback rehearsal and exact-old-value negative tests, followed by one SERIALIZABLE guarded metadata transaction with short lock/statement timeouts. Shared registry/task contracts were edited before Shop. Only description, priority, verification_plan and the three authorized metadata keys changed; only new verification commands were merged. Preserved source_record, resolved-scope/authority data, business decisions, acceptance, model/retry policies and dependencies.
3. Completed: existing triggers invalidated old admissions, and `control.refresh_publication_readiness_contract` refreshed all 24 contract generations. Every old unresolved scope remains present, including CAS Supabase scope. All current publication authority and executable admission values remain false. Audit records 10122–10147 hold full before/after rows; receipt 10148 holds preserved checksums and exact counters. An exact replay returned without mutation; audit count remains 27 with one summary receipt.
4. Prepare start-time plans against the exact live first-N packet set using `boundedVerificationReadiness` and current input generations/configuration/prerequisite bindings. Enforce actual command/file availability for existing executables. Task-owned outputs are implementation obligations, not missing pre-existing runners; external gates require real evidence. Absent frozen plans before run creation are expected. This repair creates no run, calls no freezer and consumes no product retry.
5. Only after parent/user authorization to start a future batch may the existing runtime create the run and freeze the exact regenerated plans. Recheck dependencies and decisions at acquisition. Do not widen budgets, approve pilot gates or infer hosted runtime readiness from repository tests.

## Verification and preservation evidence

| Check | Result |
|---|---|
| Targeted architecture/reconciliation regressions | 67 pass, 0 skip; three additional guarded amendment/applied-readback regressions pass; combined architecture/registry/git gate: 95 pass |
| Git policy/pagination regressions | 25 pass |
| Publication lost-response replay | 3 pass; one commit/push/PR identity retained |
| Complete normal test-script file set | 1,218 pass, 0 fail, 22 skip using existing system Chromium 154 via explicit temporary executablePath adapter |
| Normal browser discovery | Pinned Playwright browser absent; unadapted suite fails those two browser launches. System Chromium executes both unchanged health assertions successfully; no browser installed. |
| Skipped database/runtime integration checks | 22 remain unrun; required disposable PostgreSQL/runtime fixtures unavailable. No hosted writes used as substitutes. |
| Strict workspace + tokens | Pass; 76 routes, zero debt; 80 historical migrations unchanged |
| Explicit strict Suit boundary | Pass; 90 adapters across five dynamically discovered Suits |
| Changed tooling lint + source syntax | Pass |
| Docs generation/typecheck/production build | Pass using existing installed tools/packages; six consumer builds/typechecks are not claimed |
| Live GitHub preflight | Pass, errors=[]; stg=3c16c81 |
| Artifact regeneration --check and git diff --check | Pass; applied status requires an exact audited readback |
| Live SERIALIZABLE amendment regression | Rollback rehearsal, mismatched task and registry rejection, atomic apply and idempotent replay pass |

The environment has pnpm 11.25.0 while the repository pins 10.33.0. Direct existing Node/Nuxt tools and workspace links were used for checks; no pnpm/runtime installation occurred. Ordinary pnpm execution remains an environment-version prerequisite. No repository version constraint was weakened.

At 2026-10-12T09:57:21.352195+00:00, all 24 source task rows were byte-for-byte unchanged; the complete dependency graph, global task-status snapshot and project/workstream registries were unchanged. Counts stayed at 329 executions, 91 runs, 38 credits, 10 gate resolutions and 2742 task events. Target task executions remained zero. These are current-state preservation observations, not a reservation; these original observations were subsequently revalidated within the guarded apply transaction.

SAS run `2518c051-fb28-4641-ae03-c046d7c30807` remains running 6/7 at `SAS-M1-GATE-001`, execution345 attempt1. Latest activation is Oct11 release `f9ebf54c...`, source `8e61433138c0f27610d6a2d49f349e239550126f`, schema120. The independent migration121/runtime launcher JSON-parsing recovery remains unverified from this cloud workspace and blocks a truthful overnight-ready claim. No modification/restart/retry/duplicate execution was performed.

GitHub currently reports zero rulesets and stg protected=false. Security/merge settings were only read and remain unchanged; changing them needs separate authorization.

Durable evidence summary: [verification](upcoming-task-readiness.verification.json). Regenerate/check the reviewed applied manifest with `node tooling/control-plane/upcoming-task-readiness.mjs --check`. The parent decides publication and future starts. Live metadata application is complete; no batch was started.

## Applied preservation and remaining authority

Audit receipt 10148 records 24 task edits, two registry edits and 24 contract refreshes, zero new runs/attempts/authority grants/dependency changes, and matching checksums for all protected control tables. Independent readback confirms runs=91, executions=329, credits=38, gate resolutions=10, task events=2742 and target executions=0. All 24 publication contracts are current; all 24 executable admissions and publication authorities remain false. SAS run remains running 6/7 at SAS-M1-GATE-001, execution345 attempt1. Exact replay leaves 27 amendment audits and one summary receipt.

Remaining scope work is specific: existing task/source globs remain unresolved unless already resolved before this repair, and new shared directory declarations require ordinary exact-path authority through the existing operator interface; CAS retains unresolved apps/shop-suit/supabase/** and requires protected authority for actual database publication paths. The package-scope offer accepts package/** scopes, so directory declarations must use the supported exact ordinary-path path or a reviewed package-scope reconciliation at start time. No resolution/grant was fabricated. These are existing authority stops, distinct from now-repaired stale task packets/registry bindings. Genuine product/visual/manual gates and the separate SAS launcher recovery remain pending.

## Exact before/after queue order

shared Before: BS-SA-FUTURE-SUIT-M4-VALIDATION-001 (40/480) → BS-UI-PRO-001 (340/2610) → BS-UI-PRO-002 (340/2620) → BS-UI-PRO-003 (340/2630) → BS-UI-PRO-004 (340/2640) → BS-UI-PRO-005 (340/2650) → BS-UI-PRO-010 (340/2700).

shared Applied: BS-UI-PRO-001 (340/2610) → BS-UI-PRO-002 (340/2620) → BS-UI-PRO-003 (340/2630) → BS-UI-PRO-004 (340/2640) → BS-UI-PRO-005 (340/2650) → BS-UI-PRO-010 (340/2700) → BS-SA-FUTURE-SUIT-M4-VALIDATION-001 (900/480).

shop-suit Before: SHOP-CAS-M1-INT-001 (100/120) → SS-OFFLINE-001 (150/500) → SS-EGY-ETA-001 (151/510) → SS-SET-001 (153/530) → SS-APPT-002 (154/540) → SS-BARBER-COMP-001 (155/550) → SS-SERV-002 (156/560) → SS-SALE-002 (157/570) → SS-WEB-SLUG-001 (170/1020) → SS-WEB-PROFILE-001 (180/1030) → SS-WEB-CATALOG-001 (190/1040) → SS-WEB-PUBLIC-001 (200/1050) → SS-WEB-APPT-ACCESS-001 (210/1060) → SS-WEB-CUSTOMER-PORTAL-001 (220/1070) → SS-WEB-LAUNCH-001 (240/1090) → BS-UI-PRO-006 (340/2660) → BS-UI-PRO-008 (340/2680).

shop-suit Applied: SS-OFFLINE-001 (150/500) → SS-SET-001 (151/530) → SS-EGY-ETA-001 (153/510) → SS-BARBER-COMP-001 (155/550) → SS-SERV-002 (156/560) → SS-SALE-002 (157/570) → SS-WEB-SLUG-001 (170/1020) → SS-WEB-PROFILE-001 (180/1030) → SS-WEB-CATALOG-001 (190/1040) → SS-WEB-PUBLIC-001 (200/1050) → SS-WEB-APPT-ACCESS-001 (210/1060) → SS-WEB-CUSTOMER-PORTAL-001 (220/1070) → SS-WEB-LAUNCH-001 (240/1090) → BS-UI-PRO-006 (340/2660) → BS-UI-PRO-008 (340/2680) → SHOP-CAS-M1-INT-001 (900/120) → SS-APPT-002 (901/540).

Ordering is priority / sequence, then created_at and task_id. UI010 remains physically sixth in Shared but cannot execute before Ledger007 → Shop008 → Inventory009 and real pilot approval; first Shared UI segment remains five. The Shop UI pilot is conditional on earlier backlog reconciliation, not an immediate current first-N candidate.
