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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- release-fragments/

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
- Create docs/work-packages/doctor-suit/implementation/dos-m3-010.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
