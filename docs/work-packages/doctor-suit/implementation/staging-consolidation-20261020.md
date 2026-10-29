# Doctor staging consolidation — 2026-10-20

The owner requested all open Doctor PRs be consolidated into one PR and merged into stg. PR401 / codex/doctor-suit/auth-wizard remains the single Doctor staging root. No main change, hosted database operation, provider activation or clinical/legal approval is authorized by this consolidation.

Initial live preflight observed stg12407f55cc1f09076723dfeb9948987bd49ebcae and20 open Doctor PRs. Their exact source heads below are all ancestors of the published M3-002 tip16cabb45f9277a4cd5b19434cd6ff48a51060813. The root now incorporates that tip with a merge commit, then merges current stg. The primary checkout is clean but four commits behind stg; it was preserved, and integration uses a separate worktree on the existing root branch. Existing Doctor worktrees were clean and published; no uncommitted files were copied.

Four additive JSON conflicts retained Doctor and current Shop route registrations, shared exports/ownership and release inventory. Every inventory item from both parents is preserved byte-for-byte at the JSON value level. Existing fragments remain unchanged. Source PRs may close as superseded only after root publication and verification of all pinned ancestors; source branches/worktrees are preserved.

## Pinned source PRs

| PR | Head | Commit |
|---|---|---|
| [366](https://github.com/Building-Suit/building-suit-monorepo/pull/366) | codex/doctor-suit/m2-clinical-review | e474934c4c1e0529a7d9c6aad2e3e30cec9e7098 |
| [401](https://github.com/Building-Suit/building-suit-monorepo/pull/401) | codex/doctor-suit/auth-wizard | 556d00b257363bcd59a148ece16cd5bd82e60301 |
| [403](https://github.com/Building-Suit/building-suit-monorepo/pull/403) | codex/doctor-suit/brand-slots | 46ac229c3b88146c7b14edc17e7306d015812c0b |
| [404](https://github.com/Building-Suit/building-suit-monorepo/pull/404) | codex/doctor-suit/annual-pricing | 57765b8b85d68233b23cb90318df59080a223b83 |
| [405](https://github.com/Building-Suit/building-suit-monorepo/pull/405) | codex/doctor-suit/policy-drafts | 2dfb90581a16c14e16aca673218ff260d8848489 |
| [410](https://github.com/Building-Suit/building-suit-monorepo/pull/410) | codex/doctor-suit/m2-002-encounters | ce4e0f1aee38132baca82cade2aac33780ea8c3c |
| [411](https://github.com/Building-Suit/building-suit-monorepo/pull/411) | codex/doctor-suit/m2-003-intake | 6eba6c51e0dd4fb57e2a373459e26b60fe790caa |
| [412](https://github.com/Building-Suit/building-suit-monorepo/pull/412) | codex/doctor-suit/m2-004-notes | 8fa80befa813c2d49bffa478fd711c1d36680455 |
| [413](https://github.com/Building-Suit/building-suit-monorepo/pull/413) | codex/doctor-suit/m2-005-medicine-provenance | 80116acc7946e768f4721c231c5997e30020bff6 |
| [414](https://github.com/Building-Suit/building-suit-monorepo/pull/414) | codex/doctor-suit/m2-006-prescription-drafts | 37f5434164af4366e99a2343dc82cedb9f846f51 |
| [415](https://github.com/Building-Suit/building-suit-monorepo/pull/415) | codex/doctor-suit/m2-007-regimens | 220a76829afda00370d6be790efed4ab25d12e06 |
| [416](https://github.com/Building-Suit/building-suit-monorepo/pull/416) | codex/doctor-suit/m2-008-finalization | c25685c87707e62d359998824bfd23c5bc72ca58 |
| [417](https://github.com/Building-Suit/building-suit-monorepo/pull/417) | codex/doctor-suit/m2-009-releases | f362b49891ea4d38cd611ed383d34e434d818e69 |
| [418](https://github.com/Building-Suit/building-suit-monorepo/pull/418) | codex/doctor-suit/m2-010-orders | 7965365463ed471853073f4a67234dc35ce5d5d6 |
| [419](https://github.com/Building-Suit/building-suit-monorepo/pull/419) | codex/doctor-suit/m2-011-results | 48159421262e2486780feeecc02ff0f39188b813 |
| [420](https://github.com/Building-Suit/building-suit-monorepo/pull/420) | codex/doctor-suit/m2-012-recipient-access | 6d9549f6b897e5a2b8fc50e34528b0db7a760e17 |
| [421](https://github.com/Building-Suit/building-suit-monorepo/pull/421) | codex/doctor-suit/m2-013-exports | 1b70b57c992bed40e2f6ba894efd06fb8d582ab8 |
| [422](https://github.com/Building-Suit/building-suit-monorepo/pull/422) | codex/doctor-suit/m2-014-workflow-acceptance | f0f0ee0107ed6f85276c0ecbc735251429399e4d |
| [425](https://github.com/Building-Suit/building-suit-monorepo/pull/425) | codex/doctor-suit/m3-001-capacity | f89f04a3ece57f902b35fc69c8cbb53987818d15 |
| [426](https://github.com/Building-Suit/building-suit-monorepo/pull/426) | codex/doctor-suit/m3-002-waitlist | 16cabb45f9277a4cd5b19434cd6ff48a51060813 |

## Validation and outstanding gates

Local combined workspace boundary and token checks pass:124 routes, zero Suit-local components/debt,80 historical migrations unchanged. Release provenance and current main-to-stg inventory checks pass. Full repository baseline:2,114 tests,2,037 passed,54 failed,23 skipped. The54 failing labels match the inherited Shop failures recorded on the Doctor source candidate. Many reference removed route files or stale Nuxt/Pinia test adapters; the current staging CI is also failed. These failures are not a green integration result. Combined exact-head CI is required before merge; old root/child successes are insufficient.

M2 synthetic engineering evidence and M3-001/002 results remain in their task records; M3-003–010 are not implemented by consolidation. Professional clinical, medication-catalogue, legal and communications-provider decisions remain open. Doctor hosted refs are blank/user-managed. No new real-data or live-care capability is asserted.

Prior stg Vercel status contexts were successful; this does not establish dashboard configuration or replace combined GitHub CI/security checks. Use one history-preserving stg merge only after the final exact-head/base checks pass. Five-minute staging spacing and provider-state rules continue to apply. Merge/published/deployed are distinct states; production is excluded.
