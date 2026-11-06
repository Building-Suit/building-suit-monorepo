# Oracle release automation verification — 6 November 2026

Branch: `codex/company-hq/worker-release`; worktree: `/workspace/hq-release`.
Applied migration baseline remains `d1a274fa9573e411c38b5d7f9ffba86739f7601d`.
The latest inspected migration-parity parent is
`aadeaa79d7e829f78cf7d51bb01b859a97f651aa`; its unrelated UI exports/hydration
changes remain separate. No history was rebased, reset, overwritten or removed.
See `INTEGRATION.md` for the bounded runtime port from pilot
`116477e5e63495efc6702e8d6a745d3e053310d4` and exact undeployed SQL hashes.

## Current follow-up results

- **94/94 host tests passed**, with `node --test --test-concurrency=2
  tooling/hq-agent-host/*.test.mjs` (105,246ms). Covers the actual worker/socket
  maintenance lifecycle, claim-in-flight drain, durable uncertainty/crash intent,
  lease renewal and v3 model receipt preservation through journal/delivery. The
  ported pilot tests cover head routing, HR qualification, supervised trials,
  native search boundaries, provider/model evidence and bounded Terra-to-Luna
  fallback. Both the unchanged applied-baseline DB suite and explicitly proposed
  pilot DB suite use disposable PGlite, never hosted jobs or actual inference.
- **45/45 Python tests passed**, using `python3 -m unittest discover -s
  tooling/hq-agent-host -p '*_test.py' -v`. Includes 34 updater/builder tests and
  11 publication-contract tests. No GitHub release write is performed by tests.
- The original review's stale-update regression fails against actual published
  `234592aa` with **BlockingIOError not raised**, and passes after the fix.
  The fixture uses that version's original schema contract so the failure is
  specifically the missing whole-decision lock, not a manifest mismatch.
- Competing invocations cannot discover outside the lock. Head movement during
  download, after drain, during stop and during candidate health defers/rolls
  back before candidate admission. GitHub loss immediately before activation
  restores the baseline without another GitHub call. Recovery runs before all
  GitHub requests. Successful/no-op updates do not recursively acquire flock.
- Extraction smoke tests reject an absent future runtime module and prove no
  CLI startup or inherited service/GitHub environment is available on import.
  The builder also smoke-imports the actual committed five-module package before
  signing. Contract-1 baselines are explicitly rejected rather than silently
  promoted to pilot contract 2.
- Publication tests cover complete draft/readback/signature acceptance before
  publishing, verified existing published releases, complete draft reruns,
  partial uploads/drafts/published releases, wrong target/tag/package/provenance,
  extra assets, non-staging releases, auth/network errors and lost publication
  responses. No path silently skips a partial release or replaces an asset.
- The real proposal-backed contract-2 DB test initially caught an obsolete table
  name: supervised trials preserve the old table as `workforce_qualifications_legacy`.
  The capability check was corrected and then passed with the actual five
  proposals and existing worker/session authorization. No protection was relaxed.
- ESLint passed for all ten changed/new `.mjs` runtime/test files. The port's one
  unused fixture was removed and its roster control-character check rewritten
  equivalently for lint; qualification/model policy logic remains unchanged.
- Staging parity passed: **17 applied migration files plus the archived
  never-applied source unchanged**. `git diff d1a274fa --
  apps/company-hq/supabase` is empty. Five pilot proposal SQL files are separate
  under `tooling/hq-agent-host/proposed-migrations/`, byte-identical to the pilot.
- CI YAML parsed and exact SHA/stg/push/repository-ID/verify gates were checked.
  Both CI test entrypoints now include all Python publication tests. The publisher
  is CI-only and guarded by actual repository ID, ref, event and SHA.
- Final committed package build/import smoke and release classification are run
  after committing these source changes; delivery commit/hash are in the handoff.

Source-only limits: no Oracle, personal computer/network, live worker/job, Brain,
private credential cache, hosted DB, security setting, real release/tag, PR or
service/timer was accessed or changed. External publication is only the explicitly
allowed source branch push. Publication tests use an injected fake GitHub runner.

## Earlier checks on unchanged app graph at 234592aa

Node 24.19.0, pnpm 10.33.0 and Python 3.12 were used. Frozen dependency install and
root setup passed. Full typecheck and build each completed **9/9 tasks**; the
post-build asset check passed **1/1**. These framework checks were not rerun for
this follow-up, which changes standalone worker/automation code and separate SQL
proposals; the focused checks above validate the reconciled runtime instead.
The first delivery had 61/61 host and 22/22 Python checks before the new review
coverage/runtime reconciliation. No earlier green check is claimed for changed
pilot source without the current focused tests.

The broad repository test run was **2,929 total: 2,898 passed, 8 failed, 23
skipped**. Four tests lacked Chromium, two assert the inherited UI export gap,
and two hit timing limits under concurrent load. Both timing tests passed
isolated reruns (report 5,286ms; child lifecycle 6,542ms). The complete failed run
was not relabeled green. Browser/e2e acceptance remains unrun.

`pnpm check` still reports the nine inherited missing HQ UI exports on this
branch; the unmerged parent fixes them. Prior full lint reported seven inherited
errors in unchanged HQ app files. Full repo CI is not claimed green.
The legacy module-only updater is disabled and its shell syntax/fail-closed
entrypoint were checked. systemd examples were syntax-checked on disposable
copies; the historical Oracle Node path is absent here, so no host unit execution
or installation acceptance is claimed.

## Provenance and remaining installation boundary

Official GitHub CLI 2.103.3 verified an official signed `actions/attest-demo`
fixture offline with empty GitHub tokens, isolated configuration/cache and
independently generated trusted roots. Exact SHA/ref/workflow certificate
identity and numeric repository ID 763287532 matched; wrong SHA/ref/workflow and
modified bytes each failed. That proves offline CLI behavior, not a published HQ
release. HQ ID **1376504404** was independently verified and is enforced in both
verified provenance and current repository discovery. Root/bundle verification
code is shared by the host updater and CI publisher.

A public CLI sample bundle read at `tmaproduction.blob.core.windows.net` was
denied by the executor proxy (tunnel 403); it was not retried or bypassed. A
separate official GitHub fixture was used. A temporary executor disconnect was
recovered in the same workspace with no lost commits or uncertain push.

Installation is blocked on a separately approved legacy producer/claim pause,
complete independently reviewed **contract-2** rollback baseline, coordinated
app/schema/runtime adoption of the five proposals, read-only server capability,
actual paths/binaries/trust roots and unit/timer setup. The old/unknown installed
worker is not proven compatible with the new pilot schema. No SQL migration,
automatic legacy bootstrap, production promotion or new persistent GitHub
credential is part of this source task.
