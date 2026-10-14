# Shop single-period purchase admission and review context

This is new billing-policy work, separate from activation #303 at staging
`2434e6f0c456205580ef210a3ab97f484a66e1ec`. Activation migration
`20261014063640` is applied, staging proration is ON, Shop/Ledger deployments
are READY and pre/postmerge aggregate checks passed. The separate SAS Vercel
cached-output failure has a prepared artifact-cache repair; it does not undo
Shop activation. No production or home-network operation is authorized.

## This bounded change

The owner-authorized order constructor rejects every **new** legacy full-term
purchase during active access, including forged subscribe/renew/change intents.
It uses the existing subscription/resource locks; initial trial activation and
renewal after expiry remain one canonical billing term. Completed request replays
return their original order before admission checks. The existing verified-payment
source-snapshot hold and webhook replay logic are retained unchanged.

Migration `20261014072920_single_period_purchase_guard` only replaces that
function. It does not update/delete/refund any payment, receipt, commercial period,
subscription or credit. Proration RPCs retain their existing arithmetic and guards.
The two legitimate historical annual orders and their October 2028 access remain.
Historical same-interval composite pricing remains fail-closed in this PR; the
approved upgrade/scheduling implementation belongs in the next bounded child.

The billing dialog no longer treats existing paid access as confirmation of a
newly selected plan. Unsupported review hides the repeated submit, offers the
shared support link and labels the provisional amount as the price per billing
term, not an accepted amount due. Focus/online recovery must not change that into
success. Active prepaid renewal is absent in the UI, including gate-off mode.
All rendering remains in the shared UI; product state/copy remains in Shop.

## Verification

90 focused protocol/state/shared foundation cases pass. Ten proration browser
cases pass, including the exact old two-term rejection in EN/light desktop and
AR/dark mobile; four recovery cases pass. Shop build and lint pass (two preexisting
owner-invitation attribute-order warnings). Workspace/token boundaries and
whitespace pass. Five app typechecks passed; Docs passed after generating its
ordinary document index with `pnpm run setup`.

Registered native fixtures reject all three intents, preserve completed replay
and paid access, and keep the historical paid-hold test. A pg_temp-only copy of
the former constructor builds synthetic pre-policy historical receipts; it never
replaces the deployed public constructor. Historical multi-term assertions now
also reject a third period. New parallel active-request checks plus eight
independent barrier-controlled workers cover admission and paid/credit replay.
Native CI must pass before claiming these database results. No hosted provider
payment, owner impersonation or manual hosted mutation is performed.

## Approved next policy package

The user approved on 2026-10-14: same-interval upgrades charge the actual unused
time/value difference after verified payment and retain expiry; cheaper-plan
downgrades and annual-to-monthly changes take effect at paid-term end after manual
verified payment for one next term. No current downgrade charge, automatic debit,
automatic refund or data deletion. Existing paid periods remain honored. Owners
must be able to resolve excess active members/branches without deleting records.
Bilingual billing, subscription, renewal and refund policies must explain credits,
effective dates and pending changes without waiving legal rights or asserting that
refunds are impossible in every circumstance. This paragraph records authorization
and scope; it does not claim the scheduling feature is implemented in this PR.
