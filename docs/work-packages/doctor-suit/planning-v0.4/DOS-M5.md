# DOS-M5 — Patient app, treatment timeline and medication reminders

14 tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `DOS-M5.json` and `DOS-M5.import-proposal.json`.

Milestone prerequisites: DOS-M2, DOS-M3. Every task also has an open blocking start decision.

## DOS-M5-001 — Patient identity claim and consent design

Approve safe linking of a patient to doctor records; matching phone/email alone is insufficient.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F001: Approve safe linking of a patient to doctor records; matching phone/email alone is insufficient. Acceptance: Define evidence-backed patient claim flow binding an authenticated patient identity to a specific doctor-practice relationship, with verification expiry, audit and dispute handling. Separate patient login identity, each doctor relationship, encounter and caregiver authority; contact equality alone never links or merges records. Approve consent, revocation and recovery rules with the accountable reviewer; no global chart sharing or reciprocal doctor access follows a successful claim. Prepare evidence for DOS-M5-GATE-IDENTITY. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M2-014, DOS-M3-010
Blocking decisions: DOS-M5-GATE-START

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/

Acceptance
1. Define evidence-backed patient claim flow binding an authenticated patient identity to a specific doctor-practice relationship, with verification expiry, audit and dispute handling.
2. Separate patient login identity, each doctor relationship, encounter and caregiver authority; contact equality alone never links or merges records.
3. Approve consent, revocation and recovery rules with the accountable reviewer; no global chart sharing or reciprocal doctor access follows a successful claim.
4. Prepare evidence for DOS-M5-GATE-IDENTITY. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Try to claim another patient using a shared phone/email and reject without confirming private chart existence.
- Review duplicate people, disputed claims, revoked invitation and lost-account recovery cases.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-001.md

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
    "description": "Independent accountable human reviewer evidence for the task acceptance and unresolved domain decisions",
    "blocker": "reviewer_identity_scope_candidate_and_decision_evidence_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-001.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-002 — Patient app shell and secure onboarding

Implement the chosen patient platforms with verified identity, recovery and consent history.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F002: Implement the chosen patient platforms with verified identity, recovery and consent history. Acceptance: Choose and approve patient platforms/distribution explicitly, reusing M4 architectural evidence only where applicable; register exact platform source/test commands before scaffold. Implement secure patient onboarding, claim challenge, recovery and consent-history views with minimal collected fields and product-isolated sessions. Unclaimed or disputed relationships remain unavailable and enrollment never implies medication or communication consent. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation. Prepare evidence for DOS-M5-GATE-PLATFORM. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M4-001, DOS-M5-001
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Choose and approve patient platforms/distribution explicitly, reusing M4 architectural evidence only where applicable; register exact platform source/test commands before scaffold.
2. Implement secure patient onboarding, claim challenge, recovery and consent-history views with minimal collected fields and product-isolated sessions.
3. Unclaimed or disputed relationships remain unavailable and enrollment never implies medication or communication consent.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.
5. Prepare evidence for DOS-M5-GATE-PLATFORM. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- A valid account with no approved doctor relationship sees no chart data.
- Expired claim challenge, reinstall, account switch and repeated acceptance preserve one auditable relationship.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-002.md
- apps/doctor-suit/tests/unit/dos-m5-002.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m5-002-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-002.test.mjs"
    ],
    "commands": [
      "dos-m5-002-unit"
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
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-002.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-003 — Caregivers, dependents and revocation

Implement approved minor/guardian/caregiver relationships with explicit scope and expiry/revocation.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F003: Implement approved minor/guardian/caregiver relationships with explicit scope and expiry/revocation. Acceptance: Represent caregiver/dependent authorization as named grantor, recipient, patient, scope, validity and revocation with evidence of authority. Apply approved age/guardian rules without guessing legal thresholds; each caregiver uses an independent account and limited permissions. Revoke future reads/actions and cached access under the approved policy while retaining consent and action provenance. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M5-002
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Represent caregiver/dependent authorization as named grantor, recipient, patient, scope, validity and revocation with evidence of authority.
2. Apply approved age/guardian rules without guessing legal thresholds; each caregiver uses an independent account and limited permissions.
3. Revoke future reads/actions and cached access under the approved policy while retaining consent and action provenance.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- A caregiver authorized for one dependent cannot enumerate siblings or another doctor relationship.
- Revocation/expiry during an open prescription view blocks subsequent access and suppresses pending notifications as specified.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-003.md
- apps/doctor-suit/tests/unit/dos-m5-003.test.mjs
- apps/doctor-suit/supabase/tests/dos-m5-003.sql
- docs/work-packages/doctor-suit/implementation/dos-m5-003-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-003.test.mjs"
    ],
    "commands": [
      "dos-m5-003-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m5-003.sql"
    ],
    "commands": [
      "dos-m5-003-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Independent accountable human reviewer evidence for the task acceptance and unresolved domain decisions",
    "blocker": "reviewer_identity_scope_candidate_and_decision_evidence_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-003.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-004 — Doctor and clinic care timeline

Show released visits/prescriptions by doctor/location without granting doctors reciprocal chart access.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F004: Show released visits/prescriptions by doctor/location without granting doctors reciprocal chart access. Acceptance: Project only released visits/prescriptions into a patient timeline grouped by explicit doctor/location and source version. Do not expose private working notes, unreviewed results or another person sharing contact details; doctors gain no reciprocal chart access. Handle pagination, revoked release, empty relationships and corrected provenance without silently combining clinical records. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-012, DOS-M5-003
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Project only released visits/prescriptions into a patient timeline grouped by explicit doctor/location and source version.
2. Do not expose private working notes, unreviewed results or another person sharing contact details; doctors gain no reciprocal chart access.
3. Handle pagination, revoked release, empty relationships and corrected provenance without silently combining clinical records.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Patient sees independently released records from A and B while A cannot query B records.
- Withdraw one release and verify timeline, detail link and cached projection follow the revocation contract.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-004.md
- apps/doctor-suit/tests/unit/dos-m5-004.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m5-004-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-004.test.mjs"
    ],
    "commands": [
      "dos-m5-004-unit"
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
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-004.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-005 — Prescription detail and current-version handling

Show clear start/end dates, doctor instructions, active/amended/stopped state and provenance.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F005: Show clear start/end dates, doctor instructions, active/amended/stopped state and provenance. Acceptance: Show exact signed instructions, medicine identity, dates, prescriber and current version/status without substituting medical interpretation. Clearly distinguish active, future, completed, stopped, superseded and as-needed instructions; uncertain state does not render as current advice. Refresh/reconcile amended versions before reminder creation and retain source-version links for historical actions. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-012, DOS-M5-004
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Show exact signed instructions, medicine identity, dates, prescriber and current version/status without substituting medical interpretation.
2. Clearly distinguish active, future, completed, stopped, superseded and as-needed instructions; uncertain state does not render as current advice.
3. Refresh/reconcile amended versions before reminder creation and retain source-version links for historical actions.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Amend or stop a prescription while detail is open and show the updated status with obsolete reminder cancellation.
- Compare long bilingual instructions against the signed source and verify no truncation changes meaning.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-005.md
- apps/doctor-suit/tests/unit/dos-m5-005.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m5-005-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-005.test.mjs"
    ],
    "commands": [
      "dos-m5-005-unit"
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
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-005.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-006 — Dose-event schedule engine

Derive deterministic scheduled reminders from signed instructions with timezone and change handling.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F006: Derive deterministic scheduled reminders from signed instructions with timezone and change handling. Acceptance: Translate only approved signed structured schedules into deterministic reminder events identified by prescription version, segment and occurrence. Specify timezone/clock-change, start/end inclusivity, daylight-saving gaps/folds and explicit anchors with clinician-reviewed test vectors; ambiguous/as-needed instructions require approved handling rather than inferred dosing. Version the scheduling algorithm and cancel obsolete events on amendment/stop; never calculate medical doses or advise missed-dose compensation. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation. Prepare evidence for DOS-M5-GATE-REMINDERS. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M2-007, DOS-M2-008, DOS-M2-012, DOS-M5-005
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Translate only approved signed structured schedules into deterministic reminder events identified by prescription version, segment and occurrence.
2. Specify timezone/clock-change, start/end inclusivity, daylight-saving gaps/folds and explicit anchors with clinician-reviewed test vectors; ambiguous/as-needed instructions require approved handling rather than inferred dosing.
3. Version the scheduling algorithm and cancel obsolete events on amendment/stop; never calculate medical doses or advise missed-dose compensation.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.
5. Prepare evidence for DOS-M5-GATE-REMINDERS. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Use fixed clocks to test midnight, daylight-saving folds/gaps, travel timezone changes, taper segments and selected weekdays.
- Repeated calculation yields identical event IDs; unknown schedule/anchor produces a visible unsupported state and no guessed event.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-006.md
- apps/doctor-suit/tests/unit/dos-m5-006.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m5-006-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-006.test.mjs"
    ],
    "commands": [
      "dos-m5-006-unit"
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
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-006.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-007 — Device notification permission and channel handling

Handle OS permission, disabled notifications, app reinstall and delivery limitations honestly.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F007: Handle OS permission, disabled notifications, app reinstall and delivery limitations honestly. Acceptance: Request OS notification permission at an explained point and record per-device/channel capability without treating permission as guaranteed delivery. Handle denied/revoked permissions, app reinstall, OS restrictions and disabled channels with truthful status and recovery steps. Use minimal notification content appropriate to approved privacy settings; account/caregiver revocation disables future private alerts. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-007, DOS-M2-008, DOS-M2-012, DOS-M5-006
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM, DOS-M5-GATE-REMINDERS

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Request OS notification permission at an explained point and record per-device/channel capability without treating permission as guaranteed delivery.
2. Handle denied/revoked permissions, app reinstall, OS restrictions and disabled channels with truthful status and recovery steps.
3. Use minimal notification content appropriate to approved privacy settings; account/caregiver revocation disables future private alerts.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Deny permission then enable it in system settings and reconcile once without duplicate events.
- Test device reboot, killed app, changed timezone and disabled channel on each supported OS; record delivery limitations.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-007.md
- apps/doctor-suit/tests/unit/dos-m5-007.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m5-007-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-007.test.mjs"
    ],
    "commands": [
      "dos-m5-007-unit"
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
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-007.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-008 — Taken, skip and snooze interactions

Snooze affects notification time only; action retries are idempotent and never rewrite the prescribed regimen.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F008: Snooze affects notification time only; action retries are idempotent and never rewrite the prescribed regimen. Acceptance: Record taken/skip/snooze as patient-reported actions linked to an immutable dose-event ID with idempotent commands. Snooze changes notification time only and never rewrites prescription, event dose or regimen; show original schedule alongside snooze state. Permit explicit correction with provenance and conflicts handled consistently across devices; no action produces medical advice. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-007, DOS-M2-008, DOS-M2-012, DOS-M5-007
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM, DOS-M5-GATE-REMINDERS

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Record taken/skip/snooze as patient-reported actions linked to an immutable dose-event ID with idempotent commands.
2. Snooze changes notification time only and never rewrites prescription, event dose or regimen; show original schedule alongside snooze state.
3. Permit explicit correction with provenance and conflicts handled consistently across devices; no action produces medical advice.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Repeated tap and retry on taken/skip create one action history transition.
- Snooze near next event and after a prescription stop preserves regimen and follows the approved notification conflict policy.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-008.md
- apps/doctor-suit/tests/unit/dos-m5-008.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m5-008-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-008.test.mjs"
    ],
    "commands": [
      "dos-m5-008-unit"
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
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-008.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-009 — Missed reminders and stop/amend reconciliation

Cancel obsolete reminders and avoid duplicate alerts or invented double-dose advice.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F009: Cancel obsolete reminders and avoid duplicate alerts or invented double-dose advice. Acceptance: Reconcile missing/late notifications separately from patient adherence and scheduled dose occurrence; a delivery failure is not proof of a missed dose. Stop/amend revokes obsolete pending reminders, retains historical action provenance and never schedules compensating double doses. Use deterministic expiry/reconciliation states so delayed delivery and reconnect do not resurrect stopped events. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-007, DOS-M2-008, DOS-M2-012, DOS-M5-008
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM, DOS-M5-GATE-REMINDERS

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Reconcile missing/late notifications separately from patient adherence and scheduled dose occurrence; a delivery failure is not proof of a missed dose.
2. Stop/amend revokes obsolete pending reminders, retains historical action provenance and never schedules compensating double doses.
3. Use deterministic expiry/reconciliation states so delayed delivery and reconnect do not resurrect stopped events.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Deliver a delayed old-version notification after stop/amend and suppress further action against it.
- Test offline missed notification, repeated reconciliation and restart with no duplicate future event.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-009.md
- apps/doctor-suit/tests/unit/dos-m5-009.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m5-009-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-009.test.mjs"
    ],
    "commands": [
      "dos-m5-009-unit"
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
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-009.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-010 — Adherence history and patient corrections

Record patient-reported actions distinctly from verified administration and permit auditable correction.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F010: Record patient-reported actions distinctly from verified administration and permit auditable correction. Acceptance: Store patient/caregiver-reported adherence separately from verified administration, with actor, event/version and device/server timestamps. Allow audited correction without deleting prior events and show uncertainty/conflicting reports explicitly. Doctor visibility requires approved release/consent scope; adherence is not a diagnostic conclusion or automatic treatment change. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-007, DOS-M2-008, DOS-M2-012, DOS-M5-009
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM, DOS-M5-GATE-REMINDERS

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Store patient/caregiver-reported adherence separately from verified administration, with actor, event/version and device/server timestamps.
2. Allow audited correction without deleting prior events and show uncertainty/conflicting reports explicitly.
3. Doctor visibility requires approved release/consent scope; adherence is not a diagnostic conclusion or automatic treatment change.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Correct a mistaken taken report and retain both original and correction provenance.
- Deny an unrelated doctor/caregiver read and avoid interpreting clock-skewed reports as verified timing.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-010.md
- apps/doctor-suit/tests/unit/dos-m5-010.test.mjs
- apps/doctor-suit/supabase/tests/dos-m5-010.sql
- docs/work-packages/doctor-suit/implementation/dos-m5-010-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-010.test.mjs"
    ],
    "commands": [
      "dos-m5-010-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m5-010.sql"
    ],
    "commands": [
      "dos-m5-010-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-010.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-011 — Multi-device sync and notification deduplication

Reconcile action conflicts, clock/timezone changes and multiple devices without repeated dose events.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F011: Reconcile action conflicts, clock/timezone changes and multiple devices without repeated dose events. Acceptance: Assign stable event/action IDs and reconcile multiple devices with idempotency, explicit conflict policy and authoritative server versions. Deduplicate notification scheduling/delivery according to approved device ownership/channel policy; offline conflicts remain visible until reconciled. Handle device revocation, clock skew, timezone changes and prescription amendments without duplicate dose events or lost corrections. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-007, DOS-M2-008, DOS-M2-012, DOS-M5-010
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM, DOS-M5-GATE-REMINDERS

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Assign stable event/action IDs and reconcile multiple devices with idempotency, explicit conflict policy and authoritative server versions.
2. Deduplicate notification scheduling/delivery according to approved device ownership/channel policy; offline conflicts remain visible until reconciled.
3. Handle device revocation, clock skew, timezone changes and prescription amendments without duplicate dose events or lost corrections.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Two offline devices report conflicting actions then reconnect in opposite orders and reach the approved deterministic result.
- Reinstall and register a new device while the old device is revoked; no duplicated future notification schedule.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-011.md
- apps/doctor-suit/tests/unit/dos-m5-011.test.mjs
- apps/doctor-suit/supabase/tests/dos-m5-011.sql
- docs/work-packages/doctor-suit/implementation/dos-m5-011-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-011.test.mjs"
    ],
    "commands": [
      "dos-m5-011-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m5-011.sql"
    ],
    "commands": [
      "dos-m5-011-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-011.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-012 — Appointments and released results

Show authorized appointments/results and follow-up instructions with doctor provenance.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F012: Show authorized appointments/results and follow-up instructions with doctor provenance. Acceptance: Show only authorized appointments, clinician-released results and follow-up instructions with doctor/location provenance. Keep operational appointment state separate from result interpretation; a received result is hidden until release. Apply patient/caregiver scope, revocation and current-version checks on direct links and cached views. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-007, DOS-M2-008, DOS-M2-012, DOS-M5-011
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM, DOS-M5-GATE-REMINDERS

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Show only authorized appointments, clinician-released results and follow-up instructions with doctor/location provenance.
2. Keep operational appointment state separate from result interpretation; a received result is hidden until release.
3. Apply patient/caregiver scope, revocation and current-version checks on direct links and cached views.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Open unreleased result and wrong-dependent deep links and deny access without data leakage.
- Cancel/reschedule an appointment while offline, then reconcile status without presenting a stale appointment as confirmed.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-012.md
- apps/doctor-suit/tests/unit/dos-m5-012.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m5-012-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-012.test.mjs"
    ],
    "commands": [
      "dos-m5-012-unit"
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
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-012.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-013 — Accessible patient experience and limited-connectivity behavior

Support readable instructions, accessible actions and safe minimal caching for approved users/devices.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F013: Support readable instructions, accessible actions and safe minimal caching for approved users/devices. Acceptance: Verify readable bilingual instructions, text scaling, screen reader order, contrast, keyboard/switch access where supported and reachable primary actions. Show last-sync/offline/unsupported notification states truthfully; cache only the approved minimum for approved devices/users. Protect sensitive previews and clear expired/revoked cache; accessibility adaptations cannot hide or alter prescription meaning. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-007, DOS-M2-008, DOS-M2-012, DOS-M5-012
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM, DOS-M5-GATE-REMINDERS

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Verify readable bilingual instructions, text scaling, screen reader order, contrast, keyboard/switch access where supported and reachable primary actions.
2. Show last-sync/offline/unsupported notification states truthfully; cache only the approved minimum for approved devices/users.
3. Protect sensitive previews and clear expired/revoked cache; accessibility adaptations cannot hide or alter prescription meaning.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Test maximum supported text size and long Arabic instructions on the smallest approved device.
- Read cached data after session expiry or caregiver revocation and verify the approved denial/cleanup behavior.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-013.md
- apps/doctor-suit/tests/unit/dos-m5-013.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m5-013-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-013.test.mjs"
    ],
    "commands": [
      "dos-m5-013-unit"
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
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-013.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M5-014 — Reminder safety and patient pilot acceptance

Test real-device timing/permissions/snooze/amendment scenarios with clinical review; never promise guaranteed alarms.

Requirements
- DOS-M5-R001: Patient app, treatment timeline and medication reminders. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M5-F014: Test real-device timing/permissions/snooze/amendment scenarios with clinical review; never promise guaranteed alarms. Acceptance: Validate deterministic schedule vectors and real-device permission, background, snooze, travel, stop/amend and multi-device scenarios against the exact candidate. Obtain independent clinical and patient-usability review; simulated data acceptance does not authorize real patients. Any supervised patient pilot requires separate M7 real-data authorization and consent; document alarm limitations and never promise guaranteed reminders. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-007, DOS-M2-008, DOS-M2-012, DOS-M5-001, DOS-M5-002, DOS-M5-003, DOS-M5-004, DOS-M5-005, DOS-M5-006, DOS-M5-007, DOS-M5-008, DOS-M5-009, DOS-M5-010, DOS-M5-011, DOS-M5-012, DOS-M5-013
Blocking decisions: DOS-M5-GATE-START, DOS-M5-GATE-IDENTITY, DOS-M5-GATE-PLATFORM, DOS-M5-GATE-REMINDERS

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/patient/
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
- release-fragments/

Acceptance
1. Validate deterministic schedule vectors and real-device permission, background, snooze, travel, stop/amend and multi-device scenarios against the exact candidate.
2. Obtain independent clinical and patient-usability review; simulated data acceptance does not authorize real patients.
3. Any supervised patient pilot requires separate M7 real-data authorization and consent; document alarm limitations and never promise guaranteed reminders.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Trace every reminder to the signed source version and every patient action to an unchanged regimen.
- Missing real-device or clinical evidence and failed obsolete-event cancellation block patient-app acceptance.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m5-014.md
- apps/doctor-suit/tests/unit/dos-m5-014.test.mjs
- apps/doctor-suit/supabase/tests/dos-m5-014.sql
- docs/work-packages/doctor-suit/implementation/dos-m5-014-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m5-014.test.mjs"
    ],
    "commands": [
      "dos-m5-014-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m5-014.sql"
    ],
    "commands": [
      "dos-m5-014-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Exact-candidate device and chosen-platform build/test evidence; Node protocol tests alone cannot satisfy mobile acceptance",
    "blocker": "approved_platform_command_mapping_and_device_receipts_required",
    "phase": "pre_publication"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Independent accountable human reviewer evidence for the task acceptance and unresolved domain decisions",
    "blocker": "reviewer_identity_scope_candidate_and_decision_evidence_required",
    "phase": "pre_publication"
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
  }
]

Execution boundaries
- Synthetic identities and patient records only. No real patient data, credentials, hosted product migrations, provider purchases, deployments, merges or main promotion are authorized.
- Doctor owns the practice across locations. Secretary memberships and grants remain independent per doctor and location. Patient identity, doctor relationship and encounter are separate; phone/email equality never merges identities or shares charts.
- Use the pinned Nuxt/Vue/pnpm monorepo and root lockfile. Every web route renders one registered complete packages/ui template; shared interactions belong in packages/ux; app adapters own queries and domain logic. Never import other apps or add Suit-local Vue composition/CSS.
- Read current root and scoped AGENTS plus git preflight before implementation. Work only in assigned worktree and allowed paths. Preserve history and unrelated edits. Worker leaves verification/publication to control plane; no worker commits or pushes.
- No automatic diagnosis, prescribing, dose advice, medication substitution, clinical efficacy claims or guaranteed notifications. Evidence-dependent clinical, legal, provider, commercial and mobile choices remain explicit gates.
- No task execution until parent confirms all nine milestones safely stored and the relevant real blocking start decision is explicitly resolved. Saving/importing plans does not authorize execution or release.

Evidence handback
- Task ID, exact base/head SHA, parent PR and changed paths; immutable test log/artifact references tied to the candidate.
- Exact command argv, environment/tool versions, start/end time and exit code; distinguish passed, failed and unrun checks. Missing tests or skipped suites never count as acceptance.
- Synthetic fixture identities, positive and negative assertions, permissions and data-integrity results; redact tokens and private payloads.
- Independent verifier results, unresolved decision IDs and reviewed scope; implemented, verified, published, merged and deployed are separate states.
- Create docs/work-packages/doctor-suit/implementation/dos-m5-014.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
