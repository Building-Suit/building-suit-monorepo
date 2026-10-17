# Doctor Suit implementation tracker

Authoritative plans: [PR345](https://github.com/Building-Suit/building-suit-monorepo/pull/345), head `4ca7110f4d6efa828e0b41213e5c059bf02ba9db`, planning-v0.4. All nine plans remain unchanged. Automation storage is owner-verified (104 tasks,117 requirements,37 decisions,244 edges); this work neither reimports nor activates it.

This is the **current implementation ledger**, reconciled on 2026-10-17. Earlier intermediate failures and UNRUN notes are preserved in [implementation history](implementation-history.md), not treated as current verdicts. Implemented, locally verified, exact-head CI, independent review, integration and deployment are distinct. Every PR below remains subject to parent-coordinated reviewed passing stg integration; no remote merge, hosted migration, deployment or main promotion is performed here. Hosted connections are user-managed.

## Current M1 task status

| Task | Published checkpoint | Current checked behavior | Current acceptance/review boundary |
|---|---|---|---|
| DOS-M1-001 | PR348 `52c42b6c` | Synthetic website/administrative contract and authorized direct GitHub scope | Synthetic contract ready; live-domain/commercial claims remain outside scope |
| DOS-M1-002 | PR349 `d81525ff` | Generator scaffold, shared ownership, disabled operational registration | Ready; operational product activation is not authorized |
| DOS-M1-003 | PR350 `3a7958a1` | Independent Doctor schema, RLS, generated types and disposable lifecycle | Actual Auth/Storage/Functions/Realtime and recovery now pass in later checkpoints; no hosted claim |
| DOS-M1-004 | PR351 `a0723e33` | Safe context-clearing foundation and shared authenticated shell | Ready; later context-dependent paths are verified by their owning features |
| DOS-M1-005 | PR351 `a0723e33` | Honest EN/AR synthetic public preview and disabled unimplemented capabilities | Ready; no live clinical/commercial availability is claimed |
| DOS-M1-006 | PR352 `8fdc6bef` | Isolated cookies/SDK/current SID, confirmation and recovery flows | Broader actual browser recovery/PKCE is **closed by PR361**; no stale recovery gap |
| DOS-M1-007 | PR353 `ed1bad51` | Doctor-alone setup, resumable drafts, atomic completion and separate professional profile | Actual owner onboarding passes in the real-provider chain; ready |
| DOS-M1-008 | PR354 `f4bbfb3e` | Location changes/archive, explicit context/timezone and retained references | Patient/appointment attribution and blockers are implemented and checked in011/013/014; ready |
| DOS-M1-009 | PR355 `fa4732cf` | Independent invited memberships, recipient binding and manual acceptance | SQL/browser integration passes; combined actual two-owner/secretary acceptance is reconciled in020 |
| DOS-M1-010 | PR355 `fa4732cf` | Exact per-location administrative capabilities, revocation and scoped commands | Patient/document/appointment integration and clinical-authority negatives pass; final combined reconciliation remains020 |
| DOS-M1-011 | PR356 `a43ae003` | Administrative patient directory, duplicate review, CAS correction and archive | Exact-head checks and parent review pass; ready |
| DOS-M1-012 | PR357 `bbb32f7b` | Private documents, immutable versions, genuine size rejection, protected bytes/history and revocation | Actual Storage/Functions/Auth paths pass, including independent B; ready |
| DOS-M1-013 | PR358 `54f91a98` | DST-aware availability, immutable saved UTC, cross-clinic doctor overlap and stale-timezone protection | Exact-head checks and independent parent review pass; ready |
| DOS-M1-014 | PR359 `1ed57a4c` | Appointment lifecycle, current-clinic queue, rescheduling and scoped minimal Realtime revisions | **All current checks and independent parent review pass.** Actual first-booking revision, reconnect/lifecycle and frozen-SID denial pass; the earlier Realtime failure is historical |
| DOS-M1-015 | PR360 `125a5def` | Full scoped totals, per-clinic local dates, independently paged source links and protected history | **All current checks and independent parent review pass; ready** |
| DOS-M1-016 | PR361 `36797466` | Independent personal settings, default-off in-app preference, fresh-sign-in contact policy and retry/audit | **All current checks and independent parent review pass; ready.** Actual wrong-browser/reused-code/password replacement/new-SID/frozen-SID paths pass |
| DOS-M1-017 | PR362 `3da424cd` | Five-field read-only audit, explicit audit/domain/clinic grants, own-account activity and retained archive history | **All exact-head checks pass; ready for final independent parent review.** Actual safe audit/foreign/mutation/personal-scope assertions pass |
| DOS-M1-018 | PR363 `3ecccbf8` | Eight EN/AR ×light/dark ×390/1280 keyboard/dirty/pending/uncertain-save/patient/booking/secretary journeys | All exact-head checks pass; ready for final independent parent review. Local3units,8matrix+motion,44public,root1,816,all7build/type,lint/boundaries pass |
| DOS-M1-019 | PR364 `e53cc7bc` | Public/private metadata, neutral shared404, handoff and revocation-safe explicit practice selection | All exact-head checks pass;ready for independent parent review.52public/54auth/48shared/12settings local cases,12extra revocation repeats,root1,823/23skips and all7type/build pass |
| DOS-M1-020 | PR365; implementation source `c7bcaed1`, current candidate head/checks in GitHub | Combined doctor-alone/two-doctor/secretary/outsider harness, actual-provider helper and independent acceptance packet |29new/679total SQL assertions plus39races,3newunits,root1,826/23skips,all7type/build,lint and strict105-template boundaries pass. 54public and2stable combined EN/AR journeys pass;full56auth/48shared/12settings and actual-provider results are reconciled in the task packet and live PR. Independent exact-candidate acceptance remains pending; no milestone PASS is self-approved |

## Current provider and combined evidence

- Realtime is **verified**, not UNRUN: PR359 `1ed57a4c`, run39006218258/job117319135022, and the later real-provider chain retain the first genuine booking revision, lifecycle, reconnect, minimal payload and session isolation checks.
- Broader actual recovery/PKCE is **verified**, not UNRUN: PR361 `36797466`, [run39010171512](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/39010171512), actual-provider job117330861563. This includes same-browser recovery, wrong-browser/reused-code denial, password replacement, sensitive-contact expiry/new-SID reauthentication and frozen signed-out SID denial.
- Actual audit is verified on PR362 `3da424cd`, [run39011629407](https://github.com/Building-Suit/building-suit-monorepo/actions/runs/39011629407), job117335247895. Real document-request attribution, five-field projection, foreign-practice/direct-mutation denial and independent personal activity pass alongside the inherited provider checks. The prior Shop hostname fixture port collision passes on this clean head.
- SQL now has **650 cumulative assertions and39 real PostgreSQL concurrency scenarios**. SQL provider schemas are scaffolds; HTTP/WebSocket protocol fixtures are controlled transports. They are never relabeled as actual provider acceptance.
- The latest published usability checkpoint has root1,816 pass/23 optional infrastructure skips, all7 build/type, strict104 templates/0 local components/80 historical migrations, and the full8-combination administrative matrix. Metadata adds a105th canonical template and is still under verification.
- DOS-M1-020 will freeze the exact combined candidate, trace criteria to concrete receipts, check the full two-owner/secretary/outsider slice and distinguish independent review from implementation. No combined acceptance, integration or deployment is inferred from individual PR count.

## Remaining domain and integration boundaries

| Boundary | Current status | Required evidence/action |
|---|---|---|
| Final synthetic M1 acceptance | Pending020 exact combined independent receipt and parent review/integration | Exact combined candidate and passing required checks; parent coordinates stg merges |
| Live domain/destinations, DOS-M1-D005 | Open; not required for synthetic M1 | Owner-supplied real domain/support details; omit production canonical and unsupported external destinations |
| DOS-M2-GATE-CLINICAL | Open | Accountable qualified clinician's signed scope/version/constraints, recorded through DOS-M2-001; developer/test approval cannot substitute |
| DOS-M2-GATE-CATALOGUE | Open | Documented owner/license/provenance and approved manual-entry contract; no scraping or assumed provider access |
| DOS-M3 provider/communications/commercial gates | Open | Approved contract/consent/provider evidence before real delivery or commercial activation |
| Real-data governance/retention/erasure | Open | Required later review; no clinical bulk export, erasure or guessed retention period |
| Hosted Vercel/Supabase connections and deployments | User-managed, unrun here | No manual deployment/migration or credentials provisioned by this implementation |

M2-001–014 and M3-001–010 are not claimed implemented or accepted. Continue dependency order after M1, prepare reviewable policy packets, and keep qualified clinical/catalogue/provider gates open until their actual evidence exists. The general engineering authorization does not create professional, legal or commercial authority.

Update current rows and receipts in place. Keep historical observations in the history document. Preserve every authoritative planning artifact and report ordinary implementation progress separately from final integration or domain evidence blockers.
