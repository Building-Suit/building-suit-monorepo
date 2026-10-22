# Decisions

- D01: Existing products keep legacy operational semantics; explicit measured configuration is distinct from default ea display. Do not reinterpret old balances as pieces.
- D02: Exact dimension-safe conversion uses decimal strings/NUMERIC and rational equality. No silent rounding or universal meter/kg relation.
- D03: Pair=2 ea and dozen=12 ea. Set, pack, box, carton, bag, roll and reel need product-specific definitions.
- D04: Target quantity scale is six after complete M2 dependency migration; price/cost/financial scales are independently audited. M1 performs no quantity widening.
- D05: Base unit and increment cannot be reassigned once any stock, financial, service or externally published context exists. Zero balance alone is insufficient.
- D06: Service material history maps each→ea, mL→ml, g→g; it is never rewritten. Configuration and legacy declarations must agree.
- D07: M1 measured configuration is preparation only. Block operational writes for configured products until M2 has real integration, rather than allowing old two-decimal code to misinterpret them.
- D08: Keep existing bundle offers, server sale price calculation, tax and FIFO. Package pricing and wholesale precedence need explicit later contracts.
- D09: Reels allocate existing batch stock atomically. Cutting waste has a separate audited movement and cost, not an invented customer charge.
- D10: Reservations, deposits and returns extend current authorities. No duplicate customer/supplier ledger.
- D11: ETA mapping is versioned with the measured snapshot; do not assume an ETA code alone configures physical stock.
- D12: No subscription price/entitlement changes. Commercial capacity review and device/merchant acceptance remain external gates.
