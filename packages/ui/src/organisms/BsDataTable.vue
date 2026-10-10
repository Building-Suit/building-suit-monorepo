<script setup lang="ts" generic="Row extends object = Record<string, unknown>">
import Column from 'primevue/column'
import DataTable, {
  type DataTableFilterEvent,
  type DataTableFilterMeta,
  type DataTablePageEvent,
  type DataTableRowClickEvent,
  type DataTableSortEvent,
} from 'primevue/datatable'
import type {
  BsDataTableActionLabels,
  BsDataTableColumn,
  BsDataTableCapabilities,
  BsDataTableQueryAdapter,
  BsDataTableRowAction,
} from '@building-suit/ux'
import { csvCell } from '@building-suit/ux'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  value?: ([Row] extends [never] ? object : Row)[] | null
  columns?: BsDataTableColumn<Row>[]
  rowKey?: keyof Row & string | ((row: Row) => string)
  label?: string
  density?: 'compact' | 'comfortable'
  stickyHeader?: boolean
  stickyFooter?: boolean
  maxHeight?: string
  scrollLabel?: string
  searchable?: boolean
  searchLabel?: string
  exportable?: boolean
  searchFields?: string[]
  lazy?: boolean
  loading?: boolean
  error?: string | null
  capabilities?: BsDataTableCapabilities
  actionLabels?: BsDataTableActionLabels
  canRowAction?: (action: BsDataTableRowAction, row: Row) => boolean
  rowActionPending?: boolean | ((action: BsDataTableRowAction, row: Row) => boolean)
  queryAdapter?: BsDataTableQueryAdapter
  paginator?: boolean
  pageSize?: number
  pageSizes?: number[]
  first?: number
  totalRecords?: number
  filters?: DataTableFilterMeta
  selectionMode?: 'single' | 'multiple'
  sortField?: string
  sortOrder?: 0 | 1 | -1
}>(), {
  value: () => [], columns: () => [], rowKey: undefined, label: undefined, density: 'comfortable', stickyHeader: false,
  stickyFooter: false, maxHeight: undefined, scrollLabel: undefined, searchable: false,
  searchLabel: undefined, exportable: false, searchFields: () => [], lazy: false,
  loading: false, error: null, capabilities: () => ({}), actionLabels: () => ({}),
  canRowAction: undefined, rowActionPending: false, queryAdapter: undefined,
  paginator: false, pageSize: 20, pageSizes: () => [10, 20, 50], first: 0,
  totalRecords: undefined, selectionMode: undefined, sortField: undefined, sortOrder: undefined,
  filters: undefined,
})
const emit = defineEmits<{
  search: [value: string]
  export: []
  retry: []
  create: []
  edit: [row: Row]
  delete: [row: Row]
  archive: [row: Row]
  void: [row: Row]
  page: [event: DataTablePageEvent]
  sort: [event: DataTableSortEvent]
  filter: [event: DataTableFilterEvent]
  'update:filters': [value: DataTableFilterMeta]
  'update:selection': [value: Row | Row[] | null]
  'update:sortField': [value: string | undefined]
  'update:sortOrder': [value: 0 | 1 | -1 | undefined]
  'row-click': [event: DataTableRowClickEvent<Row>]
}>()
const ui = useUiCopy()
const slots = useSlots()
const attrs = useAttrs()

// useAttrs/useSlots are updated in place by Vue, but are not reactive sources.
// Read them during each render so native v-model updates cannot retain stale values.
function forwardedAttrs() {
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => {
    const normalized = key.replaceAll('-', '').toLowerCase()
    return key !== 'filters'
      && !['class', 'style', 'pt', 'ptoptions', 'tableclass', 'tablestyle', 'rowclass', 'rowstyle', 'headerclass', 'headerstyle', 'bodyclass', 'bodystyle'].includes(normalized)
      && !normalized.endsWith('class')
      && !normalized.endsWith('style')
  }))
}
const table = ref<InstanceType<typeof DataTable> | null>(null)
const search = ref('')
const visibleColumns = computed(() => props.columns.filter(column => !column.hidden))
const effectiveSelectionMode = computed(() => props.capabilities.select || !props.columns.length ? props.selectionMode : undefined)
const exportEnabled = computed(() => props.exportable || props.capabilities.export === true)
const rowActions = computed<BsDataTableRowAction[]>(() =>
  (['edit', 'delete', 'archive', 'void'] as const).filter(action => props.capabilities[action] === true),
)
const hasToolbar = computed(() => props.searchable || exportEnabled.value || props.capabilities.insert || slots.toolbar || slots.filters)

function resolvedFilters() {
  return props.searchable && !props.lazy
    ? { ...(props.filters || {}), global: { value: search.value, matchMode: 'contains' } }
    : props.filters
}
function forwardedSlots() { return Object.keys(slots).filter(key => !['default', 'empty', 'loading', 'toolbar', 'filters'].includes(key) && !/^(?:cell|header|filter|footer)-/.test(key)) }
const tableContainerPt = computed(() => ({
  class: 'overflow-auto',
  ...(props.scrollLabel ? { tabindex: 0, role: 'region', 'aria-label': props.scrollLabel } : {}),
  ...(props.maxHeight ? { style: { maxHeight: props.maxHeight } } : {}),
}))
function exportCsv() {
  if (props.lazy) emit('export')
  else table.value?.exportCSV()
}
function rowActionVisible(action: BsDataTableRowAction, row: Row) {
  return props.capabilities[action] === true && (props.canRowAction?.(action, row) ?? true)
}
function isRowActionPending(action: BsDataTableRowAction, row: Row) {
  return typeof props.rowActionPending === 'function' ? props.rowActionPending(action, row) : props.rowActionPending
}
function actionLabel(action: BsDataTableRowAction) { return props.actionLabels[action] || ui(action) }
function cellValue(column: BsDataTableColumn<Row>, row: Row) {
  const value = column.value ? column.value(row) : column.field ? getField(row, column.field) : undefined
  return column.format ? column.format(value, row) : value
}
function getField(row: Row, field: string): unknown {
  return field.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, row)
}
function columnClass(column: BsDataTableColumn<Row>, header = false) {
  const align = header ? column.headerAlign || column.align : column.align
  return [
    align ? `bs-data-table__cell--${align}` : undefined,
    column.width ? `bs-data-table__cell--${column.width}` : undefined,
    column.sticky ? `bs-data-table__cell--sticky-${column.sticky}` : undefined,
  ].filter(Boolean).join(' ')
}
function emitRowAction(action: BsDataTableRowAction, row: Row) {
  if (action === 'edit') emit('edit', row)
  else if (action === 'delete') emit('delete', row)
  else if (action === 'archive') emit('archive', row)
  else emit('void', row)
}
function onPage(event: DataTablePageEvent) { props.queryAdapter?.page?.(event); emit('page', event) }
function onSort(event: DataTableSortEvent) { const sort = props.queryAdapter?.sort; sort?.(event); emit('sort', event) }
function onFilter(event: DataTableFilterEvent) { props.queryAdapter?.filter?.(event); emit('filter', event) }
function updateFilters(value: DataTableFilterMeta) { emit('update:filters', value) }
function updateSortField(value: string | ((item: unknown) => string) | null | undefined) { emit('update:sortField', typeof value === 'string' ? value : undefined) }
function updateSortOrder(value: number | null | undefined) { emit('update:sortOrder', value === 1 || value === -1 || value === 0 ? value : undefined) }
watch(search, (value) => { props.queryAdapter?.search?.(value); emit('search', value) })
defineExpose({ exportCSV: exportCsv })
</script>

<template>
  <section
    class="bs-data-table"
    :class="[`bs-data-table--${density}`, { 'bs-data-table--sticky-header': stickyHeader, 'bs-data-table--sticky-footer': stickyFooter }]"
    :aria-label="label"
    :aria-busy="loading"
  >
    <BsTableToolbar v-if="hasToolbar" :label="label || ui('tableTools')">
      <BsTableSearch v-if="searchable" v-model="search" :label="searchLabel || ui('search')" />
      <slot name="toolbar" />
      <template v-if="slots.filters" #filters><BsTableFilters :label="label || ui('tableTools')"><slot name="filters" /></BsTableFilters></template>
      <template #actions>
        <BsTableActions>
          <BsButton v-if="capabilities.insert" variant="primary" :disabled="loading" @click="emit('create')">
            {{ actionLabels.insert || ui('create') }}
          </BsButton>
          <BsButton v-if="exportEnabled" :disabled="loading" @click="exportCsv">{{ ui('export') }}</BsButton>
        </BsTableActions>
      </template>
    </BsTableToolbar>
    <BsStateSurface v-if="error" state="error" :title="error" :action-label="ui('retry')" @action="emit('retry')" />
    <DataTable
      v-else
      ref="table"
      :value="value || []"
      :data-key="rowKey"
      :lazy="lazy"
      :loading="loading"
      :paginator="paginator"
      :rows="pageSize"
      :rows-per-page-options="pageSizes"
      :first="first"
      :total-records="totalRecords"
      :selection-mode="effectiveSelectionMode"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :filters="resolvedFilters()"
      :global-filter-fields="searchFields.length ? searchFields : undefined"
      :export-function="({ data }: { data: unknown }) => csvCell(data)"
      table-class="ls-table"
      :pt="{ root: { class: 'relative' }, pcPaginator: { root: { class: 'bs-paginator' }, content: { class: 'bs-paginator-content' }, first: { class: 'ls-btn ls-btn-sm' }, prev: { class: 'ls-btn ls-btn-sm' }, next: { class: 'ls-btn ls-btn-sm' }, last: { class: 'ls-btn ls-btn-sm' }, page: { class: 'ls-btn ls-btn-sm' }, pcRowPerPageDropdown: { root: { class: 'ls-input inline-flex w-auto items-center gap-2' }, label: { class: 'px-2' }, dropdown: { class: 'px-2' }, overlay: { class: 'ls-card p-2 shadow-overlay' }, option: { class: 'p-2' } } }, tableContainer: tableContainerPt, header: { class: 'p-3 border-b border-line' }, footer: { class: 'p-3 border-t border-line' }, loadingOverlay: { class: 'absolute inset-0 z-10 grid place-items-center bg-surface/80' } }"
      v-bind="forwardedAttrs()"
      @page="onPage"
      @sort="onSort"
      @filter="onFilter"
      @update:filters="updateFilters"
      @update:selection="emit('update:selection', $event)"
      @update:sort-field="updateSortField"
      @update:sort-order="updateSortOrder"
      @row-click="emit('row-click', $event)"
    >
      <Column v-if="capabilities.select && selectionMode" :selection-mode="selectionMode" header-class="bs-data-table__cell--selection" body-class="bs-data-table__cell--selection" />
      <Column
        v-for="column in visibleColumns"
        :key="column.key"
        :field="column.field"
        :header="slots[`header-${column.key}`] ? undefined : column.header"
        :export-header="column.header"
        :footer="column.footer === undefined ? undefined : String(column.footer)"
        :sortable="column.sortable"
        :pt="column.ariaSort ? { headerCell: { 'aria-sort': column.ariaSort } } : undefined"
        :sort-field="column.sortField"
        :filter-field="column.filterField"
        :filter-match-mode="column.filterMatchMode"
        :exportable="column.exportable"
        :selection-mode="column.selectionMode"
        :frozen="Boolean(column.sticky)"
        :align-frozen="column.sticky"
        :header-class="columnClass(column, true)"
        :body-class="columnClass(column)"
        :footer-class="columnClass(column)"
      >
        <template v-if="slots[`header-${column.key}`]" #header><slot :name="`header-${column.key}`" :column="column" /></template>
        <template #body="{ data, index }"><slot :name="`cell-${column.key}`" :row="data" :value="cellValue(column, data)" :column="column" :index="index">{{ cellValue(column, data) }}</slot></template>
        <template v-if="column.footer !== undefined || slots[`footer-${column.key}`]" #footer><slot :name="`footer-${column.key}`" :column="column">{{ column.footer }}</slot></template>
        <template v-if="slots[`filter-${column.key}`]" #filter="scope"><slot :name="`filter-${column.key}`" v-bind="scope || {}" :column="column" /></template>
      </Column>
      <!-- Migration-only compatibility. New Suit consumers use `columns` and `cell-*` slots. -->
      <slot name="legacy-columns" />
      <slot v-if="!columns.length" />
      <Column v-if="rowActions.length" header-class="text-end" body-class="whitespace-nowrap text-end">
        <template #header>{{ actionLabels.actions || ui('actions') }}</template>
        <template #body="{ data }">
          <template v-for="action in rowActions" :key="action">
            <BsButton
              v-if="rowActionVisible(action, data)"
              :variant="action === 'edit' ? 'link' : 'text'"
              size="sm"
              :class="{ 'bs-data-table__danger-action': action !== 'edit' }"
              :pending="isRowActionPending(action, data)"
              @click.stop="emitRowAction(action, data)"
            >
              {{ actionLabel(action) }}
            </BsButton>
          </template>
          <slot name="row-actions" :row="data" />
        </template>
      </Column>
      <template v-for="name in forwardedSlots()" :key="name" #[name]="scope"><slot :name="name" v-bind="scope || {}" /></template>
      <template #empty><slot name="empty"><BsStateSurface state="empty" :title="ui('empty')" /></slot></template>
      <template #loading><slot name="loading"><BsStateSurface state="loading" :title="ui('loading')" /></slot></template>
    </DataTable>
  </section>
</template>

<style>
.bs-data-table__toolbar { padding: var(--bs-space-3); border-bottom: 1px solid var(--bs-border); }
.bs-data-table__danger-action { color: var(--bs-status-error); }
.bs-data-table__cell--start { text-align: start; }
.bs-data-table__cell--center { text-align: center; }
.bs-data-table__cell--end { text-align: end; }
.bs-data-table__cell--selection { width: 3rem; }
.bs-data-table__cell--xs { width: 5rem; }
.bs-data-table__cell--sm { width: 8rem; }
.bs-data-table__cell--md { width: 12rem; }
.bs-data-table__cell--lg { width: 18rem; }
.bs-data-table__cell--xl { width: 24rem; }
.bs-data-table__cell--content { width: 1%; white-space: nowrap; }
.bs-data-table__cell--sticky-start { position: sticky; inset-inline-start: 0; z-index: 2; background: var(--bs-surface); }
.bs-data-table__cell--sticky-end { position: sticky; inset-inline-end: 0; z-index: 2; background: var(--bs-surface); }
.bs-paginator, .bs-paginator-content { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: .5rem; padding: .5rem; }
.bs-data-table [data-pc-name='paginator'] { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: .5rem; padding: 1rem; border-top: 1px solid var(--bs-border); }
.bs-data-table [data-pc-name='paginator'] button { min-width: 2.75rem; min-height: 2.75rem; border-radius: var(--bs-radius-button); }
.bs-data-table [data-pc-name='paginator'] button[aria-current='page'] { background: var(--bs-primary); color: var(--bs-text-on-primary); }
.bs-data-table [data-pc-section='sorticon'] { display: inline-block; width: 1rem; margin-inline-start: .5rem; }
.bs-data-table tr[aria-selected='true'] { background: var(--bs-surface-muted); }
.bs-data-table td[data-p-frozen-column='true'], .bs-data-table th[data-p-frozen-column='true'] { background: var(--bs-surface); }
.bs-data-table--compact .ls-table th, .bs-data-table--compact .ls-table td { padding-block: var(--bs-space-1); }
.bs-data-table--comfortable .ls-table th, .bs-data-table--comfortable .ls-table td { padding-block: var(--bs-space-2); }
.bs-data-table--sticky-header .ls-table thead > tr > th { position: sticky; top: 0; z-index: 3; background: var(--bs-surface); }
.bs-data-table--sticky-footer .ls-table tfoot > tr > td { position: sticky; bottom: 0; z-index: 3; background: var(--bs-surface); border-top: 1px solid var(--bs-border); }
.bs-data-table .ls-sticky-start { position: sticky; inset-inline-start: 0; z-index: 2; min-width: 13rem; background: var(--bs-surface); box-shadow: 1px 0 0 var(--bs-border); }
.bs-data-table .ls-sticky-end { position: sticky; inset-inline-end: 0; z-index: 2; min-width: 9rem; background: var(--bs-surface); box-shadow: -1px 0 0 var(--bs-border); }
.bs-data-table .ls-sticky-end-offset { position: sticky; inset-inline-end: 9rem; z-index: 2; min-width: 9rem; background: var(--bs-surface); }
.bs-data-table--sticky-header .ls-table thead > tr > .ls-sticky-start,
.bs-data-table--sticky-header .ls-table thead > tr > .ls-sticky-end,
.bs-data-table--sticky-header .ls-table thead > tr > .ls-sticky-end-offset { z-index: 4; }
</style>
