# Admission resume source — draft/unmerged until managed health is verified

This follow-up is based on #536 at
`72be94574741274d74d02b6829a3960bec19fea6`. It prepares only
`apps/company-hq/supabase/migrations/20261107030606_hq_worker_admission_resume.sql` (SHA256
`6ab35589888abd9ee62158fb99563758a92744c2d52f6670adf02e4de6298e37`). The pinned repository CLI generated the version with
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
`6da24f6e-6d4c-4f44-ac79-3783c50ed203`, advancing to generation 2. Wrong identity,
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
