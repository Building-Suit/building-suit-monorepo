# LS-SEC-DEP-004 — patched operator validation

2026-10-25. Implemented and locally verified; review publication pending. Parent PR #466, committed SHA `6f8ebcb8b4a7f2c65fdee785b9e7b064cf8f3498`. Branch `codex/ledger-suit/bounded-operator-validation`; no uncommitted parent edits included. Resumed live preflight confirms the open same-stack parent and no errors.

The Ledger dependency audit retains vulnerable direct Zod v3 selections. Repository-wide source search identifies one actual consumer, Automation's operator configuration validator. Migrate the five existing direct selections to 4.6.7 and declare Automation's own dependency explicitly. Use the v4 two-argument record API and a factory for independent default objects. Project fields, profile enums, authority, persistence and secret-key denial remain intact. No live Automation task or policy is changed.

Retry policies already require exactly one profile per attempt, with attempts limited to 1–20. Add the equivalent collection maximum of 20 so patched Zod can reject oversized inputs before reading items. This preserves the accepted policy set and does not introduce an arbitrary project/workstream limit.

## Actual regression and compatibility

The exact updated TypeScript validator, stripped with Node's native TypeScript API and bound to the parent's actual Zod 3.25.76, still visits an item of a 100,000-element constrained-array proxy before rejecting it. The proxy throws immediately at the first visit, avoiding expensive work or allocation. The same consumer on 4.6.7 rejects with `too_big` and zero item visits. This is bounded verification of GHSA-mrhx-c7xc-m3w5, not a stress attack.

Four maintained tests import the real TypeScript validator: accepted project/defaults, request-isolated dictionaries, malformed identity/nested secret denial, retry exact cardinality/profile/range behavior, and early oversized-array rejection. Ten combined operator/toolchain security tests pass. The actual new production server also passes loopback HTTP checks with randomly generated synthetic credentials and authentication enabled: unauthenticated 401, valid project 200, nested secret 400, oversized retry 400. Existing flattened `fieldErrors`/`formErrors` remain available. No database URL is configured: only the pure project validator and policy rejection before database invocation are called. The server is stopped afterward.

Automation preparation, typecheck, full lint and production build pass. Scoped check/test lint and workspace checks pass. Ledger's unchanged financial unit suite and existing operator regressions are recorded in the dated evidence. Other app declarations have no Zod source imports; their Nuxt runtime/type/build verification is retained at parent #466, rather than relabelled as rerun here. No financial migrations or UI changes occur.

## Advisory boundary

The fresh 2026-10-25 advisory service reports one high (node-forge) and one low (new serialize-javascript <7.1.3 finding). Against the same day's parent audit, the Zod high is removed. The prior 2026-10-23 audit had not reported the new serializer finding. No advisory is ignored. A separate compatible serializer patch is next. node-forge 1.4.0 and listhen 1.10.1 remain the latest published versions; audit offers no patched node-forge version.

Inspecting the actual parent Ledger production output finds no node-forge/listhen packaged dependency directory or executable JavaScript import. Two package.json files mention listhen in development metadata. This narrows the local artifact boundary; it does not prove a hosted deployment, all possible tooling modes, or waive the remaining advisory.

Dated [evidence](../v2-acceptance/operator-validation-verification-2026-10-25.json) distinguishes local checks from the inherited full-CI failures at #466. Hosted configuration, live Automation reconciliation, accountant UAT and controlled release remain independent gates. No sale-ready claim.
