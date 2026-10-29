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
Environment policies admit only stg and main respectively. The coordinated fallback guard
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

The coordinated release implementation from Doctor-owner commit 9b07fdf8
removes the separate push-triggered fallback workflow. Before: two workflows
could attempt publication for one protected push (early fallback plus the
post-verify CI publisher). After: only the existing post-verify CI hook handles
that push. This removes one workflow run and its premature publisher attempt.
Fallback schedule/dispatch/completion events retain one matching environment
rather than an unconditional two-environment matrix; PR and mismatched-ref
completion events request none. Previously rejected environment legs consumed
no runner steps, so removing those legs is not counted as a heavy compute win.

Source-change suite fanout remains unchanged. Required checks/provider statuses
are not removed, and this does not promise that the historical 52-check snapshot
will become a specific smaller number. Broader duplicate protected-push versus
promotion heavy validation still needs exact-SHA receipt reuse; it is not
implemented here.


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

The verify job itself now requires `!cancelled()` alongside the unchanged
review/branch-policy conditions. The actual supersession of db978ceb by bd7cc223
showed that step guards alone were insufficient while `always()` remained on
the job; its old verification continued into setup/typecheck. That observation
is not counted as a successful cancellation benchmark.

Heavy steps additionally require `success()` and `!cancelled()`, retaining prior
failure gating. After a supersession, the job-level condition permits GitHub to
cancel the obsolete job rather than keep the serialized slot alive. Cleanup
retains its existing always/failure policy. Required names and all normal
verification commands remain intact. Protected publication independently rejects
pending, failed, cancelled and skipped verification (covered by the existing
protected-verification tests); only completed success can publish. No extra full
run is manufactured solely to benchmark cancellation.


## Canonical release/fixture alignment

Aggregate #388 already contained the smaller protected-ref release guard in
`9b07fdf88e2eed683247e9e861eb0a57fdf65178`. This PR aligns with its workflow and
regression tests, retaining the existing CI post-verification publisher rather
than keeping a second planner implementation. Intermediate planner modules are
removed. The committed password-stage helper from e556574f is reused only in
the actual-provider account reauthentication fixture; broader Doctor changes
remain in the aggregate. Password submission and server checks stay real.


When aggregate #388 takes this branch, retain its broader account-provider
fixture (owner setup assertions, optional home/admission inputs and granular
reauthentication diagnostics). This branch adds only the existing password-stage
helper/import/call to the baseline fixture; the aggregate already has those.
Resolve any overlapping fixture hunk in favor of the aggregate's complete file.
Canonical release guards/tests are shared with 9b07fdf8; retain the quantified
regex spacing corrections required by root lint.


## Complete baseline auth-fixture reconciliation

The Doctor protocol job exercises every baseline `*.auth.fixture.ts`. Its old
password assumptions kept timing out after the common sign-in UI became
email-first. The existing-file subset (16 fixtures) reuses owner commit e556574f's
helper calls, always after email entry and immediately before password entry;
aggregate-only administrative fixtures are not added. A local reproduction
failed on a missing password input before the change; the core EN/AR protocol
group then passed all seven cases.

The resumed onboarding case also exposed two duplicate professional-name
inputs introduced by the unconditional verified-identity summary. Shared signup
presentation now separates professional-profile setup from provider identity:
one editable profile-name input, no duplicate account/email inputs, and explicit
nameLocked still honored. Normal Shop verified-account onboarding retains the
read-only provider name/email summary. Rendered-control regressions cover both
projections; original professional onboarding assertions remain intact.
