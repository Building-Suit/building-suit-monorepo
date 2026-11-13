# Electrical catalog capacity qualification — 2026-10-29

SS-ELEC-601 remains in progress. Source baseline: integrated staging `81cdcc608519f538a2dec85c3d6d6c2bd4e4687d`. The maintained rollback-only suite is `apps/shop-suit/supabase/tests/shop_electrical_capacity_audit.sql`.

## Executed qualification

Cloud-local command: `node tooling/database/shop-measurement-schema-disposable.mjs --suite shop_electrical_capacity_audit` — exit 0. All 120 actual Shop business migrations replayed. The suite passes existing offered monthly caps of 250, 500, 1000 and 2000 active products; creation at the cap; rejected overflow with no partial row; archive and replacement releasing exactly one slot; rejected page size101; first/last/empty bounded pages; exact SKU and technical search totals; and rejection of a different tenant actor.

The largest fixture retains exactly 10000 product records, of which 2000 are active and 8000 archived. This verifies retained-history behavior at the largest approved public cap. It does not establish an entitlement or performance qualification for 10000 active SKUs. Plans, commercial prices, catalog terms and production permissions are unchanged. Privileged fixture setup selects existing public offered terms; boundary writes and reads use authenticated public RPCs. The harness creates and destroys its own fresh container and wraps the suite in BEGIN/ROLLBACK. No hosted target is accepted.

The same execution passes the measurement foundation, measured retail and physical reel merchant fixtures; real-session configuration, reel, order reservation/collection, supplier receipt, scale capture and commodity pricing race groups; and JS/SQL measurement registry conformance. Provider interfaces are explicit stand-ins. These are not real Supabase Auth/financial browser, provider, hardware or merchant acceptance.

## Suitability and remaining gates

The existing public plans support at most 2000 active products. A merchant requiring 10000 simultaneously active SKUs cannot be declared supported by this evidence. Keep existing entitlements; any commercial change requires its own approved terms and qualification. Historical timing measurements in the scratch audit were taken on an earlier119-migration source and must not be described as current integrated latency. This run verifies correctness; it makes no browser/production latency guarantee.

Native exact-head CI, browser pagination/load with representative concurrent cashiers, production-sized active catalog suitability, merchant/printer/scanner/scale and native-Arabic acceptance remain open. Missing unpublished checkout-recovery source is a separate transfer prerequisite. No customer publication, deployment or main promotion occurred.

## Browser qualification and demonstrated repair

A fresh production build from this branch passed. All10 `catalog-capacity.config.ts` cases pass in42.7s with one worker, retries0, existing5s expectations and no forced clicks. Eight product cases cover each approved cap (250/500/1000/2000) in EN/light1440px and AR/dark390px. They verify20-row DOM bounds, first/next/last pages, partial last page, disabled next, exact request page/size, bounded response16KiB, search resetting to page1, clearing search and no horizontal page overflow. Two service cases qualify the other actual consumer of the same shared template. All12 existing `atomic-catalogue.spec.ts` editor scenarios also pass (EN/AR, both themes,390/768/1440px), with unchanged validation, footer, save and focus assertions.

The focused pre-fix case first exposed an ambiguous test locator (category and page-size selectors); the locator was corrected. It then genuinely failed because10/50 row options were offered while both product and service adapters always request20 rows. `BsCataloguePage` now forwards typed `pageSize` and a one-entry `pageSizes` array from its controlled server projection. Query/financial/quota contracts are unchanged. Two initial service cases failed because the new fixture omitted scheduling options; supplying the existing typed empty location/staff response fixed the fixture. Full10/10 was rerun after that correction; the earlier8/10 is not described as a pass. Failure and complete execution logs are retained.

Browser transport is synthetic, serving only a bounded page; it does not exercise real Auth/financial RPCs or seed10000 active rows. This is correctness/responsive qualification, not a browser throughput SLA or full initiative language/device acceptance. New PR-only browser workflow is prepared, and the capacity SQL suite is added to the existing fixed-target native measured-retail runner. No CI was dispatched, staging changed or provider configured. Native exact-head verification awaits coordinated publication.

## Additional source checks

Shop typecheck passes after explicitly typing an existing shop-selection predicate with its imported `ShopSummary` domain type. The integrated baseline exposed TS7006 at that callback; a readonly-source-tuple experiment did not repair inference and was discarded. Type erasure verification confirms only optional arrow-parameter parentheses differ in emitted JavaScript. Existing actor/tenant selection and financial behavior are unchanged. All7 existing scope/receipt units and6 SEO/privacy units pass. Scoped source/browser lint, strict141-route template boundaries and diff whitespace checks pass. Production build passed before that erased annotation. Full native/full workspace exact-head CI remains pending coordinated publication.
