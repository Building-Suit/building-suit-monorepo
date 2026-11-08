# Founder task cancellation — 9 November 2026

Task details can cancel a queued, working or in-review task through the existing
founder-authenticated POST `/api/hq/tasks/[id]/cancel`. The confirmation names
its exact title and ID and defaults to keeping the task. This does not create
work, grant qualification, change source bindings or add database permissions.
The database remains authoritative for ownership and cancellable status.

The product adapter rereads the exact task before dispatch, sends no automatic
POST retries, and checks the exact canceled status afterward. Duplicate clicks
are suppressed across detail panels. An uncertain response is not success; a
later explicit attempt rereads the task before any new POST. Authentication loss,
identity change and disposal abort local requests and suppress stale feedback.
Completed/canceled tasks and unsupported blocked states expose no cancel button.

The existing queue lock, founder guard, cancellation RPC and active-trial closure
trigger remain unchanged. Original drafts, reviews, task rows and historical
bindings are not edited by the UI. No live cancellation, host operation, migration,
personal-network access or main/production promotion is part of this patch.

Validation is recorded in the PR after checks complete. Synthetic tests do not
prove hosted session availability or execute the founder's pending cancellation.

## Cloud verification

- Seventeen focused cancellation tests passed, including actual composed-signal
  timeout abortion before dispatch, during POST and during readback.
- Full HQ unit suite passed; existing disposable PostgreSQL workforce suite
  passed 16 tests. The latter exercises existing founder cancellation and
  rejection of late worker results, not hosted cancellation of the pending task.
- HQ production build, direct `vue-tsc --noEmit` and targeted app/shared UI lint
  passed (four existing shared-component attribute-order warnings, no errors).
- Workspace/token/atomic-template checks passed. Independent review found and
  verified fixes for transient-detail feedback loss and ineffective fetch
  timeout options with explicit signals. No remaining blocking source findings.
- Browser cases are prepared for exact-task confirmation, default focus, repeated
  clicks, uncertain responses, completion during confirmation and delayed details.
  Chromium could not start because this cloud executor prohibits its local Unix
  socket, including an approved execution retry. Browser acceptance is unverified.
- Standard preflight cannot authenticate the local `gh` CLI. Public git fetch
  and connected GitHub reads verify branch/PR state instead. The patch is a child
  of the existing company-hq root #553; it does not modify that parent's branch.

Required exact-head CI, browser acceptance and the staging integration/provider
gates remain pending. No merge-readiness or deployment claim is made.

## Targeted CI browser acceptance

The existing review job now reuses its installed dependencies and Chromium to
build HQ and run only the four mocked cancellation browser cases when HQ, shared
UI/UX/layer/assets, dependency or workflow inputs change. Unrelated changes skip
that step. Failure traces are retained. Existing gates, permissions, ten-minute
review timeout and publication conditions are unchanged. This runs in the normal
GitHub runner, not through a workaround to the cloud executor's socket restriction.
Actual browser success must be observed on the new commit before merge readiness.
