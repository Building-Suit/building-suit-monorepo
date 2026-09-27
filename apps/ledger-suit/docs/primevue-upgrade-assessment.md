# LS-UX-004 — optional PrimeVue upgrade assessment

Status: **RESEARCH_COMPLETE / NO_UPGRADE_RECOMMENDED**, assessed 2026-09-27.

## Recommendation

Keep PrimeVue and `@primevue/nuxt-module` pinned to 4.5.5. Do not migrate Building Suit to PrimeVue 5 merely because it is newer.

PrimeVue 5.0.1 has possible benefits: continued feature development, newer accessibility and defect fixes, new core components, optional PRO components, and commercial premium support. None closes a measured Ledger requirement in the current queue. Ledger already uses the shared unstyled components, `BsDataTable`, `BsDialog`, Building Suit tokens, and product-owned exact-money rendering needed by CORE-07 and this task. The proposed PRO DataGrid and Sheet are still roadmap items, and adopting either would conflict with the existing `BsDataTable` policy unless separately approved.

This is an assessment, not an upgrade approval. A v5 migration would be a separately approved `shared`-stack change because the shared Nuxt layer and UI wrappers affect every Suit.

## Installed version and support

Repository evidence:

- The root, Ledger, Shop, Inventory, Building Suit Docs, Automation Suit, `@building-suit/ui`, and `@building-suit/nuxt-layer` manifests pin both applicable packages exactly to 4.5.5; the lockfile resolves the same version.
- Every app extends `@building-suit/nuxt-layer`. That layer enables PrimeVue unstyled mode and owns the auto-import allow-list, preserving Building Suit tokens rather than a vendor theme.
- Production code imports PrimeVue directly only in `BsDataTable.vue` and `BsDialog.vue`; product pages consume the shared layer/wrappers. The Ledger review fixture has one test-only `usePrimeVue` import for locale configuration.
- At this assessment, Ledger has 26 Vue consumers of `BsDataTable` and 23 of `BsDialog`; Shop has 6 and 5; the component catalogue has one of each. Inventory and Automation currently have no wrapper call sites but inherit the same layer and exact dependency pins.

Upstream evidence as of 2026-09-27:

- [PrimeVue 4.5.5](https://github.com/primefaces/primevue/releases/tag/4.5.5) is the latest 4.x release. Its package metadata is MIT, so the installed version has no PrimeUI license-key or per-developer fee.
- The [PrimeVue 4 security policy](https://github.com/primefaces/primevue/security) says 4.x receives security fixes only, older versions are end-of-life, and no security advisories are currently published. This supports staying on 4.5.5 now, but it is maintenance rather than active feature development.
- The [PrimeVue 5 changelog](https://primevue.dev/changelog/) lists 5.0.1 as the latest release. Version 5 adds components and accessibility work, changes base sizing to a 16px root with a compatibility preset, deprecates legacy components, and makes InputMask a directive. Version 5.0.1 also fixed Nuxt license propagation and a BigInt-to-number error in the CDN build. These are migration/test signals, not evidence that Ledger needs v5.

## License and cost assessment

PrimeVue 4 and earlier remain MIT-licensed. PrimeVue 5 uses the PrimeUI license and requires a license key; the [PrimeUI transition announcement](https://primeui.dev/nextchapter) states the change is not retroactive.

The current [PrimeUI pricing](https://primeui.dev/pricing) is:

- Community: free, annual, and available only while all eligibility conditions are met (under USD 1M annual revenue/budget, fewer than 5 developers, fewer than 10 employees, and under USD 3M venture funding).
- Commercial per developer: USD 599 perpetual with one year of updates through 2026-12-31; the stated standard price from 2027 is USD 799. One additional year of updates is currently USD 399 per developer.
- Commercial site license: quoted by PrimeTek.
- OEM: separate annual terms only if PrimeUI is exposed for third parties to develop with; shipping finished Building Suit applications is covered by the normal commercial license according to the [commercial terms summary](https://primeui.dev/licenses/commercial).

Building Suit's organization size, revenue, funding, developer-seat count, and accepted legal terms are not evidenced in this repository. Community eligibility must not be assumed. Prices and terms must be rechecked with procurement/legal at an approved migration date.

## Measured upgrade gate

Reassess a major upgrade only when at least one trigger is documented:

1. a reachable security issue affects 4.5.5 and no supported 4.x fix is available;
2. a supported Nuxt/Vue/browser release is incompatible with 4.5.5;
3. an accepted product requirement identifies a missing capability, measures its user/operational value, and shows the current wrapper cannot supply it safely; or
4. paid vendor support is an approved operational requirement.

Before approval, record the affected users and flow, current baseline, expected improvement, v5 proof of concept, full license classification and seat cost, migration effort, rollback plan, and named owner. A release number alone is not a trigger.

## Required migration contract if separately approved

The shared-stack migration must preserve or deliberately version:

- `BsDataTable` props, native attribute/model/event forwarding, named slots, lazy paging, filters, retry/loading/empty states, CSV behavior, table pass-through sections, and exported `exportCSV` method;
- `BsDialog` visible model, dirty-state confirmation, pending close protection, focus restore, escape behavior, footer slot, and pass-through styling;
- exact monetary strings/`bigint` through table slots and exports without `Number` coercion;
- EN/AR copy, LTR/RTL logical layout, light/dark themes, Building Suit tokens/fonts/icons, keyboard/focus behavior, and responsive layouts;
- all existing Ledger and Shop consumers plus the docs catalogue, and layer/build smoke tests for Inventory and Automation;
- the existing `BsDataTable` policy—no second grid library and no direct product-level PrimeVue forks.

Minimum independent verification is lint, typecheck, builds for every app, shared boundary/token checks, wrapper/component tests, Ledger and Shop focused browser flows in EN/AR and light/dark, exact-money fixtures above `Number.MAX_SAFE_INTEGER`, and comparison of lazy table/filter/export/dialog behavior. No financial SQL, hosted database write, or accountant approval is implied by a UI-library migration.

## Requirement traceability

| Requirement | Evidence and result |
|---|---|
| CORE-07 | No dependency, wrapper, product source, database, import/export, report, recurring, attachment, audit, or currency behavior changed. The existing exact-money and shared-wrapper contracts are preserved. |
| VAL-06 | `primevue-upgrade-assessment.test.mjs` verifies exact pins, shared-layer inheritance, unstyled configuration, wrapper import/forwarding boundaries, no wrapper money coercion, and the absence of production app-level direct PrimeVue imports. This task does not claim to rerun or complete the broader financial concurrency/isolation/history matrix. |

## Verification record

- PASS — `node --test apps/ledger-suit/tests/unit/primevue-upgrade-assessment.test.mjs`.
- PASS — `pnpm --filter @building-suit/ledger-suit test:unit`.
- PASS — `pnpm check`: canonical token outputs, workspace boundaries, and 80 historical migrations unchanged.
- PASS — `node --check apps/ledger-suit/tests/unit/primevue-upgrade-assessment.test.mjs`.
- PASS — `git diff --check`.
- NOT RUN — Nuxt lint, typecheck, build, and browser suites: no runtime dependency changed, and this prepared worktree has no `node_modules`.
- UNVERIFIED — live fetch/GitHub state: `pnpm agent:preflight` exited 1 because fetch/GitHub returned 255.

No package, lockfile, wrapper, product application, database, hosted provider, deployment, push, merge, or commit was changed by this task.
