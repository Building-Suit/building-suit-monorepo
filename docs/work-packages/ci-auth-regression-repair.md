# Auth CI repair and workflow execution audit

Observed staging candidate: `88ed868bdc6b5d2af11e911588cd0926c49a5c43` (PR384).
The GitHub API reports 46 check runs (44 Actions, one Vercel, one Supabase),
plus six Vercel commit statuses: 52 displayed checks, not 52 workflows.
There are 25 workflow runs: 22 promotion PR runs and three protected-push runs.

The long-lived stg-to-main PR contains the cumulative production diff. Its path
filters legitimately match many suites even when the latest staging merge is
small. Workspace and Doctor workflows also run for protected pushes; eleven
check names appear twice on this head, including skipped/evidence jobs.
Shared UI/UX changes intentionally fan out to consumer tests. External statuses
are provider integration results, not additional repository workflow definitions.

## Bounded optimization

A proven title/body-only `edited` event now runs destination branch-policy but
skips workspace review and its dependent full validation. Before: one review
plus one full validation for a root/promotion PR description edit. After: zero
expensive code-validation jobs for that edit; branch-policy still runs.
Metadata uses a separate concurrency group, so editing the PR cannot cancel
an active validation of its code. Its two skipped jobs have separate metadata
check names; they cannot replace an existing required review/verify failure or
pending result on the same SHA. The real code checks retain their names. Base retargets (including simultaneous body
edits), code updates, reopen events, unknown edit payloads, and protected pushes
retain full validation. No required check name, permission, provider setting,
migration test or release/deployment path changes.

This does not remove historical checks or claim to reduce the 52-name snapshot.
To reduce duplicate push/promotion builds further, introduce separately reviewed
exact-SHA evidence reuse: authenticate the protected `ci.yml` push run, verify its
branch, SHA, workflow identity and successful required jobs, then keep each
promotion check as an evidence verifier. Never skip a promotion gate merely
because the source branch is named stg or because an unrelated run is green.
Provider/migration receipts need their own exact-head coverage before reuse.

The two shared-regression commands in `ci.yml` are mutually exclusive through
the Doctor scope output; removing either would remove coverage, not duplication.
Full workspace concurrency remains serialized; release publication remains non-cancelling. Feature
workflows retain per-PR cancellation of obsolete heads. Stacked PRs retain their
review and relevant suites; combined workspace builds stay on staging roots and
promotion/push validation.

## Separate release and Doctor findings

Staging release reconciliation correctly refuses a failed protected verification.
The former release matrix requested production from stg and staging from main.
Environment policies admit only stg and main respectively. The new preflight
selects one admitted target, preserving publisher readiness and existing
protected-stg CI publication. No protection or permission is changed.

Doctor browser validation passed on the inherited staging head. The reported
London DST fixture commit is therefore not included without a matching failure.
The actual-provider job separately fails at personal-settings/preference
isolation; the Doctor owner retains that investigation.


## Concrete execution reduction

Metadata-only root/promotion PR edits previously ran one review plus one full
workspace validation; now neither heavy job executes, while branch-policy runs
and existing required code-check results remain intact. This was verified by
metadata run 39081938321 on the same c59f6678 source head as the still-active
code-validation run 39081842930. Code-change fanout is unchanged.

Release retry planning now changes protected push/dispatch environment jobs
from two to one, and PR completion wake-ups from two to zero environment jobs
(one cheap planner remains). In the observed stg push, one former matrix job
was rejected before steps, so this removes a rejected check/admission attempt,
not a second heavy publisher execution. Successful protected-main completion
selects production only; default-main schedules do the same. Non-authoritative
PR completion events no longer attempt an unrelated production reconciliation.
These reductions do not claim that the historical 52-check snapshot becomes a
specific smaller number: required source checks and provider statuses remain.
The larger duplicate push/promotion heavy validation still needs the exact-SHA
receipt reuse design described above; it is not implemented by this patch.


## Doctor-owner coordination

The three runtime/test files from committed Doctor-owner fix
`2e053c1a75ce6fa6c8c981645f53e22131b0c772` are reused here: Doctor's explicit
transition opt-out, the shared root's nullish fallback, and the shared contract
test. Aggregate documentation and unrelated Doctor source are not copied.
Aggregate #388 already contains the original commit; identical shared content
can reconcile without replaying the broader Doctor stack. The latest completed
Doctor failure on c59f6678 had progressed past personal-settings persistence to
"actual expired sensitive contact and fresh sign-in"; further provider-specific
work remains with that owner.


## Obsolete heavy-run cancellation

The full verify job used a job-level `always()` envelope to handle skipped
branch-policy dependencies on protected pushes. GitHub therefore kept it alive
when a superseded workflow was cancelled. Runs 39080861742 and 39080958207
needed force-cancellation during this repair and held up the serialized slot.
[GitHub documents this job/step cancellation behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation).

All heavyweight verify steps now require both `success()` and `!cancelled()`.
Before: an obsolete running validation could continue its full build/browser
sequence. After: cancellation stops its running heavy step and admits zero
remaining heavy steps; preceding failures also still stop subsequent work.
Artifact/evidence cleanup keeps its existing always/failure conditions. A final
cancelled-only `exit 1` prevents a run cancelled before checkout from becoming
successful readiness evidence. Required code-check names, review/branch-policy
requirements, the serialized workspace slot, and the non-cancelling protected
release/publisher paths remain intact. Expression regression tests cover the
cancelled and preceding-failure states; no extra full CI run is manufactured
solely to benchmark cancellation.
