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

Charts may supply `pointLabel` for the first table column and a separate `tableSeries` list for additional table-only values. Ledger uses this to retain net amounts in the accessible table while plotting only revenue and expenses. All values and formatting remain product inputs.

## Access-management catalogue (BS-LAUNCH-ACCESS-UI-001)

| Shared component | Inputs and intent | Consumers |
|---|---|---|
| BsAccessTabs | controlled tab key, translated labels/counts, disabled state | Ledger Team |
| BsTeamTable | typed product rows/columns, cell slots and table states | Ledger and Shop Team |
| BsInvitationTable | typed rows/columns, action-column key, product-supplied eligible actions; emits action key and original row | Ledger and Shop Team |
| BsPermissionMatrix | translated flat permission rows with stable section IDs, role headings and product-supplied membership callback; editable selection emits key/checked | Ledger matrix and role editor |
| BsRoleEditorDialog | permission selection plus product name/quota fields in the default slot | Ledger system/custom role editor |
| BsMemberEditorDialog | identity/role/extra-field slots or translated radio role choices; controlled role and visibility | Ledger and Shop member editors |

Permission and invitation descriptors are exported from `@building-suit/ux`. The shared owners never infer role authority, pending invitation eligibility, tenant context or permission membership. Products retain all queries, capability mappings, quota calculations, confirmations and commands. Dialogs delegate pending, dirty-close protection, keyboard focus and error feedback to `BsRecordActionDialog`; no new overlay policy is introduced. Permission rows must be ordered by section for table grouping; role keys must be unique and must not use the reserved `permission` column key.

The extraction preserves Ledger's tab counts, member search, role permission counts, system/custom choices and resend/revoke rules. Shop retains its location assignments, ownership transfer and fixed-role permissions. The shared invitation action buttons lock while a command is pending. The role-editor checkboxes and default member role radios lock while saving.

Local verification for this extraction (2026-10-06): the full shared foundation/UX export tests, Ledger and Shop migration regressions, `pnpm typecheck`, `pnpm check`, and changed shared-source ESLint checks passed. The initial docs typecheck failed on a missing generated index; `pnpm docs:generate` resolved it. Ledger's migration helper now accepts an absent app-local component directory, as required by strict ownership.

Browser commands were attempted with one worker and no retries: Ledger/Shop `tests/e2e/shared-ui-foundation.spec.ts` (each repeated twice), and the shared `packages/testing/e2e/shared-ui.spec.ts` suite. They could not start their local web servers in the sandbox; a direct localhost listen probe failed with `EPERM`. No screenshots or rendered UI acceptance are claimed. The new Ledger access scenario is registered by Playwright and remains to be executed in an environment permitting localhost servers. It covers member role/dirty handling, permission matrix/editing, invitation revocation and desktop light English/narrow dark Arabic captures.

The catalogue inventory above and ownership manifest are updated within approved task paths. Live documentation-app catalogue integration is pending scope authorization because `apps/building-suit-docs` is excluded from this task's allowed paths. No hosted database or product authorization contract changed.

The final Ledger and Shop production builds and documentation catalogue build exited successfully. Remaining acceptance blockers are localhost browser execution and live catalogue scope authorization; the worktree is uncommitted for control-plane publication.
