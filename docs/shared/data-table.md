# Shared data table

Every product table uses `BsDataTable` backed by PrimeVue 4.5.5 DataTable and Column. The wrapper supplies shared appearance, loading/empty/error behavior, optional search/export and translations. Product components supply values and Column definitions or body/header/footer/editor slots.

Native DataTable props, model-update listeners and events are forwarded through the wrapper. All named slots except the wrapper-owned `toolbar` slot pass through to DataTable; empty/loading have overridable defaults. The wrapper explicitly forwards the typed `row-click` event. The default slot carries PrimeVue Column and ColumnGroup definitions.

| Capability | Configuration |
|---|---|
| Columns and cell templates | `Column` field/header/body/editor props and slots |
| Single/multiple sorting | `sortable`, `sortMode`, `sortField`, `sortOrder`, `multiSortMeta`, `sort` |
| Local/global/advanced filters | `filters`, `filterDisplay`, Column filter slots; `searchable` and `searchFields` add shared search |
| Local pagination | `paginator`, `rows`, `rowsPerPageOptions`, paginator slots |
| Server pagination/filter/sort | `lazy`, `totalRecords`, `first`, `page`, `filter`, `sort`; `search` emits the new query |
| Selection and bulk actions | `v-model:selection`, `selectionMode`, selection Column; `toolbar` holds authorized bulk actions |
| Expansion and grouping | `expandedRows`, expansion slot, `rowGroupMode`, `groupRowsBy`, group header/footer slots |
| Totals and grouped columns | `ColumnGroup`, `Row`, Column footer, table footer slot |
| Cell/row editing | `editMode`, `editingRows`, Column editor slots and native edit events |
| Scrolling and virtualization | `scrollable`, `scrollHeight`, `virtualScrollerOptions`; product adapters load requested windows |
| Frozen, resized and reordered columns | Column `frozen`, `alignFrozen`, `resizableColumns`, `reorderableColumns` and native events |
| Persisted table state | Native `stateKey`/`stateStorage`; keys must include environment, portal, user and tenant |
| Row/context actions | `row-click`, `row-dblclick`, `contextMenuSelection`, `row-contextmenu`; authorization remains server-side |
| CSV export | `exportable`; strings are neutralized for spreadsheet formulas; lazy tables emit `export` for an authorized full-data export |
| Loading/empty/error | Shared states; product-specific slots/copy where needed |
| Accessibility/RTL | Native semantic table behavior, shared keyboard controls, logical spacing and app locale direction |

Do not turn on every capability on every table. Avoid client filtering/exporting only the currently loaded page of a lazy dataset; its adapter must handle the whole requested scope on the server. Financial display amounts and report totals remain product-owned; do not coerce integer minor units into business arithmetic inside the table.

Do not combine a wrapper search box with a second independent global-search control. Column-specific filters can coexist with the wrapper's global filter. Keep native model state controlled by a single owner.

API inventory is generated from the pinned installed declaration files by `pnpm table:inventory`. Vendor behavior and unsupported native combinations follow the pinned upstream implementation, not a separately reimplemented grid.
