# Inventory Suit decision register

Status as of `IS-BOOT-001`. Decision IDs are stable and must not be reused. Decisions narrow only the listed acceptance boundary; they do not block unrelated implementation.

# 6. ACCEPTED DECISION REGISTER

Stable decision IDs are preserved.

## `IS-D01` — KEEP

Question:

How are warehouse-scoped capabilities assigned, inherited, revoked, and evaluated alongside tenant-wide capabilities?

Affects:

- `TEN-06`–`TEN-08`;
- warehouse authorization portions of `SAFE-11`.

Blocks:

- final acceptance of `IS-TEN-001`.

Does not block `IS-BOOT-001`.

---

## `IS-D02` — NARROW

Question:

When exact-numeric quantities, conversion results, unit costs, or valuation amounts cross a business-significant storage/input/reporting boundary, what maximum authoritative scales, rounding mode, and rounding boundary apply?

Important:

- exact decimal arithmetic is already mandatory;
- PostgreSQL `numeric` is expected;
- this does NOT block alternate UOMs;
- this does NOT block deterministic conversion factors;
- this does NOT block exact numeric arithmetic;
- this only blocks final deterministic-rounding acceptance where the unresolved policy matters, especially `COST-14`.

Does not block `IS-BOOT-001`.

---

## `IS-D03` — NARROW

Question:

What controlled workflow is allowed for changing base UOM or tracking mode after stock history exists?

Affects:

- `ITEM-16`;
- `UOM-07`;
- applicable tracking-mode transition behavior.

The invariant that history may not be silently reinterpreted is already locked.

---

## `IS-D04` — NARROW

Question:

What are the default operational removal strategy, configuration inheritance, and deterministic tie-break rules?

Already locked supported capabilities include:

- manual;
- FIFO picking;
- FEFO;
- closest/location-priority where repository design permits.

This decision must not redefine accounting valuation.

---

## `IS-D05` — RETIRED

Removed.

Reservation concurrency/locking strategy is implementation design constrained by already-locked atomicity/concurrency invariants.

Do not recycle this ID.

---

## `IS-D06` — RETIRED

Removed.

V1 negative-stock policy is already locked:

- negative available stock blocked by default;
- server-side finalization revalidates;
- serialized/lot-controlled inventory cannot become logically negative through normal commands;
- future exceptions are deferred and require a separate future decision.

Do not recycle this ID.

---

## `IS-D07` — NARROW

Question:

If sequential human-readable document references are used, what are their scope, assignment time, format, gap, and reuse rules?

Already locked:

- stable immutable internal IDs;
- human-readable references;
- no ambiguous number reuse.

---

## `IS-D08` — NARROW

Question:

What exact tenant activation, migration, fencing, reconciliation, and rollback protocol switches Shop from standalone stock authority to Inventory authority?

Does not block core integration architecture.

Primarily affects future Shop activation/cutover.

---

## `IS-D09` — NARROW

Question:

Under what conditions may opening inventory be introduced after ordinary stock activity has begun, and what approval/correction treatment applies?

Affects:

- `OPEN-07` only.

---

## `IS-D10` — NARROW

Question:

What controlled migration is allowed when changing valuation method after stock history exists?

Affects:

- `COST-11` only.

V1 valuation methods themselves are already locked.

---

## `IS-D11` — NARROW

Question:

How will Ledger map and consume Inventory valuation, NRV, write-down, reversal, and reconciliation facts as formal journals?

This is a future Ledger adapter/mapping decision.

It does not block Inventory-side valuation or NRV facts.

---

## `IS-D12` — KEEP

Question:

What final reviewed Arabic Inventory glossary/copy refinements are approved beyond the supplied baseline terminology?

The supplied terminology is the baseline.

Does not block `IS-BOOT-001`.

---

## `IS-D13` — KEEP / DEFERRED

Question:

What plans, prices, quotas, and commercial entitlements apply?

No values are locked.

Does not block core V1 implementation.

---

## `IS-D14` — KEEP / DEFERRED

Question:

Which hosted Supabase organizations/projects, URLs, Vercel projects, and provider settings are authorized?

No hosted IDs may be invented.

Does not block local `IS-BOOT-001`.

---
