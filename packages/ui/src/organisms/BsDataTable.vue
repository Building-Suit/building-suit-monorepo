<script setup lang="ts">
import DataTable, { type DataTableFilterMeta, type DataTableRowClickEvent } from 'primevue/datatable'
import { csvCell } from '@building-suit/ux'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  value?: object[] | null
  label?: string
  searchable?: boolean
  exportable?: boolean
  searchFields?: string[]
  lazy?: boolean
  loading?: boolean
  error?: string | null
}>(), { value: () => [], label: undefined, searchable: false, exportable: false, searchFields: () => [], lazy: false, loading: false, error: null })
const emit = defineEmits<{ search: [value: string]; export: []; retry: []; 'row-click': [event: DataTableRowClickEvent] }>()
const ui = useUiCopy()
const slots = useSlots()
const attrs = useAttrs()
// useAttrs/useSlots are updated in place by Vue, but are not reactive sources.
// Read them during each render so native v-model updates cannot retain stale values.
function forwardedAttrs() { const { filters: _filters, ...rest } = attrs; return rest }
const table = ref<InstanceType<typeof DataTable> | null>(null)
const search = ref('')
function filters() { return props.searchable && !props.lazy ? { ...(attrs.filters as DataTableFilterMeta || {}), global: { value: search.value, matchMode: 'contains' } } : attrs.filters as DataTableFilterMeta | undefined }
function forwardedSlots() { return Object.keys(slots).filter(key => !['default', 'empty', 'loading', 'toolbar'].includes(key)) }
function exportCsv() {
  if (props.lazy) emit('export')
  else table.value?.exportCSV()
}
watch(search, value => emit('search', value))
defineExpose({ exportCSV: exportCsv })
</script>
<template>
  <section class="bs-data-table" :aria-label="label" :aria-busy="loading">
    <div v-if="searchable || exportable || slots.toolbar" class="flex flex-wrap items-center gap-3 border-b border-line p-3">
      <InputText v-if="searchable" v-model="search" type="search" class="ls-input max-w-sm" :aria-label="ui('search')" :placeholder="ui('search')" />
      <slot name="toolbar" />
      <button v-if="exportable" type="button" class="ls-btn ls-btn-sm ms-auto" :disabled="loading" @click="exportCsv">{{ ui('export') }}</button>
    </div>
    <div v-if="error" role="alert" class="ls-error m-4"><p>{{ error }}</p><button type="button" class="ls-btn mt-3" @click="emit('retry')">{{ ui('retry') }}</button></div>
    <DataTable v-else ref="table" :value="value || []" :lazy="lazy" :loading="loading" :filters="filters()" :global-filter-fields="searchFields.length ? searchFields : undefined" :export-function="({ data }: { data: unknown }) => csvCell(data)" table-class="ls-table" :pt="{ root: { class: 'relative' }, pcPaginator: { root: { class: 'bs-paginator' }, content: { class: 'bs-paginator-content' }, first: { class: 'ls-btn ls-btn-sm' }, prev: { class: 'ls-btn ls-btn-sm' }, next: { class: 'ls-btn ls-btn-sm' }, last: { class: 'ls-btn ls-btn-sm' }, page: { class: 'ls-btn ls-btn-sm' }, pcRowPerPageDropdown: { root: { class: 'ls-input inline-flex w-auto items-center gap-2' }, label: { class: 'px-2' }, dropdown: { class: 'px-2' }, overlay: { class: 'ls-card p-2 shadow-overlay' }, option: { class: 'p-2' } } }, tableContainer: { class: 'overflow-auto' }, header: { class: 'p-3 border-b border-line' }, footer: { class: 'p-3 border-t border-line' }, loadingOverlay: { class: 'absolute inset-0 z-10 grid place-items-center bg-surface/80' } }" v-bind="forwardedAttrs()" @row-click="emit('row-click', $event)">
      <slot />
      <template v-for="name in forwardedSlots()" :key="name" #[name]="scope"><slot :name="name" v-bind="scope || {}" /></template>
      <template #empty><slot name="empty"><p class="p-6 text-center text-fg-muted">{{ ui('empty') }}</p></slot></template>
      <template #loading><slot name="loading"><p role="status" class="p-6">{{ ui('loading') }}</p></slot></template>
    </DataTable>
  </section>
</template>
<style>
.bs-paginator, .bs-paginator-content { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: .5rem; padding: .5rem; }
.bs-data-table [data-pc-name='paginator'] { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: .5rem; padding: 1rem; border-top: 1px solid var(--bs-border); }
.bs-data-table [data-pc-name='paginator'] button { min-width: 2.75rem; min-height: 2.75rem; border-radius: var(--bs-radius-button); }
.bs-data-table [data-pc-name='paginator'] button[aria-current='page'] { background: var(--bs-primary); color: var(--bs-text-on-primary); }
.bs-data-table [data-pc-section='sorticon'] { display: inline-block; width: 1rem; margin-inline-start: .5rem; }
.bs-data-table tr[aria-selected='true'] { background: var(--bs-surface-muted); }
.bs-data-table td[data-p-frozen-column='true'], .bs-data-table th[data-p-frozen-column='true'] { background: var(--bs-surface); }
</style>
