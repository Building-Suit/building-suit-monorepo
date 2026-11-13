# Current capability audit

Audit baseline: clean fresh origin/stg2efbed85, no open Shop stack, original main-equivalent work checkout221e0e39 preserved. `pnpm agent:preflight` initially failed on pnpm11; documented `node tooling/git/preflight.mjs` succeeded and queried live refs/PR/checks. Pinned pnpm10.33.0 installed dependencies. GitHub recent PR436 merged Website inclusion in plan cards; PR423 delivered builder/bundles. No stale feature worktree adopted.

| Capability | Classification | Evidence and extension |
|---|---|---|
| Product create/edit/archive, SKU/barcode, categories | Implemented but needing extension | products/index.vue; save_product/save_product_with_category/list_products/archive_product; catalog categories/import migration20260929120000; shop_crm_product_catalog.sql |
| Images, suppliers, quotas/import | Implemented but needing extension | useCatalogMedia.ts;20261013022326_catalog_image_upload; catalogImport.js; plan-resource trigger migrations; maintain bounded queries and quota errors |
| Public catalog and bundle offers | Implemented but needing extension |20261020114919_storefront_builder_bundle_offers.sql; shop_catalog_offers, match_catalog_offers, save_pos_sale_draft; preserve existing mixed-product offer discounts |
| Canonical product measurement | Missing at audited parent | products/index.vue and products table lack base unit/increment; no general conversion registry |
| Precision | Partially implemented/inconsistent | PRECISION-AUDIT.md: two-decimal storage vs three-decimal draft/purchase validators; service/return restrictions |
| FIFO batches/movements, adjustments/counts/corrections/thresholds/valuation | Implemented but needing extension | inventory/index.vue;20260926150000_stock_counts_low_stock_corrections;20260923185133_atomic_sale_issuance; shop_stock_counts_corrections.sql; no physical reel identity |
| Location stock | Implemented but needing extension | shop_locations and location-scoped stock functions; preserve location checks in every new resolver |
| Supplier invoices, receive/payments/returns/credits/reports | Implemented but needing extension | purchases/index.vue;20260926120000_complete_supplier_payables_returns.sql; supplier-focused SQL runner; no entered/base measurement snapshots |
| POS/barcode/draft/authoritative issue/customer payments/partial returns/corrections | Implemented but needing extension | pos.vue,utils/pos.js; sale issuance and partial return migrations; server recatalogs prices; cart +1 and Number previews |
| Receipts/tax/ETA/offline/cash shifts | Implemented but needing extension | receipt.ts; offlineStore.js;20261014101723_offline_pos_replay;20261015013239_configurable_sale_taxes; ETA submission migrations; no generalized conversion snapshot |
| Service material recipes/consumption | Implemented but needing extension |20261015013509_service_material_fulfillment.sql: immutable each/mL/g declarations and two-decimal quantities; preserve history |
| Reports/margins/balances/CSV | Implemented but needing extension | reports/index.vue,reporting.ts,catalogImport.js; avoid grouping unrelated dimensions as one quantity |
| Team roles/plan entitlements | Implemented but unverified in this candidate | shop_permission_access,assert_shop_write_access,resource-limit triggers; no commercial entitlement change authorized |
| Electrical attributes/variants/reels/cutting/remnants | Missing or unverified | no first-class inventory_reels in current migration chain; require distinct independently stocked variants |
| Contractor rules/quotes/orders/reservations/deposits/supplier orders | Missing or unverified | ordinary draft sales are not formal immutable quotes/orders; current payment infrastructure must be reused |
| Scales/variable weight barcode/mass-length/forecast/commodity pricing | Missing or external dependency | protocol/device/market evidence needed; do not guess barcode payloads or universal physical relationships |
| Hosted schema/publication/deployments | Blocked by external dependency | RELEASE-RECONCILIATION.md; environment has no configured secret bindings; no hosted DB trial performed |

No feature is marked verified from file presence. Existing tests and new run results are bound in VERIFICATION.md. Ordinary pieces retain original legacy semantics until explicit safe configuration; historically used products require separate reviewed conversion.
