# Proration checkout integration checkpoint

Local branch `codex/shared/shop-proration-checkout`, based on #288 headafb93240155d0ede4143d1e086194b9281bac43c. Gate remains OFF. No hosted changes, merges, home calls or changes to other workers' branches.

## Implemented

Edge checkout routes now review/read/abandon owner-scoped quotes, submit the persisted quote ID for paid checkout, and explicitly confirm zero-credit changes without creating a provider session. Raw client amounts remain rejected. Readiness projects the database gate; scoped exact domain failures provide safe localized guidance. Card checkout is explicitly the supported prorated provider method; asynchronous methods and unavailable card capability fail without a new charge. Legacy flow remains selected while the gate is off.

The Shop adapter parses only supported frozen quote fields, preserves exact unrounded strings, stores only quote IDs under owner/shop keys, and restores saved quote/payment state. The existing shared checkout dialog displays full rate, period cost, unused paid value, existing credit, final due, credit after change, renewal/new-period policy and expiry. Explicit credit confirmation hides provider branding and creates no fake payment/navigation. Shared pinned actions, focus, pending locks and expiry timer are reused. Context changes clear local sensitive state; verified credit settlement refreshes Shop context. Discarding an unstarted quote is an explicit action, while unresolved prepared payments remain protected.

A CLI-created forward migration preserves15minute quote admission and adds a bounded35minute verification window for accepted card orders, matching XPay's documented30minute minimum session lifetime. Source subscription/funding/version, owner, quota, revocation and offer checks remain. Credit-only expiry stays strict; remaining-period expiry cannot discard real paid observations. Private offers must have sufficient time to start the hosted session. Composite/custom same-interval periods now raise a specific unsupported-period error rather than silently pricing an extended access range as one monthly/yearly term; their segmented pricing is not implemented. Currency conversion remains unsupported.

## Actual evidence

44 parser/protocol/handler/client unit cases pass. Four browser projection/provider-response fixtures pass: cash and explicit credit confirmation in EN/light1440 and AR/dark390. Those modal captures were inspected. Shop build/typecheck, changed-source lint, workspace/token/ownership checks and whitespace pass. The exact application migrations applied in the disposable cloud PostgreSQL17.10 instance; quote tests, legacy XPay financial subset and existing settlement regressions pass. Provider/Auth/Storage/Vault/network interfaces in native tests are synthetic; scheduler and real provider transport are not validated by these runs.

## Publication and acceptance gaps

Fresh preflight rejected publication because Shop has competing staging roots #283 and #292. Their rearrangement was denied by approval review and awaits the user's specific permission; this task has not rearranged or bypassed either. Work is preserved locally pending that independent blocker.

#292's payment-intent contract fix is NOT incorporated yet: nested `paymentIntent.id`, opaque `pi_*` IDs and conflicting-alias rejection must come from its owner after safe approved ancestry is available. Realistic nested provider fixtures and the final SQL dispatcher must then be reconciled so the later hotfix migration cannot overwrite proration dispatch. Current presentation tests are not proof of that provider contract.

Remaining: dedicated private-offer/SAS/admin-grant and monthly/yearly/both-interval-switch integration journeys; accepted/expired payment-window boundary tests; saved-quote restart/context/expiry browser coverage; nested provider payload tests after292; all shared consumer/docs checks and final aggregate/native CI. Custom/multi-term periods, currency conversion and asynchronous prorated methods are explicitly unsupported. Do not enable the gate or claim full end-to-end acceptance from this checkpoint.
