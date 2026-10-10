<script setup lang="ts">
definePageMeta({ layout: 'default' })
const { can } = useTenant()
const { writesAllowed } = useBilling()
const { start } = useAddTransaction()
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { data: categories } = useOrgCategories()
const { data: accounts } = useOrgAccounts()
const { data: tags, error: tagsError, refresh: refreshTags } = useOrgTags()
const { filters, sort, page, pageSize, scope, rows, total, pageCount, pending, error, validation, refresh, activeFilterCount, clearFilters, toggleSort, snapshot, applySnapshot } = useTransactionWorkspace()
const { views: savedViews, pending: savedViewsPending, error: savedViewsError, save: saveView, remove: removeView } = useJournalSavedViews()
const { density: tableDensity, hydrated: tablePreferenceHydrated } = useAccountingTablePreferences('journal-center')
const toasts = useToasts()
const describeError = useErrorMessage()
const importOpen = ref(false)
const filtersOpen = ref(false)
const selectedId = ref<string | null>(null)
const hydrated = ref(false)
const savedViewId = ref('')
const savedViewName = ref('')
const savingView = ref(false)
onMounted(() => { hydrated.value = true; void openCreateFromRoute(); void openImportFromRoute() })
watch(scope, () => { importOpen.value = false; selectedId.value = null; filtersOpen.value = false; savedViewId.value = ''; savedViewName.value = '' }, { flush: 'sync' })
const availableFlows = computed(() => ADD_FLOWS.filter(flow => can(FLOW_CAPABILITY[flow])))
const canCreate = computed(() => writesAllowed.value && availableFlows.value.length > 0)
const rangeStart = computed(() => total.value ? (page.value - 1) * pageSize + 1 : 0)
const rangeEnd = computed(() => Math.min(page.value * pageSize, total.value))
const QUICK_TYPES = ['', 'income', 'expense', 'transfer', 'adjustment'] as const
function addTransaction() {
  const flow = availableFlows.value.find(flow => flow === filters.type) ?? (availableFlows.value.includes('expense') ? 'expense' : availableFlows.value[0])
  if (canCreate.value && flow) start(flow)
}
async function openCreateFromRoute() {
  if (!hydrated.value || route.query.create !== '1') return
  if (canCreate.value) addTransaction()
  const query = { ...route.query }; delete query.create
  await router.replace({ query })
}
watch(() => route.query.create, () => void openCreateFromRoute())
async function openImportFromRoute() {
  if (!hydrated.value || route.query.import !== '1') return
  importOpen.value = true
  const query = { ...route.query }; delete query.import
  await router.replace({ query })
}
watch(() => route.query.import, () => void openImportFromRoute())
function ariaSort(column: string): 'none' | 'ascending' | 'descending' { return sort.column === column ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none' }
function applySavedView() {
  const view = savedViews.value.find(item => item.id === savedViewId.value)
  if (view) applySnapshot(view)
}
watch(savedViewId, applySavedView)
async function createSavedView() {
  if (!savedViewName.value.trim()) return
  savingView.value = true
  try {
    await saveView(savedViewName.value, snapshot())
    savedViewName.value = ''
    toasts.success(t('journalCenter.viewSavedTitle'), t('journalCenter.viewSavedBody'))
  }
  catch (failure) { toasts.error(t('journalCenter.viewError'), describeError(failure)) }
  finally { savingView.value = false }
}
async function deleteSavedView() {
  if (!savedViewId.value) return
  savingView.value = true
  try { await removeView(savedViewId.value); savedViewId.value = '' }
  catch (failure) { toasts.error(t('journalCenter.viewError'), describeError(failure)) }
  finally { savingView.value = false }
}
useHead({ title: () => `${t('transactions.title')} · ${t('app.name')}` })
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <div class="space-y-4">
    <BsPageHeader :title="t('transactions.title')" :subtitle="t('transactionWorkspace.subtitle')"  :context="ledgerPresentation.context(filters.from, filters.to, undefined)" :context-label="ledgerPresentation.t('pageContext.label')">
      <template #actions>
        <BsButton v-if="can('imports.create') && writesAllowed" type="button" class="ls-btn" :disabled="!hydrated" @click="importOpen = true">{{ t('imports.entryPoint') }}</BsButton>
        <BsButton v-if="canCreate" type="button" class="ls-btn ls-btn-primary" :disabled="!hydrated" @click="addTransaction"><BsIcon name="add" :size="18" />{{ t('transactionWorkspace.new') }}</BsButton>
      </template>
    </BsPageHeader>

    <div v-if="can('transactions.read')" class="ls-card space-y-4 p-4 sm:p-5">
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('transactions.type')">
        <BsButton v-for="type in QUICK_TYPES" :key="type" variant="chip" type="button" :aria-pressed="filters.type === type" :disabled="!hydrated" @click="filters.type = type">{{ type ? t(`types.${type}`) : t('transactionWorkspace.all') }}</BsButton>
      </div>
      <div class="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BsFloatingField class="min-w-0 sm:col-span-2" :label="t('transactions.searchLabel')"><input id="search" v-model="filters.search" type="search" class="ls-input" :placeholder="t('transactions.searchPlaceholder')" :disabled="!hydrated"></BsFloatingField>
        <BsFloatingField :label="t('transactions.type')"><select id="type" v-model="filters.type" class="ls-input" :disabled="!hydrated"><option value="">{{ t('transactionWorkspace.allTypes') }}</option><option v-for="type in TRANSACTION_TYPES" :key="type" :value="type">{{ t(`types.${type}`) }}</option></select></BsFloatingField>
        <BsFloatingField :label="t('transactions.status')"><select id="status" v-model="filters.status" class="ls-input" :disabled="!hydrated"><option value="">{{ t('transactionWorkspace.allStatuses') }}</option><option v-for="status in TRANSACTION_STATUSES" :key="status" :value="status">{{ t(`status.${status}`) }}</option></select></BsFloatingField>
        <BsFloatingField :label="t('journalCenter.source')"><select id="source" v-model="filters.source" class="ls-input" :disabled="!hydrated"><option value="">{{ t('journalCenter.allSources') }}</option><option v-for="source in TRANSACTION_SOURCES" :key="source" :value="source">{{ t(`journalSources.${source}`) }}</option></select></BsFloatingField>
        <BsFloatingField :label="t('transactions.fromDate')"><input id="from" v-model="filters.from" type="date" class="ls-input" :disabled="!hydrated"></BsFloatingField>
        <BsFloatingField :label="t('transactions.toDate')"><input id="to" v-model="filters.to" type="date" :min="filters.from" class="ls-input" :disabled="!hydrated"></BsFloatingField>
        <BsFloatingField :label="t('transactions.account')"><select id="account" v-model="filters.accountId" class="ls-input" :disabled="!hydrated"><option value="">{{ t('transactionWorkspace.allAccounts') }}</option><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></BsFloatingField>
        <div v-if="can('tags.read')">
          <BsFloatingField :label="t('tagsGuide.filter')"><select id="tag" v-model="filters.tagId" class="ls-input" :disabled="!hydrated || !!tagsError"><option value="">{{ t('tagsGuide.all') }}</option><option v-if="filters.tagId && !tags.some(tag => tag.id === filters.tagId)" :value="filters.tagId">{{ t('tagsGuide.selectedUnavailable') }}</option><option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option></select></BsFloatingField>
          <p v-if="tagsError" role="alert" class="mt-2 text-sm text-fg-muted">{{ t('tagsGuide.loadError') }} <BsButton variant="link" type="button" class="text-link underline" @click="refreshTags()">{{ t('accounts.retry') }}</BsButton></p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <BsButton type="button" class="ls-btn ls-btn-sm" :aria-expanded="filtersOpen" aria-controls="transaction-more-filters" :disabled="!hydrated" @click="filtersOpen = !filtersOpen">{{ t('transactionWorkspace.moreFilters') }}<BsIcon name="arrowDown" :size="16" /></BsButton>
        <BsButton v-if="activeFilterCount" type="button" class="ls-btn ls-btn-sm" :disabled="!hydrated" @click="clearFilters">{{ t('transactionWorkspace.clearFilters', { count: activeFilterCount }) }}</BsButton>
        <p v-if="!pending && !error && !validation" role="status" class="ms-auto text-sm text-fg-muted">{{ t('transactions.count', total) }}</p>
      </div>
      <div v-if="filtersOpen" id="transaction-more-filters" class="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
        <BsFloatingField :label="t('transactions.category')"><select id="category" v-model="filters.categoryId" class="ls-input"><option value="">{{ t('common.any') }}</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></BsFloatingField>
        <BsFloatingField :label="t('transactions.minAmount')"><input id="min" v-model="filters.minAmount" class="ls-input" inputmode="decimal" placeholder="0.00"></BsFloatingField>
        <BsFloatingField :label="t('transactions.maxAmount')"><input id="max" v-model="filters.maxAmount" class="ls-input" inputmode="decimal" placeholder="0.00"></BsFloatingField>
      </div>
      <div class="grid items-end gap-3 border-t border-line pt-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_auto_auto]">
        <BsFloatingField :label="t('journalCenter.savedViews')"><select id="saved-view" v-model="savedViewId" class="ls-input" :disabled="savedViewsPending || savingView"><option value="">{{ t('journalCenter.chooseView') }}</option><option v-for="view in savedViews" :key="view.id" :value="view.id">{{ view.name }}</option></select></BsFloatingField>
        <BsFloatingField :label="t('journalCenter.viewName')"><input id="saved-view-name" v-model="savedViewName" class="ls-input" maxlength="120" :disabled="savingView" @keyup.enter="createSavedView"></BsFloatingField>
        <BsButton type="button" class="ls-btn ls-btn-sm" :disabled="savingView || !savedViewName.trim()" @click="createSavedView">{{ t('journalCenter.saveView') }}</BsButton>
        <BsButton type="button" class="ls-btn ls-btn-sm" :disabled="savingView || !savedViewId" @click="deleteSavedView">{{ t('journalCenter.removeView') }}</BsButton>
        <p v-if="savedViewsError" role="alert" class="text-sm text-danger sm:col-span-4">{{ t('journalCenter.savedViewsError') }}</p>
      </div>
    </div>

    <p v-if="!can('transactions.read')" role="status" class="ls-card p-6 text-fg-muted">{{ t('transactionWorkspace.noRead') }}</p>
    <p v-else-if="validation" role="alert" class="ls-error">{{ t(`transactionWorkspace.validation.${validation}`) }}</p>
    <div v-else-if="error" role="alert" class="ls-card space-y-3 p-6"><h2 class="font-bold">{{ t('transactionWorkspace.loadError') }}</h2><p class="text-sm text-fg-muted">{{ t('transactionWorkspace.retryHint') }}</p><BsButton type="button" class="ls-btn" @click="refresh()">{{ t('accounts.retry') }}</BsButton></div>
    <BsSectionSkeleton v-else-if="pending" variant="table" :rows="8" />

    <BsEmptyState
      v-else-if="rows.length === 0 && !activeFilterCount && !filters.search"
      :title="t('transactions.emptyTitle')"
      :description="t('transactions.emptyHint')"
      :action-label="canCreate ? t('transactionWorkspace.new') : undefined"
      @action="addTransaction"
    />

    <BsEmptyState
      v-else-if="rows.length === 0"
      :title="t('transactions.noMatchTitle')"
      :description="t('transactions.noMatchHint')"
      :action-label="t('transactions.noMatchAction')"
      @action="clearFilters"
    />

    <div v-else class="ls-card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <BsTableDensity v-model="tableDensity" :disabled="!tablePreferenceHydrated" :label="ledgerPresentation.t('accountingTable.density')" :compact-label="ledgerPresentation.t('accountingTable.compact')" :comfortable-label="ledgerPresentation.t('accountingTable.comfortable')" />
        <p role="status" class="text-sm text-fg-muted">{{ t('transactions.showing', { from: rangeStart, to: rangeEnd, total }) }}</p>
      </div>
      <!-- Wide financial table on desktop -->
      <div class="hidden md:block">
        <BsDataTable :value="rows" row-key="id" :label="t('transactions.caption')" :density="tableDensity" sticky-header max-height="38rem" :scroll-label="t('accountingTable.journalScroll')" :columns="[{ key: 'column1', header: '', sticky: 'start' as const, ariaSort: ariaSort('journal_reference') }, { key: 'column2', header: '', ariaSort: ariaSort('transaction_date') }, { key: 'column3', header: (t('transactions.description')) }, { key: 'column4', header: '', ariaSort: ariaSort('source') }, { key: 'column5', header: '', ariaSort: ariaSort('status') }, { key: 'column6', header: '', sticky: 'end' as const, width: 'sm' as const, ariaSort: ariaSort('debit'), align: 'end' as const }, { key: 'column7', header: '', sticky: 'end' as const, width: 'sm' as const, ariaSort: ariaSort('credit'), align: 'end' as const }]" @row-click="event => selectedId = event.data.id">
          <template #header-column1><BsButton variant="link" type="button" class="hover:underline" @click="toggleSort('journal_reference')">{{ t('journalCenter.journalReference') }}</BsButton></template>
          <template #cell-column1="{ row }">
            <BsButton variant="link" type="button" class="font-semibold text-link hover:underline" @click.stop="selectedId = row.id">{{ row.journal_reference }}</BsButton>
            <p class="mt-1 max-w-48 truncate text-xs text-fg-muted" :title="row.from_account_name || undefined">{{ row.from_account_name || t('common.dash') }}</p>
            <p class="max-w-48 truncate text-xs text-fg-muted" :title="row.to_account_name || undefined"><BsIcon name="arrowRight" :size="14" directional class="inline-block" /> {{ row.to_account_name || t('common.dash') }}</p>
          </template>
          <template #header-column2><BsButton variant="link" type="button" class="hover:underline" @click="toggleSort('transaction_date')">{{ t('transactions.date') }}</BsButton></template>
          <template #cell-column2="{ row }">{{ formatDate(row.transaction_date, locale) }}</template>
          <template #header-column3>{{ t('transactions.description') }}</template>
          <template #cell-column3="{ row }"><BsButton variant="link" type="button" class="block max-w-56 truncate text-start font-semibold text-link hover:underline" @click.stop="selectedId = row.id">{{ row.description || t('common.dash') }}</BsButton>
            <span v-if="row.reference || row.category_name || row.counterparty_name" class="block max-w-56 truncate text-xs text-fg-muted">{{ [row.reference, row.category_name, row.counterparty_name].filter(Boolean).join(' · ') }}</span>
          <ul v-if="row.tags?.length" class="mt-2 flex flex-wrap gap-1" :aria-label="t('operations.tabs.tags')"><li v-for="tag in row.tags" :key="tag" class="rounded-control border border-line bg-surface-muted px-2 py-1 text-xs break-words">{{ tag }}</li></ul></template>
          <template #header-column4><BsButton variant="link" type="button" class="hover:underline" @click="toggleSort('source')">{{ t('journalCenter.source') }}</BsButton></template>
          <template #cell-column4="{ row }"><span>{{ t(`journalSources.${row.source}`) }}</span><span class="block text-xs text-fg-muted">{{ t(`types.${row.type}`) }}</span></template>
          <template #header-column5><BsButton variant="link" type="button" class="hover:underline" @click="toggleSort('status')">{{ t('transactions.status') }}</BsButton></template>
          <template #cell-column5="{ row }"><BsStatusBadge :status="row.status" /></template>
          <template #header-column6><BsButton variant="link" type="button" class="hover:underline" @click="toggleSort('debit')">{{ t('detail.debit') }}</BsButton></template>
          <template #cell-column6="{ row }"><BsMoneyText :amount="row.debit_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></template>
          <template #header-column7><BsButton variant="link" type="button" class="hover:underline" @click="toggleSort('credit')">{{ t('detail.credit') }}</BsButton></template>
          <template #cell-column7="{ row }"><BsMoneyText :amount="row.credit_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></template>

</BsDataTable>
      </div>

      <!-- Compact rows on small screens: a wide table is unusable on a phone -->
      <ul class="divide-y divide-[var(--bs-border)] md:hidden">
        <li v-for="row in rows" :key="row.id">
          <BsButton type="button" class="w-full px-4 py-3 text-start" @click="selectedId = row.id">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-xs font-semibold text-link">{{ row.journal_reference }}</p>
                <p class="truncate text-sm font-semibold">{{ row.description || t('common.dash') }}</p>
                <p class="mt-0.5 text-xs text-fg-muted">
                  {{ formatDate(row.transaction_date, locale) }} · {{ t(`journalSources.${row.source}`) }} · {{ t(`types.${row.type}`) }}
                </p>
              </div>
              <div class="shrink-0 text-end text-sm">
                <p><span class="text-xs text-fg-muted">{{ t('detail.debit') }}</span> <BsMoneyText class="font-semibold" :amount="row.debit_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></p>
                <p><span class="text-xs text-fg-muted">{{ t('detail.credit') }}</span> <BsMoneyText class="font-semibold" :amount="row.credit_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></p>
                <BsStatusBadge class="mt-1 block" :status="row.status" />
              </div>
            </div>
            <span v-if="row.tags?.length" class="mt-2 flex flex-wrap gap-1"><span v-for="tag in row.tags" :key="tag" class="rounded-control border border-line bg-surface-muted px-2 py-1 text-xs break-words">{{ tag }}</span></span>
          </BsButton>
        </li>
      </ul>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bs-border)] px-4 py-3">
        <p class="text-sm text-fg-muted">
          {{ t('transactions.showing', { from: rangeStart, to: rangeEnd, total }) }}
        </p>
        <div class="flex items-center gap-2">
          <BsButton type="button" class="ls-btn ls-btn-sm" :disabled="page <= 1" @click="page--">{{ t('common.previous') }}</BsButton>
          <span class="text-sm text-fg-muted">{{ t('transactions.page', { page, pages: pageCount }) }}</span>
          <BsButton type="button" class="ls-btn ls-btn-sm" :disabled="page >= pageCount" @click="page++">{{ t('common.next') }}</BsButton>
        </div>
      </div>
    </div>

    <CsvImportDialog v-model:visible="importOpen" />
    <TransactionDetailDialog
      :transaction-id="selectedId"
      @close="selectedId = null"
      @changed="refresh()"
      @navigate="id => selectedId = id"
    />
  </div>
</template>
