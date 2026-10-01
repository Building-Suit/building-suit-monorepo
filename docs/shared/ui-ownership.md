# Shared UI ownership

`packages/ui` is the sole source of reusable presentation for every Suit. Create or extend an atom, molecule, organism, or template there before adding presentation to an application. `packages/ux` owns reusable interaction state and policy. Applications own pages, product copy, validation, permissions, queries, commands, and domain orchestration.

An app-local component is valid only when its API and implementation are tied to product/domain orchestration and it composes shared UI. A component that could stand alone in another Suit by changing labels or data is shared presentation and belongs in `packages/ui`. Product wrappers must not reproduce the markup, styling, focus behavior, pending state, confirmation flow, or other interaction policy of a shared component.

## Mechanical contract

`pnpm check` discovers every directory matching `apps/*-suit`; the list is not maintained by hand. It checks all discovered Suit application sources and package manifests, including Automation Suit and any future Suit, for:

- unclassified files under `app/components`;
- raw or directly imported PrimeVue data tables and dialogs instead of `BsDataTable` and `BsDialog`;
- native confirmation dialogs instead of the shared confirmation controller and host;
- direct composite controls or dependencies from competing UI foundations;
- imports between applications or from shared packages into applications;
- upward Atomic Design dependencies in `packages/ui`;
- wildcard, missing, or ungoverned `packages/ui` exports; and
- a dependency from `packages/ux` back to `packages/ui`.

The canonical inventory is [`ui-ownership-manifest.json`](ui-ownership-manifest.json). It has three classifications:

- `product-orchestration`: valid app ownership; the rationale must identify the domain responsibility.
- `shared-presentation-debt`: reusable presentation that must move to its recorded `packages/ui` target.
- `obsolete-duplicate`: a local wrapper or duplicate already superseded by the recorded shared target.

The manifest is an approval boundary, not a way to waive ownership. A new app-local component must be reviewed and recorded with explicit approval evidence and a useful rationale. Reusable presentation must be added to `packages/ui` instead. Removing or migrating a component updates the inventory in the same change so the file set and manifest remain exact.

The manifest also records the exact pre-enforcement files that still bypass a required shared primitive. These are migration debt, not precedent: the check rejects any new bypass and rejects stale debt entries after migration.

## Atomic direction and exports

Shared component composition follows `atoms → molecules → organisms → templates`: a layer may use its own layer or a lower layer, but never a higher layer. Product contracts never move into an atomic layer merely to satisfy this structure. Shared interaction controllers remain independent in `packages/ux`; `packages/ui` may consume them, while `packages/ux` must not depend on `packages/ui`.

Every public UI source has an explicit package export. Adding, moving, or removing a shared component requires updating `packages/ui/package.json`, the `/components` catalogue when its capability changes, affected consumers, and the canonical manifest when local migration debt changes.

Thin product adapters may remain when they add domain context before composing the shared owner. Current examples map Automation execution states to `StatusBadge`, Ledger tenant/reporting context to `BsPageHeader`, and product legal metadata/content to `BsPublicLegalPage`; the adapters contain no duplicate standalone presentation.

## Design-system lock and verification

The token source and brand values remain owner-controlled. Ownership enforcement and debt migration may consume canonical semantic tokens or remove duplicate local styling, but they do not authorize token-value changes or a visual redesign.

Shared changes are verified through `pnpm check`, shared UI/UX tests, root typecheck, affected Suit builds, and the documentation catalogue build. Behavioural changes also require representative English/Arabic, LTR/RTL, light/dark, responsive, keyboard/focus, and state coverage appropriate to the component.
