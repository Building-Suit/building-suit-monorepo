# Worker release implementation verification — 6 November 2026

Source task only. Base: `d1a274fa9573e411c38b5d7f9ffba86739f7601d`
(`codex/company-hq/staging-migration-parity`). Worktree:
`/workspace/hq-release`; branch: `codex/company-hq/worker-release`.
No inherited work was merged, rebased, replaced or reset. No Oracle, personal
computer/network, live worker/job, Brain, credential cache, hosted database or
security setting was accessed or changed. No deployment or PR was requested.

Executor: Node 24.19.0, pnpm 10.33.0 installed in disposable `/tmp` cache,
Python 3.12. pnpm's original launcher was version 11.25.0; the pinned project
version was used for verification after that mismatch was identified.

Passing checks completed before the source checkpoint:

- Dependency installation with the frozen root lockfile and existing prepare
  scripts; no lockfile or dependency-policy changes.
- Actual worker lifecycle + maintenance gate: **10/10**, including paused
  read-only health, claim-in-flight drain, repeated SIGTERM, lease renewal during
  active mocked inference, exact-once journal/delivery, unknown claim poison,
  durable intent after process loss, and incompatible schema refusal.
- Python updater/builder: **16/16**. Tests use disposable directories/fake
  services; verify package validation, deterministic committed-source builder,
  tamper/path/duplicate rejection, complete baseline, lock exclusion, startup
  health criteria, schema rejection before drain/stop, busy drain timeout,
  success/no-op, failure rollback, interruption at stop/start/health, and durable
  accepted-state recovery that cannot terminate newly admitted work.
- Existing host suite before the final lifecycle additions: **54/54**, including
  worker/Brain/roster and disposable PGlite database tests. Final full host run is
  recorded below after the source checkpoint.
- ESLint for the four changed/new `.mjs` files passed. A wider host-directory
  lint also exposed six inherited errors in unchanged `brainPublisher.mjs`,
  `workforceRoster.mjs`, `intake-recovery-db.test.mjs`.
- Staging migration parity: **17 active migrations unchanged**, archived
  never-applied SQL unchanged. No migration or DB rollback is added.
- Real offline provenance verification with official GitHub CLI **2.103.3**,
  empty `GH_TOKEN`/`GITHUB_TOKEN`, isolated config/cache and separately generated
  trusted roots. Official CLI `v2.103.3`'s signed `actions/attest-demo` fixture
  verified successfully with exact source SHA/ref/workflow identity and numeric
  repository ID **763287532**. Wrong SHA, ref, workflow identity and tampered
  artifact each exited 1. This establishes credential-free offline verification
  behavior, not an already-published HQ release attestation. The HQ repository's
  real numeric ID **1376504404** was independently checked via its public API.
  The experiment found CLI policy selector flags are mutually exclusive; source
  uses exact `--cert-identity` (which includes repo/workflow/ref) plus SHA/ref,
  rather than combining it with `--signer-workflow`.

Repository-wide results so far:

- `pnpm check` failed on the nine inherited missing HQ UI utility exports in
  `packages/ui/package.json`; design token verification passed. No affected UI
  source or package export was changed by this task.
- `pnpm lint` failed on seven inherited HQ errors in `nuxt.config.ts`,
  `server/utils/brain.ts`, `server/utils/officeRoster.ts`,
  `shared/types/companyPlans.ts`, `shared/types/officeObservations.ts`, and
  `supabase/functions/brain-sync/index.ts`. Those files match the parent commit.
- `pnpm test`: **2,929 total; 2,898 passed, 8 failed, 23 skipped**. Failures were
  four browser tests requiring missing Chromium, the inherited workspace/UI
  export assertions (2), one 20,000-row workbook timing assertion and one owned
  child startup timeout. The last two are unrelated timing failures in unchanged
  source under concurrent executor load; their pre-existence as failures has not
  been established. This is not a green full-repository test result.
- Full typecheck, release classification and final source-build verification
  remain in progress at this checkpoint; final results will be appended.

Network verification limit: fetching a public CLI-release attestation bundle
from `tmaproduction.blob.core.windows.net` was denied by the executor proxy
(HTTP tunnel 403). It was not retried or bypassed. The independent official
GitHub repository fixture above was used for the offline CLI experiment.

Installation acceptance remains unrun: no live systemd installation, unit start,
Oracle architecture/path/permissions check, real HQ release signature, real
PostgREST metadata availability, worker identity/authentication, Realtime queue,
Brain, model/subscription, paid inference or founder-message journey was tested.
The baseline bootstrap and additive schema-contract approval in `RELEASES.md`
remain mandatory operator-reviewed actions before activation. No persistent
GitHub credential is needed by the proposed host verification path.
