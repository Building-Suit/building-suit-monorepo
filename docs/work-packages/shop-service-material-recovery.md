# SS-SERV-002 recovery

Status: implementation in progress; draft checkpoint is not merge-ready.

Workspace: saved cloud `/workspace/service-material-recovery`; branch `codex/shop-suit/service-material-recovery`.
Verified staging: `4c1ac6cc9652e3fedfc3e9a7368962baeb7c7290`.
Committed parent: tax recovery PR #314, `76e490bb5caae39984b3f27dac3b482e37069af2`.
No published materials PR existed at initial live preflight. The old inaccessible uncommitted workspace and migration are not recovered or modified.

## Required policy

Ordinary service needs no recipe. Payment does not establish performance. Scheduled and walk-in service lines share explicit, authorized, cumulative quantity fulfillment bounded by sold quantity. Appointment completion must use the same ledger and stock operation; no synthetic walk-in appointments. Completion can precede payment when the sale lifecycle permits.

Manager changes append immutable recipe versions with effective times. Completion captures recipe/material/unit/quantity and FIFO allocations. Stock uses existing decimal precision and compatible dimensions; mass/volume conversion is forbidden without an explicit supported contract. Stock writes are atomic, tenant/location authorized, concurrency-safe and strictly nonnegative. Recipe history and completion history are append-only with no historical backfill.

Performed-service refunds never automatically restore consumed material; restoration requires a separate audited correction. Offline reconciliation must use supported durable requests and expose conflicts. Commission remains optional/off by default; immutable after-discount/pre-tax basis belongs to the tax owner. Earnings require payment and explicit fulfillment. Cancellation excludes new earnings and reverses existing earnings. Published commission migration `20261014181109` is immutable; integration requires a new migration.

## Evidence and product choices

[SalonBridge service recipes](https://help.mysalonbridge.com/en/articles/2742817-what-is-a-service-recipe) and [Zenoti inventory](https://www.zenoti.com/salon-management-software/inventory-management) are external product context. The explicit completion boundary, quantity limits, authorization, immutable snapshots, no automatic refund restock and conflict policy above are Building Suit requirements, not claims about those vendors.

## Acceptance pending

No-recipe fulfillment; 30 mL FIFO from 20 + 25 leaves 15; 29.999 rejects 30 atomically; concurrent 2 × 30 against 40 permits one; replay and payload conflicts; recipe changes preserve snapshots; unpaid completion consumes without commission earnings; refund preserves consumption; exact walk-in/multi-unit fulfillment and commission; appointment duplicate protection; location/tenant/RLS denials.

Initial verification: Node preflight passed with no errors. Root pnpm entry initially failed because installed pnpm 11.25.0 differs from required 10.33.0. No hosted database writes, production promotion, credential changes or workspace cleanup authorized/performed.

Implementation checkpoint: unified completion migration, optional immutable recipes/units, FIFO consumption, appointment integration, walk-in/multi-unit commissions using the tax owner's pre-tax snapshot, supported offline replay/reconciliation, shared UI and Shop adapters.

Local verification: Shop typecheck and changed-file lint pass; strict UI boundaries and atomic route registry pass; materials SQL suite and two-session stock race pass in disposable PostgreSQL 17 with explicit provider stubs. Actual Supabase image extraction exceeded disk capacity; no existing data/images were deleted. Real Supabase workflow added. Fresh replay identified a syntax defect in tax parent b0081657 (its subsequent d4768af1 checkpoint fixes it); parent update will be incorporated before final validation.
