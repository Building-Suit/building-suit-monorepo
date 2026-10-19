# DOS-M7 — Production safety, compliance and launch acceptance

10 tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `DOS-M7.json` and `DOS-M7.import-proposal.json`.

Milestone prerequisites: DOS-M1, DOS-M2, DOS-M3, DOS-M6. Every task also has an open blocking start decision.

## DOS-M7-001 — Controller/processor and legal-policy review

Obtain current Egypt-specific professional legal/healthcare review of data responsibilities, consent and obligations.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F001: Obtain current Egypt-specific professional legal/healthcare review of data responsibilities, consent and obligations. Acceptance: Obtain current qualified Egypt legal/healthcare review identifying controller/processor roles, purposes, consent basis, professional obligations and any applicable registration requirements. Record reviewer identity, date, exact product/data-flow scope, authoritative references and unresolved questions; generated prose is not legal approval. Produce approved policy requirements and owner actions for privacy, minors/caregivers, access and complaints without claiming certification. Prepare evidence for DOS-M7-GATE-LEGAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M1-020, DOS-M2-014, DOS-M3-010, DOS-M6-010
Blocking decisions: DOS-M7-GATE-START

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/dos-m7-001.json

Acceptance
1. Obtain current qualified Egypt legal/healthcare review identifying controller/processor roles, purposes, consent basis, professional obligations and any applicable registration requirements.
2. Record reviewer identity, date, exact product/data-flow scope, authoritative references and unresolved questions; generated prose is not legal approval.
3. Produce approved policy requirements and owner actions for privacy, minors/caregivers, access and complaints without claiming certification.
4. Prepare evidence for DOS-M7-GATE-LEGAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Review doctor, practice staff, patient, caregiver and each external processor responsibility separately.
- A stale/unsigned opinion or changed data flow keeps the corresponding legal gate OPEN.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-001.md
- release-fragments/dos-m7-001.json

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
    "case_id": "DOS-M7-001-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Obtain current qualified Egypt legal/healthcare review identifying controller/processor roles, purposes, consent basis, professional obligations and any applicable registration requirements.",
    "procedure": "Qualified reviewer identifies current controller/processor and professional duties.",
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
    "case_id": "DOS-M7-001-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Record reviewer identity, date, exact product/data-flow scope, authoritative references and unresolved questions; generated prose is not legal approval.",
    "procedure": "Check the existing legal-review receipt for reviewer/date/source/data-flow scope and validity under its recorded review terms; reject unsigned, superseded or scope-mismatched evidence without supplying legal approval.",
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
    "case_id": "DOS-M7-001-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Produce approved policy requirements and owner actions for privacy, minors/caregivers, access and complaints without claiming certification.",
    "procedure": "Review approved policies and unresolved actions without certification claims.",
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
    "case_id": "DOS-M7-001-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Prepare evidence for DOS-M7-GATE-LEGAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.",
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
    "case_id": "DOS-M7-001-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-001.json"
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
  "fragment_path": "release-fragments/dos-m7-001.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-001.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M7-002 — Hosting, data-flow and transfer approval

Approve providers, regions, data transfers and subprocessors before provisioning or real-patient processing.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F002: Approve providers, regions, data transfers and subprocessors before provisioning or real-patient processing. Acceptance: Inventory proposed providers, regions, data categories, subprocessors and international transfers, with verified contracts and accountable approval. Map browser/mobile/backend/storage/notifications/logging/backups and any support access; minimize payloads and separate product environments. Approve or reject the exact hosting design before provisioning or live data; no provider purchase, region assertion or production mapping is fabricated. Prepare evidence for DOS-M7-GATE-HOSTING. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M7-001
Blocking decisions: DOS-M7-GATE-START, DOS-M7-GATE-LEGAL

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/dos-m7-002.json

Acceptance
1. Inventory proposed providers, regions, data categories, subprocessors and international transfers, with verified contracts and accountable approval.
2. Map browser/mobile/backend/storage/notifications/logging/backups and any support access; minimize payloads and separate product environments.
3. Approve or reject the exact hosting design before provisioning or live data; no provider purchase, region assertion or production mapping is fabricated.
4. Prepare evidence for DOS-M7-GATE-HOSTING. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Trace a synthetic patient document and reminder through every proposed processor and log destination.
- An unapproved subprocessor, unknown region or unexpected analytics payload blocks hosting approval.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-002.md
- release-fragments/dos-m7-002.json

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
    "case_id": "DOS-M7-002-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Inventory proposed providers, regions, data categories, subprocessors and international transfers, with verified contracts and accountable approval.",
    "procedure": "Inspect actual provider/region/subprocessor contracts and approvals.",
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
    "case_id": "DOS-M7-002-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Map browser/mobile/backend/storage/notifications/logging/backups and any support access; minimize payloads and separate product environments.",
    "procedure": "Trace document/reminder/log/backup flows including support access.",
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
    "case_id": "DOS-M7-002-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Approve or reject the exact hosting design before provisioning or live data; no provider purchase, region assertion or production mapping is fabricated.",
    "procedure": "Reject unknown regions/processors and retain live-data provisioning hold.",
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
    "case_id": "DOS-M7-002-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Prepare evidence for DOS-M7-GATE-HOSTING. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.",
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
    "case_id": "DOS-M7-002-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-002.json"
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
  "fragment_path": "release-fragments/dos-m7-002.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-002.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M7-003 — Clinical governance and real-patient entry gate

Document accountable clinical review, prescribing limits, emergency disclaimers and permitted pilot use.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F003: Document accountable clinical review, prescribing limits, emergency disclaimers and permitted pilot use. Acceptance: Identify accountable clinical governance, permitted prescribing/delegation scope, change review and emergency/escalation wording for this product. Define a separately authorized pilot population, consent, supervision, stop criteria and incident response; real-patient entry requires explicit owner and qualified reviewer authorization. Keep synthetic-only default and clinical functionality restrictions until evidence is accepted; no automatic diagnosis/prescribing or clinical efficacy claim. Prepare evidence for DOS-M7-GATE-REAL-DATA. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M7-002
Blocking decisions: DOS-M7-GATE-START, DOS-M7-GATE-LEGAL, DOS-M7-GATE-HOSTING

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/dos-m7-003.json

Acceptance
1. Identify accountable clinical governance, permitted prescribing/delegation scope, change review and emergency/escalation wording for this product.
2. Define a separately authorized pilot population, consent, supervision, stop criteria and incident response; real-patient entry requires explicit owner and qualified reviewer authorization.
3. Keep synthetic-only default and clinical functionality restrictions until evidence is accepted; no automatic diagnosis/prescribing or clinical efficacy claim.
4. Prepare evidence for DOS-M7-GATE-REAL-DATA. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Review medication error, patient-identity dispute, revoked clinician authority and missed-reminder escalation scenarios.
- Attempt to treat earlier synthetic demo acceptance as live-data approval and reject it.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-003.md
- release-fragments/dos-m7-003.json

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
    "case_id": "DOS-M7-003-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Identify accountable clinical governance, permitted prescribing/delegation scope, change review and emergency/escalation wording for this product.",
    "procedure": "Verify accountable clinical reviewer and permitted prescribing/delegation scope.",
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
    "case_id": "DOS-M7-003-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Define a separately authorized pilot population, consent, supervision, stop criteria and incident response; real-patient entry requires explicit owner and qualified reviewer authorization.",
    "procedure": "Review explicit pilot consent/supervision/stop and incident authorization.",
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
    "case_id": "DOS-M7-003-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Keep synthetic-only default and clinical functionality restrictions until evidence is accepted; no automatic diagnosis/prescribing or clinical efficacy claim.",
    "procedure": "Compare synthetic-only defaults and clinical restrictions to approved authority records; reject synthetic demo evidence as authorization for real care or efficacy claims.",
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
    "case_id": "DOS-M7-003-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Prepare evidence for DOS-M7-GATE-REAL-DATA. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.",
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
    "case_id": "DOS-M7-003-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-003.json"
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
  "fragment_path": "release-fragments/dos-m7-003.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-003.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M7-004 — Retention, access and privacy-rights operations

Implement approved record retention, access/correction/export/erasure handling with legal-hold conflicts resolved.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F004: Implement approved record retention, access/correction/export/erasure handling with legal-hold conflicts resolved. Acceptance: Implement approved retention/access/correction/export/erasure request workflows with identity verification, scope, case history and accountable decisions. Resolve legal holds, immutable signed records and financial retention conflicts through policy; do not guess retention durations or bulk hard-delete charts. Prove scoped execution and audit of approved outcomes on synthetic data with human review of refused/partial requests.

Dependencies: DOS-M7-003
Blocking decisions: DOS-M7-GATE-START, DOS-M7-GATE-LEGAL, DOS-M7-GATE-HOSTING, DOS-M7-GATE-REAL-DATA

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
- release-fragments/dos-m7-004.json

Acceptance
1. Implement approved retention/access/correction/export/erasure request workflows with identity verification, scope, case history and accountable decisions.
2. Resolve legal holds, immutable signed records and financial retention conflicts through policy; do not guess retention durations or bulk hard-delete charts.
3. Prove scoped execution and audit of approved outcomes on synthetic data with human review of refused/partial requests.

Verification scenarios
- Request erasure of a synthetic record under legal hold and preserve required data with documented reason.
- Attempt rights requests using shared contact details or cross-doctor IDs; reject unauthorized disclosure and destructive action.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-004.md
- apps/doctor-suit/tests/unit/dos-m7-004.test.mjs
- apps/doctor-suit/supabase/tests/dos-m7-004.sql
- apps/doctor-suit/tests/e2e/dos-m7-004.spec.ts
- release-fragments/dos-m7-004.json

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
      "apps/doctor-suit/tests/unit/dos-m7-004.test.mjs"
    ],
    "commands": [
      "dos-m7-004-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m7-004.sql"
    ],
    "commands": [
      "dos-m7-004-data"
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
      "apps/doctor-suit/tests/e2e/dos-m7-004.spec.ts"
    ],
    "commands": [
      "dos-m7-004-browser"
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
    "case_id": "DOS-M7-004-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Implement approved retention/access/correction/export/erasure request workflows with identity verification, scope, case history and accountable decisions.",
    "procedure": "Process a scoped rights case under reviewed identity/policy rules.",
    "test_case_name": "DOS-M7-004-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m7-004.sql"
    ],
    "command_refs": [
      "dos-m7-004-data"
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
    "case_id": "DOS-M7-004-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Resolve legal holds, immutable signed records and financial retention conflicts through policy; do not guess retention durations or bulk hard-delete charts.",
    "procedure": "Review legal-hold/retention conflicts without inventing deletion periods.",
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
    "case_id": "DOS-M7-004-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Prove scoped execution and audit of approved outcomes on synthetic data with human review of refused/partial requests.",
    "procedure": "Reject shared-contact impersonation and prove auditable synthetic refusal/partial handling.",
    "test_case_name": "DOS-M7-004-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m7-004.sql"
    ],
    "command_refs": [
      "dos-m7-004-data"
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
    "case_id": "DOS-M7-004-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-004.json"
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
  "fragment_path": "release-fragments/dos-m7-004.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-004.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M7-005 — Security assessment and remediation

Independently assess tenancy, auth, storage, audit, mobile caches and abuse protections with tracked findings.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F005: Independently assess tenancy, auth, storage, audit, mobile caches and abuse protections with tracked findings. Acceptance: Obtain independent security assessment of tenant/doctor/location boundaries, Auth/recovery, Storage/Realtime, privileged routines, APIs, audit and supported mobile caches. Track findings with reproducible synthetic evidence, severity, owner, remediation and exact-candidate retest; no self-issued security certification. No unresolved critical/high launch-blocking findings may be waived by a developer; accepted residual risks require the accountable reviewer.

Dependencies: DOS-M7-004
Blocking decisions: DOS-M7-GATE-START, DOS-M7-GATE-LEGAL, DOS-M7-GATE-HOSTING, DOS-M7-GATE-REAL-DATA

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
- release-fragments/dos-m7-005.json

Acceptance
1. Obtain independent security assessment of tenant/doctor/location boundaries, Auth/recovery, Storage/Realtime, privileged routines, APIs, audit and supported mobile caches.
2. Track findings with reproducible synthetic evidence, severity, owner, remediation and exact-candidate retest; no self-issued security certification.
3. No unresolved critical/high launch-blocking findings may be waived by a developer; accepted residual risks require the accountable reviewer.

Verification scenarios
- Attempt outsider, shared-secretary escalation, stale revocation, signed-URL abuse, mass assignment and exported-data leakage.
- Retest each fixed finding plus affected consumers; unavailable mobile surfaces are explicitly excluded from a web-only assessment.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-005.md
- apps/doctor-suit/tests/unit/dos-m7-005.test.mjs
- apps/doctor-suit/supabase/tests/dos-m7-005.sql
- apps/doctor-suit/tests/e2e/dos-m7-005.spec.ts
- release-fragments/dos-m7-005.json

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
      "apps/doctor-suit/tests/unit/dos-m7-005.test.mjs"
    ],
    "commands": [
      "dos-m7-005-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m7-005.sql"
    ],
    "commands": [
      "dos-m7-005-data"
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
      "apps/doctor-suit/tests/e2e/dos-m7-005.spec.ts"
    ],
    "commands": [
      "dos-m7-005-browser"
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
    "case_id": "DOS-M7-005-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Obtain independent security assessment of tenant/doctor/location boundaries, Auth/recovery, Storage/Realtime, privileged routines, APIs, audit and supported mobile caches.",
    "procedure": "Independent assessor executes the specified tenant/auth/storage/mobile attack surface.",
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
    "case_id": "DOS-M7-005-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Track findings with reproducible synthetic evidence, severity, owner, remediation and exact-candidate retest; no self-issued security certification.",
    "procedure": "Match every finding/remediation/retest to exact candidate evidence.",
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
    "case_id": "DOS-M7-005-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "No unresolved critical/high launch-blocking findings may be waived by a developer; accepted residual risks require the accountable reviewer.",
    "procedure": "Accountable reviewer handles residual risks; developers cannot waive launch blockers.",
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
    "case_id": "DOS-M7-005-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-005.json"
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
  "fragment_path": "release-fragments/dos-m7-005.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-005.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M7-006 — Backup, restore and disaster recovery proof

Demonstrate approved recovery objectives with scoped restore tests and protection against data loss.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F006: Demonstrate approved recovery objectives with scoped restore tests and protection against data loss. Acceptance: Approve recovery point/time objectives and backup custody before testing; document encrypted backup scope, retention and restore permissions. Restore a disposable synthetic backup into an isolated target and reconcile records, signed versions, documents, audit and financial entries. Record measured recovery duration and data-loss window against approved objectives, with failure recovery and no overwrite of hosted business data.

Dependencies: DOS-M7-005
Blocking decisions: DOS-M7-GATE-START, DOS-M7-GATE-LEGAL, DOS-M7-GATE-HOSTING, DOS-M7-GATE-REAL-DATA

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
- release-fragments/dos-m7-006.json

Acceptance
1. Approve recovery point/time objectives and backup custody before testing; document encrypted backup scope, retention and restore permissions.
2. Restore a disposable synthetic backup into an isolated target and reconcile records, signed versions, documents, audit and financial entries.
3. Record measured recovery duration and data-loss window against approved objectives, with failure recovery and no overwrite of hosted business data.

Verification scenarios
- Simulate missing document, corrupted backup and restore interruption; fail integrity checks rather than claim partial success.
- Prove the restored target remains isolated and cannot dispatch messages or payments.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-006.md
- apps/doctor-suit/tests/unit/dos-m7-006.test.mjs
- apps/doctor-suit/supabase/tests/dos-m7-006.sql
- apps/doctor-suit/tests/e2e/dos-m7-006.spec.ts
- release-fragments/dos-m7-006.json

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
      "apps/doctor-suit/tests/unit/dos-m7-006.test.mjs"
    ],
    "commands": [
      "dos-m7-006-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m7-006.sql"
    ],
    "commands": [
      "dos-m7-006-data"
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
      "apps/doctor-suit/tests/e2e/dos-m7-006.spec.ts"
    ],
    "commands": [
      "dos-m7-006-browser"
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
    "case_id": "DOS-M7-006-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Approve recovery point/time objectives and backup custody before testing; document encrypted backup scope, retention and restore permissions.",
    "procedure": "Approve recovery objectives, backup custody and restore permissions.",
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
    "case_id": "DOS-M7-006-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Restore a disposable synthetic backup into an isolated target and reconcile records, signed versions, documents, audit and financial entries.",
    "procedure": "Restore isolated synthetic data and reconcile signed versions/documents/financial entries.",
    "test_case_name": "DOS-M7-006-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m7-006.sql"
    ],
    "command_refs": [
      "dos-m7-006-data"
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
    "case_id": "DOS-M7-006-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Record measured recovery duration and data-loss window against approved objectives, with failure recovery and no overwrite of hosted business data.",
    "procedure": "Measure recovery against approved targets and fail corrupt/partial restoration.",
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
    "case_id": "DOS-M7-006-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-006.json"
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
  "fragment_path": "release-fragments/dos-m7-006.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-006.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M7-007 — Observability, incident and breach response

Prepare monitored failures, notification health and tested incident escalation without exposing patient payloads.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F007: Prepare monitored failures, notification health and tested incident escalation without exposing patient payloads. Acceptance: Define redacted operational signals for authorization failures, outbox/reminder delivery, payment reconciliation, storage and recovery without patient payload logging. Prepare incident ownership, escalation, communication approval, evidence preservation and legally reviewed breach response obligations. Exercise synthetic incident detection/triage/containment/recovery and record alert delivery evidence without sending external incident messages.

Dependencies: DOS-M7-006
Blocking decisions: DOS-M7-GATE-START, DOS-M7-GATE-LEGAL, DOS-M7-GATE-HOSTING, DOS-M7-GATE-REAL-DATA

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
- release-fragments/dos-m7-007.json

Acceptance
1. Define redacted operational signals for authorization failures, outbox/reminder delivery, payment reconciliation, storage and recovery without patient payload logging.
2. Prepare incident ownership, escalation, communication approval, evidence preservation and legally reviewed breach response obligations.
3. Exercise synthetic incident detection/triage/containment/recovery and record alert delivery evidence without sending external incident messages.

Verification scenarios
- Inject a delivery outage and authorization anomaly and trace detection through simulated escalation.
- Inspect logs/traces/alerts for tokens, patient names, medicine instructions and unapproved recipients.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-007.md
- apps/doctor-suit/tests/unit/dos-m7-007.test.mjs
- apps/doctor-suit/supabase/tests/dos-m7-007.sql
- apps/doctor-suit/tests/e2e/dos-m7-007.spec.ts
- release-fragments/dos-m7-007.json

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
      "apps/doctor-suit/tests/unit/dos-m7-007.test.mjs"
    ],
    "commands": [
      "dos-m7-007-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m7-007.sql"
    ],
    "commands": [
      "dos-m7-007-data"
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
      "apps/doctor-suit/tests/e2e/dos-m7-007.spec.ts"
    ],
    "commands": [
      "dos-m7-007-browser"
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
    "case_id": "DOS-M7-007-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Define redacted operational signals for authorization failures, outbox/reminder delivery, payment reconciliation, storage and recovery without patient payload logging.",
    "procedure": "Inject operational faults and inspect redacted signals for private payloads.",
    "test_case_name": "DOS-M7-007-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m7-007.test.mjs",
      "apps/doctor-suit/supabase/tests/dos-m7-007.sql"
    ],
    "command_refs": [
      "dos-m7-007-unit",
      "dos-m7-007-data"
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
    "case_id": "DOS-M7-007-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Prepare incident ownership, escalation, communication approval, evidence preservation and legally reviewed breach response obligations.",
    "procedure": "Review incident ownership, escalation and legally approved notification obligations.",
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
    "case_id": "DOS-M7-007-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Exercise synthetic incident detection/triage/containment/recovery and record alert delivery evidence without sending external incident messages.",
    "procedure": "Trace synthetic detection through containment/recovery without actual external incident messages.",
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
    "case_id": "DOS-M7-007-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-007.json"
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
  "fragment_path": "release-fragments/dos-m7-007.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-007.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M7-008 — Performance and operational readiness

Verify representative load, user support, service limits, provider costs and production configuration.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F008: Verify representative load, user support, service limits, provider costs and production configuration. Acceptance: Define representative synthetic workloads and approved latency/error/resource acceptance thresholds before load testing; do not invent production capacity claims. Measure the exact candidate and document service quotas, provider cost evidence, support ownership and runbooks. Identify unsupported devices/surfaces, operational limits and rollback dependencies; no provider upgrade or production load test is implied.

Dependencies: DOS-M7-007
Blocking decisions: DOS-M7-GATE-START, DOS-M7-GATE-LEGAL, DOS-M7-GATE-HOSTING, DOS-M7-GATE-REAL-DATA

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
- release-fragments/dos-m7-008.json

Acceptance
1. Define representative synthetic workloads and approved latency/error/resource acceptance thresholds before load testing; do not invent production capacity claims.
2. Measure the exact candidate and document service quotas, provider cost evidence, support ownership and runbooks.
3. Identify unsupported devices/surfaces, operational limits and rollback dependencies; no provider upgrade or production load test is implied.

Verification scenarios
- Test concurrent appointments, chart access, document operations and outbox backlog at approved load.
- Fail readiness when thresholds, verified provider limits or support ownership are absent; report measured results separately from targets.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-008.md
- apps/doctor-suit/tests/unit/dos-m7-008.test.mjs
- apps/doctor-suit/supabase/tests/dos-m7-008.sql
- apps/doctor-suit/tests/e2e/dos-m7-008.spec.ts
- release-fragments/dos-m7-008.json

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
      "apps/doctor-suit/tests/unit/dos-m7-008.test.mjs"
    ],
    "commands": [
      "dos-m7-008-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m7-008.sql"
    ],
    "commands": [
      "dos-m7-008-data"
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
      "apps/doctor-suit/tests/e2e/dos-m7-008.spec.ts"
    ],
    "commands": [
      "dos-m7-008-browser"
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
    "case_id": "DOS-M7-008-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Define representative synthetic workloads and approved latency/error/resource acceptance thresholds before load testing; do not invent production capacity claims.",
    "procedure": "Approve workload/latency/error thresholds before measurements.",
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
    "case_id": "DOS-M7-008-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Measure the exact candidate and document service quotas, provider cost evidence, support ownership and runbooks.",
    "procedure": "Bind measured load/resource results and actual limits to the candidate.",
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
    "case_id": "DOS-M7-008-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Identify unsupported devices/surfaces, operational limits and rollback dependencies; no provider upgrade or production load test is implied.",
    "procedure": "Compare support/rollback dependencies, operational limits and excluded surfaces to actual receipts; verify no production-capacity claim, provider upgrade or production load test is inferred.",
    "test_case_name": "DOS-M7-008-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m7-008.test.mjs"
    ],
    "command_refs": [
      "dos-m7-008-unit"
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
    "case_id": "DOS-M7-008-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-008.json"
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
  "fragment_path": "release-fragments/dos-m7-008.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-008.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M7-009 — Supervised pilot and clinical/user acceptance

Run a separately authorized limited pilot, track consent and defects, and obtain independent domain approval.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F009: Run a separately authorized limited pilot, track consent and defects, and obtain independent domain approval. Acceptance: Prepare a limited supervised pilot protocol with approved population/consent, responsible clinician, support, monitoring, stop criteria and defect process. A real pilot may run only under separate explicit authorization satisfying M7 legal/hosting/real-data/security/recovery prerequisites; this task currently prepares the packet and stays blocked for live execution. Record independent clinical/user acceptance and adverse-event/defect review tied to the exact candidate, retaining unresolved issues rather than fabricating participants or results.

Dependencies: DOS-M7-008
Blocking decisions: DOS-M7-GATE-START, DOS-M7-GATE-LEGAL, DOS-M7-GATE-HOSTING, DOS-M7-GATE-REAL-DATA

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/dos-m7-009.json

Acceptance
1. Prepare a limited supervised pilot protocol with approved population/consent, responsible clinician, support, monitoring, stop criteria and defect process.
2. A real pilot may run only under separate explicit authorization satisfying M7 legal/hosting/real-data/security/recovery prerequisites; this task currently prepares the packet and stays blocked for live execution.
3. Record independent clinical/user acceptance and adverse-event/defect review tied to the exact candidate, retaining unresolved issues rather than fabricating participants or results.

Verification scenarios
- Dry-run enrollment, consent withdrawal, incident stop and data access on synthetic participants.
- Missing real-data approval or qualified supervisor prevents enrolling any real patient.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-009.md
- release-fragments/dos-m7-009.json

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
    "case_id": "DOS-M7-009-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Prepare a limited supervised pilot protocol with approved population/consent, responsible clinician, support, monitoring, stop criteria and defect process.",
    "procedure": "Approve supervised pilot protocol, consent and stop criteria.",
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
    "case_id": "DOS-M7-009-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "A real pilot may run only under separate explicit authorization satisfying M7 legal/hosting/real-data/security/recovery prerequisites; this task currently prepares the packet and stays blocked for live execution.",
    "procedure": "Verify the enrollment prerequisite matrix requires existing legal, hosting, real-data, security and recovery evidence plus separate explicit authorization; reject a synthetic dry run as permission.",
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
    "case_id": "DOS-M7-009-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Record independent clinical/user acceptance and adverse-event/defect review tied to the exact candidate, retaining unresolved issues rather than fabricating participants or results.",
    "procedure": "Verify independent review and honest defect/participant records.",
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
    "case_id": "DOS-M7-009-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-009.json"
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
  "fragment_path": "release-fragments/dos-m7-009.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-009.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M7-010 — Production go/no-go and release evidence

Complete exact candidate evidence and owner authorization; publication, merge and deployment remain separate actions.

Requirements
- DOS-M7-R001: Production safety, compliance and launch acceptance. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M7-F010: Complete exact candidate evidence and owner authorization; publication, merge and deployment remain separate actions. Acceptance: Assemble exact candidate/release scope, complete requirement evidence, independent approvals, unresolved risks, rollback/recovery and owner go/no-go record. Web-only release requires M1/M2/M3/M6/M7; doctor mobile additionally requires M4 and patient mobile additionally requires M5. Unselected/unfinished surfaces cannot be advertised as released. Keep merge, hosted migration, deployment and production activation as separate authorized actions; this task produces a reviewed release decision packet, not deployment. Prepare evidence for DOS-M7-GATE-RELEASE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M7-001, DOS-M7-002, DOS-M7-003, DOS-M7-004, DOS-M7-005, DOS-M7-006, DOS-M7-007, DOS-M7-008, DOS-M7-009
Blocking decisions: DOS-M7-GATE-START, DOS-M7-GATE-LEGAL, DOS-M7-GATE-HOSTING, DOS-M7-GATE-REAL-DATA, DOS-M1-D005

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/dos-m7-010.json

Acceptance
1. Assemble exact candidate/release scope, complete requirement evidence, independent approvals, unresolved risks, rollback/recovery and owner go/no-go record.
2. Web-only release requires M1/M2/M3/M6/M7; doctor mobile additionally requires M4 and patient mobile additionally requires M5. Unselected/unfinished surfaces cannot be advertised as released.
3. Keep merge, hosted migration, deployment and production activation as separate authorized actions; this task produces a reviewed release decision packet, not deployment.
4. Prepare evidence for DOS-M7-GATE-RELEASE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Attempt full-product readiness while mobile evidence is missing and restrict the scope or block the decision.
- Any changed candidate SHA, open mandatory gate or failed acceptance invalidates prior go/no-go evidence.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m7-010.md
- release-fragments/dos-m7-010.json

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
    "case_id": "DOS-M7-010-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Assemble exact candidate/release scope, complete requirement evidence, independent approvals, unresolved risks, rollback/recovery and owner go/no-go record.",
    "procedure": "Review exact scope/SHA, approvals, risks and rollback evidence.",
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
    "case_id": "DOS-M7-010-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Web-only release requires M1/M2/M3/M6/M7; doctor mobile additionally requires M4 and patient mobile additionally requires M5. Unselected/unfinished surfaces cannot be advertised as released.",
    "procedure": "Check web prerequisites and add M4/M5 receipts only for claimed mobile surfaces.",
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
    "case_id": "DOS-M7-010-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Keep merge, hosted migration, deployment and production activation as separate authorized actions; this task produces a reviewed release decision packet, not deployment.",
    "procedure": "Compare the release-decision packet and operation ledger; verify go/no-go evidence does not imply authority or completed merge, migration, deployment or activation.",
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
    "case_id": "DOS-M7-010-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Prepare evidence for DOS-M7-GATE-RELEASE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.",
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
    "case_id": "DOS-M7-010-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m7-010.json"
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
  "fragment_path": "release-fragments/dos-m7-010.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m7-010.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
