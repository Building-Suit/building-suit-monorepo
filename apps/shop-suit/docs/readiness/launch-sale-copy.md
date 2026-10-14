# SS-LAUNCH-SALE-COPY-001 — Transaction-aware Sales/POS copy

Implements SS-LAUNCH-R08 wording for Sales editor/detail issuance, customerless checkout, Fast Pay, POS checkout and complete-sale corrections. The existing shared confirmation, record dialog and toast mechanisms remain in use. No layout, command payload, authorization, pricing, stock/FIFO, payment or database behavior changes.

`app/utils/saleCopy.js` classifies copy from the existing draft/catalog `itemType` or persisted `item_type` fields. It never infers transaction type from shop business mode, stock availability, IDs, price or quantity. Empty/unknown line types receive neutral advisory copy. Product copy describes FIFO deduction/restoration; service copy describes no inventory effect; mixed copy explicitly separates product stock from service lines. EN/AR messages retain payment amount/method and immutable-document information.

The audit covers issuance confirmations/success toasts, sale preview warnings, Fast Pay confirmation, POS confirmation/server checks/location-change warning, stock error mappings and correction warning/confirmation. Existing neutral payment, permission, validation, reset, receipt and success messages remain appropriate for all transaction types. Fixed inventory labels describe product catalog stock or observed history, rather than promising transaction effects. Unexpected inventory errors on service transactions remain errors with review/retry guidance, without claiming missing service stock.

## Executed checks

- `node --test apps/shop-suit/tests/unit/ss-launch-sale-copy-001-1.test.mjs`: passed. Audits EN/AR transaction messages, remaining fixed inventory wording and page translation wiring.
- `node --test apps/shop-suit/tests/unit/ss-launch-sale-copy-001-2.test.mjs`: passed. Covers authoritative line classification, irrelevant stock/shop/pricing inputs, incomplete data, immutable inputs and payment placeholders.
- `node --test apps/shop-suit/tests/unit/*.test.mjs`: passed on the final source, 37 files. An earlier run failed the Arabic FIFO explanation assertion and a build-dependent brand test before build output existed; the original Arabic explanation was preserved and the final run passed after the build.
- `pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit`: passed on the final application source, 3 successful tasks. Lint reports 17 existing attribute-order warnings and no errors. The command also reports a read-only cache I/O warning without failing.
- `git diff --check`: passed.
- `pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-sale-copy-001-2.config.ts --workers=1 --retries=0`: failed before tests because the sandbox prohibits the synthetic fixture server from listening on `127.0.0.1:46421` (`EPERM`). Discovery finds 36 cases; discovery is not browser acceptance.
- `pnpm agent:preflight`: failed; fetch/live GitHub state could not be verified. No publication/base decision was made.

## Remaining gate

Browser/rendered verification is **unverified**. The task-owned browser suite uses synthetic transport for Sales issuance/customerless checkout/Fast Pay, POS, detail issuance and corrections across all three line classifications, EN/LTR desktop/light and AR/RTL mobile/dark. It checks confirmation cancellation, translated stock errors, keyboard activation and captures representative confirmation screenshots. No rendered states or screenshots were reviewed in this sandbox. Run the registered browser command in an environment that permits local listeners before accepting the browser obligation.

No Shop schema, migration, database test or database runner changed; database tests were not needed. No commits, pushes, merges, deployments or hosted database operations were performed.
