# Admission resume source — draft/unmerged until managed health is verified

This follow-up is based on #536 at
`595bbd36547e8b7b5486b1e1167895a533f70b25`. It prepares only
`apps/company-hq/supabase/migrations/20261107041557_hq_worker_admission_resume.sql` (SHA256
`7679becae3378e871a6bb2b286466c264030da42157c05f3d10eb86c24a3c126`). The pinned repository CLI generated the version with
`pnpm db company-hq migration new hq_worker_admission_resume`.

The parent independently verified phase 1 live: exact staging worker paused at
generation 1 with request `fe6d97b2-d55f-45c6-9306-581e942649c0`, still enabled,
zero working jobs and heartbeat observed. The 17 original applied sources were
unchanged. This task performs no new live read or write. Parity's original
applied baseline/source-review records are preserved; its pending inventory is
not a current hosted migration ledger.

The new SQL compares only worker `3ead9a59-d84b-4e95-9871-abba0b129404`, enabled
and sole registered worker, against paused=true/generation=1/the original request.
Under the existing queue lock it also requires the contract-2 RPC signatures and
relations, and no working job (including expired or missing-expiry leases). It
uses the existing administrator-only setter to resume with fresh request
`9df74560-8ddf-403b-bd3d-d2c98c10338f`, advancing to generation 2. Wrong identity,
an extra worker, changed/missing hold, missing prerequisite or unfinished work
aborts the transaction. No authorization/enabled record or other worker changes.
Migration-only PG17 1/5/8-second lock/statement/transaction limits remain bounded.

**SQL cannot establish host health.** Catalog presence is not evidence of a
healthy managed worker, compatible state, reconciled delivery or completed setup.
The parent now has one-time setup/activation approval but owns all host work;
this draft MUST remain unmerged until the parent verifies fresh managed-worker
health and the required adoption/activation gates. #536 must also remain unmerged
until the parent reports legacy inactive/reconciled and its required CI is green.
No auto-merge is configured. No direct SQL/RPC pause/resume, host access or timer
action is performed here. Once approved, the only DB route is reviewed GitHub
`stg` / `apps/company-hq` → staging `dpruoncalmwicrqhqelu`; never main/production.

Focused disposable tests passed 5/5, covering successful exact resume with auth
preserved, stale/missing/already-resumed/request-mismatched holds, disabled/extra
worker protection, missing capability/model-receipt prerequisites, and existing
working jobs. Rejections preserve the hold and worker records. Fixtures use no
live jobs, inference, credentials or external mutation. Full pilot regression passed **28/28**, and source parity/unit, workspace
boundaries and release classification passed. Actual PR CI results are recorded
in the task handoff; do not interpret skipped stacked aggregate checks as passes.

The new CLI-generated resume follows the trial-delivery prerequisite and additionally requires its v4 worker API. The original never-applied 20261107030606 source is preserved under `bootstrap/superseded/`; it is no longer in the deployable migration directory. Preserve canonical pending/Active qualification rules and verify the new signed runtime. Full combined CI requires a stg base after #536 is accepted and merged under the one-root policy; no verification authorizes early resume.

The current resume is ordered after `20261107040848_hq_trial_failure_and_assigned_skills.sql` and requires its private per-skill evidence validator. The prior 20261107040102 source is also preserved in `bootstrap/superseded/`. Both request ID and SHA above are copied from the current canonical source. Branch policy permits one open HQ stg root: keep this PR based on #536 until that parent is accepted, then retarget to stg for full verification. Do not bypass the policy or merge before fresh managed health.

## Public directory mode correction — keep activation held

The first managed install exposed `200/CHDIR`: umask `077` filtered mkdir's
requested `0755` to `0700`. This source corrects only public release/control-bin
traversal modes. The root operator must review/update `release.py` and
`bootstrap.py` and their exact digest receipt before enabling the timer. The
signed worker bundle, trust policy/roots, configuration and systemd units are
unchanged. Do not chmod recursively or widen private inputs, state, credentials,
receipts or backups. Re-run real service-user preflight/paused managed health
and preserve the admission hold; these disposable tests are not host acceptance.
