# Approved commodity reference pricing

SS-ELEC-508 is an optional shop-wide alternative to the ordinary catalog price. It does not import a live market feed or infer exchange rates, commodity content, product density or a selling price from a scale reading. Existing products without an active rule keep their current behavior.

## Source approval

A products manager records a commodity name, named source organization, traceable document/reference, explicit price per kilogram, business currency, effective time and expiry. Timestamp inputs include a timezone at the API boundary; the editor labels its local-time fields and sends ISO timestamps. Activation requires explicit staff confirmation and a reason. A source can be approved for a future effective date, but cannot price a sale before that date. Expired sources cannot be activated. The initial adapter accepts only the shop's business currency, so there is no implicit FX or price-per-tonne conversion.

Quote terms are immutable. Record a new source quote to change its rate, currency, reference or dates. Retiring/reactivating a record changes only its state and revision, with a named immutable event; original approver and approval time remain. Synthetic automated-test references do not constitute supplier or merchant verification.

## Product rule and exact formula

For each active measured mass or length product, the manager approves the kilograms of the named commodity per canonical stock unit and a fixed price premium per stock unit. This relationship is separate from a scale's approved total product mass-to-length factor. It binds the product, measurement revision, stock unit, source quotation, evidence reference, actor and time. It applies across the shop's locations, like existing product and trade-price configuration.

The server calculates:

`price per stock unit = commodity kg per stock unit × approved source price per kg + price premium per stock unit`

For example, 0.2kg of copper per metre at100 EGP/kg, plus5 EGP/m, gives25 EGP/m. Input factors and rates support up to twelve decimal places. The complete result must be representable at the existing selling-price precision and amount limit; intermediate rounding is rejected. Compatible sale units and flexible packages use the existing measurement kernel. Tracked reels retain their source/length authority.

Existing authorized staff prices, customer contracts, group prices, quantity agreements, explicit fixed-price packages and selected discounted remnants keep their precedence. Commodity pricing replaces only the remaining catalog-price branch. It does not stack with bundle discounts. If an applicable active rule has a stale product/currency identity or unavailable source, the current sale requires manager review; it does not silently revert to the catalog price. Disabling the optional rule explicitly restores ordinary pricing.

## Financial and retry boundaries

All prices come from the existing authorized quote, draft, issuance, tax, payment and FIFO commands. Configuration does not post inventory, invoices, customer balances or payments. Draft issuance revalidates current authority and source pricing under the existing shop lock. Issued snapshots retain the full original source, rule revision, exact content/premium, currency, actor and time. Original returns retain their original price and cost. Accepted quotation/order agreements preserve their explicit frozen price through later source retirement and reserved collection.

Unknown setup results retain the exact request UUID and payload, freeze edits and block dismissal until resolved. The POS additionally retains the reviewed checkout amount across draft-save quote invalidation and a same-request retry: a quoted25 must not become the catalog35 merely because saving the draft refreshes the quote cache. Full uncertain-payment edit protection remains part of the separate E6 checkout-hardening gate.

A current commodity rule marks the existing online-quote requirement. Cached manual/offline work cannot authorize a new commodity rate. Final financial authority remains on the server, including changed-price/full-payment rejection and closed-period checks.

## Qualification

The scoped118-migration fixture passes exact formula/source snapshots, no-configuration equivalence, approved kg/g and package behavior, contract/group/quantity/staff/remnant precedence, future/retired-source rejection, malformed/precision guards, immutable issued returns and accepted-order conversion/collection, actual invited cashier/outsider denial and expired-plan read/write separation. Four new real-session races pass duplicate source approvals, stale rule edits, retirement-first issuance rollback and sale-first original evidence. Both merchant journeys and all11 inherited races also pass. Provider stand-ins are explicit; native current-child acceptance is not inferred.

The first four built EN/AR approval/retry/history/checkout, denied-reader and malformed-reader cases pass after correcting the quote-amount defect. The initial run exposed that defect and a desktop history action deadline; the corrected run retains the original assertions and five-second action limit. The Arabic390px/dark approval screenshot is visually inspected. Actual generated contracts, strict122-template boundaries, app/shared lint and the initial Shop typecheck/build pass. Final rebuilt lost-payment retry, complete combined browser/SQL/root/consumer/release/native qualification remain tracked in VERIFICATION.md. Real source documents, merchant acceptance, native Arabic review and hosted rollout remain separate gates.

Final current Shop and Docs typechecks pass. The remaining publication gates are the committed release check and native CI; E6 and external acceptance remain separate.
