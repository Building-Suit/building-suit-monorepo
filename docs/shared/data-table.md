# Shared data table

Every product table uses `BsDataTable` backed internally by PrimeVue 4.5.5 DataTable and Column. The wrapper supplies shared appearance, loading/empty/error behavior, search/export, pagination, selection, CRUD action placement and translations. Product adapters supply typed rows, a typed row key, `BsDataTableColumn<Row>[]`, capabilities and constrained `cell-{key}` / `header-{key}` slots. PrimeVue tags and presentation props are not part of the Suit contract. Current direct `Column`, `ColumnGroup` and `Row` tags in Suit templates remain recorded migration debt and are forbidden at the final zero-native gate.

`BsDataTableCapabilities` is the common presentation contract. `insert`, `edit`, `delete`, `archive`, `void`, `export` and `select` default to false, so a view-only table never gains a mutation affordance accidentally. `insert` emits `create`; configured row actions emit their typed row through `edit`, `delete`, `archive` or `void`. Products provide translated action labels, optional per-row guards and pending state, then open `BsRecordActionDialog` or invoke the shared confirmation controller. These flags reflect product access state but never replace server authorization.

Lazy products may provide `BsDataTableQueryAdapter` callbacks for shared search, page, sort and filter changes. The adapter remains product-owned and performs the actual query; `BsDataTable` never imports product data access. Native events continue to emit for existing controlled consumers.

Safe native DataTable behavior and model events continue to be forwarded during migration, but class/style/`pt` escape hatches are filtered. The public column contract is Bs-owned. Domain cells use `cell-{key}` slots whose content must also remain Bs-only. The unnamed slot is migration-only compatibility for debt already recorded in the boundary manifest; new and migrated consumers must use the schema. Empty/loading/error and retry states remain shared and overridable through Bs-only slots.

| Capability | Configuration |
|---|---|
| Columns and cell templates | `columns: BsDataTableColumn<Row>[]`; `cell-{key}`, `header-{key}` and `filter-{key}` slots |
| Single/multiple sorting | `sortable`, `sortMode`, `sortField`, `sortOrder`, `multiSortMeta`, `sort` |
| Local/global/advanced filters | controlled `filters`, semantic column filter slots, `BsTableFilters`; `searchable` and `searchFields` add one shared search |
| Local pagination | `paginator`, `rows`, `rowsPerPageOptions`, paginator slots |
| Server pagination/filter/sort | `lazy`, `totalRecords`, `first`, `page`, `filter`, `sort`; `search` emits the new query |
| Selection and bulk actions | `capabilities.select`, `v-model:selection`, `selectionMode`; `BsTableActions` holds authorized bulk actions |
| Create/edit lifecycle | `capabilities.insert` and row capabilities place the standard actions; typed events open the product-supplied `BsRecordActionDialog` |
| Destructive domain actions | Optional `delete`/`archive`/`void` capabilities emit hooks; the product applies its authorized command and shared confirmation policy |
| Expansion and grouping | `expandedRows`, expansion slot, `rowGroupMode`, `groupRowsBy`, group header/footer slots |
| Totals and grouped columns | Bs-owned schema/slots; vendor grouped-column tags are not exposed to Suits |
| Cell/row editing | `editMode`, `editingRows`, Column editor slots and native edit events |
| Scrolling and virtualization | `scrollable`, `scrollHeight`, `virtualScrollerOptions`; product adapters load requested windows |
| Frozen, resized and reordered columns | semantic column `sticky`/`width` plus controlled resize/reorder behavior and native events |
| Persisted table state | Native `stateKey`/`stateStorage`; keys must include environment, portal, user and tenant |
| Row/context actions | `row-click`, `row-dblclick`, `contextMenuSelection`, `row-contextmenu`; authorization remains server-side |
| CSV export | `exportable`; strings are neutralized for spreadsheet formulas; lazy tables emit `export` for an authorized full-data export |
| Loading/empty/error | `BsStateSurface`, retry event, and product-supplied translated copy |
| Accessibility/RTL | Native semantic table behavior, shared keyboard controls, logical spacing and app locale direction |

Do not turn on every capability on every table. Avoid client filtering/exporting only the currently loaded page of a lazy dataset; its adapter must handle the whole requested scope on the server. Financial display amounts and report totals remain product-owned; do not coerce integer minor units into business arithmetic inside the table.

Do not combine a wrapper search box with a second independent global-search control. Column-specific filters can coexist with the wrapper's global filter. Keep native model state controlled by a single owner.

`BsTableToolbar`, `BsTableSearch`, `BsTableFilters`, `BsTableActions` and `BsPagination` own table-adjacent presentation. `BsSummaryGrid`, `BsDescriptionList`, `BsHistoryList`/`BsTimeline`, `BsDetailSection`/`BsDetailDialog`, `BsTagEditor` and `BsEntityPicker` cover recurring data presentation without creating small product-local display systems. Entity picker search/page events are handled by the product adapter; the shared component never queries a product schema.

API inventory is generated from the pinned installed declaration files by `pnpm table:inventory`. Vendor behavior and unsupported native combinations follow the pinned upstream implementation, not a separately reimplemented grid.

Column totals use the Bs-owned `footer` value and `footer-{key}` slots. Footer cells follow the column's alignment and width; products retain total calculations over the full report population. `ariaSort` preserves accessible sort state when a product's header actions own server sorting. Vendor column groups and passthrough styling are unnecessary for these cases.
