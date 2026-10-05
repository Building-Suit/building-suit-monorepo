# Shared workflow presentation families

BS-UI-ZN-PATTERNS-001 implements the remaining reusable presentation owners under BS-UI-R016/R020/R021/R022/R023 and BS-UI-D007/D012/D013/D016/D017/D022. No token values change.

The audit read the complete occurrence inventory and reviewed Ledger/Shop source implementations. The inventory currently contains 8871 violations, including 2322 occurrences in the family sources below. Adding shared owners does not remove those occurrences: product cleanup is a separate task, outside this task's allowed paths. Existing wrappers are no longer needed as the sole visual implementation; their data mapping, commands and authorization still need to move into route/composable adapters. Do not mark any wrapper migrated until its source and exact debt entries change together.

| Family | Shared owners | Product adapter boundary |
|---|---|---|
| money | BsMoneyText | currency, locale and exact minor/major values; tenant currency resolution remains product-owned |
| usage | BsUsageMeter, BsUsageMeterGrid, BsResourceLimits, BsTrialCountdown, BsAccessGate | usage values, limits, translated display values and policy-derived tone/status |
| pricing | BsBillingCycleToggle, BsPlanGrid, BsPlanCard, BsPlanFeatureList, BsMarketingPricing | existing Ledger-derived pricing; product plan catalogue, eligibility and billing commands |
| setup | BsSetupChecklist, BsSetupStep, BsOnboardingPanel | translated steps, completion, route targets and provisioning commands |
| entity | BsEntityPicker, BsSearchField, BsPagination, BsSelect | existing shared lazy search intent; products fetch authorized entities |
| context | BsNotificationMenu, BsContextSwitcher, BsScopeSwitcher, BsUserMenu, BsUserIdentity | existing shared notification/context inputs and callbacks |
| import | BsImportWizard, BsFileInput, BsFileDrop, BsColumnMapping, BsImportPreview, BsImportValidationSummary, BsImportResult | schema, parsing, validation, mapping, phase transitions and apply commands |
| team | BsTeamTable, BsInviteMemberDialog, BsRolePicker | typed table columns, member state, roles, capacity notice and authorized commands |
| review-detail | BsReviewPanel, BsDetailDialog, BsDetailSection, BsDescriptionList, BsSummaryGrid, BsHistoryList, BsTimeline | review data, permissions, history and command handlers |
| tags | BsTagEditor, BsTagPicker | free-text tags or stable tag identifiers with assigned/available data and command intent |
| charts | BsMetricBarChart, BsChartLegend | series, points, preformatted values and accounting aggregation |
| hierarchy-flow | BsHierarchyTree, BsFlowMap | generic nodes/stages; account mapping, balances, actions and expansion scope |
| line-items | BsLineItemsEditor, BsLineItemRow, BsQuantityInput | stable row IDs, bounds, errors, data slots and pricing/accounting callbacks |
| printable | BsPrintableDocument, BsDocumentHeader, BsDocumentLines, BsDocumentTotals, BsPrintActions | issuer, snapshot, preformatted line/totals and print/share commands |
| filters | BsFilterBar, BsDateRangeFilter, BsToolbar | existing date/search/select composition; report queries and exports |

## Contracts and composition

Typed presentation inputs are exported by `@building-suit/contracts`. UI exports are explicit; the existing Nuxt layer discovers all new Bs components automatically. Generic table inputs use `BsDataTableColumn` from `@building-suit/ux`. `BsTeamTable` and `BsImportPreview` compose `BsDataTable`, including its error/empty/loading and action contract. They do not introduce a datagrid. Team member domain-cell slots use the same `cell-<key>` API; product capability checks remain required on the server.

`BsMoneyText` requires `currency` and `amount`; `unit` defaults to `minor`. `locale`, `accounting`, `explicitSign`, `signed` and `numberingSystem` control display only. The `latn` default preserves Ledger's Western-digit convention in Arabic. Integer minor units use bigint division and exact fractional replacement in Intl parts, including negative sub-unit values and the PostgreSQL bigint range. Unsafe numbers throw; provide large integers/decimals as strings. Major-unit input must be a decimal with no excess currency precision. The renderer never rounds a financial command or selects tenant currency. Ledger's existing `amountMinor` adapter must map to `amount` and explicitly pass its currency/locale.

Usage meters clamp the visual ratio to 0–100; null limit hides the bar for unlimited usage. Tone, written status, units and upgrade copy are supplied by the product. No plan threshold is embedded in shared UI. Pricing keeps the existing Ledger-derived implementation.

Import steps are controlled by stable IDs. `next`/`back` emit intent; the product owns validation and asynchronous transitions, sets `pending` and `canAdvance`, and wraps modal use in `BsDialog` for dirty-state/focus protection. File selection and drop emit one file without parsing or trusting file extensions. `accept` is a chooser hint; products validate dropped/selected content. Column mapping uses a keyed record and can enforce exclusive source-column selection; optional mappings can be cleared. Schema requirements and safe errors remain product inputs. Preview columns are explicit Bs schemas.

Invites compose `BsRecordActionDialog` to reuse dirty-close, focus, pending and form-error behavior. Capacity notices and role choices are product inputs. The invite dialog accepts additional Bs field content for product-specific name/location inputs and a result slot for invitation-link presentation. `BsTagPicker` emits stable ID assignment/removal intent without optimistic persistence; `BsTagEditor` remains the free-text editing owner.

Review actions are capability-controlled and locked while pending. Charts accept generic series/point arrays and preformatted values; a shared table exposes the same values without relying on color or hover. Negative bars are patterned magnitude bars, with signed values retained in the table. Hierarchy uses controlled expanded IDs, cycle-safe traversal, native list semantics and buttons with `aria-expanded`. It intentionally avoids ARIA tree roles without full tree keyboard interaction. Flow maps accept ordered stages/nodes; accounting graph topology is product data.

Repeating rows require stable IDs and product-owned row values. Shared row bounds govern add/remove affordances only. A scoped field slot receives `item`, `index` and `disabled`; adapters compose Bs fields and supply validation, tax, stock and accounting calculations. Quantity controls preserve native numeric input semantics.

Printable documents compose static, accessible document tables, not interactive record grids. Products provide already-formatted quantities/prices/totals and issuer/reference/date content. `receipt` uses 80mm paper and `statement` uses the available page width. Print actions emit intent; products handle `window.print()` and sharing. Print CSS hides actions and repeats document table headers. This static table is owned inside shared UI; Suit routes render only Bs components.

## Catalogue and verification

The documentation `/components` page includes the bilingual `WorkflowPatternCatalogue` alongside existing pricing, entity/context, history/detail, tags and filter examples. Its synthetic controls exercise loading/error/empty, pending actions, import phases, invite overlays, hierarchy expansion, editable rows and printing. No production mutations are used.

Run the task's full local verification plan: `node tooling/checks/suit-template-boundaries.mjs`, `pnpm check`, `pnpm typecheck`, `pnpm lint`, `node --test packages/ui/tests/*.test.mjs packages/ux/tests/*.test.mjs`, and the docs, Ledger and Shop builds. Render the catalogue at desktop/mobile in English/light and Arabic/dark, inspect keyboard focus and the state controls, and verify print actions are hidden under print media. Report actual results separately; these instructions are not a passing verification record.
