# Doctor M2 — synthetic continuation and acceptance ledger

The owner explicitly authorized continuation on 2026-10-20 (Africa/Cairo): “i approve everything and i give you full permission to continue all Doctor Suit tasks”. The later instruction requires a push and PR for each task. This supersedes the earlier engineering stop, as recorded in [the dated amendment](dos-m2-001-continuation.md). No qualified clinician identity, jurisdiction, signed policy, catalogue licence or approved clinical manual-entry policy was supplied. Clinical/catalogue decisions remain OPEN; owner permission is not recorded as a professional signature or independent clinical acceptance.

All implementation is synthetic. Migrations seed no clinical access. Separate expiring fixture capabilities are required, administrative-candidate mode is denied, and owner/membership/SaaS/metadata do not supply clinical authority. Fixture finalization explicitly reports professional_signature=false, clinical_approval=false and live_prescribing=false. No real-patient use, hosted operation, live prescribing, external clinical message, provider provisioning, Automation edit or protected-branch merge was performed. Canonical nine planning packets and prior decision history are preserved.

## Published task stack

Parent lineage is 401 →403 →404 →405 →366, reconciled with staging d5ea6ea38a0503ee3f45d43fae8682cfeda13ee9 through history-preserving merges. Each later M2 task branches from the published same-stack checkpoint and has its own draft PR. Adjustments to008,009 and012 were pushed on their existing task PRs; published migration009 was preserved through a forward issuer-access migration.

| Task | Review PR | Status |
|---|---|---|
| DOS-M2-001 | [#366](https://github.com/Building-Suit/building-suit-monorepo/pull/366) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-002 | [#410](https://github.com/Building-Suit/building-suit-monorepo/pull/410) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-003 | [#411](https://github.com/Building-Suit/building-suit-monorepo/pull/411) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-004 | [#412](https://github.com/Building-Suit/building-suit-monorepo/pull/412) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-005 | [#413](https://github.com/Building-Suit/building-suit-monorepo/pull/413) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-006 | [#414](https://github.com/Building-Suit/building-suit-monorepo/pull/414) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-007 | [#415](https://github.com/Building-Suit/building-suit-monorepo/pull/415) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-008 | [#416](https://github.com/Building-Suit/building-suit-monorepo/pull/416) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-009 | [#417](https://github.com/Building-Suit/building-suit-monorepo/pull/417) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-010 | [#418](https://github.com/Building-Suit/building-suit-monorepo/pull/418) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-011 | [#419](https://github.com/Building-Suit/building-suit-monorepo/pull/419) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-012 | [#420](https://github.com/Building-Suit/building-suit-monorepo/pull/420) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-013 | [#421](https://github.com/Building-Suit/building-suit-monorepo/pull/421) | Implemented; integrated synthetic checks pass; qualified acceptance remains separate |
| DOS-M2-014 | [#422](https://github.com/Building-Suit/building-suit-monorepo/pull/422) | Integrated synthetic engineering verified; qualified acceptance remains separate |

No task PR is a production release or a claim that the clinical gates are closed. The initial001 PR has an inherited exact-parent release-coverage failure on generated token CSS from staging reconciliation; it remains a disclosed draft blocker. Later task-level exact-parent release checks passed, including014 against task013. PR422’s stack check passed.

## Implemented engineering boundaries

Encounters are practice-owned and retain separate patient relationships, responsible doctor and captured clinic/timezone provenance. Atomic commands preserve CAS/idempotency, immutable revisions/digests and actual actor/time. Intake distinguishes missing/unknown/none-reported/reported, neutral notes retain template versions, and explicit synthetic manual prescriptions retain amount strings, identity, units, routes, dates and non-overlapping interval/weekday/as-needed segments without recommendations/default values.

Finalization requires the exact reviewed version/digest; the client verifies canonical bytes against displayed content. Amendments/withdrawals retain originals and reasons. Private result files reuse validated transport and immutable versions, with explicit upload/receipt/review/release transitions. Recipient access is an independent expiring binding with no chart membership or working notes/intake, rechecked after locks and Storage I/O; disabled issuers cannot sustain fixture delivery. Read Committed and current nondeleted sessions are required. Export verifies complete revision/event/file references, upload provenance, canonical checksums, explicit snapshot time/event watermark and requested scope; Storage bytes and erasure/retention/legal-hold approval remain separate.

The014 integration connects two canonical shared templates, controlled bilingual editors, shared private-file/record-action/download/print behavior and protected routes. It adds real owned-provider cases for all14 tasks and a desktop/mobile, EN/AR, light/dark matrix. Source/type checks are not visual or actual-provider acceptance.

## Verification receipts — 2026-10-20

- All14 actual M2 browser cases passed against run-owned Supabase Auth/PostgREST/Storage/Functions, with zero retries or skipped cases. These cover genuine UI sign-in, held-response loading/pending states, a committed response lost in transport and same-intent retry, exact literal bilingual notes, prescription entry/keyboard focus, reviewed finalization/amendment, release, uploaded private results, independent recipient byte download/sign-out and verified manifest download.
- The actual M2 service stage passed independently, including fresh recipient reauthentication after global browser sign-out, denial during amendment, exact reviewed correction finalization, immutable superseded source, old-version byte denial, fresh authority on export receipt replay and independent-practice isolation. Supersession is asserted after the correction is finalized; starting an amendment preserves the original and suspends release.
- The8 main/editor combinations (390/1280px × EN/AR × light/dark) passed direction, theme, document-width and tab-overflow assertions. Rendered review covered all8 main combinations plus editor, schedule, recipient, loading, empty, pending, uncertain and denied states. Scrollable tabs, stacked narrow-screen fields, first-click readiness and accessible selector/file labels were corrected. Final screenshots disable transient animation; they contain only synthetic data and omit authentication screens.
- English owner and Arabic recipient print PDFs were rendered and inspected as one-page A4 landscape artifacts. Mixed-direction literal values are escaped and isolated, ISO schedule date ranges retain their entered order and duplicate recipient metadata is removed. The shared report option is opt-in; its regression test proves escaping and unchanged default output. These PDFs are intermediate QA, not clinical approval or release deliverables.
- Full Doctor unit tests:386 passed, zero skipped. Focused M2 tests:44 passed. Shared download-helper tests:3 passed. New print-isolation regression:1 passed.
- Disposable SQL: all inherited and M2 suites passed, including33 combined assertions,6 actual archive-RPC assertions,10 separate clinical transaction scenarios and encrypted67-table isolated application-database restore. Public types were generated from the migrated DB. These minimal Auth/Storage scaffolds remain distinct from the successful actual M2 service proof.
- Doctor/docs typechecks, Doctor/shared-template lint, strict ownership/token checks (120 full route templates, zero debt) and the production build passed. The print API keeps legacy consumers on the unchanged default path.
- The full actual-provider command remains FAILED: after all M2 stages passed, the inherited M1 Realtime owner-A subscription check failed. Its assertions, controls and safe diagnostics remain intact. Full-provider/CI readiness is not claimed. The M2-001 parent also retains the separately disclosed inherited generated-token release-coverage blocker.
- Broader unconfigured public browser suite:60 passed. The inherited preview keyboard test was updated from the retired combined menu to the canonical rail cycle controls, retaining keyboard focus, locale/direction, mobile Escape/focus restoration and theme persistence after reload. Authentication-protocol fixture suite:81 passed, zero retries/skips. Its simulated-provider proof remains distinct from the actual M2 Supabase service proof. Earlier network-change attempts remain failures, superseded only by completed reruns.

## Independent review still required

Accountable qualified reviewer, qualification/jurisdiction, review date, exact approved candidate/policy/content digest, constraints and signed immutable approval reference are absent. Catalogue ownership/licence or approved clinical manual-entry policy is absent. Independent M2-014 clinical review is UNRUN. These are evidence gaps, not a request to repeat owner engineering permission; unresolved critical findings block clinical acceptance and any live use.

Final regression checkpoint: all60 public-site and81 authentication-protocol cases passed; PR422’s same-stack check and task014 exact-parent release check passed. The full owned-provider command still reports the inherited M1 Realtime failure after successful M2 stages. No hosted service or protected branch was changed.
