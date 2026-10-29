# Catalog capacity search ordering qualification

Automatic promotion run 40951252169 at integrated staging eb5a80b6f5efbe71cfd99d8374b277fcf3bd096a passed 9/10 cases; 500-active English saw p_page 25 instead of1 in its global last-recorded list_products call. PR515 exact-head capacity had passed, and protected staging push40951242482 review/full verify passed. Preserve the failed promotion result; it is not a complete capacity pass.

## Deterministic diagnosis

The catalog query key includes search and page. Changing search on page 25 can start an obsolete-key media request before the page-reset watcher selects page 1. Both reads try shop_catalog_media; the maintained synthetic legacy fixture returns PGRST202, then each invokes list_products. The old request can reach its legacy fallback last. The active page 1 query still supplies the visible row/count; completion order across obsolete keys does not identify the current query.

A controlled transport gate holds only the old page 25/search media fallback until page 1 and its one result are rendered, then releases it. No sleeps, deadline increases, retries or skipped assertions. With the original global-last-call assertion retained, this deterministically fails with expected page 1/received25—the same CI failure—even while the correct result is visible. The before source/log/context/trace are preserved locally under /workspace/shop-capacity-search-evidence/before.

## Prepared repair

Change only the test readiness boundary. Observe the actual page 1 list_products response for the exact search; assert successful status, unchanged request arguments (page 1,size20,search), response page 1/total1 and the visible matching row. In both 500-product locales force the old fallback to finish last; assert its page 25/total1/empty-items response and its actual last-call arguments, then verify it does not replace the page 1 row/count. Clearing search still restores 20 rows and the first item. Existing 250/500/1000/2000 cap cases, 16 KB payload bound, fixed server pagination and both service-catalog cases remain.

All 10 capacity cases passed locally in 44.5 seconds after the correlated-response repair. The final strengthened obsolete-response checks pass both 500-product locales (2/2, 10.6 seconds). Scoped ESLint and strict standalone TypeScript pass. No runtime app/UI/query code, financial test, entitlement, migration, hosted configuration or provider setting changed. The existing built app has the identical tree from accepted staging; this test-only qualification does not need a rebuild.

The previous original recovery source, merchant/device/native-Arabic acceptance and production/catalog/activation gates remain separate.10,000 retained records/2,000 active products is not10,000 active SKU readiness. Local synthetic transport does not replace the already recorded real Auth/FIFO financial acceptance.

Branch codex/shop-suit/catalog-search-sequencing starts from staging eb5a80b6. Prepared locally only while Doctor owns CI; no push, PR, fullCI or staging mutation is authorized by this checkpoint alone.

Before, full-group after and final targeted output are retained alongside this report as capacity-search-ordering-{before,after,final}-20261029.txt. The final targeted execution adds explicit obsolete response contents and last-call checks to the full-group passing patch.

Committed console copies trim trailing whitespace; original local logs and the failing trace remain unchanged.
