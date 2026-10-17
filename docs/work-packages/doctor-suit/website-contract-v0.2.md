# Doctor Suit synthetic website implementation contract

Task: DOS-M1-001. Authoritative plans: PR #345 at `4ca7110f4d6efa828e0b41213e5c059bf02ba9db`. This is implementation guidance, not completed product acceptance.

The 2026-10-16 delegation confirms all nine plans safely stored and authorizes direct M1, then M2 and M3 GitHub implementation. Automation stays inactive and unchanged. Its registered execution/model/retry/verification route is unverified here; no compatibility or admission success is claimed. The parent coordinates reviewed passing staging merges. Provider connections belong to the user.

M1 supplies a public synthetic preview and administrative doctor and secretary browser portals. Use existing Building tokens, bilingual EN/AR content and shared UI templates. No real patients, prescribing, payment, mobile availability, commercial offer, compliance assertion or production signup is promised. Planned features must say planned. External support, domain/canonical, price/trial and store destinations stay absent until independently approved.

The companion [machine-readable contract](website-contract-v0.2.json) records every planned route, server permission, journey and M1 task status. Template names are proposed existing shared contracts; adapt their neutral typed models or add a complete shared template when actual behavior requires it. Registry entries must describe implemented routes only.

## Ownership and journeys

The doctor owns a practice across locations and can work alone. Onboard idempotently, create two locations, create a practice-patient relationship, book, check in and inspect the scoped queue and patient profile. A location is historical attribution, never the chart owner. Patient identity, practice-patient relationship and encounter identity remain separate. Matching contacts never merge records or grant accounts.

A shared secretary accepts two recipient-bound, expiring invitations. Each creates an independent membership with explicit capabilities and location grants. Switching practice, location, account or session clears private caches, subscriptions, drafts and selection. Every next server request rechecks active membership and grants; revocation cannot rely on hiding navigation. A doctor may delegate approved administrative capabilities, never owner management or clinical signing.

## Route and template inventory

| Route | Audience | Complete shared template | Capability | Task |
|---|---|---|---|---|
| `/` | public | BsLandingPage | `public.read` | DOS-M1-005 |
| `/sign-in` | auth | BsSignInPage | `auth.self` | DOS-M1-006 |
| `/recover` | auth | BsPasswordRecoveryPage | `auth.self` | DOS-M1-006 |
| `/verify` | auth | BsEmailVerificationPage | `auth.self` | DOS-M1-006 |
| `/onboarding` | doctor | BsSignupPage | `practice.create` | DOS-M1-007 |
| `/workspace` | member | BsOperationsDashboardPage | `dashboard.read` | DOS-M1-015 |
| `/locations` | member | BsOperationalRecordsPage | `locations.manage` | DOS-M1-008 |
| `/team` | doctor | BsAccessManagementPage | `members.manage` | DOS-M1-009 |
| `/invitations/accept` | auth | BsInvitationAcceptancePage | `invitation.accept` | DOS-M1-009 |
| `/patients` | member | BsCustomerDirectoryPage | `patients.read` | DOS-M1-011 |
| `/patients/[id]` | member | BsCustomerProfilePage | `patients.read` | DOS-M1-012 |
| `/availability` | member | BsBusinessSettingsPage | `availability.manage` | DOS-M1-013 |
| `/appointments` | member | BsAppointmentsPage | `appointments.read` | DOS-M1-014 |
| `/settings` | member | BsBusinessSettingsPage | `profile.self` | DOS-M1-016 |
| `/audit` | doctor | BsAuditHistoryPage | `audit.read` | DOS-M1-017 |

## Backend permission matrix

`practice` means doctor ownership verified from stored server data; `grant` means active same-practice membership plus explicit capability and matching location. `self` never confers ownership. Deny by default. UI capabilities are projections only.

| Capability | Doctor | Secretary |
|---|---|---|
| `public.read` | public | public |
| `auth.self` | self | self |
| `practice.create` | self | deny |
| `dashboard.read` | practice | grant |
| `locations.manage` | practice | grant |
| `members.manage` | practice | deny |
| `invitation.accept` | recipient | recipient |
| `patients.read` | practice | grant |
| `patients.write` | practice | grant |
| `documents.read` | practice | grant |
| `documents.write` | practice | grant |
| `availability.manage` | practice | grant |
| `appointments.read` | practice | grant |
| `appointments.write` | practice | grant |
| `queue.manage` | practice | grant |
| `profile.self` | self | self |
| `audit.read` | practice | deny |
| `clinical.sign` | unavailable | deny |
| `prescriptions.sign` | unavailable | deny |

## Synthetic data and preservation

Use disposable deterministic fixtures for doctor A, doctor B, a shared secretary, two locations and an outsider, with example.test contacts. Reject remote backend targets in tests; no hosted resets or migrations. No messages leave the fixture environment. Documents require private storage, type/size validation, current access checks and audit. Retry keys prevent duplicate writes, versions reject stale updates, archive preserves referenced history and appointment conflict checks cover the doctor across locations. Timezones use explicit IANA identifiers. Logs omit credentials and patient payloads. Real-data consent, retention, erasure and legal policy remain M7 obligations.

## Acceptance and remaining evidence

All 20 M1 task IDs remain pending in the companion checklist. Each maps to its canonical acceptance/scenario cases, named unit/data/browser outputs and commands in `planning-v0.4/DOS-M1.json`. Scope-document checks do not substitute for browser, authorization or shared-consumer regressions. Each implementation PR must report implemented, verified, published, merged and deployed separately and retain failed/skipped/unrun checks. Exact-candidate independent CI receipts and release checks remain required; this document supplies no self-issued PASS.

Open domain decisions: `DOS-M1-D005` (live domain/destinations/claims), `DOS-M2-GATE-CLINICAL` (accountable clinical policy), `DOS-M2-GATE-CATALOGUE` (source/licensing/manual-entry approval), `DOS-M3-GATE-PROVIDER` (communication contract). Synthetic engineering does not resolve these decisions. No Automation decision records are edited.

No maintained Clinic/Doctor app was found in the inspected current staging tree. Historical counts remain unverified; retain recovered IDs and investigate any future overlap rather than manufacturing or replacing history.

Verification gaps: the product app, local schema, browser harness and task suites are created by subsequent tasks. Runtime Automation registration is unverified and intentionally not activated. Hosted provider connections and deployment are outside this implementation.
