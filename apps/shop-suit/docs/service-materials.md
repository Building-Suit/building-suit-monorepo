# SS-SERV-002 service materials and fulfillment

Ordinary services require no recipe configuration. Payment is never completion. The service-materials page is available from business navigation; issued sales link to its explicit fulfillment view. Managers version recipes and declare unused products in `each`, `mL`, or `g` before receiving stock. Existing unlabelled stock cannot be relabelled. There are no unit conversions. Empty recipe versions disable future consumption.

The existing stock columns use two decimal places. Requests and multiplied recipe quantities must be exactly representable at 0.01 stock units; unsupported precision is rejected before stock writes. In particular 29.999 cannot be represented safely in the current stock contract; tests use a representable shortage and explicitly reject unsupported precision. This differs from the requested 29.999 fixture and must be reviewed before acceptance.

Managers may override actual quantities with an audit reason at completion. Fulfillment stores the selected immutable recipe version and actual materials, units, quantities and FIFO layers. Completed quantities accumulate to the exact sold quantity. A fully paid multi-unit line earns its frozen commission once its entire quantity is fulfilled. Rates and pre-tax basis remain immutable from issuance; the tax owner supplies the `sale_tax_snapshots.snapshot.lines[].net` basis.

Appointment completion executes the same atomic command. Unlinked appointments retain one explicit completion, then append a sale-line link when sold; no fake appointments are created for walk-ins. Linking requires one unambiguous matching service line. Corrected sales reject new fulfillment. Completing an already fulfilled appointment does not consume again. Unperformed historical appointments are not backfilled.

Refunds and sale corrections do not restore consumed material: consumption movements reference fulfillment IDs, separately from sale stock movements. `correct_service_material` is a manager-only, reasoned, idempotent partial restoration bounded by the original consumed FIFO allocation. It appends a correction and stock movement; it never edits consumption history. No automatic commission changes arise from material corrections.

The existing encrypted offline vault caches only one service-line projection (IDs, names and quantities); audit history/reasons require connection. It holds service completion commands with stable request IDs. Synced means the server confirmed completion. Pending and stock/permission conflicts remain visible. Reconciliation either reports the committed fulfillment or atomically tombstones the original request, preventing late posting. Offline completions use the recipe active when accepted by the server, not a stale cached estimate. Offline recipe changes and actual-usage overrides require live manager context.

## Contracts

- `define_service_material_unit(shop, product, unit) -> void`: manager; unused product only; immutable unit declaration.
- `save_service_recipe(request, shop, service, effectiveAt|null, materials, reason) -> uuid`: manager; null means now; no past effective time; materials use `{productId, unit, quantity}` per service unit.
- `complete_service(request, shop, location, line|null, quantity, appointment|null, actualMaterials|null, reason) -> fulfillment uuid`: authorized sales and location access; appointment access when present; issued uncorrected sales may be unpaid. Null actual materials applies active recipe; a supplied array requires manager authority and uses total actual amounts for this completion.
- `service_fulfillment_context(shop, location, invoice|null, offset=0) -> {totalCount, lines}`: authorized line quantities, completed quantities, immutable history and FIFO allocations; completion history is server-paginated in pages of 50.
- `service_recipe_context(shop, offset=0)`: manager context; recipe version history paginated in pages of 50.
- `correct_service_material(request, shop, consumption, quantity, reason) -> correction uuid`: explicit audited restoration to original layer, bounded cumulatively.
- `reconcile_service_completion(shop, originalArgs, resolutionRequest, reason)`: `{state:'synced', invoiceId:fulfillmentUuid}` or `{state:'cancelled', resolutionRequestId}`. The legacy queue result field `invoiceId` carries a fulfillment ID here; no receipt link is fabricated.

All new tables have RLS enabled and no direct browser grants. Mutation RPCs authorize tenant and location server-side. History is append-only; all changes are a new forward migration. No hosted writes, historical backfill or main promotion.

External product context: [SalonBridge](https://help.mysalonbridge.com/en/articles/2742817-what-is-a-service-recipe), [Zenoti](https://www.zenoti.com/salon-management-software/inventory-management). Explicit completion, units/precision, refund and conflict policies above are Building Suit choices.
