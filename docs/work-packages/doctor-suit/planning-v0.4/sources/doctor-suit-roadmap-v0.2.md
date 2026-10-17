# Doctor Suit — proposed roadmap v0.2
Prepared: 2026-10-16 | Source inspection: `c6774d47907f7b09aa0a0e9aa2c45c5687a71c50`

**DRAFT.** Only milestone 1 is in the SQL handoff. Later milestones are selection proposals, not approved/queued execution.

## Scope interpretation

M1 means the public product website plus a usable doctor/secretary browser portal. Native mobile and full prescribing are later. This interpretation still needs confirmation; a marketing-site-only request requires reducing M1 before import.

The monorepo placement and current shared architecture are proposed from the inspected rules, not silently treated as approved product placement. A new app path is a proposed output, not existing code.

## Milestones and exact counts

| Milestone | Outcome | Tasks | Prerequisites |
|---|---|---:|---|
| DOS-M1 | Website and doctor/secretary web foundation | 20 | Scope/runtime admission |
| DOS-M2 | Clinical records and prescriptions on the web | 14 | DOS-M1 |
| DOS-M3 | Full practice operations and communications | 10 | DOS-M2 |
| DOS-M4 | Doctor and secretary mobile experience | 10 | DOS-M2 |
| DOS-M5 | Patient app, treatment timeline and medication reminders | 14 | DOS-M2, DOS-M3 |
| DOS-M6 | Doctor subscriptions and practice billing | 10 | DOS-M1, DOS-M3 |
| DOS-M7 | Production safety, compliance and launch acceptance | 10 | DOS-M1, DOS-M2, DOS-M3, DOS-M6 |
| DOS-M8 | Business Suit ecosystem integration | 8 | DOS-M6, DOS-M7 |
| DOS-M9 | Optional specialties and external provider integrations (optional) | 8 | DOS-M2, DOS-M7 |

**Core roadmap: 96 tasks. Optional: 8 tasks. Total: 104 tasks.**

These are counts of the named task inventory below, not effort estimates or proof of implementation. Later tasks may split/change after approved specialty/platform/provider choices. Existing historical records are not recreated by these counts.

M7 can qualify a web-only release after its web/clinical/billing prerequisites. Doctor or patient mobile surfaces additionally require M4/M5; their absence must be disclosed, not represented as a completed full-product release.

Security and data-integrity work begins in M1. M7 closes production, legal, clinical and independent-verification gates; it is not the first security work. All earlier development/demos use synthetic data until a separately approved real-patient gate.

## Milestone 1 release boundary

Exit: a verified synthetic browser demo where a doctor works alone or delegates administration, with multiple locations, patient profiles/documents and scheduling. Not a clinical launch, paid launch, mobile-app release or production deployment. Future M2 prescribing and M5 reminders must not be advertised as released at M1.

## Task inventory

### DOS-M1 — Website and doctor/secretary web foundation (20 tasks)

| ID | Task | Observable intended outcome |
|---|---|---|
| `DOS-M1-001` | Website scope, user journeys and implementation contract | Produce the implementation-facing website specification from this intake and the inspected repository rules. Reconcile any recovered Clinic Suit IDs/history before assigning replacements. Separate the public site, doctor web portal and secretary web portal; mobile remains later. |
| `DOS-M1-002` | Doctor Suit web scaffold and workspace registration | Create the Doctor Suit app only after the target-repository decision. Use the maintained new-platform generator and shared Nuxt layer; add the minimal repository wiring needed for a local synthetic preview. |
| `DOS-M1-003` | Isolated practice identity and disposable data foundation | Implement the local Doctor Suit identity/practice/membership data boundary and disposable verification fixtures before protected web workflows. Treat the doctor practice as the ownership scope and locations as context. |
| `DOS-M1-004` | Shared web shells and complete page-template contracts | Deliver the public and authenticated web shells through shared presentation templates, including explicit doctor/practice/location context, navigation and reliable interaction states. |
| `DOS-M1-005` | Public product website and truthful feature presentation | Build the Doctor Suit public homepage and product explanation around the doctor-across-clinics model using the shared landing template. |
| `DOS-M1-006` | Doctor authentication and account recovery | Implement the doctor web identity lifecycle using existing shared auth templates and product-isolated session adapters, with no cross-product SSO by implication. |
| `DOS-M1-007` | Doctor-led practice onboarding and profile | Let an authenticated doctor create and maintain a practice profile and reach a usable workspace without employing a secretary. The doctor is the future subscriber; no paid entitlement is fabricated. |
| `DOS-M1-008` | Multiple clinic locations and practice context switching | Let a doctor manage multiple working locations without making a location the owner of their practice records. |
| `DOS-M1-009` | Secretary invitations and multi-doctor memberships | Enable invited secretaries to use one Doctor Suit identity across independent doctor memberships without becoming subscribers or mixing practices. |
| `DOS-M1-010` | Granular delegation enforced in the backend | Implement explicit capabilities for patient administration, scheduling, intake, documents and settings scoped to doctor/location. Presentation reflects authorization but is not its boundary. |
| `DOS-M1-011` | Patient directory and safe administrative CRUD | Provide the authorized doctor/secretary patient-administration web flow: create, search, paginate, edit and archive the doctor-practice patient record. |
| `DOS-M1-012` | Patient profile, administrative timeline and private documents | Deliver a usable patient profile with demographics, administrative activity and authorized document upload/view. This is not yet a signed clinical record or patient-facing portal. |
| `DOS-M1-013` | Working hours, availability and appointment rules | Configure doctor/location working hours, exceptions, slot duration and conflict detection for a browser-based schedule. |
| `DOS-M1-014` | Appointments, check-in and live waiting queue | Deliver booking/rescheduling/cancellation/check-in and an operational queue without prescribing or billing scope. |
| `DOS-M1-015` | Doctor and secretary operational web dashboards | Provide each authorized actor with a real-data Today view, appointments, waiting queue and relevant administrative actions rather than a generic placeholder dashboard. |
| `DOS-M1-016` | Profile, security and communication-preference settings | Provide product-scoped account/profile settings and nonclinical communication preferences, with safe session and ownership boundaries. |
| `DOS-M1-017` | Audit visibility and administrative data-preservation controls | Expose a permission-scoped audit view and safe archival/correction behavior for M1 administrative records, while preparing the explicit real-data governance gate. |
| `DOS-M1-018` | Responsive web, accessibility and failure-recovery acceptance | Close measurable cross-journey usability gaps in the working website/portal, rather than deferring foundational UX until the end. |
| `DOS-M1-019` | Public metadata, support paths and website preview readiness | Complete public-site metadata and support/navigation behavior while keeping private routes unindexed and future capabilities clearly separated from released functionality. |
| `DOS-M1-020` | Milestone 1 end-to-end verification and owner demo handoff | Independently verify the full synthetic website/doctor/secretary vertical slice and prepare an evidence-backed milestone acceptance packet. This is not clinical or commercial launch approval. |

### DOS-M2 — Clinical records and prescriptions on the web (14 tasks)

| ID | Task | Observable intended outcome |
|---|---|---|
| `DOS-M2-001` | Clinical workflow and prescribing policy sign-off | Approve encounter, amendment, signing and delegable drafting policy with a qualified clinician; no medical recommendation is generated. |
| `DOS-M2-002` | Encounter lifecycle and visit provenance | Implement draft/in-progress/finalized/amended encounters with doctor, location, patient and time attribution. |
| `DOS-M2-003` | History, allergies and structured intake | Capture clinician-reviewed history/allergies/vitals with provenance, correction and permission rules. |
| `DOS-M2-004` | Clinical note templates and specialty-neutral forms | Provide typed clinical forms and configurable templates without claiming coverage of every specialty. |
| `DOS-M2-005` | Medication catalogue source and licensing contract | Select an approved catalogue/manual-entry policy, provenance and update workflow; do not invent EDA API access. |
| `DOS-M2-006` | Structured prescription builder | Capture medicine identity, strength, form, dose, route, dates, frequency and instructions with clinician review. |
| `DOS-M2-007` | Complex schedules and schedule validation | Represent tapering, every-N-hours, selected weekdays and as-needed instructions without deriving unapproved medical advice. |
| `DOS-M2-008` | Clinician review, signing and immutable versions | Enforce accountable finalization, revoke/amend workflow and immutable prior prescription versions. |
| `DOS-M2-009` | Prescription print and patient-safe sharing | Render readable bilingual-capable print/share output from structured data with scoped access and no public patient exposure. |
| `DOS-M2-010` | Follow-up plans and order requests | Capture clinician-authored follow-up, lab/imaging and referral requests without interpreting results. |
| `DOS-M2-011` | Results and clinical document review | Track uploaded/requested/received/reviewed/released states and clinical attribution. |
| `DOS-M2-012` | Clinical record release and patient visibility rules | Separate private working material, released patient content and caregiver access policy. |
| `DOS-M2-013` | Clinical export and amendment integrity | Export authorized complete records with version/provenance and preserve audit/retention rules. |
| `DOS-M2-014` | Clinical workflow safety acceptance | Verify synthetic end-to-end encounters/Rx/orders and obtain independent clinical review before any live use. |

### DOS-M3 — Full practice operations and communications (10 tasks)

| ID | Task | Observable intended outcome |
|---|---|---|
| `DOS-M3-001` | Appointment types and multi-location capacity | Extend scheduling with approved consultation types, buffers and cross-location capacity rules. |
| `DOS-M3-002` | Waitlist and cancellation recovery | Fill cancelled slots through consented, auditable operations without duplicate booking. |
| `DOS-M3-003` | Reception and check-in exception workflows | Handle late arrivals, no-shows, walk-ins and rescheduling with clear authority. |
| `DOS-M3-004` | Care-team tasks and follow-up worklists | Assign authorized nonclinical follow-up work without leaking diagnoses to unprivileged staff. |
| `DOS-M3-005` | Patient and guardian contact/consent preferences | Capture explicit operational contact preferences and guardian relationships without marketing defaults. |
| `DOS-M3-006` | Messaging outbox and delivery tracking | Implement a provider-neutral, retry-safe outbox with consent, minimal payloads and failure visibility. |
| `DOS-M3-007` | Approved communication-provider adapter | Connect only a separately approved provider/account/cost policy; no automatic purchases or unconsented outreach. |
| `DOS-M3-008` | Lab/imaging/referral operational tracking | Track referral/order fulfillment status and outside documents without assuming external APIs. |
| `DOS-M3-009` | Data migration and reconciliation | Provide validated mapping, import preview, deduplication review and rollback/reconciliation plans for approved legacy data. |
| `DOS-M3-010` | Operational reports and acceptance | Verify appointment, follow-up, no-show and workload reports against source records and permission scopes. |

### DOS-M4 — Doctor and secretary mobile experience (10 tasks)

| ID | Task | Observable intended outcome |
|---|---|---|
| `DOS-M4-001` | Mobile platform and distribution decision | Approve Android/iOS scope, framework, device support and deployment/cost policy; no silent framework adoption. |
| `DOS-M4-002` | Mobile app shell and shared contracts | Implement approved mobile navigation/contracts while preserving product-owned backend authorization. |
| `DOS-M4-003` | Mobile authentication and session lifecycle | Implement secure storage/session expiry/logout and account recovery for the chosen platform. |
| `DOS-M4-004` | Doctor/practice/location and employee context | Support clear scoped context switching with immediate cache/draft invalidation. |
| `DOS-M4-005` | Patient directory and profile on mobile | Deliver fast authorized patient lookup, profile and document access with failure states. |
| `DOS-M4-006` | Mobile clinical notes and encounter workflow | Allow doctor-authored encounter updates with tested conflict/unsaved-state handling. |
| `DOS-M4-007` | Mobile prescription authoring and review | Provide safe structured prescribing and signing using the same authoritative clinical contracts. |
| `DOS-M4-008` | Mobile schedule and staff operations | Deliver appointments/queue and delegated secretary actions without permission widening. |
| `DOS-M4-009` | Connectivity and offline policy implementation | Implement only the approved offline/cache policy; define conflicts, device loss and expiring local sensitive data. |
| `DOS-M4-010` | Device and mobile release-candidate verification | Verify real-device journeys, accessibility, security and distribution prerequisites without publishing automatically. |

### DOS-M5 — Patient app, treatment timeline and medication reminders (14 tasks)

| ID | Task | Observable intended outcome |
|---|---|---|
| `DOS-M5-001` | Patient identity claim and consent design | Approve safe linking of a patient to doctor records; matching phone/email alone is insufficient. |
| `DOS-M5-002` | Patient app shell and secure onboarding | Implement the chosen patient platforms with verified identity, recovery and consent history. |
| `DOS-M5-003` | Caregivers, dependents and revocation | Implement approved minor/guardian/caregiver relationships with explicit scope and expiry/revocation. |
| `DOS-M5-004` | Doctor and clinic care timeline | Show released visits/prescriptions by doctor/location without granting doctors reciprocal chart access. |
| `DOS-M5-005` | Prescription detail and current-version handling | Show clear start/end dates, doctor instructions, active/amended/stopped state and provenance. |
| `DOS-M5-006` | Dose-event schedule engine | Derive deterministic scheduled reminders from signed instructions with timezone and change handling. |
| `DOS-M5-007` | Device notification permission and channel handling | Handle OS permission, disabled notifications, app reinstall and delivery limitations honestly. |
| `DOS-M5-008` | Taken, skip and snooze interactions | Snooze affects notification time only; action retries are idempotent and never rewrite the prescribed regimen. |
| `DOS-M5-009` | Missed reminders and stop/amend reconciliation | Cancel obsolete reminders and avoid duplicate alerts or invented double-dose advice. |
| `DOS-M5-010` | Adherence history and patient corrections | Record patient-reported actions distinctly from verified administration and permit auditable correction. |
| `DOS-M5-011` | Multi-device sync and notification deduplication | Reconcile action conflicts, clock/timezone changes and multiple devices without repeated dose events. |
| `DOS-M5-012` | Appointments and released results | Show authorized appointments/results and follow-up instructions with doctor provenance. |
| `DOS-M5-013` | Accessible patient experience and limited-connectivity behavior | Support readable instructions, accessible actions and safe minimal caching for approved users/devices. |
| `DOS-M5-014` | Reminder safety and patient pilot acceptance | Test real-device timing/permissions/snooze/amendment scenarios with clinical review; never promise guaranteed alarms. |

### DOS-M6 — Doctor subscriptions and practice billing (10 tasks)

| ID | Task | Observable intended outcome |
|---|---|---|
| `DOS-M6-001` | Doctor subscription and commercial-policy decisions | Approve per-doctor plans, prices, trial, locations/staff limits, refunds and expiry; invent no commercial values. |
| `DOS-M6-002` | Entitlement and usage enforcement | Implement backend quotas/idempotency with clear read/write behavior and no historical record deletion on expiry. |
| `DOS-M6-003` | Subscription checkout or approved manual-payment process | Use an approved payment route; never assume account/provider eligibility or reuse another product secret. |
| `DOS-M6-004` | Payment confirmation and reconciliation | Use trusted payment evidence, duplicate-event handling and reconciliation; browser return is not authority. |
| `DOS-M6-005` | Renewal, cancellation and subscription settings | Provide auditable lifecycle changes and accurate doctor-facing billing state. |
| `DOS-M6-006` | Practice service prices and visit charges | Define doctor/location services and patient charges separately from the SaaS subscription. |
| `DOS-M6-007` | Collections, receipts and refunds | Implement atomic patient-payment/receipt/refund flows with appropriate approvals and immutable financial history. |
| `DOS-M6-008` | Egypt tax-document applicability and adapter decision | Obtain qualified applicability review and verify required official integration before any compliance claim. |
| `DOS-M6-009` | Revenue and settlement reporting | Reconcile practice revenue, outstanding balances and SaaS billing views to their distinct ledgers. |
| `DOS-M6-010` | Financial and commercial acceptance | Verify concurrency, reconciliation, refunds, entitlements and separately approved commercial launch policy. |

### DOS-M7 — Production safety, compliance and launch acceptance (10 tasks)

| ID | Task | Observable intended outcome |
|---|---|---|
| `DOS-M7-001` | Controller/processor and legal-policy review | Obtain current Egypt-specific professional legal/healthcare review of data responsibilities, consent and obligations. |
| `DOS-M7-002` | Hosting, data-flow and transfer approval | Approve providers, regions, data transfers and subprocessors before provisioning or real-patient processing. |
| `DOS-M7-003` | Clinical governance and real-patient entry gate | Document accountable clinical review, prescribing limits, emergency disclaimers and permitted pilot use. |
| `DOS-M7-004` | Retention, access and privacy-rights operations | Implement approved record retention, access/correction/export/erasure handling with legal-hold conflicts resolved. |
| `DOS-M7-005` | Security assessment and remediation | Independently assess tenancy, auth, storage, audit, mobile caches and abuse protections with tracked findings. |
| `DOS-M7-006` | Backup, restore and disaster recovery proof | Demonstrate approved recovery objectives with scoped restore tests and protection against data loss. |
| `DOS-M7-007` | Observability, incident and breach response | Prepare monitored failures, notification health and tested incident escalation without exposing patient payloads. |
| `DOS-M7-008` | Performance and operational readiness | Verify representative load, user support, service limits, provider costs and production configuration. |
| `DOS-M7-009` | Supervised pilot and clinical/user acceptance | Run a separately authorized limited pilot, track consent and defects, and obtain independent domain approval. |
| `DOS-M7-010` | Production go/no-go and release evidence | Complete exact candidate evidence and owner authorization; publication, merge and deployment remain separate actions. |

### DOS-M8 — Business Suit ecosystem integration (8 tasks)

| ID | Task | Observable intended outcome |
|---|---|---|
| `DOS-M8-001` | Ecosystem domain and sharing contract | Confirm what Business Suit means and each existing Suit owner; preserve clinical boundaries and capability-based integration. |
| `DOS-M8-002` | Versioned events and durable outbox/inbox | Implement authenticated event contracts, idempotency, replay and failure handling without shared clinical tables. |
| `DOS-M8-003` | Accounting/Ledger integration | Export minimized financial facts with reconciliation; exclude diagnoses, prescriptions and clinical notes by default. |
| `DOS-M8-004` | Inventory and consumables integration | Connect approved usage/stock references only when the owning Inventory/Shop capability is verified. |
| `DOS-M8-005` | Team/employment reference integration | Link approved staff references without granting payroll/HR users access to patient records. |
| `DOS-M8-006` | Notification/mail capability integration | Use approved consented communication routing with minimal payloads and no cross-product session reuse. |
| `DOS-M8-007` | Aggregated reporting and consent-aware sharing | Expose authorized minimized aggregates; do not repurpose treatment data for marketing. |
| `DOS-M8-008` | Cross-Suit contract and failure acceptance | Test outages, replay, revocation and reconciliation across independently authorized products. |

### DOS-M9 — Optional specialties and external provider integrations (8 tasks)

| ID | Task | Observable intended outcome |
|---|---|---|
| `DOS-M9-001` | Specialty prioritization and clinician-led templates | Select specialty modules through approved clinical requirements rather than assuming one universal chart. |
| `DOS-M9-002` | Egypt medication catalogue / national prescription feasibility | Verify source licensing, interfaces and access terms before implementing an EDA/national adapter. |
| `DOS-M9-003` | Lab integration | Implement one verified partner protocol with identity matching, provenance and retry/reconciliation. |
| `DOS-M9-004` | Imaging/radiology integration | Implement one approved imaging workflow and data exchange with minimum-necessary access. |
| `DOS-M9-005` | Pharmacy integration | Connect approved fulfillment/status flows without assuming medication substitution or dispensing authority. |
| `DOS-M9-006` | Insurance/UHIA feasibility and first connector | Verify eligibility, standards, contracting and actual API availability before claims integration. |
| `DOS-M9-007` | Interoperable clinical export or referral exchange | Select required standards/profile/version with partner testing and explicit patient/doctor access policy. |
| `DOS-M9-008` | Optional-module acceptance and rollout | Verify chosen specialty/provider modules independently; telemedicine, AI diagnosis and hospital systems are not silently included. |

## Selection and ordering

Select a milestone or explicit task IDs; the execution system must still satisfy dependencies and decision gates. Business priority, dependency order, risk, model routing and release readiness are distinct. No milestone selection grants merge, deployment, provider purchase or hosted migration permission.

## Exclusions

No hospital inpatient/ER platform, automatic diagnosis, AI prescribing, medication substitution advice, unapproved telemedicine, pharmacy marketplace, automatic shared medical chart, cross-product SSO, new paid services, or fabricated government integrations. These require separate scope decisions.

## Legacy preservation

The earlier Clinic Suit v0.1 references were searched and read, but no readable requirement/roadmap content was returned and the files were absent from the working filesystem. The historical 82-requirement/22-task figures cannot be reconciled from available bytes. The new DOS-M1 IDs are additive; recover and map old IDs before intake. No historical source, row or execution state has been modified.
