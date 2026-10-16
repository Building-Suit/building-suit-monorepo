# DOS-M8 — Business Suit ecosystem integration

8 tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `DOS-M8.json` and `DOS-M8.import-proposal.json`.

Milestone prerequisites: DOS-M6, DOS-M7. Every task also has an open blocking start decision.

## DOS-M8-001 — Ecosystem domain and sharing contract

Confirm what Business Suit means and each existing Suit owner; preserve clinical boundaries and capability-based integration.

Requirements
- DOS-M8-R001: Business Suit ecosystem integration. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M8-F001: Confirm what Business Suit means and each existing Suit owner; preserve clinical boundaries and capability-based integration. Acceptance: Resolve what Business Suit means using named existing product owners and verified capability/version contracts; do not create a fictional shared platform. Approve purpose-specific minimum data/event fields, authentication, revocation and reconciliation responsibilities per integration. Preserve independent product Auth, clinical chart boundaries and data ownership; no shared patient tables, contact-based account linking or cross-product SSO. Prepare evidence for DOS-M8-GATE-ECOSYSTEM. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M6-010, DOS-M7-010
Blocking decisions: DOS-M8-GATE-START

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/dos-m8-001.json

Acceptance
1. Resolve what Business Suit means using named existing product owners and verified capability/version contracts; do not create a fictional shared platform.
2. Approve purpose-specific minimum data/event fields, authentication, revocation and reconciliation responsibilities per integration.
3. Preserve independent product Auth, clinical chart boundaries and data ownership; no shared patient tables, contact-based account linking or cross-product SSO.
4. Prepare evidence for DOS-M8-GATE-ECOSYSTEM. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Review financial, stock, employee and notification data needs against actual owning-Suit capability contracts.
- Missing owner agreement or unsupported capability disables that connector without widening data disclosure.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m8-001.md
- release-fragments/dos-m8-001.json

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
    "case_id": "DOS-M8-001-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Resolve what Business Suit means using named existing product owners and verified capability/version contracts; do not create a fictional shared platform.",
    "procedure": "Confirm named Business Suit owners and actual versioned capabilities.",
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
    "case_id": "DOS-M8-001-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Approve purpose-specific minimum data/event fields, authentication, revocation and reconciliation responsibilities per integration.",
    "procedure": "Approve minimum data purposes and reconciliation responsibility per receiver.",
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
    "case_id": "DOS-M8-001-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Preserve independent product Auth, clinical chart boundaries and data ownership; no shared patient tables, contact-based account linking or cross-product SSO.",
    "procedure": "Compare partner contracts and documented ownership to the established independent Auth/chart boundaries; reject shared sessions/tables and contact-based identity linking.",
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
    "case_id": "DOS-M8-001-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Prepare evidence for DOS-M8-GATE-ECOSYSTEM. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.",
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
    "case_id": "DOS-M8-001-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m8-001.json"
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
  "fragment_path": "release-fragments/dos-m8-001.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m8-001.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M8-002 — Versioned events and durable outbox/inbox

Implement authenticated event contracts, idempotency, replay and failure handling without shared clinical tables.

Requirements
- DOS-M8-R001: Business Suit ecosystem integration. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M8-F002: Implement authenticated event contracts, idempotency, replay and failure handling without shared clinical tables. Acceptance: Define versioned event envelopes with tenant/product provenance, stable event/idempotency IDs, minimal payload and authenticated sender/audience. Implement transactional outbox and receiver inbox deduplication with bounded retry, dead-letter/reconciliation and ordered/version-aware handling where required. Enforce per-integration capability and revocation on dispatch/receive; independent services never bypass product authorization through events.

Dependencies: DOS-M8-001
Blocking decisions: DOS-M8-GATE-START, DOS-M8-GATE-ECOSYSTEM

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
- release-fragments/dos-m8-002.json

Acceptance
1. Define versioned event envelopes with tenant/product provenance, stable event/idempotency IDs, minimal payload and authenticated sender/audience.
2. Implement transactional outbox and receiver inbox deduplication with bounded retry, dead-letter/reconciliation and ordered/version-aware handling where required.
3. Enforce per-integration capability and revocation on dispatch/receive; independent services never bypass product authorization through events.

Verification scenarios
- Crash before/after publish/acknowledgement, replay an event and deliver out of order without duplicate business effects.
- Reject wrong audience, revoked sender, unsupported version and a payload containing disallowed clinical fields.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m8-002.md
- apps/doctor-suit/tests/unit/dos-m8-002.test.mjs
- apps/doctor-suit/supabase/tests/dos-m8-002.sql
- apps/doctor-suit/tests/e2e/dos-m8-002.spec.ts
- release-fragments/dos-m8-002.json

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
      "apps/doctor-suit/tests/unit/dos-m8-002.test.mjs"
    ],
    "commands": [
      "dos-m8-002-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m8-002.sql"
    ],
    "commands": [
      "dos-m8-002-data"
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
      "apps/doctor-suit/tests/e2e/dos-m8-002.spec.ts"
    ],
    "commands": [
      "dos-m8-002-browser"
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
    "case_id": "DOS-M8-002-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Define versioned event envelopes with tenant/product provenance, stable event/idempotency IDs, minimal payload and authenticated sender/audience.",
    "procedure": "Validate sender/audience/version and reject disallowed clinical fields.",
    "test_case_name": "DOS-M8-002-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m8-002.test.mjs",
      "apps/doctor-suit/supabase/tests/dos-m8-002.sql"
    ],
    "command_refs": [
      "dos-m8-002-unit",
      "dos-m8-002-data"
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
    "case_id": "DOS-M8-002-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Implement transactional outbox and receiver inbox deduplication with bounded retry, dead-letter/reconciliation and ordered/version-aware handling where required.",
    "procedure": "Crash/replay/out-of-order events and verify one receiver business effect.",
    "test_case_name": "DOS-M8-002-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-002.sql"
    ],
    "command_refs": [
      "dos-m8-002-data"
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
    "case_id": "DOS-M8-002-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Enforce per-integration capability and revocation on dispatch/receive; independent services never bypass product authorization through events.",
    "procedure": "Revoke an integration and reject subsequent dispatch/receive authorization.",
    "test_case_name": "DOS-M8-002-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-002.sql"
    ],
    "command_refs": [
      "dos-m8-002-data"
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
    "case_id": "DOS-M8-002-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m8-002.json"
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
  "fragment_path": "release-fragments/dos-m8-002.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m8-002.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M8-003 — Accounting/Ledger integration

Export minimized financial facts with reconciliation; exclude diagnoses, prescriptions and clinical notes by default.

Requirements
- DOS-M8-R001: Business Suit ecosystem integration. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M8-F003: Export minimized financial facts with reconciliation; exclude diagnoses, prescriptions and clinical notes by default. Acceptance: Verify the actual Ledger ingestion contract and approve financial field mapping, currencies, source IDs and reconciliation responsibility. Export minimized approved financial facts only; diagnoses, prescriptions, patient notes and unnecessary identifiers are excluded by default. Use authenticated versioned idempotent exchange with explicit pending/rejected/reconciled state; no direct writes into Ledger tables or reuse of its sessions/secrets.

Dependencies: DOS-M6-009, DOS-M8-002
Blocking decisions: DOS-M8-GATE-START, DOS-M8-GATE-ECOSYSTEM

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
- release-fragments/dos-m8-003.json

Acceptance
1. Verify the actual Ledger ingestion contract and approve financial field mapping, currencies, source IDs and reconciliation responsibility.
2. Export minimized approved financial facts only; diagnoses, prescriptions, patient notes and unnecessary identifiers are excluded by default.
3. Use authenticated versioned idempotent exchange with explicit pending/rejected/reconciled state; no direct writes into Ledger tables or reuse of its sessions/secrets.

Verification scenarios
- Replay a collection/refund export and verify one receiving effect and balanced reconciliation.
- Ledger outage, unknown account mapping and source correction remain visible without altering Doctor financial history.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m8-003.md
- apps/doctor-suit/tests/unit/dos-m8-003.test.mjs
- apps/doctor-suit/supabase/tests/dos-m8-003.sql
- apps/doctor-suit/tests/e2e/dos-m8-003.spec.ts
- release-fragments/dos-m8-003.json

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
      "apps/doctor-suit/tests/unit/dos-m8-003.test.mjs"
    ],
    "commands": [
      "dos-m8-003-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m8-003.sql"
    ],
    "commands": [
      "dos-m8-003-data"
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
      "apps/doctor-suit/tests/e2e/dos-m8-003.spec.ts"
    ],
    "commands": [
      "dos-m8-003-browser"
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
    "case_id": "DOS-M8-003-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Verify the actual Ledger ingestion contract and approve financial field mapping, currencies, source IDs and reconciliation responsibility.",
    "procedure": "Verify actual Ledger ingestion and approved field/currency mappings.",
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
    "case_id": "DOS-M8-003-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Export minimized approved financial facts only; diagnoses, prescriptions, patient notes and unnecessary identifiers are excluded by default.",
    "procedure": "Assert exported financial payload excludes diagnoses, prescriptions and notes.",
    "test_case_name": "DOS-M8-003-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m8-003.test.mjs"
    ],
    "command_refs": [
      "dos-m8-003-unit"
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
    "case_id": "DOS-M8-003-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Use authenticated versioned idempotent exchange with explicit pending/rejected/reconciled state; no direct writes into Ledger tables or reuse of its sessions/secrets.",
    "procedure": "Replay/refund/outage reconciliation without direct Ledger writes or reused sessions.",
    "test_case_name": "DOS-M8-003-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-003.sql",
      "apps/doctor-suit/tests/unit/dos-m8-003.test.mjs"
    ],
    "command_refs": [
      "dos-m8-003-data",
      "dos-m8-003-unit"
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
    "case_id": "DOS-M8-003-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m8-003.json"
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
  "fragment_path": "release-fragments/dos-m8-003.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m8-003.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M8-004 — Inventory and consumables integration

Connect approved usage/stock references only when the owning Inventory/Shop capability is verified.

Requirements
- DOS-M8-R001: Business Suit ecosystem integration. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M8-F004: Connect approved usage/stock references only when the owning Inventory/Shop capability is verified. Acceptance: Verify the owning Inventory/Shop capability for approved consumable usage/reference flows and its contract version. Map only authorized stock/usage facts and explicit source documents; this task cannot infer medication substitution or dispensing authority. Keep stock owner as authoritative and reconcile accepted/rejected/pending usage; no cross-app imports or direct shared database writes.

Dependencies: DOS-M8-003
Blocking decisions: DOS-M8-GATE-START, DOS-M8-GATE-ECOSYSTEM

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
- release-fragments/dos-m8-004.json

Acceptance
1. Verify the owning Inventory/Shop capability for approved consumable usage/reference flows and its contract version.
2. Map only authorized stock/usage facts and explicit source documents; this task cannot infer medication substitution or dispensing authority.
3. Keep stock owner as authoritative and reconcile accepted/rejected/pending usage; no cross-app imports or direct shared database writes.

Verification scenarios
- Duplicate usage, reversal and stock-owner outage reconcile without double decrement.
- Reject unsupported capability, cross-practice reference and clinical diagnosis fields in stock payloads.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m8-004.md
- apps/doctor-suit/tests/unit/dos-m8-004.test.mjs
- apps/doctor-suit/supabase/tests/dos-m8-004.sql
- apps/doctor-suit/tests/e2e/dos-m8-004.spec.ts
- release-fragments/dos-m8-004.json

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
      "apps/doctor-suit/tests/unit/dos-m8-004.test.mjs"
    ],
    "commands": [
      "dos-m8-004-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m8-004.sql"
    ],
    "commands": [
      "dos-m8-004-data"
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
      "apps/doctor-suit/tests/e2e/dos-m8-004.spec.ts"
    ],
    "commands": [
      "dos-m8-004-browser"
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
    "case_id": "DOS-M8-004-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Verify the owning Inventory/Shop capability for approved consumable usage/reference flows and its contract version.",
    "procedure": "Verify selected stock-owner capability/version before usage export.",
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
    "case_id": "DOS-M8-004-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Map only authorized stock/usage facts and explicit source documents; this task cannot infer medication substitution or dispensing authority.",
    "procedure": "Validate minimized stock/usage payload without dispensing/substitution semantics.",
    "test_case_name": "DOS-M8-004-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m8-004.test.mjs"
    ],
    "command_refs": [
      "dos-m8-004-unit"
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
    "case_id": "DOS-M8-004-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Keep stock owner as authoritative and reconcile accepted/rejected/pending usage; no cross-app imports or direct shared database writes.",
    "procedure": "Replay/reverse usage during outage without double decrement or history rewrite.",
    "test_case_name": "DOS-M8-004-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-004.sql",
      "apps/doctor-suit/tests/unit/dos-m8-004.test.mjs"
    ],
    "command_refs": [
      "dos-m8-004-data",
      "dos-m8-004-unit"
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
    "case_id": "DOS-M8-004-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m8-004.json"
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
  "fragment_path": "release-fragments/dos-m8-004.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m8-004.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M8-005 — Team/employment reference integration

Link approved staff references without granting payroll/HR users access to patient records.

Requirements
- DOS-M8-R001: Business Suit ecosystem integration. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M8-F005: Link approved staff references without granting payroll/HR users access to patient records. Acceptance: Approve staff-reference fields and the actual owning employment/team capability; employment identity is distinct from Doctor membership. Link only explicit verified references and keep clinical access governed by Doctor grants; HR/payroll status never grants chart rights. Handle reference revocation, renaming and stale external identity without deleting internal audit or silently merging accounts.

Dependencies: DOS-M8-004
Blocking decisions: DOS-M8-GATE-START, DOS-M8-GATE-ECOSYSTEM

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
- release-fragments/dos-m8-005.json

Acceptance
1. Approve staff-reference fields and the actual owning employment/team capability; employment identity is distinct from Doctor membership.
2. Link only explicit verified references and keep clinical access governed by Doctor grants; HR/payroll status never grants chart rights.
3. Handle reference revocation, renaming and stale external identity without deleting internal audit or silently merging accounts.

Verification scenarios
- Change employment status and confirm no automatic patient access or owner promotion.
- Two staff share contact details; linking requires explicit reference proof and preserves independent memberships.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m8-005.md
- apps/doctor-suit/tests/unit/dos-m8-005.test.mjs
- apps/doctor-suit/supabase/tests/dos-m8-005.sql
- apps/doctor-suit/tests/e2e/dos-m8-005.spec.ts
- release-fragments/dos-m8-005.json

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
      "apps/doctor-suit/tests/unit/dos-m8-005.test.mjs"
    ],
    "commands": [
      "dos-m8-005-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m8-005.sql"
    ],
    "commands": [
      "dos-m8-005-data"
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
      "apps/doctor-suit/tests/e2e/dos-m8-005.spec.ts"
    ],
    "commands": [
      "dos-m8-005-browser"
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
    "case_id": "DOS-M8-005-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Approve staff-reference fields and the actual owning employment/team capability; employment identity is distinct from Doctor membership.",
    "procedure": "Approve actual employment capability and minimal staff-reference fields.",
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
    "case_id": "DOS-M8-005-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Link only explicit verified references and keep clinical access governed by Doctor grants; HR/payroll status never grants chart rights.",
    "procedure": "Link an explicit reference without granting HR clinical access.",
    "test_case_name": "DOS-M8-005-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-005.sql"
    ],
    "command_refs": [
      "dos-m8-005-data"
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
    "case_id": "DOS-M8-005-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Handle reference revocation, renaming and stale external identity without deleting internal audit or silently merging accounts.",
    "procedure": "Revoke/rename shared-contact staff references while retaining internal audit.",
    "test_case_name": "DOS-M8-005-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-005.sql"
    ],
    "command_refs": [
      "dos-m8-005-data"
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
    "case_id": "DOS-M8-005-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m8-005.json"
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
  "fragment_path": "release-fragments/dos-m8-005.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m8-005.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M8-006 — Notification/mail capability integration

Use approved consented communication routing with minimal payloads and no cross-product session reuse.

Requirements
- DOS-M8-R001: Business Suit ecosystem integration. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M8-F006: Use approved consented communication routing with minimal payloads and no cross-product session reuse. Acceptance: Verify an existing approved notification/mail capability and route only consented purpose-specific minimal templates. Preserve per-product sender authorization, independent sessions and outbox idempotency; receiving capability cannot read charts to construct messages. Recheck consent and recipient scope at send time and reconcile delivery/cancellation/unknown outcomes under the approved provider policy.

Dependencies: DOS-M8-005
Blocking decisions: DOS-M8-GATE-START, DOS-M8-GATE-ECOSYSTEM

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
- release-fragments/dos-m8-006.json

Acceptance
1. Verify an existing approved notification/mail capability and route only consented purpose-specific minimal templates.
2. Preserve per-product sender authorization, independent sessions and outbox idempotency; receiving capability cannot read charts to construct messages.
3. Recheck consent and recipient scope at send time and reconcile delivery/cancellation/unknown outcomes under the approved provider policy.

Verification scenarios
- Consent revoked between export and send suppresses dispatch at the accountable boundary.
- Replay, recipient mismatch and provider outage do not leak content or create duplicate messages.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m8-006.md
- apps/doctor-suit/tests/unit/dos-m8-006.test.mjs
- apps/doctor-suit/supabase/tests/dos-m8-006.sql
- apps/doctor-suit/tests/e2e/dos-m8-006.spec.ts
- release-fragments/dos-m8-006.json

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
      "apps/doctor-suit/tests/unit/dos-m8-006.test.mjs"
    ],
    "commands": [
      "dos-m8-006-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m8-006.sql"
    ],
    "commands": [
      "dos-m8-006-data"
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
      "apps/doctor-suit/tests/e2e/dos-m8-006.spec.ts"
    ],
    "commands": [
      "dos-m8-006-browser"
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
    "case_id": "DOS-M8-006-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Verify an existing approved notification/mail capability and route only consented purpose-specific minimal templates.",
    "procedure": "Verify approved notification capability and purpose-specific templates.",
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
    "case_id": "DOS-M8-006-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Preserve per-product sender authorization, independent sessions and outbox idempotency; receiving capability cannot read charts to construct messages.",
    "procedure": "Reject cross-product session use and replayed outbox work.",
    "test_case_name": "DOS-M8-006-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-006.sql",
      "apps/doctor-suit/tests/unit/dos-m8-006.test.mjs"
    ],
    "command_refs": [
      "dos-m8-006-data",
      "dos-m8-006-unit"
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
    "case_id": "DOS-M8-006-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Recheck consent and recipient scope at send time and reconcile delivery/cancellation/unknown outcomes under the approved provider policy.",
    "procedure": "Revoke consent between export/send and reconcile cancellation/unknown delivery.",
    "test_case_name": "DOS-M8-006-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-006.sql"
    ],
    "command_refs": [
      "dos-m8-006-data"
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
    "case_id": "DOS-M8-006-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m8-006.json"
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
  "fragment_path": "release-fragments/dos-m8-006.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m8-006.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M8-007 — Aggregated reporting and consent-aware sharing

Expose authorized minimized aggregates; do not repurpose treatment data for marketing.

Requirements
- DOS-M8-R001: Business Suit ecosystem integration. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M8-F007: Expose authorized minimized aggregates; do not repurpose treatment data for marketing. Acceptance: Define approved aggregate measures, disclosure scope and suppression rules with accountable privacy review; do not invent a safe anonymity threshold. Generate minimized aggregates from authorized populations with provenance and consent/use constraints; treatment data is not repurposed for marketing. Prevent drill-through or small-group disclosure beyond approved policy and revoke access when integration authority changes.

Dependencies: DOS-M8-006
Blocking decisions: DOS-M8-GATE-START, DOS-M8-GATE-ECOSYSTEM

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
- release-fragments/dos-m8-007.json

Acceptance
1. Define approved aggregate measures, disclosure scope and suppression rules with accountable privacy review; do not invent a safe anonymity threshold.
2. Generate minimized aggregates from authorized populations with provenance and consent/use constraints; treatment data is not repurposed for marketing.
3. Prevent drill-through or small-group disclosure beyond approved policy and revoke access when integration authority changes.

Verification scenarios
- Attempt filters that isolate one patient or infer suppressed values through differencing and apply the approved disclosure controls.
- Reconcile allowed aggregate totals while denying unapproved recipient/purpose and cross-doctor row-level drill-through.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m8-007.md
- apps/doctor-suit/tests/unit/dos-m8-007.test.mjs
- apps/doctor-suit/supabase/tests/dos-m8-007.sql
- apps/doctor-suit/tests/e2e/dos-m8-007.spec.ts
- release-fragments/dos-m8-007.json

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
      "apps/doctor-suit/tests/unit/dos-m8-007.test.mjs"
    ],
    "commands": [
      "dos-m8-007-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m8-007.sql"
    ],
    "commands": [
      "dos-m8-007-data"
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
      "apps/doctor-suit/tests/e2e/dos-m8-007.spec.ts"
    ],
    "commands": [
      "dos-m8-007-browser"
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
    "case_id": "DOS-M8-007-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Define approved aggregate measures, disclosure scope and suppression rules with accountable privacy review; do not invent a safe anonymity threshold.",
    "procedure": "Approve measures/disclosure/suppression with privacy reviewer evidence.",
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
    "case_id": "DOS-M8-007-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Generate minimized aggregates from authorized populations with provenance and consent/use constraints; treatment data is not repurposed for marketing.",
    "procedure": "Reconcile aggregates to authorized source populations without marketing reuse.",
    "test_case_name": "DOS-M8-007-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-007.sql"
    ],
    "command_refs": [
      "dos-m8-007-data"
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
    "case_id": "DOS-M8-007-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Prevent drill-through or small-group disclosure beyond approved policy and revoke access when integration authority changes.",
    "procedure": "Try small-group/differencing filters and revoked recipients under approved suppression policy.",
    "test_case_name": "DOS-M8-007-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-007.sql"
    ],
    "command_refs": [
      "dos-m8-007-data"
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
    "case_id": "DOS-M8-007-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m8-007.json"
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
  "fragment_path": "release-fragments/dos-m8-007.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m8-007.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M8-008 — Cross-Suit contract and failure acceptance

Test outages, replay, revocation and reconciliation across independently authorized products.

Requirements
- DOS-M8-R001: Business Suit ecosystem integration. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M8-F008: Test outages, replay, revocation and reconciliation across independently authorized products. Acceptance: Test each selected integration against verified partner contract/version and exact Doctor candidate with independent product-owner acceptance. Demonstrate replay, outage, revocation, schema incompatibility, source correction and financial/stock/message reconciliation. Unselected or unavailable integrations stay disabled and are excluded from claims; no optional provider or cross-Suit release is automatic.

Dependencies: DOS-M8-001, DOS-M8-002, DOS-M8-003, DOS-M8-004, DOS-M8-005, DOS-M8-006, DOS-M8-007
Blocking decisions: DOS-M8-GATE-START, DOS-M8-GATE-ECOSYSTEM

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
- release-fragments/dos-m8-008.json

Acceptance
1. Test each selected integration against verified partner contract/version and exact Doctor candidate with independent product-owner acceptance.
2. Demonstrate replay, outage, revocation, schema incompatibility, source correction and financial/stock/message reconciliation.
3. Unselected or unavailable integrations stay disabled and are excluded from claims; no optional provider or cross-Suit release is automatic.

Verification scenarios
- Simulate partial outage across receivers and prove unaffected services continue while pending work is recoverable.
- Trace every externally disclosed field to an approved purpose and verify no clinical chart/session leakage.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m8-008.md
- apps/doctor-suit/tests/unit/dos-m8-008.test.mjs
- apps/doctor-suit/supabase/tests/dos-m8-008.sql
- apps/doctor-suit/tests/e2e/dos-m8-008.spec.ts
- release-fragments/dos-m8-008.json

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
      "apps/doctor-suit/tests/unit/dos-m8-008.test.mjs"
    ],
    "commands": [
      "dos-m8-008-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m8-008.sql"
    ],
    "commands": [
      "dos-m8-008-data"
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
      "apps/doctor-suit/tests/e2e/dos-m8-008.spec.ts"
    ],
    "commands": [
      "dos-m8-008-browser"
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
    "case_id": "DOS-M8-008-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Test each selected integration against verified partner contract/version and exact Doctor candidate with independent product-owner acceptance.",
    "procedure": "Named owners accept exact partner versions and Doctor candidate.",
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
    "case_id": "DOS-M8-008-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Demonstrate replay, outage, revocation, schema incompatibility, source correction and financial/stock/message reconciliation.",
    "procedure": "Replay/outage/revoke/source-correct each selected exchange and reconcile effects.",
    "test_case_name": "DOS-M8-008-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m8-008.sql",
      "apps/doctor-suit/tests/unit/dos-m8-008.test.mjs"
    ],
    "command_refs": [
      "dos-m8-008-data",
      "dos-m8-008-unit"
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
    "case_id": "DOS-M8-008-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Unselected or unavailable integrations stay disabled and are excluded from claims; no optional provider or cross-Suit release is automatic.",
    "procedure": "Compare selected capabilities and partner evidence to configuration and claims; verify unselected or unavailable integrations remain disabled and no release is inferred.",
    "test_case_name": "DOS-M8-008-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m8-008.test.mjs"
    ],
    "command_refs": [
      "dos-m8-008-unit"
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
    "case_id": "DOS-M8-008-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m8-008.json"
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
  "fragment_path": "release-fragments/dos-m8-008.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m8-008.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
