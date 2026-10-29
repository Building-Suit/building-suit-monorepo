# Electrical real-Auth measured/FIFO journey — prepared for owned native execution

SS-ELEC-606 remains IN_PROGRESS. Source builds on preserved8fed6ad6 and integrated81cdcc60. Two EN/AR native cases are now implemented in electrical-native.spec.ts, using the existing maintained pilot Auth/client/server infrastructure and a dedicated config extending its fixed-backend qualification config.

## Implemented scenario

A fresh mixed-mode synthetic merchant is created through existing authenticated public commands. The existing GoTrue helper creates random disposable Auth users, obtains real password sessions and performs the actual current two-stage UI login. All business setup uses public RPCs: three measured products, supplier purchases and replay. No direct business table write, service-role financial posting, mocked business response, test skip, hosted URL fallback or database reset is introduced. Limited read helpers use the actor token and a fixed table allowlist.

Two100m cable batches cost25/m and30/m. The first has yesterday's synthetic invoice date and the second today's: the public purchase authority fixes received_at to invoice-date noon, so request order alone would be an unreliable FIFO fixture. Existing public dates make FIFO order deterministic without editing batches or sleeping. Copper starts5kg at100/kg and breakers10 units at100 each. Stock/value initialization is asserted after purchase replay.

The browser adds12.5m cable,250g copper and two breakers, submits the real save_pos_sale_draft and checkout_pos_sale RPCs, and expects787.5EGP. It verifies the actual bearer-authenticated fixed loopback endpoint, exact entered unit/revision payload, server conversion snapshots, one full cash payment, exact command replay, and remaining stock/value (cable187.5/5187.5, copper4.75/475, breakers8/800). A second100m browser sale costs3500EGP and consumes87.5m at25 plus12.5m at30 (two actual batch IDs, COGS2562.5). Remaining cable is87.5m/value2625. Subsequent catalog price99 must not alter either stored receipt. Wrong-location receipt reads returnnull; another real Auth tenant cannot read receipts or stock or configure the first tenant's product, and stock remains unchanged. Receipt persistence is checked after page reload.

The fresh fixture's default cash-shift policy must be false; the test asserts that and never changes policy or opens a shift to avoid a guard. This exercises the already published online authority. It does not qualify the separate open-shift/durable/offline/cancellation recovery path or recreate unseen migration119. Those recovery claims still require the original archive. No external payment provider or real card/merchant is involved.

## Executed checks

- Companion shop_electrical_native_journey.sql PASSES on a fresh owned PostgreSQL schema harness after all120 actual Shop migrations. It proves the same public purchase/checkout/replay, gram conversion, mixed stock/value, FIFO crossing/COGS, frozen receipts, wrong-location result and cross-tenant read/write denials. Both merchant fixtures and all inherited configuration/reel/order/supplier/scale/commodity race groups also pass. Provider interfaces are explicit stand-ins: this is schema proof, not real Auth/browser acceptance.
- Strict standalone TypeScript compilation of the new native spec, fixture and existing pilot helper passes against current generated database contracts and installed Node types. An existing shared html locator needed an erased HTMLElement cast to access lang under strict compilation; no runtime branch or condition changes.
- All27 relevant measurement/cart/quantity/receipt/native-admission units pass.
- Both2 EN/AR synthetic login-driver regressions pass after the fixture helper extension. These remain synthetic, not native Auth acceptance.
- Dedicated native discovery finds exactly2 cases. Discovery invokes no account creation or financial operation.
- Scoped lint, strict template boundaries and diff whitespace checks pass. Workflow YAML parses, preserving its25-minute timeout, actual GitHub-hosted admission and always-run owned cleanup.

## Owned-runner execution still pending

The actual fixed native Shop backend is absent in this executor. The supported legacy-baseline setup rejects this non-GitHub runner, and no admission flag was spoofed or denied hosted interface retried. The existing shop-measurement-disposable workflow is prepared to build Shop and execute the new dedicated native browser config against its already owned Supabase backend, using the same isolated SUPABASE_HOME. Cleanup remains unchanged. This source preparation does not dispatch CI or mutate staging; Doctor then Ledger retain the coordinated slots before Shop.

Run only against the initialized owned native backend: `SHOP_PILOT_DISPOSABLE=1 pnpm exec playwright test -c apps/shop-suit/playwright.electrical-qualification.config.ts`. Real execution of these2 cases and exact-head full CI are required before any native acceptance claim. Trace/video/screenshots are off and output retention is never, protecting generated Auth session material. Original barber20-case qualification remains separate and is not claimed passed.

Physical reel/drum acceptance, cash-shift/offline/recovery qualification, returns/refunds, full role/location matrix, actual merchant/printer/scanner/approved-scale/native-Arabic sign-off,10000-active SKU suitability, payment eligibility and supported production catalog acknowledgment remain separate open gates. Main/production, credentials/provider settings and commercial terms are unchanged.
