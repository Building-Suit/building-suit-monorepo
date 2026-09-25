# Building Suit — Delegated Decision Resolutions

Generated from the three authoritative handoff JSON files supplied on 2026-09-24.

The product owner explicitly delegated the remaining implementation-policy decisions in the current conversation. These resolutions are recommendations authored by ChatGPT, not text present in the original handoffs. Original decision text/status is preserved in the import metadata.

Important: Ledger `V2-IMP-013` remains blocked because current dated authoritative tax/regulatory evidence is an external prerequisite; decision approval alone cannot satisfy that evidence requirement.

## Ledger Suit

### V2-D03

**Original open question/decision:** Final journal numbering still needs organization/fiscal-year scope, assignment moment, format, rollback-gap policy, reuse prohibition and legacy presentation.

**Approved resolution:** Use organization + fiscal-year sequential journal numbers assigned only at final successful posting. Format JRN-{FY}-{000001}. Gaps are allowed, numbers are never reused, and rollback/retry must not create a second posted journal. Existing legacy journals keep their historical reference and are not renumbered.

### V2-D05

**Original open question/decision:** Receivables policy: recognition timing, allocation cardinality, credits, unallocated receipts, overpayments, write-offs/adjustments and reversed-allocation behavior.

**Approved resolution:** Recognize receivables when an invoice/accounting obligation is issued. One receipt may allocate to multiple invoices and one invoice may receive multiple receipts. Receipts must be fully allocated at creation; unallocated receipts are not supported in V2. Reject overpayments above authoritative outstanding balance. Credits use linked immutable credit/correction records. Write-offs/adjustments require a dedicated privileged reasoned path. Reversals are append-only and reverse allocations/accounting effects without deleting originals.

### V2-D06

**Original open question/decision:** Payables policy: recognition timing, allocation cardinality, supplier credits, unallocated payments, overpayments, expense-vs-asset bills and reversed-allocation behavior.

**Approved resolution:** Recognize payables when a supplier bill is issued/approved, posting the approved expense or asset exactly once. One payment may allocate to multiple bills and one bill may receive multiple payments. Payments must be fully allocated; reject overpayments above authoritative outstanding balance. Supplier credits use linked immutable credit/correction records. Reversals are append-only and restore payable without deleting original payments or bills.

### V2-D08

**Original open question/decision:** Bank matching policy: tolerances, one-to-many/many-to-one, transfers, unmatch/correction, completion/reopening and outstanding-item treatment.

**Approved resolution:** Bank matching supports one-to-one, one-to-many and many-to-one when the selected totals reconcile exactly in the same currency. Do not hide differences behind automatic tolerance; differences require an explicit accounting adjustment. Matching existing ledger transactions never reposts them. Internal transfers remain transfer-linked, not income/expense. Unmatch/correction is allowed before completion; completed reconciliations are immutable unless privileged reopening records a reason and audit trail. Outstanding items remain explicit in the reconciliation equation.

### V2-D09

**Original open question/decision:** Fixed-asset policy: depreciation methods, proration/conventions, capitalization date, residual/useful-life changes, impairment, disposal and correction behavior.

**Approved resolution:** Support straight-line and declining-balance depreciation, with straight-line as default. Capitalization starts when the asset is placed in service. Proration is daily from the in-service/disposal dates. Residual value, useful life and method changes are prospective from the next open period with audit evidence. Impairment is an explicit adjustment. Disposal clears cost and accumulated depreciation and posts proceeds plus gain/loss. Corrections use linked reversal/replacement rather than rewriting history.

### V2-D10

**Original open question/decision:** Accounting-dimension policy: required/optional applicability, multi-allocation cardinality, inactive values, retroactive changes and explicit Unassigned treatment.

**Approved resolution:** Dimensions are configured per accounting context as optional or required. A journal line may use one or multiple allocations; when multiple allocations are used they must reconcile exactly to the line amount. Inactive values cannot be used on new postings but remain valid historical references. Posted dimensions are not retroactively rewritten. Reporting always exposes an explicit Unassigned bucket so grouped totals reconcile to the unfiltered ledger.

### V2-D11

**Original open question/decision:** Tax/VAT jurisdiction and business scope, current rates/rules, rounding, tax points, adjustments, document/report scope and external-compliance boundaries.

**Approved resolution:** Initial tax/VAT implementation is scoped to Egypt only, uses effective-dated configuration and must not hard-code rates or claim compliance without dated authoritative regulatory evidence. Rounding occurs only at explicitly defined tax/document boundaries using the document currency minor unit. Tax points, rates, exemptions, adjustments and report scope must come from verified authoritative sources before runtime implementation. External filing/e-invoicing submission remains out of scope unless separately authorized.

### V2-D12

**Original open question/decision:** Inventory accounting policy: movement source of truth, Control accounts, costing/valuation method, negative stock, returns, backdating, corrections and revaluation.

**Approved resolution:** When Inventory Suit is connected, its versioned movement/valuation facts are the inventory accounting source of truth and Ledger must not recalculate operational stock valuation. Inventory Control/COGS mappings are configurable in Ledger. Negative stock is not accepted as an accounting source. Returns, backdating, corrections and revaluations arrive as explicit versioned/compensating facts and are posted idempotently. Ledger does not implement WMS/procurement behavior.

### V2-D13

**Original open question/decision:** Whether AR/AP obligations support foreign-currency settlement and realized/unrealized FX/revaluation. Do not infer this from existing transaction currency support.

**Approved resolution:** Foreign-currency AR/AP settlement and realized/unrealized FX revaluation are out of scope for Accounting V2. AR/AP obligations settle in the organization base currency. Preserve existing transaction-currency support where already valid, but do not extend it into multi-currency receivables/payables without a future explicit task.

## Shop Suit

### PUR-D01

**Original open question/decision:** Define supplier credit semantics.

**Approved resolution:** Supplier credits are immutable credit records linked to a supplier and, when applicable, the originating purchase/return. Applying a credit reduces payable without creating cash movement. A stock return owns the stock/value effect; the credit record must not reduce stock again. Credits cannot exceed the eligible remaining purchase/payable amount unless a future explicit supplier-credit-balance feature is approved.

### PUR-D02

**Original open question/decision:** Define purchase-return behavior when some or all received stock has already been consumed/sold.

**Approved resolution:** A purchase return may reduce stock only for quantity that is still available/owned and traceable to the originating receipt. Quantity already sold, consumed or otherwise unavailable must never be returned as physical stock or drive stock negative. Any financial-only supplier concession for unavailable quantity is represented as a supplier credit with no stock movement. Every return is append-only, linked and idempotent.

### PUR-D03

**Original open question/decision:** Define supplier overpayment behavior.

**Approved resolution:** Reject supplier payments above the authoritative outstanding payable in V1. Do not create unallocated supplier credit from overpayment.

### PUR-D04

**Original open question/decision:** Define supplier unallocated-payment and reversed-payment behavior.

**Approved resolution:** Supplier payments must be fully allocated when created. Unallocated supplier payments are not supported in V1. Original payments are immutable; reversal is an append-only event that restores the affected payable exactly once and preserves actor/date/reference history.

### SALE-D01

**Original open question/decision:** Define whether and how approved custom/manual sale lines are supported.

**Approved resolution:** Custom/manual sale lines are not part of Shop Suit V1. Sales may contain catalog products and services only. A future explicit decision may add non-catalog lines.

### SALE-D02

**Original open question/decision:** Define Shop Suit tax/VAT scope and any compliance claims. Existing tax-like fields are not approval.

**Approved resolution:** Tax/VAT calculation and compliance are out of Shop Suit V1. Do not expose tax controls as authoritative, do not make compliance claims, and do not add business tax defaults. Preserve any historical tax-like fields only as legacy data until a separately researched and approved tax scope exists.

### SALE-D03

**Original open question/decision:** Define any additional supported sale lifecycle states beyond the currently supported draft/issued behavior.

**Approved resolution:** Keep the authoritative V1 sale lifecycle to draft and issued. Void, return, refund and correction are append-only linked correction records/events against an issued sale, not destructive state rewrites or extra mutable lifecycle states.

### SALE-D04

**Original open question/decision:** Define partial sale-return semantics, including how quantities, payments, refunds and stock restoration interact.

**Approved resolution:** Allow partial returns per original line up to sold quantity minus prior returns. Product returns restore stock exactly once with traceability to original FIFO cost effects; service returns have no stock effect. If the sale is unpaid, the return reduces outstanding. If money was collected, any refund is a separate outbound payment limited to the refundable amount. Repeated requests are idempotent and the original sale remains immutable.

### SERV-D01

**Original open question/decision:** Decide whether configurable service material consumption is included in the V1 launch scope.

**Approved resolution:** Include configurable service-material consumption in V1.

### SERV-D02

**Original open question/decision:** If service material consumption is approved, define units and rounding rules for consumed materials.

**Approved resolution:** Service material quantities use the stocked product's canonical base-UOM normalization and exact-decimal conversion rules. Reject quantities that cannot be represented safely; do not silently round inventory consumption. Display rounding is presentation-only.

### SERV-D03

**Original open question/decision:** If service material consumption is approved, define versioning/edit-effective-date behavior so recipe changes do not rewrite issued history.

**Approved resolution:** Service-material definitions are versioned. Editing a recipe creates a new effective version for future issued sales. Each issued sale snapshots the exact recipe/material quantities used so later edits never rewrite history.

### EXP-D01

**Original open question/decision:** Decide whether EXP-05/EXP-06 other operational income/cash entries are part of launch scope.

**Approved resolution:** Other operational income/cash-entry workflows are excluded from V1. Complete the expense workflow only.

### EXP-D02

**Original open question/decision:** If operational income is approved, define its categories/source semantics so it cannot duplicate sales revenue.

**Approved resolution:** No operational-income categories are introduced in V1. Any future non-sale income feature requires a separate explicit semantics/design decision so sales revenue cannot be duplicated.

### TEAM-D01

**Original open question/decision:** Approve the initial staff role catalog / role templates while retaining granular backend permissions.

**Approved resolution:** Provide default role templates Owner, Manager, Sales/Cashier, Inventory, Purchasing and Viewer/Auditor. Templates are convenience only; granular backend capabilities remain authoritative and administrators may compose allowed capabilities without exceeding their own authority.

### TEAM-D02

**Original open question/decision:** Define staff invitation expiry duration/policy.

**Approved resolution:** Staff invitations expire after 7 days, are single-use, revocable, and bound to the target shop, invited identity and intended role/capability grant.

### TEAM-D03

**Original open question/decision:** Define staff seat quotas or explicitly approve no seat quota for the initial plans.

**Approved resolution:** Do not enforce a hard staff-seat limit during V1 beta. The entitlement model must support a nullable/configurable seat quota and enforce it atomically only when a plan config supplies one.

### SUB-D01

**Original open question/decision:** Approve final subscription plan names.

**Approved resolution:** V1 implements a configurable resource-entitlement catalog rather than hard-coded public commercial tiers. Use internal plan slugs/configuration and keep public display names data-driven so commercial naming can change without code migration.

### SUB-D02

**Original open question/decision:** Approve final plan prices.

**Approved resolution:** Do not hard-code or publicly claim final Shop Suit prices in this implementation. Price fields may be nullable/configurable and billing-provider work remains out of scope. During beta, no automated paid checkout is introduced by this task.

### SUB-D03

**Original open question/decision:** Approve final trial duration/terms.

**Approved resolution:** Support a configurable trial duration with 30 days as the default commercial trial value, but allow beta/internal plans to disable automatic trial expiry. Historical data is never deleted when a trial ends.

### SUB-D04

**Original open question/decision:** Approve resource quotas/limits for each plan.

**Approved resolution:** Resource quotas are data-driven per plan and per resource. During beta the default is unlimited/null unless an explicit configured limit is present. The backend must enforce configured limits atomically; no arbitrary product/business-mode gate is hard-coded.

### SUB-D05

**Original open question/decision:** Define approved upgrade/downgrade actions and timing.

**Approved resolution:** Upgrades take effect immediately after an authorized entitlement change. Downgrades take effect at the next renewal/effective boundary unless an administrator explicitly schedules otherwise. Entitlement changes are audited and cannot be self-granted by clients.

### SUB-D06

**Original open question/decision:** Define history-read access and write restrictions after subscription expiry.

**Approved resolution:** After subscription/trial expiry, preserve read access to historical business data and exports for authorized users, but block new money/stock/business mutations except account/subscription/reactivation actions required to restore service.

### SUB-D07

**Original open question/decision:** Define behavior when a downgrade leaves existing usage above the new plan limits. Historical data must not be silently archived or deleted.

**Approved resolution:** If a downgrade leaves usage above a configured limit, keep all historical data intact and readable. Block creation of additional over-limit resources until usage falls below the limit or the shop upgrades; never auto-delete or silently archive existing records.

### SET-D01

**Original open question/decision:** Approve supported business currencies and any currency-change restrictions.

**Approved resolution:** EGP is the default currency. Currency is stored as an ISO-4217 code and Shop Suit performs no implicit FX conversion. The business currency may be changed only before the first finalized monetary document; after financial history exists it is immutable without a future explicit migration workflow.

### SET-D02

**Original open question/decision:** Approve configurable invoice/receipt presentation settings.

**Approved resolution:** Invoice/receipt presentation may configure business name/logo/address/contact, document labels, optional footer/notes, language/direction and line-description visibility. Finalized documents snapshot all presentation/business values needed for historical rendering.

### SET-D03

**Original open question/decision:** Approve any business tax defaults only after SALE-D02 tax scope is decided.

**Approved resolution:** No business tax defaults are supported in V1 because SALE-D02 excludes tax/VAT scope. Existing legacy fields are not treated as approved defaults.

### INT-D01

**Original open question/decision:** Cross-product SSO remains a separate future decision and is not part of current Shop Suit implementation.

**Approved resolution:** Cross-product SSO is explicitly out of current Shop Suit scope. Shop keeps independent authentication/session behavior.

### INT-D02

**Original open question/decision:** A concrete future Ledger integration contract, including any queues/tables/events, must be approved before integration infrastructure is added.

**Approved resolution:** Do not create Ledger integration queues/tables/events in current Shop implementation. Preserve stable operational IDs and correction links only; a future versioned integration contract must be approved before integration infrastructure is added.

## Inventory Suit

### IS-D01

**Original open question/decision:** How are warehouse-scoped capabilities assigned, inherited, revoked, and evaluated alongside tenant-wide capabilities?

**Approved resolution:** Authorization is capability-driven and deny-by-default. Tenant-wide Owner/Inventory Admin authority may span all warehouses. Other users require both the relevant capability and an explicit warehouse grant for warehouse-scoped actions. Warehouse grants never create capabilities by themselves. Revocation/suspension takes effect immediately for new protected requests, and client-selected tenant/warehouse context never grants authority.

### IS-D02

**Original open question/decision:** What maximum authoritative quantity/conversion/unit-cost/valuation scales, rounding mode and business-significant rounding boundaries apply?

**Approved resolution:** Use exact-decimal authoritative storage with maximum scales: quantity NUMERIC(24,6), conversion factor NUMERIC(24,12), unit cost NUMERIC(24,8), valuation totals NUMERIC(30,8). Never silently round stock quantities or conversion factors. Preserve full internal precision and round only at explicit business/reporting boundaries using half-up rounding to the configured display/currency scale.

### IS-D03

**Original open question/decision:** What controlled workflow is allowed for changing base UOM or tracking mode after stock history exists?

**Approved resolution:** Base UOM and tracking mode may be edited only before the item has finalized stock history. After any finalized movement they are immutable in V1. A structural change requires archiving/replacing the item and a separately controlled migration/transfer process; existing history is never rewritten.

### IS-D04

**Original open question/decision:** What are the default operational removal strategy, configuration inheritance and deterministic tie-break rules?

**Approved resolution:** Default operational removal is FIFO picking for non-expiry inventory and FEFO for expiry-tracked inventory. Manual selection and location-priority/closest strategies remain available as explicit configuration. Inheritance is item override > warehouse default > tenant default. Deterministic ties use expiry date where applicable, then receipt effective timestamp, configured location priority, and stable lot/serial/location identifiers.

### IS-D07

**Original open question/decision:** If sequential human-readable document references are required, what are their scope, assignment time, format, gap and reuse rules?

**Approved resolution:** Every stock document has an immutable UUID plus a human-readable reference scoped by tenant, document type and calendar year. Assign the readable sequence at successful finalization, format TYPE-YYYY-000001, allow gaps, never reuse numbers, and never renumber historical documents. Drafts rely on UUID/temp display until finalized.

### IS-D08

**Original open question/decision:** What exact tenant activation, migration, fencing, reconciliation and rollback protocol switches Shop from standalone stock authority to Inventory authority?

**Approved resolution:** Future Shop-to-Inventory authority cutover is per tenant and requires explicit activation, a zero/explained reconciliation snapshot, fencing of Shop stock writes, migration/opening snapshot, idempotent replay/deduplication, comparison evidence and a single-authority switch. Never allow dual writers. Rollback before final cutover may restore Shop authority; after final cutover use forward/compensating events rather than rewriting history.

### IS-D09

**Original open question/decision:** Under what conditions may opening inventory be introduced after ordinary stock activity has begun, and what approval/correction treatment applies?

**Approved resolution:** Opening inventory is allowed only before ordinary finalized stock activity for the relevant item/warehouse scope. Once ordinary activity exists, use controlled count/adjustment workflows instead of introducing a new opening balance. Opening imports remain idempotent, reviewed and fully traceable.

### IS-D10

**Original open question/decision:** What controlled migration is allowed when changing valuation method after stock history exists?

**Approved resolution:** Valuation method is immutable after the first valued stock movement in V1. Do not perform in-place historical revaluation to switch methods. A future dedicated migration may be designed separately; until then use a replacement item/cutover approach with preserved history.

### IS-D11

**Original open question/decision:** How will Ledger map and consume Inventory valuation, NRV, write-down, reversal and reconciliation facts as formal journals?

**Approved resolution:** Ledger consumes versioned Inventory valuation/NRV/write-down/reversal facts through explicit integration events/outbox records, idempotent by stable event ID. Ledger owns account mappings and journal creation; Inventory never posts Ledger journals. Cross-Suit reconciliation must be zero or explicitly explained.

### IS-D12

**Original open question/decision:** What final reviewed Arabic Inventory glossary/copy refinements are approved beyond the supplied baseline terminology?

**Approved resolution:** Approve the supplied Egyptian Arabic Inventory terminology baseline as the final V1 glossary. Later copy refinements may improve wording but do not block implementation unless they change domain meaning.

### IS-D13

**Original open question/decision:** What plans, prices, quotas and commercial entitlements apply?

**Approved resolution:** Commercial plans/prices/quotas are deliberately deferred from core V1. Core Inventory implementation must not hard-code commercial entitlements; keep future entitlement configuration separate from authorization.

### IS-D14

**Original open question/decision:** Which hosted Supabase organizations/projects, URLs, Vercel projects and provider settings are authorized?

**Approved resolution:** Development remains local-only until explicit hosted Supabase/Vercel/provider identifiers are authorized. Automation must not invent hosted IDs, deploy, mutate hosted databases or change provider settings without separate explicit authorization.
