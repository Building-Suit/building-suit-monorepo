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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- Create docs/work-packages/doctor-suit/implementation/dos-m8-008.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
