-- Doctor Suit | Milestone 1: website and doctor/secretary browser foundation
-- Revision: v0.2 | Prepared: 2026-10-16
-- STATUS: DRAFT / NOT IMPORT-READY. THIS FILE WAS NOT EXECUTED.
-- Source: Building-Suit/building-suit-monorepo @ c6774d47907f7b09aa0a0e9aa2c45c5687a71c50
-- Contains 20 complete task packets, 25 requirements, 5 OPEN decisions and real links.
-- Payload canonical SHA-256: 317034b326d04b6cb815d5ca390e8d18782659db04588e231b6e06a4acffd308
--
-- This is a SOURCE-DERIVED CONTROL-DATABASE SEED CANDIDATE, not a product
-- Supabase migration, native n8n export, or verified deployed bulk importer.
-- Both an unconditional SQL exception and final ROLLBACK prevent application.
-- Do not remove either merely to make this script run. A separately authorized
-- compatibility review must establish the real consumer, schema, registrations,
-- legacy history, scheduler stop/pause state and tested replay semantics first.
-- A metadata field never substitutes for those runtime controls.
--
-- No project/workstream creation, activation, grants, decision approval,
-- task execution, retry changes, merge, deployment or hosted product writes.
-- Existing definitions are compared, never overwritten. Existing task state,
-- engine stage, execution evidence and completion history are never reset.
-- Only newly inserted tasks receive links, import events and refreshed contracts.
-- Plain PostgreSQL SQL: no invented CLI --dry-run option.

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, pg_temp;

DO $draft_guard$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'DOCTOR_SUIT_M1_DRAFT_NOT_IMPORT_READY',
    DETAIL = 'Live consumer/schema/routing and legacy task history are not verified. This handoff intentionally refuses to import.',
    HINT = 'Review the accompanying validation report and read-only preflight. Obtain a reviewed import revision and separate operator authorization; do not bypass this guard.';
END;
$draft_guard$;

-- REQUIRED INPUTS FOR A FUTURE REVIEWED REVISION. These NULLs are deliberate.
-- Evidence references are not credentials and do not approve execution.
CREATE TEMP TABLE _dos_m1_context (
  project_slug text,
  workstream_slug text,
  suit_slug text,
  repository text NOT NULL,
  application_path text NOT NULL,
  consumer_review_evidence text,
  legacy_reconciliation_evidence text,
  scope_approval_evidence text,
  expected_contract_hashes jsonb NOT NULL
) ON COMMIT DROP;
INSERT INTO _dos_m1_context VALUES (
  NULL, NULL, NULL,
  'Building-Suit/building-suit-monorepo', 'apps/doctor-suit',
  NULL, NULL, NULL, '{}'::jsonb
);

CREATE TEMP TABLE _dos_m1_payload (document jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO _dos_m1_payload(document) VALUES (
$doctor_suit_m1_payload$
{
  "artifact_revision": "v0.2",
  "generated_date": "2026-10-16",
  "project_name": "Doctor Suit",
  "previous_name": "Clinic Suit",
  "source_repository": "Building-Suit/building-suit-monorepo",
  "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
  "requirements": [
    {
      "requirement_id": "DOS-M1-R001",
      "title": "Doctor-centered practice ownership",
      "summary": "The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.",
      "status": "approved",
      "provenance": "User original intake; naming confirmed by subsequent Doctor Suit request."
    },
    {
      "requirement_id": "DOS-M1-R002",
      "title": "Multiple doctors, clinics and delegated secretary memberships",
      "summary": "Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.",
      "status": "approved",
      "provenance": "User original intake."
    },
    {
      "requirement_id": "DOS-M1-R003",
      "title": "Website first; mobile remains part of the product",
      "summary": "The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.",
      "status": "approved",
      "provenance": "User latest request and original mobile requirement; interpretation explicitly open."
    },
    {
      "requirement_id": "DOS-M1-R004",
      "title": "No cross-practice data leakage or invented authority",
      "summary": "Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.",
      "status": "proposed",
      "provenance": "Planning safety baseline; not a medical/legal certification."
    },
    {
      "requirement_id": "DOS-M1-R005",
      "title": "Current shared architecture and execution ownership",
      "summary": "If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.",
      "status": "proposed",
      "provenance": "Inspected repository rules and worker; target-repository adoption remains open."
    },
    {
      "requirement_id": "DOS-M1-F001",
      "title": "Website scope, user journeys and implementation contract",
      "summary": "Produce the implementation-facing website specification from this intake and the inspected repository rules. Reconcile any recovered Clinic Suit IDs/history before assigning replacements. Separate the public site, doctor web portal and secretary web portal; mobile remains later. Acceptance: Document approved facts separately from the proposed web-first interpretation and open decisions. Describe doctor-alone and delegated workflows, multiple locations, multi-doctor secretaries, and persistent doctor ownership. Publish a route/template inventory, permission matrix, synthetic-data policy and traceable acceptance checklist; unresolved choices stay open. Identify the actual registered execution route and verification/publication gaps without changing runtime configuration or declaring compatibility.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-001."
    },
    {
      "requirement_id": "DOS-M1-F002",
      "title": "Doctor Suit web scaffold and workspace registration",
      "summary": "Create the Doctor Suit app only after the target-repository decision. Use the maintained new-platform generator and shared Nuxt layer; add the minimal repository wiring needed for a local synthetic preview. Acceptance: Inspect pnpm new:platform doctor-suit \"Doctor Suit\" --dry-run before generation; do not copy another product app. Use BsAppRoot, shared layouts and one registered complete template per route with zero migration debt. Provide scoped AGENTS, environment examples with no values, app manifest, local-preview instructions and the minimum root registration diff. Do not provision a hosted project, choose unverified ports/domain/provider refs or activate a public release product. Create an app-local Playwright configuration and synthetic-browser fixture harness at apps/doctor-suit/tests/e2e/playwright.config.ts; select collision-free local ports and ensure remote backend URLs are rejected. The named control-plane command is registered separately by the authorized operator, not by this task.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-002."
    },
    {
      "requirement_id": "DOS-M1-F003",
      "title": "Isolated practice identity and disposable data foundation",
      "summary": "Implement the local Doctor Suit identity/practice/membership data boundary and disposable verification fixtures before protected web workflows. Treat the doctor practice as the ownership scope and locations as context. Acceptance: Use an app-owned local Supabase root and forward migrations; production/staging refs remain unprovisioned. Separate user identity, doctor practice, location and membership; memberships do not confer cross-practice access. Every protected operation validates the server-side practice/context and auditable actor. Create deterministic synthetic fixtures for two doctors, shared secretary, two locations and an outsider; register no hosted writes.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-003."
    },
    {
      "requirement_id": "DOS-M1-F004",
      "title": "Shared web shells and complete page-template contracts",
      "summary": "Deliver the public and authenticated web shells through shared presentation templates, including explicit doctor/practice/location context, navigation and reliable interaction states. Acceptance: All new visual composition is exported from packages/ui; product queries remain in Doctor Suit adapters. The active doctor/practice/location is persistently clear; switching context clears sensitive caches and drafts. Navigation, keyboard/focus, dirty-state warnings, loading/empty/error/denied states work from the first slice. English/Arabic, LTR/RTL and light/dark use existing repository infrastructure if the monorepo decision is approved.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-004."
    },
    {
      "requirement_id": "DOS-M1-F005",
      "title": "Public product website and truthful feature presentation",
      "summary": "Build the Doctor Suit public homepage and product explanation around the doctor-across-clinics model using the shared landing template. Acceptance: Explain doctor ownership, location independence, delegated staff and future patient/mobile continuity using approved content. Separate implemented, preview and planned capabilities; no fabricated customers, reviews, compliance badges or release history. Do not invent pricing, trial length, payment availability, download links or production onboarding. Primary actions go to a real approved route; use a preview/explanation state rather than fake submission or account creation.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-005."
    },
    {
      "requirement_id": "DOS-M1-F006",
      "title": "Doctor authentication and account recovery",
      "summary": "Implement the doctor web identity lifecycle using existing shared auth templates and product-isolated session adapters, with no cross-product SSO by implication. Acceptance: Support sign-up/sign-in/sign-out, verification and recovery states with explicit provider configuration gates. Do not infer a verified identity or ownership from matching email/phone or editable metadata. Validate redirects/callbacks and preserve product/environment cookie isolation. Expiry, retries, refresh and errors cannot leave an authenticated-looking but unauthorized session.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-006."
    },
    {
      "requirement_id": "DOS-M1-F007",
      "title": "Doctor-led practice onboarding and profile",
      "summary": "Let an authenticated doctor create and maintain a practice profile and reach a usable workspace without employing a secretary. The doctor is the future subscriber; no paid entitlement is fabricated. Acceptance: A doctor can complete onboarding alone and add an initial location. Onboarding is resumable and idempotent; double-submit does not create duplicate practices. Store only the approved profile fields; professional verification is not asserted unless independently established. Show incomplete configuration honestly; later subscription rules do not block a synthetic preview.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-007."
    },
    {
      "requirement_id": "DOS-M1-F008",
      "title": "Multiple clinic locations and practice context switching",
      "summary": "Let a doctor manage multiple working locations without making a location the owner of their practice records. Acceptance: Create/edit/archive locations and configure contact/schedule context without deleting linked history. A doctor retains practice-level patients while encounters/appointments retain location attribution. Location visibility honors membership grants; no inference from a client-selected location ID. Use an explicit configurable timezone; do not hardcode fixed UTC offsets.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-008."
    },
    {
      "requirement_id": "DOS-M1-F009",
      "title": "Secretary invitations and multi-doctor memberships",
      "summary": "Enable invited secretaries to use one Doctor Suit identity across independent doctor memberships without becoming subscribers or mixing practices. Acceptance: Invitation acceptance validates intended recipient, expiry, membership scope and idempotency. The same secretary can belong to two practices with different location grants. Revocation/suspension invalidates protected access according to tested session/cache guarantees. No secretary subscription is created and no other doctor membership is changed by this invitation.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-009."
    },
    {
      "requirement_id": "DOS-M1-F010",
      "title": "Granular delegation enforced in the backend",
      "summary": "Implement explicit capabilities for patient administration, scheduling, intake, documents and settings scoped to doctor/location. Presentation reflects authorization but is not its boundary. Acceptance: Doctor can grant only selected capabilities or all approved delegable administrative capabilities. Every command/query/attachment access path enforces matching backend grants. No capability grants access to another doctor; no implicit employee-to-owner escalation. Clinical signing and prescribing authority are not implemented in M1; the later physician-only boundary remains a safety decision, not a secretary role shortcut.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-010."
    },
    {
      "requirement_id": "DOS-M1-F011",
      "title": "Patient directory and safe administrative CRUD",
      "summary": "Provide the authorized doctor/secretary patient-administration web flow: create, search, paginate, edit and archive the doctor-practice patient record. Acceptance: Use server-side scoped search/pagination and explicit empty/error/denied states. A shared phone number or matching name never automatically merges people or grants a patient app account. Create/update is validated and retry-safe; concurrent updates cannot silently overwrite identity data. Archive preserves referenced records; no bulk hard-delete or cross-doctor patient discovery.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-011."
    },
    {
      "requirement_id": "DOS-M1-F012",
      "title": "Patient profile, administrative timeline and private documents",
      "summary": "Deliver a usable patient profile with demographics, administrative activity and authorized document upload/view. This is not yet a signed clinical record or patient-facing portal. Acceptance: Show explicit doctor/location provenance and distinguish entered data from verified data. Attachments have private storage, type/size validation and scoped access; no public object URL. Record uploader, timestamps and replacement/archive history; downloading requires current access. No clinical findings, prescription efficacy, identity verification or result interpretation is invented.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-012."
    },
    {
      "requirement_id": "DOS-M1-F013",
      "title": "Working hours, availability and appointment rules",
      "summary": "Configure doctor/location working hours, exceptions, slot duration and conflict detection for a browser-based schedule. Acceptance: The same doctor cannot silently book overlapping commitments across different locations. Respect explicit timezone, exceptions and location permissions. Availability and booking share one authoritative conflict rule. Override policy, if any, is explicit and auditable rather than a client bypass.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-013."
    },
    {
      "requirement_id": "DOS-M1-F014",
      "title": "Appointments, check-in and live waiting queue",
      "summary": "Deliver booking/rescheduling/cancellation/check-in and an operational queue without prescribing or billing scope. Acceptance: Use explicit appointment states and allowed transitions; no illegal double-check-in. Rescheduling and cancellation preserve history and are retry-safe. Queue updates remain scoped, recover after reconnect and do not leak other doctors. Notifications beyond in-app status updates remain gated; no unapproved SMS/WhatsApp service is enabled.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-014."
    },
    {
      "requirement_id": "DOS-M1-F015",
      "title": "Doctor and secretary operational web dashboards",
      "summary": "Provide each authorized actor with a real-data Today view, appointments, waiting queue and relevant administrative actions rather than a generic placeholder dashboard. Acceptance: Metrics and lists use authoritative scoped queries and agreed time windows, not only loaded page rows. Doctor sees all authorized locations; secretary sees only granted capabilities and locations. Every displayed item links to its permitted source record. No unsupported financial/clinical metric or fabricated sample result is shown outside clearly labeled demo fixtures.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-015."
    },
    {
      "requirement_id": "DOS-M1-F016",
      "title": "Profile, security and communication-preference settings",
      "summary": "Provide product-scoped account/profile settings and nonclinical communication preferences, with safe session and ownership boundaries. Acceptance: Separate personal account profile, doctor practice profile and membership permissions. Sensitive settings require the configured reauthentication/authorization policy. Preferences are explicit and scoped; do not enroll people in marketing or enable paid channels. Unsupported subscription/export controls are absent or truthfully unavailable, not fake successful buttons.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-016."
    },
    {
      "requirement_id": "DOS-M1-F017",
      "title": "Audit visibility and administrative data-preservation controls",
      "summary": "Expose a permission-scoped audit view and safe archival/correction behavior for M1 administrative records, while preparing the explicit real-data governance gate. Acceptance: Audit covers administrative writes, invitations/grants and document access according to approved policy. Client users cannot modify audit events or silently erase linked history. No clinical bulk export, erasure or retention period is guessed; unresolved policies remain disabled and documented. Audit view is scoped, searchable and excludes credentials or unnecessary sensitive payloads.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-017."
    },
    {
      "requirement_id": "DOS-M1-F018",
      "title": "Responsive web, accessibility and failure-recovery acceptance",
      "summary": "Close measurable cross-journey usability gaps in the working website/portal, rather than deferring foundational UX until the end. Acceptance: All M1 critical journeys work on narrow mobile browser and desktop in both approved locales/themes. Keyboard/focus/labels, validation, overlays and reduced-motion settings are verified. Slow/offline/reconnect and repeated actions show honest unsaved state; M1 does not promise offline clinical writes. Shared fixes remain centralized with affected consumer regression coverage.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-018."
    },
    {
      "requirement_id": "DOS-M1-F019",
      "title": "Public metadata, support paths and website preview readiness",
      "summary": "Complete public-site metadata and support/navigation behavior while keeping private routes unindexed and future capabilities clearly separated from released functionality. Acceptance: Public titles/descriptions, canonical URL configuration and locale metadata are correct after domain approval. Private/authenticated pages are not exposed through generated sitemaps, public caches or share metadata. Use only approved brand assets/copy and actual support destinations; no fabricated app-store links or pricing. Prepare release fragments/checks and a preview handoff; do not merge, deploy, activate release registration or publish a released version.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-019."
    },
    {
      "requirement_id": "DOS-M1-F020",
      "title": "Milestone 1 end-to-end verification and owner demo handoff",
      "summary": "Independently verify the full synthetic website/doctor/secretary vertical slice and prepare an evidence-backed milestone acceptance packet. This is not clinical or commercial launch approval. Acceptance: Doctor alone can onboard, add two clinics, create a patient, book/check in and review their queue/profile. Shared secretary can accept two doctor invitations and perform only granted actions without data leakage. All required unit, local data-authorization, browser, shared-consumer, boundary, lint/typecheck/build checks have exact evidence. Report implemented versus verified versus published/integrated/deployed separately; real patients, payment, prescribing and mobile availability remain gated.",
      "status": "proposed",
      "provenance": "Proposed decomposition of this intake; task DOS-M1-020."
    }
  ],
  "decisions": [
    {
      "decision_id": "DOS-M1-GATE-START",
      "title": "Explicit owner start and verified import/admission gate",
      "decision_text": "Remain OPEN. Before release: verify active consumer/effective schema, actual Doctor Suit registry, safe pause/stop state, existing history/IDs, task/requirement/decision links, publication paths, verification executable mappings and approved M1 scope. No SQL import or artifact generation constitutes approval to execute.",
      "status": "open",
      "source": "Unresolved operator gate; no approval supplied."
    },
    {
      "decision_id": "DOS-M1-D001",
      "title": "Meaning of Website in milestone 1",
      "decision_text": "Proposed: public website plus usable doctor/secretary browser portal, with native doctor/patient apps later. Alternative: public marketing site only, which requires reducing this 20-task milestone before import.",
      "status": "open",
      "source": "Latest user request is website-first; detailed interpretation is not yet approved."
    },
    {
      "decision_id": "DOS-M1-D002",
      "title": "Repository, shared standards and execution registration",
      "decision_text": "Proposed target is the inspected Building-Suit/building-suit-monorepo with new apps/doctor-suit and a separate doctor-suit stack. Confirm this placement, branding/localization, registered routing, path boundaries and configured model/retry/verification policies. Do not auto-register or widen an existing project.",
      "status": "open",
      "source": "Repository inspected for compatibility; placement is a proposal, not an observed implementation."
    },
    {
      "decision_id": "DOS-M1-D003",
      "title": "Patient identity and administrative minimum dataset",
      "decision_text": "Approve minimal administrative fields and duplicate handling, doctor-practice record scope, archive/correction behavior and permitted secretary actions. Matching phone/email must not automatically merge patients, grant an app account or expose another doctor record.",
      "status": "open",
      "source": "Domain data contract requires owner review before implementation beyond synthetic examples."
    },
    {
      "decision_id": "DOS-M1-D004",
      "title": "Website brand, public domain and approved claims",
      "decision_text": "Approve Doctor Suit brand assets, public copy/support destinations and eventual domain. Until prices, trial and store releases are approved and verified, do not publish invented values or working-download claims.",
      "status": "open",
      "source": "No approved Doctor Suit domain, logo assets, pricing or trial policy supplied."
    }
  ],
  "tasks": [
    {
      "task_id": "DOS-M1-001",
      "milestone_id": "DOS-M1",
      "sequence": 10,
      "priority": 100,
      "title": "Website scope, user journeys and implementation contract",
      "description": "Objective\nProduce the implementation-facing website specification from this intake and the inspected repository rules. Reconcile any recovered Clinic Suit IDs/history before assigning replacements. Separate the public site, doctor web portal and secretary web portal; mobile remains later.\n\nRelevant requirements (self-contained)\n- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F001: Produce the implementation-facing website specification from this intake and the inspected repository rules. Reconcile any recovered Clinic Suit IDs/history before assigning replacements. Separate the public site, doctor web portal and secretary web portal; mobile remains later. Acceptance: Document approved facts separately from the proposed web-first interpretation and open decisions. Describe doctor-alone and delegated workflows, multiple locations, multi-doctor secretaries, and persistent doctor ownership. Publish a route/template inventory, permission matrix, synthetic-data policy and traceable acceptance checklist; unresolved choices stay open. Identify the actual registered execution route and verification/publication gaps without changing runtime configuration or declaring compatibility.\n\nPrerequisites\nNo product task prerequisite; owner/runtime gates still apply.\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: docs/work-packages/doctor-suit/, release-fragments/, release-changes/items.json, tooling/checks/dos-m1-contract.test.mjs. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Document approved facts separately from the proposed web-first interpretation and open decisions.\n2. Describe doctor-alone and delegated workflows, multiple locations, multi-doctor secretaries, and persistent doctor ownership.\n3. Publish a route/template inventory, permission matrix, synthetic-data policy and traceable acceptance checklist; unresolved choices stay open.\n4. Identify the actual registered execution route and verification/publication gaps without changing runtime configuration or declaring compatibility.\n\nVerification scenarios\n- Trace each supplied user outcome to the proposed milestones.\n- Check recovered historical IDs for overlap; absence of old files must remain recorded.\n- Review all navigation states with no fabricated product or legal claims.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "docs",
      "risk_level": "normal",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Document approved facts separately from the proposed web-first interpretation and open decisions.",
        "Describe doctor-alone and delegated workflows, multiple locations, multi-doctor secretaries, and persistent doctor ownership.",
        "Publish a route/template inventory, permission matrix, synthetic-data policy and traceable acceptance checklist; unresolved choices stay open.",
        "Identify the actual registered execution route and verification/publication gaps without changing runtime configuration or declaring compatibility."
      ],
      "verification_plan": [
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
          "description": "Create the traceable website contract and a deterministic traceability regression check; owner content approval remains separate",
          "expected_outputs": [
            "docs/work-packages/doctor-suit/website-contract-v0.2.md",
            "tooling/checks/dos-m1-contract.test.mjs"
          ],
          "commands": [
            "pnpm test"
          ]
        }
      ],
      "task_dependencies": [],
      "linked_requirement_ids": [
        "DOS-M1-F001",
        "DOS-M1-R001",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "docs/work-packages/doctor-suit/",
        "release-fragments/",
        "release-changes/items.json",
        "tooling/checks/dos-m1-contract.test.mjs"
      ],
      "expected_outputs": [
        "docs/work-packages/doctor-suit/website-contract-v0.2.md",
        "tooling/checks/dos-m1-contract.test.mjs"
      ],
      "verification_scenarios": [
        "Trace each supplied user outcome to the proposed milestones.",
        "Check recovered historical IDs for overlap; absence of old files must remain recorded.",
        "Review all navigation states with no fabricated product or legal claims."
      ],
      "objective": "Produce the implementation-facing website specification from this intake and the inspected repository rules. Reconcile any recovered Clinic Suit IDs/history before assigning replacements. Separate the public site, doctor web portal and secretary web portal; mobile remains later.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "docs/work-packages/doctor-suit/",
          "release-fragments/",
          "release-changes/items.json",
          "tooling/checks/dos-m1-contract.test.mjs"
        ],
        "source_allowed_paths": [
          "docs/work-packages/doctor-suit/",
          "release-fragments/",
          "release-changes/items.json",
          "tooling/checks/dos-m1-contract.test.mjs"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-002",
      "milestone_id": "DOS-M1",
      "sequence": 20,
      "priority": 100,
      "title": "Doctor Suit web scaffold and workspace registration",
      "description": "Objective\nCreate the Doctor Suit app only after the target-repository decision. Use the maintained new-platform generator and shared Nuxt layer; add the minimal repository wiring needed for a local synthetic preview.\n\nRelevant requirements (self-contained)\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F002: Create the Doctor Suit app only after the target-repository decision. Use the maintained new-platform generator and shared Nuxt layer; add the minimal repository wiring needed for a local synthetic preview. Acceptance: Inspect pnpm new:platform doctor-suit \"Doctor Suit\" --dry-run before generation; do not copy another product app. Use BsAppRoot, shared layouts and one registered complete template per route with zero migration debt. Provide scoped AGENTS, environment examples with no values, app manifest, local-preview instructions and the minimum root registration diff. Do not provision a hosted project, choose unverified ports/domain/provider refs or activate a public release product. Create an app-local Playwright configuration and synthetic-browser fixture harness at apps/doctor-suit/tests/e2e/playwright.config.ts; select collision-free local ports and ensure remote backend URLs are rejected. The named control-plane command is registered separately by the authorized operator, not by this task.\n\nPrerequisites\nDOS-M1-001\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, turbo.json, docs/shared/ui-ownership-manifest.json, packages/ui/src/templates/, packages/ui/package.json, docs/work-packages/doctor-suit/, release-fragments/, release-changes/items.json. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Inspect pnpm new:platform doctor-suit \"Doctor Suit\" --dry-run before generation; do not copy another product app.\n2. Use BsAppRoot, shared layouts and one registered complete template per route with zero migration debt.\n3. Provide scoped AGENTS, environment examples with no values, app manifest, local-preview instructions and the minimum root registration diff.\n4. Do not provision a hosted project, choose unverified ports/domain/provider refs or activate a public release product.\n5. Create an app-local Playwright configuration and synthetic-browser fixture harness at apps/doctor-suit/tests/e2e/playwright.config.ts; select collision-free local ports and ensure remote backend URLs are rejected. The named control-plane command is registered separately by the authorized operator, not by this task.\n\nVerification scenarios\n- Run generator fixture/boundary checks and verify new routes are discovered.\n- Build the app with placeholder-safe local configuration.\n- Verify no Shop/Ledger imports, copied tenants, secrets or app-local component layer.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "normal",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Inspect pnpm new:platform doctor-suit \"Doctor Suit\" --dry-run before generation; do not copy another product app.",
        "Use BsAppRoot, shared layouts and one registered complete template per route with zero migration debt.",
        "Provide scoped AGENTS, environment examples with no values, app manifest, local-preview instructions and the minimum root registration diff.",
        "Do not provision a hosted project, choose unverified ports/domain/provider refs or activate a public release product.",
        "Create an app-local Playwright configuration and synthetic-browser fixture harness at apps/doctor-suit/tests/e2e/playwright.config.ts; select collision-free local ports and ensure remote backend URLs are rejected. The named control-plane command is registered separately by the authorized operator, not by this task."
      ],
      "verification_plan": [
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
            "pnpm test"
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
        }
      ],
      "task_dependencies": [
        "DOS-M1-001"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "turbo.json",
        "docs/shared/ui-ownership-manifest.json",
        "packages/ui/src/templates/",
        "packages/ui/package.json",
        "docs/work-packages/doctor-suit/",
        "release-fragments/",
        "release-changes/items.json"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-002.test.mjs"
      ],
      "verification_scenarios": [
        "Run generator fixture/boundary checks and verify new routes are discovered.",
        "Build the app with placeholder-safe local configuration.",
        "Verify no Shop/Ledger imports, copied tenants, secrets or app-local component layer."
      ],
      "objective": "Create the Doctor Suit app only after the target-repository decision. Use the maintained new-platform generator and shared Nuxt layer; add the minimal repository wiring needed for a local synthetic preview.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "turbo.json",
          "docs/shared/ui-ownership-manifest.json",
          "packages/ui/src/templates/",
          "packages/ui/package.json",
          "docs/work-packages/doctor-suit/",
          "release-fragments/",
          "release-changes/items.json"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "turbo.json",
          "docs/shared/ui-ownership-manifest.json",
          "packages/ui/src/templates/",
          "packages/ui/package.json",
          "docs/work-packages/doctor-suit/",
          "release-fragments/",
          "release-changes/items.json"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-003",
      "milestone_id": "DOS-M1",
      "sequence": 30,
      "priority": 100,
      "title": "Isolated practice identity and disposable data foundation",
      "description": "Objective\nImplement the local Doctor Suit identity/practice/membership data boundary and disposable verification fixtures before protected web workflows. Treat the doctor practice as the ownership scope and locations as context.\n\nRelevant requirements (self-contained)\n- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F003: Implement the local Doctor Suit identity/practice/membership data boundary and disposable verification fixtures before protected web workflows. Treat the doctor practice as the ownership scope and locations as context. Acceptance: Use an app-owned local Supabase root and forward migrations; production/staging refs remain unprovisioned. Separate user identity, doctor practice, location and membership; memberships do not confer cross-practice access. Every protected operation validates the server-side practice/context and auditable actor. Create deterministic synthetic fixtures for two doctors, shared secretary, two locations and an outsider; register no hosted writes.\n\nPrerequisites\nDOS-M1-002\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/supabase/, apps/doctor-suit/app/, apps/doctor-suit/tests/, docs/work-packages/doctor-suit/, release-fragments/, release-changes/items.json. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Use an app-owned local Supabase root and forward migrations; production/staging refs remain unprovisioned.\n2. Separate user identity, doctor practice, location and membership; memberships do not confer cross-practice access.\n3. Every protected operation validates the server-side practice/context and auditable actor.\n4. Create deterministic synthetic fixtures for two doctors, shared secretary, two locations and an outsider; register no hosted writes.\n\nVerification scenarios\n- Test anonymous, doctor A, doctor B, secretary and outsider access with two simultaneous sessions.\n- Reject client-supplied ownership and user-editable metadata escalation.\n- Run the exact product-local migration/reset/test lifecycle in a disposable environment.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "database",
      "risk_level": "critical",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Use an app-owned local Supabase root and forward migrations; production/staging refs remain unprovisioned.",
        "Separate user identity, doctor practice, location and membership; memberships do not confer cross-practice access.",
        "Every protected operation validates the server-side practice/context and auditable actor.",
        "Create deterministic synthetic fixtures for two doctors, shared secretary, two locations and an outsider; register no hosted writes."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
          ],
          "requires": [
            "database",
            "rls-authorization"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-002"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F003",
        "DOS-M1-R001",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/app/",
        "apps/doctor-suit/tests/",
        "docs/work-packages/doctor-suit/",
        "release-fragments/",
        "release-changes/items.json"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-003.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-003.sql"
      ],
      "verification_scenarios": [
        "Test anonymous, doctor A, doctor B, secretary and outsider access with two simultaneous sessions.",
        "Reject client-supplied ownership and user-editable metadata escalation.",
        "Run the exact product-local migration/reset/test lifecycle in a disposable environment."
      ],
      "objective": "Implement the local Doctor Suit identity/practice/membership data boundary and disposable verification fixtures before protected web workflows. Treat the doctor practice as the ownership scope and locations as context.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/work-packages/doctor-suit/",
          "release-fragments/",
          "release-changes/items.json"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/work-packages/doctor-suit/",
          "release-fragments/",
          "release-changes/items.json"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-004",
      "milestone_id": "DOS-M1",
      "sequence": 40,
      "priority": 100,
      "title": "Shared web shells and complete page-template contracts",
      "description": "Objective\nDeliver the public and authenticated web shells through shared presentation templates, including explicit doctor/practice/location context, navigation and reliable interaction states.\n\nRelevant requirements (self-contained)\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F004: Deliver the public and authenticated web shells through shared presentation templates, including explicit doctor/practice/location context, navigation and reliable interaction states. Acceptance: All new visual composition is exported from packages/ui; product queries remain in Doctor Suit adapters. The active doctor/practice/location is persistently clear; switching context clears sensitive caches and drafts. Navigation, keyboard/focus, dirty-state warnings, loading/empty/error/denied states work from the first slice. English/Arabic, LTR/RTL and light/dark use existing repository infrastructure if the monorepo decision is approved.\n\nPrerequisites\nDOS-M1-002\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. All new visual composition is exported from packages/ui; product queries remain in Doctor Suit adapters.\n2. The active doctor/practice/location is persistently clear; switching context clears sensitive caches and drafts.\n3. Navigation, keyboard/focus, dirty-state warnings, loading/empty/error/denied states work from the first slice.\n4. English/Arabic, LTR/RTL and light/dark use existing repository infrastructure if the monorepo decision is approved.\n\nVerification scenarios\n- Exercise context switches with unsaved data and stale async responses.\n- Run strict template boundaries and affected shared-component checks.\n- Preview narrow mobile browser and desktop without hidden actions or keyboard traps.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "high",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "All new visual composition is exported from packages/ui; product queries remain in Doctor Suit adapters.",
        "The active doctor/practice/location is persistently clear; switching context clears sensitive caches and drafts.",
        "Navigation, keyboard/focus, dirty-state warnings, loading/empty/error/denied states work from the first slice.",
        "English/Arabic, LTR/RTL and light/dark use existing repository infrastructure if the monorepo decision is approved."
      ],
      "verification_plan": [
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
            "pnpm test"
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
        }
      ],
      "task_dependencies": [
        "DOS-M1-002"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F004",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-004.test.mjs"
      ],
      "verification_scenarios": [
        "Exercise context switches with unsaved data and stale async responses.",
        "Run strict template boundaries and affected shared-component checks.",
        "Preview narrow mobile browser and desktop without hidden actions or keyboard traps."
      ],
      "objective": "Deliver the public and authenticated web shells through shared presentation templates, including explicit doctor/practice/location context, navigation and reliable interaction states.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-005",
      "milestone_id": "DOS-M1",
      "sequence": 50,
      "priority": 100,
      "title": "Public product website and truthful feature presentation",
      "description": "Objective\nBuild the Doctor Suit public homepage and product explanation around the doctor-across-clinics model using the shared landing template.\n\nRelevant requirements (self-contained)\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F005: Build the Doctor Suit public homepage and product explanation around the doctor-across-clinics model using the shared landing template. Acceptance: Explain doctor ownership, location independence, delegated staff and future patient/mobile continuity using approved content. Separate implemented, preview and planned capabilities; no fabricated customers, reviews, compliance badges or release history. Do not invent pricing, trial length, payment availability, download links or production onboarding. Primary actions go to a real approved route; use a preview/explanation state rather than fake submission or account creation.\n\nPrerequisites\nDOS-M1-001, DOS-M1-004\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D004\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Explain doctor ownership, location independence, delegated staff and future patient/mobile continuity using approved content.\n2. Separate implemented, preview and planned capabilities; no fabricated customers, reviews, compliance badges or release history.\n3. Do not invent pricing, trial length, payment availability, download links or production onboarding.\n4. Primary actions go to a real approved route; use a preview/explanation state rather than fake submission or account creation.\n\nVerification scenarios\n- Check every call to action, internal link and public readiness label.\n- Verify anonymous SSR produces no private records or credentials.\n- Review both languages and mobile navigation for layout/copy parity.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "normal",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Explain doctor ownership, location independence, delegated staff and future patient/mobile continuity using approved content.",
        "Separate implemented, preview and planned capabilities; no fabricated customers, reviews, compliance badges or release history.",
        "Do not invent pricing, trial length, payment availability, download links or production onboarding.",
        "Primary actions go to a real approved route; use a preview/explanation state rather than fake submission or account creation."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-001",
        "DOS-M1-004"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F005",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002",
        "DOS-M1-D004"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-005.test.mjs",
        "apps/doctor-suit/tests/e2e/dos-m1-005.spec.ts"
      ],
      "verification_scenarios": [
        "Check every call to action, internal link and public readiness label.",
        "Verify anonymous SSR produces no private records or credentials.",
        "Review both languages and mobile navigation for layout/copy parity."
      ],
      "objective": "Build the Doctor Suit public homepage and product explanation around the doctor-across-clinics model using the shared landing template.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-006",
      "milestone_id": "DOS-M1",
      "sequence": 60,
      "priority": 100,
      "title": "Doctor authentication and account recovery",
      "description": "Objective\nImplement the doctor web identity lifecycle using existing shared auth templates and product-isolated session adapters, with no cross-product SSO by implication.\n\nRelevant requirements (self-contained)\n- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F006: Implement the doctor web identity lifecycle using existing shared auth templates and product-isolated session adapters, with no cross-product SSO by implication. Acceptance: Support sign-up/sign-in/sign-out, verification and recovery states with explicit provider configuration gates. Do not infer a verified identity or ownership from matching email/phone or editable metadata. Validate redirects/callbacks and preserve product/environment cookie isolation. Expiry, retries, refresh and errors cannot leave an authenticated-looking but unauthorized session.\n\nPrerequisites\nDOS-M1-003, DOS-M1-004\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Support sign-up/sign-in/sign-out, verification and recovery states with explicit provider configuration gates.\n2. Do not infer a verified identity or ownership from matching email/phone or editable metadata.\n3. Validate redirects/callbacks and preserve product/environment cookie isolation.\n4. Expiry, retries, refresh and errors cannot leave an authenticated-looking but unauthorized session.\n\nVerification scenarios\n- Test new/existing user, expired verification, invalid recovery and open-redirect attempts.\n- Test simultaneous Doctor/other-product sessions and cache clearing on logout.\n- Use the local mail/test environment; do not send external email.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "critical",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Support sign-up/sign-in/sign-out, verification and recovery states with explicit provider configuration gates.",
        "Do not infer a verified identity or ownership from matching email/phone or editable metadata.",
        "Validate redirects/callbacks and preserve product/environment cookie isolation.",
        "Expiry, retries, refresh and errors cannot leave an authenticated-looking but unauthorized session."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-003",
        "DOS-M1-004"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F006",
        "DOS-M1-R001",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-006.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-006.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-006.spec.ts"
      ],
      "verification_scenarios": [
        "Test new/existing user, expired verification, invalid recovery and open-redirect attempts.",
        "Test simultaneous Doctor/other-product sessions and cache clearing on logout.",
        "Use the local mail/test environment; do not send external email."
      ],
      "objective": "Implement the doctor web identity lifecycle using existing shared auth templates and product-isolated session adapters, with no cross-product SSO by implication.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-007",
      "milestone_id": "DOS-M1",
      "sequence": 70,
      "priority": 100,
      "title": "Doctor-led practice onboarding and profile",
      "description": "Objective\nLet an authenticated doctor create and maintain a practice profile and reach a usable workspace without employing a secretary. The doctor is the future subscriber; no paid entitlement is fabricated.\n\nRelevant requirements (self-contained)\n- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F007: Let an authenticated doctor create and maintain a practice profile and reach a usable workspace without employing a secretary. The doctor is the future subscriber; no paid entitlement is fabricated. Acceptance: A doctor can complete onboarding alone and add an initial location. Onboarding is resumable and idempotent; double-submit does not create duplicate practices. Store only the approved profile fields; professional verification is not asserted unless independently established. Show incomplete configuration honestly; later subscription rules do not block a synthetic preview.\n\nPrerequisites\nDOS-M1-006\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. A doctor can complete onboarding alone and add an initial location.\n2. Onboarding is resumable and idempotent; double-submit does not create duplicate practices.\n3. Store only the approved profile fields; professional verification is not asserted unless independently established.\n4. Show incomplete configuration honestly; later subscription rules do not block a synthetic preview.\n\nVerification scenarios\n- Resume incomplete onboarding after refresh and another session.\n- Retry/double-submit while checking one practice/one owner membership.\n- Verify a secretary cannot self-promote through onboarding endpoints.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "high",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "A doctor can complete onboarding alone and add an initial location.",
        "Onboarding is resumable and idempotent; double-submit does not create duplicate practices.",
        "Store only the approved profile fields; professional verification is not asserted unless independently established.",
        "Show incomplete configuration honestly; later subscription rules do not block a synthetic preview."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-006"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F007",
        "DOS-M1-R001",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-007.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-007.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-007.spec.ts"
      ],
      "verification_scenarios": [
        "Resume incomplete onboarding after refresh and another session.",
        "Retry/double-submit while checking one practice/one owner membership.",
        "Verify a secretary cannot self-promote through onboarding endpoints."
      ],
      "objective": "Let an authenticated doctor create and maintain a practice profile and reach a usable workspace without employing a secretary. The doctor is the future subscriber; no paid entitlement is fabricated.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-008",
      "milestone_id": "DOS-M1",
      "sequence": 80,
      "priority": 100,
      "title": "Multiple clinic locations and practice context switching",
      "description": "Objective\nLet a doctor manage multiple working locations without making a location the owner of their practice records.\n\nRelevant requirements (self-contained)\n- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F008: Let a doctor manage multiple working locations without making a location the owner of their practice records. Acceptance: Create/edit/archive locations and configure contact/schedule context without deleting linked history. A doctor retains practice-level patients while encounters/appointments retain location attribution. Location visibility honors membership grants; no inference from a client-selected location ID. Use an explicit configurable timezone; do not hardcode fixed UTC offsets.\n\nPrerequisites\nDOS-M1-007\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Create/edit/archive locations and configure contact/schedule context without deleting linked history.\n2. A doctor retains practice-level patients while encounters/appointments retain location attribution.\n3. Location visibility honors membership grants; no inference from a client-selected location ID.\n4. Use an explicit configurable timezone; do not hardcode fixed UTC offsets.\n\nVerification scenarios\n- Test two locations, cross-location patient lookup and restricted secretary access.\n- Archive a location with future appointments and surface a resolution workflow.\n- Check stale browser requests after a context switch cannot overwrite the new context.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "high",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Create/edit/archive locations and configure contact/schedule context without deleting linked history.",
        "A doctor retains practice-level patients while encounters/appointments retain location attribution.",
        "Location visibility honors membership grants; no inference from a client-selected location ID.",
        "Use an explicit configurable timezone; do not hardcode fixed UTC offsets."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-007"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F008",
        "DOS-M1-R001",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-008.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-008.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-008.spec.ts"
      ],
      "verification_scenarios": [
        "Test two locations, cross-location patient lookup and restricted secretary access.",
        "Archive a location with future appointments and surface a resolution workflow.",
        "Check stale browser requests after a context switch cannot overwrite the new context."
      ],
      "objective": "Let a doctor manage multiple working locations without making a location the owner of their practice records.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-009",
      "milestone_id": "DOS-M1",
      "sequence": 90,
      "priority": 100,
      "title": "Secretary invitations and multi-doctor memberships",
      "description": "Objective\nEnable invited secretaries to use one Doctor Suit identity across independent doctor memberships without becoming subscribers or mixing practices.\n\nRelevant requirements (self-contained)\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F009: Enable invited secretaries to use one Doctor Suit identity across independent doctor memberships without becoming subscribers or mixing practices. Acceptance: Invitation acceptance validates intended recipient, expiry, membership scope and idempotency. The same secretary can belong to two practices with different location grants. Revocation/suspension invalidates protected access according to tested session/cache guarantees. No secretary subscription is created and no other doctor membership is changed by this invitation.\n\nPrerequisites\nDOS-M1-006, DOS-M1-008\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Invitation acceptance validates intended recipient, expiry, membership scope and idempotency.\n2. The same secretary can belong to two practices with different location grants.\n3. Revocation/suspension invalidates protected access according to tested session/cache guarantees.\n4. No secretary subscription is created and no other doctor membership is changed by this invitation.\n\nVerification scenarios\n- Test reused/expired/wrong-recipient invitations and concurrent acceptance.\n- Test shared secretary access across two doctors with no mixed lists, search or uploads.\n- Test revocation while the secretary keeps a browser tab open.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "critical",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Invitation acceptance validates intended recipient, expiry, membership scope and idempotency.",
        "The same secretary can belong to two practices with different location grants.",
        "Revocation/suspension invalidates protected access according to tested session/cache guarantees.",
        "No secretary subscription is created and no other doctor membership is changed by this invitation."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-006",
        "DOS-M1-008"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F009",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-009.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-009.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-009.spec.ts"
      ],
      "verification_scenarios": [
        "Test reused/expired/wrong-recipient invitations and concurrent acceptance.",
        "Test shared secretary access across two doctors with no mixed lists, search or uploads.",
        "Test revocation while the secretary keeps a browser tab open."
      ],
      "objective": "Enable invited secretaries to use one Doctor Suit identity across independent doctor memberships without becoming subscribers or mixing practices.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-010",
      "milestone_id": "DOS-M1",
      "sequence": 100,
      "priority": 100,
      "title": "Granular delegation enforced in the backend",
      "description": "Objective\nImplement explicit capabilities for patient administration, scheduling, intake, documents and settings scoped to doctor/location. Presentation reflects authorization but is not its boundary.\n\nRelevant requirements (self-contained)\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F010: Implement explicit capabilities for patient administration, scheduling, intake, documents and settings scoped to doctor/location. Presentation reflects authorization but is not its boundary. Acceptance: Doctor can grant only selected capabilities or all approved delegable administrative capabilities. Every command/query/attachment access path enforces matching backend grants. No capability grants access to another doctor; no implicit employee-to-owner escalation. Clinical signing and prescribing authority are not implemented in M1; the later physician-only boundary remains a safety decision, not a secretary role shortcut.\n\nPrerequisites\nDOS-M1-009\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Doctor can grant only selected capabilities or all approved delegable administrative capabilities.\n2. Every command/query/attachment access path enforces matching backend grants.\n3. No capability grants access to another doctor; no implicit employee-to-owner escalation.\n4. Clinical signing and prescribing authority are not implemented in M1; the later physician-only boundary remains a safety decision, not a secretary role shortcut.\n\nVerification scenarios\n- Exercise each denied operation directly, not just by hiding a button.\n- Test permission changes, revoked memberships, overposted fields and conflicting grants.\n- Audit actor and scope for grant/revoke and privileged administrative writes.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "critical",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Doctor can grant only selected capabilities or all approved delegable administrative capabilities.",
        "Every command/query/attachment access path enforces matching backend grants.",
        "No capability grants access to another doctor; no implicit employee-to-owner escalation.",
        "Clinical signing and prescribing authority are not implemented in M1; the later physician-only boundary remains a safety decision, not a secretary role shortcut."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-009"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F010",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002",
        "DOS-M1-D003"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-010.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-010.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-010.spec.ts"
      ],
      "verification_scenarios": [
        "Exercise each denied operation directly, not just by hiding a button.",
        "Test permission changes, revoked memberships, overposted fields and conflicting grants.",
        "Audit actor and scope for grant/revoke and privileged administrative writes."
      ],
      "objective": "Implement explicit capabilities for patient administration, scheduling, intake, documents and settings scoped to doctor/location. Presentation reflects authorization but is not its boundary.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-011",
      "milestone_id": "DOS-M1",
      "sequence": 110,
      "priority": 100,
      "title": "Patient directory and safe administrative CRUD",
      "description": "Objective\nProvide the authorized doctor/secretary patient-administration web flow: create, search, paginate, edit and archive the doctor-practice patient record.\n\nRelevant requirements (self-contained)\n- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F011: Provide the authorized doctor/secretary patient-administration web flow: create, search, paginate, edit and archive the doctor-practice patient record. Acceptance: Use server-side scoped search/pagination and explicit empty/error/denied states. A shared phone number or matching name never automatically merges people or grants a patient app account. Create/update is validated and retry-safe; concurrent updates cannot silently overwrite identity data. Archive preserves referenced records; no bulk hard-delete or cross-doctor patient discovery.\n\nPrerequisites\nDOS-M1-010\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Use server-side scoped search/pagination and explicit empty/error/denied states.\n2. A shared phone number or matching name never automatically merges people or grants a patient app account.\n3. Create/update is validated and retry-safe; concurrent updates cannot silently overwrite identity data.\n4. Archive preserves referenced records; no bulk hard-delete or cross-doctor patient discovery.\n\nVerification scenarios\n- Test duplicate-name/shared-phone households, pagination and simultaneous edits.\n- Test doctor A versus doctor B and secretary capability variants.\n- Test validation feedback, double-submit, refresh and failed network save.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "critical",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Use server-side scoped search/pagination and explicit empty/error/denied states.",
        "A shared phone number or matching name never automatically merges people or grants a patient app account.",
        "Create/update is validated and retry-safe; concurrent updates cannot silently overwrite identity data.",
        "Archive preserves referenced records; no bulk hard-delete or cross-doctor patient discovery."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-010"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F011",
        "DOS-M1-R001",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002",
        "DOS-M1-D003"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-011.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-011.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-011.spec.ts"
      ],
      "verification_scenarios": [
        "Test duplicate-name/shared-phone households, pagination and simultaneous edits.",
        "Test doctor A versus doctor B and secretary capability variants.",
        "Test validation feedback, double-submit, refresh and failed network save."
      ],
      "objective": "Provide the authorized doctor/secretary patient-administration web flow: create, search, paginate, edit and archive the doctor-practice patient record.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-012",
      "milestone_id": "DOS-M1",
      "sequence": 120,
      "priority": 100,
      "title": "Patient profile, administrative timeline and private documents",
      "description": "Objective\nDeliver a usable patient profile with demographics, administrative activity and authorized document upload/view. This is not yet a signed clinical record or patient-facing portal.\n\nRelevant requirements (self-contained)\n- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F012: Deliver a usable patient profile with demographics, administrative activity and authorized document upload/view. This is not yet a signed clinical record or patient-facing portal. Acceptance: Show explicit doctor/location provenance and distinguish entered data from verified data. Attachments have private storage, type/size validation and scoped access; no public object URL. Record uploader, timestamps and replacement/archive history; downloading requires current access. No clinical findings, prescription efficacy, identity verification or result interpretation is invented.\n\nPrerequisites\nDOS-M1-011\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Show explicit doctor/location provenance and distinguish entered data from verified data.\n2. Attachments have private storage, type/size validation and scoped access; no public object URL.\n3. Record uploader, timestamps and replacement/archive history; downloading requires current access.\n4. No clinical findings, prescription efficacy, identity verification or result interpretation is invented.\n\nVerification scenarios\n- Test unauthorized object access, revoked grants, expired links and interrupted uploads.\n- Test filename/content handling and prevention of accidental public caching.\n- Review usable profile navigation and document failures with synthetic files only.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "critical",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Show explicit doctor/location provenance and distinguish entered data from verified data.",
        "Attachments have private storage, type/size validation and scoped access; no public object URL.",
        "Record uploader, timestamps and replacement/archive history; downloading requires current access.",
        "No clinical findings, prescription efficacy, identity verification or result interpretation is invented."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-011"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F012",
        "DOS-M1-R001",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002",
        "DOS-M1-D003"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-012.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-012.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-012.spec.ts"
      ],
      "verification_scenarios": [
        "Test unauthorized object access, revoked grants, expired links and interrupted uploads.",
        "Test filename/content handling and prevention of accidental public caching.",
        "Review usable profile navigation and document failures with synthetic files only."
      ],
      "objective": "Deliver a usable patient profile with demographics, administrative activity and authorized document upload/view. This is not yet a signed clinical record or patient-facing portal.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-013",
      "milestone_id": "DOS-M1",
      "sequence": 130,
      "priority": 100,
      "title": "Working hours, availability and appointment rules",
      "description": "Objective\nConfigure doctor/location working hours, exceptions, slot duration and conflict detection for a browser-based schedule.\n\nRelevant requirements (self-contained)\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F013: Configure doctor/location working hours, exceptions, slot duration and conflict detection for a browser-based schedule. Acceptance: The same doctor cannot silently book overlapping commitments across different locations. Respect explicit timezone, exceptions and location permissions. Availability and booking share one authoritative conflict rule. Override policy, if any, is explicit and auditable rather than a client bypass.\n\nPrerequisites\nDOS-M1-008, DOS-M1-010\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. The same doctor cannot silently book overlapping commitments across different locations.\n2. Respect explicit timezone, exceptions and location permissions.\n3. Availability and booking share one authoritative conflict rule.\n4. Override policy, if any, is explicit and auditable rather than a client bypass.\n\nVerification scenarios\n- Test simultaneous conflicting writes, boundaries, timezone/day changes and exceptions.\n- Test secretary limited to one location and doctor with multiple clinics.\n- Verify no hidden appointment changes while editing availability.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "high",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "The same doctor cannot silently book overlapping commitments across different locations.",
        "Respect explicit timezone, exceptions and location permissions.",
        "Availability and booking share one authoritative conflict rule.",
        "Override policy, if any, is explicit and auditable rather than a client bypass."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-008",
        "DOS-M1-010"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F013",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-013.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-013.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-013.spec.ts"
      ],
      "verification_scenarios": [
        "Test simultaneous conflicting writes, boundaries, timezone/day changes and exceptions.",
        "Test secretary limited to one location and doctor with multiple clinics.",
        "Verify no hidden appointment changes while editing availability."
      ],
      "objective": "Configure doctor/location working hours, exceptions, slot duration and conflict detection for a browser-based schedule.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-014",
      "milestone_id": "DOS-M1",
      "sequence": 140,
      "priority": 100,
      "title": "Appointments, check-in and live waiting queue",
      "description": "Objective\nDeliver booking/rescheduling/cancellation/check-in and an operational queue without prescribing or billing scope.\n\nRelevant requirements (self-contained)\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F014: Deliver booking/rescheduling/cancellation/check-in and an operational queue without prescribing or billing scope. Acceptance: Use explicit appointment states and allowed transitions; no illegal double-check-in. Rescheduling and cancellation preserve history and are retry-safe. Queue updates remain scoped, recover after reconnect and do not leak other doctors. Notifications beyond in-app status updates remain gated; no unapproved SMS/WhatsApp service is enabled.\n\nPrerequisites\nDOS-M1-011, DOS-M1-013\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Use explicit appointment states and allowed transitions; no illegal double-check-in.\n2. Rescheduling and cancellation preserve history and are retry-safe.\n3. Queue updates remain scoped, recover after reconnect and do not leak other doctors.\n4. Notifications beyond in-app status updates remain gated; no unapproved SMS/WhatsApp service is enabled.\n\nVerification scenarios\n- Exercise two reception sessions updating the same appointment.\n- Test cancellation after check-in and documented resolution behavior.\n- Test reconnect/refetch without duplicate or stale queue entries.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "high",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Use explicit appointment states and allowed transitions; no illegal double-check-in.",
        "Rescheduling and cancellation preserve history and are retry-safe.",
        "Queue updates remain scoped, recover after reconnect and do not leak other doctors.",
        "Notifications beyond in-app status updates remain gated; no unapproved SMS/WhatsApp service is enabled."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-011",
        "DOS-M1-013"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F014",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-014.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-014.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-014.spec.ts"
      ],
      "verification_scenarios": [
        "Exercise two reception sessions updating the same appointment.",
        "Test cancellation after check-in and documented resolution behavior.",
        "Test reconnect/refetch without duplicate or stale queue entries."
      ],
      "objective": "Deliver booking/rescheduling/cancellation/check-in and an operational queue without prescribing or billing scope.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-015",
      "milestone_id": "DOS-M1",
      "sequence": 150,
      "priority": 100,
      "title": "Doctor and secretary operational web dashboards",
      "description": "Objective\nProvide each authorized actor with a real-data Today view, appointments, waiting queue and relevant administrative actions rather than a generic placeholder dashboard.\n\nRelevant requirements (self-contained)\n- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F015: Provide each authorized actor with a real-data Today view, appointments, waiting queue and relevant administrative actions rather than a generic placeholder dashboard. Acceptance: Metrics and lists use authoritative scoped queries and agreed time windows, not only loaded page rows. Doctor sees all authorized locations; secretary sees only granted capabilities and locations. Every displayed item links to its permitted source record. No unsupported financial/clinical metric or fabricated sample result is shown outside clearly labeled demo fixtures.\n\nPrerequisites\nDOS-M1-012, DOS-M1-014\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Metrics and lists use authoritative scoped queries and agreed time windows, not only loaded page rows.\n2. Doctor sees all authorized locations; secretary sees only granted capabilities and locations.\n3. Every displayed item links to its permitted source record.\n4. No unsupported financial/clinical metric or fabricated sample result is shown outside clearly labeled demo fixtures.\n\nVerification scenarios\n- Reconcile counters to synthetic source records and timezone boundaries.\n- Test zero-data, denied and partial-capability dashboards.\n- Test refresh, real-time invalidation and stale-session recovery.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "high",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Metrics and lists use authoritative scoped queries and agreed time windows, not only loaded page rows.",
        "Doctor sees all authorized locations; secretary sees only granted capabilities and locations.",
        "Every displayed item links to its permitted source record.",
        "No unsupported financial/clinical metric or fabricated sample result is shown outside clearly labeled demo fixtures."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-012",
        "DOS-M1-014"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F015",
        "DOS-M1-R001",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-015.test.mjs",
        "apps/doctor-suit/tests/e2e/dos-m1-015.spec.ts"
      ],
      "verification_scenarios": [
        "Reconcile counters to synthetic source records and timezone boundaries.",
        "Test zero-data, denied and partial-capability dashboards.",
        "Test refresh, real-time invalidation and stale-session recovery."
      ],
      "objective": "Provide each authorized actor with a real-data Today view, appointments, waiting queue and relevant administrative actions rather than a generic placeholder dashboard.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-016",
      "milestone_id": "DOS-M1",
      "sequence": 160,
      "priority": 100,
      "title": "Profile, security and communication-preference settings",
      "description": "Objective\nProvide product-scoped account/profile settings and nonclinical communication preferences, with safe session and ownership boundaries.\n\nRelevant requirements (self-contained)\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F016: Provide product-scoped account/profile settings and nonclinical communication preferences, with safe session and ownership boundaries. Acceptance: Separate personal account profile, doctor practice profile and membership permissions. Sensitive settings require the configured reauthentication/authorization policy. Preferences are explicit and scoped; do not enroll people in marketing or enable paid channels. Unsupported subscription/export controls are absent or truthfully unavailable, not fake successful buttons.\n\nPrerequisites\nDOS-M1-006, DOS-M1-010\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Separate personal account profile, doctor practice profile and membership permissions.\n2. Sensitive settings require the configured reauthentication/authorization policy.\n3. Preferences are explicit and scoped; do not enroll people in marketing or enable paid channels.\n4. Unsupported subscription/export controls are absent or truthfully unavailable, not fake successful buttons.\n\nVerification scenarios\n- Test account versus practice updates do not overwrite each other.\n- Test logout/session-expiry and outstanding form state.\n- Test a secretary cannot alter doctor ownership, billing authority or other memberships.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "high",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Separate personal account profile, doctor practice profile and membership permissions.",
        "Sensitive settings require the configured reauthentication/authorization policy.",
        "Preferences are explicit and scoped; do not enroll people in marketing or enable paid channels.",
        "Unsupported subscription/export controls are absent or truthfully unavailable, not fake successful buttons."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-006",
        "DOS-M1-010"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F016",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-016.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-016.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-016.spec.ts"
      ],
      "verification_scenarios": [
        "Test account versus practice updates do not overwrite each other.",
        "Test logout/session-expiry and outstanding form state.",
        "Test a secretary cannot alter doctor ownership, billing authority or other memberships."
      ],
      "objective": "Provide product-scoped account/profile settings and nonclinical communication preferences, with safe session and ownership boundaries.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-017",
      "milestone_id": "DOS-M1",
      "sequence": 170,
      "priority": 100,
      "title": "Audit visibility and administrative data-preservation controls",
      "description": "Objective\nExpose a permission-scoped audit view and safe archival/correction behavior for M1 administrative records, while preparing the explicit real-data governance gate.\n\nRelevant requirements (self-contained)\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F017: Expose a permission-scoped audit view and safe archival/correction behavior for M1 administrative records, while preparing the explicit real-data governance gate. Acceptance: Audit covers administrative writes, invitations/grants and document access according to approved policy. Client users cannot modify audit events or silently erase linked history. No clinical bulk export, erasure or retention period is guessed; unresolved policies remain disabled and documented. Audit view is scoped, searchable and excludes credentials or unnecessary sensitive payloads.\n\nPrerequisites\nDOS-M1-010, DOS-M1-012, DOS-M1-014, DOS-M1-016\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Audit covers administrative writes, invitations/grants and document access according to approved policy.\n2. Client users cannot modify audit events or silently erase linked history.\n3. No clinical bulk export, erasure or retention period is guessed; unresolved policies remain disabled and documented.\n4. Audit view is scoped, searchable and excludes credentials or unnecessary sensitive payloads.\n\nVerification scenarios\n- Attempt client mutation/deletion of audit entries.\n- Reconcile representative create/edit/archive/invite/permission actions to attributed events.\n- Test cross-practice audit queries and document-access history.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "critical",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Audit covers administrative writes, invitations/grants and document access according to approved policy.",
        "Client users cannot modify audit events or silently erase linked history.",
        "No clinical bulk export, erasure or retention period is guessed; unresolved policies remain disabled and documented.",
        "Audit view is scoped, searchable and excludes credentials or unnecessary sensitive payloads."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-010",
        "DOS-M1-012",
        "DOS-M1-014",
        "DOS-M1-016"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F017",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002",
        "DOS-M1-D003"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-017.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-017.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-017.spec.ts"
      ],
      "verification_scenarios": [
        "Attempt client mutation/deletion of audit entries.",
        "Reconcile representative create/edit/archive/invite/permission actions to attributed events.",
        "Test cross-practice audit queries and document-access history."
      ],
      "objective": "Expose a permission-scoped audit view and safe archival/correction behavior for M1 administrative records, while preparing the explicit real-data governance gate.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-018",
      "milestone_id": "DOS-M1",
      "sequence": 180,
      "priority": 100,
      "title": "Responsive web, accessibility and failure-recovery acceptance",
      "description": "Objective\nClose measurable cross-journey usability gaps in the working website/portal, rather than deferring foundational UX until the end.\n\nRelevant requirements (self-contained)\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F018: Close measurable cross-journey usability gaps in the working website/portal, rather than deferring foundational UX until the end. Acceptance: All M1 critical journeys work on narrow mobile browser and desktop in both approved locales/themes. Keyboard/focus/labels, validation, overlays and reduced-motion settings are verified. Slow/offline/reconnect and repeated actions show honest unsaved state; M1 does not promise offline clinical writes. Shared fixes remain centralized with affected consumer regression coverage.\n\nPrerequisites\nDOS-M1-005, DOS-M1-015, DOS-M1-016, DOS-M1-017\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. All M1 critical journeys work on narrow mobile browser and desktop in both approved locales/themes.\n2. Keyboard/focus/labels, validation, overlays and reduced-motion settings are verified.\n3. Slow/offline/reconnect and repeated actions show honest unsaved state; M1 does not promise offline clinical writes.\n4. Shared fixes remain centralized with affected consumer regression coverage.\n\nVerification scenarios\n- Run appointment and patient administrative flows on desktop and mobile viewport.\n- Run keyboard-only and screen-reader-label review; distinguish automated from human findings.\n- Inject network errors and stale responses; prove no duplicate saves or lost context.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "review",
      "risk_level": "high",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "All M1 critical journeys work on narrow mobile browser and desktop in both approved locales/themes.",
        "Keyboard/focus/labels, validation, overlays and reduced-motion settings are verified.",
        "Slow/offline/reconnect and repeated actions show honest unsaved state; M1 does not promise offline clinical writes.",
        "Shared fixes remain centralized with affected consumer regression coverage."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-browser-tests"
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
        }
      ],
      "task_dependencies": [
        "DOS-M1-005",
        "DOS-M1-015",
        "DOS-M1-016",
        "DOS-M1-017"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F018",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-018.test.mjs",
        "apps/doctor-suit/tests/e2e/dos-m1-018.spec.ts"
      ],
      "verification_scenarios": [
        "Run appointment and patient administrative flows on desktop and mobile viewport.",
        "Run keyboard-only and screen-reader-label review; distinguish automated from human findings.",
        "Inject network errors and stale responses; prove no duplicate saves or lost context."
      ],
      "objective": "Close measurable cross-journey usability gaps in the working website/portal, rather than deferring foundational UX until the end.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-019",
      "milestone_id": "DOS-M1",
      "sequence": 190,
      "priority": 100,
      "title": "Public metadata, support paths and website preview readiness",
      "description": "Objective\nComplete public-site metadata and support/navigation behavior while keeping private routes unindexed and future capabilities clearly separated from released functionality.\n\nRelevant requirements (self-contained)\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F019: Complete public-site metadata and support/navigation behavior while keeping private routes unindexed and future capabilities clearly separated from released functionality. Acceptance: Public titles/descriptions, canonical URL configuration and locale metadata are correct after domain approval. Private/authenticated pages are not exposed through generated sitemaps, public caches or share metadata. Use only approved brand assets/copy and actual support destinations; no fabricated app-store links or pricing. Prepare release fragments/checks and a preview handoff; do not merge, deploy, activate release registration or publish a released version.\n\nPrerequisites\nDOS-M1-005, DOS-M1-006, DOS-M1-018\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D004\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Public titles/descriptions, canonical URL configuration and locale metadata are correct after domain approval.\n2. Private/authenticated pages are not exposed through generated sitemaps, public caches or share metadata.\n3. Use only approved brand assets/copy and actual support destinations; no fabricated app-store links or pricing.\n4. Prepare release fragments/checks and a preview handoff; do not merge, deploy, activate release registration or publish a released version.\n\nVerification scenarios\n- Inspect public versus authenticated page source, sitemap and metadata behavior.\n- Test every navigation/support/deep link and missing-route state.\n- Review preview readiness labels against implemented evidence.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "feature",
      "risk_level": "normal",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Public titles/descriptions, canonical URL configuration and locale metadata are correct after domain approval.",
        "Private/authenticated pages are not exposed through generated sitemaps, public caches or share metadata.",
        "Use only approved brand assets/copy and actual support destinations; no fabricated app-store links or pricing.",
        "Prepare release fragments/checks and a preview handoff; do not merge, deploy, activate release registration or publish a released version."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-browser-tests"
          ],
          "requires": [
            "browser"
          ]
        }
      ],
      "task_dependencies": [
        "DOS-M1-005",
        "DOS-M1-006",
        "DOS-M1-018"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F019",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002",
        "DOS-M1-D004"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-019.test.mjs",
        "apps/doctor-suit/tests/e2e/dos-m1-019.spec.ts"
      ],
      "verification_scenarios": [
        "Inspect public versus authenticated page source, sitemap and metadata behavior.",
        "Test every navigation/support/deep link and missing-route state.",
        "Review preview readiness labels against implemented evidence."
      ],
      "objective": "Complete public-site metadata and support/navigation behavior while keeping private routes unindexed and future capabilities clearly separated from released functionality.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "focused",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    },
    {
      "task_id": "DOS-M1-020",
      "milestone_id": "DOS-M1",
      "sequence": 200,
      "priority": 110,
      "title": "Milestone 1 end-to-end verification and owner demo handoff",
      "description": "Objective\nIndependently verify the full synthetic website/doctor/secretary vertical slice and prepare an evidence-backed milestone acceptance packet. This is not clinical or commercial launch approval.\n\nRelevant requirements (self-contained)\n- DOS-M1-R001: The doctor is the account owner and future paying subscriber; a clinic is a working location, not the permanent owner of the practice. The doctor must operate without a secretary.\n- DOS-M1-R002: Doctors can work in multiple clinics with multiple secretaries. A secretary has independently scoped invited memberships with multiple doctors and only the permissions each doctor grants.\n- DOS-M1-R003: The first milestone prioritizes the Website. Doctor and patient mobile experiences remain required later. Interpreting Website as both public site and web portal is an open scope decision.\n- DOS-M1-R004: Backend-enforced access, product/session isolation, audit attribution and synthetic-only development must precede any real-patient pilot. Public copy cannot claim unimplemented or unverified capabilities.\n- DOS-M1-R005: If assigned to the inspected monorepo, reuse shared page templates, PrimeVue through packages/ui and shared UX; maintain zero-native boundaries. The n8n worker leaves verification and publication to the control plane.\n- DOS-M1-F020: Independently verify the full synthetic website/doctor/secretary vertical slice and prepare an evidence-backed milestone acceptance packet. This is not clinical or commercial launch approval. Acceptance: Doctor alone can onboard, add two clinics, create a patient, book/check in and review their queue/profile. Shared secretary can accept two doctor invitations and perform only granted actions without data leakage. All required unit, local data-authorization, browser, shared-consumer, boundary, lint/typecheck/build checks have exact evidence. Report implemented versus verified versus published/integrated/deployed separately; real patients, payment, prescribing and mobile availability remain gated.\n\nPrerequisites\nDOS-M1-001, DOS-M1-002, DOS-M1-003, DOS-M1-004, DOS-M1-005, DOS-M1-006, DOS-M1-007, DOS-M1-008, DOS-M1-009, DOS-M1-010, DOS-M1-011, DOS-M1-012, DOS-M1-013, DOS-M1-014, DOS-M1-015, DOS-M1-016, DOS-M1-017, DOS-M1-018, DOS-M1-019\nDecision gates: DOS-M1-GATE-START, DOS-M1-D001, DOS-M1-D002, DOS-M1-D003, DOS-M1-D004\n\nScope\nAllowed candidate paths: apps/doctor-suit/app/, apps/doctor-suit/supabase/, apps/doctor-suit/tests/, docs/shared/ui-ownership-manifest.json, docs/work-packages/doctor-suit/, packages/contracts/src/, packages/testing/, packages/ui/package.json, packages/ui/src/organisms/, packages/ui/src/templates/, packages/ui/tests/, packages/ux/src/, packages/ux/tests/, release-changes/items.json, release-fragments/. These are proposed output boundaries; registry and exact protected-path authorization must be verified before admission. Do not modify other products.\n\nAcceptance\n1. Doctor alone can onboard, add two clinics, create a patient, book/check in and review their queue/profile.\n2. Shared secretary can accept two doctor invitations and perform only granted actions without data leakage.\n3. All required unit, local data-authorization, browser, shared-consumer, boundary, lint/typecheck/build checks have exact evidence.\n4. Report implemented versus verified versus published/integrated/deployed separately; real patients, payment, prescribing and mobile availability remain gated.\n\nVerification scenarios\n- Run the complete independent two-doctor/two-location/secretary/outsider journey.\n- Run negative authorization and duplicate-write tests, recovery and mobile-browser checks.\n- Produce traceability, defects, screenshots/evidence refs and outstanding owner/domain gates with no self-approved PASS.\n\nExecution boundaries\nThis is a planning task packet, not authority to start execution. Once formally admitted: work only in the assigned worktree; re-read live root/scoped AGENTS and docs/agent-workflows.md; inspect the current same-stack parent and preserve accepted/unrelated work. The worker does not commit, push, merge, deploy, provision providers, edit secrets, import tasks, change runtime registrations, or mutate a hosted database. The control plane owns independent verification and publication. No local LLMs or new API-billed services. Preserve current versions and shared UI architecture; no framework migration. All Suit routes use one registered complete Bs page template from packages/ui; no app-local Vue composition/CSS. Shared behavior belongs in packages/ux. Verify affected existing consumers. Use synthetic identities/patients only until a separately approved real-data gate. Never write a PASS, completed state, clinical approval or publication authorization on behalf of a reviewer. Record exact executed checks and explicit not-run checks. Maintain required curated release provenance without inventing a released version or activating the product.\n\nHandback\nReturn task ID, base/head and parent PR context, changed paths, observable behavior, exact commands and outcomes, new test outputs, unrun checks, permission/data-integrity results, migration status (local/disposable only), unresolved decisions and the canonical checkpoint update. Leave worktree uncommitted for control-plane verification/publication. Do not advance another task.",
      "task_type": "review",
      "risk_level": "critical",
      "model_profile_strategy": "inherit_registered_workstream_then_project",
      "status": "planned",
      "engine_stage": "pending",
      "acceptance_criteria": [
        "Doctor alone can onboard, add two clinics, create a patient, book/check in and review their queue/profile.",
        "Shared secretary can accept two doctor invitations and perform only granted actions without data leakage.",
        "All required unit, local data-authorization, browser, shared-consumer, boundary, lint/typecheck/build checks have exact evidence.",
        "Report implemented versus verified versus published/integrated/deployed separately; real patients, payment, prescribing and mobile availability remain gated."
      ],
      "verification_plan": [
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
            "pnpm test"
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
            "doctor-suit-data-tests"
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
            "doctor-suit-browser-tests"
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
        }
      ],
      "task_dependencies": [
        "DOS-M1-001",
        "DOS-M1-002",
        "DOS-M1-003",
        "DOS-M1-004",
        "DOS-M1-005",
        "DOS-M1-006",
        "DOS-M1-007",
        "DOS-M1-008",
        "DOS-M1-009",
        "DOS-M1-010",
        "DOS-M1-011",
        "DOS-M1-012",
        "DOS-M1-013",
        "DOS-M1-014",
        "DOS-M1-015",
        "DOS-M1-016",
        "DOS-M1-017",
        "DOS-M1-018",
        "DOS-M1-019"
      ],
      "linked_requirement_ids": [
        "DOS-M1-F020",
        "DOS-M1-R001",
        "DOS-M1-R002",
        "DOS-M1-R003",
        "DOS-M1-R004",
        "DOS-M1-R005"
      ],
      "blocking_decision_ids": [
        "DOS-M1-GATE-START",
        "DOS-M1-D001",
        "DOS-M1-D002",
        "DOS-M1-D003",
        "DOS-M1-D004"
      ],
      "allowed_paths": [
        "apps/doctor-suit/app/",
        "apps/doctor-suit/supabase/",
        "apps/doctor-suit/tests/",
        "docs/shared/ui-ownership-manifest.json",
        "docs/work-packages/doctor-suit/",
        "packages/contracts/src/",
        "packages/testing/",
        "packages/ui/package.json",
        "packages/ui/src/organisms/",
        "packages/ui/src/templates/",
        "packages/ui/tests/",
        "packages/ux/src/",
        "packages/ux/tests/",
        "release-changes/items.json",
        "release-fragments/"
      ],
      "expected_outputs": [
        "apps/doctor-suit/tests/unit/dos-m1-020.test.mjs",
        "apps/doctor-suit/supabase/tests/dos-m1-020.sql",
        "apps/doctor-suit/tests/e2e/dos-m1-020.spec.ts"
      ],
      "verification_scenarios": [
        "Run the complete independent two-doctor/two-location/secretary/outsider journey.",
        "Run negative authorization and duplicate-write tests, recovery and mobile-browser checks.",
        "Produce traceability, defects, screenshots/evidence refs and outstanding owner/domain gates with no self-approved PASS."
      ],
      "objective": "Independently verify the full synthetic website/doctor/secretary vertical slice and prepare an evidence-backed milestone acceptance packet. This is not clinical or commercial launch approval.",
      "metadata": {
        "business_priority": "launch-critical-for-web-preview",
        "launch_gate": "synthetic-web-preview",
        "verification_mode": "milestone",
        "scope_approval": "proposed",
        "clinical_live_data_allowed": false,
        "allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/testing/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_allowed_paths": [
          "apps/doctor-suit/app/",
          "apps/doctor-suit/supabase/",
          "apps/doctor-suit/tests/",
          "docs/shared/ui-ownership-manifest.json",
          "docs/work-packages/doctor-suit/",
          "packages/contracts/src/",
          "packages/testing/",
          "packages/ui/package.json",
          "packages/ui/src/organisms/",
          "packages/ui/src/templates/",
          "packages/ui/tests/",
          "packages/ux/src/",
          "packages/ux/tests/",
          "release-changes/items.json",
          "release-fragments/"
        ],
        "source_revision": "c6774d47907f7b09aa0a0e9aa2c45c5687a71c50",
        "artifact_revision": "doctor-suit-v0.2",
        "handoff_source": "current user intake and inspected source; not an execution authorization"
      }
    }
  ],
  "legacy_reconciliation": {
    "old_artifact_bytes_recovered": false,
    "old_requirement_ids_recovered": false,
    "policy": "Additive DOS-M1 namespace only. Never delete, rename, renumber or reopen old Clinic/Doctor records; stop on any collision or overlapping history."
  }
}
$doctor_suit_m1_payload$::jsonb
);

CREATE TEMP TABLE _dos_m1_tasks (
  task_id text PRIMARY KEY, spec jsonb NOT NULL
) ON COMMIT DROP;
INSERT INTO _dos_m1_tasks
SELECT item->>'task_id', item
FROM _dos_m1_payload CROSS JOIN LATERAL jsonb_array_elements(document->'tasks') item;

CREATE TEMP TABLE _dos_m1_requirements (
  requirement_id text PRIMARY KEY, spec jsonb NOT NULL
) ON COMMIT DROP;
INSERT INTO _dos_m1_requirements
SELECT item->>'requirement_id', item
FROM _dos_m1_payload CROSS JOIN LATERAL jsonb_array_elements(document->'requirements') item;

CREATE TEMP TABLE _dos_m1_decisions (
  decision_id text PRIMARY KEY, spec jsonb NOT NULL
) ON COMMIT DROP;
INSERT INTO _dos_m1_decisions
SELECT item->>'decision_id', item
FROM _dos_m1_payload CROSS JOIN LATERAL jsonb_array_elements(document->'decisions') item;

CREATE TEMP TABLE _dos_m1_dependencies (
  task_id text NOT NULL, depends_on_task_id text NOT NULL,
  dependency_type text NOT NULL DEFAULT 'hard',
  PRIMARY KEY(task_id, depends_on_task_id),
  CHECK(task_id <> depends_on_task_id)
) ON COMMIT DROP;
INSERT INTO _dos_m1_dependencies(task_id, depends_on_task_id)
SELECT t.task_id, edge.value
FROM _dos_m1_tasks t CROSS JOIN LATERAL jsonb_array_elements_text(t.spec->'task_dependencies') edge(value);

CREATE TEMP TABLE _dos_m1_requirement_links (
  task_id text NOT NULL, requirement_id text NOT NULL,
  PRIMARY KEY(task_id, requirement_id)
) ON COMMIT DROP;
INSERT INTO _dos_m1_requirement_links
SELECT t.task_id, r.value FROM _dos_m1_tasks t
CROSS JOIN LATERAL jsonb_array_elements_text(t.spec->'linked_requirement_ids') r(value);

CREATE TEMP TABLE _dos_m1_decision_links (
  task_id text NOT NULL, decision_id text NOT NULL, blocking boolean NOT NULL,
  PRIMARY KEY(task_id, decision_id)
) ON COMMIT DROP;
INSERT INTO _dos_m1_decision_links
SELECT t.task_id, d.value, true FROM _dos_m1_tasks t
CROSS JOIN LATERAL jsonb_array_elements_text(t.spec->'blocking_decision_ids') d(value);

CREATE TEMP TABLE _dos_m1_new_tasks (task_id text PRIMARY KEY) ON COMMIT DROP;

-- All definitions below depend on the inspected control.* contract, not on an
-- invented Doctor Suit schema. Unknown newer constraints/triggers remain a
-- compatibility-review obligation and may correctly reject this draft.
DO $seed$
DECLARE
  cfg record;
  pr control.projects%ROWTYPE;
  ws control.workstreams%ROWTYPE;
  su control.suits%ROWTYPE;
  old_task control.tasks%ROWTYPE;
  existing_row record;
  input_row record;
  item jsonb;
  meta jsonb;
  profile_name text;
  relname text;
  contract_key text;
  expected_digest text;
  actual_digest text;
  proc_oid regprocedure;
  has_cycle boolean;
  missing_count integer;
  requirement_ids jsonb;
  dependency_ids jsonb;
  decision_links jsonb;
  incoming_decisions jsonb;
  manifest_hash constant text := '317034b326d04b6cb815d5ca390e8d18782659db04588e231b6e06a4acffd308';
  contract_keys constant text[] := ARRAY[
    'function:control.generic_task_packet(text)',
    'function:control.refresh_publication_readiness_contract(text,text)',
    'function:control.resolved_retry_policy(text)',
    'view:control.ready_tasks'
  ];
BEGIN
  SELECT * INTO STRICT cfg FROM _dos_m1_context;
  IF nullif(btrim(cfg.project_slug),'') IS NULL
     OR nullif(btrim(cfg.workstream_slug),'') IS NULL
     OR nullif(btrim(cfg.suit_slug),'') IS NULL
     OR nullif(btrim(cfg.consumer_review_evidence),'') IS NULL
     OR nullif(btrim(cfg.legacy_reconciliation_evidence),'') IS NULL
     OR nullif(btrim(cfg.scope_approval_evidence),'') IS NULL THEN
    RAISE EXCEPTION 'Verified routing and consumer/legacy/scope evidence are required; no registration is guessed';
  END IF;

  FOREACH relname IN ARRAY ARRAY[
    'control.suits','control.projects','control.workstreams','control.tasks',
    'control.requirements','control.decisions','control.task_requirements',
    'control.task_dependencies','control.task_decisions','control.task_events',
    'control.workflow_runs','control.executions','control.publication_readiness_contracts',
    'control.task_admission_generations','control.ready_tasks'
  ] LOOP
    IF to_regclass(relname) IS NULL THEN
      RAISE EXCEPTION 'Missing reviewed control relation: %', relname;
    END IF;
  END LOOP;

  -- Hashes must be captured and reviewed from the ACTUAL control database.
  -- A matching SQL hash alone does not prove the running worker/controller version.
  FOREACH contract_key IN ARRAY contract_keys LOOP
    expected_digest := cfg.expected_contract_hashes->>contract_key;
    IF expected_digest IS NULL OR expected_digest !~ '^[0-9a-f]{32}$' THEN
      RAISE EXCEPTION 'Missing reviewed definition fingerprint: %', contract_key;
    END IF;
    IF contract_key = 'view:control.ready_tasks' THEN
      actual_digest := md5(pg_get_viewdef('control.ready_tasks'::regclass, true));
    ELSE
      proc_oid := to_regprocedure(substring(contract_key FROM 10));
      IF proc_oid IS NULL THEN RAISE EXCEPTION 'Missing reviewed function: %', contract_key; END IF;
      actual_digest := md5(pg_get_functiondef(proc_oid));
    END IF;
    IF actual_digest IS DISTINCT FROM expected_digest THEN
      RAISE EXCEPTION 'Consumer definition changed; re-review required: %', contract_key;
    END IF;
  END LOOP;

  -- Lock only the target registry rows. No global registry lock or status toggle.
  SELECT * INTO STRICT pr FROM control.projects p WHERE p.slug=cfg.project_slug FOR UPDATE;
  SELECT * INTO STRICT ws FROM control.workstreams w
    WHERE w.project_id=pr.project_id AND w.slug=cfg.workstream_slug FOR UPDATE;
  SELECT * INTO STRICT su FROM control.suits s WHERE s.slug=cfg.suit_slug FOR UPDATE;
  IF pr.github_repository IS DISTINCT FROM cfg.repository
    OR ws.suit_slug IS DISTINCT FROM cfg.suit_slug
    OR ws.application_path IS DISTINCT FROM cfg.application_path
    OR su.app_path IS DISTINCT FROM cfg.application_path
    OR su.stack_key IS DISTINCT FROM ws.stack_key THEN
    RAISE EXCEPTION 'Registered target does not match the reviewed Doctor Suit route/boundary';
  END IF;
  IF ws.active IS DISTINCT FROM false OR su.status IS DISTINCT FROM 'paused' THEN
    RAISE EXCEPTION 'Target must already be inactive/paused through the real operator controls; this seed will not pause or activate it';
  END IF;
  IF EXISTS (
    SELECT 1 FROM control.workflow_runs r
    WHERE r.suit_slug=cfg.suit_slug
      AND (r.status='running'
        OR coalesce((to_jsonb(r)->>'controller_lease_expires_at')::timestamptz, '-infinity'::timestamptz)>now())
  ) OR EXISTS (
    SELECT 1 FROM control.executions e JOIN control.tasks t USING(task_id)
    WHERE t.suit_slug=cfg.suit_slug AND e.status IN ('queued','running')
  ) THEN
    RAISE EXCEPTION 'Target has a live run/lease/execution; reconcile and stop through official controls first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM control.workstreams w WHERE w.project_id=pr.project_id
      AND w.suit_slug <> cfg.suit_slug
      AND (w.application_path=cfg.application_path OR w.suit_slug='clinic-suit')
  ) THEN
    RAISE EXCEPTION 'Potential existing Clinic/Doctor registration alias: reconcile; do not duplicate or rename it implicitly';
  END IF;

  IF (SELECT count(*) FROM _dos_m1_tasks)<>20
    OR (SELECT count(*) FROM _dos_m1_requirements)<>25
    OR (SELECT count(*) FROM _dos_m1_decisions)<>5 THEN
    RAISE EXCEPTION 'Unexpected milestone payload counts';
  END IF;
  IF EXISTS (SELECT 1 FROM _dos_m1_tasks WHERE task_id !~ '^DOS-M1-[0-9]{3}$'
    OR spec->>'status'<>'planned' OR spec->>'engine_stage'<>'pending'
    OR spec->>'task_type' NOT IN ('feature','bug','database','docs','research','review','release','maintenance')
    OR spec->>'risk_level' NOT IN ('low','normal','high','critical')
    OR jsonb_array_length(spec->'acceptance_criteria')=0
    OR jsonb_array_length(spec->'verification_plan')=0) THEN
    RAISE EXCEPTION 'Invalid task identity/type/state or empty acceptance/verification';
  END IF;
  IF EXISTS (SELECT 1 FROM _dos_m1_decisions WHERE spec->>'status'<>'open') THEN
    RAISE EXCEPTION 'This seed cannot approve a decision';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _dos_m1_tasks t
    CROSS JOIN LATERAL jsonb_array_elements_text(t.spec->'allowed_paths') ap(value)
    WHERE ap.value='' OR ap.value LIKE '/%' OR ap.value ~ '(^|/)\.\.(/|$)'
      OR ap.value ~ '[*?\[\{]'
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(pr.allowed_publication_paths) boundary(value)
        WHERE ap.value=rtrim(boundary.value,'/') OR starts_with(ap.value,rtrim(boundary.value,'/')||'/')
      )
  ) THEN
    RAISE EXCEPTION 'A proposed path is unsafe or outside the existing project boundary; do not widen it automatically';
  END IF;
  IF EXISTS (SELECT 1 FROM _dos_m1_dependencies d
      LEFT JOIN _dos_m1_tasks t ON t.task_id=d.depends_on_task_id WHERE t.task_id IS NULL)
    OR EXISTS (SELECT 1 FROM _dos_m1_requirement_links l
      LEFT JOIN _dos_m1_requirements r USING(requirement_id) WHERE r.requirement_id IS NULL)
    OR EXISTS (SELECT 1 FROM _dos_m1_decision_links l
      LEFT JOIN _dos_m1_decisions d USING(decision_id) WHERE d.decision_id IS NULL) THEN
    RAISE EXCEPTION 'Unresolved task/requirement/decision reference';
  END IF;
  WITH RECURSIVE walk(root_id, node_id, seen, cyclic) AS (
    SELECT d.task_id,d.depends_on_task_id,ARRAY[d.task_id,d.depends_on_task_id],d.task_id=d.depends_on_task_id
      FROM _dos_m1_dependencies d
    UNION ALL
    SELECT w.root_id,d.depends_on_task_id,w.seen||d.depends_on_task_id,d.depends_on_task_id=ANY(w.seen)
      FROM walk w JOIN _dos_m1_dependencies d ON d.task_id=w.node_id WHERE NOT w.cyclic
  ) SELECT coalesce(bool_or(cyclic),false) INTO has_cycle FROM walk;
  IF has_cycle THEN RAISE EXCEPTION 'Task dependency cycle'; END IF;
  IF EXISTS (SELECT 1 FROM _dos_m1_requirements r WHERE NOT EXISTS (
      SELECT 1 FROM _dos_m1_requirement_links l WHERE l.requirement_id=r.requirement_id))
    OR EXISTS (SELECT 1 FROM _dos_m1_tasks t WHERE NOT EXISTS (
      SELECT 1 FROM _dos_m1_decision_links l
      WHERE l.task_id=t.task_id AND l.decision_id='DOS-M1-GATE-START' AND l.blocking)) THEN
    RAISE EXCEPTION 'Missing requirement coverage or enforced start-decision link';
  END IF;

  profile_name := coalesce(ws.model_profile, pr.default_model_profile);
  IF profile_name IS NULL OR profile_name NOT IN ('fast','standard','deep','review') THEN
    RAISE EXCEPTION 'No suitable configured implementation profile; no model identifier will be invented';
  END IF;
  SELECT count(*) INTO missing_count FROM _dos_m1_tasks p
    WHERE NOT EXISTS (SELECT 1 FROM control.tasks t WHERE t.task_id=p.task_id);
  IF missing_count>0 AND EXISTS (
    SELECT 1 FROM control.tasks t WHERE t.suit_slug=cfg.suit_slug
      AND NOT EXISTS (SELECT 1 FROM _dos_m1_tasks p WHERE p.task_id=t.task_id)
  ) THEN
    RAISE EXCEPTION 'Unreconciled existing Doctor Suit task history; produce a reviewed delta, not a second initial seed';
  END IF;

  -- Validate every existing task before any definition/link insertion.
  FOR input_row IN SELECT * FROM _dos_m1_tasks ORDER BY task_id LOOP
    item := input_row.spec;
    SELECT * INTO old_task FROM control.tasks t WHERE t.task_id=input_row.task_id FOR UPDATE;
    IF FOUND THEN
      IF old_task.project_id IS DISTINCT FROM pr.project_id
        OR old_task.workstream_slug IS DISTINCT FROM ws.slug
        OR old_task.suit_slug IS DISTINCT FROM cfg.suit_slug
        OR old_task.metadata->>'handoff_manifest_sha256' IS DISTINCT FROM manifest_hash
        OR old_task.title IS DISTINCT FROM item->>'title'
        OR old_task.description IS DISTINCT FROM item->>'description'
        OR old_task.sequence IS DISTINCT FROM (item->>'sequence')::integer
        OR old_task.priority IS DISTINCT FROM (item->>'priority')::integer
        OR old_task.task_type IS DISTINCT FROM item->>'task_type'
        OR old_task.risk_level IS DISTINCT FROM item->>'risk_level'
        OR old_task.acceptance_criteria IS DISTINCT FROM item->'acceptance_criteria'
        OR old_task.verification_plan IS DISTINCT FROM item->'verification_plan'
        OR old_task.metadata->'allowed_paths' IS DISTINCT FROM item->'allowed_paths' THEN
        RAISE EXCEPTION 'Existing task definition/route conflict: %. No existing state will be overwritten',input_row.task_id;
      END IF;
      SELECT coalesce(jsonb_agg(l.requirement_id ORDER BY l.requirement_id),'[]'::jsonb)
        INTO requirement_ids FROM control.task_requirements l WHERE l.task_id=input_row.task_id;
      SELECT coalesce(jsonb_agg(l.depends_on_task_id ORDER BY l.depends_on_task_id),'[]'::jsonb)
        INTO dependency_ids FROM control.task_dependencies l WHERE l.task_id=input_row.task_id;
      SELECT coalesce(jsonb_agg(jsonb_build_object('decision_id',l.decision_id,'blocking',l.blocking) ORDER BY l.decision_id),'[]'::jsonb)
        INTO decision_links FROM control.task_decisions l WHERE l.task_id=input_row.task_id;
      SELECT coalesce(jsonb_agg(jsonb_build_object('decision_id',l.decision_id,'blocking',l.blocking) ORDER BY l.decision_id),'[]'::jsonb)
        INTO incoming_decisions FROM _dos_m1_decision_links l WHERE l.task_id=input_row.task_id;
      IF requirement_ids IS DISTINCT FROM item->'linked_requirement_ids'
        OR dependency_ids IS DISTINCT FROM item->'task_dependencies'
        OR decision_links IS DISTINCT FROM incoming_decisions
        OR EXISTS (SELECT 1 FROM control.task_dependencies l WHERE l.task_id=input_row.task_id AND l.dependency_type<>'hard') THEN
        RAISE EXCEPTION 'Existing link set differs: %. Do not repair completed/running history by reimport',input_row.task_id;
      END IF;
      -- Crucially: status, engine_stage, model/retry resolution, execution,
      -- verification, publication, integration and deployment history stay intact.
    END IF;
  END LOOP;

  FOR input_row IN SELECT * FROM _dos_m1_requirements ORDER BY requirement_id LOOP
    item := input_row.spec;
    SELECT r.* INTO existing_row FROM control.requirements r
      WHERE r.suit_slug=cfg.suit_slug AND r.requirement_id=input_row.requirement_id FOR UPDATE;
    IF FOUND THEN
      IF existing_row.title IS DISTINCT FROM item->>'title'
        OR existing_row.summary IS DISTINCT FROM item->>'summary'
        OR existing_row.metadata->>'handoff_manifest_sha256' IS DISTINCT FROM manifest_hash THEN
        RAISE EXCEPTION 'Existing requirement conflict: %. Approval/implementation state is preserved', input_row.requirement_id;
      END IF;
    ELSE
      INSERT INTO control.requirements(suit_slug,requirement_id,title,summary,status,risk_level,source_path,source_anchor,metadata)
      VALUES(cfg.suit_slug,input_row.requirement_id,item->>'title',item->>'summary',item->>'status','normal',
        'doctor-suit-m1-task-packets-v0.2.md',input_row.requirement_id,
        jsonb_build_object('handoff_manifest_sha256',manifest_hash,'provenance',item->>'provenance','artifact_revision','v0.2'));
    END IF;
  END LOOP;
  FOR input_row IN SELECT * FROM _dos_m1_decisions ORDER BY decision_id LOOP
    item := input_row.spec;
    SELECT d.* INTO existing_row FROM control.decisions d
      WHERE d.suit_slug=cfg.suit_slug AND d.decision_id=input_row.decision_id FOR UPDATE;
    IF FOUND THEN
      IF existing_row.title IS DISTINCT FROM item->>'title'
        OR existing_row.decision_text IS DISTINCT FROM item->>'decision_text'
        OR existing_row.metadata->>'handoff_manifest_sha256' IS DISTINCT FROM manifest_hash THEN
        RAISE EXCEPTION 'Existing decision changed: %. Preserve it; use a reviewed delta instead',input_row.decision_id;
      END IF;
    ELSE
      INSERT INTO control.decisions(suit_slug,decision_id,title,decision_text,status,source,metadata)
      VALUES(cfg.suit_slug,input_row.decision_id,item->>'title',item->>'decision_text','open',item->>'source',
        jsonb_build_object('handoff_manifest_sha256',manifest_hash,'artifact_revision','v0.2'));
    END IF;
  END LOOP;
  IF missing_count>0 AND NOT EXISTS (
    SELECT 1 FROM control.decisions d WHERE d.suit_slug=cfg.suit_slug
      AND d.decision_id='DOS-M1-GATE-START' AND d.status='open'
  ) THEN
    RAISE EXCEPTION 'New tasks require the actual blocking start decision to remain OPEN';
  END IF;

  -- Insert-only task data. Do not use task-create repeatedly: it requires an
  -- active route and does not import this full relationship/history contract.
  FOR input_row IN SELECT * FROM _dos_m1_tasks ORDER BY (spec->>'sequence')::integer LOOP
    IF NOT EXISTS (SELECT 1 FROM control.tasks t WHERE t.task_id=input_row.task_id) THEN
      item := input_row.spec;
      meta := item->'metadata' || jsonb_build_object(
        'handoff_manifest_sha256',manifest_hash,
        'milestone_id','DOS-M1',
        'expected_outputs',item->'expected_outputs',
        'model_profile_provenance','inherited existing workstream/project at import; retry policy remains inherited',
        'legacy_reconciliation_evidence',cfg.legacy_reconciliation_evidence,
        'consumer_review_evidence',cfg.consumer_review_evidence,
        'scope_approval_evidence',cfg.scope_approval_evidence
      );
      INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,sequence,priority,title,description,
        task_type,risk_level,model_profile,status,engine_stage,acceptance_criteria,verification_plan,retry_policy_id,metadata)
      VALUES(input_row.task_id,cfg.suit_slug,pr.project_id,ws.slug,(item->>'sequence')::integer,(item->>'priority')::integer,
        item->>'title',item->>'description',item->>'task_type',item->>'risk_level',profile_name,
        'planned','pending',item->'acceptance_criteria',item->'verification_plan',NULL,meta);
      INSERT INTO _dos_m1_new_tasks VALUES(input_row.task_id);
    END IF;
  END LOOP;

  INSERT INTO control.task_requirements(task_id,suit_slug,requirement_id)
    SELECT l.task_id,cfg.suit_slug,l.requirement_id FROM _dos_m1_requirement_links l JOIN _dos_m1_new_tasks n USING(task_id);
  INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type)
    SELECT l.task_id,l.depends_on_task_id,'hard' FROM _dos_m1_dependencies l JOIN _dos_m1_new_tasks n USING(task_id);
  INSERT INTO control.task_decisions(task_id,suit_slug,decision_id,blocking)
    SELECT l.task_id,cfg.suit_slug,l.decision_id,true FROM _dos_m1_decision_links l JOIN _dos_m1_new_tasks n USING(task_id);

  FOR input_row IN SELECT task_id FROM _dos_m1_new_tasks ORDER BY task_id LOOP
    IF control.resolved_retry_policy(input_row.task_id) IS NULL THEN
      RAISE EXCEPTION 'No active inherited retry policy: %',input_row.task_id;
    END IF;
    -- Refresh only after every authority-bearing relationship exists. This is
    -- contract materialization, NOT authorization or batch admission.
    PERFORM control.refresh_publication_readiness_contract(input_row.task_id,'doctor-suit-handoff');
    INSERT INTO control.task_events(task_id,event_type,to_status,source,payload)
    VALUES(input_row.task_id,'task_handoff_imported','planned','chatgpt',jsonb_build_object(
      'artifact_revision','v0.2','handoff_manifest_sha256',manifest_hash,
      'generated_by','ChatGPT','operator_import_evidence',cfg.consumer_review_evidence,
      'execution_authorized',false,'existing_history_modified',false));
  END LOOP;
  IF (SELECT count(*) FROM control.tasks t JOIN _dos_m1_tasks p USING(task_id))<>20 THEN
    RAISE EXCEPTION 'Post-insert task-count mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM control.ready_tasks t JOIN _dos_m1_new_tasks n USING(task_id)) THEN
    RAISE EXCEPTION 'A new task is dispatch-eligible despite the hold; reject this consumer contract';
  END IF;
END;
$seed$;

-- Proposed operator review result. No success claim is made by this artifact.
SELECT t.task_id,t.title,t.status,t.engine_stage,
  CASE WHEN n.task_id IS NULL THEN 'existing-preserved' ELSE 'new-held' END AS seed_result
FROM control.tasks t JOIN _dos_m1_tasks p USING(task_id)
LEFT JOIN _dos_m1_new_tasks n USING(task_id)
ORDER BY t.sequence,t.task_id;

-- Intentionally never commits. Releasing the draft guard and approving a
-- disposable validation are NOT permission to change this to a live COMMIT.
ROLLBACK;
