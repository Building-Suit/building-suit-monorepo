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
const { filters, sort, page, pageSize, scope, rows, total, pageCount, pending, error, validation, refresh, activeFilterCount, clearFilters, toggleSort } = useTransactionWorkspace()
const importOpen = ref(false)
const filtersOpen = ref(false)
const selectedId = ref<string | null>(null)
const hydrated = ref(false)
onMounted(() => { hydrated.value = true; void openCreateFromRoute(); void openImportFromRoute() })
watch(scope, () => { importOpen.value = false; selectedId.value = null; filtersOpen.value = false }, { flush: 'sync' })
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
function ariaSort(column: string) { return sort.column === column ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none' }
useHead({ title: () => `${t('transactions.title')} · ${t('app.name')}` })
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div><h1 class="text-h1 font-bold">{{ t('transactions.title') }}</h1><p class="mt-1 text-sm text-fg-muted">{{ t('transactionWorkspace.subtitle') }}</p></div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="can('imports.create') && writesAllowed" type="button" class="ls-btn" :disabled="!hydrated" @click="importOpen = true">{{ t('imports.entryPoint') }}</button>
        <button v-if="canCreate" type="button" class="ls-btn ls-btn-primary" :disabled="!hydrated" @click="addTransaction"><AppIcon name="add" :size="18" />{{ t('transactionWorkspace.new') }}</button>
      </div>
    </header>

    <div v-if="can('transactions.read')" class="ls-card space-y-4 p-4 sm:p-5">
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('transactions.type')">
        <button v-for="type in QUICK_TYPES" :key="type" type="button" class="ls-btn ls-btn-sm" :class="{ 'ls-btn-primary': filters.type === type }" :aria-pressed="filters.type === type" :disabled="!hydrated" @click="filters.type = type">{{ type ? t(`types.${type}`) : t('transactionWorkspace.all') }}</button>
      </div>
      <div class="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FloatingField class="min-w-0 sm:col-span-2" :label="t('transactions.searchLabel')"><input id="search" v-model="filters.search" type="search" class="ls-input" :placeholder="t('transactions.searchPlaceholder')" :disabled="!hydrated"></FloatingField>
        <FloatingField :label="t('transactions.type')"><select id="type" v-model="filters.type" class="ls-input" :disabled="!hydrated"><option value="">{{ t('transactionWorkspace.allTypes') }}</option><option v-for="type in TRANSACTION_TYPES" :key="type" :value="type">{{ t(`types.${type}`) }}</option></select></FloatingField>
        <FloatingField :label="t('transactions.status')"><select id="status" v-model="filters.status" class="ls-input" :disabled="!hydrated"><option value="">{{ t('transactionWorkspace.allStatuses') }}</option><option v-for="status in TRANSACTION_STATUSES" :key="status" :value="status">{{ t(`status.${status}`) }}</option></select></FloatingField>
        <FloatingField :label="t('transactions.fromDate')"><input id="from" v-model="filters.from" type="date" class="ls-input" :disabled="!hydrated"></FloatingField>
        <FloatingField :label="t('transactions.toDate')"><input id="to" v-model="filters.to" type="date" :min="filters.from" class="ls-input" :disabled="!hydrated"></FloatingField>
        <FloatingField class="sm:col-span-2" :label="t('transactions.account')"><select id="account" v-model="filters.accountId" class="ls-input" :disabled="!hydrated"><option value="">{{ t('transactionWorkspace.allAccounts') }}</option><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></FloatingField>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="ls-btn ls-btn-sm" :aria-expanded="filtersOpen" aria-controls="transaction-more-filters" :disabled="!hydrated" @click="filtersOpen = !filtersOpen">{{ t('transactionWorkspace.moreFilters') }}<AppIcon name="arrowDown" :size="16" /></button>
        <button v-if="activeFilterCount" type="button" class="ls-btn ls-btn-sm" :disabled="!hydrated" @click="clearFilters">{{ t('transactionWorkspace.clearFilters', { count: activeFilterCount }) }}</button>
        <p v-if="!pending && !error && !validation" role="status" class="ms-auto text-sm text-fg-muted">{{ t('transactions.count', total) }}</p>
      </div>
      <div v-if="filtersOpen" id="transaction-more-filters" class="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
        <FloatingField :label="t('transactions.category')"><select id="category" v-model="filters.categoryId" class="ls-input"><option value="">{{ t('common.any') }}</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></FloatingField>
        <FloatingField :label="t('transactions.minAmount')"><input id="min" v-model="filters.minAmount" class="ls-input" inputmode="decimal" placeholder="0.00"></FloatingField>
        <FloatingField :label="t('transactions.maxAmount')"><input id="max" v-model="filters.maxAmount" class="ls-input" inputmode="decimal" placeholder="0.00"></FloatingField>
      </div>
    </div>

    <p v-if="!can('transactions.read')" role="status" class="ls-card p-6 text-fg-muted">{{ t('transactionWorkspace.noRead') }}</p>
    <p v-else-if="validation" role="alert" class="ls-error">{{ t(`transactionWorkspace.validation.${validation}`) }}</p>
    <div v-else-if="error" role="alert" class="ls-card space-y-3 p-6"><h2 class="font-bold">{{ t('transactionWorkspace.loadError') }}</h2><p class="text-sm text-fg-muted">{{ t('transactionWorkspace.retryHint') }}</p><button type="button" class="ls-btn" @click="refresh()">{{ t('accounts.retry') }}</button></div>
    <SectionSkeleton v-else-if="pending" variant="table" :rows="8" />

    <EmptyState
      v-else-if="rows.length === 0 && !activeFilterCount && !filters.search"
      :title="t('transactions.emptyTitle')"
      :description="t('transactions.emptyHint')"
      :action-label="canCreate ? t('transactionWorkspace.new') : undefined"
      @action="addTransaction"
    />

    <EmptyState
      v-else-if="rows.length === 0"
      :title="t('transactions.noMatchTitle')"
      :description="t('transactions.noMatchHint')"
      :action-label="t('transactions.noMatchAction')"
      @action="clearFilters"
    />

    <div v-else class="ls-card overflow-hidden">
      <!-- Wide financial table on desktop -->
      <div class="hidden overflow-x-auto md:block">
        <BsDataTable :value="rows" data-key="id" :label="t('transactions.caption')" :row-class="() => 'cursor-pointer hover:bg-surface-muted'" @row-click="event => selectedId = event.data.id">
  <Column body-class="whitespace-nowrap" :pt="{ headerCell: { 'aria-sort': ariaSort('transaction_date') } }">
    <template #header><button type="button" class="hover:underline" @click="toggleSort('transaction_date')">{{ t('transactions.date') }}</button></template>
    <template #body="{ data: row }">{{ formatDate(row.transaction_date, locale) }}</template>
  </Column>
  <Column body-class="max-w-64">
    <template #header>{{ t('transactions.description') }}</template>
    <template #body="{ data: row }"><button type="button" class="block max-w-56 truncate text-start font-semibold text-link hover:underline" @click.stop="selectedId = row.id">{{ row.description || t('common.dash') }}</button>
                <span v-if="row.reference || row.category_name || row.counterparty_name" class="block max-w-56 truncate text-xs text-fg-muted">{{ [row.reference, row.category_name, row.counterparty_name].filter(Boolean).join(' · ') }}</span></template>
  </Column>
  <Column body-class="whitespace-nowrap" :pt="{ headerCell: { 'aria-sort': ariaSort('type') } }">
    <template #header><button type="button" class="hover:underline" @click="toggleSort('type')">{{ t('transactions.type') }}</button></template>
    <template #body="{ data: row }">{{ t(`types.${row.type}`) }}</template>
  </Column>
  <Column body-class="whitespace-nowrap text-fg-muted">
    <template #header>{{ t('transactions.fromTo') }}</template>
    <template #body="{ data: row }"><p class="max-w-40 truncate" :title="row.from_account_name || undefined">{{ row.from_account_name || t('common.dash') }}</p><p class="max-w-40 truncate" :title="row.to_account_name || undefined"><AppIcon name="arrowRight" :size="14" directional class="inline-block" /> {{ row.to_account_name || t('common.dash') }}</p></template>
  </Column>
  <Column  :pt="{ headerCell: { 'aria-sort': ariaSort('status') } }">
    <template #header><button type="button" class="hover:underline" @click="toggleSort('status')">{{ t('transactions.status') }}</button></template>
    <template #body="{ data: row }"><StatusBadge :status="row.status" /></template>
  </Column>
  <Column header-class="text-end" body-class="ls-num font-semibold" :pt="{ headerCell: { 'aria-sort': ariaSort('amount') } }">
    <template #header><button type="button" class="hover:underline" @click="toggleSort('amount')">{{ t('transactions.amount') }}</button></template>
    <template #body="{ data: row }"><MoneyText :amount-minor="row.amount_minor" :currency="row.currency_code" /></template>
  </Column>
</BsDataTable>
      </div>

      <!-- Compact rows on small screens: a wide table is unusable on a phone -->
      <ul class="divide-y divide-[var(--bs-border)] md:hidden">
        <li v-for="row in rows" :key="row.id">
          <button type="button" class="w-full px-4 py-3 text-start" @click="selectedId = row.id">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">{{ row.description || t('common.dash') }}</p>
                <p class="mt-0.5 text-xs text-fg-muted">
                  {{ formatDate(row.transaction_date, locale) }} · {{ row.category_name || t(`types.${row.type}`) }}
                </p>
              </div>
              <div class="shrink-0 text-end">
                <MoneyText class="text-sm font-semibold" :amount-minor="row.amount_minor" :currency="row.currency_code" />
                <StatusBadge class="mt-1 block" :status="row.status" />
              </div>
            </div>
          </button>
        </li>
      </ul>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bs-border)] px-4 py-3">
        <p class="text-sm text-fg-muted">
          {{ t('transactions.showing', { from: rangeStart, to: rangeEnd, total }) }}
        </p>
        <div class="flex items-center gap-2">
          <button type="button" class="ls-btn ls-btn-sm" :disabled="page <= 1" @click="page--">{{ t('common.previous') }}</button>
          <span class="text-sm text-fg-muted">{{ t('transactions.page', { page, pages: pageCount }) }}</span>
          <button type="button" class="ls-btn ls-btn-sm" :disabled="page >= pageCount" @click="page++">{{ t('common.next') }}</button>
        </div>
      </div>
    </div>

    <CsvImportDialog v-model:visible="importOpen" />
    <TransactionDetailDialog
      :transaction-id="selectedId"
      @close="selectedId = null"
      @changed="refresh()"
    />
  </div>
</template>
