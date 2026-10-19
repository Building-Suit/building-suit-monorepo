# DOS-M3 — Full practice operations and communications

10 tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `DOS-M3.json` and `DOS-M3.import-proposal.json`.

Milestone prerequisites: DOS-M2. Every task also has an open blocking start decision.

## DOS-M3-001 — Appointment types and multi-location capacity

Extend scheduling with approved consultation types, buffers and cross-location capacity rules.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F001: Extend scheduling with approved consultation types, buffers and cross-location capacity rules. Acceptance: Model consultation types, duration, buffers, capacity and location availability under the owning doctor; use one authoritative overlap rule shared by availability and booking. Enforce cross-location doctor commitments atomically and preserve appointment version/type history when configuration changes. Handle timezone and exception rules explicitly; any capacity override requires a permitted actor and recorded reason.

Dependencies: DOS-M2-014
Blocking decisions: DOS-M3-GATE-START

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
- release-fragments/dos-m3-001.json

Acceptance
1. Model consultation types, duration, buffers, capacity and location availability under the owning doctor; use one authoritative overlap rule shared by availability and booking.
2. Enforce cross-location doctor commitments atomically and preserve appointment version/type history when configuration changes.
3. Handle timezone and exception rules explicitly; any capacity override requires a permitted actor and recorded reason.

Verification scenarios
- Simultaneous booking of one doctor at two locations admits at most the allowed capacity.
- Test buffer boundaries, closed-location exceptions and daylight-saving transition slots.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-001.md
- apps/doctor-suit/tests/unit/dos-m3-001.test.mjs
- apps/doctor-suit/supabase/tests/dos-m3-001.sql
- apps/doctor-suit/tests/e2e/dos-m3-001.spec.ts
- release-fragments/dos-m3-001.json

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
      "apps/doctor-suit/tests/unit/dos-m3-001.test.mjs"
    ],
    "commands": [
      "dos-m3-001-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m3-001.sql"
    ],
    "commands": [
      "dos-m3-001-data"
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
      "apps/doctor-suit/tests/e2e/dos-m3-001.spec.ts"
    ],
    "commands": [
      "dos-m3-001-browser"
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
    "case_id": "DOS-M3-001-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Model consultation types, duration, buffers, capacity and location availability under the owning doctor; use one authoritative overlap rule shared by availability and booking.",
    "procedure": "Book competing buffered consultation types across two locations against one authoritative capacity rule.",
    "test_case_name": "DOS-M3-001-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-001.sql"
    ],
    "command_refs": [
      "dos-m3-001-data"
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
    "case_id": "DOS-M3-001-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Enforce cross-location doctor commitments atomically and preserve appointment version/type history when configuration changes.",
    "procedure": "Race booking and configuration update and preserve the booked type/version snapshot.",
    "test_case_name": "DOS-M3-001-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-001.sql"
    ],
    "command_refs": [
      "dos-m3-001-data"
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
    "case_id": "DOS-M3-001-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Handle timezone and exception rules explicitly; any capacity override requires a permitted actor and recorded reason.",
    "procedure": "Test timezone exceptions and require actor/reason for any permitted override.",
    "test_case_name": "DOS-M3-001-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-001.sql",
      "apps/doctor-suit/tests/unit/dos-m3-001.test.mjs"
    ],
    "command_refs": [
      "dos-m3-001-data",
      "dos-m3-001-unit"
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
    "case_id": "DOS-M3-001-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-001.json"
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
  "fragment_path": "release-fragments/dos-m3-001.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-001.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M3-002 — Waitlist and cancellation recovery

Fill cancelled slots through consented, auditable operations without duplicate booking.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F002: Fill cancelled slots through consented, auditable operations without duplicate booking. Acceptance: Maintain a scoped waitlist with patient contact permission, requested time/location/type and explicit waiting/offered/accepted/expired/cancelled states. Reserve and accept an offered slot atomically with expiry and idempotency; do not send messages until approved communications are configured. Release expired offers and preserve offer history without promising priority that has not been specified.

Dependencies: DOS-M3-001
Blocking decisions: DOS-M3-GATE-START

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
- release-fragments/dos-m3-002.json

Acceptance
1. Maintain a scoped waitlist with patient contact permission, requested time/location/type and explicit waiting/offered/accepted/expired/cancelled states.
2. Reserve and accept an offered slot atomically with expiry and idempotency; do not send messages until approved communications are configured.
3. Release expired offers and preserve offer history without promising priority that has not been specified.

Verification scenarios
- Two waitlist acceptances race for one slot; only one booking succeeds.
- Consent revocation, cancellation and expired offers prevent contact/booking and return the slot safely.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-002.md
- apps/doctor-suit/tests/unit/dos-m3-002.test.mjs
- apps/doctor-suit/supabase/tests/dos-m3-002.sql
- apps/doctor-suit/tests/e2e/dos-m3-002.spec.ts
- release-fragments/dos-m3-002.json

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
      "apps/doctor-suit/tests/unit/dos-m3-002.test.mjs"
    ],
    "commands": [
      "dos-m3-002-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m3-002.sql"
    ],
    "commands": [
      "dos-m3-002-data"
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
      "apps/doctor-suit/tests/e2e/dos-m3-002.spec.ts"
    ],
    "commands": [
      "dos-m3-002-browser"
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
    "case_id": "DOS-M3-002-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Maintain a scoped waitlist with patient contact permission, requested time/location/type and explicit waiting/offered/accepted/expired/cancelled states.",
    "procedure": "Transition scoped waitlist offers with explicit contact consent and expiry.",
    "test_case_name": "DOS-M3-002-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-002.sql"
    ],
    "command_refs": [
      "dos-m3-002-data"
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
    "case_id": "DOS-M3-002-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Reserve and accept an offered slot atomically with expiry and idempotency; do not send messages until approved communications are configured.",
    "procedure": "Race two acceptances and replay them; only one booking consumes a slot.",
    "test_case_name": "DOS-M3-002-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-002.sql"
    ],
    "command_refs": [
      "dos-m3-002-data"
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
    "case_id": "DOS-M3-002-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Release expired offers and preserve offer history without promising priority that has not been specified.",
    "procedure": "Expire/revoke an offer and reconcile released capacity and retained history.",
    "test_case_name": "DOS-M3-002-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-002.sql"
    ],
    "command_refs": [
      "dos-m3-002-data"
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
    "case_id": "DOS-M3-002-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-002.json"
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
  "fragment_path": "release-fragments/dos-m3-002.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-002.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M3-003 — Reception and check-in exception workflows

Handle late arrivals, no-shows, walk-ins and rescheduling with clear authority.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F003: Handle late arrivals, no-shows, walk-ins and rescheduling with clear authority. Acceptance: Define allowed late-arrival, no-show, walk-in, check-in, reschedule and queue-exit transitions with responsible actor and reason. Separate queue order from clinical urgency; no automated triage or inferred medical priority. Reconcile concurrent reception edits and reconnect state from authoritative records; doctor and secretary retain distinct capabilities.

Dependencies: DOS-M3-002
Blocking decisions: DOS-M3-GATE-START

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
- release-fragments/dos-m3-003.json

Acceptance
1. Define allowed late-arrival, no-show, walk-in, check-in, reschedule and queue-exit transitions with responsible actor and reason.
2. Separate queue order from clinical urgency; no automated triage or inferred medical priority.
3. Reconcile concurrent reception edits and reconnect state from authoritative records; doctor and secretary retain distinct capabilities.

Verification scenarios
- Double check-in and late retry cannot duplicate queue entries.
- Exercise walk-in without patient identity merge, no-show reversal and cross-location denial.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-003.md
- apps/doctor-suit/tests/unit/dos-m3-003.test.mjs
- apps/doctor-suit/tests/e2e/dos-m3-003.spec.ts
- release-fragments/dos-m3-003.json

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
      "apps/doctor-suit/tests/unit/dos-m3-003.test.mjs"
    ],
    "commands": [
      "dos-m3-003-unit"
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
      "apps/doctor-suit/tests/e2e/dos-m3-003.spec.ts"
    ],
    "commands": [
      "dos-m3-003-browser"
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
    "case_id": "DOS-M3-003-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Define allowed late-arrival, no-show, walk-in, check-in, reschedule and queue-exit transitions with responsible actor and reason.",
    "procedure": "Drive late/no-show/walk-in/reschedule transitions with explicit reasons and permitted actors.",
    "test_case_name": "DOS-M3-003-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m3-003.spec.ts"
    ],
    "command_refs": [
      "dos-m3-003-browser"
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
    "case_id": "DOS-M3-003-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Separate queue order from clinical urgency; no automated triage or inferred medical priority.",
    "procedure": "Change queue order without adding medical triage labels or inferred urgency.",
    "test_case_name": "DOS-M3-003-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m3-003.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m3-003.spec.ts"
    ],
    "command_refs": [
      "dos-m3-003-unit",
      "dos-m3-003-browser"
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
    "case_id": "DOS-M3-003-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Reconcile concurrent reception edits and reconnect state from authoritative records; doctor and secretary retain distinct capabilities.",
    "procedure": "Reconnect while two reception actors edit and assert one authoritative queue state.",
    "test_case_name": "DOS-M3-003-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m3-003.spec.ts"
    ],
    "command_refs": [
      "dos-m3-003-browser"
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
    "case_id": "DOS-M3-003-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-003.json"
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
  "fragment_path": "release-fragments/dos-m3-003.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-003.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M3-004 — Care-team tasks and follow-up worklists

Assign authorized nonclinical follow-up work without leaking diagnoses to unprivileged staff.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F004: Assign authorized nonclinical follow-up work without leaking diagnoses to unprivileged staff. Acceptance: Assign administrative follow-up work to authorized members within practice/location with due date, status and audit history. Minimize worklist content to the assignee capability; clinical note/diagnosis fields are unavailable to administrative-only staff. Handle reassignment, membership revocation and duplicate completion atomically without losing task history.

Dependencies: DOS-M3-003
Blocking decisions: DOS-M3-GATE-START

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
- release-fragments/dos-m3-004.json

Acceptance
1. Assign administrative follow-up work to authorized members within practice/location with due date, status and audit history.
2. Minimize worklist content to the assignee capability; clinical note/diagnosis fields are unavailable to administrative-only staff.
3. Handle reassignment, membership revocation and duplicate completion atomically without losing task history.

Verification scenarios
- Revoke an assignee during an open worklist and verify no subsequent protected reads or writes.
- Inspect administrative projections and notification payloads for absence of clinical notes.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-004.md
- apps/doctor-suit/tests/unit/dos-m3-004.test.mjs
- apps/doctor-suit/supabase/tests/dos-m3-004.sql
- apps/doctor-suit/tests/e2e/dos-m3-004.spec.ts
- release-fragments/dos-m3-004.json

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
      "apps/doctor-suit/tests/unit/dos-m3-004.test.mjs"
    ],
    "commands": [
      "dos-m3-004-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m3-004.sql"
    ],
    "commands": [
      "dos-m3-004-data"
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
      "apps/doctor-suit/tests/e2e/dos-m3-004.spec.ts"
    ],
    "commands": [
      "dos-m3-004-browser"
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
    "case_id": "DOS-M3-004-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Assign administrative follow-up work to authorized members within practice/location with due date, status and audit history.",
    "procedure": "Assign/reassign/complete scoped work with due dates and audit events.",
    "test_case_name": "DOS-M3-004-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-004.sql"
    ],
    "command_refs": [
      "dos-m3-004-data"
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
    "case_id": "DOS-M3-004-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Minimize worklist content to the assignee capability; clinical note/diagnosis fields are unavailable to administrative-only staff.",
    "procedure": "Query an administrative worklist and verify clinical notes/diagnoses are not returned.",
    "test_case_name": "DOS-M3-004-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-004.sql"
    ],
    "command_refs": [
      "dos-m3-004-data"
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
    "case_id": "DOS-M3-004-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Handle reassignment, membership revocation and duplicate completion atomically without losing task history.",
    "procedure": "Revoke an assignee and replay completion; preserve history and reject further access.",
    "test_case_name": "DOS-M3-004-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-004.sql"
    ],
    "command_refs": [
      "dos-m3-004-data"
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
    "case_id": "DOS-M3-004-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-004.json"
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
  "fragment_path": "release-fragments/dos-m3-004.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-004.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M3-005 — Patient and guardian contact/consent preferences

Capture explicit operational contact preferences and guardian relationships without marketing defaults.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F005: Capture explicit operational contact preferences and guardian relationships without marketing defaults. Acceptance: Record contact channels, purposes, consent source/time, verified relationship and revocation separately from login identity. Guardian authority is an explicit reviewed relationship with scope and expiry; matching phone/email is insufficient and marketing defaults are off. Communication eligibility is rechecked at dispatch and consent changes retain audit history; legal/minor policy remains M7 evidence.

Dependencies: DOS-M3-004
Blocking decisions: DOS-M3-GATE-START

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
- release-fragments/dos-m3-005.json

Acceptance
1. Record contact channels, purposes, consent source/time, verified relationship and revocation separately from login identity.
2. Guardian authority is an explicit reviewed relationship with scope and expiry; matching phone/email is insufficient and marketing defaults are off.
3. Communication eligibility is rechecked at dispatch and consent changes retain audit history; legal/minor policy remains M7 evidence.

Verification scenarios
- Two patients share a phone: consent and identities remain independent.
- Revoke guardian/channel permission after queueing a message and prove dispatch is suppressed.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-005.md
- apps/doctor-suit/tests/unit/dos-m3-005.test.mjs
- apps/doctor-suit/supabase/tests/dos-m3-005.sql
- apps/doctor-suit/tests/e2e/dos-m3-005.spec.ts
- release-fragments/dos-m3-005.json

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
      "apps/doctor-suit/tests/unit/dos-m3-005.test.mjs"
    ],
    "commands": [
      "dos-m3-005-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m3-005.sql"
    ],
    "commands": [
      "dos-m3-005-data"
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
      "apps/doctor-suit/tests/e2e/dos-m3-005.spec.ts"
    ],
    "commands": [
      "dos-m3-005-browser"
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
    "case_id": "DOS-M3-005-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Record contact channels, purposes, consent source/time, verified relationship and revocation separately from login identity.",
    "procedure": "Store purpose/channel/source/consent independently for patients sharing contact details.",
    "test_case_name": "DOS-M3-005-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-005.sql"
    ],
    "command_refs": [
      "dos-m3-005-data"
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
    "case_id": "DOS-M3-005-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Guardian authority is an explicit reviewed relationship with scope and expiry; matching phone/email is insufficient and marketing defaults are off.",
    "procedure": "Validate evidence-backed guardian scope/expiry without guessed age thresholds.",
    "test_case_name": "DOS-M3-005-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-005.sql"
    ],
    "command_refs": [
      "dos-m3-005-data"
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
    "case_id": "DOS-M3-005-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Communication eligibility is rechecked at dispatch and consent changes retain audit history; legal/minor policy remains M7 evidence.",
    "procedure": "Revoke consent after queueing; the dispatch eligibility check must suppress sending.",
    "test_case_name": "DOS-M3-005-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-005.sql"
    ],
    "command_refs": [
      "dos-m3-005-data"
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
    "case_id": "DOS-M3-005-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-005.json"
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
  "fragment_path": "release-fragments/dos-m3-005.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-005.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M3-006 — Messaging outbox and delivery tracking

Implement a provider-neutral, retry-safe outbox with consent, minimal payloads and failure visibility.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F006: Implement a provider-neutral, retry-safe outbox with consent, minimal payloads and failure visibility. Acceptance: Persist provider-neutral message intents with purpose, recipient scope, consent reference, idempotency key and minimal template parameters. Separate queued/claimed/sent/delivered/failed/unknown state; bounded retry and reconciliation preserve provider acknowledgement semantics. Redact logs and expose operational failures without message-body leakage; synthetic transport is the only default adapter.

Dependencies: DOS-M3-005
Blocking decisions: DOS-M3-GATE-START

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
- release-fragments/dos-m3-006.json

Acceptance
1. Persist provider-neutral message intents with purpose, recipient scope, consent reference, idempotency key and minimal template parameters.
2. Separate queued/claimed/sent/delivered/failed/unknown state; bounded retry and reconciliation preserve provider acknowledgement semantics.
3. Redact logs and expose operational failures without message-body leakage; synthetic transport is the only default adapter.

Verification scenarios
- Crash after provider acceptance but before acknowledgement and reconcile without duplicate send.
- Test revoked consent, expired message, provider timeout and forged delivery callback.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-006.md
- apps/doctor-suit/tests/unit/dos-m3-006.test.mjs
- apps/doctor-suit/supabase/tests/dos-m3-006.sql
- apps/doctor-suit/tests/e2e/dos-m3-006.spec.ts
- release-fragments/dos-m3-006.json

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
      "apps/doctor-suit/tests/unit/dos-m3-006.test.mjs"
    ],
    "commands": [
      "dos-m3-006-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m3-006.sql"
    ],
    "commands": [
      "dos-m3-006-data"
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
      "apps/doctor-suit/tests/e2e/dos-m3-006.spec.ts"
    ],
    "commands": [
      "dos-m3-006-browser"
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
    "case_id": "DOS-M3-006-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Persist provider-neutral message intents with purpose, recipient scope, consent reference, idempotency key and minimal template parameters.",
    "procedure": "Create duplicate intents and assert a unique purpose/recipient/idempotency envelope.",
    "test_case_name": "DOS-M3-006-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-006.sql"
    ],
    "command_refs": [
      "dos-m3-006-data"
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
    "case_id": "DOS-M3-006-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Separate queued/claimed/sent/delivered/failed/unknown state; bounded retry and reconciliation preserve provider acknowledgement semantics.",
    "procedure": "Crash after synthetic transport acceptance and reconcile queued/unknown/delivered without duplicate send.",
    "test_case_name": "DOS-M3-006-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-006.sql",
      "apps/doctor-suit/tests/unit/dos-m3-006.test.mjs"
    ],
    "command_refs": [
      "dos-m3-006-data",
      "dos-m3-006-unit"
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
    "case_id": "DOS-M3-006-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Redact logs and expose operational failures without message-body leakage; synthetic transport is the only default adapter.",
    "procedure": "Inspect log projections and operational failure UI for absence of message bodies or false success.",
    "test_case_name": "DOS-M3-006-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m3-006.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m3-006.spec.ts"
    ],
    "command_refs": [
      "dos-m3-006-unit",
      "dos-m3-006-browser"
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
    "case_id": "DOS-M3-006-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-006.json"
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
  "fragment_path": "release-fragments/dos-m3-006.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-006.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M3-007 — Approved communication-provider adapter

Connect only a separately approved provider/account/cost policy; no automatic purchases or unconsented outreach.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F007: Connect only a separately approved provider/account/cost policy; no automatic purchases or unconsented outreach. Acceptance: Select only an approved provider/account/channel with documented API, permitted use, cost owner, credentials route and consent rules. Implement one adapter behind the neutral outbox with authenticated callbacks, signature verification, replay protection and status mapping. Use sandbox/synthetic recipients only until separate outreach authorization; absent provider evidence blocks enabling the adapter. Prepare evidence for DOS-M3-GATE-PROVIDER. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M3-006
Blocking decisions: DOS-M3-GATE-START

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
- release-fragments/dos-m3-007.json

Acceptance
1. Select only an approved provider/account/channel with documented API, permitted use, cost owner, credentials route and consent rules.
2. Implement one adapter behind the neutral outbox with authenticated callbacks, signature verification, replay protection and status mapping.
3. Use sandbox/synthetic recipients only until separate outreach authorization; absent provider evidence blocks enabling the adapter.
4. Prepare evidence for DOS-M3-GATE-PROVIDER. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Provider sandbox timeout, duplicate/out-of-order receipts and revoked credentials produce recoverable states.
- No configured provider leaves messages visibly pending/disabled and never silently reports delivery.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-007.md
- apps/doctor-suit/tests/unit/dos-m3-007.test.mjs
- apps/doctor-suit/supabase/tests/dos-m3-007.sql
- apps/doctor-suit/tests/e2e/dos-m3-007.spec.ts
- release-fragments/dos-m3-007.json

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
      "apps/doctor-suit/tests/unit/dos-m3-007.test.mjs"
    ],
    "commands": [
      "dos-m3-007-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m3-007.sql"
    ],
    "commands": [
      "dos-m3-007-data"
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
      "apps/doctor-suit/tests/e2e/dos-m3-007.spec.ts"
    ],
    "commands": [
      "dos-m3-007-browser"
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
    "case_id": "DOS-M3-007-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Select only an approved provider/account/channel with documented API, permitted use, cost owner, credentials route and consent rules.",
    "procedure": "Verify actual provider/account/cost/sandbox approval and interface documentation.",
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
    "case_id": "DOS-M3-007-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Implement one adapter behind the neutral outbox with authenticated callbacks, signature verification, replay protection and status mapping.",
    "procedure": "Replay forged/duplicate/out-of-order callbacks through the adapter and map authenticated state changes.",
    "test_case_name": "DOS-M3-007-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m3-007.test.mjs",
      "apps/doctor-suit/supabase/tests/dos-m3-007.sql"
    ],
    "command_refs": [
      "dos-m3-007-unit",
      "dos-m3-007-data"
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
    "case_id": "DOS-M3-007-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Use sandbox/synthetic recipients only until separate outreach authorization; absent provider evidence blocks enabling the adapter.",
    "procedure": "Prove unapproved/unconfigured mode cannot dispatch and only authorized synthetic recipients are admitted.",
    "test_case_name": "DOS-M3-007-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m3-007.test.mjs"
    ],
    "command_refs": [
      "dos-m3-007-unit"
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
    "case_id": "DOS-M3-007-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Prepare evidence for DOS-M3-GATE-PROVIDER. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.",
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
    "case_id": "DOS-M3-007-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-007.json"
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
  "fragment_path": "release-fragments/dos-m3-007.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-007.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M3-008 — Lab/imaging/referral operational tracking

Track referral/order fulfillment status and outside documents without assuming external APIs.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F008: Track referral/order fulfillment status and outside documents without assuming external APIs. Acceptance: Track operational referral/lab/imaging fulfillment without implying partner API integration or clinical review. Link outside documents to the exact request, patient relationship and encounter with source/received timestamps and review state. Authorized staff can update operational status only; clinical release and interpretation remain M2 controls.

Dependencies: DOS-M3-007
Blocking decisions: DOS-M3-GATE-START, DOS-M3-GATE-PROVIDER

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
- release-fragments/dos-m3-008.json

Acceptance
1. Track operational referral/lab/imaging fulfillment without implying partner API integration or clinical review.
2. Link outside documents to the exact request, patient relationship and encounter with source/received timestamps and review state.
3. Authorized staff can update operational status only; clinical release and interpretation remain M2 controls.

Verification scenarios
- A document uploaded for the wrong patient/request is rejected or quarantined for explicit correction.
- Duplicate received-status updates preserve one history event per idempotency key and do not mark clinical review.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-008.md
- apps/doctor-suit/tests/unit/dos-m3-008.test.mjs
- apps/doctor-suit/supabase/tests/dos-m3-008.sql
- apps/doctor-suit/tests/e2e/dos-m3-008.spec.ts
- release-fragments/dos-m3-008.json

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
      "apps/doctor-suit/tests/unit/dos-m3-008.test.mjs"
    ],
    "commands": [
      "dos-m3-008-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m3-008.sql"
    ],
    "commands": [
      "dos-m3-008-data"
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
      "apps/doctor-suit/tests/e2e/dos-m3-008.spec.ts"
    ],
    "commands": [
      "dos-m3-008-browser"
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
    "case_id": "DOS-M3-008-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Track operational referral/lab/imaging fulfillment without implying partner API integration or clinical review.",
    "procedure": "Update operational fulfillment status without issuing external calls or clinical review.",
    "test_case_name": "DOS-M3-008-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-008.sql"
    ],
    "command_refs": [
      "dos-m3-008-data"
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
    "case_id": "DOS-M3-008-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Link outside documents to the exact request, patient relationship and encounter with source/received timestamps and review state.",
    "procedure": "Upload a document for the wrong request/patient and require quarantine or rejection.",
    "test_case_name": "DOS-M3-008-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-008.sql"
    ],
    "command_refs": [
      "dos-m3-008-data"
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
    "case_id": "DOS-M3-008-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Authorized staff can update operational status only; clinical release and interpretation remain M2 controls.",
    "procedure": "Administrative staff may update fulfillment but cannot change clinician release or interpretation.",
    "test_case_name": "DOS-M3-008-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-008.sql"
    ],
    "command_refs": [
      "dos-m3-008-data"
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
    "case_id": "DOS-M3-008-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-008.json"
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
  "fragment_path": "release-fragments/dos-m3-008.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-008.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M3-009 — Data migration and reconciliation

Provide validated mapping, import preview, deduplication review and rollback/reconciliation plans for approved legacy data.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F009: Provide validated mapping, import preview, deduplication review and rollback/reconciliation plans for approved legacy data. Acceptance: Provide a versioned source-to-target mapping and synthetic import preview with row counts, validation errors, provenance and resumable batch IDs. Potential duplicates are review candidates; identity merging or cross-doctor sharing never follows contact equality. Document backup/reconciliation/rollback and approve source custody before any real import; preserve source IDs/history and exclude real datasets in this task.

Dependencies: DOS-M3-008
Blocking decisions: DOS-M3-GATE-START, DOS-M3-GATE-PROVIDER

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
- release-fragments/dos-m3-009.json

Acceptance
1. Provide a versioned source-to-target mapping and synthetic import preview with row counts, validation errors, provenance and resumable batch IDs.
2. Potential duplicates are review candidates; identity merging or cross-doctor sharing never follows contact equality.
3. Document backup/reconciliation/rollback and approve source custody before any real import; preserve source IDs/history and exclude real datasets in this task.

Verification scenarios
- Replay the same synthetic batch, interrupt midway and reconcile counts without duplicate records.
- Reject unmatched references, invalid encoding/dates and ambiguous identity candidates without partial silent acceptance.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-009.md
- apps/doctor-suit/tests/unit/dos-m3-009.test.mjs
- apps/doctor-suit/supabase/tests/dos-m3-009.sql
- apps/doctor-suit/tests/e2e/dos-m3-009.spec.ts
- release-fragments/dos-m3-009.json

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
      "apps/doctor-suit/tests/unit/dos-m3-009.test.mjs"
    ],
    "commands": [
      "dos-m3-009-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m3-009.sql"
    ],
    "commands": [
      "dos-m3-009-data"
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
      "apps/doctor-suit/tests/e2e/dos-m3-009.spec.ts"
    ],
    "commands": [
      "dos-m3-009-browser"
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
    "case_id": "DOS-M3-009-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Provide a versioned source-to-target mapping and synthetic import preview with row counts, validation errors, provenance and resumable batch IDs.",
    "procedure": "Preview a malformed synthetic batch and reconcile mapping errors, counts and provenance.",
    "test_case_name": "DOS-M3-009-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m3-009.test.mjs",
      "apps/doctor-suit/supabase/tests/dos-m3-009.sql"
    ],
    "command_refs": [
      "dos-m3-009-unit",
      "dos-m3-009-data"
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
    "case_id": "DOS-M3-009-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Potential duplicates are review candidates; identity merging or cross-doctor sharing never follows contact equality.",
    "procedure": "Shared-contact duplicates remain review candidates; no automatic identity merge occurs.",
    "test_case_name": "DOS-M3-009-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-009.sql"
    ],
    "command_refs": [
      "dos-m3-009-data"
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
    "case_id": "DOS-M3-009-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Document backup/reconciliation/rollback and approve source custody before any real import; preserve source IDs/history and exclude real datasets in this task.",
    "procedure": "Interrupt/replay the synthetic batch and reconcile exactly once; verify the separate source-custody approval is required before any live import without granting that approval.",
    "test_case_name": "DOS-M3-009-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-009.sql"
    ],
    "command_refs": [
      "dos-m3-009-data"
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
    "case_id": "DOS-M3-009-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-009.json"
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
  "fragment_path": "release-fragments/dos-m3-009.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-009.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M3-010 — Operational reports and acceptance

Verify appointment, follow-up, no-show and workload reports against source records and permission scopes.

Requirements
- DOS-M3-R001: Full practice operations and communications. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M3-F010: Verify appointment, follow-up, no-show and workload reports against source records and permission scopes. Acceptance: Calculate appointment, follow-up, no-show and workload reports over authoritative scoped populations with explicit time windows and status definitions. Reconcile report totals and sampled rows to source records across pagination, cancellations and reassignment. Verify all operations/communications with synthetic recipients and document provider-disabled behavior and remaining gates.

Dependencies: DOS-M3-001, DOS-M3-002, DOS-M3-003, DOS-M3-004, DOS-M3-005, DOS-M3-006, DOS-M3-007, DOS-M3-008, DOS-M3-009
Blocking decisions: DOS-M3-GATE-START, DOS-M3-GATE-PROVIDER

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
- release-fragments/dos-m3-010.json

Acceptance
1. Calculate appointment, follow-up, no-show and workload reports over authoritative scoped populations with explicit time windows and status definitions.
2. Reconcile report totals and sampled rows to source records across pagination, cancellations and reassignment.
3. Verify all operations/communications with synthetic recipients and document provider-disabled behavior and remaining gates.

Verification scenarios
- Compare doctor versus differently granted secretary reports and test midnight/timezone boundaries.
- Reconcile cancelled/rescheduled appointments and failed message delivery without inflating completed work.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m3-010.md
- apps/doctor-suit/tests/unit/dos-m3-010.test.mjs
- apps/doctor-suit/supabase/tests/dos-m3-010.sql
- apps/doctor-suit/tests/e2e/dos-m3-010.spec.ts
- release-fragments/dos-m3-010.json

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
      "apps/doctor-suit/tests/unit/dos-m3-010.test.mjs"
    ],
    "commands": [
      "dos-m3-010-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m3-010.sql"
    ],
    "commands": [
      "dos-m3-010-data"
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
      "apps/doctor-suit/tests/e2e/dos-m3-010.spec.ts"
    ],
    "commands": [
      "dos-m3-010-browser"
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
    "case_id": "DOS-M3-010-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Calculate appointment, follow-up, no-show and workload reports over authoritative scoped populations with explicit time windows and status definitions.",
    "procedure": "Calculate reports over the full scoped population with explicit status/time definitions.",
    "test_case_name": "DOS-M3-010-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m3-010.sql"
    ],
    "command_refs": [
      "dos-m3-010-data"
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
    "case_id": "DOS-M3-010-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Reconcile report totals and sampled rows to source records across pagination, cancellations and reassignment.",
    "procedure": "Reconcile totals and sampled rows after pagination/cancellation/reassignment.",
    "test_case_name": "DOS-M3-010-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m3-010.test.mjs",
      "apps/doctor-suit/supabase/tests/dos-m3-010.sql"
    ],
    "command_refs": [
      "dos-m3-010-unit",
      "dos-m3-010-data"
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
    "case_id": "DOS-M3-010-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Verify all operations/communications with synthetic recipients and document provider-disabled behavior and remaining gates.",
    "procedure": "Verify complete operational journeys with synthetic transport and truthful provider-disabled states.",
    "test_case_name": "DOS-M3-010-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m3-010.spec.ts"
    ],
    "command_refs": [
      "dos-m3-010-browser"
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
    "case_id": "DOS-M3-010-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m3-010.json"
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
  "fragment_path": "release-fragments/dos-m3-010.json",
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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-010.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
