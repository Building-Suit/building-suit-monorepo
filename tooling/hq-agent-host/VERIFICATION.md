# Worker release source verification — 6 November 2026

Worktree: `/workspace/hq-release`; branch: `codex/company-hq/worker-release`.
Base: `d1a274fa9573e411c38b5d7f9ffba86739f7601d` from
`codex/company-hq/staging-migration-parity`. All inherited history is preserved.
While this task ran, the parent advanced to `4a94c6605b1d1e83c96116d25daf8b62133c83e7`
with the missing HQ UI exports. That concurrent repair was inspected and left
untouched; it is not merged into this independent source branch. Validation
below describes this branch's actual `d1a274fa` baseline, not that newer parent.

This is source implementation/testing only. No Oracle, personal computer/network,
live worker/job, Brain, credential cache, hosted database or security setting was
accessed or changed. No deployment, PR publication or timer activation occurred.

## Passing verification

Executor: Node 24.19.0, pnpm 10.33.0 from a disposable `/tmp` cache, Python 3.12.
The initial pnpm launcher was 11.25.0; checks used the required project version.
Frozen-lockfile dependency installation and `pnpm run setup` passed without
lockfile or dependency-policy changes.

- **Full host suite: 61/61** (`node --test tooling/hq-agent-host/*.test.mjs`).
  Includes six actual worker-process/Unix-socket lifecycle tests, five gate/API
  tests, existing mocked CLI/Brain/roster checks and disposable PGlite DB tests.
  Tests cover paused/read-only candidate health, claim-in-flight drain, repeated
  SIGTERM, lease renewal throughout mocked active inference, exact-once durable
  delivery, unknown claim poison, durable intent after process loss, incompatible
  schema and a server-side working lease despite local idle.
- **Python builder/updater: 22/22**. Disposable files/fake services verify immutable
  committed-source building, exact manifest validation, tamper/path/duplicate
  rejection, HTTPS redirect restrictions, full baseline validation, exclusive
  lock and process-loss release, startup health, schema rejection before drain,
  bounded busy timeout, success/no-op, rollback and interruption recovery.
  Accepted/resume-response-loss recovery cannot stop newly admitted work.
  Additional regressions prove DB health loss still permits rollback of a locally
  paused never-admitted candidate and a crashed candidate's unit is stopped before
  swapping back, suppressing a `Restart=always` race. A real control-parser test
  distinguishes a local paused receipt from unknown/unacceptable startup health.
- **Full typecheck: 9/9 successful tasks**, 20m12.716s after root setup.
- **Full build: 9/9 successful tasks**, 22m47.295s, using only synthetic local
  `SUPABASE_URL`/`SUPABASE_KEY` build values.
- **Built Shop public assets: 1/1**, after its build completed. An earlier attempt
  before the Shop output existed failed on that missing prerequisite; the final
  post-build run passed.
- ESLint passed for all five changed/new `.mjs` files. Wider host-directory lint
  separately exposed six inherited errors in unchanged `brainPublisher.mjs`,
  `workforceRoster.mjs` and `intake-recovery-db.test.mjs`.
- Migration parity passed: **all 17 applied sources and the archived never-applied
  SQL remain unchanged**. No active migration or DB rollback is added.
- Release classification passed against the migration-parity parent and the full
  main-to-head candidate. Packages were built from exact committed source using
  the allowlist; final commit/package hashes are reported in the delivery handoff.
- systemd example syntax was checked with `systemd-analyze verify --man=no` on
  disposable copies. Only the expected absence of the historical Oracle Node
  executable was reported. No live unit was installed/started. Release YAML parsed
  successfully; stg-only/exact-SHA/verify-success gates were inspected.
- `bash -n` passed for the retired legacy updater entrypoint. Its disposable run
  exited 1 with its fail-closed message and performed no file/service operation.

The proposed read-only server capability SQL passed disposable PGlite checks:
anonymous/service-role denial, calls through the existing worker identity guard,
foreign-worker denial, no new table grants, scoped working-job counts, unchanged
job rows, preserved old RPCs, zero-job case and incompatible-signature refusal.
The new isolated SQL fixture stubs the existing identity guard; the inherited
full DB suite separately exercises actual HQ authorization/session behavior.
This SQL is a proposal outside the active migration chain. It was not sent to a
hosted database and is deliberately absent from worker release packages.

## Provenance experiment

Official GitHub CLI **2.103.3** successfully verified an official signed
`actions/attest-demo` fixture offline with empty `GH_TOKEN`/`GITHUB_TOKEN`, isolated
CLI configuration/cache and independently generated trusted roots. Exact source
SHA/ref/workflow certificate identity and verified numeric repository ID
**763287532** matched. Wrong SHA, ref, workflow identity and modified artifact
bytes each exited 1. This proves credential-free offline verification behavior;
it does not claim an HQ release already exists.

The HQ repository's numeric ID **1376504404** was independently checked through
its public API. The implementation enforces that ID in verified certificate
output. Current CLI policy selectors are mutually exclusive: source uses exact
`--cert-identity` (including repo/workflow/ref), source SHA/ref and hosted-runner
policy, without also passing `--signer-workflow`.

A public CLI-release sample bundle fetch from
`tmaproduction.blob.core.windows.net` was denied by the executor proxy (tunnel
403). It was not retried/bypassed; the independent official GitHub repository
fixture above was used instead.

## Repository-wide failures and limits

- `pnpm check` failed on nine inherited missing HQ UI utility exports in
  `packages/ui/package.json`; token verification passed. The newer parent
  `4a94c660` fixes those exports but is intentionally excluded here.
- `pnpm lint` failed on seven inherited errors in unchanged HQ `nuxt.config.ts`,
  `server/utils/{brain,officeRoster}.ts`,
  `shared/types/{companyPlans,officeObservations}.ts`, and
  `supabase/functions/brain-sync/index.ts`.
- `pnpm test`: **2,929 total; 2,898 passed, 8 failed, 23 skipped**. Four failures
  require missing Chromium, two assert the inherited workspace/UI export gap,
  one is a 20,000-row report timing limit and one an owned-child startup timeout.
  Both timing failures passed isolated reruns after concurrent checks completed:
  report 5,286ms, child lifecycle 6,542ms. The original full run remains failed;
  it was not relabeled green or repeated in full.
- Chromium absence was explicitly confirmed. Full browser/e2e checks remain
  unrun; no browser acceptance or green aggregate CI is claimed.
- The first typecheck stopped on missing generated Docs JSON before root setup.
  Root setup and the complete subsequent typecheck passed. This was executor
  preparation, not an inherited source type error.

The executor briefly disconnected after the broad checks. On recovery the exact
same workspace was confirmed clean at
`77191e9809ccf64320429da54e01eef82102415e`. The interrupted edit had not executed;
the recovery refinements were then applied and all 22 Python tests passed. Final
build/typecheck success summaries were recovered from their logs. Nothing was
reset, recreated or lost, and no uncertain push occurred.

## Installation remains blocked pending separate approval

No live host paths/architecture/permissions, systemd behavior, real HQ release
signature, PostgREST metadata/capability availability, Auth/Realtime, Brain,
Codex subscription/inference or founder journey was tested. Mandatory prerequisites
are a verified legacy producer/claim pause (child/job absence is insufficient),
a complete independently reviewed rollback baseline, authorized staging migration
and deployment of the proposed read-only server capability, additive schema
contract approval, and operator-reviewed units/paths/trust roots. See `RELEASES.md`.
No new persistent GitHub credential is required by the proposed verification path.
