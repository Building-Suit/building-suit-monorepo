# Supervised trial functional prerequisite (unmerged)

PR #536 adds a seventh forward migration after its six unchanged contract-2
sources: `20261107034418_hq_workforce_trial_delivery.sql`. It was generated with
`pnpm db company-hq migration new hq_workforce_trial_delivery`. The 17 historical
applied sources and the phase-1 fence are unchanged. This source neither resumes
admission nor starts a model, host service or deployment. PR #537 remains held.

The existing founder-authenticated employee inspector now offers **Start
supervised trial**, then **Approve qualification** after recorded review/report.
Both require the existing confirmation interaction. The BFF keeps fresh founder
Auth, same-origin/access gates and bounded exact input; it uses the existing
founder SQL validators, without a browser/service-role credential. A start retry
uses the same request key. The status projection exposes bounded action metadata,
not host evidence or journal contents.

The worker delivers its actual journaled model-binding evidence with its job,
lease and worker identity through `hq_worker_finish_v4`. The server derives trial
and artifact identity and atomically finishes the job and records the validated
receipt. Workers cannot issue qualifications or call the private administrative
receipt recorder. An invalid proof rolls back the finish. A lost response or
journal acknowledgment retries only the same durable delivery, never inference.
Failed work without host proof cannot qualify. New workers require both the v4
OpenAPI shape and `trialDelivery: 1`, `trialSkills: 1`, `trialFailureSettlement: 1` before managed acceptance/admission.

The existing head authorization remains unchanged. Steve's rejection of an
ordinary qualified employee artifact now returns through its actual T2 manager
before the employee's correction; the scoped trial route to Iris is preserved.

## Explicit remaining activation conditions

* Keep both migration/activation PRs unmerged pending review, exact-head checks
  and the parent's approved live sequence. No SQL is applied by these tests.
* Build and verify a **new signed worker release** after these runtime changes.
  The earlier 2c3f34c6/79c8b87f runtime is not this functional trial implementation.
  Keep the root-owned trust, paused startup and rollback acceptance rules.
* Existing founder-controlled trial validators require a T1 worker with a live,
  versioned profile, one selected currently assigned skill per trial and a same-department T2 manager.
  Verify actual canonical eligibility for each requested employee. Do not remove
  extra skills, invent versions/receipts, grandfather staff or widen tools.
* The global admission pause also blocks trial jobs. The parent must authorize
  the controlled trial admission/managed-health sequence before any real trial.
* After genuine host execution, head review, Iris review and report complete,
  founder qualification still **does not activate pending staff**. The canonical
  Brain registry lifecycle must be changed to `Active` through its approved
  writer and synced by the worker. Keep the receipt-bound profile, assigned skill
  IDs and versions, model/effort, manager and department unchanged. A source change
  can invalidate qualification and requires a fresh trial. This patch adds no
  Drive writer and never edits lifecycle directly in the operational database.
* Real inference/qualification and an ordinary reviewed task require live
  acceptance by the parent; disposable test results are not live qualification.

The work scope remains bounded drafting/research with existing restricted tools.
Qualification does not add shell, file writes, MCPs, outreach, deployments or
hiring authority.

## Verified public protocol and deployment inputs

Both `rust-v0.160.0` (the installed CLI) and `rust-v0.159.2` publish the same
[ThreadStartResponse schema](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/app-server-protocol/schema/json/v2/ThreadStartResponse.json)
(SHA-256 `70d9c9a3a064edb76662ec7cd066d142ed9252b768272bc3a7d00788386755c0`).
Model/provider and nullable effort resolve on the result envelope. Optional
persisted thread settings must agree when present. Missing/null effective effort,
conflicting duplicates, wrong thread IDs and subsequent overrides fail closed.
This is host-returned configuration, never proof of provider-served model.
[ThreadStartParams](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/app-server-protocol/schema/json/v2/ThreadStartParams.json)
(SHA-256 `e9c6d3cc18d049bfbc0249add3808fb8e5a27e1a0b5a423767aafbc3859a9428`)
accepts config overrides and no top-level effort. The existing
`config.model_reasoning_effort` is checked against returned effective effort;
trial turn/start sends no model or effort override. Mock CLI tests follow this
envelope; they do not run the installed CLI or any model.

The parent verified company-hq-stg's Vercel Production branch is `stg`, root is
`apps/company-hq`, Preview Branch Tracking is OFF and Ignored Build Step is Only
build production. The source config now enables exactly `stg` using the
[documented branch filter](https://vercel.com/docs/project-configuration/git-configuration):
`{"git":{"deploymentEnabled":{"*":false,"stg":true}}}`. No provider settings,
manual deployment, other branch or repository-main promotion is performed here.

## Review follow-up: failed startup and multiple assigned skills

`20261107040848_hq_trial_failure_and_assigned_skills.sql` follows the original
trial-delivery source without changing its bytes. A failed launch with no turn
request can now commit an artifact-free failed receipt with zero turn counters
and an observed error. Successful proof validation remains strict. Actual emitted
null-effort and mismatched-model failures settle as blocked jobs, replay the same
receipt and leave the maintenance gate unpoisoned; they cannot qualify anyone.

Each assigned skill requires a separate trial and independent review. Every
receipt retains the FULL current profile/skill-set/model/effort/manager binding;
coverage is derived from that receipt's trial.skill_file_id. Duplicate receipts
for one skill cannot cover another, and any indexed source revision change
invalidates the old binding. The inspector uses its existing controls to offer
the next uncovered skill and distinguish partial coverage from the final pending
canonical Active transition. No assignment is truncated and no new approval
screen, automatic paid trial, receipt table or hiring framework is introduced.
The existing explicit trial-start and founder qualification actions remain
separate scoped decisions; they are not a new automatic hiring permission.

The multi-skill regression also exposed that claim responses lack top-level
job.kind. The forward wrapper now scopes actual worker inputs by context.mode,
so each trial receives only its selected skill while the canonical full roster
remains unchanged. New semantic capability flags prevent premature managed
acceptance before this forward prerequisite is present. Root updater controls,
manifest format, trust roots and systemd settings are unchanged.
