# Electrical catalog capacity qualification — 2026-10-29

SS-ELEC-601 remains in progress. Source baseline: integrated staging `81cdcc608519f538a2dec85c3d6d6c2bd4e4687d`. The maintained rollback-only suite is `apps/shop-suit/supabase/tests/shop_electrical_capacity_audit.sql`.

## Executed qualification

Cloud-local command: `node tooling/database/shop-measurement-schema-disposable.mjs --suite shop_electrical_capacity_audit` — exit 0. All 120 actual Shop business migrations replayed. The suite passes existing offered monthly caps of 250, 500, 1000 and 2000 active products; creation at the cap; rejected overflow with no partial row; archive and replacement releasing exactly one slot; rejected page size101; first/last/empty bounded pages; exact SKU and technical search totals; and rejection of a different tenant actor.

The largest fixture retains exactly 10000 product records, of which 2000 are active and 8000 archived. This verifies retained-history behavior at the largest approved public cap. It does not establish an entitlement or performance qualification for 10000 active SKUs. Plans, commercial prices, catalog terms and production permissions are unchanged. Privileged fixture setup selects existing public offered terms; boundary writes and reads use authenticated public RPCs. The harness creates and destroys its own fresh container and wraps the suite in BEGIN/ROLLBACK. No hosted target is accepted.

The same execution passes the measurement foundation, measured retail and physical reel merchant fixtures; real-session configuration, reel, order reservation/collection, supplier receipt, scale capture and commodity pricing race groups; and JS/SQL measurement registry conformance. Provider interfaces are explicit stand-ins. These are not real Supabase Auth/financial browser, provider, hardware or merchant acceptance.

## Suitability and remaining gates

The existing public plans support at most 2000 active products. A merchant requiring 10000 simultaneously active SKUs cannot be declared supported by this evidence. Keep existing entitlements; any commercial change requires its own approved terms and qualification. Historical timing measurements in the scratch audit were taken on an earlier119-migration source and must not be described as current integrated latency. This run verifies correctness; it makes no browser/production latency guarantee.

Native exact-head CI, browser pagination/load with representative concurrent cashiers, production-sized active catalog suitability, merchant/printer/scanner/scale and native-Arabic acceptance remain open. Missing unpublished checkout-recovery source is a separate transfer prerequisite. No customer publication, deployment or main promotion occurred.
