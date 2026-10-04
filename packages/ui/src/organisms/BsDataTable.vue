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
  BsDataTableCapabilities,
  BsDataTableQueryAdapter,
  BsDataTableRowAction,
} from '@building-suit/ux'
import { csvCell } from '@building-suit/ux'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  value?: ([Row] extends [never] ? object : Row)[] | null
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
}>(), {
  value: () => [], label: undefined, density: 'comfortable', stickyHeader: false,
  stickyFooter: false, maxHeight: undefined, scrollLabel: undefined, searchable: false,
  searchLabel: undefined, exportable: false, searchFields: () => [], lazy: false,
  loading: false, error: null, capabilities: () => ({}), actionLabels: () => ({}),
  canRowAction: undefined, rowActionPending: false, queryAdapter: undefined,
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
  'row-click': [event: DataTableRowClickEvent<Row>]
}>()
const ui = useUiCopy()
const slots = useSlots()
const attrs = useAttrs()

// useAttrs/useSlots are updated in place by Vue, but are not reactive sources.
// Read them during each render so native v-model updates cannot retain stale values.
function forwardedAttrs() { const { filters: _filters, ...rest } = attrs; return rest }
const table = ref<InstanceType<typeof DataTable> | null>(null)
const search = ref('')
const exportEnabled = computed(() => props.exportable || props.capabilities.export === true)
const rowActions = computed<BsDataTableRowAction[]>(() =>
  (['edit', 'delete', 'archive', 'void'] as const).filter(action => props.capabilities[action] === true),
)
const hasToolbar = computed(() => props.searchable || exportEnabled.value || props.capabilities.insert || slots.toolbar || slots.filters)

function filters() {
  return props.searchable && !props.lazy
    ? { ...(attrs.filters as DataTableFilterMeta || {}), global: { value: search.value, matchMode: 'contains' } }
    : attrs.filters as DataTableFilterMeta | undefined
}
function forwardedSlots() { return Object.keys(slots).filter(key => !['default', 'empty', 'loading', 'toolbar', 'filters'].includes(key)) }
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
function emitRowAction(action: BsDataTableRowAction, row: Row) {
  if (action === 'edit') emit('edit', row)
  else if (action === 'delete') emit('delete', row)
  else if (action === 'archive') emit('archive', row)
  else emit('void', row)
}
function onPage(event: DataTablePageEvent) { props.queryAdapter?.page?.(event); emit('page', event) }
function onSort(event: DataTableSortEvent) { const sort = props.queryAdapter?.sort; sort?.(event); emit('sort', event) }
function onFilter(event: DataTableFilterEvent) { props.queryAdapter?.filter?.(event); emit('filter', event) }
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
    <BsToolbar v-if="hasToolbar" class="bs-data-table__toolbar" :label="label || ui('tableTools')" variant="plain">
      <BsInput v-if="searchable" v-model="search" type="search" class="max-w-sm" :aria-label="searchLabel || ui('search')" :placeholder="searchLabel || ui('search')" />
      <slot name="toolbar" />
      <template v-if="slots.filters" #filters><slot name="filters" /></template>
      <template #actions>
        <BsButton v-if="capabilities.insert" variant="primary" :disabled="loading" @click="emit('create')">
          {{ actionLabels.insert || ui('create') }}
        </BsButton>
        <BsButton v-if="exportEnabled" :disabled="loading" @click="exportCsv">{{ ui('export') }}</BsButton>
      </template>
    </BsToolbar>
    <BsStateSurface v-if="error" state="error" :title="error" :action-label="ui('retry')" @action="emit('retry')" />
    <DataTable
      v-else
      ref="table"
      :value="value || []"
      :lazy="lazy"
      :loading="loading"
      :filters="filters()"
      :global-filter-fields="searchFields.length ? searchFields : undefined"
      :export-function="({ data }: { data: unknown }) => csvCell(data)"
      table-class="ls-table"
      :pt="{ root: { class: 'relative' }, pcPaginator: { root: { class: 'bs-paginator' }, content: { class: 'bs-paginator-content' }, first: { class: 'ls-btn ls-btn-sm' }, prev: { class: 'ls-btn ls-btn-sm' }, next: { class: 'ls-btn ls-btn-sm' }, last: { class: 'ls-btn ls-btn-sm' }, page: { class: 'ls-btn ls-btn-sm' }, pcRowPerPageDropdown: { root: { class: 'ls-input inline-flex w-auto items-center gap-2' }, label: { class: 'px-2' }, dropdown: { class: 'px-2' }, overlay: { class: 'ls-card p-2 shadow-overlay' }, option: { class: 'p-2' } } }, tableContainer: tableContainerPt, header: { class: 'p-3 border-b border-line' }, footer: { class: 'p-3 border-t border-line' }, loadingOverlay: { class: 'absolute inset-0 z-10 grid place-items-center bg-surface/80' } }"
      v-bind="forwardedAttrs()"
      @page="onPage"
      @sort="onSort"
      @filter="onFilter"
      @row-click="emit('row-click', $event)"
    >
      <slot />
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
