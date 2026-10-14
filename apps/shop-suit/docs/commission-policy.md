# SS-BARBER-COMP-001 — Shop Suit commission policy v1

Commission is optional. Both the shop and each employee must explicitly opt in;
missing configuration, employee attribution or an applicable rate yields zero and
never prevents ordinary checkout. There is no historical backfill.

Rates apply to services or products. An enabled employee's category override wins
over the shop category default. An omitted override inherits; an explicit zero
rate earns zero. Percentage rates use decimal precision, with the existing Shop
two-decimal money rounding. Fixed rates are amounts per eligible unit, in the sale
currency. A policy currency must match the sale currency; otherwise no commission
is recorded. Policy versions and changes are append-only, with actor, time and reason.
Only an active owner or system manager with `team.manage` can configure or export.

The percentage basis is the finalized net line amount after line and allocated
order discounts, before tax. Tips, fees and material-cost deductions are excluded.
This is Shop Suit policy, not a claim about another provider's default behavior.
The present sale contract has line discounts only, no tax/order discount/tip/fee
fields. Its `invoice_items.total_amount` is therefore the finalized net basis.
Future tax/order-discount work must preserve this boundary rather than including
tax in that field or subtracting an order discount twice.

Employee attribution is optional and explicit on a draft line. A service requires
an appointment for that same service, employee, shop, location and sale; one
appointment represents one unit and may not commission multiple lines. Payment
does not complete an appointment. The existing `in_service -> completed`
transition is fulfillment evidence. Unscheduled services have no fulfillment
evidence and cannot be attributed for commission; this implementation does not invent completion.
Product issuance is the existing atomic sale/stock-delivery finalization event.

At issuance, snapshot employee identity, membership, appointment, rate/type,
currency, policy version, quantity and finalized net amount. Subsequent employee,
catalog, policy or price edits cannot reprice that snapshot. Full payment AND
fulfillment are required for earning. Partial payment shows the full potential
commission as an estimate, not an earned or pro-rata paid commission.

Earnings and corrections are immutable events. Duplicate notifications are safe;
invoice row locks serialize earning and return reconciliation. Financial refunds
reverse the cumulative proportion of the original commission corresponding to
the cumulative refunded payable amount. The private future item-return hook takes
a cumulative quantity or net financial amount, never an incremental percentage.
It computes the cumulative rounded reversal against the original snapshot and
appends only the difference. A full return absorbs rounding and reverses exactly
the original commission. When the same return is represented in both money and
quantity, use the larger cumulative fraction, avoiding double reversal.
For example, an original 0.05 commission over three units reverses 0.02, then
0.01, then 0.02 for cumulative returns of one, two and three units.

Existing payment refund/reversal commands and stock behavior are unchanged. Their
immutable payment adjustments notify commission reconciliation only. The private
hook does not create partial returns, payments, inventory movements or payroll.
Already earned commission never re-earns after refunds or later repayment.
An export acknowledgment records evidence, not a payment execution; corrections
after paid/exported acknowledgment are reported separately and never automatically
clawed back. A manager can record append-only signed corrections with a reason.

## Evidence versus chosen policy

- [Fresha setup](https://www.fresha.com/help-center/knowledge-base/team/98-set-up-commissions-for-team-members)
  supports percentage/fixed values, service/product categories and employee rules.
- [Fresha academy](https://www.fresha.com/help-center/academy/pay-your-team/track-team-commissions/lessons/100274)
  describes fully paid sales for commission recognition.
- [Phorest](https://support.phorest.com/hc/en-us/articles/360017764179-How-do-I-set-up-staff-commission)
  describes calculating commission before tax.

Off-by-default opt-in, discount basis, explicit fulfillment, precedence, immutable
snapshots, per-unit fixed rates, cumulative reversal rounding and absence of
automatic clawback are the accepted Shop Suit policies, not additional provider
evidence. No payroll payout or external payment integration is introduced.

## Manager workflow and contracts

Open **Team → Commissions**, opt in the shop and each employee, set service/product
defaults and optional employee overrides, and enter a reason before saving.
Use `/commissions?sale=<draft UUID>` to attribute eligible draft lines. Service
appointments must already be linked through the existing appointment workflow.
Fast-pay paths without attribution continue normally and earn no commission.
History uses server pages of 100 snapshots, or one sale's lines.

Public authenticated RPCs: `save_commission_policy`, `commission_history`,
`assign_sale_commission`, `commission_assignment_context`, and
`record_commission_adjustment`. The last command accepts `correction` (signed
amount) or `exported` (zero, evidence only), with a request UUID and reason.
The private `shop_private.adjust_commission_return` hook is deliberately revoked
from browser and service roles; future authorized atomic return commands call it
internally with cumulative net money/quantity. There is no generic exposed return
or payout endpoint.

Migration `20261014181109_optional_staff_commissions.sql` adds four RLS-enabled
tables (`commission_policy_versions`, `commission_line_assignments`,
`commission_snapshots`, `commission_events`), five RPCs, protected helpers, and
four notification/capture triggers on existing lifecycle tables. It modifies no
existing financial rows, catalog rates, applied migrations or stock routines.
Rollback is forward-only: opt out to stop future snapshots; retain all history.
Apply only through the normal repository/GitHub staging integration.
