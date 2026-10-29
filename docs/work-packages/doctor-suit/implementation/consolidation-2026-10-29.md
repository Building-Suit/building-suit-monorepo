# Doctor staging consolidation — 2026-10-29

The owner paused new Suit features and requested consolidation of existing PRs. PR401 is the existing Doctor staging root; Shop integrates first, then Doctor must reconcile the resulting staging and pass exact-candidate required checks. No main promotion, deployment, hosted mutation, approval review or domain authorization is implied.

## Published history

PR401 was updated from `ba9b7e051746a50bd2bdfd3c0ad5463e063584e3` to `aeedf7dbe8e0abf8283ad35273fa7d648c83d83b` using history-preserving merges. All 49 original published Doctor heads in [the pinned inventory](consolidation-2026-10-29-inventory.json) and staging `2efbed85c5893dfcd4d7a40eaa27a22e9690b00d` are ancestors. The sole conflict, release inventory, retains all 65 Doctor-side entries and both staging-only Shop entries exactly. Preflight had no errors, both explicit staging/head and default release validation passed, and PR401 chain validation passed.

Expanded DOS-M7-004 evidence at unpublished `6174e0dbd31a1299e63e2a8a52f86a3d6b8061d6` is preserved separately and excluded. The candidate contains only PR505's published early scope at `8bef8ebd24cb07da3ba4ef09e1ff6c5ad6cafd21`. Clinical, legal, privacy, hosting, provider, commercial and release approvals remain missing where recorded; this consolidation does not change them.

## Doctor lint integration repair

The parent Doctor lint command reproduced 12 errors: nine nested mobile Nuxt route/layout single-word component names and three unused fixture bindings. The repair explicitly names those nine components using `defineOptions`, retains the same route paths/templates, removes two unused trailing callback arguments, and projects the fixture authority without retaining timezone. No lint rule, test assertion, runtime guard or timeout is disabled or weakened.

Checks on this repair over `aeedf7d...`: owning Doctor lint passes, separate mobile lint passes, mobile typecheck passes, 38 focused M4-006/M4-008 units pass, and `pnpm check` passes (141 complete route templates, zero debt, 80 historical migrations unchanged). Dependencies were installed frozen with Node26.8.1/pnpm10.33.0; documented setup and separate mobile prepare ran. This is static/unit verification, not Android runtime qualification. New required CI is needed on the committed repair candidate.

## Actual combined CI and upstream fixes

- PR401 source `aeedf7dbe8e0abf8283ad35273fa7d648c83d83b`, run40883410893: branch-policy passed; review failed with 2,551 root tests, 2,474 passed, 54 Shop-owned failures and 23 skipped. Full verify consequently skipped. This is a failed candidate, not an accepted baseline.
- Published Shop root PR441 source `001cbd654b157bba8b89f4b9700a7b99c79d4e3a`, run40883130006: review job123479662554 passed with 2,079 tests, 2,056 passed, zero failures and 23 skipped. This is Shop's source, not the combined Doctor candidate. Commit `5aa8b3376f6e5bba68e29696bdbb04704b75f7f2` repairs scoped state and stale test harnesses; it must be retained when staging is reconciled. The old 54 failures are not immutable inherited debt.
- Shop commit `a41a2b7c4f5666df365872ef305a06c9961a5143` already repairs shared cycle-control focus and tests the actual Docs/Inventory/Automation settings controls. It retains hydration, keyboard, EN/AR and external-network restrictions. Do not duplicate or discard this published repair when integrating Shop staging.
- Prior Doctor PR501 source `c76560503713ee27f6a7b82359abda97afdce954`, run40877913152: Doctor browser and SQL jobs passed. Browser: 60 public, 87 protocol, 4 stress, all ten M3 tasks, all 12 actual financial EN/AR cases. SQL: 68 suites / 2,221 assertions, including 44 M6-010 cases, encrypted restoration and pinned Meta generated-schema acquisition.
- That PR501 source's shared job123461430656 failed earlier than the settings suite: auth parity had 47 passed / 1 failed, with screenshot capture waiting for fonts at `atomic-signup-parity.spec.ts:65`. This is distinct from older six settings-selector failures. No root cause is claimed, no screenshot check or timeout was bypassed, and no unrelated speculative UI repair was made.

Combined Doctor run40883411107 and Android run40883411016 began on `aeedf7d...`; their ongoing results are not substituted for the next candidate's checks. Preserve all failed/superseded source receipts. After Shop staging integration, reconcile history, rerun release/preflight/PR checks and required combined CI. Only the coordinated exact-head merge is in scope; staging/main state and descendant PR state have not been changed by this publication.

Release validation initially rejected the fragment because the literal catch-all route filename contains `..`, which the path contract forbids. The fragment now uses the owning mobile pages directory prefix; the checker and accepted ancestor fragments are unchanged. The failed check is retained as a corrected publication prerequisite.

## Terminal combined CI at a814201e

Run40884543989 review failed with the inherited Shop fixtures before the already-published Shop repairs are reconciled; verify skipped. Doctor run40884543987: SQL job123484886876 passed, shared job123484886459 passed48 auth parity cases then failed6/12 settings cases on obsolete combined-menu selectors, and browser job123484886878 failed. Android run40884544062 completed successfully, including owned emulator jobs. Shop website qualification stopped at the two existing Shop lint errors; marketing privacy passed6/9 with its three old-source browser failures. No combined green claim is made.

The Doctor browser failure is independently actionable:60 public cases passed; protocol86/87 passed, with AR mobile DOS-M1-020 stopping at onboarding with no draft/completion requests and one invalid native control; all ten actual M3 cases passed. Actual Auth established initial synthetic confirmed sessions/practices but the subsequent browser signup never reached verification. Later financial/browser acceptance did not execute on this source. Prior passing receipts are retained at their original candidates.

A bounded diagnostic captures only fixed field categories, boolean native-validity flags, bounded event/control counts and transition presence after a failure. It never copies values, labels, IDs, native validation messages, credentials, URLs or clinical/application data. Two actual-helper isolation tests verify redaction and bounds; scoped lint passes. Existing cases, assertions, retries and timeouts remain unchanged. This is diagnostic preparation, not a demonstrated UI repair or passing browser acceptance. The next owned CI execution must identify the failing field/transition before behavior changes are justified.
