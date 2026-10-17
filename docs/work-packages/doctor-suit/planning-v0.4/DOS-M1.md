# DOS-M1 — Website and doctor/secretary web foundation

20 tasks. Prepared for review; not imported or admitted. Source and import fingerprints are in `DOS-M1.json` and `DOS-M1.import-proposal.json`.

Milestone prerequisites: none. Every task also has an open blocking start decision.

## DOS-M1-001 — Website scope, user journeys and implementation contract

Produce the implementation-facing website specification from this intake and the inspected repository rules. Reconcile any recovered Clinic Suit IDs/history before assigning replacements. Separate the public site, doctor web portal and secretary web portal; mobile remains later.

Requirements
- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F001: Produce the implementation-facing website specification from this intake and the inspected repository rules. Reconcile any recovered Clinic Suit IDs/history before assigning replacements. Separate the public site, doctor web portal and secretary web portal; mobile remains later. Acceptance: Document the confirmed synthetic public-site and administrative doctor/secretary portal scope, authorized ordinary design choices and unresolved live/domain decisions separately. Describe doctor-alone and delegated workflows, multiple locations, multi-doctor secretaries, and persistent doctor ownership. Publish a route/template inventory, permission matrix, synthetic-data policy and traceable acceptance checklist; unresolved choices stay open. Identify the actual registered execution route and verification/publication gaps without changing runtime configuration or declaring compatibility.

Dependencies: none
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- docs/work-packages/doctor-suit/
- release-fragments/dos-m1-001.json
- tooling/checks/dos-m1-contract.test.mjs

Acceptance
1. Document the confirmed synthetic public-site and administrative doctor/secretary portal scope, authorized ordinary design choices and unresolved live/domain decisions separately.
2. Describe doctor-alone and delegated workflows, multiple locations, multi-doctor secretaries, and persistent doctor ownership.
3. Publish a route/template inventory, permission matrix, synthetic-data policy and traceable acceptance checklist; unresolved choices stay open.
4. Identify the actual registered execution route and verification/publication gaps without changing runtime configuration or declaring compatibility.

Verification scenarios
- Trace each supplied user outcome to the proposed milestones.
- Check recovered historical IDs for overlap; absence of old files must remain recorded.
- Review all navigation states with no fabricated product or legal claims.

Expected outputs
- docs/work-packages/doctor-suit/website-contract-v0.2.md
- tooling/checks/dos-m1-contract.test.mjs
- release-fragments/dos-m1-001.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute the traceable website contract regression; routine scope/document checks use independent automation, while genuine live-public approval remains separate.",
    "expected_outputs": [
      "docs/work-packages/doctor-suit/website-contract-v0.2.md",
      "tooling/checks/dos-m1-contract.test.mjs"
    ],
    "commands": [
      "dos-m1-001-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-001-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Document the confirmed synthetic public-site and administrative doctor/secretary portal scope, authorized ordinary design choices and unresolved live/domain decisions separately.",
    "procedure": "Compare the confirmed synthetic website/portal scope to the approval record and list remaining live decisions.",
    "test_case_name": "DOS-M1-001-C01",
    "required_outputs": [
      "tooling/checks/dos-m1-contract.test.mjs"
    ],
    "command_refs": [
      "dos-m1-001-unit"
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
    "case_id": "DOS-M1-001-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Describe doctor-alone and delegated workflows, multiple locations, multi-doctor secretaries, and persistent doctor ownership.",
    "procedure": "Validate the doctor-alone and shared-secretary journey records and their rendered diagrams; locate practice ownership at both locations.",
    "test_case_name": "DOS-M1-001-C02",
    "required_outputs": [
      "tooling/checks/dos-m1-contract.test.mjs"
    ],
    "command_refs": [
      "dos-m1-001-unit"
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
    "case_id": "DOS-M1-001-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Publish a route/template inventory, permission matrix, synthetic-data policy and traceable acceptance checklist; unresolved choices stay open.",
    "procedure": "Resolve each documented route to its template, capability and acceptance ID; reject missing or duplicate mappings.",
    "test_case_name": "DOS-M1-001-C03",
    "required_outputs": [
      "tooling/checks/dos-m1-contract.test.mjs"
    ],
    "command_refs": [
      "dos-m1-001-unit",
      "pnpm check"
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
    "case_id": "DOS-M1-001-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Identify the actual registered execution route and verification/publication gaps without changing runtime configuration or declaring compatibility.",
    "procedure": "Compare the routing gaps against parent-supplied registry evidence without asserting unobserved registration.",
    "test_case_name": "DOS-M1-001-C04",
    "required_outputs": [
      "tooling/checks/dos-m1-contract.test.mjs"
    ],
    "command_refs": [
      "dos-m1-001-unit"
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
    "case_id": "DOS-M1-001-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-001.json"
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
  "fragment_path": "release-fragments/dos-m1-001.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-002 — Doctor Suit web scaffold and workspace registration

Create the Doctor Suit app only after the target-repository decision. Use the maintained new-platform generator and shared Nuxt layer; add the minimal repository wiring needed for a local synthetic preview.

Requirements
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F002: Create the Doctor Suit app only after the target-repository decision. Use the maintained new-platform generator and shared Nuxt layer; add the minimal repository wiring needed for a local synthetic preview. Acceptance: Inspect pnpm new:platform doctor-suit "Doctor Suit" --dry-run before generation; do not copy another product app. Use BsAppRoot, shared layouts and one registered complete template per route with zero migration debt. Provide scoped AGENTS, environment examples with no values, app manifest, local-preview instructions and the minimum root registration diff. Do not provision a hosted project, choose unverified ports/domain/provider refs or activate a public release product. Create an app-local Playwright configuration and synthetic-browser fixture harness at apps/doctor-suit/tests/e2e/playwright.config.ts; select collision-free local ports and ensure remote backend URLs are rejected. The named control-plane command is registered separately by the authorized operator, not by this task.

Dependencies: DOS-M1-001
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- package.json
- packages/ui/package.json
- packages/ui/src/templates/
- pnpm-lock.yaml
- pnpm-workspace.yaml
- release-changes/items.json
- release-fragments/dos-m1-002.json
- turbo.json

Acceptance
1. Inspect pnpm new:platform doctor-suit "Doctor Suit" --dry-run before generation; do not copy another product app.
2. Use BsAppRoot, shared layouts and one registered complete template per route with zero migration debt.
3. Provide scoped AGENTS, environment examples with no values, app manifest, local-preview instructions and the minimum root registration diff.
4. Do not provision a hosted project, choose unverified ports/domain/provider refs or activate a public release product.
5. Create an app-local Playwright configuration and synthetic-browser fixture harness at apps/doctor-suit/tests/e2e/playwright.config.ts; select collision-free local ports and ensure remote backend URLs are rejected. The named control-plane command is registered separately by the authorized operator, not by this task.

Verification scenarios
- Run generator fixture/boundary checks and verify new routes are discovered.
- Build the app with placeholder-safe local configuration.
- Verify no Shop/Ledger imports, copied tenants, secrets or app-local component layer.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-002.test.mjs
- apps/doctor-suit/package.json
- apps/doctor-suit/tests/e2e/playwright.config.ts
- release-fragments/dos-m1-002.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-002.test.mjs"
    ],
    "commands": [
      "dos-m1-002-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check affected types",
    "command": "pnpm typecheck"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Lint code",
    "command": "pnpm lint"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Build the workspace candidate",
    "command": "pnpm build"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-002-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Inspect pnpm new:platform doctor-suit \"Doctor Suit\" --dry-run before generation; do not copy another product app.",
    "procedure": "Generate a disposable fixture from the maintained starter and compare its output inventory to the recorded dry run.",
    "test_case_name": "DOS-M1-002-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-002.test.mjs"
    ],
    "command_refs": [
      "dos-m1-002-unit"
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
    "case_id": "DOS-M1-002-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Use BsAppRoot, shared layouts and one registered complete template per route with zero migration debt.",
    "procedure": "Run strict route/template ownership checks on the generated app and reject app-local visual composition.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [
      "pnpm check"
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
    "case_id": "DOS-M1-002-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Provide scoped AGENTS, environment examples with no values, app manifest, local-preview instructions and the minimum root registration diff.",
    "procedure": "Validate the generated manifest, blank environment examples and local instructions; reject populated secrets or missing files.",
    "test_case_name": "DOS-M1-002-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-002.test.mjs"
    ],
    "command_refs": [
      "dos-m1-002-unit"
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
    "case_id": "DOS-M1-002-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Do not provision a hosted project, choose unverified ports/domain/provider refs or activate a public release product.",
    "procedure": "Inspect the scaffold diff and provider-action receipt list for any hosted resource, invented ref or activation.",
    "test_case_name": "DOS-M1-002-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-002.test.mjs"
    ],
    "command_refs": [
      "dos-m1-002-unit"
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
    "case_id": "DOS-M1-002-C05",
    "criterion_ids": [
      5
    ],
    "assertion": "Create an app-local Playwright configuration and synthetic-browser fixture harness at apps/doctor-suit/tests/e2e/playwright.config.ts; select collision-free local ports and ensure remote backend URLs are rejected. The named control-plane command is registered separately by the authorized operator, not by this task.",
    "procedure": "Pass remote URLs and colliding port fixtures to the browser harness and require rejection before any connection.",
    "test_case_name": "DOS-M1-002-C05",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-002.test.mjs"
    ],
    "command_refs": [
      "dos-m1-002-unit"
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
    "case_id": "DOS-M1-002-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-002.json"
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
  "fragment_path": "release-fragments/dos-m1-002.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-003 — Isolated practice identity and disposable data foundation

Implement the local Doctor Suit identity/practice/membership data boundary and disposable verification fixtures before protected web workflows. Treat the doctor practice as the ownership scope and locations as context.

Requirements
- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F003: Implement the local Doctor Suit identity/practice/membership data boundary and disposable verification fixtures before protected web workflows. Treat the doctor practice as the ownership scope and locations as context. Acceptance: Use an app-owned local Supabase root and forward migrations; production/staging refs remain unprovisioned. Separate user identity, doctor practice, location and membership; memberships do not confer cross-practice access. Every protected operation validates the server-side practice/context and auditable actor. Create deterministic synthetic fixtures for two doctors, shared secretary, two locations and an outsider; register no hosted writes. Record local-only collision-free project/port mapping and blank unprovisioned hosted entries; no credentials. Create the local data verification lifecycle and generated types; reject hosted targets in the browser fixture harness.

Dependencies: DOS-M1-002
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/architecture/environments.json
- docs/work-packages/doctor-suit/
- release-fragments/dos-m1-003.json

Acceptance
1. Use an app-owned local Supabase root and forward migrations; production/staging refs remain unprovisioned.
2. Separate user identity, doctor practice, location and membership; memberships do not confer cross-practice access.
3. Every protected operation validates the server-side practice/context and auditable actor.
4. Create deterministic synthetic fixtures for two doctors, shared secretary, two locations and an outsider; register no hosted writes.
5. Record local-only collision-free project/port mapping and blank unprovisioned hosted entries; no credentials. Create the local data verification lifecycle and generated types; reject hosted targets in the browser fixture harness.

Verification scenarios
- Test anonymous, doctor A, doctor B, secretary and outsider access with two simultaneous sessions.
- Reject client-supplied ownership and user-editable metadata escalation.
- Run the exact product-local migration/reset/test lifecycle in a disposable environment.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-003.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-003.sql
- release-fragments/dos-m1-003.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-003.test.mjs"
    ],
    "commands": [
      "dos-m1-003-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-003.sql"
    ],
    "commands": [
      "dos-m1-003-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-003-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Use an app-owned local Supabase root and forward migrations; production/staging refs remain unprovisioned.",
    "procedure": "Apply the forward chain to a fresh disposable Doctor database and verify app-owned objects without hosted refs.",
    "test_case_name": "DOS-M1-003-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-003.sql"
    ],
    "command_refs": [
      "dos-m1-003-data"
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
    "case_id": "DOS-M1-003-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Separate user identity, doctor practice, location and membership; memberships do not confer cross-practice access.",
    "procedure": "Use two doctors and a shared secretary to prove separate identity, practice, location and membership foreign keys and access.",
    "test_case_name": "DOS-M1-003-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-003.sql"
    ],
    "command_refs": [
      "dos-m1-003-data"
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
    "case_id": "DOS-M1-003-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Every protected operation validates the server-side practice/context and auditable actor.",
    "procedure": "Call protected reads/writes with forged practice and actor values; require denial and correct audit attribution.",
    "test_case_name": "DOS-M1-003-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-003.sql"
    ],
    "command_refs": [
      "dos-m1-003-data"
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
    "case_id": "DOS-M1-003-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Create deterministic synthetic fixtures for two doctors, shared secretary, two locations and an outsider; register no hosted writes.",
    "procedure": "Rebuild deterministic fixtures and assert exact actor/relationship counts plus outsider denials.",
    "test_case_name": "DOS-M1-003-C04",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-003.sql"
    ],
    "command_refs": [
      "dos-m1-003-data"
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
    "case_id": "DOS-M1-003-C05",
    "criterion_ids": [
      5
    ],
    "assertion": "Record local-only collision-free project/port mapping and blank unprovisioned hosted entries; no credentials. Create the local data verification lifecycle and generated types; reject hosted targets in the browser fixture harness.",
    "procedure": "Validate local-only environment mapping and harness target rejection; compare generated types to the local schema.",
    "test_case_name": "DOS-M1-003-C05",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-003.test.mjs"
    ],
    "command_refs": [
      "dos-m1-003-unit"
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
    "case_id": "DOS-M1-003-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-003.json"
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
  "fragment_path": "release-fragments/dos-m1-003.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-004 — Shared web shells and complete page-template contracts

Deliver the public and authenticated web shells through shared presentation templates, including explicit doctor/practice/location context, navigation and reliable interaction states.

Requirements
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F004: Deliver the public and authenticated web shells through shared presentation templates, including explicit doctor/practice/location context, navigation and reliable interaction states. Acceptance: All new visual composition is exported from packages/ui; product queries remain in Doctor Suit adapters. The active doctor/practice/location is persistently clear; switching context clears sensitive caches and drafts. Navigation, keyboard/focus, dirty-state warnings, loading/empty/error/denied states work from the first slice. Verify English/Arabic, LTR/RTL and light/dark shell behavior at 390px and 1280px viewports through the existing repository infrastructure; all navigation and dialog actions remain reachable with correct direction and visible focus.

Dependencies: DOS-M1-002
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-004.json

Acceptance
1. All new visual composition is exported from packages/ui; product queries remain in Doctor Suit adapters.
2. The active doctor/practice/location is persistently clear; switching context clears sensitive caches and drafts.
3. Navigation, keyboard/focus, dirty-state warnings, loading/empty/error/denied states work from the first slice.
4. Verify English/Arabic, LTR/RTL and light/dark shell behavior at 390px and 1280px viewports through the existing repository infrastructure; all navigation and dialog actions remain reachable with correct direction and visible focus.

Verification scenarios
- Exercise context switches with unsaved data and stale async responses.
- Run strict template boundaries and affected shared-component checks.
- Preview narrow mobile browser and desktop without hidden actions or keyboard traps.
- Playwright drives Tab/Shift+Tab and Escape through shell navigation and dialogs, asserts focus trap/return, rejects accidental dirty-state dismissal and verifies explicit discard.
- Render EN/AR × light/dark × 390px/1280px; assert navigation reachability, direction, active doctor/location visibility and no horizontal overflow.
- Delay the previous-context request, switch practices and verify the late response and old draft never appear in the newly selected context.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-004.test.mjs
- apps/doctor-suit/tests/e2e/dos-m1-004.spec.ts
- release-fragments/dos-m1-004.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-004.test.mjs"
    ],
    "commands": [
      "dos-m1-004-unit"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check affected types",
    "command": "pnpm typecheck"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Lint code",
    "command": "pnpm lint"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Build the workspace candidate",
    "command": "pnpm build"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Exercise real browser shell keyboard/focus, dirty-state, context-switch and EN/AR responsive behavior",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-004.spec.ts"
    ],
    "commands": [
      "dos-m1-004-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-004-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "All new visual composition is exported from packages/ui; product queries remain in Doctor Suit adapters.",
    "procedure": "Verify each shell/route uses an exported shared template and no product query exists in shared UI.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [
      "pnpm check"
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
    "case_id": "DOS-M1-004-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "The active doctor/practice/location is persistently clear; switching context clears sensitive caches and drafts.",
    "procedure": "Delay the old-context response, switch doctor/location and assert that cache, pending draft and rendered identity belong only to the new context.",
    "test_case_name": "DOS-M1-004-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-004.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m1-004.spec.ts"
    ],
    "command_refs": [
      "dos-m1-004-unit",
      "dos-m1-004-browser"
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
    "case_id": "DOS-M1-004-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Navigation, keyboard/focus, dirty-state warnings, loading/empty/error/denied states work from the first slice.",
    "procedure": "Drive Tab/Shift+Tab and Escape through navigation/dialogs; assert focus trap/return, explicit dirty discard and loading/empty/error/denied states.",
    "test_case_name": "DOS-M1-004-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-004.spec.ts"
    ],
    "command_refs": [
      "dos-m1-004-browser"
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
    "case_id": "DOS-M1-004-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Verify English/Arabic, LTR/RTL and light/dark shell behavior at 390px and 1280px viewports through the existing repository infrastructure; all navigation and dialog actions remain reachable with correct direction and visible focus.",
    "procedure": "Run EN/AR × light/dark × 390px/1280px; assert dir, reachable navigation, persistent context, visible focus and no horizontal overflow.",
    "test_case_name": "DOS-M1-004-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-004.spec.ts"
    ],
    "command_refs": [
      "dos-m1-004-browser"
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
    "case_id": "DOS-M1-004-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-004.json"
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
  "fragment_path": "release-fragments/dos-m1-004.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-005 — Public product website and truthful feature presentation

Build the Doctor Suit public homepage and product explanation around the doctor-across-clinics model using the shared landing template.

Requirements
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F005: Build the Doctor Suit public homepage and product explanation around the doctor-across-clinics model using the shared landing template. Acceptance: Explain doctor ownership, location independence, delegated staff and future patient/mobile continuity using approved content. Separate implemented, preview and planned capabilities; no fabricated customers, reviews, compliance badges or release history. Do not invent pricing, trial length, payment availability, download links or production onboarding. Primary actions go to a real approved route; use a preview/explanation state rather than fake submission or account creation.

Dependencies: DOS-M1-001, DOS-M1-004
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D004

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-005.json

Acceptance
1. Explain doctor ownership, location independence, delegated staff and future patient/mobile continuity using approved content.
2. Separate implemented, preview and planned capabilities; no fabricated customers, reviews, compliance badges or release history.
3. Do not invent pricing, trial length, payment availability, download links or production onboarding.
4. Primary actions go to a real approved route; use a preview/explanation state rather than fake submission or account creation.

Verification scenarios
- Check every call to action, internal link and public readiness label.
- Verify anonymous SSR produces no private records or credentials.
- Review both languages and mobile navigation for layout/copy parity.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-005.test.mjs
- apps/doctor-suit/tests/e2e/dos-m1-005.spec.ts
- release-fragments/dos-m1-005.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-005.test.mjs"
    ],
    "commands": [
      "dos-m1-005-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-005.spec.ts"
    ],
    "commands": [
      "dos-m1-005-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-005-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Explain doctor ownership, location independence, delegated staff and future patient/mobile continuity using approved content.",
    "procedure": "Read the rendered homepage in both locales and follow the doctor-across-locations explanation and delegation sections.",
    "test_case_name": "DOS-M1-005-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-005.spec.ts"
    ],
    "command_refs": [
      "dos-m1-005-browser"
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
    "case_id": "DOS-M1-005-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Separate implemented, preview and planned capabilities; no fabricated customers, reviews, compliance badges or release history.",
    "procedure": "Assert preview/planned labels on unreleased features and absence of fabricated review, customer or compliance claims.",
    "test_case_name": "DOS-M1-005-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-005.spec.ts"
    ],
    "command_refs": [
      "dos-m1-005-browser"
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
    "case_id": "DOS-M1-005-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Do not invent pricing, trial length, payment availability, download links or production onboarding.",
    "procedure": "Reject unconfigured price/trial/store/production-signup data and confirm no such CTA appears in the rendered preview.",
    "test_case_name": "DOS-M1-005-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-005.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m1-005.spec.ts"
    ],
    "command_refs": [
      "dos-m1-005-unit",
      "dos-m1-005-browser"
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
    "case_id": "DOS-M1-005-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Primary actions go to a real approved route; use a preview/explanation state rather than fake submission or account creation.",
    "procedure": "Follow every primary CTA and verify an actual internal preview route or honest unavailable state, never fake success.",
    "test_case_name": "DOS-M1-005-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-005.spec.ts"
    ],
    "command_refs": [
      "dos-m1-005-browser"
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
    "case_id": "DOS-M1-005-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-005.json"
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
  "fragment_path": "release-fragments/dos-m1-005.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-006 — Doctor authentication and account recovery

Implement the doctor web identity lifecycle using existing shared auth templates and product-isolated session adapters, with no cross-product SSO by implication.

Requirements
- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F006: Implement the doctor web identity lifecycle using existing shared auth templates and product-isolated session adapters, with no cross-product SSO by implication. Acceptance: Support sign-up/sign-in/sign-out, verification and recovery states with explicit provider configuration gates. Do not infer a verified identity or ownership from matching email/phone or editable metadata. Validate redirects/callbacks and preserve product/environment cookie isolation. Expiry, retries, refresh and errors cannot leave an authenticated-looking but unauthorized session.

Dependencies: DOS-M1-003, DOS-M1-004
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-006.json

Acceptance
1. Support sign-up/sign-in/sign-out, verification and recovery states with explicit provider configuration gates.
2. Do not infer a verified identity or ownership from matching email/phone or editable metadata.
3. Validate redirects/callbacks and preserve product/environment cookie isolation.
4. Expiry, retries, refresh and errors cannot leave an authenticated-looking but unauthorized session.

Verification scenarios
- Test new/existing user, expired verification, invalid recovery and open-redirect attempts.
- Test simultaneous Doctor/other-product sessions and cache clearing on logout.
- Use the local mail/test environment; do not send external email.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-006.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-006.sql
- apps/doctor-suit/tests/e2e/dos-m1-006.spec.ts
- release-fragments/dos-m1-006.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-006.test.mjs"
    ],
    "commands": [
      "dos-m1-006-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-006.sql"
    ],
    "commands": [
      "dos-m1-006-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-006.spec.ts"
    ],
    "commands": [
      "dos-m1-006-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-006-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Support sign-up/sign-in/sign-out, verification and recovery states with explicit provider configuration gates.",
    "procedure": "Complete synthetic signup, verification, recovery, login and logout; exercise expired challenge and retry failures.",
    "test_case_name": "DOS-M1-006-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-006.spec.ts"
    ],
    "command_refs": [
      "dos-m1-006-browser"
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
    "case_id": "DOS-M1-006-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Do not infer a verified identity or ownership from matching email/phone or editable metadata.",
    "procedure": "Forge editable metadata and equal-contact identities and prove neither ownership nor verification is granted.",
    "test_case_name": "DOS-M1-006-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-006.sql"
    ],
    "command_refs": [
      "dos-m1-006-data"
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
    "case_id": "DOS-M1-006-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Validate redirects/callbacks and preserve product/environment cookie isolation.",
    "procedure": "Reject foreign redirects; inspect browser cookies and callbacks for product/environment isolation.",
    "test_case_name": "DOS-M1-006-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-006.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m1-006.spec.ts"
    ],
    "command_refs": [
      "dos-m1-006-unit",
      "dos-m1-006-browser"
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
    "case_id": "DOS-M1-006-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Expiry, retries, refresh and errors cannot leave an authenticated-looking but unauthorized session.",
    "procedure": "Expire or revoke the session during a protected request and assert cache clearing and safe signed-out presentation.",
    "test_case_name": "DOS-M1-006-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-006.spec.ts"
    ],
    "command_refs": [
      "dos-m1-006-browser"
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
    "case_id": "DOS-M1-006-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-006.json"
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
  "fragment_path": "release-fragments/dos-m1-006.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-007 — Doctor-led practice onboarding and profile

Let an authenticated doctor create and maintain a practice profile and reach a usable workspace without employing a secretary. The doctor is the future subscriber; no paid entitlement is fabricated.

Requirements
- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F007: Let an authenticated doctor create and maintain a practice profile and reach a usable workspace without employing a secretary. The doctor is the future subscriber; no paid entitlement is fabricated. Acceptance: A doctor can complete onboarding alone and add an initial location. Onboarding is resumable and idempotent; double-submit does not create duplicate practices. Store only the approved profile fields; professional verification is not asserted unless independently established. Show incomplete configuration honestly; later subscription rules do not block a synthetic preview.

Dependencies: DOS-M1-006
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-007.json

Acceptance
1. A doctor can complete onboarding alone and add an initial location.
2. Onboarding is resumable and idempotent; double-submit does not create duplicate practices.
3. Store only the approved profile fields; professional verification is not asserted unless independently established.
4. Show incomplete configuration honestly; later subscription rules do not block a synthetic preview.

Verification scenarios
- Resume incomplete onboarding after refresh and another session.
- Retry/double-submit while checking one practice/one owner membership.
- Verify a secretary cannot self-promote through onboarding endpoints.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-007.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-007.sql
- apps/doctor-suit/tests/e2e/dos-m1-007.spec.ts
- release-fragments/dos-m1-007.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-007.test.mjs"
    ],
    "commands": [
      "dos-m1-007-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-007.sql"
    ],
    "commands": [
      "dos-m1-007-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-007.spec.ts"
    ],
    "commands": [
      "dos-m1-007-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-007-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "A doctor can complete onboarding alone and add an initial location.",
    "procedure": "Onboard a doctor with no secretary and create the initial location through the actual form.",
    "test_case_name": "DOS-M1-007-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-007.spec.ts"
    ],
    "command_refs": [
      "dos-m1-007-browser"
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
    "case_id": "DOS-M1-007-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Onboarding is resumable and idempotent; double-submit does not create duplicate practices.",
    "procedure": "Replay/concurrently submit onboarding and assert one practice with resumable state.",
    "test_case_name": "DOS-M1-007-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-007.sql"
    ],
    "command_refs": [
      "dos-m1-007-data"
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
    "case_id": "DOS-M1-007-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Store only the approved profile fields; professional verification is not asserted unless independently established.",
    "procedure": "Submit unapproved profile fields and verify rejection; the UI must never label the doctor professionally verified.",
    "test_case_name": "DOS-M1-007-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-007.sql",
      "apps/doctor-suit/tests/e2e/dos-m1-007.spec.ts"
    ],
    "command_refs": [
      "dos-m1-007-data",
      "dos-m1-007-browser"
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
    "case_id": "DOS-M1-007-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Show incomplete configuration honestly; later subscription rules do not block a synthetic preview.",
    "procedure": "Leave optional configuration incomplete and confirm the synthetic workspace remains usable without invented paid entitlement.",
    "test_case_name": "DOS-M1-007-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-007.spec.ts"
    ],
    "command_refs": [
      "dos-m1-007-browser"
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
    "case_id": "DOS-M1-007-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-007.json"
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
  "fragment_path": "release-fragments/dos-m1-007.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-008 — Multiple clinic locations and practice context switching

Let a doctor manage multiple working locations without making a location the owner of their practice records.

Requirements
- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F008: Let a doctor manage multiple working locations without making a location the owner of their practice records. Acceptance: Create/edit/archive locations and configure contact/schedule context without deleting linked history. A doctor retains practice-level patients while encounters/appointments retain location attribution. Location visibility honors membership grants; no inference from a client-selected location ID. Use an explicit configurable timezone; do not hardcode fixed UTC offsets.

Dependencies: DOS-M1-007
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-008.json

Acceptance
1. Create/edit/archive locations and configure contact/schedule context without deleting linked history.
2. A doctor retains practice-level patients while encounters/appointments retain location attribution.
3. Location visibility honors membership grants; no inference from a client-selected location ID.
4. Use an explicit configurable timezone; do not hardcode fixed UTC offsets.

Verification scenarios
- Test two locations, cross-location patient lookup and restricted secretary access.
- Archive a location with future appointments and surface a resolution workflow.
- Check stale browser requests after a context switch cannot overwrite the new context.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-008.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-008.sql
- apps/doctor-suit/tests/e2e/dos-m1-008.spec.ts
- release-fragments/dos-m1-008.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-008.test.mjs"
    ],
    "commands": [
      "dos-m1-008-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-008.sql"
    ],
    "commands": [
      "dos-m1-008-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-008.spec.ts"
    ],
    "commands": [
      "dos-m1-008-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-008-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Create/edit/archive locations and configure contact/schedule context without deleting linked history.",
    "procedure": "Archive a location referenced by appointments and verify all history remains linked.",
    "test_case_name": "DOS-M1-008-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-008.sql"
    ],
    "command_refs": [
      "dos-m1-008-data"
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
    "case_id": "DOS-M1-008-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "A doctor retains practice-level patients while encounters/appointments retain location attribution.",
    "procedure": "Query the same practice patient at two locations and retain independent appointment location attribution.",
    "test_case_name": "DOS-M1-008-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-008.sql"
    ],
    "command_refs": [
      "dos-m1-008-data"
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
    "case_id": "DOS-M1-008-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Location visibility honors membership grants; no inference from a client-selected location ID.",
    "procedure": "Forge an ungranted location ID as secretary and prove backend denial.",
    "test_case_name": "DOS-M1-008-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-008.sql"
    ],
    "command_refs": [
      "dos-m1-008-data"
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
    "case_id": "DOS-M1-008-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Use an explicit configurable timezone; do not hardcode fixed UTC offsets.",
    "procedure": "Use an IANA timezone across offset transitions and verify stored/displayed appointment context without fixed-offset assumptions.",
    "test_case_name": "DOS-M1-008-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-008.test.mjs"
    ],
    "command_refs": [
      "dos-m1-008-unit"
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
    "case_id": "DOS-M1-008-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-008.json"
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
  "fragment_path": "release-fragments/dos-m1-008.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-009 — Secretary invitations and multi-doctor memberships

Enable invited secretaries to use one Doctor Suit identity across independent doctor memberships without becoming subscribers or mixing practices.

Requirements
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F009: Enable invited secretaries to use one Doctor Suit identity across independent doctor memberships without becoming subscribers or mixing practices. Acceptance: Invitation acceptance validates intended recipient, expiry, membership scope and idempotency. The same secretary can belong to two practices with different location grants. Revocation/suspension invalidates protected access according to tested session/cache guarantees. No secretary subscription is created and no other doctor membership is changed by this invitation.

Dependencies: DOS-M1-006, DOS-M1-008
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-009.json

Acceptance
1. Invitation acceptance validates intended recipient, expiry, membership scope and idempotency.
2. The same secretary can belong to two practices with different location grants.
3. Revocation/suspension invalidates protected access according to tested session/cache guarantees.
4. No secretary subscription is created and no other doctor membership is changed by this invitation.

Verification scenarios
- Test reused/expired/wrong-recipient invitations and concurrent acceptance.
- Test shared secretary access across two doctors with no mixed lists, search or uploads.
- Test revocation while the secretary keeps a browser tab open.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-009.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-009.sql
- apps/doctor-suit/tests/e2e/dos-m1-009.spec.ts
- release-fragments/dos-m1-009.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-009.test.mjs"
    ],
    "commands": [
      "dos-m1-009-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-009.sql"
    ],
    "commands": [
      "dos-m1-009-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-009.spec.ts"
    ],
    "commands": [
      "dos-m1-009-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-009-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Invitation acceptance validates intended recipient, expiry, membership scope and idempotency.",
    "procedure": "Replay acceptance with wrong recipient, expired token and duplicate request; only valid scoped acceptance succeeds once.",
    "test_case_name": "DOS-M1-009-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-009.sql"
    ],
    "command_refs": [
      "dos-m1-009-data"
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
    "case_id": "DOS-M1-009-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "The same secretary can belong to two practices with different location grants.",
    "procedure": "Grant a secretary different locations in practices A/B and query each independently.",
    "test_case_name": "DOS-M1-009-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-009.sql"
    ],
    "command_refs": [
      "dos-m1-009-data"
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
    "case_id": "DOS-M1-009-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Revocation/suspension invalidates protected access according to tested session/cache guarantees.",
    "procedure": "Revoke a membership during an open session and verify both subsequent backend denial and cache/UI cleanup.",
    "test_case_name": "DOS-M1-009-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-009.sql",
      "apps/doctor-suit/tests/e2e/dos-m1-009.spec.ts"
    ],
    "command_refs": [
      "dos-m1-009-data",
      "dos-m1-009-browser"
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
    "case_id": "DOS-M1-009-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "No secretary subscription is created and no other doctor membership is changed by this invitation.",
    "procedure": "Compare subscriber/membership rows before and after acceptance; only the intended membership changes.",
    "test_case_name": "DOS-M1-009-C04",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-009.sql"
    ],
    "command_refs": [
      "dos-m1-009-data"
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
    "case_id": "DOS-M1-009-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-009.json"
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
  "fragment_path": "release-fragments/dos-m1-009.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-010 — Granular delegation enforced in the backend

Implement explicit capabilities for patient administration, scheduling, intake, documents and settings scoped to doctor/location. Presentation reflects authorization but is not its boundary.

Requirements
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F010: Implement explicit capabilities for patient administration, scheduling, intake, documents and settings scoped to doctor/location. Presentation reflects authorization but is not its boundary. Acceptance: Doctor can grant only selected capabilities or all approved delegable administrative capabilities. Every command/query/attachment access path enforces matching backend grants. No capability grants access to another doctor; no implicit employee-to-owner escalation. Clinical signing and prescribing authority are not implemented in M1; the later physician-only boundary remains a safety decision, not a secretary role shortcut.

Dependencies: DOS-M1-009
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-010.json

Acceptance
1. Doctor can grant only selected capabilities or all approved delegable administrative capabilities.
2. Every command/query/attachment access path enforces matching backend grants.
3. No capability grants access to another doctor; no implicit employee-to-owner escalation.
4. Clinical signing and prescribing authority are not implemented in M1; the later physician-only boundary remains a safety decision, not a secretary role shortcut.

Verification scenarios
- Exercise each denied operation directly, not just by hiding a button.
- Test permission changes, revoked memberships, overposted fields and conflicting grants.
- Audit actor and scope for grant/revoke and privileged administrative writes.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-010.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-010.sql
- apps/doctor-suit/tests/e2e/dos-m1-010.spec.ts
- release-fragments/dos-m1-010.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-010.test.mjs"
    ],
    "commands": [
      "dos-m1-010-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-010.sql"
    ],
    "commands": [
      "dos-m1-010-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-010.spec.ts"
    ],
    "commands": [
      "dos-m1-010-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-010-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Doctor can grant only selected capabilities or all approved delegable administrative capabilities.",
    "procedure": "Save a selected-capability grant, reload it and enforce the exact set on the backend.",
    "test_case_name": "DOS-M1-010-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-010.spec.ts",
      "apps/doctor-suit/supabase/tests/dos-m1-010.sql"
    ],
    "command_refs": [
      "dos-m1-010-browser",
      "dos-m1-010-data"
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
    "case_id": "DOS-M1-010-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Every command/query/attachment access path enforces matching backend grants.",
    "procedure": "Invoke query, command and attachment paths separately with a missing capability and require denial.",
    "test_case_name": "DOS-M1-010-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-010.sql"
    ],
    "command_refs": [
      "dos-m1-010-data"
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
    "case_id": "DOS-M1-010-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "No capability grants access to another doctor; no implicit employee-to-owner escalation.",
    "procedure": "Try cross-doctor reads and owner promotion with a secretary identity and forged role fields.",
    "test_case_name": "DOS-M1-010-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-010.sql"
    ],
    "command_refs": [
      "dos-m1-010-data"
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
    "case_id": "DOS-M1-010-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Clinical signing and prescribing authority are not implemented in M1; the later physician-only boundary remains a safety decision, not a secretary role shortcut.",
    "procedure": "Verify the M1 capability catalogue and rendered actions contain no prescription/signing capability or clinical authority shortcut.",
    "test_case_name": "DOS-M1-010-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-010.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m1-010.spec.ts"
    ],
    "command_refs": [
      "dos-m1-010-unit",
      "dos-m1-010-browser"
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
    "case_id": "DOS-M1-010-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-010.json"
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
  "fragment_path": "release-fragments/dos-m1-010.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-011 — Patient directory and safe administrative CRUD

Provide the authorized doctor/secretary patient-administration web flow: create, search, paginate, edit and archive the doctor-practice patient record.

Requirements
- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F011: Provide the authorized doctor/secretary patient-administration web flow: create, search, paginate, edit and archive the doctor-practice patient record. Acceptance: Use server-side scoped search/pagination and explicit empty/error/denied states. A shared phone number or matching name never automatically merges people or grants a patient app account. Create/update is validated and retry-safe; concurrent updates cannot silently overwrite identity data. Archive preserves referenced records; no bulk hard-delete or cross-doctor patient discovery.

Dependencies: DOS-M1-010
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-011.json

Acceptance
1. Use server-side scoped search/pagination and explicit empty/error/denied states.
2. A shared phone number or matching name never automatically merges people or grants a patient app account.
3. Create/update is validated and retry-safe; concurrent updates cannot silently overwrite identity data.
4. Archive preserves referenced records; no bulk hard-delete or cross-doctor patient discovery.

Verification scenarios
- Test duplicate-name/shared-phone households, pagination and simultaneous edits.
- Test doctor A versus doctor B and secretary capability variants.
- Test validation feedback, double-submit, refresh and failed network save.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-011.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-011.sql
- apps/doctor-suit/tests/e2e/dos-m1-011.spec.ts
- release-fragments/dos-m1-011.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-011.test.mjs"
    ],
    "commands": [
      "dos-m1-011-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-011.sql"
    ],
    "commands": [
      "dos-m1-011-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-011.spec.ts"
    ],
    "commands": [
      "dos-m1-011-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-011-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Use server-side scoped search/pagination and explicit empty/error/denied states.",
    "procedure": "Search/page across multiple scoped pages and exercise empty/error/denied responses without cross-practice results.",
    "test_case_name": "DOS-M1-011-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-011.spec.ts",
      "apps/doctor-suit/supabase/tests/dos-m1-011.sql"
    ],
    "command_refs": [
      "dos-m1-011-browser",
      "dos-m1-011-data"
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
    "case_id": "DOS-M1-011-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "A shared phone number or matching name never automatically merges people or grants a patient app account.",
    "procedure": "Create two patients sharing a contact and assert separate identities and no patient-login claim.",
    "test_case_name": "DOS-M1-011-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-011.sql"
    ],
    "command_refs": [
      "dos-m1-011-data"
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
    "case_id": "DOS-M1-011-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Create/update is validated and retry-safe; concurrent updates cannot silently overwrite identity data.",
    "procedure": "Race stale updates and replay creates; require conflict handling and one idempotent create.",
    "test_case_name": "DOS-M1-011-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-011.sql"
    ],
    "command_refs": [
      "dos-m1-011-data"
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
    "case_id": "DOS-M1-011-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Archive preserves referenced records; no bulk hard-delete or cross-doctor patient discovery.",
    "procedure": "Archive a referenced patient and retain relationships/history; outsider search must reveal nothing.",
    "test_case_name": "DOS-M1-011-C04",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-011.sql"
    ],
    "command_refs": [
      "dos-m1-011-data"
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
    "case_id": "DOS-M1-011-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-011.json"
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
  "fragment_path": "release-fragments/dos-m1-011.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-012 — Patient profile, administrative timeline and private documents

Deliver a usable patient profile with demographics, administrative activity and authorized document upload/view. This is not yet a signed clinical record or patient-facing portal.

Requirements
- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F012: Deliver a usable patient profile with demographics, administrative activity and authorized document upload/view. This is not yet a signed clinical record or patient-facing portal. Acceptance: Show explicit doctor/location provenance and distinguish entered data from verified data. Attachments have private storage, type/size validation and scoped access; no public object URL. Record uploader, timestamps and replacement/archive history; downloading requires current access. No clinical findings, prescription efficacy, identity verification or result interpretation is invented.

Dependencies: DOS-M1-011
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-012.json

Acceptance
1. Show explicit doctor/location provenance and distinguish entered data from verified data.
2. Attachments have private storage, type/size validation and scoped access; no public object URL.
3. Record uploader, timestamps and replacement/archive history; downloading requires current access.
4. No clinical findings, prescription efficacy, identity verification or result interpretation is invented.

Verification scenarios
- Test unauthorized object access, revoked grants, expired links and interrupted uploads.
- Test filename/content handling and prevention of accidental public caching.
- Review usable profile navigation and document failures with synthetic files only.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-012.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-012.sql
- apps/doctor-suit/tests/e2e/dos-m1-012.spec.ts
- release-fragments/dos-m1-012.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-012.test.mjs"
    ],
    "commands": [
      "dos-m1-012-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-012.sql"
    ],
    "commands": [
      "dos-m1-012-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-012.spec.ts"
    ],
    "commands": [
      "dos-m1-012-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-012-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Show explicit doctor/location provenance and distinguish entered data from verified data.",
    "procedure": "Render entered versus reviewed provenance with doctor/location labels on the profile timeline.",
    "test_case_name": "DOS-M1-012-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-012.spec.ts"
    ],
    "command_refs": [
      "dos-m1-012-browser"
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
    "case_id": "DOS-M1-012-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Attachments have private storage, type/size validation and scoped access; no public object URL.",
    "procedure": "Upload invalid type/size, access another practice object and request public access; all forbidden paths fail.",
    "test_case_name": "DOS-M1-012-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-012.sql"
    ],
    "command_refs": [
      "dos-m1-012-data"
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
    "case_id": "DOS-M1-012-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Record uploader, timestamps and replacement/archive history; downloading requires current access.",
    "procedure": "Replace/archive a document, revoke access and verify immutable uploader/time history and download denial.",
    "test_case_name": "DOS-M1-012-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-012.sql"
    ],
    "command_refs": [
      "dos-m1-012-data"
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
    "case_id": "DOS-M1-012-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "No clinical findings, prescription efficacy, identity verification or result interpretation is invented.",
    "procedure": "Load unknown/unreviewed data and verify no inferred clinical finding, verification badge or interpretation appears.",
    "test_case_name": "DOS-M1-012-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-012.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m1-012.spec.ts"
    ],
    "command_refs": [
      "dos-m1-012-unit",
      "dos-m1-012-browser"
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
    "case_id": "DOS-M1-012-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-012.json"
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
  "fragment_path": "release-fragments/dos-m1-012.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-013 — Working hours, availability and appointment rules

Configure doctor/location working hours, exceptions, slot duration and conflict detection for a browser-based schedule.

Requirements
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F013: Configure doctor/location working hours, exceptions, slot duration and conflict detection for a browser-based schedule. Acceptance: The same doctor cannot silently book overlapping commitments across different locations. Respect explicit timezone, exceptions and location permissions. Availability and booking share one authoritative conflict rule. Override policy, if any, is explicit and auditable rather than a client bypass.

Dependencies: DOS-M1-008, DOS-M1-010
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-013.json

Acceptance
1. The same doctor cannot silently book overlapping commitments across different locations.
2. Respect explicit timezone, exceptions and location permissions.
3. Availability and booking share one authoritative conflict rule.
4. Override policy, if any, is explicit and auditable rather than a client bypass.

Verification scenarios
- Test simultaneous conflicting writes, boundaries, timezone/day changes and exceptions.
- Test secretary limited to one location and doctor with multiple clinics.
- Verify no hidden appointment changes while editing availability.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-013.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-013.sql
- apps/doctor-suit/tests/e2e/dos-m1-013.spec.ts
- release-fragments/dos-m1-013.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-013.test.mjs"
    ],
    "commands": [
      "dos-m1-013-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-013.sql"
    ],
    "commands": [
      "dos-m1-013-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-013.spec.ts"
    ],
    "commands": [
      "dos-m1-013-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-013-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "The same doctor cannot silently book overlapping commitments across different locations.",
    "procedure": "Race simultaneous bookings for one doctor at two locations and assert the shared overlap invariant.",
    "test_case_name": "DOS-M1-013-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-013.sql"
    ],
    "command_refs": [
      "dos-m1-013-data"
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
    "case_id": "DOS-M1-013-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Respect explicit timezone, exceptions and location permissions.",
    "procedure": "Exercise timezone boundaries, closed-day exceptions and an ungranted location against availability and booking.",
    "test_case_name": "DOS-M1-013-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-013.sql",
      "apps/doctor-suit/tests/unit/dos-m1-013.test.mjs"
    ],
    "command_refs": [
      "dos-m1-013-data",
      "dos-m1-013-unit"
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
    "case_id": "DOS-M1-013-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Availability and booking share one authoritative conflict rule.",
    "procedure": "Offer an available slot then occupy it concurrently; booking must apply the same authoritative conflict rule.",
    "test_case_name": "DOS-M1-013-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-013.sql"
    ],
    "command_refs": [
      "dos-m1-013-data"
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
    "case_id": "DOS-M1-013-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Override policy, if any, is explicit and auditable rather than a client bypass.",
    "procedure": "Attempt a client-only override and require denial; approved override records actor and reason.",
    "test_case_name": "DOS-M1-013-C04",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-013.sql"
    ],
    "command_refs": [
      "dos-m1-013-data"
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
    "case_id": "DOS-M1-013-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-013.json"
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
  "fragment_path": "release-fragments/dos-m1-013.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-014 — Appointments, check-in and live waiting queue

Deliver booking/rescheduling/cancellation/check-in and an operational queue without prescribing or billing scope.

Requirements
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F014: Deliver booking/rescheduling/cancellation/check-in and an operational queue without prescribing or billing scope. Acceptance: Use explicit appointment states and allowed transitions; no illegal double-check-in. Rescheduling and cancellation preserve history and are retry-safe. Queue updates remain scoped, recover after reconnect and do not leak other doctors. Notifications beyond in-app status updates remain gated; no unapproved SMS/WhatsApp service is enabled.

Dependencies: DOS-M1-011, DOS-M1-013
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-014.json

Acceptance
1. Use explicit appointment states and allowed transitions; no illegal double-check-in.
2. Rescheduling and cancellation preserve history and are retry-safe.
3. Queue updates remain scoped, recover after reconnect and do not leak other doctors.
4. Notifications beyond in-app status updates remain gated; no unapproved SMS/WhatsApp service is enabled.

Verification scenarios
- Exercise two reception sessions updating the same appointment.
- Test cancellation after check-in and documented resolution behavior.
- Test reconnect/refetch without duplicate or stale queue entries.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-014.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-014.sql
- apps/doctor-suit/tests/e2e/dos-m1-014.spec.ts
- release-fragments/dos-m1-014.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-014.test.mjs"
    ],
    "commands": [
      "dos-m1-014-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-014.sql"
    ],
    "commands": [
      "dos-m1-014-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-014.spec.ts"
    ],
    "commands": [
      "dos-m1-014-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-014-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Use explicit appointment states and allowed transitions; no illegal double-check-in.",
    "procedure": "Attempt duplicate check-in and every illegal appointment state transition; preserve one queue entry.",
    "test_case_name": "DOS-M1-014-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-014.sql"
    ],
    "command_refs": [
      "dos-m1-014-data"
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
    "case_id": "DOS-M1-014-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Rescheduling and cancellation preserve history and are retry-safe.",
    "procedure": "Replay reschedule/cancel commands and verify history and a single effective transition.",
    "test_case_name": "DOS-M1-014-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-014.sql"
    ],
    "command_refs": [
      "dos-m1-014-data"
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
    "case_id": "DOS-M1-014-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Queue updates remain scoped, recover after reconnect and do not leak other doctors.",
    "procedure": "Disconnect/reconnect the queue with two doctors and ensure a scoped authoritative refresh.",
    "test_case_name": "DOS-M1-014-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-014.spec.ts",
      "apps/doctor-suit/supabase/tests/dos-m1-014.sql"
    ],
    "command_refs": [
      "dos-m1-014-browser",
      "dos-m1-014-data"
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
    "case_id": "DOS-M1-014-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Notifications beyond in-app status updates remain gated; no unapproved SMS/WhatsApp service is enabled.",
    "procedure": "Leave external channels unconfigured and assert no outgoing provider dispatch or misleading delivery success.",
    "test_case_name": "DOS-M1-014-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-014.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m1-014.spec.ts"
    ],
    "command_refs": [
      "dos-m1-014-unit",
      "dos-m1-014-browser"
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
    "case_id": "DOS-M1-014-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-014.json"
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
  "fragment_path": "release-fragments/dos-m1-014.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-015 — Doctor and secretary operational web dashboards

Provide each authorized actor with a real-data Today view, appointments, waiting queue and relevant administrative actions rather than a generic placeholder dashboard.

Requirements
- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F015: Provide each authorized actor with a real-data Today view, appointments, waiting queue and relevant administrative actions rather than a generic placeholder dashboard. Acceptance: Metrics and lists use authoritative scoped queries and agreed time windows, not only loaded page rows. Doctor sees all authorized locations; secretary sees only granted capabilities and locations. Every displayed item links to its permitted source record. No unsupported financial/clinical metric or fabricated sample result is shown outside clearly labeled demo fixtures.

Dependencies: DOS-M1-012, DOS-M1-014
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-015.json
- apps/doctor-suit/supabase/tests/

Acceptance
1. Metrics and lists use authoritative scoped queries and agreed time windows, not only loaded page rows.
2. Doctor sees all authorized locations; secretary sees only granted capabilities and locations.
3. Every displayed item links to its permitted source record.
4. No unsupported financial/clinical metric or fabricated sample result is shown outside clearly labeled demo fixtures.

Verification scenarios
- Reconcile counters to synthetic source records and timezone boundaries.
- Test zero-data, denied and partial-capability dashboards.
- Test refresh, real-time invalidation and stale-session recovery.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-015.test.mjs
- apps/doctor-suit/tests/e2e/dos-m1-015.spec.ts
- release-fragments/dos-m1-015.json
- apps/doctor-suit/supabase/tests/dos-m1-015.sql

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-015.test.mjs"
    ],
    "commands": [
      "dos-m1-015-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-015.spec.ts"
    ],
    "commands": [
      "dos-m1-015-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "kind": "planned_test",
    "description": "Verify scoped database criteria with actual disposable authorization/write assertions",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-015.sql"
    ],
    "commands": [
      "dos-m1-015-data"
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
    "case_id": "DOS-M1-015-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Metrics and lists use authoritative scoped queries and agreed time windows, not only loaded page rows.",
    "procedure": "Compare Today counts and lists with a full scoped SQL population larger than one page and explicit timezone bounds.",
    "test_case_name": "DOS-M1-015-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-015.sql"
    ],
    "command_refs": [
      "dos-m1-015-data"
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
    "case_id": "DOS-M1-015-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Doctor sees all authorized locations; secretary sees only granted capabilities and locations.",
    "procedure": "Compare doctor and differently granted secretary dashboards, including denied direct actions.",
    "test_case_name": "DOS-M1-015-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-015.sql",
      "apps/doctor-suit/tests/e2e/dos-m1-015.spec.ts"
    ],
    "command_refs": [
      "dos-m1-015-data",
      "dos-m1-015-browser"
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
    "case_id": "DOS-M1-015-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Every displayed item links to its permitted source record.",
    "procedure": "Follow each dashboard row to its permitted source detail; deny an inaccessible deep link.",
    "test_case_name": "DOS-M1-015-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-015.spec.ts"
    ],
    "command_refs": [
      "dos-m1-015-browser"
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
    "case_id": "DOS-M1-015-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "No unsupported financial/clinical metric or fabricated sample result is shown outside clearly labeled demo fixtures.",
    "procedure": "Render only specified administrative metrics; synthetic sample labels persist and unsupported clinical/financial metrics are absent.",
    "test_case_name": "DOS-M1-015-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-015.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m1-015.spec.ts"
    ],
    "command_refs": [
      "dos-m1-015-unit",
      "dos-m1-015-browser"
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
    "case_id": "DOS-M1-015-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-015.json"
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
  "fragment_path": "release-fragments/dos-m1-015.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-016 — Profile, security and communication-preference settings

Provide product-scoped account/profile settings and nonclinical communication preferences, with safe session and ownership boundaries.

Requirements
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F016: Provide product-scoped account/profile settings and nonclinical communication preferences, with safe session and ownership boundaries. Acceptance: Separate personal account profile, doctor practice profile and membership permissions. Sensitive settings require the configured reauthentication/authorization policy. Preferences are explicit and scoped; do not enroll people in marketing or enable paid channels. Unsupported subscription/export controls are absent or truthfully unavailable, not fake successful buttons.

Dependencies: DOS-M1-006, DOS-M1-010
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-016.json

Acceptance
1. Separate personal account profile, doctor practice profile and membership permissions.
2. Sensitive settings require the configured reauthentication/authorization policy.
3. Preferences are explicit and scoped; do not enroll people in marketing or enable paid channels.
4. Unsupported subscription/export controls are absent or truthfully unavailable, not fake successful buttons.

Verification scenarios
- Test account versus practice updates do not overwrite each other.
- Test logout/session-expiry and outstanding form state.
- Test a secretary cannot alter doctor ownership, billing authority or other memberships.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-016.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-016.sql
- apps/doctor-suit/tests/e2e/dos-m1-016.spec.ts
- release-fragments/dos-m1-016.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-016.test.mjs"
    ],
    "commands": [
      "dos-m1-016-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-016.sql"
    ],
    "commands": [
      "dos-m1-016-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-016.spec.ts"
    ],
    "commands": [
      "dos-m1-016-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-016-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Separate personal account profile, doctor practice profile and membership permissions.",
    "procedure": "Update personal profile and practice profile independently; neither operation changes grants.",
    "test_case_name": "DOS-M1-016-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-016.sql"
    ],
    "command_refs": [
      "dos-m1-016-data"
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
    "case_id": "DOS-M1-016-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Sensitive settings require the configured reauthentication/authorization policy.",
    "procedure": "Change a sensitive setting with expired reauthentication and require denial plus the correct recovery prompt.",
    "test_case_name": "DOS-M1-016-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-016.sql",
      "apps/doctor-suit/tests/e2e/dos-m1-016.spec.ts"
    ],
    "command_refs": [
      "dos-m1-016-data",
      "dos-m1-016-browser"
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
    "case_id": "DOS-M1-016-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Preferences are explicit and scoped; do not enroll people in marketing or enable paid channels.",
    "procedure": "Change one scoped communication preference and assert no default marketing enrollment or paid provider activation.",
    "test_case_name": "DOS-M1-016-C03",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-016.sql"
    ],
    "command_refs": [
      "dos-m1-016-data"
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
    "case_id": "DOS-M1-016-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Unsupported subscription/export controls are absent or truthfully unavailable, not fake successful buttons.",
    "procedure": "Exercise unavailable subscription/export controls and verify they cannot report success.",
    "test_case_name": "DOS-M1-016-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-016.spec.ts"
    ],
    "command_refs": [
      "dos-m1-016-browser"
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
    "case_id": "DOS-M1-016-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-016.json"
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
  "fragment_path": "release-fragments/dos-m1-016.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-017 — Audit visibility and administrative data-preservation controls

Expose a permission-scoped audit view and safe archival/correction behavior for M1 administrative records, while preparing the explicit real-data governance gate.

Requirements
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F017: Expose a permission-scoped audit view and safe archival/correction behavior for M1 administrative records, while preparing the explicit real-data governance gate. Acceptance: Audit covers administrative writes, invitations/grants and document access according to approved policy. Client users cannot modify audit events or silently erase linked history. No clinical bulk export, erasure or retention period is guessed; unresolved policies remain disabled and documented. Audit view is scoped, searchable and excludes credentials or unnecessary sensitive payloads.

Dependencies: DOS-M1-010, DOS-M1-012, DOS-M1-014, DOS-M1-016
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-017.json

Acceptance
1. Audit covers administrative writes, invitations/grants and document access according to approved policy.
2. Client users cannot modify audit events or silently erase linked history.
3. No clinical bulk export, erasure or retention period is guessed; unresolved policies remain disabled and documented.
4. Audit view is scoped, searchable and excludes credentials or unnecessary sensitive payloads.

Verification scenarios
- Attempt client mutation/deletion of audit entries.
- Reconcile representative create/edit/archive/invite/permission actions to attributed events.
- Test cross-practice audit queries and document-access history.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-017.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-017.sql
- apps/doctor-suit/tests/e2e/dos-m1-017.spec.ts
- release-fragments/dos-m1-017.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-017.test.mjs"
    ],
    "commands": [
      "dos-m1-017-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-017.sql"
    ],
    "commands": [
      "dos-m1-017-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-017.spec.ts"
    ],
    "commands": [
      "dos-m1-017-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-017-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Audit covers administrative writes, invitations/grants and document access according to approved policy.",
    "procedure": "Perform administrative writes, grant changes and document reads; reconcile the approved audit events and actors.",
    "test_case_name": "DOS-M1-017-C01",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-017.sql"
    ],
    "command_refs": [
      "dos-m1-017-data"
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
    "case_id": "DOS-M1-017-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Client users cannot modify audit events or silently erase linked history.",
    "procedure": "Attempt client audit mutation and deletion of linked history; verify denial and unchanged originals.",
    "test_case_name": "DOS-M1-017-C02",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-017.sql"
    ],
    "command_refs": [
      "dos-m1-017-data"
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
    "case_id": "DOS-M1-017-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "No clinical bulk export, erasure or retention period is guessed; unresolved policies remain disabled and documented.",
    "procedure": "Verify unresolved retention/export policy remains explicitly unresolved and confirm the corresponding live-data operations remain disabled.",
    "test_case_name": "DOS-M1-017-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-017.test.mjs",
      "apps/doctor-suit/tests/e2e/dos-m1-017.spec.ts"
    ],
    "command_refs": [
      "dos-m1-017-unit",
      "dos-m1-017-browser"
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
    "case_id": "DOS-M1-017-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Audit view is scoped, searchable and excludes credentials or unnecessary sensitive payloads.",
    "procedure": "Filter/page the permitted audit view and inspect results for outsider data, credentials and excessive payloads.",
    "test_case_name": "DOS-M1-017-C04",
    "required_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-017.sql",
      "apps/doctor-suit/tests/e2e/dos-m1-017.spec.ts"
    ],
    "command_refs": [
      "dos-m1-017-data",
      "dos-m1-017-browser"
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
    "case_id": "DOS-M1-017-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-017.json"
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
  "fragment_path": "release-fragments/dos-m1-017.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-018 — Responsive web, accessibility and failure-recovery acceptance

Close measurable cross-journey usability gaps in the working website/portal, rather than deferring foundational UX until the end.

Requirements
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F018: Close measurable cross-journey usability gaps in the working website/portal, rather than deferring foundational UX until the end. Acceptance: All M1 critical journeys work on narrow mobile browser and desktop in both approved locales/themes. Keyboard/focus/labels, validation, overlays and reduced-motion settings are verified. Slow/offline/reconnect and repeated actions show honest unsaved state; M1 does not promise offline clinical writes. Shared fixes remain centralized with affected consumer regression coverage.

Dependencies: DOS-M1-005, DOS-M1-015, DOS-M1-016, DOS-M1-017
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-018.json

Acceptance
1. All M1 critical journeys work on narrow mobile browser and desktop in both approved locales/themes.
2. Keyboard/focus/labels, validation, overlays and reduced-motion settings are verified.
3. Slow/offline/reconnect and repeated actions show honest unsaved state; M1 does not promise offline clinical writes.
4. Shared fixes remain centralized with affected consumer regression coverage.

Verification scenarios
- Run appointment and patient administrative flows on desktop and mobile viewport.
- Run keyboard-only and screen-reader-label review; distinguish automated from human findings.
- Inject network errors and stale responses; prove no duplicate saves or lost context.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-018.test.mjs
- apps/doctor-suit/tests/e2e/dos-m1-018.spec.ts
- release-fragments/dos-m1-018.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-018.test.mjs"
    ],
    "commands": [
      "dos-m1-018-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-018.spec.ts"
    ],
    "commands": [
      "dos-m1-018-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check affected types",
    "command": "pnpm typecheck"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Lint code",
    "command": "pnpm lint"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Build the workspace candidate",
    "command": "pnpm build"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Independent exact-candidate shared-consumer browser evidence for all changed shared templates/controllers",
    "blocker": "shared_consumer_browser_receipts_required",
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
    "case_id": "DOS-M1-018-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "All M1 critical journeys work on narrow mobile browser and desktop in both approved locales/themes.",
    "procedure": "Run all critical journeys at narrow/desktop widths in EN/AR and both themes.",
    "test_case_name": "DOS-M1-018-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-018.spec.ts"
    ],
    "command_refs": [
      "dos-m1-018-browser"
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
    "case_id": "DOS-M1-018-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Keyboard/focus/labels, validation, overlays and reduced-motion settings are verified.",
    "procedure": "Use keyboard-only actions, focus recovery, validation labels and reduced-motion emulation on working overlays.",
    "test_case_name": "DOS-M1-018-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-018.spec.ts"
    ],
    "command_refs": [
      "dos-m1-018-browser"
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
    "case_id": "DOS-M1-018-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Slow/offline/reconnect and repeated actions show honest unsaved state; M1 does not promise offline clinical writes.",
    "procedure": "Delay/drop/reconnect requests and repeat actions; assert truthful unsaved state and no duplicate mutation.",
    "test_case_name": "DOS-M1-018-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-018.spec.ts"
    ],
    "command_refs": [
      "dos-m1-018-browser"
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
    "case_id": "DOS-M1-018-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Shared fixes remain centralized with affected consumer regression coverage.",
    "procedure": "Compare affected consumers from the dependency graph to exact-candidate shared UI/browser receipts.",
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
    "case_id": "DOS-M1-018-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-018.json"
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
  "fragment_path": "release-fragments/dos-m1-018.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-019 — Public metadata, support paths and website preview readiness

Complete public-site metadata and support/navigation behavior while keeping private routes unindexed and future capabilities clearly separated from released functionality.

Requirements
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F019: Complete public-site metadata and support/navigation behavior while keeping private routes unindexed and future capabilities clearly separated from released functionality. Acceptance: Verify titles, descriptions and locale metadata on the synthetic preview origin; omit a production canonical URL until an approved real domain is configured. Real-domain acceptance remains DOS-M1-D005 and is not required to finish this synthetic task. Private/authenticated pages are not exposed through generated sitemaps, public caches or share metadata. Use Building tokens and text Doctor Suit branding plus approved preview copy; hide external support/contact destinations until actual details are supplied. No fabricated store links, pricing, compliance or production claims. Prepare release fragments/checks and a preview handoff; do not merge, deploy, activate release registration or publish a released version.

Dependencies: DOS-M1-005, DOS-M1-006, DOS-M1-018
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D004

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-019.json

Acceptance
1. Verify titles, descriptions and locale metadata on the synthetic preview origin; omit a production canonical URL until an approved real domain is configured. Real-domain acceptance remains DOS-M1-D005 and is not required to finish this synthetic task.
2. Private/authenticated pages are not exposed through generated sitemaps, public caches or share metadata.
3. Use Building tokens and text Doctor Suit branding plus approved preview copy; hide external support/contact destinations until actual details are supplied. No fabricated store links, pricing, compliance or production claims.
4. Prepare release fragments/checks and a preview handoff; do not merge, deploy, activate release registration or publish a released version.

Verification scenarios
- Inspect public versus authenticated page source, sitemap and metadata behavior.
- Test every navigation/support/deep link and missing-route state.
- Review preview readiness labels against implemented evidence.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-019.test.mjs
- apps/doctor-suit/tests/e2e/dos-m1-019.spec.ts
- release-fragments/dos-m1-019.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-019.test.mjs"
    ],
    "commands": [
      "dos-m1-019-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-019.spec.ts"
    ],
    "commands": [
      "dos-m1-019-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
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
    "case_id": "DOS-M1-019-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Verify titles, descriptions and locale metadata on the synthetic preview origin; omit a production canonical URL until an approved real domain is configured. Real-domain acceptance remains DOS-M1-D005 and is not required to finish this synthetic task.",
    "procedure": "Inspect preview HTML metadata in both locales; verify the preview origin and omit an unapproved production canonical.",
    "test_case_name": "DOS-M1-019-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-019.spec.ts"
    ],
    "command_refs": [
      "dos-m1-019-browser"
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
    "case_id": "DOS-M1-019-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Private/authenticated pages are not exposed through generated sitemaps, public caches or share metadata.",
    "procedure": "Request private routes and inspect sitemap/cache/share outputs for any protected content.",
    "test_case_name": "DOS-M1-019-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-019.spec.ts"
    ],
    "command_refs": [
      "dos-m1-019-browser"
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
    "case_id": "DOS-M1-019-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "Use Building tokens and text Doctor Suit branding plus approved preview copy; hide external support/contact destinations until actual details are supplied. No fabricated store links, pricing, compliance or production claims.",
    "procedure": "Inspect preview brand and CTAs; missing external support/store/price details must stay absent.",
    "test_case_name": "DOS-M1-019-C03",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-019.spec.ts"
    ],
    "command_refs": [
      "dos-m1-019-browser"
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
    "case_id": "DOS-M1-019-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Prepare release fragments/checks and a preview handoff; do not merge, deploy, activate release registration or publish a released version.",
    "procedure": "Verify task fragment and scoped inventory contributions against candidate/base/main refs; no release registration or deployment occurs.",
    "test_case_name": null,
    "required_outputs": [],
    "command_refs": [
      "doctor-release-check"
    ],
    "external_evidence_required": true,
    "evidence_types": [
      "exact-candidate-release-review"
    ],
    "evidence_policy": {
      "human_approval_required": false,
      "independent_automated_verification_required": false,
      "authority_rule": "Verification may validate existing authority and reject missing evidence; it cannot grant, replace or resolve a domain approval."
    },
    "acceptance_rule": "Execute the stated assertions against actual behavior or the exact reviewed documents/receipts. No empty/skipped/source-grep-only/fabricated-pass substitute."
  },
  {
    "case_id": "DOS-M1-019-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-019.json"
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
  "fragment_path": "release-fragments/dos-m1-019.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.

## DOS-M1-020 — Milestone 1 end-to-end verification and owner demo handoff

Independently verify the full synthetic website/doctor/secretary vertical slice and prepare an evidence-backed milestone acceptance packet. This is not clinical or commercial launch approval.

Requirements
- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.
- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.
- DOS-M1-R003: M1 is the public product website plus administrative doctor/secretary browser portal, synthetic data only; clinical prescribing starts M2 and mobile remains later.
- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.
- DOS-M1-R005: Use Building-Suit/building-suit-monorepo, pinned stack, shared packages/ui templates and packages/ux interactions; Doctor app adapters own logic/data. Independent runtime verification and publication remain control-plane owned.
- DOS-M1-F020: Independently verify the full synthetic website/doctor/secretary vertical slice and prepare an evidence-backed milestone acceptance packet. This is not clinical or commercial launch approval. Acceptance: Doctor alone can onboard, add two clinics, create a patient, book/check in and review their queue/profile. Shared secretary can accept two doctor invitations and perform only granted actions without data leakage. All required unit, local data-authorization, browser, shared-consumer, boundary, lint/typecheck/build checks have exact evidence. Report implemented versus verified versus published/integrated/deployed separately; real patients, payment, prescribing and mobile availability remain gated.

Dependencies: DOS-M1-001, DOS-M1-002, DOS-M1-003, DOS-M1-004, DOS-M1-005, DOS-M1-006, DOS-M1-007, DOS-M1-008, DOS-M1-009, DOS-M1-010, DOS-M1-011, DOS-M1-012, DOS-M1-013, DOS-M1-014, DOS-M1-015, DOS-M1-016, DOS-M1-017, DOS-M1-018, DOS-M1-019
Blocking decisions: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003, DOS-M1-D004

Allowed paths
- apps/building-suit-docs/app/pages/components.vue
- apps/doctor-suit/app/
- apps/doctor-suit/supabase/
- apps/doctor-suit/tests/
- docs/shared/atomic-template-route-inventory.json
- docs/shared/ui-ownership-manifest.json
- docs/work-packages/doctor-suit/
- packages/contracts/src/
- packages/testing/
- packages/ui/package.json
- packages/ui/src/organisms/
- packages/ui/src/templates/
- packages/ui/tests/
- packages/ux/src/
- packages/ux/tests/
- release-changes/items.json
- release-fragments/dos-m1-020.json

Acceptance
1. Doctor alone can onboard, add two clinics, create a patient, book/check in and review their queue/profile.
2. Shared secretary can accept two doctor invitations and perform only granted actions without data leakage.
3. All required unit, local data-authorization, browser, shared-consumer, boundary, lint/typecheck/build checks have exact evidence.
4. Report implemented versus verified versus published/integrated/deployed separately; real patients, payment, prescribing and mobile availability remain gated.

Verification scenarios
- Run the complete independent two-doctor/two-location/secretary/outsider journey.
- Run negative authorization and duplicate-write tests, recovery and mobile-browser checks.
- Produce traceability, defects, screenshots/evidence refs and outstanding owner/domain gates with no self-approved PASS.

Expected outputs
- apps/doctor-suit/tests/unit/dos-m1-020.test.mjs
- apps/doctor-suit/supabase/tests/dos-m1-020.sql
- apps/doctor-suit/tests/e2e/dos-m1-020.spec.ts
- release-fragments/dos-m1-020.json

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
    "description": "Check workspace and template boundaries",
    "command": "pnpm check"
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Create and execute meaningful task-owned regression coverage",
    "expected_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-020.test.mjs"
    ],
    "commands": [
      "dos-m1-020-unit"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Prove database tenant authorization and write integrity using disposable fixtures",
    "expected_outputs": [
      "apps/doctor-suit/supabase/tests/dos-m1-020.sql"
    ],
    "commands": [
      "dos-m1-020-data"
    ],
    "requires": [
      "database",
      "rls-authorization"
    ]
  },
  {
    "version": 2,
    "kind": "planned_test",
    "description": "Verify the browser user journey and denial/recovery states",
    "expected_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-020.spec.ts"
    ],
    "commands": [
      "dos-m1-020-browser"
    ],
    "requires": [
      "browser"
    ]
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Check affected types",
    "command": "pnpm typecheck"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Lint code",
    "command": "pnpm lint"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Build the workspace candidate",
    "command": "pnpm build"
  },
  {
    "version": 2,
    "kind": "command",
    "description": "Run full repository unit regression including affected shared consumers",
    "command": "pnpm test"
  },
  {
    "version": 2,
    "kind": "external_gate",
    "description": "Independent exact-candidate shared-consumer browser evidence for all changed shared templates/controllers",
    "blocker": "shared_consumer_browser_receipts_required",
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
    "case_id": "DOS-M1-020-C01",
    "criterion_ids": [
      1
    ],
    "assertion": "Doctor alone can onboard, add two clinics, create a patient, book/check in and review their queue/profile.",
    "procedure": "Execute doctor-alone onboarding, two locations, patient creation, booking/check-in and queue/profile review end to end.",
    "test_case_name": "DOS-M1-020-C01",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-020.spec.ts"
    ],
    "command_refs": [
      "dos-m1-020-browser"
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
    "case_id": "DOS-M1-020-C02",
    "criterion_ids": [
      2
    ],
    "assertion": "Shared secretary can accept two doctor invitations and perform only granted actions without data leakage.",
    "procedure": "Accept two invitations as one secretary and prove distinct grants with cross-practice backend denial.",
    "test_case_name": "DOS-M1-020-C02",
    "required_outputs": [
      "apps/doctor-suit/tests/e2e/dos-m1-020.spec.ts",
      "apps/doctor-suit/supabase/tests/dos-m1-020.sql"
    ],
    "command_refs": [
      "dos-m1-020-browser",
      "dos-m1-020-data"
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
    "case_id": "DOS-M1-020-C03",
    "criterion_ids": [
      3
    ],
    "assertion": "All required unit, local data-authorization, browser, shared-consumer, boundary, lint/typecheck/build checks have exact evidence.",
    "procedure": "Match every required suite and affected-consumer receipt to the same candidate, checking failures, skips and unrun obligations.",
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
    "case_id": "DOS-M1-020-C04",
    "criterion_ids": [
      4
    ],
    "assertion": "Report implemented versus verified versus published/integrated/deployed separately; real patients, payment, prescribing and mobile availability remain gated.",
    "procedure": "Audit handoff status labels and confirm no real patients, payment, prescribing, mobile or production availability is claimed.",
    "test_case_name": "DOS-M1-020-C04",
    "required_outputs": [
      "apps/doctor-suit/tests/unit/dos-m1-020.test.mjs"
    ],
    "command_refs": [
      "dos-m1-020-unit"
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
    "case_id": "DOS-M1-020-RELEASE",
    "criterion_ids": [],
    "assertion": "Task-scoped release provenance and, when applicable, public inventory are complete.",
    "procedure": "Run pnpm release:check against the exact candidate HEAD and verified task/base/main refs after the control plane creates the candidate. A run on the pre-change HEAD is not acceptance. Preserve gate/evidence separately from product test results.",
    "test_case_name": null,
    "required_outputs": [
      "release-fragments/dos-m1-020.json"
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
  "fragment_path": "release-fragments/dos-m1-020.json",
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
- M1 acceptance is synthetic administrative web only; prescribing, payment, patient/mobile apps and production claims remain unavailable.
