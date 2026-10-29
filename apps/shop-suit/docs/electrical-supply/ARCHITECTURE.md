# Measurement architecture

## Existing authorities

Shop owns business rules and `public` RPCs; `shop_private` contains unexposed helpers. Existing shop/location locks, subscriptions, membership permissions, idempotent requests, FIFO batches/movements, sale issuance, supplier balances, payments, tax and immutable receipts remain authoritative. Shared UI owns complete templates. Measurement never overloads product/service `itemType`.

## Canonical quantities

Use one stock unit per product. Preserve unconfigured products as legacy, with display default `ea`, without imposing an integer constraint retroactively. Explicit piece configuration uses increment 1. Existing service-material declarations (`each`, `mL`, `g`) override inferred labels: map to `ea`, `ml`, `g` without changing any stored quantity or immutable declaration. Historical snapshots remain untouched.

A sealed unit registry defines bilingual labels, symbols, dimensions, decimal precision and exact factors relative to ea/m/kg/L/m². Pair and dozen have fixed count factors; set and packaging require a product definition. Never give a universal box/reel/set conversion. Referenced definitions are immutable; future corrections require new versioned definitions.

Authoritative arithmetic uses PostgreSQL NUMERIC and exact ratio equality. Client previews use BigInt scaled decimal strings, never financial Number arithmetic. Reject incompatible dimensions, nonfinite/negative quantities, out-of-range or unrepresentable results. Conversions never silently round. Return normalized decimal strings across new RPC contracts.

## Migration sequencing

M1 adds the registry, product defaults, guarded configuration, and conversion RPC. It does not widen every numeric field or claim operational integration. New measurement configurations remain blocked from stock/transaction writes until the dependent operational contracts are implemented. Legacy paths continue unchanged. M2 must remove that guard only alongside complete precision, snapshots, purchase/sale/inventory/returns/offline/reporting integration and tests.

M2 selects quantity NUMERIC(18,6) only after reviewing the precision inventory and dependent views/functions. Money totals retain currency rounding; acquisition cost precision is treated separately. Snapshot entered unit, entered quantity, base unit/quantity, conversion definition/version, chosen package and authoritative price on posted lines. Replays bind identical request IDs to identical source selections, not just equal converted quantities.

## Stock and pricing

Product packaging is a versioned conversion of the same stock. Existing mixed-product bundle offers remain separate. Package-specific prices require server pricing and explicit precedence with bundles and later contractor rules. Reels refine FIFO physical lineage; no second independent balance. Acquire product locks, reel locks and batches in consistent identity order. Continuous length requires a single eligible reel; aggregate stock cannot satisfy continuity.

## Historical migration

Unit/increment changes are allowed only for unused products with no stock, movement, sale/purchase draft or posted line, count, threshold history, service declaration or published/bundle/offline context. Migrate used legacy stock only through a separately reviewed atomic conversion with audit reason and valuation preservation. Do not infer that zero current balance means no history.
