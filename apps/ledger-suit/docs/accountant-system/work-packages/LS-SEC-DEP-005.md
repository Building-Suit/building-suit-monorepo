# LS-SEC-DEP-005 — safe function serialization boundaries

2026-10-25. Implemented and locally verified; review publication pending. Parent PR #468 at `b5b8e8e3e097fd19421b8d6ab8a1733b0c26396c`, branch `codex/ledger-suit/safe-serializer-boundaries`. Live preflight verifies the open parent and no errors. No uncommitted parent edits included.

The fresh advisory service now reports GHSA-m5mm-p8h7-m29v for serialize-javascript 7.1.2. Function source ending in bare `</script` was not escaped until a delimiter appeared within that same source. Pretty-printed surrounding serialization can supply the delimiter, and a later value can supply closing markup. Override to the published compatible 7.1.3 fix; no app source, database, financial command or authority changes.

## Actual consumer and regression

Resolve the serializer through the actual installed Nuxt → @nuxt/nitro-server → nitropack → @rollup/plugin-terser dependency chain. The maintained `tooling/checks/serializer-security.test.mjs` checks the split boundary, mixed-case/end/delimited forms and ordinary strings. Its other test round-trips legitimate functions/date/regex and invokes the actual Terser worker with a function-valued comments option, source map and executable result 42. The same tests against the actual parent give one expected boundary failure and one compatibility pass; the patched graph passes both. No tests are skipped.

A separate real Chromium 154 parser probe uses identical synthetic spoofed function sources, benign span markup and all network requests aborted. Parent 7.1.2 produces one injected marker outside the script; patched 7.1.3 produces zero. Following ordinary markup remains visible in both. This reproduces the dependency flaw; it does not claim an exposed product entry point or deployed XSS.

All twelve current dependency-security/operator-validator tests, scoped ESLint and workspace boundaries pass. All seven preparations pass. All seven production builds pass in 4m20.94s with bounded concurrency two because Nitro's minification worker is shared; no type/API source changed. Evidence and final outcomes are retained [here](../v2-acceptance/serializer-security-verification-2026-10-25.json). Inherited full-CI failures remain recorded at #466.

## Remaining advisory and release gates

The fresh graph reports **0 critical / 1 high / 0 moderate / 0 low** without ignores. node-forge 1.4.0 via Nitro/listhen remains high and has no published patched version; registry latest versions are node-forge 1.4.0 and listhen 1.10.1. The freshly rebuilt Ledger production artifact has no packaged node-forge/listhen directories or executable imports; two bundled package manifests retain listhen development metadata. This is a local artifact observation, not proof of hosted configuration or a waiver.

No full-CI, hosted deployment/configuration, live Automation reconciliation, accountant UAT or sellable-release claim is made. The next work returns to the required native/browser acceptance coverage rather than masking unresolved gates.
