# DOS-M6 — Doctor subscriptions and practice billing

10 tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `DOS-M6.json` and `DOS-M6.import-proposal.json`.

Milestone prerequisites: DOS-M1, DOS-M3. Every task also has an open blocking start decision.

## DOS-M6-001 — Doctor subscription and commercial-policy decisions

Approve per-doctor plans, prices, trial, locations/staff limits, refunds and expiry; invent no commercial values.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F001: Approve per-doctor plans, prices, trial, locations/staff limits, refunds and expiry; invent no commercial values. Acceptance: Obtain explicit per-doctor plan, price/currency, trial, staff/location quota, renewal, grace/expiry, refund and cancellation decisions without filling commercial values from another Suit. Define doctor as subscriber and secretary as independently invited staff; separate subscription entitlement from practice patient billing. Approve preservation/access behavior on expiry and downgrade; historical clinical/financial records are never deleted to enforce a plan. Prepare evidence for DOS-M6-GATE-COMMERCIAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M1-020, DOS-M3-010
Blocking decisions: DOS-M6-GATE-START

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/

Acceptance
1. Obtain explicit per-doctor plan, price/currency, trial, staff/location quota, renewal, grace/expiry, refund and cancellation decisions without filling commercial values from another Suit.
2. Define doctor as subscriber and secretary as independently invited staff; separate subscription entitlement from practice patient billing.
3. Approve preservation/access behavior on expiry and downgrade; historical clinical/financial records are never deleted to enforce a plan.
4. Prepare evidence for DOS-M6-GATE-COMMERCIAL. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Review doctor-alone, multiple locations, shared secretary, downgrade-over-quota and failed renewal cases.
- Missing price/trial/provider evidence keeps checkout/paid claims unavailable; no invented default offer is published.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-001.md

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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-001.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M6-002 — Entitlement and usage enforcement

Implement backend quotas/idempotency with clear read/write behavior and no historical record deletion on expiry.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F002: Implement backend quotas/idempotency with clear read/write behavior and no historical record deletion on expiry. Acceptance: Evaluate entitlements and quota mutations server-side from trusted current subscription state, with atomic allocation and idempotency. Implement approved write/read/export behavior for trial, active, past-due, cancelled and expired states without erasing history or blocking safety-critical access by assumption. Return explicit entitlement errors and usage totals scoped to doctor practice; client metadata and hidden buttons cannot grant paid capabilities.

Dependencies: DOS-M6-001
Blocking decisions: DOS-M6-GATE-START, DOS-M6-GATE-COMMERCIAL

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
1. Evaluate entitlements and quota mutations server-side from trusted current subscription state, with atomic allocation and idempotency.
2. Implement approved write/read/export behavior for trial, active, past-due, cancelled and expired states without erasing history or blocking safety-critical access by assumption.
3. Return explicit entitlement errors and usage totals scoped to doctor practice; client metadata and hidden buttons cannot grant paid capabilities.

Verification scenarios
- Concurrent location/staff creation at the limit never exceeds approved quota.
- Replayed subscription events, stale cache and forged client plan cannot restore expired writes or delete historical records.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-002.md
- apps/doctor-suit/tests/unit/dos-m6-002.test.mjs
- apps/doctor-suit/supabase/tests/dos-m6-002.sql
- apps/doctor-suit/tests/e2e/dos-m6-002.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m6-002.test.mjs"
    ],
    "commands": [
      "dos-m6-002-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m6-002.sql"
    ],
    "commands": [
      "dos-m6-002-data"
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
      "apps/doctor-suit/tests/e2e/dos-m6-002.spec.ts"
    ],
    "commands": [
      "dos-m6-002-browser"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-002.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M6-003 — Subscription checkout or approved manual-payment process

Use an approved payment route; never assume account/provider eligibility or reuse another product secret.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F003: Use an approved payment route; never assume account/provider eligibility or reuse another product secret. Acceptance: Choose an approved checkout or manual-payment route with verified account eligibility, currencies, cost/refund terms and server credentials ownership. Create server-side quote/payment intent from approved price/version and doctor subscriber identity; browser totals/return URLs are untrusted. Use only sandbox or synthetic manual evidence; no account creation, charges, paid API or production callback activation is included. Prepare evidence for DOS-M6-GATE-PAYMENT. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M6-002
Blocking decisions: DOS-M6-GATE-START, DOS-M6-GATE-COMMERCIAL

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
1. Choose an approved checkout or manual-payment route with verified account eligibility, currencies, cost/refund terms and server credentials ownership.
2. Create server-side quote/payment intent from approved price/version and doctor subscriber identity; browser totals/return URLs are untrusted.
3. Use only sandbox or synthetic manual evidence; no account creation, charges, paid API or production callback activation is included.
4. Prepare evidence for DOS-M6-GATE-PAYMENT. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Tamper with browser amount/currency/subscriber and reject before creating a trusted payment.
- Provider unavailable or unapproved route leaves checkout disabled with clear state, never fake success.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-003.md
- apps/doctor-suit/tests/unit/dos-m6-003.test.mjs
- apps/doctor-suit/supabase/tests/dos-m6-003.sql
- apps/doctor-suit/tests/e2e/dos-m6-003.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m6-003.test.mjs"
    ],
    "commands": [
      "dos-m6-003-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m6-003.sql"
    ],
    "commands": [
      "dos-m6-003-data"
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
      "apps/doctor-suit/tests/e2e/dos-m6-003.spec.ts"
    ],
    "commands": [
      "dos-m6-003-browser"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-003.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M6-004 — Payment confirmation and reconciliation

Use trusted payment evidence, duplicate-event handling and reconciliation; browser return is not authority.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F004: Use trusted payment evidence, duplicate-event handling and reconciliation; browser return is not authority. Acceptance: Accept payment confirmation only through verified provider evidence or approved audited manual review, bound to payment intent, amount/currency and subscriber. Persist duplicate/out-of-order event handling, idempotent entitlement update and reconciliation of pending/unknown outcomes. Verify callback authentication and replay protection; retain financial history and exclude sensitive payment data from logs.

Dependencies: DOS-M6-003
Blocking decisions: DOS-M6-GATE-START, DOS-M6-GATE-COMMERCIAL, DOS-M6-GATE-PAYMENT

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
1. Accept payment confirmation only through verified provider evidence or approved audited manual review, bound to payment intent, amount/currency and subscriber.
2. Persist duplicate/out-of-order event handling, idempotent entitlement update and reconciliation of pending/unknown outcomes.
3. Verify callback authentication and replay protection; retain financial history and exclude sensitive payment data from logs.

Verification scenarios
- Receive success before pending, duplicate success and crash after financial write; reconcile one payment and entitlement effect.
- Forged signature, wrong currency/amount and browser success redirect cannot mark subscription paid.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-004.md
- apps/doctor-suit/tests/unit/dos-m6-004.test.mjs
- apps/doctor-suit/supabase/tests/dos-m6-004.sql
- apps/doctor-suit/tests/e2e/dos-m6-004.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m6-004.test.mjs"
    ],
    "commands": [
      "dos-m6-004-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m6-004.sql"
    ],
    "commands": [
      "dos-m6-004-data"
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
      "apps/doctor-suit/tests/e2e/dos-m6-004.spec.ts"
    ],
    "commands": [
      "dos-m6-004-browser"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-004.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M6-005 — Renewal, cancellation and subscription settings

Provide auditable lifecycle changes and accurate doctor-facing billing state.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F005: Provide auditable lifecycle changes and accurate doctor-facing billing state. Acceptance: Implement approved renewal/cancel/reactivate lifecycle with effective dates, current plan/version and explicit customer acknowledgement. Separate requested cancellation from effective expiry and provider confirmation; retain invoices/payment history and auditable changes. Show accurate current, pending and failed billing state, retry safely and preserve allowed record access under expiry policy.

Dependencies: DOS-M6-004
Blocking decisions: DOS-M6-GATE-START, DOS-M6-GATE-COMMERCIAL, DOS-M6-GATE-PAYMENT

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
1. Implement approved renewal/cancel/reactivate lifecycle with effective dates, current plan/version and explicit customer acknowledgement.
2. Separate requested cancellation from effective expiry and provider confirmation; retain invoices/payment history and auditable changes.
3. Show accurate current, pending and failed billing state, retry safely and preserve allowed record access under expiry policy.

Verification scenarios
- Race renewal confirmation with cancellation and reconcile the approved effective state once.
- Retry failed cancellation and downgrade while over quota without deleting records or charging twice.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-005.md
- apps/doctor-suit/tests/unit/dos-m6-005.test.mjs
- apps/doctor-suit/supabase/tests/dos-m6-005.sql
- apps/doctor-suit/tests/e2e/dos-m6-005.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m6-005.test.mjs"
    ],
    "commands": [
      "dos-m6-005-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m6-005.sql"
    ],
    "commands": [
      "dos-m6-005-data"
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
      "apps/doctor-suit/tests/e2e/dos-m6-005.spec.ts"
    ],
    "commands": [
      "dos-m6-005-browser"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-005.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M6-006 — Practice service prices and visit charges

Define doctor/location services and patient charges separately from the SaaS subscription.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F006: Define doctor/location services and patient charges separately from the SaaS subscription. Acceptance: Define doctor/location service price records and effective versions separately from SaaS plans; persist patient charge snapshot and currency. Authorize charge creation/correction with links to visit/service and accountable actor; later price changes never rewrite an existing charge. Use exact monetary arithmetic and explicit rounding/discount approval rules; tax applicability remains gated.

Dependencies: DOS-M6-005
Blocking decisions: DOS-M6-GATE-START, DOS-M6-GATE-COMMERCIAL, DOS-M6-GATE-PAYMENT

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
1. Define doctor/location service price records and effective versions separately from SaaS plans; persist patient charge snapshot and currency.
2. Authorize charge creation/correction with links to visit/service and accountable actor; later price changes never rewrite an existing charge.
3. Use exact monetary arithmetic and explicit rounding/discount approval rules; tax applicability remains gated.

Verification scenarios
- Change a service price after a charge and prove historical totals remain stable.
- Reject cross-practice visit references, stale charge updates and unauthorized price/discount changes.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-006.md
- apps/doctor-suit/tests/unit/dos-m6-006.test.mjs
- apps/doctor-suit/supabase/tests/dos-m6-006.sql
- apps/doctor-suit/tests/e2e/dos-m6-006.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m6-006.test.mjs"
    ],
    "commands": [
      "dos-m6-006-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m6-006.sql"
    ],
    "commands": [
      "dos-m6-006-data"
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
      "apps/doctor-suit/tests/e2e/dos-m6-006.spec.ts"
    ],
    "commands": [
      "dos-m6-006-browser"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-006.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M6-007 — Collections, receipts and refunds

Implement atomic patient-payment/receipt/refund flows with appropriate approvals and immutable financial history.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F007: Implement atomic patient-payment/receipt/refund flows with appropriate approvals and immutable financial history. Acceptance: Post patient collections, allocations, receipt numbers and refunds atomically with idempotency, exact amounts and approved authorization. Preserve immutable financial entries and link corrections/refunds to originals; no destructive edit/delete of paid history. Prevent over-allocation and over-refund under concurrency, record pending/unknown external outcomes and reconcile before retrying money movement.

Dependencies: DOS-M6-006
Blocking decisions: DOS-M6-GATE-START, DOS-M6-GATE-COMMERCIAL, DOS-M6-GATE-PAYMENT

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
1. Post patient collections, allocations, receipt numbers and refunds atomically with idempotency, exact amounts and approved authorization.
2. Preserve immutable financial entries and link corrections/refunds to originals; no destructive edit/delete of paid history.
3. Prevent over-allocation and over-refund under concurrency, record pending/unknown external outcomes and reconcile before retrying money movement.

Verification scenarios
- Two concurrent refunds cannot exceed the refundable balance; duplicate request creates one reversal.
- Partial payment, refund failure and cancelled visit reconcile to source entries without a false paid/settled state.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-007.md
- apps/doctor-suit/tests/unit/dos-m6-007.test.mjs
- apps/doctor-suit/supabase/tests/dos-m6-007.sql
- apps/doctor-suit/tests/e2e/dos-m6-007.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m6-007.test.mjs"
    ],
    "commands": [
      "dos-m6-007-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m6-007.sql"
    ],
    "commands": [
      "dos-m6-007-data"
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
      "apps/doctor-suit/tests/e2e/dos-m6-007.spec.ts"
    ],
    "commands": [
      "dos-m6-007-browser"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-007.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M6-008 — Egypt tax-document applicability and adapter decision

Obtain qualified applicability review and verify required official integration before any compliance claim.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F008: Obtain qualified applicability review and verify required official integration before any compliance claim. Acceptance: Obtain qualified current Egypt tax-document applicability review for the exact business model, entity and service types; do not infer exemption or obligation. Record any required official interface/version, enrollment, credentials custody, environment and legal invoice/receipt fields from verified sources. If applicable, specify separately approved adapter/test requirements; absent evidence prohibits compliance badges or production tax submissions. Prepare evidence for DOS-M6-GATE-TAX. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M6-007
Blocking decisions: DOS-M6-GATE-START, DOS-M6-GATE-COMMERCIAL, DOS-M6-GATE-PAYMENT

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/

Acceptance
1. Obtain qualified current Egypt tax-document applicability review for the exact business model, entity and service types; do not infer exemption or obligation.
2. Record any required official interface/version, enrollment, credentials custody, environment and legal invoice/receipt fields from verified sources.
3. If applicable, specify separately approved adapter/test requirements; absent evidence prohibits compliance badges or production tax submissions.
4. Prepare evidence for DOS-M6-GATE-TAX. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Review separate SaaS subscription and patient practice collection documents rather than treating them as one taxpayer ledger.
- Unsupported official API access or unresolved applicability leaves the tax adapter and compliance claims blocked.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-008.md

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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-008.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M6-009 — Revenue and settlement reporting

Reconcile practice revenue, outstanding balances and SaaS billing views to their distinct ledgers.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F009: Reconcile practice revenue, outstanding balances and SaaS billing views to their distinct ledgers. Acceptance: Reconcile practice charges/collections/refunds/outstanding balances to their own immutable entries, separately from SaaS invoices/settlements. Use explicit date/status/currency definitions, scoped full-population queries and stable trace links from every report total to source. Show pending settlements/refunds and discrepancies; never net different currencies or equate provider payout with patient revenue.

Dependencies: DOS-M6-008
Blocking decisions: DOS-M6-GATE-START, DOS-M6-GATE-COMMERCIAL, DOS-M6-GATE-PAYMENT, DOS-M6-GATE-TAX

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
1. Reconcile practice charges/collections/refunds/outstanding balances to their own immutable entries, separately from SaaS invoices/settlements.
2. Use explicit date/status/currency definitions, scoped full-population queries and stable trace links from every report total to source.
3. Show pending settlements/refunds and discrepancies; never net different currencies or equate provider payout with patient revenue.

Verification scenarios
- Compare report totals against a synthetic ledger containing partial payments, refunds and delayed settlement.
- Test date boundaries, pagination and secretary permissions without leaking another practice or SaaS payer details.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-009.md
- apps/doctor-suit/tests/unit/dos-m6-009.test.mjs
- apps/doctor-suit/supabase/tests/dos-m6-009.sql
- apps/doctor-suit/tests/e2e/dos-m6-009.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m6-009.test.mjs"
    ],
    "commands": [
      "dos-m6-009-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m6-009.sql"
    ],
    "commands": [
      "dos-m6-009-data"
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
      "apps/doctor-suit/tests/e2e/dos-m6-009.spec.ts"
    ],
    "commands": [
      "dos-m6-009-browser"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-009.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M6-010 — Financial and commercial acceptance

Verify concurrency, reconciliation, refunds, entitlements and separately approved commercial launch policy.

Requirements
- DOS-M6-R001: Doctor subscriptions and practice billing. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M6-F010: Verify concurrency, reconciliation, refunds, entitlements and separately approved commercial launch policy. Acceptance: Verify plan/entitlement/checkout-confirmation/renewal and practice-charge/payment/refund/report journeys on the exact synthetic candidate. Obtain independent financial review of concurrency, rounding, reconciliation and required commercial/tax decisions. Record commercial launch as separately unapproved until actual owner/provider evidence exists; no real money or production billing is exercised here.

Dependencies: DOS-M6-001, DOS-M6-002, DOS-M6-003, DOS-M6-004, DOS-M6-005, DOS-M6-006, DOS-M6-007, DOS-M6-008, DOS-M6-009
Blocking decisions: DOS-M6-GATE-START, DOS-M6-GATE-COMMERCIAL, DOS-M6-GATE-PAYMENT, DOS-M6-GATE-TAX

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
1. Verify plan/entitlement/checkout-confirmation/renewal and practice-charge/payment/refund/report journeys on the exact synthetic candidate.
2. Obtain independent financial review of concurrency, rounding, reconciliation and required commercial/tax decisions.
3. Record commercial launch as separately unapproved until actual owner/provider evidence exists; no real money or production billing is exercised here.

Verification scenarios
- Inject duplicate/out-of-order provider callbacks, refund races and interrupted reconciliation across the full journey.
- Reconcile every financial total and entitlement change to immutable source evidence; unresolved discrepancies block acceptance.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m6-010.md
- apps/doctor-suit/tests/unit/dos-m6-010.test.mjs
- apps/doctor-suit/supabase/tests/dos-m6-010.sql
- apps/doctor-suit/tests/e2e/dos-m6-010.spec.ts

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
      "apps/doctor-suit/tests/unit/dos-m6-010.test.mjs"
    ],
    "commands": [
      "dos-m6-010-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m6-010.sql"
    ],
    "commands": [
      "dos-m6-010-data"
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
      "apps/doctor-suit/tests/e2e/dos-m6-010.spec.ts"
    ],
    "commands": [
      "dos-m6-010-browser"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m6-010.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
