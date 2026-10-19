# DOS-M2 — Clinical records and prescriptions on the web

14 tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `DOS-M2.json` and `DOS-M2.import-proposal.json`.

Milestone prerequisites: DOS-M1. Every task also has an open blocking start decision.

## DOS-M2-001 — Clinical workflow and prescribing policy sign-off

Approve encounter, amendment, signing and delegable drafting policy with a qualified clinician; no medical recommendation is generated.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F001: Approve encounter, amendment, signing and delegable drafting policy with a qualified clinician; no medical recommendation is generated. Acceptance: Record accountable clinician, review date, encounter state transitions and which actions may be drafted by staff versus signed by a doctor; unresolved professional authority remains explicit. Define amendment/revocation, patient release and conflict rules for synthetic workflows; retain original signed material and audit actor/time. Produce a signed decision record or leave clinical governance OPEN; neither a developer nor a test run can supply clinical approval. Prepare evidence for DOS-M2-GATE-CLINICAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M1-020
Blocking decisions: DOS-M2-GATE-START

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/dos-m2-001.json

Acceptance
1. Record accountable clinician, review date, encounter state transitions and which actions may be drafted by staff versus signed by a doctor; unresolved professional authority remains explicit.
2. Define amendment/revocation, patient release and conflict rules for synthetic workflows; retain original signed material and audit actor/time.
3. Produce a signed decision record or leave clinical governance OPEN; neither a developer nor a test run can supply clinical approval.
4. Prepare evidence for DOS-M2-GATE-CLINICAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Review doctor-alone, delegated intake and absent signing authority cases with the clinician.
- Attempt to approve an unsigned policy or treat a staff draft as a signed prescription; acceptance must remain blocked.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-001.md
- release-fragments/dos-m2-001.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Only the named domain approvals and actual device/release receipts required by criterion coverage; routine checks require no human acknowledgement.",
    "phase": "pre_publication",
    "blocker": "criterion_domain_or_device_evidence_required"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-001-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Record accountable clinician, review date, encounter state transitions and which actions may be drafted by staff versus signed by a doctor; unresolved professional authority remains explicit.",
    "procedure": "Qualified clinician reviews the state/role matrix including delegated drafting and doctor-only signing.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-001-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Define amendment/revocation, patient release and conflict rules for synthetic workflows; retain original signed material and audit actor/time.",
    "procedure": "Review an amended/revoked synthetic record and its patient-release/conflict policy.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-001-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Produce a signed decision record or leave clinical governance OPEN; neither a developer nor a test run can supply clinical approval.",
    "procedure": "Verify reviewer identity, date and signed policy; unsigned evidence leaves the governance decision open.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-001-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Prepare evidence for DOS-M2-GATE-CLINICAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.",
    "procedure": "Verify accountable approval for the named produced decisions before the dependent native/provider/live-data action; a prepared document alone is not approval.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-001-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-001.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-001.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": null,
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-001.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-002 — Encounter lifecycle and visit provenance

Implement draft/in-progress/finalized/amended encounters with doctor, location, patient and time attribution.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F002: Implement draft/in-progress/finalized/amended encounters with doctor, location, patient and time attribution. Acceptance: Create distinct encounter identity referencing the practice-patient relationship, responsible doctor and encounter location; never make a location the chart owner. Authorize draft/in-progress/finalized/amended transitions on the server with version comparison and idempotency keys; finalized content cannot be overwritten. Persist actor, event time, originating encounter/version and amendment reason; archived locations and patients retain referenced history.

Dependencies: DOS-M2-001
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-002.json

Acceptance
1. Create distinct encounter identity referencing the practice-patient relationship, responsible doctor and encounter location; never make a location the chart owner.
2. Authorize draft/in-progress/finalized/amended transitions on the server with version comparison and idempotency keys; finalized content cannot be overwritten.
3. Persist actor, event time, originating encounter/version and amendment reason; archived locations and patients retain referenced history.

Verification scenarios
- Two concurrent finalization requests create one finalized version and a clear conflict/replay result.
- Doctor B, ungranted secretary and forged practice/location IDs cannot read or transition Doctor A encounters.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-002.md
- apps/doctor-suit/tests/unit/dos-m2-002.test.mjs
- apps/doctor-suit/supabase/tests/dos-m2-002.sql
- apps/doctor-suit/tests/e2e/dos-m2-002.spec.ts
- release-fragments/dos-m2-002.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-002.test.mjs"
    ],
    "commands": [
      "dos-m2-002-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify database authorization, replay and write integrity with disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-002.sql"
    ],
    "commands": [
      "dos-m2-002-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-002.spec.ts"
    ],
    "commands": [
      "dos-m2-002-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-002-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Create distinct encounter identity referencing the practice-patient relationship, responsible doctor and encounter location; never make a location the chart owner.",
    "procedure": "Reject cross-practice patient/encounter references and preserve doctor/location foreign-key attribution.",
    "test_case_name": "DOS-M2-002-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-002.sql"
    ],
    "command_refs": [
      "dos-m2-002-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-002-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Authorize draft/in-progress/finalized/amended transitions on the server with version comparison and idempotency keys; finalized content cannot be overwritten.",
    "procedure": "Race finalize and stale update, replay finalize and attempt overwrite of a finalized version.",
    "test_case_name": "DOS-M2-002-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-002.sql"
    ],
    "command_refs": [
      "dos-m2-002-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-002-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Persist actor, event time, originating encounter/version and amendment reason; archived locations and patients retain referenced history.",
    "procedure": "Amend an encounter at an archived location and verify actor/time/reason plus retained history.",
    "test_case_name": "DOS-M2-002-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-002.sql"
    ],
    "command_refs": [
      "dos-m2-002-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-002-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-002.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-002.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-002.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-003 — History, allergies and structured intake

Capture clinician-reviewed history/allergies/vitals with provenance, correction and permission rules.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F003: Capture clinician-reviewed history/allergies/vitals with provenance, correction and permission rules. Acceptance: Represent patient-reported, staff-entered and clinician-reviewed observations separately with source, timestamp and unit; distinguish unknown, none-reported and missing allergy/history fields. Correct observations through a traceable revision; unreviewed data must not render as verified and no values or diagnoses are inferred. Apply encounter/practice and delegated intake permissions consistently to history, allergies and observations; clinician review requires the approved actor capability.

Dependencies: DOS-M2-002
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-003.json

Acceptance
1. Represent patient-reported, staff-entered and clinician-reviewed observations separately with source, timestamp and unit; distinguish unknown, none-reported and missing allergy/history fields.
2. Correct observations through a traceable revision; unreviewed data must not render as verified and no values or diagnoses are inferred.
3. Apply encounter/practice and delegated intake permissions consistently to history, allergies and observations; clinician review requires the approved actor capability.

Verification scenarios
- Render unknown versus explicitly none-reported allergies distinctly in both locales.
- Reject invalid units/schema and stale concurrent correction; unprivileged staff cannot mark an observation reviewed.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-003.md
- apps/doctor-suit/tests/unit/dos-m2-003.test.mjs
- apps/doctor-suit/supabase/tests/dos-m2-003.sql
- apps/doctor-suit/tests/e2e/dos-m2-003.spec.ts
- release-fragments/dos-m2-003.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-003.test.mjs"
    ],
    "commands": [
      "dos-m2-003-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify database authorization, replay and write integrity with disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-003.sql"
    ],
    "commands": [
      "dos-m2-003-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-003.spec.ts"
    ],
    "commands": [
      "dos-m2-003-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-003-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Represent patient-reported, staff-entered and clinician-reviewed observations separately with source, timestamp and unit; distinguish unknown, none-reported and missing allergy/history fields.",
    "procedure": "Persist and render unknown versus none-reported history and distinguish patient/staff/clinician provenance.",
    "test_case_name": "DOS-M2-003-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-003.sql",
      "apps/doctor-suit/tests/e2e/dos-m2-003.spec.ts"
    ],
    "command_refs": [
      "dos-m2-003-data",
      "dos-m2-003-browser"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-003-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Correct observations through a traceable revision; unreviewed data must not render as verified and no values or diagnoses are inferred.",
    "procedure": "Correct a versioned observation and reject invalid units or a stale write without inferring values.",
    "test_case_name": "DOS-M2-003-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-003.sql"
    ],
    "command_refs": [
      "dos-m2-003-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-003-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Apply encounter/practice and delegated intake permissions consistently to history, allergies and observations; clinician review requires the approved actor capability.",
    "procedure": "An administrative intake grant cannot mark data clinically reviewed or read another practice.",
    "test_case_name": "DOS-M2-003-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-003.sql"
    ],
    "command_refs": [
      "dos-m2-003-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-003-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-003.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-003.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-003.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-004 — Clinical note templates and specialty-neutral forms

Provide typed clinical forms and configurable templates without claiming coverage of every specialty.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F004: Provide typed clinical forms and configurable templates without claiming coverage of every specialty. Acceptance: Define versioned neutral note sections and typed field schemas with explicit optional/required fields approved by governance; do not silently claim specialty coverage. Persist the template version with each note so later template edits do not rewrite historical content. Use shared page templates for editing/review, retain unsaved content on validation/network failure and require explicit conflict resolution.

Dependencies: DOS-M2-003
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-004.json

Acceptance
1. Define versioned neutral note sections and typed field schemas with explicit optional/required fields approved by governance; do not silently claim specialty coverage.
2. Persist the template version with each note so later template edits do not rewrite historical content.
3. Use shared page templates for editing/review, retain unsaved content on validation/network failure and require explicit conflict resolution.

Verification scenarios
- Open an older note after a template upgrade and verify its original field meaning and values.
- Exercise Arabic/RTL, keyboard editing, missing required fields, stale version and interrupted-save recovery.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-004.md
- apps/doctor-suit/tests/unit/dos-m2-004.test.mjs
- apps/doctor-suit/tests/e2e/dos-m2-004.spec.ts
- release-fragments/dos-m2-004.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-004.test.mjs"
    ],
    "commands": [
      "dos-m2-004-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-004.spec.ts"
    ],
    "commands": [
      "dos-m2-004-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-004-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Define versioned neutral note sections and typed field schemas with explicit optional/required fields approved by governance; do not silently claim specialty coverage.",
    "procedure": "Render the approved typed note schema and reject missing required fields in both locales.",
    "test_case_name": "DOS-M2-004-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-004.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m2-004.spec.ts"
    ],
    "command_refs": [
      "dos-m2-004-unit",
      "dos-m2-004-browser"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-004-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Persist the template version with each note so later template edits do not rewrite historical content.",
    "procedure": "Open a note using its original template after a schema version change and compare field meanings.",
    "test_case_name": "DOS-M2-004-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-004.test.mjs"
    ],
    "command_refs": [
      "dos-m2-004-unit"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-004-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Use shared page templates for editing/review, retain unsaved content on validation/network failure and require explicit conflict resolution.",
    "procedure": "Interrupt a save and race an update; retain the draft and require explicit conflict resolution.",
    "test_case_name": "DOS-M2-004-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-004.spec.ts"
    ],
    "command_refs": [
      "dos-m2-004-browser"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-004-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-004.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-004.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-004.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-005 — Medication catalogue source and licensing contract

Select an approved catalogue/manual-entry policy, provenance and update workflow; do not invent EDA API access.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F005: Select an approved catalogue/manual-entry policy, provenance and update workflow; do not invent EDA API access. Acceptance: Record candidate catalogue owner, license/redistribution restrictions, allowed fields, version, provenance, update cadence and access evidence; unavailable APIs remain unavailable. Define explicit clinician-entered manual entries and unverified identity labeling where approved; no scraping, EDA access or commercial license is assumed. Approve a versioned catalogue/manual-entry contract with withdrawal/update behavior and retain the licensing decision OPEN until evidence is supplied. Prepare evidence for DOS-M2-GATE-CATALOGUE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M2-004
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/dos-m2-005.json

Acceptance
1. Record candidate catalogue owner, license/redistribution restrictions, allowed fields, version, provenance, update cadence and access evidence; unavailable APIs remain unavailable.
2. Define explicit clinician-entered manual entries and unverified identity labeling where approved; no scraping, EDA access or commercial license is assumed.
3. Approve a versioned catalogue/manual-entry contract with withdrawal/update behavior and retain the licensing decision OPEN until evidence is supplied.
4. Prepare evidence for DOS-M2-GATE-CATALOGUE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Review unknown medicine, withdrawn catalogue version and missing license cases.
- Reject a proposed national-provider adapter without documented access terms or verified interface.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-005.md
- release-fragments/dos-m2-005.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Only the named domain approvals and actual device/release receipts required by criterion coverage; routine checks require no human acknowledgement.",
    "phase": "pre_publication",
    "blocker": "criterion_domain_or_device_evidence_required"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-005-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Record candidate catalogue owner, license/redistribution restrictions, allowed fields, version, provenance, update cadence and access evidence; unavailable APIs remain unavailable.",
    "procedure": "Inspect actual license/access evidence and catalogue owner/version/redistribution terms.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-005-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Define explicit clinician-entered manual entries and unverified identity labeling where approved; no scraping, EDA access or commercial license is assumed.",
    "procedure": "Review permitted manual entry and withdrawal/update handling without claiming an unavailable API.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-005-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Approve a versioned catalogue/manual-entry contract with withdrawal/update behavior and retain the licensing decision OPEN until evidence is supplied.",
    "procedure": "Accept only an accountable signed catalogue policy; missing evidence preserves the open licensing gate.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-005-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Prepare evidence for DOS-M2-GATE-CATALOGUE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.",
    "procedure": "Verify accountable approval for the named produced decisions before the dependent native/provider/live-data action; a prepared document alone is not approval.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-005-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-005.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-005.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": null,
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-005.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-006 — Structured prescription builder

Capture medicine identity, strength, form, dose, route, dates, frequency and instructions with clinician review.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F006: Capture medicine identity, strength, form, dose, route, dates, frequency and instructions with clinician review. Acceptance: Persist medicine identity/provenance, entered strength/form/dose/unit/route, start/end, structured frequency and clinician-authored instructions without filling clinical values automatically. Validate required shape and internal consistency, associate each draft with encounter and responsible doctor, and surface unresolved medicine identity explicitly. Retain draft edits with version checks; save is not signing and no validation result implies that a dose or medicine is clinically appropriate.

Dependencies: DOS-M2-005
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL, DOS-M2-GATE-CATALOGUE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-006.json

Acceptance
1. Persist medicine identity/provenance, entered strength/form/dose/unit/route, start/end, structured frequency and clinician-authored instructions without filling clinical values automatically.
2. Validate required shape and internal consistency, associate each draft with encounter and responsible doctor, and surface unresolved medicine identity explicitly.
3. Retain draft edits with version checks; save is not signing and no validation result implies that a dose or medicine is clinically appropriate.

Verification scenarios
- Round-trip a synthetic manually entered medicine and a catalogue reference without changing values.
- Reject malformed units, missing approved required fields and stale writes; secretary cannot convert a draft to a signed order.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-006.md
- apps/doctor-suit/tests/unit/dos-m2-006.test.mjs
- apps/doctor-suit/supabase/tests/dos-m2-006.sql
- apps/doctor-suit/tests/e2e/dos-m2-006.spec.ts
- release-fragments/dos-m2-006.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-006.test.mjs"
    ],
    "commands": [
      "dos-m2-006-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify database authorization, replay and write integrity with disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-006.sql"
    ],
    "commands": [
      "dos-m2-006-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-006.spec.ts"
    ],
    "commands": [
      "dos-m2-006-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-006-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Persist medicine identity/provenance, entered strength/form/dose/unit/route, start/end, structured frequency and clinician-authored instructions without filling clinical values automatically.",
    "procedure": "Round-trip all entered prescription fields and catalogue/manual provenance with no generated clinical defaults.",
    "test_case_name": "DOS-M2-006-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-006.sql",
      "apps/doctor-suit/tests/unit/dos-m2-006.test.mjs"
    ],
    "command_refs": [
      "dos-m2-006-data",
      "dos-m2-006-unit"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-006-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Validate required shape and internal consistency, associate each draft with encounter and responsible doctor, and surface unresolved medicine identity explicitly.",
    "procedure": "Reject missing/inconsistent field shapes and show unresolved medicine identity explicitly.",
    "test_case_name": "DOS-M2-006-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-006.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m2-006.spec.ts"
    ],
    "command_refs": [
      "dos-m2-006-unit",
      "dos-m2-006-browser"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-006-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Retain draft edits with version checks; save is not signing and no validation result implies that a dose or medicine is clinically appropriate.",
    "procedure": "Replay a save and race edits; save never creates a signed version.",
    "test_case_name": "DOS-M2-006-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-006.sql"
    ],
    "command_refs": [
      "dos-m2-006-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-006-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-006.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-006.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-006.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-007 — Complex schedules and schedule validation

Represent tapering, every-N-hours, selected weekdays and as-needed instructions without deriving unapproved medical advice.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F007: Represent tapering, every-N-hours, selected weekdays and as-needed instructions without deriving unapproved medical advice. Acceptance: Model explicit schedule segments for tapering, interval, selected weekdays and as-needed instructions with boundaries, timezone semantics and versioned representation. Detect overlapping/contradictory segments and ambiguous time anchors for clinician correction; never calculate a replacement dose or infer an as-needed dosing cadence. Preserve exact entered regimen through serialization and amendments; provide deterministic test vectors reviewed under the prescribing policy.

Dependencies: DOS-M2-006
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL, DOS-M2-GATE-CATALOGUE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-007.json

Acceptance
1. Model explicit schedule segments for tapering, interval, selected weekdays and as-needed instructions with boundaries, timezone semantics and versioned representation.
2. Detect overlapping/contradictory segments and ambiguous time anchors for clinician correction; never calculate a replacement dose or infer an as-needed dosing cadence.
3. Preserve exact entered regimen through serialization and amendments; provide deterministic test vectors reviewed under the prescribing policy.

Verification scenarios
- Test midnight crossing, leap day, daylight-saving gaps/folds and selected weekdays with fixed clocks.
- Reject overlapping taper segments and absent interval anchors; as-needed instructions do not generate a fixed regimen.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-007.md
- apps/doctor-suit/tests/unit/dos-m2-007.test.mjs
- release-fragments/dos-m2-007.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-007.test.mjs"
    ],
    "commands": [
      "dos-m2-007-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Only the named domain approvals and actual device/release receipts required by criterion coverage; routine checks require no human acknowledgement.",
    "phase": "pre_publication",
    "blocker": "criterion_domain_or_device_evidence_required"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-007-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Model explicit schedule segments for tapering, interval, selected weekdays and as-needed instructions with boundaries, timezone semantics and versioned representation.",
    "procedure": "Round-trip taper, interval, weekday and as-needed segments with fixed anchors and version.",
    "test_case_name": "DOS-M2-007-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-007.test.mjs"
    ],
    "command_refs": [
      "dos-m2-007-unit"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-007-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Detect overlapping/contradictory segments and ambiguous time anchors for clinician correction; never calculate a replacement dose or infer an as-needed dosing cadence.",
    "procedure": "Reject overlaps and ambiguous anchors and verify no replacement dose or inferred as-needed cadence.",
    "test_case_name": "DOS-M2-007-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-007.test.mjs"
    ],
    "command_refs": [
      "dos-m2-007-unit"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-007-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Preserve exact entered regimen through serialization and amendments; provide deterministic test vectors reviewed under the prescribing policy.",
    "procedure": "Replay clinician-reviewed fixed-clock vectors after amendment and compare exact entered regimen.",
    "test_case_name": "DOS-M2-007-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-007.test.mjs"
    ],
    "command_refs": [
      "dos-m2-007-unit"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-007-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-007.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-007.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-007.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-008 — Clinician review, signing and immutable versions

Enforce accountable finalization, revoke/amend workflow and immutable prior prescription versions.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F008: Enforce accountable finalization, revoke/amend workflow and immutable prior prescription versions. Acceptance: Require the approved accountable doctor and current authorization for signing; invitations, editable metadata and staff grants cannot confer signing authority. Atomically store immutable signed version, signer and time, source draft/version and integrity reference; repeated signing is idempotent and stale signing fails. Revocation/amendment creates a linked version and reason with old content preserved; downstream consumers can distinguish active, superseded and stopped versions.

Dependencies: DOS-M2-007
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL, DOS-M2-GATE-CATALOGUE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-008.json

Acceptance
1. Require the approved accountable doctor and current authorization for signing; invitations, editable metadata and staff grants cannot confer signing authority.
2. Atomically store immutable signed version, signer and time, source draft/version and integrity reference; repeated signing is idempotent and stale signing fails.
3. Revocation/amendment creates a linked version and reason with old content preserved; downstream consumers can distinguish active, superseded and stopped versions.

Verification scenarios
- Race sign versus draft update and prove one consistent signed snapshot.
- Reject secretary, outsider, revoked membership and replayed stale signing tokens; confirm old signed bytes remain unchanged after amendment.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-008.md
- apps/doctor-suit/tests/unit/dos-m2-008.test.mjs
- apps/doctor-suit/supabase/tests/dos-m2-008.sql
- apps/doctor-suit/tests/e2e/dos-m2-008.spec.ts
- release-fragments/dos-m2-008.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-008.test.mjs"
    ],
    "commands": [
      "dos-m2-008-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify database authorization, replay and write integrity with disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-008.sql"
    ],
    "commands": [
      "dos-m2-008-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-008.spec.ts"
    ],
    "commands": [
      "dos-m2-008-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-008-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Require the approved accountable doctor and current authorization for signing; invitations, editable metadata and staff grants cannot confer signing authority.",
    "procedure": "Try signing as secretary, outsider and revoked doctor; require current accountable doctor authority.",
    "test_case_name": "DOS-M2-008-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-008.sql"
    ],
    "command_refs": [
      "dos-m2-008-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-008-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Atomically store immutable signed version, signer and time, source draft/version and integrity reference; repeated signing is idempotent and stale signing fails.",
    "procedure": "Race signing with an edit and replay success; persist one immutable signed snapshot.",
    "test_case_name": "DOS-M2-008-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-008.sql"
    ],
    "command_refs": [
      "dos-m2-008-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-008-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Revocation/amendment creates a linked version and reason with old content preserved; downstream consumers can distinguish active, superseded and stopped versions.",
    "procedure": "Stop/amend a signed version and verify original bytes, linked successor and current-status projection.",
    "test_case_name": "DOS-M2-008-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-008.sql"
    ],
    "command_refs": [
      "dos-m2-008-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-008-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-008.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-008.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-008.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-009 — Prescription print and patient-safe sharing

Render readable bilingual-capable print/share output from structured data with scoped access and no public patient exposure.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F009: Render readable bilingual-capable print/share output from structured data with scoped access and no public patient exposure. Acceptance: Render print output from one signed structured version with doctor, patient, location, date, version/status and unmodified instructions; bilingual layout must remain legible. Use shared pure print presentation and UX-owned download behavior; app adapters perform current permission checks. Sharing is scoped, revocable and expiry-aware with no public patient metadata, static storage URL or analytics payload; a stopped/superseded version is visibly labeled.

Dependencies: DOS-M2-008
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL, DOS-M2-GATE-CATALOGUE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-009.json
- apps/doctor-suit/supabase/tests/

Acceptance
1. Render print output from one signed structured version with doctor, patient, location, date, version/status and unmodified instructions; bilingual layout must remain legible.
2. Use shared pure print presentation and UX-owned download behavior; app adapters perform current permission checks.
3. Sharing is scoped, revocable and expiry-aware with no public patient metadata, static storage URL or analytics payload; a stopped/superseded version is visibly labeled.

Verification scenarios
- Print long Arabic and English instructions and compare content to the signed source version.
- Deny expired/revoked share access and outsider object access; ensure patient names never enter public metadata.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-009.md
- apps/doctor-suit/tests/unit/dos-m2-009.test.mjs
- apps/doctor-suit/tests/e2e/dos-m2-009.spec.ts
- release-fragments/dos-m2-009.json
- apps/doctor-suit/supabase/tests/dos-m2-009.sql

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-009.test.mjs"
    ],
    "commands": [
      "dos-m2-009-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-009.spec.ts"
    ],
    "commands": [
      "dos-m2-009-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify scoped database criteria with actual disposable authorization/write assertions",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-009.sql"
    ],
    "commands": [
      "dos-m2-009-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-009-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Render print output from one signed structured version with doctor, patient, location, date, version/status and unmodified instructions; bilingual layout must remain legible.",
    "procedure": "Print long EN/AR signed instructions and compare every field/version/status to the source.",
    "test_case_name": "DOS-M2-009-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-009.spec.ts"
    ],
    "command_refs": [
      "dos-m2-009-browser"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-009-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Use shared pure print presentation and UX-owned download behavior; app adapters perform current permission checks.",
    "procedure": "Verify pure print presentation boundaries and permission-checked app adapter behavior.",
    "test_case_name": "DOS-M2-009-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-009.test.mjs"
    ],
    "command_refs": [
      "pnpm check",
      "dos-m2-009-unit"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-009-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Sharing is scoped, revocable and expiry-aware with no public patient metadata, static storage URL or analytics payload; a stopped/superseded version is visibly labeled.",
    "procedure": "Expire/revoke sharing and test outsider document access and public metadata leakage.",
    "test_case_name": "DOS-M2-009-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-009.sql",
      "apps/doctor-suit/tests/e2e/dos-m2-009.spec.ts"
    ],
    "command_refs": [
      "dos-m2-009-data",
      "dos-m2-009-browser"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-009-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-009.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-009.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-009.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-010 — Follow-up plans and order requests

Capture clinician-authored follow-up, lab/imaging and referral requests without interpreting results.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F010: Capture clinician-authored follow-up, lab/imaging and referral requests without interpreting results. Acceptance: Store clinician-authored follow-up, lab, imaging and referral requests with encounter/doctor attribution, due context and explicit lifecycle. Separate request creation, operational tracking and clinical interpretation; a result or referral never silently creates a diagnosis. Allow only authorized transitions and cancellation with history; external provider calls remain absent until M9 approval.

Dependencies: DOS-M2-009
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL, DOS-M2-GATE-CATALOGUE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-010.json

Acceptance
1. Store clinician-authored follow-up, lab, imaging and referral requests with encounter/doctor attribution, due context and explicit lifecycle.
2. Separate request creation, operational tracking and clinical interpretation; a result or referral never silently creates a diagnosis.
3. Allow only authorized transitions and cancellation with history; external provider calls remain absent until M9 approval.

Verification scenarios
- Duplicate request submission yields one request and stable acknowledgement.
- Cancel a request after an operational update and preserve both events; ungranted staff cannot edit clinical instructions.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-010.md
- apps/doctor-suit/tests/unit/dos-m2-010.test.mjs
- apps/doctor-suit/supabase/tests/dos-m2-010.sql
- apps/doctor-suit/tests/e2e/dos-m2-010.spec.ts
- release-fragments/dos-m2-010.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-010.test.mjs"
    ],
    "commands": [
      "dos-m2-010-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify database authorization, replay and write integrity with disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-010.sql"
    ],
    "commands": [
      "dos-m2-010-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-010.spec.ts"
    ],
    "commands": [
      "dos-m2-010-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-010-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Store clinician-authored follow-up, lab, imaging and referral requests with encounter/doctor attribution, due context and explicit lifecycle.",
    "procedure": "Create follow-up/order requests with exact encounter/doctor/time attribution.",
    "test_case_name": "DOS-M2-010-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-010.sql"
    ],
    "command_refs": [
      "dos-m2-010-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-010-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Separate request creation, operational tracking and clinical interpretation; a result or referral never silently creates a diagnosis.",
    "procedure": "Receive a result and verify it does not imply review, diagnosis or clinical release.",
    "test_case_name": "DOS-M2-010-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-010.sql",
      "apps/doctor-suit/tests/e2e/dos-m2-010.spec.ts"
    ],
    "command_refs": [
      "dos-m2-010-data",
      "dos-m2-010-browser"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-010-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Allow only authorized transitions and cancellation with history; external provider calls remain absent until M9 approval.",
    "procedure": "Replay/cancel requests and deny staff clinical edits; verify no external dispatch without adapter approval.",
    "test_case_name": "DOS-M2-010-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-010.sql"
    ],
    "command_refs": [
      "dos-m2-010-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-010-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-010.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-010.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-010.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-011 — Results and clinical document review

Track uploaded/requested/received/reviewed/released states and clinical attribution.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F011: Track uploaded/requested/received/reviewed/released states and clinical attribution. Acceptance: Track requested/uploaded/received/reviewed/released states with explicit actor/time and source-file provenance. Validate private document type/size and access on upload/view/download; replacements retain prior version and audit link. Only the approved clinician can mark review or release; upload success does not imply review, normality or patient visibility.

Dependencies: DOS-M2-010
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL, DOS-M2-GATE-CATALOGUE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-011.json

Acceptance
1. Track requested/uploaded/received/reviewed/released states with explicit actor/time and source-file provenance.
2. Validate private document type/size and access on upload/view/download; replacements retain prior version and audit link.
3. Only the approved clinician can mark review or release; upload success does not imply review, normality or patient visibility.

Verification scenarios
- Race document replacement with clinical review and prevent review of an unseen newer version.
- Deny cross-practice storage reads, expired access and unauthorized release; unreleased documents stay hidden from patient views.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-011.md
- apps/doctor-suit/tests/unit/dos-m2-011.test.mjs
- apps/doctor-suit/supabase/tests/dos-m2-011.sql
- apps/doctor-suit/tests/e2e/dos-m2-011.spec.ts
- release-fragments/dos-m2-011.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-011.test.mjs"
    ],
    "commands": [
      "dos-m2-011-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify database authorization, replay and write integrity with disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-011.sql"
    ],
    "commands": [
      "dos-m2-011-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-011.spec.ts"
    ],
    "commands": [
      "dos-m2-011-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-011-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Track requested/uploaded/received/reviewed/released states with explicit actor/time and source-file provenance.",
    "procedure": "Exercise each document lifecycle transition and assert source, actor and timestamps.",
    "test_case_name": "DOS-M2-011-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-011.sql"
    ],
    "command_refs": [
      "dos-m2-011-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-011-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Validate private document type/size and access on upload/view/download; replacements retain prior version and audit link.",
    "procedure": "Reject invalid files and cross-practice downloads while retaining replaced versions.",
    "test_case_name": "DOS-M2-011-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-011.sql"
    ],
    "command_refs": [
      "dos-m2-011-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-011-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Only the approved clinician can mark review or release; upload success does not imply review, normality or patient visibility.",
    "procedure": "Race replacement with review; staff upload cannot mark the new document reviewed or released.",
    "test_case_name": "DOS-M2-011-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-011.sql"
    ],
    "command_refs": [
      "dos-m2-011-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-011-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-011.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-011.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-011.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-012 — Clinical record release and patient visibility rules

Separate private working material, released patient content and caregiver access policy.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F012: Separate private working material, released patient content and caregiver access policy. Acceptance: Define per-record release decision separate from chart membership; private working notes and released patient artifacts are distinct projections. Record recipient relationship, version, release actor and revocation policy; future caregiver grants are explicit scoped relationships, not shared credentials. Backend queries expose only authorized released versions; linking a patient to two doctors does not expose either doctor chart to the other.

Dependencies: DOS-M2-011
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL, DOS-M2-GATE-CATALOGUE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-012.json

Acceptance
1. Define per-record release decision separate from chart membership; private working notes and released patient artifacts are distinct projections.
2. Record recipient relationship, version, release actor and revocation policy; future caregiver grants are explicit scoped relationships, not shared credentials.
3. Backend queries expose only authorized released versions; linking a patient to two doctors does not expose either doctor chart to the other.

Verification scenarios
- A patient with two relationships sees only independently released content while Doctor A cannot access Doctor B chart.
- Revoke a release and verify fresh requests, caches and old share links follow the approved revocation policy.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-012.md
- apps/doctor-suit/tests/unit/dos-m2-012.test.mjs
- apps/doctor-suit/supabase/tests/dos-m2-012.sql
- apps/doctor-suit/tests/e2e/dos-m2-012.spec.ts
- release-fragments/dos-m2-012.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-012.test.mjs"
    ],
    "commands": [
      "dos-m2-012-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify database authorization, replay and write integrity with disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-012.sql"
    ],
    "commands": [
      "dos-m2-012-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-012.spec.ts"
    ],
    "commands": [
      "dos-m2-012-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Only the named domain approvals and actual device/release receipts required by criterion coverage; routine checks require no human acknowledgement.",
    "phase": "pre_publication",
    "blocker": "criterion_domain_or_device_evidence_required"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-012-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Define per-record release decision separate from chart membership; private working notes and released patient artifacts are distinct projections.",
    "procedure": "Compare private-working and released projections for one encounter without changing membership.",
    "test_case_name": "DOS-M2-012-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-012.sql"
    ],
    "command_refs": [
      "dos-m2-012-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-012-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Record recipient relationship, version, release actor and revocation policy; future caregiver grants are explicit scoped relationships, not shared credentials.",
    "procedure": "Verify scoped recipient/version/revocation policy and reject implied caregiver authority.",
    "test_case_name": "DOS-M2-012-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-012.sql"
    ],
    "command_refs": [
      "dos-m2-012-data"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-012-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Backend queries expose only authorized released versions; linking a patient to two doctors does not expose either doctor chart to the other.",
    "procedure": "Patient has A/B relationships; only released versions appear and A cannot read B chart.",
    "test_case_name": "DOS-M2-012-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-012.sql"
    ],
    "command_refs": [
      "dos-m2-012-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-012-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-012.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-012.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-012.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-013 — Clinical export and amendment integrity

Export authorized complete records with version/provenance and preserve audit/retention rules.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F013: Export authorized complete records with version/provenance and preserve audit/retention rules. Acceptance: Export only the authorized doctor/practice/patient scope with encounter, signed version, amendment chain, document provenance and manifest completeness. Use stable IDs and deterministic manifest checksums so omissions and mismatched versions are detectable; export access is current and audited. Preserve retention/legal-hold policy gates and historical versions; this task creates a synthetic export, not a real-data erasure policy.

Dependencies: DOS-M2-012
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL, DOS-M2-GATE-CATALOGUE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-013.json

Acceptance
1. Export only the authorized doctor/practice/patient scope with encounter, signed version, amendment chain, document provenance and manifest completeness.
2. Use stable IDs and deterministic manifest checksums so omissions and mismatched versions are detectable; export access is current and audited.
3. Preserve retention/legal-hold policy gates and historical versions; this task creates a synthetic export, not a real-data erasure policy.

Verification scenarios
- Export a record with amended and stopped prescriptions and reconcile every referenced version and document.
- Interrupt export then retry; reject mixed-practice identifiers and detect tampered/missing manifest entries.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-013.md
- apps/doctor-suit/tests/unit/dos-m2-013.test.mjs
- apps/doctor-suit/supabase/tests/dos-m2-013.sql
- apps/doctor-suit/tests/e2e/dos-m2-013.spec.ts
- release-fragments/dos-m2-013.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-013.test.mjs"
    ],
    "commands": [
      "dos-m2-013-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify database authorization, replay and write integrity with disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-013.sql"
    ],
    "commands": [
      "dos-m2-013-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-013.spec.ts"
    ],
    "commands": [
      "dos-m2-013-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Machine-produced independent exact-candidate verification receipt for the named coverage cases; automatically evaluate existing evidence and command results. No human acknowledgement or new approval is required.",
    "phase": "pre_publication",
    "blocker": "independent_automated_verifier_receipt_required"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-013-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Export only the authorized doctor/practice/patient scope with encounter, signed version, amendment chain, document provenance and manifest completeness.",
    "procedure": "Export one authorized scope and reconcile all encounters, version chains and documents.",
    "test_case_name": "DOS-M2-013-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-013.sql"
    ],
    "command_refs": [
      "dos-m2-013-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-013-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Use stable IDs and deterministic manifest checksums so omissions and mismatched versions are detectable; export access is current and audited.",
    "procedure": "Tamper/remove a manifest entry and require checksum/completeness failure on deterministic replay.",
    "test_case_name": "DOS-M2-013-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-013.test.mjs"
    ],
    "command_refs": [
      "dos-m2-013-unit"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-013-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Preserve retention/legal-hold policy gates and historical versions; this task creates a synthetic export, not a real-data erasure policy.",
    "procedure": "Exercise synthetic export under unresolved retention policy and prove no erasure or unauthorized access.",
    "test_case_name": "DOS-M2-013-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-013.sql"
    ],
    "command_refs": [
      "dos-m2-013-data"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "independent-exact-candidate-automated-verifier"
    ],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": true,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval.",
      "automated_receipt_fields": [
        "independent verifier execution ID",
        "exact candidate SHA and base SHA",
        "case ID and evaluated input artifact hashes",
        "existing authorization/decision references where relevant",
        "executed command argv, exit codes and immutable logs or reproducible document-comparison assertions",
        "per-assertion result with failed, skipped, unavailable and unrun obligations distinguished"
      ],
      "missing_evidence_behavior": "Fail or report unavailable verification; never ask for a human acknowledgement as a substitute, invent a decision or perform a held live read."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. Independent automation must produce the specified exact-candidate receipt; human sign-off is not required for this verification."
  },
  {
    "case_id": "DOS-M2-013-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-013.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-013.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-013.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M2-014 — Clinical workflow safety acceptance

Verify synthetic end-to-end encounters/Rx/orders and obtain independent clinical review before any live use.

Requirements
- DOS-M2-R001: Clinical records and prescriptions on the web. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M2-F014: Verify synthetic end-to-end encounters/Rx/orders and obtain independent clinical review before any live use. Acceptance: Run the complete synthetic encounter→intake→note→prescription→sign/amend→print/release→result/export workflow against exact candidate code. Obtain independent qualified clinical review of entered-data fidelity, authority boundaries and failure cases; unresolved critical findings block acceptance. Record all M2 requirements and gate evidence separately from product implementation; no real-patient or prescribing launch is authorized.

Dependencies: DOS-M2-001, DOS-M2-002, DOS-M2-003, DOS-M2-004, DOS-M2-005, DOS-M2-006, DOS-M2-007, DOS-M2-008, DOS-M2-009, DOS-M2-010, DOS-M2-011, DOS-M2-012, DOS-M2-013
Blocking decisions: DOS-M2-GATE-START, DOS-M2-GATE-CLINICAL, DOS-M2-GATE-CATALOGUE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/server/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/package.json
- packages/contracts/src/
- packages/contracts/tests/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/src/utils/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m2-014.json

Acceptance
1. Run the complete synthetic encounter→intake→note→prescription→sign/amend→print/release→result/export workflow against exact candidate code.
2. Obtain independent qualified clinical review of entered-data fidelity, authority boundaries and failure cases; unresolved critical findings block acceptance.
3. Record all M2 requirements and gate evidence separately from product implementation; no real-patient or prescribing launch is authorized.

Verification scenarios
- Exercise malicious signing actor, cross-doctor access, concurrent finalization and stop/amend propagation end to end.
- Review every failed or unrun clinical/data/browser check; acceptance cannot omit an incomplete earlier M2 task.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m2-014.md
- apps/doctor-suit/tests/unit/dos-m2-014.test.mjs
- apps/doctor-suit/supabase/tests/dos-m2-014.sql
- apps/doctor-suit/tests/e2e/dos-m2-014.spec.ts
- release-fragments/dos-m2-014.json

Executable verification obligations
[
  {
    "version": 2,
    "kind": "command",
    "description": "Check diff hygiene",
    "command": "git diff --check"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check pinned workspace architecture and boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Execute task-specific state, protocol and failure assertions",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m2-014.test.mjs"
    ],
    "commands": [
      "dos-m2-014-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression for affected consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify database authorization, replay and write integrity with disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m2-014.sql"
    ],
    "commands": [
      "dos-m2-014-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify browser journey, denial and recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-014.spec.ts"
    ],
    "commands": [
      "dos-m2-014-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run milestone candidate pnpm typecheck",
    "command": "pnpm typecheck"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run milestone candidate pnpm lint",
    "command": "pnpm lint"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run milestone candidate pnpm build",
    "command": "pnpm build"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Independent exact-candidate affected shared-consumer acceptance evidence",
    "blocker": "shared_consumer_regression_receipts_required",
    "phase": "pre_publication"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate release provenance, net-change inventory and affected-consumer classification evidence",
    "commands": [
      "doctor-release-check"
    ],
    "phase": "pre_publication",
    "blocker": "release_check_receipt_must_match_candidate_head_and_reviewed_classification"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Only the named domain approvals and actual device/release receipts required by criterion coverage; routine checks require no human acknowledgement.",
    "phase": "pre_publication",
    "blocker": "criterion_domain_or_device_evidence_required"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Machine-produced independent exact-candidate verification receipt for the named coverage cases; automatically evaluate existing evidence and command results. No human acknowledgement or new approval is required.",
    "phase": "pre_publication",
    "blocker": "independent_automated_verifier_receipt_required"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.
- The user has authorized eventual implementation of M1, M2 and M3 after all nine plans are safely saved. This is not authorization to bypass genuine clinical/provider gates, retry the cancelled live-schema refresh, use real patients or activate live clinical care.
- M1–M3 completion means checked implementation in GitHub with exact-candidate verification evidence. The user handles Vercel and hosted Supabase connections; those connections or deployments are not completion requirements for the authorized synthetic implementation. Genuine domain approvals still gate dependent capabilities.
- Routine authority/document/scope/disabled-operation/status checks use independent automated exact-candidate verification, with no additional human acknowledgement. Existing approvals may be checked but not invented or replaced by automation.

Criterion-specific coverage
[
  {
    "case_id": "DOS-M2-014-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Run the complete synthetic encounter→intake→note→prescription→sign/amend→print/release→result/export workflow against exact candidate code.",
    "procedure": "Run the full synthetic encounter/Rx/order/release/export journey with malicious and concurrent variants.",
    "test_case_name": "DOS-M2-014-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m2-014.spec.ts",
      "apps/doctor-suit/supabase/tests/dos-m2-014.sql"
    ],
    "command_refs": [
      "dos-m2-014-browser",
      "dos-m2-014-data"
    ],
    "external_evidence_required": false,
    "evidence_types": [],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M2-014-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Obtain independent qualified clinical review of entered-data fidelity, authority boundaries and failure cases; unresolved critical findings block acceptance.",
    "procedure": "Independent clinician reviews fidelity and authority findings on the exact candidate.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "accountable-human-review"
    ],
    "evidence_policy": {
      "human_approval_required": true,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. The genuine domain approval requires accountable reviewer identity, scope/date, exact candidate and supporting references."
  },
  {
    "case_id": "DOS-M2-014-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Record all M2 requirements and gate evidence separately from product implementation; no real-patient or prescribing launch is authorized.",
    "procedure": "Trace M2 requirement receipts and open real-data gates; incomplete or unrun checks prevent acceptance.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [],
    "external_evidence_required": true,
    "evidence_types": [
      "independent-exact-candidate-automated-verifier"
    ],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": true,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval.",
      "automated_receipt_fields": [
        "independent verifier execution ID",
        "exact candidate SHA and base SHA",
        "case ID and evaluated input artifact hashes",
        "existing authorization/decision references where relevant",
        "executed command argv, exit codes and immutable logs or reproducible document-comparison assertions",
        "per-assertion result with failed, skipped, unavailable and unrun obligations distinguished"
      ],
      "missing_evidence_behavior": "Fail or report unavailable verification; never ask for a human acknowledgement as a substitute, invent a decision or perform a held live read."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute. Independent automation must produce the specified exact-candidate receipt; human sign-off is not required for this verification."
  },
  {
    "case_id": "DOS-M2-014-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m2-014.json"
    ],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "acceptance_rule": "Preserve unrelated inventory and all accepted fragments; do not activate an operational product."
  }
]

Release ownership
{
  "fragment_path": "release-fragments/dos-m2-014.json",
  "accepted_fragments": "append-only; never rewrite accepted provenance",
  "inventory_path": "release-changes/items.json",
  "inventory_write_scope": "Only append or refine entries documenting this task's surviving public behavior, with this task fragment in sources and distinctive current-code probes. Existing related items may gain this source/probe only; preserve unrelated IDs, copy, probes, sources and all accepted history. Resolve affected consumers through the actual dependency graph.",
  "registration_rule": "Only already-verified active operational Suits with explicit baselines may receive public inventory. Do not activate Doctor or invent a baseline. Keep Doctor-only synthetic preview provenance internal until separate release registration; do not hide visible changes to existing consumers as internal.",
  "receipt_rule": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results."
}

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m2-014.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
