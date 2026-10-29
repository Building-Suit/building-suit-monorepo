# Verification matrix

Results are recorded in VERIFICATION.md. A planned test is not a pass.

| Gate | Required behavior | Scope |
|---|---|---|
| Registry/conversion | 100cm=1m; 1000mm=1m; 1000g=1kg; 250g=.25kg; 1000ml=1L; exact foot; dimensions; package rejection; bounds; increment | JS unit + real PostgreSQL |
| Product compatibility | legacy data unchanged; service declarations consistent; new configured ea integral; used product immutable; atomic failed configuration | Full migrated DB |
| Security | anon denied RPCs; authenticated registry read only; no private helper execution; tenant/role/subscription; grants/RLS | Full migrated DB |
| Purchase | 2×100m reels→200m, 5000 total and 25/m FIFO; replay identity | M2 DB + browser |
| Sales | 100−12.5=87.5m; 250cm=2.5m; 5kg−250g=4.75kg; 10−2=8 pieces | M2 DB + E2E |
| Packaging/bundles | box12 pieces shares stock; fixed reel price; bundle precedence; no duplicate movement | M2 DB + E2E |
| Counts/returns | increment validation; audit reason; original snapshot/cost; no over-return or duplicate refund | M2 DB |
| Concurrency | last-stock cashiers; reel allocation; duplicate receive/issue; interruption rollback | Separate real DB sessions |
| Offline/tax | original conversion/package retained; stale config conflicts; commit/retry recovery; frozen ETA mapping | M2 DB + replay tests |
| UI | EN/AR, LTR/RTL, themes, mobile/desktop, keyboard, accessible labels, loading/empty/error/retry/denied/dirty | Rendered + browser |
| Reels | 50+50 cannot fulfill continuous80; requested12.5 + loss.02 consumes12.52; atomic FIFO reconciliation | M3 DB + E2E |
| Wholesale | quote revision/expiry, deterministic prices, reservation contention, deposits/partial fulfillment | M4 DB + E2E |
| Qualification | full existing regression, 10000 SKU pagination/load, multi-location, plan review, merchant pilot | M6 + external |

Representative merchant: breaker20A/ea, cable2.5blue/m, copper/kg, socket/ea, conduit/m. Receive two reels and 5kg; sell 12.5m,250g,2 breakers; receipt, stock/FIFO, count, eligible return, customer/supplier balances, reporting and bilingual verification. This journey remains pending until operational integration exists.

## Current electrical browser qualification — October29

All48 published measured-retail browser cases pass against the current integrated runtime (see NATIVE-BROWSER-READINESS-2026-10-29.md). Their transport is synthetic. Existing real-Auth barber pilot and signup/backend suites are separate; their discovery/source is not a fresh passing execution. Electrical Auth-to-financial-RPC, original unpublished checkout recovery, merchant/device/native-Arabic and release gates remain open.

## Electrical native measured/FIFO coverage follow-up

Two EN/AR actual-Auth/financial-RPC browser cases are now implemented and discovered, with a matching120-migration SQL companion PASS and27 relevant units PASS. Owned native execution is still pending. See NATIVE-ELECTRICAL-JOURNEY-2026-10-29.md for exact scope, assertions, runner wiring and distinct original-recovery/external gates. Prior observations remain historical; synthetic and schema results are not native acceptance.
