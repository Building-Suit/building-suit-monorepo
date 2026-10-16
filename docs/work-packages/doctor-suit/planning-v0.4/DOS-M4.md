# DOS-M4 — Doctor and secretary mobile experience

10 tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `DOS-M4.json` and `DOS-M4.import-proposal.json`.

Milestone prerequisites: DOS-M2. Every task also has an open blocking start decision.

## DOS-M4-001 — Mobile platform and distribution decision

Approve Android/iOS scope, framework, device support and deployment/cost policy; no silent framework adoption.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F001: Approve Android/iOS scope, framework, device support and deployment/cost policy; no silent framework adoption. Acceptance: Approve Android/iOS or other explicitly selected scope, supported device/OS matrix, framework, renderer and distribution method with owner and cost responsibility. Record an architecture decision for native rendering versus current web-only shared templates, package boundaries, secure storage, accessibility and exact build/device verification commands. Name reserved source paths and test harness ownership; no scaffold, platform account, signing certificate, store purchase or framework install precedes this decision. Prepare evidence for DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Dependencies: DOS-M2-014
Blocking decisions: DOS-M4-GATE-START

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/

Acceptance
1. Approve Android/iOS or other explicitly selected scope, supported device/OS matrix, framework, renderer and distribution method with owner and cost responsibility.
2. Record an architecture decision for native rendering versus current web-only shared templates, package boundaries, secure storage, accessibility and exact build/device verification commands.
3. Name reserved source paths and test harness ownership; no scaffold, platform account, signing certificate, store purchase or framework install precedes this decision.
4. Prepare evidence for DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE. Stop before any provider/native/live-data dependent implementation until the accountable reviewer approves the relevant decision; producing this packet does not grant approval.

Verification scenarios
- Compare candidate platform support against required doctor/secretary workflows and offline constraints.
- A missing device runner, unsupported OS or unsigned distribution policy keeps implementation admission blocked.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-001.md

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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-001.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M4-002 — Mobile app shell and shared contracts

Implement approved mobile navigation/contracts while preserving product-owned backend authorization.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F002: Implement approved mobile navigation/contracts while preserving product-owned backend authorization. Acceptance: Create the approved mobile entry/navigation shell with explicit doctor/practice/location context and typed versioned backend contracts. Preserve application-owned data adapters and server authorization; shared pure contracts never import the mobile application. Provide loading, signed-out, permission-denied, offline and recoverable-error states; a shell route cannot expose clinical data before context validation. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M4-001
Blocking decisions: DOS-M4-GATE-START, DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/doctor/
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
1. Create the approved mobile entry/navigation shell with explicit doctor/practice/location context and typed versioned backend contracts.
2. Preserve application-owned data adapters and server authorization; shared pure contracts never import the mobile application.
3. Provide loading, signed-out, permission-denied, offline and recoverable-error states; a shell route cannot expose clinical data before context validation.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Cold start via deep link without a session returns safe authentication and then the intended authorized screen.
- Reject unsupported server contract versions and stale context responses without showing another practice.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-002.md
- apps/doctor-suit/tests/unit/dos-m4-002.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m4-002-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m4-002.test.mjs"
    ],
    "commands": [
      "dos-m4-002-unit"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-002.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M4-003 — Mobile authentication and session lifecycle

Implement secure storage/session expiry/logout and account recovery for the chosen platform.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F003: Implement secure storage/session expiry/logout and account recovery for the chosen platform. Acceptance: Use the approved platform secure storage and product/environment-specific session namespace; never store privileged backend keys. Implement login/recovery/refresh/expiry/logout and server revocation with clear pending/failure states and permitted redirect/deep-link targets. Clear protected caches and pending drafts according to the approved policy on logout/account change/device loss; biometric unlock is not fresh server authorization. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M4-002
Blocking decisions: DOS-M4-GATE-START, DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/doctor/
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
1. Use the approved platform secure storage and product/environment-specific session namespace; never store privileged backend keys.
2. Implement login/recovery/refresh/expiry/logout and server revocation with clear pending/failure states and permitted redirect/deep-link targets.
3. Clear protected caches and pending drafts according to the approved policy on logout/account change/device loss; biometric unlock is not fresh server authorization.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Expired refresh, revoked session and device lock/unlock cannot leave an authenticated-looking usable chart.
- Test malicious deep links, reinstall and account switching for credential/cache leakage.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-003.md
- apps/doctor-suit/tests/unit/dos-m4-003.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m4-003-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m4-003.test.mjs"
    ],
    "commands": [
      "dos-m4-003-unit"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-003.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M4-004 — Doctor/practice/location and employee context

Support clear scoped context switching with immediate cache/draft invalidation.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F004: Support clear scoped context switching with immediate cache/draft invalidation. Acceptance: Resolve doctor memberships and location grants from the server and display active practice/location on every protected mobile flow. Cancel inflight queries, discard stale responses and clear sensitive state when context changes; unsaved edits require safe explicit handling. One secretary may switch independent doctor memberships without gaining subscriber or signing authority. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M4-003
Blocking decisions: DOS-M4-GATE-START, DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/doctor/
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
1. Resolve doctor memberships and location grants from the server and display active practice/location on every protected mobile flow.
2. Cancel inflight queries, discard stale responses and clear sensitive state when context changes; unsaved edits require safe explicit handling.
3. One secretary may switch independent doctor memberships without gaining subscriber or signing authority.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Switch Doctor A to B while A network response is delayed and verify no A record appears in B.
- Revoke one location grant while retaining another and verify only the affected access is removed.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-004.md
- apps/doctor-suit/tests/unit/dos-m4-004.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m4-004-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m4-004.test.mjs"
    ],
    "commands": [
      "dos-m4-004-unit"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-004.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M4-005 — Patient directory and profile on mobile

Deliver fast authorized patient lookup, profile and document access with failure states.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F005: Deliver fast authorized patient lookup, profile and document access with failure states. Acceptance: Support authorized patient search/pagination/profile and private document retrieval using the same patient-relationship IDs as web. Minimize local cached data under the approved policy; downloads and previews require current permission and contain no public object URLs. Preserve readable English/Arabic names, explicit provenance and empty/denied/error states without matching contacts to identity. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M4-004
Blocking decisions: DOS-M4-GATE-START, DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/doctor/
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
1. Support authorized patient search/pagination/profile and private document retrieval using the same patient-relationship IDs as web.
2. Minimize local cached data under the approved policy; downloads and previews require current permission and contain no public object URLs.
3. Preserve readable English/Arabic names, explicit provenance and empty/denied/error states without matching contacts to identity.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Shared-contact patients remain separate; outsider and revoked membership requests are denied.
- Open a document then switch account or lose connectivity and verify approved cache expiry/cleanup.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-005.md
- apps/doctor-suit/tests/unit/dos-m4-005.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m4-005-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m4-005.test.mjs"
    ],
    "commands": [
      "dos-m4-005-unit"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-005.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M4-006 — Mobile clinical notes and encounter workflow

Allow doctor-authored encounter updates with tested conflict/unsaved-state handling.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F006: Allow doctor-authored encounter updates with tested conflict/unsaved-state handling. Acceptance: Edit clinician-authored encounters through the same versioned state-transition APIs as web; mobile cannot invent extra transition authority. Persist only drafts allowed by the offline policy and show unsent state distinctly; finalized content cannot be edited in place. Resolve concurrent web/mobile edits explicitly with preserved provenance; no last-write-wins overwrite of clinical data. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-014, DOS-M4-005
Blocking decisions: DOS-M4-GATE-START, DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/doctor/
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
1. Edit clinician-authored encounters through the same versioned state-transition APIs as web; mobile cannot invent extra transition authority.
2. Persist only drafts allowed by the offline policy and show unsent state distinctly; finalized content cannot be edited in place.
3. Resolve concurrent web/mobile edits explicitly with preserved provenance; no last-write-wins overwrite of clinical data.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Race a web finalization with a mobile draft save and surface a conflict without data loss.
- Background/terminate during a save, relaunch and reconcile acknowledgement before retry.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-006.md
- apps/doctor-suit/tests/unit/dos-m4-006.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m4-006-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m4-006.test.mjs"
    ],
    "commands": [
      "dos-m4-006-unit"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-006.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M4-007 — Mobile prescription authoring and review

Provide safe structured prescribing and signing using the same authoritative clinical contracts.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F007: Provide safe structured prescribing and signing using the same authoritative clinical contracts. Acceptance: Render structured prescription fields and full review summary from M2 contracts without defaulting clinical values or recommending doses. Signing uses current accountable clinician authorization, immutable server versions and explicit confirmation of the exact draft. Stopped/amended prescriptions refresh promptly and any stale cached signing action fails closed. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M2-014, DOS-M4-006
Blocking decisions: DOS-M4-GATE-START, DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/doctor/
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
1. Render structured prescription fields and full review summary from M2 contracts without defaulting clinical values or recommending doses.
2. Signing uses current accountable clinician authorization, immutable server versions and explicit confirmation of the exact draft.
3. Stopped/amended prescriptions refresh promptly and any stale cached signing action fails closed.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Web amendment during mobile review causes a version conflict and requires new review.
- Attempt signing as secretary, offline device and revoked doctor; no signed version is created.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-007.md
- apps/doctor-suit/tests/unit/dos-m4-007.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m4-007-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m4-007.test.mjs"
    ],
    "commands": [
      "dos-m4-007-unit"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-007.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M4-008 — Mobile schedule and staff operations

Deliver appointments/queue and delegated secretary actions without permission widening.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F008: Deliver appointments/queue and delegated secretary actions without permission widening. Acceptance: Provide schedule, check-in and queue actions with practice/location attribution and the same cross-location conflict rules as web. Respect independent secretary capabilities and membership changes for every action, not only visible navigation. Reconcile retry/reconnect and concurrent staff edits from server acknowledgements without duplicate appointments or queue entries. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M4-007
Blocking decisions: DOS-M4-GATE-START, DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/doctor/
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
1. Provide schedule, check-in and queue actions with practice/location attribution and the same cross-location conflict rules as web.
2. Respect independent secretary capabilities and membership changes for every action, not only visible navigation.
3. Reconcile retry/reconnect and concurrent staff edits from server acknowledgements without duplicate appointments or queue entries.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Two devices reschedule/check in one appointment concurrently and preserve a consistent state.
- Test narrow screens, RTL, denied action and stale queue recovery on approved devices.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-008.md
- apps/doctor-suit/tests/unit/dos-m4-008.test.mjs
- docs/work-packages/doctor-suit/implementation/dos-m4-008-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m4-008.test.mjs"
    ],
    "commands": [
      "dos-m4-008-unit"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-008.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M4-009 — Connectivity and offline policy implementation

Implement only the approved offline/cache policy; define conflicts, device loss and expiring local sensitive data.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F009: Implement only the approved offline/cache policy; define conflicts, device loss and expiring local sensitive data. Acceptance: Approve which data may be cached or drafted offline, expiry, encryption, device-loss response and permitted reconciliation behavior; default to no offline signing. Implement explicit cache lifecycle and conflict rules with server version/authorization revalidation; never upload a revoked or cross-practice pending draft silently. Document unsupported offline actions and purge evidence; no promise of full offline clinical operation. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M4-008
Blocking decisions: DOS-M4-GATE-START, DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/doctor/
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
1. Approve which data may be cached or drafted offline, expiry, encryption, device-loss response and permitted reconciliation behavior; default to no offline signing.
2. Implement explicit cache lifecycle and conflict rules with server version/authorization revalidation; never upload a revoked or cross-practice pending draft silently.
3. Document unsupported offline actions and purge evidence; no promise of full offline clinical operation.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Lose network before and after acknowledgement, change device clock and revoke membership before reconnect.
- Verify cache expiry, logout cleanup and encrypted storage behavior on each supported platform.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-009.md
- apps/doctor-suit/tests/unit/dos-m4-009.test.mjs
- apps/doctor-suit/supabase/tests/dos-m4-009.sql
- docs/work-packages/doctor-suit/implementation/dos-m4-009-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m4-009.test.mjs"
    ],
    "commands": [
      "dos-m4-009-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m4-009.sql"
    ],
    "commands": [
      "dos-m4-009-data"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-009.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.

## DOS-M4-010 — Device and mobile release-candidate verification

Verify real-device journeys, accessibility, security and distribution prerequisites without publishing automatically.

Requirements
- DOS-M4-R001: Doctor and secretary mobile experience. Synthetic-only implementation; retain doctor ownership, independent secretary grants and separate patient identity/relationship/encounter; no clinical/legal/provider/commercial authority inferred.
- DOS-M4-F010: Verify real-device journeys, accessibility, security and distribution prerequisites without publishing automatically. Acceptance: Run the approved real-device matrix for authentication, context, charts, notes, prescription review and delegated schedule workflows. Record exact app build, backend candidate, OS/device versions, permissions, accessibility and security results; simulators alone cannot prove device behavior. Verify distribution/signing prerequisites and remaining issues without uploading to stores or releasing; mobile launch requires M7 acceptance too. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Dependencies: DOS-M4-001, DOS-M4-002, DOS-M4-003, DOS-M4-004, DOS-M4-005, DOS-M4-006, DOS-M4-007, DOS-M4-008, DOS-M4-009
Blocking decisions: DOS-M4-GATE-START, DOS-M4-GATE-PLATFORM, DOS-M4-GATE-OFFLINE

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/i18n/
- apps/doctor-suit/mobile/doctor/
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
1. Run the approved real-device matrix for authentication, context, charts, notes, prescription review and delegated schedule workflows.
2. Record exact app build, backend candidate, OS/device versions, permissions, accessibility and security results; simulators alone cannot prove device behavior.
3. Verify distribution/signing prerequisites and remaining issues without uploading to stores or releasing; mobile launch requires M7 acceptance too.
4. Use only the explicitly approved platform/renderer and registered build/device test commands. The reserved mobile path grants no framework choice; re-review the packet and registration after the platform decision, before native implementation.

Verification scenarios
- Exercise background/kill/relaunch, network loss, storage cleanup and conflicting web/mobile writes.
- Independent reviewer traces each M4 task and unrun device scenario; missing evidence blocks mobile acceptance.

Expected outputs
- docs/work-packages/doctor-suit/implementation/dos-m4-010.md
- apps/doctor-suit/tests/unit/dos-m4-010.test.mjs
- apps/doctor-suit/supabase/tests/dos-m4-010.sql
- docs/work-packages/doctor-suit/implementation/dos-m4-010-device-evidence.json

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
      "apps/doctor-suit/tests/unit/dos-m4-010.test.mjs"
    ],
    "commands": [
      "dos-m4-010-unit"
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
      "apps/doctor-suit/supabase/tests/dos-m4-010.sql"
    ],
    "commands": [
      "dos-m4-010-data"
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
- Create docs/work-packages/doctor-suit/implementation/dos-m4-010.md with the task decisions, API/state contract, scenarios and evidence references; text alone is not a passing product test.
- Retain the supplied roadmap objective and stable ID; record new decisions without replacing historical execution states.
