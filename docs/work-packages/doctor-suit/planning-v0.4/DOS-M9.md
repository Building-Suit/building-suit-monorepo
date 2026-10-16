# DOS-M9 — Optional specialties and external provider integrations

8 tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `DOS-M9.json` and `DOS-M9.import-proposal.json`.

Milestone prerequisites: DOS-M2, DOS-M7. Every task also has an open blocking start decision.

## DOS-M9-001 — Specialty prioritization and clinician-led templates

Select specialty modules through approved clinical requirements rather than assuming one universal chart.

Requirements
- DOS-M9-R001: Optional specialties and external provider integrations. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M9-F001: Select specialty modules through approved clinical requirements rather than assuming one universal chart. Acceptance: Obtain explicit owner selection of optional specialties and provider connectors; all eight named tasks remain stored without implying that every connector will be implemented. For selected specialties, obtain clinician-led versioned fields/workflows and review boundaries; no universal template or specialty competence is assumed. Record chosen scope, deferred tasks, qualified reviewers and acceptance fixtures without renumbering stable task IDs or cancelling history. Prepare evidence for DOS-M9-GATE-OPTIONAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M2-014, DOS-M7-010
Blocking decisions: DOS-M9-GATE-START

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/

Acceptance
1. Obtain explicit owner selection of optional specialties and provider connectors; all eight named tasks remain stored without implying that every connector will be implemented.
2. For selected specialties, obtain clinician-led versioned fields/workflows and review boundaries; no universal template or specialty competence is assumed.
3. Record chosen scope, deferred tasks, qualified reviewers and acceptance fixtures without renumbering stable task IDs or cancelling history.
4. Prepare evidence for DOS-M9-GATE-OPTIONAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Review two distinct specialty needs and identify unsupported workflows explicitly.
- No selected specialty/provider or no qualified reviewer keeps optional implementation blocked.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m9-001.md

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
- Create docs/work-packages/doctor-suit/implementation/dos-m9-001.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M9-002 — Egypt medication catalogue / national prescription feasibility

Verify source licensing, interfaces and access terms before implementing an EDA/national adapter.

Requirements
- DOS-M9-R001: Optional specialties and external provider integrations. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M9-F002: Verify source licensing, interfaces and access terms before implementing an EDA/national adapter. Acceptance: Verify actual medication catalogue/national prescription source, licensing, redistribution, version/update and access terms using provider evidence. Record whether an EDA/national interface exists and is accessible to this entity; unavailable access yields a feasibility finding, never a fabricated adapter. Specify approved fallback/manual-entry behavior and preserve M2 clinician review/signing authority; no automatic substitution or dosing recommendation. Prepare evidence for DOS-M9-GATE-MEDICATION. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M9-001
Blocking decisions: DOS-M9-GATE-START, DOS-M9-GATE-OPTIONAL

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/

Acceptance
1. Verify actual medication catalogue/national prescription source, licensing, redistribution, version/update and access terms using provider evidence.
2. Record whether an EDA/national interface exists and is accessible to this entity; unavailable access yields a feasibility finding, never a fabricated adapter.
3. Specify approved fallback/manual-entry behavior and preserve M2 clinician review/signing authority; no automatic substitution or dosing recommendation.
4. Prepare evidence for DOS-M9-GATE-MEDICATION. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Missing license, revoked access, stale catalogue and unsupported medicine identity fail closed.
- Compare provider evidence with claimed API/version and reject unsupported national-integration marketing.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m9-002.md

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
- Create docs/work-packages/doctor-suit/implementation/dos-m9-002.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M9-003 — Lab integration

Implement one verified partner protocol with identity matching, provenance and retry/reconciliation.

Requirements
- DOS-M9-R001: Optional specialties and external provider integrations. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M9-F003: Implement one verified partner protocol with identity matching, provenance and retry/reconciliation. Acceptance: Select one verified lab partner with documented protocol/version, sandbox access, commercial/data terms and explicit identity-matching rules. Map request/result IDs and provenance to the exact patient relationship/order; ambiguous matches are quarantined for authorized review, never merged by contact. Implement authenticated idempotent delivery/retry/reconciliation with result review/release still clinician-controlled. Prepare evidence for DOS-M9-GATE-LAB. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M9-002
Blocking decisions: DOS-M9-GATE-START, DOS-M9-GATE-OPTIONAL, DOS-M9-GATE-MEDICATION

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
- release-fragments/

Acceptance
1. Select one verified lab partner with documented protocol/version, sandbox access, commercial/data terms and explicit identity-matching rules.
2. Map request/result IDs and provenance to the exact patient relationship/order; ambiguous matches are quarantined for authorized review, never merged by contact.
3. Implement authenticated idempotent delivery/retry/reconciliation with result review/release still clinician-controlled.
4. Prepare evidence for DOS-M9-GATE-LAB. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Replay duplicate result, send an amended result out of order and preserve source/version history.
- Unknown patient/order or failed signature is quarantined without releasing content or marking clinical review.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m9-003.md
- apps/doctor-suit/tests/unit/dos-m9-003.test.mjs
- apps/doctor-suit/supabase/tests/dos-m9-003.sql
- apps/doctor-suit/tests/e2e/dos-m9-003.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m9-003.test.mjs"
    ],
    "commands": [
      "dos-m9-003-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m9-003.sql"
    ],
    "commands": [
      "dos-m9-003-data"
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
      "apps/doctor-suit/tests/e2e/dos-m9-003.spec.ts"
    ],
    "commands": [
      "dos-m9-003-browser"
    ],
    "requires": [
      "browser"
    ]
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
- Create docs/work-packages/doctor-suit/implementation/dos-m9-003.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M9-004 — Imaging/radiology integration

Implement one approved imaging workflow and data exchange with minimum-necessary access.

Requirements
- DOS-M9-R001: Optional specialties and external provider integrations. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M9-F004: Implement one approved imaging workflow and data exchange with minimum-necessary access. Acceptance: Approve one imaging workflow and partner exchange contract including identifiers, document/image access, version and minimum-necessary disclosure. Preserve order/patient/doctor provenance, private viewer/document authorization and reconciliation of external status. Do not assume a particular imaging standard, endpoint or diagnostic interpretation before verified partner requirements. Prepare evidence for DOS-M9-GATE-IMAGING. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M9-003
Blocking decisions: DOS-M9-GATE-START, DOS-M9-GATE-OPTIONAL, DOS-M9-GATE-MEDICATION, DOS-M9-GATE-LAB

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
- release-fragments/

Acceptance
1. Approve one imaging workflow and partner exchange contract including identifiers, document/image access, version and minimum-necessary disclosure.
2. Preserve order/patient/doctor provenance, private viewer/document authorization and reconciliation of external status.
3. Do not assume a particular imaging standard, endpoint or diagnostic interpretation before verified partner requirements.
4. Prepare evidence for DOS-M9-GATE-IMAGING. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Expired external access, wrong-patient study and partner outage remain safe and recoverable.
- Replaced/amended report retains history and requires the approved clinical review before patient release.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m9-004.md
- apps/doctor-suit/tests/unit/dos-m9-004.test.mjs
- apps/doctor-suit/supabase/tests/dos-m9-004.sql
- apps/doctor-suit/tests/e2e/dos-m9-004.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m9-004.test.mjs"
    ],
    "commands": [
      "dos-m9-004-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m9-004.sql"
    ],
    "commands": [
      "dos-m9-004-data"
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
      "apps/doctor-suit/tests/e2e/dos-m9-004.spec.ts"
    ],
    "commands": [
      "dos-m9-004-browser"
    ],
    "requires": [
      "browser"
    ]
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
- Create docs/work-packages/doctor-suit/implementation/dos-m9-004.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M9-005 — Pharmacy integration

Connect approved fulfillment/status flows without assuming medication substitution or dispensing authority.

Requirements
- DOS-M9-R001: Optional specialties and external provider integrations. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M9-F005: Connect approved fulfillment/status flows without assuming medication substitution or dispensing authority. Acceptance: Approve partner/contract, fulfillment fields and permitted prescription release with patient/doctor consent and minimum data. Exchange only authorized signed/current prescription versions and fulfillment/status events with idempotency and provenance. Stopping/amending a prescription reconciles partner state; neither adapter nor pharmacy-status UI may infer medication substitution or prescribing/dispensing authority. Prepare evidence for DOS-M9-GATE-PHARMACY. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M9-004
Blocking decisions: DOS-M9-GATE-START, DOS-M9-GATE-OPTIONAL, DOS-M9-GATE-MEDICATION, DOS-M9-GATE-LAB, DOS-M9-GATE-IMAGING

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
- release-fragments/

Acceptance
1. Approve partner/contract, fulfillment fields and permitted prescription release with patient/doctor consent and minimum data.
2. Exchange only authorized signed/current prescription versions and fulfillment/status events with idempotency and provenance.
3. Stopping/amending a prescription reconciles partner state; neither adapter nor pharmacy-status UI may infer medication substitution or prescribing/dispensing authority.
4. Prepare evidence for DOS-M9-GATE-PHARMACY. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Duplicate fulfillment receipt and delayed old-version status do not revive a stopped prescription.
- Reject unapproved recipient, revoked consent and unsigned prescription transmission.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m9-005.md
- apps/doctor-suit/tests/unit/dos-m9-005.test.mjs
- apps/doctor-suit/supabase/tests/dos-m9-005.sql
- apps/doctor-suit/tests/e2e/dos-m9-005.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m9-005.test.mjs"
    ],
    "commands": [
      "dos-m9-005-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m9-005.sql"
    ],
    "commands": [
      "dos-m9-005-data"
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
      "apps/doctor-suit/tests/e2e/dos-m9-005.spec.ts"
    ],
    "commands": [
      "dos-m9-005-browser"
    ],
    "requires": [
      "browser"
    ]
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
- Create docs/work-packages/doctor-suit/implementation/dos-m9-005.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M9-006 — Insurance/UHIA feasibility and first connector

Verify eligibility, standards, contracting and actual API availability before claims integration.

Requirements
- DOS-M9-R001: Optional specialties and external provider integrations. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M9-F006: Verify eligibility, standards, contracting and actual API availability before claims integration. Acceptance: Obtain current qualified applicability and contracting review for the named insurer/UHIA route, actual API availability, standards/version and credential eligibility. Define approved eligibility/claim fields, consent, coding responsibilities and financial reconciliation without fabricating coverage or reimbursement. Build the first connector only after verified contract/sandbox evidence; unavailable access is a documented feasibility blocker, not a mock production integration. Prepare evidence for DOS-M9-GATE-INSURANCE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M9-005
Blocking decisions: DOS-M9-GATE-START, DOS-M9-GATE-OPTIONAL, DOS-M9-GATE-MEDICATION, DOS-M9-GATE-LAB, DOS-M9-GATE-IMAGING, DOS-M9-GATE-PHARMACY

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
- release-fragments/

Acceptance
1. Obtain current qualified applicability and contracting review for the named insurer/UHIA route, actual API availability, standards/version and credential eligibility.
2. Define approved eligibility/claim fields, consent, coding responsibilities and financial reconciliation without fabricating coverage or reimbursement.
3. Build the first connector only after verified contract/sandbox evidence; unavailable access is a documented feasibility blocker, not a mock production integration.
4. Prepare evidence for DOS-M9-GATE-INSURANCE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Missing enrollment, unknown policy, disputed claim and denied eligibility produce explicit unresolved states.
- Duplicate claim/reversal and partner timeout reconcile without inventing payment or altering clinical documentation.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m9-006.md
- apps/doctor-suit/tests/unit/dos-m9-006.test.mjs
- apps/doctor-suit/supabase/tests/dos-m9-006.sql
- apps/doctor-suit/tests/e2e/dos-m9-006.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m9-006.test.mjs"
    ],
    "commands": [
      "dos-m9-006-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m9-006.sql"
    ],
    "commands": [
      "dos-m9-006-data"
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
      "apps/doctor-suit/tests/e2e/dos-m9-006.spec.ts"
    ],
    "commands": [
      "dos-m9-006-browser"
    ],
    "requires": [
      "browser"
    ]
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
- Create docs/work-packages/doctor-suit/implementation/dos-m9-006.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M9-007 — Interoperable clinical export or referral exchange

Select required standards/profile/version with partner testing and explicit patient/doctor access policy.

Requirements
- DOS-M9-R001: Optional specialties and external provider integrations. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M9-F007: Select required standards/profile/version with partner testing and explicit patient/doctor access policy. Acceptance: Select the actual standard/profile/version and partner contract through explicit decision, with approved minimum clinical dataset and patient/doctor release policy. Map stable identifiers, units, terminology, timestamps, provenance and amendment references; unsupported fields must be reported rather than silently dropped. Validate authorized export/import against partner fixtures with idempotency and quarantine ambiguous identity/version matches; cross-doctor access remains independently granted. Prepare evidence for DOS-M9-GATE-EXCHANGE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M9-006
Blocking decisions: DOS-M9-GATE-START, DOS-M9-GATE-OPTIONAL, DOS-M9-GATE-MEDICATION, DOS-M9-GATE-LAB, DOS-M9-GATE-IMAGING, DOS-M9-GATE-PHARMACY, DOS-M9-GATE-INSURANCE

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
- release-fragments/

Acceptance
1. Select the actual standard/profile/version and partner contract through explicit decision, with approved minimum clinical dataset and patient/doctor release policy.
2. Map stable identifiers, units, terminology, timestamps, provenance and amendment references; unsupported fields must be reported rather than silently dropped.
3. Validate authorized export/import against partner fixtures with idempotency and quarantine ambiguous identity/version matches; cross-doctor access remains independently granted.
4. Prepare evidence for DOS-M9-GATE-EXCHANGE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Round-trip approved synthetic records with amendments and verify field/provenance fidelity.
- Reject unsupported profile, mismatched identity, missing required field and revoked sharing authorization.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m9-007.md
- apps/doctor-suit/tests/unit/dos-m9-007.test.mjs
- apps/doctor-suit/supabase/tests/dos-m9-007.sql
- apps/doctor-suit/tests/e2e/dos-m9-007.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m9-007.test.mjs"
    ],
    "commands": [
      "dos-m9-007-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m9-007.sql"
    ],
    "commands": [
      "dos-m9-007-data"
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
      "apps/doctor-suit/tests/e2e/dos-m9-007.spec.ts"
    ],
    "commands": [
      "dos-m9-007-browser"
    ],
    "requires": [
      "browser"
    ]
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
- Create docs/work-packages/doctor-suit/implementation/dos-m9-007.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M9-008 — Optional-module acceptance and rollout

Verify chosen specialty/provider modules independently; telemedicine, AI diagnosis and hospital systems are not silently included.

Requirements
- DOS-M9-R001: Optional specialties and external provider integrations. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M9-F008: Verify chosen specialty/provider modules independently; telemedicine, AI diagnosis and hospital systems are not silently included. Acceptance: Verify each explicitly selected optional module independently using partner sandbox/contract and qualified specialty review on the exact candidate. Retain deferred/unavailable module IDs and list exclusions; do not claim telemedicine, AI diagnosis, hospital systems or universal provider coverage. Obtain separate rollout authorization per module with incident/recovery and compatibility evidence; this task does not deploy or purchase access.

Dependencies: DOS-M9-001, DOS-M9-002, DOS-M9-003, DOS-M9-004, DOS-M9-005, DOS-M9-006, DOS-M9-007
Blocking decisions: DOS-M9-GATE-START, DOS-M9-GATE-OPTIONAL, DOS-M9-GATE-MEDICATION, DOS-M9-GATE-LAB, DOS-M9-GATE-IMAGING, DOS-M9-GATE-PHARMACY, DOS-M9-GATE-INSURANCE, DOS-M9-GATE-EXCHANGE

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
- release-fragments/

Acceptance
1. Verify each explicitly selected optional module independently using partner sandbox/contract and qualified specialty review on the exact candidate.
2. Retain deferred/unavailable module IDs and list exclusions; do not claim telemedicine, AI diagnosis, hospital systems or universal provider coverage.
3. Obtain separate rollout authorization per module with incident/recovery and compatibility evidence; this task does not deploy or purchase access.

Verification scenarios
- Disable one optional connector during partner outage without weakening core clinical access or corrupting pending messages.
- Incomplete partner terms, failed identity reconciliation or absent clinical approval blocks that module while preserving unrelated accepted evidence.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m9-008.md
- apps/doctor-suit/tests/unit/dos-m9-008.test.mjs
- apps/doctor-suit/supabase/tests/dos-m9-008.sql
- apps/doctor-suit/tests/e2e/dos-m9-008.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m9-008.test.mjs"
    ],
    "commands": [
      "dos-m9-008-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m9-008.sql"
    ],
    "commands": [
      "dos-m9-008-data"
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
      "apps/doctor-suit/tests/e2e/dos-m9-008.spec.ts"
    ],
    "commands": [
      "dos-m9-008-browser"
    ],
    "requires": [
      "browser"
    ]
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
- Create docs/work-packages/doctor-suit/implementation/dos-m9-008.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
