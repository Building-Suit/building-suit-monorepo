# Admission resume — draft/unmerged until managed acceptance

Compatibility prerequisite #538 merged into stg at
`7fa45303abc4fc60130432fa05c2483fdebe209f`. This child preserves that actual
merge and all existing source history. It contains one pending admission-resume
migration, generated with the pinned repository CLI:

`pnpm db company-hq migration new hq_worker_admission_resume`

Canonical file: `apps/company-hq/supabase/migrations/20261107142302_hq_worker_admission_resume.sql`

SHA256: `1eea4fbed76989ebeeafb796d8c1c45acb04be7bcb770ef3e5289511c4481759`

Fresh request: `3a2f9606-7ad0-4f9c-8062-2d1069de9109`

This version follows the authenticated compatibility migration
`20261107133124_hq_worker_status_compatibility.sql`. The never-applied prior
`20261107041557_hq_worker_admission_resume.sql` is preserved byte-for-byte under `bootstrap/superseded/`, alongside
its earlier predecessors; it is outside the deployable migration directory.
The seventeen reviewed baseline sources and all accepted parent migrations are
unchanged. Source parity is an inventory, not a current hosted migration ledger.

The SQL preserves the same exact-worker/sole-enabled-worker, original pause
request/generation1, working-job and contract prerequisite guards. It changes
only the future resume request and forward timestamp. Mismatch aborts atomically;
no other worker or authorization/enabled setting is changed. It does not run from
the updater and must deploy only through reviewed GitHub staging integration.

**Keep this PR draft and unmerged until the parent verifies fresh managed-worker
health, roster reconciliation and activation acceptance.** SQL cannot establish
host health. Do not infer acceptance from a green unit, elapsed time, source tests
or catalog presence. No auto-merge is configured; no live SQL/RPC, host, Brain,
model, timer or provider action occurs in this coding task. The parent owns
installation and live acceptance. Preserve the current admission hold.

Retain the accepted explicit public-directory modes, fixed Node main-link flags,
root-control trust and signed complete-release checks. Candidate preflight and
managed health require the authenticated status proof, not privileged OpenAPI.
Qualification receipts and canonical lifecycle guards remain in force. These
source tests neither perform real qualification nor assert the first healthy
managed baseline or legacy rollback compatibility.
