# Shared signup capture investigation

Task: `DOCTOR-SHARED-CAPTURE-AUDIT-20261030` (requested integration investigation, not a renumbered canonical milestone). Base: `90e7ff59a4669629e7af43fc38ff34aea2e51cd4`. Status: bounded diagnostic implementation; historical failure cause remains unknown. No product behavior fix is claimed.

## Observed failure and control

Protected Doctor run41028651192, shared-settings job123972781798, passed47 shared auth cases and failed the Ledger EN/light/768 signup case at `atomic-signup-parity.spec.ts:80`. The original screenshot call exceeded the existing test deadline after fonts loaded. Fixed diagnostics identified workspace capture, no page crash and a connected browser. Settings were skipped. Same-source PR run41028658618/job123972808251 passed all48 auth cases (the matching case took3.8s) and12 settings cases. A passing sibling does not establish the cause of the failed execution.

Normal current artifact listing contains SQL-schema and M3 receipts, but no shared-auth screenshot artifact. Historical artifact12936135747 remains Forbidden and was not retried or accessed through another route. No new evidence access denial occurred in this continuation.

## Diagnostic delta

Reuses the previously prepared geometry patch from Library `libfile_7551ee8caa88819197ace318f901669a`; the target's SHA256 still matches its original source binding. Before the existing screenshot, collect bounded viewport/document dimensions and visibility/focus booleans. Preserve a distinct measurement phase and null for unavailable measurements. Add bounded monotonic capture duration; a completed capture freezes that duration so a later verification failure cannot inflate it. Successful fixed-case records support comparison with failure records.

No page text, form values, URLs, request/storage data, raw errors, screenshots or trace bytes are added to the log. No new browser environment, backend, workflow or runtime switch is introduced. Measurement adds one browser evaluation within the original test budget and can affect timing; a later pass must not be described as a demonstrated repair.

All original44 assertion-related calls, the screenshot call/options, both throw statements and four case iterators are structurally unchanged. The complete EN/AR, light/dark,390/768/1440 Ledger/Shop matrix remains. No deadline, retry, authorization or acceptance assertion changes.

## Focused cloud execution

The exact base was built with pinned Node26.8.1/pnpm10.33.0 and frozen root dependencies, then `pnpm run setup` and `pnpm exec turbo run build --filter=@building-suit/ledger-suit --filter=@building-suit/shop-suit --concurrency=2`. The pinned Playwright1.62.1 Chromium ran in this managed cloud executor against only the two owned loopback app servers. No Doctor runtime/provider service, hosted backend or personal device/network was used.

Three distinct scoped executions retained the original signup assertions/matrix and zero retries/default deadlines:

- Unmodified source:12 passed in40.9s; matching EN/light/768 case2.6s. Trace retention disabled to exclude credential-bearing artifacts.
- Controlled capture-interaction probe:12 passed in42.8s. Enabled screenshot-only context tracing after account/password fields left the page, stopped before verification, and saved no trace. This did not reproduce the failure and does not prove or exclude a tracing cause.
- Instrumented diagnostic:12 passed in42.5s, producing24 bounded capture records. Scoped strict TypeScript and ESLint passed. AST comparison preserved44 assertions, one screenshot, two throws, four iterators and zero timing-policy calls.

These runs exercise existing synthetic UI protocol fixtures, not real Auth/service acceptance. Native owned CI acceptance for this candidate is pending publication. Initial setup failures are retained separately: default pnpm store was unwritable, resolved by a task-owned cloud store; isolated TypeScript initially lacked Node type resolution, resolved using the already pinned installed types without dependency changes.

Next: inspect the exact candidate's owned CI records and retain any failure. Change product/capture behavior only after an evidence-supported cause or controlled defect is established. Do not infer real incident authority, domain acceptance or main readiness from this diagnostic.
