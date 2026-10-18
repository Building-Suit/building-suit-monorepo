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
Full workspace concurrency remains serialized and non-cancelling. Feature
workflows retain per-PR cancellation of obsolete heads. Stacked PRs retain their
review and relevant suites; combined workspace builds stay on staging roots and
promotion/push validation.

## Separate release and Doctor findings

Staging release reconciliation correctly refuses a failed protected verification.
The release matrix's production leg on a stg event is rejected by production
branch protection before runner steps. Release ownership and protection remain
unchanged in this repair.

Doctor browser validation passed on the inherited staging head. The reported
London DST fixture commit is therefore not included without a matching failure.
The actual-provider job separately fails at personal-settings/preference
isolation; the Doctor owner retains that investigation.
