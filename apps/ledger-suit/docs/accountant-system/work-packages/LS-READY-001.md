# LS-READY-001 — accountant release-readiness review

2026-10-22. **NOT READY FOR UNRESTRICTED SALE. Live Automation reconciliation pending.**

Founder request: review Ledger Suit, identify missing Automation database tasks, and continue toward sale to accountants. This package starts from verified `origin/stg` commit `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d` on `codex/ledger-suit/accountant-readiness`. No open Ledger PR/parent existed at preflight. The separate clean `work` checkout at `221e0e39` is preserved. No accountant acceptance or production promotion is inferred from implementation authorization.

## Findings and completed repair

The current source contains accounting periods, journals, opening balances, statements, AR/AP, bank reconciliation, assets, dimensions, scoped Egyptian VAT, inventory accounting, FX, migration workflows, reporting formats, optional accountant portfolio and manual-payment administration. Reimplementing this inventory from the old AS roadmap would duplicate work. The V2 baseline and actual code/evidence take precedence over historical `NOT_STARTED` labels.

The maintained acceptance validator failed on TAX-06, TAX-07 and INV-08: later adapter work replaced machine status values with explanatory sentences. Each row now retains that explanation in `code_evidence` / `test_evidence`, uses conservative `partial` status values, and keeps deployment unverified and accountant acceptance pending. Diagnostics identify the failing requirement/field. The normal Ledger unit suite now executes the independent 138-requirement/eight-journal validator, so this regression cannot silently recur outside the standalone command.

Current browser fixtures also assumed a one-step password form and a fixed navigation ID/header that the shared shell no longer supplies. The Ledger fixture and dedicated VAT scenario now follow email → password and wait for the outgoing/incoming submit arrows to resolve to one control. The dashboard locates the accessible side navigation and records the actual shell scope row. The shared geometry helper accepts an optional locator while retaining its existing default for other callers. No authentication, financial or presentation behavior is changed.

## Automation database boundary

This cloud instance has no configured database secret/runtime binding or VPN. The CLI defaults to `127.0.0.1:54329`, documented as the founder's workstation database; the workstation is a different machine. Its historical absolute secret-file path is not available here. The initial read failed because `psql` is absent; installing a client alone would not establish database access. No task row, decision, attempt, admission, run or retry has been changed.

Use [the read-only audit](../../../scripts/audit-automation-readiness.sql) against the actual Automation database to capture a consistent snapshot of Ledger tasks, all requirement links, dependencies, decision states, latest executions/check outcomes and existing runs. The query has a 30-second timeout and a read-only transaction. It does not dispatch work. Its live execution remains pending.

Repository migrations are historical seed/amendment evidence, **not a current task-status export**. In particular, the original V2-D13 deferral and V2-IMP-013 tax hold have later implementation decisions in the product record. Do not replay the original seed or silently rewrite these decisions. Reconcile the current rows first. Exact IDs alone also cannot establish that an equivalent task is missing.

## Required task coverage and order

These are concrete scopes to reconcile with the live database. Existing IDs below are evidenced by source records, not proof of their current database status. Reuse existing tasks/evidence where their scope matches; create only uncovered follow-ups, retaining historical failures and retry budgets. Do not mark a product task complete because its code merged.

| Order / existing task to reconcile | Missing acceptance outcome | Completion evidence |
|---|---|---|
| 1 / LS-READY-001 | Reliable acceptance register and current queue audit | Validator and regression pass; live read-only snapshot; every one of the 138 requirements has an explicit disposition and task/evidence link. |
| 2 / LS-REL-001, V2-IMP-015, LS-FIX-001/002 | Native cumulative financial acceptance | Entire current migration chain and SQL suites; integrated eight-journal scenario yields exactly 8 journals/16 lines, debit=credit=193300, closing bank=80700, AR=18000, AP=11000, profit=9700, assets=120700; dated TB/BS/P&L/Control/CF agree. Current UI/browser flows pass without obsolete selectors or fixture-only claims. |
| 3 / LS-REL-001; split an uncovered preservation/concurrency follow-up if needed | Migration-history preservation and races across posting sources | Pre/post migration snapshots preserve posted IDs, amounts, labels/mappings and audit; real parallel duplicate and period-close/post sessions cover manual, opening, AR/AP, bank, asset, VAT, inventory and year-close commands. Sequential retries are insufficient. |
| 4 / LS-OPS-001 | Timed recoverability, Storage and customer export | Independent native source/target restore; exact financial/configuration/import/recurrence digests, private attachment bytes and authorized tenant export agree; actual elapsed recovery times recorded; operating backup destination/schedule and recovery owner documented. |
| 5 / LS-SEC-001; split an uncovered dependency remediation task if needed | Current security evidence | Native tenant/capability/Storage negative checks; built client scan; current dependency advisory triage with runtime reachability and compatible fixes; authenticated production/staging configuration review. A clean source scan is insufficient. |
| 6 / V2-IMP-015; add an accountant-pilot task only if uncovered | Accountant can adopt and complete a real working cycle | Named reviewer tests migration/opening, customer invoice/receipt, supplier bill/payment, bank match, asset/depreciation, corrections, period close/reopen, exports and recovery on an exact candidate; actual outputs and dated verdict retained; defects resolved and rerun. Founder authorization does not fabricate this evidence. |
| 7 / LS-BILL-002 and existing release/billing tasks | Commercial customer lifecycle | Designated test-provider/manual-payment evidence for signup/email verification, trial, paid approval/rejection, replay/concurrency, renewal/cancellation, quota/read-only/correction access, private receipt upload and operator audit; exact deployed configuration verified. No real money movement is part of this review. |
| 8 / LS-REL-001 and existing release/operations tasks | Controlled sellable release and support | Exact app/schema candidate identity; full required checks and provider readiness; EN/AR/RTL/mobile/keyboards; published scope/limitations, terms/privacy/retention/support route; migration/rollback/monitoring rehearsal and accountable operator. Production promotion remains a separately evidenced action. |

The limited ETA B2B/B2C adapters are preproduction-only. Reconcile LS-EG-001/002/003 separately for customers who require them: real source/POS identity, security/signing review and genuine ETA preproduction outcomes must precede a separately authorized live integration. Do not advertise general Egyptian tax compliance or force an unrelated retail/POS implementation into accountant release scope.

Before replaying the older acceptance matrix, reconcile its browser selection with current tests. Legacy helpers such as `tests/e2e/core-finance.spec.ts` and `foundation-fixture.ts` still fill a password immediately after email; they were not exercised or relabelled as passing by the current 17-file selection. A task covering their modernization must exist if those tests remain release gates.

## Verification

Current reproducible outcomes are retained in [the verification record](../v2-acceptance/readiness-verification-2026-10-22.json) and [the advisory snapshot](../v2-acceptance/dependency-audit-2026-10-22.json).

| Check | Actual result |
|---|---|
| Live GitHub preflight | Pass; no errors and no active Ledger parent before branch creation; staging base pinned above. Current staging also has failing/pending provider/CI checks; preflight does not establish a green release verdict. |
| Pinned setup | Node 26.8.1 / pnpm 10.33.0; frozen-lockfile installation succeeded. Initial offline cache was incomplete; no dependency constraint or lockfile was changed. |
| Ledger unit / independent acceptance validator | 123 tests pass, zero failures/skips; 138 distinct requirement rows and exact independent worksheet validate. |
| Ledger lint / typecheck / production build | Pass; expected warnings for absent local Supabase URL/key. Changed fixtures and shared test helper also lint successfully in their owning configurations. |
| Workspace / release checks | Pass: 114 canonical route templates, zero migration debt, 80 protected historical migrations unchanged; internal release provenance/net coverage passes. |
| Browser regression | 62 distinct cases across 17 files have passing current evidence: initial bounded run 58 pass/4 fail, followed by 4/4 focused passes after the dashboard/VAT fixture repairs. EN/light/390 and AR/dark/1440 plus selected EN/AR command/denial cases. Playwright 1.62.1 with existing system Chromium 154.0.8037.57; synthetic API fixtures. The full 305-case matrix is not claimed. |
| Generated client scan | 173 JS/module/map files; zero matches for the existing forbidden server-secret identifiers. No live secret values were configured for value-based scanning. |
| Dependency audit | Advisory service reachable; workspace graph reports 3 critical, 10 high, 14 moderate, 4 low. Critical simple-git/argv-parser/shell-quote versions are present in Ledger's Nuxt development-tool dependency path. Deployed reachability and compatible remediation remain open; no dependency was changed. |
| Native Supabase / SQL / restore | Blocked before migrations. Both the reduced service startup and the database-only attempt exhausted the managed 32 GiB Docker filesystem while registering the PostgreSQL image; rate limits also occurred. Unused task-owned service-image caches were removed before the second attempt. Startup/pull processes were stopped; no running containers, hosted writes or financial fixtures exist from these attempts. No SQL, race, preservation pair or timed restore is claimed. |
| Public staging/production login | Both return HTTP 200; authenticated journeys and deployed commit/schema identity remain unverified. |
| Automation / accountant / production release | No database connection or task mutation; no named accountant verdict; no merge, hosted migration or production deployment. |

The source has 105 ordered Ledger migrations through `20260928240000_support_submission.sql`. Their sorted content-manifest SHA-256 is `93e6f6c11b6eaa54b3bc9e427bbc3c665f46d493062eecfb91db4a4bcd31a9e6`; the verification JSON specifies the manifest format. This identifies repository source, not a hosted schema.

Browser reproduction uses the maintained atomic Ledger configuration with a temporary `use.launchOptions.executablePath = '/usr/bin/chromium'` adapter. Run its 17 files with `--workers=2 --grep 'en, light, 390|ar, dark, 1440|: en$|: ar$'`; replay `atomic-dashboard.spec.ts atomic-tax-workspace.spec.ts` after applying the fixture repairs. No browser installation, auth bypass, assertion suppression or automatic retry was used. Historical September results elsewhere remain historical; an HTTP 200 login page alone proves neither authenticated financial acceptance nor the deployed commit/schema.

The live Automation connection is the required input for queue reconciliation and continuation through its lifecycle. Named accountant review, actual provider/configuration evidence and a real timed restore are required for the final sale-readiness verdict; none can be replaced by a generated checklist.

## 2026-10-28 — combined staging candidate

The founder authorized stacking completed Ledger PRs and merging one completed candidate into `stg` (AS-E04). The root now incorporates leaf PR #509 at `d51767bbb973dc7b00b6768a11103b0cd4ea5538` with a history-preserving merge. This retains all Ledger task commits/PR provenance and includes #443, #444, #447, #448, #449, #451, #452, #455, #459, #462, #466, #468, #469, #494, #497, #506, #507, #508 and #509. Unrelated feature roots are excluded.

The completed local evidence includes 107 Ledger migrations / 66 SQL suites / 1996 assertions, independent financial worksheets/cycles and source/close races, native Storage/export/recovery/billing, 311 atomic browser cases plus native/foundation acceptance, and the actual EN/AR journal/private-view/report-return journey. The current 138-row review has 130 retain / 8 investigate; hosted deployment and all accountant verdicts remain unverified/pending. Detailed dated outcomes and limits live in each task package rather than being inferred from source presence.

Shared CI qualification repairs the inherited current-library harness, scoped query cleanup/SSR error payloads, focus-preserving language controls, native authentication labels and landing loading visibility. PR #508's exact source review, Doctor browser and shared settings checks pass; this does not substitute for the root's full required `branch-policy`, `review` and `verify` checks. Those must execute against the exact combined head and current staging base before merge.

The prior staging Supabase check `120018638314` fails with “Remote migration versions not found in local migrations directory” for Ledger staging project `yqculoltqsyfastmihmu`. Authenticated history/settings access remains unavailable in this worker, so no speculative migration-history repair is performed. The normal provider-state hold applies. Live Automation reconciliation, operational offsite backup destination/schedule/owner and a named accountant pilot remain unresolved external release gates. No staging merge, production promotion, accountant acceptance, compliance certification or unrestricted sale readiness is claimed by this integration checkpoint.

### Final security follow-up

The previous combined head `a259e4cfe90e5f04a8eff99dd3abc201f4156511` passes all required branch-policy/review/full-verify checks (run `40751284734`). A fresh audit then identified new Markdown/Turbo advisories. PR #510 at `f42704e6b6bcf25777d26026e47b52ec166b3557` is now incorporated with preserved history: two minimal pinned tool updates, seven successful app builds/typechecks, 2038 passing root tests / 23 explicit skips / zero failures, and zero critical / one high / zero moderate / one low residual findings with no published fixes. Its bounded old-parser reproduction, current regression checks and narrow artifact-exposure inspection are recorded in LS-SEC-DEP-006. This final head must pass the three required checks again. The staging provider, Automation, accountant and operating-backup gates above remain unresolved; no staging merge or production action has occurred.

### Exact journal/dashboard transport follow-up

The 21-task candidate `6e2205ce81e06b9bf239a7d254aa0fa605e8cfdb` passes branch-policy/review/full-verify (run `40754707621`). Further financial review then found actual bigint JSON loss in legacy journal/detail/dashboard reads: stored `9007199254740993` parsed as `9007199254740992`, with HTTP 500 in both languages. PR #511, qualified tip `59ce7e198f1b2fc2e512618c6b8e09078bf098db`, is now incorporated with preserved history as the 22nd task PR.

LS-FIN-PRECISION-002 supplies monetary text projections, exact bigint filter/commitment handling and forward migration 108's invoker summary adapter. All 107 earlier migration files and all 122 existing business-table fingerprints are preserved. Native large-value/ordinary journal/authorization and read-fault evidence passes, with 39 related atomic cases, 11 foundation cases and all 130 Ledger units. Original financial rows remain identical and all 38 retained journals balance. The three required checks must execute again on this combined head. Historical 66-suite/1996-assertion evidence remains attributed to its 107-migration candidate; this follow-up has focused native 108 evidence. Provider recovery, live Automation, accountant and operating-backup gates remain unresolved; no staging or production action is claimed.
